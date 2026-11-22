# 22 nov. — Chasse aux bugs (« regarde ce qui ne marche pas bien dans l'app »)

Branche des outils : `claude/chasse-bugs-22nov` (partie de `claude/integration-finale` @ d86d45dde). **Aucun fichier de
l'app modifié** : on trouve, on prouve, on classe. Les correctifs sont pour les sessions d'intégration.

## 0. Sources et méthode

| source | ce qui a été fait | résultat |
|---|---|---|
| Vercel (projet cancale-v67) | `get_runtime_errors` 7 jours ; `get_runtime_logs` (le plan Hobby ne garde qu'1 h) | **aucune erreur serveur** sur 7 jours ; rien dans la dernière heure |
| Base Supabase (lecture seule, scalaires) | comptes d'incohérences (§4) | 0 doublon de N° présent, 0 achat relié à deux ventes ; 87 ventes finalisées de juillet-août sans date de versement lue |
| Captures iPhone de Julien du 21 nov. (prod) | regardées une à une | défauts P1/P2 ci-dessous marqués « capture de Julien » |
| App `claude/integration-finale` (build du 22 nov.) et **production** (`origin/main` @ 52a52466f, rebâtie à l'identique) | base inventée au volume de la sienne + 1 000 annonces (`_base-volume.cjs`), design par défaut (`BANC_DESIGN_V2=defaut`) | bancs ci-dessous ; chaque défaut « prod » a été REJOUÉ sur le build de `main` |

Bancs neufs (dans le dépôt, branche des outils) :
- `scripts/bancs/chasse-22nov.cjs` — 390 tactile CPU ×4 + 4G, 390 sombre, 1440 clair, 1512 sombre ; chaque écran : attente de
  fin de chargement, défilement jusqu'en bas (captures haut/bas), 1re rangée (fiche), retour par le GESTE (`history.back`)
  puis Échap, rechargement ; rapporte erreurs, clés brutes, `undefined/NaN`, débordements, contraste, couleurs interdites,
  cibles < 44 px, textes coupés, textes d'attente encore là après 12 s, lectures répétées, loupe ouverte par un retour.
- `scripts/bancs/chasse-gestes-22nov.cjs` — gestes joués par leur texte : loupe (N°, pseudo, suivi, faute, modèle), segments
  d'Annonces, Argent (4 onglets), prix d'achat, Imprimer, Relier, Messages, Paramètres, passage sombre.
- Aussi relancé : `parcours-chasse.cjs` (20 nov.) sur l'intégration (volume, longs, grand, vide × 390/1512 : 1 088 OK,
  16 KO — tous « lectures répétées ») et sur la prod (volume 390, Ma journée/Achats/Statistiques : 0 KO).

Captures : `/tmp/claude-0/-home-user-cancale-v67/517b0990-19ad-5f5f-a558-552f2498e1f5/scratchpad/chasse22/`
(`c22-integ/` chasse-22nov, `g22-integ/` gestes, `cap-pc/` parcours-chasse, `prodcap/` production, `repro-loupe-*.png`).

## 1. P1 — casse ou faux chiffre au quotidien

| # | écran | défaut | reproduire | où | cause probable | correctif proposé |
|---|---|---|---|---|---|---|
| P1-1 | Annonces → fiche d'un article | **« ‹ Retour », Échap ou le geste retour ouvrent la LOUPE « Tout sur le N°365 »** au lieu de revenir à la liste ; la loupe reste ensuite ouverte sur Argent, Stock, Messages… | Annonces → toucher une rangée → « ‹ Retour » (`scripts/bancs/chasse-retour-loupe.cjs <dépôt> <dist> 390 <préfixe>` : « après Échap, loupe = 365 », « sur Argent, loupe = 365 ») | **prod + intégration**, 390 et 1440 | `src/App.jsx:38222` `onRetour={depuis ? fermer : ()=>{ fermer(); setGsQ(N°); setGsOpen(true); }}` et `src/App.jsx:38413` `rendreFichePaire(ficheNum, null, …)` : `depuis` est TOUJOURS `null` pour une fiche ouverte depuis une liste | retenir d'où la fiche a été ouverte (loupe ou liste) et ne rouvrir la loupe que si elle venait de la loupe |
| P1-2 | Fiche (achat ; article) au téléphone | **le geste retour de l'iPhone ne ferme pas la fiche** : la fiche d'un achat reste ouverte après le retour ET après Échap | Achats → toucher un achat → glisser retour | intégration (390 clair et sombre) ; même code sur `main` | la fiche `ficheNum` (`src/App.jsx:38413`) et `FichePaire` n'ont pas de `<FermeAuRetour>` (CLAUDE.md §7 : « toute feuille plein écran porte FermeAuRetour ») | poser `<FermeAuRetour fermer={…}/>` dans la fiche (et dans la fiche d'achat) |
| P1-3 | Aujourd'hui « Dernières ventes », Ventes « À régler » | **les rangées sans photo sont cassées** : le cadre d'attente de la photo prend la moitié de la largeur, le titre est écrasé (« Nike / samba… », « Vinted · … », « 67 coli… ») — c'est l'état RÉEL de son iPhone (photos Vinted non chargées) | ouvrir Aujourd'hui sans extension, descendre à « Dernières ventes » (`c22-integ/tel-journee-bas.png`, `prodcap/p390-journee-bas.png`, `prodcap/p390-ventes.png`) | **prod + intégration**, 390 et 1440 | `src/App.jsx:12180` (`PhotoVinted`, état attente/perdue) rend un `<span style={cadrePhoto(style)}>` qui **perd `className` (`n-vignette`) et `width/height`** (`reste` non transmis) ; `Aujourdhui.jsx:157` passe la taille par `width/height`, pas par `style` | transmettre `className`, `width`, `height` (et `data-n-taille`) au cadre d'attente |
| P1-4 | Argent → Mois (barres J J A S O N) | **juillet et août sont sous-comptés sans le dire** : la barre de juillet est presque vide (capture de Julien `6ab82176`) alors que juillet a 85 ventes. Base : **41 ventes finalisées de juillet et 46 d'août n'ont pas de détail de transaction lu ⇒ aucune date de versement ⇒ dans aucun mois** ; seule la barre du mois courant dit « au moins » | Argent → Mois, regarder juillet | **prod** (et intégration : banc « Juin/Juillet/Août 0 € », à confirmer sur sa base) | règle « daté au versement » (§5) correcte, mais la barre ne porte pas la couverture (« au moins · N à dater ») | dire « au moins … · N ventes à dater » sur chaque mois qui en a, et relire ces 87 détails dans le budget de lecture |
| P1-5 | Argent → Statistiques (Pilotage) | **« — · ventes pas encore lues » partout, encore après 15 s**, alors que Ventes et Argent → Mois montrent les ventes (70 à envoyer, 4 186 € reçus) ; « Je lis les boosts relevés… », « Je lis les dates de mise en ligne… » ne finissent jamais | ouvrir Argent → Statistiques directement (`prodcap/i390-dashboard.png` ; la prod montre ses chiffres : `p390-dashboard.png`) | **intégration seulement** | `src/aujourdhui/StatsBranche.jsx:52` : l'état `ventes` vient de `live.venduLignes` (statistiques vivantes) — absent sans extension ⇒ `passu` | lire les ventes de la même source que Ventes/Argent quand le vivant manque ; une attente sans fin doit finir en « pas su » avec sa raison |

