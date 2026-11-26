/*
 * app.js – dashboardets egne skript, overført uendret fra Claude-artifacten.
 * Hver blokk { … } tilsvarer ett <script> i originalen (eget skop).
 * Det som deles mellom blokkene, ligger på window, som i originalen.
 */

/* ---------- Blokk 1: nøkkeltall, beregninger og legende ---------- */
{
dash.calc('nokkeltall', {
  title: 'Nøkkeltall for delene',
  description: 'Teller deler totalt, publisert av CEN, utgitt som SN-EN og med ferdig nasjonalt tillegg.',
  inputs: ['deler'],
  fn: (deler) => [
    {maal: 'totalt', verdi: deler.length},
    {maal: 'cen', verdi: deler.filter((d) => d.cen_aar != null).length},
    {maal: 'sn', verdi: deler.filter((d) => d.sn_aar != null).length},
    {maal: 'na', verdi: deler.filter((d) => d.nasjonalt_tillegg === 'Publisert').length}
  ]
});
dash.calc('per_eurokode', {
  title: 'Deler per eurokode og status',
  description: 'Antall deler i hver eurokode fordelt på status.',
  inputs: ['deler'],
  fn: (deler) => {
    const koder = [...new Set(deler.map((d) => d.eurokode))];
    return koder.map((k) => {
      const r = deler.filter((d) => d.eurokode === k);
      return {
        eurokode: k,
        sn: r.filter((d) => d.status === 'SN-EN førstandard').length,
        cen: r.filter((d) => d.status === 'Publisert av CEN').length,
        vedtatt: r.filter((d) => d.status === 'Vedtatt i CEN').length
      };
    });
  }
});
dash.calc('frister', {
  title: 'Milepæler med norsk dato',
  description: 'Milepælenes datoer skrevet som dd.mm.åååå.',
  inputs: ['milepaeler'],
  fn: (milepaeler) => milepaeler.map((m) => ({id: m.id, dato: m.dato, dato_tekst: m.dato.slice(8, 10) + '.' + m.dato.slice(5, 7) + '.' + m.dato.slice(0, 4)}))
});

window.ekStatus = [
  {key: 'sn', navn: 'SN-EN førstandard', farge: () => dash.colors[0]},
  {key: 'cen', navn: 'Publisert av CEN', farge: () => dash.colors[1]},
  {key: 'vedtatt', navn: 'Vedtatt i CEN', farge: () => 'var(--cds-chart-muted)'}
];
window.ekFmt = d3.format(',');

const kpi = (maal) => (el) => {
  const r = dash.data('nokkeltall');
  const row = r.status === 'ok' ? r.data.find((x) => x.maal === maal) : null;
  el.classList.toggle('dash-skeleton', r.status === 'loading');
  el.textContent = row ? ekFmt(row.verdi) : '—';
};
dash.draw('k-tot', kpi('totalt'));
dash.draw('k-cen', kpi('cen'));
dash.draw('k-sn', kpi('sn'));
dash.draw('k-na', kpi('na'));
dash.draw('k-dow', (el) => {
  const r = dash.data('frister');
  const row = r.status === 'ok' ? r.data.find((x) => x.id === 'dow') : null;
  el.classList.toggle('dash-skeleton', r.status === 'loading');
  el.textContent = row ? row.dato_tekst : '—';
});
dash.draw('k-dager', (el) => {
  const r = dash.data('frister');
  const row = r.status === 'ok' ? r.data.find((x) => x.id === 'dow') : null;
  if (!row) { el.textContent = '—'; return; }
  const dager = Math.ceil((new Date(row.dato + 'T00:00:00Z') - new Date()) / 864e5);
  el.textContent = dager > 0 ? 'Om ' + ekFmt(dager) + ' dager' : 'Passert';
});
dash.draw('legend', (el) => {
  el.replaceChildren(...ekStatus.map((s) => { const sp = document.createElement('span'); sp.style.setProperty('--sw', s.farge()); sp.textContent = s.navn; return sp; }));
});
}

