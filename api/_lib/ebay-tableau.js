// ── eBAY COMPLET 2 : L'ARGENT, LE TRAFIC, LA SANTÉ DU COMPTE, LES LITIGES (15 nov.) ──
// Julien (15 nov.) : « On a la chance d'avoir l'application dans l'app, je veux que tu
// regardes tout ce que tu peux mettre dedans. » Ce module ajoute, en LECTURE SEULE :
//   · l'ARGENT réel (Finances API, `apiz.ebay.com`, appels SIGNÉS — ebay-signature.js) :
//     solde, versements (date, état, montant), et par commande le net reçu, les frais
//     RÉELS et la date du versement qui l'a payée ⇒ le CA eBay se date au versement ;
//   · le TRAFIC par annonce (Analytics `traffic_report`) : affichages, vues, ventes ⇒
//     « annonces qui ne se voient pas » ;
//   · la SANTÉ du compte (Analytics `seller_standards_profile`, `customer_service_metric`)
//     et les annonces À CORRIGER (Compliance `listing_violation` : caractéristiques
//     manquantes, etc.) ;
//   · les ÉVALUATIONS REÇUES (Trading `GetFeedback`) — aucune relance (refusé le 11 oct.) ;
//   · les LITIGES : litiges de paiement (Fulfillment `payment_dispute_summary`),
//     réclamations « objet non reçu » (Post-Order `inquiry/search`) et cas ouverts
//     (`casemanagement/search`) — lecture, le geste se fait chez eBay (lien).
// Rien n'écrit chez eBay ici. Rien n'est payant. Aucune donnée d'acheteur n'est rangée
// (le pseudo d'un évaluateur est rendu à l'écran, jamais écrit en base).
// Règles de toujours : « pas su » ≠ 0 (une lecture ratée rend `null` + la raison, jamais
// `[]`), autre devise ÉCARTÉE et dite (jamais convertie), droit manquant ⇒ « reconnecte »,
// signature manquante ⇒ dit à part (ce n'est pas le même geste).
// ⚠️ NON MESURÉ : chemins et formes viennent de la documentation d'eBay (pages citées à
// chaque lecteur) ; aucune réponse réelle n'a été vue (aucune commande eBay en base).
import { entetesSignes, refusSignature } from './ebay-signature.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { offresEbay } from './ebay-gestion.js';

const liste = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const texte = (v) => (v == null ? '' : typeof v === 'object' ? String(v['#text'] ?? v.value ?? '') : String(v));
const ID = /^\d{1,24}$/;
const ID_COMMANDE = /^[A-Za-z0-9-]{1,64}$/;
const dateIso = (v) => { const s = v && typeof v === 'object' ? (v.value || v.formattedValue || '') : v; const t = typeof s === 'string' ? Date.parse(s) : NaN; return Number.isFinite(t) ? new Date(t).toISOString() : null; };
// Un montant lu : `{ v: nombre, c: 'EUR' }`, sinon null (jamais 0).
const montant = (m) => {
  if (!m || typeof m !== 'object') return null;
  const v = Number(String(m.value ?? '').replace(',', '.'));
  const c = String(m.currency || '');
  return Number.isFinite(v) && /^[A-Z]{3}$/.test(c) && String(m.value ?? '').trim() !== '' ? { v: Math.round(v * 100) / 100, c } : null;
};
const nombre = (v) => { const x = v && typeof v === 'object' ? (v.value ?? v.amount) : v; const n = Number(x); return x !== '' && x != null && Number.isFinite(n) ? n : null; };

