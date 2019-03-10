/*
 Licensed to the Apache Software Foundation (ASF) under one or more
 contributor license agreements.  See the NOTICE file distributed with
 this work for additional information regarding copyright ownership.
 The ASF licenses this file to You under the Apache License, Version 2.0
 (the "License"); you may not use this file except in compliance with
 the License.  You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/
// THIS IS AN AUTOMATICALLY COMBINED FILE. PLEASE EDIT source/*.js!!



/******************************************
 Fetched from source/activity.js
******************************************/


function list_activity(state, json) {
    let obj = document.getElementById('activity');
    obj.innerHTML = ''; // clear object
    if (json.activity && json.activity.length > 0) {
        json.activity = json.activity.sort((a,b) => b.epoch - a.epoch);
        let div = _div();
        div.inject(_hr());
        let wheader = _h3({class:'subtitle'},"Activity log entries (%u):".format(json.activity.length));
        div.inject(wheader);
        let tbl = new HTML('table', { style: {fontSize: '0.8rem'}});
        let tbh = new HTML('thead');
        let tbody = new HTML('tbody');
        
        tbh.inject(new HTML('tr', {}, [
            new HTML('th', 'Type'),
            new HTML('th', {style: {width: '110px'}},'Added'),
            new HTML('th', 'Text'),
        ]));
        tbl.inject(tbh);
        
        div.inject(tbl);
        for (var i = 0; i < json.activity.length; i++) {
            let res = json.activity[i];
            let when = 'Never';
            if (res.epoch) {
                when = moment(res.epoch*1000.0).fromNow();
            }
            let tr = new HTML('tr', {}, [
                new HTML('td', {}, _kbd(res.ntype)),
                new HTML('td', moment(res.epoch*1000.0).fromNow()),
                new HTML('td', res.text)
            ]);
            tbody.inject(tr);
        }
        tbl.inject(tbody);
        obj.inject(div);
    }
}


function init_activity(source) {
    let obj = document.getElementById('activity');
    obj.innerText = "Fetching activity, hang on...";
    GET('./api/activity', list_activity, manage_error, {});
}


/******************************************
 Fetched from source/banlist.js
******************************************/

function manage_error(state, json) {
  if (!json) json = state;
  modal("An error occured", json.message || json.reason, "error");
}

function list_bans(state, json) {
    let obj = document.getElementById('banlist');
    obj.innerHTML = ''; // clear object
    if (json.bans && json.bans.length > 0) {
        json.bans = json.bans.sort((a,b) => b.epoch - a.epoch);
        let div = _div();
        div.inject(_hr());
        let wheader = _h3({class:'subtitle'},"Currently banned IP addresses/networks (%u):".format(json.bans.length));
        div.inject(wheader);
        let tbl = new HTML('table', { style: {fontSize: '0.8rem'}});
        let tbh = new HTML('thead');
        let tbody = new HTML('tbody');
        
        tbh.inject(new HTML('tr', {}, [
            new HTML('th', 'Source'),
            new HTML('th', {style: {width: '120px'}},'Last updated'),
            new HTML('th', 'Reason for ban'),
            new HTML('th', {style: {width: '100px'}},'Actions')
        ]));
        tbl.inject(tbh);
        
        div.inject(tbl);
        for (var i = 0; i < json.bans.length; i++) {
            let res = json.bans[i];
            let timeout = 'unknown?';
            if (res.epoch) {
                timeout = moment(res.epoch*1000.0).fromNow();
            }
            let actions = [
                new HTML('a', {href:'javascript:void();', onclick: "remove_banlist('%s');".format(res.rid)}, "Remove ban")
            ];
            let name = res.ip;
            if (res.dns && res.dns.length > 0 && res.dns != res.ip && res.dns.match) {
                let m = res.dns.match(/(([^.]+\.)?[^.]+)$/);
                lastbit = m ? m[1] : '';
                name = "%s (%s)".format(res.ip, lastbit);
            }
            let tr = new HTML('tr', {}, [
                new HTML('td', {}, _kbd(name)),
                new HTML('td', timeout),
                new HTML('td', res.reason),
                new HTML('td', {}, actions)
            ]);
            tbody.inject(tr);
        }
        tbl.inject(tbody);
        obj.inject(div);
    }
}


function init_banlist(source) {
    let obj = document.getElementById('banlist');
    obj.innerText = "Fetching ban list, hang on...";
    GET('./api/bans', list_bans, manage_error, {});
}



function banlist_added(state, json) {
  alert("Banlist entry added!");
  location.reload();
}


function add_banlist() {
    let source = document.getElementById('source').value;
    let target = document.getElementById('target').value;
    let reason = document.getElementById('reason').value;
    let force = document.getElementById('force').checked;
    let m = source.match(/([a-f0-9:.\/]+)/);
    if (m) {
        source = m[0];
        PUT('./api/bans', banlist_added, {}, manage_error, {
          source: source,
          target: target,
          reason: reason,
          force: force
          });
    } else {
      alert("Invalid source address entered!");
    }
    return false
}


/******************************************
 Fetched from source/base-http-extensions.js
******************************************/

// URL calls currently 'in escrow'. This controls the spinny wheel animation
var async_escrow = {}
var async_maxwait = 250; // ms to wait before displaying spinner
var async_status = 'clear';
var async_cache = {}

// Escrow spinner check
async function escrow_check() {
    let now = new Date();
    let show_spinner = false;
    for (var k in async_escrow) {
        if ( (now - async_escrow[k]) > async_maxwait ) {
            show_spinner = true;
            break;
        }
    }
    // Fetch or create the spinner
    let spinner = document.getElementById('spinner');
    if (!spinner) {
        spinner = new HTML('div', { id: 'spinner', class: 'spinner'});
        spinwheel = new HTML('div', {id: 'spinwheel', class: 'spinwheel'});
        spinner.inject(spinwheel);
        spinner.inject(new HTML('h2', {}, "Loading, please wait.."));
        document.body.appendChild(spinner);
    }
    // Show or don't show spinner?
    if (show_spinner) {
        spinner.style.display = 'block';
        if (async_status === 'clear') {
            console.log("Waiting for JSON resource, deploying spinner");
            async_status = 'waiting';
        }
    } else {
        spinner.style.display = 'none';
        if (async_status === 'waiting') {
            console.log("All URLs out of escrow, dropping spinner");
            async_status = 'clear';
        }
    }
}

async function async_snap(error) {
    msg = await error.text();
    msg = (msg||"An unknown error occured, possibly an internal browser issue").replace(/<.*?>/g, ""); // strip HTML tags
    modal("An error occured", "An error code %u occured while trying to fetch %s:\n%s".format(error.status, error.url, msg), "error");
}


// Asynchronous GET call
async function GET(url, callback, state, snap, method, body) {
    method = method || 'get'
    console.log("Fetching JSON resource at %s".format(url))
    let pkey = "GET-%s-%s".format(callback, url);
    let res = undefined;
    let res_json = undefined;
    state = state || {};
    state.url = url;
    if (state && state.cached === true && async_cache[url]) {
        console.log("Fetching %s from cache".format(url));
        res_json = async_cache[url];
    }
    else {
        try {
            let meta = {method: method, credentials: 'include', referrerPolicy: 'unsafe-url', headers: {'x-original-referral': document.referrer}};
            if (body) {
                meta.body = body;
            }
            console.log("putting %s in escrow...".format(url));
            async_escrow[pkey] = new Date(); // Log start of request in escrow dict
            const rv = await fetch(url, meta); // Wait for resource...

            // Since this is an async request, the request may have been canceled
            // by the time we get a response. Only do callback if not.
            if (async_escrow[pkey] !== undefined) {
                delete async_escrow[pkey]; // move out of escrow when fetched
                res = rv;
            }
        }
        catch (e) {
            delete async_escrow[pkey]; // move out of escrow if failed
            console.log("The URL %s could not be fetched: %s".format(url, e));
            if (snap) snap({}, {reason: e});
            else {
                modal("An error occured", "An error occured while trying to fetch %s:\n%s".format(url, e), "error");
            }
        }
    }
    if (res !== undefined || res_json !== undefined) {
        // We expect a 2xx return code (usually 200 or 201), snap otherwise
        if ((res_json) || (res.status >= 200 && res.status < 300)) {
            console.log("Successfully fetched %s".format(url))
            if (res_json) {
                js = res_json;
            } else {
                js = await res.json();
                async_cache[url] = js;
            }
            if (callback) {
                callback(state, js);
            } else {
                console.log("No callback function was registered for %s, ignoring result.".format(url));
            }
        } else {
            console.log("URL %s returned HTTP code %u, snapping!".format(url, res.status));
            try {
                js = await res.json();
                snap(state, js);
                return;
            } catch (e) {}
            if (snap) snap(res);
            else async_snap(res);
        }
    }
}


