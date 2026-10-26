// ════════════════════════════════════════════════════════════════════════════
//  BANC « LES NUMÉROS EN DOUBLE SE RÈGLENT TOUT SEULS » (20 octobre).
//  Décision de Julien : « pour les numéros qui ont été en double, l'app fait
//  elle-même les changements, elle redonne des nouveaux numéros ; elle ne doit
//  plus jamais se tromper ». Aucune fixture : tout est inventé.
//   A. deux annonces au même N° : celle numérotée la première le GARDE, l'autre
//      reçoit un numéro JAMAIS servi, brûlé ; la liste « à écrire sur tes
//      cartons » le dit ; « C'est écrit » la retire.
//   B. un numéro saisi À LA MAIN gagne sur un numéro automatique plus ancien.
//   C. une vente à poster garde le N° ; l'annonce en ligne qui le porte change.
//   D. « pas su » ne change rien : ventes d'un compte pas lues ⇒ aucun numéro
//      ne bouge (le bloc rouge reste).
//   E. l'impression d'un bordereau dont le carton n'a pas encore son nouveau N°
//      demande d'abord.
//   F. (22 oct.) une annonce MASQUÉE par Vinted (`is_hidden: true`, la forme
//      mesurée sur julatace35260) est une paire PRÉSENTE : numérotée la
//      première, elle GARDE le N° ; l'annonce en ligne numérotée après reçoit un
//      numéro neuf, dit dans « à écrire sur tes cartons ». La masquée n'est pas
//      comptée « en ligne » et n'apparaît pas dans la grille.
//   G. masquée puis SUPPRIMÉE (suppression vue après la lecture) : plus une
//      paire présente — aucun numéro ne bouge.
//   H. masquée numérotée APRÈS l'annonce en ligne : c'est ELLE qui change (la
//      règle est la même, elle n'est pas « en ligne seulement »).
//   I. (23 oct., relecture) masquée DÉCLARÉE partie (« Retirer », entrée sans
//      identifiant, aucune autre fiche ne porte son N°) : plus « à vérifier »,
//      plus dans les numéros physiques.
//   J. doublon dont la masquée est déclarée partie par le geste (entrée qui porte
//      l'identifiant, rangée sous `N°@id`) : l'annonce en ligne GARDE son N°,
//      et la clé nue n'est pas posée (elle sortirait l'autre paire des files).
//   J2. entrée ANCIENNE sans identifiant + deux fiches au même N° : on ne sait
//      pas laquelle est partie ⇒ la masquée reste présente (sens sûr, §5).
//   K. le geste « Elle n'est plus là » existe sur la ligne qui nomme la masquée,
//      demande d'abord (Annuler n'écrit rien), puis règle le doublon ; « Elle
//      est encore là » répare l'erreur.
//   L. AUCUNE annonce en ligne (toutes masquées) : la masquée a quand même son
//      geste, sous l'écran vide (dans « Conseils & signalements » sinon).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const http = require('http'), fs = require('fs'), path = require('path');

