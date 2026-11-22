// ════════════════════════════════════════════════════════════════════════════
//  UNE LONGUE LISTE SE POSE PAR PAQUETS, SANS RIEN DIRE (22 nov., latence-totale)
//
//  Julien : « l'app bug beaucoup trop ». Mesuré (banc fluidite-generale, 390 px, CPU ×4) :
//  toucher Achats prenait 2,2 s avant la première image, Ventes 1 s — l'écran gardé, revenu tel
//  quel, devait recalculer le style et la mise en page de TOUTES ses rangées (Achats : 8 340
//  éléments, dont 140 colis « à vérifier » et 140 « en route » ; Ventes : 70 colis à envoyer).
//  Le style d'un élément coûte ici ~4 400 sélecteurs : seul le NOMBRE d'éléments posés compte.
//
//  Règle : on pose les `initial` premières rangées, DANS L'ORDRE de la liste (ni tri ni filtre
//  changé), puis la suite par paquets de `pas` dès que le bas de la liste approche (à moins de
//  `marge` px du bas de la zone qui défile) — en tâche interruptible. Rien n'est caché ni
//  compté autrement : le total reste écrit par l'en-tête de la liste, la rangée qui manque arrive
//  avant que le doigt l'atteigne. Sans IntersectionObserver : tout est posé, comme avant.
//  ⚠️ Le repère ne porte aucun nombre (`data-par-paquets=""`) : le banc chiffres-volume relève les
//  nombres des attributs `data-*`, un compteur de paquets y passerait pour un chiffre de l'écran.
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';

export const PAQUET_INITIAL = 16;
export const PAQUET_PAS = 24;

// Le nombre de rangées à poser : `initial`, puis + `pas` à chaque approche du bas (jamais moins).
export function useParPaquets(total, { initial = PAQUET_INITIAL, pas = PAQUET_PAS, marge = 1200 } = {}) {
  const sansObservateur = typeof IntersectionObserver !== 'function';
  const [n, setN] = useState(initial);
  const ref = useRef(null);
  const reste = sansObservateur ? 0 : Math.max(0, (total || 0) - n);
  useEffect(() => {
    const el = ref.current;
    if (!reste || !el) return undefined;
    // La zone qui défile (`.vrm-main`) : la marge s'applique à ELLE (avec la fenêtre pour racine, un conteneur qui défile
    // rogne la cible sans marge — la suite n'arriverait qu'une fois la sentinelle à l'écran).
    const zone = el.closest('.vrm-main') || null;
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) React.startTransition(() => setN((v) => v + pas));
    }, { root: zone, rootMargin: `${marge}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [reste, n, pas, marge]);
  const montres = sansObservateur ? (total || 0) : Math.min(n, total || 0);
  const sentinelle = reste ? <div ref={ref} className="vrm-par-paquets" data-par-paquets="" aria-hidden="true" style={{ height: 1 }}/> : null;
  return [montres, sentinelle];
}

// La même règle en composant (posable dans une branche de JSX) : `rendre(item, i)` dessine une rangée.
export function ParPaquets({ items, rendre, initial, pas, marge }) {
  const L = Array.isArray(items) ? items : [];
  const [n, sentinelle] = useParPaquets(L.length, { initial, pas, marge });
  return <>{L.slice(0, n).map((x, i) => rendre(x, i))}{sentinelle}</>;
}
