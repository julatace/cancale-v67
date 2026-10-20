#!/usr/bin/env node
// AUDIT — l'extension VRM sur tous les navigateurs qui l'acceptent (5.188).
//
//  · Chrome, Edge, Opera, Brave : UN paquet (Chromium), celui de la boutique de
//    Chrome — le manifeste de la source, tel quel ;
//  · Firefox, ordinateur ET Android : un paquet adapté (`zip-extension.cjs
//    --firefox`) — page de fond au lieu du service worker, identifiant stable,
//    déclaration des données, `compat-firefox.js` devant chaque script, plus
//    d'`externally_connectable` ;
//  · la connexion de l'extension sans canal adressé (Firefox) passe par le pont
//    de la page (`adresse`), TOUJOURS adressée à une extension par son
//    identifiant, avec les mêmes règles (origine, nonce, compte).
// On EXÉCUTE le vrai code : le vrai `background.js` dans un Firefox imité (un
// `chrome.*` à rappels seuls, un `browser.*` à promesses), le vrai `bridge.js`,
// la vraie compatibilité, et les vraies règles de l'app.
// `--src <dossier>` lance l'audit sur une autre copie du dépôt (preuve sur le
// code d'avant, §6.1).
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const EXT = path.join(RACINE, 'vinted-sync-extension');
const { faireFond } = require(path.join(__dirname, '_fond-vm.cjs'));
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = async (nom, fn) => { try { await fn(); } catch (e) { dit(false, nom, 'a levé : ' + (e && e.message || e)); } };
const lire = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; } };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-nav-'));
  const zipFx = path.join(tmp, 'fx.zip'), zipCh = path.join(tmp, 'ch.zip');
  const fx = path.join(tmp, 'fx'), ch = path.join(tmp, 'ch');
  let construit = false;
  await essaie('le constructeur fabrique les paquets Chromium et Firefox', () => {
    execFileSync('node', [path.join(RACINE, 'scripts', 'zip-extension.cjs'), '--store', zipCh, '--firefox', zipFx], { stdio: 'pipe' });
    fs.mkdirSync(fx); fs.mkdirSync(ch);
    execFileSync('unzip', ['-q', zipFx, '-d', fx]); execFileSync('unzip', ['-q', zipCh, '-d', ch]);
    construit = fs.existsSync(path.join(fx, 'manifest.json'));
    dit(construit, 'le constructeur fabrique les paquets Chromium et Firefox');
  });

  // ── A. Le paquet Chromium (Chrome, Edge, Opera, Brave) ─────────────────────
  const mSrc = JSON.parse(lire(path.join(EXT, 'manifest.json')) || '{}');
  if (construit) {
    const mCh = JSON.parse(lire(path.join(ch, 'manifest.json')) || '{}');
    dit(JSON.stringify(mCh) === JSON.stringify(mSrc), 'Chromium : le manifeste est celui de la source, tel quel');
    dit(!fs.existsSync(path.join(ch, 'compat-firefox.js')), 'Chromium : pas de compatibilité Firefox dans le paquet');
  }

  // ── B. Le paquet Firefox ──────────────────────────────────────────────────
  let mFx = {};
  if (construit) {
    mFx = JSON.parse(lire(path.join(fx, 'manifest.json')) || '{}');
    const bg = mFx.background || {};
    dit(Array.isArray(bg.scripts) && bg.scripts[0] === 'compat-firefox.js' && bg.scripts.includes('background.js') && !bg.service_worker,
      'Firefox : page de fond (compat d\'abord, puis background.js), pas de service worker', JSON.stringify(bg));
    dit(!('externally_connectable' in mFx), 'Firefox : `externally_connectable` retiré (Firefox ne le connaît pas)');
    const g = (mFx.browser_specific_settings || {}).gecko || {};
    const ga = (mFx.browser_specific_settings || {}).gecko_android || {};
    dit(g.id === 'vrm@vrm.center', 'Firefox : identifiant stable déclaré', String(g.id));
    const v128 = (x) => parseInt(String(x || '0'), 10) >= 128;
    dit(v128(g.strict_min_version) && v128(ga.strict_min_version), 'Firefox ordinateur ET Android : version minimale 128 (scripts du monde de la page)', `${g.strict_min_version} · ${ga.strict_min_version}`);
    const dc = g.data_collection_permissions || {};
    dit(Array.isArray(dc.required) && dc.required.length > 0 && dc.required.includes('authenticationInfo'), 'Firefox : les données transmises sont déclarées', JSON.stringify(dc.required));
    const cs = mFx.content_scripts || [];
    const malPoses = cs.filter((c) => c.world !== 'MAIN' && (c.js || [])[0] !== 'compat-firefox.js');
    const dansMain = cs.filter((c) => c.world === 'MAIN' && (c.js || []).includes('compat-firefox.js'));
    dit(cs.length > 0 && malPoses.length === 0, 'Firefox : la compat est en tête de chaque script de contenu', malPoses.map((c) => c.js.join('+')).join(' ; '));
    dit(dansMain.length === 0, 'Firefox : jamais dans un script du monde de la page (il n\'a pas `chrome`)');
    const ph = lire(path.join(fx, 'popup.html')) || '';
    dit(ph.indexOf('compat-firefox.js') >= 0 && ph.indexOf('compat-firefox.js') < ph.indexOf('popup.js'), 'Firefox : la fenêtre de l\'icône charge la compat avant popup.js');
    const diff = fs.readdirSync(EXT).filter((f) => /\.(js|png|json)$/.test(f) && f !== 'manifest.json')
      .filter((f) => !fs.existsSync(path.join(fx, f)) || !fs.readFileSync(path.join(fx, f)).equals(fs.readFileSync(path.join(EXT, f))));
    dit(diff.length === 0, 'Firefox : le code est celui de la source, octet pour octet', diff.join(', '));
    // Ce qui doit rester pareil : permissions, hôtes, version.
    dit(JSON.stringify(mFx.permissions) === JSON.stringify(mSrc.permissions) && JSON.stringify(mFx.host_permissions) === JSON.stringify(mSrc.host_permissions) && mFx.version === mSrc.version,
      'Firefox : mêmes permissions, mêmes sites, même version que Chromium');
  }

  // ── C. La compatibilité elle-même ─────────────────────────────────────────
  const COMPAT = lire(path.join(RACINE, 'scripts', 'extension-firefox', 'compat-firefox.js'));
  dit(!!COMPAT, 'compat-firefox.js existe');
  if (COMPAT) {
    await essaie('compat : chrome à rappels seuls', async () => {
      const appels = [];
      const store = { k: 1 };
      const browser = { runtime: { id: 'vrm@vrm.center', onMessage: { addListener: (f) => appels.push('ecoute-b') } },
        storage: { local: { get: async (k) => { appels.push('b.get'); return { k: store.k }; } } } };
      const chrome = { runtime: { id: 'vrm@vrm.center', lastError: null, onMessage: { addListener: (f) => appels.push('ecoute-c') } },
        storage: { local: { get: (k, cb) => { appels.push('c.get'); if (typeof cb === 'function') cb({ k: store.k }); } } } };
      const ctx = { browser, chrome, Proxy, WeakMap, Object, String, Promise };
      ctx.globalThis = ctx;
      vm.createContext(ctx); vm.runInContext(COMPAT, ctx);
      const r = await ctx.chrome.storage.local.get('k');
      dit(r && r.k === 1 && appels.includes('b.get'), 'compat : un appel SANS rappel rend une promesse (par browser.*)');
      let parRappel = null; ctx.chrome.storage.local.get('k', (x) => { parRappel = x; });
      dit(parRappel && parRappel.k === 1 && appels.filter((a) => a === 'c.get').length >= 2, 'compat : un appel AVEC rappel reste sur chrome.*');
      ctx.chrome.runtime.onMessage.addListener(() => {});
      dit(appels.includes('ecoute-c') && !appels.includes('ecoute-b'), 'compat : les écouteurs restent sur chrome.* (sendResponse comme dans Chrome)');
      dit(ctx.chrome.runtime.id === 'vrm@vrm.center' && ctx.chrome.runtime.lastError === null, 'compat : les propriétés passent telles quelles');
    });
    await essaie('compat : chrome qui sait déjà les promesses', async () => {
      const chrome = { runtime: { id: 'x' }, storage: { local: { get: () => Promise.resolve({}) } } };
      const ctx = { browser: { runtime: { id: 'x' } }, chrome, Proxy, WeakMap, Object, String, Promise };
      ctx.globalThis = ctx;
      vm.createContext(ctx); vm.runInContext(COMPAT, ctx);
      dit(ctx.chrome === chrome, 'compat : si chrome.* rend déjà des promesses, rien n\'est touché');
    });
    await essaie('compat : Chrome (pas de browser)', async () => {
      const chrome = { runtime: { id: 'x' } };
      const ctx = { chrome, Proxy, WeakMap, Object, String, Promise };
      ctx.globalThis = ctx;
      vm.createContext(ctx); vm.runInContext(COMPAT, ctx);
      dit(ctx.chrome === chrome && !ctx.__vrmCompat, 'compat : sans `browser` (Chrome, Edge, Opera), ne fait rien');
    });
  }

  // ── D. Le VRAI fond dans un Firefox imité : la liaison par le pont ─────────
  const SRC_BG = path.join(EXT, 'background.js');
  const UID = '11111111-2222-4333-8444-555555555555';
  const faireFx = (avecCompat) => faireFond({ src: SRC_BG, firefox: { compat: avecCompat ? COMPAT : null } });
  await essaie('fond Firefox : liaison par le pont', async () => {
    const f = faireFx(true);
    const app = { origin: 'https://vrm.center', url: 'https://vrm.center/', tab: { id: 3, url: 'https://vrm.center/' } };
    const q = await f.envoyer({ from: 'vmr-bridge', action: 'adresse', msg: { type: 'liaison', pour: UID } }, app);
    dit(q && q.ok === true && q.besoin === true && /^[0-9a-f]{32}$/.test(String(q.nonce || '')), 'fond Firefox : l\'app demande une liaison par le pont — l\'extension rend un nonce', JSON.stringify(q));
    const pirate = await f.envoyer({ from: 'vmr-bridge', action: 'adresse', msg: { type: 'liaison', pour: UID } }, { url: 'https://vrm.center.autre-site.com/', tab: { id: 4 } });
    dit(pirate && pirate.ok === false && pirate.code === 'origine', 'fond Firefox : une autre origine est refusée', JSON.stringify(pirate));
    const jeton = (sub) => 'x.' + Buffer.from(JSON.stringify({ sub, email: 'vendeur@exemple.test' })).toString('base64url') + '.y';
    const faux = await f.envoyer({ from: 'vmr-bridge', action: 'adresse', msg: { type: 'session', nonce: 'f'.repeat(32), session: { access_token: jeton(UID), refresh_token: 'r1', user_id: UID } } }, app);
    dit(faux && faux.ok === false && faux.code === 'nonce', 'fond Firefox : une session sans le bon nonce est refusée', JSON.stringify(faux));
    const autre = await f.envoyer({ from: 'vmr-bridge', action: 'adresse', msg: { type: 'session', nonce: q && q.nonce, session: { access_token: jeton('99999999-2222-4333-8444-555555555555'), refresh_token: 'r1', user_id: '99999999-2222-4333-8444-555555555555' } } }, app);
    dit(autre && autre.ok === false && autre.code === 'compte', 'fond Firefox : une session d\'un autre compte que celui annoncé est refusée', JSON.stringify(autre));
    const q2 = await f.envoyer({ from: 'vmr-bridge', action: 'adresse', msg: { type: 'liaison', pour: UID } }, app);
    const bonne = await f.envoyer({ from: 'vmr-bridge', action: 'adresse', msg: { type: 'session', nonce: q2 && q2.nonce, session: { access_token: jeton(UID), refresh_token: 'r1', user_id: UID } } }, app);
    dit(bonne && bonne.ok === true && f.store.vrmSession && f.store.vrmSession.user_id === UID, 'fond Firefox : la session adressée avec le nonce est adoptée', JSON.stringify(bonne));
    const rejoue = await f.envoyer({ from: 'vmr-bridge', action: 'adresse', msg: { type: 'session', nonce: q2 && q2.nonce, session: { access_token: jeton(UID), refresh_token: 'r2', user_id: UID } } }, app);
    dit(rejoue && rejoue.ok === false, 'fond Firefox : le même nonce ne sert pas deux fois', JSON.stringify(rejoue));
    const ancien = await f.envoyer({ from: 'vmr-bridge', action: 'session', session: { access_token: jeton(UID), refresh_token: 'r3' } }, app);
    dit(ancien && ancien.ok === false && ancien.code === 'canal', 'fond Firefox : l\'ancien message « session » de la page reste refusé', JSON.stringify(ancien));
  });
  await essaie('fond Firefox sans la compat', async () => {
    const f = faireFx(false);
    const q = await f.envoyer({ from: 'vmr-bridge', action: 'adresse', msg: { type: 'liaison', pour: UID } }, { origin: 'https://vrm.center', url: 'https://vrm.center/' });
    dit(!(q && q.ok === true && q.besoin === true), 'contrôle : SANS la compat, le même fond ne sait pas lire son stockage dans ce Firefox imité (la compat compte)', JSON.stringify(q));
  });

  // ── E. Le vrai pont : il ne relaie que ce qui lui est ADRESSÉ ──────────────
  await essaie('pont : adresse', async () => {
    const SRC = lire(path.join(EXT, 'bridge.js'));
    const faire = (id) => {
      const relaye = [], postes = [], ecouteurs = [];
      const win = { postMessage: (m) => postes.push(m), addEventListener: (t, f) => { if (t === 'message') ecouteurs.push(f); }, removeEventListener() {} };
      const ctx = { window: win, document: { addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, setAttribute() {}, remove() {} }), body: { appendChild() {} } },
        setTimeout: () => 0, clearTimeout() {}, Object, String, JSON,
        chrome: { runtime: { id, lastError: null, getManifest: () => ({ version: '5.188.0' }), getURL: (p) => p, sendMessage: (m, cb) => { relaye.push(m); if (cb) cb({ ok: true, besoin: true, nonce: 'n' }); }, onMessage: { addListener() {} } } } };
      ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(SRC, ctx);
      const envoie = (data) => ecouteurs.forEach((f) => f({ source: win, data }));
      return { relaye, postes, envoie };
    };
    const p = faire('vrm@vrm.center');
    p.envoie({ __vmr: 'adresse', reqId: 'r1', ext: 'vrm@vrm.center', msg: { type: 'liaison', pour: UID } });
    const rel = p.relaye.find((m) => m.action === 'adresse');
    dit(rel && rel.msg && rel.msg.type === 'liaison' && rel.from === 'vmr-bridge', 'pont : un message adressé à SON identifiant est relayé');
    dit(p.postes.some((m) => m.__vmr === 'adresse:result' && m.reqId === 'r1' && m.resp && m.resp.nonce === 'n'), 'pont : la réponse revient à la page avec la même demande');
    const autre = faire('vrm@vrm.center');
    autre.envoie({ __vmr: 'adresse', reqId: 'r2', ext: 'abcdefghijklmnopabcdefghijklmnop', msg: { type: 'liaison', pour: UID } });
    dit(!autre.relaye.some((m) => m.action === 'adresse'), 'pont : un message adressé à UNE AUTRE extension n\'est pas relayé');
    const sess = faire('vrm@vrm.center');
    sess.envoie({ __vmr: 'session', session: { access_token: 'a', refresh_token: 'b' } });
    dit(!sess.relaye.length || !sess.relaye.some((m) => m.action === 'session'), 'pont : l\'ancien message « session » n\'est toujours pas relayé');
  });


  // ── G. Un navigateur à qui il MANQUE des API (20 octobre : Orion iPhone,
  //    Safari, Firefox pour Android) — le vrai fond, des profils tirés des
  //    sources (docs/boutiques-extension.md, table des API) ────────────────────
  //  · safari-ios / firefox-android : ce que MDN (browser-compat-data) dit
  //    absent — `downloads`, `windows.update` (Safari iOS) ; `downloads`,
  //    `windows` (Firefox Android) ;
  //  · orion-ios : tout ce que Kagi ne DOCUMENTE pas pour iOS (réveil, monde
  //    MAIN, téléchargements, fenêtres, canal externe, ouverture du popup) ;
  //  · orion-ios-pire : en plus `cookies`, `scripting` et `tabs.sendMessage` —
  //    le pire cas, pour prouver que chaque repli tient seul.
  // `--mutation cookies|alarms|main` retire UNE garde de capacité du fond :
  // le contrôle qui la vise doit passer au rouge (preuve, §6.1).
  const iMut = process.argv.indexOf('--mutation');
  const MUT = iMut > 0 ? String(process.argv[iMut + 1] || '') : '';
  let SRC_G = SRC_BG;
  if (MUT) {
    let t = lire(SRC_BG) || '';
    const avant = t;
    if (MUT === 'cookies') t = t.replace("  if (!CAP.cookies) return cookieDeLaPage(domain, name);\n", '');
    if (MUT === 'alarms') t = t.replace('if (CAP.alarms) {\n  try {\n    for (const nom', 'if (true) {\n  try {\n    for (const nom');
    if (MUT === 'main') t = t.replace('  if (CAP.scripting && !CAP_MAIN_REFUSE) {\n    try { return await chrome.scripting', '  if (true) {\n    try { return await chrome.scripting');
    dit(t !== avant, `mutation « ${MUT} » posée`);
    SRC_G = path.join(tmp, 'background-mute.js'); fs.writeFileSync(SRC_G, t);
  }
  const PROFILS = {
    chromium: [],
    'firefox-android': ['downloads', 'windows'],
    'safari-ios': ['downloads', 'windows.update'],
    'orion-ios': ['alarms', 'downloads', 'windows', 'runtime.onMessageExternal', 'action.openPopup'],
    'orion-ios-pire': ['alarms', 'downloads', 'windows', 'runtime.onMessageExternal', 'action.openPopup', 'cookies', 'scripting', 'tabs.sendMessage'],
  };
  const ATTENDU = {
    chromium: null,
    'firefox-android': { remplace: ['downloads'], indispo: [] },
    'safari-ios': { remplace: ['downloads'], indispo: [] },
    'orion-ios': { remplace: ['alarms', 'downloads', 'externe'], indispo: [] },
    'orion-ios-pire': { remplace: ['alarms', 'scripting', 'downloads', 'externe'], indispo: ['cookies'] },
  };
  const APP_SENDER = { origin: 'https://vrm.center', url: 'https://vrm.center/', tab: { id: 3, url: 'https://vrm.center/' } };
  const VINTED_SENDER = { tab: { id: 7, url: 'https://www.vinted.fr/member/5' }, url: 'https://www.vinted.fr/member/5' };
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const vintedBanc = (e) => {
    const c = e.chemin;
    if (/\/users\/current/.test(c)) return { status: 200, body: { user: { id: 5, login: 'compte_banc' } } };
    if (/\/wardrobe\/5\/items/.test(c)) return { status: 200, body: { items: [{ id: 901, title: 'Paire de banc', price: { amount: '30.0' } }], pagination: { total_pages: 1, total_entries: 1 } } };
    if (/my_orders/.test(c)) return { status: 200, body: { my_orders: [], pagination: { total_pages: 1 } } };
    if (/\/inbox/.test(c)) return { status: 200, body: { conversations: [] } };
    return { status: 200, body: {} };
  };
  // Le script de contenu, imité : il répond au relais comme content.js +
  // inject.js le font (la requête part de LA PAGE : `ctx.location` = Vinted).
  const contenuImite = (f, voie) => {
    // Le banc raccourcit tous les délais à 2 ms ; l'échéance du relais (25 s)
    // garde ici 2 s, sinon elle tomberait avant la réponse de la « page ».
    f.ctx.setTimeout = (fn, ms) => setTimeout(fn, (ms || 0) >= 20000 ? 2000 : Math.min(ms || 0, 2));
    const repondre = async (m) => {
      f.ctx.location = new URL('https://www.vinted.fr/');
      const r = await f.ctx.fetch(m.p, { credentials: 'include', headers: m.h || {} });
      let json = null; try { json = await r.json(); } catch (_) {}
      return { id: m.id, status: r.status, ok: r.ok, json, origine: 'https://www.vinted.fr' };
    };
    if (voie === 'message') {
      f.ctx.chrome.tabs.sendMessage = (id, m, cb) => { if (m && m.vrm === 'fetchPage') { repondre(m).then((o) => cb && cb(o)); return; } if (typeof cb === 'function') cb(); };
    } else {
      f.ctx.chrome.storage.onChanged.addListener((ch) => { const req = ch.vrmPageReq && ch.vrmPageReq.newValue; if (req && req.vrm === 'fetchPage') repondre(req).then((o) => f.ctx.chrome.storage.local.set({ vrmPageRep: o })); });
    }
  };
  const resultats = {};
  for (const [nom, retirer] of Object.entries(PROFILS)) {
    await essaie(`profil ${nom}`, async () => {
      let f = null, leve = null;
      const appels = { sync: 0, active: 0, photos: 0, relais: 0, capture: 0 };
      try { f = faireFond({ src: SRC_G, retirer, vinted: vintedBanc }); } catch (e) { leve = e; }
      dit(!!f && !leve, `${nom} : le fond démarre sans lever`, leve ? String(leve.message || leve) : '');
      if (!f) return;
      f.ctx.captureAllAccounts = async () => { appels.sync++; };
      f.ctx.runActive = async () => { appels.active++; };
      f.ctx.tickPhotos = async () => { appels.photos++; };
      f.ctx.relaisTick = async () => { appels.relais++; };
      f.ctx.captureDomain = async () => { appels.capture++; return null; };
      await attendre(30);
      const sansAlarmes = retirer.includes('alarms');
      if (sansAlarmes) {
        dit(f.j.minuteries.includes(30000), `${nom} : sans \`alarms\`, une minuterie de secours tourne`, JSON.stringify(f.j.minuteries));
        const m = f.store.vrmMinuteries || {};
        dit(['cancale-sync', 'cancale-active', 'vrm-session', 'vrm-photos', 'vrm-relais'].every((k) => Number(m[k]) > 0) && appels.sync === 1 && appels.active === 1 && appels.photos === 1 && appels.relais === 1,
          `${nom} : au réveil, chaque tâche périodique repart UNE fois, datée dans chrome.storage.local`, JSON.stringify({ m: Object.keys(m), appels }));
        await f.envoyer({ from: 'vrm-badge', action: 'rien' }, VINTED_SENDER); await attendre(20);
        dit(appels.sync === 1 && appels.active === 1, `${nom} : un second réveil aussitôt ne rejoue rien (aucune rafale)`, JSON.stringify(appels));
        // iOS a suspendu le fond 25 min : au retour, ce qui est dû repart.
        f.store.vrmMinuteries = Object.fromEntries(Object.entries(f.store.vrmMinuteries || {}).map(([k, v]) => [k, v - 25 * 60000]));
        if (typeof f.ctx.rattraperMinuteries === "function") f.ctx.rattraperMinuteries(true); await attendre(20);
        dit(appels.sync === 2 && appels.active === 2 && appels.photos === 2, `${nom} : après une suspension (25 min), les tâches en retard repartent une fois`, JSON.stringify(appels));
      } else {
        dit(!f.j.minuteries.includes(30000) && appels.sync === 0, `${nom} : avec \`alarms\`, aucune minuterie de secours (le chemin de Chrome)`);
      }
      // Les cookies de session.
      const veux = await f.envoyer({ from: 'vrm-cookies', action: 'veux' }, VINTED_SENDER);
      const jwt = 'x.' + Buffer.from(JSON.stringify({ account_id: 111 })).toString('base64url') + '.y';
      if (retirer.includes('cookies')) {
        dit(veux && veux.veux === true, `${nom} : sans \`cookies\`, l'extension demande ceux de la page`);
        const etat0 = await f.envoyer({ from: 'vmr-bridge', action: 'etat' }, APP_SENDER);
        dit(etat0 && etat0.nav && (etat0.nav.indispo || []).includes('cookies'), `${nom} : tant que la page n'a rien montré, l'état DIT que la session n'est pas vue`, JSON.stringify(etat0 && etat0.nav));
        const pirate = await f.envoyer({ from: 'vrm-cookies', domain: 'www.vinted.fr', c: { access_token_web: jwt } }, { tab: { id: 9, url: 'https://www.leboncoin.fr/' } });
        dit(pirate && pirate.ok === false && !f.store.vrmCookiesPage, `${nom} : des cookies envoyés depuis un autre site sont refusés`, JSON.stringify(pirate));
        const r = await f.envoyer({ from: 'vrm-cookies', domain: 'www.vinted.fr', c: { access_token_web: jwt, refresh_token_web: 'r1', anon_id: 'a1', autre: 'secret' } }, VINTED_SENDER);
        const rangé = ((f.store.vrmCookiesPage || {})['www.vinted.fr'] || {}).c || {};
        dit(r && r.ok && r.vu === true && Object.keys(rangé).sort().join() === 'access_token_web,anon_id,refresh_token_web', `${nom} : les trois cookies utiles sont rangés (et rien d'autre)`, JSON.stringify(Object.keys(rangé)));
        const lu = await f.ctx.getCookie('www.vinted.fr', 'access_token_web');
        dit(lu === jwt, `${nom} : \`getCookie\` lit le cookie donné par la page (même valeur que Chrome lirait)`, String(lu).slice(0, 20));
        await attendre(30);
        dit(appels.capture >= 1, `${nom} : une session neuve relance la capture (l'équivalent de cookies.onChanged)`, String(appels.capture));
      } else {
        dit(veux && veux.veux === false, `${nom} : avec \`cookies\`, la page n'envoie rien (Chrome : un seul « non »)`);
        const r = await f.envoyer({ from: 'vrm-cookies', domain: 'www.vinted.fr', c: { access_token_web: jwt } }, VINTED_SENDER);
        dit(r && r.ignore === true && !f.store.vrmCookiesPage, `${nom} : avec \`cookies\`, des cookies de page sont ignorés`);
      }
      // L'état que l'app lit : ce qui manque, remplacé ou non.
      const etat = await f.envoyer({ from: 'vmr-bridge', action: 'etat' }, APP_SENDER);
      const nav = (etat && etat.nav) || null;
      const att = ATTENDU[nom];
      const memes = (a, b) => JSON.stringify((a || []).slice().sort()) === JSON.stringify((b || []).slice().sort());
      const attNav = att && retirer.includes('cookies') ? { remplace: att.remplace.concat('cookies'), indispo: [] } : att;
      dit(etat && etat.ok && (attNav === null ? nav === null : (nav && memes(nav.remplace, attNav.remplace) && memes(nav.indispo, attNav.indispo))),
        `${nom} : l'état du pont dit ${attNav === null ? 'rien (tout est là)' : 'ce qui est remplacé / impossible'}`, JSON.stringify(nav));
      // Le monde MAIN : la moisson de la page, par Chrome ou par le relais.
      const sansScripting = retirer.includes('scripting');
      if (sansScripting) contenuImite(f, retirer.includes('tabs.sendMessage') ? 'stockage' : 'message');
      f.j.vinted.length = 0;
      let rep = null; try { rep = await f.ctx.pageActiveFetch(); } catch (e) { rep = 'leve:' + (e && e.message); }
      const chemins = f.j.vinted.filter((x) => x.origine === 'page').map((x) => x.chemin.replace(/\?.*$/, '')).sort();
      resultats[nom] = { chemins, injections: f.j.injections, rep };
      dit(chemins.includes('/api/v2/users/current') && chemins.includes('/api/v2/wardrobe/5/items'), `${nom} : la moisson part DE LA PAGE${sansScripting ? ' (par le relais' + (retirer.includes('tabs.sendMessage') ? ', boîte aux lettres' : '') + ')' : ''}`, JSON.stringify({ chemins, rep }));
      if (sansScripting) dit(f.j.injections === 0, `${nom} : sans \`scripting\`, rien n'est injecté`);
    });
  }
  if (resultats.chromium && resultats['orion-ios-pire']) {
    dit(JSON.stringify(resultats.chromium.chemins) === JSON.stringify(resultats['orion-ios-pire'].chemins),
      'parité : sans `scripting` ni `tabs.sendMessage`, exactement les mêmes requêtes Vinted que sur Chrome', JSON.stringify([resultats.chromium.chemins, resultats['orion-ios-pire'].chemins]));
  }
  // Un `executeScript` qui refuse le monde MAIN (sans manquer) : le relais prend la suite.
  await essaie('monde MAIN refusé', async () => {
    const f = faireFond({ src: SRC_G, vinted: vintedBanc });
    f.ctx.chrome.scripting.executeScript = async () => { throw new Error("Unexpected property: 'world'"); };
    contenuImite(f, 'message');
    f.j.vinted.length = 0;
    await f.ctx.pageActiveFetch();
    const chemins = f.j.vinted.filter((x) => x.origine === 'page').map((x) => x.chemin.replace(/\?.*$/, ''));
    dit(chemins.includes('/api/v2/wardrobe/5/items'), 'monde MAIN refusé par `executeScript` : la même moisson passe par le relais', JSON.stringify(chemins));
    const etat = await f.envoyer({ from: 'vmr-bridge', action: 'etat' }, APP_SENDER);
    dit(etat && etat.nav && etat.nav.remplace.includes('scripting'), 'et l\'état le dit (`scripting` remplacé)', JSON.stringify(etat && etat.nav));
    const f2 = faireFond({ src: SRC_G, vinted: vintedBanc });
    let tente = 0;
    f2.ctx.chrome.scripting.executeScript = async () => { tente++; throw new Error('No tab with id: 7'); };
    f2.ctx.chrome.tabs.sendMessage = (id, m, cb) => { if (m && m.vrm === 'fetchPage') { tente += 100; } if (cb) cb(); };
    const r2 = await f2.ctx.pageActiveFetch();
    dit(tente === 1 && !r2, 'un refus ordinaire (onglet fermé) reste un refus, comme sur Chrome — aucun relais', String(tente));
  });

  // ── H. Les scripts de la page, exécutés : le relais (content.js ↔ inject.js),
  //    les cookies de page, et lbc-inject / vc-inject hors du monde MAIN ────────
  await essaie('relais de la page', async () => {
    const SRC_C = lire(path.join(EXT, 'content.js')), SRC_I = lire(path.join(EXT, 'inject.js'));
    const faireMondes = ({ veux, cookie }) => {
      const ecPage = [], ecContenu = [], envoyes = [], fetchs = [];
      let ecouteMsg = null;
      const winI = {}, winC = {};
      // ⚠️ La « fenêtre » vue DEPUIS le vm n'est pas l'objet passé (vm la contextifie) :
      // on prend celle que chaque script voit, sinon `event.source !== window`.
      let vueI = winI, vueC = winC;
      const poster = (data) => setTimeout(() => { for (const f of ecPage.slice()) f({ source: vueI, data }); for (const f of ecContenu.slice()) f({ source: vueC, data }); }, 0);
      Object.assign(winI, { console: { log() {}, warn() {}, error() {} }, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 2)), clearTimeout, setInterval: () => 0, clearInterval, URL, Headers: class {},
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        location: { host: 'www.vinted.fr', hostname: 'www.vinted.fr', origin: 'https://www.vinted.fr', href: 'https://www.vinted.fr/' },
        document: { hidden: true, addEventListener() {} }, localStorage: { getItem: () => String(Date.now()), setItem() {} },
        addEventListener: (t, f) => { if (t === 'message') ecPage.push(f); }, postMessage: (d) => poster(d),
        XMLHttpRequest: class { open() {} setRequestHeader() {} addEventListener() {} send() {} },
        fetch: async (url, init) => { fetchs.push({ url: String(url), credentials: init && init.credentials, headers: (init && init.headers) || {} }); return { ok: true, status: 200, headers: { get: () => 'application/json' }, clone() { return this; }, text: async () => '{"user":{"id":5}}', json: async () => ({ user: { id: 5 } }) }; } });
      winI.window = winI; winI.self = winI; winI.globalThis = winI;
      vm.createContext(winI); vm.runInContext(SRC_I, winI, { filename: 'inject.js' }); vueI = vm.runInContext('window', winI);
      Object.assign(winC, { console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
        location: { host: 'www.vinted.fr', hostname: 'www.vinted.fr', origin: 'https://www.vinted.fr' },
        document: { cookie: cookie || '', visibilityState: 'visible', addEventListener() {}, createElement: () => ({ remove() {} }), head: { appendChild() {} }, documentElement: { appendChild() {} } },
        addEventListener: (t, f) => { if (t === 'message') ecContenu.push(f); }, postMessage: (d) => poster(d),
        chrome: { runtime: { getURL: (p) => 'chrome-extension://x/' + p, lastError: null,
          sendMessage: (m, cb) => { envoyes.push(m); if (typeof cb === 'function') cb(m && m.action === 'veux' ? { ok: true, veux } : { ok: true }); },
          onMessage: { addListener: (f) => { ecouteMsg = f; } } },
          storage: { local: { get: (k, cb) => cb({}), set() {} }, onChanged: { addListener() {} } } } });
      winC.window = winC; winC.self = winC; winC.globalThis = winC;
      vm.createContext(winC); vm.runInContext(SRC_C, winC, { filename: 'content.js' }); vueC = vm.runInContext('window', winC);
      return { envoyes, fetchs, demander: (m) => new Promise((res) => { const r = ecouteMsg && ecouteMsg(m, {}, res); if (r !== true) res(undefined); }) };
    };
    const m = faireMondes({ veux: false, cookie: 'access_token_web=AAA; refresh_token_web=RRR; v_sid=zz' });
    const rep = await m.demander({ vrm: 'fetchPage', id: 'r1', p: '/api/v2/users/current', h: { accept: 'application/json', 'x-csrf-token': 'tok', cookie: 'interdit' } });
    dit(rep && rep.id === 'r1' && rep.status === 200 && rep.json && rep.json.user && rep.json.user.id === 5 && rep.origine === 'https://www.vinted.fr', 'relais : le fond demande, inject.js (monde de la page) fait la requête, la réponse revient', JSON.stringify(rep));
    const f0 = m.fetchs[0] || {};
    dit(f0.url === '/api/v2/users/current' && f0.credentials === 'include' && f0.headers['x-csrf-token'] === 'tok' && !('cookie' in f0.headers), 'relais : requête de la page, ses cookies, et seulement les en-têtes permis', JSON.stringify(f0));
    const hors = await m.demander({ vrm: 'fetchPage', id: 'r2', p: 'https://autre-site.test/vol', h: {} });
    dit(m.fetchs.length === 1, 'relais : une adresse hors de l\'API Vinted ne part pas', JSON.stringify(m.fetchs.map((x) => x.url)));
    void hors;
    dit(m.envoyes.filter((x) => x.from === 'vrm-cookies').length === 1 && m.envoyes.filter((x) => x.from === 'vrm-cookies')[0].action === 'veux', 'cookies (Chrome, `veux` = non) : un seul message, rien d\'autre ne part', JSON.stringify(m.envoyes.filter((x) => x.from === 'vrm-cookies')));
    const m2 = faireMondes({ veux: true, cookie: 'access_token_web=AAA; refresh_token_web=RRR; v_sid=zz' });
    await attendre(10);
    const c = m2.envoyes.find((x) => x.from === 'vrm-cookies' && x.c);
    dit(c && c.c.access_token_web === 'AAA' && c.c.refresh_token_web === 'RRR' && !('v_sid' in c.c) && c.domain === 'www.vinted.fr', 'cookies (navigateur sans API) : la page donne les cookies de session utiles, et seulement eux', JSON.stringify(c));
  });
  await essaie('lbc-inject / vc-inject hors du monde MAIN', async () => {
    for (const [fic, drapeau] of [['lbc-inject.js', '__vrmLbcInjected'], ['vc-inject.js', '__vrmVcInjected']]) {
      const SRC = lire(path.join(EXT, fic));
      const monde = (isole) => {
        const poses = [];
        const g = { console: { log() {}, warn() {}, error() {} }, setTimeout: () => 0, clearTimeout, setInterval: () => 0, URL, Headers: class {},
          location: { host: 'www.leboncoin.fr', hostname: 'www.leboncoin.fr', origin: 'https://www.leboncoin.fr', href: 'https://www.leboncoin.fr/', pathname: '/' },
          document: { currentScript: null, readyState: 'complete', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ set src(v) { this._src = v; }, get src() { return this._src; }, remove() {} }),
            head: { appendChild: (s) => poses.push(s._src) }, documentElement: { appendChild: (s) => poses.push(s._src) } },
          addEventListener() {}, postMessage() {},
          XMLHttpRequest: class { open() {} send() {} addEventListener() {} setRequestHeader() {} },
          fetch: async () => ({ ok: true, status: 200, headers: { get: () => '' }, clone() { return this; }, text: async () => '' }),
          history: { pushState() {}, replaceState() {} }, MutationObserver: class { observe() {} } };
        if (isole) g.chrome = { runtime: { id: 'extid', getURL: (p) => 'chrome-extension://extid/' + p } };
        g.window = g; g.self = g; g.globalThis = g;
        vm.createContext(g);
        try { vm.runInContext(SRC, g, { filename: fic }); } catch (_) {}
        return { poses, pose: !!g[drapeau], fetchEnveloppe: g.fetch && !/async \(\) =>/.test(String(g.fetch)) };
      };
      const iso = monde(true);
      dit(iso.poses.length === 1 && /extid\/(lbc|vc)-inject\.js$/.test(iso.poses[0]) && !iso.pose, `${fic} : dans le monde ISOLÉ (monde MAIN ignoré), il se pose dans la page par une balise <script> et n'enveloppe rien ici`, JSON.stringify(iso));
      const main = monde(false);
      dit(main.poses.length === 0 && main.pose, `${fic} : dans le monde MAIN (Chrome, Firefox), comportement d'avant`, JSON.stringify(main));
    }
  });

  // ── I. Le paquet Safari (dossier pour le convertisseur d'Apple) ─────────────
  await essaie('paquet Safari', async () => {
    const zipSa = path.join(tmp, 'sa.zip'), sa = path.join(tmp, 'sa');
    execFileSync('node', [path.join(RACINE, 'scripts', 'zip-extension.cjs'), '--safari', zipSa], { stdio: 'pipe' });
    fs.mkdirSync(sa); execFileSync('unzip', ['-q', zipSa, '-d', sa]);
    const d = path.join(sa, 'VRM-safari');
    const m = JSON.parse(lire(path.join(d, 'manifest.json')) || '{}');
    const bg = m.background || {};
    dit(bg.scripts && bg.scripts[0] === 'compat-firefox.js' && bg.scripts.includes('background.js') && bg.persistent === false && !bg.service_worker,
      'Safari : fond NON persistant (exigé sur iOS), compat d\'abord', JSON.stringify(bg));
    dit(!(m.permissions || []).includes('downloads') && (m.permissions || []).includes('cookies'), 'Safari : `downloads` retiré (Safari ne l\'a pas), le reste gardé', JSON.stringify(m.permissions));
    dit(((m.browser_specific_settings || {}).safari || {}).strict_min_version === '16.4', 'Safari : version minimale déclarée (16.4)');
    dit(!!m.externally_connectable, 'Safari : `externally_connectable` gardé (Safari le prend en charge, matches seuls)');
    const cs = m.content_scripts || [];
    dit(cs.filter((c) => c.world !== 'MAIN').every((c) => c.js[0] === 'compat-firefox.js') && cs.filter((c) => c.world === 'MAIN').every((c) => !c.js.includes('compat-firefox.js')), 'Safari : compat devant chaque script de contenu, jamais dans le monde de la page');
    const ph = lire(path.join(d, 'popup.html')) || '';
    dit(ph.indexOf('compat-firefox.js') >= 0 && ph.indexOf('compat-firefox.js') < ph.indexOf('popup.js'), 'Safari : la fenêtre charge la compat avant popup.js');
    const diff = fs.readdirSync(EXT).filter((f) => /\.(js|png)$/.test(f)).filter((f) => !fs.existsSync(path.join(d, f)) || !fs.readFileSync(path.join(d, f)).equals(fs.readFileSync(path.join(EXT, f))));
    dit(diff.length === 0, 'Safari : le code est celui de la source, octet pour octet', diff.join(', '));
    const war = (m.web_accessible_resources || []).flatMap((w) => w.resources || []);
    dit(war.includes('vc-inject.js') && war.includes('lbc-inject.js'), 'Safari (et partout) : lbc-inject.js et vc-inject.js sont web-accessibles (le repli du monde MAIN en a besoin)');
  });

  // ── F. L'app ───────────────────────────────────────────────────────────────
  const APP = lire(path.join(RACINE, 'src', 'App.jsx')) || '';
  await essaie('app : identifiants', () => {
    const m = /const ID_EXT = (\/.*\/i);/.exec(APP);
    dit(!!m, 'app : une règle d\'identifiant d\'extension (ID_EXT)');
    if (m) {
      const re = vm.runInNewContext(m[1]);
      dit(re.test('abcdefghijklmnopabcdefghijklmnop') && re.test('vrm@vrm.center') && re.test('{12345678-1234-1234-1234-123456789abc}'),
        'app : identifiants Chrome ET Firefox acceptés');
      dit(!re.test('') && !re.test('javascript:alert(1)') && !re.test('a b@c') && !re.test('x'.repeat(200) + '@a.b'), 'app : rien d\'autre');
    }
    const ve = (/function versExtension\(id, msg, timeoutMs = 5000\) \{[\s\S]*?\n\}/.exec(APP) || [''])[0];
    dit(/vmrDemandeUn\('adresse'/.test(ve) && /ID_EXT\.test/.test(ve), 'app : sans canal adressé, la liaison part par le pont, adressée par identifiant');
    dit(/\?lier-extension[\s\S]{0,400}ID_EXT\.test\(id\)/.test(APP) || /if \(id && ID_EXT\.test\(id\)\)/.test(APP), 'app : « Se connecter avec VRM » accepte l\'identifiant Firefox');
    dit(/if \(sansSouris && !vmrExtPresent\(\)\)/.test(APP), 'app : un téléphone qui a l\'extension (Firefox Android) agit comme un ordinateur, pas par le relais');
  });
  await essaie('app : navigateurs', async () => {
    const mod = await import(path.join(RACINE, 'src', 'navigateurExtension.js'));
    const UA = {
      chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
      opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0',
      firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:143.0) Gecko/20100101 Firefox/143.0',
      fxandroid: 'Mozilla/5.0 (Android 15; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0',
      safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
    };
    const vu = Object.fromEntries(Object.entries(UA).map(([k, u]) => [k, mod.navigateurIci(u)]));
    dit(vu.chrome === 'chrome' && vu.edge === 'edge' && vu.opera === 'opera' && vu.firefox === 'firefox' && vu.fxandroid === 'firefox' && vu.safari === 'safari', 'app : les navigateurs sont reconnus', JSON.stringify(vu));
    dit(mod.estAndroid(UA.fxandroid) && !mod.estAndroid(UA.firefox), 'app : Firefox pour Android reconnu');
    dit(mod.pageExtensionsIci(UA.firefox) === 'about:addons' && mod.pageExtensionsIci(UA.edge) === 'edge://extensions' && mod.pageExtensionsIci(UA.chrome) === 'chrome://extensions', 'app : la page des extensions de CE navigateur');
    const liens = mod.LIENS_BOUTIQUES || {};
    const bons = { chrome: /^https:\/\/chromewebstore\.google\.com\/detail\//, edge: /^https:\/\/microsoftedge\.microsoft\.com\/addons\/detail\//, opera: /^https:\/\/addons\.opera\.com\//, firefox: /^https:\/\/addons\.mozilla\.org\// };
    const faux = Object.entries(liens).filter(([k, v]) => v && !(bons[k] && bons[k].test(v)));
    // Orion (Mac, iPhone) : la boutique de Chrome, sinon celle de Firefox — et
    // RIEN tant qu'aucune n'est publiée (jamais un lien deviné).
    const sauf = { ...liens };
    try {
      for (const k of Object.keys(liens)) liens[k] = '';
      const vide = mod.boutiqueOrion();
      liens.chrome = 'https://chromewebstore.google.com/detail/x';
      const ch = mod.boutiqueOrion();
      liens.firefox = 'https://addons.mozilla.org/firefox/addon/vrm/';
      const fx = mod.boutiqueOrion();
      // 20 octobre : Firefox d'abord (Orion préfère `background.scripts`, la forme du paquet Firefox).
      dit(vide === '' && ch === liens.chrome && fx === liens.firefox, 'app : Orion n\'est proposé qu\'avec une boutique publiée (Firefox d\'abord, Chrome sinon)', JSON.stringify([vide, ch, fx]));
    } finally { Object.assign(liens, sauf); }
    dit(/data-premiers-orion="safari"/.test(APP) && /data-premiers-orion="telephone"/.test(APP) && /orion && \(boutique\.nav === 'safari' \|\| boutique\.nav === 'orion'\)/.test(APP), 'app : Orion proposé sur Safari et sur iPhone, seulement avec un lien');
    dit(faux.length === 0, 'app : un lien de boutique est vide (pas encore publié) ou pointe vers la vraie boutique', faux.map((f) => f.join('=')).join(' ; '));
    // 20 octobre — tous les navigateurs : chacun reconnu par SON marqueur, et
    // ce qu'il accepte (jamais un lien deviné).
    const UA2 = {
      ddgAndroid: 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 DuckDuckGo/5',
      ddgIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1 Ddg/18.6',
      yandex: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 YaBrowser/25.10.0.0 Safari/537.36',
      vivaldi: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Vivaldi/7.6',
      samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36',
      chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
      chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1',
    };
    const nav2 = Object.fromEntries(Object.entries(UA2).map(([k, u]) => [k, mod.navigateurIci(u)]));
    dit(nav2.ddgAndroid === 'duckduckgo' && nav2.ddgIos === 'duckduckgo' && nav2.yandex === 'yandex' && nav2.vivaldi === 'vivaldi' && nav2.samsung === 'samsung', 'app : DuckDuckGo, Yandex, Vivaldi, Samsung reconnus par leur marqueur', JSON.stringify(nav2));
    const acc = Object.fromEntries(Object.entries({ ...UA, ...UA2 }).map(([k, u]) => [k, mod.extensionIci(u).accepte + ':' + (mod.extensionIci(u).paquet || '-')]));
    dit(acc.chrome === 'oui:chromium' && acc.edge === 'oui:chromium' && acc.opera === 'oui:chromium' && acc.vivaldi === 'oui:chromium' && acc.yandex === 'oui:chromium'
      && acc.firefox === 'oui:firefox' && acc.fxandroid === 'oui:firefox'
      && acc.safari === 'non:-' && acc.chromeIos === 'non:-' && acc.ddgIos === 'non:-' && acc.ddgAndroid === 'non:-' && acc.samsung === 'non:-' && acc.chromeAndroid === 'non:-',
      'app : ce que chaque navigateur accepte (paquet Chromium, Firefox, ou rien — le relais)', JSON.stringify(acc));
    dit(mod.estOrionIci({ KAGI: {} }) === true && mod.estOrionIci({}) === false, 'app : Orion reconnu par `window.KAGI` (le repère documenté par Kagi)');
    dit(mod.phraseNavigateur(null) === '' && mod.phraseNavigateur({ remplace: [], indispo: [] }) === '', 'app : rien à dire quand rien ne manque (Chrome)');
    const ph1 = mod.phraseNavigateur({ remplace: ['alarms', 'scripting'], indispo: [] }, UA.safari);
    const ph2 = mod.phraseNavigateur({ remplace: ['scripting'], indispo: ['cookies'] }, UA.safari);
    dit(/réveil/.test(ph1) && /même chose/.test(ph1) && /arrière-plan/.test(ph1) && !/session/.test(ph1), 'app : une API remplacée se dit comme telle (la fonction tient), avec la contrainte d\'iOS', ph1);
    dit(/session Vinted/.test(ph2) && /ordinateur/.test(ph2), 'app : une API impossible ici se dit, avec le geste', ph2);
    dit(/data-etat-nav=/.test(APP) && /phraseNavigateur\(nv\)/.test(APP), 'app : le panneau de l\'extension dit, une fois, ce que l\'extension a relevé de ce navigateur');
    dit(/data-premiers-mobile=\{mobile\}/.test(APP) && /mobile === 'duckduckgo'/.test(APP) && /data-premiers-orion="dans-orion"/.test(APP), 'app : premiers pas — DuckDuckGo dit « aucune extension », Orion sur iPhone a sa consigne');
  });

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ l\'extension se construit et se connecte sur Chrome, Edge, Opera, Brave, Vivaldi, Firefox (ordinateur et Android), Safari (paquet) et un navigateur à API manquantes (Orion iPhone)');
  process.exit(ko ? 1 : 0);
})();
