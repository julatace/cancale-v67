// ── src/natif/Vignettes.jsx — une bande de vignettes NETTES (les colis à envoyer) ─────────
// À poser dans un <Groupe>, sous une <Rangee>. Chaque case : la photo (60, rayon 10), SA plaque N° dessous, au plus UN
// point d'urgence ; les cases ne se chevauchent jamais. Le nombre de cases qui TIENNENT est mesuré : ce qui ne tient pas se
// résume en une dernière case « +N » (jamais de texte superposé, jamais de défilement caché).
// Props :
//   elements   [{ cle, src, numero, presse (bool), libelle (le nom lu : « N° 124 · Nike… · demain 10 h »), onClick }]
//   total      le nombre réel (≥ elements.length) : les éléments comptés mais pas encore décrits ont une case vide, à sa taille
//   libellePlus (n) ⇒ le nom de la case « +N » (« 4 autres colis à envoyer ») ; onPlus : son geste
//   icone      nœud montré sans photo (icône de l'app)
//   libelle    le nom de la bande ; attrs : data-* de l'écran ; attrsCase(el) ⇒ data-* d'une case ; Image : le composant d'image de l'app
// Exemple :
//   <Vignettes libelle="Les colis à envoyer" elements={colis} total={8} libellePlus={(n) => `${n} autres`} onPlus={voirTout}/>
import React from 'react';
import { cx } from './outils.js';
import { Plaque } from './Plaque.jsx';
import { Glyphe } from './icones.jsx';
import './complements.css';

const CASE = 60, ECART = 8;

export function Vignettes({ elements = [], total = 0, libellePlus = (n) => '+' + n, onPlus = null, icone = null, libelle = '', className = '', attrs = null, attrsCase = null, Image = null }) {
  const Img = Image || 'img';   // l'image de l'app (photos Vinted relues, repli) ; sinon <img>
  const [cases, setCases] = React.useState(5);
  const mesurer = React.useCallback((el) => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const poser = () => { const w = el.clientWidth; if (w > 0) setCases(Math.max(2, Math.min(12, Math.floor((w + ECART) / (CASE + ECART))))); };
    poser(); try { new ResizeObserver(poser).observe(el); } catch (_) { /* sans observateur : cinq cases */ }
  }, []);
  const n = Math.max(total || 0, elements.length);
  const montrees = n > cases ? cases - 1 : n;
  const reste = n - montrees;
  return (
    <div className={cx('n-vignettes', className)} role="list" aria-label={libelle || undefined} ref={mesurer} data-n-montrees={String(montrees)} data-n-reste={String(reste)} {...(attrs || {})}>
      {Array.from({ length: montrees }, (_, k) => {
        const e = elements[k];
        if (!e) return <span key={'attente-' + k} className="n-vignettes-case" role="listitem" aria-hidden="true"><span className="n-vignettes-photo"/><span className="n-vignettes-plaque"/></span>;
        return (
          <button key={e.cle} type="button" role="listitem" className="n-vignettes-case n-vignettes-touche" aria-label={e.libelle} onClick={e.onClick} {...(attrsCase ? attrsCase(e) : {})}>
            <span className="n-vignettes-photo">
              {e.src ? <Img src={e.src} alt="" width={CASE} height={CASE} loading="lazy" decoding="async" draggable="false"/> : (icone || <Glyphe nom="image" taille={24}/>)}
              {e.presse ? <span className="n-vignettes-point" data-n-urgence="" aria-hidden="true"/> : null}
            </span>
            <span className="n-vignettes-plaque" aria-hidden="true">{e.numero ? <Plaque numero={e.numero}/> : null}</span>
          </button>
        );
      })}
      {reste > 0 ? (
        <button type="button" role="listitem" className="n-vignettes-case n-vignettes-touche" aria-label={libellePlus(reste)} onClick={onPlus} data-n-plus={String(reste)}>
          <span className="n-vignettes-photo n-vignettes-plus" aria-hidden="true">+{reste}</span>
          <span className="n-vignettes-plaque" aria-hidden="true"/>
        </button>
      ) : null}
    </div>
  );
}

// ── Le code d'un retrait, en grand, centré dans sa zone (il se lit au comptoir). ──
// `onClick` : la zone entière se touche (elle ouvre les retraits) ; `libelle` : son nom lu.
export function CodeRetrait({ code, onClick = null, libelle = '', className = '', attrs = null }) {
  if (!code) return null;
  if (onClick) return <button type="button" className={cx('n-code', 'n-code-touche', className)} onClick={onClick} aria-label={libelle ? libelle + ' · ' + code : undefined} {...(attrs || {})}><span className="n-code-texte">{code}</span></button>;
  return <p className={cx('n-code', className)} {...(attrs || {})}><span className="n-code-texte">{code}</span></p>;
}

export default Vignettes;
