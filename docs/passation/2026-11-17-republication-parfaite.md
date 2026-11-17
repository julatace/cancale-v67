# 17 nov. 2026 — Republier : de l'annonce au brouillon, du brouillon à en ligne (extension 5.408.0)

Branche `claude/republication-parfaite` (depuis `origin/claude/extension-carte-v2`, #1247).
Julien, mot pour mot : « tout doit être parfait, ça c'est pas du tout le cas, occupe-toi aussi de la
republication, de annonce à brouillon et de brouillon à en ligne ».

## 1. Mesuré d'abord (vraie base, lecture seule, projections scalaires, 17 nov.)

Lignes `coffre_*` portant `versBrouillon` (une par republication lancée par VRM), `vinted_brouillon_*`,
compteurs de `panel_diag_capture`. Aucune donnée recopiée ici (dépôt public).

| | nombre |
|---|---|
| republications lancées (28 oct. → 1er nov.) | **10** |
| brouillon créé | **10** |
| ancienne supprimée (prouvé : `supprime: true`) | **10** |
| en ligne **du premier coup** | **0** |
| en ligne ensuite (reprise à la main : « Brouillons → en ligne », « Refaire ») | 5 |
| **supprimées, brouillon prêt, jamais en ligne (16 jours)** | **5** |
| depuis le 1er nov. | aucune republication |

Où ça s'est arrêté (classes) :

| classe | mesuré | ce qui manquait |
|---|---|---|
| mise en ligne refusée par Vinted (400) | 8 lignes `refuse-400` ; compteurs : `republier_mise_en_ligne_refusee_400` ×6, `brouillon_publier_refuse_400` ×11, `refaire_mise_en_ligne_refusee_400` ×3 ; champs nommés : `photos` ×7, `photos`+`size` ×1 | la relecture du brouillon (ses photos) avant la mise en ligne existe depuis la 5.284 ; le compteur `brouillon_lu_photos` est à 0 en base : aucune republication n'a tourné depuis — **non mesurable sans un vrai passage** |
| mise en ligne jamais faite, sans cause | 2 (29 oct.) | rien ne proposait de finir la paire |
| état faux après coup | 4 « fait » portaient encore `refuse-400` ; 1 « a-publier » était EN LIGNE (« Publier » n'écrivait pas le coffre de l'ancienne) | |
| brouillon refusé (avant suppression) | `versbrouillon_brouillon_refuse_400` ×2 | déjà sûr : rien supprimé |
| frein / pause | `vinted_frein_403` ×56, `vinted_frein_429` ×24 | déjà tenu |

⚠️ **L'ordre.** CLAUDE.md §3 dit « coffre → supprimer → brouillon → mise en ligne » (décision du 28 oct.,
5.254). Le code fait depuis la 5.277 (29 oct., « fais tout comme Vintex ») **coffre → brouillon →
supprimer → mise en ligne** : le brouillon AVANT la suppression (un brouillon refusé ne supprime rien —
mesuré : 2 refus ainsi sans perte). `audit-recreer.cjs` (169) l'exige. **Gardé tel quel** ; à confirmer
par Julien si la ligne §3 doit être réécrite. « Recréer puis supprimer » (création EN LIGNE d'abord) reste
retiré.

## 2. Ce qui change (extension 5.408.0)

- **Étapes datées sur leur preuve** (`vbAvecEtapes`, capacité `repubetapes`) : `versBrouillon.etapes`
  = `coffre` (écriture vérifiée), `brouillon` (identifiant rendu par Vinted), `supprimee` (suppression
  acceptée), `planifiee` (heure de mise en ligne), `enLigne` (identifiant en ligne). Un nouvel état sans
  cause **efface** la cause d'avant.
- **Écran plein sur vinted.fr** : la chaîne de LA paire en cours (`Coffre ✓ › Brouillon ✓ › Supprimée ✓ ›
  En ligne dans 2 min`, photo k sur n), suivie des étapes annoncées (`poserEtapeAction`), 5 langues
  (`vrm-ui.js`, clés `r_*`). « Tout arrêter » / « Réduire » : ceux de la 5.406.
- **Reprise d'une mise en ligne planifiée interrompue** (service worker tué) : `phase` du job
  (`lecture` → `envoi`) ; tué AVANT l'envoi ⇒ elle repart (une fois) ; APRÈS ⇒ 2 min d'attente puis UNE
  lecture du brouillon : `is_draft: false` ⇒ fait, `true` ⇒ elle repart, autre ⇒ « incertain » (comme
  avant). Compte de l'onglet seulement. Alarme Chrome à l'heure (`vrm-mise-en-ligne`), plus la minuterie.
- **« Reprendre »** (`reprendreRepub`, capacité `repubreprise`, SON clic confirmé) : relit chez Vinted
  où en est la paire et la finit sans rien refaire : déjà faite ⇒ rien ; mise en ligne sans réponse ⇒
  brouillon relu ; ancienne pas prouvée partie ⇒ relue (disparue ⇒ prouvée ; là + brouillon prêt ⇒
  supprimée, une action dans les 45/h, quota du jour, frein, pause ; là sans brouillon ⇒ « toujours en
  ligne, rien perdu », rien ne part) ; puis le brouillon EXISTANT en ligne, ou, disparu, **recréé depuis
  le coffre** (`refaireBrouillon`, inchangé).
- **« Publier » / « Brouillons → en ligne »** d'un brouillon de republication écrit le coffre de
  l'ancienne (« fait », identifiant neuf), le coffre de la nouvelle (`recreeDe`, par la chaîne du coffre)
  et « Ce que VRM a fait ». Le N° passe par identité (`tableRecrees` → `repriseNumerosRecreation`).

## 3. Ce qui change dans l'app (Annonces → Republier, l'atelier)

- Avant de lancer : **« 12 paires · environ 40 min · fin vers 15:10 »** (`planRepub` : SES attentes +
  ≈ 45 s par paire + la mise en ligne de la dernière ; « Comment c'est calculé »).
- Pendant : sous chaque ligne, la chaîne **Coffre › Brouillon › Supprimée › En ligne vers 14:32**
  (`chaineRepub` : seulement ce que l'extension a annoncé ou rendu).
- Après : **le bilan** — « 11 en ligne · 1 à finir », puis une ligne et UN geste par problème
  (`resumeRepub` / `gesteProbleme`) : il manque la taille → **Choisir la taille** ; brouillon prêt pas en
  ligne → **Reprendre** ; supprimée sans brouillon → **Recréer depuis le coffre** ; Vinted pas clair →
  **Reprendre** (relit) ; pas partie → **Réessayer**. « Pas su » n'est jamais compté en ligne.
- Textes : `tr()`, clés `rep.*`, 5 langues (`src/i18n/langues/<l>/republication.js`) ; styles
  `src/republication.css` (jetons `--sb-*`, ambre seulement pour ce qui reste à faire).

## 4. Preuves

- `scripts/audit-republication-parfaite.cjs` (neuf, vrai background.js sur `_fond-vm.cjs`, faux Vinted
  À ÉTAT de la forme de Vinted) : **38 verts** — A suite dans l'ordre et datée, B reprise après un worker
  tué à chaque étape (B1–B10), C aucun second brouillon, D recréer depuis le coffre, E N° reporté, F gardes
  (45/h, jour, REPUB_PAR_JOUR 50, frein, 429, onglet sur un autre compte, confirmation), G retirés restent
  retirés, H règle de l'app, I écran plein. `--prouve` : **rouge sur origin/claude/extension-carte-v2** et
  **19/19 mutations rouges** (20/20).
- `audit-recreer` 169 verts (R2 adapté : le job « en cours » est relu 2 min après, la règle « jamais deux
  mises en ligne » inchangée) ; `audit-republier`, `-programme`, `-question`, `-plusieurs-chrome`,
  `brouillons-proposables`, `quoi-republier`, `extension-feuille`, `repub-programme-notif` verts ;
  `audit-coherence` (capacités `repubetapes`, `repubreprise` à 5.408.0), `audit-traduction`,
  `audit-quoi-de-neuf` verts.
- Bancs et captures : voir §5.

## 5. Bancs

Voir la fin de ce fichier (ajoutée après les captures).

## Geste de Julien

1. Installer l'extension **5.408.0** (remplacer le dossier, ⟳ dans chaque Chrome).
2. Annonces → « Brouillons à refaire » : le bouton de chaque ligne (avec la 5.408 il passe par « Reprendre ») sur les 5 paires restées
   supprimées et jamais en ligne depuis le 1er nov. — onglet vinted.fr ouvert sur le bon compte.
3. Dire si la ligne §3 de CLAUDE.md doit dire « coffre → brouillon → supprimer → en ligne » (le code
   depuis le 29 oct.) ou s'il veut revenir à la suppression AVANT le brouillon.
