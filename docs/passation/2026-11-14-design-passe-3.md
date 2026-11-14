# 14 nov. — Design : la passe 3 (les restes nommés par la passe 2)

Suite de `2026-11-14-design-passe.md` et `2026-11-14-design-passe-2.md` (§5 « Ce qui reste »). Julien : « belle,
cohérente, simple ». Branche `claude/design-passe-3` (depuis `origin/main` 63268bd9, PR #1155 et #1156 comprises),
poussée à chaque étape, **pas de PR**. Base INVENTÉE (`_base-volume.cjs` + les lignes eBay / Leboncoin / Vestiaire /
E-mails inventées de la passe 2), garde réseau. Rien dans `vinted-sync-extension/`, aucune migration, aucune fonction
`api/`, aucun zip de `public/`.

**Forme seulement** : aucune règle métier, aucun chiffre, aucun `data-*` retiré, aucun geste ajouté ni retiré. Deux
chaînes visibles neuves, par `tr()` dans les 5 langues : « Auto » (le défaut du résumé du soir) et son titre au survol
« 19 h l'hiver, 20 h l'été » (`reglages.push.soirAuto`, `reglages.push.soirAutoTitre`).

## 1. Le banc — `scripts/bancs/design-passe-3.cjs` (neuf)

La MÊME mesure que les deux premières passes — `mesurer` de `design-passe.cjs` (A–I) et la boucle de
`design-passe-2.cjs` (J), désormais exportée (`lancer(ECRANS, { cles, enPlus, api })` ; `design-passe-2` inchangé quand on
le lance seul) — **plus** huit mesures nées de ce que les captures de la passe 2 montraient sans qu'une mesure le voie :

| clé | ce qui est rouge |
|---|---|
| K `bande` | à l'ordinateur, la bande « CA finalisé — · En attente — » d'un site dont le bord gauche n'est pas celui du titre |
| L `natif` | un `<select>` NU (ni capsule, ni rempli) |
| M `rectangle` | un contrôle (≤ 52 × 260 px) qui porte sa surface (fond, cadre ou anneau intérieur) et n'est pas une capsule |
| N `barreVide` | une piste de délai dessinée quand le délai n'est pas su (« Date limite inconnue », « Vérification en cours »…) |
| O `grisGras` | un texte gris ≥ 15 px en 600/700 (un gris n'est jamais un titre) ; un texte recouvert par une photo n'est pas jugé |
| P `fraicheur` | la ligne de fraîcheur avec un fond, un cadre ou une ombre |
| Q `cadre` | une surface (≥ 120 × 40) bordée sur trois côtés ou plus, ou cerclée d'un liseré, hors d'une surface flottante |
| R `carteDansCarte` | une carte à ombre posée dans une autre carte à ombre posée |

Écrans (390 tactile ET 1512, clair ET sombre, deviceScaleFactor 1) : Ma journée, Ventes, Colis, Annonces, Stock,
Argent (la ligne de fraîcheur) · Leboncoin, eBay, Vestiaire (la bande) · Achats (la ligne de retrait, son détail
ouvert, le menu « ⋯ », la fenêtre « Note interne », la feuille d'aide) · Ventes (la feuille d'une vente, l'aide) · un
e-mail ouvert · un fil de Messages ouvert · **28 sous-pages de Paramètres** que la passe 2 n'avait pas mesurées
(Notifications d'abord ; `SOUS=`) · la carte de démarrage et le parcours plein écran. `ECRANS=` `LARGEURS=` `THEMES=`
`SOUS=` `BANC_DIST=` `SHOTS=` `SUITE=` comme la passe 2.

## 2. Avant / après

Le banc final, sur `dist` d'`origin/main` (63268bd9, construit à part) puis sur la branche (après le vrai
`git merge origin/main`, 9236d48b), quatre lancements séparés (< 9 min chacun), 48 rendus chacun :

| mesure | avant (390 + 1512, clair + sombre) | après |
|---|---|---|
| A cibles sous 44 / 36 | 6 (« Synchronisation par compte » 15 px, « Solde et paramètres » 31) | 0 |
| C tailles hors échelle | 480 (feuille d'aide 14/16, Ma journée 14/16, Historique, Santé des comptes, SMS, Siri, Importer, Corbeille 14) | 0 |
| E contraste < 4,5:1 | 20 (coche bleue de « Mes plateformes » 4,3, gris du fil sur le remplissage 4,4) | 0 |
| F mots coupés | 2 (« Enregi / strer » à 390) | 0 |
| K bande flottante | 4 (Leboncoin 977 px, eBay 1 091 px contre un titre à 288) | 0 |
| L `<select>` nu | 12 (résumé du soir, avis négatif, filtre de compte du Stock) | 0 |
| M rectangles | 192 (« Imprimer », « Générer le bordereau », jours calmes, « Conversation ↗ », croix…) | 0 |
| N barre vide | 244 (« Date limite inconnue » × 60 par rendu) | 0 |
| O gris gras | 428 (« Code sur Vinted » 15/600 × 60, initiales des acheteurs 20/600, « Masquer cet achat ») | 0 |
| P fraîcheur encadrée | 22 (le jour : l'ombre posée) | 0 |
| Q cadres | 114 (cartes des sous-pages, Leboncoin, historique, parcours la nuit, barre d'outils d'Annonces…) | 0 |
| R carte dans carte | 7 (billet d'un e-mail, sondes de Sécurité, « Données » eBay) | 0 |
| **total** | **1 531 défauts, 158 rendus rouges sur 192** | **0** (voir §4 pour le dernier) |

**Mutation** (build à part, depuis la branche) : la piste toujours dessinée (`sansBarre = false`) et les règles K
(bande) et P (fraîcheur) retirées de `styles-systeme.css` ⇒ ROUGE (`barreVide` 61, `bande` 1, `fraicheur` 3 sur
journee / leboncoin-annonces / achats à 1512).

## 3. Ce qui change

**Les cinq restes nommés**
1. **Leboncoin (et eBay) à l'ordinateur** : la bande des chiffres était la 2e colonne d'une grille dont la 1re (l'ancien
   titre) n'existe plus ⇒ elle flottait à 977 px. Elle prend la colonne, sous le titre (`styles-systeme.css` §2.12, K).
2. **Paramètres → Notifications** : « Résumé du soir » et « Avis négatif » sont des `Segmente` (« Auto · 18 h … 22 h »,
   « 1★ … 4★ »), comme « Regrouper » juste dessous — plus de `<select>` natif ; les jours calmes sont des capsules de
   filtre (remplies, l'actif à l'encre), plus des rectangles encadrés (`centre-notifs.css`). Le banc `centre-notifs`
   touche le segment au lieu de `selectOption` (même règle jugée : défaut, 18–22 h, 44 px, 22 h écrit, retour au défaut).
3. **Achats · la ligne de retrait** : sans délai CALCULÉ, `BarreDelai` ne dessine plus de piste (`barre: false`,
   `is-sans-barre`, la phrase seule ; la piste reste dans le DOM, masquée, pour les bancs qui la lisent) ; « Code sur
   Vinted » en 15/400 gris (plus 17/600). Même règle pour la barre du coût d'une vente : sans segment, rien
   (`CascadeVente.jsx`).
4. **La ligne de fraîcheur** : sans fond, cadre ni ombre (la règle des bandeaux du §2.2 lui donnait l'ombre posée), son
   point au bord de la colonne. Même sens, même texte, même geste.
5. **Le parcours plein écran** : la carte de l'étape (`.vrm-premiers-sans-cadre`, bord 1 px #38383A la nuit) est une
   carte du système ; la croix est un rond.

**Mesuré, corrigé (sous-pages, feuilles, fils)**
- Les cartes des sous-pages (`.vrm-set-carte`, bord 1 px écrit en ligne) ⇒ cartes du système ; « Ma journée » (des groupes
  DANS une carte) ⇒ la carte s'efface, les groupes sont les cartes ; « Mon historique » (une carte encadrée par compte) ⇒
  UN groupe à filets ; le mode stream : l'aperçu est une case.
- Tailles 14 / 16 ramenées à la source : `styles-import-depart.css`, `styles-sante-comptes.css`, `import-stock.css`,
  `sms-colis.css`, `styles-corbeille.css`, `aide-ecran.css` (la feuille d'aide : 16 ⇒ 17, l'étape 14 ⇒ 13).
- Gestes en capsule : « Imprimer », « Générer le bordereau » (`.vrm-rangee-bord`, rayon 12 dans fusion.css), les gestes
  du détail d'un retrait (« Conversation ↗ », `styles-retraits-clairs.css` : une forme, la capsule), « Réessayer » de
  Sécurité des comptes et de l'Agenda, Vestiaire (`bouton()` : principal ou secondaire), eBay (« Actualiser », « + Connecter
  un autre compte » ⇒ `Bouton`), la croix de la feuille d'une vente, « Ajouter » (photo du carton), les replis « Stock » /
  « Publier Leboncoin » d'Annonces au téléphone, le filtre de compte du Stock (un `<select>` qui reste, habillé en capsule).
- eBay (réglages) : les encarts dans la carte deviennent des cases ; « Solde et paramètres du compte » et « Synchronisation
  par compte » à la hauteur d'un contrôle. Cartes dans une carte ⇒ cases : l'état « pas su » dans Sécurité, « Données »
  dans la carte eBay, le billet du code dans la lecture d'un e-mail (ordinateur ; son bouton « copier » sur la carte).
- Leboncoin : « non reliées » et « à publier » sans cadre ; Annonces : la barre d'outils n'est plus une carte encadrée
  (« Outils » en débordait). « Reçus d'achat par e-mail » : une carte du système. « 69 bordereaux déjà traités » : une ligne.
- « Mes plateformes » : la coche et le « + » en texte bleu (4,3:1 avant) ; Messages : la conversation ouverte sur la case
  (le gris du fil tenait 4,4:1 sur le remplissage), l'initiale d'un acheteur sans photo à l'encre, la paire en tête d'un fil
  ouvert en carte du système, « Retirer » rempli sans anneau ; Achats · « ⋯ » : « Masquer cet achat » à l'encre ; la
  feuille d'une vente : « N° et frais » à l'encre.
- La fenêtre « Note interne » d'un achat (faite à la main : rayon 12, cadre, boutons-rectangles, titre 15/700) : carte 20
  sans cadre, l'ombre flottante, titre 20/700, note 13, `Bouton` discret et principal (`App.jsx`, mêmes textes, mêmes gestes).
- « Objectif du mois » : « Enregistrer » se coupait en « Enregi / strer » à 390 et était posé en `variante="principal"`
  (une variante qui n'existe pas : rendu secondaire) ⇒ `primaire`, sur une ligne.
- Les sous-pages au téléphone : la section des colis (Ventes · À expédier, Achats · À retirer) à 16 px du bord, comme le titre
  (14 en ligne) ; le retour d'une sous-page à l'ordinateur est un lien 15 (plus un rectangle encadré de 14, styles-bureau.css).
- La nuit, un gris du JOUR écrit en ligne (`C.muted` lu avant le thème sombre) devient le gris de la nuit.

**Vu à l'œil seulement (aucune mesure ne le voyait)**
- **La feuille d'une vente cachait l'écran** : son hôte plein écran (`.vrm-app-shell.vrm-ledger-drawer-host`, voulu
  transparent dans styles-gestion.css) recevait le fond d'app de `jetons.css` (plus spécifique) ⇒ à 390 comme à 1512,
  tout l'écran derrière la feuille devenait un aplat gris. Transparent à nouveau (§2.12).
- Ventes : la barre « L'argent » vide (piste grise sans segment) au-dessus des montants — retirée quand rien n'est su.

## 4. Vérifications

- `npm run build` vert ; audits `traduction` (45), `tdz`, `icones`, `coherence`, `variables`, `composants`, `violet`,
  `rouge-doublon`, `quoi-de-neuf`, `avis-negatif`, `boutons` (un rayon écrit `var(--d-r-carte)`, pas 20, pour garder
  l'échelle courte), `objectif-mois`, `retraits-irreprochables`, `sante-comptes`, `import-depart`, `corbeille`,
  `sms-colis`, `raccourcis-siri`, `journee-perso`, `textes-courts`, `comptes-securite` verts ; les ~70 audits qui lisent
  un fichier touché verts sauf trois rouges IDENTIQUES sur main (`photos-vinted`, `stockage-sur`, `vocabulaire-article`).
- Bancs voisins (fichiers touchés) : `retirer-carte-delai` (79/0), `retirer-ligne-unique`, `retirer-scene-julien`,
  `recap-vente` (80/0), `fraicheur-unique` verts. Rouges IDENTIQUES sur `origin/main` (même liste de ❌, lancés sur un
  arbre de main construit à part) : `centre-notifs` (F1 « huit types » — il y en a onze ; F11), `cout-vente` (« paires »
  / « articles »), `boite-emails` (4 : la marque de l'expéditeur), `colis-retirer-propre` (l'air de 15 px avant « argent »),
  `feuilles-coque` (16 : clics hors délai). Les C8 de `centre-notifs` (le choix au segmenté) verts.
- `design-passe.cjs` et `design-passe-2.cjs` relancés sur le build final (390 et 1512 séparés) : DPRES.
- Captures REGARDÉES (deviceScaleFactor 1, défilées `SUITE=1–2`) : Leboncoin (1512 clair/sombre), Notifications (390,
  1512), Achats et un retrait ouvert (390 clair/sombre, 1512), la feuille d'une vente (390, 1512 clair/sombre), un
  e-mail ouvert, un fil ouvert (390, 1512), Ma journée (réglage), Mon historique, Comptes eBay, Mes plateformes, Mode
  stream, Objectif du mois, Annonces (390), le parcours (390/1512 sombre).

## 5. Ce qui reste

- **Périmètre repris par d'autres agents (14 nov., en cours de passe)** : l'écran Achats (ligne de retrait comprise),
  la coque (barre du haut, ligne « Tout est à jour », pastille « Mis à jour à … ») et les listes. Ce qui est commité ici
  sur ces sujets (barre de délai, « Code sur Vinted », fraîcheur sans cadre, colis à 16 px, « ⋯ », note interne) reste ;
  rien de plus n'y a été touché. À regarder par eux : la ligne de fraîcheur s'aligne sur 16 px du bord de `.vrm-main`
  (bonne sur les écrans à titre de tâche, 16 px de trop sur E-mails dont le titre est au bord) ; « Lieu à confirmer »
  4 px plus à droite que « À retirer ».
- Mes plateformes : la tuile choisie porte un cadre et un fond bleus (l'état choisi d'iOS) — plus de bleu que « rare » ;
  à trancher.
- Mode équipe : y passer change le stockage lu par la page (le thème choisi revient au clair) — le banc la mesure en
  dernier ; non creusé (comportement de `choisirVueEquipe` ?).
- Non mesurés : les autres feuilles d'Achats et de Ventes (reçu, « revendu combien », passeport), un fil Vestiaire /
  Leboncoin ouvert, l'iPad.
