# 20 nov. 2026 — L'arrivée d'un achat : son N°, sa case, son étiquette (lot arrivee-scan)

Julien (20 nov., « fais 3 ») : « L'arrivée d'un achat guidée par le scan : tu scannes le code-barres de l'étiquette du
colis reçu, la paire est reconnue par son n° de suivi, l'app lui donne son N°, te dit dans quelle case la ranger, et
imprime l'étiquette si tu imprimes les tiennes. »
Précision transmise par le coordinateur : « l'app reçoit les mails avec les codes de retrait et les n° de suivi, c'est là
que l'app sait quel article est arrivé, parce qu'au préalable elle a capté le n° de suivi dans Vinted ». ⇒ **La porte
principale est « J'ai retiré »** ; le scan est un raccourci (« j'ai un colis en main, lequel est-ce ? », plusieurs colis
retirés d'un coup).

Branche `claude/arrivee-scan` (depuis `origin/main`), poussée à chaque commit, pas de PR ni de fusion.

## Ce qui existait (lu avant de coder) et ce qui est réutilisé tel quel
| besoin | existait | réutilisé |
|---|---|---|
| caméra, lecture, saisie | `ScannerRetrouver.jsx` (15–17 nov. : zxing-wasm dans un worker, BarcodeDetector, saisie) | tout ; un MODE `arrivee` ajouté |
| achat ⇐ n° de suivi | sources du scanner (`retrouverColis.js`), `retrouverParSuivi` (égalité exacte), `suivisAchat`, `achatDuColis`, `retraitsScannables` | tout ; `achatDuScan` ne garde que les ACHATS |
| N° | `preparerNumero` / `numerosEnSerie` / `prochainLibre` (servis relus, jamais un trou) ; `validerNumeroTape` (« je numérote moi-même », archive refusée) | tout |
| écriture | `opsRanger` (relit tout, refuse plutôt qu'écraser : N° pris, case prise, achat déjà rangé) ; pool append-only d'abord | tout, dans `ecrireArrivee` |
| case | `casesProposees` (src/ouRanger.js, la règle du Stock), `caseChoisie` | tout |
| meuble dessiné | `src/stockV2/MeubleDessin.jsx` (stock-etiquetage), case `is-vise` qui respire | tel quel |
| étiquette | `src/etiquetage/methode.js` (`methodeDe`), `impression.js` (`imprimerEtiquettes`) | tel quel |
| « J'ai retiré » | `markCollected` / `markPickupDone` ⇒ `apresRetraitAtelier` ⇒ `ouvrirAtelierArrivee` (événement `vrm:atelier-numeroter`) | l'événement ; ce qu'il OUVRE change |

## Ce qui change
1. **L'écran d'arrivée** (`src/ArriveeAchat.jsx`, chargé à la demande ; règle pure `src/arriveeAchat.js`) — une feuille
   style Paramètres (NATIF §1 bis) : l'achat (photo, titre, payé — « le reçu » ou « article seul, sans port ni frais »),
   « Dans ce colis : Contient 1 paire » (un lot : le nombre LU dans SA transaction, sinon « Combien de paires ? » −/+),
   « Son N° » (le prochain selon la méthode ; déjà donné ⇒ gardé ; « je numérote moi-même » ⇒ un champ par paire, ancien
   N° / N° pris refusés), « Sa case » (le meuble DESSINÉ, la case proposée qui respire « Ici », un toucher sur une autre case
   libre la choisit, onglets si plusieurs meubles), UN plein « Ranger ici » (« Ranger les 3 paires » ; sans meuble :
   « Donner ce N° »). Après : « Rangé · N°13 · Étagère A, rangée 1, colonne 3 », « Imprimer l'étiquette » (méthode
   imprimée, format choisi), « Scanner le suivant » (venu du scan) / « Achat suivant » (plusieurs retirés d'un coup) /
   « Terminer ».
2. **Une écriture, un « Annuler » 10 s** (`ecrireArrivee`, App.jsx) : N° servis RELUS (lecture ratée ⇒ rien), pool
   d'abord (append-only : un N° montré n'en ressort jamais, même après « Annuler »), puis en UN geste : la fiche liée à
   l'achat par SON n° de transaction, sa case, le prix du REÇU seulement (décision « 2 oui » ; l'article seul ou un lot ⇒
   aucun prix), et — ouvert depuis le scan sur un colis encore « à retirer » — le colis noté retiré par les MÊMES clés que
   « J'ai retiré » (`vrm_colis_collected`(+`_at`) pour un e-mail, `vinted_pickup_done` pour une commande).
3. **La porte principale** : l'événement de « J'ai retiré » (`vrm:atelier-numeroter`) ouvre maintenant l'écran
   d'arrivée de CET achat (`AtelierArriveeCoque`). L'atelier en six étapes d'avant reste pour la SUITE (photos, prix, fiche,
   publier : « N paires à finir », `vrm:atelier-arrivee`). Plusieurs achats d'un coup ⇒ l'un après l'autre.
   ⚠️ **Coordination `claude/retraits-visuel`** : je n'ai PAS touché à ses cartes. Son « J'ai retiré » appelle
   `markCollected` / `markPickupDone`, qui notent l'arrivée et lancent `ouvrirAtelierArrivee([entree])` ⇒ l'enchaînement
   vers l'écran d'arrivée se fait SEUL par cet événement, sans prop à ajouter. Si son lot remplace ces fonctions, il doit
   garder l'appel `apresRetraitAtelier(entree…)` (ou émettre `vrm:atelier-numeroter` avec `{ entrees: [entree] }`).