// DELETE wrapper
async function DELETE(url, callback, state, snap, json) {
    return GET(url, callback, state, snap, 'delete', JSON.stringify(json));
}

// POST wrapper
async function POST(url, callback, state, snap, json) {
    return GET(url, callback, state, snap, 'post', JSON.stringify(json));
}

// PUT wrapper
async function PUT(url, callback, state, snap, json) {
    return GET(url, callback, state, snap, 'put', JSON.stringify(json));
}

// PATCH wrapper
async function PATCH(url, callback, state, snap, json) {
    return GET(url, callback, state, snap, 'PATCH', JSON.stringify(json));
}

// whatwg fetch for IE
(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ]

    var isDataView = function(obj) {
      return obj && DataView.prototype.isPrototypeOf(obj)
    }

    var isArrayBufferView = ArrayBuffer.isView || function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    }
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        this.append(header[0], header[1])
      }, this)
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var oldValue = this.map[name]
    this.map[name] = oldValue ? oldValue+','+value : value
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    name = normalizeName(name)
    return this.has(name) ? this.map[name] : null
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value)
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this)
      }
    }
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsArrayBuffer(blob)
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsText(blob)
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf)
    var chars = new Array(view.length)

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i])
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength)
      view.set(new Uint8Array(buf))
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (!body) {
        this._bodyText = ''
      } else if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer)
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer])
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body)
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      }
    }

    this.text = function() {
      var rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body && input._bodyInit != null) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = String(input)
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this, { body: this._bodyInit })
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers()
    // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
    // https://tools.ietf.org/html/rfc7230#section-3.2
    var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ')
    preProcessedHeaders.split(/\r?\n/).forEach(function(line) {
      var parts = line.split(':')
      var key = parts.shift().trim()
      if (key) {
        var value = parts.join(':').trim()
        headers.append(key, value)
      }
    })
    return headers
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = options.status === undefined ? 200 : options.status
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = 'statusText' in options ? options.statusText : 'OK'
    this.headers = new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init)
      var xhr = new XMLHttpRequest()

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        }
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      } else if (request.credentials === 'omit') {
        xhr.withCredentials = false
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);


/******************************************
 Fetched from source/base-js-extensions.js
******************************************/

/**
 * String formatting prototype
 * A'la printf
 */

String.prototype.format = function() {
  let args = arguments;
  let n = 0;
  let t = this;
  let rtn = this.replace(/(?!%)?%([-+]*)([0-9.]*)([a-zA-Z])/g, function(m, pm, len, fmt) {
      len = parseInt(len || '1');
      // We need the correct number of args, balk otherwise, using ourselves to format the error!
      if (args.length <= n) {
        let err = "Error interpolating string '%s': Expected at least %u argments, only got %u!".format(t, n+1, args.length);
        console.log(err);
        throw err;
      }
      let varg = args[n];
      n++;
      switch (fmt) {
        case 's':
          if (typeof(varg) == 'function') {
            varg = '(function)';
          }
          return varg;
        // For now, let u, d and i do the same thing
        case 'd':
        case 'i':
        case 'u':
          varg = parseInt(varg).pad(len); // truncate to Integer, pad if needed
          return varg;
      }
    });
  return rtn;
}


/**
 * Number prettification prototype:
 * Converts 1234567 into 1,234,567 etc
 */

Number.prototype.pretty = function(fix) {
  if (fix) {
    return String(this.toFixed(fix)).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
  }
  return String(this.toFixed(0)).replace(/(\d)(?=(\d{3})+$)/g, '$1,');
};


/**
 * Number padding
 * usage: 123.pad(6) -> 000123
 */

Number.prototype.pad = function(n) {
  var str;
  str = String(this);

  /* Do we need to pad? if so, do it using String.repeat */
  if (str.length < n) {
    str = "0".repeat(n - str.length) + str;
  }
  return str;
};


/* Func for converting a date to YYYY-MM-DD HH:MM */

Date.prototype.ISOBare = function() {
  var M, d, h, m, y;
  y = this.getFullYear();
  m = (this.getMonth() + 1).pad(2);
  d = this.getDate().pad(2);
  h = this.getHours().pad(2);
  M = this.getMinutes().pad(2);
  return y + "-" + m + "-" + d + " " + h + ":" + M;
};


/* isArray: function to detect if an object is an array */

isArray = function(value) {
  return value && typeof value === 'object' && value instanceof Array && typeof value.length === 'number' && typeof value.splice === 'function' && !(value.propertyIsEnumerable('length'));
};


/* isHash: function to detect if an object is a hash */

isHash = function(value) {
  return value && typeof value === 'object' && !isArray(value);
};


/* Remove an array element by value */

Array.prototype.remove = function(val) {
  var i, item, j, len;
  for (i = j = 0, len = this.length; j < len; i = ++j) {
    item = this[i];
    if (item === val) {
      this.splice(i, 1);
      return this;
    }
  }
  return this;
};


/* Check if array has value */
Array.prototype.has = function(val) {
  var i, item, j, len;
  for (i = j = 0, len = this.length; j < len; i = ++j) {
    item = this[i];
    if (item === val) {
      return true;
    }
  }
  return false;
};




/******************************************
 Fetched from source/datepicker.js
******************************************/

var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var datepicker_spawner = null
var calendarpicker_spawner = null
var units = {
    w: 'week',
    d: 'day',
    M: 'month',
    y: 'year'
}

function fixupPicker(obj) {
    obj.addEventListener("focus", function(event){
        $('html').on('hide.bs.dropdown', function (e) {
            return false;
        });
    });
    obj.addEventListener("blur", function(event){
        $('html').unbind('hide.bs.dropdown')
    });
}
// makeSelect: Creates a <select> object with options
function makeSelect(options, id, selval) {
    var sel = document.createElement('select')
    sel.addEventListener("focus", function(event){
        $('html').on('hide.bs.dropdown', function (e) {
            return false;
        });
    });
    sel.addEventListener("blur", function(event){
        $('html').unbind('hide.bs.dropdown')
    });
    sel.setAttribute("name", id)
    sel.setAttribute("id", id)
    // For each options element, create it in the DOM
    for (var key in options) {
        var opt = document.createElement('option')
        // Hash or array?
        if (typeof key == "string") {
            opt.setAttribute("value", key)
            // Option is selected by default?
            if (key == selval) {
                opt.setAttribute("selected", "selected")
            }
        } else {
            // Option is selected by default?
            if (options[key] == selval) {
                opt.setAttribute("selected", "selected")
            }
        }
        opt.text = options[key]
        sel.appendChild(opt)
    }
    return sel
}