## 2. P2 — gêne visible

| # | écran | défaut | reproduire | où | cause probable | correctif proposé |
|---|---|---|---|---|---|---|
| P2-1 | barre du bas · Ventes | **pastille ≠ rangées** : pastille « 3 » pour « À envoyer 1 » (capture de Julien `05184f6f`) | Ventes au téléphone | prod | la pastille additionne « À régler » (`src/App.jsx:37079` `plusRegler`) au nombre à envoyer ; base : 2 ventes de septembre encore `needs_action` sur un compte dont la liste n'a pas été relue depuis le 20 sept. | une pastille = une notion (à envoyer) ; ou dire la somme dans Ventes |
| P2-2 | Aujourd'hui ↔ Ventes | **« Imprimer 35 bordereaux » (Aujourd'hui) mais « Imprimer les 14 bordereaux » (Ventes)**, même base, même geste | `cap-pc/volume-390-journee.png` puis `-ventes.png` | prod + intégration | Aujourd'hui : `compteAImprimer` (`src/ecrans/Comptabilite.jsx:21745`, publication `vrm_colis_prets`, prend le max) ; Ventes : `cochesParDefaut` (prêts ET pas encore imprimés) | une seule règle (§5 « une seule règle par notion ») : la sélection de Ventes |
| P2-3 | Ventes, Achats, Argent, Messages, Paramètres, E-mails, Annonces | **le même bandeau « Les photos de Vinted ne s'affichent pas ici… » au-dessus du titre de CHAQUE écran** (4 lignes) | tout écran au téléphone sans extension | prod + intégration | bandeau posé par la coque à chaque écran | le dire une fois (Extension / Aujourd'hui), ou une ligne repliée |
| P2-4 | Ma journée, Achats | **la même lecture part 7 à 14 fois en 12 s** : `ebay_listings` ×8–14, `vc_listings` ×7–10, `lbc_ventes&select=data` ×7–13, `vinted_lbc_posted&select=data` ×7–9, `ebay_orders` ×11 ; Achats : `photo_emprunte_*` ×6 | `parcours-chasse.cjs` / `chasse-22nov.cjs` | **intégration seulement** (prod : 0) | une dizaine de lecteurs indépendants (`lireEbayTous` : `src/App.jsx:13023, 16591, 24348, 31251, 31282, 34698, 36583`, `Comptabilite.jsx:13133`, `AnnoncesEgalite.jsx:128`…) sans lecture partagée | partager la lecture en cours (`src/memoCourt.js`) ; projeter `lbc_ventes` au lieu de `select=data` (§4.4) |
| P2-5 | Achats ; Aujourd'hui « En direct » | **chargements dans le vide** : « Je lis tes colis… » encore là après 12 s (390, CPU ×4) ; « En direct · Je demande à l'extension… » ne finit jamais sans extension (1440) | `chasse-22nov.cjs` | intégration (En direct : prod aussi) | lecteur qui ne rend jamais « pas su » | toute attente finit (≤ 10 s) en « pas su · pourquoi » |
| P2-6 | Ventes (prod) | bouton bleu pastel « Où est cet article dans le stock » collé à gauche hors de sa carte ; bande « 56 bordereaux déjà traités » pleine largeur sans marge ; « Imprimer » grisé + « Coche un colis » ; section eBay au milieu de Ventes | capture de Julien `05184f6f` | **prod** (intégration : corrigé, plein noir et « Imprimer N » seul) | — | livrer l'intégration |
| P2-7 | Annonces, Argent (prod) | pleins **bleu vif** « Publier un article », « Saisir 13 prix d'achat » (le plein est « rond d'encre ») | captures de Julien `1fc4a038`, `6ab82176` | **prod** (intégration : noirs) | — | livrer l'intégration |
| P2-8 | Achats, fiches | photos vides partout (cadres gris) | captures de Julien `fda7a8e6`, `1fc4a038` | prod | connu (chantier photos, 21 nov.) | — (suivi ailleurs) |

