# 21 nov. — Argent · Mois « comme Vintex » (lot argent-vintex)

Branche `claude/argent-vintex`. Périmètre : l'onglet **Mois** d'Argent seulement (`src/natif/ecrans/ArgentMois.jsx`,
`src/natif/ecrans/argent.css`, `src/ecrans/Compta.jsx` · `ArgentMoisV2`, et la barre `ArgentNav` de `src/App.jsx` pour
le lien « Comptes »). La coque n'est pas touchée. Remplace la présentation du 20 nov. (`2026-11-20-argent-natif.md`).

## Ce que Julien a dit, ce qu'on a vu sur ses captures iPhone

« Refonds toute l'application dans le style de Vintex, pratique, bien compréhensible, que tout soit parfait. » Sur ses
deux captures d'Argent :

| défaut vu | ce qui le remplace |
|---|---|
| « Saisir 13 prix d'achat » (gros bouton plein) juste au-dessus de « 2 sur 15 coûts saisis » : deux chiffres pour une chose | UNE phrase sous le bénéfice, « 13 prix d'achat à saisir sur 15 » (ambre), la rangée entière ouvre la saisie ; plus aucun plein sur Mois. Les deux nombres viennent de la MÊME source `Bn` (manquent = `n − nCout`, sur `n`) |
| tuiles en grille (Vendu, Bénéfice, Argent à venir, Disponible) qui coupaient les montants | des rangées fines « libellé à gauche · montant à droite » (`white-space: nowrap`, la colonne du montant ne rétrécit jamais), groupe « Novembre en chiffres » |
| « au moins · reçus en novembre · Daté au jour du versement » sur trois lignes | « REÇU EN NOVEMBRE » + « ? » (la règle de datation y est expliquée), le chiffre en grand avec « au moins » posé devant ; le manque (la note de la règle) reste écrit en une ligne quand il existe |
| histogramme J J A S O N sans valeurs | six rangées « Juin ▬▬ 1 760 € », chaque montant écrit (« — » si pas su), le mois en cours en encre et en accent |
| titres coupés dans « Versements de novembre », « acheté 100 € … » tronqué | titre sur deux lignes, « 19 nov. · Vinted · acheté 20 € » court (jour sans le nom du jour), la marge sous le montant ; à l'ordinateur un tableau N° · Article · Jour · Site · Achat · Marge · Reçu |
| « Comptes · 11 › » qui flottait à droite | dernière rangée du groupe des chiffres (même règle `compteEcarte` qu'`ArgentNav`, qui ne l'affiche plus sur Mois) |

## Aucun chiffre ne change de règle

Aucun calcul n'a bougé : tout arrive de `ArgentMoisV2` par les mêmes règles qu'hier (`valeurChiffre`, `questionsArgent`,
`recuPublieEntre`, `recettesDe`). Seuls ajouts côté données : `geste.sur` (= `Bn.n`, déjà la population de la
couverture), `note` (= `qR.note`, déjà la phrase d'hier) et la rangée Comptes. Vendu ≠ reçu, CA daté au versement,
« — » si pas su, jamais « encaissé » : inchangés (audit-urssaf vert).

Preuve : le banc `argent-vintex` (critère N) relève tous les `data-*` chiffrés de Mois (reçu, six mois, vendu, bénéfice,
en attente, disponible, couverture `k/n`, geste, comptes, et chaque versement montré : montant, achat, marge) sur le build
d'`origin/main` puis sur celui de la branche : **identiques** (21 relevés à 390 px, clair et sombre).

## Le banc `scripts/bancs/argent-vintex.cjs`

Base inventée (`volume` d'aujourdhui-propre, 3 comptes) + la ligne du CA déclaré + **deux prix d'achat saisis**
(`vinted_buyprice_by_num` 1 et 4 : sans eux l'ancien écran ne montrait pas la couverture à côté du plein et la
contradiction de sa capture ne se jouait pas). Mesures : M montants entiers (débord, « … », rognage par un parent
hidden/clip — un parent qui défile ne compte pas), P un seul élément parle des prix d'achat avec les nombres de la règle
et aucun plein, L phrase du reçu sur une ligne, V six mois chiffrés, K Comptes dans une carte, T versements entiers,
X pas de débord et cibles 44 px, N chiffres = avant.

```
npm run build   # puis, pour la référence : build d'origin/main dans un dossier à part
BANC_DIST=<avant>/dist BANC_JSON=ref.json BANC_PORT=4793 node scripts/bancs/argent-vintex.cjs   # ancien : 18 verts, 28 rouges
BANC_REFERENCE=ref.json BANC_PORT=4794 node scripts/bancs/argent-vintex.cjs                     # branche : 48 verts, 0 rouge
```

Sur l'ancien code il rapporte exactement les défauts de ses captures : « Saisir 25 prix d'achat » et « 2 sur 27 coûts
saisis » (deux éléments), un plein, phrase sur deux lignes, 0/6 mois chiffrés, Comptes hors carte, « acheté 10 € → +1 »
coupé. Mutations (branche) : `sur: Bn.n - 1` ⇒ P rouge ; `.n-arg-l-val` à 40 px rognés ⇒ M rouge.

## Autres contrôles (21 nov.)

- `argent-natif` : 612 verts, 0 rouge (les rangées de chiffre portent `data-arg-rangee` : « Voir les 27 » est une rangée de
  liste, pas un bouton pleine largeur).
- `argent-mois` : 88 verts, 16 rouges, **les mêmes 16 sur origin/main** (« Argent à venir » de Ventes : à venir sur 2 ventes,
  une ligne par site et par compte, date Vestiaire, date Vinted) — hors de Mois, pas touché ici.
- audit-urssaf, audit-traduction (45/0), audit-quoi-de-neuf, audit-coherence, audit-icones : verts ; build vert.
- Le gros chiffre du reçu est en chiffres proportionnels : avec `tabular-nums` en gras, « 1 841 » se lisait « 1841 ».

## Reste / pour la suite

- Le bloc « Tes seuils de l'année » (DAC7) au-dessus de Mois et la liste des replis dessous (« Ton bénéfice »,
  « Vendu et reçu »…) ne sont pas refaits ici.
- Statistiques, Déclarer, Factures : pas touchés.

Geste de Julien : aucun.
