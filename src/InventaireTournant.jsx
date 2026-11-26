// ── L'INVENTAIRE TOURNANT, LA CARTE DU STOCK (14 nov., lot 129) ─────────────────
// « Aujourd'hui · 10 N° à vérifier » : la règle src/inventaireTournant.js (tirage
// déterministe du jour parmi les paires PRÉSENTES). Deux gestes par N° : « Vu » et
// « Pas trouvé ». ⚠️ Aucun ne change un N° ni une fiche : « Pas trouvé » pose un
// SIGNAL (« À chercher », gardé jusqu'à « Retrouvé »), jamais une suppression.
// La ligne : `vrm_inventaire_tournant` (synchronisée par `lire`/`ecrire` de l'app :
// lire-fusionner-réécrire, une lecture ratée n'écrit rien).
import React from 'react';
import { tr } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import { tirageDuJour, noterTournant, fusionnerTournant, jourLocal, TOURNANT_PAR_JOUR } from './inventaireTournant.js';
import './styles-confort.css';

export default function InventaireTournant({ unites, uid = '', lire, ecrire, onFiche = null }) {
  useLangue();
  const jour = jourLocal();
  const [etat, setEtat] = React.useState(() => { try { return lire() || {}; } catch (_) { return {}; } });
  const [ouvert, setOuvert] = React.useState(false);
  const tirage = React.useMemo(() => tirageDuJour(unites, { jour, uid, etat }), [unites, jour, uid]);   // l'état d'avant la journée : le tirage ne bouge pas pendant qu'il coche
  if (!Array.isArray(unites) || !tirage.length) return null;
  const faits = (etat.faits && etat.faits.jour === jour && etat.faits.cles) || {};
  const absents = Object.keys(etat.absents || {});
  const nFaits = tirage.filter((p) => faits[p.cle]).length;
  const noter = (cle, geste) => {
    const n = noterTournant(etat, { cle, geste, jour });
    let avant = null; try { avant = lire(); } catch (_) { avant = undefined; }
    if (avant === undefined) return;                      // lecture ratée : rien n'est écrit
    const f = fusionnerTournant(avant || {}, n);
    setEtat(f); try { ecrire(f); } catch (_) {}
  };
  const numDe = (cle) => { const u = (unites || []).find((x) => x && Array.isArray(x.cles) && x.cles.includes(cle)); return u ? u.numero : cle; };
  return (
    // (16 nov., lot stock-mieux) UNE carte : la tête (« 10 N° à vérifier aujourd'hui », « 3 sur 10 vus », une barre
    // d'avancée, un chevron) ET la liste dépliée dedans — avant, la liste sortait de la carte, sous un titre « Aujourd'hui · … ».
    <section className="vrm-cf vrm-cf-carte vrm-it" data-inventaire-tournant={tirage.length} data-inventaire-faits={nFaits} data-ouvert={ouvert ? '' : undefined}>
      <button type="button" className="vrm-it-tete" onClick={() => setOuvert((x) => !x)} aria-expanded={ouvert} data-inventaire-tournant-ouvrir="">
        <span className="vrm-cf-txt"><b>{tr('confort.tournant.titre', { n: tirage.length })}</b><small>{nFaits >= tirage.length ? tr('confort.tournant.fini') : tr('confort.tournant.fait', { n: nFaits, total: tirage.length })}{absents.length ? ` · ${tr('confort.tournant.aChercher', { n: absents.length })}` : ''}</small>
          <i className="vrm-it-barre" aria-hidden="true"><i style={{ width: `${Math.round((100 * nFaits) / Math.max(1, tirage.length))}%` }} /></i></span>
        {absents.length ? <i className="vrm-cf-point" aria-hidden="true"/> : null}
        <span className="vrm-it-chevron" aria-hidden="true">›</span>
      </button>
      {ouvert ? <div className="vrm-cf-pile" style={{ marginTop: 12 }}>
        <p className="vrm-cf-doux">{tr('confort.tournant.explique', { n: TOURNANT_PAR_JOUR })}</p>
        <ul className="vrm-cf-liste">{tirage.map((p) => (
          <li key={p.cle} data-tournant-num={p.numero} data-tournant-etat={faits[p.cle] || ''}>
            <span className="vrm-cf-num">N°{p.numero}</span>
            <span className="vrm-cf-txt"><b>{p.titre || tr('confort.sansTitre')}</b>{faits[p.cle] ? <small>{tr(faits[p.cle] === 'vu' ? 'confort.tournant.vu' : 'confort.tournant.pasTrouve')}</small> : null}</span>
            {!faits[p.cle] ? <>
              <button type="button" className="vrm-cf-second" onClick={() => noter(p.cle, 'vu')} data-tournant-vu={p.numero}>{tr('confort.tournant.vuBouton')}</button>
              <button type="button" className="vrm-cf-lien" onClick={() => noter(p.cle, 'absent')} data-tournant-absent={p.numero}>{tr('confort.tournant.absentBouton')}</button>
            </> : null}
          </li>))}</ul>
        {absents.length ? <>
          <h3 className="vrm-cf-doux" style={{ margin: '8px 0 0 4px' }}>{tr('confort.tournant.aChercherTitre')}</h3>
          <ul className="vrm-cf-liste">{absents.map((cle) => (
            <li key={cle} data-tournant-signal={cle}>
              <i className="vrm-cf-point" aria-hidden="true"/>
              <span className="vrm-cf-txt"><b>N°{numDe(cle)}</b><small>{tr('confort.tournant.signal')}</small></span>
              {onFiche ? <button type="button" className="vrm-cf-lien" onClick={() => onFiche(numDe(cle))}>{tr('confort.tournant.fiche')}</button> : null}
              <button type="button" className="vrm-cf-second" onClick={() => noter(cle, 'retrouve')} data-tournant-retrouve={cle}>{tr('confort.tournant.retrouve')}</button>
            </li>))}</ul>
        </> : null}
      </div> : null}
    </section>
  );
}
