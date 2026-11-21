# Onglets réorganisés, Menu en tuiles — 21 nov. 2026 (branche `claude/onglets-menu`)

## Demandes de Julien
- « réorganise totalement les onglets », « simplifie », « toujours dans le style Vintex », inspiré de Bleam (barre du bas
  Accueil · Dressing · [Publier rond central] · Messagerie · Menu ; Menu = carte du compte, tuiles « Gestion » et
  « Automatisation », langue/thème/déconnexion en bas).
- Défauts de coque vus sur ses captures iPhone : la pastille des messages chevauchait la photo VRM ; grand titre ET petit
  titre centré ; recherche au-dessus du grand titre sur Achats, dessous ailleurs (audit du 20 nov. §1.2) ; deux recherches
  sur un écran (§1.3) ; pastilles de la barre qui changent de nombre d'un écran à l'autre.

Périmètre : la navigation et la coque seulement (barre du bas, barre latérale, Menu, en-tête de page, recherche de la coque,
pastilles). Le contenu des écrans, `src/copieEcran.js` et `OuvertureInstantanee` ne sont pas touchés (une autre session).

## Avant / après

| | avant (origin/main du 21 nov.) | après |
|---|---|---|
| Barre du bas (téléphone) | Aujourd'hui · Annonces · Ventes · Achats · Argent | **Aujourd'hui · Annonces · [Publier] · Messages · Menu** (5 places de même largeur, Publier = disque plein au milieu) |
| Le reste des écrans | « Plus » (feuille) + photo du profil (menu du compte, avec sa propre liste d'écrans) | **écran « Menu »** (`tab==='menu'`) : carte du compte ⇒ Paramètres ; tuiles Gestion (Ventes, Achats, Stock, Argent, E-mails) · Dans l'extension (Messages aux favoris, Automatismes ⇒ panneau de l'extension) · Aide (Notifications, Extension, État des actions si plusieurs comptes VRM, Communauté, Parrainage s'il est montré) ; en bas : cacher les montants, mode stream (s'il est réglé), **mode sombre, langue, se déconnecter** |
| Barre latérale (ordinateur) | 3 groupes sans titre (dont Tout va bien ?, Notifications, Paramètres, Communauté) ; la photo ouvrait le menu du compte | **les mêmes groupes que le Menu** (`groupesMenu`, une source) : en tête Aujourd'hui · Annonces · Publier · Messages, puis Gestion · Dans l'extension · Aide ; pied = la carte du compte ⇒ Paramètres |
| En-tête (téléphone) | grand titre + messages + « Plus » + photo, champ de recherche sous le titre | grand titre + **une** action (la loupe) ; « ‹ Menu » à gauche sur un écran ouvert depuis le Menu ; aucun champ de la coque sous le titre ; pas de loupe de la coque sur un écran qui a SA recherche (`ECRANS_AVEC_RECHERCHE`) |
| Grand titre | 6 px sous le haut sur Achats/Stock/E-mails/Messages/Paramètres (barre repliée), 44 px ailleurs | **au même endroit partout** (barre de 44 px sur tous les écrans, en-têtes des écrans ramenés à 2 px — `natif.css`, fin) : 42–46 px mesurés sur 10 écrans |
| Pastilles de la barre | Ventes/Achats/Annonces + les « à régler » de l'écran courant (`plusRegler`) : le nombre changeait d'un écran à l'autre | **une source par compteur** (`badgesStables` : `vrm_colis_aposter` ⇒ Ventes, `vrm_colis_retirer` ⇒ Achats, non-lus ⇒ Messages) ; Menu porte un POINT (son nombre est sur la tuile : jamais deux fois) ; Annonces ne porte plus le nombre d'annonces (pas un geste) |
| Historique | d'un onglet de la barre à un autre : remplacer | idem pour les 4 places ; un écran du Menu EMPILE (le retour ramène au Menu) ; deux segments d'un même écran (Argent ↔ Statistiques, Ventes ↔ Litiges) se remplacent |
| Écrans montés (`{tab==='…'`) | 23 | 24 (+ `menu`) — `tab===` : 54 ⇒ 56 ; `<BottomBar` 1, `<LateraleNative` 1, `<TeteNative` 1, `<EcranMenu` 1, `<FeuillePublier` 1 |

Rien n'est perdu : tout écran que l'ancienne navigation ouvrait (barre + Plus) est joignable (banc O6) ; « Tout va bien ? »
et « Mon profil » (appareils, déconnexion) sont dans Paramètres ; « État des actions » a sa tuile (Aide). Rien par
plateforme (décision du 20 nov.). Colis = Ventes (À envoyer) et Achats (À retirer) ; Statistiques = un segment d'Argent ;
les comptes Vinted = Paramètres → Mes plateformes (pas de tuile en double).

Seul double assumé : thème, langue, déconnexion sont au bas du Menu ET dans Paramètres (demande « comme Bleam ») — ce sont
des gestes, pas des écrans ; « Langue » ouvre la rubrique Apparence et langue de Paramètres, la déconnexion demande d'abord.

## Fichiers
- `src/App.jsx` : `BARRE_DU_BAS`, `ECRANS_AVEC_RECHERCHE`, `ECRANS_TITRE_COQUE`, `LateraleNative`, `TeteNative` (« ‹ Menu »),
  `groupesMenu` (une source Menu + latérale), `EcranMenu`, `FeuillePublier` (les gestes de l'ancien disque : publier,
  scanner, imprimer N), `BottomBar`, `badgesStables`, l'historique (`entreeHistorique(..., BARRE_DU_BAS)`).
- `src/natif/BarreOnglets.jsx` (place centrale, point), `src/natif/GrilleMenu.jsx` (tuiles, carte du compte),
  `src/natif/natif.css` (fin : barre, tuiles, carte, titre au même endroit).
- `src/navHistorique.js` (segments), `src/navPaires.js` (« Paires » = Annonces ; Stock a sa tuile).
- `src/i18n/langues/{fr,en,es,it,de}/menu.js` ; `src/nouveautes.js` (`onglets-menu`).
- `scripts/bancs/onglets-menu.cjs` (O1–O12), `scripts/audit-barre-achats.cjs` (la barre d'aujourd'hui).

## Preuves
- Banc `scripts/bancs/onglets-menu.cjs` (390 tactile clair + sombre, 1512 clair + sombre, base inventée) : touche chaque
  place de la barre, chaque tuile, la carte du compte, « ‹ Menu », chaque entrée de la latérale et vérifie l'écran monté
  (`data-ecran`) et l'onglet allumé ; O9 un seul titre / ≤ 1 action / une recherche ; O10 pastilles identiques sur 11
  écrans ; O11 titre au même endroit ; O12 « ‹ Menu ».
- Échoue sur origin/main (`BANC_DIST=<dist d'avant>`) : voir le rapport de la session (chiffres ci-dessous).
- Audits verts : traduction, quoi-de-neuf, coherence, icones, barre-achats, coque-tablette, onglets-a, onglets-d,
  onglets-rapides. `audit-coque-parametres` : 1 rouge (« icône search » dans Réglages), déjà rouge sur origin/main.

## Ce qui reste (hors périmètre)
- **Stock** : la liste « À écrire sur tes cartons » est posée par la coque AU-DESSUS de l'écran Stock (son titre descend à
  ~240 px tant qu'elle est là). La ranger sous le titre demande de la passer dans `src/ecrans/Stock.jsx` (contenu de Stock).
  Le banc le dit (⚠️ O11) sans le juger.
- **Paramètres** pose deux entrées d'historique à son ouverture (mesuré : deux retours avant le Menu) ; « ‹ Menu » s'en
  sort (repli : ouvre le Menu), le retour du système d'iPhone, lui, demande trois gestes. À regarder dans `Reglages.jsx`.
- **Ma journée** garde son propre « Ma journée » sous le grand titre « Aujourd'hui » (audit §2.6, chantier de l'écran).
- Achats, Stock, Paramètres posent encore 2–3 ronds à côté de leur titre (contenu de l'écran).
- Le menu du compte (`MenuProfilCoque`) n'est plus ouvert par la coque (tout ce qu'il portait est dans Paramètres) : il
  reste monté, sans déclencheur ; à retirer par une session qui en fait le ménage.

Geste de Julien : aucun.
