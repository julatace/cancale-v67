// ── L'APERÇU DE L'ANNONCE (14 nov., lot 128) ────────────────────────────────────
// Ouvert par « Aperçu » sur chaque fiche de « Créer sur Vinted » : la page d'article
// telle que l'acheteur la verra (photos, prix, détails, titre, description), dessinée
// ICI avec ses champs (src/apercuAnnonce.js). Aucune requête Vinted, aucun geste :
// « Fermer » seulement. Les frais de protection acheteur sont ceux de Vinted (dit).
import React from 'react';
import { createPortal } from 'react-dom';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { apercuAnnonce } from './apercuAnnonce.js';
import './styles-confort.css';

export default function ApercuAnnonce({ fiche, texte, photos, onFermer, zIndex = 20001 }) {
  useLangue();
  const a = apercuAnnonce(fiche, texte, photos);
  React.useEffect(() => { const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onFermer(); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); }, [onFermer]);
  const corps = (
    <div className="vrm-cf-voile vrm-cf" style={{ zIndex }} role="dialog" aria-modal="true" aria-label={tr('confort.apercu.titre')} data-apercu-annonce={a.pret ? 'pret' : 'incomplet'}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className="vrm-cf-feuille" style={{ background: 'var(--d-carte, #fff)' }}>
        <div className="vrm-cf-tete">
          <p className="vrm-cf-doux">{tr('confort.apercu.commeAcheteur')}</p>
          <button type="button" className="vrm-cf-x" aria-label={tr('confort.fermer')} onClick={onFermer} data-apercu-fermer="">×</button>
        </div>
        {a.photos.length ? <div className="vrm-ap-photos" data-apercu-photos={a.photos.length}>{a.photos.map((u, i) => <img key={i} src={u} alt="" loading={i ? 'lazy' : 'eager'} decoding="async"/>)}</div>
          : <div className="vrm-ap-vide" data-apercu-photos="0"><span className="vrm-cf-doux vrm-cf-geste">{tr('confort.apercu.sansPhoto')}</span></div>}
        <div className="vrm-cf-pile" style={{ gap: 6 }}>
          <h2 className="vrm-cf-titre" style={{ fontSize: 22 }} data-apercu-titre="">{a.titre || tr('confort.sansTitre')}</h2>
          <span className="vrm-ap-prix" data-apercu-prix="">{a.prix}</span>
          <p className="vrm-cf-doux">{tr('confort.apercu.frais')}</p>
        </div>
        {a.details.length ? <dl className="vrm-ap-details">{a.details.map(([k, v]) => <React.Fragment key={k}><dt>{tr('confort.apercu.' + k)}</dt><dd>{v}</dd></React.Fragment>)}</dl> : null}
        <p className="vrm-ap-desc" data-apercu-description="">{a.description || tr('confort.apercu.sansDescription')}</p>
        <button type="button" className="vrm-cf-second" onClick={onFermer}>{tr('confort.fermer')}</button>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(corps, document.body) : corps;
}
