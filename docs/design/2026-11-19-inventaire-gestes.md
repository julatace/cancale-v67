# Inventaire des gestes — relevé par `scripts/inventaire-gestes.cjs`

Fichier FABRIQUÉ (ne pas le corriger à la main : relancer l’outil). La vraie app, une base inventée au volume de celle de Julien,
à 390 px (téléphone) et 1512 px (ordinateur). Une rangée répétée (une liste de 1 000 annonces) compte pour UNE ligne, avec son nombre.
« Touchers » = nombre de touchers depuis l’ouverture de l’app pour ACTIVER l’élément (accès à l’écran + chemin + lui).
La sorte est déduite (balise, rôle, `data-*`, libellé) : c’est une aide au tri, pas un jugement. Le verdict est dans `2026-11-19-audit-utilite.md`.

## Le compte, écran par écran

| écran | accès | 390 : éléments (dont visibles sans défiler · derrière un toucher) | 1512 : éléments | navigation · action · réglage · information · aide (390) | touchers max |
|---|---|---|---|---|---|
| Aujourd’hui (Ma journée) | ouverture (0 / 0) | 44 (32 · 0) | 46 (36 · 0) | 9 · 19 · 8 · 7 · 1 | 1 |
| Annonces | barre (1 / 1) | 48 (33 · 0) | 56 (41 · 0) | 10 · 12 · 16 · 9 · 1 | 2 |
| Annonces › Republier | Annonces › vue (2 / 2) | 56 (38 · 0) | 62 (38 · 0) | 7 · 12 · 25 · 11 · 1 | 3 |
| Stock | Annonces › Stock (tél.) · colonne (2 / 1) | 31 (21 · 0) | 33 (23 · 0) | 8 · 10 · 5 · 7 · 1 | 3 |
| Achats | barre (1 / 1) | 47 (36 · 0) | 50 (39 · 0) | 9 · 17 · 13 · 6 · 2 | 2 |
| Ventes | barre (1 / 1) | 37 (23 · 0) | 39 (26 · 0) | 8 · 17 · 7 · 4 · 1 | 2 |
| Ventes › Litiges en cours | Ventes (2 / 2) | 11 (10 · 0) | 14 (13 · 0) | 7 · 2 · 0 · 2 · 0 | 3 |
| Argent › Résumé | barre (1 / 1) | 36 (23 · 0) | 41 (32 · 0) | 9 · 16 · 3 · 7 · 1 | 2 |
| Argent › Statistiques | Argent › segment (2 / 2) | 56 (21 · 0) | 59 (27 · 0) | 9 · 13 · 21 · 8 · 5 | 3 |
| Argent › Factures | Argent › segment (2 / 2) | 26 (22 · 0) | 34 (31 · 0) | 7 · 10 · 4 · 5 · 0 | 3 |
| Argent › Prix du marché | Argent › Statistiques (3 / 3) | 18 (17 · 0) | 21 (20 · 0) | 7 · 8 · 0 · 2 · 1 | 4 |
| Messages | menu ☰ (tél.) · colonne (2 / 1) | 27 (26 · 0) | 30 (29 · 0) | 14 · 2 · 8 · 2 · 1 | 3 |
| Messages › Favoris & offres | Messages › section (3 / 2) | 34 (28 · 0) | 46 (37 · 0) | 9 · 5 · 12 · 7 · 1 | 4 |
| E-mails | menu ☰ (tél.) · colonne (2 / 1) | 56 (25 · 0) | 59 (32 · 0) | 8 · 35 · 10 · 2 · 1 | 3 |
| Communauté | menu ☰ (tél.) · colonne (2 / 1) | 13 (12 · 0) | 16 (15 · 0) | 7 · 3 · 0 · 2 · 1 | 3 |
| Paramètres | photo du profil (2 / 2) | 17 (16 · 0) | 96 (24 · 0) | 7 · 5 · 2 · 2 · 1 | 3 |
| Paramètres › Comptes liés | Paramètres › catégorie (4 / 4) | 21 (18 · 0) | 24 (21 · 0) | 10 · 5 · 3 · 3 · 0 | 5 |
| Achats masqués | Achats › ⋯ (3 / 3) | 11 (10 · 0) | 14 (13 · 0) | 7 · 2 · 0 · 2 · 0 | 4 |
| Organisation | Paramètres › Stock et rangement (4 / 4) | 14 (13 · 0) | 17 (16 · 0) | 7 · 5 · 0 · 2 · 0 | 5 |
| À trancher | carte de Ma journée (1 / 1) | 58 (35 · 0) | 59 (39 · 0) | 12 · 29 · 8 · 8 · 1 | 2 |
| Ma semaine | Ma journée (1 / 1) | 18 (17 · 0) | 21 (20 · 0) | 7 · 8 · 0 · 3 · 0 | 2 |
| Catalogue (ancien écran) | lien seul (9 / 9) | 18 (17 · 0) | 21 (20 · 0) | 7 · 5 · 3 · 3 · 0 | 10 |
| Stock Vinted (ancien écran) | lien seul (9 / 9) | 15 (14 · 0) | 18 (17 · 0) | 7 · 4 · 1 · 2 · 1 | 10 |
| Inventaire (ancien écran) | lien seul (9 / 9) | 44 (32 · 0) | 46 (36 · 0) | 9 · 19 · 8 · 7 · 1 | 10 |
| La fiche d’une paire | une rangée › la paire (2 / 2) | 6 (6 · 0) | 7 (7 · 0) | 1 · 1 · 3 · 1 · 0 | 3 |
| La loupe (recherche) | en-tête (1 / 1) | 8 (8 · 0) | 54 (44 · 0) | 0 · 7 · 0 · 0 · 1 | 2 |
| **Total** | | **770** | **983** | | |

## Aujourd’hui (Ma journée) — 390 px (44)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 1 |  | aller-contenu |
| (écran) | Fermer | navigation | barre du bas |  | 1 |  | acc-fermer |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 1 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 1 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 1 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 1 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 1 |  | fraicheur-geste=version |
| (écran) | +24 27 colis pressés — À vérifier sur Vinted — 27 colis pressés — le p | action | écran |  | 1 |  | plein=27 colis pressés — À vérifier sur Vinted job=colis-limite n=27 l |
| (écran) | Aide : Ma journée | aide | écran |  | 1 |  | aide-ouvrir=journee |
| (écran) | Vendredi 13 novembre · 2 ventes · 138 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-13 |
| (écran) | Samedi 14 novembre · 2 ventes · 127 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-14 |
| (écran) | Dimanche 15 novembre · 2 ventes · 116 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-15 |
| (écran) | Lundi 16 novembre · 3 ventes · 141 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-16 |
| (écran) | Mardi 17 novembre · 3 ventes · 108 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-17 |
| (écran) | Mercredi 18 novembre · 3 ventes · 75 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-18 |
| (écran) | Jeudi 19 novembre · aucune vente | réglage | écran |  | 1 |  | jv2-toucher=2026-11-19 |
| (écran) | Semaine du 9 nov. | réglage | écran |  | 1 |  | jv2-semaine=2026-11-09 |
| (écran) | Ma semaine › | action | écran |  | 1 |  | ouvre-ma-semaine |
| (écran) | Voir les ventes (3 ventes) | navigation | écran |  | 1 |  | jv2-pile=3 sans-visionneuse |
| (écran) | À envoyer : 30 | information | écran |  | 1 |  | sj-zone=envoyer |
| (écran) | Ventes | action | écran |  | 1 |  | sj-lien=ventes |
| (écran) | Imprimer les 15 bordereaux | action | écran |  | 1 |  | sj-imprimer=15 impr-total=15 fu-principal |
| (écran) | Messages : 13 | information | écran |  | 1 |  | sj-zone=messages |
| (écran) | Prix à baisser : 0 | information | écran ↓ |  | 1 |  | sj-zone=prix |
| (écran) | À retirer : 0 | information | écran |  | 1 |  | sj-zone=retirer |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 1 |  | carte-modifier=journee |
| (écran) | Bénéfice · mois : pas su, prix d’achat manquants — Bénéfice · mois pri | action | écran |  | 1 |  | fu-case=benefice-mois carte-chiffre=benefice carte-p=mois carte-valeur |
| (écran) | Vendu · mois : 2 274 € 2 274 € Vendu · mois | action | écran |  | 1 |  | fu-case=vendu-mois carte-chiffre=vendu carte-p=mois carte-valeur=22740 |
| (écran) | Reçu · mois : 1 596 € 1 596 € Reçu · mois | action | écran |  | 1 |  | fu-case=recu-mois carte-chiffre=recu carte-p=mois carte-valeur=159600 |
| (écran) | À venir 60 ventes · Vinted (3 comptes) 30 à envoyer · 30 en route 3 63 | action | écran ↓ |  | 1 |  | a-venir-ouvrir |
| (écran) | À ce rythme, novembre finira vers 3 650 € estimation › | action | écran ↓ |  | 1 |  | argent-plus=prevision-ligne prev-etat=ok prev-jours=18 prev-centre=365 |
| (écran) | Offre aux favoris *(inactif)* | information | écran ↓ | 5 | 1 |  | rf-geste=favoris |
| (écran) | 146 annonces anciennes et peu vues — En ligne depuis 30 j ou plus : tu | action | écran ↓ |  | 1 |  | plein=146 annonces anciennes et peu vues — En  job=quoi-republier n=14 |
| (écran) | +21 24 nouveaux articles numérotés · N°2323, 2324, 2325, 2326, 2327 +1 | action | écran ↓ |  | 1 |  | plein=24 nouveaux articles numérotés · N°2323, job=numeros-nouveaux n= |
| (écran) | 1024 annonces numérotées sans prix d’achat — Saisis le prix ou relie l | action | écran ↓ |  | 1 |  | plein=1024 annonces numérotées sans prix d’ach job=achat-a-relier n=10 |
| (écran) | 855 articles en ligne depuis 30 j ou plus — Republier, préparer ailleu | action | écran ↓ |  | 1 |  | plein=855 articles en ligne depuis 30 j ou plu job=paires-dorment n=85 |
| (écran) | Colis à vérifier — Vérifie leur suivi avant d’y aller — 60 délais dépa | action | écran ↓ |  | 1 |  | plein=Colis à vérifier — Vérifie leur suivi av job=retrait-a-verifier  |
| (écran) | Tout va bien ? · 2 points › | action | écran ↓ |  | 1 |  | tvb-ligne=2 |
| (écran) | Modifier ma journée | action | écran ↓ |  | 1 |  | jp-modifier |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 1 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 1 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 1 |  | nav-entree=achats |
| (écran) | 30 · 30 à faire Ventes · 30 à faire | navigation | barre du bas |  | 1 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 1 |  | nav-entree=compta |

## Aujourd’hui (Ma journée) — 1512 px (46)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 1 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 1 |  | nav-entree=journee |
| (écran) | Ventes · 30 à faire · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 1 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 1 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 1 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 1 |  | nav-entree=communaute |
| (écran) | Fermer | navigation | barre du bas |  | 1 |  | acc-fermer |
| (écran) | Extension à installer | information | en-tête |  | 1 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 1 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 1 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 1 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 1 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 1 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 1 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 1 |  | fraicheur-geste=version |
| (écran) | +24 27 colis pressés — À vérifier sur Vinted — 27 colis pressés — le p | action | écran |  | 1 |  | plein=27 colis pressés — À vérifier sur Vinted job=colis-limite n=27 l |
| (écran) | Aide : Ma journée | aide | écran |  | 1 |  | aide-ouvrir=journee |
| (écran) | Vendredi 13 novembre · 2 ventes · 138 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-13 |
| (écran) | Samedi 14 novembre · 2 ventes · 127 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-14 |
| (écran) | Dimanche 15 novembre · 2 ventes · 116 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-15 |
| (écran) | Lundi 16 novembre · 3 ventes · 141 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-16 |
| (écran) | Mardi 17 novembre · 3 ventes · 108 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-17 |
| (écran) | Mercredi 18 novembre · 3 ventes · 75 € | réglage | écran |  | 1 |  | jv2-toucher=2026-11-18 |
| (écran) | Jeudi 19 novembre · aucune vente | réglage | écran |  | 1 |  | jv2-toucher=2026-11-19 |
| (écran) | Semaine du 9 nov. | réglage | écran |  | 1 |  | jv2-semaine=2026-11-09 |
| (écran) | Ma semaine › | action | écran |  | 1 |  | ouvre-ma-semaine |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 1 |  | carte-modifier=journee |
| (écran) | Bénéfice · mois : pas su, prix d’achat manquants — Bénéfice · mois pri | action | écran |  | 1 |  | fu-case=benefice-mois carte-chiffre=benefice carte-p=mois carte-valeur |
| (écran) | Vendu · mois : 2 274 € 2 274 € Vendu · mois | action | écran |  | 1 |  | fu-case=vendu-mois carte-chiffre=vendu carte-p=mois carte-valeur=22740 |
| (écran) | Reçu · mois : 1 596 € 1 596 € Reçu · mois | action | écran |  | 1 |  | fu-case=recu-mois carte-chiffre=recu carte-p=mois carte-valeur=159600 |
| (écran) | À envoyer : 30 | information | écran |  | 1 |  | sj-zone=envoyer |
| (écran) | Ventes | action | écran |  | 1 |  | sj-lien=ventes |
| (écran) | Imprimer les 15 bordereaux | action | écran |  | 1 |  | sj-imprimer=15 impr-total=15 fu-principal |
| (écran) | Prix à baisser : 0 | information | écran |  | 1 |  | sj-zone=prix |
| (écran) | Messages : 13 | information | écran |  | 1 |  | sj-zone=messages |
| (écran) | À retirer : 0 | information | écran |  | 1 |  | sj-zone=retirer |
| (écran) | Offre aux favoris *(inactif)* | information | écran | 5 | 1 |  | rf-geste=favoris |
| (écran) | 146 annonces anciennes et peu vues — En ligne depuis 30 j ou plus : tu | action | écran ↓ |  | 1 |  | plein=146 annonces anciennes et peu vues — En  job=quoi-republier n=14 |
| (écran) | +21 24 nouveaux articles numérotés · N°2323, 2324, 2325, 2326, 2327 +1 | action | écran ↓ |  | 1 |  | plein=24 nouveaux articles numérotés · N°2323, job=numeros-nouveaux n= |
| (écran) | 1024 annonces numérotées sans prix d’achat — Saisis le prix ou relie l | action | écran ↓ |  | 1 |  | plein=1024 annonces numérotées sans prix d’ach job=achat-a-relier n=10 |
| (écran) | 855 articles en ligne depuis 30 j ou plus — Republier, préparer ailleu | action | écran ↓ |  | 1 |  | plein=855 articles en ligne depuis 30 j ou plu job=paires-dorment n=85 |
| (écran) | Colis à vérifier — Vérifie leur suivi avant d’y aller — 60 délais dépa | action | écran ↓ |  | 1 |  | plein=Colis à vérifier — Vérifie leur suivi av job=retrait-a-verifier  |
| (écran) | À venir 60 ventes · Vinted (3 comptes) 30 à envoyer · 30 en route 3 63 | action | écran ↓ |  | 1 |  | a-venir-ouvrir |
| (écran) | À ce rythme, novembre finira vers 3 650 € estimation › | action | écran ↓ |  | 1 |  | argent-plus=prevision-ligne prev-etat=ok prev-jours=18 prev-centre=365 |
| (écran) | Tout va bien ? · 2 points › | action | écran ↓ |  | 1 |  | tvb-ligne=2 |
| (écran) | Modifier ma journée | action | écran ↓ |  | 1 |  | jp-modifier |

## Annonces — 390 px (48)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Fermer | navigation | barre du bas |  | 2 |  | acc-fermer |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 2 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 2 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 2 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Aide : Annonces | aide | écran |  | 2 |  | aide-ouvrir=annonces |
| (écran) | Annonces 24 | réglage | écran |  | 2 |  | nav-entree=annonces paires-segment=annonces badge-nav=annonces badge-n |
| (écran) | Stock | réglage | écran |  | 2 |  | nav-entree=garage paires-segment=garage |
| (écran) | Publier | action | écran |  | 2 |  | v2-principal=publier |
| (écran) | Vinted · 1024 annonces | réglage | écran |  | 2 |  | site=vinted site-n=1024 |
| (écran) | Leboncoin | réglage | écran |  | 2 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 2 |  | site=ebay sans-compte |
| (écran) | Compte : Tous les comptes — changer | information | écran |  | 2 |  | ui-menu-compte=tous |
| (écran) | Ventes · mois : 37 37 Ventes · mois | action | écran |  | 2 |  | fu-case=ventes-mois carte-chiffre=ventes carte-p=mois carte-valeur=37 |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 2 |  | carte-modifier=annonces |
| (écran) | À faire · 2 | information | écran |  | 2 |  | ui-afaire=2 |
| (écran) | Rechercher une annonce (titre, marque, N°) | réglage | écran |  | 2 |  |  |
| (écran) | Dicter la recherche | réglage | écran |  | 2 |  | champ-recherche-micro micro-ecoute=0 |
| (écran) | Voir en grille | réglage | écran |  | 2 |  | sb-vue-bascule=liste |
| (écran) | Outils des annonces | information | écran |  | 2 |  |  |
| (écran) | Toutes | réglage | écran |  | 2 |  | vue-toutes |
| (écran) | Sélectionner | réglage | écran |  | 2 |  | vue-selection=true |
| (écran) | Republier | réglage | écran |  | 2 |  | vue-republier actions-ouvrir |
| (écran) | Sans numéro | réglage | écran |  | 2 |  |  |
| (écran) | Sans achat relié 1024 | réglage | écran ↓ |  | 2 |  | vue-sans-achat=1024 |
| (écran) | À compléter 1024 | réglage | écran ↓ |  | 2 |  | vue-a-completer=1024 |
| (écran) | À relancer | réglage | écran ↓ |  | 2 |  | vue-relancer=855 |
| (écran) | Ouvrir sur Vinted : New Balance Campus 00s taille 45. · Ouvrir sur Vin | navigation | écran | 60 | 2 |  | fiche-photo=true |
| (écran) | N° 1419 · N° 1639 · N° 1859 | action | écran | 60 | 2 |  | edition=numero |
| (écran) | Relier un achat | action | écran | 60 | 2 |  | ann-relier=7600000219 |
| (écran) | Voir les 72 suivantes | navigation | écran ↓ |  | 2 |  |  |
| (écran) | Stock et ajustements | information | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  |  |
| (écran) | Titre & description prêts à coller | action | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  |  |
| (écran) | Publier Leboncoin 1024/1024 › | information | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | réglage | écran ↓ | 2 | 2 |  |  |
| (écran) | Données Voir le détail | information | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ | 6 | 2 |  |  |
| (écran) | Vendus ailleurs Vérifier | information | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  |  |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 2 |  | nav-entree=journee |
| (écran) | Annonces | navigation | barre du bas |  | 2 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 2 |  | nav-entree=achats |
| (écran) | 30 · 30 à faire Ventes · 30 à faire | navigation | barre du bas |  | 2 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 2 |  | nav-entree=compta |

