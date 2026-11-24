require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  « EXTENSION À INSTALLER » ALORS QU'ELLE EST LÀ ? (19 nov. — photo du Mac de Julien : la coque dit « Extension à
//  installer », la feuille « Publier sur Leboncoin » dit « Extension VRM pas détectée dans ce navigateur », pendant
//  que deux Chrome de ce Mac donnent signe de vie en 5.400 et 5.406.)
//
//    node scripts/bancs/extension-detectee.cjs            (build : dist/ ; extension : vinted-sync-extension/)
//    BANC_DIST=<dist> · BANC_EXT=<dossier de l'extension courante> · BANC_ANCIENNES=<v>=<dossier>,<v>=<dossier>
//    BANC_CAPTURE=<dossier> · BANC_PORT (4831) · --seul nom,nom · --mutation NOM · --prouve
//
//  Un VRAI Chromium (nouveau mode headless), la VRAIE extension chargée dépaquetée (`--load-extension`), le VRAI
//  build servi sous https://vrm.center (le nom que le manifeste attend) par `_e2e-monde.cjs` — rien ne sort.
//  Les cas (un profil Chrome neuf pour chacun) :
//    · aucune          : pas d'extension, aucune du compte vue ailleurs ⇒ « Extension à installer »
//                        (`data-etat-code="absente"`, pas de `data-etat-ailleurs`) ;
//    · ailleurs        : pas d'extension ICI, mais une du compte a donné signe de vie il y a 20 min dans un autre
//                        navigateur (sa ligne `ext_appareil_*`) ⇒ la coque le DIT (`data-etat-ailleurs` = sa version),
//                        au lieu d'un « à installer » sec ; un signe de vie de 3 jours ne compte pas ;
//    · muette-ici      : l'extension est installée et activée dans CE profil (le canal `chrome.runtime` existe dans
//                        la page) mais son pont n'est pas dans la page ⇒ « installée ici, ne répond pas sur cette
//                        page » (`data-etat-code="muette"`, `data-etat-ici`), JAMAIS « à installer » ;
//    · courante        : l'extension du dépôt ⇒ JAMAIS « absente », la version dite est la sienne ;
//    · ancienne-<v>    : une version antérieure RECONSTRUITE (`git archive` du commit qui la servait — BANC_ANCIENNES)
//                        ou, à défaut, l'extension du dépôt au manifeste et au code vieillis ⇒ JAMAIS « absente » :
//                        elle est PRÉSENTE, sa version est dite, et une capacité arrivée après elle est « en retard »
//                        (« Mets l'extension à jour »), une capacité qu'elle a reste permise ;
//    · tardive         : le pont arrive APRÈS la page (plus de 6 s après l'app) ⇒ la page le voit sans être rechargée ;
//    · rechargee       : ⟳ sur l'extension pendant que VRM est ouvert ⇒ jamais « à installer » ensuite.
//  Jugé sur les attributs de la pastille de la coque (`.vrm-etat-pastille` : `data-etat-code`, `-ici`, `-ailleurs`)
//  et sur ce que l'app sait de l'extension (`window.__vrmExtVu`, posé par l'app pour ses bancs) — jamais sur un libellé.
//  Rouge sur origin/main ed9399cb (muette-ici et ailleurs disaient « à installer ») ; `--prouve` : 3 mutations.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const { monde, certificat, HOTES } = require('./_e2e-monde.cjs');
const chargerPw = () => { for (const p of [__dirname, process.cwd(), path.join(__dirname, '..', '..')]) { try { return require(require.resolve('playwright', { paths: [p] })); } catch (_) {} } return null; };
const pw = chargerPw();
const RACINE = path.join(__dirname, '..', '..');
const CHROME = process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const PORT = Number(process.env.BANC_PORT) || 4831;
const DIST0 = path.resolve(process.env.BANC_DIST || path.join(RACINE, 'dist'));
const EXT0 = path.resolve(process.env.BANC_EXT || path.join(RACINE, 'vinted-sync-extension'));
const CAPT = process.env.BANC_CAPTURE || '';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const SEULS = arg('--seul') ? arg('--seul').split(',') : null;
const MUT = arg('--mutation');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + String(det).slice(0, 400) : ''}`); } };
const veut = (n) => !SEULS || SEULS.some((s) => n === s || n.startsWith(s));

// Les mutations : UNE règle réaffaiblie dans le build ; le banc doit rougir (§6.1).
const MUTATIONS = {
  // l'app n'entend plus le « ready » du pont : toute extension présente redevient « absente »
  sourde: [[/\.__vmr!==?"ready"/g, '.__vmr!=="ready-mute"']],
  // le canal de la page n'est plus lu : une extension installée ici mais muette redevient « à installer »
  'canal-ignore': [[/\["chrome","edge","brave","opera","vivaldi","yandex"\]/g, '[]']],
  // la ligne des appareils n'est plus lue : « vivante ailleurs » redevient un « à installer » sec
  'ailleurs-ignore': [[/id=like\.ext_appareil_\*/g, 'id=like.ext_appareil_zz*']],
};

if (process.argv.includes('--prouve')) {
  const lancer = (extra) => spawnSync(process.execPath, [__filename, ...extra], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 900000, encoding: 'utf8' });
  const base = lancer([]); const vert = base.status === 0;
  console.log(`${vert ? '✅' : '❌'} passage sur le code tel quel : ${vert ? 'vert' : 'ROUGE'}`);
  if (!vert) console.log(String(base.stdout).split('\n').filter((l) => /❌/.test(l)).join('\n'));
  let rate = vert ? 0 : 1;
  for (const m of Object.keys(MUTATIONS)) {
    const r = lancer(['--mutation', m]); const rouges = String(r.stdout).split('\n').filter((l) => /❌/.test(l));
    const bon = r.status !== 0 && rouges.length > 0; if (!bon) rate++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${m} » : ${bon ? `rouge (${rouges.length} contrôle(s))` : 'RESTE VERTE — le banc ne la voit pas'}`);
    for (const l of rouges.slice(0, 3)) console.log('     ' + l.trim());
  }
  process.exit(rate ? 1 : 0);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-ext-detectee-'));