// ═══ L'ARGENT (Finances API) ═════════════════════════════════════════════════
// getSellerFundsSummary — developer.ebay.com/api-docs/sell/finances/resources/seller_funds_summary/methods/getSellerFundsSummary
export function soldeEbay(d) {
  if (!d || typeof d !== 'object') return null;
  const dispo = montant(d.availableFunds), total = montant(d.totalFunds);
  if (!dispo && !total) return null;
  return { dispo, enCours: montant(d.processingFunds), retenu: montant(d.fundsOnHold), total };
}
// getPayouts — developer.ebay.com/api-docs/sell/finances/resources/payout/methods/getPayouts
// États : INITIATED (lancé), SUCCEEDED (arrivé), RETRYABLE_FAILED, TERMINAL_FAILED, REVERSED.
export function versementsEbay(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.payouts)) return null;
  return d.payouts.map((p) => ({
    id: String((p && p.payoutId) || ''),
    statut: String((p && p.payoutStatus) || '').toUpperCase(),
    date: dateIso(p && p.payoutDate),
    montant: montant(p && p.amount),
    n: Number.isInteger(p && p.transactionCount) ? p.transactionCount : null,
    // Le moyen de versement : son type et les 4 derniers chiffres seulement (jamais un IBAN).
    vers: p && p.payoutInstrument ? [String(p.payoutInstrument.instrumentType || ''), /^\d{4}$/.test(String(p.payoutInstrument.accountLastFourDigits || '')) ? '•••• ' + p.payoutInstrument.accountLastFourDigits : ''].filter(Boolean).join(' ') : '',
  })).filter((p) => /^[A-Za-z0-9-]{1,64}$/.test(p.id));
}
// getTransactions — developer.ebay.com/api-docs/sell/finances/resources/transaction/methods/getTransactions
// Une vente (SALE) : `amount` = ce qui t'est crédité (frais déduits), `totalFeeAmount` =
// les frais d'eBay de CETTE vente, `payoutId` = le versement qui l'a payée (absent tant
// que l'argent n'est pas parti). Les frais hors vente (NON_SALE_CHARGE : sponsorisation,
// options d'annonce…) sont comptés à part. Aucun champ `buyer` n'est gardé.
export function transactionsEbay(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.transactions)) return null;
  return d.transactions.map((t) => ({
    id: String((t && t.transactionId) || ''),
    type: String((t && t.transactionType) || '').toUpperCase(),
    sens: String((t && t.bookingEntry) || '').toUpperCase(),
    orderId: ID_COMMANDE.test(String((t && t.orderId) || '')) ? String(t.orderId) : '',
    payoutId: /^[A-Za-z0-9-]{1,64}$/.test(String((t && t.payoutId) || '')) ? String(t.payoutId) : '',
    montant: montant(t && t.amount),
    frais: montant(t && t.totalFeeAmount),
    base: montant(t && t.totalFeeBasisAmount),
    date: dateIso(t && t.transactionDate),
    statut: String((t && t.transactionStatus) || '').toUpperCase(),
    fraisType: String((t && t.feeType) || '').toUpperCase(),
  })).filter((t) => t.id && t.type);
}
// Par commande : le net, les frais réels, la date du versement (SUCCEEDED seulement : un
// versement lancé n'est pas encore arrivé ; « pas su » ≠ « versé »). Un remboursement
// (REFUND) sur la commande la marque `rembourse` : son net n'est plus sûr ⇒ `sur:false`.
export function parCommande(transactions, versements) {
  const pv = new Map((versements || []).map((p) => [p.id, p]));
  const out = {};
  for (const t of (transactions || [])) {
    if (!t.orderId) continue;
    const c = out[t.orderId] || (out[t.orderId] = { net: null, frais: null, devise: null, payoutId: '', versement: null, statut: '', rembourse: false, autresFrais: 0, sur: true });
    if (t.type === 'SALE') {
      if (!t.montant) { c.sur = false; continue; }
      if (c.devise && c.devise !== t.montant.c) { c.sur = false; continue; }
      c.devise = t.montant.c;
      c.net = Math.round(((c.net || 0) + (t.sens === 'DEBIT' ? -t.montant.v : t.montant.v)) * 100) / 100;
      if (t.frais && t.frais.c === c.devise) c.frais = Math.round(((c.frais || 0) + t.frais.v) * 100) / 100; else if (!t.frais) c.sur = false;
      if (t.payoutId) {
        c.payoutId = t.payoutId;
        const p = pv.get(t.payoutId);
        c.statut = p ? p.statut : '';
        c.versement = p && p.statut === 'SUCCEEDED' ? p.date : null;
      }
    } else if (t.type === 'REFUND' || t.type === 'DISPUTE') {
      c.rembourse = true; c.sur = false;
    } else if (t.type === 'NON_SALE_CHARGE' && t.montant && (!c.devise || c.devise === t.montant.c)) {
      c.autresFrais = Math.round((c.autresFrais + t.montant.v) * 100) / 100;
    }
  }
  return out;
}
// Les frais qui ne sont pas ceux d'une vente (sponsorisation, options…) : un total par
// devise et par type ; une autre devise n'est JAMAIS additionnée à l'euro.
export function fraisHorsVente(transactions) {
  const parDevise = {};
  for (const t of (transactions || [])) {
    if (t.type !== 'NON_SALE_CHARGE' || !t.montant) continue;
    const d = parDevise[t.montant.c] || (parDevise[t.montant.c] = { total: 0, n: 0, types: {} });
    const s = t.sens === 'CREDIT' ? -t.montant.v : t.montant.v;
    d.total = Math.round((d.total + s) * 100) / 100; d.n++;
    const k = t.fraisType || 'AUTRE'; d.types[k] = Math.round(((d.types[k] || 0) + s) * 100) / 100;
  }
  return parDevise;
}
// La ligne rangée pour l'app (`ebay_versements{suffixe}`) : seulement des dates et des
// montants, par n° de commande — jamais un acheteur. `dates` est la carte COMPACTE que
// le CA déclaré lit (`select=d:data->dates`, §4.4). Fusion avec la ligne d'avant : une
// date déjà lue n'est jamais effacée par une lecture qui ne la couvre plus (fenêtre de
// 90 jours) ; bornée à 3 000 commandes (les plus récentes gardées).
export function ligneVersements(avant, { commandes, versements, solde, hors, depuis, maintenant = Date.now() }) {
  const a = avant && typeof avant === 'object' ? avant : {};
  const dates = { ...(a.dates && typeof a.dates === 'object' ? a.dates : {}) };
  const detail = { ...(a.commandes && typeof a.commandes === 'object' ? a.commandes : {}) };
  for (const [id, c] of Object.entries(commandes || {})) {
    if (!ID_COMMANDE.test(id)) continue;
    detail[id] = { net: c.net, frais: c.frais, devise: c.devise, versement: c.versement, statut: c.statut, rembourse: !!c.rembourse, sur: !!c.sur, autresFrais: c.autresFrais || 0 };
    if (c.versement && c.sur && !c.rembourse) dates[id] = c.versement.slice(0, 10);
    else if (c.rembourse) delete dates[id];
  }
  const borne = (o) => { const k = Object.keys(o); if (k.length <= 3000) return o; const g = k.sort((x, y) => String(o[y] && o[y].versement || o[y]).localeCompare(String(o[x] && o[x].versement || o[x]))).slice(0, 3000); return Object.fromEntries(g.map((x) => [x, o[x]])); };
  return { dates: borne(dates), commandes: borne(detail), versements: (versements || []).slice(0, 60), solde: solde || null, horsVente: hors || {}, depuis: depuis || null, capturedAt: maintenant, rev: (Number(a.rev) || 0) + 1 };
}

