# Ma journée · « Studio bleu clair » (14 nov. 2026)

Décision de Julien : la direction t25 « Studio bleu clair » (Spatial × Bento × Aplats × Lumière), « tout doit
être parfait, tu peux changer les dispositions », aucune fonction perdue. Ce lot applique la direction à
**Ma journée** (téléphone et ordinateur). Branche `claude/studio-journee`
(partie de `claude/integration-refonte`). D'autres agents font la fondation (coque, `studio.css`), Paires,
Ventes/Colis et le reste en même temps.

## Ce qui change

- **La tête** : « Bonsoir · samedi 14 novembre », le grand titre (affiche, Urbanist 400), la phrase du jour,
  les **alertes qui coûtent de l'argent** (double vente, N° en double, colis en retard… — jamais cachées,
  au-dessus de tout), puis **l'affiche** : le vendu du jour en chiffre d'affiche fin (96 px, € à 0,44 em
  remonté — `MontantAffiche`), la pile des ventes, les faits du jour, la semaine (sept tubes creusés qui se
  touchent), la ligne « Aujourd'hui · Semaine du … · Ma semaine ». Mêmes composants qu'avant (`FriseJournee`),
  restylés ; l'ordre phrase / affiche suit SON réglage.
- **La grille Bento** (src/JourneeStudio.jsx, `BentoJournee`) : des tuiles en porcelaine, chacune avec SON
  geste réel.
  - « À envoyer » 2 × 2 : le nombre, la pile des paires (par identité), « N prêts à imprimer », « dont … »
    (ambre si pressé), et **le seul bouton plein de l'écran**, le rond d'encre « Imprimer » —
    `_pendingBordPrint = true` puis Colis : **le parcours d'impression existant, non modifié**.
    Dépliée : les colis (N° gravé · vignette · titre · transporteur · échéance), « N autres › »,
    « Emballer » (le mode emballage, `DEMANDE_EMBALLAGE`).
  - « À retirer · N » 2 × 1 : **les codes en grandes plaques** (la liste de la copie hors ligne,
    `listeCodesRetrait`, extraite telle quelle de l'effet `vrm_codes_hors_ligne` : le même verdict, deux codes
    différents ⇒ « 2 codes », jamais un choisi). Dépliée : chaque code, sa photo par identité, transporteur,
    lieu, « à vérifier » ; « N colis sans code lu » ; « Ouvrir les retraits ».
  - « Messages » : les conversations non lues (la règle de Messages) ; dépliée : les conversations, les
    cartes eBay et Vestiaire (même geste qu'avant).
  - « Offres » (seulement s'il y en a : les offres Vestiaire, `offresJourneeVc`) et « Sans prix d'achat »
    (point ambre ; dépliée : la carte « Saisir » d'avant) — ces cartes quittent la liste (une fois, §7).
  - « Prix à baisser » : les conseils de prix (la liste d'Annonces), dépliée : N°, photo, « 80 € → 70 € conseillé ».
  - Le mois (3 × 1) : Bénéfice · Vendu · Reçu « au moins », la **carte réglable d'avant** (`CarteStatsApp`,
    ses `data-journee-benef`, son « Modifier »), posée nue dans la tuile.
  - Toucher une tuile (le « + » n'est qu'un signe) la **déplie sur place**, pleine largeur : au téléphone
    l'affiche s'efface, les autres tuiles se **tassent** en une rangée de chiffres ; sur ordinateur la
    grille reste en haut et le déplié vient dessous (sans redire son chiffre). « × » (rond 44) replie et rend
    la main à la tuile ; Échap et le retour du téléphone (`FermeAuRetour`) aussi.
  - La grille est STABLE : les quatre cases (« À envoyer », « Messages », « Prix à baisser », « À retirer »)
    sont toujours une tuile (à zéro, calmes : « Rien à envoyer », « 0 ») — la grille ne saute pas quand les
    lectures arrivent (mesuré : une tuile qui apparaissait en retard déplaçait le mois de 260 px à 1512,
    CLS 0,27). « Offres » et « Sans prix d'achat », qui n'existent que s'il y a quelque chose, se posent
    APRÈS le mois : en arrivant, elles ne déplacent aucune autre tuile.
- **« À faire »** sous la grille : la liste d'avant, en rangées sur une porcelaine, dans SON ordre ;
  « N » = les cartes de la liste (le nombre dit = les cartes vues). La « prochaine chose » n'est plus sortie
  en tête : c'est la première carte de la liste (`data-prochain`, réglable comme avant).
- **Ordinateur** : une seule colonne (l'ancienne grille tête / « À faire » à droite ne s'applique plus),
  l'affiche avec la semaine à droite, la grille sur douze colonnes, le déplié dessous.
- **L'instantané d'ouverture** porte le même habit (`sj-journee`) et lit la carte des chiffres et la
  prochaine chose là où elles vivent maintenant (src/journeeInstantanee.js) ; sans carte « À faire », la
  prochaine chose rangée est la tuile « À envoyer » (puis « À retirer ») qui porte quelque chose (son titre
  « N colis à envoyer » et son geste, `data-sj-titre` / `data-sj-geste`) ; il garde la place de la tête ET
  de la grille (rien ne saute au remplacement).

## L'idée 148 « Tes tuiles à toi » : NON retenue

Construite pendant la session (appui long ⇒ réordonner, cacher, agrandir, réglage `vrm_tuiles_journee`), puis
**retirée entièrement sur la décision de Julien** (message du coordinateur) : plus de module, de réglage
synchronisé, de textes, de styles ni de contrôles de banc. Ma journée garde la grille Bento FIXE décrite
ci-dessus. Ne pas la remettre sans qu'il la redemande.

## Inventaire : tout ce que l'écran montrait et faisait, et où c'est maintenant

| avant | maintenant |
|---|---|
| bonjour, titre, phrase du jour + « ? », aide de première fois (`AccPremiereFois`) | la tête |
| prochaine chose en tête (`data-prochain`) | la 1re carte de « À faire » (`data-prochain`) |
| frise 7 jours qui se touchent, semaine passée, « Ma semaine », pile, faits, vendu du jour | l'affiche |
| carte réglable des chiffres (Bénéfice, Vendu, Reçu, Modifier, aide) | tuile du mois |
| case « À envoyer » + « Imprimer » (parcours d'impression) | tuile « À envoyer » + le rond d'encre (même parcours) ; « Emballer » dans la tuile dépliée |
| case « À retirer », « Messages », « Prix à baisser » (`data-tuile`, `data-n`, photos) | tuiles (mêmes `data-*`, photos dans le déplié) |
| alertes urgentes (double vente, N° en double, colis en retard…) | en tête, au-dessus de la grille |
| À trancher (en place), vendus ailleurs, deux fois, avis bas, photos entre comptes, à relier, suivi à vérifier, sortie de stock, santé des comptes, pas en ligne, republier, URSSAF + « Noter », favoris, litiges, cycles, Leboncoin « Supprimer », clôture, atelier, inventaire, à ranger… et leurs feuilles | « À faire » (mêmes cartes, mêmes feuilles) |
| prix d'achat à saisir, offres Vestiaire, messages eBay / Vestiaire | tuiles « Sans prix d'achat », « Offres », « Messages » |
| « Rien à faire » / « pas lu » / illustration | inchangés (sous la grille) |
| prévision du mois, Quoi de neuf, rappels du jour | lignes sous la grille |
| panne (`LignePanne`), guide de premier jour, accueil des nouveaux (`AccueilResteJournee` : N° sur cartons, ce que VRM a trouvé, essai, conseil du jour, appel de bienvenue) | inchangés |
| notifications coupées, guide de démarrage, « Modifier ma journée » + feuille | en bas, « Modifier ma journée » en touche |
| import de l'historique, veille, soldes à remettre | inchangés |
| instantané d'ouverture, modération, forme Vinted, vérifications, note de satisfaction (hors du composant) | inchangés ; l'instantané au même habit |
| mode exemple | inchangé (banc `studio-journee` joué dessus) |

Banc `studio-journee` I : 21 fonctions mesurées présentes ; avec `AVANT=` (le dist d'avant), chaque fonction
et chaque carte « À faire » d'avant est encore là, avec les mêmes compteurs.

## Les boutons (note t25)

Quatre formes : `sb-btn-plein` (un seul : « Imprimer »), `sb-touche` (« Emballer », « Terminé », « Modifier ma
journée » ; 44 px au doigt), `sb-rond` (« × », œil, taille : 44 px), `sb-lien` (« Ouvrir Colis › », « N
autres › », « Semaine du … », « Ma semaine », « Modifier » du mois, « Ranger les tuiles », « Revenir à
l'origine »). Une tuile et une rangée se touchent entières. Les pilules des cartes de « À faire » (« Noter »,
« Supprimer », réponses des cycles) prennent la forme touche.

## Technique

- `src/design/studio-journee.css` : tout est porté par `.sj-journee`, dans une couche `@layer sj-studio`
  **déclarée en premier** (index.html, en tête du premier `<style>`) : ses `!important` passent avant ceux de
  `vrm-premium` (Cascade 5). Les jetons et les quatre formes sont une **copie provisoire** du contrat
  (`/* provisoire : vient de studio.css */`) : à retirer quand la fondation est fusionnée. Le fond (lumière de
  studio) aussi est provisoire (`body:has(.sj-journee)` et un plan fixe).
- Polices : `var(--sb-police-affiche)` retombe sur Inter / le système tant que la fondation n'a pas posé
  Urbanist (`--sb-police-affiche-fondation`).
- `JOBS_TUILE_JOURNEE`, `caseEnTuileJ` (src/App.jsx) ; `listeCodesRetrait` (une écriture, deux lecteurs).

## Preuves

- `npm run build` ; audits verts : traduction (45/45), tdz, variables, coherence, composants, violet,
  rouge-doublon (le rouge `--sb-doublon` porté par `.sb-plaque.is-double`), quoi-de-neuf, identite.
- `scripts/bancs/studio-journee.cjs` (390 tactile et 1512, clair et sombre, mode exemple) : T chaque tuile et
  son geste, D déplier / replier (tassé au téléphone, dessous sur ordinateur, focus rendu), P un seul plein
  (fermé et déplié), C 44 px, A contraste AA mesuré sur les jetons rendus (24 paires) et sur chaque texte des
  tuiles, O rien ne déborde, I inventaire (et avant → après). Mutations (`MUTATION=deux-pleins|
  deborde|contraste|petit|perdu`) : chacune rend le banc rouge. Sur le dist d'avant : rouge (pas de grille).
- Bancs adaptés (la disposition a changé exprès, aucune règle affaiblie) : `journee-v2` (le € remonté sans
  espace ; la prochaine chose = 1re carte de la liste), `journee-perso` (ordre lu sur tout l'écran ; « N
  gestes » = les cartes de la liste), `journee-premium` (les gestes sont les quatre tuiles de la grille stable ;
  jamais une carte « À faire » à zéro), `journee-photos` (la tuile « À envoyer » porte la pile ; les photos de « À retirer », « Messages »,
  « Prix à baisser » sont lues dans la tuile dépliée, par identité).
- Résultats complets des bancs et rouges qui ne viennent pas de ce lot : voir le rapport de fin de session
  (section ci-dessous).
- Captures avant / après : `docs/design/avant-apres/journee-studio-*.png` (mode exemple, données inventées).

## Résultats des bancs (fin de session, dist final, 3 bancs à la fois)

| banc | ce lot | base (`claude/integration-refonte`, même machine) |
|---|---|---|
| studio-journee | vert (4 combinaisons ; mutations rouges ; base rouge) | rouge (pas de grille) |
| journee-instantanee, ouverture-instantanee | verts | verts |
| journee-perso, journee-premium, journee-mieux, journee-chiffres | verts | — |
| accueil-reste, exemple-photos, garde-ecrans | verts | — |
| journee-coherence | 1 rouge : E0 sur l'écran **Ventes** (`.vrm-fu-modifier` hors carte) | le même rouge |
| journee-v2 | 8 rouges : T sur l'écran **Ventes** (filtre « À envoyer ») | les mêmes 8 (+ 4 U) |
| journee-photos | 5 rouges : J1 « prix à baisser » (0 conseil dans sa base) et C1 (navigation Achats) | les mêmes 5 |
| ebay-messages-journee | 4 rouges : B (la case mène à eBay), C (`data-ebay-msg-passu` n'existe plus) | 10 rouges (dont ces 4) |
| benefice-journee | 12 rouges | les mêmes 12 |
| journee-widgets | « garde réseau » (le banc joint l'authentification réelle) | le même |

Aucun rouge propre à ce lot. Audits : les 624 joués sur les deux arbres ; seuls rouges propres à ce lot à mi-chemin,
`audit-vendeurs-differents` B2 (adapté : les compteurs de la grille) et `audit-recherche-unique` (une mesure de
temps sous charge, verte rejouée seule) ; tous les autres rouges sont aussi sur la base.

## Geste de Julien

Aucun : ouvrir Ma journée.
