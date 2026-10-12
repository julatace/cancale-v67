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
//   14. (11 octobre, revue) le lot ne se ferme pas en silence (porte grisée
//      pendant le lot ; si le panneau disparaît quand même, la réponse en vol
//      s'applique, les cartes sont rendues, l'arrêt est dit) ; une issue ne
//      reste que sous le montant envoyé ; l'aperçu calcule sur le prix que la
//      carte affiche ; « dont N lues il y a plus de 7 jours » = les cartes qui
//      le disent ;
//   15. (11 octobre, revue — tour 2) ✏️ part du prix que la CARTE affiche et
//      « stock seul » n'envoie aucun prix ; « seuil relu, offres activées ou
//      non pas montré » se dit d'UNE voix (ni « pas encore lue », ni « relis-la
//      d'abord », et reposer le seuil porte la règle lue) ; un lot dit « à
//      revoir » sur la ligne concernée ; une relecture ratée ne remplace pas ce
//      que VRM savait ;
//   et partout : aucun débordement, aucune erreur de page, aucun écran mort.
//        node scripts/bancs/ebay-regle-offre.cjs [--blocs 1,5,9] [--taille 1512]
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.PORT) || 4761;
const RETARD_TXN = Number(process.env.BANC_TXN_DELAI) || 0;
// `BANC_EBAY_DELAI=1500` : un faux eBay LENT à répondre une règle (machine chargée) — le banc
// attend la réponse appliquée, jamais un délai fixe.
const DELAI_EBAY = Number(process.env.BANC_EBAY_DELAI) || 0;
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

