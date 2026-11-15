/* Braquet — moteur : génération de sorties d'exemple, analyses, conseils sourcés, lecture FIT */
(function (root) {
'use strict';
const B = {};

/* ---------------- Outils ---------------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const RAD = Math.PI / 180;
function haversine(la1, lo1, la2, lo2) {
  const dla = (la2 - la1) * RAD, dlo = (lo2 - lo1) * RAD;
  const a = Math.sin(dla / 2) ** 2 + Math.cos(la1 * RAD) * Math.cos(la2 * RAD) * Math.sin(dlo / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}
function bearing(la1, lo1, la2, lo2) {
  const y = Math.sin((lo2 - lo1) * RAD) * Math.cos(la2 * RAD);
  const x = Math.cos(la1 * RAD) * Math.sin(la2 * RAD) - Math.sin(la1 * RAD) * Math.cos(la2 * RAD) * Math.cos((lo2 - lo1) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function mean(arr, from, to) { from = from || 0; to = to == null ? arr.length : to; let s = 0, n = 0; for (let i = from; i < to; i++) { s += arr[i]; n++; } return n ? s / n : 0; }
function lowerBound(arr, v) { let lo = 0, hi = arr.length - 1; if (v <= arr[0]) return 0; if (v >= arr[hi]) return hi; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m; else hi = m; } return hi; }
B.util = { haversine, bearing, clamp, mean, lowerBound, mulberry32, hashStr };

/* ---------------- Sources (vérifiées) ---------------- */
B.SOURCES = {
  friel: { t: 'Joe Friel — Aerobic Decoupling and Heart Rate Drift Explained (TrainingPeaks)', u: 'https://www.trainingpeaks.com/coach-blog/aerobic-endurance-and-decoupling/', s: 'Décrochage < 5 % : bonne endurance ; 5–10 % : limite ou fatigue ; > 10 % : effort trop intense ou endurance insuffisante.' },
  friel2: { t: 'TrainingPeaks — seuils de décrochage 5–10 % et > 10 %', u: 'https://www.trainingpeaks.com/learn/articles/aerobic-endurance-and-decoupling/', s: 'Détail des niveaux de décrochage aérobie.' },
  coggan: { t: 'TrainerRoad — Cycling Power Zones (modèle du Dr Andrew Coggan)', u: 'https://www.trainerroad.com/blog/cycling-power-zones-training-zones-explained/', s: 'Sept zones de puissance exprimées en % de la FTP.' },
  coggan2: { t: 'Dr Andrew Coggan — Normalized Power, Intensity Factor and TSS (TrainingPeaks)', u: 'https://trainingpeaks.com/blog/normalized-power-intensity-factor-training-stress', s: 'Définition de la puissance normalisée, de l’IF et du TSS.' },
  tpgloss: { t: 'TrainingPeaks — Glossary of TrainingPeaks Metrics', u: 'https://www.trainingpeaks.com/learn/articles/glossary-of-trainingpeaks-metrics/', s: 'FTP ≈ 95 % de la meilleure puissance sur 20 min ; VI = NP / puissance moyenne.' },
  pmc: { t: 'Bike Hub — Monitoring your training load (CTL, ATL, TSB)', u: 'https://bikehub.co.za/news/monitoring-your-training-load-r7477/', s: 'Forme = CTL − ATL, moyennes pondérées sur 42 et 7 jours.' },
  fascat: { t: 'FasCat Coaching — Performance Manager Chart', u: 'https://fascatcoaching.com/tips/performance-manager-chart/', s: 'Constante de fatigue plus longue pour les athlètes plus âgés, qui récupèrent moins vite.' },
  atkinson: { t: 'Atkinson & Brunskill (2000) — Pacing strategies during a cycling time trial with simulated headwinds and tailwinds', u: 'https://research.tees.ac.uk/en/publications/pacing-strategies-during-a-cycling-time-trial-with-simulated-head/', s: 'Les cyclistes partent habituellement trop vite ; ±5 % de puissance selon le vent fait gagner du temps.' },
  swain: { t: 'Inside Science (AIP) — Cyclists’ pacing strategies should consider the wind (travaux de D. Swain)', u: 'https://www.aip.org/inside-science/cyclists-pacing-strategies-should-consider-the-wind', s: 'Appuyer un peu plus face au vent, récupérer vent dans le dos.' },
  atkinson2: { t: 'Atkinson, Peacock & Law (2007) — Acceptability of power variation during a simulated hilly time trial', u: 'https://www.thieme-connect.com/products/all/doi/10.1055/s-2006-924209', s: 'Environ +5 % en montée est tenable ; au-delà, certains cyclistes n’arrivent plus à suivre en fin d’effort.' },
  vi: { t: 'CTS (Jim Rutberg) — What Is Normalized Power and How Is It Used', u: 'https://trainright.com/?p=27552', s: 'VI de 1,00 à 1,06 = effort très régulier ; 1,15 et plus = effort très haché.' },
  carbs: { t: 'TOUR — Carbohydrates in sport: is 120 grams per hour ideal?', u: 'https://www.tour-magazin.de/en/fitness/nutrition/carbohydrates-in-sport-is-120-grams-per-hour-ideal/', s: '1 h à 2 h 30 : 30–60 g/h ; 2 h 30 à 6 h : 60–90 g/h de glucides.' },
  carbs2: { t: 'Precision Fuel & Hydration — How much carbohydrate do athletes need per hour?', u: 'https://www.precisionhydration.com/performance-advice/nutrition/how-much-carbohydrate-carbs-athletes-per-hour/', s: 'Au-delà de 2 h : 60–90 g/h, à condition de bien le tolérer.' },
  hydra: { t: 'Roadman Cycling — Cycling hydration strategy', u: 'https://roadmancycling.com/blog/cycling-hydration-strategy-complete-guide', s: 'Point de départ : 500–800 ml/h, à adapter à la chaleur et à la transpiration.' },
  cadence: { t: 'Roadman Cycling — Best cadence for climbing', u: 'https://roadmancycling.com/answers/best-cadence-for-climbing-cycling', s: 'En côte, 70–85 tr/min pour la plupart des amateurs ; sous 60, le coût musculaire grimpe fortement.' },
  cadenceFlat: { t: 'Roadman Cycling — Cycling cadence : the complete guide', u: 'https://roadmancycling.com/topics/cycling-cadence', s: 'Sur le plat, la plupart des cyclistes entraînés sont à l’aise entre 85 et 95 tr/min.' },
  cadenceAge: { t: 'Étude (Med Sci Sports Exerc 2010) — cadence et rendement, cyclistes jeunes vs âgés', u: 'https://www.pubmed.gov/20386335/', s: 'Les cyclistes plus âgés sont moins efficaces à cadence très élevée : inutile de forcer une cadence de pro.' },
  masters: { t: 'Roadman Cycling — Cycling over 50 (approche de Joe Friel, « Fast After 50 »)', u: 'https://roadmancycling.com/blog/cycling-over-50-training', s: 'Après 50 ans : garder de l’intensité, réduire la fréquence des séances dures, 72–96 h entre deux séances dures.' },
  seiler: { t: 'Fast Talk Labs — The science behind polarized training (Dr Stephen Seiler)', u: 'https://fasttalklabs.com/articles/the-science-behind-polarized-training', s: 'Environ 80 % du temps à basse intensité, pas plus de deux séances intenses par semaine.' },
  tanaka: { t: 'Tanaka, Monahan & Seals (2001) — Age-predicted maximal heart rate revisited', u: 'https://pubmed.ncbi.nlm.nih.gov/11153730/', s: 'FC max ≈ 208 − 0,7 × âge ; la formule 220 − âge sous-estime la FC max des plus âgés.' }
};

/* ---------------- Géographie d'exemple (région lilloise) ---------------- */
const P = {
  H: ['Départ', 50.6150, 3.0480], LAM: ['Lambersart', 50.6500, 3.0250], ARM: ['Armentières', 50.6880, 2.8810],
  BAI: ['Bailleul', 50.7390, 2.7350], MNO: ['Mont Noir', 50.7790, 2.7350], MCA: ['Mont des Cats', 50.7835, 2.6640],
  CAS: ['Cassel', 50.8008, 2.4880], HAZ: ['Hazebrouck', 50.7240, 2.5390], EST: ['Estaires', 50.6450, 2.7230],
  LAB: ['La Bassée', 50.5340, 2.8070], SEC: ['Seclin', 50.5480, 3.0290], MPV: ['Mons-en-Pévèle', 50.4800, 3.0980],
  ORC: ['Orchies', 50.4750, 3.2420], CAM: ['Camphin-en-Pévèle', 50.5950, 3.2600], CYS: ['Cysoing', 50.5700, 3.2160],
  VDA: ['Villeneuve-d’Ascq', 50.6230, 3.1450], BAIS: ['Baisieux', 50.6080, 3.2530], TOU: ['Tournai', 50.6060, 3.3880],
  MSA: ['Mont-Saint-Aubert', 50.6450, 3.3980], TEM: ['Templeuve', 50.5280, 3.1760], WAM: ['Wambrechies', 50.6860, 3.0480],
  QUE: ['Quesnoy-sur-Deûle', 50.7130, 2.9990], COM: ['Comines', 50.7610, 3.0080], WER: ['Wervicq-Sud', 50.7710, 3.0420],
  LEN: ['Lens', 50.4320, 2.8320], VIM: ['Vimy', 50.3800, 2.7700], DOU: ['Douai', 50.3700, 3.0790]
};
B.PLACES = Object.keys(P).map(k => ({ key: k, name: P[k][0], lat: P[k][1], lon: P[k][2] }));
const HILLS = [
  { n: 'Mont Cassel', lat: 50.8008, lon: 2.4880, h: 150, s: 1500 },
  { n: 'Mont des Cats', lat: 50.7835, lon: 2.6640, h: 135, s: 1250 },
  { n: 'Mont Noir', lat: 50.7790, lon: 2.7350, h: 120, s: 1300 },
  { n: 'Mons-en-Pévèle', lat: 50.4800, lon: 3.0980, h: 78, s: 1900 },
  { n: 'Mont-Saint-Aubert', lat: 50.6450, lon: 3.3980, h: 122, s: 1250 },
  { n: 'Crête de Vimy', lat: 50.3800, lon: 2.7700, h: 95, s: 2600 }
];
B.HILLS = HILLS;
function terrainAlt(lat, lon) {
  let a = 26 + 9 * Math.sin(lat * 47) + 7 * Math.cos(lon * 61 + 1.3) + 4 * Math.sin((lat + lon) * 130);
  for (const h of HILLS) {
    const dn = (lat - h.lat) * 111320, de = (lon - h.lon) * 111320 * 0.636;
    const d2 = dn * dn + de * de;
    if (d2 < 9e8) a += h.h * Math.exp(-d2 / (2 * h.s * h.s));
  }
  return a;
}
B.terrainAlt = terrainAlt;

const ROUTES = {
  A: { name: 'Boucle des Monts de Flandre', pts: ['H', 'LAM', 'ARM', 'BAI', 'MNO', 'MCA', 'CAS', 'HAZ', 'EST', 'ARM', 'LAM', 'H'] },
  B: { name: 'Tour de la Pévèle', pts: ['H', 'SEC', 'MPV', 'DOU', 'ORC', 'TEM', 'CYS', 'CAM', 'BAIS', 'VDA', 'H'] },
  C: { name: 'Tournai et le Mont-Saint-Aubert', pts: ['H', 'VDA', 'BAIS', 'TOU', 'MSA', 'CAM', 'CYS', 'TEM', 'ORC', 'MPV', 'SEC', 'H'] },
  D: { name: 'Vallée de la Lys', pts: ['H', 'LAM', 'WAM', 'QUE', 'COM', 'WER', 'ARM', 'EST', 'LAB', 'SEC', 'H'] },
  E: { name: 'Grande boucle par Vimy', pts: ['H', 'LAM', 'ARM', 'EST', 'LAB', 'LEN', 'VIM', 'DOU', 'ORC', 'TEM', 'CYS', 'VDA', 'H'] }
};

function offsetLL(lat, lon, dn, de) { return [lat + dn / 111320, lon + de / (111320 * Math.cos(lat * RAD))]; }
const legCache = {};
function legPoints(a, b) {
  const fwd = a < b; const k = fwd ? a + '-' + b : b + '-' + a;
  if (!legCache[k]) {
    const p = P[fwd ? a : b], q = P[fwd ? b : a];
    const rng = mulberry32(hashStr(k));
    const L = haversine(p[1], p[2], q[1], q[2]);
    const n = Math.max(2, Math.round(L / 20));
    const k1 = 1 + Math.floor(rng() * 3), k2 = 3 + Math.floor(rng() * 4), ph1 = rng() * 6.283, ph2 = rng() * 6.283;
    const A1 = Math.min(420, L * 0.045), A2 = Math.min(140, L * 0.012);
    const dn = (q[1] - p[1]) * 111320, de = (q[2] - p[2]) * 111320 * Math.cos(p[1] * RAD);
    const len = Math.hypot(dn, de) || 1; const pn = -de / len, pe = dn / len;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const off = (A1 * Math.sin(6.283 * k1 * s + ph1) + A2 * Math.sin(6.283 * k2 * s + ph2)) * Math.sin(Math.PI * s);
      pts.push(offsetLL(p[1] + (q[1] - p[1]) * s, p[2] + (q[2] - p[2]) * s, pn * off, pe * off));
    }
    legCache[k] = pts;
  }
  const pts = legCache[k];
  return fwd ? pts : pts.slice().reverse();
}
function buildRoute(key, reversed) {
  let pts = ROUTES[key].pts.slice(); if (reversed) pts.reverse();
  const lat = [], lon = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const lp = legPoints(pts[i], pts[i + 1]);
    for (let j = i === 0 ? 0 : 1; j < lp.length; j++) { lat.push(lp[j][0]); lon.push(lp[j][1]); }
  }
  const cum = new Float64Array(lat.length);
  for (let i = 1; i < lat.length; i++) cum[i] = cum[i - 1] + haversine(lat[i - 1], lon[i - 1], lat[i], lon[i]);
  return { lat, lon, cum, total: cum[cum.length - 1] };
}
function posAt(r, d) {
  const i = lowerBound(r.cum, d); const i0 = Math.max(0, i - 1);
  const seg = r.cum[i] - r.cum[i0]; const f = seg > 0 ? (d - r.cum[i0]) / seg : 0;
  return [r.lat[i0] + (r.lat[i] - r.lat[i0]) * clamp(f, 0, 1), r.lon[i0] + (r.lon[i] - r.lon[i0]) * clamp(f, 0, 1)];
}

