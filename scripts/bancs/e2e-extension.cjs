require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC E2E « L'APP ET LA VRAIE EXTENSION ENSEMBLE » (11 nov.)
//
//  Un VRAI Chromium (nouveau mode headless), la VRAIE extension chargée depuis
//  son dossier (`--load-extension`, service worker MV3, content scripts, pont),
//  le VRAI build de l'app (`dist/`). Tout est servi en LOCAL sous les vrais
//  noms par `_e2e-monde.cjs` (DNS de Chromium redirigé, `MAP * ~NOTFOUND` pour
//  le reste : rien ne sort) : un faux www.vinted.fr (pages + API v2 à la forme
//  réelle, le compte est celui du cookie `access_token_web`), un faux Supabase
//  à état (GoTrue + PostgREST, RLS par `owner`), vrm.center = `dist/`.
//  Données INVENTÉES (dépôt public) : deux comptes Vinted, vendeur_a (111) et
//  autre_b (222), un vendeur VRM.
//
//  Scénarios (un seul profil Chrome, dans l'ordre, comme une vraie journée) :
//    1. CONNEXION : « Se connecter en passant par le site VRM » dans la fenêtre
//       de l'extension ⇒ VRM s'ouvre, l'extension reçoit une session À ELLE
//       (fabriquée par le serveur), du MÊME compte VRM que l'app ; VRM le dit.
//    2. DRESSING : il ouvre son dressing sur vinted.fr ⇒ annonces rangées
//       (`harvest_111_listings`, sous son vendeur) ⇒ visibles dans Annonces
//       (`data-carte-annonce`). Il regarde ensuite le dressing d'un AUTRE membre
//       (222) : rien de cet autre n'entre dans SES annonces (§5).
//    3. VENTE : sa vente Vinted ⇒ dans Ventes (`data-tx`), sur SON compte.
//    4. COMMANDE : Annonces → Qui dorment → « Baisser le prix » → Oui :
//       l'extension baisse le prix DEPUIS L'ONGLET vinted.fr, au nom du compte
//       de l'onglet (cookie 111, aucun `Authorization`), relit le prix, l'app
//       l'affiche ; plafond plein (45/50) ⇒ RIEN ne part chez Vinted ; un 429 ⇒
//       pause posée, la commande suivante n'envoie RIEN.
//    5. AUTRE COMPTE dans l'onglet (il bascule sur autre_b) : une commande pour
//       vendeur_a (même postée directement au pont, sans passer par l'écran)
//       n'envoie RIEN chez Vinted ; l'app ne propose pas la baisse ; et la vente
//       d'autre_b est rangée sous autre_b, jamais sous vendeur_a.
//    6. EXTENSION EN RETARD (manifeste 5.335, avant `baisseprix`) dans un
//       profil neuf : l'app ne promet rien — « Baisser » fermé, aucune commande.
//
//  Preuve (§6.1) : `--mutation NOM` exécute le banc sur une copie de
//  l'extension (ou de `dist/`) où UNE règle est réaffaiblie : il doit être
//  ROUGE. `--prouve` les lance toutes (chacune doit rougir) après un passage
//  vert. Mutations (table MUTATIONS) : liaison, autre-membre, compte-capture,
//  garde-compte, plafond, pause-429, capacite.
//
//  Usage : npm run build && node scripts/bancs/e2e-extension.cjs [--mutation m | --prouve] [--seul 1,2]
//  Port : 4796 (`BANC_PORT`). `BANC_CAPTURE=<dossier>` : captures d'écran.
//  `BANC_DIST` / `BANC_EXT` : un autre build / une autre extension (preuve sur un autre arbre).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const { monde, certificat, jetonVinted, HOTES } = require('./_e2e-monde.cjs');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), path.join(__dirname, '..', '..')]) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const RACINE = path.join(__dirname, '..', '..');
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4796;
const DIST0 = path.resolve(process.env.BANC_DIST || path.join(RACINE, 'dist'));
const EXT0 = path.resolve(process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension'));
const CAPT = process.env.BANC_CAPTURE || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SEULS = arg('--seul') ? arg('--seul').split(',') : null;
const MUT = arg('--mutation');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Les mutations : chacune réaffaiblit UNE règle ; le banc doit rougir ──────
//  `ext` : remplacements dans une COPIE de background.js ; `dist` : dans une
//  copie des fichiers .js de dist/ (le build minifié garde ces littéraux).
const MUTATIONS = {
  // 1 — l'app ne fabrique plus la session de l'extension (la liaison casse)
  liaison: { dist: [[/mode=session-extension/g, 'mode=session-extension-cassee']] },
  // 2 — le dressing d'un AUTRE membre rangé comme le sien
  'autre-membre': { ext: [["if (!pid || id == null || String(id) !== pid) { noterDiag('ignore_dressing_autre_membre'); return; }", '']] },
  // 3 — une capture rangée sous un compte qui n'est PAS celui de l'onglet
  'compte-capture': { ext: [['  const uid = await activeAccountId(domain);\n  if (!uid) { noterDiag(`abandon_sans_compte_${type || \'inconnu\'}`); return; }', "  const uid = '111';"]] },
  // 4/5 — la garde du compte de l'onglet ne compare plus les comptes
  'garde-compte': { ext: [['  if (String(actif) !== String(uid)) {\n    return { ok: false, code: \'vinted-autre\'', "  if (false) {\n    return { ok: false, code: 'vinted-autre'"]] },
  // 4 — le plafond d'actions ne compte plus
  plafond: { ext: [['  const c = await compterAction(String(uid), ACTIONS_MAX_HEURE - reserve, nA);', '  const c = { ok: true, at: Date.now() };']] },
  // 4 — un 429 ne pose plus de pause
  'pause-429': { ext: [['const freinVinted = (s) => s === 429 || s === 403;', 'const freinVinted = (s) => false;']] },
  // 6 — l'app croit la baisse arrivée une version plus tôt (promet à une 5.335)
  capacite: { dist: [[/baisseprix:"5\.336\.0"/g, 'baisseprix:"5.335.0"']] },
};

let ko = 0, ok = 0;
const resultats = [];
const dit = (bon, quoi, det) => { resultats.push({ bon: !!bon, quoi }); if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); } };
const veut = (n) => !SEULS || SEULS.includes(String(n));

