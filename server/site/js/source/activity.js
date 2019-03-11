
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
            res.text = res.text.replace(/\b([a-f0-9]{8})[a-f0-9]{32}\b/g, (a) => a + "..");
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