// splitDiv: Makes a split div with 2 elements,
// and puts div2 into the right column,
// and 'name' as text in the left one.
function splitDiv(id, name, div2) {
    var div = document.createElement('div')
    var subdiv = document.createElement('div')
    var radio = document.createElement('input')
    radio.setAttribute("type", "radio")
    radio.setAttribute("name", "datepicker_radio")
    radio.setAttribute("value", name)
    radio.setAttribute("id", "datepicker_radio_" + id)
    radio.setAttribute("onclick", "calcTimespan('"+ id + "')")
    var label = document.createElement('label')
    label.innerHTML = "&nbsp; " + name + ": "
    label.setAttribute("for", "datepicker_radio_" + id)
    
    
    subdiv.appendChild(radio)
    subdiv.appendChild(label)
    
    
    subdiv.style.float = "left"
    div2.style.float = "left"
    
    subdiv.style.width = "120px"
    subdiv.style.height = "48px"
    div2.style.height = "48px"
    div2.style.width = "250px"
    
    div.appendChild(subdiv)
    div.appendChild(div2)
    return div
}

// calcTimespan: Calculates the value and representational text
// for the datepicker choice and puts it in the datepicker's
// spawning input/select element.
function calcTimespan(what) {
    var wat = ""
    var tval = ""
    
    // Less than N units ago?
    if (what == 'lt') {
        // Get unit and how many units
        var N = document.getElementById('datepicker_lti').value
        var unit = document.getElementById('datepicker_lts').value
        var unitt = units[unit]
        if (parseInt(N) != 1) {
            unitt += "s"
        }
        
        // If this makes sense, construct a humanly readable and a computer version
        // of the timespan
        if (N.length > 0) {
            wat = "Less than " + N + " " + unitt + " ago"
            tval = "lte=" + N + unit
        }
    }
    
    // More than N units ago?
    if (what == 'mt') {
        // As above, get unit and no of units.
        var N = document.getElementById('datepicker_mti').value
        var unit = document.getElementById('datepicker_mts').value
        var unitt = units[unit]
        if (parseInt(N) != 1) {
            unitt += "s"
        }
        
        // construct timespan val + description
        if (N.length > 0) {
            wat = "More than " + N + " " + unitt + " ago"
            tval = "gte=" + N + unit
        }
    }
    
    // Date range?
    if (what == 'cd') {
        // Get From and To values
        var f = document.getElementById('datepicker_cfrom').value
        var t = document.getElementById('datepicker_cto').value
        // construct timespan val + description if both from and to are valid
        if (f.length > 0 && t.length > 0) {
            wat = "From " + f + " to " + t
            tval = "dfr=" + f + "|dto=" + t
        }
    }
    
    // If we calc'ed a value and spawner exists, update its key/val
    if (datepicker_spawner && what && wat.length > 0) {
        document.getElementById('datepicker_radio_' + what).checked = true
        if (datepicker_spawner.options) {
            datepicker_spawner.options[0].value = tval
            datepicker_spawner.options[0].text = wat
        } else if (datepicker_spawner.value) {
            datepicker_spawner.value = wat
            datepicker_spawner.setAttribute("data", tval)
        }
        
    }
}

// datePicker: spawns a date picker with various
// timespan options right next to the parent caller.
function datePicker(parent, seedPeriod) {
    datepicker_spawner = parent
    var div = document.getElementById('datepicker_popup')
    
    // If the datepicker object doesn't exist, spawn it
    if (!div) {
        div = document.createElement('div')
        var id = parseInt(Math.random() * 10000).toString(16)
        div.setAttribute("id", "datepicker_popup")
        div.setAttribute("class", "datepicker")
    }
    
    // Reset the contents of the datepicker object
    div.innerHTML = ""
    div.style.display = "block"
    
    // Position the datepicker next to whatever called it
    var bb = parent.getBoundingClientRect()
    div.style.top = (bb.bottom + 8) + "px"
    div.style.left = (bb.left + 32) + "px"
    
    
    // -- Less than N $units ago
    var ltdiv = document.createElement('div')
    var lti = document.createElement('input')
    lti.setAttribute("id", "datepicker_lti")
    lti.style.width = "48px"
    lti.setAttribute("onkeyup", "calcTimespan('lt')")
    lti.setAttribute("onblur", "calcTimespan('lt')")
    ltdiv.appendChild(lti)
    
    var lts = makeSelect({
        'd': "Day(s)",
        'w': 'Week(s)',
        'M': "Month(s)",
        'y': "Year(s)"
    }, 'datepicker_lts', 'm')
    lts.setAttribute("onchange", "calcTimespan('lt')")
    ltdiv.appendChild(lts)
    ltdiv.appendChild(document.createTextNode(' ago'))
    
    div.appendChild(splitDiv('lt', 'Less than', ltdiv))
    
    
    // -- More than N $units ago
    var mtdiv = document.createElement('div')
    
    var mti = document.createElement('input')
    mti.style.width = "48px"
    mti.setAttribute("id", "datepicker_mti")
    mti.setAttribute("onkeyup", "calcTimespan('mt')")
    mti.setAttribute("onblur", "calcTimespan('mt')")
    mtdiv.appendChild(mti)
    
    
    var mts = makeSelect({
        'd': "Day(s)",
        'w': 'Week(s)',
        'M': "Month(s)",
        'y': "Year(s)"
    }, 'datepicker_mts', 'm')
    mtdiv.appendChild(mts)
    mts.setAttribute("onchange", "calcTimespan('mt')")
    mtdiv.appendChild(document.createTextNode(' ago'))
    div.appendChild(splitDiv('mt', 'More than', mtdiv))
    
    
    
    // -- Calendar timespan
    // This is just two text fields, the calendarPicker sub-plugin populates them
    var cdiv = document.createElement('div')
    
    var cfrom = document.createElement('input')
    cfrom.style.width = "90px"
    cfrom.setAttribute("id", "datepicker_cfrom")
    cfrom.setAttribute("onfocus", "showCalendarPicker(this)")
    cfrom.setAttribute("onchange", "calcTimespan('cd')")
    cdiv.appendChild(document.createTextNode('From: '))
    cdiv.appendChild(cfrom)
    
    var cto = document.createElement('input')
    cto.style.width = "90px"
    cto.setAttribute("id", "datepicker_cto")
    cto.setAttribute("onfocus", "showCalendarPicker(this)")
    cto.setAttribute("onchange", "calcTimespan('cd')")
    cdiv.appendChild(document.createTextNode('To: '))
    cdiv.appendChild(cto)
    
    div.appendChild(splitDiv('cd', 'Date range', cdiv))
    
    
    
    // -- Magic button that sends the timespan back to the caller
    var okay = document.createElement('input')
    okay.setAttribute("type", "button")
    okay.setAttribute("value", "Okay")
    okay.setAttribute("onclick", "setDatepickerDate()")
    div.appendChild(okay)
    parent.parentNode.appendChild(div)
    document.body.setAttribute("onclick", "")
    window.setTimeout(function() { document.body.setAttribute("onclick", "blurDatePicker(event)") }, 200)
    lti.focus()
    
    // This is for recalcing the set options if spawned from a
    // select/input box with an existing value derived from an
    // earlier call to datePicker
    var ptype = ""
    var pvalue = parent.hasAttribute("data") ? parent.getAttribute("data") : parent.value
    if (pvalue.search(/=|-/) != -1) {
        
        // Less than N units ago?
        if (pvalue.match(/lte/)) {
            var m = pvalue.match(/lte=(\d+)([dMyw])/)
            ptype = 'lt'
            if (m) {
                document.getElementById('datepicker_lti').value = m[1]
                var sel = document.getElementById('datepicker_lts')
                for (var i in sel.options) {
                    if (parseInt(i) >= 0) {
                        if (sel.options[i].value == m[2]) {
                            sel.options[i].selected = "selected"
                        } else {
                            sel.options[i].selected = null
                        }
                    }
                }
            }
            
        }
        
        // More than N units ago?
        if (pvalue.match(/gte/)) {
            ptype = 'mt'
            var m = pvalue.match(/gte=(\d+)([dMyw])/)
            if (m) {
                document.getElementById('datepicker_mti').value = m[1]
                var sel = document.getElementById('datepicker_mts')
                // Go through the unit values, select the one we use
                for (var i in sel.options) {
                    if (parseInt(i) >= 0) {
                        if (sel.options[i].value == m[2]) {
                            sel.options[i].selected = "selected"
                        } else {
                            sel.options[i].selected = null
                        }
                    }
                }
            }
        }
        
        // Date range?
        if (pvalue.match(/dfr/)) {
            ptype = 'cd'
            // Make sure we have both a dfr and a dto here, catch them
            var mf = pvalue.match(/dfr=(\d+-\d+-\d+)/)
            var mt = pvalue.match(/dto=(\d+-\d+-\d+)/)
            if (mf && mt) {
                // easy peasy, just set two text fields!
                document.getElementById('datepicker_cfrom').value = mf[1]
                document.getElementById('datepicker_cto').value = mt[1]
            }
        }
        // Month??
        if (pvalue.match(/(\d{4})-(\d+)/)) {
            ptype = 'cd'
            // Make sure we have both a dfr and a dto here, catch them
            var m = pvalue.match(/(\d{4})-(\d+)/)
            if (m.length == 3) {
                // easy peasy, just set two text fields!
                var dfrom = new Date(parseInt(m[1]),parseInt(m[2])-1,1, 0, 0, 0)
                var dto = new Date(parseInt(m[1]),parseInt(m[2]),0, 23, 59, 59)
                document.getElementById('datepicker_cfrom').value = m[0] + "-" + dfrom.getDate()
                document.getElementById('datepicker_cto').value = m[0] + "-" + dto.getDate()
            }
        }
        calcTimespan(ptype)
    }
}


