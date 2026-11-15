/* Braquet — interface */
(function () {
'use strict';
const B = window.Braquet; const U = B.util; const RAD = Math.PI / 180;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Stockage local (préférences de ce navigateur) ---------- */
const BQ = window.BQ = window.BQ || {};
const PER = ['profile', 'bikes', 'rideBike', 'ignored', 'onboarded'];
const store = {
  data: {}, pid: null,
  key(k) { return this.pid && PER.includes(k) ? 'p.' + this.pid + '.' + k : k; },
  get(k, d) { k = this.key(k); if (k in this.data) return this.data[k]; if (BQ.desktop) return d; try { const v = localStorage.getItem('braquet.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { k = this.key(k); this.data[k] = v; if (BQ.persist) { BQ.persist(this.data); return; } try { localStorage.setItem('braquet.' + k, JSON.stringify(v)); } catch (e) { /* ignoré */ } }
};
const ST = {
  demo: [], imported: [], showDemo: true, R: null, cur: null, mapMode: 'power', cmpA: null, cmpB: null, segTab: 'climb', openSeg: null,
  profile: null, bikes: null, rideBike: null, charts: [], three: null, cursor: 0
};
function ageOf(birth) {
  if (!birth) return null; const d = new Date(birth + 'T12:00:00'); if (isNaN(d)) return null;
  const n = new Date(); let a = n.getFullYear() - d.getFullYear();
  if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
  return a > 5 && a < 110 ? a : null;
}
function reloadPrefs() {
  ST.profile = Object.assign({ name: window.braquetAPI ? '' : 'Papa', birth: null, age: 59, weight: 74, height: 178, ftpManual: null, hrmaxManual: null }, store.get('profile', {}));
  const a = ageOf(ST.profile.birth); if (a) ST.profile.age = a;
  ST.bikes = store.get('bikes', window.braquetAPI ? [] : B.BIKES_DEFAULT.map(b => Object.assign({}, b)));
  ST.rideBike = store.get('rideBike', {});
}
reloadPrefs();

/* ---------- Formats ---------- */
const nf1 = x => (Math.round(x * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = x => Math.round(x).toLocaleString('fr-FR');
const km = d => d >= 100000 ? nf0(d / 1000) : nf1(d / 1000);
const dur = B.fmtDur;
const durLong = sec => { sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`; };
const mmss = sec => { sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
const dFmt = (iso, o) => new Date(iso).toLocaleDateString('fr-FR', o || { weekday: 'long', day: 'numeric', month: 'long' });
const dShort = iso => dFmt(iso, { day: 'numeric', month: 'short' });
const hFmt = iso => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Lexique (bulles ⓘ) ---------- */
const TIPS = {
  dist: ['Distance', 'Le nombre de kilomètres parcourus pendant la sortie.'],
  time: ['Temps de roulage', 'Le temps passé à rouler, sans compter les arrêts (feux, pauses café).'],
  dplus: ['Dénivelé positif (D+)', 'Le total des mètres grimpés sur toute la sortie, en additionnant toutes les montées.'],
  speed: ['Vitesse moyenne', 'La vitesse moyenne pendant le temps de roulage. Elle dépend beaucoup du vent et du relief : pour juger l’effort, regarde plutôt les watts.'],
  avgp: ['Puissance moyenne', 'La moyenne de tous les watts envoyés dans les pédales, en comptant les moments en roue libre.'],
  np: ['Puissance normalisée (NP)', 'La puissance « ressentie » par ton corps. Elle tient compte des à-coups : 1 minute à 400 W puis 1 minute à 100 W fatigue bien plus que 250 W réguliers. C’est la meilleure mesure de l’effort réel.'],
  hr: ['Cardio moyen', 'Ton nombre moyen de battements du cœur par minute pendant la sortie.'],
  cad: ['Cadence', 'Le nombre de tours de pédale par minute. Sur le plat, 85–95 est la plage la plus courante chez les cyclistes entraînés ; en côte, 70–85.'],
  kcal: ['Calories', 'Énergie dépensée, estimée à partir du travail mécanique (1 kJ produit ≈ 1 kcal dépensée, car le corps a un rendement d’environ 24 %).'],
  tss: ['Score de charge (TSS)', 'Mesure la fatigue que la sortie a coûté : 100 = une heure à fond (à ta FTP). Une sortie de 4 h en endurance donne souvent 200 à 250.'],
  ftp: ['FTP (puissance au seuil)', 'La puissance que tu peux tenir environ une heure à fond. On l’estime à 95 % de ta meilleure puissance sur 20 minutes. Toutes les zones en découlent.'],
  if: ['Intensité (IF)', 'Le rapport entre ta puissance normalisée et ta FTP. 0,65–0,75 = endurance ; 0,85–0,95 = tempo soutenu ; 1,0 = une heure à fond.'],
  vi: ['Indice de variabilité (VI)', 'Puissance normalisée ÷ puissance moyenne. 1,00–1,06 = effort très régulier ; au-delà de 1,12 = beaucoup de relances et d’à-coups.'],
  dec: ['Décrochage cardiaque', 'On compare tes watts par battement de cœur entre la 1re et la 2e moitié. Si le cœur monte pour les mêmes watts, il y a fatigue, manque d’eau ou de sucre. Moins de 5 % = bonne endurance (Joe Friel).'],
  ef: ['Efficacité (W/bpm)', 'Watts par battement de cœur. Si ce chiffre monte au fil des semaines pour le même type de sortie, ton endurance progresse.'],
  ctl: ['Condition de fond (CTL)', 'Ta charge d’entraînement moyenne des 6 dernières semaines. Plus elle est haute, plus ton « moteur » est entraîné.'],
  atl: ['Fatigue (ATL)', 'Ta charge des 7 derniers jours. Elle monte vite après de grosses sorties et redescend vite au repos.'],
  tsb: ['Fraîcheur (forme)', 'Condition de fond − fatigue. Très négative = tu es chargé, il faut récupérer. Positive = tu es frais pour un gros effort.'],
  wkg: ['Watts par kilo', 'Ta puissance divisée par ton poids. C’est ce qui compte en montée.'],
  vam: ['VAM', 'Vitesse ascensionnelle : le nombre de mètres de dénivelé gagnés par heure en montée.'],
  zones: ['Zones de puissance', 'Le modèle du Dr Andrew Coggan découpe l’effort en 7 zones selon le pourcentage de ta FTP : Z1–Z2 facile (vert), Z3 tempo (jaune), Z4 seuil (orange), Z5 et plus au-dessus du seuil (rouge).'],
  hrmax: ['FC max', 'Ton cœur ne peut pas battre plus vite que ça. La formule de Tanaka (208 − 0,7 × âge) est plus juste que « 220 − âge » après 50 ans. Ta FC max observée en sortie est encore mieux.']
};
const ib = (k, inline) => `<button type="button" class="ib${inline ? ' inl' : ''}" data-tip="${k}" aria-label="Explication : ${esc(TIPS[k][0])}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><line x1="12" y1="11" x2="12" y2="17" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none"/></svg></button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tip]'); const box = $('#tipbox');
  if (!b) { if (!e.target.closest('#tipbox')) box.classList.remove('on'); return; }
  const t = TIPS[b.dataset.tip]; box.innerHTML = `<b>${esc(t[0])}</b>${esc(t[1])}`; box.classList.add('on');
  const r = b.getBoundingClientRect(); const w = Math.min(340, window.innerWidth - 24);
  box.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left - w / 2 + r.width / 2)) + 'px';
  const below = r.bottom + 10; box.style.top = (below + 160 > window.innerHeight ? Math.max(12, r.top - box.offsetHeight - 10) : below) + 'px';
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#tipbox').classList.remove('on'); });
window.addEventListener('scroll', () => { $('#tipbox').classList.remove('on'); onScrollFx(); }, { passive: true });

/* ---------- Calcul ---------- */
function allRides() { return (ST.showDemo ? ST.demo : []).concat(ST.imported); }
function recompute() {
  const rides = allRides();
  if (!rides.length) { ST.R = null; return; }
  rides.forEach(r => { if (ST.rideBike[r.id]) r.bike = ST.rideBike[r.id]; });
  ST.R = B.run(rides, { ftpManual: ST.profile.ftpManual ? +ST.profile.ftpManual : null });
  const R = ST.R;
  let maxHR = 0; R.analyses.forEach(a => { if (a.maxHR > maxHR) maxHR = a.maxHR; });
  R.hrObserved = maxHR; R.hrTanaka = Math.round(208 - 0.7 * ST.profile.age);
  R.hrmax = ST.profile.hrmaxManual ? +ST.profile.hrmaxManual : Math.max(maxHR, R.hrTanaka);
  R.durs = [5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600, 5400, 7200];
  R.analyses.forEach((A, i) => { A.curve = R.durs.map(w => B.bestAvg(R.rides[i].s.pwr, w)); });
  if (!ST.cur || !R.rides.find(r => r.id === ST.cur)) ST.cur = R.rides[R.rides.length - 1].id;
  if (BQ.afterRecompute) BQ.afterRecompute();
}
const rideIdx = id => ST.R.rides.findIndex(r => r.id === id);
const bikeName = id => (ST.bikes.find(b => b.id === id) || { name: 'Non précisé' }).name;
const BIKE_COLORS = [['nacre', 'Bordeaux nacré', 'var(--nacre)'], ['noir', 'Noir mat', 'linear-gradient(135deg,#0e0e10,#2a2a30)'], ['blanc', 'Blanc', 'linear-gradient(135deg,#d9d6d2,#8d8a86)'], ['rouge', 'Rouge', 'linear-gradient(135deg,#5a1414,#c8302f)'], ['bleu', 'Bleu', 'linear-gradient(135deg,#14243a,#3d6aa0)'], ['vert', 'Vert', 'linear-gradient(135deg,#123020,#3f8a5c)'], ['gris', 'Gris', 'linear-gradient(135deg,#2a2a2e,#6b6b72)'], ['jaune', 'Jaune', 'linear-gradient(135deg,#5a4510,#d9a92a)']];
const bikeGrad = c => (BIKE_COLORS.find(x => x[0] === c) || BIKE_COLORS[6])[2];

/* ---------- Navigation ---------- */
const PAGES = { sortie: pageRide, tableau: pageDash, records: pageRecords, segments: pageSegments, comparer: pageCompare, historique: pageHistory, materiel: pageGear, profil: pageProfile, sources: pageSources };
function route(keep) {
  keep = keep === true; const y0 = window.scrollY;
  const p = (location.hash || '#sortie').slice(1); const page = PAGES[p] ? p : 'sortie';
  document.querySelectorAll('nav.main a').forEach(a => a.classList.toggle('on', a.dataset.p === page));
  cleanup();
  const app = $('#app');
  app.classList.remove('page-in');
  if (!ST.R && !['historique', 'profil', 'sources', 'bienvenue', 'materiel'].includes(page)) { app.innerHTML = BQ.emptyState ? BQ.emptyState() : emptyState(); if (BQ.emptyAfter) BQ.emptyAfter(); if (!keep) { void app.offsetWidth; app.classList.add('page-in'); } return; }
  app.innerHTML = PAGES[page]() + footer();
  (PAGES[page].after || (() => { }))();
  if (keep) { document.querySelectorAll('.reveal').forEach(e => e.classList.add('in', 'now')); window.scrollTo(0, y0); }
  else { void app.offsetWidth; app.classList.add('page-in'); reveal(); countUp(); window.scrollTo(0, 0); }
  onScrollFx();
}
function onScrollFx() {
  const el = document.querySelector('[data-parallax]'); if (!el || REDUCE) return;
  const y = Math.min(700, window.scrollY); el.style.transform = `translate3d(0, ${(y * 0.12).toFixed(1)}px, 0) scale(${(1 - y / 7000).toFixed(4)})`; el.style.opacity = Math.max(0, 1 - y / 620).toFixed(3);
}
const REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function go(page, rideId) { if (rideId) ST.cur = rideId; if (location.hash === '#' + page) route(); else location.hash = page; }
window.addEventListener('hashchange', route);
function cleanup() { if (BQ.onCleanup) BQ.onCleanup(); ST.charts.forEach(c => { try { c.destroy(); } catch (e) { } }); ST.charts = []; if (ST.three) { ST.three.stop(); ST.three = null; } if (ST.replay) { cancelAnimationFrame(ST.replay); ST.replay = null; } }
function footer() { if (BQ.desktop) return `<div class="wrap foot">Braquet · analyse et coaching cycliste. Les conseils s’appuient sur des sources publiques (onglet Sources) et ne remplacent pas l’avis d’un médecin. Fond de carte © OpenStreetMap · météo Open-Meteo.</div>`; return `<div class="wrap foot">Braquet · prototype. Les sorties d’exemple sont générées autour de Lille pour montrer le fonctionnement ; les tiennes s’importent depuis l’onglet Historique. Dans le logiciel final : import automatique au branchement du compteur, vraie carte et météo réelle. Les conseils s’appuient sur des sources publiques (onglet Sources) et ne remplacent pas l’avis d’un médecin.</div>`; }
function emptyState() { return `<div class="wrap sec"><span class="eyebrow">Aucune sortie</span><h1 class="big">Branche ton compteur.</h1><p class="lead">Ou importe un fichier .FIT depuis l’onglet <a href="#historique">Historique</a>.</p></div>`; }
function reveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
  els.forEach(e => io.observe(e));
}
function countUp() {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
    if (reduce || !isFinite(target)) return;
    const t0 = performance.now(), D = 1100;
    const step = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); const v = target * e; el.textContent = dec ? v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : Math.round(v).toLocaleString('fr-FR'); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
const numHTML = (v, dec) => `<span class="num" data-count="${v}" data-dec="${dec || 0}">${dec ? v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : Math.round(v).toLocaleString('fr-FR')}</span>`;
const tile = (label, tip, valueHTML, unit) => `<div class="tile"><div class="lab"><span>${label}</span>${tip ? ib(tip) : ''}</div><div>${valueHTML}${unit ? `<span class="unit">${unit}</span>` : ''}</div></div>`;

/* ---------- Icônes ---------- */
const ICON = {
  fort: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3FB97A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 L10 17 L19 7"/></svg>',
  travail: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EE8A3C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4 L21 20 L3 20 Z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17" r="0.6"/></svg>',
  contexte: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7FA8D6" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 9 H15 a3 3 0 1 0 -3 -3"/><path d="M3 14 H19 a3 3 0 1 1 -3 3"/></svg>',
  plan: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E07C8E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10 H20 M9 3 V7 M15 3 V7"/></svg>',
  trophy: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#E07C8E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4 H17 V9 a5 5 0 0 1 -10 0 Z"/><path d="M7 6 H4 a3 3 0 0 0 3 4"/><path d="M17 6 H20 a3 3 0 0 1 -3 4"/><path d="M12 14 V18"/><path d="M8 20 H16"/></svg>',
  bolt: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#E07C8E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3 L5 13 H11 L10 21 L19 10 H13 Z"/></svg>',
  hill: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#C9C4BF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 19 L9 9 L13 14 L16 10 L21 19 Z"/></svg>',
  road: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#C9C4BF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18 C8 18 8 6 12 6 S16 18 20 18"/></svg>'
};
const KIND = { fort: ['POINT FORT', '#3FB97A', 'rgba(63,185,122,.16)'], travail: ['À TRAVAILLER', '#EE8A3C', 'rgba(238,138,60,.16)'], contexte: ['CONTEXTE', '#7FA8D6', 'rgba(127,168,214,.16)'], plan: ['À FAIRE', '#E07C8E', 'rgba(224,124,142,.16)'] };
function advCard(a) {
  const k = KIND[a.kind];
  const srcs = (a.src || []).map(id => B.SOURCES[id]).filter(Boolean).map(s => `<a href="${s.u}" target="_blank" rel="noopener">${esc(s.t)}</a>`).join('');
  return `<article class="adv reveal"><div class="row" style="justify-content:space-between"><span class="ic" style="background:${k[2]}">${ICON[a.kind]}</span><span class="met" style="color:${k[1]}">${esc(a.metric || '')}</span></div>
<span class="kind" style="color:${k[1]}">${k[0]}</span><h3>${esc(a.title)}</h3><p>${esc(a.text)}</p>${a.tip ? `<p class="tip">${esc(a.tip)}</p>` : ''}
<details><summary>Pourquoi ? Ce que disent les pros</summary><p style="margin:8px 0 4px;color:#C9C4BF">${esc(a.why || '')}</p><div class="srcs">${srcs}</div></details></article>`;
}

/* =====================================================================
   PAGE : SORTIE
   ===================================================================== */
function pageRide() {
  const R = ST.R; const i = rideIdx(ST.cur); const r = R.rides[i], A = R.analyses[i];
  const adv = B.rideAdvice(r, A);
  const prevId = i > 0 ? R.rides[i - 1].id : null, nextId = i < R.rides.length - 1 ? R.rides[i + 1].id : null;
  const isLast = i === R.rides.length - 1;
  const phrase = (A.dist > 100000 ? 'Grosse sortie' : 'Belle sortie') + (A.headRun && A.headRun.km1 - A.headRun.km0 >= 8 ? `, avec du vent de face du km ${Math.round(A.headRun.km0)} au km ${Math.round(A.headRun.km1)}` : '') + (A.prs.length ? ` et ${A.prs.length} record${A.prs.length > 1 ? 's' : ''} battu${A.prs.length > 1 ? 's' : ''}` : '') + '. Voici ce qu’elle raconte.';
  const bikeOpts = `<option value=""${ST.bikes.some(b => b.id === r.bike) ? '' : ' selected'}>Non précisé</option>` + ST.bikes.map(b => `<option value="${b.id}"${b.id === r.bike ? ' selected' : ''}>${esc(b.name)}</option>`).join('');
  const ws = r.wind ? `<div class="card" style="padding:12px 18px;display:flex;gap:14px;align-items:center"><svg width="42" height="42" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="#34343A" stroke-width="2"/><path d="M20 6 L26 24 L20 20 L14 24 Z" fill="#7FA8D6" transform="rotate(${(r.wind.dir + 180) % 360} 20 20)"/></svg><div><strong style="font-size:17px">Vent ${r.wind.kmh} km/h</strong><div class="muted" style="font-size:15px">venant ${dirName(r.wind.dir)}${A.headRun ? ` · de face du km ${Math.round(A.headRun.km0)} au ${Math.round(A.headRun.km1)}` : ''}</div></div></div>` : `<div class="card" style="padding:12px 18px;font-size:15px;color:#C9C4BF">${BQ.desktop ? 'Vent : en attente de la météo (connexion Internet nécessaire)' : 'Vent : disponible dans le logiciel final (météo en ligne)'}</div>`;
  return `
<section class="wrap" style="padding-top:60px">
<div class="row" style="justify-content:space-between">
<div class="row"><span class="muted" style="font-size:16px">${cap(dFmt(r.date))} · ${hFmt(r.date)}</span>${r.source === 'demo' ? '<span class="chip">Données d’exemple</span>' : '<span class="chip">Importée de ton compteur</span>'}${r.workout ? `<span class="chip">Séance : ${esc(r.workout)}</span>` : ''}</div>
<div class="row">${BQ.rideTools ? BQ.rideTools(r) : ''}<button class="btn" data-go="${prevId || ''}" ${prevId ? '' : 'disabled style="opacity:.4"'} aria-label="Sortie précédente">← Précédente</button><button class="btn" data-go="${nextId || ''}" ${nextId ? '' : 'disabled style="opacity:.4"'} aria-label="Sortie suivante">Suivante →</button></div>
</div>
<div class="row" style="align-items:center;gap:40px;margin-top:26px">
<div style="flex:1 1 520px;min-width:0;display:flex;flex-direction:column;gap:16px">
<h1 class="huge">${isLast ? `Bonjour${ST.profile.name ? ' ' + esc(ST.profile.name) : ''}.<br>` : ''}<span style="color:var(--acc)">${km(A.dist)} km ${isLast ? 'avalés.' : ''}</span></h1>
<p class="lead">${r.source === 'fit' ? '' : esc(r.name) + '. '}${esc(phrase)}</p>
<div class="row" style="font-size:16px;color:#C9C4BF"><span style="width:14px;height:14px;border-radius:4px;background:${ST.bikes.some(b => b.id === r.bike) ? bikeGrad(ST.bikes.find(b => b.id === r.bike).color) : '#2a2a2e'};border:1px solid #444;display:inline-block"></span>
<label for="bikeSel" class="muted">Vélo :</label><select id="bikeSel" class="sel">${bikeOpts}</select></div>
</div>
<div data-parallax style="flex:1 1 460px;min-width:0;display:flex;justify-content:center;will-change:transform,opacity">${signature(A)}</div>
</div>
</section>

<section class="wrap" style="padding-top:34px">
<div class="grid g-stats">
${tile('Distance', 'dist', numHTML(A.dist / 1000, A.dist < 100000 ? 1 : 0), 'km')}
${tile('Temps de roulage', 'time', `<span class="num">${Math.floor(A.moving / 3600)}</span><span class="unit">h</span><span class="num" style="margin-left:6px">${String(Math.floor(A.moving % 3600 / 60)).padStart(2, '0')}</span>`)}
${tile('Dénivelé positif', 'dplus', numHTML(A.gain), 'm')}
${tile('Vitesse moyenne', 'speed', numHTML(A.avgSpeed * 3.6, 1), 'km/h')}
${A.hasPower ? tile('Puissance normalisée', 'np', numHTML(A.NP), 'W') : ''}
${A.hasPower ? tile('Puissance moyenne', 'avgp', numHTML(A.avgP), 'W') : ''}
${A.hasHR ? tile('Cardio moyen', 'hr', numHTML(A.avgHR), 'bpm') : ''}
${tile('Cadence moyenne', 'cad', numHTML(A.avgCad), 'tr/min')}
${A.hasPower ? tile('Score de charge', 'tss', numHTML(A.TSS), 'TSS') : ''}
${A.hasPower ? tile('Calories', 'kcal', numHTML(A.kcal), 'kcal') : ''}
</div>
</section>

<section class="wrap sec reveal">
<div class="sec-head"><div><span class="eyebrow">Le parcours</span><h2 class="big">Zone par zone.</h2></div>
<div class="toggle" role="group" aria-label="Colorer le tracé selon">
<button type="button" data-mode="power" class="${ST.mapMode === 'power' ? 'on' : ''}" aria-pressed="${ST.mapMode === 'power'}">Puissance</button>
<button type="button" data-mode="hr" class="${ST.mapMode === 'hr' ? 'on' : ''}" aria-pressed="${ST.mapMode === 'hr'}">Cardio</button>
<button type="button" data-mode="grade" class="${ST.mapMode === 'grade' ? 'on' : ''}" aria-pressed="${ST.mapMode === 'grade'}">Pente</button>
</div></div>
<div class="panel" id="mapPanel"><div id="mapBox"></div></div>
<div class="row" style="justify-content:space-between;margin-top:14px">${ws}<div class="legend card" id="mapLegend" style="padding:14px 18px"></div></div>
${BQ.desktop ? '' : '<div style="margin-top:14px" class="notice">Prototype : le fond de carte est simplifié (villes repères). Le logiciel final affichera une vraie carte routière.</div>'}
</section>

<section class="wrap sec reveal">
<div class="sec-head"><div><span class="eyebrow">Le relief</span><h2 class="big">Là où ça grimpe.</h2></div>
<button type="button" class="btn" id="replayBtn">▶ Rejouer la sortie</button></div>
<div class="panel"><div id="three" class="three" aria-label="Vue 3D du parcours : fais glisser pour tourner, molette pour zoomer"></div>
<div class="overlay" style="top:16px;right:16px;font-size:14px;color:#C9C4BF" id="exagNote">Glisse pour tourner · molette pour zoomer</div></div>
<div class="panel" style="margin-top:14px;padding:22px 22px 10px"><div id="profileBox"></div></div>
<div style="margin-top:14px" class="card">
<label for="cursor" class="muted" style="font-size:15px">Glisse le curseur : la carte, la 3D, le relief et les courbes suivent.</label>
<input type="range" id="cursor" min="0" max="${A.rs.d.length - 1}" value="0">
<div class="readout" id="readout"></div>
</div>
</section>

<section class="wrap sec reveal">
<div class="sec-head"><div><span class="eyebrow">Les courbes</span><h2 class="big">Seconde par seconde.</h2></div></div>
<div class="panel" style="padding:20px 22px 12px"><div id="curvesBox"></div></div>
</section>

<section class="wrap sec">
<div class="sec-head reveal"><div><span class="eyebrow">Le bilan du coach</span><h2 class="big">Ce qu’il faut retenir.</h2></div>
<span class="muted" style="font-size:15px;max-width:420px">Chaque conseil est calculé sur tes chiffres et s’appuie sur une source que tu peux ouvrir (« Pourquoi ? »).</span></div>
<div class="grid g-3">${adv.map(advCard).join('') || '<p class="muted">Pas assez de données pour un bilan.</p>'}</div>
</section>

<section class="wrap sec reveal">
<div class="sec-head"><div><span class="eyebrow">L’analyse complète</span><h2 class="big">Du départ à l’arrivée.</h2></div></div>
${fullAnalysis(r, A)}
</section>

<section class="wrap sec reveal">
<div class="sec-head"><div><span class="eyebrow">Côtes et portions</span><h2 class="big">${A.prs.length ? `${A.prs.length} record${A.prs.length > 1 ? 's' : ''} battu${A.prs.length > 1 ? 's' : ''}.` : 'Tes passages du jour.'}</h2></div></div>
${segToday(r, A)}
</section>`;
}
pageRide.after = function () {
  const R = ST.R; const i = rideIdx(ST.cur); const r = R.rides[i], A = R.analyses[i];
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { if (b.dataset.go) go('sortie', b.dataset.go); }));
  $('#bikeSel').addEventListener('change', e => { ST.rideBike[r.id] = e.target.value; r.bike = e.target.value; store.set('rideBike', ST.rideBike); });
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { ST.mapMode = b.dataset.mode; ST.mapPr = null; document.querySelectorAll('[data-mode]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); drawMap(r, A); setCursor(ST.cursor); }));
  drawMap(r, A); drawProfile(A); drawCurves(A);
  ST.three = init3D($('#three'), r, A);
  const cur = $('#cursor'); cur.addEventListener('input', () => setCursor(+cur.value));
  $('#replayBtn').addEventListener('click', () => {
    if (ST.replay) { cancelAnimationFrame(ST.replay); ST.replay = null; $('#replayBtn').textContent = '▶ Rejouer la sortie'; return; }
    $('#replayBtn').textContent = '❚❚ Pause'; const N = A.rs.d.length; const t0 = performance.now(); const start = ST.cursor >= N - 2 ? 0 : ST.cursor; const D = 24000 * (1 - start / N);
    const step = now => { const k = Math.min(1, (now - t0) / D); const v = Math.round(start + (N - 1 - start) * k); cur.value = v; setCursor(v); if (k < 1) ST.replay = requestAnimationFrame(step); else { ST.replay = null; $('#replayBtn').textContent = '▶ Rejouer la sortie'; } };
    ST.replay = requestAnimationFrame(step);
  });
  document.querySelectorAll('[data-seg]').forEach(el => el.addEventListener('click', () => { ST.openSeg = el.dataset.seg; ST.segTab = el.dataset.type; go('segments'); }));
  if (BQ.rideAfter) BQ.rideAfter(r);
  setCursor(0);
};
function dirName(d) { return ['du nord', 'du nord-est', 'de l’est', 'du sud-est', 'du sud', 'du sud-ouest', 'de l’ouest', 'du nord-ouest'][Math.round(d / 45) % 8]; }

function signature(A) {
  const rs = A.rs; const W = 560, H = 400; const pr = projector(rs.lat, rs.lon, W - 80, 250, 40, 20);
  let d = ''; for (let k = 0; k < rs.lat.length; k += 3) { const [x, y] = pr(rs.lat[k], rs.lon[k]); d += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
  const N = rs.d.length; const amin = A.altMin, amax = Math.max(A.altMax, amin + 30); let pf = '';
  for (let k = 0; k < N; k += 4) { const x = 20 + k / (N - 1) * (W - 40); const y = 392 - (rs.alt[k] - amin) / (amax - amin) * 90; pf += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
  const [sx, sy] = pr(rs.lat[0], rs.lon[0]);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:620px;height:auto" role="img" aria-label="La forme de la sortie et son relief"><defs><linearGradient id="nacre" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5E3226"/><stop offset=".45" stop-color="#8E2438"/><stop offset=".75" stop-color="#B95468"/><stop offset="1" stop-color="#E3B3B2"/></linearGradient><linearGradient id="relf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B95468" stop-opacity=".55"/><stop offset="1" stop-color="#8E2438" stop-opacity="0"/></linearGradient></defs>
<path d="${d}" fill="none" stroke="url(#nacre)" stroke-width="20" opacity=".16" stroke-linejoin="round"/><path class="draw" pathLength="1" d="${d}" fill="none" stroke="url(#nacre)" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
<circle cx="${sx}" cy="${sy}" r="10" fill="#0A0A0B" stroke="#F4F1EE" stroke-width="4"/>
<path d="${pf} L${W - 20} 400 L20 400 Z" fill="url(#relf)"/><path d="${pf}" fill="none" stroke="#D48A92" stroke-width="3" stroke-linejoin="round"/></svg>`;
}
function projector(lat, lon, W, H, ox, oy) {
  let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
  for (let k = 0; k < lat.length; k++) { if (lat[k] < a) a = lat[k]; if (lat[k] > b) b = lat[k]; if (lon[k] < c) c = lon[k]; if (lon[k] > d) d = lon[k]; }
  const cl = Math.cos((a + b) / 2 * RAD); const wx = (d - c) * cl || 1e-6, wy = (b - a) || 1e-6; const s = Math.min(W / wx, H / wy);
  const offx = ox + (W - wx * s) / 2, offy = oy + (H - wy * s) / 2;
  const f = (la, lo) => [offx + (lo - c) * cl * s, offy + (b - la) * s]; f.bounds = { a, b, c, d, s, cl }; return f;
}

/* ---------- Carte ---------- */
function colorFor(mode, A, k) {
  const rs = A.rs; const R = ST.R;
  if (mode === 'hr' && A.hasHR) return B.colorHR(rs.hr[k] / R.hrmax);
  if (mode === 'grade' || !A.hasPower) return B.colorGrade(rs.grade[k]);
  return B.colorPower(rs.p30[k] / A.ftp);
}
function drawMap(r, A) { if (BQ.drawMap) BQ.drawMap(r, A, k => colorFor(ST.mapMode, A, k)); else drawMapSvg(r, A); drawLegend(A); }
function drawMapSvg(r, A) {
  const W = 1200, H = 660; const rs = A.rs; const pr = projector(rs.lat, rs.lon, W - 120, H - 120, 60, 60); ST.mapPr = pr;
  const bb = pr.bounds; let bg = '';
  // quadrillage
  for (let x = 0; x <= W; x += 60) bg += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#16161A"/>`;
  for (let y = 0; y <= H; y += 60) bg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#16161A"/>`;
  if (r.source === 'demo') {
    const m = 0.08;
    B.PLACES.filter(p => p.key !== 'H' && !B.HILLS.some(h => U.haversine(h.lat, h.lon, p.lat, p.lon) < 2000) && p.lat > bb.a - m && p.lat < bb.b + m && p.lon > bb.c - m * 1.5 && p.lon < bb.d + m * 1.5).forEach(p => { const [x, y] = pr(p.lat, p.lon); if (x < 10 || x > W - 10 || y < 10 || y > H - 10) return; bg += `<circle cx="${x}" cy="${y}" r="4" fill="#3A3A40"/><text x="${x + 8}" y="${y + 5}" fill="#8F8A85" font-size="15" font-family="Inter">${esc(p.name)}</text>`; });
    B.HILLS.forEach(h => { const [x, y] = pr(h.lat, h.lon); if (x < 10 || x > W - 10 || y < 10 || y > H - 10) return; bg += `<path d="M${x - 9} ${y + 7} L${x} ${y - 9} L${x + 9} ${y + 7} Z" fill="#2A2A30" stroke="#4A4A52"/><text x="${x + 12}" y="${y - 6}" fill="#A9A39D" font-size="14" font-family="Inter" font-style="italic">${esc(h.n)} · ${Math.round(B.terrainAlt(h.lat, h.lon))} m</text>`; });
  }
  let under = '', paths = ''; let curC = null, d = '';
  for (let k = 0; k < rs.lat.length; k++) {
    const [x, y] = pr(rs.lat[k], rs.lon[k]); const c = colorFor(ST.mapMode, A, k); const pt = x.toFixed(1) + ' ' + y.toFixed(1);
    under += (k ? 'L' : 'M') + pt;
    if (c !== curC) { if (d) paths += `<path d="${d}L${pt}" stroke="${curC}"/>`; d = 'M' + pt; curC = c; } else d += 'L' + pt;
  }
  if (d) paths += `<path d="${d}" stroke="${curC}"/>`;
  const [sx, sy] = pr(rs.lat[0], rs.lon[0]);
  $('#mapBox').innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Carte du parcours colorée selon ${ST.mapMode === 'power' ? 'la puissance' : ST.mapMode === 'hr' ? 'le cardio' : 'la pente'}">${bg}
<path d="${under}" fill="none" stroke="#000" stroke-width="13" stroke-linejoin="round" opacity=".55"/><g fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
<circle cx="${sx}" cy="${sy}" r="12" fill="#0A0A0B" stroke="#F4F1EE" stroke-width="4"/><circle cx="${sx}" cy="${sy}" r="4" fill="#F4F1EE"/>
<g id="mapCur"><circle r="13" fill="#E07C8E" opacity=".3"/><circle r="7" fill="#F4F1EE" stroke="#0A0A0B" stroke-width="3"/></g></svg>`;
}
function drawLegend(A) {
  const L = ST.mapMode === 'grade' || !A.hasPower ? [['#7FA8D6', 'Descente'], ['#3FB97A', 'Plat (< 2 %)'], ['#E8C547', '2–4 %'], ['#EE8A3C', '4–6 %'], ['#E5484D', '> 6 %']]
    : ST.mapMode === 'hr' ? [['#3FB97A', '< 75 % FC max'], ['#E8C547', '75–85 %'], ['#EE8A3C', '85–92 %'], ['#E5484D', '> 92 %']]
      : [['#3FB97A', 'Facile (Z1–Z2)'], ['#E8C547', 'Tempo (Z3)'], ['#EE8A3C', 'Seuil (Z4)'], ['#E5484D', 'Dans le rouge (Z5+)']];
  $('#mapLegend').innerHTML = L.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('') + (ST.mapMode === 'power' ? ib('zones', true) : '');
}

/* ---------- Profil d'altitude ---------- */
function drawProfile(A) {
  const rs = A.rs, N = rs.d.length; const W = 1200, H = 320, top = 62, bot = 30;
  const amin = Math.floor(A.altMin / 10) * 10, amax = Math.max(amin + 40, Math.ceil(A.altMax / 10) * 10 + 10);
  const X = k => 50 + k / (N - 1) * (W - 70), Y = a => top + (1 - (a - amin) / (amax - amin)) * (H - top - bot);
  let strips = '', curC = null, poly = [];
  const flush = () => { if (poly.length > 1) { const p = poly.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L'); strips += `<path d="M${poly[0][0].toFixed(1)} ${H - bot}L${p}L${poly[poly.length - 1][0].toFixed(1)} ${H - bot}Z" fill="${curC}" opacity=".5"/>`; } };
  for (let k = 0; k < N; k++) { const c = B.colorGrade(rs.grade[k]); const pt = [X(k), Y(rs.alt[k])]; if (c !== curC) { if (poly.length) { poly.push(pt); flush(); } poly = [pt]; curC = c; } else poly.push(pt); }
  flush();
  let line = ''; for (let k = 0; k < N; k++) line += (k ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(rs.alt[k]).toFixed(1);
  let axis = ''; const stepA = (amax - amin) > 120 ? 50 : 20;
  for (let a = Math.ceil(amin / stepA) * stepA; a <= amax; a += stepA) axis += `<line x1="50" x2="${W - 20}" y1="${Y(a)}" y2="${Y(a)}" stroke="#1E1E22"/><text x="42" y="${Y(a) + 5}" text-anchor="end" fill="#8F8A85" font-size="14" font-family="Inter">${a} m</text>`;
  const kmStep = A.dist > 80000 ? 20 : 10; for (let d = kmStep; d < A.dist / 1000; d += kmStep) { const k = Math.round(d * 10); if (k >= N) break; axis += `<text x="${X(k)}" y="${H - 8}" text-anchor="middle" fill="#8F8A85" font-size="14" font-family="Inter">km ${d}</text>`; }
  let cl = ''; let lastEnd = -1e9, row = 0; A.climbs.forEach(c => { const k0 = Math.round(c.d0 / 100), k1 = Math.round(c.d1 / 100); const label = /^Côte (de [\d,]+ km à|du km)/.test(c.name) ? `${nf1(c.len / 1000)} km à ${nf1(c.grade)} %` : `${c.name.split(' · ')[0]} · ${nf1(c.grade)} %`; const cx = (X(k0) + X(k1)) / 2, half = label.length * 3.9; row = cx - half < lastEnd + 10 ? 1 - row : 0; if (row === 0 || cx - half >= lastEnd + 10) lastEnd = cx + half; else lastEnd = Math.max(lastEnd, cx + half);
    cl += `<rect x="${X(k0)}" y="${row ? 22 : 4}" width="${Math.max(4, X(k1) - X(k0))}" height="5" rx="2.5" fill="#E07C8E"/><text x="${cx}" y="${row ? 44 : 22}" text-anchor="middle" fill="#F4F1EE" font-size="14" font-family="Inter" font-weight="600" ${row ? '' : 'dy="-2"'}>${esc(label)}</text>`; });
  $('#profileBox').innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Profil d’altitude coloré selon la pente">${axis}${strips}<path d="${line}" fill="none" stroke="#F4F1EE" stroke-width="2.5" stroke-linejoin="round"/>${cl}<line id="profCur" x1="0" x2="0" y1="${top - 6}" y2="${H - bot}" stroke="#F4F1EE" stroke-width="2" stroke-dasharray="4 5"/><circle id="profDot" r="7" fill="#0A0A0B" stroke="#F4F1EE" stroke-width="3"/></svg>`;
  ST.profX = X; ST.profY = Y;
}

/* ---------- Courbes ---------- */
function drawCurves(A) {
  const rs = A.rs, N = rs.d.length; const W = 1200; const rows = [];
  if (A.hasPower) rows.push({ k: 'p30', label: 'Puissance (moy. 30 s)', unit: 'W', color: '#E07C8E', max: Math.max(...rs.p30) * 1.05, ref: A.ftp, refLabel: 'FTP' });
  if (A.hasHR) rows.push({ k: 'hr', label: 'Cardio', unit: 'bpm', color: '#E5484D', max: ST.R.hrmax, min: 80 });
  rows.push({ k: 'cad', label: 'Cadence', unit: 'tr/min', color: '#7FA8D6', max: 120, min: 0 });
  rows.push({ k: 'spd', label: 'Vitesse', unit: 'km/h', color: '#E8C547', max: Math.max(...rs.spd) * 3.6 * 1.05, min: 0, mul: 3.6 });
  const rh = 120, gap = 26; const H = rows.length * (rh + gap);
  const X = k => 50 + k / (N - 1) * (W - 70);
  let svg = '';
  rows.forEach((row, j) => {
    const y0 = j * (rh + gap) + 22; const mn = row.min || 0, mx = row.max || 1; const mul = row.mul || 1;
    const Y = v => y0 + rh - (Math.max(mn, Math.min(mx, v * mul)) - mn) / (mx - mn) * rh;
    let d = ''; for (let k = 0; k < N; k++) d += (k ? 'L' : 'M') + X(k).toFixed(1) + ' ' + Y(rs[row.k][k]).toFixed(1);
    svg += `<text x="50" y="${y0 - 6}" fill="#C9C4BF" font-size="15" font-family="Inter">${row.label}</text><text x="${W - 20}" y="${y0 - 6}" text-anchor="end" fill="#F4F1EE" font-size="15" font-family="Inter" font-weight="600" id="cv-${row.k}"></text>`;
    svg += `<rect x="50" y="${y0}" width="${W - 70}" height="${rh}" fill="#121215" rx="8"/>`;
    if (row.ref) svg += `<line x1="50" x2="${W - 20}" y1="${Y(row.ref)}" y2="${Y(row.ref)}" stroke="#EE8A3C" stroke-dasharray="6 6" opacity=".7"/><text x="${W - 24}" y="${Y(row.ref) - 6}" text-anchor="end" fill="#EE8A3C" font-size="13" font-family="Inter">${row.refLabel} ${Math.round(row.ref)} W</text>`;
    svg += `<path d="${d}" fill="none" stroke="${row.color}" stroke-width="1.6" stroke-linejoin="round"/>`;
  });
  svg += `<line id="curvCur" x1="0" x2="0" y1="16" y2="${H}" stroke="#F4F1EE" stroke-width="1.5" stroke-dasharray="4 5"/>`;
  $('#curvesBox').innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Courbes de puissance, cardio, cadence et vitesse">${svg}</svg>`;
  ST.curvRows = rows; ST.curvX = X;
}

/* ---------- Curseur synchronisé ---------- */
function setCursor(k) {
  const R = ST.R; const i = rideIdx(ST.cur); const A = R.analyses[i]; const rs = A.rs; k = Math.max(0, Math.min(rs.d.length - 1, k)); ST.cursor = k;
  if (BQ.onCursor) BQ.onCursor(rs.lat[k], rs.lon[k]);
  else if (ST.mapPr) { const [x, y] = ST.mapPr(rs.lat[k], rs.lon[k]); const g = $('#mapCur'); if (g) g.setAttribute('transform', `translate(${x},${y})`); }
  if (ST.profX) { const x = ST.profX(k); const l = $('#profCur'); if (l) { l.setAttribute('x1', x); l.setAttribute('x2', x); const dt = $('#profDot'); dt.setAttribute('cx', x); dt.setAttribute('cy', ST.profY(rs.alt[k])); } }
  if (ST.curvX) { const x = ST.curvX(k); const l = $('#curvCur'); if (l) { l.setAttribute('x1', x); l.setAttribute('x2', x); } ST.curvRows.forEach(row => { const el = $('#cv-' + row.k); if (el) el.textContent = Math.round(rs[row.k][k] * (row.mul || 1)) + ' ' + row.unit; }); }
  if (ST.three) ST.three.setCursor(k);
  const ro = $('#readout'); if (!ro) return;
  const t = rs.t[k];
  ro.innerHTML = `<span><strong>km ${nf1(rs.d[k] / 1000)}</strong> · ${mmss(t)}</span><span><strong>${Math.round(rs.alt[k])} m</strong> · pente ${nf1(rs.grade[k])} %</span>` +
    (A.hasPower ? `<span><strong>${Math.round(rs.p30[k])} W</strong> · ${nf1(rs.p30[k] / ST.profile.weight)} W/kg · ${Math.round(rs.p30[k] / A.ftp * 100)} % FTP</span>` : '') +
    (A.hasHR ? `<span><strong>${Math.round(rs.hr[k])} bpm</strong></span>` : '') + `<span><strong>${Math.round(rs.cad[k])} tr/min</strong></span><span><strong>${nf1(rs.spd[k] * 3.6)} km/h</strong></span>` +
    (A.windChunks ? (() => { const c = A.windChunks[Math.min(A.windChunks.length - 1, Math.floor(k / 10))]; if (!c) return ''; const h = c.head * 3.6; return `<span>${h > 4 ? '<strong style="color:#9DBFE4">Vent de face</strong> ' + Math.round(h) + ' km/h' : h < -4 ? '<strong style="color:#5FD497">Vent dans le dos</strong> ' + Math.round(-h) + ' km/h' : 'Vent de côté'}</span>`; })() : '');
}

/* ---------- 3D ---------- */
function init3D(el, r, A) {
  if (!window.THREE) { el.innerHTML = '<p class="muted" style="padding:30px">Vue 3D indisponible : la bibliothèque 3D n’a pas pu être chargée.</p>'; return null; }
  const T = window.THREE; const rs = A.rs; const N = rs.d.length;
  let la = Infinity, lb = -Infinity, lc = Infinity, ld = -Infinity; for (let k = 0; k < N; k++) { la = Math.min(la, rs.lat[k]); lb = Math.max(lb, rs.lat[k]); lc = Math.min(lc, rs.lon[k]); ld = Math.max(ld, rs.lon[k]); }
  const lat0 = (la + lb) / 2, lon0 = (lc + ld) / 2, cl = Math.cos(lat0 * RAD);
  const ext = Math.max((ld - lc) * 111320 * cl, (lb - la) * 111320, 1000); const S = 200 / ext;
  const demo = r.source === 'demo';
  let amin = A.altMin, amax = A.altMax;
  const altRange = Math.max(40, amax - amin); const exag = Math.max(3, Math.min(60, 0.1 * ext / altRange));
  const base = demo ? Math.min(amin, 0) : amin;
  const P = (lat, lon) => [(lon - lon0) * 111320 * cl * S, (lat0 - lat) * 111320 * S];
  const Yf = a => (a - base) * exag * S;
  $('#exagNote').textContent = `Relief exagéré ×${Math.round(exag)} · glisse pour tourner · molette pour zoomer`;
  const W = el.clientWidth || 1000, H = el.clientHeight || 440;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W, H); el.innerHTML = ''; el.appendChild(renderer.domElement);
  const scene = new T.Scene(); const cam = new T.PerspectiveCamera(40, W / H, 1, 5000);
  scene.add(new T.HemisphereLight(0xffffff, 0x1a1a1e, 0.85)); const dl = new T.DirectionalLight(0xffffff, 0.55); dl.position.set(120, 200, 80); scene.add(dl);
  if (demo) { // relief réel du terrain d'exemple
    const nx = 110, nz = 110; const m = 0.15; const wla = (lb - la) * (1 + 2 * m) + 0.01, wlo = (ld - lc) * (1 + 2 * m) + 0.015;
    const g = new T.BufferGeometry(); const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3); const idx = [];
    const c1 = new T.Color('#141417'), c2 = new T.Color('#3A2A30'), c3 = new T.Color('#7A4A55'); const tmp = new T.Color();
    for (let i = 0; i < nz; i++) for (let j = 0; j < nx; j++) {
      const lat = lb + (lb - la) * m + 0.005 - wla * i / (nz - 1), lon = lc - (ld - lc) * m - 0.0075 + wlo * j / (nx - 1);
      const a = B.terrainAlt(lat, lon); const [x, z] = P(lat, lon); const o = (i * nx + j) * 3;
      pos[o] = x; pos[o + 1] = Yf(a) - 0.4; pos[o + 2] = z;
      const f = Math.max(0, Math.min(1, (a - 10) / 170)); if (f < 0.35) tmp.copy(c1).lerp(c2, f / 0.35); else tmp.copy(c2).lerp(c3, (f - 0.35) / 0.65);
      col[o] = tmp.r; col[o + 1] = tmp.g; col[o + 2] = tmp.b;
      if (i < nz - 1 && j < nx - 1) { const q = i * nx + j; idx.push(q, q + nx, q + 1, q + 1, q + nx, q + nx + 1); }
    }
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    scene.add(new T.Mesh(g, new T.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0 })));
  } else {
    const grid = new T.GridHelper(260, 26, 0x2a2a30, 0x1c1c20); scene.add(grid);
  }
  // ruban coloré selon la pente (+ rideau sous le tracé)
  const pts = []; for (let k = 0; k < N; k++) { const [x, z] = P(rs.lat[k], rs.lon[k]); pts.push([x, Yf(rs.alt[k]) + 0.8, z]); }
  const rg = new T.BufferGeometry(); const rp = [], rc = [], ri = []; const cg = new T.BufferGeometry(); const cp = [], cc = [], ci = [];
  const w = 1.5; const tmpc = new T.Color();
  for (let k = 0; k < N; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(N - 1, k + 1)]; let dx = b[0] - a[0], dz = b[2] - a[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const p = pts[k]; rp.push(p[0] - dz * w, p[1], p[2] + dx * w, p[0] + dz * w, p[1], p[2] - dx * w);
    tmpc.set(B.colorGrade(rs.grade[k])); rc.push(tmpc.r, tmpc.g, tmpc.b, tmpc.r, tmpc.g, tmpc.b);
    cp.push(p[0], p[1], p[2], p[0], demo ? p[1] - 3 : 0, p[2]); cc.push(tmpc.r, tmpc.g, tmpc.b, tmpc.r * 0.2, tmpc.g * 0.2, tmpc.b * 0.2);
    if (k < N - 1) { const q = k * 2; ri.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); ci.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
  }
  rg.setAttribute('position', new T.Float32BufferAttribute(rp, 3)); rg.setAttribute('color', new T.Float32BufferAttribute(rc, 3)); rg.setIndex(ri);
  scene.add(new T.Mesh(rg, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide })));
  cg.setAttribute('position', new T.Float32BufferAttribute(cp, 3)); cg.setAttribute('color', new T.Float32BufferAttribute(cc, 3)); cg.setIndex(ci);
  scene.add(new T.Mesh(cg, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, transparent: true, opacity: demo ? 0.55 : 0.4 })));
  const marker = new T.Mesh(new T.SphereGeometry(2.6, 20, 14), new T.MeshBasicMaterial({ color: 0xF4F1EE })); scene.add(marker);
  const halo = new T.Mesh(new T.SphereGeometry(5, 20, 14), new T.MeshBasicMaterial({ color: 0xE07C8E, transparent: true, opacity: 0.3 })); scene.add(halo);
  const start = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 8, 16), new T.MeshBasicMaterial({ color: 0xF4F1EE })); start.position.set(pts[0][0], pts[0][1] + 4, pts[0][2]); scene.add(start);
  let maxY = 0; pts.forEach(p => { if (p[1] > maxY) maxY = p[1]; });
  const target = new T.Vector3(0, maxY * 0.25, 0); let th = -0.5, ph = 0.95, rad = 270, auto = true, run = true;
  const place = () => { cam.position.set(target.x + rad * Math.sin(ph) * Math.sin(th), target.y + rad * Math.cos(ph), target.z + rad * Math.sin(ph) * Math.cos(th)); cam.lookAt(target); };
  const cv = renderer.domElement; let drag = null;
  cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; auto = false; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drag) return; th -= (e.clientX - drag[0]) * 0.006; ph = Math.max(0.25, Math.min(1.45, ph - (e.clientY - drag[1]) * 0.005)); drag = [e.clientX, e.clientY]; });
  cv.addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); auto = false; rad = Math.max(70, Math.min(700, rad * (1 + e.deltaY * 0.001))); }, { passive: false });
  const ro = new ResizeObserver(() => { const w2 = el.clientWidth, h2 = el.clientHeight; if (w2 && h2) { renderer.setSize(w2, h2); cam.aspect = w2 / h2; cam.updateProjectionMatrix(); } }); ro.observe(el);
  const loop = () => { if (!run) return; if (!document.body.contains(el)) { run = false; return; } if (auto) th += 0.0015; place(); renderer.render(scene, cam); requestAnimationFrame(loop); };
  loop();
  return {
    setCursor(k) { const p = pts[Math.max(0, Math.min(N - 1, k))]; marker.position.set(p[0], p[1] + 2, p[2]); halo.position.copy(marker.position); },
    stop() { run = false; ro.disconnect(); renderer.dispose(); }
  };
}

