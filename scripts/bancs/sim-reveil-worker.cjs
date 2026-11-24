require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  LE SERVICE WORKER REVIENT-IL ? (24 nov., simulation de #1348)
//  Chrome arrête le service worker d'une extension MV3 après ~30 s sans évènement, puis le relance au suivant (alarme,
//  message, onglet). Un fond qui lève une erreur à sa RE-évaluation ne revient jamais : l'extension est morte jusqu'au ⟳.
//  Ici : la vraie extension chargée, son worker arrêté de force (CDP `ServiceWorker.stopAllWorkers`), puis une page
//  vinted.fr ouverte (scripts de contenu ⇒ messages au fond) : le worker doit revenir, `authToken` défini.
//  `BANC_EXT=<dossier>`. Rien ne sort (DNS de Chromium redirigé vers nulle part).
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const pw = require('playwright');
const EXT0 = path.resolve(process.env.BANC_EXT || path.join(__dirname, '..', '..', 'vinted-sync-extension'));
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0;
const dit = (b, q, d) => { if (b) { ok++; console.log('  ✅ ' + q); } else { ko++; console.log('  ❌ ' + q + (d ? ' — ' + String(d).slice(0, 600) : '')); } };
(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-reveil-'));
  const EXT = path.join(TMP, 'ext'); fs.cpSync(EXT0, EXT, { recursive: true });
  const ID = crypto.createHash('sha256').update(path.resolve(EXT)).digest('hex').slice(0, 32).split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
  const version = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const ctx = await pw.chromium.launchPersistentContext(path.join(TMP, 'p'), { executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND', '--enable-unsafe-extension-debugging', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const erreurs = [];
  const vivant = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { for (const s of ctx.serviceWorkers().filter((x) => x.url().startsWith(`chrome-extension://${ID}/`))) { const v = await Promise.race([s.evaluate(() => typeof authToken === 'function').catch(() => false), attendre(1500).then(() => false)]); if (v) return s; } await attendre(300); } return null; };
  try {
    console.log(`extension ${version}`);
    const w = await vivant(20000);
    dit(!!w, 'le worker démarre');
    const espion = async (sw) => sw && sw.evaluate(() => { if (self.__espion) return; self.__espion = 1; const noter = (k, m) => chrome.storage.local.get('__erreursBanc').then((x) => chrome.storage.local.set({ __erreursBanc: [...((x && x.__erreursBanc) || []), k + ' ' + String(m).slice(0, 400)].slice(-30) })).catch(() => {}); self.addEventListener('error', (e) => noter('error', (e.message || '') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno)); self.addEventListener('unhandledrejection', (e) => noter('rejet', e.reason && (e.reason.stack || e.reason.message) || e.reason)); }).catch(() => {});
    await espion(w);
    const cdp = await ctx.browser() ? null : null; void cdp;
    const pg = await ctx.newPage();
    const s = await ctx.newCDPSession(pg);
    for (let tour = 1; tour <= 3; tour++) {
      await s.send('ServiceWorker.enable').catch(() => {});
      const err = []; s.on('ServiceWorker.workerErrorReported', (e) => err.push(e.errorMessage && e.errorMessage.errorMessage));
      await s.send('ServiceWorker.stopAllWorkers').catch((e) => console.log('  ·  stopAllWorkers : ' + e.message));
      await attendre(1500);
      // Un évènement pour le fond : une page vinted.fr (ses scripts de contenu écrivent au fond dès le chargement).
      await pg.goto('https://www.vinted.fr/inbox', { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
      const w2 = await vivant(25000);
      await espion(w2);
      dit(!!w2, `tour ${tour} : arrêté par Chrome, le worker REVIENT au premier évènement`, err.filter(Boolean).join(' | ') || '(aucune erreur rapportée)');
      if (err.length) { erreurs.push(...err); }
      if (!w2) break;
    }
    { const sw3 = await vivant(5000); const e3 = sw3 ? await sw3.evaluate(async () => (await chrome.storage.local.get('__erreursBanc')).__erreursBanc || []).catch((e) => ['lecture: ' + e.message]) : ['(aucun worker pour lire)']; console.log('  ·  erreurs notées dans le worker : ' + JSON.stringify(e3).slice(0, 1500)); }
    if (erreurs.length) console.log('  ·  erreurs du worker : ' + [...new Set(erreurs)].slice(0, 5).join(' | '));
  } catch (e) { dit(false, 'a levé', e && e.stack); }
  finally { await ctx.close().catch(() => {}); fs.rmSync(TMP, { recursive: true, force: true }); console.log(`\n${ko ? '❌' : '✅'} sim-reveil-worker ${version} : ${ok} vert(s), ${ko} rouge(s)`); process.exit(ko ? 1 : 0); }
})();
