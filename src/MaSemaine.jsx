// ══════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN « MA SEMAINE » (10 nov., lot BC)
//  Ouvert par la notification du dimanche soir (`?tab=semaine&lundi=…`), par Ma
//  journée et par Statistiques. Peu de texte, du visuel (direction artistique 6 :
//  widgets blancs, chiffres 34/800, une petite barre par jour). Les chiffres et la
//  comparaison : src/maSemaine.js (aucune règle ici, rien de calculé dans le rendu).
//  Couleur RARE (§7) : la comparaison est NEUTRE (gris, flèche) — jamais rouge ni
//  vert ; l'accent seulement sur la barre du jour ; ambre = un geste (prix d'achat).
//  « Pas su » = « — » et sa raison ; un minimum dit « au moins ».
// ══════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { montant } from './format.js';
import { raisonCourte } from './design/carteChiffres.js';
import './styles-ma-semaine.css';

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const jm = (ymd) => { const [, m, d] = String(ymd).split('-').map(Number); return { d: d === 1 ? '1er' : String(d), m: MOIS[m - 1] || '' }; };
// « 2 – 8 nov. » ; « 27 oct. – 2 nov. ».
export const periodeCourte = (lundi, dimanche) => {
  const a = jm(lundi), b = jm(dimanche);
  return a.m === b.m ? `${a.d} – ${b.d} ${b.m}` : `${a.d} ${a.m} – ${b.d} ${b.m}`;
};
const cents = (v) => (v == null ? '' : String(Math.round(Number(v) * 100)));
const nFr = (n) => Number(n).toLocaleString('fr-FR');
const eur = (v) => montant(v, { centimes: 'jamais' });

