# 11 nov. — Lot `ventes-achats-visuel` : Ventes et Achats beaux et sobres

Branche `claude/ventes-achats-visuel` (depuis `claude/colis-a-leur-place` + `claude/retraits-fiables` +
`claude/suivi-commandes`, puis un vrai `git merge origin/main`). Pas de PR, pas de merge dans `main`.
Aucune écriture en base, extension inchangée, fonctions `api/` inchangées.

Julien, sur ses captures de production : « ces visuels ne sont pas top du tout ». Principe : « plus beau,
simple, surtout PRATIQUE ».

## Ce qui a été mesuré AVANT (banc neuf, données inventées, formes réelles)

Ventes (filtre Vinted) à 1512 px : 7 boutons bleus pleins à l'écran (« Tout imprimer » + un « Imprimer le
bordereau » par vente, **1 100 px de large**), cartes de **222 px** (à expédier) / 166 px, une frise de 4 traits
de **5 px** avec **4 libellés** colorés, les étapes passées en bleu, « Achat · à saisir » et « Bénéf. » répétés
sur chaque ligne. Au téléphone : cartes de 199 px, un bouton bleu de 278–330 px par vente. Ventes (« Tous ») :
3 boutons ronds bleus pleins dans « À expédier ». Achats : une bande grise pleine largeur avec un logo centré
(corrigée entre-temps par `suivi-commandes`, fusionnée), 40 px vides sous « À retirer ».

## Ce qui change (forme seulement — aucune règle, aucune donnée)