/* ---------- Blokk 2: stolpediagram, milepæler og tabellen «Alle deler» ---------- */
{
const failLine = (el) => {
  el.replaceChildren();
  const d = document.createElement('div');
  d.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:.5rem;min-height:inherit;color:var(--color-fg-muted);font-size:var(--cds-font-size-caption)';
  const dot = document.createElement('span');
  dot.style.cssText = 'width:.375rem;height:.375rem;border-radius:50%;background:var(--color-bad)';
  d.append(dot, 'Failed to load');
  el.append(d);
};

dash.draw('stolper', (el) => {
  const r = dash.data('per_eurokode');
  el.classList.toggle('dash-skeleton', r.status === 'loading');
  if (r.status === 'error') return failLine(el);
  el.replaceChildren();
  if (r.status !== 'ok') return;
  const rows = r.data;
  const W = Math.max(280, el.clientWidth);
  const rowH = 30, top = 4, bottom = 24;
  const H = top + bottom + rows.length * rowH;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('font-family', 'var(--font-anthropic-sans)');
  const probe = svg.append('text').attr('font-size', 12);
  let left = 0;
  rows.forEach((d) => { probe.text(d.eurokode); left = Math.max(left, probe.node().getComputedTextLength()); });
  probe.remove();
  left += 12;
  const tot = (d) => d.sn + d.cen + d.vedtatt;
  const max = d3.max(rows, tot) || 1;
  const x = d3.scaleLinear([0, max], [left, W - 28]);
  const y = d3.scaleBand(rows.map((d) => d.eurokode), [top, H - bottom]).padding(0.28);
  svg.append('g').selectAll('line').data(x.ticks(Math.min(max, 6)).filter(Number.isInteger)).join('line')
    .attr('x1', (t) => x(t)).attr('x2', (t) => x(t)).attr('y1', top).attr('y2', H - bottom)
    .attr('stroke', 'var(--cds-chart-grid)');
  const ax = svg.append('g').attr('transform', `translate(0,${H - bottom})`)
    .call(d3.axisBottom(x).ticks(Math.min(max, 6)).tickFormat(d3.format('d')).tickSizeOuter(0))
    .attr('font-size', null).attr('font-family', null);
  ax.select('.domain').attr('stroke', 'var(--cds-chart-axis)');
  ax.selectAll('.tick line').remove();
  ax.selectAll('text').attr('fill', 'var(--color-fg-muted)').attr('font-size', 11);
  svg.append('g').selectAll('text').data(rows).join('text')
    .attr('x', left - 10).attr('y', (d) => y(d.eurokode) + y.bandwidth() / 2).attr('dy', '0.35em')
    .attr('text-anchor', 'end').attr('font-size', 12).attr('fill', 'var(--color-fg)').text((d) => d.eurokode);
  const tip = d3.select(el).append('div').attr('class', 'ek-tip').style('display', 'none');
  const g = svg.append('g');
  rows.forEach((d) => {
    let acc = 0;
    ekStatus.forEach((s) => {
      const v = d[s.key];
      if (v > 0) {
        g.append('rect').attr('x', x(acc) + (acc ? 1 : 0)).attr('y', y(d.eurokode))
          .attr('width', Math.max(0, x(acc + v) - x(acc) - (acc ? 1 : 0))).attr('height', y.bandwidth())
          .attr('rx', 2).style('fill', s.farge()).attr('class', 'seg').attr('data-k', d.eurokode);
      }
      acc += v;
    });
    g.append('text').attr('x', x(acc) + 6).attr('y', y(d.eurokode) + y.bandwidth() / 2).attr('dy', '0.35em')
      .attr('font-size', 11).attr('fill', 'var(--color-fg-muted)').text(ekFmt(acc));
    g.append('rect').attr('x', left).attr('y', y(d.eurokode) - y.step() * y.paddingInner() / 2)
      .attr('width', W - left).attr('height', y.step()).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        g.selectAll('.seg').attr('opacity', function () { return this.dataset.k === d.eurokode ? 1 : 0.35; });
        tip.style('display', null).replaceChildren();
        tip.append('div').attr('class', 't').text(d.eurokode + ' · ' + ekFmt(tot(d)) + ' deler');
        ekStatus.forEach((s) => { const l = tip.append('div'); l.append('i').style('background', s.farge()); l.append('span').text(s.navn + ': ' + ekFmt(d[s.key])); });
        const [mx, my] = d3.pointer(ev, el);
        const tw = tip.node().offsetWidth;
        tip.style('left', Math.min(Math.max(0, mx + 12), el.clientWidth - tw) + 'px').style('top', (my + 14) + 'px');
      })
      .on('pointerleave', () => { tip.style('display', 'none'); g.selectAll('.seg').attr('opacity', 1); });
  });
});

