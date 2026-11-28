#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC — « ORDINATEUR SERVEUR » (28 nov., ext. 5.457.0, capacité `serveur`) : la page d'état de l'app et la section du
//  panneau (interrupteur, état, installation guidée), 390 px tactile et 1512 px, clair et sombre. Captures REGARDÉES.
//  App : le VRAI `dist/` (npm run build) servi par le monde des bancs (_e2e-monde.cjs), base à état : trois profils de
//  l'ordinateur (lignes `presence_*` à la forme de `publierPresence`) — shop_a prêt, shop_b déconnecté, shop_c en
//  vérification — et un quatrième muet depuis 2 h.
//  Panneau : le VRAI vrm-badge.js + vrm-ui.js sur une fausse page vinted.fr ; `serveur` répond comme `serveurCarte`.
//  Tout est inventé (dépôt public). Captures : BANC_CAPTURE=dossier.
//  `--prouve` : mutations du build (l'écran ne compte plus à rebours ; le guide perd ses étapes) ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { monde, certificat, HOTES } = require('./_e2e-monde.cjs');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), path.join(__dirname, '..', '..')]) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const RACINE = path.join(__dirname, '..', '..');
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4811;
const DIST0 = path.resolve(process.env.BANC_DIST || path.join(RACINE, 'dist'));
const CAPT = process.env.BANC_CAPTURE || path.join(os.tmpdir(), 'banc-ordinateur-serveur');
const EXT = process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const MUT = arg('--mutation');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); } };
const MUTATIONS = {
  'sans-rebours': [[/setInterval\(\(\)=>(\w+)\(Date\.now\(\)\),1e3\)/g, 'setInterval(()=>{},1e3)']],
  'sans-etapes': [[/\["profil","extension","connecter","vinted","allumer","garder"\]/g, '[]']],
};
if (process.argv.includes('--prouve')) {
  const lancer = (extra) => spawnSync(process.execPath, [__filename, ...extra], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 900000, encoding: 'utf8' });
  const base = lancer([]); let rate = base.status === 0 ? 0 : 1;
  console.log(`${base.status === 0 ? '✅' : '❌'} sur le code tel quel : ${base.status === 0 ? 'vert' : 'ROUGE'}`);
  for (const m of Object.keys(MUTATIONS)) { const r = lancer(['--mutation', m]); const bon = r.status !== 0; if (!bon) rate++; console.log(`${bon ? '✅' : '❌'} mutation « ${m} » : ${bon ? 'rouge' : 'RESTE VERTE'}`); }
  process.exit(rate ? 1 : 0);
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-serveur-'));
function preparerDist() {
  const m = MUT && MUTATIONS[MUT];
  if (!m) return DIST0;
  const d = path.join(TMP, 'dist'); fs.cpSync(DIST0, d, { recursive: true }); let touche = 0;
  const marcher = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) marcher(p); else if (/\.js$/.test(f)) { const s = fs.readFileSync(p, 'utf8'); let t = s; for (const [a, b] of m) t = t.replace(a, b); if (t !== s) { fs.writeFileSync(p, t); touche++; } } } };
  marcher(d);
  if (!touche) { console.log(`❌ mutation ${MUT} : rien trouvé à muter dans dist/`); process.exit(2); }
  return d;
}
const regles = () => HOTES.map((h) => `MAP ${h} 127.0.0.1:${PORT}`).concat(['MAP * ~NOTFOUND']).join(', ');
const U = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'vendeur@exemple.test', mdp: 'bon-mot-de-passe' };
let M;
function semer() {
  const t = Date.now();
  const app = M.st.tables.app_data = (M.st.tables.app_data || []).filter((r) => !/^presence_/.test(r.id));
  M.st.tables.vinted_accounts = [{ vinted_user_id: '41000001', login: 'shop_a', domain: 'www.vinted.fr', owner: U.id }, { vinted_user_id: '41000002', login: 'shop_b', domain: 'www.vinted.fr', owner: U.id }, { vinted_user_id: '41000003', login: 'shop_c', domain: 'www.vinted.fr', owner: U.id }];
  const pres = (id, atMs, serveur, nav = 'chrome') => app.push({ id: 'presence_' + id, owner: U.id, updated_at: new Date(atMs).toISOString(),
    data: { v: 1, at: new Date(atMs).toISOString(), atMs, ver: '5.457.0', code: '5.457.0', appareil: { paquet: 'chromium', nav, systeme: 'mac' }, comptes: [], retenues: [], enCours: '', rt: 'joint', lus: {}, serveur } });
  pres('a1a1a1a1a1a1a1a1', t - 20000, { on: true, uid: '41000001', nom: 'shop_a', lu: t - 95000, prochain: t + 192000, actions: 4, cap: 50, code: 'pret' });
  pres('b2b2b2b2b2b2b2b2', t - 30000, { on: true, uid: '', nom: 'shop_b', lu: t - 40 * 60000, prochain: 0, actions: null, cap: null, deconnecte: true, code: 'deconnecte' });
  pres('c3c3c3c3c3c3c3c3', t - 25000, { on: true, uid: '41000003', nom: 'shop_c', lu: t - 9 * 60000, prochain: t + 60000, actions: 12, cap: 50, captcha: true, code: 'captcha' });
  pres('d4d4d4d4d4d4d4d4', t - 2 * 3600000, { on: true, uid: '41000004', nom: 'shop_d', lu: t - 2 * 3600000, prochain: 0, actions: 0, cap: 50, code: 'pret' }, 'edge');
}
async function contexte(nav, { mobile, sombre }) {
  const ctx = await nav.newContext(Object.assign({ viewport: mobile ? { width: 390, height: 844 } : { width: 1512, height: 950 }, timezoneId: 'Europe/Paris', locale: 'fr-FR', ignoreHTTPSErrors: true, colorScheme: sombre ? 'dark' : 'light' },
    mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const s = M.ouvrir(M.USERS.get(U.email));
  await ctx.addInitScript(({ s, uid, sombre }) => {
    if (location.origin !== 'https://vrm.center') return;
    try { localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vrm_ext_separee_' + uid, '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
      localStorage.setItem('vrm_design_v2', '1');
      localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair'));
      if (!localStorage.getItem('__banc_pose')) { localStorage.setItem('__banc_pose', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); } } catch (_) {}
  }, { s: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user: s.user }, uid: U.id, sombre });
  return ctx;
}
const lire = (pg) => pg.evaluate(() => {
  const r = document.querySelector('[data-ecran-serveur]');
  if (!r) return null;
  const de = document.documentElement;
  const vis = (x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const cibles = [...r.querySelectorAll('button, a[href], summary, [role="button"]')].filter(vis).map((x) => { const b = x.getBoundingClientRect(); return { h: Math.round(b.height), w: Math.round(b.width), t: (x.innerText || '').trim().slice(0, 30) }; });
  return { lignes: [...r.querySelectorAll('[data-srv-ligne]')].map((x) => ({ id: x.getAttribute('data-srv-ligne'), code: x.getAttribute('data-srv-code'), prochain: x.getAttribute('data-srv-prochain'), actions: x.getAttribute('data-srv-actions'), cap: x.getAttribute('data-srv-cap'), texte: (x.innerText || '').replace(/\s+/g, ' ') })),
    gestes: [...r.querySelectorAll('[data-srv-geste]')].map((x) => x.getAttribute('data-srv-geste')),
    etapes: r.querySelectorAll('[data-srv-etape]').length, latence: (r.querySelector('[data-srv-latence]') || { getAttribute: () => '' }).getAttribute('data-srv-latence'),
    deborde: de.scrollWidth - de.clientWidth, petites: cibles.filter((c) => c.h < 44), texte: (r.innerText || '').replace(/\s+/g, ' ') };
}).catch(() => null);
const TECH = /\b(presence_|serveur:|undefined|NaN|null|uid|cmd_dist)\b/;
const capture = async (pg, nom) => { try { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: true }); } catch (_) {} };