const extId = (dir) => crypto.createHash('sha256').update(path.resolve(dir)).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
function copierExtension(nom, source, version) {
  const d = path.join(TMP, nom);
  fs.cpSync(source, d, { recursive: true });
  if (version) {
    const mf = path.join(d, 'manifest.json'); const j = JSON.parse(fs.readFileSync(mf, 'utf8')); j.version = version; fs.writeFileSync(mf, JSON.stringify(j, null, 2));
    const f = path.join(d, 'background.js'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/const CODE_VERSION = '[\d.]+';/, `const CODE_VERSION = '${version}';`));
  }
  return d;
}
function preparerDist() {
  const m = MUT && MUTATIONS[MUT];
  if (!m) return DIST0;
  const d = path.join(TMP, 'dist'); fs.cpSync(DIST0, d, { recursive: true }); let touche = 0;
  const marcher = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) marcher(p); else if (/\.js$/.test(f)) { const s = fs.readFileSync(p, 'utf8'); let t = s; for (const [a, b] of m) t = t.replace(a, b); if (t !== s) { touche++; fs.writeFileSync(p, t); } } } };
  marcher(d);
  if (!touche) { console.log(`❌ mutation ${MUT} : rien trouvé à muter dans dist/`); process.exit(2); }
  return d;
}
const regles = () => HOTES.map((h) => `MAP ${h} 127.0.0.1:${PORT}`).concat(['MAP * ~NOTFOUND']).join(', ');
function lancer(udd, exts) {
  const args = ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles()}`, '--use-angle=swiftshader', '--enable-unsafe-extension-debugging']
    .concat(exts.length ? [`--disable-extensions-except=${exts.join(',')}`, `--load-extension=${exts.join(',')}`] : ['--disable-extensions']);
  return pw.chromium.launchPersistentContext(udd, { executablePath: CHROME, headless: true, ignoreDefaultArgs: ['--disable-extensions'], viewport: { width: 1512, height: 950 }, args });
}
const U = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'vendeur@exemple.test', mdp: 'bon-mot-de-passe' };
async function poserSessionApp(ctx, s) {
  await ctx.addInitScript(({ s, uid }) => {
    if (location.origin !== 'https://vrm.center') return;
    try { localStorage.setItem('schema_cloisonne', '1'); localStorage.setItem('vrm_ext_separee_' + uid, '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
      if (s && !localStorage.getItem('__banc_pose')) { localStorage.setItem('__banc_pose', '1'); localStorage.setItem('vrm_session', JSON.stringify(s)); } } catch (_) {}
    // Ce que la PAGE reçoit du pont (témoin du banc, indépendant de l'app).
    window.__pontRecu = []; window.addEventListener('message', (e) => { const d = e && e.data; if (e.source === window && d && d.__vmr === 'ready') window.__pontRecu.push({ t: Math.round(performance.now()), version: d.version || '' }); }, true);
  }, { s, uid: U.id });
}
async function sw(ctx, id, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    for (const s of ctx.serviceWorkers().filter((x) => x.url().startsWith(`chrome-extension://${id}/`)).reverse()) {
      const pret = await Promise.race([s.evaluate(() => typeof chrome !== 'undefined' && !!chrome.storage).catch(() => false), attendre(1500).then(() => false)]);
      if (pret) return s;
    }
    await attendre(200);
  }
  return null;
}
// L'état que la coque AFFICHE (pastille, à l'ordinateur) et ce que la page a reçu du pont.
const lire = (pg) => pg.evaluate(() => {
  const p = document.querySelector('.vrm-etat-pastille');
  return { pastille: !!p, code: p ? p.getAttribute('data-etat-code') : null, ici: p ? p.getAttribute('data-etat-ici') : null, ailleurs: p ? p.getAttribute('data-etat-ailleurs') : null, niveau: p ? p.getAttribute('data-etat-actions') : null, texte: p ? (p.innerText || '').replace(/\s+/g, ' ').trim() : '', nom: p ? p.getAttribute('aria-label') : '',
    pont: (window.__pontRecu || []).slice(-1)[0] || null, nPont: (window.__pontRecu || []).length, vu: window.__vrmExtVu ? window.__vrmExtVu() : undefined };
}).catch(() => null);
const attendreEtat = async (pg, bon, ms) => { const t0 = Date.now(); let e = null; while (Date.now() - t0 < ms) { e = await lire(pg); if (e && e.pastille && bon(e)) return e; await attendre(400); } return e; };
const stable = (e) => e.code !== 'verif' && e.niveau !== 'verif';

