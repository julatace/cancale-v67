// ─────────────────────────────────────────────────────────────────────────────
// LA LIVRAISON eBAY DANS VRM (28 nov. 2026, lot `ebay-livraison`) — règles PURES
// partagées par l'app et le serveur (§11). Julien : « oui, fais tout » aux cinq
// points : colis eBay dans À envoyer, étiquette depuis VRM, suivi automatique,
// livraison préréglée à la mise en ligne, port de l'acheteur pour info.
//
// ⚠️⚠️ §2.8 — SUR eBAY C'EST L'ACHETEUR QUI PAIE LE BORDEREAU. Son compte est en
// livraison GÉRÉE par eBay : l'acheteur paie le port à eBay, eBay fournit
// l'étiquette prépayée. VRM n'achète JAMAIS une étiquette :
//   · aucun appel à l'API Logistics d'eBay (`/sell/logistics/…` :
//     `shipping_quote`, `create_from_shipping_quote` — qui ACHÈTE l'étiquette —,
//     `download_label_file`, qui ne sert qu'une étiquette achetée par l'API) ;
//     `fetchAvecDelai` refuse ces adresses (`estAchatEtiquette`), et
//     scripts/audit-ebay-livraison.cjs le prouve en l'exécutant ;
//   · l'étiquette déjà payée par l'acheteur se prend DANS eBay
//     (`lienEtiquette`, la page « expédier » de CETTE commande) ou arrive par
//     e-mail (`lireEtiquetteEbay`, rangée `email_bordebay_{n° de commande}`) ;
//   · le port payé par l'acheteur (`portAcheteurEbay`) se DIT, pour info : il
//     n'est ni une recette ni une charge (`montantRecuEbay` ne le lit pas).
//
// Identité (§5) : le N° DE COMMANDE eBay (forme `12-34567-89012`), le n° de
// suivi. Jamais le titre : 50 commandes au même titre ne se confondent pas.
// Rien n'a été mesuré sur une vraie commande (0 commande eBay en base au
// 28 nov., 0 e-mail d'étiquette eBay) : les noms viennent de la documentation
// de l'API Fulfillment (`shippingStep`, `shipByDate`, `shipping_fulfillment`).
// ─────────────────────────────────────────────────────────────────────────────
import { limiteDepuisInstant } from './limite-envoi.js';
import { limiteEnvoiEbay } from './ebay-a-expedier.js';

// ── 1. AUCUN ACHAT D'ÉTIQUETTE ─────────────────────────────────────────────
// La liste et la garde vivent dans `fetch-delai.js` (le seul `fetch` du serveur, sans autre import : les audits qui
// copient une partie d'api/_lib/ le chargent seul) ; elles sont redonnées ici.
export { ACHAT_ETIQUETTE_INTERDIT, estAchatEtiquette } from './fetch-delai.js';

// ── 2. LA DATE LIMITE D'ENVOI LUE (handling time ⇒ `shipByDate`) ───────────
// La plus proche des lignes de la commande (`limiteEnvoiEbay`), en jour et heure
// de PARIS, forme de api/_lib/limite-envoi.js (`limite: 'ebay'`, une limite LUE).
export function limiteEbay(o, maintenant = Date.now()) {
  const ms = limiteEnvoiEbay(o);
  return ms == null ? null : limiteDepuisInstant(ms, maintenant);
}

