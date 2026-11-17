# Maquette I — « L'épure » (17 nov. 2026)

Demande de Julien (17 nov.) : « propose encore d'autres maquettes, c'est pas assez bien » ; « là c'est vibe codé ».
**Une proposition, pas une livraison** : aucune PR. Branche `claude/maquette-i`, partie de `claude/onglets-design-c`.
Inspiration : Things 3, Rappels, iA Writer — la typographie porte tout.

## Ce que c'est
- **On quitte le bleu dégradé** (dit à Julien) : fond blanc presque pur, à peine chaud (`#FCFCFA`) ; la nuit `#0D0D0F`.
  Variante « bleu très léger » (`#F4F8FD`) montrée sur une capture, un seul jeton à changer.
- **Trois tailles par écran** : 34 fin (titre, ou le chiffre d'Argent) · 17 (ce qui se lit) · 13 (ce qui précise).
- **Aucune carte, aucune bordure** : des listes séparées par l'espace seul ; une **puce de 6 px** pour l'état
  (ambre = un geste t'attend ; creuse = ça attend quelqu'un d'autre ; rien = rien).
- **Le N° du carton en colonne**, comme dans un registre (chiffres tabulaires) : c'est l'élément propre à VRM.
- **UN bouton plein en bas, au pouce, le seul bleu de l'écran** (Imprimer 16 · Montrer les 6 codes · Publier 9 ·
  Saisir 36 prix d'achat) ; les gestes secondaires dans un **appui long** sur une rangée → une feuille.
- **Barre du bas en mots, sans icônes** (Aujourd'hui · Ventes · Achats · Annonces · Argent), l'actif à l'encre.
- **Achats · à retirer** : un point = un groupe (nom, adresse, date limite en ambre), chaque colis = son code en
  registre + son vrai QR ; « Montrer les codes » ouvre le QR en grand, colis par colis.

## Règles gardées
Modèle de la maquette H/F (`donnees.js`, `postes.js` repris tels quels) : N° par l'id de SON annonce, vente par
`item_id`, bordereau par n° de transaction ; une date limite pas lue = « vers … » (estimation, jamais en retard) ;
reçu daté au jour du versement ; bénéfice et URSSAF « — » avec la raison, jamais devinés.

## Ce que ça casse
Le bleu dégradé et la matière Studio (porcelaine, verre, plaque, disque) disparaissent ; le « + » central et son
éventail deviennent le plein de chaque écran ; Messages, E-mails, Stock n'ont plus d'onglet (loupe, Aujourd'hui) ;
les icônes de la barre disparaissent ; le sélecteur de plateformes devient une ligne « Tous les comptes ⌄ » ;
la carte héros de Ma journée disparaît (Aujourd'hui = une liste de gestes) ; les gestes de rangée (Relier,
Baisser le prix…) passent derrière l'appui long, donc moins visibles pour un nouveau vendeur.

## Fichiers
`src/main.jsx` (monté si `localStorage.vrm_banc_maquette === 'i'`, posé par le banc seulement) ·
`src/maquettes/i/{Epure.jsx,epure.css,donnees.js,postes.js}` · banc `scripts/bancs/maquette-i.cjs`
(`npm run build && SHOTS=… node scripts/bancs/maquette-i.cjs`) : mesure 1 plein visible, cibles ≥ 44 px, 1re rangée
≤ 50 % de 844, 3 tailles de texte au plus, aucun texte coupé par « … », aucune bordure, aucun undefined/NaN.
Textes en français seulement (prototype) : à passer par `tr()` s'il est retenu.
