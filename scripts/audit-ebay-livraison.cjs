// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LA LIVRAISON eBAY DANS VRM (28 nov., lot `ebay-livraison`)
//         node scripts/audit-ebay-livraison.cjs            (règles + routes + mutations)
//         node scripts/audit-ebay-livraison.cjs --sans-mutations
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « oui, fais tout » — colis eBay dans À envoyer, étiquette depuis VRM,
// suivi automatique, livraison préréglée, port pour info. §2.8 : l'ACHETEUR paie
// le bordereau ; VRM n'achète JAMAIS une étiquette.
// Tout est INVENTÉ ici (commandes, e-mails, réponses d'eBay) ; aucun réseau.
// Les VRAIES routes sont exécutées (§4.10) : api/email-inbound.js (fausse base
// PostgREST de _faux-inbound.cjs), api/_lib/ebay-relecture.js (faux eBay),
// api/ebay.js `pubverify` (le XML tel qu'il part).
//   A. la commande à expédier comptée UNE fois, la date limite = shipByDate (Paris)
//   B. l'étiquette reçue par e-mail rangée par N° DE COMMANDE (50 au même titre)
//   C. le suivi lu chez eBay ⇒ « En route », le transporteur ⇒ « Livrée »
//   D. AUCUN achat d'étiquette (l'API Logistics refusée au seul `fetch` du serveur)
//   E. la livraison jamais gratuite, le colis par défaut dans le XML
//   F. le port hors compta (`montantRecuEbay`)
// Mutations (copie de l'arbre mutée, l'audit relancé DEPUIS elle, doit être ROUGE) :
//   achat   : une route appelle `create_from_shipping_quote` (+ la garde retirée)
//   titre   : l'étiquette rangée par le titre de l'annonce
//   port    : le port n'est plus retiré du dû
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
const path = require('path'), fs = require('fs'), os = require('os');
const { execFileSync } = require('child_process');
const RACINE = process.env.RACINE || path.join(__dirname, '..');
let ko = 0, n = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — exécuté', String(e && e.stack || e).split('\n').slice(0, 3).join(' | ').slice(0, 300)); } };
const imp = (rel) => import('file://' + path.join(RACINE, rel));
const J = 86400000;
const iso = (dj) => new Date(Date.now() + dj * J).toISOString();
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n').toString('base64');

