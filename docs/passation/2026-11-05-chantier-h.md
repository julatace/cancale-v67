# 5 nov. — Chantier H : la coque, la navigation, Paramètres

Feuille de route : `docs/passation/2026-11-05-revue-coherence.md` (points 2.28 à 2.32, 3.6,
mots « Comptes liés » et « Statut ») + l'amélioration « Où ranger à l'arrivée ». Branche
locale `v35-chantier-h`, partie de `claude/project-review-nsk5su` (fusion vraie de 16ba1ca2
en cours de route). Rien dans `vinted-sync-extension/`, `public/` remis à l'identique.

## Ce qui change (avant → après)

### En-tête (2.28)
- Téléphone : nuage · ⓘ · Stream · cloche · loupe (5 icônes sans libellé) → **pastille d'état
  (un point de couleur : encre = tu peux agir, gris = rien à faire ici, ambre + halo = un geste)**
  · Stream · cloche · loupe. Le « i » dessiné en CSS (`::after`) est retiré (`styles-coque.css`).
- Le nuage n'est plus dans l'en-tête quand tout va bien : **il n'apparaît que si une sauvegarde
  a raté (`error`) ou a été refusée (`refus`)** (`BoutonSync`, `SYNC_PROBLEME`) ; ouvert, il
  reste jusqu'à ce qu'on ferme son panneau (le banc `nuage` lit « synced » panneau ouvert).
- L'œil et « Stream » : un seul réglage (la fusion du mode stream du 5 nov. l'avait fait ; le
  banc le vérifie : un bouton `data-bouton-stream`, aucun `data-bouton-montants`).
- Code mort de l'en-tête retiré (`false&&` : compteur 📦, 💸, mode sombre, notifications).

### Le panneau de la pastille (2.29, 2.30)
- « Dernière capture reçue » lisait la ligne de diagnostic de l'extension (`panel_diag_capture`)
  pendant que la liste au-dessus lisait les relectures des comptes : **« Aucune capture reçue
  pour l'instant » sous « vendeuse_a — relu il y a 15 min »**. Elle lit maintenant la MÊME
  source que la liste (`lireDernieresCaptures`, la plus récente) ; le diagnostic ne sert plus
  qu'à la version, et à la date quand aucune relecture n'est lue (téléphone : le seul fait
  connu, banc `pont`). `data-etat-derniere-source="comptes" | "diagnostic"`.
- Fraîcheur : dans ma zone elle n'est plus dite qu'à deux endroits — la pastille (liste +
  dernière capture, une source) et l'État des connexions. Hors zone, restent les lignes
  `FraicheurDonnees` (Colis, écrans de site) et `FraicheurAnnonces` (Annonces, Statistiques) :
  à retirer par leurs chantiers (D, C, F) s'ils suivent 2.30.
- Au téléphone, le panneau a sa croix (44 px, rond gris des feuilles).

### Paramètres (2.31)
- Icônes : 23 lignes de Réglages, 23 icônes distinctes (avant : `link` ×2, `info` ×3, `save` ×2,
  `sync` = Republier) ; Mon compte : 9 distinctes (avant : `key` ×3, `link` = Équipe). Icônes
  ajoutées à `ICON_PATHS` : `cart`, `pulse`, `shield`, `play`, `help`, `users`, `device`, `lock`,
  `texte`, `archive` (aucune existante modifiée).
- « Organisation » n'est plus une ligne de la liste ; son lien reste sous « Stock et rangement »
  (`data-reglage-organisation`, texte « Organisation » seul — bancs `compta-simple`,
  `operations-navigation` inchangés) et `?tab=organisation`.
- Plus de carte dans la carte : le GROUPE n'est plus une carte (jetons.css §3 dessinait le groupe
  ET la liste) ; Mon compte : Google et Discord sont des LIGNES de la liste (plus deux cartes à
  bordure dedans).
