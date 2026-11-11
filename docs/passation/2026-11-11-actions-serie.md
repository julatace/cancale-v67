# 11 nov. — Sélectionner plusieurs lignes, agir une fois (lot actions-serie)

Branche `claude/actions-serie` (depuis `origin/main` fc3883d). Aucune PR, aucun merge dans
`main`, aucune écriture en base réelle. Principe de Julien : « surtout PRATIQUE : gagner du temps ».

## Ce qui existait (mesuré dans le code, pas dans les récits)

- **Annonces → Sélectionner** (chantier C, 5 nov.) : cases par compte, « Actions · N » →
  feuille `ActionsSelectionFeuille` (republier, prix mini, baisser le prix — ext. 5.336,
  plafond 45/h). **Inchangé** : vérifié qu'il marche toujours (aucun fichier de ce chemin touché).
- **« Tout imprimer »** (Colis) : le lot à cases (`lotSelection.js`, `batchBordereaux`).
- ⚠️ La passation finale du 10 nov. annonce « Ventes : sélection multiple » (lot X,
  `claude/lots-vues-panneau`) : **seuls les filtres enregistrés (`vuesVentes.js`) sont dans
  `main`** ; aucune sélection de lignes dans Ventes, ni appui long, ni Maj-clic nulle part.
  Il n'y avait donc pas de mécanisme commun à étendre : il est créé ici, UNE fois.

## Le mécanisme (un seul, partout)