const commande = (id, o = {}) => ({
  orderId: id, creationDate: iso(-2), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED',
  cancelStatus: { cancelState: 'NONE_REQUESTED' },
  fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO', shippingStep: { shippingCarrierCode: 'MONDIAL_RELAY', shipTo: { contactAddress: { countryCode: 'FR' } } } }],
  pricingSummary: { priceSubtotal: { value: '80.00', currency: 'EUR' }, deliveryCost: { value: '6.50', currency: 'EUR' }, total: { value: '86.50', currency: 'EUR' } },
  paymentSummary: { totalDueSeller: { value: '80.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '10.00', currency: 'EUR' },
  lineItems: [{ lineItemId: 'L' + id, title: 'Nike Air Max 1 bleu 44', sku: 'VRM-41', legacyItemId: '1100', quantity: 1,
    lineItemFulfillmentInstructions: { shipByDate: o.shipBy || iso(2) } }],
  ...(o.x || {}),
});

// ── A. À EXPÉDIER, UNE FOIS ; DATE LIMITE LUE ───────────────────────────────
async function sectionA() {
  const ex = await imp('api/_lib/ebay-a-expedier.js');
  const lv = await imp('api/_lib/ebay-livraison.js');
  const c1 = commande('12-34567-89012');
  const c = ex.colisEbay([c1, { ...c1 }, commande('12-34567-89013', { x: { orderFulfillmentStatus: 'FULFILLED' } })]);
  dit(c && c.aPoster.length === 1 && c.aPoster[0].orderId === '12-34567-89012', 'A1 une commande à expédier relue deux fois est comptée UNE fois (et la partie ne l\'est pas)', c && c.aPoster.map((x) => x.orderId).join(','));
  // shipByDate 2026-12-03T15:30:00Z ⇒ 16 h 30 à Paris (heure d'hiver), jour 2026-12-03, limite LUE.
  const l = lv.limiteEbay(commande('x', { shipBy: '2026-12-03T15:30:00.000Z' }), Date.parse('2026-12-01T10:00:00Z'));
  dit(!!l && l.jour === '2026-12-03' && l.heure === '16:30' && l.limite === 'ebay' && l.daysLeft === 2 && !l.depasse, 'A2 la date limite = shipByDate, en jour et heure de Paris, lue (jamais « estimée »)', JSON.stringify(l));
  const l2 = lv.limiteEbay(commande('x', { shipBy: '2026-12-03T22:59:00.000Z' }), Date.parse('2026-12-05T10:00:00Z'));
  dit(!!l2 && l2.heure === null && l2.retard === true && l2.daysLeft < 0, 'A3 23 h 59 se dit « jour seul » ; dépassée, c\'est un RETARD (limite lue)', JSON.stringify(l2));
  dit(lv.limiteEbay({ lineItems: [{}] }) === null, 'A4 sans shipByDate : aucune limite (rien d\'inventé)');
  dit(lv.transporteurEbay(c1) === 'MONDIAL RELAY', 'A5 le transporteur LU chez eBay (choisi par l\'acheteur), jamais deviné', lv.transporteurEbay(c1));
  dit(lv.transporteurEbay({ fulfillmentStartInstructions: [{}] }) === '', 'A6 aucun transporteur lu ⇒ rien');
  // Le transporteur passe la table de l'app (son logo).
  const tv = await imp('src/transporteursVisuels.js').catch(() => null);
  if (tv) { const t = tv.transporteurDuColis({ declare: lv.transporteurEbay(c1) }); dit(t.cle === 'mondialrelay', 'A7 « MONDIAL_RELAY » d\'eBay ⇒ le logo Mondial Relay de l\'app', t.cle); }
}

// ── B. L'ÉTIQUETTE PAR E-MAIL, PAR N° DE COMMANDE ───────────────────────────
async function sectionB() {
  const lv = await imp('api/_lib/ebay-livraison.js');
  dit(lv.estEtiquetteEbay({ from: 'eBay <ebay@ebay.fr>', subject: 'Votre étiquette d\'expédition pour la commande 12-34567-89012', attachments: [{ filename: 'etiquette.pdf', contentType: 'application/pdf', contentB64: PDF }] }), 'B1 un e-mail d\'eBay avec UN PDF d\'étiquette est reconnu');
  dit(!lv.estEtiquetteEbay({ from: 'Vinted <no-reply@vinted.fr>', subject: 'Votre étiquette 12-34567-89012', attachments: [{ filename: 'a.pdf', contentB64: PDF }] }), 'B2 un autre expéditeur n\'est jamais une étiquette eBay');
  dit(!lv.estEtiquetteEbay({ from: 'ebay@ebay.fr', subject: 'Votre étiquette', attachments: [] }), 'B3 sans PDF : rien n\'est intercepté');
  const deux = lv.lireEtiquetteEbay({ subject: 'Étiquettes 12-34567-89012 et 12-34567-89099', attachments: [{ filename: 'a.pdf', contentB64: PDF }] });
  dit(!deux.ok, 'B4 deux n° de commande ⇒ rien n\'est rangé (jamais deviné)', deux.raison);
  const sans = lv.lireEtiquetteEbay({ subject: 'Votre étiquette Nike Air Max 1 bleu 44', text: 'Nike Air Max 1 bleu 44', attachments: [{ filename: 'a.pdf', contentB64: PDF }] });
  dit(!sans.ok, 'B5 un titre sans n° de commande ⇒ rien n\'est rangé (jamais par le titre)', sans.raison);

  const { fauxInbound, A } = require(path.join(__dirname, '_faux-inbound.cjs'));
  const F = fauxInbound(RACINE);
  F.vider();
  // 50 commandes au MÊME titre : chaque étiquette sous SON n°, son PDF à elle.
  const ids = [];
  for (let i = 0; i < 50; i++) {
    const id = `12-34567-${String(10000 + i)}`; ids.push(id);
    const pdf = Buffer.from(`%PDF-1.4\n% etiquette ${id}\n%%EOF\n`).toString('base64');
    const r = await F.recoit({ from: 'eBay <ebay@ebay.fr>', subject: `Votre étiquette d'expédition eBay pour la commande ${id}`, text: 'Nike Air Max 1 bleu 44 — imprime cette étiquette.', attachments: [{ filename: 'etiquette.pdf', contentType: 'application/pdf', contentB64: pdf }] });
    if (i === 0) dit(r.code === 200 && r.corps && r.corps.type === 'etiquette-ebay' && r.corps.orderId === id, 'B6 la vraie route range l\'étiquette eBay (200, type etiquette-ebay)', JSON.stringify(r.corps));
  }
  const lignes = F.ids(/^email_bordebay_/);
  const parId = new Map(lignes.map((l) => [l.id, l]));
  const tous = ids.every((id) => { const l = parId.get('email_bordebay_' + id); return l && l.owner === A && l.data.orderId === id && Buffer.from(l.data.pdfB64, 'base64').toString().includes(id); });
  dit(lignes.length === 50 && tous, 'B7 50 commandes au même titre ⇒ 50 étiquettes, chacune sous SON n° de commande avec SON PDF (aucune confusion)', `${lignes.length} lignes`);
  F.vider();
  const r2 = await F.recoit({ from: 'eBay <ebay@ebay.fr>', subject: 'Votre étiquette d\'expédition eBay', text: 'Nike Air Max 1 bleu 44', attachments: [{ filename: 'etiquette.pdf', contentType: 'application/pdf', contentB64: PDF }] });
  dit(F.ids(/^email_bordebay_/).length === 0 && F.ids(/^email_inconnu_/).length >= 1 && r2.corps && r2.corps.garde === true, 'B8 sans n° de commande : gardée entière « à vérifier », jamais jetée, rien rangé au hasard', JSON.stringify(r2.corps));
  F.vider();
  F.panne((id) => /^email_bordebay_/.test(id));
  const r3 = await F.recoit({ from: 'eBay <ebay@ebay.fr>', subject: 'Votre étiquette pour la commande 12-34567-89012', attachments: [{ filename: 'etiquette.pdf', contentType: 'application/pdf', contentB64: PDF }] });
  F.panne(null);
  dit(r3.code === 503, 'B9 écriture ratée ⇒ 503 (le service rejoue), jamais 200', String(r3.code));
  // L'app : la ligne du lot devient cochable SEULEMENT avec l'étiquette.
  const lot = await imp('src/lotSelection.js');
  const sansE = lot.ligneLotAutre({ __autre: 'eb', key: 'e:principal:1', x: { orderId: '12-34567-89012', titre: 't' } }, 0);
  const avecE = lot.ligneLotAutre({ __autre: 'eb', key: 'e:principal:1', x: { orderId: '12-34567-89012', titre: 't' }, etiquette: true }, 0);
  dit(sansE.cochable === false && sansE.pdf === false && avecE.cochable === true && avecE.pdf === true && avecE.orderId === '12-34567-89012', 'B10 « Imprimer N bordereaux » : l\'étiquette eBay part avec Vinted, une commande sans étiquette reste grisée');
  const r = lot.resumeLot([avecE, sansE, { cle: 'v:1', site: 'vinted', pdf: true, cochable: true }]);
  dit(r.partent === 2 && r.ebay === 1, 'B11 le nombre du bouton compte Vinted + l\'étiquette eBay reçue', JSON.stringify({ partent: r.partent, ebay: r.ebay }));
}

// ── C. LE SUIVI AUTOMATIQUE ─────────────────────────────────────────────────
async function sectionC() {
  const lv = await imp('api/_lib/ebay-livraison.js');
  const s = lv.suivisDeFulfillments({ fulfillments: [{ fulfillmentId: 'F1', shipmentTrackingNumber: '12345678', shippingCarrierCode: 'MONDIAL_RELAY', shippedDate: '2026-11-27T10:00:00.000Z', shipTo: { fullName: 'NE PAS GARDER' } }] });
  dit(Array.isArray(s) && s.length === 1 && s[0].numero === '12345678' && !JSON.stringify(s).includes('NE PAS GARDER'), 'C1 les n° de suivi lus, des scalaires seulement (aucune adresse)', JSON.stringify(s));
  dit(lv.suivisDeFulfillments({}) === null && lv.suivisDeFulfillments(null) === null, 'C2 une réponse illisible ⇒ null (« pas su »), jamais []');
  const parti = commande('12-34567-89012', { x: { orderFulfillmentStatus: 'FULFILLED', fulfillmentHrefs: ['https://api.ebay.com/sell/fulfillment/v1/order/12-34567-89012/shipping_fulfillment/F1'] } });
  const e1 = lv.etatEnvoiEbay(parti, s, () => null), e2 = lv.etatEnvoiEbay(parti, s, (k) => (k === '12345678' ? 'delivered' : null)), e0 = lv.etatEnvoiEbay(parti, [], () => 'delivered');
  dit(e1 && e1.etat === 'route' && e2 && e2.etat === 'livree' && e0 && e0.etat === 'expediee', 'C3 n° lu ⇒ « En route » ; le transporteur dit livré PAR CE N° ⇒ « Livrée » ; sans n° ⇒ « expédiée » seulement', [e1 && e1.etat, e2 && e2.etat, e0 && e0.etat].join(','));
  dit(lv.etatEnvoiEbay(commande('x'), s) === null, 'C4 une commande pas partie n\'est jamais « en route »');

  // La vraie relecture : faux eBay + fausse base.
  const { fauxInbound, A } = require(path.join(__dirname, '_faux-inbound.cjs'));
  const F = fauxInbound(RACINE); F.vider();
  let appelsSuivi = 0, ebayEnPanne = false;
  const fauxEbay = async (url, opts) => {
    const u = String(url);
    if (/api\.ebay\.com\/sell\/fulfillment\/v1\/order\/[^/]+\/shipping_fulfillment/.test(u)) {
      appelsSuivi++;
      if (ebayEnPanne) return new Response('{}', { status: 500 });
      return new Response(JSON.stringify({ fulfillments: [{ fulfillmentId: 'F1', shipmentTrackingNumber: '12345678', shippingCarrierCode: 'MONDIAL_RELAY', shippedDate: '2026-11-27T10:00:00.000Z' }] }), { status: 200 });
    }
    return F.fauxFetch(url, opts);
  };
  global.fetch = fauxEbay;
  const rl = await imp('api/_lib/ebay-relecture.js');
  global.fetch = fauxEbay;
  const orders = [parti, commande('12-34567-89013')];
  const r1 = await rl.relireSuivisCompte({ owner: A, suffixe: '', token: 'AT', orders });
  const ligne = F.base.get(`${A}|ebay_suivis`);
  dit(r1.ok && appelsSuivi === 1 && ligne && ligne.parCommande && ligne.parCommande['12-34567-89012'] && ligne.parCommande['12-34567-89012'].suivis[0].numero === '12345678' && !ligne.parCommande['12-34567-89013'],
    'C5 la relecture lit getShippingFulfillments de la commande PARTIE seulement et range son n° par n° de commande', JSON.stringify({ r1, appelsSuivi }));
  const r2 = await rl.relireSuivisCompte({ owner: A, suffixe: '', token: 'AT', orders });
  dit(r2.ok && r2.lus === 0 && appelsSuivi === 1, 'C6 un n° déjà rangé n\'est plus relu chez eBay (quota)', JSON.stringify({ r2, appelsSuivi }));
  F.vider(); ebayEnPanne = true; appelsSuivi = 0;
  const r3 = await rl.relireSuivisCompte({ owner: A, suffixe: '', token: 'AT', orders });
  dit(!r3.ok && !F.base.get(`${A}|ebay_suivis`), 'C7 eBay en panne ⇒ rien n\'est écrit (aucune liste vide à la place)', JSON.stringify(r3));
  ebayEnPanne = false;
}

// ── D. AUCUN ACHAT D'ÉTIQUETTE ─────────────────────────────────────────────
const MOTIFS_ACHAT = [/\/sell\/logistics\//i, /shipping_quote/i, /create_from_shipping_quote/i, /download_label_file/i, /createShippingLabel/i];
function sansCommentaires(t) { return t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'); }
function fichiersApi(dir) { const out = []; for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) out.push(...fichiersApi(p)); else if (/\.(m?js|cjs)$/.test(f.name)) out.push(p); } return out; }
async function sectionD() {
  const fd = await imp('api/_lib/fetch-delai.js');
  let appele = false;
  global.fetch = async () => { appele = true; return new Response('{}', { status: 201 }); };
  let refuse = false;
  for (const u of ['https://api.ebay.com/sell/logistics/v1_beta/shipping_quote', 'https://api.ebay.com/sell/logistics/v1_beta/shipment/create_from_shipping_quote', 'https://api.ebay.com/sell/logistics/v1_beta/shipment/S1/download_label_file']) {
    try { await fd.fetchAvecDelai(u, { method: 'POST', body: '{}' }); } catch (e) { refuse = e && e.name === 'AchatEtiquetteInterdit'; if (!refuse) break; continue; }
    refuse = false; break;
  }
  dit(refuse && !appele, 'D1 le seul `fetch` du serveur REFUSE l\'API Logistics d\'eBay (devis, achat, téléchargement) : rien ne part', JSON.stringify({ refuse, appele }));
  appele = false;
  await fd.fetchAvecDelai('https://api.ebay.com/sell/fulfillment/v1/order/1/shipping_fulfillment').catch(() => null);
  dit(appele, 'D2 la LECTURE des expéditions (Fulfillment) passe, elle');
  const coupables = [];
  for (const f of fichiersApi(path.join(RACINE, 'api'))) {
    const rel = path.relative(RACINE, f);
    if (rel === path.join('api', '_lib', 'ebay-livraison.js')) continue;   // la liste des motifs interdits elle-même
    const t = sansCommentaires(fs.readFileSync(f, 'utf8'));
    for (const re of MOTIFS_ACHAT) if (re.test(t)) coupables.push(rel + ' ' + re);
  }
  dit(!coupables.length, 'D3 aucune route ni règle d\'api/ n\'appelle l\'achat d\'une étiquette (createShippingLabel, shipping_quote…)', coupables.join(' ; '));
  const src = sansCommentaires(fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Comptabilite.jsx'), 'utf8'));
  dit(!MOTIFS_ACHAT.some((re) => re.test(src)), 'D4 l\'app non plus');
}

// ── E. LIVRAISON JAMAIS GRATUITE, COLIS PAR DÉFAUT ──────────────────────────
async function sectionE() {
  const pa = await imp('api/_lib/ebay-parametres.js');
  const o = pa.optionsPublication({ price: '80', parametres: { colis: { poids: 1200, longueur: 35, largeur: 24, hauteur: 13 } } });
  const x = pa.xmlOptions(o.options, 'EUR').colis;
  dit(/<ShippingPackageDetails><MeasurementUnit>Metric<\/MeasurementUnit>/.test(x) && /<WeightMajor unit="kg">1<\/WeightMajor><WeightMinor unit="gr">200<\/WeightMinor>/.test(x) && /<PackageLength unit="cm">35</.test(x),
    'E1 le colis par défaut part en poids (1 kg 200 g) et dimensions, unités métriques', x);
  dit(!/ShippingDetails>|FreeShipping|ShippingServiceCost/.test(x.replace(/ShippingPackageDetails/g, '')), 'E2 aucun port, aucun transporteur, jamais « gratuite » dans ce morceau');
  dit(!!pa.optionsPublication({ parametres: { colis: { poids: 10, longueur: 35, largeur: 24, hauteur: 13 } } }).err && !!pa.optionsPublication({ parametres: { colis: { poids: 1200, longueur: 999, largeur: 24, hauteur: 13 } } }).err, 'E3 un poids ou une taille hors bornes ⇒ rien ne part (jamais « corrigé »)');
  const cp = await imp('src/ebay/parametres.js');
  const ps = cp.parametresServeur(cp.DEFAUTS_USINE);
  dit(ps && ps.colis && ps.colis.poids === 1200 && ps.colis.hauteur === 13, 'E4 la boîte à chaussures par défaut est envoyée à chaque nouvelle annonce', JSON.stringify(ps));
  const off = cp.parametresServeur({ ...cp.DEFAUTS_USINE, colis: { ...cp.DEFAUTS_USINE.colis, actif: false } });
  dit(!off || !off.colis, 'E5 éteinte dans Paramètres › eBay : rien n\'est envoyé');
  // La VRAIE route : le XML tel qu'il part (`pubverify`), livraison gérée, aucun <ShippingDetails>.
  const PROPRIO = '11111111-1111-1111-1111-111111111111';
  process.env.VRM_OWNER_UID = PROPRIO; process.env.EBAY_APP_ID = 'app'; process.env.EBAY_CERT_ID = 'cert'; process.env.EBAY_RUNAME = 'ru'; process.env.SUPABASE_SERVICE_KEY = 'svc';
  const envois = [];
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url)); const h = opts.headers || {};
    if (u.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: PROPRIO, email: 'p@exemple.test' }), { status: 200 });
    if (u.includes('identity/v1/oauth2/token')) return new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 7200 }), { status: 200 });
    if (u.includes('/rest/v1/app_data')) { if (/select=owner/.test(u)) return new Response('{"message":"column app_data.owner does not exist"}', { status: 400 }); if (opts.method === 'POST' || opts.method === 'PATCH') return new Response('', { status: 201 }); if (/ebay_tokens/.test(u)) return new Response(JSON.stringify([{ refresh_token: 'RT' }]), { status: 200 }); return new Response('[]', { status: 200 }); }
    if (u.includes('/rest/v1/rpc/')) return new Response('true', { status: 200 });
    if (u.includes('/ws/api.dll')) { const appel = h['X-EBAY-API-CALL-NAME'] || ''; if (/AddFixedPriceItem/.test(appel)) envois.push(String(opts.body || ''));
      if (appel === 'VerifyAddFixedPriceItem') return new Response('<?xml version="1.0"?><r xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack><Fees><Fee><Name>InsertionFee</Name><Fee currencyID="EUR">0.35</Fee></Fee></Fees></r>', { status: 200 });
      return new Response('<?xml version="1.0"?><r xmlns="urn:ebay:apis:eBLBaseComponents"><Ack>Success</Ack></r>', { status: 200 }); }
    return new Response('{}', { status: 200 });
  };
  const mod = await imp('api/ebay.js');
  const faireRes = () => { const r = { code: null, corps: null }; r.status = (c) => { r.code = c; return r; }; r.json = (o2) => { r.corps = o2; return r; }; r.end = () => r; r.setHeader = () => r; return r; };
  const appel = async (body) => { const res = faireRes(); await mod.default({ method: 'POST', query: {}, headers: { authorization: 'Bearer eyJh.banc.sig' }, body }, res); return res; };
  const item = { title: 'Nike Air Max 1 bleu 44', categoryId: '15709', price: '80', quantity: '1', conditionId: '3000', photos: ['https://x.test/1.jpg'], aspects: { Marque: 'Nike' }, ebayGere: true, parametres: ps };
  const v = await appel({ action: 'pubverify', item });
  const corps = envois[envois.length - 1] || '';
  dit(v.code === 200 && /<ShippingPackageDetails>/.test(corps) && !/<ShippingDetails>/.test(corps) && !/FreeShipping/i.test(corps), 'E6 la vraie route : le colis part, livraison GÉRÉE par eBay (aucun <ShippingDetails>, jamais gratuite)', `HTTP ${v.code}`);
  envois.length = 0;
  const g = await appel({ action: 'pubverify', item: { ...item, ebayGere: false, shippingCost: '0' } });
  dit(g.code === 400 && !envois.length, 'E7 un port à 0 en tarif fixe est refusé avant eBay (`livraisonDe`, §2.8)', `HTTP ${g.code}`);
}

