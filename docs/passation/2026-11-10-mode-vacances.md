# 10 nov. — Mode vacances sur tous les comptes (lot O) — extension 5.338.0

Branche `claude/mode-vacances` (depuis `origin/main`). Validé par Julien
(`2026-11-09-propositions.md`, proposition 16 : « mode vacances sur tous les comptes en un clic
(Vinted, et ce que Leboncoin/eBay/Vestiaire permettent), puis retour en un clic » — son clic,
compte par compte, dans les 50 actions/h).

## Mesuré d'abord (sa base, lecture seule)

- **L'état** est connu : le profil `GET /api/v2/users/current`, que l'extension range déjà
  (`harvest_{uid}_profile`), porte `user.is_on_holiday` — un booléen, `false` sur tous ses comptes
  le 10 nov. (aucune autre clé « holiday/vacation » dans ses profils ; présente aussi dans les
  conversations, sans intérêt ici).
- **Le geste ne l'est pas** : aucune écriture « holiday » ni « vacation » dans ses requêtes rangées
  (`harvest_*_wreq_*`, toutes les écritures que l'extension voit passer), rien dans l'historique.
  ⇒ Aucun chemin n'est deviné : VRM **apprend la recette sur SON geste** sur vinted.fr (comme
  `vc_envoi.appris` / `lbc_envoi.appris`).

## Ce que Julien voit

Paramètres → Mes comptes → **Mode vacances** (une seule entrée, `data-reglage-vacances`) :
- « Un compte à la fois : celui ouvert sur vinted.fr. », **Tout mettre en vacances** (principal),
  **Tout rouvrir** (second), la jauge des actions de l'heure (lot G) du compte de l'onglet ;
- une rangée par compte Vinted : **En vacances · Ouvert · —** (pas su), « Ouvert dans Chrome »,
  l'âge de la lecture ; après un clic, chaque rangée dit son geste : « Ouvre vinted.fr sur ce
  compte » (ambre), « Fais-le une fois à la main sur vinted.fr » (ambre), « Fait, relu »,
  « Pas relu », « Refusé » + la raison ;