function datePickerValue(seedPeriod) {
    // This is for recalcing the set options if spawned from a
    // select/input box with an existing value derived from an
    // earlier call to datePicker
    var ptype = ""
    var rv = seedPeriod
    if (seedPeriod && seedPeriod.search && seedPeriod.search(/=|-/) != -1) {
        
        // Less than N units ago?
        if (seedPeriod.match(/lte/)) {
            var m = seedPeriod.match(/lte=(\d+)([dMyw])/)
            ptype = 'lt'
            var unitt = units[m[2]]
            if (parseInt(m[1]) != 1) {
                unitt += "s"
            }
            rv = "Less than " + m[1] + " " + unitt + " ago"
        }
        
        // More than N units ago?
        if (seedPeriod.match(/gte/)) {
            ptype = 'mt'
            var m = seedPeriod.match(/gte=(\d+)([dMyw])/)
            var unitt = units[m[2]]
            if (parseInt(m[1]) != 1) {
                unitt += "s"
            }
            rv = "More than " + m[1] + " " + unitt + " ago"
        }
        
        // Date range?
        if (seedPeriod.match(/dfr/)) {
            ptype = 'cd'
            var mf = seedPeriod.match(/dfr=(\d+-\d+-\d+)/)
            var mt = seedPeriod.match(/dto=(\d+-\d+-\d+)/)
            if (mf && mt) {
                rv = "From " + mf[1] + " to " + mt[1]
            }
        }
        
        // Month??
        if (seedPeriod.match(/^(\d+)-(\d+)$/)) {
            ptype = 'mr' // just a made up thing...(month range)
            var mr = seedPeriod.match(/(\d+)-(\d+)/)
            if (mr) {
                dfrom = new Date(parseInt(mr[1]),parseInt(mr[2])-1,1, 0, 0, 0)
                rv = months[dfrom.getMonth()] + ', ' + mr[1]
            }
        }
        
    }
    return rv
}

function datePickerDouble(seedPeriod) {
    // This basically takes a date-arg and doubles it backwards
    // so >=3M becomes =>6M etc. Also returns the cutoff for
    // the original date and the span in days of the original
    var ptype = ""
    var rv = seedPeriod
    var dbl = seedPeriod
    var tspan = 1
    var dfrom = new Date()
    var dto = new Date()
    
    // datepicker range?
    if (seedPeriod && seedPeriod.search && seedPeriod.search(/=/) != -1) {
        
        // Less than N units ago?
        if (seedPeriod.match(/lte/)) {
            var m = seedPeriod.match(/lte=(\d+)([dMyw])/)
            ptype = 'lt'
            rv = "<" + m[1] + m[2] + " ago"
            dbl = "lte=" + (parseInt(m[1])*2) + m[2]
            
            // N months ago
            if (m[2] == "M") {
                dfrom.setMonth(dfrom.getMonth()-parseInt(m[1]), dfrom.getDate())
            }
            
            // N days ago
            if (m[2] == "d") {
                dfrom.setDate(dfrom.getDate()-parseInt(m[1]))
            }
            
            // N years ago
            if (m[2] == "y") {
                dfrom.setYear(dfrom.getFullYear()-parseInt(m[1]))
            }
            
            // N weeks ago
            if (m[2] == "w") {
                dfrom.setDate(dfrom.getDate()-(parseInt(m[1])*7))
            }
            
            // Calc total duration in days for this time span
            tspan = parseInt((dto.getTime() - dfrom.getTime() + 5000) / (1000*86400))
        }
        
        // More than N units ago?
        if (seedPeriod.match(/gte/)) {
            ptype = 'mt'
            var m = seedPeriod.match(/gte=(\d+)([dMyw])/)
            rv = ">" + m[1] + m[2] + " ago"
            dbl = "gte=" + (parseInt(m[1])*2) + m[2]
            tspan = parseInt(parseInt(m[1]) * 30.4)
            dfrom = null
            
            // Months
            if (m[2] == "M") {
                dto.setMonth(dto.getMonth()-parseInt(m[1]), dto.getDate())
            }
            
            // Days
            if (m[2] == "d") {
                dto.setDate(dto.getDate()-parseInt(m[1]))
            }
            
            // Years
            if (m[2] == "y") {
                dto.setYear(dto.getFullYear()-parseInt(m[1]))
            }
            
            // Weeks
            if (m[2] == "w") {
                dto.setDate(dto.getDate()-(parseInt(m[1])*7))
            }
            
            // Can't really figure out a timespan for this, so...null!
            // This also sort of invalidates use on the trend page, but meh..
            tspan = null
        }
        
        // Date range?
        if (seedPeriod.match(/dfr/)) {
            ptype = 'cd'
            // Find from and to
            var mf = seedPeriod.match(/dfr=(\d+)-(\d+)-(\d+)/)
            var mt = seedPeriod.match(/dto=(\d+)-(\d+)-(\d+)/)
            if (mf && mt) {
                rv = "from " + mf[1] + " to " + mt[1]
                // Starts at 00:00:00 on from date
                dfrom = new Date(parseInt(mf[1]),parseInt(mf[2])-1,parseInt(mf[3]), 0, 0, 0)
                
                // Ends at 23:59:59 on to date
                dto = new Date(parseInt(mt[1]),parseInt(mt[2])-1,parseInt(mt[3]), 23, 59, 59)
                
                // Get duration in days, add 5 seconds to we can floor the value and get an integer
                tspan = parseInt((dto.getTime() - dfrom.getTime() + 5000) / (1000*86400))
                
                // double the distance
                var dpast = new Date(dfrom)
                dpast.setDate(dpast.getDate() - tspan)
                dbl = seedPeriod.replace(/dfr=[^|]+/, "dfr=" + (dpast.getFullYear()) + '-' + (dpast.getMonth()+1) + '-' + dpast.getDate())
            } else {
                tspan = 0
            }
        }
    }
    
    // just N days?
    else if (parseInt(seedPeriod).toString() == seedPeriod.toString()) {
        tspan = parseInt(seedPeriod)
        dfrom.setDate(dfrom.getDate() - tspan)
        dbl = "lte=" + (tspan*2) + "d"
    }
    
    // Specific month?
    else if (seedPeriod.match(/^(\d+)-(\d+)$/)) {
        // just a made up thing...(month range)
        ptype = 'mr' 
        var mr = seedPeriod.match(/(\d+)-(\d+)/)
        if (mr) {
            rv = seedPeriod
            // Same as before, start at 00:00:00
            dfrom = new Date(parseInt(mr[1]),parseInt(mr[2])-1,1, 0, 0, 0)
            // end at 23:59:59
            dto = new Date(parseInt(mr[1]),parseInt(mr[2]),0, 23, 59, 59)
            
            // B-A, add 5 seconds so we can floor the no. of days into an integer neatly
            tspan = parseInt((dto.getTime() - dfrom.getTime() + 5000) / (1000*86400))
            
            // Double timespan
            var dpast = new Date(dfrom)
            dpast.setDate(dpast.getDate() - tspan)
            dbl = "dfr=" + (dpast.getFullYear()) + '-' + (dpast.getMonth()+1) + '-' + dpast.getDate() + "|dto=" + (dto.getFullYear()) + '-' + (dto.getMonth()+1) + '-' + dto.getDate()
        } else {
            tspan = 0
        }
    }
    
    return [dbl, dfrom, dto, tspan]
}

