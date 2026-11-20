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

// Où poser la mention : sur une ligne d'en-tête qui EXISTE déjà (le grand titre de la coque, l'en-tête d'un groupe, le
// titre de l'écran), à droite, là où rien n'est dessiné — jamais une ligne de plus (rien ne saute au remplacement),
// jamais sur un bouton ou un texte. `portee` : où chercher le grand titre (la coque copiée), sinon le document.
// Après la prochaine image (et au repos si possible) ; rend de quoi annuler.
function apresImage(f) {
  let a = 0, b = 0, c = 0, mort = false;
  const go = () => { if (!mort) f(); };
  try { a = requestAnimationFrame(() => { b = setTimeout(() => { try { c = (window.requestIdleCallback || ((g) => setTimeout(g, 0)))(go, { timeout: 600 }); } catch (_) { go(); } }, 0); }); } catch (_) { b = setTimeout(go, 50); }
  return () => { mort = true; try { cancelAnimationFrame(a); } catch (_) {} clearTimeout(b); try { if (window.cancelIdleCallback) window.cancelIdleCallback(c); } catch (_) {} };
}
const LARGEUR_MENTION = 170;
function placeMention(hote, enveloppe, portee = null) {
  try {
    const base = enveloppe.getBoundingClientRect();
    const m = enveloppe.querySelector('.vrm-ce-mention');
    const L = m && m.scrollWidth ? Math.min(LARGEUR_MENTION + 40, m.scrollWidth + 8) : LARGEUR_MENTION;
    const H = (typeof window !== 'undefined' ? window.innerHeight : 800) || 800;
    const droite = base.right - 16, gauche = droite - L;
    // Ce qui est DESSINÉ (feuilles de texte, boutons, icônes, pastilles) dans la bande d'une ligne.
    const occupe = (y) => {
      for (const e of (portee || hote).querySelectorAll('button, svg, img, .n-pastille, .n-plaque, a, input, span, b, small, strong, p, h1, h2, h3, div')) {
        if (e.closest('.vrm-ce-mention')) continue;
        if (e.localName === 'div' || e.localName === 'span' || e.localName === 'p' || e.localName === 'h1' || e.localName === 'h2' || e.localName === 'h3' || e.localName === 'b' || e.localName === 'small' || e.localName === 'strong') {
          // un bloc de TEXTE seulement (pas un conteneur) : son texte propre
          if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        }
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < y - 10 || r.top > y + 10) continue;
        // la largeur réelle du texte (un titre en bloc pleine largeur n'occupe que ses lettres)
        let dr = r.right;
        if (e.childNodes.length === 1 && e.firstChild.nodeType === 3) { try { const rg = document.createRange(); rg.selectNodeContents(e); dr = rg.getBoundingClientRect().right; } catch (_) {} }
        if (dr > gauche && r.left < droite) return true;
      }
      return false;
    };
    const cands = [];
    const titre = (portee || document).querySelector('.vrm-main h1.n-grand-titre');
    if (titre) { const r = titre.getBoundingClientRect(); if (r.height > 10 && r.bottom <= base.top + 120) cands.push({ r, dans: 'titre' }); }
    for (const t of (hote.querySelector('.vrm-ce-zone') || hote).querySelectorAll('.n-groupe-tete, h1, h2, header')) {
      const r = t.getBoundingClientRect();
      if (r.height < 10 || r.top > H * 0.6) continue;
      cands.push({ r, dans: t.classList.contains('n-groupe-tete') ? 'groupe' : 'titre' });
    }
    cands.sort((a, b) => a.r.top - b.r.top);
    for (const c of cands) { const y = c.r.top + c.r.height / 2; if (!occupe(y)) return { top: Math.round(y - base.top), dans: c.dans }; }
  } catch (_) {}
  return null;
}

