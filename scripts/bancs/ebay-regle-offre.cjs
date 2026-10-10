// Banc : eBay → Annonces · LA RÈGLE D'OFFRE (9 octobre) — l'écran RENDU, sur
// des données INVENTÉES (il vit dans le dépôt, qui est public : aucune fixture).
//
// Julien : « je veux juste définir une règle sur chaque annonce et à chaque
// offre au-dessus ça accepte » — sur eBay seulement, avec le réglage NATIF
// d'eBay : c'est eBay qui accepte, au seuil posé sur l'annonce, sur SON clic.
// Ce banc rend l'onglet eBay → Annonces à 390 et 1512 px (deux comptes eBay
// inventés) et juge les `data-*` posés par l'écran, les couleurs CALCULÉES et
// le CORPS EXACT de ce qui part vers `/api/ebay` (ordre des clés compris) —
// jamais une formulation (sauf la présence d'un montant dans une feuille) :
//   1. trois états par annonce (connue · aucune · pas su), « pas su » sans
//      aucun montant et sans « aucune » ; une lecture ancienne vaut « pas su » ;
//   2. ce que ça engage, dit UNE fois (et les deux fenêtres où eBay vend sans
//      que VRM le voie) ; la ligne « pas su » UNE fois, ambre seulement s'il y
//      a un risque ;
//   3. les ventes eBay relues à l'ouverture quand une règle est posée et
//      qu'elles ont plus de 6 h — jamais sans règle ;
//   4. « Relire chez eBay » compte par compte, avec SON compte ;
//   5–8. poser / changer / retirer sur la carte : gardes, feuille, Annuler
//      n'envoie rien, un seul envoi au double clic, le compte DE L'ANNONCE,
//      et chaque issue de la route dite (et coloriée) comme il faut ;
//   9. « Une règle pour toutes » : aperçu, décochés par défaut, une par une
//      (jamais deux en vol), bilan complet, Arrêter, démontage ;
//   10. pas de règle sur une paire vendue / en vente sur deux comptes / dont
//      la vente n'a pas pu être vérifiée — retirer reste possible ;
//   11. le changement de prix dit ce qu'il advient de la règle ;
//   12. l'offre aux observateurs sous la règle ;
//   13. panne de la lecture des règles : « pas su » partout, rien n'est relu ;
//   et partout : aucun débordement, aucune erreur de page, aucun écran mort.
//        node scripts/bancs/ebay-regle-offre.cjs [--blocs 1,5,9] [--taille 1512]
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4761;
const iB = process.argv.indexOf('--blocs');
const BLOCS = iB > 0 ? new Set(process.argv[iB + 1].split(',').map(Number)) : null;
const iT = process.argv.indexOf('--taille');
const TAILLES = [{ width: 390, height: 844 }, { width: 1512, height: 950 }].filter((v) => iT < 0 || String(v.width) === process.argv[iT + 1]);
const CAPTURES = path.join(os.tmpdir(), 'banc-ebay-regle-offre');
fs.mkdirSync(CAPTURES, { recursive: true });

// Les couleurs de la peau eBay (EBAY_SKIN), telles que le navigateur les calcule.
const C_TEXT = 'rgb(255, 255, 255)', C_WARN = 'rgb(255, 179, 64)', C_MUTED = 'rgb(142, 142, 147)';
const H = 3600000, JOUR = 86400000;
const K1 = 'aaaaaaaaaaaaaaa1', K2 = 'bbbbbbbbbbbbbbb2';
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: new Date().toISOString() }];
// Les paires (inventées) : N° → [titre, prix d'achat]. La N°47 est VENDUE sur Vinted.
const PAIRES = { 41: ['Nike Air Max 1 bleu taille 44', 50], 42: ['Adidas Samba blanc taille 42', 85], 44: ['Asics Gel 1130 argent taille 39', null], 45: ['New Balance 550 gris taille 44', null], 46: ['Puma Suede rouge taille 41', null], 47: ['Reebok Club C blanc taille 42', null], 48: ['Converse Chuck 70 noir taille 43', 92], 49: ['Nike Dunk Low gris taille 42', null] };
const idV = (n) => 9000 + Number(n);
const FICHES = Object.fromEntries(Object.entries(PAIRES).map(([n, [t, b]]) => [String(idV(n)), { numero: n, title: t, photo: `https://img.test/v${idV(n)}.jpg`, ...(b != null ? { buyPrice: String(b) } : {}) }]));
const LISTINGS_V = () => ({ capturedAt: new Date().toISOString(), payload: { items: Object.entries(PAIRES).map(([n, [t]]) => ({ id: idV(n), title: t, price: { amount: '60.0', currency_code: 'EUR' }, brand_title: t.split(' ')[0], is_closed: n === '47', is_hidden: false, is_draft: false, photo: { url: `https://img.test/v${idV(n)}.jpg` } })) } });
const TXN = { id: 'harvest_111_txn_8047', data: { payload: { transaction: { id: 8047, item_id: 9047, status: 450, status_title: 'Commande finalisée' } } } };
const VENTES = { id: 'harvest_111_orders_sold', data: { capturedAt: new Date().toISOString(), payload: { my_orders: [{ transaction_id: 8047, title: PAIRES[47][0], price: { amount: '60.0', currency_code: 'EUR' }, status: 'Commande finalisée', date: new Date(Date.now() - 2 * JOUR).toISOString() }] } } };
const ann = (itemId, title, price, sku) => ({ itemId, title, price, sku, qty: '1', observateurs: 0, photo: '', url: 'https://www.ebay.fr/itm/' + itemId });
const A = { A1: '130000000001', A2: '130000000002', A3: '130000000003', A4: '130000000004', A5: '130000000005', A6: '130000000006', A7: '130000000007', B1: '130000000101', B2: '130000000102', B3: '130000000103' };
const ANN_P = () => [ann(A.A1, 'Nike Air Max 1 bleu taille 44', '80.0', 'VRM-41'), ann(A.A2, 'Adidas Samba blanc taille 42', '90.0', 'VRM-42'), ann(A.A3, 'Salomon XT-6 noir taille 43', '120.0', ''),
  ann(A.A4, 'Asics Gel 1130 argent taille 39', '70.0', 'VRM-44'), ann(A.A5, 'Reebok Club C blanc taille 42', '60.0', 'VRM-47'), ann(A.A6, 'Converse Chuck 70 noir taille 43', '100.0', 'VRM-48'), ann(A.A7, 'Vans Old Skool noir taille 41', '50.0', '')];
const ANN_K2 = () => [ann(A.B1, 'New Balance 550 gris taille 44', '100.0', 'VRM-45'), ann(A.B2, 'Puma Suede rouge taille 41', '0.05', 'VRM-46'), ann(A.B3, 'Nike Dunk Low gris taille 42', '80.0', 'VRM-49')];
// Ce que VRM a rangé (`ebay_offres{_clé}`) : la base de l'écran.
const entree = (o) => ({ lu: true, devise: 'EUR', lueA: Date.now() - H, offresFaites: null, ...o });
const OFFRES_P = () => ({
  [A.A1]: entree({ offresActives: true, accepte: 72, refuse: 60, prix: 80, offresFaites: 2 }),
  [A.A2]: entree({ offresActives: null, accepte: null, refuse: null, prix: 90 }),
  [A.A4]: entree({ offresActives: true, accepte: 65, refuse: null, prix: 75 }),
  [A.A5]: entree({ offresActives: true, accepte: 54, refuse: null, prix: 60 }),
  [A.A6]: entree({ offresActives: true, accepte: 95, refuse: null, prix: 100, lueA: Date.now() - 10 * JOUR }),
  [A.A7]: entree({ offresActives: false, accepte: null, refuse: null, prix: 50 }),
});
const OFFRES_K2 = () => ({
  [A.B1]: entree({ offresActives: null, accepte: null, refuse: null, prix: 100 }),
  [A.B2]: entree({ offresActives: null, accepte: null, refuse: null, prix: 0.05 }),
  [A.B3]: entree({ offresActives: true, accepte: null, refuse: null, prix: 85 }),
});