// ── --prouve : un passage vert, puis chaque mutation doit rougir ─────────────
if (process.argv.includes('--prouve')) {
  const lancer = (extra) => spawnSync(process.execPath, [__filename, ...extra], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 900000, encoding: 'utf8' });
  const base = lancer([]);
  const vert = base.status === 0;
  console.log(`${vert ? '✅' : '❌'} passage sur le code tel quel : ${vert ? 'vert' : 'ROUGE'}`);
  if (!vert) console.log(String(base.stdout).split('\n').filter((l) => /❌/.test(l)).join('\n'));
  let rate = vert ? 0 : 1;
  for (const m of Object.keys(MUTATIONS)) {
    const r = lancer(['--mutation', m]);
    const rouges = String(r.stdout).split('\n').filter((l) => /❌/.test(l));
    const bon = r.status !== 0 && rouges.length > 0;
    if (!bon) rate++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${m} » : ${bon ? `rouge (${rouges.length} contrôle(s))` : 'RESTE VERTE — le banc ne la voit pas'}`);
    for (const l of rouges.slice(0, 3)) console.log('     ' + l.trim());
  }
  process.exit(rate ? 1 : 0);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-e2e-ext-'));
const extId = (dir) => crypto.createHash('sha256').update(path.resolve(dir)).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

// Une copie de l'extension (son identifiant ne dépend pas de l'emplacement du
// dépôt), mutée si demandé ; `version` : un manifeste plus ancien (scénario 6).
function preparerExtension(nom, { version } = {}) {
  const d = path.join(TMP, nom);
  fs.cpSync(EXT0, d, { recursive: true });
  const m = MUT && MUTATIONS[MUT] && MUTATIONS[MUT].ext;
  if (m) {
    const f = path.join(d, 'background.js');
    let s = fs.readFileSync(f, 'utf8');
    for (const [a, b] of m) { if (!s.includes(a)) { console.log(`❌ mutation ${MUT} : texte introuvable dans background.js (le banc ne mute plus rien)`); process.exit(2); } s = s.split(a).join(b); }
    fs.writeFileSync(f, s);
  }
  if (version) {
    const mf = path.join(d, 'manifest.json');
    const j = JSON.parse(fs.readFileSync(mf, 'utf8')); j.version = version; fs.writeFileSync(mf, JSON.stringify(j, null, 2));
    const f = path.join(d, 'background.js');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/const CODE_VERSION = '[\d.]+';/, `const CODE_VERSION = '${version}';`));
  }
  return d;
}
function preparerDist() {
  const m = MUT && MUTATIONS[MUT] && MUTATIONS[MUT].dist;
  if (!m) return DIST0;
  const d = path.join(TMP, 'dist');
  fs.cpSync(DIST0, d, { recursive: true });
  let touche = 0;
  const marcher = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) marcher(p); else if (/\.js$/.test(f)) { const s = fs.readFileSync(p, 'utf8'); let t = s; for (const [a, b] of m) t = t.replace(a, b); if (t !== s) { touche++; fs.writeFileSync(p, t); } } } };
  marcher(d);
  if (!touche) { console.log(`❌ mutation ${MUT} : rien trouvé à muter dans dist/`); process.exit(2); }
  return d;
}

// ── Les données inventées ─────────────────────────────────────────────────
const U = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'vendeur@exemple.test', mdp: 'bon-mot-de-passe' };
const ilYa = (j) => Math.floor((Date.now() - j * 86400e3) / 1000);
const COMPTES = () => ({
  111: { login: 'vendeur_a',
    annonces: [{ id: 91010001, titre: 'Nike Cortez blanche', prix: 60, cree: ilYa(95) }, { id: 91010002, titre: 'Adidas Samba noire', prix: 75, cree: ilYa(3) }],
    ventes: [{ tx: 7001001, titre: 'Nike Dunk Low grise', prix: 80, itemId: 91010009 }] },
  222: { login: 'autre_b',
    annonces: [{ id: 92020001, titre: 'Puma Suede rouge', prix: 40, cree: ilYa(20) }, { id: 92020002, titre: 'Asics Gel Lyte', prix: 55, cree: ilYa(20) }, { id: 92020003, titre: 'Vans Old Skool', prix: 35, cree: ilYa(20) }],
    ventes: [{ tx: 8002001, titre: 'New Balance 550', prix: 90, itemId: 92020009 }] },
});

// ── Chromium + extension ────────────────────────────────────────────────────
const regles = () => HOTES.map((h) => `MAP ${h} 127.0.0.1:${PORT}`).concat(['MAP * ~NOTFOUND']).join(', ');
function lancer(udd, ext) {
  const args = ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader',
    '--enable-unsafe-extension-debugging', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`];
  return pw.chromium.launchPersistentContext(udd, { executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1512, height: 950 }, args });
}
// Le service worker VIVANT (ses fonctions évaluées, `chrome.storage` présent).
async function sw(ctx, id, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    for (const s of ctx.serviceWorkers().filter((x) => x.url().startsWith(`chrome-extension://${id}/`)).reverse()) {
      const pret = await Promise.race([s.evaluate(() => typeof chrome !== 'undefined' && !!chrome.storage && typeof authToken === 'function').catch(() => false), attendre(1500).then(() => false)]);
      if (pret) return s;
    }
    await attendre(200);
  }
  return null;
}
const dansSW = async (ctx, id, fn, a) => { const s = await sw(ctx, id, 8000); if (!s) return { erreur: 'pas de service worker' }; return s.evaluate(fn, a).catch((e) => ({ erreur: String(e.message || e).slice(0, 200) })); };
const attendreQue = async (fn, ms, pas = 300) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn().catch(() => null); if (v) return v; await attendre(pas); } return null; };
const capture = async (pg, nom) => { if (!CAPT || !pg) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png') }).catch(() => {}); };

// La session de l'app (comme `session.cjs`) : posée une fois, base cloisonnée.
async function poserSessionApp(ctx, s) {
  await ctx.addInitScript(({ s, uid }) => {
    if (location.origin !== 'https://vrm.center') return;
    try {
      localStorage.setItem('schema_cloisonne', '1');
      localStorage.setItem('vrm_ext_separee_' + uid, '1');
      if (s && !localStorage.getItem('__banc_pose')) { localStorage.setItem('__banc_pose', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); }
      window.__VRM_BAISSE_PAUSE = 0;
    } catch (_) {}
  }, { s, uid: U.id });
}

// Annonces → À relancer → Qui dorment (comme baisse-prix.cjs).
async function ouvrirQuiDorment(pg) {
  await pg.goto('https://vrm.center/?tab=vinted_annonces', { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-vue-relancer]', { timeout: 40000 }).catch(() => {});
  await pg.locator('[data-vue-relancer]').first().click().catch(() => {});
  await pg.waitForSelector('[data-qui-dorment]', { timeout: 20000 }).catch(() => {});
  if (await pg.locator('[data-qd-mode-choix="dort"]').count()) await pg.locator('[data-qd-mode-choix="dort"]').first().click().catch(() => {});
  await pg.waitForSelector('[data-qd-ligne]', { timeout: 20000 }).catch(() => {});
  await attendre(500);
}
const lireBP = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-baisse-serie]'); if (!s) return null;
  const L = {}; for (const e of s.querySelectorAll('[data-bp-ligne]')) L[e.getAttribute('data-bp-ligne')] = { coche: e.getAttribute('data-bp-coche'), nouveau: e.getAttribute('data-bp-nouveau'), bloque: e.getAttribute('data-bp-bloque'), etat: e.getAttribute('data-bp-etat'), vu: e.getAttribute('data-bp-prix-vu'), texte: e.innerText.replace(/\s+/g, ' ') };
  const lancer = s.querySelector('[data-bp-lancer]');
  return { L, phase: s.getAttribute('data-bp-phase'), lancer: lancer ? { n: lancer.getAttribute('data-bp-lancer'), off: lancer.disabled } : null,
    ext: (s.querySelector('[data-bp-ext]') || {}).textContent || '', bilan: (s.querySelector('[data-bp-bilan]') || { getAttribute: () => null }).getAttribute('data-bp-bilan'), texte: s.innerText.replace(/\s+/g, ' ') };
}).catch(() => null);
// Coche la paire, ouvre la feuille, lance et confirme ; rend l'état de la feuille une fois la série finie.
async function baisserDepuisApp(pg, id, { lancer: go = true } = {}) {
  await ouvrirQuiDorment(pg);
  const casePaire = pg.locator(`[data-qd-case="${id}"]`);
  if (!(await casePaire.count())) return { absente: true, qd: await pg.evaluate(() => [...document.querySelectorAll('[data-qd-ligne]')].map((e) => e.getAttribute('data-qd-ligne'))).catch(() => []) };
  await casePaire.check().catch(() => {});
  await pg.locator('[data-qd-baisser]').click().catch(() => {});
  await pg.waitForSelector('[data-baisse-serie]', { timeout: 15000 }).catch(() => {});
  await attendre(600);
  const avant = await lireBP(pg);
  if (!go || !avant || !avant.lancer || avant.lancer.off) return { avant, apres: avant, lance: false };
  await pg.locator('[data-bp-lancer]').click().catch(() => {});
  await pg.waitForSelector('[data-bp-confirmer]', { timeout: 6000 }).catch(() => {});
  await pg.locator('[data-bp-confirmer]').click().catch(() => {});
  const apres = await attendreQue(async () => { const b = await lireBP(pg); return b && b.L[String(id)] && b.L[String(id)].etat && !/attente|encours|envoi/.test(b.L[String(id)].etat) ? b : null; }, 45000, 500);
  return { avant, apres: apres || await lireBP(pg), lance: true };
}
const fermerFeuille = async (pg) => { await pg.keyboard.press('Escape').catch(() => {}); await attendre(300); };