1. **Un seul bouton bleu plein par écran** : « Tout imprimer (N) ». Le bordereau d'UNE vente s'imprime par une
   petite action grise (icône + « Imprimer ») : 44 px au doigt, 36 px à la souris (`--vav-bouton`, pointeur fin),
   jamais pleine largeur. Même chose sur les cartes « À expédier » (rond gris 44 px au doigt, « Imprimer » à
   l'ordinateur). Le transporteur de la ligne : son logo, 20 px, à gauche de l'action.
   `[data-fu-imprimer]`, `data-imprime`, `data-fu-geste`, la fonction (`imprimerBordereauVente`) : inchangés ;
   classe `vrm-fu-principal` → `vrm-fu-imprimer-ligne` (aucun banc ne la lisait comme règle).
   « Générer le bordereau » (l'extension) garde sa raison et son repli « sur Vinted ↗ » dessous.
2. **La frise** (`src/design/Frise.jsx`, partout où elle sert) : une barre de **3 px**, l'étape actuelle nommée
   **une fois** sous la barre (`data-fu-legende` : la dernière étape faite et sa date si la preuve est datée —
   « Vendue · 9 nov. » ; rien de fait ⇒ l'étape en cours). Couleurs : piste neutre, étapes passées gris moyen,
   **bleu sur l'étape actuelle seulement**, **ambre sur l'étape en cours seulement si un geste est dû**. Le nom et
   l'état de CHAQUE étape restent dans son segment pour VoiceOver (`vrm-fu-sr`). `data-fu-frise`, `data-fu-etape`,
   `data-fait`, `data-cours`, `data-ton`, `data-derniere` : inchangés. Aucune règle neuve (`legendeFrise` lit ce que
   `friseFusion.js` pose). Sur une ligne de vente Vinted, la frise est DANS la ligne (`friseEtat`, des `<span>` :
   rien d'interactif dans le bouton) — sous l'état au téléphone, dans la colonne « État » à l'ordinateur.
3. **Ventes à l'ordinateur : une grille alignée** — photo 56 · N° + titre · état + frise · prix · bénéfice ; les
   actions (logo + Imprimer, « … ») dans une colonne fixe à droite ; l'en-tête des colonnes (« Article · État ·
   Prix · Bénéfice ») écrit UNE fois (§7) : plus de « Bénéf. » ni « Achat » sur chaque ligne. Le prix d'achat reste
   dans la vente (récapitulatif) ; la case de la ligne dit « — » au lieu de « à saisir » (`data-achat-etat="manque"`
   inchangé) ; l'invitation groupée en tête dit « **4 prix d'achat à saisir** · 2/6 connus · Compléter »
   (`data-ventes-achats` inchangé, `data-ventes-achats-manquent` ajouté). Lignes de **76 px**.
4. **Au téléphone** : carte = photo 56 · (nom + prix / N° · site · compte / état / frise) puis, à droite, logo +
   « Imprimer » 44 px ; la rangée de note vide ne laisse plus 8 px + un écart ; 177 px (à expédier) / 104 px.
5. **Achats** : la section « À retirer » ne laisse plus 40 px vides (`colisDans` / `retraitsOutils` : marges de
   l'ancien écran Colis réduites). La ligne de suivi est celle de `suivi-commandes` (non refaite).

Fichiers : `src/styles-ventes-achats-visuel.css` (neuf, importé EN DERNIER dans App.jsx), `src/design/Frise.jsx`,
`src/App.jsx` (prop `friseEtat` de `LigneVenteCompacte`, deux boutons d'impression de ligne, `achatTxt`, invitation,
marge de la section colis).

## Preuves

| contrôle | branche | base (mêmes sources sans ce lot) | mutations |
|---|---|---|---|
| banc **`ventes-achats-visuel`** (neuf : 390 tactile + 1512, clair + sombre ; Ventes « Tous », Ventes Vinted, Envoyés, Achats) | **98 verts** | **38 rouges** | A (libellés de frise visibles + « à saisir » sur la ligne) ⇒ 4 rouges ; B (étapes passées bleues + « Imprimer » bleu plein) ⇒ 6 rouges |
| `colis-a-leur-place`, `selection-bordereaux`, `colis-retirer-propre`, `retraits-fiables`, `suivi-commandes`, `tout-imprimer`, `colis-relier-carte`, `transporteurs-logos`, `lien-vc-frise`, `ventes-e2`, `vague2-ventes`, `ventes-bordereau`, `ventes-benefice-glisser`, `ventes-une-phrase` | verts | — | — |
| `achats-retraits` 8 · `colis-envoi` 8 · `journee-photos` 6 · `ventes-colis-premium` 2 · `design-fusion` 8 rouges | identiques à la base | identiques | — |
| audits `variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets, ventes-prix-achat, ventes-e2` | verts | | |
| audits `violet` (3, logos FedEx / Relais Colis), `rouge-doublon` (3, autres écrans), `colis-envoi` (1) | rouges, identiques sur la base | | |

Ce que mesure le banc (data-* et boîtes, jamais un libellé) : boutons bleus pleins visibles ≤ 1 ; aucun bouton
rempli plus large que la moitié de la liste à l'ordinateur ; hauteur des cartes (≤ 96 px ordinateur, ≤ 190 px
téléphone) ; « Imprimer » ≤ 160/200 px ; frise : traits ≤ 4 px, UN mot visible, bleu seulement sur l'étape
actuelle, ambre seulement sur un geste dû ; bénéfice écrit sur chaque ligne (montant ou « — ») ; aucune ligne ne
dit « à saisir », une seule invitation ; cibles ≥ 44 px au téléphone ; logo du transporteur ≤ 22 px à gauche de
l'action ; Achats : ≤ 1 bleu plein, aucun bandeau transporteur pleine largeur ; ni débordement, ni garde-fou, ni
erreur. Le banc a attrapé en route un vrai défaut de ce lot (un commentaire `//` avait avalé le bénéfice de la
ligne) : le contrôle « le bénéfice reste écrit » est né de là.

Bancs portés honnêtement (ils jugeaient la forme d'avant, pas une règle) :
- `design-fusion` : « 44 px » vaut AU DOIGT, 32 px minimum à la souris ; « un bouton rond bleu par colis » ⇒ « une
  action d'impression secondaire par colis prêt (rond 44 px au doigt, « Imprimer » à la souris), jamais un 2e
  bleu » ; la puce d'une ligne de vente = logo ≤ 24 px, centrée sur l'action (la pastille de 44 px reste jugée
  ailleurs).
- `vague2-comptes` W3 : « aucun libellé coupé » se juge sur le mot VISIBLE (la légende), chaque étape gardant son
  nom lu.

Captures regardées avant/après côte à côte : Ventes Vinted 1512 clair/sombre, 390 clair/sombre ; Ventes « Tous »
1512 sombre / 390 clair ; Envoyés 1512 ; Achats 1512 sombre / 390 clair.

## Ce qui reste

- La ligne « Envoyer la facture / Bon de retour » (vendeurs Pro) est rangée sous la ligne, compacte, mais n'est
  pas servie par le banc (il faudrait une facture Pro inventée) : à regarder sur une vraie vente Pro.
- L'en-tête de groupe par transporteur n'existe plus (filtres « Mondial Relay · 2 », lot colis) : rien à refaire.
