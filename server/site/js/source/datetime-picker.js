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