## Annonces — 1512 px (56)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 2 |  | nav-entree=journee |
| (écran) | Ventes · 30 à faire · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 2 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 2 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 2 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 2 |  | nav-entree=communaute |
| (écran) | Fermer | navigation | barre du bas |  | 2 |  | acc-fermer |
| (écran) | Extension à installer | information | en-tête |  | 2 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 2 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 2 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 2 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 2 |  | recherche-photo-ouvrir |
| (écran) | Vinted · 1024 annonces | réglage | écran |  | 2 |  | site=vinted site-n=1024 |
| (écran) | Leboncoin | réglage | écran |  | 2 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 2 |  | site=ebay sans-compte |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Aide : Annonces | aide | écran |  | 2 |  | aide-ouvrir=annonces |
| (écran) | Publier | action | écran |  | 2 |  | v2-principal=publier |
| (écran) | Compte : Tous les comptes — changer | information | écran |  | 2 |  | ui-menu-compte=tous |
| (écran) | Ventes · mois : 37 37 Ventes · mois | action | écran |  | 2 |  | fu-case=ventes-mois carte-chiffre=ventes carte-p=mois carte-valeur=37 |
| (écran) | Vendu · mois : 2 274 € 2 274 € Vendu · mois | action | écran |  | 2 |  | fu-case=vendu-mois carte-chiffre=vendu carte-p=mois carte-valeur=22740 |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 2 |  | carte-modifier=annonces |
| (écran) | Rechercher une annonce (titre, marque, N°) | réglage | écran |  | 2 |  |  |
| (écran) | Dicter la recherche | réglage | écran |  | 2 |  | champ-recherche-micro micro-ecoute=0 |
| (écran) | Voir en grille | réglage | écran |  | 2 |  | sb-vue-bascule=liste |
| (écran) | Outils des annonces | information | écran |  | 2 |  |  |
| (écran) | Toutes | réglage | écran |  | 2 |  | vue-toutes |
| (écran) | Sélectionner | réglage | écran |  | 2 |  | vue-selection=true |
| (écran) | Republier | réglage | écran |  | 2 |  | vue-republier actions-ouvrir |
| (écran) | Sans numéro | réglage | écran |  | 2 |  |  |
| (écran) | Sans achat relié 1024 | réglage | écran |  | 2 |  | vue-sans-achat=1024 |
| (écran) | À compléter 1024 | réglage | écran |  | 2 |  | vue-a-completer=1024 |
| (écran) | À relancer | réglage | écran |  | 2 |  | vue-relancer=855 |
| (écran) | Vérifier | action | écran |  | 2 |  | ann-prochain-geste-bouton |
| (écran) | Compléter | action | écran |  | 2 |  | ann-achats-completer |
| (écran) | 5 nouveaux N° Vérifier | information | écran |  | 2 |  | num-neufs-ouvrir=5 |
| (écran) | 30 numéros à vérifier | information | écran |  | 2 |  |  |
| (écran) | Pourquoi vérifier | aide | écran |  | 2 |  |  |
| (écran) | C'est bien le N°1232 · Corriger · C'est bien le N°1233 | action | écran | 60 | 2 |  |  |
| (écran) | Numéro écrit sur l'étiquette de Salomon Air Max 1 taille 38 · Numéro é | réglage | écran | 30 | 2 |  |  |
| (écran) | Ouvrir sur Vinted : New Balance Campus 00s taille 45. · Ouvrir sur Vin | navigation | écran ↓ | 60 | 2 |  | fiche-photo=true |
| (écran) | N° 1419 · N° 1639 · N° 1859 | action | écran ↓ | 60 | 2 |  | edition=numero |
| (écran) | Relier un achat | action | écran ↓ | 60 | 2 |  | ann-relier=7600000219 |
| (écran) | Voir les 72 suivantes | navigation | écran ↓ |  | 2 |  |  |
| (écran) | Stock et ajustements | information | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  |  |
| (écran) | Titre & description prêts à coller | action | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  |  |
| (écran) | Publier aussi ailleurs Leboncoin 1024/1024 › | information | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | réglage | écran ↓ | 2 | 2 |  |  |
| (écran) | Données Voir le détail | information | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ | 6 | 2 |  |  |
| (écran) | Vendus ailleurs Vérifier | information | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  |  |

## Annonces › Republier — 390 px (56)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 3 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 3 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 3 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Aide : Annonces | aide | écran |  | 3 |  | aide-ouvrir=annonces |
| (écran) | Annonces 24 | réglage | écran |  | 3 |  | nav-entree=annonces paires-segment=annonces badge-nav=annonces badge-n |
| (écran) | Stock | réglage | écran |  | 3 |  | nav-entree=garage paires-segment=garage |
| (écran) | Publier | action | écran |  | 3 |  | v2-principal=publier |
| (écran) | Vinted · 1024 annonces | réglage | écran |  | 3 |  | site=vinted site-n=1024 |
| (écran) | Leboncoin | réglage | écran |  | 3 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 3 |  | site=ebay sans-compte |
| (écran) | Compte : Tous les comptes — changer | information | écran |  | 3 |  | ui-menu-compte=tous |
| (écran) | Ventes · mois : 37 37 Ventes · mois | action | écran |  | 3 |  | fu-case=ventes-mois carte-chiffre=ventes carte-p=mois carte-valeur=37 |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 3 |  | carte-modifier=annonces |
| (écran) | À faire · 2 | information | écran |  | 3 |  | ui-afaire=2 |
| (écran) | Rechercher une annonce (titre, marque, N°) | réglage | écran |  | 3 |  |  |
| (écran) | Dicter la recherche | réglage | écran |  | 3 |  | champ-recherche-micro micro-ecoute=0 |
| (écran) | Voir en grille | réglage | écran |  | 3 |  | sb-vue-bascule=liste |
| (écran) | Outils des annonces | information | écran |  | 3 |  |  |
| (écran) | Toutes | réglage | écran |  | 3 |  | vue-toutes |
| (écran) | Sélectionner | réglage | écran |  | 3 |  | vue-selection=true |
| (écran) | Republier | réglage | écran |  | 3 |  | vue-republier actions-ouvrir |
| (écran) | Sans numéro | réglage | écran |  | 3 |  |  |
| (écran) | Sans achat relié 1024 | réglage | écran ↓ |  | 3 |  | vue-sans-achat=1024 |
| (écran) | À compléter 1024 | réglage | écran ↓ |  | 3 |  | vue-a-completer=1024 |
| (écran) | À relancer | réglage | écran ↓ |  | 3 |  | vue-relancer=855 |
| (écran) | Tout cocher (146) | action | écran |  | 3 |  | qr-tout=146 |
| (écran) | 30 j · ≤ 1 favori · ≤ 25 vues | information | écran |  | 3 |  |  |
| (écran) | *(sans nom)* | réglage | écran | 3 | 3 |  | qr-jours-choix=30 |
| (écran) | *(sans nom)* | réglage | écran | 4 | 3 |  | qr-fav-choix=0 |
| (écran) | *(sans nom)* | réglage | écran | 4 | 3 |  | qr-vues-choix=10 |
| (écran) | N°1415Vans 550 taille 41 216 j en ligne · 0 favori · 25 vues vendeur_1 | réglage | écran |  | 3 |  | qr-ligne=3150000000:7600000215 qr-coche=0 qr-age=216 qr-vues=25 |
| (écran) | N°1855Adidas 550 taille 41 216 j en ligne · 0 favori · 25 vues vendeur | réglage | écran |  | 3 |  | qr-ligne=3150000000:7600000655 qr-coche=0 qr-age=216 qr-vues=25 |
| (écran) | N°1411Adidas Spezial taille 37 212 j en ligne · 1 favori · 21 vues ven | réglage | écran |  | 3 |  | qr-ligne=3150000000:7600000211 qr-coche=0 qr-age=212 qr-vues=21 |
| (écran) | N°1851New Balance Spezial taille 37 212 j en ligne · 1 favori · 21 vue | réglage | écran |  | 3 |  | qr-ligne=3150000000:7600000651 qr-coche=0 qr-age=212 qr-vues=21 |
| (écran) | N°1410Nike Samba OG taille 36 211 j en ligne · 0 favori · 20 vues vend | réglage | écran ↓ |  | 3 |  | qr-ligne=3150000000:7600000210 qr-coche=0 qr-age=211 qr-vues=20 |
| (écran) | Voir les 146 | information | écran ↓ |  | 3 |  | qr-plus |
| (écran) | Tout cocher | action | écran ↓ | 3 | 3 |  | selection-compte-cocher=3150000000 |
| (écran) | Sélectionner Nike Samba OG taille 36 · Sélectionner Adidas Spezial tai | réglage | écran ↓ | 1024 | 3 |  |  |
| (écran) | Stock et ajustements | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 3 |  |  |
| (écran) | Titre & description prêts à coller | action | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 3 |  |  |
| (écran) | Publier Leboncoin 1024/1024 › | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | réglage | écran ↓ | 2 | 3 |  |  |
| (écran) | Données Voir le détail | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ | 6 | 3 |  |  |
| (écran) | Vendus ailleurs Vérifier | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 3 |  |  |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 3 |  | nav-entree=journee |
| (écran) | Annonces | navigation | barre du bas |  | 3 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 3 |  | nav-entree=achats |
| (écran) | 30 · 30 à faire Ventes · 30 à faire | navigation | barre du bas |  | 3 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 3 |  | nav-entree=compta |

## Annonces › Republier — 1512 px (62)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 3 |  | nav-entree=journee |
| (écran) | Ventes · 30 à faire · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 3 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 3 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 3 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 3 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 3 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 3 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 3 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 3 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 3 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 3 |  | recherche-photo-ouvrir |
| (écran) | Vinted · 1024 annonces | réglage | écran |  | 3 |  | site=vinted site-n=1024 |
| (écran) | Leboncoin | réglage | écran |  | 3 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 3 |  | site=ebay sans-compte |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Aide : Annonces | aide | écran |  | 3 |  | aide-ouvrir=annonces |
| (écran) | Publier | action | écran |  | 3 |  | v2-principal=publier |
| (écran) | Compte : Tous les comptes — changer | information | écran |  | 3 |  | ui-menu-compte=tous |
| (écran) | Ventes · mois : 37 37 Ventes · mois | action | écran |  | 3 |  | fu-case=ventes-mois carte-chiffre=ventes carte-p=mois carte-valeur=37 |
| (écran) | Vendu · mois : 2 274 € 2 274 € Vendu · mois | action | écran |  | 3 |  | fu-case=vendu-mois carte-chiffre=vendu carte-p=mois carte-valeur=22740 |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 3 |  | carte-modifier=annonces |
| (écran) | Rechercher une annonce (titre, marque, N°) | réglage | écran |  | 3 |  |  |
| (écran) | Dicter la recherche | réglage | écran |  | 3 |  | champ-recherche-micro micro-ecoute=0 |
| (écran) | Voir en grille | réglage | écran |  | 3 |  | sb-vue-bascule=liste |
| (écran) | Outils des annonces | information | écran |  | 3 |  |  |
| (écran) | Toutes | réglage | écran |  | 3 |  | vue-toutes |
| (écran) | Sélectionner | réglage | écran |  | 3 |  | vue-selection=true |
| (écran) | Republier | réglage | écran |  | 3 |  | vue-republier actions-ouvrir |
| (écran) | Sans numéro | réglage | écran |  | 3 |  |  |
| (écran) | Sans achat relié 1024 | réglage | écran |  | 3 |  | vue-sans-achat=1024 |
| (écran) | À compléter 1024 | réglage | écran |  | 3 |  | vue-a-completer=1024 |
| (écran) | À relancer | réglage | écran |  | 3 |  | vue-relancer=855 |
| (écran) | 5 nouveaux N° Vérifier | information | écran |  | 3 |  | num-neufs-ouvrir=5 |
| (écran) | 30 numéros à vérifier | information | écran |  | 3 |  |  |
| (écran) | Pourquoi vérifier | aide | écran |  | 3 |  |  |
| (écran) | C'est bien le N°1232 · Corriger · C'est bien le N°1233 | action | écran | 60 | 3 |  |  |
| (écran) | Numéro écrit sur l'étiquette de Salomon Air Max 1 taille 38 · Numéro é | réglage | écran | 30 | 3 |  |  |
| (écran) | Tout cocher (146) | action | écran ↓ |  | 3 |  | qr-tout=146 |
| (écran) | 30 j · ≤ 1 favori · ≤ 25 vues | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | réglage | écran ↓ | 3 | 3 |  | qr-jours-choix=30 |
| (écran) | *(sans nom)* | réglage | écran ↓ | 4 | 3 |  | qr-fav-choix=0 |
| (écran) | *(sans nom)* | réglage | écran ↓ | 4 | 3 |  | qr-vues-choix=10 |
| (écran) | N°1415Vans 550 taille 41 216 j en ligne · 0 favori · 25 vues vendeur_1 | réglage | écran ↓ |  | 3 |  | qr-ligne=3150000000:7600000215 qr-coche=0 qr-age=216 qr-vues=25 |
| (écran) | N°1855Adidas 550 taille 41 216 j en ligne · 0 favori · 25 vues vendeur | réglage | écran ↓ |  | 3 |  | qr-ligne=3150000000:7600000655 qr-coche=0 qr-age=216 qr-vues=25 |
| (écran) | N°1411Adidas Spezial taille 37 212 j en ligne · 1 favori · 21 vues ven | réglage | écran ↓ |  | 3 |  | qr-ligne=3150000000:7600000211 qr-coche=0 qr-age=212 qr-vues=21 |
| (écran) | N°1851New Balance Spezial taille 37 212 j en ligne · 1 favori · 21 vue | réglage | écran ↓ |  | 3 |  | qr-ligne=3150000000:7600000651 qr-coche=0 qr-age=212 qr-vues=21 |
| (écran) | N°1410Nike Samba OG taille 36 211 j en ligne · 0 favori · 20 vues vend | réglage | écran ↓ |  | 3 |  | qr-ligne=3150000000:7600000210 qr-coche=0 qr-age=211 qr-vues=20 |
| (écran) | Voir les 146 | information | écran ↓ |  | 3 |  | qr-plus |
| (écran) | Tout cocher | action | écran ↓ | 3 | 3 |  | selection-compte-cocher=3150000000 |
| (écran) | Sélectionner Nike Samba OG taille 36 · Sélectionner Adidas Spezial tai | réglage | écran ↓ | 1024 | 3 |  |  |
| (écran) | Stock et ajustements | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 3 |  |  |
| (écran) | Titre & description prêts à coller | action | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 3 |  |  |
| (écran) | Publier aussi ailleurs Leboncoin 1024/1024 › | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | réglage | écran ↓ | 2 | 3 |  |  |
| (écran) | Données Voir le détail | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ | 6 | 3 |  |  |
| (écran) | Vendus ailleurs Vérifier | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 3 |  |  |

## Stock — 390 px (31)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 3 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 3 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 3 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Annonces 24 | réglage | écran |  | 3 |  | nav-entree=annonces paires-segment=annonces badge-nav=annonces badge-n |
| (écran) | Stock | réglage | écran |  | 3 |  | nav-entree=garage paires-segment=garage |
| (écran) | Aide : Stock | aide | écran |  | 3 |  | aide-ouvrir=garage |
| (écran) | Trouver par photo | action | écran |  | 3 |  | stock-recherche-photo |
| (écran) | Faire l’inventaire | action | écran |  | 3 |  | stock-inventaire-ouvrir |
| (écran) | Pas tout lu | information | écran |  | 3 |  | popup-ouvrir=stock-resume popup-chip=stock-resume |
| (écran) | 24 sans N° | information | écran |  | 3 |  | popup-chip=stock-resume |
| (écran) | Compte : Tous les comptes — changer | information | écran |  | 3 |  | ui-menu-compte=tous stock-filtre-compte=tous |
| (écran) | Retrouver un article dans le stock | réglage | écran |  | 3 |  |  |
| (écran) | Chercher à la voix (« numéro 12 », « nike noire ») | réglage | écran |  | 3 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | À faire · 1 | information | écran |  | 3 |  | ui-afaire=1 stock-afaire=1 |
| (écran) | Ajouter une note privée au N°1200 · Ajouter une note privée au N°1201  | action | écran ↓ | 36 | 3 |  | note-paire=ajout note-num=1200 |
| (écran) | Ranger › | action | écran ↓ | 2 | 3 |  | stock-annonce-geste=ranger |
| (écran) | *(sans nom)* | action | écran ↓ | 34 | 3 |  | stock-annonce-geste=ranger |
| (écran) | Voir plus — 60 sur 1024 | navigation | écran ↓ |  | 3 |  | stock-liste-plus |
| (écran) | Ranger l’article N°1200 · Nike Samba OG taille 36 · Ranger l’article N | réglage | écran ↓ | 60 | 3 |  | a-ranger=1200 paire-a-ranger=1200 paire-plateformes=vinted paire-aussi |
| (écran) | + Ajouter un meuble | action | écran ↓ |  | 3 |  | creer-meuble |
| (écran) | Aujourd'hui · 10 N° à vérifier 0 sur 10 vérifiés | information | écran ↓ |  | 3 |  |  |
| (écran) | Ajouter | action | écran ↓ |  | 3 |  | emb-ajouter |
| (écran) | Inventaire de fin d’année › | action | écran ↓ |  | 3 |  | ia-ouvrir |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 3 |  | nav-entree=journee |
| (écran) | Annonces | navigation | barre du bas |  | 3 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 3 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 3 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 3 |  | nav-entree=compta |

## Stock — 1512 px (33)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 2 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 2 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 2 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 2 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 2 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 2 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 2 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 2 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 2 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 2 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Aide : Stock | aide | écran |  | 2 |  | aide-ouvrir=garage |
| (écran) | Trouver par photo | action | écran |  | 2 |  | stock-recherche-photo |
| (écran) | Faire l’inventaire | action | écran |  | 2 |  | stock-inventaire-ouvrir |
| (écran) | Pas tout lu | information | écran |  | 2 |  | popup-ouvrir=stock-resume popup-chip=stock-resume |
| (écran) | 24 sans N° | information | écran |  | 2 |  | popup-chip=stock-resume |
| (écran) | Comment c’est compté | aide | écran |  | 2 |  | popup-chip=stock-resume |
| (écran) | Compte : Tous les comptes — changer | information | écran |  | 2 |  | ui-menu-compte=tous stock-filtre-compte=tous |
| (écran) | Retrouver un article dans le stock | réglage | écran |  | 2 |  |  |
| (écran) | Chercher à la voix (« numéro 12 », « nike noire ») | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | À faire · 1 | information | écran |  | 2 |  | ui-afaire=1 stock-afaire=1 |
| (écran) | Ajouter une note privée au N°1200 · Ajouter une note privée au N°1201  | action | écran ↓ | 36 | 2 |  | note-paire=ajout note-num=1200 |
| (écran) | Ranger › | action | écran ↓ | 8 | 2 |  | stock-annonce-geste=ranger |
| (écran) | *(sans nom)* | action | écran ↓ | 28 | 2 |  | stock-annonce-geste=ranger |
| (écran) | Voir plus — 60 sur 1024 | navigation | écran ↓ |  | 2 |  | stock-liste-plus |
| (écran) | Ranger l’article N°1200 · Nike Samba OG taille 36 · Ranger l’article N | réglage | écran ↓ | 60 | 2 |  | a-ranger=1200 paire-a-ranger=1200 paire-plateformes=vinted paire-aussi |
| (écran) | + Ajouter un meuble | action | écran ↓ |  | 2 |  | creer-meuble |
| (écran) | Aujourd'hui · 10 N° à vérifier 0 sur 10 vérifiés | information | écran ↓ |  | 2 |  |  |
| (écran) | Ajouter | action | écran ↓ |  | 2 |  | emb-ajouter |
| (écran) | Inventaire de fin d’année › | action | écran ↓ |  | 2 |  | ia-ouvrir |

