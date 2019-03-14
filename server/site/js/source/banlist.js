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
        tbl.inject(tbody);
        for (var i = 0; i < json.bans.length; i++) {
            if (i > 50) {
              div.inject(_hr());
              div.inject(_i("Only the 50 latest results are shown here. Use the search feature to find more IPs."));
              break
            }
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
                let m = res.dns.match(/(([^.]+\.((com?|net|org|edu|)\.)?)[^.]+)$/);
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
