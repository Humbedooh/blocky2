
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