dash.draw('tidslinje', (el) => {
  const r = dash.data('milepaeler');
  el.classList.toggle('dash-skeleton', r.status === 'loading');
  if (r.status === 'error') return failLine(el);
  el.replaceChildren();
  if (r.status !== 'ok') return;
  const now = new Date();
  const fmt = (s) => s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4);
  const rows = r.data.slice().sort((a, b) => a.dato.localeCompare(b.dato));
  const nextIdx = rows.findIndex((m) => new Date(m.dato) > now);
  rows.forEach((m, i) => {
    const li = document.createElement('li');
    const fremtid = new Date(m.dato) > now;
    if (fremtid) li.classList.add('future');
    if (i === nextIdx) li.classList.add('today');
    li.style.setProperty('--dot', m.aktor === 'Norge' ? dash.colors[0] : (fremtid ? 'var(--cds-chart-muted)' : dash.colors[1]));
    const d = document.createElement('div'); d.className = 'd'; d.textContent = (m.presisjon === 'Omtrentlig' ? 'ca. ' : '') + fmt(m.dato);
    const t = document.createElement('div');
    const h = document.createElement('div'); h.textContent = m.hendelse;
    const a = document.createElement('div'); a.className = 'a'; a.textContent = m.aktor + (i === nextIdx ? ' · neste milepæl' : '');
    t.append(h, a); li.append(d, t); el.append(li);
  });
});

window.ekFilter = {kode: '', q: ''};
document.querySelectorAll('.ek-filter').forEach((s) => s.addEventListener('change', () => { ekFilter.kode = s.value; dash.draw('tabell'); }));
document.querySelectorAll('.ek-search').forEach((s) => s.addEventListener('input', () => { ekFilter.q = s.value.trim().toLowerCase(); dash.draw('tabell'); }));

dash.draw('tabell', (el) => {
  const r = dash.data('deler');
  el.replaceChildren();
  if (r.status !== 'ok') return;
  const farge = {'SN-EN førstandard': dash.colors[0], 'Publisert av CEN': dash.colors[1], 'Vedtatt i CEN': 'var(--cds-chart-muted)'};
  r.data
    .filter((d) => !ekFilter.kode || d.eurokode === ekFilter.kode)
    .filter((d) => !ekFilter.q || (d.del + ' ' + d.tittel).toLowerCase().includes(ekFilter.q))
    .forEach((d) => {
      const tr = document.createElement('tr');
      const td = (txt, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; c.textContent = txt; tr.append(c); return c; };
      td(d.del);
      td(d.tittel);
      const st = td('');
      const p = document.createElement('span'); p.className = 'ek-pill'; p.style.setProperty('--pc', farge[d.status] || 'var(--color-border-line)'); p.textContent = d.status; st.append(p);
      td(d.cen_aar == null ? '–' : String(d.cen_aar), 'ek-hide');
      td(d.sn_aar == null ? '–' : String(d.sn_aar), 'ek-hide');
      td(d.nasjonalt_tillegg, 'ek-hide');
      const k = td(d.kilde, 'ek-hide');
      if (d.kilde !== 'Standard Norge') k.classList.add('ek-warn');
      el.append(tr);
    });
});
}

