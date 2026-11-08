// ═══════════════════════════════════════════════════════════════════════════
// L'ÉTAT « PAS SU » — une phrase et UN bouton (5 nov., revue de cohérence 1.10)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 5 nov. : cinq dessins d'une lecture ratée (bandeau ambre, carte
// vide, « 0,00 € », texte gris seul, emoji). §5 : « pas su » ne vaut pas « oui »
// et « rien lu » ne vaut pas « rien » — une lecture ratée se DIT, avec sa
// raison, et le seul geste utile est de relire. §2.7 : une alerte qui ne dit
// pas quoi faire ne sert à rien.
// Le dessin : neutre (ce n'est ni une erreur rouge ni un geste ambre de métier),
// une phrase « {quoi} : pas su pour l’instant. », la raison dessous, UN bouton
// secondaire « Réessayer » (occupé pendant la relecture si `onReessayer` rend
// une promesse). Sans `onReessayer`, pas de bouton : la raison dit le geste.
//
// ⚠️ Il ne remplace PAS `BaseInjoignable` (App.jsx) : celle-ci dit la panne de
// TOUTE la base, une fois, dans la coque, avec les gestes du propriétaire.
// `EtatPanne` dit la panne d'UN bloc (une carte, une liste) à sa place.
// API : <EtatPanne quoi raison? onReessayer? compact? className? {...data-*}>
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { PAS_SU, VERBES } from '../libelles.js';

export function EtatPanne({ quoi, raison, onReessayer, compact = false, className = '', ...rest }) {
  const [occupe, setOccupe] = React.useState(false);
  const vivant = React.useRef(true);
  React.useEffect(() => () => { vivant.current = false; }, []);
  const relire = () => {
    if (!onReessayer || occupe) return;
    let r; try { r = onReessayer(); } catch (_) { r = null; }
    if (r && typeof r.then === 'function') {
      setOccupe(true);
      r.then(() => {}, () => {}).then(() => { if (vivant.current) setOccupe(false); });
    }
  };
  return (
    <div role="status" className={`vrm-etat-panne${compact ? ' vrm-etat-panne-compact' : ''}${className ? ' ' + className : ''}`} data-etat-panne="" {...rest}>
      <span className="vrm-etat-panne-repere" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19 11a7 7 0 1 0-2 6M19 5v6h-6" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
      <div className="vrm-etat-panne-texte">
        <p className="vrm-etat-panne-phrase">{PAS_SU.phrase(quoi || 'Cette lecture')}</p>
        <p className="vrm-etat-panne-raison">{raison || PAS_SU.sansRaison}</p>
      </div>
      {onReessayer ? (
        <button type="button" className="vrm-b vrm-b-secondaire vrm-etat-panne-bouton" data-etat-panne-reessayer="" onClick={relire}
          disabled={occupe} aria-busy={occupe ? 'true' : undefined}>
          {occupe ? PAS_SU.enCours : VERBES.reessayer}
        </button>
      ) : null}
    </div>
  );
}

export default EtatPanne;
