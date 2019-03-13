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
########################################################################
# OPENAPI-URI: /api/fail2ban
########################################################################
# post:
#   requestBody:
#     content:
#       application/json:
#         schema:
#           $ref: '#/components/schemas/SearchObject'
#     description: Search query
#     required: true
#   responses:
#     '200':
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/SearchResult'
#       description: Search result
#     default:
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/Error'
#       description: unexpected error
#   summary: Search for whether a user was blocked via fail2ban
# 
########################################################################



"""
This is the search handler for Blocky/2
"""

import json
import re
import time
import bcrypt
import hashlib
import plugins.worker
import netaddr
import datetime

def find_rule(DB, doctype, ip):
    """ Find a rule, either v1 or v2 style """
    bid = plugins.worker.make_sha1(str(ip))
    bid2 = plugins.worker.make_sha1(str(ip).replace('/32', '').replace('/128',''))
    # Blocky/2 ban doc
    if DB.ES.exists(index=DB.dbname, doc_type = doctype, id = bid):
        return DB.ES.get(index=DB.dbname, doc_type = doctype, id = bid)
    if DB.ES.exists(index=DB.dbname, doc_type = doctype, id = bid2):
        return DB.ES.get(index=DB.dbname, doc_type = doctype, id = bid2)
    
    # Blocky/1 ban doc
    oid = str(ip).replace('/', '_').replace('_32', '').replace('_128', '')
    if DB.ES.exists(index=DB.dbname, doc_type = doctype, id = oid):
        return DB.ES.get(index=DB.dbname, doc_type = doctype, id = oid)


def run(API, environ, indata, session):
    method = environ['REQUEST_METHOD']
    
    # Searching? :)
    if method == "POST":
        found = {
            'whitelist': [],
            'banlist': [],
            'iptables': [],
        }
        user = indata.get('source')
        
        
        # Prep list of indices to check against, for performance reasons
        d = datetime.datetime.utcnow()
        t = []
        for i in range(0,7):
            t.append(d.strftime("loggy-%Y.%m.%d"))
            d -= datetime.timedelta(days = 1)
        threes = ",".join(t) # Past seven days
        
        res = session.DB.ES.search(
                    index=threes,
                    size = 500,
                    body = {
                        "query": {
                            "bool": {
                                "must": [
                                    {
                                        "match": {
                                            "message": "AH01617"
                                        }                                        
                                    },
                                    {
                                        "match": {
                                            "message": user
                                        }                                        
                                    },
                                    {
                                    "term": {
                                        "_type": 'apache_error'
                                    }
                                  },
                                ]
                            }
                        }
                    }
                )
        ips = {}
        
        for hit in res['hits']['hits']:
            doc = hit['_source']
            if doc.get('module') == 'auth_basic:error' and user in doc.get('message') and 'client_ip' in doc:
                ips[doc['client_ip']] = doc['message']
        
                
        #get whitelist and banlist, plus iptables rules
        whitelist = plugins.worker.get_whitelist(session.DB)
        banlist = plugins.worker.get_banlist(session.DB)
        iptables = plugins.worker.get_iptables(session.DB)
        
                
        for ip, msg in ips.items():
            print(ip)
            me = plugins.worker.to_block(ip) # queried IP as IPNetwork object
            # Find all whitelist entries that touch on this
            for block in whitelist:
                if me in block or block in me or me == block:
                    rule = find_rule(session.DB, 'whitelist', str(block))
                    if rule:
                        doc = rule['_source']
                        doc['rid'] = rule['_id']
                        found['whitelist'].append(doc)
            
            # Find all banlist entries that touch on this
            for block in banlist:
                if me in block or block in me or me == block:
                    rule = find_rule(session.DB, 'ban', str(block))
                    if rule:
                        doc = rule['_source']
                        doc['rid'] = rule['_id']
                        if not 'ip' in doc:
                            doc['ip'] = doc['rid'].replace('_', '/')
                        found['banlist'].append(doc)
            
            # Find any iptables rules that may have it as well (max 10)
            found_iptables = 0
            anything = netaddr.IPNetwork("0.0.0.0/0")
            for host in iptables:
                for rule in host['rules']:
                    block = rule['ip']
                    if block and type(block) is netaddr.IPNetwork:
                        if (me in block or block in me or me == block ) and (block != anything and me != anything):
                            rule['hostname'] = host['hostname']
                            rule['ip'] = str(rule['ip']) # stringify
                            rule['msg'] = msg
                            found['iptables'].append(rule)
                            found_iptables += 1
                        if found_iptables == 10:
                            break
                if found_iptables == 10:
                    break

        yield json.dumps({"results": found}, indent = 2)
        return
    
    # Finally, if we hit a method we don't know, balk!
    yield API.exception(400, "I don't know this request method!!")
    