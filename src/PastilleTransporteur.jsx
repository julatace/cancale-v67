// ════════════════════════════════════════════════════════════════════════════
//  LA PASTILLE DU TRANSPORTEUR (2 nov.) — logo officiel + nom, ou « pas lu »
//  Une forme pour tous les écrans (ventes, achats, Colis, récapitulatif) : la
//  règle est `transporteurDuColis` (src/transporteursVisuels.js), jamais ici.
//  · logo : l'icône publiée par le transporteur sur SON domaine, dans une
//    tuile blanche aux coins arrondis (lisible en clair ET en sombre) ; une
//    image qui ne se charge pas est retirée — on essaie l'adresse suivante,
//    puis plus rien : la pastille garde le nom seul, jamais une image cassée.
//    Un échec est retenu pour la page (pas de nouvel essai à chaque rendu).
//  · rien de lu ⇒ « Transporteur pas lu », sans logo, en gris.
//  `data-transporteur` porte la clé des statistiques (`cleStatTransporteur`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { PAS_LU, logosDuTransporteur, cleStatTransporteur } from './transporteursVisuels.js';

const ECHECS = new Set();

function LogoTransporteur({ cle, taille, decale }) {
  const urls = logosDuTransporteur(cle).filter((u) => !ECHECS.has(u));
  const [i, setI] = React.useState(0);
  const [pret, setPret] = React.useState(false);
  const url = urls[i];
  if (!url) return null;
  return (
    <span aria-hidden="true" data-transporteur-logo={pret ? 'charge' : 'attente'}
      style={{ width: taille, height: taille, borderRadius: Math.round(taille * 0.27), background: '#fff', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.10)', display: pret ? 'inline-flex' : 'none', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, marginLeft: decale ? -6 : 0 }}>
      <img src={url} alt="" width={taille - 4} height={taille - 4} decoding="async" referrerPolicy="no-referrer"
        onLoad={(ev) => { const im = ev.currentTarget; if (!im.naturalWidth) { ECHECS.add(url); setPret(false); setI((k) => k + 1); } else setPret(true); }}
        onError={() => { ECHECS.add(url); setPret(false); setI((k) => k + 1); }}
        style={{ width: taille - 4, height: taille - 4, objectFit: 'contain', display: 'block' }}/>
    </span>
  );
}

// `t` : le résultat de `transporteurDuColis` ; `C` : le thème de l'app.
// `seul` : sans cadre (dans une ligne de texte) ; sinon une pastille.
export default function PastilleTransporteur({ t, C, taille = 20, seul = false, className = '', ...rest }) {
  const cle = (t && t.cle) || null;
  const nom = (t && t.nom) || '';
  const lu = !!(cle || nom);
  const muted = (C && C.muted) || '#6e6e73';
  const texte = (C && C.text) || '#1d1d1f';
  const bord = (C && C.border) || 'rgba(0,0,0,.12)';
  return (
    <span className={`vrm-transporteur ${className}`.trim()} data-transporteur={cleStatTransporteur(t)} data-transporteur-source={(t && t.source) || ''}
      title={lu ? `Transporteur : ${nom}` : 'Le transporteur de ce colis n’a pas encore été lu (ni sur le bordereau, ni chez le transporteur).'}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%', flexShrink: 0, verticalAlign: 'middle',
        ...(seul ? {} : { minHeight: taille + 8, padding: '3px 10px', borderRadius: 999, border: `1px solid ${bord}` }) }} {...rest}>
      {cle ? <LogoTransporteur key={cle} cle={cle} taille={taille} decale={!seul}/> : null}
      <span data-transporteur-nom="" style={{ fontSize: 12.5, fontWeight: lu ? 600 : 500, color: lu ? texte : muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-.005em' }}>{lu ? nom : PAS_LU}</span>
    </span>
  );
}
