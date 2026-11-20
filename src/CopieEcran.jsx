// ════════════════════════════════════════════════════════════════════════════
//  LA COPIE D'UN ÉCRAN — LE RENDU (20 nov., « affichage instantané »)
//  La règle des données est src/copieEcran.js. Ici : montrer la dernière copie
//  connue À LA PLACE de l'écran vrai, au même endroit, le temps de la relecture.
//    · INERTE (`inert` sur le contenu) : aucun toucher, aucun focus, aucun geste
//      n'en part ; rien ici ne rend une donnée à l'app (lecture seule d'affichage) ;
//    · DATÉE : « Mis à jour il y a 3 min » en gris, avec une petite roue (14 px)
//      tant que la relecture court — posé sur l'en-tête du premier groupe, sinon sur
//      la ligne du grand titre (jamais une ligne de plus : rien ne saute quand
//      l'écran vrai prend la place) ;
//    · une relecture RATÉE garde la copie : « Pas à jour · Réessayer » (le seul
//      bouton, hors du contenu inerte : il relance la lecture, il n'écrit rien).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from './i18n/index.js';
import { ageCopieMin } from './copieEcran.js';
import './copie-ecran.css';

export function ageCopieTexte(min) {
  const m = Math.max(0, Math.floor(Number(min) || 0));
  if (m < 1) return tr('natif.copie.instant');
  if (m < 60) return tr('natif.copie.minutes', { n: m });
  return tr('natif.copie.heures', { n: Math.floor(m / 60) });
}

// Où poser la mention : l'en-tête du premier groupe visible, sinon la ligne du grand titre de la coque.
// `zone` : où chercher les groupes (le contenu de l'écran) ; `portee` : où chercher le grand titre.
function placeMention(hote, enveloppe, portee = null) {
  try {
    const base = enveloppe.getBoundingClientRect();
    const H = (typeof window !== 'undefined' ? window.innerHeight : 800) || 800;
    for (const t of (hote.querySelector('.vrm-copie-zone') || hote).querySelectorAll('.n-groupe-tete')) {
      const r = t.getBoundingClientRect();
      if (r.height < 10 || r.top > H * 0.8) continue;
      // un en-tête qui porte déjà quelque chose à droite (un compte, un lien) : on passe
      if (t.querySelector('button, .n-groupe-tete-droite, .n-groupe-compte')) continue;
      return { top: Math.round(r.top - base.top + r.height / 2), dans: 'groupe' };
    }
    const titre = (portee || document).querySelector('.vrm-main h1.n-grand-titre');
    if (titre) {
      const r = titre.getBoundingClientRect();
      const zone = portee ? (hote.querySelector('.vrm-copie-zone') || hote).getBoundingClientRect() : base;
      if (r.height > 10 && r.bottom <= zone.top + 4 && zone.top - r.bottom < 80) return { top: Math.round(r.top - base.top + r.height / 2 + 4), dans: 'titre' };
    }
  } catch (_) {}
  return { top: 10, dans: 'haut' };
}

function Mention({ place, pasAJour, age, onReessayer }) {
  return (
    <div className={'vrm-copie-mention' + (place ? ' is-pose' : '')} data-copie-mention={place ? place.dans : ''} style={{ top: place ? place.top : 10 }}>
      {pasAJour ? <>
        <span>{tr('natif.copie.pasAJour')}</span>
        <span aria-hidden="true">·</span>
        <button type="button" className="vrm-copie-reessayer" data-copie-reessayer="" onClick={() => { if (onReessayer) onReessayer(); }}>{tr('natif.copie.reessayer')}</button>
      </> : <>
        <span className="vrm-copie-roue" aria-hidden="true"/>
        <span>{tr('natif.copie.misAJour', { age: ageCopieTexte(age) })}</span>
      </>}
    </div>
  );
}

// LA COQUE COPIÉE (barre du haut, grand titre, l'écran, barre d'onglets), peinte AVANT l'app dans l'écran de démarrage
// (src/OuvertureInstantanee.jsx). Inerte, datée : la même mention que dans l'app.
export function CoqueCopie({ copie, maintenant = null }) {
  const hote = React.useRef(null), enveloppe = React.useRef(null);
  const [place, setPlace] = React.useState(null);
  React.useLayoutEffect(() => {
    const h = hote.current; if (!h) return;
    try { h.inert = true; } catch (_) {}
    h.setAttribute('inert', '');
    const z = h.querySelector('.vrm-copie-zone'); if (z) z.setAttribute('data-copie-contenu', '');
    if (enveloppe.current) setPlace(placeMention(h, enveloppe.current, h));
  }, [copie && copie.coque && copie.coque.html]);
  if (!copie || !copie.coque || !copie.coque.html) return null;
  const age = ageCopieMin(copie, maintenant || Date.now());
  return (
    <div ref={enveloppe} className="vrm-ji vrm-copie vrm-copie-coque" data-copie-ecran={copie.ecran} data-copie-t={String(copie.t)} data-copie-age={String(age)} data-copie-etat="mise-a-jour" aria-busy="true" style={{ position: 'absolute', inset: 0 }}>
      <span className="vrm-sr-seul" role="status">{tr('natif.copie.nom')}</span>
      <div ref={hote} className="vrm-copie-contenu" dangerouslySetInnerHTML={{ __html: copie.coque.html }}/>
      <Mention place={place} pasAJour={false} age={age}/>
    </div>
  );
}

export function VueCopie({ copie, etat = 'maj', onReessayer = null, maintenant = null }) {
  const hote = React.useRef(null), enveloppe = React.useRef(null);
  const [now, setNow] = React.useState(() => maintenant || Date.now());
  React.useEffect(() => { if (maintenant) return undefined; const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, [maintenant]);
  const [place, setPlace] = React.useState(null);
  // Inerte : ni focus ni clic (React 18 ne connaît pas l'attribut).
  React.useLayoutEffect(() => {
    const h = hote.current; if (!h) return;
    try { h.inert = true; } catch (_) {}
    h.setAttribute('inert', '');
    if (enveloppe.current) setPlace(placeMention(h, enveloppe.current));
  }, [copie && copie.html]);
  if (!copie || !copie.html) return null;
  const age = ageCopieMin(copie, maintenant || now);
  const pasAJour = etat === 'pas-a-jour';
  // Le HTML est la projection NETTOYÉE (liste blanche, src/copieEcran.js `nettoyer`) que l'écran vrai a rendue.
  const html = copie.html;
  return (
    <div ref={enveloppe} className="vrm-ji vrm-copie" data-copie-ecran={copie.ecran} data-copie-t={String(copie.t)} data-copie-age={String(age)}
      data-copie-etat={pasAJour ? 'pas-a-jour' : 'mise-a-jour'} aria-busy={pasAJour ? undefined : 'true'}
      onClickCapture={(e) => { if (!(e.target && e.target.closest && e.target.closest('[data-copie-reessayer]'))) { e.preventDefault(); e.stopPropagation(); } }}>
      <span className="vrm-sr-seul" role="status">{tr('natif.copie.nom')}</span>
      <div ref={hote} className="vrm-copie-contenu" data-copie-contenu="" dangerouslySetInnerHTML={{ __html: html }}/>
      <Mention place={place} pasAJour={pasAJour} age={age} onReessayer={onReessayer}/>
    </div>
  );
}
export default VueCopie;
