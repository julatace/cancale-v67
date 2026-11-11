require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  PRÉCHARGER L'ÉCRAN LE PLUS PROBABLE (11 nov., lot « chargement léger »,
//  src/prechargeEcrans.js, docs/passation/2026-11-11-chargement-leger.md)
//
//  Base INVENTÉE au volume de la sienne (`_base-volume.cjs`), 390 px tactile,
//  processeur ×4, 4G émulée (le profil « 4g » de chargement.cjs). Ma journée est
//  ouverte à froid :
//   A  appareil qui ouvre souvent Réglages (`vrm_ecrans_frequents` = {reglages: 5}) :
//      A1 le morceau Réglages est téléchargé ;
//      A2 PAS avant que l'écran soit stable (sa requête part après le dernier
//         changement d'attente/squelette de l'ouverture) ;
//      A3 ouvrir Paramètres ensuite : aucune pastille « Ouverture… » ni squelette de
//         morceau, et le morceau n'est pas retéléchargé ;
//      A4 le texte de Ma journée est celui de B (le préchargement ne change rien à l'écran).
//   B  appareil neuf (aucun historique) : aucun morceau d'écran téléchargé en fond.
//   C  « économie de données » (navigator.connection.saveData) avec le même historique
//      que A : rien téléchargé en fond.
//
//  Lancer : npm run build && node scripts/bancs/precharge-ecrans.cjs   (`BANC_PORT`, 11640)
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { fabriquer, repondre } = require('./_base-volume.cjs');
const DIST = process.env.PRECHARGE_DIST ? path.resolve(process.env.PRECHARGE_DIST) : path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 11640;
const UID_BANC = process.env.BANC_SESSION_UID || '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';
const P = { cdp: { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }, rtt: 150, debit: 2e6, max: 90000 };
const base = fabriquer({ volumeReel: true });
const UIDS_LIES = base.accounts.map((a) => String(a.vinted_user_id));
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
const MORCEAUX_ECRANS = /\/assets\/(Reglages|Stats|PrixMarche|Compta|Stock|Leboncoin|Ebay|Vestiaire|Communaute|Operations|BoiteEmails)-[^/]*\.js$/;

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const _gz = new Map();
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const ext = path.extname(p);
  if (/^\.(js|css|html|json|webmanifest|svg)$/.test(ext) && /gzip/.test(q.headers['accept-encoding'] || '')) {
    if (!_gz.has(p)) _gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 9 }));
    const b = _gz.get(p);
    r.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'content-encoding': 'gzip', 'content-length': b.length, 'cache-control': 'no-store' }); return r.end(b);
  }
  r.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(r);
});

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };

// Dans la page : chaque changement d'attente / squelette / pastille, daté (performance.now).
function enregistreur() {
  const R = window.__pre = { dernierChangement: 0, etat: '', pastilles: 0, squelettesApres: 0, apres: false };
  const lire = () => {
    const a = [...document.querySelectorAll('[data-attente]')].map((e) => e.getAttribute('data-attente')).join(',');
    const sq = !!document.querySelector('.vrm-skeleton,[data-squelette],[data-morceau-attente],[data-demarrage-vrm]');
    return a + '|' + sq;
  };
  const tick = () => { const e = lire(); if (e !== R.etat) { R.etat = e; R.dernierChangement = Math.round(performance.now()); } };
  const go = () => {
    tick(); setInterval(tick, 50);
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (R.apres && (n.matches('[data-morceau-attente]') || n.querySelector('[data-morceau-attente]'))) R.pastilles++;
        if (R.apres && (n.matches('.vrm-skeleton,[data-squelette]') || n.querySelector('.vrm-skeleton,[data-squelette]'))) R.squelettesApres++;
      }
      tick();
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-attente'] });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
}

