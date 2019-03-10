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
# OPENAPI-URI: /api/bans
########################################################################
# delete:
#   requestBody:
#     content:
#       application/json:
#         schema:
#           $ref: '#/components/schemas/IPAddress'
#     description: Removes a banlist entry
#     required: true
#   responses:
#     '200':
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/ActionCompleted'
#       description: Removal successful
#     default:
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/Error'
#       description: unexpected error
#   security:
#   - cookieAuth: []
#   summary: Remove a whitelist entry
# get:
#   responses:
#     '200':
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/Empty'
#       description: 200 response
#     default:
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/Error'
#       description: unexpected error
#   security:
#   - cookieAuth: []
#   summary: Displays the current banlistr entries
# put:
#   requestBody:
#     content:
#       application/json:
#         schema:
#           $ref: '#/components/schemas/IPAddress'
#     description: IP address or block to ban
#     required: true
#   responses:
#     '200':
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/ActionCompleted'
#       description: Ban entry added
#     default:
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/Error'
#       description: unexpected error
#   summary: Add a banmlist entry
# 
########################################################################





"""
This is the banlist handler for Blocky/2
"""

import json
import re
import time
import bcrypt
import hashlib
import plugins.worker

# Cached vars
BANLIST = []
BAN_TS = 0
BAN_CACHE_TIME = 30

def find_rule(DB, doctype, ip):
    """ Find a rule, either v1 or v2 style """
    bid = plugins.worker.make_sha1(str(ip))
    # Blocky/2 ban doc
    if DB.ES.exists(index=DB.dbname, doc_type = doctype, id = bid):
        return DB.ES.get(index=DB.dbname, doc_type = doctype, id = bid)
    # Blocky/1 ban doc
    oid = str(ip).replace('/', '_').replace('_32', '').replace('_128', '')
    if DB.ES.exists(index=DB.dbname, doc_type = doctype, id = oid):
        return DB.ES.get(index=DB.dbname, doc_type = doctype, id = oid)


def to_whitelist_temp(DB, hit):
    """ Temporarily turn a banlist entry into a whitelist entry """
    doc = hit['_source']
    ipaddress = doc.get('ip')
    if not ipaddress:
        ipaddress = hit['_id'].replace('_', '/') # Blocky/1 syntax, bah
    if ipaddress:
        ipaddress = ipaddress.strip() # blocky/1 bug
        block = plugins.worker.to_block(ipaddress)
        ip = str(block)
        entry = {
                'ip': ip,
                'reason': "Temporary system whitelist due to unban",
                'target': "*",
                'epoch': int(time.time()),
                'timeout': int(time.time() + 3600)
            }
        bid = plugins.worker.make_sha1(ip)
        DB.ES.index(index=DB.dbname, doc_type = 'whitelist', id = bid, body = entry)
        plugins.worker.addnote(DB, 'system', "Whitelisting %s temporarily to flush blocks" % (ipaddress))


def remove_whitelist(session, white):
    """ Remove a white, either v1 or v2 style """
    plugins.worker.addnote(session.DB, 'system',"Removing whitelist entry for %s due to forced banlisting" % white)
    bid = plugins.worker.make_sha1(str(white))
    # Blocky/2 ban doc
    if session.DB.ES.exists(index=session.DB.dbname, doc_type = 'whitelist', id = bid):
        session.DB.ES.delete(index=session.DB.dbname, doc_type = 'whitelist', id = bid, refresh = 'wait_for')
    # Blocky/1 ban doc
    oid = str(white).replace('/', '_').replace('_32', '')
    if session.DB.ES.exists(index=session.DB.dbname, doc_type = 'whitelist', id = oid):
        session.DB.ES.delete(index=session.DB.dbname, doc_type = 'whitelist', id = oid, refresh = 'wait_for')


