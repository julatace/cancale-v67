# 5 nov. — Chantier G : Messages, E-mails, Communauté

Feuille de route : `docs/passation/2026-11-05-revue-coherence.md` (points 2.23, 2.24, 1.10,
3.8) et l'amélioration « Offres Vestiaire qui expirent ». Branche locale `v35-chantier-g`,
partie de `claude/project-review-nsk5su` (a8e580d2). Rien dans `vinted-sync-extension/`,
rien dans `public/`. Composants partagés UTILISÉS tels quels (`EtatPanne`, `ChampRecherche`,
`Numero`, `PhotoVide`, `Bouton`, `PAS_SU`, `VERBES`, `L`) — aucun n'est modifié.

## Ce qui change (les points de la revue)

### 2.23 — Messages, une forme
- **Filtres** (« Toutes · À répondre · Non lues · Offres reçues ») : classe `vrm-filtres` ⇒ le
  dessin des AUTRES filtres de l'app (pilule pleine sans bordure, 44 px, 13/600, l'actif en
  encre, `#636366` la nuit). Avant : contour gris 36 px, fond de page.
- **Un style de lien en pied** : `.vrm-pied-lien` (styles-messages.css) — encre, 15/600, sans
  soulignement ni aplat, 44 px de cible, l'appui se voit. Posé sur « Afficher les N suivantes »,
  « La remettre », « Réessayer » (boîtes en panne), « Afficher tous les résultats », « Effacer la
  recherche », « Modifier » (réponses rapides), « Ouvrir sur Leboncoin ↗ », « Ouvrir la
  messagerie ↗ » et « Répondre sur Vestiaire ↗ » (bleus avant), « Mes adresses de réception → ».
  Marqué `data-pied-lien`.
- **Colonne des conversations à l'ordinateur** : 368-420 px (300 px fixes avant, posés par
  styles-bureau.css à 1440 px et plus ; la règle de styles-messages.css est désormais plus
  spécifique), la fiche 240-272 px. Et le **compte passe sur la ligne de la paire** : sur la
  ligne du pseudo il le coupait (« mathilde_sn… · bou… »). Aucun pseudo coupé (mesuré).
- **Favori** : l'icône `heart` de l'app partout (Leboncoin « Favoris reçus » et le nombre de
  favoris d'une annonce) — plus le glyphe ♡.

### 2.24 — UN seul écran « E-mails »
- Paramètres → « E-mails » est une ligne de navigation (chevron) qui OUVRE l'écran E-mails sur
  son onglet « Relier ma boîte » (`ouvrirEmailsRelier(vers)` + `setTab('emails')`). Plus aucun
  sous-écran d'e-mails dans Paramètres. L'attribut `data-sous-ouvrir="adresses"` reste sur la
  ligne (les bancs qui passaient par là touchent le même endroit).
- L'onglet « Relier ma boîte » porte en tête l'ancien sous-écran (`EmailsSetting`, inchangé dans
  ses lectures et écritures : Aperçu · Journal · Adresses · À rattacher), puis l'accompagnement
  animé (`RelierBoite`) sous « Faire suivre tes e-mails, pas à pas ». Le second niveau prend le
  dessin des filtres (deux contrôles segmentés empilés se confondaient) ; « E-mails » dans
  l'écran « E-mails » devient « Journal » (nom accessible gardé).
- Toutes les portes vers les adresses mènent à l'écran E-mails : Ma journée (« e-mails que
  personne ne peut récupérer »), le bandeau de confirmation d'adresse, l'entrée « Tes e-mails, ce
  que VRM en a fait » de Colis, « Mes adresses de réception → » du guide, le dépannage de
  Paramètres. `vrm:ouvrir-adresses` bascule l'écran sur « Relier ma boîte ».
  ⚠️ Deux lignes HORS zone touchées pour ça (la destination seule) : le geste de Ma journée
  (`tab:'emails'`) et l'entrée Journal de Colis (`onNav('emails')`).

### 1.10 — `EtatPanne` partout dans la zone
E-mails : boîte, lecture d'un e-mail, suite de la boîte, aperçu de la réception (première
lecture et relecture), transfert, journal et sa suite, adresses non lues (pastille « Lecture
indisponible » sans geste avant), confirmations non lues, e-mails mis de côté non lus.
Communauté : la carte, le classement (la période reste choisissable ; sa phrase est celle du
classement, plus celle de la carte), les groupes, un fil. Messages : Vinted (« Impossible de
charger ces données » + aplat bleu avant), un fil Vinted (« Erreur : <code> » avant),
Leboncoin, ses favoris, Vestiaire — chacun avec SON « Réessayer » qui relit.

