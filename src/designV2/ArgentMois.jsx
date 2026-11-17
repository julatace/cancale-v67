// ════════════════════════════════════════════════════════════════════════════
//  ARGENT · MOIS — le nouveau design (17 nov., phase 2). Seulement allumé (`vrm_design_v2`).
//  AUCUN calcul ici : tout arrive déjà calculé de src/ecrans/Compta.jsx (`ArgentMoisV2`), par les MÊMES
//  règles que l'écran d'hier (`valeurChiffre`, `questionsArgent`, la ligne publiée `vinted_urssaf_mois`,
//  le livre des recettes, le relevé de Ventes). Ce composant choisit, range et nomme :
//    · le chiffre d'affiche (la signature) : « 1 107 € reçus en novembre » — REÇU, daté au versement (§5) ;
//      « au moins » collé au montant quand il est partiel, la phrase de la même source dessous ;
//    · six mois en barres (≤ 80 px), une seule série ; le montant écrit au-dessus de la barre CHOISIE (le mois en
//      cours par défaut ; toucher une autre barre la choisit) — jamais un nombre sur chaque barre ;
//    · UNE carte de faits (disponible, en attente, bénéfice, coûts saisis N sur M), chacun la porte de son détail ;
//    · le plein seulement s'il y a un geste (« Saisir 3 prix d'achat » : le chiffre faux est la porte) ;
//    · les versements du mois : titre (2 lignes au plus), étiquette N° · jour · plateforme, montant, et
//      « acheté X € → +Y € » quand le prix d'achat est connu (rien sinon) ; un squelette de la forme exacte des
//      rangées pendant la lecture.
//  Trois états partout : `undefined` en cours (squelette), `null` pas su (« — » + la raison), une valeur lue.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { BoutonV2 } from './BoutonV2.jsx';
import { Etiquette } from './Signature.jsx';
import './design-v2.css';
import './argent-v2.css';

const cents = (x) => (x == null || !Number.isFinite(Number(x)) ? '' : String(Math.round(Number(x) * 100)));
// « 1 107 € » ⇒ [« 1 107 », « € »] : le symbole plus petit, collé (la signature).
const coupe = (t) => { const m = /^(.*?)[\s  ]*€$/.exec(String(t)); return m ? [m[1], '€'] : [String(t), '']; };

function Affiche({ poster, phrase, montant, moisLong }) {
  const { valeur, partiel } = poster;
  const [n, u] = valeur == null ? ['—', ''] : coupe(montant(valeur));
  return (
    <div className="v2-affiche-sig v2-ar-affiche" data-v2-argent-recu={cents(valeur)} data-v2-argent-partiel={partiel ? '1' : undefined}>
      {partiel && valeur != null ? <span className="v2-ar-auMoins">{tr('journee.moins')}</span> : null}
      <div className="v2-affiche-sig-ligne">
        <b className="v2-affiche-sig-n" data-v2-pas-su={valeur == null ? '' : undefined}>{n}{u ? <span className="v2-affiche-sig-unite">{' ' + u}</span> : null}</b>
        <span className="v2-affiche-sig-mot">{tr('v2.ar.recusEn', { mois: moisLong })}</span>
      </div>
      {phrase ? <div className="v2-affiche-sig-sous" data-v2-argent-phrase="">{phrase}</div> : null}
    </div>
  );
}

