// ═══════════════════════════════════════════════════════════════════════════
// LA CARTE D'OFFRE DU FIL (24 nov., lot messages-pro)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, devant la carte d'avant : « ça fait encore beaucoup trop vieux […] je veux quelque chose fait par un
// professionnel du design ». Une seule carte, à sa place dans le fil (là où l'acheteur a fait l'offre, comme Vinted) :
//   · « Offre de 70 € » en grand, le prix affiché barré à côté ;
//   · UNE puce calme : la marge face au prix d'achat (`LignePlancher puce`, la même règle que le bénéfice) quand il est
//     saisi, sinon le lien « Ajouter le prix d'achat » ; le prix mini seulement s'il est posé ;
//   · la paire de gestes (`GestesOffreVinted` : Refuser · Accepter, Proposer en discret ; Accepter DEMANDE toujours).
// Affichage seul : aucune règle ici. Les montants viennent de l'écran (identité de l'offre : tx + offer_request_id).
import React from 'react';
import { tr } from '../i18n/index.js';
import { Glyphe } from '../natif/index.js';
import { comparaisonMinimum } from '../actionsClaires.js';

const heure = (ts) => { const d = ts ? new Date(ts) : null; return d && Number.isFinite(d.getTime()) ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''; };
const ok = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

export function CarteOffre({ qui = '', offre, affiche = null, mini = null, fmt, quand = null, plancher = null, gestes = null, attrs = null }) {
  const cmp = comparaisonMinimum(offre, mini);
  const h = heure(quand);
  const barre = ok(affiche) && ok(offre) && Math.round(affiche * 100) !== Math.round(offre * 100);
  const puceMini = cmp.etat === 'sous-minimum'
    ? <span className="vrm-mp-puce" data-offre-niveau="sous-minimum" data-mp-mini={String(mini)}>{tr('mpro.offre.sousMini', { m: fmt(cmp.ecart) })}</span>
    : cmp.etat === 'minimum-atteint'
      ? <span className="vrm-mp-puce" data-offre-niveau="minimum-atteint" data-mp-mini={String(mini)}><Glyphe nom="check" taille={13}/>{tr('mpro.offre.miniAtteint', { m: fmt(mini) })}</span>
      : null;
  return (
    <section className="vrm-mp-offre" data-mp-offre="" aria-label={tr('mpro.offre.titre', { m: fmt(offre) })} {...(attrs || {})}>
      {qui || h ? <p className="vrm-mp-offre-qui"><span className="vrm-sensible" data-stream-type="acheteur">{qui}</span>{qui && h ? ' · ' : ''}{h ? <time dateTime={new Date(quand).toISOString()}>{h}</time> : null}</p> : null}
      <p className="vrm-mp-offre-prix">
        <span className="vrm-mp-offre-de">{tr('mpro.offre.de')}</span>{' '}<b data-montant="" data-mp-montant={String(offre)}>{fmt(offre)}</b>
        {barre ? <s className="vrm-mp-offre-affiche" data-mp-affiche={String(affiche)} aria-label={tr('mpro.offre.affiche', { m: fmt(affiche) })}>{fmt(affiche)}</s> : null}
      </p>
      {plancher || puceMini ? <div className="vrm-mp-offre-puces">{plancher}{puceMini}</div> : null}
      {gestes}
    </section>
  );
}
export default CarteOffre;