/* ---------- Analyse complète ---------- */
function fullAnalysis(r, A) {
  const ph = ['Début', 'Milieu', 'Fin']; const t = A.thirds;
  const fade = t[0].avgP ? t[2].avgP / t[0].avgP : 1;
  const bar = (v, max, c) => `<div style="height:10px;border-radius:5px;background:#1B1B1E;overflow:hidden;margin-top:6px"><div style="height:100%;width:${Math.max(2, Math.min(100, v / max * 100))}%;background:${c}"></div></div>`;
  const maxP = Math.max(...t.map(x => x.avgP)) * 1.1 || 1;
  const phases = `<div class="grid g-3">${t.map((x, j) => `<div class="card"><div class="row" style="justify-content:space-between"><strong style="font-size:20px">${ph[j]}</strong><span class="muted" style="font-size:15px">km ${Math.round(A.dist / 3000 * j)}–${Math.round(A.dist / 3000 * (j + 1))}</span></div>
${A.hasPower ? `<div style="margin-top:12px"><span class="num" style="font-size:44px">${Math.round(x.avgP)}</span><span class="unit">W moy.</span>${bar(x.avgP, maxP, B.colorPower(x.avgP / A.ftp))}</div>` : ''}
<div class="row" style="margin-top:14px;gap:18px;font-size:16px"><span>${A.hasHR ? `<strong>${Math.round(x.hr)}</strong> bpm` : ''}</span><span><strong>${nf1(x.spd * 3.6)}</strong> km/h</span><span><strong>${Math.round(x.cad)}</strong> tr/min</span>${A.hasPower && A.hasHR ? `<span><strong>${x.EF.toFixed(2).replace('.', ',')}</strong> W/bpm ${ib('ef', true)}</span>` : ''}</div></div>`).join('')}</div>`;
  const tr = A.terrain; const tt = tr.plat.t + tr.montee.t + tr.descente.t || 1;
  const terr = `<div class="tbl" style="margin-top:14px"><table class="t"><thead><tr><th>Terrain</th><th>Temps</th><th>Part</th>${A.hasPower ? '<th>Puissance moy.</th>' : ''}<th>Vitesse moy.</th><th>Cadence</th></tr></thead><tbody>
${[['Plat (−2 à +2 %)', tr.plat, '#3FB97A'], ['Montée (> 2 %)', tr.montee, '#EE8A3C'], ['Descente (< −2 %)', tr.descente, '#7FA8D6']].map(([n, b, c]) => `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};margin-right:8px"></span>${n}</td><td>${durLong(b.t)}</td><td>${Math.round(b.t / tt * 100)} %</td>${A.hasPower ? `<td>${Math.round(b.avgP)} W</td>` : ''}<td>${nf1(b.avgV * 3.6)} km/h</td><td>${Math.round(b.avgC)} tr/min</td></tr>`).join('')}</tbody></table></div>`;
  const zt = A.zoneTime; const ztot = zt.reduce((a, b) => a + b, 0) || 1;
  const zcol = ['#2E8B5C', '#3FB97A', '#E8C547', '#EE8A3C', '#E5484D', '#C23A3F', '#9E2E33'];
  const zones = A.hasPower ? `<div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between"><strong style="font-size:20px">Temps dans chaque zone ${ib('zones', true)}</strong><span class="muted" style="font-size:15px">FTP utilisée : ${A.ftp} W ${ib('ftp', true)}</span></div>
<div class="zbar" style="margin-top:14px">${zt.map((v, z) => `<div style="width:${v / ztot * 100}%;background:${zcol[z]}" title="${B.ZONES[z].n}"></div>`).join('')}</div>
<div class="legend" style="margin-top:12px">${zt.map((v, z) => `<span><i style="background:${zcol[z]};width:12px;height:12px"></i>${B.ZONES[z].n} · ${Math.round(v / ztot * 100)} %</span>`).join('')}</div></div>` : '';
  const misc = `<div class="grid g-stats" style="margin-top:14px">
${A.hasPower ? tile('Intensité', 'if', `<span class="num">${A.IF.toFixed(2).replace('.', ',')}</span>`) : ''}
${A.hasPower ? tile('Variabilité', 'vi', `<span class="num">${A.VI.toFixed(2).replace('.', ',')}</span>`) : ''}
${A.decoupling != null ? tile('Décrochage cardiaque', 'dec', `<span class="num" style="color:${A.decoupling < 5 ? '#5FD497' : A.decoupling < 10 ? '#F2A062' : '#EF6B6F'}">${nf1(A.decoupling)}</span>`, '%') : ''}
${A.hasPower ? tile('Puissance fin / début', null, `<span class="num">${Math.round(fade * 100)}</span>`, '%') : ''}
${A.wind && A.wind.head.t ? tile('Vent de face · ' + durLong(A.wind.head.t), null, `<span class="num">${Math.round(A.wind.head.avgP)}</span>`, 'W') : ''}
${A.wind && A.wind.tail.t ? tile('Vent dans le dos · ' + durLong(A.wind.tail.t), null, `<span class="num">${Math.round(A.wind.tail.avgP)}</span>`, 'W') : ''}
${tile('Température moy.', null, numHTML(A.avgTemp, 0), '°C')}
${tile('Vitesse max', null, numHTML(A.maxSpeed * 3.6, 1), 'km/h')}
</div>`;
  return `<h3 style="font-size:24px;margin:0 0 14px">Par tiers de la sortie <span class="muted" style="font-size:16px;font-weight:400">· fin = ${Math.round(fade * 100)} % de la puissance du début</span></h3>${phases}${terr}${zones}${misc}`;
}

