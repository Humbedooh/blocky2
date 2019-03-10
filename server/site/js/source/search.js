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

