// Banc : PLUS DE STATISTIQUES (11 nov., lot stats-plus). Données INVENTÉES (dépôt public) :
// le harnais de scripts/bancs/carte-stats.cjs (6 ventes Vinted, 1 Leboncoin, 2 nov. 2026).
//   A. Ma journée : 6 chiffres rangés ⇒ 6 cases ; au téléphone 2 pages (4 + 2) qui glissent,
//      points « Page n sur N » (44 px) ; un point touché ⇒ la page change ; ordinateur : pas
//      de points, toutes les cases visibles ; la feuille « Modifier » : à 6, plus d'« Ajouter » ;
//      « Retirer » ⇒ 5 cases ; « Avant » ⇒ l'ordre change ; « — » jamais « 0 » pour un pas-su.
//   B. Argent → Statistiques : « En bref » (ventes 4, panier 297 € ÷ 4 = 74,25 €), « Vendu et
//      reçu » (une colonne par semaine, au clavier : Tab écrit ses valeurs), « L'âge de ton
//      stock », « Tes 10 meilleures ventes ». Aucun débordement, aucune erreur d'app.
// Lancer : npm run build && BANC_PORT=46xx node scripts/bancs/stats-plus.cjs (SHOTS=<dossier>).
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4633);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.CARTE_VUES ? process.env.CARTE_VUES.split(',') : null;

