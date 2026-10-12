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

## 12 octobre — reprise eBay et mémoire SQL

La migration 014 a été essayée en transaction annulée puis appliquée au projet
Supabase existant. Le contrôle après application ne trouve aucun écart : 16
 tables de l'agent, RLS forcée, fonctions et déclencheurs attendus. L'installation
`agent_ebay` reste à `0` : aucun agent ni horloge activés. Sur PostgreSQL jetable,
`audit-agent-sql` passe 221 contrôles et `audit-renum-b` 126.

Fusion véritable de `claude/wip-d-regle-offre` (0255714) avec le lot Codex et
main : comptes multiples et règles natives eBay conservés, ainsi que les
preuves par bordereau et la numérotation après migration 013. Le retrait relit
le marqueur du vendeur dans le contexte du compte choisi. Les comparaisons de
SKU traduisent aussi les anciennes annonces avant de comparer les numéros.

Les bancs fusionnés utilisent les preuves projetées actuelles, sans doublon de
ligne orders_sold. Le contrôle du corps de retrait simule désormais le contexte
multi-compte et un statut HTTP, comme la route. Le texte du retrait automatique
réutilise les conditions de sa confirmation.

Vérifications : 93 audits hors SQL passent (le dernier lecteur de numérotation
100/0) ; ses 42 mutations sont détectées ; règle d'offre rendue 376/0 ; comptes
multiples, API, écritures, callback, suppression et formulaire passent. La passe
complète des annonces et de la programmation se termine avant validation K0.
Aucun appel réel eBay/Vinted, aucune annonce créée ou retirée par ces essais.

Julien reporte les informations légales à la fin. Ne pas inventer d'identité
ni considérer le site prêt à ouvrir : K1/K2 et la suite restent à construire.

### Validation de la fusion K0 et première partie K2

Le banc `ebay-annonces` est maintenant entièrement vert sur le build corrigé ;
celui de programmation est vert aussi. La fusion est conservée sur GitHub dans
la PR brouillon #488 (base : lot de préparation #487).

K2 commencé : état de la paire exigé avant publication et vérification ; CDATA
échappée sans perdre la description ; commandes paginées par date de modification,
fusionnées avec l'historique et mises à jour par version de la ligne. Une page
manquante ou une lecture de base ratée n'écrase rien. Une projection explicite
retire les adresses et emails acheteurs, y compris des anciennes captures, au
premier passage réussi ; aucune migration de données aveugle. Le prochain lien
de pagination est limité à la route officielle des commandes, sans identifiants
URL. La capture n'est annoncée rangée que si l'écriture gardée a réussi.

Preuves : audit de route 423 contrôles ; audit commandes (vraies fonctions,
services simulés) couvre conservation, remboursements actualisés, fuite d'adresse,
page en panne, pagination hostile, boucle et plafond. K2 n'est pas terminé :
connexion à trois états, notifications de suppression signées et métadonnées
transport restent à construire.
