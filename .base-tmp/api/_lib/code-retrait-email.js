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

// ── LE CODE LU APRÈS UN LIBELLÉ, ET CE QUI N'EST JAMAIS UN CODE (1er nov.) ────
// Audit des codes de retrait (scripts/audit-codes-retrait.cjs). Un code faux se
// lit en gros devant le comptoir : Julien se déplace pour rien. Des formes
// trompaient la route (et une ligne déjà rangée garde ce qu'elle a reçu) :
//   · le libellé SEUL sur sa ligne (« Présentez votre code de retrait », le code
//     n'étant que dans l'image du QR) et l'adresse dessous : « 56000 Vannes »
//     devenait le code. Un nombre pris sur la ligne SUIVANTE doit y être SEUL
//     (une case de tableau : « Code de retrait : » puis « 123456 ») ;
//   · le nombre est le n° de suivi (« Votre code de retrait : » puis le n° du
//     colis) : un code de retrait n'est jamais le n° de suivi du même colis ;
//   · le nombre est le code postal du lieu lu dans le même e-mail.
// « Mieux vaut un blanc qu'un faux » (§5) : sans code, l'app dit « code pas lu —
// ouvre l'e-mail du transporteur », jamais un nombre inventé.
// `m` : un résultat de RegExp dont le DERNIER groupe capturé est le nombre.
export function nombreSurSaLigne(texte, m) {
  if (!m) return false;
  const s = String(texte == null ? '' : texte);
  const nombre = m[m.length - 1] == null ? '' : String(m[m.length - 1]);
  const fin = m.index + m[0].length;
  const debut = fin - nombre.length;
  if (!/\n/.test(s.slice(m.index, debut))) return true;      // libellé et nombre sur la même ligne
  const finLigne = s.indexOf('\n', fin);
  return /^[\s*_.]*$/.test(s.slice(fin, finLigne < 0 ? s.length : finLigne));
}
const normCode = (v) => String(v == null ? '' : v).toUpperCase().replace(/[\s -]+/g, '');
// Rend la raison ('suivi' · 'code-postal') quand ce « code » n'en est pas un, sinon ''.
export function codeImpossible(code, ligne = {}) {
  const c = normCode(code);
  if (!c) return '';
  const su = normCode(ligne && ligne.suivi);
  if (su && su === c) return 'suivi';
  const lieu = String((ligne && ligne.lieu) || '');
  if (/^\d{5}$/.test(c) && new RegExp(`(?:^|\\D)${c}\\s+[A-Za-zÀ-ÿ]`).test(lieu)) return 'code-postal';
  return '';
}
