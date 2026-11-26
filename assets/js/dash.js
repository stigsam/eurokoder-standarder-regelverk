/*
 * dash.js – liten, selvstendig erstatning for det dashboard-API-et (dash.*)
 * som Claude-artifacten brukte. Siden laster de statiske JSON-filene i data/
 * med relative stier og tegner seg selv; ingen tjenere, nøkler eller
 * innlogging er nødvendig.
 *
 * Støtter det dashboardet bruker:
 *   dash.data(id)      -> {status, data, message}
 *   dash.calc(id, {inputs, fn, title, description})
 *   dash.draw(navn, fn) registrerer, dash.draw(navn) tegner på nytt
 *   dash.onData(fn)
 *   dash.colors        seriefarger (CSS-variabler)
 *   dash.data('meta')  innholdet i data/meta.json (kontrolldato og kildebeskrivelser)
 */
(function () {
  'use strict';

  // Claude-miljøets d3 hadde selection.replaceChildren(), som tooltipen i
  // stolpediagrammet bruker. Standard d3 v7 har det ikke, så det legges til her.
  if (window.d3 && d3.selection && !d3.selection.prototype.replaceChildren) {
    d3.selection.prototype.replaceChildren = function () {
      var args = arguments;
      return this.each(function () { this.replaceChildren.apply(this, args); });
    };
  }

  // Datakildene. Titler, beskrivelser og kontrolldatoer ligger i data/meta.json,
  // slik at all oppdatering av innholdet skjer i data/-mappen.
  var DATASETS = {
    deler: { file: 'data/deler.json' },
    endringer: { file: 'data/endringer.json' },
    endringsblad: { file: 'data/endringsblad.json' },
    milepaeler: { file: 'data/milepaeler.json' },
    nye_eurokoder: { file: 'data/nye_eurokoder.json' },
    regelverk: { file: 'data/regelverk.json' }
  };
  var META_FILE = 'data/meta.json';

  var state = {};      // id -> {status, data, message}
  var calcs = {};      // id -> {inputs, fn, title, description}
  var draws = {};      // navn -> fn
  var listeners = [];
  Object.keys(DATASETS).forEach(function (id) {
    state[id] = { status: 'loading', data: [], message: '' };
  });
  state.meta = { status: 'loading', data: null, message: '' };

  function data(id) {
    if (state[id]) return state[id];
    var c = calcs[id];
    if (!c) return { status: 'missing', data: [], message: 'Ukjent kilde: ' + id };
    var inputs = c.inputs.map(data);
    var bad = inputs.find(function (r) { return r.status !== 'ok'; });
    if (bad) return { status: bad.status, data: null, message: bad.message };
    try {
      return { status: 'ok', data: c.fn.apply(null, inputs.map(function (r) { return r.data; })), message: '' };
    } catch (e) {
      console.error('[dash] calc ' + id + ':', e);
      return { status: 'error', data: null, message: String(e) };
    }
  }

  function runDraw(name) {
    var fn = draws[name];
    if (!fn) return;
    document.querySelectorAll('[data-draw="' + name + '"]').forEach(function (el) {
      try { fn(el); } catch (e) { console.error('[dash] draw ' + name + ':', e); }
    });
  }

  function redrawAll() {
    Object.keys(draws).forEach(runDraw);
    listeners.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }

  var queued = false;
  function scheduleRedraw() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; redrawAll(); });
  }

  var dash = {
    colors: [
      'var(--dash-c0)', 'var(--dash-c1)', 'var(--dash-c2)',
      'var(--dash-c3)', 'var(--dash-c4)', 'var(--dash-c5)'
    ],
    datasets: DATASETS,
    data: data,
    calc: function (id, def) { calcs[id] = def; },
    loader: function () { /* brukes ikke av dette dashboardet */ },
    draw: function (name, fn) {
      if (typeof fn === 'function') draws[name] = fn;
      runDraw(name);
    },
    onData: function (fn) { listeners.push(fn); try { fn(); } catch (e) { console.error(e); } },
    refresh: function () {},
    params: function () { return {}; },
    setParams: function () {},
    resetParams: function () {},
    setLink: function () {}
  };
  window.dash = dash;

  // Last alle datafilene (relative stier, fungerer både lokalt og på GitHub Pages).
  function load() {
    var files = {};
    Object.keys(DATASETS).forEach(function (id) { files[id] = DATASETS[id].file; });
    files.meta = META_FILE;
    Object.keys(files).forEach(function (id) {
      fetch(files[id], { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + files[id]);
          return r.json();
        })
        .then(function (rows) {
          state[id] = { status: 'ok', data: rows, message: '' };
          if (Array.isArray(rows)) state[id].data.columns = rows.length ? Object.keys(rows[0]) : [];
        })
        .catch(function (e) {
          console.error('[dash] ' + id + ':', e);
          state[id] = { status: 'error', data: [], message: String(e) };
        })
        .then(scheduleRedraw);
    });
  }

  // Tegn på nytt når bredden endres (diagrammet måles etter bredden).
  var lastW = 0, t = null;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () {
      if (window.innerWidth !== lastW) { lastW = window.innerWidth; redrawAll(); }
    }, 120);
  });

  document.addEventListener('DOMContentLoaded', function () {
    lastW = window.innerWidth;
    load();
  });
})();