// ═══ LE TRAFIC (Analytics API) ════════════════════════════════════════════════
// getTrafficReport — developer.ebay.com/api-docs/sell/analytics/resources/traffic_report/methods/getTrafficReport
// Les valeurs d'un enregistrement sont dans l'ordre de `header.metrics` : on lit par CLÉ
// (jamais par position supposée). `applicable:false` ⇒ null (« pas su »), jamais 0.
export const METRIQUES_TRAFIC = ['LISTING_IMPRESSION_TOTAL', 'LISTING_VIEWS_TOTAL', 'TRANSACTION'];
export function traficEbay(d) {
  if (!d || typeof d !== 'object' || !d.header || !Array.isArray(d.header.metrics)) return null;
  const cles = d.header.metrics.map((m) => String((m && m.key) || ''));
  const titres = new Map();
  for (const dm of liste(d.dimensionMetadata)) for (const r of liste(dm && dm.metadataRecords)) {
    const id = texte(r && r.value); const t = texte(liste(r && r.metadataValues)[0]);
    if (ID.test(id) && t) titres.set(id, t.slice(0, 120));
  }
  const lignes = [];
  for (const r of liste(d.records)) {
    const id = texte(liste(r && r.dimensionValues)[0]);
    if (!ID.test(id)) continue;
    const vals = liste(r && r.metricValues);
    const lu = (k) => { const i = cles.indexOf(k); const x = i >= 0 ? vals[i] : null; return x && x.applicable !== false ? nombre(x) : null; };
    lignes.push({ itemId: id, titre: titres.get(id) || '', affichages: lu('LISTING_IMPRESSION_TOTAL'), vues: lu('LISTING_VIEWS_TOTAL'), ventes: lu('TRANSACTION') });
  }
  return { debut: dateIso(d.startDate), fin: dateIso(d.endDate), majLe: dateIso(d.lastUpdatedDate), annonces: lignes };
}
// « Annonces qui ne se voient pas » : en ligne depuis au moins 7 jours ET moins de
// 50 affichages sur la période (ou 0 vue). Une annonce ABSENTE du rapport n'est pas
// « 0 » (eBay peut ne pas l'avoir encore comptée) : elle est dite « pas de chiffres ».
// Chaque ligne du rapport reçoit ce que VRM sait de l'annonce rangée (photo d'eBay, SKU
// `VRM-{n°}`, date de mise en ligne) — par son n° d'annonce, jamais par le titre (§5).
export function enrichirTrafic(trafic, enLigne) {
  if (!trafic || !Array.isArray(trafic.annonces) || !Array.isArray(enLigne)) return trafic;
  const par = new Map(enLigne.filter((a) => a && ID.test(String(a.itemId || ''))).map((a) => [String(a.itemId), a]));
  return { ...trafic, annonces: trafic.annonces.map((t) => { const a = par.get(t.itemId); if (!a) return { ...t, enLigne: false }; return { ...t, enLigne: true, titre: t.titre || String(a.titre || '').slice(0, 120), photo: /^https:\/\/i\.ebayimg\.com\//.test(String(a.photo || '')) ? a.photo : '', sku: String(a.sku || '').slice(0, 40), debut: a.debut || '' }; }) };
}
export function annoncesInvisibles(trafic, enLigne, maintenant = Date.now()) {
  if (!trafic || !Array.isArray(trafic.annonces) || !Array.isArray(enLigne)) return null;
  const par = new Map(trafic.annonces.map((a) => [a.itemId, a]));
  const out = [], sansChiffres = [];
  for (const a of enLigne) {
    const id = String((a && a.itemId) || '');
    if (!ID.test(id)) continue;
    const debut = Date.parse((a && (a.startTime || a.debut)) || '');
    if (Number.isFinite(debut) && maintenant - debut < 7 * 86400000) continue;
    const t = par.get(id);
    if (!t) { sansChiffres.push(id); continue; }
    if ((t.affichages != null && t.affichages < 50) || t.vues === 0) out.push({ ...t });
  }
  out.sort((x, y) => (x.affichages ?? 0) - (y.affichages ?? 0));
  return { invisibles: out, sansChiffres };
}

// ═══ LA SANTÉ DU COMPTE (Analytics API) ═══════════════════════════════════════
// getSellerStandardsProfiles — developer.ebay.com/api-docs/sell/analytics/resources/seller_standards_profile/methods/findSellerStandardsProfiles
// Niveaux : TOP_RATED (vendeur Top Fiabilité), ABOVE_STANDARD, BELOW_STANDARD.
export const NIVEAUX = ['TOP_RATED', 'ABOVE_STANDARD', 'BELOW_STANDARD'];
const valeurMetrique = (v) => {
  if (v == null) return null;
  if (typeof v === 'number' || typeof v === 'string') return nombre(v);
  if (typeof v === 'object') {
    if (v.value != null) return nombre(v.value);
    const n = nombre(v.numerator), dd = nombre(v.denominator);
    if (n != null && dd) return n / dd;
  }
  return null;
};
export function santeVendeur(d) {
  if (!d || typeof d !== 'object') return null;
  if (!Array.isArray(d.standardsProfiles)) return Object.keys(d).length === 0 ? { niveau: null, programme: '', metriques: [] } : null;   // 204 : pas encore évalué
  const profils = d.standardsProfiles.filter((p) => p && NIVEAUX.includes(String(p.standardsLevel || '').toUpperCase()));
  const courants = profils.filter((p) => String((p.cycle && p.cycle.cycleType) || '').toUpperCase() === 'CURRENT');
  const p = courants.find((x) => x.defaultProgram) || courants[0] || profils[0];
  if (!p) return { niveau: null, programme: '', metriques: [] };
  const projete = profils.find((x) => x.program === p.program && String((x.cycle && x.cycle.cycleType) || '').toUpperCase() === 'PROJECTED');
  return {
    niveau: String(p.standardsLevel).toUpperCase(),
    programme: String(p.program || ''),
    evalueLe: dateIso(p.cycle && p.cycle.evaluationDate),
    prevu: projete ? String(projete.standardsLevel || '').toUpperCase() || null : null,
    metriques: liste(p.metrics).map((m) => ({
      cle: String((m && m.metricKey) || ''), nom: String((m && m.name) || '').slice(0, 80),
      valeur: valeurMetrique(m && m.value), niveau: String((m && m.level) || '').toUpperCase(),
      seuil: valeurMetrique(m && (m.thresholdUpperBound ?? m.thresholdLowerBound)),
      type: String((m && m.type) || '').toUpperCase(),
    })).filter((m) => m.cle),
  };
}
// getCustomerServiceMetric — developer.ebay.com/api-docs/sell/analytics/resources/customer_service_metric/methods/getCustomerServiceMetric
// La note d'eBay par rapport aux vendeurs comparables : LOW, AVERAGE, HIGH, VERY_HIGH
// (HIGH et VERY_HIGH = trop de réclamations : à surveiller).
export const NOTES_SERVICE = ['LOW', 'AVERAGE', 'HIGH', 'VERY_HIGH'];
export function serviceClient(d) {
  if (!d || typeof d !== 'object') return null;
  if (!Array.isArray(d.dimensionMetrics)) return Object.keys(d).length === 0 ? { note: null, lignes: [] } : null;   // 204 : rien à comparer
  let pire = null;
  const lignes = [];
  for (const dm of d.dimensionMetrics) {
    const nom = String((dm && dm.dimension && (dm.dimension.name || dm.dimension.value)) || '').slice(0, 80);
    for (const m of liste(dm && dm.metrics)) {
      const note = String((m && m.benchmark && m.benchmark.rating) || '').toUpperCase();
      if (!NOTES_SERVICE.includes(note)) continue;
      if (!/^RATE_/.test(String((m && m.metricKey) || ''))) continue;
      lignes.push({ nom, note, valeur: nombre(m && m.value) });
      if (pire == null || NOTES_SERVICE.indexOf(note) > NOTES_SERVICE.indexOf(pire)) pire = note;
    }
  }
  return { note: pire, lignes: lignes.slice(0, 20) };
}
// Compliance — getListingViolationsSummary / getListingViolations :
// developer.ebay.com/api-docs/sell/compliance/resources/listing_violation_summary/methods/getListingViolationsSummary
// developer.ebay.com/api-docs/sell/compliance/resources/listing_violation/methods/getListingViolations
export function resumeConformite(d) {
  if (!d || typeof d !== 'object') return null;
  if (!Array.isArray(d.violationSummaries)) return Object.keys(d).length === 0 ? [] : null;   // 204/vide : aucune
  return d.violationSummaries.map((s) => ({ type: String((s && s.complianceType) || '').toUpperCase(), n: Number.isInteger(s && s.listingCount) ? s.listingCount : null }))
    .filter((s) => /^[A-Z_]{3,40}$/.test(s.type));
}
export function violationsEbay(d) {
  if (!d || typeof d !== 'object') return null;
  if (!Array.isArray(d.listingViolations)) return Object.keys(d).length === 0 ? [] : null;
  return d.listingViolations.map((l) => ({
    itemId: ID.test(String((l && l.listingId) || '')) ? String(l.listingId) : '',
    sku: String((l && l.sku) || '').slice(0, 50),
    type: String((l && l.complianceType) || '').toUpperCase(),
    problemes: liste(l && l.violations).map((v) => ({
      code: String((v && v.reasonCode) || '').slice(0, 60),
      message: String((v && v.message) || '').replace(/\s+/g, ' ').slice(0, 300),
      // Les caractéristiques que eBay nomme (`violationData`) et ce qu'il suggère.
      manque: liste(v && v.violationData).map((x) => String((x && (x.value || x.name)) || '').slice(0, 60)).filter(Boolean).slice(0, 8),
      suggestions: liste(v && v.correctiveRecommendations && v.correctiveRecommendations.aspectRecommendations)
        .map((a) => ({ nom: String((a && a.localizedAspectName) || '').slice(0, 60), valeurs: liste(a && a.suggestedValues).map((x) => String(x).slice(0, 60)).slice(0, 5) })).filter((a) => a.nom).slice(0, 8),
      etat: String((v && v.complianceState) || '').toUpperCase(),
      // (2e tour) Le produit du catalogue que eBay propose (PRODUCT_ADOPTION), s'il y en a un.
      epid: /^\d{1,20}$/.test(String((v && v.correctiveRecommendations && v.correctiveRecommendations.productRecommendation && v.correctiveRecommendations.productRecommendation.epid) || '')) ? String(v.correctiveRecommendations.productRecommendation.epid) : '',
    })),
  })).filter((l) => l.itemId);
}

// ═══ LES ÉVALUATIONS REÇUES (Trading GetFeedback) ═════════════════════════════
// developer.ebay.com/devzone/xml/docs/reference/ebay/GetFeedback.html
// `root` : la réponse lue par `lireXmlEbay(xml, 'GetFeedback')`.
export function evaluationsRecues(root) {
  if (!root || typeof root !== 'object') return null;
  const det = liste(root.FeedbackDetailArray && root.FeedbackDetailArray.FeedbackDetail);
  const score = nombre(texte(root.FeedbackScore));
  const resume = root.FeedbackSummary || {};
  const periode = (nom) => {
    const p = liste(resume[nom] && resume[nom].FeedbackPeriod).find((x) => texte(x && x.PeriodInDays) === '365') || liste(resume[nom] && resume[nom].FeedbackPeriod).slice(-1)[0];
    return p ? nombre(texte(p.Count)) : null;
  };
  return {
    score,
    pourcent: nombre(texte(resume.PositiveFeedbackPercent || root.PositiveFeedbackPercent)),
    an: { positives: periode('PositiveFeedbackPeriodArray'), neutres: periode('NeutralFeedbackPeriodArray'), negatives: periode('NegativeFeedbackPeriodArray') },
    dernieres: det.map((f) => ({
      id: texte(f.FeedbackID),
      type: texte(f.CommentType),
      texte: texte(f.CommentText).replace(/\s+/g, ' ').slice(0, 500),
      date: dateIso(texte(f.CommentTime)),
      itemId: ID.test(texte(f.ItemID)) ? texte(f.ItemID) : '',
      titre: texte(f.ItemTitle).slice(0, 120),
      de: texte(f.CommentingUser).slice(0, 64),
      reponse: !!texte(f.FeedbackResponse),
      role: texte(f.Role),
    })).filter((f) => f.id && /^(Positive|Neutral|Negative)$/.test(f.type)).slice(0, 25),
  };
}

// ═══ LES LITIGES (lecture) ═════════════════════════════════════════════════════
// getPaymentDisputeSummaries — developer.ebay.com/api-docs/sell/fulfillment/resources/payment_dispute/methods/getPaymentDisputeSummaries
export function litigesPaiement(d) {
  if (!d || typeof d !== 'object') return null;
  if (!Array.isArray(d.paymentDisputeSummaries)) return d.total === 0 || Object.keys(d).length === 0 ? [] : null;
  return d.paymentDisputeSummaries.map((x) => ({
    id: String((x && x.paymentDisputeId) || ''), orderId: ID_COMMANDE.test(String((x && x.orderId) || '')) ? String(x.orderId) : '',
    motif: String((x && x.reason) || '').toUpperCase(), etat: String((x && x.paymentDisputeStatus) || '').toUpperCase(),
    ouvertLe: dateIso(x && x.openDate), repondreAvant: dateIso(x && x.respondByDate), montant: montant(x && x.amount),
  })).filter((x) => /^[A-Za-z0-9-]{1,64}$/.test(x.id));
}
// Post-Order : inquiry/search et casemanagement/search —
// developer.ebay.com/devzone/post-order/post-order_v2_inquiry_search__get.html
// developer.ebay.com/devzone/post-order/post-order_v2_casemanagement_search__get.html
export function reclamationsEbay(d, sorte) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.members)) return null;
  return d.members.map((m) => ({
    sorte,
    id: String((m && (sorte === 'cas' ? m.caseId : m.inquiryId)) || ''),
    itemId: ID.test(String((m && m.itemId) || '')) ? String(m.itemId) : '',
    etat: String((m && (m.inquiryStatusEnum || m.caseStatusEnum || m.status)) || '').toUpperCase(),
    ouvertLe: dateIso(m && m.creationDate), repondreAvant: dateIso(m && (m.respondByDate || m.sellerMakeItRightByDate)),
    montant: montant(m && m.claimAmount),
  })).filter((x) => /^\d{1,24}$/.test(x.id));
}
export const LITIGE_OUVERT = /^(OPEN|ACTION_NEEDED|UNDER_REVIEW|WAITING_SELLER_RESPONSE|WAITING_FOR_SELLER|PENDING|ESCALATED|CS_CLOSED_WAITING|WAITING_BUYER_RESPONSE)$/;

// ═══ LA ROUTE (actions `argent`, `trafic`, `sante`, `evaluationsrecues`, `litiges`, `tableau`) ═
export function creerTableauEbay({ accessToken, tradingCall, lireXml, apiOrigin = 'https://api.ebay.com', apizOrigin = 'https://apiz.ebay.com', marketplace = 'EBAY_FR', signe = () => null, fetcher = (...a) => fetchAvecDelai(...a), ranger = null, lire = null, lireMessages = null, maintenant = () => Date.now() }) {
  const mk = () => (typeof marketplace === 'function' ? marketplace() : marketplace);
  const echec = (error, status, reason) => ({ status, body: { ok: false, error, ...(reason ? { reason } : {}) } });
  const jeton = async (ctx) => { const r = await accessToken(ctx); return r && r.ok && r.token ? r : { ko: echec((r && r.error) || 'Compte eBay indisponible.', (r && r.status) || 502, r && r.reason) }; };
  async function json(url, token, { iaf = false, signer = false } = {}) {
    try {
      const h = { Authorization: (iaf ? 'IAF ' : 'Bearer ') + token, Accept: 'application/json', 'X-EBAY-C-MARKETPLACE-ID': mk(), 'Accept-Language': 'fr-FR' };
      Object.assign(h, signer ? entetesSignes(signe(), { methode: 'GET', url, maintenant: maintenant() }) : {});
      const r = await fetcher(url, { method: 'GET', headers: h, signal: AbortSignal.timeout(10000) });
      const raw = await r.text().catch(() => '');
      let data = null; try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
      return { status: r.status, ok: r.status >= 200 && r.status < 300, data, raw: raw.slice(0, 400) };
    } catch (_) { return { status: 0, ok: false, data: null }; }
  }
  // Une lecture ratée : la RAISON d'abord (signature, droit, eBay muet), jamais « vide ».
  const raison = (r, quoi, signer) => {
    if (signer && refusSignature(r)) return { raison: signe() ? 'signature-refusee' : 'signature', erreur: signe() ? `eBay a refusé la signature de VRM pour ${quoi}.` : `eBay exige une signature numérique pour ${quoi} (vendeurs de l'Union européenne) — elle n'est pas encore posée sur VRM.` };
    if (r.status === 401 || r.status === 403) return { raison: 'scope', erreur: `eBay n'a pas autorisé VRM à lire ${quoi}. Reconnecte ton compte eBay pour donner ce droit.` };
    if (r.status === 0) return { raison: 'injoignable', erreur: 'eBay injoignable.' };
    return { raison: 'pas-su', erreur: `eBay n'a pas rendu ${quoi}.` };
  };
  const jour = (t) => new Date(t).toISOString().slice(0, 10);

  // ── L'argent : solde + versements (90 j) + transactions (90 j, 3 pages de 200 au plus).
  async function lireArgent(token, { leger = false } = {}) {
    const fin = maintenant(), debut = fin - 90 * 86400000;
    const plage = `[${new Date(debut).toISOString()}..${new Date(fin).toISOString()}]`;
    const [s, p] = await Promise.all([
      json(`${apizOrigin}/sell/finances/v1/seller_funds_summary`, token, { signer: true }),
      json(`${apizOrigin}/sell/finances/v1/payout?filter=${encodeURIComponent('payoutDate:' + plage)}&limit=50&sort=payoutDate`, token, { signer: true }),
    ]);
    const out = { solde: null, versements: null, transactions: null, raison: null, erreur: null };
    if (s.ok) out.solde = soldeEbay(s.data); else Object.assign(out, (() => { const x = raison(s, 'ton solde eBay', true); return { raison: x.raison, erreur: x.erreur }; })());
    if (p.ok) out.versements = versementsEbay(p.data); else if (!out.raison) { const x = raison(p, 'tes versements eBay', true); out.raison = x.raison; out.erreur = x.erreur; }
    if (leger || out.raison) return out;
    const tr = [];
    let url = `${apizOrigin}/sell/finances/v1/transaction?filter=${encodeURIComponent('transactionDate:' + plage)}&limit=200`;
    for (let page = 0; page < 3 && url; page++) {
      const r = await json(url, token, { signer: true });
      if (!r.ok) { const x = raison(r, 'le détail de tes ventes eBay', true); out.raison = x.raison; out.erreur = x.erreur; return out; }
      const l = transactionsEbay(r.data);
      if (!l) { out.raison = 'illisible'; out.erreur = "Réponse d'eBay illisible pour le détail des ventes."; return out; }
      tr.push(...l);
      url = r.data && typeof r.data.next === 'string' && r.data.next.startsWith(apizOrigin + '/sell/finances/') ? r.data.next : '';
    }
    out.transactions = tr;
    out.complet = !url;
    out.depuis = new Date(debut).toISOString();
    return out;
  }
  async function argent(b, ctx) {
    const a = await jeton(ctx); if (a.ko) return a.ko;
    const r = await lireArgent(a.token);
    if (r.raison) return { status: 200, body: { ok: false, reason: r.raison, error: r.erreur, solde: r.solde, versements: r.versements } };
    const commandes = parCommande(r.transactions, r.versements);
    const hors = fraisHorsVente(r.transactions);
    let range = null;
    if (ranger) range = await ranger(ctx, (avant) => ligneVersements(avant, { commandes, versements: r.versements, solde: r.solde, hors, depuis: r.depuis, maintenant: maintenant() }));
    return { status: 200, body: { ok: true, solde: r.solde, versements: r.versements, commandes, horsVente: hors, complet: r.complet !== false, depuis: r.depuis, range: range === true ? true : range === false ? false : null } };
  }
  // ── Le trafic : 30 jours, jusqu'à hier (eBay compte avec un jour de retard).
  async function lireTrafic(token) {
    const fin = maintenant() - 86400000, debut = fin - 29 * 86400000;
    const f = `marketplace_ids:{${mk()}},date_range:[${jour(debut).replace(/-/g, '')}..${jour(fin).replace(/-/g, '')}]`;
    const r = await json(`${apiOrigin}/sell/analytics/v1/traffic_report?dimension=LISTING&filter=${encodeURIComponent(f)}&metric=${METRIQUES_TRAFIC.join(',')}&sort=-LISTING_IMPRESSION_TOTAL`, token);
    if (!r.ok) return { ko: raison(r, 'le trafic de tes annonces') };
    const t = traficEbay(r.data);
    return t ? { trafic: t } : { ko: { raison: 'illisible', erreur: "Réponse d'eBay illisible pour le trafic." } };
  }
  async function trafic(b, ctx) {
    const a = await jeton(ctx); if (a.ko) return a.ko;
    const r = await lireTrafic(a.token);
    if (r.ko) return { status: 200, body: { ok: false, reason: r.ko.raison, error: r.ko.erreur } };
    const enLigne = lire ? await lire(ctx).catch(() => undefined) : undefined;
    const t = enrichirTrafic(r.trafic, enLigne);
    return { status: 200, body: { ok: true, ...t, invisibles: Array.isArray(enLigne) ? annoncesInvisibles(t, enLigne, maintenant()) : null } };
  }
  // ── La santé : niveau vendeur, réclamations comparées, annonces à corriger.
  async function lireSante(token) {
    const [p, inad, inr, conf] = await Promise.all([
      json(`${apiOrigin}/sell/analytics/v1/seller_standards_profile`, token),
      json(`${apiOrigin}/sell/analytics/v1/customer_service_metric/ITEM_NOT_AS_DESCRIBED/CURRENT?evaluation_marketplace_id=${mk()}`, token),
      json(`${apiOrigin}/sell/analytics/v1/customer_service_metric/ITEM_NOT_RECEIVED/CURRENT?evaluation_marketplace_id=${mk()}`, token),
      json(`${apiOrigin}/sell/compliance/v1/listing_violation_summary`, token),
    ]);
    const lu = (r, f, quoi) => (r.ok ? (f(r.status === 204 ? {} : r.data) ?? { ko: { raison: 'illisible', erreur: `Réponse d'eBay illisible pour ${quoi}.` } }) : { ko: raison(r, quoi) });
    const out = { niveau: lu(p, santeVendeur, 'ton niveau de vendeur'), nonConforme: lu(inad, serviceClient, 'les réclamations « pas conforme »'), nonRecu: lu(inr, serviceClient, 'les réclamations « pas reçu »'), conformite: lu(conf, resumeConformite, 'les annonces à corriger') };
    // Le détail des annonces à corriger : seulement les types qui en ont (3 au plus).
    if (Array.isArray(out.conformite)) {
      const types = out.conformite.filter((x) => x.n > 0).slice(0, 3);
      const det = await Promise.all(types.map((x) => json(`${apiOrigin}/sell/compliance/v1/listing_violation?compliance_type=${encodeURIComponent(x.type)}&limit=50`, token)));
      out.aCorriger = det.every((r) => r.ok || r.status === 204) ? det.flatMap((r) => violationsEbay(r.status === 204 ? {} : r.data) || []) : null;
    }
    return out;
  }
  async function sante(b, ctx) {
    const a = await jeton(ctx); if (a.ko) return a.ko;
    return { status: 200, body: { ok: true, ...(await lireSante(a.token)) } };
  }
  async function lireEvaluations(token) {
    const r = await tradingCall(token, 'GetFeedback', '<FeedbackType>FeedbackReceivedAsSeller</FeedbackType><DetailLevel>ReturnAll</DetailLevel><Pagination><EntriesPerPage>25</EntriesPerPage><PageNumber>1</PageNumber></Pagination>');
    if (!r || !r.ok) return { ko: { raison: r && r.status === 0 ? 'injoignable' : 'pas-su', erreur: "eBay n'a pas rendu tes évaluations." } };
    const e = evaluationsRecues(lireXml(r.xml, 'GetFeedback'));
    return e ? { evaluations: e } : { ko: { raison: 'illisible', erreur: "Réponse d'eBay illisible pour tes évaluations." } };
  }
  async function evaluationsrecues(b, ctx) {
    const a = await jeton(ctx); if (a.ko) return a.ko;
    const r = await lireEvaluations(a.token);
    return { status: 200, body: r.ko ? { ok: false, reason: r.ko.raison, error: r.ko.erreur } : { ok: true, ...r.evaluations } };
  }
  async function lireLitiges(token) {
    const [p, i, c] = await Promise.all([
      json(`${apizOrigin}/sell/fulfillment/v1/payment_dispute_summary?limit=50`, token),
      json(`${apiOrigin}/post-order/v2/inquiry/search?limit=25`, token, { iaf: true }),
      json(`${apiOrigin}/post-order/v2/casemanagement/search?limit=25`, token, { iaf: true }),
    ]);
    const lu = (r, f, quoi) => (r.ok ? (r.status === 204 ? [] : (f(r.data) ?? { ko: { raison: 'illisible', erreur: `Réponse d'eBay illisible pour ${quoi}.` } })) : { ko: raison(r, quoi) });
    return { paiement: lu(p, litigesPaiement, 'les litiges de paiement'), reclamations: lu(i, (d) => reclamationsEbay(d, 'reclamation'), 'les réclamations'), cas: lu(c, (d) => reclamationsEbay(d, 'cas'), 'les cas ouverts') };
  }
  async function litiges(b, ctx) {
    const a = await jeton(ctx); if (a.ko) return a.ko;
    return { status: 200, body: { ok: true, ...(await lireLitiges(a.token)) } };
  }
  // Les offres d'acheteurs EN ATTENTE (Trading GetBestOffers, Active) : un nombre, lu.
  async function lireOffres(token) {
    const r = await tradingCall(token, 'GetBestOffers', '<BestOfferStatus>Active</BestOfferStatus><Pagination><EntriesPerPage>50</EntriesPerPage><PageNumber>1</PageNumber></Pagination>');
    if (!r || !r.ok) return { ko: { raison: r && r.status === 0 ? 'injoignable' : 'pas-su', erreur: "eBay n'a pas rendu tes offres." } };
    const root = lireXml(r.xml, 'GetBestOffers');
    if (!root) return { ko: { raison: 'illisible', erreur: "Réponse d'eBay illisible pour les offres." } };
    const l = offresEbay(root).filter((o) => /^(Pending|Active)$/.test(o.status || 'Active'));
    const pages = Number(texte(root.PaginationResult && root.PaginationResult.TotalNumberOfPages));
    return { n: l.length, auMoins: Number.isFinite(pages) && pages > 1 };
  }
  // ── Le tableau de bord : tout en UN aller-retour, chaque partie avec son état
  //    (une partie ratée ne vide pas les autres ; elle porte `ko` et sa raison).
  async function tableau(b, ctx) {
    const a = await jeton(ctx); if (a.ko) return a.ko;
    const [ar, tf, sa, ev, li, of, ms] = await Promise.all([
      lireArgent(a.token, { leger: true }).catch(() => ({ raison: 'pas-su', erreur: "eBay n'a pas rendu ton argent." })),
      lireTrafic(a.token).catch(() => ({ ko: { raison: 'pas-su', erreur: "eBay n'a pas rendu le trafic." } })),
      lireSante(a.token).catch(() => null),
      lireEvaluations(a.token).catch(() => ({ ko: { raison: 'pas-su', erreur: "eBay n'a pas rendu tes évaluations." } })),
      lireLitiges(a.token).catch(() => null),
      lireOffres(a.token).catch(() => ({ ko: { raison: 'pas-su', erreur: "eBay n'a pas rendu tes offres." } })),
      // Les messages sans réponse : le résumé que `messages` a rangé (`ebay_messages`), jamais relu chez eBay ici.
      lireMessages ? lireMessages(ctx).catch(() => undefined) : Promise.resolve(undefined),
    ]);
    const enLigne = lire ? await lire(ctx).catch(() => undefined) : undefined;
    // (15 nov., 2e tour) Le calendrier des versements de Ma journée lit la ligne rangée : le
    // tableau y range les versements et le solde LUS (jamais une lecture ratée ; les dates par
    // commande ne sont pas touchées).
    if (ranger && !ar.raison && Array.isArray(ar.versements)) await ranger(ctx, (avant) => ({ ...(avant && typeof avant === 'object' ? avant : {}), versements: ar.versements.slice(0, 60), solde: ar.solde || null, versementsLusA: maintenant(), capturedAt: maintenant() })).catch(() => null);
    return { status: 200, body: {
      ok: true,
      argent: ar.raison ? { ko: { raison: ar.raison, erreur: ar.erreur }, solde: ar.solde, versements: ar.versements } : { solde: ar.solde, versements: ar.versements },
      trafic: tf.ko ? { ko: tf.ko } : (() => { const t = enrichirTrafic(tf.trafic, enLigne); return { ...t, invisibles: Array.isArray(enLigne) ? annoncesInvisibles(t, enLigne, maintenant()) : null }; })(),
      sante: sa || { ko: { raison: 'pas-su', erreur: "eBay n'a pas rendu la santé du compte." } },
      evaluations: ev.ko ? { ko: ev.ko } : ev.evaluations,
      litiges: li || { ko: { raison: 'pas-su', erreur: "eBay n'a pas rendu les litiges." } },
      offres: of,
      messages: ms && Number.isFinite(Number(ms.nonLus)) && ms.nonLus !== '' && ms.nonLus != null ? { n: Number(ms.nonLus), auMoins: String(ms.complet) === 'false', lu: Number(ms.capturedAt) || null } : { ko: { raison: 'pas-lu', erreur: 'Messages pas encore lus.' } },
      capturedAt: maintenant(),
    } };
  }
  return { argent, trafic, sante, evaluationsrecues, litiges, tableau, lireArgent };
}
