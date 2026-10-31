require('./_porte-banc.cjs');
// BANC — « Je publie sur eBay, j'appuie sur un bouton… et je me retrouve sur
// Vestiaire Collective » (Julien, 16 octobre).
//
// Mesuré : VRM n'a AUCUN code qui publie sur Vestiaire. L'onglet voisin d'eBay
// dans la liste des plateformes est Vestiaire, et le balayage entre onglets
// (souris : glisser de 110 px ; doigt : 70 px) y menait — un clic légèrement
// glissé sur un bouton, ou un défilement horizontal des photos, suffisait.
//
// Ce banc rend l'écran eBay (aucune donnée réelle : base vide) et exige :
//   · un geste parti d'un BOUTON ne change jamais d'onglet (souris et doigt) ;
//   · un balayage franc sur une zone vide ne mène JAMAIS à Vestiaire (il n'est
//     pas dans la barre du bas) ;
//   · l'autre sens : le balayage entre onglets existe toujours (Vinted ⇄
//     Leboncoin) — « tout couper » passerait les deux premiers contrôles.
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4951;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'banc@exemple.fr' } };

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${!bon && det ? ' — ' + det : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});

async function page(nav, telephone, tab) {
  const ctx = await nav.newContext(telephone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_prenom', JSON.stringify('Shopcancale')); } catch (_) {} }, SESSION);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' }));
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  return { ctx, pg };
}
// L'écran affiché : le lien de navigation marqué « page courante ».
const ecran = (pg) => pg.evaluate(() => {
  const el = document.querySelector('.vrm-sidebar-link[aria-current="page"]') || [...document.querySelectorAll('nav [aria-current="page"], .vrm-bottom-nav [aria-current="page"]')].pop();
  // (31 oct., navigation par tâche) l'onglet ET le site filtré (Ventes · eBay).
  const t = document.querySelector('[data-tache]');
  return ((el ? (el.innerText || el.getAttribute('aria-label') || '').trim() : '') + (t ? ' · ' + t.getAttribute('data-tache-site') : '')).trim();
});
async function glisserSouris(pg, x, y, dx) {
  await pg.mouse.move(x, y); await pg.mouse.down();
  for (let i = 1; i <= 10; i++) await pg.mouse.move(x + (dx * i) / 10, y);
  await pg.mouse.up(); await pg.waitForTimeout(600);
}
async function glisserDoigt(pg, x, y, dx, appuiMs = 0) {
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  if (appuiMs) await pg.waitForTimeout(appuiMs);
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / 8, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pg.waitForTimeout(600);
}
// Le premier bouton visible du contenu (pas la navigation).
// Un bouton de l'écran eBay lui-même (ses sous-onglets « Annonces » /
// « Compte »), jamais la navigation de l'app. La base est vide : ce sont les
// seuls boutons sûrs d'exister.
const unBouton = (pg) => pg.evaluate(() => {
  for (const b of document.querySelectorAll('button')) {
    // (31 oct.) Depuis la navigation par tâche, l'écran eBay est « Ventes · eBay » : ses
    // pastilles de filtre de site sont les boutons sûrs d'exister.
    if (b.closest('.vrm-sidebar') || b.closest('.vrm-mobile-nav') || !/^(Annonces|Compte|Toutes)$/.test(b.innerText.trim())) continue;
    const r = b.getBoundingClientRect();
    if (r.width > 20 && r.height > 14 && r.top > 40 && r.bottom < innerHeight - 70) return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: b.innerText.trim() };
  }
  return null;
});

