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
import { useMemo } from 'react';

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
export function paresseux(fn, nom, ecran) {
  let fait = false, v;
  const val = () => {
    if (!fait) {
      v = fn(); fait = true; compterCalcul(nom, ecran);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => paresseux(fn, nom, ecran), deps);
}

// La même chose pour une valeur qui n'est pas un objet simple (une `Map`, une liste) : rend une FONCTION de lecture,
// même identité tant que les dépendances ne changent pas ; le calcul tourne au premier appel, une fois.
export function lecteurParesseux(fn, nom, ecran) {
  let fait = false, v;
  return () => { if (!fait) { v = fn(); fait = true; compterCalcul(nom, ecran); } return v; };
}
export function useLecteurParesseux(fn, deps, nom, ecran) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => lecteurParesseux(fn, nom, ecran), deps);
}
