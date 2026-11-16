# 16 nov. 2026 — Les restes du design (lot design-restes)

Branche `claude/design-restes`. On ACHÈVE la direction (Verre dépoli, Studio bleu clair, Inter), rien n'est changé de
direction. Couche `src/design/verre-restes.css` (`@layer vrm-verre`). Ventes est parti dans le lot dédié
`claude/ventes-clair` (PR #1202, récit `2026-11-16-ventes-clair.md`).

## Fait
1. **Leboncoin, eBay, Vestiaire, Stock : la rangée touchée MONTE à sa place** (téléphone), la même carte en porcelaine
   qu'Annonces · Vinted (`src/paires/PaireAvantSite.jsx`, hôte `PaireAvantHote`). Chiffres LUS par la plateforme :
   prix affiché, jours en ligne, favoris (eBay : observateurs) ; « acheté » = le prix d'achat SAISI de SON N°
   (`achatDuNumeroLu`, App.jsx : la fiche UNIQUE du N°, sinon la table par N° ; rien ⇒ « — ») ; Stock : la place
   (« Étagère A · rangée 1, colonne 3 ») au lieu des favoris. Gestes : « Voir sur <site> » (lien https lu) et « ⋯ » / « Ouvrir
   la fiche » (la fiche par la ligne, jamais par le titre). Les autres rangées reculent ; « × », Échap, un second toucher la
   redescendent ; un contrôle de la rangée (« Relier à Vinted », « Gérer ») garde son geste. À l'ordinateur : la fiche en plan,
   comme avant. Un hôte ne pose rien dans une rangée qui n'est pas la sienne (`PaireAvant.jsx` : contenu nul ⇒ pas de portail).
   Stock : seule une paire NUMÉROTÉE monte (sans N° : aucune identité à ouvrir).
2. **Recherches coupées à 390** : eBay « N°, titre, SKU… », Leboncoin « N°, titre, compte… » (`tr`, 5 langues).
3. **Encre claire sur le fond bleu** : « À faire · N » des sites (1,65:1), notes eBay (« Offre aux observateurs… »,
   « Aucun brouillon », « Inactives sur eBay », « Réglages eBay »), pieds de liste (« 5 reçues », « 3 annonces · Lu il y a
   2 h »), « Détails et réglages » : 1,2–1,8:1 ⇒ ≥ 4,5:1.
4. **Stock : un meuble se GLISSE au doigt** par sa poignée (44 px, `touch-action: none`) ; au lâcher il est posé à sa place
   (`placerMeuble`, src/stockEtageres.js, même écriture `ordre` que les touches, une fois). Les touches monter/descendre
   restent ; ↑/↓ au clavier sur la poignée.
5. Réparé en passant (main) : trois doublons de nom App.jsx ↔ écrans (source des audits), texte eBay trop long,
   `audit-stock-etageres` qui ne copiait pas les modules de src/ qu'importe api/_lib.

## Preuves
- `scripts/bancs/design-restes.cjs` (NOUVEAU) : **108 ✅** au passage complet (monte, plan, fond, recherche, glisse ;
  390 tactile et 1512 ; clair et sombre), puis 86 ✅ et 6 ✅ sur les parties reprises après correctifs. Sur l'arbre de
  départ : **32 ❌** (aucune clé de rangée, la fiche s'ouvre par-dessus, contrastes 1,65:1, placeholders 175/149 et 252/201 px,
  pas de poignée).
- `audit-stock-etageres` 59/59 ; mutation « placer-echange » ⇒ 2 rouges. Audits traduction, tdz, variables, studio, violet,
  rouge-doublon, textes-courts, icones : verts.

## Pas fait (dit)
- (30) Achats à l'ordinateur : tableau « Tous les achats en cours », chiffres de tête, une carte par colis ; fiche à droite en
  permanence : non faits. Le « ⋯ » des lignes d'Achats (un menu déjà recopié dans la fiche) n'est pas retiré : 6 bancs le
  touchent (photos-achats, recu-achat, feuilles-coque, annuler-commandes, revente-modele, design-passe-3), à porter avec lui.
- (33) Maquette v3 de l'étagère : la maquette n'est pas dans le dépôt ni le scratchpad ; seul le glisser est fait.
- (34) Tailles hors échelle / gris codés en dur : seulement dans les fichiers touchés ; « Tout sur le N° » = fiche D (15 nov.).
- (35) `<select>` de Notifications, N° deux fois dans la loupe : réglés par design-passe-2/3 (14 nov.) ; bancs design-passe-2/3
  pas relancés (machine saturée, charge 45–60).

## ÉTAT À LA REPRISE
Branche poussée, PR ouverte, PAS fusionnée : main est rouge sur Audits ×3, Bancs, écrans, regles AVANT ce lot (règle de
Julien du 16 nov. : zéro rouge). Geste de Julien : aucun.
