// Banc : LE COMPTE DE CHAQUE VENTE, et UN COMPTE AJOUTÉ COMPTE TOUT DE SUITE
// (5 novembre, demandes de Julien, docs/passation/demandes-2026-11-05.md §1 et §6).
//
//   1. « Ventes : le compte sur lequel l'article a été vendu doit apparaître » —
//      sur CHAQUE vente (Vinted, Leboncoin, eBay), ligne repliée ET détail, même
//      quand il n'y a qu'un compte (la règle « une fois quand uniforme » de §7
//      est abandonnée ICI, à sa demande). Pas su ⇒ dit, jamais deviné.
//   2. « Le dernier compte connecté n'avait pas son CA dans Statistiques ni dans
//      Comptabilité » — un compte lié PENDANT que VRM est ouvert doit compter
//      dans Vendu, Statistiques, Comptabilité et la liste des ventes, sans
//      rechargement ; et un compte marqué « refusé » par l'heuristique LOCALE
//      (`vinted_accounts_blocked`) garde son CA finalisé (décision du 31 août).
//
// Données INVENTÉES (le dépôt est public). Le banc juge des `data-*` et des
// montants, jamais un libellé seul (§6.5).
//   npm run build && BANC_PORT=7931 CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/bancs/ventes-compte.cjs
const path = require('path');
const fs = require('fs'), http = require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7931;
const EXE = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));

const maintenant = new Date();
const il = (n) => { const d = new Date(maintenant); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const vente = (id, prix, statut, d) => ({ transaction_id: id, title: 'Paire ' + id, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString() });
const ceMois = (d) => d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth();

const COMPTE_A = { id: 1, vinted_user_id: '111', login: 'compte_seul', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() };
const COMPTE_N = { id: 3, vinted_user_id: '333', login: 'compte_neuf', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() };
const VA = [vente(9101, 50, 'Paiement validé', il(0)), vente(9102, 80, 'Commande finalisée', il(1))];
const COMPTE_L = { id: 4, vinted_user_id: '444', login: 'compte_recent', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() };
// Le cas mesuré chez Julien le 5 nov. (loladupuis35260) : un compte récent dont la SEULE vente est en cours.
const VL = [vente(9401, 50.4, 'Bordereau envoyé au vendeur', il(0))];
// (revue) Un compte dont une vente finalisée a un prix ILLISIBLE : son CA par compte est un minimum.
const COMPTE_P = { id: 5, vinted_user_id: '555', login: 'compte_prix_illisible', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() };
const VP = [vente(9501, 30, 'Commande finalisée', il(2)), { ...vente(9502, 0, 'Commande finalisée', il(2)), price: { amount: '', currency_code: 'EUR' } }];
const VN = [vente(9301, 40, 'Commande finalisée', il(0)), vente(9302, 25, 'Bordereau envoyé au vendeur', il(0))];
// Ce que le banc ATTEND, calculé ici, jamais lu dans l'app.
const cents = (L, f) => Math.round(L.filter(f).reduce((s, o) => s + Number(o.price.amount), 0) * 100);
// « Vendu » compte AUSSI Leboncoin et eBay (`ventesFaites`, toutes plateformes) :
// leurs montants du mois, constants ici, s'ajoutent aux ventes Vinted.
const AUTRES_MOIS = () => Object.values(LBC).filter((v) => ceMois(new Date(v.dateVente))).reduce((s, v) => s + v.price, 0)
  + EBAY_CMD.filter((o) => ceMois(new Date(o.creationDate))).reduce((s, o) => s + Math.round((Number(o.paymentSummary.totalDueSeller.value) - Number(o.totalMarketplaceFee.value)) * 100), 0);
const venduMois = (L) => cents(L, (o) => !/annul/i.test(o.status) && ceMois(new Date(o.date))) + AUTRES_MOIS();
const finalise = (L) => cents(L, (o) => /finalis/i.test(o.status));

const LBC = {
  L1: { txId: 'L1', isSeller: true, price: 4000, title: 'lbc nom joint', dateVente: il(1).toISOString(), stepStatus: 'done', account: 'K1', accountName: 'lbc_joint' },
  L2: { txId: 'L2', isSeller: true, price: 3000, title: 'lbc id seul', dateVente: il(1).toISOString(), stepStatus: 'done', account: 'K2' },
  L3: { txId: 'L3', isSeller: true, price: 2000, title: 'lbc annonce', dateVente: il(1).toISOString(), stepStatus: 'done', itemId: '777' },
  L4: { txId: 'L4', isSeller: true, price: 1000, title: 'lbc rien', dateVente: il(1).toISOString(), stepStatus: 'done' },
};
const LBC_ACC = { 'lbc-account:K2': { id: 'lbc-account:K2', name: 'lbc_registre' }, K3: { id: 'K3', name: 'lbc_annonce' } };
const LBC_ITEMS = { 777: { id: 777, account: 'lbc-account:K3', subject: 'annonce lbc' } };
const EBAY_REG = { comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'pseudo_ebay_seul', principal: true }] };
const EBAY_CMD = [{ orderId: '11-0001', orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED', creationDate: il(1).toISOString(), lineItems: [{ sku: '', title: 'Commande eBay test' }], pricingSummary: { total: { value: '86.50', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: '80.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '5.00', currency: 'EUR' } }];

