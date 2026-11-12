// ════════════════════════════════════════════════════════════════════════════
//  UNE LONGUE LISTE SE REND PAR PAQUETS (11 nov., lot « limites-client »)
//
//  Julien : « un client qui a 5 000 annonces ne doit pas ralentir l'app ».
//  Mesuré (scripts/bancs/limites-client.cjs) : Annonces rendait les 5 000
//  fiches d'un coup — 451 000 éléments dans la page, 38 s de fil principal
//  bloqué, page figée (même la capture d'écran ne passait plus).
//
//  Règle : on ne rend que les `max` premières lignes, DANS L'ORDRE de la liste
//  (le tri et les filtres ne changent pas) ; rien n'est caché — le total est
//  écrit (« 72 sur 5 000 »), la suite arrive toute seule en approchant du bas
//  (IntersectionObserver), et un bouton la demande si l'observateur manque.
//  La recherche porte toujours sur TOUTE la liste (elle filtre avant).
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef } from 'react';

// Le paquet : 72 = 2, 3, 4, 6 ou 8 colonnes pleines.
export const PAQUET_LISTE = 72;

// Des groupes `{ items }` bornés à `max` lignes EN TOUT, dans l'ordre :
// chaque groupe garde ses `items` (son total) et reçoit `montres`.
// Un groupe dont aucune ligne n'est montrée est retiré (sa tête viendra avec la suite).
export function groupesBornes(groupes, max) {
  let reste = Number.isFinite(max) && max >= 0 ? max : Infinity;
  const out = [];
  for (const g of groupes || []) {
    const items = Array.isArray(g && g.items) ? g.items : [];
    if (reste <= 0) break;
    const montres = items.slice(0, reste);
    reste -= montres.length;
    if (montres.length) out.push({ ...g, montres });
  }
  return out;
}

// La suite : « 72 sur 5 000 · Voir les 72 suivantes ». Rien quand tout est montré.
export function SuitePaquets({ montres, total, onPlus, pas = PAQUET_LISTE, mot = 'annonces' }) {
  const ref = useRef(null);
  const reste = Math.max(0, (total || 0) - (montres || 0));
  useEffect(() => {
    if (!reste || !ref.current || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) onPlus(); }, { rootMargin: '800px 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [reste, montres, onPlus]);
  if (!reste) return null;
  const n = Math.min(pas, reste);
  return (
    <div ref={ref} className="vrm-suite-paquets" data-suite-paquets={montres} data-suite-total={total}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '16px 0' }}>
      <span style={{ fontSize: 13, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{montres.toLocaleString('fr-FR')} sur {total.toLocaleString('fr-FR')} {mot}</span>
      <button type="button" className="vrm-b vrm-b-secondaire" onClick={onPlus} style={{ minHeight: 44 }}>Voir les {n} suivantes</button>
    </div>
  );
}
