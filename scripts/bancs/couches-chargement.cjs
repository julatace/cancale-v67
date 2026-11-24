// ════════════════════════════════════════════════════════════════════════════
//  BANC « UNE SEULE COUCHE À LA FOIS » (21 nov. — Julien : « sur ordi ça bug beaucoup trop, t'as des écrans qui se
//  superposent quand ça charge, ça part dans tous les sens et c'est vraiment pas fluide » ; le téléphone pareil).
//  Récit : docs/passation/2026-11-21-fluidite.md. (Le nom `fluidite.cjs` est pris par le banc des ventes du 4 oct.)
//
//    node scripts/bancs/couches-chargement.cjs <dist> [port]
//    FORMATS=ordi,tel · ECRANS=journee,annonces,ventes,achats,compta,messages · RAFALE=<dossier> (une image toutes les
//    100 ms, CDP screencast) · JSON=<fichier> · CPU=4 · MBIT=9 · DEBUG=1
//
//  Comme chez lui : 1512 × 945 (souris) et 390 × 844 tactile (iPhone), processeur ×CPU, 4G (150 ms, 9 Mbit/s) pour les
//  fichiers ET la base (servie par le banc au même débit), service worker autorisé, base INVENTÉE au volume de la sienne
//  (`_base-volume`). Rien de réel ; aucune écriture ne sort.
//
//  Le parcours, par format : (0) une visite de chaque onglet (l'app range ses copies, src/copieEcran.js) ; (A) l'OUVERTURE
//  de l'app sur chaque onglet (page neuve, `?tab=`) ; (B) le TOUCHER de chaque onglet dans une page neuve ouverte sur
//  Aujourd'hui (1re visite : copie puis écran vrai), puis un 2e tour (écrans gardés) ; (C) le défilement d'un onglet
//  CONSERVÉ quand on y revient.
//
//  Une SONDE posée avant tout script regarde chaque image (rAF, au plus toutes les 33 ms) : sur une grille de points,
//  la pile des éléments (`elementsFromPoint`) du haut vers le bas, chacun rangé dans SA couche — l'écran de démarrage
//  (`demarrage`), la copie peinte avant l'app (`copie-avant-app`), la copie dans l'app (`copie:<écran>`), le squelette
//  d'une attente (`squelette:<écran>`), l'écran vrai (`ecran:<écran>`, la plus haute `.vrm-attente` de `.vrm-main`, ou
//  `.vrm-main` lui-même) — une couche est VUE si ce qui est au-dessus d'elle la laisse passer (opacité, fond) et
//  qu'elle peint (texte, fond, image). Il JUGE des nombres :
//    · couches superposées : images où DEUX couches de contenu ou plus sont vues ensemble = 0 ;
//    · décalage de mise en page (Layout Shift API, toutes les entrées, même après un geste) : CLS < 0,02 par visite
//      (22 nov. : 0,05 avant ; `SEUIL_CLS=`) ;
//    · clignotement : du contenu vu, puis plus rien (vide, squelette, écran de démarrage), puis du contenu = 0 ;
//    · remontage : l'écran vrai montré, puis REMPLACÉ par un autre élément du même écran = 0 ;
//    · saut de défilement : la position bouge sans geste après le premier contenu = 0 ;
//    · défilement conservé au retour sur un onglet (écart ≤ 8 px).
//  Il rapporte aussi la suite des couches de chaque visite (« demarrage → copie:ventes → ecran:ventes »).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: 1500, achats: 800, annonces: 1200 });
const DIST = path.resolve(process.argv[2] || path.join(RACINE, 'dist'));
const PORT = +(process.argv[3] || process.env.BANC_PORT || (21000 + Math.floor(Math.random() * 9000)));
const CPU = +(process.env.CPU || 4);
const RTT = 150, DEBIT = Number(process.env.MBIT || 9) * 1e6 / 8;
const RESEAU = { offline: false, latency: RTT, downloadThroughput: DEBIT, uploadThroughput: 3e6 / 8 };
const FORMATS = String(process.env.FORMATS || 'ordi,tel').split(',');
const ECRANS = String(process.env.ECRANS || 'journee,annonces,ventes,achats,compta,messages').split(',');
const RAFALE = process.env.RAFALE || '';
const PHOTOS_IPHONE = process.env.PHOTOS === 'iphone';
const PENDRE = process.env.PENDRE ? new RegExp(process.env.PENDRE) : null;
// (22 nov., choix 3 de Julien — « zéro saut à l'ouverture ») Le seuil est RESSERRÉ : CLS < 0,02 par visite (0,05 avant).
const SEUIL_CLS = Number(process.env.SEUIL_CLS || 0.02);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
// Une petite photo OPAQUE (16 × 16, gris bleu) : elle se voit sur les captures.
const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGOs6FnAQApgIkn1qIZRDUNKAwA3KwHEWgvY/wAAAABJRU5ErkJggg==', 'base64');
let ko = 0, ok = 0;
const KO = [];
const dit = (bon, quoi) => { if (bon) ok++; else { ko++; KO.push(quoi); } console.log((bon ? '  ✅ ' : '  ❌ ') + quoi); };

