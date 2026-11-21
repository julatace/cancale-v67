# 10 novembre — Lot W : l'inventaire de fin d'année

Branche `claude/inventaire-annuel` (depuis `origin/main`). Validé par Julien (proposition 34) :
« paires présentes au 31/12 au prix d'achat, couverture dite ; export PDF/CSV ».
L'extension n'est pas touchée. Aucune migration, aucune fonction `api/`.

## Ce qu'il voit

Stock → sous « Valeur du stock », une rangée **« Inventaire de fin d'année › »** (DA6,
52 px). Elle ouvre une feuille :

- **Au [date]** : le 31 décembre de l'année par défaut (du 1er au 15 janvier : celui
  qui vient de passer). Sous la date, toujours : « Liste lue le 10/11/2026 à 15h30 » ;
  si la date choisie n'est pas le jour de la lecture : « …, pas le 31/12/2026 ». VRM ne
  sait pas reconstituer le stock d'un jour passé : il le DIT, jamais ne le prétend.
- **Valeur au prix d'achat** : « au moins 145,50 € », jauge, « sur 6 paires », « 2 sans
  prix › » (ambre, ouvre la saisie en série des prix — la porte du lot BF).
- **Dans tes cartons** : « — pas encore vérifié » puis « 2 trouvées sur 6 » ;
  « Je vérifie mes cartons » ouvre le mode inventaire existant (6 nov.) et, à sa
  fermeture, revient sur la fin d'année. Écarts : **Pas trouvées** (ambre), **Trouvées,
  pas dans la liste** (ambre ; « une lecture d'annonces manque : vérifie avant de
  conclure » si la liste est partielle), **Deux paires sous un même N°** (rouge, le seul),
  « N paires sans N° : impossible à cocher ». « Rien n'est changé dans VRM. »
- **Télécharger le PDF** / **CSV** : `inventaire-2026-12-31.pdf|csv` — titre daté, phrase
  de lecture, valeur avec « au moins » et couverture, une ligne par paire (N°, titre,
  compte, prix d'achat — vide/« - » si pas de prix, jamais 0 —, vérification), puis les N°
  trouvés hors liste. CSV : `;`, BOM, virgule décimale, formules neutralisées.
- **Les paires** : N°, titre, compte, prix (« — » sans prix), ✓ si trouvée (40 d'abord,
  « Voir les N »).

Dans le **mode inventaire** : un bouton **« Scanner »** ouvre la caméra du lot V
(`useLectureCamera`, BarcodeDetector sinon ZXing, rien n'est envoyé). Un code lu qui est
un N° (« 125 », « B125 », « N°125 ») ou le SKU eBay « VRM-125 » passe par la MÊME saisie
que le clavier (`valider`) ; tout autre code (bordereau, code-barres de la boîte) ⇒
« Pas un N° », rien compté.

## Les règles (une par notion)

- `src/inventaireAnnuel.js` (pur) : `listeInventaire` (les paires données, total =
  `valeurStock`, prix d'une ligne = `beneficePaire(...).achat`, même fiche), `ecartsInventaire`
  (N° seul, `cleNum` ; pas de session ⇒ `null`), `numeroDuScan`, `phraseDate`,
  `csvInventaire`, `pdfInventaire` (pdf-lib, multi-pages).
- **Un propriétaire** : le composant qui tient `annoncesPresentes` (App.jsx, à côté de
  `publierValeurStock`) publie `vrm_inventaire_annuel` (localStorage de l'appareil,
  estampillé du compte VRM, réécrit seulement s'il change) ; l'écran le LIT
  (`useInventaireAnnuel`). Jamais publié ⇒ « — · Annonces pas encore lues » + « Ouvrir
  Annonces ».
- Les N° vus : la session du mode inventaire (`vrm_inventaire`, copie de l'appareil
  fusionnée avec la ligne du nuage relue — `lireLigneInventaire`) ; la courante, sinon la
  dernière gardée. L'écran n'écrit RIEN (ni N°, ni fiche, ni ligne).
- ⚠️ Deux listes différentes, exprès : le mode inventaire juge contre `annoncesActuelles`
  (toutes plateformes, avec « pas su », « vendu à sortir ») ; la fin d'année compare à la
  liste VALORISÉE (`annoncesPresentes`, ce qui se déclare). Un écart de fin d'année se
  lit donc « dans la liste déclarée / pas dans la liste déclarée ».

Fichiers : `src/inventaireAnnuel.js`, `src/InventaireAnnuel.jsx`,
`src/styles-inventaire-annuel.css`, `src/InventaireStock.jsx` (scanner, +24 lignes),
`src/ecrans/Stock.jsx` (entrée + feuille), `src/App.jsx` (import + un effet de publication).

## Preuves

- `node scripts/audit-inventaire-annuel.cjs` : **37 verts** ; `--prouve` **12/12
  mutations** rouges (prix absent pris pour 0, identité par titre, pas vérifié ⇒ tout
  manque, sans N° compté « pas trouvé », caméra qui accepte tout code, date tue, formule
  CSV, « au moins » tu, second calcul dans l'écran, publication d'une autre liste, scan
  hors de la saisie, écart en rouge). Sur l'arbre d'`origin/main` (git archive) : rouge.
- Banc `scripts/bancs/inventaire-annuel.cjs` (données inventées, flux caméra factice de
  Chromium + BarcodeDetector inventé ; 390 tactile et 1512, clair et sombre) : **72 verts**.
  Sur `origin/main` il ne peut que rougir (ni publication ni entrée). Captures regardées :
  feuille, scan, écarts. Vu sur la capture : un code illisible long écrasait le retour du
  mode inventaire en colonne étroite ⇒ corrigé (sur toute la largeur, 20 car. au plus).
- Audits variables, tdz, coherence, identite, icones, inventaire (69/69), cout-vente
  (28/0) verts ; `npm run build` vert ; banc `inventaire` relancé.

## Reste

- Le stock d'un jour passé n'est pas reconstitué (dit à l'écran) : faire l'export le
  31 décembre.
- Les paires vues seulement sur eBay/Leboncoin/Vestiaire ne sont pas dans la liste
  valorisée (règle `annoncesPresentes`, comme la valeur du stock du lot BF).
