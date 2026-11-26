# 23 nov. · Lot A — « Litiges et retours » : tous les sites, ventes ET achats (`claude/litiges-retours`)

Julien (validé le 23 nov.) : « un écran Litiges et retours tous sites (Vinted, Leboncoin, eBay, Vestiaire) : chaque
litige/retour en cours avec son état, sa date limite (lue, jamais inventée ; sinon « pas su »), le geste à faire (lien
direct). Forme jamais vue ⇒ « pas su » ».

## Ce qui existait
« Litiges en cours » (10 nov., lots BB/BI, `src/LitigesEnCours.jsx`, `src/litigesEcran.js`, `src/litiges.js`) : les
litiges et retours de VENTE (Vinted : transactions 440/430, e-mails « problème avec la commande », « l'acheteur
souhaite annuler » ; eBay : retours Post-Order), leurs preuves, « Pas à pas », le dossier PDF, « Retours par modèle ».
Les retours d'ACHAT (bordereau de retour reçu par e-mail, avis « Retourne ta commande d'ici le … ») vivaient seulement
dans Achats (`RetoursAchatBloc`, `src/retoursAchat.js`).

## Mesuré le 23 nov. (lecture seule, projections scalaires)
`lbc_ventes` 16 lignes : stepStatus done 3 · validation 8 · cancelled 5 (des annulations, aucun litige) ; `vc_ventes`
3 ventes, aucun statut de litige ; `ebay_orders` 0 commande ; transporteurs : 1 « retour à l'expéditeur » (juillet) ;
`email_retourdemande_*` 3, `email_bordretour_*` 2, `email_rembachat_*` 4. ⇒ Un litige Leboncoin ou Vestiaire ne se
lit toujours pas : la ligne du site dit « jamais vu — regarde sur le site », jamais « aucun ».

## Ce qui est fait
1. `src/litigesTousSites.js` `litigesEtRetours({ ventes, achats })` — n'ASSEMBLE que les règles existantes : les cartes
   de `litigesDesVentes` et les retours d'achat EN COURS de `retoursAchat`/`classerRetoursAchat` (un retour remboursé
   est fini). Une ligne = une identité ; date limite seulement LUE (texte et date lisible) ; le plus pressé d'abord ;
   geste = la conversation de SA commande, sinon SA transaction, sinon la boîte Vinted ; l'état par site et par sens ;
   « au moins » dès qu'un site ou un sens n'est pas lu.
2. L'écran devient « Litiges et retours » (`?tab=litiges`, entrée « Litiges et retours » de Ventes) : le total tous
   sites (« au moins 4 en cours · dont 1 pressé »), les cartes de vente d'avant, une section « Retours de tes achats »
   (`data-retour-achat-ligne` : N°, « Retour à renvoyer · À déposer », « Avant le 26 nov. » ou « Date limite non lue »,
   lien « Ouvrir la commande sur Vinted »), et la ligne « Vinted · retours d'achat » dans « Ce que VRM lit ».
3. Textes `lit2.*` en 5 langues ; « Quoi de neuf » `litiges-retours-tous`. Aucune couleur ajoutée (ni ambre, ni rouge).

## Preuves
`node scripts/audit-litiges-tous-sites.cjs` vert (23 contrôles), `--prouve` 6/6 mutations rougissent (remboursé gardé,
date non vérifiée, tri ignoré, geste au hasard, « jamais vu » tu, rien lu ⇒ complet). `audit-litiges-ecran`,
`audit-litiges`, `audit-retours-litiges`, `audit-a-trancher` : verts. Banc `scripts/bancs/litiges-ecran.cjs` complété
(section des achats présente, jamais mélangée aux ventes, titre, ligne de site) — à lancer après 15:30 UTC.

## ÉTAT À LA REPRISE
- Poussé sur `claude/litiges-retours`. Après 15:30 UTC : build, banc `litiges-ecran` (avant/après, 390 et 1512),
  captures ; PR ; fusion demain après 07:00 UTC ; ligne CLAUDE.md §9 à la fusion.
- Ce qui manque et pourquoi : litiges Leboncoin et Vestiaire — forme jamais vue (mesurée le 23 nov.) ; eBay — aucune
  commande en base. Geste de Julien : aucun.
