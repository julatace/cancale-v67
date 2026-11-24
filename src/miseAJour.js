// ══════════════════════════════════════════════════════════════════════════════
// UNE NOUVELLE VERSION DE VRM — LA RÈGLE (11 nov., lot app-installable)
// ══════════════════════════════════════════════════════════════════════════════
// Avant : dès qu'un déploiement était vu, la page se RECHARGEAIT toute seule, au
// milieu d'une saisie s'il le fallait. Et le service worker rechargeait aussi à
// chaque changement de sa propre version.
// Maintenant (src/main.jsx, `autoUpdate`) :
//   · rien n'est encore montré (écran de démarrage) et aucun champ n'est en
//     cours ⇒ on recharge : rien n'est perdu ;
//   · l'app revient après 10 min cachée, sans champ en cours ⇒ on recharge
//     (iOS l'a souvent déjà fermée : c'est une ouverture) ;
//   · sinon ⇒ « Mettre à jour » discret (src/MiseAJour.jsx), une fois par
//     version : fermé, il ne revient pas pour CETTE version.
// Jamais bloqué sur une vieille version : le service worker range la nouvelle
// coquille derrière (public/sw.js, `relireCoquille`), l'ouverture suivante l'a.
// Pur : aucune lecture du navigateur ici (audit-app-installable l'exécute).

export const CLE_MAJ_REFUSEE = 'vrm_maj_refusee';
export const CACHEE_LONGTEMPS_MS = 10 * 60 * 1000;
// (16 nov., lot anti-bug) Julien : « plus d'écran blanc après une mise à jour ». Une page restée sur l'ANCIENNE
// version finit par demander un morceau que le serveur n'a plus. Elle se recharge donc aussi, ouverte et
// visible, AU BON MOMENT : aucun champ en cours, aucune feuille ouverte, et rien touché depuis
// `CALME_MS` (on ne recharge jamais sous le doigt). Sinon : « Nouvelle version · Mettre à jour », comme avant.
// L'écran courant est gardé (src/repriseEcran.js), une fois par version (src/chargementSur.js : jamais une boucle).
export const CALME_MS = 30 * 1000;

// 'rien' · 'recharger' · 'proposer'
export function decisionMaj({ actuelle, serveur, demarrageVisible = false, saisieEnCours = false, cacheeDepuisMs = null, refusee = null, feuilleOuverte = false, calmeDepuisMs = null } = {}) {
  if (!serveur || !actuelle || serveur === actuelle) return 'rien';
  if (!saisieEnCours && demarrageVisible) return 'recharger';
  if (!saisieEnCours && typeof cacheeDepuisMs === 'number' && cacheeDepuisMs >= CACHEE_LONGTEMPS_MS) return 'recharger';
  if (refusee && refusee === serveur) return 'rien';
  if (!saisieEnCours && !feuilleOuverte && typeof calmeDepuisMs === 'number' && calmeDepuisMs >= CALME_MS) return 'recharger';
  return 'proposer';
}

// Une feuille, un panneau ou une confirmation ouverts (portails de l'app) : on ne recharge pas dessous.
export const SELECTEUR_FEUILLE = '.vrm-sheet, [role="dialog"], [aria-modal="true"], [data-garde-feuille]';

// Un champ en cours de saisie : un texte touché, jamais une case à cocher.
export function estSaisie(el) {
  if (!el || typeof el !== 'object') return false;
  if (el.isContentEditable) return true;
  const t = String(el.tagName || '').toUpperCase();
  if (t === 'TEXTAREA' || t === 'SELECT') return true;
  if (t !== 'INPUT') return false;
  const ty = String(el.type || 'text').toLowerCase();
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'hidden', 'image'].includes(ty);
}