/* ---------------- Physique & simulation ---------------- */
function solveSpeed(Pw, grade, head, m) {
  const g = 9.81, Crr = 0.005, CdA = 0.36, rho = 1.22;
  const th = Math.atan(grade); const Fg = m * g * Math.sin(th), Fr = Crr * m * g * Math.cos(th);
  const f = v => { const va = v + head; return v * (Fr + Fg + 0.5 * rho * CdA * va * Math.abs(va)) - Pw; };
  let lo = 0.3, hi = 25;
  if (Pw <= 0) { // roue libre : vitesse d'équilibre
    const gfun = v => { const va = v + head; return Fr + Fg + 0.5 * rho * CdA * va * Math.abs(va); };
    if (gfun(lo) > 0) return lo;
    for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (gfun(mid) > 0) hi = mid; else lo = mid; }
    return Math.min(15.5, (lo + hi) / 2);
  }
  if (f(lo) > 0) return lo;
  for (let k = 0; k < 32; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) hi = mid; else lo = mid; }
  return Math.min(15.5, (lo + hi) / 2);
}

function schedule() {
  const out = []; const start = Date.UTC(2026, 8, 16); // mercredi 16 septembre 2026
  const wed = ['D', 'B', 'D', 'B', 'D', 'B', 'D', 'B'];
  const sat = ['A', 'C', 'E', 'A', 'C', 'E', 'A', 'C'];
  const sun = ['B', 'D', 'B', 'C*', 'B', 'D', 'B*', 'A'];
  for (let k = 0; k < 8; k++) {
    [[0, wed[k], 14], [3, sat[k], 8.5], [4, sun[k], 9]].forEach(([off, rk, hour], j) => {
      const date = new Date(start + (k * 7 + off) * 86400000 + hour * 3600000);
      out.push({ k, j, date, route: rk.replace('*', ''), reversed: rk.endsWith('*') });
    });
  }
  return out;
}

function makeSpec(entry, idx, total) {
  const rng = mulberry32(1000 + idx * 7919);
  const last = idx === total - 1;
  const dayFrac = idx / (total - 1);
  const spec = {
    seed: 5000 + idx * 104729, route: entry.route, reversed: entry.reversed, date: entry.date,
    ftp: 222 + 11 * dayFrac, weight: 74, hrmax: 168,
    IF: entry.j === 0 ? 0.70 + rng() * 0.05 : 0.64 + rng() * 0.06,
    startFast: rng() < 0.35, fuelPoor: rng() < 0.3, windComp: rng() < 0.45,
    climbAggro: 0.8 + rng() * 0.6, cadBase: 84 + rng() * 6, lowCad: rng() < 0.25,
    windDir: Math.round(rng() * 360), windKmh: Math.round(6 + rng() * 22), temp: Math.round(9 + rng() * 9 - dayFrac * 5),
    blocks: [], bike: entry.j === 0 && idx % 2 ? 'noir' : 'bordeaux'
  };
  if (entry.j === 0 && entry.k % 2 === 1) { spec.blocks = [{ at: 0.25, dur: 1200, mult: 1.0 }, { at: 0.55, dur: 1200, mult: 0.98 }]; spec.IF = 0.66; spec.workout = '2 × 20 min au seuil'; }
  if (entry.k === 5 && entry.j === 0) { spec.blocks = [0.3, 0.38, 0.46, 0.54, 0.62].map(a => ({ at: a, dur: 240, mult: 1.15 })); spec.workout = '5 × 4 min intenses'; }
  if (last) Object.assign(spec, { startFast: true, fastMult: 1.16, fuelPoor: true, windComp: false, windDir: 262, windKmh: 21, temp: 10, IF: 0.68, climbAggro: 2.8, climbCap: 0.72, lowCad: true, bike: 'bordeaux' });
  return spec;
}