function segToday(r, A) {
  const prs = A.prs; let html = '';
  if (prs.length) html += `<div style="display:flex;flex-direction:column;gap:12px;margin-bottom:24px">${prs.map(p => `<div class="rec">${p.kind === 'power' ? ICON.bolt : ICON.trophy}<div class="nm"><strong style="font-size:21px">${esc(p.seg ? p.seg.name : p.label)}</strong><span class="muted" style="font-size:15px">Nouveau record personnel</span></div><span class="num" style="font-size:42px">${esc(p.value)}</span><span class="badge b-g">${esc(p.delta)}</span></div>`).join('')}</div>`;
  const effs = A.segEfforts.slice().sort((a, b) => (a.seg.type === b.seg.type ? a.e.kmStart - b.e.kmStart : a.seg.type === 'climb' ? -1 : 1));
  if (!effs.length) return html + '<p class="muted">Aucune côte ou portion déjà connue sur cette sortie.</p>';
  html += `<div class="tbl"><table class="t"><thead><tr><th>Côte / portion</th><th>Au km</th><th>Longueur</th><th>Temps</th>${A.hasPower ? '<th>Puissance</th>' : ''}<th>Classement</th><th>Vent</th></tr></thead><tbody>
${effs.map(x => { const sg = x.seg, e = x.e; const rk = x.passes === 1 ? '<span class="badge b-n">1er passage</span>' : x.isPR ? '<span class="badge b-g">Record</span>' : `<span class="badge b-n">${x.rankBefore}e / ${x.passes}</span>`; const delta = x.prevBest != null && !x.isPR ? ` <span class="muted" style="font-size:14px">(+${mmss(e.time - x.prevBest)})</span>` : '';
    return `<tr class="click" data-seg="${sg.id}" data-type="${sg.type}" tabindex="0"><td>${sg.type === 'climb' ? '▲ ' : ''}<strong>${esc(sg.name)}</strong>${sg.type === 'climb' ? ` <span class="muted" style="font-size:14px">${nf1(sg.grade)} %</span>` : ''}</td><td>${nf1(e.kmStart)}</td><td>${km(sg.len)} km</td><td><strong>${mmss(e.time)}</strong>${delta}</td>${A.hasPower ? `<td>${Math.round(e.avgP)} W · ${nf1(e.avgP / ST.profile.weight)} W/kg</td>` : ''}<td>${rk}</td><td>${windBadge(e.head)}</td></tr>`; }).join('')}</tbody></table></div>`;
  return html;
}
function windBadge(h) { if (h == null) return '<span class="muted">—</span>'; return h > 6 ? `<span class="badge b-b">Face ${Math.round(h)} km/h</span>` : h < -6 ? `<span class="badge b-g">Dos ${Math.round(-h)} km/h</span>` : '<span class="badge b-n">Côté</span>'; }

