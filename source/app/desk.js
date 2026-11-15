/* Braquet — partie « logiciel » : bibliothèque locale, compteur, vraie carte, météo, noms de lieux */
(function () {
'use strict';
const api = window.braquetAPI; const BQ = window.BQ; if (!api) return;
const B = window.Braquet, U = B.util; const ST = BQ.ST, store = BQ.store, esc = BQ.esc;
const $ = s => document.querySelector(s);
BQ.desktop = true; ST.showDemo = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PID = () => store.pid || 'p1';
let saveT = null;
const persist = data => { clearTimeout(saveT); saveT = setTimeout(() => api.saveStore(JSON.parse(JSON.stringify(data))), 350); };

/* ---------- Petits messages ---------- */
let toastT = null;
function toast(msg, ms) {
  let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; void el.offsetWidth; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms || 5000);
}
BQ.toast = toast;
let dev = { state: 'disconnected' }, wxNote = '';
function setStatus() {
  const el = $('#status'); if (!el) return;
  const on = dev.state === 'connected';
  let txt = on ? 'Compteur branché' + (dev.note ? ' · ' + dev.note : '') : 'Compteur non branché';
  if (ST.showDemo) txt = 'Mode démonstration';
  el.innerHTML = `<span class="dot" style="background:${ST.showDemo ? '#E8C547' : on ? '#3FB97A' : '#55555c'}"></span>${esc(txt)}${wxNote ? ` <span class="muted">· ${esc(wxNote)}</span>` : ''}`;
}

/* ---------- Lecture des sorties ---------- */
function rideName(d) { const h = d.getHours(); return 'Sortie ' + (h < 12 ? 'du matin' : h < 14 ? 'de midi' : h < 18 ? 'de l’après-midi' : 'du soir'); }
const skipped = [];
async function loadFiles(names, progress) {
  let added = [], k = 0; const wx = store.get('wx', {}); const ign = store.get('ignored', []);
  for (const name of names) {
    k++; if (ign.includes(name)) continue;
    if (progress && (k % 3 === 1 || k === names.length)) { progress(k, names.length); await sleep(0); }
    try {
      const bytes = await api.read(PID(), name);
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      const p = B.parseFIT(buf); const s = p.s; const n = s.t.length;
      if (p.sport != null && p.sport !== 2 && p.sport !== 21) { skipped.push(name + ' : pas une sortie vélo'); continue; }
      let gps = 0; for (let i = 0; i < n; i += 20) if (s.lat[i] !== 0 || s.lon[i] !== 0) gps++;
      if (gps < 10) { skipped.push(name + ' : pas de tracé GPS'); continue; }
      if (n < 300 || s.dist[n - 1] - s.dist[0] < 2000) { skipped.push(name + ' : sortie trop courte'); continue; }
      const id = 'fit-' + p.start.getTime();
      if (ST.imported.some(r => r.id === id)) continue;
      const w = wx[id];
      const ride = { id, file: name, source: 'fit', date: p.start.toISOString(), name: rideName(p.start), bike: ST.bikes.length === 1 ? ST.bikes[0].id : null, wind: w && w.kmh != null ? { dir: w.dir, kmh: w.kmh } : null, temp: null, s };
      ST.imported.push(ride); added.push(ride);
    } catch (e) { skipped.push(name + ' : ' + e.message); }
  }
  return added;
}
function refresh(goTo) {
  if (ST.imported.length && ST.showDemo) { ST.showDemo = false; demoBanner(); }
  BQ.recompute();
  if (goTo && ST.R) ST.cur = goTo;
  if (goTo && ST.R && store.get('onboarded')) BQ.go('sortie'); else BQ.route(true);
  setStatus(); queueWeather(); queueGeo();
}
BQ.pickFiles = async function () {
  const names = await api.pick(PID()); if (!names.length) { toast('Aucune nouvelle sortie dans ces fichiers.'); return; }
  const added = await loadFiles(names);
  if (added.length) { toast(added.length + (added.length > 1 ? ' sorties importées.' : ' sortie importée.')); refresh(added.sort((a, b) => a.date < b.date ? 1 : -1)[0].id); }
  else toast('Ces fichiers ne contiennent pas de sortie vélo utilisable.');
};
BQ.importFiles = async function (files) {
  const names = [];
  for (const f of Array.from(files || [])) { if (!/\.fit$/i.test(f.name)) continue; try { const n = await api.add(PID(), f.name, new Uint8Array(await f.arrayBuffer())); if (n) names.push(n); } catch (e) { console.error(e); } }
  const added = await loadFiles(names);
  if (added.length) { toast(added.length + (added.length > 1 ? ' sorties importées.' : ' sortie importée.')); refresh(added.sort((a, b) => a.date < b.date ? 1 : -1)[0].id); }
  else toast('Aucune nouvelle sortie vélo dans ces fichiers.');
};
async function onDevice(evt) {
  if (evt.state === 'disconnected') { dev = { state: 'disconnected' }; setStatus(); return; }
  if (evt.state !== 'connected') return;
  dev = { state: 'connected', note: 'lecture…' }; setStatus();
  // chaque compteur est rattaché à un profil : on bascule tout seul sur le bon
  const map = store.get('devices', {}); let pid = evt.serial && map[evt.serial];
  if (pid && !profiles().some(p => p.id === pid)) pid = null;
  if (!pid) { pid = PID(); if (evt.serial) { map[evt.serial] = pid; store.set('devices', map); } }
  if (pid !== PID()) { await switchProfile(pid, true); toast(`Compteur de ${profName(pid)} détecté.`); }
  const res = await api.importDevice(pid);
  const added = res.added && res.added.length ? await loadFiles(res.added, (k, n) => { dev.note = `lecture ${k}/${n}`; setStatus(); }) : [];
  dev.note = added.length ? added.length + (added.length > 1 ? ' nouvelles sorties' : ' nouvelle sortie') : 'à jour';
  if (added.length) { toast(added.length > 1 ? `${added.length} nouvelles sorties importées pour ${profName(pid)}.` : `Nouvelle sortie importée pour ${profName(pid)}.`); refresh(added.sort((x, y) => x.date < y.date ? 1 : -1)[0].id); }
  else setStatus();
}

/* ---------- Profils ---------- */
const profiles = () => store.data.profiles || [];
const profName = pid => { const p = store.data['p.' + pid + '.profile']; return (p && p.name) || 'ce profil'; };
function renderProfBtn() {
  const slot = $('#profSlot'); if (!slot) return;
  const list = profiles(); const cur = PID(); const nm = ST.profile.name || 'Profil';
  slot.innerHTML = `<button type="button" class="btn profbtn" id="profBtn" aria-haspopup="menu" aria-expanded="false"><span class="avatar">${esc(nm.charAt(0).toUpperCase())}</span>${esc(nm)}<span aria-hidden="true" style="color:#8F8A85">▾</span></button>
<div class="profmenu" id="profMenu" role="menu">${list.map(p => { const n = profName(p.id); return `<button type="button" role="menuitemradio" aria-checked="${p.id === cur}" data-pid="${p.id}"><span class="avatar">${esc((n === 'ce profil' ? '?' : n).charAt(0).toUpperCase())}</span>${esc(n === 'ce profil' ? 'Profil sans nom' : n)}${p.id === cur ? '<span style="margin-left:auto;color:#5FD497">✓</span>' : ''}</button>`; }).join('')}
<button type="button" role="menuitem" id="profNew"><span class="avatar" style="background:#26262A">+</span>Nouveau profil</button></div>`;
  const btn = $('#profBtn'), menu = $('#profMenu');
  const close = () => { menu.classList.remove('on'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => { e.stopPropagation(); const on = !menu.classList.contains('on'); menu.classList.toggle('on', on); btn.setAttribute('aria-expanded', on); });
  menu.querySelectorAll('[data-pid]').forEach(b => b.addEventListener('click', () => { close(); if (b.dataset.pid !== PID()) switchProfile(b.dataset.pid); }));
  $('#profNew').addEventListener('click', () => { close(); newProfile(); });
}
const closeProfMenu = () => { const m = $('#profMenu'), b = $('#profBtn'); if (m) m.classList.remove('on'); if (b) b.setAttribute('aria-expanded', 'false'); };
document.addEventListener('click', e => { if (!e.target.closest('#profSlot')) closeProfMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProfMenu(); });
window.addEventListener('hashchange', closeProfMenu);
async function switchProfile(pid, quiet) {
  store.pid = pid; store.data.active = pid; persist(store.data);
  ST.imported = []; ST.cur = null; ST.cmpA = ST.cmpB = null; ST.openSeg = null; skipped.length = 0; ST.showDemo = false; demoBanner();
  BQ.reloadPrefs(); renderProfBtn();
  const ign = store.get('ignored', []);
  const files = (await api.list(pid)).map(f => f.name).filter(n => !ign.includes(n));
  if (files.length) $('#app').innerHTML = `<div class="wrap" style="padding-top:140px"><p class="huge">${esc(ST.profile.name || 'Braquet')}</p><p class="lead" style="margin-top:14px">Lecture des sorties…</p></div>`;
  await loadFiles(files);
  BQ.recompute(); setStatus();
  if (!store.get('onboarded')) location.hash = 'bienvenue'; else if (location.hash !== '#sortie') location.hash = 'sortie';
  BQ.route(); queueWeather(); queueGeo();
  if (!quiet && ST.profile.name) toast('Profil de ' + ST.profile.name + '.', 2500);
}
function newProfile() {
  const id = 'p' + Date.now().toString(36); store.data.profiles = profiles().concat([{ id }]); switchProfile(id, true);
}
async function deleteProfile(pid) {
  const list = profiles().filter(p => p.id !== pid); if (!list.length) return;
  await api.removeProfile(pid);
  for (const k of Object.keys(store.data)) if (k.startsWith('p.' + pid + '.')) delete store.data[k];
  const map = store.get('devices', {}); for (const k in map) if (map[k] === pid) delete map[k];
  store.data.devices = map; store.data.profiles = list; await switchProfile(list[0].id, true);
  toast('Profil supprimé.');
}

/* ---------- Météo réelle : vent de chaque sortie ---------- */
let wxBusy = false;
async function queueWeather() {
  if (wxBusy) return; wxBusy = true;
  try {
    const wx = store.get('wx', {}); const todo = ST.imported.filter(r => !wx[r.id] || (wx[r.id].none && Date.now() - wx[r.id].at > 6 * 3600000)).sort((a, b) => a.date < b.date ? 1 : -1);
    let done = 0, dirty = false;
    for (const r of todo) {
      const s = r.s, n = s.t.length; let la = 0, lo = 0, c = 0; for (let i = 0; i < n; i += 60) { la += s.lat[i]; lo += s.lon[i]; c++; }
      wxNote = `météo ${done + 1}/${todo.length}`; setStatus();
      const res = await api.wx({ lat: la / c, lon: lo / c, start: new Date(s.t[0] * 1000).toISOString(), end: new Date(s.t[n - 1] * 1000).toISOString() });
      if (res.ok) { wx[r.id] = { dir: res.dir, kmh: res.kmh, gust: res.gust }; r.wind = { dir: res.dir, kmh: res.kmh }; dirty = true; }
      else if (res.offline) break; // pas de connexion : on réessaiera plus tard
      else wx[r.id] = { none: true, at: Date.now() };
      store.set('wx', wx); done++;
      if (done === 1 && dirty && todo.length > 1) { softRecompute(); dirty = false; }
      await sleep(120);
    }
    if (dirty) softRecompute();
  } catch (e) { console.error('wx', e); }
  wxNote = ''; setStatus(); wxBusy = false;
}
function softRecompute() { // recalcul sans déranger la lecture en cours
  BQ.recompute(); const page = (location.hash || '#sortie').slice(1);
  if (window.scrollY < 250 || page !== 'sortie') BQ.route(true);
}
setInterval(() => { if (ST.imported.length) queueWeather(); }, 10 * 60000);

/* ---------- Noms des côtes et portions (villages) ---------- */
const gkey = (la, lo) => la.toFixed(3) + ',' + lo.toFixed(3);
const de = n => /^[aeiouyhâàéèêëîïôöûüœ]/i.test(n) ? 'd’' + n : 'de ' + n;
const DIRS = ['le nord', 'le nord-est', 'l’est', 'le sud-est', 'le sud', 'le sud-ouest', 'l’ouest', 'le nord-ouest'];
function applyNames() {
  const R = ST.R; if (!R) return; const geo = store.get('geo', {}); const seen = {};
  R.segments.forEach(sg => {
    if (!sg.auto) return;
    if (sg.type === 'climb') { const p = geo[gkey(sg.lat1, sg.lon1)]; if (p) { sg.name = 'Côte ' + de(p); (seen[sg.name] = seen[sg.name] || []).push(sg); } }
    else { const a = geo[gkey(sg.lat0, sg.lon0)], b = geo[gkey(sg.lat1, sg.lon1)]; if (a && b) sg.name = a === b ? 'Autour ' + de(a) : a + ' → ' + b; }
  });
  for (const k in seen) if (seen[k].length > 1) seen[k].forEach(sg => { sg.name += ' · par ' + DIRS[Math.round(U.bearing(sg.lat1, sg.lon1, sg.lat0, sg.lon0) / 45) % 8]; });
  R.analyses.forEach(A => A.climbs.forEach(c => { if (c.segRef) c.name = c.segRef.name; }));
}
BQ.afterRecompute = () => { applyNames(); const b = $('#profBtn'); if (b && !b.textContent.includes(ST.profile.name || 'Profil')) renderProfBtn(); };
let geoBusy = false, geoOff = 0;
async function queueGeo() {
  if (geoBusy || !ST.R || Date.now() < geoOff) return; geoBusy = true;
  try {
    const geo = store.get('geo', {}); const want = [];
    ST.R.segments.filter(s => s.auto).sort((a, b) => b.efforts.length - a.efforts.length).forEach(sg => {
      const pts = sg.type === 'climb' ? [[sg.lat1, sg.lon1]] : [[sg.lat0, sg.lon0], [sg.lat1, sg.lon1]];
      pts.forEach(([la, lo]) => { const k = gkey(la, lo); if (!(k in geo) && !want.some(w => w.k === k)) want.push({ k, la, lo }); });
    });
    let n = 0;
    for (const w of want.slice(0, 150)) {
      const res = await api.geo(w.la, w.lo);
      if (!res.ok) { geoOff = Date.now() + 5 * 60000; break; }
      geo[w.k] = res.name || ''; store.set('geo', geo); n++;
      if (n % 6 === 0) { applyNames(); if ((location.hash || '').slice(1) === 'segments') BQ.route(true); }
    }
    if (n) { applyNames(); const pg = (location.hash || '#sortie').slice(1); if (pg === 'segments' || (pg === 'sortie' && window.scrollY < 250)) BQ.route(true); }
  } catch (e) { console.error('geo', e); }
  geoBusy = false;
}

/* ---------- Vraie carte (Leaflet + fond sombre OpenStreetMap/CARTO) ---------- */
let map = null, marker = null, traceLayer = null;
BQ.onCleanup = () => { if (map) { map.remove(); map = null; marker = null; traceLayer = null; } };
BQ.drawMap = function (r, A, color) {
  const L = window.L; const rs = A.rs; const box = $('#mapBox');
  if (!map) {
    box.innerHTML = '<div id="lmap" style="height:620px"></div>';
    map = L.map('lmap', { scrollWheelZoom: false, zoomSnap: 0.25, attributionControl: true });
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, className: 'tiles-dark', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    let errs = 0, switched = false;
    osm.on('tileerror', () => { // fond de secours si OpenStreetMap ne répond pas
      if (switched || ++errs < 4) return; switched = true; osm.remove();
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: 'Fond &copy; Esri' }).addTo(map);
    });
    map.on('click', () => map.scrollWheelZoom.enable()); map.on('mouseout', () => map.scrollWheelZoom.disable());
    const all = rs.lat.map((la, k) => [la, rs.lon[k]]);
    L.polyline(all, { color: '#000', weight: 9, opacity: 0.55, interactive: false }).addTo(map);
    map.fitBounds(L.latLngBounds(all), { padding: [40, 40] });
    L.circleMarker(all[0], { radius: 8, color: '#F4F1EE', weight: 3, fillColor: '#0A0A0B', fillOpacity: 1, interactive: false }).addTo(map);
    marker = L.circleMarker(all[0], { radius: 7, color: '#0A0A0B', weight: 3, fillColor: '#F4F1EE', fillOpacity: 1, interactive: false }).addTo(map);
  }
  if (traceLayer) traceLayer.remove();
  traceLayer = L.layerGroup().addTo(map);
  let cur = null, pts = [];
  for (let k = 0; k < rs.lat.length; k++) {
    const c = color(k), p = [rs.lat[k], rs.lon[k]];
    if (c !== cur) { if (pts.length) { pts.push(p); L.polyline(pts, { color: cur, weight: 5, opacity: 1, interactive: false, lineCap: 'round' }).addTo(traceLayer); } pts = [p]; cur = c; } else pts.push(p);
  }
  if (pts.length > 1) L.polyline(pts, { color: cur, weight: 5, interactive: false }).addTo(traceLayer);
  marker.bringToFront();
};
BQ.onCursor = (la, lo) => { if (marker) marker.setLatLng([la, lo]); };