/* ---------- Blokk 3: «Hva endres» ---------- */
{
dash.calc('endring_oppsummering', {
  title: 'Antall endringspunkter',
  description: 'Teller endringspunktene totalt og hvor mange som gjelder nye deler.',
  inputs: ['endringer'],
  fn: (endringer) => [
    {maal: 'totalt', verdi: endringer.length},
    {maal: 'nydel', verdi: endringer.filter((e) => e.type === 'Ny del').length}
  ]
});
const eKpi = (maal) => (el) => {
  const r = dash.data('endring_oppsummering');
  const row = r.status === 'ok' ? r.data.find((x) => x.maal === maal) : null;
  el.textContent = row ? d3.format(',')(row.verdi) : '—';
};
dash.draw('e-tot', eKpi('totalt'));
dash.draw('e-nydel', eKpi('nydel'));

window.ekEFilter = {type: '', kode: ''};
document.querySelectorAll('.ek-etype').forEach((s) => s.addEventListener('change', () => { ekEFilter.type = s.value; dash.draw('endringstabell'); }));
document.querySelectorAll('.ek-ekode').forEach((s) => s.addEventListener('change', () => { ekEFilter.kode = s.value; dash.draw('endringstabell'); }));

dash.draw('endringstabell', (el) => {
  const r = dash.data('endringer');
  el.replaceChildren();
  if (r.status !== 'ok') return;
  const farge = {'Ny del': dash.colors[0], 'Ny metode': dash.colors[1], 'Nytt innhold': dash.colors[2], 'Omstrukturering': dash.colors[3], 'Revisjon': dash.colors[4], 'Forenkling': dash.colors[5]};
  r.data
    .filter((e) => !ekEFilter.type || e.type === ekEFilter.type)
    .filter((e) => !ekEFilter.kode || e.eurokode === ekEFilter.kode)
    .forEach((e) => {
      const tr = document.createElement('tr');
      tr.dataset.key = e.id;
      const td = (txt, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; c.textContent = txt; tr.append(c); return c; };
      td(e.del);
      td(e.tema);
      td(e.endring);
      const t = td('');
      const p = document.createElement('span'); p.className = 'ek-pill'; p.style.setProperty('--pc', farge[e.type] || 'var(--color-border-line)'); p.textContent = e.type; t.append(p);
      const g = td(e.grunnlag, 'ek-hide');
      if (e.grunnlag !== 'Bekreftet i kilde') g.classList.add('ek-warn');
      el.append(tr);
    });
});
}

/* ---------- Blokk 4: endringsblad og nye eurokoder ---------- */
{
const ekRows = (el, id, cells) => {
  const r = dash.data(id);
  el.replaceChildren();
  if (r.status !== 'ok') return;
  r.data.forEach((d) => {
    const tr = document.createElement('tr');
    cells(d).forEach(([txt, cls, pill]) => {
      const c = document.createElement('td');
      if (cls) c.className = cls;
      if (pill) { const p = document.createElement('span'); p.className = 'ek-pill'; p.style.setProperty('--pc', pill); p.textContent = txt; c.append(p); }
      else c.textContent = txt;
      tr.append(c);
    });
    el.append(tr);
  });
};
const ekDato = (s) => s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : '–';
dash.draw('blad', (el) => ekRows(el, 'endringsblad', (d) => {
  const farge = {'Vedtatt': dash.colors[0], 'Høring': dash.colors[1], 'Under utarbeiding': 'var(--cds-chart-muted)'};
  return [[d.endringsblad], [d.status, '', farge[d.status] || 'var(--color-border-line)'], [ekDato(d.frist), 'ek-hide'], [d.innhold]];
}));
dash.draw('nye', (el) => ekRows(el, 'nye_eurokoder', (d) => [
  [d.dokument], [d.tittel], [d.status], [d.grunnlag, d.grunnlag === 'Bekreftet i kilde' ? 'ek-hide' : 'ek-hide ek-warn']
]));
}

