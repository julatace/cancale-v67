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

// (15 nov., chantier « ouverture ») LA PROGRESSION HONNÊTE de l'écran de démarrage : le rail avance à de
// VRAIS jalons, jamais au temps qui passe — page lue (0,12, index.html), app lancée (0,3, src/main.jsx),
// morceau de l'app téléchargé (0,6), coque montée qui attend ses données (0,82), écran prêt (1). Elle ne
// recule jamais. Aucun nombre n'est écrit à l'écran.
export const JALONS = { page: 0.12, lancee: 0.3, telechargee: 0.6, coque: 0.82, pret: 1 };
export function etapeDemarrage(p) {
  try {
    const el = typeof document !== 'undefined' && document.getElementById('vrm-demarrage');
    const v = typeof p === 'string' ? JALONS[p] : Number(p);
    if (!el || !(v > 0)) return;
    const avant = Number(el.style.getPropertyValue('--vrm-boot-p')) || JALONS.page;
    if (v > avant) el.style.setProperty('--vrm-boot-p', String(Math.min(1, v)));
  } catch (_) {}
}

export function finDemarrage(raison = '') {
  if (fini || typeof document === 'undefined') return;
  fini = true;
  try { if (obs) obs.disconnect(); } catch (_) {}
  obs = null;
  const el = document.getElementById('vrm-demarrage');
  try { window.__vrmDemarrage = { fin: Math.round(performance.now()), raison: String(raison || '') }; } catch (_) {}
  // (14 nov.) L'instantané peint dans l'écran de démarrage (src/OuvertureInstantanee.jsx) part avec lui.
  try { window.dispatchEvent(new Event('vrm:demarrage-fin')); } catch (_) {}
  // Le fond « en verre » du document (index.html, `data-vrm-boot`) part APRÈS l'écran de démarrage : pendant le
  // fondu, ce qui est dessous est la coque, et autour d'elle encore le même bleu — jamais un éclair blanc.
  const finFond = () => { try { document.documentElement.removeAttribute('data-vrm-boot'); } catch (_) {} };
  if (!el) { finFond(); return; }
  etapeDemarrage('pret');
  let reduit = false;
  try { reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
  if (reduit) { el.remove(); finFond(); return; }
  el.setAttribute('data-sortie', '');
  el.setAttribute('aria-busy', 'false');
  setTimeout(() => { try { el.remove(); } catch (_) {} finFond(); }, 380);
}

// Une page qui ne montre qu'une attente garde l'écran de démarrage.
export const pageEnAttente = (root) => !root || !root.childElementCount || !!root.querySelector(SELECTEUR_ATTENTE);
// (20 nov., affichage instantané) La copie d'un écran a été peinte AVANT l'app (src/OuvertureInstantanee.jsx,
// `window.__vrmApercuEcran`) : tant que la coque de l'app montre un AUTRE écran (elle part sur Aujourd'hui puis
// reprend l'écran demandé), l'écran de démarrage — et la copie — restent devant ; 8 s au plus. Pas de coque
// (connexion, porte, double vérification) : rien n'est retenu.
export const DELAI_ECRAN_COPIE_MS = 8000;
export function autreEcranQueLaCopie(root) {
  try {
    const e = typeof window !== 'undefined' && window.__vrmApercuEcran;
    if (!e || !e.ecran || performance.now() - (e.t || 0) > DELAI_ECRAN_COPIE_MS) return false;
    const m = root && root.querySelector('.vrm-main[data-ecran]');
    return !!m && m.getAttribute('data-ecran') !== e.ecran;
  } catch (_) { return false; }
}

export function suivreDemarrage() {
  if (typeof document === 'undefined' || fini) return;
  const root = document.getElementById('root');
  if (!document.getElementById('vrm-demarrage')) { fini = true; try { document.documentElement.removeAttribute('data-vrm-boot'); } catch (_) {} return; }
  etapeDemarrage('lancee');
  if (!root) { finDemarrage('sans-racine'); return; }
  const voir = () => {
    if (!pageEnAttente(root) && !autreEcranQueLaCopie(root)) { finDemarrage('contenu'); return; }
    // La coque est montée et attend ses données (src/AttenteEcran.jsx) : un jalon de plus.
    try { if (root.querySelector('[data-demarrage-attente]')) etapeDemarrage('coque'); } catch (_) {}
  };
  try {
    obs = new MutationObserver(voir);
    obs.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-demarrage-attente', 'data-confidentialite', 'data-equipe-attente', 'data-demarrage-vrm', 'data-ecran'] });
    // La retenue de la copie a une fin : on revoit la page à son terme.
    setTimeout(() => { if (!fini) voir(); }, DELAI_ECRAN_COPIE_MS + 50);
  } catch (_) { finDemarrage('sans-observateur'); return; }
  voir();
}
