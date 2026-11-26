// ════════════════════════════════════════════════════════════════════════════
//  LA LIGNE DE TEMPS — le rendu (14 nov., idée 154). La règle : ./ligneDeTemps.js.
//  Dans la fiche de la paire, l'onglet « Dans l'ordre » (à côté de « Par étape ») :
//  une ligne verticale, un point par événement PROUVÉ, sa date, ce qui s'est passé,
//  sa preuve en petit. Ce qui est prouvé sans date : « Date inconnue », en bas.
//  Ce qui n'a pas pu être lu est NOMMÉ (« Pas encore lu »), jamais caché.
//  Neutre : aucune couleur (§7) — l'encre, le point de la dernière étape porte la diode.
//  Deux paires sous ce N° : aucune ligne de temps (on ne mélange pas deux histoires, §5) — c'est dit.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, date as dateLoc, monnaie } from '../i18n/index.js';
import { ligneDeTemps, studioDe, rangementDuNumero } from './ligneDeTemps.js';
import './idees.css';

const quand = (iso) => dateLoc(iso, { day: 'numeric', month: 'short', year: 'numeric' });
const PREUVE_CLE = { clic: 'lt.src.clic', livraison: 'lt.src.livraison', studio: 'lt.src.studio', moderation: 'lt.src.moderation', clicRetour: 'lt.src.clicRetour', rangement: 'lt.src.rangement' };

function libelle(e) {
  if (e.quoi === 'photographiee') return tr('lt.photos', { n: e.n || 1 });
  // (15 nov.) Une offre dit son état lu (acceptée, refusée…) ; une republication, qu'elle garde le N°.
  const base = tr('lt.quoi.' + e.quoi, { site: e.site || '' });
  if (e.statut) return `${base} · ${tr('lt.offre.' + e.statut)}`;
  if (e.memeNumero) return `${base} · ${tr('lt.memeNumero')}`;
  return base;
}
function montant(e) {
  if (e.montant == null) return '';
  if (e.avant != null && (e.quoi === 'baisse' || e.quoi === 'hausse')) return `${monnaie(e.avant)} → ${monnaie(e.montant)}`;
  return monnaie(e.montant);
}
function preuve(e) {
  if (e.source === 'vinted') return [tr('lt.src.vinted'), e.preuve].filter(Boolean).join(' · ');
  const p = PREUVE_CLE[e.preuve] ? tr(PREUVE_CLE[e.preuve]) : (e.preuve || '');
  // (15 nov.) Le vendeur de l'achat, tel que l'achat relié l'a gardé (jamais deviné).
  return e.vendeur ? [tr('lt.chez', { vendeur: e.vendeur }), p].filter(Boolean).join(' · ') : p;
}

// La clé d'un événement : son identité (sorte, date, annonce ou transaction), le rang seulement pour départager.
const cleEv = (e, i) => `${e.quoi}|${e.at || ''}|${e.id || ''}|${e.preuve || ''}|${i}`;
const Ev = ({ e, dernier, double }) => (
  <li className={'vrm-lt-ev' + (dernier ? ' is-dernier' : '')} data-lt-quoi={e.quoi} data-lt-date={e.at || ''} data-lt-site={e.site || undefined} data-lt-id={e.id || undefined} data-lt-statut={e.statut || undefined}>
    <span className="vrm-lt-point" aria-hidden="true"/>
    <span className="vrm-lt-corps">
      {e.at ? <time className="vrm-lt-date" dateTime={e.at}>{quand(e.at)}</time> : null}
      <span className="vrm-lt-quoi"><b>{libelle(e)}</b>{!double && montant(e) ? <span className="vrm-lt-montant" data-lt-montant={e.montant}>{montant(e)}</span> : null}</span>
      {preuve(e) ? <small className="vrm-lt-preuve" data-lt-preuve="">{preuve(e)}</small> : null}
    </span>
  </li>
);

