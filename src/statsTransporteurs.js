// ════════════════════════════════════════════════════════════════════════════
//  STATISTIQUES PAR TRANSPORTEUR — VENTES ET ACHATS (21 nov., lot journee-stats). Julien : « fais les stats par
//  transporteur, achat et vente ». Module PUR (aucune lecture, aucun React), LE propriétaire de ces chiffres :
//    · `ligneVente` / `ligneAchat` : UN colis, rangé à partir de ce que l'écran a LU pour lui, PAR IDENTITÉ (le n° de
//      suivi de SON bordereau, la ligne `depart_`/`transp_` de CE n°, SA commande) — jamais par titre ;
//    · `delai` : un délai en jours sur les SEULES paires de dates lues (une date manquante ⇒ la ligne sort du calcul,
//      la couverture « sur N » est rendue) ; moins de 3 colis mesurés ⇒ null (« — ») ; médiane quand les écarts sont
//      forts, moyenne sinon — et le mode est rendu (l'écran dit lequel) ;
//    · `statsTransporteurs` : par transporteur (le transporteur LU, `cleStatTransporteur` ; « inconnu » compté à part).
//  Aucune date n'est estimée ici : un dépôt est une prise en charge LUE chez le transporteur, une livraison l'arrivée
//  au point de l'acheteur ou chez lui LUE, une limite celle de l'e-mail du bordereau (jamais « vente + 7 j »).
// ════════════════════════════════════════════════════════════════════════════
//  (21 nov., lot transp-depenses — Julien : « sur tous les sites ») Leboncoin, eBay et Vestiaire passent par la MÊME règle
//  (`ligneVente` / `ligneAchat`, `statsTransporteurs`) ; chaque ligne porte son `site`. Les lignes propres aux sites
//  (`ligneVenteLbc`, `ligneVenteVc`, `ligneVenteEbay`, `ligneAchatVc`, `ligneAchatLbc`) ne lisent que ce que la vente
//  porte elle-même ou ce qui est rangé sous SON n° de suivi exact (jamais un titre) ; un n° porté par deux colis ne
//  prouve rien (`suivisPartages`). eBay : l'expédition est gérée par eBay, le transporteur est celui que la commande
//  nomme (`shippingStep.shippingCarrierCode`) — aucune date de dépôt n'est rangée par VRM (à capter : les
//  `shipping_fulfillment` d'eBay) ; AUCUN montant n'entre dans une ligne (le port eBay n'est ni recette ni charge, §2.8).
import { cleStatTransporteur, nomDuTransporteur, transporteurDuColis } from './transporteursVisuels.js';
import { normaliserSuivi } from '../api/_lib/etat-colis-email.js';
import { etatCommandeEbay } from '../api/_lib/ebay-etat-commande.js';

const JOUR = 86400000;
export const MIN_COLIS = 3;
// Les écarts sont « forts » quand la moyenne s'écarte de plus d'un quart de la médiane, ou que le plus long dépasse
// trois fois la médiane : la médiane est alors rendue (un colis bloqué une semaine ne tire pas le chiffre).
export const ECART_FORT = 0.25;
const ms = (v) => { if (v == null || v === '') return null; if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null; const t = Date.parse(String(v)); return Number.isFinite(t) && t > 0 ? t : null; };

// Le sort d'une vente lu dans SON état Vinted : retour (l'article revient) · litige (transaction suspendue, réclamation).
export function issueVente(status) {
  const s = String(status || '');
  if (/retour|rembours/i.test(s)) return 'retour';
  if (/suspend|litige|r[ée]clamation/i.test(s)) return 'litige';
  return null;
}

