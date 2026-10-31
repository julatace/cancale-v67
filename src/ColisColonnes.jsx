// ── COLIS EN QUATRE COLONNES (31 oct., maquette choisie par Julien) ──────────
// Ordinateur : « Prêts à imprimer » · « En attente » · « À retirer » · « Partis »,
// côte à côte, chacune avec son compteur. Téléphone : les mêmes quatre groupes,
// empilés, cartes au doigt (44 px). Les colonnes viennent de `colonnesColis`
// (src/colisColonnes.js), qui ne fait que ranger ce que les règles de l'app ont
// déjà décidé. Rien ici ne décide ni ne cache un colis : une colonne longue se
// replie derrière un bouton qui DIT combien il en reste.
import React from 'react';
import './styles-colis-colonnes.css';

const PLAFOND = 8;

function Carte({ x, colonne, Photo, onOuvrir }) {
  const corps = (
    <>
      <span className="vrm-cc-haut">
        <span className="vrm-cc-photo" aria-hidden="true">{(x.photo && Photo && Photo(x.photo)) || <span className="vrm-cc-photo-vide"/>}</span>
        <span className="vrm-cc-nom" title={x.nom}>{x.nom}</span>
      </span>
      <span className="vrm-cc-bas">
        <span className={'vrm-cc-etat' + (x.ambre ? ' is-ambre' : '')}>{x.etat || '—'}</span>
        {x.num ? <span className="vrm-cc-num" data-numero={x.num}>N°{x.num}</span> : null}
      </span>
    </>
  );
  const attrs = { 'data-cc-carte': x.cle, 'data-cc-dans': colonne, 'data-site': x.site || 'vinted', 'data-ambre': x.ambre ? '1' : undefined, 'data-a-verifier': x.aVerifier ? '1' : undefined };
  return onOuvrir && x.ouvrir
    ? <button type="button" className="vrm-cc-carte" {...attrs} onClick={() => onOuvrir(x)}>{corps}</button>
    : <div className="vrm-cc-carte" {...attrs}>{corps}</div>;
}

function Colonne({ col, Photo, onOuvrir, note, pied }) {
  const [tout, setTout] = React.useState(false);
  const n = col.cartes.length;
  const montrees = tout ? col.cartes : col.cartes.slice(0, PLAFOND);
  const reste = n - montrees.length;
  return (
    <section className="vrm-cc-col" data-cc-colonne={col.cle} data-cc-n={n} aria-label={`${col.titre} : ${n}`}>
      <header className="vrm-cc-tete">
        <h2>{col.titre}</h2>
        <span className="vrm-cc-compte">{n}</span>
      </header>
      {note ? <p className="vrm-cc-note" data-cc-note={col.cle}>{note}</p> : null}
      <div className="vrm-cc-liste">
        {montrees.map((x) => <Carte key={x.cle} x={x} colonne={col.cle} Photo={Photo} onOuvrir={onOuvrir}/>)}
        {!n && !note ? <p className="vrm-cc-vide">Rien pour l'instant.</p> : null}
        {reste > 0 && <button type="button" className="vrm-cc-plus" data-cc-plus={reste} onClick={() => setTout(true)}>Voir les {reste} autres</button>}
      </div>
      {pied ? <div className="vrm-cc-pied">{pied}</div> : null}
    </section>
  );
}

export default function ColisColonnes({ colonnes, total, Photo, onOuvrir, notes = {}, pieds = {} }) {
  return (
    <div className="vrm-cc" data-colis-colonnes={total}>
      {colonnes.map((col) => <Colonne key={col.cle} col={col} Photo={Photo} onOuvrir={onOuvrir} note={notes[col.cle]} pied={pieds[col.cle]}/>)}
    </div>
  );
}
