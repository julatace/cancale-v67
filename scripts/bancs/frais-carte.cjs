// ════════════════════════════════════════════════════════════════════════════
//  BANC « FRAIS DE L'ANNÉE » + « CARTE DE TES VENTES » (14 nov., frais-carte ;
//  docs/passation/2026-11-14-frais-carte.md). Argent, l'app RENDUE.
//  Données INVENTÉES (dépôt public), harnais du banc `nouveau-vendeur` :
//   · 2 comptes Vinted, 1 600 ventes finalisées sur 18 mois, 1 300 détails de
//     transaction (pays du profil de l'acheteur, pseudo d'acheteur INVENTÉ — qui ne
//     doit jamais s'afficher) ;
//   · 1 compte eBay, 400 commandes : 360 aux frais lus en euros, 30 sans frais lus,
//     10 en livres (écartées, dites) ; livraison dans 24 villes (nom, rue, téléphone
//     INVENTÉS — jamais affichés) ;
//   · le relevé de Ventes (`vrm_stats_ventes`, forme réelle : N°, frais notés, détail
//     [11] des boosts) et un pack Vinted noté dans Dépenses.
//  Le fond de carte : les VRAIES formes d'OpenFreeMap servies par `_carte-fond.cjs` ;
//  la Base Adresse Nationale servie ici (une ville sans réponse ⇒ bulle du département).
//  Il MESURE (data-* et nombres rendus, jamais un libellé) :
//   F  Frais de l'année : eBay « au moins », frais connus sur 360 des 390 (cette année
//      comprise, les livres écartées et dites), Vinted « au moins » (boosts pas lus),
//      total = somme des sites connus ; un site inconnu n'écrit jamais un nombre ;
//   C  la carte s'ouvre (bulles posées) en < 1 s après son entrée à l'écran ; bulles
//      du monde = pays ; somme des lieux + sans lieu = toutes les ventes de la période ;
//   D  toucher la bulle France ⇒ le lieu, le nombre, le montant, la liste (N°, date) ;
//   V  vue France : villes placées + un département (ville sans repère) ; « sans ville » dit ;
//   P  filtre eBay ⇒ seulement les ventes eBay ;
//   X  aucun pseudo, nom, rue, téléphone inventés à l'écran ; aucune erreur JS ; rien ne
//      déborde à l'horizontale ; ni NaN, ni undefined.
//  390 px tactile et 1512 px, clair et sombre. `BANC_PORT`, `LARGEURS`, `THEMES`, `SHOTS`.
//  Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || String(9300 + Math.floor(Math.random() * 600));
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { fixtureCarte } = require('./_carte-fond.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || '';

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 500) : ''}`); };
const capture = async (pg, nom, el) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await (el ? el.screenshot({ path: path.join(SHOTS, nom + '.png') }) : pg.screenshot({ path: path.join(SHOTS, nom + '.png') })).catch(() => {}); };

// ── Le jeu INVENTÉ (déterministe) ──────────────────────────────────────────
let graine = 20261114;
const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
const now = Date.now(), iso = (t) => new Date(t).toISOString();
const AN = new Date(now).getFullYear();
const PAYS = [['FR', 46], ['IT', 16], ['ES', 9], ['DE', 8], ['NL', 8], ['BE', 5], ['PT', 3], ['IE', 3], ['AT', 1], ['LU', 1]];
const tirePays = () => { let x = hasard() * 100; for (const [p, w] of PAYS) { if ((x -= w) < 0) return p; } return 'FR'; };
const VILLES = [['Lyon', '69003', 45.76, 4.84], ['Paris', '75011', 48.86, 2.38], ['Marseille', '13001', 43.30, 5.37], ['Lille', '59000', 50.63, 3.06], ['Bordeaux', '33000', 44.84, -0.58],
  ['Nantes', '44000', 47.22, -1.55], ['Toulouse', '31000', 43.60, 1.44], ['Rennes', '35000', 48.11, -1.68], ['Strasbourg', '67000', 48.57, 7.75], ['Montpellier', '34000', 43.61, 3.88],
  ['Nice', '06000', 43.70, 7.27], ['Grenoble', '38000', 45.19, 5.72], ['Dijon', '21000', 47.32, 5.04], ['Angers', '49000', 47.47, -0.55], ['Brest', '29200', 48.39, -4.49],
  ['Tours', '37000', 47.39, 0.69], ['Reims', '51100', 49.26, 4.03], ['Le Havre', '76600', 49.49, 0.11], ['Limoges', '87000', 45.83, 1.26], ['Clermont-Ferrand', '63000', 45.78, 3.08],
  ['Saint-Malo', '35400', null, null],                 // la Base Adresse ne répond rien ⇒ bulle du département 35
  ['Bruxelles', '1000', null, null, 'BE'], ['Berlin', '10115', null, null, 'DE'], ['Genève', '1201', null, null, 'CH']];
const MOD = ['Nike Dunk Low panda', 'Adidas Samba OG', 'New Balance 550', 'Asics Gel-1130', 'Salomon XT-6', 'Nike Air Max 90'];
const ventesV = { 111: [], 222: [] }, txns = [], releve = [], ebay = [];
for (let i = 0; i < 1600; i++) {
  const uid = i < 1000 ? '111' : '222', tx = 7100000 + i;
  const t = now - Math.floor(hasard() * 540) * 86400000 - 3600e3;
  const prix = 40 + Math.floor(hasard() * 120);
  ventesV[uid].push({ transaction_id: tx, title: `${MOD[i % 6]} taille ${38 + (i % 8)}`, price: { amount: String(prix) + '.0', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(t), photo: null, conversation_id: 8100000 + i });
  if (i < 1300) txns.push({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: iso(now - 3600e3), payload: { code: 0, transaction: { id: tx, item_id: 5100000 + i, status: 450, status_title: 'Commande finalisée', user_side: 'seller', buyer: { id: 900000 + i, login: `acheteur_secret_${i}`, country_code: tirePays() } } } } });
  if (new Date(t).getFullYear() >= AN - 1) {
    const boost = i % 13 === 0 ? 150 + (i % 4) * 50 : 0;
    const l = ['Vinted', uid === '111' ? 'vendeuse_a' : 'vendeuse_b', String(tx), t, prix, i % 3 ? 20 + (i % 40) : null, boost / 100, `${MOD[i % 6]}`, i % 10 < 7 ? String(1 + (i % 900)) : '', ''];
    if (boost) l.push(null, [boost, 0, 0, 0]);
    releve.push(l);
  }
}
const money = (v, d = 'EUR') => ({ value: v.toFixed(2), currency: d });
for (let i = 0; i < 400; i++) {
  const v = VILLES[i % VILLES.length];
  const t = i < 390 ? new Date(AN, 0, 3).getTime() + Math.floor(hasard() * Math.max(1, (now - new Date(AN, 0, 3).getTime()) / 86400000 - 1)) * 86400000 : new Date(AN - 1, 5, 1 + i % 25).getTime();
  const du = 60 + Math.floor(hasard() * 140);
  const gbp = i % 40 === 7;                                   // 10 commandes en livres
  const sansFrais = !gbp && i % 13 === 5;                     // ~30 commandes sans frais lus
  ebay.push({ orderId: `27-${10000 + i}-${20000 + i}`, creationDate: iso(t), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'FULFILLED',
    paymentSummary: { totalDueSeller: money(du, gbp ? 'GBP' : 'EUR') }, totalMarketplaceFee: sansFrais ? undefined : money(Math.round(du * 12.4) / 100, gbp ? 'GBP' : 'EUR'),
    pricingSummary: { deliveryCost: money(9.9), total: money(du + 9.9) }, buyer: { username: `pseudo_ebay_secret_${i}` },
    lineItems: [{ title: `${MOD[i % 6]} taille 42`, sku: `VRM-${2000 + i}`, quantity: 1 }],
    fulfillmentStartInstructions: [{ shippingStep: { shipTo: { fullName: `Nom Secret ${i}`, primaryPhone: { phoneNumber: '0611223344' }, contactAddress: { addressLine1: `${i} rue Secrète`, city: i % 7 === 0 ? v[0].toUpperCase() : v[0], postalCode: v[1], countryCode: v[4] || 'FR' } } } }] });
  releve.push(['eBay', '', 'ebay:' + ebay[i].orderId, t, du, null, 0, `${MOD[i % 6]}`, String(2000 + i), iso(t)]);
}
const lignes = () => [
  { id: 'main', data: { vrm_bienvenue_vue: { at: iso(now) }, vrm_visite_vue: { at: iso(now) }, vrm_numerotation: { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z' },
    vrm_compta: { packs: [{ date: `${AN}-03-02`, montant: 4.99, plateforme: 'Vinted', libelle: 'Boost 7 jours' }], abonnements: [], depenses: [], fixes: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(now - 60e3), nItems: ventesV[111].length, payload: { my_orders: ventesV[111] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(now - 60e3), nItems: ventesV[222].length, payload: { my_orders: ventesV[222] } } },
  ...txns,
  { id: 'ebay_comptes', data: { rev: 1, comptes: [{ cle: 'aaaaaaaaaaaaaaa1', pseudo: 'ma_boutique_ebay', principal: true, deconnecteLe: null }] } },
  { id: 'ebay_orders', data: { rev: 1, orders: ebay, total: ebay.length, complet: true, capturedAt: iso(now - 60e3) } },
];
const SECRETS = ['acheteur_secret_', 'pseudo_ebay_secret_', 'Nom Secret', 'rue Secrète', '0611223344'];
const CORS = { 'access-control-allow-origin': '*' };
const PNG_VIDE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// La famille `harvest_*_txn_*` servie comme PostgREST : `Range` honoré (pages de 1 000, total dans
// `Content-Range`), `select=` projeté, `meta->>` relu dans `data` (_meta.cjs). Le harnais commun rend
// tout d'un coup : à 1 300 lignes, `lireTout` y voyait une page pleine sans fin (« pas su »).
const { metaVersData } = require('./_meta.cjs');
const projette = (row, sel) => {
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], al = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[al] = row.id; continue; }
    if (src === 'updated_at') { out[al] = iso(now - 3600e3); continue; }
    if (src === 'data') { out[al] = row.data; continue; }
    let v = row.data; for (const k of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[k];
    out[al] = v == null ? null : (src.includes('->>') ? (typeof v === 'object' ? JSON.stringify(v) : String(v)) : v);
  }
  return out;
};
async function routeTxn(pg) {
  await pg.route(/\/rest\/v1\/app_data\?.*harvest_%25_txn_%25/, async (route) => {
    const req = route.request();
    if (req.method() !== 'GET' && req.method() !== 'HEAD') return route.fallback();
    const u = decodeURIComponent(metaVersData(req.url()));
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || 'data';
    const tout = txns.map((r) => projette(r, sel));
    const rg = /^(\d+)-(\d+)$/.exec(req.headers()['range'] || '');
    const de = rg ? +rg[1] : 0, a = rg ? Math.min(+rg[2], tout.length - 1) : tout.length - 1;
    if (rg && de >= tout.length && de > 0) return route.fulfill({ status: 416, headers: { 'content-range': `*/${tout.length}`, ...CORS }, body: '' });
    const page = tout.slice(de, a + 1);
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ...CORS, 'content-range': `${de}-${de + page.length - 1}/${tout.length}` }, body: req.method() === 'HEAD' ? '' : JSON.stringify(page) });
  });
}
async function routesCarte(pg, FIX, BAN) {
  await routeTxn(pg);
  await pg.route(/^https:\/\/(tiles\.openfreemap\.org|api-adresse\.data\.gouv\.fr)\//, async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === 'api-adresse.data.gouv.fr') {
      BAN.push(u.search);
      const q = u.searchParams.get('q'), cp = u.searchParams.get('postcode');
      const v = VILLES.find((x) => x[0].toLowerCase() === String(q).toLowerCase() && x[2] != null);
      const features = v ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [v[3], v[2]] }, properties: { label: v[0], score: 0.97, type: 'municipality', postcode: cp || v[1], city: v[0] } }] : [];
      return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify({ type: 'FeatureCollection', features }) });
    }
    const chemin = u.pathname;
    const m = chemin.match(/^\/styles\/([a-z]+)$/);
    if (m) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(FIX.style(m[1] === 'dark')) });
    if (chemin === '/planet') return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(FIX.tilejson()) });
    const t = chemin.match(/^\/planet\/[^/]+\/(\d+)\/(\d+)\/(\d+)\.pbf$/);
    if (t) return r.fulfill({ status: 200, contentType: 'application/x-protobuf', headers: CORS, body: FIX.tuile(+t[1], +t[2], +t[3]) || Buffer.alloc(0) });
    const g = chemin.match(/^\/fonts\/([^/]+)\/(\d+-\d+)\.pbf$/);
    if (g) { const b = FIX.glyphe(decodeURIComponent(g[1]), g[2]); if (b) return r.fulfill({ status: 200, contentType: 'application/x-protobuf', headers: CORS, body: b }); }
    if (/^\/sprites\/.+\.json$/.test(chemin)) return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{}' });
    if (/^\/sprites\/.+\.png$/.test(chemin)) return r.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: PNG_VIDE });
    return r.fulfill({ status: 404, headers: CORS, body: '' });
  });
}

async function passe(nav, FIX, { W, theme }) {
  const sombre = theme === 'sombre', T = `[${W}px ${theme}]`, nomS = (x) => `frais-carte-${W}-${theme}-${x}`;
  const o = await NV.ouvrir(nav, { W, sombre, base: { lignes: lignes(), comptes: NV.JEU_COMPTES, ecritures: 0 }, tab: 'stats' });
  const pg = o.pg;
  const BAN = [];
  await routesCarte(pg, FIX, BAN);
  // Le relevé de Ventes, forme réelle, rangé sur cet appareil (l'écran Ventes le publie) ; puis on recharge.
  await pg.evaluate((r) => { try { localStorage.setItem('vrm_stats_ventes', JSON.stringify({ v: 1, l: r, at: Date.now() })); } catch (_) {} }, releve);
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  // ── F
  const fa = await pg.waitForSelector('[data-frais-annee]', { timeout: 30000 }).then(() => true).catch(() => false);
  dit(fa, `${T} F · « Frais de l’année » est rendu dans Argent`);
  if (fa) {
    await pg.waitForFunction(() => { const e = document.querySelector('[data-fa-site="eBay"]'); return e && e.getAttribute('data-fa-etat') !== 'passu'; }, null, { timeout: 30000 }).catch(() => {});
    const F = await pg.evaluate(() => {
      const s = document.querySelector('[data-frais-annee]');
      const rows = [...s.querySelectorAll('[data-fa-site]')].map((r) => ({ site: r.getAttribute('data-fa-site'), etat: r.getAttribute('data-fa-etat'), raison: r.getAttribute('data-fa-raison'), eur: r.getAttribute('data-fa-eur'), lus: r.getAttribute('data-fa-lus'), devise: r.getAttribute('data-fa-devise'), boosts: r.getAttribute('data-fa-boosts'), val: (r.querySelector('.vrm-fc-val') || {}).innerText || '' }));
      return { annee: s.getAttribute('data-frais-annee'), total: s.getAttribute('data-fa-total'), auMoins: s.getAttribute('data-fa-au-moins'), grand: ((s.querySelector('[data-fa-grand]') || {}).innerText || '').replace(/\s+/g, ' '), rows };
    });
    const eb = F.rows.find((r) => r.site === 'eBay') || {}, vi = F.rows.find((r) => r.site === 'Vinted') || {};
    const nAn = ebay.filter((x) => new Date(x.creationDate).getFullYear() === AN);
    const lusAttendus = nAn.filter((x) => x.totalMarketplaceFee && x.totalMarketplaceFee.currency === 'EUR').length;
    const fraisAttendus = Math.round(nAn.filter((x) => x.totalMarketplaceFee && x.totalMarketplaceFee.currency === 'EUR').reduce((t, x) => t + Number(x.totalMarketplaceFee.value) * 100, 0));
    const gbpAn = nAn.filter((x) => x.paymentSummary.totalDueSeller.currency === 'GBP').length;
    dit(F.annee === String(AN), `${T} F · l’année choisie par défaut est ${AN}`, F.annee);
    dit(eb.etat === 'auMoins' && eb.lus === `${lusAttendus}/${nAn.length}` && Number(eb.eur) === fraisAttendus, `${T} F · eBay : au moins ${fraisAttendus / 100} € · frais connus sur ${lusAttendus}/${nAn.length}`, eb);
    dit(Number(eb.devise) === gbpAn && gbpAn > 0, `${T} F · eBay : ${gbpAn} commandes en livres écartées ET dites`, eb);
    dit(vi.etat === 'auMoins' && vi.raison === 'boostsPasLus' && Number(vi.boosts) > 0, `${T} F · Vinted : au moins (boosts pas lus chez Vinted), boosts notés mis à part`, vi);
    const somme = F.rows.reduce((t, r) => t + (r.eur ? Number(r.eur) : 0), 0);
    dit(Number(F.total) === somme && F.auMoins === '1' && /au moins/.test(F.grand), `${T} F · total = somme des sites connus, « au moins »`, F);
    dit(F.rows.every((r) => r.eur !== '' || !/\d/.test(r.val)), `${T} F · un site aux frais inconnus n’écrit jamais un nombre`, F.rows);
    await pg.locator('[data-frais-annee]').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(pg, nomS('frais'), await pg.$('[data-frais-annee]'));
  }
  // ── C
  const cv = await pg.waitForSelector('[data-carte-ventes="lu"]', { timeout: 30000 }).then(() => true).catch(() => false);
  dit(cv, `${T} C · « Carte de tes ventes » est rendue (ventes lues)`);
  if (cv) {
    await pg.waitForFunction(() => !/pays en cours/.test((document.querySelector('[data-cv-resume]') || {}).innerText || 'x'), null, { timeout: 20000 }).catch(() => {});
    // On mesure la CARTE, pas le démarrage de l'app (ni une autre session qui partage la machine) :
    // d'abord une page au calme (six tours de 50 ms sans retard), puis le geste.
    const calme = () => pg.evaluate(async () => { const t0 = performance.now(); let n = 0; while (performance.now() - t0 < 25000) { const a = performance.now(); await new Promise((r) => setTimeout(r, 50)); n = performance.now() - a - 50 < 15 ? n + 1 : 0; if (n >= 6) return true; } return false; });
    await calme();
    const avant = await pg.evaluate(() => (document.querySelector('[data-cv-fond]') || { getAttribute: () => '' }).getAttribute('data-cv-fond'));
    const t0 = Date.now();
    await pg.locator('.vrm-cv-carte').first().scrollIntoViewIfNeeded().catch(() => {});
    const bulles = await pg.waitForSelector('[data-cv-bulle]', { timeout: 15000 }).then(() => true).catch(() => false);
    const ms = Date.now() - t0;
    if (process.env.BAVARD) console.log('  sonde', JSON.stringify(await pg.evaluate(() => { const c = document.querySelector('.vrm-cv-carte'); const r = c && c.getBoundingClientRect(); return { fond: (document.querySelector('[data-cv-fond]') || { getAttribute: () => '?' }).getAttribute('data-cv-fond'), msApp: (document.querySelector('[data-cv-fond]') || { getAttribute: () => '?' }).getAttribute('data-cv-ms'), top: r && r.top, h: r && r.height, ih: innerHeight, gl: !!document.createElement('canvas').getContext('webgl') }; })));
    if (avant === 'attente') dit(bulles && ms < 1000, `${T} C · la carte s’ouvre (bulles posées) en ${ms} ms après son entrée à l’écran (< 1 000), 2 000 ventes`, ms);
    else dit(bulles, `${T} C · la carte était déjà à l’écran au chargement (${avant}) : bulles posées`, avant);
    // Le même travail sur commande : toute la période (les 2 000 ventes) recalculée et reposée.
    await calme();
    // Chronométré DANS la page (du clic à la dernière bulle posée, MutationObserver) : ni l'aller-retour
    // de Playwright ni son sondage ne comptent.
    let cdp = null;
    if (process.env.PROFIL) { cdp = await pg.context().newCDPSession(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    const mesure = await pg.evaluate(() => new Promise((ok) => {
      const s = document.querySelector('[data-carte-ventes]'), b = document.querySelector('[data-cv-periode="tout"]');
      if (!s || !b) return ok({ ok: false, ms: -1 });
      const fini = () => +s.getAttribute('data-cv-n') >= 1900 && document.querySelectorAll('[data-cv-bulle]').length >= 8;
      const t0 = performance.now();
      const mo = new MutationObserver(() => { if (fini()) { mo.disconnect(); clearTimeout(t); ok({ ok: true, ms: Math.round(performance.now() - t0) }); } });
      mo.observe(s, { subtree: true, childList: true, attributes: true });
      const t = setTimeout(() => { mo.disconnect(); ok({ ok: fini(), ms: Math.round(performance.now() - t0) }); }, 10000);
      const cv0 = s.querySelector('canvas');
      b.click();
      const sync = Math.round(performance.now() - t0);
      setTimeout(() => { window.__fcSonde = { sync, memeCarte: s.querySelector("canvas") === cv0 }; }, 0);
    }));
    if (process.env.BAVARD || process.env.PROFIL) console.log('  sonde clic', JSON.stringify(await pg.evaluate(() => window.__fcSonde)));
    const toutOk = mesure.ok, ms2 = mesure.ms;
    if (cdp) {
      const { profile } = await cdp.send('Profiler.stop');
      const parId = new Map(profile.nodes.map((n) => [n.id, n])), soi = new Map();
      const dt = profile.timeDeltas || [];
      profile.samples.forEach((id, i) => { const n = parId.get(id); const k = `${n.callFrame.functionName || "(anon)"} ${String(n.callFrame.url).split("/").pop()}:${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`; soi.set(k, (soi.get(k) || 0) + (dt[i] || 0)); });
      console.log('  profil (ms propres) :', [...soi.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${Math.round(v / 1000)} ${k}`).join(' | '));
    }
    const nTout = await pg.evaluate(() => +document.querySelector('[data-carte-ventes]').getAttribute('data-cv-n'));
    dit(toutOk && ms2 < 1000, `${T} C · « Tout » : ${nTout} ventes agrégées et reposées en ${ms2} ms (< 1 000)`, ms2);
    await pg.locator('[data-cv-periode="12m"]').first().click().catch(() => {});
    await pg.waitForTimeout(400);
    await pg.waitForSelector('[data-cv-fond="pret"]', { timeout: 15000 }).catch(() => {});
    const C = await pg.evaluate(() => {
      const s = document.querySelector('[data-carte-ventes]');
      return { n: +s.getAttribute('data-cv-n'), sansLieu: +s.getAttribute('data-cv-sans-lieu'), nBulles: +s.getAttribute('data-cv-bulles'), fond: (s.querySelector('[data-cv-fond]') || { getAttribute: () => '' }).getAttribute('data-cv-fond'),
        bulles: [...document.querySelectorAll('[data-cv-bulle]')].map((b) => [b.getAttribute('data-cv-bulle'), +b.getAttribute('data-cv-bulle-n')]) };
    });
    dit(C.fond === 'pret', `${T} C · le fond OpenFreeMap est dessiné`, C.fond);
    dit(C.bulles.length === C.nBulles && C.bulles.every(([k]) => /^[A-Z]{2}$/.test(k)) && C.bulles.length >= 8, `${T} C · une bulle par pays (${C.bulles.length})`, C.bulles);
    dit(C.n >= 1000 && C.bulles.reduce((t, [, n]) => t + n, 0) + C.sansLieu === C.n, `${T} C · lieux + sans lieu = toutes les ventes de la période (${C.n})`, C);
    await capture(pg, nomS('carte-monde'), await pg.$('[data-carte-ventes]'));
    // ── D
    await pg.locator('[data-cv-bulle="FR"]').first().click().catch(() => {});
    const det = await pg.waitForSelector('[data-cv-detail="FR"]', { timeout: 5000 }).then(() => true).catch(() => false);
    const D = det ? await pg.evaluate(() => { const d = document.querySelector('[data-cv-detail]'); return { n: +d.getAttribute('data-cv-detail-n'), lignes: d.querySelectorAll('[data-cv-vente-num]').length, nums: [...d.querySelectorAll('[data-cv-vente-num]')].filter((x) => x.getAttribute('data-cv-vente-num')).length, txt: d.innerText.slice(0, 200) }; }) : null;
    const nFr = (C.bulles.find(([k]) => k === 'FR') || [0, 0])[1];
    dit(D && D.n === nFr && D.lignes === Math.min(30, nFr) && D.nums > 0, `${T} D · toucher la France : ${nFr} ventes, la liste (N°, date) — 30 d’abord`, D);
    await capture(pg, nomS('detail'), await pg.$('[data-carte-ventes]'));
    // ── V
    await pg.locator('[data-cv-vue-choix="france"]').first().click().catch(() => {});
    await pg.waitForFunction(() => document.querySelectorAll('[data-cv-bulle^="v|"]').length >= 15, null, { timeout: 90000 }).catch(() => {});
    await pg.waitForTimeout(800);
    const V = await pg.evaluate(() => ({ villes: document.querySelectorAll('[data-cv-bulle^="v|"]').length, deps: [...document.querySelectorAll('[data-cv-bulle^="d|"]')].map((b) => b.getAttribute('data-cv-bulle')), sansVille: +document.querySelector('[data-carte-ventes]').getAttribute('data-cv-france-sans-ville'), resume: (document.querySelector('[data-cv-resume]') || {}).innerText || '' }));
    dit(V.villes >= 15 && V.deps.includes('d|35'), `${T} V · France : ${V.villes} villes placées, Saint-Malo (sans repère) dans le département 35`, V);
    dit(V.sansVille > 0 && /sans ville/.test(V.resume), `${T} V · les ventes françaises sans ville (Vinted) sont comptées et dites`, V);
    dit(BAN.length > 0 && BAN.length <= 40 && BAN.every((q) => !/rue|Secr/i.test(decodeURIComponent(q))), `${T} V · ${BAN.length} recherches de ville (une par ville, ≤ 40, jamais une rue)`, BAN.slice(0, 3));
    await capture(pg, nomS('carte-france'), await pg.$('[data-carte-ventes]'));
    // ── P
    await pg.locator('[data-cv-plateforme="eBay"]').first().click().catch(() => {});
    await pg.waitForTimeout(400);
    const nEbay = await pg.evaluate(() => +document.querySelector('[data-carte-ventes]').getAttribute('data-cv-n'));
    dit(nEbay > 0 && nEbay < C.n && nEbay <= 400, `${T} P · filtre eBay : ${nEbay} ventes (sur ${C.n})`, nEbay);
  }
  // ── X
  const X = await pg.evaluate((sec) => {
    const t = document.body.innerText;
    return { fuites: sec.filter((s) => t.includes(s)), mauvais: [/\bNaN\b/, /\bundefined\b/, /Invalid Date/, /\[object Object\]/].filter((re) => re.test(t)).map(String),
      debord: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      horsCarte: [...document.querySelectorAll('.vrm-fc-carte, .vrm-cv-cadre')].some((c) => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll('.vrm-fc-val, .vrm-fc-nom, button')].some((e) => { const q = e.getBoundingClientRect(); return q.width && (q.right > r.right + 1 || q.left < r.left - 1); }); }) };
  }, SECRETS);
  dit(!X.fuites.length, `${T} X · aucun pseudo, nom, rue ni téléphone d’acheteur à l’écran`, X.fuites);
  dit(!X.mauvais.length, `${T} X · ni NaN, ni undefined, ni [object Object]`, X.mauvais);
  dit(!X.debord && !X.horsCarte, `${T} X · rien ne déborde (ni la page, ni une rangée hors de sa carte)`, X);
  dit(!o.journal.erreurs.length, `${T} X · aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  const FIX = await fixtureCarte();
  if (!FIX.pret) console.log('⚠️  fond OpenFreeMap du banc indisponible (réseau ?) : style minimal, le rendu réel n’est PAS jugé.');
  await new Promise((okk) => NV.srv.listen(NV.PORT, okk));
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      try { await passe(nav, FIX, { W, theme }); } catch (e) { dit(false, `[${W}px ${theme}] la passe a levé`, e && e.stack); }
    }
  } finally { await nav.close(); try { NV.srv.close(); } catch (_) {} }
  console.log(`\n${ko ? '❌' : '✅'} banc frais-carte : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
