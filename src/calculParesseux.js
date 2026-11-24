// ════════════════════════════════════════════════════════════════════════════
//  CALCUL PARESSEUX (24 nov., `claude/vitesse-ecran-montre` — Julien : « l'app est bien trop lente »).
//  Récit : docs/passation/2026-11-24-vitesse-ecran-montre.md.
//
//  Chaque écran monte SA `Comptabilite`, qui recalculait à neuf TOUS ses gros `useMemo`, y compris ceux d'un autre écran
//  (les colis à retirer sur Annonces, les retours sur Achats). Un calcul « paresseux » rend la MÊME valeur que le `useMemo`
//  (même fonction, mêmes dépendances, même identité tant qu'elles ne changent pas) mais ne tourne qu'au PREMIER accès à
//  l'une de ses propriétés : un écran qui ne la lit pas ne la paie pas. Rien n'est deviné : quand un lecteur la lit, il lit
//  la valeur complète (jamais un `[]` ni un `0` de remplacement).
//
//  Le compteur `window.__vrmCalculs[nom][ecran]` (calculs faits, par écran) sert la garde
//  `scripts/bancs/calculs-ecran-montre.cjs` : 0 hors des écrans qui lisent le calcul.
// ════════════════════════════════════════════════════════════════════════════
import { useMemo, useRef } from 'react';

export function compterCalcul(nom, ecran) {
  try {
    const w = typeof window !== 'undefined' ? window : null; if (!w) return;
    const C = w.__vrmCalculs || (w.__vrmCalculs = {});
    const c = C[nom] || (C[nom] = {});
    const e = String(ecran || '?');
    c[e] = (c[e] || 0) + 1;
    if (w.__vrmCalculsPile) (w.__vrmPiles || (w.__vrmPiles = [])).push([nom, e, String(new Error().stack || '').split('\n').slice(2, 9).join(' < ')]);   // banc : QUI l'a lu
  } catch (_) { /* un compteur ne casse jamais l'écran */ }
}

// Un objet dont chaque lecture (propriété, `in`, clés, étalement) déclenche le calcul, une fois.
// `fn` doit rendre un OBJET (jamais `null`, un nombre ou une liste : un `Array.isArray` sur le mandataire dirait faux).
// (24 nov., vitesse-lectures-toucher) Le temps passé, par calcul et par écran (`window.__vrmCalculsMs`, lu par le banc).
export function compterDuree(nom, ecran, ms) {
  try {
    const w = typeof window !== 'undefined' ? window : null; if (!w || !w.__vrmCalculs) return;
    const C = w.__vrmCalculsMs || (w.__vrmCalculsMs = {}); const c = C[nom] || (C[nom] = {}); const e = String(ecran || '?');
    c[e] = Math.round(((c[e] || 0) + ms) * 10) / 10;
  } catch (_) { /* un compteur ne casse jamais l'écran */ }
}
const maintenantMs = () => { try { return performance.now(); } catch (_) { return Date.now(); } };
export function paresseux(fn, nom, ecran) {
  let fait = false, v;
  const val = () => {
    if (!fait) {
      const t0 = maintenantMs(); v = fn(); fait = true; compterCalcul(nom, ecran); compterDuree(nom, ecran, maintenantMs() - t0);
      if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error(`calculParesseux « ${nom} » : un objet était attendu`);
    }
    return v;
  };
  return new Proxy({}, {
    get: (_, k) => val()[k],
    has: (_, k) => k in val(),
    ownKeys: () => Reflect.ownKeys(val()),
    getOwnPropertyDescriptor: (_, k) => { const d = Reflect.getOwnPropertyDescriptor(val(), k); if (d) d.configurable = true; return d; },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  });
}

// Le `useMemo` paresseux : même liste de dépendances qu'un `useMemo`, le calcul tourne au premier accès.
export function useMemoParesseux(fn, deps, nom, ecran) {
  // (24 nov., vitesse-lectures-toucher) Banc seulement (`window.__vrmCalculsDeps`, CALCULS=deps) : à chaque calcul fait, les
  // dépendances qui ont CHANGÉ depuis le calcul précédent (leur rang dans la liste) — pour savoir quelle donnée le relance.
  const avant = useRef(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => paresseux(() => { noterDeps(nom, ecran, avant, deps); return fn(); }, nom, ecran), deps);
}
function noterDeps(nom, ecran, avant, deps) {
  try {
    const w = typeof window !== 'undefined' ? window : null;
    if (w && w.__vrmCalculsDeps) { const a = avant.current; (w.__vrmDeps || (w.__vrmDeps = [])).push([nom, String(ecran || '?'), a ? deps.map((d, i) => (Object.is(d, a[i]) ? -1 : i)).filter((i) => i >= 0).join(',') : 'premier']); }
    avant.current = deps;
  } catch (_) { /* un compteur ne casse jamais l'écran */ }
}