/* =====================================================================
   PAGE : TABLEAU DE BORD
   ===================================================================== */
function pageDash() {
  const R = ST.R; const pmc = R.pmc; const t = pmc[pmc.length - 1];
  const adv = B.weekAdvice(R.rides, R.analyses, pmc, { ftp: R.lastFtp });
  const last28 = R.rides.map((r, i) => [r, R.analyses[i]]).filter(([r]) => new Date(r.date) > new Date(R.rides[R.rides.length - 1].date).getTime() - 28 * 86400000);
  const sum = f => last28.reduce((a, x) => a + f(x[1]), 0);
  const zt = new Array(7).fill(0); const lastT = new Date(R.rides[R.rides.length - 1].date).getTime();
  R.rides.forEach((r, i) => { if (new Date(r.date).getTime() > lastT - 14 * 86400000) R.analyses[i].zoneTime.forEach((v, z) => zt[z] += v); });
  const ztot = zt.reduce((a, b) => a + b, 0) || 1; const low = (zt[0] + zt[1]) / ztot, mid = (zt[2] + zt[3]) / ztot, hi = (zt[4] + zt[5] + zt[6]) / ztot;
  const tsbTxt = t.tsb < -25 ? 'Tu es bien chargé' : t.tsb < -10 ? 'Tu travailles bien' : t.tsb < 5 ? 'Équilibré' : 'Tu es frais';
  return `<section class="wrap" style="padding-top:60px"><span class="eyebrow">Tableau de bord</span><h1 class="huge">${tsbTxt}.</h1>
<p class="lead" style="margin-top:12px">Ta forme du moment, calculée à partir de la charge de toutes tes sorties.</p>
<div class="grid g-stats" style="margin-top:30px">
${tile('Condition de fond', 'ctl', numHTML(t.ctl), '')}
${tile('Fatigue', 'atl', numHTML(t.atl), '')}
${tile('Fraîcheur', 'tsb', `<span class="num" style="color:${t.tsb < -25 ? '#EF6B6F' : t.tsb < 5 ? '#F2A062' : '#5FD497'}">${t.tsb > 0 ? '+' : ''}${Math.round(t.tsb)}</span>`)}
${tile('FTP estimée', 'ftp', numHTML(R.lastFtp), 'W')}
${tile('Watts par kilo', 'wkg', numHTML(R.lastFtp / ST.profile.weight, 2), 'W/kg')}
${tile('4 dernières semaines', 'dist', numHTML(sum(a => a.dist) / 1000), 'km')}
${tile('Heures (4 sem.)', 'time', numHTML(sum(a => a.moving) / 3600, 1), 'h')}
${tile('D+ (4 sem.)', 'dplus', numHTML(sum(a => a.gain)), 'm')}
</div></section>
<section class="wrap sec"><div class="sec-head reveal"><div><span class="eyebrow">Les conseils de la semaine</span><h2 class="big">Ce que tu fais ensuite.</h2></div></div>
<div class="grid g-3">${adv.map(advCard).join('')}</div></section>
<section class="wrap sec reveal"><div class="sec-head"><div><span class="eyebrow">Forme, fatigue, fraîcheur</span><h2 class="big">Ta courbe de forme.</h2></div><span class="muted" style="font-size:15px">${ib('ctl', true)} ${ib('atl', true)} ${ib('tsb', true)}</span></div>
<div class="panel" style="padding:20px"><canvas class="chart" id="cPmc" height="320"></canvas></div></section>
<section class="wrap sec reveal"><div class="grid g-2">
<div><span class="eyebrow">Volume</span><h2 class="big" style="font-size:52px">Par semaine.</h2><div class="panel" style="padding:20px;margin-top:18px"><canvas class="chart" id="cVol" height="300"></canvas></div></div>
<div><span class="eyebrow">Progression</span><h2 class="big" style="font-size:52px">Ta FTP.</h2><div class="panel" style="padding:20px;margin-top:18px"><canvas class="chart" id="cFtp" height="300"></canvas></div></div>
</div></section>
<section class="wrap sec reveal"><div class="sec-head"><div><span class="eyebrow">Répartition des intensités · 14 jours</span><h2 class="big">Facile, moyen, dur.</h2></div></div>
<div class="card"><div class="zbar" style="height:34px;border-radius:17px"><div style="width:${low * 100}%;background:#3FB97A"></div><div style="width:${mid * 100}%;background:#E8C547"></div><div style="width:${hi * 100}%;background:#E5484D"></div></div>
<div class="row" style="margin-top:18px;gap:30px"><div><span class="num" style="color:#5FD497">${Math.round(low * 100)}</span><span class="unit">% facile (Z1–Z2)</span></div><div><span class="num" style="color:#E8C547">${Math.round(mid * 100)}</span><span class="unit">% moyen (Z3–Z4)</span></div><div><span class="num" style="color:#EF6B6F">${Math.round(hi * 100)}</span><span class="unit">% dur (Z5+)</span></div></div>
<p class="muted" style="margin:16px 0 0;font-size:16px">Repère : les meilleurs athlètes d’endurance passent environ 80 % de leur temps en facile (<a href="${B.SOURCES.seiler.u}" target="_blank" rel="noopener">Dr Stephen Seiler</a>).</p></div></section>`;
}
pageDash.after = function () {
  if (!window.Chart) return; const R = ST.R; setupChart();
  const pmc = R.pmc.slice(-70);
  ST.charts.push(new Chart($('#cPmc'), { type: 'line', data: { labels: pmc.map(p => dShort(p.date + 'T12:00:00Z')), datasets: [
    { label: 'Condition de fond (CTL)', data: pmc.map(p => p.ctl), borderColor: '#7FA8D6', backgroundColor: 'rgba(127,168,214,.12)', fill: true, tension: .3, pointRadius: 0, borderWidth: 3 },
    { label: 'Fatigue (ATL)', data: pmc.map(p => p.atl), borderColor: '#E07C8E', tension: .3, pointRadius: 0, borderWidth: 2 },
    { label: 'Fraîcheur (TSB)', data: pmc.map(p => p.tsb), borderColor: '#E8C547', tension: .3, pointRadius: 0, borderWidth: 2, borderDash: [6, 4] }] },
    options: chartOpts({ y: { title: 'Points' } }) }));
  const weeks = {}; R.rides.forEach((r, i) => { const d = new Date(r.date); const day = (d.getUTCDay() + 6) % 7; const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)); const k = mon.toISOString().slice(0, 10); weeks[k] = weeks[k] || { km: 0, h: 0, dp: 0 }; weeks[k].km += R.analyses[i].dist / 1000; weeks[k].h += R.analyses[i].moving / 3600; weeks[k].dp += R.analyses[i].gain; });
  const wk = Object.keys(weeks).sort();
  ST.charts.push(new Chart($('#cVol'), { type: 'bar', data: { labels: wk.map(k => 'sem. ' + dShort(k + 'T12:00:00Z')), datasets: [{ label: 'Kilomètres', data: wk.map(k => Math.round(weeks[k].km)), backgroundColor: '#8E2438', borderRadius: 8, yAxisID: 'y' }, { label: 'Dénivelé (m)', data: wk.map(k => Math.round(weeks[k].dp)), type: 'line', borderColor: '#E8C547', pointRadius: 3, yAxisID: 'y2', tension: .3 }] },
    options: chartOpts({ y: { title: 'km', zero: true }, y2: { title: 'm de D+', right: true, zero: true } }) }));
  const pts = R.rides.map(r => ({ x: dShort(r.date), y: R.ftpAt(r.date) }));
  const o = chartOpts({ y: { title: 'W' } }); o.scales.y.suggestedMin = Math.round(R.lastFtp * 0.6); o.scales.y.suggestedMax = Math.round(R.lastFtp * 1.12);
  ST.charts.push(new Chart($('#cFtp'), { type: 'line', data: { labels: pts.map(p => p.x), datasets: [{ label: 'FTP estimée (W)', data: pts.map(p => p.y), borderColor: '#E07C8E', backgroundColor: 'rgba(224,124,142,.12)', fill: true, stepped: true, pointRadius: 0, borderWidth: 3 }, { label: 'Meilleurs 20 min de la sortie', data: R.b20.map(Math.round), borderColor: 'transparent', backgroundColor: '#E8C547', pointRadius: 4, showLine: false }] }, options: o }));
};
function setupChart() { Chart.defaults.color = '#C9C4BF'; Chart.defaults.font.family = 'Inter'; Chart.defaults.font.size = 14; Chart.defaults.borderColor = '#222226'; }
function chartOpts(ax) {
  const scales = { x: { grid: { color: '#1A1A1E' }, ticks: { maxRotation: 0, autoSkipPadding: 18 } } };
  for (const k in ax) scales[k] = { position: ax[k].right ? 'right' : 'left', grid: { color: ax[k].right ? 'transparent' : '#1A1A1E' }, title: { display: !!ax[k].title, text: ax[k].title }, type: ax[k].type || 'linear', beginAtZero: ax[k].zero };
  return { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { boxWidth: 14, padding: 16 } }, tooltip: { backgroundColor: '#1F1F23', borderColor: '#3A3A40', borderWidth: 1, padding: 12 } }, scales };
}

