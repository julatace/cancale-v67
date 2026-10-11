# Page d'accueil de VRM : ce qu'on retient des meilleurs

Recherche du 11 octobre 2026, pour refaire `src/Accueil.jsx`. Principes à
appliquer à VRM, chacun avec l'exemple qui l'illustre. En fin de fichier :
5 erreurs à éviter et ce qui change sur la page actuelle.

---

## ⚠️ Ce que j'ai pu voir, et ce que je n'ai PAS pu voir

**Aucune des pages d'accueil demandées n'a pu être ouverte depuis ce conteneur.**
Le proxy de sortie répond **403** sur : linear.app, stripe.com, raycast.com,
vercel.com, arc.net, notion.com, framer.com, attio.com, superhuman.com,
vendoo.co, listperfectly.com, crosslist.com, vinteer.io, shopify.com. Les sites
qui décrivent ces pages sont bloqués aussi : web.archive.org, nngroup.com,
css-tricks.com, medium.com, wikipedia, awwwards, lapa.ninja, land-book. L'outil
WebFetch ne résout aucun nom de domaine (`ENOTFOUND`).
⇒ **Je n'ai vu aucune de ces pages rendue, aucune animation, aucune durée.** Je
ne décris donc aucun mouvement « vu ». Les durées et les courbes données plus
bas viennent des compétences `emil-design-eng`, `animate` et `apple-design` du
dépôt, pas de ces sites.

Ce que j'ai pu lire, et le niveau de confiance que j'y mets :

- **[R] Résultats du moteur de recherche.** Ils citent la page elle-même, une
  fiche officielle (Product Hunt, la documentation du site) ou une analyse
  tierce. Ce sont des extraits, pas la page. Le texte d'un titre peut avoir
  changé depuis.
