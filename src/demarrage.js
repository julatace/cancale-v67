// ════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN DE DÉMARRAGE (6 nov., Julien : « Quand ça bug je ne veux pas que ça
//  soit comme ça, les données apparaissent de partout, je veux qu'il y ait de
//  vrais écrans de chargement »).
//
//  `#vrm-demarrage` est écrit dans index.html (styles en ligne, aucun script) :
//  il couvre la page AVANT le JavaScript. Il reste tant que la page ne montre
//  qu'une ATTENTE — racine vide, morceau de l'app en téléchargement
//  (`data-demarrage-vrm`), session pas encore lue, vérification de la boutique,
//  équipe en lecture, et la coque dont l'écran d'ouverture n'est pas prêt
//  (`data-demarrage-attente`, src/AttenteEcran.jsx). Dès que la racine montre
//  autre chose (l'écran prêt, la page d'accueil, la connexion, une panne), il
//  part en fondu. Aucune règle « au bout de N secondes » ici : l'écran de la
//  coque a son propre plafond (~2,5 s), et un écran qui n'est pas une attente
//  (connexion, panne, erreur) n'a rien à attendre.
// ════════════════════════════════════════════════════════════════════════════
export const SELECTEUR_ATTENTE = '[data-demarrage-attente],[data-demarrage-vrm],[data-equipe-attente],[data-confidentialite="verification"]';
let fini = false;
let obs = null;

export function finDemarrage(raison = '') {
  if (fini || typeof document === 'undefined') return;
  fini = true;
  try { if (obs) obs.disconnect(); } catch (_) {}
  obs = null;
  const el = document.getElementById('vrm-demarrage');
  try { window.__vrmDemarrage = { fin: Math.round(performance.now()), raison: String(raison || '') }; } catch (_) {}
  if (!el) return;
  let reduit = false;
  try { reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
  if (reduit) { el.remove(); return; }
  el.setAttribute('data-sortie', '');
  el.setAttribute('aria-busy', 'false');
  setTimeout(() => { try { el.remove(); } catch (_) {} }, 230);
}

// Une page qui ne montre qu'une attente garde l'écran de démarrage.
export const pageEnAttente = (root) => !root || !root.childElementCount || !!root.querySelector(SELECTEUR_ATTENTE);

export function suivreDemarrage() {
  if (typeof document === 'undefined' || fini) return;
  const root = document.getElementById('root');
  if (!document.getElementById('vrm-demarrage')) { fini = true; return; }
  if (!root) { finDemarrage('sans-racine'); return; }
  const voir = () => { if (!pageEnAttente(root)) finDemarrage('contenu'); };
  try {
    obs = new MutationObserver(voir);
    obs.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-demarrage-attente', 'data-confidentialite', 'data-equipe-attente', 'data-demarrage-vrm'] });
  } catch (_) { finDemarrage('sans-observateur'); return; }
  voir();
}