// ════════════════════════════════════════════════════════════════════════════
(async () => {
  if (!pw) { console.log('❌ Playwright introuvable'); process.exit(1); }
  if (!fs.existsSync(path.join(DIST0, 'index.html'))) { console.log(`❌ pas de build dans ${DIST0} — lance npm run build`); process.exit(1); }
  if (MUT && !MUTATIONS[MUT]) { console.log(`❌ mutation inconnue : ${MUT} (${Object.keys(MUTATIONS).join(', ')})`); process.exit(2); }
  const DIST = preparerDist();
  const tls = certificat(TMP);
  const journal = [];
  const M = monde({ tls, port: PORT, dist: DIST, comptes: COMPTES(), journal });
  M.USERS.set(U.email, { id: U.id, email: U.email, mdp: U.mdp });
  try { await M.ecouter(); } catch (e) { console.log(`❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); }
  const EXT = preparerExtension('ext');
  const ID = extId(EXT);
  const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  console.log(`extension ${VERSION} (${ID.slice(0, 8)}…) · app ${DIST}${MUT ? ` · MUTATION « ${MUT} »` : ''}`);
  const ctxs = [];
  const vinted = (f) => M.st.vinted.filter(f || (() => true));
  try {
    const ctx = await lancer(path.join(TMP, 'profil'), EXT); ctxs.push(ctx);
    const erreursApp = [];
    ctx.on('page', (p) => p.on('pageerror', (e) => { if (/vrm\.center/.test(p.url())) erreursApp.push(String(e.message).slice(0, 160)); }));
    const sApp = M.ouvrir(M.USERS.get(U.email));
    await poserSessionApp(ctx, { access_token: sApp.access_token, refresh_token: sApp.refresh_token, expires_at: Date.now() + 3600e3, user: sApp.user });
    const w = await sw(ctx, ID);
    dit(!!w, 'le service worker MV3 de la vraie extension démarre dans Chromium headless');
    if (!w) throw new Error('pas de service worker');

    // ══ 1. CONNEXION DE L'EXTENSION À CE COMPTE VRM ═══════════════════════════
    console.log('\n── 1. connexion de l’extension (liaison par le site VRM)');
    let vrm = null;
    {
      const pop = await ctx.newPage();
      await pop.goto(`chrome-extension://${ID}/popup.html`); await attendre(1000);
      const b = await pop.$('#lierBtn');
      dit(!!b, '1 : la fenêtre de l’extension propose de se connecter en passant par VRM');
      if (b) await b.click().catch(() => {});
      vrm = await attendreQue(async () => ctx.pages().find((x) => /^https:\/\/vrm\.center\//.test(x.url())), 15000, 200);
      dit(!!vrm, '1 : un clic ouvre VRM');
      const s = await attendreQue(async () => { const r = await dansSW(ctx, ID, async () => (await chrome.storage.local.get('vrmSession')).vrmSession || null); return r && r.user_id && !r.mort ? r : null; }, 20000);
      dit(!!s && s.user_id === U.id, '1 : l’extension est connectée à CE compte VRM (le même vendeur que l’app)', JSON.stringify(s && { user_id: s.user_id }));
      dit(!!s && s.refresh_token !== sApp.refresh_token, '1 : avec SA session (jamais celle de l’app)');
      const band = vrm ? await attendreQue(() => vrm.evaluate(() => { const x = document.querySelector('[data-liaison]'); return x ? x.getAttribute('data-liaison') : null; }), 10000) : null;
      dit(band === 'ok' || band === 'deja', '1 : VRM le dit (« Extension connectée »)', String(band));
      await capture(vrm, '1-liaison');
      await pop.close().catch(() => {});
    }

    // ══ 2. LE DRESSING ═══════════════════════════════════════════════════════
    // Il se connecte sur vinted.fr (le site pose le cookie de session), puis
    // ouvre son dressing : la page charge, l'extension lit et range.
    const vt = await ctx.newPage();
    if (veut(2) || veut(3) || veut(4) || veut(5)) {
      console.log('\n── 2. visite du dressing ⇒ Annonces');
      await vt.goto('https://www.vinted.fr/banc/connexion?uid=111');
      await vt.goto('https://www.vinted.fr/member/111-vendeur_a');
      const lignes = await attendreQue(async () => { const l = M.ligne('harvest_111_listings'); const v = M.ligne('harvest_111_orders_sold'); const a = M.lignes('vinted_accounts').find((x) => String(x.vinted_user_id) === '111'); return l && v && a ? { l, v, a } : null; }, 45000, 500);
      dit(!!lignes, '2 : la visite range le dressing, les ventes et le compte (lignes écrites par l’extension)', JSON.stringify(M.lignes().map((r) => r.id)));
      const items = lignes ? (lignes.l.data.payload.items || []).map((x) => String(x.id)).sort() : [];
      dit(items.join() === '91010001,91010002', '2 : le dressing rangé est celui du compte de l’onglet (ses 2 annonces)', items.join());
      dit(!!lignes && lignes.l.owner === U.id && lignes.a.owner === U.id, '2 : rangé sous CE vendeur VRM (owner du jeton de l’extension)');
      // Il regarde le dressing d'un autre membre : la page charge SES annonces.
      const n0 = vinted().length;
      await vt.goto('https://www.vinted.fr/member/222-autre_b');
      await attendreQue(async () => vinted((e) => e.p === '/api/v2/wardrobe/222/items').length > 0, 15000);
      await attendre(4000);
      const l2 = M.ligne('harvest_111_listings');
      const items2 = l2 ? (l2.data.payload.items || []).map((x) => String(x.id)).sort().join() : '';
      dit(items2 === '91010001,91010002', '2 : le dressing d’un AUTRE membre, vu en passant, n’entre pas dans SES annonces (§5)', items2);
      void n0;
      // L'app : Annonces.
      const pg = vrm || await ctx.newPage();
      await pg.goto('https://vrm.center/?tab=cat_annonces', { waitUntil: 'domcontentloaded' });
      const cartes = await attendreQue(async () => { const c = await pg.evaluate(() => [...document.querySelectorAll('[data-carte-annonce]')].map((x) => x.getAttribute('data-carte-annonce'))); return c.length ? c : null; }, 40000, 500) || [];
      await capture(pg, '2-annonces');
      dit(cartes.includes('91010001') && cartes.includes('91010002'), '2 : ses annonces sont visibles dans Annonces', JSON.stringify(cartes));
      dit(!cartes.some((c) => /^9202/.test(c)), '2 : aucune annonce de l’autre membre dans Annonces', JSON.stringify(cartes));

      // ══ 3. LA VENTE ════════════════════════════════════════════════════════
      console.log('\n── 3. une vente ⇒ Ventes');
      await pg.goto('https://vrm.center/?tab=cat_ventes', { waitUntil: 'domcontentloaded' });
      const ventes = await attendreQue(async () => { const v = await pg.evaluate(() => [...document.querySelectorAll('.vrm-sale-row[data-tx]')].map((x) => ({ tx: x.getAttribute('data-tx'), compte: (x.querySelector('[data-vente-compte]') || x).getAttribute('data-vente-compte') || '', texte: x.innerText.slice(0, 120) }))); return v.length ? v : null; }, 40000, 500) || [];
      await capture(pg, '3-ventes');
      const v1 = ventes.find((v) => v.tx === '7001001');
      dit(!!v1, '3 : la vente Vinted est dans Ventes (par son n° de transaction)', JSON.stringify(ventes));
      dit(!!v1 && /Dunk/.test(v1.texte), '3 : avec son titre', v1 && v1.texte);
      dit(!ventes.some((v) => v.tx === '8002001'), '3 : la vente d’un autre compte n’y est pas (jamais lue sous celui-ci)', JSON.stringify(ventes));
    }

    // ══ 4. UNE COMMANDE DE L'APP, EXÉCUTÉE PAR L'EXTENSION ══════════════════
    const pg = vrm || await ctx.newPage();
    if (veut(4)) {
      console.log('\n── 4. « Baisser le prix » depuis l’app ⇒ l’extension, au nom du compte de l’onglet');
      // Il a modifié une fois l'annonce sur vinted.fr (enregistrée sans rien
      // changer) : la page envoie SA fiche, l'extension apprend le format.
      await vt.goto('https://www.vinted.fr/items/91010001-annonce/edit');
      await vt.evaluate(async () => {
        const corps = JSON.stringify({ item: { id: 91010001, title: 'Nike Cortez blanche', description: 'Très bon état', price: { amount: '60.0', currency_code: 'EUR' }, catalog_id: 1234, assigned_photos: [{ id: 910100010, orientation: 0 }] } });
        await fetch('/api/v2/item_upload/items/91010001', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: corps });
      });
      const appris = await attendreQue(async () => { const r = M.ligne('vrm_vinted_modele'); return r && r.data && r.data['91010001'] ? r : null; }, 20000);
      dit(!!appris, '4 : son propre enregistrement sur vinted.fr apprend le format de l’annonce (vrm_vinted_modele)');
      const coffre = M.ligne('coffre_111_91010001');
      dit(!!coffre, '4 : l’annonce est sauvegardée dans le coffre (filet avant tout geste)');
      await vt.goto('https://www.vinted.fr/member/111-vendeur_a');      // l'onglet reste sur vinted.fr
      await attendre(1500);
      const d0 = vinted().length;
      const r = await baisserDepuisApp(pg, 91010001);
      await capture(pg, '4-baisse');
      const apres = vinted().slice(d0);
      const puts = apres.filter((e) => e.m === 'PUT' && /item_upload\/items\/91010001/.test(e.p));
      dit(!!r.avant && r.avant.lancer && !r.avant.lancer.off, '4 : l’app propose la baisse (extension à jour, compte de l’onglet)', JSON.stringify(r.avant && { lancer: r.avant.lancer, ext: r.avant.ext, L: r.avant.L }));
      dit(puts.length === 1, '4 : UNE modification de prix part chez Vinted', `${puts.length} PUT · ${apres.map((e) => e.m + ' ' + e.p).join(' | ')}`);
      const p0 = puts[0] || {};
      let prixEnvoye = null; try { prixEnvoye = Number(JSON.parse(p0.corps).item.price.amount); } catch (_) {}
      dit(p0.uid === '111' && !p0.auth, '4 : au nom du compte de l’onglet (cookie 111), depuis la page — aucun Authorization', JSON.stringify({ uid: p0.uid, auth: p0.auth }));
      dit(prixEnvoye != null && prixEnvoye < 60 && M.st.prix[91010001] === prixEnvoye, '4 : le prix voulu est arrivé chez Vinted', `${prixEnvoye} · Vinted ${M.st.prix[91010001]}`);
      const getsApres = apres.filter((e) => e.m === 'GET' && /item_upload\/items\/91010001/.test(e.p) && e.t > (p0.t || 0));
      dit(getsApres.length >= 1, '4 : puis le prix est RELU chez Vinted');
      const L = r.apres && r.apres.L && r.apres.L['91010001'];
      dit(!!L && L.etat === 'fait' && Number(L.vu) === prixEnvoye, '4 : l’app affiche le prix RELU', JSON.stringify(L));
      dit(M.st.maxEnVol <= 1, '4 : jamais deux requêtes Vinted en vol en même temps', String(M.st.maxEnVol));
      await fermerFeuille(pg);

      // Plafond plein : 45 actions déjà faites dans l'heure sur ce compte (50 − réserve 5).
      const n45 = await dansSW(ctx, ID, async () => { const t = Date.now() - 60000; const cur = (await chrome.storage.local.get('vrmActions')).vrmActions || {}; cur['111'] = Array.from({ length: 45 }, (_, i) => t + i); await chrome.storage.local.set({ vrmActions: cur }); return cur['111'].length; });
      M.st.prix[91010001] = 60;   // pour que l'aperçu reparte de 60 € (lu dans le dressing rangé)
      const d1 = vinted().length;
      const r2 = await baisserDepuisApp(pg, 91010001);
      const rien = vinted().slice(d1).filter((e) => /item_upload/.test(e.p));
      dit(n45 === 45 && rien.filter((e) => e.m === 'PUT').length === 0, '4 : plafond plein ⇒ RIEN ne part chez Vinted', `${rien.length} requête(s) · ${rien.map((e) => e.m + ' ' + e.p).join(' | ')}`);
      const L2 = r2.apres && r2.apres.L && r2.apres.L['91010001'];
      dit(!!r2.apres && (/plafond/.test(String(r2.apres.bilan || '') + (L2 ? L2.etat + L2.texte : '')) || /actions/.test(r2.apres.texte)), '4 : l’app dit le plafond', JSON.stringify({ bilan: r2.apres && r2.apres.bilan, L2 }));
      await fermerFeuille(pg);
      await dansSW(ctx, ID, async () => { await chrome.storage.local.set({ vrmActions: {} }); });

      // 429 : Vinted demande de ralentir sur la modification ⇒ pause posée, la suivante n'envoie rien.
      M.st.forcer.push({ m: 'PUT', re: /item_upload\/items\//, status: 429, fois: 1 });
      const d2 = vinted().length;
      await baisserDepuisApp(pg, 91010001);
      await fermerFeuille(pg);
      const pause = await dansSW(ctx, ID, async () => (await chrome.storage.local.get('vrmPauseVinted')).vrmPauseVinted || null);
      dit(!!pause && Number(pause.jusqua) > Date.now(), '4 : un 429 de Vinted pose la pause', JSON.stringify(pause));
      const d3 = vinted().length;
      await baisserDepuisApp(pg, 91010001);
      await fermerFeuille(pg);
      const pendant = vinted().slice(d3);
      dit(pendant.length === 0, '4 : pendant la pause, la commande suivante n’envoie RIEN chez Vinted', `${pendant.length} · ${pendant.map((e) => e.m + ' ' + e.p).join(' | ')}`);
      void d2;
      await dansSW(ctx, ID, async () => { await chrome.storage.local.remove('vrmPauseVinted'); });
    }

    // ══ 5. UN AUTRE COMPTE DANS L'ONGLET ═════════════════════════════════════
    if (veut(5)) {
      console.log('\n── 5. il bascule l’onglet sur autre_b ⇒ rien n’est fait pour vendeur_a');
      await vt.goto('https://www.vinted.fr/banc/connexion?uid=222');
      await vt.goto('https://www.vinted.fr/member/222-autre_b');
      const actif = await attendreQue(async () => { const r = await dansSW(ctx, ID, async () => compteConnecte('www.vinted.fr')); return r === '222' ? r : null; }, 15000);
      dit(actif === '222', '5 : l’extension voit autre_b dans l’onglet');
      // La vente d'autre_b, lue à la visite, est rangée sous autre_b.
      const v222 = await attendreQue(async () => M.ligne('harvest_222_orders_sold'), 40000, 500);
      const v111 = M.ligne('harvest_111_orders_sold');
      const tx111 = v111 ? (v111.data.payload.my_orders || []).map((o) => String(o.transaction_id)) : [];
      dit(!!v222 && !tx111.includes('8002001'), '5 : la vente d’autre_b est rangée sous autre_b, jamais sous vendeur_a', JSON.stringify({ v222: !!v222, tx111 }));
      // L'app : la baisse de vendeur_a n'est pas proposée (« Ouvre vendeur_a sur Vinted »).
      await attendre(2000);
      const d4 = vinted().length;
      const r = await baisserDepuisApp(pg, 91010001);
      await capture(pg, '5-autre-compte');
      const L = r.avant && r.avant.L && r.avant.L['91010001'];
      dit(!!r.absente || (L && L.bloque != null) || (r.avant && r.avant.lancer && r.avant.lancer.off) || !r.lance, '5 : l’app ne lance pas la baisse pour vendeur_a (l’onglet est sur autre_b)', JSON.stringify({ absente: r.absente, L, lancer: r.avant && r.avant.lancer }));
      await fermerFeuille(pg);
      // Et même une commande postée DIRECTEMENT au pont (un écran périmé, un autre onglet) :
      const rep = await pg.evaluate(() => new Promise((ok) => {
        const reqId = 'banc-' + Date.now();
        const h = (e) => { const d = e.data; if (e.source === window && d && d.__vmr === 'cmd:result' && d.reqId === reqId) { window.removeEventListener('message', h); ok(d.resp); } };
        window.addEventListener('message', h);
        window.postMessage({ __vmr: 'cmd', reqId, cmd: 'baisserPrixVinted', uid: '111', id: '91010001', prix: 50, prixAvant: 60, confirme: true }, '*');
        setTimeout(() => ok({ muet: true }), 30000);
      }));
      await attendre(1500);
      const envoye = vinted().slice(d4).filter((e) => e.m !== 'GET' || /item_upload/.test(e.p));
      dit(envoye.length === 0, '5 : une commande pour vendeur_a n’envoie RIEN chez Vinted tant que l’onglet est sur autre_b', `${envoye.length} · ${envoye.map((e) => e.m + ' ' + e.p + ' uid=' + e.uid).join(' | ')}`);
      dit(rep && rep.accepte === false && /autre|absent/.test(String(rep.code)), '5 : l’extension refuse et dit pourquoi (compte de l’onglet)', JSON.stringify(rep).slice(0, 240));
    }

    // ══ 6. UNE EXTENSION EN RETARD ═══════════════════════════════════════════
    if (veut(6)) {
      console.log('\n── 6. extension en retard (5.335, avant « baisseprix ») ⇒ l’app ne promet rien');
      const EXTV = preparerExtension('ext-5335', { version: '5.335.0' });
      const IDV = extId(EXTV);
      const ctx6 = await lancer(path.join(TMP, 'profil-6'), EXTV); ctxs.push(ctx6);
      const s6 = M.ouvrir(M.USERS.get(U.email));
      await poserSessionApp(ctx6, { access_token: s6.access_token, refresh_token: s6.refresh_token, expires_at: Date.now() + 3600e3, user: s6.user });
      const w6 = await sw(ctx6, IDV);
      const co = w6 ? await w6.evaluate(async (a) => { const r = await authLogin(a.e, a.p); return r && r.ok; }, { e: U.email, p: U.mdp }).catch(() => false) : false;
      dit(co === true, '6 : l’extension 5.335 est installée et connectée à ce compte VRM');
      const v6 = await ctx6.newPage();
      await v6.goto('https://www.vinted.fr/banc/connexion?uid=111');
      await v6.goto('https://www.vinted.fr/member/111-vendeur_a');
      await attendre(3000);
      const p6 = await ctx6.newPage();
      const etat = await (async () => { await p6.goto('https://vrm.center/?tab=cat_annonces', { waitUntil: 'domcontentloaded' }); return attendreQue(() => p6.evaluate(() => new Promise((ok) => { const reqId = 'v' + Math.random(); const h = (e) => { const d = e.data; if (e.source === window && d && d.__vmr === 'etat:result' && d.reqId === reqId) { window.removeEventListener('message', h); ok(d.resp); } }; window.addEventListener('message', h); window.postMessage({ __vmr: 'etat', reqId }, '*'); setTimeout(() => ok(null), 4000); })), 20000); })();
      dit(!!etat && etat.version === '5.335.0', '6 : le pont de VRM parle à la 5.335', JSON.stringify(etat && { version: etat.version, code: etat.code }));
      const d5 = vinted().length;
      const r = await baisserDepuisApp(p6, 91010001);
      await capture(p6, '6-retard');
      const envoye = vinted().slice(d5).filter((e) => /item_upload/.test(e.p));
      dit(!r.absente && !!r.avant, '6 : la feuille « Baisser le prix » s’ouvre (la paire dort)', JSON.stringify(r).slice(0, 200));
      dit(!!r.avant && (!r.avant.lancer || r.avant.lancer.off) && !r.lance, '6 : « Baisser » est fermé : l’app ne promet rien à une extension sans la baisse', JSON.stringify(r.avant && { lancer: r.avant.lancer, ext: r.avant.ext }));
      dit(!!r.avant && /mettre à jour|à jour|version|extension/i.test(r.avant.ext || ''), '6 : et elle dit quoi faire (mettre l’extension à jour)', r.avant && r.avant.ext);
      dit(envoye.length === 0, '6 : rien n’est parti chez Vinted', String(envoye.length));
    }
    dit(erreursApp.length === 0, 'aucune erreur de page dans l’app', erreursApp.slice(0, 3).join(' | '));
    const fuite = M.st.vinted.filter((e) => e.uid && !['111', '222'].includes(e.uid));
    dit(fuite.length === 0, 'aucune requête Vinted sous un compte inconnu');
  } catch (e) {
    dit(false, 'le banc a tourné jusqu’au bout', String(e && e.stack || e).slice(0, 300));
  } finally {
    for (const c of ctxs) await c.close().catch(() => {});
    await M.fermer();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  }
  console.log(`\n${ko ? '❌' : '✅'} e2e-extension : ${ok} vert(s), ${ko} rouge(s)${MUT ? ` — mutation « ${MUT} »` : ''}`);
  process.exit(ko ? 1 : 0);
})();
