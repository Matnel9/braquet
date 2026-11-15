/* Braquet — processus principal (fenêtre, bibliothèque de sorties, compteur, météo) */
const { app, BrowserWindow, ipcMain, shell, Menu, dialog, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');

if (process.env.BRAQUET_USERDATA) app.setPath('userData', process.env.BRAQUET_USERDATA);
const TEST = process.env.BRAQUET_TEST || null;

app.commandLine.appendSwitch('lang', 'fr-FR');
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
const userDir = () => app.getPath('userData');
const safeId = id => String(id || 'p1').replace(/[^\w-]/g, '') || 'p1';
const actDir = pid => path.join(userDir(), 'sorties', safeId(pid));
const storeFile = () => path.join(userDir(), 'braquet.json');
const UA = 'Braquet/1.0 (personal cycling analysis desktop app)';
const REPO = 'Matnel9/braquet';
const UPDATE_URLS = process.env.BRAQUET_UPDATE_URL ? [process.env.BRAQUET_UPDATE_URL] : [`https://raw.githubusercontent.com/${REPO}/main/version.json`, `https://github.com/${REPO}/releases/latest/download/version.json`];

/* ---------- Réglages enregistrés ---------- */
let store = {};
function loadStore() {
  for (const f of [storeFile(), storeFile() + '.bak']) {
    try { store = JSON.parse(fs.readFileSync(f, 'utf8')) || {}; return; } catch (e) { /* fichier absent ou abîmé : on essaie la copie */ }
  }
  store = {};
}
let saving = Promise.resolve();
function saveStore() {
  const data = JSON.stringify(store);
  saving = saving.then(async () => {
    const tmp = storeFile() + '.tmp';
    await fsp.writeFile(tmp, data, 'utf8');
    try { await fsp.copyFile(storeFile(), storeFile() + '.bak'); } catch (e) { /* première écriture */ }
    await fsp.rename(tmp, storeFile());
  }).catch(e => console.error('saveStore', e));
  return saving;
}

/* ---------- Bibliothèque de sorties ---------- */
const safeName = n => path.basename(String(n)).replace(/[^\w.\- ]/g, '_');
async function migrate() { // anciennes sorties (avant les profils) → premier profil
  const root = path.join(userDir(), 'sorties'); let names = [];
  try { names = (await fsp.readdir(root)).filter(n => /\.fit$/i.test(n)); } catch (e) { return; }
  if (!names.length) return; await fsp.mkdir(actDir('p1'), { recursive: true });
  for (const n of names) { try { await fsp.rename(path.join(root, n), path.join(actDir('p1'), n)); } catch (e) { console.error('migrate', e.message); } }
}
async function listLib(pid) {
  await fsp.mkdir(actDir(pid), { recursive: true });
  const out = [];
  for (const n of await fsp.readdir(actDir(pid))) {
    if (!/\.fit$/i.test(n)) continue;
    try { const st = await fsp.stat(path.join(actDir(pid), n)); out.push({ name: n, size: st.size }); } catch (e) { /* ignoré */ }
  }
  return out.sort((a, b) => a.name < b.name ? -1 : 1);
}
async function addToLib(pid, name, getData, size) {
  await fsp.mkdir(actDir(pid), { recursive: true });
  let n = safeName(name); if (!/\.fit$/i.test(n)) n += '.fit';
  let dest = path.join(actDir(pid), n);
  try {
    const st = await fsp.stat(dest);
    if (size != null && st.size === size) return null; // déjà importée
    n = n.replace(/\.fit$/i, '') + '-' + Date.now() + '.fit'; dest = path.join(actDir(pid), n);
  } catch (e) { /* nouveau fichier */ }
  await getData(dest);
  return n;
}

/* ---------- Détection du compteur Garmin ---------- */
const SUBDIRS = [['Garmin', 'Activity'], ['GARMIN', 'ACTIVITY'], ['GARMIN', 'Activity'], ['Garmin', 'Activities'], ['Garmin', 'ACTIVITY']];
async function isDir(p) { try { return (await fsp.stat(p)).isDirectory(); } catch (e) { return false; } }
async function candidateRoots() {
  const roots = [];
  if (process.env.BRAQUET_DEVICE) roots.push(process.env.BRAQUET_DEVICE);
  if (process.platform === 'win32') { for (const L of 'DEFGHIJKLMNOPQRSTUVWXYZAB') roots.push(L + ':\\'); }
  else if (process.platform === 'darwin') { try { for (const v of await fsp.readdir('/Volumes')) roots.push(path.join('/Volumes', v)); } catch (e) { /* aucun volume */ } }
  else {
    const u = os.userInfo().username;
    for (const base of ['/media/' + u, '/run/media/' + u, '/media']) { try { for (const v of await fsp.readdir(base)) roots.push(path.join(base, v)); } catch (e) { /* absent */ } }
  }
  return roots;
}
async function findDevice() {
  for (const root of await candidateRoots()) {
    for (const sub of SUBDIRS) { const d = path.join(root, ...sub); if (await isDir(d)) return { root, dir: d }; }
  }
  return null;
}
let device = { state: 'disconnected' }; let scanning = false; let pollTimer = null;
function send(evt) { if (win && !win.isDestroyed()) win.webContents.send('device', evt); }
async function importFromDevice(dir, pid) {
  const added = []; let found = 0;
  for (const n of await fsp.readdir(dir)) {
    if (!/\.fit$/i.test(n)) continue; found++;
    try {
      const src = path.join(dir, n); const st = await fsp.stat(src);
      if (!st.isFile() || st.size < 200) continue;
      const got = await addToLib(pid, n, dest => fsp.copyFile(src, dest), st.size);
      if (got) added.push(got);
    } catch (e) { console.error('import', n, e.message); }
  }
  return { added, found };
}
async function poll() {
  if (scanning) return; scanning = true;
  try {
    const d = await findDevice();
    if (d) {
      if (device.state !== 'connected' || device.root !== d.root) {
        let serial = null;
        for (const f of ['GarminDevice.xml', 'GARMINDEVICE.XML']) { try { const x = await fsp.readFile(path.join(d.root, 'Garmin', f), 'utf8'); const m = x.match(/<Id>\s*(\d+)\s*<\/Id>/); if (m) { serial = m[1]; break; } } catch (e) { /* absent */ } }
        let model = null; try { const x = await fsp.readFile(path.join(d.root, 'Garmin', 'GarminDevice.xml'), 'utf8'); const m = x.match(/<Description>\s*([^<]+?)\s*<\/Description>/); if (m) model = m[1]; } catch (e) { /* absent */ }
        device = { state: 'connected', root: d.root, dir: d.dir, serial };
        send({ state: 'connected', serial, model });
      }
    } else if (device.state === 'connected') { device = { state: 'disconnected' }; send({ state: 'disconnected' }); }
  } catch (e) { console.error('poll', e); }
  scanning = false;
}

/* ---------- Météo (Open-Meteo) ---------- */
async function getJSON(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try { const r = await net.fetch(url, { headers: { 'User-Agent': UA }, signal: ctl.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
async function weather(q) {
  const start = new Date(q.start), end = new Date(q.end);
  const d0 = start.toISOString().slice(0, 10), d1 = end.toISOString().slice(0, 10);
  const params = `latitude=${(+q.lat).toFixed(4)}&longitude=${(+q.lon).toFixed(4)}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m&start_date=${d0}&end_date=${d1}&timezone=GMT&wind_speed_unit=kmh`;
  const recent = (Date.now() - start.getTime()) / 86400000 < 80;
  const forecast = 'https://api.open-meteo.com/v1/forecast?' + params, archive = 'https://archive-api.open-meteo.com/v1/archive?' + params;
  let lastErr = null;
  for (const url of (recent ? [forecast, archive] : [archive, forecast])) {
    try {
      const j = await getJSON(url); const h = j && j.hourly; if (!h || !h.time) continue;
      const t0 = Math.floor(start.getTime() / 3600000) * 3600000, t1 = Math.ceil(end.getTime() / 3600000) * 3600000;
      let sx = 0, sy = 0, sp = 0, g = 0, tp = 0, n = 0;
      h.time.forEach((ts, i) => {
        const t = Date.parse(ts + ':00Z'); const v = h.wind_speed_10m[i], d = h.wind_direction_10m[i];
        if (t < t0 || t > t1 || v == null || d == null) return;
        sx += v * Math.sin(d * Math.PI / 180); sy += v * Math.cos(d * Math.PI / 180); sp += v; n++;
        if (h.wind_gusts_10m && h.wind_gusts_10m[i] != null) g = Math.max(g, h.wind_gusts_10m[i]);
        if (h.temperature_2m && h.temperature_2m[i] != null) tp += h.temperature_2m[i];
      });
      if (!n) continue;
      const dir = (Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360;
      return { ok: true, dir: Math.round(dir), kmh: Math.round(sp / n), gust: Math.round(g), temp: Math.round(tp / n) };
    } catch (e) { lastErr = e; }
  }
  return { ok: false, offline: !!lastErr, error: lastErr ? String(lastErr.message || lastErr) : 'aucune donnée' };
}

/* ---------- Noms de lieux (OpenStreetMap Nominatim, 1 requête par seconde) ---------- */
let geoChain = Promise.resolve(); let geoLast = 0;
function geocode(lat, lon) {
  const job = geoChain.then(async () => {
    const wait = 1150 - (Date.now() - geoLast); if (wait > 0) await new Promise(r => setTimeout(r, wait));
    geoLast = Date.now();
    try {
      const j = await getJSON(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${(+lat).toFixed(5)}&lon=${(+lon).toFixed(5)}&zoom=14&accept-language=fr`);
      const a = (j && j.address) || {};
      return { ok: true, name: a.village || a.town || a.city || a.municipality || a.hamlet || a.suburb || a.county || null };
    } catch (e) { return { ok: false }; }
  });
  geoChain = job.catch(() => { });
  return job;
}


/* ---------- Mise à jour obligatoire ---------- */
const IS_WIN = process.platform === 'win32' || !!process.env.BRAQUET_UPDATE_DRYRUN;
const cmpVer = (a, b) => { const x = String(a).split('.').map(n => parseInt(n, 10) || 0), y = String(b).split('.').map(n => parseInt(n, 10) || 0); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
let pendingUpdate = null; let updating = false;
async function checkUpdate() {
  if (updating) return pendingUpdate;
  try {
    let info = null;
    for (const u of UPDATE_URLS) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      try { const r = await net.fetch(u + (u.includes('?') ? '&' : '?') + 't=' + Date.now(), { headers: { 'User-Agent': UA, 'Cache-Control': 'no-cache' }, signal: ctl.signal }); if (r.ok) { info = await r.json(); break; } } catch (e) { /* adresse suivante */ } finally { clearTimeout(t); }
    }
    if (!info || !info.version || cmpVer(info.version, app.getVersion()) <= 0) return null;
    pendingUpdate = info;
    if (win && !win.isDestroyed()) win.webContents.send('update', { version: info.version, notes: info.notes || '', current: app.getVersion(), platform: process.platform, auto: IS_WIN && !!(info.win && info.win.url) });
    return info;
  } catch (e) { return null; } // pas de connexion : on laisse utiliser le logiciel
}
async function installUpdate() {
  const info = pendingUpdate; if (!info) return { ok: false, error: 'Aucune mise à jour en attente.' };
  if (!IS_WIN || !info.win || !info.win.url) { shell.openExternal(info.page || `https://github.com/${REPO}/releases/latest`); return { ok: true, manual: true }; }
  updating = true;
  const progress = (k) => { if (win && !win.isDestroyed()) win.webContents.send('update-progress', k); };
  try {
    const r = await net.fetch(info.win.url, { headers: { 'User-Agent': UA } });
    if (!r.ok) throw new Error('Téléchargement impossible (HTTP ' + r.status + ')');
    const total = +(r.headers.get('content-length') || info.win.size || 0);
    const dest = path.join(os.tmpdir(), `Braquet-${info.version}-${Date.now()}.exe`);
    const fh = await fsp.open(dest, 'w'); const hash = require('crypto').createHash('sha256');
    let got = 0; const reader = r.body.getReader();
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; await fh.write(value); hash.update(value); got += value.length; if (total) progress(got / total); } }
    finally { await fh.close(); }
    const sum = hash.digest('hex');
    if (info.win.sha256 && sum.toLowerCase() !== String(info.win.sha256).toLowerCase()) { try { await fsp.unlink(dest); } catch (e) { /* ignoré */ } throw new Error('Le fichier téléchargé est abîmé. Réessaie.'); }
    progress(1);
    await saving;
    if (process.env.BRAQUET_UPDATE_DRYRUN) { await fsp.writeFile(path.join(process.env.BRAQUET_UPDATE_DRYRUN, 'downloaded.txt'), dest + ' ' + sum); return { ok: true }; }
    const child = require('child_process').spawn(dest, ['/S'], { detached: true, stdio: 'ignore' });
    child.on('error', err => { updating = false; if (win && !win.isDestroyed()) win.webContents.send('update-progress', 1); console.error('update spawn', err); });
    child.unref();
    setTimeout(() => app.exit(0), 400);
    return { ok: true };
  } catch (e) { updating = false; return { ok: false, error: String(e.message || e) }; }
}

/* ---------- Fenêtre ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 640, backgroundColor: '#0A0A0B', show: false, title: 'Braquet',
    icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { if (!TEST) win.maximize(); win.show(); });
  const external = url => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); };
  win.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); external(url); } });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F12' && input.control && input.shift) win.webContents.openDevTools({ mode: 'detach' });
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('closed', () => { win = null; });

  if (TEST) {
    const logs = [];
    win.webContents.on('console-message', (e, level, message) => { logs.push(level + ' ' + message); });
    win.webContents.on('render-process-gone', (e, d) => logs.push('GONE ' + JSON.stringify(d)));
    const steps = (process.env.BRAQUET_STEPS || '').split('|').filter(Boolean);
    win.webContents.once('did-finish-load', async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      await wait(+(process.env.BRAQUET_WAIT || 6000));
      let k = 0;
      const shot = async () => { const img = await win.webContents.capturePage(); await fsp.writeFile(path.join(TEST, `shot${k++}.png`), img.toPNG()); };
      await shot();
      for (const st of steps) { try { await win.webContents.executeJavaScript(st, true); } catch (e) { logs.push('STEP ' + e.message); } await wait(2500); await shot(); }
      await fsp.writeFile(path.join(TEST, 'log.txt'), logs.join('\n'));
      await saving; app.quit();
    });
  }
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(async () => {
  await migrate();
  // OpenStreetMap demande que chaque logiciel s'identifie
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['https://tile.openstreetmap.org/*'] }, (d, cb) => { d.requestHeaders['User-Agent'] = UA; cb({ requestHeaders: d.requestHeaders }); });
  loadStore();
  ipcMain.handle('store:load', () => store);
  ipcMain.handle('store:save', (e, data) => { if (data && typeof data === 'object') { store = data; return saveStore(); } });
  ipcMain.handle('lib:list', (e, pid) => listLib(pid));
  ipcMain.handle('device:import', async (e, pid) => { if (device.state !== 'connected' || !device.dir) return { added: [], found: 0, none: true }; try { return await importFromDevice(device.dir, pid); } catch (err) { return { added: [], found: 0, error: err.message }; } });
  ipcMain.handle('profile:remove', async (e, pid) => { await fsp.mkdir(path.join(userDir(), 'corbeille'), { recursive: true }); try { await fsp.rename(actDir(pid), path.join(userDir(), 'corbeille', 'profil-' + safeId(pid) + '-' + Date.now())); } catch (err) { /* dossier absent */ } return true; });
  ipcMain.handle('lib:read', async (e, pid, name) => fsp.readFile(path.join(actDir(pid), safeName(name))));
  ipcMain.handle('lib:add', async (e, pid, name, bytes) => { const buf = Buffer.from(bytes); return addToLib(pid, name, dest => fsp.writeFile(dest, buf), buf.length); });
  ipcMain.handle('lib:remove', async (e, pid, name) => { await fsp.mkdir(path.join(userDir(), 'corbeille'), { recursive: true }); await fsp.rename(path.join(actDir(pid), safeName(name)), path.join(userDir(), 'corbeille', Date.now() + '-' + safeName(name))); return true; });
  ipcMain.handle('lib:pick', async (e, pid) => {
    const r = await dialog.showOpenDialog(win, { title: 'Choisir des sorties (.FIT)', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Sorties Garmin', extensions: ['fit', 'FIT'] }] });
    const out = [];
    if (!r.canceled) for (const f of r.filePaths) { try { const st = await fsp.stat(f); const got = await addToLib(pid, path.basename(f), dest => fsp.copyFile(f, dest), st.size); if (got) out.push(got); } catch (e) { console.error(e); } }
    return out;
  });
  ipcMain.handle('device:start', () => { if (!pollTimer) { pollTimer = setInterval(poll, 3000); poll(); } return device; });
  ipcMain.handle('wx', (e, q) => weather(q));
  ipcMain.handle('geo', (e, lat, lon) => geocode(lat, lon));
  ipcMain.handle('zoom', (e, f) => { if (win && f >= 0.7 && f <= 2) win.webContents.setZoomFactor(f); });
  ipcMain.handle('openData', () => shell.openPath(userDir()));
  ipcMain.handle('version', () => app.getVersion());
  ipcMain.handle('update:check', () => checkUpdate().then(i => !!i));
  ipcMain.handle('update:install', () => installUpdate());
  setInterval(checkUpdate, 3 * 3600000);
  createWindow();
});
app.on('window-all-closed', () => { saving.then(() => app.quit()); });