## Achats — 390 px (47)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Fermer | navigation | barre du bas |  | 2 |  | acc-fermer |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 2 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 2 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 2 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Aide : Achats | aide | écran |  | 2 |  | aide-ouvrir=achats |
| (écran) | Retrouver un colis | action | écran |  | 2 |  | scan-retrouver-bouton=achats |
| (écran) | Vinted | réglage | écran |  | 2 |  | site=vinted |
| (écran) | Leboncoin | réglage | écran |  | 2 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 2 |  | site=ebay sans-compte |
| (écran) | À retirer + 60 à vérifier › | information | écran |  | 2 |  | retirer-n=0 retirer-presse=0 |
| (écran) | Tous | réglage | écran |  | 2 |  | compte-puce=* actif=1 |
| (écran) | vendeur_1 | réglage | écran |  | 2 |  | compte-puce=3150000000 actif=0 |
| (écran) | vendeur_2 | réglage | écran |  | 2 |  | compte-puce=3150001111 actif=0 |
| (écran) | vendeur_3 | réglage | écran |  | 2 |  | compte-puce=3150002222 actif=0 |
| (écran) | Relier achats et ventes | action | écran |  | 2 |  | glisser-ouvrir=achats |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 2 |  | carte-modifier=achats |
| (écran) | D’où viennent ces chiffres ? | action | écran |  | 2 |  | carte-aide=achats |
| (écran) | À retirer : 0 0 À retirer | action | écran |  | 2 |  | fu-case=retirer carte-chiffre=retirer carte-p carte-valeur=0 |
| (écran) | En route 60 | réglage | écran |  | 2 |  | achats-onglet=route n=60 |
| (écran) | Arrivés 120 | réglage | écran |  | 2 |  | achats-onglet=recus n=120 |
| (écran) | Annulés | réglage | écran |  | 2 |  | achats-onglet=annules n=0 |
| (écran) | Tous | réglage | écran |  | 2 |  | achats-onglet=all |
| (écran) | Sélectionner | action | écran |  | 2 |  | serie-ouvrir=achats |
| (écran) | Plus : fournisseurs, délai, lots | information | écran |  | 2 |  | achats-plus=ferme |
| (écran) | Rechercher un achat | réglage | écran |  | 2 |  |  |
| (écran) | Chercher à la voix (« numéro 124 », « chemise bleue ») | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Toute la période | information | écran |  | 2 |  | periode-ouvrir=true periode-valeur |
| (écran) | Calculette | action | écran |  | 2 |  | achats-calculette |
| (écran) | Plus d’actions pour cet achat | action | écran | 60 | 2 |  |  |
| (écran) | Voir plus — 60 affichés sur 240 | navigation | écran ↓ |  | 2 |  |  |
| (écran) | Achetés, pas en ligne 198 à confirmer › | action | écran ↓ |  | 2 |  | pel-entree=0 |
| (écran) | Achats hors plateforme Brocante, fournisseur, main propre… | action | écran ↓ |  | 2 |  | achats-hors-entete=true |
| (écran) | Ajouter un achat hors plateforme | action | écran ↓ |  | 2 |  | achat-hors-ajouter=true |
| (écran) | Vinted — › 5 040 € Investi 0 revendu sur 240 achetés · 240 articles pa | action | écran ↓ |  | 2 |  | ms-source=vinted ms-rang=1 ms-benefice ms-delai |
| (écran) | Comment c'est calculé | aide | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | achats-carnet |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | achats-recherche=0 |
| (écran) | Reçus d’achat par e-mail · 0 | information | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  |  |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 2 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 2 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 2 |  | nav-entree=achats |
| (écran) | 30 · 30 à faire Ventes · 30 à faire | navigation | barre du bas |  | 2 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 2 |  | nav-entree=compta |

## Achats — 1512 px (50)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 2 |  | nav-entree=journee |
| (écran) | Ventes · 30 à faire · Annonces · Messages · nouveau | navigation | colonne | 7 | 2 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 2 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 2 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 2 |  | nav-entree=communaute |
| (écran) | Fermer | navigation | barre du bas |  | 2 |  | acc-fermer |
| (écran) | Extension à installer | information | en-tête |  | 2 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 2 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 |
| (écran) | Rechercher une paire | réglage | écran |  | 2 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 2 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 2 |  | recherche-photo-ouvrir |
| (écran) | Vinted | réglage | écran |  | 2 |  | site=vinted |
| (écran) | Leboncoin | réglage | écran |  | 2 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 2 |  | site=ebay sans-compte |
| (écran) | Aide : Achats | aide | écran |  | 2 |  | aide-ouvrir=achats |
| (écran) | Retrouver un colis | action | écran |  | 2 |  | scan-retrouver-bouton=achats |
| (écran) | À retirer + 60 à vérifier › | information | écran |  | 2 |  | retirer-n=0 retirer-presse=0 |
| (écran) | Tous | réglage | écran |  | 2 |  | compte-puce=* actif=1 |
| (écran) | vendeur_1 | réglage | écran |  | 2 |  | compte-puce=3150000000 actif=0 |
| (écran) | vendeur_2 | réglage | écran |  | 2 |  | compte-puce=3150001111 actif=0 |
| (écran) | vendeur_3 | réglage | écran |  | 2 |  | compte-puce=3150002222 actif=0 |
| (écran) | Relier achats et ventes | action | écran |  | 2 |  | glisser-ouvrir=achats |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 2 |  | carte-modifier=achats |
| (écran) | D’où viennent ces chiffres ? | action | écran |  | 2 |  | carte-aide=achats |
| (écran) | À retirer : 0 0 À retirer | action | écran |  | 2 |  | fu-case=retirer carte-chiffre=retirer carte-p carte-valeur=0 |
| (écran) | En route 60 | réglage | écran |  | 2 |  | achats-onglet=route n=60 |
| (écran) | Arrivés 120 | réglage | écran |  | 2 |  | achats-onglet=recus n=120 |
| (écran) | Annulés | réglage | écran |  | 2 |  | achats-onglet=annules n=0 |
| (écran) | Tous | réglage | écran |  | 2 |  | achats-onglet=all |
| (écran) | Sélectionner | action | écran |  | 2 |  | serie-ouvrir=achats |
| (écran) | Plus : fournisseurs, délai, lots | information | écran |  | 2 |  | achats-plus=ferme |
| (écran) | Rechercher un achat | réglage | écran |  | 2 |  |  |
| (écran) | Chercher à la voix (« numéro 124 », « chemise bleue ») | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Toute la période | information | écran |  | 2 |  | periode-ouvrir=true periode-valeur |
| (écran) | Calculette | action | écran |  | 2 |  | achats-calculette |
| (écran) | Sélectionner Nike achat 0 · Sélectionner Adidas achat 1 · Sélectionner | réglage | écran | 60 | 2 |  |  |
| (écran) | Plus d’actions pour cet achat | action | écran | 60 | 2 |  |  |
| (écran) | Voir plus — 60 affichés sur 240 | navigation | écran ↓ |  | 2 |  |  |
| (écran) | Achetés, pas en ligne 198 à confirmer › | action | écran ↓ |  | 2 |  | pel-entree=0 |
| (écran) | Achats hors plateforme Brocante, fournisseur, main propre… | action | écran ↓ |  | 2 |  | achats-hors-entete=true |
| (écran) | Ajouter un achat hors plateforme | action | écran ↓ |  | 2 |  | achat-hors-ajouter=true |
| (écran) | Vinted — › 5 040 € Investi 0 revendu sur 240 achetés · 240 articles pa | action | écran ↓ |  | 2 |  | ms-source=vinted ms-rang=1 ms-benefice ms-delai |
| (écran) | Comment c'est calculé | aide | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | achats-carnet |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | achats-recherche=0 |
| (écran) | Reçus d’achat par e-mail · 0 | information | écran ↓ |  | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  |  |

## Ventes — 390 px (37)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Fermer | navigation | barre du bas |  | 2 |  | acc-fermer |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 2 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 2 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 2 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Aide : Ventes | aide | écran |  | 2 |  | aide-ouvrir=ventes |
| (écran) | Retrouver un colis | action | écran |  | 2 |  | scan-retrouver-bouton=ventes |
| (écran) | Tous les sites | réglage | écran |  | 2 |  | site=toutes |
| (écran) | Vinted | réglage | écran |  | 2 |  | site=vinted |
| (écran) | Leboncoin | réglage | écran |  | 2 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 2 |  | site=ebay sans-compte |
| (écran) | À envoyer 30 | réglage | écran |  | 2 |  | ventes-seg-choix=envoyer colis-onglet-choix=envoyer colis-onglet-n=30 |
| (écran) | En route 18 | réglage | écran |  | 2 |  | ventes-seg-choix=envoyes colis-onglet-choix=envoyes colis-onglet-n=18 |
| (écran) | Toutes | réglage | écran |  | 2 |  | ventes-seg-choix=toutes |
| (écran) | Scanner un bordereau | action | écran |  | 2 |  | colis-barre-btn=scanner colis-scanner scan-mode-bouton=envoi |
| (écran) | Outils des colis : emballer, générer les bordereaux | information | écran |  | 2 |  | colis-barre-btn=outils colis-outils-bascule |
| (écran) | Choisir la vente | action | écran | 14 | 2 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  |  |
| (écran) | Format Classique · A4 | action | écran ↓ |  | 2 |  | impr-format=normale |
| (écran) | Imprimer les 6 bordereaux | action | écran ↓ |  | 2 |  | colis-barre-btn=imprimer imprimer-prets=6 impr-lot=6 vv-coches=6 |
| (écran) | N°2284 attend son bordereau · N°2285 attend son bordereau · + 22 autre | action | écran ↓ |  | 2 |  | lot-ouvrir=1 impr-autres=9 |
| (écran) | Où sont ces articles dans le stock | action | écran ↓ |  | 2 |  | colis-stock=30 |
| (écran) | Les voir | action | écran ↓ |  | 2 |  | bords-faits-voir |
| (écran) | À envoyer : 30 30 À envoyer | action | écran ↓ |  | 2 |  | fu-case=aposter carte-chiffre=aposter carte-p carte-valeur=30 |
| (écran) | Modifier les chiffres de la carte | action | écran ↓ |  | 2 |  | carte-modifier=ventes-toutes |
| (écran) | Litiges et retours | action | écran ↓ |  | 2 |  | entree-litiges |
| (écran) | À venir 60 ventes · Vinted (3 comptes) 30 à envoyer · 30 en route 3 63 | action | écran ↓ |  | 2 |  | a-venir-ouvrir |
| (écran) | Vestiaire : pas encore lu › | information | écran ↓ |  | 2 |  |  |
| (écran) | Nike samba taille 37 — Vinted, vendeur_1, hier, Vendue, 25 € · Nike sa | action | écran ↓ | 60 | 2 |  | toutes-vente=vinted toutes-id=22000000000 toutes-compte=vendeur_1 ordr |
| (écran) | Afficher les 60 suivantes | action | écran ↓ |  | 2 |  | toutes-plus |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 2 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 2 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 2 |  | nav-entree=achats |
| (écran) | 30 · 30 à faire Ventes · 30 à faire | navigation | barre du bas |  | 2 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 2 |  | nav-entree=compta |

## Ventes — 1512 px (39)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 2 |  | nav-entree=journee |
| (écran) | Ventes · 30 à faire · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 2 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 2 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 2 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 2 |  | nav-entree=communaute |
| (écran) | Fermer | navigation | barre du bas |  | 2 |  | acc-fermer |
| (écran) | Extension à installer | information | en-tête |  | 2 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 2 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 2 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 2 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 2 |  | recherche-photo-ouvrir |
| (écran) | Tous les sites | réglage | écran |  | 2 |  | site=toutes |
| (écran) | Vinted | réglage | écran |  | 2 |  | site=vinted |
| (écran) | Leboncoin | réglage | écran |  | 2 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 2 |  | site=ebay sans-compte |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Aide : Ventes | aide | écran |  | 2 |  | aide-ouvrir=ventes |
| (écran) | Retrouver un colis | action | écran |  | 2 |  | scan-retrouver-bouton=ventes |
| (écran) | À envoyer 30 | réglage | écran |  | 2 |  | ventes-seg-choix=envoyer colis-onglet-choix=envoyer colis-onglet-n=30 |
| (écran) | En route 18 | réglage | écran |  | 2 |  | ventes-seg-choix=envoyes colis-onglet-choix=envoyes colis-onglet-n=18 |
| (écran) | Toutes | réglage | écran |  | 2 |  | ventes-seg-choix=toutes |
| (écran) | Scanner un bordereau | action | écran |  | 2 |  | colis-barre-btn=scanner colis-scanner scan-mode-bouton=envoi |
| (écran) | Outils des colis : emballer, générer les bordereaux | information | écran |  | 2 |  | colis-barre-btn=outils colis-outils-bascule |
| (écran) | Choisir la vente | action | écran | 15 | 2 |  |  |
| (écran) | Format Classique · A4 | action | écran ↓ |  | 2 |  | impr-format=normale |
| (écran) | Imprimer les 6 bordereaux | action | écran ↓ |  | 2 |  | colis-barre-btn=imprimer imprimer-prets=6 impr-lot=6 vv-coches=6 |
| (écran) | N°2284 attend son bordereau · N°2285 attend son bordereau · + 22 autre | action | écran ↓ |  | 2 |  | lot-ouvrir=1 impr-autres=9 |
| (écran) | Où sont ces articles dans le stock | action | écran ↓ |  | 2 |  | colis-stock=30 |
| (écran) | Les voir | action | écran ↓ |  | 2 |  | bords-faits-voir |
| (écran) | À envoyer : 30 30 À envoyer | action | écran ↓ |  | 2 |  | fu-case=aposter carte-chiffre=aposter carte-p carte-valeur=30 |
| (écran) | Modifier les chiffres de la carte | action | écran ↓ |  | 2 |  | carte-modifier=ventes-toutes |
| (écran) | Litiges et retours | action | écran ↓ |  | 2 |  | entree-litiges |
| (écran) | À venir 60 ventes · Vinted (3 comptes) 30 à envoyer · 30 en route 3 63 | action | écran ↓ |  | 2 |  | a-venir-ouvrir |
| (écran) | Vestiaire : pas encore lu › | information | écran ↓ |  | 2 |  |  |
| (écran) | Nike samba taille 37 — Vinted, vendeur_1, hier, Vendue, 25 € · Nike sa | action | écran ↓ | 60 | 2 |  | toutes-vente=vinted toutes-id=22000000000 toutes-compte=vendeur_1 ordr |
| (écran) | Afficher les 60 suivantes | action | écran ↓ |  | 2 |  | toutes-plus |

## Ventes › Litiges en cours — 390 px (11)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 3 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 3 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 3 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 3 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 3 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 3 |  | nav-entree=achats |
| (écran) | 30 · 30 à faire Ventes · 30 à faire | navigation | barre du bas |  | 3 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 3 |  | nav-entree=compta |

## Ventes › Litiges en cours — 1512 px (14)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 3 |  | nav-entree=journee |
| (écran) | Ventes · 30 à faire · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 3 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 3 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 3 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 3 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 3 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 3 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 3 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 3 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 3 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 3 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |

## Argent › Résumé — 390 px (36)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 2 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 2 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 2 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Aide : Comptabilité | aide | écran |  | 2 |  | aide-ouvrir=compta |
| (écran) | Résumé | action | écran |  | 2 |  | section=resume |
| (écran) | Statistiques | action | écran |  | 2 |  | section=stats |
| (écran) | Déclarer | action | écran |  | 2 |  | section=declarer |
| (écran) | Factures | action | écran |  | 2 |  | section=factures |
| (écran) | Ouvrir Ventes | navigation | écran |  | 2 |  |  |
| (écran) | Vendu en nov. 2 274 € vendu en novembre · 37 ventes | action | écran |  | 2 |  | argent-q=vendu argent-valeur=227400 |
| (écran) | Reçu — ouvre Ventes | action | écran |  | 2 |  | argent-q=recu argent-valeur argent-raison=absente |
| (écran) | Bénéfice — pas calculé | action | écran |  | 2 |  | argent-q=benefice argent-valeur argent-raison=publication |
| (écran) | URSSAF choisis ton statut — | action | écran |  | 2 |  | argent-q=declarer argent-valeur argent-raison=statut |
| (écran) | À venir 3 630 € À envoyer 1 770 € En route 1 860 € | action | écran |  | 2 |  | a-venir-ouvrir |
| (écran) | Ton bénéfice · Vendu et reçu · Bilan du mois | information | écran | 8 | 2 |  |  |
| (écran) | *(sans nom)* | navigation | écran |  | 2 |  |  |
| (écran) | *(sans nom)* | réglage | écran ↓ | 4 | 2 |  | ca-choix=semaine |
| (écran) | *(sans nom)* | réglage | écran ↓ | 2 | 2 |  | bilan-choix=courant |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | bilan-regime |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | bilan-pdf |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | bilan-csv |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | bilan-comptable=2026-11 |
| (écran) | Mois du rapport | réglage | écran ↓ |  | 2 |  | rapport-choix |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | rapport-creer |
| (écran) | *(sans nom)* | information | écran ↓ |  | 2 |  | dep-ouvrir |
| (écran) | *(sans nom)* | information | écran ↓ | 3 | 2 |  |  |
| (écran) | *(sans nom)* | information | écran ↓ |  | 2 |  | abo-ouvrir |
| (écran) | *(sans nom)* | information | écran ↓ |  | 2 |  | pack-ouvrir |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 2 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 2 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 2 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 2 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 2 |  | nav-entree=compta |

## Argent › Résumé — 1512 px (41)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 2 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 2 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 2 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 2 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 2 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 2 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 2 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 2 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 2 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 2 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Aide : Comptabilité | aide | écran |  | 2 |  | aide-ouvrir=compta |
| (écran) | Résumé | action | écran |  | 2 |  | section=resume |
| (écran) | Statistiques | action | écran |  | 2 |  | section=stats |
| (écran) | Déclarer | action | écran |  | 2 |  | section=declarer |
| (écran) | Factures | action | écran |  | 2 |  | section=factures |
| (écran) | Ouvrir Ventes | navigation | écran |  | 2 |  |  |
| (écran) | Vendu en nov. 2 274 € vendu en novembre · 37 ventes | action | écran |  | 2 |  | argent-q=vendu argent-valeur=227400 |
| (écran) | Reçu — ouvre Ventes | action | écran |  | 2 |  | argent-q=recu argent-valeur argent-raison=absente |
| (écran) | Bénéfice — pas calculé | action | écran |  | 2 |  | argent-q=benefice argent-valeur argent-raison=publication |
| (écran) | URSSAF choisis ton statut — | action | écran |  | 2 |  | argent-q=declarer argent-valeur argent-raison=statut |
| (écran) | À venir 3 630 € | action | écran |  | 2 |  | a-venir-ouvrir |
| (écran) | À envoyer 1 770 € +27 autres | information | écran |  | 2 |  |  |
| (écran) | En route 1 860 € +27 autres | information | écran |  | 2 |  |  |
| (écran) | Ton bénéfice · Vendu et reçu · Bilan du mois | information | écran | 8 | 2 |  |  |
| (écran) | *(sans nom)* | navigation | écran |  | 2 |  |  |
| (écran) | *(sans nom)* | réglage | écran | 4 | 2 |  | ca-choix=semaine |
| (écran) | *(sans nom)* | réglage | écran | 2 | 2 |  | bilan-choix=courant |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | bilan-regime |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | bilan-pdf |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | bilan-csv |
| (écran) | *(sans nom)* | action | écran ↓ |  | 2 |  | bilan-comptable=2026-11 |
| (écran) | Mois du rapport | réglage | écran |  | 2 |  | rapport-choix |
| (écran) | *(sans nom)* | action | écran |  | 2 |  | rapport-creer |
| (écran) | *(sans nom)* | information | écran ↓ |  | 2 |  | dep-ouvrir |
| (écran) | *(sans nom)* | information | écran ↓ | 3 | 2 |  |  |
| (écran) | *(sans nom)* | information | écran ↓ |  | 2 |  | abo-ouvrir |
| (écran) | *(sans nom)* | information | écran ↓ |  | 2 |  | pack-ouvrir |

