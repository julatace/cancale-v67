// ════════════════════════════════════════════════════════════════════════════
//  GARDE « ON NE CALCULE QUE CE QUE L'ÉCRAN MONTRÉ LIT » (24 nov., `claude/vitesse-ecran-montre`).
//  Récit : docs/passation/2026-11-24-vitesse-ecran-montre.md.
//
//    node scripts/bancs/calculs-ecran-montre.cjs <dist> [port]
//
//  Chaque écran monte 1 à 3 `Comptabilite` (Ventes : sa liste + la section Colis ; Achats : sa liste, ses outils de
//  retrait, la section Colis). Avant, CHACUNE recalculait tous les gros calculs, ceux d'un autre écran compris (les colis à
//  retirer sur Annonces, les retours sur Achats, les envoyés dans la section d'Achats). Les gros calculs comptent ce qu'ils
//  font, par instance (`window.__vrmCalculs[nom][instance]`, src/calculParesseux.js). Le banc ouvre l'app (Ma journée), puis
//  touche chaque onglet du bas UNE fois (sa 1re visite) et juge :
//    1. INTERDIT : un calcul fait par une instance qui ne le lit pas (table `INTERDIT`) ⇒ rouge ;
//    2. ATTENDU : chaque calcul reste fait là où il est lu (table `ATTENDU`) ⇒ sinon rouge (une garde qui ne voit rien
//       ne prouve rien : un compteur absent est rouge) ;
//    3. LES PUBLICATIONS (§5, un seul propriétaire) sont toujours posées par leur écran : `vrm_colis_retirer`,
//       `vrm_colis_aposter`, `widget_stats`, `vrm_atelier_achats`, `vinted_nums_physiques`.
//  Rouge sur le code d'avant (aucun compteur) et par mutation (`useMemoParesseux` rendu immédiat : le récit dit comment).
//  iPhone 390 tactile, base inventée (`_base-volume`, rien de réel), sans ralentissement (on compte, on ne chronomètre pas).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, comptes: 7, ventes: 1500, achats: 800, annonces: 1200 });
const DIST = path.resolve(process.argv[2] || path.join(RACINE, 'dist'));
const PORT = +(process.argv[3] || process.env.BANC_PORT || 21000 + Math.floor(Math.random() * 8000));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp' };
const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGOs6FnAQApgIkn1qIZRDUNKAwA3KwHEWgvY/wAAAABJRU5ErkJggg==', 'base64');
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': /^\/assets\//.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache' }); r.end(fs.readFileSync(p));
}).listen(PORT);
const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
const CLE = (id) => (id === 'annonces' ? 'paires' : id);
const ONGLETS = ['annonces', 'ventes', 'achats', 'compta', 'journee'];

