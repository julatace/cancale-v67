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
      liens.firefox = 'https://addons.mozilla.org/firefox/addon/vrm/';
      const fx = mod.boutiqueOrion();
      liens.chrome = 'https://chromewebstore.google.com/detail/x';
      const ch = mod.boutiqueOrion();
      dit(vide === '' && fx === liens.firefox && ch === liens.chrome, 'app : Orion n\'est proposé qu\'avec une boutique publiée (Chrome d\'abord, Firefox sinon)', JSON.stringify([vide, fx, ch]));
    } finally { Object.assign(liens, sauf); }
    dit(/data-premiers-orion="safari"/.test(APP) && /data-premiers-orion="telephone"/.test(APP) && /orion && boutique\.nav === 'safari'/.test(APP), 'app : Orion proposé sur Safari et sur iPhone, seulement avec un lien');
    dit(faux.length === 0, 'app : un lien de boutique est vide (pas encore publié) ou pointe vers la vraie boutique', faux.map((f) => f.join('=')).join(' ; '));
  });

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(ko ? `\n❌ ${ko} contrôle(s) en échec` : '\n✅ l\'extension se construit et se connecte sur Chrome, Edge, Opera, Brave et Firefox (ordinateur et Android)');
  process.exit(ko ? 1 : 0);
})();
