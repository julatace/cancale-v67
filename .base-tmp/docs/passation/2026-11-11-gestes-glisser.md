# 11 nov. 2026 — Glisser pour agir, comme Mail (lot « gestes-glisser »)

Branche `claude/gestes-glisser` (aucune PR, aucun merge dans `main` : consigne du lot).

## Ce qui est livré

**Un seul composant, `src/LigneGlissable.jsx`**, et sa règle pure `src/glisserRegle.js`.
Glisser une ligne vers la **gauche** révèle 1 ou 2 actions à droite ; un glisser **long**
(au moins 55 % de la ligne et 64 px au-delà des actions) déclenche l'action principale.

- Rendu à fonction, aucune enveloppe : `children(gp, tiroir)` — `gp` se pose sur la ligne
  (les règles `.liste > .ligne` restent vraies), le `tiroir` est un enfant direct de la ligne
  à `left: 100%` ; le parent le coupe (`:has(> [data-lg]) { overflow-x: clip }`).
- Aucun rendu React par image : la position passe par `style.translate` (comme `GlisserColis`).
- Au doigt et au stylet seulement ; **jamais depuis les 24 px du bord gauche** (retour arrière
  d'iOS) ; direction décidée après 10 px, franchement horizontale (|dx| > 1,4 |dy|) et vers la
  gauche, sinon c'est un défilement et la ligne ne bouge plus (`touch-action: pan-y`).
- Élastique au-delà du seuil ; ressort sobre à la pose (`cubic-bezier(.25,1.12,.4,1)`, 420 ms) ;
  **mouvement réduit** : pose sans animation.
- `navigator.vibrate` léger au seuil long (8 ms) et à l'action (15 ms), si l'appareil sait.
- Une seule ligne ouverte ; un toucher ailleurs ou Échap la referme ; le clic qui suit un glisser
  est avalé ; une action du tiroir ne déplie pas la ligne par-dessous.
- **Découvrabilité** : la première fois sur cet appareil (pointeur « coarse »), UNE ligne montre
  ses actions 0,9 s puis revient ; `localStorage.vrm_glisse_indice_vu` (confort par appareil,
  lu dans un try/catch : sans stockage, aucun indice).
- **Accessibilité** : le tiroir fermé est `inert` + `aria-hidden` (aucune tabulation dans un tiroir
  caché). Chaque action du tiroir **existe déjà en bouton visible** de la ligne (vérifié par l'audit
  et par le banc à 1512) ; l'option `menu` pose un bouton « … » 44 px qui ouvre le tiroir au
  clavier — pas utilisée aujourd'hui, puisque tous les gestes ont déjà leur bouton.

## Les écrans (les MÊMES fonctions que les boutons)

| écran | principale (glisser long) | seconde | fonction réutilisée |
|---|---|---|---|
| Ventes (vente à expédier) | Déposé | Imprimer (si le PDF est là) | `demanderDepose` (barre « Annuler » 5 s) · `imprimerBordereauVente` |
| Colis/Achats → À retirer (`LigneRetraitF`, src/CarteRelais.jsx) | Retiré | Le code (« 2 codes » en désaccord) | `retirer(x)` (pilule « Annuler » 5 s) · `voirCode` (ligne ouverte + copie) / `setOuvert` |
| Achats, cartes « à retirer » de l'espace Vinted (App.jsx ; jugées par l'audit seulement, le banc ne les rend pas) | Retiré | Le code (lien de la conversation, ou QR en grand si la carte porte ce bouton) | `markPickupDone` / `markCollected` · `openQrView` |
| Annonces → Qui dorment | Baisser | Agir | `onBaisser([a])` ⇒ **la feuille** de baisse (sa confirmation ; rien ne part chez Vinted au glisser) · `onAgir` |
| Messages | — | — | **aucun « Lu » n'existe en bouton** dans Messages (le non-lu vient de Vinted ; le seul « Marquer lu » est la boîte e-mails de Réglages, qui a déjà son glisser vers la droite). Rien inventé. |

`GlisserVente` (Ventes, 1er nov.) est **retiré** : son geste passe par `LigneGlissable`.
Le glisser **vers la droite** de Colis (`src/GlisserColis.js`, « Colis fait ») et celui de la
boîte e-mails restent tels quels (autre sens, autre écran ; à unifier plus tard si Julien le veut).

## Gestes comptés (avant → après)

- Baisser le prix d'UNE annonce qui dort : cocher + « Baisser le prix (1) » = 2 → **1 glisser** (la feuille s'ouvre ; sa confirmation reste).
- « Déposé » d'une vente : « … » + « Déposé » = 2 → **1 glisser** (déjà possible depuis le 1er nov. ; même nombre, mais « Imprimer » est maintenant à côté).
- « J'ai retiré » / « Code » à retirer : 1 toucher sur une petite pilule → **1 glisser** sur toute la ligne (même nombre ; une cible bien plus grande au point relais).

## Preuves

- `npm run build` vert ; audits `variables, tdz, coherence, identite, icones, textes-courts,
  fonctions-api, secrets, csp, glisser-colis` verts.
- `node scripts/audit-ligne-glissable.cjs` : 39 contrôles, la règle EXÉCUTÉE ; `--mutation` :
  15/15 mutations tuées (bord gauche, souris, vertical, sens, seuil long, élastique, ouvrir ≠
  agir, 3 actions, tiroir pas inert, ressort en mouvement réduit, mauvaise fonction pour
  Déposé/Retiré, baisse directe chez Vinted, Imprimer sans PDF, code sans bouton QR).
- Banc `scripts/bancs/gestes-glisser.cjs` : 42 verts (390 tactile, vrais événements tactiles CDP ;
  1512 souris + clavier). **Rouge sur origin/main** (11 rouges : ni tiroir ni actions). **Mutations
  du banc** : bord gauche non réservé ⇒ V4 rouge ; tiroir jamais `inert` ⇒ K2 rouge.
- Bancs voisins après `git merge origin/main` : `ventes-benefice-glisser` (adapté à `data-lg`),
  `retrait-carte`, `retrait-relais-carte`, `baisse-prix`, `beaute` verts. `vendre-plus` a 2 rouges
  (menu « Agir » sans Leboncoin/eBay/Vestiaire) **déjà rouges sur origin/main** : pas ce lot.
- Captures regardées (390 : Ventes, À retirer, Qui dorment ouverts ; 1512 Ventes). Correction faite
  après lecture : les actions sont des cases arrondies (rayon 14) à 8 px de la ligne, sinon une
  bande blanche restait dans les listes en retrait ; « Imprimer » n'est plus tronqué (68 px).

## Geste de Julien

Aucun. À essayer au doigt sur l'iPhone : Ventes, Colis → À retirer, Annonces → À relancer → Qui dorment.
