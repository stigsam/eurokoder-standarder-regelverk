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

  // Datakildene. Titler, beskrivelser og datoer er hentet uendret fra artifacten.
  var DATASETS = {
    deler: {
      file: 'data/deler.json',
      title: 'Eurokode-deler, 2. generasjon',
      description: 'Deler av 2. generasjons eurokoder med CEN-år, norsk førstandard (SN-EN) og status for nasjonalt tillegg. Alle 43 deler er kontrollert mot Standard Norges katalog (online.standard.no) 05.11.2026.',
      updated: '2026-11-05', by: 'Claude (kontrollert mot online.standard.no)'
    },
    endringer: {
      file: 'data/endringer.json',
      title: 'Hovedendringer i 2. generasjon',
      description: 'De viktigste faglige endringene per eurokode, sammenstilt av Claude og kontrollert mot JRC, Standard Norge og fagartikler 05.11.2026.',
      updated: '2026-11-05', by: 'Claude (kontrollert mot kilder)'
    },
    endringsblad: {
      file: 'data/endringsblad.json',
      title: 'Kommende endringsblad (A1)',
      description: 'Endringsblad til 2. generasjons deler som er vedtatt eller på høring, sammenstilt av Claude fra CEN-kataloger, SIS og Standard Norge per november 2026.',
      updated: '2026-11-05', by: 'Claude (sammenstilt)'
    },
    milepaeler: {
      file: 'data/milepaeler.json',
      title: 'Milepæler for innføring',
      description: 'Felles CEN-frister (DoP 30.09.2027, DoW 30.03.2028) og Standard Norges plan om samlet NS-EN med nasjonale tillegg tidlig 2028; datoer merket omtrentlig er anslått til måned.',
      updated: '2026-11-05', by: 'Claude'
    },
    nye_eurokoder: {
      file: 'data/nye_eurokoder.json',
      title: 'Nye eurokoder og CEN/TS',
      description: 'Status for glass (EN 19100), FRP (CEN/TS 19101), membraner (CEN/TS 19102) og tre–betong-samvirke (CEN/TS 19103), sammenstilt av Claude per november 2026.',
      updated: '2026-11-05', by: 'Claude (sammenstilt)'
    },
    regelverk: {
      file: 'data/regelverk.json',
      title: 'Andre standarder og regelverk',
      description: 'TEK17 og forskrifter, sentrale NS-standarder og Kartverkets standarder for geografisk informasjon, sammenstilt av Claude fra DiBK, KDD, Standard Norge og Geonorge 05.11.2026.',
      updated: '2026-11-05', by: 'Claude (sammenstilt fra kilder)'
    }
  };

  var state = {};      // id -> {status, data, message}
  var calcs = {};      // id -> {inputs, fn, title, description}
  var draws = {};      // navn -> fn
  var listeners = [];
  Object.keys(DATASETS).forEach(function (id) {
    state[id] = { status: 'loading', data: [], message: '' };
  });

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
    Object.keys(DATASETS).forEach(function (id) {
      fetch(DATASETS[id].file, { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + DATASETS[id].file);
          return r.json();
        })
        .then(function (rows) {
          state[id] = { status: 'ok', data: rows, message: '' };
          state[id].data.columns = rows.length ? Object.keys(rows[0]) : [];
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
