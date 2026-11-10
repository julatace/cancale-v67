// ════════════════════════════════════════════════════════════════════════════
//  LA MARQUE DU TRANSPORTEUR (2 nov. ; LOGOS à la place des noms le 9 nov. au soir)
//  Julien : « je veux que ce soient les LOGOS des transporteurs qui soient affichés à
//  côté des colis et non les noms ». Une forme pour tous les écrans (ventes, achats,
//  Colis, carte des relais, récapitulatif) : la règle est `transporteurDuColis`
//  (src/transporteursVisuels.js), jamais ici.
//  · la marque : une tuile maison aux couleurs du transporteur et son sigle, dessinée
//    en SVG (aucun fichier, aucune requête, aucune image cassée possible) — licence :
//    voir src/transporteursVisuels.js (les logos officiels n'en ont pas de publique) ;
//  · le NOM n'est plus écrit à côté du colis : il est dans `aria-label` (lecteur
//    d'écran), `title` (survol) et `data-transporteur-nom` (les règles et les bancs) ;
//  · rien de lu ⇒ un pictogramme NEUTRE (un carton gris), « Transporteur inconnu »
//    en `aria-label` — jamais une fausse marque.
//  `data-transporteur` porte la clé des statistiques (`cleStatTransporteur`).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { PAS_LU, marqueDuTransporteur, nomDuTransporteur, cleStatTransporteur } from './transporteursVisuels.js';

const POLICE = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";

// La tuile d'une marque. `repli` : ce qui se montre pour une clé sans marque.
export function LogoTransporteur({ cle, taille = 20, decale = false, repli = null }) {
  const m = marqueDuTransporteur(cle);
  if (!m) return repli;
  const n = m.sigle.length;
  return (
    <span aria-hidden="true" data-transporteur-logo="charge" data-marque={cle}
      style={{ width: taille, height: taille, borderRadius: Math.round(taille * 0.26), display: 'inline-flex', overflow: 'hidden', flexShrink: 0, marginLeft: decale ? -6 : 0, verticalAlign: 'middle', background: m.fond }}>
      <svg viewBox="0 0 32 32" width="100%" height="100%" focusable="false" style={{ display: 'block' }}>
        <rect width="32" height="32" fill={m.fond}/>
        <text x="16" y="16.5" textAnchor="middle" dominantBaseline="central" fill={m.encre}
          fontFamily={POLICE} fontWeight="800" fontSize={n >= 3 ? 11.5 : 14.5} letterSpacing={n >= 3 ? '-0.4' : '-0.2'}>{m.sigle}</text>
      </svg>
    </span>
  );
}

// Le pictogramme NEUTRE : transporteur inconnu (un carton, gris, sans couleur de marque).
export function LogoInconnu({ taille = 20 }) {
  return (
    <span aria-hidden="true" data-transporteur-logo="charge" data-marque="inconnu"
      style={{ width: taille, height: taille, borderRadius: Math.round(taille * 0.26), display: 'inline-flex', overflow: 'hidden', flexShrink: 0, verticalAlign: 'middle', background: 'rgba(120,120,128,.16)' }}>
      <svg viewBox="0 0 32 32" width="100%" height="100%" focusable="false" style={{ display: 'block' }}>
        <g fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <path d="M8 12.5 16 8.5l8 4v9L16 25.5l-8-4z"/><path d="M8 12.5 16 16.5l8-4M16 16.5v9"/>
        </g>
      </svg>
    </span>
  );
}

const nomDe = (t) => (t && t.nom) || '';

// (7 nov.) LE BADGE posé dans le coin de la vignette d'un colis (comme le badge d'une app).
// Il lit le MÊME `t` que la puce ; inconnu ⇒ le pictogramme neutre (jamais une marque devinée).
export function BadgeTransporteur({ t, className = '', ...rest }) {
  const cle = (t && t.cle) || null;
  const nom = nomDe(t);
  const libelle = cle || nom ? `Transporteur : ${nom || nomDuTransporteur(cle)}` : PAS_LU;
  return (
    <span className={`vrm-colis-logo-transp ${className}`.trim()} data-colis-logo-transp={cle || (nom ? 'autre' : 'inconnu')}
      data-transporteur-nom={nom || PAS_LU} role="img" aria-label={libelle} title={libelle} {...rest}>
      {cle ? <LogoTransporteur key={cle} cle={cle} taille={22}/> : <LogoInconnu taille={22}/>}
    </span>
  );
}

// `t` : le résultat de `transporteurDuColis` ; `C` : le thème de l'app (gardé pour les appelants).
// `seul` : sans cadre (dans une ligne de texte, la carte des relais) ; sinon LA PUCE posée à
// gauche du bouton bordereau (`.vrm-rangee-bord`). Dans les deux cas : la marque, pas le nom.
// Un nom LU mais inconnu de VRM (aucune marque) : le pictogramme neutre, le nom en `title`.
export default function PastilleTransporteur({ t, C, taille = 20, seul = false, className = '', ...rest }) {
  const cle = (t && t.cle) || null;
  const nom = nomDe(t);
  const lu = !!(cle || nom);
  const libelle = lu ? `Transporteur : ${nom}` : PAS_LU;
  const titre = lu ? libelle : 'Le transporteur de ce colis n’a pas encore été lu (ni sur l’étiquette, ni chez le transporteur).';
  const visuel = cle ? <LogoTransporteur key={cle} cle={cle} taille={seul ? taille : 24}/> : <LogoInconnu taille={seul ? taille : 24}/>;
  return (
    <span className={`vrm-transporteur${seul ? '' : ' vrm-puce-transp'} ${className}`.trim()} data-transporteur={cleStatTransporteur(t)} data-transporteur-source={(t && t.source) || ''}
      data-lu={lu ? '1' : '0'} data-transporteur-nom={lu ? nom : PAS_LU} role="img" aria-label={libelle} title={titre}
      style={seul ? { display: 'inline-flex', alignItems: 'center', flexShrink: 0, verticalAlign: 'middle' } : undefined} {...rest}>
      {visuel}
    </span>
  );
}
