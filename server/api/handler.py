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
This is the main WSGI handler file for Blocky.
It compiles a list of valid URLs from the 'pages' library folder,
and if a URL matches it runs the specific submodule's run() function. It
also handles CGI parsing and exceptions in the applications.
"""


# Main imports
import cgi
import re
import sys
import traceback
import yaml
import json
import plugins.session
import plugins.database
import plugins.openapi
import plugins.worker
import atexit
import os
import time
import threading


# Hack to start first worker as a background thread
ppid = os.getppid()
now = time.time()
pidfile = "./blocky-bg-%s.pid" % ppid
background = False

def rmpidfile():
    try:
        print("Removing BG thread pid file...")
        os.unlink(pidfile)
    except:
        pass

if not os.path.exists(pidfile) or os.path.getmtime(pidfile) < (now - 60):
    print("Starting this thread as background worker")
    open(pidfile, "w").write(str(os.getpid()))
    atexit.register(rmpidfile)
    background = True

# Compile valid API URLs from the pages library
# Allow backwards compatibility by also accepting .lua URLs
urls = []
if __name__ != '__main__':
    import pages
    for page in pages.handlers:
        urls.append((r"^(/api/%s)(/.+)?$" % page, pages.handlers[page].run))


# Load Blocky master configuration
config = yaml.load(open("yaml/blocky.yaml"))

# Instantiate database connections
DB = plugins.database.BlockyDatabase(config)

# Load Open API specifications
BlockyOpenAPI = plugins.openapi.OpenAPI("yaml/openapi.yaml")

# Start as background worker?
if background:
    t = threading.Thread(target = plugins.worker.start, args = (DB, config, pidfile))
    t.start()


class BlockyAPIWrapper:
    """
    Middleware wrapper for exceptions in the application
    """
    def __init__(self, path, func):
        self.func = func
        self.API = BlockyOpenAPI
        self.path = path
        self.exception = plugins.openapi.BlockyHTTPError
     
    def __call__(self, environ, start_response, session):
        """Run the function, return response OR return stacktrace"""
        response = None
        
        # CORS IGNORE
        if environ.get('REQUEST_METHOD', 'GET') == 'OPTIONS':
            start_response('200 Fine, whatever', [
                        ('Content-Type', 'application/json')])
            yield json.dumps({
                "code": 200,
                "reason": "You're probably just being silly..."
            })
            return
        
        try:
            # Read JSON client data if any
            try:
                request_size = int(environ.get('CONTENT_LENGTH', 0))
            except (ValueError):
                request_size = 0
            requestBody = environ['wsgi.input'].read(request_size)
            formdata = {}
            if requestBody and len(requestBody) > 0:
                try:
                    formdata = json.loads(requestBody.decode('utf-8'))
                    
                except json.JSONDecodeError as err:
                    start_response('400 Invalid request', [
                               ('Content-Type', 'application/json')])
                    yield json.dumps({
                        "code": 400,
                        "reason": "Invalid JSON: %s" % err
                    })
                    return
            else:
                # Try query string??
                xdata = cgi.parse_qs(environ.get('QUERY_STRING'))
                for k, v in xdata.items():
                    formdata[k] = v[0]
            
            
            # Validate URL against OpenAPI specs
            try:
                self.API.validate(environ['REQUEST_METHOD'], self.path, formdata)
            except plugins.openapi.OpenAPIException as err:
                start_response('400 Invalid request', [
                            ('Content-Type', 'application/json')])
                yield json.dumps({
                    "code": 400,
                    "reason": err.message
                })
                return
            
            # Call page with env, SR and form data
            try:
                response = self.func(self, environ, formdata, session)
                if response:
                    for bucket in response:
                        yield bucket
            except plugins.openapi.BlockyHTTPError as err:
                errHeaders = {
                    403: '403 Authentication failed',
                    404: '404 Resource not found',
                    500: '500 Internal Server Error',
                    501: '501 Gateway error'
                }
                errHeader = errHeaders[err.code] if err.code in errHeaders else "400 Bad request"
                start_response(errHeader, [
                            ('Content-Type', 'application/json')])
                yield json.dumps({
                    "code": err.code,
                    "reason": err.message
                }, indent = 4) + "\n"
                return
            
        except:
            err_type, err_value, tb = sys.exc_info()
            traceback_output = ['API traceback:']
            traceback_output += traceback.format_tb(tb)
            traceback_output.append('%s: %s' % (err_type.__name__, err_value))
            # We don't know if response has been given yet, try giving one, fail gracefully.
            try:
                start_response('500 Internal Server Error', [
                               ('Content-Type', 'application/json')])
            except:
                pass
            yield json.dumps({
                "API": "Blocky API 1.0",
                "code": "500",
                "reason": '\n'.join(traceback_output)
            })
    
        
def fourohfour(environ, start_response):
    """A very simple 404 handler"""
    start_response("404 Not Found", [
                ('Content-Type', 'application/json')])
    yield json.dumps({
        "API": "Blocky API 2.0",
        "code": 404,
        "reason": "API endpoint not found"
    }, indent = 4) + "\n"
    return

    
def application(environ, start_response):
    """
    This is the main handler. Every API call goes through here.
    Checks against the pages library, and if submod found, runs
    it and returns the output.
    """
    path = environ.get('PATH_INFO', '')
    for regex, function in urls:
        m = re.match(regex, path)
        if m:
            callback = BlockyAPIWrapper(path, function)
            session = plugins.session.BlockySession(DB, environ, config)
            a = 0
            for bucket in callback(environ, start_response, session):
                if a == 0:
                    session.headers.append(bucket)
                    try:
                        start_response("200 Okay", session.headers)
                    except:
                        pass
                a += 1
                # WSGI prefers byte strings, so convert if regular py3 string
                if isinstance(bucket, str):
                    yield bytes(bucket, encoding = 'utf-8')
                elif isinstance(bucket, bytes):
                    yield bucket
            return
            
    for bucket in fourohfour(environ, start_response):
        yield bytes(bucket, encoding = 'utf-8')



if __name__ == '__main__':
    BlockyOpenAPI.toHTML()
