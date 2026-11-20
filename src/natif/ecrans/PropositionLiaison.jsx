// ── src/natif/ecrans/PropositionLiaison.jsx — RELIER DEPUIS LA LISTE (20 nov.) ─────────────────────────────────────
// Julien : « on ne peut pas relier des annonces comme ça, on est obligé d'appuyer dessus, regarder la fiche ; améliore ça ».
// Une annonce « à relier » montre SUR SA RANGÉE sa meilleure proposition : la mini-photo de l'article, « N°234 ? »,
// « Relier » (un toucher : le geste du parcours, annulable 10 s) et « Autre… » (le parcours sur CETTE annonce).
// Sans proposition (aucune, ou plusieurs à égalité : jamais une présélection) : « Aucune paire proche » et
// « Elle n'est que sur {site} » en un toucher. PRÉSENTATIONNEL : la proposition vient de `propositionLu` (src/liaisonEtat.js),
// le geste de `relierDepuisListe` / `queSurCeSite` — rien n'est calculé ni écrit ici.
//
// Props : l = { site, id, etat, prop: { paireId, numero, photo, titre, niveau: 'sur'|'verifier' } | null } ;
//   onRelier(l) · onAutre(l) · onPropre(l) ; Photo(src) (le lecteur de photos de l'app, sinon <img>) ; forme : 'cellule' | 'bande' | 'fiche'.
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Bouton } from '../Bouton.jsx';
import { Vignette } from '../Rangee.jsx';

const arreter = (e) => { if (e && e.stopPropagation) e.stopPropagation(); };

export function PropositionLiaison({ l, onRelier, onAutre, onPropre, Photo = null, forme = 'cellule' }) {
  if (!l || l.etat !== 'aRelier') return null;
  const p = l.prop;
  const vignette = p ? <Vignette src={Photo ? '' : (p.photo || '')} image={Photo && p.photo ? Photo(p.photo) : null} alt="" taille={44}/> : null;
  return (
    // Un bloc À CÔTÉ de la rangée (jamais un bouton dans la rangée) : ses touchers ne l'ouvrent pas.
    <div className="n-eg-prop" data-eg-prop={p ? p.niveau : 'aucune'} data-eg-prop-forme={forme} data-eg-prop-annonce={`${l.site}:${l.id}`}
      data-eg-prop-paire={p ? p.paireId : undefined} data-eg-prop-numero={p ? p.numero : undefined} onClick={arreter} onKeyDown={arreter}>
      {p ? <>
        {vignette}
        <span className="n-eg-prop-texte">
          <span className="n-eg-prop-num">{tr('liaL.numero', { numero: p.numero })}</span>
          <span className="n-eg-prop-etat" data-ton={p.niveau === 'sur' ? 'ambre' : 'gris'}>{p.niveau === 'sur' ? tr('liaL.sur') : tr('liaL.verifier')}</span>
        </span>
        <span className="n-eg-prop-gestes">
          <Bouton variante="teinte" onClick={(e) => { arreter(e); onRelier(l); }} attrs={{ 'data-eg-relier-prop': `${l.site}:${l.id}`, 'aria-label': tr('liaL.relierN', { numero: p.numero }) }}>{tr('liaL.relier')}</Bouton>
          <Bouton variante="texte" onClick={(e) => { arreter(e); onAutre(l); }} attrs={{ 'data-eg-autre': `${l.site}:${l.id}` }}>{tr('liaL.autre')}</Bouton>
        </span>
      </> : <>
        {/* Dans une cellule du tableau : la place est comptée — le geste dit tout (« Que sur ce site ») ; ailleurs, la phrase entière. */}
        {forme === 'cellule' ? null : <span className="n-eg-prop-texte"><span className="n-eg-prop-etat" data-ton="gris">{tr('liaL.aucune')}</span></span>}
        <span className="n-eg-prop-gestes">
          <Bouton variante="texte" onClick={(e) => { arreter(e); onPropre(l); }} attrs={{ 'data-eg-propre': `${l.site}:${l.id}`, 'aria-label': tr('liaL.propre', { site: l.site }) }}>{forme === 'cellule' ? tr('liaL.propreCourt') : tr('liaL.propre', { site: l.site })}</Bouton>
          <Bouton variante="texte" onClick={(e) => { arreter(e); onAutre(l); }} attrs={{ 'data-eg-autre': `${l.site}:${l.id}` }}>{tr('liaL.autre')}</Bouton>
        </span>
      </>}
    </div>
  );
}

export default PropositionLiaison;
