# 16 nov. 2026 — Un achat renvoyé n'est jamais proposé à relier (lot `achats-retour`)

## La demande

Julien, sur une capture de la feuille « Relier » d'une vente (liste de ses achats avec « Relier ») :
« par exemple j'ai demandé un retour, donc j'ai fait un litige : ne me la propose pas, vu que je ne
vais pas la mettre en vente ».

Livré seul, avant le glisser-déposer (lot `relier-glisser`), parce que c'est une règle courte.
Branche partie de `claude/relier-fiable` (PR #1199, pas encore fusionnée au départ).

## La règle (`src/achatsHorsRelier.js`, module pur)

Un achat est **hors relier** quand une PREUVE le désigne par **son n° de transaction** (jamais le titre, §5) :

| preuve | source |
|---|---|
| statut Vinted : annulé, remboursé, retour, suspendu, échoué (`ACHAT_SANS_COUT`) ou « litige » / « réclamation » (neuf) | la liste « Mes achats » |
| bordereau de retour reçu par e-mail (sens « achat ») | `email_bordretour_{tx}` via `txAchatsEnRetour` (api/_lib/suivi-colis.js, règle partagée) |
| avis « Retourne ta commande » désigné par SA conversation (une seule commande) | `email_retourdemande_*` via `txAchatsEnRetour` |
| remboursement prouvé ≥ ce qu'il a payé (ou payé pas su) | `email_rembachat_{tx}` (`remboursementsParTx`) |
| litige ouvert suivi par VRM (sens achat, son n°) | `litigesEnCours` |

- **Litige clos sans retour** (il garde la paire) : la commande le prouve (« Commande finalisée » ou
  `transaction_user_status` completed, sans remboursement / annulation / retour dans le statut) ⇒ l'achat
  **redevient proposable**, même si un bordereau ou un avis avait été reçu.
- **Remboursement partiel** prouvé (montant < payé) : il garde la paire ⇒ rien n'est écarté.
- **Pas su** (bordereaux, remboursements, litiges pas lus) ⇒ seul le statut écarte.
- Rien n'est caché ailleurs : l'achat reste dans Achats → Retours / Litiges (règles inchangées).

## Le branchement

- Comptabilité (l'écran qui lit déjà les preuves : `txRetourAchat`, `rembAchatsParTx`, `litigesSuivis`)
  calcule la carte `achatsHorsRelierRes` et la **publie** (`publierHorsRelier`).
- `src/suggestionsAchat.js` `achatAnnule` = `achatHorsRelier` : la feuille « Relier / Choisir un achat »
  (libres ET « Déjà relié à N°… »), `src/liaisonAchat.js` (propositions, pistes, `seriePropositions` du
  numérotage / saisie en série, récap de vente) suivent sans autre changement.
- « Achetés, pas en ligne » : `buysAJuger` (achats filtrés) ; atelier d'arrivée : `annule` étendu.
- Les memos / effets de liaison de Comptabilité dépendent de la carte (recalcul quand les preuves arrivent).
  Les autres lecteurs (fiche d'une paire) lisent la carte publiée au moment du calcul ; si Comptabilité n'a
  jamais été montée, seul le statut écarte (pas su ⇒ rien de plus).

## Preuves

- `scripts/audit-achats-hors-relier.cjs` : **21 verts** ; sur l'arbre d'avant (`origin/claude/relier-fiable`)
  **4 verts · 18 rouges** ; `--prouve` **9/9 mutations** attrapées (clos ignoré, bordereau ignoré, partiel
  écarté, litige ignoré, statut litige ignoré, carte pas lue, app sans publier, « pas en ligne » sur
  `buysBase`, atelier sans la carte).
- Banc `scripts/bancs/relier-sans-retour.cjs` (390 tactile + 1512 sombre, lignes servies en projection
  `meta->>`) : **18/0** ; quatre achats au même titre : bordereau reçu ⇒ absent, remboursé ⇒ absent, clos
  sans retour ⇒ présent, libre ⇒ présent. Build muté (sans `publierHorsRelier`) : **4 rouges** (bordereau
  et remboursé reviennent dans la feuille). Captures regardées (feuille : deux achats, « Autres pistes · 2 »).

## ÉTAT À LA REPRISE

- Branche `claude/achats-retour` poussée ; PR ouverte vers `main` (voir le rapport). Si #1199 fusionne
  avant, refaire un vrai `git merge origin/main`.
- Le glisser-déposer (« Relier en glissant ») est le lot suivant `claude/relier-glisser` : il appliquera
  la même règle (il lit `achatAnnule` / `tousAchatsLibresDetail`).
- Aucun geste de Julien.