- `src/selectionSerie.js` (pur, exécuté par l'audit) : `basculer`, `plage` (Maj-clic dans
  l'ORDRE AFFICHÉ, à rebours compris), `toutSelectionner` (le filtre courant),
  `garderVisibles` (une ligne qui sort du filtre sort de la sélection — une action ne part
  jamais sur une ligne qu'il ne voit pas), `trierSerie` (chaque ligne : faite ou « pas
  faite : SA raison » ; un geste **Vinted** ne prend que le plafond restant, **45/h** =
  50 − réserve 5, et un plafond **pas lu n'envoie rien**), `executerSerie` (une ligne à la
  fois, jamais en parallèle), `resumeSerie` (« 8 faits · 2 pas faits : pas au point relais » ;
  plusieurs raisons comptées chacune ; jamais « 0 pas fait »), `csvDe` (point-virgule, BOM).
- `src/composants/SelectionSerie.jsx` : `useSelectionSerie(ordre)`, `CaseSerie` (sur la
  vignette : les lignes en grille gardent leurs colonnes), `BarreSerie` (portail, au-dessus de
  la barre du bas au téléphone ; « N sélectionnés » · « Tout sélectionner · M » · « Annuler » ;
  le résumé reste 8 s, AU-DESSUS de la pilule « Annuler »), `OuvrirSerie` (« Sélectionner »),
  `avecSerie` (la ligne de vente porte déjà le glisser « déposé » : les deux gestionnaires
  passent, la sélection d'abord). Échap ferme (sauf si une feuille est ouverte : elle d'abord).
  Au doigt : **appui long 450 ms** (un déplacement de 8 px l'annule, le relâcher n'ouvre pas
  la ligne), puis un tap coche ; la case n'apparaît qu'en sélection. À la souris : la case
  attend, discrète, à 35 % (pleine au survol), Maj-clic = la plage.
- Au repos, les props d'une ligne sont gardées par clé : une ligne mémoïsée (e-mails) ne se
  redessine pas pour rien ; une ligne de vente (mémoïsée par `deps`) reçoit l'état coché dans
  ses `deps` (sinon cocher ne se voyait pas).

## Les actions — chacune = l'action unitaire, ligne par ligne

| écran | action | ce qu'elle écrit (la même chose que l'unitaire) | pas fait si… | Annuler |
|---|---|---|---|---|
| Achats | **Retiré** | `vinted_pickup_done[tx]` (« J'ai retiré ») | annulé · en retour · déjà retiré · pas au point relais (`st.step !== 3`) | UN geste (pilule) pour toute la série |
| Achats | **Relier** | rien : **désigner la paire reste SON tap** (§5) ; la série ouvre Annonces → « Sans achat relié » (une suggestion par annonce, « Relier · 32 € » en un tap) | annulé · déjà relié | — |
| Achats | **Exporter** | CSV (date, compte, article, N°, prix payé, état, n° de transaction) | — | — |
| Achats | **Masquer** | `vinted_purchases_hidden` (`masquerAchats`, chaque achat remis à SA place) | déjà masqué | UN geste |
| Ventes | **Imprimer** | le lot « Tout imprimer » (`batchBordereaux`, sa confirmation, son tampon) | annulée · déjà partie · pas de bordereau prêt | — (l'unitaire n'en a pas) |
| Ventes | **Je dépose** | `vinted_ship_done` + `vinted_bords_shipped` (`gesteColisFait`) | annulée · déjà déposée · pas à envoyer | UN geste |
| Ventes | **Exporter** | CSV des lignes cochées | — | — |
| Ventes | **Facture Pro** | `envoyerFacturesSerie` (FacturePro.jsx) : les gestes de « Tout envoyer » (émettre puis envoyer à SON acheteur prouvé), confirmation d'abord, 429/503 arrête | pas une vente Pro · pas prouvé · déjà envoyée · fiche incomplète | — (part chez un tiers : jamais d'« Annuler » menteur) |
| Stock | **Enlever du stock** | vendue ⇒ « Je l'ai sortie » (`vinted_pairs_lost`, from: stock) ; plus en ligne ⇒ « Je l'ai retirée » ; **une** écriture des cases (N appels de `retirerCase` s'écrasaient : seule la dernière partait) | case introuvable | — (l'unitaire n'en a pas) ; confirmation qui nomme les N° |
| Stock | **Exporter** | CSV (N°, article, état, meuble, rangée, colonne) | — | — |
| E-mails | **Lu / Non lu** | les gestes de la ligne `{k:'lu'|'nonlu', id, at}` en UNE écriture `ecrireLus` | déjà lu / déjà non lu | — (l'unitaire n'en a pas) |
| Annonces | (existant) | Sélectionner → Actions : inchangé | | |

**Messages Vinted (conversations)** : il n'existe AUCUN « lu / non lu » dans VRM (`c.unread`
est le drapeau de Vinted, en lecture seule ; marquer lu chez Vinted serait un geste Vinted que
l'extension ne sait pas faire). La sélection Lu / Non lu est donc posée sur la boîte
**E-mails**, le seul endroit où l'action unitaire existe. Ne pas inventer un « lu » Vinted.

**Gestes touchant Vinted** : aucune des nouvelles actions n'envoie quoi que ce soit à Vinted.
La règle est quand même dans le module (`trierSerie({ vinted:true, restant })`, audit R8–R10)
pour la prochaine action Vinted en série : jamais plus que le plafond restant, jamais plus vite.

## Les gestes comptés (avant → après, 10 lignes)

| tâche | avant | après |
|---|---|---|
| 10 achats au relais « retirés » | 10 taps « J'ai retiré » (un par colis) | 3 (appui long · Tout sélectionner · Retiré) si le filtre ne montre qu'eux ; sinon 1 + 9 taps + 1 = 11 — **aucun gain si on coche à la main** : la série gagne sur « tout le filtre » |
| 10 ventes « Je dépose » | 10 glisser (et chacun attend 5 s : un second écrit le premier tout de suite) | 3 |
| 10 achats masqués | 20 (⋯ puis Masquer) | 3 |
| 10 paires enlevées du stock | 10 | 4 (Sélectionner · Tout · Enlever · confirmer) |
| 10 e-mails lus | 10 (ouvrir chacun) | 3 |
| exporter 10 ventes précises | impossible (l'export prend tout) | 3 |

## Preuves

- `npm run build` vert.
- **`audit-actions-serie`** (neuf) : **30/30** ; `--prouve` **21/21 mutations rouges** (cocher,
  plage, ligne cachée, plafond pas lu, plafond 45, refus compté fait, résumé muet, parallèle,
  Retiré hors relais, Retiré en N gestes, Je dépose sur une finalisée / sans écriture, Imprimer
  muet, Masquer muet, Stock sans confirmation / N écritures, Lu muet, Facture sans
  confirmation / sans preuve, Échap, appui long). **Sur `origin/main` (arbre `git archive`) :
  0/15, rouge.** ⚠️ Défaut trouvé et corrigé en route : la première version sortait **verte et
  muette** sur main (l'exception du module absent était avalée) — l'audit sort maintenant rouge
  sur toute exception de la passe réelle.
- **Banc `scripts/bancs/actions-serie.cjs`** (données INVENTÉES, harnais `nouveau-vendeur`,
  port 9520, 390 tactile et 1512, clair et sombre) : **70 verts, 0 rouge** (A 34, V 20, G 16) —
  appui long (CDP, vrai toucher) ouvre la sélection, tap coche sans ouvrir le menu ; Maj-clic =
  la plage (3 lignes, les bonnes) ; Échap ferme ; Tout sélectionner = le filtre ; Retiré écrit
  les 3 colis au relais et PAS la finalisée, résumé « 3 retirés · 1 pas fait : … » ; la pilule
  « Annuler » défait les 3 d'un coup ; Je dépose écrit les 3 ventes à envoyer et pas la
  finalisée ; Exporter télécharge un CSV des N lignes ; ni débord, cibles 44 px, la barre
  au-dessus de la navigation du bas ; aucune erreur JS. **Sur le dist de `origin/main` : 26 verts, 44 rouges**
  (A 10/34, V 0/20 ; G 16/16 — la barre absente ne déborde pas). Captures regardées (hors dépôt) :
  `scratchpad/shots/serie-{390,1512}-{clair,sombre}-{achats,ventes}-{selection,resume}.png`.
- Audits demandés verts : `variables`, `tdz`, `coherence`, `identite`, `icones`,
  `textes-courts`, `fonctions-api`, `secrets`. Les 18 audits qui lisent les fichiers touchés :
  verts, sauf `photos-vinted` et `relier-compte`, **rouges à l'identique sur origin/main**
  (sortie comparée : seul un numéro de ligne bouge).

## Pas fait / à savoir

- Stock et E-mails n'ont pas de scène de banc (Stock demande des meubles et des cases, la boîte
  sa route serveur) : ils sont tenus par l'audit (B9–B11) et par le build, pas par un rendu.
- « Relier » en série ne relie rien tout seul (§5) : il amène à la file existante.
- La barre d'Achats et de Ventes vit dans la liste Vinted ; « Ventes · Tous les sites »
  (`VentesToutes`) n'a pas de sélection (lignes d'autres plateformes, autres gestes).
