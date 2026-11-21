# 15 nov. 2026 — La version « Studio bleu clair » : intégration et passe de preuves

Branche `claude/version-studio` = studio-fondation + studio-paires + studio-ventes + studio-reste + impression-simple
+ idees-paires (154, 157, 158) + vente-main-propre (160) + idees-argent + studio-journee + correctif-afaire
+ origin/main (avec le « revert du revert » `babd987d` : main portait `4dc6921a`, le revert de la PR d'intégration
du 14 nov. — sans lui, fusionner main aurait retiré tout le travail en silence).

## La passe complète (machine libre, un banc à la fois)

26 audits verts (traduction, quoi-de-neuf, tdz, variables, coherence, extension-zip, composants, icones, violet,
rouge-doublon, identite, csp, fonctions-api, studio, accueil-reste, exemple-photos, mode-exemple, geste-annulable,
repli-retirer, idees-paires, vente-main-propre, impression, colis-plus, codes-retrait, retrait-fiable, urssaf).
22 bancs ; trois rouges, tous trois réels ou dus à la fusion, corrigés :

1. **tout-imprimer** (4 rouges) — l'intégration avait reposé `data-lot-ouvrir` sur le grand bouton plein « Imprimer (N) »
   (qui imprime d'un toucher) : deux éléments portaient l'étiquette de « Choisir ». Retirée du plein (le chantier
   impression-simple l'avait réservée à « Choisir »). Rouge avant (le banc touchait le plein), 28 verts après.
2. **accompagnement** (`colis.imprimer` pendant / après / échec absents) — le parcours en un toucher a retiré la feuille
   « VRM travaille » (c'était elle qui bloquait l'iPhone, voulu) qui portait ces trois moments, et rien ne les
   remplaçait : **un échec (base injoignable) ne disait rien** (un toast qui file). Rebranché dans
   `attendrePuisOuvrir` par `accompagner('colis.imprimer')` : pilule « En cours · n / N » (suit `imprBusy`), échec dit
   avec sa raison et « Réessayer » (le lot « vide » est oublié pour que l'essai relise), question annulée = rien ;
   l'après est la feuille « Tout est sorti ? » (`data-acc-apres` sur sa phrase). Le banc répond aussi « Classique · A4 »
   à la question du papier (posée une seule fois). 29 moments verts.
3. **accueil-reste E3** (bulle du glossaire, ordinateur) — seul, vert ; avec un autre banc en même temps, la page était
   occupée plus de 400 ms. Le banc ATTEND la fermeture (3 s au plus) au lieu d'un délai fixe (§6.5).

Aussi : Annonces, « Bénéfice — : prix d’achat 0/36 connus » ⇒ « Bénéfice : — (prix d’achat 0/36 connus). »
(`src/prochainGesteAnnonces.js`, contrôle D5 inchangé et vert).

Captures regardées (390 et 1512, clair et sombre) : Ventes/À expédier, Paires/Annonces, impression (papier, visionneuse,
échec), accompagnement.

## Reste connu (pas bloquant)
- Leboncoin / eBay / Vestiaire / Stock : la ligne ouvre encore la fiche au lieu de la monter au premier plan.
- Placeholder de recherche eBay coupé à 390.
- Les phrases du « prochain geste » d'Annonces sont écrites en français dans `src/prochainGesteAnnonces.js` (pas `tr()`).
- Safari n'est que simulé : à essayer une fois sur l'iPhone de Julien (« Imprimer (N) » ⇒ partage ⇒ Imprimer).
