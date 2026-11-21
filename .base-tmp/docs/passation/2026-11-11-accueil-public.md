# 11 nov. 2026 — La page d'accueil publique convainc, honnêtement (lot accueil-public)

Branche `claude/accueil-public` (pas de PR, pas de merge dans `main` : consigne de la session).

## Ce qui a changé sur vrm.center (`src/Accueil.jsx`)

- **Pour qui, dans le premier écran** : au-dessus de la promesse, « L’outil des revendeurs
  Vinted, Leboncoin et eBay. Tous articles. » (`data-pour-qui`). Sous-titre raccourci :
  « Chaque matin, VRM te dit quoi faire, sans te tromper d’article. »
- **Bouton d’essai clair** : « Essayer gratuitement » (hero, barre, prix, fin) — même lien
  `/?inscription`, même `data-cta`. Vrai dans les deux états : accès offert aujourd’hui
  (`ACCES_OFFERT`), puis 7 jours d’essai (`ESSAI_JOURS`, = CGV = Stripe).
- **Cinq moments** au lieu de quatre : « Tes messages et tes offres, tous comptes réunis »
  (écran Messages). Ce qu’il promet existe : lire et trancher une offre depuis l’app
  (capacité `messagerie`), acceptation auto au-dessus du prix mini **éteinte par défaut**
  (§3). « paire » → « article » partout sur la page.
- **Prix** : deux cartes Solo / Pro. Nom et phrase = `OFFRES` (`api/_lib/plan-regle.js`, la
  source des Paramètres et du serveur) ; montant = `PRIX_MOIS` / `PRIX_PRO_MOIS`
  (`src/accueil-reglages.js`), comparés aux CGV. Pro dit « bientôt » tant que `PRO_OUVERT`
  est faux.
- **FAQ** : une liste `FAQ` (question en `h3`, réponse en paragraphes), les mêmes questions
  qu’avant ; « Et Vestiaire ? » ne s’affiche que tant que `VESTIAIRE_BRANCHE` est faux.
- Aucun avis, témoignage, nombre d’utilisateurs, note, ni logo de plateforme (le nom en texte).

## Les captures : catalogue mélangé, toujours en mode exemple

- `scripts/accueil-captures.cjs` pose dans la page un catalogue **inventé et mélangé**
  (veste en jean, sac cabas, pull, Air Max, lunettes…) via `window.__vrmExempleCatalogue` ;
  `src/exempleDonnees.js` `jeuExemple(now, { catalogue })` l’utilise. **Sans catalogue, le jeu
  est exactement celui d’avant** (les autres bancs ne voient rien changer). Le catalogue vit
  dans le script, pas dans l’app livrée (budget du fichier d’entrée).
- Avec ce catalogue, les 12 annonces ont un N° : plus de faux « 1 numéro en double N°10 »
  en haut de Ma journée.
  ⚠️ **Constaté, pas corrigé** : le mode exemple PAR DÉFAUT affiche « 1 numéro en double
  N°10 » (numérotation auto des annonces 51011–51013 ; `vrm_num_doublons` = ["10"]). À
  regarder dans la numérotation auto (règle §5, doublons) — hors de ce lot.
- Nouvel écran capturé : `messages`. L’écran Compta a changé de forme (« Argent ») : la
  capture refait les gestes réels (Ventes → Argent → Déclarer → Micro-entrepreneur → Par mois).
- `npm run build && node scripts/accueil-captures.cjs && node scripts/accueil-og.cjs`.

## SEO

- `index.html` : titre « VRM — tes ventes, tes colis et ta compta, au même endroit » (le même
  que la page affichée), description de 150 signes pour tout revendeur (plus « sneakers »),
  Open Graph complet + `summary_large_image`.
- **Image de partage** `public/og-vrm.jpg` (1200 × 630, 68 Ko) : `scripts/accueil-og.cjs` la
  compose avec une capture **au registre du mode exemple** (refusée sinon) ; empreintes dans
  `public/og-vrm.json`. Elle dit « l’app VRM, données d’exemple ».
- **Données structurées** : un `SoftwareApplication` en `application/ld+json`, deux offres
  (Solo 16.99, Pro 19.99 EUR), **sans** `aggregateRating` ni `review`. `audit-csp` admet ce seul
  type de bloc (jamais exécuté, JSON valide exigé).
  ⚠️ Le jour où un prix change : `index.html` aussi (le banc le compare et passe au rouge).

## Preuves

- `npm run build` vert. Fichier d’entrée : 25,92 Ko compressés (budget du banc : 26 Ko —
  la marge est mince).
- `scripts/bancs/accueil.cjs` : **189 verts, 1 rouge** — le rouge est « le film est une
  fonction pure du temps » (`?film`), **déjà rouge sur `main` avant ce lot** (mesuré au
  départ : 3 rouges sur main, dont ce film ; les deux autres — prix unique d’avant Pro, et
  Vestiaire dans la phrase d’offre — sont réglés par le banc mis à jour). Le film n’est pas touché.
- Nouveaux contrôles du banc : « pour qui » dans le premier écran (390/1512, clair/sombre) ;
  deux cartes = OFFRES + CGV ; FAQ (h3 + réponse, titres sans saut) ; SEO (titre, description,
  canonical, OG, image 1200 × 630 ≤ 150 Ko issue d’une capture au registre, JSON-LD sans avis,
  offres = réglages) ; **4G lente** (150 ms, 1,6 Mbit/s) : chargement complet ≈ 1,5 s,
  **LCP ≈ 2,2 s**, 333 Ko transférés avant défilement (serveur de banc sans compression).
- **Échouent sur le code d’avant** (`git archive origin/main`, banc copié dedans) : 14 rouges
  (pour qui ×4, cartes, FAQ, titre, description, OG, image, empreinte, JSON-LD, offres, titre affiché).
- **Mutations** : `aggregateRating` ajouté ⇒ rouge ; prix Pro 17.99 dans le JSON-LD ⇒ rouge ;
  `OFFRES.pro.nom` changé ⇒ rouge.
- Audits verts : variables, tdz, coherence, identite, icones, textes-courts, fonctions-api,
  secrets, csp, plans-solo-pro (109/0 — il avait 1 rouge sur main, « un compte vend sur chaque
  plateforme » absent de l’accueil, réglé par la FAQ), mentions-paiement, vendeur-generaliste,
  accueil-navigateurs, lancement, accueil-demo.
  `audit-chrome-en-dur` : rouge **hors de ce lot** (`src/ModeVacances.jsx:37` et `:138`,
  « Chrome » en dur), déjà présent sur `main`.
- Captures regardées : 390 et 1512, clair et sombre, pleine page.

## Geste de Julien

Aucun pour la page. Pour vérifier l’aperçu de partage après déploiement : coller
`https://vrm.center` dans un message (ou l’outil de débogage de partage de Facebook).
