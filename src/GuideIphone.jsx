// ══════════════════════════════════════════════════════════════════════════════
// « INSTALLER VRM SUR L'IPHONE » — trois gestes illustrés (5 novembre)
// ══════════════════════════════════════════════════════════════════════════════
// Rendu dans Paramètres → Notifications (`PushSetting`), là où l'app disait déjà
// en une ligne « installe d'abord l'app sur ton écran d'accueil ». La règle (qui
// le voit, quand il se ferme, le texte) : src/guideIphone.js. Les dessins sont
// en SVG (aucune capture réelle) : la barre de Safari et son bouton Partager, la
// feuille de partage et sa ligne « Sur l'écran d'accueil », l'écran d'accueil
// avec l'icône VRM et une notification. Neutres ; l'accent seulement sur LE
// geste de chaque dessin (§7).
import React from 'react';
import './design/guide-iphone.css';
import { guideIphoneVisible, estInstallee, lireFerme, noterFerme, etapesGuideIphone } from './guideIphone.js';

// La décision, lue une fois au montage, et le geste qui ferme (et retient).
export function useGuideIphone() {
  const [visible, setVisible] = React.useState(() => {
    try { return guideIphoneVisible({ installee: estInstallee(), ferme: lireFerme() }); } catch (_) { return false; }
  });
  const fermer = React.useCallback(() => { noterFerme(); setVisible(false); }, []);
  return [visible, fermer];
}

const DessinPartager = () => (
  <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
    <rect className="gi-ecran" x="20" y="4" width="80" height="80" rx="12" />
    <rect className="gi-ligne" x="30" y="16" width="60" height="6" rx="3" />
    <rect className="gi-ligne gi-pale" x="30" y="28" width="44" height="6" rx="3" />
    <path className="gi-barre" d="M20 56h80v16a12 12 0 0 1-12 12H32a12 12 0 0 1-12-12z" />
    <rect className="gi-contour" x="20" y="4" width="80" height="80" rx="12" />
    <path className="gi-trait" d="M34 70h6M80 70h6" />
    <circle className="gi-halo" cx="60" cy="70" r="11" />
    <g className="gi-accent-trait">
      <path d="M55 68v7h10v-7" />
      <path d="M60 62v9M57 65l3-3 3 3" />
    </g>
  </svg>
);
const DessinAccueil = () => (
  <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
    <rect className="gi-ecran" x="16" y="6" width="88" height="78" rx="12" />
    <rect className="gi-ligne gi-pale" x="26" y="16" width="68" height="10" rx="5" />
    <rect className="gi-ligne gi-pale" x="26" y="32" width="68" height="10" rx="5" />
    <rect className="gi-choix" x="22" y="48" width="76" height="16" rx="6" />
    <rect className="gi-accent-trait" x="28" y="51" width="10" height="10" rx="2.5" />
    <path className="gi-accent-trait" d="M33 53.5v5M30.5 56h5" />
    <rect className="gi-ligne" x="44" y="53" width="44" height="6" rx="3" />
    <rect className="gi-ligne gi-pale" x="26" y="70" width="68" height="10" rx="5" />
  </svg>
);
const DessinNotifs = () => (
  <svg viewBox="0 0 120 84" aria-hidden="true" focusable="false">
    <rect className="gi-ecran" x="20" y="4" width="80" height="80" rx="12" />
    <rect className="gi-bandeau" x="26" y="10" width="68" height="16" rx="6" />
    <rect className="gi-ligne" x="40" y="14" width="44" height="3" rx="1.5" />
    <rect className="gi-ligne gi-pale" x="40" y="20" width="32" height="3" rx="1.5" />
    <rect className="gi-vrm" x="29" y="13" width="9" height="9" rx="2.5" />
    {[0, 1, 2].map((c) => [0, 1].map((l) => (c === 1 && l === 1 ? null
      : <rect key={c + '-' + l} className="gi-app" x={32 + c * 22} y={36 + l * 22} width="14" height="14" rx="4" />)))}
    <rect className="gi-vrm" x="54" y="58" width="14" height="14" rx="4" />
    <circle className="gi-pastille" cx="67" cy="59" r="4" />
  </svg>
);
const DESSINS = { partager: DessinPartager, accueil: DessinAccueil, notifications: DessinNotifs };

export default function GuideIphone({ onFermer }) {
  const etapes = etapesGuideIphone();
  return (
    <section className="vrm-gi" data-guide-iphone="" aria-labelledby="vrm-gi-titre">
      <div className="vrm-gi-tete">
        <div className="vrm-gi-titres">
          <h3 id="vrm-gi-titre" className="vrm-gi-titre">Installer VRM sur l’iPhone</h3>
          <p className="vrm-gi-sous">Sur iPhone, les notifications passent par l’app sur l’écran d’accueil. Trois gestes.</p>
        </div>
        <button type="button" className="vrm-gi-fermer" data-guide-iphone-fermer="" aria-label="Fermer le guide d’installation" onClick={onFermer}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
      <ol className="vrm-gi-etapes">
        {etapes.map((e, i) => {
          const Dessin = DESSINS[e.cle];
          return (
            <li key={e.cle} className="vrm-gi-etape" data-guide-etape={e.cle}>
              <div className="vrm-gi-dessin">{Dessin ? <Dessin /> : null}</div>
              <div className="vrm-gi-texte">
                <span className="vrm-gi-n" aria-hidden="true">{i + 1}</span>
                <b className="vrm-gi-etape-titre">{e.titre}</b>
                <span className="vrm-gi-etape-texte">{e.texte}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
