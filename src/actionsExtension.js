// ── src/actionsExtension.js — « toute action doit être faite dans l'extension » (Julien, 20 nov.) ─────
// L'app ne fait plus AUCUN geste sur Vinted, Leboncoin ou Vestiaire. Elle montre l'état (prix, réglages,
// journal, progression) et chaque ancien bouton d'action devient UN bouton « … dans l'extension » qui ouvre
// le panneau de l'extension sur le site (src/ouvrirPanneau.js), avec la sélection et l'action.
// Restent dans l'app : ce qui n'agit sur aucune plateforme (prix d'achat, prix mini, N°, ranger, relier,
// imprimer des bordereaux déjà reçus, compta, réglages de l'app) et eBay (API serveur, pas de panneau).
//
// Deux pièces, vérifiées par `scripts/audit-actions-app.cjs` (`--mutation` : remettre un geste ⇒ rouge) :
//   ACTIONS_EXTENSION   chaque geste : la page et l'action du panneau, et la clé de son libellé ;
//   CMDS_PLATEFORME     les commandes d'extension qui AGISSENT sur une plateforme : le pont de l'app
//                       (`vmrCmd`, App.jsx) les refuse toutes (`refusPanneau`) — défense en profondeur
//                       derrière les écrans, qui ne les envoient plus.

export const ACTIONS_EXTENSION = {
  changerPrix:     { page: 'prix', action: 'changer', cle: 'actionsExt.changerPrix' },
  baisser:         { page: 'prix', action: 'baisser', cle: 'actionsExt.baisser' },
  remettrePrix:    { page: 'prix', action: 'remettre', cle: 'actionsExt.remettrePrix' },
  republier:       { page: 'republier', action: 'republier', cle: 'actionsExt.republier' },
  // 5.429 (Julien, 21 nov. : « la republication à la main ») : « Republier » d'une annonce ou d'une sélection ⇒ la feuille
  //    Avant | Après de CES paires dans le panneau, puis SON « Republier maintenant » (le chemin de l'atelier).
  republierMaintenant: { page: 'republier', action: 'republier-direct', cle: 'actionsExt.republierMaintenant' },
  // 5.429 : « Déposer N sur Vinted » — les fiches PRÉPARÉES dans VRM (ids = identifiants des fiches, jamais des annonces).
  deposer:         { page: 'publier', action: 'deposer', cle: 'actionsExt.deposer' },
  mettreEnLigne:   { page: 'republier', action: 'mettre-en-ligne', cle: 'actionsExt.mettreEnLigne' },
  versBrouillon:   { page: 'republier', action: 'brouillon', cle: 'actionsExt.versBrouillon' },
  creerVinted:     { page: 'publier', action: 'creer', cle: 'actionsExt.creerVinted' },
  publier:         { page: 'publier', action: 'publier', cle: 'actionsExt.publier' },
  pause:           { page: 'annonces', action: 'pause', cle: 'actionsExt.pause' },
  supprimer:       { page: 'annonces', action: 'supprimer', cle: 'actionsExt.supprimer' },
  repondre:        { page: 'messages', action: 'repondre', cle: 'actionsExt.repondre' },
  offres:          { page: 'offres', action: 'repondre', cle: 'actionsExt.offres' },
  favoris:         { page: 'favoris', action: 'envoyer', cle: 'actionsExt.favoris' },
  automatisations: { page: 'automatisations', action: 'regler', cle: 'actionsExt.automatisations' },
  vacances:        { page: 'vacances', action: 'vacances', cle: 'actionsExt.vacances' },
};

// Les actions de la feuille « Actions » des annonces (src/annoncesActions.js) → l'action du panneau.
export const PANNEAU_DE_SELECTION = { recreer: 'republierMaintenant', modifier: 'changerPrix', versBrouillon: 'versBrouillon', enLigne: 'mettreEnLigne', baisser: 'baisser' };

export const NOMS_SITES = { vinted: 'Vinted', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective' };

// Les commandes d'extension qui agissent sur une plateforme. Les autres (bordereau — autorisé et automatique,
// CLAUDE.md §3 —, lectures, imports, marques posées dans SA base, « Tout arrêter », rapport) restent.
export const CMDS_PLATEFORME = Object.freeze([
  'baisserPrixVinted', 'planifierBaisses', 'annulerBaisses', 'lbcPrix', 'vcPrix',
  'lbcPause', 'lbcSupprime', 'lbcPublier', 'lbcRepondre',
  'vcRepondre', 'vcOffre', 'vcOffreAimes', 'vcPreparer',
  'creerVintedFiche', 'publierFiche', 'publierBrouillon', 'recreerVinted', 'republierVinted', 'reprendreRepub', 'refaireBrouillon',
  'vacancesVinted',
]);

export const estCommandePlateforme = (cmd) => CMDS_PLATEFORME.includes(String(cmd || ''));

// Une requête brute vers une plateforme (`vmrExec`) qui n'est pas une lecture : répondre à un message,
// accepter une offre… — refusée de la même façon.
export const estEcriturePlateforme = (q) => !!q && String(q.method || 'POST').toUpperCase() !== 'GET';

// La réponse du pont à un geste refusé : la forme d'un refus de l'extension (rien n'est parti), la phrase dite.
export function refusPanneau(phrase) {
  return { ok: false, accepte: false, envoye: false, code: 'panneau', raison: phrase, error: phrase };
}
