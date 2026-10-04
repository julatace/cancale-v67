// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE JOURNAL DES PLANTAGES (src/plantages.js) — SANS FOURNISSEUR
//        node scripts/bancs/plantages.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Un écran mort se voyait par une capture, jamais par un signal. L'app note
// maintenant ses plantages dans SA base (`plantage_{empreinte}`, au nom du
// vendeur). Ce banc exige, sans aucune fixture :
//   1. ce qui part est NETTOYÉ (ni email, ni jeton, ni n° de transaction, ni
//      paramètre d'adresse) ;
//   2. le bruit (réseau, extensions) n'est pas noté, une même erreur ne part pas
//      deux fois dans l'heure, et dix par ouverture au plus ;
//   3. une écriture non confirmée RESTE en file ;
//   4. dans l'app rendue : une erreur réelle de la page part dans la base, AU NOM
//      du vendeur, et Réglages la montre — rien quand il n'y en a pas, rien
//      quand la lecture échoue (pas d'alerte sur une mesure qui n'a pas eu lieu).
const path = require('path'), fs = require('fs'), http = require('http');
const { pathToFileURL } = require('url');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

const DIST = path.join(__dirname, '..', '..', 'dist');   // ⚠️ JAMAIS un chemin absolu (§6.1)
const PORT = 4543;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.zip':'application/zip', '.webmanifest':'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'sophie@exemple.fr' } };

async function partieModule() {
  console.log('── LA RÈGLE (src/plantages.js exécuté dans node)');
  const store = {};
  global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  global.window = { dispatchEvent() {}, addEventListener() {} };
  global.CustomEvent = class { constructor(n) { this.type = n; } };
  try { global.navigator = { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/130' }; } catch (_) { Object.defineProperty(global, 'navigator', { value: { userAgent: 'Mozilla/5.0 (Macintosh) Chrome/130' }, configurable: true }); }
  const m = await import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'plantages.js')).href);
  const err = new Error("Cannot read properties of undefined (reading 'title') — julien@exemple.fr tx 22155558568 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk");
  err.stack = `Error: ${err.message}\n    at Xc (https://vrm.center/assets/index-B3kf9a.js?v=secret&token=abc:1:234567)\n    at Yd (https://vrm.center/assets/index-B3kf9a.js:1:99)`;
  const e = m.noterPlantage(err, { ecran: 'achats', version: '2026-10-04T10:00:00Z' });
  const tout = JSON.stringify(e || {});
  dit(!!e, 'une vraie erreur est notée');
  dit(!/julien@exemple\.fr/.test(tout), 'aucune adresse email ne part', tout.slice(0, 120));
  dit(!/22155558568/.test(tout), 'aucun n° de transaction ne part');
  dit(!/eyJhbGci/.test(tout), 'aucun jeton ne part');
  dit(!/secret|token=abc/.test(tout), 'aucun paramètre d\'adresse ne part');
  dit(e && /reading 'title'/.test(e.message), 'le message reste lisible (on sait QUOI corriger)', e && e.message);
  dit(e && e.ecran === 'achats', 'l\'écran est noté');
  dit(m.noterPlantage(err, { ecran: 'achats' }) === null, 'la même erreur ne repart pas dans l\'heure');
  for (const bruit of ['Failed to fetch', 'ResizeObserver loop completed with undelivered notifications.', 'Load failed']) {
    dit(m.noterPlantage(new Error(bruit)) === null, `le bruit n'est pas noté : « ${bruit} »`);
  }
  const ext = new Error('boom'); ext.stack = 'Error: boom\n    at chrome-extension://abcdef/content.js:1:2';
  dit(m.noterPlantage(ext) === null, 'une erreur venue d\'une extension n\'est pas notée');
  // ⚠️ Revue adverse : une extension qui enveloppe setTimeout apparaît PLUS BAS
  //    dans la pile d'une vraie erreur de l'app — elle ne doit pas la cacher.
  const app = new Error("Cannot read properties of undefined (reading 'numero')");
  app.stack = `TypeError: ${app.message}\n    at Xc (https://vrm.center/assets/App-abc.js:1:2345)\n    at chrome-extension://abcdef/inject.js:3:4`;
  dit(m.noterPlantage(app) !== null, 'une erreur de l\'APP reste notée même si une extension est plus bas dans la pile');
  // ⚠️ Et les formes de données que la première version laissait passer.
  const fuites = ["reading 'julatace3535'", 'Tel 06 12 34 56 78', 'Prix 149,99 €', 'refresh_token=QWERTYUIOPASDFGHJ', '75f6c9fa-dc8e-4e52-a000-e09dd4084b3e', 'julien.fournier3535%40gmail.com'];
  const sorties = fuites.map((t) => m.nettoyer(t));
  dit(!/julatace3535|06 12 34|149,99|QWERTYUIOP|75f6c9fa|fournier3535/.test(sorties.join(' ')), 'login, téléphone, prix, jeton, UUID, adresse encodée : tous retirés', sorties.join(' · '));
  dit(m.nettoyer("reading 'title'") === "reading 'title'", 'un nom de propriété du code reste lisible');
  // Même erreur, autre déploiement (fonction minifiée renommée) : MÊME ligne.
  const d1 = new Error('Erreur stable de banc'); d1.stack = 'Error\n    at Ab (https://vrm.center/assets/index-AAA.js:1:100)';
  const d2 = new Error('Erreur stable de banc'); d2.stack = 'Error\n    at Zq (https://vrm.center/assets/index-BBB.js:1:999)';
  const e1 = m.noterPlantage(d1);
  dit(e1 && m.noterPlantage(d2) === null, 'la même erreur après un nouveau déploiement garde la même empreinte (une ligne, pas une par déploiement)');
  let n = JSON.parse(store.vrm_plantages_attente || '[]').length;
  for (let i = 0; i < 15; i++) { const x = new Error('erreur distincte ' + i + ' a'); x.stack = 'Error\n at f' + i + ' (https://vrm.center/assets/a.js:1:1)'; if (m.noterPlantage(x)) n++; }
  dit(n === 10, 'dix par ouverture au plus', `${n}`);
  const enFile = JSON.parse(store.vrm_plantages_attente || '[]').length;
  dit(enFile === 10, 'la file garde les dix', `${enFile}`);
  let essais = 0;
  const partis = await m.viderPlantages(async () => { essais++; return essais % 2 === 0; });
  const restent = JSON.parse(store.vrm_plantages_attente || '[]').length;
  dit(partis === 5 && restent === 5, 'une écriture non confirmée RESTE en file', `partis=${partis} restent=${restent}`);
  const partis2 = await m.viderPlantages(async () => true);
  dit(partis2 === 5 && JSON.parse(store.vrm_plantages_attente || '[]').length === 0, 'et repart au passage suivant');
  // ⚠️ Un plantage noté PENDANT l'envoi n'est pas écrasé par la fin du vidage.
  store.vrm_plantages_attente = JSON.stringify([{ id: 'aaa', at: 't1', message: 'x' }]);
  const pendant = m.viderPlantages(async () => { const f = JSON.parse(store.vrm_plantages_attente); f.push({ id: 'bbb', at: 't2', message: 'y' }); store.vrm_plantages_attente = JSON.stringify(f); return true; });
  await pendant;
  const reste = JSON.parse(store.vrm_plantages_attente || '[]').map((e) => e.id);
  dit(reste.length === 1 && reste[0] === 'bbb', 'un plantage noté pendant l\'envoi reste en file', JSON.stringify(reste));
}

