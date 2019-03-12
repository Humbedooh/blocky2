
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
    
    if (source && source.length > 0) {
      document.getElementById('source').value = source;
      document.getElementById('force').checked = true;
      document.getElementById('reason').value = "Manual whitelist for 1 hour to unban from iptables.";
      document.getElementById('timeout').value = parseInt((new Date().getTime()/1000) + 3600);
    }
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
