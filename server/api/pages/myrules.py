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
# OPENAPI-URI: /api/myrules
########################################################################
# put:
#   requestBody:
#     content:
#       application/json:
#         schema:
#           $ref: '#/components/schemas/IPTables'
#     description: iptables ruleset blob
#     required: true
#   responses:
#     '200':
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/ActionCompleted'
#       description: iptables entries updatd
#     default:
#       content:
#         application/json:
#           schema:
#             $ref: '#/components/schemas/Error'
#       description: unexpected error
#   summary: Set a host's iptables list
# 
########################################################################





"""
This is the iptables list handler for Blocky/2
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

def run(API, environ, indata, session):
    global BANLIST, BAN_TS
    method = environ['REQUEST_METHOD']
    
    # Adding a new entry?
    if method == "PUT":
        rules = indata.get('iptables')
        hostname = indata.get('hostname')
        if hostname and type(rules) is list: #just in case!
            print("Got %u rules from %s" % (len(rules), hostname))
            iid = plugins.worker.make_sha1(hostname)
            ipdoc = {
                'hostname': hostname,
                'updated': int(time.time()),
                'iptables': rules,
            }
            session.DB.ES.index(index=session.DB.dbname, doc_type = 'iptables', id = iid, body = ipdoc)
        yield json.dumps({"message": "Iptables updated"})
        return
    
    # Finally, if we hit a method we don't know, balk!
    yield API.exception(400, "I don't know this request method!!")
    