// Le graphe : six barres, une série (le reçu de chaque mois). Une barre « pas su » est un contour, jamais une barre
// à zéro. Le montant n'est écrit qu'au-dessus de la barre choisie.
function Barres({ barres, montant }) {
  const [choisi, setChoisi] = React.useState(barres.length - 1);
  const max = Math.max(1, ...barres.map((b) => (b.v != null && b.v > 0 ? b.v : 0)));
  const texte = (b) => (b.v == null ? '—' : (b.partiel ? tr('journee.moins') + ' ' : '') + montant(b.v));
  const nom = (b) => `${b.long} : ${b.v == null ? tr('v2.ar.pasSu') : texte(b)}`;
  return (
    <div className="v2-ar-barres" role="group" aria-label={tr('v2.ar.graphe')} data-v2-argent-barres={barres.map((b) => cents(b.v)).join(',')}>
      {barres.map((b, i) => {
        const h = b.v == null ? 0 : Math.max(4, (Math.max(0, b.v) / max) * 100);
        return (
          <button key={b.cle} type="button" className="v2-ar-barre" data-courant={b.courant ? '' : undefined} data-vide={b.v == null ? '' : undefined}
            aria-pressed={i === choisi} aria-label={nom(b)} title={nom(b)} onClick={() => setChoisi(i)}>
            <span className="v2-ar-barre-col">
              {i === choisi ? <span className="v2-ar-barre-v" data-v2-argent-barre-v={cents(b.v)} style={{ bottom: `calc(${h}% + 4px)` }}>{texte(b)}</span> : null}
              <i style={{ height: b.v == null ? '100%' : `${h}%` }}/>
            </span>
            <span className="v2-ar-barre-l" aria-hidden="true">{b.l}</span>
          </button>
        );
      })}
    </div>
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
  const sous = [l.date, l.plateforme].filter(Boolean).join(' · ');
  const corps = (<>
    <span className="v2-ar-v-txt">
      <span className="v2-ar-v-titre">{l.titre || tr('v2.ar.venteSans', { plateforme: l.plateforme || '' })}</span>
      <span className="v2-ar-v-sous">{l.num ? <Etiquette num={l.num}/> : null}<span className="v2-ar-v-date">{sous}</span></span>
    </span>
    <span className="v2-ar-v-droite">
      <b className="v2-ar-v-eur" data-v2-pas-su={l.montant == null ? '' : undefined}>{l.montant == null ? '—' : montant(l.montant)}</b>
      {l.achat != null ? <span className="v2-ar-v-marge" data-v2-argent-achat={cents(l.achat)} data-v2-argent-marge={cents(l.marge)}>
        {tr('v2.ar.achete', { p: montant(l.achat) })}{l.marge != null ? <> → <b>{(l.marge > 0 ? '+' : l.marge < 0 ? '−' : '') + montant(Math.abs(l.marge))}</b></> : null}
      </span> : null}
    </span>
  </>);
  const attrs = { 'data-v2-argent-versement': l.id, 'data-eur': cents(l.montant) };
  return l.num
    ? <button type="button" className="v2-rangee v2-ar-v" data-v2-rangee="" role="listitem" {...attrs} onClick={l.onClick}>{corps}</button>
    : <div className="v2-ar-v" role="listitem" {...attrs}>{corps}</div>;
}

// Le squelette : trois rangées de la forme exacte (titre, étiquette + jour, montant), sans aucun chiffre.
function Squelette() {
  return (
    <div className="v2-ar-liste" role="status" aria-label={tr('v2.ar.lecture')} data-v2-argent-versements="encours">
      {[0, 1, 2].map((i) => (
        <div key={i} className="v2-ar-v v2-ar-squelette" aria-hidden="true">
          <span className="v2-ar-v-txt"><i className="v2-sq v2-sq-titre"/><span className="v2-ar-v-sous"><i className="v2-sq v2-sq-etiq"/><i className="v2-sq v2-sq-date"/></span></span>
          <i className="v2-sq v2-sq-eur"/>
        </div>
      ))}
    </div>
  );
}

export default function ArgentMois({ poster, phrase, moisLong, barres, faits, geste, versements, montant }) {
  const connus = faits.filter((f) => !f.pasSu), inconnus = faits.filter((f) => f.pasSu);
  return (
    <section className="v2-argent v2-ar-mois" data-v2-argent-mois="" aria-label={tr('v2.ar.seg.resume')}>
      <Affiche poster={poster} phrase={phrase} montant={montant} moisLong={moisLong}/>
      <Barres barres={barres} montant={montant}/>
      {/* Un fait pas su n'est pas une carte « — » (AJOUT 3.3) : il est NOMMÉ sur une ligne sous les faits lus. */}
      {connus.length ? <div className={'v2-ar-faits' + (connus.length % 2 ? ' is-impair' : '')} data-v2-argent-faits={connus.length} style={{ '--v2-ar-n': connus.length }}>
        {connus.map((f) => <Fait key={f.id} f={f}/>)}
      </div> : null}
      {inconnus.length ? <p className="v2-ar-passu" data-v2-argent-passu={inconnus.map((f) => f.id).join(' ')}>{tr('v2.ar.pasEncoreLu', { quoi: inconnus.map((f) => f.l).join(' · ') })}</p> : null}
      {geste ? <div className="v2-ar-geste"><BoutonV2 role="principal" plein onClick={geste.onClick} attrs={{ 'data-v2-principal': geste.id, 'data-v2-argent-geste': String(geste.n) }}>{geste.libelle}</BoutonV2></div> : null}
      <h2 className="v2-ar-h">{tr('v2.ar.versements', { mois: moisLong })}</h2>
      {versements.etat === 'encours' ? <Squelette/>
        : versements.etat === 'passu' ? <div className="v2-ar-vide" data-v2-argent-versements="passu"><b>{tr('v2.ar.versementsPasSu')}</b></div>
        : !versements.lignes.length ? <div className="v2-ar-vide" data-v2-argent-versements="0"><b>{tr('v2.ar.aucunVersement', { mois: moisLong })}</b></div>
        : <div className="v2-ar-liste" role="list" data-v2-argent-versements={String(versements.n)}>
            {versements.lignes.map((l) => <LigneVersement key={l.id} l={l} montant={montant}/>)}
          </div>}
      {versements.etat === 'lu' && versements.reste > 0 ? <p className="v2-ar-reste">{tr('v2.ar.autres', { n: versements.reste })}</p> : null}
    </section>
  );
}
