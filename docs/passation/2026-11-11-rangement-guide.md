# 11 nov. 2026 — Lot rangement-guide : ranger un achat à son arrivée

Branche `claude/rangement-guide` (depuis `origin/main` f04d4a58). Poussée à chaque commit. Pas de PR.

Demande validée par Julien (« ça doit être TRÈS bien fait ») : quand un achat est RETIRÉ ou reçu, une
feuille « Ranger cet achat » : la photo, le PROCHAIN N° (réservé au pool, jamais un trou, jamais un
ancien ; « Je numérote moi-même » ⇒ il le tape), une CASE LIBRE proposée (meuble · niveau · case, la
première libre à la suite de ses habitudes, une autre d'un toucher sur le plan), la fiche pré-remplie
depuis l'achat (titre, marque, taille, prix d'achat lu — modifiable), puis UN geste « Rangé » ; un lot de
N articles = N lignes, N° et cases consécutifs. Tout se défait 5 s. Rien sans son geste. L'identité de
l'achat (n° de transaction) liée à la fiche.

## Ce qui est livré

| point | où | comment |
|---|---|---|
| la règle (pure) | `src/rangementArrivee.js` | `numerosEnSerie` (LE `prochainLibre` d'App.jsx, passé en paramètre, sur une copie des N° servis ; un N° rendu déjà servi ⇒ `null`), `validerNumeroTape` (servi, « 012 » = « 12 », archive « B », doublon, servis pas lus ⇒ refus), `casesEnSerie` / `caseChoisie` / `caseProposable` (cases prises par n'importe quel N° même parti, meuble empilé : la plus basse libre seulement, plan pas lu ⇒ `null`), `caseHabitude` (la case du DERNIER rangement à l'arrivée ⇒ on continue après elle), `lignesDeLAchat`, `opsRanger` (relit tout et REFUSE plutôt que d'écraser), `achatsARanger`, `numerosAReserver` |
| la feuille | `src/RangerAchat.jsx`, `src/ranger-achat.css` | photo + prix lu ; une carte par ligne : N° en grand (accent sur la ligne choisie), la case en mots, Titre (pleine largeur), Marque, Taille, Prix d'achat ; le plan (onglets par meuble, cases 44 px : prise = son N° en gris, celle de la ligne = accent plein, autre ligne = accent léger, libre = pointillé, inaccessible (empilé) = estompée) ; « Rangé » / « Ranger les N », « Plus tard », « Pas à ranger ». Textes par `tr()` (5 langues, `ranger.*`), fichier ajouté aux écrans migrés de `audit-traduction` |
| lecture / écriture | `App.jsx` (`numerosServisRangement`, `preparerRangement`, `ecrireRangement`, `RangerAchatCoque`) | N° servis = pool + fiches + ventes + Leboncoin + fiches à publier + **N° notés dans une case** + hors écran + `panel_num_reserves` RELU (comme `dupliquerNumero`) ; version de numérotation vérifiée (`assurerVersionNumerotation`). « Rangé » : pool d'abord (`save('vinted_used_numeros')`), puis UN geste annulable (`gesteVrm`) : la fiche dans `vrm_fiches_neuves` (origine `arrivee`, `achat: { tx, site, suivi?, ligne/sur }`, `prixAchat`, `photoAchat`, `case`), la case dans `vrm_slots`, le coût dans `vinted_buyprice_by_num` (seulement si ce N° n'en a pas : il suit le N° quand l'annonce le portera) |
| déclencheurs | `App.jsx` (Comptabilite) | « J'ai retiré » d'un colis (e-mail ou commande Vinted) ⇒ la feuille, l'achat par IDENTITÉ (`achatDuColis` : n° de suivi / transaction) ; sans achat relié, la feuille part du colis (son n° de suivi, le titre de son e-mail, aucun prix). Au comptoir (scanner, mode relais) la feuille attend leur fermeture, puis montre les achats retirés en série. « J'ai retiré » en série / « Tout marquer retiré » ⇒ ils attendent dans Ma journée. Achat passé « arrivé » (la cloche « Où ranger ») ⇒ proposition aussi |
| Ma journée | job `achats-a-ranger` | « N achats à ranger · N° et case proposés, un geste » ⇒ « Ranger » ouvre la feuille sur eux, en série |
| la cloche | `CentreNotifsCoque` | « Ranger » ouvre la feuille sur CET achat (repli : la case dans le Stock, comme avant) ; un achat déjà rangé ne s'y propose plus ; les propositions gardent photo, prix lu, taille, lot |
| le Stock | `src/stockAnnonces.js` (`classerRangees`, état `arrivee`), `src/ecrans/Stock.jsx` | un N° rangé à l'arrivée et pas encore publié est montré dans SA case (titre et photo de l'achat), « Rangé à l'arrivée — pas encore en ligne » ; ni « plus en ligne », ni « pas su » |
| N° servis partout | `ajouterNumerosHorsEcran` | les fiches à publier (`vrm_fiches_neuves`) comptent comme servies dans tous les calculs du prochain N° |
| Quoi de neuf | `src/nouveautes.js` | « Un achat retiré, rangé en un geste » |