- **[D] Fiches `DESIGN.md` communautaires** du dépôt public
  `VoltAgent/awesome-design-md` (lues sur raw.githubusercontent.com, joignable
  d'ici) : linear.app, raycast, stripe, vercel, notion, framer, superhuman,
  shopify. Ce sont des descriptions tierces de la page (couleurs, surfaces,
  boutons, ordre des sections). Elles sont parfois générées par une IA, elles ne
  sont pas datées et ne disent rien du mouvement. Il n'y en a pas pour Attio ni
  pour Arc.
- **[G] Le README de `frontendfyi/rebuilding-linear.app`**, une reconstruction
  pédagogique de la page de Linear telle qu'elle était vers 2023. Je n'ai pas
  pu lister son code : l'API GitHub refuse ce dépôt dans cette session.

**Quand deux sources se contredisent, je le dis.** Pour Linear, une analyse
affirme que le haut de la page est devenu un documentaire (mai 2026), une autre
y voit l'interface du produit.

---

## Les principes

### 1. Dire QUI c'est pour et CE QUE ça fait, en une phrase lisible en 10 secondes

- **Ce qu'on a vu.**
  - NN/g, d'après une étude de Microsoft Research : les 10 premières secondes
    décident si l'on reste. Pour gagner plusieurs minutes d'attention, il faut
    dire sa proposition de valeur dans ces 10 secondes.
    [R] https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/
  - Leur règle n°1 pour une page d'accueil : une phrase qui dit ce que fait le
    site, surtout quand on n'est pas encore connu.
    [R] https://www.nngroup.com/articles/top-ten-guidelines-for-homepage-usability/
  - Les titres des meilleurs sont littéraux :
    - Linear : « The product development system for teams and agents. »
      [R] https://www.producthunt.com/products/linear
    - Attio : « Customer relationship magic. », qui écrit en toutes lettres les
      initiales C-R-M.
      [R] https://www.producthunt.com/products/attio
    - Vinteer, le concurrent le plus proche de VRM : « l'outil de gestion
      Vinted, centralise tout ton business : ventes, marges, factures et compta ».
      [R] https://www.vinteer.io/
- **Pour VRM.** « Toute ta revente, un seul écran. » est un slogan. Il marche
  seulement si la ligne au-dessus et la phrase en dessous nomment la catégorie
  et le public : *l'outil de gestion des revendeurs Vinted, Leboncoin et eBay*.
  Le test : quelqu'un qui ne lit que le titre et la phrase dessous doit pouvoir
  répondre à « c'est quoi, c'est pour qui, ça m'évite quoi ? ».

### 2. Le produit est le héros de l'image : on montre l'interface, pas une métaphore

- **Ce qu'on a vu.**
  - Linear met de l'interface vivante tout en haut : « Live product UI in the
    hero ».
    [R] https://departmentofproduct.com/ et
    https://departmentofproduct.substack.com/p/deep-homepage-ux-explored
  - Sa fiche décrit une page qui n'est qu'un cadre sombre autour de l'app.
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md
  - Raycast : « la page marketing EST le produit ». Le visuel du haut est la
    palette de commandes elle-même.
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md
  - Notion : une vraie carte de l'espace de travail sort du bandeau du haut.
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/notion/DESIGN.md
- **Pour VRM.** La démo dessinée (`DemoAnimee`) est déjà le bon choix, avec ses
  données inventées. Il faut lui donner la place :
  - sur ordinateur, grande, à côté du titre ;
  - sur téléphone, **juste sous le titre**, pas après trois paragraphes.

### 3. La démo raconte UNE histoire, celle d'une paire, et pas une liste de fonctions

- **Ce qu'on a vu.**
  - Linear a rebâti sa page autour de « live widgets », un pour chaque étape du
    travail.
    [R] https://departmentofproduct.substack.com/p/deep-homepage-ux-explored
  - Vendoo raconte un parcours en trois temps : relier sa boutique, faire
    l'annonce une fois, publier partout.
    [R] https://www.vendoo.co/marketplaces/resell-on-depop
- **Pour VRM.** Une seule paire inventée, par exemple « Nike Air Max 90 · T42 ·
  N°127 », que l'on suit d'un bout à l'autre :
  1. elle est vendue sur Vinted ;
  2. la vente apparaît dans VRM ;
  3. le bordereau sort, tamponné « N°127 » ;
  4. on la retire de Leboncoin ;
  5. les 45 € entrent dans le chiffre du mois.

  Garder la même paire d'une scène à l'autre, c'est ce qui fait comprendre.
  Aujourd'hui, les six scènes sont six écrans sans lien entre eux (la Nike
  n'apparaît que dans la scène des ventes).

### 4. Chaque mouvement explique quelque chose ; rien ne bouge pour décorer

- **Ce qu'on a vu.**
  - Superhuman : un aperçu animé de l'interface laisse voir le produit
    fonctionner avant de cliquer.
    [R] https://www.omniconvert.com/blog/hero-section-examples/
  - Une revue de 2026 dit que l'animation de Linear sert à montrer la vitesse de
    l'interface, pas à impressionner. Le moteur de recherche ne précisait pas
    laquelle de ses sources le dit ; la plus probable est
    https://www.metabrand.digital/learn/tech-website-design-best-examples
    [R, source exacte non vérifiée]
- **Pour VRM.**
  - Un seul élément bouge à la fois, et il guide l'œil : un curseur qui clique,
    une vente qui arrive, un tampon qui se pose. Le reste de l'image ne bouge
    pas.
  - Une entrée part de `scale(0.96)` avec `opacity: 0`, jamais de `scale(0)`.
  - Courbe : `cubic-bezier(0.23, 1, 0.32, 1)`. Décalage de 30 à 80 ms entre les
    lignes d'une liste.
  - Une animation qui EXPLIQUE peut durer plus longtemps qu'un clic dans l'app
    (compétences `emil-design-eng` / `animate`).

### 5. Le visiteur garde la main : des chapitres nommés, une pause, une reprise

- **Ce qu'on a vu.**
  - Attio a une section à onglets (« Ask Attio », « Data model », « Workflows »,
    « Reporting ») et une vidéo « Attio in 90 seconds ». C'est décrit par des
    galeries tierces, je ne l'ai pas vu, et je ne sais pas laquelle parle des
    onglets : https://www.saasframe.io/saas/attio ou
    https://nicelydone.club/examples/apps/attio/marketing [R, source exacte non
    vérifiée]. La vidéo est citée par https://www.g2.com/products/attio [R].
  - La page de Linear (vers 2023) avait un « clavier de raccourcis interactif »
    et un « menu de commandes » qu'on pouvait essayer.
    [G] https://github.com/frontendfyi/rebuilding-linear.app