// h : `histoireArticle` · extra : { reception, crees, lireStudio(cle) → Promise<rows|null> }
export default function LigneDeTemps({ h, extra = {} }) {
  const cle = h && h.num ? String(h.num) : '';
  const [studio, setStudio] = React.useState(undefined);
  React.useEffect(() => {
    if (!cle || typeof extra.lireStudio !== 'function') return undefined;
    let vivant = true;
    Promise.resolve(extra.lireStudio(cle)).then((rows) => { if (vivant) setStudio(studioDe(rows)); }).catch(() => { if (vivant) setStudio(null); });
    return () => { vivant = false; };
  }, [cle, extra.lireStudio]);
  // (23 nov., lot historique-paire) la case du Stock de CE N° (`vrm_fiches_neuves`, par la clé du N°) ; `undefined` = pas demandé.
  const rangement = React.useMemo(() => { if (extra.fichesNeuves === undefined) return undefined; try { return rangementDuNumero(extra.fichesNeuves, cle, extra.cleNum, extra.slots); } catch (_) { return null; } }, [extra.fichesNeuves, cle, extra.cleNum, extra.slots]);
  const lt = React.useMemo(() => ligneDeTemps(h, { reception: extra.reception, crees: extra.crees, studio, ids: extra.ids, txs: extra.txs, moderation: extra.moderation, retours: extra.retours, rangement }),
    [h, extra.reception, extra.crees, studio, extra.ids, extra.txs, extra.moderation, extra.retours, rangement]);
  if (!lt) return null;
  const double = !!(h && h.double);
  const PAS_SU = { recue: 'lt.pasSu.recue', studio: 'lt.pasSu.studio', crees: 'lt.pasSu.crees', moderation: 'lt.pasSu.moderation', rangement: 'lt.pasSu.rangement' };
  const pasSu = lt.pasSu.map((r) => (PAS_SU[r] ? tr(PAS_SU[r]) : r));
  return (
    <section className="vrm-idees vrm-lt" aria-label={tr('lt.titre')} data-ligne-temps={cle} data-lt-n={lt.evenements.length} data-lt-sans-date={lt.sansDate.length} data-lt-studio={studio === undefined ? 'encours' : studio === null ? 'passu' : String(studio.dates.length)}>
      {double ? <p className="vrm-lt-note" data-lt-double="">{tr('lt.double')}</p> : null}
      {double ? null : lt.evenements.length ? (
        <ol className="vrm-lt-liste">{lt.evenements.map((e, i) => <Ev key={cleEv(e, i)} e={e} double={double} dernier={i === lt.evenements.length - 1}/>)}</ol>
      ) : <p className="vrm-lt-note" data-lt-vide="">{tr('lt.vide')}</p>}
      {!double && lt.sansDate.length ? (<>
        <h4 className="vrm-lt-sous">{tr('lt.sansDate')}</h4>
        <ol className="vrm-lt-liste is-sans-date" data-lt-groupe="sans-date">{lt.sansDate.map((e, i) => <Ev key={cleEv(e, i)} e={e} double={double}/>)}</ol>
      </>) : null}
      {!double && pasSu.length ? <p className="vrm-lt-note" data-lt-pas-su={lt.pasSu.join('|')}>{tr('lt.pasSu.titre')} : {pasSu.join(' · ')}.</p> : null}
    </section>
  );
}

// L'onglet de la fiche : « Par étape » (le parcours d'avant) · « Dans l'ordre » (la ligne de temps).
// Le choix est un confort de CET appareil (rien de synchronisé, rien d'écrit dans la base).
const CLE_VUE = 'vrm_fiche_vue_temps';
// (15 nov.) L'historique complet, demandé par Julien sur la fiche : « Dans l'ordre » (la frise datée) est la vue
// par défaut ; « Par étape » reste un choix de CET appareil.
const lireVue = () => { try { return localStorage.getItem(CLE_VUE) === 'etapes' ? 'etapes' : 'temps'; } catch (_) { return 'temps'; } };
export function useVueFiche() {
  const [vue, setVue] = React.useState(lireVue);
  const poser = React.useCallback((v) => { setVue(v); try { localStorage.setItem(CLE_VUE, v); } catch (_) {} }, []);
  return [vue, poser];
}
export function OngletsFiche({ vue, onVue }) {
  return (
    <div className="vrm-idees sb-segment vrm-lt-onglets" role="group" aria-label={tr('lt.titre')} data-fiche-vue={vue}>
      <button type="button" className="sb-touche" aria-pressed={vue === 'etapes'} data-fiche-vue-choix="etapes" onClick={() => onVue('etapes')}>{tr('lt.vue.etapes')}</button>
      <button type="button" className="sb-touche" aria-pressed={vue === 'temps'} data-fiche-vue-choix="temps" onClick={() => onVue('temps')}>{tr('lt.vue.temps')}</button>
    </div>
  );
}