- « Enregistrement en cours… » (au-dessus du titre, 26 px qui sautaient à chaque réglage) →
  « Enregistrement… » avec un point qui respire, À DROITE de la ligne du titre.
- Ordinateur : la colonne commençait 46 px plus à droite que tous les autres titres (largeur
  1120 centrée) → largeur des autres écrans, titre au même x, listes à 880 px alignées à gauche.
- Mon compte : l'avatar était dessiné deux fois (carte du profil + carte « Ta photo de
  profil ») → la photo se change DANS la carte du profil (`PhotoProfil nu`). Discord dit deux
  fois (« Bientôt » côté connexion + « pas pu lire ton Discord ») → une ligne (`DiscordCompte`),
  sa panne par `EtatPanne`.
- Les trois onglets Réglages · Mon compte · Abonnement : le contrôle segmenté commun (`.vrm-seg`)
  au lieu d'un dessin à part (l'onglet choisi n'était pas l'aplat) ; 44 px au téléphone.
- La recherche : `ChampRecherche` (au lieu d'un champ fait main et d'un bouton « Effacer ») ;
  synonymes ajoutés (statut/régime/URSSAF, stream/montants/œil, connexions/relu, aide…).
- La feuille « Changer mon e-mail / mot de passe / Se déconnecter » : `SheetShell` (au lieu d'un
  calque fait main) ; elle était un composant RECRÉÉ à chaque rendu (chaque lettre tapée
  remontait la feuille) — elle est maintenant appelée, pas montée.

### Navigation (2.32)
- Achats : `bag` (le sac des Ventes) → `cart`. Leboncoin, eBay, Vestiaire : le LOGO du site,
  monochrome à la couleur du texte (`logoPlateforme`, comme le sélecteur de site) — avant
  `tag` (= « Prix à baisser »), `grid` (= Annonces), `shop` (≈ le sac des Ventes).
- Un colis à envoyer portait DEUX badges dans la colonne (Ventes ET Colis) → un seul, sur Colis.

### La cloche (3.6)
- `FeuilleCentreNotifs` : `SheetShell` (poignée, titre, la même croix, portail, retour) au lieu
  du voile et de la croix faits main ; la panne par `EtatPanne` ; « Tout marquer lu » en lien
  d'action dans une barre avec le compte des non-lues ; état vide qui dit ce qui viendra ;
  chargement « Lecture en cours… » ; chevron en icône (plus le glyphe « › ») ; survol à la souris.

