// ════════════════════════════════════════════════════════════════════════════
//  BANC « VITESSE COMME JULIEN LA VIT » (24 nov. — Julien : « elle est encore bcp trop lente »).
//  Récit : docs/passation/2026-11-24-vitesse.md.
//
//    node scripts/bancs/vitesse-iphone.cjs <dist> [port]
//      CPU=4 · PASSES=3 · JSON=<fichier> · ETAPES=froid,onglets,vente,defilement,recherche,rechachats · RENDUS=1 (validations React)
//      PROFIL=froid,onglet:achats,vente (profil par fonction ; build non minifié conseillé) · CAPTURES=<dossier>
//    node scripts/bancs/vitesse-iphone.cjs <distA>,<distB>[,…]   ⇒ mode AB : les builds mesurés en alternance, geste par geste
//      (froid et onglets ; TOURS=4), médianes par build — la seule comparaison honnête sur une machine partagée.
//      VOLUME=julien (défaut : 15 comptes, 2 600 ventes, 2 700 achats, 1 100 annonces — compté sur SA base le 24 nov.,
//      lecture seule, nombres seulement) · VOLUME=banc (la base des autres bancs : 7 comptes, 1 500 / 800 / 1 200).
//
//  iPhone simulé (Chromium : Playwright n'émule pas le processeur dans WebKit) 390 × 844 densité 3, tactile, agent Safari
//  iOS, CPU ×4, 4G (150 ms, 9 Mbit/s) pour les fichiers ET la base (inventée, `_base-volume` — rien de réel ; aucune
//  écriture ne sort). Fichiers servis comme Vercel (compressés, /assets immuables), service worker autorisé.
//  Mesuré DANS la page (`performance.now()`, du doigt posé à la première image où la chose est là) :
//    froid      : ouverture d'un appareil neuf jusqu'au premier écran utile (Ma journée prête, vraie), puis rouverte ;
//    onglets    : chaque onglet du bas touché (données déjà là, tours 2 et 3) jusqu'à son écran PRÊT visible ;
//    vente      : une vente touchée dans Ventes jusqu'à son détail visible, puis le retour jusqu'à la liste ;
//    defilement : 6 balayages d'Annonces — intervalle entre images (médiane, 95e centile, pire) ;
//    recherche  : 6 lettres tapées dans la recherche d'Annonces — de la touche à l'image qui suit le rendu.
//  Il RAPPORTE (médianes de PASSES passes) ; il ne juge que l'absence d'erreur de page. Objectifs du chantier
//  (24 nov.) : onglet < 1 s, vente < 300 ms, défilement p95 < 50 ms.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const VOLUMES = {
  julien: { volumeReel: true, qr: true, comptes: 15, ventes: 2600, achats: 2700, annonces: 1100 },
  banc: { volumeReel: true, qr: true, ventes: 1500, achats: 800, annonces: 1200 },
};
const base = fabriquer(VOLUMES[process.env.VOLUME || 'julien']);
const PORT = +(process.argv[3] || process.env.BANC_PORT || 21000 + Math.floor(Math.random() * 8000));
const PASSES = +(process.env.PASSES || 3), CPU = +(process.env.CPU || 4), RTT = 150, DEBIT = 9e6 / 8;
const ETAPES = String(process.env.ETAPES || 'froid,onglets,vente,defilement,recherche').split(',');
const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGOs6FnAQApgIkn1qIZRDUNKAwA3KwHEWgvY/wAAAABJRU5ErkJggg==', 'base64');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp' };
const gz = new Map();
// AB=1 : `<distA>,<distB>,…` — les builds mesurés DANS LE MÊME TEMPS, geste par geste en alternance (A, B, B, A…), pour que
// la charge de la machine (partagée) pèse pareil sur chacun ; médianes par build. Sinon un build.
const DISTS = String(process.argv[2] || path.join(RACINE, 'dist')).split(',').map((d) => path.resolve(d));
const BASE_URL = new Map();   // page → son serveur
function serveur(dist, port) {
  return http.createServer((q, r) => {
    let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
    const p = path.join(dist, f); if (!p.startsWith(dist) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    const t = types[path.extname(p)] || 'application/octet-stream'; const cache = /^\/assets\//.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache';
    if (/javascript|css|html|json|svg/.test(t)) { if (!gz.has(p)) gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 6 })); r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip', 'cache-control': cache }); return r.end(gz.get(p)); }
    r.writeHead(200, { 'content-type': t, 'cache-control': cache }); r.end(fs.readFileSync(p));
  }).listen(port);
}
const SRVS = DISTS.map((d, i) => serveur(d, PORT + i));
const srv = { close: () => SRVS.forEach((x) => x.close()) };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const med = (L) => { const a = L.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };
const centile = (L, p) => { const a = L.slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null; };