// set date in caller and hide datepicker again.
function setDatepickerDate() {
    calcTimespan()
    blurDatePicker()
}

// findParent: traverse DOM and see if we can find a parent to 'el'
// called 'name'. This is used for figuring out whether 'el' has
// lost focus or not.
function findParent(el, name) {
    if (el.getAttribute && el.getAttribute("id") == name) {
        return true
    }
    if (el.parentNode && el.parentNode.getAttribute) {
        if (el.parentNode.getAttribute("id") != name) {
            return findParent(el.parentNode, name)
        } else {
            return true
        }
    } else {
        return false;
    }
}

// function for hiding the date picker
function blurDatePicker(evt) {
    var es = evt ? (evt.target || evt.srcElement) : null;
    if ((!es || !es.parentNode || (!findParent(es, "datepicker_popup") && !findParent(es, "calendarpicker_popup"))) && !(es ? es : "null").toString().match(/javascript:void/)) {
        document.getElementById('datepicker_popup').style.display = "none"
        $('html').trigger('hide.bs.dropdown')
    }
}

// draws the actual calendar inside a calendarPicker object
function drawCalendarPicker(obj, date) {
    
    
    obj.focus()
    
    // Default to NOW for calendar.
    var now = new Date()
    
    // if called with an existing date (YYYY-MM-DD),
    // convert it to a JS date object and use that for
    // rendering the calendar
    if (date) {
        var ar = date.split(/-/)
        now = new Date(ar[0],parseInt(ar[1])-1,ar[2])
    }
    var days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    var mat = now
    
    // Go to first day of the month
    mat.setDate(1)
    
    obj.innerHTML = "<h3>" + months[mat.getMonth()] + ", " + mat.getFullYear() + ":</h3>"
    var tm = mat.getMonth()
    
    // -- Nav buttons --
    
    // back-a-year button
    var a = document.createElement('a')
    fixupPicker(a)
    a.setAttribute("onclick", "drawCalendarPicker(this.parentNode, '" + (mat.getFullYear()-1) + '-' + (mat.getMonth()+1) + '-' + mat.getDate() + "');")
    a.setAttribute("href", "javascript:void(0);")
    a.innerHTML = "≪"
    obj.appendChild(a)
    
    // back-a-month button
    a = document.createElement('a')
    fixupPicker(a)
    a.setAttribute("onclick", "drawCalendarPicker(this.parentNode, '" + mat.getFullYear() + '-' + (mat.getMonth()) + '-' + mat.getDate() + "');")
    a.setAttribute("href", "javascript:void(0);")
    a.innerHTML = "&lt;"
    obj.appendChild(a)
    
    // forward-a-month button
    a = document.createElement('a')
    fixupPicker(a)
    a.setAttribute("onclick", "drawCalendarPicker(this.parentNode, '" + mat.getFullYear() + '-' + (mat.getMonth()+2) + '-' + mat.getDate() + "');")
    a.setAttribute("href", "javascript:void(0);")
    a.innerHTML = "&gt;"
    obj.appendChild(a)
    
    // forward-a-year button
    a = document.createElement('a')
    fixupPicker(a)
    a.setAttribute("onclick", "drawCalendarPicker(this.parentNode, '" + (mat.getFullYear()+1) + '-' + (mat.getMonth()+1) + '-' + mat.getDate() + "');")
    a.setAttribute("href", "javascript:void(0);")
    a.innerHTML = "≫"
    obj.appendChild(a)
    obj.appendChild(document.createElement('br'))
    
    
    // Table containing the dates of the selected month
    var table = document.createElement('table')
    
    table.setAttribute("border", "1")
    table.style.margin = "0 auto"
    
    // Add header day names
    var tr = document.createElement('tr');
    for (var m = 0; m < 7; m++) {
        var td = document.createElement('th')
        td.innerHTML = days[m]
        tr.appendChild(td)
    }
    table.appendChild(tr)
    
    // Until we hit the first day in a month, add blank days
    tr = document.createElement('tr');
    var weekday = mat.getDay()
    if (weekday == 0) {
        weekday = 7
    }
    weekday--;
    for (var i = 0; i < weekday; i++) {
        var td = document.createElement('td')
        tr.appendChild(td)
    }
    
    // While still in this month, add day then increment date by 1 day.
    while (mat.getMonth() == tm) {
        weekday = mat.getDay()
        if (weekday == 0) {
            weekday = 7
        }
        weekday--;
        if (weekday == 0) {
            table.appendChild(tr)
            tr = document.createElement('tr');
        }
        td = document.createElement('td')
        // onclick for setting the calendarPicker's parent to this val.
        td.setAttribute("onclick", "setCalendarDate('" + mat.getFullYear() + '-' + (mat.getMonth()+1) + '-' + mat.getDate() + "');")
        td.innerHTML = mat.getDate()
        mat.setDate(mat.getDate()+1)
        tr.appendChild(td)
    }
    
    table.appendChild(tr)
    obj.appendChild(table)
}

// callback for datePicker; sets the cd value to what date was picked
function setCalendarDate(what) {
    $('html').on('hide.bs.dropdown', function (e) {
        return false;
    });
    setTimeout(function() { $('html').unbind('hide.bs.dropdown');}, 250);
    
    
    calendarpicker_spawner.value = what
    var div = document.getElementById('calendarpicker_popup')
    div.parentNode.focus()
    div.style.display = "none"
    calcTimespan('cd')
}

// caller for when someone clicks on a calendarPicker enabled field
function showCalendarPicker(parent, seedDate) {
    calendarpicker_spawner = parent
    
    // If supplied with a YYYY-MM-DD date, use this to seed the calendar
    if (!seedDate) {
        var m = parent.value.match(/(\d+-\d+(-\d+)?)/)
        if (m) {
            seedDate = m[1]
        }
    }
    
    // Show or create the calendar object
    var div = document.getElementById('calendarpicker_popup')
    if (!div) {
        div = document.createElement('div')
        div.setAttribute("id", "calendarpicker_popup")
        div.setAttribute("class", "calendarpicker")
        document.getElementById('datepicker_popup').appendChild(div)
        div.innerHTML = "Calendar goes here..."
    }
    div.style.display = "block"
    var bb = parent.getBoundingClientRect()
    
    // Align with the calling object, slightly below
    div.style.top = (bb.bottom + 8) + "px"
    div.style.left = (bb.right - 32) + "px"
    
    drawCalendarPicker(div, seedDate)    
}

/******************************************
 Fetched from source/datetime-picker.js
******************************************/

var datetimes = {};

function validate_datetime(what, slug) {
  let val = document.getElementById('%s_%s'.format(slug, what)).value;
  let span = document.getElementById('%s_%s_span'.format(slug, what));
  if (what == 'tz') {
    datetimes[slug].tz = val;
    validate_datetime('start', slug);
    validate_datetime('stop', slug);
  }
  let spaninfo = '';
  if (what == 'start' || what == 'stop') {
    let dt = moment.tz(val, datetimes[slug].tz||"Etc/UTC").format();
    if (val == '' || dt == 'Invalid date') {
      if (datetimes[slug]['%s_require_valid'.format(what)] === true) {
        spaninfo = "Invalid date!";
        span.style.color = 'red';
      } else {
        dt = null;
      }
    } else {
      spaninfo = dt;
      span.style.color = 'green';
    }
    span.innerText = spaninfo;
    datetimes[slug][what] = dt;
  }
}

