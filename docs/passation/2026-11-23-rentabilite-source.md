# 23 nov. 2026 — Rentabilité par source d'achat (lot `claude/rentabilite-source`)

Validé par Julien le 23 nov. (n° 1 de la file du jour) : « rentabilité par lieu/source d'achat (Vinted, Leboncoin,
magasin, vide-grenier…) : bénéfice moyen, taux de vente, délai, sur les ventes au prix d'achat connu (couverture
affichée) ; complète l'écran rentabilité existant au lieu d'en créer un second ».

## Ce qui est fait

- **Le même écran** : Statistiques › Finances › « Ce que tu vends le mieux » (`src/natif/ecrans/StatsVendsMieux.jsx`,
  lot du 21 nov., `2026-11-21-rentabilite.md`) gagne un 5e regroupement **« Source »** à côté de Modèle · Marque ·
  Taille · Mod. × T. Les tris restent les trois mêmes : Marge (bénéfice moyen par revente) · Vitesse (délai moyen
  achat → vente) · Volume (reventes). Rien de neuf dans la navigation, aucun second écran.
- **Une rangée par source** : le chiffre du tri à droite (« +33 € », « au plus +33 € », « 15 jours », « 20 ») ;
  dessous « 20 revendus sur 30 · 67 % revendus · vendue en 15 jours » (le chiffre du tri ne se redit pas) ; « sur 17
  des 20 » quand des prix d'achat manquent. Pied : « Bénéfice moyen sur K des N reventes (prix d'achat connu) ·
  M ventes sans achat relié, dans aucune source ».
- **Aucune règle neuve** (`src/rentabiliteSource.js`, module pur) : chaque chiffre est celui de « Tes meilleures
  sources » (`bilanSources`, src/meilleuresSources.js), PUBLIÉ par l'écran Ventes/Achats (`vrm_meilleures_sources`,
  sur l'appareil, au nom du compte VRM). Une vente n'est rattachée à son achat QUE par identité (`buyFromId` posé par
  son clic, achat en gros d'un fournisseur qu'il a créé, N° écrit sur un achat hors plateforme qui n'en désigne
  qu'un) ; le bénéfice est celui de la règle unique ; le module ne fait que ranger et dire la couverture.
- **Pas su** : publication jamais faite sur cet appareil (ou d'un autre compte VRM) ⇒ « Pas encore calculé : ouvre
  Achats une fois », jamais une liste vide. La période (7/30/90 j) ne s'applique pas à cet axe : la publication couvre
  tous ses achats — le sous-titre le dit (« Tous tes achats, par où tu les as achetés »).
- Textes : `rt.axe.source`, `rs.*` dans `src/i18n/langues/{fr,en,es,it,de}/rentabilite.js`. Quoi de neuf :
  `rentabilite-source`.

## Preuves

- `node scripts/audit-rentabilite-source.cjs` : **20 verts**. Il EXÉCUTE `bilanSources` puis `rentabiliteParSource` sur
  50 paires inventées au MÊME titre (30 Vinted, 12 hors plateforme dont 6 Leboncoin, 4 vide-grenier aux trois
  écritures, 2 sans source ; 8 ventes sans lien d'achat) et recompte à part : taux, moyenne et sa couverture, délai,
  « au plus », tris, « pas su », lecture par compte VRM, vue sans calcul, cinq langues.
- Mutations, chacune rouge : `taux`, `moyenne`, `ordre`, `passu`, `vue`, `owner`, `ressemblance` (7/7). Sur le code
  d'avant (origin/main), le module n'existe pas : rouge dès le chargement.
- Banc de rendu : voir « ÉTAT À LA REPRISE ».

## Textes et boutons (consigne de Julien relayée le 23 nov. : « trop de texte, pas assez de beaux boutons »)

- Au plus une phrase courte par bloc (≤ 8 mots), le détail sous « Pourquoi ? » (repli `vrm-repli`), les gestes en
  boutons communs (`Bouton` natif, icône + verbe court). La branche `claude/style-clair` n'ajoute pas d'autre composant
  bouton : c'est celui de `src/natif/Bouton.jsx`.

## Mesures de la vraie base (lecture seule)

Mesures base (lecture seule, 23 nov. ~11:55 UTC, projections scalaires) :
- ext_appareil_* : 19 lignes, 1 owner, 19/19 à la forme attendue (data->>atMs, data->appareil->>nav).
- vrm_meilleures_sources : 0 ligne en base (publication sur l'appareil, normal).
- studio_photos_* : 0 ligne (personne n'a encore rangé de photo au studio).
- email_invoice_* : 24 lignes.
- main : vrm_colis_retirer présent sur 4 lignes main (1 colis, tuple à 8 cases, limite lue AAAA-MM-JJ, transporteur vinted) ;
  vrm_colis_aposter ABSENT de la base (publication de CET appareil seulement : la liste des envois n'existe que là où Colis/Ma journée l'a calculée) ;
  vrm_fiches_neuves ABSENT partout ; vrm_slots : 1 ligne main, 8 cases.

## ÉTAT À LA REPRISE

- Branche poussée ; PR et banc de rendu (390/1512) à faire après 15:30 UTC (lourd.sh), fusion pas avant le 24 nov.
  07:00 UTC, selon la règle du 16 nov.
- Ce qui reste : une période (7/30/90 j) pour la source demanderait de publier les reventes datées par source
  (la publication actuelle est un bilan de tous les achats) — pas fait, pour ne pas créer une seconde règle.

Geste de Julien : aucun (ouvrir Achats une fois sur l'appareil calcule la publication).
