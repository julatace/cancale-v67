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

// Un fait de la rangée : icône + valeur, gris (jamais ambre). Absent ⇒ rien (jamais « 0 » inventé).
function Fait({ Icon, icone, children, data }) {
  return <span className="v2l-fait" data-v2l-fait={data}>{icone ? <Icon name={icone} size={14}/> : null}{children}</span>;
}

// Deux jeux de gestionnaires sur la même rangée (la sélection et le glisser) : chacun est appelé, le premier d'abord ; s'il
// arrête l'événement, le second ne le voit pas.
function fusionner(a, b) {
  if (!a || !b) return { ...(a || {}), ...(b || {}) };
  const out = { ...a, ...b };
  for (const k of Object.keys(a)) if (/^on[A-Z]/.test(k) && typeof a[k] === 'function' && typeof b[k] === 'function') out[k] = (e) => { a[k](e); if (e && typeof e.isPropagationStopped === 'function' && e.isPropagationStopped()) return; b[k](e); };
  return out;
}

export default function LigneAnnonce({ variante = 'A', attrs = {}, cle, photo, Photo, Icon, Plaque, titre, num, taille, jours, prix, favoris = null, vues = null,
  etat = '', achat = '', marge = '', aRelier = false, relierMot = false, onRelier, onPlus, LigneGlissable,
  // (17 nov., Ventes) La MÊME rangée A pour un colis : `sous` remplace « T · j » (« T. 42 · acheteur »), `gestes` ses
  // actions de glisser, `double` le N° porté par deux paires (le seul rouge).
  sous = null, sousAmbre = false, gestes = null, double = false,
  // (17 nov., Ventes — Julien : « il doit y avoir plusieurs infos ») une 3e ligne, petite, grise, chaque fait avec son icône
  // (`l3` : [{ icone, texte, ambre }], rien d'inconnu) ; `logo` : la plateforme, quand plusieurs sont montrées.
  l3 = null, logo = null,
  // (17 nov., Ventes · Toutes) `avant` : la colonne de 44 px À GAUCHE de la photo (la case de sélection, en mode sélection
  // seulement) ; `apresPrix` : un signe à côté du prix (la facture envoyée, verte).
  avant = null, apresPrix = null,
  // (17 nov., Ventes) ce qui suit le logo sur la 2e ligne (le pseudo de l'acheteur) : « N° · T42 · logo · pseudo ».
  apresLogo = null,
  // (18 nov., Ventes — « plusieurs infos ») une ligne grise de plus, entre la 2e et la 3e : `qui` = { logo, textes }
  // (le logo de la plateforme quand plusieurs sont montrées, puis « pseudo · vendue il y a 6 j ») ; rien d'inconnu.
  qui = null }) {
  const plus = () => onPlus && onPlus();
  const actions = gestes || [
    aRelier ? { cle: 'relier', libelle: tr('v2.l.relier'), icone: <Icon name="link" size={20}/>, faire: () => onRelier && onRelier(), data: { 'data-v2l-glisse': 'relier' } } : null,
    { cle: 'plus', libelle: tr('v2.l.plus'), icone: <Icon name="more" size={20}/>, faire: plus, data: { 'data-v2l-glisse': 'plus' } },
  ].filter(Boolean);
  const aria = [num ? 'N° ' + num : '', titre, prix, ...(sous || []), apresLogo && typeof apresLogo === 'string' ? apresLogo : '', ...((qui && qui.textes) || []), ...((l3 || []).map((x) => [x.aria, x.texte].filter(Boolean).join(' '))), aRelier ? tr('v2.l.aRelier') : ''].filter(Boolean).join(' · ');
  // « à relier » : sur un vrai compte, la plupart des paires n'ont pas d'achat relié — l'ambre partout ne dirait plus rien.
  // Le mot ambre seulement dans la vue « Sans achat relié » (`relierMot`) ; ailleurs, une petite icône de lien, neutre.
  const relier = !aRelier ? null : relierMot ? <span className="v2l-geste" data-v2l-relier="mot"><i className="v2-point" aria-hidden="true"/>{tr('v2.l.aRelier')}</span>
    : <span className="v2l-lien" data-v2l-relier="icone" title={tr('v2.l.aRelier')}><Icon name="link" size={16}/></span>;
  // Les faits connus de l'annonce (favoris, vues, jours en ligne ; acheté et marge — la règle de marge de la fiche).
  const fav = favoris != null ? <Fait Icon={Icon} icone="heart" data="favoris">{favoris}</Fait> : null;
  const vu = vues != null ? <Fait Icon={Icon} icone="eye" data="vues">{vues}</Fait> : null;
  const jr = jours != null ? <Fait Icon={Icon} icone="clock" data="jours">{tr('v2.l.jours', { n: jours })}</Fait> : null;
  const ach = achat ? <Fait Icon={Icon} data="achat">{tr('v2.l.achete', { p: achat })}{marge ? <b className="v2l-marge" data-v2l-marge={marge}>{marge}</b> : null}</Fait> : null;

  const corps = (gp, tiroir) => variante === 'C' ? (
    <div className="v2l v2l-c" data-v2l="C" role="listitem" aria-label={aria} {...attrs} {...(gp || {})}>
      <Vignette photo={photo} Photo={Photo} Icon={Icon} cls="v2l-photo-c"/>
      <span className="v2l-c-txt">
        <span className="v2l-c-titre">{titre}</span>
        <span className="v2l-c-l2"><span className="v2l-c-prix">{prix || '—'}</span>{relier}</span>
        {achat ? <span className="v2l-c-achat" data-v2l-fait="achat">{tr('v2.l.acheteMarge', { p: achat, m: marge || '—' })}</span> : null}
        <span className="v2l-c-puces">
          {num ? <span className="v2l-puce"><PlaqueV2 num={num}/></span> : null}
          {taille ? <span className="v2l-puce"><Fait Icon={Icon} icone="tag" data="taille">{tr('v2.l.taille', { t: taille })}</Fait></span> : null}
          {etat ? <span className="v2l-puce"><Fait Icon={Icon} icone="star" data="etat">{etat}</Fait></span> : null}
          {fav ? <span className="v2l-puce">{fav}</span> : null}
          {vu ? <span className="v2l-puce">{vu}</span> : null}
          {jr ? <span className="v2l-puce">{jr}</span> : null}
        </span>
      </span>
      {tiroir}
    </div>
  ) : (
    <div className="v2l v2l-a" data-v2l="A" role="listitem" aria-label={aria} {...fusionner(attrs, gp)}>
      {avant ? <span className="v2l-avant">{avant}</span> : null}
      <Vignette photo={photo} Photo={Photo} Icon={Icon} cls="v2l-photo-a"/>
      <span className="v2l-a-txt">
        <span className="v2l-a-l1"><span className="v2l-a-titre">{titre}</span>{apresPrix ? <span className="v2l-apres-prix">{apresPrix}</span> : null}<span className="v2l-a-prix">{prix || '—'}</span></span>
        {sous ? <span className="v2l-a-l2">{num ? <PlaqueV2 num={num} double={double}/> : null}{sous.length ? <span className={'v2l-faits-txt' + (sousAmbre ? ' is-ambre' : '')}>{(num ? ' · ' : '') + sous.join(' · ')}</span> : null}{logo ? <span className="v2l-logo" aria-hidden="true">{logo}</span> : null}{apresLogo ? <span className="v2l-apres-logo">{(sous && sous.length) || num || logo ? <span aria-hidden="true">{logo ? ' ' : ' · '}</span> : null}{apresLogo}</span> : null}</span>
          : <span className="v2l-a-l2"><Faits num={num} taille={taille} jours={null} Plaque={Plaque}/>{relier}</span>}
        {qui && ((qui.textes && qui.textes.length) || qui.logo) ? <span className="v2l-a-qui" aria-hidden="true">{qui.logo ? <span className="v2l-logo">{qui.logo}</span> : null}{(qui.textes || []).length ? <span className="v2l-qui-txt">{qui.textes.map((t, i) => <span key={i} className="v2l-qui-fait" data-v2l-pseudo={i === 0 && qui.pseudo ? '' : undefined}>{i ? ' · ' : ''}{t}</span>)}</span> : null}</span> : null}
        {l3 && l3.length ? <span className="v2l-a-l3" aria-hidden="true">{l3.map((x, i) => <span key={i} className={'v2l-l3' + (x.ambre ? ' is-ambre' : '')} data-v2l-l3={x.cle || undefined}>{x.noeud || null}{x.icone ? <Icon name={x.icone} size={13}/> : null}{x.texte}</span>)}</span>
          : (fav || vu || jr || ach ? <span className="v2l-a-l3">{fav}{vu}{jr}{ach}</span> : null)}
      </span>
      {tiroir}
    </div>
  );
  if (!LigneGlissable) return corps(null, null);
  return <LigneGlissable actions={actions} cle={cle} libelle={titre || 'annonce'}>{(gp, tiroir) => corps(gp, tiroir)}</LigneGlissable>;
}
