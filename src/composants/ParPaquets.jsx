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
//  `marge` px sous la fenêtre). Rien n'est caché ni compté autrement :
//  le total reste écrit par l'en-tête de la liste, la rangée qui manque arrive avant que le doigt
//  l'atteigne. Hors navigateur (rendu sans fenêtre) : tout est posé, comme avant.
//  ⚠️ Le repère ne porte aucun nombre (`data-par-paquets=""`) : le banc chiffres-volume relève les
//  nombres des attributs `data-*`, un compteur de paquets y passerait pour un chiffre de l'écran.
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';

export const PAQUET_INITIAL = 12;
export const PAQUET_PAS = 24;

// Le nombre de rangées à poser : `initial`, puis + `pas` à chaque approche du bas (jamais moins).
// ⚠️ Pas d'IntersectionObserver : une rangée de colis vit dans une carte à coins ronds (`overflow: hidden`) — l'observateur
// rogne la cible par CHAQUE ancêtre qui coupe, sans marge : la suite n'arrivait qu'une fois la sentinelle à l'écran, un
// paquet par geste (mesuré au banc chiffres-volume, 1512). Ici : la place de la sentinelle relue à l'image qui suit un
// défilement (n'importe quelle zone : écoute en capture), un repli ouvert (`toggle`), un changement de taille — et après
// chaque paquet. Une sentinelle sans boîte (repli fermé, écran gardé caché, `display: none`) ne fait rien venir.
// ⚠️ Mise à jour ordinaire, PAS une transition : une transition se rend avec toutes les autres en cours, et une seule
// retenue (un écran gardé qui attend) retenait la suite sans fin (banc chiffres-volume : aucun paquet en 30 s). Un paquet
// de 24 rangées est un petit rendu.
export function useParPaquets(total, { initial = PAQUET_INITIAL, pas = PAQUET_PAS, marge = 800 } = {}) {
  const sansFenetre = typeof window === 'undefined' || typeof requestAnimationFrame !== 'function';
  const [n, setN] = useState(initial);
  const ref = useRef(null);
  // (25 nov., train #1388 — « un achat pas montré est un colis caché ») LE DERNIER PAQUET, INCOMPLET, EST TOUJOURS POSÉ : ce qui
  // reste après les rangées montrées tient dans un paquet (`pas`) ⇒ tout est posé maintenant, sans attendre un défilement.
  // Mesuré : « En route » ouvert montrait 12 achats sur 13 (banc colis-retirer-propre) — la 13e attendait que la sentinelle,
  // sous l'écran, soit approchée. Une liste plus longue garde sa fenêtre ; son dernier paquet vient avec l'avant-dernier.
  const enAttente = sansFenetre ? 0 : Math.max(0, (total || 0) - n);
  const reste = enAttente <= pas ? 0 : enAttente;
  useEffect(() => {
    if (!reste) return undefined;
    let image = 0, fini = false, avance = 0;
    // (23 nov., latence-2) Au montage, la suite ne vient que si la sentinelle est DANS la fenêtre (liste plus courte que l'écran) ;
    // la marge ne joue qu'au défilement. Avant, le montage faisait venir des paquets jusqu'à `marge` px sous la fenêtre : un
    // écran gardé revenait avec ~2× plus de rangées que l'écran n'en montre, toutes à recalculer à chaque retour.
    const verifier = () => {
      image = 0; const el = ref.current;
      if (fini || !el || !el.getClientRects().length) return;
      if (el.getBoundingClientRect().top < (window.innerHeight || 800) + avance) { fini = true; setN((v) => v + pas); }
    };
    const bientot = () => { if (!image && !fini) image = requestAnimationFrame(verifier); };
    const defile = () => { avance = marge; bientot(); };
    // Après un paquet venu par défilement, la marge reste (la suite continue tant que le bas approche).
    if (n > initial) avance = marge;
    window.addEventListener('scroll', defile, { capture: true, passive: true });
    window.addEventListener('resize', bientot, { passive: true });
    document.addEventListener('toggle', bientot, true);
    bientot();
    return () => { fini = true; if (image) cancelAnimationFrame(image); window.removeEventListener('scroll', defile, { capture: true }); window.removeEventListener('resize', bientot); document.removeEventListener('toggle', bientot, true); };
  }, [reste, n, pas, marge, initial]);
  const montres = sansFenetre || !reste ? (total || 0) : Math.min(n, total || 0);
  const sentinelle = reste ? <div ref={ref} className="vrm-par-paquets" data-par-paquets="" aria-hidden="true" style={{ height: 1 }}/> : null;
  return [montres, sentinelle];
}

// La même règle en composant (posable dans une branche de JSX) : `rendre(item, i)` dessine une rangée.
export function ParPaquets({ items, rendre, initial, pas, marge }) {
  const L = Array.isArray(items) ? items : [];
  const [n, sentinelle] = useParPaquets(L.length, { initial, pas, marge });
  return <>{L.slice(0, n).map((x, i) => rendre(x, i))}{sentinelle}</>;
}
