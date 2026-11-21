// ════════════════════════════════════════════════════════════════════════════
//  L'ENVOI VU DANS LE FIL — Leboncoin, Vestiaire, eBay (12 nov., demande de
//  Julien : « fais les messages Vestiaire, etc. », la refonte de Messages ·
//  Vinted du 11 nov. appliquée aux autres sites).
//
//  Ce fichier ne change AUCUNE règle d'envoi (compte de l'onglet, 50 actions/h,
//  recettes apprises `lbc_envoi` / `vc_envoi`, route eBay `repondre` confirmée) :
//  il dit seulement, à partir de ce que l'extension ou la route a RÉPONDU, ce que
//  le fil montre sous la bulle :
//    · 'envoi'     — la requête est partie, pas encore de réponse (« Envoi… ») ;
//    · 'ok'        — le site l'a accepté (« Envoyé ✓ ») ;
//    · 'refuse'    — rien n'est parti, c'est SÛR (« Pas envoyé · Réessayer » :
//                    SON clic renvoie, le texte reste dans le champ) ;
//    · 'incertain' — on ne sait pas (« Pas confirmé · vérifie sur … ») : rien
//                    ne propose de renvoyer, un doublon chez l'acheteur est pire
//                    qu'un message à revérifier.
//  « Pas su » ne vaut pas « oui » (§5) : une réponse absente ou d'une forme
//  inconnue est 'incertain', jamais 'ok' ni 'refuse'.
//  Règle pure : ni React, ni réseau (scripts/audit-envoi-fil.cjs).
// ════════════════════════════════════════════════════════════════════════════

// Une commande de l'extension (`lbcRepondre`, `vcRepondre`) :
//   { accepte:false, raison }               ⇒ refusée AVANT tout envoi : 'refuse'
//   { accepte:true, etape:'fait' }          ⇒ 'ok'
//   { accepte:true, etape:'refuse' }        ⇒ le site a dit non : 'refuse'
//   { accepte:true, etape:'incertain' }     ⇒ 'incertain'
//   rien, ou une autre forme                ⇒ 'incertain'
export function etatEnvoiExtension(r) {
  if (!r || typeof r !== 'object') return 'incertain';
  if (r.accepte === false) return 'refuse';
  if (r.accepte === true && r.etape === 'fait') return 'ok';
  if (r.accepte === true && r.etape === 'refuse') return 'refuse';
  return 'incertain';
}

// La route eBay `repondre` (src/ebayRequetes.js) : une réponse rendue ⇒ 'ok' ;
// une erreur marquée `reason:'incertain'` (délai, coupure) ⇒ 'incertain' ;
// une erreur dite par eBay ou par la route (refus net) ⇒ 'refuse'.
export function etatEnvoiEbay(erreur) {
  if (!erreur) return 'ok';
  return erreur && erreur.reason === 'incertain' ? 'incertain' : 'refuse';
}

// Le message envoyé est-il DÉJÀ dans le fil relu ? (alors la bulle d'envoi ne le
// redit pas : seul « Envoyé ✓ » reste, sous la bulle lue). Par le TEXTE exact
// d'un message « de toi » arrivé après le départ — un fil ne se relie qu'à
// lui-même ici, ce n'est pas une identité de paire.
export function dejaDansFil(messages, texte, depuis = 0) {
  const t = String(texte || '').trim();
  if (!t || !Array.isArray(messages)) return false;
  return messages.some((m) => m && m.deMoi === true && String(m.t || '').trim() === t
    && (!depuis || !Date.parse(m.at || '') || Date.parse(m.at) >= depuis - 120000));
}

// Un fil VIDE n'est pas « aucun message » quand la liste en annonce un (§4.1) :
// c'est une lecture incomplète ⇒ « pas encore lu · Relire ».
export function filPasLu(messages, annonce) {
  const vide = !Array.isArray(messages) || messages.length === 0;
  return vide && !!annonce;
}
