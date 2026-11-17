// ════════════════════════════════════════════════════════════════════════════
//  UNE ANNONCE DANS LA LISTE — nouveau design (17 nov.). Julien : « je n'aime pas trop la disposition des
//  annonces ni leur design… tout doit être parfait, simple d'utilisation ».
//  Trois dessins, à choisir (clé d'essai `vrm_design_v2_ligne` = A · B · C, A par défaut) :
//    A « Liste nette »    — photo 64 (rayon 12), titre 17/600 sur une ligne, « N° · T · j » 15 gris, prix à droite,
//                            séparateurs en retrait ; un point ambre + « à relier » seulement s'il y a un geste ;
//    B « Carte photo »    — grille 2 colonnes de photos 4:5, N° en haut à gauche, prix en pastille en bas,
//                            titre sur 2 lignes au plus, taille et jours en gris ; appui long ⇒ la fiche ;
//    C « Fiche compacte » — photo 88 à gauche ; titre sur 2 lignes, grand prix, trois faits (N°, taille, jours)
//                            en icône + texte ; favoris et vues s'ils sont connus.
//  Partout : rien de redit par rangée (ni le compte — dans l'en-tête du groupe —, ni un gros bouton « Relier ») ;
//  grille de 8 px, gouttières 16 ; même hauteur pour toutes les rangées d'un dessin ; chiffres tabulaires ; photo
//  recadrée pareil partout, sans photo : fond uni + cintre. Glisser vers la gauche : l'action principale (relier,
//  sinon la fiche) puis « Plus » (la fiche). Toucher la rangée ouvre LA fiche de la paire (ses `data-fl-*`, posés
//  par l'écran : la même identité que la carte d'hier, qui reste montée, cachée, avec tous ses gestes).
//  AUCUNE règle ici : le N°, « à relier » (`sansAchatRelie`), la taille, les jours, le prix viennent de l'écran.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import './design-v2.css';

export const CLE_LIGNE_V2 = 'vrm_design_v2_ligne';
export function varianteLigne() {
  try { const v = localStorage.getItem(CLE_LIGNE_V2); return v === 'B' || v === 'C' ? v : 'A'; } catch (_) { return 'A'; }
}

function Vignette({ photo, Photo, Icon, cls }) {
  return (
    <span className={'v2l-photo ' + cls} aria-hidden="true">
      {photo && Photo ? <Photo src={photo} alt="" loading="lazy" decoding="async"/> : <span className="v2l-sans"><Icon name="cintre" size={22}/></span>}
    </span>
  );
}

function Faits({ num, taille, jours, Plaque, sep = ' · ' }) {
  const bouts = [taille ? tr('v2.l.taille', { t: taille }) : '', jours != null ? tr('v2.l.jours', { n: jours }) : ''].filter(Boolean);
  return <>{num ? <Plaque num={num}/> : null}{bouts.length ? <span className="v2l-faits-txt">{(num ? sep : '') + bouts.join(sep)}</span> : null}</>;
}

// L'appui long (B) : 500 ms sans bouger ⇒ la fiche ; le clic qui suit est avalé.
function useAppuiLong(f) {
  const t = React.useRef(null), pris = React.useRef(false), depart = React.useRef(null);
  const fin = () => { if (t.current) { clearTimeout(t.current); t.current = null; } };
  return {
    onPointerDown: (e) => { pris.current = false; depart.current = [e.clientX, e.clientY]; fin(); t.current = setTimeout(() => { pris.current = true; try { navigator.vibrate && navigator.vibrate(8); } catch (_) {} f(e); }, 500); },
    onPointerMove: (e) => { const d = depart.current; if (d && Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 8) fin(); },
    onPointerUp: fin, onPointerCancel: fin,
    onClickCapture: (e) => { if (pris.current) { e.preventDefault(); e.stopPropagation(); pris.current = false; } },
    onContextMenu: (e) => { e.preventDefault(); },
  };
}

