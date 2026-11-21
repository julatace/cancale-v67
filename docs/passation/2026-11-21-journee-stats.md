# 21 nov. 2026 — Ma journée courte et Statistiques · Pilotage et Finances (lot `journee-stats`)

Branche `claude/journee-stats`. Pas de PR ni de fusion (l'intégrateur le fait). Session reprise après une interruption :
les quatre premiers commits sont de la session interrompue, la reprise a fini, vérifié et écrit ce récit.

## Ce que Julien a demandé

- « Bénéfice dans Ma journée — brut et net du mois, et d'aujourd'hui, les mêmes chiffres que Comptabilité », affiché
  d'office, sans activation dans Paramètres ; pareil pour les autres cartes qui demandaient une activation.
- « Beaucoup plus de statistiques, de la vraie data », inspiré de l'Accueil de Bleam (À traiter, dernière action auto,
  période 7/30/90 j, temps gagné, série d'activité, actions automatisées, activité quotidienne, état des comptes
  « N/M automatisations », statistiques des favoris : envoyés, taux de réponse, ventes) — avec SES données, rien d'inventé.
- Rangement : Aujourd'hui court et clair au téléphone (à faire en haut, quelques chiffres) ; le détail dans Statistiques.
- Défauts vus sur ses captures (28b8a6e6, 19477294, fd1ed34b) : « Bénéfice brut — pas calculé », « Vendue en — dates
  pas lues », barres des 30 jours sans repères, « Mis à jour il y a 2 h » avec la roue, titre en double, trop de cartes.

## Ce qui est fait