// Instance (`ecranCalcul` : `only`, `:colisDans`, `:outils`) → calculs qu'elle ne doit PAS faire à la 1re visite.
const INTERDIT = {
  annonces: ['pickupUnion', 'groupesRelais', 'cartesColis', 'listeEnvoyes', 'achatsPourAtelier', 'parPoint', 'chRet'],
  ventes: ['pickupUnion', 'groupesRelais', 'cartesColis', 'achatsPourAtelier', 'parPoint', 'chRet'],
  'bordereaux:ventes': ['pickupUnion', 'groupesRelais', 'achatsPourAtelier', 'parPoint', 'chRet'],
  achats: ['cartesColis', 'listeEnvoyes', 'retoursEnCours'],
  'achats:outils': ['cartesColis', 'listeEnvoyes', 'retoursEnCours', 'achatsPourAtelier'],
  'bordereaux:achats': ['listeEnvoyes', 'achatsPourAtelier'],
};
// Onglet → calculs qui DOIVENT rester faits pendant sa 1re visite (là où ils sont lus), par instance.
const ATTENDU = {
  annonces: { retoursEnCours: ['annonces'] },
  ventes: { cartesColis: ['bordereaux:ventes'], listeEnvoyes: ['bordereaux:ventes'] },
  achats: { pickupUnion: ['achats', 'bordereaux:achats'], cartesColis: ['bordereaux:achats'], achatsPourAtelier: ['achats'], parPoint: ['bordereaux:achats'] },
};

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + PORT] });
  const fautes = [], erreurs = [], vus = {}, ecrits = new Set();
  try {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', serviceWorkers: 'block',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' });
    await ctx.addInitScript(() => {
      try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); } catch (_) {}
      window.__pret = null;
      const v = () => { const e = [...document.querySelectorAll('[data-attente-ecran="journee"][data-attente="pret"]')].find((x) => x.getClientRects().length && x.getBoundingClientRect().height > 50);
        if (e && !document.getElementById('vrm-demarrage')) { window.__pret = performance.now(); return; } requestAnimationFrame(v); };
      requestAnimationFrame(v);
    });
    await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
    await ctx.route(/^https:\/\/images\d*\.vinted\.net\//i, (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PHOTO }).catch(() => {}));
    await ctx.route('**/rest/v1/**', async (route) => { const rq = route.request();
      if (rq.method() !== 'GET') { try { const b = JSON.parse(rq.postData() || 'null'); for (const x of [].concat(b || [])) if (x && x.id) ecrits.add(String(x.id)); } catch (_) {}
        return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }).catch(() => {}); }
      const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
      return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }).catch(() => {}); });
    await ctx.route('**/api/**', (r) => { const u = r.request().url();
      const corps = /mode=equipe/.test(u) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true } : /mode=abonnement/.test(u) ? { ok: true, acces: true, statut: 'active', configure: true } : { pret: true, devices: 1 };
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) }).catch(() => {}); });
    const pg = await ctx.newPage(); pg.on('pageerror', (e) => erreurs.push(e.message.slice(0, 200)));
    const calme = (sans = 1500, max = 30000) => pg.evaluate(([sans, max]) => new Promise((ok) => { let der = performance.now(); try { new PerformanceObserver((l) => { if (l.getEntries().length) der = performance.now(); }).observe({ type: 'longtask' }); } catch (_) {} const t0 = performance.now(); const iv = setInterval(() => { if (performance.now() - der > sans || performance.now() - t0 > max) { clearInterval(iv); ok(); } }, 100); }), [sans, max]).catch(() => {});
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit', timeout: 120000 });
    await pg.waitForFunction(() => window.__pret != null, null, { timeout: 120000, polling: 200 }).catch(() => fautes.push('Ma journée jamais prête'));
    await calme(2500, 60000);
    for (const o of ONGLETS) {
      await pg.evaluate((pile) => { window.__vrmCalculs = {}; window.__vrmPiles = []; window.__vrmCalculsPile = pile; }, !!process.env.PILE);
      await pg.locator(`[data-n-onglet="${CLE(o)}"]`).first().tap({ timeout: 30000 }).catch(() => fautes.push(`onglet ${o} introuvable`));
      await pg.waitForFunction((id) => { const m = document.querySelector('#root .vrm-main'); return !!m && [...m.querySelectorAll('[data-attente="pret"],[data-attente="plafond"]')].some((x) => x.getClientRects().length && !x.closest('[data-copie-ecran],[hidden]')); }, o, { timeout: 60000, polling: 200 }).catch(() => fautes.push(`${o} : écran jamais prêt`));
      await calme(2000, 40000);
      const C = await pg.evaluate(() => window.__vrmCalculs || null);
      vus[o] = C;
      console.log(`  ${o.padEnd(9)} ${JSON.stringify(C)}`);
      if (process.env.PILE) for (const x of await pg.evaluate(() => window.__vrmPiles || [])) console.log('      ' + x.join(' · ').replace(/http:\/\/localhost:\d+\/assets\//g, '').slice(0, 700));   // QUI l'a lu (build non minifié)
      if (!C) { fautes.push(`${o} : aucun compteur (src/calculParesseux.js absent ?)`); continue; }
      for (const [nom, parInstance] of Object.entries(C)) for (const [inst, n] of Object.entries(parInstance || {})) {
        if ((INTERDIT[inst] || []).includes(nom) && n > 0) fautes.push(`${o} : « ${nom} » calculé ${n} fois par l'instance « ${inst} », qui ne le lit pas`);
      }
      for (const [nom, insts] of Object.entries(ATTENDU[o] || {})) for (const inst of insts) {
        if (!((C[nom] || {})[inst] > 0)) fautes.push(`${o} : « ${nom} » n'est plus calculé par « ${inst} », qui le lit (compteur absent ou nul)`);
      }
    }
    await pg.screenshot({ path: path.join(require('os').tmpdir(), 'calculs-ecran-montre.png') }).catch(() => {});
    // Les publications d'un seul propriétaire, toujours posées après le parcours.
    const pubs = await pg.evaluate(() => { const L = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
      return { vrm_colis_retirer: L('vrm_colis_retirer'), vrm_colis_aposter: L('vrm_colis_aposter'), vrm_atelier_achats: L('vrm_atelier_achats'), vinted_nums_physiques: L('vinted_nums_physiques') }; });
    for (const [k, v] of Object.entries(pubs)) {
      const ok = v != null && (k !== 'vrm_colis_retirer' || Number.isFinite(v.total)) && (k !== 'vrm_colis_aposter' || Number.isFinite(v.total)) && (k !== 'vrm_atelier_achats' || Array.isArray(v.l)) && (k !== 'vinted_nums_physiques' || Array.isArray(v.nums));
      console.log(`  publication ${k} : ${ok ? 'posée' : 'ABSENTE'}`);
      if (!ok) fautes.push(`publication ${k} absente après le parcours`);
    }
    // `widget_stats` est écrit dans la base par la coque (src/App.jsx), pas rangé sur l'appareil.
    console.log(`  publication widget_stats : ${ecrits.has('widget_stats') ? 'écrite' : 'ABSENTE'}`);
    if (!ecrits.has('widget_stats')) fautes.push('publication widget_stats jamais écrite');
    await ctx.close();
  } finally { await nav.close(); srv.close(); }
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(vus, null, 1));
  if (erreurs.length) fautes.push(`erreurs de page : ${[...new Set(erreurs)].slice(0, 3).join(' | ')}`);
  if (fautes.length) { console.log('❌ calculs-ecran-montre :\n   - ' + fautes.join('\n   - ')); process.exitCode = 1; }
  else console.log('✅ calculs-ecran-montre : chaque gros calcul est fait par l\'écran qui le lit, et seulement lui ; publications posées');
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exitCode = 1; srv.close(); });