function datetime(slug, options) {
  // defaults
  let tz = options.tz || "Etc/UTC";
  let start = options.start;
  let stop = options.stop;
  let title = options.title;
  let start_require_valid = (options.requireStart === false) ? false: true; //default to true
  let stop_require_valid = (options.requireStop === false) ? false: true; //default to true

  datetimes[slug] = {
    tz: tz,
    start: start,
    stop: stop,
    title: title,
    start_require_valid: start_require_valid,
    stop_require_valid: stop_require_valid
  };

  let div = new HTML('div', { style: {textAlign: 'center'}});

  // TZ
  let tzdiv = new HTML('div', {style: {width: '180px', margin: '1%', position: 'relative', display: 'inline-block'}});
  tzdiv.inject(new HTML('big', {}, "Timezone:"));
  tzdiv.inject(br());

  let zones = moment.tz.names();
  let tzfield = new HTML('select', { id: '%s_tz'.format(slug), type: 'text', style: {width: '160px'}, onchange: 'validate_datetime("tz", "%s");'.format(slug)});
  tzdiv.inject(tzfield);
  for (var i = 0; i < zones.length; i++) {
    let zn = String(zones[i]);
    let opt = new HTML('option', { selected: zn == (tz || 'Etc/UTC') ? 'selected' : null}, zn);
    tzfield.inject(opt);
  }
  tzdiv.inject(new HTML('span', {style: {display: 'inline-block', textIndent: '24px', width: '100%', height: '20px'},id: '%s_tz_span'.format(slug)}));
  div.inject(tzdiv);

  // START TIME
  let stdiv = new HTML('div', {style: {width: '180px', margin: '1%', position: 'relative', display: 'inline-block'}});
  stdiv.inject(new HTML('big',{},"From:"));
  stdiv.inject(br());
  let stfield = new HTML('input', { id: '%s_start'.format(slug), type: 'text', style: {width: '160px'}, value: start, onchange: 'validate_datetime("start", "%s");'.format(slug)});
  stdiv.inject(stfield);
  stdiv.inject(new HTML('span', {style: {display: 'inline-block', fontSize: '0.8rem', width: '100%', height: '20px'},id: '%s_start_span'.format(slug)}));
  //starttimediv.inject(new HTML('p', {style: {padding: '12px'}}, "The date and time when the Call for Papers is open to submissions, relative to the local timezone above."));
  div.inject(stdiv);
  flatpickr(stfield, {enableTime: true});

  // STOP TIME
  let stopdiv = new HTML('div', {style: {width: '180px', margin: '1%', position: 'relative', display: 'inline-block'}});
  stopdiv.inject(new HTML('big',{}, "To:"));
  stopdiv.inject(br());
  let stopfield = new HTML('input', { id: '%s_stop'.format(slug), type: 'text', style: {width: '160px'}, value: stop, onchange: 'validate_datetime("stop", "%s");'.format(slug)});
  stopdiv.inject(stopfield);
  stopdiv.inject(new HTML('span', {style: {display: 'inline-block', fontSize: '0.8rem', width: '100%', height: '20px'},id: '%s_stop_span'.format(slug)}));
  //starttimediv.inject(new HTML('p', {style: {padding: '12px'}}, "The date and time when the Call for Papers is open to submissions, relative to the local timezone above."));
  div.inject(stopdiv);
  flatpickr(stopfield, {enableTime: true});

  return div;
}


/******************************************
 Fetched from source/ruleset.js
******************************************/


var rule_json = {}

function create_rule_form(form, rid) {
  if (!rid || rid == '') {
    rid = 'new';
    rule_json['new'] = {
      name: '',
      type: '',
      span: 24,
      limit: '',
      query: [],
    }
  }
  let n = _input({type: 'text', style: {width: '300px'}, id: "%s_name".format(rid), value: rule_json[rid].name});
  form.inject("Name of rule: ");
  form.inject(n);
  form.inject(br());
  
  // type
  let s = _select({id: "%s_type".format(rid)});
  s.inject(_option({value: 'httpd_traffic', selected: rule_json[rid].type == 'httpd_traffic' ? 'selected' : null}, 'HTTPd traffic (bytes)'));
  s.inject(_option({value: 'httpd_visits', selected: rule_json[rid].type == 'httpd_visits' ? 'selected' : null}, 'HTTPd visits (requests)'));
  form.inject("Type of rule: ");
  form.inject(s);
  form.inject(br());
  
  // span
  let sp = _select({id: "%s_span".format(rid)});
  sp.inject(_option({value: 1, selected: rule_json[rid].span == 1 ? 'selected' : null}, '1 hour'));
  sp.inject(_option({value: 6, selected: rule_json[rid].span == 6 ? 'selected' : null}, '6 hours'));
  sp.inject(_option({value: 12, selected: rule_json[rid].span == 12 ? 'selected' : null}, '12 hours'));
  sp.inject(_option({value: 24, selected: rule_json[rid].span == 24 ? 'selected' : null}, '24 hours'));
  sp.inject(_option({value: (24*7), selected: rule_json[rid].span == (24*7) ? 'selected' : null}, 'one week'));
  sp.inject(_option({value: (24*30), selected: rule_json[rid].span == (24*30) ? 'selected' : null}, 'one month'));
  
  form.inject("Time span: ");
  form.inject(sp);
  form.inject(br());
  
  let l = _input({type: 'number', style: {width: '120px'}, id: "%s_limit".format(rid), value: rule_json[rid].limit || 0});
  form.inject("Traffic/Request limit: ");
  form.inject(l);
  form.inject(br());
  
  let q = _textarea({style: {width: '300px', height: '120px'},id: "%s_query".format(rid)}, rule_json[rid].query.join("\n"));
  form.inject("Query parameters: ");
  form.inject(q);
  form.inject(br());
  
  form.inject(_input({type: 'submit', value: 'Save rule'}))
  
}

function list_rules(state, json) {
    let obj = document.getElementById('rules');
    obj.innerHTML = ''; // clear object
    if (json.rules && json.rules.length > 0) {
        let div = _div();
        div.inject(_hr());
        let wheader = _h3({class:'subtitle'},"Current ban rules (%u):".format(json.rules.length));
        div.inject(wheader);
        let tbl = new HTML('table', { style: {fontSize: '0.8rem'}});
        let tbh = new HTML('thead');
        let tbody = new HTML('tbody');
        
        tbh.inject(new HTML('tr', {}, [
            new HTML('th', 'Ruleset'),
        ]));
        tbl.inject(tbh);
        
        div.inject(tbl);
        for (var i = 0; i < json.rules.length; i++) {
            let res = json.rules[i];
            rule_json[res.rid] = res;
            let innards = _div();
            
            let form = _form({onsubmit: "add_rule('%s'); return false;".format(res.rid)});
            create_rule_form(form, res.rid);
            innards.inject(form);

            let tr = new HTML('tr', {}, [
                new HTML('td', {style: {padding: '5px'}}, [
                                     _a({href: 'javascript:void();', onclick:"showrule('%s');".format(res.rid)}, _kbd(res.name)),
                                     "   ",
                                     _a({style: {color: '#930', float: 'right'}, href: 'javascript:void();', onclick:"remove_rule('%s');".format(res.rid)}, "Remove ruleset"),
                                     _div({id: res.rid, style: {margin: '6px', background: '#3692', border: '1.5px  solid #3339', padding: '3px', display: 'none'}}, innards)
                  ])
            ]);
            tbody.inject(tr);
        }
        tbl.inject(tbody);
        
        obj.inject(div);
        
        obj.inject(_hr());
        obj.inject(_h3("Create a new rule:"));
        let form = _form({onsubmit: "add_rule('new'); return false;"});
        create_rule_form(form, '');
        obj.inject(form);
        
    }
}

