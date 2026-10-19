// ─────────────────────────────────────────────────────────────────────────────
// LES COLIS eBAY À POSTER — UNE règle pour Colis, Ma journée, la cloche, le
// widget et le rappel du matin (§11). Pure : aucune lecture, aucun appel.
//
// (19 octobre) « Rien ne se passe après une vente eBay » : la commande n'était
// visible que dans eBay → Ventes. Colis, Ma journée, le widget et le rappel du
// matin ne comptaient que Vinted. Cette règle dit, pour les commandes RANGÉES
// (`ebay_orders*`, écrites par la synchro), lesquelles attendent un envoi.
//
// ⚠️ Sur eBay c'est l'ACHETEUR qui paie le bordereau (§2.8) : l'étiquette se
//    prend DANS eBay (prépayée par le port que l'acheteur a payé). VRM ne
//    l'achète jamais ; il dit seulement qu'il y a un colis à faire, et où.
//
// Trois états, jamais deux : `orders` qui n'est pas un tableau ⇒ `null`
// (« pas su »), jamais une liste vide.
//
// ⚠️ NON MESURÉ sur son compte (aucune vente eBay chez lui au 19 octobre) : les
// noms viennent de la documentation de l'API Fulfillment d'eBay —
// `lineItems[].lineItemFulfillmentInstructions.shipByDate`,
// `fulfillmentStartInstructions[].fulfillmentInstructionsType`
// (SHIP_TO · PREPARE_FOR_PICKUP · FULFILLED_BY_EBAY · DIGITAL),
// `lineItems[].program.authenticityVerification`. Un champ absent ne cache
// jamais un colis (« un colis caché est un colis perdu ») : sans type connu, on
// le garde ; sans date limite, il est à poster sans date.
// ─────────────────────────────────────────────────────────────────────────────
import { etatCommandeEbay } from './ebay-etat-commande.js';

const JOUR = 86400000;
const PARIS = 'Europe/Paris';
const jourParis = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: PARIS });
// Écart en jours CALENDAIRES (heure de Paris) entre aujourd'hui et `ms`.
export function joursAvant(ms, maintenant = Date.now()) {
  if (ms == null || !Number.isFinite(ms)) return null;
  const a = Date.parse(jourParis(maintenant) + 'T00:00:00Z'), b = Date.parse(jourParis(ms) + 'T00:00:00Z');
  return Math.round((b - a) / JOUR);
}

// La date limite d'envoi d'une commande : la plus proche de ses lignes. Le nom
// documenté d'abord, l'ancien nom lu par `ebay-agent.js` en repli.
export function limiteEnvoiEbay(o) {
  const ts = (Array.isArray(o && o.lineItems) ? o.lineItems : [])
    .map((l) => Date.parse((l && ((l.lineItemFulfillmentInstructions && l.lineItemFulfillmentInstructions.shipByDate)
      || (l.fulfillmentInstructions && l.fulfillmentInstructions.shipByDate))) || ''))
    .filter((t) => Number.isFinite(t));
  return ts.length ? Math.min(...ts) : null;
}

const ANNULATION_CLOSE = ['', 'NONE_REQUESTED', 'CANCEL_REJECTED', 'CANCELED'];
const expediee = (o) => ['FULFILLED', 'SHIPPED'].includes(String((o && o.orderFulfillmentStatus) || '').toUpperCase());

