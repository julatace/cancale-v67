# 10 novembre 2026 — Lots BD (note privée d'une paire) et BH (achat saisi deux fois)

Branche `claude/note-achat-double` (pas de PR, pas de fusion : l'orchestrateur intègre).
Validé par Julien (file des lots, `docs/passation/2026-11-09-file-des-lots.md`, lignes BD et BH).

## BD — « Note privée sur une paire »

**Ce qu'il voit.** Une petite icône « note » (feuille à lignes, grise, discrète) sur
chaque carte d'annonce, dans la fiche paire (« Ajouter une note »), sur la ligne d'une
paire au Stock et sur l'écran « Préparer mes colis ». Un toucher ouvre la feuille de
saisie habituelle (« Note · N°8 — Toi seul la vois. Jamais envoyée sur Vinted ni
ailleurs. », 200 caractères au plus, une ligne). La note s'affiche ensuite en pastille
grise (neutre : ce n'est pas un geste à faire) partout où la paire apparaît :
Annonces, fiche paire, **Ventes** (sous la ligne de la vente), **Colis → Préparer** et
le **scan du bordereau** (pastille éclaircie sur le fond noir du scanner), **Stock**.
Toucher la pastille la modifie ; la vider l'efface. Pilule « Annuler » 5 s (lot B).

**L'identité (§5).** `src/notePaire.js` (pur) :
- la note se range sous `n:<cleNum>` (le N° de rangement : « 007 » = « 7 », « b125 » =
  « B125 ») ; sans N°, sous `a:<id d'annonce Vinted>` ; sans identité, **rien** (ni
  lecture ni écriture) — jamais le titre ;
- écrire sous le N° retire la note posée avant sur l'annonce (la même paire, numérotée
  depuis), sinon elle resterait cachée derrière ;
- **republication** : la reprise de N° (`src/repriseNumero.js`) donne le même N° à la
  nouvelle annonce, donc la note suit sans rien recopier ; sans N°, la note de
  l'annonce remplacée suit par `recreeDe` ;
- **N° porté par deux paires présentes** (`numerosAmbigus` : fiches de
  `vinted_annonce_numeros`, une chaîne `recreeDe`/`repriseDe` = une paire) ⇒ la note
  est **cachée** (« Note cachée · N°5 porté par deux paires ») : elle pourrait décrire
  l'autre. Mieux vaut un blanc qu'un faux. ⚠️ Faute de savoir au niveau de la coque
  quelles annonces sont présentes, toutes les fiches comptent (prudence : un ancien
  doublon fermé cache aussi la note de son N°).

**Rangement.** Clé synchronisée `vrm_notes_paires` de la ligne `main` (`SYNC_KEYS`,
`CLES_GESTES`) : `{ 'n:7': { t, at } }`. Écriture = `gesteVrm` (src/gesteAnnulable.js) →
`save` → `cloudPush` : lire-fusionner-réécrire sous-clé par sous-clé
(src/fusionNuage.js), comparer-et-échanger sur `data.rev`, une lecture ratée n'écrit
rien, file d'envoi si le réseau coupe. Pas de ligne dédiée : la ligne `main` porte déjà
exactement ces garanties (et deux appareils qui notent deux paires différentes gardent
les deux notes). **Jamais envoyée** : ni l'extension, ni `api/`, ni une description ne
la lisent (`audit-note-achat-double.cjs` §6 ; le banc guette toute requête hors
`app_data` qui porterait le texte).

**Code.** `src/notePaire.js` (règle), `src/NotePaire.jsx` + `src/styles-note-paire.css`
(forme), App.jsx : `NotePaireCoque` (un seul état pour toute l'app, `useSyncExternalStore`
sur `vrm:save` et la fusion), `editerNotePaire` (askText `max: 200`), insertions :
carte d'annonce (sous le titre), `LigneVenteCompacte` (`data-vente-notes`, les N° de la
vente), `FichePaire` (prop `note`), `PreparerColis` / `ScannerColis` (prop `note(c)`),
`ecrans/Stock.jsx` (ligne « Tes annonces actuelles »). `askText` accepte `max`
(maxLength).

## BH — « Achat saisi deux fois »

