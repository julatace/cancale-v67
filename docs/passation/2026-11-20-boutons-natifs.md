# 20 nov. — Des boutons beaux et fiables partout (branche `claude/boutons-natifs`)

Julien, 20 nov. : « c'est vraiment parfait pour le téléphone […] il reste pas mal de choses qui ne font pas qualitatif et
pas fiable : des boutons pas très beaux, améliore ça ».

## 1. Mesurer d'abord — le banc `scripts/bancs/boutons-inventaire.cjs`

Le vrai `dist/`, base inventée (`ecrans-verre-2.baseFiches()`), garde réseau. Il ouvre Aujourd'hui (+ Personnaliser),
Annonces, Ventes, Achats, Argent, Messages, E-mails, Stock, Paramètres et 4 à 5 sous-pages, la fiche d'un article,
Automatisations, Extension, Compléter, Relier mes annonces, Publier sur…, Changer le prix — 390 tactile et 1512, clair et
sombre — et relève chaque touchable de l'écran (la coque native n'est pas comptée) : origine (natif `Bouton`, autre pièce
native, `.sb-*`, `.vrm-b*`, `.v2*`, autre classe d'avant, brut avec styles en ligne, brut) et défauts D1 cible < 44 (32
souris) · D2 rayon · D3 graisse · D4 contraste (fond effectif) · D5 texte coupé · D6 icône désalignée · D7 gris d'une
règle globale · D8 focus invisible · D9 indisponible muet · D10 lien souligné · D11 deux pleins · D12 taille de texte ·
D13 style en ligne. Une RANGÉE (toute la largeur de sa liste) est comptée à part et n'est jugée que sur D1, D4, D8, D9.

```bash
BANC_DIST=<build> SORTIE=<dossier> LARGEURS=390 THEMES=clair node scripts/bancs/boutons-inventaire.cjs   # < 15 min par passage
node scripts/bancs/boutons-inventaire.cjs --fusion d1 d2 d3 d4          # un tableau + la planche des pires cas
node scripts/bancs/boutons-inventaire.cjs --avant-apres avant… -- après…  # planche avant / après 390 et 1512
MUTATION=focus|cible …                                                   # le défaut correspondant monte (prouvé)
```
⚠️ Le banc recharge la page une fois (comme fiche-directe) : sans ce rechargement, la coque montre encore « Ma journée »
d'avant au lieu d'« Aujourd'hui » (mesuré : 37 boutons d'avant au lieu de 0).

## 2. Ce qui a été trouvé (avant, origin/main dd3336382)

Voir le tableau de §5. Les causes, par poids :
1. **Le pont `src/coque-native.css` effaçait le dessin des contrôles d'écran** posés dans une page poussée ou une feuille
   (`all: revert-layer` sur TOUT bouton) : le pavé de « Compléter » retombait en boutons gris du navigateur de 22 px.
   Il ne vise plus que les contrôles natifs (`n-…`, `nf-…`) et ceux sans classe.
2. **Quatre familles de boutons d'avant** (`BoutonBase`/`<Bouton>`/`Btn` d'App.jsx, `BoutonV2`, l'icône de `BarreOutils`,
   et 261 `<button className="vrm-b …">` bruts) avec leurs règles `!important` empilées.
3. Des puces-filtres faites main (Messages « Toutes · Offres · Non lues » en verre fumé, `SegmenteBase`, `SegmentV2`).
4. Des croix « × » et « ⋯ » dessinées au caractère, dont le « ⋯ » d'un achat à 32 px de large (règle v2 `!important`).
5. Des graisses 650 (rangées de Paramètres, Ventes verre).

## 3. Ce qui a changé

- `src/natif/Bouton.jsx` : **un geste à la fois** — `onClick` qui rend une promesse ⇒ « en cours » tout seul (roue,
  aria-busy), 2e toucher refusé par une garde synchrone (deux touchers dans la même image = un appel) ; la phrase rendue
  est dite sous le bouton 4 s ; un échec dit son message en ambre (`natif.bouton.echec` sinon). `useGesteUnique()`
  exporté. Ajouts : `taille="compact"` (32 souris / 44 doigt), `ton="ambre"`, `ajuste`, `bloc="contenu"` ;
  `BoutonIcone` : `raison`, `taille`, même garde.