async function contexte(nav) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', serviceWorkers: 'allow' });
  await ctx.addInitScript((rendus) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); } catch (_) {}
    window.__tDown = 0; addEventListener('pointerdown', () => { window.__tDown = performance.now(); }, true);
    window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
    window.__pret = null;
    const v = () => { const e = [...document.querySelectorAll('[data-attente-ecran="journee"][data-attente="pret"]')].find((x) => x.getClientRects().length && x.getBoundingClientRect().height > 50);
      if (e && !document.getElementById('vrm-demarrage')) { window.__pret = performance.now(); return; } requestAnimationFrame(v); };
    requestAnimationFrame(v);
    if (rendus) { window.__vrmRendus = { validations: 0 };
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: false, supportsFiber: true, renderers: new Map(), inject() { return 1; }, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
        onCommitFiberRoot() { window.__vrmRendus.validations++; } };
    }
  }, !!process.env.RENDUS);
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await ctx.route(/^https:\/\/images\d*\.vinted\.net\//i, async (r) => { await attendre(RTT); return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PHOTO }).catch(() => {}); });
  await ctx.route('**/rest/v1/**', async (route) => { const rq = route.request();
    if (rq.method() !== 'GET') { await attendre(RTT); return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }).catch(() => {}); }
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base); const body = JSON.stringify(rep.body);
    await attendre(RTT + Math.round(body.length / DEBIT * 1000)); return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body }).catch(() => {}); });
  await ctx.route('**/api/**', async (r) => { const u = r.request().url();
    const corps = /mode=equipe/.test(u) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true } : /mode=abonnement/.test(u) ? { ok: true, acces: true, statut: 'active', configure: true } : { pret: true, devices: 1 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) }).catch(() => {}); });
  return ctx;
}
async function cdpDe(pg) { const cdp = await pg.context().newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: RTT, downloadThroughput: DEBIT, uploadThroughput: 3e6 / 8 }); return cdp; }
const calme = (pg, sans = 1500, max = 25000) => pg.evaluate(([sans, max]) => new Promise((ok) => { let der = performance.now(); try { new PerformanceObserver((l) => { if (l.getEntries().length) der = performance.now(); }).observe({ type: 'longtask' }); } catch (_) {} const t0 = performance.now(); const iv = setInterval(() => { if (performance.now() - der > sans || performance.now() - t0 > max) { clearInterval(iv); ok(); } }, 200); }), [sans, max]).catch(() => {});
const CLE = (id) => (id === 'annonces' ? 'paires' : id);
// L'écran visé est-il PRÊT et visible ? (la copie d'écran ne compte pas : c'est l'écran vrai qu'on attend)
function ecranPret(id) {
  const m = document.querySelector('#root .vrm-main'); if (!m) return false;
  const e = m.getAttribute('data-ecran') || ''; const vise = id === 'annonces' ? /annonces|paires/ : id === 'compta' ? /compta|argent|dashboard/ : new RegExp(id);
  if (!vise.test(e)) return false;
  const sel = id === 'compta' ? '[data-attente="pret"],[data-attente="plafond"]' : `[data-attente-ecran="${id}"][data-attente="pret"],[data-attente-ecran="${id}"][data-attente="plafond"]`;
  return [...m.querySelectorAll(sel)].some((x) => x.getClientRects().length && x.getBoundingClientRect().height > 40 && !x.closest('[data-copie-ecran],.vrm-attente-cache,[hidden]'));
}
// Du doigt posé (pointerdown) à la première image où `cond` est vraie.
const jusqua = (pg, cond, arg, max = 20000) => pg.evaluate(([src, arg, max]) => new Promise((ok) => { const f = new Function('arg', 'return (' + src + ')(arg)'); const t0 = window.__tDown || performance.now();
  const v = () => { let b = false; try { b = f(arg); } catch (_) {} if (b) return ok(Math.round(performance.now() - t0)); if (performance.now() - t0 > max) return ok(null); requestAnimationFrame(v); }; requestAnimationFrame(v); }), [cond.toString(), arg, max]).catch(() => null);