const maintenant = new Date(2026, 10, 2, 17, 30, 0);
const il = (n, h = 12) => { const d = new Date(maintenant); d.setHours(h, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const A = '111';
let nPhoto = 0;
const vente = (id, titre, prix, statut, d, tus) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b${++nPhoto}/f800/${id}.jpeg?s=x` } });
const VENTES = [
  vente(8001, 'Salomon XT-6 noir taille 38,5', 70, 'Le paiement a été validé', il(0, 11), 'needs_action'),
  vente(8002, 'Adidas Samba OG noir gomme taille 40', 72, 'Le paiement a été validé', il(1, 9), 'needs_action'),
  vente(8003, 'New Balance 550 vert taille 42', 88, 'Le colis est en route', il(3, 10), 'waiting'),
  vente(8004, 'Nike Air Max 1 rouge taille 43', 115, 'Le colis a été livré', il(1, 10), 'waiting'),
  vente(8005, 'Asics Gel-Kayano 14 argent taille 44', 89, 'Commande finalisée', il(9), 'completed'),
  vente(8006, 'Nike Shox TL noir taille 41', 95, 'Commande annulée', il(1), 'failed'),
];
// Vendu de novembre, à la main : 70 + 72 + 115 (8003 et 8005 sont d'octobre, 8006 annulée).
const VINTED_NOV = 25700, LBC_NOV = 4000;
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_test', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const LIGNES = [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: VENTES } } },
  { id: `harvest_${A}_listings`, data: { capturedAt: cap, payload: { items: [], pagination: null } } },
  { id: `harvest_${A}_txn_8005`, data: { capturedAt: cap, payload: { transaction: { id: 8005, item_id: 8905, status: 450, status_title: 'Commande finalisée', status_updated_at: il(6, 9).toISOString() } } } },
  { id: 'lbc_ventes', data: { ventes: { T77: { txId: 'T77', isSeller: true, title: 'Nike Air Max 90 blanche', price: 4000, dateVente: il(0, 10).toISOString(), status: 'paid', account: 'lbc_test', at: cap } } } },
];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${['#dfe3e8', '#e8e1d8', '#dfe5dd'][k % 3]}"/></svg>`;

const contexte = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript((s) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s));
    localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
    // (stats-plus) Un relevé de ventes finalisées de novembre (une au prix d'achat inconnu) et
    // l'âge du stock publié par Annonces — inventés, pour voir les blocs REMPLIS.
    if (!localStorage.getItem('vrm_stats_stock')) localStorage.setItem('vrm_stats_stock', JSON.stringify({ v: 1, at: Date.now(), parCatalogue: {}, dort: { total: 23, datesConnues: 21, seuils: { 30: { n: 9, valeur: 0, nCout: 0, cout: 0 }, 60: { n: 6, valeur: 0, nCout: 0, cout: 0 }, 90: { n: 4, valeur: 0, nCout: 0, cout: 0 } } } }));
    if (!localStorage.getItem('vrm_carte_stats')) localStorage.setItem('vrm_carte_stats', JSON.stringify({ v: 1, pages: { journee: { g: { id: 'vendu', p: 'jour' }, c: [{ id: 'vendu', p: 'mois' }, { id: 'ventes', p: 'mois' }, { id: 'panier' }, { id: 'aposter' }, { id: 'stock' }, { id: 'objectif' }] } } }));
    localStorage.setItem('vinted_sale_overrides', JSON.stringify({ '8004': { buyPrice: '45', numero: '23' }, '8005': { buyPrice: '30', numero: '61' }, '8001': { numero: '99', buyPrice: '28' } }));
    if (!localStorage.getItem('vrm_benefice_jours')) {
      const j = (n, ca, nCout, cout, caCouvert, frais) => [n, ca, frais, nCout, cout, caCouvert, frais, 0, 0, 0, 0, 0];
      localStorage.setItem('vrm_benefice_jours', JSON.stringify({ v: 2, jours: { '2026-10-03': j(3, 22800, 3, 10200, 22800, 0), '2026-11-01': j(2, 17800, 2, 7500, 17800, 0) } }));
      localStorage.setItem('vrm_compta', JSON.stringify({ sansDepenses: { at: Date.now() } }));
      localStorage.setItem('vinted_regime', JSON.stringify('micro'));
    }
  } catch (_) {} }, !!sombre);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => { const m = /\/b(\d+)\//.exec(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(m ? Number(m[1]) : 0) }); });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const dans = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
};
const aller = async (pg, tab, attend) => {
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.locator(attend).first().waitFor({ timeout: 30000 });
  await pg.waitForTimeout(2200);
};
// La carte d'une page, lue dans le DOM (data-* et nombres rendus).
const carte = (pg, page) => pg.evaluate((page) => {
  const c = document.querySelector(`[data-carte-stats="${page}"]`);
  if (!c) return null;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const g = c.querySelector('.vrm-fu-grand');
  const m = c.querySelector('[data-carte-modifier]');
  return {
    perimetre: c.getAttribute('data-carte-perimetre'), defaut: c.getAttribute('data-carte-defaut'), visible: vis(c),
    grand: g ? { id: g.getAttribute('data-carte-chiffre'), p: g.getAttribute('data-carte-p'), v: g.getAttribute('data-carte-valeur'), t: g.innerText.trim() } : null,
    cases: [...c.querySelectorAll('.vrm-fu-case')].map((x) => ({ id: x.getAttribute('data-carte-chiffre'), p: x.getAttribute('data-carte-p'), v: x.getAttribute('data-carte-valeur'), t: x.innerText.replace(/\n/g, ' · ') })),
    modifier: m ? Math.round(m.getBoundingClientRect().height) : 0,
    zeroMenteur: [...c.querySelectorAll('[data-carte-valeur=""]')].some((x) => /(^|\s)0(,00)?\s?€?$/.test((x.querySelector('b') || x).innerText.trim())),
  };
}, page);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);