### Mots
- « Régime fiscal » → `L.statut` (« Statut ») ; « Comptes liés » et « E-mails » par `L` ;
  « Comptes et emails » → « Comptes et e-mails » ; « Changer mon email » → « e-mail »
  (« Import des e-mails Vinted », l'aide « Je ne reçois pas mes e-mails »).

### « Où ranger à l'arrivée » (amélioration)
- Règle pure `src/ouRanger.js` : `premiereCaseLibre({meubles, slots})` (ordre des meubles puis de
  lecture ; une case notée pour un N° — même ancien — est PRISE ; un meuble empilé ne propose que
  le fond de son segment, planches comprises — `planchesCases`, `placeCase` du Stock) ;
  `achatsArrives` (TRANSITION vue « autre → arrivé », par n° de transaction ; première lecture ⇒
  rien) ; `notifsOuRanger`.
- `CentreNotifsCoque` lit les achats PROJETÉS (`select=id,orders:data->payload->my_orders`)
  4 s après le chargement du nuage, à l'ouverture de la cloche et quand le Stock change
  (`vrm:stock-slots`). Arrivé = `phaseAchat(status) === 'completed'` ou « ✓ Récupéré » touché.
- Dans la cloche : une section « À ranger » en tête (titre de l'achat, « Première case libre :
  Étagère A · rangée 1, colonne 2 », « Ranger » → Stock, « Déjà rangé »), comptée dans la
  pastille de la cloche, **jamais envoyée au téléphone** (aucune écriture). Pas su (meubles,
  cases ou achats pas lus) ⇒ rien n'est proposé.
- Mémoire PAR APPAREIL (commodité, pas une donnée de stock) : `vrm_ranger_vus` (tx → état vu),
  `vrm_ranger_proposes` (30 au plus, 14 jours). Limite dite : la transition n'est vue que si
  l'appareil a lu l'achat avant son arrivée ; « Ranger » ne pré-sélectionne pas la case dans le
  Stock (StockMeubles n'a pas d'entrée « case visée » ; le Stock n'est dans aucun chantier).

## Petites améliorations (avant → après)
1. Téléphone : « ⓘ » de l'état → point de couleur.
2. Nuage permanent → seulement en panne.
3. En-tête : 4 blocs `false&&` morts → retirés.
4. Titres du nuage « Sauvegarde en cours... » / « Chargement... » → « … » (U+2026).
5. Panneau de synchro : trois boutons faits main → `Bouton` (primaire, secondaire), 44 px au doigt.
6. Panneau de synchro : titre 13 px → 15 px, rayon 12 → 14 (famille des panneaux).
7. Panneau d'état au téléphone : pas de croix → croix 44 px.
8. « Tes comptes — dernière relecture » → « Tes comptes · dernière relecture ».
9. « Dernière capture » : source contradictoire → même source que la liste.
10. Cloche : calque fait main → `SheetShell`.
11. Cloche : « — La liste n'a pas pu être lue. » → `EtatPanne` (raison + Réessayer occupé).
12. Cloche vide : une phrase grise → icône + « Rien pour l'instant » + ce qui s'affichera.
13. Cloche en lecture : « … » → indicateur + « Lecture en cours… » (immobile si mouvement réduit).
14. Cloche : « Tout marquer lu » bouton gris en tête → lien d'action à côté du compte des non-lues.
15. Cloche : glyphe « › » → icône chevron.
16. Cloche : aucun survol à la souris → fond au survol (souris seulement).
17. Cloche : chaque ligne lue « bouton » → nom lu « Non lue · titre · texte ».
18. Cloche : filtre sans résultat → « Aucune de ce type. ».
19. Cloche : « Réglages des notifications » bouton gris → lien d'action (bleu lien).
20. Pastille de la cloche : compte aussi « À ranger » (local).
21. Badge double Ventes + Colis → Colis seul.
22. Achats : sac → caddie.
23. Sites : étiquette / grille / sac → logos.
24. Paramètres : 10 icônes en double → toutes distinctes.
25. « Organisation » ligne → lien sous le groupe.
26. Carte dans la carte → groupe transparent, une carte par liste.
27. « Enregistrement en cours… » au-dessus du titre → « Enregistrement… » dans la ligne du titre.
28. Colonne centrée (x + 46 px) → alignée sur les autres écrans.
29. Onglets maison → segmenté commun, 44 px au téléphone, marge avant la carte suivante.
30. Recherche maison → `ChampRecherche` (croix ronde, Échap, 17 px au téléphone).
31. Recherche sans résultat : une phrase → la requête redite + « Effacer la recherche ».
32. Recherche : « statut », « urssaf », « montants », « relu », « aide »… trouvaient rien → trouvent.
33. Mon compte : deux avatars → un.
34. Mon compte : Discord dit deux fois → une ligne.
35. Mon compte : Google en carte bordée dans une carte → ligne de liste.
36. Discord « pas pu lire » texte + bouton → `EtatPanne` compact.
37. « Compte associé » en `C.accent` → `accentTexte`.
38. Feuille du compte : calque fait main → `SheetShell` ; recréée à chaque lettre → stable.
39. Feuille du compte : champ 15 px → 17 px (iOS ne zoome plus), nom lu ; erreur `role="alert"`.
40. Feuille du compte : « … » pendant l'envoi → « Enregistrement… » / « Déconnexion… » (bouton occupé).
41. « Jamais sauvegardé » → « Jamais sauvegardé — touche « Sauvegarde complète » » (le geste).
42. Lignes de réglage : le chevron glisse de 2 px au survol (souris).
43. Valeur à droite d'une ligne au téléphone : 24 % → 34 % (« Normale · A4 » n'est plus coupé).
44. « Comptes et emails », « Régime fiscal », « Changer mon email »… → mots de `L` / e-mail.
45. Texte bleu de Paramètres et Comptes liés (« ‹ Paramètres », « Ouvrir », « Supprimer des
    données… ») : aplat #0071E3 (4,2:1 / 3,6:1) → bleu lien `accentTexte` (`--vrm-b-lien` redéfini
    sur ces deux écrans — `fusion-app` F6 vert dans la zone).