const rendus = (pg) => pg.evaluate(() => { const R = window.__vrmRendus; if (!R) return null; const r = { v: R.validations }; R.validations = 0; return r; }).catch(() => null);
// Le coût du geste par nature (métriques du moteur, cumulées, ralentissement compris) : script, style, mise en page.
let CDP = null;
const metr = async () => { try { const { metrics } = await CDP.send('Performance.getMetrics'); const m = Object.fromEntries(metrics.map((x) => [x.name, x.value])); return { script: m.ScriptDuration || 0, style: m.RecalcStyleDuration || 0, page: m.LayoutDuration || 0 }; } catch (_) { return null; } };
// PROFIL=onglet:annonces,vente,froid… : le profil par fonction du geste (build non minifié conseillé).
const PROFILS = String(process.env.PROFIL || '').split(',').filter(Boolean);
async function profilDebut(cle) { if (!PROFILS.includes(cle)) return false; await CDP.send('Profiler.enable'); await CDP.send('Profiler.setSamplingInterval', { interval: 500 }); await CDP.send('Profiler.start'); return true; }
async function profilFin(cle, actif) { if (!actif) return; const { profile: P } = await CDP.send('Profiler.stop');
  const parId = new Map(P.nodes.map((n) => [n.id, n])); const parent = new Map(); for (const n of P.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const nom = (n) => (n.callFrame.functionName || '(anon)') + '@' + String(n.callFrame.url || '').split('/').pop().replace(/-[A-Za-z0-9_-]{8}\.js$/, '') + ':' + (n.callFrame.lineNumber + 1);
  const incl = new Map(), propre = new Map(); const dt = P.timeDeltas || [];
  (P.samples || []).forEach((id, i) => { const ms = (dt[i + 1] || 0) / 1000; const n0 = parId.get(id); if (!n0) return; propre.set(nom(n0), (propre.get(nom(n0)) || 0) + ms); const vus = new Set(); for (let x = id; x != null; x = parent.get(x)) { const k = nom(parId.get(x)); if (!vus.has(k)) { vus.add(k); incl.set(k, (incl.get(k) || 0) + ms); } } });
  console.log('      PROFIL ' + cle + ' · PROPRE : ' + [...propre].filter(([k]) => !/^\((idle|program|garbage)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, v]) => Math.round(v) + ' ' + k).join(' | '));
  console.log('      PROFIL ' + cle + ' · INCLUSIF : ' + [...incl].filter(([k]) => /^[A-Za-z_$]/.test(k) && !/^(performWork|workLoop|renderRoot|flush|commit|recursivelyTraverse|beginWork|completeWork|perform|run|callback|scheduler|processRoot|exports)/i.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => Math.round(v) + ' ' + k).join(' | '));
  if (process.env.PROFIL_DOSSIER) fs.writeFileSync(path.join(process.env.PROFIL_DOSSIER, cle.replace(/\W/g, '_') + '.cpuprofile'), JSON.stringify(P)); }
const ecart = (a, b) => (a && b ? { script: Math.round((b.script - a.script) * 1000), style: Math.round((b.style - a.style) * 1000), page: Math.round((b.page - a.page) * 1000) } : null);