**Ce qu'il voit.** En haut de l'écran Achats, un widget (DA6) « ① Achat saisi deux
fois » — pastille ambre —, « Même n° 94000001 · garde le bon », puis les fiches **côte
à côte** (photo, nom, d'où : « Vinted · compte » ou le lieu, prix, date) et sous chacune
une pilule ambre **« Garder celle-ci »**. L'autre est masquée tout de suite (pilule
« Annuler » 5 s). En bas du widget : « 1 achat masqué comme double » → « Réafficher ».
« À trancher » (groupe Compta) compte la source `achats-doubles`, publiée par l'écran
Achats seulement quand les achats sont lus en entier (pas su ⇒ rien publié).

**L'identité (§5).** `src/achatsDoubles.js` (pur) : deux achats sont LE MÊME quand leurs
références sont identiques — le n° de transaction Vinted d'un achat lu, le **« N° de
commande ou de facture (facultatif) »** tapé sur un achat hors plateforme (champ ajouté
au formulaire, `ref`). Comparaison : majuscules, lettres et chiffres seulement, 6 signes
au moins (« 12 » n'est pas une identité ; « 9400 0001 » = « 94000001 »). **Jamais** le
titre, le prix, la date ni la photo : 50 achats identiques sans référence ⇒ aucun
doublon (`audit-identite.cjs` §16). Les achats Vinted entre eux sont déjà dédoublonnés
par n° au chargement : le cas réel est l'achat Vinted **aussi tapé à la main**, ou une
facture saisie deux fois.

**Masquer, jamais supprimer.** « Garder celle-ci » masque chacun des AUTRES :
- achat Vinted ⇒ `vinted_purchases_hidden` (le masquage existant, remis à SA place à
  l'annulation, réaffichable dans « Masqués ») ;
- achat hors plateforme ⇒ nouvelle clé synchronisée `vrm_achats_hors_masques`. Il sort
  de la liste et de **tous** les totaux : dans `Comptabilite` l'état complet s'appelle
  `offBuysTous` et `offBuys` est la liste SANS les masqués (dépensé, Fournisseurs,
  N° reliés, liste) ; Compta → registre des achats filtre aussi (`horsVisibles`).

## Preuves

- `npm run build` vert ; audits verts : variables, tdz, coherence, identite, icones,
  a-trancher, annuler-commandes, geste-annulable, fusion-nuage, file-envoi et les 28
  audits qui lisent les mêmes clés ou écrans.
- `scripts/audit-note-achat-double.cjs` (nouveau, 35 contrôles) : **10 rouges** sur
  `origin/main` (git archive) ; **mutations** : « rapprocher par titre » dans la règle
  des achats ⇒ 7 rouges (et `audit-identite` rouge) ; « rapprocher par titre » dans la
  note ⇒ rouge (et `audit-identite` rouge) ; Compta qui recompte les masqués ⇒ rouge.
- `scripts/bancs/note-achat-double.cjs` (nouveau ; 390 px tactile, 1512 px clair et
  sombre) : vert ; **18 rouges** sur `origin/main` ; la mutation « par titre » rougit le
  contrôle « trois achats identiques sans référence ». Captures regardées : carte
  d'annonce (pastille sous le titre, icône sur les autres), feuille de saisie, fiche
  paire, ligne de vente, widget des doubles en clair et en sombre (pilules ambre
  lisibles, fiches côte à côte même à 390 px).
- Bancs touchés relancés un à un : fiche-paire, preparer-relais, colis-scan,
  achats-hors-plateforme, a-trancher, stock-annonces, annuler-commandes,
  scanner-colis-achats, annonces-carte.

## Ce qui reste / limites

- Les anciens achats hors plateforme n'ont pas de référence : ils ne seront jamais vus
  comme doublons (voulu : pas de ressemblance). Le champ se remplit à la saisie ou en
  modifiant l'achat.
- Les achats Vestiaire / eBay lus par l'extension n'entrent pas (encore) dans la règle :
  il suffirait de les passer à `achatsComparables` avec leur n° de commande.
- Une note sur un N° porté par deux fiches (même fermées) reste cachée tant que le
  doublon existe dans `vinted_annonce_numeros`.
- Pas de note sur Leboncoin/eBay/Vestiaire hors N° (une annonce sans N° là-bas n'a pas
  d'identité commune avec VRM).
- Geste de Julien : aucun.