// `tr` : { cle, nom } (transporteurDeVente) ; `venteAt` : la date de la vente ; `depart` : la ligne `depart_` du n° de SON
// bordereau (priseAt, etat, etatAt) ou null ; `limiteAt` : la limite LUE dans l'e-mail du bordereau (ms) ou null ;
// `status` : l'état Vinted de la commande.
// (21 nov., transp-depenses) `site` : vinted · leboncoin · ebay · vestiaire ; `arriveeAt` : l'ARRIVÉE gardée sur cet
// appareil avant le retrait (`memoArrivee`) — la ligne `depart_` la garde désormais elle-même (`arriveeAt`, posée une
// fois par le serveur). Une fois le colis retiré, `etatAt` est la date du RETRAIT, jamais celle de l'arrivée.
export function ligneVente({ tr = null, venteAt = null, depart = null, limiteAt = null, status = '', site = 'vinted', arriveeAt = null } = {}) {
  const d = depart && typeof depart === 'object' ? depart : null;
  const depotAt = d ? ms(d.priseAt) : null;
  const livreAt = d && (d.etat === 'disponible' || d.etat === 'livre') ? ms(d.etatAt) : (d ? (ms(d.arriveeAt) ?? ms(arriveeAt)) : null);
  const lim = ms(limiteAt);
  return {
    site: SITES.includes(site) ? site : 'vinted',
    t: cleStatTransporteur(tr), nom: (tr && tr.nom) || '', venteAt: ms(venteAt), depotAt, livreAt: livreAt != null && depotAt != null && livreAt < depotAt ? null : livreAt,
    retard: depotAt != null && lim != null ? depotAt > lim : null,
    issue: issueVente(status) || (d && d.etat === 'retour_expediteur' ? 'renvoye' : null),
    aVerifier: !!(d && d.etat === 'incident'),
  };
}

// `trajet` : le rendu de src/retraitTrajet.js `etapesTrajet` pour CE colis (ou null) ; `ligne` : la ligne `transp_`
// de SON n° (etat, etatAt, lieuNom, lieuVille) ; `payeAt` : la date de SA commande ; `status` : l'état Vinted de l'achat.
export function ligneAchat({ tr = null, payeAt = null, ligne = null, trajet = null, status = '', site = 'vinted' } = {}) {
  const l = ligne && typeof ligne === 'object' ? ligne : null;
  const at = (k) => { const e = trajet && Array.isArray(trajet.etapes) ? trajet.etapes.find((x) => x.cle === k) : null; return e && e.lue ? ms(e.at) : null; };
  const pointAt = at('point') ?? (l && l.etat === 'disponible' ? ms(l.etatAt) : null);
  const retireAt = at('retire') ?? (l && l.etat === 'retire' ? ms(l.etatAt) : null);
  const point = l && l.lieuNom ? [String(l.lieuNom).trim(), String(l.lieuVille || '').trim()].filter(Boolean).join(', ').slice(0, 60) : '';
  return {
    site: SITES.includes(site) ? site : 'vinted',
    t: cleStatTransporteur(tr), nom: (tr && tr.nom) || '', payeAt: ms(payeAt) ?? at('paye'), expedieAt: at('expedie'), pointAt,
    retireAt: retireAt != null && pointAt != null && retireAt < pointAt ? null : retireAt,
    nonReclame: !!(l && l.etat === 'retour_expediteur') || /non\s+r[ée]clam/i.test(String(status || '')),
    point,
  };
}

export const SITES = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const txt = (v) => (v == null ? '' : String(v));
// Une liste rangée par l'extension : un tableau, ou un objet { id: ligne } (`vc_ventes.ventes`).
export const listeSite = (v) => (Array.isArray(v) ? v : objet(v) ? Object.values(v) : []);