async function onglets(pg, R) {
  const ORDRE = ['annonces', 'ventes', 'achats', 'compta', 'journee'];
  for (const o of ORDRE) { await pg.locator(`[data-n-onglet="${CLE(o)}"]`).first().tap({ timeout: 30000 }).catch(() => {}); await pg.waitForFunction(ecranPret, o, { timeout: 60000, polling: 200 }).catch(() => {}); await calme(pg, 1500, 20000); }
  for (let tour = 0; tour < 2; tour++) for (const o of ORDRE) {
    await calme(pg, 1000, 15000); await rendus(pg); const m0 = await metr(); const pf = tour === 1 && await profilDebut('onglet:' + o);
    await pg.locator(`[data-n-onglet="${CLE(o)}"]`).first().tap({ timeout: 30000 }).catch(() => {});
    const ms = await jusqua(pg, ecranPret, o); const cout = ecart(m0, await metr()); await profilFin('onglet:' + o, pf);
    await calme(pg, 800, 15000); const rd = await rendus(pg);
    (R.cout['onglet:' + o] = R.cout['onglet:' + o] || []).push(cout);
    (R.onglets[o] = R.onglets[o] || []).push(ms); if (rd) (R.rendus['onglet:' + o] = R.rendus['onglet:' + o] || []).push(rd.v);
    console.log(`    onglet ${o.padEnd(8)} ${ms == null ? 'PAS ATTEINT' : ms + ' ms'}${cout ? ` · script ${cout.script} · style ${cout.style} · mise en page ${cout.page} ms` : ''}${rd ? ` · ${rd.v} validations React` : ''}`);
  }
}
async function vente(pg, R) {
  await pg.locator(`[data-n-onglet="ventes"]`).first().tap({ timeout: 30000 }).catch(() => {});
  await pg.waitForFunction(ecranPret, 'ventes', { timeout: 60000, polling: 200 }).catch(() => {}); await calme(pg, 1500, 20000);
  // « En route » : une vente touchée ouvre son détail (« À envoyer » coche la vente pour le lot).
  const seg = pg.locator('#root .vrm-main').getByText(/^En route/).first();
  if (await seg.count()) { await seg.tap().catch(() => {}); await calme(pg, 1500, 20000); }
  for (let i = 0; i < 3; i++) {
    const cible = await pg.evaluate(() => { for (const e of document.querySelectorAll('#root .vrm-main .n-rangee')) { if (!e.querySelector('.n-rangee-chevron')) continue; const r = e.getBoundingClientRect(); if (r.height < 40 || r.top < 160 || r.bottom > innerHeight - 120) continue; if (e.closest('[data-copie-ecran],button[aria-pressed]')) continue; const x = r.left + Math.min(r.width / 2, 170), y = r.top + r.height / 2; const h = document.elementFromPoint(x, y); if (e.contains(h) && !h.closest('input,a')) return { x, y }; } return null; });
    if (!cible) { console.log('    vente : aucune rangée à toucher'); return; }
    await calme(pg, 800, 10000); await rendus(pg); const m0 = await metr(); const pf = i === 1 && await profilDebut('vente');
    await pg.touchscreen.tap(cible.x, cible.y);
    const ouvert = () => [...document.querySelectorAll('[data-n-poussee]:not([data-n-etat="sortie"]) .n-rangee, [data-n-poussee]:not([data-n-etat="sortie"]) [data-vn-geste]')].some((x) => { const r = x.getBoundingClientRect(); return r.height > 20 && r.left < innerWidth - 20 && r.right > 20; });
    const ms = await jusqua(pg, ouvert, null, 10000);
    if (process.env.CAPTURES) { await pg.screenshot({ path: path.join(process.env.CAPTURES, 'vente-' + i + '.png') }).catch(() => {}); console.log('      ' + JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('[data-n-poussee]')].map((x) => ({ etat: x.getAttribute('data-n-etat'), r: x.getBoundingClientRect().toJSON(), n: x.querySelectorAll('*').length, cls: x.className })))).slice(0, 600)); } const cout = ecart(m0, await metr()); await profilFin('vente', pf); const rd = await rendus(pg);
    await calme(pg, 800, 10000);
    // Le retour : le bouton « ‹ Ventes » de la page poussée.
    const ret = await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-n-poussee]:not([data-n-etat="sortie"]) .n-barre-retour')].find((x) => x.getClientRects().length); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (ret) await pg.touchscreen.tap(ret.x, ret.y); else { await pg.evaluate(() => { window.__tDown = performance.now(); }); await pg.keyboard.press('Escape'); }
    const ferme = () => !document.querySelector('[data-n-poussee]:not([data-n-etat="sortie"])');
    const ms2 = await jusqua(pg, ferme, null, 10000); await calme(pg, 800, 10000);
    R.venteOuvrir.push(ms); R.venteRetour.push(ms2); if (rd) (R.rendus.vente = R.rendus.vente || []).push(rd.v);
    console.log(`    vente : ouvrir ${ms ?? 'PAS OUVERTE'} ms · retour ${ms2 ?? 'PAS FERMÉE'} ms${cout ? ` · ouvrir : script ${cout.script} · style ${cout.style} · mise en page ${cout.page} ms` : ''}${rd ? ` · ${rd.v} validations` : ''}`);
  }
}
async function defiler(pg, cdp, R) {
  await pg.locator(`[data-n-onglet="paires"]`).first().tap({ timeout: 30000 }).catch(() => {});
  await pg.waitForFunction(ecranPret, 'annonces', { timeout: 60000, polling: 200 }).catch(() => {}); await calme(pg, 3000, 40000);
  await pg.evaluate(() => { window.scrollTo(0, 0); for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0; });
  await attendre(500);
  await pg.evaluate(() => { window.__im = []; const b = (t) => { window.__im.push(t); window.__raf = requestAnimationFrame(b); }; window.__raf = requestAnimationFrame(b); });
  for (let i = 0; i < 6; i++) await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 560, yDistance: -1400, speed: 1600, gestureSourceType: 'mouse', repeatCount: 1, preventFling: false });
  const r = await pg.evaluate(() => { cancelAnimationFrame(window.__raf); const im = window.__im; let haut = window.scrollY; for (const e of document.querySelectorAll('*')) if (e.scrollTop > haut) haut = e.scrollTop; return { ecarts: im.slice(1).map((t, i) => t - im[i]), haut: Math.round(haut), noeuds: document.getElementsByTagName('*').length }; });
  const p95 = Math.round(centile(r.ecarts, 0.95)), pire = Math.round(Math.max(...r.ecarts)), m = Math.round(med(r.ecarts));
  R.defile.push({ p95, pire, med: m, haut: r.haut, noeuds: r.noeuds });
  console.log(`    défilement Annonces : image médiane ${m} ms · p95 ${p95} ms · pire ${pire} ms · défilé ${r.haut} px · ${r.noeuds} nœuds`);
}
async function recherche(pg, R) {
  await pg.goto(`${BASE_URL.get(pg)}/?tab=annonces`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(ecranPret, 'annonces', { timeout: 60000, polling: 200 }).catch(() => {}); await calme(pg, 3000, 40000);
  const champ = pg.locator('#root .vrm-main input[type="search"]:visible').first();
  if (!(await champ.count())) { console.log('    recherche : aucun champ'); return; }
  await champ.tap(); await calme(pg, 800, 8000);
  // De la touche à la première image où la lettre est DANS le champ (l'écho), et de la dernière touche à la fin du travail
  // qu'elle déclenche (la liste à jour : plus aucune tâche longue).
  await pg.evaluate(() => { window.__frappe = []; window.__lt2 = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt2.push(e.startTime + e.duration); }).observe({ type: 'longtask' }); } catch (_) {}
    addEventListener('keydown', (e) => { const t0 = performance.now(); window.__derniereTouche = t0; const c = e.key; const champ = e.target;
      const v = () => { if (String(champ.value || '').endsWith(c)) return window.__frappe.push(Math.round(performance.now() - t0)); if (performance.now() - t0 < 5000) requestAnimationFrame(v); }; requestAnimationFrame(v); }, true); });
  for (const c of 'samba') { await pg.keyboard.type(c); await attendre(180); }
  await calme(pg, 1500, 20000);
  const { L, liste } = await pg.evaluate(() => ({ L: window.__frappe.slice(), liste: Math.round(Math.max(0, ...window.__lt2.filter((t) => t > window.__derniereTouche)) - window.__derniereTouche) }));
  R.frappeListe.push(liste);
  R.frappe.push(...L);
  console.log(`    recherche : lettre affichée ${L.join(' · ')} ms (médiane ${med(L)}, pire ${Math.max(...L)}) · liste à jour ${liste} ms après la dernière lettre`);
}

