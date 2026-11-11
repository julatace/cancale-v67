// ── LE STOCK EN 2D, EXPLIQUÉ EN 10 SECONDES (5 nov. 2026) ─────────────────────
// Julien : « un motion design pour l'expliquer à qui découvre ». Trois temps,
// dessinés en SVG et animés en CSS (aucune bibliothèque) :
//   1. une annonce (N°12) part dans une case de l'étagère ;
//   2. elle est vendue : sa case s'allume (l'accent, jamais le rouge — §7) ;
//   3. le colis part : la case se libère toute seule.
// ⚠️ DONNÉES INVENTÉES (N°12, « Air Max 90 · 42 », N°3, N°7) — jamais les siennes
//    (dépôt public ; et il filmera VRM).
// ⚠️ « Réduire les animations » : RIEN ne bouge — une image fixe (l'article dans
//    sa case, vendue) et les trois phrases lisibles d'un coup (`data-anime="0"`).
import React from 'react';
import './styles-stock-2d.css';

const reduit = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

// La silhouette d'une basket (inventée, neutre), dans un repère 0..100 × 0..60.
const BASKET = 'M6 40 C6 30 14 28 22 27 L40 16 C46 13 52 16 54 22 L58 30 C70 31 86 33 92 40 C96 44 94 50 88 50 L12 50 C8 50 6 46 6 40 Z';
// (11 nov., lot DJ2) Hors Sneakers : une étiquette de prix (un article), jamais une basket.
const ETIQUETTE = 'M30 14 H62 L88 34 L62 54 H30 C26 54 24 52 24 48 V20 C24 16 26 14 30 14 Z M36 30 a4 4 0 1 0 0.1 0 Z';

export default function StockExplication({ onFermer = null, sneakers = true }) {
  const [anime] = React.useState(() => !reduit());
  // Étagère : 3 colonnes × 2 rangées, une planche au milieu. La case visée :
  // rangée 1, colonne 2 (x 205, y 44, 40 × 42).
  const cases = [];
  const X = [160, 205, 250], Y = [44, 118];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) cases.push({ r, c, x: X[c], y: Y[r] });
  const pleines = { '0:2': 'N°7', '1:0': 'N°3' };
  return (
    <section className="vrm-sx" data-stock-explication="" data-anime={anime ? '1' : '0'} aria-label="Comment marche le Stock">
      <div className="vrm-sx-tete">
        <span className="vrm-sx-titre">Comment marche le Stock</span>
        {onFermer && <button type="button" className="vrm-sx-fermer" onClick={onFermer} aria-label="Fermer l’explication" data-stock-explication-fermer="">×</button>}
      </div>
      <svg className="vrm-sx-scene" viewBox={anime ? '0 0 320 184' : '140 4 170 176'} data-cadre={anime ? 'film' : 'fixe'} role="img" aria-label="Une annonce N°12 va dans une case de l’étagère ; vendue, sa case s’allume ; le colis part et la case se libère.">
        {/* L'étagère : deux montants, un chapeau, une planche, un socle. */}
        <g className="vrm-sx-meuble">
          <rect x="150" y="34" width="150" height="6" rx="3" className="vrm-sx-bois" />
          <rect x="150" y="34" width="6" height="140" rx="3" className="vrm-sx-bois" />
          <rect x="294" y="34" width="6" height="140" rx="3" className="vrm-sx-bois" />
          <rect x="156" y="89" width="138" height="6" rx="3" className="vrm-sx-bois" />
          <rect x="150" y="163" width="150" height="8" rx="3" className="vrm-sx-bois" />
          {cases.map((k) => {
            const p = pleines[k.r + ':' + k.c];
            const cible = k.r === 0 && k.c === 1;
            return (
              <g key={k.r + ':' + k.c}>
                <rect x={k.x} y={k.y} width="40" height="42" rx="6" className={p ? 'vrm-sx-case-pleine' : cible ? 'vrm-sx-case-cible' : 'vrm-sx-case'} />
                {p && <text x={k.x + 20} y={k.y + 25} textAnchor="middle" className="vrm-sx-mini">{p}</text>}
              </g>
            );
          })}
          {/* La case visée, allumée quand l'article est vendu. */}
          <rect x="202" y="41" width="46" height="48" rx="6" className={'vrm-sx-halo' + (anime ? '' : ' is-fixe')} />
          <g className={'vrm-sx-tag' + (anime ? '' : ' is-fixe')}>
            <rect x="199" y="12" width="52" height="18" rx="9" className="vrm-sx-tag-fond" />
            <text x="225" y="25" textAnchor="middle" className="vrm-sx-tag-txt">{sneakers ? 'Vendue' : 'Vendu'}</text>
          </g>
          <g className={'vrm-sx-libre' + (anime ? '' : ' is-cache')}>
            <path d="M218 65 l5 5 l9 -10" className="vrm-sx-coche" />
          </g>
        </g>
        {/* L'annonce : photo, N°, titre. Elle part dans la case. */}
        <g className="vrm-sx-carte" transform={anime ? undefined : 'translate(199.2 32.3) scale(0.3636)'}>
          <rect x="16" y="50" width="110" height="80" rx="12" className="vrm-sx-carte-fond" />
          <rect x="22" y="56" width="98" height="46" rx="6" className="vrm-sx-photo" />
          <path d={sneakers ? BASKET : ETIQUETTE} fillRule="evenodd" transform="translate(29 59) scale(0.84 0.84)" className="vrm-sx-basket" data-sx-dessin={sneakers ? 'basket' : 'etiquette'} />
          <rect x="22" y="108" width="36" height="16" rx="8" className="vrm-sx-chip" />
          <text x="40" y="120" textAnchor="middle" className="vrm-sx-chip-txt">N°12</text>
          <text x="64" y="120" className="vrm-sx-legende">{sneakers ? 'Air Max 90' : 'Article'}</text>
        </g>
        {/* Le colis qui part. */}
        <g className={'vrm-sx-colis' + (anime ? '' : ' is-cache')}>
          <rect x="60" y="138" width="30" height="24" rx="4" className="vrm-sx-colis-fond" />
          <path d="M60 146 h30 M75 138 v8" className="vrm-sx-colis-trait" />
        </g>
      </svg>
      <ol className="vrm-sx-etapes">
        <li className="vrm-sx-etape" data-etape="1"><b>1</b><span>Crée ton meuble, puis glisse chaque article dans sa case.</span></li>
        <li className="vrm-sx-etape" data-etape="2"><b>2</b><span>Vendu : sa case s’allume jusqu’à ce que tu l’enlèves.</span></li>
        <li className="vrm-sx-etape" data-etape="3"><b>3</b><span>Colis parti : la case se libère, le numéro reste.</span></li>
      </ol>
    </section>
  );
}
