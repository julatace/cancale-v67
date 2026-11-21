require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA CONNEXION DE L'EXTENSION, DE BOUT EN BOUT » (21 nov., ext. 5.415.0)
//
//  Julien : « même l'extension, au moment de la connexion, ça doit s'améliorer,
//  ce n'est vraiment pas bien ». Le parcours RÉEL, dans un vrai Chromium, la
//  VRAIE extension chargée (`--load-extension`, service worker MV3, pont,
//  `externally_connectable`), le VRAI build de l'app (`dist/`), servis en LOCAL
//  sous leurs vrais noms par `_e2e-monde.cjs` (DNS redirigé, rien ne sort, jamais
//  la production). Données INVENTÉES (dépôt public).
//
//  La fenêtre de l'extension est ouverte comme chez lui : `popup.html?mode=onglet`
//  (Chrome : clic droit sur l'icône → « Connexion à VRM ») et `popup.html` (Orion :
//  l'icône ouvre la fenêtre). Chaque cas MESURE (nombres rendus à la fin) et JUGE
//  le contrat de la 5.415 :
//    1. installation neuve : ce que montre la fenêtre (UNE phrase d'état, UN bouton
//       plein « Se connecter », aucun champ) ;
//    2. « Se connecter » depuis vinted.fr, VRM PAS connecté : VRM s'ouvre, une
//       connexion dans VRM, l'extension est reliée, on REVIENT sur vinted.fr, la
//       fenêtre dit « Connecté à VRM · compte · Vinted : login » ;
//    3. « Se connecter », VRM déjà connecté : relié sans rien taper ;
//    4. session MORTE : la fenêtre le dit, « Se reconnecter » répare en un geste ;
//    5. renouvellement en PANNE (503) : jamais « un instant » pour toujours — un état
//       final, l'heure du prochain essai, « Réessayer » ;
//    6. « Se déconnecter » dans l'extension, VRM ouvert : ça TIENT (l'app ne la
//       reconnecte pas toute seule) ; puis « Se connecter » la relie ;
//    7. deux comptes VRM : la fenêtre nomme le compte en service ;
//    8. Orion simulé (pas de canal adressé : la session passe par le pont) ;
//    9. mise à jour de version (dossier remplacé + rechargement) : toujours connecté ;
//   10. worker MV3 tué au milieu de la liaison : la liaison aboutit quand même ;
//       une attente sans suite ne reste pas « en cours » (bornée, dite).
//
//  Usage : npm run build && node scripts/bancs/connexion-extension.cjs [--seul 1,2]
//    `BANC_DIST` / `BANC_EXT` : un autre build / une autre extension (preuve §6.1 sur
//    origin/main) ; `BANC_CAPTURE=<dossier>` : captures ; `BANC_MESURES=<fichier>` : nombres.
//  Port : 4797 (`BANC_PORT`).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { monde, certificat, HOTES } = require('./_e2e-monde.cjs');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), path.join(__dirname, '..', '..')]) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const RACINE = path.join(__dirname, '..', '..');
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4797;
const DIST = path.resolve(process.env.BANC_DIST || path.join(RACINE, 'dist'));
const EXT0 = path.resolve(process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension'));
const CAPT = process.env.BANC_CAPTURE || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SEULS = arg('--seul') ? arg('--seul').split(',') : null;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-connexion-ext-'));

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + String(det).slice(0, 300) : ''}`); } };
const MESURES = {};
const mesure = (cle, v) => { MESURES[cle] = v; console.log(`     · ${cle} = ${typeof v === 'object' ? JSON.stringify(v) : v}`); };

const U = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'vendeur@exemple.test', mdp: 'bon-mot-de-passe' };
const U2 = { id: 'bbbbbbbb-0000-4000-8000-000000000002', email: 'second@exemple.test', mdp: 'autre-mot-de-passe' };
const COMPTES = () => ({ 111: { login: 'vendeur_a', annonces: [{ id: 91010001, titre: 'Nike Cortez blanche', prix: 60 }], ventes: [] } });

const extId = (dir) => crypto.createHash('sha256').update(path.resolve(dir)).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const regles = () => HOTES.map((h) => `MAP ${h} 127.0.0.1:${PORT}`).concat(['MAP * ~NOTFOUND']).join(', ');
function lancer(udd, ext) {
  const args = ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader',
    '--enable-unsafe-extension-debugging', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`];
  return pw.chromium.launchPersistentContext(udd, { executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1280, height: 860 }, args });
}
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
const dansSW = async (ctx, id, fn, a) => { const s = await sw(ctx, id, 10000); if (!s) return { erreur: 'pas de service worker' }; return s.evaluate(fn, a).catch((e) => ({ erreur: String(e.message || e).slice(0, 200) })); };
const attendreQue = async (fn, ms, pas = 250) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn().catch(() => null); if (v) return { v, ms: Date.now() - t0 }; await attendre(pas); } return { v: null, ms: Date.now() - t0 }; };
const capture = async (pg, nom) => { if (!CAPT || !pg || pg.isClosed()) return; fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png'), fullPage: true }).catch(() => {}); };
const sessionExt = (ctx, id) => dansSW(ctx, id, async () => { const s = (await chrome.storage.local.get('vrmSession')).vrmSession; return s ? { user_id: s.user_id || '', email: s.email || '', mort: !!s.mort, refresh: String(s.refresh_token || '').slice(0, 24) } : null; });
const connecteeA = (ctx, id, uid) => attendreQue(async () => { const s = await sessionExt(ctx, id); return s && !s.mort && s.user_id === uid ? s : null; }, 25000);

// La session de l'app (posée une fois, base cloisonnée) — comme e2e-extension.cjs.
async function poserSessionApp(ctx, s, uid) {
  await ctx.addInitScript(({ s, uid }) => {
    if (location.origin !== 'https://vrm.center') return;
    try {
      localStorage.setItem('schema_cloisonne', '1');
      if (uid) localStorage.setItem('vrm_ext_separee_' + uid, '1');
      if (s && !localStorage.getItem('__banc_pose')) { localStorage.setItem('__banc_pose', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); }
    } catch (_) {}
  }, { s, uid });
}
const sessionAppDe = (M, u) => { const s = M.ouvrir(M.USERS.get(u.email)); return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user: s.user }; };

