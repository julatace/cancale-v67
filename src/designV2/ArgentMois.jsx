// ════════════════════════════════════════════════════════════════════════════
//  ARGENT · MOIS — le nouveau design (17 nov., phase 2). Seulement allumé (`vrm_design_v2`).
//  AUCUN calcul ici : tout arrive déjà calculé de src/ecrans/Compta.jsx (`ArgentMoisV2`), par les MÊMES
//  règles que l'écran d'hier (`valeurChiffre`, `questionsArgent`, la ligne publiée `vinted_urssaf_mois`,
//  le livre des recettes). Ce composant choisit, range et nomme :
//    · le chiffre d'affiche : « 1 107 € reçus en novembre » (REÇU = daté au versement, §5), sa phrase de la
//      même source (« au moins » sur le montant quand il est partiel, le manque nommé dessous) ;
//    · le graphe des six mois (≤ 80 px), une seule série, le mois en cours plein ;
//    · UNE rangée de faits (disponible, en attente, bénéfice, coûts saisis N sur M), chacun la porte de son détail ;
//    · le geste plein seulement s'il y en a un (« Saisir 3 prix d'achat » : le chiffre faux est la porte) ;
//    · les versements du mois en rangées A, chacune avec son étiquette N° (kraft), le montant à droite.
//  Trois états partout : `undefined` en cours (« … »), `null` pas su (« — » + la raison), une valeur lue.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { BoutonV2 } from './BoutonV2.jsx';
import './design-v2.css';
import './argent-v2.css';

const cents = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : String(Math.round(Number(x) * 100)));

// L'étiquette N° (la signature : le N° écrit sur le carton). `.v2-etiquette` est le composant commun du design ;
// le dessin de repli vit dans argent-v2.css sous `:where()` (le composant commun gagne quand il arrive).
export function EtiquetteN({ num }) {
  return <span className="v2-etiquette" data-v2-etiquette={num}><small>N°</small>{num}</span>;
}

// Le chiffre d'affiche : le nombre et son mot sur la même ligne de base (« 1 107 € reçus en novembre »).
function Affiche({ poster, montant, moisLong }) {
  const { valeur, partiel } = poster;
  return (
    <p className="v2-ar-affiche" data-v2-argent-recu={cents(valeur)} data-v2-argent-partiel={partiel ? '1' : undefined}>
      {valeur == null
        ? <b className="v2-ar-nb" data-v2-pas-su="">—</b>
        : <>{partiel ? <small className="v2-ar-auMoins">{tr('journee.moins')} </small> : null}<b className="v2-ar-nb">{montant(valeur)}</b></>}
      <span className="v2-ar-mot">{tr('v2.ar.recusEn', { mois: moisLong })}</span>
    </p>
  );
}