// La même chose pour une valeur qui n'est pas un objet simple (une `Map`, une liste) : rend une FONCTION de lecture,
// même identité tant que les dépendances ne changent pas ; le calcul tourne au premier appel, une fois.
export function lecteurParesseux(fn, nom, ecran) {
  let fait = false, v;
  return () => { if (!fait) { const t0 = maintenantMs(); v = fn(); fait = true; compterCalcul(nom, ecran); compterDuree(nom, ecran, maintenantMs() - t0); } return v; };
}
export function useLecteurParesseux(fn, deps, nom, ecran) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => lecteurParesseux(fn, nom, ecran), deps);
}

// ── (24 nov., vitesse-lectures-toucher) UNE DONNÉE RELUE À L'IDENTIQUE GARDE SON IDENTITÉ ──────────────────────────────
// Mesuré à la 1re visite d'Achats (banc vitesse-iphone, CALCULS=deps, volume de Julien) : `pickupUnion` était refait 5 fois
// par écran monté, et 3 de ces 5 fois ses entrées n'avaient changé que d'IDENTITÉ — un `Set` de n° relu à l'identique
// (`suivisEnvoyes`, `txSuivisColis`), une liste recalculée sur les mêmes commandes (`vintedToPickup`), une clé synchronisée
// relue telle quelle (`collected`, `pickupDone`). Ce test rend VRAI seulement quand le CONTENU est le même ; dans le doute
// (forme inconnue, contenu illisible), FAUX : la nouvelle valeur passe, comme avant. Rien n'est deviné.
export function memeContenu(a, b) {
  if (Object.is(a, b)) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  try {
    if (a instanceof Set || b instanceof Set) {
      if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
      for (const x of a) if (!b.has(x)) return false;
      return true;
    }
    if (a instanceof Map || b instanceof Map) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!(Array.isArray(a) && Array.isArray(b)) || a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;   // mêmes éléments, mêmes objets
      return true;
    }
    if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) return false;
    return JSON.stringify(a) === JSON.stringify(b);   // objet simple (une clé synchronisée) : même texte = même contenu
  } catch (_) { return false; }
}
// La valeur d'avant tant que le contenu ne change pas (même identité ⇒ les calculs qui la lisent ne repartent pas).
export function useMemeContenu(v) {
  const r = useRef(v);
  if (!Object.is(r.current, v) && !memeContenu(r.current, v)) r.current = v;
  return r.current;
}

// ── (24 nov., vitesse-lectures-toucher) UN CALCUL DE RENDU REFAIT SEULEMENT QUAND SES DONNÉES CHANGENT ──────────────────
// `cartesColis` et `listeEnvoyes` (src/ecrans/Comptabilite.jsx) étaient refaits à CHAQUE rendu (une fois par rendu, la
// mémoire tombait à la fin de la tâche) : mesuré à la 1re visite d'Achats, 13 à 18 fois par écran. Ici la valeur est gardée
// tant que la VERSION DES DONNÉES qu'il lit ne change pas : `cle()` rend la liste de tout ce que le calcul lit dans le
// composant (états, `useMemo`, propriétés — la liste est vérifiée par `scripts/audit-calcul-par-version.cjs`, qui refait
// l'analyse des lectures : une donnée lue absente de la liste ⇒ rouge). Une seule de ces identités qui change ⇒ recalcul.
// Et au plus `dureeMs` (60 s) : le calcul lit l'heure (« dernier jour demain », jours restants) — jamais plus vieux qu'avant
// d'une minute. Rend une FONCTION de lecture (comme avant), même valeur pour tous ses appels tant que rien ne change.
export function useCalculParVersion(fn, cle, nom, ecran, { dureeMs = 60000 } = {}) {
  const r = useRef(null);
  return () => {
    const k = cle(); const e = r.current; const t = Date.now();
    if (e && t - e.at < dureeMs && e.k.length === k.length && e.k.every((x, i) => Object.is(x, k[i]))) return e.v;
    try { const w = typeof window !== 'undefined' ? window : null; if (w && w.__vrmCalculsDeps) (w.__vrmDeps || (w.__vrmDeps = [])).push([nom, String(ecran || '?'), !e ? 'premier' : e.k.length !== k.length ? 'longueur' : (k.map((x, i) => (Object.is(x, e.k[i]) ? -1 : i)).filter((i) => i >= 0).join(',') || 'temps')]); } catch (_) {}
    const t0 = maintenantMs(); const v = fn(); compterDuree(nom, ecran, maintenantMs() - t0);
    r.current = { k, v, at: t };
    return v;
  };
}
