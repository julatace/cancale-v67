// ════════════════════════════════════════════════════════════════════════════
//  BANC « BIEN DÉMARRER » (20 nov., Julien : « OK » à « un parcours de 5 minutes (installer
//  l'extension, ouvrir Vinted, choisir l'étiquetage, premier import), une démo avec des données
//  d'exemple, et Tout va bien ? qui dit exactement quoi faire »).
//  (Le nom `demarrage.cjs` est pris : c'est le banc de l'écran de chargement du 3 octobre.)
//
//  Sur une base INVENTÉE (aucune donnée réelle, aucune requête hors de la machine), un compte
//  VRM NEUF et vide, à 390 tactile (iPhone, Safari puis Orion) ET 1512 (Chrome) :
//   P  le parcours s'ouvre SEUL sur son sommaire ; chaque page : UN plein, rien ne déborde,
//      cibles 44 px (390), aucune clé de traduction ni « undefined » ;
//      « Tu vends où ? » ÉCRIT `vrm_plateformes_affichees` (vinted + leboncoin) ;
//      l'extension : le navigateur reconnu (Chrome ⇒ le zip guidé ; Safari iPhone ⇒ Orion à
//      installer ; Orion ⇒ son fichier) ; SIMULÉE elle ne répond pas ⇒ « Pas encore là », puis
//      elle apparaît EN DIRECT (sans recharger) pas branchée ⇒ « Brancher à mon compte VRM »,
//      puis branchée ⇒ « Elle répond » ;
//      les comptes : Vinted « À faire », puis un compte Vinted capté EN DIRECT ⇒ son nom ;
//      l'étiquetage : deux touchers ÉCRIVENT `vrm_numero_ecrit` et `vrm_etiquetage` (rien d'autre) ;
//      l'import : l'avancement LU (`import_vinted_{uid}` : 50 sur 120) ;
//      un rechargement REPREND à la même page ; « Plus tard » ferme ; Paramètres → « Bien démarrer »
//      rouvre le sommaire ; « Ouvrir VRM » finit (`fini: true`).
//   D  la démo : « Essayer avec des exemples » depuis le sommaire ⇒ l'app remplie, marquée
//      « Exemple » ; AUCUNE requête vers la base ni /api pendant l'exemple (lecture comprise) ;
//      « sortir » en un toucher ⇒ la vraie session revient, rien de l'exemple dans SA base.
//   T  « Tout va bien ? » : extension absente ⇒ le premier point est l'extension, avec SON geste ;
//      « Détails » replié ; extension branchée ⇒ plus de point extension.
//  `SHOTS=<dossier>` (défaut : scripts/bancs/captures/demarrage-parcours, jamais commité) ;
//  `LARGEURS=390` `PARTIES=P,D,T` ; `BANC_DIST=<dist>` pour juger un autre arbre.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { lancer } = require('./_navigateur.cjs');
const RAC = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RAC, 'dist');
const PORT = Number(process.env.BANC_PORT) || 4993;
const ORIGINE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(__dirname, 'captures', 'demarrage-parcours');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const PARTIES = liste('PARTIES', 'P,D,T');
const VERSION_EXT = JSON.parse(fs.readFileSync(path.join(RAC, 'vinted-sync-extension', 'manifest.json'), 'utf8')).version;
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const UA_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

let ko = 0, nOk = 0; const defauts = [];
const dit = (bon, quoi, det) => { if (bon) nOk++; else { ko++; defauts.push(quoi); } console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(det).slice(0, 300) : ''}`); };

// ── Le compte inventé ──
const UID = '0d0d0d0d-4444-4000-8000-00000000dddd';
const EMAIL = 'nouvelle.vendeuse@exemple.invalid';
const VINTED_UID = '987654321';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jeton = (uid) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: uid, role: 'authenticated', aud: 'authenticated' })}.banc`;
const session = () => ({ access_token: jeton(UID), refresh_token: 'r', totp: [], expires_at: Date.now() + 864e5, user: { id: UID, email: EMAIL, totp: [], created_at: new Date(Date.now() - 60000).toISOString() } });

