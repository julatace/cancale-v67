require('./_porte-banc.cjs');
// ═════════════════════════════════════════════════════════════════════════════
//  BANC « CHASSE DU 22 NOV. » — Julien : « regarde ce qui ne marche pas bien dans l'app ».
//  Un vendeur au téléphone (390 tactile, CPU ×4, 4G) et à l'ordinateur (1440 / 1512), clair et sombre, sur la
//  base inventée au VOLUME de la sienne (_base-volume.cjs, + 1 000 annonces). Pour chaque écran : ouvrir,
//  attendre la fin du chargement (et dire s'il ne finit jamais), défiler jusqu'en bas (captures haut + bas),
//  ouvrir la 1re rangée (fiche) puis revenir par le GESTE (history.back) et par Échap, recharger.
//  Il RAPPORTE (JSON + console) : erreurs JS / console, garde-fou, clés de traduction brutes (« xx.yy »),
//  « undefined / NaN », débordement horizontal, contraste < 4,5 (texte < 24 px), cibles < 44 px (tactile),
//  couleurs interdites (violet ; rouge hors doublon ; bleu vif hors accent #0068D6), chargements sans fin
//  (squelette / « Chargement » encore là après 12 s), retour qui perd l'écran, recharge qui change d'écran,
//  et les nombres des en-têtes (pour comparer deux écrans à la main). Un banc ne meurt pas : il rapporte.
//  VUES=tel,tel-sombre,ordi,ordi-sombre  ECRANS=journee,…  SORTIE=<dossier>
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require('playwright');
const { fabriquer, repondre } = require('./_base-volume.cjs');
const R = path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(R, 'dist');
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'vrm-bancs', 'chasse-22nov');
fs.mkdirSync(SORTIE, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const VUES = { tel: { W: 390, H: 844, t: true, s: false }, 'tel-sombre': { W: 390, H: 844, t: true, s: true }, ordi: { W: 1440, H: 900, t: false, s: false }, 'ordi-sombre': { W: 1512, H: 950, t: false, s: true } };
const CHOIX = liste('VUES', 'tel,tel-sombre,ordi,ordi-sombre');
const ECRANS = liste('ECRANS', 'journee,annonces,garage,ventes,achats,compta,dashboard,messages,emails,settings,menu,extension,automatisations,litiges,vintedaccounts');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent((q.url || '/').split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
const rapport = [];
const note = (vue, ecran, quoi, detail) => { rapport.push({ vue, ecran, quoi, detail }); console.log(`❌ [${vue} ${ecran}] ${quoi}${detail ? ' — ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400) : ''}`); };

async function ouvrir(nav, nom, base) {
  const V = VUES[nom];
  const ctx = await nav.newContext({ viewport: { width: V.W, height: V.H }, isMobile: V.t, hasTouch: V.t, deviceScaleFactor: V.t ? 2 : 1, locale: 'fr-FR', colorScheme: V.s ? 'dark' : 'light', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  pg.on('dialog', (d) => d.dismiss().catch(() => {}));
  const J = { erreurs: [], lectures: [] };
  pg.on('pageerror', (e) => { if (/^\s*at <anonymous>/m.test(String(e.stack || '').split('\n')[1] || '')) return; J.erreurs.push('pageerror ' + String(e.message || e).slice(0, 240)); });
  pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') { const t = m.text(); if (!/Failed to load resource|ERR_INTERNET|net::ERR|favicon|status of 50[23]|preload|ERR_FAILED/.test(t)) J.erreurs.push(m.type() + ' ' + t.slice(0, 240)); } });
  await pg.addInitScript(([s]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, [V.s]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/supabase\.co/.test(r.request().url()) ? r.fallback() : r.abort()));
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request(); const url = rq.url();
    J.lectures.push({ m: rq.method(), u: decodeURIComponent(url).replace(/^.*\/rest\/v1\//, ''), t: Date.now() });
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }).catch(() => {});
    const h = await rq.allHeaders().catch(() => ({}));
    const rep = repondre(url, h.range, base);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }).catch(() => {});
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: /mode=abonnement/.test(r.request().url()) ? '{"ok":true,"acces":true,"statut":"active","configure":true}' : /mode=equipe/.test(r.request().url()) ? '{"ok":true,"equipe":[],"invitations":[],"membreDe":[],"aBoutique":true}' : '{"pret":true,"devices":1}' }));
  if (V.t) {
    const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8 * 4, uploadThroughput: 750 * 1024 / 8 * 4 });
  }
  return { ctx, pg, J, V };
}