/* ---------- Blokk 5: andre standarder og regelverk ---------- */
{
dash.calc('regelverk_tall', {
  title: 'Nøkkeltall for annet regelverk',
  description: 'Teller forskrifter og standarder totalt og etter status.',
  inputs: ['regelverk'],
  fn: (regelverk) => [
    {maal: 'totalt', verdi: regelverk.length},
    {maal: 'ny', verdi: regelverk.filter((r) => r.status === 'Ny utgave').length},
    {maal: 'endring', verdi: regelverk.filter((r) => ['Høring avsluttet', 'Varslet høring', 'Under revisjon'].includes(r.status)).length},
    {maal: 'tilbake', verdi: regelverk.filter((r) => r.status === 'Tilbaketrukket').length}
  ]
});
const rKpi = (maal) => (el) => {
  const r = dash.data('regelverk_tall');
  const row = r.status === 'ok' ? r.data.find((x) => x.maal === maal) : null;
  el.classList.toggle('dash-skeleton', r.status === 'loading');
  el.textContent = row ? d3.format(',')(row.verdi) : '—';
};
dash.draw('r-tot', rKpi('totalt'));
dash.draw('r-ny', rKpi('ny'));
dash.draw('r-endring', rKpi('endring'));
dash.draw('r-tilbake', rKpi('tilbake'));

const rDato = (d) => d.dato ? (d.presisjon === 'Omtrentlig' ? 'ca. ' : '') + d.dato.slice(8, 10) + '.' + d.dato.slice(5, 7) + '.' + d.dato.slice(0, 4) : '–';
const rOmrFarge = (o) => ({'TEK17 og forskrifter': dash.colors[0], 'NS-standarder': dash.colors[1], 'Kartverket / SOSI': dash.colors[2]})[o] || 'var(--cds-chart-muted)';

dash.draw('r-tidslinje', (el) => {
  const r = dash.data('regelverk');
  el.classList.toggle('dash-skeleton', r.status === 'loading');
  el.replaceChildren();
  if (r.status !== 'ok') return;
  const now = new Date();
  const fra = new Date(now.getTime() - 365 * 864e5);
  const rows = r.data.filter((d) => d.dato && new Date(d.dato) >= fra).sort((a, b) => a.dato.localeCompare(b.dato));
  const nextIdx = rows.findIndex((d) => new Date(d.dato) > now);
  rows.forEach((d, i) => {
    const li = document.createElement('li');
    if (new Date(d.dato) > now) li.classList.add('future');
    if (i === nextIdx) li.classList.add('today');
    li.style.setProperty('--dot', rOmrFarge(d.omraade));
    const dd = document.createElement('div'); dd.className = 'd'; dd.textContent = rDato(d);
    const t = document.createElement('div');
    const h = document.createElement('div'); h.textContent = d.dokument + ' – ' + d.tittel;
    const a = document.createElement('div'); a.className = 'a'; a.textContent = d.status + ' · ' + d.omraade + (i === nextIdx ? ' · neste frist' : '');
    t.append(h, a); li.append(dd, t); el.append(li);
  });
});

window.ekRFilter = {omr: '', status: '', q: ''};
document.querySelectorAll('.ek-romr').forEach((s) => s.addEventListener('change', () => { ekRFilter.omr = s.value; dash.draw('r-tabell'); }));
document.querySelectorAll('.ek-rstatus').forEach((s) => s.addEventListener('change', () => { ekRFilter.status = s.value; dash.draw('r-tabell'); }));
document.querySelectorAll('.ek-rsok').forEach((s) => s.addEventListener('input', () => { ekRFilter.q = s.value.trim().toLowerCase(); dash.draw('r-tabell'); }));

dash.draw('r-tabell', (el) => {
  const r = dash.data('regelverk');
  el.replaceChildren();
  if (r.status !== 'ok') return;
  const farge = {'Ny utgave': dash.colors[0], 'Høring avsluttet': dash.colors[1], 'Varslet høring': dash.colors[2], 'Under revisjon': dash.colors[3], 'Gjeldende': 'var(--cds-chart-muted)', 'Tilbaketrukket': 'var(--color-bad)'};
  r.data
    .filter((d) => !ekRFilter.omr || d.omraade === ekRFilter.omr)
    .filter((d) => !ekRFilter.status || d.status === ekRFilter.status)
    .filter((d) => !ekRFilter.q || (d.dokument + ' ' + d.tittel + ' ' + d.neste).toLowerCase().includes(ekRFilter.q))
    .forEach((d) => {
      const tr = document.createElement('tr');
      tr.dataset.key = d.id;
      const td = (txt, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; c.textContent = txt; tr.append(c); return c; };
      td(d.dokument);
      td(d.tittel);
      const st = td('');
      const p = document.createElement('span'); p.className = 'ek-pill'; p.style.setProperty('--pc', farge[d.status] || 'var(--color-border-line)'); p.textContent = d.status; st.append(p);
      td(d.neste);
      td(d.gjeldende, 'ek-hide');
      td(rDato(d), 'ek-hide');
      td(d.grunnlag, d.grunnlag === 'Bekreftet i kilde' ? 'ek-hide' : 'ek-hide ek-warn');
      td(d.kilde, 'ek-hide');
      el.append(tr);
    });
});
}

