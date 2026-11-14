require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  L'ACCOMPAGNEMENT DES GESTES (14 nov.) — docs/passation/2026-11-14-accompagnement.md
//  Julien : « tout doit être plus accompagné dans l'app, chaque action doit être
//  parfaite », « l'utilisateur ne doit pas se sentir seul ».
//
//  Ce banc JOUE les actions de l'inventaire sur l'app RENDUE (390 tactile, base
//  INVENTÉE, faux pont d'extension) et juge, par data-* (jamais un libellé), les
//  quatre moments de chacune :
//    AVANT   [data-acc-avant="<geste>"]   visible avant le geste, non vide ;
//    PENDANT [data-acc-pendant="<geste>"] visible pendant une requête TENUE (§6.5) ;
//    APRÈS   [data-acc-apres="<geste>"]   le résultat (et « Ensuite › » quand le geste en a une) ;
//    ÉCHEC   [data-acc-echec="<geste>"]   la raison, sans code ni « erreur » nu, et un geste.
//  Les échecs sont SIMULÉS : réseau coupé, 429, refus de l'extension, pas de réponse.
//  Et : chaque liste vide dit pourquoi (data-acc-vide + data-acc-vide-pourquoi) ; la
//  première fois sur un écran, une phrase d'aide (data-acc-premiere) qui se range.
//  Un moment qu'un geste ne peut pas montrer dans ce monde (il lui faut un vrai site)
//  est DIT « non joué », avec sa raison : un banc ne meurt pas, il rapporte.
//
//  npm run build && BANC_PORT=$((20000+RANDOM%20000)) node scripts/bancs/accompagnement.cjs
//  `BANC_DIST=<dossier>` : un autre build (preuve §6.1 : ROUGE sur le build d'avant).
//  `SHOTS=<dossier>` : captures (défaut : tmp). `GESTES=a,b` : seulement ceux-là.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { fabriquer } = require(path.join(__dirname, '_base-volume.cjs'));
const { servir } = require('./_minipgrest.cjs');
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-accompagnement');
const VOULUS = String(process.env.GESTES || '').split(',').map((x) => x.trim()).filter(Boolean);
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.jpg': 'image/jpeg' };
const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000a7';
const SESSION = { access_token: 'jeton-acc', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeur.exemple@exemple.test', totp: [], user_metadata: { full_name: 'Camille Exemple' } } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

// Un VRAI petit PDF (une page A6) : « Tout imprimer » lit, fusionne et tamponne de vrais octets.
let PDF_B64 = 'JVBERi0';
async function fabriquerPdf() {
  try {
    const { PDFDocument } = require(path.join(__dirname, '..', '..', 'node_modules', 'pdf-lib'));
    const d = await PDFDocument.create(); d.addPage([298, 420]);
    PDF_B64 = Buffer.from(await d.save()).toString('base64');
  } catch (e) { console.log('  (pdf-lib absent : PDF factice)', String(e.message || e).slice(0, 80)); }
}

// ── LA BASE INVENTÉE ────────────────────────────────────────────────────────
// `fabriquer` (2 comptes : vendeur_1 = 3150000000, vendeur_2 = 3150001111), avec de vrais PDF
// et des annonces qui « dorment » (> 60 j) pour la baisse de prix.
const UID_V = '3150000000';
function base({ neuve = false } = {}) {
  const b = fabriquer({ comptes: 2 });
  const m = b.main[0].data;
  const at = '2026-11-01T10:00:00.000Z';
  Object.assign(m, { vrm_bienvenue_vue: { at }, vrm_visite_vue: { at }, vrm_je_vends: { choix: 'sneakers', at }, vrm_configuration: { etat: 'fait', at, statut: null, version: 1 },
    vrm_plateformes_affichees: { sites: ['vinted', 'leboncoin', 'ebay'], at }, vrm_parcours: { etat: 'fini', at } });
  for (const r of b.rows) {
    if (r.data && typeof r.data.pdfB64 === 'string') r.data.pdfB64 = PDF_B64;
    if (r.data && typeof r.data.pdfTamponneB64 === 'string') r.data.pdfTamponneB64 = PDF_B64;
    if (/_listings$/.test(r.id) && r.data.payload) for (const [i, it] of r.data.payload.items.entries()) if (i < 4) it.created_at_ts = new Date(Date.now() - (70 + i * 10) * 86400e3).toISOString();
  }
  const vus = {}; for (const a of b.accounts) vus[a.vinted_user_id] = Date.now() - 120000;
  b.rows.push({ id: 'ext_appareil_0123456789abcdef', data: { appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver: '5.375.0', code: '5.375.0', atMs: Date.now() - 60000, flux: {}, vus: { vinted: vus } } });
  if (neuve) { b.accounts = []; b.rows = []; b.main[0].data = { vrm_bienvenue_vue: { at }, vrm_visite_vue: { at }, vrm_je_vends: { choix: 'sneakers', at }, vrm_configuration: { etat: 'fait', at, statut: null, version: 1 }, vrm_parcours: { etat: 'fini', at } }; }
  return b;
}

// ── LE FAUX PONT D'EXTENSION (le motif de baisse-prix.cjs) ──────────────────
// `ready`, `etat` (l'onglet vinted.fr sur vendeur_1), et les commandes : chacune est
// notée puis RETENUE (`window.__tenir`) ou répondue tout de suite selon `window.__reponse`.
const PONT = ({ version, uid, login }) => {
  const post = (m) => window.postMessage(m, '*');
  window.__cmds = []; window.__attente = []; window.__tenir = false; window.__reponse = null;
  window.__relacher = (resp) => { let n = 0; while (window.__attente.length) { const c = window.__attente.shift(); post({ __vmr: 'cmd:result', reqId: c.reqId, resp: typeof resp === 'function' ? resp(c) : resp }); n++; } return n; };
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid, login }, cmds: {}, lbcSupprime: true } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push({ cmd: d.cmd, id: d.id, uid: d.uid });
      if (window.__tenir) { window.__attente.push(d); return; }
      const r = window.__reponse;
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: typeof r === 'function' ? r(d) : (r || { accepte: false, code: 'banc', raison: 'refusé par le banc' }) });
    }
  });
  post({ __vmr: 'ready', version });
};