function showrule(rid) {
  let obj = document.getElementById(rid)
  obj.style.display = obj.style.display == 'none' ? 'block' : 'none';
}

function init_rules(source) {
    let obj = document.getElementById('rules');
    obj.innerText = "Fetching rules, hang on...";
    GET('./api/rules', list_rules, manage_error, {});
}

function remove_rule(rid) {
    DELETE('./api/rules', rule_removed, {rid: rid}, manage_error, {rid: rid});
}

function rule_added(state, json) {
  alert("Rule entry added!");
  location.reload();
}

function rule_removed(state, json) {
  alert("Rule entry removed!");
  location.reload();
}

function add_rule(rid) {
  let name = document.getElementById('%s_name'.format(rid)).value;
  let rtype = document.getElementById('%s_type'.format(rid)).value;
  let span = parseInt(document.getElementById('%s_span'.format(rid)).value);
  let limit = parseInt(document.getElementById('%s_limit'.format(rid)).value);
  let query = document.getElementById('%s_query'.format(rid)).value.split(/\r?\n/);
  
  let entry = {
    name: name,
    type: rtype,
    span: span,
    limit: limit,
    query: query
  }
  if (rid && rid != 'new') {
    entry.rid = rid
  }
  if (span > 0 && limit > 0 && query.length > 0) {
      PUT('./api/rules', rule_added, {}, manage_error, entry);
  } else {
    alert("Span, query lines, and limits must be greater than 0!");
  }
  return false
}


/******************************************
 Fetched from source/scaffolding-html.js
******************************************/

/**
 * HTML: DOM creator class
 * args:
 * - type: HTML element type (div, table, p etc) to produce
 * - params: hash of element params to add (class, style etc)
 * - children: optional child or children objects to insert into the new element
 * Example:
 * div = new HTML('div', {
 *    class: "footer",
 *    style: {
 *        fontWeight: "bold"
 *    }
#}, "Some text inside a div")
 */

var txt = (msg) => document.createTextNode(msg);

var HTML = (function() {
  function HTML(type, params, children) {

    /* create the raw element, or clone if passed an existing element */
    var child, j, len, val;
    if (typeof type === 'object') {
      this.element = type.cloneNode();
    } else {
      this.element = document.createElement(type);
    }

    /* If params have been passed, set them */
    if (isHash(params)) {
      for (var key in params) {
        val = params[key];

        /* Standard string value? */
        if (typeof val === "string" || typeof val === 'number') {
          this.element.setAttribute(key, val);
        } else if (isArray(val)) {

          /* Are we passing a list of data to set? concatenate then */
          this.element.setAttribute(key, val.join(" "));
        } else if (isHash(val)) {

          /* Are we trying to set multiple sub elements, like a style? */
          for (var subkey in val) {
            let subval = val[subkey];
            if (!this.element[key]) {
              throw "No such attribute, " + key + "!";
            }
            this.element[key][subkey] = subval;
          }
        }
      }
    } else {
      if (!children) { children = params } // shortcut!
    }

    /* If any children have been passed, add them to the element */
    if (children) {

      /* If string, convert to textNode using txt() */
      if (typeof children === "string") {
        this.element.inject(txt(children));
      } else {

        /* If children is an array of elems, iterate and add */
        if (isArray(children)) {
          for (j = 0, len = children.length; j < len; j++) {
            child = children[j];

            /* String? Convert via txt() then */
            if (typeof child === "string") {
              this.element.inject(txt(child));
            } else {

              /* Plain element, add normally */
              this.element.inject(child);
            }
          }
        } else {

          /* Just a single element, add it */
          this.element.inject(children);
        }
      }
    }
    return this.element;
  }

  return HTML;

})();

/**
 * prototype injector for HTML elements:
 * Example: mydiv.inject(otherdiv)
 */

HTMLElement.prototype.inject = function(child) {
  var item, j, len;
  if (isArray(child)) {
    for (j = 0, len = child.length; j < len; j++) {
      item = child[j];
      if (typeof item === 'string') {
        item = txt(item);
      }
      this.appendChild(item);
    }
  } else {
    if (typeof child === 'string') {
      child = txt(child);
    }
    this.appendChild(child);
  }
  return child;
};



/**
 * prototype for emptying an html element
 */

HTMLElement.prototype.empty = function() {
  var ndiv;
  ndiv = this.cloneNode();
  this.parentNode.replaceChild(ndiv, this);
  return ndiv;
};

function toggleView(id) {
  let obj = document.getElementById(id);
  if (obj) {
    obj.style.display = (obj.style.display == 'block') ? 'none' : 'block';
  }
}

function br() {
  return new HTML('br');
}

// construction shortcuts for various elements
let _a = (a,b) => new HTML('a', a,b);
let _b = (a,b) => new HTML('b', a,b);
let _p = (a,b) => new HTML('p', a,b);
let _i = (a,b) => new HTML('i', a, b);
let _div = (a,b) => new HTML('div', a, b);
let _input = (a,b) => new HTML('input', a, b);
let _select = (a,b) => new HTML('select', a, b);
let _option = (a,b) => new HTML('option', a, b);
let _h1 = (a,b) => new HTML('h1', a, b);
let _h2 = (a,b) => new HTML('h2', a, b);
let _h3 = (a,b) => new HTML('h3', a, b);
let _h4 = (a,b) => new HTML('h4', a, b);
let _h5 = (a,b) => new HTML('h5', a, b);
let _kbd = (a,b) => new HTML('kbd', a, b);
let _pre = (a,b) => new HTML('pre', a, b);
let _form = (a,b) => new HTML('form', a, b);
let _hr = (a,b) => new HTML('hr', a, b);
let _span = (a,b) => new HTML('span', a, b);
let _textarea = (a,b) => new HTML('textarea', a, b);
let _get = (a) => document.getElementById(a);


function billitem(a,b,c, total) {
  let d = _div({style: {position: 'relative', display: 'block'}});
  if (total) { d.style.fontWeight = 'bold'; d.style.borderTop = '2px solid #444'; }
  let da = _div({style: {position: 'relative', width: '600px', display: 'inline-block'}}, a);
  let db = _div({style: {position: 'relative', width: '60px', display: 'inline-block'}}, b);
  let dc = _div({style: {position: 'relative', width: '80px', textAlign: 'right', display: 'inline-block'}}, c);
  d.inject(da);
  d.inject(db);
  d.inject(dc);
  return d;
}


// Generic modal function
function modal(title, msg, type, isHTML) {
    let modal = document.getElementById('modal');
    let text = document.getElementById('modal_text');
    if (modal == undefined) {
        text = new HTML('p', {id: 'modal_text'}, "");
        modal = new HTML('div', { id: 'modal'}, [
            new HTML('div', {id: 'modal_content'}, [
                    new HTML('span', {id: 'modal_close', onclick: 'document.getElementById("modal").style.display = "none";'}, 'X'),
                    new HTML('h2', {id: 'modal_title'}, title),
                    new HTML('div', {}, text)
                    ])
            ]);
        document.body.appendChild(modal);

    }
    if (type) {
        modal.setAttribute("class", "modal_" + type);
    } else {
        modal.setAttribute("class", undefined);
    }
    modal.style.display = 'block';
    document.getElementById('modal_title').innerText = title;
    // If we trust HTML, use it. Otherwise only show as textNode.
    if (isHTML) {
        text.innerHTML = msg;
    } else {
        msg = (typeof(msg) == "string") ? msg : "An internal browser error occurred.";
        msg = msg.replace(/<.*?>/g, ""); // strip HTML tags
        text.innerText = msg;
    }
}

/******************************************
 Fetched from source/search.js
******************************************/

function ban_removed(state, json) {
    alert("Ban removed! IP whitelisted for one hour to flush bans.");
    location.reload();
}