def run(API, environ, indata, session):
    global BANLIST, BAN_TS
    method = environ['REQUEST_METHOD']
    
    # Adding a new entry?
    if method == "PUT":
        ip = indata['source']
        reason = indata['reason']
        target = indata.get('target', '*')
        force = indata.get('force', False)
        submitter = environ.get('HTTP_PROXY_USER', 'Admin')
        reason = "Banned by %s: %s" % (submitter, reason)
        
        # Check if ban already exists
        if find_rule(session.DB, 'ban', ip):
            raise API.exception(400, "A ban already exists for this IP!")
        
        # Check if this IP is within a whitelisted space
        block = plugins.worker.to_block(ip)
        whitelist = plugins.worker.get_whitelist(session.DB)
        for white in whitelist:
            if block in white:
                if force:
                    remove_whitelist(session, white)
                else:
                    raise API.exception(403, "IP Address is whitelisted as %s, cannot ban!" % white)
            if white in block:
                if force:
                    remove_whitelist(session, white)
                else:
                    raise API.exception(403, "This ban would cancel whitelist entry for %s, cannot mix" % white)
        
        # all good? Okay, add the entry then
        entry = {
            'ip': ip,
            'reason': reason,
            'target': target,
            'epoch': int(time.time())
        }
        bid = plugins.worker.make_sha1(str(block))
        session.DB.ES.index(index=session.DB.dbname, doc_type = 'ban', id = bid, body = entry)
        plugins.worker.addnote(session.DB, 'manual', "Manual ban for %s added by %s: %s" % (ip, submitter, reason))
        yield json.dumps({"message": "Entry added!"})
        return
    
    
    # Delete an entry
    if method == "DELETE":
        submitter = environ.get('HTTP_PROXY_USER', 'Admin')
        rid = indata.get('rule')
        doc = None
        if re.match(r"^[a-f0-9]+$", rid):
            if session.DB.ES.exists(index=session.DB.dbname, doc_type='ban', id = rid):
                hit = session.DB.ES.get(index=session.DB.dbname, doc_type='ban', id = rid)
                plugins.worker.addnote(session.DB, 'manual', "Ban for %s removed by %s" % (hit['_source'].get('ip', rid), submitter))
                to_whitelist_temp(session.DB, hit)
                session.DB.ES.delete(index=session.DB.dbname, doc_type='ban', id = rid, refresh = 'wait_for')
            yield json.dumps({"message": "Entry removed"})
            return
        elif re.match(r"^[a-f0-9.:_]+$", rid):
            if session.DB.ES.exists(index=session.DB.dbname, doc_type='ban', id = rid):
                hit = session.DB.ES.get(index=session.DB.dbname, doc_type='ban', id = rid, refresh = 'wait_for')
                plugins.worker.addnote(session.DB, 'manual', "Ban for %s removed by %s" % (hit['_source'].get('ip', rid), submitter))
                to_whitelist_temp(session.DB, hit)
                session.DB.ES.delete(index=session.DB.dbname, doc_type='ban', id = rid)
            yield json.dumps({"message": "Entry removed"})
            return
        else:
            raise API.exception(400, "Invalid rule ID specified!")
    
    # Display the current banlist entries
    if method == "GET":
        # Only re-fetch banlist every 30 secs, save processing power!
        if BAN_TS < (time.time() - BAN_CACHE_TIME) or 'Mozilla' in environ.get('HTTP_USER_AGENT', 'python'):
            res = session.DB.ES.search(
                    index=session.DB.dbname,
                    doc_type="ban",
                    size = 10000,
                    body = {
                        'query': {
                            'match_all': {}
                        }
                    }
                )
        
            BANLIST = []
            for hit in res['hits']['hits']:
                doc = hit['_source']
                ip = doc.get('ip')
                if not ip:
                    ip = hit['_id'].replace('_', '/') # backwards compat
                if ip:
                    doc['ip'] = ip.strip()
                    doc['rid'] = hit['_id']
                    BANLIST.append(doc)
            BAN_TS = time.time()
            
        JSON_OUT = {
            'bans': BANLIST
        }
        yield json.dumps(JSON_OUT)
        return
    
    # Finally, if we hit a method we don't know, balk!
    yield API.exception(400, "I don't know this request method!!")
    