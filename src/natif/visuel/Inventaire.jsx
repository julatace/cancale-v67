// ── src/natif/visuel/Inventaire.jsx — les petites pièces de l'inventaire Annonces / Stock (24 nov., lot visuel-annonces) ─────
// Compléments de src/natif/Jeu.jsx (même langage, mêmes règles — src/natif/visuel/README.md) :
//   <AvatarCompte pseudo site cle/>    le compte d'une annonce en rond (son initiale), teinté PAR SON IDENTITÉ (site:compte),
//                                       jamais par le titre ; aucune couleur orange.
//   <AvatarsComptes comptes max/>      au plus `max` ronds superposés, puis « +N ».
//   <PontPhoto.Provider value={fn}>    passe la fonction photo d'un écran (`Photo(src, { className, style })`, src/photoTaille.js
//                                       via PhotoVinted) à `TuilePaire`, qui attend un COMPOSANT stable.
//   <PhotoPont/>                        ce composant stable.
import React from 'react';
import { tr } from '../../i18n/index.js';
import { cx } from '../outils.js';
import './inventaire.css';

// Ardoise, encre, sarcelle, acier, vert « fait » : les teintes de l'app (jamais orange ni rouge).
const TEINTES = 5;
const empreinte = (s) => { let h = 0; for (const c of String(s || '')) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; };
export const teinteCompte = (cle) => empreinte(cle) % TEINTES;
const initiale = (p) => { const m = /[\p{L}\p{N}]/u.exec(String(p || '')); return m ? m[0].toUpperCase() : '·'; };

export function AvatarCompte({ pseudo = '', cle = '', petit = false }) {
  const nom = String(pseudo || '').trim();
  return (
    <span className={cx('n-inv-avatar', petit && 'n-inv-avatar-petit')} data-inv-avatar={cle} data-inv-teinte={teinteCompte(cle || nom)} role="img"
      aria-label={tr('inv.compte', { pseudo: nom || '—' })} title={nom || undefined}>
      <span aria-hidden="true">{initiale(nom)}</span>
    </span>
  );
}

export function AvatarsComptes({ comptes = [], max = 2 }) {
  if (!comptes.length) return null;
  const vus = comptes.slice(0, max), reste = comptes.length - vus.length;
  return (
    <span className="n-inv-avatars" data-inv-avatars={String(comptes.length)}>
      {vus.map((c) => <AvatarCompte key={c.cle} pseudo={c.pseudo} cle={c.cle}/>)}
      {reste > 0 ? <span className="n-inv-avatar n-inv-avatar-plus" aria-label={tr('inv.comptesPlus', { n: reste })}><span aria-hidden="true">+{reste}</span></span> : null}
    </span>
  );
}

export const PontPhoto = React.createContext(null);
// `TuilePaire` passe { className, src, style: { width, height } } ; la fonction de l'écran rend SA photo (PhotoVinted, qui prend la
// bonne taille par src/photoTaille.js) : on lui redonne la classe et la largeur VOULUE (la tuile mesure ~170–220 px, pas 96).
export function PhotoPont(p) {
  const f = React.useContext(PontPhoto);
  const voulu = React.useContext(TaillePhoto);
  const style = { ...(p.style || {}), ...(voulu ? { width: voulu, height: voulu } : {}) };
  const el = f ? f(p.src, { className: p.className, style }) : null;
  if (!React.isValidElement(el)) return <img className={p.className} src={p.src} alt="" referrerPolicy="no-referrer" decoding="async" loading="lazy" draggable="false" style={style}/>;
  return React.cloneElement(el, { className: cx(el.props.className, p.className), style: { ...style, ...(el.props.style || {}) }, draggable: 'false' });
}
export const TaillePhoto = React.createContext(0);