function remove_banlist(rid) {
    DELETE('./api/bans', ban_removed, {rule: rid}, manage_error, {rule: rid});
}

function whitelist_removed(state, json) {
    alert("Whitelisting removed!");
    location.reload();
}

function remove_whitelist(rid) {
    DELETE('./api/whitelist', whitelist_removed, {rule: rid}, manage_error, {rule: rid});
}

function search_callback(state, json) {
    let obj = document.getElementById('results');
    let resno = json.results.whitelist.length + json.results.banlist.length + json.results.iptables.length;
    let header = _h2("Found %u results".format(resno));
    obj.innerHTML = '';
    obj.inject(header);
    
    // whitelist results?
    if (json.results.whitelist.length > 0) {
        let div = _div();
        div.inject(_hr());
        let wheader = _h3({class:'subtitle'},"Whitelist results (%u):".format(json.results.whitelist.length));
        div.inject(wheader);
        let tbl = new HTML('table');
        let tbh = new HTML('thead');
        let tbody = new HTML('tbody');
        
        tbh.inject(new HTML('tr', {}, [
            new HTML('th', 'Source'),
            new HTML('th', 'Times out'),
            new HTML('th', 'Description'),
            new HTML('th', 'Actions')
        ]));
        tbl.inject(tbh);
        
        div.inject(tbl);
        for (var i = 0; i < json.results.whitelist.length; i++) {
            let res = json.results.whitelist[i];
            let timeout = 'never';
            if (res.timeout) {
                timeout = moment(res.timeout*1000.0).fromNow();
            }
            let actions = [
                new HTML('a', {href:'javascript:void();', onclick: "remove_whitelist('%s');".format(res.rid)}, "Remove whitelisting")
            ];
            let tr = new HTML('tr', {}, [
                new HTML('td', {}, _kbd(res.ip)),
                new HTML('td', timeout),
                new HTML('td', res.reason),
                new HTML('td', {}, actions)
            ]);
            tbody.inject(tr);
        }
        tbl.inject(tbody);
        obj.inject(div);
    }
    
    // banlist results?
    if (json.results.banlist.length > 0) {
        let div = _div();
        div.inject(_hr());
        let wheader = _h3({class:'subtitle'},"Banlist results (%u):".format(json.results.banlist.length));
        div.inject(wheader);
        let tbl = new HTML('table');
        let tbh = new HTML('thead');
        let tbody = new HTML('tbody');
        
        tbh.inject(new HTML('tr', {}, [
            new HTML('th', 'Source'),
            new HTML('th', 'Last updated'),
            new HTML('th', 'Reason for ban'),
            new HTML('th', 'Actions')
        ]));
        tbl.inject(tbh);
        
        div.inject(tbl);
        for (var i = 0; i < json.results.banlist.length; i++) {
            let res = json.results.banlist[i];
            let timeout = 'unknown?';
            if (res.epoch) {
                timeout = moment(res.epoch*1000.0).fromNow();
            }
            let actions = [
                new HTML('a', {href:'javascript:void();', onclick: "remove_banlist('%s');".format(res.rid)}, "Remove ban")
            ];
            let tr = new HTML('tr', {}, [
                new HTML('td', {}, _kbd(res.ip)),
                new HTML('td', timeout),
                new HTML('td', res.reason),
                new HTML('td', {}, actions)
            ]);
            tbody.inject(tr);
        }
        tbl.inject(tbody);
        obj.inject(div);
    }
    
    // iptables stuff?
    if (json.results.iptables.length > 0) {
        let div = _div();
        div.inject(_hr());
        obj.inject(div);
        let iheader = _h3({class:'subtitle'},"Local iptables results (%u):".format(json.results.iptables.length));
        div.inject(iheader);
        
        if (json.results.iptables.length == 10) {
            div.inject(_i("We're only showing the first ten results, there may be many more!"));
        }
        
        for (var i = 0; i < json.results.iptables.length; i++) {
            let res = json.results.iptables[i];
            let txt = _div("Found on %s, iptables line %u in the %s chain, as %s".format(res.hostname, res.linenumber, res.chain, res.source));
            div.inject(txt);
        }
    }
}

function old_search(e) {
    if (e && e.state && e.state.what == 'search') {
        search(e.state.source, true);
    }
}

function search(source, nopush) {
    let obj = document.getElementById('results');
    
    let m = source.match(/([a-f0-9:.\/]+)/);
    if (m) {
        source = m[0];
        obj.innerText = "Searching, hang on...";
        if (!nopush) history.pushState({what: 'search', source: source}, "Search: " + source, '?' + source);
        window.onpopstate = old_search;
        let s = document.getElementById('source');
        if (s) s.value = source;
        POST('./api/search', search_callback, {source: source}, manage_error, {source: source});
    } else if (source.length > 0) {
        alert("Invalid IP or CIDR notation entered!")
    }
    return false
}



/******************************************
 Fetched from source/whitelist.js
******************************************/


function list_whites(state, json) {
    let obj = document.getElementById('whitelist');
    obj.innerHTML = ''; // clear object
    if (json.whitelist && json.whitelist.length > 0) {
        json.whitelist = json.whitelist.sort((a,b) => b.epoch - a.epoch);
        let div = _div();
        div.inject(_hr());
        let wheader = _h3({class:'subtitle'},"Current whitelist entries (%u):".format(json.whitelist.length));
        div.inject(wheader);
        let tbl = new HTML('table', { style: {fontSize: '0.8rem'}});
        let tbh = new HTML('thead');
        let tbody = new HTML('tbody');
        
        tbh.inject(new HTML('tr', {}, [
            new HTML('th', 'Source'),
            new HTML('th', {style: {width: '110px'}},'Added'),
            new HTML('th', {style: {width: '110px'}},'Times out'),
            new HTML('th', 'Reason for whitelisting'),
            new HTML('th', {style: {width: '140px'}},'Actions')
        ]));
        tbl.inject(tbh);
        
        div.inject(tbl);
        for (var i = 0; i < json.whitelist.length; i++) {
            let res = json.whitelist[i];
            let timeout = 'Never';
            if (res.timeout) {
                timeout = moment(res.timeout*1000.0).fromNow();
            }
            let actions = [
                new HTML('a', {href:'javascript:void();', onclick: "remove_whitelist('%s');".format(res.rid)}, "Remove whitelisting")
            ];
            let name = res.ip;
            if (res.dns && res.dns.length > 0) {
                let m = res.dns.match(/([^.]+\.[^.]+)$/);
                lastbit = m ? m[1] : '';
                name = "%s (%s)".format(res.ip, lastbit);
            }
            let tr = new HTML('tr', {}, [
                new HTML('td', {}, _kbd(name)),
                new HTML('td', moment(res.epoch*1000.0).fromNow()),
                new HTML('td', timeout),
                new HTML('td', res.reason),
                new HTML('td', {}, actions)
            ]);
            tbody.inject(tr);
        }
        tbl.inject(tbody);
        obj.inject(div);
    }
}


function init_whitelist(source) {
    let obj = document.getElementById('whitelist');
    obj.innerText = "Fetching whitelist, hang on...";
    GET('./api/whitelist', list_whites, manage_error, {});
}

function whitelist_added(state, json) {
  alert("Whitelist entry added!");
  location.reload();
}


function add_whitelist() {
    let source = document.getElementById('source').value;
    let target = document.getElementById('target').value;
    let reason = document.getElementById('reason').value;
    let timeout = document.getElementById('timeout').value;
    let force = document.getElementById('force').checked;
    if (timeout != 'never') {
      timeout = parseInt(timeout);
    } else {
      timeout = 0;
    }
    
    let m = source.match(/([a-f0-9:.\/]+)/);
    if (m) {
        source = m[0];
        PUT('./api/whitelist', whitelist_added, {}, manage_error, {
          source: source,
          target: target,
          reason: reason,
          timeout: timeout,
          force: force
          });
    } else {
      alert("Invalid source address entered!");
    }
    return false
}
