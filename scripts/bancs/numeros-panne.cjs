// ════════════════════════════════════════════════════════════════════════════
//  BANC « NUMÉROS PENDANT UNE PANNE DE SYNCHRO » (18 octobre).
//
//  Mesuré en production : du 11 au 18 octobre, la ligne `main` ne s'enregistrait
//  plus. Chaque ouverture de l'app recopiait le NUAGE (périmé) par-dessus le
//  navigateur : les numéros donnés sur l'appareil disparaissaient, et la
//  numérotation automatique redonnait aux paires des numéros déjà écrits sur
//  des cartons. Le 18 au matin, 36 paires renumérotées d'un coup.
//
//   A. Rechargement pendant la panne : les fiches et le pool de l'appareil
//      SURVIVENT au chargement (fusion), aucune paire n'est renumérotée, une
//      paire neuve ne reçoit JAMAIS un numéro du pool de l'appareil, et ce que
//      l'appareil savait repart vers le nuage.
//   B. « Numéros à vérifier sur tes cartons » : les paires numérotées
//      automatiquement pendant la panne sont listées, avec la preuve eBay par
//      IDENTITÉ (brouillon → annonce eBay → SKU) ; confirmer les retire ;
//      corriger vers le numéro d'une autre paire de la liste lui donne un
//      numéro NEUF et la garde dans la liste.
//  Aucune fixture : tout est inventé.
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT) || 4504;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const JETON = 'jeton-de-banc';
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.fr' }, totp: [] };
const UID = '900000001';
const COMPTE = { vinted_user_id: UID, login: 'compte-de-banc', access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString() };
const item = (id, t) => ({ id, title: t || ('Paire ' + id), price: { amount: '40.0', currency_code: 'EUR' }, is_closed: false, photos: [], brand: 'Nike', size: '42' });
const LISTINGS = (ids) => ({ id: `harvest_${UID}_listings`, data: { capturedAt: new Date().toISOString(), payload: { items: ids.map((i) => item(i.id, i.t)) } } });

