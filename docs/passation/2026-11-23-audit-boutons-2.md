# 23 novembre 2026 — Audit « chaque bouton marche », 2ᵉ passe (`claude/audit-boutons-2`)

Suite de `2026-11-23-audit-boutons.md` (PR #1306, fusionnée). Mission : relancer le robot
`scripts/bancs/chaque-bouton.cjs` par morceaux, `PROFONDEUR=2`, sur les sous-écrans que la 1ʳᵉ passe n'avait pas
atteints (Argent et ses onglets, Messages, E-mails, fiches, feuilles Relier / Bordereau / Publier, Paramètres en
profondeur, écrans eBay / Leboncoin / Vestiaire), à 390 tactile et 1512, et corriger. Hors mission : vide à gauche et
titre rogné à 1512 (agent dédié).

## ÉTAT RÉEL (24 nov., fin de la reprise) — à lire d'abord

- Branche à jour de `main` (vrai `git merge`, deux fois : e516755ce le 23 au soir, 3ff9579ce le 24). PR : voir la fin.
- Corrigés par la 1ʳᵉ session entre 15:37 et 20:02 (le récit d'origine, plus bas, s'arrête à 10:54 et ne les nomme pas) :
  - **Achats / Ventes (fiche d'un achat, au téléphone)** : « Relier » depuis un achat, l'atelier Glisser, la note interne,
    le reçu d'achat et « Revendu combien ? » s'ouvraient DERRIÈRE la page poussée du natif (z 18000) — invisibles, la croix
    touchait la fiche. Passés au-dessus (18500 / 18600) — `src/ecrans/Comptabilite.jsx`.
  - **Retrouver un colis** : « OK » grisé dit pourquoi (« Tape d'abord le n° de suivi ») — `src/ScannerRetrouver.jsx`.
  - **Tableaux (menu Colonnes)** : la case « Article », toujours montrée, dit pourquoi elle est grisée — `src/natif/TableauTravail.jsx`.
  - **Paramètres → Changer mon e-mail / mot de passe** : « Enregistrer » grisé dit pourquoi — `src/ecrans/Reglages.jsx`.
  - Textes en 5 langues (`scanRetrouver`, `tableau`, `uxReglages`).
  - Robot : `BORNE=1` (n'explore plus les écrans hors du morceau) ; un champ resté actif est quitté avant chaque toucher ;
    un compteur entier n'est pas éprouvé comme un montant ; un choix de menu (`menuitem`) qui referme son menu n'est pas
    un « retour ailleurs » ; exceptions : feuilles d'actions « Colis » et « Gestes », « Relier achats et ventes »,
    menu « Statut », adresse e-mail en ligne.
- Reprise (24 nov., cette session) :
  - **Robot** : deux exceptions ne reconnaissaient PLUS leur clé réelle (le motif attendait `||INPUT`, la clé dit
    `|| INPUT` — un espace) : le menu « Statut » et l'adresse e-mail en ligne. Rejoué à la main avant de les réparer : cocher
    un statut garde le menu ouvert, Échap le ferme. L'autotest éprouve désormais chaque exception qui porte un `exemple`
    (une clé relevée) — **rouge avant** (3 exceptions muettes), vert après.
  - **Ventes · eBay « À traiter », 390** : le rond « Retrouver un colis » tombait sur les segments (« Offres » le couvrait,
    il cachait le mot) — le grand titre est dans la coque, la tête ne portait plus que ce rond, en absolu. Sans titre, il
    reprend sa place dans le flux (`src/designV2/design-v2.css`). Banc `scripts/bancs/retrouver-libre.cjs` : **rouge avant**
    (390 : au centre « Offres »).
  - « Vérifier mes prix » (Argent → Statistiques) : **non reproduit** sur l'arbre fusionné. Sonde : départ `TAB=compta` puis
    `TAB=invoices`, saut vers `dashboard`, 390 et 1512 : la feuille s'ouvre, Échap la ferme, le retour la ferme et reste sur
    Statistiques. Rien à corriger.
- Le lanceur `$SCRATCH/cbs/morceaux.sh` était PERDU (et le second aussi : le dossier de travail est partagé et a été vidé
  pendant la nuit). Équivalent : pour chaque lettre, `BANC_DIST=<dist> VUES=<tel|ordi> ECRANS=<morceau> PROFONDEUR=2
  BORNE=1 DUREE_MAX=3000 SORTIE=<dossier> node scripts/bancs/chaque-bouton.cjs` — sur la machine partagée, PRÉFIXÉ par le
  verrou des commandes lourdes (`lourd.sh`, 3 créneaux).

### Preuves (rouge avant, vert après ; builds `dist-avant` = arbre fusionné sans les correctifs, `dist-fix` = avec)

| contrôle | avant | après |
|---|---|---|
| autotest du robot (exceptions éprouvées sur leur clé) | ROUGE : 3 exceptions muettes | VERT |
| `retrouver-libre.cjs` (rond libre sur Ventes · eBay « À traiter ») | 3 OK / 1 KO (390 : au centre « Offres ») | 4 OK / 0 KO |
| `retour-relier-ebay.cjs` (Ventes en trois retours) | 4 OK / 2 KO (settings · settings · settings, aux deux tailles) | 6 OK / 0 KO |

Rejoué sur l'arbre fusionné du 24 à 16 h (gris clair) : les deux bancs verts, la capture regardée. ⚠️ L'autotest y a été
une fois ROUGE sur la machine saturée (un fautif pas attrapé à temps), vert au second passage sans rien changer : sous
forte charge, le relancer avant de conclure.
Capture regardée (390, après) : le rond sur sa ligne, à droite, au-dessus des segments ; « Offres » lisible et libre.
⚠️ Reste au téléphone un retour « à vide » : Comptes eBay → (retour) Paramètres → (retour) Paramètres → (retour) Ventes
(l'entrée de l'écran Paramètres posée avec la demande « ebay »). Plus de piège, mais un geste de trop : à reprendre si
Julien le remarque (piste : poser l'onglet avec sa section finale avant que la page poussée n'empile la sienne).

## Ce qui reste

- Vider la file de chaque morceau (20 à 46 états restés à chaque fois, sauf E à 390) : relancer un morceau avec
  `DUREE_MAX` plus long, un à la fois, sur une machine moins chargée.
- E à 1512 : à rejouer en entier (deux fois coupé, 0 défaut sur les 6 premiers états).
- Morceaux A et B : faits par la 1ʳᵉ session sur l'arbre d'avant la fusion ; pas rejoués sur l'arbre fusionné.

### Chiffres de la reprise (arbre fusionné)

| morceau | vue | états | touchés | défauts non admis | admis | file restante (temps) |
|---|---|---|---|---|---|---|
| C ventes, achats | 390 | 5 | 196 | 0 | 0 | 32 |
| C ventes, achats | 1512 | 14 | 210 | 4 → 0 (menu « Statut » : exception réparée) | 6 | 46 |
| D annonces, garage | 390 | 18 | 231 | 0 | 28 | 23 |
| D annonces, garage | 1512 | 25 | 230 | 0 | 3 | 20 |
| E paramètres, comptes, extension, automatismes | 390 | 7 | 114 | 0 | 2 | 0 (fini) |
| E … | 1512 | ≥ 6 (coupé deux fois : arrêt de la machine, puis file des commandes lourdes) | — | 0 jusque-là | — | — |
| F leboncoin, ebay, vestiaire, agent, messages eBay, prix | 390 | 7 | 173 | 2 (voir dessous) | 0 | 27 |
| F … | 1512 | 10 | 161 | 1 (« Relier eBay », le même) | 3 | 43 |

Morceau F, les deux défauts (les racines `plat_*`, `ebay_agent`, `ebay_messages`, `prixmarche` mènent aujourd'hui à
Ventes, Annonces, Messages, Argent avec leur site) :
- le rond « Retrouver un colis » recouvert à 390 (corrigé, ci-dessus) ;
- **« Relier eBay » (Ventes · eBay « À traiter ») puis retour** : un PIÈGE, aux deux tailles. La page Paramètres → Comptes eBay
  posait son entrée d'historique, puis la section revenait à « reglages » (`onOuvert`) en empilant une entrée AU-DESSUS ; le
  retour retombait sur la page, qui ré-empilait — plus moyen de revenir à Ventes (sonde : `push settings/ebay`,
  `push …vrmFeuille`, `push settings/reglages`, puis à chaque retour `POP …vrmFeuille` + `push settings/reglages`). Corrigé dans
  `src/App.jsx` : ce retour à la section n'empile rien (`histoRef.silence`), et une entrée « settings + ebay » rejouée rend
  Paramètres. Banc `scripts/bancs/retour-relier-ebay.cjs` (Ventes en trois retours au plus).

⚠️ Avec `DUREE_MAX=3000`, aucun morceau (sauf E à 390) ne vide sa file : 20 à 46 états restent par morceau (une
rangée de 400 éléments prend ~10 min sur la machine partagée). Les écrans racines et leurs premiers segments / feuilles
sont faits ; les feuilles de 2ᵉ rang ne le sont pas toutes.

## Historique : l'état écrit à 10:54 le 23 (dépassé)

- Branche partie de `main` = 5cee8d334 (fusion de #1306). Poussée. **Aucune PR ouverte.**
- **Arrêté à 10:54 UTC** sur consigne (machine saturée avant la démo de Julien : aucune commande lourde avant
  15:30 UTC ; aucune fusion sur `main` entre 15:00 UTC et demain 07:00 UTC sans autorisation).
- Lanceur des morceaux : `$SCRATCH/cbs/morceaux.sh <tel|ordi> <dist> <sortie>` (six morceaux A–F, `PROFONDEUR=2`,
  `DUREE_MAX=3000` s chacun) :
  A `compta,invoices,dashboard` · B `messages,emails,cat_msg,adistance` · C `ventes,achats` · D `annonces,garage` ·
  E `settings,vintedaccounts,extension,automatisations` · F `plat_leboncoin,plat_ebay,plat_vestiaire,ebay_agent,ebay_messages,prixmarche`.
  Fait avant l'arrêt : A (390 et 1512), B (390 et 1512, partiel), C à 1512 commencé. **À reprendre : C, D, E, F.**
- Avec `PROFONDEUR=2`, le robot quitte vite le morceau (un lien de la coque ⇒ Aujourd'hui, Annonces…) : peu d'états
  du morceau par heure. Piste : borner l'exploration aux écrans du morceau (à faire dans le robot).

## Chiffres provisoires (avant l'arrêt)

| morceau | vue | états | éléments touchés | défauts |
|---|---|---|---|---|
| A Argent | 1512 | 5 | 169 | 2 (un seul cas, voir plus bas) |
| A Argent | 390 | 7 | 163 | 1 (faux positif du robot, corrigé) |
| B Messages… | 1512 | 20 | 357 | 3 (1 faux positif du robot, 1 admis, 1 à éclaircir) |
| B Messages… | 390 | 9 | 126 | 1 (admis) |

## Le robot (corrigé)

- Un champ resté actif d'un toucher d'avant cachait l'effet « focus » du toucher suivant (« Ajouter un achat hors
  plateforme » vu « sans effet » alors que le doigt était déjà dans le champ) : il est quitté avant chaque toucher.
- Une fenêtre ouverte vide PUIS écrite (le récap imprimable d'Argent → Déclarer) n'est pas un « lien cassé ».
- L'aide « ? » qui passe la main à la visite / au signalement est admise sur tous les écrans (pas seulement Aujourd'hui).

## À éclaircir à la reprise

- Argent → Statistiques → « Vérifier mes prix » (feuille « Prix d'un site à l'autre ») : dans le parcours, Échap ne la
  fermait pas, puis le retour a quitté l'app. Rejoué seul (entrée directe sur Statistiques) : Échap la ferme. Hypothèse :
  une entrée de feuille laissée par l'écran Argent gardé en arrière-plan (Résumé / Factures) reçoit l'Échap. Sonde prête
  (`ALLER=dashboard` depuis `TAB=compta`), pas encore jouée.
