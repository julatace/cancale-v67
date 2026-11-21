# Forme des réponses Vinted et mode prudence — 5.357.0 (11 nov. 2026, second agent)

Branche `claude/agent2-vinted-forme`, partie de **`origin/claude/agent2-robustesse-extension`**
(extension 5.356.0, pas encore sur `main`) puis `git merge origin/main` : **elle CONTIENT la
5.356**. Ni PR ni fusion : l'agent principal intègre. Version **5.357.0** (réservée dans
`COORDINATION-AGENTS.md`).

Preuve : `node scripts/audit-vinted-forme.cjs [--prouve]` — EXÉCUTE le vrai `background.js`
(`scripts/_fond-vm.cjs`) et les vraies règles de l'app (`src/formeVinted.js`,
`src/jaugeActions.js`). **26 contrôles verts ; 21 rouges sur la branche de départ**
(`--ext <copie de origin/claude/agent2-robustesse-extension>/vinted-sync-extension` ; les 5
verts restants sont les contrôles « rien ne doit changer » : champ facultatif absent, article
isolé, transaction bonne, plafond normal 50, levée) ; **17 mutations**, chacune rend son rouge.

## 1. Alerte si Vinted change sa façon de répondre (`formevinted`)

| quoi | règle |
|---|---|
| où | les DEUX voies d'écriture : `storeHarvest` (passive) et `storeHarvestRow` (active), juste après « un refus de Vinted n'est pas une capture » |
| quoi est jugé | `REGLES_FORME_VINTED` : dressing (`items` : `id`, `price` = `{amount}` obligatoires ; `title`, `is_hidden` booléen facultatifs) · ventes / achats (`my_orders` : `transaction_id` obligatoire ; `title`, `price` `{amount}`, `transaction_user_status`, `item_id` facultatifs) · boîte (`conversations[].id`) · transaction (`status` obligatoire ; `status_title` texte, `item_id`) · conversation (`messages`) · profil (`user.id` ; `is_account_banned` booléen, `login`) · porte-monnaie (`main` et `escrow` `{amount}`, jugé seulement sur SA forme) |
| douteux | type changé sur un champ (AUCUN article ne porte la forme connue) · champ OBLIGATOIRE absent de toute la liste · clé de liste renommée (une autre clé porte une liste non vide) |
| jamais | un champ facultatif simplement absent ; un article isolé d'une autre forme parmi des bons ; une liste vide ; un objet maigre (< 3 clés) |
| douteux ⇒ | RIEN n'est écrit (la bonne lecture d'avant reste ; voie active : `forme-inconnue`, non compté comme échec de la base) ; `harvest_{uid}_forme_inconnue` = `{ formes: { [type]: { page, champ, attendu, vu, forme[] (chemin:type), vuLe, depuis, n } } }` — aucune valeur (n° d'identifiant dans un nom de clé ⇒ `#`) ; au plus une écriture par page / 30 min (`vrmFormesVues`, `chrome.storage.local`) ; lecture de la ligne ratée ⇒ rien écrit |
| forme revenue ⇒ | l'alerte de cette page s'efface (seulement si CE Chrome l'avait signalée : zéro lecture sinon) |
| app | `src/formeVinted.js` (règle pure : une ligne par PAGE, deux comptes = une ligne ; vue il y a > 3 jours ⇒ plus dite ; lecture ratée ⇒ `null`, rien affirmé) · `src/AlerteFormeVinted.jsx` : « Vinted a changé sa page des ventes : VRM ne la lit plus, on corrige », en ambre, dans **Tout va bien ?** (tant que c'est vrai ; résumé « Vinted a changé une page » / « Rien à faire de ton côté : VRM corrige sa lecture ») et **Ma journée** (une fois : « Compris » la range pour CE changement, `localStorage` du lecteur) |

Les sentinelles d'avant (`verifFormeListe`, `verifFormeObjet` : diagnostic seul) restent.

## 2. Mode prudence 24 h après un refus (`prudence`)

- Posé par `requeteVinted` (la file de TOUTES les requêtes Vinted) sur 429, 403, ou une réponse
  d'erreur qui parle de captcha / datadome / « trop de demandes » (`refusDeVinted` ; une page 200
  qui cite datadome n'en est pas une). Le compte : `qui` passé par chaque primitive (`acc`, ou le
  cookie du domaine). Un nouveau refus reprolonge de 24 h.
- `vrmPrudence` dans `chrome.storage.local` (survit au worker) ; échue ⇒ levée (rien à effacer).
- Pendant 24 h : plafond **20 actions/heure** (`PRUDENCE_ACTIONS_HEURE`) dans `compterActionUn`,
  pour tous les gestes ; **`ACTIONS_MAX_HEURE` reste 50** (contrôle P3 + mutation) ; refus dit
  (« Vinted a freiné ce compte : VRM ralentit (20 actions/heure) jusqu'à 18:40 ») ; délais doublés
  (`pauseRepub`, `pauseFavori`, délai et espacement des offres auto) ; `gardeLecture` refuse toute
  lecture de fond sauf `colis` (codes de retrait) et `clic` (SON clic) ; la visite ne moissonne
  pas (offres auto sous le plafond abaissé, codes de retrait, ménage des PDF seulement).
  ⚠️ Exception assumée : la relecture des VENTES du début de visite (une requête, gardée 5 min,
  `rafraichirVentesGarde`) reste — c'est l'anti double vente ; à retirer si Julien préfère.
- Publiée dans la ligne de la jauge (`actions_compte_{uid}_{nav}` : `prudence` = heure de fin,
  `maxPrudence` = 20) tout de suite (`publierJaugeMaintenant`) ; les autres Chrome du compte la lisent
  (`actionsAutresNavigateurs`) et l'appliquent ; l'app (`jaugeDuCompte`) affiche
  « 9/20 cette heure · Prudence jusqu'à 18 h 40 » en ambre, puis repart sur 50 à l'échéance.

## 3. De la revue (`docs/passation/robustesse/extension.md`, branche `claude/agent2-robustesse`)

| haute | correction |
|---|---|
| 14 `visiteVinted` sans verrou | verrou de module : une visite à la fois ; une page chargée pendant ⇒ UNE visite de plus après (3 au plus d'affilée) |
| 18 `vinted_item_details` sans borne | la page d'annonce lue en passant n'est rangée que si l'annonce est À LUI (dressing du compte de l'onglet ou fiches VRM, par identifiant ; pas su ⇒ rien) ; 4 000 fiches au plus (aucune nouvelle au-delà, rien retiré). ⚠️ Reste : la ligne est encore relue en `select=data` à plusieurs endroits (refonte en une ligne par annonce non faite) |
| 22 `JSON.parse(job.corpsCV)` hors `try` | dans un `try` ; illisible ⇒ action rendue, verrou levé, « brouillon à refaire », rien envoyé |

## Vérifié

`audit-vinted-forme` (ci-dessus) ; les 139 audits qui lisent l'extension ; `coherence`
(`formevinted` → `formeDouteuse`, `prudence` → `poserPrudence`), `variables`, `tdz`, `identite`,
`icones`, `extension-zip`, `regles-achat-extension` ; `npm run build` ; banc `jauge-journal`
(cas « prudence » ajouté, 390 tactile et 1512, clair et sombre — captures regardées).

## Ce qui reste

Revue extension : hautes 21, 23-26, puis les « moyenne ». `vinted_item_details` : une ligne par
annonce. La forme des réponses Leboncoin / Vestiaire n'est pas jugée ici (Vinted seulement).

## Geste de Julien

Aucun tant que l'agent principal n'a pas intégré. Après mise en ligne : installer 5.357.0
(remplacer le dossier, ⟳ dans chaque Chrome).
