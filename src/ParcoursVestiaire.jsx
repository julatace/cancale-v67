// ════════════════════════════════════════════════════════════════════════════
// LE PARCOURS D'UNE VENTE VESTIAIRE (11 nov., lot vestiaire-plus)
// ════════════════════════════════════════════════════════════════════════════
// Dans le récapitulatif d'une vente Vestiaire : la frise des CINQ étapes de
// Vestiaire (envoyé → arrivé chez Vestiaire → authentification → validé/refusé →
// payé), la frise existante (src/design/Frise.jsx) nourrie par la règle PURE
// src/parcoursVestiaire.js — chaque étape LUE, jamais devinée — puis UNE ligne :
// le moment où l'argent arrive (versé le … ⇒ dans le CA de ce mois ; estimé par
// Vestiaire ⇒ pas encore dans le CA ; rien lu ⇒ dit). Les textes passent par tr().
import React from 'react';
import Frise from './design/Frise.jsx';
import { parcoursVenteVc, friseParcoursVc } from './parcoursVestiaire.js';
import { tr, date as dateI18n } from './i18n/index.js';

const ETAPES = ['envoye', 'arrive', 'authentification', 'verdict', 'paye'];
const libelles = () => Object.fromEntries([...ETAPES.map((k) => [k, tr('vcParcours.etape.' + k)]), ['verdict.refuse', tr('vcParcours.etape.refuse')]]);
const courts = () => Object.fromEntries([...ETAPES.map((k) => [k, tr('vcParcours.court.' + k)]), ['verdict.refuse', tr('vcParcours.court.refuse')]]);
const moisLisible = (ym) => { const [a, m] = String(ym || '').split('-').map(Number); if (!a || !m) return ''; try { return dateI18n(new Date(a, m - 1, 15), { month: 'long', year: 'numeric' }); } catch (_) { return ym; } };
const jourLisible = (t) => { const x = typeof t === 'number' ? t : Date.parse(t || ''); if (!Number.isFinite(x) || x <= 0) return ''; try { return dateI18n(new Date(x), { day: 'numeric', month: 'short' }); } catch (_) { return ''; } };

export default function ParcoursVestiaire({ v, colisFait = null }) {
  const p = parcoursVenteVc(v, colisFait);
  if (!p) return null;
  const frise = friseParcoursVc(p, libelles(), courts());
  const etat = (x) => {
    if (x.etat === 'fait') { const j = jourLisible(x.t); return j ? tr('vcParcours.etat.faitLe', { jour: j }) : tr('vcParcours.etat.fait'); }
    if (x.etat === 'refuse') return x.mot ? tr('vcParcours.etat.refuseMot', { mot: x.mot }) : tr('vcParcours.etat.refuse');
    if (x.etat === 'encours') return x.cle === 'envoye' ? tr('vcParcours.etat.aEnvoyer') : tr('vcParcours.etat.encours');
    if (x.etat === 'avenir') return tr('vcParcours.etat.avenir');
    return x.mot ? tr('vcParcours.etat.passuMot', { mot: x.mot }) : tr('vcParcours.etat.passu');
  };
  const a = p.argent;
  const argent = a.etat === 'verse' ? tr('vcParcours.argent.verse', { jour: jourLisible(a.t), mois: moisLisible(a.mois) })
    : a.etat === 'estime' ? tr('vcParcours.argent.estime', { quand: a.texte })
      : tr('vcParcours.argent.passu');
  return (
    <section className="vrm-recap-parcours" aria-label={tr('vcParcours.titre')} data-vc-parcours={p.refusee ? 'refusee' : 'lu'}>
      <h3 className="vrm-recap-titre">{tr('vcParcours.titre')}</h3>
      <Frise etapes={frise} cle={'vcp' + String(v.id || '')} className="vrm-fu-ligne-frise" label={tr('vcParcours.titre')}/>
      <dl>
        {p.etapes.map((x) => (
          <div key={x.cle} className="vrm-recap-ligne" data-vc-parcours-etape={x.cle} data-vc-parcours-etat={x.etat} data-vc-parcours-preuve={x.preuve || ''}>
            <dt>{tr('vcParcours.etape.' + (x.etat === 'refuse' ? 'refuse' : x.cle))}</dt>
            <dd>{etat(x)}</dd>
          </div>
        ))}
        <div className="vrm-recap-ligne" data-vc-parcours-argent={a.etat} data-vc-parcours-mois={a.mois || ''}>
          <dt>{tr('vcParcours.argent.titre')}</dt>
          <dd>{argent}</dd>
        </div>
      </dl>
    </section>
  );
}