// ── LA FENÊTRE : ce qu'elle montre, lu sur le DOM (jamais un libellé exact) ──
const lirePopup = (pg) => pg.evaluate(() => {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden]') && !e.closest('details:not([open]) > :not(summary)'); };
  const boutons = [...document.querySelectorAll('button, a[role=button]')].filter(vis);
  const champs = [...document.querySelectorAll('input:not([type=hidden]), textarea')].filter(vis);
  const pleins = boutons.filter((b) => b.matches('.plein') || (b.tagName === 'BUTTON' && !b.matches('.sec, .lien, .fourn')));
  const phrase = document.querySelector('[data-etat-phrase]');
  return {
    etat: document.body.getAttribute('data-connexion'),
    phrase: phrase && vis(phrase) ? phrase.textContent.replace(/\s+/g, ' ').trim() : null,
    boutons: boutons.length, champs: champs.length, pleins: pleins.length,
    pleinTexte: pleins[0] ? pleins[0].textContent.replace(/\s+/g, ' ').trim() : '',
    vrm: (document.querySelector('[data-compte-vrm]') || {}).textContent || '',
    vinted: (document.querySelector('[data-compte-vinted]') || {}).textContent || '',
    texte: document.body.innerText.replace(/\s+/g, ' ').slice(0, 600),
    url: location.href,
  };
}).catch((e) => ({ ferme: true, erreur: String(e.message || e).slice(0, 80) }));
// Comme chez lui : le menu de l'icône passe l'onglet d'où vient le clic (`depuis`) ; la
// feuille d'Orion est posée SUR l'onglet du site. Le banc nomme l'onglet vinted.fr ouvert.
async function ouvrirPopup(ctx, id, mode) {
  const vt = await dansSW(ctx, id, async () => { const t = await chrome.tabs.query({ url: 'https://www.vinted.fr/*' }); return t[0] ? t[0].id : null; });
  const depuis = Number.isInteger(vt) ? `depuis=${vt}` : '';
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: 380, height: 640 });
  await pg.goto(`chrome-extension://${id}/popup.html${mode === 'orion' ? (depuis ? '?' + depuis : '') : '?mode=onglet' + (depuis ? '&' + depuis : '')}`).catch(() => {});
  await attendre(1800);
  return pg;
}
// Le bouton « Se connecter » : celui de la 5.415 (`data-se-connecter`), sinon le
// chemin « par le site VRM » d'avant (`#lierBtn`).
async function toucherSeConnecter(pg) {
  for (const sel of ['[data-se-connecter]', '#lierBtn']) {
    const b = pg.locator(sel).first();
    if (await b.count().catch(() => 0)) { if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); return sel; } }
  }
  return null;
}
async function toucherSeDeconnecter(pg) {
  for (const sel of ['[data-se-deconnecter]', '#outBtn']) { const b = pg.locator(sel).first(); if (await b.count().catch(() => 0) && await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); return sel; } }
  return null;
}
const ongletActif = async (ctx, id) => dansSW(ctx, id, async () => { const t = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); return (t[0] && t[0].url) || ''; });
const pageVRM = async (ctx) => (await attendreQue(async () => ctx.pages().find((x) => /^https:\/\/vrm\.center\//.test(x.url()) && !x.isClosed()), 15000, 200)).v;
async function seConnecterDansVRM(vrm, u) {
  await vrm.waitForSelector('input[type="password"]', { timeout: 30000 }).catch(() => {});
  await vrm.fill('input[type="email"]', u.email).catch(() => {});
  await vrm.fill('input[type="password"]', u.mdp).catch(() => {});
  await vrm.press('input[type="password"]', 'Enter').catch(() => {});
}
async function tuerSW(ctx, id) {
  const pg = await ctx.newPage();
  await pg.goto(`chrome-extension://${id}/icon-16.png`).catch(() => {});
  const cdp = await ctx.newCDPSession(pg);
  const vers = [];
  cdp.on('ServiceWorker.workerVersionUpdated', (e) => { for (const v of e.versions) vers.push(v); });
  await cdp.send('ServiceWorker.enable');
  await attendre(600);
  const v = vers.filter((x) => x.scriptURL.includes(id) && x.runningStatus === 'running').pop();
  if (v) await cdp.send('ServiceWorker.stopWorker', { versionId: v.versionId }).catch(() => {});
  const arrete = await attendreQue(async () => vers.some((x) => v && x.versionId === v.versionId && x.runningStatus === 'stopped'), 5000, 100);
  await pg.close().catch(() => {});
  return !!(v && arrete.v);
}
const preparerExt = (nom, { sansCanal, version } = {}) => {
  const d = path.join(TMP, nom);
  fs.cpSync(EXT0, d, { recursive: true });
  const mf = path.join(d, 'manifest.json');
  const j = JSON.parse(fs.readFileSync(mf, 'utf8'));
  if (sansCanal) { delete j.externally_connectable; j.permissions = j.permissions.filter((p) => p !== 'contextMenus'); }
  if (version) {
    j.version = version;
    const b = path.join(d, 'background.js');
    fs.writeFileSync(b, fs.readFileSync(b, 'utf8').replace(/const CODE_VERSION = '[\d.]+';/, `const CODE_VERSION = '${version}';`));
  }
  fs.writeFileSync(mf, JSON.stringify(j, null, 2));
  return d;
};

const veut = (n) => !SEULS || SEULS.includes(String(n));
async function cas(n, titre, fn) {
  if (!veut(n)) return;
  console.log(`\n── ${n}. ${titre}`);
  const journal = [];
  const M = monde({ tls: TLS, port: PORT, dist: DIST, comptes: COMPTES(), journal });
  M.USERS.set(U.email, { id: U.id, email: U.email, mdp: U.mdp });
  M.USERS.set(U2.email, { id: U2.id, email: U2.email, mdp: U2.mdp });
  try { await M.ecouter(); } catch (e) { dit(false, `${n} : le port ${PORT} est libre`, e.code); return; }
  const ctxs = [];
  const ouvrir = async (ext, nom) => { const c = await lancer(path.join(TMP, 'profil-' + n + '-' + (nom || '') + Date.now()), ext); ctxs.push(c); return c; };
  try { await fn(M, ouvrir); }
  catch (e) { dit(false, `${n} : le cas a tourné jusqu'au bout`, String(e && e.stack || e).slice(0, 300)); }
  finally { for (const c of ctxs) await c.close().catch(() => {}); await M.fermer(); }
}

let TLS = null;
(async () => {
  if (!pw) { console.log('❌ Playwright introuvable'); process.exit(1); }
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log(`❌ pas de build dans ${DIST} — lance npm run build`); process.exit(1); }
  TLS = certificat(TMP);
  const EXT = preparerExt('ext');
  const ID = extId(EXT);
  const VERSION = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  console.log(`extension ${VERSION} (${ID.slice(0, 8)}…) · app ${DIST}`);

  // ══ 1. INSTALLATION NEUVE ════════════════════════════════════════════════
  await cas(1, 'installation neuve : ce que montre la fenêtre', async (M, ouvrir) => {
    const ctx = await ouvrir(EXT);
    const w = await sw(ctx, ID);
    dit(!!w, '1 : le service worker de la vraie extension démarre');
    await attendre(1500);
    mesure('1_onglets_ouverts_a_l_installation', ctx.pages().filter((p) => !/^about:blank/.test(p.url())).map((p) => p.url().slice(0, 60)).length);
    for (const mode of ['onglet', 'orion']) {
      const pop = await ouvrirPopup(ctx, ID, mode);
      const e = await lirePopup(pop);
      await capture(pop, `1-installation-${mode}`);
      mesure(`1_fenetre_${mode}`, { etat: e.etat, boutons: e.boutons, champs: e.champs, pleins: e.pleins, plein: e.pleinTexte });
      dit(e.etat === 'deconnecte', `1 (${mode}) : l’état est DIT (« pas reliée »), porté par la fenêtre`, String(e.etat));
      dit(!!e.phrase, `1 (${mode}) : UNE phrase d’état visible`, e.texte);
      dit(e.pleins === 1 && /connecter/i.test(e.pleinTexte), `1 (${mode}) : UN seul bouton plein, « Se connecter »`, `${e.pleins} plein(s) : ${e.pleinTexte}`);
      dit(e.champs === 0, `1 (${mode}) : aucun champ à remplir d’emblée`, `${e.champs} champ(s)`);
      dit(e.boutons <= 3, `1 (${mode}) : au plus 3 choix visibles`, `${e.boutons} boutons`);
      await pop.close().catch(() => {});
    }
  });

  // ══ 2. SE CONNECTER DEPUIS VINTED, VRM PAS CONNECTÉ ════════════════════════
  await cas(2, '« Se connecter » depuis vinted.fr, VRM pas connecté', async (M, ouvrir) => {
    const ctx = await ouvrir(EXT);
    await poserSessionApp(ctx, null, U.id);
    if (!(await sw(ctx, ID))) { dit(false, '2 : le service worker démarre'); return; }
    const vt = await ctx.newPage();
    await vt.goto('https://www.vinted.fr/banc/connexion?uid=111').catch(() => {});
    await attendre(1500);
    const pop = await ouvrirPopup(ctx, ID, 'onglet');
    const t0 = Date.now();
    const sel = await toucherSeConnecter(pop);
    mesure('2_bouton_touche', sel);
    let gestes = 1;
    const vrm = await pageVRM(ctx);
    dit(!!vrm, '2 : un toucher OUVRE VRM', vrm ? vrm.url() : 'aucun onglet vrm.center');
    if (!vrm) return;
    await attendre(800);
    const attente = pop.isClosed() ? { ferme: true } : await lirePopup(pop);
    mesure('2_fenetre_pendant', { etat: attente.etat, ferme: !!attente.ferme });
    await capture(vrm, '2-vrm-connexion');
    await seConnecterDansVRM(vrm, U); gestes += 3;
    const r = await connecteeA(ctx, ID, U.id);
    mesure('2_ms_du_toucher_a_la_session', r.v ? Date.now() - t0 : null);
    mesure('2_gestes', gestes);
    dit(!!r.v, '2 : l’extension est reliée au compte VRM (une connexion dans VRM suffit)', JSON.stringify(r.v));
    const retour = await attendreQue(async () => /vinted\.fr/.test(await ongletActif(ctx, ID)) ? true : null, 6000);
    mesure('2_revenu_sur_vinted', !!retour.v);
    dit(!!retour.v, '2 : on REVIENT sur l’onglet vinted.fr d’où l’on est parti', await ongletActif(ctx, ID));
    await capture(vt, '2-retour-vinted');
    const p2 = pop.isClosed() ? await ouvrirPopup(ctx, ID, 'onglet') : pop;
    const e = await attendreQue(async () => { const x = await lirePopup(p2); return x && x.etat === 'connecte' && /vendeur_a/.test(x.vinted) ? x : null; }, 12000);
    const x = e.v || await lirePopup(p2);
    await capture(p2, '2-fenetre-connectee');
    mesure('2_fenetre_connectee', { etat: x.etat, vrm: x.vrm, vinted: x.vinted, pleins: x.pleins, ferme: !!x.ferme });
    dit(x.etat === 'connecte' && x.vrm.includes(U.email), '2 : la fenêtre dit « Connecté à VRM · compte … »', x.texte || JSON.stringify(x));
    dit(/vendeur_a/.test(x.vinted), '2 : … et « Vinted : vendeur_a » (le compte de l’onglet reconnu)', x.vinted || x.texte);
    dit(x.pleins === 1, '2 : connecté : un seul bouton plein', String(x.pleins));
  });

  // ══ 3. SE CONNECTER, VRM DÉJÀ CONNECTÉ ════════════════════════════════════
  await cas(3, '« Se connecter », VRM déjà connecté dans ce navigateur', async (M, ouvrir) => {
    const ctx = await ouvrir(EXT);
    await poserSessionApp(ctx, sessionAppDe(M, U), U.id);
    if (!(await sw(ctx, ID))) { dit(false, '3 : le service worker démarre'); return; }
    await attendre(1000);
    const pop = await ouvrirPopup(ctx, ID, 'onglet');
    const t0 = Date.now();
    await toucherSeConnecter(pop);
    const r = await connecteeA(ctx, ID, U.id);
    mesure('3_ms_du_toucher_a_la_session', r.v ? Date.now() - t0 : null);
    mesure('3_gestes', 1);
    dit(!!r.v && Date.now() - t0 < 15000, '3 : un toucher, rien à taper : reliée en quelques secondes', `${Date.now() - t0} ms`);
    dit((M.st.sessionsExtension || 0) === 1, '3 : une seule session fabriquée pour elle', String(M.st.sessionsExtension));
  });

  // ══ 4. SESSION MORTE ═════════════════════════════════════════════════════
  await cas(4, 'session expirée (morte) puis « Se reconnecter »', async (M, ouvrir) => {
    const ctx = await ouvrir(EXT);
    await poserSessionApp(ctx, sessionAppDe(M, U), U.id);
    if (!(await sw(ctx, ID))) { dit(false, '4 : le service worker démarre'); return; }
    await dansSW(ctx, ID, async (u) => { await saveSession({ access_token: 'x.e30.x', refresh_token: 'r-mort', expires_at: Date.now() - 1000, user_id: u.id, email: u.email, mort: true, mortAt: Date.now(), mortRaison: 'refresh_token_already_used' }); }, U);
    const pop = await ouvrirPopup(ctx, ID, 'onglet');
    const e = await lirePopup(pop);
    await capture(pop, '4-session-morte');
    mesure('4_fenetre', { etat: e.etat, pleins: e.pleins, plein: e.pleinTexte, champs: e.champs });
    dit(e.etat === 'expiree' && !!e.phrase, '4 : la fenêtre dit que la session a expiré (une phrase)', e.texte);
    dit(e.pleins === 1 && e.champs === 0, '4 : UN geste proposé, aucun champ', `${e.pleins} plein(s), ${e.champs} champ(s)`);
    const t0 = Date.now();
    await toucherSeConnecter(pop);
    const r = await connecteeA(ctx, ID, U.id);
    mesure('4_ms_reparee', r.v ? Date.now() - t0 : null);
    dit(!!r.v, '4 : « Se reconnecter » répare en un toucher (VRM connecté)', `${r.ms} ms`);
  });

  // ══ 5. RENOUVELLEMENT EN PANNE ════════════════════════════════════════════
  await cas(5, 'renouvellement en panne (GoTrue 503)', async (M, ouvrir) => {
    const ctx = await ouvrir(EXT);
    if (!(await sw(ctx, ID))) { dit(false, '5 : le service worker démarre'); return; }
    const s = M.ouvrir(M.USERS.get(U.email));
    await dansSW(ctx, ID, async (a) => { await saveSession({ access_token: a.at, refresh_token: a.rt, expires_at: Date.now() - 5000, user_id: a.id, email: a.email, depuis: Date.now() - 86400e3 }); }, { at: s.access_token, rt: s.refresh_token, id: U.id, email: U.email });
    M.st.panneRenouv = 1000;
    const pop = await ouvrirPopup(ctx, ID, 'onglet');
    const etats = [];
    const t0 = Date.now();
    while (Date.now() - t0 < 16000) { const e = await lirePopup(pop); etats.push({ t: Date.now() - t0, etat: e.etat || (e.ferme ? 'fermee' : (/renouvelle|un instant/i.test(e.texte) ? 'en-cours(texte)' : 'autre')) }); await attendre(1000); }
    const e = await lirePopup(pop);
    await capture(pop, '5-renouvellement-panne');
    const enCours = etats.filter((x) => /renouvellement|en-cours/.test(String(x.etat)));
    mesure('5_secondes_affichees_en_cours', Math.round((enCours.length ? enCours[enCours.length - 1].t : 0) / 1000));
    mesure('5_etat_final', { etat: e.etat, phrase: e.phrase, boutons: e.boutons });
    dit(!/un instant/i.test(e.texte) && e.etat === 'pause', '5 : au bout de 16 s, plus de « un instant » : un état final « VRM ne répond pas »', e.texte);
    dit(/\d{1,2}[:h]\d{2}/.test(e.phrase || ''), '5 : la phrase donne l’heure du prochain essai', e.phrase);
    dit(await pop.locator('[data-reessayer]').count() === 1, '5 : « Réessayer » est proposé');
    M.st.panneRenouv = 0;
    await pop.locator('[data-reessayer]').click().catch(() => {});
    const ok5 = await attendreQue(async () => { const x = await lirePopup(pop); return x.etat === 'connecte' ? x : null; }, 10000);
    mesure('5_ms_apres_reessayer', ok5.v ? ok5.ms : null);
    dit(!!ok5.v, '5 : réseau revenu + « Réessayer » ⇒ connecté, sans rien retaper', `${ok5.ms} ms`);
  });

  // ══ 6. SE DÉCONNECTER, VRM OUVERT ═════════════════════════════════════════
  await cas(6, '« Se déconnecter » dans l’extension, VRM ouvert et connecté', async (M, ouvrir) => {
    const ctx = await ouvrir(EXT);
    await poserSessionApp(ctx, sessionAppDe(M, U), U.id);
    if (!(await sw(ctx, ID))) { dit(false, '6 : le service worker démarre'); return; }
    const pop0 = await ouvrirPopup(ctx, ID, 'onglet');
    await toucherSeConnecter(pop0);
    const r = await connecteeA(ctx, ID, U.id);
    dit(!!r.v, '6 : (départ) reliée');
    const vrm = await pageVRM(ctx);
    const pop = await ouvrirPopup(ctx, ID, 'onglet');
    const avant = await lirePopup(pop);
    let sel = await toucherSeDeconnecter(pop);
    mesure('6_bouton_deconnecter', sel || 'aucun (la fenêtre du menu renvoie sur VRM)');
    // Sans bouton visible (la fenêtre d'avant renvoie sur VRM une fois connectée), le
    // MÊME message que son « Se déconnecter » (Orion), depuis une page de l'extension.
    if (!sel) { const pe = await ctx.newPage(); await pe.goto(`chrome-extension://${ID}/icon-16.png`).catch(() => {}); await pe.evaluate(() => new Promise((r) => chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authLogout' }, () => r()))).catch(() => {}); await pe.close().catch(() => {}); }
    await attendre(1500);
    const juste = await sessionExt(ctx, ID);
    dit(juste === null, '6 : « Se déconnecter » efface la session de l’extension', JSON.stringify(juste));
    if (vrm) await vrm.bringToFront().catch(() => {});
    // Le battement de l'app (20 s) a lieu : ça doit TENIR.
    await attendre(26000);
    const apres = await sessionExt(ctx, ID);
    mesure('6_reconnectee_seule_en_26_s', !!(apres && !apres.mort));
    dit(!apres, '6 : 26 s plus tard, VRM ouvert ne l’a PAS reconnectée en douce', JSON.stringify(apres));
    const p2 = await ouvrirPopup(ctx, ID, 'onglet');
    const e = await lirePopup(p2);
    await capture(p2, '6-deconnectee');
    dit(e.etat === 'deconnecte' && e.pleins === 1, '6 : la fenêtre dit « pas reliée » et propose « Se connecter »', e.texte);
    await toucherSeConnecter(p2);
    const r2 = await connecteeA(ctx, ID, U.id);
    mesure('6_ms_reconnexion_volontaire', r2.v ? r2.ms : null);
    dit(!!r2.v, '6 : puis « Se connecter » la relie (son geste)', `${r2.ms} ms`);
    void avant;
  });

  // ══ 7. DEUX COMPTES VRM ═══════════════════════════════════════════════════
  await cas(7, 'deux comptes VRM (extension sur A, VRM ouvert sur B)', async (M, ouvrir) => {
    const ctx = await ouvrir(EXT);
    await poserSessionApp(ctx, sessionAppDe(M, U2), U2.id);
    if (!(await sw(ctx, ID))) { dit(false, '7 : le service worker démarre'); return; }
    const s = M.ouvrir(M.USERS.get(U.email));
    await dansSW(ctx, ID, async (a) => { await saveSession({ access_token: a.at, refresh_token: a.rt, expires_at: Date.now() + 3600e3, user_id: a.id, email: a.email, depuis: Date.now() }); }, { at: s.access_token, rt: s.refresh_token, id: U.id, email: U.email });
    const pop = await ouvrirPopup(ctx, ID, 'onglet');
    const a = await lirePopup(pop);
    dit(a.etat === 'connecte' && a.vrm.includes(U.email), '7 : la fenêtre nomme le compte A en service', a.texte);
    // Connectée, la fenêtre propose « Ouvrir VRM » (5.415) ; la fenêtre d'avant, « Se connecter avec VRM ».
    const ouvrirB = pop.locator('[data-ouvrir-vrm], #vrmBtn').first();
    const geste7 = (await ouvrirB.count().catch(() => 0)) && await ouvrirB.isVisible().catch(() => false) ? (await ouvrirB.click().catch(() => {}), 'ouvrir-vrm') : await toucherSeConnecter(pop).catch(() => null);
    mesure('7_geste', geste7);
    const vrm = await pageVRM(ctx);
    if (vrm) await vrm.bringToFront().catch(() => {});
    const r = await connecteeA(ctx, ID, U2.id);
    mesure('7_bascule_vers_B_ms', r.v ? r.ms : null);
    const p2 = await ouvrirPopup(ctx, ID, 'onglet');
    const b = await attendreQue(async () => { const x = await lirePopup(p2); return x.etat === 'connecte' && x.vrm.includes(U2.email) ? x : null; }, 8000);
    await capture(p2, '7-deux-comptes');
    mesure('7_fenetre', b.v ? { vrm: b.v.vrm } : (await lirePopup(p2)).texte);
    dit(!!b.v, '7 : après la bascule, la fenêtre nomme le compte B (celui de VRM ouvert)', JSON.stringify(b.v || {}));
  });

  // ══ 8. ORION SIMULÉ ═══════════════════════════════════════════════════════
  await cas(8, 'Orion simulé : pas de canal adressé ni de menu (la session passe par le pont)', async (M, ouvrir) => {
    const EXTO = preparerExt('ext-orion', { sansCanal: true });
    const IDO = extId(EXTO);
    const ctx = await ouvrir(EXTO, 'orion');
    await poserSessionApp(ctx, sessionAppDe(M, U), U.id);
    if (!(await sw(ctx, IDO))) { dit(false, '8 : le service worker démarre'); return; }
    const vt = await ctx.newPage();
    await vt.goto('https://www.vinted.fr/banc/connexion?uid=111').catch(() => {});
    await attendre(1200);
    const pop = await ouvrirPopup(ctx, IDO, 'orion');
    const e0 = await lirePopup(pop);
    await capture(pop, '8-orion-fenetre');
    dit(e0.pleins === 1 && e0.champs === 0, '8 : la fenêtre d’Orion : un bouton plein, aucun champ', `${e0.pleins} plein(s), ${e0.champs} champ(s)`);
    const t0 = Date.now();
    await toucherSeConnecter(pop);
    const r = await connecteeA(ctx, IDO, U.id);
    mesure('8_ms_orion', r.v ? Date.now() - t0 : null);
    dit(!!r.v, '8 : reliée par le pont (sans `externally_connectable`)', `${r.ms} ms`);
    const retour = await attendreQue(async () => /vinted\.fr/.test(await ongletActif(ctx, IDO)) ? true : null, 6000);
    mesure('8_revenu_sur_vinted', !!retour.v);
    dit(!!retour.v, '8 : on revient sur vinted.fr (Orion : la connexion ne fait plus « changer de page »)');
  });

  // ══ 9. MISE À JOUR DE VERSION ═════════════════════════════════════════════
  await cas(9, 'mise à jour de version (dossier remplacé, ⟳)', async (M, ouvrir) => {
    const EXTV = preparerExt('ext-maj');
    const IDV = extId(EXTV);
    const ctx = await ouvrir(EXTV, 'maj');
    await poserSessionApp(ctx, sessionAppDe(M, U), U.id);
    if (!(await sw(ctx, IDV))) { dit(false, '9 : le service worker démarre'); return; }
    const pop = await ouvrirPopup(ctx, IDV, 'onglet');
    await toucherSeConnecter(pop);
    const r = await connecteeA(ctx, IDV, U.id);
    dit(!!r.v, '9 : (départ) reliée');
    // Le nouveau dossier par-dessus (version +1), puis ⟳.
    const mf = path.join(EXTV, 'manifest.json');
    const j = JSON.parse(fs.readFileSync(mf, 'utf8'));
    const nv = j.version.replace(/(\d+)$/, (x) => String(Number(x) + 1));
    j.version = nv; fs.writeFileSync(mf, JSON.stringify(j, null, 2));
    const b = path.join(EXTV, 'background.js');
    fs.writeFileSync(b, fs.readFileSync(b, 'utf8').replace(/const CODE_VERSION = '[\d.]+';/, `const CODE_VERSION = '${nv}';`));
    // « Charger l'extension non empaquetée » sur le MÊME dossier (le geste ⟳) : CDP `Extensions.loadUnpacked`.
    const cdpB = await ctx.browser().newBrowserCDPSession();
    const rech = await cdpB.send('Extensions.loadUnpacked', { path: EXTV }).catch((e) => ({ erreur: String(e.message || e) }));
    dit(rech && rech.id === IDV, '9 : le dossier remplacé est rechargé (même identifiant)', JSON.stringify(rech));
    await attendre(2000);
    const code = await attendreQue(async () => { const c = await dansSW(ctx, IDV, async () => CODE_VERSION); return c === nv ? c : null; }, 15000);
    dit(!!code.v, '9 : le nouveau code tourne', String(code.v));
    const s = await sessionExt(ctx, IDV);
    mesure('9_toujours_connectee_apres_maj', !!(s && !s.mort && s.user_id === U.id));
    dit(!!(s && !s.mort && s.user_id === U.id), '9 : toujours reliée après la mise à jour (rien à refaire)', JSON.stringify(s));
    const p2 = await ouvrirPopup(ctx, IDV, 'onglet');
    const e = await lirePopup(p2);
    dit(e.etat === 'connecte', '9 : la fenêtre dit « Connecté à VRM »', e.texte);
  });

  // ══ 10. WORKER TUÉ AU MILIEU ══════════════════════════════════════════════
  await cas(10, 'worker MV3 tué au milieu de la liaison ; attente sans suite bornée', async (M, ouvrir) => {
    const ctx = await ouvrir(EXT);
    await poserSessionApp(ctx, null, U.id);
    if (!(await sw(ctx, ID))) { dit(false, '10 : le service worker démarre'); return; }
    const vt = await ctx.newPage();
    await vt.goto('https://www.vinted.fr/banc/connexion?uid=111').catch(() => {});
    const pop = await ouvrirPopup(ctx, ID, 'onglet');
    await toucherSeConnecter(pop);
    const vrm = await pageVRM(ctx);
    dit(!!vrm, '10 : VRM s’ouvre');
    if (!vrm) return;
    await vrm.waitForSelector('input[type="password"]', { timeout: 30000 }).catch(() => {});
    const tue = await tuerSW(ctx, ID);
    dit(tue, '10 : le service worker est ARRÊTÉ (CDP ServiceWorker.stopWorker) pendant que VRM attend la connexion');
    const t0 = Date.now();
    await seConnecterDansVRM(vrm, U);
    const r = await connecteeA(ctx, ID, U.id);
    mesure('10_ms_liaison_apres_worker_tue', r.v ? Date.now() - t0 : null);
    dit(!!r.v, '10 : la liaison aboutit quand même (tout ce qu’elle attend est dans chrome.storage)', `${r.ms} ms`);
    // Une attente sans suite : un profil neuf, « Se connecter », puis personne ne se connecte.
    const ctxB = await ouvrir(EXT, 'b');
    await poserSessionApp(ctxB, null, U.id);
    if (!(await sw(ctxB, ID))) { dit(false, '10 : le service worker démarre (profil b)'); return; }
    const p2 = await ouvrirPopup(ctxB, ID, 'onglet');
    await toucherSeConnecter(p2);
    await attendre(2500);
    const p3 = await ouvrirPopup(ctxB, ID, 'onglet');
    const en = await lirePopup(p3);
    mesure('10_fenetre_en_attente', { etat: en.etat, phrase: en.phrase });
    dit(en.etat === 'attente' && !!en.phrase, '10 : pendant l’attente, la fenêtre DIT qu’elle attend VRM', en.texte);
    await capture(p3, '10-attente');
    // 16 min plus tard (l'heure de la demande reculée dans le stockage) : plus « en cours ».
    await dansSW(ctxB, ID, async () => { const l = (await chrome.storage.local.get('vrmLiaison')).vrmLiaison || {}; l.demandeAt = Date.now() - 16 * 60000; await chrome.storage.local.set({ vrmLiaison: l }); });
    const p4 = await ouvrirPopup(ctxB, ID, 'onglet');
    const fin = await lirePopup(p4);
    mesure('10_fenetre_apres_15_min', { etat: fin.etat, phrase: fin.phrase });
    dit(fin.etat === 'deconnecte' && fin.pleins === 1, '10 : au-delà de 15 min, l’attente s’arrête : « pas reliée » et « Se connecter » à nouveau', fin.texte);
  });

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  if (process.env.BANC_MESURES) fs.writeFileSync(process.env.BANC_MESURES, JSON.stringify({ extension: VERSION, ok, ko, mesures: MESURES }, null, 2));
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  process.exit(ko ? 1 : 0);
})();
