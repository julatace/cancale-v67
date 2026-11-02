// ── UNE PHRASE PAR ÉCRAN (2 nov., liste D2 : « chaque écran dit en UNE phrase
// ce qu'on y fait, et UN geste principal visible »).
// Une source pour la phrase d'en-tête des six écrans du quotidien : l'app la
// pose sous le titre (`data-phrase-ecran`), le banc la lit ici et vérifie
// qu'elle est courte et sans jargon. Elle dit ce qu'on FAIT, jamais comment
// marche l'outil (« capté », « relu », « sync »… sont interdits : JARGON).
// (2 nov., 22 h, Julien : « tout le temps tu ajoutes des textes explicatifs partout, ce
// qui est horrible ») Ma journée, Ventes et Colis n'ont plus de phrase : la maquette
// Fusion n'en montre aucune. Retiré à la demande de Julien, 2 nov. 22 h.
export const ECRANS_SANS_PHRASE = ['journee', 'ventes', 'colis'];
export const PHRASES_ECRAN = {
  annonces: 'Tes paires en vente, avec leur numéro.',
  messages: 'Réponds aux acheteurs et à leurs offres.',
  settings: 'Tes comptes, tes emails et l’affichage.',
};
export const MOTS_MAX_PHRASE = 10;
// Les mots de la machine, pas de la personne (D2/D3).
export const JARGON = /\b(capt[ée]e?s?|captur\w*|harvest|payload|sync\w*|synchro\w*|relu[es]?|relire|moisson\w*|scrap\w*|fetch\w*|api)\b/i;
