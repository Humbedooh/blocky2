#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

""" This is the background worker, that scans for abusive behavior and
    logs it as new bans, according to the rule-sets. """


import re
import netaddr
import json
import time
import datetime
import plugins.database
import plugins.openapi
import os
import hashlib
import socket

DEBUG = True # If True, no DB writes/deletes will be done

def make_sha1(t, encoding = 'utf-8'):
    return hashlib.sha1(t.encode(encoding)).hexdigest()

def to_block(ipaddress):
    """ Converts an IP address or CIDR block to an IPNetwork object """
    block = None
    try:
        if '/' in ipaddress:
            block = netaddr.IPNetwork(ipaddress)
        else:
            if ':' in ipaddress: # IPv6?
                block = netaddr.IPNetwork("%s/128" % ipaddress)
            else: # IPv4?
                block = netaddr.IPNetwork("%s/32" % ipaddress)
    except netaddr.AddrFormatError:
        raise plugins.openapi.BlockyHTTPError(400, "Invalid IP address or network!")
    return block

def addnote(DB, ntype = 'automatic', what = "No message supplied"):
    doc = {
        'epoch': int(time.time()),
        'ntype': ntype,
        'text': what,
    }
    DB.ES.index(index=DB.dbname, doc_type = 'note', body = doc)

def get_whitelist(DB):
    """ Get the entire whitelist """
    whitelist = []
    res = DB.ES.search(
            index=DB.dbname,
            doc_type="whitelist",
            size = 5000,
            body = {
                'query': {
                    'match_all': {}
                }
            }
        )
    for hit in res['hits']['hits']:
        doc = hit['_source']
        ipaddress = doc.get('ip')
        if ipaddress:
            ipaddress = ipaddress.strip() # blocky/1 bug
            timeout = doc.get('timeout')
            # If there is a timeout in a whitelist object, check if we need to remove it
            if timeout and timeout > 0:
                if timeout < time.time():
                    addnote(DB, 'cleanup', "Removing whitelist rule %s for %s (timed out)" % (hit['_id'], ipaddress))
                    DB.ES.delete(index=DB.dbname, doc_type = 'whitelist', id = hit['_id'])
            # convert to IPNetwork object
            block = to_block(ipaddress)
            if block:
                whitelist.append(block)
    return whitelist


def get_banlist(DB):
    """ Get the entire banlist """
    banlist = []
    res = DB.ES.search(
            index=DB.dbname,
            doc_type="ban",
            size = 10000,
            body = {
                'query': {
                    'match_all': {}
                }
            }
        )
    for hit in res['hits']['hits']:
        doc = hit['_source']
        ipaddress = doc.get('ip')
        if not ipaddress:
            ipaddress = hit['_id'].replace('_', '/') # Blocky/1 syntax, bah
        if ipaddress:
            ipaddress = ipaddress.strip() # blocky/1 bug
            block = to_block(ipaddress)
            if block:
                banlist.append(block)
    return banlist

def get_iptables(DB):
    """ Get the entire list of host iptable sets """
    rulelist = []
    res = DB.ES.search(
            index=DB.dbname,
            doc_type="iptables",
            size = 5000,
            body = {
                'query': {
                    'match_all': {}
                }
            }
        )
    for hit in res['hits']['hits']:
        doc = hit['_source']
        hostname = doc.get('hostname', 'unknown')
        rules = doc.get('iptables', [])
        for rule in rules:
            rule['ip'] = to_block(rule['source'])
        entry = {
            'hostname': hostname,
            'rules': rules,
        }
        rulelist.append(entry)
    return rulelist


def construct_query(doctype, query, initial_terms = []):
    """ Construct an ES query based on doctype and ruleset """
    terms = initial_terms
    nterms = []
    for term in query:
        numm = re.match(r"(\S+)=([0-9.]+)", term)
        strm = re.match(r"(\S+)=\"(.+)\"", term)
        nstrm = re.match(r"(\S+)\!=\"(.+)\"", term)
        if numm:
            terms.append({"term": {numm.group(1): int(numm.group(2))}})
        elif nstrm:
            if '*' in nstrm.group(2):
                nterms.append({"match": {nstrm.group(1): nstrm.group(2)}})
            else:
                nterms.append({"term": {nstrm.group(1): nstrm.group(2)}})
        elif strm:
            if '*' in strm.group(2):
                terms.append({"match": {strm.group(1): strm.group(2)}})
            else:
                terms.append({"term": {strm.group(1): strm.group(2)}})

    # Now construct the final query
    q = None
    if doctype == 'httpd_visits':
        q = {
            "aggregations": {
                "byip": {
                    "filter": {
                        "bool": {
                            "must": terms,
                            "must_not": nterms
                        }
                    },
                    "aggs": {
                        "clients": {
                            "terms": {
                                "field": "clientip.keyword",
                                "size": 50,
                                "order": {
                                    "_count": "desc"
                                }
                            }
                        }
                    }
                }
            },
            "size": 0
        }
    elif doctype == 'httpd_traffic':
        q = {
            "aggregations": {
                "byip": {
                    "filter": {
                        "bool": {
                            "must": terms,
                            "must_not": nterms,
                        }
                    },
                    "aggs": {
                        "clients": {
                            "terms": {
                                "field": "clientip.keyword",
                                "size": 50,
                                "order": {
                                    "traffic": "desc"
                                }
                            },
                            "aggs": {
                                "traffic": {
                                    "sum": {
                                        "field": "bytes"
                                    }
                                }
                            }
                        }
                    } 
                }
            },
            "size": 0
            }
    return q