// Les n° de suivi portés par PLUSIEURS colis (deux ventes, ou une vente et un achat) : aucun ne prouve rien pour ce n°.
export function suivisPartages(suivis) {
  const vus = new Set(), doubles = new Set();
  for (const s of suivis || []) { const n = normaliserSuivi(s); if (!n) continue; if (vus.has(n)) doubles.add(n); else vus.add(n); }
  return doubles;
}
// La ligne `depart_` de CE n° exact (Map n° → ligne), jamais celle d'un n° partagé.
export function departDuSuivi(departs, suivi, partages = null) {
  const n = normaliserSuivi(suivi);
  if (!n || !departs || typeof departs.get !== 'function' || (partages && partages.has(n))) return null;
  const d = departs.get(n);
  return d && normaliserSuivi(d.suivi) === n ? d : null;
}

// LEBONCOIN. `o` : une transaction de `lbc_ventes` (txId, dateVente, deliveryMethod, deliveryLabel, label.reference,
// stepStatus, stepLabel, parcelStatus). Le transporteur : celui que la transaction NOMME (`deliveryMethod`) ; le dépôt et
// l'arrivée : la ligne `depart_` du n° de SON bordereau (`label.reference`) quand le transporteur a répondu pour lui.
// null pour ce qui n'est pas une vente à colis (achat, côté inconnu sans bordereau, annulée sans retour ni litige).
export function ligneVenteLbc(o, { departs = null, partages = null, annulee = null } = {}) {
  if (!objet(o) || !o.txId) return null;
  const aLabel = !!(o.label && (o.label.voucherUrl || o.label.qrUrl || o.label.reference));
  if (!(o.isSeller === true || (o.isSeller !== false && aLabel))) return null;
  const mots = [o.stepStatus, o.stepLabel, o.parcelStatus].map(txt).join(' ');
  const retour = /retour|return|rembours|refund/i.test(mots), litige = /litige|dispute|r[ée]clamation|claim/i.test(mots);
  if (typeof annulee === 'function' && annulee(o) && !retour && !litige) return null;
  const suivi = o.label && o.label.reference ? txt(o.label.reference) : '';
  const tr = transporteurDuColis({ declare: txt(o.deliveryMethod) || txt(o.deliveryLabel) });
  return ligneVente({ site: 'leboncoin', tr, venteAt: o.dateVente || null, depart: departDuSuivi(departs, suivi, partages), limiteAt: null, status: retour ? 'retour' : litige ? 'litige' : '' });
}

// VESTIAIRE. `v` : une vente de `vc_ventes.ventes` (date, suivi, transporteur, etat, limite). Le transporteur : celui que
// la vente nomme, sinon la ligne de SON n° ; dépôt et arrivée : la ligne `depart_` de CE n°. La limite que Vestiaire écrit
// est LUE : elle juge « à temps ». Annulée sans retour ni litige ⇒ null.
export function ligneVenteVc(v, { departs = null, partages = null, transp = null } = {}) {
  if (!objet(v)) return null;
  const mot = txt(v.etat);
  const retour = /return|retour|refund|rembours/i.test(mot), litige = /litige|dispute|claim/i.test(mot);
  if (/cancel|annul/i.test(mot) && !retour && !litige) return null;
  const tr = transporteurDuColis({ declare: txt(v.transporteur), suivi: txt(v.suivi), transp });
  return ligneVente({ site: 'vestiaire', tr, venteAt: v.date || null, depart: departDuSuivi(departs, v.suivi, partages), limiteAt: v.limite || null, status: retour ? 'retour' : litige ? 'litige' : '' });
}

// eBAY. `o` : une commande de l'API Fulfillment. L'expédition est GÉRÉE PAR eBAY (l'acheteur paie le port, eBay fournit
// l'étiquette, §2.8) : le transporteur est celui que la commande nomme (`fulfillmentStartInstructions[].shippingStep
// .shippingCarrierCode`), sinon « inconnu ». La commande rangée ne porte NI n° de suivi NI date de dépôt : les délais
// restent « — » (dit). AUCUN montant ici : ni le port, ni le prix. Annulée ou remboursée en entier ⇒ null.
export function ligneVenteEbay(o) {
  if (!objet(o) || !o.orderId) return null;
  const e = etatCommandeEbay(o);
  if (e.kind === 'cancelled' || (e.kind === 'refunded' && String(o.orderPaymentStatus || '').toUpperCase() === 'FULLY_REFUNDED')) return null;
  const fs = Array.isArray(o.fulfillmentStartInstructions) ? o.fulfillmentStartInstructions.filter(objet) : [];
  const code = fs.map((f) => txt(f.shippingStep && f.shippingStep.shippingCarrierCode)).find(Boolean) || '';
  return ligneVente({ site: 'ebay', tr: transporteurDuColis({ declare: code }), venteAt: o.creationDate || null, depart: null, limiteAt: null, status: e.kind === 'refunded' ? 'remboursée' : '' });
}

