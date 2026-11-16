// ── « LA PIÈCE » (v4, 15 nov. — maquettes v4-piece, ordi/stock-{1512,1280}) ─────────────────────
// Tous ses meubles d'un coup d'œil, posés au sol : de face (chaque case un carré, les états dessus) ou en
// isométrique (src/etageres/iso.js) ; « 18/20 » sous chacun ; puis l'ordre dans la pièce (une rangée par meuble :
// couleur, nom, colonnes × rangées · affichage, « 3 » à sortir en ambre). Toucher un meuble le montre.
// La vue (de face / isométrique) est une commodité d'affichage de l'appareil (jamais une donnée).
import React from 'react';
import { tr } from '../i18n/index.js';
import { dessinerIso } from './iso.js';
import { couleurMeuble } from './reglages.js';

const CLE_VUE = 'vrm_piece_vue';
let _idIso = 0;
function IsoMini({ meuble, u }) {
  const [id] = React.useState(() => 'iso' + (++_idIso));
  const d = dessinerIso({ cols: meuble.cols, rows: meuble.rows, grille: meuble.grille, u, teinteDe: meuble.teinteDe });
  return (
    <svg width={d.w} height={d.h} viewBox={`0 0 ${d.w} ${d.h}`} aria-hidden="true" className="vrm-p4-iso">
      <defs>
        <filter id={'f' + id} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={(u / 9).toFixed(1)} /></filter>
        <linearGradient id={'g' + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={d.fond[0]} /><stop offset="1" stopColor={d.fond[1]} /></linearGradient>
      </defs>
      {d.polys.map((p, k) => <polygon key={k} points={p.pts} fill={p.fill === 'url(#fond)' ? `url(#g${id})` : p.fill} filter={p.flou ? `url(#f${id})` : undefined}
        style={p.trait ? { stroke: p.trait, strokeWidth: p.epaisseur, strokeLinejoin: 'round' } : undefined} />)}
    </svg>);
}
function FaceMini({ meuble, taille }) {
  return (
    <span className="vrm-p4-face" data-couleur-meuble={couleurMeuble(meuble.m)} style={{ gridTemplateColumns: `repeat(${meuble.cols}, ${taille}px)` }} aria-hidden="true">
      {meuble.grille.flatMap((ligne, r) => ligne.map((p, c) => <i key={r + ':' + c} data-etat={p ? (p.etat || 'plein') : 'vide'} style={{ width: taille, height: taille }} />))}
    </span>);
}

export default function Piece({ meubles, choisi, onChoisir, bureau = false, mots, children }) {
  const [vue, setVueEtat] = React.useState(() => { try { return localStorage.getItem(CLE_VUE) === 'iso' ? 'iso' : 'face'; } catch (_) { return 'face'; } });
  const setVue = (v) => { setVueEtat(v); try { localStorage.setItem(CLE_VUE, v); } catch (_) {} };
  const nCases = meubles.reduce((s, x) => s + x.cols * x.rows, 0), nArt = meubles.reduce((s, x) => s + x.occupees, 0);
  // La taille d'une case de la miniature : le plus grand meuble tient dans ~120 px de haut.
  const maxR = Math.max(1, ...meubles.map((x) => x.rows)), maxC = Math.max(1, ...meubles.map((x) => x.cols));
  const taille = Math.max(5, Math.min(18, Math.floor(Math.min(130 / maxR, (bureau ? 170 : 150) / Math.max(1, maxC)))));
  const uIso = (x) => Math.max(7, Math.min(23, Math.floor(160 / (x.cols + x.rows * 0.9 + 1.2))));
  return (
    <section className="vrm-p4-piece" data-piece-vue={vue} aria-label={tr('etag4.piece')}>
      <div className="vrm-p4-piece-tete">
        <div>
          {bureau ? null : <span className="vrm-p4-sur" data-piece-resume={`${meubles.length}|${nCases}|${nArt}`}>{tr(meubles.length > 1 ? 'etag4.pieceResume' : 'etag4.pieceResume1', { meubles: meubles.length, cases: nCases, n: nArt, articles: mots && mots.noms ? mots.noms : tr('etag4.articles') })}</span>}
          <h3>{tr('etag4.piece')}</h3>
        </div>
        {/* À l'ordinateur, l'autre vue est un lien (« Isométrique » / « De face ») ; au téléphone, deux choix. */}
        {bureau
          ? <button type="button" className="sb-lien vrm-p4-lien" data-piece-choix={vue === 'iso' ? 'face' : 'iso'} onClick={() => setVue(vue === 'iso' ? 'face' : 'iso')}>{vue === 'iso' ? tr('etag4.deFace') : tr('etag4.iso')}</button>
          : <div className="vrm-p4-seg vrm-p4-seg-piece" role="radiogroup" aria-label={tr('etag4.piece')}>
              <button type="button" role="radio" aria-checked={vue === 'face'} data-piece-choix="face" onClick={() => setVue('face')}>{tr('etag4.deFace')}</button>
              <button type="button" role="radio" aria-checked={vue === 'iso'} data-piece-choix="iso" onClick={() => setVue('iso')}>{tr('etag4.iso')}</button>
            </div>}
      </div>
      <div className="vrm-p4-sol">
        {meubles.map((x) => (
          <button key={x.id} type="button" className="vrm-p4-mini" aria-pressed={choisi === x.id} data-piece-meuble={x.id} onClick={() => onChoisir && onChoisir(x.id)}
            aria-label={tr('etag4.voirMeuble', { nom: x.nom, n: x.occupees, total: x.cols * x.rows })}>
            {vue === 'iso' ? <IsoMini meuble={x} u={uIso(x)} /> : <FaceMini meuble={x} taille={taille} />}
            <b>{x.nom}</b><span className="vrm-p4-t2">{x.occupees}/{x.cols * x.rows}</span>
          </button>))}
      </div>
      {bureau ? null : <div className="vrm-p4-ordre-tete"><b>{tr('etag4.ordre')}</b><span>{tr('etag4.ordreAide')}</span></div>}
      <div className="vrm-p4-liste">
        {meubles.map((x, k) => (
          <button key={x.id} type="button" className="vrm-p4-rangee" data-piece-rangee={x.id} aria-current={choisi === x.id ? 'true' : undefined} onClick={() => onChoisir && onChoisir(x.id)}>
            <i className="vrm-p4-pastille" data-meuble-teinte={couleurMeuble(x.m)} aria-hidden="true" />
            <span className="vrm-p4-mid"><b>{bureau ? '' : (k + 1) + '. '}{x.nom}</b><span>{x.cols} × {x.rows}{x.pile ? ' · ' + tr('etag4.pile') : (bureau ? '' : ' · ' + tr('etag4.affichage.' + x.affichage).toLowerCase())}</span></span>
            {x.aSortir ? <span className="vrm-p4-badge" data-piece-a-sortir={x.aSortir} aria-label={tr('etag4.aSortirN', { n: x.aSortir })}>{x.aSortir}</span> : null}
            <span className="vrm-p4-chev" aria-hidden="true">›</span>
          </button>))}
      </div>
      {children}
    </section>);
}