/* =====================================================================
   PAGE : RECORDS
   ===================================================================== */
function pageRecords() {
  const R = ST.R; const N = R.rides.length;
  const best = (f, cmp) => { let bi = -1, bv = null; R.analyses.forEach((A, i) => { const v = f(A); if (v == null || !isFinite(v)) return; if (bv == null || cmp(v, bv)) { bv = v; bi = i; } }); return bi < 0 ? null : { v: bv, r: R.rides[bi] }; };
  const recLink = (r) => `<button class="btn" data-ride="${r.id}" style="padding:8px 14px;min-height:40px">${dShort(r.date)}</button>`;
  const powerRows = B.POWER_DURS.map(([w, l]) => { const b = best(A => A.best[w].v || null, (a, c) => a > c); return b ? `<div class="rec">${ICON.bolt}<div class="nm"><strong style="font-size:20px">Meilleure puissance · ${l}</strong><span class="muted" style="font-size:15px">${nf1(b.v / ST.profile.weight)} W/kg</span></div><span class="num" style="font-size:42px">${Math.round(b.v)} W</span>${recLink(b.r)}</div>` : ''; }).join('');
  const distRows = B.DIST_RECS.map(([D, l]) => { const b = best(A => A.bestDist[D] ? A.bestDist[D].t : null, (a, c) => a < c); return b ? `<div class="rec">${ICON.trophy}<div class="nm"><strong style="font-size:20px">Meilleur temps · ${l}</strong><span class="muted" style="font-size:15px">${nf1(D / b.v * 3.6)} km/h de moyenne</span></div><span class="num" style="font-size:42px">${durLong(b.v)}</span>${recLink(b.r)}</div>` : ''; }).join('');
  const lg = best(A => A.dist, (a, c) => a > c), dp = best(A => A.gain, (a, c) => a > c), sp = best(A => A.dist > 60000 ? A.avgSpeed : null, (a, c) => a > c), ts = best(A => A.TSS, (a, c) => a > c);
  const misc = [[ICON.road, 'Plus longue sortie', lg && km(lg.v) + ' km', lg], [ICON.hill, 'Plus gros dénivelé', dp && nf0(dp.v) + ' m', dp], [ICON.trophy, 'Plus rapide (> 60 km)', sp && nf1(sp.v * 3.6) + ' km/h', sp], [ICON.bolt, 'Plus grosse charge', ts && 'TSS ' + Math.round(ts.v), ts]].filter(x => x[3]).map(([ic, l, v, b]) => `<div class="rec">${ic}<div class="nm"><strong style="font-size:20px">${l}</strong></div><span class="num" style="font-size:42px">${v}</span>${recLink(b.r)}</div>`).join('');
  return `<section class="wrap" style="padding-top:60px"><span class="eyebrow">Records</span><h1 class="huge">Ce dont tu es capable.</h1><p class="lead" style="margin-top:12px">Tes meilleures performances sur ${N} sorties.</p></section>
<section class="wrap sec reveal"><div class="sec-head"><div><span class="eyebrow">Courbe de puissance</span><h2 class="big">Tes watts, de 5 s à 2 h.</h2></div></div>
<div class="panel" style="padding:20px"><canvas class="chart" id="cCurve" height="340"></canvas></div>
<p class="muted" style="font-size:16px">Ta FTP estimée (${R.lastFtp} W) = 95 % de ta meilleure puissance sur 20 min des 6 dernières semaines (<a href="${B.SOURCES.tpgloss.u}" target="_blank" rel="noopener">méthode TrainingPeaks</a>).</p></section>
<section class="wrap sec reveal"><div class="grid g-2"><div><span class="eyebrow">Puissance</span><div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">${powerRows}</div></div>
<div><span class="eyebrow">Distance</span><div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">${distRows}${misc}</div></div></div></section>`;
}
pageRecords.after = function () {
  document.querySelectorAll('[data-ride]').forEach(b => b.addEventListener('click', () => go('sortie', b.dataset.ride)));
  if (!window.Chart) return; setupChart(); const R = ST.R; const lastT = new Date(R.rides[R.rides.length - 1].date).getTime();
  const all = R.durs.map((w, j) => Math.max(...R.analyses.map(A => A.curve[j].v)));
  const rec = R.durs.map((w, j) => Math.max(0, ...R.analyses.filter((A, i) => new Date(R.rides[i].date).getTime() > lastT - 30 * 86400000).map(A => A.curve[j].v)));
  const lab = d => d < 60 ? d + ' s' : d < 3600 ? (d / 60) + ' min' : (d / 3600).toString().replace('.', ',') + ' h';
  ST.charts.push(new Chart($('#cCurve'), { type: 'line', data: { labels: R.durs.map(lab), datasets: [
    { label: 'Record absolu', data: all.map(Math.round), borderColor: '#E07C8E', backgroundColor: 'rgba(224,124,142,.14)', fill: true, tension: .35, pointRadius: 4, borderWidth: 3 },
    { label: '30 derniers jours', data: rec.map(Math.round), borderColor: '#7FA8D6', tension: .35, pointRadius: 3, borderWidth: 2, borderDash: [6, 4] }] }, options: chartOpts({ y: { title: 'Watts' } }) }));
};

