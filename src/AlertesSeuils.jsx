// ════════════════════════════════════════════════════════════════════════════
//  LES ALERTES DE SEUILS, À L'ÉCRAN (15 nov., lot argent-plus)
//  La règle : src/alertesSeuils.js (`alertesSeuils`, `alertesADire`, `texteSeuil`) —
//  la MÊME que la notification du matin (api/_lib/argent-passes.js). Une alerte se
//  montre tant qu'il n'a pas touché « Compris » (le registre `vrm_seuils_vus`,
//  synchronisé : une fois chacune, sur tous ses appareils) ; rien d'atteint, ou tout
//  déjà dit ⇒ le composant ne rend RIEN (aucune place prise sur l'écran).
//  Ton neutre (§7) : un seuil n'est pas une erreur ; la phrase dit ce que le texte
//  officiel dit, et sa source est en lien. Composant séparé : l'écran Argent le place.
//  Aucun import d'App.jsx : la ligne publiée, le régime, le registre et l'écriture
//  arrivent en props.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr, langueCourante } from './i18n/index.js';
import { alertesSeuils, alertesADire, texteSeuil } from './alertesSeuils.js';
import { attrCible } from './cibleNotif.js';
import './argent-plus-2.css';

export function AlertesSeuils({ ligne, regime, activite = 'vente', vues, onCompris, now = null }) {
  // Tant que le registre n'est pas lu, on ne montre rien (une alerte déjà comprise ne doit pas clignoter).
  const liste = React.useMemo(() => {
    if (vues === undefined || regime === undefined) return [];
    return alertesADire(alertesSeuils({ ligne, now: now || new Date(), regime, activite }), vues || {});
  }, [ligne, regime, activite, vues, now]);
  if (!liste.length) return null;
  const l = langueCourante();
  return (
    <section className="vrm-surface vrm-seuils-alertes" data-alertes-seuils={liste.length} data-cible={attrCible(['seuils'])} aria-label={tr('argentPlus.seuils.titre')}>
      <h2 className="vrm-seuils-titre">{tr('argentPlus.seuils.titre')}</h2>
      {liste.map((a) => {
        const t = texteSeuil(a, l);
        return (
          <article key={a.cle} className="vrm-seuils-une" data-seuil={a.seuil} data-seuil-palier={a.palier} data-seuil-cle={a.cle} data-seuil-plateforme={a.plateforme || undefined} data-au-moins={a.auMoins ? '1' : undefined}>
            <div className="vrm-seuils-texte">
              <b className="vrm-seuils-nom">{t.titre}</b>
              <span className="vrm-seuils-ou" data-seuil-ou="">{t.ou}</span>
              <p className="vrm-seuils-phrase">{t.phrase}</p>
              <a className="vrm-seuils-source" href={t.url} target="_blank" rel="noopener noreferrer" data-seuil-source={a.source ? a.source.url : ''}>{t.source}</a>
            </div>
            <button type="button" className="sb-touche vrm-seuils-compris" data-seuil-compris={a.cle} onClick={() => onCompris && onCompris(a.marquer)}>{tr('argentPlus.seuils.compris')}</button>
          </article>
        );
      })}
    </section>
  );
}
export default AlertesSeuils;
