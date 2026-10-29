// Banc : eBay → Agent · « L'AGENT eBAY QUI DEMANDE » (29 octobre) — l'écran
// RENDU, sur des données INVENTÉES (il vit dans le dépôt, qui est public :
// aucune fixture). Port 9411 (BANC_PORT / PORT).
//
// Julien : « je veux un agent autonome, c'est-à-dire que je veux juste qu'il
// demande s'il doit poster les articles, que tu puisses lui dire ce que tu veux
// qu'il publie ». Le banc rend l'écran à 390 px (tactile, clair) et à 1512 px
// (sombre) et juge les `data-*` et ce qui PART vers `/api/ebay` :
//   A. six paires en ligne : N°32 vendue sur eBay, N°33 déjà en vente sur eBay,
//      N°34 achetée 100 € et en vente 90 € — ÉCARTÉES et comptées ; N°31, 35,
//      36 PROPOSÉES, chacune PRÉPARÉE (catégorie, frais lus par pubverify) ;
//      « Jamais » retire la 35 ; décocher la 36 ; « Publier ces 1 » ouvre une
//      confirmation (compte eBay, prix, frais) ; « Annuler » n'envoie RIEN ;
//      « Oui » envoie UN `publish` avec `agent:true, confirme:true` et le SKU ;
//      le bilan dit « 1 publiée » ; le résumé publié (Ma journée, notification)
//      est rangé dans le nuage ; Ma journée dit « … prêtes pour eBay » ;
//   B. une lecture eBay en panne (commandes 500) ⇒ RIEN n'est proposé, et c'est dit ;
//   C. un résultat INCERTAIN (504) ⇒ l'agent s'ARRÊTE (la seconde ne part pas),
//      relit eBay, et la paire n'est pas reproposée (eBay la montre en ligne) ;
//   D. la phrase : « publie les Nike en 42 à plus de 60 €, rouges » ⇒ la règle
//      comprise est MONTRÉE (« rouges » pas compris), gardée, et seule la N°31
//      reste proposée ;
//   E. aucun débordement horizontal, cibles ≥ 44 px, aucune erreur de page.
// Revue du 29 octobre (chaque scénario rouge sur le code relu) :
//   F. un critère obligatoire impossible à déduire (Asics, Puma) : la question
//      ne dit PAS « 3 prêtes » (« 3 proposées · 1 prête »), le résumé publié
//      porte `pretes: 1`, et « Compléter » ouvre le brouillon préparé dans le
//      formulaire d'eBay → Annonces (un seul brouillon) ;
//   G. eBay lent + le prix changé PENDANT la préparation : toutes les paires
//      finissent préparées au nouveau prix, le bouton Publier est là ;
//   H. « Au plus N par jour » : vider puis taper 3 enregistre 3 (pas 20) ;
//   I. un 503 « rien n'a été envoyé » (journal) est un REFUS dit tel quel —
//      jamais « incertaine », la paire n'est pas mise de côté ;
//   C2. une publication incertaine n'est PAS reproposée après une relecture
//      d'eBay qui ne la montre pas encore ; elle revient 15 min plus tard avec
//      le MÊME identifiant d'envoi ;
//   J. « Programmer plutôt » : des brouillons (avec leur id) — les paires
//      sortent des propositions, et y restent après rechargement ;
//   K. deux paires sous le même N° : aucune n'est proposée, c'est dit.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9411;
const MAINTENANT = Date.parse('2026-10-29T08:00:00.000Z');
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const PAIRES = [
  [31, 'Nike Dunk Low panda taille 42', 'Nike', '42', 95], [32, 'Adidas Gazelle bleu taille 40', 'Adidas', '40', 80], [33, 'Salomon XT-6 noir taille 41', 'Salomon', '41', 120],
  [34, 'New Balance 550 blanc taille 43', 'New Balance', '43', 90], [35, 'Asics Gel 1130 argent taille 39', 'Asics', '39', 70], [36, 'Puma Suede rouge taille 44', 'Puma', '44', 60],
];
const idDe = (n) => 7000 + n;
const LISTINGS = { capturedAt: new Date(MAINTENANT).toISOString(), payload: { items: PAIRES.map(([n, t, m, tl, p]) => ({ id: idDe(n), title: t, brand: m, size: tl, status: 'Très bon état', price: { amount: String(p), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, nPhotos: 2, created_at_ts: Math.floor((MAINTENANT - 40 * 86400000) / 1000), photo: { url: `https://img.test/v${idDe(n)}.jpg` } })) } };
const FICHES0 = Object.fromEntries(PAIRES.map(([n, t]) => [String(idDe(n)), { numero: String(n), title: t, photo: `https://img.test/v${idDe(n)}.jpg`, ...(n === 34 ? { buyPrice: '100' } : {}) }]));
let FICHES = FICHES0;
const DETAILS = Object.fromEntries(PAIRES.map(([n]) => [String(idDe(n)), { photos: [`https://img.test/v${idDe(n)}.jpg`, `https://img.test/v${idDe(n)}b.jpg`] }]));
const ANNONCES_EBAY = () => [{ itemId: '110000000033', title: 'Salomon XT-6 noir taille 41', price: '120.0', sku: 'VRM-33' }];
const COMMANDES = [{ orderId: '07-032', orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'FULFILLED', lineItems: [{ sku: 'VRM-32', title: 'Adidas Gazelle' }] }];

let rows = [], envois = [], ecritures = [], SC = {};
const remettre = (sc = {}) => {
  SC = sc;
  FICHES = sc.numeroDouble ? { ...FICHES0, [String(idDe(35))]: { ...FICHES0[String(idDe(35))], numero: '31' } } : FICHES0;
  rows = [
    { id: 'main', data: { vinted_annonce_numeros: FICHES } },
    { id: 'harvest_111_listings', data: LISTINGS },
    { id: 'vinted_item_details', data: DETAILS },
    { id: 'ebay_listings', data: { items: ANNONCES_EBAY(), capturedAt: MAINTENANT } },
    { id: 'ebay_orders', data: { orders: COMMANDES, capturedAt: MAINTENANT } },
  ];
  envois = []; ecritures = [];
};
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/^"|"$/g, '')];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function ouvrir(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript(([fiches, sombre]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches)); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, [FICHES, !!sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      try {
        for (const l of [].concat(JSON.parse(route.request().postData() || 'null') || [])) {
          if (!l || !l.id) continue;
          ecritures.push(JSON.parse(JSON.stringify(l)));
          const i = rows.findIndex((r) => r.id === l.id);
          if (i >= 0) rows[i] = { id: l.id, data: l.data }; else rows.push({ id: l.id, data: l.data });
        }
      } catch (_) {}
      return j([]);
    }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (SC.commandesKO && /ebay_orders/.test(u)) return j({ message: 'timeout' }, 500);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // Le faux eBay, aux formes de `api/ebay.js` (enregistré APRÈS le fourre-tout :
  // Playwright le prend en premier, §6.6).
  await pg.route('**/api/ebay**', async (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    envois.push(JSON.parse(JSON.stringify(body)));
    const num = String((body.item && body.item.numero) || '');
    if (body.action === 'status') return j({ ok: true, connected: true, comptes: [{ cle: '', pseudo: 'vendeur_test', principal: true, relie: true }] });
    if (SC.lent && ['pubinfo', 'pubverify'].includes(body.action)) await attendre(SC.lent);
    if (body.action === 'pubinfo' && SC.semelle && /Asics|Puma/i.test(String(body.title || ''))) return j({ ok: true, categorie: { categoryId: '15709', suggeree: { categoryId: '15709', categoryName: 'Baskets' } }, categories: [{ categoryId: '15709', categoryName: 'Baskets' }], conditions: [{ id: '3000', label: "D'occasion" }], attributs: [{ nom: 'Marque', requis: true, mode: 'SELECTION_ONLY', valeurs: ['Nike', 'Adidas', 'Salomon', 'New Balance', 'Asics', 'Puma'] }, { nom: 'Matière de la semelle', requis: true, mode: 'SELECTION_ONLY', valeurs: ['Caoutchouc', 'Gomme'] }], attributsObligatoires: ['Marque', 'Matière de la semelle'] });
    if (body.action === 'pubinfo') return j({ ok: true, categorie: { categoryId: '15709', suggeree: { categoryId: '15709', categoryName: 'Baskets' } }, categories: [{ categoryId: '15709', categoryName: 'Baskets' }], conditions: [{ id: '3000', label: "D'occasion" }, { id: '1000', label: 'Neuf' }], attributs: [{ nom: 'Marque', requis: true, mode: 'SELECTION_ONLY', valeurs: ['Nike', 'Adidas', 'Salomon', 'New Balance', 'Asics', 'Puma'] }], attributsObligatoires: ['Marque'] });
    if (body.action === 'pubverify') return j({ ok: true, fees: 0.35, frais: { total: 0.35, insertion: 0.35, programmation: null, remises: null, devise: 'EUR', lignes: [] } });
    if (body.action === 'publish') {
      if (SC.publish503) return j({ ok: false, reason: SC.publish503, error: 'Le suivi de cette action n’a pas pu être préparé. Réessaie plus tard ; rien n’a été envoyé.' }, 503);
      if (SC.incertain) return j({ ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu clairement — je ne sais pas si l\'annonce a été créée. Rafraîchis depuis eBay avant de recommencer.' }, 504);
      if (num === '36') return j({ ok: false, error: 'La catégorie ne convient pas à cet objet.' }, 422);
      return j({ ok: true, itemId: '1100000000' + num, url: 'https://www.ebay.fr/itm/1100000000' + num, sku: 'VRM-' + num });
    }
    if (body.action === 'relire') {
      // eBay relu : la paire publiée « dans le doute » EST en ligne.
      if (SC.incertain && SC.absente) { const i = rows.findIndex((r) => r.id === 'ebay_listings'); rows[i] = { id: 'ebay_listings', data: { items: ANNONCES_EBAY(), capturedAt: MAINTENANT + 60000 } }; return j({ ok: true }); }
      if (SC.incertain) { const der = envois.filter((e) => e.action === 'publish').pop(); const n = der && der.item && der.item.numero; SC.incertainNum = n; const i = rows.findIndex((r) => r.id === 'ebay_listings'); rows[i] = { id: 'ebay_listings', data: { items: [...ANNONCES_EBAY(), { itemId: '1100000000' + n, title: 'Paire ' + n, price: '95.0', sku: 'VRM-' + n }], capturedAt: MAINTENANT + 60000 } }; }
      return j({ ok: true });
    }
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const feuille = (pg) => pg.locator('div[style*="z-index: 2000"]');
const proposees = (pg) => pg.$$eval('[data-agent-paire]', (els) => els.map((e) => e.getAttribute('data-agent-paire')).sort());
const local = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
async function agent(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=ebay_agent`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-agent-ebay]', { timeout: 20000 });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-agent-ebay]'); return e && !['en-cours'].includes(e.getAttribute('data-agent-etat')); }, null, { timeout: 20000 });
}
const preparees = (pg) => pg.waitForFunction(() => { const l = [...document.querySelectorAll('[data-agent-paire]')]; return l.length && l.every((e) => !['attente', 'prepare'].includes(e.getAttribute('data-agent-prep'))); }, null, { timeout: 20000 });

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      console.log(`── ${vp.width} px${sombre ? ' (sombre)' : ''}`);
      // ── A ──
      remettre();
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        await essaie('A. la question', async () => {
          await agent(pg);
          const et = await pg.$eval('[data-agent-ebay]', (e) => ({ etat: e.getAttribute('data-agent-etat'), n: e.getAttribute('data-agent-n') }));
          const p = await proposees(pg);
          dit(et.etat === 'lu' && p.join(',') === '31,35,36', 'trois paires proposées (31, 35, 36) ; vendue sur eBay, déjà sur eBay et sous le prix d\'achat écartées', `${et.etat} · ${p.join(',')}`);
          const ec = await pg.$eval('[data-agent-ecartees]', (e) => e.textContent).catch(() => '');
          dit(/3 écartées/.test(ec) && /1 déjà vendue ailleurs/.test(ec) && /1 déjà en vente ou programmée sur eBay/.test(ec) && /1 dont le prix eBay serait sous ton prix d’achat/.test(ec), 'ce qui est écarté est compté et dit UNE fois, accordé au nombre (« 1 déjà vendue »)', ec);
          await preparees(pg);
          const prep = (await pg.$$eval('[data-agent-paire]', (els) => els.map((e) => `${e.getAttribute('data-agent-paire')}:${e.getAttribute('data-agent-prep')}:${(e.querySelector('[data-agent-frais]') || {}).getAttribute ? e.querySelector('[data-agent-frais]').getAttribute('data-agent-frais') : ''}`))).sort();
          dit(prep.join(' ') === '31:prete:0.35 35:prete:0.35 36:prete:0.35', 'chaque paire est PRÉPARÉE (catégorie, frais lus chez eBay par la vérification à blanc)', prep.join(' '));
          const q = await pg.$eval('[data-agent-question]', (e) => e.textContent);
          dit(/3 paires prêtes pour eBay — je les publie \?/.test(q), 'préparées et prêtes : « 3 paires prêtes pour eBay — je les publie ? »', q);
          const h2 = await pg.$eval('[data-agent-titre]', (e) => e.textContent).catch(() => '');
          dit(/Agent eBay/.test(h2), 'un titre de section « Agent eBay » au-dessus de la question', h2);
          await pg.waitForTimeout(800);
          const r0 = await local(pg, 'vrm_agent_ebay_resume');
          dit(r0 && r0.n === 3 && r0.pretes === 3, 'le résumé publié dit les PRÊTES (préparées chez eBay)', JSON.stringify(r0));
          dit(!envois.some((e) => e.action === 'publish'), 'rien n\'est publié tant qu\'il n\'a rien dit');
        });
        await essaie('A. jamais, décocher, confirmer', async () => {
          await pg.click('[data-agent-jamais="35"]');
          await pg.waitForFunction(() => !document.querySelector('[data-agent-paire="35"]'), null, { timeout: 5000 });
          dit((await proposees(pg)).join(',') === '31,36', '« Jamais » retire la N°35 des propositions');
          await pg.waitForTimeout(1500);
          const rj = await local(pg, 'vrm_agent_ebay_regles');
          dit(rj && (rj.jamais || []).includes('35'), '« jamais » est gardé dans les réglages de l’agent (clé synchronisée)', JSON.stringify(rj && rj.jamais));
          await pg.click('[data-agent-paire="36"] input[type=checkbox]');
          const bt = await pg.$eval('[data-agent-publier]', (e) => e.textContent);
          dit(/Publier celle-ci/.test(bt), 'décocher la 36 : « Publier celle-ci »', bt);
          await pg.click('[data-agent-publier]');
          await feuille(pg).getByRole('button', { name: /Oui, publier/ }).waitFor({ timeout: 5000 });
          const t = await feuille(pg).innerText();
          dit(/vendeur_test/.test(t) && /N°31/.test(t) && /95,00/.test(t) && /0,35/.test(t) && !/N°36/.test(t), 'la confirmation dit le compte eBay, la paire, le prix et les frais lus chez eBay', t.replace(/\s+/g, ' ').slice(0, 200));
          await feuille(pg).getByRole('button', { name: 'Annuler' }).click();
          await feuille(pg).waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
          await pg.waitForTimeout(600);
          dit(!envois.some((e) => e.action === 'publish'), '« Annuler » n\'envoie RIEN à eBay');
          await pg.click('[data-agent-publier]');
          await feuille(pg).getByRole('button', { name: /Oui, publier/ }).click({ timeout: 20000 });
          await pg.waitForSelector('[data-agent-bilan]', { timeout: 10000 });
          const pub = envois.filter((e) => e.action === 'publish');
          dit(pub.length === 1 && pub[0].agent === true && pub[0].confirme === true && pub[0].item && pub[0].item.numero === '31' && pub[0].item.price === '95' && pub[0].item.ebayGere === true,
            'UN publish : la N°31, agent:true, confirme:true, au prix de Vinted, livraison gérée par eBay', JSON.stringify(pub.map((e) => [e.item && e.item.numero, e.agent, e.confirme, e.item && e.item.price])));
          const bil = await pg.$eval('[data-agent-bilan]', (e) => e.textContent);
          dit(/1 publiée/.test(bil), 'le bilan : « 1 publiée »', bil);
          const lien = await pg.$eval('[data-agent-publiee="31"] a', (e) => e.getAttribute('href')).catch(() => '');
          dit(/ebay\.fr\/itm\/110000000031/.test(lien), 'le bilan garde la paire publiée avec son lien « voir sur eBay ↗ »', lien);
          await pg.click('[data-agent-paire="36"] input[type=checkbox]');
          const bz = await pg.$eval('[data-agent-publier]', (e) => e.textContent).catch(() => '');
          await pg.click('[data-agent-paire="36"] input[type=checkbox]');
          const bz2 = await pg.$eval('[data-agent-publier]', (e) => e.textContent).catch(() => '');
          dit(!/Publier ces 0/.test(bz2) && /Coche au moins une paire/.test(bz2) && /Publier celle-ci/.test(bz), 'rien de coché : « Coche au moins une paire », jamais « Publier ces 0 »', `${bz} / ${bz2}`);
          dit(envois.some((e) => e.action === 'relire'), 'eBay est relu après le lot');
          await pg.waitForTimeout(1500);
          const res = await local(pg, 'vrm_agent_ebay_resume');
          dit(res && res.n === 1 && res.pretes === 1 && res.at === MAINTENANT, 'le résumé (Ma journée, notification du matin) est publié : 1 paire encore prête', JSON.stringify(res));
          const jr = await local(pg, 'vrm_agent_ebay_jour');
          dit(jr && jr.publiees === 1, 'ce que l’agent a publié aujourd’hui est compté (le maximum du jour en tient compte)', JSON.stringify(jr));
        });
        await essaie('E. mise en page', async () => {
          const d = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          dit(d.sw <= d.cw + 1, 'aucun débordement horizontal', `${d.sw}/${d.cw}`);
          const petits = await pg.$$eval('[data-agent-ebay] button', (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43).map((e) => e.textContent.trim() + ':' + Math.round(e.getBoundingClientRect().height)));
          dit(!petits.length, 'chaque bouton de l\'agent fait au moins 44 px', petits.join(' · '));
          await pg.screenshot({ path: `/tmp/claude-0/ebay-agent-${vp.width}.png` }).catch(() => {});
        });
        await essaie('A. Ma journée', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
          await pg.waitForSelector('[data-job="agent-ebay"]', { timeout: 15000 });
          const t = await pg.$eval('[data-job="agent-ebay"]', (e) => e.textContent);
          dit(/1 paire prête pour eBay — je la publie \?/.test(t), 'Ma journée : « 1 paire prête pour eBay — je la publie ? » (préparée)', t.trim().slice(0, 90));
        });
        dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // ── B ──
      remettre({ commandesKO: true });
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        await essaie('B. pas su', async () => {
          await agent(pg);
          const et = await pg.$eval('[data-agent-ebay]', (e) => e.getAttribute('data-agent-etat'));
          const p = await proposees(pg);
          const txt = await pg.$eval('[data-agent-passu]', (e) => e.textContent).catch(() => '');
          dit(et === 'pas-su' && !p.length && /ventes eBay/.test(txt), 'commandes eBay illisibles ⇒ RIEN n\'est proposé, et c\'est dit', `${et} · ${txt.slice(0, 80)}`);
          await pg.waitForTimeout(600);
          dit(!envois.some((e) => ['pubinfo', 'pubverify', 'publish'].includes(e.action)), 'aucune préparation ni publication sur « pas su »');
        });
        dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // ── C ──
      remettre({ incertain: true });
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        await essaie('C. incertain', async () => {
          await agent(pg); await preparees(pg);
          await pg.click('[data-agent-publier]');
          await feuille(pg).getByRole('button', { name: /Oui, publier/ }).click({ timeout: 20000 });
          await pg.waitForSelector('[data-agent-bilan]', { timeout: 10000 });
          const pub = envois.filter((e) => e.action === 'publish');
          dit(pub.length === 1, 'un résultat incertain : l\'agent s\'ARRÊTE (les suivantes ne partent pas)', `${pub.length} publish`);
          const bil = await pg.$eval('[data-agent-bilan]', (e) => e.textContent);
          dit(/incertaine/.test(bil) && /je ne sais pas si elle est partie/.test(bil), 'le bilan le dit comme tel', bil.slice(0, 140));
          await pg.waitForTimeout(1500);
          const inc = await local(pg, 'vrm_agent_ebay_incertains');
          dit(inc && Object.keys(inc).includes(String(pub[0].item.numero)), 'la paire incertaine est notée (pas reproposée avant une relecture chez eBay)', JSON.stringify(inc));
          await pg.reload({ waitUntil: 'domcontentloaded' });
          await agent(pg);
          const p = await proposees(pg);
          dit(SC.incertainNum && !p.includes(String(SC.incertainNum)) && p.length === 2, `après relecture chez eBay (elle y est), la N°${SC.incertainNum} n'est PAS reproposée`, p.join(','));
          dit(/^[0-9A-F]{32}$/.test(String(pub[0].uuid || '')), 'la publication de l\'agent part avec un identifiant d\'envoi (uuid)', String(pub[0].uuid));
        });
        dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // ── D ──
      remettre();
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        await essaie('D. la phrase', async () => {
          await agent(pg);
          await pg.click('[data-agent-reglages] summary');
          await pg.fill('[data-agent-phrase]', 'publie les Nike en 42 à plus de 60 €, rouges');
          await pg.click('[data-agent-comprendre]');
          const c = await pg.$eval('[data-agent-compris]', (e) => e.textContent);
          dit(/Nike/.test(c) && /taille 42/.test(c) && /à partir de 60/.test(c) && /« rouges »/.test(c), 'la règle comprise est MONTRÉE avant d\'être gardée, et « rouges » est dit non compris', c.replace(/\s+/g, ' ').slice(0, 200));
          const r0 = await local(pg, 'vrm_agent_ebay_regles');
          dit(!(r0 && (r0.marques || []).length), 'rien n\'est gardé avant « Garder cette règle »');
          await pg.click('[data-agent-garder]');
          await pg.waitForFunction(() => { const l = [...document.querySelectorAll('[data-agent-paire]')].map((e) => e.getAttribute('data-agent-paire')); return l.join(',') === '31'; }, null, { timeout: 8000 });
          dit(true, 'gardée : seule la N°31 (Nike, 42, 95 €) reste proposée');
          await pg.waitForTimeout(1500);
          const r1 = await local(pg, 'vrm_agent_ebay_regles');
          dit(r1 && (r1.marques || []).join() === 'Nike' && (r1.tailles || []).join() === '42' && r1.prixMin === 60, 'la règle est gardée (clé synchronisée)', JSON.stringify(r1));
          const r = await pg.$eval('[data-agent-regles]', (e) => e.textContent);
          dit(/Nike/.test(r) && /jamais sous ton prix d’achat/.test(r), 'les règles en clair, sous « Ce que je publie »', r.replace(/\s+/g, ' ').slice(0, 160));
        });
        dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // ── C2. incertaine, relecture qui ne la montre pas encore ──
      remettre({ incertain: true, absente: true });
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        await essaie('C2. incertaine pas encore visible', async () => {
          await agent(pg); await preparees(pg);
          for (const n of ['35', '36']) await pg.click(`[data-agent-paire="${n}"] input[type=checkbox]`);
          await pg.click('[data-agent-publier]');
          await feuille(pg).getByRole('button', { name: /Oui, publier/ }).click({ timeout: 20000 });
          await pg.waitForSelector('[data-agent-bilan]', { timeout: 10000 });
          const u0 = (envois.filter((e) => e.action === 'publish').pop() || {}).uuid;
          await pg.waitForTimeout(1200);
          await pg.reload({ waitUntil: 'domcontentloaded' }); await agent(pg);
          const p = await proposees(pg);
          dit(!p.includes('31'), 'relue (capturedAt plus récent) mais l\'annonce n\'y est pas ENCORE : la N°31 incertaine n\'est PAS reproposée', p.join(','));
          const i = rows.findIndex((r) => r.id === 'ebay_listings'); rows[i] = { id: 'ebay_listings', data: { items: ANNONCES_EBAY(), capturedAt: MAINTENANT + 20 * 60000 } };
          SC.incertain = false;
          await pg.reload({ waitUntil: 'domcontentloaded' }); await agent(pg); await preparees(pg);
          const p2 = await proposees(pg);
          dit(p2.includes('31'), 'relue 20 min plus tard, toujours absente : la N°31 revient', p2.join(','));
          for (const n of ['35', '36']) await pg.click(`[data-agent-paire="${n}"] input[type=checkbox]`).catch(() => {});
          await pg.click('[data-agent-publier]');
          await feuille(pg).getByRole('button', { name: /Oui, publier/ }).click({ timeout: 20000 });
          await pg.waitForSelector('[data-agent-bilan]', { timeout: 10000 });
          const u1 = (envois.filter((e) => e.action === 'publish').pop() || {}).uuid;
          dit(!!u0 && u0 === u1, 'le second essai repart avec le MÊME identifiant d\'envoi (eBay refuse de la créer deux fois)', `${u0} / ${u1}`);
        });
        dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // ── F. critère impossible à déduire ──
      remettre({ semelle: true });
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        await essaie('F. à compléter', async () => {
          await agent(pg); await preparees(pg);
          const et = (await pg.$$eval('[data-agent-paire]', (els) => els.map((e) => `${e.getAttribute('data-agent-paire')}:${e.getAttribute('data-agent-prep')}`))).sort().join(' ');
          dit(et === '31:prete 35:a-completer 36:a-completer', 'Asics et Puma : un critère obligatoire à compléter', et);
          const q = await pg.$eval('[data-agent-question]', (e) => e.textContent);
          dit(!/3 paires prêtes/.test(q) && /3 paires proposées pour eBay · 1 prête à publier/.test(q), 'la question ne dit PAS « 3 prêtes » : « 3 paires proposées · 1 prête à publier »', q);
          await pg.waitForTimeout(800);
          const r = await local(pg, 'vrm_agent_ebay_resume');
          dit(r && r.n === 3 && r.pretes === 1, 'le résumé (Ma journée, notification) porte pretes: 1', JSON.stringify(r));
          const nbC = await pg.$$eval('[data-agent-completer]', (els) => els.length);
          dit(nbC === 2, 'chaque paire à compléter a un geste « Compléter »', String(nbC));
          await pg.click('[data-agent-completer="35"]');
          await pg.waitForSelector('[data-publier-brouillon-id]:not([data-publier-brouillon-id=""])', { timeout: 15000 });
          const idOuvert = await pg.$eval('[data-publier-brouillon-id]', (e) => e.getAttribute('data-publier-brouillon-id'));
          const br = (rows.find((x) => x.id === 'ebay_brouillons') || { data: { items: {} } }).data.items || {};
          const de35 = Object.entries(br).filter(([, d]) => d && String(d.numero) === '35');
          dit(de35.length === 1 && de35[0][0] === idOuvert && de35[0][1].id === idOuvert && de35[0][1].categorie && de35[0][1].categorie.id === '15709', '« Compléter » : UN brouillon préparé (catégorie, critères), ouvert dans le formulaire de publication', `${idOuvert} · ${de35.length}`);
        });
        dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // ── G. eBay lent + prix changé pendant la préparation ──
      remettre({ lent: 1200 });
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        await essaie('G. prix changé pendant la préparation', async () => {
          await agent(pg);
          await pg.click('[data-agent-reglages] summary');
          await pg.selectOption('[data-agent-prixmode]', 'eur');
          const champ = pg.locator('[data-agent-prixvaleur], [data-agent-reglages] input[inputmode=decimal]').first();
          await champ.click(); await champ.fill('5'); await champ.press('Enter');
          await pg.waitForFunction(() => { const l = [...document.querySelectorAll('[data-agent-paire]')]; return l.length === 3 && l.every((e) => e.getAttribute('data-agent-prep') === 'prete'); }, null, { timeout: 30000 }).catch(() => {});
          const et = (await pg.$$eval('[data-agent-paire]', (els) => els.map((e) => `${e.getAttribute('data-agent-paire')}:${e.getAttribute('data-agent-prep')}`))).sort().join(' ');
          dit(et === '31:prete 35:prete 36:prete', 'après le changement de prix, toutes les paires finissent préparées (jamais bloquées sur « Je prépare… »)', et);
          const bt = await pg.$eval('[data-agent-publier]', (e) => e.textContent).catch(() => '');
          dit(/Publier ces 3/.test(bt), 'le bouton Publier est là', bt || 'absent');
          const t31 = await pg.$eval('[data-agent-paire="31"]', (e) => e.textContent).catch(() => '');
          dit(/100,00/.test(t31), 'au nouveau prix (Vinted 95 € + 5 €)', t31.slice(0, 80));
        });
        dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // ── H. « Au plus N par jour » ──
      remettre();
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        await essaie('H. par jour', async () => {
          await agent(pg);
          await pg.click('[data-agent-reglages] summary');
          const champ = pg.locator('[data-agent-parjour], [data-agent-reglages] input[inputmode=numeric]').first();
          await champ.click(); await champ.press('End'); await champ.press('Backspace'); await champ.type('3'); await champ.press('Tab');
          await pg.waitForTimeout(800);
          const v = await champ.inputValue();
          const r = await local(pg, 'vrm_agent_ebay_regles');
          dit(v === '3' && r && r.parJour === 3, 'vider puis taper 3 : 3 par jour (jamais 53 → 20)', `champ ${v} · gardé ${r && r.parJour}`);
        });
        dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // ── I. 503 « rien n'a été envoyé » ──
      remettre({ publish503: 'journal' });
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        await essaie('I. refus certain du serveur', async () => {
          await agent(pg); await preparees(pg);
          await pg.click('[data-agent-publier]');
          await feuille(pg).getByRole('button', { name: /Oui, publier/ }).click({ timeout: 20000 });
          await pg.waitForSelector('[data-agent-bilan]', { timeout: 10000 });
          const bil = await pg.$eval('[data-agent-bilan]', (e) => e.textContent);
          dit(!/incertaine/.test(bil) && !/je ne sais pas si elle est partie/.test(bil) && /rien n’a été envoyé/.test(bil), 'un 503 « rien n’a été envoyé » est dit TEL QUEL, jamais « incertaine »', bil.slice(0, 160));
          dit(envois.filter((e) => e.action === 'publish').length === 1, 'et le lot s’arrête là (le serveur ne peut pas publier pour l’instant)');
          await pg.waitForTimeout(800);
          const inc = await local(pg, 'vrm_agent_ebay_incertains');
          dit(!inc || !Object.keys(inc).length, 'la paire n’est PAS rangée dans les incertaines', JSON.stringify(inc));
        });
        dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // ── J. Programmer plutôt ──
      remettre();
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        await essaie('J. programmer plutôt', async () => {
          await agent(pg); await preparees(pg);
          await pg.click('[data-agent-programmer]');
          await pg.waitForSelector('[data-agent-brouillons]', { timeout: 10000 });
          const p = await proposees(pg);
          await pg.click('[data-agent-programmer]', { timeout: 1500 }).catch(() => {});
          await pg.waitForTimeout(800);
          const br = (rows.find((x) => x.id === 'ebay_brouillons') || { data: { items: {} } }).data.items || {};
          const vals = Object.values(br);
          dit(vals.length === 3 && vals.every((d) => d && d.id && d.etatBrouillon === 'brouillon'), 'trois brouillons, chacun avec son id (visibles dans la liste des brouillons) — jamais en double', `${vals.length} · ${vals.map((d) => d && d.numero).join(',')}`);
          dit(!p.length, 'les paires mises en brouillon sortent tout de suite des propositions (plus de « Publier » à côté)', p.join(','));
          await pg.reload({ waitUntil: 'domcontentloaded' }); await agent(pg);
          const p2 = await proposees(pg);
          const ec = await pg.$eval('[data-agent-ecartees]', (e) => e.textContent).catch(() => '');
          dit(!p2.length && /3 déjà en brouillon eBay/.test(ec), 'après rechargement : toujours pas reproposées, et c’est dit (« déjà en brouillon »)', `${p2.join(',')} · ${ec.slice(0, 120)}`);
        });
        dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // ── K. deux paires sous le même N° ──
      remettre({ numeroDouble: true });
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
        await essaie('K. N° porté par deux paires', async () => {
          await agent(pg);
          const p = await proposees(pg);
          const ec = await pg.$eval('[data-agent-ecartees]', (e) => e.textContent).catch(() => '');
          dit(p.join(',') === '36' && /2 dont le N° est porté par deux paires/.test(ec), 'la N°31 portée par la Nike ET l’Asics : aucune des deux n’est proposée, et c’est dit', `${p.join(',')} · ${ec.slice(0, 160)}`);
        });
        dit(!errs.length, 'aucune erreur de page', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
    }
  } catch (e) { dit(false, 'banc', String(e && e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`\n${ko ? ko + ' contrôle(s) en échec' : 'tout vert'}`);
  process.exit(ko ? 1 : 0);
})();
