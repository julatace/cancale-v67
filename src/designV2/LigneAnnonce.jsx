// ════════════════════════════════════════════════════════════════════════════
//  UNE ANNONCE DANS LA LISTE — nouveau design (17 nov.). Julien : « je n'aime pas trop la disposition des
//  annonces ni leur design… tout doit être parfait, simple d'utilisation ».
//  Deux dessins (Julien, 17 nov. : « J'aime bien A et C » ; B « Carte photo » retiré), choisis dans « ⋯ » → Affichage
//  (`vrm_annonces_affichage`, synchronisé) :
//    A « Liste nette »    — photo 64 (rayon 12), titre 17/600 sur une ligne, « N° · T · j » 15 gris, prix à droite,
//                            séparateurs en retrait ; un point ambre + « à relier » seulement s'il y a un geste ;
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
import { Etiquette } from './Signature.jsx';


function Vignette({ photo, Photo, Icon, cls }) {
  return (
    <span className={'v2l-photo ' + cls} aria-hidden="true">
      {photo && Photo ? <Photo src={photo} alt="" loading="lazy" decoding="async"/> : <span className="v2l-sans"><Icon name="cintre" size={22}/></span>}
    </span>
  );
}

function Faits({ num, taille, jours, Plaque, sep = ' · ' }) {
  const bouts = [taille ? tr('v2.l.taille', { t: taille }) : '', jours != null ? tr('v2.l.jours', { n: jours }) : ''].filter(Boolean);
  return <>{num ? <PlaqueV2 num={num}/> : null}{bouts.length ? <span className="v2l-faits-txt">{(num ? sep : '') + bouts.join(sep)}</span> : null}</>;
}

// Le N° d'une rangée : l'ÉTIQUETTE carton de la signature (src/designV2/Signature.jsx), la même partout ; `double` = son bord rouge.
function PlaqueV2({ num, double = false }) { return <Etiquette num={num} double={double}/>; }

export default function LigneAnnonce({ variante = 'A', attrs = {}, cle, photo, Photo, Icon, Plaque, titre, num, taille, jours, prix, favoris = null, vues = null,
  aRelier = false, relierMot = false, onRelier, onPlus, LigneGlissable,
  // (17 nov., Ventes) La MÊME rangée A pour un colis : `sous` remplace « T · j » (« T. 42 · acheteur »), `gestes` ses
  // actions de glisser, `double` le N° porté par deux paires (le seul rouge).
  sous = null, sousAmbre = false, gestes = null, double = false }) {
  const plus = () => onPlus && onPlus();
  const actions = gestes || [
    aRelier ? { cle: 'relier', libelle: tr('v2.l.relier'), icone: <Icon name="link" size={20}/>, faire: () => onRelier && onRelier(), data: { 'data-v2l-glisse': 'relier' } } : null,
    { cle: 'plus', libelle: tr('v2.l.plus'), icone: <Icon name="more" size={20}/>, faire: plus, data: { 'data-v2l-glisse': 'plus' } },
  ].filter(Boolean);
  const aria = [num ? 'N° ' + num : '', titre, prix, ...(sous || []), aRelier ? tr('v2.l.aRelier') : ''].filter(Boolean).join(' · ');
  // « à relier » : sur un vrai compte, la plupart des paires n'ont pas d'achat relié — l'ambre partout ne dirait plus rien.
  // Le mot ambre seulement dans la vue « Sans achat relié » (`relierMot`) ; ailleurs, une petite icône de lien, neutre.
  const relier = !aRelier ? null : relierMot ? <span className="v2l-geste" data-v2l-relier="mot"><i className="v2-point" aria-hidden="true"/>{tr('v2.l.aRelier')}</span>
    : <span className="v2l-lien" data-v2l-relier="icone" title={tr('v2.l.aRelier')}><Icon name="link" size={16}/></span>;

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
          {num ? <span className="v2l-fait"><PlaqueV2 num={num}/></span> : null}
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
        {sous ? <span className="v2l-a-l2">{num ? <PlaqueV2 num={num} double={double}/> : null}{sous.length ? <span className={'v2l-faits-txt' + (sousAmbre ? ' is-ambre' : '')}>{(num ? ' · ' : '') + sous.join(' · ')}</span> : null}</span>
          : <span className="v2l-a-l2"><Faits num={num} taille={taille} jours={jours} Plaque={Plaque}/>{relier}</span>}
      </span>
      {tiroir}
    </div>
  );
  if (!LigneGlissable) return corps(null, null);
  return <LigneGlissable actions={actions} cle={cle} libelle={titre || 'annonce'}>{(gp, tiroir) => corps(gp, tiroir)}</LigneGlissable>;
}
