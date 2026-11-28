// Découpé d'App.jsx (démarrage léger, 8 nov.) : chargé à la demande par App.jsx.
// Déplacement MÉCANIQUE (le code est celui d'App.jsx, inchangé) — voir docs/passation/2026-11-08-demarrage-leger.md.
import React from 'react';
import { recuPublieEntre } from '../design/carteChiffres.js';
import { chiffreBrut } from '../beneficeNoms.js';
import { AUTH, DEMANDE_SEMAINE, aLaDemande, beneficeDesJours, bilanLignes, lireBeneficeJours, lireLbcDone, lirePairesDorment, lireShipDone, lireVcDone, recuAvecADater, useLigneSynchro, useLigneUrssaf, venduEtat } from '../App.jsx';

import { maSemaine } from "../maSemaine.js";
// ⟦← App.jsx #2⟧ // (8 nov.) style de ./FriseVente.jsx, gardé à sa place (son écran est chargé à la demande)   // (10 nov., lot BM) vitesse d'envoi
import { LigneVitesse } from "../VitesseEnvoi.jsx";

// ⟦← App.jsx #1⟧
// (10 nov., lot BC) « Ma semaine » : l'écran du bilan de la semaine (src/maSemaine.js, aucune règle à lui).
// (17 nov., fiabilité-vitesse) à la demande, hors du morceau App : MaSemaine (était importé en statique)
const MaSemaine = aLaDemande(() => import('../MaSemaine.jsx'));
// ⟦← App.jsx #3⟧
// ═══════════════════════════════════════════════════════════════════════════
// (10 nov., lot BC) « MA SEMAINE » — l'écran du bilan de la semaine.
// ═══════════════════════════════════════════════════════════════════════════
// Les sources sont celles de la carte « Semaine du … » (`JournalSemaineCarte`) et de la frise :
// les lignes de `ventesFaites` de la coque (comptes sélectionnés), `vrm_benefice_jours`, ses
// gestes « Colis fait », le reçu publié par Ventes (`recuPublieEntre`, + ventes à dater) et
// `vrm_paires_dorment`. Les bornes, la comparaison et « qui dorment » : src/maSemaine.js
// (les bornes et la règle du bilan en notification, api/_lib/bilan-semaine.js).
const REGLES_SEMAINE = { bilanLignes, beneficeDesJours, chiffreBrut };
function EcranMaSemaine({ liveStats, onNav, entete }) {
  const [pub] = useLigneSynchro('vrm_benefice_jours', lireBeneficeJours);
  const [ship, pret] = useLigneSynchro('vinted_ship_done', lireShipDone);
  const [lbcF] = useLigneSynchro('vrm_lbc_colis_done', lireLbcDone);
  const [vcF] = useLigneSynchro('vrm_vc_colis_done', lireVcDone);
  const [dorment] = useLigneSynchro('vrm_paires_dorment', lirePairesDorment);
  const ligneUrssaf = useLigneUrssaf();
  const [lundi, setLundi] = React.useState(() => { const l = DEMANDE_SEMAINE.lundi; DEMANDE_SEMAINE.lundi = null; return l; });
  React.useEffect(() => {
    const f = () => { const l = DEMANDE_SEMAINE.lundi; DEMANDE_SEMAINE.lundi = null; setLundi(l); };
    window.addEventListener('vrm:semaine', f);
    return () => window.removeEventListener('vrm:semaine', f);
  }, []);
  // L'heure qui passe : la semaine en cours finit MAINTENANT (relue chaque minute, et au retour).
  const [maintenant, setMaintenant] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 60000);
    const vu = () => { if (document.visibilityState === 'visible') setMaintenant(Date.now()); };
    document.addEventListener('visibilitychange', vu);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vu); };
  }, []);
  const vendu = venduEtat(liveStats) !== 'lu' ? (venduEtat(liveStats) === 'pasSu' ? null : undefined)
    : { lignes: liveStats.venduLignes, manque: [...(liveStats.venduManque || []), ...(liveStats.venduEnAttente ? ['lecture en cours'] : [])], nonComptees: liveStats.venduNonComptees || [] };
  const M = React.useMemo(() => maSemaine({
    maintenant, lundi, vendu, joursBenef: pub, dorment,
    colisFaits: pret ? { vinted: ship, lbc: lbcF, vc: vcF } : {},
    recuEntre: (de, a) => ligneUrssaf === undefined ? { valeur: null, raison: 'encours' } : recuAvecADater(recuPublieEntre(ligneUrssaf, { de, a }, maintenant), ligneUrssaf),
    R: REGLES_SEMAINE,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [maintenant, lundi, liveStats, pub, dorment, pret, ship, lbcF, vcF, ligneUrssaf]);
  return <MaSemaine M={M} entete={entete} onSemaine={setLundi} onNav={onNav} vitesse={<LigneVitesse owner={(AUTH.user && AUTH.user.id) || ''}/>}/>;
}
export { EcranMaSemaine };
