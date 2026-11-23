// ── STATISTIQUES D'UN COMPTE NEUF : LES TROIS ÉTATS (22 nov., choix n° 1 de Julien) ─────────────────────────────────
// Avant : un compte VRM sans aucun compte relié voyait l'ancien écran « Bienvenue » (logo, guide de démarrage, « Déjà des
// données ? ») PAR-DESSUS toutes les cartes de Statistiques, remplies de « — » et de 0 — un tableau de bord vide qui
// affirmait des riens. Maintenant UN état, un seul à la fois, dit par cette règle (pure, exécutée par
// scripts/audit-stats-nouveau.cjs) :
//   · 'attente' : les comptes ne sont pas encore lus et aucune vente n'est connue ⇒ le squelette, rien d'affirmé ;
//   · 'pasSu'   : la base n'a pas répondu et aucune vente n'est connue ⇒ « Je n'ai pas pu lire… » + Réessayer
//                 (« pas su » ne vaut pas « rien » : jamais « Aucune vente » sur une lecture ratée) ;
//   · 'vide'    : comptes LUS, aucun compte relié, aucune vente d'aucun site ⇒ le `Vide` natif (icône, une phrase,
//                 « Relier un compte ») ;
//   · null      : il y a quelque chose à montrer (une vente d'un site, ou un compte relié) ⇒ les statistiques.
// Une vente connue d'un site, QUEL QU'IL SOIT (Vinted, Leboncoin, eBay, Vestiaire : CLAUDE.md §2.11), suffit à montrer
// les statistiques : un vendeur Leboncoin sans compte Vinted n'est pas « neuf ».
const n = (x) => (Array.isArray(x) ? x.length : (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0));

export function etatStatsNouveau({ comptesLus = false, baseKO = false, nComptes = 0, ventes = [] } = {}) {
  const connues = (Array.isArray(ventes) ? ventes : [ventes]).reduce((s, v) => s + n(v), 0);
  if (connues > 0) return null;
  if (baseKO) return 'pasSu';
  if (!comptesLus) return 'attente';
  if (n(nComptes) === 0) return 'vide';
  return null;
}