function simulate(spec) {
  const r = buildRoute(spec.route, spec.reversed);
  const rng = mulberry32(spec.seed);
  const m = spec.weight + 8.5, ftp = spec.ftp;
  const ws = spec.windKmh / 3.6 * 0.65; // vent mesuré à 10 m, plus faible à hauteur du cycliste
  const Test = r.total / 7.6;
  const cap = Math.ceil(Test * 1.6) + 600;
  const S = { t: new Float64Array(cap), lat: new Float64Array(cap), lon: new Float64Array(cap), alt: new Float32Array(cap), dist: new Float64Array(cap), spd: new Float32Array(cap), pwr: new Float32Array(cap), hr: new Float32Array(cap), cad: new Float32Array(cap), tmp: new Float32Array(cap) };
  let d = 0, v = 3, hrv = 78, noise = 0, surge = 0, nextSurge = 120 + rng() * 300, i = 0, baroDrift = 0;
  const t0 = spec.date.getTime() / 1000;
  const drift = spec.fuelPoor ? 4.5 : 1.6;
  const blocks = spec.blocks.map(b => ({ s: Math.round(b.at * Test), e: Math.round(b.at * Test) + b.dur, mult: b.mult }));
  while (d < r.total && i < cap) {
    const pa = posAt(r, Math.max(0, d - 40)), pb = posAt(r, Math.min(r.total, d + 40)), pc = posAt(r, d);
    const span = Math.min(r.total, d + 40) - Math.max(0, d - 40) || 80;
    const grade = clamp((terrainAlt(pb[0], pb[1]) - terrainAlt(pa[0], pa[1])) / span, -0.15, 0.15);
    const heading = bearing(pa[0], pa[1], pb[0], pb[1]);
    const head = ws * Math.cos((spec.windDir - heading) * RAD);
    const frac = d / r.total, tt = i / Test, gp = grade * 100;
    let mult = spec.IF, coast = false;
    const blk = blocks.find(b => i >= b.s && i < b.e);
    if (blk) mult = blk.mult;
    else {
      if (gp > 0.5) mult *= 1 + Math.min(spec.climbCap || 0.5, gp * 0.065 * spec.climbAggro);
      else if (gp < -2.5) { if (rng() < 0.75) coast = true; else mult *= 0.35; }
      else if (gp < 0) mult *= 1 + gp * 0.18;
      if (spec.windComp) mult *= 1 + clamp(head * 0.013, -0.06, 0.07);
      if (spec.startFast && frac < 0.25) mult *= spec.fastMult || 1.11;
    }
    mult *= 1 - (spec.fuelPoor ? 0.15 : 0.045) * Math.pow(Math.min(1, tt), 2);
    noise = noise * 0.97 + (rng() - 0.5) * 0.05;
    if (i > nextSurge && !coast) { surge = 8 + Math.floor(rng() * 10); nextSurge = i + 150 + rng() * 360; }
    let Pw = coast ? 0 : ftp * mult * (1 + noise);
    if (surge > 0 && !coast) { Pw *= 1.5; surge--; }
    Pw = Math.max(0, Math.round(Pw));
    const vt = solveSpeed(Pw, grade, head, m);
    v = v + (vt - v) * 0.2;
    d += v;
    const x = Pw / ftp;
    let hrss = Pw > 0 ? 90.5 + 62.5 * Math.min(x, 1.3) : 96;
    hrss += drift * (i / 3600) + Math.max(0, spec.temp - 18) * 0.6;
    hrss = Math.min(hrss, spec.hrmax - 1);
    hrv += (hrss - hrv) / (hrss > hrv ? 28 : 45);
    let c = coast ? 0 : spec.cadBase - Math.max(0, gp) * (spec.lowCad ? 4.2 : 2.3) + (rng() - 0.5) * 5;
    if (Pw === 0) c = 0;
    baroDrift += (rng() - 0.5) * 0.02;
    S.t[i] = t0 + i; S.lat[i] = pc[0] + (rng() - 0.5) * 0.00002; S.lon[i] = pc[1] + (rng() - 0.5) * 0.00003;
    S.alt[i] = terrainAlt(pc[0], pc[1]) + baroDrift + (rng() - 0.5) * 0.3; S.dist[i] = d; S.spd[i] = v; S.pwr[i] = Pw;
    S.hr[i] = Math.round(hrv + (rng() - 0.5) * 2); S.cad[i] = Math.max(0, Math.round(c));
    S.tmp[i] = spec.temp + 2.5 * Math.sin(Math.PI * Math.min(1, tt)) + (rng() - 0.5) * 0.4;
    i++;
  }
  for (const k in S) S[k] = S[k].slice(0, i);
  return S;
}

const BIKES_DEFAULT = [
  { id: 'bordeaux', name: 'Route bordeaux nacré', type: 'Route', color: 'nacre', wheels: '' },
  { id: 'noir', name: 'Vélo noir mat', type: 'Route', color: 'noir', wheels: '' }
];
B.BIKES_DEFAULT = BIKES_DEFAULT;

B.generateDemo = function () {
  const sch = schedule(); const rides = [];
  sch.forEach((e, idx) => {
    const spec = makeSpec(e, idx, sch.length);
    const s = simulate(spec);
    rides.push({
      id: 'demo-' + (idx + 1), source: 'demo', date: e.date.toISOString(), name: ROUTES[e.route].name + (e.reversed ? ' (sens inverse)' : ''),
      bike: spec.bike, wind: { dir: spec.windDir, kmh: spec.windKmh }, temp: spec.temp, workout: spec.workout || null, s
    });
  });
  return rides;
};

/* ---------------- Lecteur de fichiers .FIT ---------------- */
B.parseFIT = function (buf) {
  const dv = new DataView(buf);
  const hs = dv.getUint8(0);
  if (buf.byteLength < 14 || String.fromCharCode(dv.getUint8(8), dv.getUint8(9), dv.getUint8(10), dv.getUint8(11)) !== '.FIT') throw new Error('Ce fichier n’est pas un fichier .FIT valide.');
  const dataSize = dv.getUint32(4, true); const end = Math.min(buf.byteLength, hs + dataSize);
  const defs = {}; let p = hs, lastTs = 0; const recs = []; let sport = null;
  const SIZES = { 0: 1, 1: 1, 2: 1, 3: 2, 4: 2, 5: 4, 6: 4, 7: 1, 8: 4, 9: 8, 10: 1, 11: 2, 12: 4, 13: 1, 14: 8, 15: 8, 16: 8 };
  function readVal(off, size, bt, le) {
    const t = bt & 0x1F; const bs = SIZES[t] || 1;
    if (t === 7 || size < bs) return null;
    let v;
    switch (t) {
      case 1: v = dv.getInt8(off); return v === 0x7F ? null : v;
      case 0: case 2: case 10: case 13: v = dv.getUint8(off); return (v === 0xFF && t !== 10) || (t === 10 && v === 0) ? null : v;
      case 3: v = dv.getInt16(off, le); return v === 0x7FFF ? null : v;
      case 4: case 11: v = dv.getUint16(off, le); return v === 0xFFFF && t === 4 ? null : (t === 11 && v === 0 ? null : v);
      case 5: v = dv.getInt32(off, le); return v === 0x7FFFFFFF ? null : v;
      case 6: case 12: v = dv.getUint32(off, le); return v === 0xFFFFFFFF && t === 6 ? null : (t === 12 && v === 0 ? null : v);
      case 8: v = dv.getFloat32(off, le); return isFinite(v) ? v : null;
      case 9: v = dv.getFloat64(off, le); return isFinite(v) ? v : null;
      default: return null;
    }
  }
  while (p < end - 1) {
    const h = dv.getUint8(p); p++;
    if (h & 0x80) { // en-tête d'horodatage compressé
      const lt = (h >> 5) & 0x3, off = h & 0x1F; const def = defs[lt]; if (!def) break;
      let ts = (lastTs & ~0x1F) + off; if (off < (lastTs & 0x1F)) ts += 0x20; lastTs = ts;
      const o = readMsg(def, p); p += def.len; if (def.g === 20) { o[253] = ts; recs.push(o); }
      continue;
    }
    if (h & 0x40) { // définition
      const lt = h & 0x0F, dev = h & 0x20; p++; const arch = dv.getUint8(p); p++; const le = arch === 0;
      const g = dv.getUint16(p, le); p += 2; const nf = dv.getUint8(p); p++;
      const fields = []; let len = 0;
      for (let k = 0; k < nf; k++) { const num = dv.getUint8(p), size = dv.getUint8(p + 1), bt = dv.getUint8(p + 2); p += 3; fields.push({ num, size, bt, off: len }); len += size; }
      if (dev) { const nd = dv.getUint8(p); p++; for (let k = 0; k < nd; k++) { len += dv.getUint8(p + 1); p += 3; } }
      defs[lt] = { g, le, fields, len };
      continue;
    }
    const lt = h & 0x0F; const def = defs[lt]; if (!def) break;
    const o = readMsg(def, p); p += def.len;
    if (o[253] != null) lastTs = o[253];
    if (def.g === 20) recs.push(o);
    else if (def.g === 18 && o[5] != null) sport = o[5];
  }
  function readMsg(def, base) { const o = {}; for (const f of def.fields) o[f.num] = readVal(base + f.off, f.size, f.bt, def.le); return o; }
  if (recs.length < 30) throw new Error('Le fichier ne contient pas assez de points d’enregistrement.');
  // Mise en forme à 1 point par seconde
  const pts = recs.filter(o => o[253] != null).map(o => ({
    ts: o[253] + 631065600,
    lat: o[0] != null ? o[0] * (180 / 2147483648) : null, lon: o[1] != null ? o[1] * (180 / 2147483648) : null,
    alt: o[78] != null ? o[78] / 5 - 500 : (o[2] != null ? o[2] / 5 - 500 : null),
    hr: o[3], cad: o[4], dist: o[5] != null ? o[5] / 100 : null,
    spd: o[73] != null ? o[73] / 1000 : (o[6] != null ? o[6] / 1000 : null), pwr: o[7], tmp: o[13]
  })).sort((a, b) => a.ts - b.ts);
  const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts; const n = Math.min(t1 - t0 + 1, 60 * 3600 * 12);
  const S = { t: new Float64Array(n), lat: new Float64Array(n), lon: new Float64Array(n), alt: new Float32Array(n), dist: new Float64Array(n), spd: new Float32Array(n), pwr: new Float32Array(n), hr: new Float32Array(n), cad: new Float32Array(n), tmp: new Float32Array(n) };
  let j = 0; let last = { lat: null, lon: null, alt: 0, hr: 0, cad: 0, dist: 0, spd: 0, pwr: 0, tmp: 0 };
  let k = 0;
  for (let i = 0; i < n; i++) {
    const ts = t0 + i;
    while (j < pts.length && pts[j].ts <= ts) { const q = pts[j]; for (const key in last) if (q[key] != null) last[key] = q[key]; j++; }
    const gap = j > 0 && ts - pts[j - 1].ts > 10; // pause : on ne garde pas le temps arrêté
    if (gap) continue;
    S.t[k] = ts; S.lat[k] = last.lat || 0; S.lon[k] = last.lon || 0; S.alt[k] = last.alt || 0; S.dist[k] = last.dist || 0;
    S.spd[k] = last.spd || 0; S.pwr[k] = last.pwr || 0; S.hr[k] = last.hr || 0; S.cad[k] = last.cad || 0; S.tmp[k] = last.tmp || 0; k++;
  }
  for (const key in S) S[key] = S[key].slice(0, k);
  // Distance recalculée depuis le GPS si absente
  if (S.dist[k - 1] === 0) { for (let i = 1; i < k; i++) S.dist[i] = S.dist[i - 1] + (S.lat[i] && S.lat[i - 1] ? haversine(S.lat[i - 1], S.lon[i - 1], S.lat[i], S.lon[i]) : 0); }
  // premier point GPS valide pour combler le début
  let firstGps = 0; while (firstGps < k && !S.lat[firstGps]) firstGps++;
  for (let i = 0; i < firstGps && firstGps < k; i++) { S.lat[i] = S.lat[firstGps]; S.lon[i] = S.lon[firstGps]; }
  return { s: S, sport, start: new Date(t0 * 1000) };
};

