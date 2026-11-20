# 20 nov. (soir) — « On fait absolument tout comme Bleam » (extension 5.410.3)

Décision de Julien du 20 nov. au soir, relayée par la session de coordination, après avoir
observé l'outil concurrent Bleam sur son compte (export VRM Observateur). Elle remplace, pour
la **republication** et les **messages aux favoris**, la ligne §3 « Piloter souris / clavier :
refusé ». Il a été prévenu une fois du risque : un clic fabriqué (`isTrusted: false`) est
visible par Vinted. Rien n'est fait pour que ces clics aient l'air humains (pas de `isTrusted`
maquillé, pas de débogueur/CDP, pas de mouvement de souris inventé).

Branche `claude/comme-bleam` (partie d'`origin/main`), pas de PR. Les zips ne sont PAS
régénérés (à faire au moment de servir la 5.410.3).

## Ce que l'observateur a mesuré (formes et délais seulement)

- Republication ≈ 3 min par paire, dans un onglet vinted.fr ouvert par l'outil : page
  « Modifier » de l'ancienne (lecture) → `a[data-testid=header-upload-item-button]` → 16 photos
  dans `input[data-testid=add-photos-input]` (16 `POST /api/v2/photos` simultanés, envoyés par la
  page) → catégorie (`#category`, `#catalog-search-input`, option) → `#title` → `#description` →
  taille (`#size`, option `size-group-N-grid-option-{id}`) → couleurs (`#color`,
  `filter-grid-option-{id}`) → colis (`#package_type_selector_{id}`) → état (`#condition`,
  `condition-{id}`) → prix (`#price`), 5 à 15 s entre deux champs → brouillon
  (`POST item_upload/drafts`, envoyé par la page) → page de l'ancienne,
  `button[data-testid=item-delete-button]` + confirmation (`POST items/{id}/delete` ~22 s après)
  → édition du brouillon, `button[data-testid=upload-form-save-button]` « Ajouter »
  (`POST drafts/{id}/completion`) ~27 s après la suppression.
- Favoris : `POST /api/v2/conversations` avec `initiator: "seller_enters_notification"`, réponse
  « lot » ~6 s après, `POST transactions/{id}/offers` ~11 s après dans la même conversation ;
  `PUT …/mark_as_read` avant de répondre.

## Ce qui est livré

### A. Republication par le formulaire (`repubformulaire`, méthode par défaut)
- `vinted-sync-extension/vrm-formulaire.js` : script de page (monde MAIN), une étape à la fois
  (`__vrmFormulaire(etape, d)`) : `ouvrirVente`, `photos` (fichiers du coffre via
  `DataTransfer`), `champ` (titre, description, catégorie, marque, taille, couleurs, colis, état,
  prix — saisie caractère par caractère par le setter natif + `input`/`change`, sans minuterie),
  `brouillon`, `supprimer` (+ confirmation, jamais « Annuler »), `publier`, `reponse`. Chaque
  geste rend la RÉPONSE de Vinted à la requête de la page (aussi rangée en `sessionStorage`, la
  page navigue juste après). Captcha / DataDome vu ⇒ `captcha` ; élément introuvable ⇒
  `selecteur` + son nom.
- `background.js` : `recreerParFormulaire` appelé par `recreerVinted` DANS sa place de la file,
  après toutes ses gardes (coffre, recette, taille, refus déjà vu, quota du jour, paire réservée
  d'un coup). L'onglet qui travaille : un onglet vinted.fr du même Chrome, en arrière-plan
  (`vrmOngletTravail`), nommé dans le panneau (« Voir l'onglet »). Pauses 5–15 s entre champs,
  jamais deux fois la même ; 15–40 s entre la suppression et « Ajouter ». Le brouillon envoyé par
  la page est RELU : un champ différent de la fiche ⇒ arrêt avant la suppression. Entre chaque
  champ : « Tout arrêter », vérification anti-robot, pause de Vinted, compte de l'onglet, frein.
  Les réponses de la page passent par les mêmes constats que `requeteVinted` (sécurité, pause
  403/429, prudence, arrêt au captcha). Étapes datées (`vbAvecEtapes`), `methode: 'formulaire'`
  dans le coffre ; « Reprendre » (`reprendreParFormulaire`) relit l'ancienne, la supprime par sa
  page si un brouillon est prêt, puis « Ajouter » — jamais deux en ligne.
- Écran plein (`avecActionPlein`, 5.406) pendant tout le travail ; en mode formulaire
  (`formulaire: true` dans l'état d'action) il n'y a plus « Réduire » : « Tout arrêter » seul.
- L'ancienne méthode (« Directe ») reste choisissable : Paramètres du panneau → Méthode de
  republication (`vrmCommeBleam.methode`).

### B. Favoris « comme Bleam » (`favorisbleam`, séquence par défaut)
- Ouverture avec `initiator: "seller_enters_notification"`, `PUT mark_as_read`, message (version
  « lot » quand la personne a aimé ≥ 2 articles de ce compte — `aimes` ajouté au travail par
  `api/_lib/favoris-file.js` — une fois par personne, `vrmLotEnvoye`), puis l'offre au prix de SA
  règle 8–15 s après (réglable), jamais sous le plancher (prix mini, sinon achat + 10 %,
  `plancherBaisse`) ; pas de plancher connu ⇒ pas d'offre. Un message qui annonce le prix de
  l'offre (`{prix}`) garde l'ordre d'avant (offre puis message). Rythme entre personnes inchangé.

### C. Panneau
- Paramètres : « Méthode de republication » (formulaire / directe), l'onglet qui travaille,
  « Messages aux favoris » (séquence, message « lot », délai de l'offre). Textes en 5 langues
  (`vrm-ui.js` `cb_*`, `a_bloque_form`). Page publique `/confiance` dite juste.

## Preuves
- `scripts/audit-comme-bleam.cjs` (vrai `background.js`, `_fond-vm.cjs`) : 33 verts ; `--prouve` :
  rouge sur `origin/main` et par 9 mutations.
- `scripts/bancs/repub-formulaire.cjs` (Playwright, FAUSSE page vinted.fr aux data-testid
  relevés) : ordre exact des requêtes de la page, saisie lettre par lettre, brouillon conforme,
  captcha, élément absent, jamais « Annuler », vrai clic / vraies touches retenus par l'écran plein,
  clics de VRM `isTrusted: false` ; `--prouve` par mutations (dont vrm-action.js).
- `scripts/_fond-vm.cjs` : les audits d'avant jugent la méthode directe (`vrmCommeBleam` posé à
  `directe` sauf `__commeBleamDefaut`).

## À faire par une session qui a le droit de toucher CLAUDE.md (non fait ici)
- §3 « Piloter souris / clavier » et « Republication » : la décision datée ci-dessus.
- §8 : `repubformulaire` `favorisbleam` | `recreerParFormulaire` · `sequenceFavoriBleam` | 5.410.3.
- §9 : une ligne (20 nov. soir · tout comme Bleam · ce fichier · geste : installer 5.410.3).
- Régénérer les zips au moment de servir la 5.410.3.

## Non vérifié
- Les sélecteurs de la marque (`#brand`, `#brand-search-input`), du bouton « Sauvegarder le
  brouillon » (`upload-form-save-draft-button`) et de la confirmation de suppression n'ont pas
  été vus dans l'export (aucun geste noté) : déduits ; un élément absent arrête proprement AVANT
  le brouillon (ou avant la suppression) et le dit. Premier vrai essai à regarder.
