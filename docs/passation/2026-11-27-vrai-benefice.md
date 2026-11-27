# 27 nov. · Le vrai bénéfice — par paire, par mois, par compte (`claude/vrai-benefice`)

Julien (27 nov.) a choisi « le vrai bénéfice », retenu le 11 oct. comme « bénéfice réel » et « compte qui vend le mieux ».
Règle demandée, par paire : prix de vente (ou l'argent reçu) − prix d'achat − port payé à l'achat − frais de la
plateforme − boosts ; chaque terme compté seulement s'il est connu, le manque dit, jamais 0 pour « pas su ».

## Ce qui existait (mesuré dans le code, ÉTENDU, rien dupliqué)
- Par paire : `coutReelVente` (src/coutReel.js) et `beneficeArticle` (src/beneficeArticle.js) — la fiche de la vente
  (Ventes › une vente › la fiche de l'article) décompose déjà vente − commission − boost − emballage − port − achat,
  « au plus » quand les frais ne sont pas confirmés ; colonne « Net » du tableau.
- Par compte (moyenne par paire) : Statistiques › Gains › « Par compte » (`gainsReels`, 24 nov.).
- L'export comptable (27 nov.) : colonne « Bénéfice » par vente = `margesPar` sur la ligne du relevé `vrm_stats_ventes`.
- Il manquait : le bénéfice PAR MOIS (même base que l'export), le TOTAL par compte (« le compte qui vend le mieux »),
  le port de l'achat dit, et l'assurance que l'écran et l'export disent le même chiffre.

## Fait
- **`src/vraiBenefice.js`** — UNE fonction, `beneficeReleve(r)` (= `margesPar` sur la ligne du relevé : vente − achat −
  frais notés), appelée par l'export (`detailVenteReleve`, src/exportComptable.js, à la place de sa copie) ET par l'écran.
  `termesReleve` donne les termes (vente, achat, boost [11][0], port payé par lui, commission « aucune » / « déduite »,
  port de l'achat « recu » / « saisi ») et l'état : `achat` (« — »), `auPlus` (frais pas confirmés : un plafond), `ok`.
  `vraiBenefice(releve, { mois, de, a })` : par MOIS (au mois du VERSEMENT pour Vinted, de la vente pour les autres —
  la base de l'export ; pas versée ⇒ « à dater », dans aucun mois) et par COMPTE (la période choisie ; le plus gros
  bénéfice connu d'abord). Somme des connus + couverture « sur K/N » + manque nommé (« N sans prix d'achat »,
  « N aux frais pas confirmés ») ; jamais « au moins » (une paire au prix inconnu peut être à perte, beneficeNoms.js).
- **Relevé `vrm_stats_ventes`, colonne [12]** (src/ceQuiRapporte.js `releveVentes`, param `drapeaux`) : 'c' frais confirmés
  (« Tous les frais sont renseignés »), 'r' prix d'achat posé depuis le reçu (`buyPriceSource` recu / division). Posée
  seulement quand il y en a ; [10] et [11] gardent leur place. Leboncoin/eBay/Vestiaire : `ventesAutresBenefice` reçoit
  `drapeaux` de l'appelant.
- **Statistiques › Gains** : vue « Par mois » (12 derniers mois, les deux plus récents toujours, les autres s'ils ont des
  ventes) ; « Par compte » commence par « Le compte qui vend le mieux » (total, nombre, couverture) ; la tuile « Gagné »
  dit « au plus » quand des frais ne sont pas confirmés. Au téléphone, les cinq vues tiennent (« Article · Modèle ·
  Source · Compte · Mois », le nom lu reste « Par … »).
- **La fiche de la vente** : « port de l'achat compris (reçu) » sous le prix d'achat quand il vient du reçu Vinted
  (le reçu = article + port + protection). Saisi à la main : rien n'est affirmé ; « Pourquoi ? » dit de compter le port
  dans le prix d'achat. (Aussi sur l'ancienne fiche de Ventes, `data-vb-port-achat`.)
- tr() en 5 langues (`gr.vue.mois`, `vb.*`, src/i18n/langues/*/gains.js) ; Quoi de neuf `vrai-benefice`.

## Preuves
- Banc **`scripts/bancs/vrai-benefice.cjs`** (CI part 3, bloquant ; données inventées ; design natif ; 1512/390 × clair/
  sombre) : **80 verts**. V1 « Par mois » = « Pour mon comptable » (Argent › Déclarer) pour le mois bouclé ET le mois
  d'avant (bénéfice, ventes, couverture) ; V2 16,50 + au plus 38,00 = 54,50 sur 2/4 ; V3 sans prix d'achat jamais 0
  (mois « — », compte « — ») ; V4 pas versée « à dater » ; V5 atelier_sneak d'abord, compte exclu nulle part ;
  V6 la fiche : port compris (reçu) pour 91001, rien pour 91002, mêmes bénéfices que « Par mois ».
  - Rouge sur `origin/main` (arbre `git archive`, banc copié, 1512 sombre + 390 clair) : **30 rouges**.
  - Mutations (build muté) : mois de la VENTE au lieu du versement ⇒ 6 rouges (l'écran ≠ l'export) ; achat inconnu = 0
    ⇒ 6 rouges (« — » devient +25 €, paris_kicks passe devant).
- Audit **`scripts/audit-vrai-benefice.cjs`** (21 verts ; `--prouve` 5/5 : zéro, vente, plafond, boost, tri).
- Audits compta/argent/URSSAF/bénéfice/bilan/DAC7/export/registres/pas-su/gains/rentabilité, traduction, quoi-de-neuf,
  cohérence, icônes, boutons, style-vintex, textes-courts : verts (61 audits). `audit-achats-export` copie
  vraiBenefice.js (--prouve 8/8). `ci-controles --diff origin/main` : deux contrôles AJOUTÉS (audit + banc), rien retiré.
- Captures regardées : 390 et 1512, clair et sombre (Par mois, Par compte, la fiche).

## Décisions pour Julien
1. Le port payé à l'achat n'a pas de champ à lui : il est DANS le prix d'achat (le reçu Vinted le contient ; saisi à la
   main, à toi de l'y compter). Un champ séparé « port de l'achat » ? (risque : compté deux fois avec un reçu.)
2. « Au plus » : tant que « Tous les frais sont renseignés » n'est pas coché, un boost peut manquer — le bénéfice est un
   plafond. Cocher la case sur les ventes sans boost le rend exact.
3. Le mois du bénéfice suit le VERSEMENT (comme ton export comptable) ; « Ton bénéfice » de Comptabilité, lui, suit la
   date de la vente (et retire dépenses et URSSAF). Deux notions, deux noms — à garder ainsi ?

## Geste de Julien
Aucun.
