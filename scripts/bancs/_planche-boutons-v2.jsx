// La planche des boutons du nouveau design (banc design-v2) : chaque rôle × chaque état, le VRAI composant
// (src/designV2/BoutonV2.jsx) et la VRAIE feuille de style (src/designV2/design-v2.css), sur le fond du Studio.
// « Enfoncé » et « focus » sont forcés par `data-v2b-force` (les mêmes déclarations que :active et :focus-visible).
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/design/studio.css';
import '../../src/design/studio-verre.css';
import { BoutonV2, BoutonIconeV2 } from '../../src/designV2/BoutonV2.jsx';

const ic = (d) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const imprimante = ic(<><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/></>);
const croix = ic(<path d="m6 6 12 12M18 6 6 18"/>);
const ETATS = [['repos', {}], ['enfonce', { 'data-v2b-force': 'appui' }], ['focus', { 'data-v2b-force': 'focus' }], ['indisponible', null], ['chargement', null]];
const ROLES = [['principal', 'Imprimer 5 bordereaux', imprimante], ['secondaire', 'Voir les codes', null], ['texte', 'J’ai retiré', null], ['destructif', 'Supprimer l’annonce', null]];
function Planche() {
  return (
    <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '120px repeat(5, 260px)', gap: '18px 16px', alignItems: 'start', fontFamily: '-apple-system, system-ui, sans-serif', color: 'var(--v2-page-texte)' }}>
      <span/>{ETATS.map(([e]) => <b key={e} style={{ fontSize: 13 }}>{e}</b>)}
      {ROLES.map(([r, lib, icone]) => (
        <React.Fragment key={r}>
          <b style={{ fontSize: 13, paddingTop: 14 }}>{r}</b>
          {ETATS.map(([e, a]) => (
            <div key={e} data-planche={r + ':' + e} style={r === 'principal' ? { padding: 8 } : { padding: 8, borderRadius: 14, background: 'var(--v2-carte)', color: 'var(--sv-encre)' }}>
              <BoutonV2 role={r} plein={r === 'principal'} icone={icone} attrs={a || {}} indisponible={e === 'indisponible'} raison={e === 'indisponible' ? 'Aucun bordereau prêt : ils arrivent par e-mail.' : ''}
                chargement={e === 'chargement'} confirmer={() => false}>{lib}</BoutonV2>
            </div>))}
        </React.Fragment>))}
      <b style={{ fontSize: 13, paddingTop: 10 }}>icône</b>
      {ETATS.slice(0, 3).map(([e, a]) => <div key={e} data-planche={'icone:' + e} style={{ padding: 8, color: 'var(--v2-page-texte)' }}><BoutonIconeV2 icone={croix} label="Fermer" attrs={a || {}}/></div>)}
    </div>
  );
}
createRoot(document.getElementById('r')).render(<Planche/>);
