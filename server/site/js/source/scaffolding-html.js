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