const Fleche = ({ sens }) => (
  <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" className="vrm-ms-fleche" data-sens={sens}>
    {sens === 'egal' ? <path d="M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      : <path d={sens === 'hausse' ? 'M6 10V2M2.5 5.5 6 2l3.5 3.5' : 'M6 2v8M2.5 6.5 6 10l3.5-3.5'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}
  </svg>
);

// La comparaison : flèche + écart, neutre. Pas comparable ⇒ rien (jamais une flèche fausse).
function Ecart({ e, t }) {
  if (!e) return <span className="vrm-ms-ecart is-vide" data-ms-ecart="" aria-hidden="true"/>;
  const v = t === 'eur' ? montant(e.delta, { centimes: 'jamais', signe: true }) : (e.delta > 0 ? '+' : '') + nFr(e.delta);
  const txt = e.sens === 'egal' ? 'comme la semaine d’avant' : `${v} vs semaine d’avant`;
  return <span className="vrm-ms-ecart" data-ms-ecart={cents(e.delta)} data-sens={e.sens}><Fleche sens={e.sens}/>{txt}</span>;
}

// Un chiffre : sa valeur (ou « — »), « au moins » s'il manque quelque chose, la raison d'un « — ».
function Valeur({ x, t, grand = false }) {
  const vide = !x || x.valeur == null;
  const corps = vide ? '—' : t === 'eur' ? eur(x.valeur) : nFr(x.valeur);
  return (
    <b className={'vrm-ms-v' + (grand ? ' is-grand' : '') + (vide ? ' is-vide' : '')} data-ms-valeur={vide ? '' : t === 'eur' ? cents(x.valeur) : String(x.valeur)} data-partiel={x && x.partiel ? '1' : undefined}>
      {!vide && x.partiel ? <span className="vrm-ms-borne">au moins </span> : null}{corps}
    </b>
  );
}
const sousDe = (x) => {
  if (!x) return '';
  if (x.valeur == null) return raisonCourte(x.raison === 'aDater' ? { ...x, raison: 'a-dater', aDater: x.nAd } : x);
  if (x.couverture) return `${x.couverture} prix d’achat`;
  if (x.partiel && x.manque && x.manque.length) return `sans ${x.manque[0]}`;
  return '';
};

function Widget({ cle, l, x, t, e = null, large = false, onClick = null, porte = '', sous: sousImpose = '' }) {
  const sous = sousDe(x) || sousImpose;
  const contenu = (
    <>
      <span className="vrm-ms-l">{l}</span>
      <Valeur x={x} t={t}/>
      {sous ? <small className="vrm-ms-sous" data-ms-raison={x && x.valeur == null ? '' : undefined}>{sous}</small> : null}
      {porte ? <span className="vrm-ms-porte" data-ms-porte={cle}>{porte}</span> : null}
      <Ecart e={e} t={t}/>
    </>
  );
  const attrs = { className: 'vrm-ms-w' + (large ? ' is-large' : ''), 'data-ms-chiffre': cle };
  return onClick
    ? <button type="button" {...attrs} onClick={onClick}>{contenu}</button>
    : <div {...attrs}>{contenu}</div>;
}

export default function MaSemaine({ M, entete = null, onSemaine, onNav }) {
  const { chiffres: c, ecarts: e } = M;
  const max = Math.max(0, ...M.jours.map((j) => (j.valeur > 0 ? j.valeur : 0)));
  const periode = periodeCourte(M.lundi, M.dimanche);
  const brutPorte = c.brut && (c.brut.raison === 'achats' || (c.brut.n != null && c.brut.nCout != null && c.brut.nCout < c.brut.n));
  const d = M.dorment;
  return (
    <div className="vrm-ms" data-ma-semaine={M.lundi} data-ms-en-cours={M.enCours ? '1' : '0'}>
      {entete}
      <nav className="vrm-ms-nav" aria-label="Choisir la semaine">
        <button type="button" className="vrm-ms-nav-b" aria-label="Semaine d’avant" data-ms-prec={M.lundiAvant} disabled={M.premiere} onClick={() => onSemaine && onSemaine(M.lundiAvant)}>
          <svg width="9" height="15" viewBox="0 0 8 14" aria-hidden="true"><path d="M6.8 1.2 1.2 7l5.6 5.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div className="vrm-ms-quand">
          <b data-ms-periode={periode}>{M.enCours ? 'Cette semaine' : periode}</b>
          <span>{M.enCours ? periode : M.titre}</span>
        </div>
        <button type="button" className="vrm-ms-nav-b" aria-label="Semaine d’après" data-ms-suiv={M.lundiApres || ''} disabled={!M.lundiApres} onClick={() => M.lundiApres && onSemaine && onSemaine(M.lundiApres)}>
          <svg width="9" height="15" viewBox="0 0 8 14" aria-hidden="true"><path d="M1.2 1.2 6.8 7l-5.6 5.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </nav>

      <section className="vrm-ms-w vrm-ms-hero" data-ms-chiffre="vendu" aria-label="Vendu cette semaine">
        <span className="vrm-ms-l">Vendu</span>
        <Valeur x={c.vendu} t="eur" grand/>
        {sousDe(c.vendu) ? <small className="vrm-ms-sous">{sousDe(c.vendu)}</small> : null}
        <Ecart e={e.vendu} t="eur"/>
        <ol className="vrm-ms-barres" aria-label="Vendu par jour">
          {M.jours.map((j) => (
            <li key={j.iso} className="vrm-ms-jour" data-ms-jour={j.iso} data-futur={j.futur ? '' : undefined} data-auj={j.aujourdhui ? '' : undefined}
              data-ms-jour-valeur={j.valeur == null ? '' : cents(j.valeur)}
              title={j.futur ? undefined : `${j.lettre} ${jm(j.iso).d} · ${j.valeur == null ? '—' : eur(j.valeur)}`}>
              <i className="vrm-ms-barre" aria-hidden="true" style={{ '--h': j.valeur > 0 && max > 0 ? (0.08 + 0.92 * j.valeur / max).toFixed(3) : 0 }}/>
              <span aria-hidden="true">{j.lettre}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="vrm-ms-grille">
        <Widget cle="ventes" l="Ventes" x={c.ventes} t="n" e={e.ventes} onClick={onNav ? () => onNav('cat_ventes') : null}/>
        <Widget cle="brut" l="Bénéfice brut" x={c.brut} t="eur" e={e.brut}
          porte={brutPorte ? 'Saisir les prix d’achat' : ''} onClick={onNav ? () => onNav('cat_ventes') : null}/>
        <Widget cle="recu" l="Reçu" x={c.recu} t="eur" e={e.recu}/>
        <Widget cle="colis" l="Colis envoyés" x={c.colis} t="n" e={e.colis} onClick={onNav ? () => onNav('cat_bord') : null}/>
        <Widget cle="dorment" l="Paires qui dorment" large t="n"
          x={d.etat === 'su' ? { valeur: d.n, partiel: d.auMoins, manque: [] } : { valeur: null, hors: 'ouvre Annonces' }}
          sous="en ligne depuis plus de 30 jours"
          onClick={onNav ? () => onNav('annonces') : null}/>
      </div>
      <p className="vrm-ms-pied">Vendu : jour de la vente. Reçu : jour du versement.</p>
    </div>
  );
}