46. CSS mort de l'ancien champ de recherche des réglages → retiré.

## Preuves
- `npm run build` vert.
- **Banc `scripts/bancs/coque-parametres.cjs`** (données INVENTÉES : le jeu de `nouveau-vendeur`
  + deux meubles + l'achat 73001 « livré » ; `BANC_PORT` 9310 ; 390 tactile et 1512, clair et
  sombre) : H1 en-tête, H2 pastille, H3 Paramètres, H4 navigation, H5 cloche, H6 « Où ranger ».
  **Base (`claude/project-review-nsk5su`, arbre `git archive` construit à part, banc copié
  dedans) : 74 rouges** (H1 10, H2 8, H3 34, H4 6, H5 4, H6 12). **Après : 112 verts, 0 rouge.**
- **Audit `scripts/audit-coque-parametres.cjs`** : 32/32 ; `--prouve` : **15/15 mutations
  rouges** (case prise ignorée, gravité ignorée, pas su ⇒ case inventée, première lecture,
  achat jamais vu, sans case, nuage permanent, badge double, icône d'Achats, logos des sites,
  icône de réglage en double, Organisation en ligne, « Régime fiscal », capture lue au
  diagnostic, cloche hors SheetShell).
- `fusion-app` (zone : comptes-lies, paramètres) : 44 verts, 0 rouge (les F6 de Comptes liés et
  les F5 des onglets à 38 px sont corrigés).
- Bancs adaptés (ils jugeaient l'ancien rendu, pas la règle) : `reglages-premium` (la photo est
  DANS la carte du profil : « même lettre » devient « une seule lettre ») ; `parametres-guides`
  (la croix de `ChampRecherche` au lieu du bouton « Effacer la recherche des paramètres ») ;
  `attente-email` (« Changer mon e-mail »).
- Voisins et audits demandés : voir la fin (comparaison base/après).
- Captures (hors dépôt, regardées) : avant
  `scratchpad/h/shots-avant/` et `scratchpad/h/shots-banc-avant/`, après
  `scratchpad/h/shots-banc-apres/` et `scratchpad/h/shots-v4/` (`ch-entete-*`, `ch-pastille-*`,
  `ch-nuage-*`, `ch-reglages-*`, `ch-moncompte-*`, `ch-plus-*`, `ch-cloche-ranger-*`).

## Ce qui reste
- Hors zone (2.30) : `FraicheurDonnees` (Colis, écrans de site) et `FraicheurAnnonces`
  (Annonces, Statistiques) redisent la fraîcheur des comptes.
- Partagé (pas modifié) : `--vrm-b-lien` vaut l'aplat dans `styles-boutons.css` — tous les
  `Bouton variante="discret"` de l'app écrivent leur texte en #0071E3 (4,2:1 sur le gris clair) ;
  redéfini ici pour Paramètres et Comptes liés seulement. À passer à `--vrm-accent-texte` par le
  propriétaire des boutons.
- Le panneau de la pastille au téléphone reste un calque (huit bancs lisent sa forme :
  `pont`, `indicateur-pro`, `relais-telephone`…) ; il a gagné sa croix.
- « Ranger » ouvre le Stock sans viser la case (le Stock n'a pas d'entrée pour ça).