// ── Les fichiers de l'app, comme Vercel (compressés, /assets immuables) ──
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const gz = new Map();
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream';
  const cache = /^\/assets\//.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache';
  if (/javascript|css|html|json|svg/.test(t)) {
    if (!gz.has(p)) gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 6 }));
    r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip', 'cache-control': cache }); return r.end(gz.get(p));
  }
  r.writeHead(200, { 'content-type': t, 'cache-control': cache }); r.end(fs.readFileSync(p));
}).listen(PORT);

async function preparer(ctx) {
  await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  // Les photos de Vinted : servies (une petite image), comme chez lui sur l'ordinateur où l'extension les récupère —
  // coupées, l'app pose 20 s plus tard un bandeau « les photos ne s'affichent pas » qui pousse l'écran (un décalage du
  // BANC). `PHOTOS=coupees` : les couper quand même.
  // `PHOTOS=iphone` (21 nov., captures de Julien) : comme sur SON iPhone, le CDN refuse TOUT chargement direct ; seul le
  // relais du serveur (`/api/compte?mode=photo`, src/App.jsx `photoViaServeur`) rend la photo. Une vignette qui donne
  // l'adresse nue à un <img> reste vide ou devient une icône : le banc compte les photos dessinées.
  if (process.env.PHOTOS !== 'coupees') await ctx.route(/^https:\/\/images\d*\.vinted\.net\//i, async (r) => { await attendre(RTT);
    if (PHOTOS_IPHONE) return r.fulfill({ status: 403, contentType: 'text/html', body: 'refus' }).catch(() => {});
    // Comme le CDN de Vinted : une photo demandée AVEC un référent (l'adresse de VRM) est refusée.
    if (r.request().headers().referer) return r.fulfill({ status: 403, contentType: 'text/html', body: 'refus' }).catch(() => {});
    return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PHOTO }).catch(() => {}); });
  await ctx.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    // `PENDRE=<motif>` : une lecture de la base qui ne répond JAMAIS (le réseau du téléphone qui se perd) — l'écran doit
    // finir quand même (contenu, vide dit, ou « pas su ») : au calme, plus aucun squelette.
    if (PENDRE && PENDRE.test(decodeURIComponent(rq.url()))) return;
    if (rq.method() !== 'GET') { await attendre(RTT); return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }).catch(() => {}); }
    const h = await rq.allHeaders();
    const rep = repondre(rq.url(), h.range, base);
    const body = JSON.stringify(rep.body);
    await attendre(RTT + Math.round(body.length / DEBIT * 1000));
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body }).catch(() => {});
  });
  await ctx.route('**/api/**', async (r) => { const u = r.request().url();
    if (PHOTOS_IPHONE && /mode=photo/.test(u)) { await attendre(RTT); return r.fulfill({ status: 200, contentType: 'image/png', body: PHOTO }).catch(() => {}); }
    const corps = /mode=equipe/.test(u) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true }
      : /mode=abonnement/.test(u) ? { ok: true, acces: true, statut: 'active', configure: true } : { pret: true, devices: 1 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) }).catch(() => {}); });
  await ctx.addInitScript(sonde);
}