## 3. P3 — finition

- Aujourd'hui : « Bénéfice brut 0 € » à côté de « Bénéfice net — aucune vente » un jour sans vente (même notion, deux mots).
- Aujourd'hui à l'ordinateur : contenu sur une colonne de ~820 px, « Imprimer 35 bordereaux » flotte au milieu (1440/1512).
- Paramètres (390) : « ? » rond à droite du titre et « Sur cet appareil seulement » orphelin dessous ; E-mails : « ? » posé sous le titre.
- Achats : « Calculette » coupé sans « … » ; « Achats hors plateforme · Brocante, fournisseur, main pr… ».
- Loupe à l'ordinateur : double contour (vert + noir) autour du champ.
- Fiche d'article au téléphone : cadre photo vide de ~45 % de l'écran quand il n'y a pas de photo.
- Toast « 84 (puis 174) nouveaux articles numérotés » posé sur le bas de chaque écran jusqu'à « Fermer ».
- Prod : onglet « Statistiqu… » coupé (Argent) ; « Écrire aux favoris dans l'extension · s'ouvre sur Vinte » coupé (Aujourd'hui).
- Aujourd'hui (capture de Julien `fd1ed34b`) : « Écoulement 30 j 120 % · 67 ventes · 56 en ligne » (un taux > 100 % se lit mal) ;
  « Au prix d'achat · 11 sur 65 » à côté de « En ligne 56 » (deux totaux différents sans dire pourquoi).

## 4. Base de production — comptes (lecture seule, projections scalaires)

| mesure | nombre |
|---|---|
| annonces présentes (dernière lecture des dressings, non fermées) | 70 · dont 6 sans N° |
| N° portés par deux annonces PRÉSENTES | **0** (25 N° en double dans l'historique `vinted_annonce_numeros`, aucun présent) |
| achats reliés à deux ventes (`vinted_txn_link`, valeur partagée) | **0** sur 440 liens |
| ventes finalisées sans détail de transaction lu (⇒ sans date de versement) | juillet 41 · août 46 · juin 1 · sept.–nov. 0 |
| ventes encore « needs_action » | 3 : 1 du 21 nov. (vraie) + 2 du 18–19 sept. sur un compte relu pour la dernière fois le 20 sept. |
| comptes dont la liste des ventes a plus de 48 h | 7 sur 15 (la plus ancienne : 7 juillet) |
| erreurs serveur Vercel (7 j) | 0 |

## 5. Vu, pas un défaut de l'app (le banc)
- Prix d'achat : saisi → toast « Prix d'achat enregistré : 40,00 € », la rangée dit « Acheté 40 € » (l'écriture part plus tard).
- E-mails « pas su » et « E-mails : la recherche n'a pas répondu » : le banc ne sert pas la route des e-mails.
- Contraste 1,00 du toast : faux positif de la sonde (fond posé par un calque).
- Loupe : N°, pseudo, n° de suivi (sans « XW »), faute (« sambaa » → « à une lettre près ») et modèle trouvent juste.

## 6. Pas couvert
Paramètres sous-pages et segments de Statistiques au toucher (sélecteurs du banc à refaire), Messages → une conversation
(aucune rangée trouvée par le banc), imprimer un lot jusqu'au PDF, l'extension, la session expirée en ligne.

Geste de Julien : aucun.
