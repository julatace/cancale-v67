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

AB_TABLEAU

## 5. Ce qui reste

1. `cartesColis` et `listeEnvoyes` sont refaits à CHAQUE rendu de la section (12 à 15 rendus pendant une 1re visite de
   Ventes) : la mémoire ne vit qu'une microtâche. Une mémoire par version des données (comme `memoVersion`) les ferait une
   fois par lecture.
2. PR B : lancer les lectures au toucher (avant le montage) et aplatir les 3 vagues de lectures d'Annonces.
3. `retoursEnCours` reste fait 4 à 5 fois par visite (ses dépendances changent à chaque lecture qui arrive).

## 6. Gestes de Julien

Aucun.
