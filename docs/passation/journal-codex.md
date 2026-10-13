# Reprise Codex — 12 octobre 2026

Base de travail : `origin/main`, commit `eaa8a0b`.
Branche locale : `claude/codex-preparation-publication`.

## Premier lot : rendre les vérifications reproductibles

- 85 scripts de navigateur utilisaient le chemin du Chromium Linux de la
  machine Claude ; plusieurs chargeaient Playwright depuis `/home/user`.
  Ils utilisent désormais le Playwright du dépôt et `scripts/_chromium.cjs`.
  Le Chromium du conteneur reste prioritaire s'il existe. Sinon, le navigateur
  installé par Playwright est utilisé. `BANC_CHROMIUM` permet un choix explicite.
- La procédure du README des bancs lance une copie complète du dépôt.
- `audit-planchers-code` déclarait à tort que la 5.175 ne savait pas lier
  une session. Sa regex de retrait des commentaires traversait le code réel.
  L'analyse Babel retrouve `demanderLiaison` et `code: CODE_VERSION` sans
  supprimer des chaînes ou des motifs. Les frontières de l'extension restent
  celles de production : aucun comportement de session n'a été modifié.
- Vite passe de 5.4 à 6.4.4 ; plugin React 4.7. Les dépendances transitives
  sont mises à jour dans le verrou. `npm audit` : 7 vulnérabilités avant,
  0 après. Le build Vite 6 passe.

## Vérifications

- Avant correction : compilation verte ; 83/92 audits verts, 9 rouges.
- Après correction des chemins et de l'analyse : 92/92 audits verts.
- Syntaxe de 87 scripts vérifiée par `node --check`.
- Choix Chromium local, choix explicite et refus d'un chemin inexistant : verts.
- Banc premierjour sur le build d'origine : 67 verts, 0 rouge.
- Nouveau build Vite 6 : vert ; banc démarrage : vert.
- Dernier passage complet après mise à jour des dépendances : 92/92 audits
  verts ; banc accueil : 171 verts, 0 rouge (téléphone, tablette, ordinateur
  et film).
- `audit-agent-sql` et `audit-renum-b` : NON exécutés, PostgreSQL absent.
- Bancs utilisant les fixtures réelles `fx/` : NON exécutés, fixtures absentes.

## État du travail précédent

Les journaux des Agents 1 et 2 remplacent les anciennes listes du README pour
ce qui a été intégré depuis : 5.175, accueil, prix d'achat au numérotage, fiche
à l'arrivée, classement des comptes, remise native, dictée, codes hors ligne,
traduction. Ne pas reprendre aveuglément les anciens bundles.

Restent notamment à intégrer/valider : la règle d'offre eBay sur
`origin/claude/wip-d-regle-offre` (tête `0255714`), l'application de la migration
014 (le fichier est intégré, l'application est différée selon le journal),
l'agent eBay, le push de double vente app fermée, les sessions/mode équipe,
le studio photo et la passe de vitesse. La revue complète avec les données
réelles reste à faire. Les informations de l'éditeur sont encore vides dans
`public/legal/editeur.js` ; ne rien inventer.

## Blocage de publication

- Git HTTPS : aucune authentification disponible pour pousser.
- Connecteur GitHub : création de branche refusée, HTTP 403,
  `Resource not accessible by integration`.
- Aucun changement de ce lot n'est envoyé sur GitHub ou déployé.
- Les corrections sont conservées localement et exportées en patch.

## Reconnexion GitHub

Après reconnexion par Julien le 12 octobre : le connecteur confirme l'accès
`push` au dépôt. La branche distante `claude/codex-preparation-publication`
est créée. Le lot est envoyé par le connecteur (Git HTTPS reste sans session).
Une PR de revue est préparée ; aucune mise en production de ce lot.
