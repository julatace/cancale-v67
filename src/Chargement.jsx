import React from 'react';
import './styles-chargement.css';

export function DemarrageVRM() {
  return <main className="vrm-demarrage" aria-busy="true" data-demarrage-vrm="">
    <section role="status" aria-live="polite" className="vrm-demarrage-carte">
      <img src="/vrm-icon-v5-192.png" alt="" width="56" height="56"/>
      <h1>VRM</h1>
      <p>Ouverture de ton espace…</p>
      <span className="vrm-demarrage-rail" aria-hidden="true"><span/></span>
    </section>
  </main>;
}

export function SqueletteChargement({ variant = 'row', count = 6 }) {
  const n = Number.isFinite(Number(count)) ? Math.max(1, Math.min(12, Math.floor(Number(count)))) : 6;
  const cards = variant === 'card';
  return <div className={'vrm-skeleton ' + (cards ? 'is-cartes' : 'is-lignes')} role="status" aria-label={cards ? 'Chargement des articles' : 'Chargement de la liste'} aria-busy="true" aria-live="polite">
    {Array.from({ length: n }, (_, i) => <div key={i} className="vrm-skeleton-element" aria-hidden="true">
      <span className="vrm-skeleton-photo vrm-skeleton-reflet"/>
      <span className="vrm-skeleton-texte"><span className="vrm-skeleton-titre vrm-skeleton-reflet"/><span className="vrm-skeleton-detail vrm-skeleton-reflet"/></span>
    </div>)}
  </div>;
}