const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');   // jamais un chemin absolu (§6.1)
const PORT = Number(process.env.BANC_PORT) || 4506;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const JETON = 'jeton-de-banc';
const SESSION = { access_token: JETON, refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.fr' }, totp: [] };
const UID = '900000001';
const COMPTE = { vinted_user_id: UID, login: 'compte-de-banc', access_token: 'x', refresh_token: 'x', csrf_token: 'x', updated_at: new Date().toISOString() };
const item = (id, t, masquee) => ({ id, title: t || ('Paire ' + id), price: { amount: '40.0', currency_code: 'EUR' }, is_closed: false, is_hidden: !!masquee, is_draft: false, item_closing_action: null, photos: [], brand: 'Nike', size: '42' });
const LISTINGS = (ids) => ({ id: `harvest_${UID}_listings`, data: { capturedAt: new Date().toISOString(), payload: { items: ids.map((i) => item(i.id, i.t, i.masquee)) } } });

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
      try { const b = JSON.parse(req.postData() || '[]'); (Array.isArray(b) ? b : [b]).forEach((row) => { if (row && row.id === 'main' && row.data) { etat.ecrits.push(row.data); if (!etat.panneEcriture && etat.garder) etat.main = { ...etat.main, ...row.data }; } }); } catch (_) {}
      if (etat.panneEcriture && /app_data/.test(u)) return json({ code: '57014', message: 'canceling statement due to statement timeout' }, 500);
      return json([]);
    }
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return json([COMPTE]);
    if (/id=eq\.main/.test(u)) {
      if (/vrm_numerotation/.test(u)) return json([{ v: null }]);
      return json([{ id: 'main', data: etat.main }]);
    }
    if (/orders_/.test(u) && /harvest_/.test(u) && etat.ventes) {
      const rows = [{ id: `harvest_${UID}_orders_sold`, data: { capturedAt: new Date().toISOString(), payload: { my_orders: etat.ventes || [] } } }, { id: `harvest_${UID}_orders_purchased`, data: { capturedAt: new Date().toISOString(), payload: { my_orders: [] } } }];
      return json(rows.filter((x) => /like\./.test(u) || u.includes(x.id)).map((x) => ({ ...x, cap: x.data.capturedAt, n: String(x.data.payload.my_orders.length) })));
    }
    if (/_listings/.test(u) && /harvest_/.test(u)) return json([{ ...etat.listings, cap: etat.listings.data.capturedAt }]);
    if (/_supprimees/.test(u) && /harvest_/.test(u)) return json(etat.supprimees ? [{ id: `harvest_${UID}_supprimees`, ids: etat.supprimees }] : []);
    if (/ebay_brouillons/.test(u)) return json(etat.ebay ? [{ id: 'ebay_brouillons', items: etat.ebay.brouillons }] : []);
    if (/ebay_listings/.test(u)) return json(etat.ebay ? [{ id: 'ebay_listings', items: etat.ebay.listings }] : []);
    return json([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.route('**://*.vinted.net/**', (r) => r.abort());
}
const fichesLocales = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}'); } catch (_) { return null; } });
const poolLocal = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_used_numeros') || '[]'); } catch (_) { return null; } });
const vente = (tx, t) => ({ transaction_id: tx, title: t, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: new Date(Date.now() - 3600e3).toISOString(), price: { amount: '50.0', currency_code: 'EUR' } });

async function ouvrir(nav, etat, taille, tab) {
  const ctx = await nav.newContext(taille === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1512, height: 950 } });
  await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  const pg = await ctx.newPage(); await brancher(pg, etat);
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 140)));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, erreurs };
}
const SERVIS = ['1', '2', '3', '51', '52'];

