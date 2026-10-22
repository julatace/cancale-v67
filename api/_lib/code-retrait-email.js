// ── LE CODE DE RETRAIT ÉCRIT « … CODE DE RETRAIT SUIVANT AU COMMERÇANT : 123456 »
// (22 octobre). UNE règle, lue par la route des emails (api/email-inbound.js,
// à l'arrivée) ET par l'app (src/App.jsx, `reclassifyTrack`, pour les lignes
// déjà rangées qui ne seront jamais réécrites) — §11.
//
// MESURÉ (lecture seule, sa base) : l'email Chronopost « Votre colis VINTED est
// arrivé en relais Pickup » du 22 octobre dit « communiquez le code de retrait
// suivant au commer&ccedil;ant :  NNNNNN ». Les motifs de la route ne le lisaient
// pas : le mot « suivant » et « au commerçant » séparent le libellé du nombre,
// et l'entité HTML `&ccedil;` n'est pas décodée par `htmlToText`. Sur 8 emails
// Chronopost « arrivé au point de retrait », 3 seulement portaient leur code.
//
// ⚠️ ON NE PREND QUE LES CHIFFRES QUI SUIVENT LA TOURNURE, SUR LA MÊME LIGNE :
//    · « code de retrait suivant » puis au plus 40 caractères SANS chiffre ni
//      deux-points ni retour à la ligne (« au commerçant », entités HTML
//      comprises), puis « : », puis 4 à 10 chiffres et rien d'autre collé ;
//    · un nombre sur la ligne SUIVANTE n'est pas pris (il pourrait être un code
//      postal : « mieux vaut un blanc qu'un faux », §5) ;
//    · le mot « suivant » lui-même n'est jamais un code (il n'a aucun chiffre).
const TOURNURE = /code\s+de\s+retrait\s+suivant\b[^\n\d:：]{0,40}[:：][ \t\u00a0*_]*(\d{4,10})(?![\d.,/-]\d)(?!\d)/i;

export function codeRetraitTournure(texte) {
  const m = TOURNURE.exec(String(texte == null ? '' : texte));
  return m ? m[1] : '';
}
