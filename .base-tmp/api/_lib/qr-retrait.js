// ════════════════════════════════════════════════════════════════════════════
//  LE QR DE RETRAIT VINTED GO : PROUVÉ, OU RIEN (14 nov., capture de Julien)
//  « Il n'y a pas le QR code qui est présent dans l'application » (Vinted Go,
//  colis réacheminé). Le QR de retrait Vinted Go n'est PAS le code saisi mis en
//  image : c'est une image servie par Vinted Go à une adresse qui porte le n° de
//  suivi, le code ET une signature de 64 caractères hexadécimaux
//    http://p.vintedgo.com/public/v1/qr_codes/{n° de suivi}:{code}:{signature}?email_code=…&time=…
//  Mesuré (lecture seule, 14 nov.) : 37 adresses de QR Vinted Go en base, les 37
//  de cette forme, signature de 64 caractères chaque fois ; sur les 26 lignes
//  qui portent un n° et un code, les 26 ont le MÊME n° et le MÊME code que leur
//  ligne. ⇒ VRM ne FABRIQUE jamais ce QR (la signature ne se déduit de rien) ;
//  il montre l'image de Vinted Go, et seulement quand l'adresse désigne CE colis
//  (§5 : un QR faux au guichet = un colis refusé).
//  ⚠️ Les 37 adresses portent `&amp;` (l'adresse a été lue dans un attribut HTML
//  sans être décodée) : le paramètre `time` partait sous le nom « amp;time ».
//  Une règle, partagée par la route (api/email-inbound.js) et l'app (`qrImage`).
// ════════════════════════════════════════════════════════════════════════════

// Une adresse lue dans un attribut HTML : ses entités sont décodées (`&amp;` ⇒ `&`).
export function urlQrPropre(u) {
  return String(u == null ? '' : u).trim()
    .replace(/&amp;/gi, '&').replace(/&#0*38;/g, '&').replace(/&#x0*26;/gi, '&');
}

const QR_VINTEDGO = /^https?:\/\/p\.vintedgo\.com\/public\/v1\/qr_codes\/([^:/?#]+):([^:/?#]+):([0-9a-f]{64})(?:[?#]|$)/i;
const norm = (v) => String(v == null ? '' : v).toUpperCase().replace(/[\s -]+/g, '').trim();

// L'identité écrite dans l'adresse d'un QR Vinted Go : { suivi, code } — ou null (pas un QR Vinted Go).
export function identiteQrVintedGo(u) {
  const m = QR_VINTEDGO.exec(urlQrPropre(u));
  if (!m) return null;
  let s = m[1], c = m[2];
  try { s = decodeURIComponent(s); c = decodeURIComponent(c); } catch (_) { /* gardé tel quel */ }
  return { suivi: norm(s), code: norm(c) };
}
// L'adresse ressemble à un QR Vinted Go (même hôte, même chemin) sans en avoir la forme complète.
const VINTEDGO_QR_HOTE = /^https?:\/\/p\.vintedgo\.com\/public\/v1\/qr_codes\//i;

// Le QR d'un colis à retirer, jugé sur SON identité (n° de suivi et code de la ligne).
//   'prouve'     : un QR Vinted Go dont le n° ET/OU le code sont ceux de la ligne, et rien de contraire ;
//   'contredit'  : un QR Vinted Go d'un AUTRE n° ou d'un AUTRE code — jamais montré ;
//   'inconnu'    : un QR Vinted Go qu'aucune identité de la ligne ne relie (ligne sans n° ni code) — jamais montré ;
//   'autre'      : une adresse d'un autre transporteur (Chronopost Pickup Pass…) — la règle d'avant s'applique.
export function jugerQrDuColis(u, ligne = {}) {
  const url = urlQrPropre(u);
  if (!url) return 'autre';
  const id = identiteQrVintedGo(url);
  if (!id) return VINTEDGO_QR_HOTE.test(url) ? 'inconnu' : 'autre';
  const s = norm(ligne && ligne.suivi), c = norm(ligne && ligne.code);
  if ((s && s !== id.suivi) || (c && c !== id.code)) return 'contredit';
  if ((s && s === id.suivi) || (c && c === id.code)) return 'prouve';
  return 'inconnu';
}

// L'adresse à afficher pour ce QR (décodée), ou '' quand elle ne désigne pas ce colis.
export function urlQrDuColis(u, ligne = {}) {
  const j = jugerQrDuColis(u, ligne);
  if (j === 'contredit' || j === 'inconnu') return '';
  return urlQrPropre(u);
}
