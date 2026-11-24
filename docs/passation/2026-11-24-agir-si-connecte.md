# 24 nov. · Agir seulement si l'extension est connectée (branche `claude/agir-si-connecte`)

**Règle de Julien (24 nov., mot pour mot)** : « Je vais devoir répondre à mes messages, republier dans l'application, faire
absolument tout si l'extension est connectée. Si l'extension n'est pas connectée sur un compte, on peut voir les données mais
on ne peut pas agir dessus. »

Elle remplace, pour l'app, le « toute action se fait dans le panneau de l'extension » du 20 nov.
(`2026-11-20-actions-extension.md`) : l'app agit de nouveau, mais seulement **par l'extension** et seulement sur un compte
que l'extension a **ouvert dans un onglet**. Les garde-fous du §3 restent tous dans l'extension (compte de l'onglet, 50/h
réserve 5, une requête à la fois, pause 429/403, ordre coffre → brouillon → suppression → en ligne, suppression sur son clic
confirmé).

Base : `origin/main` + `origin/claude/style-clair` (#1326) + `origin/claude/connexions-extension` (pour
`etatConnexionCompte` / `requeteConnexions`, demandé par le coordinateur). La PR passe **après #1326 et après la PR
connexions-extension**.

## 1. La porte — `src/agir/peutAgir.js` (pure)