// ── LA SONDE (dans la page, avant tout script) ──
function sonde() {
  const S = window.__vrmCouches = { on: false, t0: 0, images: [], decalages: [], ids: new WeakMap(), nId: 0 };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (!S.on) continue; S.decalages.push({ t: Math.round(e.startTime - S.t0), v: e.value, geste: e.hadRecentInput, src: (e.sources || []).slice(0, 3).map((s) => { const n = s.node; if (!n || !n.getAttribute) return '?'; return (n.localName || '') + (n.className && typeof n.className === 'string' ? '.' + n.className.split(/\s+/).slice(0, 2).join('.') : '') + (n.getAttribute('data-attente-ecran') ? '[' + n.getAttribute('data-attente-ecran') + ']' : '') + ((n.closest && n.closest('[data-v2-bloc],[data-vn],[data-attente-ecran]')) ? '{' + ['data-v2-bloc', 'data-vn', 'data-attente-ecran'].map((a) => n.closest('[' + a + ']') && n.closest('[' + a + ']').getAttribute(a)).filter(Boolean)[0] + '}' : '') + ' Δy=' + Math.round(s.currentRect.y - s.previousRect.y) + ' Δh=' + Math.round(s.currentRect.height - s.previousRect.height) + ' (y' + Math.round(s.previousRect.y) + ' h' + Math.round(s.previousRect.height) + '→y' + Math.round(s.currentRect.y) + ' h' + Math.round(s.currentRect.height) + ')'; }) }); } }).observe({ type: 'layout-shift', buffered: false }); } catch (_) {}
  const idDe = (e) => { let v = S.ids.get(e); if (!v) { v = ++S.nId; S.ids.set(e, v); } return v; };
  const opEff = (e) => { let o = 1; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const st = getComputedStyle(x); o *= +st.opacity; if (st.visibility === 'hidden' || st.display === 'none') return 0; if (o < 0.02) return 0; } return o; };
  // Ce qu'une couche MONTRE dans la fenêtre (hors bandes du haut et du bas) : ses textes posés dans la fenêtre (au moins
  // trois). Une boîte vide ou de hauteur nulle (l'écran vrai caché sous `.vrm-attente-cache`) ne compte pas.
  // ⚠️ La copie est `inert` (`pointer-events: none`) : `elementsFromPoint` ne la voit pas — on mesure la géométrie.
  const montre = (racine, H, W) => {
    if (!racine || !racine.isConnected) return 0;
    const r0 = racine.getBoundingClientRect(); if (r0.height < 8 || r0.bottom < 70 || r0.top > H - 70 || r0.width < 40) return 0;
    let n = 0;
    const tw = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    let vus = 0;
    for (let t = tw.nextNode(); t && vus < 600; t = tw.nextNode()) {
      vus++;
      if (!t.textContent.trim()) continue;
      const el = t.parentElement; if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 70 || r.top > H - 70 || r.height < 4 || r.right < 0 || r.left > W) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      if (++n >= 3) return n;
    }
    return 0;
  };
  const regarder = () => {
    const W = innerWidth, H = innerHeight, couches = [], ecrans = [];
    // 1. L'écran de démarrage (au-dessus de tout, fond plein) : son opacité couvre l'app d'autant.
    const boot = document.getElementById('vrm-demarrage');
    let couvre = 0;
    if (boot && boot.isConnected) {
      const o = opEff(boot);
      if (o > 0.02) { const ap = boot.querySelector('#vrm-apercu'); couches.push(ap && montre(ap, H, W) ? 'copie-avant-app' : 'demarrage'); couvre = o; }
    }
    // 2. L'app, si l'écran de démarrage la laisse voir.
    if (couvre < 0.9) {
      const main = document.querySelector('#root .vrm-main');
      if (main) {
        const vue = (el) => opEff(el) * (1 - couvre) > 0.15;
        for (const c of main.querySelectorAll('[data-copie-ecran]')) if (vue(c) && montre(c, H, W)) couches.push('copie:' + c.getAttribute('data-copie-ecran'));
        const tops = [...main.querySelectorAll('.vrm-attente')].filter((x) => !x.parentElement.closest('.vrm-attente'));
        for (const att of tops) {
          const ec = att.getAttribute('data-attente-ecran') || '?';
          for (const enf of att.children) {
            if (enf.hasAttribute('data-copie-ecran') || enf.classList.contains('vrm-attente-cache') || enf.classList.contains('vrm-ce-mention') || enf.classList.contains('vrm-sr-seul')) continue;
            if (enf.hasAttribute('data-squelette')) { if (vue(enf) && enf.getBoundingClientRect().height > 40) couches.push('squelette:' + ec); continue; }
            if (enf.querySelector(':scope > [data-copie-ecran]')) continue;
            if (enf.hasAttribute('data-attente-instantane-cadre')) { if (vue(enf) && montre(enf, H, W)) couches.push('copie:' + ec + '-instantane'); continue; }
            if (vue(enf) && montre(enf, H, W)) { couches.push('ecran:' + ec); ecrans.push('ecran:' + ec + '#' + idDe(enf)); }
          }
        }
        if (!tops.length && vue(main) && montre(main, H, W)) { couches.push('ecran:' + (main.getAttribute('data-ecran') || '?')); ecrans.push('ecran:' + (main.getAttribute('data-ecran') || '?') + '#' + idDe(main)); }
      }
    }
    const sc = document.scrollingElement ? document.scrollingElement.scrollTop : 0;
    const m = document.querySelector('.vrm-main'); const ms = m ? m.scrollTop : 0;
    // Une image SANS contenu : ce qu'il y a (pour le rapport d'un clignotement).
    let quoi = '';
    if (!couches.some((c) => /^(copie|ecran)/.test(c))) {
      try {
        const main = document.querySelector('#root .vrm-main');
        const d = (e) => e ? e.localName + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + [...e.attributes].filter((a) => /^data-(attente|copie)/.test(a.name)).map((a) => '[' + a.name + '=' + a.value + ']').join('') + '{h' + Math.round(e.getBoundingClientRect().height) + ' o' + (+getComputedStyle(e).opacity).toFixed(2) + (e.getAnimations ? e.getAnimations().map((a) => ' anim:' + (a.animationName || a.id || 'waapi') + '@' + Math.round(a.currentTime || 0)).join('') : '') + (e.getAttribute('style') ? ' style=' + e.getAttribute('style').slice(0, 60) : '') + '}' : '';
        const att = main && main.querySelector('.vrm-attente');
        quoi = 'boot=' + (boot && boot.isConnected ? opEff(boot).toFixed(2) : 'non') + ' main=' + d(main) + ' att=' + (att ? d(att) + ' > ' + [...att.children].slice(0, 4).map(d).join(' + ') : 'aucune');
      } catch (_) {}
    }
    return { couches: [...new Set(couches)].sort(), ecrans, defil: Math.round(Math.max(sc, ms)), quoi };
  };
  let der = 0;
  const boucle = () => {
    requestAnimationFrame(boucle);
    if (!S.on) return;
    const t = performance.now(); if (t - der < 33) return; der = t;
    try { const r = regarder(); r.t = Math.round(t - S.t0); S.images.push(r); } catch (_) {}
  };
  requestAnimationFrame(boucle);
  S.demarrer = () => { S.images = []; S.decalages = []; S.t0 = performance.now(); S.on = true; };
  S.arreter = () => { S.on = false; return { images: S.images, decalages: S.decalages }; };
  S.demarrer();   // à l'ouverture : depuis le début de la page
}

