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

(mis à jour à chaque lot)
