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
# OPENAPI-URI: /api/whitelist
########################################################################
# delete:
#   requestBody:
#     content:
#       application/json:
#         schema:
#           $ref: '#/components/schemas/IPAddress'
#     description: Removes a whitelist entry
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
#   summary: Displays the current whitelist entries
# put:
#   requestBody:
#     content:
#       application/json:
#         schema:
#           $ref: '#/components/schemas/IPAddress'
#     description: IP address or block to whitelist
#     required: true
#   responses:
#     '200':
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/ActionCompleted'
#       description: Whitelist entry added
#     default:
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/Error'
#       description: unexpected error
#   summary: Add a whitelist entry
# 
########################################################################





"""
This is the whitelist handler for Blocky/2
"""

import json
import re
import time
import bcrypt
import hashlib
import plugins.worker

WHITE_CACHE = []
WHITE_TS = 0
WHITE_CACHE_TIME = 30

def remove_ban(session, ban):
    """ Remove a ban, either v1 or v2 style """
    plugins.worker.addnote(session.DB, 'system', "Removing banlist entry for %s due to forced whitelisting" % ban)
    bid = plugins.worker.make_sha1(str(ban))
    # Blocky/2 ban doc
    if session.DB.ES.exists(index=session.DB.dbname, doc_type = 'ban', id = bid):
        session.DB.ES.delete(index=session.DB.dbname, doc_type = 'ban', id = bid, refresh = 'wait_for')
    # Blocky/1 ban doc
    oid = str(ban).replace('/', '_').replace('_32', '')
    if session.DB.ES.exists(index=session.DB.dbname, doc_type = 'ban', id = oid):
        session.DB.ES.delete(index=session.DB.dbname, doc_type = 'ban', id = oid, refresh = 'wait_for')

def run(API, environ, indata, session):
    global WHITE_CACHE, WHITE_TS
    method = environ['REQUEST_METHOD']
    
    # Adding a new entry?
    if method == "PUT":
        ip = indata['source']
        reason = indata['reason']
        target = indata.get('target', '*')
        timeout = indata.get('timeout', 0)
        submitter = environ.get('HTTP_PROXY_USER', 'Admin')
        force = indata.get('force', False)
        reason = "Whitelisted by %s: %s" % (submitter, reason)
        
        # Check if this IP is within a banned space
        block = plugins.worker.to_block(ip)
        banlist = plugins.worker.get_banlist(session.DB)
        for ban in banlist:
            if block in ban:
                if force:
                    remove_ban(session, str(ban))
                else:
                    raise API.exception(403, "IP Address is currently banned as %s, please remove first or use force push!" % ban)
            if ban in block:
                if force:
                    remove_ban(session, str(ban))
                else:
                    raise API.exception(403, "This whitelist would cancel ban entry for %s, cannot mix (use force push?)" % ban)
        
        # all good? Okay, add the entry then
        entry = {
            'ip': ip,
            'reason': reason,
            'target': target,
            'epoch': int(time.time()),
            'timeout': timeout
        }
        bid = plugins.worker.make_sha1(ip)
        session.DB.ES.index(index=session.DB.dbname, doc_type = 'whitelist', id = bid, body = entry, refresh = 'wait_for')
        plugins.worker.addnote(session.DB, 'manual', "Whitelisting %s per %s: %s" % (ip, submitter, reason))
        yield json.dumps({"message": "Entry added!"})
        return
        
    # Delete an entry
    if method == "DELETE":
        rid = indata.get('rule')
        submitter = environ.get('HTTP_PROXY_USER', 'Admin')
        if re.match(r"^[a-f0-9]+$", rid):
            if session.DB.ES.exists(index=session.DB.dbname, doc_type='whitelist', id = rid):
                doc = session.DB.ES.get(index=session.DB.dbname, doc_type='whitelist', id = rid)['_source']
                plugins.worker.addnote(session.DB, 'manual', "Whitelisting rule %s for %s removed by %s" % (rid, doc.get('ip', '??'), submitter))
                session.DB.ES.delete(index=session.DB.dbname, doc_type='whitelist', id = rid, refresh = 'wait_for')
                
            yield json.dumps({"message": "Entry removed"})
            return
        elif re.match(r"^[a-f0-9.:_]+$", rid):
            if session.DB.ES.exists(index=session.DB.dbname, doc_type='whitelist', id = rid):
                doc = session.DB.ES.get(index=session.DB.dbname, doc_type='whitelist', id = rid)['_source']
                plugins.worker.addnote(session.DB, 'manual', "Whitelisting rule %s for %s removed by %s" % (rid, doc.get('ip', '??'), submitter))
                session.DB.ES.delete(index=session.DB.dbname, doc_type='whitelist', id = rid, refresh = 'wait_for')
            yield json.dumps({"message": "Entry removed"})
            return
        yield API.exception(400, "Invalid rule ID passed!")
        
    # Display the current whitelist entries
    if method == "GET":
        if WHITE_TS < (time.time() - WHITE_CACHE_TIME) or 'Mozilla' in environ.get('HTTP_USER_AGENT', 'python'):
            res = session.DB.ES.search(
                    index=session.DB.dbname,
                    doc_type="whitelist",
                    size = 5000,
                    body = {
                        'query': {
                            'match_all': {}
                        }
                    }
                )
        
            WHITE_CACHE = []
            WHITE_TS = time.time()
            for hit in res['hits']['hits']:
                doc = hit['_source']
                doc['rid'] = hit['_id']
                doc['ip'] = doc['ip'].strip() # backwards compat fix
                WHITE_CACHE.append(doc)
            
        JSON_OUT = {
            'whitelist': WHITE_CACHE
        }
        yield json.dumps(JSON_OUT)
        return
    
    # Finally, if we hit a method we don't know, balk!
    yield API.exception(400, "I don't know this request method!!")
    