// ── Le serveur des fichiers construits ──
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.zip': 'application/zip', '.xpi': 'application/x-xpinstall' };
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// ── La base (PostgREST inventé) : lignes, projections `data->>`, écritures comptées ──
const proj = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], al = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'owner') { out[al] = row[src]; continue; }
    if (src === 'data') { out[al] = row.data; continue; }
    if (!/^data/.test(src)) { out[al] = row[src] === undefined ? null : row[src]; continue; }
    let v = row.data; for (const s of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[s];
    out[al] = v == null ? null : (src.includes('->>') ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
const comme = (motif) => new RegExp('^' + String(motif).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');
function filtrer(rows, q) {
  let r = rows;
  for (const [k, v] of q.entries()) {
    if (['select', 'order', 'limit', 'on_conflict', 'offset'].includes(k)) continue;
    if (k === 'or') {
      const alts = v.replace(/^\(|\)$/g, '').match(/id\.(like|in|eq)\.(\([^)]*\)|[^,]+)/g) || [];
      r = r.filter((x) => alts.some((a) => { const m = /^id\.(like|in|eq)\.(.*)$/.exec(a); if (m[1] === 'like') return comme(m[2]).test(x.id); if (m[1] === 'in') return m[2].replace(/^\(|\)$/g, '').split(',').includes(x.id); return x.id === m[2]; }));
      continue;
    }
    const m = /^(eq|like|gte|in)\.(.*)$/.exec(v); if (!m) continue;
    const lire = (x) => { if (!k.startsWith('data')) return x[k]; let o = x.data; for (const s of k.replace(/^data(->>|->)/, '').split(/->>|->/)) o = o == null ? null : o[s]; return o == null ? null : String(o); };
    r = r.filter((x) => { const a = lire(x); if (m[1] === 'eq') return String(a) === m[2]; if (m[1] === 'like') return comme(m[2]).test(String(a)); if (m[1] === 'gte') return String(a) >= decodeURIComponent(m[2]); if (m[1] === 'in') return m[2].replace(/^\(|\)$/g, '').split(',').includes(String(a)); return true; });
  }
  return r;
}
function nouvelleBase() { return { lignes: [], comptes: [], ecritures: [], requetes: 0 }; }
async function brancherBase(pg, base) {
  await pg.route('**/auth/v1/**', (r) => { base.requetes++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: jeton(UID), refresh_token: 'r', expires_in: 3600, user: { id: UID, email: EMAIL } }) }); });
  await pg.route('**/rest/v1/**', (route) => {
    base.requetes++;
    const req = route.request(), m = req.method();
    const u = new URL(req.url());
    const json = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rpc\//.test(u.pathname)) return json(null);
    if (/vinted_accounts/.test(u.pathname)) return json(m === 'GET' ? base.comptes : []);
    if (!/app_data/.test(u.pathname)) return json([]);
    if (m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE') {
      base.ecritures.push(m + ' ' + decodeURIComponent(u.search).slice(0, 160));
      try {
        const b = JSON.parse(req.postData() || 'null');
        const rows = Array.isArray(b) ? b : b && b.id ? [b] : [];
        const eq = /(?:^|&)id=eq\.([^&]*)/.exec(decodeURIComponent(u.search.slice(1)));
        if (m === 'PATCH' && eq && b && b.data) rows.push({ id: eq[1], data: b.data });
        for (const r of rows) { if (!r || !r.id) continue; const i = base.lignes.findIndex((x) => x.id === r.id); const data = r.id === 'main' && i >= 0 ? { ...base.lignes[i].data, ...r.data } : r.data; if (i >= 0) base.lignes[i] = { id: r.id, data }; else base.lignes.push({ id: r.id, data }); }
      } catch (_) {}
      return json(m === 'PATCH' ? [{ id: 'main', owner: UID }] : [], m === 'POST' ? 201 : 200);
    }
    const q = new URLSearchParams(u.search);
    let rows = filtrer(base.lignes.map((x) => ({ ...x, owner: UID })), q);
    if (q.get('limit')) rows = rows.slice(0, Number(q.get('limit')));
    return json(rows.map((x) => proj(x, q.get('select'))));
  });
  await pg.route('**/api/**', (route) => {
    base.requetes++;
    const u = new URL(route.request().url()); const mode = u.searchParams.get('mode') || '';
    const j = (c, b) => route.fulfill({ status: c, contentType: 'application/json', body: JSON.stringify(b) });
    if (mode === 'confidentialite') return j(200, { ok: true, uid: UID });
    if (mode === 'abonnement') return j(200, { ok: true, proprietaire: false, acces: true, etat: 'essai', jours: 14 });
    if (mode === 'proprietaire') return j(200, { ok: true, proprietaire: false });
    return j(200, {});
  });
}
const main = (base) => (base.lignes.find((l) => l.id === 'main') || {}).data || {};