async function ouvrir(b, { frequents = null, saveData = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([qui, uids, freq, eco]) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_comptes_lies', JSON.stringify({ qui, uids })); localStorage.setItem('vinted_dark', 'false');
      if (freq) localStorage.setItem('vrm_ecrans_frequents', JSON.stringify(freq));
      if (eco) Object.defineProperty(navigator, 'connection', { configurable: true, get: () => ({ saveData: true, effectiveType: '4g' }) });
    } catch (_) {}
  }, [UID_BANC, UIDS_LIES, frequents, saveData]);
  await pg.addInitScript(enregistreur);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, async (r) => {
    const t = r.request().resourceType();
    if (t === 'image') { await new Promise((x) => setTimeout(x, P.rtt)); return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PIXEL }).catch(() => {}); }
    return ['media', 'font'].includes(t) ? r.abort() : r.continue();
  });
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', P.cdp);
  const morceaux = [];   // { url, debut } — début en performance.now() de la page
  pg.on('request', (q) => { if (MORCEAUX_ECRANS.test(q.url())) morceaux.push({ url: q.url().replace(/^.*\/assets\//, ''), q }); });
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request(); const url = rq.url();
    try {
      if (rq.method() !== 'GET') { await new Promise((r) => setTimeout(r, P.rtt)); return await route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); }
      const h = await rq.allHeaders();
      const rep = repondre(url, h.range, base);
      const body = JSON.stringify(rep.body);
      await new Promise((r) => setTimeout(r, P.rtt + Math.round(body.length / P.debit * 1000)));
      return await route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body });
    } catch (_) { /* page fermée */ }
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit', timeout: P.max });
  // L'ouverture, puis 20 s de calme (le préchargement attend 3 s d'écran stable + un moment libre).
  await pg.waitForFunction(() => document.querySelector('[data-attente]') && !document.querySelector('[data-attente="attente"],[data-attente="instantane"]'), null, { timeout: P.max });
  await pg.waitForTimeout(20000);
  const etat = await pg.evaluate(() => ({ ...window.__pre, precharges: window.__vrmPrecharges || [], texte: (document.querySelector('main.vrm-main') || document.body).innerText.replace(/il y a \d+\s?\w+/g, '').replace(/\b\d{1,2}:\d{2}\b/g, 'hh:mm') }));
  // les débuts de requête, dans l'horloge de la page
  for (const m of morceaux) { const t = m.q.timing(); m.debut = t && t.startTime >= 0 ? await pg.evaluate((s) => Math.round(s - performance.timeOrigin), t.startTime) : null; }
  return { ctx, pg, errs, etat, morceaux };
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    console.log('── B appareil neuf (aucun historique)');
    const B = await ouvrir(b, {});
    dit(B.morceaux.length === 0, 'B aucun morceau d’écran téléchargé en fond', B.morceaux.map((m) => m.url).join(', '));
    dit(!B.errs.length, 'B aucune erreur de page', B.errs.slice(0, 2).join(' | '));
    await B.ctx.close();

    console.log('── A appareil qui ouvre souvent Réglages');
    const A = await ouvrir(b, { frequents: { reglages: 5 } });
    const reg = A.morceaux.find((m) => /^Reglages-/.test(m.url));
    dit(!!reg, 'A1 le morceau Réglages est téléchargé en fond', A.morceaux.map((m) => m.url).join(', ') || 'aucun');
    dit(!!reg && reg.debut != null && reg.debut >= A.etat.dernierChangement, 'A2 pas avant que l’écran soit stable',
      reg ? `requête à ${reg.debut} ms · dernier changement de l’ouverture à ${A.etat.dernierChangement} ms` : '');
    dit(A.etat.precharges.length === 1 && A.etat.precharges[0].famille === 'reglages', 'A1 une seule famille préchargée (reglages)', JSON.stringify(A.etat.precharges));
    dit(A.etat.texte === B.etat.texte, 'A4 le texte de Ma journée est le même qu’en B', A.etat.texte === B.etat.texte ? '' : `${A.etat.texte.length} / ${B.etat.texte.length} caractères`);
    const avant = A.morceaux.length;
    await A.pg.evaluate(() => { window.__pre.apres = true; window.dispatchEvent(new CustomEvent('vrm:aller', { detail: 'settings' })); });
    await A.pg.waitForTimeout(4000);
    const apres = await A.pg.evaluate(() => ({ pastilles: window.__pre.pastilles, sq: window.__pre.squelettesApres, reglages: !!document.querySelector('[data-garde-ecran="settings"], .vrm-reglages, [data-reglages]') || /Paramètres|Réglages/.test(document.body.innerText) }));
    dit(apres.reglages, 'A3 Paramètres est ouvert');
    dit(apres.pastilles === 0 && apres.sq === 0, 'A3 aucune pastille « Ouverture… » ni squelette de morceau', `pastilles ${apres.pastilles} · squelettes ${apres.sq}`);
    dit(A.morceaux.filter((m) => /^Reglages-/.test(m.url)).length === 1 && A.morceaux.length === avant, 'A3 le morceau n’est pas retéléchargé', A.morceaux.map((m) => m.url).join(', '));
    dit(!A.errs.length, 'A aucune erreur de page', A.errs.slice(0, 2).join(' | '));
    if (process.env.PRECHARGE_SHOT) await A.pg.screenshot({ path: process.env.PRECHARGE_SHOT });
    await A.ctx.close();

    console.log('── C économie de données, même historique que A');
    const Cx = await ouvrir(b, { frequents: { reglages: 5 }, saveData: true });
    dit(Cx.morceaux.length === 0, 'C rien téléchargé en fond', Cx.morceaux.map((m) => m.url).join(', '));
    await Cx.ctx.close();
  } finally { await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} rouge(s)` : '\ntout vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