/* ---------- Outils d'une sortie ---------- */
BQ.rideTools = r => r.file ? `<button class="btn" type="button" id="rmRide" style="color:#C9C4BF">Retirer cette sortie</button>` : '';
BQ.rideAfter = r => {
  const b = $('#rmRide'); if (!b) return; let armed = false;
  b.addEventListener('click', async () => {
    if (!armed) { armed = true; b.textContent = 'Confirmer le retrait'; b.style.color = '#F2A062'; setTimeout(() => { if (document.body.contains(b)) { armed = false; b.textContent = 'Retirer cette sortie'; b.style.color = '#C9C4BF'; } }, 4000); return; }
    try { await api.remove(PID(), r.file); } catch (e) { toast('Impossible de retirer cette sortie.'); return; }
    const ig = store.get('ignored', []); ig.push(r.file); store.set('ignored', ig);
    ST.imported = ST.imported.filter(x => x.id !== r.id); ST.cur = null; BQ.recompute(); BQ.go(ST.R ? 'historique' : 'sortie'); toast('Sortie retirée (elle reste sur le compteur).');
  });
};

/* ---------- Accueil, démonstration ---------- */
function demoBanner() {
  let el = $('#demoBar');
  if (!ST.showDemo) { if (el) el.remove(); setStatus(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'demoBar'; el.className = 'demobar'; document.body.appendChild(el); }
  el.innerHTML = '<span>Mode démonstration : ces sorties sont des exemples.</span><button type="button" class="btn" id="demoOff" style="min-height:40px;padding:8px 16px">Quitter la démonstration</button>';
  $('#demoOff').addEventListener('click', () => { ST.showDemo = false; ST.cur = null; demoBanner(); BQ.recompute(); BQ.go('sortie'); });
  setStatus();
}
BQ.emptyState = () => `<section class="wrap" style="padding-top:70px"><span class="eyebrow">${ST.profile.name ? 'Bienvenue ' + esc(ST.profile.name) : 'Bienvenue'}</span><h1 class="huge">Branche ton compteur.</h1>
<p class="lead" style="margin-top:14px">Braquet lit ton Garmin tout seul et analyse chaque sortie.</p>
<div class="grid g-3" style="margin-top:34px">
<div class="card"><span class="num" style="color:var(--acc)">1</span><h3 style="margin:8px 0 6px;font-size:22px">Éteins le compteur</h3><p class="muted" style="margin:0;font-size:17px">Il doit être éteint avant d’être branché.</p></div>
<div class="card"><span class="num" style="color:var(--acc)">2</span><h3 style="margin:8px 0 6px;font-size:22px">Branche-le à l’ordinateur</h3><p class="muted" style="margin:0;font-size:17px">Avec son câble USB d’origine. L’écran du compteur affiche un dessin d’ordinateur.</p></div>
<div class="card"><span class="num" style="color:var(--acc)">3</span><h3 style="margin:8px 0 6px;font-size:22px">C’est tout</h3><p class="muted" style="margin:0;font-size:17px">Tes sorties arrivent ici en quelques secondes.</p></div></div>
<div class="row" style="margin-top:28px"><button type="button" class="btn" id="esPick">Choisir des fichiers .FIT</button><button type="button" class="btn" id="esDemo">Voir une démonstration</button></div>
${skipped.length ? `<p class="muted" style="font-size:15px;margin-top:18px">Fichiers ignorés : ${esc(skipped.slice(0, 5).join(' · '))}</p>` : ''}</section>`;
BQ.emptyAfter = () => {
  const p = $('#esPick'); if (p) p.addEventListener('click', () => BQ.pickFiles());
  const d = $('#esDemo'); if (d) d.addEventListener('click', () => { d.textContent = 'Préparation…'; setTimeout(() => { if (!ST.demo.length) ST.demo = B.generateDemo(); ST.showDemo = true; ST.cur = null; BQ.recompute(); demoBanner(); BQ.go('sortie'); }, 40); });
};
BQ.PAGES.bienvenue = () => `<section class="wrap" style="padding-top:70px;max-width:860px"><span class="eyebrow">Bienvenue</span><h1 class="huge">${profiles().length > 1 && !ST.profile.name ? 'Nouveau profil.' : 'Faisons connaissance.'}</h1>
<p class="lead" style="margin-top:14px">Quatre informations pour calculer tes zones d’effort et tes watts par kilo. L’âge se met à jour tout seul à chaque anniversaire. Tu pourras tout modifier plus tard dans l’onglet Profil.</p>
<form class="card" id="wf" style="margin-top:30px"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px">
<div class="field"><label for="wName">Prénom</label><input id="wName" value="${esc(ST.profile.name)}" autocomplete="off"></div>
<div class="field"><label for="wBirth">Date de naissance</label><input id="wBirth" type="date" min="1920-01-01" max="2015-12-31" value="${esc(ST.profile.birth || '')}"></div>
<div class="field"><label for="wW">Poids (kg)</label><input id="wW" type="number" min="35" max="160" step="0.5" value="${ST.profile.weight}"></div>
<div class="field"><label for="wH">Taille (cm)</label><input id="wH" type="number" min="120" max="220" value="${ST.profile.height}"></div>
</div><div class="row" style="margin-top:20px"><button class="btn pri" type="submit">C’est parti</button></div></form></section>`;
BQ.PAGES.bienvenue.after = () => {
  $('#wf').addEventListener('submit', e => {
    e.preventDefault(); const p = ST.profile;
    p.name = $('#wName').value.trim(); p.birth = $('#wBirth').value || null; p.age = BQ.ageOf(p.birth) || 60; p.weight = +$('#wW').value || 74; p.height = +$('#wH').value || 178;
    store.set('profile', p); store.set('onboarded', true); BQ.reloadPrefs(); renderProfBtn(); BQ.recompute(); BQ.go(ST.bikes.length ? 'sortie' : 'materiel'); if (!ST.bikes.length) toast('Ajoute maintenant tes vélos, ou passe directement à « Dernière sortie ».', 6000);
  });
  $('#wName').focus();
};

/* ---------- Réglages d'affichage (onglet Profil) ---------- */
BQ.profileExtra = () => { const z = store.get('zoom', 1); return `<div class="card" style="margin-top:14px"><strong style="font-size:20px">Affichage</strong>
<div class="row" style="margin-top:12px;align-items:flex-end"><div class="field"><label for="zSel">Taille du texte et des chiffres</label><select id="zSel">${[[0.9, 'Petite'], [1, 'Normale'], [1.1, 'Grande'], [1.25, 'Très grande'], [1.4, 'Énorme']].map(([v, l]) => `<option value="${v}"${Math.abs(v - z) < 0.01 ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
<button type="button" class="btn" id="odBtn">Ouvrir le dossier des sorties</button>${profiles().length > 1 ? '<button type="button" class="btn" id="delProf" style="color:#C9C4BF">Supprimer ce profil</button>' : ''}<button type="button" class="btn" id="addProf">Ajouter un profil</button><span class="muted" style="font-size:15px">${ST.imported.length} sortie${ST.imported.length > 1 ? 's' : ''} enregistrée${ST.imported.length > 1 ? 's' : ''} · Braquet ${esc(BQ.version || '')}</span></div></div>`; };
BQ.profileAfter = () => {
  const z = $('#zSel'); if (z) z.addEventListener('change', () => { store.set('zoom', +z.value); api.zoom(+z.value); });
  const o = $('#odBtn'); if (o) o.addEventListener('click', () => api.openData());
  const ap = $('#addProf'); if (ap) ap.addEventListener('click', () => newProfile());
  const dp = $('#delProf'); if (dp) { let armed = false; dp.addEventListener('click', () => {
    if (!armed) { armed = true; dp.textContent = `Confirmer : supprimer ${ST.profile.name || 'ce profil'} et ses sorties`; dp.style.color = '#F2A062'; setTimeout(() => { if (document.body.contains(dp)) { armed = false; dp.textContent = 'Supprimer ce profil'; dp.style.color = '#C9C4BF'; } }, 5000); return; }
    deleteProfile(PID());
  }); }
};


/* ---------- Mise à jour obligatoire ---------- */
function showUpdate(u) {
  let el = $('#updWall'); if (el) return;
  el = document.createElement('div'); el.id = 'updWall'; el.className = 'updwall'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'updTitle');
  el.innerHTML = `<div class="updbox">
<svg width="64" height="64" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="nu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6B3A2C"/><stop offset=".55" stop-color="#8E2438"/><stop offset="1" stop-color="#D48A92"/></linearGradient></defs><circle cx="50" cy="50" r="40" fill="none" stroke="url(#nu)" stroke-width="10" stroke-dasharray="6 4.5"/><circle cx="50" cy="50" r="22" fill="none" stroke="url(#nu)" stroke-width="5"/></svg>
<span class="eyebrow">Mise à jour obligatoire</span>
<h1 class="big" id="updTitle" style="margin:0">Braquet ${esc(u.version)} est arrivé.</h1>
<p class="lead" style="margin:0">${u.notes ? esc(u.notes) : 'Une nouvelle version est disponible.'}</p>
<p class="muted" style="margin:0;font-size:16px">${u.auto ? 'Tes sorties, profils et vélos sont conservés. Braquet redémarrera tout seul.' : 'Télécharge la nouvelle version, puis remplace l’ancienne dans le dossier Applications. Tes données sont conservées.'}</p>
<div class="updbar" aria-hidden="true"><div id="updFill"></div></div>
<p id="updMsg" role="status" style="margin:0;min-height:24px;font-size:16px;color:#C9C4BF"></p>
<button type="button" class="btn pri" id="updGo" style="font-size:18px;padding:14px 28px">${u.auto ? 'Mettre à jour maintenant' : 'Télécharger la nouvelle version'}</button>
<span class="muted" style="font-size:14px">Version installée : ${esc(u.current)}</span></div>`;
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  const go = $('#updGo'); go.focus();
  el.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); go.focus(); } });
  go.addEventListener('click', async () => {
    go.disabled = true; go.style.opacity = .5; $('#updMsg').textContent = u.auto ? 'Téléchargement…' : '';
    if (u.auto) el.querySelector('.updbar').classList.add('on');
    const r = await api.installUpdate();
    if (r.ok && r.manual) { $('#updMsg').textContent = 'Page de téléchargement ouverte dans ton navigateur.'; go.disabled = false; go.style.opacity = 1; return; }
    if (r.ok) { $('#updMsg').textContent = 'Installation… Braquet va redémarrer.'; return; }
    $('#updMsg').textContent = r.error || 'La mise à jour a échoué. Réessaie.'; go.disabled = false; go.style.opacity = 1; go.textContent = 'Réessayer';
  });
}
api.onUpdate(showUpdate);
api.onUpdateProgress(k => { const f = $('#updFill'); if (f) f.style.transform = `scaleX(${Math.max(0.02, Math.min(1, k))})`; const m = $('#updMsg'); if (m && k < 1) m.textContent = `Téléchargement… ${Math.round(k * 100)} %`; });

/* ---------- Démarrage ---------- */
async function boot() {
  const app = $('#app');
  const show = (t, sub) => { app.innerHTML = `<div class="wrap" style="padding-top:140px"><p class="huge">${t}</p><p class="lead" style="margin-top:14px">${sub || ''}</p></div>`; };
  try {
    const saved = await api.loadStore(); Object.assign(store.data, saved || {});
    if (!store.data.profiles) { // première fois, ou ancienne version sans profils
      store.data.profiles = [{ id: 'p1' }];
      for (const k of ['profile', 'bikes', 'rideBike', 'ignored', 'onboarded']) if (k in store.data) { store.data['p.p1.' + k] = store.data[k]; delete store.data[k]; }
    }
    store.pid = store.data.profiles.some(p => p.id === store.data.active) ? store.data.active : store.data.profiles[0].id;
    BQ.reloadPrefs(); renderProfBtn();
    BQ.persist = persist; BQ.version = await api.version();
    if (store.get('zoom')) api.zoom(store.get('zoom'));
    setStatus();
    const ignored = store.get('ignored', []);
    const files = (await api.list(PID())).map(f => f.name).filter(n => !ignored.includes(n));
    if (files.length) show('Braquet', 'Lecture de tes sorties…');
    await loadFiles(files, (k, n) => show('Braquet', `Lecture de tes sorties… ${k} / ${n}`));
    if (ST.imported.length) { show('Braquet', 'Analyse en cours…'); await sleep(30); }
    BQ.recompute();
    if (!store.get('onboarded')) location.hash = 'bienvenue';
    else if (location.hash === '#bienvenue') location.hash = 'sortie';
    BQ.route();
    api.onDevice(onDevice);
    api.checkUpdate();
    persist(store.data); await api.startDevice(); setStatus();
    queueWeather(); queueGeo();
  } catch (e) { console.error(e); show('Oups.', 'Braquet n’a pas pu démarrer : ' + esc(e.message)); }
}
boot();
})();