- **Pour VRM.** Les barres de progression de la démo sont déjà cliquables
  (`onSaut`). Il faut en faire des **chapitres avec un nom** (Ventes · Colis ·
  Rangement · Messages · Compta) :
  - la démo s'arrête au survol et quand un chapitre a le focus, puis repart ;
  - avec « réduire les animations », on affiche une image fixe par chapitre
    (c'est déjà le cas).

### 6. Une seule ambiance qui bouge, lente et légère, ou aucune

- **Ce qu'on a vu.**
  - Le dégradé animé de Stripe est sa signature. Selon des reconstructions
    faites par la communauté, c'est un canevas WebGL ; un commentaire note qu'il
    « consomme beaucoup de batterie ».
    [R] https://gsap.com/community/forums/topic/24837-animating-gradients/
  - Raycast n'a qu'une bande de rayures rouges, « une fois par page au plus ».
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md
- **Pour VRM.** Au plus une lueur bleue très douce derrière la démo :
  - en CSS seulement (`transform` et `opacity`) ;
  - arrêtée quand elle sort de l'écran ;
  - jamais de WebGL ni de bibliothèque : la page se charge AVANT l'app.

### 7. Une seule couleur d'accent, rare : le bouton principal, et ce qui bouge dans la démo

- **Ce qu'on a vu.**
  - Linear : un seul lavande, réservé à la marque, au bouton principal et au
    focus ; « pas de seconde couleur ».
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md
  - Stripe : un seul bouton indigo plein par bande.
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/stripe/DESIGN.md
  - Raycast réserve ses couleurs vives aux vignettes des extensions, jamais au
    cadre.
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md
- **Pour VRM.** C'est la règle du §7, « VRM Noir » : le bleu `#3D7BFF` sert au
  bouton principal et à l'élément qui bouge dans la démo. Les couleurs de
  Vinted, Leboncoin et eBay restent de **petits points dans la démo**, jamais
  dans le cadre de la page.

### 8. Un bouton principal par bande, avec le même verbe partout ; un second bouton discret

- **Ce qu'on a vu.**
  - Superhuman : « un seul appel par bande, jamais deux, jamais trois ».
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/superhuman/DESIGN.md
  - Shopify : « une et une seule action par bande ».
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/shopify/DESIGN.md
  - Notion : « Get Notion free », plein, à côté de « Request a demo », en contour.
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/notion/DESIGN.md
    et [R] https://relaunch.ai/blog/notion-landing-page-teardown-6-cro-findings-from-100m-user-p
  - Framer : « Start for free » et « Start with AI ».
    [R] copie de framer.com/index.md
- **Pour VRM.**
  - Le haut de la page dit « Commencer », le reste dit « Créer mon compte » :
    un seul verbe, partout.
  - Le second bouton, en contour : « Voir comment ça marche ». Il fait défiler
    jusqu'à la démo ou au film.
  - Sous le bouton principal, une ligne pour rassurer (sans engagement,
    résiliable en ligne). Vinteer écrit « annulable en un clic ».
    [R] https://www.vinteer.io/

### 9. Le prix dit tôt, sans astérisque, et tiré d'une seule source

- **Ce qu'on a vu.**
  - Vinteer met ses formules sur la page d'accueil. D'après des sources
    tierces : Starter 29 €/mois (3 comptes), Pro 49 €/mois (10 comptes), essai
    de 14 jours. Les sources se contredisent sur l'existence d'une formule
    gratuite.
    [R] https://www.vinteer.io/ et
    https://friptadium.com/blogs/actualites/vinteer-avis-prix-crm-vinted
  - Crosslist écrit noir sur blanc qu'il n'a pas d'essai gratuit, et propose un
    remboursement sous 3 jours.
    [R] https://crosslist.com/
- **Pour VRM.** 9,99 €/mois, lu dans les CGV. Garder la phrase « accès offert »
  tant que l'abonnement n'est pas obligatoire, et ajouter « résiliable en
  ligne ». La bande du prix peut remonter plus haut sur la page : c'est la
  question que tout le monde se pose.
  (Repère pour la question du coût : les concurrents directs sont entre 29 et
  49 €/mois, selon des sources tierces.)

### 10. Rassurer sur LE risque du métier, le blocage du compte, avec des faits vérifiables

- **Ce qu'on a vu.**
  - Vinteer se positionne ouvertement : « ce n'est pas un bot ». Il nomme ses
    trois façons de lire les données : extension Chrome, jeton, email.
    [R] https://www.vinteer.io/outil-vinted
  - Crosslist : « Secure, password-free setup ».
    [R] https://crosslist.com/
- **Pour VRM.** La section « Pensé pour ne jamais mettre tes comptes en danger »
  existe. Elle doit porter les garde-fous réels du §3 :
  - aucun mot de passe Vinted demandé ;
  - rien n'est envoyé à ta place sans ton clic ;
  - au plus 20 actions par heure et par compte ;
  - une requête à la fois ;
  - aucune donnée revendue.

  Ce sont des faits, chacun vérifiable dans le code. Jamais « 100 % sans
  risque ».

### 11. « Comment ça marche » en trois gestes, chacun montré, avec l'endroit où il se fait

- **Ce qu'on a vu.**
  - Vendoo : relier, faire l'annonce une fois, publier.
    [R] https://www.vendoo.co/marketplaces/resell-on-depop
  - Raycast : télécharger, choisir son raccourci, découvrir.
    [R] https://manual.raycast.com/quickstart
- **Pour VRM.** « Prêt en trois gestes » existe. Chaque geste doit avoir sa
  petite image (le zip, la page `chrome://extensions`, vinted.fr ouvert une
  fois) et dire **où** il se fait : sur l'ordinateur. Sur téléphone, on le dit
  au lieu de proposer de télécharger un zip (leçon de l'iPhone, §5 du dossier).

### 12. Des titres au réglage serré, des chiffres d'argent qui ne bougent pas en comptant

- **Ce qu'on a vu.**
  - Stripe utilise des chiffres à largeur fixe (`tnum`) partout où il y a de
    l'argent, et resserre l'espace entre les lettres de ses grands titres.
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/stripe/DESIGN.md
  - Linear resserre ses titres jusqu'à −3 px à 80 px.
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md
- **Pour VRM.**
  - `font-variant-numeric: tabular-nums` sur tous les montants de la démo : un
    total qui défile ne doit pas faire trembler la ligne.
  - Un espacement négatif sur les grands titres (environ −0,02 em), proche de 0
    pour le corps du texte (compétence `apple-design`).

### 13. La profondeur vient de l'étagement des surfaces, pas d'ombres lourdes

- **Ce qu'on a vu.**
  - Linear étage ses fonds sur quatre niveaux, avec des bordures d'un pixel et
    un léger reflet sur le bord du haut. Il n'a presque pas d'ombres.
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md
  - Vercel empile plusieurs ombres très légères, jamais une seule ombre lourde.
    [D] https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/vercel/DESIGN.md
- **Pour VRM.** C'est déjà la règle du §7 : rail < page < carte, ombres à deux
  couches, rayons de 5, 8, 10 et 12 px. Le cadre de la démo reçoit une bordure
  d'un pixel et un reflet sur son bord du haut. Pas d'ombre portée épaisse.

### 14. Le film et la démo de la page viennent de la même source, et la page reste légère

- **Ce qu'on a vu.**
  - Attio publie une vidéo « Attio in 90 seconds ».
    [R] https://www.g2.com/products/attio
  - Les pages produit d'Apple déroulent des suites d'images au défilement :
    60 à 180 images dessinées dans un canevas. C'est très lourd : un forum cite
    21 Mo en PNG, ramenés à 4 Mo en WebP.
    [R] https://css-tricks.com/?p=308477 et
    https://gsap.com/community/forums/topic/25188-airpods-image-sequence-animation-using-scrolltrigger/
- **Pour VRM.**
  - Le MP4 se fabrique depuis `?film`, la même démo que celle de la page (une
    seule source, §11). Il sert aux réseaux ; il ne monte pas dans le dépôt.
  - Sur la page, on garde la démo dessinée : plus nette et plus légère qu'une
    vidéo.
  - Jamais de suite d'images au défilement, jamais une vidéo lourde en lecture
    automatique en haut de la page.

### 15. Dire ce qui marche aujourd'hui et ce qui arrive, sans mélanger les deux

- **Ce qu'on a vu.**
  - Vinteer a une section « Roadmap » pour les plateformes à venir.
    [R] https://www.vinteer.io/
  - L'exemple inverse, chez Vendoo : une analyse dit qu'une paire vendue est
    retirée toute seule des autres plateformes, une autre cite un utilisateur
    qui dit que non. C'est l'écart qui tue la confiance.
    [R] https://yespress.io/vendoo-yc-w22 et https://nifty.ai/post/vendoo-review
- **Pour VRM.**
  - Vestiaire Collective se dit « bientôt », à part, et jamais comme une
    plateforme qui marche. Aujourd'hui, la démo dessinée l'affiche dans son menu
    à côté de Vinted.
  - La FAQ répond aux vraies objections : le prix, la sécurité du compte, le
    téléphone, comment partir.

---

## 5 erreurs à éviter

1. **Fabriquer de la preuve sociale.** Pas de compteur de vendeurs, pas
   d'étoiles, pas de logos de clients, pas de citation de presse. Arc ouvre sur
   une grande citation ([R] https://design.withfudge.com/share/arc.net-design).
   Vinteer affiche un nombre de vendeurs qu'il déclare lui-même, et que deux
   sources ne donnent pas pareil : +3 850 et plus de 2 800
   ([R] https://www.vinteer.io/). VRM n'a pas ces preuves, et la règle §2.3
   interdit de les inventer. On les remplace par ce qui se vérifie : la démo,
   les garde-fous, le prix.
2. **Mettre un slogan ou un film à la place du produit quand on est inconnu.**
   Linear se permet peut-être un documentaire en haut de sa page
   ([R] https://medium.com/the-teardown/cro-teardown-linear-put-a-documentary-where-the-product-screenshot-usually-goes-b30b74f89ff6,
   contredit par une autre source). Une marque connue en a les moyens. NN/g dit
   l'inverse pour une marque qu'on ne connaît pas encore : il faut une phrase
   qui explique. VRM est inconnu : le produit d'abord.
3. **Le mouvement qui coûte : en poids, en batterie, et en prenant la main sur
   le défilement.** Un dégradé WebGL, une suite d'images de 21 Mo, une vidéo en
   lecture automatique : la page d'accueil se charge AVANT l'app, sur le
   téléphone de quelqu'un qui découvre. Et jamais de défilement « piloté » qui
   empêche de faire défiler normalement.
4. **Promettre ce que l'outil ne fait pas.** L'exemple de Vendoo et du retrait
   automatique, plus haut, est contesté. Pour VRM, cela interdit d'écrire :
   - « publie tout seul partout » ;
   - « accepte tes offres » (retiré sur Vinted, §3) ;
   - « argent encaissé » (le mot est interdit, §5) ;
   - « Vestiaire » présenté comme une plateforme qui marche.

   Chaque phrase de la page doit avoir son équivalent dans le code. C'est « le
   défaut le plus coûteux du projet ».
5. **Dire la même chose deux fois, ou avec deux couleurs.** La grille des
   fonctions reprend les six scènes de la démo presque mot pour mot. Il y a deux
   verbes pour le même bouton (« Commencer » et « Créer mon compte »). Les
   couleurs de section changent d'une bande à l'autre, comme sur la page de
   Notion. Tout cela contredit le §7 : une cause, une phrase ; une seule couleur
   d'accent.

---

## Ce qui change sur la page actuelle (`src/Accueil.jsx`, 903 lignes)

**Déjà juste :**
- démo dessinée avec des données inventées ;
- temps lié à l'horloge ;
- démo arrêtée hors écran ;
- « réduire les animations » respecté ;
- un seul accent ;
- prix lu dans les CGV ;
- aucune adresse de contact écrite en dur.

**À changer en priorité :**
1. La ligne au-dessus du titre et la phrase dessous nomment la catégorie : *outil
   de gestion des revendeurs* (principe 1).
2. Sur téléphone, la démo vient juste sous le titre (principe 2).
3. Une paire suivie de bout en bout dans les six scènes (principe 3).
4. Des chapitres nommés, avec une pause au survol et au focus (principe 5).
5. Un seul verbe pour le bouton principal, plus « Voir comment ça marche » en
   second bouton (principe 8).
6. La grille des fonctions ne répète plus la démo : elle dit ce que la démo ne
   montre pas (colis à retirer, téléphone, publication sur Leboncoin et eBay),
   en une ligne chacune (erreur 5).
7. Les garde-fous chiffrés dans la section sécurité (principe 10).
8. Vestiaire sorti du menu de la démo, ou marqué « bientôt » (principe 15).