## Argent › Statistiques — 390 px (56)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 3 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 3 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 3 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Aide : Statistiques | aide | écran |  | 3 |  | aide-ouvrir=dashboard |
| (écran) | Résumé | action | écran |  | 3 |  | section=resume |
| (écran) | Statistiques | action | écran |  | 3 |  | section=stats |
| (écran) | Déclarer | action | écran |  | 3 |  | section=declarer |
| (écran) | Factures | action | écran |  | 3 |  | section=factures |
| (écran) | Mes ventes | action | écran |  | 3 |  | section=stats |
| (écran) | Prix qui marche | action | écran |  | 3 |  | section=prix |
| (écran) | Semaine | réglage | écran |  | 3 |  | sv-choix=semaine |
| (écran) | Mois | réglage | écran |  | 3 |  | sv-choix=mois |
| (écran) | Année | réglage | écran |  | 3 |  | sv-choix=annee |
| (écran) | Fixer | action | écran |  | 3 |  | objectif-modifier |
| (écran) | Plus de chiffres | information | écran ↓ |  | 3 |  |  |
| (écran) | 28/09 : vendu 690 €, reçu — · 05/10 : vendu 855 €, reçu — · 12/10 : ve | réglage | écran ↓ | 8 | 3 |  | sp-vr-col=0 |
| (écran) | Pourquoi ? | aide | écran ↓ |  | 3 |  |  |
| (écran) | Meilleur mois : 3 765 € — voir le détail | action | écran ↓ |  | 3 |  | sp-record=mois sp-record-k=2026-10 sp-record-v=376500 |
| (écran) | Meilleure semaine : 1 065 € — voir le détail | action | écran ↓ |  | 3 |  | sp-record=semaine sp-record-v=106500 |
| (écran) | Premier compte vendeur_2 vendeur_1 vendeur_3 | réglage | écran ↓ |  | 3 |  | sp-cmp-choix=0 |
| (écran) | Second compte vendeur_2 vendeur_1 vendeur_3 | réglage | écran ↓ |  | 3 |  | sp-cmp-choix=1 |
| (écran) | 30 j | réglage | écran ↓ |  | 3 |  | cv-choix=j30 |
| (écran) | 90 j | réglage | écran ↓ |  | 3 |  | cv-choix=j90 |
| (écran) | Année | réglage | écran ↓ |  | 3 |  | cv-choix=annee |
| (écran) | Voir | navigation | écran ↓ | 3 | 3 |  | sc-geste=?tab=stats |
| (écran) | Pourquoi ? | aide | écran ↓ | 3 | 3 |  | sc-pourquoi |
| (écran) | vendeur_1 2/14 · 14,3 % | information | écran ↓ |  | 3 |  |  |
| (écran) | vendeur_3 2/14 · 14,3 % | information | écran ↓ |  | 3 |  |  |
| (écran) | vendeur_2 2/15 · 13,3 % | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | navigation | écran ↓ | 6 | 3 |  | sv-annul-vente=22000000005 |
| (écran) | Semaine du 31 août : 585 €, 6 ventes · Semaine du 7 septembre : 793 €, | réglage | écran ↓ | 12 | 3 |  | sante-semaine=0 eur=58500 |
| (écran) | Ma semaine › | action | écran ↓ |  | 3 |  | ouvre-ma-semaine |
| (écran) | Premier mois | réglage | écran ↓ |  | 3 |  | comparer-mois=a |
| (écran) | Mois comparé | réglage | écran ↓ |  | 3 |  | comparer-mois=b |
| (écran) | Sur la période | réglage | écran ↓ |  | 3 |  | cout-vue-choix=periode |
| (écran) | Mois par mois | réglage | écran ↓ |  | 3 |  | cout-vue-choix=mois |
| (écran) | Monde | réglage | écran ↓ |  | 3 |  | cv-vue-choix=monde |
| (écran) | France | réglage | écran ↓ |  | 3 |  | cv-vue-choix=france |
| (écran) | 12 mois | réglage | écran ↓ |  | 3 |  | cv-periode=12m |
| (écran) | 2026 | réglage | écran ↓ |  | 3 |  | cv-periode=2026 |
| (écran) | 2025 | réglage | écran ↓ |  | 3 |  | cv-periode=2025 |
| (écran) | Tout | réglage | écran ↓ |  | 3 |  | cv-periode=tout |
| (écran) | Comment c’est calculé ⌄ | aide | écran ↓ |  | 3 |  | cv-comment |
| (écran) | Je veux toucher | réglage | écran ↓ |  | 3 |  | pv-net |
| (écran) | Comment c’est calculé | aide | écran ↓ |  | 3 |  |  |
| (écran) | Vérifier mes prix | action | écran ↓ |  | 3 |  | ecarts-ouvrir |
| (écran) | L’argent depuis le début | information | écran ↓ |  | 3 |  |  |
| (écran) | Ce qui se vend, ton rythme, le stock qui dort | information | écran ↓ |  | 3 |  |  |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 3 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 3 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 3 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 3 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 3 |  | nav-entree=compta |

## Argent › Statistiques — 1512 px (59)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 3 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 3 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 3 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 3 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 3 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 3 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 3 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 3 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 3 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 3 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 3 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Aide : Statistiques | aide | écran |  | 3 |  | aide-ouvrir=dashboard |
| (écran) | Résumé | action | écran |  | 3 |  | section=resume |
| (écran) | Statistiques | action | écran |  | 3 |  | section=stats |
| (écran) | Déclarer | action | écran |  | 3 |  | section=declarer |
| (écran) | Factures | action | écran |  | 3 |  | section=factures |
| (écran) | Mes ventes | action | écran |  | 3 |  | section=stats |
| (écran) | Prix qui marche | action | écran |  | 3 |  | section=prix |
| (écran) | Semaine | réglage | écran |  | 3 |  | sv-choix=semaine |
| (écran) | Mois | réglage | écran |  | 3 |  | sv-choix=mois |
| (écran) | Année | réglage | écran |  | 3 |  | sv-choix=annee |
| (écran) | Fixer | action | écran |  | 3 |  | objectif-modifier |
| (écran) | Plus de chiffres | information | écran |  | 3 |  |  |
| (écran) | 28/09 : vendu 690 €, reçu — · 05/10 : vendu 855 €, reçu — · 12/10 : ve | réglage | écran | 8 | 3 |  | sp-vr-col=0 |
| (écran) | Pourquoi ? | aide | écran |  | 3 |  |  |
| (écran) | Meilleur mois : 3 765 € — voir le détail | action | écran ↓ |  | 3 |  | sp-record=mois sp-record-k=2026-10 sp-record-v=376500 |
| (écran) | Meilleure semaine : 1 065 € — voir le détail | action | écran ↓ |  | 3 |  | sp-record=semaine sp-record-v=106500 |
| (écran) | Premier compte vendeur_2 vendeur_1 vendeur_3 | réglage | écran ↓ |  | 3 |  | sp-cmp-choix=0 |
| (écran) | Second compte vendeur_2 vendeur_1 vendeur_3 | réglage | écran ↓ |  | 3 |  | sp-cmp-choix=1 |
| (écran) | 30 j | réglage | écran ↓ |  | 3 |  | cv-choix=j30 |
| (écran) | 90 j | réglage | écran ↓ |  | 3 |  | cv-choix=j90 |
| (écran) | Année | réglage | écran ↓ |  | 3 |  | cv-choix=annee |
| (écran) | Voir | navigation | écran ↓ | 3 | 3 |  | sc-geste=?tab=stats |
| (écran) | Pourquoi ? | aide | écran ↓ | 3 | 3 |  | sc-pourquoi |
| (écran) | vendeur_1 2/14 · 14,3 % | information | écran ↓ |  | 3 |  |  |
| (écran) | vendeur_3 2/14 · 14,3 % | information | écran ↓ |  | 3 |  |  |
| (écran) | vendeur_2 2/15 · 13,3 % | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | navigation | écran ↓ | 6 | 3 |  | sv-annul-vente=22000000005 |
| (écran) | Semaine du 31 août : 585 €, 6 ventes · Semaine du 7 septembre : 793 €, | réglage | écran ↓ | 12 | 3 |  | sante-semaine=0 eur=58500 |
| (écran) | Ma semaine › | action | écran ↓ |  | 3 |  | ouvre-ma-semaine |
| (écran) | Premier mois | réglage | écran ↓ |  | 3 |  | comparer-mois=a |
| (écran) | Mois comparé | réglage | écran ↓ |  | 3 |  | comparer-mois=b |
| (écran) | Sur la période | réglage | écran ↓ |  | 3 |  | cout-vue-choix=periode |
| (écran) | Mois par mois | réglage | écran ↓ |  | 3 |  | cout-vue-choix=mois |
| (écran) | Monde | réglage | écran ↓ |  | 3 |  | cv-vue-choix=monde |
| (écran) | France | réglage | écran ↓ |  | 3 |  | cv-vue-choix=france |
| (écran) | 12 mois | réglage | écran ↓ |  | 3 |  | cv-periode=12m |
| (écran) | 2026 | réglage | écran ↓ |  | 3 |  | cv-periode=2026 |
| (écran) | 2025 | réglage | écran ↓ |  | 3 |  | cv-periode=2025 |
| (écran) | Tout | réglage | écran ↓ |  | 3 |  | cv-periode=tout |
| (écran) | Comment c’est calculé ⌄ | aide | écran ↓ |  | 3 |  | cv-comment |
| (écran) | Je veux toucher | réglage | écran ↓ |  | 3 |  | pv-net |
| (écran) | Comment c’est calculé | aide | écran ↓ |  | 3 |  |  |
| (écran) | Vérifier mes prix | action | écran ↓ |  | 3 |  | ecarts-ouvrir |
| (écran) | L’argent depuis le début | information | écran ↓ |  | 3 |  |  |
| (écran) | Ce qui se vend, ton rythme, le stock qui dort | information | écran ↓ |  | 3 |  |  |

## Argent › Factures — 390 px (26)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 3 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 3 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 3 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | + Nouvelle facture | action | écran |  | 3 |  | vrm-tone=brand fac-principal |
| (écran) | Autres actions des factures | information | écran |  | 3 |  | fac-plus |
| (écran) | Résumé | action | écran |  | 3 |  | section=resume |
| (écran) | Statistiques | action | écran |  | 3 |  | section=stats |
| (écran) | Déclarer | action | écran |  | 3 |  | section=declarer |
| (écran) | Factures | action | écran |  | 3 |  | section=factures |
| (écran) | N° d’article ou date de vente... puis Entrée | réglage | écran |  | 3 |  |  |
| (écran) | Chercher *(inactif)* | information | écran |  | 3 |  | vrm-tone=custom |
| (écran) | En attente (0) | réglage | écran |  | 3 |  |  |
| (écran) | Comptabilisées (0) | réglage | écran |  | 3 |  |  |
| (écran) | Mois | réglage | écran |  | 3 |  | fe-mois=true |
| (écran) | Réessayer | action | écran |  | 3 |  |  |
| (écran) | Récapitulatif (tableur) | action | écran ↓ |  | 3 |  | fe-recap-csv=true |
| (écran) | Récapitulatif (fichier) | action | écran ↓ |  | 3 |  | fe-recap-json=true |
| (écran) | Facture *(inactif)* | information | écran ↓ | 25 | 3 |  | fe-facture=vinted:22000000264 |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 3 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 3 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 3 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 3 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 3 |  | nav-entree=compta |

## Argent › Factures — 1512 px (34)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 3 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 3 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 3 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 3 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 3 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 3 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 3 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 3 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 3 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 3 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 3 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | + Nouvelle facture | action | écran |  | 3 |  | vrm-tone=brand |
| (écran) | Relire les factures | action | écran |  | 3 |  | vrm-tone=custom |
| (écran) | Exporter Excel | action | écran |  | 3 |  | vrm-tone=custom |
| (écran) | Ma facture | information | écran |  | 3 |  | vrm-tone=custom |
| (écran) | Réglages des factures | action | écran |  | 3 |  | vrm-tone=custom |
| (écran) | Résumé | action | écran |  | 3 |  | section=resume |
| (écran) | Statistiques | action | écran |  | 3 |  | section=stats |
| (écran) | Déclarer | action | écran |  | 3 |  | section=declarer |
| (écran) | Factures | action | écran |  | 3 |  | section=factures |
| (écran) | N° d’article ou date de vente... puis Entrée | réglage | écran |  | 3 |  |  |
| (écran) | Chercher *(inactif)* | information | écran |  | 3 |  | vrm-tone=custom |
| (écran) | En attente (0) | réglage | écran |  | 3 |  |  |
| (écran) | Comptabilisées (0) | réglage | écran |  | 3 |  |  |
| (écran) | Mois | réglage | écran |  | 3 |  | fe-mois=true |
| (écran) | Réessayer | action | écran |  | 3 |  |  |
| (écran) | Pourquoi ? | aide | écran |  | 3 |  |  |
| (écran) | Récapitulatif (tableur) | action | écran |  | 3 |  | fe-recap-csv=true |
| (écran) | Récapitulatif (fichier) | action | écran |  | 3 |  | fe-recap-json=true |
| (écran) | Facture *(inactif)* | information | écran ↓ | 25 | 3 |  | fe-facture=vinted:22000000264 |
| (écran) | Fichier conforme ? | information | écran ↓ |  | 3 |  |  |

## Argent › Prix du marché — 390 px (18)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 4 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 4 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 4 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 4 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 4 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 4 |  | fraicheur-geste=version |
| (écran) | Résumé | action | écran |  | 4 |  | section=resume |
| (écran) | Statistiques | action | écran |  | 4 |  | section=stats |
| (écran) | Déclarer | action | écran |  | 4 |  | section=declarer |
| (écran) | Factures | action | écran |  | 4 |  | section=factures |
| (écran) | Mes ventes | action | écran |  | 4 |  | section=stats |
| (écran) | Prix qui marche | action | écran |  | 4 |  | section=prix |
| (écran) | ⓘ Pourquoi ? | aide | écran |  | 4 |  |  |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 4 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 4 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 4 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 4 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 4 |  | nav-entree=compta |

## Argent › Prix du marché — 1512 px (21)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 4 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 4 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 4 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 4 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 4 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 4 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 4 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 4 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 4 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 4 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 4 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 4 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 4 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 4 |  | fraicheur-geste=version |
| (écran) | Résumé | action | écran |  | 4 |  | section=resume |
| (écran) | Statistiques | action | écran |  | 4 |  | section=stats |
| (écran) | Déclarer | action | écran |  | 4 |  | section=declarer |
| (écran) | Factures | action | écran |  | 4 |  | section=factures |
| (écran) | Mes ventes | action | écran |  | 4 |  | section=stats |
| (écran) | Prix qui marche | action | écran |  | 4 |  | section=prix |
| (écran) | ⓘ Pourquoi ? | aide | écran |  | 4 |  |  |

## Messages — 390 px (27)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Fermer | navigation | barre du bas |  | 3 |  | acc-fermer |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 3 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 3 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 3 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Aide : Messages | aide | écran |  | 3 |  | aide-ouvrir=messages |
| (écran) | Tous les sites | réglage | écran |  | 3 |  | site=toutes |
| (écran) | Vinted | réglage | écran |  | 3 |  | site=vinted |
| (écran) | Leboncoin | réglage | écran |  | 3 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 3 |  | site=ebay sans-compte |
| (écran) | Acheteur, modèle ou N°… | réglage | écran |  | 3 |  | msg-recherche |
| (écran) | Toutes | réglage | écran |  | 3 |  | msg-vue=toutes |
| (écran) | Offres | réglage | écran |  | 3 |  | msg-vue=offres |
| (écran) | Non lues 13 | réglage | écran |  | 3 |  | msg-vue=nonlues |
| (écran) | Ouvrir le fil lea_sneakers | navigation | écran |  | 3 |  | fil=vinted:3150000000:51000000000 fil-convs=1 fil-sites=vinted fil-num |
| (écran) | Ouvrir le fil hugo.martin92 | navigation | écran |  | 3 |  | fil=vinted:3150000000:51000000003 fil-convs=1 fil-sites=vinted fil-num |
| (écran) | Ouvrir le fil manon_vintage_paris | navigation | écran |  | 3 |  | fil=vinted:3150000000:51000000006 fil-convs=1 fil-sites=vinted fil-num |
| (écran) | Ouvrir le fil emma_shop | navigation | écran |  | 3 |  | fil=vinted:3150000000:51000000012 fil-convs=1 fil-sites=vinted fil-num |
| (écran) | Ouvrir le fil gabriel.dubois | navigation | écran |  | 3 |  | fil=vinted:3150000000:51000000015 fil-convs=1 fil-sites=vinted fil-num |
| (écran) | Ouvrir le fil jules1307 · Ouvrir le fil lina_kicks_collector_officiel  | navigation | écran | 75 | 3 |  | fil=vinted:3150000000:51000000009 fil-convs=1 fil-sites=vinted fil-num |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 3 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 3 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 3 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 3 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 3 |  | nav-entree=compta |

## Messages — 1512 px (30)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 2 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 2 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 2 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 2 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 2 |  | nav-entree=communaute |
| (écran) | Fermer | navigation | barre du bas |  | 2 |  | acc-fermer |
| (écran) | Extension à installer | information | en-tête |  | 2 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 2 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 2 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 2 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 2 |  | recherche-photo-ouvrir |
| (écran) | Tous les sites | réglage | écran |  | 2 |  | site=toutes |
| (écran) | Vinted | réglage | écran |  | 2 |  | site=vinted |
| (écran) | Leboncoin | réglage | écran |  | 2 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 2 |  | site=ebay sans-compte |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Aide : Messages | aide | écran |  | 2 |  | aide-ouvrir=messages |
| (écran) | Acheteur, modèle ou N°… | réglage | écran |  | 2 |  | msg-recherche |
| (écran) | Toutes | réglage | écran |  | 2 |  | msg-vue=toutes |
| (écran) | Offres | réglage | écran |  | 2 |  | msg-vue=offres |
| (écran) | Non lues 13 | réglage | écran |  | 2 |  | msg-vue=nonlues |
| (écran) | Ouvrir le fil lea_sneakers | navigation | écran |  | 2 |  | fil=vinted:3150000000:51000000000 fil-convs=1 fil-sites=vinted fil-num |
| (écran) | Ouvrir le fil hugo.martin92 | navigation | écran |  | 2 |  | fil=vinted:3150000000:51000000003 fil-convs=1 fil-sites=vinted fil-num |
| (écran) | Ouvrir le fil manon_vintage_paris | navigation | écran |  | 2 |  | fil=vinted:3150000000:51000000006 fil-convs=1 fil-sites=vinted fil-num |
| (écran) | Ouvrir le fil emma_shop | navigation | écran |  | 2 |  | fil=vinted:3150000000:51000000012 fil-convs=1 fil-sites=vinted fil-num |
| (écran) | Ouvrir le fil gabriel.dubois | navigation | écran |  | 2 |  | fil=vinted:3150000000:51000000015 fil-convs=1 fil-sites=vinted fil-num |
| (écran) | Ouvrir le fil jules1307 · Ouvrir le fil lina_kicks_collector_officiel  | navigation | écran | 75 | 2 |  | fil=vinted:3150000000:51000000009 fil-convs=1 fil-sites=vinted fil-num |

