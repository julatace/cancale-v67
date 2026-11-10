# Recherche universelle — lot AX — 10 nov. 2026

Branche `claude/recherche-universelle` (depuis `origin/main`). Validé par Julien
(proposition 7, lot AX de `2026-11-09-file-des-lots.md`) : « UNE barre (⌘K sur
ordinateur, la loupe au téléphone) qui trouve, au fil de la frappe, un N°, un pseudo,
un n° de suivi, un code de retrait, un n° de transaction, un titre d'annonce ».

**Rien de neuf n'a été ajouté à côté** : la loupe universelle (6 nov.,
`2026-11-06-recherche.md`), « Tout sur le N° », la recherche universelle et la fiche
(9 nov., `2026-11-09-recherche-fiche.md`) et ⌘K qui agit (lot B,
`2026-11-09-annuler-commandes.md`) trouvaient déjà presque tout. Ce lot ÉTEND ce même
panneau — c'est toujours UN outil (⌘K / Ctrl+K / « / » sur ordinateur, la loupe au
téléphone).

## Ce qui change pour lui

1. **La correspondance exacte passe en tête et le dit.** Un N° (« 007 » = « 7 »,
   « B125 » ≠ « 125 »), un n° de suivi (tapé avec ou sans espaces, en minuscules), un
   code de retrait, un n° de transaction ou de commande, un n° de facture qui
   correspond EXACTEMENT à une ligne : cette ligne sort de son groupe et s'affiche en
   haut, sous **« Correspondance exacte · Trouvé par son n° de suivi — pas par
   ressemblance. »** Elle n'est pas répétée plus bas. Entrée ouvre donc directement
   la bonne chose (le colis trouvé par son code s'ouvre, code en grand).
   Pour un N°, « Tout sur le N° » reste le bloc du haut ; une ligne au-dessus dit
   « Correspondance exacte · trouvé par son N° ».
2. **Le titre n'est jamais une identité.** 50 paires au même titre = 50 lignes « par
   le titre », aucune en tête. Une paire dont le titre CONTIENT un n° de suivi n'est
   pas la correspondance exacte de ce suivi. Un pseudo (un acheteur achète plusieurs
   fois) et un montant non plus.
3. **Groupes : Paires · Ventes · Achats · Colis · Retraits** (puis Messages, Annonces
   sans N°, Factures, E-mails). Un colis du transporteur qui VIENT chez lui est un
   **retrait** ; un colis envoyé reste dans **Colis**. (Avant : tout dans « Colis ».)
4. **Ce qui n'est pas lu est dit.** Pendant que la loupe lit : « Achats pas encore
   lus. » (ou « Pas encore lus : colis et retraits, pseudos des acheteurs… »). Si une
   lecture n'a pas répondu : « Achats pas lus — la lecture n’a pas répondu. » Avant,
   une lecture ratée des ventes/achats devenait une liste vide, et la loupe se taisait
   comme s'il n'y avait rien (§5 « rien lu ne vaut pas rien »).
5. **Un n° recopié par blocs** (« XW 300 000 007 FR ») est dit « un n° de suivi » dans
   la ligne « Je cherche… » (avant : « des mots du titre »).
6. **Un code de retrait exact ne propose plus « Baisser le prix de N°482913 »** (les
   actions à N° du lot B ne viennent que si le nombre est bien lu comme un N°).

Tout se cherche **en mémoire**, sur ce que la loupe a déjà lu à son ouverture : aucune
lecture de la base à la frappe (mesuré au banc). Rien de nouveau n'est rangé sur
l'appareil (les « récentes » existaient déjà, tues en mode stream).

## Le code

| fichier | quoi |
|---|---|
| `src/rechercheUnique.js` | `GROUPES_LOUPE`, `groupeDe` (le colis entrant ⇒ `retrait`, son type et sa clé restent `colis`) ; `IDENTITES_EXACTES` + `estIdentiteExacte` (titre, pseudo, montant exclus) ; `chercherPartout(…, { exactesEnTete })` ⇒ `exactes` ; `sourcesNonLues` / `phraseNonLues` (index : `nonLues`) ; `reconnaitreRequete` accepte un n° par blocs |
| `src/App.jsx` | lecture de la loupe : une lecture ratée des ventes/achats rend `null` (plus `[]`) ; pas encore lu ⇒ `null` passé à la règle ; panneau : `blocExactes` (`data-recherche-exacte`, `data-recherche-exacte-par`), `data-recherche-exacte-numero`, ligne `data-recherche-non-lu` ; groupes depuis `GROUPES_LOUPE` ; les actions à N° filtrées quand le N° s'efface |
| `scripts/audit-recherche-exacte.cjs` (nouveau) | 43 contrôles, `--prouve` 15 mutations |
| `scripts/bancs/recherche-exacte.cjs` (nouveau) | le banc (ci-dessous) |
| `scripts/audit-recherche-unique.cjs`, `audit-recherche-universelle.cjs` | un colis ENTRANT est cherché dans `groupes.retrait` (au lieu de `groupes.colis`) ; l'ancre de la mutation `max` suit le code (elle aurait été « introuvable », comptée attrapée à tort) |

## Identité (§5)

| ce qui est tapé | ce qui désigne | jamais |
|---|---|---|
| N° | `cleNum` de la fiche (« 007 » = « 7 », lettres B…) | un N° qui le CONTIENT (il est listé, pas en tête) |
| n° de suivi | le suivi EXACT (lettres et chiffres, majuscules) du bordereau de CETTE transaction ou de CE colis | un suivi partiel (listé), un titre qui le contient |
| code de retrait | le code EXACT de CE colis | « 4829 » pour « 482913 » |
| n° de transaction / commande / facture | le n° EXACT | un n° partiel (listé) |
| pseudo, montant, titre | rien : ils TROUVENT, il CHOISIT | — |

## Preuves

- `node scripts/audit-recherche-exacte.cjs` : **43/43**. `--prouve` : **15/15**
  mutations attrapées (identité par titre ; titre égal ⇒ « exact » ; pseudo identité ;
  la même ligne deux fois ; pas de tête ; Retraits fondus ; « pas lu » tu ; liste vide
  prise pour « pas lue » ; code à peu près ; suivi partiel exact ; suivi par blocs ;
  l'app sans tête ; lecture ratée ⇒ `[]` ; « pas lu » non rendu ; actions N° sur un
  code). Une ancre introuvable est comptée ROUGE de la preuve, pas attrapée.
  Sur `origin/main` (ae0e418d, `git archive`) : rouge (« la règle ne sait pas encore :
  estIdentiteExacte, … »).
- Banc `scripts/bancs/recherche-exacte.cjs` (390 tactile et 1512, clair et sombre ;
  lecture TENUE ; lecture des achats en panne) : **tout vert** (≈ 100 contrôles). Sur
  le build d'`origin/main` (ae0e418d, même banc, `BANC_DIST`) : **40 rouges**. Mutation
  « identité par titre » bâtie dans l'app (`estIdentiteExacte` accepte le titre) : rouge
  (la paire « Lot XW300000007FR » en tête, 50 jumelles en tête, pseudo en tête…).
- Bancs voisins, après le merge d'origin/main (un à la fois, `BANC_PORT` aléatoire) :
  `recherche-fiche` vert (sa ligne « Ventes puis Messages » accepte maintenant la tête
  quand le n° de transaction est exact) ; `navigation-fusion`, `litiges-recherche`,
  `recherche-numero` verts ; `annuler-commandes` 2 rouges (K3 `/api/vinted-proxy`,
  K5 focus « Préparer ») — **3 rouges sur origin/main** (mêmes contrôles) ;
  `navigation-tache` 5 rouges (menu « Plus »/« Gérer » après le lot AO Argent) — **5 sur
  origin/main** ; `recherche-universelle` 11 rouges (facture Pro ⇒ « Argent », ligne
  `email_track` lue par Ma journée, temps sous charge) — **17 sur origin/main**, mêmes
  familles, rien de cette branche.
  Captures regardées (`$TMPDIR/vrm-bancs/recherche-exacte/`) : suivi en tête (390 clair,
  1512 sombre), code (390 sombre, 1512), « 007 » (1512), Retraits (390), 50 jumelles
  (390 sombre), « pas encore lus » (390, 1512), « Achats pas lus » (390, 1512 sombre).
- Audits verts : recherche-unique 24/24 (8/8), recherche-universelle 65/65 (17/17),
  recherche-fiche 66/66, annuler-commandes, identite, variables, tdz, coherence,
  icones. `npm run build` vert.

## Ce qui reste

- Les e-mails restent cherchés côté base (moteur de l'écran E-mails, une requête par
  pause de frappe, 6 nov.) — inchangé : ce n'est pas une requête nouvelle.
- « MR7000 » (un suivi PARTIEL à lettres) est encore lu comme un N° à lettres :
  « Tout sur le N°MR7000 — jamais servi » et ses actions s'affichent au-dessus des
  Retraits. Pas touché (règle `lireNumeroCherche` du N°, à trancher : une série à
  lettres de plus de 1 lettre est-elle possible ?).
- Pendant la lecture, un nombre long (« 482913 ») montre « Tout sur le N°482913 —
  jamais servi » jusqu'à ce que les colis soient lus (la phrase « pas encore lus » le
  dit à côté).

## Geste de Julien

Aucun. Essayer : ⌘K puis un n° de suivi recopié avec espaces ; un code de retrait puis
Entrée ; « nike dunk » (aucune tête).