/* =====================================================================
   PAGE : SEGMENTS
   ===================================================================== */
function pageSegments() {
  const R = ST.R; const segs = R.segments.filter(s => s.type === ST.segTab).sort((a, b) => b.efforts.length - a.efforts.length || a.name.localeCompare(b.name));
  const nC = R.segments.filter(s => s.type === 'climb').length, nP = R.segments.filter(s => s.type === 'portion').length;
  const list = segs.map(sg => {
    const best = sg.efforts[0]; const last = sg.efforts.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0]; const open = ST.openSeg === sg.id;
    const effRows = sg.efforts.slice().sort((a, b) => a.date < b.date ? 1 : -1).map(e => `<tr class="click" data-ride="${e.ride}" tabindex="0"><td>${cap(dFmt(e.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</td><td><strong>${mmss(e.time)}</strong></td><td>${nf1(sg.len / e.time * 3.6)} km/h</td><td>${e.avgP ? Math.round(e.avgP) + ' W · ' + nf1(e.avgP / ST.profile.weight) + ' W/kg' : '—'}</td><td>${e.hr ? Math.round(e.hr) + ' bpm' : '—'}</td><td>${windBadge(e.head)}</td><td>${e.rank === 1 ? '<span class="badge b-a">1er</span>' : `<span class="badge b-n">${e.rank}e</span>`}</td></tr>`).join('');
    return `<article class="card reveal" style="padding:0;overflow:hidden"><button type="button" data-open="${sg.id}" aria-expanded="${open}" style="all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-wrap:wrap;gap:18px;align-items:center;padding:22px 24px;width:100%">
${sg.type === 'climb' ? ICON.hill : ICON.road}<div style="flex:1 1 260px;display:flex;flex-direction:column;gap:2px"><strong style="font-size:22px">${esc(sg.name)}</strong><span class="muted" style="font-size:15px">${km(sg.len)} km${sg.type === 'climb' ? ` · ${nf1(sg.grade)} % · +${Math.round(sg.gain)} m` : sg.gain ? ` · D+ ${Math.round(sg.gain)} m` : ''} · ${sg.efforts.length} passage${sg.efforts.length > 1 ? 's' : ''}</span></div>
<div style="display:flex;flex-direction:column;align-items:flex-end"><span class="muted" style="font-size:14px">Record</span><span class="num" style="font-size:40px">${mmss(best.time)}</span></div>
<div style="display:flex;flex-direction:column;align-items:flex-end;min-width:110px"><span class="muted" style="font-size:14px">Dernier</span><span style="font-size:22px;font-weight:600">${mmss(last.time)}</span></div><span aria-hidden="true" style="font-size:22px;color:#C9C4BF">${open ? '▴' : '▾'}</span></button>
${open ? `<div class="tbl" style="border:none;border-top:1px solid var(--line);border-radius:0"><table class="t"><thead><tr><th>Date</th><th>Temps</th><th>Vitesse</th><th>Puissance</th><th>Cardio</th><th>Vent</th><th>Rang</th></tr></thead><tbody>${effRows}</tbody></table></div>
${sg.efforts.length > 1 ? `<div style="padding:18px 24px" class="muted">${segComment(sg)}</div>` : ''}` : ''}</article>`;
  }).join('');
  return `<section class="wrap" style="padding-top:60px"><span class="eyebrow">Segments</span><h1 class="huge">Tes terrains de jeu.</h1>
<p class="lead" style="margin-top:12px">Les côtes sont détectées automatiquement, et les portions de route que tu as parcourues plusieurs fois deviennent des segments, même si le reste de la sortie change.</p>
<div class="toggle" role="group" aria-label="Type de segment" style="margin-top:26px"><button type="button" data-tab="climb" class="${ST.segTab === 'climb' ? 'on' : ''}" aria-pressed="${ST.segTab === 'climb'}">Côtes (${nC})</button><button type="button" data-tab="portion" class="${ST.segTab === 'portion' ? 'on' : ''}" aria-pressed="${ST.segTab === 'portion'}">Portions répétées (${nP})</button></div></section>
<section class="wrap" style="padding-top:26px;display:flex;flex-direction:column;gap:12px">${list || '<p class="muted">Aucun segment pour l’instant.</p>'}</section>`;
}
function segComment(sg) {
  const e = sg.efforts; const best = e[0]; const withW = e.filter(x => x.head != null);
  let s = `Ton record date du ${dFmt(best.date, { day: 'numeric', month: 'long' })}.`;
  if (best.head != null && best.head < -6) s += ' Attention : ce jour-là, tu avais le vent dans le dos.';
  if (withW.length >= 2 && best.avgP) { const bp = e.slice().sort((a, b) => b.avgP / b.ftp - a.avgP / a.ftp)[0]; if (bp !== best) s += ` Ton plus gros effort (${Math.round(bp.avgP)} W) a été fourni le ${dFmt(bp.date, { day: 'numeric', month: 'long' })}, avec ${bp.head > 6 ? 'du vent de face' : 'un vent neutre'} : c’est peut-être ta meilleure performance réelle.`; }
  return s;
}
pageSegments.after = function () {
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { ST.segTab = b.dataset.tab; ST.openSeg = null; route(); }));
  document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { ST.openSeg = ST.openSeg === b.dataset.open ? null : b.dataset.open; const y = window.scrollY; route(); window.scrollTo(0, y); }));
  document.querySelectorAll('[data-ride]').forEach(b => { b.addEventListener('click', () => go('sortie', b.dataset.ride)); b.addEventListener('keydown', e => { if (e.key === 'Enter') go('sortie', b.dataset.ride); }); });
  if (ST.openSeg) { const el = document.querySelector(`[data-open="${ST.openSeg}"]`); if (el) setTimeout(() => el.scrollIntoView({ block: 'center' }), 50); }
};

/* =====================================================================
   PAGE : COMPARER
   ===================================================================== */