function Mention({ place, pasAJour, age, onReessayer }) {
  return (
    <div className={'vrm-ce-mention' + (place ? ' is-pose' : '') + (place && place.dans === 'aucune' ? ' is-bas' : '')} data-copie-mention={place ? place.dans : ''} style={place && place.dans !== 'aucune' ? { top: place.top } : undefined}>
      {pasAJour ? <>
        <span>{tr('natif.copie.pasAJour')}</span>
        <span aria-hidden="true">·</span>
        <button type="button" className="vrm-ce-reessayer" data-copie-reessayer="" onClick={() => { if (onReessayer) onReessayer(); }}>{tr('natif.copie.reessayer')}</button>
      </> : <>
        <span className="vrm-ce-roue" aria-hidden="true"/>
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
    const z = h.querySelector('.vrm-ce-zone'); if (z) z.setAttribute('data-copie-contenu', '');
    // La place de la mention se cherche APRÈS la première image (mesurer la copie coûte au téléphone : la copie d'abord).
    return apresImage(() => { if (enveloppe.current && hote.current) setPlace(placeMention(hote.current, enveloppe.current, hote.current) || { dans: 'aucune' }); });
  }, [copie && copie.coque && copie.coque.html]);
  if (!copie || !copie.coque || !copie.coque.html) return null;
  const age = ageCopieMin(copie, maintenant || Date.now());
  return (
    <div ref={enveloppe} className="vrm-ji vrm-ce vrm-ce-coque" data-copie-ecran={copie.ecran} data-copie-t={String(copie.t)} data-copie-age={String(age)} data-copie-etat="mise-a-jour" aria-busy="true" style={{ position: 'absolute', inset: 0 }}>
      <span className="vrm-sr-seul" role="status">{tr('natif.copie.nom')}</span>
      <div ref={hote} className="vrm-ce-contenu" dangerouslySetInnerHTML={{ __html: copie.coque.html }}/>
      <Mention place={place} pasAJour={false} age={age}/>
    </div>
  );
}

// LA COPIE DANS L'APP, à la place exacte de l'écran vrai : le conteneur de la copie EST le conteneur de l'écran prêt
// (`vrm-attente-pret`, enfant direct de l'attente) — la même arborescence, donc les mêmes règles de style (une règle
// « .vrm-attente-pret > section » s'applique pareil) : rien ne bouge quand l'écran vrai prend la place.
// src/AttenteEcran.jsx la pose SANS cadre (`sansCadre`). La mention est sa voisine, hors du contenu inerte.
export function VueCopie({ copie, etat = 'maj', onReessayer = null, maintenant = null }) {
  const hote = React.useRef(null);
  const [now, setNow] = React.useState(() => maintenant || Date.now());
  React.useEffect(() => { if (maintenant) return undefined; const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, [maintenant]);
  const [place, setPlace] = React.useState(null);
  // Inerte : ni focus ni clic (React 18 ne connaît pas l'attribut).
  React.useLayoutEffect(() => {
    const h = hote.current; if (!h) return;
    try { h.inert = true; } catch (_) {}
    h.setAttribute('inert', '');
    const parent = h.parentElement;
    if (parent && getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    if (parent) return apresImage(() => { if (hote.current) setPlace(placeMention(hote.current, parent) || { dans: 'aucune' }); });
    return undefined;
  }, [copie && copie.html]);
  if (!copie || !copie.html) return null;
  const age = ageCopieMin(copie, maintenant || now);
  const pasAJour = etat === 'pas-a-jour';
  // Le HTML est la projection NETTOYÉE (liste blanche, src/copieEcran.js `nettoyer`) que l'écran vrai a rendue.
  return (
    <>
      <span className="vrm-sr-seul" role="status">{tr('natif.copie.nom')}</span>
      <div ref={hote} className="vrm-attente-pret vrm-attente-sans-fondu vrm-ce vrm-ce-contenu" data-copie-contenu="" data-copie-ecran={copie.ecran} data-copie-t={String(copie.t)}
        data-copie-age={String(age)} data-copie-etat={pasAJour ? 'pas-a-jour' : 'mise-a-jour'} aria-busy={pasAJour ? undefined : 'true'}
        dangerouslySetInnerHTML={{ __html: copie.html }}/>
      <Mention place={place} pasAJour={pasAJour} age={age} onReessayer={onReessayer}/>
    </>
  );
}
VueCopie.sansCadre = true;
export default VueCopie;