/* ---------------- Analyses ---------------- */
function rollingMean(a, w) {
  const n = a.length, out = new Float32Array(n); let s = 0;
  for (let i = 0; i < n; i++) { s += a[i]; if (i >= w) s -= a[i - w]; out[i] = s / Math.min(i + 1, w); }
  return out;
}
function centeredMean(a, w) {
  const n = a.length, out = new Float32Array(n), h = Math.floor(w / 2); const cs = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + a[i];
  for (let i = 0; i < n; i++) { const lo = Math.max(0, i - h), hi = Math.min(n, i + h + 1); out[i] = (cs[hi] - cs[lo]) / (hi - lo); }
  return out;
}
function normPower(p, from, to) {
  from = from || 0; to = to == null ? p.length : to;
  if (to - from < 30) return mean(p, from, to);
  let s = 0, acc = 0, n = 0;
  for (let i = from; i < to; i++) { s += p[i]; if (i - from >= 30) s -= p[i - 30]; if (i - from >= 29) { acc += Math.pow(s / 30, 4); n++; } }
  return Math.pow(acc / n, 0.25);
}
function bestAvg(a, w) {
  if (a.length < w) return { v: 0, i: -1 };
  let s = 0; for (let i = 0; i < w; i++) s += a[i];
  let best = s, bi = 0;
  for (let i = w; i < a.length; i++) { s += a[i] - a[i - w]; if (s > best) { best = s; bi = i - w + 1; } }
  return { v: best / w, i: bi };
}
function bestDistTime(dist, D) {
  const n = dist.length; if (dist[n - 1] - dist[0] < D) return null;
  let best = Infinity, bi = -1, j = 0;
  for (let i = 0; i < n; i++) { while (j < n && dist[j] - dist[i] < D) j++; if (j >= n) break; const t = j - i; if (t < best) { best = t; bi = i; } }
  return { t: best, i: bi };
}
B.bestAvg = bestAvg; B.rollingMean = rollingMean; B.normPower = normPower;
B.POWER_DURS = [[5, '5 s'], [60, '1 min'], [300, '5 min'], [1200, '20 min'], [3600, '1 h']];
B.DIST_RECS = [[20000, '20 km'], [50000, '50 km'], [100000, '100 km'], [150000, '150 km']];
B.ZONES = [
  { n: 'Z1 Récupération', lo: 0, hi: 0.55, c: '#3FB97A' }, { n: 'Z2 Endurance', lo: 0.55, hi: 0.75, c: '#3FB97A' },
  { n: 'Z3 Tempo', lo: 0.75, hi: 0.90, c: '#E8C547' }, { n: 'Z4 Seuil', lo: 0.90, hi: 1.05, c: '#EE8A3C' },
  { n: 'Z5 VO2max', lo: 1.05, hi: 1.20, c: '#E5484D' }, { n: 'Z6 Anaérobie', lo: 1.20, hi: 1.50, c: '#E5484D' }, { n: 'Z7 Sprint', lo: 1.50, hi: 99, c: '#E5484D' }
];
function zoneIdx(x) { for (let z = 0; z < B.ZONES.length; z++) if (x < B.ZONES[z].hi) return z; return 6; }
B.zoneIdx = zoneIdx;
B.colorPower = x => x < 0.75 ? '#3FB97A' : x < 0.90 ? '#E8C547' : x < 1.05 ? '#EE8A3C' : '#E5484D';
B.colorHR = x => x < 0.75 ? '#3FB97A' : x < 0.85 ? '#E8C547' : x < 0.92 ? '#EE8A3C' : '#E5484D';
B.colorGrade = g => g < -2 ? '#7FA8D6' : g < 2 ? '#3FB97A' : g < 4 ? '#E8C547' : g < 6 ? '#EE8A3C' : '#E5484D';

function nearestHill(lat, lon) { let best = null, bd = Infinity; for (const h of HILLS) { const d = haversine(lat, lon, h.lat, h.lon); if (d < bd) { bd = d; best = h; } } return bd < 3500 ? best : null; }
function nearestPlace(lat, lon) { let best = null, bd = Infinity; for (const p of B.PLACES) { const d = haversine(lat, lon, p.lat, p.lon); if (d < bd) { bd = d; best = p; } } return bd < 12000 ? best : null; }
B.nearestPlace = nearestPlace;

