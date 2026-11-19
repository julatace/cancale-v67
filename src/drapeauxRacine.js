// ════════════════════════════════════════════════════════════════════════════
//  LES DRAPEAUX DE RACINE (19 nov., « ça charge beaucoup trop lentement entre les onglets »).
//
//  Une règle « .vrm-main:has(.vrm-fu-colis) .x » fait de `.vrm-main` une ancre que le navigateur restyle EN ENTIER
//  (tous ses descendants) à la moindre modification du DOM qui touche un mot d'un argument de `:has()` — mesuré : tout
//  le document, 13 000 éléments sur Achats, 0,8 à 2,3 s au ×4 (scripts/alleger-has.cjs, banc onglets-trace).
//  `scripts/alleger-has.cjs --ecrire` remplace dans les feuilles chaque `:has(ARG)` porté par html, body, #root,
//  `.vrm-app-shell` ou `.vrm-main` par un ATTRIBUT `data-vrm-<mot>` de cette ancre, et écrit la table
//  (src/drapeauxRacine.table.js). Ce module pose les attributs : pour chaque drapeau, l'ancre porte `data-vrm-<mot>` si et
//  seulement si elle correspond à `:has(ARG)` — la question est posée au navigateur lui-même (`element.matches`), donc la même
//  réponse que la règle d'avant. Un attribut qui change n'invalide que les descendants nommés par SES règles.
//
//  QUAND : à l'import (avant le premier rendu), puis à chaque modification du DOM qui PEUT changer une réponse — un
//  élément ajouté ou retiré qui porte (ou contient) une classe, un attribut ou un identifiant nommé par un argument,
//  ou un de ces attributs qui change. Les autres modifications ne coûtent qu'un filtre. L'observateur répond avant
//  l'image suivante (micro-tâche) ; un écran qui se MESURE dans son effet de mise en page appelle d'abord
//  `rafraichirDrapeaux()` (src/AttenteEcran.jsx le fait pour chaque écran) : les mots sont justes avant la mesure.
//  Table vide (aucune feuille réécrite) : ce module ne fait rien, n'observe rien.
// ════════════════════════════════════════════════════════════════════════════
import { DRAPEAUX } from './drapeauxRacine.table.js';

export const ATTR_DRAPEAUX = 'data-vrm';   // l'attribut d'un drapeau : data-vrm-<mot> (« data-vrm-d5 »)
const elementsDe = (a) => {
  try {
    if (a === 'html') return [document.documentElement];
    if (a === 'body') return document.body ? [document.body] : [];
    return [...document.querySelectorAll(a)];
  } catch (_) { return []; }
};
// Ce qu'un argument nomme : classes, attributs, identifiants. (Aucun argument de racine ne repose sur une balise seule
// ou un état — :checked, :hover — ; `alleger-has --prouve` le vérifie sur la table.)
export function motsDe(s) {
  const nu = String(s || '').replace(/"[^"]*"|'[^']*'/g, '""');
  return { classes: [...nu.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]), attributs: [...nu.matchAll(/\[\s*([a-zA-Z_][\w-]*)/g)].map((m) => m[1]), ids: [...nu.matchAll(/#(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]) };
}
const CLASSES = new Set(), ATTRIBUTS = new Set(), IDS = new Set();
for (const d of DRAPEAUX) { const m = motsDe(d.s); m.classes.forEach((x) => CLASSES.add(x)); m.attributs.forEach((x) => ATTRIBUTS.add(x)); m.ids.forEach((x) => IDS.add(x)); const a = motsDe(d.a); a.classes.forEach((x) => CLASSES.add(x)); a.ids.forEach((x) => IDS.add(x)); }
const echapper = (x) => { try { return CSS.escape(x); } catch (_) { return x; } };
const UNION = [...[...CLASSES].map((c) => '.' + echapper(c)), ...[...ATTRIBUTS].map((a) => '[' + a + ']'), ...[...IDS].map((i) => '#' + echapper(i))].join(',');
const PAR_ANCRE = new Map();
for (const d of DRAPEAUX) { if (!PAR_ANCRE.has(d.a)) PAR_ANCRE.set(d.a, []); PAR_ANCRE.get(d.a).push(d); }

let evaluations = 0;
// Pose les mots, maintenant. Rend le nombre d'ancres dont l'attribut a changé.
export function evaluerDrapeaux() {
  if (!DRAPEAUX.length || typeof document === 'undefined') return 0;
  let change = 0; evaluations++;
  for (const [a, liste] of PAR_ANCRE) {
    for (const el of elementsDe(a)) {
      for (const d of liste) {
        let oui = false;
        try { oui = el.matches(':has(' + d.s + ')'); } catch (_) { /* `:has` inconnu ici : la règle d'avant ne s'appliquait pas non plus */ }
        const nom = ATTR_DRAPEAUX + '-' + d.m;
        if (oui !== el.hasAttribute(nom)) { change++; if (oui) el.setAttribute(nom, ''); else el.removeAttribute(nom); }
      }
    }
  }
  return change;
}
const touche = (n) => { try { return n.nodeType === 1 && (n.matches(UNION) || !!n.querySelector(UNION)); } catch (_) { return true; } };
function concerne(records) {
  for (const r of records) {
    if (r.type === 'attributes') {
      if (r.attributeName !== 'class') return true;                       // un attribut nommé (le filtre de l'observateur)
      const av = new Set(String(r.oldValue || '').split(/\s+/)), ap = new Set(String(r.target.getAttribute('class') || '').split(/\s+/));
      for (const c of CLASSES) if (av.has(c) !== ap.has(c)) return true;
      continue;
    }
    for (const n of r.addedNodes) if (touche(n)) return true;
    for (const n of r.removedNodes) if (touche(n)) return true;
  }
  return false;
}
let observateur = null;
// À appeler avant une MESURE faite dans le même rendu validé qu'un changement du DOM (l'observateur, lui, ne répond
// qu'à la micro-tâche suivante). Ne coûte rien quand rien de concerné n'a changé.
export function rafraichirDrapeaux() {
  if (!observateur) return 0;
  let r = []; try { r = observateur.takeRecords(); } catch (_) {}
  return r.length && concerne(r) ? evaluerDrapeaux() : 0;
}
export function demarrerDrapeaux() {
  if (!DRAPEAUX.length || observateur || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  evaluerDrapeaux();
  observateur = new MutationObserver((records) => { if (concerne(records)) evaluerDrapeaux(); });
  observateur.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'id', ...ATTRIBUTS] });
  // `<body>` peut ne pas exister encore à l'import (script en tête) : une passe quand le document est là.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => evaluerDrapeaux(), { once: true });
  try { window.__vrmDrapeaux = () => ({ n: DRAPEAUX.length, evaluations }); } catch (_) {}
}
demarrerDrapeaux();
