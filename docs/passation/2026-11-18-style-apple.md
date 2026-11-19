# 18 nov. — Le style « Apple » (lot theme-apple)

**Demande.** Julien trouve le design « atroce ». L'app qu'il trouve belle sur iPhone : Apple (Wallet, Réglages).
Puis, le même jour : « arrête de faire les design sur canvas » — il veut juger DANS l'app, sur son iPhone, avec ses
vraies données. Donc : un vrai réglage, éteint par défaut, livré vite.

**Où le trouver.** Paramètres → Apparence et langue → Apparence → **Style** : « Apple » ou « Studio bleu » (celui
d'hier, le défaut). Le choix vit sur CET appareil (`vrm_style` dans le localStorage), comme « Ancien design ».

**Comment c'est fait (aucune règle d'écran ne change).**
- `src/designV2/style.js` : lit `vrm_style`, pose `data-theme-style="apple"` sur `<html>` à l'import ;
  `public/demarrage-theme.js` le pose AVANT le premier rendu (aucun éclair bleu). La barre d'état d'iOS prend
  #F2F2F7 / #000 (`theme-color`, aussi dans l'effet du thème de `src/App.jsx`).
- `src/designV2/theme-apple.css` : couche `vrm-apple`, nommée la PREMIÈRE dans `index.html` ⇒ ses `!important`
  passent devant le verre, la v2 et les styles en ligne. Elle change les JETONS (`--sv-*` du verre, `--sb-*` du
  studio, `--v2-*`, `--d-*`, `--sbp-*`, `--sj-*`, `--vv-*`, `--vj-*`) et quelques matières écrites à la main :
  - fond groupé #F2F2F7 (nuit #000), cartes #FFF (nuit #1C1C1E ; #2C2C2E dans une feuille), rayon 12, sans ombre ;
  - police du système, titre 34/700, titre de la tête 17/600 au défilement, en-têtes de section 13 px capitales grises ;
  - un bleu : #0068D6 le jour (le #007AFF d'iOS assombri : 5,3:1 sur le blanc, 4,8:1 sur #F2F2F7), #409CFF la nuit ;
    #007AFF / #0A84FF seulement pour ce qui n'est pas du texte (interrupteur, jour choisi) ;
  - gris secondaire #6C6C70 / #98989F (le #3C3C4399 d'iOS rendu lisible ≥ 4,5:1) ;
  - contrôles segmentés d'iOS (piste grise, pouce blanc et son ombre), y compris ceux écrits à la main
    (Ventes `.vv-seg`, Paires `.vrm-seg-plein`, Messages `.vg-ms-vues`) ;
  - les « pastilles fumées » du verre (fond rgb(10 38 76), texte blanc) : la liste est TIRÉE des feuilles de
    `src/design/` (section 14 du fichier) ;
  - passes Wallet : rayon 16, ombre douce ; l'étiquette N° kraft plus petite (20 px) et moins saturée ;
  - la barre d'onglets : seule matière translucide (blur 20 + saturate 180), actif en bleu, pastille ambre (§7).
- L'ambre reste le geste à faire, le rouge seulement deux paires sous un N°.

**Banc** `scripts/bancs/theme-apple.cjs` (base inventée) : 7 écrans × (390 jour, 390 nuit, 1512 jour) — aucun
dégradé bleu, contraste ≥ 4,5:1 (3:1 en gros) sur le fond effectif, un seul bouton principal, cibles ≥ 44 ;
le réglage touché tient au rechargement ; éteint : le dégradé d'hier est là et chaque règle de la couche est sous
`[data-theme-style="apple"]`. Mutations : `MUTATION=gris|degrade|deux|persiste|fuite`, chacune rougit son contrôle.

**Ce qui reste (à voir sur son iPhone).** Les écrans profonds (feuilles, fiche « Tout sur le N° », Messages) n'ont
été que balayés ; s'il garde le style, les règles d'écran écrites en blanc à la main ailleurs (`color: #FFFFFF`
dans `src/design/verre-*.css`) se rattrapent écran par écran, le banc nomme chacune.