B.analyze = function (ride, prof) {
  const s = ride.s, n = s.t.length;
  const ftp = prof.ftpAt ? prof.ftpAt(ride.date) : prof.ftp;
  const A = { ftp };
  A.n = n; A.dist = s.dist[n - 1] - s.dist[0];
  let moving = 0; for (let i = 0; i < n; i++) if (s.spd[i] > 1) moving++;
  A.moving = moving; A.elapsed = n;
  const alt = centeredMean(s.alt, 21);
  let gain = 0, ref = alt[0];
  for (let i = 1; i < n; i++) { const a = alt[i]; if (a > ref + 2) { gain += a - ref; ref = a; } else if (a < ref - 2) ref = a; }
  A.gain = gain; let amin = Infinity, amax = -Infinity; for (let i = 0; i < n; i++) { if (alt[i] < amin) amin = alt[i]; if (alt[i] > amax) amax = alt[i]; }
  A.altMin = amin; A.altMax = amax;
  A.avgSpeed = moving ? A.dist / moving : 0;
  let maxSpd = 0; const sp5 = centeredMean(s.spd, 5); for (let i = 0; i < n; i++) if (sp5[i] > maxSpd) maxSpd = sp5[i]; A.maxSpeed = maxSpd;
  let hasP = false; for (let i = 0; i < n; i += 10) if (s.pwr[i] > 0) { hasP = true; break; }
  A.hasPower = hasP;
  A.avgP = mean(s.pwr); A.NP = hasP ? normPower(s.pwr) : 0; A.VI = A.avgP ? A.NP / A.avgP : 0;
  A.IF = ftp ? A.NP / ftp : 0; A.TSS = ftp ? (n * A.NP * A.IF) / (ftp * 3600) * 100 : 0;
  let hs = 0, hn = 0, hmax = 0; for (let i = 0; i < n; i++) if (s.hr[i] > 0) { hs += s.hr[i]; hn++; if (s.hr[i] > hmax) hmax = s.hr[i]; }
  A.avgHR = hn ? hs / hn : 0; A.maxHR = hmax; A.hasHR = hn > n * 0.5;
  let cs = 0, cn = 0; for (let i = 0; i < n; i++) if (s.cad[i] > 0) { cs += s.cad[i]; cn++; } A.avgCad = cn ? cs / cn : 0;
  let kj = 0; for (let i = 0; i < n; i++) kj += s.pwr[i]; A.kJ = kj / 1000; A.kcal = A.kJ; // rendement ~24 % : 1 kJ mécanique ≈ 1 kcal
  A.avgTemp = mean(s.tmp);
  // zones
  const zt = new Array(7).fill(0); if (hasP) for (let i = 0; i < n; i++) if (s.spd[i] > 1) zt[zoneIdx(s.pwr[i] / ftp)]++;
  A.zoneTime = zt;
  const p30 = rollingMean(s.pwr, 30); A._p30 = p30;
  // échantillonnage tous les 100 m
  const rs = { d: [], i: [], lat: [], lon: [], alt: [], p30: [], hr: [], cad: [], spd: [], grade: [], t: [] };
  let next = s.dist[0];
  for (let i = 0; i < n; i++) {
    if (s.dist[i] >= next) {
      rs.d.push(s.dist[i] - s.dist[0]); rs.i.push(i); rs.lat.push(s.lat[i]); rs.lon.push(s.lon[i]); rs.alt.push(alt[i]);
      rs.p30.push(p30[i]); rs.hr.push(s.hr[i]); rs.cad.push(s.cad[i]); rs.spd.push(s.spd[i]); rs.t.push(i); next += 100;
    }
  }
  const m = rs.d.length;
  for (let k = 0; k < m; k++) { const a = Math.max(0, k - 1), b = Math.min(m - 1, k + 1); const dd = rs.d[b] - rs.d[a]; rs.grade.push(dd > 0 ? (rs.alt[b] - rs.alt[a]) / dd * 100 : 0); }
  A.rs = rs;
  // découpage par terrain
  const terr = { plat: { t: 0, p: 0, v: 0, c: 0, cn: 0 }, montee: { t: 0, p: 0, v: 0, c: 0, cn: 0 }, descente: { t: 0, p: 0, v: 0, c: 0, cn: 0 } };
  for (let i = 0; i < n; i++) {
    if (s.spd[i] <= 1) continue;
    const k = Math.min(m - 1, Math.floor((s.dist[i] - s.dist[0]) / 100)); const g = rs.grade[k] || 0;
    const b = g > 2 ? terr.montee : g < -2 ? terr.descente : terr.plat;
    b.t++; b.p += s.pwr[i]; b.v += s.spd[i]; if (s.cad[i] > 0) { b.c += s.cad[i]; b.cn++; }
  }
  for (const k in terr) { const b = terr[k]; b.avgP = b.t ? b.p / b.t : 0; b.avgV = b.t ? b.v / b.t : 0; b.avgC = b.cn ? b.c / b.cn : 0; }
  A.terrain = terr;
  // phases (tiers de distance) et quarts
  const idxAtDist = d => lowerBound(s.dist, s.dist[0] + d);
  const phase = (a, b) => { const i0 = idxAtDist(a), i1 = Math.max(i0 + 1, idxAtDist(b)); const pp = mean(s.pwr, i0, i1), hh = meanNZ(s.hr, i0, i1); return { avgP: pp, NP: normPower(s.pwr, i0, i1), hr: hh, spd: (s.dist[i1] - s.dist[i0]) / (i1 - i0), cad: meanNZ(s.cad, i0, i1), EF: hh ? normPower(s.pwr, i0, i1) / hh : 0, i0, i1 }; };
  A.thirds = [phase(0, A.dist / 3), phase(A.dist / 3, 2 * A.dist / 3), phase(2 * A.dist / 3, A.dist)];
  A.q1 = phase(0, A.dist / 4); A.qRest = phase(A.dist / 4, A.dist); A.q4 = phase(3 * A.dist / 4, A.dist);
  const flatP = (a, b) => { const i0 = idxAtDist(a), i1 = idxAtDist(b); let t = 0, p = 0; for (let i = i0; i < i1; i++) { if (s.spd[i] <= 1) continue; const k = Math.min(m - 1, Math.floor((s.dist[i] - s.dist[0]) / 100)); if (Math.abs(rs.grade[k]) < 1.5) { t++; p += s.pwr[i]; } } return t > 300 ? p / t : null; };
  A.flat = { q1: flatP(0, A.dist / 4), rest: flatP(A.dist / 4, A.dist), q4: flatP(3 * A.dist / 4, A.dist) };
  // décrochage aérobie (Pw:HR), hors 10 premières minutes
  if (hasP && A.hasHR && n > 3600) {
    const st = Math.min(600, Math.floor(n * 0.1)); const mid = Math.floor((st + n) / 2);
    const r1 = mean(s.pwr, st, mid) / meanNZ(s.hr, st, mid), r2 = mean(s.pwr, mid, n) / meanNZ(s.hr, mid, n);
    A.decoupling = (r1 - r2) / r1 * 100;
  } else A.decoupling = null;
  // meilleurs efforts
  A.best = {}; for (const [w] of B.POWER_DURS) A.best[w] = hasP ? bestAvg(s.pwr, w) : { v: 0, i: -1 };
  A.bestDist = {}; for (const [D] of B.DIST_RECS) A.bestDist[D] = bestDistTime(s.dist, D);
  // côtes
  A.climbs = detectClimbs(s, alt);
  for (const c of A.climbs) {
    c.time = c.i1 - c.i0; c.avgP = mean(s.pwr, c.i0, c.i1); c.hr = meanNZ(s.hr, c.i0, c.i1); c.cad = meanNZ(s.cad, c.i0, c.i1);
    c.vam = c.gain / (c.time / 3600); const demo = ride.source === 'demo'; const hl = demo ? nearestHill(c.lat1, c.lon1) : null; const pl = demo ? nearestPlace(c.lat1, c.lon1) : null;
    c.hill = hl ? hl.n : null; c.name = hl ? hl.n : demo ? ('Côte près de ' + (pl ? pl.name : 'km ' + Math.round(c.d0 / 1000))) : ('Côte du km ' + Math.round(c.d0 / 1000));
  }
  // vent
  if (ride.wind) {
    const ws = ride.wind.kmh / 3.6; const chunks = [];
    for (let k = 0; k + 10 < m; k += 10) {
      const hd = bearing(rs.lat[k], rs.lon[k], rs.lat[k + 10], rs.lon[k + 10]);
      const head = ws * Math.cos((ride.wind.dir - hd) * RAD);
      const i0 = rs.i[k], i1 = rs.i[k + 10]; const g = (rs.alt[k + 10] - rs.alt[k]) / 10;
      chunks.push({ km0: rs.d[k] / 1000, km1: rs.d[k + 10] / 1000, head, t: i1 - i0, avgP: mean(s.pwr, i0, i1), spd: (s.dist[i1] - s.dist[i0]) / (i1 - i0), grade: g });
    }
    A.windChunks = chunks;
    const thirdP = km => A.thirds[Math.min(2, Math.floor(km * 1000 / (A.dist / 3)))].avgP || 1;
    const agg = f => { let t = 0, p = 0, d = 0, rel = 0; for (const c of chunks) if (f(c)) { t += c.t; p += c.avgP * c.t; d += c.spd * c.t; rel += c.avgP / thirdP((c.km0 + c.km1) / 2) * c.t; } return { t, avgP: t ? p / t : 0, spd: t ? d / t : 0, rel: t ? rel / t : 1 }; };
    const flat = c => Math.abs(c.grade) < 1.5;
    A.wind = { head: agg(c => c.head > 2.5 && flat(c)), tail: agg(c => c.head < -2.5 && flat(c)), side: agg(c => Math.abs(c.head) <= 2.5 && flat(c)) };
    // plus longue portion vent de face
    let bestRun = null, cur = null;
    for (const c of chunks) { if (c.head > 2.5) { if (!cur) cur = { km0: c.km0, km1: c.km1, head: 0, n: 0 }; cur.km1 = c.km1; cur.head += c.head; cur.n++; } else { if (cur && (!bestRun || cur.km1 - cur.km0 > bestRun.km1 - bestRun.km0)) bestRun = cur; cur = null; } }
    if (cur && (!bestRun || cur.km1 - cur.km0 > bestRun.km1 - bestRun.km0)) bestRun = cur;
    if (bestRun) bestRun.headKmh = bestRun.head / bestRun.n * 3.6;
    A.headRun = bestRun;
  }
  return A;
};
function meanNZ(a, from, to) { let s = 0, n = 0; for (let i = from; i < to; i++) if (a[i] > 0) { s += a[i]; n++; } return n ? s / n : 0; }

function detectClimbs(s, alt) {
  const n = s.t.length; const d0 = s.dist[0]; const total = s.dist[n - 1] - d0;
  const step = 50; const N = Math.floor(total / step) + 1; const A = new Float32Array(N), I = new Int32Array(N);
  let j = 0; for (let k = 0; k < N; k++) { const target = d0 + k * step; while (j < n - 1 && s.dist[j] < target) j++; A[k] = alt[j]; I[k] = j; }
  const out = []; let i = 0;
  while (i < N - 2) {
    while (i < N - 2 && A[i + 1] <= A[i]) i++;
    let st = i, mx = A[i], mi = i, k = i + 1;
    for (; k < N; k++) { if (A[k] > mx) { mx = A[k]; mi = k; } if (mx - A[k] > 8 || (k - mi) * step > 800) break; }
    const gain = mx - A[st], len = (mi - st) * step;
    if (gain >= 30 && len >= 600 && gain / len >= 0.025) {
      while (st < mi - 4 && (A[st + 4] - A[st]) / (4 * step) < 0.012) st++;
      const g2 = mx - A[st], l2 = (mi - st) * step;
      out.push({ i0: I[st], i1: I[mi], d0: st * step, d1: mi * step, len: l2, gain: g2, grade: g2 / l2 * 100, lat0: s.lat[I[st]], lon0: s.lon[I[st]], lat1: s.lat[I[mi]], lon1: s.lon[I[mi]] });
      i = mi + 1;
    } else i = Math.max(i + 1, st + 1);
  }
  return out;
}