### 3.8 — Plus d'« Actualiser » à côté de « Réessayer »
Aperçu des e-mails (le bouton devenait « Réessayer » ET une alerte disait « Réessayer »),
journal, boîte (le bouton « Actualiser » d'une liste vieille d'une minute restait pendant une
panne), Messages · Vinted (l'icône de relecture et « Réessaie avec ↻ Actualiser » à côté d'une
boîte en panne ⇒ un bouton « Réessayer » dans le bandeau, l'icône se tait), fil Vinted en panne.

### Offres Vestiaire qui expirent
`expireBientot(o, maintenant)` (src/offresVestiaire.js) : offre REÇUE, à toi de trancher,
échéance LUE dans moins de 6 h (6 h pile : non ; pas lue : non). La carte d'offre
(`data-vc-offre-bientot`) écrit « expire dans 3 h » en AMBRE (`--vrm-warn`), une seule fois ;
la pastille « offre 180 € » de la liste reste neutre ; le temps restant est recalculé chaque
minute (rien n'est relu sur le réseau). **Vinted : rien** — aucune autre source n'importe la
règle, et le code des offres Vinted n'écrit jamais qu'une offre expire (audit E4).

## Les retouches, une par ligne (avant → après)

Messages · Vinted
1. Filtres en contour gris 36 px → pilules pleines `.vrm-filtres` 44 px, comme Ventes ou Stock.
2. « À répondre 0 », « Non lues 0 » → le compteur ne s'écrit plus quand il vaut 0.
3. Recherche : champ teinté posé dans un champ bordé → `ChampRecherche` (loupe, croix ronde, micro, 17 px au doigt) ; « Pseudo, article, N° de rangement… » → « Pseudo, article, N°… ».
4. « Recherche sur tous les comptes actifs. Le filtre de conversation reste appliqué. » → « Sur tous tes comptes. Le filtre reste appliqué. », bouton au style du pied.
5. Panne : « Impossible de charger ces données » + aplat bleu → `EtatPanne` (« Tes conversations Vinted : pas su pour l’instant. », la raison, Réessayer).
6. Boîte d'un compte en panne : « Réessaie avec « ↻ Actualiser » » → un bouton « Réessayer » dans le bandeau ; l'icône de relecture se tait tant qu'il est là.
7. L'icône de relecture : « Actualiser les conversations » → « Relire les conversations ».
8. Bandeau « N offres au-dessus de ton prix mini » : contour et fond BLEUS → carte neutre, chevron, 44 px ; « ouvre-la pour accepter en 1 tap » → « accepte en 1 tap ».
9. Pseudo coupé par le compte (« mathilde_sn… · bou… ») → le compte passe sur la ligne de la paire ; le pseudo a toute sa ligne.
10. Colonne de 300 px à l'ordinateur → 368-420 px ; la fiche 240-272 px.
11. Heure d'un non-lu en TEXTE BLEU (`C.accent`) → encre ; le point bleu reste seul à dire « non lu ».
12. Pastille « Offre 100 € en attente » en texte bleu bordé de bleu → encre grasse, filet neutre.
13. « Afficher les 40 suivantes · 40/45 » → « Afficher les 5 suivantes » + « 40 sur 45 » en sourdine, au style du pied, sur toute la largeur.
14. « La remettre » : bouton bordé → lien de pied.
15. Recherche sans résultat (12 px gris) → 13 px, « Essaie un pseudo, un mot de l’article ou « N°12 » » + « Effacer la recherche ».
16. État vide : « Aucune conversation captée pour l'instant — elles arrivent quand… » → un titre « Aucune conversation pour l’instant » et LE geste (« Ouvre ta messagerie sur vinted.fr dans Chrome »).
17. Réponses rapides : le titre écrit deux fois (repli + carte) → une fois ; une phrase dit l'usage (« Un tap copie… »).
18. Réponses rapides : « Modifier » en bleu 12 px → lien de pied ; « ✓ Copié ! » → « Copié » ; « ＋ Ajouter » bleu en pointillé → « + Ajouter » neutre.
19. Réponses rapides : pastilles de 26 px → 36 px à la souris, 44 px au doigt ; la croix « × » ambre sans nom → corbeille nommée (« Supprimer « … » »).
20. Fil : « Erreur : <code> » ambre → `EtatPanne` compact (« Ce fil : pas su… », Réessayer qui relit le fil).
21. Fil : « Chargement… » → « Ouverture de la conversation… ».
22. Fil : « 📄 BORDEREAU DÉTECTÉ… » en capitales bleues sur fond bleu → « Bordereau trouvé dans la conversation », icône, carte neutre.
23. Fil : pastille N° faite main (blanche en sombre) → `Numero` ; la fiche : `Numero` grand.
24. Fil en panne : l'icône « Actualiser la conversation » se tait (le « Réessayer » de la panne suffit).
25. Fil : offre « 100,00 » / « au lieu de 55,00 € » → `montant()` : « 100 € », « au lieu de 55 € » (une autre devise est dite).
26. Ligne : l'appui se voit tout de suite (opacité 0,6 au toucher, 120 ms).
Messages · Leboncoin
27. « ♡ Favoris reçus » (glyphe) → icône `heart` de l'app ; le « ♡ » après un nombre de favoris → la même icône.
28. « CA finalisé — / En attente — » au-dessus des conversations → retiré de Messages (Leboncoin ET eBay : ce sont des montants de ventes).
29. Panne : une phrase grise sans geste → `EtatPanne` avec Réessayer qui relit + « Ouvrir sur Leboncoin ↗ ».
30. « Ouvrir mes messages Leboncoin ↗ » (lien d'action 13 px) → « Ouvrir sur Leboncoin ↗ », lien de pied.
31. État « jamais relevé » : aplat bleu fait main → `Bouton` primaire.
32. « Chargement… » → « Lecture en cours… » (`PAS_SU.enCours`).
33. Favoris reçus en panne : phrase sans geste → `EtatPanne` + Réessayer qui relit.
Messages · Vestiaire
34. Panne : phrase sans geste → `EtatPanne` + Réessayer.
35. « Ouvrir la messagerie » bleu souligné collé au texte → lien de pied, aligné à droite de la ligne des non-lus.
36. Chaque ligne s'appelait « Vestiaire » → le nom de l'ARTICLE (Vestiaire ne donne jamais celui de l'acheteur) ; « Pas reliée… » seulement sans titre ni N°.
37. Heure d'un non-lu en bleu → encre.
38. Offre qui expire dans moins de 6 h : « reste 3 h » gris → « expire dans 3 h » en ambre, sur sa ligne — une seule fois dans Messages.
39. Le temps restant ne bougeait pas écran ouvert → recalculé chaque minute.
40. « Offres » → « Offres reçues » ; les offres envoyées sans titre → « Tes offres envoyées » ; « ton offre 75 € · 2 h » → « 75 € · reste 2 h ».
41. Vignette vide (un rectangle gris) → `PhotoVide`.
42. N° gras écrit à la main → `Numero`.
43. « Répondre sur Vestiaire ↗ » en bleu → lien de pied (encre).
44. À 1512 px, Messages · Vestiaire rétréci et centré (402 → 1352 px) → toute la largeur, aligné sur le titre.
E-mails
45. Deux écrans (E-mails, Paramètres → E-mails) → un seul ; Paramètres y mène (ligne avec chevron).
46. Dépannage « Ouvrir la réception des emails » → « Relier ma boîte » (même destination que Paramètres).
47. Ma journée, bandeau de confirmation, Colis → l'écran E-mails, plus Paramètres.
48. Onglet « E-mails » dans l'écran « E-mails » → « Journal ».
49. Deux contrôles segmentés empilés → le second niveau en filtres.
50. Le guide animé sans titre sous l'aperçu → « Faire suivre tes e-mails, pas à pas » ; « Mes adresses de réception → » ouvre l'onglet Adresses et remonte (au lieu de partir dans Paramètres).
51. Boîte en panne : bloc fait main (« — VRM n’a pas pu… ») → `EtatPanne`.
52. Lecture d'un e-mail en panne → `EtatPanne` ; la suite de la boîte en panne → `EtatPanne` avec Réessayer.
53. « Actualiser » d'une liste vieille d'une minute restait pendant une panne → masqué.
54. Aperçu : « Actualiser » devenait « Réessayer » ET une alerte disait « Réessayer » → `EtatPanne`, un seul geste.
55. Transfert pas lu : phrase + bouton nu → `EtatPanne` ; « Lecture de la configuration… » → « Lecture du transfert… ».
56. « Chercher un e-mail précis » : champ nu → `ChampRecherche` ; « Tous les états » → lien de pied.
57. Journal en panne → `EtatPanne` ; sa suite : « La suite n’a pas pu être lue. Réessaie. » SANS bouton → `EtatPanne` avec Réessayer ; « Actualiser » masqué pendant la panne.
58. Adresses pas lues : pastille « Lecture indisponible » sans geste → `EtatPanne` (« elle n’est pas réécrite tant qu’elle n’est pas lue »).
59. Confirmations pas lues : « rouvre cet écran dans un moment » → `EtatPanne` avec Réessayer.
60. E-mails mis de côté pas lus : même chose → `EtatPanne` avec Réessayer.
61. Pastille « Bloqué » ambre (aucun geste) → neutre.
62. Recherche des e-mails à rattacher : champ dans un libellé → `ChampRecherche`.
63. « email(s) » → « e-mail(s) » dans tout le texte de « Relier ma boîte » et du journal (vocabulaire de la revue).
64. « Chargement des e-mails… » → « Lecture en cours… ».
Communauté
65. Carte en panne : texte gras + bouton gris dans une carte → `EtatPanne`, hors carton.
66. Classement en panne : `EtatPanne` avec la phrase du classement et « Ce n’est pas un classement vide » ; la période reste choisissable au-dessus (elle disparaissait).
67. Groupes en panne → `EtatPanne`.
68. Un fil en panne → `EtatPanne` compact.
69. Onglets « Carte · Classement · Groupes » : l'actif était un trou NOIR en sombre → le dessin du segmenté de l'app (piste remplie, actif `#636366` la nuit, blanc le jour), 36 px à la souris.
70. « Chargement de la communauté… » → « Lecture en cours… ».
Encore Messages
71. (essayé puis RETIRÉ) taire « · boutique_test » sur les lignes du compte ouvert : la règle du banc `messagerie` est « le compte est nommé sur chaque ligne (la liste mélange les comptes) » — gardée. Le compte reste sur la ligne de la paire (n° 9).
72. Messages · eBay : « Actualiser » en couleurs écrites en dur (#B8B8BC sur #262628 la nuit, F1 de `fusion-app`) → le bouton commun (`BoutonBase` secondaire petit, jetons), occupé pendant la lecture.

## Preuves
- **État final (après la fusion de `claude/project-review-nsk5su` c534f843, finition v33 de
  l'écran E-mails gardée)** : `vite build` vert ; banc G **108 ✅ · 0 ❌** ; `boite-emails`
  **278 ✅ · 0 ❌** ; `fusion-app` limité à la zone (`BANC_ECRANS='^(messages|communaute)'`,
  Messages × 4 sites + Communauté, 4 vues) **124 ✅ · 0 ❌** (le F1 « Actualiser » de Messages ·
  eBay a disparu) ; `jetons-coherence` **rien à signaler** ; audits de la zone verts,
  `audit-offres-expirent --mutation` 9/9 ; `tests/espace-emails-interface` 57/57.
- `npm run build` (vite build) vert, après la fusion de `claude/project-review-nsk5su` (ea4a1ad6).
- **Banc `scripts/bancs/messages-emails-communaute.cjs`** (données inventées, 390 tactile et 1512,
  clair et sombre, 9 scénarios : Messages Vinted / Vinted en panne / Leboncoin / Vestiaire,
  E-mails boîte + Relier / Paramètres → E-mails / E-mails en panne, Communauté en panne /
  classement en panne) : **après 108 ✅ · 0 ❌** ; **base (`claude/project-review-nsk5su`
  a8e580d2, arbre `git archive` construit à part, banc copié dedans) 64 ✅ · 44 ❌** — G1 ×4,
  G2 ×4, G3 ×4, G4 ×4, G5 ×8, G6 ×12, G6/G7 ×4, G8 ×4. **`BANC_MUTATION=1`** (filtres en
  contour 36 px, colonne de 300 px, lien de pied en bleu, temps restant sans ambre, remis dans
  la page) : G1 ×4, G2 ×4, G3 ×4, G8 ×4 (et G9 ×4) rougissent — 40 ✅ · 20 ❌.
  Le banc relance son navigateur s'il est fermé en route (machine partagée : un navigateur
  tué ne rend plus tout le banc rouge) ; la visibilité se juge par `checkVisibility()` (un
  bouton dans un `<details>` fermé a un `offsetParent`).
- **Audit `scripts/audit-offres-expirent.cjs`** (règle exécutée sur la vraie forme de
  `vc_offres`) : 8 verts ; `--mutation` : 9/9 mutations rouges (seuil 24 h, « pas su » vaut
  « bientôt », offre passée, 6 h pile, carte qui ne lit plus la règle, pastille de liste
  ambre, Vinted qui importe la règle, une offre Vinted « expirée », ambre hors `--vrm-warn`) ;
  sur la base : 5 rouges (la règle n'existe pas).
- Audits verts après : `audit-rouge-doublon` (et `--mutation`), `audit-composants`,
  `audit-coherence`, `audit-identite`, `audit-icones`, `audit-fonctions-api`,
  `audit-boite-emails` 80, `audit-accompagnement` 40, `audit-vc-messages`, `audit-offres-email`,
  `audit-lbc-messages`, `audit-lbc-repondre` 31, `audit-argent-offres-masquees`,
  `audit-ebay-messages-nonlus`, `audit-communaute-sql` 206, `audit-favoris-ecran` 42.
  `audit-vc-offres` : 15 rouges, les mêmes sur la base (dates de fixtures périmées).
  `audit-politique-hotes` : 1 rouge, le même sur la base.
- Tests de composants : `scripts/tests/espace-emails-interface.cjs` 57/57,
  `reception-synthese-interface.cjs`, `journal-email-reessai.cjs` verts.
- **Bancs ou tests ADAPTÉS** (ils jugeaient l'ancien rendu, pas la règle) :
  · `tests/espace-emails-interface.cjs` : le harnais qui recopie `EmailsSetting` importe aussi
    `EtatPanne`, `ChampRecherche`, `PAS_SU` (comme App.jsx) ; « emails » → « e-mails » dans
    deux phrases attendues ;
  · `audit-vc-messages.cjs` M9 : le titre de l'article peut être passé en `nom=` (la règle —
    le titre lu est affiché — est la même) ;
  · `bancs/boite-emails.cjs` : la panne se reconnaît à « pas su pour l’instant » et au bouton
    `data-etat-panne-reessayer` d'`EtatPanne` (le « — » et `data-boite-etat-geste` d'avant) ;
  · `bancs/messages-lisibles.cjs` : « 40,00 » → `40(,00)? €` (montant() n'écrit plus les
    centimes nuls).
- `fusion-app` après : 639 ✅ · 16 ❌, **aucun dans la zone** (le F1 « Actualiser » de
  Messages · eBay a disparu) ; restent Annonces (F4, F6 N°), Ventes (F8, F9 sélecteur de site),
  Compta Factures et Comptes liés (F6 bleu), Colis (F5) — d'autres chantiers.
  `jetons-coherence` après : 3 rouges, tous Stock (« au moins » en tabular-nums, autre chantier).
  `composants` après : 3 rouges « Segmente 36 px au doigt » — aucune feuille partagée touchée ici
  (`git diff` vide sur styles-coque, styles-composants, composants/, design/).
- Captures (hors dépôt, regardées) : avant
  `scratchpad/g/avant/*.png`, après `scratchpad/g/apres/*.png`, mutation
  `scratchpad/g/mutation/*.png` (dossier de session `/tmp/claude-0/…/scratchpad/g/`).

## Ce qui reste
- **Hors zone, vu en passant** : le sélecteur de compte de Messages/Ventes/Annonces écrit encore
  « 📍 » devant le compte ouvert (`SelecteurCompte`, partagé — chantier E2 ou H) ; la ligne
  « Données · À vérifier · N non confirmées » (`BilanSynchronisation`) et « Comptes Vinted ·
  lecture indisponible » (`SynchronisationVinted`) sous Messages ont deux dessins de repli
  différents ; `SynchronisationVinted` garde un bouton « Actualiser l’état » (dans son repli fermé).
- **Messages · eBay** (`src/ebayGestion.jsx`, zone eBay) : seul « Actualiser » est passé par le
  bouton commun (demande du coordinateur, F1 de `fusion-app`) ; ses autres boutons `S.button`
  restent à passer aux jetons. Le F9 « le site se choisit dans un contrôle segmenté » de
  `fusion-app` (Ventes, Messages, Achats à 1512) est `SelecteurSites` (coque, chantier H).
- **Favoris reçus · Vinted** (`FavorisConnectes`, écran Favoris) : pas touché.
- **Communauté** : bloquer / signaler / se retirer passent encore par `window.confirm` /
  `window.prompt` (la feuille commune `SheetShell` n'est pas importée par ce module chargé à part).
- **Vocabulaire** : quelques « emails » restent dans des NOMS ACCESSIBLES lus par des bancs
  (« Rubriques des emails », « Vérifier les emails mis de côté ») — à changer avec leurs bancs.
- La ligne `vrm-msg-acc` de styles-mineral.css (ellipsis du compte sur la ligne du pseudo) ne
  sert plus : le compte est sur la ligne de la paire.