// L'EXTENSION SIMULÉE : un pont qui ne répond que si `localStorage.banc_ext` le dit ('pasconnectee' | 'connectee').
// `window.__bancExt(etat)` la fait APPARAÎTRE sans recharger (comme une extension qu'on vient d'installer, dont
// le pont s'annonce de lui-même).
const PONT = ([email, uid, version]) => {
  const etat = () => { try { return localStorage.getItem('banc_ext') || ''; } catch (_) { return ''; } };
  const post = (m) => window.postMessage(m, '*');
  window.__bancExt = (e) => { try { localStorage.setItem('banc_ext', e); } catch (_) {} post({ __vmr: 'ready', version }); };
  window.addEventListener('message', (ev) => {
    const d = ev.data; if (ev.source !== window || !d || typeof d !== 'object' || !etat()) return;
    const connecte = etat() === 'connectee';
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: { ok: true, connecte, expiree: false, email: connecte ? email : '', user_id: connecte ? uid : '', cloisonne: false } });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte, email: connecte ? email : '', user_id: connecte ? uid : '' }, vinted: null, cmds: {} } });
  });
};

async function ouvrir(nav, { W, ua, kagi = false, base, sombre = false }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 945 } }), userAgent: ua || (tel ? UA_IPHONE : UA_CHROME), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const journal = { erreurs: [], horsMachine: [] };
  pg.on('pageerror', (e) => journal.erreurs.push(String(e.message || e).slice(0, 200)));
  pg.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGINE) && !/^(data|blob):/.test(u)) journal.horsMachine.push(r.method() + ' ' + u.slice(0, 120)); });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => { const u = r.request().url(); if (/supabase\.co|\/api\//.test(u)) return r.fallback(); return r.fulfill({ status: 204, body: '' }); });
  await pg.addInitScript(([s, sombre, kagi]) => {
    try {
      if (kagi) window.KAGI = {};
      if (window.top !== window) return;
      if (!sessionStorage.getItem('banc_init')) { localStorage.clear(); localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); sessionStorage.setItem('banc_init', '1'); }
    } catch (_) {}
  }, [session(), sombre, kagi]);
  await pg.addInitScript(PONT, [EMAIL, UID, VERSION_EXT]);
  await brancherBase(pg, base);
  return { ctx, pg, journal, tel };
}

// Ce que la personne voit dans le parcours : pleins visibles, débordement, cibles, textes.
const MESURE = (pg) => pg.evaluate(() => {
  const R = document.querySelector('[data-parcours-nouveau]');
  if (!R) return null;
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
  const pleins = [...R.querySelectorAll('[data-n-variante="plein"]')].filter(vis).length;
  const deborde = document.documentElement.scrollWidth > innerWidth + 1 || [...R.querySelectorAll('button, a, h1, p, li, span')].filter(vis).some((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; });
  const petits = [...R.querySelectorAll('button, a[href], [role="switch"]')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 24) || e.getAttribute('aria-label') || '?', Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => Math.min(w, h) < 43.5);
  const txt = R.innerText;
  return { pleins, deborde, petits, cles: /\b(dm|pn|tvb|ext|etq)\.[a-z][a-zA-Z.]+/.test(txt) || /undefined|NaN|\[object/.test(txt), texte: txt.slice(0, 200) };
});
const etape = (pg) => pg.getAttribute('[data-parcours-nouveau]', 'data-pn-etape').catch(() => null);
const attendre = async (pg, fn, ms = 20000, pas = 250) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (_) {} await pg.waitForTimeout(pas); } return false; };
async function juger(pg, etq, nom, tel) {
  await pg.waitForTimeout(450);
  const me = await MESURE(pg);
  dit(me && me.pleins === 1, `${etq} ${nom} : un plein, un seul`, me && me.pleins);
  dit(me && !me.deborde, `${etq} ${nom} : rien ne déborde`);
  if (tel) dit(me && me.petits.length === 0, `${etq} ${nom} : chaque cible fait 44 px`, me && JSON.stringify(me.petits));
  dit(me && !me.cles, `${etq} ${nom} : aucune clé de traduction, aucun « undefined »`, me && me.texte);
}
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png') });