// ── Juger une visite ──
const CONTENU = (c) => /^(copie-avant-app|copie:|ecran:)/.test(c);
function juger(rel, vise) {
  const im = rel.images;
  const superposees = im.filter((x) => x.couches.filter((c) => c !== 'demarrage' || x.couches.some(CONTENU)).length >= 2);
  // (le logo seul sous rien n'est pas une superposition ; le logo PAR-DESSUS une copie ou un écran en est une)
  let premier = -1; for (let i = 0; i < im.length; i++) if (im[i].couches.some(CONTENU)) { premier = i; break; }
  let clignote = 0, vide = false, debutVide = 0; const trous = [];
  for (let i = premier + 1; premier >= 0 && i < im.length; i++) { const c = im[i].couches.some(CONTENU); if (!c) { if (!vide) debutVide = im[i].t; vide = true; } else if (vide) { clignote++; vide = false; trous.push(debutVide + '–' + im[i].t + ' ms' + (process.env.DEBUG ? ' [' + (im.find((x) => x.t === debutVide) || {}).quoi + ']' : '')); } }
  // remontage : l'élément de l'écran visé change APRÈS avoir été montré
  let remontages = 0, dernierEl = null;
  for (const x of im) { const e = x.ecrans.find((k) => k.startsWith('ecran:' + vise + '#')); if (!e) continue; if (dernierEl && e !== dernierEl) remontages++; dernierEl = e; }
  let sauts = 0; for (let i = Math.max(premier, 0) + 1; premier >= 0 && i < im.length; i++) if (Math.abs(im[i].defil - im[i - 1].defil) > 4) sauts++;
  const cls = rel.decalages.reduce((a, d) => a + d.v, 0);
  const suite = []; for (const x of im) { const k = x.couches.join('+') || '—'; if (suite[suite.length - 1] !== k) suite.push(k); }
  const autres = im.filter((x) => x.couches.some((c) => /^(ecran|copie|squelette):/.test(c) && !c.endsWith(':' + vise))).length;
  return { superposees: superposees.length, exemple: superposees[0] ? superposees[0].t + ' ms : ' + superposees[0].couches.join(' + ') : '', cls: Math.round(cls * 1000) / 1000, clsSources: rel.decalages.filter((d) => d.v > 0.002).slice(0, 4).map((d) => d.t + 'ms ' + d.v.toFixed(3) + ' ' + d.src.join(' | ')),
    clignote, trous, remontages, sauts, autres, premierContenu: premier >= 0 ? im[premier].t : null, suite: suite.slice(0, 14).join(' → '), images: im.length };
}