async function app(nav, o) {
  console.log(`\n── app ${o.nom}`);
  semer();
  const ctx = await contexte(nav, o); const pg = await ctx.newPage();
  try {
    await pg.goto('https://vrm.center/?tab=serveur', { waitUntil: 'domcontentloaded' });
    let e = null; for (let i = 0; i < 200; i++) { e = await lire(pg); if (e && e.lignes.length >= 4) break; await attendre(200); }
    await attendre(600);
    await capture(pg, o.nom + '-page');
    const par = (c) => (e ? e.lignes.find((l) => l.code === c) : null);
    dit(!!e && e.lignes.length === 4, `${o.nom} · une ligne par profil (4)`, JSON.stringify(e && e.lignes.map((l) => l.code)));
    const pa = par('pret');
    dit(!!pa && /shop_a · prêt/.test(pa.texte) && /lu il y a 1 min \d\d? s/.test(pa.texte) && /prochaine lecture dans 3 min/.test(pa.texte) && /4\/50 actions cette heure/.test(pa.texte), `${o.nom} · « shop_a · prêt » · lu · prochaine lecture dans N · 4/50 actions`, pa && pa.texte);
    const p1 = pa ? Number(pa.prochain) : NaN; await attendre(2200); const e2 = await lire(pg); const pa2 = e2 && e2.lignes.find((l) => l.code === 'pret');
    dit(pa2 && Number(pa2.prochain) <= p1 - 1, `${o.nom} · « prochaine lecture dans N s » avance à la seconde (${p1} → ${pa2 && pa2.prochain})`);
    dit(!!par('deconnecte') && /shop_b · déconnecté/.test(par('deconnecte').texte), `${o.nom} · « shop_b · déconnecté de Vinted »`, JSON.stringify(par('deconnecte')));
    dit(!!par('captcha') && /shop_c · vérification/.test(par('captcha').texte), `${o.nom} · « shop_c · vérification Vinted »`, JSON.stringify(par('captcha')));
    dit(!!par('eteint') && /shop_d · ne répond plus/.test(par('eteint').texte) && /Edge · Mac/.test(par('eteint').texte), `${o.nom} · le profil muet depuis 2 h : « ne répond plus », son navigateur`, JSON.stringify(par('eteint')));
    dit(!!e && ['deconnecte', 'captcha', 'eteint'].every((c) => e.gestes.includes(c)) && !e.gestes.includes('pret'), `${o.nom} · chaque arrêt a SON geste (« Que faire ? »), rien sur le prêt`, JSON.stringify(e && e.gestes));
    dit(!!e && e.etapes === 6 && e.latence === '165', `${o.nom} · l’installation guidée (6 étapes) et la vitesse mesurée (2 min 45 s en moyenne)`, JSON.stringify(e && [e.etapes, e.latence]));
    dit(!!e && e.deborde <= 0 && (!o.mobile || !e.petites.length), `${o.nom} · aucun débordement ; cibles ≥ 44 px`, JSON.stringify(e && [e.deborde, e.petites.slice(0, 4)]));
    dit(!!e && !TECH.test(e.texte), `${o.nom} · aucun mot technique dans le texte`, e && (e.texte.match(TECH) || [])[0]);
    // « Que faire ? » s'ouvre (le geste du déconnecté), et « Comment faire ? » de l'installation.
    await pg.evaluate(() => { for (const d of document.querySelectorAll('[data-srv-geste="deconnecte"], [data-srv-pourquoi="regles"]')) d.open = true; });
    await attendre(300);
    const ouvert = await pg.evaluate(() => (document.querySelector('[data-srv-geste="deconnecte"]') || {}).innerText || '').catch(() => '');
    dit(/reconnecte-toi/.test(ouvert), `${o.nom} · le geste du déconnecté : ouvrir le profil Chrome, se reconnecter`, ouvert);
    await capture(pg, o.nom + '-gestes');
  } finally { await ctx.close().catch(() => {}); }
}