- « Autres sites » : Leboncoin, eBay, Vestiaire — « À faire sur le site ↗ » (page d'accueil du
  site, rien d'inventé).

Un clic = au plus UN compte part : celui ouvert dans l'onglet vinted.fr, après « Mettre
<compte> en vacances ? ». Il bascule de compte sur vinted.fr, puis reclique : c'est « compte par
compte ». Tant que le sens n'est pas appris : « Mets ce compte en vacances une fois à la main sur
vinted.fr : VRM apprend. » (chaque sens s'apprend : mettre en vacances ≠ rouvrir).

## Les règles

- **App, pure** — `src/modeVacances.js` : `etatVacances` (profil capté vs état relu après un
  geste, `vinted_vacances_etat` : le plus FRAIS gagne ; absent ⇒ `null`), `lignesVacances`,
  `recetteSait` (null pas lu · false jamais vu · true), `actionVacances` / `planVacances`
  (fait · envoyer · apprendre · ouvrir · passu ; un seul `envoyer`, le compte de l'onglet ; compte
  de l'onglet pas su ⇒ rien), `issueVacances` (« fait » seulement avec un état RELU égal au voulu ;
  pas de réponse ⇒ « Pas relu », aucun état affiché). Lectures projetées (`SELECT_*`), jamais
  `select=data`.
- **Extension 5.338.0** —
  - `inject.js` `noteVacances` : une écriture PUT/POST/PATCH **2xx** de vinted.fr `/api/…` dont le
    corps (≤ 4 Ko) parle de « holiday/vacation » ⇒ `{kind:'vacances', methode, chemin, corps}`.
    Zéro requête de plus.
  - `apprendreVacances` (background) : jugé sur l'onglet (cadre principal, hôte Vinted), compte =
    celui connecté ; `recetteVacances` : chemin `/api/vN/users/{current|son n° de profil}[/…]`
    seulement (le n° devient `{moi}`, un autre n° ⇒ refus), UN booléen vacances, aucune date,
    aucun long texte, aucune liste. Rangé dans `vinted_vacances_recette` (`recettes.on/off`,
    `dernier` avec la raison quand ce n'est pas rejouable) ; son geste accepté est rangé comme
    état (`via: 'geste'`).
  - `mettreVacancesVinted` (commande `vacancesVinted`, origine vrm.center, confirmée) : recette du
    sens voulu (sinon `pas-appris`) · `gardeStricte(uid, acc, { reserve: RESERVE_GESTES })` (compte
    de l'onglet, 45/h sur 50, UNE action) · `avecVinted` (une à la fois, compte relu) ·
    `GET users/current` (état LU ; déjà dans l'état ⇒ `deja`, place rendue) · le geste appris, seul
    le booléen changé, `{moi}` = `user.id` LU dans l'onglet · `GET` de relecture ⇒ `fait` /
    `ecart` / `incertain` ; l'état relu est rangé (`vinted_vacances_etat`). Tout arrêt avant
    l'envoi rend sa place ; 429/403 ⇒ pause (`requeteVinted`).
- **Versions** : `CODE_VERSION`, manifeste, `lbc-inject.js`, `lbc-relay.js`, `EXT_ATTENDUE` =
  5.338.0, `EXT_CAPACITES.vacances = '5.338.0'`, `audit-coherence` (`vacances:
  'mettreVacancesVinted'`), zips refaits (`node scripts/zip-extension.cjs`). 5.338.0 n'a jamais
  été publiée (`git log --remotes -S` sur le manifeste : aucune branche).

## Preuves

- `node scripts/audit-mode-vacances.cjs` : **47 contrôles** sur le VRAI background.js dans un vm
  (`_fond-vm.cjs`), la vraie fonction de `inject.js` et la règle de l'app. `--prouve` :
  **18/18 mutations** rouges (autre compte, dépasse le plafond, état supposé sans relecture, sans
  lecture avant, place gardée, rafale, sens déduit, sans confirmation, chemin libre, n° inconnu,
  date acceptée, apprend sur un refus ; règle : le plus vieux gagne, pas su = ouvert, autre compte
  part, onglet pas su = oui, pas appris part, « fait » sans relu) ; sur le background.js
  d'`origin/main` : 29 rouges.
- Banc `scripts/bancs/mode-vacances.cjs` (données inventées, faux pont qui RETIENT la commande) :
  **78 verts** (390 tactile et 1512, clair et sombre ; D pas relu, E extension 5.337, F onglet sur
  un autre compte). Captures regardées ; défaut vu et corrigé : l'ambre du geste était repeint en
  gris par `styles-design-2026.css` (`!important`) — le contrôle B6 exige maintenant une couleur
  chaude.
- `npm run build` ; audits `variables`, `tdz`, `coherence`, `identite`, `icones`,
  `extension-zip`, `chemin-json-guillemets`, `baisse-prix`, `jauge-journal`, `etat-compte` et les
  129 audits qui lisent l'extension : verts, sauf trois déjà rouges sur `origin/main`
  (`lbc-plus-vue-pause` « DEMANDE_APPAREIL déclaré deux fois », `prix-mini` S3, `preuve-vente`
  « 5.170.0 manque à la liste », historique git de la copie).

## Limites dites

- Tant que Julien n'a pas posé (puis retiré) le mode vacances UNE fois à la main sur vinted.fr
  avec l'extension 5.338, VRM ne sait pas le faire : l'écran le dit. Si Vinted envoie un corps
  avec une date ou plusieurs réglages, rien n'est rejouable — `vinted_vacances_recette.dernier.raison`
  le garde pour la session suivante.
- Leboncoin, eBay, Vestiaire : aucun geste connu ni prouvé ⇒ un lien « À faire sur le site ».
- Le journal « ce que VRM a fait » (lot G) n'inscrit pas encore ce geste (sortes fermées côté G).

## Geste de Julien

Installer l'extension **5.338.0** (remplacer le dossier, puis ⟳ dans chaque Chrome). Puis, une
fois : sur vinted.fr, mettre un compte en vacances à la main, et le rouvrir à la main — VRM
apprend les deux sens.