## Messages › Favoris & offres — 390 px (34)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 4 |  | aller-contenu |
| (écran) | Fermer | navigation | barre du bas |  | 4 |  | acc-fermer |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 4 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 4 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 4 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 4 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 4 |  | fraicheur-geste=version |
| (écran) | Aide : Messages | aide | écran |  | 4 |  | aide-ouvrir=messages |
| (écran) | Tous les sites | réglage | écran |  | 4 |  | site=toutes |
| (écran) | Vinted | réglage | écran |  | 4 |  | site=vinted |
| (écran) | Leboncoin | réglage | écran |  | 4 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 4 |  | site=ebay sans-compte |
| (écran) | Tous | réglage | écran |  | 4 |  | compte-puce=* actif=1 |
| (écran) | vendeur_1 | réglage | écran |  | 4 |  | compte-puce=3150000000 actif=0 |
| (écran) | vendeur_2 | réglage | écran |  | 4 |  | compte-puce=3150001111 actif=0 |
| (écran) | vendeur_3 | réglage | écran |  | 4 |  | compte-puce=3150002222 actif=0 |
| (écran) | Conversations | réglage | écran |  | 4 |  | messages-zone=conversations |
| (écran) | Favoris & offres | réglage | écran |  | 4 |  | messages-zone=favoris |
| (écran) | Favoris | réglage | écran |  | 4 |  |  |
| (écran) | Offres auto | réglage | écran |  | 4 |  |  |
| (écran) | Assistance technique · favoris | information | écran |  | 4 |  |  |
| (écran) | *(sans nom)* *(inactif)* | information | écran ↓ |  | 4 |  |  |
| (écran) | Comptes Vinted · 3 comptes · 3 à vérifier | information | écran |  | 4 |  |  |
| (écran) | *(sans nom)* | action | écran | 3 | 4 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ | 3 | 4 |  |  |
| (écran) | *(sans nom)* | information | écran ↓ |  | 4 |  |  |
| (écran) | *(sans nom)* | navigation | écran ↓ |  | 4 |  |  |
| (écran) | Données Voir le détail | information | écran |  | 4 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ | 9 | 4 |  |  |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 4 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 4 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 4 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 4 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 4 |  | nav-entree=compta |

## Messages › Favoris & offres — 1512 px (46)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 3 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 3 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 3 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 3 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 3 |  | nav-entree=communaute |
| (écran) | Fermer | navigation | barre du bas |  | 3 |  | acc-fermer |
| (écran) | Extension à installer | information | en-tête |  | 3 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 3 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 3 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 3 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 3 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 3 |  | recherche-photo-ouvrir |
| (écran) | Tous les sites | réglage | écran |  | 3 |  | site=toutes |
| (écran) | Vinted | réglage | écran |  | 3 |  | site=vinted |
| (écran) | Leboncoin | réglage | écran |  | 3 |  | site=leboncoin sans-compte |
| (écran) | eBay | réglage | écran |  | 3 |  | site=ebay sans-compte |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Aide : Messages | aide | écran |  | 3 |  | aide-ouvrir=messages |
| (écran) | Tous | réglage | écran |  | 3 |  | compte-puce=* actif=1 |
| (écran) | vendeur_1 | réglage | écran |  | 3 |  | compte-puce=3150000000 actif=0 |
| (écran) | vendeur_2 | réglage | écran |  | 3 |  | compte-puce=3150001111 actif=0 |
| (écran) | vendeur_3 | réglage | écran |  | 3 |  | compte-puce=3150002222 actif=0 |
| (écran) | Conversations | réglage | écran |  | 3 |  | messages-zone=conversations |
| (écran) | Favoris & offres | réglage | écran |  | 3 |  | messages-zone=favoris |
| (écran) | Favoris | réglage | écran |  | 3 |  |  |
| (écran) | Offres auto | réglage | écran |  | 3 |  |  |
| (écran) | Assistance technique · favoris | information | écran |  | 3 |  |  |
| (écran) | *(sans nom)* *(inactif)* | information | écran |  | 3 |  |  |
| (écran) | Rechercher une conversation | réglage | écran |  | 3 |  |  |
| (écran) | Dicter la recherche | réglage | écran |  | 3 |  | champ-recherche-micro micro-ecoute=0 |
| (écran) | Toutes 1000 | réglage | écran |  | 3 |  |  |
| (écran) | Non lues 13 | réglage | écran |  | 3 |  |  |
| (écran) | À répondre | réglage | écran |  | 3 |  | a-repondre=0 |
| (écran) | Mettre à jour les conversations | action | écran |  | 3 |  |  |
| (écran) | lea_sneakers 15:14 Nike Samba OG taille 36 · N°1200 · vendeur_1 Questi | action | écran | 13 | 3 |  | conv=51000000000 cible=conv:51000000000 conv:3150000000:5100000 nonlu= |
| (écran) | thomas75 14:27 Adidas XT-6 taille 39 · N°1213 · vendeur_2 Question Toi | action | écran | 27 | 3 |  | conv=51000000001 cible=conv:51000000001 conv:3150001111:5100000 conv-n |
| (écran) | Afficher les 40 suivantes 40 sur 1000 | action | écran ↓ |  | 3 |  | pied-lien=suite |
| (écran) | Comptes Vinted · 3 comptes · 3 à vérifier | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ | 3 | 3 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ | 3 | 3 |  |  |
| (écran) | *(sans nom)* | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | navigation | écran ↓ |  | 3 |  |  |
| (écran) | Données Voir le détail | information | écran ↓ |  | 3 |  |  |
| (écran) | *(sans nom)* | action | écran ↓ | 9 | 3 |  |  |

## E-mails — 390 px (56)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 3 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 3 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 3 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Aide : E-mails | aide | écran |  | 3 |  | aide-ouvrir=emails |
| (écran) | Boîte de réception | réglage | écran |  | 3 |  | boite-vue=boite |
| (écran) | Relier ma boîte | réglage | écran |  | 3 |  | boite-vue=relier |
| (écran) | Chercher un e-mail | réglage | écran |  | 3 |  | boite-cherche-champ |
| (écran) | Tout 1000 | réglage | écran |  | 3 |  | boite-rubrique=tout |
| (écran) | Codes de retrait 143 | réglage | écran |  | 3 |  | boite-rubrique=codes |
| (écran) | Colis 429 | réglage | écran |  | 3 |  | boite-rubrique=colis |
| (écran) | Ventes 143 | réglage | écran |  | 3 |  | boite-rubrique=ventes |
| (écran) | Achats 143 | réglage | écran ↓ |  | 3 |  | boite-rubrique=achats |
| (écran) | Offres 143 | réglage | écran ↓ |  | 3 |  | boite-rubrique=offres |
| (écran) | Compte | réglage | écran |  | 3 |  | boite-adresse |
| (écran) | Sélectionner | action | écran |  | 3 |  | serie-ouvrir=emails |
| (écran) | Non lu. Colis à retirer · Relais Tabac du Port · code 300 000 · avant  | action | écran |  | 3 |  | boite-email=email_reception_00000eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Non lu. Colis à retirer · Relais Tabac du Port · code 355 433 · avant  | action | écran ↓ |  | 3 |  | boite-email=email_reception_00007eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Copier le code de retrait 300 000 | action | écran |  | 3 |  | boite-code-copier=300000 |
| (écran) | Copier le code de retrait 355 433 | action | écran ↓ |  | 3 |  | boite-code-copier=355433 |
| (écran) | Non lu. Vendu · Adidas Spezial · N°1201 · bordereau prêt. Vinted, seco | action | écran |  | 3 |  | boite-email=email_reception_00001eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Non lu. Vendu · Salomon Dunk Low Panda · N°1208 · bordereau prêt. Vint | action | écran ↓ |  | 3 |  | boite-email=email_reception_00008eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Non lu. Vendu · Salomon Air Max 1 · 42 € · N°1202. Vinted, troisieme_d | action | écran | 8 | 3 |  | boite-email=email_reception_00002eeeeeeeeeeeeeeeeeee rubrique=ventes e |
| (écran) | Non lu. Newsletter Vinted — rien à faire. Vinted, atelier_sneakers_par | action | écran |  | 3 |  | boite-email=email_reception_00006eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Non lu. Newsletter Vinted — rien à faire. Vinted, second_compte_vintag | action | écran ↓ |  | 3 |  | boite-email=email_reception_00013eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Colis à retirer · Relais Tabac du Port · code 410 866 · avant le 19 no | action | écran ↓ |  | 3 |  | boite-email=email_reception_00014eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Colis à retirer · Relais Tabac du Port · code 466 299 · avant le 19 no | action | écran ↓ |  | 3 |  | boite-email=email_reception_00021eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Colis à retirer · Relais Tabac du Port · code 521 732 · avant le 19 no | action | écran ↓ |  | 3 |  | boite-email=email_reception_00028eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Colis à retirer · Relais Tabac du Port · code 577 165 · avant le 19 no | action | écran ↓ |  | 3 |  | boite-email=email_reception_00035eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Colis à retirer · Relais Tabac du Port · code 632 598 · avant le 19 no | action | écran ↓ |  | 3 |  | boite-email=email_reception_00042eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Colis à retirer · Relais Tabac du Port · code 688 031 · avant le 19 no | action | écran ↓ |  | 3 |  | boite-email=email_reception_00049eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Copier le code de retrait 410 866 | action | écran ↓ |  | 3 |  | boite-code-copier=410866 |
| (écran) | Copier le code de retrait 466 299 | action | écran ↓ |  | 3 |  | boite-code-copier=466299 |
| (écran) | Copier le code de retrait 521 732 | action | écran ↓ |  | 3 |  | boite-code-copier=521732 |
| (écran) | Copier le code de retrait 577 165 | action | écran ↓ |  | 3 |  | boite-code-copier=577165 |
| (écran) | Copier le code de retrait 632 598 | action | écran ↓ |  | 3 |  | boite-code-copier=632598 |
| (écran) | Copier le code de retrait 688 031 | action | écran ↓ |  | 3 |  | boite-code-copier=688031 |
| (écran) | Vendu · New Balance 550 · N°1215 · bordereau prêt. Vinted, atelier_sne | action | écran ↓ |  | 3 |  | boite-email=email_reception_00015eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Vendu · Asics Air Max 1 · N°1222 · bordereau prêt. Vinted, second_comp | action | écran ↓ |  | 3 |  | boite-email=email_reception_00022eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Vendu · Vans Campus 00s · N°1229 · bordereau prêt. Vinted, troisieme_d | action | écran ↓ |  | 3 |  | boite-email=email_reception_00029eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Vendu · Nike Gel-1130 · N°1236 · bordereau prêt. Vinted, atelier_sneak | action | écran ↓ |  | 3 |  | boite-email=email_reception_00036eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Vendu · Adidas XT-6 · N°1243 · bordereau prêt. Vinted, second_compte_v | action | écran ↓ |  | 3 |  | boite-email=email_reception_00043eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Vendu · Asics Gel-1130 · 56 € · N°1216. Vinted, second_compte_vintage, | action | écran ↓ | 20 | 3 |  | boite-email=email_reception_00016eeeeeeeeeeeeeeeeeee rubrique=ventes e |
| (écran) | Newsletter Vinted — rien à faire. Vinted, troisieme_dressing_lyon69, 0 | action | écran ↓ |  | 3 |  | boite-email=email_reception_00020eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Newsletter Vinted — rien à faire. Vinted, atelier_sneakers_paris, 22:3 | action | écran ↓ |  | 3 |  | boite-email=email_reception_00027eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Newsletter Vinted — rien à faire. Vinted, second_compte_vintage, 18:14 | action | écran ↓ |  | 3 |  | boite-email=email_reception_00034eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Newsletter Vinted — rien à faire. Vinted, troisieme_dressing_lyon69, 1 | action | écran ↓ |  | 3 |  | boite-email=email_reception_00041eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Newsletter Vinted — rien à faire. Vinted, atelier_sneakers_paris, 09:3 | action | écran ↓ |  | 3 |  | boite-email=email_reception_00048eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Voir plus | navigation | écran ↓ |  | 3 |  | boite-plus |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 3 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 3 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 3 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 3 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 3 |  | nav-entree=compta |

## E-mails — 1512 px (59)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 2 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 2 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 2 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 2 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 2 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 2 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 2 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 2 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 2 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 2 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Aide : E-mails | aide | écran |  | 2 |  | aide-ouvrir=emails |
| (écran) | Boîte de réception | réglage | écran |  | 2 |  | boite-vue=boite |
| (écran) | Relier ma boîte | réglage | écran |  | 2 |  | boite-vue=relier |
| (écran) | Chercher un e-mail | réglage | écran |  | 2 |  | boite-cherche-champ |
| (écran) | Tout 1000 | réglage | écran |  | 2 |  | boite-rubrique=tout |
| (écran) | Codes de retrait 143 | réglage | écran |  | 2 |  | boite-rubrique=codes |
| (écran) | Colis 429 | réglage | écran |  | 2 |  | boite-rubrique=colis |
| (écran) | Ventes 143 | réglage | écran |  | 2 |  | boite-rubrique=ventes |
| (écran) | Achats 143 | réglage | écran |  | 2 |  | boite-rubrique=achats |
| (écran) | Offres 143 | réglage | écran |  | 2 |  | boite-rubrique=offres |
| (écran) | Compte | réglage | écran |  | 2 |  | boite-adresse |
| (écran) | Sélectionner | action | écran |  | 2 |  | serie-ouvrir=emails |
| (écran) | Non lu. Colis à retirer · Relais Tabac du Port · code 300 000 · avant  | action | écran |  | 2 |  | boite-email=email_reception_00000eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Non lu. Colis à retirer · Relais Tabac du Port · code 355 433 · avant  | action | écran |  | 2 |  | boite-email=email_reception_00007eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Copier le code de retrait 300 000 | action | écran |  | 2 |  | boite-code-copier=300000 |
| (écran) | Copier le code de retrait 355 433 | action | écran |  | 2 |  | boite-code-copier=355433 |
| (écran) | Non lu. Vendu · Adidas Spezial · N°1201 · bordereau prêt. Vinted, seco | action | écran |  | 2 |  | boite-email=email_reception_00001eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Non lu. Vendu · Salomon Dunk Low Panda · N°1208 · bordereau prêt. Vint | action | écran ↓ |  | 2 |  | boite-email=email_reception_00008eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Non lu. Vendu · Salomon Air Max 1 · 42 € · N°1202. Vinted, troisieme_d | action | écran | 8 | 2 |  | boite-email=email_reception_00002eeeeeeeeeeeeeeeeeee rubrique=ventes e |
| (écran) | Non lu. Newsletter Vinted — rien à faire. Vinted, atelier_sneakers_par | action | écran |  | 2 |  | boite-email=email_reception_00006eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Non lu. Newsletter Vinted — rien à faire. Vinted, second_compte_vintag | action | écran ↓ |  | 2 |  | boite-email=email_reception_00013eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Colis à retirer · Relais Tabac du Port · code 410 866 · avant le 19 no | action | écran ↓ |  | 2 |  | boite-email=email_reception_00014eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Colis à retirer · Relais Tabac du Port · code 466 299 · avant le 19 no | action | écran ↓ |  | 2 |  | boite-email=email_reception_00021eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Colis à retirer · Relais Tabac du Port · code 521 732 · avant le 19 no | action | écran ↓ |  | 2 |  | boite-email=email_reception_00028eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Colis à retirer · Relais Tabac du Port · code 577 165 · avant le 19 no | action | écran ↓ |  | 2 |  | boite-email=email_reception_00035eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Colis à retirer · Relais Tabac du Port · code 632 598 · avant le 19 no | action | écran ↓ |  | 2 |  | boite-email=email_reception_00042eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Colis à retirer · Relais Tabac du Port · code 688 031 · avant le 19 no | action | écran ↓ |  | 2 |  | boite-email=email_reception_00049eeeeeeeeeeeeeeeeeee rubrique=codes et |
| (écran) | Copier le code de retrait 410 866 | action | écran ↓ |  | 2 |  | boite-code-copier=410866 |
| (écran) | Copier le code de retrait 466 299 | action | écran ↓ |  | 2 |  | boite-code-copier=466299 |
| (écran) | Copier le code de retrait 521 732 | action | écran ↓ |  | 2 |  | boite-code-copier=521732 |
| (écran) | Copier le code de retrait 577 165 | action | écran ↓ |  | 2 |  | boite-code-copier=577165 |
| (écran) | Copier le code de retrait 632 598 | action | écran ↓ |  | 2 |  | boite-code-copier=632598 |
| (écran) | Copier le code de retrait 688 031 | action | écran ↓ |  | 2 |  | boite-code-copier=688031 |
| (écran) | Vendu · New Balance 550 · N°1215 · bordereau prêt. Vinted, atelier_sne | action | écran ↓ |  | 2 |  | boite-email=email_reception_00015eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Vendu · Asics Air Max 1 · N°1222 · bordereau prêt. Vinted, second_comp | action | écran ↓ |  | 2 |  | boite-email=email_reception_00022eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Vendu · Vans Campus 00s · N°1229 · bordereau prêt. Vinted, troisieme_d | action | écran ↓ |  | 2 |  | boite-email=email_reception_00029eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Vendu · Nike Gel-1130 · N°1236 · bordereau prêt. Vinted, atelier_sneak | action | écran ↓ |  | 2 |  | boite-email=email_reception_00036eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Vendu · Adidas XT-6 · N°1243 · bordereau prêt. Vinted, second_compte_v | action | écran ↓ |  | 2 |  | boite-email=email_reception_00043eeeeeeeeeeeeeeeeeee rubrique=colis et |
| (écran) | Vendu · Asics Gel-1130 · 56 € · N°1216. Vinted, second_compte_vintage, | action | écran ↓ | 20 | 2 |  | boite-email=email_reception_00016eeeeeeeeeeeeeeeeeee rubrique=ventes e |
| (écran) | Newsletter Vinted — rien à faire. Vinted, troisieme_dressing_lyon69, 0 | action | écran ↓ |  | 2 |  | boite-email=email_reception_00020eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Newsletter Vinted — rien à faire. Vinted, atelier_sneakers_paris, 22:3 | action | écran ↓ |  | 2 |  | boite-email=email_reception_00027eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Newsletter Vinted — rien à faire. Vinted, second_compte_vintage, 18:14 | action | écran ↓ |  | 2 |  | boite-email=email_reception_00034eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Newsletter Vinted — rien à faire. Vinted, troisieme_dressing_lyon69, 1 | action | écran ↓ |  | 2 |  | boite-email=email_reception_00041eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Newsletter Vinted — rien à faire. Vinted, atelier_sneakers_paris, 09:3 | action | écran ↓ |  | 2 |  | boite-email=email_reception_00048eeeeeeeeeeeeeeeeeee rubrique=autres e |
| (écran) | Voir plus | navigation | écran ↓ |  | 2 |  | boite-plus |

## Communauté — 390 px (13)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 3 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 3 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 3 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Aide : Communauté | aide | écran |  | 3 |  | aide-ouvrir=communaute |
| (écran) | Réessayer | action | écran |  | 3 |  | etat-panne-reessayer |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 3 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 3 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 3 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 3 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 3 |  | nav-entree=compta |

## Communauté — 1512 px (16)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 2 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 2 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 2 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 2 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 2 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 2 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 2 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 2 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 2 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 2 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Aide : Communauté | aide | écran |  | 2 |  | aide-ouvrir=communaute |
| (écran) | Réessayer | action | écran |  | 2 |  | etat-panne-reessayer |