// ── F. LE PORT HORS COMPTA ─────────────────────────────────────────────────
async function sectionF() {
  const vr = await imp('api/_lib/ventes-regle.js');
  const lv = await imp('api/_lib/ebay-livraison.js');
  const base = commande('12-34567-89012');
  const sans = vr.montantRecuEbay(base);   // dû = articles (80), frais 10 ⇒ 70
  const avec = vr.montantRecuEbay({ ...base, paymentSummary: { totalDueSeller: { value: '86.50', currency: 'EUR' } } });   // dû = articles + port
  dit(sans.eur === 70 && !sans.portRetire, 'F1 le dû SANS port : l\'argent reçu inchangé (80 − 10 = 70)', JSON.stringify(sans));
  dit(avec.eur === 70 && avec.portRetire === 6.5, 'F2 le dû qui PORTE le port payé par l\'acheteur : le port est retiré (86,50 − 6,50 − 10 = 70), ni recette ni charge', JSON.stringify(avec));
  const p = lv.portAcheteurEbay(base);
  dit(p && p.montant === 6.5 && p.devise === 'EUR', 'F3 le port payé par l\'acheteur se DIT pour info (6,50 €)', JSON.stringify(p));
  const compta = ['src/ecrans/Compta.jsx', 'api/_lib/ventes-regle.js', 'api/_lib/benefice-regle.js', 'api/_lib/urssaf-regle.js'].map((f) => path.join(RACINE, f)).filter((f) => fs.existsSync(f));
  const lit = compta.filter((f) => /portAcheteurEbay/.test(sansCommentaires(fs.readFileSync(f, 'utf8'))));
  dit(!lit.length, 'F4 aucune règle de compta, d\'URSSAF ni de bénéfice ne lit le port de l\'acheteur', lit.join(','));
}

