# 14 nov. — Design : la passe, seconde moitié (les écrans que la première n'a pas mesurés)

Suite de `2026-11-14-design-passe.md` (Ma journée, Ventes, Colis, Annonces, Stock, Argent, Paramètres,
loupe, fiche). Julien : « belle, cohérente, simple ». Branche `claude/design-passe-2` (depuis `origin/main`
95b15cbe, PR #1155 comprise), poussée à chaque étape, **pas de PR**. Aucune donnée réelle : base INVENTÉE
(`_base-volume.cjs`) + des lignes eBay / Leboncoin / Vestiaire inventées aux formes de `ebay-lbc-visuel.cjs`
et `vestiaire-fiches.cjs`, une boîte E-mails inventée à la forme de `boite-emails.cjs` ; garde réseau.
Rien dans `vinted-sync-extension/`, aucune migration, aucune fonction `api/`.

**Forme seulement** : aucune règle métier, aucun chiffre, aucun `data-*` retiré, aucun geste. Aucune chaîne
visible ajoutée hors la ligne de « Quoi de neuf » (le seul texte changé : la pastille du N° de la loupe
écrit « N°125 » au lieu de « #125 », la notation du N° partout ailleurs).

## 1. Le banc — `scripts/bancs/design-passe-2.cjs` (neuf)

La MÊME mesure que `design-passe.cjs` (sa fonction `mesurer`, exportée — rien de recopié) : A cibles 44 doigt
/ 36 souris · B graisses 400/600/700 · C tailles de l'échelle · D gris du système · E contraste ≥ 4,5:1 ·
F mots coupés · G carte MFA · H violet / Chronopost jaune · I chiffres rognés, **+ J** : une rangée de la
loupe trouvée par son N° n'écrit ce N° qu'une fois. Sur :

- `messages`, `emails` (boîte servie), `achats` ;
- `ebay-annonces`, `ebay-ventes`, `leboncoin-annonces`, `leboncoin-ventes`, `vestiaire-annonces`,
  `vestiaire-ventes`, `vestiaire-messages` (`?tab=…&site=…`) ;
- `reglages-<sous-page>` : 15 sous-pages (toutvabien, connexions, securite-comptes, vacances, push, rappels,
  numeros, modeles, imprimante, regime, langue, apparence, widget, appareils, double — `SOUS=` pour d'autres) ;
- `feuilles` : la confirmation « Se déconnecter partout ? » (portail `Z_CONFIRMATION`), « Signaler un
  problème » (`SheetShell`), le menu « Plus » du téléphone ;
- `connexion` (`/?connexion`, sans session), `accueil` (`/`, sans session : ses titres de vitrine 40–76 px
  restent hors de C, le texte courant ≤ 20 px y est jugé), `exemple` (`/?exemple`, bandeau compris) ;
- `demarrage` (la carte « Démarrer avec VRM · 1 sur 3 » d'un compte NEUF) et `parcours` (l'écran plein) ;
- `loupe` (« 5 » tapé).

390 tactile ET 1512, clair ET sombre, deviceScaleFactor 1 ; `SUITE=2` pour des captures défilées.
`design-passe.cjs` gagne trois réglages de mesure (ils valent aussi pour la première passe, toujours verte) :
la palette des gris suit le FOND effectif (un texte sur le panneau sombre de la connexion, au jour, se lit avec
la palette de la nuit) ; un texte de couleur transparente (le « — » sous le dessin d'une photo absente) n'est
ni un gris ni un contraste ; le grand chiffre que `ajusterChiffre` resserre pour tenir (« au moins 87,65 € » :
38 px posés en ligne) est admis entre 22 et 44, comme celui de Ma journée.

## 2. Avant / après

| mesure | avant (origin/main, 390 + 1512) | après |
|---|---|---|
| cibles sous 44 / 36 | 50 (pastilles E-mails 26, « Relier » Leboncoin 34, `<select>` 20, « Mot de passe oublié ? » 32, replis 18–35) | 0 |
| graisses hors 400/600/700 | 20 (connexion, accueil : le 500) | 0 |
| tailles hors échelle | 1 252 (Achats 16 / 12,5 / 18, E-mails 14 / 16 / 26, rangées iOS 16, accueil 14 / 16 / 19, démarrage 14…) | 0 |
| gris écrits à la main | 119 (accueil #A1A1A6, connexion #D1D1D6, « — » transparent) | 0 |
| contraste < 4,5:1 | 275 (« ⋯ » d'Achats 4,4, bleu #0071E3 la nuit 3,6, lien mail 4,2, comptes de filtre 3,9–4,2, note #88888D 3,1) | 0 |
| mots coupés | 2 (« Gel- / 1130 » sur eBay) | 0 |
| N° écrit deux fois (J) | 48 (« #125 … N°125 ») | 0 |
| **total** | **1 766 défauts, 87 rendus rouges sur 134** | **0, 134 rendus verts** |

Preuves : avant = `dist` d'`origin/main` construit à part ; après = 390 et 1512 lancés séparément (< 9 min
chacun), 68 + 66 rendus verts, après le vrai `git merge origin/main` (déjà à jour). **Mutation** : la pastille
du N° remise et la règle du compte de filtre retirée (build à part) ⇒ ROUGE (`numDouble` 12, « 4 » 4,2:1).
`design-passe.cjs` (la première passe) reste VERT à 390 et à 1512 (36 rendus).

## 3. Ce qui change (et ce que les captures ont montré que les mesures ne voyaient pas)

**Vu à l'œil, corrigé**
- **Achats · À retirer : une carte dans une carte.** `.vrm-rp` est AUSSI la carte du programme de Republier
  (`repub-programme.css` : bord 1 px, rayon 12, intérieur 12) ; la liste des retraits la recevait par collision
  de nom. La liste redevient un contenant, les points sont les cartes (`styles-systeme.css` §2.11).
- **« Réglages eBay » : le titre dans un cadre, la liste dans un second.** `GroupeIos` (titre + `.vrm-ios-carte`)
  était listé comme surface au §2.2 : la SECTION devenait la carte. C'est maintenant `.vrm-ios-carte` (vaut
  pour tous les groupes de Réglages d'iOS).
- **Leboncoin à l'ordinateur** : le contenu dans une colonne de 920 px centrée (rien ne s'alignait avec le titre)
  ⇒ la colonne de la page ; « Publier sur Leboncoin » bord à bord au téléphone ⇒ dans la marge ; « Republier » et
  « Baisser le prix » : deux cartes et deux gestes du système (l'un encadré 13 px, l'autre capsule 15 px) ; la
  recherche de « Mes annonces » = la capsule remplie ; la section « Mes annonces », transparente, portait une
  ombre qui dessinait un cadre vide autour de « Données » ⇒ plus d'ombre.
- **Vestiaire** : « Publier sur Vestiaire » rentrée de 8 px par rapport à la carte du dessous ⇒ alignée.
- **Sous-pages de Paramètres** (« Notifications du téléphone »…) : les cartes écrites en ligne (cadre 1 px,
  rayon 12) ⇒ cartes du système ; une carte dans une carte ⇒ une case.
- **E-mails à l'ordinateur** : titre 26 ⇒ 28 (le système), le segmenté collé à la phrase ⇒ 12 px de part et
  d'autre ; pastilles, recherche, gestes à 36 px et en capsule (26–30 px, rayon 7–8 avant).
- **La confirmation** : « Se déconnecter / partout » sur deux lignes à 390 ⇒ une ligne.
- **La carte « Démarrer avec VRM »** : « Importer mon stock » et « Voir VRM avec des exemples » rentrés de 8 px
  sous leur phrase ⇒ alignés sur le texte.
- **Connexion** : la carte et les boutons (rayon 14 / 12 encadrés) ⇒ carte 20 sans cadre, boutons en capsule.

**Mesuré, corrigé** (à la source quand la règle y vit, sinon `styles-systeme.css` §2.11)
- Achats : titre et montant 15/600, pastille d'état 12/600 (12,5), chevron 17, « ⋯ » à l'encre, « Reçus
  d'achat par e-mail » 36/44 px.
- E-mails (`boite-emails.css`) : tailles 14/16 ⇒ 13/15/17 ; feuille de lecture 22/36/16 ⇒ 20/34/15–17 ; le
  compte d'un filtre choisi à l'encre.
- eBay : rangées de Réglages 17 ; « Gel-1130 » insécable (`motsInsecables`) ; compte du filtre choisi à l'encre.
- Leboncoin : « Relier », « Pas d'article à relier » (gris sur gris 4,4:1 ⇒ encre), « Un problème de
  synchronisation Leboncoin ? » à la hauteur d'un contrôle.
- Paramètres : retour 17 / 15, initiales 13, tableau de « Sécurité des comptes » 13, « Aucun rappel » 13,
  `<select>` du résumé du soir 36/44, « Ce que tu reçois sur ton téléphone » 36/44, lien « À faire sur le
  site ↗ » de Mode vacances en texte bleu (`--d-accent-texte`, 3,6:1 la nuit avant).
- Feuilles : le lien mail de « Signaler un problème » en texte bleu (4,2:1 avant).
- Connexion (styles en ligne d'`AuthScreen`) : 500 ⇒ 400/600, « Mot de passe oublié ? » 13/600 et 44 px,
  « Afficher » et liens en `accentTexte`, titre ≤ 44, points de la marque #98989D (plus #D1D1D6).
- Accueil (`Accueil.jsx`) : 14 / 16 / 18 / 19 ⇒ 15 / 17 / 20 ; le 500 du lien ⇒ 400 ; gris nuit #A1A1A6 ⇒ #98989D.
- Démarrage (`parcours-arrivee.css`) : 14 ⇒ 13 (notes, repli) / 15 (liste) ; bandeau d'exemple 14/700 ⇒ 15/600.
- Messages : « Lis-la et réponds-y depuis VRM. » LE gris plein (80 % d'opacité, 3,1:1 avant).

**La loupe** (`App.jsx`, rangée de résultat) : une rangée trouvée PAR son N° écrivait le N° deux fois
(« #125 » à gauche, « N°125 » à droite). La pastille de gauche dit « N°125 » (la notation de l'app) et la
pastille de droite n'est plus posée quand le N° est déjà écrit sur la rangée (pastille ou ligne d'info). Les
autres pastilles (pseudo, suivi, code, montant…) ne changent pas ; `audit-recherche-universelle` 65/65 vert.

## 4. Vérifications

- `npm run build` vert ; audits `traduction` (45), `tdz`, `icones`, `coherence`, `variables`, `composants`,
  `violet`, `rouge-doublon`, `quoi-de-neuf` verts ; les audits qui lisent un fichier touché (`boite-emails`,
  `accueil-navigateurs`, `accueil-demo`, `lbc-catalogue`, `recherche-universelle`, `boutons`, `mode-exemple`,
  `parcours-arrivee`, `premieres-minutes`, `plans-solo-pro`, `confiance(-publique)`, `textes-courts`… 33 en tout)
  verts, sauf trois rouges IDENTIQUES sur main (récit de la première passe) : `signalement` (« parrainage »),
  `stockage-sur` (clés d'index de `ComptesVinted.jsx`, `EcrireSupport.jsx`), `vocabulaire-article`
  (`aideVideos.js`, `Stock.jsx`).
- Captures REGARDÉES (390 tactile et 1512, clair et sombre, défilées) : E-mails, Achats, eBay (annonces,
  réglages), Leboncoin, Vestiaire (annonces, ventes), sous-pages (sécurité, push, appareils), confirmation,
  menu « Plus », connexion, accueil, démarrage, parcours plein, loupe.
- Zips de `public/` : non touchés, non commités.

## 5. Ce qui reste

- Leboncoin à l'ordinateur : la bande « CA finalisé — · En attente — » (`details.vrm-platform-summary`, un
  intérieur droit de 303 px) flotte au milieu à droite ; à recomposer avec son écran.
- Paramètres → Notifications : deux `<select>` natifs (résumé du soir, avis négatif) et les jours calmes en
  rectangles encadrés — la règle 3 (« jamais un `<select>` nu ») demande un composant, pas une règle de style.
- Achats : la rangée d'un retrait garde une barre de délai vide (« Date limite inconnue ») et « Code sur
  Vinted » en 17/600 gris — le dessin de la ligne de retrait, à revoir avec Colis.
- La fraîcheur (« Tout est à jour · vérifié à l'instant ») reste une bande encadrée en tête de chaque écran.
- La carte du parcours plein écran garde un liseré la nuit (cadre sur #1C1C1E) ; non mesuré par le banc.
- Non mesurés : les autres sous-pages de Paramètres (≈ 25, `SOUS=` du banc), les feuilles d'Achats et de
  Ventes, la feuille de lecture d'un e-mail ouvert, Messages d'un fil ouvert.