(async () => {
  if (!pw) { console.log('❌ Playwright introuvable'); process.exit(1); }
  if (!fs.existsSync(path.join(DIST0, 'index.html'))) { console.log(`❌ pas de build dans ${DIST0} — lance npm run build`); process.exit(1); }
  if (MUT && !MUTATIONS[MUT]) { console.log(`❌ mutation inconnue : ${MUT}`); process.exit(2); }
  const DIST = preparerDist();
  const tls = certificat(TMP);
  const M = monde({ tls, port: PORT, dist: DIST, comptes: {}, journal: [] });
  M.USERS.set(U.email, { id: U.id, email: U.email, mdp: U.mdp });
  try { await M.ecouter(); } catch (e) { console.log(`❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); }
  const VERSION = JSON.parse(fs.readFileSync(path.join(EXT0, 'manifest.json'), 'utf8')).version;
  // Les anciennes : reconstruites (BANC_ANCIENNES) ou, à défaut, l'extension du dépôt vieillie (manifeste + code).
  const anciennes = (process.env.BANC_ANCIENNES || '').split(',').filter(Boolean).map((x) => { const [v, d] = x.split('='); return { v, dossier: path.resolve(d), vraie: true }; });
  if (!anciennes.length) for (const v of ['5.400.0', '5.406.0']) anciennes.push({ v, dossier: EXT0, vraie: false, vieillir: v });
  console.log(`app ${DIST}${MUT ? ` · MUTATION « ${MUT} »` : ''} · extension courante ${VERSION} · anciennes : ${anciennes.map((a) => a.v + (a.vraie ? ' (reconstruite)' : ' (vieillie)')).join(', ')}`);
  const ctxs = [];
  const ouvrir = async (nom, exts) => {
    const ctx = await lancer(path.join(TMP, 'profil-' + nom), exts); ctxs.push(ctx);
    const s = M.ouvrir(M.USERS.get(U.email));
    await poserSessionApp(ctx, { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: Date.now() + 3600e3, user: s.user });
    for (const e of exts) await sw(ctx, extId(e), 15000);
    const pg = await ctx.newPage();
    return { ctx, pg };
  };
  const aller = async (pg) => { await pg.goto('https://vrm.center/?tab=ventes', { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('.vrm-etat-pastille', { timeout: 90000 }).catch(() => {}); };
  const photo = async (pg, nom) => { if (CAPT) { try { fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, nom + '.png') }); } catch (_) {} } };
  try {
    if (veut('aucune')) {
      console.log('\n── aucune extension dans ce navigateur');
      const { pg } = await ouvrir('aucune', []);
      await aller(pg);
      await attendre(9000);   // la poignée de main (6,8 s) et la lecture « ailleurs » sont passées
      const e = await attendreEtat(pg, (x) => stable(x) && x.code === 'absente', 15000);
      await photo(pg, 'aucune');
      dit(!!e && e.pastille, 'aucune : la coque est là (pastille d’état)', JSON.stringify(e));
      dit(!!e && e.nPont === 0 && e.vu && e.vu.canal === false, 'aucune : aucun pont ne s’annonce, aucun canal d’extension dans la page', JSON.stringify(e && { n: e.nPont, vu: e.vu }));
      dit(!!e && e.code === 'absente' && !e.ailleurs && !e.ici, 'aucune : « à installer » (data-etat-code="absente", rien ailleurs)', JSON.stringify(e && { code: e.code, ailleurs: e.ailleurs, texte: e.texte }));
    }
    if (veut('ailleurs')) {
      console.log('\n── ailleurs : pas d’extension ici, une du compte vivante dans un autre navigateur');
      const ligne = (id, ver, ilYaMs) => ({ id: 'ext_appareil_' + id, owner: U.id, updated_at: new Date().toISOString(), data: { v: 1, appareil: { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ver, code: ver, at: new Date(Date.now() - ilYaMs).toISOString(), atMs: Date.now() - ilYaMs, flux: {}, vus: {} } });
      // D'abord un signe de vie de 3 jours seulement : il ne compte pas.
      M.st.tables.app_data.push(ligne('00000000000000a1', '5.329.0', 3 * 86400000));
      const vieux = await ouvrir('ailleurs-vieux', []);
      await aller(vieux.pg); await attendre(9000);
      const ev = await attendreEtat(vieux.pg, (x) => stable(x) && x.code === 'absente', 15000);
      dit(!!ev && ev.code === 'absente' && !ev.ailleurs, 'ailleurs : un signe de vie de 3 jours ne compte pas (« à installer »)', JSON.stringify(ev && { code: ev.code, ailleurs: ev.ailleurs }));
      M.st.tables.app_data.push(ligne('00000000000000b2', '5.406.0', 20 * 60000));
      const { pg } = await ouvrir('ailleurs', []);
      await aller(pg);
      const e = await attendreEtat(pg, (x) => stable(x) && !!x.ailleurs, 25000);
      await photo(pg, 'ailleurs');
      dit(!!e && e.code === 'absente' && e.ailleurs === '5.406.0', 'ailleurs : la coque dit qu’une extension du compte vit ailleurs, avec sa version (la plus récente)', JSON.stringify(e && { code: e.code, ailleurs: e.ailleurs, texte: e.texte, nom: e.nom }));
      dit(!!e && e.vu && e.vu.present === false && e.vu.sait && e.vu.sait.ancienne === 'absente', 'ailleurs : rien n’est promis ICI pour autant (aucune capacité)', JSON.stringify(e && e.vu));
      M.st.tables.app_data = M.st.tables.app_data.filter((r) => !/^ext_appareil_/.test(r.id));
    }
    if (veut('muette-ici')) {
      console.log('\n── muette-ici : installée et activée dans ce profil, son pont n’est pas dans la page');
      const dossier = copierExtension('ext-muette', EXT0);
      fs.writeFileSync(path.join(dossier, 'bridge.js'), '/* banc : le pont ne s’injecte pas (accès au site retiré, onglet ouvert avant l’activation…) */\n');
      const { pg } = await ouvrir('muette-ici', [dossier]);
      await aller(pg);
      const tot = await lire(pg);
      dit(!!tot && tot.code !== 'absente', 'muette-ici : pendant la poignée de main, jamais « à installer »', JSON.stringify(tot && { code: tot.code, niveau: tot.niveau }));
      await attendre(8000);
      const e = await attendreEtat(pg, (x) => stable(x), 15000);
      await photo(pg, 'muette-ici');
      dit(!!e && e.nPont === 0 && e.vu && e.vu.canal === true, 'muette-ici : aucun pont, mais le canal de l’extension existe dans la page', JSON.stringify(e && { n: e.nPont, vu: e.vu }));
      dit(!!e && e.code === 'muette' && e.ici === '1', 'muette-ici : « installée ici, ne répond pas sur cette page » (code muette), pas « à installer »', JSON.stringify(e && { code: e.code, ici: e.ici, texte: e.texte }));
    }
    const presente = async (nom, dossier, version) => {
      console.log(`\n── ${nom} (${version})`);
      const { pg } = await ouvrir(nom, [dossier]);
      await aller(pg);
      const e = await attendreEtat(pg, (x) => stable(x) && x.code !== 'absente', 30000);
      await photo(pg, nom);
      dit(!!e && e.nPont > 0 && e.pont && e.pont.version === version, `${nom} : le pont de la ${version} s’annonce à la page`, JSON.stringify(e && { n: e.nPont, pont: e.pont }));
      dit(!!e && e.pastille && e.code !== 'absente', `${nom} : la coque ne dit PAS « à installer »`, JSON.stringify(e && { code: e.code, niveau: e.niveau, texte: e.texte }));
      dit(!!e && e.vu && e.vu.present === true && e.vu.version === version, `${nom} : l’app sait l’extension présente, en ${version}`, JSON.stringify(e && e.vu));
      return { pg, e };
    };
    if (veut('courante')) {
      const { e } = await presente('courante', copierExtension('ext-courante', EXT0), VERSION);
      dit(!!e && e.vu && e.vu.retard === false, 'courante : aucune mise à jour demandée', JSON.stringify(e && e.vu));
    }
    for (const a of anciennes) {
      const nom = 'ancienne-' + a.v;
      if (!veut(nom) && !veut('ancienne')) continue;
      const { e } = await presente(nom, copierExtension('ext-' + a.v, a.vraie ? a.dossier : EXT0, a.vraie ? null : a.vieillir), a.v);
      // « à mettre à jour », pas « à installer » : la version servie existe, et ce qu'elle sait faire reste permis.
      dit(!!e && e.vu && e.vu.retard === true, `${nom} : « à mettre à jour » (la version servie est plus récente)`, JSON.stringify(e && e.vu));
      dit(!!e && e.vu && e.vu.sait && e.vu.sait.ancienne === 'ok', `${nom} : une capacité qu’elle a déjà (baisseprix, 5.336) reste permise`, JSON.stringify(e && e.vu && e.vu.sait));
      dit(!!e && e.vu && e.vu.sait && e.vu.sait.recente === 'retard', `${nom} : une capacité arrivée après elle (repubetapes, 5.408) est « en retard », pas « absente »`, JSON.stringify(e && e.vu && e.vu.sait));
    }
    if (veut('tardive')) {
      console.log('\n── tardive : l’extension arrive APRÈS la page (plus de 6 s après l’app)');
      // Le pont est retenu : la page s'ouvre sans lui (comme une extension installée, mise à jour ou rechargée pendant que VRM est ouvert).
      const dossier = copierExtension('ext-tardive', EXT0);
      const f = path.join(dossier, 'bridge.js'); const src = fs.readFileSync(f, 'utf8');
      fs.writeFileSync(f, '/* pont retenu par le banc : injecté plus tard par chrome.scripting */\n');
      fs.writeFileSync(path.join(dossier, 'bridge-vrai.js'), src);
      const { ctx, pg } = await ouvrir('tardive', [dossier]);
      await aller(pg);
      await attendre(7500);   // au-delà des appels du démarrage (0 · 0,6 · 1,5 · 3 · 6 s)
      const avant = await attendreEtat(pg, (x) => stable(x), 15000);
      dit(!!avant && avant.nPont === 0 && avant.vu && avant.vu.present === false, 'tardive : avant l’arrivée du pont, rien ne s’est annoncé', JSON.stringify(avant && { code: avant.code, n: avant.nPont }));
      const w = await sw(ctx, extId(dossier), 15000);
      const inj = w ? await w.evaluate(async () => { const tabs = await chrome.tabs.query({ url: 'https://vrm.center/*' }); let n = 0; for (const t of tabs) { try { await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['bridge-vrai.js'] }); n++; } catch (e) { return String(e && e.message || e); } } return n; }).catch((e) => String(e)) : 'pas de service worker';
      dit(inj === 1, 'tardive : le pont est posé dans la page déjà ouverte', JSON.stringify(inj));
      const apres = await attendreEtat(pg, (x) => stable(x) && x.code !== 'absente', 12000);
      await photo(pg, 'tardive');
      dit(!!apres && apres.nPont > 0, 'tardive : le pont s’annonce', JSON.stringify(apres && apres.nPont));
      dit(!!apres && apres.code !== 'absente' && apres.vu && apres.vu.present === true, 'tardive : la page le voit SANS être rechargée (plus « à installer »)', JSON.stringify(apres && { code: apres.code, vu: apres.vu }));
    }
    if (veut('rechargee')) {
      console.log('\n── rechargee : ⟳ sur l’extension pendant que VRM est ouvert');
      const dossier = copierExtension('ext-rechargee', EXT0);
      const { ctx, pg } = await ouvrir('rechargee', [dossier]);
      await aller(pg);
      const avant = await attendreEtat(pg, (x) => stable(x) && x.code !== 'absente', 30000);
      dit(!!avant && avant.code !== 'absente', 'rechargee : présente avant le ⟳', JSON.stringify(avant && avant.code));
      const w = await sw(ctx, extId(dossier), 15000);
      if (w) await w.evaluate(() => { setTimeout(() => chrome.runtime.reload(), 50); }).catch(() => {});
      await attendre(9000);
      const apres = await attendreEtat(pg, (x) => stable(x), 20000);
      await photo(pg, 'rechargee');
      dit(!!apres && apres.code !== 'absente', 'rechargee : après le ⟳, jamais « à installer »', JSON.stringify(apres && { code: apres.code, niveau: apres.niveau, texte: apres.texte, vu: apres.vu }));
    }
  } catch (e) {
    dit(false, 'le banc a tourné jusqu’au bout', String(e && e.stack || e).slice(0, 400));
  } finally {
    for (const c of ctxs) { try { await c.close(); } catch (_) {} }
    try { await M.fermer(); } catch (_) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  }
  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
