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

"""
This is the session library for Blocky.
It handles setting/getting cookies and user prefs
"""


# Main imports
import cgi
import re
import sys
import traceback
import http.cookies
import uuid
import elasticsearch
import time

account_lookup_cache = {}

NO_SESSIONS = True

class BlockySession(object):

    def logout(self):
        """Log out user and wipe cookie"""
        if self.user and self.cookie:
            cookies = http.cookies.SimpleCookie()
            cookies['blocky_session'] = "null"
            self.headers.append(('Set-Cookie', cookies['blocky_session'].OutputString()))
            try:
                self.DB.ES.delete(index=self.DB.dbname, doc_type='uisession', id = self.cookie)
                self.cookie = None
                self.user = None
            except:
                pass
    def newCookie(self):
        cookie = uuid.uuid4()
        self.sdoc = {
            'timestamp': int(time.time())
        }
        if not NO_SESSIONS:
            self.DB.ES.index(index=self.DB.dbname, doc_type='uisession', id = cookie, body = self.sdoc);
        cookies = http.cookies.SimpleCookie()
        cookies['blocky_session'] = cookie
        cookies['blocky_session']['path'] = '/'
        cookies['blocky_session']['secure'] = '1'
        cookies['blocky_session']['expires'] = 86400 * 365 # Expire one year from now
        self.headers.append(('Set-Cookie', cookies['blocky_session'].OutputString()))
        #print("Making new cookie %s!" % cookie)
        return cookie

    def __init__(self, DB, environ, config):
        """
        Loads the current user session or initiates a new session if
        none was found.
        """
        self.config = config
        self.user = None
        self.DB = DB
        self.ip = environ.get('REMOTE_ADDR', '?.?.?.?')
        if environ.get('HTTP_X_FORWARDED_FOR'):
            self.ip = environ.get('HTTP_X_FORWARDED_FOR')
        self.headers = [('Content-Type', 'application/json')]
        self.cookie = None
        self.environ = environ

        # Construct the URL we're visiting
        self.url = "https://asf.jamhosted.net"
        self.url += environ.get('SCRIPT_NAME', '/')
        self.sdoc = None

        # Get Blocky cookie
        cookie = None
        cookies = None
        if 'HTTP_COOKIE' in environ:
            cookies = http.cookies.SimpleCookie(environ['HTTP_COOKIE'])
        if cookies and 'blocky_session' in cookies:
            cookie = cookies['blocky_session'].value
            if not NO_SESSIONS:
                try:
                    if re.match(r"^[-a-f0-9]+$", cookie): # Validate cookie, must follow UUID4 specs
                        doc = None
                        sdoc = self.DB.ES.get(index=self.DB.dbname, doc_type='uisession', id = cookie)
                        if sdoc:
                            self.sdoc = sdoc['_source']
                        if sdoc and 'cid' in sdoc['_source']:
                            uid = sdoc['_source']['cid']
                            if uid in account_lookup_cache:
                                doc = account_lookup_cache[uid]
                            else:
                                doc = self.DB.ES.get(index=self.DB.dbname, doc_type='useraccount', id = uid)
                                account_lookup_cache[uid] = doc
                        if sdoc and '_source' in sdoc and sdoc['_source'].get('timestamp'):
                            # Make sure this cookie has been used in the past 7 days, else nullify it.
                            # Further more, run an update of the session if >1 hour ago since last update.
                            age = time.time() - sdoc['_source']['timestamp']
                            if age > (7*86400):
                                self.DB.ES.delete(index=self.DB.dbname, doc_type='uisession', id = cookie)
                                sdoc['_source'] = None # Wipe it!
                                doc = None
                            elif age > 3600:
                                sdoc['_source']['timestamp'] = int(time.time()) # Update timestamp in session DB
                                self.DB.ES.update(index=self.DB.dbname, doc_type='uisession', id = cookie, body = {'doc':sdoc['_source']})
                        if doc:
                            self.user = doc['_source']
                        if not sdoc:
                            cookie = None
                    else:
                        cookie = None
                except Exception as err:
                    print(err)
        if not cookie:
            cookie = self.newCookie()
        self.cookie = cookie