// Le graphe : six barres, une série (le reçu de chaque mois, daté au versement). Une barre « pas su » est une
// amorce hachurée, jamais une barre à zéro. Le nombre de chaque barre est dans son `title` et dans la liste lue
// par le lecteur d'écran (aucun montant redit à l'écran : il est déjà l'affiche).
function Barres({ barres, montant }) {
  const max = Math.max(1, ...barres.map((b) => (b.v != null && b.v > 0 ? b.v : 0)));
  const nom = (b) => `${b.long} : ${b.v == null ? tr('v2.ar.pasSu') : (b.partiel ? tr('journee.moins') + ' ' : '') + montant(b.v)}`;
  return (
    <figure className="v2-ar-barres" data-v2-argent-barres={barres.map((b) => cents(b.v)).join(',')} aria-label={tr('v2.ar.graphe')}>
      <ul className="v2-ar-barres-piste" role="list">
        {barres.map((b) => (
          <li key={b.cle} className="v2-ar-barre" data-courant={b.courant ? '' : undefined} data-vide={b.v == null ? '' : undefined} title={nom(b)} aria-label={nom(b)}>
            <span className="v2-ar-barre-col"><i style={{ height: b.v == null ? '10%' : `${Math.max(4, (Math.max(0, b.v) / max) * 100)}%` }}/></span>
            <span className="v2-ar-barre-l" aria-hidden="true">{b.l}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function Fait({ f }) {
  return (
    <button type="button" className="v2-rangee v2-ar-fait" data-v2-rangee="" data-v2-argent-fait={f.id} data-v2-argent-valeur={f.cents} onClick={f.onClick} title={f.titre || undefined}>
      <span className="v2-ar-fait-l">{f.l}</span>
      <b className="v2-ar-fait-v" data-v2-pas-su={f.pasSu ? '' : undefined}>{f.auMoins ? <small>{tr('journee.moins')} </small> : null}{f.v}</b>
      {f.sous ? <span className="v2-ar-fait-s">{f.sous}</span> : null}
    </button>
  );
}

function LigneVersement({ l, montant }) {
  const corps = (<>
    <span className="v2-ar-v-txt">
      <span className="v2-ar-v-titre">{l.titre || tr('v2.ar.venteSans', { plateforme: l.plateforme || '' })}</span>
      <span className="v2-ar-v-sous">{l.num ? <EtiquetteN num={l.num}/> : null}<span className="v2-ar-v-date">{l.date}{l.plateforme ? ` · ${l.plateforme}` : ''}</span></span>
    </span>
    <b className="v2-ar-v-eur" data-v2-pas-su={l.montant == null ? '' : undefined}>{l.montant == null ? '—' : montant(l.montant)}</b>
  </>);
  const attrs = { 'data-v2-argent-versement': l.id, 'data-eur': cents(l.montant) };
  return l.num
    ? <button type="button" className="v2-rangee v2-ar-v" data-v2-rangee="" {...attrs} onClick={l.onClick}>{corps}</button>
    : <div className="v2-ar-v" {...attrs}>{corps}</div>;
}

export default function ArgentMois({ poster, phrase, moisLong, barres, faits, geste, versements, montant }) {
  return (
    <section className="v2-argent v2-ar-mois" data-v2-argent-mois="" aria-label={tr('v2.ar.seg.resume')}>
      <div className="v2-ar-tete">
        <Affiche poster={poster} montant={montant} moisLong={moisLong}/>
        {phrase ? <p className="v2-ar-phrase" data-v2-argent-phrase="">{phrase}</p> : null}
        <Barres barres={barres} montant={montant}/>
      </div>
      <div className="v2-ar-faits" data-v2-argent-faits={faits.length}>
        {faits.map((f) => <Fait key={f.id} f={f}/>)}
      </div>
      {geste ? <div className="v2-ar-geste"><BoutonV2 role="principal" plein onClick={geste.onClick} attrs={{ 'data-v2-principal': geste.id, 'data-v2-argent-geste': String(geste.n) }}>{geste.libelle}</BoutonV2></div> : null}
      <h2 className="v2-ar-h">{tr('v2.ar.versements', { mois: moisLong })}</h2>
      {versements.etat === 'encours' ? <p className="v2-ar-vide" role="status">…</p>
        : versements.etat === 'passu' ? <p className="v2-ar-vide" data-v2-argent-versements="passu">{tr('v2.ar.versementsPasSu')}</p>
        : !versements.lignes.length ? <p className="v2-ar-vide" data-v2-argent-versements="0">{tr('v2.ar.aucunVersement', { mois: moisLong })}</p>
        : <div className="v2-ar-liste" role="list" data-v2-argent-versements={String(versements.n)}>
            {versements.lignes.map((l) => <LigneVersement key={l.id} l={l} montant={montant}/>)}
          </div>}
      {versements.etat === 'lu' && versements.reste > 0 ? <p className="v2-ar-reste">{tr('v2.ar.autres', { n: versements.reste })}</p> : null}
    </section>
  );
}