async function cdpDe(pg) {
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', RESEAU);
  return cdp;
}
// Une image toutes les 100 ms (au plus), telle qu'elle est peinte.
async function rafale(cdp, dossier) {
  if (!RAFALE) return async () => 0;
  fs.mkdirSync(dossier, { recursive: true });
  let n = 0, der = 0; const t0 = Date.now();
  const f = async (e) => { cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {}); const t = Date.now() - t0; if (t - der < 100) return; der = t; n++; fs.writeFileSync(path.join(dossier, String(t).padStart(6, '0') + '.jpg'), Buffer.from(e.data, 'base64')); };
  cdp.on('Page.screencastFrame', f);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 55, everyNthFrame: 1 });
  return async () => { await cdp.send('Page.stopScreencast').catch(() => {}); cdp.off('Page.screencastFrame', f); return n; };
}
const calme = (pg, sans = 1500, max = 25000) => pg.evaluate(([sans, max]) => new Promise((ok) => { let der = performance.now(); try { new PerformanceObserver((l) => { if (l.getEntries().length) der = performance.now(); }).observe({ type: 'longtask' }); } catch (_) {} const t0 = performance.now(); const iv = setInterval(() => { if (performance.now() - der > sans || performance.now() - t0 > max) { clearInterval(iv); ok(); } }, 100); }), [sans, max]).catch(() => {});
const pret = (pg, id, ms = 60000) => pg.waitForSelector(`.vrm-main [data-attente-ecran="${id}"][data-attente="pret"], .vrm-main [data-attente-ecran="${id}"][data-attente="plafond"]`, { timeout: ms, state: 'attached' }).catch(() => {});
// Une navigation qui rate une fois (le service worker se range, la machine est chargée) se refait, une fois.
async function aller(pg, url, waitUntil) {
  try { await pg.goto(url, { waitUntil, timeout: 120000 }); } catch (e) { console.log('  (navigation ratée, refaite : ' + String(e.message || e).split('\n')[0].slice(0, 90) + ')'); await attendre(1500); await pg.goto(url, { waitUntil, timeout: 120000 }); }
}
const ONGLET_DE = (id) => (id === 'annonces' ? ['paires', 'annonces'] : [id]);
async function toucher(pg, id, tactile) {
  if (id === 'messages') { const sel = '[data-n-onglet="messages"]:visible, [data-nav-entree="messages"]:visible'; if (await pg.locator(sel).count()) return tactile ? pg.locator(sel).first().tap({ timeout: 20000 }) : pg.locator(sel).first().click({ timeout: 20000 }); return pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: 'messages' }))); }
  for (const o of ONGLET_DE(id)) {
    const sel = `[data-n-onglet="${o}"]:visible, [data-nav-entree="${o}"]:visible`;
    if (await pg.locator(sel).count()) return tactile ? pg.locator(sel).first().tap({ timeout: 20000 }) : pg.locator(sel).first().click({ timeout: 20000 });
  }
  return pg.evaluate((d) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: d })), id);
}
const ecranMontre = (pg) => pg.evaluate(() => { const m = document.querySelector('.vrm-main'); return m && m.getAttribute('data-ecran'); }).catch(() => null);

