# 6 nov. — v36 finitions : les restes des chantiers du 6 nov.

Branche LOCALE `v36-finitions` (depuis `claude/project-review-nsk5su`, 477adf56). Rien poussé, rien
dans `vinted-sync-extension/`, `public/*.zip|xpi` intacts. Données inventées seulement ; base de prod
non lue (aucune mesure n'en avait besoin). Sources : les « Ce qui reste » de
`2026-11-06-vague2-ventes.md`, `2026-11-06-vague3-ecrans.md`, `2026-11-06-vague3-en-ligne-deux-fois.md`.

## 1. « Plus tard » revient au bout de 7 jours — `src/achatsARelier.js`
- `etatPlusTard(at, maintenant)` : la date posée à SON clic (`vrm_achat_plus_tard`, synchronisée,
  inchangée) met l'annonce de côté **7 jours** (`PLUS_TARD_JOURS`) : fin de file, hors du nombre de Ma
  journée. Ensuite elle revient (nombre et place). Une date illisible ne met rien de côté (« pas su » ne
  vaut pas « reportée »). `fileSansAchat({ …, maintenant })` rend `reporteLe` / `revientLe`.
- La ligne dit « reportée le 4 nov. · revient le 11 nov. », puis, revenue, « reportée le 29 oct. » (et
  « Plus tard » se repose : un nouveau clic redate) — `data-ar-reportee`.
- **Défaut trouvé au banc (vrai, du 6 nov.)** : `vrm_achat_plus_tard` et `vrm_annulees_reglees`
  (`useStateCle`) n'étaient PAS relues quand le nuage arrive après le montage : sur un appareil neuf,
  « Plus tard » et « Déjà remise en vente » posés ailleurs restaient vides. Ajouté : la relecture
  `onCloudReady` (ne remplace que ce qui est resté vide, la règle du §5).

## 2. Un N° d'archive remis en vente → « nouveaux numéros à écrire sur tes cartons »
- **Vérifié : le cas manquait.** Sur l'arbre d'avant, la paire de la vente 62101 (N° B230) remise en
  vente recevait « N°12 » sans rien dire : le carton porte « B230 », la liste ne le reprenait pas
  (`reattribue` jamais posé ; la reprise saute un N° d'archive, la numérotation donne un neuf).
- Ajouté PAR LA RÈGLE EXISTANTE : `archivesAEcrire` (src/repriseNumero.js, pure) ne fait que poser
  `reattribue: { de: 'B230', vers: '12', archive: true }` sur la fiche de la nouvelle annonce — la
  liste reste `reattribueAEcrire` / `blocAEcrire` (Annonces), jusqu'à « C'est écrit ». La ligne dit
  « Ancien numéro : il ne se redonne pas ». Conditions : nouvelle EN LIGNE, seule pour son ancienne,
  N° neuf reprenable et différent, jamais de `reattribue` avant (une fois).
- « Remettre en vente » garde le N° d'archive dans son suivi (`vrm_repub_main[anc].numArchive`) — il
  n'était que dans l'affichage. Seules ces remises accompagnées entrent (`anciens`) : jamais tout
  l'historique des républications (cela ressortirait des cartons déjà réécrits).

## 3. Feuille « Actions » à deux comptes — `src/annoncesActions.js`
« Ta sélection mélange 2 comptes (a, b). Republier, modifier, brouillon, mise en ligne : un compte à la
fois · Prix mini : possible. » — « Prix mini : possible » n'est dit que s'il l'est vraiment (un
brouillon coché le grise : la phrase s'arrête à « un compte à la fois »).

## 4. Colis : la ligne de fraîcheur du bas n'est plus rendue
`<div className="vrm-colis-fraicheur">…FraicheurDonnees…</div>` retiré du rendu, et ses trois règles CSS
(fusion.css `display:none`, deux `:empty`). La seule voix : la puce « N comptes à relire »
(`data-comptes-a-relire`, même source `liveStats.dataAge*`). Personne d'autre ne la lisait (grep : le
sélecteur VOIX du banc vague3-ecrans la compte si elle est visible — elle ne l'est plus ; une ligne de
débogage `JR_DBG` de colis-retirer-propre).

## 5. Stock : `data-aller-chercher` au lieu de `data-cible`
La liste « À aller chercher » porte `data-aller-chercher={N°}` ; `data-cible` reste le crochet des
notifications (src/cibleNotif.js). Banc `stock-retrouver` mis à jour (il lit
`[data-stock-cibles] [data-aller-chercher]`). (`src/accueil-carte.jsx` garde un `data-cible` : c'est la
démo de la page publique, hors de l'app — pas touché.)

## 6. Les deux blancs « écrits à la main »
Mesuré avant de coder : **les deux règles visaient des éléments qui n'existent plus**.
- `.vrm-fu-jour[data-futur]` (38 %) : la semaine de Ma journée est les 7 DERNIERS jours, aucun jour
  futur n'est rendu. Règle (et sa surcharge) retirées.
- « — » à 50 % : visait `.vrm-compta-hero` dans la carte « gagné », qui est une `CarteStatsApp` depuis le
  3 nov. Retirée. Le « — » RENDU (`.vrm-fu-grand.is-vide`) était forcé au **blanc plein** par
  `.vrm-compta-carte > .vrm-carte-stats .vrm-fu-grand { color: #fff }` : il prend maintenant l'encre des
  vides de toutes les cartes sombres, le jeton `surSombre2` (`--fu-sur-sombre-2`) — au pire point
  6,52:1 / 5,90:1 (fond, clair / sombre), 5,15:1 / 4,71:1 sous une case (≥ 4,5, alors qu'un grand texte
  n'en demande que 3). Aucun jeton nouveau.

## 7. Le rouge et l'ambre pour UNE paire en ligne deux fois
`conflitsDeNumeros(porteurs, memePaires)` : des ANNONCES que la carte ambre « en ligne deux fois »
affiche dans un même groupe (photo exacte ou `recreeDe`, src/enLigneDeuxFois.js) ne sont pas « deux
paires sous un N° » — pas de rouge, la carte ambre suffit. Les groupes sont exactement ceux que la
carte AFFICHE (`enLigneDeux.vinted` → `groupesDeuxFois`) : lecture pas prête, compte lu il y a plus de
24 h, compte écarté, masquée ou « à confirmer » ⇒ la carte se tait ⇒ **le rouge reste** (jamais les
deux muets). Toujours rouge : même N° sur deux photos, un groupe partiel, une 3ᵉ annonce, deux cases,
une vente et une autre annonce. « Tout sur le N° » suit la même règle (groupes publiés par Ma journée,
`GROUPES_DEUX_FOIS`). `doublonsAReattribuer` ne voit plus ces paires (il ne les renumérotait déjà pas
par `photoK`/`recreeDe` ; une paire prouvée par la photo de l'annonce elle-même ne reçoit plus un N° neuf
à tort).

## 8. Banc `transporteurs` : 55 rouges = surtout une forme périmée, et trois vrais défauts
Mesuré : la colonne « À retirer » a été redessinée le 3 nov. (`LigneRetraitF`, src/CarteRelais.jsx) et
le banc datait du 2 nov.
- **Forme périmée (le banc corrigé)** : le détail d'un colis (n° de suivi, date limite, ligne du
  transporteur, nouvelles) ne s'écrit qu'une fois la ligne TOUCHÉE, « À vérifier » est replié — le banc
  fait le geste (`deplier`) ; l'en-tête d'un point est `.vrm-rpf-tete` ; un reparti est une ligne courte
  d'« Argent à vérifier » (sa puce ambre dit l'état) ; l'achat « en cours de vérification » est une
  ligne de « À vérifier » ; l'écran Achats est `?tab=cat_achats&vue=achats` (1er nov.).
- **Vrais défauts (l'app corrigée)** :
  a. en mode **sombre**, `:root[data-theme="dark"] .vrm-rpf-puce` (plus précise) éteignait l'ambre de
     TOUTES les puces de « À retirer » (« dernier jour », « Remboursement à vérifier », statut d'un « à
     vérifier ») : gris #AEAEB2. Corrigé (fusion.css).
  b. « code postal inconnu » renvoyait à « N° de suivi ajoutés (Achats → À retirer) », un endroit qui
     n'existe plus ; le geste vit sous « … » de Colis. La phrase dit maintenant « « … » en haut de Colis,
     puis « + Ajouter un n° de suivi » » (`texteCodePostalMr`) ; le banc touche « … » et mesure le bouton
     (44 px).
  c. « Transporteur pas encore connu » n'était plus dit nulle part depuis le 3 nov. (« pas su » ≠ rien) :
     la ligne ouverte le dit (`data-transp="transporteur-inconnu"`).

## Preuves
(arbre d'avant = `git archive 477adf56`, son dist construit avant toute modification ; mutant = un dist
construit avec les neuf retours en arrière : Plus tard éternel, `numArchive` oublié, phrase d'avant,
ligne de fraîcheur rendue, « — » forcé au blanc, rouge sans groupes, ambre des puces éteint + phrase
d'avant + « transporteur pas encore connu » tu, `data-cible` remis, relecture au nuage retirée.)

- `npm run build` vert. Audits exigés verts : `coherence`, `identite`, `tdz`, `variables`. Les 323
  `audit-*.cjs` relancés : 4 non verts, **identiques sur l'arbre d'avant** (`chemin-json-guillemets`,
  `photos-vinted`, `vc-recon`, `renum-b` au-delà de 150 s).
- **Audits de règle** (exécutés ; avant = l'audit copié dans l'arbre d'avant) :

  | audit | après | avant | mutations |
  |---|---|---|---|
  | `audit-finitions-v36` (neuf : points 2, 4, 5, 6, 8) | 23/23 | 12 rouges | **12/12** |
  | `audit-achats-a-relier` (F7-F10, S7-S9) | 29/29 | 5 rouges | **16/16** (6 neuves) |
  | `audit-annonces-actions` (B19, B20 ; F2 ancré sur la reprise) | 63/63 | 2 rouges | **23/23** (3 neuves) |
  | `audit-conflits-numeros` (paire en ligne deux fois) | 35/35 | 2 rouges | **7/7** (3 neuves) |
  | `audit-en-ligne-deux-fois` (K : la carte ambre → le rouge, chaîne réelle) | 42/42 | 4 rouges | **15/15** (2 neuves) |
  | `audit-rouge-doublon` (R6) | vert | 4 rouges | **11/11** (4 neuves) |


- **Bancs** (données inventées ; ports 10401-10445 ; « avant » = le dist de 477adf56 servi par `BANC_DIST` ;
  « mutant » = le dist des neuf retours en arrière) :

  | banc | après | avant | mutant |
  |---|---|---|---|
  | `transporteurs` (forme du 3 nov.) | **130 verts, 0 rouge** | 4 rouges (les trois vrais défauts : phrase ×2, ambre sombre, « transporteur pas encore connu ») — 55 avec l'ancien banc | 4 rouges |
  | `vague2-ventes` P (Plus tard) + N (archive) | P 20, N 16 verts (tout le banc 0 rouge) | 8 rouges (390 clair) | 16 rouges |
  | `en-ligne-deux-fois` D/E/F | 56/56 | 2 rouges (D : le rouge allumé) | 2 rouges |
  | `vague3-ecrans` F + K (Colis, Compta) | 0 rouge (F 15, K 60) | 7 rouges (ligne du bas rendue ×3, « — » blanc plein ×4) | 6 rouges (F) |
  | `stock-retrouver` | 38/38 | 4 rouges | 5 rouges |
  | `annonces-actions` | 133 verts, 0 rouge | 4 rouges (la phrase, 4 tailles) | — |

  Captures regardées (hors dépôt) : `v2-390-clair-plus-tard-file`, `v2-390-clair-archive-a-ecrire`,
  `annonces-actions-390-clair-deux-comptes`, `deux-fois-D-390` (avant : « 1 numéro en double » rouge à côté de
  l'ambre ; après : l'ambre seule), `v3-K-Compta-1512-sombre`, et la colonne « À retirer » du banc transporteurs.
- **Trouvé en route** : l'alerte de la cloche « N numéros portés par deux annonces » (rouge doublon dans Ma
  journée, `numPorteurs`) avait sa propre règle : elle suit maintenant la même dispense
  (`GROUPES_DEUX_FOIS`) — c'est elle que la capture « avant » montrait.


## Ce qui reste
- Republier (extension) une annonce dont le N° est une archive B… : la nouvelle reçoit un N° neuf sans
  passer par « à écrire » (seules les remises accompagnées entrent, pour ne pas ressortir l'historique).
  À décider : n'y faire entrer que les républications d'après le 6 nov. (une date de coupure).
- `.vrm-fu-jour[data-futur]` n'existait plus ; si la semaine de Ma journée montre un jour un jour futur, il
  prendra l'encre des jours (`--fu-sur-sombre-2`), à mesurer alors.
- `src/App.jsx:13125` (texte d'une courbe sur fond sombre, blanc à 50 %) reste écrit à la main : petit
  texte de légende, hors de la carte sombre mesurée ; à passer au jeton quand on touchera la courbe.
- fusion.css garde des règles mortes de l'ancienne carte « gagné » (`.vrm-compta-hero` dans
  `[data-compta-q="gagne"]`, lignes 517 et 732-737) : sans effet, à nettoyer avec la carte.
- Les bancs longs (annonces-actions 1512 sombre, transporteurs F n° 12, en-ligne-deux-fois A) rougissent
  parfois sous charge (machine partagée : délais de 20-30 s) ; relancés, ils sont verts.
- `numPorteurs` (alertes de la cloche) reste une règle à part de `conflitsDeNumeros` (il ne voit ni les
  ventes ni les cases) : à fondre un jour dans la règle unique.

## Geste de Julien
Aucun. (À voir : Annonces → « Sans achat relié » dit maintenant la date d'un « Plus tard » ; une remise
en vente d'une paire « B… » apparaît dans « nouveaux numéros à écrire sur tes cartons ».)