// ── 3. LE TRANSPORTEUR ─────────────────────────────────────────────────────
// Le texte LU chez eBay (jamais deviné) : le transporteur d'une expédition
// (`shippingCarrierCode`), sinon celui que l'acheteur a choisi
// (`fulfillmentStartInstructions[].shippingStep.shippingCarrierCode`, puis
// `shippingServiceCode`). « MONDIAL_RELAY » ⇒ « mondial relay » : l'app le
// range avec SA table (`transporteurDuColis`). Rien lu ⇒ ''.
const texteCode = (v) => String(v == null ? '' : v).replace(/[_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim().slice(0, 60);
export function transporteurEbay(o, suivis = null) {
  const s = (Array.isArray(suivis) ? suivis : []).find((x) => x && x.transporteur);
  if (s) return texteCode(s.transporteur);
  for (const f of (Array.isArray(o && o.fulfillmentStartInstructions) ? o.fulfillmentStartInstructions : [])) {
    const st = (f && f.shippingStep) || {};
    if (st.shippingCarrierCode) return texteCode(st.shippingCarrierCode);
    if (st.shippingServiceCode) return texteCode(st.shippingServiceCode);
  }
  return '';
}

// ── 4. LES N° DE SUIVI (getShippingFulfillments) ───────────────────────────
// `GET /sell/fulfillment/v1/order/{orderId}/shipping_fulfillment` ⇒
// `{ fulfillments: [{ fulfillmentId, shipmentTrackingNumber, shippingCarrierCode,
//   shippedDate }] }`. Des SCALAIRES seulement (aucune adresse). Réponse
// illisible ⇒ null (« pas su »), jamais [].
const SUIVI_FORME = /^[A-Za-z0-9][A-Za-z0-9 -]{3,99}$/;
export function suivisDeFulfillments(json) {
  if (!json || typeof json !== 'object' || !Array.isArray(json.fulfillments)) return null;
  const out = [], vus = new Set();
  for (const f of json.fulfillments) {
    if (!f || typeof f !== 'object') continue;
    const n = String(f.shipmentTrackingNumber || '').trim();
    if (!SUIVI_FORME.test(n)) continue;
    const k = n.toUpperCase().replace(/[\s-]+/g, '');
    if (vus.has(k)) continue; vus.add(k);
    const t = Date.parse(String(f.shippedDate || ''));
    out.push({ numero: n.slice(0, 100), transporteur: String(f.shippingCarrierCode || '').slice(0, 50), expedieLe: Number.isFinite(t) ? new Date(t).toISOString() : null });
  }
  return out;
}

// Les commandes dont il faut (re)lire les suivis, les plus récentes d'abord :
// parties ou en cours d'envoi (`orderFulfillmentStatus` IN_PROGRESS/FULFILLED),
// vendues il y a 45 jours au plus, et dont l'expédition n'est pas déjà rangée
// (même nombre d'expéditions qu'eBay annonce, `fulfillmentHrefs`) — ou rangée
// SANS n° il y a plus d'une heure. Au plus `max` par relecture (quota eBay).
export const SUIVIS_FENETRE_J = 45;
export function commandesASuivre(orders, deja = {}, maintenant = Date.now(), max = 6) {
  const d = deja && typeof deja === 'object' ? deja : {};
  return (Array.isArray(orders) ? orders : [])
    .filter((o) => o && o.orderId && ['IN_PROGRESS', 'FULFILLED'].includes(String(o.orderFulfillmentStatus || '').toUpperCase()))
    .filter((o) => { const t = Date.parse(o.creationDate || ''); return !Number.isFinite(t) || maintenant - t <= SUIVIS_FENETRE_J * 86400000; })
    .filter((o) => {
      const x = d[o.orderId];
      if (!x) return true;
      const n = Array.isArray(o.fulfillmentHrefs) ? o.fulfillmentHrefs.length : 0;
      if (n > (Number(x.n) || 0)) return true;
      const lu = Date.parse(x.lusAt || '');
      return !(Array.isArray(x.suivis) && x.suivis.length) && (!Number.isFinite(lu) || maintenant - lu > 3600000);
    })
    .sort((a, b) => (Date.parse(b.creationDate || '') || 0) - (Date.parse(a.creationDate || '') || 0))
    .slice(0, max);
}
// La fusion dans la ligne `ebay_suivis{suffixe}` : `{ parCommande: { [orderId]:
// { suivis, n, lusAt } } }`. Une lecture ratée (`suivis === null`) ne remplace
// RIEN (la ligne garde ce qu'on savait). Rien de neuf ⇒ undefined (pas d'écriture).
export function fusionSuivis(d, lus, maintenant = Date.now()) {
  const avant = d && typeof d === 'object' && d.parCommande && typeof d.parCommande === 'object' ? d.parCommande : {};
  const p = { ...avant };
  let change = false;
  for (const { orderId, suivis, n } of (Array.isArray(lus) ? lus : [])) {
    if (!orderId || !Array.isArray(suivis)) continue;
    p[orderId] = { suivis, n: Number(n) || 0, lusAt: new Date(maintenant).toISOString() };
    change = true;
  }
  if (!change) return undefined;
  // Au plus 400 commandes gardées (les plus récemment lues).
  const cles = Object.keys(p).sort((a, b) => (Date.parse(p[b].lusAt) || 0) - (Date.parse(p[a].lusAt) || 0)).slice(0, 400);
  return { ...(d && typeof d === 'object' ? d : {}), parCommande: Object.fromEntries(cles.map((k) => [k, p[k]])), capturedAt: maintenant };
}

// ── 5. OÙ EN EST UN COLIS eBAY PARTI ───────────────────────────────────────
// « En route » : eBay dit la commande expédiée ET un n° de suivi est lu chez
// eBay. « Livrée » : le TRANSPORTEUR le dit, par CE n° (un e-mail de suivi
// `delivered`, ou sa ligne `transp_` finie) — `finSuivi(n°)` est fourni par
// l'appelant (la règle de l'app, `finDeLigne` / `finDeLigneTransporteur`).
// Sans n° lu : « expédiée » seulement (jamais « en route » deviné).
export function etatEnvoiEbay(o, suivis, finSuivi = () => null) {
  const st = String((o && o.orderFulfillmentStatus) || '').toUpperCase();
  const parti = st === 'FULFILLED' || st === 'IN_PROGRESS';
  if (!parti) return null;
  const L = Array.isArray(suivis) ? suivis : [];
  if (!L.length) return { etat: 'expediee', suivi: '', livree: false };
  const fins = L.map((s) => { try { return finSuivi(s.numero); } catch (_) { return null; } });
  const livree = L.length > 0 && fins.every((f) => f === 'delivered' || f === 'retire');
  return { etat: livree ? 'livree' : 'route', suivi: L[0].numero, livree, retour: fins.some((f) => f === 'retour') };
}

// ── 6. LE PORT PAYÉ PAR L'ACHETEUR — POUR INFO, HORS COMPTA ────────────────
// `pricingSummary.deliveryCost` (moins `deliveryDiscount`). Une somme que
// l'acheteur a payée à eBay pour l'étiquette : ni recette ni charge (§2.8).
// Illisible ⇒ null.
export function portAcheteurEbay(o) {
  const ps = o && o.pricingSummary;
  const c = ps && ps.deliveryCost;
  const v = c && c.value != null ? Number(c.value) : NaN;
  if (!Number.isFinite(v) || v < 0) return null;
  const rem = ps.deliveryDiscount && ps.deliveryDiscount.value != null ? Number(ps.deliveryDiscount.value) : 0;
  const net = Math.round((v - (Number.isFinite(rem) ? Math.abs(rem) : 0)) * 100) / 100;
  return { montant: Math.max(0, net), devise: String(c.currency || '').toUpperCase() || null };
}

// ── 7. L'ÉTIQUETTE REÇUE PAR E-MAIL ────────────────────────────────────────
// Un e-mail d'eBay (domaine d'expéditeur eBay — il CLASSE l'e-mail ; le vendeur,
// lui, reste celui de l'adresse de RÉCEPTION, §5) qui porte UN PDF et dont le
// sujet parle d'étiquette. Le n° de commande eBay est lu dans le sujet puis le
// corps : exactement UN n° distinct, sinon rien n'est rangé (gardé « à
// vérifier », jamais jeté ni deviné). ⚠️ NON MESURÉ : aucun e-mail d'étiquette
// eBay dans sa base au 28 nov. (seulement de la publicité, « mis en vente »).
export const EXPEDITEUR_EBAY = /@(?:[a-z0-9-]+\.)*ebay\.(?:fr|com|co\.uk|de|it|es)\b/i;
export const SUJET_ETIQUETTE = /(?:[ée]tiquette|bordereau|shipping label|postage label|versandetikett|etichetta|etiqueta)/i;
export const NUMERO_COMMANDE_EBAY = /\b(\d{2}-\d{5}-\d{5})\b/g;
export function estEtiquetteEbay({ from = '', subject = '', attachments = [] } = {}) {
  if (!EXPEDITEUR_EBAY.test(String(from || ''))) return false;
  if (!SUJET_ETIQUETTE.test(String(subject || ''))) return false;
  return (Array.isArray(attachments) ? attachments : []).some(estPdf);
}
const estPdf = (a) => !!a && (/application\/pdf/i.test(a.contentType || '') || /\.pdf$/i.test(a.filename || ''));
export function lireEtiquetteEbay({ subject = '', text = '', attachments = [] } = {}) {
  const pdfs = (Array.isArray(attachments) ? attachments : []).filter(estPdf);
  if (!pdfs.length) return { ok: false, raison: 'sans PDF' };
  if (pdfs.length > 1) return { ok: false, raison: 'plusieurs PDF' };
  const trouve = (t) => [...new Set([...String(t || '').matchAll(NUMERO_COMMANDE_EBAY)].map((m) => m[1]))];
  let ns = trouve(subject);
  if (!ns.length) ns = trouve(text);
  if (ns.length !== 1) return { ok: false, raison: ns.length ? 'plusieurs n° de commande' : 'aucun n° de commande' };
  const pdf = pdfs[0];
  if (!pdf.contentB64) return { ok: false, raison: 'PDF vide' };
  return { ok: true, orderId: ns[0], pdf };
}
export const PREFIXE_ETIQUETTE_EBAY = 'email_bordebay_';
export const idEtiquetteEbay = (orderId) => PREFIXE_ETIQUETTE_EBAY + String(orderId || '').replace(/[^0-9-]/g, '');
