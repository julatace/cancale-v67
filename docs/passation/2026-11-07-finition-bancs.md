# 7 nov. — Intégration de la finition : les bancs de `fiche-paire` à la fin

Branche `claude/attente-v36-finition-integ`, fusionnée avec `origin/main` 6c59c5e8
(vitesse : formateurs de dates en cache, `colisEnvoi`, `CarteMois`, `rangeesDefilantes` ;
fusion sans conflit). Suite du rapport « État au 7 nov., 2 h » de
`2026-11-07-passation-generale.md` §1.1 (155 bancs déjà faits jusqu'à `feuilles-coque`).

Méthode : un banc à la fois, `BANC_PORT=5520`, `timeout 1500`, porte de banc posée
du chemin absolu. Chaque rouge est relancé sur un arbre `git archive origin/main`
construit à part. Classement :
(a) orthographe seulement (U+00A0, « e-mail ») → banc adapté pour juger la règle ;
(b) vrai défaut de la finition → corrigé à la source ;
(c) même rouge sur `main` → listé, pas corrigé.

Aucune fixture réelle `fx/` dans ce conteneur : les bancs qui en ont besoin sont
rouges (ou sautés) des deux côtés, donc (c).

`audit-vc-recon` est vert : son exception est retirée de `scripts/audits-exceptions.json`.

## Avancement

43 bancs lancés sur 221 (de `fiche-paire` à `widget-multi`, ordre `LC_ALL=C`).

- **verts** (27) : `filtre-compte`, `finition`, `finition-premium`, `fluidite`, `fournisseurs`, `garde-ecrans`, `gestes-annuler`, `glisser-onglet`, `gros-volumes`, `hors-ligne`, `hors-reseau`, `ia`, `imprimante`, `inscription-fiable`, `inventaire`, `iphone-reprise`, `journal-emails`, `journee-chiffres`, `journee-premium`, `journee-widgets`, `lbc-bordereau`, `lbc-comme-vinted`, `lbc-demarrage`, `lbc-identite-privee`, `lbc-rappel-mise-a-jour`, `lbc-repondre`, `lbc-revue-complete`
- **(c) rouges identiques sur main** (13) : `fiche-paire`, `file-envoi`, `formes-communes`, `garage3d`, `indicateur-pro`, `jetons-coherence`, `journee-coherence`, `journee-mieux`, `journee-photos`, `lbc-messages`, `lbc-pause`, `lbc-publier-app`, `lbc-relier`
- **DIFF — à trancher / relancer seuls** : `fusion-app`, `lbc-flou-compte`, `lbc-preuve`

### Classement à la main

- **(b) `journee-mieux`** — « un détail raccourci l'est à la fin d'un mot » : `UneLigne`
  coupait par `split(/\s+/)` puis `join(' ')`, et `\s` attrape l'insécable : « 14 € » perdait
  son U+00A0 à la coupe (le banc ne retrouvait plus le début dans l'infobulle). Corrigé à la
  source (`src/UneLigne.jsx`, `ESPACES_SECABLES`) ; relancé : les 12 rouges restants sont ceux
  de main (titres sur deux lignes, nombres redits).
- **(c) `lbc-preuve`** — main s'arrête plus tôt (historique git illisible dans l'archive) ;
  même cause racine des deux côtés : l'écran Leboncoin ne propose rien (« null à publier »),
  les contrôles qui suivent en découlent.
- **à relancer seuls** (rouge de transition sous charge, opacité/fond pris en plein
  mouvement) : `fusion-app` (fond rgba(…, 0,353) d'un bouton secondaire en sombre),
  `lbc-flou-compte` (opacité 0,31 sur « rien n'est flouté »).