async function rest(route, b, panne) {
  const req = route.request(), m = req.method();
  const u = decodeURIComponent(req.url());
  if (panne && panne(u, m)) return panne(u, m)(route);
  if (/\/rest\/v1\/rpc\//.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  if (m !== 'GET' && m !== 'HEAD') return route.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: m === 'PATCH' ? '[{"id":"main"}]' : '[]' });
  if (/\/rest\/v1\/vinted_accounts/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b.accounts.map((a) => ({ ...a, owner: UID }))) });
  if (!/\/rest\/v1\/app_data/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  const lignes = [...b.main, ...b.rows].map((l) => ({ owner: UID, updated_at: new Date().toISOString(), ...l }));
  const r = servir(lignes, decodeURIComponent(metaVersData(req.url())), req.headers());
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': r.range || '0-0/0' }, body: JSON.stringify(r.body) });
}
const vignette = (u) => `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="hsl(${u.length * 7 % 360},25%,85%)"/></svg>`;

// Ouvre l'app sur `url`. `pont` : faux pont (défaut oui) ; `panne(u, methode)` ⇒ une fonction de route (échec simulé) ;
// `aides` : la phrase « première fois » laissée allumée (sinon coupée, comme partout).
async function ouvrir(nav, { url, b = base(), pont = true, panne = null, api = null, aides = false, W = 390 }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1512, height: 950 }, deviceScaleFactor: 1 }), colorScheme: 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris', acceptDownloads: true });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  pg.on('popup', (p) => p.close().catch(() => {}));
  await pg.addInitScript(([s, aides]) => {
    try {
      window.__VRM_BAISSE_PAUSE = 0; window.__VRM_ATTENTE_GESTE = 4000;
      if (!sessionStorage.getItem('banc_init')) {
        localStorage.setItem('vrm_banc_vends', '1');
        localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id);
        localStorage.setItem('vinted_dark', 'false');
        localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
        localStorage.setItem('vrm_aide_installation_vue', '1'); localStorage.setItem('vrm_langue', 'fr');
        if (aides) { localStorage.setItem('vrm_banc_aides', '1'); localStorage.removeItem('vrm_premieres_fois'); }
        sessionStorage.setItem('banc_init', '1');
      }
    } catch (_) {}
  }, [SESSION, aides]);
  if (pont) await pg.addInitScript(PONT, { version: '5.375.0', uid: UID_V, login: 'vendeur_1' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (r.request().resourceType() === 'image' || /vinted\.net/i.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: vignette(u) });
    if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { email: true } }) });
    if (/\/auth\/v1\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: { ...SESSION.user, factors: [] }, id: UID, email: SESSION.user.email, factors: [] }) });
    if (/\/rest\/v1\//.test(u)) return rest(r, b, panne);
    return r.abort();
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (panne && panne(u, r.request().method())) return panne(u, r.request().method())(r);
    if (/mode=confidentialite/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: UID }) });
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, proprietaire: true, acces: true }) });
    if (api) { const x = api(u, r.request()); if (x) return r.fulfill({ status: x.status || 200, contentType: 'application/json', body: JSON.stringify(x.body || x) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await pg.route('**/rest/v1/**', (r) => rest(r, b, panne));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  return { ctx, pg, erreurs };
}

// ── LA MESURE D'UN MOMENT ───────────────────────────────────────────────────
// Visible, non vide, sans code technique ; pour l'échec, un geste (lien de réparation ou bouton).
const TECHNIQUE = /\b(?:TypeError|ReferenceError|Error:|undefined|null|NaN|HTTP ?\d{3}|status \d{3}|Failed to fetch|NetworkError)\b|\b[45]\d\d\b(?![  ]?(?:€|g|km|ventes?|annonces?|colis))|\[object/;
async function moment(pg, sorte, geste, { ms = 9000, exigerEnsuite = false } = {}) {
  const sel = `[data-acc-${sorte}="${geste}"]`;
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const r = await pg.evaluate(([sel, sorte]) => {
      const els = [...document.querySelectorAll(sel)].filter((e) => { const b = e.getBoundingClientRect(); return (b.width > 0 && b.height > 0) || e.getAttribute('data-acc-pendant'); });
      if (!els.length) return null;
      const e = els[els.length - 1];
      const texte = (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
      const geste = !!e.querySelector('[data-acc-reparer], [data-acc-ensuite], button, a[href]') || !!e.closest('[role="dialog"], .vrm-pil, .vrm-acc-hote');
      return { texte: texte.slice(0, 220), geste, ensuite: !!e.querySelector('[data-acc-ensuite]'), raison: e.getAttribute('data-acc-raison') || '' };
    }, [sel, sorte]).catch(() => null);
    if (r && (r.texte || sorte === 'pendant')) return r;
    await pg.waitForTimeout(150);
  }
  return null;
}

let rouges = 0, verts = 0, nonJoues = 0;
const TABLEAU = {};
const noter = (geste, sorte, r, { exigerEnsuite = false, raisonNonJoue = '' } = {}) => {
  TABLEAU[geste] = TABLEAU[geste] || {};
  if (raisonNonJoue) { TABLEAU[geste][sorte] = 'non joué'; nonJoues++; console.log(`  ·  ${geste} · ${sorte} : non joué — ${raisonNonJoue}`); return; }
  let ok = !!r && (sorte === 'pendant' || !!r.texte);
  let pourquoi = r ? r.texte : 'absent';
  if (ok && sorte === 'echec') { if (TECHNIQUE.test(r.texte)) { ok = false; pourquoi = 'code technique : ' + r.texte; } else if (!r.geste) { ok = false; pourquoi = 'aucun geste : ' + r.texte; } }
  if (ok && exigerEnsuite && !r.ensuite) { ok = false; pourquoi = 'pas de « Ensuite › » : ' + r.texte; }
  TABLEAU[geste][sorte] = ok ? 1 : 0;
  if (ok) verts++; else rouges++;
  console.log(`  ${ok ? '✅' : '❌'} ${geste} · ${sorte}${ok ? '' : ' — ' + pourquoi}${ok && r && r.texte ? ' — « ' + r.texte.slice(0, 110) + ' »' : ''}`);
};
const toucher = async (pg, sel, { ms = 12000 } = {}) => {
  const l = pg.locator(sel).first();
  await l.waitFor({ state: 'visible', timeout: ms });
  await l.scrollIntoViewIfNeeded().catch(() => {});
  await l.click();
};
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {});
const tenir = (pg, on = true) => pg.evaluate((v) => { window.__tenir = v; }, on);
const repondre = (pg, r) => pg.evaluate((x) => { window.__reponse = x; }, r);
const relacher = (pg, r) => pg.evaluate((x) => window.__relacher(x), r);
const attendreCmd = (pg, nom, ms = 12000) => pg.waitForFunction((c) => window.__cmds.some((x) => x.cmd === c), nom, { timeout: ms }).then(() => true).catch(() => false);

// ── LES ACTIONS DE L'INVENTAIRE ─────────────────────────────────────────────
// Chacune : `jouer(nav)` ouvre son monde, joue avant → pendant → après, puis un échec simulé.
const ACTIONS = [];
const action = (geste, jouer) => ACTIONS.push({ geste, jouer });

// 1. TOUT IMPRIMER (Colis) — PDF réels ; PENDANT sur la lecture des PDF tenue ; ÉCHEC : PDF coupés (réseau).
action('colis.imprimer', async (nav) => {
  let tenue = null; let couper = false;
  const panne = (u, m) => (m === 'GET' && /(label_|email_bord_)/.test(u) && /pdf/i.test(u)
    ? (couper ? (r) => r.abort('internetdisconnected') : tenue ? (r) => tenue.then(() => r.fallback()) : null) : null);
  const o = await ouvrir(nav, { url: '/?tab=cat_bord', panne });
  try {
    await toucher(o.pg, '[data-colis-barre-btn="imprimer"]');
    noter('colis.imprimer', 'avant', await moment(o.pg, 'avant', 'colis.imprimer'));
    await shot(o.pg, 'colis-imprimer-avant');
    let lacher; tenue = new Promise((ok) => { lacher = ok; });
    await toucher(o.pg, '[data-lot-imprimer]');
    noter('colis.imprimer', 'pendant', await moment(o.pg, 'pendant', 'colis.imprimer', { ms: 6000 }));
    tenue = null; lacher();
    noter('colis.imprimer', 'apres', await moment(o.pg, 'apres', 'colis.imprimer', { ms: 20000 }));
    await shot(o.pg, 'colis-imprimer-apres');
  } finally { await o.ctx.close(); }
  const o2 = await ouvrir(nav, { url: '/?tab=cat_bord', panne });
  try {
    couper = true;
    await toucher(o2.pg, '[data-colis-barre-btn="imprimer"]');
    await toucher(o2.pg, '[data-lot-imprimer]');
    noter('colis.imprimer', 'echec', await moment(o2.pg, 'echec', 'colis.imprimer', { ms: 20000 }));
    await shot(o2.pg, 'colis-imprimer-echec');
  } finally { await o2.ctx.close(); }
});

// 2. TOUT GÉNÉRER (Colis → outils) — faux pont : commande TENUE (pendant), acceptée (après), 429 (échec).
action('colis.generer', async (nav) => {
  const o = await ouvrir(nav, { url: '/?tab=cat_bord' });
  try {
    await toucher(o.pg, '[data-colis-barre-btn="outils"]');
    await o.pg.waitForTimeout(400);
    const la = await o.pg.locator('[data-tout-generer="pret"]').count();
    if (!la) { for (const s of ['avant', 'pendant', 'apres', 'echec']) noter('colis.generer', s, null, { raisonNonJoue: 'aucun bordereau à générer sur le compte de l’onglet dans cette base' }); return; }
    noter('colis.generer', 'avant', await moment(o.pg, 'avant', 'colis.generer'));
    await tenir(o.pg, true);
    await toucher(o.pg, '[data-tout-generer="pret"]');
    await attendreCmd(o.pg, 'bordereau');
    noter('colis.generer', 'pendant', await moment(o.pg, 'pendant', 'colis.generer', { ms: 5000 }));
    await shot(o.pg, 'colis-generer-pendant');
    await tenir(o.pg, false);
    await repondre(o.pg, { accepte: true, etape: 'file', jobId: 'x' });
    await relacher(o.pg, (c) => ({ accepte: true, etape: 'file', jobId: 'bord:' + c.uid + ':' + c.tx }));
    noter('colis.generer', 'apres', await moment(o.pg, 'apres', 'colis.generer', { ms: 15000 }), { exigerEnsuite: true });
    await shot(o.pg, 'colis-generer-apres');
  } finally { await o.ctx.close(); }
  const o2 = await ouvrir(nav, { url: '/?tab=cat_bord' });
  try {
    await repondre(o2.pg, { accepte: false, code: 'vinted-pause', raison: 'Vinted a répondu 429 : trop de requêtes' });
    await toucher(o2.pg, '[data-colis-barre-btn="outils"]');
    await toucher(o2.pg, '[data-tout-generer="pret"]');
    noter('colis.generer', 'echec', await moment(o2.pg, 'echec', 'colis.generer', { ms: 15000 }));
    await shot(o2.pg, 'colis-generer-echec');
  } finally { await o2.ctx.close(); }
});

// 3. « JE DÉPOSE » (Colis) — le mode dépôt : avant, la barre, un colis coché, un n° inconnu.
action('colis.depose', async (nav) => {
  const o = await ouvrir(nav, { url: '/?tab=cat_bord' });
  try {
    const btn = await o.pg.locator('[data-depot-ouvrir]').count();
    if (!btn) { for (const s of ['avant', 'pendant', 'apres', 'echec']) noter('colis.depose', s, null, { raisonNonJoue: '« Je dépose » absent (aucun colis à déposer dans cette base)' }); return; }
    await toucher(o.pg, '[data-depot-ouvrir]');
    noter('colis.depose', 'avant', await moment(o.pg, 'avant', 'colis.depose'));
    noter('colis.depose', 'pendant', await moment(o.pg, 'pendant', 'colis.depose'));
    await o.pg.locator('[data-depot-saisie]').fill('ZZ000000000FR');
    await toucher(o.pg, '[data-depot-ok]');
    noter('colis.depose', 'echec', await moment(o.pg, 'echec', 'colis.depose'));
    await shot(o.pg, 'colis-depose-echec');
    const un = o.pg.locator('[data-depot-deposer]').first();
    if (await un.count()) { await un.click(); noter('colis.depose', 'apres', await moment(o.pg, 'apres', 'colis.depose', { ms: 8000 })); await shot(o.pg, 'colis-depose-apres'); }
    else noter('colis.depose', 'apres', null, { raisonNonJoue: 'aucun colis cochable' });
  } finally { await o.ctx.close(); }
});

// 4. BAISSER LE PRIX (Annonces → À relancer · Qui dorment) — commande TENUE, relue, puis 429.
async function ouvrirBaisse(o) {
  await o.pg.goto(`http://localhost:${PORT}/?tab=vinted_annonces`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('[data-vue-relancer]', { timeout: 30000 }).catch(() => {});
  await o.pg.locator('[data-vue-relancer]').first().click().catch(() => {});
  await o.pg.waitForSelector('[data-qui-dorment]', { timeout: 15000 }).catch(() => {});
  if (await o.pg.locator('[data-qd-mode-choix="dort"]').count()) await o.pg.locator('[data-qd-mode-choix="dort"]').first().click();
  await o.pg.waitForSelector('[data-qd-case]', { timeout: 15000 });
  await o.pg.locator('[data-qd-case]').first().check();
  await toucher(o.pg, '[data-qd-baisser]');
  await o.pg.waitForSelector('[data-baisse-serie]', { timeout: 15000 });
  await o.pg.locator('[data-bp-varier]').uncheck().catch(() => {});
}
action('prix.baisser', async (nav) => {
  const o = await ouvrir(nav, { url: '/?tab=journee' });
  try {
    try { await ouvrirBaisse(o); } catch (e) { for (const s of ['avant', 'pendant', 'apres', 'echec']) noter('prix.baisser', s, null, { raisonNonJoue: 'feuille « Baisser le prix » pas atteinte : ' + String(e.message || e).slice(0, 80) }); return; }
    noter('prix.baisser', 'avant', await moment(o.pg, 'avant', 'prix.baisser'));
    await shot(o.pg, 'prix-baisser-avant');
    await tenir(o.pg, true);
    await toucher(o.pg, '[data-bp-lancer]'); await toucher(o.pg, '[data-bp-confirmer]');
    await attendreCmd(o.pg, 'baisserPrixVinted');
    noter('prix.baisser', 'pendant', await moment(o.pg, 'pendant', 'prix.baisser', { ms: 6000 }));
    await shot(o.pg, 'prix-baisser-pendant');
    await relacher(o.pg, (c) => ({ accepte: true, etape: 'fait', prixVu: c.prix || 1 }));
    noter('prix.baisser', 'apres', await moment(o.pg, 'apres', 'prix.baisser', { ms: 15000 }), { exigerEnsuite: true });
    await shot(o.pg, 'prix-baisser-apres');
  } finally { await o.ctx.close(); }
  const o2 = await ouvrir(nav, { url: '/?tab=journee' });
  try {
    await ouvrirBaisse(o2);
    await repondre(o2.pg, { accepte: false, code: 'vinted-pause', status: 429, raison: 'HTTP 429' });
    await toucher(o2.pg, '[data-bp-lancer]'); await toucher(o2.pg, '[data-bp-confirmer]');
    noter('prix.baisser', 'echec', await moment(o2.pg, 'echec', 'prix.baisser', { ms: 15000 }));
    await shot(o2.pg, 'prix-baisser-echec');
  } finally { await o2.ctx.close(); }
});

// 5. EXPORTER MES DONNÉES (Paramètres → Mon compte → Tes données) — PENDANT (route tenue), APRÈS (fichier), ÉCHEC (réseau coupé).
action('export.donnees', async (nav) => {
  let mode = 'tenir', lacher = null; const tenue = new Promise((ok) => { lacher = ok; });
  const panne = (u) => (/mode=(donnees|rgpd|export)/.test(u) ? (mode === 'couper' ? (r) => r.abort('internetdisconnected') : mode === 'tenir' ? (r) => tenue.then(() => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"fichiers":[]}' })) : null) : null);
  const o = await ouvrir(nav, { url: '/?tab=settings', panne });
  try {
    const ok = await ouvrirTesDonnees(o.pg);
    if (!ok) { for (const s of ['avant', 'pendant', 'apres', 'echec']) noter('export.donnees', s, null, { raisonNonJoue: '« Tes données » pas atteint' }); return; }
    noter('export.donnees', 'avant', await moment(o.pg, 'avant', 'export.donnees'), {});
    await toucher(o.pg, '[data-td-exporter]');
    noter('export.donnees', 'pendant', await moment(o.pg, 'pendant', 'export.donnees', { ms: 8000 }));
    mode = ''; lacher();
    noter('export.donnees', 'apres', await moment(o.pg, 'apres', 'export.donnees', { ms: 15000 }));
    await shot(o.pg, 'export-donnees-apres');
  } finally { await o.ctx.close(); }
  mode = 'couper';
  const o2 = await ouvrir(nav, { url: '/?tab=settings', panne: (u, m) => (/\/rest\/v1\//.test(u) && m === 'GET' && /select=/.test(u) && o2pret ? (r) => r.abort('internetdisconnected') : panne(u, m)) });
  let o2pret = false;
  try {
    await ouvrirTesDonnees(o2.pg); o2pret = true;
    await toucher(o2.pg, '[data-td-exporter]');
    noter('export.donnees', 'echec', await moment(o2.pg, 'echec', 'export.donnees', { ms: 15000 }));
    await shot(o2.pg, 'export-donnees-echec');
  } finally { await o2.ctx.close(); }
});
async function ouvrirTesDonnees(pg) {
  for (const sel of ['[data-reglage-sous="tes-donnees"]', '[data-sous="tes-donnees"]', 'text=Tes données']) {
    if (await pg.locator(sel).count()) { await pg.locator(sel).first().click().catch(() => {}); break; }
  }
  return pg.waitForSelector('[data-td-exporter]', { timeout: 10000 }).then(() => true).catch(() => false);
}

// ── LES LISTES VIDES ET LES PREMIÈRES FOIS ──────────────────────────────────
async function vides(nav) {
  console.log('\n── listes vides (base neuve) ──');
  for (const [nom, url] of [['ventes', '/?tab=ventes'], ['achats', '/?tab=achats'], ['annonces', '/?tab=vinted_annonces'], ['colis', '/?tab=cat_bord']]) {
    const o = await ouvrir(nav, { url, b: base({ neuve: true }), pont: false });
    try {
      const r = await o.pg.evaluate(() => [...document.querySelectorAll('[data-acc-vide]')].filter((e) => e.getClientRects().length).map((e) => ({
        cle: e.getAttribute('data-acc-vide'), pourquoi: !!e.querySelector('[data-acc-vide-pourquoi]') || e.hasAttribute('data-acc-vide-pourquoi'), geste: !!e.querySelector('[data-acc-vide-geste], button, a[href]') })));
      const bon = r.find((x) => x.pourquoi && x.geste);
      TABLEAU['vide.' + nom] = { vide: bon ? 1 : 0 };
      if (bon) verts++; else rouges++;
      console.log(`  ${bon ? '✅' : '❌'} liste vide · ${nom}${bon ? ' — pourquoi + premier geste' : ' — ' + JSON.stringify(r).slice(0, 160)}`);
      await shot(o.pg, 'vide-' + nom);
    } finally { await o.ctx.close(); }
  }
  console.log('\n── première fois sur un écran ──');
  for (const [nom, url] of [['ventes', '/?tab=ventes'], ['colis', '/?tab=cat_bord'], ['garage', '/?tab=garage']]) {
    const o = await ouvrir(nav, { url, aides: true });
    try {
      const vu = await o.pg.waitForSelector('[data-acc-premiere]', { timeout: 8000 }).then(() => true).catch(() => false);
      let range = false;
      if (vu) {
        await shot(o.pg, 'premiere-' + nom);
        await o.pg.locator('[data-acc-premiere-vu]').first().click();
        await o.pg.waitForTimeout(300);
        range = !(await o.pg.locator('[data-acc-premiere]').count());
        await o.pg.reload({ waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(2500);
        range = range && !(await o.pg.locator('[data-acc-premiere]').count());
      }
      const ok = vu && range;
      TABLEAU['premiere.' + nom] = { premiere: ok ? 1 : 0 };
      if (ok) verts++; else rouges++;
      console.log(`  ${ok ? '✅' : '❌'} première fois · ${nom}${ok ? ' — une phrase, rangée par « Compris », absente au retour' : vu ? ' — ne se range pas' : ' — absente'}`);
    } finally { await o.ctx.close(); }
  }
}

(async () => {
  await fabriquerPdf();
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const t0 = Date.now();
  try {
    for (const A of ACTIONS) {
      if (VOULUS.length && !VOULUS.includes(A.geste)) continue;
      console.log(`\n── ${A.geste} ──`);
      try { await A.jouer(nav); } catch (e) { console.log('  ❌ ' + A.geste + ' : le jeu a cassé — ' + String(e.message || e).slice(0, 200)); rouges++; TABLEAU[A.geste] = { ...(TABLEAU[A.geste] || {}), casse: 0 }; }
    }
    if (!VOULUS.length || VOULUS.includes('vides')) await vides(nav);
  } finally {
    await nav.close(); srv.close();
  }
  fs.writeFileSync(path.join(SHOTS, 'tableau.json'), JSON.stringify(TABLEAU, null, 1));
  console.log(`\n${rouges ? '✗ ROUGE' : '✓ VERT'} — ${verts} moments vérifiés, ${rouges} manquants, ${nonJoues} non joués · ${Math.round((Date.now() - t0) / 1000)} s · captures : ${SHOTS}`);
  process.exit(rouges ? 1 : 0);
})();
