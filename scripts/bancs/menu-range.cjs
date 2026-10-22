require('./_porte-banc.cjs');
// BANC — Le menu rangé (17 octobre, Julien) : « en bas à gauche, Détail Vinted
// avec annonces, ventes et achats, ça figure déjà dans Vinted ; pareil pour
// Outils ; l'onglet Collectif ne sert à rien, il est déjà représenté dans les
// statistiques ; Prix qui marche peut être une rubrique, et Factures peut être
// dans Comptabilité ».
//
// Exige (base vide, aucune fixture), aux deux tailles :
//   · le rail (ordinateur) et la feuille du menu (téléphone) ne portent plus
//     Collectif, Prix qui marche, Factures, ni les groupes « Dans Vinted » et
//     « Autres outils » ;
//   · RIEN N'EST PERDU (§4.11) : « Prix qui marche » est une rubrique de
//     Statistiques, « Factures » une rubrique de Comptabilité, et les anciens
//     liens (`?tab=prixmarche`, `?tab=invoices`, `?tab=collectif`) y mènent.
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4961;
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

// Un compte lié : sans lui l'app est en « premier jour » et Statistiques
// montre la carte de bienvenue au lieu des rubriques.
const COMPTES = [{ account_id: '901', login: 'compte_banc', owner: SESSION.user.id }];
async function page(nav, telephone, tab) {
  const ctx = await nav.newContext(telephone
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1512, height: 950 } });
  const pg = await ctx.newPage();
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(r.request().url());
    const body = /vinted_accounts/.test(u) ? JSON.stringify(COMPTES) : '[]';
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3200);
  return { ctx, pg };
}
const texte = (pg) => pg.evaluate(() => document.body.innerText || '');
const actif = (pg) => pg.evaluate(() => {
  const el = document.querySelector('.vrm-sidebar [aria-current="page"]') || [...document.querySelectorAll('nav [aria-current="page"]')].pop();
  return el ? (el.getAttribute('aria-label') || el.innerText || '').trim() : '';
});
const rubriqueActive = (pg) => pg.evaluate(() => { const b = document.querySelector('.vrm-rubriques [aria-current="page"], .vrm-rubriques [aria-pressed="true"]'); return b ? b.innerText.trim() : ''; });
// Un banc ne meurt pas, il rapporte : un bouton absent (le code d'avant) rend
// un contrôle rouge au lieu d'un « Timeout 30000ms » qui coupe le bilan.
const clique = async (pg, sel, txt) => { const l = pg.locator(sel, { hasText: txt }); if (!(await l.count())) return false; try { await l.first().click({ timeout: 4000 }); await pg.waitForTimeout(500); return true; } catch (_) { return false; } };
const INTERDITS = ['Collectif', 'Prix qui marche', 'Factures', 'Dans Vinted', 'Autres outils'];