def start(DB, config, pidfile):
    time.sleep(120)
    # First, check that indices are present
    # We're assuming ES6 here...
    if type(DB.ES) is plugins.database.BlockyESWrapper:
        for el in ['whitelist', 'banlist', 'rules', 'notes']:
            if not DB.ES.exists_doctype(index=DB.dbname, doc_type=el):
                print("DB index %s does not exist, creating.." % el)
                DB.ES.create(index=DB.dbname, doc_type = el)

    # Okay, now run the rule-set every once in a while
    while os.path.exists(pidfile):
        print("Running rulesets against database...")
        now = time.time()
        # First, fetch all rules
        rules = []
        res = DB.ES.search(
                index=DB.dbname,
                doc_type="rule",
                size = 5000,
                body = {
                    'query': {
                        'match_all': {}
                    }
                }
            )
        for hit in res['hits']['hits']:
            doc = hit['_source']
            doc['rid'] = hit['_id']
            rules.append(doc)
        
        # Prep list of bad IPs to block
        bad_ips = []
        
        # Prep list of indices to check against, for performance reasons
        d = datetime.datetime.utcnow()
        t = []
        for i in range(0,3):
            t.append(d.strftime("loggy-%Y.%m.%d"))
            d -= datetime.timedelta(days = 1)
        threes = ",".join(t) # Past three days
        
        
        # Now, run each rule
        for rule in rules:
            limit = rule.get('limit')
            span = rule.get('span')
            doctype = rule.get('type')
            name = rule.get('name', 'Generic rule')
            query = rule.get('query')
            rid = rule.get('rid', 'null')
            if limit and span and query:
                print("Running rule '%s'..." % name)

                
                # Start with timestamp terms
                terms = []
                terms.append({
                    "range": {
                        "@timestamp": {
                            "gt": ("now-%uh" % span)
                        }
                    }
                })
                
                # For each term in our blocky query, convert to ES terms
                q = construct_query(doctype, query, terms)
                # If valid query, run it and find bad IPs
                if q:
                    res = DB.ES.search(index=threes, request_timeout=90, body=q)
                    if res and 'aggregations' in res:
                        if doctype == 'httpd_visits':
                            for suspect in res['aggregations']['byip']['clients']['buckets']:
                                c = suspect['doc_count']
                                i = suspect['key']
                                if c > limit:
                                    r = "%s (%u >= limit of %u)" % (name, c, limit)
                                    bad_ips.append({'ip': i, 'reason': r, 'target': '*', 'rid': rid, 'epoch': int(time.time())})
                                    print("Found offender: %s; %s" % (i, r))
                        
                        elif doctype == 'httpd_traffic':
                            for suspect in res['aggregations']['byip']['clients']['buckets']:
                                c = suspect['traffic']['value']
                                i = suspect['key']
                                if c > limit:
                                    r = "%s (%u >= limit of %u)" % (name, c, limit)
                                    bad_ips.append({'ip': i, 'reason': r, 'target': '*', 'rid': rid, 'epoch': int(time.time())})
                                    print("Found offender: %s; %s" % (i, r))
        
        print("Done with rules after %u seconds, found %u offenders" % (time.time() - now, len(bad_ips)))
        # Now we have a list of bad IPs.
        # Compare against whitelist, filter out any that are there
        # Block the rest
        
        # Fetch whitelist
        whitelist = get_whitelist(DB)

        # For each baddie, compare against whitelist
        to_ban = []
        for bad_ip in bad_ips:
            ipaddress = netaddr.IPAddress(bad_ip['ip'])
            whitelisted = False
            for whiteblock in whitelist:
                if ipaddress in whiteblock:
                    print("%s is whitelisted as %s, ignoring offenses..." % (ipaddress, whiteblock))
                    whitelisted = True
                    break
            if not whitelisted:
                to_ban.append(bad_ip)
        
        # For each IP we should be banning, ban if not already banned
        for bad_ip in to_ban:
            banid = make_sha1(bad_ip['ip'])
            if not DB.ES.exists(index=DB.dbname, doc_type = 'ban', id = banid):
                rdns = bad_ip['ip']
                try:
                    rdns = socket.gethostbyaddr(bad_ip['ip'])
                except:
                    pass # don't care, at all
                bad_ip['dns'] = rdns if rdns else bad_ip['ip']
                print("Banning %s as %s" % (bad_ip['ip'], banid))
                if not DEBUG:
                    addnote(DB, 'autoban', "Banning %s on %s as %s (%s)" % (bad_ip['ip'], bad_ip['target'], banid, bad_ip['reason']))
                    DB.ES.index(index=DB.dbname, doc_type = 'ban', id = banid, body = bad_ip)
        
        # Now sleep for a minute
        time.sleep(120)
        
