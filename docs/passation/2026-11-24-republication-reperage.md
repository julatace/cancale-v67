# 24 nov. 2026 — Republication « intelligente », phase 2 : le repérage commun (ext. 5.447.0)

Branche `claude/republication-intelligente` (plan de la phase 1 : `2026-11-23-republication-plan.md`), construite sur la
5.441 (PR #1327, `claude/favoris-541`) puis `git merge origin/main`. **À fusionner APRÈS #1327 … #1331.**

Demande (Julien, 23 nov.) : « l'extension doit pouvoir tout faire sur Vinted, rends-la intelligente ». Ce lot branche la
republication sur la couche de repérage des favoris (`vrm-trouver.js`, 5.440/5.441). **Rien d'autre ne change** : ordre
coffre → brouillon → suppression → mise en ligne, gardes, budgets (`REPUB_PAR_JOUR`, 45/h), onglet vinted.fr, champs
retirés, requêtes de page. Les clics restent ceux de la 5.414 (dans la page, `isTrusted:false`, assumés).

⚠️ **Refusé, pas fait** (permission de la session) : vrais clics par `chrome.debugger`, rythme ou gestes « humains »
destinés à tromper Vinted, pilotage de la vraie souris / du vrai clavier. Aucune permission ajoutée au manifeste.

## 1. Ce qui est branché
`vrm-trouver.js` (`__vrmTrouverV` 3) porte 20 nouveaux éléments, chacun avec plusieurs stratégies pondérées et un contexte :

| élément | stratégies | contexte / exclusions |
|---|---|---|
| `vendre` | data-testid `header-upload-item-button`, lien `/items/new`, nom exact (5 langues), indice `upload-item` ; +1 en-tête | jamais le pied de page, jamais une fenêtre |
| `titre`, `description`, `prix` | id relevé, `name`, data-testid, libellé exact (`label[for]` ou label autour) | **le formulaire de vente** (`formVente` : le `form` de l'entrée photos, sinon le `main`) ; jamais en-tête / recherche / pied / nav / fenêtre (le prix d'une offre) |
| `photos` | data-testid `add-photos-input`, indice photo/image, `accept=image` + `multiple` | compte même CACHÉE (`cache`), jamais une entrée de VRM |
| `categorie`, `marque`, `taille`, `couleur`, `etat` (ouvreurs) | id relevé, data-testid, libellé exact, `name` | formulaire de vente ; jamais un champ de recherche |
| `categorieRecherche`, `marqueRecherche` | id relevé, data-testid, recherche DANS une liste ouverte | jamais l'en-tête (recherche du site) |
| `colis` | `package_type_selector_{id}` (id ou data-testid), `ctx.id` | un seul |
| `brouillon`, `ajouter`, `enregistrer` | **irréversibles** : data-testid relevé EXACT (5) ou nom EXACT (5) ; un data-testid partiel n'est qu'un indice (1) | formulaire de vente ; `ajouter`/`enregistrer` jamais un bouton de brouillon |
| `supprimer` | **irréversible** : `item-delete-button` exact ou nom exact | page de CETTE annonce (l'étape vérifie l'adresse), hors fenêtre, hors en-tête |
| `supprimerConfirmation` | **irréversible** : nom EXACT seulement (« Confirmer et supprimer » ajouté), data-testid de confirmation = indice | **LA fenêtre ouverte** (un seul vrai dialogue, le plus intérieur) ; jamais Annuler / Ne pas supprimer / Fermer |
| `masquer`, `afficher` | nom exact, data-testid hide / show | hors fenêtre, un seul |

Règles nouvelles de la couche :
- `unique` (tous les irréversibles, colis, masquer/afficher) : un SECOND candidat au-dessus du seuil, même moins bien
  noté ⇒ `ambigu`, rien n'est cliqué.
- `irreversible` : la mémoire (stratégie qui a gagné, `vrmTrouve`) ne départage jamais ; elle continue de le faire pour
  « Vendre » et la cloche.
- `cache` : l'entrée des photos et l'option du colis comptent sans boîte visible (souvent cachées chez Vinted).

`vrm-formulaire.js` (`__vrmFormulaireV` 9) : `reperer(nomCouche, nomManque, avant, ms, ctx)` remplace les `attendreN(SEL…)`
de `ouvrirVente`, `formulairePret`, `photos`, `champ` (titre, description, prix, catégorie, marque, taille, couleurs, colis,
état), `brouillon`, `supprimer` (+ confirmation), `publier`, `prix` (enregistrer), `masquer`. Ordre : la couche ; rien
trouvé ⇒ l'élément appris de SON clic (choix 102, inchangé ; irréversible seulement s'il l'a confirmé) ; sinon arrêt nommé.
Sans la couche (paquet sans vrm-trouver.js) : la règle d'avant. Le gagnant et les essais remontent au fond (`o.trouves`) :
mémoire `vrmTrouve`, journal `vrmTrouverJournal`, compteurs `trouve_<élément>_<stratégie>` / `trouve_rien_*` /
`trouve_ambigu_*` dans `panel_diag_capture` — c'est là qu'on lira, au premier vrai passage, ce qui a manqué.

Options : toujours par l'identifiant de Vinted (`-{id}` final) d'abord, libellé EXACT seulement s'il est unique ; et
désormais **une seule** (deux ⇒ `…-option-ambigu`, rien cliqué) et cherchée **dans la liste de la recherche** (`listeDe`) —
avant, la marque était cherchée dans toute la page (un « -53 » d'une autre liste comptait) et l'option par identifiant
prenait le premier venu. Taille / couleur / état : un seul élément pour l'identifiant (`seul`).

## 2. Preuves
- `scripts/audit-repub-reperage.cjs` (Playwright, vrais vrm-trouver.js + vrm-formulaire.js, fausse page vinted.fr en trois
  formes : relevée / ids et data-testid changés / changée + pièges) : **28 verts**.
  R0 20 éléments connus, irréversibles nommés · R1 chaque élément trouvé seul et le bon (V1, V2, V3) · R2 la paire complète
  par les étapes (V1 et V3) : `PPBSM`, la fiche juste, aucun piège touché · R3 deux brouillons ⇒ rien ne part · R4 deux
  « Ajouter » / deux « Supprimer » ⇒ rien · R5 confirmation (bonne, deux, nom non exact, jamais Annuler) · R6 mémoire sans
  voix pour l'irréversible (mais pour « Vendre » oui) · R7 options par identifiant, jamais par ressemblance, dans leur liste
  · R8 élément absent ⇒ arrêt nommé.
- **Rouge sur le code d'avant** : PREUVE_AVANT
- **Mutations** (`--prouve`) : PREUVE_MUTATIONS
- Banc `scripts/bancs/repub-formulaire.cjs` : injecte maintenant `vrm-trouver.js` avant le formulaire, comme le service
  worker. BANC_RESULTAT
- Banc `suppression-confirmation.cjs` (5.441, sans la couche : la règle de repli) : 5/5 inchangé.

## 3. Ce qui reste invérifiable sans lui — premier essai réel : UNE paire, avec Julien
1. Le DOM réel d'aujourd'hui du formulaire « Vendre », de la page d'une annonce et de la fenêtre de suppression (relevé
   une seule fois le 20 nov.). En particulier : le **nom exact** du bouton de confirmation (s'il n'est pas dans la liste
   des 5 langues, VRM s'arrête AVANT de supprimer : « supprimer-confirmation » — l'ancienne reste, le brouillon attend) ;
   l'entrée des photos dans un `form` ou un `main` unique ; les listes ouvertes autour des recherches.
2. Que Vinted accepte un brouillon et une mise en ligne faits par ce chemin (le chemin « formulaire » n'a jamais tourné
   en production : compteurs à 0 au 23 nov.).
3. Après l'essai : lire `vrmTrouverJournal` (chrome.storage.local) et les compteurs `trouve_*` de `panel_diag_capture`.

## Geste de Julien
Installer la 5.447.0 (avec le train), puis UNE paire dans « Republier », avec moi, onglet vinted.fr ouvert.

## ÉTAT À LA REPRISE
- PR vers `main` ouverte (merge APRÈS #1327…#1331) ; zips 5.447.0 régénérés.
- Décision ouverte (de `favoris-auto`) : garder ou retirer l'apprentissage par son clic pour la republication — gardé tel quel.