(async () => {
  try { await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }); }
  catch (e) { console.log(`❌ port ${PORT} pris — relance ce banc seul`); process.exit(1); }
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  try {
    console.log('── ordinateur (souris)');
    {
      const { ctx, pg } = await page(nav, false, 'plat_ebay');
      const avant = await ecran(pg);
      dit(/ebay/i.test(avant), 'l’écran eBay est ouvert', avant);
      const b = await unBouton(pg);
      dit(!!b, 'un bouton de l’écran eBay est trouvé', '');
      if (b) await glisserSouris(pg, b.x, b.y, 160);   // UN sens : un aller-retour reviendrait sur eBay (vert par accident)
      const apresBouton = await ecran(pg);
      dit(/ebay/i.test(apresBouton), 'un clic glissé sur un bouton ne change pas d’onglet', `→ ${apresBouton}`);
      await glisserSouris(pg, 900, 880, 300);
      const apresVide = await ecran(pg);
      dit(!/vestiaire/i.test(apresVide), 'un balayage depuis eBay ne mène jamais à Vestiaire', `→ ${apresVide}`);
      await ctx.close();
    }
    {
      // 24 oct. (décision) : AUCUN balayage global à la souris. Un glisser franc
      // sur une zone vide reste donc sur Vinted ; l'autre sens est vérifié au
      // doigt plus bas (le balayage n'existe plus qu'au toucher).
      const { ctx, pg } = await page(nav, false, 'plat_vinted');
      await glisserSouris(pg, 900, 880, -300);
      const e = await ecran(pg);
      dit(/vinted/i.test(e), 'souris : glisser sur une zone vide ne change plus de plateforme (décision du 24 oct.)', `→ ${e}`);
      await ctx.close();
    }
    console.log('── téléphone (doigt)');
    {
      const { ctx, pg } = await page(nav, true, 'plat_ebay');
      const e0 = await ecran(pg);
      dit(/ebay/i.test(e0), 'l’écran eBay est ouvert (et le banc sait lire l’onglet courant au téléphone)', `« ${e0} »`);
      const b = await unBouton(pg);
      if (b) await glisserDoigt(pg, b.x, b.y, 150);
      const e1 = await ecran(pg);
      dit(!b || !/vestiaire|leboncoin/i.test(e1), 'un geste parti d’un bouton ne change pas d’onglet', `→ ${e1}`);
      await glisserDoigt(pg, 200, 780, 200);
      const e2 = await ecran(pg);
      dit(!/vestiaire/i.test(e2), 'un balayage depuis eBay ne mène jamais à Vestiaire', `→ ${e2}`);
      await ctx.close();
    }
    {
      // L'autre sens : au DOIGT, le balayage existe toujours entre Vinted et Leboncoin.
      const { ctx, pg } = await page(nav, true, 'plat_vinted');
      await glisserDoigt(pg, 300, 700, -220);
      const e = await ecran(pg);
      // (31 oct.) `?tab=plat_vinted` ouvre Ventes · Vinted ; l'onglet voisin de Ventes est Colis.
      dit(/colis/i.test(e), 'l’autre sens : au doigt, balayer sur une zone vide passe toujours de Ventes à Colis', `→ ${e}`);
      await ctx.close();
    }
    // (17 oct., Julien : « quand je sélectionne Bon après-midi Shopcancale et
    // que je relâche, ça me met dans l'onglet Vinted »). Sélectionner un texte
    // n'est pas balayer : ni à la souris (glisser sur le texte pour le
    // surligner), ni au doigt (appui long, puis le doigt qui glisse).
    console.log('── Ma journée : sélectionner le bonjour');
    const bonjour = (pg) => pg.evaluate(() => { const el = document.querySelector('.vrm-day-hello'); if (!el) return null; const r = el.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(el); const t = rg.getBoundingClientRect(); return { x0: t.left + 4, x1: Math.min(t.right, r.right) - 4, y: r.top + r.height / 2, txt: el.innerText }; });
    {
      const { ctx, pg } = await page(nav, false, 'journee');
      const b = await bonjour(pg);
      dit(!!b && /Shopcancale/.test(b.txt), 'le bonjour est rendu (ordinateur)', b && b.txt);
      if (b) {
        await pg.mouse.move(b.x1, b.y); await pg.mouse.down();
        for (let i = 1; i <= 12; i++) await pg.mouse.move(b.x1 - ((b.x1 - b.x0) * i) / 12, b.y);
        await pg.mouse.up(); await pg.waitForTimeout(600);
      }
      const e = await ecran(pg);
      dit(/journ/i.test(e), 'souris : surligner le bonjour ne change pas d’onglet', `→ ${e}`);
      await ctx.close();
    }
    {
      const { ctx, pg } = await page(nav, true, 'journee');
      const b = await bonjour(pg);
      dit(!!b, 'le bonjour est rendu (téléphone)', '');
      if (b) await glisserDoigt(pg, b.x1, b.y, -Math.max(120, b.x1 - b.x0), 800);
      const e = await ecran(pg);
      dit(/journ|accueil/i.test(e), 'doigt : appui long sur le bonjour puis relâcher en glissant ne change pas d’onglet', `→ ${e}`);
      // L'autre sens : un balayage FRANC et rapide sur une zone vide change toujours d'onglet.
      // (même point de départ, mais un geste franc et rapide : c'est un balayage)
      if (b) await glisserDoigt(pg, Math.min(370, b.x1 + 40), b.y, -260);
      const e2 = await ecran(pg);
      dit(/annonces/i.test(e2), 'l’autre sens : un balayage rapide depuis Ma journée mène toujours à Annonces (l’onglet voisin)', `→ ${e2}`);
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ glisser entre onglets : ${ko} rouge(s)` : '\n✅ glisser entre onglets : jamais vers Vestiaire, jamais depuis un bouton');
  process.exit(ko ? 1 : 0);
})();
