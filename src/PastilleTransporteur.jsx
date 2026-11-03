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

// `repli` : ce qui se montre tant que (ou si) aucun logo ne s'est chargé.
export function LogoTransporteur({ cle, taille, decale = false, repli = null }) {
  const urls = logosDuTransporteur(cle).filter((u) => !ECHECS.has(u));
  const [i, setI] = React.useState(0);
  const [pret, setPret] = React.useState(false);
  const url = urls[i];
  if (!url) return repli;
  return (<>
    {!pret ? repli : null}
    <span aria-hidden="true" data-transporteur-logo={pret ? 'charge' : 'attente'}
      style={{ width: taille, height: taille, borderRadius: Math.round(taille * 0.25), background: '#fff', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.10)', display: pret ? 'inline-flex' : 'none', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, marginLeft: decale ? -6 : 0 }}>
      <img src={url} alt="" width={taille - 4} height={taille - 4} decoding="async" referrerPolicy="no-referrer"
        onLoad={(ev) => { const im = ev.currentTarget; if (!im.naturalWidth) { ECHECS.add(url); setPret(false); setI((k) => k + 1); } else setPret(true); }}
        onError={() => { ECHECS.add(url); setPret(false); setI((k) => k + 1); }}
        style={{ width: taille - 4, height: taille - 4, objectFit: 'contain', display: 'block' }}/>
    </span>
  </>);
}

// `t` : le résultat de `transporteurDuColis` ; `C` : le thème de l'app.
// `seul` : sans cadre (dans une ligne de texte, la carte des relais) ; sinon LA
// PUCE (2 nov. au soir, Julien sur la maquette FusionVentes) : 44 px de haut,
// fond gris clair (#f2f2f7, sombre #2c2c2e), rayon 12, la tuile du logo 20 px
// (rayon 5, fond blanc) puis le nom en 13 px 600 — posée À GAUCHE du bouton
// bordereau, sur la même rangée (`.vrm-rangee-bord`, src/design/fusion.css).
// Rien de lu ⇒ la même puce, sans tuile, le texte en gris.
export default function PastilleTransporteur({ t, C, taille = 20, seul = false, className = '', ...rest }) {
  const cle = (t && t.cle) || null;
  const nom = (t && t.nom) || '';
  const lu = !!(cle || nom);
  const titre = lu ? `Transporteur : ${nom}` : 'Le transporteur de ce colis n’a pas encore été lu (ni sur le bordereau, ni chez le transporteur).';
  if (!seul) {
    return (
      <span className={`vrm-transporteur vrm-puce-transp ${className}`.trim()} data-transporteur={cleStatTransporteur(t)} data-transporteur-source={(t && t.source) || ''}
        data-lu={lu ? '1' : '0'} title={titre} {...rest}>
        {cle ? <LogoTransporteur key={cle} cle={cle} taille={20}/> : null}
        <span data-transporteur-nom="">{lu ? nom : PAS_LU}</span>
      </span>
    );
  }
  const muted = (C && C.muted) || '#6e6e73';
  const texte = (C && C.text) || '#1d1d1f';
  return (
    <span className={`vrm-transporteur ${className}`.trim()} data-transporteur={cleStatTransporteur(t)} data-transporteur-source={(t && t.source) || ''}
      title={titre}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%', flexShrink: 0, verticalAlign: 'middle' }} {...rest}>
      {cle ? <LogoTransporteur key={cle} cle={cle} taille={taille}/> : null}
      <span data-transporteur-nom="" style={{ fontSize: 13, fontWeight: lu ? 600 : 500, color: lu ? texte : muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-.005em' }}>{lu ? nom : PAS_LU}</span>
    </span>
  );
}
