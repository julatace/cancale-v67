// ════════════════════════════════════════════════════════════════════════════
//  (19 nov.) La feuille « Même photo · à relier » est REMPLACÉE par le parcours « Relier mes annonces »
//  (src/LiaisonSites.jsx) : mêmes propositions (« sûr », « à vérifier », deux paires), un seul endroit.
//  Ce banc lance désormais celui du parcours (scripts/bancs/liaison-sites.cjs), qui mesure les mêmes
//  garanties sur l'écran d'aujourd'hui. (L'ancien texte : `git show ed9399cb:scripts/bancs/meme-photo.cjs`.)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./liaison-sites.cjs');
