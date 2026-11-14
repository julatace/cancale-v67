// ════════════════════════════════════════════════════════════════════════════
//  LA MEILLEURE HEURE — la phrase de l'atelier Republier (14 nov., idée 158).
//  La règle : ./meilleureHeure.js (sur `quandTuVends`, la règle de Statistiques).
//  « Tes paires se vendent le plus le dimanche, entre 18 h et 21 h » · « sur 412 ventes
//  datées à l'heure » · « Choisir dimanche 18 h › » (un lien : il met ce moment dans
//  le champ ; « Programmer » reste SON clic). Pas assez de ventes : la phrase le dit.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, date as dateLoc, heure as heureLoc } from '../i18n/index.js';
import { quandTuVends } from '../statsVentes.js';
import { meilleureHeure, prochainMoment } from './meilleureHeure.js';
import '../paireHistoire/idees.css';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

// lignes : les ventes FAITES (`liveStats.venduLignes`) — undefined en cours · null pas su.
export function useMeilleureHeure(lignes) {
  return React.useMemo(() => meilleureHeure(lignes === undefined ? undefined : (Array.isArray(lignes) ? quandTuVends(lignes) : null)), [lignes]);
}

// `incomplet` : une lecture de ventes a manqué (un compte, Leboncoin…) — le résultat est dit « peut encore bouger ».
export default function MeilleureHeure({ r, onChoisir = null, maintenant = null, incomplet = false }) {
  if (!r || r.etat === 'encours') return null;
  const couv = r.n != null ? <span className="vrm-mh-couv" data-mh-couverture={r.n} data-mh-sans-heure={r.sansHeure || 0}>{tr('mh.couverture', { n: r.n })}{r.sansHeure ? ` · ${tr('mh.sansHeure', { n: r.sansHeure })}` : ''}{incomplet ? <span className="vrm-mh-couv" data-mh-incomplet="">{tr('mh.incomplet')}</span> : null}</span> : null;
  if (r.etat === 'passu') return <div className="vrm-idees vrm-mh" data-meilleure-heure="passu"><p className="vrm-mh-phrase">{tr('mh.passu')}</p></div>;
  if (r.etat === 'peu') return <div className="vrm-idees vrm-mh" data-meilleure-heure="peu"><p className="vrm-mh-phrase">{tr('mh.peu', { seuil: r.seuil })}</p>{couv}</div>;
  if (r.etat === 'plat') return <div className="vrm-idees vrm-mh" data-meilleure-heure="plat"><p className="vrm-mh-phrase">{tr('mh.plat')}</p>{couv}</div>;
  const jour = tr('mh.jour.' + JOURS[r.jour]);
  const quand = prochainMoment(r.jour, r.debut, maintenant || Date.now());
  return (
    <div className="vrm-idees vrm-mh" data-meilleure-heure="ok" data-mh-jour={r.jour} data-mh-debut={r.debut} data-mh-part={r.part}>
      <p className="vrm-mh-phrase">{tr('mh.phrase', { jour, debut: r.debut, fin: r.fin })} <b>{tr('mh.part', { p: r.part })}</b></p>
      {couv}
      {onChoisir ? <button type="button" className="sb-lien" data-mh-choisir={quand} onClick={() => onChoisir(quand)}>{tr('mh.choisir', { jour: dateLoc(quand, { weekday: 'long', day: 'numeric', month: 'short' }), heure: heureLoc(quand) })} ›</button> : null}
    </div>
  );
}