export default function LigneAnnonce({ variante = 'A', attrs = {}, cle, photo, Photo, Icon, Plaque, titre, num, taille, jours, prix, favoris = null, vues = null,
  aRelier = false, onRelier, onPlus, LigneGlissable }) {
  const plus = () => onPlus && onPlus();
  const long = useAppuiLong(plus);
  const actions = [
    aRelier ? { cle: 'relier', libelle: tr('v2.l.relier'), icone: <Icon name="link" size={20}/>, faire: () => onRelier && onRelier(), data: { 'data-v2l-glisse': 'relier' } } : null,
    { cle: 'plus', libelle: tr('v2.l.plus'), icone: <Icon name="more" size={20}/>, faire: plus, data: { 'data-v2l-glisse': 'plus' } },
  ].filter(Boolean);
  const aria = [num ? 'N° ' + num : '', titre, prix, aRelier ? tr('v2.l.aRelier') : ''].filter(Boolean).join(' · ');
  const relier = aRelier ? <span className="v2l-geste" data-v2l-relier=""><i className="v2-point" aria-hidden="true"/>{tr('v2.l.aRelier')}</span> : null;

  if (variante === 'B') {
    return (
      <div className="v2l v2l-b" data-v2l="B" role="listitem" aria-label={aria} {...attrs} {...long}>
        <span className="v2l-b-cadre">
          <Vignette photo={photo} Photo={Photo} Icon={Icon} cls="v2l-photo-b"/>
          {num ? <span className="v2l-b-num"><Plaque num={num}/></span> : null}
          {prix ? <span className="v2l-b-prix">{prix}</span> : null}
          {aRelier ? <span className="v2l-b-point" aria-hidden="true"><i className="v2-point"/></span> : null}
        </span>
        <span className="v2l-b-titre">{titre}</span>
        <span className="v2l-b-faits">{[taille ? tr('v2.l.taille', { t: taille }) : '', jours != null ? tr('v2.l.jours', { n: jours }) : ''].filter(Boolean).join(' · ') || ' '}</span>
      </div>
    );
  }
  const corps = (gp, tiroir) => variante === 'C' ? (
    <div className="v2l v2l-c" data-v2l="C" role="listitem" aria-label={aria} {...attrs} {...(gp || {})}>
      <Vignette photo={photo} Photo={Photo} Icon={Icon} cls="v2l-photo-c"/>
      <span className="v2l-c-txt">
        <span className="v2l-c-titre">{titre}</span>
        <span className="v2l-c-l2">
          <span className="v2l-c-prix">{prix || '—'}</span>
          {relier || <span className="v2l-c-stats">
            {favoris != null ? <span className="v2l-fait"><Icon name="heart" size={16}/>{favoris}</span> : null}
            {vues != null ? <span className="v2l-fait"><Icon name="eye" size={16}/>{vues}</span> : null}
          </span>}
        </span>
        <span className="v2l-c-faits">
          {num ? <span className="v2l-fait"><Plaque num={num}/></span> : null}
          {taille ? <span className="v2l-fait"><Icon name="tag" size={16}/>{tr('v2.l.taille', { t: taille })}</span> : null}
          {jours != null ? <span className="v2l-fait"><Icon name="clock" size={16}/>{tr('v2.l.jours', { n: jours })}</span> : null}
        </span>
      </span>
      {tiroir}
    </div>
  ) : (
    <div className="v2l v2l-a" data-v2l="A" role="listitem" aria-label={aria} {...attrs} {...(gp || {})}>
      <Vignette photo={photo} Photo={Photo} Icon={Icon} cls="v2l-photo-a"/>
      <span className="v2l-a-txt">
        <span className="v2l-a-l1"><span className="v2l-a-titre">{titre}</span><span className="v2l-a-prix">{prix || '—'}</span></span>
        <span className="v2l-a-l2"><Faits num={num} taille={taille} jours={jours} Plaque={Plaque}/>{relier}</span>
      </span>
      {tiroir}
    </div>
  );
  if (!LigneGlissable) return corps(null, null);
  return <LigneGlissable actions={actions} cle={cle} libelle={titre || 'annonce'}>{(gp, tiroir) => corps(gp, tiroir)}</LigneGlissable>;
}