/* ---------- Tillegg i den selvstendige versjonen ----------
 * «Sist kontrollert» under ingressen, og kildelisten som erstatter
 * Claude-panelet «Sources». Begge leser data/meta.json. */
{
const fmtDato = (s) => s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4);

dash.draw('sist-kontrollert', (el) => {
  const r = dash.data('meta');
  el.classList.toggle('dash-skeleton', r.status === 'loading');
  el.classList.remove('ek-stale');
  if (r.status !== 'ok' || !r.data.sist_kontrollert) { el.textContent = r.status === 'loading' ? '' : 'Kontrolldato mangler.'; return; }
  const dato = r.data.sist_kontrollert;
  const dager = Math.floor((new Date() - new Date(dato + 'T00:00:00')) / 864e5);
  const grense = r.data.foreldet_etter_dager || 90;
  const siden = dager <= 0 ? 'i dag' : dager === 1 ? 'for 1 dag siden' : 'for ' + ekFmt(dager) + ' dager siden';
  el.textContent = 'Sist kontrollert mot kildene ' + fmtDato(dato) + ' (' + siden + ').';
  if (dager > grense) {
    el.classList.add('ek-stale');
    el.append(' Dataene er eldre enn ' + ekFmt(grense) + ' dager, så statusene kan ha endret seg. Sjekk gjeldende utgave hos Standard Norge, DiBK og Geonorge.');
  }
});

dash.draw('kilder', (el) => {
  el.replaceChildren();
  const m = dash.data('meta');
  const meta = m.status === 'ok' ? (m.data.kilder || {}) : {};
  Object.keys(dash.datasets).forEach((id) => {
    const ds = dash.datasets[id];
    const k = meta[id] || {};
    const r = dash.data(id);
    const li = document.createElement('li');
    const b = document.createElement('b'); b.textContent = k.tittel || id;
    const a = document.createElement('a'); a.href = ds.file; a.textContent = ds.file.split('/').pop();
    const n = r.status === 'ok' ? ', ' + ekFmt(r.data.length) + ' rader' : '';
    const opp = k.oppdatert ? ', oppdatert ' + fmtDato(k.oppdatert) + (k.av ? ' av ' + k.av : '') : '';
    const metaEl = document.createElement('span'); metaEl.className = 'ek-kmeta';
    metaEl.append(' (', a, n + opp + ')');
    const p = document.createElement('div'); p.className = 'ek-kdesc'; p.textContent = k.beskrivelse || '';
    li.append(b, metaEl, p);
    el.append(li);
  });
});
}