// Au calme (l'écran prêt, plus rien ne bouge depuis 1,5 s) : ce qui ATTEND encore dans la fenêtre — un squelette, une
// phrase « je lis… » — et les vignettes VIDES (ni photo dessinée, ni icône). Les photos du banc sont servies : une
// rangée qui en porte une la montre. Une lecture finit par du contenu, un vide dit ou « — » : jamais une attente éternelle.
const restes = (pg) => pg.evaluate(() => {
  const H = innerHeight, W = innerWidth;
  const main = document.querySelector('#root .vrm-main'); if (!main) return { attentes: ['pas de .vrm-main'], vides: 0, photos: 0 };
  const dans = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && r.left < W && r.right > 0 && !e.closest('.vrm-attente-cache'); };
  const nom = (e) => { const a = e.closest('[data-vn-liste],[data-vn],[data-attente-ecran],section,[class*="n-groupe"]'); return a ? (a.getAttribute('data-vn-liste') || a.getAttribute('data-vn') || a.getAttribute('data-attente-ecran') || String(a.className || a.localName).split(' ')[0]) : '?'; };
  const attentes = [];
  for (const e of main.querySelectorAll('.n-os, .vrm-sq-barre, [data-squelette]')) if (dans(e) && getComputedStyle(e).visibility !== 'hidden') attentes.push('squelette@' + nom(e));
  const tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) { const x = t.textContent.trim(); if (/^(je lis|lecture|chargement)\b.*…$/i.test(x) && t.parentElement && dans(t.parentElement)) attentes.push('« ' + x.slice(0, 40) + ' »@' + nom(t.parentElement)); }
  let vides = 0, photos = 0, icones = 0;
  for (const v of main.querySelectorAll('.n-vignette:not(.n-os)')) {
    if (!dans(v)) continue;
    const im = v.localName === 'img' ? v : v.querySelector('img');
    if (im && im.complete && im.naturalWidth > 0 && +getComputedStyle(im).opacity > 0.5) { photos++; continue; }
    if (!im && v.querySelector('svg')) { icones++; continue; }   // une icône : pas de photo pour cette rangée
    vides++;
  }
  return { attentes: [...new Set(attentes)].slice(0, 8), nAttentes: attentes.length, vides, photos, icones };
}).catch(() => ({ attentes: ['(lecture impossible)'], vides: 0, photos: 0 }));
async function visite(pg, cdp, etiquette, vise, geste, duree) {
  const fin = await rafale(cdp, path.join(RAFALE, etiquette));
  if (geste) { await pg.evaluate(() => window.__vrmCouches.demarrer()); await geste(); }
  await pret(pg, vise, 30000);
  await calme(pg, 1500, PENDRE ? Math.max(duree, 30000) : duree);
  await attendre(800);
  const rel = await pg.evaluate(() => window.__vrmCouches.arreter());
  const n = await fin();
  const j = juger(rel, vise); j.captures = n; j.restes = await restes(pg);
  return j;
}
function rapporter(fmt, quoi, vise, j, sortie) {
  sortie.push({ fmt, quoi, vise, ...j });
  console.log(`  ${fmt.padEnd(4)} ${quoi.padEnd(10)} ${vise.padEnd(8)} superposées ${j.superposees} · CLS ${j.cls} · clignote ${j.clignote} · remontages ${j.remontages} · sauts ${j.sauts} · 1er contenu ${j.premierContenu} ms · ${j.images} images${j.captures ? ' · ' + j.captures + ' captures' : ''}`);
  console.log(`       ${j.suite}`);
  if (j.exemple) console.log(`       ⚠ ${j.exemple}`);
  if (process.env.DEBUG && j.clsSources.length) console.log('       décalages : ' + j.clsSources.join(' ; '));
  dit(j.superposees === 0, `${fmt} ${quoi} ${vise} : une seule couche à la fois (${j.superposees} images superposées${j.exemple ? ', ex. ' + j.exemple : ''})`);
  dit(j.cls < SEUIL_CLS, `${fmt} ${quoi} ${vise} : CLS ${j.cls} < ${String(SEUIL_CLS).replace('.', ',')}${j.clsSources.length ? ' (' + j.clsSources.slice(0, 2).join(' ; ') + ')' : ''}`);
  dit(j.clignote === 0, `${fmt} ${quoi} ${vise} : aucun clignotement (${j.clignote}${j.trous && j.trous.length ? ' : vide ' + j.trous.join(', ') : ''})`);
  dit(j.remontages === 0, `${fmt} ${quoi} ${vise} : l'écran montré n'est pas remonté (${j.remontages})`);
  dit(j.sauts === 0, `${fmt} ${quoi} ${vise} : aucun saut de défilement (${j.sauts})`);
  if (j.restes) {
    dit(!j.restes.attentes.length, `${fmt} ${quoi} ${vise} : au calme, plus rien n'attend dans la fenêtre${j.restes.attentes.length ? ' (' + j.restes.attentes.join(' · ') + ')' : ''}`);
    dit(!j.restes.vides, `${fmt} ${quoi} ${vise} : aucune vignette vide (${j.restes.vides} vides, ${j.restes.photos} photos)`);
    // Toute annonce, vente et achat de la base du banc porte une photo : avec le relais seul (iPhone), chaque vignette de
    // la fenêtre doit DESSINER la sienne (une icône à la place = la photo n'est pas passée par le relais).
    if (PHOTOS_IPHONE && j.restes.photos + j.restes.icones + j.restes.vides > 0) dit(j.restes.icones + j.restes.vides === 0, `${fmt} ${quoi} ${vise} : photos par le relais seul (iPhone) — ${j.restes.photos} dessinées, ${j.restes.icones} icônes, ${j.restes.vides} vides`);
  }
}

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + PORT] });
  const sortie = [];
  console.log(`Banc couches-chargement · ${path.relative(process.cwd(), DIST) || DIST} · CPU ×${CPU} · 4G ${DEBIT * 8 / 1e6} Mbit/s · ${FORMATS.join(', ')}`);
  try {
    for (const fmt of FORMATS) {
      const tel = fmt === 'tel';
      const ctx = await nav.newContext(tel
        ? { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', serviceWorkers: 'allow' }
        : { viewport: { width: 1512, height: 945 }, screen: { width: 1512, height: 945 }, deviceScaleFactor: 1, locale: 'fr-FR', serviceWorkers: 'allow' });
      await preparer(ctx);
      // 0) une visite de chaque onglet : les copies se rangent (la même avant et après)
      {
        const pg = await ctx.newPage(); const cdp = await cdpDe(pg);
        await aller(pg, `http://localhost:${PORT}/?tab=journee`, 'domcontentloaded');
        await pret(pg, 'journee', 120000); await calme(pg, 1500, 20000); await attendre(3000);
        for (const id of ECRANS) { await toucher(pg, id, tel).catch(() => {}); await pret(pg, id); await calme(pg, 1500, 15000); await attendre(3500); }
        await cdp.detach().catch(() => {}); await pg.close();
      }
      console.log(`[${fmt}] A) ouverture de l'app sur l'onglet`);
      for (const id of ECRANS) {
        const pg = await ctx.newPage(); const cdp = await cdpDe(pg);
        const fin = await rafale(cdp, path.join(RAFALE, `${fmt}-ouverture-${id}`));
        await aller(pg, `http://localhost:${PORT}/?tab=${id}`, 'commit');
        await pret(pg, id, 60000); await calme(pg, 1500, PENDRE ? 30000 : 20000); await attendre(800);
        const rel = await pg.evaluate(() => window.__vrmCouches.arreter());
        const n = await fin(); const j = juger(rel, id); j.captures = n; j.restes = await restes(pg);
        rapporter(fmt, 'ouverture', id, j, sortie);
        await cdp.detach().catch(() => {}); await pg.close();
      }
      console.log(`[${fmt}] B) toucher de chaque onglet (1er tour : 1re visite ; 2e tour : écrans gardés)`);
      {
        const pg = await ctx.newPage(); const cdp = await cdpDe(pg);
        await aller(pg, `http://localhost:${PORT}/?tab=journee`, 'domcontentloaded');
        await pret(pg, 'journee', 120000); await calme(pg, 1500, 20000); await attendre(2500);
        await pg.evaluate(() => window.__vrmCouches.arreter());
        const ordre = ECRANS.filter((x) => x !== 'journee').concat(['journee']);
        for (const tour of [1, 2]) for (const id of ordre) {
          const j = await visite(pg, cdp, `${fmt}-toucher${tour}-${id}`, id, () => toucher(pg, id, tel), 15000);
          rapporter(fmt, 'toucher ' + tour, id, j, sortie);
        }
        // C) le défilement conservé : Ventes descendue de 700 px, un autre onglet, puis Ventes
        console.log(`[${fmt}] C) défilement conservé au retour`);
        for (const id of ['ventes', 'annonces']) {
          await toucher(pg, id, tel); await pret(pg, id); await calme(pg, 1000, 10000);
          const avant = await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); const se = document.scrollingElement; const el = m && m.scrollHeight > m.clientHeight + 10 && getComputedStyle(m).overflowY !== 'visible' ? m : se; el.scrollTop = 700; return Math.round(el.scrollTop); });
          await attendre(600);
          await toucher(pg, 'journee', tel); await pret(pg, 'journee'); await calme(pg, 1000, 10000);
          if (process.env.DEBUG) await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); window.__defil = []; const t0 = performance.now(); const f = () => { const mm = document.querySelector('.vrm-main'); window.__defil.push(Math.round(performance.now() - t0) + ':' + (mm ? Math.round(mm.scrollTop) + '/' + Math.round(mm.scrollHeight) : '-')); if (performance.now() - t0 < 12000) setTimeout(f, 150); }; f(); });
          await toucher(pg, id, tel); await pret(pg, id); await calme(pg, 1000, 10000); await attendre(500);
          if (process.env.DEBUG) console.log('       défilement ' + id + ' : ' + (await pg.evaluate(() => (window.__defil || []).join(' '))));
          const apres = await pg.evaluate(() => Math.round(Math.max(document.scrollingElement.scrollTop, (document.querySelector('.vrm-main') || {}).scrollTop || 0)));
          sortie.push({ fmt, quoi: 'defilement', vise: id, avant, apres });
          dit(avant > 100 && Math.abs(apres - avant) <= 8, `${fmt} défilement de ${id} conservé au retour (${avant} px → ${apres} px)`);
        }
        await cdp.detach().catch(() => {}); await pg.close();
      }
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  const somme = (k) => sortie.filter((x) => x[k] != null).reduce((a, x) => a + x[k], 0);
  const resume = { superposees: somme('superposees'), clsMax: Math.max(0, ...sortie.filter((x) => x.cls != null).map((x) => x.cls)), clignotements: somme('clignote'), remontages: somme('remontages'), sauts: somme('sauts'), verts: ok, rouges: ko };
  console.log('\nRésumé : ' + JSON.stringify(resume));
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify({ resume, visites: sortie }, null, 1));
  console.log(ko ? `\n${ko} ROUGE(S), ${ok} verts` : `\nTout vert (${ok})`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); srv.close(); process.exit(2); });