/* ---------------- Index spatial & segments ---------------- */
function rideIndex(ride) {
  if (ride._idx) return ride._idx;
  const s = ride.s, n = s.t.length; const pts = []; let next = s.dist[0];
  for (let i = 0; i < n; i++) if (s.dist[i] >= next) { pts.push(i); next += 25; }
  const grid = new Map(); const cell = 0.002;
  pts.forEach((i, k) => { const key = Math.floor(s.lat[i] / cell) + ':' + Math.floor(s.lon[i] / (cell * 1.6)); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(k); });
  ride._idx = { pts, grid, cell };
  return ride._idx;
}
function nearHits(ride, lat, lon, maxD) {
  const ix = rideIndex(ride), s = ride.s; const ci = Math.floor(lat / ix.cell), cj = Math.floor(lon / (ix.cell * 1.6)); const hits = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const arr = ix.grid.get((ci + a) + ':' + (cj + b)); if (!arr) continue; for (const k of arr) { const i = ix.pts[k]; const d = haversine(lat, lon, s.lat[i], s.lon[i]); if (d < maxD) hits.push({ k, i, d }); } }
  return hits;
}
function findEffort(ride, seg) {
  const s = ride.s; const starts = nearHits(ride, seg.lat0, seg.lon0, 70); if (!starts.length) return null;
  starts.sort((a, b) => a.i - b.i);
  const ends = nearHits(ride, seg.lat1, seg.lon1, 70); if (!ends.length) return null;
  // premier passage valide : départ puis arrivée, avec une distance cohérente
  let best = null;
  for (const st of starts) {
    if (best && st.i > best.i0 + 300) break;
    for (const en of ends) {
      if (en.i <= st.i) continue;
      const dd = s.dist[en.i] - s.dist[st.i];
      if (Math.abs(dd - seg.len) / seg.len > 0.08) continue;
      const score = st.d + en.d;
      if (!best || score < best.score) best = { i0: st.i, i1: en.i, time: en.i - st.i, score };
    }
  }
  return best;
}
B.buildSegments = function (rides, analyses) {
  const segs = [];
  const near = (a, b, tol) => haversine(a.lat0, a.lon0, b.lat0, b.lon0) < tol && haversine(a.lat1, a.lon1, b.lat1, b.lon1) < tol;
  // côtes
  rides.forEach((r, ri) => {
    for (const c of analyses[ri].climbs) {
      const auto = r.source !== 'demo'; const cand = { type: 'climb', auto, lat0: c.lat0, lon0: c.lon0, lat1: c.lat1, lon1: c.lon1, len: c.len, gain: c.gain, grade: c.grade, name: auto ? `Côte de ${fmtKm(c.len)} à ${c.grade.toFixed(1).replace('.', ',')} %` : c.name, hill: c.hill };
      if (!segs.some(sg => sg.type === 'climb' && near(sg, cand, 250))) segs.push(cand);
    }
  });
  const overlap = (sg, r, i0, i1) => { // part du tronçon candidat déjà couverte par une portion existante
    if (!sg.src) return 0; let hit = 0, tot = 0; const s = r.s;
    for (let i = i0; i <= i1; i += 60) { tot++; if (nearHits(sg.src.ride, s.lat[i], s.lon[i], 60).some(h => h.i >= sg.src.i0 && h.i <= sg.src.i1)) hit++; }
    return tot ? hit / tot : 0;
  };
  // portions communes entre sorties (au moins 8 km)
  const firstP = Math.max(0, rides.length - 30); // recherche de portions limitée aux 30 dernières sorties
  for (let a = firstP; a < rides.length; a++) {
    for (let b = firstP; b < a; b++) {
      const ra = rides[a], rb = rides[b]; const ia = rideIndex(ra); const sa = ra.s;
      let run = null; const runs = [];
      for (let k = 0; k < ia.pts.length; k++) {
        const i = ia.pts[k]; const hit = nearHits(rb, sa.lat[i], sa.lon[i], 45).length > 0;
        if (hit) { if (!run) run = { k0: k, k1: k }; else run.k1 = k; }
        else if (run) { runs.push(run); run = null; }
      }
      if (run) runs.push(run);
      for (const ru of runs) {
        const len = (ru.k1 - ru.k0) * 25; if (len < 8000) continue;
        const parts = Math.ceil(len / 18000); const pl = Math.floor((ru.k1 - ru.k0) / parts);
        for (let q = 0; q < parts; q++) {
          const k0 = ru.k0 + q * pl, k1 = q === parts - 1 ? ru.k1 : ru.k0 + (q + 1) * pl;
          const i0 = ia.pts[k0], i1 = ia.pts[k1]; const L = sa.dist[i1] - sa.dist[i0]; if (L < 7000) continue;
          const cand = { type: 'portion', lat0: sa.lat[i0], lon0: sa.lon[i0], lat1: sa.lat[i1], lon1: sa.lon[i1], len: L, gain: 0 };
          if (segs.some(sg => sg.type === 'portion' && (near(sg, cand, 600) || overlap(sg, ra, i0, i1) > 0.5))) continue;
          cand.src = { ride: ra, i0, i1 };
          const p0 = nearestPlace(cand.lat0, cand.lon0), p1 = nearestPlace(cand.lat1, cand.lon1);
          cand.name = (p0 ? p0.name : 'Km ' + Math.round(sa.dist[i0] / 1000)) + ' → ' + (p1 ? p1.name : 'km ' + Math.round(sa.dist[i1] / 1000));
          if (p0 && p1 && p0.key === p1.key) cand.name = 'Boucle autour de ' + p0.name;
          if (ra.source !== 'demo') { cand.auto = true; cand.name = 'Portion de ' + fmtKm(L); }
          segs.push(cand);
        }
      }
    }
  }
  // efforts
  segs.forEach((sg, k) => {
    sg.id = 'seg' + k; sg.efforts = [];
    rides.forEach((r, ri) => {
      const e = findEffort(r, sg); if (!e) return;
      const s = r.s; const A = analyses[ri];
      let head = null;
      if (r.wind) { const hd = bearing(s.lat[e.i0], s.lon[e.i0], s.lat[e.i1], s.lon[e.i1]); head = r.wind.kmh * Math.cos((r.wind.dir - hd) * RAD); }
      sg.efforts.push({ ride: r.id, date: r.date, time: e.time, i0: e.i0, i1: e.i1, avgP: mean(s.pwr, e.i0, e.i1), hr: meanNZ(s.hr, e.i0, e.i1), cad: meanNZ(s.cad, e.i0, e.i1), ftp: A.ftp, head, kmStart: (s.dist[e.i0] - s.dist[0]) / 1000 });
    });
    sg.efforts.sort((x, y) => x.time - y.time);
    sg.efforts.forEach((e, r) => e.rank = r + 1);
    if (sg.type === 'portion' && !sg.gain) {
      const e = sg.efforts[0]; if (e) { const r = rides.find(x => x.id === e.ride); let g = 0, ref = r.s.alt[e.i0]; for (let i = e.i0; i < e.i1; i += 5) { const a = r.s.alt[i]; if (a > ref + 2) { g += a - ref; ref = a; } else if (a < ref - 2) ref = a; } sg.gain = g; sg.grade = 0; }
    }
  });
  // nom des versants si plusieurs côtes sur la même colline
  const byHill = {};
  segs.filter(s => s.type === 'climb' && s.hill).forEach(s => (byHill[s.hill] = byHill[s.hill] || []).push(s));
  for (const h in byHill) if (byHill[h].length > 1) byHill[h].forEach(s => {
    const hill = HILLS.find(x => x.n === h); const br = bearing(hill.lat, hill.lon, s.lat0, s.lon0);
    const dir = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'][Math.round(br / 45) % 8];
    s.name = h + ' · versant ' + dir;
  });
  segs.forEach(s => delete s.src);
  return segs.filter(s => s.efforts.length >= (s.type === 'portion' ? 2 : 1));
};

/* ---------------- Charge d'entraînement (PMC) ---------------- */
B.pmc = function (rides, analyses, untilDate) {
  const daily = {}; rides.forEach((r, i) => { const d = r.date.slice(0, 10); daily[d] = (daily[d] || 0) + analyses[i].TSS; });
  const first = new Date(rides[0].date.slice(0, 10) + 'T00:00:00Z'); const last = new Date((untilDate || rides[rides.length - 1].date).slice(0, 10) + 'T00:00:00Z');
  const span = Math.min(28, Math.max(7, Math.round((last - first) / 86400000) + 1)); let seed = 0; for (const k in daily) if (new Date(k + 'T00:00:00Z') - first < span * 86400000) seed += daily[k]; seed /= span;
  const out = []; let ctl = seed, atl = seed; const kc = Math.exp(-1 / 42), ka = Math.exp(-1 / 7);
  for (let t = first.getTime(); t <= last.getTime(); t += 86400000) {
    const key = new Date(t).toISOString().slice(0, 10); const tss = daily[key] || 0;
    const tsb = ctl - atl; ctl = ctl * kc + tss * (1 - kc); atl = atl * ka + tss * (1 - ka);
    out.push({ date: key, tss, ctl, atl, tsb });
  }
  return out;
};