(async () => {
  try { await ecouter(); } catch (e) { console.log('  ❌ ' + e.message); process.exit(1); }
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const taille of [1512, 390]) {
      console.log(`\n── A. Deux annonces au même numéro (${taille} px)`);
      const etat = { main: { vinted_annonce_numeros: {
          '4001': { numero: '51', auto: true, numberedAt: '2026-10-14T15:47:09.775Z', title: 'Patta de banc' },
          '4002': { numero: '51', auto: true, numberedAt: '2026-10-18T08:26:45.251Z', title: 'Samba de banc' },
        }, vinted_used_numeros: [1, 2, 3, 51, 52], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 4001, t: 'Patta de banc' }, { id: 4002, t: 'Samba de banc' }]), ventes: [], ecrits: [], ebay: null, panneEcriture: taille === 390, garder: true };
      const { ctx, pg, erreurs } = await ouvrir(nav, etat, taille, 'cat_annonces');
      await pg.waitForSelector('[data-numeros-a-ecrire]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(2500);
      const loc = await fichesLocales(pg) || {}, pool = (await poolLocal(pg) || []).map(String);
      const n2 = String((loc['4002'] || {}).numero || '');
      dit(String((loc['4001'] || {}).numero) === '51', 'la paire numérotée la PREMIÈRE garde le N°51', String((loc['4001'] || {}).numero));
      dit(!!n2 && !SERVIS.includes(n2), 'l\'autre reçoit un numéro JAMAIS servi, tout seul', `N°${n2 || '—'}`);
      dit(pool.includes(n2), 'le numéro neuf est brûlé (pool)', pool.join(','));
      const ligne = await pg.evaluate(() => { const e = document.querySelector('[data-a-ecrire="4002"]'); return e ? [e.getAttribute('data-a-ecrire-de'), e.getAttribute('data-a-ecrire-vers')] : null; });
      dit(!!ligne && ligne[0] === '51' && ligne[1] === n2, '« nouveaux numéros à écrire sur tes cartons » dit N°51 → le neuf', JSON.stringify(ligne));
      const conflit = await pg.evaluate(() => document.querySelectorAll('[data-conflit-num]').length);
      dit(conflit === 0, 'plus aucun numéro en double', String(conflit));
      const parti = etat.ecrits.some((d) => d.vinted_annonce_numeros && d.vinted_annonce_numeros['4002'] && String(d.vinted_annonce_numeros['4002'].numero) === n2);
      dit(parti, taille === 390 ? 'le changement est TENTÉ vers le nuage (ici le nuage refuse l\'écriture)' : 'le changement part au nuage', `${etat.ecrits.length} écriture(s)`);
      await pg.locator('[data-a-ecrire="4002"] button').click({ timeout: 8000 }).catch(() => {});
      await pg.waitForTimeout(1000);
      const reste = await pg.evaluate(() => !!document.querySelector('[data-numeros-a-ecrire]'));
      dit(!reste, '« C\'est écrit » retire la ligne', String(reste));
      // Rechargement : rien ne rebouge.
      await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(6000);
      const loc2 = await fichesLocales(pg) || {};
      dit(String((loc2['4002'] || {}).numero) === n2 && String((loc2['4001'] || {}).numero) === '51', taille === 390 ? 'nuage en panne, rechargement : la paire garde SON numéro neuf (pas un deuxième)' : 'après rechargement, aucun numéro ne rebouge', JSON.stringify({ a: (loc2['4001'] || {}).numero, b: (loc2['4002'] || {}).numero }));
      const larg = await pg.evaluate(() => document.documentElement.scrollWidth);
      dit(larg <= taille, 'aucun débordement horizontal', String(larg));
      dit(erreurs.length === 0, 'aucune erreur d\'app', erreurs.join(' | '));
      await ctx.close();
    }
    {
      console.log('\n── B. Un numéro saisi à la main gagne');
      const etat = { main: { vinted_annonce_numeros: {
          '5001': { numero: '52', auto: true, numberedAt: '2026-10-10T10:00:00.000Z', title: 'Auto de banc' },
          '5002': { numero: '52', auto: false, manuelAt: '2026-10-19T10:00:00.000Z', numberedAt: '2026-10-19T10:00:00.000Z', title: 'Main de banc' },
        }, vinted_used_numeros: [1, 2, 3, 51, 52], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 5001, t: 'Auto de banc' }, { id: 5002, t: 'Main de banc' }]), ventes: [], ecrits: [], ebay: null, panneEcriture: false };
      const { ctx, pg } = await ouvrir(nav, etat, 1512, 'cat_annonces');
      await pg.waitForSelector('[data-numeros-a-ecrire]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(2500);
      const loc = await fichesLocales(pg) || {};
      dit(String((loc['5002'] || {}).numero) === '52', 'le numéro saisi à la main reste', String((loc['5002'] || {}).numero));
      const n = String((loc['5001'] || {}).numero || '');
      dit(!!n && !SERVIS.includes(n), 'l\'automatique change, vers un numéro jamais servi', `N°${n}`);
      await ctx.close();
    }
    {
      console.log('\n── C. Une vente à poster garde son numéro');
      const etat = { main: { vinted_annonce_numeros: {
          '6001': { numero: '51', auto: true, numberedAt: '2026-10-09T10:00:00.000Z', title: 'Annonce de banc' },
        }, vinted_sale_overrides: { '77001': { numero: '51' } }, vinted_used_numeros: [1, 2, 3, 51, 52], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 6001, t: 'Annonce de banc' }]), ventes: [vente(77001, 'Vendue de banc')], ecrits: [], ebay: null, panneEcriture: false };
      const { ctx, pg } = await ouvrir(nav, etat, 1512, 'cat_bord');
      await pg.waitForSelector('[data-numeros-a-ecrire]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(2500);
      const loc = await fichesLocales(pg) || {};
      const n = String((loc['6001'] || {}).numero || '');
      dit(!!n && !SERVIS.includes(n), 'l\'annonce en ligne prend un numéro neuf (la vente garde le N°51)', `N°${n}`);
      const ov = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_sale_overrides') || '{}'); } catch (_) { return {}; } });
      dit(String((ov['77001'] || {}).numero) === '51', 'la vente à poster garde le N°51', String((ov['77001'] || {}).numero));
      await ctx.close();
    }
    {
      console.log('\n── D. Ventes pas lues : aucun numéro ne bouge');
      const etat = { main: { vinted_annonce_numeros: {
          '7001': { numero: '51', auto: true, numberedAt: '2026-10-14T10:00:00.000Z', title: 'Une de banc' },
          '7002': { numero: '51', auto: true, numberedAt: '2026-10-18T10:00:00.000Z', title: 'Deux de banc' },
        }, vinted_used_numeros: [1, 2, 3, 51, 52], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 7001, t: 'Une de banc' }, { id: 7002, t: 'Deux de banc' }]), ventes: null, ecrits: [], ebay: null, panneEcriture: false };
      const { ctx, pg } = await ouvrir(nav, etat, 1512, 'cat_annonces');
      await pg.waitForTimeout(9000);
      const loc = await fichesLocales(pg) || {};
      dit(String((loc['7001'] || {}).numero) === '51' && String((loc['7002'] || {}).numero) === '51', 'rien n\'est changé tant que les ventes ne sont pas lues', JSON.stringify({ a: (loc['7001'] || {}).numero, b: (loc['7002'] || {}).numero }));
      await ctx.close();
    }
    for (const taille of [1512, 390]) {
      console.log(`\n── F. Une annonce MASQUÉE par Vinted porte son numéro (${taille} px)`);
      const etat = { main: { vinted_annonce_numeros: {
          '4101': { numero: '51', auto: true, numberedAt: '2026-10-14T15:47:09.775Z', title: 'Patta masquée de banc' },
          '4102': { numero: '51', auto: true, numberedAt: '2026-10-18T08:26:45.251Z', title: 'Samba en ligne de banc' },
        }, vinted_used_numeros: [1, 2, 3, 51, 52], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 4101, t: 'Patta masquée de banc', masquee: true }, { id: 4102, t: 'Samba en ligne de banc' }]), ventes: [], ecrits: [], ebay: null, panneEcriture: false, garder: true };
      const { ctx, pg, erreurs } = await ouvrir(nav, etat, taille, 'cat_annonces');
      await pg.waitForSelector('[data-numeros-a-ecrire]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(2500);
      const loc = await fichesLocales(pg) || {}, pool = (await poolLocal(pg) || []).map(String);
      const n2 = String((loc['4102'] || {}).numero || '');
      dit(String((loc['4101'] || {}).numero) === '51', 'la paire MASQUÉE, numérotée la première, garde le N°51', String((loc['4101'] || {}).numero));
      dit(!!n2 && !SERVIS.includes(n2), 'l\'annonce en ligne numérotée après reçoit un numéro JAMAIS servi', `N°${n2 || '—'}`);
      dit(pool.includes(n2), 'le numéro neuf est brûlé (pool)', pool.join(','));
      const ligne = await pg.evaluate(() => { const e = document.querySelector('[data-a-ecrire="4102"]'); return e ? [e.getAttribute('data-a-ecrire-de'), e.getAttribute('data-a-ecrire-vers')] : null; });
      dit(!!ligne && ligne[0] === '51' && ligne[1] === n2, '« à écrire sur tes cartons » dit N°51 → le neuf', JSON.stringify(ligne));
      // (le résumé vit dans un volet replié : `textContent`, pas `innerText`)
      const resume = await pg.evaluate(() => { const e = document.querySelector('[data-ann-resume]'); return e ? e.textContent : ''; });
      dit(/(^|\D)1 en ligne sur Vinted/.test(resume), 'la masquée n\'est PAS comptée « en ligne »', resume.slice(0, 60));
      const cartes = await pg.evaluate(() => [...document.querySelectorAll('[data-carte-annonce]')].map((e) => e.getAttribute('data-carte-annonce')));
      dit(cartes.includes('4102') && !cartes.includes('4101'), 'la grille montre l\'annonce en ligne, PAS la masquée', JSON.stringify(cartes));
      const phys = await pg.evaluate(() => { try { return (JSON.parse(localStorage.getItem('vinted_nums_physiques') || 'null') || {}).nums || null; } catch (_) { return null; } });
      dit(Array.isArray(phys) && phys.includes('51') && phys.includes(n2), 'les numéros physiques portent le N°51 (masquée) ET le neuf', JSON.stringify(phys));
      const larg = await pg.evaluate(() => document.documentElement.scrollWidth);
      dit(larg <= taille, 'aucun débordement horizontal', String(larg));
      dit(erreurs.length === 0, 'aucune erreur d\'app', erreurs.join(' | '));
      await ctx.close();
    }
    {
      console.log('\n── G. Masquée puis supprimée : plus une paire présente');
      const etat = { main: { vinted_annonce_numeros: {
          '4201': { numero: '52', auto: true, numberedAt: '2026-10-14T15:47:09.775Z', title: 'Masquée supprimée de banc' },
          '4202': { numero: '52', auto: true, numberedAt: '2026-10-18T08:26:45.251Z', title: 'En ligne de banc' },
        }, vinted_used_numeros: [1, 2, 3, 51, 52], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 4201, t: 'Masquée supprimée de banc', masquee: true }, { id: 4202, t: 'En ligne de banc' }]),
        supprimees: { '4201': new Date(Date.now() + 60e3).toISOString() }, ventes: [], ecrits: [], ebay: null, panneEcriture: false };
      const { ctx, pg } = await ouvrir(nav, etat, 1512, 'cat_annonces');
      await pg.waitForSelector('[data-ann-resume]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(6000);
      const loc = await fichesLocales(pg) || {};
      dit(String((loc['4201'] || {}).numero) === '52' && String((loc['4202'] || {}).numero) === '52', 'aucun numéro ne bouge (la masquée a été supprimée)', JSON.stringify({ a: (loc['4201'] || {}).numero, b: (loc['4202'] || {}).numero }));
      const ecrire = await pg.evaluate(() => !!document.querySelector('[data-numeros-a-ecrire]'));
      dit(!ecrire, 'rien à réécrire sur un carton', String(ecrire));
      await ctx.close();
    }
    {
      console.log('\n── H. Masquée numérotée APRÈS : c\'est elle qui change');
      const etat = { main: { vinted_annonce_numeros: {
          '4301': { numero: '59', auto: true, numberedAt: '2026-10-14T15:47:09.775Z', title: 'En ligne ancienne de banc' },
          '4302': { numero: '59', auto: true, numberedAt: '2026-10-18T08:26:45.251Z', title: 'Masquée récente de banc' },
        }, vinted_used_numeros: [1, 2, 3, 51, 52, 59], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 4301, t: 'En ligne ancienne de banc' }, { id: 4302, t: 'Masquée récente de banc', masquee: true }]), ventes: [], ecrits: [], ebay: null, panneEcriture: false, garder: true };
      const { ctx, pg } = await ouvrir(nav, etat, 1512, 'cat_annonces');
      await pg.waitForSelector('[data-numeros-a-ecrire]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(2500);
      const loc = await fichesLocales(pg) || {};
      const n = String((loc['4302'] || {}).numero || '');
      dit(String((loc['4301'] || {}).numero) === '59', 'l\'annonce en ligne numérotée la première garde le N°59', String((loc['4301'] || {}).numero));
      dit(!!n && n !== '59' && !SERVIS.includes(n), 'la masquée reçoit un numéro jamais servi', `N°${n || '—'}`);
      const ligne = await pg.evaluate(() => { const e = document.querySelector('[data-a-ecrire="4302"]'); return e ? [e.getAttribute('data-a-ecrire-de'), e.getAttribute('data-a-ecrire-vers')] : null; });
      dit(!!ligne && ligne[0] === '59' && ligne[1] === n, '« à écrire sur tes cartons » nomme la masquée', JSON.stringify(ligne));
      await ctx.close();
    }
    const perdusLocaux = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_pairs_lost') || '{}'); } catch (_) { return null; } });
    const physLocaux = (pg) => pg.evaluate(() => { try { return (JSON.parse(localStorage.getItem('vinted_nums_physiques') || 'null') || {}).nums || null; } catch (_) { return null; } });
    for (const taille of [1512, 390]) {
      console.log(`\n── I. Masquée DÉCLARÉE partie (entrée ancienne, N° unique) (${taille} px)`);
      const etat = { main: { vinted_annonce_numeros: {
          '4501': { numero: '20', auto: true, numberedAt: '2026-10-01T10:00:00.000Z', title: 'En ligne normale de banc' },
          '4502': { numero: '15', auto: true, numberedAt: '2026-10-14T15:47:09.775Z', title: 'Masquée partie de banc' },
        }, vinted_used_numeros: [1, 2, 3, 15, 20], vinted_accounts_hidden: [], vinted_pairs_lost: { '15': { at: '2026-10-21T10:00:00.000Z', title: 'Masquée partie de banc' } } },
        listings: LISTINGS([{ id: 4501, t: 'En ligne normale de banc' }, { id: 4502, t: 'Masquée partie de banc', masquee: true }]), ventes: [], ecrits: [], ebay: null, panneEcriture: false, garder: true };
      const { ctx, pg, erreurs } = await ouvrir(nav, etat, taille, 'cat_annonces');
      await pg.waitForSelector('[data-ann-resume]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(6000);
      const verif = await pg.evaluate(() => !!document.querySelector('[data-verif-carton="4502"]'));
      dit(!verif, 'une masquée déclarée partie n\'est plus « à vérifier sur ton carton »', String(verif));
      const phys = await physLocaux(pg);
      dit(Array.isArray(phys) && !phys.map(String).includes('15') && phys.map(String).includes('20'), 'son N°15 n\'est plus publié comme physiquement présent', JSON.stringify(phys));
      dit(erreurs.length === 0, 'aucune erreur d\'app', erreurs.join(' | '));
      await ctx.close();
    }
    {
      console.log('\n── J. Doublon : la masquée est déclarée partie par le geste (identifiant)');
      const etat = { main: { vinted_annonce_numeros: {
          '4801': { numero: '51', auto: true, numberedAt: '2026-10-14T15:47:09.775Z', title: 'Patta masquée partie de banc' },
          '4802': { numero: '51', auto: true, numberedAt: '2026-10-18T08:26:45.251Z', title: 'Samba en ligne de banc' },
        }, vinted_used_numeros: [1, 2, 3, 51, 52], vinted_accounts_hidden: [], vinted_pairs_lost: { '51@4801': { at: '2026-10-21T10:00:00.000Z', title: 'Patta masquée partie de banc', id: '4801' } } },
        listings: LISTINGS([{ id: 4801, t: 'Patta masquée partie de banc', masquee: true }, { id: 4802, t: 'Samba en ligne de banc' }]), ventes: [], ecrits: [], ebay: null, panneEcriture: false, garder: true };
      const { ctx, pg } = await ouvrir(nav, etat, 1512, 'cat_annonces');
      await pg.waitForSelector('[data-ann-resume]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(7000);
      const loc = await fichesLocales(pg) || {};
      const ecrire = await pg.evaluate(() => !!document.querySelector('[data-a-ecrire="4802"]'));
      dit(String((loc['4802'] || {}).numero) === '51' && !ecrire, 'la paire en ligne GARDE son N°51 (la masquée est partie)', JSON.stringify({ masquee: (loc['4801'] || {}).numero, enLigne: (loc['4802'] || {}).numero, aEcrire: ecrire }));
      const doublon = await pg.evaluate(() => !!document.querySelector('[data-doublon-masquee]'));
      dit(!doublon, 'plus de « numéro porté par deux annonces »', String(doublon));
      const phys = await physLocaux(pg);
      dit(Array.isArray(phys) && phys.map(String).filter((x) => x === '51').length === 1, 'le N°51 reste physiquement présent (la paire en ligne)', JSON.stringify(phys));
      await ctx.close();
    }
    {
      console.log('\n── J2. Entrée ANCIENNE sans identifiant, deux fiches au même N° : la masquée reste présente');
      const etat = { main: { vinted_annonce_numeros: {
          '4851': { numero: '73', auto: true, numberedAt: '2026-10-14T15:47:09.775Z', title: 'Masquée ambiguë de banc' },
          '4852': { numero: '73', auto: true, numberedAt: '2026-10-18T08:26:45.251Z', title: 'En ligne ambiguë de banc' },
        }, vinted_used_numeros: [1, 2, 3, 73], vinted_accounts_hidden: [], vinted_pairs_lost: { '73': { at: '2026-10-21T10:00:00.000Z', title: '?' } } },
        listings: LISTINGS([{ id: 4851, t: 'Masquée ambiguë de banc', masquee: true }, { id: 4852, t: 'En ligne ambiguë de banc' }]), ventes: [], ecrits: [], ebay: null, panneEcriture: false, garder: true };
      const { ctx, pg } = await ouvrir(nav, etat, 1512, 'cat_annonces');
      await pg.waitForSelector('[data-numeros-a-ecrire]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(2500);
      const loc = await fichesLocales(pg) || {};
      dit(String((loc['4851'] || {}).numero) === '73' && String((loc['4852'] || {}).numero) !== '73', 'ambigu : la masquée (la plus ancienne) garde le N°73, l\'annonce en ligne change', JSON.stringify({ masquee: (loc['4851'] || {}).numero, enLigne: (loc['4852'] || {}).numero }));
      await ctx.close();
    }
    for (const taille of [1512, 390]) {
      console.log(`\n── K. Le geste « Elle n'est plus là » (${taille} px)`);
      const etat = { main: { vinted_annonce_numeros: {
          '4401': { numero: '59', auto: true, numberedAt: '2026-10-14T15:47:09.775Z', title: 'Masquée geste de banc' },
          '4402': { numero: '59', auto: true, numberedAt: '2026-10-18T08:26:45.251Z', title: 'En ligne geste de banc' },
        }, vinted_used_numeros: [1, 2, 3, 59], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 4401, t: 'Masquée geste de banc', masquee: true }, { id: 4402, t: 'En ligne geste de banc' }]), ventes: null, ecrits: [], ebay: null, panneEcriture: false, garder: true };
      const { ctx, pg, erreurs } = await ouvrir(nav, etat, taille, 'cat_annonces');
      await pg.waitForSelector('[data-doublon-masquee]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(1500);
      const geste = pg.locator('[data-masquee-partie="4401"]').first();
      const nGestes = await pg.locator('[data-masquee-partie="4401"]').count();
      dit(nGestes > 0, 'la ligne qui nomme la masquée porte « Elle n\'est plus là »', String(nGestes));
      const ok = () => pg.locator('button:not([data-masquee-partie])', { hasText: 'Elle n\'est plus là' }).last();
      if (nGestes) {
        await geste.scrollIntoViewIfNeeded().catch(() => {}); await geste.click({ timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(600);
        const annuler = pg.locator('button', { hasText: 'Annuler' }).last();
        dit(await annuler.count() > 0, 'le geste demande d\'abord', '');
        await annuler.click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(600);
        const perdus0 = await perdusLocaux(pg) || {};
        dit(!Object.values(perdus0).some((e) => e && String(e.id) === '4401'), '« Annuler » n\'écrit rien', JSON.stringify(perdus0));
        await geste.click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(600);
        await ok().click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1500);
      }
      const perdus = await perdusLocaux(pg) || {};
      const cles = Object.keys(perdus);
      dit(cles.length === 1 && cles[0] === '59@4401' && String(perdus[cles[0]].id) === '4401', 'la déclaration porte l\'identifiant, sous `59@4401` (pas la clé nue : l\'autre paire garde 59)', JSON.stringify(perdus));
      const apres = await pg.evaluate(() => ({ doublon: !!document.querySelector('[data-doublon-masquee]'), verif: !!document.querySelector('[data-verif-carton="4401"]') }));
      dit(!apres.doublon && !apres.verif, 'plus de doublon, plus « à vérifier »', JSON.stringify(apres));
      const parti = etat.ecrits.some((d) => d.vinted_pairs_lost && d.vinted_pairs_lost['59@4401']);
      dit(parti, 'la déclaration part au nuage', `${etat.ecrits.length} écriture(s)`);
      // « Elle est encore là » répare l'erreur (« Stock et ajustements » → « Conseils & signalements »).
      const outils = pg.locator('details.vrm-ann-stock-tools > summary').first();
      if (await outils.count()) { await outils.scrollIntoViewIfNeeded().catch(() => {}); await outils.click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(400); }
      const cs = pg.locator('button:has-text("Conseils & signalements")').first();
      if (await cs.count()) { await cs.scrollIntoViewIfNeeded().catch(() => {}); await cs.click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(500); }
      const bloc = pg.locator('[data-masquees-bloc] > button').first();
      if (await bloc.count()) { await bloc.click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(400); }
      const encore = pg.locator('[data-masquee-encore="4401"]').first();
      dit(await encore.count() > 0, 'la masquée déclarée partie reste listée, avec « Elle est encore là »', '');
      await encore.click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1500);
      const perdus2 = await perdusLocaux(pg) || {};
      const retour = await pg.evaluate(() => !!document.querySelector('[data-doublon-masquee]'));
      dit(Object.keys(perdus2).length === 0 && retour, '« Elle est encore là » retire la déclaration : le doublon revient', JSON.stringify({ perdus2, retour }));
      const larg = await pg.evaluate(() => document.documentElement.scrollWidth);
      dit(larg <= taille, 'aucun débordement horizontal', String(larg));
      dit(erreurs.length === 0, 'aucune erreur d\'app', erreurs.join(' | '));
      await ctx.close();
    }
    {
      console.log('\n── K2. Le même geste dans le bloc rouge de Colis');
      const etat = { main: { vinted_annonce_numeros: {
          '4411': { numero: '52', auto: true, numberedAt: '2026-10-14T15:47:09.775Z', title: 'Masquée colis de banc' },
          '4412': { numero: '52', auto: true, numberedAt: '2026-10-18T08:26:45.251Z', title: 'En ligne colis de banc' },
        }, vinted_used_numeros: [1, 2, 3, 52], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 4411, t: 'Masquée colis de banc', masquee: true }, { id: 4412, t: 'En ligne colis de banc' }]), ventes: null, ecrits: [], ebay: null, panneEcriture: false, garder: true };
      const { ctx, pg } = await ouvrir(nav, etat, 1512, 'cat_bord');
      await pg.waitForSelector('[data-conflit-num="52"]', { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(1000);
      const b = pg.locator('[data-conflit-num="52"] [data-masquee-partie="4411"]');
      dit(await b.count() === 1, 'le bloc rouge porte « La masquée n\'est plus là »', String(await b.count()));
      await b.first().click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(500);
      await pg.locator('button:not([data-masquee-partie])', { hasText: 'Elle n\'est plus là' }).last().click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1500);
      const reste = await pg.locator('[data-conflit-num="52"]').count();
      const perdus = await perdusLocaux(pg) || {};
      dit(reste === 0 && perdus['52@4411'] && String(perdus['52@4411'].id) === '4411', 'confirmé : plus de doublon, déclaration rangée sous `52@4411`', JSON.stringify({ reste, perdus }));
      await ctx.close();
    }
    {
      console.log('\n── L. Compte sans annonce en ligne : la masquée a son geste');
      const etat = { main: { vinted_annonce_numeros: {
          '4901': { numero: '39', auto: true, numberedAt: '2026-10-01T10:00:00.000Z', title: 'Masquée seule de banc' },
        }, vinted_used_numeros: [1, 2, 3, 39], vinted_accounts_hidden: [] },
        listings: LISTINGS([{ id: 4901, t: 'Masquée seule de banc', masquee: true }]), ventes: [], ecrits: [], ebay: null, panneEcriture: false, garder: true };
      const { ctx, pg } = await ouvrir(nav, etat, 1512, 'cat_annonces');
      await pg.waitForTimeout(8000);
      const bloc = pg.locator('[data-masquees-bloc] > button').first();
      dit(await bloc.count() > 0, 'sous « Aucune annonce en ligne », la paire masquée est listée', '');
      if (await bloc.count()) { await bloc.click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(400); }
      const geste = pg.locator('[data-masquee-partie="4901"]').first();
      dit(await geste.count() > 0, 'avec « Elle n\'est plus là »', '');
      await geste.click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(600);
      await pg.locator('button:not([data-masquee-partie])', { hasText: 'Elle n\'est plus là' }).last().click({ timeout: 8000 }).catch(() => {}); await pg.waitForTimeout(1500);
      const perdus = await perdusLocaux(pg) || {};
      dit(perdus['39'] && String(perdus['39'].id) === '4901', 'N° unique : rangée sous la clé nue « 39 », avec l\'identifiant', JSON.stringify(perdus));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ numéros en double : ${ko} rouge(s)` : '\n✅ numéros en double : tout est vert');
  process.exit(ko ? 1 : 0);
})();
