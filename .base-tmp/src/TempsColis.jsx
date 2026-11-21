// ════════════════════════════════════════════════════════════════════════════
//  TON TEMPS PAR COLIS (14 nov., proposition 101) — au récapitulatif de « Préparer
//  mes colis » : cette séance et les 30 derniers jours, en tuiles (gros chiffre,
//  libellé court) ; le « comment c'est mesuré » replié. Les règles : src/tempsColis.js
//  (mesuré sur l'appareil, « au moins », couverture dite, jamais deviné).
//  `useJournalTemps(uid, ouverture, faits)` range la séance à chaque « Colis fait »
//  (et la recalcule à chaque « Annuler »).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, monnaie } from './i18n/index.js';
import { mesurerSeance, lireJournal, noterSeance, ecrireJournal, resumeTemps, depuisJours, dureeCourte } from './tempsColis.js';
import './styles-colis-plus.css';

export function useJournalTemps(uid, ouverture, faits) {
  const cle = JSON.stringify(faits || {});
  React.useEffect(() => {
    const s = mesurerSeance(ouverture, faits);
    const j = noterSeance(lireJournal(undefined, uid), s);
    ecrireJournal(j, undefined, uid);
  }, [uid, ouverture, cle]); // eslint-disable-line react-hooks/exhaustive-deps
}

function Tuiles({ r, nom }) {
  if (!r.colis) return null;
  return (
    <>
      <h4>{nom}</h4>
      <div className="vrm-cp-tuiles" data-temps-par-colis={r.parColisMs == null ? '' : String(r.parColisMs)} data-temps-total={String(r.totalMs)} data-temps-mesures={String(r.mesures)} data-temps-colis={String(r.colis)} data-temps-gain={r.gainHeure == null ? '' : String(r.gainHeure)} data-temps-n-gain={String(r.nGain)}>
        <div className="vrm-cp-tuile"><b>{r.parColisMs == null ? '—' : dureeCourte(r.parColisMs)}</b><span>{tr('cp.temps.parColis', { n: r.mesures })}</span></div>
        <div className="vrm-cp-tuile"><b>{r.mesures ? dureeCourte(r.totalMs) : '—'}</b><span>{tr('cp.temps.total', { n: r.colis })}</span></div>
        <div className="vrm-cp-tuile"><b>{r.gainHeure == null ? '—' : monnaie(r.gainHeure, 'EUR', { maximumFractionDigits: 0 })}</b><span>{r.gainHeure == null ? tr('cp.temps.gainInconnu') : tr('cp.temps.gain', { n: r.nGain })}</span></div>
      </div>
    </>
  );
}

export function TempsColis({ uid = '', ouverture, beneficeDe = null, rendu = 0 }) {
  // `rendu` change à chaque « Colis fait » : le journal est relu.
  const j = React.useMemo(() => lireJournal(undefined, uid), [uid, rendu]); // eslint-disable-line react-hooks/exhaustive-deps
  const seance = React.useMemo(() => resumeTemps({ seances: j.seances.filter((s) => s.ouverture === ouverture) }, { beneficeDe }), [j, ouverture, beneficeDe]);
  const mois = React.useMemo(() => resumeTemps(j, { depuis: depuisJours(), beneficeDe }), [j, beneficeDe]);
  return (
    <section className="vrm-cp-temps" data-temps-colis="" aria-label={tr('cp.temps.titre')}>
      <h3>{tr('cp.temps.titre')}</h3>
      {!mois.colis ? <p className="vrm-cp-temps-vide" data-temps-vide="">{tr('cp.temps.pasMesure')}</p> : (
        <>
          <div data-temps-quand="seance"><Tuiles r={seance} nom={tr('cp.temps.seance')}/></div>
          <div data-temps-quand="mois"><Tuiles r={mois} nom={tr('cp.temps.mois')}/></div>
        </>
      )}
      <details><summary>{tr('cp.temps.comment')}</summary>{tr('cp.temps.pourquoi')}</details>
    </section>
  );
}
export default TempsColis;
