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
  return t.split(/(?<=[_.\-])/).map((x, k) => (k ? <React.Fragment key={k}><wbr/>{x}</React.Fragment> : x));
}

export function LigneConversation({ photo, Photo, nom, heure, quandIso, extrait, toi = '', num = '', offre = '', etat = '', nonLu = false, lectureSeule = false, actif = false, label, onClick, attrs = {}, apres = null }) {
  return (
    <RangeeTouchable className={'v2m-ligne' + (nonLu ? ' is-nonlu' : '') + (lectureSeule ? ' is-ro' : '') + (actif ? ' is-actif' : '')} label={label} onClick={onClick}
      attrs={{ 'data-v2-conv': '', 'aria-current': actif ? 'true' : undefined, ...attrs }}>
      <span className="v2m-point" aria-hidden="true" data-v2-conv-point={nonLu ? '1' : '0'}/>
      {/* (19 nov. soir, NATIF.md §2 bis — la liste « tableau de travail ») À gauche l'AVATAR de la personne (son initiale), à
          droite la VIGNETTE de l'article ; les mêmes valeurs qu'avant. */}
      <span className="v2m-av v2m-av-rond" aria-hidden="true">
        <span className="v2m-ini vrm-sensible" data-stream-type="acheteur">{String(nom || '').trim().charAt(0).toUpperCase() || '·'}</span>
      </span>
      <span className="v2m-txt">
        <span className="v2m-l1">
          <span className="v2m-nom vrm-sensible" data-stream-type="acheteur">{nomSecable(nom)}</span>
          <time className="v2m-heure" dateTime={quandIso || undefined}>{heure}</time>
        </span>
        <span className="v2m-extrait" data-v2-conv-extrait="">{toi ? <span className="v2m-toi">{toi} </span> : null}{extrait}</span>
        {(num || offre || etat || apres) ? <span className="v2m-l3">
          {num ? <Etiquette num={num}/> : null}
          {offre ? <span className="v2m-offre" data-v2-conv-offre="">{offre}</span> : null}
          {etat ? <span className="v2m-etat">{etat}</span> : null}
          {apres}
        </span> : null}
      </span>
      {photo && Photo ? <span className="v2m-vignette" aria-hidden="true" data-v2-conv-vignette=""><Photo src={photo} alt="" loading="lazy" decoding="async"/></span> : null}
    </RangeeTouchable>
  );
}