(async () => {
  try { await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }); }
  catch (e) { console.log(`❌ port ${PORT} pris — relance ce banc seul`); process.exit(1); }
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  try {
    console.log('── ordinateur : le rail');
    {
      const { ctx, pg } = await page(nav, false, 'journee');
      const rail = await pg.evaluate(() => [...document.querySelectorAll('.vrm-sidebar button')].map((b) => b.getAttribute('aria-label') || b.innerText.trim()));
      for (const m of INTERDITS) dit(!rail.includes(m), `le rail ne porte plus « ${m} »`, rail.join(' · '));
      for (const m of ['Statistiques', 'Comptabilité', 'Colis', 'Stock']) dit(rail.includes(m), `le rail garde « ${m} »`, rail.join(' · '));
      await ctx.close();
    }
    for (const tel of [false, true]) {
      const qui = tel ? 'téléphone' : 'ordinateur';
      console.log(`── ${qui} : les anciens liens mènent à leur nouvelle place`);
      {
        const { ctx, pg } = await page(nav, tel, 'prixmarche');
        const t = await texte(pg);
        dit(/Statistiques/.test(await actif(pg)) || /statistiques/i.test(t), `${qui} : ?tab=prixmarche ouvre Statistiques`, await actif(pg));
        dit(/Prix qui marche/.test(await rubriqueActive(pg)), `${qui} : la rubrique « Prix qui marche » est choisie`, await rubriqueActive(pg));
        dit(/Le prix qui marche/.test(t), `${qui} : le contenu « Le prix qui marche » est rendu`, t.slice(0, 160));
        // Revenir à la vue d'ensemble, puis rouvrir la rubrique : le geste existe.
        const c1 = await clique(pg, '.vrm-rubriques button', 'Vue d’ensemble');
        dit(c1 && !/Le prix qui marche/.test(await texte(pg)), `${qui} : « Vue d’ensemble » quitte la rubrique`, '');
        const c2 = await clique(pg, '.vrm-rubriques button', 'Prix qui marche');
        dit(c2 && /Le prix qui marche/.test(await texte(pg)), `${qui} : la rubrique se rouvre d’un tap`, '');
        await ctx.close();
      }
      {
        const { ctx, pg } = await page(nav, tel, 'invoices');
        const t = await texte(pg);
        dit(/Comptabilit/.test(await actif(pg)) || /Comptabilité/.test(t), `${qui} : ?tab=invoices ouvre Comptabilité`, await actif(pg));
        dit(/Factures/.test(await rubriqueActive(pg)), `${qui} : la rubrique « Factures » est choisie`, await rubriqueActive(pg));
        dit(/Nouvelle facture/.test(t), `${qui} : l’écran des factures est rendu`, t.slice(0, 160));
        await ctx.close();
      }
      {
        const { ctx, pg } = await page(nav, tel, 'collectif');
        const t = await texte(pg);
        dit(!/Toutes tes plateformes réunies/.test(t), `${qui} : ?tab=collectif ne rouvre pas l’écran retiré`, '');
        dit(/Statistiques/.test(await actif(pg)) || /Vue d’ensemble/.test(await rubriqueActive(pg)), `${qui} : ?tab=collectif mène aux Statistiques`, await actif(pg));
        await ctx.close();
      }
    }
    // (17 oct., Julien : « pourquoi il y a deux logos eBay quand on est dessus »)
    // Le logo d'eBay est son nom écrit : devant le titre « eBay », le nom
    // apparaissait deux fois. Une seule fois dans l'en-tête de l'onglet.
    for (const tel of [true, false]) {
      const { ctx, pg } = await page(nav, tel, 'plat_ebay');
      const e = await pg.evaluate(() => { const h = document.querySelector('[data-entete-plateforme="ebay"], .vrm-market-heading'); return h ? { logos: h.querySelectorAll('img[src*="ebay"]').length, titre: (h.querySelector('h1') || {}).innerText || '' } : null; });
      dit(!!e && e.logos === 0 && e.titre === 'eBay', `${tel ? 'téléphone' : 'ordinateur'} : l’en-tête eBay écrit « eBay » une seule fois`, JSON.stringify(e));
      await ctx.close();
    }
    console.log('── téléphone : la feuille du menu');
    {
      const { ctx, pg } = await page(nav, true, 'journee');
      // (20 oct.) Depuis la coque iPhone (#596), l'en-tête garde un bouton
      // « Tous les écrans » CACHÉ sur téléphone : la feuille s'ouvre par
      // « Gestion », dans la barre du bas. On vise le bouton VISIBLE, et on
      // attend qu'il le soit (la porte de connexion peut prendre quelques secondes).
      await pg.locator('button[aria-label="Gestion"]:visible, button[aria-label="Tous les écrans"]:visible').first().waitFor({ timeout: 12000 }).catch(() => {});
      await clique(pg, 'button[aria-label="Gestion"]:visible, button[aria-label="Tous les écrans"]:visible', '');
      const feuille = await pg.evaluate(() => { const m = document.querySelector('.vrm-sheet'); return m ? m.innerText : ''; });
      dit(!!feuille, 'la feuille du menu s’ouvre', '');
      for (const m of INTERDITS) dit(!feuille.includes(m), `la feuille ne porte plus « ${m} »`, feuille.replace(/\n+/g, ' · '));
      for (const m of ['Statistiques', 'Comptabilité']) dit(feuille.includes(m), `la feuille garde « ${m} »`, '');
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ menu rangé : ${ko} rouge(s)` : '\n✅ menu rangé : rien en double, rien de perdu');
  process.exit(ko ? 1 : 0);
})();