4. **Le scan, raccourci** : `ouvrirRetrouver(depuis, '', 'arrivee')` ⇒ le scanner en mode arrivée (titre « Arrivée d'un
   colis ») : `achatDuScan` — un achat ⇒ l'écran s'ouvre ; deux ⇒ la liste, SON toucher choisit ; un colis sans achat ⇒
   « Ce colis n'est relié à aucun achat » ; rien ⇒ « Aucun achat avec ce n° de suivi » ; les étiquettes de VENTES ne sont
   pas fouillées. Saisie du n° en secours (la même). Les achats lus suffisent (ventes/bordereaux pas lus n'attendent plus).
   Entrées : **Achats** (rond « Arrivée » à côté de « Scanner »), **Stock** (« Arrivés · à ranger » et « ⋯ » → « Arrivée
   d'un colis »), **la recherche** (action « Arrivée d'un colis », aussi sur le champ vide).
5. **« Arrivés · à ranger »** : Stock (`src/ArrivesARanger.jsx`, au-dessus de « À ranger ») et Aujourd'hui (la carte
   existante, renommée « N arrivés à ranger »). `arrivesARanger` : un achat rangé (une fiche porte SON n° de transaction)
   n'y est plus ; fiches pas lues ⇒ rien (pas « rien à ranger »). Rouvrir un achat rangé ⇒ « Déjà rangé · N°13 ».
6. **Hors ligne** : l'achat est reconnu sur les données en cache — les écrans ne relisant rien hors ligne, la coque garde à
   chaque lecture des sources un INDEX de l'appareil (`vrm_arrivee_index` : n° de suivi ⇒ l'entrée de l'achat, 400 au plus),
   consulté par le scanner de l'arrivée SEULEMENT quand `navigator.onLine` est faux (même égalité exacte du n°) ; le N° n'est PAS donné (les N° servis ne peuvent pas être
   relus — un N° donné hors ligne pourrait l'être aussi sur un autre appareil) : « Hors ligne : le N° attend le réseau » ;
   « Noter l'arrivée » note l'achat (Arrivés · à ranger) et met le retrait dans la file d'envoi existante ; au retour du
   réseau l'écran se relit seul.

## Décisions prises seul
- Le N° ne se donne jamais hors ligne (voir 6) : Julien demandait « l'écriture attend le réseau » ; donner un N° sans
  relire les servis contredit « un N° jamais réattribué ».
- Un lot : les N° se donnent en une fois (13, 14, 15, une case différente chacun, touchés un par un pour changer la case),
  un seul « Ranger les N paires » — 2 touchers au lieu de 2 par paire. Chaque paire garde SA ligne (photo du lot, titre lu).
- Le prix payé n'est écrit que s'il vient du reçu de CET achat (décision du 19 nov.) ; l'article seul est montré, dit,
  jamais écrit.
- « Scanner le suivant » n'est proposé qu'après un scan (après « J'ai retiré » : « Terminer », ou « Achat suivant »).

## Preuves
- `node scripts/audit-arrivee-scan.cjs` : **43 verts** (S scan ⇒ achat sur 50 identiques, QR Mondial Relay, vente au même n°
  écartée, colis sans achat, deux achats ⇒ question, titre ne relie rien ; N déjà rangé / déjà numéroté / pas lu, la VRAIE
  `prochainLibre` extraite d'App.jsx : 13 jamais le trou 5, lot 13·14·15, série « C » ⇒ C3, N° servi entre-temps refusé,
  achat rangé deux fois refusé, B230 refusé ; prix du reçu seul ; C cases distinctes, case prise refusée ; R ; E ; B
  branchements). `--prouve` : **15/15 mutations rouges**. Sur l'arbre d'avant (`git archive origin/main`) : rouge (C0).
- Banc `scripts/bancs/arrivee-scan.cjs` (390 tactile clair/sombre, 1512 clair/sombre, base de volume de 50 achats
  identiques + lot + doublon, base VIDE) : caméra SIMULÉE (un QR Mondial Relay dessiné dans le flux vidéo, lu par le vrai
  lecteur WebAssembly). Résultats : voir le rapport du lot.
- Audits verts : traduction, tdz, variables, quoi-de-neuf, identite, icones.

## Reste / limites
- Le banc `scripts/bancs/atelier-arrivee.cjs` attend l'ATELIER après « J'ai retiré » (W1–W2) : c'est maintenant l'écran
  d'arrivée (voulu). L'atelier se rouvre par « N paires à finir » ; le banc est à réécrire sur ce départ.
- `MeubleDessin` (lot stock-etiquetage) coupe « B230 » dans une case étroite au téléphone (« B23… ») — vu sur la capture,
  pas de ce lot.
- Leboncoin / Vestiaire / eBay : leurs achats ne portent aucun n° de suivi chez VRM (mesuré le 16 nov.) ⇒ « aucun achat ».
- Geste de Julien : aucun (essayer « J'ai retiré » sur un colis, puis le rond « Arrivée » d'Achats sur un colis en main).
