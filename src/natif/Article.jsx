// ── src/natif/Article.jsx — l'en-tête d'une fiche d'article, ses photos en grand, le bloc hérité ──
// 1) <EnteteArticle> — photo (124 ; touchable ⇒ `onPhoto`), plaque N°, titre sur 2 lignes au plus, UNE ligne d'état.
//    Props : photo (nœud <img> déjà fait par l'écran, ou null ⇒ icône « image ») · nPhotos (> 1 ⇒ le compte sur la photo)
//            · onPhoto · libellePhoto · plaque (<Plaque/>) · titre · etat (texte) · ton ('neutre' | 'ambre' | 'doublon')
//            · suite (nœuds sous l'état, rares) · attrs, attrsPhoto, attrsTitre, attrsEtat (data-* de l'écran)
//    Exemple : <EnteteArticle photo={<img src={u} alt=""/>} plaque={<Plaque numero={124}/>} titre="Nike Dunk Low" etat="En vente sur 2 sites"/>
// 2) <Photos sources rendre> — les photos en grand (dans une <Feuille detente="pleine">), une par page, qui glissent.
// 3) <Herite> — un bloc d'un écran d'avant posé dans une page native, le temps de sa conversion (`nu` : sans carte).
import React from 'react';
import './article.css';
import { cx } from './outils.js';
import { Glyphe } from './icones.jsx';

export function EnteteArticle({ photo = null, nPhotos = 0, onPhoto = null, libellePhoto = '', plaque = null, titre = '', etat = '', ton = 'neutre', suite = null,
  className = '', attrs = null, attrsPhoto = null, attrsTitre = null, attrsEtat = null }) {
  const image = photo || <Glyphe nom="image" taille={40}/>;
  return (
    <div className={cx('n-article', className)} {...(attrs || {})}>
      {photo && onPhoto
        ? <button type="button" className="n-article-photo" onClick={onPhoto} aria-label={libellePhoto || undefined} {...(attrsPhoto || {})}>{image}{nPhotos > 1 ? <span className="n-article-compte" aria-hidden="true">{nPhotos}</span> : null}</button>
        : <span className="n-article-photo" {...(attrsPhoto || {})}>{image}</span>}
      <div className="n-article-texte">
        {plaque}
        <h2 className="n-article-titre" title={typeof titre === 'string' ? titre : undefined} {...(attrsTitre || {})}>{titre}</h2>
        {etat ? <span className="n-article-etat" data-n-ton={ton} {...(attrsEtat || {})}>{etat}</span> : null}
        {suite}
      </div>
    </div>
  );
}

export function Photos({ sources = [], rendre, attrs = null }) {
  return <div className="n-photos" {...(attrs || {})}>{sources.map((s) => <span key={s} className="n-photos-page">{rendre(s)}</span>)}</div>;
}

export const Herite = React.forwardRef(function Herite({ nu = false, className = '', attrs = null, children }, ref) {
  return <div ref={ref} className={cx('n-herite', className)} data-n-nu={nu ? '' : undefined} {...(attrs || {})}>{children}</div>;
});

export default EnteteArticle;