let rows = [], cfg = {}, ebay = {}, envois = [], bruts = [], scen = {}, enVol = 0, maxEnVol = 0, ecrituresMain = 0, apiEbay = 0;
// L'état d'eBay (le faux) : ce qu'eBay TIENT, par annonce — prix et règle.
const preparer = (c) => {
  cfg = c || {};
  const offresP = OFFRES_P(), offresK2 = OFFRES_K2();
  if (cfg.offresP) cfg.offresP(offresP);
  const annP = ANN_P(), annK2 = ANN_K2();
  if (cfg.annonces) cfg.annonces(annP, annK2);
  rows = [
    { id: 'main', data: { vinted_annonce_numeros: FICHES, vrm_ebay_compte_pub: K1, ...(cfg.retraitAuto ? { vrm_ebay_retrait_auto: true } : {}) } },
    { id: 'harvest_111_listings', data: LISTINGS_V() }, TXN, VENTES,
    { id: 'lbc_ventes', data: { ventes: {} } },
    { id: 'ebay_comptes', data: { comptes: [{ cle: K1, pseudo: 'paire_perso', principal: true, ajouteLe: 1 }, { cle: K2, pseudo: 'paire_pro', principal: false, ajouteLe: 2 }] } },
    { id: 'ebay_listings', data: { items: annP, capturedAt: Date.now() } },
    { id: 'ebay_listings_' + K2, data: { items: annK2, capturedAt: Date.now() } },
    { id: 'ebay_orders', data: { orders: [], capturedAt: Date.now() - (cfg.ventesAgeP || H) } },
    { id: 'ebay_orders_' + K2, data: { orders: [], capturedAt: Date.now() - H } },
    { id: 'ebay_programmees', data: { items: [], enLigne: [], complet: true, capturedAt: Date.now() } },
    { id: 'ebay_programmees_' + K2, data: { items: [], enLigne: [], complet: true, capturedAt: Date.now() } },
    { id: 'ebay_offres', data: { items: offresP, capturedAt: Date.now() } },
    { id: 'ebay_offres_' + K2, data: { items: offresK2, capturedAt: Date.now() } },
  ];
  ebay = {};
  for (const a of annP) ebay[a.itemId] = { compte: 'principal', prix: Number(a.price), regle: { offresActives: false, accepte: null, refuse: null, offresFaites: null } };
  for (const a of annK2) ebay[a.itemId] = { compte: K2, prix: Number(a.price), regle: { offresActives: false, accepte: null, refuse: null, offresFaites: null } };
  for (const [id, e] of [...Object.entries(offresP), ...Object.entries(offresK2)]) if (ebay[id]) ebay[id].regle = { offresActives: e.offresActives, accepte: e.accepte, refuse: e.refuse, offresFaites: e.offresFaites };
  // eBay d'aujourd'hui (A4 : son prix est 70, la règle relue à 75 ; B3 : 80).
  ebay[A.A4].regle = { offresActives: true, accepte: 65, refuse: null, offresFaites: null };
  if (cfg.ebay) cfg.ebay(ebay);
  envois = []; bruts = []; scen = cfg.scen || {}; enVol = 0; maxEnVol = 0; ecrituresMain = 0; apiEbay = 0;
};
const cents = (v) => (v == null ? null : Math.round(Number(v) * 100));
const eurT = (n) => Number(n).toFixed(2).replace('.', ',') + ' €';
const lecture = (id) => { const s = ebay[id]; return { lu: true, offresActives: s.regle.offresActives, accepte: s.regle.accepte, refuse: s.regle.refuse, devise: 'EUR', prix: s.prix, offresFaites: s.regle.offresFaites == null ? null : s.regle.offresFaites, lueA: Date.now() }; };
const ligneOffres = (compte) => rows.find((r) => r.id === 'ebay_offres' + (compte === 'principal' ? '' : '_' + compte));
const ranger = (compte, id, l) => { const r = ligneOffres(compte); if (r) r.data.items[id] = { ...l }; };
const compteDe = (body) => (body && body.compte) || 'principal';

let ko = 0, nControles = 0;
const dit = (c, m, d) => { nControles++; if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};