`peutAgir(faits, { site, compte, geste, par })` → `{ ok: true, voie: 'ici' | 'distance' | 'api' }` ou
`{ ok: false, raison, cle, vars, geste }` (lecture seule : la raison en code, sa phrase `agir.raison.*` qui contient déjà le
geste — « Connecte l'extension sur shop_x : ouvre Vinted dans Chrome »).

« ok » seulement si TOUT est vrai :
1. le compte est une **identité** (uid Vinted, id Leboncoin, id Vestiaire) — un nom n'est jamais un compte (§5) ;
2. une extension **connectée à CE compte VRM** a **CE compte vendeur dans un onglet**, récemment :
   - voie `ici` — l'extension de CE navigateur (pont vivant, `etatNavigateur` = ok/maj, même règle que la page Extension) :
     Vinted par le cookie lu à l'instant (`ext.etat.vinted.uid`), Leboncoin et Vestiaire par la présence de CE navigateur ;
   - voie `distance` — un autre navigateur du vendeur (son ordinateur, « À distance », 22 nov.) **allumé** (< 3 min) avec ce
     compte dans son onglet, et le geste a son équivalent dans la file `cmd_dist_*` ;
3. sa version ≥ la capacité du geste (`EXT_CAPACITES`, jamais une version écrite dans la porte) ; à distance ≥ `adistance` ;
4. ni `depassee` ni `arret` captcha / pause / session de moins de 30 min (champs 5.448, lus seulement présents), pas de
   « Tout arrêter ».

« Pas su » (rien posé, lecture en cours, lecture ratée, version illisible) ⇒ **lecture seule**, jamais « ok ».
eBay : l'API officielle, gardée par SON jeton (`api`), jamais par l'extension.

`par` : `'panneau'` (le geste s'ouvre dans le panneau de l'extension de CE navigateur ⇒ seule la voie `ici`) · `'file'`
(il part par la file `cmd_dist_*` ⇒ exige `adistance`) · `''` (le badge du compte). Le joker `'*'` (« le compte de
l'onglet ») n'est permis qu'au panneau : l'extension agit au nom de SON onglet et sa garde refuse une annonce d'un autre
compte. Jamais par la file.

### La preuve « ce compte est ouvert » pour Leboncoin et Vestiaire (le piège signalé par le coordinateur)
`etatConnexionCompte` rend toujours `null` / `compte-non-publie` pour Leboncoin et Vestiaire (les lignes `ext_appareil_*`
ne publient pas leurs comptes). La porte ne s'en sert donc PAS pour ces deux sites : elle lit les lignes **`presence_*`**
(À distance, 5.436) qui publient déjà, par navigateur, « le compte privé de chaque onglet ouvert » Leboncoin et Vestiaire
(`distComptesOuverts`, background.js). Aucune régression : un compte Leboncoin/Vestiaire ouvert dans un onglet d'une
extension ≥ 5.436 est « ok ». **Aucun lot d'extension 5.450 n'a été nécessaire.** (Avant 5.436 : lecture seule, dite
« mets à jour ».)

## 2. La source et l'envoi — `src/agir/porte.js`, `SourceAgir` (App.jsx)

- `SourceAgir` (monté une fois dans la coque, rien de dessiné) pose les faits : `faitsExtensionApp`, `presence_*` (45 s +
  chaque signe de l'extension, projection `SELECT_PRESENCE`), `ext_appareil_*` (2 min, `requeteConnexions`, projection),
  « Tout arrêter », comptes eBay reliés, noms des comptes. Une relecture ratée ne fait pas oublier la précédente.
- `usePeutAgir`, `useCompteAgir`, `agirMaintenant` (hors React).
- `envoyerGeste` : relit la porte au moment du geste (`par: 'file'`) ; non ⇒ **rien n'est déposé**. Oui ⇒ UNE commande
  `cmd_dist_*` (`nouvelleCommandeDistance` → `deposerCommandeDistance`, src/aDistance.js) : le chemin d'extension
  existant, exécuté par l'extension qui a CE compte dans son onglet, par le chemin du clic (`executerPourApp`,
  `repondreLeboncoin`, `repondreVestiaire`, `recreerVinted`…), avec tous ses garde-fous.
- `republierDansApp` : une confirmation (elle supprime l'ancienne annonce), puis une commande `republier` par annonce dont
  le compte passe la porte ; les autres sont dites.

## 3. Les boutons — `src/agir/Agir.jsx`

- `BoutonAgir` : NON ⇒ `Bouton indisponible` (visible, éteint, la phrase dessous, `aria-disabled`, le toucher n'appelle rien).
- `BadgeLectureSeule` : pastille grise « Lecture seule » (titre = la raison), aucun orange.
- `ComposerReponse` (Vinted, Leboncoin, Vestiaire), `GestesOffreVinted` (Accepter confirmé · Refuser · Proposer N € depuis
  SON prix mini), `BoutonRepublierAgir`.
- `BoutonExtension` / `RangeeExtension` / `FeuilleExtension` (tous les « … dans l'extension ») passent par la porte
  (`par: 'panneau'`, prop `compte`), et **`ouvrirPanneau` aussi** (défense en profondeur : refusé ⇒ rien ne s'ouvre,
  `vrm:agir-refus` ⇒ l'app dit la raison).

## 4. Inventaire — chaque geste, où, quelle capacité, existe-t-il ?

| plateforme | geste | où | capacité | avant (main) | maintenant |
|---|---|---|---|---|---|
| Vinted | répondre | Messages → fil | `messagerie` + `adistance` | bouton « Répondre dans l'extension » | **dans VRM** (`ComposerReponse`, file) |
| Vinted | accepter / refuser / contre-offre | Messages → fil, carte d'offre | `messagerie` + `adistance` | panneau | **dans VRM** (`GestesOffreVinted`, file, accepter confirmé) |
| Vinted | offres sans réponse (liste) | Messages → Offres | `messagerie` | panneau | panneau **gardé** (compte de la ligne) |
| Vinted | messages aux favoris | Messages → Favoris, paires qui dorment | `favoris` | panneau | panneau gardé — **trou** (pas dans la file) |
| Vinted | republier | Fiche, sélection, Actions, paires qui dorment | `republierpage` + `adistance` | panneau | **dans VRM** (file, confirmé) ; sinon panneau gardé |
| Vinted | republier (« À republier », priorité) | Annonces → À republier | `republierpage` | panneau | panneau gardé |
| Vinted | baisser / changer un prix | Actions, dormantes, Prix partout | `baisseprix` | panneau | panneau gardé — **trou** (la file sait `prix` baisse : pas encore branché) |
| Vinted | vacances | Paramètres | `vacances` | panneau | panneau gardé — **trou** (pas dans la file) |
| Vinted | créer un brouillon | Fiches « À publier » | `creervinted` | panneau | panneau gardé ('*') — **trou** |
| Vinted | bordereau | Ventes, Colis | `commande` | dans VRM (autorisé, §3) | inchangé : `BoutonBordereau` exige déjà le compte de l'onglet |
| Leboncoin | répondre | Messages → Leboncoin | `lbcrepondre` + `adistance` | panneau | **dans VRM** (`ComposerReponse`, file) |
| Leboncoin | baisser un prix | Prix partout | `lbcprix` | panneau | panneau gardé ('*') — **trou** (la file sait `prix`) |
| Leboncoin | pause | Leboncoin, Annonces | `lbcinterface` | panneau | panneau gardé ('*') — **trou** |
| Leboncoin | supprimer | Leboncoin, À retirer ailleurs | `lbcsupprime` | panneau (confirmé là-bas) | panneau gardé ('*') — **trou** (jamais par la file : irréversible) |
| Vestiaire | répondre | Messages → Vestiaire | `vcrepondre` + `adistance` | panneau | **dans VRM** (`ComposerReponse`, file ; compte = `vc_fil.compte`) |
| Vestiaire | offres | Vestiaire → offres | `vcoffrerepondre` | panneau | panneau gardé ('*') — **trou** |
| Vestiaire | prix | Prix partout | `vcprix` | panneau | panneau gardé ('*') — **trou** (la file sait `prix`) |
| Vestiaire | aimés | Vestiaire → aimés | `vcaimes` | panneau | panneau gardé ('*') — **trou** |
| eBay | répondre, offres, modifier, terminer, retirer, prix | écrans eBay | jeton | API serveur | inchangé (la porte sait `ebay` par le jeton ; écrans non rebranchés) |

Badge « Lecture seule » par compte : Messages (en-tête de chaque compte), Annonces (en-tête de chaque groupe),
Paramètres → Connexions de l'extension (chaque compte).

### Les trous (gestes encore faisables seulement sur le site / le panneau)
1. **Pas d'équivalent dans la file `cmd_dist_*`** — depuis l'iPhone ils restent en lecture seule ; à l'ordinateur ils passent
   par le panneau de CE navigateur : messages aux favoris (Vinted), vacances, créer un brouillon, Leboncoin pause et
   supprimer, Vestiaire offres et aimés, publier sur Leboncoin / Vestiaire. Pour les mettre dans VRM : ajouter ces gestes à
   `ADIST_GESTES` (bloc `<a-distance-regle>`, recopié dans background.js) avec leur exécution par le chemin du clic
   existant — un lot d'extension (5.450). Supprimer resterait confirmé et jamais automatique.
2. **La file sait, l'écran pas encore** : baisse de prix (Vinted, Leboncoin, Vestiaire — `prix`, baisse seulement, prix vu
   voyage), masquer / afficher (Vinted). Il reste à brancher les feuilles de prix sur `envoyerGeste`.
3. **Compte inconnu de l'écran** (joker `'*'`) : Prix partout, Vestiaire offres/aimés, Leboncoin pause/supprimer, créer un
   brouillon, automatisations — la porte vérifie « un compte de ce site ouvert ici », et la garde de l'extension refuse
   une annonce d'un autre compte. À passer `compte` quand l'écran le sait.
4. **eBay** : écrans gardés par leurs propres erreurs de jeton ; `peutAgir('ebay')` est prêt, pas branché.

## 5. Preuves
- `node scripts/audit-agir-si-connecte.cjs` — 42 verts : 50 comptes AUX MÊMES NOMS, A connecté, B… non : tout geste sur B
  (3 sites × 3 voies) en lecture seule ; `envoyerGeste` sur B ne dépose rien, sur A dépose UNE `cmd_dist_*` que
  `<a-distance-regle>` accepte ; Republier depuis VRM (une confirmation, A part, B dit) ; iPhone + ordinateur allumé ;
  ordinateur éteint, présences pas sues, version, `depassee`, captcha, « Tout arrêter », autre compte VRM ⇒ lecture seule ;
  `ouvrirPanneau` refuse B ; les écrans branchés ; 5 langues.
  `--prouve` : 11 mutations, toutes rouges. Sur `origin/main` : rouge (la porte n'existe pas).
- `scripts/bancs/agir-si-connecte.cjs` (vraie app, 390 tactile et 1512, clair et sombre) : Messages (badge sur B seul ; fil
  de B lisible, champ et offre éteints avec la raison, un toucher ne dépose rien ; fil de A allumé, un envoi dépose UNE
  commande au nom de A), Annonces (badge sur B), Ventes (les deux comptes visibles), Paramètres → Connexions (badge sur B).
  Captures regardées.
- `audit-actions-app` mis à la règle du 24 nov. (répondre = `ComposerReponse` ; le bouton passe par la porte) : 24 verts,
  12 mutations rouges. Voisins : traduction, quoi-de-neuf, connexions-extension, a-distance, tdz, coherence, identite verts.
