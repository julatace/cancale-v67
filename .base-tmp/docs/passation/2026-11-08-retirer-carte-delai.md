# 8 nov. — Colis → « À retirer » : villes avec colis, carte au téléphone, barre du délai

Branche `claude/retirer-carte-villes-delai` (depuis `origin/main`, pas de PR ni de merge par cette session).

Demande de Julien (8 nov.) : « Pour les colis à retirer, tu dois adapter les villes en fonction des
points relais où sont les colis. Je veux que tu réaffiches la carte et que tu mettes une barre
d'évolution avec le délai pour retirer. »

## Ce qui change

### 1. Les villes (`src/villeRelais.js`)
- `villesAvecColis(vue)` : une ville = un bouton, **seulement si au moins un colis COMPTÉ y attend**
  (un point qui n'a que des « à vérifier » ou des colis en route ne propose pas sa ville) ; une ville
  sans nom lisible n'a pas de bouton. Tri : **urgence** (la limite la plus proche des colis comptés —
  `triPoint` / `prochaineLimite` de `pointsARetirer`, `urgencePoint`), puis nombre, puis nom.
- `selecteurVilles(vue)` : ces villes, puis **« Autres »** (`CLE_AUTRES = '__autres'`) = les points
  CONNUS dont la ville n'est pas lue (nom seul), avec leurs colis comptés. « Toutes » reste en tête.
  Le point « pas encore connu » reste sous « Lieu à confirmer », visible quel que soit le choix.
- La ville vient toujours de `villeDuPoint` (lue ; table officielle à commune unique ; géocodage sûr
  au même code postal ; sinon le code postal seul, ex. « 35350 » — règle du 3 nov. inchangée).
- `villesDesPoints` garde sa forme (≥ 2 villes) pour les audits ; la carte sombre de Colis et le
  sélecteur lisent tous deux `selecteurVilles` (audit-villes-colis H5 mis à jour).
- « Autres » choisi : ses points sont montrés comme les autres (pas sous « Lieu à confirmer »).

### 2. La carte (`src/CarteRelais.jsx`, `ColonneRetirerF`)
- Affichée **aussi au téléphone** (`avecCarte` toujours vrai depuis Colis ; `ordi` ne règle plus que
  la hauteur) : en haut de la liste, **200 px** au téléphone, 220 px à l'ordinateur ; « Agrandir »
  (en bas à gauche, 44 px) passe à 380/420 px et recadre.
- Elle **suit la ville choisie** : seulement les points de cette ville, cadrage sur eux.
- Épingles : une par point, avec son nombre (`nombreEpingle`, inchangé ; un point « à vérifier » seul
  a une épingle neutre). Toucher une épingle défile jusqu'au point (sans animation si
  `prefers-reduced-motion`).
- Au doigt : `cooperativeGestures` de MapLibre (un doigt fait défiler la page — `touch-action:
  pan-x pan-y` — deux doigts déplacent la carte), phrases en français.
- Garde-fous gardés : maplibre chargé à la demande (`import('./fondCarte.js')`, rien au démarrage
  de Ma journée — mesuré) ; fond indisponible ⇒ la carte se cache (`hidden`), la liste reste ;
  **hors réseau mesuré** (`navigator.onLine === false`) ⇒ pas de carte ni de Base Adresse.
- Défaut corrigé au passage : la carte était rendue dans DEUX branches (fond prêt / fond en panne) ;
  un échec la faisait changer de branche, remonter, repartir à « charge » et recharger — en boucle.
  Une seule place maintenant, cachée sur échec.

### 3. La barre du délai (`src/delaiRetrait.js`, `BarreDelai`)
- Règle pure : temps écoulé entre l'**arrivée LUE** (`arriveeColisEmail` / `etatColisVinted().arr`)
  et la **limite** : lue (jour, ou heure `limiteAt` du transporteur), sinon « vers le » du
  transporteur, sinon la garde de SON transporteur (`limiteEstimee`) — ces deux-là dites « estimée ».
  Fin d'une limite = fin de son jour (heure de l'appareil) ou l'heure lue ce jour-là.
- Pas de date d'arrivée ⇒ **pas de barre** (la puce d'échéance reste) ; un « à vérifier » n'en a pas.
- Texte : « encore N j » · « dernier jour » · « délai dépassé » (+ « · estimée »).
- Couleur : neutre (`--d-gris` sur `--d-remplir`), **ambre dans les dernières 24 h et au-delà**,
  jamais rouge. 4 px de haut.
- `role="progressbar"`, `aria-valuenow` = %, `aria-valuetext` (« Encore 3 jours pour retirer, sur 6
  (limite le 11/11) »). La barre est HORS du bouton de la ligne (un bouton rend ses enfants muets).
- §7 « jamais dit deux fois » : la barre remplace la puce d'échéance de la ligne (elle porte le même
  `data-rp-echeance`) ; quand **tous** les colis comptés d'un point ont la même barre (même jour
  d'arrivée, même limite), elle est dite **une fois en tête du point** et les lignes se taisent.
- App : `delaiColisRetrait(x)` dans l'écran Colis, mêmes sources que le détail (`arriveeRetrait`).

## Preuves
- `scripts/bancs/retirer-carte-delai.cjs` (390 tactile clair/sombre, 1512, fond en panne, mouvement
  réduit, Ma journée) : **108 verts** sur la branche. Données inventées (Cancale ×2 même limite,
  Vannes dernier jour + consigne Vinted Go demain 9 h, Brest sans limite ⇒ estimée, Saint-Malo sans
  arrivée, Quimper « à vérifier » seul, un relais au nom seul).
- Le même banc sur `origin/main` (archive, build) : **65 rouges / 40 verts** (Quimper et pas
  d'« Autres », ordre par nombre, pas de carte au téléphone, aucune barre, fond en panne non tu).
- Mutations (sur la branche, 390 clair) : ambre jamais posé ⇒ 2 rouges (Vannes dernier jour, Vinted Go
  < 24 h) ; villes sans colis réadmises ⇒ 1 rouge (Quimper revient). Code remis, rebâti.
- Bancs existants : `colis-retirer-propre` 129 verts (1 contrôle réécrit : sans limite lue, la barre
  « estimée » remplace « aucune puce »), `colis-villes` 46 verts (+ « Autres · 1 » attendu),
  `hors-reseau` vert, `chargement` (Colis, Ma journée) vert. `carte-stable` : 3 rouges **identiques
  sur origin/main** (son crochet cherche `carte.once("load"`, que le build minifié renomme — à
  réparer à part ; le nouveau banc utilise la forme générale).
- Audits : `audit-tdz`, `audit-violet`, `audit-icones`, `audit-retraits-suivi`, `audit-statuts`,
  `audit-identite`, `audit-villes-colis` verts ; `audit-variables` : 1 rouge **identique sur main**
  (`setCompteSel`, Vérifications → Messages — pas de ce chantier).

## Geste de Julien
Aucun. Regarder Colis → À retirer sur l'iPhone (carte en haut, deux doigts pour la déplacer).
