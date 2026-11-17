# Maquette I — « L'épure » (17 nov. 2026)

Demande de Julien (17 nov.) : « propose encore d'autres maquettes, c'est pas assez bien » ; « là c'est vibe codé » ;
« les maquettes là sont exactement les mêmes que les autres ». **Une proposition, pas une livraison** : aucune PR.
Branche `claude/maquette-i`. **Page blanche** : `docs/maquettes/i/` n'importe RIEN de `src/` (ni App.jsx, ni styles,
ni composants) ; seules des données INVENTÉES (`donnees.js` : 40 annonces, 15 ventes, 10 achats, 3 colis à retirer).
Inspiration : Things 3, Rappels, iA Writer — la typographie porte tout.

## Ce que c'est
- **On quitte le bleu dégradé** : fond papier presque blanc (`#FBFBF9`), la nuit `#0E0E10` ; variante « bleu très
  léger » (`?fond=bleu`, `#EEF4FB`), un seul jeton.
- **Trois tailles par écran** : 40 fin (titre, ou le chiffre d'Argent) · 17 · 13. Inter, chiffres tabulaires.
- **Aucune carte, aucune bordure, aucune capsule** : l'espace sépare. Puce de 6 px : ambre = à toi de jouer ;
  creuse = ça attend quelqu'un d'autre.
- **Le N° du carton en colonne** (registre) ; le compte UNE fois en en-tête de groupe (Annonces).
- **UNE bande d'action** rectangulaire, bord à bord, au pouce, le seul bleu de l'écran (Imprimer 3 bordereaux ·
  Montrer les 3 codes · Republier 6 qui dorment · Saisir 4 prix d'achat).
- **Gestes secondaires** : appui long → feuille (téléphone) ; volet de droite toujours ouvert (ordinateur), y compris
  les offres à trancher (Aujourd'hui) et le vendu par compte (Argent).
- **Barre du bas en mots**, sans icônes ni pastilles. **Achats** : un point = un groupe, chaque colis = son code + son
  vrai QR (qrcode-generator, MIT, copié dans le dossier) ; « Montrer les codes » en grand, colis par colis.

## Règles gardées
Vente reliée à SA paire par le N° (jamais par le titre) ; date limite pas lue = « vers … » (estimation) ; reçu daté au
jour du versement ; bénéfice et URSSAF « — » avec la raison ; une couleur d'accent rare ; ambre = un geste ; 44 px.

## Ce que ça casse
Le bleu dégradé et la matière Studio (porcelaine, verre, plaque, disque) ; le « + » et son éventail (la bande d'action
de chaque écran le remplace) ; les icônes et pastilles de la barre ; Messages, E-mails, Stock sans onglet (loupe,
Aujourd'hui) ; la carte héros de Ma journée (Aujourd'hui = une liste de gestes) ; le sélecteur de plateformes en logos
(une ligne « Tous les comptes ⌄ ») ; les gestes de rangée moins visibles au téléphone (appui long).

## Fichiers et captures
`docs/maquettes/i/{index.html,epure.css,app.js,donnees.js,qrcode.js}` ; captures :
`node docs/maquettes/i/capture.cjs` (SHOTS=…) — 390 tactile clair et sombre, 1512 clair, feuilles, variante bleue ;
mesure 1 bande d'action, cibles ≥ 44 px, 3 tailles de texte, aucune capsule, aucun « … », aucun undefined/NaN.
Textes en français seulement (prototype) : à passer par `tr()` s'il est retenu.
