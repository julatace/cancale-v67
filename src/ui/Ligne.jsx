// ── src/ui/Ligne.jsx — la rangée d'une liste longue (Julien : « imagine si j'ai 1000 articles ») ──
// 64–72 px, vignette 52 (rayon 12, `loading="lazy"`, taille fixée : aucun saut), le N° en
// pastille + le nom sur UNE ligne, UNE sous-ligne grise (le geste en encre avec un point ambre
// si `geste`), la valeur à droite (encre, chiffres alignés), un chevron si elle s'ouvre. Aucune
// ombre ni flou (1 000 rangées) ; `content-visibility:auto` (hors écran, pas dessinée). Les
// rangées se posent dans un groupe blanc (rayon 20) ; le filet entre deux commence après la
// photo. `Photo` : le composant photo de l'écran (`PhotoVinted`) si besoin ; sinon une <img>.
//   <Ligne photo={url} num={<Numero n="124" taille="petit"/>} titre="Vans xt-6" sous="Très bon état · 24 j" valeur="107 €" onClick={…}/>
import React from 'react';
import './ui.css';

const Chevron = () => <svg className="vrm-ui-chevron" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true"><path d="m1.5 1.5 5 5.5-5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;

export function Ligne({ photo, Photo, num, titre, sous, geste = false, valeur, chevron, onClick, className = '', children, ...attrs }) {
  const Balise = onClick ? 'button' : 'div';
  const img = photo ? (Photo ? <Photo src={photo} alt="" loading="lazy" decoding="async" width={52} height={52}/> : <img src={photo} alt="" loading="lazy" decoding="async" width={52} height={52}/>) : null;
  return (
    <Balise {...(onClick ? { type: 'button', onClick } : {})} className={'vrm-ui-ligne' + (className ? ' ' + className : '')} {...attrs}>
      {photo !== undefined ? <span className="vrm-ui-ligne-photo" aria-hidden="true">{img}</span> : null}
      <span className="vrm-ui-ligne-textes">
        <span className="vrm-ui-ligne-titre">{num || null}<span>{titre}</span></span>
        {sous ? <span className={'vrm-ui-ligne-sous' + (geste ? ' is-geste' : '')}>{sous}</span> : null}
      </span>
      {valeur != null && valeur !== '' ? <span className="vrm-ui-ligne-valeur">{valeur}</span> : null}
      {children}
      {(chevron != null ? chevron : !!onClick) ? <Chevron/> : null}
    </Balise>
  );
}
export default Ligne;