/* ---------------- Conseils de sortie (moteur de règles) ---------------- */
const fmtW = w => Math.round(w) + ' W';
const fmtPct = x => (x >= 0 ? '+' : '') + Math.round(x) + ' %';
const fmtKm = d => (d / 1000).toFixed(d < 10000 ? 1 : 0).replace('.', ',') + ' km';
B.rideAdvice = function (ride, A, ctx) {
  const out = []; const ftp = A.ftp; const hours = A.moving / 3600;
  // 1. Gestion de l'allure : départ trop rapide ?
  if (A.hasPower && A.dist > 40000) {
    const F = A.flat; const useF = F.q1 && F.rest && F.q4;
    const ratio = useF ? F.q1 / F.rest : A.q1.NP / A.qRest.NP; const fade = useF ? F.q4 / F.q1 : A.q4.avgP / A.q1.avgP;
    if (ratio > 1.07 && fade < 0.9) out.push({ kind: 'travail', title: 'Départ trop rapide', metric: fmtPct((ratio - 1) * 100),
      text: `Sur le plat, pendant le premier quart (${fmtKm(A.dist / 4)}), tu roulais à ${fmtW(useF ? F.q1 : A.q1.NP)}, soit ${Math.round((ratio - 1) * 100)} % au-dessus du reste de la sortie. Sur le dernier quart, tu n’avais plus que ${Math.round(fade * 100)} % de cette puissance.`,
      tip: `La prochaine fois, roule autour de ${fmtW(useF ? F.rest : A.qRest.NP)} sur le plat dès le départ : tu garderas des jambes pour la fin.`,
      why: 'En contre-la-montre, les cyclistes partent habituellement trop vite et gagnent du temps avec une allure régulière.', src: ['atkinson'] });
    else if (fade >= 0.93 && ratio < 1.05) out.push({ kind: 'fort', title: 'Effort bien réparti', metric: Math.round(fade * 100) + ' %',
      text: `Tu as fini la sortie avec ${Math.round(fade * 100)} % de ta puissance du début. C’est le signe d’une allure bien dosée.`,
      tip: 'Continue à partir sur ce rythme : c’est ce qui permet de faire de longues distances sans exploser.', why: 'Une allure régulière est plus rapide qu’un départ en trombe.', src: ['atkinson'] });
  }
  // 2. Décrochage cardiaque
  if (A.decoupling != null && hours > 1.5) {
    const dc = A.decoupling;
    if (dc < 5) out.push({ kind: 'fort', title: 'Cœur stable du début à la fin', metric: dc.toFixed(1).replace('.', ',') + ' %',
      text: `Ton rapport puissance/cardio n’a baissé que de ${dc.toFixed(1).replace('.', ',')} % entre la 1re et la 2e moitié de la sortie.`,
      tip: hours > 3 ? 'Ta base d’endurance est solide à cette intensité : tu peux allonger un peu tes sorties ou monter légèrement l’allure.' : 'Ta base d’endurance est solide à cette intensité.',
      why: 'Joe Friel considère qu’un décrochage inférieur à 5 % traduit une bonne endurance aérobie.', src: ['friel'] });
    else out.push({ kind: 'travail', title: dc > 10 ? 'Le cœur a fortement dérivé' : 'Le cœur a dérivé en fin de sortie', metric: dc.toFixed(1).replace('.', ',') + ' %',
      text: `Pour les mêmes watts, ton cœur battait nettement plus vite en 2e moitié : le rapport puissance/cardio a baissé de ${dc.toFixed(1).replace('.', ',')} %.`,
      tip: hours > 2.5 ? `Sur une sortie de ${Math.round(hours)} h, vise 60 à 90 g de glucides par heure (barres, gels, boisson) et 500 à 800 ml d’eau par heure, en commençant dès la première heure.` : 'Pense à boire régulièrement et à garder une allure plus facile sur la première moitié.',
      why: 'Entre 5 et 10 %, c’est un signe de fatigue ou d’endurance limitée ; au-delà de 10 %, l’effort était trop intense ou le carburant a manqué.', src: hours > 2.5 ? ['friel2', 'carbs', 'hydra'] : ['friel2'] });
  }
  // 3. Vent
  if (A.wind && A.wind.head.t > 600 && A.wind.tail.t > 600 && A.hasPower) {
    const r = A.wind.head.rel / A.wind.tail.rel;
    if (r < 1.03) out.push({ kind: 'travail', title: 'Face au vent, appuie un peu plus', metric: fmtPct((r - 1) * 100),
      text: `Une fois corrigé de ta fatigue au fil de la sortie, ton effort face au vent n’était que ${Math.round((r - 1) * 100)} % au-dessus de ton effort vent dans le dos (${fmtW(A.wind.head.avgP)} contre ${fmtW(A.wind.tail.avgP)} en moyenne brute).`,
      tip: `Monte d’environ 5 % face au vent (≈ ${fmtW(A.wind.head.avgP * 1.05)}) et relâche de 5 % vent dans le dos : pour la même fatigue, tu vas plus vite au total.`,
      why: 'Les études montrent qu’on perd plus de temps face au vent qu’on n’en regagne vent dans le dos ; varier sa puissance d’environ ±5 % est plus efficace.', src: ['atkinson', 'swain'] });
    else if (r >= 1.04) out.push({ kind: 'fort', title: 'Bonne gestion du vent', metric: fmtPct((r - 1) * 100),
      text: `À fatigue égale, tu as appuyé environ ${Math.round((r - 1) * 100)} % plus fort face au vent que vent dans le dos. C’est exactement la bonne stratégie.`,
      tip: 'Garde ce réflexe : on perd plus de temps face au vent qu’on n’en regagne vent dans le dos.', why: 'Varier la puissance d’environ ±5 % selon le vent fait gagner du temps pour la même fatigue.', src: ['atkinson', 'swain'] });
  }
  if (A.headRun && A.headRun.km1 - A.headRun.km0 >= 8) out.push({ kind: 'contexte', title: 'Le vent, pas les jambes', metric: Math.round(A.headRun.headKmh) + ' km/h',
    text: `Du km ${Math.round(A.headRun.km0)} au km ${Math.round(A.headRun.km1)}, tu avais environ ${Math.round(A.headRun.headKmh)} km/h de vent de face. La baisse de vitesse sur cette portion vient du vent, pas d’une baisse de forme.`,
    tip: 'Sur ces portions, compare tes watts plutôt que ta vitesse.', why: 'Le vent change la vitesse, pas l’effort fourni : les watts restent la mesure juste.', src: ['swain'] });
  // 4. Côtes
  if (A.hasPower) {
    const hard = A.climbs.filter(c => c.time > 240 && c.avgP / ftp > 1.05).sort((a, b) => b.avgP - a.avgP)[0];
    const good = A.climbs.filter(c => c.time > 180 && c.avgP / ftp >= 0.85 && c.avgP / ftp <= 1.05).sort((a, b) => b.time - a.time)[0];
    if (hard) out.push({ kind: 'travail', title: 'Trop dans le rouge : ' + hard.name, metric: Math.round(hard.avgP / ftp * 100) + ' % FTP',
      text: `Tu as monté ${hard.name} (${fmtKm(hard.len)} à ${hard.grade.toFixed(1).replace('.', ',')} %) à ${fmtW(hard.avgP)} pendant ${Math.round(hard.time / 60)} min, soit ${Math.round(hard.avgP / ftp * 100)} % de ta FTP.`,
      tip: `Sur une côte de plus de 4 min au milieu d’une longue sortie, vise ${fmtW(ftp * 0.95)} à ${fmtW(ftp * 1.02)} : un peu plus que sur le plat, mais pas plus.`,
      why: 'Les études sur les parcours vallonnés montrent qu’environ +5 % en montée est tenable ; au-delà, l’effort se paie en fin de parcours.', src: ['atkinson2', 'coggan'] });
    else if (good) out.push({ kind: 'fort', title: 'Montée maîtrisée : ' + good.name, metric: Math.round(good.avgP / ftp * 100) + ' % FTP',
      text: `${good.name} montée à ${fmtW(good.avgP)} (${Math.round(good.avgP / ftp * 100)} % de ta FTP) en ${Math.round(good.time / 60)} min ${String(good.time % 60).padStart(2, '0')} s : un effort soutenu et bien dosé.`,
      tip: 'C’est la bonne intensité pour monter sans hypothéquer la suite de la sortie.', why: 'Un léger surplus de puissance en montée fait gagner du temps sans fatigue excessive.', src: ['atkinson2'] });
    const lowCad = A.climbs.filter(c => c.time > 120 && c.cad > 0 && c.cad < 66);
    if (lowCad.length) { const c = lowCad.sort((a, b) => a.cad - b.cad)[0]; out.push({ kind: 'travail', title: 'Cadence basse en côte', metric: Math.round(c.cad) + ' tr/min',
      text: `Dans ${c.name}, tu as pédalé en moyenne à ${Math.round(c.cad)} tours par minute. À cette cadence, chaque coup de pédale demande beaucoup de force aux cuisses.`,
      tip: 'Passe un pignon plus grand plus tôt pour rester entre 70 et 85 tr/min. Si tu es déjà sur ton plus grand pignon, une cassette plus large peut aider. Inutile en revanche de chercher à mouliner comme un pro.',
      why: 'Sous 60 tr/min, le coût musculaire grimpe fortement ; chez les cyclistes plus âgés, une cadence très élevée n’est pas plus efficace non plus.', src: ['cadence', 'cadenceAge'] }); }
  }
  // 4 bis. Cadence sur le plat
  if (A.terrain.plat.avgC >= 80 && A.terrain.plat.avgC <= 95) out.push({ kind: 'fort', title: 'Bonne cadence sur le plat', metric: Math.round(A.terrain.plat.avgC) + ' tr/min',
    text: `Sur le plat, tu as pédalé en moyenne à ${Math.round(A.terrain.plat.avgC)} tours par minute.`, tip: 'C’est la plage où les cyclistes entraînés trouvent le meilleur équilibre entre fatigue musculaire et cardio. Ne change rien.',
    why: 'Sur le plat, 85–95 tr/min est la plage la plus courante chez les cyclistes entraînés ; ta cadence naturelle est souvent proche de ton optimum.', src: ['cadenceFlat'] });
  if (A.hasPower && A.VI > 0 && A.VI <= 1.05 && A.dist > 40000) out.push({ kind: 'fort', title: 'Effort très régulier', metric: 'VI ' + A.VI.toFixed(2).replace('.', ','),
    text: `Ta puissance normalisée (${fmtW(A.NP)}) est très proche de ta moyenne (${fmtW(A.avgP)}) : peu d’à-coups.`, tip: 'Un effort lisse fatigue moins pour la même vitesse moyenne.', why: 'Un indice de variabilité (VI) de 1,00 à 1,06 indique un effort très régulier.', src: ['vi'] });
  // 5. Régularité
  if (A.hasPower && A.VI > 1.12) out.push({ kind: 'travail', title: 'Effort en dents de scie', metric: 'VI ' + A.VI.toFixed(2).replace('.', ','),
    text: `Ta puissance normalisée (${fmtW(A.NP)}) dépasse nettement ta moyenne (${fmtW(A.avgP)}) : beaucoup de relances et de coups d’accélérateur.`,
    tip: 'Sur les longues sorties, cherche à lisser l’effort : relances plus douces, moins de pics.', why: 'Un indice de variabilité (VI) de 1,00 à 1,06 indique un effort très régulier.', src: ['vi', 'tpgloss'] });
  // 6. Charge
  if (A.TSS > 200) out.push({ kind: 'contexte', title: 'Grosse charge de travail', metric: 'TSS ' + Math.round(A.TSS),
    text: `Cette sortie représente un score de charge (TSS) de ${Math.round(A.TSS)} : l’équivalent de plus de deux heures à fond.`,
    tip: 'Prévois 2 à 3 jours plus tranquilles avant ta prochaine séance intense.', why: 'Après 50 ans, il faut en général 72 à 96 h entre deux séances dures, contre 48 h pour un plus jeune.', src: ['coggan2', 'masters'] });
  const order = { fort: 0, travail: 1, contexte: 2 };
  const forts = out.filter(a => a.kind === 'fort').slice(0, 2), trav = out.filter(a => a.kind === 'travail').slice(0, 4), ctxt = out.filter(a => a.kind === 'contexte').slice(0, 2);
  return forts.concat(trav, ctxt);
};