let ko = 0;
const dit = (bon, quoi, detail) => { if (!bon) ko++; console.log(`  ${bon ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const ecouter = () => new Promise((res, rej) => {
  srv.once('error', (e) => rej(e.code === 'EADDRINUSE' ? new Error(`le port ${PORT} est déjà pris — relance ce banc seul`) : e));
  srv.listen(PORT, () => res());
});

// `etat` : { main, listings, ecrits[], ebay: { brouillons, listings } | null, panneEcriture }
async function brancher(pg, etat) {
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: JETON, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const req = r.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const json = (d, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': '0-0/0' }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return json([]);
    if (req.method() !== 'GET') {
      try { const b = JSON.parse(req.postData() || '[]'); (Array.isArray(b) ? b : [b]).forEach((row) => { if (row && row.id === 'main' && row.data) etat.ecrits.push(row.data); }); } catch (_) {}
      if (etat.panneEcriture && /app_data/.test(u)) return json({ code: '57014', message: 'canceling statement due to statement timeout' }, 500);
      return json([]);
    }
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json([COMPTE]);
    if (/id=eq\.main/.test(u)) {
      if (/vrm_numerotation/.test(u)) return json([{ v: null }]);
      return json([{ id: 'main', data: etat.main }]);
    }
    if (/_listings/.test(u) && /harvest_/.test(u)) return json([{ ...etat.listings, cap: etat.listings.data.capturedAt }]);
    if (/ebay_brouillons/.test(u)) return json(etat.ebay ? [{ id: 'ebay_brouillons', items: etat.ebay.brouillons }] : []);
    if (/ebay_listings/.test(u)) return json(etat.ebay ? [{ id: 'ebay_listings', items: etat.ebay.listings }] : []);
    return json([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
}
const fichesLocales = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); } catch (_) { return null; } });
const poolLocal = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_used_numeros') || '[]'); } catch (_) { return null; } });

(async () => {
  try { await ecouter(); } catch (e) { console.log('  ❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    // ── A. Rechargement pendant la panne ───────────────────────────────────
    console.log('\n── A. Rechargement pendant la panne : les numéros de l\'appareil survivent');
    {
      // Le nuage est resté au 11 octobre : une seule fiche (N°7), pool 1…10.
      const etat = { main: { vinted_annonce_numeros: { '1001': { numero: '7' } }, vinted_used_numeros: Array.from({ length: 10 }, (_, i) => i + 1), vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 1001 }, { id: 1002 }, { id: 1003 }, { id: 1004 }]), ecrits: [], ebay: null, panneEcriture: false };
      const ctx = await nav.newContext({ viewport: { width: 1512, height: 950 } });
      // L'appareil, lui, a numéroté 1002 et 1003 (N°30 et N°31) pendant la panne.
      await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('_banc')) {
        localStorage.setItem('vrm_session', JSON.stringify(s));
        localStorage.setItem('vinted_annonce_numeros', JSON.stringify({ '1001': { numero: '7' }, '1002': { numero: '30', auto: true, numberedAt: '2026-10-14T10:00:00.000Z' }, '1003': { numero: '31', auto: true, numberedAt: '2026-10-15T10:00:00.000Z' } }));
        localStorage.setItem('vinted_used_numeros', JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 30, 31]));
        sessionStorage.setItem('_banc', '1');
      } } catch (_) {} }, SESSION);
      const pg = await ctx.newPage(); await brancher(pg, etat);
      await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(9000);
      const loc = await fichesLocales(pg) || {}, pool = (await poolLocal(pg) || []).map(String);
      dit(loc['1002'] && String(loc['1002'].numero) === '30' && loc['1003'] && String(loc['1003'].numero) === '31', 'les numéros donnés sur l\'appareil (30, 31) survivent au chargement', JSON.stringify({ 1002: loc['1002'] && loc['1002'].numero, 1003: loc['1003'] && loc['1003'].numero }));
      dit(pool.includes('30') && pool.includes('31'), 'le pool de l\'appareil est gardé (union avec le nuage)', `30:${pool.includes('30')} 31:${pool.includes('31')}`);
      const n4 = loc['1004'] && String(loc['1004'].numero || '');
      dit(!!n4 && !['7', '30', '31'].includes(n4) && !(Number(n4) >= 1 && Number(n4) <= 10), 'la paire neuve reçoit un numéro JAMAIS servi', `N°${n4 || '—'}`);
      const parti = etat.ecrits.some((d) => d.vinted_annonce_numeros && d.vinted_annonce_numeros['1002'] && String(d.vinted_annonce_numeros['1002'].numero) === '30');
      dit(parti, 'ce que l\'appareil savait repart vers le nuage', `${etat.ecrits.length} écriture(s)`);
      await ctx.close();
    }

    // ── B. La liste « Numéros à vérifier sur tes cartons » ────────────────
    for (const taille of [1512, 390]) {
      console.log(`\n── B. Numéros à vérifier sur les cartons (${taille} px)`);
      const PANNE = '2026-10-18T08:26:45.251Z';
      const etat = {
        main: { vinted_annonce_numeros: {
          '2001': { numero: '82', auto: true, numberedAt: PANNE, title: 'Vapor de banc' },
          '2002': { numero: '81', auto: true, numberedAt: PANNE, title: 'Air Max de banc' },
          '2003': { numero: '5', auto: true, numberedAt: '2026-10-10T08:00:00.000Z', title: 'Ancienne de banc' },
        }, vinted_used_numeros: [1, 2, 3, 4, 5, 81, 82], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 2001, t: 'Vapor de banc' }, { id: 2002, t: 'Air Max de banc' }, { id: 2003, t: 'Ancienne de banc' }]),
        ecrits: [], panneEcriture: false,
        ebay: { brouillons: { 'b-1': { id: 'b-1', pairId: '2002', numero: '82', programme: { itemId: '555' } } }, listings: [{ itemId: '555', sku: 'VRM-82', title: 'Air Max de banc' }] },
      };
      const ctx = await nav.newContext(taille === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1512, height: 950 } });
      await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
      const pg = await ctx.newPage(); await brancher(pg, etat);
      const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
      await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-numeros-a-verifier]', { timeout: 15000 }).catch(() => {});
      const n0 = await pg.evaluate(() => { const e = document.querySelector('[data-numeros-a-verifier]'); return e ? Number(e.getAttribute('data-numeros-a-verifier')) : 0; });
      dit(n0 === 2, 'les 2 paires numérotées pendant la panne sont listées (pas l\'ancienne)', `${n0}`);
      await pg.waitForTimeout(1500);
      const preuve = await pg.evaluate(() => { const l = document.querySelector('[data-verif-carton="2002"] [data-verif-preuve]'); return l ? l.textContent : ''; });
      dit(/VRM-82/.test(preuve), 'la preuve eBay par identité est affichée sur la bonne paire', JSON.stringify(preuve));
      const preuveAutre = await pg.evaluate(() => !!document.querySelector('[data-verif-carton="2001"] [data-verif-preuve]'));
      dit(!preuveAutre, 'aucune preuve inventée sur l\'autre paire (rien par titre)', `${preuveAutre}`);
      // Corriger 2002 vers 82 (le N° de son carton, aujourd'hui sur 2001).
      const champ = pg.locator('[data-verif-carton="2002"] input');
      await champ.fill('82');
      await pg.locator('[data-verif-carton="2002"] button', { hasText: 'Corriger' }).click();
      const oui = pg.locator('button', { hasText: 'Oui, le N°82' });
      await oui.waitFor({ timeout: 5000 }).catch(() => {});
      await oui.click().catch(() => {});
      await pg.waitForTimeout(1500);
      const loc = await fichesLocales(pg) || {};
      dit(String((loc['2002'] || {}).numero) === '82' && !!(loc['2002'] || {}).cartonVerifie, '2002 prend le N°82 de son carton, et est vérifiée', JSON.stringify(loc['2002'] && { n: loc['2002'].numero, v: !!loc['2002'].cartonVerifie }));
      const n2001 = String((loc['2001'] || {}).numero || '');
      dit(n2001 && !['1', '2', '3', '4', '5', '81', '82'].includes(n2001), '2001 reçoit un numéro NEUF (jamais servi)', `N°${n2001}`);
      const n1 = await pg.evaluate(() => { const e = document.querySelector('[data-numeros-a-verifier]'); return e ? Number(e.getAttribute('data-numeros-a-verifier')) : 0; });
      dit(n1 === 1, '2001 reste dans la liste, à vérifier', `${n1}`);
      // Confirmer 2001.
      await pg.locator('[data-verif-carton="2001"] button').first().click({ timeout: 8000 }).catch(() => {});
      await pg.waitForTimeout(1200);
      const reste = await pg.evaluate(() => !!document.querySelector('[data-numeros-a-verifier]'));
      dit(!reste, 'une fois tout vérifié, la liste disparaît', `${reste}`);
      dit(erreurs.length === 0, 'aucune erreur d\'app', erreurs.join(' | '));
      await ctx.close();
    }
    // ── C. Deux paires, un numéro : celle que la panne a renumérotée est NOMMÉE
    //     (19 oct., chez Julien : N°50, 58, 60). « C'est bien le N°58 » sur elle
    //     ne confirme PAS un numéro qu'une autre paire présente porte déjà.
    for (const taille of [1512, 390]) {
      console.log(`\n── C. Deux paires sous le même numéro (${taille} px)`);
      const etat = {
        main: { vinted_annonce_numeros: {
          '3001': { numero: '58', auto: true, numberedAt: '2026-10-09T15:47:09.775Z', title: 'Spezial de banc' },
          '3002': { numero: '58', auto: true, numberedAt: '2026-10-18T08:26:45.251Z', title: 'Olive de banc' },
        }, vinted_used_numeros: [1, 2, 3, 58], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 3001, t: 'Spezial de banc' }, { id: 3002, t: 'Olive de banc' }]),
        ecrits: [], panneEcriture: false, ebay: null,
      };
      const ctx = await nav.newContext(taille === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1512, height: 950 } });
      await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
      const pg = await ctx.newPage(); await brancher(pg, etat);
      const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
      await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-conflit-num="58"]', { timeout: 15000 }).catch(() => {});
      const fautive = await pg.evaluate(() => { const e = document.querySelector('[data-conflit-num="58"] [data-conflit-fautive]'); return e ? e.getAttribute('data-conflit-fautive') : ''; });
      dit(fautive === '3002', 'Colis : la paire renumérotée par la panne est nommée (pas l\'autre)', fautive || 'aucune');
      // Sur Annonces : « C'est bien le N°58 » sur 3002 doit proposer un numéro NEUF.
      await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-verif-carton="3002"]', { timeout: 15000 }).catch(() => {});
      await pg.locator('[data-verif-carton="3002"] button').first().click({ timeout: 8000 }).catch(() => {});
      const oui = pg.locator('button', { hasText: /^Oui, N°/ });
      const propose = await oui.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
      dit(propose, '« C\'est bien le N°58 » ne confirme pas : un numéro neuf est proposé', `${propose}`);
      if (propose) await oui.click();
      await pg.waitForTimeout(1200);
      const loc = await fichesLocales(pg) || {};
      const n = String((loc['3002'] || {}).numero || '');
      dit(n && !['1', '2', '3', '58'].includes(n), '3002 prend un numéro jamais servi ; 3001 garde le N°58', `3002:N°${n} 3001:N°${(loc['3001'] || {}).numero}`);
      dit(String((loc['3001'] || {}).numero) === '58', '… et la paire qui l\'avait d\'abord n\'a pas bougé', String((loc['3001'] || {}).numero));
      dit(erreurs.length === 0, 'aucune erreur d\'app', erreurs.join(' | '));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ numéros pendant une panne : ${ko} rouge(s)` : '\n✅ numéros pendant une panne : tout est vert');
  process.exit(ko ? 1 : 0);
})();