async function ouvrir(b, vp, c) {
  preparer(c);
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(([fiches, ra]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches)); if (ra) localStorage.setItem('vrm_ebay_retrait_auto', 'true'); } catch (_) {} }, [FICHES, !!cfg.retraitAuto]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      try { for (const l of [].concat(JSON.parse(route.request().postData() || 'null') || [])) { if (!l || !l.id) continue; if (l.id === 'main') ecrituresMain++; const i = rows.findIndex((r) => r.id === l.id); if (i >= 0) rows[i] = { id: l.id, data: l.data }; else rows.push({ id: l.id, data: l.data }); } } catch (_) {}
      return j([]);
    }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (cfg.offres500 && /id=eq\.ebay_offres/.test(u)) return j({ message: 'panne' }, 500);
    if (cfg.offresDelai && /id=eq\.ebay_offres/.test(u)) await attendre(cfg.offresDelai);
    if (cfg.txn500 && /_txn_/.test(u)) return j({ message: 'panne' }, 500);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date().toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // ⚠️ enregistré APRÈS le fourre-tout → Playwright le prend en PREMIER (§6.6).
  await pg.route('**/api/ebay**', async (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    apiEbay++;
    const brut = req.postData() || '{}';
    let body = {}; try { body = JSON.parse(brut); } catch (_) {}
    if (['regleoffre', 'regleoffrelire', 'sync', 'revise'].includes(body.action)) { envois.push(body); bruts.push(brut); }
    if (body.action === 'status') {
      if (cfg.statusDelai) await attendre(cfg.statusDelai);
      if (cfg.status500) return j({ ok: false, error: 'panne' }, 500);
      return j({ ok: true, connected: true, comptes: [{ cle: K1, pseudo: 'paire_perso', principal: true, relie: true }, { cle: K2, pseudo: 'paire_pro', principal: false, relie: true }] });
    }
    if (body.action === 'offreinfo') return j({ ok: true, eligibles: cfg.eligibles || [], complet: true });
    if (body.action === 'sync') {
      if (cfg.sync500) return j({ ok: false, error: 'panne' }, 500);
      const r = rows.find((x) => x.id === 'ebay_orders' + (compteDe(body) === 'principal' ? '' : '_' + body.compte));
      if (r) r.data = { ...r.data, capturedAt: Date.now() };
      return j({ ok: true });
    }
    if (body.action === 'regleoffrelire') {
      const lectures = {};
      for (const id of body.itemIds || []) {
        const s = ebay[id];
        if (!s || s.compte !== compteDe(body)) { lectures[id] = { lu: false, raison: 'pas-sur-ce-compte' }; continue; }
        lectures[id] = { ...lecture(id), par: 'relire' }; ranger(s.compte, id, lectures[id]);
      }
      return j({ ok: true, lectures, range: true });
    }
    if (body.action === 'revise') {
      const id = String(body.itemId); const s = ebay[id];
      const sc = scen['revise:' + id] && scen['revise:' + id].shift();
      if (sc && sc.status && sc.status !== 200) return j(sc.body, sc.status);
      if (s && body.price != null) {
        s.prix = Number(String(body.price).replace(',', '.'));
        const lr = rows.find((x) => x.id === 'ebay_listings' + (s.compte === 'principal' ? '' : '_' + s.compte));
        if (lr) lr.data.items = lr.data.items.map((a) => (a.itemId === id ? { ...a, price: s.prix.toFixed(1) } : a));
      }
      if (sc) { if (sc.body.regle && sc.body.regle.lecture) { s.regle = { ...s.regle, accepte: sc.body.regle.lecture.accepte, refuse: sc.body.regle.lecture.refuse }; ranger(s.compte, id, { ...sc.body.regle.lecture, lu: true, lueA: Date.now() }); } return j(sc.body); }
      return j({ ok: true, ack: 'Success' });
    }
    if (body.action === 'regleoffre') {
      enVol++; maxEnVol = Math.max(maxEnVol, enVol);
      try {
        await attendre(cfg.regleDelai || 250);
        const id = String(body.itemId); const s = ebay[id];
        const sc = scen[id] && scen[id].shift();
        if (sc) return j(sc.body, sc.status || 200);
        if (!s || s.compte !== compteDe(body)) return j({ ok: false, reason: 'pas-sur-ce-compte', error: 'Cette annonce n\'est pas en vente sur ce compte eBay — rien n\'a été envoyé.' }, 409);
        if (body.accepte !== null) {
          if (cents(body.prixVu) !== cents(s.prix)) { const l = lecture(id); ranger(s.compte, id, l); return j({ ok: false, reason: 'prix-change', prix: s.prix, lecture: l, error: `Le prix sur eBay est maintenant de ${eurT(s.prix)} (VRM affichait ${eurT(body.prixVu)}) : rien n'a été envoyé. Revois le montant.` }, 409); }
          const a = body.attendu;
          if (a && typeof a === 'object' && (cents(a.accepte) !== cents(s.regle.accepte) || cents(a.refuse) !== cents(s.regle.refuse))) return j({ ok: false, reason: 'regle-changee', lecture: lecture(id), error: 'La règle sur eBay a changé depuis. Rien n\'a été envoyé — revois-la.' }, 409);
          if (a === 'inconnu' && (s.regle.accepte != null || s.regle.refuse != null)) return j({ ok: false, reason: 'regle-existante', lecture: lecture(id), error: 'eBay a déjà une règle sur cette annonce. Rien n\'a été envoyé.' }, 409);
          s.regle = { ...s.regle, offresActives: true, accepte: body.accepte, refuse: ('refuse' in body) ? body.refuse : s.regle.refuse };
        } else s.regle = { ...s.regle, accepte: null, refuse: null };
        const l = lecture(id); ranger(s.compte, id, l);
        return j({ ok: true, verifie: true, lecture: l, avertissements: [], range: true });
      } finally { enVol--; }
    }
    if (body.action === 'finances') return j({ ok: true, dispo: 10, enAttente: 0, retenu: 0, total: 10, devise: 'EUR' });
    if (body.action === 'limites') return j({ ok: true, quantite: 10, montant: 500, devise: 'EUR', inscrit: true });
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const feuille = (pg) => pg.locator('div[style*="z-index: 2000"]');
const sousOnglet = async (pg, nom) => { await pg.getByRole('button', { name: nom, exact: true }).first().click({ timeout: 8000 }); await pg.waitForTimeout(900); };
async function allerAnnonces(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#vrm-sel-compte-ebay', { timeout: 15000 });
  await sousOnglet(pg, 'Annonces');
  await pg.waitForSelector('[data-ebay-annonce]', { timeout: 12000 });
  await pg.waitForTimeout(1200);
}
const carte = (pg, id) => pg.locator(`[data-ebay-annonce="${id}"]`);
const etats = (pg) => pg.$$eval('[data-regle-offre-ligne]', (l) => Object.fromEntries(l.map((e) => [e.getAttribute('data-regle-offre-ligne'), {
  etat: e.getAttribute('data-regle-offre'), accepte: e.getAttribute('data-regle-accepte'), refuse: e.getAttribute('data-regle-refuse'),
  raison: e.getAttribute('data-regle-raison'), age: e.getAttribute('data-regle-age'), bloquee: e.getAttribute('data-regle-bloquee'), txt: e.innerText }])));
const couleur = (pg, sel) => pg.$eval(sel, (e) => getComputedStyle(e).color).catch(() => '');
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const texteCarte = (pg, id) => carte(pg, id).innerText().catch(() => '');
const regleoffres = () => bruts.filter((b) => /"action":"regleoffre"/.test(b));
async function ouvrirPanneau(pg, id) {
  const c = carte(pg, id);
  const b = c.locator('[data-regle-ouvrir], [data-regle-modifier]').first();
  await b.click({ timeout: 5000 });
  await pg.waitForSelector(`[data-regle-panneau="${id}"]`, { timeout: 5000 });
}
const saisir = async (pg, id, quoi, v) => { await pg.fill(`[data-regle-saisie-${quoi}="${id}"]`, v); await pg.waitForTimeout(150); };
const desactive = (pg, sel) => pg.$eval(sel, (e) => e.disabled).catch(() => null);
async function poser(pg, id) {
  await pg.click(`[data-regle-enregistrer="${id}"]`);
  await feuille(pg).waitFor({ timeout: 5000 });
  const t = await feuille(pg).innerText();
  await feuille(pg).getByRole('button', { name: 'Oui, poser la règle' }).click();
  await pg.waitForTimeout(900);
  return t;
}
async function finPage(pg, errs, quoi) {
  const d = await deborde(pg).catch(() => 99);
  const txt = await pg.evaluate(() => document.body.innerText).catch(() => '');
  dit(d <= 0, `${quoi} : aucun débordement horizontal`, `${d}px`);
  dit(!errs.length, `${quoi} : aucune erreur de page`, errs.slice(0, 2).join(' | '));
  dit(!/n'a pas pu s'afficher|Cannot access|is not defined/.test(txt), `${quoi} : aucun écran mort`);
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const bloc = (n) => !BLOCS || BLOCS.has(n);
    for (const vp of TAILLES) {
      const T = `${vp.width} px`;
      // ── 1. TROIS ÉTATS ──────────────────────────────────────────────────
      if (bloc(1)) await essaie(`[1] ${T} trois états`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp);
        await allerAnnonces(pg);
        const e = await etats(pg);
        dit(e[A.A1] && e[A.A1].etat === 'connue' && e[A.A1].accepte === '72.00' && e[A.A1].refuse === '60.00', `[1] ${T} A1 : connue, dès 72,00 €, refus sous 60,00 €`, JSON.stringify(e[A.A1]));
        for (const k of ['A2', 'A7', 'B1', 'B2']) {
          const x = e[A[k]]; const ouvrirOk = await carte(pg, A[k]).locator('[data-regle-ouvrir]').count();
          dit(x && x.etat === 'aucune' && ouvrirOk === 1 && !/€/.test(x.txt), `[1] ${T} ${k} : aucune règle, « Définir une règle d'offre », aucun montant`, JSON.stringify(x));
        }
        dit(e[A.A3] && e[A.A3].etat === 'pas-su' && e[A.A3].raison === 'jamais', `[1] ${T} A3 : pas su (jamais lue)`, JSON.stringify(e[A.A3]));
        const tA4 = await texteCarte(pg, A.A4);
        dit(e[A.A4] && e[A.A4].etat === 'pas-su' && e[A.A4].raison === 'prix-change' && !/65/.test(tA4), `[1] ${T} A4 : pas su (prix changé) — son ancien « 65 » n'apparaît nulle part sur la carte`, JSON.stringify(e[A.A4]));
        dit(e[A.B3] && e[A.B3].etat === 'pas-su' && e[A.B3].raison === 'prix-change', `[1] ${T} B3 (second compte) : pas su (prix changé)`);
        dit(e[A.A6] && e[A.A6].etat === 'connue' && e[A.A6].age === '10', `[1] ${T} A6 : connue, lue il y a 10 jours (dit sur la ligne)`, JSON.stringify(e[A.A6]));
        dit(Object.values(e).filter((x) => x.etat === 'pas-su').every((x) => !/aucune/i.test(x.txt)), `[1] ${T} aucune ligne « pas su » ne dit « aucune »`);
        await pg.screenshot({ path: path.join(CAPTURES, `etats-${vp.width}.png`), fullPage: true }).catch(() => {});
        await finPage(pg, errs, `[1] ${T}`);
        await ctx.close();
      });
      if (bloc(1)) await essaie(`[1] ${T} lecture ancienne`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { offresP: (o) => { o[A.A1].lueA = Date.now() - 40 * JOUR; } });
        await allerAnnonces(pg);
        const e = await etats(pg); const t = await texteCarte(pg, A.A1);
        dit(e[A.A1] && e[A.A1].etat === 'pas-su' && e[A.A1].raison === 'ancienne' && !/72/.test(t), `[1] ${T} une lecture de 40 jours vaut « pas su » (ancienne), aucun « 72 » sur la carte`, JSON.stringify(e[A.A1]));
        await ctx.close();
      });
      if (bloc(1)) await essaie(`[1] ${T} prix absent`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { annonces: (p) => { delete p[1].price; } });
        await allerAnnonces(pg);
        const e = await etats(pg);
        dit(e[A.A2] && e[A.A2].etat === 'aucune', `[1] ${T} un prix absent n'est PAS « prix changé » (l'état lu est montré)`, JSON.stringify(e[A.A2]));
        await ouvrirPanneau(pg, A.A2); await saisir(pg, A.A2, 'accepte', '50');
        dit(await desactive(pg, `[data-regle-enregistrer="${A.A2}"]`) === true, `[1] ${T} et « Enregistrer » reste grisé (prix pas lu)`);
        await ctx.close();
      });

      // ── 2. UNE FOIS ─────────────────────────────────────────────────────
      if (bloc(2)) await essaie(`[2] ${T} une fois`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp);
        await allerAnnonces(pg);
        const eng = await pg.$$eval('[data-regles-engagement]', (l) => l.map((e) => [e.getAttribute('data-regles-engagement'), e.innerText]));
        dit(eng.length === 1 && eng[0][0] === '3' && /Dont 1 lue/.test(eng[0][1]), `[2] ${T} « ce que ça engage » UNE fois, 3 annonces (A1, A5, A6), « dont 1 lue il y a plus de 7 jours »`, JSON.stringify(eng.map((x) => x[0])));
        dit(await pg.locator('[data-regles-fenetre]').count() === 1 && await pg.locator('[data-regles-vers-retrait]').count() === 1, `[2] ${T} la fenêtre du retrait est dite, avec « Voir le retrait automatique » (éteint)`);
        const avant = apiEbay, mainAvant = ecrituresMain;
        await pg.click('[data-regles-vers-retrait]'); await pg.waitForTimeout(900);
        const focus = await pg.evaluate(() => !!(document.activeElement && document.activeElement.hasAttribute('data-ebay-retrait-auto-bouton')));
        dit(focus && apiEbay === avant && ecrituresMain === mainAvant, `[2] ${T} « Voir le retrait automatique » met le focus sur son bouton — aucune requête eBay, rien d'écrit`, `focus=${focus} · api ${apiEbay - avant} · main ${ecrituresMain - mainAvant}`);
        const ps = await pg.$$eval('[data-regles-pas-su]', (l) => l.map((e) => [e.getAttribute('data-regles-pas-su'), e.getAttribute('data-regles-causes')]));
        dit(ps.length === 1 && ps[0][0] === '3' && ps[0][1] === 'jamais:1,prix-change:2', `[2] ${T} la ligne « pas su » UNE fois : 3 annonces, causes jamais:1, prix-change:2`, JSON.stringify(ps));
        dit(await couleur(pg, '[data-regles-pas-su]') === C_WARN, `[2] ${T} elle est AMBRE (A4 peut avoir une règle active sans que VRM le sache)`, await couleur(pg, '[data-regles-pas-su]'));
        await finPage(pg, errs, `[2] ${T}`);
        await ctx.close();
      });
      if (bloc(2)) await essaie(`[2] ${T} variantes`, async () => {
        { const { ctx, pg } = await ouvrir(b, vp, { offresP: (o) => { delete o[A.A4]; } }); await allerAnnonces(pg);
          dit(await couleur(pg, '[data-regles-pas-su]') === C_MUTED, `[2] ${T} sans risque (A4 retirée), la ligne « pas su » reste DISCRÈTE`, await couleur(pg, '[data-regles-pas-su]')); await ctx.close(); }
        { const { ctx, pg } = await ouvrir(b, vp, { retraitAuto: true }); await allerAnnonces(pg);
          dit(await pg.locator('[data-regles-engagement]').count() === 1 && await pg.locator('[data-regles-fenetre]').count() === 1 && await pg.locator('[data-regles-vers-retrait]').count() === 0, `[2] ${T} retrait automatique ALLUMÉ : la fenêtre est TOUJOURS dite, sans le lien`); await ctx.close(); }
        { const { ctx, pg } = await ouvrir(b, vp, { offresP: (o) => { delete o[A.A1]; delete o[A.A5]; delete o[A.A6]; } }); await allerAnnonces(pg);
          dit(await pg.locator('[data-regles-engagement]').count() === 0, `[2] ${T} aucune règle connue ⇒ aucun bloc d'engagement`); await ctx.close(); }
        { const { ctx, pg } = await ouvrir(b, vp, { offresP: (o) => { o[A.A7] = entree({ offresActives: true, accepte: 40, refuse: null, prix: 50 }); } }); await allerAnnonces(pg);
          const k = await pg.$eval('[data-ebay-non-reliees-regles]', (e) => e.getAttribute('data-ebay-non-reliees-regles')).catch(() => null);
          const haut = await pg.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.parentElement && n.parentElement.closest('[data-ebay-annonce]')) continue; out.push(n.textContent); } return out.join(' '); });
          const nPas = (haut.match(/pas reliée/g) || []).length, nAuc = (haut.match(/reliée à aucune/g) || []).length;
          dit(k === '1' && nPas <= 1 && nAuc <= 1, `[2] ${T} une annonce NON reliée avec une règle ⇒ un morceau ajouté à la phrase existante (pas une alerte de plus)`, `k=${k} · « pas reliée »×${nPas} · « reliée à aucune »×${nAuc}`); await ctx.close(); }
      });

      // ── 3. LA FENÊTRE DES VENTES ────────────────────────────────────────
      if (bloc(3)) await essaie(`[3] ${T} ventes relues`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { ventesAgeP: 3 * JOUR });
        await allerAnnonces(pg); await pg.waitForTimeout(1500);
        const syncs = bruts.filter((x) => /"action":"sync"/.test(x));
        dit(syncs.length === 1 && syncs[0] === '{"action":"sync"}', `[3] ${T} à l'ouverture : UNE relecture des ventes eBay du compte qui a des règles (3 jours), aucune pour l'autre`, JSON.stringify(syncs));
        const age = await pg.$eval('[data-regles-fenetre-ventes]', (e) => e.getAttribute('data-regles-ventes-age-h')).catch(() => null);
        dit(age === '0', `[3] ${T} ensuite : dernière lecture il y a 0 h`, String(age));
        await ctx.close();
      });
      if (bloc(3)) await essaie(`[3] ${T} relecture en panne`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { ventesAgeP: 3 * JOUR, sync500: true });
        await allerAnnonces(pg); await pg.waitForTimeout(1500);
        const age = await pg.$eval('[data-regles-fenetre-ventes]', (e) => e.getAttribute('data-regles-ventes-age-h')).catch(() => null);
        dit(age === '72' && await couleur(pg, '[data-regles-fenetre-ventes]') === C_WARN && await pg.locator('[data-regles-relire-ventes]').count() === 1, `[3] ${T} relecture ratée : « il y a 72 h », en ambre, avec « Relire mes ventes eBay »`, `age=${age}`);
        const n0 = bruts.filter((x) => /"action":"sync"/.test(x)).length;
        await pg.click('[data-regles-relire-ventes]'); await pg.waitForTimeout(1200);
        const s = bruts.filter((x) => /"action":"sync"/.test(x)).slice(n0);
        dit(s.length === 1 && s[0] === '{"action":"sync"}', `[3] ${T} le bouton relit les ventes du compte qui a des règles`, JSON.stringify(s));
        await ctx.close();
      });
      if (bloc(3)) await essaie(`[3] ${T} sans règle`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { ventesAgeP: 3 * JOUR, offresP: (o) => { delete o[A.A1]; delete o[A.A4]; delete o[A.A5]; delete o[A.A6]; } });
        // (A4 est « pas su » à l'écran, mais sa règle rangée est active : elle compte — on la retire aussi.)
        await allerAnnonces(pg); await pg.waitForTimeout(1500);
        dit(!bruts.some((x) => /"action":"sync"/.test(x)), `[3] ${T} sans règle connue : AUCUNE relecture à l'ouverture (rien ne change)`);
        await ctx.close();
      });

      // ── 4. RELIRE CHEZ eBAY ─────────────────────────────────────────────
      if (bloc(4)) await essaie(`[4] ${T} relire`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp);
        await allerAnnonces(pg);
        await pg.click('[data-regles-relire]'); await pg.waitForTimeout(1500);
        const r = bruts.filter((x) => /regleoffrelire/.test(x));
        dit(r.length === 2 && r[0] === '{"action":"regleoffrelire","itemIds":["130000000003","130000000004"]}' && r[1] === '{"action":"regleoffrelire","itemIds":["130000000103"],"compte":"bbbbbbbbbbbbbbb2"}', `[4] ${T} deux envois, un par compte, chacun avec SON compte`, JSON.stringify(r));
        const e = await etats(pg);
        dit(e[A.A3].etat === 'aucune' && e[A.A4].etat === 'connue' && e[A.A4].accepte === '65.00' && e[A.B3].etat === 'aucune', `[4] ${T} ensuite : A3 aucune, A4 connue (65 €), B3 aucune`, JSON.stringify([e[A.A3].etat, e[A.A4].etat, e[A.A4].accepte, e[A.B3].etat]));
        dit(await pg.locator('[data-regles-pas-su]').count() === 0, `[4] ${T} la ligne « pas su » disparaît`);
        await finPage(pg, errs, `[4] ${T}`);
        await ctx.close();
      });
      if (bloc(4)) await essaie(`[4] ${T} statut lent / en panne`, async () => {
        { const { ctx, pg } = await ouvrir(b, vp, { statusDelai: 3000 });
          await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('#vrm-sel-compte-ebay', { timeout: 15000 }); await sousOnglet(pg, 'Annonces');
          await pg.waitForSelector('[data-regles-relire]', { timeout: 8000 });
          const d1 = await desactive(pg, '[data-regles-relire]'); await pg.waitForTimeout(3500); const d2 = await desactive(pg, '[data-regles-relire]');
          dit(d1 === true && d2 === false, `[4] ${T} tant qu'on ne sait pas quels comptes sont reliés, « Relire chez eBay » est grisé`, `${d1} → ${d2}`); await ctx.close(); }
        { const { ctx, pg } = await ouvrir(b, vp, { status500: true }); await allerAnnonces(pg);
          await pg.click('[data-regles-relire]'); await pg.waitForTimeout(900);
          const t = await pg.$eval('[data-regles-relecture]', (e) => e.innerText).catch(() => '');
          dit(!bruts.some((x) => /regleoffrelire/.test(x)) && t && !/non relié|pas relié/.test(t), `[4] ${T} connexions illisibles : rien n'est envoyé, et aucun compte n'est dit « non relié »`, t); await ctx.close(); }
      });

      // ── 5. POSER (A2) ───────────────────────────────────────────────────
      if (bloc(5)) await essaie(`[5] ${T} poser`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp);
        await allerAnnonces(pg); await ouvrirPanneau(pg, A.A2);
        await saisir(pg, A.A2, 'accepte', '90');
        dit(await pg.locator(`[data-regle-erreur="${A.A2}"]`).count() === 1 && await desactive(pg, `[data-regle-enregistrer="${A.A2}"]`) === true, `[5] ${T} 90 € = le prix : erreur, « Enregistrer » grisé`);
        await saisir(pg, A.A2, 'accepte', '40');
        const d1 = await desactive(pg, `[data-regle-enregistrer="${A.A2}"]`);
        await pg.click(`[data-regle-sous-moitie="${A.A2}"] input`); await pg.waitForTimeout(150);
        const d2 = await desactive(pg, `[data-regle-enregistrer="${A.A2}"]`);
        dit(d1 === true && d2 === false, `[5] ${T} 40 € (moins de la moitié) : grisé tant que la case n'est pas cochée`, `${d1} → ${d2}`);
        await saisir(pg, A.A2, 'accepte', '81');
        dit(await pg.locator(`[data-regle-sous-achat="${A.A2}"]`).count() === 1, `[5] ${T} 81 € : signalé sous le prix d'achat (85 €)`);
        await pg.click(`[data-regle-enregistrer="${A.A2}"]`); await feuille(pg).waitFor({ timeout: 5000 });
        const tf = await feuille(pg).innerText();
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click(); await pg.waitForTimeout(500);
        dit(/81,00\s*€/.test(tf) && regleoffres().length === 0, `[5] ${T} la feuille dit le montant (81,00 €) ; Annuler n'envoie RIEN`, `envois=${regleoffres().length}`);
        await pg.click(`[data-regle-enregistrer="${A.A2}"]`); await feuille(pg).waitFor({ timeout: 5000 });
        // Double clic à la souris (1512 px). Au téléphone, la feuille de confirmation
        // (commune à toute l'app) est en bas : le 2ᵉ toucher passe à la barre
        // d'onglets dessous — constaté, hors de cette règle ; on touche une fois.
        { const oui = feuille(pg).getByRole('button', { name: 'Oui, poser la règle' }); await (vp.width < 600 ? oui.click() : oui.dblclick()).catch(() => {}); }
        await pg.waitForTimeout(1200);
        const r = regleoffres();
        dit(r.length === 1 && r[0] === '{"action":"regleoffre","itemId":"130000000002","accepte":81,"prixVu":90,"attendu":{"accepte":null,"refuse":null},"confirme":true}', `[5] ${T} Oui${vp.width < 600 ? '' : ' (double clic)'} : UN seul envoi, le corps exact`, JSON.stringify(r));
        const e = await etats(pg);
        dit(!!e[A.A2] && e[A.A2].etat === 'connue' && e[A.A2].accepte === '81.00' && await couleur(pg, `[data-ebay-info="${A.A2}"]`) === C_TEXT, `[5] ${T} la carte passe « connue » à 81,00 €, message en couleur de texte (jamais vert)`, `${JSON.stringify(e[A.A2] || Object.keys(e))} ${await couleur(pg, `[data-ebay-info="${A.A2}"]`)}`);
        if (!e[A.A2]) await pg.screenshot({ path: path.join(CAPTURES, `poser-${vp.width}.png`), fullPage: true }).catch(() => {});
        await finPage(pg, errs, `[5] ${T}`);
        await ctx.close();
      });
      if (bloc(5)) await essaie(`[5] ${T} sous la moitié confirmé`, async () => {
        const { ctx, pg } = await ouvrir(b, vp);
        await allerAnnonces(pg); await ouvrirPanneau(pg, A.A2);
        await saisir(pg, A.A2, 'accepte', '40'); await pg.click(`[data-regle-sous-moitie="${A.A2}"] input`); await pg.waitForTimeout(150);
        await poser(pg, A.A2);
        const r = regleoffres();
        dit(r.length === 1 && /"attendu":\{"accepte":null,"refuse":null\},"sousMoitie":true,"confirme":true\}$/.test(r[0]), `[5] ${T} la case cochée pose "sousMoitie":true juste avant "confirme"`, r[0]);
        await ctx.close();
      });

      // ── 6. REFUS ET RETRAIT (A1) ────────────────────────────────────────
      if (bloc(6)) await essaie(`[6] ${T} refus et retrait`, async () => {
        const { ctx, pg } = await ouvrir(b, vp);
        await allerAnnonces(pg); await ouvrirPanneau(pg, A.A1);
        const a = await pg.inputValue(`[data-regle-saisie-accepte="${A.A1}"]`), r0 = await pg.inputValue(`[data-regle-saisie-refuse="${A.A1}"]`);
        const nf = await pg.$eval(`[data-regle-panneau="${A.A1}"] [data-regle-offres-faites]`, (e) => e.getAttribute('data-regle-offres-faites')).catch(() => null);
        dit(a === '72' && r0 === '60' && nf === '2', `[6] ${T} « Modifier » : 72 / 60 pré-remplis, et les 2 offres déjà faites dites`, `${a} / ${r0} / ${nf}`);
        await saisir(pg, A.A1, 'refuse', '75');
        dit(await pg.locator(`[data-regle-erreur="${A.A1}"]`).count() === 1 && await desactive(pg, `[data-regle-enregistrer="${A.A1}"]`) === true, `[6] ${T} refus 75 € ≥ acceptation : erreur, grisé`);
        await saisir(pg, A.A1, 'refuse', ''); await saisir(pg, A.A1, 'accepte', '74');
        const tf = await poser(pg, A.A1);
        const r = regleoffres();
        dit(/Le refus sous 60,00\s*€ sera retiré/.test(tf) && r[0] === '{"action":"regleoffre","itemId":"130000000001","accepte":74,"refuse":null,"prixVu":80,"attendu":{"accepte":72,"refuse":60},"confirme":true}', `[6] ${T} refus effacé : la feuille le dit, le corps porte "refuse":null et la règle VUE`, r[0]);
        await ouvrirPanneau(pg, A.A1);
        await pg.click(`[data-regle-retirer="${A.A1}"]`); await pg.waitForTimeout(1000);
        const feuilleOuverte = await feuille(pg).count();
        const r2 = regleoffres();
        dit(feuilleOuverte === 0 && r2[1] === '{"action":"regleoffre","itemId":"130000000001","accepte":null,"refuse":null,"confirme":true}', `[6] ${T} « Retirer la règle » : un clic, AUCUNE feuille, le corps exact`, r2[1]);
        const e = await etats(pg);
        dit(e[A.A1].etat === 'aucune', `[6] ${T} la carte passe « aucune »`, e[A.A1].etat);
        await ctx.close();
      });

      // ── 7. LE COMPTE DE L'ANNONCE ───────────────────────────────────────
      if (bloc(7)) await essaie(`[7] ${T} compte`, async () => {
        const { ctx, pg } = await ouvrir(b, vp);
        await allerAnnonces(pg); await ouvrirPanneau(pg, A.B1);
        await saisir(pg, A.B1, 'accepte', '90'); await poser(pg, A.B1);
        const r = regleoffres();
        dit(r[0] === '{"action":"regleoffre","itemId":"130000000101","accepte":90,"prixVu":100,"attendu":{"accepte":null,"refuse":null},"confirme":true,"compte":"bbbbbbbbbbbbbbb2"}', `[7] ${T} B1 part avec SON compte (pas celui de la dernière publication)`, r[0]);
        await pg.selectOption('#vrm-sel-compte-ebay', 'principal'); await pg.waitForTimeout(900);
        const ids = await pg.$$eval('[data-ebay-annonce]', (l) => l.map((e) => e.getAttribute('data-ebay-annonce')));
        dit(!ids.some((x) => /^1300000001/.test(x)), `[7] ${T} vue du premier compte : aucune carte du second`, JSON.stringify(ids));
        await ctx.close();
      });

      // ── 8. LES ISSUES SUR LA CARTE ──────────────────────────────────────
      if (bloc(8)) await essaie(`[8] ${T} incertain`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { scen: {} });
        await allerAnnonces(pg); await ouvrirPanneau(pg, A.B1);
        await saisir(pg, A.B1, 'accepte', '90'); await poser(pg, A.B1);
        scen[A.B1] = [{ status: 504, body: { ok: false, reason: 'incertain', error: 'eBay n\'a pas répondu clairement — je ne sais pas si la règle est posée. « Relire chez eBay » avant de recommencer.' } }];
        await ouvrirPanneau(pg, A.B1); await saisir(pg, A.B1, 'accepte', '85'); await poser(pg, A.B1);
        const r = regleoffres(); const e = await etats(pg);
        dit(e[A.B1].etat === 'pas-su' && !/€/.test(e[A.B1].txt) && await couleur(pg, `[data-ebay-info="${A.B1}"]`) === C_WARN && /"attendu":\{"accepte":90,"refuse":null\}/.test(r[1] || ''), `[8] ${T} 504 : « pas su », aucun montant, message ambre ; le 2ᵉ envoi portait la règle vue (90)`, `${e[A.B1].etat} · ${r[1]}`);
        await ctx.close();
      });
      if (bloc(8)) await essaie(`[8] ${T} règle existante`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { ebay: (s) => { s[A.A3].regle = { offresActives: true, accepte: 110, refuse: null, offresFaites: null }; } });
        await allerAnnonces(pg); await ouvrirPanneau(pg, A.A3);
        await saisir(pg, A.A3, 'accepte', '100'); await poser(pg, A.A3);
        const r = regleoffres(); let e = await etats(pg);
        dit(!/"refuse"/.test(r[0]) && /"attendu":"inconnu"/.test(r[0]) && await pg.locator('[data-regle-existante]').count() === 1 && e[A.A3].etat === 'connue' && e[A.A3].accepte === '110.00' && await pg.locator(`[data-regle-panneau="${A.A3}"]`).count() === 1,
          `[8] ${T} « pas su » : sans clé refuse, attendu « inconnu » ⇒ 409, la règle d'eBay (110) montrée, le panneau reste ouvert`, r[0]);
        await poser(pg, A.A3);
        const r2 = regleoffres(); e = await etats(pg);
        dit(/"attendu":\{"accepte":110,"refuse":null\}/.test(r2[1] || '') && e[A.A3].etat === 'connue' && e[A.A3].accepte === '100.00', `[8] ${T} le 2ᵉ envoi porte la règle LUE (110) ⇒ connue à 100 €`, r2[1]);
        await ctx.close();
      });
      if (bloc(8)) await essaie(`[8] ${T} prix changé`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { ebay: (s) => { s[A.A2].prix = 95; } });
        await allerAnnonces(pg); await ouvrirPanneau(pg, A.A2);
        await saisir(pg, A.A2, 'accepte', '81'); await poser(pg, A.A2);
        const e = await etats(pg);
        const prix = await carte(pg, A.A2).locator('[data-ebay-prix]').getAttribute('data-ebay-prix').catch(() => '');
        const info = await pg.$eval(`[data-ebay-info="${A.A2}"]`, (x) => x.innerText).catch(() => '');
        dit(await pg.locator('[data-regle-prix-change]').count() === 1 && prix === '95.00' && !/✓/.test(info) && e[A.A2].etat === 'aucune', `[8] ${T} 409 prix changé : le panneau le dit, la carte affiche 95,00 €, aucun ✓, état « aucune » (le prix local suit)`, `${prix} · ${e[A.A2].etat}`);
        await ctx.close();
      });
      if (bloc(8)) await essaie(`[8] ${T} refus, écart, non relu, non noté`, async () => {
        const L0 = (o) => ({ lu: true, devise: 'EUR', lueA: Date.now(), offresFaites: null, ...o });
        const { ctx, pg } = await ouvrir(b, vp, { scen: {
          [A.A7]: [{ status: 422, body: { ok: false, reason: 'refus', error: 'La catégorie de cette annonce n\'accepte pas les offres.' } }],
          [A.A2]: [
            { body: { ok: true, verifie: false, lecture: L0({ offresActives: true, accepte: null, refuse: null, prix: 90 }), avertissements: [], range: true } },
            { body: { ok: true, verifie: null, lecture: null, avertissements: [], range: true } },
            { body: { ok: true, verifie: true, lecture: L0({ offresActives: true, accepte: 81, refuse: null, prix: 90 }), avertissements: [], range: false } },
          ] } });
        await allerAnnonces(pg);
        await ouvrirPanneau(pg, A.A7); await saisir(pg, A.A7, 'accepte', '45'); await poser(pg, A.A7);
        let info = await pg.$eval(`[data-ebay-info="${A.A7}"]`, (x) => x.innerText).catch(() => '');
        let e = await etats(pg);
        dit(/n'accepte pas les offres/.test(info) && await couleur(pg, `[data-ebay-info="${A.A7}"]`) === C_WARN && e[A.A7].etat === 'aucune', `[8] ${T} 422 : le message d'eBay, en ambre, A7 reste « aucune »`, info);
        await ouvrirPanneau(pg, A.A2); await saisir(pg, A.A2, 'accepte', '81'); await poser(pg, A.A2);
        info = await pg.$eval(`[data-ebay-info="${A.A2}"]`, (x) => x.innerText).catch(() => ''); e = await etats(pg);
        dit(/activé les offres mais n'a pas gardé le montant/.test(info) && !/✓/.test(info) && e[A.A2].etat === 'aucune', `[8] ${T} écart (offres activées sans le montant) : dit en clair, aucun ✓, « aucune »`, info);
        await ouvrirPanneau(pg, A.A2); await saisir(pg, A.A2, 'accepte', '81'); await poser(pg, A.A2);
        info = await pg.$eval(`[data-ebay-info="${A.A2}"]`, (x) => x.innerText).catch(() => ''); e = await etats(pg);
        dit(e[A.A2].etat === 'pas-su' && !/✓/.test(info), `[8] ${T} non relu : « pas su », aucun ✓`, `${e[A.A2].etat} · ${info}`);
        await ouvrirPanneau(pg, A.A2); await saisir(pg, A.A2, 'accepte', '81'); await poser(pg, A.A2);
        info = await pg.$eval(`[data-ebay-info="${A.A2}"]`, (x) => x.innerText).catch(() => ''); e = await etats(pg);
        dit(e[A.A2].etat === 'connue' && /VRM n'a pas pu le noter/.test(info), `[8] ${T} posée mais pas notée : « connue » ET la note « VRM n'a pas pu le noter »`, info);
        await ctx.close();
      });

      // ── 9. UNE RÈGLE POUR TOUTES ────────────────────────────────────────
      const ouvrirToutes = async (pg, pct) => {
        await pg.click('[data-regles-toutes-ouvrir]'); await pg.waitForSelector('[data-regles-toutes]', { timeout: 5000 });
        await pg.fill('[data-regles-pct]', String(pct)); await pg.waitForTimeout(300);
      };
      const lignesApercu = (pg) => pg.$$eval('[data-regles-ligne]', (l) => Object.fromEntries(l.map((e) => { const c = e.querySelector('[data-regles-choix]'); return [e.getAttribute('data-regles-ligne'), { s: e.getAttribute('data-regles-statut'), seuil: e.getAttribute('data-regles-seuil'), coche: c ? c.checked : null, achat: !!e.querySelector('[data-regles-sous-achat]') }]; })));
      if (bloc(9)) await essaie(`[9] ${T} une règle pour toutes`, async () => {
        const L0 = (o) => ({ lu: true, devise: 'EUR', lueA: Date.now(), offresFaites: null, ...o });
        const { ctx, pg, errs } = await ouvrir(b, vp, { scen: {
          [A.A6]: [{ body: { ok: true, verifie: null, lecture: null, avertissements: [], range: true } }],
          [A.A7]: [{ status: 422, body: { ok: false, reason: 'refus', error: 'La catégorie de cette annonce n\'accepte pas les offres.' } }],
          [A.B1]: [{ body: { ok: true, verifie: false, lecture: L0({ offresActives: true, accepte: null, refuse: null, prix: 100 }), avertissements: [], range: true } }],
        } });
        await allerAnnonces(pg);
        await ouvrirToutes(pg, 45);
        dit(await pg.locator('[data-regles-pct-erreur]').count() === 1 && await pg.locator('[data-regles-apercu]').count() === 0 && await pg.locator('[data-regles-appliquer]:not([disabled])').count() === 0, `[9] ${T} 45 % : erreur, aucun aperçu, rien à appliquer`);
        await pg.fill('[data-regles-pct]', '90'); await pg.waitForTimeout(400);
        const l = await lignesApercu(pg);
        const att = { [A.A1]: ['inchange', '72.00', null], [A.A2]: ['nouvelle', '81.00', true], [A.A3]: ['a-relire', '', null], [A.A4]: ['a-relire', '', null], [A.A5]: ['exclue', null, null], [A.A6]: ['remplace', '90.00', false], [A.A7]: ['nouvelle', '45.00', false], [A.B1]: ['nouvelle', '90.00', true], [A.B2]: ['exclue', '', null], [A.B3]: ['a-relire', '', null] };
        const ecarts = Object.entries(att).filter(([id, [s, seuil, coche]]) => !l[id] || l[id].s !== s || (seuil != null && l[id].seuil !== seuil) || l[id].coche !== coche);
        dit(!ecarts.length && l[A.A2].achat && l[A.A6].achat, `[9] ${T} 90 % : chaque ligne a SON statut, SON seuil (au centime supérieur) et sa case (plus bas et sans paire reliée : décochées) ; sous le prix d'achat signalé`, ecarts.length ? JSON.stringify(ecarts.map(([id]) => [id, l[id]])) : '');
        dit(/Appliquer à 2 annonces/.test(await pg.$eval('[data-regles-appliquer]', (e) => e.innerText)), `[9] ${T} « Appliquer à 2 annonces »`);
        await pg.click(`[data-regles-ligne="${A.A6}"] [data-regles-choix]`); await pg.click(`[data-regles-ligne="${A.A7}"] [data-regles-choix]`); await pg.waitForTimeout(200);
        dit(/Appliquer à 4 annonces/.test(await pg.$eval('[data-regles-appliquer]', (e) => e.innerText)), `[9] ${T} A6 et A7 cochées : « Appliquer à 4 annonces »`);
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        const tf = await feuille(pg).innerText();
        dit(/1 remplace une règle existante \(dont 1 plus basse\)/.test(tf) && /2 sous ton prix d'achat/.test(tf) && /1 sans prix d'achat saisi/.test(tf) && /1 sans paire reliée/.test(tf) && /paire_perso/.test(tf) && /paire_pro/.test(tf), `[9] ${T} la feuille compte ce qui compte (remplace, plus basse, sous l'achat, sans prix d'achat, sans paire) et nomme les deux comptes`, tf.replace(/\s+/g, ' ').slice(0, 220));
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click(); await pg.waitForTimeout(400);
        dit(regleoffres().length === 0, `[9] ${T} Annuler n'envoie RIEN`);
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: 'Oui, régler les 4' }).click();
        await pg.waitForTimeout(120);
        const pendant = await desactive(pg, `[data-ebay-annonce="${A.A2}"] [data-regle-ouvrir]`);
        await pg.waitForSelector('[data-regles-bilan]', { timeout: 10000 }); await pg.waitForTimeout(600);
        dit(pendant === true, `[9] ${T} pendant le lot, les gestes de règle des cartes du lot sont grisés`);
        const r = regleoffres();
        const att2 = ['{"action":"regleoffre","itemId":"130000000002","accepte":81,"prixVu":90,"attendu":{"accepte":null,"refuse":null},"confirme":true}',
          '{"action":"regleoffre","itemId":"130000000006","accepte":90,"prixVu":100,"attendu":{"accepte":95,"refuse":null},"confirme":true}',
          '{"action":"regleoffre","itemId":"130000000007","accepte":45,"prixVu":50,"attendu":{"accepte":null,"refuse":null},"confirme":true}',
          '{"action":"regleoffre","itemId":"130000000101","accepte":90,"prixVu":100,"attendu":{"accepte":null,"refuse":null},"confirme":true,"compte":"bbbbbbbbbbbbbbb2"}'];
        dit(JSON.stringify(r) === JSON.stringify(att2) && maxEnVol === 1, `[9] ${T} 4 envois dans l'ordre de l'aperçu, sans refus ni « sous la moitié », chacun avec la règle vue et SON compte ; jamais deux en vol`, `maxEnVol=${maxEnVol} · ${r.length} envois`);
        const bil = await pg.$eval('[data-regles-bilan]', (e) => Object.fromEntries(['total', 'ok', 'ecart', 'non-relu', 'a-revoir', 'incertain', 'ko', 'non-envoyees'].map((k) => [k, Number(e.getAttribute('data-regles-' + k))])));
        const somme = bil.ok + bil.ecart + bil['non-relu'] + bil['a-revoir'] + bil.incertain + bil.ko + bil['non-envoyees'];
        dit(bil.total === 4 && bil.ok === 1 && bil['non-relu'] === 1 && bil.ko === 1 && bil.ecart === 1 && bil.incertain === 0 && bil['a-revoir'] === 0 && bil['non-envoyees'] === 0 && somme === bil.total, `[9] ${T} le bilan est COMPLET (1 réglée · 1 écart · 1 non relue · 1 refusée), sa somme vaut le total`, JSON.stringify(bil));
        const e = await etats(pg);
        dit(e[A.B1].etat !== 'connue' && e[A.A6].etat !== 'connue' && e[A.A2].etat === 'connue', `[9] ${T} ni B1 (écart) ni A6 (non relue) ne passent « connue » ; A2 oui`, JSON.stringify([e[A.A2].etat, e[A.A6].etat, e[A.B1].etat]));
        await pg.screenshot({ path: path.join(CAPTURES, `toutes-${vp.width}.png`), fullPage: true }).catch(() => {});
        await finPage(pg, errs, `[9] ${T}`);
        await ctx.close();
      });
      if (bloc(9)) await essaie(`[9] ${T} arrêter`, async () => {
        // le 1er envoi dure 2 s : « Arrêter » tombe PENDANT lui, à coup sûr.
        const { ctx, pg } = await ouvrir(b, vp, { regleDelai: 2000 });
        await allerAnnonces(pg); await ouvrirToutes(pg, 90);
        await pg.click(`[data-regles-ligne="${A.A6}"] [data-regles-choix]`); await pg.click(`[data-regles-ligne="${A.A7}"] [data-regles-choix]`); await pg.waitForTimeout(200);
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: 'Oui, régler les 4' }).click();
        await pg.waitForSelector('[data-regles-arreter]', { timeout: 3000 }); await pg.click('[data-regles-arreter]');
        await pg.waitForSelector('[data-regles-bilan]', { timeout: 8000 });
        const ne = await pg.$eval('[data-regles-bilan]', (e) => e.getAttribute('data-regles-non-envoyees'));
        dit(ne === '3' && regleoffres().length === 1, `[9] ${T} « Arrêter » pendant le 1er envoi : 3 non envoyées, dites`, `${ne} · ${regleoffres().length} envoi(s)`);
        await ctx.close();
      });
      if (bloc(9)) await essaie(`[9] ${T} vue d'un compte`, async () => {
        const { ctx, pg } = await ouvrir(b, vp);
        await allerAnnonces(pg); await pg.selectOption('#vrm-sel-compte-ebay', K2); await pg.waitForTimeout(900);
        await ouvrirToutes(pg, 90);
        const ids = Object.keys(await lignesApercu(pg)).sort();
        dit(JSON.stringify(ids) === JSON.stringify([A.B1, A.B2, A.B3]) && /Appliquer à 1 annonce\b/.test(await pg.$eval('[data-regles-appliquer]', (e) => e.innerText)), `[9] ${T} vue du second compte : l'aperçu ne porte QUE sur ses annonces (B1, B2, B3), « Appliquer à 1 annonce »`, JSON.stringify(ids));
        await ctx.close();
      });
      if (bloc(9)) await essaie(`[9] ${T} démontage`, async () => {
        // chaque envoi dure 1,5 s : on quitte l'écran PENDANT le 2ᵉ, à coup sûr.
        const { ctx, pg } = await ouvrir(b, vp, { regleDelai: 1500 });
        await allerAnnonces(pg); await ouvrirToutes(pg, 90);
        await pg.click(`[data-regles-ligne="${A.A6}"] [data-regles-choix]`); await pg.click(`[data-regles-ligne="${A.A7}"] [data-regles-choix]`); await pg.waitForTimeout(200);
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: 'Oui, régler les 4' }).click();
        for (let i = 0; i < 100 && regleoffres().length < 2; i++) await pg.waitForTimeout(50);
        await sousOnglet(pg, 'Ventes');
        const n = regleoffres().length; await pg.waitForTimeout(1500);
        dit(n === 2 && regleoffres().length === 2, `[9] ${T} changer de sous-onglet pendant le 2ᵉ envoi : plus AUCUN envoi après`, `${n} → ${regleoffres().length}`);
        await sousOnglet(pg, 'Annonces'); await pg.waitForSelector('[data-ebay-annonce]', { timeout: 8000 }); await pg.waitForTimeout(600);
        const li = await pg.$eval('[data-regles-lot-interrompu]', (e) => e.getAttribute('data-regles-lot-interrompu')).catch(() => null);
        dit(li === '2', `[9] ${T} au retour : « le dernier lot a été interrompu : 2 annonces non envoyées »`, String(li));
        await ctx.close();
      });
      if (bloc(9)) await essaie(`[9] ${T} porte pendant la lecture`, async () => {
        // Les règles mettent 4 s à arriver : pendant ce temps, la porte est grisée
        // OU pas encore là (l'écran attend la lecture) — jamais ouverte.
        const { ctx, pg } = await ouvrir(b, vp, { offresDelai: 4000 });
        await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' }); await pg.waitForSelector('#vrm-sel-compte-ebay', { timeout: 15000 }); await sousOnglet(pg, 'Annonces');
        const n1 = await pg.locator('[data-regles-toutes-ouvrir]').count(); const d1 = n1 ? await desactive(pg, '[data-regles-toutes-ouvrir]') : 'absente';
        await pg.waitForSelector('[data-regles-toutes-ouvrir]:not([disabled])', { timeout: 10000 }).catch(() => {}); const d2 = await desactive(pg, '[data-regles-toutes-ouvrir]');
        dit((d1 === true || d1 === 'absente') && d2 === false, `[9] ${T} « Une règle pour toutes » n'est pas ouvrable tant que les règles ne sont pas lues`, `${d1} → ${d2}`);
        await ctx.close();
      });

      // ── 10. BLOQUÉE ─────────────────────────────────────────────────────
      if (bloc(10)) await essaie(`[10] ${T} bloquée`, async () => {
        const { ctx, pg } = await ouvrir(b, vp);
        await allerAnnonces(pg);
        const e = await etats(pg);
        dit(e[A.A5].bloquee === 'vendue' && await desactive(pg, `[data-regle-modifier="${A.A5}"]`) === true && await desactive(pg, `[data-regle-retirer-direct="${A.A5}"]`) === false, `[10] ${T} A5 (vendue sur Vinted) : « Modifier » grisé (présent), « Retirer la règle » actif`, JSON.stringify(e[A.A5]));
        dit(await pg.locator('[data-ebay-a-retirer] [data-ebay-doublon-regle]').count() === 1, `[10] ${T} l'alerte « vendue sur Vinted — encore en vente sur eBay » dit qu'elle a une règle d'offre`);
        await ctx.close();
      });
      if (bloc(10)) await essaie(`[10] ${T} deux comptes`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { annonces: (p, k2) => { k2.push(ann('130000000142', 'Adidas Samba blanc taille 42', '92.0', 'VRM-42')); } });
        await allerAnnonces(pg);
        const e = await etats(pg);
        await ouvrirToutes(pg, 90); const l = await lignesApercu(pg);
        dit(e[A.A2].bloquee === 'deux-comptes' && l[A.A2] && l[A.A2].s === 'exclue', `[10] ${T} la même paire sur deux comptes : bloquée, et exclue du geste groupé`, JSON.stringify([e[A.A2].bloquee, l[A.A2]]));
        await ctx.close();
      });
      if (bloc(10)) await essaie(`[10] ${T} ventes illisibles`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { txn500: true });
        await allerAnnonces(pg);
        const commun = await pg.locator('[data-regles-bloquees-commun]').count();
        const actifs = await pg.$$eval('[data-ebay-annonce]', (l) => l.map((c) => [c.getAttribute('data-ebay-annonce'), [...c.querySelectorAll('[data-regle-ouvrir],[data-regle-modifier]')].some((b) => !b.disabled)]));
        const m = Object.fromEntries(actifs);
        const relieesActives = [A.A1, A.A2, A.A4, A.A5, A.A6, A.B1, A.B2, A.B3].filter((id) => m[id]);
        dit(commun === 1 && !relieesActives.length && m[A.A3] && m[A.A7], `[10] ${T} ventes Vinted illisibles : dit UNE fois, aucune carte reliée ne propose de règle ; A3 et A7 (non reliées) restent actives`, `commun=${commun} · actives reliées ${JSON.stringify(relieesActives)}`);
        await ctx.close();
      });

      // ── 11. LE PRIX (✏️) ────────────────────────────────────────────────
      if (bloc(11)) await essaie(`[11] ${T} prix`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { scen: {
          ['revise:' + A.A1]: [
            { body: { ok: true, ack: 'Success', regle: { lecture: { lu: true, offresActives: true, accepte: 72, refuse: 60, devise: 'EUR', prix: 85, offresFaites: 2, lueA: Date.now() }, tombee: false, avant: { accepte: 72, refuse: 60 } } } },
          ] } });
        await allerAnnonces(pg);
        const ouvrirEdit = async () => { await pg.click(`[data-ebay-carte-ouvrir="${A.A1}"]`); await pg.waitForSelector(`[data-ebay-revise-ouvrir="${A.A1}"]`, { timeout: 5000 }); await pg.click(`[data-ebay-revise-ouvrir="${A.A1}"]`); await pg.waitForSelector(`[data-ebay-revise-prix="${A.A1}"]`, { timeout: 5000 }); };
        await ouvrirEdit();
        await pg.fill(`[data-ebay-revise-prix="${A.A1}"]`, '72'); await pg.click(`[data-ebay-revise-enregistrer="${A.A1}"]`); await pg.waitForTimeout(500);
        const msg1 = await pg.$eval(`[data-ebay-revise-msg="${A.A1}"]`, (e) => e.innerText).catch(() => '');
        dit(!bruts.some((x) => /"action":"revise"/.test(x)) && /règle d'offre accepte dès 72,00/.test(msg1), `[11] ${T} un prix à ou sous la règle (72 €) : rien n'est envoyé, et c'est dit`, msg1);
        await pg.fill(`[data-ebay-revise-prix="${A.A1}"]`, '85'); await pg.waitForTimeout(200);
        const rap = await pg.$eval(`[data-regle-rappel="${A.A1}"]`, (e) => e.innerText).catch(() => '');
        dit(/85 %/.test(rap), `[11] ${T} le rappel dit le pourcentage du NOUVEAU prix (72 / 85 = 85 %)`, rap);
        await pg.click(`[data-ebay-revise-enregistrer="${A.A1}"]`); await pg.waitForTimeout(1200);
        const rv = bruts.filter((x) => /"action":"revise"/.test(x));
        const msg2 = await pg.$eval(`[data-ebay-revise-msg="${A.A1}"]`, (e) => e.innerText).catch(() => '');
        const c2 = await couleur(pg, `[data-ebay-revise-msg="${A.A1}"]`);
        dit(/"price":"85"/.test(rv[0] || '') && /^✓/.test(msg2) && /72,00\s*€/.test(msg2) && c2 === C_TEXT, `[11] ${T} la règle a tenu : « ✓ … reste à 72,00 € », en couleur de texte`, `${rv[0]} · ${msg2}`);
        await ctx.close();
      });
      if (bloc(11)) await essaie(`[11] ${T} règle tombée, stock seul, 23004`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { scen: {
          ['revise:' + A.A1]: [
            { body: { ok: true, ack: 'Success', regle: { lecture: { lu: true, offresActives: true, accepte: null, refuse: null, devise: 'EUR', prix: 85, offresFaites: 2, lueA: Date.now() }, tombee: true, avant: { accepte: 72, refuse: 60 } } } },
            { body: { ok: true, ack: 'Success' } },
            { status: 422, body: { ok: false, error: 'Invalid AutoAccept price.', erreurs: [{ code: '23004', severite: 'Error', message: 'Invalid AutoAccept price.' }] } },
          ] } });
        await allerAnnonces(pg);
        const ouvrirEdit = async () => { if (!await pg.locator(`[data-ebay-revise-ouvrir="${A.A1}"]`).count()) await pg.click(`[data-ebay-carte-ouvrir="${A.A1}"]`); await pg.waitForSelector(`[data-ebay-revise-ouvrir="${A.A1}"]`, { timeout: 5000 }); await pg.click(`[data-ebay-revise-ouvrir="${A.A1}"]`); await pg.waitForSelector(`[data-ebay-revise-prix="${A.A1}"]`, { timeout: 5000 }); };
        await ouvrirEdit();
        await pg.fill(`[data-ebay-revise-prix="${A.A1}"]`, '85'); await pg.click(`[data-ebay-revise-enregistrer="${A.A1}"]`); await pg.waitForTimeout(700);
        const msg = await pg.$eval(`[data-ebay-revise-msg="${A.A1}"]`, (e) => e.innerText).catch(() => '');
        const e = await etats(pg);
        dit(!/^✓/.test(msg) && await couleur(pg, `[data-ebay-revise-msg="${A.A1}"]`) === C_WARN && e[A.A1].etat === 'aucune', `[11] ${T} règle tombée : message ambre, sans ✓, la carte passe « aucune »`, `${msg} · ${e[A.A1].etat}`);
        await pg.waitForTimeout(1500);
        await ouvrirEdit();
        await pg.fill(`[data-ebay-revise-stock="${A.A1}"]`, '2'); await pg.click(`[data-ebay-revise-enregistrer="${A.A1}"]`); await pg.waitForTimeout(900);
        const rv = bruts.filter((x) => /"action":"revise"/.test(x));
        dit(rv[1] && !/"price"/.test(rv[1]), `[11] ${T} le stock seul : le corps n'a PAS de prix`, rv[1]);
        await pg.waitForTimeout(1500);
        await ouvrirEdit();
        await pg.fill(`[data-ebay-revise-prix="${A.A1}"]`, '83'); await pg.click(`[data-ebay-revise-enregistrer="${A.A1}"]`); await pg.waitForTimeout(900);
        const m3 = await pg.$eval(`[data-ebay-revise-msg="${A.A1}"]`, (x) => x.innerText).catch(() => '');
        dit(/doit rester au-dessus de ta règle d'offre/.test(m3) && !/Invalid AutoAccept/.test(m3), `[11] ${T} refus 23004 : traduit, pas le message anglais d'eBay`, m3);
        await ctx.close();
      });

      // ── 12. OFFRE AUX OBSERVATEURS ──────────────────────────────────────
      if (bloc(12)) await essaie(`[12] ${T} offre sous la règle`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { eligibles: [A.A1] });
        await allerAnnonces(pg);
        await pg.click(`[data-offre-ouvrir="${A.A1}"]`); await pg.waitForSelector(`[data-offre-remise="${A.A1}"]`, { timeout: 5000 });
        await pg.fill(`[data-offre-remise="${A.A1}"]`, '30'); await pg.waitForTimeout(200);
        const s30 = await pg.locator(`[data-offre-sous-regle="${A.A1}"]`).count();
        await pg.fill(`[data-offre-remise="${A.A1}"]`, '5'); await pg.waitForTimeout(200);
        const s5 = await pg.locator(`[data-offre-sous-regle="${A.A1}"]`).count();
        dit(s30 === 1 && s5 === 0, `[12] ${T} une offre ENVOYÉE sous la règle (56 € < 72 €) est signalée ; à 76 €, non`, `${s30} / ${s5}`);
        await ctx.close();
      });

      // ── 13. PANNE DE LA LECTURE DES RÈGLES ─────────────────────────────
      if (bloc(13)) await essaie(`[13] ${T} panne`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, { offres500: true });
        await allerAnnonces(pg);
        const e = await etats(pg);
        const tous = Object.values(e);
        dit(tous.length === 10 && tous.every((x) => x.etat === 'pas-su' && x.raison === 'illisible' && !/€/.test(x.txt) && !/aucune/i.test(x.txt)), `[13] ${T} lecture des règles en panne : TOUTES « pas su » (illisible), aucun montant, jamais « aucune »`, JSON.stringify(tous.map((x) => x.etat + '/' + x.raison)));
        dit(await pg.locator('[data-regles-engagement]').count() === 0 && await pg.locator('[data-regles-pas-su]').count() === 1, `[13] ${T} pas de bloc d'engagement ; la ligne « pas su » UNE fois`);
        await pg.click('[data-regles-relire]'); await pg.waitForTimeout(800);
        dit(!bruts.some((x) => /regleoffrelire/.test(x)), `[13] ${T} « Relire chez eBay » n'envoie RIEN (c'est notre lecture qui a raté : rouvrir l'écran)`);
        await finPage(pg, errs, `[13] ${T}`);
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc', String((e && e.message) || e).split('\n')[0]); }
  finally { if (b) await b.close().catch(() => {}); srv.close(); }
  console.log(`\n${ko ? 'KO' : 'OK'}  ebay-regle-offre : ${nControles} contrôles, ${ko} rouge(s) — captures dans ${CAPTURES}`);
  process.exit(ko ? 1 : 0);
})();
