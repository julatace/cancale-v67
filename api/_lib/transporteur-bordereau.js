// ════════════════════════════════════════════════════════════════════════════
//  LE TRANSPORTEUR ÉCRIT DANS L'E-MAIL DU BORDEREAU (9 nov., Colis → Envoyés)
//  Julien (8 nov.) : « il n'y a pas que 1 Chronopost ». Ses ventes Vinted parties
//  tombaient dans « Autres » : la seule source lue pour le transporteur d'une
//  vente Vinted était la FORME du n° de suivi de son bordereau, et l'e-mail du
//  bordereau (« Bordereau d'envoi pour … », reçu pour CETTE transaction : sa
//  pièce « Bordereau-Vinted-{tx} ») n'était pas lu pour le transporteur.
//
//  Ici, une règle pure, importée par la route des e-mails (à la réception) ET
//  par l'app (bancs, audits) : le transporteur NOMMÉ dans le texte de CET e-mail
//  (sujet + corps, jamais le nom des pièces jointes).
//  ⚠️ JAMAIS DEVINÉ (§5) :
//    · un seul transporteur nommé ⇒ lui ; deux noms ou plus (un pied de page qui
//      liste les réseaux, « Mondial Relay ou Chronopost ») ⇒ rien ;
//    · « Vinted » seul n'est pas un transporteur (l'e-mail vient de Vinted) :
//      seul « Vinted Go » en est un ;
//    · « pickup », « relais », « point relais » ne nomment personne.
//  Forme du texte NON MESURÉE (aucun corps de bordereau n'est gardé en base) :
//  un texte qui ne nomme aucun transporteur rend '' — l'écran dit alors
//  « Transporteur inconnu », comme avant.
// ════════════════════════════════════════════════════════════════════════════

const sansAccents = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Des NOMS propres, en mots entiers. L'ordre ne compte pas : on compte les clés.
const NOMS = [
  ['mondialrelay', /\bmondial[\s-]?relay\b/],
  ['chronopost', /\bchronopost\b/],
  ['shop2shop', /\bshop\s?2\s?shop\b/],
  ['relaiscolis', /\brelais[\s-]colis\b/],
  ['colissimo', /\bcolissimo\b/],
  ['vinted', /\bvinted[\s-]go\b/],
  // (11 nov., lot DJ3 — Julien : « tu mets InPost mais InPost appartient à Mondial Relay ») « Mondial Relay by InPost » :
  // en France, InPost est le réseau Mondial Relay ⇒ la MÊME clé (les deux noms ensemble = un seul transporteur).
  ['mondialrelay', /\binpost\b/],
  ['ups', /\bups\b/],
  ['dpd', /\bdpd\b/],
  ['gls', /\bgls\b/],
  ['colisprive', /\bcolis[\s-]prive\b/],
  ['dhl', /\bdhl\b/],
];

// Les clés de transporteurs nommées dans un texte (Set).
export function transporteursNommes(texte) {
  const s = sansAccents(texte).replace(/\s+/g, ' ');
  const out = new Set();
  if (!s.trim()) return out;
  for (const [cle, re] of NOMS) if (re.test(s)) out.add(cle);
  // Shop2Shop est le réseau de Chronopost : les deux noms ensemble = Chronopost.
  if (out.has('shop2shop') && out.has('chronopost')) out.delete('shop2shop');
  return out;
}

// Le transporteur de l'e-mail : la clé si UN seul est nommé, sinon ''.
export function transporteurDeTexteBordereau(texte) {
  const t = transporteursNommes(texte);
  return t.size === 1 ? [...t][0] : '';
}

// (9 nov.) LE N° MONDIAL RELAY ÉCRIT DANS L'E-MAIL DU BORDEREAU : 8 chiffres après
// « N° de suivi » (cet e-mail = CETTE transaction : une identité, jamais devinée).
// La MÊME règle à la réception (`parseBordereauEmail`) et pour les anciens
// bordereaux (api/_lib/transporteur-anciens.js). Le premier n° écrit, comme la
// réception. Rend { n, fin } (fin = indice juste après le n°) ou null.
const RE_SUIVI_MR = /N[°ºo]?\s*de\s*suivi\s*:?\s*(\d{8})(?!\d)/i;
export function suiviMondialRelayLu(texte) {
  const s = String(texte == null ? '' : texte);
  const m = RE_SUIVI_MR.exec(s);
  return m ? { n: m[1], fin: m.index + m[0].length } : null;
}
export const suiviMondialRelayDuTexte = (texte) => { const l = suiviMondialRelayLu(texte); return l ? l.n : ''; };