- Les relais d'avant DESSINENT le natif : `BoutonBase` (primaire → plein · secondaire → teinte · discret → texte · danger →
  texte ambre ; petit → compact ; occupé → chargement ; disabled → indisponible, raison = `title` dite sous le bouton ; un
  style en ligne réduit à la mise en page, `styleDeMiseEnPage`), `Btn`, `BoutonV2`/`BoutonIconeV2`, l'icône de
  `BarreOutils` ; `SegmenteBase` et `SegmentV2` rendent le `Segmente` natif (aria-pressed / aria-selected gardés pour
  les bancs d'hier).
- 261 `<button className="vrm-b …">` bruts convertis en `<Bouton>` / `<BoutonBase>` (script, App.jsx 93, Reglages 41,
  Stock 13, FacturePro 26, InventaireStock 15, ParcoursArrivee 10, GuideDemarrage 10…).
- Croix « × » de 9 feuilles, « ⋯ », la clé et la sélection d'Achats, le micro, le scanner et la photo de la recherche,
  l'aide « ? », les retours de Paramètres, le retour d'un fil eBay ⇒ `BoutonIcone` natif (44). Gestes des bandeaux
  (« Gérer », « Choisir », « Voir », « Réessayer »), santé des comptes, « Les voir », « Retiré », « Tout voir », « Reçu »,
  « Délier » ⇒ `Bouton` texte natif. Automatisations : ✎ 🗑 ＋ (emojis) ⇒ glyphes de l'app, onglets ⇒ `Segmente`,
  « Réinitialiser » indisponible DIT pourquoi (`auto.reinit.rien`). Prix partout : « Annuler » en cours ⇒ chargement,
  les autres ⇒ indisponibles avec leur raison.
- Pont : `:is(#vrm-contenu, html) :is(.n-bouton, .n-bouton-icone-seule, .n-segmente, .n-segmente-choix)` rend chaque
  propriété de DESSIN aux couches (aucune valeur, aucun `!important`) — le natif garde sa forme dans les anciens écrans.
- Règles mortes retirées : `.v2b*`, `.v2-seg*` (5 feuilles), le dessin du « ⋯ » d'un achat (6 règles), `.vg-ms-vue`.
- Glyphes natifs : + `pencil`, `trash`, `plus`.

## 4. Les preuves

- `scripts/audit-boutons-natifs.cjs` (+ `--mutation`, 9 mutations, chacune rougit) : A fichiers propres sans `<button`
  brut ni classe d'avant (exceptions NOMMÉES : cellules de tableau, faits et photo de la fiche, rangées, menu « Choisir une
  action ») ; B les relais passent par le natif ; C garde synchrone, en cours, résultat, pas de `!important`, pont posé ;
  D aucun `<Bouton indisponible>` sans raison dans les fichiers propres ; E plafonds de `<button>` bruts (App.jsx 509 → 405,
  Reglages 84 → 41, Stock 66 → 53 : on les baisse, jamais l'inverse) ; F EXÉCUTÉ dans Chromium : double toucher = 1 appel,
  « en cours » pendant, résultat dit, échec dit, indisponible ne part pas et dit pourquoi.
- `audit-composants` mis à jour (BoutonBase et SegmenteBase rendent le natif).

## 5. Chiffres avant / après

(rempli à la fin du lot — voir le rapport)

## 6. Ce qui reste (honnête)

- ~405 `<button>` bruts dans App.jsx et ~300 ailleurs (Stock 53, Compta 60, Leboncoin 37, Republier 34…) : beaucoup sont
  des RANGÉES, des cases, des barres de graphique, des cellules ; les vrais boutons restants se convertissent au fil des
  lots (l'audit les empêche de remonter).
- Les règles `!important` d'avant sur des classes encore posées (`.vrm-aide-bouton`, `.vrm-ui-icone`…) peuvent encore
  peindre par-dessus le natif à certains endroits : le banc les montre (D2, D12).
- Les rangées de Messages (`vg-fil`) et de Paramètres (`vrm-set-ligne`) restent des rangées d'avant (pas des boutons) :
  leur passage en `Rangee` native est un autre lot.
- `K8b` (natif-coque, temps de style au retour sur un écran, base volume) est ROUGE aussi sur origin/main (90 ms avant,
  89–106 ms après sur cette machine chargée) : pas de ce lot.
