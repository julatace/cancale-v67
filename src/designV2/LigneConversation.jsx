// ════════════════════════════════════════════════════════════════════════════
//  MESSAGES, NOUVEAU DESIGN (17 nov.) — la liste façon Mail d'iPhone, groupée par compte.
//  · `GroupeConversations` : l'en-tête du compte (son nom, « ouvert dans Chrome » ou « lecture seule ») HORS de la
//    carte, puis UNE carte de rangées (séparateurs en retrait) — CLAUDE.md §3 « Messages, comptes » : un groupe par
//    compte, jamais mélangés (l'ordre vient de `groupesParCompte`, src/designV2/messagesV2.js) ;
//  · `LigneConversation` : la photo de la paire (sinon l'initiale du pseudo), le pseudo 17/600, l'heure à droite
//    (sa largeur naturelle, jamais celle du nom — audit C7), l'extrait sur 2 lignes 15, l'étiquette kraft du N° quand
//    il est CONNU (par identité, posé par l'écran), le point non lu. Aucun bouton dans la rangée : elle se touche
//    entière et ouvre le fil (le même `openConversation` qu'hier).
//  AUCUNE règle ici : extrait, N°, offre, non lu, compte viennent de l'écran (les mêmes valeurs que la liste d'hier).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { RangeeTouchable } from './BoutonV2.jsx';
import { Etiquette } from './Signature.jsx';
import { TuilePaire } from '../natif/index.js';   // (24 nov., visuel-argent) la paire comme une pièce d'inventaire
import './design-v2.css';
import './messages-v2.css';

export function GroupeConversations({ titre, sous = '', attrs = {}, children }) {
  return (
    <section className="v2m-groupe" {...attrs}>
      <h2 className="v2m-groupe-titre"><span className="v2m-groupe-nom vrm-sensible" data-stream-type="compte">{titre}</span>{sous ? <span className="v2m-groupe-sous">{sous}</span> : null}</h2>
      <div className="v2m-carte">{children}</div>
    </section>
  );
}

// (20 nov., « ce qui manque ») Un pseudo se replie à ses séparateurs (« lea_ | sneakers », « adam. | martin92 »), jamais
// au milieu d'un mot : une occasion de coupure (<wbr>) après chaque « _ », « . », « - ». Le texte lu reste le même.
export function nomSecable(nom) {
  const t = String(nom == null ? '' : nom);
  if (!/[_.\-]/.test(t)) return t;
  // (20 nov., intégration) Sans lookbehind `(?<=…)` : Safari < 16.4 refuse de lire TOUT le fichier qui en contient un (audit-safari).
  return (t.match(/[^_.\-]*[_.\-]|[^_.\-]+$/g) || [t]).map((x, k) => (k ? <React.Fragment key={k}><wbr/>{x}</React.Fragment> : x));
}

// (24 nov., visuel-argent — « toute l'application visuelle ») La rangée : à gauche la PAIRE en tuile (sa photo, trouvée PAR
// IDENTITÉ par l'écran : la photo de l'annonce de la conversation ou de la fiche reliée ; jamais l'avatar de l'acheteur ;
// sans photo, un médaillon), et l'AVATAR DU COMPTE (son initiale) posé sur son coin ; le non-lu = un point calme à
// l'ardoise, fixe ; l'offre = une pastille visuelle (icône + prix). Les mêmes valeurs, les mêmes data-* qu'avant.
const initiale = (t) => String(t || '').trim().replace(/^[^\p{L}\p{N}]+/u, '').charAt(0).toUpperCase() || '·';
export function LigneConversation({ photo, Photo, Icon = null, nom, compte = '', heure, quandIso, extrait, toi = '', num = '', offre = '', etat = '', nonLu = false, lectureSeule = false, actif = false, label, onClick, attrs = {}, apres = null, revele = null }) {
  return (
    <RangeeTouchable className={'v2m-ligne' + (nonLu ? ' is-nonlu' : '') + (lectureSeule ? ' is-ro' : '') + (actif ? ' is-actif' : '') + (revele ? ' ' + revele.className : '')} label={label} onClick={onClick}
      attrs={{ 'data-v2-conv': '', 'aria-current': actif ? 'true' : undefined, ...(revele ? { style: revele.style } : {}), ...attrs }}>
      <span className="v2m-point" aria-hidden="true" data-v2-conv-point={nonLu ? '1' : '0'}/>
      <span className="v2m-tuile" aria-hidden="true" data-v2-conv-vignette={photo ? '' : undefined}>
        <TuilePaire photo={photo || ''} Photo={Photo} Icon={Icon} icone="chat" genre="message" taille="m"/>
        {compte ? <span className="v2m-compte-av vrm-sensible" data-stream-type="compte" data-v2-conv-compte-av="" title={compte}>{initiale(compte)}</span> : null}
      </span>
      <span className="v2m-txt">
        <span className="v2m-l1">
          <span className="v2m-nom vrm-sensible" data-stream-type="acheteur">{nomSecable(nom)}</span>
          <time className="v2m-heure" dateTime={quandIso || undefined}>{heure}</time>
        </span>
        <span className="v2m-extrait" data-v2-conv-extrait="">{toi ? <span className="v2m-toi">{toi} </span> : null}{extrait}</span>
        {(num || offre || etat || apres) ? <span className="v2m-l3">
          {num ? <Etiquette num={num}/> : null}
          {offre ? <span className="v2m-offre v2m-puce-offre" data-v2-conv-offre="">{Icon ? <Icon name="tag" size={13}/> : null}<span>{offre}</span></span> : null}
          {etat ? <span className="v2m-etat">{etat}</span> : null}
          {apres}
        </span> : null}
      </span>
    </RangeeTouchable>
  );
}
