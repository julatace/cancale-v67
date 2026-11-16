# 16 nov. 2026 — Ventes plus clair (captures iPhone de Julien, 8 h 17 : « je pense que tout peut être amélioré »)

Branche `claude/ventes-clair` (depuis `origin/main`). La LECTURE seulement : aucune règle métier, aucun chiffre recalculé,
aucun data-* retiré. Direction actuelle gardée (Verre dépoli, Inter, accent rare) ; CLAUDE.md §7 (un même nombre jamais
deux fois, une phrase répétée se dit une fois, 44 px).

## Ce qui est fait (Ventes · Vinted · « Toutes »)

1. **La bande du mois** au lieu de la carte sombre + trois tuiles verre (texte blanc sur verre clair, 1,5:1) :
   `CarteStatsApp page="ventes" bande` (la bande des écrans de liste, ≤ 72 px). « À envoyer » et « En route » de la bande
   sont tus (`verre-ventes.css`) : le segment juste au-dessus les porte (« À envoyer 30 · En route 18 ») — et la bande
   comptait « En route » sur les VENTES (30), le segment sur les COLIS (18) : deux « En route » différents. Restent le
   vendu du mois et « À payer ».
2. **« À venir » ne redit plus les compteurs** : `ArgentAVenirCarte … sansEtapes` sur Ventes · Vinted (la ligne
   « 3 à envoyer · 27 en route · 11 livrées » est le segment).
3. **« N choses à regarder »** (`src/ventes/ARegarder.jsx`) : retirer l'argent, boosts, compte qui annule plus, « N prix
   d'achat à saisir », l'argent après frais, « 1 bordereau à générer : via ton ordinateur » — dans UN repli fermé (mêmes
   composants, mêmes data-*, mêmes gestes). N = les cartes RENDUES (un composant muet ne compte pas) ; 0 ⇒ caché.
   ⚠️ Restent HORS du repli : une lecture ratée (`data-ventes-ko`) et la raison d'un bouton GRISÉ
   (`RaisonBordereauxGrises seulement="grise"`, règle du 16 oct.) ; seule la ligne d'information « via ton
   ordinateur » (`seulement="relais"`) est repliée.
4. **« Après frais de vente au plus … sur 152 ventes de 2 184 »** ⇒ « compté sur 152 ventes sur 2 184 (celles dont tu
   connais le prix d'achat) » (`argentPlus.bl.sur`, 5 langues), dans le repli.
5. **Filtres jamais coupés** : à 390, capsules serrées (44 px de haut) et « Outils » en rond de 44 px (son nom reste lu),
   le tout sur UNE ligne. **« Sélectionner »** : encre claire du fond (il était bleu sur bleu, 1,65:1).
6. **La ligne de vente en trois lignes** (téléphone, 116–190 px ⇒ 86 px) : titre · prix ; N° · compte · T38 (une ligne,
   le compte coupé proprement ; « Vinted » tu sur Ventes · Vinted, qui ne liste que Vinted) ; état · date · frise fine.
   Une vente à envoyer : « ● À envoyer · Vendue · 11 nov. », « Imprimer » en rond de 44 px À CÔTÉ du « ⋯ » (plus une
   ligne à lui seul). La taille s'écrit « T38 » (`data-fu-taille` inchangé).
7. **« Le navigateur de ton ordinateur est connecté sur X — bascule sur Y… »** sous « Générer le bordereau » ⇒ une
   puce courte « Ouvre Y sur vinted.fr, sur l'ordinateur » ; la phrase entière sous « Pourquoi ? » (et le titre du bouton).

Aussi : texte de la règle d'offre eBay raccourci (« Offre ≥ ce montant : eBay l'accepte, la paire est vendue… ») — rouge
`audit-textes-courts` venu de main (règle du 16 nov. : zéro rouge).

## Mesures (banc `scripts/bancs/ventes-clair.cjs`, 2 000 ventes inventées, 3 comptes)

| | avant (main 5a9abe57) | après |
|---|---|---|
| haut de la 1re vente, 390 | 982 px (sous la barre) | 640 px |
| hauteur d'une ligne, 390 | 116 px (190 à envoyer) | 86 px |
| cartes avant la liste | 6 (dont 3 tuiles) | 1 ligne « 2 choses à regarder » |
| compteurs redits | 2 (bande = segment) | 0 |
| chiffres de la bande | 1,55:1 | ≥ 4,5:1 |
| « Sélectionner » | 1,65:1 | ≥ 4,5:1 |
| filtres coupés / sur une ligne | « Annulées » coupé | entiers, une ligne |

- Banc : **54 ✅ · 0 ❌** (390 tactile et 1512, clair et sombre). Sur l'arbre de départ : **8 ❌** (H, D, R, L, F, C×3).
  Le contrôle « Imprimer ne couvre pas ⋯ » a rougi sur la version intermédiaire (8 lignes chevauchées) avant le correctif ;
  « filtres sur une ligne » rougit sur la version sans les capsules serrées (54 px d'écart).
- `ventes-verre` 70 verts. Audits : traduction, tdz, variables, studio (S3 : la feuille s'appelle `verre-ventes.css`,
  famille du verre), violet, rouge-doublon, textes-courts, quoi-de-neuf, offres-auto : verts.

## Pas fait (dit)
- 1512 « fiche à droite en permanence » (maquette) : la fiche s'ouvre toujours en plan au clic.
- La puce « Ouvre Y sur l'ordinateur » n'est pas encore dite UNE fois en en-tête quand plusieurs lignes la portent.
- Annulations / prix d'achat : repliés ici, pas déplacés vers Santé des comptes / Argent (aucune règle touchée).
- Le banc ne sert pas d'« Argent à venir » rempli au premier rendu : la règle « étapes tues » est jugée quand la carte est là.

## ÉTAT À LA REPRISE
Branche poussée ; PR « Ventes plus clair » (voir CLAUDE.md §9). Geste de Julien : aucun.
