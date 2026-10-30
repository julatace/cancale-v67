// ════════════════════════════════════════════════════════════════════════════
//  « 🛒 N paires prêtes pour eBay — je les publie ? » / « N paires à regarder » — la notification du matin
//  (29 octobre, l'agent eBay qui demande).
//
//  Le serveur NE RECALCULE RIEN (§11) : la proposition de l'agent vit dans l'app
//  (`src/agentEbay.js`, `propositionAgent`), qui PUBLIE un résumé dans un réglage
//  synchronisé (`main.vrm_agent_ebay_resume` = { v, n, pretes?, at, pause? }). Ce cron le
//  CONSOMME, et ne publie RIEN : la notification ouvre eBay → À traiter, où Julien
//  dit oui.
//
//  Rien ne part quand :
//   · le résumé est illisible (`undefined`, « pas su ») ou absent ;
//   · il a plus de 48 h (ce n'est plus une mesure : des paires ont pu se vendre) ;
//   · il ne compte aucune paire, ou Julien a dit « Pas maintenant » aujourd'hui ;
//   · Julien a ARRÊTÉ l'agent (`vrm_agent_ebay_regles.actif === false`) ;
//   · le mémo du jour est illisible, ou dit que c'est déjà fait (une par jour).
// ════════════════════════════════════════════════════════════════════════════
// La phrase est celle de l'app (§11) : « N paires prêtes » seulement quand
// l'écran a PRÉPARÉ ces paires chez eBay (`pretes`), sinon « N paires à
// regarder » (revue du 29 oct. : la notification annonçait « prêtes » des
// paires que personne n'avait vérifiées).
import { phraseResumeAgent, agentArrete } from '../../src/agentEbay.js';

export const RESUME_AGENT_MAX_AGE_MS = 48 * 3600000;

export function notificationAgentEbay({ resume, regles = null, memo, today, maintenant = Date.now() }) {
  if (resume === undefined) return { envoyer: false, raison: 'résumé illisible — rien envoyé' };
  // Julien a arrêté l'agent : rien, quel que soit le dernier résumé (§11 : la
  // même règle que Ma journée, `agentArrete`).
  if (agentArrete(regles)) return { envoyer: false, raison: 'agent arrêté (son choix)' };
  const r = resume && typeof resume === 'object' ? resume : null;
  if (!r) return { envoyer: false, raison: 'aucun résumé publié' };
  const n = Math.round(Number(r.n));
  if (!(n > 0)) return { envoyer: false, raison: 'aucune paire proposée' };
  const at = Number(r.at);
  if (!(at > 0) || maintenant - at > RESUME_AGENT_MAX_AGE_MS || at - maintenant > 600000) return { envoyer: false, raison: 'résumé trop ancien (plus de 48 h) — rien envoyé' };
  if (r.pause && r.pause === today) return { envoyer: false, raison: '« pas maintenant » aujourd’hui (son choix)' };
  if (memo === undefined) return { envoyer: false, raison: 'mémo illisible — rien envoyé' };
  if (memo && memo.date === today) return { envoyer: false, raison: 'déjà demandé aujourd’hui' };
  return {
    envoyer: true, n, raison: 'à envoyer',
    titre: `🛒 ${phraseResumeAgent(n, r.pretes)}`,
    corps: 'Ouvre VRM → eBay → À traiter : l’agent te montre la liste et les frais. Rien n’est publié sans ton oui.',
    url: '/?tab=ebay_agent',
  };
}