// ACHATS VESTIAIRE (`vc_ventes.achats`, { date, suivi, transporteur, etat }) : la même `ligneAchat` sur la ligne `transp_`
// de SON n° exact et le trajet lu de cette ligne. LEBONCOIN (`lbc_ventes.achats`) ne range aucun n° : le transporteur
// nommé seul (les délais restent « — », dit).
export function ligneAchatVc(a, { transp = null, trajetDe = null, partages = null } = {}) {
  if (!objet(a) || /cancel|annul/i.test(txt(a.etat))) return null;
  const n = normaliserSuivi(a.suivi);
  const ln = n && transp && typeof transp.get === 'function' && !(partages && partages.has(n)) ? (transp.get(n) || null) : null;
  const tr = transporteurDuColis({ declare: txt(a.transporteur), suivi: n, transp });
  return ligneAchat({ site: 'vestiaire', tr, payeAt: a.date || null, ligne: ln, trajet: ln && typeof trajetDe === 'function' ? trajetDe(ln) : null, status: txt(a.etat) });
}
export function ligneAchatLbc(o, { annulee = null } = {}) {
  if (!objet(o) || !o.txId || o.isSeller !== false) return null;
  if (typeof annulee === 'function' && annulee(o)) return null;
  return ligneAchat({ site: 'leboncoin', tr: transporteurDuColis({ declare: txt(o.deliveryMethod) || txt(o.deliveryLabel) }), payeAt: o.dateVente || null, ligne: null, trajet: null });
}

// LE TRAJET D'UN ACHAT GARDÉ SUR CET APPAREIL (trou « historique du transporteur des achats ») : les dates que les
// évènements de SA ligne `transp_` prouvent (`etapesTrajet`), rangées par id de ligne avec l'`etatAt` de la lecture ;
// relues seulement quand la ligne a changé. `trajet` : le rendu d'`etapesTrajet` ; rend { e, ex, pt, rt }.
export function memoTrajet(trajet, etatAt) {
  const at = (k) => { const x = trajet && Array.isArray(trajet.etapes) ? trajet.etapes.find((y) => y.cle === k) : null; return x && x.lue ? ms(x.at) : null; };
  return { e: txt(etatAt), ex: at('expedie'), pt: at('point'), rt: at('retire') };
}
// Le trajet (forme d'`etapesTrajet`) rendu d'un mémo, seulement s'il parle de la ligne telle qu'elle est (même `etatAt`).
export function trajetDeMemo(m, etatAt) {
  if (!objet(m) || txt(m.e) !== txt(etatAt)) return null;
  const e = (cle, at) => ({ cle, at: ms(at), lue: ms(at) != null });
  return { etapes: [e('expedie', m.ex), e('point', m.pt), e('retire', m.rt)] };
}
// L'ARRIVÉE d'une vente vue sur cet appareil avant le retrait : la ligne `depart_` en « disponible »/« livré » donne SA
// date ; gardée ensuite pour ce n° (jamais remplacée par une date plus tardive).
export function memoArrivee(memo, d) {
  const m = objet(memo) ? memo : {};
  if (!objet(d) || !(d.etat === 'disponible' || d.etat === 'livre')) return m;
  const n = normaliserSuivi(d.suivi), at = ms(d.etatAt);
  if (!n || at == null || (m[n] != null && m[n] <= at)) return m;
  return { ...m, [n]: at };
}