let rows = [], cfg = {}, ebay = {}, envois = [], bruts = [], scen = {}, enVol = 0, maxEnVol = 0, ecrituresMain = 0, apiEbay = 0, repondus = 0;
// `cfg.retenir = n` : la n-ième requête `regleoffre` est RETENUE jusqu'à `lacher()`
// — un geste « pendant l'envoi » se joue alors à coup sûr, pas sur une course
// d'horloge (une machine chargée faisait tomber « Arrêter » APRÈS le 1er envoi).
let lacher = () => {};
// L'état d'eBay (le faux) : ce qu'eBay TIENT, par annonce — prix et règle.
const preparer = (c) => {
  cfg = c || {};
  const offresP = OFFRES_P(), offresK2 = OFFRES_K2();
  if (cfg.offresP) cfg.offresP(offresP);
  if (cfg.offresK2) cfg.offresK2(offresK2);
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
  // (tour 3) Une ligne de plus, ou une ligne changée (brouillons, programmées).
  if (cfg.rows) cfg.rows(rows);
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
    // `BANC_TXN_DELAI=7000` : une base LENTE sur les ventes Vinted (machine
    // chargée) — le banc doit rester vert sur une app intacte (il attend le
    // verdict rendu, jamais un délai fixe).
    if (RETARD_TXN && /_txn_/.test(u)) await attendre(RETARD_TXN);
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
      // (tour 3) Ce que la synchro range de plus (une annonce partie, sa règle).
      if (cfg.apresSync) cfg.apresSync(compteDe(body));
      return j({ ok: true });
    }
    if (body.action === 'regleoffrelire') {
      const lectures = {};
      for (const id of body.itemIds || []) {
        const s = ebay[id];
        if (!s || s.compte !== compteDe(body)) { lectures[id] = { lu: false, raison: 'pas-sur-ce-compte' }; continue; }
        // `relireRate` : eBay ne rend pas CETTE annonce. La route ne range une
        // lecture ratée que sur une place vide (11 octobre, revue) : ici, rien.
        if (Array.isArray(cfg.relireRate) && cfg.relireRate.includes(id)) { lectures[id] = { lu: false, raison: 'lecture-ratee', lueA: Date.now(), par: 'relire' }; continue; }
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
        const rang = bruts.filter((x) => /"action":"regleoffre"/.test(x)).length;
        if (cfg.retenir === rang) await new Promise((ok) => { lacher = ok; setTimeout(ok, 20000); });
        else await attendre(cfg.regleDelai || DELAI_EBAY || 250);
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
      } finally { enVol--; repondus++; }
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
  // (11 octobre) Le VERDICT des ventes, rendu — jamais un délai : tant que les
  // ventes ne sont pas vérifiées, l'app grise « Définir / Modifier » (à raison).
  // Une attente fixe de 1,2 s faisait cliquer un bouton encore grisé quand la
  // lecture des ventes était lente (machine chargée) : rouge sur une app intacte.
  await pg.waitForFunction(() => !!document.querySelector('[data-regle-offre-ligne]') && !document.querySelector('[data-regle-bloquee="en-cours"]'), null, { timeout: 30000 });
  await pg.waitForTimeout(300);
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
  await b.click({ timeout: 15000 });
  await pg.waitForSelector(`[data-regle-panneau="${id}"]`, { timeout: 5000 });
}
const saisir = async (pg, id, quoi, v) => { await pg.fill(`[data-regle-saisie-${quoi}="${id}"]`, v); await pg.waitForTimeout(150); };
const desactive = (pg, sel) => pg.$eval(sel, (e) => e.disabled).catch(() => null);
// (11 octobre) Attend que la réponse d'un geste de règle soit APPLIQUÉE à la
// carte : le faux eBay a RÉPONDU, puis la carte n'est plus « en envoi »
// (`data-regle-envoi`). Jamais un délai fixe : sous charge, le message
// était lu avant d'arriver (rouge sur une app intacte).
async function finEnvoi(pg, id, r0) {
  for (let i = 0; i < 600 && repondus <= r0; i++) await pg.waitForTimeout(25);
  await pg.waitForFunction((x) => { const c = document.querySelector(`[data-ebay-annonce="${x}"]`); return !!c && !c.querySelector('[data-regle-envoi]'); }, id, { timeout: 20000 });
  await pg.waitForTimeout(80);
}
async function poser(pg, id) {
  const n0 = repondus;
  await pg.click(`[data-regle-enregistrer="${id}"]`);
  await feuille(pg).waitFor({ timeout: 5000 });
  const t = await feuille(pg).innerText();
  await feuille(pg).getByRole('button', { name: 'Oui, poser la règle' }).click();
  await finEnvoi(pg, id, n0);
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
        // L'écran défile DANS l'app : la page entière s'arrête au premier écran.
        // Les cartes se photographient une par une (§6.2 : on regarde le rendu).
        for (const k of ['A1', 'A3', 'A4', 'A5']) await carte(pg, A[k]).screenshot({ path: path.join(CAPTURES, `carte-${k}-${vp.width}.png`) }).catch(() => {});
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
        // (tour 3) A4 (prix changé, sa règle rangée était active) est une règle
        // qu'eBay tient PEUT-ÊTRE : elle compte. Sans aucune des deux ⇒ aucun bloc.
        { const { ctx, pg } = await ouvrir(b, vp, { offresP: (o) => { delete o[A.A1]; delete o[A.A4]; delete o[A.A5]; delete o[A.A6]; } }); await allerAnnonces(pg);
          dit(await pg.locator('[data-regles-engagement]').count() === 0, `[2] ${T} aucune règle connue, aucune peut-être ⇒ aucun bloc d'engagement`); await ctx.close(); }
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
        // (tour 4, défaut #3) la synchro refusée ne doit PLUS échouer en silence :
        // un message apparaît (comme « Relire chez eBay »).
        const txtEchec = await pg.locator('[data-regles-ventes-echec]').textContent().catch(() => '') || '';
        dit(await pg.locator('[data-regles-ventes-echec]').count() === 1 && /n'a pas répondu/.test(txtEchec), `[3] ${T} la synchro refusée le DIT (plus de silence)`, txtEchec.slice(0, 80));
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
        await pg.locator(`[data-regle-panneau="${A.A2}"]`).screenshot({ path: path.join(CAPTURES, `panneau-A2-${vp.width}.png`) }).catch(() => {});
        await pg.click(`[data-regle-enregistrer="${A.A2}"]`); await feuille(pg).waitFor({ timeout: 5000 });
        const tf = await feuille(pg).innerText();
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click(); await pg.waitForTimeout(500);
        dit(/81,00\s*€/.test(tf) && regleoffres().length === 0, `[5] ${T} la feuille dit le montant (81,00 €) ; Annuler n'envoie RIEN`, `envois=${regleoffres().length}`);
        await pg.click(`[data-regle-enregistrer="${A.A2}"]`); await feuille(pg).waitFor({ timeout: 5000 });
        // Double clic à la souris (1512 px). Au téléphone, la feuille de confirmation
        // (commune à toute l'app) est en bas : le 2ᵉ toucher passe à la barre
        // d'onglets dessous — constaté, hors de cette règle ; on touche une fois.
        { const r0 = repondus; const oui = feuille(pg).getByRole('button', { name: 'Oui, poser la règle' }); await (vp.width < 600 ? oui.click() : oui.dblclick()).catch(() => {}); await finEnvoi(pg, A.A2, r0); }
        await pg.waitForTimeout(600);
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
        { const n0 = repondus; await pg.click(`[data-regle-retirer="${A.A1}"]`); await finEnvoi(pg, A.A1, n0); }
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
      if (bloc(8)) await essaie(`[8] ${T} relu, offres activées ou non pas montré`, async () => {
        // (11 octobre) La route a RELU : le montant est le bon, eBay ne montre pas
        // `BestOfferEnabled` (`verifie:null` AVEC une lecture). La phrase vient de
        // la lecture : jamais « je n'ai pas pu le relire » (§5).
        const L0 = (o) => ({ lu: true, devise: 'EUR', lueA: Date.now(), offresFaites: null, ...o });
        const { ctx, pg } = await ouvrir(b, vp, { scen: { [A.A2]: [{ body: { ok: true, verifie: null, lecture: L0({ offresActives: null, accepte: 81, refuse: null, prix: 90 }), avertissements: [], range: true } }] } });
        await allerAnnonces(pg);
        await ouvrirPanneau(pg, A.A2); await saisir(pg, A.A2, 'accepte', '81'); await poser(pg, A.A2);
        const info = await pg.$eval(`[data-ebay-info="${A.A2}"]`, (x) => x.innerText).catch(() => '');
        const lien = await pg.locator(`[data-ebay-info="${A.A2}"] a[href*="ebay.fr/itm/${A.A2}"]`).count();
        const e = await etats(pg);
        await carte(pg, A.A2).screenshot({ path: path.join(CAPTURES, `carte-offres-inconnues-${vp.width}.png`) }).catch(() => {});
        dit(/81,00\s*€/.test(info) && !/pas pu le relire/.test(info) && !/✓/.test(info) && lien === 1 && e[A.A2].etat === 'pas-su' && e[A.A2].raison === 'offres-inconnues',
          `[8] ${T} relu avec le bon montant, offres pas montrées : le message dit le seuil RELU (81,00 €) et « regarde sur eBay » (lien), jamais « pas pu le relire », aucun ✓ ; la carte « pas su » (offres inconnues)`, `${info} · ${e[A.A2].etat}/${e[A.A2].raison}`);
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
        // Le 1er envoi est RETENU : « pendant le lot » se juge à coup sûr.
        const { ctx, pg, errs } = await ouvrir(b, vp, { retenir: 1, scen: {
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
        await pg.waitForSelector('[data-regles-progres="1/4"]', { timeout: 5000 }).catch(() => {});
        const pendant = await desactive(pg, `[data-ebay-annonce="${A.A2}"] [data-regle-ouvrir]`);
        await pg.locator('[data-regles-toutes]').screenshot({ path: path.join(CAPTURES, `lot-en-cours-${vp.width}.png`) }).catch(() => {});
        lacher();
        await pg.waitForSelector('[data-regles-bilan]', { timeout: 10000 }); await pg.waitForTimeout(600);
        dit(pendant === true, `[9] ${T} pendant le lot, les gestes de règle des cartes du lot sont grisés`);
        const r = regleoffres();
        const att2 = ['{"action":"regleoffre","itemId":"130000000002","accepte":81,"prixVu":90,"attendu":{"accepte":null,"refuse":null},"confirme":true}',
          '{"action":"regleoffre","itemId":"130000000006","accepte":90,"prixVu":100,"attendu":{"accepte":95,"refuse":null},"confirme":true}',
          '{"action":"regleoffre","itemId":"130000000007","accepte":45,"prixVu":50,"attendu":{"accepte":null,"refuse":null},"confirme":true}',
          '{"action":"regleoffre","itemId":"130000000101","accepte":90,"prixVu":100,"attendu":{"accepte":null,"refuse":null},"confirme":true,"compte":"bbbbbbbbbbbbbbb2"}'];
        dit(JSON.stringify(r) === JSON.stringify(att2) && maxEnVol === 1, `[9] ${T} 4 envois dans l'ordre de l'aperçu, sans refus ni « sous la moitié », chacun avec la règle vue et SON compte ; jamais deux en vol`, `maxEnVol=${maxEnVol} · ${r.length} envois`);
        const bil = await pg.$eval('[data-regles-bilan]', (e) => Object.fromEntries(['total', 'ok', 'ecart', 'offres-inconnues', 'non-relu', 'a-revoir', 'incertain', 'ko', 'non-envoyees'].map((k) => [k, Number(e.getAttribute('data-regles-' + k) || 0)])));
        const somme = bil.ok + bil.ecart + bil['offres-inconnues'] + bil['non-relu'] + bil['a-revoir'] + bil.incertain + bil.ko + bil['non-envoyees'];
        dit(bil.total === 4 && bil.ok === 1 && bil['non-relu'] === 1 && bil.ko === 1 && bil.ecart === 1 && bil['offres-inconnues'] === 0 && bil.incertain === 0 && bil['a-revoir'] === 0 && bil['non-envoyees'] === 0 && somme === bil.total, `[9] ${T} le bilan est COMPLET (1 réglée · 1 écart · 1 non relue · 1 refusée), sa somme vaut le total`, JSON.stringify(bil));
        const e = await etats(pg);
        dit(e[A.B1].etat !== 'connue' && e[A.A6].etat !== 'connue' && e[A.A2].etat === 'connue', `[9] ${T} ni B1 (écart) ni A6 (non relue) ne passent « connue » ; A2 oui`, JSON.stringify([e[A.A2].etat, e[A.A6].etat, e[A.B1].etat]));
        await pg.locator('[data-regles-toutes]').screenshot({ path: path.join(CAPTURES, `toutes-${vp.width}.png`) }).catch(() => {});
        await finPage(pg, errs, `[9] ${T}`);
        await ctx.close();
      });
      if (bloc(9)) await essaie(`[9] ${T} arrêter`, async () => {
        // le 1er envoi est RETENU par le faux eBay : « Arrêter » tombe PENDANT lui.
        const { ctx, pg } = await ouvrir(b, vp, { retenir: 1 });
        await allerAnnonces(pg); await ouvrirToutes(pg, 90);
        await pg.click(`[data-regles-ligne="${A.A6}"] [data-regles-choix]`); await pg.click(`[data-regles-ligne="${A.A7}"] [data-regles-choix]`); await pg.waitForTimeout(200);
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: 'Oui, régler les 4' }).click();
        await pg.waitForSelector('[data-regles-arreter]', { timeout: 3000 });
        const prog = await pg.$eval('[data-regles-progres]', (e) => e.getAttribute('data-regles-progres')).catch(() => '');
        await pg.click('[data-regles-arreter]'); lacher();
        await pg.waitForSelector('[data-regles-bilan]', { timeout: 8000 });
        const ne = await pg.$eval('[data-regles-bilan]', (e) => e.getAttribute('data-regles-non-envoyees'));
        dit(prog === '1/4' && ne === '3' && regleoffres().length === 1, `[9] ${T} « Arrêter » pendant le 1er envoi : 3 non envoyées, dites`, `progrès ${prog} · ${ne} · ${regleoffres().length} envoi(s)`);
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
        // le 2ᵉ envoi est RETENU par le faux eBay : on quitte l'écran PENDANT lui.
        const { ctx, pg } = await ouvrir(b, vp, { retenir: 2 });
        await allerAnnonces(pg); await ouvrirToutes(pg, 90);
        await pg.click(`[data-regles-ligne="${A.A6}"] [data-regles-choix]`); await pg.click(`[data-regles-ligne="${A.A7}"] [data-regles-choix]`); await pg.waitForTimeout(200);
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: 'Oui, régler les 4' }).click();
        for (let i = 0; i < 100 && regleoffres().length < 2; i++) await pg.waitForTimeout(50);
        await sousOnglet(pg, 'Ventes');
        const n = regleoffres().length; lacher(); await pg.waitForTimeout(1500);
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

      if (bloc(11)) await essaie(`[11] ${T} règle tombée, eBay garde le refus (défaut #5)`, async () => {
        // (tour 4, défaut #5) L'annonce n'avait QU'un refus (pas de montant
        // d'acceptation). Après le changement de prix, eBay le garde. La phrase
        // ne doit JAMAIS dire « dès 0,00 € », et doit dire que le refus reste.
        const { ctx, pg } = await ouvrir(b, vp, { scen: {
          ['revise:' + A.A1]: [
            { body: { ok: true, ack: 'Success', regle: { lecture: { lu: true, offresActives: true, accepte: null, refuse: 50, devise: 'EUR', prix: 95, offresFaites: 0, lueA: Date.now() }, tombee: true, avant: { accepte: null, refuse: 50 } } } },
          ] } });
        await allerAnnonces(pg);
        await pg.click(`[data-ebay-carte-ouvrir="${A.A1}"]`); await pg.waitForSelector(`[data-ebay-revise-ouvrir="${A.A1}"]`, { timeout: 5000 }); await pg.click(`[data-ebay-revise-ouvrir="${A.A1}"]`); await pg.waitForSelector(`[data-ebay-revise-prix="${A.A1}"]`, { timeout: 5000 });
        await pg.fill(`[data-ebay-revise-prix="${A.A1}"]`, '95'); await pg.click(`[data-ebay-revise-enregistrer="${A.A1}"]`); await pg.waitForTimeout(800);
        const msg = await pg.$eval(`[data-ebay-revise-msg="${A.A1}"]`, (e) => e.innerText).catch(() => '');
        dit(!/dès 0,00/.test(msg) && /refus/i.test(msg) && /50,00/.test(msg), `[11] ${T} jamais « dès 0,00 € », et le refus gardé par eBay (50 €) est dit`, msg);
        await ctx.close();
      });
      if (bloc(11)) await essaie(`[11] ${T} seuil gardé mais refus sauté (défaut #5)`, async () => {
        // (tour 4, défaut #5) eBay garde le seuil d'acceptation mais fait sauter
        // le refus : pas un « ✓ … reste à 70 € » en couleur de texte — on le DIT,
        // en ambre.
        const { ctx, pg } = await ouvrir(b, vp, { scen: {
          ['revise:' + A.A1]: [
            { body: { ok: true, ack: 'Success', regle: { lecture: { lu: true, offresActives: true, accepte: 70, refuse: null, devise: 'EUR', prix: 95, offresFaites: 0, lueA: Date.now() }, tombee: false, avant: { accepte: 70, refuse: 50 } } } },
          ] } });
        await allerAnnonces(pg);
        await pg.click(`[data-ebay-carte-ouvrir="${A.A1}"]`); await pg.waitForSelector(`[data-ebay-revise-ouvrir="${A.A1}"]`, { timeout: 5000 }); await pg.click(`[data-ebay-revise-ouvrir="${A.A1}"]`); await pg.waitForSelector(`[data-ebay-revise-prix="${A.A1}"]`, { timeout: 5000 });
        await pg.fill(`[data-ebay-revise-prix="${A.A1}"]`, '95'); await pg.click(`[data-ebay-revise-enregistrer="${A.A1}"]`); await pg.waitForTimeout(800);
        const msg = await pg.$eval(`[data-ebay-revise-msg="${A.A1}"]`, (e) => e.innerText).catch(() => '');
        const c = await couleur(pg, `[data-ebay-revise-msg="${A.A1}"]`);
        dit(!/^✓/.test(msg) && /refus/i.test(msg) && /50,00/.test(msg) && c === C_WARN, `[11] ${T} seuil gardé, refus sauté : message ambre, sans ✓, le refus perdu est dit`, `${msg} · ${c}`);
        await ctx.close();
      });
      if (bloc(11)) await essaie(`[11] ${T} prix illisible`, async () => {
        // (11 octobre) Une saisie non vide qu'on ne sait pas lire n'est PAS « prix
        // inchangé » : rien ne part, et c'est dit — jamais « ✓ Modifié sur eBay ».
        const { ctx, pg } = await ouvrir(b, vp);
        await allerAnnonces(pg);
        await pg.click(`[data-ebay-carte-ouvrir="${A.A2}"]`); await pg.waitForSelector(`[data-ebay-revise-ouvrir="${A.A2}"]`, { timeout: 5000 });
        await pg.click(`[data-ebay-revise-ouvrir="${A.A2}"]`); await pg.waitForSelector(`[data-ebay-revise-prix="${A.A2}"]`, { timeout: 5000 });
        const vus = [];
        for (const tape of ['72 €', '0', 'abc']) {
          await pg.fill(`[data-ebay-revise-prix="${A.A2}"]`, tape); await pg.click(`[data-ebay-revise-enregistrer="${A.A2}"]`); await pg.waitForTimeout(400);
          vus.push([tape, await pg.$eval(`[data-ebay-revise-msg="${A.A2}"]`, (e) => e.innerText).catch(() => '')]);
        }
        const rv = bruts.filter((x) => /"action":"revise"/.test(x));
        dit(rv.length === 0 && vus.every(([, m]) => /rien n'a été envoyé/.test(m) && !/✓/.test(m)), `[11] ${T} un prix tapé illisible (« 72 € », « 0 », « abc ») : rien n'est envoyé, c'est dit, aucun ✓`, `${rv.length} envoi(s) · ${JSON.stringify(vus)}`);
        await pg.fill(`[data-ebay-revise-prix="${A.A2}"]`, '88'); await pg.click(`[data-ebay-revise-enregistrer="${A.A2}"]`); await pg.waitForTimeout(900);
        const rv2 = bruts.filter((x) => /"action":"revise"/.test(x));
        dit(rv2.length === 1 && /"price":"88"/.test(rv2[0]), `[11] ${T} et un prix lisible part, lui (« 88 »)`, rv2[0]);
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
        // (11 octobre, revue — tour 3) Notre propre lecture ratée : pas de
        // « Relire chez eBay » (il n'envoyait rien et répondait « rouvre
        // l'écran ») — « Réessayer » relit la base, jamais eBay.
        const nRelire = await pg.locator('[data-regles-relire]').count();
        const nBase = await pg.locator('[data-regles-relire-base]').count();
        const lect0 = apiEbay;
        if (nBase) { await pg.click('[data-regles-relire-base]'); await pg.waitForTimeout(800); }
        dit(nRelire === 0 && nBase === 1 && !bruts.some((x) => /regleoffrelire/.test(x)) && apiEbay === lect0, `[13] ${T} « Relire chez eBay » n'est PAS proposé ; « Réessayer » relit VRM — rien ne part chez eBay`, `relire ×${nRelire} · réessayer ×${nBase} · api ${apiEbay - lect0}`);
        await pg.click('[data-regles-toutes-ouvrir]'); await pg.waitForSelector('[data-regles-toutes]', { timeout: 5000 });
        await pg.fill('[data-regles-pct]', '90'); await pg.waitForTimeout(300);
        const lotRelire = await pg.locator('[data-regles-toutes-relire]').count();
        const lotIll = await pg.$eval('[data-regles-toutes-illisibles]', (x) => x.getAttribute('data-regles-toutes-illisibles')).catch(() => null);
        const nIll = await pg.locator('[data-regles-ligne][data-regles-statut="illisible"]').count();
        dit(lotRelire === 0 && nIll > 0 && lotIll === String(nIll), `[13] ${T} « Une règle pour toutes » ne propose pas « Relire ces annonces chez eBay » (un bouton qui ne faisait rien) : il dit que VRM n'a pas pu lire, sans rien remplacer`, `relire ×${lotRelire} · illisibles ${lotIll} (lignes ${nIll})`);
        await finPage(pg, errs, `[13] ${T}`);
        await ctx.close();
      });

      // ── 14. LE LOT, REVUE DU 11 OCTOBRE ────────────────────────────────
      const lancerLot4 = async (pg) => {
        await ouvrirToutes(pg, 90);
        await pg.click(`[data-regles-ligne="${A.A6}"] [data-regles-choix]`); await pg.click(`[data-regles-ligne="${A.A7}"] [data-regles-choix]`); await pg.waitForTimeout(200);
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: 'Oui, régler les 4' }).click();
        await pg.waitForSelector('[data-regles-arreter]', { timeout: 5000 });
      };
      const gesteActif = (pg, id) => pg.$eval(`[data-ebay-annonce="${id}"]`, (c) => { const x = c.querySelector('[data-regle-ouvrir],[data-regle-modifier]'); return x ? !x.disabled : null; }).catch(() => null);
      if (bloc(14)) await essaie(`[14] ${T} fermer pendant un lot`, async () => {
        // Le 1er envoi (A2) est RETENU : on tente de fermer le panneau PENDANT.
        const { ctx, pg, errs } = await ouvrir(b, vp, { retenir: 1 });
        await allerAnnonces(pg); await lancerLot4(pg);
        const grisee = await desactive(pg, '[data-regles-toutes-ouvrir]');
        await pg.screenshot({ path: path.join(CAPTURES, `lot-porte-${vp.width}.png`) }).catch(() => {});
        dit(grisee === true, `[14] ${T} pendant un lot, la porte « Fermer « Une règle pour toutes » » est grisée (on arrête par « Arrêter », qui fait un bilan)`, String(grisee));
        // Une app où elle ne l'est pas (build d'avant, ou porte réaffaiblie) : on
        // ferme pour de vrai, et on juge ce qui suit.
        if (grisee === false) { await pg.click('[data-regles-toutes-ouvrir]'); await pg.waitForTimeout(300); }
        lacher();
        await pg.waitForFunction(() => !!document.querySelector('[data-regles-bilan]') || !document.querySelector('[data-regles-toutes]'), null, { timeout: 15000 });
        for (let i = 0; i < 80 && (await Promise.all([A.A2, A.A6, A.A7, A.B1].map((id) => gesteActif(pg, id)))).some((x) => x === false); i++) await pg.waitForTimeout(50);
        const ferme = (await pg.locator('[data-regles-toutes]').count()) === 0;
        const n = regleoffres().length;
        const e = await etats(pg);
        const a2 = ebay[A.A2].regle;
        dit(!(e[A.A2] && e[A.A2].etat === 'aucune' && a2.accepte != null), `[14] ${T} la carte A2 ne dit jamais « aucune » quand eBay tient la règle que le lot vient d'y poser`, JSON.stringify({ ecran: e[A.A2] && e[A.A2].etat, ebay: a2.accepte }));
        const actifs = await Promise.all([A.A2, A.A6, A.A7, A.B1].map((id) => gesteActif(pg, id)));
        dit(actifs.every((x) => x === true), `[14] ${T} une fois le lot fini ou arrêté, ses cartes ne restent pas grisées`, JSON.stringify(actifs));
        const li = await pg.$eval('[data-regles-lot-interrompu]', (x) => x.getAttribute('data-regles-lot-interrompu')).catch(() => null);
        dit(!ferme || n === 4 || li === String(4 - n), `[14] ${T} un lot arrêté par la fermeture du panneau est DIT tout de suite (« N non envoyées »)`, `fermé=${ferme} · envois=${n} · bandeau=${li}`);
        await finPage(pg, errs, `[14] ${T}`);
        await ctx.close();
      });
      if (bloc(14)) await essaie(`[14] ${T} une issue suit son montant`, async () => {
        const { ctx, pg } = await ouvrir(b, vp);
        await allerAnnonces(pg); await ouvrirToutes(pg, 90);
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: /Oui, (la )?régler/ }).click();
        await pg.waitForSelector('[data-regles-bilan]', { timeout: 15000 }); await pg.waitForTimeout(400);
        const lire = () => pg.$$eval('[data-regles-ligne]', (x) => x.map((e) => [e.getAttribute('data-regles-ligne'), e.getAttribute('data-regles-statut'), e.getAttribute('data-regles-seuil'), (e.querySelector('[data-regles-issue]') || { getAttribute: () => '' }).getAttribute('data-regles-issue')]));
        await pg.fill('[data-regles-pct]', '80'); await pg.waitForTimeout(400);
        const l80 = await lire();
        const perimes = l80.filter((r) => r[3] && (r[1] === 'remplace' || r[1] === 'nouvelle'));
        dit(!perimes.length, `[14] ${T} après un lot à 90 %, passer à 80 % ne laisse aucune issue sous une ligne qui propose un AUTRE montant`, JSON.stringify(perimes));
        await pg.fill('[data-regles-pct]', '90'); await pg.waitForTimeout(400);
        const a2 = (await lire()).find((r) => r[0] === A.A2);
        dit(a2 && a2[1] === 'inchange' && a2[2] === '81.00' && a2[3] === 'ok', `[14] ${T} revenir à 90 % : A2 « déjà 81,00 € » et son « ✓ réglée » (le montant envoyé)`, JSON.stringify(a2));
        await ctx.close();
      });
      if (bloc(14)) await essaie(`[14] ${T} l'aperçu sur le prix relu`, async () => {
        // eBay tient A2 à 80 € ; la liste dit 90 €. La carte apprend 80 € (409).
        const { ctx, pg } = await ouvrir(b, vp, { ebay: (s) => { s[A.A2].prix = 80; } });
        await allerAnnonces(pg); await ouvrirPanneau(pg, A.A2);
        await saisir(pg, A.A2, 'accepte', '70'); await poser(pg, A.A2);
        const prixCarte = await carte(pg, A.A2).locator('[data-ebay-prix]').getAttribute('data-ebay-prix').catch(() => '');
        await ouvrirToutes(pg, 95);
        const l = await lignesApercu(pg);
        dit(prixCarte === '80.00' && l[A.A2] && l[A.A2].seuil === '76.00', `[14] ${T} la carte dit 80,00 € ⇒ l'aperçu propose 76,00 € (95 % de 80), jamais un seuil calculé sur l'ancien prix`, `${prixCarte} · ${JSON.stringify(l[A.A2])}`);
        for (const [id, v] of Object.entries(l)) if (v.coche && id !== A.A2) await pg.click(`[data-regles-ligne="${id}"] [data-regles-choix]`);
        if (l[A.A2] && !l[A.A2].coche) await pg.click(`[data-regles-ligne="${A.A2}"] [data-regles-choix]`);
        await pg.waitForTimeout(200);
        const n0 = regleoffres().length;
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: /Oui, (la )?régler/ }).click();
        await pg.waitForSelector('[data-regles-bilan]', { timeout: 15000 }); await pg.waitForTimeout(300);
        const r = regleoffres().slice(n0);
        const ok = await pg.$eval('[data-regles-bilan]', (e) => e.getAttribute('data-regles-ok')).catch(() => '');
        dit(r.length === 1 && /"accepte":76,"prixVu":80,/.test(r[0]) && ok === '1', `[14] ${T} ce qui part porte le prix relu (« prixVu »: 80) et le seuil de l'aperçu (76) — réglée`, `${r[0]} · ok=${ok}`);
        await ctx.close();
      });
      if (bloc(14)) await essaie(`[14] ${T} « lues il y a plus de 7 jours » = les cartes`, async () => {
        for (const jours of [7.5, 10]) {
          const { ctx, pg } = await ouvrir(b, vp, { offresP: (o) => { o[A.A6].lueA = Date.now() - jours * JOUR; } });
          await allerAnnonces(pg);
          const eng = await pg.$eval('[data-regles-engagement]', (x) => x.innerText).catch(() => '');
          const nBloc = Number(((/Dont (\d+) lue/.exec(eng)) || [])[1] || 0);
          const ages = Object.entries(await etats(pg)).filter(([, v]) => v.age).map(([k, v]) => [k, v.age]);
          dit(nBloc === ages.length, `[14] ${T} lue il y a ${String(jours).replace('.', ',')} j : le bloc compte ${nBloc}, les cartes qui disent leur âge ${ages.length} — la même règle`, JSON.stringify(ages));
          await ctx.close();
        }
      });

      // ── 15. REVUE DU 11 OCTOBRE, TOUR 2 ───────────────────────────────
      // Attend la fin d'une relecture « Relire chez eBay » : l'envoi est PARTI,
      // puis le bouton n'est plus « Lecture… » (la base relue est appliquée).
      const finRelire = async (pg, n0) => {
        for (let i = 0; i < 400 && bruts.filter((x) => /regleoffrelire/.test(x)).length === n0; i++) await pg.waitForTimeout(25);
        await pg.waitForFunction(() => { const x = document.querySelector('[data-regles-relire]'); return !x || !x.disabled; }, null, { timeout: 15000 });
        await pg.waitForTimeout(250);
      };
      if (bloc(15)) await essaie(`[15] ${T} ✏️ suit le prix de la carte`, async () => {
        // eBay tient A2 à un autre prix que la liste (90 €) : la pose rend 409
        // « prix-change », la carte apprend le prix d'eBay. ✏️ doit partir de
        // CE prix, et « stock seul » n'en envoyer aucun (les deux sens : plus
        // haut et plus bas que la liste).
        for (const [prixEbay, seuil] of [[95, '81'], [80, '70']]) {
          const { ctx, pg, errs } = await ouvrir(b, vp, { ebay: (st) => { st[A.A2].prix = prixEbay; } });
          await allerAnnonces(pg); await ouvrirPanneau(pg, A.A2);
          await saisir(pg, A.A2, 'accepte', seuil); await poser(pg, A.A2);
          const prixCarte = await carte(pg, A.A2).locator('[data-ebay-prix]').getAttribute('data-ebay-prix').catch(() => '');
          await pg.click(`[data-ebay-carte-ouvrir="${A.A2}"]`); await pg.waitForSelector(`[data-ebay-revise-ouvrir="${A.A2}"]`, { timeout: 5000 });
          await pg.click(`[data-ebay-revise-ouvrir="${A.A2}"]`); await pg.waitForSelector(`[data-ebay-revise-prix="${A.A2}"]`, { timeout: 5000 });
          const champ = await pg.inputValue(`[data-ebay-revise-prix="${A.A2}"]`);
          const champN = Number(String(champ).trim().replace(',', '.'));
          dit(prixCarte === prixEbay.toFixed(2) && Math.round(champN * 100) === prixEbay * 100, `[15] ${T} eBay à ${prixEbay} € (la liste dit 90) : la carte ET le champ Prix de ✏️ disent ${prixEbay} €`, `carte ${prixCarte} · champ « ${champ} »`);
          const n0 = bruts.filter((x) => /"action":"revise"/.test(x)).length;
          await pg.fill(`[data-ebay-revise-stock="${A.A2}"]`, '2'); await pg.click(`[data-ebay-revise-enregistrer="${A.A2}"]`);
          for (let i = 0; i < 400 && bruts.filter((x) => /"action":"revise"/.test(x)).length === n0; i++) await pg.waitForTimeout(25);
          await pg.waitForSelector(`[data-ebay-revise-msg="${A.A2}"]`, { timeout: 8000 }).catch(() => {});
          const rv = bruts.filter((x) => /"action":"revise"/.test(x)).slice(n0);
          dit(rv.length === 1 && !/"price"/.test(rv[0]) && /"quantity":"2"/.test(rv[0]) && ebay[A.A2].prix === prixEbay, `[15] ${T} eBay à ${prixEbay} € : changer le STOCK seul n'envoie AUCUN prix — eBay reste à ${prixEbay} €`, `${rv.join(' ')} · eBay ${ebay[A.A2].prix}`);
          await finPage(pg, errs, `[15] ${T} ✏️ ${prixEbay} €`);
          await ctx.close();
        }
      });
      if (bloc(15)) await essaie(`[15] ${T} offres activées ou non : une voix, un geste`, async () => {
        // La route a RELU le seuil (81 €) mais eBay ne montre pas si les offres
        // sont activées. La carte le dit ; la ligne du haut, l'aperçu du lot et
        // le panneau doivent dire la même chose — et ne pas renvoyer relire.
        const L0 = (o) => ({ lu: true, devise: 'EUR', lueA: Date.now(), offresFaites: null, ...o });
        const { ctx, pg, errs } = await ouvrir(b, vp, { scen: { [A.A2]: [{ body: { ok: true, verifie: null, lecture: L0({ offresActives: null, accepte: 81, refuse: null, prix: 90 }), avertissements: [], range: true } }] } });
        await allerAnnonces(pg);
        await ouvrirPanneau(pg, A.A2); await saisir(pg, A.A2, 'accepte', '81'); await poser(pg, A.A2);
        // eBay (le faux) tient ce que la route vient de relire, et la base le range.
        ebay[A.A2].regle = { offresActives: null, accepte: 81, refuse: null, offresFaites: null };
        ranger('principal', A.A2, lecture(A.A2));
        const n0 = bruts.filter((x) => /regleoffrelire/.test(x)).length;
        await pg.click('[data-regles-relire]'); await finRelire(pg, n0);
        const r = bruts.filter((x) => /regleoffrelire/.test(x)).slice(n0);
        dit(r.length >= 1 && !r.some((x) => x.includes(A.A2)), `[15] ${T} « Relire chez eBay » ne renvoie PAS relire l'annonce dont eBay a relu le seuil (offres activées ou non pas montré) : la relecture rendrait la même chose`, JSON.stringify(r));
        const relire = await pg.locator('[data-regles-relire]').count();
        const lien = await pg.locator(`[data-regles-pas-su] a[href*="ebay.fr/itm/${A.A2}"]`).count();
        const e = await etats(pg);
        dit(e[A.A2] && e[A.A2].etat === 'pas-su' && e[A.A2].raison === 'offres-inconnues' && relire === 0 && lien === 1, `[15] ${T} quand il ne reste qu'elle : la ligne du haut ne propose plus « Relire chez eBay » (rien à relire) et donne SON geste — le lien vers son annonce eBay`, `relire=${relire} · lien=${lien} · ${e[A.A2] && e[A.A2].etat}/${e[A.A2] && e[A.A2].raison}`);
        await ouvrirToutes(pg, 90);
        const l = await lignesApercu(pg);
        const relireLot = await pg.locator('[data-regles-toutes-relire]').count();
        dit(!!l[A.A2] && l[A.A2].s !== 'a-relire' && l[A.A2].coche === null && relireLot === 0, `[15] ${T} « Une règle pour toutes » : elle n'est ni « à relire d'abord », ni comptée dans « Relire ces annonces » ; pas cochable (le geste est sur eBay)`, `${JSON.stringify(l[A.A2])} · « Relire ces » ×${relireLot}`);
        await pg.click('[data-regles-toutes-ouvrir]'); await pg.waitForTimeout(300);
        await ouvrirPanneau(pg, A.A2);
        const nPan = await pg.locator(`[data-regle-panneau-offres-inconnues="${A.A2}"]`).count();
        const val = await pg.inputValue(`[data-regle-saisie-accepte="${A.A2}"]`).catch(() => '');
        const n1 = regleoffres().length;
        await saisir(pg, A.A2, 'accepte', '81'); await poser(pg, A.A2);
        const env = regleoffres().slice(n1);
        const e2 = await etats(pg);
        dit(nPan === 1 && val.replace(',', '.') === '81' && env.length === 1 && /"attendu":\{"accepte":81,"refuse":null\}/.test(env[0]) && e2[A.A2] && e2[A.A2].etat === 'connue',
          `[15] ${T} le panneau montre le seuil LU (81 €), et le reposer envoie cette règle comme garde — jamais « inconnu », qui rendait « eBay a déjà une règle » sans fin — : eBay active les offres, la carte passe « connue »`, `panneau ×${nPan} · saisie « ${val} » · ${env[0]} · ${e2[A.A2] && e2[A.A2].etat}`);
        await finPage(pg, errs, `[15] ${T} offres activées ou non`);
        await ctx.close();
      });
      if (bloc(15)) await essaie(`[15] ${T} lot : « à revoir » sur SA ligne`, async () => {
        // eBay tient A2 à 95 € (la liste dit 90) : dans un lot, A2 rend 409
        // « prix-change ». Le bilan le compte ; SA ligne doit le dire.
        const { ctx, pg, errs } = await ouvrir(b, vp, { ebay: (st) => { st[A.A2].prix = 95; } });
        await allerAnnonces(pg); await ouvrirToutes(pg, 90);
        await pg.click(`[data-regles-ligne="${A.A6}"] [data-regles-choix]`); await pg.click(`[data-regles-ligne="${A.A7}"] [data-regles-choix]`); await pg.waitForTimeout(200);
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: /Oui, (la )?régler/ }).click();
        await pg.waitForSelector('[data-regles-bilan]', { timeout: 15000 }); await pg.waitForTimeout(400);
        const nBilan = Number(await pg.$eval('[data-regles-bilan]', (x) => x.getAttribute('data-regles-a-revoir')).catch(() => -1));
        const lignesARevoir = await pg.$$eval('[data-regles-ligne]', (x) => x.filter((e) => { const i = e.querySelector('[data-regles-issue]'); return i && i.getAttribute('data-regles-issue') === 'a-revoir'; }).map((e) => e.getAttribute('data-regles-ligne')));
        dit(nBilan === 1 && lignesARevoir.length === 1 && lignesARevoir[0] === A.A2, `[15] ${T} le bilan dit « 1 à revoir » ET la ligne de cette annonce (A2, prix changé chez eBay) le dit — chaque ligne affiche son issue`, `bilan ${nBilan} · lignes ${JSON.stringify(lignesARevoir)}`);
        await finPage(pg, errs, `[15] ${T} lot à revoir`);
        await ctx.close();
      });
      if (bloc(15)) await essaie(`[15] ${T} relecture ratée`, async () => {
        // eBay ne rend pas A4 (règle à 65 €, prix changé : « pas su » AVEC
        // risque). Rien lu ne vaut pas rien : la carte garde ce que VRM en
        // savait — jamais « lecture ratée » (gris, sans risque) par-dessus.
        const { ctx, pg, errs } = await ouvrir(b, vp, { relireRate: [A.A4] });
        await allerAnnonces(pg);
        const avant = (await etats(pg))[A.A4];
        const n0 = bruts.filter((x) => /regleoffrelire/.test(x)).length;
        await pg.click('[data-regles-relire]'); await finRelire(pg, n0);
        const e = await etats(pg);
        const note = await pg.$eval('[data-regles-relecture]', (x) => x.innerText).catch(() => '');
        const coul = await couleur(pg, '[data-regles-pas-su]');
        dit(avant && avant.raison === 'prix-change' && e[A.A4] && e[A.A4].etat === 'pas-su' && e[A.A4].raison === 'prix-change' && coul === C_WARN && note.trim().length > 0,
          `[15] ${T} la relecture de A4 rate chez eBay : la carte garde « prix changé » (risque dit en ambre), jamais « lecture ratée » par-dessus — et l'écran dit que la relecture a raté`, `${avant && avant.raison} → ${e[A.A4] && e[A.A4].raison} · ${coul} · « ${note} »`);
        await finPage(pg, errs, `[15] ${T} relecture ratée`);
        await ctx.close();
      });

      // ── 16. REVUE DU 11 OCTOBRE, TOUR 3 ───────────────────────────────
      // Une règle qu'eBay tient PEUT-ÊTRE (seuil relu sans l'état des offres,
      // pose incertaine / en cours / posée mais pas relue) engage autant qu'une
      // règle connue : ventes relues, bloc, déconnexion, alerte — la MÊME règle
      // partout (`regleEngage`). Et chaque « pas su » avec SON geste.
      const sansAutres16 = (o) => { delete o[A.A4]; delete o[A.A5]; delete o[A.A6]; };
      const peutEtre16 = {
        'offres-inconnues': () => entree({ offresActives: null, accepte: 72, refuse: 60, prix: 80 }),
        'apres-ecriture': () => ({ lu: false, raison: 'apres-ecriture', lueA: Date.now() - H, par: 'regle' }),
        incertain: () => ({ lu: false, raison: 'incertain', lueA: Date.now() - H, par: 'regle' }),
        'en-cours': () => ({ lu: false, raison: 'en-cours', lueA: Date.now() - H, par: 'regle' }),
      };
      if (bloc(16)) await essaie(`[16] ${T} une règle peut-être active engage`, async () => {
        for (const [raison, e0] of Object.entries(peutEtre16)) {
          const { ctx, pg, errs } = await ouvrir(b, vp, { ventesAgeP: 3 * JOUR, offresP: (o) => { sansAutres16(o); o[A.A1] = e0(); } });
          await allerAnnonces(pg);
          for (let i = 0; i < 120 && !bruts.some((x) => /"action":"sync"/.test(x)); i++) await pg.waitForTimeout(25);
          await pg.waitForTimeout(300);
          const syncs = bruts.filter((x) => /"action":"sync"/.test(x));
          const eng = await pg.$$eval('[data-regles-engagement]', (l) => l.map((x) => [x.getAttribute('data-regles-engagement'), x.getAttribute('data-regles-engagement-peut-etre')]));
          const btn = await pg.locator('[data-regles-relire-ventes]').count();
          dit(syncs.length === 1 && syncs[0] === '{"action":"sync"}' && eng.length === 1 && eng[0][0] === '0' && eng[0][1] === '1' && btn === 1,
            `[16] ${T} A1 « ${raison} » (eBay tient PEUT-ÊTRE la règle) : ses ventes eBay sont relues à l'ouverture, « ce que ça engage » la compte (0 connue · 1 peut-être) avec « Relire mes ventes eBay »`, `syncs=${JSON.stringify(syncs)} · bloc=${JSON.stringify(eng)} · bouton ×${btn}`);
          if (raison === 'offres-inconnues') await finPage(pg, errs, `[16] ${T} peut-être`);
          await ctx.close();
        }
      });
      // La déconnexion d'un compte eBay dit ce que l'écran dit — les règles
      // connues ET celles qu'eBay tient peut-être ; jamais une annonce terminée.
      const deco16 = async (pg) => {
        await sousOnglet(pg, 'Compte eBay');
        await pg.waitForSelector('[data-ebay-deconnecter="principal"]', { timeout: 15000 });
        await pg.click('[data-ebay-deconnecter="principal"]');
        await feuille(pg).waitFor({ timeout: 8000 });
        const t = (await feuille(pg).innerText()).replace(/\s+/g, ' ');
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click().catch(() => {});
        return t;
      };
      const nb16 = (t, re) => { const m = re.exec(t); return m ? Number(m[1]) : 0; };
      if (bloc(16)) await essaie(`[16] ${T} déconnexion = l'écran`, async () => {
        for (const raison of ['offres-inconnues', 'apres-ecriture']) {
          const { ctx, pg } = await ouvrir(b, vp, { offresP: (o) => { sansAutres16(o); o[A.A1] = peutEtre16[raison](); } });
          await allerAnnonces(pg);
          const t = await deco16(pg);
          dit(nb16(t, /(\d+) annonces?(?: de ce compte)? (?:ont|a) peut-être une règle d'offre/) === 1 && !/(\d+) annonces?(?: de ce compte)? (?:ont|a) une règle d'offre/.test(t),
            `[16] ${T} A1 « ${raison} » : la feuille « Déconnecter le compte eBay » dit qu'eBay tient PEUT-ÊTRE une règle (1), jamais « aucune » ni « active »`, t.slice(t.indexOf('Tu pourras'), t.indexOf('Tu pourras') + 260));
          await ctx.close();
        }
        // A5 retirée d'eBay (sortie de la liste, l'entrée rangée reste) ; A4 au
        // prix changé (peut-être) : la feuille dit les MÊMES nombres que l'écran.
        const { ctx, pg } = await ouvrir(b, vp, { annonces: (p) => { const i = p.findIndex((x) => x.itemId === A.A5); if (i >= 0) p.splice(i, 1); } });
        await allerAnnonces(pg);
        const eng = await pg.$eval('[data-regles-engagement]', (x) => [x.getAttribute('data-regles-engagement'), x.getAttribute('data-regles-engagement-peut-etre')]).catch(() => [null, null]);
        const t = await deco16(pg);
        const oui = nb16(t, /(\d+) annonces?(?: de ce compte)? (?:ont|a) une règle d'offre/), pe = nb16(t, /(\d+) annonces?(?: de ce compte)? (?:ont|a) peut-être une règle d'offre/);
        dit(eng[0] === '2' && eng[1] === '1' && oui === 2 && pe === 1,
          `[16] ${T} A5 terminée sur eBay (encore rangée), A4 au prix changé : l'écran dit 2 actives + 1 peut-être, la feuille de déconnexion AUSSI (jamais « 4 », le compte brut)`, `écran ${JSON.stringify(eng)} · feuille ${oui} + ${pe} peut-être`);
        await ctx.close();
      });
      if (bloc(16)) await essaie(`[16] ${T} alerte « vendue sur Vinted » : la règle peut-être`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { offresP: (o) => { o[A.A5] = entree({ offresActives: null, accepte: 54, refuse: null, prix: 60 }); } });
        await allerAnnonces(pg);
        const k = await pg.$eval(`[data-ebay-a-retirer] [data-ebay-doublon-regle="${A.A5}"]`, (x) => x.getAttribute('data-ebay-doublon-regle-k') || 'oui').catch(() => null);
        dit(k === 'peut-etre', `[16] ${T} A5 vendue sur Vinted, seuil relu sans l'état des offres : l'alerte « encore en vente sur eBay » dit qu'elle a PEUT-ÊTRE une règle d'offre`, String(k));
        // …et « Retirer la règle » reste à un clic sur la paire bloquée.
        const n = await carte(pg, A.A5).locator('[data-regle-retirer-direct]').count();
        const d = await desactive(pg, `[data-regle-retirer-direct="${A.A5}"]`);
        dit(n === 1 && d === false, `[16] ${T} A5 (vendue, « Définir » grisé) : « Retirer la règle » est là, actif`, `×${n} · désactivé=${d}`);
        await ctx.close();
      });
      if (bloc(16)) await essaie(`[16] ${T} deux comptes : retirer reste possible`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { annonces: (p) => { p[1].sku = 'VRM-45'; }, offresP: (o) => { o[A.A2] = entree({ offresActives: null, accepte: 81, refuse: null, prix: 90 }); } });
        await allerAnnonces(pg);
        const e = (await etats(pg))[A.A2];
        const n0 = regleoffres().length;
        const btn = carte(pg, A.A2).locator('[data-regle-retirer-direct]');
        const nb = await btn.count();
        if (nb) { const r0 = repondus; await btn.first().click(); await finEnvoi(pg, A.A2, r0); }
        const env = regleoffres().slice(n0);
        dit(e && e.bloquee === 'deux-comptes' && nb === 1 && env.length === 1 && env[0] === `{"action":"regleoffre","itemId":"${A.A2}","accepte":null,"refuse":null,"confirme":true}`,
          `[16] ${T} A2 en vente sur deux comptes, seuil relu (81 €) sans l'état des offres : « Retirer la règle » est sur sa carte, un clic retire — au compte de L'ANNONCE`, `${e && e.bloquee} · ×${nb} · ${env.join(' ')}`);
        await ctx.close();
      });
      if (bloc(16)) await essaie(`[16] ${T} lot : une offre déjà faite`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { offresP: (o) => { o[A.A2] = entree({ offresActives: true, accepte: null, refuse: null, prix: 90, offresFaites: 3 }); } });
        await allerAnnonces(pg); await ouvrirToutes(pg, 90);
        const coche = await pg.$eval(`[data-regles-choix="${A.A2}"]`, (x) => x.checked).catch(() => null);
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        const t = (await feuille(pg).innerText()).replace(/\s+/g, ' ');
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click();
        dit(coche === true && /offre déjà faite peut être acceptée dès la pose/i.test(t) && regleoffres().length === 0,
          `[16] ${T} « Une règle pour toutes » avec A2 (3 offres déjà faites) : la feuille dit, comme celle de la carte, qu'une offre déjà faite peut être acceptée dès la pose`, t.slice(0, 260));
        await ctx.close();
      });
      if (bloc(16)) await essaie(`[16] ${T} ✏️ prix : « reste à » seulement si les offres sont actives`, async () => {
        for (const actives of [null, false]) {
          const { ctx, pg } = await ouvrir(b, vp, { scen: { ['revise:' + A.A1]: [{ body: { ok: true, ack: 'Success', regle: { lecture: { lu: true, offresActives: actives, accepte: 72, refuse: 60, devise: 'EUR', prix: 85, offresFaites: 2, lueA: Date.now() }, tombee: false, avant: { accepte: 72, refuse: 60 } } } }] } });
          await allerAnnonces(pg);
          await pg.click(`[data-ebay-carte-ouvrir="${A.A1}"]`); await pg.waitForSelector(`[data-ebay-revise-ouvrir="${A.A1}"]`, { timeout: 5000 });
          await pg.click(`[data-ebay-revise-ouvrir="${A.A1}"]`); await pg.waitForSelector(`[data-ebay-revise-prix="${A.A1}"]`, { timeout: 5000 });
          await pg.fill(`[data-ebay-revise-prix="${A.A1}"]`, '85'); await pg.click(`[data-ebay-revise-enregistrer="${A.A1}"]`);
          await pg.waitForSelector(`[data-ebay-revise-msg="${A.A1}"]`, { timeout: 8000 }).catch(() => {});
          await pg.waitForTimeout(300);
          const msg = await pg.$eval(`[data-ebay-revise-msg="${A.A1}"]`, (e) => e.innerText).catch(() => '');
          const c = await couleur(pg, `[data-ebay-revise-msg="${A.A1}"]`);
          const e = (await etats(pg))[A.A1];
          dit(!/✓/.test(msg) && c === C_WARN && e && e.etat !== 'connue',
            `[16] ${T} prix changé, eBay relit le seuil avec offres ${actives === null ? 'activées ou non : pas montré' : 'coupées'} : aucun « ✓ … reste à », message ambre — la carte dit « ${actives === null ? 'pas su' : 'aucune'} » sur la même lecture`, `${msg} · ${c} · ${e && e.etat}`);
          await ctx.close();
        }
      });
      if (bloc(16)) await essaie(`[16] ${T} relire : une annonce qu'eBay ne montre plus`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, { ebay: (st) => { delete st[A.A3]; } });
        await allerAnnonces(pg);
        const n0 = bruts.filter((x) => /regleoffrelire/.test(x)).length;
        await pg.click('[data-regles-relire]'); await finRelire(pg, n0);
        for (let i = 0; i < 160 && !bruts.some((x) => /"action":"sync"/.test(x)); i++) await pg.waitForTimeout(25);
        await pg.waitForTimeout(400);
        const e = (await etats(pg))[A.A3];
        const note = await pg.$eval('[data-regles-relecture]', (x) => x.innerText).catch(() => '');
        const syncs = bruts.filter((x) => /"action":"sync"/.test(x));
        const n1 = bruts.filter((x) => /regleoffrelire/.test(x)).length;
        const relire = await pg.locator('[data-regles-relire]').count();
        if (relire) { await pg.click('[data-regles-relire]'); await pg.waitForTimeout(800); }
        const encore = bruts.filter((x) => /regleoffrelire/.test(x)).slice(n1);
        dit(e && e.raison === 'pas-sur-ce-compte' && note.trim().length > 0 && syncs.includes('{"action":"sync"}') && !encore.some((x) => x.includes(A.A3)),
          `[16] ${T} eBay dit A3 absente de ce compte (liste complète) : la carte le porte, l'écran le DIT, relit la liste du compte, et ne la renvoie plus relire`, `${e && e.raison} · « ${note.slice(0, 120)} » · syncs ${JSON.stringify(syncs)} · relances ${JSON.stringify(encore)}`);
        await finPage(pg, errs, `[16] ${T} absente`);
        await ctx.close();
      });
      if (bloc(16)) await essaie(`[16] ${T} offres activées ou non : chacune nommée, avec son lien`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, { offresP: (o) => { o[A.A1] = entree({ offresActives: null, accepte: 72, refuse: 60, prix: 80 }); o[A.A6] = entree({ offresActives: null, accepte: 95, refuse: null, prix: 100 }); } });
        await allerAnnonces(pg);
        const cartes = await pg.$$eval('[data-regle-offres-inconnues-lien]', (l) => l.map((x) => [x.getAttribute('data-regle-offres-inconnues-lien'), x.getAttribute('href')]));
        const ligne = await pg.$$eval('[data-regles-pas-su] [data-regles-offres-inconnues-lien]', (l) => l.map((x) => [x.getAttribute('data-regles-offres-inconnues-lien'), x.getAttribute('href')]));
        const lu = await pg.$$eval('[data-regle-seuil-lu]', (l) => l.map((x) => [x.getAttribute('data-regle-offre-ligne'), x.getAttribute('data-regle-seuil-lu')]));
        const ok = (arr) => [A.A1, A.A6].every((id) => arr.some(([i, h]) => i === id && h && h.includes('/itm/' + id)));
        dit(ok(cartes) && ok(ligne) && lu.length === 2,
          `[16] ${T} A1 et A6 : seuil relu, offres activées ou non pas montré — chaque carte dit son seuil et porte SON lien, et la ligne du haut les nomme avec leur lien (plus un « regarde-les » sans lien)`, `cartes ${JSON.stringify(cartes)} · ligne ${JSON.stringify(ligne)} · seuils ${JSON.stringify(lu)}`);
        await ctx.close();
      });
      if (bloc(16)) await essaie(`[16] ${T} autre devise : pas de « Relire chez eBay »`, async () => {
        const { ctx, pg } = await ouvrir(b, vp, {
          offresP: (o) => { delete o[A.A4]; o[A.A3] = entree({ offresActives: false, accepte: null, refuse: null, prix: 120 }); o[A.A2] = entree({ offresActives: true, accepte: null, refuse: null, prix: 90, devise: 'USD' }); },
          offresK2: (o) => { o[A.B3] = entree({ offresActives: true, accepte: null, refuse: null, prix: 80 }); },
          ebay: (st) => { st[A.A4].regle = { offresActives: false, accepte: null, refuse: null, offresFaites: null }; },
        });
        await allerAnnonces(pg);
        const e = (await etats(pg))[A.A2];
        const relire = await pg.locator('[data-regles-relire]').count();
        const dev = await pg.$eval('[data-regles-devise]', (x) => x.getAttribute('data-regles-devise')).catch(() => null);
        const ps = await pg.$eval('[data-regles-pas-su]', (x) => x.getAttribute('data-regles-pas-su')).catch(() => null);
        dit(e && e.raison === 'devise' && ps === '2' && dev === '1' && relire === 1,
          `[16] ${T} A2 dans une autre devise : la ligne la dit, sans geste ; « Relire chez eBay » ne vaut que pour A4 (jamais lue) — le clic n'enverra jamais A2`, `${e && e.raison} · pas su ${ps} · devise ${dev} · relire ×${relire}`);
        const n0 = bruts.filter((x) => /regleoffrelire/.test(x)).length;
        if (relire) { await pg.click('[data-regles-relire]'); await finRelire(pg, n0); }
        const env = bruts.filter((x) => /regleoffrelire/.test(x)).slice(n0);
        const relire2 = await pg.locator('[data-regles-relire]').count();
        dit(env.length === 1 && !env[0].includes(A.A2) && relire2 === 0, `[16] ${T} après la relecture de A4, il ne reste que la devise : plus de « Relire chez eBay »`, `${env.join(' ')} · relire ×${relire2}`);
        await ctx.close();
      });
      if (bloc(16)) await essaie(`[16] ${T} lot : posée par eBay mais pas notée`, async () => {
        const L0 = (o) => ({ lu: true, devise: 'EUR', lueA: Date.now(), offresFaites: null, ...o });
        const { ctx, pg } = await ouvrir(b, vp, { scen: { [A.A2]: [{ body: { ok: true, verifie: true, lecture: L0({ offresActives: true, accepte: 81, refuse: null, prix: 90 }), avertissements: [], range: false } }] } });
        await allerAnnonces(pg); await ouvrirToutes(pg, 90);
        for (const [id, v] of Object.entries(await lignesApercu(pg))) if (v.coche && id !== A.A2) await pg.click(`[data-regles-ligne="${id}"] [data-regles-choix]`);
        await pg.waitForTimeout(200);
        await pg.click('[data-regles-appliquer]'); await feuille(pg).waitFor({ timeout: 5000 });
        await feuille(pg).getByRole('button', { name: /Oui, (la )?régler/ }).click();
        await pg.waitForSelector('[data-regles-bilan]', { timeout: 15000 }); await pg.waitForTimeout(300);
        const i = await pg.$eval(`[data-regles-ligne="${A.A2}"] [data-regles-issue]`, (x) => [x.innerText, getComputedStyle(x).color, x.getAttribute('data-regles-non-note')]).catch(() => ['', '', null]);
        const bil = await pg.$eval('[data-regles-bilan]', (x) => [x.innerText, getComputedStyle(x).color, x.getAttribute('data-regles-non-note')]).catch(() => ['', '', null]);
        dit(!/✓/.test(i[0]) && i[1] === C_WARN && i[2] === '1' && bil[1] === C_WARN && bil[2] === '1',
          `[16] ${T} eBay a posé la règle, VRM n'a pas pu la noter : la ligne ne dit pas « ✓ réglée » (ambre, « Relire chez eBay »), le bilan non plus — la voix de la carte (§11)`, `ligne « ${i[0]} » ${i[1]} · bilan « ${bil[0]} » ${bil[1]}`);
        await ctx.close();
      });
      if (bloc(16)) await essaie(`[16] ${T} une programmée partie avec sa règle`, async () => {
        const X = '130000000009';
        const br = { b1: { id: 'b1', etatBrouillon: 'programmee', titre: 'Nike Dunk Low gris taille 42', prix: '80', numero: '49', offreAccepte: '70', categorie: { id: '15709', nom: 'Baskets', requis: [] }, photos: [], programme: { itemId: X, at: Date.now() - 2 * JOUR, debut: new Date(Date.now() - JOUR).toISOString(), compte: 'principal', sku: 'VRM-49' } } };
        const { ctx, pg, errs } = await ouvrir(b, vp, {
          offresP: (o) => { sansAutres16(o); o[X] = { lu: false, raison: 'programmee', accepte: 70, refuse: null, debut: br.b1.programme.debut, lueA: Date.now() - 2 * JOUR, par: 'programmation' }; },
          rows: (r) => { r.push({ id: 'ebay_brouillons', data: { items: br } }); const pr = r.find((x) => x.id === 'ebay_programmees'); pr.data = { items: [], enLigne: [{ itemId: X, sku: 'VRM-49' }], complet: true, capturedAt: Date.now() - 10 * 60000 }; },
          // La synchro range ce qu'eBay montre : l'annonce partie, et sa règle relue.
          apresSync: (c) => { if (c !== 'principal') return; const l = rows.find((x) => x.id === 'ebay_listings'); if (l && !l.data.items.some((a) => a.itemId === X)) l.data.items.push(ann(X, 'Nike Dunk Low gris taille 42', '80.0', 'VRM-49')); ebay[X] = { compte: 'principal', prix: 80, regle: { offresActives: true, accepte: 70, refuse: null, offresFaites: null } }; ranger('principal', X, lecture(X)); },
        });
        await allerAnnonces(pg);
        await pg.waitForSelector(`[data-ebay-annonce="${X}"]`, { timeout: 12000 }).catch(() => {});
        await pg.waitForTimeout(300);
        const syncs = bruts.filter((x) => /"action":"sync"/.test(x));
        const e = (await etats(pg))[X];
        dit(syncs.includes('{"action":"sync"}') && e && e.etat === 'connue' && e.accepte === '70.00',
          `[16] ${T} une programmée partie avec sa règle (70 €) : l'écran relit la liste du compte, l'annonce apparaît, sa règle lue (connue, 70 €) — elle n'est plus invisible nulle part`, `syncs ${JSON.stringify(syncs)} · ${JSON.stringify(e && { etat: e.etat, accepte: e.accepte })}`);
        await finPage(pg, errs, `[16] ${T} programmée partie`);
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc', String((e && e.message) || e).split('\n')[0]); }
  finally { if (b) await b.close().catch(() => {}); srv.close(); }
  console.log(`\n${ko ? 'KO' : 'OK'}  ebay-regle-offre : ${nControles} contrôles, ${ko} rouge(s) — captures dans ${CAPTURES}`);
  process.exit(ko ? 1 : 0);
})();
