# 5 nov. — Chantier B : les composants partagés (revue de cohérence 1.2, 1.4, 1.8-1.10, 2.8, 2.9)

Feuille de route : `docs/passation/2026-11-05-revue-coherence.md`. Ce chantier pose les
pièces ; **il n'adapte aucun écran** — les chantiers C à H le font, chacun dans sa zone.
Branche locale `v33-chantier-b` (depuis `claude/project-review-nsk5su`).

Tout est importé UNE fois en tête de `src/App.jsx` (aucun chantier n'a à retoucher la
ligne d'import) : `montant`, `SheetShell`, `Bouton`, `Segmente`, `ChampRecherche`,
`PhotoVide`, `Numero`, `EtatPanne`, `L`, `Lbas`, `VERBES`, `PAS_SU`. Hors d'App.jsx,
importer depuis `src/format.js`, `src/libelles.js`, `src/composants/*.jsx`.
Styles : `src/styles-composants.css`, importé EN DERNIER par `src/main.jsx`.

## 1. Les mots — `src/libelles.js`

| constante | titre / bouton (`L.x`) | dans une phrase (`Lbas.x`) | mots écartés |
|---|---|---|---|
| `aEnvoyer` | À envoyer | à envoyer | à poster, à expédier |
| `envoyes` | Envoyés | envoyés | expédiés |
| `enRoute` | En route | en route | en transit |
| `arrives` | Arrivés | arrivés | reçus (« Reçu » = l'argent) |
| `aRetirer` | À retirer | à retirer | |
| `recu` | Reçu | reçu | encaissé (§5) |
| `vendu` · `benefice` · `compta` | Vendu · Bénéfice · Compta | | bénéfice brut |
| `statut` | Statut | statut | régime fiscal |
| `favoris` · `comptesLies` · `emails` · `relierBoite` | Favoris · Comptes liés · E-mails · Relier ma boîte | | likes · comptes connectés · emails |

- `NOTIONS.x.un` : le singulier quand il diffère (`arrives.un` = « Arrivé »).
- `VERBES` : voir, toutVoir, `ouvrirSur(site)`, imprimer, toutImprimer, reessayer, relire,
  modifier, enregistrer, annuler, fermer, supprimer, confirmer, ajouter (« + Ajouter »,
  plus « + Créer »), completer, copier, copie, effacer, rechercher, dicter, relier, delier,
  continuer, enGrand, plus (le nom lu du bouton « … »).
- `PAS_SU` : `vide` (« — »), `phrase(quoi)` (« {quoi} : pas su pour l’instant. »),
  `sansRaison`, `enCours` (« Lecture en cours… »).
- `motsEcartesDans(texte)` : la liste des mots écartés présents (sans accent ni casse,
  mot entier) — pour un audit d'écran.

## 2. Les euros — `src/format.js`

`montant(valeurOuCentimes, opts)` → texte. Règle : centimes SEULEMENT s'ils existent
(« 65 € », « 249,50 € »), « , » décimale, milliers en espace fine (U+202F), une espace
avant « € », **« — » pour un montant pas su** (`null`, `undefined`, `''`, NaN, Infini,
booléen, objet sans montant) — jamais « 0,00 € » (§5).

| option | valeurs |
|---|---|
| `enCentimes` | la valeur est en centimes entiers (`montant(1250, {enCentimes:true})` = « 12,50 € ») |
| `centimes` | `'auto'` (défaut) · `'toujours'` · `'jamais'` (arrondi à l'euro, ex-`fmtE0`) |
| `milliers` | `true` (défaut) · `false` (« 1234 € », ex-`fmt`) |
| `vide` | ce qui s'écrit si pas su (défaut « — » ; `prixTxt` : « sans prix ») |
| `devise` / objet `{amount, currency_code}` | une devise étrangère est DITE (« 12,50 GBP ») |
| `etrangere: 'ecarter'` | … ou ÉCARTÉE (⇒ `vide`) — jamais convertie |
| `signe` | « +12 € » pour un écart positif |
| `arrondi` | `'binaire'` (défaut, `toFixed`, ex-`fmt`) · `'decimal'` (`toLocaleString`, ex-`prixTxt` : 1,005 ⇒ 1,01) |

Chaînes acceptées : « 88.0 » (API Vinted) et « 12,50 ». `valeurMontant(v, opts)` rend le
nombre ou `null` (pour sommer sans jamais sommer un « — »). Jamais « -0 € ».

**Les quatre anciennes écritures sont des alias** (définitions en place dans App.jsx) :
`fmt` / `fmtE` = `montant(n, {milliers:false})`, `fmtE0` = `montant(n, {centimes:'jamais'})`,
`prixTxt` = `montant(p, {vide:'sans prix', arrondi:'decimal'})`. Pour un nombre lu, seul
change : **les centimes inutiles** (« 12,00 € » ⇒ « 12 € ») et « -0 ». Pour une valeur
pas sue : « 0,00 € » / « NaN € » / « Infinity € » ⇒ « — » (`fmt(null)` rendait « 0,00 € »).
Chaînes à virgule et objets prix sont désormais lus. `node scripts/audit-composants.cjs
--ecarts` liste les **86 écarts** sur un corpus de 39 valeurs, chacun rangé dans une
catégorie permise (centimes inutiles · pas su ⇒ « — » · « -0 » · chaîne lue · objet prix),
0 hors catégorie.

## 3. La feuille — `SheetShell` (`src/composants/SheetShell.jsx`, relais dans App.jsx)

```jsx
<SheetShell onClose={…} titre="Relier un achat" sousTitre="…" maxWidth={520} z={2000} lumineuse={false} data-mon-ecran="">
  …contenu…
</SheetShell>
```
- **Portail** sur `<body>` ; voile FRÈRE de la feuille (seul le voile fond) ⇒ **fond opaque
  dès la première image** (l'ancienne fondait : opacité effective 0 mesurée à la 1re image,
  et posée DANS l'écran, hors champ sous un parent transformé — `BANC_ANCIEN=1`).
- **Poignée** (36 × 5, zone 32 px + 20 px au-dessus du bord) et tête (titre) se prennent au
  doigt : suivi 1:1, élastique vers le haut, lâcher franc (élan des 100 dernières ms,
  projection d'Apple 0,998) ou au-delà de la moitié ⇒ part vers le bas puis `onClose` ;
  sinon revient. **Reprise en plein mouvement** : on repart de la position AFFICHÉE.
  Un simple toucher ne décide rien. `data-feuille-geste` = `suit` · `revient` · `part`.
- `titre` ⇒ titre 20/700 + **croix en icône** (rond 30 px, cible 44 × 44, « Fermer »).
  Sans `titre`, pas de croix (les 15 feuilles existantes gardent la leur) ; `croix` force.
- `FermeAuRetour` (retour du navigateur, Échap) ; `role="dialog"`, `aria-modal`, focus.
- **Mouvement réduit** : aucune glissade (la feuille est en place) ; le voile fond.
- `lumineuse` (« En grand ») : blanc forcé MÊME en sombre — les jetons `--vrm-*` sont
  redéfinis sur la feuille ; un enfant en `C.text` écrit en ligne reste à adapter (chantier D).
- Classes `vrm-fs-*` (pas `.vrm-feuille` : déjà prise par styles-mineral.css).
- ⚠️ La règle générale « Fermer… » de styles-boutons.css (spécificité id) pose aussi
  44 px, `margin:-8px` et le survol sur la croix — voulu, ne pas s'en étonner.
- ⚠️ La croix et le voile ferment TOUT DE SUITE (pas d'animation de sortie) : les bancs qui
  ferment puis comptent restent justes. Seul le glissé anime la sortie.

## 4. Bouton et Segmente (`src/composants/Bouton.jsx`, relais dans App.jsx)

`<Bouton variante taille icone plein occupe href type …>` — variantes : `primaire` (UNE par
écran) · `secondaire` · `discret` (lien-action, zone 44) · **`danger` = AMBRE** (Supprimer,
Délier ; jamais rouge, §7). `taille="petit"` : 34 px à la souris, **44 au doigt**
(`.vrm-b-petit`, existait déjà en classe). `occupe` : grisé + `aria-busy`. Une variante
inconnue retombe sur `secondaire`. Mesuré : toutes les formes ≥ 44 px au doigt.

`<Segmente label options value onChange plein disabled>` ; option `{v, l, icone, n, titre,
disabled, data}` — **`titre` nomme un segment en icône seule** (title + aria-label ;
ex. `SelecteurSites`, chantier H). Le DESSIN `.vrm-seg-btn` reste au chantier A : à
1512 px, « À envoyer » est rogné (aucun padding latéral) — capture `composants-clair-1512`.

## 5. Les autres composants

- **`ChampRecherche`** `{ valeur, onChange, placeholder='Rechercher', label, micro, voix='requete'|'brut', onValider, autoFocus, inputRef, className, data-* }` :
  champ teinté sans bordure, loupe, croix ronde quand il y a du texte (efface + rend le
  focus ; Échap aussi), micro intégré si `micro` ET la voix existe (Web Speech `fr-FR`,
  disparaît si refusé), le texte reconnu passe par `requeteDeLaVoix` (« numéro 124 » ⇒
  124). 36 px à la souris, **44 px et 17 px au doigt** (iOS ne zoome pas). La saisie
  résiste aux règles générales des champs (spécificité 0,8,2).
- **`PhotoVide`** `{ taille=56, rayon, remplir, titre='Pas de photo', className, style }` :
  case `--vrm-photo`, filet fin, icône d'image centrée (~40 %), aucun mot,
  `data-photo-vide`. Rayon 14 (12 sous 44 px). `remplir` : prend la case du parent.
- **`Numero`** `{ n, taille='petit'|'normal'|'grand', etat='doublon'|'aVerifier', prefixe=true, titre }` :
  rayon 6, chiffres alignés ; clair = encre/blanc, sombre = #48484A/#F5F5F7 (jamais
  blanche) ; `doublon` = le SEUL rouge ; `aVerifier` = ambre. `n` vide ⇒ rien rendu.
  `data-num`, `data-num-etat`. Remplace `.vrm-num-pastille` (blanche en sombre) — à
  migrer dans Messages (chantier G) et Annonces (C).
- **`EtatPanne`** `{ quoi, raison, onReessayer, compact }` : « {quoi} : pas su pour
  l’instant. », la raison (sinon « La lecture n’a pas répondu. »), UN bouton « Réessayer »
  (« Lecture en cours… » tant que la promesse rendue court). Sans `onReessayer`, pas de
  bouton : la raison dit le geste. **Ne remplace pas `BaseInjoignable`** (panne de toute la
  base, dans la coque) : `EtatPanne` dit la panne d'UN bloc à sa place.

## 6. Preuves (5 nov.)

- `npm run build` vert.
- `node scripts/audit-composants.cjs` : vert (montant 42 cas, 4 alias / 86 écarts permis,
  mots, rendu react-dom/server, branchement App.jsx, CSS) ; `--prouve` : **23 mutations,
  toutes rouges** ; `--ecarts` liste chaque écart.
- `node scripts/bancs/composants.cjs` (esbuild, `BANC_PORT` 8750 par défaut) : **274 ✅ ·
  0 ❌**, 3 passages complets consécutifs verts (390 tactile et 1512, clair et sombre, + mouvement réduit).
  `BANC_ANCIEN=1` (l'ancienne feuille) : rouge sur l'opacité à la 1re image et le portail.
  Mutants `fondu`, `transparent`, `croix`, `portail`, `photo`, `blanche` : tous rouges.
  ⚠️ Chromium sans écran laisse parfois une animation WAAPI « running » sans avancer :
  `calme()` la termine après 1,5 s (on juge la cible posée par le geste).
- Bancs voisins, identiques à la base : `nouveau-vendeur` 632, `centre-notifs` 98,
  `boite-emails` 215, `annonces-actions` 125, `colis-qr` 100 (0 rouge avant et après).
  ⚠️ Lancé en même temps que 6 audits en parallèle, `annonces-actions` a eu UN rouge
  (« le parcours s’arrête », clic « Oui, c’est elle » à 1512 sombre — le lien était fait,
  le clic a dépassé ses 4 s sous la charge) ; relancé seul : 125/0, deux fois.
- Les 287 `scripts/audit-*.cjs`, base (archive de `claude/project-review-nsk5su`) contre
  branche : aucun audit ne passe du vert au rouge (le seul écart, `audit-frein-relais-serveur`,
  est un test de concurrence lancé en parallèle : 7/0 relancé seul). Les rouges restants
  le sont aussi sur la base. ⚠️ Le balayage régénère les zips de `public/` : les remettre
  (`git checkout -- public/*.zip public/*.xpi`).
- `fusion-echelle --verifier` : les mêmes 6 fichiers hors échelle qu'avant, aucun nouveau.

## 7. Ce qui reste (chantiers C à H)

- Remplacer les 36 calques faits main par `SheetShell titre=…` (et retirer leurs croix) ;
  « En grand » (Colis) passe à `lumineuse`.
- Les cinq champs de recherche ⇒ `ChampRecherche` ; les vignettes sans photo ⇒ `PhotoVide` ;
  `.vrm-num-pastille` et les N° écrits à la main ⇒ `Numero` ; les états de panne ⇒ `EtatPanne`.
- Les mots : importer `L`/`Lbas` au lieu d'écrire « à poster », « En transit »…
  (`motsEcartesDans` peut servir d'audit d'écran).
- Les 111 `fmt(` / 68 `fmtE(`/`fmtE0(` affichent désormais « — » pour `null` : un écran qui
  voulait vraiment « 0 € » pour un zéro LU passe 0, pas `null`.
