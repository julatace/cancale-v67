// (11 nov., lot traduction) Le petit sélecteur de langue des pages SANS compte (accueil
// public, connexion) : un <select> natif (le clavier, le lecteur d'écran et le téléphone
// le savent déjà), chaque langue écrite dans sa langue. Le choix est rangé sur l'appareil
// (`vrm_langue`) ; une fois connecté, Paramètres → Langue le synchronise sur le compte.
import React from 'react';
import { LANGUES, NOMS_LANGUES, choisirLangue, tr } from './index.js';
import { useLangue } from './react.js';
export default function ChoixLangue({ className = '', style }) {
  const l = useLangue();
  return (
    <label className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, ...style }} data-choix-langue={l}>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{tr('reglages.langue.lib')}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>
      <select value={l} onChange={(e) => choisirLangue(e.target.value)}
        style={{ font: 'inherit', fontSize: 14, color: 'inherit', background: 'transparent', border: 0, padding: '8px 2px', cursor: 'pointer', minHeight: 44 }}>
        {LANGUES.map((x) => <option key={x} value={x} lang={x}>{NOMS_LANGUES[x]}</option>)}
      </select>
    </label>
  );
}
