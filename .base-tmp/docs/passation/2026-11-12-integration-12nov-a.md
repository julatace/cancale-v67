# Intégration 12nov-a — les branches du second agent (12 nov. 2026)

Branche : `claude/integration-12nov-a`, partie de `integration-11nov-g2`, puis `origin/main` (avec G2) fusionné.
Intégrateur : le second agent (session youthful-wozniak), l'agent principal étant arrêté (100 % d'utilisation).

## Ce qui est réuni (vrais `git merge`, dans cet ordre)
`agent2-revue-fin` (contient serveur-migrations, familles-serveur, familles-app, robustesse-metier) ·
`agent2-donnees-suite` (contient robustesse-donnees) · `agent2-regroupe-comptes` · `agent2-ventes-vestiaire` ·
`agent2-temps-reel` · `agent2-veille` · `agent2-cloisonnement` · `agent2-limites-client` · `agent2-saisie-rapide` ·
`agent2-argent-parrainage` · `agent2-messages` · `agent2-conseil-mesure` (contient revue-fin) ·
`agent2-messages-sites` (contient messages) · `agent2-securite-comptes`.
Pas dedans : l'extension du second agent (`agent2-discretion`, 5.370, contient ecriture-humaine et moyennes) — paquet suivant.

## Extension 5.369.0
`agent2-ventes-vestiaire` change `fraisParPlateforme` (frais Vestiaire) : la copie des règles d'achat de
l'extension (`vrm-regles-achat.js`, `regles-achat-extension.cjs --recopie`) devait être refabriquée
(`audit-infos-vinted` I10) ⇒ une version neuve : CODE_VERSION, manifeste, capteur et relais Leboncoin,
`EXT_ATTENDUE`, zips Chrome et Orion. Aucun autre changement d'extension.

## Conflits et résolution (les deux intentions gardées)
- Serveur : imports réunis ; chaque `fetch` nu apporté par g2 ou une branche (avis-negatif, moderation-notif, ebay,
  ebay-remises, plantages-comptes, veille-chiffres, prix-achat-demande, parrainage) passe par `fetchAvecDelai`, les
  lectures `Range` par `ordreStable` et `finALaFrontiere` (`audit-familles-serveur` vert).
- `api/push.js` et `api/ship-reminders.js` : modération, avis bas, veille ET prix d'achat ; mémo illisible ⇒ rien ;
  bail du cron + temps par vendeur + reportés.
- App : trésorerie « au moins » (revue-fin) + comptes dans une autre devise nommés (donnees-suite) ; push de `main`
  borné (`fetchBorne`) ET `keepalive` à la sortie ; fiche Pro lue au montage ET écrite par différence ;
  `ligneCas.js` : les deux modules ; Annonces : vue mémorisée (g2) + suite par paquets (`SuitePaquets`).
- Messages Leboncoin/Vestiaire : alerte anti-arnaque ET envoi vu dans le fil ; frais Vestiaire gardés.

## Défauts trouvés au croisement, corrigés ici
- **Annonces plantait** (« Cannot read properties of undefined (reading 'map') ») : la grille lisait `g.montres`
  (limites-client) sur la vue de g2 (`g.items`). Vu par le banc `limites-client`.
- **« Vendues en octobre »** ne posait plus la période : Ventes monte deux écrans, le premier vidait la demande ⇒
  chaque instance la prend une fois (banc `saisie-rapide`, 4 rouges ⇒ vert).
- « Chrome » en dur (groupes de comptes), styles-composants rechargé en dernier, une icône par ligne (simulation,
  copie des annonces), dates de la veille à l'heure de Paris, « paire » seulement pour Sneakers (contrôle de nuit,
  veille, Stock), rouge de la veille seulement sur « deux paires sous un N° » (jeton doublon), Vestiaire « livrée »
  sans lookbehind (Safari < 16.4).
- Audits remis à la forme actuelle du code (copies de modules, contextes vm, signatures) : comptes-exclus,
  livre-registre, numerotation-lecteurs, republier-programme, retirer-ailleurs, statut-transporteurs (débit du
  widget), urssaf, donnees-suite, jetons-vinted (042 absente, hors ligne), stockage-sur (dette des lots g2 nommée).

## Migrations
042 (`agent2-serveur-migrations`, dans revue-fin) n'est PAS appliquée : geste de Julien ; le code marche sans
(`vrm_vinted_relier` absente ⇒ 404 ⇒ le chemin d'avant). 037, 040, 041 déjà appliquées. Dès la mise en ligne,
l'app ouvre la veille temps réel (040).
