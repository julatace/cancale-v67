# Reprise des chantiers de Claude — 4 novembre 2026

La demande collée par Julien est une passation, pas une preuve de livraison.
Base de reprise : `ced52548` (main, extension 5.319.0). Aucune session réelle
Vinted, eBay, Google ou Supabase administrateur n'est disponible ici.

## Intégration préparée

Vrais merges, en conservant les changements de main :

- `claude/argent-mois` : argent à venir par site/compte, comparer deux mois,
  frais par site, journal de la semaine.
- `claude/offres-objectif` : statistiques des offres, objectif mensuel dans
  la carte des chiffres, questions eBay dans Messages. Les chiffres tirés des
  conversations anciennes restent partiels ; aucune acceptation attribuée au
  moteur sans journal.
- `claude/achats-sourcing` : fournisseurs, délai réception → mise en ligne,
  répartition du coût d'un lot entre ses articles. Pas de rapprochement par titre.
- `claude/comptes-securite` : compte choisi par site, masquer les montants,
  journal des actions et déconnexion globale. La liste/déconnexion individuelle
  des appareils nécessite la migration 024, **préparée, non appliquée ici**.

Corrections trouvées à l'intégration :

- Le handler Vercel des appareils ne lisait pas le flux JSON avec bodyParser
  désactivé : lecture par `lireCorpsJson`, refus des corps invalides. Le vrai
  handler est testé, avec authentification/rpc simulés, propriétaire étranger
  et appareil courant refusés. Deux tests rouges sur le code d'avant.
- Une retenue eBay sans montant lisible ou en devise étrangère ne doit jamais
  prendre le total de la commande comme montant retenu. Exclue et nommée.
- Une comparaison ne dit pas zéro quand les ventes sont encore en lecture.
  Ces deux erreurs sont reproduites par les tests sur le code d'avant.
- L'audit d'objectif charge les imports de carteChiffres depuis leur vrai
  dossier : l'ajout de l'argent à venir y avait cassé la résolution des modules.

## Travail qui reste réellement ouvert

- **Conversations Vinted** : `claude/conversations-capture` ne contient aucun
  correctif au-delà de main. Le relevé existant constate que la page ne charge
  plus l'ancienne route. Les nouvelles formes réelles ne sont pas disponibles
  ici. Ne pas annoncer de correction de la collecte ni sortir une « 5.320 »
  fictive : lire d'abord un relevé récent `seen_urls.conversation` depuis une
  session autorisée (formes/statuts, sans messages privés dans GitHub).
- **Journal des offres automatiques** : l'historique des messages aux favoris
  n'est pas un journal des acceptations. La nouvelle page dit ses limites.
- **Relais/corbeille/photo du colis** : branche `claude/relais-corbeille`
  conservée, merge d'essai annulé. Risques repérés à traiter avant livraison :
  purge d'une ancienne entrée effaçant une photo remplacée, restauration de
  photo sans contrôle d'expiration, collisions lors de restauration. Ne pas
  refaire un simple merge (l'historique contient déjà le merge puis son revert) :
  reprendre la branche, corriger/tester puis rétablir l'ensemble explicitement.
- **Discord** : le profil Discord personnalisé et l'identité Supabase de
  connexion restent deux mécanismes différents. La correction de cette
  confusion et le cas du compte doublon restent à reprendre ; aucune fusion
  de comptes par email n'est autorisée implicitement.
- **Nettoyage des données personnelles en production** : aucune suppression
  effectuée. La question collée de Claude n'est pas un accord de Julien.

## Bordereaux déjà présents dans main

La sélection Leboncoin/Vestiaire et le tampon par type ont été livrés par #1006.
Le code n'est pas remplacé par une ancienne branche. Les audits correspondants
sont inclus dans les vérifications de cette reprise.

## Vérifications

Données fictives uniquement. Tests de calcul et du handler, audits des branches,
banques de rendu `argent-mois`, `offres-objectif`, `achats-sourcing`,
`comptes-securite` (téléphone/ordinateur, clair/sombre). Workflow dédié
`.github/workflows/reprise-chantiers.yml`, en plus des parcours critiques.
Le résultat des tests ne prouve pas une collecte réelle sur l'appareil de Julien.

### Dernière revue d'intégration

- Déconnexion globale : l'utilisateur courant est relu après confirmation,
  après le réseau et dans le rappel différé. Une réponse de A ne déconnecte
  jamais B. La déconnexion individuelle valide aussi l'accusé exact du serveur.
- Contrôles précédemment rouges sur main remis en phase avec leurs vrais
  contrats : identifiant (et non booléen) renvoyé par le garde des numéros,
  lecture Leboncoin propriétaire, source Vestiaire séparée, `codeGmail:null`.
  Les assertions contre les comptes étrangers restent présentes.
- Le test Gmail vérifie maintenant le transfert du code Google à VRM, avec
  accusé, sans ouvrir le lien ni archiver l'email de validation. Téléchargements
  régénérés depuis la source unique ; le script Google installé n'est pas modifié.
- L'audit photos documente cinq sources non-Vinted déjà présentes dans main
  (Vestiaire filtré, logos transporteurs fermés, canvas PDF, ticket local), sans
  autoriser un nouveau `<img>` arbitraire.
- Résultats locaux : parcours critiques 9/9, banc argent 100/100,
  offres/objectif 96/96 avant ajout du contrôle de contraste, achats 120/120,
  comptes/sécurité tout vert. Captures examinées. Les tests d'isolation des
  déconnexions et les cas financiers passent, et échouent avant correction.
