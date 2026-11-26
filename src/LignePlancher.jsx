import React from 'react';
import { textePlancher, margeFacePlancher } from './plancherOffre.js';
import { tr } from './i18n/index.js';

// La ligne discrète sous une offre (9 nov., lot F) : « En dessous de 62 € tu perds
// de l'argent ». Ambre seulement quand l'offre est sous le plancher (un geste à
// réfléchir, jamais rouge, §7). Sans prix d'achat : la porte pour le saisir
// (`onSaisir`), sinon rien. Les phrases viennent de `textePlancher` (même source
// que le chiffre).
// (24 nov., lot messages-pro) `puce` : la carte d'offre du fil la montre en UNE puce calme — « +24 € de marge »
// (offre − plancher, `margeFacePlancher`, la même source), « Au plus +24 € » quand les frais ne sont pas tous confirmés,
// « 8 € à perte » sous le plancher (gras, jamais orange ni rouge) ; la phrase entière reste en titre (infobulle et lecteur
// d'écran). Sans prix d'achat : un petit lien « Ajouter le prix d'achat », jamais de jargon. Aucune marge sans prix d'achat.
const eurosC = (c) => { const v = Math.abs(c) / 100; return (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')) + ' €'; };
export function LignePlancher({ plancher, offre = null, mini = null, ambre, onSaisir = null, puce = false }) {
  const t = textePlancher(plancher, { offre, mini });
  if (!t) return null;
  if (t.niveau === 'achat') {
    if (!onSaisir) return null;
    if (puce) return <button type="button" className="vrm-mp-lien" data-plancher="achat" data-plancher-saisir="" onClick={onSaisir}>{tr('mpro.offre.ajouterAchat')}</button>;
    return <p className="vrm-offre-repere" data-plancher="achat">
      Prix d’achat pas saisi : le plancher n’est pas calculé.{' '}
      <button type="button" className="vrm-pied-lien" data-plancher-saisir="" onClick={onSaisir}>Saisir le prix d’achat</button>
    </p>;
  }
  const sous = t.niveau === 'sous';
  if (puce) {
    const m = margeFacePlancher(offre, plancher);
    if (!m) return null;
    const titre = [t.ligne + (t.precision ? ` (${t.precision})` : '') + '.', t.offre, t.mini].filter(Boolean).join(' ');
    const cle = m.niveau === 'sous' ? (m.partiel ? 'mpro.offre.perteAuMoins' : 'mpro.offre.perte') : (m.partiel ? 'mpro.offre.margeAuPlus' : 'mpro.offre.marge');
    return <span className="vrm-mp-puce" data-plancher={sous ? 'sous' : 'au-dessus'} data-plancher-cents={String(t.plancher)} data-plancher-partiel={t.partiel ? '1' : undefined}
      data-offre-marge={String(m.marge)} data-marge-niveau={m.niveau} title={titre} aria-label={titre}>{tr(cle, { m: eurosC(m.marge) })}</span>;
  }
  return <p className="vrm-offre-repere" data-plancher={sous ? 'sous' : 'au-dessus'} data-plancher-cents={String(t.plancher)} data-plancher-partiel={t.partiel ? '1' : undefined}
    style={sous && ambre ? { color: ambre } : undefined}>
    {t.ligne}{t.precision ? <> ({t.precision})</> : null}.
    {t.offre ? <> <b data-plancher-perte="">{t.offre}</b></> : null}
    {t.mini ? <> <span data-plancher-mini="">{t.mini}</span></> : null}
  </p>;
}
