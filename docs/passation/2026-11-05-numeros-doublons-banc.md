# 5 novembre — Les 5 rouges du banc `numeros-doublons` : le banc était périmé, pas l'app

Question posée : le banc `scripts/bancs/numeros-doublons.cjs` avait 5 rouges (déjà sur
`origin/main` c52bb8ee) — quatre « … part au nuage — 0 écriture(s) » et « l'annonce en ligne
prend un numéro neuf (la vente garde le N°51) — N°51 ». Le règlement automatique des doublons
(`doublonsAReattribuer`, décision du 20 oct.) avait-il cessé de marcher, ou d'écrire au nuage ?

**Réponse : non.** Les deux causes sont deux changements VOULUS du 1er nov. que le banc n'avait
pas suivis. Il servait une forme d'écriture et une forme de vente que l'app ne connaît plus.
Rien n'a été changé dans l'app.

## Comment c'est établi

Banc lancé (le banc tel qu'il était, sans retouche) sur des arbres `git archive <commit>` construits
à part (`BANC_DIST`) :

| build | rouges |
|---|---|
| `f04af748` (parent de 5d7b34f4) | **0** |
| `5d7b34f4` « Données sûres : main fusionnée clé par clé » | **4** (les quatre « 0 écriture ») |
| `339e2c0f` (avant 2bdf211c) | C vert |
| `2bdf211c` « Audit des actions X1-X9 » | C rouge |
| HEAD de `claude/project-review-nsk5su` (2cd8a009) | 5 |

Le rouge C a été trouvé par `git bisect run --first-parent` (banc réduit au seul cas C) entre
5d7b34f4 et HEAD : premier mauvais = la fusion #942 (d7519a9d), puis dans la branche fusionnée
`339e2c0f` vert / `2bdf211c` rouge.

### Cause 1 — les 4 « 0 écriture(s) » : la forme de l'écriture de `main`

Depuis **5d7b34f4** (1er nov.), `cloudPush` n'envoie plus un upsert `[{ id: 'main', data }]` :
il lit-fusionne-réécrit par un **PATCH conditionnel**
`app_data?id=eq.main&owner=eq.…&data->>rev=is.null|eq.N&select=id`, corps `{ data, updated_at }`
**sans `id`** (la ligne est dans l'adresse), `Prefer: return=representation` (la base rend les
lignes écrites, `[]` = devancé). Mesuré au banc (requêtes journalisées, build de HEAD) : l'app
envoie bien ce PATCH après avoir donné le N°53 à la paire 4002, avec la nouvelle fiche dedans.
Le banc :
- ne comptait que les corps portant `id: 'main'` ⇒ « 0 écriture » ;
- répondait `[]` à toute écriture ⇒ l'app se croyait **devancée**, relisait, réessayait six fois
  puis abandonnait (« la ligne change sans cesse ») — une fiction : une vraie base aurait écrit.

(À savoir pour les autres bancs : la lecture `select=owner,data,updated_at` de `main` est
réécrite en `select=data,updated_at` par `_porte-banc.cjs`, qui pose l'owner sur la réponse ;
seules les ÉCRITURES n'étaient pas adaptées.)

### Cause 2 — C « l'annonce en ligne prend un numéro neuf » : la règle X1

Depuis **2bdf211c** (1er nov., audit X1, récit dans `historique-numeros.md`), une annonce posée
sous le même N° qu'une vente à poster ne change que si l'**identité** de la vente
(transaction → `item_id`, `identiteAnnonce`) est lue et n'est pas cette annonce ; vente sans
identité ⇒ rien n'est deviné, le rouge reste (§5 « mieux vaut un blanc qu'un faux »). Le banc ne
servait aucune transaction (`harvest_*_txn_*` répondait `[]`) : la vente n'avait pas d'identité,
l'app a donc — à juste titre — refusé de deviner.

## Ce qui a changé (banc seulement)

`scripts/bancs/numeros-doublons.cjs` :
- **Écritures de `main` à la vraie forme** : un PATCH sur `id=eq.main` est compté (corps `{data}`),
  le comparer-et-échanger est jugé sur `data.rev` de la ligne servie (`[{id:'main'}]` si accepté,
  `[]` si devancé), et une écriture acceptée est GARDÉE (une base qui dit « écrit » et relit
  l'ancienne ligne serait une autre fiction). La panne (A à 390 px) reste un 500. L'ancien upsert
  (premier jour) reste compté.
- **Les transactions servies** à la forme lue par l'app (`TXN_META_SELECT`, `meta->>` ramené par
  `_meta.cjs`, projeté par `projette` de `_base-volume.cjs`).
- **C refait en trois cas, la même règle jugée** :
  - C : la vente est l'annonce 6999 (sortie du dressing), l'annonce 6001 au MÊME titre est une autre
    paire ⇒ 6001 prend un N° jamais servi, la vente garde N°51, « à écrire » dit 51 → neuf, et le
    changement part au nuage ;
  - C2 : la vente EST l'annonce 6001 ⇒ rien ne bouge, ni rouge ni « à écrire » ;
  - C3 : vente sans identité lue ⇒ aucun N° ne change, le N°51 reste rouge.

## Preuves

- HEAD : **avant 78/83 verts (5 rouges) ; après 89/89 verts** (6 contrôles ajoutés en C/C2/C3).
- Le banc rouge quand la règle est cassée (mutations de `src/App.jsx`, builds séparés) :
  - `devine` (l'ancienne règle : une vente sans identité fait bouger l'annonce) ⇒ **2 rouges** (C3) ;
  - `pasEnvoi` (`cloudPush` ne part plus) ⇒ **5 rouges** (A ×2, C, K ×2 « part au nuage ») ;
  - `memePaire` (`memePaireProuvee` toujours faux) ⇒ **1 rouge** (C2 : rouge allumé pour une seule paire).
- Sur le build d'avant X1 (`f04af748`), le banc neuf est **rouge 3 fois** (C et C3) : deux paires au
  même titre sous N°51 y étaient dispensées par le titre — c'est exactement le défaut que X1 a corrigé.
- Verts sans retouche : `audit-fusion-nuage`, `audit-conflits-numeros` (26), `audit-garde-numeros-rapide`
  (20), `audit-identite`, `audit-reprise-numero`. Aucun fichier de `src/` ni de
  `vinted-sync-extension/` n'est touché.

## Ce qui reste

- **D'autres bancs comptent encore l'ancienne forme d'écriture** (`row.id === 'main'` dans le corps) et
  répondent `[]` au PATCH : `numeros-reconnexion`, `numeros-lettres`, `numero-vinted`,
  `numero-etiquette`, `double-vente`, `numeros-remise-a-zero`. Mesuré sur `numeros-reconnexion` :
  « rien de ce qui repart dans le nuage ne perd ni ne change un numéro — 0 écriture(s) fautive(s)
  **sur 0** » — **ce contrôle ne peut plus échouer** (§6.1). `numeros-remise-a-zero` est rouge pour
  la même raison (« 0 écriture », noté dans `2026-11-05-numerotation-etiquette.md`). À mettre à la
  vraie forme comme ici (ou sur `_base-ecritures.cjs`, qui l'émule déjà, garde-fou 017 compris).
- Ce banc n'émule pas le garde-fou 017 de la base (pool qui rétrécit, fiche perdue) : c'est
  `deux-appareils` (sur `_base-ecritures.cjs`) qui le juge.
