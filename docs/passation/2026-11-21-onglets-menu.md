# Onglets gardés, Menu en tuiles sous la photo — 21 nov. 2026 (branche `claude/onglets-menu`)

## Demandes de Julien
- D'abord : « réorganise totalement les onglets », « simplifie », « style Vintex », inspiré de Bleam (barre Accueil ·
  Dressing · [Publier] · Messagerie · Menu ; Menu = carte du compte, tuiles groupées, langue/thème/déconnexion en bas).
- **Puis, décision du 21 nov. : « garde les onglets »** — ceux de l'app actuelle en bas : Aujourd'hui · Annonces · Ventes ·
  Achats · Argent. Pas de disque « + », pas d'onglet Menu ni Messages ; la bulle Messages reste en haut à droite ; le Menu
  en tuiles s'ouvre par la photo du compte (il remplace l'ancien menu du profil) ; les corrections de coque sont gardées.
  (Une première version avec la barre Bleam a été faite puis remplacée le même jour ; elle est dans l'historique de la branche.)
- Défauts de coque vus sur ses captures iPhone : la pastille « 33 » des messages chevauchait la photo VRM ; grand titre ET
  petit titre centré ; recherche au-dessus du grand titre sur Achats, dessous ailleurs (audit du 20 nov. §1.2) ; deux
  recherches sur un écran (§1.3) ; pastilles de la barre qui changent de nombre d'un écran à l'autre.

Périmètre : la navigation et la coque seulement (barre du bas, barre latérale, Menu, en-tête de page, recherche de la coque,
pastilles). Le contenu des écrans, `src/copieEcran.js` et `OuvertureInstantanee` ne sont pas touchés (une autre session).

## Avant / après

| | avant (origin/main du 21 nov.) | après |
|---|---|---|
| Barre du bas (téléphone) | Aujourd'hui · Annonces · Ventes · Achats · Argent | **la même** (décision « garde les onglets ») ; aucun disque |
| En-tête (téléphone) | grand titre + bulle Messages + « Plus » + photo (menu du profil) ; champ de recherche sous le titre | grand titre ; à droite **loupe · bulle Messages · photo** (la photo ouvre le Menu) ; « ‹ Menu » à gauche sur un écran ouvert depuis le Menu ; aucun champ de la coque sous le titre ; pas de loupe sur un écran qui a SA recherche (`ECRANS_AVEC_RECHERCHE`) |
| Le reste des écrans | « Plus » (feuille) + menu du profil (deux listes d'écrans) | **écran « Menu »** (`tab==='menu'`) : carte du compte ⇒ Paramètres ; Gestion (Stock, E-mails) · Dans l'extension (Messages aux favoris, Automatismes ⇒ panneau de l'extension) · Aide (Notifications, Extension, État des actions si plusieurs comptes VRM, Communauté, Parrainage s'il est montré) ; en bas : cacher les montants, mode stream (s'il est réglé), **mode sombre, langue, se déconnecter** |
| Barre latérale (ordinateur) | 3 groupes sans titre ; la photo ouvrait le menu du profil | **les groupes du Menu** (`groupesMenu`, une source) : les cinq onglets, puis Gestion (Stock, Messages, E-mails) · Dans l'extension · Aide ; pied = carte du compte ⇒ Paramètres |
| Pastille de la bulle | posée à 24 px du bord gauche : « 33 » débordait sur la photo | ancrée au bord droit de la bulle (`natif.css`, `.n-coin-pastille`) |
| Grand titre | 6 px sous le haut sur Achats/Stock/E-mails/Messages/Paramètres (barre repliée), 44 px ailleurs | **au même endroit partout** (barre de 44 px sur tous les écrans, en-têtes ramenés à 2 px — `natif.css`, fin) : 42–46 px sur 10 écrans |
| Pastilles | Ventes/Achats/Annonces + les « à régler » de l'écran courant (`plusRegler`) : le nombre changeait d'un écran à l'autre | **une source par compteur** (`badgesStables` : `vrm_colis_aposter` ⇒ Ventes, `vrm_colis_retirer` ⇒ Achats, `msgNonLus` ⇒ bulle) ; Annonces ne porte plus le nombre d'annonces (pas un geste, audit §2.5) |
| Historique | d'un onglet à un autre : remplacer | idem ; un écran du Menu EMPILE (le retour ramène au Menu) ; deux segments d'un même écran (Argent ↔ Statistiques, Ventes ↔ Litiges) se remplacent |
| Écrans montés (`{tab==='…'`) | 23 | 24 (+ `menu`) — `tab===` : 54 ⇒ 56 ; `<BottomBar` 1, `<LateraleNative` 1, `<TeteNative` 1, `<EcranMenu` 1 |

Rien n'est perdu (banc O6 : barre + en-tête + Menu) ; rien en double entre les trois (O7). « Tout va bien ? » et « Mon
profil » (appareils, déconnexion) sont dans Paramètres ; « État des actions » a sa tuile (Aide). Rien par plateforme.
Seul double assumé : thème, langue, déconnexion au bas du Menu ET dans Paramètres (des gestes, pas des écrans).

## Fichiers
- `src/App.jsx` : `BARRE_DU_BAS`, `ECRANS_AVEC_RECHERCHE`, `ECRANS_TITRE_COQUE`, `LateraleNative`, `TeteNative` (loupe ·
  bulle · photo ⇒ Menu, « ‹ Menu »), `groupesMenu`, `EcranMenu`, `BottomBar` (`ORDRE_NATIF`), `badgesStables`, l'historique.
- `src/natif/Coque.jsx` (`ActionsCoque` : `ecran`, `sansCompte`, `libelleCompte`), `src/natif/BarreOnglets.jsx` (point),
  `src/natif/GrilleMenu.jsx` (tuiles, carte du compte), `src/natif/natif.css` (pastille, tuiles, titre au même endroit).
- `src/navHistorique.js` (segments), `src/navPaires.js` (« Paires » = Annonces ; Stock a sa tuile).
- `src/i18n/langues/{fr,en,es,it,de}/menu.js` ; `src/nouveautes.js` (`onglets-menu`).
- `scripts/bancs/onglets-menu.cjs` (O1–O13), `scripts/audit-barre-achats.cjs`.

## Preuves
- Banc `scripts/bancs/onglets-menu.cjs` (390 tactile clair + sombre, 1512 clair + sombre, base inventée) : touche chaque
  onglet, la bulle, la photo, chaque tuile, la carte du compte, « ‹ Menu », chaque entrée de la latérale et vérifie l'écran
  monté (`data-ecran`) et l'onglet allumé. **Après : 108 verts, 0 rouge** (⚠️ dit pour Stock, voir plus bas).
  Sur origin/main (`git archive`, build, `BANC_DIST=`) : **64 verts, 36 rouges** — rouges : O2 (champ sous le titre),
  O3 (la photo ouvre le Menu), O4, O5, O6, O8, O9 (Menu, Paramètres), O11, O12, O13 (« 33 » sur la photo). Verts sur les
  deux, c'est voulu : O1 (la barre est la même). O7 et O10 sont verts aussi sur l'ancien code : sur la base inventée,
  l'ancienne pastille ne variait pas — O10 ne prouve la règle que sur une vraie base (la correction : `badgesStables`).
- Audits verts : traduction, quoi-de-neuf, coherence, icones, barre-achats, coque-tablette, onglets-a, onglets-d,
  onglets-rapides. `audit-coque-parametres` : 1 rouge (« icône search » dans Réglages), déjà rouge sur origin/main.

## Ce qui reste (hors périmètre)
- **Stock** : la liste « À écrire sur tes cartons » est posée par la coque AU-DESSUS de l'écran Stock (son titre descend à
  ~240 px tant qu'elle est là). La ranger sous le titre demande de la passer dans `src/ecrans/Stock.jsx`. Le banc le dit.
- **Paramètres** pose deux entrées d'historique à son ouverture ; « ‹ Menu » s'en sort (repli : ouvre le Menu), le retour
  du système d'iPhone demande trois gestes. À regarder dans `Reglages.jsx`.
- **Ma journée** garde son propre « Ma journée » sous « Aujourd'hui » (audit §2.6, chantier de l'écran).
- Achats, Stock, Paramètres posent encore 2–3 ronds à côté de leur titre (contenu de l'écran).
- `MenuProfilCoque` (l'ancien menu du profil) reste monté sans déclencheur ; à retirer lors d'un ménage.
- Les gestes de l'ancien disque (`gestesDisque` : publier, scanner, imprimer) ne sont branchés sur aucune entrée de la
  barre — comme sur origin/main (la barre native ne les montrait plus) ; ils restent dans les écrans.

Geste de Julien : aucun.
