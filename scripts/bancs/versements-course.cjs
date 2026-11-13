// ════════════════════════════════════════════════════════════════════════════
//  Banc « une date de versement connue ne redevient jamais vide » (13 nov., source unique)
//  node scripts/bancs/versements-course.cjs [dist] [port]     PASSES=5 (défaut)
//
//  Mesuré : le relevé des ventes publié par l'écran (`vrm_stats_ventes`, [9] = la date de
//  VERSEMENT, celle du CA déclaré, §5) perdait la date d'une vente d'une ouverture d'écran à
//  l'autre (chiffres-volume, même build : tantôt la date, tantôt « »). La course : les ventes
//  arrivent, l'écran publie avec les dates EN COURS de lecture (« »), puis les dates arrivent
//  dans la demi-seconde où cette sauvegarde attend ; l'écran compare au navigateur pas encore
//  réécrit (qui porte encore la date) ⇒ « identique », rien n'est republié ⇒ « » l'emporte.
//
//  Scénario (base inventée `_base-volume`, aucune donnée réelle), même onglet :
//   1. Ma journée s'ouvre normalement : le relevé est publié AVEC ses dates (référence) ;
//   2. Ventes s'ouvre : les lectures des dates de versement (famille `harvest_%_txn_%`) sont
//      TENUES par le banc (§6.5 : une requête tenue, jamais un délai fixe) jusqu'à ce que les
//      ventes soient à l'écran, puis rendues ;
//   3. Achats s'ouvre : les lectures des dates RATENT (500) — « pas su ».
//  On juge après chaque étape : chaque vente finalisée publiée porte la date de SA transaction
//  450 (aucune date connue n'est devenue « »). PASSES passes, toutes identiques.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
let chromium;
try { ({ chromium } = require(path.join(RACINE, 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const DIST = process.argv[2] || process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = +(process.argv[3] || process.env.BANC_PORT || 9731);
const PASSES = Number(process.env.PASSES || 5);
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
// Une lecture des dates de versement : la famille des transactions (scalaires `meta`), toutes formes
// (compte, lignes écrites depuis, famille entière) — pas les lectures `id=in.(…)` d'un lot de transactions.
const lectureDates = (u) => { const d = dec(u); return /id=like\.harvest_%_txn_%/.test(d) && !/country_code/.test(d); };

async function passe(b, k) {
  const base = fabriquer({ volumeReel: true });
  // La vérité : la date 450 de chaque transaction de la base.
  const dates = new Map();
  for (const r of base.rows) {
    const t = r.data && r.data.payload && r.data.payload.transaction;
    if (/_txn_\d+$/.test(r.id) && t && t.status === 450 && t.status_updated_at) dates.set(String(t.id), t.status_updated_at);
  }
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1512, height: 982 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); } catch (_) {} });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const t0 = Date.now(); if (process.env.BANC_DETAIL) pg.on('console', (m) => { if (/VRMDBG/.test(m.text())) console.log('   ', Date.now() - t0, m.text()); });
  const etat = { mode: 'normal', tenues: [], liberer: null, signal: null };
  let n = 0;
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', async (route) => {
    n++;
    const rq = route.request();
    if (process.env.BANC_DETAIL === '2' && etat.mode === 'tenir') console.log('    ', Date.now() - t0, rq.method(), dec(rq.url()).replace(/^.*\/rest\/v1\//, '').slice(0, 120));
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    // Le signal : l'app lit les bordereaux captés de chaque compte (`harvest_{uid}_label_%`) — ce qu'elle fait
    // dans l'effet même où les ventes viennent d'arriver (et où le relevé est publié).
    if (etat.mode === 'tenir' && etat.signal && /id=like\.harvest_\d+_label_%/.test(dec(rq.url()))) etat.signal();
    if (lectureDates(rq.url())) {
      if (etat.mode === 'ko') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"panne simulée"}' });
      if (etat.mode === 'tenir') { etat.tenues.push(rq.url()); await etat.liberer; }
    }
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const calme = async () => { const fin = Date.now() + 90000; let m = n, t = Date.now(); while (Date.now() - t < 4000 && Date.now() < fin) { await attendre(250); if (n !== m) { m = n; t = Date.now(); } } };
  // Les dates publiées : [tx, date] des ventes Vinted finalisées du relevé (sauvegarde faite : 500 ms + marge du calme).
  const publiees = () => pg.evaluate(() => { try { const j = JSON.parse(localStorage.getItem('vrm_stats_ventes') || 'null'); return ((j && j.l) || []).filter((l) => l && l[0] === 'Vinted').map((l) => [String(l[2]), l[9] || '']); } catch (_) { return null; } });
  const verifier = async (etape) => {
    const l = await publiees();
    const attendues = (l || []).filter(([tx]) => dates.has(tx));
    const vides = attendues.filter(([, d]) => !d);
    const fausses = attendues.filter(([tx, d]) => d && d !== dates.get(tx));
    juge(attendues.length > 0 && !vides.length && !fausses.length, `[passe ${k}] ${etape} : chaque vente finalisée publiée porte SA date de versement`,
      `${attendues.length - vides.length - fausses.length}/${attendues.length}${vides.length ? ' · vides : ' + vides.slice(0, 3).map((x) => x[0]).join(', ') : ''}${fausses.length ? ' · fausses : ' + fausses.length : ''}`);
    return (l || []).map((x) => x.join('=')).sort().join(',');
  };
  // 1. Ma journée, normale.
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit' });
  await pg.waitForSelector('.vrm-main', { timeout: 60000 }).catch(() => {});
  await calme();
  await verifier('Ma journée (référence)');
  // 2. Ventes : les dates tenues jusqu'à ce que les ventes soient à l'écran.
  let rendre; etat.liberer = new Promise((r) => { rendre = r; }); etat.mode = 'tenir'; etat.tenues = [];
  await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'commit' });
  // Les dates restent tenues jusqu'à ce que les ventes soient arrivées dans l'écran (la requête-signal), puis
  // sont rendues aussitôt — §6.5 : une requête tenue, jamais un délai fixe.
  let vu = false;
  await new Promise((r) => { etat.signal = () => { vu = true; etat.signal = null; r(); }; setTimeout(r, 60000); });
  const tenues = vu ? etat.tenues.length : 0;
  etat.mode = 'normal'; rendre();
  if (process.env.BANC_DETAIL) console.log('    ', Date.now() - t0, 'dates rendues');
  juge(vu && tenues > 0, `[passe ${k}] Ventes : les dates de versement ont bien été servies APRÈS les ventes`, `${tenues} lecture(s) tenue(s)${vu ? '' : ' — signal jamais vu'}`);
  await calme();
  const s2 = await verifier('Ventes (dates arrivées après les ventes)');
  // 3. Achats : les dates ratent.
  etat.mode = 'ko';
  await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'commit' });
  await pg.waitForSelector('.vrm-main', { timeout: 60000 }).catch(() => {});
  await calme();
  const s3 = await verifier('Achats (dates pas lues)');
  juge(errs.length === 0, `[passe ${k}] aucune erreur`, errs.slice(0, 2).join(' | '));
  await ctx.close();
  return s2 + '|' + s3;
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  const resultats = [];
  try {
    for (let k = 1; k <= PASSES; k++) {
      try { resultats.push(await passe(b, k)); } catch (e) { juge(false, `[passe ${k}] le banc a pu s'exécuter`, String(e && e.message).split('\n')[0].slice(0, 200)); }
    }
  } finally { await b.close(); srv.close(); }
  if (resultats.length > 1) juge(resultats.every((x) => x === resultats[0]), `${resultats.length} passes : relevés publiés identiques`);
  console.log(rouges ? `\n✗ ${rouges} rouge(s), ${verts} vert(s)` : `\n✓ une date de versement connue ne redevient jamais vide : ${verts} verts`);
  process.exit(rouges ? 1 : 0);
})();
