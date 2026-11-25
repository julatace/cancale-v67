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
import { Carte, Rangee, Bouton } from './natif/index.js';
import './natif/ecrans/argent.css';

export function AlertesSeuils({ ligne, regime, activite = 'vente', vues, onCompris, now = null }) {
  // Tant que le registre n'est pas lu, on ne montre rien (une alerte déjà comprise ne doit pas clignoter).
  const liste = React.useMemo(() => {
    if (vues === undefined || regime === undefined) return [];
    return alertesADire(alertesSeuils({ ligne, now: now || new Date(), regime, activite }), vues || {});
  }, [ligne, regime, activite, vues, now]);
  if (!liste.length) return null;
  const l = langueCourante();
  // (20 nov., lot argent-natif) Au style natif §2 bis : UNE carte à filet, une rangée par seuil (le nom, où il en est en une
  // ligne grise, la source en lien discret sous la ligne), « Compris » en bouton texte à droite. La phrase officielle n'est
  // plus un paragraphe permanent : elle est le titre (survol, lecteur d'écran) du lien vers le texte officiel.
  return (
    <Carte titre={tr('argentPlus.seuils.titre')} className="vrm-seuils-alertes n-arg-seuils" attrs={{ 'data-alertes-seuils': liste.length, 'data-cible': attrCible(['seuils']), 'aria-label': tr('argentPlus.seuils.titre') }}>
      {liste.map((a) => {
        const t = texteSeuil(a, l);
        return (
          <Rangee key={a.cle} titre={t.titre} sousTitre={t.ou} sousLignes={2}
            note={<a className="n-arg-lien" href={t.url} target="_blank" rel="noopener noreferrer" title={`${t.source} — ${t.phrase}`} data-seuil-source={a.source ? a.source.url : ''}>{tr('mtb.source')}<span className="n-lu-seul"> — {t.source} — {t.phrase}</span></a>}
            fin={<Bouton variante="texte" onClick={() => onCompris && onCompris(a.marquer)} attrs={{ 'data-seuil-compris': a.cle }}>{tr('argentPlus.seuils.compris')}</Bouton>}
            attrs={{ 'data-seuil': a.seuil, 'data-seuil-palier': a.palier, 'data-seuil-cle': a.cle, 'data-seuil-plateforme': a.plateforme || undefined, 'data-au-moins': a.auMoins ? '1' : undefined }}/>
        );
      })}
    </Carte>
  );
}
export default AlertesSeuils;