### Ma journée (src/natif/ecrans/Aujourdhui.jsx, src/aujourdhui/modele.js, Branche.jsx)
Par défaut TROIS cartes (`CARTES_DEFAUT = colis, chiffres, ventes`) :
1. **Colis** : deux rangées toujours à leur place (« — » en lecture) — à envoyer (le nombre, l'échéance qui presse) et
   à retirer (le premier point et son code) ; « Imprimer N bordereaux » est LE bouton plein de l'en-tête.
2. **Tes chiffres**, segment Jour · Mois : CA vendu, ventes, **bénéfice brut** et **bénéfice net**. Brut = `brut` du
   propriétaire (`valeurChiffre`), avec sa couverture « au moins · 20/27 ventes » ; net = `benefice` du propriétaire
   (la carte de Comptabilité, `useBeneficeCalcul` / `beneficePeriode`). Pour **aujourd'hui** le net est la même règle
   sans les dépenses (elles se notent au mois, jamais partagées entre les jours : `chargesAuMois`, dit sous le chiffre).
   Un bénéfice pas su n'est plus « — pas calculé » : c'est la porte — « Compléter » (des prix d'achat manquent : la
   saisie en série) ou « Ouvrir Ventes » (pas encore calculé). L'objectif du mois est sous le segment Mois.
3. **Dernières ventes** (5 rangées), puis « Toutes les statistiques » → Statistiques.
Ma journée n'attend plus neuf lectures derrière une copie datée (`journee: ['comptes', 'nuage']`) : plus de « Mis à jour
il y a 2 h » avec la roue ; chaque carte réserve SA place (banc J3 : rien ne saute).
Dates courtes : « hier », « il y a 3 j » au lieu de « il y a 31 h » (`ilYaCourt`, jours du calendrier).

### Statistiques (src/natif/ecrans/StatsPilotage.jsx, src/aujourdhui/pilotage.js, StatsBranche.jsx, App `StatsPilotageApp`)
En tête de l'écran Statistiques, deux segments **Pilotage · Finances** et une période **7 j · 30 j · 90 j** (gardés sur
l'appareil : `vrm_stats_seg`, `vrm_stats_fenetre`).
- **Pilotage** : le dernier geste de VRM (« hier · automatique ») · Ce que VRM fait pour toi (temps gagné ESTIMÉ « sur N
  gestes », série d'activité, gestes acceptés dont automatiques, **automatisations actives N sur 3**) · Messages aux
  favoris (envoyés dont avec offre, **vendues ensuite** reliées PAR IDENTITÉ — l'identifiant d'annonce du message = celui
  de la transaction, 14 jours — et le taux) · Activité quotidienne (ventes, CA, gestes : une barre par jour, chaque série
  son échelle « max N », premier jour et aujourd'hui) · Par compte et par site.
- **Finances** : ventes (CA, ventes, panier, bénéfice brut et sa couverture, marge, délai de vente médian) · stock (en
  ligne, taux de vente, paires qui dorment) · par site · marques · modèles · tailles. Une liste vide une fois lue ne se
  montre pas (« Vendue en — dates pas lues » disparaît : le délai n'est montré que lu).
Règle unique : chaque nombre est DEMANDÉ à son propriétaire (`valeurChiffre`, `statsVentes`, `modele.js`) ; les seules
règles neuves (fenêtres, gestes, temps gagné, série, favoris → ventes, dernier geste) vivent dans `pilotage.js`, pur.
« N sur 3 automatisations » = `automatisationsActives` de src/automatisationsEtat.js (la rangée de Paramètres), M =
`AUTOMATISATIONS_COMPTEES` (les 3 types que cette règle compte) ; toucher ouvre le panneau de l'extension.

## (a) Les cartes qui demandaient une activation — décision par carte

| carte | avant | maintenant | raison |
|---|---|---|---|
| Bénéfice (brut, net) | `vrm_journee_benefice` (absent = montré depuis le 31 oct., masquable) | dans « Tes chiffres », TOUJOURS, jour et mois ; la clé n'est plus lue par l'écran natif | sa demande |
| Objectif du mois | « Fixer un objectif » | inchangé : un lien sous le segment Mois | vraie raison : sans cible, aucun chiffre |
| Stock, vitesse, marge, marques, dorment, comptes, courbe | cartes de « Personnaliser » | restent au choix dans Personnaliser ; leurs chiffres sont D'OFFICE dans Statistiques | « Aujourd'hui court » |
| Prévision, à venir, annonces (capté), vues, VRM du jour | cartes de « Personnaliser » | idem ; le dernier geste et l'activité de VRM sont d'office dans Statistiques · Pilotage | idem |
| Envoyer / Retirer détaillés | cartes de « Personnaliser » | remplacées par défaut par « Colis » (les deux rangées) | rien en double |

Aucune carte de l'écran natif ne demande plus d'activation dans Paramètres.

## (b) Bleam → VRM : ce qui est affiché, ce qui est « à capter »

| Bleam | VRM | source |
|---|---|---|
| À traiter | Colis (à envoyer, à retirer) en haut de Ma journée | `vrm_colis_aposter`, retraits |
| Dernière action auto | « Le dernier geste de VRM » | journal `journal_vrm_*` (gestes ACCEPTÉS) |
| Période 7/30/90 j | segment de Statistiques | `fenetre` |
| Temps gagné | estimation par type (src/accueil/tempsGagne.js), « sur N gestes » | journal |
| Série d'activité | jours d'affilée jusqu'à aujourd'hui (ou hier) | journal |
| Actions automatisées | « dont N automatiques » (`auto === true` noté par l'extension) | journal |
| Activité quotidienne | barres ventes · CA · gestes | `valeurChiffre`, journal |
| État des comptes N/M automatisations | « Automatisations actives N sur 3 » (global ; la baisse par règle est par compte) | `automatisationsActives` |
| Favoris : envoyés, ventes | envoyés, dont avec offre, vendues ensuite (identité), taux | journal + transactions |
| Favoris : **taux de réponse** | **à capter** — le journal ne note pas la réponse de l'acheteur à un message de favori ; la lier exigerait l'identité de la conversation dans le journal (extension) | — |
| N/M automatisations **par compte** | **à capter** — offres auto et paliers sont des réglages globaux ; seul « baisse par règle » est par compte | — |

## Preuves

- `node scripts/audit-journee-stats.cjs` : 26 verts ; **15 mutations** (`MUTATION=liste`), chacune rouge :
  fenêtre sans aujourd'hui, gestes refusés comptés, temps deviné, série avec trou, favori sans identité, délai infini,
  « pas su » = 0, vendu recalculé, net à 0, net = brut, brut sans « au moins », panier partiel, heure ISO seule,
  automatisations devinées (`auto_devine`), calcul dans la vue.
- `scripts/bancs/journee-stats.cjs` (390 tactile et 1512, clair et sombre, bases lu / attente / vide) : 80 verts.
  Mutations `empile`, `saut`, `brut` : rouges. Sur le code d'avant (`git archive origin/main` + le banc et son
  outil copiés) : rouge (les écrans n'existent pas, puis avec pilotage.js recopié : `gestesVrmEntre`/`heureEvenement`
  absents du modèle).
- `audit-aujourdhui` 69 verts · `audit-benefice` 50 · `audit-traduction` 45 · `audit-quoi-de-neuf` vert ·
  `audit-urssaf` vert · `audit-coherence` vert · `audit-icones` vert · banc `journee-perso` vert · build vert.
- Banc `aujourdhui-natif` : rouge à la construction (`/brands/*.svg` non résolu) — **déjà rouge sur `main`**.
- Captures regardées (390 d'abord) : Ma journée lu / mois / attente ; Statistiques Pilotage 30 j et 90 j, Finances, vide.

## Ce qui reste (pas fait)

- **Statistiques garde, SOUS la nouvelle tête, toutes les anciennes cartes** (vitrine, prévision, vendu par semaine,
  comparer, frais, carte des ventes, prix voulu, volets repliés) : certains nombres y sont redits (CA, bénéfice). Les
  ranger dans UN volet « Plus de détails » fermé est simple (`RepliStats` ne monte rien fermé) mais une trentaine de
  bancs de l'écran Argent lisent ces cartes ouvertes : à faire dans un lot qui met ces bancs à jour.
- Les en-têtes de groupe natifs (« COLIS », « TES CHIFFRES », « CA VENDU ») sont en capitales par le composant partagé
  (`.n-carte-titre`, `.n-tuile`) : à changer dans `src/natif/` pour toute l'app, pas écran par écran.
- Taux de réponse des favoris et automatisations par compte : à capter (voir (b)).

Geste de Julien : aucun.