// ── MUTATIONS ──────────────────────────────────────────────────────────────
function copieArbre() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-ebay-liv-'));
  for (const sous of ['api', 'src', 'scripts']) fs.cpSync(path.join(RACINE, sous), path.join(d, sous), { recursive: true, filter: (s) => !/node_modules|\/fx\//.test(s) });
  for (const f of ['package.json']) if (fs.existsSync(path.join(RACINE, f))) fs.copyFileSync(path.join(RACINE, f), path.join(d, f));
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(d, 'node_modules')); } catch (_) {}
  return d;
}
const MUTATIONS = {
  achat: (d) => {
    const g = path.join(d, 'api', '_lib', 'ebay-gestion.js');
    fs.writeFileSync(g, fs.readFileSync(g, 'utf8') + "\nexport async function acheterEtiquette(t){return fetchAvecDelai('https://api.ebay.com/sell/logistics/v1_beta/shipment/create_from_shipping_quote',{method:'POST',headers:{Authorization:'Bearer '+t}});}\n");
    const f = path.join(d, 'api', '_lib', 'fetch-delai.js');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('if (estAchatEtiquette(url))', 'if (false && estAchatEtiquette(url))'));
  },
  titre: (d) => {
    const f = path.join(d, 'api', '_lib', 'ebay-livraison.js');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace("if (ns.length !== 1) return { ok: false, raison: ns.length ? 'plusieurs n° de commande' : 'aucun n° de commande' };", "if (ns.length !== 1) { const t = String(text || subject).slice(0, 20).replace(/[^0-9a-z]/gi, ''); if (!t) return { ok: false, raison: 'aucun' }; ns = [t]; }"));
    const e = path.join(d, 'api', 'email-inbound.js');
    fs.writeFileSync(e, fs.readFileSync(e, 'utf8').replace('id: idEtiquetteEbay(lu.orderId)', "id: 'email_bordebay_' + String(corpsTexte).slice(0, 12).replace(/[^0-9a-z]/gi, '')"));
  },
  port: (d) => {
    const f = path.join(d, 'api', '_lib', 'ventes-regle.js');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('if (pC > 0 && Math.abs(dC - (sC + pC)) < Math.abs(dC - sC)) portC = pC;', ''));
  },
};

(async () => {
  for (const [nom, f] of [['A', sectionA], ['B', sectionB], ['C', sectionC], ['D', sectionD], ['E', sectionE], ['F', sectionF]]) await essaie('section ' + nom, f);
  if (!process.env.RACINE && !process.argv.includes('--sans-mutations')) {
    for (const nom of Object.keys(MUTATIONS)) {
      const d = copieArbre();
      try {
        MUTATIONS[nom](d);
        let rouge = false, sortie = '';
        try { sortie = execFileSync(process.execPath, [path.join(d, 'scripts', 'audit-ebay-livraison.cjs'), '--sans-mutations'], { env: { ...process.env, RACINE: d }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 }); }
        catch (e) { rouge = true; sortie = String(e.stdout || ''); }
        const kos = (sortie.match(/^KO /gm) || []).length;
        dit(rouge && kos > 0, `M mutation « ${nom} » ⇒ ROUGE`, `${kos} contrôle(s) rouge(s)`);
      } finally { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }
    }
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-ebay-livraison : ${n - ko}/${n} verts`);
  process.exit(ko ? 1 : 0);
})();