function pageCompare() {
  const R = ST.R; const n = R.rides.length;
  if (n < 2) return `<section class="wrap" style="padding-top:60px"><h1 class="huge">Il faut au moins deux sorties.</h1></section>`;
  if (!ST.cmpB || rideIdx(ST.cmpB) < 0) ST.cmpB = R.rides[n - 1].id;
  if (!ST.cmpA || rideIdx(ST.cmpA) < 0 || ST.cmpA === ST.cmpB) { const b = R.rides[rideIdx(ST.cmpB)]; const base = b.name.replace(' (sens inverse)', ''); const same = R.rides.filter(r => r.id !== b.id && r.date < b.date && r.name === b.name); ST.cmpA = (same.length ? same[same.length - 1] : R.rides[Math.max(0, rideIdx(ST.cmpB) - 1)]).id; if (ST.cmpA === ST.cmpB) ST.cmpA = R.rides[0].id; void base; }
  const i1 = rideIdx(ST.cmpA), i2 = rideIdx(ST.cmpB); const r1 = R.rides[i1], r2 = R.rides[i2], A1 = R.analyses[i1], A2 = R.analyses[i2];
  const opts = sel => R.rides.slice().reverse().map(r => `<option value="${r.id}"${r.id === sel ? ' selected' : ''}>${cap(dFmt(r.date, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${esc(r.name)} · ${km(R.analyses[rideIdx(r.id)].dist)} km</option>`).join('');
  const rows = [
    ['Distance', a => a.dist / 1000, v => nf1(v) + ' km', 0], ['Temps de roulage', a => a.moving, v => durLong(v), 0], ['Dénivelé', a => a.gain, v => nf0(v) + ' m', 0],
    ['Vitesse moyenne', a => a.avgSpeed * 3.6, v => nf1(v) + ' km/h', 1], ['Puissance moyenne', a => a.avgP, v => nf0(v) + ' W', 1], ['Puissance normalisée', a => a.NP, v => nf0(v) + ' W', 1, 'np'],
    ['Intensité (IF)', a => a.IF, v => v.toFixed(2).replace('.', ','), 0, 'if'], ['Variabilité (VI)', a => a.VI, v => v.toFixed(2).replace('.', ','), -1, 'vi'], ['Score de charge', a => a.TSS, v => nf0(v), 0, 'tss'],
    ['Cardio moyen', a => a.avgHR, v => nf0(v) + ' bpm', -1], ['Efficacité (W/bpm)', a => a.avgHR ? a.NP / a.avgHR : 0, v => v.toFixed(2).replace('.', ','), 1, 'ef'], ['Décrochage cardiaque', a => a.decoupling, v => v == null ? '—' : nf1(v) + ' %', -1, 'dec'],
    ['Cadence moyenne', a => a.avgCad, v => nf0(v) + ' tr/min', 0], ['Fin vs début', a => a.thirds[2].avgP / a.thirds[0].avgP * 100, v => nf0(v) + ' %', 1], ['Température', a => a.avgTemp, v => nf0(v) + ' °C', 0]
  ];
  const better = (v1, v2, dir) => dir === 0 || v1 == null || v2 == null || Math.abs(v1 - v2) < 1e-6 ? ['', ''] : (dir > 0 ? v1 > v2 : v1 < v2) ? ['color:#5FD497;font-weight:600', ''] : ['', 'color:#5FD497;font-weight:600'];
  const table = rows.map(([l, f, fmt, dir, tip]) => { const v1 = f(A1), v2 = f(A2); const [s1, s2] = better(v1, v2, dir); return `<tr><td>${l}${tip ? ib(tip, true) : ''}</td><td style="${s1}">${fmt(v1)}</td><td style="${s2}">${fmt(v2)}</td></tr>`; }).join('') +
    `<tr><td>Vent</td><td>${r1.wind ? r1.wind.kmh + ' km/h ' + dirName(r1.wind.dir) : '—'}</td><td>${r2.wind ? r2.wind.kmh + ' km/h ' + dirName(r2.wind.dir) : '—'}</td></tr><tr><td>Vélo</td><td>${esc(bikeName(r1.bike))}</td><td>${esc(bikeName(r2.bike))}</td></tr>`;
  const common = R.segments.map(sg => ({ sg, e1: sg.efforts.find(e => e.ride === r1.id), e2: sg.efforts.find(e => e.ride === r2.id) })).filter(x => x.e1 && x.e2);
  const lines = B.compareText(A1, A2, r1, r2);
  return `<section class="wrap" style="padding-top:60px"><span class="eyebrow">Comparer</span><h1 class="huge">Deux sorties, face à face.</h1>
<p class="lead" style="margin-top:12px">Même si les parcours sont différents, on compare ce qui est comparable : le début contre le début, la fin contre la fin, les montées contre les montées.</p>
<div class="grid g-2" style="margin-top:26px"><div class="field"><label for="cA">Sortie 1</label><select id="cA">${opts(ST.cmpA)}</select></div><div class="field"><label for="cB">Sortie 2</label><select id="cB">${opts(ST.cmpB)}</select></div></div></section>
${lines.length ? `<section class="wrap sec reveal" style="padding-top:40px"><div class="card" style="border-color:#3A2A30"><span class="eyebrow">La lecture du coach</span><ul style="margin:12px 0 0;padding-left:22px;display:flex;flex-direction:column;gap:10px;font-size:18px">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div></section>` : ''}
<section class="wrap sec reveal" style="padding-top:40px"><div class="grid g-2">
<div><h3 style="font-size:24px;margin:0 0 14px">Puissance par tiers</h3><div class="panel" style="padding:18px"><canvas class="chart" id="cPh" height="280"></canvas></div></div>
<div><h3 style="font-size:24px;margin:0 0 14px">Efficacité par tiers ${ib('ef', true)}</h3><div class="panel" style="padding:18px"><canvas class="chart" id="cEf" height="280"></canvas></div></div></div></section>
<section class="wrap sec reveal" style="padding-top:40px"><div class="grid g-2">
<div><h3 style="font-size:24px;margin:0 0 14px">Les chiffres</h3><div class="tbl"><table class="t"><thead><tr><th></th><th>Sortie 1 · ${dShort(r1.date)}</th><th>Sortie 2 · ${dShort(r2.date)}</th></tr></thead><tbody>${table}</tbody></table></div></div>
<div><h3 style="font-size:24px;margin:0 0 14px">Par terrain</h3><div class="tbl"><table class="t"><thead><tr><th></th><th>Sortie 1</th><th>Sortie 2</th></tr></thead><tbody>
${[['Plat', 'plat'], ['Montée', 'montee'], ['Descente', 'descente']].map(([n, k]) => `<tr><td>${n}</td><td>${Math.round(A1.terrain[k].avgP)} W · ${nf1(A1.terrain[k].avgV * 3.6)} km/h</td><td>${Math.round(A2.terrain[k].avgP)} W · ${nf1(A2.terrain[k].avgV * 3.6)} km/h</td></tr>`).join('')}</tbody></table></div>
<h3 style="font-size:24px;margin:26px 0 14px">Segments en commun (${common.length})</h3>${common.length ? `<div class="tbl"><table class="t"><thead><tr><th></th><th>Sortie 1</th><th>Sortie 2</th></tr></thead><tbody>${common.map(x => { const d = x.e2.time - x.e1.time; return `<tr><td>${esc(x.sg.name)}</td><td>${mmss(x.e1.time)} ${windBadge(x.e1.head)}</td><td>${mmss(x.e2.time)} <span style="color:${d < 0 ? '#5FD497' : '#F2A062'};font-size:14px">${d < 0 ? '−' : '+'}${mmss(Math.abs(d))}</span> ${windBadge(x.e2.head)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">Aucune côte ou portion en commun : la comparaison se fait par tiers et par terrain.</p>'}
</div></div></section>`;
}
pageCompare.after = function () {
  $('#cA').addEventListener('change', e => { ST.cmpA = e.target.value; route(); });
  $('#cB').addEventListener('change', e => { ST.cmpB = e.target.value; route(); });
  if (!window.Chart) return; setupChart(); const R = ST.R; const A1 = R.analyses[rideIdx(ST.cmpA)], A2 = R.analyses[rideIdx(ST.cmpB)];
  const labels = ['Début', 'Milieu', 'Fin'];
  const ds = (A, l, c, f) => ({ label: l, data: A.thirds.map(f), backgroundColor: c, borderRadius: 8 });
  ST.charts.push(new Chart($('#cPh'), { type: 'bar', data: { labels, datasets: [ds(A1, 'Sortie 1', '#7FA8D6', t => Math.round(t.avgP)), ds(A2, 'Sortie 2', '#E07C8E', t => Math.round(t.avgP))] }, options: chartOpts({ y: { title: 'W moyens', zero: true } }) }));
  ST.charts.push(new Chart($('#cEf'), { type: 'bar', data: { labels, datasets: [ds(A1, 'Sortie 1', '#7FA8D6', t => +t.EF.toFixed(2)), ds(A2, 'Sortie 2', '#E07C8E', t => +t.EF.toFixed(2))] }, options: chartOpts({ y: { title: 'W par battement' } }) }));
};

/* =====================================================================
   PAGE : HISTORIQUE (+ import FIT)
   ===================================================================== */
function pageHistory() {
  const R = ST.R; const rows = R ? R.rides.map((r, i) => [r, R.analyses[i]]).reverse() : [];
  const fBike = ST.histBike || '';
  const list = rows.filter(([r]) => !fBike || r.bike === fBike).map(([r, A]) => `<tr class="click" data-ride="${r.id}" tabindex="0"><td>${cap(dFmt(r.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</td><td><strong>${esc(r.name)}</strong>${r.source === 'fit' && !BQ.desktop ? ' <span class="badge b-a">Importée</span>' : ''}${r.workout ? ` <span class="badge b-n">${esc(r.workout)}</span>` : ''}</td><td>${km(A.dist)} km</td><td>${durLong(A.moving)}</td><td>${nf0(A.gain)} m</td><td>${A.hasPower ? Math.round(A.NP) + ' W' : '—'}</td><td>${A.hasPower ? Math.round(A.TSS) : '—'}</td><td>${esc(bikeName(r.bike))}</td></tr>`).join('');
  return `<section class="wrap" style="padding-top:60px"><span class="eyebrow">Historique</span><h1 class="huge">Toutes tes sorties.</h1></section>
<section class="wrap" style="padding-top:30px"><div class="drop" id="drop">
<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#E07C8E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16 V4 M7 9 L12 4 L17 9"/><path d="M4 16 V19 a1 1 0 0 0 1 1 H19 a1 1 0 0 0 1 -1 V16"/></svg>
<strong style="font-size:22px">Importer des sorties du compteur</strong>
<span class="muted" style="font-size:16px;max-width:560px">${BQ.desktop ? 'Tes sorties s’importent toutes seules dès que tu branches le compteur. Tu peux aussi glisser ici des fichiers .FIT, ou les choisir.' : 'Glisse ici les fichiers .FIT du dossier <code>Garmin/Activity</code> du compteur, ou choisis-les. Dans le logiciel final, cette étape sera automatique au branchement.'}</span>
${BQ.desktop ? '<button type="button" class="btn pri" id="fitPick">Choisir des fichiers .FIT</button>' : '<label class="btn pri" for="fitIn" style="cursor:pointer">Choisir des fichiers .FIT</label>'}<input type="file" id="fitIn" accept=".fit,.FIT" multiple style="position:absolute;opacity:0;width:1px;height:1px">
<div id="impMsg" role="status" style="font-size:16px"></div></div>
${ST.imported.length && !BQ.desktop ? `<div class="row" style="margin-top:14px"><label class="row" style="font-size:16px;gap:10px;cursor:pointer"><input type="checkbox" id="showDemo" ${ST.showDemo ? 'checked' : ''} style="width:22px;height:22px"> Afficher aussi les sorties d’exemple</label></div>` : ''}
${BQ.desktop ? '' : '<p class="muted" style="font-size:15px;margin-top:12px">Dans ce prototype, les fichiers importés restent dans ta page tant qu’elle est ouverte ; ils ne sont envoyés nulle part.</p>'}</section>
<section class="wrap" style="padding-top:30px"><div class="row" style="justify-content:space-between;margin-bottom:14px"><strong style="font-size:22px">${rows.length} sorties</strong>
<div class="row"><label for="hb" class="muted" style="font-size:15px">Vélo</label><select id="hb" class="sel"><option value="">Tous les vélos</option>${ST.bikes.map(b => `<option value="${b.id}"${b.id === fBike ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div></div>
<div class="tbl"><table class="t"><thead><tr><th>Date</th><th>Sortie</th><th>Distance</th><th>Temps</th><th>D+</th><th>NP</th><th>TSS</th><th>Vélo</th></tr></thead><tbody>${list || '<tr><td colspan="8" class="muted">Aucune sortie.</td></tr>'}</tbody></table></div></section>`;
}
pageHistory.after = function () {
  document.querySelectorAll('[data-ride]').forEach(b => { b.addEventListener('click', () => go('sortie', b.dataset.ride)); b.addEventListener('keydown', e => { if (e.key === 'Enter') go('sortie', b.dataset.ride); }); });
  const hb = $('#hb'); if (hb) hb.addEventListener('change', e => { ST.histBike = e.target.value; route(); });
  const sd = $('#showDemo'); if (sd) sd.addEventListener('change', e => { ST.showDemo = e.target.checked; ST.cur = null; recompute(); route(); });
  const drop = $('#drop'), inp = $('#fitIn');
  inp.addEventListener('change', () => importFiles(inp.files));
  const pk = $('#fitPick'); if (pk) pk.addEventListener('click', () => BQ.pickFiles());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); importFiles(e.dataTransfer.files); });
};
async function importFiles(files) {
  if (BQ.importFiles) return BQ.importFiles(files);
  const msg = $('#impMsg'); let ok = 0; const errs = []; let lastId = null;
  for (const f of Array.from(files || [])) {
    try {
      const buf = await f.arrayBuffer(); const p = B.parseFIT(buf);
      if (p.sport != null && p.sport !== 2) { errs.push(`${f.name} : ce n’est pas une sortie vélo.`); continue; }
      const id = 'fit-' + p.start.getTime();
      if (ST.imported.some(r => r.id === id)) continue;
      ST.imported.push({ id, source: 'fit', date: p.start.toISOString(), name: 'Sortie importée (' + f.name.replace(/\.fit$/i, '') + ')', bike: ST.bikes[0] ? ST.bikes[0].id : null, wind: null, temp: null, s: p.s });
      ok++; lastId = id;
    } catch (e) { errs.push(`${f.name} : ${e.message}`); }
  }
  if (ok) { recompute(); ST.cur = lastId; msg.innerHTML = `<span style="color:#5FD497">${ok} sortie${ok > 1 ? 's importées' : ' importée'}.</span> <a href="#sortie">Voir l’analyse →</a>`; }
  if (errs.length) msg.innerHTML += `<div style="color:#F2A062;margin-top:6px">${errs.map(esc).join('<br>')}</div>`;
  if (ok) setTimeout(() => go('sortie', lastId), 600);
}

/* =====================================================================
   PAGE : MATÉRIEL
   ===================================================================== */
function pageGear() {
  const R = ST.R;
  const stats = id => { let d = 0, t = 0, n = 0; if (R) R.rides.forEach((r, i) => { if (r.bike === id) { d += R.analyses[i].dist; t += R.analyses[i].moving; n++; } }); return { d, t, n }; };
  const colorOpts = c => BIKE_COLORS.map(([v, l]) => `<option value="${v}"${v === c ? ' selected' : ''}>${l}</option>`).join('');
  const typeOpts = t0 => ['Route', 'VTT', 'Gravel', 'Contre-la-montre', 'Vélo électrique'].map(t => `<option${t === t0 ? ' selected' : ''}>${t}</option>`).join('');
  const cards = ST.bikes.map(b => { const s = stats(b.id); return `<article class="card reveal" style="display:flex;flex-direction:column;gap:16px">
<div style="height:150px;border-radius:18px;background:${bikeGrad(b.color)};display:flex;align-items:flex-end;padding:18px"><span style="font-family:'Barlow Condensed',sans-serif;font-weight:800;font-style:italic;font-size:40px;color:#F4F1EE;text-shadow:0 2px 12px rgba(0,0,0,.55)">${esc(b.name)}</span></div>
<div class="row" style="gap:28px"><div><span class="num" style="font-size:44px">${nf0(s.d / 1000)}</span><span class="unit">km</span></div><div><span class="num" style="font-size:44px">${nf0(s.t / 3600)}</span><span class="unit">h</span></div><div><span class="num" style="font-size:44px">${s.n}</span><span class="unit">sorties</span></div></div>
<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px"><div class="field"><label for="bn-${b.id}">Nom</label><input id="bn-${b.id}" data-bk="${b.id}" data-f="name" value="${esc(b.name)}"></div>
<div class="field"><label for="bt-${b.id}">Type</label><select id="bt-${b.id}" data-bk="${b.id}" data-f="type">${typeOpts(b.type)}</select></div>
<div class="field"><label for="bc-${b.id}">Couleur</label><select id="bc-${b.id}" data-bk="${b.id}" data-f="color">${colorOpts(b.color)}</select></div></div>
<div class="field"><label for="bw-${b.id}">Roues (référence et usage)</label><input id="bw-${b.id}" data-bk="${b.id}" data-f="wheels" value="${esc(b.wheels || '')}" placeholder="Ex. : roues carbone 45 mm, pour le plat"></div>
<div class="row" style="justify-content:space-between"><span class="muted" style="font-size:15px">L’effet des roues sur les conseils viendra plus tard.</span><button type="button" class="btn" data-del="${b.id}" style="color:#C9C4BF">Supprimer ce vélo</button></div></article>`; }).join('');
  return `<section class="wrap" style="padding-top:60px"><span class="eyebrow">Matériel</span><h1 class="huge">${ST.bikes.length ? 'Tes vélos.' : 'Ajoute tes vélos.'}</h1><p class="lead" style="margin-top:12px">${ST.bikes.length ? 'Le kilométrage se met à jour tout seul selon le vélo choisi pour chaque sortie.' : 'Donne un nom à chacun de tes vélos. Tu pourras ensuite choisir celui utilisé pour chaque sortie, et suivre leurs kilomètres.'}</p></section>
<section class="wrap" style="padding-top:30px">${cards ? `<div class="grid g-2">${cards}</div>` : ''}
<form class="card" id="nbForm" style="margin-top:14px"><strong style="font-size:20px">Ajouter un vélo</strong><div class="row" style="margin-top:12px;align-items:flex-end"><div class="field" style="flex:1 1 240px"><label for="nbN">Nom</label><input id="nbN" placeholder="Ex. : Le Canyon"></div><div class="field"><label for="nbT">Type</label><select id="nbT">${typeOpts('Route')}</select></div><div class="field"><label for="nbC">Couleur</label><select id="nbC">${colorOpts('noir')}</select></div><button class="btn pri" type="submit">Ajouter</button></div></form>
${BQ.desktop ? '' : '<p class="muted" style="font-size:15px;margin-top:12px">Ces réglages sont gardés dans ce navigateur.</p>'}</section>`;
}
pageGear.after = function () {
  document.querySelectorAll('[data-bk]').forEach(el => el.addEventListener('change', () => { const b = ST.bikes.find(x => x.id === el.dataset.bk); b[el.dataset.f] = el.value; store.set('bikes', ST.bikes); if (el.dataset.f !== 'wheels') route(true); }));
  $('#nbForm').addEventListener('submit', e => {
    e.preventDefault(); const n = $('#nbN').value.trim(); if (!n) { $('#nbN').focus(); return; }
    const b = { id: 'b' + Date.now(), name: n, type: $('#nbT').value, color: $('#nbC').value, wheels: '' }; ST.bikes.push(b); store.set('bikes', ST.bikes);
    if (ST.bikes.length === 1) { allRides().forEach(r => { if (!ST.bikes.some(x => x.id === r.bike) && !ST.rideBike[r.id]) { ST.rideBike[r.id] = b.id; r.bike = b.id; } }); store.set('rideBike', ST.rideBike); recompute(); }
    route(true);
  });
  document.querySelectorAll('[data-del]').forEach(btn => { let armed = false; btn.addEventListener('click', () => {
    if (!armed) { armed = true; btn.textContent = 'Confirmer la suppression'; btn.style.color = '#F2A062'; setTimeout(() => { if (document.body.contains(btn)) { armed = false; btn.textContent = 'Supprimer ce vélo'; btn.style.color = '#C9C4BF'; } }, 4000); return; }
    const id = btn.dataset.del; ST.bikes = ST.bikes.filter(x => x.id !== id); store.set('bikes', ST.bikes);
    for (const k in ST.rideBike) if (ST.rideBike[k] === id) delete ST.rideBike[k]; store.set('rideBike', ST.rideBike);
    allRides().forEach(r => { if (r.bike === id) r.bike = null; }); recompute(); route(true);
  }); });
};

/* =====================================================================
   PAGE : PROFIL
   ===================================================================== */
function pageProfile() {
  const R = ST.R; const p = ST.profile;
  const auto = R ? R.ftpAuto(R.rides[R.rides.length - 1].date) : null; const ftp = R ? R.lastFtp : (p.ftpManual || 220);
  const hrmax = R ? R.hrmax : Math.round(208 - 0.7 * p.age);
  const zr = B.ZONES.map((z, k) => `<tr><td><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${['#2E8B5C', '#3FB97A', '#E8C547', '#EE8A3C', '#E5484D', '#C23A3F', '#9E2E33'][k]};margin-right:8px"></span>${z.n}</td><td>${Math.round(z.lo * 100)}–${z.hi > 9 ? '…' : Math.round(z.hi * 100)} %</td><td>${Math.round(z.lo * ftp)}–${z.hi > 9 ? '…' : Math.round(z.hi * ftp)} W</td></tr>`).join('');
  const hz = [['Facile', 0, .75, '#3FB97A'], ['Soutenu', .75, .85, '#E8C547'], ['Dur', .85, .92, '#EE8A3C'], ['Dans le rouge', .92, 1, '#E5484D']].map(([n, a, b, c]) => `<tr><td><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${c};margin-right:8px"></span>${n}</td><td>${Math.round(a * 100)}–${Math.round(b * 100)} %</td><td>${Math.round(a * hrmax)}–${Math.round(b * hrmax)} bpm</td></tr>`).join('');
  return `<section class="wrap" style="padding-top:60px"><span class="eyebrow">Profil</span><h1 class="huge">${esc(p.name || 'Ton profil')}.</h1><p class="lead" style="margin-top:12px">Ces informations servent à calculer tes zones, tes watts par kilo et tes conseils.</p></section>
<section class="wrap" style="padding-top:30px"><form class="card" id="pf"><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px">
<div class="field"><label for="pName">Prénom ou surnom</label><input id="pName" value="${esc(p.name)}"></div>
<div class="field"><label for="pBirth">Date de naissance${p.birth ? ` · ${p.age} ans` : ''}</label><input id="pBirth" type="date" min="1920-01-01" max="2015-12-31" value="${esc(p.birth || '')}"></div>
<div class="field"><label for="pW">Poids (kg)</label><input id="pW" type="number" min="35" max="160" step="0.5" value="${p.weight}"></div>
<div class="field"><label for="pH">Taille (cm)</label><input id="pH" type="number" min="120" max="220" value="${p.height}"></div>
<div class="field"><label for="pFtp">FTP (W) · vide = automatique</label><input id="pFtp" type="number" min="60" max="500" value="${p.ftpManual || ''}" placeholder="${auto ? 'Auto : ' + auto + ' W' : ''}"></div>
<div class="field"><label for="pHr">FC max (bpm) · vide = automatique</label><input id="pHr" type="number" min="100" max="230" value="${p.hrmaxManual || ''}" placeholder="Auto : ${hrmax} bpm"></div>
</div><div class="row" style="margin-top:18px"><button class="btn pri" type="submit">Enregistrer et recalculer</button><span id="pfMsg" role="status" class="muted"></span></div>
${BQ.desktop ? '' : '<p class="muted" style="font-size:15px;margin:14px 0 0">Âge, poids et taille sont des valeurs d’exemple : à remplacer par les vraies.</p>'}</form>${BQ.profileExtra ? BQ.profileExtra() : ''}</section>
<section class="wrap sec reveal" style="padding-top:40px"><div class="grid g-2">
<div class="card"><strong style="font-size:22px">FTP : ${ftp} W ${ib('ftp', true)}</strong><p class="muted" style="font-size:16px">${p.ftpManual ? 'Valeur saisie à la main.' : `Estimée automatiquement : 95 % de ta meilleure puissance sur 20 min des 6 dernières semaines (<a href="${B.SOURCES.tpgloss.u}" target="_blank" rel="noopener">TrainingPeaks</a>). Pour une valeur plus juste, fais un test de 20 min à fond une fois toutes les 6 semaines.`}</p>
<div class="tbl" style="margin-top:12px"><table class="t"><thead><tr><th>Zone (Coggan)</th><th>% FTP</th><th>Watts</th></tr></thead><tbody>${zr}</tbody></table></div></div>
<div class="card"><strong style="font-size:22px">FC max : ${hrmax} bpm ${ib('hrmax', true)}</strong><p class="muted" style="font-size:16px">${p.hrmaxManual ? 'Valeur saisie à la main.' : `Max observé en sortie : ${R ? R.hrObserved : '—'} bpm · formule de Tanaka : ${Math.round(208 - 0.7 * p.age)} bpm (<a href="${B.SOURCES.tanaka.u}" target="_blank" rel="noopener">étude de 2001</a>). On garde la plus haute des deux.`}</p>
<div class="tbl" style="margin-top:12px"><table class="t"><thead><tr><th>Zone cardio</th><th>% FC max</th><th>bpm</th></tr></thead><tbody>${hz}</tbody></table></div></div></div></section>`;
}
pageProfile.after = function () {
  if (BQ.profileAfter) BQ.profileAfter();
  $('#pf').addEventListener('submit', e => {
    e.preventDefault(); const p = ST.profile;
    p.name = $('#pName').value.trim() || (BQ.desktop ? '' : 'Papa'); p.birth = $('#pBirth').value || null; p.age = ageOf(p.birth) || p.age; p.weight = +$('#pW').value || 74; p.height = +$('#pH').value || 178;
    p.ftpManual = $('#pFtp').value ? +$('#pFtp').value : null; p.hrmaxManual = $('#pHr').value ? +$('#pHr').value : null;
    store.set('profile', p); recompute(); route(true); setTimeout(() => { const m = $('#pfMsg'); if (m) m.textContent = 'Enregistré, tout est recalculé.'; }, 50);
  });
};

/* =====================================================================
   PAGE : SOURCES
   ===================================================================== */
function pageSources() {
  const items = Object.values(B.SOURCES).map(s => `<article class="card reveal"><a href="${s.u}" target="_blank" rel="noopener" style="font-size:19px;font-weight:600">${esc(s.t)}</a><p class="muted" style="margin:8px 0 0;font-size:16px">${esc(s.s)}</p></article>`).join('');
  return `<section class="wrap" style="padding-top:60px"><span class="eyebrow">Sources</span><h1 class="huge">D’où viennent les conseils.</h1>
<p class="lead" style="margin-top:12px">Le coach de Braquet n’invente rien : chaque règle reprend une méthode publiée par un entraîneur reconnu ou une étude scientifique, puis l’applique à tes chiffres.</p></section>
<section class="wrap" style="padding-top:30px"><div class="grid g-2">${items}</div>
<div class="notice" style="margin-top:20px">Ces conseils sont des repères d’entraînement, pas un avis médical. Avant d’ajouter des efforts très intenses, surtout après une longue période sans, demande l’avis de ton médecin.</div></section>`;
}

/* ---------- Démarrage ---------- */
function boot() {
  setTimeout(() => {
    try { ST.demo = B.generateDemo(); recompute(); }
    catch (e) { $('#app').innerHTML = `<div class="wrap sec"><p>Erreur au démarrage : ${esc(e.message)}</p></div>`; console.error(e); return; }
    route();
  }, 30);
}
Object.assign(BQ, { ST, store, ageOf, allRides, bikeGrad, PAGES, recompute, route, go, reloadPrefs, esc, ib, tile, numHTML, km, nf1, dFmt, cap, boot, cleanup, dirName });
if (!window.braquetAPI) boot();
})();