(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n══ ${nom}`);
      const tel = vp.width < 600;
      const { ctx, pg, errs } = await contexte(b, vp, sombre);
      const shot = async (sel, f) => { if (!SHOTS) return; const l = pg.locator(sel).first(); if (await l.count()) { await l.scrollIntoViewIfNeeded().catch(() => {}); await l.screenshot({ path: path.join(SHOTS, `${f}-${nom}.png`) }).catch(() => {}); } };

      await essaie('A. Ma journée', async () => {
        console.log('── A. Ma journée : six chiffres');
        await aller(pg, 'journee', '[data-carte-stats="journee"]');
        const j = await carte(pg, 'journee');
        dit(j && j.cases.map((x) => x.id).join() === 'vendu,ventes,panier,aposter,stock,objectif', 'six cases, dans SON ordre', JSON.stringify(j && j.cases.map((x) => x.id)));
        const vMois = j && j.cases.find((x) => x.id === 'vendu');
        dit(!!vMois && vMois.v === String(VINTED_NOV + LBC_NOV), 'la case « vendu · mois » = 297 € (la règle de la carte, rien recalculé)', JSON.stringify(vMois));
        dit(j && !j.zeroMenteur, 'aucun « 0 » là où la valeur n’est pas sue');
        const P = await pg.evaluate(() => {
          const c = document.querySelector('[data-carte-stats="journee"]');
          const pages = c.querySelector('[data-fu-pages]');
          const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const pts = [...c.querySelectorAll('[data-fu-point]')];
          const rail = c.querySelector('.vrm-fu-cases.is-pages');
          const rr = rail ? rail.getBoundingClientRect() : null;
          const visibles = [...c.querySelectorAll('.vrm-fu-case')].filter((x) => { const r = x.getBoundingClientRect(); return rr && r.width > 0 && r.left >= rr.left - 1 && r.right <= rr.right + 1; }).length;
          return { pages: pages ? pages.getAttribute('data-fu-pages') : null, points: pts.filter(vis).length, pointH: pts.length ? Math.round(pts[0].getBoundingClientRect().height) : 0, pointW: pts.length ? Math.round(pts[0].getBoundingClientRect().width) : 0, visibles, noswipe: !!(rail && rail.hasAttribute('data-noswipe')) };
        });
        if (process.env.DEBUG) console.log(await pg.evaluate(() => { const r = document.querySelector('[data-carte-stats="journee"] .vrm-fu-cases'); const cs = getComputedStyle(r); return JSON.stringify({ d: cs.display, gtc: cs.gridTemplateColumns, gac: cs.gridAutoColumns, gaf: cs.gridAutoFlow, w: r.clientWidth, sw: r.scrollWidth, cases: [...r.children].map((x) => { const c = getComputedStyle(x); return [x.getAttribute('data-carte-chiffre'), c.gridColumnStart, c.gridRowStart, x.style.cssText, c.getPropertyValue('--pc'), c.gridColumn]; }) }); }));
        if (process.env.DEBUG) {
          const cdp = await pg.context().newCDPSession(pg);
          await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
          const { root } = await cdp.send('DOM.getDocument');
          const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-carte-stats="journee"] .vrm-fu-case' });
          const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
          for (const r of m.matchedCSSRules) { const props = r.rule.style.cssProperties.filter((x) => /grid/.test(x.name)); if (props.length) console.log('RULE', r.rule.selectorList.text.slice(0, 160), props.map((x) => x.name + ':' + x.value + (x.important ? '!' : '')).join('; ')); }
        }
        dit(P.pages === '2' && P.noswipe, 'deux pages (4 + 2), le glissé reste dans la carte', JSON.stringify(P));
        if (tel) {
          dit(P.points === 2 && P.pointW >= 44, 'téléphone : deux points de pagination, cible de 44 px de large', JSON.stringify(P));
          dit(P.visibles === 4, 'téléphone : une page = 4 cases (2×2)', String(P.visibles));
          await shot('.vrm-fu-tete', 'journee-page1');
          await pg.locator('[data-carte-stats="journee"] [data-fu-point="1"]').click();
          await pg.waitForTimeout(900);
          const p2 = await pg.evaluate(() => { const c = document.querySelector('[data-carte-stats="journee"]'); const r = c.querySelector('.vrm-fu-cases.is-pages'); return { cur: c.querySelector('[data-fu-point][aria-current="true"]')?.getAttribute('data-fu-point'), sl: Math.round(r.scrollLeft), w: Math.round(r.clientWidth) }; });
          dit(p2.cur === '1' && p2.sl > p2.w * 0.8, 'le point 2 touché ⇒ la 2e page (stock, objectif) glisse en place', JSON.stringify(p2));
          await shot('.vrm-fu-tete', 'journee-page2');
        } else {
          dit(P.points === 0 && P.visibles === 6, 'ordinateur : pas de points, les six cases visibles', JSON.stringify(P));
          await shot('.vrm-fu-tete', 'journee');
        }
        // La feuille « Modifier »
        await pg.locator('[data-carte-modifier="journee"]').first().click();
        await pg.locator('[data-carte-feuille="journee"]').waitFor({ timeout: 8000 });
        dit(await pg.locator('[data-carte-feuille="journee"] [data-carte-ajouter]').count() === 0, 'à six cases : plus d’« Ajouter » (six au plus)');
        await pg.locator('[data-carte-feuille="journee"] [data-carte-place="6"]').click();
        const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-carte-feuille] [data-carte-ranger] button')].filter((x) => x.getBoundingClientRect().height < 43.5).length);
        dit(petits === 0, '« Avant · Après · Retirer » : 44 px');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `feuille-journee-${nom}.png`) });
        await pg.locator('[data-carte-feuille="journee"] [data-carte-retirer]').click();
        await pg.waitForTimeout(400);
        await pg.locator('[data-carte-feuille="journee"] [data-carte-place="1"]').click();
        await pg.locator('[data-carte-feuille="journee"] [data-carte-descendre]').click();
        await pg.waitForTimeout(400);
        dit(await pg.locator('[data-carte-feuille="journee"] [data-carte-ajouter]').count() === 1, 'à cinq cases : « Ajouter » revient');
        await pg.keyboard.press('Escape');
        await pg.waitForTimeout(600);
        if (await pg.locator('[data-carte-feuille="journee"]').count()) { await pg.locator('[data-carte-feuille="journee"] button[aria-label*="ermer"]').first().click().catch(() => {}); await pg.waitForTimeout(500); }
        const j2 = await carte(pg, 'journee');
        dit(j2 && j2.cases.map((x) => x.id).join() === 'ventes,vendu,panier,aposter,stock', 'la carte suit tout de suite : objectif retiré, vendu ↔ ventes échangés', JSON.stringify(j2 && j2.cases.map((x) => x.id)));
        const rang = await pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_carte_stats') || 'null'));
        dit(rang && rang.pages && rang.pages.journee && rang.pages.journee.c.length === 5, 'rangé (synchronisé) : cinq cases', JSON.stringify(rang && rang.pages && rang.pages.journee && rang.pages.journee.c));
        const d = await deborde(pg);
        dit(d <= 1, 'Ma journée : aucun débordement horizontal', `${d}px`);
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ecran-journee-${nom}.png`) });
      });

      await essaie('B. Statistiques', async () => {
        console.log('── B. Argent → Statistiques');
        await aller(pg, 'dashboard', '[data-sp-en-bref]');
        // Le relevé est publié par l'app depuis SES ventes (ici la seule finalisée, d'octobre) : le banc
        // pose ensuite un relevé de novembre inventé et le signale comme une publication (`vrm:save`).
        await pg.evaluate(() => { const t = (j, h) => new Date(2026, 10, j, h).getTime(); localStorage.setItem('vrm_stats_ventes', JSON.stringify({ v: 1, at: Date.now(), l: [
      ['Vinted', 'boutique_test', 9101, t(1, 10), 115, 45, 0, 'Nike Air Max 1 rouge taille 43'], ['Vinted', 'boutique_test', 9102, t(1, 15), 72, 30, 0, 'Adidas Samba OG noir gomme taille 40'],
      ['Leboncoin', 'lbc_test', 'T77', t(2, 10), 40, 12, 0, 'Nike Air Max 90 blanche'], ['Vinted', 'boutique_test', 9103, t(2, 11), 70, 28, 0, 'Salomon XT-6 noir taille 38,5'],
      ['Vinted', 'boutique_test', 9104, t(2, 12), 130, null, 0, 'Jordan 1 Mid taille 44'] ] })); window.dispatchEvent(new CustomEvent('vrm:save', { detail: { k: 'vrm_stats_ventes' } })); });
        await pg.waitForTimeout(1500);
        const S = await pg.evaluate(() => {
          const t = (k) => document.querySelector(`[data-sv-tuile="${k}"]`);
          const a = (k, at) => (t(k) ? t(k).getAttribute(at) : null);
          return { n: a('sp-ventes', 'data-sp-n'), panier: a('sp-panier', 'data-sp-panier'), etatPanier: a('sp-panier', 'data-sv-etat'), marge: a('sp-marge', 'data-sv-etat'),
            vr: !!document.querySelector('[data-sv-carte="vendu-recu"]'), age: !!document.querySelector('[data-sv-carte="age-stock"]'), top: !!document.querySelector('[data-sv-carte="meilleures"]'),
            cols: document.querySelectorAll('[data-sp-vr-col]').length, venduTuile: document.querySelector('[data-sv-tuile="vendu"]')?.getAttribute('data-sv-n') };
        });
        dit(S.n === '4' && S.venduTuile === '4', 'En bref : 4 ventes — le MÊME nombre que la tuile « Vendu »', JSON.stringify(S));
        dit(S.panier === '7425' && S.etatPanier === 'lu', 'panier moyen : 297 € ÷ 4 = 74,25 €', JSON.stringify(S));
        dit(S.vr && S.age && S.top, 'les blocs « Vendu et reçu », « L’âge de ton stock », « Tes 10 meilleures ventes » sont là', JSON.stringify(S));
        const T2 = await pg.evaluate(() => ({ top: document.querySelector('[data-sp-top]')?.getAttribute('data-sp-top'), couv: document.querySelector('[data-sp-top]')?.getAttribute('data-sp-top-couv'), age: document.querySelector('[data-sp-age]')?.getAttribute('data-sp-age'), sans: document.querySelector('[data-sp-age]')?.getAttribute('data-sp-age-sans'), marge: document.querySelector('[data-sv-tuile="sp-marge"]')?.getAttribute('data-sp-marge') }));
        dit(T2.top === '7000,4200,4200,2800' && T2.couv === '4/5', 'meilleures ventes : 70 € (Air Max 1), 42 €, 42 €, 28 € — la Jordan sans prix d’achat n’est pas classée (4 sur 5)', JSON.stringify(T2));
        dit(T2.age === '12,5,4' && T2.sans === '2', 'âge du stock : 12 · 5 · 4, et 2 annonces sans date dites', JSON.stringify(T2));
        dit(T2.marge === '61.3', 'marge connue : (297 € − 115 € d’achat) ÷ 297 € = 61,3 % (la Jordan sans prix d’achat hors du calcul)', JSON.stringify(T2));
        dit(S.cols === 8, 'vendu et reçu : une colonne par semaine (8 dernières semaines)', String(S.cols));
        if (S.cols) {
          await pg.mouse.move(1, 1);   // aucune souris posée sur une colonne (le survol choisit aussi)
          await pg.locator('[data-sp-vr-col="2"]').focus();
          await pg.waitForTimeout(200);
          const lu = await pg.evaluate(() => ({ ch: document.querySelector('[data-sp-vr-choisi]')?.getAttribute('data-sp-vr-choisi'), t: document.querySelector('.vrm-sp-vr-lu')?.innerText.replace(/\n/g, ' ') }));
          dit(lu.ch === '2' && /Vendu/.test(lu.t) && /Reçu/.test(lu.t), 'au clavier : la colonne focalisée écrit vendu et reçu', JSON.stringify(lu));
          const h = await pg.evaluate(() => Math.round(document.querySelector('[data-sp-vr-col]').getBoundingClientRect().height));
          dit(h >= 44, 'une colonne se touche (44 px au moins)', String(h));
          const recuZero = await pg.evaluate(() => /Reçu\s*0,00/.test(document.querySelector('.vrm-sp-vr-lu').innerText) && !document.querySelector('[data-sp-vr]').getAttribute('data-sp-vr').split(',').some((x) => /:\d/.test(x)));
          dit(!recuZero, 'reçu pas publié : « — », jamais « 0,00 € »');
        }
        // Mes records (sur tout l'historique lu) : novembre 297 € > octobre 177 € ; semaine du 26 oct.
        // = 88 + 72 + 115 = 275 € ; meilleure vente = Air Max 1 (+70 €, 4 sur 5 au prix connu).
        const Rc = await pg.evaluate(() => { const r = (k) => document.querySelector(`[data-sp-record="${k}"]`); return { mois: r('mois')?.getAttribute('data-sp-record-k'), moisV: r('mois')?.getAttribute('data-sp-record-v'), sem: r('semaine')?.getAttribute('data-sp-record-v'), vente: r('vente')?.getAttribute('data-sp-record-v'), couv: r('vente')?.getAttribute('data-sp-record-couv'), rapide: r('rapide')?.getAttribute('data-sp-record-etat') }; });
        dit(Rc.mois === '2026-11' && Rc.moisV === '29700' && Rc.sem === '27500', 'records : meilleur mois novembre 297 €, meilleure semaine 275 € (celle du 26 oct.)', JSON.stringify(Rc));
        dit(Rc.vente === '7000' && Rc.couv === '4/5', 'record : meilleure vente +70 €, parmi 4 ventes au prix d’achat connu sur 5', JSON.stringify(Rc));
        dit(Rc.rapide === 'pas-assez', 'vente la plus rapide : aucune date de mise en ligne ⇒ « — · pas assez », jamais un faux record', JSON.stringify(Rc));
        await pg.locator('[data-sp-record="mois"]').click();
        await pg.locator('[data-sp-record-feuille="mois"]').waitFor({ timeout: 8000 });
        const nf = await pg.locator('[data-sp-record-feuille="mois"] [data-sp-record-ventes]').getAttribute('data-sp-record-ventes');
        dit(nf === '4', 'le meilleur mois s’ouvre : ses 4 ventes', String(nf));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `record-mois-${nom}.png`) });
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
        if (await pg.locator('[data-sp-record-feuille]').count()) { await pg.locator('[data-sp-record-feuille] button[aria-label*="ermer"]').first().click().catch(() => {}); await pg.waitForTimeout(400); }
        // Comparer deux comptes : boutique_test (Vinted, 3 ventes, 257 €) et Leboncoin (1 vente, 40 €).
        const Cp = await pg.evaluate(() => { const t = document.querySelector('[data-sp-cmp]'); if (!t) return null; const v = (k, c) => t.querySelector(`[data-sp-cmp-ligne="${k}"] [data-sp-cmp-${c}]`)?.innerText.trim(); return { cle: t.getAttribute('data-sp-cmp'), na: v('ventes', 'a'), nb: v('ventes', 'b'), pb: v('panier', 'b'), db: v('delai', 'b'), sel: t.querySelectorAll('select').length, h: Math.round(t.querySelector('select').getBoundingClientRect().height) }; });
        dit(!!Cp && Cp.sel === 2 && Cp.h >= 44, 'comparer deux comptes : deux listes de choix de 44 px', JSON.stringify(Cp));
        dit(!!Cp && Cp.na === '3' && Cp.nb === '1', 'boutique_test 3 ventes · Leboncoin 1 vente (les lignes de « Quel compte vend le mieux »)', JSON.stringify(Cp));
        dit(!!Cp && /pas assez/.test(Cp.pb) && /pas sur ce site/.test(Cp.db), 'Leboncoin : panier « pas assez », délai « pas sur ce site » — jamais 0', JSON.stringify(Cp));
        await shot('[data-sv-carte="records"]', 'records');
        await shot('[data-sv-carte="comparer-comptes"]', 'comparer');
        await shot('[data-sp-en-bref]', 'en-bref');
        await shot('[data-sv-carte="vendu-recu"]', 'vendu-recu');
        await shot('[data-sv-carte="meilleures"]', 'meilleures');
        await shot('[data-sv-carte="age-stock"]', 'age-stock');
        const d = await deborde(pg);
        dit(d <= 1, 'Statistiques : aucun débordement horizontal', `${d}px`);
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `ecran-stats-${nom}.png`), fullPage: true });
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