// ════════════════════════════════════════════════════════════════════════════
async function partieParcours(nav, W) {
  const etq = `[P ${W}]`;
  const tel = W < 600;
  const base = nouvelleBase();
  const { ctx, pg, journal } = await ouvrir(nav, { W, base });
  await pg.goto(ORIGINE + '/?tab=journee', { waitUntil: 'domcontentloaded' });
  const ouvert = await pg.waitForSelector('[data-parcours-nouveau][data-pn-etape="sommaire"]', { timeout: 30000 }).then(() => true).catch(() => false);
  dit(ouvert, `${etq} un compte neuf : « Bien démarrer » s'ouvre seul, sur son sommaire`);
  if (!ouvert) { await shot(pg, `p-${W}-00-RATE`); await ctx.close(); return; }
  const lignes = await pg.$$eval('[data-dm-etape]', (l) => l.map((x) => x.getAttribute('data-dm-etape')));
  dit(lignes.join() === 'plateformes,extension,comptes,etiquetage,historique', `${etq} le sommaire : les cinq étapes dans l'ordre`, lignes.join());
  dit(await pg.locator('[data-dm-exemple]').count() === 1, `${etq} le sommaire propose « Essayer avec des exemples »`);
  await juger(pg, etq, 'sommaire', tel); await shot(pg, `p-${W}-01-sommaire`);

  // 1. Tu vends où ?
  await pg.click('[data-pn-plein]');
  dit(await attendre(pg, async () => (await etape(pg)) === 'plateformes', 5000), `${etq} « Commencer » pousse « Tu vends où ? »`);
  await juger(pg, etq, 'plateformes', tel);
  await pg.click('[data-pn-site="leboncoin"]');
  await shot(pg, `p-${W}-02-plateformes`);
  await pg.click('[data-pn-plein]');
  dit(await attendre(pg, async () => (await etape(pg)) === 'extension', 6000), `${etq} « Continuer » pousse l'extension`);
  const pf = main(base).vrm_plateformes_affichees;
  dit(pf && pf.sites && pf.sites.join() === 'vinted,leboncoin', `${etq} « Tu vends où ? » ÉCRIT dans SA base (vinted, leboncoin)`, JSON.stringify(pf));

  // 2. L'extension : absente, puis elle apparaît EN DIRECT, pas branchée, puis branchée.
  const modeVu = await pg.getAttribute('[data-dm-mode]', 'data-dm-mode');
  dit(modeVu === (tel ? 'orion-app' : 'zip'), `${etq} le navigateur reconnu : ${tel ? 'Safari iPhone ⇒ installer Orion' : 'Chrome ⇒ le zip guidé'} (${modeVu})`);
  const plein = await pg.locator('[data-pn-plein]').innerText();
  dit(tel ? /Orion/.test(plein) : /Télécharger/.test(plein), `${etq} le plein de l'extension : ${plein}`);
  if (!tel) dit(await pg.getAttribute('[data-pn-plein]', 'href') === '/VRM-extension.zip', `${etq} le zip servi (aucune boutique devinée)`);
  const absente = await attendre(pg, async () => ['afaire'].includes(await pg.getAttribute('[data-dm-ext-etat]', 'data-dm-ext-etat')), 15000);
  dit(absente, `${etq} extension muette ⇒ « Pas encore là » (jamais « fait » sur un silence)`, await pg.getAttribute('[data-dm-ext-etat]', 'data-dm-ext-etat'));
  await juger(pg, etq, 'extension (absente)', tel); await shot(pg, `p-${W}-03-extension-absente`);
  if (!tel) {
    // Un rechargement reprend ICI (la position est rangée dans SA base).
    await pg.waitForTimeout(1200);
    await pg.reload({ waitUntil: 'domcontentloaded' });
    dit(await pg.waitForSelector('[data-parcours-nouveau][data-pn-etape="extension"]', { timeout: 30000 }).then(() => true).catch(() => false), `${etq} un rechargement reprend à « Installe l'extension »`);
    await pg.evaluate(() => window.__bancExt('pasconnectee'));
    const brancher = await attendre(pg, async () => (await pg.getAttribute('[data-dm-ext-etat]', 'data-dm-ext-code')) === 'vrm', 30000);
    dit(brancher, `${etq} l'extension apparaît EN DIRECT, pas branchée ⇒ « Brancher à mon compte VRM »`, await pg.getAttribute('[data-dm-ext-etat]', 'data-dm-ext-code'));
    dit(/Brancher/.test(await pg.locator('[data-pn-plein]').innerText()), `${etq} le plein devient « Brancher à mon compte VRM »`);
    await shot(pg, `p-${W}-04-extension-brancher`);
    await pg.evaluate(() => window.__bancExt('connectee'));
    const repond = await attendre(pg, async () => (await pg.getAttribute('[data-dm-ext-etat]', 'data-dm-ext-etat')) === 'fait', 45000, 500);
    dit(repond, `${etq} branchée ⇒ « Elle répond », sans recharger`, await pg.getAttribute('[data-dm-ext-etat]', 'data-dm-ext-code'));
    await juger(pg, etq, 'extension (répond)', tel); await shot(pg, `p-${W}-05-extension-repond`);
  }
  // Continuer (ou passer) vers les comptes.
  await pg.click('[data-dm-passer]').catch(async () => { await pg.click('[data-pn-plein]'); });
  dit(await attendre(pg, async () => (await etape(pg)) === 'comptes', 6000), `${etq} on passe aux comptes (jamais bloquant)`);

  // 3. Les comptes : Vinted à ouvrir, puis capté EN DIRECT.
  const v0 = await pg.getAttribute('[data-pn-compte="vinted"]', 'data-etat');
  dit(v0 === 'afaire', `${etq} Vinted : « À faire » tant qu'aucun compte n'est lu`, v0);
  dit(await pg.locator('[data-pn-compte="leboncoin"]').count() === 1 && await pg.locator('[data-pn-compte="ebay"]').count() === 0, `${etq} les comptes : SES sites seulement (Vinted, Leboncoin)`);
  await juger(pg, etq, 'comptes', tel); await shot(pg, `p-${W}-06-comptes`);
  base.comptes.push({ vinted_user_id: VINTED_UID, login: 'boutique_exemple', owner: UID, created_at: new Date().toISOString() });
  const capte = await attendre(pg, async () => (await pg.getAttribute('[data-pn-compte="vinted"]', 'data-etat')) === 'fait', 20000, 500);
  const txtV = await pg.locator('[data-pn-compte="vinted"]').innerText().catch(() => '');
  dit(capte && /boutique_exemple/.test(txtV), `${etq} un compte Vinted capté EN DIRECT ⇒ son nom s'affiche`, txtV);
  await shot(pg, `p-${W}-07-comptes-capte`);
  await pg.click('[data-dm-passer]').catch(async () => { await pg.click('[data-pn-plein]'); });
  dit(await attendre(pg, async () => (await etape(pg)) === 'etiquetage', 6000), `${etq} on passe à l'étiquetage`);

  // 4. L'étiquetage : deux touchers, les clés de toujours.
  await pg.waitForSelector('[data-etiquetage-choix="qui:vrm"]', { timeout: 15000 }).catch(() => {});
  await juger(pg, etq, 'etiquetage', tel); await shot(pg, `p-${W}-08-etiquetage`);
  const avantEcr = base.ecritures.length;
  await pg.click('[data-etiquetage-choix="qui:vrm"]');
  await pg.click('[data-etiquetage-choix="support:main"]');
  await attendre(pg, async () => !!(main(base).vrm_etiquetage && main(base).vrm_numero_ecrit), 8000);
  const m4 = main(base);
  dit(m4.vrm_numero_ecrit && m4.vrm_numero_ecrit.actif === false && typeof m4.vrm_numero_ecrit.choisi === 'string' && m4.vrm_etiquetage && m4.vrm_etiquetage.support === 'main', `${etq} l'étiquetage ÉCRIT « VRM numérote » et « écrite à la main »`, JSON.stringify({ ne: m4.vrm_numero_ecrit, e: m4.vrm_etiquetage }));
  dit(await attendre(pg, async () => (await pg.getAttribute('[data-dm-etiquetage]', 'data-dm-etiquetage')) === 'fait', 5000), `${etq} l'étape « étiquetage » se coche sur la preuve`);
  dit(base.ecritures.length > avantEcr && !('vrm_pool' in m4) && !('vinted_nums' in m4), `${etq} aucun numéro touché (rien d'autre que les clés de la méthode)`);
  await pg.click('[data-pn-plein]');
  dit(await attendre(pg, async () => (await etape(pg)) === 'historique', 6000), `${etq} on passe au premier import`);

  // 5. Le premier import : l'avancement LU.
  base.lignes.push({ id: 'import_vinted_' + VINTED_UID, data: { etat: 'encours', ventes: { lus: 40, total: 100 }, achats: { lus: 10, total: 20 }, at: Date.now(), capturedAt: new Date().toISOString() } });
  const lu = await attendre(pg, async () => (await pg.getAttribute('[data-dm-hist]', 'data-dm-hist-n')) === '50', 20000, 500);
  dit(lu && (await pg.getAttribute('[data-dm-hist]', 'data-dm-hist-total')) === '120', `${etq} l'import se dit LU : 50 sur 120`, await pg.getAttribute('[data-dm-hist]', 'data-dm-hist-n'));
  await juger(pg, etq, 'historique', tel); await shot(pg, `p-${W}-09-import`);
  await pg.click('[data-pn-plein]');
  dit(await attendre(pg, async () => (await etape(pg)) === 'pret', 6000), `${etq} « Tout est prêt » (ou presque)`);
  await juger(pg, etq, 'pret', tel); await shot(pg, `p-${W}-10-pret`);

  // « Plus tard » depuis une étape, puis Paramètres → « Bien démarrer » rouvre le sommaire.
  await pg.click('[data-dm-reste]').catch(() => {});
  await pg.waitForTimeout(500);
  await pg.click('[data-pn-plus-tard]').catch(() => {});
  dit(await pg.waitForSelector('[data-parcours-nouveau]', { state: 'detached', timeout: 8000 }).then(() => true).catch(() => false), `${etq} « Plus tard » ferme le parcours`);
  dit(await pg.evaluate(() => { try { window.dispatchEvent(new CustomEvent('vrm:parcours-nouveau', { detail: 'sommaire' })); return true; } catch (_) { return false; } })
    && await pg.waitForSelector('[data-parcours-nouveau][data-pn-etape="sommaire"]', { timeout: 8000 }).then(() => true).catch(() => false), `${etq} « Bien démarrer » (Paramètres) rouvre le sommaire`);
  await pg.click('[data-pn-plein]');   // Reprendre ⇒ la première étape pas faite
  await pg.waitForTimeout(600);
  await pg.click('[data-dm-retour]').catch(() => {});
  await pg.waitForTimeout(400);
  // Finir : aller à « Tout est prêt » et « Ouvrir VRM ».
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:parcours-nouveau', { detail: 'pret' })));
  await pg.waitForSelector('[data-parcours-nouveau][data-pn-etape="pret"]', { timeout: 8000 }).catch(() => {});
  await pg.click('[data-pn-plein]');
  dit(await pg.waitForSelector('[data-parcours-nouveau]', { state: 'detached', timeout: 8000 }).then(() => true).catch(() => false), `${etq} « Ouvrir VRM » ferme le parcours`);
  await pg.waitForTimeout(1800);
  dit(main(base).vrm_parcours_nouveau && main(base).vrm_parcours_nouveau.fini === true, `${etq} le parcours est noté fini`, JSON.stringify(main(base).vrm_parcours_nouveau));
  dit(journal.erreurs.length === 0, `${etq} aucune erreur JS`, journal.erreurs.join(' | '));
  dit(journal.horsMachine.filter((x) => !/supabase\.co|\/api\//.test(x)).every((x) => /^GET /.test(x)), `${etq} rien n'est ENVOYÉ hors de la machine`, journal.horsMachine.filter((x) => !/^GET /.test(x)).join(' | '));
  await ctx.close();

  // Le téléphone en Orion : son fichier d'extension.
  if (tel) {
    const b2 = nouvelleBase(); b2.lignes.push({ id: 'main', data: { vrm_parcours_nouveau: { etape: 'extension', vues: ['plateformes', 'extension'] }, vrm_plateformes_affichees: { sites: ['vinted'], at: new Date().toISOString() } } });
    const o = await ouvrir(nav, { W, base: b2, kagi: true });
    await o.pg.goto(ORIGINE + '/?tab=journee', { waitUntil: 'domcontentloaded' });
    const ok = await o.pg.waitForSelector('[data-parcours-nouveau][data-pn-etape="extension"]', { timeout: 30000 }).then(() => true).catch(() => false);
    dit(ok, `${etq} Orion : la position rangée rouvre l'extension (reprise sur un autre appareil)`);
    if (ok) {
      const md = await o.pg.getAttribute('[data-dm-mode]', 'data-dm-mode');
      const href = await o.pg.getAttribute('[data-pn-plein]', 'href');
      dit(md === 'orion' && href === '/VRM-Orion.xpi', `${etq} Orion ⇒ son fichier d'extension`, `${md} · ${href}`);
      await juger(o.pg, etq, 'extension (Orion)', true); await shot(o.pg, `p-${W}-11-extension-orion`);
      // Sombre, regardé une fois.
      await o.pg.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
      await o.pg.waitForTimeout(300); await shot(o.pg, `p-${W}-12-extension-orion-sombre`);
    }
    await o.ctx.close();
  }
}

// ── D : la démo ──
async function partieDemo(nav, W) {
  const etq = `[D ${W}]`;
  const base = nouvelleBase();
  const { ctx, pg, journal } = await ouvrir(nav, { W, base });
  await pg.goto(ORIGINE + '/?tab=journee', { waitUntil: 'domcontentloaded' });
  const ok = await pg.waitForSelector('[data-dm-exemple]', { timeout: 30000 }).then(() => true).catch(() => false);
  dit(ok, `${etq} le sommaire propose l'exemple`);
  if (!ok) { await ctx.close(); return; }
  await pg.waitForTimeout(800);
  const avant = { req: base.requetes, ecr: base.ecritures.length };
  await pg.click('[data-dm-exemple]');
  await pg.waitForLoadState('domcontentloaded');
  const entre = await pg.waitForSelector('[data-vrm-exemple], .vrm-bandeau-exemple, [data-bandeau-exemple]', { timeout: 30000 }).then(() => true).catch(() => false);
  dit(entre, `${etq} « Essayer avec des exemples » ⇒ l'app en exemple, marquée « Exemple »`);
  const apres = base.requetes;
  await pg.waitForTimeout(2500);
  const vu = await pg.evaluate(() => ({ racine: document.documentElement.getAttribute('data-vrm-exemple'), texte: /Exemple/i.test(document.body.innerText), pn: document.querySelectorAll('[data-parcours-nouveau]').length }));
  dit(vu.texte && vu.pn === 0, `${etq} l'exemple : « Exemple » écrit à l'écran, le parcours ne s'empile pas devant`, JSON.stringify(vu));
  await shot(pg, `d-${W}-01-exemple`);
  for (const tab of ['ventes', 'annonces']) {
    await pg.evaluate((t) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + t })); } catch (_) {} }, tab);
    await pg.waitForTimeout(1500);
    await shot(pg, `d-${W}-02-exemple-${tab}`);
  }
  dit(base.requetes === apres, `${etq} AUCUNE requête vers la base ni /api pendant l'exemple (lecture comprise)`, `${base.requetes - apres} requêtes`);
  dit(base.ecritures.length === avant.ecr || base.ecritures.slice(avant.ecr).every((e) => /vrm_parcours_nouveau|main/.test(e)), `${etq} rien de l'exemple écrit dans SA base`, base.ecritures.slice(avant.ecr).join(' | '));
  // Sortir en un toucher.
  const sortie = pg.locator('[data-exemple-sortir], [data-bandeau-exemple] button, .vrm-bandeau-exemple button').first();
  const nS = await sortie.count();
  dit(nS > 0, `${etq} un geste « sortir de l'exemple » visible`);
  if (nS) {
    await sortie.click();
    await pg.waitForLoadState('domcontentloaded');
    const sorti = await attendre(pg, async () => pg.evaluate(() => !document.documentElement.hasAttribute('data-vrm-exemple')), 20000);
    dit(sorti, `${etq} sortie en un toucher : la vraie session revient`);
    await pg.waitForTimeout(1500);
    const mm = JSON.stringify(main(base));
    dit(!/exemple/i.test(mm.replace(/"vrm_parcours_nouveau":\{[^}]*\}/, '')), `${etq} aucune trace de l'exemple dans SA base`, mm.slice(0, 200));
    await shot(pg, `d-${W}-03-sorti`);
  }
  dit(journal.erreurs.length === 0, `${etq} aucune erreur JS`, journal.erreurs.join(' | '));
  await ctx.close();
}

