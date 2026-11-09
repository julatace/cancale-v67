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
| — | zéro banc rouge (suite) | PR #1082 | **en ligne** |
| — | direction artistique 5 : colonne de gauche refaite + boutons (demande de Julien) | PR #1073 | **en ligne** |
| A | Ma journée instantanée + objectif du mois | PR #1074 | **en ligne** |
| B | « Annuler » 5 s au lieu des confirmations réversibles + ⌘K qui agit | PR #1080 | **en ligne** |
| C | baisse de prix en série sur son clic (ext. 5.336) | `claude/baisse-prix-serie` | à lancer |
| D | ouverture hors ligne à froid (oui explicite de Julien) + « compte Vinted déjà relié » dans l'app | PR #1081 | **en ligne** |
| E | Solo étendu : un compte vendeur PAR plateforme (choix par défaut, à confirmer par Julien) | `claude/solo-plateformes` | **fini, à intégrer** (`2026-11-09-solo-plateformes.md`, migration 030) |
| F | prix plancher sous chaque offre + « déjà N paires de ce modèle » | PR #1079 | **en ligne** |
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
| V | scanner au dépôt (Colis) ET au retrait (Achats) | PR #1075 | **en ligne** |
| W | inventaire de fin d'année | `claude/inventaire-annuel` | à lancer |
| X | sélection multiple + filtres enregistrés + fiche à côté de la liste | `claude/lots-vues-panneau` | à lancer |
| Y | corbeille 30 jours | `claude/corbeille` | à lancer |
| Z | pastille sur l'icône (colis à envoyer) | `claude/pastille-icone` | fait (session principale) |
| AA | sur vinted.fr : infos sous SES annonces + calculette pendant un achat (ext. 5.339) | `claude/extension-infos` | à lancer |
| AB | un seul fil par acheteur et par paire, toutes plateformes | `claude/fil-unique` | à lancer |

| — | transporteurs inconnus (PDF du bordereau, identité) + e-mails Vestiaire et Chronopost mieux lus (demandes de Julien) | PR #1074 | **en ligne** |

| — | colis à retirer : relecture fréquente, retirés jamais montrés, carte = onglet (plainte de Julien) | PR #1079 | **en ligne** |
| — | direction artistique 6 : refonte VISIBLE « Widgets » (« il n'y a pas un grand changement ») | PR #1082 | **en ligne** |
| — | plus de balayage entre onglets ; vues Vinted à 0 = pas su | PR #1074 | **en ligne** |

| AC | « À trancher » : un seul endroit pour tous les doutes, un geste par ligne | PR #1084 | **en ligne** |
| AD | « Préparer mes colis » pas à pas + mode relais (codes plein écran) | PR #1083 | **en ligne** |
| AE | Colis et Ventes instantanés | PR #1084 | **en ligne** |
| AF | même annonce sur deux comptes Vinted + historique d'un N° | PR #1084 | **en ligne** |
| AG | ligne de fraîcheur unique | `claude/fraicheur-unique` | en cours |
| AH | Siri / Raccourcis (ajouter un achat, où est le N°) | `claude/siri-raccourcis` | à lancer |

| AI | textes d'explication ⇒ pop-ups ; bouton « Imprimer » en double ; carte du compte ⇒ Paramètres ; point du compte Vinted refait (demandes 1, 2, 13, 14 du 9 nov. 21 h) | `claude/popups-propre` | en cours |
| AJ | ordre partout : plus récent en haut, tous comptes (3) | `claude/ordre-recent` | en cours |
| AK | zéro « Transporteur inconnu » (tous les PDF), logos des transporteurs, carte des relais parfaite, suivi irréprochable (4, 5, 11) | `claude/transporteurs-parfaits` | en cours |
| AL | Favoris & offres dans Messages, Republier dans Annonces (12) | `claude/navigation-fusion` | en cours |
| AM | Annonces « Toutes » en grille comme Vinted, propositions lisibles (15) | `claude/annonces-grille` | à lancer |
| AN | photo en grand partout + Achats plus beaux + facture d'achat hors Vinted (9, 10, 16) | `claude/photos-achats` | à lancer |
| AO | Compta reliée à Statistiques (8) | `claude/compta-stats` | à lancer |
| AP | republication à la main conseillée et attirante, photos vers la galerie, N° et descriptions en sélection multiple (17) | `claude/republier-main` | à lancer |
| AQ | câbler la création des e-mails de transfert (6) | `claude/emails-transfert` | à lancer |
| AR | Communauté pour les créateurs de formation (7) | `claude/communaute-formateurs` | à lancer |

Refusé le 9 nov. : « Ma liste de recherche » (18). Les vidéos d'aide viendront plus tard.
