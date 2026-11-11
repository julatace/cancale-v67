# 11 novembre — Lot centre-aide : animation par écran, « Comment faire… ? »

Branche `claude/centre-aide` (depuis `origin/main`). Demande de Julien : « centre d'aide
intégré : une courte vidéo ou une animation par écran, plus une recherche "comment faire…" ».
Principe : « plus beau, simple, surtout PRATIQUE : les gens doivent gagner du temps ».

## Ce qui existait (réutilisé, pas doublé)

- Le « ? » de chaque écran (`src/composants/AideEcran.jsx`, 8 nov.) : 3 questions, l'article
  de vrm.center/aide, « Signaler un problème » ; les gestes numérotés en tête (lot J, 10 nov.,
  `scripts/aide-contenu.cjs` → `src/aideEtapes.js`). Il est déjà posé sur les 12 écrans
  (Ma journée, Annonces, Ventes, Colis, Messages, Achats, E-mails, Argent, Statistiques, Stock,
  Réglages, Communauté) par `PhraseEcran`.
- La loupe universelle et ses « Actions » (`src/annulerCommandes.js`).
- Le chemin des liens et notifications (`?tab=…`, `vrm:aller` → `goto`).

## Ce qui est livré

1. **Une animation par écran** (`src/aideAnimations.js` données, `src/composants/AideAnimation.jsx`).
   Pas de vidéo : une maquette SVG de l'écran avec des données d'EXEMPLE (N°124, 45 €), un doigt
   qui fait chaque geste. UNE scène par geste de `ETAPES_ECRANS` ; une seconde par scène ⇒ 3 à
   5 s, en boucle douce. Le geste en cours s'allume dans la liste dessous (pastille bleue).
   Gestes : toucher (onde), désigner, taper (le champ se remplit), arriver, partir.
   Couleurs = jetons de l'app (clair et sombre suivent). Bouton pause 44 px (WCAG 2.2.2).
   « Réduire les animations » du système ⇒ rien ne bouge : la maquette reste, chaque cible
   porte le numéro de son geste.
2. **69 fiches « Comment faire »** (`src/aideFiches.js`) écrites d'après les vraies fonctions :
   question, 1 à 3 étapes, « M'y emmener ». 3 à 5 par écran dans la feuille du « ? ».
   « M'y emmener » passe par le chemin des notifications (`vrm:aller`), puis ouvre au besoin
   une feuille de la coque (calculette, Ma configuration, visite, recherche par photo).
   Nouveau : `?tab=settings&reglage=<id>` ouvre un panneau de Réglages (liste fermée
   `REGLAGES_AIDE`) ; Réglages sert aussi `abonnement` (la vue) et `double`/`equipe` (sous
   « Compte »).
3. **La recherche « Comment faire… ? »** : dans la feuille (toutes les fiches) et dans la loupe
   universelle (groupe « Comment faire », 3 au plus ; un toucher ouvre la feuille sur la fiche).
   Tolérante, sans IA ni service (§2.9) : accents, majuscules, pluriels, une faute (deux sur un
   mot de 9 lettres et plus), un début de mot, des voisins (« étiquette » = bordereau,
   « chaussure » = article), petits mots ignorés. Tout mot doit trouver sa place ; sinon les
   fiches qui en trouvent la moitié sortent sous « Ce qui s'en approche ».
4. **Adapté au vendeur** : les fiches prennent les mots de `motsArticle` (formes entières :
   « Trouver où est rangée une paire » / « Trouver où est rangé un article »). Les gestes et
   questions d'avant passent par une table de GROUPES ENTIERS, accord compris (« deux paires
   présentes » ⇒ « deux articles présents », « la mauvaise chaussure » ⇒ « le mauvais
   article »). Deux fiches réservées : « Ne pas confondre deux paires identiques » (sneakers),
   « Taille et marque sont-elles obligatoires ? » (autre).
5. **Rien d'imposé** : aucune feuille ouverte au départ ; `vrm:aide` n'est émis que sur un clic.

## Tranché (ambigu)

- **Simple / Complet** : en Simple, la liste de l'écran tait les fiches avancées (Republier,
  Leboncoin, eBay, Vestiaire, offres automatiques, favoris, facture Pro, export, prix du marché,
  agenda, stream, double vérification, équipe, forme des numéros) ; **la recherche les trouve
  quand même** (classées après). Cacher une réponse cherchée ferait perdre du temps.
- La première question n'est plus dépliée d'office : la place va à l'animation et aux fiches.
- Une fiche mène à l'ÉCRAN (et au panneau, à la feuille de la coque) ; elle ne touche aucun
  bouton à sa place. Une feuille d'un écran chargé à la demande (« Tout imprimer », inventaire)
  n'est pas ouverte : l'événement partirait avant que l'écran l'écoute. Exception sûre :
  « Tout imprimer » par `print=bord` (le lien de l'extension).

## Preuves

- `node scripts/audit-centre-aide.cjs` : **27 verts** ; `--prouve` **10/10 mutations rouges**
  (lien mort, panneau inconnu, sans accents, sans fautes, scène manquante, « paire » pour un
  autre vendeur, `reglage=` ignoré par la coque, feuille ouverte toute seule, mouvement forcé,
  feuille d'un écran à la demande). Sur `origin/main` : rouge (les modules n'existent pas).
  Il exige : chaque « M'y emmener » ⇒ un onglet de `ONGLETS_LIENS`, résolu par
  `redirigerOnglet` + `ONGLETS_DEPLACES` vers un onglet RENDU (`tab==='…'` + `<GardeEcran`) ;
  chaque écran a questions, gestes, animation (scènes = gestes, 3–5 s), 3 à 5 fiches pour les
  4 profils ; 14 requêtes fautives ⇒ la bonne fiche en tête ; chaque fiche retrouvée par sa
  question.
- Banc `scripts/bancs/centre-aide.cjs` (390 tactile + 1512, clair + sombre) — résultat dans
  le rapport de fin de session.
- `npm run build` vert ; audits verts : variables, tdz, coherence, identite, icones,
  textes-courts, fonctions-api, secrets, csp, aide-signalement, import-partage-aide,
  recherche-universelle. `audit-signalement` : 2 rouges déjà sur `origin/main` (pas de ce lot).

## Geste de Julien

Aucun.