// ── T : Tout va bien ? ──
async function partieToutVaBien(nav, W) {
  const etq = `[T ${W}]`;
  const base = nouvelleBase();
  base.lignes.push({ id: 'main', data: { vrm_parcours_nouveau: { etape: 'pret', fini: true, vues: ['plateformes'] }, vrm_bienvenue_vue: { at: '2026-11-01T00:00:00Z' }, vrm_visite_vue: { at: '2026-11-01T00:00:00Z' } } });
  base.comptes.push({ vinted_user_id: VINTED_UID, login: 'boutique_exemple', owner: UID, created_at: '2026-10-01T00:00:00Z' });
  const { ctx, pg, journal } = await ouvrir(nav, { W, base, ua: UA_CHROME });
  await pg.goto(ORIGINE + '/?tab=settings&reglage=toutvabien', { waitUntil: 'domcontentloaded' });
  const vu = await pg.waitForSelector('[data-tout-va-bien]:not([data-tout-va-bien="lecture"])', { timeout: 40000 }).then(() => true).catch(() => false);
  if (!vu) {
    // Par la liste de Paramètres.
    await pg.click('[data-reglage-toutvabien]').catch(() => {});
  }
  const pret = await pg.waitForSelector('[data-tout-va-bien]:not([data-tout-va-bien="lecture"])', { timeout: 40000 }).then(() => true).catch(() => false);
  dit(pret, `${etq} « Tout va bien ? » s'affiche`);
  if (!pret) { await shot(pg, `t-${W}-00-RATE`); await ctx.close(); return; }
  await attendre(pg, async () => (await pg.locator('[data-tvb-point="extension:ici"]').count()) > 0, 15000);
  const pts = await pg.$$eval('[data-tvb-point]', (l) => l.map((x) => [x.getAttribute('data-tvb-point'), x.getAttribute('data-tvb-geste-code')]));
  dit(pts.length && pts[0][0] === 'extension:ici' && pts[0][1] && pts[0][1] !== '', `${etq} extension absente ⇒ le PREMIER point est l'extension, avec son geste`, JSON.stringify(pts));
  dit(pts.every(([, g]) => g !== null), `${etq} chaque point porte un geste (ou dit qu'il n'y a rien à faire)`);
  const det = await pg.getAttribute('[data-tvb-details]', 'data-tvb-details').catch(() => null);
  dit(det === 'ferme' && await pg.locator('[data-tvb-details-contenu]').count() === 0, `${etq} le technique est derrière « Détails », replié`);
  await shot(pg, `t-${W}-01-points`);
  await pg.click('[data-tvb-details]');
  dit(await pg.locator('[data-tvb-details-contenu]').count() === 1, `${etq} « Détails » déplie le technique (comptes, appareils, rapports)`);
  await shot(pg, `t-${W}-02-details`);
  await pg.evaluate(() => window.__bancExt('connectee'));
  await pg.click('[data-tvb-relire]').catch(() => {});
  const plus = await attendre(pg, async () => (await pg.locator('[data-tvb-point="extension:ici"]').count()) === 0, 45000, 500);
  dit(plus, `${etq} extension branchée ⇒ le point extension s'en va`);
  await shot(pg, `t-${W}-03-extension-ok`);
  dit(journal.erreurs.length === 0, `${etq} aucune erreur JS`, journal.erreurs.join(' | '));
  await ctx.close();
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  dist/ absent : npm run build'); process.exit(1); }
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await lancer(PW);
  try {
    for (const W of LARGEURS) {
      if (PARTIES.includes('P')) await partieParcours(nav, W);
      if (PARTIES.includes('D')) await partieDemo(nav, W);
      if (PARTIES.includes('T')) await partieToutVaBien(nav, W);
    }
  } catch (e) { dit(false, 'le banc a planté', e && e.stack); }
  await nav.close(); srv.close();
  console.log(`\n${nOk} OK, ${ko} KO · captures : ${SHOTS}`);
  if (ko) console.log('Défauts :\n  ' + defauts.join('\n  '));
  process.exit(ko ? 1 : 0);
})();