## Décisions prises seul

- **« Annuler » ne rend pas le N°.** Le N° montré à « Rangé » entre au pool À CE GESTE et y reste : il
  a pu être écrit sur le carton pendant que la feuille était ouverte (§5 : un trou peut être écrit sur un
  carton), et la base refuse un pool qui rétrécit (`vrm_pool_retreci`). « Annuler » défait la fiche, la
  case et le coût ; la feuille suivante propose le N° d'après (banc R4/R5). Cela évite aussi la course
  avec une annonce numérotée pendant les 5 s.
- **« Niveau » = la rangée comptée depuis le HAUT**, comme la règle dessinée du Stock (son chiffre à
  gauche) ; « case » = la colonne. Les mots du Stock (« rangée, colonne ») ne changent pas.
- **« Ses habitudes »** = la case de son dernier rangement à l'arrivée : on propose la suivante libre
  dans ce meuble (puis son début, puis les autres meubles) ; sans habitude, la règle de « Où ranger ».
- **Lot** : N vient de `items_count` lu, sinon « Lot de N » du titre, sinon il le choisit (− / +, 2 par
  défaut, dit « Combien d'articles dans ce lot ? »). Les lignes d'un lot sans détail lu restent vides
  (le titre du lot en indication) ; le prix du lot n'est JAMAIS divisé tout seul (« ≈ 20 » en indication).
- **Au comptoir** (scanner, mode relais), la feuille ne s'ouvre pas par-dessus : elle attend qu'il les
  ferme. « Je dépose » (une VENTE déposée) n'est pas un achat : rien à ranger.
- **Sans meuble** : la fiche et le N° se font quand même, « Sans case » est dit ; plein : « plus de case libre ».
- La liste des achats à ranger reste locale à l'appareil (`vrm_ranger_proposes`, celle de la cloche) ;
  elle s'éteint à « Rangé » (une fiche porte le n° de transaction), « Pas à ranger » ou 14 jours.

## Preuves

- `npm run build` vert.
- `node scripts/audit-rangement-guide.cjs --prouve` : **41 verts** ; sur `origin/main` rouge (module
  absent) ; **12/12 mutations rouges** : prochainLibre qui comble les trous, garde du N° servi retirée,
  N° tapé servi accepté, archive « B » acceptée, « Rangé » qui écrase un N° servi, case prise proposée,
  gravité ignorée, habitude ignorée, prix de lot divisé, identité de l'achat perdue, achat rangé deux
  fois, pool mis dans le geste annulable.
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api, secrets,
  quoi-de-neuf, traduction, stock-2d, stock-juste, vague3-ecrans. `audit-coque-parametres` : 1 rouge
  (icônes de Paramètres), **le même sur `origin/main`**, hors lot.
- Banc `scripts/bancs/rangement-guide.cjs` (données inventées, 390 tactile clair et 1512 sombre) : voir
  « ÉTAT À LA REPRISE ».

## Ce qui reste / limites

- **Publier l'annonce avec CE N°** : quand il mettra la paire en ligne, une annonce sans N° reçoit le
  prochain N° (règle d'avant) — rien ne relie la nouvelle annonce à la fiche sans SON geste (identité,
  §5). En « Je numérote moi-même », le N° écrit dans la description est lu et la fiche sort d'« À
  publier ». Sinon, il pose le N° de la fiche sur l'annonce (Annonces, « N° déjà servi »). À construire :
  « Publier cette fiche » qui réserve CE N° à côté de « Publier » (extension).
- Annuler « J'ai retiré » ne retire pas la proposition (elle reste jusqu'à « Pas à ranger » ou 14 j).
- Les achats Leboncoin / Vestiaire retirés ouvrent la feuille depuis le colis (titre et photo du colis),
  sans n° de transaction de la plateforme.

Geste de Julien : aucun.