// La sonde : tout ce qui se voit sur l'écran (et sous lui, défilé).
const sonde = (pg, tactile) => pg.evaluate((tactile) => {
  const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.05 && !e.closest('[inert],[aria-hidden="true"],[hidden]'); };
  const racine = document.querySelector('.vrm-main') || document.body;
  const texte = (document.body.innerText || '').replace(/\s+/g, ' ');
  const faux = (texte.match(/.{0,40}(\bundefined\b|\bNaN\b|\[object Object\]|\bnull €|Infinity|\{[a-z]+\}).{0,40}/g) || []).slice(0, 4);
  // Clé de traduction brute : « mot.mot(.mot) » sans espace, hors domaines, nombres et fichiers.
  const cles = [...new Set((texte.match(/(?<![\w@/.])[a-z][a-zA-Z0-9]{1,}(?:\.[a-zA-Z][a-zA-Z0-9_]+){1,5}(?![\w/])/g) || [])
    .filter((k) => !/\.(fr|com|center|it|es|de|co|uk|net|org|js|jsx|zip|png|jpg|pdf|io|app|be|nl|eu|html)$/i.test(k) && !/^(www|vinted|leboncoin|ebay|vrm|vestiairecollective|e\.g|i\.e|ex)\./i.test(k)))].slice(0, 8);
  const garde = [...document.querySelectorAll('[data-garde-ecran],[data-garde-morceau]')].filter((e) => vis(e)).map((e) => e.getAttribute('data-garde-morceau') || e.getAttribute('data-garde-ecran') || '?');
  const souci = /Cet écran a un souci|Something went wrong|Une erreur est survenue/i.test(texte);
  const deborde = document.documentElement.scrollWidth > window.innerWidth + 1 ? document.documentElement.scrollWidth : 0;
  // Éléments plus larges que l'écran (même si un parent coupe) : un tableau qui fuit.
  const fuites = [];
  for (const e of racine.querySelectorAll('*')) { if (fuites.length > 3) break; const b = e.getBoundingClientRect(); if (b.width > 0 && b.right > window.innerWidth + 4 && vis(e) && !e.closest('[style*="overflow"],.n-defile-x,[data-defile-x]')) { const s = getComputedStyle(e.parentElement || e); if (s.overflowX === 'visible') fuites.push(`${e.tagName.toLowerCase()}.${String(e.className || '').split(' ')[0]} → ${Math.round(b.right)}`); } }
  // Couleurs.
  const rgb = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return { h, s, l }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fond = (e) => { let x = e; const pile = []; while (x && x.nodeType === 1) { const c = rgb(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 0.95) break; } if (getComputedStyle(x).backgroundImage !== 'none' && !pile.length) return null; x = x.parentElement; } let base = pile.length && pile[pile.length - 1].a >= 0.95 ? pile.pop() : (document.documentElement.dataset.theme === 'dark' || matchMedia('(prefers-color-scheme: dark)').matches ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 }); while (pile.length) { const c = pile.pop(); base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a), a: 1 }; } return base; };
  const contrastes = [], interdites = [];
  let nTextes = 0;
  for (const e of racine.querySelectorAll('*')) {
    if (!vis(e)) continue;
    const s = getComputedStyle(e);
    const propre = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    const b = e.getBoundingClientRect();
    if (b.bottom < 0 || b.top > window.innerHeight) continue;   // l'écran visible seulement
    if (propre) {
      nTextes++;
      const c = rgb(s.color); const f = fond(e);
      if (c && f) {
        const op = parseFloat(s.opacity) * (e.parentElement ? parseFloat(getComputedStyle(e.parentElement).opacity) : 1);
        const cc = { r: c.r * c.a * op + f.r * (1 - c.a * op), g: c.g * c.a * op + f.g * (1 - c.a * op), b: c.b * c.a * op + f.b * (1 - c.a * op) };
        const L1 = lum(cc), L2 = lum(f); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const taille = parseFloat(s.fontSize); const gras = parseInt(s.fontWeight, 10) >= 700;
        const seuil = taille >= 24 || (taille >= 18.66 && gras) ? 3 : 4.5;
        if (ratio < seuil && !e.closest('[disabled],[aria-disabled="true"],input::placeholder')) contrastes.push(`${ratio.toFixed(2)} « ${e.textContent.trim().slice(0, 28)} » ${Math.round(taille)}px`);
      }
    }
    // Couleurs interdites : violet partout ; rouge hors doublon de N° ; bleu vif autre que l'accent.
    for (const [prop, v] of [['color', s.color], ['fond', s.backgroundColor], ['bord', s.borderTopColor]]) {
      if (prop === 'bord' && parseFloat(s.borderTopWidth) === 0) continue;
      if (prop === 'color' && !propre) continue;
      const c = rgb(v); if (!c || c.a < 0.35) continue;
      const { h, s: sat, l } = hsl(c);
      if (sat < 0.45 || l < 0.18 || l > 0.85) continue;
      const doublon = !!e.closest('[data-doublon],[data-n-doublon],[class*="doublon"]');
      let k = null;
      if (h >= 262 && h <= 320) k = 'violet';
      else if ((h <= 10 || h >= 345) && !doublon) k = 'rouge';
      else if (h >= 200 && h <= 240 && sat > 0.85 && !(Math.abs(c.r - 0) < 12 && Math.abs(c.g - 104) < 16 && Math.abs(c.b - 214) < 16) && !(c.r < 40 && c.g > 120 && c.g < 160 && c.b > 230)) k = 'bleu vif';
      if (k) interdites.push(`${k} ${prop} ${v} « ${(e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 24)} »`);
    }
  }
  let petites = [];
  if (tactile) {
    for (const e of document.querySelectorAll('button, a[href], [role="button"], [role="tab"], input:not([type=hidden]), select')) {
      if (!vis(e) || (e.closest('p, li > span') && e.tagName === 'A')) continue;
      const b = e.getBoundingClientRect();
      if (b.bottom < 0 || b.top > window.innerHeight) continue;
      let w = b.width, h = b.height;
      for (const ps of ['::before', '::after']) { const s = getComputedStyle(e, ps); if (s.position === 'absolute' && s.content !== 'none') { const ins = (k) => parseFloat(s[k]) || 0; w = Math.max(w, b.width - ins('left') - ins('right'), parseFloat(s.width) || 0); h = Math.max(h, s.height !== 'auto' && parseFloat(s.height) ? parseFloat(s.height) : b.height - ins('top') - ins('bottom')); } }
      if (w < 43.5 || h < 43.5) petites.push(`${(e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 22)} ${Math.round(w)}×${Math.round(h)}`);
    }
  }
  const coupes = [];
  for (const e of document.querySelectorAll('h1,h2,h3,button,[role="row"] span,.n-rangee-titre,.n-titre,[role="tab"],th,td')) {
    if (!vis(e) || e.getBoundingClientRect().width <= 2) continue;
    const s = getComputedStyle(e);
    const rg = document.createRange(); rg.selectNodeContents(e); const lt = rg.getBoundingClientRect().width;
    if (lt > e.getBoundingClientRect().width + 2 && s.overflowX !== 'visible' && s.textOverflow !== 'ellipsis' && !/\d/.test(s.webkitLineClamp || '') && s.whiteSpace !== 'normal') coupes.push((e.innerText || '').trim().slice(0, 30));
    if (coupes.length > 5) break;
  }
  // Chargement : squelettes, « Chargement… », aria-busy.
  const charge = [...document.querySelectorAll('[aria-busy="true"],.n-squelette,[class*="squelette"],[class*="skeleton"],[data-squelette]')].filter(vis).length
    + ((texte.match(/Chargement|chargement…|Lecture…|lecture…|Patiente/g) || []).length);
  // Les nombres des titres / segments / en-têtes de groupe (pour comparer d'un écran à l'autre).
  const nombres = [...document.querySelectorAll('h1,h2,h3,[role="tab"],.n-groupe-tete,.n-segment,[data-n-onglet],summary')].filter(vis).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter((t) => /\d/.test(t) && t.length < 80).slice(0, 30);
  const rangees = [...document.querySelectorAll('[data-vn-rang],[data-fiche-ligne],.n-rangee,[role="row"]')].filter(vis).length;
  return { titre: (document.querySelector('h1') || {}).innerText || '', ecran: (document.querySelector('#vrm-contenu') || {}).dataset ? document.querySelector('#vrm-contenu')?.dataset.ecran : '', texte: texte.slice(0, 200), faux, cles, garde, souci, deborde, fuites, contrastes: contrastes.slice(0, 6), nContrastes: contrastes.length, nTextes, interdites: [...new Set(interdites)].slice(0, 6), petites: petites.slice(0, 8), nPetites: petites.length, coupes, charge, nombres, rangees, url: location.search };
}, tactile);