// ── LE PANNEAU ─────────────────────────────────────────────────────────────
const BADGE = fs.readFileSync(path.join(EXT, 'vrm-badge.js'), 'utf8');
const UI = fs.readFileSync(path.join(EXT, 'vrm-ui.js'), 'utf8');
const LOGO = fs.readFileSync(path.join(EXT, 'logo-vrm-96.png'));
const T0 = Date.now();
const ETAT = { ok: true, plateforme: 'vinted', capte: true, version: '5.457.0', code: '5.457.0', vrm: { ok: true, connecte: true, email: 'sophie@exemple.fr', cloisonne: true },
  site: { id: '111', nom: 'shop_a', choix: 'oui', jauge: { h: 4, maxH: 50, j: 20, maxJ: 200, complet: true }, favoris: null }, secu: { niveau: 'ok', texte: '' }, toutArrete: false, flux: { okAt: T0 - 60000 }, liens: [], capteCoupe: false };
const LISTES = { ok: true, plateforme: 'vinted', compte: { id: '111', nom: 'shop_a' }, offres: [], annonces: { lu: T0, aConfirmer: false, total: 0, liste: [], toutes: [], nTous: 0, statuts: {} }, automatisations: null, notifications: { vu: T0, liste: [] }, ventes: { lu: T0, total: 0, liste: [] }, messages: { lu: T0, liste: [] }, autres: null };
async function panneau(nav, o) {
  console.log(`\n── panneau ${o.nom}`);
  const ctx = await nav.newContext(Object.assign({ colorScheme: o.sombre ? 'dark' : 'light', viewport: o.mobile ? { width: 390, height: 844 } : { width: 1512, height: 900 } }, o.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (x) => erreurs.push(String(x).slice(0, 200)));
  await pg.route('**/*', (r) => /logo-vrm-96\.png/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/png', body: LOGO }) : r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#fff"><main style="height:2000px">Vinted</main></body></html>' }));
  await pg.goto('https://www.vinted.fr/catalog');
  await pg.evaluate(({ e, js, ui, L, T0 }) => {
    window.__envoyes = []; window.__on = false;
    const copie = (x) => JSON.parse(JSON.stringify(x));
    const orig = Element.prototype.attachShadow; Element.prototype.attachShadow = function (o) { return orig.call(this, Object.assign({}, o, { mode: 'open' })); };
    const srv = () => ({ ok: true, appareil: 'a1a1a1a1a1a1a1a1', serveur: window.__on ? { on: true, uid: '111', nom: 'shop_a', lu: Date.now() - 95000, prochain: Date.now() + 192000, actions: 4, cap: 50, pause: false, captcha: false, prudence: false, budget: false, deconnecte: false, code: 'pret' } : { on: false },
      autres: [{ appareil: 'b2b2b2b2b2b2b2b2', code: 'deconnecte', compte: '', nom: 'shop_b' }, { appareil: 'c3c3c3c3c3c3c3c3', code: 'pret', compte: '222', nom: 'shop_c' }] });
    window.chrome = { runtime: { id: 'ext', getURL: (p) => location.origin + '/' + p, getManifest: () => ({ version: e.version }), lastError: null,
      sendMessage: (msg, cb) => { window.__envoyes.push(copie(msg)); let rep = { ok: true };
        if (msg.action === 'etat') rep = copie(e); else if (msg.action === 'carteListes') rep = copie(L); else if (msg.action === 'capteLot') rep = { ok: true, lot: null };
        else if (msg.action === 'serveur') { if (msg.quoi === 'allumer') window.__on = true; if (msg.quoi === 'eteindre') window.__on = false; rep = srv(); }
        setTimeout(() => cb && cb(rep), 0); } },
      storage: { local: { get: (k, cb) => { if (cb) setTimeout(() => cb({}), 0); return Promise.resolve({}); }, set: (o, cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve(); } }, onChanged: { addListener() {} } } };
    const u = document.createElement('script'); u.textContent = ui; document.documentElement.appendChild(u);
    const s = document.createElement('script'); s.textContent = js; document.documentElement.appendChild(s);
  }, { e: ETAT, js: BADGE, ui: UI, L: LISTES, T0 });
  await attendre(300);
  const clic = async (sel) => { await pg.evaluate((s) => { const b = document.getElementById('vrm-badge').shadowRoot.querySelector(s); if (b) b.click(); }, sel); await attendre(350); };
  const b = await pg.evaluate(() => { const x = document.getElementById('vrm-badge').shadowRoot.querySelector('.btn').getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  if (o.mobile) await pg.touchscreen.tap(b.x, b.y); else { await pg.mouse.move(5, 5); await pg.mouse.move(b.x, b.y); await pg.mouse.click(b.x, b.y); }
  await attendre(500);
  if (o.mobile) await clic('[data-vx-plus]');
  await clic('[data-onglet-b="parametres"]');
  await attendre(500);
  const voir = () => pg.evaluate(() => { const r = document.getElementById('vrm-badge').shadowRoot; const z = r.querySelector('[data-serveur-panneau]'); if (z) z.scrollIntoView({ block: 'start' });
    const vis = (el) => el && el.getClientRects().length && el.getBoundingClientRect().width > 0;
    const pts = z ? [...z.querySelectorAll('button, summary')].filter(vis).map((x) => { const q = x.getBoundingClientRect(); return { h: Math.round(q.height), w: Math.round(q.width), t: (x.innerText || '').slice(0, 20) }; }).filter((x) => x.h < 43.5) : [];
    return z ? { on: z.getAttribute('data-os-on'), etat: (z.querySelector('[data-os-etat]') || { getAttribute: () => '' }).getAttribute('data-os-etat'), autres: z.querySelectorAll('[data-os-autre]').length, etapes: z.querySelectorAll('[data-os-etape]').length, texte: z.innerText.replace(/\s+/g, ' '), petits: pts, deborde: z.scrollWidth > z.clientWidth + 1 } : null; });
  let v = await voir();
  dit(!!v && v.on === '0' && v.etat === 'off' && /Éteint sur ce profil/.test(v.texte), `${o.nom} · « Mode ordinateur allumé » : éteint par défaut`, JSON.stringify(v));
  await pg.evaluate(() => { const d = document.getElementById('vrm-badge').shadowRoot.querySelector('[data-os-guide]'); if (d) d.open = true; });
  await attendre(300); await capture(pg, `panneau-${o.nom}-guide`);
  v = await voir();
  dit(!!v && v.etapes === 6 && /1\. Un profil Chrome par compte/.test(v.texte) && /Jamais deux comptes en même temps/.test(v.texte), `${o.nom} · l’installation guidée : 6 étapes, la règle « jamais deux comptes »`, v && v.texte.slice(0, 200));
  await clic('[data-os-basculer]'); await attendre(400);
  v = await voir();
  const env = await pg.evaluate(() => window.__envoyes.filter((m) => m.action === 'serveur').map((m) => m.quoi));
  dit(!!v && v.on === '1' && v.etat === 'pret' && /shop_a · prêt/.test(v.texte) && /prochaine lecture dans 3 min/.test(v.texte) && /4\/50 actions/.test(v.texte) && env.includes('allumer'), `${o.nom} · « Allumer » (SON toucher) ⇒ « shop_a · prêt », prochaine lecture, actions`, JSON.stringify([v && v.texte.slice(0, 160), env]));
  dit(!!v && v.autres === 2 && /shop_b · déconnecté de Vinted/.test(v.texte), `${o.nom} · les autres profils de l’ordinateur`, v && v.texte.slice(0, 300));
  dit(!!v && !v.petits.length && !v.deborde && !erreurs.length, `${o.nom} · cibles ≥ 44 px, aucun débordement, aucune erreur`, JSON.stringify([v && v.petits, erreurs]));
  await capture(pg, `panneau-${o.nom}-allume`);
  await ctx.close().catch(() => {});
}

(async () => {
  if (!pw) { console.log('❌ Playwright introuvable'); process.exit(1); }
  if (!fs.existsSync(path.join(DIST0, 'index.html'))) { console.log(`❌ pas de build dans ${DIST0} — lance npm run build`); process.exit(1); }
  const DIST = preparerDist();
  M = monde({ tls: certificat(TMP), port: PORT, dist: DIST, comptes: {}, journal: [] });
  M.USERS.set(U.email, { id: U.id, email: U.email, mdp: U.mdp });
  try { await M.ecouter(); } catch (e) { console.log(`❌ le port ${PORT} est pris — BANC_PORT=…`); process.exit(1); }
  const nav = await pw.chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader'] });
  const jeux = [{ nom: '390-clair', mobile: true, sombre: false }, { nom: '390-sombre', mobile: true, sombre: true }, { nom: '1512-clair', mobile: false, sombre: false }, { nom: '1512-sombre', mobile: false, sombre: true }];
  try {
    for (const o of MUT ? jeux.slice(0, 1) : jeux) await app(nav, o);
    if (!MUT) for (const o of jeux) await panneau(nav, o);
  } finally { await nav.close().catch(() => {}); try { M.fermer && M.fermer(); } catch (_) {} try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\nCaptures : ${CAPT}\n${ok} verts, ${ko} rouges.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
