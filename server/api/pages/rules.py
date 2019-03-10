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
# OPENAPI-URI: /api/rules
########################################################################
# delete:
#   requestBody:
#     content:
#       application/json:
#         schema:
#           $ref: '#/components/schemas/Ruleset'
#     description: Removes a rule entry
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
#   summary: Remove a rule entry
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
#   summary: Displays the current ruleset entries
# put:
#   requestBody:
#     content:
#       application/json:
#         schema:
#           $ref: '#/components/schemas/Ruleset'
#     description: Ruleset to add/modify
#     required: true
#   responses:
#     '200':
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/ActionCompleted'
#       description: Ruleset added
#     default:
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/Error'
#       description: unexpected error
#   summary: Adds or overrides a ruleset
# 
########################################################################





"""
This is the ruleset handler for Blocky/2
"""

import json
import re
import time
import bcrypt
import hashlib
import plugins.worker
import uuid

def run(API, environ, indata, session):
    global WHITE_CACHE, WHITE_TS
    method = environ['REQUEST_METHOD']
    
    # Adding a new entry?
    if method == "PUT":
        rid = indata.get('rid')
        submitter = environ.get('HTTP_PROXY_USER', 'Admin')
        name = indata.get('name')
        rtype = indata.get('type')
        span = indata.get('span')
        limit = indata.get('limit')
        query = indata.get('query')
        
        # all good? Okay, add the entry then
        entry = {
            'name': name,
            'type': rtype,
            'query': query,
            'span': span,
            'limit': limit
        }
        if not rid:
            rid = str(uuid.uuid4())
            plugins.worker.addnote(session.DB, 'manual', "%s made a new ruleset %s (%s)" % (submitter, rid, name))
        else:
            plugins.worker.addnote(session.DB, 'manual', "%s updated ruleset %s (%s)" % (submitter, rid, name))
        
        session.DB.ES.index(index=session.DB.dbname, doc_type = 'rule', id = rid, body = entry, refresh = 'wait_for')
        yield json.dumps({"message": "Ruleset added!"})
        return
        
    # Delete an entry
    if method == "DELETE":
        rid = indata.get('rid')
        submitter = environ.get('HTTP_PROXY_USER', 'Admin')
        if re.match(r"^[-a-f0-9]+$", rid):
            if session.DB.ES.exists(index=session.DB.dbname, doc_type='rule', id = rid):
                doc = session.DB.ES.get(index=session.DB.dbname, doc_type='rule', id = rid)['_source']
                plugins.worker.addnote(session.DB, 'manual', "Ruleset %s (%s) removed by %s" % (rid, doc.get('name', '??'), submitter))
                session.DB.ES.delete(index=session.DB.dbname, doc_type='rule', id = rid, refresh = 'wait_for')
            yield json.dumps({"message": "Entry removed"})
            return
        yield API.exception(400, "Invalid rule ID passed!")
        
    # Display the current ruleset entries
    if method == "GET":
        rules = []
        res = session.DB.ES.search(
                index=session.DB.dbname,
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
        JSON_OUT = {
            'rules': rules
        }
        yield json.dumps(JSON_OUT)
        return
    
    # Finally, if we hit a method we don't know, balk!
    yield API.exception(400, "I don't know this request method!!")
    