const aller = (pg, t) => pg.evaluate((t) => { try { window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + t })); } catch (_) {} }, t);
async function attendreCharge(pg, max) {
  const t0 = Date.now(); let s;
  for (;;) { s = await pg.evaluate(() => [...document.querySelectorAll('[aria-busy="true"],.n-squelette,[class*="squelette"],[class*="skeleton"],[data-squelette]')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }).length).catch(() => 0); if (!s || Date.now() - t0 > max) break; await pg.waitForTimeout(300); }
  return { ms: Date.now() - t0, reste: s };
}

async function main() {
  await new Promise((r) => srv.listen(Number(process.env.BANC_PORT) || 0, r));
  const PORT = srv.address().port; const ICI = `http://localhost:${PORT}`;
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const mesures = [];
  try {
    for (const nom of CHOIX) {
      const base = fabriquer({ volumeReel: true, annonces: 1000 });
      const { ctx, pg, J, V } = await ouvrir(nav, nom, base);
      try {
        const t0 = Date.now();
        await pg.goto(`${ICI}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('.vrm-main, main', { timeout: 60000 }).catch(() => {});
        await pg.waitForFunction(() => { const d = document.getElementById('vrm-demarrage'); return !d || d.hasAttribute('data-sortie') || getComputedStyle(d).opacity === '0'; }, null, { timeout: 60000 }).catch(() => {});
        mesures.push({ vue: nom, ecran: '(démarrage)', ms: Date.now() - t0 });
        for (const ec of ECRANS) {
          const av = J.erreurs.length, l0 = J.lectures.length, ta = Date.now();
          await aller(pg, ec);
          await pg.waitForTimeout(600);
          const ch = await attendreCharge(pg, 12000);
          await pg.waitForTimeout(700);
          let s = await sonde(pg, V.t);
          await pg.screenshot({ path: path.join(SORTIE, `${nom}-${ec}-haut.png`) }).catch(() => {});
          if (ch.reste) note(nom, ec, 'chargement qui ne finit pas (12 s)', `${ch.reste} squelette(s) encore là`);
          // Défiler jusqu'en bas, par écrans.
          let bas = null, sauts = 0, hPrec = 0;
          for (let i = 0; i < 40; i++) {
            const r = await pg.evaluate(() => { const el = [document.scrollingElement, ...document.querySelectorAll('.vrm-main, [data-defile], .n-page, .n-volet-corps')].filter((x) => x && x.scrollHeight > x.clientHeight + 20).sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || document.scrollingElement; const av = el.scrollTop; el.scrollTop = av + el.clientHeight * 0.9; return { av, ap: el.scrollTop, h: el.scrollHeight }; }).catch(() => null);
            await pg.waitForTimeout(250);
            if (!r || r.ap === r.av) break;
            if (hPrec && Math.abs(r.h - hPrec) > 400) sauts++;
            hPrec = r.h;
          }
          await pg.waitForTimeout(500);
          bas = await sonde(pg, V.t);
          await pg.screenshot({ path: path.join(SORTIE, `${nom}-${ec}-bas.png`) }).catch(() => {});
          await pg.evaluate(() => { for (const el of [document.scrollingElement, ...document.querySelectorAll('.vrm-main, [data-defile], .n-page')]) if (el) el.scrollTop = 0; }).catch(() => {});
          const tous = [s, bas];
          const err = J.erreurs.slice(av);
          if (err.length) note(nom, ec, 'erreurs JS / console', [...new Set(err)].join(' ¦ '));
          for (const x of tous) {
            if (x.souci || x.garde.length) note(nom, ec, 'garde-fou', x.garde.join(',') + ' ' + x.texte);
            if (x.cles.length) note(nom, ec, 'clés de traduction brutes', x.cles.join(' | '));
            if (x.faux.length) note(nom, ec, '« undefined / NaN / {var} » à l\'écran', x.faux.join(' | '));
            if (x.deborde) note(nom, ec, 'débordement horizontal', x.deborde);
            if (x.fuites.length) note(nom, ec, 'élément plus large que l\'écran', x.fuites.join(' | '));
            if (x.nContrastes) note(nom, ec, `contraste < 4,5 (${x.nContrastes}/${x.nTextes})`, x.contrastes.join(' | '));
            if (x.interdites.length) note(nom, ec, 'couleur interdite', x.interdites.join(' | '));
            if (x.nPetites) note(nom, ec, `cibles < 44 px (${x.nPetites})`, x.petites.join(' · '));
            if (x.coupes.length) note(nom, ec, 'texte coupé sans « … »', x.coupes.join(' | '));
          }
          if (s.ecran && s.ecran !== ec && !(ec === 'menu')) note(nom, ec, 'l\'écran monté n\'est pas celui demandé', `${s.ecran} (titre « ${s.titre} »)`);
          const lect = J.lectures.slice(l0).filter((x) => x.m === 'GET');
          const comptes = {}; for (const x of lect) comptes[x.u] = (comptes[x.u] || 0) + 1;
          const doubles = Object.entries(comptes).filter(([, n]) => n > 3).map(([u, n]) => `${n}× ${u.slice(0, 100)}`);
          if (doubles.length) note(nom, ec, 'même lecture plus de 3 fois', doubles.slice(0, 4).join(' ¦ '));
          // La fiche de la 1re rangée, puis retour par le geste (history.back), puis par Échap.
          let fiche = null;
          const rang = pg.locator('.vrm-main [data-vn-rang], .vrm-main [data-fiche-ligne], .vrm-main .n-rangee[role="button"], .vrm-main [data-eg-article], .vrm-main [role="row"][tabindex]').filter({ visible: true }).first();
          if (await rang.count().catch(() => 0)) {
            const av2 = J.erreurs.length;
            await rang.click({ timeout: 3000 }).catch(() => {});
            await pg.waitForTimeout(1800);
            fiche = await sonde(pg, V.t);
            await pg.screenshot({ path: path.join(SORTIE, `${nom}-${ec}-fiche.png`) }).catch(() => {});
            if (fiche.souci || fiche.garde.length) note(nom, ec + ' (fiche)', 'garde-fou', fiche.texte);
            if (fiche.cles.length) note(nom, ec + ' (fiche)', 'clés de traduction brutes', fiche.cles.join(' | '));
            if (fiche.faux.length) note(nom, ec + ' (fiche)', '« undefined / NaN » à l\'écran', fiche.faux.join(' | '));
            if (fiche.deborde) note(nom, ec + ' (fiche)', 'débordement horizontal', fiche.deborde);
            if (fiche.nContrastes) note(nom, ec + ' (fiche)', `contraste < 4,5 (${fiche.nContrastes}/${fiche.nTextes})`, fiche.contrastes.join(' | '));
            if (fiche.interdites.length) note(nom, ec + ' (fiche)', 'couleur interdite', fiche.interdites.join(' | '));
            if (fiche.nPetites) note(nom, ec + ' (fiche)', `cibles < 44 px (${fiche.nPetites})`, fiche.petites.join(' · '));
            const urlAvant = pg.url();
            await pg.evaluate(() => history.back()).catch(() => {});
            await pg.waitForTimeout(1500);
            if (!pg.url().startsWith(ICI)) { note(nom, ec, 'le retour (geste) après la fiche QUITTE l\'app', pg.url()); await pg.goto(`${ICI}/?tab=${ec}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(3000); }
            else {
              const apres = await pg.evaluate(() => ({ e: document.querySelector('#vrm-contenu')?.dataset.ecran || '', feuille: !!document.querySelector('.n-feuille, [role="dialog"]:not([hidden])'), u: location.search })).catch(() => ({}));
              if (apres.e && s.ecran && apres.e !== s.ecran) note(nom, ec, 'le retour (geste) après la fiche perd l\'écran', `${s.ecran} → ${apres.e} (${urlAvant.replace(ICI, '')} → ${apres.u})`);
              if (apres.feuille) { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(600); const encore = await pg.evaluate(() => !!document.querySelector('.n-feuille, [role="dialog"]:not([hidden])')).catch(() => false); if (encore) note(nom, ec, 'la fiche reste ouverte après le retour ET Échap', ''); }
            }
            const e2 = J.erreurs.slice(av2); if (e2.length) note(nom, ec + ' (fiche)', 'erreurs JS / console', [...new Set(e2)].join(' ¦ '));
          }
          mesures.push({ vue: nom, ecran: ec, ms: Date.now() - ta, chargeMs: ch.ms, sauts, haut: { titre: s.titre, ecran: s.ecran, nombres: s.nombres, rangees: s.rangees, charge: s.charge }, fiche: fiche ? { titre: fiche.titre, texte: fiche.texte } : null });
        }
        // Rechargement sur chaque écran du bas : l'écran reste le même.
        for (const ec of ['annonces', 'ventes', 'achats', 'compta'].filter((x) => ECRANS.includes(x))) {
          await pg.goto(`${ICI}/?tab=${ec}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await pg.waitForFunction(() => { const d = document.getElementById('vrm-demarrage'); return !d || d.hasAttribute('data-sortie') || getComputedStyle(d).opacity === '0'; }, null, { timeout: 60000 }).catch(() => {});
          await pg.waitForTimeout(3500);
          const e = await pg.evaluate(() => document.querySelector('#vrm-contenu')?.dataset.ecran || '').catch(() => '');
          if (e && e !== ec) note(nom, ec, 'le rechargement ouvre un autre écran', e);
        }
      } catch (e) { note(nom, '*', 'le parcours a pu jouer', e && e.message); }
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  fs.writeFileSync(path.join(SORTIE, 'rapport.json'), JSON.stringify({ rapport, mesures }, null, 1));
  console.log(`\n${rapport.length} défauts notés · captures et rapport.json : ${SORTIE}`);
  process.exit(rapport.length ? 1 : 0);
}
main();
