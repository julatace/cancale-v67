// ── UNE PHRASE PAR ÉCRAN (2 nov., liste D2 : « chaque écran dit en UNE phrase
// ce qu'on y fait, et UN geste principal visible »).
// Une source pour la phrase d'en-tête de chaque écran : l'app la pose sous le
// grand titre (`data-phrase-ecran`, composant `PhraseEcran`), le banc la lit ici
// et vérifie qu'elle est courte et sans jargon. Elle dit ce qu'on FAIT, jamais
// comment marche l'outil (« capté », « relu », « sync »… sont interdits : JARGON).
//
// Historique : (2 nov., 22 h) Ma journée, Ventes et Colis n'avaient plus de phrase
// (maquette Fusion) ; (3 nov.) Annonces, Messages et Paramètres non plus (Julien
// « DÉTESTE les textes explicatifs »).
// ⚠️ (8 nov., Julien : « TOUT DOIT être parfait, on doit mieux comprendre chaque
// onglet, chaque bouton » — des vendeurs vont payer, un nouveau venu doit
// comprendre chaque écran sans aide) LA PHRASE REVIENT, MAIS UNE SEULE et de
// 10 mots au plus : ce qu'on fait ici et le geste principal. Pas un paragraphe,
// pas de « pourquoi » (il vit derrière « ⓘ »). Pour la retirer à nouveau :
// vider l'entrée ici, rien d'autre à toucher (récit : docs/passation/2026-11-08-clarte.md).
export const ECRANS_SANS_PHRASE = [];
export const PHRASES_ECRAN = {
  journee: 'Ce qui t’attend aujourd’hui, le plus pressé en haut.',
  annonces: 'Tes paires en ligne : numéro, prix d’achat, offres.',
  ventes: 'Tes ventes de tous les sites, et l’argent qui arrive.',
  colis: 'Imprime les bordereaux, dépose tes colis, retire tes achats.',
  messages: 'Réponds à tes acheteurs et à leurs offres.',
  achats: 'Ce que tu as acheté : en route, reçu, prix payé.',
  emails: 'Les e-mails de tes plateformes, rangés : codes, bordereaux, ventes.',
  compta: 'Ce que tu as vendu, reçu, gagné, et à déclarer.',
  dashboard: 'Ce qui se vend le mieux, et à quel prix.',
  garage: 'Où est rangée chaque paire : cherche un N°.',
  settings: 'Relie tes comptes et ta boîte e-mail, règle VRM.',
  communaute: 'La carte des revendeurs VRM, et tes groupes.',
};
export const MOTS_MAX_PHRASE = 10;
// Les mots de la machine, pas de la personne (D2/D3).
export const JARGON = /\b(capt[ée]e?s?|captur\w*|harvest|payload|sync\w*|synchro\w*|relu[es]?|relire|moisson\w*|scrap\w*|fetch\w*|api)\b/i;
