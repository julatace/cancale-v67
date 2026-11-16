// ════════════════════════════════════════════════════════════════════════════
//  LES DONNÉES QUI ARRIVENT EN RAFALE, RENDUES PAR LOTS (16 nov., lot vitesse-volume)
//
//  Mesuré à 20 000 ventes (téléphone 390, processeur ×4) : à l'ouverture, ~45 lectures de la base
//  arrivent une par une pendant plusieurs secondes ; chacune posait SON état dans le moteur
//  `Comptabilite` et chacune redemandait un rendu complet (Ventes : 34 rendus avant « prêt », ~0,3 s
//  chacun ; Achats : 62 ; Ma journée : 22). La plupart de ces rendus étaient aussitôt périmés par la
//  lecture suivante.
//
//  `useStateLot` est `useState`, avec UNE différence : une mise à jour qui n'est ni un geste de la
//  personne (clic, frappe, toucher…), ni posée pendant un rendu, attend le LOT suivant. Un lot part :
//   · tout de suite (tâche suivante) quand aucune lecture n'est en vol — les données sont là ;
//   · sinon après un temps égal au coût du dernier lot (borné 50 ms – 600 ms) : le processeur n'est
//     jamais occupé plus de la moitié du temps par des rendus périmés.
//  Toutes les mises à jour d'un lot sont posées dans la MÊME tâche (React les rend en un seul rendu),
//  dans l'ordre d'arrivée ; une mise à jour fonctionnelle reçoit l'état précédent, comme avant.
//  Un geste vide la file d'abord (dans la même tâche) : l'ordre n'est jamais inversé.
//
//  RIEN NE CHANGE DANS CE QUI EST CALCULÉ : les mêmes mises à jour, dans le même ordre, sur les
//  mêmes états — seuls des rendus intermédiaires disparaissent. Le dernier état (celui qu'on lit,
//  qu'on publie) est le même (banc `chiffres-volume` + `compare-chiffres-volume`, au centime).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';

const GESTES = new Set(['click', 'dblclick', 'auxclick', 'contextmenu', 'input', 'change', 'submit', 'reset', 'keydown', 'keyup', 'keypress',
  'pointerdown', 'pointerup', 'pointercancel', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchcancel', 'focus', 'blur', 'focusin', 'focusout',
  'compositionend', 'paste', 'cut', 'drop', 'dragend', 'select', 'toggle', 'beforeinput']);
const COUT_MIN = 50, COUT_MAX = 600;

const file = [];
let minuteur = null, minuteurImmediat = false, cout = 0, enVol = 0, actif = true;

const internes = (() => { try { return React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED || null; } catch (_) { return null; } })();
// Pendant le rendu d'un composant, le distributeur de crochets est celui du rendu (ses `useMemo` et
// `useCallback` sont deux fonctions). Hors rendu, c'est celui qui refuse tout (une seule fonction pour tous).
export const pendantUnRendu = () => {
  try {
    const d = internes && internes.ReactCurrentDispatcher && internes.ReactCurrentDispatcher.current;
    return !!(d && d.useMemo !== d.useCallback);
  } catch (_) { return true; }
};
const pendantUnGeste = () => {
  try { const e = typeof window !== 'undefined' ? window.event : null; return !!(e && e.isTrusted !== false && GESTES.has(e.type)); } catch (_) { return true; }
};

export function viderLot() {
  if (minuteur) { clearTimeout(minuteur); minuteur = null; }
  if (!file.length) return;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const lot = file.splice(0, file.length);
  for (const [poser, suite] of lot) { try { poser(suite); } catch (e) { setTimeout(() => { throw e; }, 0); } }
  // Le coût du lot : jusqu'à ce que la page reprenne la main (le rendu que React a programmé passe avant).
  setTimeout(() => { const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now(); cout = Math.max(0, t1 - t0); }, 0);
}

function planifier() {
  if (enVol <= 0) {
    if (minuteur && minuteurImmediat) return;
    if (minuteur) clearTimeout(minuteur);
    minuteurImmediat = true; minuteur = setTimeout(viderLot, 0); return;
  }
  if (minuteur) return;
  minuteurImmediat = false;
  minuteur = setTimeout(viderLot, Math.min(COUT_MAX, Math.max(COUT_MIN, cout)));
}

// Les lectures en vol : la file attend tant que des réponses arrivent encore ; la dernière arrivée
// libère le lot aussitôt.
export function noterLectureDebut() { enVol++; }
export function noterLectureFin() { enVol = Math.max(0, enVol - 1); if (enVol === 0 && file.length) planifier(); }

if (typeof window !== 'undefined' && typeof window.fetch === 'function' && !window.__vrmLotRendus) {
  try {
    window.__vrmLotRendus = true;
    const orig = window.fetch;
    window.fetch = function (...args) {
      noterLectureDebut();
      let p;
      try { p = orig.apply(this, args); } catch (e) { noterLectureFin(); throw e; }
      // La lecture finit quand son CORPS est lu (l'appelant pose son état juste après, dans la même
      // tâche) : on rend la main une tâche plus tard. Un corps jamais lu libère au bout de 3 s.
      let fini = false;
      const fin = () => { if (fini) return; fini = true; setTimeout(noterLectureFin, 0); };
      return Promise.resolve(p).then((rep) => {
        try {
          if (rep && typeof rep === 'object') for (const m of ['json', 'text', 'arrayBuffer', 'blob']) {
            const f = rep[m]; if (typeof f !== 'function') continue;
            rep[m] = function () { return Promise.resolve(f.apply(rep, arguments)).finally(fin); };
          }
        } catch (_) {}
        setTimeout(fin, 3000);
        return rep;
      }, (e) => { fin(); throw e; });
    };
  } catch (_) {}
}

// Pour les bancs et un réglage de secours : `window.__vrmLotRendusOff = true` rend chaque mise à jour tout de suite.
const lotActif = () => { try { return actif && !(typeof window !== 'undefined' && window.__vrmLotRendusOff); } catch (_) { return actif; } };

export function useStateLot(init) {
  const [v, poser] = React.useState(init);
  const ref = React.useRef(null);
  if (!ref.current) ref.current = (suite) => {
    if (!lotActif() || pendantUnRendu() || pendantUnGeste()) { if (file.length) viderLot(); poser(suite); return; }
    file.push([poser, suite]); planifier();
  };
  return [v, ref.current];
}

export const _pourBanc = { etat: () => ({ file: file.length, enVol, cout, actif }), couper: (x) => { actif = !x; } };

// (16 nov.) UNE réponse par RENDU : une construction sans argument (`cartesColis`, `listeEnvoyes`…) appelée
// plusieurs fois pendant LE MÊME rendu rend la première réponse ; hors d'un rendu (un geste, un effet), elle est
// toujours recalculée. La mémoire part à la fin du calcul synchrone (microtâche) : jamais la réponse d'un
// rendu d'avant.
export function unParRendu(fn) {
  let pris = false, v;
  return function () {
    if (!pendantUnRendu()) return fn.apply(this, arguments);
    if (pris) return v;
    v = fn.apply(this, arguments); pris = true;
    queueMicrotask(() => { pris = false; v = undefined; });
    return v;
  };
}
