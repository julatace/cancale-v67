// Banc : l'ESPACE eBAY (15 nov., eBay complet 2) — Tableau · Argent · Trafic · Santé, sur le
// « Verre dépoli ». Rendu réel (dist/), FAUX eBay (/api/ebay rend la forme de la route,
// api/_lib/ebay-tableau.js), données INVENTÉES. 390 px tactile clair et 1512 px sombre ;
// captures scripts/bancs/captures/ebay-tableau-*.png (à REGARDER, §6.2).
//   NODE_OPTIONS="--require=./scripts/bancs/_porte-banc.cjs --require=./scripts/bancs/_garde-reseau.cjs" BANC_PORT=… node scripts/bancs/ebay-tableau.cjs
// On exige :
//   N. Ventes · eBay (choisi dans le filtre des sites) s'ouvre sur le Tableau ; un ancien lien `?tab=plat_ebay` sur les Commandes ; les sous-sections Tableau · Commandes · À traiter · Offres ·
//      Argent · Santé (Annonces · eBay : Annonces · Trafic · Promotion) ; un lien qui visait les
//      commandes (`section=ventes`) y mène toujours ;
//   T. la bande : 1 à expédier (la règle colisEbay), 2 offres, 3 messages, 145,40 € versés ce mois ;
//      « À faire » rassemble expédier, litige à toi, annonce à corriger, annonce qui ne se voit pas ;
//      toucher « à expédier » ouvre les Commandes ;
//   A. Argent : par vente, le titre de SA commande (par n° de commande), frais réels, « versée le » ;
//      la vente en GBP et la remboursée sont MISES À PART (jamais additionnées) ;
//   R. Trafic : « ne se voient pas » (1) ; 1 000 annonces ⇒ 40 rangées dessinées + « Tout afficher » ;
//   S. Santé : niveau, réclamation élevée, annonce à corriger (Pointure, valeurs suggérées), litige
//      à toi en premier, évaluations reçues ;
//   P. pannes : droit Analytics manquant ⇒ « Reconnecter eBay » ; signature absente ⇒ dite, sans
//      bouton (le geste n'est pas le sien) ; jamais « 0 » à la place de « pas su » ;
//   G. (2e tour) les GESTES : « Pourquoi elle ne se voit pas » ouvre les raisons mesurées ; « Ajouter
//      Pointure : 42 » ne part qu'après la confirmation (Annuler ⇒ rien), avec `confirme` ; « Ajouter les
//      photos de ta fiche » envoie les photos de LA fiche du N° et le nombre vu ; « Compléter les
//      évidentes » montre la liste AVANT ; le calendrier des versements ; la ligne de Ma journée ;
//   V. 390 px : aucun défilement horizontal, aucune rangée hors de sa carte, cibles ≥ 44 px,
//      au plus un bouton plein ; aucune erreur de page.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const CAPT = path.join(__dirname, 'captures');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 7953;
const MAINTENANT = Date.parse('2026-11-15T09:00:00.000Z');
const JOUR = 86400000, iso = (t) => new Date(t).toISOString();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT) }];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGNk+M+ADzCOKgAAV7wDA8mm/lgAAAAASUVORK5CYII=', 'base64');
const CMD = (id, titre, sku, ful) => ({ orderId: id, creationDate: iso(MAINTENANT - 6 * JOUR), orderPaymentStatus: 'PAID', orderFulfillmentStatus: ful || 'NOT_STARTED', lineItems: [{ sku, title: titre, quantity: 1, legacyItemId: '110000000044' }], pricingSummary: { total: { value: '106.50', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: '98.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '12.60', currency: 'EUR' } });

const annonces = (n) => Array.from({ length: n }, (_, i) => ({ itemId: String(110000001000 + i), titre: `Paire inventée n° ${i + 1} avec un titre assez long pour être coupé`, affichages: 2000 - i, vues: 90 - (i % 50), ventes: i % 7 === 0 ? 1 : 0, enLigne: true, photo: '', sku: '', debut: iso(MAINTENANT - 40 * JOUR) }));
const TRAFIC = (n) => {
  const a = [
    { itemId: '110000000001', titre: 'Nike Air Max 90 blanche', affichages: 12, vues: 3, ventes: 0, enLigne: true, photo: 'https://i.ebayimg.com/a.jpg', sku: 'VRM-12', debut: iso(MAINTENANT - 40 * JOUR) },
    { itemId: '110000000002', titre: 'Adidas Samba noire', affichages: 940, vues: 61, ventes: 1, enLigne: true, photo: 'https://i.ebayimg.com/b.jpg', sku: 'VRM-13', debut: iso(MAINTENANT - 40 * JOUR) },
    ...annonces(n),
  ];
  return { debut: iso(MAINTENANT - 30 * JOUR), fin: iso(MAINTENANT - JOUR), majLe: iso(MAINTENANT - JOUR), annonces: a, invisibles: { invisibles: [a[0]], sansChiffres: ['110000000004'] } };
};
const ARGENT = {
  solde: { dispo: { v: 120, c: 'EUR' }, enCours: { v: 115.4, c: 'EUR' }, retenu: { v: 0, c: 'EUR' }, total: { v: 235.4, c: 'EUR' } },
  versements: [
    { id: 'P2', statut: 'INITIATED', date: '2026-11-14T03:00:00.000Z', montant: { v: 50, c: 'EUR' }, n: 1, vers: '' },
    { id: 'P1', statut: 'SUCCEEDED', date: '2026-11-10T03:00:00.000Z', montant: { v: 145.4, c: 'EUR' }, n: 3, vers: 'BANK •••• 4321' },
  ],
};
const SANTE = {
  niveau: { niveau: 'ABOVE_STANDARD', programme: 'PROGRAM_GLOBAL', evalueLe: '2026-11-01T00:00:00.000Z', prevu: 'TOP_RATED', metriques: [{ cle: 'DEFECTIVE_TRANSACTION_RATE', nom: 'Transaction defect rate', valeur: 1.25, niveau: 'ABOVE_STANDARD', seuil: 2, type: 'RATE' }, { cle: 'SHIPPING_MISS_RATE', nom: 'Late', valeur: 0.5, niveau: 'TOP_RATED', seuil: null, type: 'RATE' }] },
  nonConforme: { note: 'HIGH', lignes: [{ nom: 'Baskets homme', note: 'HIGH', valeur: 0.04 }] },
  nonRecu: { note: null, lignes: [] },
  conformite: [{ type: 'ASPECTS_ADOPTION', n: 1 }],
  aCorriger: [{ itemId: '110000000001', sku: 'VRM-12', type: 'ASPECTS_ADOPTION', problemes: [{ code: 'MISSING_OR_INVALID_REQUIRED_ASPECTS', message: 'Pointure manquante', manque: ['Pointure', 'Couleur'], suggestions: [{ nom: 'Pointure', valeurs: ['42', '43'] }, { nom: 'Couleur', valeurs: ['Blanc'] }], etat: 'OUT_OF_COMPLIANCE' }] }],
};
const LITIGES = {
  paiement: [{ id: '5000000001', orderId: '07-11111-22222', motif: 'ITEM_NOT_RECEIVED', etat: 'ACTION_NEEDED', ouvertLe: iso(MAINTENANT - 2 * JOUR), repondreAvant: iso(MAINTENANT + 5 * JOUR), montant: { v: 98, c: 'EUR' } }],
  reclamations: [{ sorte: 'reclamation', id: '5100000001', itemId: '110000000009', etat: 'OPEN', ouvertLe: iso(MAINTENANT - JOUR), repondreAvant: null, montant: { v: 70, c: 'EUR' } }],
  cas: [],
};
const EVAL = { score: 212, pourcent: 99.1, an: { positives: 140, neutres: 2, negatives: 1 }, dernieres: [
  { id: '9001', type: 'Positive', texte: 'Parfait, merci !', date: '2026-11-10T10:00:00.000Z', itemId: '110000000009', titre: 'Nike Air Max 90', de: 'client', reponse: false },
  { id: '9002', type: 'Negative', texte: 'Pas la bonne taille', date: '2026-11-08T10:00:00.000Z', itemId: '110000000008', titre: 'Adidas Samba', de: 'client', reponse: false }] };

let rows = [], envois = [], SC = {};
const remettre = (sc = {}) => {
  SC = sc;
  rows = [
    { id: 'main', data: {} },
    { id: 'ebay_comptes', data: { comptes: [{ principal: true, cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_fr', type: 'particulier', site: 'FR' }] } },
    { id: 'ebay_listings', data: { items: [{ itemId: '110000000001', title: 'Nike Air Max 90 blanche', price: '95.0', sku: 'VRM-12' }], capturedAt: MAINTENANT } },
    { id: 'ebay_orders', data: { orders: [CMD('07-11111-22222', 'Nike Air Max 90 blanche', 'VRM-12'), CMD('07-33333-44444', 'Adidas Samba noire', 'VRM-13', 'FULFILLED')], capturedAt: MAINTENANT } },
    { id: 'ebay_messages', data: { nonLus: 3, complet: true, capturedAt: MAINTENANT } },
    { id: 'ebay_versements', data: { dates: { '07-33333-44444': '2026-11-10' }, versements: ARGENT.versements, capturedAt: MAINTENANT } },
    { id: 'vinted_item_details', data: { '7012': { photos: ['https://images1.vinted.net/t/12a.jpg', 'https://images1.vinted.net/t/12b.jpg', 'https://images1.vinted.net/t/12c.jpg'] } } },
  ];
  envois = [];
};
let ko = 0, okc = 0;
const dit = (c, m, d) => { if (c) okc++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 200)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT'); process.exit(1); });
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
async function ouvrir(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'Europe/Paris', deviceScaleFactor: vp.width < 600 ? 2 : 1, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript(([sombre]) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_ebay_guide_vu', '1');
    localStorage.setItem('vinted_annonce_numeros', JSON.stringify({ '7012': { numero: '12', title: 'Nike Air Max 90 blanche' } }));
    if (sombre) { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } } catch (_) {} }, [!!sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image'].includes(r.request().resourceType()) ? r.fulfill({ status: 200, contentType: 'image/png', body: PNG }) : r.abort()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(MAINTENANT), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.route('**/api/ebay**', async (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    envois.push(body);
    const scope = { ko: { raison: 'scope', erreur: "eBay n'a pas autorisé VRM à lire le trafic." } };
    const sig = { ko: { raison: 'signature', erreur: 'eBay exige une signature numérique.' } };
    if (body.action === 'status') return j({ ok: true, connected: true, comptes: [{ cle: 'aaaaaaaaaaaaaaaa', pseudo: 'vendeur_fr', principal: true, relie: true, type: 'particulier', site: 'FR', siteLu: true, marche: { nom: 'eBay.fr', devise: 'EUR', domaine: 'www.ebay.fr', pays: 'FR' }, jeton: null }] });
    if (body.action === 'tableau') return j({ ok: true, capturedAt: MAINTENANT,
      argent: SC.signature ? sig : ARGENT, trafic: SC.scope ? scope : TRAFIC(0), sante: SANTE, evaluations: EVAL, litiges: LITIGES,
      offres: { n: 2, auMoins: false }, messages: { n: 3, auMoins: false, lu: MAINTENANT } });
    if (body.action === 'argent') return SC.signature ? j({ ok: false, reason: 'signature', error: 'eBay exige une signature numérique.' }) : j({ ok: true, ...ARGENT, complet: true, depuis: iso(MAINTENANT - 90 * JOUR),
      commandes: {
        '07-33333-44444': { net: 85.4, frais: 12.6, devise: 'EUR', versement: '2026-11-10T03:00:00.000Z', statut: 'SUCCEEDED', rembourse: false, sur: true, autresFrais: 3.2 },
        '07-11111-22222': { net: 50, frais: 7.1, devise: 'EUR', versement: null, statut: 'INITIATED', rembourse: false, sur: true, autresFrais: 0 },
        '07-55555-66666': { net: 40, frais: 5, devise: 'GBP', versement: '2026-11-10T03:00:00.000Z', statut: 'SUCCEEDED', rembourse: false, sur: true, autresFrais: 0 },
        '07-77777-88888': { net: 60, frais: 8, devise: 'EUR', versement: '2026-11-10T03:00:00.000Z', statut: 'SUCCEEDED', rembourse: true, sur: false, autresFrais: 0 },
      }, horsVente: { EUR: { total: 3.2, n: 1, types: { AD_FEE: 3.2 } }, GBP: { total: 1.5, n: 1, types: { AD_FEE: 1.5 } } } });
    if (body.action === 'trafic') return SC.scope ? j({ ok: false, reason: 'scope', error: 'droit' }) : j({ ok: true, ...TRAFIC(SC.mille ? 1000 : 0) });
    if (body.action === 'sante') return j({ ok: true, ...SANTE });
    if (body.action === 'litiges') return j({ ok: true, ...LITIGES });
    if (body.action === 'evaluationsrecues') return j({ ok: true, ...EVAL });
    if (body.action === 'diagnostic') return j({ ok: true, annonces: (body.itemIds || []).map((id) => ({ itemId: id, titre: 'Nike Air Max 90 blanche', prix: 120, devise: 'EUR', photos: 2, epid: '',
      propositions: { manque: ['Pointure', 'Couleur'], suggestions: { Pointure: ['42'], Couleur: ['Blanc', 'Gris'] }, epid: '2254990123' }, evidentes: { Pointure: '42' },
      comparables: { n: 8, mediane: 79, min: 70, max: 90, base: 'caracteristiques' }, comparablesBase: 'caracteristiques', conformiteLue: true,
      raisons: [{ cle: 'caracteristiques', manque: ['Pointure', 'Couleur'] }, { cle: 'photos', n: 2 }, { cle: 'prix', prix: 120, mediane: 79, n: 8 }, { cle: 'catalogue', epid: '2254990123' }] })) });
    if (body.action === 'corrigeraspects' || body.action === 'ajouterphotos' || body.action === 'lierproduit') return body.confirme === true ? j({ ok: true, relu: true }) : j({ ok: false, reason: 'confirmation', error: 'non confirmé' }, 400);
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const capt = async (pg, nom) => { try { await pg.waitForTimeout(800); fs.mkdirSync(CAPT, { recursive: true }); await pg.screenshot({ path: path.join(CAPT, `ebay-tableau-${nom}.png`) }); } catch (_) {} };
// Un goto interrompu par la navigation de l'app (ERR_ABORTED) est relancé une fois.
const aller = async (pg, q) => { try { await pg.goto(`http://localhost:${PORT}/?${q}`, { waitUntil: 'domcontentloaded' }); } catch (_) { await pg.waitForTimeout(500); await pg.goto(`http://localhost:${PORT}/?${q}`, { waitUntil: 'domcontentloaded' }); } };
const attendre = (pg, sel, t = 25000) => pg.waitForSelector(sel, { timeout: t });
// Mise en page à 390 : rien ne sort de l'écran ni de sa carte, cibles ≥ 44 px, un plein au plus.
const mesures = (pg) => pg.evaluate(() => {
  const r = { horiz: document.documentElement.scrollWidth - window.innerWidth, hors: [], petits: [], pleins: 0 };
  for (const c of document.querySelectorAll('.ebt-carte')) { const bc = c.getBoundingClientRect(); for (const x of c.querySelectorAll('.ebt-rangee, .ebt-valeur, .ebt-nom')) { const b = x.getBoundingClientRect(); if (b.width && (b.right > bc.right + 1 || b.left < bc.left - 1)) r.hors.push((x.className || '') + ':' + (x.textContent || '').slice(0, 30)); } }
  for (const x of document.querySelectorAll('.ebt button, .ebt a')) { const b = x.getBoundingClientRect(); if (b.width && b.height < 43.5 && !x.closest('.vrm-ui-bande')) r.petits.push((x.textContent || '').trim().slice(0, 30) + ' ' + Math.round(b.height)); }
  r.coupes = [...document.querySelectorAll('.ebt .vrm-ui-bande-n, .ebt .vrm-ui-bande-l, .ebt-titre .ebt-lien')].filter((x) => x.getBoundingClientRect().width && x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent.trim());
  r.pleins = [...document.querySelectorAll('.sb-btn-plein')].filter((x) => x.getBoundingClientRect().width > 0).length;
  return r;
});

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  dist/ absent : npm run build'); process.exit(1); }
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    // ── 390 tactile, clair
    remettre();
    let { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, false);
    await essaie('N/T tableau', async () => {
      await aller(pg, 'tab=ventes&site=ebay');
      await attendre(pg, '[data-ebt="tableau"][data-ebt-etat="lu"]');
      await pg.waitForTimeout(600);
      const sous = await pg.$$eval('[data-tache-sous="ventes.ebay"] [data-section]', (l) => l.map((x) => x.getAttribute('data-section') + ':' + x.textContent.trim()));
      dit(sous.join(',') === 'tableau:Tableau,ventes:Commandes,agent:À traiter,offres:Offres,argent:Argent,sante:Santé', 'N1. Ventes · eBay s’ouvre sur le Tableau, puis Commandes · À traiter · Offres · Argent · Santé', sous.join(','));
      const ch = await pg.$$eval('[data-ebt-chiffre]', (l) => Object.fromEntries(l.map((x) => [x.getAttribute('data-ebt-chiffre'), x.getAttribute('data-n')])));
      dit(ch.expedier === '1' && ch.offres === '2' && ch.messages === '3' && ch.verse === '145.4', 'T1. la bande : 1 à expédier (colisEbay), 2 offres, 3 messages, 145,40 € versés en novembre', JSON.stringify(ch));
      const af = await pg.getAttribute('[data-ebt-afaire]', 'data-ebt-afaire').catch(() => '');
      dit(['expedier', 'litiges', 'corriger', 'invisibles', 'sante'].every((k) => (af || '').split(' ').includes(k)), 'T2. « À faire » : expédier, litige à toi, annonce à corriger, annonce invisible, réclamations élevées', af);
      const gr = await pg.$$eval('[data-ebt-groupe]', (l) => Object.fromEntries(l.map((x) => [x.getAttribute('data-ebt-groupe'), x.getAttribute('data-etat')])));
      dit(gr.argent === 'lu' && gr.trafic === 'lu' && gr.sante === 'attention', 'T3. trois cartes lues : argent, trafic, santé (en attention : réclamations élevées)', JSON.stringify(gr));
      dit((await pg.getAttribute('[data-ebt-dispo]', 'data-ebt-dispo')) === '120', 'T4. 120,00 € disponibles');
      const m = await mesures(pg);
      dit(m.horiz <= 0 && m.hors.length === 0, 'V1. 390 : aucun défilement horizontal, rien hors de sa carte', JSON.stringify(m));
      dit(m.petits.length === 0, 'V2. cibles au doigt ≥ 44 px', m.petits.join(' | '));
      dit(m.pleins <= 1, 'V3. au plus un bouton plein visible', String(m.pleins));
      dit(m.coupes.length === 0, 'V8. la bande : aucun chiffre ni libellé coupé (« 145,40 € ver… »)', m.coupes.join(' | '));
      const n = envois.filter((e) => e.action === 'tableau').length;
      dit(n === 1, 'T5. UN aller-retour pour tout le tableau', String(n));
      await capt(pg, '390-tableau');
      await pg.click('[data-ui-afaire]');
      await attendre(pg, '[data-ebt-afaire-ligne="litiges"]');
      await capt(pg, '390-afaire');
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay&section=tableau`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await attendre(pg, '[data-ebt="tableau"] [data-ebt-chiffre="expedier"]');
      await pg.click('[data-ebt-chiffre="expedier"]');
      await pg.waitForSelector('[data-tache-section="ventes"]', { timeout: 15000 });
      dit(true, 'T6. toucher « à expédier » ouvre les Commandes');
    });
    await essaie('N2 lien commandes', async () => {
      await aller(pg, 'tab=plat_ebay&section=ventes');
      await attendre(pg, '[data-tache-section="ventes"][data-tache-site="ebay"]');
      dit(true, 'N2. `section=ventes` mène toujours aux Commandes');
      await aller(pg, 'tab=plat_ebay');
      await attendre(pg, '[data-tache-section="ventes"][data-tache-site="ebay"]');
      dit(true, 'N4. un ancien lien `?tab=plat_ebay` (notification « à expédier ») mène toujours aux Commandes');
    });
    await essaie('A argent', async () => {
      await aller(pg, 'tab=plat_ebay&section=argent');
      await attendre(pg, '[data-ebt="argent"][data-ebt-etat="lu"]');
      const lignes = await pg.$$eval('[data-ebt-commande]', (l) => l.map((x) => [x.getAttribute('data-ebt-commande'), x.getAttribute('data-versee'), x.textContent]));
      const l1 = lignes.find((x) => x[0] === '07-33333-44444');
      dit(lignes.length === 2 && l1 && /Adidas Samba noire/.test(l1[2]) && l1[1] === '2026-11-10' && /12,60/.test(l1[2]), 'A1. par vente : le titre de SA commande (par n°), frais réels 12,60 €, versée le 10 nov.', JSON.stringify(lignes.map((x) => [x[0], x[1], x[2].slice(0, 80)])));
      const apart = await pg.$$eval('[data-ebt-apart-ligne]', (l) => l.map((x) => x.getAttribute('data-ebt-apart-ligne')));
      dit(apart.sort().join() === '07-55555-66666,07-77777-88888', 'A2. la vente en GBP et la remboursée sont mises à part (jamais additionnées)', apart.join());
      const pied = await pg.$eval('[data-ebt-par-commande] + .ebt-pied, [data-ebt-par-commande] .ebt-pied', (x) => x.textContent).catch(() => '');
      dit(/135,40/.test(pied) && /19,70/.test(pied), 'A3. reçu 135,40 € · frais réels 19,70 € (euros seulement)', pied);
      const hv = await pg.getAttribute('[data-ebt-hors-vente]', 'data-ebt-hors-vente');
      dit(hv === '3.2', 'A4. autres frais eBay (sponsorisation) : 3,20 € ; les 1,50 GBP à part', hv);
      const m = await mesures(pg);
      dit(m.horiz <= 0 && m.hors.length === 0 && m.petits.length === 0, 'V4. Argent à 390 : rien ne déborde, cibles ≥ 44 px', JSON.stringify(m));
      await capt(pg, '390-argent');
    });
    await essaie('S sante', async () => {
      await aller(pg, 'tab=plat_ebay&section=sante');
      await attendre(pg, '[data-ebt="sante"][data-ebt-etat="lu"]');
      await attendre(pg, '[data-ebt-score]');
      dit((await pg.getAttribute('[data-ebt="sante"] [data-ebt-niveau]', 'data-ebt-niveau')) === 'ABOVE_STANDARD', 'S1. niveau : au-dessus du standard');
      const notes = await pg.$$eval('[data-ebt-note]', (l) => l.map((x) => x.getAttribute('data-ebt-note')));
      dit(notes.join() === 'nonConforme:HIGH,nonRecu:aucune', 'S2. « pas conforme » élevé, « pas reçu » : rien à comparer (pas « bon »)', notes.join());
      const c = await pg.$eval('[data-ebt-corriger="110000000001"]', (x) => [x.textContent, x.getAttribute('href')]);
      dit(/Pointure/.test(c[0]) && /42, 43/.test(c[0]) && c[1] == null, 'S3. annonce à corriger : « Manque : Pointure », eBay propose 42, 43 ; la rangée ouvre « pourquoi » et ses gestes', JSON.stringify(c));
      const li = await pg.$$eval('[data-ebt-litige]', (l) => l.map((x) => x.getAttribute('data-ebt-litige') + ':' + x.getAttribute('data-a-toi')));
      dit(li[0] === 'paiement:5000000001:1' && li.length === 2, 'S4. le litige qui attend ta réponse en premier', li.join());
      const ev = await pg.$$eval('[data-ebt-eval]', (l) => l.map((x) => x.getAttribute('data-ebt-eval')));
      dit(ev.join() === 'Positive,Negative', 'S5. évaluations reçues (aucune relance)', ev.join());
      await capt(pg, '390-sante');
    });
    await essaie('R trafic', async () => {
      await aller(pg, 'tab=plat_ebay&section=trafic');
      await attendre(pg, '[data-ebt="trafic"][data-ebt-etat="lu"]');
      const sous = await pg.$$eval('[data-tache-sous="annonces.ebay"] [data-section]', (l) => l.map((x) => x.getAttribute('data-section')));
      dit(sous.join() === 'annonces,trafic,promo', 'N3. Annonces · eBay : Annonces · Trafic · Promotion', sous.join());
      dit((await pg.getAttribute('[data-ebt-invisibles]', 'data-ebt-invisibles')) === '1', 'R1. 1 annonce ne se voit pas');
      await capt(pg, '390-trafic');
    });
    await essaie('G gestes', async () => {
      envois = [];
      await aller(pg, 'tab=plat_ebay&section=trafic');
      await attendre(pg, '[data-ebt-pourquoi="110000000001"]');
      await pg.click('[data-ebt-pourquoi="110000000001"]');
      await attendre(pg, '[data-ebt-diagnostic] [data-ebt-raisons]');
      const rs = await pg.getAttribute('[data-ebt-raisons]', 'data-ebt-raisons');
      dit(['caracteristiques', 'photos', 'prix', 'catalogue'].every((k) => (rs || '').includes(k)), 'G1. « Pourquoi elle ne se voit pas » : caractéristiques, photos, prix au-dessus des comparables, catalogue', rs);
      const lum = await pg.$eval('[data-ebt-diagnostic] .ebt-titre', (e) => { const m = getComputedStyle(e).color.match(/[\d.]+/g).map(Number); const l = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * l(m[0]) + 0.7152 * l(m[1]) + 0.0722 * l(m[2]); });
      dit(lum < 0.25, 'G1b. dans la feuille (porcelaine), les titres de groupe sont à l’encre SOMBRE (lisibles)', String(lum));
      await capt(pg, '390-pourquoi');
      await pg.click('[data-ebt-ajouter="Pointure:42"]');
      await attendre(pg, '.vrm-confirmation');
      await pg.locator('.vrm-confirmation').getByRole('button', { name: 'Annuler', exact: true }).click();
      await pg.waitForTimeout(400);
      dit(!envois.some((e) => e.action === 'corrigeraspects'), 'G2. « Annuler » dans la confirmation : rien ne part');
      await pg.click('[data-ebt-ajouter="Pointure:42"]');
      await attendre(pg, '.vrm-confirmation');
      await pg.locator('.vrm-confirmation').getByRole('button', { name: 'Ajouter', exact: true }).click();
      await attendre(pg, '[data-ebt-issue="fait"]');
      const e1 = envois.find((e) => e.action === 'corrigeraspects') || {};
      dit(e1.itemId === '110000000001' && e1.confirme === true && JSON.stringify(e1.aspects) === '{"Pointure":"42"}', 'G3. confirmé : UNE caractéristique part, la valeur proposée par eBay, `confirme` posé', JSON.stringify(e1));
      await attendre(pg, '[data-ebt-photos="3"]');
      await pg.click('[data-ebt-photos="3"]');
      await attendre(pg, '.vrm-confirmation');
      await pg.locator('.vrm-confirmation').getByRole('button', { name: 'Ajouter les photos', exact: true }).click();
      await pg.waitForTimeout(800);
      const e2 = envois.find((e) => e.action === 'ajouterphotos') || {};
      dit(e2.nVu === 2 && Array.isArray(e2.photos) && e2.photos.length === 3 && e2.photos[0] === 'https://images1.vinted.net/t/12a.jpg' && e2.confirme === true, 'G4. les photos de LA fiche du N°12 (par identité) et le nombre vu (2)', JSON.stringify(e2));
      await pg.keyboard.press('Escape').catch(() => {});
      await aller(pg, 'tab=plat_ebay&section=sante');
      await attendre(pg, '[data-ebt-geste="evidentes"]');
      await pg.click('[data-ebt-geste="evidentes"]');
      await attendre(pg, '.vrm-confirmation');
      const txt = await pg.locator('.vrm-confirmation').innerText();
      dit(/VRM-12/.test(txt) && /Couleur Blanc/.test(txt) && !/Pointure 42/.test(txt), 'G5. « Compléter les évidentes » : la liste est montrée AVANT (VRM-12 : Couleur Blanc ; pas la Pointure, eBay propose deux valeurs)', txt.replace(/\s+/g, ' ').slice(0, 160));
      await pg.locator('.vrm-confirmation').getByRole('button', { name: 'Annuler', exact: true }).click();
      await aller(pg, 'tab=plat_ebay&section=argent');
      await attendre(pg, '[data-ebt-calendrier]');
      const cal = await pg.$$eval('[data-ebt-cal]', (l) => l.map((x) => x.getAttribute('data-ebt-cal')));
      dit(cal.join() === 'en-route,prochain,arrive', 'G6. calendrier : en route (14 nov.), au prochain versement (disponible), arrivé (10 nov.)', cal.join());
      await capt(pg, '390-calendrier');
      await aller(pg, 'tab=journee');
      await attendre(pg, '[data-ebt-journee]');
      dit((await pg.getAttribute('[data-ebt-journee]', 'data-ebt-journee')) === 'en-route', 'G7. Ma journée : « eBay : 50,00 € en route » (lu en base, aucun appel eBay)');
    });
    await ctx.close();
    // ── 1 000 annonces : 40 rangées dessinées, la suite derrière « Tout afficher »
    remettre({ mille: true });
    ({ ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, false));
    await essaie('R2 mille', async () => {
      await aller(pg, 'tab=plat_ebay&section=trafic');
      const t0 = Date.now();
      await attendre(pg, '[data-ebt="trafic"][data-ebt-etat="lu"]');
      const t = Date.now() - t0;
      const n = await pg.$$eval('[data-ebt-toutes] [data-ebt-annonce]', (l) => l.length);
      const noeuds = await pg.$$eval('[data-ebt="trafic"] *', (l) => l.length);
      dit(n === 40 && noeuds < 1500, 'R2. 1 002 annonces : 40 rangées dessinées (+ « Tout afficher »), DOM borné', `${n} rangées, ${noeuds} nœuds, ${t} ms`);
    });
    await ctx.close();
    // ── pannes : droit Analytics manquant, signature absente
    remettre({ scope: true, signature: true });
    ({ ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, false));
    await essaie('P pannes', async () => {
      await aller(pg, 'tab=ventes&site=ebay');
      await attendre(pg, '[data-ebt="tableau"][data-ebt-etat="lu"]');
      dit(await pg.$('[data-ebt-groupe="trafic"] [data-ebt-panne="scope"] [data-ebt-reconnecter]') != null, 'P1. droit Analytics manquant ⇒ la raison + « Reconnecter eBay »');
      const sig = await pg.$('[data-ebt-groupe="argent"] [data-ebt-panne="signature"]');
      dit(sig != null && (await pg.$('[data-ebt-groupe="argent"] [data-ebt-panne="signature"] button')) == null, 'P2. signature absente ⇒ dite, sans bouton (le geste est celui de VRM)');
      const v = await pg.getAttribute('[data-ebt-chiffre="verse"]', 'data-n');
      dit(v === 'pas-su', 'P3. « versé ce mois » pas su ⇒ « — », jamais 0', v);
      await capt(pg, '390-pannes');
    });
    dit(errs.length === 0, 'V5. aucune erreur de page (390)', errs.join(' | '));
    await ctx.close();
    // ── 1512 sombre
    remettre();
    ({ ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 982 }, true));
    await essaie('1512 sombre', async () => {
      await aller(pg, 'tab=ventes&site=ebay');
      await attendre(pg, '[data-ebt="tableau"][data-ebt-etat="lu"]');
      await pg.waitForTimeout(600);
      const m = await mesures(pg);
      const vis = await pg.evaluate(() => { const e = document.querySelector('[data-ebt="tableau"]'); if (!e) return 'absent'; const b = e.getBoundingClientRect(); let o = 1, x = e; while (x) { o *= Number(getComputedStyle(x).opacity || 1); x = x.parentElement; } const h = document.elementFromPoint(b.left + 40, Math.max(b.top + 20, 130)); return { top: Math.round(b.top), h: Math.round(b.height), o, sur: h ? (h.className || h.tagName).toString().slice(0, 60) : null }; });
      console.log('    1512 :', JSON.stringify(vis));
      dit(m.horiz <= 0 && m.hors.length === 0 && m.coupes.length === 0 && m.petits.length === 0, 'V6. 1512 sombre : rien ne déborde, rien de coupé, cibles ≥ 44 px', JSON.stringify(m));
      await capt(pg, '1512-sombre-tableau');
      await aller(pg, 'tab=plat_ebay&section=argent');
      await attendre(pg, '[data-ebt="argent"][data-ebt-etat="lu"]');
      await capt(pg, '1512-sombre-argent');
    });
    dit(errs.length === 0, 'V7. aucune erreur de page (1512)', errs.join(' | '));
    await ctx.close();
  } finally { await b.close(); srv.close(); }
  console.log(`\n${okc} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