// La recherche d'Achats (écran léger) : de la valeur posée (un « input ») à la liste filtrée (le nombre de rangées change).
async function rechercheAchats(pg, R) {
  await pg.locator(`[data-n-onglet="achats"]`).first().tap({ timeout: 30000 }).catch(() => {});
  await pg.waitForFunction(ecranPret, 'achats', { timeout: 60000, polling: 200 }).catch(() => {}); await calme(pg, 2000, 30000);
  for (const v of ['1', '12']) {
    const r = await pg.evaluate((v) => new Promise((fini) => {
      const champ = [...document.querySelectorAll('#root .vrm-main input[type="search"]')].find((x) => x.getBoundingClientRect().height > 0);
      if (!champ) return fini(null);
      const compte = () => document.querySelectorAll('#root .vrm-main .n-rangee, #root .vrm-main [data-tt-ligne], #root .vrm-main .vrm-buy-row').length;
      const n0 = compte(); const t0 = performance.now();
      const mo = new MutationObserver(() => { if (compte() !== n0) { mo.disconnect(); fini({ ms: Math.round(performance.now() - t0), natif: !!champ.closest('[data-n-recherche]') }); } });
      mo.observe(document.querySelector('#root .vrm-main'), { childList: true, subtree: true });
      setTimeout(() => { mo.disconnect(); fini({ ms: null, natif: !!champ.closest('[data-n-recherche]') }); }, 5000);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(champ, v); champ.dispatchEvent(new Event('input', { bubbles: true }));
    }), v);
    await calme(pg, 1000, 10000);
    if (r) R.rechAchats.push(r.ms);
    console.log(`    recherche Achats « ${v} » : liste filtrée ${r && r.ms != null ? r.ms + ' ms' : 'PAS VUE'}${r ? (r.natif ? ' (champ natif)' : ' (autre champ)') : ' (aucun champ)'}`);
  }
}

