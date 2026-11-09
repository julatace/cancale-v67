# File des lots — session du 9 nov. (soir), branche d'intégration `claude/youthful-wozniak-v71bap`

Toutes les propositions ci-dessous sont **validées par Julien** (détail et décisions mot pour
mot : `2026-11-09-propositions.md`). Une session qui reprend : regarder sur l'origine quelles
branches `claude/<lot>` existent, intégrer celles qui sont finies (vrai merge, §6 de la
passation générale), puis lancer les suivantes (≈ 5 agents en même temps au plus).

Versions d'extension réservées : **5.336** = C (baisse de prix en série) · **5.337** = G
(jauge + journal) · **5.338** = O (mode vacances) · **5.339** = AA (infos sur vinted.fr). Un lot qui n'en a finalement pas besoin
libère son numéro (le dire ici).

| lot | contenu | branche | état |
|---|---|---|---|
| — | intégration journee-v2 + zero-banc-rouge (1re partie) | PR #1069 | **en ligne** |
| — | suites serveur (Solo côté serveur, double vente LBC < 24 h) | PR #1070 | **en ligne** |
| — | direction artistique 4 (feuilles, confirmations, toasts, états vides, barre du bas) | PR #1072 | **en ligne** |
| — | zéro banc rouge (suite) | `claude/zero-banc-rouge` | en cours |
| — | direction artistique 5 : colonne de gauche refaite + boutons (demande de Julien) | `claude/direction-artistique-5` | en cours |
| A | Ma journée instantanée + objectif du mois | `claude/journee-instantanee` | en cours |
| B | « Annuler » 5 s au lieu des confirmations réversibles + ⌘K qui agit | `claude/annuler-commandes` | à lancer |
| C | baisse de prix en série sur son clic (ext. 5.336) | `claude/baisse-prix-serie` | à lancer |
| D | ouverture hors ligne à froid (oui explicite de Julien) + « compte Vinted déjà relié » dans l'app | `claude/hors-ligne-relie` | à lancer |
| E | Solo étendu : un compte vendeur PAR plateforme (choix par défaut, à confirmer par Julien) | `claude/solo-plateformes` | en cours |
| F | prix plancher sous chaque offre + « déjà N paires de ce modèle » | `claude/plancher-stock` | à lancer |
| G | jauge 50 actions/h + journal « ce que VRM a fait » (ext. 5.337) | `claude/jauge-journal` | à lancer |
| H | échéances .ics + alerte « nouvel appareil » (12 fonctions api au plus) | `claude/ics-appareil` | à lancer |
| I | délais de litige (forme à mesurer par Julien) + marge par plateforme | `claude/litiges-marge` | à lancer |
| J | import Excel + partage depuis Photos + aide par écran SANS vidéo | `claude/import-partage-aide` | à lancer |
| K | ouverture légère (cache par `data.rev`) | `claude/ouverture-legere` | en dernier |
| L | calculette d'achat + historique de prix + stock d'emballages | `claude/calculette-emballages` | à lancer |
| M | photos d'emballage + fiche à partager | `claude/photos-fiche` | à lancer |
| N | étapes d'atelier DANS Organisation | `claude/atelier-organisation` | à lancer |
| O | mode vacances tous comptes (ext. 5.338) | `claude/mode-vacances` | à lancer |
| P | raccourcis clavier + VoiceOver | `claude/clavier-voiceover` | à lancer |
| Q | factures Pro : envoi auto (éteint), à envoyer, avoir, registre + zip | `claude/factures-pro-2` | à lancer |
| R | livre de police | `claude/livre-police` | à lancer |
| S | factures Pro Leboncoin/eBay/Vestiaire (forme à mesurer) | `claude/factures-autres` | à lancer |
| T | facture en anglais + alerte seuil TVA | `claude/facture-en-tva` | à lancer |

| U | annonces à compléter + avis sur chaque vente | `claude/annonces-avis` | à lancer |
| V | scanner au dépôt (Colis) ET au retrait (Achats) | `claude/scanner-colis-achats` | en cours |
| W | inventaire de fin d'année | `claude/inventaire-annuel` | à lancer |
| X | sélection multiple + filtres enregistrés + fiche à côté de la liste | `claude/lots-vues-panneau` | à lancer |
| Y | corbeille 30 jours | `claude/corbeille` | à lancer |
| Z | pastille sur l'icône (colis à envoyer) | `claude/pastille-icone` | fait (session principale) |
| AA | sur vinted.fr : infos sous SES annonces + calculette pendant un achat (ext. 5.339) | `claude/extension-infos` | à lancer |
| AB | un seul fil par acheteur et par paire, toutes plateformes | `claude/fil-unique` | à lancer |

| — | transporteurs inconnus (PDF du bordereau, identité) + e-mails Vestiaire et Chronopost mieux lus (demandes de Julien) | `claude/transporteurs-emails` | en cours |

Refusé le 9 nov. : « Ma liste de recherche » (18). Les vidéos d'aide viendront plus tard.