/* ---------------- Conseils de la semaine ---------------- */
B.weekAdvice = function (rides, analyses, pmc, prof) {
  const out = []; const today = pmc[pmc.length - 1];
  const lastDate = new Date(rides[rides.length - 1].date);
  const from = lastDate.getTime() - 14 * 86400000;
  const zt = new Array(7).fill(0);
  rides.forEach((r, i) => { if (new Date(r.date).getTime() > from) analyses[i].zoneTime.forEach((t, z) => zt[z] += t); });
  const tot = zt.reduce((a, b) => a + b, 0) || 1;
  const low = (zt[0] + zt[1]) / tot, mid = (zt[2] + zt[3]) / tot, high = (zt[4] + zt[5] + zt[6]) / tot;
  const tsb = today.tsb;
  if (tsb < -25) out.push({ kind: 'travail', title: 'Tu es bien chargé', metric: 'Forme ' + Math.round(tsb),
    text: `Ta fatigue (${Math.round(today.atl)}) dépasse nettement ta forme de fond (${Math.round(today.ctl)}). Le corps a besoin d’assimiler.`,
    tip: 'Prochaine sortie : 1 h 30 à 2 h très facile, en zone 1–2, ou un jour de repos complet.', why: 'Forme = condition de fond (CTL) − fatigue (ATL). Après 50 ans, la récupération entre séances dures prend plus de temps.', src: ['pmc', 'fascat', 'masters'] });
  else if (tsb > 5) out.push({ kind: 'fort', title: 'Tu es frais', metric: 'Forme +' + Math.round(tsb),
    text: 'Ta fatigue est basse par rapport à ta forme de fond : c’est le bon moment pour une séance de qualité.', tip: 'Profites-en pour une sortie avec un bloc intense, ou pour une longue distance.', why: 'Une forme positive indique que tu as récupéré de la charge des semaines passées.', src: ['pmc'] });
  else out.push({ kind: 'contexte', title: 'Charge productive', metric: 'Forme ' + Math.round(tsb),
    text: `Ta forme de fond est de ${Math.round(today.ctl)} et ta fatigue de ${Math.round(today.atl)} : tu travailles, sans excès.`, tip: 'Continue sur ce rythme en gardant au moins une sortie vraiment facile par semaine.', why: 'Une forme légèrement négative est la zone habituelle d’une bonne période d’entraînement.', src: ['pmc'] });
  if (mid > 0.3) out.push({ kind: 'travail', title: 'Trop de temps « entre deux »', metric: Math.round(mid * 100) + ' % en Z3–Z4',
    text: `Sur les 14 derniers jours, ${Math.round(mid * 100)} % de ton temps de pédalage était en zone tempo/seuil, et seulement ${Math.round(low * 100)} % en endurance facile.`,
    tip: 'Rends tes sorties faciles vraiment faciles, et garde l’intensité pour 1 à 2 séances courtes par semaine.', why: 'Les meilleurs athlètes d’endurance passent environ 80 % de leur temps à basse intensité.', src: ['seiler'] });
  else out.push({ kind: 'fort', title: 'Bonne répartition des intensités', metric: Math.round(low * 100) + ' % facile',
    text: `${Math.round(low * 100)} % de ton temps de pédalage sur 14 jours était en endurance facile.`, tip: 'C’est la base qui permet de progresser sans s’user.', why: 'Environ 80 % du temps à basse intensité, c’est ce que font les meilleurs.', src: ['seiler'] });
  if (high < 0.02) out.push({ kind: 'contexte', title: 'Ajoute un peu d’intensité', metric: Math.round(high * 1000) / 10 + ' % en Z5+',
    text: 'Tu n’as presque pas roulé au-dessus de ton seuil ces deux dernières semaines.', tip: 'Une fois par semaine : 5 × 4 min soutenues (zone 5) avec 4 min faciles entre chaque, sur une sortie de 1 h 30. Si tu n’as pas fait d’effort intense depuis longtemps, demande d’abord l’avis de ton médecin.',
    why: 'Joe Friel insiste : après 50 ans, il faut garder de l’intensité, mais réduire la fréquence des séances dures et allonger la récupération.', src: ['masters'] });
  // prochaine sortie
  const daysSinceHard = (() => { for (let i = rides.length - 1; i >= 0; i--) if (analyses[i].TSS > 200 || analyses[i].IF > 0.85) return Math.round((lastDate - new Date(rides[i].date)) / 86400000); return 99; })();
  out.push({ kind: 'plan', title: 'Ta prochaine sortie', metric: tsb < -25 ? 'Récupération' : daysSinceHard < 3 ? 'Endurance' : 'Qualité',
    text: tsb < -25 ? '1 h 30 très facile, à moins de 75 % de ta FTP, terrain plat.' : daysSinceHard < 3 ? `2 h à 3 h en endurance (${Math.round(prof.ftp * 0.56)}–${Math.round(prof.ftp * 0.75)} W), cadence souple.` : `1 h 45 avec 2 × 20 min à ${Math.round(prof.ftp * 0.88)}–${Math.round(prof.ftp * 0.94)} W.`,
    tip: 'Garde au moins 72 h entre deux séances dures.', why: 'Planifier selon la fatigue évite le surentraînement.', src: ['masters', 'coggan'] });
  return out;
};

/* ---------------- Comparaison de deux sorties ---------------- */
B.compareText = function (A1, A2, r1, r2) {
  const lines = [];
  const f1 = A1.thirds[2].avgP / A1.thirds[0].avgP, f2 = A2.thirds[2].avgP / A2.thirds[0].avgP;
  if (Math.abs(f1 - f2) > 0.05) { const better = f1 > f2 ? 1 : 2; lines.push(`En fin de sortie, tu as gardé ${Math.round((better === 1 ? f1 : f2) * 100)} % de ta puissance du début sur la sortie ${better}, contre ${Math.round((better === 1 ? f2 : f1) * 100)} % sur l’autre : meilleure gestion de l’effort.`); }
  const e1 = A1.NP / (A1.avgHR || 1), e2 = A2.NP / (A2.avgHR || 1);
  if (Math.abs(e1 - e2) / Math.min(e1, e2) > 0.03) lines.push(`Efficacité (watts par battement) : ${e1.toFixed(2).replace('.', ',')} contre ${e2.toFixed(2).replace('.', ',')}. Ce chiffre monte avec l’intensité : il ne dit vraiment quelque chose sur ta forme qu’entre deux sorties d’intensité proche (IF ${A1.IF.toFixed(2).replace('.', ',')} contre ${A2.IF.toFixed(2).replace('.', ',')}).`);
  if (A1.decoupling != null && A2.decoupling != null) lines.push(`Décrochage cardiaque : ${A1.decoupling.toFixed(1).replace('.', ',')} % contre ${A2.decoupling.toFixed(1).replace('.', ',')} % (moins de 5 % = bonne endurance).`);
  if (r1.wind && r2.wind && Math.abs(r1.wind.kmh - r2.wind.kmh) > 8) lines.push(`Attention au contexte : ${r1.wind.kmh} km/h de vent d’un côté, ${r2.wind.kmh} km/h de l’autre. Compare les watts plutôt que la vitesse.`);
  const m1 = A1.terrain.montee.avgP, m2 = A2.terrain.montee.avgP;
  if (m1 && m2 && Math.abs(m1 - m2) > 10) lines.push(`En montée, puissance moyenne de ${Math.round(m1)} W contre ${Math.round(m2)} W.`);
  return lines;
};

/* ---------------- Calcul complet ---------------- */
B.run = function (rides, profile) {
  rides.sort((a, b) => a.date < b.date ? -1 : 1);
  const b20 = rides.map(r => bestAvg(r.s.pwr, 1200).v);
  const ftpAuto = date => {
    let t = new Date(date).getTime(); let m = 0; const first = new Date(rides[0].date).getTime();
    if (t - 42 * 86400000 < first) t = first + 42 * 86400000; // historique trop court : on prend les 6 premières semaines
    rides.forEach((r, i) => { const tr = new Date(r.date).getTime(); if (tr <= t && tr > t - 42 * 86400000 && b20[i] > m) m = b20[i]; });
    return m ? Math.round(m * 0.95) : (profile.ftpManual || 220);
  };
  const ftpAt = date => profile.ftpManual ? profile.ftpManual : ftpAuto(date);
  const analyses = rides.map(r => B.analyze(r, { ftpAt }));
  const segments = B.buildSegments(rides, analyses);
  // records : pour chaque sortie, comparaison aux sorties précédentes
  rides.forEach((r, i) => {
    const A = analyses[i]; A.prs = [];
    for (const [w, label] of B.POWER_DURS) { const prev = Math.max(0, ...analyses.slice(0, i).map(x => x.best[w].v)); if (i > 0 && A.best[w].v > prev && prev > 0) A.prs.push({ kind: 'power', label: 'Meilleure puissance sur ' + label, value: Math.round(A.best[w].v) + ' W', delta: '+' + Math.round(A.best[w].v - prev) + ' W' }); }
    for (const [D, label] of B.DIST_RECS) { const cur = A.bestDist[D]; if (!cur) continue; const prevs = analyses.slice(0, i).map(x => x.bestDist[D]).filter(Boolean).map(x => x.t); if (prevs.length && cur.t < Math.min(...prevs)) A.prs.push({ kind: 'dist', label: 'Meilleur temps sur ' + label, value: fmtDur(cur.t), delta: '−' + fmtDur(Math.min(...prevs) - cur.t) }); }
    A.segEfforts = [];
    segments.forEach(sg => {
      const e = sg.efforts.find(x => x.ride === r.id); if (!e) return;
      const before = sg.efforts.filter(x => x.date < r.date);
      const prevBest = before.length ? Math.min(...before.map(x => x.time)) : null;
      A.segEfforts.push({ seg: sg, e, prevBest, isPR: prevBest != null && e.time < prevBest, passes: before.length + 1, rankBefore: before.filter(x => x.time < e.time).length + 1 });
      if (prevBest != null && e.time < prevBest) A.prs.push({ kind: 'seg', seg: sg, label: sg.name, value: fmtDur(e.time), delta: '−' + fmtDur(prevBest - e.time) });
    });
  });
  analyses.forEach(A => A.climbs.forEach(c => { c.segRef = segments.find(sg => sg.type === 'climb' && haversine(sg.lat0, sg.lon0, c.lat0, c.lon0) < 250 && haversine(sg.lat1, sg.lon1, c.lat1, c.lon1) < 250) || null; if (c.segRef) c.name = c.segRef.name; }));
  const pmc = B.pmc(rides, analyses);
  const lastFtp = ftpAt(rides[rides.length - 1].date);
  return { rides, analyses, segments, pmc, ftpAt, ftpAuto, lastFtp, b20 };
};
function fmtDur(sec) { sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; }
B.fmtDur = fmtDur;

root.Braquet = B;
if (typeof module !== 'undefined') module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
