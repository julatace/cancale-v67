# 21 nov. 2026 — Paires à republier en priorité (choix n° 12) et recherche partout (choix n° 15) · branche `claude/prio-recherche`

## 12. « À republier en priorité »

- **La règle** : `src/republierPriorite.js` (`republierEnPriorite`). « Qui dort » = LA règle du segment « Dorment »
  (`filtrerArticles` etat `dorment`, src/articles/modele.js) au site Vinted ; l'âge mini EST le seuil de « Dorment »
  (`vrm_qd_seuil`, 30/60/90 j — changer l'un change l'autre). Nombre par jour : 5/10/20/50 (`vrm_repub_priorite_n`, 10).
- **Jamais proposée, et comptée** (« Jamais proposées : 1 vendue, 2 d'un compte bloqué… » en pied) : vendue sur n'importe
  quel site, masquée par Vinted, en litige ou retour en cours (N° ou identifiant d'annonce, via `src/litigesEnCours.js`
  alimenté par `retoursEnCours` dans App.jsx — tant qu'il n'est pas calculé, rien n'est écarté pour ça), compte bloqué
  (en pause ou bloqué), compte personnel ou d'achats (`vrm_roles_comptes`).
- **Classement** (en « jours équivalents », refaisable à la main) : jours en ligne + 14 si 0 favori lu − 7 par favori lu
  (4 au plus) + 14 si les vues baissent + 7 si moins d'une vue par jour lue. « Vues qui baissent » vient du journal
  `vrm_vues_lues` (≥ 3 points, deux moitiés ≥ 2 j, sinon pas su). Pas lu ⇒ rien ajouté, la raison dit « vues pas lues ».
- **Raison** sur chaque ligne : « 41 j · 136 vues · 0 favori · vues qui baissent ».
- **Écran** : Annonces, segment **« Republier »** (libellé raccourci : « À republier » était coupé à 390 px ; le nombre du jour
  est dans `data-eg-segment-n` et dans l'intertitre) ; à l'ordinateur, le filtre « Ancienneté » du tableau a l'option
  « Republier » qui ouvre la même vue. Rangées fines (vignette, titre complet, N°, raison, prix), une case 44, un
  intertitre par compte. Les lignes du 1er compte sont cochées ; **« Republier N »** ouvre l'atelier Republier du panneau
  de l'extension (`ouvrirPanneau`, `ACTIONS_EXTENSION.republier`, ids cochés). Deux comptes cochés ⇒ refus nommé (l'atelier
  agit au nom du compte de l'onglet). Rien ne part sans son toucher, et c'est lui qui lance dans le panneau.
- **Aujourd'hui** : rangée « N paires à republier en priorité › » dans la carte du haut, lue sur la publication
  `vrm_repub_priorite` (écrite par Annonces, cet appareil, jamais sur une lecture ratée) ; seulement si N > 0 ; le toucher
  ouvre Annonces sur la vue (`demanderVue('arepublier')`, pris par `prendreVue`, désormais exporté d'App.jsx ;
  Annonces natif prend aussi `dorment`, que plus personne ne consommait).

## 15. Recherche partout (la loupe de la coque, `src/rechercheUnique.js`)

Elle trouvait déjà N°, pseudo, suivi, code, transaction, titre, marque, taille, messages, ventes des autres sites, ⌘K/« / »,
récents. Ajouté / corrigé :
- **Un N° se trouve ENTIER** (`cleNum`) : « 7 » ne trouve plus 70, 17, 107 (avant : morceau de N°). Un nombre dans un texte
  se compare entier aussi (`contientMot` : « 7 » ne sort ni « Air Max 270 » ni « Étagère 70 »). Un n° recopié par blocs
  dans un titre reste proposé (forme compacte).
- **Fautes de frappe pour le texte seulement** : mot ≥ 4 lettres sans chiffre, une faute (deux à partir de 8 lettres, ou
  début d'un mot plus long) ; marqué `approx`, rangé après les exactes, « à une lettre près » dit sur la ligne. Jamais pour
  un N°, code, suivi, transaction, montant. Vitesse : vocabulaire de l'index fait une fois.
- **Écran** : logo du site sur chaque rangée (vente, achat, paire, annonce, message — `siteDe`), rangées fines à filet (plus
  de cartes arrondies), titre sur deux lignes, intertitres sans capitales (« Ventes · 12 »).
- Le banc `recherche-universelle.cjs` attendait « 141 ⇒ 1141, 1410 » : renversé (décision de Julien).

## Preuves

- `node scripts/audit-republier-priorite.cjs --prouve` : tout vert, 15/15 mutations (règle recopiée, tous sites, chaque
  exclusion, pas lu = 0, baisse sur un doute, identité par titre, deux comptes, ouverture dans un effet / sans toucher…).
- `node scripts/audit-recherche-partout.cjs --prouve` : tout vert, 11/11 mutations. P6 (frappe < 16 ms) est sensible à la
  charge de la machine (médiane de 7).
- Bancs : `scripts/bancs/republier-priorite.cjs` (harnais `outils/prio-recherche/`, 390 tactile et 1512, clair/sombre) ;
  `scripts/bancs/recherche-partout.cjs` (l'app entière, base inventée). Résultats et rouges sur l'ancien code : rapport de la
  session.
- Verts : audit-traduction, audit-identite, audit-quoi-de-neuf, audits recherche-* existants, quoi-republier, qui-dorment, build.

## Reste

- Les messages Leboncoin ne sont pas dans la loupe (seules les conversations Vinted le sont).
- La liste ne propose que des annonces Vinted (l'atelier du panneau est celui de Vinted).

Geste de Julien : aucun (rien à installer : l'atelier Republier de l'extension 5.410.x lit déjà `page=republier&ids=`).
