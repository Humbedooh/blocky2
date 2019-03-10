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
# OPENAPI-URI: /api/activity
########################################################################
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
#   summary: Displays the current activity entries
# 
########################################################################



"""
This is the activity handler for Blocky/2
"""

import json
import re
import time
import bcrypt
import hashlib
import plugins.worker

def run(API, environ, indata, session):
    global WHITE_CACHE, WHITE_TS
    method = environ['REQUEST_METHOD']
    
    # Display the current activity entries
    if method == "GET":
        activity = []
        res = session.DB.ES.search(
                index=session.DB.dbname,
                doc_type="note",
                size = 500,
                body = {
                    'query': {
                        'match_all': {}
                    },
                    'sort': {
                        "epoch": "desc"
                    }
                }
            )
    
        for hit in res['hits']['hits']:
             doc = hit['_source']
             if doc['ntype'] in ['manual', 'client', 'system', 'autoban']:
                activity.append(doc)
         
        JSON_OUT = {
            'activity': activity
        }
        yield json.dumps(JSON_OUT)
        return
    
    # Finally, if we hit a method we don't know, balk!
    yield API.exception(400, "I don't know this request method!!")
    