// ── AB : plusieurs builds, mêmes gestes, en alternance ──
async function modeAB(nav) {
  const R = DISTS.map(() => ({ froid: [], onglets: {}, cout: {} })); const erreurs = [];
  const ORDRE = ['annonces', 'ventes', 'achats', 'compta', 'journee']; const TOURS = +(process.env.TOURS || 4);
  for (let p = 0; p < PASSES; p++) {
    const P = [];
    for (let i = 0; i < DISTS.length; i++) { const ctx = await contexte(nav); const pg = await ctx.newPage(); BASE_URL.set(pg, `http://localhost:${PORT + i}`); pg.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160))); const cdp = await cdpDe(pg); await cdp.send('Performance.enable').catch(() => {}); P.push({ i, ctx, pg, cdp }); }
    const ordre = (k) => (k % 2 ? P.slice().reverse() : P);
    for (const x of ordre(p)) { await x.pg.goto(`${BASE_URL.get(x.pg)}/?tab=journee`, { waitUntil: 'commit', timeout: 120000 });
      const fin = Date.now() + 90000; let t = null; while (Date.now() < fin) { t = await x.pg.evaluate(() => window.__pret).catch(() => null); if (t != null) break; await attendre(100); }
      R[x.i].froid.push(t == null ? null : Math.round(t)); await calme(x.pg, 2000, 40000); }
    for (const x of P) for (const o of ORDRE) { await x.pg.locator(`[data-n-onglet="${CLE(o)}"]`).first().tap({ timeout: 30000 }).catch(() => {}); await x.pg.waitForFunction(ecranPret, o, { timeout: 60000, polling: 200 }).catch(() => {}); await calme(x.pg, 1500, 20000); }
    let k = 0;
    for (let tour = 0; tour < TOURS; tour++) for (const o of ORDRE) for (const x of ordre(k++)) {
      CDP = x.cdp; await calme(x.pg, 1000, 15000); const m0 = await metr();
      await x.pg.locator(`[data-n-onglet="${CLE(o)}"]`).first().tap({ timeout: 30000 }).catch(() => {});
      const ms = await jusqua(x.pg, ecranPret, o); const cout = ecart(m0, await metr());
      (R[x.i].onglets[o] = R[x.i].onglets[o] || []).push(ms); (R[x.i].cout[o] = R[x.i].cout[o] || []).push(cout);
      await calme(x.pg, 800, 15000);
    }
    for (const x of P) await x.ctx.close();
    console.log(`  passe ${p + 1} faite (charge ${os.loadavg()[0].toFixed(1)})`);
  }
  const out = DISTS.map((d, i) => ({ build: path.basename(d), froid: med(R[i].froid),
    onglets: Object.fromEntries(Object.entries(R[i].onglets).map(([o, L]) => [o, med(L)])),
    script: Object.fromEntries(Object.entries(R[i].cout).map(([o, L]) => [o, med(L.map((c) => c && c.script))])),
    style: Object.fromEntries(Object.entries(R[i].cout).map(([o, L]) => [o, med(L.map((c) => c && c.style))])) }));
  for (const x of out) console.log('AB ' + JSON.stringify(x));
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify({ out, R }, null, 1));
  console.log(erreurs.length ? `❌ erreurs de page : ${[...new Set(erreurs)].slice(0, 3).join(' | ')}` : '✅ aucune erreur de page');
}