## Paramètres — 390 px (17)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 3 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 3 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 3 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Aide : Réglages | aide | écran |  | 3 |  | aide-ouvrir=settings |
| (écran) | Rechercher dans les paramètres | réglage | écran |  | 3 |  |  |
| (écran) | Dicter la recherche | réglage | écran |  | 3 |  | champ-recherche-micro micro-ecoute=0 |
| (écran) | Tout va bien ? Pas tout à fait Extension à mettre à jour sur 1 apparei | action | écran |  | 3 |  | reglages-alerte=extension |
| (écran) | V Mon compte vendeur.exemple@exemple.test Pro | action | écran |  | 3 |  | categorie-ouvrir=compte vue=compte categorie-contient= prenom abonneme |
| (écran) | Mes plateformes Comptes, extension, boîte mail 3 comptes · Ventes et c | action | écran | 9 | 3 |  | categorie-ouvrir=plateformes categorie-contient= liens connexions veri |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 3 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 3 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 3 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 3 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 3 |  | nav-entree=compta |

## Paramètres — 1512 px (96)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 3 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 3 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 3 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 3 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 3 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 3 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 3 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 3 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 3 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 3 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 3 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 3 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 3 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 3 |  | fraicheur-geste=version |
| (écran) | Aide : Réglages | aide | écran |  | 3 |  | aide-ouvrir=settings |
| (écran) | Rechercher dans les paramètres | réglage | écran |  | 3 |  |  |
| (écran) | Dicter la recherche | réglage | écran |  | 3 |  | champ-recherche-micro micro-ecoute=0 |
| (écran) | Tout va bien ? Pas tout à fait Extension à mettre à jour sur 1 apparei | action | écran |  | 3 |  | reglages-alerte=extension |
| (écran) | Mon compte | action | écran |  | 3 |  | categorie-ouvrir=compte categorie-contient= prenom abonnement email mo |
| (écran) | Mes plateformes 3 comptes · Ventes et colis Normale · A4 · Stock et nu | action | écran | 9 | 3 |  | categorie-ouvrir=plateformes categorie-contient= liens connexions veri |
| (écran) | Activer | action | écran |  | 3 |  | carte-mfa-activer |
| (écran) | Plus tard | action | écran |  | 3 |  | carte-mfa-plus-tard |
| (écran) | Comment ? | aide | écran |  | 3 |  |  |
| (écran) | Ton prénom | réglage | écran |  | 3 |  |  |
| (écran) | Mon abonnement Ton offre, ta carte, tes factures, et l’arrêt si tu veu | navigation | écran |  | 3 |  | reglage-id=abonnement sous-ouvrir=abonnement reglage-abonnement vue=ab |
| (écran) | Changer mon e-mail | action | écran ↓ |  | 3 |  | reglage-id=email |
| (écran) | Changer mon mot de passe | action | écran ↓ |  | 3 |  | reglage-id=motdepasse |
| (écran) | Se déconnecter | action | écran ↓ |  | 3 |  | reglage-id=deconnexion |
| (écran) | Comptes liés Tes comptes Vinted, Leboncoin, Vestiaire et eBay : lesque | action | écran ↓ |  | 3 |  | reglage-id=liens |
| (écran) | Compléter les prix d'achat Les saisir à la suite : sans eux, le bénéfi | action | écran ↓ |  | 3 |  | reglage-id=prixachat |
| (écran) | Restaurer une sauvegarde Remettre VRM tel qu’il était dans une sauvega | action | écran ↓ |  | 3 |  | reglage-id=restaurer |
| (écran) | Double vérification Désactivée · Appareils connectés · Équipe Inviter  | aide | écran ↓ | 16 | 3 |  | reglage-id=double sous-ouvrir=double |
| (écran) | Code à l'ouverture 4 chiffres, sur cet appareil seulement. | navigation | écran ↓ |  | 3 |  | reglage-id=code-local sous-ouvrir=code-local reglage-code-local |
| (écran) | Connexion par QR Connecte un ordinateur avec cet iPhone. | navigation | écran ↓ |  | 3 |  | reglage-id=connexion-qr sous-ouvrir=connexion-qr reglage-connexion-qr |
| (écran) | Lien pour ton aide 24 h, colis seulement, sans compte. | aide | écran ↓ |  | 3 |  | reglage-id=lien-aide sous-ouvrir=lien-aide reglage-lien-aide |
| (écran) | Associer une adresse | action | écran ↓ |  | 3 |  |  |
| (écran) | Vérifier mon installation Extension, comptes, boîte e-mail : ce qui ma | navigation | écran ↓ |  | 3 |  | reglage-id=verifier sous-ouvrir=verifier reglage-verifier |
| (écran) | Mon historique Tes anciennes ventes et achats, site par site. | navigation | écran ↓ |  | 3 |  | reglage-id=historique sous-ouvrir=historique reglage-historique |
| (écran) | E-mails Relier ta boîte pour que VRM lise tes ventes, colis et codes d | navigation | écran ↓ |  | 3 |  | reglage-id=adresses reglage-emails sous-ouvrir=adresses |
| (écran) | Mon adresse VRM Une adresse à toi : tes e-mails Vinted y arrivent seul | action | écran ↓ |  | 3 |  | reglage-id=adresse-vrm reglage-adresse-vrm |
| (écran) | SMS de colis Transférer à VRM tes SMS Mondial Relay, Vinted Go et Pick | navigation | écran ↓ |  | 3 |  | reglage-id=sms-colis sous-ouvrir=sms-colis reglage-sms=aucun |
| (écran) | Carte de remerciement À imprimer et glisser dans le colis. | navigation | écran ↓ |  | 3 |  | reglage-id=carte-merci sous-ouvrir=carte-merci reglage-carte-merci |
| (écran) | Mes modèles Des textes prêts à insérer d’un geste dans une description | navigation | écran ↓ |  | 3 |  | reglage-id=modeles sous-ouvrir=modeles reglage-modeles |
| (écran) | Je vends Ce que tu vends : les mots et les exemples suivent. Sneakers | navigation | écran ↓ |  | 3 |  | reglage-id=je-vends sous-ouvrir=je-vends reglage-vends=sneakers |
| (écran) | Organisation | action | écran ↓ |  | 3 |  | reglage-organisation |
| (écran) | Statut Ton statut fiscal : il fixe le taux de tes cotisations URSSAF.  | navigation | écran ↓ |  | 3 |  | reglage-id=regime sous-ouvrir=regime reglage-regime=aucun |
| (écran) | Achats masqués Les achats que tu as retirés de la compta, à réafficher | action | écran ↓ |  | 3 |  | reglage-id=masques reglage-masques |
| (écran) | Objectif du mois Un montant de vendu à viser chaque mois : une barre f | navigation | écran ↓ |  | 3 |  | reglage-id=objectif-mois sous-ouvrir=objectif-mois reglage-objectif=au |
| (écran) | Rappels Ceux que tu as posés avec « Me le rappeler » : à 9 h le jour c | navigation | écran ↓ |  | 3 |  | reglage-id=rappels sous-ouvrir=rappels reglage-rappels |
| (écran) | Échéances dans l’agenda URSSAF, colis à déposer et à retirer, dans ton | navigation | écran ↓ |  | 3 |  | reglage-id=agenda sous-ouvrir=agenda reglage-agenda |
| (écran) | Alertes dans l'app | réglage | écran ↓ |  | 3 |  | reglage-alertes=off |
| (écran) | Dire ce que l’extension capte | réglage | écran ↓ |  | 3 |  | reglage-capte=on |
| (écran) | Langue La langue de VRM, la même sur tous tes appareils. Français | navigation | écran ↓ |  | 3 |  | reglage-id=langue sous-ouvrir=langue reglage-langue=fr |
| (écran) | Apparence Clair, sombre, comme l’appareil, ou sombre le soir. Clair | navigation | écran ↓ |  | 3 |  | reglage-id=apparence sous-ouvrir=apparence reglage-apparence=clair |
| (écran) | Mode sombre | réglage | écran ↓ |  | 3 |  | reglage-sombre=off |
| (écran) | Taille du texte Toute l’app grandit avec le texte. Propre à cet appare | navigation | écran ↓ |  | 3 |  | reglage-id=taille-texte sous-ouvrir=taille-texte reglage-taille-texte= |
| (écran) | Affichage Simple : seulement ce qui te sert déjà. Complet : tout. Comp | navigation | écran ↓ |  | 3 |  | reglage-id=affichage-mode sous-ouvrir=affichage-mode reglage-affichage |
| (écran) | Ma journée Montrer, cacher et ranger les cartes de Ma journée. | navigation | écran ↓ |  | 3 |  | reglage-id=ma-journee sous-ouvrir=ma-journee reglage-journee-perso |
| (écran) | Ma configuration Ventes, plateformes, statut, numéro, affichage : tout | action | écran ↓ |  | 3 |  | reglage-id=configuration reglage-configuration |
| (écran) | Écran d'atelier Plein écran allumé : colis du jour, chiffre du jour. | action | écran ↓ |  | 3 |  | reglage-id=atelier reglage-atelier |
| (écran) | Mode stream | réglage | écran ↓ |  | 3 |  | reglage-stream-on=off |
| (écran) | Ce que le stream cache Choisir les mots, marques et comptes à cacher. | navigation | écran ↓ |  | 3 |  | reglage-id=stream sous-ouvrir=stream reglage-stream=off |
| (écran) | Siri et Raccourcis Ajouter un achat ou trouver un N° en parlant à Siri | navigation | écran ↓ |  | 3 |  | reglage-id=raccourcis-siri sous-ouvrir=raccourcis-siri reglage-raccour |
| (écran) | Raccourcis clavier Sur ordinateur : « g » puis une lettre, « ? » pour  | action | écran ↓ |  | 3 |  | reglage-id=raccourcis-clavier reglage-raccourcis-clavier |
| (écran) | Sécurité des comptes Comme une personne : pas la nuit, pas en rafale,  | navigation | écran ↓ |  | 3 |  | reglage-id=securite-comptes sous-ouvrir=securite-comptes reglage-secur |
| (écran) | Discrétion Plafond par jour et freins de Vinted, compte par compte. | navigation | écran ↓ |  | 3 |  | reglage-id=discretion sous-ouvrir=discretion reglage-discretion |
| (écran) | Mode vacances Mettre tes comptes en pause pendant ton absence, puis ro | navigation | écran ↓ |  | 3 |  | reglage-id=vacances sous-ouvrir=vacances reglage-vacances |
| (écran) | Santé des comptes Pour chaque compte Vinted : note, envois, annulation | navigation | écran ↓ |  | 3 |  | reglage-id=santecomptes sous-ouvrir=santecomptes reglage-santecomptes |
| (écran) | Copie de mes annonces Télécharger un zip par compte : titres, prix, N° | navigation | écran ↓ |  | 3 |  | reglage-id=copieannonces sous-ouvrir=copieannonces reglage-copieannonc |
| (écran) | Tout va bien ? Chaque compte, sa dernière relecture et l’extension de  | navigation | écran ↓ |  | 3 |  | reglage-id=toutvabien sous-ouvrir=toutvabien reglage-toutvabien |
| (écran) | Santé de tes données Ce qui cloche (numéros, prix d’achat, ventes, e-m | navigation | écran ↓ |  | 3 |  | reglage-id=sante sous-ouvrir=sante reglage-sante |
| (écran) | État de VRM La base, les e-mails et les notifications fonctionnent-ils | action | écran ↓ |  | 3 |  | reglage-id=statut reglage-statut |
| (écran) | Centre d’aide Installer l’extension, relier ta boîte, les numéros, l’U | aide | écran ↓ |  | 3 |  | reglage-id=centre-aide reglage-centre-aide |
| (écran) | Écrire au support Ta question, avec la version de l’app et de l’extens | action | écran ↓ |  | 3 |  | reglage-id=support reglage-support |
| (écran) | Signaler un problème Dire ce qui ne va pas : tu vois tout ce qui part  | action | écran ↓ |  | 3 |  | reglage-id=signaler reglage-signaler |
| (écran) | Mes signalements Ce que tu as signalé, et la réponse | navigation | écran ↓ |  | 3 |  | reglage-id=mes-signalements sous-ouvrir=mes-signalements reglage-mes-s |
| (écran) | Quoi de neuf Les nouveautés de VRM qui te concernent. | navigation | écran ↓ |  | 3 |  | reglage-id=quoi-de-neuf sous-ouvrir=quoi-de-neuf reglage-quoi-de-neuf |
| (écran) | Revoir la visite Les onglets de VRM présentés un par un. | action | écran ↓ |  | 3 |  | reglage-id=visite reglage-visite |
| (écran) | Revoir mon bilan en une minute Ventes de l’année, colis, paires en lig | action | écran ↓ |  | 3 |  | reglage-id=bilan-minute reglage-bilan |
| (écran) | Revoir le premier colis Imprimer, coller, déposer, suivre. | action | écran ↓ |  | 3 |  | reglage-id=premier-colis reglage-premier-colis |
| (écran) | Visite, mots expliqués, conseil du jour Les aides des premiers jours,  | aide | écran ↓ |  | 3 |  | reglage-id=aides-accueil sous-ouvrir=aides-accueil reglage-aides-accue |
| (écran) | Conseils | réglage | écran ↓ |  | 3 |  | reglage-conseils=on |
| (écran) | Revoir les conseils Ceux que tu as passés ou masqués pourront revenir. | action | écran ↓ |  | 3 |  | reglage-id=conseils-revoir reglage-conseils-revoir |
| (écran) | Ton entreprise Vendeurs, abonnés, revenus, incidents et satisfaction — | navigation | écran ↓ |  | 3 |  | reglage-id=pilotage sous-ouvrir=pilotage reglage-pilotage |
| (écran) | Nouveaux comptes Ce que voit un nouvel inscrit, et où ils s’arrêtent | navigation | écran ↓ |  | 3 |  | reglage-id=nouveaux-comptes sous-ouvrir=nouveaux-comptes reglage-nouve |
| (écran) | Ouvrir les paiements Ce qui manque pour qu’un client puisse payer. | navigation | écran ↓ |  | 3 |  | reglage-id=paiements sous-ouvrir=paiements reglage-paiements |
| (écran) | Signalements reçus | navigation | écran ↓ |  | 3 |  | reglage-id=signalements sous-ouvrir=signalements reglage-signalements |
| (écran) | Demandes d’aide Les questions écrites au support par les vendeurs. | aide | écran ↓ |  | 3 |  | reglage-id=demandes-aide sous-ouvrir=demandes-aide reglage-demandes-ai |
| (écran) | Simuler une création de compte Le parcours d’un nouveau vendeur, sur d | navigation | écran ↓ |  | 3 |  | reglage-id=simulation-compte sous-ouvrir=simulation-compte reglage-sim |
| (écran) | Sécurité des données Vérifier que toi seul peux lire et écrire tes don | navigation | écran ↓ |  | 3 |  | reglage-id=securite sous-ouvrir=securite reglage-securite-donnees |
| (écran) | Sauvegarde complète Tout VRM (réglages, numéros, données) dans un fich | action | écran ↓ |  | 3 |  | reglage-id=export reglage-sauvegarde |
| (écran) | Revenir en arrière Après une fausse manip : voir ce qui changera, choi | navigation | écran ↓ |  | 3 |  | reglage-id=revenir sous-ouvrir=revenir reglage-revenir |
| (écran) | Corbeille Ce que tu as supprimé, à restaurer pendant 30 jours. | navigation | écran ↓ |  | 3 |  | reglage-id=corbeille sous-ouvrir=corbeille reglage-corbeille |
| (écran) | Importer Ton stock et tes ventes passées, depuis un tableur ou un autr | navigation | écran ↓ |  | 3 |  | reglage-id=importer sous-ouvrir=importer reglage-importer |
| (écran) | Exporter mes données Tes ventes, achats et annonces dans un fichier, p | action | écran ↓ |  | 3 |  | reglage-id=donnees exporter-donnees |
| (écran) | Confidentialité : ce que VRM lit et garde Par site, où c’est rangé, qu | navigation | écran ↓ |  | 3 |  | reglage-id=tes-donnees sous-ouvrir=tes-donnees reglage-tes-donnees |

## Paramètres › Comptes liés — 390 px (21)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 5 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 5 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 5 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 5 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 5 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 5 |  | fraicheur-geste=version |
| (écran) | ‹ Paramètres | navigation | écran |  | 5 |  |  |
| (écran) | Actualiser | action | écran |  | 5 |  |  |
| (écran) | Ouvrir | navigation | écran | 3 | 5 |  | compte-action=ouvrir |
| (écran) | Gérer | information | écran | 3 | 5 |  |  |
| (écran) | Nom affiché | réglage | écran | 3 | 5 |  |  |
| (écran) | E-mail du compte | réglage | écran | 3 | 5 |  |  |
| (écran) | Téléphone du compte | réglage | écran | 3 | 5 |  |  |
| (écran) | *(sans nom)* | action | écran | 3 | 5 |  |  |
| (écran) | Ouvrir | navigation | écran ↓ | 3 | 5 |  | compte-action=ouvrir |
| (écran) | Revoir l’accueil des comptes reliés | action | écran ↓ |  | 5 |  | comptes-relies-revoir |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 5 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 5 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 5 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 5 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 5 |  | nav-entree=compta |

## Paramètres › Comptes liés — 1512 px (24)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 5 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 5 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 5 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 5 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 5 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 5 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 5 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 5 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 5 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 5 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 5 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 5 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 5 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 5 |  | fraicheur-geste=version |
| (écran) | ‹ Paramètres | navigation | écran |  | 5 |  |  |
| (écran) | Actualiser | action | écran |  | 5 |  |  |
| (écran) | Ouvrir | navigation | écran | 3 | 5 |  | compte-action=ouvrir |
| (écran) | Gérer | information | écran | 3 | 5 |  |  |
| (écran) | Nom affiché | réglage | écran | 3 | 5 |  |  |
| (écran) | E-mail du compte | réglage | écran | 3 | 5 |  |  |
| (écran) | Téléphone du compte | réglage | écran | 3 | 5 |  |  |
| (écran) | *(sans nom)* | action | écran | 3 | 5 |  |  |
| (écran) | Ouvrir | navigation | écran ↓ | 3 | 5 |  | compte-action=ouvrir |
| (écran) | Revoir l’accueil des comptes reliés | action | écran ↓ |  | 5 |  | comptes-relies-revoir |

## Achats masqués — 390 px (11)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 4 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 4 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 4 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 4 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 4 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 4 |  | fraicheur-geste=version |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 4 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 4 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 4 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 4 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 4 |  | nav-entree=compta |

## Achats masqués — 1512 px (14)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 4 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 4 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 4 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 4 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 4 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 4 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 4 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 4 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 4 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 4 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 4 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 4 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 4 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 4 |  | fraicheur-geste=version |

## Organisation — 390 px (14)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 5 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 5 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 5 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 5 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 5 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 5 |  | fraicheur-geste=version |
| (écran) | Actualiser | action | écran |  | 5 |  |  |
| (écran) | Atelier · Missions · Réservations | action | écran | 8 | 5 |  |  |
| (écran) | Réessayer | action | écran |  | 5 |  |  |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 5 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 5 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 5 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 5 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 5 |  | nav-entree=compta |

## Organisation — 1512 px (17)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 5 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 5 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 5 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 5 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 5 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 5 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 5 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 5 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 5 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 5 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 5 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 5 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 5 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 5 |  | fraicheur-geste=version |
| (écran) | Actualiser | action | écran |  | 5 |  |  |
| (écran) | Atelier · Missions · Réservations | action | écran | 8 | 5 |  |  |
| (écran) | Réessayer | action | écran |  | 5 |  |  |

## À trancher — 390 px (58)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Fermer | navigation | en-tête |  | 2 |  | acc-fermer |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 2 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 2 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 2 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | +24 27 colis pressés — À vérifier sur Vinted — 27 colis pressés — le p | action | écran |  | 2 |  | plein=27 colis pressés — À vérifier sur Vinted job=colis-limite n=27 l |
| (écran) | Aide : Ma journée | aide | écran |  | 2 |  | aide-ouvrir=journee |
| (écran) | Vendredi 13 novembre · 2 ventes · 138 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-13 |
| (écran) | Samedi 14 novembre · 2 ventes · 127 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-14 |
| (écran) | Dimanche 15 novembre · 2 ventes · 116 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-15 |
| (écran) | Lundi 16 novembre · 3 ventes · 141 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-16 |
| (écran) | Mardi 17 novembre · 3 ventes · 108 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-17 |
| (écran) | Mercredi 18 novembre · 3 ventes · 75 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-18 |
| (écran) | Jeudi 19 novembre · aucune vente | réglage | écran |  | 2 |  | jv2-toucher=2026-11-19 |
| (écran) | Semaine du 9 nov. | réglage | écran |  | 2 |  | jv2-semaine=2026-11-09 |
| (écran) | Ma semaine › | action | écran |  | 2 |  | ouvre-ma-semaine |
| (écran) | Voir les ventes (3 ventes) | navigation | écran |  | 2 |  | jv2-pile=3 sans-visionneuse |
| (écran) | À envoyer : 30 | information | écran |  | 2 |  | sj-zone=envoyer |
| (écran) | Ventes | action | écran |  | 2 |  | sj-lien=ventes |
| (écran) | Imprimer les 15 bordereaux | action | écran |  | 2 |  | sj-imprimer=15 impr-total=15 fu-principal |
| (écran) | Messages : 13 | information | écran |  | 2 |  | sj-zone=messages |
| (écran) | Prix à baisser : 0 | information | écran ↓ |  | 2 |  | sj-zone=prix |
| (écran) | À retirer : 0 | information | écran |  | 2 |  | sj-zone=retirer |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 2 |  | carte-modifier=journee |
| (écran) | Bénéfice · mois : pas su, prix d’achat manquants — Bénéfice · mois pri | action | écran |  | 2 |  | fu-case=benefice-mois carte-chiffre=benefice carte-p=mois carte-valeur |
| (écran) | Vendu · mois : 2 274 € 2 274 € Vendu · mois | action | écran |  | 2 |  | fu-case=vendu-mois carte-chiffre=vendu carte-p=mois carte-valeur=22740 |
| (écran) | Reçu · mois : 1 596 € 1 596 € Reçu · mois | action | écran |  | 2 |  | fu-case=recu-mois carte-chiffre=recu carte-p=mois carte-valeur=159600 |
| (écran) | À venir 60 ventes · Vinted (3 comptes) 30 à envoyer · 30 en route 3 63 | action | écran ↓ |  | 2 |  | a-venir-ouvrir |
| (écran) | À ce rythme, novembre finira vers 3 650 € estimation › | action | écran ↓ |  | 2 |  | argent-plus=prevision-ligne prev-etat=ok prev-jours=18 prev-centre=365 |
| (écran) | Offre aux favoris *(inactif)* | information | écran ↓ | 5 | 2 |  | rf-geste=favoris |
| (écran) | 146 annonces anciennes et peu vues — En ligne depuis 30 j ou plus : tu | action | écran ↓ |  | 2 |  | plein=146 annonces anciennes et peu vues — En  job=quoi-republier n=14 |
| (écran) | +21 24 nouveaux articles numérotés · N°2323, 2324, 2325, 2326, 2327 +1 | action | écran ↓ |  | 2 |  | plein=24 nouveaux articles numérotés · N°2323, job=numeros-nouveaux n= |
| (écran) | 1024 annonces numérotées sans prix d’achat — Saisis le prix ou relie l | action | écran ↓ |  | 2 |  | plein=1024 annonces numérotées sans prix d’ach job=achat-a-relier n=10 |
| (écran) | 855 articles en ligne depuis 30 j ou plus — Republier, préparer ailleu | action | écran ↓ |  | 2 |  | plein=855 articles en ligne depuis 30 j ou plu job=paires-dorment n=85 |
| (écran) | Colis à vérifier — Vérifie leur suivi avant d’y aller — 60 délais dépa | action | écran ↓ |  | 2 |  | plein=Colis à vérifier — Vérifie leur suivi av job=retrait-a-verifier  |
| (écran) | Tout va bien ? · 2 points › | action | écran ↓ |  | 2 |  | tvb-ligne=2 |
| (écran) | Modifier ma journée | action | écran ↓ |  | 2 |  | jp-modifier |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 2 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 2 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 2 |  | nav-entree=achats |
| (écran) | 30 · 30 à faire Ventes · 30 à faire | navigation | barre du bas |  | 2 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 2 |  | nav-entree=compta |
| (écran) | Fermer | navigation | feuille |  | 2 |  | feuille-croix |
| (écran) | +27 Au moins 30 choses à trancher — Numéros — Au moins 30 choses à tra | information | feuille |  | 2 |  | job=a-trancher n=30 plein=Au moins 30 choses à trancher — Numéros |
| (écran) | Vérifier | action | feuille | 3 | 2 |  | role=ouvrir ton=geste a-trancher-geste=numeros-a-verifier a-trancher-o |
| (écran) | Saisir | action | feuille ↓ | 3 | 2 |  | role=ouvrir ton=geste a-trancher-geste=achats-sans-prix a-trancher-ouv |
| (écran) | + 27 | action | feuille ↓ |  | 2 |  | a-trancher-autres=27 |
| (écran) | + 1021 | action | feuille ↓ |  | 2 |  | a-trancher-autres=1021 |
| (écran) | Voir | navigation | feuille ↓ |  | 2 |  | role=ouvrir ton=geste a-trancher-geste=colis-retirer a-trancher-ouvrir |
| (écran) | Litiges et retours en cours Ouvre Litiges — | action | feuille ↓ |  | 2 |  |  |
| (écran) | Ventes Vestiaire reçues par SMS Ouvre Ventes — | action | feuille ↓ |  | 2 |  |  |
| (écran) | Colis Pickup reçus par SMS Ouvre Achats — | action | feuille ↓ |  | 2 |  |  |
| (écran) | Achats saisis deux fois Ouvre Achats — | action | feuille ↓ |  | 2 |  |  |
| (écran) | Adresses e-mail sans compte Ouvre E-mails — | action | feuille ↓ |  | 2 |  |  |
| (écran) | 3 comptes à surveiller — vendeur_1 : 3 ventes annulées (30 j) · vendeu | action | feuille ↓ |  | 2 |  | journee-sante=3150000000 3150001111 3150002222 n=3 sc-geste=?tab=setti |
| (écran) | Tout voir dans Paramètres › | navigation | feuille ↓ |  | 2 |  | tvb-parametres |

## À trancher — 1512 px (59)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 2 |  | nav-entree=journee |
| (écran) | Ventes · 30 à faire · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 2 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 2 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 2 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 2 |  | nav-entree=communaute |
| (écran) | Fermer | navigation | barre du bas |  | 2 |  | acc-fermer |
| (écran) | Extension à installer | information | en-tête |  | 2 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 2 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 |
| (écran) | Rechercher une paire | réglage | écran |  | 2 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 2 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 2 |  | recherche-photo-ouvrir |
| (écran) | +24 27 colis pressés — À vérifier sur Vinted — 27 colis pressés — le p | action | écran |  | 2 |  | plein=27 colis pressés — À vérifier sur Vinted job=colis-limite n=27 l |
| (écran) | Aide : Ma journée | aide | écran |  | 2 |  | aide-ouvrir=journee |
| (écran) | Vendredi 13 novembre · 2 ventes · 138 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-13 |
| (écran) | Samedi 14 novembre · 2 ventes · 127 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-14 |
| (écran) | Dimanche 15 novembre · 2 ventes · 116 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-15 |
| (écran) | Lundi 16 novembre · 3 ventes · 141 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-16 |
| (écran) | Mardi 17 novembre · 3 ventes · 108 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-17 |
| (écran) | Mercredi 18 novembre · 3 ventes · 75 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-18 |
| (écran) | Jeudi 19 novembre · aucune vente | réglage | écran |  | 2 |  | jv2-toucher=2026-11-19 |
| (écran) | Semaine du 9 nov. | réglage | écran |  | 2 |  | jv2-semaine=2026-11-09 |
| (écran) | Ma semaine › | action | écran |  | 2 |  | ouvre-ma-semaine |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 2 |  | carte-modifier=journee |
| (écran) | Bénéfice · mois : pas su, prix d’achat manquants — Bénéfice · mois pri | action | écran |  | 2 |  | fu-case=benefice-mois carte-chiffre=benefice carte-p=mois carte-valeur |
| (écran) | Vendu · mois : 2 274 € 2 274 € Vendu · mois | action | écran |  | 2 |  | fu-case=vendu-mois carte-chiffre=vendu carte-p=mois carte-valeur=22740 |
| (écran) | Reçu · mois : 1 596 € 1 596 € Reçu · mois | action | écran |  | 2 |  | fu-case=recu-mois carte-chiffre=recu carte-p=mois carte-valeur=159600 |
| (écran) | À envoyer : 30 | information | écran |  | 2 |  | sj-zone=envoyer |
| (écran) | Ventes | action | écran |  | 2 |  | sj-lien=ventes |
| (écran) | Imprimer les 15 bordereaux | action | écran |  | 2 |  | sj-imprimer=15 impr-total=15 fu-principal |
| (écran) | Prix à baisser : 0 | information | écran |  | 2 |  | sj-zone=prix |
| (écran) | Messages : 13 | information | écran |  | 2 |  | sj-zone=messages |
| (écran) | À retirer : 0 | information | écran |  | 2 |  | sj-zone=retirer |
| (écran) | Offre aux favoris *(inactif)* | information | écran | 5 | 2 |  | rf-geste=favoris |
| (écran) | 146 annonces anciennes et peu vues — En ligne depuis 30 j ou plus : tu | action | écran ↓ |  | 2 |  | plein=146 annonces anciennes et peu vues — En  job=quoi-republier n=14 |
| (écran) | +21 24 nouveaux articles numérotés · N°2323, 2324, 2325, 2326, 2327 +1 | action | écran ↓ |  | 2 |  | plein=24 nouveaux articles numérotés · N°2323, job=numeros-nouveaux n= |
| (écran) | 1024 annonces numérotées sans prix d’achat — Saisis le prix ou relie l | action | écran ↓ |  | 2 |  | plein=1024 annonces numérotées sans prix d’ach job=achat-a-relier n=10 |
| (écran) | 855 articles en ligne depuis 30 j ou plus — Republier, préparer ailleu | action | écran ↓ |  | 2 |  | plein=855 articles en ligne depuis 30 j ou plu job=paires-dorment n=85 |
| (écran) | Colis à vérifier — Vérifie leur suivi avant d’y aller — 60 délais dépa | action | écran ↓ |  | 2 |  | plein=Colis à vérifier — Vérifie leur suivi av job=retrait-a-verifier  |
| (écran) | À venir 60 ventes · Vinted (3 comptes) 30 à envoyer · 30 en route 3 63 | action | écran ↓ |  | 2 |  | a-venir-ouvrir |
| (écran) | À ce rythme, novembre finira vers 3 650 € estimation › | action | écran ↓ |  | 2 |  | argent-plus=prevision-ligne prev-etat=ok prev-jours=18 prev-centre=365 |
| (écran) | Tout va bien ? · 2 points › | action | écran ↓ |  | 2 |  | tvb-ligne=2 |
| (écran) | Modifier ma journée | action | écran ↓ |  | 2 |  | jp-modifier |
| (écran) | Fermer | navigation | feuille |  | 2 |  | feuille-croix |
| (écran) | +27 Au moins 30 choses à trancher — Numéros — Au moins 30 choses à tra | information | feuille |  | 2 |  | job=a-trancher n=30 plein=Au moins 30 choses à trancher — Numéros |
| (écran) | Vérifier | action | feuille | 3 | 2 |  | role=ouvrir ton=geste a-trancher-geste=numeros-a-verifier a-trancher-o |
| (écran) | Saisir | action | feuille ↓ | 3 | 2 |  | role=ouvrir ton=geste a-trancher-geste=achats-sans-prix a-trancher-ouv |
| (écran) | + 27 | action | feuille |  | 2 |  | a-trancher-autres=27 |
| (écran) | + 1021 | action | feuille ↓ |  | 2 |  | a-trancher-autres=1021 |
| (écran) | Voir | navigation | feuille ↓ |  | 2 |  | role=ouvrir ton=geste a-trancher-geste=colis-retirer a-trancher-ouvrir |
| (écran) | Litiges et retours en cours Ouvre Litiges — | action | feuille ↓ |  | 2 |  |  |
| (écran) | Ventes Vestiaire reçues par SMS Ouvre Ventes — | action | feuille ↓ |  | 2 |  |  |
| (écran) | Colis Pickup reçus par SMS Ouvre Achats — | action | feuille ↓ |  | 2 |  |  |
| (écran) | Achats saisis deux fois Ouvre Achats — | action | feuille ↓ |  | 2 |  |  |
| (écran) | Adresses e-mail sans compte Ouvre E-mails — | action | feuille ↓ |  | 2 |  |  |
| (écran) | 3 comptes à surveiller — vendeur_1 : 3 ventes annulées (30 j) · vendeu | action | feuille ↓ |  | 2 |  | journee-sante=3150000000 3150001111 3150002222 n=3 sc-geste=?tab=setti |
| (écran) | Tout voir dans Paramètres › | navigation | feuille ↓ |  | 2 |  | tvb-parametres |

## Ma semaine — 390 px (18)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 2 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 2 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 2 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Semaine d’avant | action | écran |  | 2 |  | ms-prec=2026-11-09 |
| (écran) | Semaine d’après *(inactif)* | information | écran |  | 2 |  | ms-suiv |
| (écran) | Ventes 9 +2 vs semaine d’avant | action | écran |  | 2 |  | ms-chiffre=ventes |
| (écran) | Bénéfice brut — pas calculé | action | écran |  | 2 |  | ms-chiffre=brut |
| (écran) | Reçu — ouvre Ventes | action | écran |  | 2 |  | ms-chiffre=recu |
| (écran) | Colis envoyés — envois pas notés | action | écran |  | 2 |  | ms-chiffre=colis |
| (écran) | Paires qui dorment — ouvre Annonces | action | écran |  | 2 |  | ms-chiffre=dorment |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 2 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 2 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 2 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 2 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 2 |  | nav-entree=compta |

## Ma semaine — 1512 px (21)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 2 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 2 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 2 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 2 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 2 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 2 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 2 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 2 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 2 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 2 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | Semaine d’avant | action | écran |  | 2 |  | ms-prec=2026-11-09 |
| (écran) | Semaine d’après *(inactif)* | information | écran |  | 2 |  | ms-suiv |
| (écran) | Ventes 9 +2 vs semaine d’avant | action | écran |  | 2 |  | ms-chiffre=ventes |
| (écran) | Bénéfice brut — pas calculé | action | écran |  | 2 |  | ms-chiffre=brut |
| (écran) | Reçu — ouvre Ventes | action | écran |  | 2 |  | ms-chiffre=recu |
| (écran) | Colis envoyés — envois pas notés | action | écran |  | 2 |  | ms-chiffre=colis |
| (écran) | Paires qui dorment — ouvre Annonces | action | écran |  | 2 |  | ms-chiffre=dorment |

## Catalogue (ancien écran) — 390 px (18)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 10 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 10 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 10 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 10 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 10 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 10 |  | fraicheur-geste=version |
| (écran) | Exporter Excel | action | écran |  | 10 |  | vrm-tone=custom |
| (écran) | Numéro... puis Entrée | réglage | écran |  | 10 |  |  |
| (écran) | Chercher · Tous · Stock *(inactif)* | information | écran | 7 | 10 |  | vrm-tone=custom |
| (écran) | N° | réglage | écran |  | 10 |  |  |
| (écran) | +1 | action | écran |  | 10 |  |  |
| (écran) | Prix achat € | réglage | écran |  | 10 |  |  |
| (écran) | + Ajouter | action | écran |  | 10 |  | vrm-tone=custom |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 10 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 10 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 10 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 10 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 10 |  | nav-entree=compta |

## Catalogue (ancien écran) — 1512 px (21)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 10 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 10 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 10 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 10 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 10 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 10 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 10 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 10 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 10 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 10 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 10 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 10 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 10 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 10 |  | fraicheur-geste=version |
| (écran) | Exporter Excel | action | écran |  | 10 |  | vrm-tone=custom |
| (écran) | Numéro... puis Entrée | réglage | écran |  | 10 |  |  |
| (écran) | Chercher · Tous · Stock *(inactif)* | information | écran | 7 | 10 |  | vrm-tone=custom |
| (écran) | N° | réglage | écran |  | 10 |  |  |
| (écran) | +1 | action | écran |  | 10 |  |  |
| (écran) | Prix achat € | réglage | écran |  | 10 |  |  |
| (écran) | + Ajouter | action | écran |  | 10 |  | vrm-tone=custom |

## Stock Vinted (ancien écran) — 390 px (15)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 10 |  | aller-contenu |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 10 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 10 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 10 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 10 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 10 |  | fraicheur-geste=version |
| (écran) | Coller en masse | action | écran |  | 10 |  |  |
| (écran) | Comment elle bouge | aide | écran |  | 10 |  |  |
| (écran) | N° de l'annonce (ex : 1908) | réglage | écran |  | 10 |  |  |
| (écran) | Ajouter | action | écran |  | 10 |  |  |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 10 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 10 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 10 |  | nav-entree=achats |
| (écran) | Ventes | navigation | barre du bas |  | 10 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 10 |  | nav-entree=compta |

## Stock Vinted (ancien écran) — 1512 px (18)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 10 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 10 |  | nav-entree=journee |
| (écran) | Ventes · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 10 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 10 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 10 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 10 |  | nav-entree=communaute |
| (écran) | Extension à installer | information | en-tête |  | 10 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 10 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 10 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 10 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 10 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 10 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 10 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 10 |  | fraicheur-geste=version |
| (écran) | Coller en masse | action | écran |  | 10 |  |  |
| (écran) | Comment elle bouge | aide | écran |  | 10 |  |  |
| (écran) | N° de l'annonce (ex : 1908) | réglage | écran |  | 10 |  |  |
| (écran) | Ajouter | action | écran |  | 10 |  |  |

## Inventaire (ancien écran) — 390 px (44)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 10 |  | aller-contenu |
| (écran) | Fermer | navigation | barre du bas |  | 10 |  | acc-fermer |
| (écran) | Tous les écrans · nouveau | information | en-tête |  | 10 |  | menu-ecrans |
| (écran) | Notifications · à revoir | action | en-tête |  | 10 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | information | en-tête |  | 10 |  | recherche-zone recherche-loupe recherche-loupe-voix=1 |
| (écran) | Mon profil · Lecture seule | action | en-tête |  | 10 |  | profil-tete etat-ton=neutre |
| (écran) | Voir | navigation | écran |  | 10 |  | fraicheur-geste=version |
| (écran) | +24 27 colis pressés — À vérifier sur Vinted — 27 colis pressés — le p | action | écran |  | 10 |  | plein=27 colis pressés — À vérifier sur Vinted job=colis-limite n=27 l |
| (écran) | Aide : Ma journée | aide | écran |  | 10 |  | aide-ouvrir=journee |
| (écran) | Vendredi 13 novembre · 2 ventes · 138 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-13 |
| (écran) | Samedi 14 novembre · 2 ventes · 127 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-14 |
| (écran) | Dimanche 15 novembre · 2 ventes · 116 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-15 |
| (écran) | Lundi 16 novembre · 3 ventes · 141 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-16 |
| (écran) | Mardi 17 novembre · 3 ventes · 108 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-17 |
| (écran) | Mercredi 18 novembre · 3 ventes · 75 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-18 |
| (écran) | Jeudi 19 novembre · aucune vente | réglage | écran |  | 10 |  | jv2-toucher=2026-11-19 |
| (écran) | Semaine du 9 nov. | réglage | écran |  | 10 |  | jv2-semaine=2026-11-09 |
| (écran) | Ma semaine › | action | écran |  | 10 |  | ouvre-ma-semaine |
| (écran) | Voir les ventes (3 ventes) | navigation | écran |  | 10 |  | jv2-pile=3 sans-visionneuse |
| (écran) | À envoyer : 30 | information | écran |  | 10 |  | sj-zone=envoyer |
| (écran) | Ventes | action | écran |  | 10 |  | sj-lien=ventes |
| (écran) | Imprimer les 15 bordereaux | action | écran |  | 10 |  | sj-imprimer=15 impr-total=15 fu-principal |
| (écran) | Messages : 13 | information | écran |  | 10 |  | sj-zone=messages |
| (écran) | Prix à baisser : 0 | information | écran ↓ |  | 10 |  | sj-zone=prix |
| (écran) | À retirer : 0 | information | écran |  | 10 |  | sj-zone=retirer |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 10 |  | carte-modifier=journee |
| (écran) | Bénéfice · mois : pas su, prix d’achat manquants — Bénéfice · mois pri | action | écran |  | 10 |  | fu-case=benefice-mois carte-chiffre=benefice carte-p=mois carte-valeur |
| (écran) | Vendu · mois : 2 274 € 2 274 € Vendu · mois | action | écran |  | 10 |  | fu-case=vendu-mois carte-chiffre=vendu carte-p=mois carte-valeur=22740 |
| (écran) | Reçu · mois : 1 596 € 1 596 € Reçu · mois | action | écran |  | 10 |  | fu-case=recu-mois carte-chiffre=recu carte-p=mois carte-valeur=159600 |
| (écran) | À venir 60 ventes · Vinted (3 comptes) 30 à envoyer · 30 en route 3 63 | action | écran ↓ |  | 10 |  | a-venir-ouvrir |
| (écran) | À ce rythme, novembre finira vers 3 650 € estimation › | action | écran ↓ |  | 10 |  | argent-plus=prevision-ligne prev-etat=ok prev-jours=18 prev-centre=365 |
| (écran) | Offre aux favoris *(inactif)* | information | écran ↓ | 5 | 10 |  | rf-geste=favoris |
| (écran) | 146 annonces anciennes et peu vues — En ligne depuis 30 j ou plus : tu | action | écran ↓ |  | 10 |  | plein=146 annonces anciennes et peu vues — En  job=quoi-republier n=14 |
| (écran) | +21 24 nouveaux articles numérotés · N°2323, 2324, 2325, 2326, 2327 +1 | action | écran ↓ |  | 10 |  | plein=24 nouveaux articles numérotés · N°2323, job=numeros-nouveaux n= |
| (écran) | 1024 annonces numérotées sans prix d’achat — Saisis le prix ou relie l | action | écran ↓ |  | 10 |  | plein=1024 annonces numérotées sans prix d’ach job=achat-a-relier n=10 |
| (écran) | 855 articles en ligne depuis 30 j ou plus — Republier, préparer ailleu | action | écran ↓ |  | 10 |  | plein=855 articles en ligne depuis 30 j ou plu job=paires-dorment n=85 |
| (écran) | Colis à vérifier — Vérifie leur suivi avant d’y aller — 60 délais dépa | action | écran ↓ |  | 10 |  | plein=Colis à vérifier — Vérifie leur suivi av job=retrait-a-verifier  |
| (écran) | Tout va bien ? · 2 points › | action | écran ↓ |  | 10 |  | tvb-ligne=2 |
| (écran) | Modifier ma journée | action | écran ↓ |  | 10 |  | jp-modifier |
| (écran) | Aujourd’hui | navigation | barre du bas |  | 10 |  | nav-entree=journee |
| (écran) | 24 · 24 à faire Annonces · 24 à faire | navigation | barre du bas |  | 10 |  | nav-entree=paires |
| (écran) | Achats | navigation | barre du bas |  | 10 |  | nav-entree=achats |
| (écran) | 30 · 30 à faire Ventes · 30 à faire | navigation | barre du bas |  | 10 |  | nav-entree=ventes |
| (écran) | Argent | navigation | barre du bas |  | 10 |  | nav-entree=compta |

## Inventaire (ancien écran) — 1512 px (46)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 10 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 10 |  | nav-entree=journee |
| (écran) | Ventes · 30 à faire · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 10 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 10 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 10 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 10 |  | nav-entree=communaute |
| (écran) | Fermer | navigation | barre du bas |  | 10 |  | acc-fermer |
| (écran) | Extension à installer | information | en-tête |  | 10 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 10 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 10 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 10 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 10 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 10 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 10 |  | recherche-photo-ouvrir |
| (écran) | Voir | navigation | écran |  | 10 |  | fraicheur-geste=version |
| (écran) | +24 27 colis pressés — À vérifier sur Vinted — 27 colis pressés — le p | action | écran |  | 10 |  | plein=27 colis pressés — À vérifier sur Vinted job=colis-limite n=27 l |
| (écran) | Aide : Ma journée | aide | écran |  | 10 |  | aide-ouvrir=journee |
| (écran) | Vendredi 13 novembre · 2 ventes · 138 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-13 |
| (écran) | Samedi 14 novembre · 2 ventes · 127 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-14 |
| (écran) | Dimanche 15 novembre · 2 ventes · 116 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-15 |
| (écran) | Lundi 16 novembre · 3 ventes · 141 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-16 |
| (écran) | Mardi 17 novembre · 3 ventes · 108 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-17 |
| (écran) | Mercredi 18 novembre · 3 ventes · 75 € | réglage | écran |  | 10 |  | jv2-toucher=2026-11-18 |
| (écran) | Jeudi 19 novembre · aucune vente | réglage | écran |  | 10 |  | jv2-toucher=2026-11-19 |
| (écran) | Semaine du 9 nov. | réglage | écran |  | 10 |  | jv2-semaine=2026-11-09 |
| (écran) | Ma semaine › | action | écran |  | 10 |  | ouvre-ma-semaine |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 10 |  | carte-modifier=journee |
| (écran) | Bénéfice · mois : pas su, prix d’achat manquants — Bénéfice · mois pri | action | écran |  | 10 |  | fu-case=benefice-mois carte-chiffre=benefice carte-p=mois carte-valeur |
| (écran) | Vendu · mois : 2 274 € 2 274 € Vendu · mois | action | écran |  | 10 |  | fu-case=vendu-mois carte-chiffre=vendu carte-p=mois carte-valeur=22740 |
| (écran) | Reçu · mois : 1 596 € 1 596 € Reçu · mois | action | écran |  | 10 |  | fu-case=recu-mois carte-chiffre=recu carte-p=mois carte-valeur=159600 |
| (écran) | À envoyer : 30 | information | écran |  | 10 |  | sj-zone=envoyer |
| (écran) | Ventes | action | écran |  | 10 |  | sj-lien=ventes |
| (écran) | Imprimer les 15 bordereaux | action | écran |  | 10 |  | sj-imprimer=15 impr-total=15 fu-principal |
| (écran) | Prix à baisser : 0 | information | écran |  | 10 |  | sj-zone=prix |
| (écran) | Messages : 13 | information | écran |  | 10 |  | sj-zone=messages |
| (écran) | À retirer : 0 | information | écran |  | 10 |  | sj-zone=retirer |
| (écran) | Offre aux favoris *(inactif)* | information | écran | 5 | 10 |  | rf-geste=favoris |
| (écran) | 146 annonces anciennes et peu vues — En ligne depuis 30 j ou plus : tu | action | écran ↓ |  | 10 |  | plein=146 annonces anciennes et peu vues — En  job=quoi-republier n=14 |
| (écran) | +21 24 nouveaux articles numérotés · N°2323, 2324, 2325, 2326, 2327 +1 | action | écran ↓ |  | 10 |  | plein=24 nouveaux articles numérotés · N°2323, job=numeros-nouveaux n= |
| (écran) | 1024 annonces numérotées sans prix d’achat — Saisis le prix ou relie l | action | écran ↓ |  | 10 |  | plein=1024 annonces numérotées sans prix d’ach job=achat-a-relier n=10 |
| (écran) | 855 articles en ligne depuis 30 j ou plus — Republier, préparer ailleu | action | écran ↓ |  | 10 |  | plein=855 articles en ligne depuis 30 j ou plu job=paires-dorment n=85 |
| (écran) | Colis à vérifier — Vérifie leur suivi avant d’y aller — 60 délais dépa | action | écran ↓ |  | 10 |  | plein=Colis à vérifier — Vérifie leur suivi av job=retrait-a-verifier  |
| (écran) | À venir 60 ventes · Vinted (3 comptes) 30 à envoyer · 30 en route 3 63 | action | écran ↓ |  | 10 |  | a-venir-ouvrir |
| (écran) | À ce rythme, novembre finira vers 3 650 € estimation › | action | écran ↓ |  | 10 |  | argent-plus=prevision-ligne prev-etat=ok prev-jours=18 prev-centre=365 |
| (écran) | Tout va bien ? · 2 points › | action | écran ↓ |  | 10 |  | tvb-ligne=2 |
| (écran) | Modifier ma journée | action | écran ↓ |  | 10 |  | jp-modifier |

## La fiche d’une paire — 390 px (6)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Retour | navigation | feuille |  | 3 |  | fiche-retour |
| (écran) | Plus | information | feuille |  | 3 |  | fd-plus-ouvrir |
| (écran) | Baisser le prix | action | feuille |  | 3 |  | fiche-prix fd-baisser=1205 fiche-principal |
| (écran) | Argent | réglage | feuille |  | 3 |  | fd-seg=argent |
| (écran) | Sites | réglage | feuille |  | 3 |  | fd-seg=sites |
| (écran) | Histoire | réglage | feuille |  | 3 |  | fd-seg=histoire |

## La fiche d’une paire — 1512 px (7)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Fermer la fiche | navigation | feuille |  | 3 |  | fd-fond |
| (écran) | Retour | navigation | feuille |  | 3 |  | fiche-retour |
| (écran) | Plus | information | feuille |  | 3 |  | fd-plus-ouvrir |
| (écran) | Baisser le prix | action | feuille |  | 3 |  | fiche-prix fd-baisser=1205 fiche-principal |
| (écran) | Argent | réglage | feuille |  | 3 |  | fd-seg=argent |
| (écran) | Sites | réglage | feuille |  | 3 |  | fd-seg=sites |
| (écran) | Histoire | réglage | feuille |  | 3 |  | fd-seg=histoire |

## La loupe (recherche) — 390 px (8)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Nike samba taille 37 Vendue · N°2200 · 18 nov. · 25 € › | action | feuille |  | 2 |  | recherche-resultat=vente recherche-par=recent recherche-cle=vente:2200 |
| (écran) | Nike samba taille 37 Vendue · N°2201 · 18 nov. · 25 € › | action | feuille |  | 2 |  | recherche-resultat=vente recherche-par=recent recherche-cle=vente:2200 |
| (écran) | Nike samba taille 37 Vendue · N°2202 · 18 nov. · 25 € › | action | feuille |  | 2 |  | recherche-resultat=vente recherche-par=recent recherche-cle=vente:2200 |
| (écran) | Imprimer les bordereaux du jour Colis → « Tout imprimer » : tu choisis | action | feuille |  | 2 |  | recherche-resultat=action recherche-action=imprimer-jour |
| (écran) | Colis à retirer Colis → À retirer › | action | feuille |  | 2 |  | recherche-resultat=action recherche-action=colis-retirer |
| (écran) | Exporter pour mon comptable Argent → un zip : tableur, récap, factures | action | feuille |  | 2 |  | recherche-resultat=action recherche-action=export-comptable |
| (écran) | Ma configuration Plateformes, statut, numéro, affichage, notifications | action | feuille |  | 2 |  | recherche-resultat=action recherche-action=ma-configuration |
| (écran) | Pourquoi ? | aide | feuille |  | 2 |  |  |

## La loupe (recherche) — 1512 px (54)

| chemin | libellé | sorte | zone | × | touchers | effet | data-* |
|---|---|---|---|---|---|---|---|
| (écran) | Aller au contenu | navigation | en-tête ↓ |  | 2 |  | aller-contenu |
| (écran) | Ma journée | navigation | colonne |  | 2 |  | nav-entree=journee |
| (écran) | Ventes · 30 à faire · Annonces · 24 à faire · Messages · nouveau | navigation | colonne | 7 | 2 |  | nav-entree=ventes |
| (écran) | Paramètres | navigation | colonne |  | 2 |  | nav-entree=settings |
| (écran) | Mon compte · Pro — ouvrir mon profil | navigation | colonne |  | 2 |  | nav-compte nav-compte-ouvre=profil |
| (écran) | Communauté | navigation | colonne |  | 2 |  | nav-entree=communaute |
| (écran) | Fermer | navigation | barre du bas |  | 2 |  | acc-fermer |
| (écran) | Extension à installer | information | en-tête |  | 2 |  | etat-actions=lecture etat-code=absente etat-ton=attention |
| (écran) | Cacher les montants | réglage | en-tête |  | 2 |  | bouton-montants montants-caches=0 stream-libre |
| (écran) | Notifications · à revoir | action | en-tête |  | 2 |  | centre-notifs-cloche non-lues=0 cn-alerte=1 |
| (écran) | Rechercher une paire | réglage | écran |  | 2 |  | recherche-champ |
| (écran) | Chercher à la voix | réglage | écran |  | 2 |  | mic-dictee=true micro-ecoute=0 |
| (écran) | Scanner un colis | action | écran |  | 2 |  | recherche-scanner geste-disque=scanner |
| (écran) | Chercher par photo | action | écran |  | 2 |  | recherche-photo-ouvrir |
| (écran) | Nike samba taille 37 Vendue · N°2200 · 18 nov. · 25 € › | action | écran |  | 2 |  | recherche-resultat=vente recherche-par=recent recherche-cle=vente:2200 |
| (écran) | Nike samba taille 37 Vendue · N°2201 · 18 nov. · 25 € › | action | écran |  | 2 |  | recherche-resultat=vente recherche-par=recent recherche-cle=vente:2200 |
| (écran) | Nike samba taille 37 Vendue · N°2202 · 18 nov. · 25 € › | action | écran |  | 2 |  | recherche-resultat=vente recherche-par=recent recherche-cle=vente:2200 |
| (écran) | Imprimer les bordereaux du jour Colis → « Tout imprimer » : tu choisis | action | écran |  | 2 |  | recherche-resultat=action recherche-action=imprimer-jour |
| (écran) | Colis à retirer Colis → À retirer › | action | écran |  | 2 |  | recherche-resultat=action recherche-action=colis-retirer |
| (écran) | Exporter pour mon comptable Argent → un zip : tableur, récap, factures | action | écran |  | 2 |  | recherche-resultat=action recherche-action=export-comptable |
| (écran) | Ma configuration Plateformes, statut, numéro, affichage, notifications | action | écran |  | 2 |  | recherche-resultat=action recherche-action=ma-configuration |
| (écran) | Pourquoi ? | aide | écran |  | 2 |  |  |
| (écran) | Voir | navigation | écran |  | 2 |  | fraicheur-geste=version |
| (écran) | +24 27 colis pressés — À vérifier sur Vinted — 27 colis pressés — le p | action | écran |  | 2 |  | plein=27 colis pressés — À vérifier sur Vinted job=colis-limite n=27 l |
| (écran) | Aide : Ma journée | aide | écran |  | 2 |  | aide-ouvrir=journee |
| (écran) | Vendredi 13 novembre · 2 ventes · 138 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-13 |
| (écran) | Samedi 14 novembre · 2 ventes · 127 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-14 |
| (écran) | Dimanche 15 novembre · 2 ventes · 116 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-15 |
| (écran) | Lundi 16 novembre · 3 ventes · 141 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-16 |
| (écran) | Mardi 17 novembre · 3 ventes · 108 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-17 |
| (écran) | Mercredi 18 novembre · 3 ventes · 75 € | réglage | écran |  | 2 |  | jv2-toucher=2026-11-18 |
| (écran) | Jeudi 19 novembre · aucune vente | réglage | écran |  | 2 |  | jv2-toucher=2026-11-19 |
| (écran) | Semaine du 9 nov. | réglage | écran |  | 2 |  | jv2-semaine=2026-11-09 |
| (écran) | Ma semaine › | action | écran |  | 2 |  | ouvre-ma-semaine |
| (écran) | Modifier les chiffres de la carte | action | écran |  | 2 |  | carte-modifier=journee |
| (écran) | Bénéfice · mois : pas su, prix d’achat manquants — Bénéfice · mois pri | action | écran |  | 2 |  | fu-case=benefice-mois carte-chiffre=benefice carte-p=mois carte-valeur |
| (écran) | Vendu · mois : 2 274 € 2 274 € Vendu · mois | action | écran |  | 2 |  | fu-case=vendu-mois carte-chiffre=vendu carte-p=mois carte-valeur=22740 |
| (écran) | Reçu · mois : 1 596 € 1 596 € Reçu · mois | action | écran |  | 2 |  | fu-case=recu-mois carte-chiffre=recu carte-p=mois carte-valeur=159600 |
| (écran) | À envoyer : 30 | information | écran |  | 2 |  | sj-zone=envoyer |
| (écran) | Ventes | action | écran |  | 2 |  | sj-lien=ventes |
| (écran) | Imprimer les 15 bordereaux | action | écran |  | 2 |  | sj-imprimer=15 impr-total=15 fu-principal |
| (écran) | Prix à baisser : 0 | information | écran |  | 2 |  | sj-zone=prix |
| (écran) | Messages : 13 | information | écran |  | 2 |  | sj-zone=messages |
| (écran) | À retirer : 0 | information | écran |  | 2 |  | sj-zone=retirer |
| (écran) | Offre aux favoris *(inactif)* | information | écran | 5 | 2 |  | rf-geste=favoris |
| (écran) | 146 annonces anciennes et peu vues — En ligne depuis 30 j ou plus : tu | action | écran ↓ |  | 2 |  | plein=146 annonces anciennes et peu vues — En  job=quoi-republier n=14 |
| (écran) | +21 24 nouveaux articles numérotés · N°2323, 2324, 2325, 2326, 2327 +1 | action | écran ↓ |  | 2 |  | plein=24 nouveaux articles numérotés · N°2323, job=numeros-nouveaux n= |
| (écran) | 1024 annonces numérotées sans prix d’achat — Saisis le prix ou relie l | action | écran ↓ |  | 2 |  | plein=1024 annonces numérotées sans prix d’ach job=achat-a-relier n=10 |
| (écran) | 855 articles en ligne depuis 30 j ou plus — Republier, préparer ailleu | action | écran ↓ |  | 2 |  | plein=855 articles en ligne depuis 30 j ou plu job=paires-dorment n=85 |
| (écran) | Colis à vérifier — Vérifie leur suivi avant d’y aller — 60 délais dépa | action | écran ↓ |  | 2 |  | plein=Colis à vérifier — Vérifie leur suivi av job=retrait-a-verifier  |
| (écran) | À venir 60 ventes · Vinted (3 comptes) 30 à envoyer · 30 en route 3 63 | action | écran ↓ |  | 2 |  | a-venir-ouvrir |
| (écran) | À ce rythme, novembre finira vers 3 650 € estimation › | action | écran ↓ |  | 2 |  | argent-plus=prevision-ligne prev-etat=ok prev-jours=18 prev-centre=365 |
| (écran) | Tout va bien ? · 2 points › | action | écran ↓ |  | 2 |  | tvb-ligne=2 |
| (écran) | Modifier ma journée | action | écran ↓ |  | 2 |  | jp-modifier |