// `orders` : les commandes de TOUS les comptes actifs, marquées `_compte`
// (app) — ou non marquées (serveur). Rend `null` ou
//   { aPoster, nePasPoster, horsEnvoi }
// chaque entrée : { orderId, compte, pseudo, titre, sku, itemId, creationDate,
//   articles, limite (ms|null), jours (int|null), authentification }
export function colisEbay(orders, maintenant = Date.now()) {
  if (!Array.isArray(orders)) return null;
  const aPoster = [], nePasPoster = [], horsEnvoi = [], vus = new Set();
  for (const o of orders) {
    if (!o || typeof o !== 'object' || !o.orderId) continue;
    const cle = (o._compte || 'principal') + ':' + o.orderId;
    if (vus.has(cle)) continue; vus.add(cle);
    const li = (Array.isArray(o.lineItems) ? o.lineItems : []);
    const l0 = li[0] || {};
    const limite = limiteEnvoiEbay(o);
    const e = {
      orderId: String(o.orderId), compte: o._compte || 'principal', pseudo: o._pseudo || '',
      titre: typeof l0.title === 'string' ? l0.title.slice(0, 160) : '',
      sku: typeof l0.sku === 'string' ? l0.sku : '', itemId: String(l0.legacyItemId || l0.itemId || ''),
      creationDate: o.creationDate || null, articles: li.length,
      limite, jours: joursAvant(limite, maintenant),
      authentification: li.some((l) => !!(l && l.program && l.program.authenticityVerification)),
      ordre: o,                                       // la commande rangée (l'app y lit le N° par le SKU)
    };
    const cancel = String((o.cancelStatus && o.cancelStatus.cancelState) || '').toUpperCase();
    // « NE POSTE PAS » : l'acheteur a demandé l'annulation et le colis n'est pas
    // parti. Une annulation inconnue (ni refusée ni close) vaut « demandée ».
    if (!ANNULATION_CLOSE.includes(cancel) && !expediee(o)) { nePasPoster.push(e); continue; }
    if (!etatCommandeEbay(o).peutExpedier) continue;
    const types = (Array.isArray(o.fulfillmentStartInstructions) ? o.fulfillmentStartInstructions : [])
      .map((f) => String((f && f.fulfillmentInstructionsType) || '').toUpperCase()).filter(Boolean);
    // Un type LU qui n'est pas un envoi (retrait en magasin, expédié par eBay,
    // numérique) : rien à poster. Aucun type lu : on garde (jamais un colis caché).
    if (types.length && !types.includes('SHIP_TO')) { horsEnvoi.push({ ...e, type: types[0] }); continue; }
    aPoster.push(e);
  }
  const tri = (a, b) => (a.limite == null) - (b.limite == null) || (a.limite || 0) - (b.limite || 0);
  aPoster.sort(tri); nePasPoster.sort(tri);
  return { aPoster, nePasPoster, horsEnvoi };
}

// Les nombres du widget et du rappel du matin : total · en retard · aujourd'hui
// · demain (sur la date limite d'eBay). `null` reste `null`.
export function resumeColisEbay(c) {
  if (!c) return null;
  let overdue = 0, today = 0, tomorrow = 0;
  for (const x of c.aPoster) { if (x.jours == null) continue; if (x.jours < 0) overdue++; else if (x.jours === 0) today++; else if (x.jours === 1) tomorrow++; }
  return { total: c.aPoster.length, overdue, today, tomorrow, nePasPoster: c.nePasPoster.length };
}

// La page de la commande dans le Seller Hub d'eBay.fr (c'est là que s'achète
// l'étiquette prépayée). ⚠️ ADRESSE NON MESURÉE (eBay est bloqué d'ici).
export const lienCommandeEbay = (orderId) => 'https://www.ebay.fr/sh/ord/details?orderid=' + encodeURIComponent(String(orderId || ''));

// Lit les commandes eBay de TOUS les comptes actifs du vendeur courant, côté
// serveur. `lireLigne(id, cles)` rend objet · null (absente) · undefined (pas
// su) ; `lireToutes(path)` rend un tableau ou null. La MÊME règle que l'app
// (`commandesEbayTous`) : un compte illisible ⇒ `null`, jamais un total partiel.
export async function lireCommandesEbayServeur({ lireLigne, lireToutes, comptesActifs, normaliserRegistre }) {
  const [reg, rows] = await Promise.all([
    lireLigne('ebay_comptes', ['comptes']),
    lireToutes('app_data?id=like.ebay_orders%25&select=id,orders:data->orders'),
  ]);
  if (reg === undefined || !Array.isArray(rows)) return null;
  const ids = new Set(comptesActifs(normaliserRegistre(reg)).map((c) => 'ebay_orders' + c.suffixe));
  const out = [], vus = new Set(), lus = new Set();
  for (const r of rows) {
    if (!r || !ids.has(r.id)) continue;
    if (!Array.isArray(r.orders)) return null;
    lus.add(r.id);
    for (const o of r.orders) { const k = o && o.orderId; if (k && vus.has(k)) continue; if (k) vus.add(k); out.push(o); }
  }
  if ([...ids].some((id) => !lus.has(id) && (id !== 'ebay_orders' || (Array.isArray(reg && reg.comptes) && reg.comptes.some((c) => c.principal && !c.deconnecteLe))))) return null;
  return out;
}