(async () => {
  if (DISTS.length > 1) { const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + DISTS.map((_, i) => PORT + i).join(',')] });
    console.log(`Banc vitesse-iphone AB · ${DISTS.map((d) => path.basename(d)).join(' / ')} · CPU ×${CPU} · volume ${process.env.VOLUME || 'julien'} · ${PASSES} passe(s) · charge ${os.loadavg()[0].toFixed(1)}`);
    try { await modeAB(nav); } finally { await nav.close(); srv.close(); } return; }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + DISTS.map((_, i) => PORT + i).join(',')] });
  const R = { froid: [], rouvert: [], longuesFroid: [], onglets: {}, venteOuvrir: [], venteRetour: [], defile: [], frappe: [], frappeListe: [], rechAchats: [], rendus: {}, cout: {} };
  const erreurs = [];
  console.log(`Banc vitesse-iphone · ${DISTS.map((d) => path.basename(d)).join(' / ')} · CPU ×${CPU} · volume ${process.env.VOLUME || 'julien'} · ${PASSES} passe(s) · charge ${os.loadavg()[0].toFixed(1)}`);
  try {
    for (let p = 0; p < PASSES; p++) {
      console.log(`  passe ${p + 1}`);
      const ctx = await contexte(nav); const pg = await ctx.newPage(); BASE_URL.set(pg, `http://localhost:${PORT}`); pg.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
      const cdp = await cdpDe(pg); CDP = cdp; await cdp.send('Performance.enable').catch(() => {});
      // Froid, puis rouvert (même appareil : service worker, copies d'écran).
      for (const sorte of ['froid', 'rouvert']) {
        if (sorte === 'rouvert') await calme(pg, 3000, 30000), await attendre(6000);
        const pf = p === 0 && await profilDebut(sorte);
        await pg.goto(`${BASE_URL.get(pg)}/?tab=journee`, { waitUntil: 'commit', timeout: 120000 });
        const fin = Date.now() + 90000; let t = null; while (Date.now() < fin) { t = await pg.evaluate(() => window.__pret).catch(() => null); if (t != null) break; await attendre(100); }
        const lt = await pg.evaluate((tp) => Math.round((window.__lt || []).filter((x) => tp == null || x[0] < tp).reduce((a, x) => a + x[1], 0)), t).catch(() => null);
        await profilFin(sorte, pf);
        R[sorte].push(t == null ? null : Math.round(t)); if (sorte === 'froid') R.longuesFroid.push(lt);
        console.log(`    ${sorte} : écran utile ${t == null ? 'PAS ATTEINT' : Math.round(t) + ' ms'} · tâches longues avant ${lt} ms`);
      }
      await calme(pg, 2000, 40000);
      if (ETAPES.includes('onglets')) await onglets(pg, R);
      if (ETAPES.includes('vente')) await vente(pg, R);
      if (ETAPES.includes('defilement')) await defiler(pg, cdp, R);
      if (ETAPES.includes('rechachats')) await rechercheAchats(pg, R);
      if (ETAPES.includes('recherche')) await recherche(pg, R);
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  const out = {
    froid: med(R.froid), rouvert: med(R.rouvert), longuesFroid: med(R.longuesFroid),
    onglets: Object.fromEntries(Object.entries(R.onglets).map(([k, L]) => [k, med(L)])),
    venteOuvrir: med(R.venteOuvrir), venteRetour: med(R.venteRetour),
    defileP95: med(R.defile.map((x) => x.p95)), defilePire: med(R.defile.map((x) => x.pire)), defileMed: med(R.defile.map((x) => x.med)),
    frappeMed: med(R.frappe), frappeP95: centile(R.frappe, 0.95), frappeListe: med(R.frappeListe), rechAchats: med(R.rechAchats),
    cout: Object.fromEntries(Object.entries(R.cout).map(([k, L]) => [k, { script: med(L.map((x) => x && x.script)), style: med(L.map((x) => x && x.style)), page: med(L.map((x) => x && x.page)) }])),
    rendus: Object.fromEntries(Object.entries(R.rendus).map(([k, L]) => [k, med(L)])), charge: os.loadavg()[0].toFixed(1),
  };
  console.log('MÉDIANES ' + JSON.stringify(out));
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify({ ...out, R }, null, 1));
  console.log(erreurs.length ? `❌ erreurs de page : ${[...new Set(erreurs)].slice(0, 3).join(' | ')}` : '✅ aucune erreur de page');
  process.exitCode = erreurs.length ? 1 : 0;
})();