async function partieRendu() {
  console.log('\n── DANS L\'APP RENDUE');
  const srv = http.createServer((q, r) => {
    let f = q.url.split('?')[0];
    if (f === '/' || !path.extname(f)) f = '/index.html';
    const p = path.join(DIST, f);
    if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    r.end(fs.readFileSync(p));
  });
  await new Promise((res, rej) => { srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul.`) : e)); srv.listen(PORT, res); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const rendre = async (lignes) => {
    const ctx = await nav.newContext({ viewport: { width: 1512, height: 1100 } });
    const pg = await ctx.newPage();
    await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
    await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
    const ecrits = [];
    await pg.route('**/rest/v1/**', (r) => {
      const req = r.request();
      const u = metaVersData(req.url());
      if (req.method() === 'POST' && /app_data/.test(u)) {
        try { for (const l of JSON.parse(req.postData() || '[]')) if (l && /^plantage_/.test(l.id)) ecrits.push(l); } catch (_) {}
        return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
      }
      if (/id=like\.plantage_/.test(u)) {
        if (lignes === null) return r.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lignes) });
      }
      if (/select=owner/.test(u) || /select=id&limit=1/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
    });
    await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await pg.route('**://*.vinted.net/**', (r) => r.abort());
    await pg.route('**://*.vinted.com/**', (r) => r.abort());
    await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3500);
    // Une VRAIE erreur de la page, levée hors de React (un gestionnaire qui casse).
    await pg.evaluate(() => { setTimeout(() => { throw new Error('plantage de banc pour sophie@exemple.fr tx 98765432100'); }, 0); });
    await pg.waitForTimeout(4500);
    const bloc = await pg.evaluate(() => { const el = document.querySelector('[data-plantages]'); return el ? el.innerText.replace(/\s+/g, ' ') : null; });
    await ctx.close();
    return { ecrits, bloc };
  };
  const recent = new Date(Date.now() - 2 * 3600e3).toISOString();
  const vieux = new Date(Date.now() - 20 * 864e5).toISOString();
  const avec = await rendre([{ id: 'plantage_abc', message: "Cannot access 'Xc' before initialization", at: recent, ecran: 'achats' },
    { id: 'plantage_old', message: 'vieille erreur', at: vieux, ecran: 'colis' }]);
  dit(avec.ecrits.length >= 1, 'une erreur de la page part dans la base', `${avec.ecrits.length} ligne(s)`);
  const l = avec.ecrits[0] || {};
  dit(l.owner === SESSION.user.id, 'AU NOM du vendeur connecté (RLS)', String(l.owner));
  dit(!/sophie@exemple\.fr|98765432100/.test(JSON.stringify(l)), 'nettoyée : ni email ni n° de transaction');
  dit(/plantage de banc/.test(String((l.data || {}).message)), 'le message reste lisible');
  dit(!!avec.bloc && /\b1\b/.test(avec.bloc) && /before initialization/.test(avec.bloc), 'Réglages montre l\'erreur récente (une seule : la vieille ne compte pas)', avec.bloc || '(absent)');
  const rien = await rendre([]);
  dit(rien.bloc === null, 'aucune erreur ⇒ aucune ligne (pas de bruit permanent)');
  const panne = await rendre(null);
  dit(panne.bloc === null, 'lecture ratée ⇒ aucune alerte inventée');
  await nav.close(); srv.close();
}

(async () => {
  try { await partieModule(); } catch (e) { ko++; console.log('❌ la règle a levé — ' + (e && e.message)); }
  try { await partieRendu(); } catch (e) { ko++; console.log('❌ le rendu a levé — ' + (e && e.message)); }
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge.' : '✅ Les plantages sont notés, nettoyés, au nom du vendeur.'}`);
  process.exit(ko ? 1 : 0);
})();