const STATS_OUVERTES = { vrm_stats_replis: { argent: true } };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 180)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

// `etat.comptes` change PENDANT la page : c'est « un compte lié pendant que VRM est ouvert ».
const ouvrir = async (b, vp, etat, onglet, init = {}) => {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((ini) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const [k, v] of Object.entries(ini)) localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }, init);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') { if (etat.ecrits) etat.ecrits.push(route.request().postData() || ''); return j([], 201); }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) { etat.lecturesComptes++; return j(etat.comptes); }
    const lignes = [
      ...etat.comptes.map((a) => ({ id: `harvest_${a.vinted_user_id}_orders_sold`, data: { capturedAt: maintenant.toISOString(), payload: { my_orders: a.vinted_user_id === '333' ? VN : a.vinted_user_id === '444' ? VL : a.vinted_user_id === '555' ? VP : VA } } })),
      ...etat.comptes.map((a) => ({ id: `harvest_${a.vinted_user_id}_listings`, data: { capturedAt: maintenant.toISOString(), payload: { items: [], pagination: { total_entries: 0 } } } })),
      { id: 'lbc_ventes', data: { ventes: LBC } },
      { id: 'lbc_accounts', data: { accounts: LBC_ACC } },
      { id: 'lbc_listings', data: { items: LBC_ITEMS } },
      { id: 'ebay_comptes', data: EBAY_REG },
      { id: 'ebay_orders', data: { orders: EBAY_CMD, capturedAt: Date.now() } },
    ];
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: maintenant.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(lignes.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(lignes.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ready: true, canConsent: true }) });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    if (body.action === 'status') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, connected: true, comptes: EBAY_REG.comptes.map((c) => ({ cle: c.cle, pseudo: c.pseudo, principal: !!c.principal, relie: true })) }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};
// Le compte doit être ÉCRIT (visible) sur la ligne repliée — quelle que soit la
// forme que le CSS montre à cette largeur (bureau : la ligne « sous » ; téléphone :
// la ligne courte de la maquette).
// SHOTS=dossier : une capture de chaque liste (pour REGARDER le rendu, §6.2).
const capture = async (pg, nom) => { if (!process.env.SHOTS) return; try { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(process.env.SHOTS, nom + '.png'), fullPage: false }); } catch (_) {} };
const comptesDesLignes = async (pg, selLigne) => { await capture(pg, selLigne.replace(/[^a-z]/gi, '') + '-' + (pg.viewportSize() || {}).width); return comptesDesLignes0(pg, selLigne); };
const comptesDesLignes0 = (pg, selLigne) => pg.$$eval(selLigne, (l) => l.map((e) => {
  const tog = e.querySelector('.vrm-ledger-sale-toggle') || e;
  const vis = [...tog.querySelectorAll('[data-vente-compte]')].filter((c) => { const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !c.closest('[hidden]'); });
  const c = vis[0];
  return c ? { c: c.getAttribute('data-vente-compte'), passu: c.hasAttribute('data-vente-compte-passu'), t: c.textContent } : null;
}));
const compteDuTiroir = async (pg, selLigne) => {
  await pg.locator(`${selLigne} .vrm-ledger-sale-toggle`).first().click({ timeout: 8000 });
  await pg.waitForTimeout(500);
  const r = await pg.evaluate(() => { const hosts = [...document.querySelectorAll('.vrm-ledger-drawer-host')].filter((h) => !h.hidden); const c = hosts.length ? hosts[0].querySelector('[data-vente-acces] [data-vente-compte]') : null; if (!c) return null; const rr = c.getBoundingClientRect(); return rr.width > 0 ? c.getAttribute('data-vente-compte') : 'invisible'; });
  await pg.keyboard.press('Escape').catch(() => {});
  return r;
};
const attendre = (pg, sel, ms = 15000) => pg.waitForSelector(sel, { timeout: ms }).catch(() => null);
const attr = (pg, sel, at) => pg.$eval(sel, (e, a) => e.getAttribute(a), at).catch(() => null);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`\n── 1. Le compte sur chaque vente, ${vp.width} px`);
      await essaie(`Vinted ${vp.width}`, async () => {
        const etat = { comptes: [COMPTE_A], lecturesComptes: 0 };
        const { ctx, pg, errs } = await ouvrir(b, vp, etat, 'cat_ventes');
        await attendre(pg, '.vrm-sale-row[data-tx]');
        await pg.waitForTimeout(1200);
        const L = await comptesDesLignes(pg, '.vrm-sale-row[data-tx]');
        dit(L.length >= 2 && L.every((x) => x && x.c === 'compte_seul'), 'Vinted, UN seul compte : chaque vente repliée nomme son compte', JSON.stringify(L));
        dit(await compteDuTiroir(pg, '.vrm-sale-row[data-tx]') === 'compte_seul', 'Vinted : le détail ouvert nomme aussi le compte');
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      await essaie(`Leboncoin ${vp.width}`, async () => {
        const etat = { comptes: [COMPTE_A], lecturesComptes: 0 };
        const { ctx, pg, errs } = await ouvrir(b, vp, etat, 'plat_leboncoin');
        await attendre(pg, '[data-lbc-vente]');
        await pg.waitForTimeout(1500);
        await capture(pg, 'leboncoin-' + vp.width);
        const par = await pg.$$eval('[data-lbc-vente]', (l) => Object.fromEntries(l.map((e) => {
          const tog = e.querySelector('.vrm-ledger-sale-toggle') || e;
          const c = [...tog.querySelectorAll('[data-vente-compte]')].find((x) => { const r = x.getBoundingClientRect(); const cs = getComputedStyle(x); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; });
          return [e.getAttribute('data-lbc-vente'), c ? (c.hasAttribute('data-vente-compte-passu') ? '?' : c.getAttribute('data-vente-compte')) : null]; })));
        dit(par.L1 === 'lbc_joint', 'Leboncoin : le compte joint à la vente par l\'extension', JSON.stringify(par));
        dit(par.L2 === 'lbc_registre', 'Leboncoin : un identifiant seul ⇒ le nom rangé sous CET identifiant (lbc_accounts)', String(par.L2));
        dit(par.L3 === 'lbc_annonce', 'Leboncoin : sans compte joint ⇒ le compte de SON annonce (itemId, une identité)', String(par.L3));
        dit(par.L4 === '?', 'Leboncoin : rien ⇒ « compte non relevé », jamais un compte deviné', String(par.L4));
        dit(await compteDuTiroir(pg, '[data-lbc-vente="L1"]') === 'lbc_joint', 'Leboncoin : le détail ouvert nomme le compte');
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
      await essaie(`eBay ${vp.width}`, async () => {
        const etat = { comptes: [COMPTE_A], lecturesComptes: 0 };
        const { ctx, pg, errs } = await ouvrir(b, vp, etat, 'plat_ebay');
        await attendre(pg, '[data-ebay-vente]');
        await pg.waitForTimeout(1200);
        const L = await comptesDesLignes(pg, '[data-ebay-vente]');
        dit(L.length === 1 && L[0] && L[0].c === 'pseudo_ebay_seul', 'eBay, UN seul compte : la vente repliée nomme son pseudo', JSON.stringify(L));
        dit(await compteDuTiroir(pg, '[data-ebay-vente]') === 'pseudo_ebay_seul', 'eBay : le détail ouvert nomme le pseudo');
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }
    // ── 2. Un compte lié PENDANT que VRM est ouvert ───────────────────────────
    const vp = { width: 1512, height: 950 };
    console.log('\n── 2. Un compte lié pendant que VRM est ouvert (Statistiques)');
    await essaie('Statistiques', async () => {
      const etat = { comptes: [COMPTE_A], lecturesComptes: 0 };
      const { ctx, pg, errs } = await ouvrir(b, vp, etat, 'dashboard', STATS_OUVERTES);
      await attendre(pg, '[data-dash-stat="caMois"][data-dash-cents]');
      await pg.waitForTimeout(1500);
      const avant = await attr(pg, '[data-dash-stat="caMois"]', 'data-dash-cents');
      dit(avant === String(venduMois(VA)), 'avant : Vendu ce mois = le seul compte connu', `${avant} · attendu ${venduMois(VA)}`);
      etat.comptes = [COMPTE_A, COMPTE_N];   // l'extension vient de capter un nouveau compte
      await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'comptes' } })));
      const att = String(venduMois([...VA, ...VN]));
      await pg.waitForFunction((a) => { const e = document.querySelector('[data-dash-stat="caMois"]'); return e && e.getAttribute('data-dash-cents') === a; }, att, { timeout: 15000 }).catch(() => {});
      const apres = await attr(pg, '[data-dash-stat="caMois"]', 'data-dash-cents');
      dit(apres === att, 'après « compte lié » (sans recharger) : Vendu ce mois compte le nouveau compte', `${apres} · attendu ${att}`);
      const fin = await attr(pg, '[data-finalise-vinted]', 'data-finalise-vinted');
      dit(fin === String(finalise([...VA, ...VN])), 'Finalisé sur Vinted compte aussi le nouveau compte', `${fin} · attendu ${finalise([...VA, ...VN])}`);
      await pg.waitForSelector('[data-stats-compte="333"]', { timeout: 8000 }).catch(() => {});
      const cN = await attr(pg, '[data-stats-compte="333"]', 'data-stats-compte-cents');
      dit(cN === String(finalise(VN)), '« CA Vinted par compte » a une ligne pour le nouveau compte', String(cN));
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
    console.log('\n── 2b. Le signal « ventes rangées » d\'un compte que la liste ne connaît pas (Comptabilité)');
    await essaie('Comptabilité', async () => {
      const etat = { comptes: [COMPTE_A], lecturesComptes: 0 };
      const { ctx, pg, errs } = await ouvrir(b, vp, etat, 'compta');
      await attendre(pg, '[data-ca-cur="vendu"][data-ca-eur]');
      await pg.waitForTimeout(1500);
      const eur = async () => Math.round(Number(await attr(pg, '[data-ca-cur="vendu"]', 'data-ca-eur')) * 100);
      const avant = await eur();
      dit(avant === venduMois(VA), 'avant : « Vendu » du mois = le seul compte connu', `${avant} · attendu ${venduMois(VA)}`);
      etat.comptes = [COMPTE_A, COMPTE_N];
      await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'ventes', uid: '333' } })));
      const att = venduMois([...VA, ...VN]);
      await pg.waitForFunction((a) => { const e = document.querySelector('[data-ca-cur="vendu"]'); return e && Math.round(Number(e.getAttribute('data-ca-eur')) * 100) === a; }, att, { timeout: 20000 }).catch(() => {});
      const apres = await eur();
      dit(apres === att, 'après le signal du compte inconnu : Comptabilité compte ses ventes, sans recharger', `${apres} · attendu ${att}`);
      dit(etat.lecturesComptes >= 2, 'la liste des comptes a été relue', String(etat.lecturesComptes));
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
    console.log('\n── 2c. Un compte « refusé » par l\'heuristique locale garde son CA finalisé');
    await essaie('bloqué', async () => {
      const etat = { comptes: [COMPTE_A, COMPTE_N], lecturesComptes: 0, ecrits: [] };
      const { ctx, pg, errs } = await ouvrir(b, vp, etat, 'dashboard', { ...STATS_OUVERTES, vinted_accounts_blocked: ['333'] });
      await attendre(pg, '[data-finalise-vinted]');
      await pg.waitForTimeout(2000);
      const fin = await attr(pg, '[data-finalise-vinted]', 'data-finalise-vinted');
      dit(fin === String(finalise([...VA, ...VN])), 'Finalisé sur Vinted = la règle de Comptabilité (le blocage ne retire pas l\'argent)', `${fin} · attendu ${finalise([...VA, ...VN])}`);
      // (revue) Un compte « refusé » n'a PAS ses annonces lues EXPRÈS : ce n'est pas une
      // lecture ratée. Le widget ne doit ni perdre son « en ligne » ni dire « annonces pas lues ».
      for (let k = 0; k < 20 && !etat.ecrits.some((x) => /"widget_stats"/.test(x)); k++) await pg.waitForTimeout(250);
      const w = etat.ecrits.filter((x) => /"widget_stats"/.test(x)).map((x) => { try { return JSON.parse(x)[0].data; } catch (_) { return null; } }).filter(Boolean).pop();
      dit(!!w && typeof w.online === 'number' && !w.onlineRaison, 'widget : un compte « refusé » ne rend pas « annonces pas lues » (en ligne publié)', JSON.stringify(w && { online: w.online, raison: w.onlineRaison }));
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
    console.log('\n── 2d. Lecture des comptes ratée : la liste connue reste');
    await essaie('pas su', async () => {
      const etat = { comptes: [COMPTE_A], lecturesComptes: 0 };
      const { ctx, pg, errs } = await ouvrir(b, vp, etat, 'dashboard', STATS_OUVERTES);
      await attendre(pg, '[data-dash-stat="caMois"][data-dash-cents]');
      await pg.waitForTimeout(1200);
      await pg.route('**/rest/v1/vinted_accounts**', (r) => r.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' }));
      await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'maj', quoi: 'comptes' } })));
      await pg.waitForTimeout(2500);
      const apres = await attr(pg, '[data-dash-stat="caMois"]', 'data-dash-cents');
      dit(apres === String(venduMois(VA)), 'une relecture ratée ne vide rien (pas su ≠ aucun compte)', String(apres));
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
    console.log('\n── 2e. Un compte récent dont la seule vente est EN COURS (le cas mesuré du 5 nov.)');
    await essaie('compte récent', async () => {
      const etat = { comptes: [COMPTE_A, COMPTE_L], lecturesComptes: 0 };
      const { ctx, pg, errs } = await ouvrir(b, vp, etat, 'dashboard', STATS_OUVERTES);
      await attendre(pg, '[data-dash-stat="caMois"][data-dash-cents]');
      await pg.waitForTimeout(2000);
      const vendu = await attr(pg, '[data-dash-stat="caMois"]', 'data-dash-cents');
      dit(vendu === String(venduMois([...VA, ...VL])), 'Vendu ce mois compte la vente en cours du compte récent', `${vendu} · attendu ${venduMois([...VA, ...VL])}`);
      const cL = await attr(pg, '[data-stats-compte="444"]', 'data-stats-compte-cents');
      const eL = await attr(pg, '[data-stats-compte="444"]', 'data-stats-compte-encours');
      dit(cL === '0' && eL === '5040', '« CA Vinted par compte » nomme le compte récent : 0,00 € finalisé, 50,40 € en cours (jamais absent)', `finalisé ${cL} · en cours ${eL}`);
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
    await essaie('compte récent compta', async () => {
      const etat = { comptes: [COMPTE_A, COMPTE_L], lecturesComptes: 0 };
      const { ctx, pg, errs } = await ouvrir(b, vp, etat, 'compta');
      await attendre(pg, '[data-ca-cur="vendu"][data-ca-eur]');
      await pg.waitForTimeout(2000);
      const eur = Math.round(Number(await attr(pg, '[data-ca-cur="vendu"]', 'data-ca-eur')) * 100);
      dit(eur === venduMois([...VA, ...VL]), 'Comptabilité : « Vendu » du mois compte le compte récent', `${eur} · attendu ${venduMois([...VA, ...VL])}`);
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
    console.log('\n── 2f. Un prix illisible : le CA de CE compte est un minimum, et le dit');
    await essaie('prix illisible', async () => {
      const etat = { comptes: [COMPTE_A, COMPTE_P], lecturesComptes: 0 };
      const { ctx, pg, errs } = await ouvrir(b, vp, etat, 'dashboard', STATS_OUVERTES);
      await attendre(pg, '[data-stats-compte="555"]');
      await pg.waitForTimeout(1200);
      await pg.locator('[data-stats-carte="comptes"]').first().scrollIntoViewIfNeeded().catch(() => {});
      await capture(pg, 'stats-comptes-' + vp.width);
      const p = await attr(pg, '[data-stats-compte="555"]', 'data-stats-compte-partiel');
      const a = await attr(pg, '[data-stats-compte="111"]', 'data-stats-compte-partiel');
      dit(p === '1' && a == null, '« CA Vinted par compte » : le compte au prix illisible est dit « au moins », pas l\'autre', `555=${p} · 111=${a}`);
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
    console.log('\n── 3. Paramètres → Comptes eBay : chaque vente de la carte « Argent eBay » nomme son compte');
    for (const vp3 of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) await essaie('ebay reglage ' + vp3.width, async () => {
      const etat = { comptes: [COMPTE_A], lecturesComptes: 0 };
      const { ctx, pg, errs } = await ouvrir(b, vp3, etat, 'settings');
      await pg.waitForTimeout(1500);
      await pg.getByText('Comptes eBay', { exact: true }).first().click({ timeout: 10000 });
      await attendre(pg, '[data-vente-compte-ou="ebay-reglage"]', 15000);
      await pg.getByText('Solde et paramètres du compte').first().click({ timeout: 8000 }).catch(() => {});
      await pg.waitForTimeout(500);
      await pg.locator('[data-vente-compte-ou="ebay-reglage"]').first().scrollIntoViewIfNeeded().catch(() => {});
      await capture(pg, 'ebay-reglage-' + vp3.width);
      const L = await pg.$$eval('[data-vente-compte-ou="ebay-reglage"]', (l) => l.map((c) => { const r = c.getBoundingClientRect(); return r.width > 0 ? c.getAttribute('data-vente-compte') : 'invisible'; }));
      dit(L.length === EBAY_CMD.length && L.every((x) => x === 'pseudo_ebay_seul'), `eBay ${vp3.width} : la vente de la carte nomme son pseudo, même avec un seul compte`, JSON.stringify(L));
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ ventes-compte : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ ventes-compte : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