// Un délai en jours sur des paires [début, fin] LUES (fin ≥ début). Rend { jours, mode, n, sur } ou { jours: null, … }.
export function delai(paires) {
  const L = Array.isArray(paires) ? paires : [];
  const v = L.filter(([a, b]) => a != null && b != null && b >= a).map(([a, b]) => (b - a) / JOUR).sort((x, y) => x - y);
  const sur = L.length, n = v.length;
  if (n < MIN_COLIS) return { jours: null, mode: null, n, sur };
  const moy = v.reduce((t, x) => t + x, 0) / n;
  const med = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  const fort = med > 0 ? (Math.abs(moy - med) / med > ECART_FORT || v[n - 1] > 3 * med) : moy > 0;
  const x = fort ? med : moy;
  return { jours: Math.round(x * 10) / 10, mode: fort ? 'mediane' : 'moyenne', n, sur };
}

const NOMS = { 'pas-lu': '', autre: '' };
const groupe = (L) => { const m = new Map(); for (const x of L) { const k = x.t || 'pas-lu'; if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
const nomDe = (k, L) => (NOMS[k] !== undefined ? (k === 'autre' ? (L.find((x) => x.nom) || {}).nom || '' : '') : nomDuTransporteur(k) || (L.find((x) => x.nom) || {}).nom || k);
const plusFrequent = (L) => { const c = new Map(); for (const x of L) if (x) c.set(x, (c.get(x) || 0) + 1); let best = null; for (const [k, n] of c) if (!best || n > best.n) best = { nom: k, n }; return best; };

// `ventes`, `achats` : les lignes rangées (ou null = pas su) ; `de`, `a` : la fenêtre (ms). Une vente est dans la fenêtre
// par sa date de vente, un achat par sa date de paiement ; sans cette date, il n'est dans aucune fenêtre (et c'est dit).
// (21 nov., transp-depenses) `site` : 'toutes' (défaut) ou un site de SITES — le filtre « Site » ; chaque transporteur
// rend aussi `sites` ({ vinted: n, … } dans la fenêtre) et chaque partie `sites` (les sites présents, pour le filtre).
// Une ligne d'avant sans `site` est une ligne Vinted (la publication d'avant ne comptait que Vinted).
const siteDe = (x) => (x && SITES.includes(x.site) ? x.site : 'vinted');
const parSite = (X) => { const o = {}; for (const x of X) { const s = siteDe(x); o[s] = (o[s] || 0) + 1; } return o; };
export function statsTransporteurs({ ventes = null, achats = null, de, a, site = 'toutes' }) {
  const dans = (t) => t != null && t >= de && t < a;
  const filtre = SITES.includes(site) ? site : 'toutes';
  const partie = (L0, dateDe, faire0) => {
    if (!Array.isArray(L0)) return null;
    const presents = SITES.filter((s) => L0.some((x) => siteDe(x) === s && dans(dateDe(x))));
    const L = filtre === 'toutes' ? L0 : L0.filter((x) => siteDe(x) === filtre);
    const faire = (X) => ({ ...faire0(X), sites: parSite(X) });
    const F = L.filter((x) => dans(dateDe(x)));
    const total = F.length;
    const G = groupe(F);
    const rangs = [...G.entries()].filter(([k]) => k !== 'pas-lu').map(([k, X]) => ({ cle: k, nom: nomDe(k, X), n: X.length, part: total ? Math.round((X.length / total) * 100) : 0, ...faire(X) }))
      .sort((x, y) => y.n - x.n || (x.nom < y.nom ? -1 : 1));
    const inc = G.get('pas-lu') || [];
    return { total, sansDate: L.filter((x) => dateDe(x) == null).length, transporteurs: rangs, inconnu: inc.length ? { n: inc.length, part: Math.round((inc.length / total) * 100), ...faire(inc) } : null, sites: presents, site: filtre };
  };
  return {
    ventes: partie(ventes, (x) => x.venteAt, (X) => {
      const juges = X.filter((x) => x.retard != null);
      return {
        depot: delai(X.map((x) => [x.venteAt, x.depotAt])),
        livraison: delai(X.map((x) => [x.depotAt, x.livreAt])),
        // À temps : sur les SEULS colis dont la limite est LUE et le dépôt constaté ; moins de 3 ⇒ pas de part (« — »).
        aTemps: juges.length >= MIN_COLIS ? { ok: juges.filter((x) => !x.retard).length, retard: juges.filter((x) => x.retard).length, sur: juges.length } : { ok: null, retard: null, sur: juges.length },
        retours: X.filter((x) => x.issue === 'retour' || x.issue === 'renvoye').length,
        litiges: X.filter((x) => x.issue === 'litige').length,
        aVerifier: X.filter((x) => x.aVerifier).length,
      };
    }),
    achats: partie(achats, (x) => x.payeAt, (X) => ({
      expedition: delai(X.map((x) => [x.payeAt, x.expedieAt])),
      arrivee: delai(X.map((x) => [x.expedieAt, x.pointAt])),
      retrait: delai(X.map((x) => [x.pointAt, x.retireAt])),
      nonReclames: X.filter((x) => x.nonReclame).length,
      point: plusFrequent(X.map((x) => x.point)),
    })),
  };
}

// Ce qu'on garde d'une ligne dans la publication (`vrm_stats_transporteurs`, sur cet appareil) : les dates et les drapeaux,
// ni titre, ni acheteur, ni n° de suivi.
export const CLE_PUB_TRANSP = 'vrm_stats_transporteurs';
export const JOURS_PUB_TRANSP = 120;
// (21 nov., transp-depenses) UNE publication PAR SITE et par sens (`vrm_stats_transporteurs_{sens}` = Vinted, la clé
// d'avant ; `_{sens}_{site}` pour les autres) : un site pas lu n'efface pas les autres, et il est NOMMÉ (« pas lu »).
export const PARTIES_PUB_TRANSP = { ventes: ['vinted', 'leboncoin', 'ebay', 'vestiaire'], achats: ['vinted', 'leboncoin', 'vestiaire'] };
export const clePubTransp = (sens, site) => CLE_PUB_TRANSP + '_' + sens + (site && site !== 'vinted' ? '_' + site : '');
// Ce que chaque ligne publiée garde (liste blanche) : des dates, une clé de transporteur, des drapeaux. Jamais un montant
// (ni prix, ni port, ni frais), jamais un titre, un acheteur ou un n° de suivi.
export const CHAMPS_PUB_TRANSP = ['site', 't', 'nom', 'venteAt', 'depotAt', 'livreAt', 'retard', 'issue', 'aVerifier', 'payeAt', 'expedieAt', 'pointAt', 'retireAt', 'nonReclame', 'point'];
export const lignePubliee = (x) => { const o = {}; for (const k of CHAMPS_PUB_TRANSP) if (x && x[k] !== undefined) o[k] = x[k]; return o; };
// Les publications réunies d'un sens : { L (la liste, ou null si aucune partie n'est lue), lus, pasLus }.
// `lire(cle)` rend la liste publiée d'une clé (ou null = pas publiée).
export function reunirPubTransp(sens, lire) {
  const lus = [], pasLus = [], L = [];
  for (const s of PARTIES_PUB_TRANSP[sens] || []) { const x = lire(clePubTransp(sens, s)); if (Array.isArray(x)) { lus.push(s); for (const y of x) L.push(y && SITES.includes(y.site) ? y : { ...y, site: s }); } else pasLus.push(s); }
  return { L: lus.length ? L : null, lus, pasLus };
}
