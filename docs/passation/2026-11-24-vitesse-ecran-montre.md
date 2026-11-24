# Vitesse — ne calculer que ce que l'écran montré lit (24 nov., `claude/vitesse-ecran-montre`)

Suite de `docs/passation/2026-11-24-vitesse.md` (§5 bis, ter, quater). Julien : « l'app est bien trop lente ».

## ÉTAT À LA REPRISE

- Branche `claude/vitesse-ecran-montre` = `origin/main` + `claude/vitesse-24nov` (#1366 : le banc `vitesse-iphone`).
  Le CLAUDE.md et `historique-divers.md` gardent la version de `main` (aucune ligne ajoutée au §9, consigne du coordinateur).
- PR A (ce lot) : faite, PAS fusionnée. PR B (lectures parties au toucher, vagues d'Annonces) : pas commencée.
- Chiffres AB au §4.

## 1. Le constat (profil du §5 quater du récit « vitesse »)

Chaque écran monte 1 à 3 `Comptabilite` :

| écran | instances (`ecranCalcul`) |
|---|---|
| Annonces | `annonces` |
| Ventes | `ventes` (sa liste) + `bordereaux:ventes` (la section Colis « À envoyer · Envoyés ») |
| Achats | `achats` (sa liste) + `bordereaux:achats` (la section « À retirer ») + `achats:outils` (outils de retrait) |
| Ma journée | `journee` |

Chacune recalculait TOUS ses gros calculs. Mesuré au compteur (banc `calculs-ecran-montre`, 1re visite de chaque onglet, sur
le code d'avant rendu immédiat — la mutation du §3) :
- Annonces calculait les colis à retirer (`pickupUnion`, d'où `indexCodesSuivis` et `codeAchat` du profil) 3 fois ;
- la section de Ventes calculait `pickupUnion` 5 fois et, à chaque rendu (12 à 15 rendus pendant la visite), les cartes
  « à retirer » qu'elle ne montre pas ;
- Achats calculait les retours (`retoursEnCours`) dans ses trois instances, `achatsPourAtelier` dans deux, les envoyés
  (`listeEnvoyes`) dans sa section « À retirer » à chaque rendu.

## 2. Ce qui a changé

### Qui lit quoi (relevé par `grep`, puis par la pile du premier calcul — `PILE=1` du banc, build non minifié)

| calcul | lecteurs | qui le faisait sans le lire |
|---|---|---|
| `pickupUnion` (l. ~8647) | Achats, la section « À retirer », Ma journée, l'écran Colis, la publication `vrm_colis_retirer`, la photo hors ligne de Ma journée, la publication des transporteurs, `groupesRelais`, `colisParTx`, `chezMoiParTx`, `idsTranspRetrait`, la tête d'Achats (`gestesRetraitAchats`) | Annonces et la section de Ventes, par `groupesRelais` (useMemo), `colisParTx` (useMemo) et `gestesRetraitAchats` (calculé au corps) |
| `retoursEnCours` → `retoursSuivis` (l. ~12490) | Annonces (« articles qui reviennent »), Ventes (Retours), cartes de Colis, Ma journée, la publication `vinted_nums_physiques` | les trois instances d'Achats, par l'effet qui pose `numsRemisCle` |
| `achatsPourAtelier` (l. ~15890, publication `vrm_atelier_achats`, lue par l'Atelier d'Organisation) | — | Ventes (achats lus), les deux instances `achats` et la section |
| `cartesColis` (l. ~19255) | l'écran Colis et ses sections | — ; mais la section de Ventes construisait les cartes « à retirer » (contenu, trajet, point de chaque colis) qu'elle ne montre pas |
| `listeEnvoyes` (l. ~20620) | Ventes (« Envoyés »), Ma journée | la section « À retirer » d'Achats, à chaque rendu (pour un nombre d'onglet caché) |
| `chRet`, `parPoint`, `sortisVus` (rendu de Colis) | « À retirer » | la section de Ventes |
| `publication transporteurs` (`clePubTransp`, lue par Statistiques) + lecture des trajets | — | toutes les instances, Annonces compris |

`widget_stats` est écrit par la coque (`src/App.jsx`), pas par `Comptabilite` : inchangé.

### Le moyen

- **`src/calculParesseux.js`** : `useMemoParesseux(fn, deps, nom, ecran)` rend la MÊME valeur qu'un `useMemo` (même fonction,
  mêmes dépendances, même identité tant qu'elles ne changent pas) sous un mandataire (`Proxy`) qui ne calcule qu'au premier
  accès à une propriété. `useLecteurParesseux` fait de même pour une `Map` (une fonction de lecture). Un écran qui ne lit pas
  la valeur ne la paie pas ; un lecteur lit toujours la valeur complète — jamais un `[]` ni un `0` de remplacement.
  - paresseux : `pickupUnion`, `retoursSuivis`, `groupesRelais`, `colisParTx`, `chezMoiParTx` (publié comme fonction de
    lecture : `publierChezMoi` accepte une fonction, src/achatChezMoi.js), `chRet` et `parPoint` (rendu de Colis) ;
  - `sortisVus`, `gestesRetraitAchats` : des fonctions appelées par leur seul lecteur.
- **Ce qui n'est pas calculé vaut `undefined`** : `envoyesL`/`nEnvoyes` dans la section d'Achats ; `data-colis-total` de la
  section de Ventes (elle n'a plus la colonne « à retirer » : le total de toutes les colonnes n'y existe plus).
- **La section de Ventes ne construit plus les cartes « à retirer »** (`cartesColisCalc`, `colisDans !== 'ventes'`).
- **Les publications par leur propriétaire** (§5 : un écran publie, les autres consomment) :
  - `vrm_colis_retirer` et la photo hors ligne de Ma journée : `litRetraits` (Ma journée, la liste d'Achats, l'écran Colis
    et la section « À retirer ») — `usePreparation('vrm_colis_retirer')` disait déjà ces écrans-là ;
  - publication des transporteurs et lecture de leurs trajets : `publieTransp` (instance principale de Ventes, d'Achats et
    de Ma journée) ;
  - `vrm_atelier_achats` : la liste d'Achats et Ma journée ;
  - `vinted_nums_physiques` (par `numsRemisCle`) : plus par Achats ni par les sections (Annonces, Ventes, Ma journée la font).
  Ailleurs, la dernière publication reste (rien n'est effacé).

## 3. La garde : `scripts/bancs/calculs-ecran-montre.cjs`

Chaque gros calcul compte ce qu'il fait, par instance (`window.__vrmCalculs[nom][instance]`, `compterCalcul`). Le banc ouvre
Ma journée, touche chaque onglet du bas une fois (sa 1re visite) et juge :
1. `INTERDIT` : un calcul fait par une instance qui ne le lit pas ⇒ rouge ;
2. `ATTENDU` : le calcul reste fait là où il est lu (compteur absent ou nul ⇒ rouge) ;
3. les publications `vrm_colis_retirer`, `vrm_colis_aposter`, `vrm_atelier_achats`, `vinted_nums_physiques` (rangées) et
   `widget_stats` (écrite dans la base) sont posées après le parcours.

Preuves :
- **vert** sur la branche ;
- **rouge sur le code d'avant** (aucun compteur : les `ATTENDU` sont rouges) ;
- **rouge par mutation** : `useMemoParesseux` / `useLecteurParesseux` rendus immédiats (dans `src/calculParesseux.js`,
  `Reflect.ownKeys(p)` / `f()` dans le `useMemo`) ⇒ 6 rouges : `pickupUnion` et `groupesRelais` sur Annonces et dans la
  section de Ventes, `retoursEnCours` dans `achats` et `achats:outils`.
- `PILE=1` + build non minifié : la pile de chaque premier calcul (QUI l'a lu). C'est ainsi que `groupesRelais`, `colisParTx`
  et `gestesRetraitAchats` ont été trouvés.

Le banc `vitesse-iphone` reçoit le crochet `visite1` du récit (§5 quater) : `PROFIL=visite1:<onglet>` et `CALCULS=1`
(`CALCULS=pile` : les piles) pendant la 1re visite.

## 4. Les preuves et les chiffres

- `npm run build` : vert. `audit-tdz` : vert. `audit-magasin-groupe` : 7/7.
- Audits qui lisent le texte de ces calculs, suivis aux nouveaux noms (`useMemoParesseux`, `useLecteurParesseux`) et verts :
  `audit-retrait-qr`, `audit-identite`, `audit-retraits-visuel`, `audit-statuts`, `audit-retrait-preuves`,
  `audit-relier-retires`, `audit-atelier`.
- `chiffres-volume` (avant = base de la branche, après) : **33/35 identiques**, et les 12 publications identiques
  (`vrm_colis_retirer`, `vrm_colis_aposter`, `vinted_nums_physiques`, `vrm_benefice_jours`…). Les 2 écarts sont un seul
  attribut, `data-colis-total` de la section Colis de Ventes (relevé deux fois : Ventes et `cat_bord`), qui comptait les
  cartes de TOUTES les colonnes, « à retirer » comprise (252) alors que la section n'en montre que deux (112). Il n'est plus
  posé dans cette section (pas calculé ⇒ absent). Aucun nombre visible ne change. Les 3 relevés qui suivent l'heure (récit
  « vitesse » §4 bis) sont sortis identiques sur cette passe.
- AB alterné, 1re visite, iPhone 390 ×4, volume de Julien, 5 passes (`PASSES=5 TOURS=0`) : voir le tableau ci-dessous.

Charge de la machine 12 → 27 pendant la mesure (partagée). Builds : `avant` = base de la branche (main + #1366), `après` =
ce lot (sans le dernier retrait de l'attribut, sans effet sur le temps). Du doigt posé à l'écran PRÊT, en ms.

| 1re visite | avant (5 passes) | après (5 passes) | médiane avant → après | écart par paire (après − avant) |
|---|---|---|---|---|
| à froid (Ma journée prête) | 15 237 · 14 621 · 12 235 · 11 172 · 9 783 | 13 024 · 13 885 · 10 013 · 10 340 · 10 097 | 12 235 → 10 340 | −2 213 −736 −2 222 −832 +314 |
| Annonces | 9 149 · 7 341 · 6 437 · 6 015 · 5 644 | 6 516 · 7 157 · 6 949 · 4 667 · 4 810 | 6 437 → 6 516 | −2 633 −184 +512 −1 348 −834 |
| **Ventes** | 7 092 · 6 033 · 6 155 · 5 246 · 5 713 | 6 667 · 5 011 · 3 877 · 4 274 · 4 457 | **6 033 → 4 457** | −425 −1 022 −2 278 −972 −1 256 |
| Achats | 8 482 · 9 261 · 6 281 · 7 379 · 9 301 | 10 690 · 9 137 · 5 616 · 8 456 · 8 716 | 8 482 → 8 716 | +2 208 −124 −665 +1 077 −585 |
| Argent | 4 476 · 2 836 · 2 040 · 2 564 · 3 423 | 3 003 · 3 136 · 1 380 · 1 850 · 2 438 | 2 836 → 2 438 | −1 473 +300 −660 −714 −985 |
| Ma journée | 3 913 · 2 867 · 2 563 · 4 546 · 3 346 | 4 760 · 2 736 · 3 299 · 2 299 · 2 920 | 3 346 → 2 920 | +847 −131 +736 −2 247 −426 |

Lecture honnête :
- **Ventes : −1,6 s en médiane, plus rapide dans les 5 paires** (−0,4 à −2,3 s). C'est le gain attendu : la section Colis
  ne calcule plus les colis à retirer ni leurs cartes à chaque rendu.
- **Annonces : plus rapide dans 4 paires sur 5** (médiane des écarts −834 ms), mais la médiane brute ne bouge pas
  (6,4 → 6,5 s) : dans le bruit de la machine. Annonces reste ~6 s : son coût est ailleurs (AnnoncesEgalite, construction
  des articles, les 3 vagues de lectures — PR B).
- **Achats : aucun gain mesurable** (écarts de −0,7 à +2,2 s). Achats lit vraiment les colis à retirer ; ses 3 instances
  ne refont plus les retours ni l'Atelier, mais `pickupUnion` reste fait 4 fois par instance (ses dépendances changent à
  chaque lecture qui arrive) et `cartesColis` à chaque rendu.
- À froid −1,9 s en médiane (4 paires sur 5) : Ma journée ne publie plus depuis les sections et Annonces ; à confirmer,
  la charge a baissé pendant la mesure (alternance A/B/B/A, donc pesée pareil).

## 5. Ce qui reste

1. `cartesColis` et `listeEnvoyes` sont refaits à CHAQUE rendu de la section (12 à 15 rendus pendant une 1re visite de
   Ventes) : la mémoire ne vit qu'une microtâche. Une mémoire par version des données (comme `memoVersion`) les ferait une
   fois par lecture.
2. PR B : lancer les lectures au toucher (avant le montage) et aplatir les 3 vagues de lectures d'Annonces.
3. `retoursEnCours` reste fait 4 à 5 fois par visite (ses dépendances changent à chaque lecture qui arrive).

## 6. Gestes de Julien

Aucun.

## 7. PR B : lectures datées de la 1re visite (24 nov. soir, branche `claude/vitesse-lectures-toucher`, PAS de PR)

Le crochet `LECTURES=1` du banc `vitesse-iphone` est maintenant dans le banc. Il écrit chaque lecture de la base pendant une
1re visite, datée depuis le toucher. Mesure : build de la PR A, 1 passe, iPhone 390 ×4, volume de Julien, charge 18,7.

| 1re visite | prêt à | lectures | 1re vague | vagues avant « prêt » |
|---|---|---|---|---|
| Annonces | +5,2 s | 52 | +2,0 s (21 lectures) | +3,6–3,75 s (`harvest_%_txn_%` relu, étiquettes, `ebay_versements`, coffre) · +4,5–5,05 s (`harvest_%_txn_%` une 3e fois, `orders_sold`, brouillons) |
| Achats | +6,0 s | 76 | +3,9 s (25 lectures) | aucune autre : « prêt » arrive 2 s après la 1re vague (du calcul) |
| Ventes | +2,9 s | 41 | — | — |

Ce que ça dit :
- **Achats** : 3,9 s de montage avant la PREMIÈRE lecture, puis 2 s de calcul sur les données arrivées. Les lectures partent
  tard parce que le montage est long, pas l'inverse. Les lancer au toucher gagnerait au plus le temps d'une vague (~0,2 s au
  banc) : le levier reste le calcul (`pickupUnion` 4 fois par instance, `cartesColis` à chaque rendu — §5).
- **Annonces** : `harvest_%_txn_%` (la même requête) part 3 fois (+2,0 · +3,6 · +4,5 s). Chaque vague attend un rendu (calcul),
  pas la précédente sur le réseau. Partager cette lecture (`src/lecturesPartagees.js`, `FENETRE_MS` 2 s : les relectures
  arrivent après la fenêtre) et lancer la 1re vague au toucher sont les deux gestes à essayer.
- Après « prêt », Annonces relit `vinted_suivi_{compte}` compte par compte, une requête à la fois (15 lectures de +5,7 à
  +11 s). Cela ne retarde pas « prêt », mais ces lectures occupent le réseau pendant les premières secondes à l'écran.

Pas fait : le code de PR B. Aucun AB : il n'y a pas encore de changement à comparer.
