// ════════════════════════════════════════════════════════════════════════════
//  Banc « une vente arrive : on ne relit QUE son compte » (12 nov.)
//  node scripts/bancs/ventes-relecture-compte.cjs [dist] [port]
//
//  Mesuré au banc temps-reel (1512) : après une vente écrite par l'extension,
//  Ventes relisait les ventes de TOUS les comptes (~1,2 Mo) au lieu du seul
//  compte touché. Cause : `relire(uid)` oubliait la ligne du compte touché puis
//  relançait `loadOrders('sold')`, qui redemande CHAQUE compte ; passé la minute
//  de mémoire des lignes (`ROW_TTL_MS`), tous repartaient sur le réseau — et
//  Ventes monte deux moteurs (la liste et « À expédier »), chacun le faisait.
//
//  Scénario (base inventée `_base-volume`, aucune donnée réelle) : Ventes ouverte,
//  le montage fini, on laisse passer 65 s (la mémoire des lignes expire, comme
//  quand une vente arrive des minutes après l'ouverture), puis « l'extension »
//  écrit une vente neuve sur UN compte et le signale (`vrm:ext`, ce que fait le
//  pont de l'extension de CE navigateur). On juge :
//   V  la vente neuve est à l'écran (sans recharger) ;
//   B  entre le signal et l'écran, les lectures LOURDES (commandes, annonces,
//      messages) ne portent que les lignes du compte touché ;
//   O  les ventes des AUTRES comptes restent à l'écran (rien perdu).
//  Deux passes : 1512 clair, 390 tactile sombre. Un banc ne meurt pas, il rapporte.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const DIST = process.argv[2] || process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = +(process.argv[3] || process.env.BANC_PORT || 9655);
const SHOTS = process.env.SHOTS || '';
const ATTENTE_MEMOIRE = Number(process.env.BANC_ATTENTE_MS || 65000);
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream'; const b = fs.readFileSync(p);
  if (/javascript|css|html|json|svg/.test(t)) { r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(zlib.gzipSync(b)); }
  else { r.writeHead(200, { 'content-type': t }); r.end(b); }
});
srv.on('error', (e) => { console.log('✗ ROUGE le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let verts = 0, rouges = 0;
const juge = (ok, nom, detail = '') => { if (ok) verts++; else rouges++; console.log(`${ok ? '✓' : '✗ ROUGE'} ${nom}${detail ? ' — ' + detail : ''}`); };
const dec = (u) => { try { return decodeURIComponent(u); } catch (_) { return u; } };
// Une lecture LOURDE : une ligne de commandes / annonces / messages dont on ramène le contenu.
const LOURDE = /harvest_(\d+|\*)_(orders_(sold|purchased|\*)|orders\*|listings|inbox)\b/;
const estLourde = (u) => { const d = dec(u); const [a, s = ''] = d.split('&select='); return LOURDE.test(a) && /payload|data(,|$)|^data/.test(s); };
const idsDe = (u) => { const d = dec(u); const m = /[?&]id=in\.\(([^)]*)\)/.exec(d); if (m) return m[1].split(','); const e = /[?&]id=(?:eq|like)\.([^&]+)/.exec(d); return e ? [e[1]] : ['*']; };

async function passe(b, { nom, largeur, hauteur, mobile, sombre }) {
  const base = fabriquer({ volumeReel: true });
  const UID = base.accounts[0].vinted_user_id;
  const autreUid = base.accounts[1].vinted_user_id;
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: largeur, height: hauteur }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light' });
  await ctx.addInitScript((sombre) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {}
  }, !!sombre);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const reqs = [];
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request(); const rec = { t: Date.now(), m: rq.method(), u: rq.url(), o: 0 };
    reqs.push(rec);
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
    const body = JSON.stringify(rep.body); rec.o = Buffer.byteLength(body);
    await attendre(20);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'commit' });
  // Le montage fini : plus aucune lecture pendant 3 s.
  const fin = Date.now() + 90000;
  await pg.waitForSelector('.vrm-main', { timeout: 60000 }).catch(() => {});
  let n = reqs.length, calme = Date.now();
  while (Date.now() - calme < 3000 && Date.now() < fin) { await attendre(250); if (reqs.length !== n) { n = reqs.length; calme = Date.now(); } }
  const texte = () => pg.evaluate(() => document.body.innerText || '');
  // Un titre d'un AUTRE compte, visible avant (preuve O).
  const rowAutre = base.rows.find((r) => r.id === `harvest_${autreUid}_orders_sold`);
  const titresAutre = (rowAutre.data.payload.my_orders || []).slice(0, 40).map((o) => o.title);
  const avant = await texte();
  const autreVu = titresAutre.find((t) => avant.includes(t)) || null;
  // La mémoire des lignes expire (une vente arrive des minutes après l'ouverture).
  await pg.waitForTimeout(ATTENTE_MEMOIRE);
  const TITRE = `Vente NEUVE ${nom} 4343`;
  juge(!(await texte()).includes(TITRE), `[${nom}] V la vente n'est pas là avant l'écriture`);
  const row = base.rows.find((r) => r.id === `harvest_${UID}_orders_sold`);
  const now = new Date().toISOString();
  const v0 = row.data.payload.my_orders[0];
  row.data = { ...row.data, capturedAt: now, nItems: (row.data.nItems || 0) + 1, payload: { ...row.data.payload, my_orders: [{ ...v0, transaction_id: 22099999911, item_id: 7099999911, title: TITRE, date: now, status: 'Le paiement a été validé' }, ...row.data.payload.my_orders] } };
  row.updated_at = now;
  const t1 = Date.now();
  await pg.evaluate((uid) => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'ventes', uid } })), UID);
  let ms = null;
  while (Date.now() - t1 < 30000) { if ((await texte()).includes(TITRE)) { ms = Date.now() - t1; break; } await attendre(250); }
  await pg.waitForTimeout(2500);   // ce qui part encore juste après
  juge(ms != null, `[${nom}] V la vente neuve est à l'écran sans recharger`, ms != null ? `${(ms / 1000).toFixed(1)} s` : 'jamais (30 s)');
  const apres = reqs.filter((r) => r.m === 'GET' && r.t >= t1);
  const lourdes = apres.filter((r) => estLourde(r.u));
  const ids = [...new Set(lourdes.flatMap((r) => idsDe(r.u)))];
  const Ko = Math.round(apres.reduce((a, r) => a + r.o, 0) / 1024), lourdesKo = Math.round(lourdes.reduce((a, r) => a + r.o, 0) / 1024);
  juge(lourdes.length > 0 && ids.every((i) => i.includes(UID)), `[${nom}] B seules les lignes du compte touché sont relues`, `${lourdes.length} lecture(s) lourde(s) : ${ids.map((i) => i.replace(/^harvest_/, '')).join(', ')} · ${lourdesKo} Ko lourds, ${apres.length} lectures, ${Ko} Ko en tout`);
  const unSeul = lourdes.filter((r) => /orders/.test(dec(r.u))).length;
  juge(unSeul <= 1, `[${nom}] B une seule relecture des commandes du compte (pas une par écran monté)`, `${unSeul}`);
  if (autreVu) juge((await texte()).includes(autreVu), `[${nom}] O les ventes des autres comptes restent à l'écran`, autreVu);
  else juge(true, `[${nom}] O (aucune vente d'un autre compte n'était visible avant : rien à juger)`);
  juge(errs.length === 0, `[${nom}] aucune erreur`, errs.slice(0, 2).join(' | '));
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `ventes-relecture-${nom}.png`) }); }
  console.log(`  [${nom}] mesure : ${apres.length} lectures, ${Ko} Ko après le signal (lourdes : ${lourdesKo} Ko)`);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    const passes = (process.env.PASSES || '1512c,390s').split(',');
    for (const p of passes) {
      try {
        if (p === '1512c') await passe(b, { nom: '1512-clair', largeur: 1512, hauteur: 982, mobile: false, sombre: false });
        if (p === '390s') await passe(b, { nom: '390-sombre', largeur: 390, hauteur: 844, mobile: true, sombre: true });
      } catch (e) { juge(false, `[${p}] le banc a pu s'exécuter`, String(e && e.message).split('\n')[0].slice(0, 200)); }
    }
  } finally { await b.close(); srv.close(); }
  console.log(rouges ? `\n✗ ${rouges} rouge(s), ${verts} vert(s)` : `\n✓ une vente arrive, son compte seul relu : ${verts} verts`);
  process.exit(rouges ? 1 : 0);
})();
