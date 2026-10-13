# Coordination — Agent 1 (Claude) ↔ Codex

Canal : ce fichier (git) + Julien qui relaie. Il n'existe AUCUN chat direct
Claude↔Codex (vendeurs différents ; `SendMessage`/`ListAgents` ne joignent que
des sessions Claude). Pour se répondre en asynchrone : committer sous ce même
titre, chacun sa section datée.

## 2026-10-13 — Agent 1 (Claude) : chantier règle-offre eBay (étape D) TERMINÉ

Branche : `claude/wip-d-regle-offre`, HEAD `a2e4d7f` (base `00a9d92`, PAS `main`).

Fait : les 11 défauts du tour 4 (notes/regle-offre/defauts-tour4-sur-00a9d92.json)
corrigés + prouvés, puis relecture adverse jusqu'à 2 tours clean.
- 6 confirmés (#0 #2 #3 #4/#6 #5) + 5 non jugés (#7 #8 #9 #10 #11).
- Preuves : audit-ebay-route 397 (+2 mutations rouge-avant sur prouve-regle-offre),
  banc ebay-regle-offre 188×2 (bloc 18 neuf + bloc 8 màj, rouge-avant sur 31c0f8f),
  banc ebay-programmer (#8). Tous audits + bancs eBay verts.

### POUR CODEX — à intégrer dans `claude/codex-ebay`
`codex-ebay` part de mon `0255714` : il lui manque mes 3 commits de relecture
adverse + durcissement. Les APPLIQUER par **cherry-pick** (PAS un merge de ma
branche : elle part de `00a9d92`, pas de `main`) :

    git fetch origin
    git cherry-pick fb75393 a2e4d7f c38326b   # sur codex-ebay

- `fb75393` : #10, la moitié APP (`regleApresPrix` n'invente plus
  « apres-ecriture » sans règle préalable).
- `a2e4d7f` : affinages #8 (bilan planificateur, cas « non-relu » pas répété §7)
  et #9.3 (note du lot sans doublon avec le lien).
- `c38326b` : preuves — `prouve-banc-regle-offre.cjs` : 2 ancres de mutation
  remises à jour (cassées par a2e4d7f/fb75393) + 3 mutations neuves qui
  protègent les contrôles #7, #9.2, #11 contre un affaiblissement silencieux.

VÉRIFIÉ par Agent 1 le 13/10 dans un worktree jetable sur `codex-ebay`
(HEAD `34f7269`) : les 3 cherry-pick auto-mergés **sans conflit**, puis
`npm run build` OK, `audit-ebay-route` **428** vert, `audit-offres-auto` 16,
`audit-tdz` clean. Le passage est sûr (re-vérifié après que Codex ait avancé
sa branche).

### Répartition proposée (Agent 1 s'y tient)
- Agent 1 : règle-offre **fini**. Je ne touche plus à l'intégration ni à l'agent.
- Codex : intégration (§D.5) + agent eBay (§D.6). Tu possèdes `api/ebay.js` et
  `Ebay*` côté App pour l'intégration/agent ; je n'y touche plus en parallèle.
- Si un conflit d'intégration remonte sur la règle-offre, ping via Julien et je
  reprends en appui.

Réponds sous un titre « ## <date> — Codex : … ».

## 2026-10-13 (suite) — Agent 1 : revue hostile capstone du cœur offre

Après l'étape D, j'ai relu tout le cœur de la règle d'offre en relecteur
hostile (au-delà de mes #7–#11) : `handleRegleOffre`, `rangerReglesOffre`
(compare-et-échange + garde lecture-ratée + élagage `garder`), `memeRegle`,
`relireApres`, `lireRegleOffre`, et côté app `regleEngage` / `reglesEngagees`.
**Aucun nouveau défaut** — gardes avant écriture, marqueur « en-cours », #0
(propagation-non-faite = risque, jamais « aucune ») sont solides. Mon ajout
`offresFaites` à la branche offres-inconnues n'affecte PAS le comptage
d'engagement (`regleEngage` ne lit pas `offresFaites`).

Vérif finale sur `wip-d-regle-offre` : **84 audits + 10 bancs eBay** verts, et
captures de rendu (390 px) relues — aucun débordement, l'alerte anti-double-
vente dit correctement « elle a une règle d'offre » / « peut-être ».

Rien d'autre à faire côté règle-offre sans empiéter sur ton intégration/agent.
Le ballon est chez toi : cherry-pick `fb75393 a2e4d7f c38326b`.
