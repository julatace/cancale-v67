// ═══════════════════════════════════════════════════════════════════════════
// « METTRE À JOUR VRM » (15 nov., chantier « ouverture »)
// Ce que montrent les garde-fous (GardeEcran, le dernier filet de main.jsx) quand
// un MORCEAU de l'app n'a pas pu se charger (src/chargementSur.js, `estErreurMorceau`) :
// ce n'est pas « un écran qui a un souci », c'est une page restée sur une ancienne
// version (ou sans réseau). Une phrase, UN bouton : il oublie la coquille gardée par
// le service worker et relit la page (la nouvelle version), sans garde de répétition
// (c'est son geste). Jamais le message technique.
// Styles en ligne, couleurs neutres : il peut s'afficher AVANT que les feuilles de
// l'app soient là (le dernier filet).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { rechargerVersNouvelle } from '../chargementSur.js';

export default function MettreAJourVRM({ pleinEcran = false }) {
  const [enCours, setEnCours] = React.useState(false);
  const horsLigne = typeof navigator !== 'undefined' && navigator.onLine === false;
  const go = () => { setEnCours(true); rechargerVersNouvelle({ raison: 'bouton', force: true }).then((ok) => { if (!ok) setEnCours(false); }); };
  const carte = (
    <div role="alert" data-mettre-a-jour-vrm="" style={{ maxWidth: 420, width: '100%', margin: '0 auto', boxSizing: 'border-box', padding: '22px 20px',
      borderRadius: 22, background: 'rgba(255,255,255,.86)', color: '#0C1D30', boxShadow: '0 18px 40px -22px rgba(8,26,50,.55)',
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif', textAlign: 'left' }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 650, letterSpacing: '-.01em' }}>{tr('maj.titre')}</p>
      <p style={{ margin: '8px 0 16px', fontSize: 14, lineHeight: 1.45, color: '#3B4B5E' }}>{tr(horsLigne ? 'maj.texteHorsLigne' : 'maj.texte')}</p>
      <button type="button" onClick={go} disabled={enCours} data-mettre-a-jour-geste=""
        style={{ minHeight: 48, width: '100%', border: 0, borderRadius: 14, background: '#0C1D30', color: '#fff', fontSize: 16, fontWeight: 600,
          fontFamily: 'inherit', cursor: 'pointer', opacity: enCours ? .6 : 1 }}>{tr('maj.bouton')}</button>
    </div>
  );
  if (!pleinEcran) return <div style={{ padding: '24px 16px' }}>{carte}</div>;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22, boxSizing: 'border-box',
      background: 'radial-gradient(120% 60% at 15% 0%,#9CC8F2 0%,rgba(156,200,242,0) 55%),linear-gradient(170deg,#2C71BE 0%,#174C88 45%,#0F2F57 100%)' }}>
      {carte}
    </div>
  );
}
