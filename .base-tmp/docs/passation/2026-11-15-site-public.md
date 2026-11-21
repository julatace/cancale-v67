# 15 nov. 2026 — Le site public refait (lot site-public)

Branche `claude/site-public` (depuis `origin/main` 70fbef70). Pas de PR (consigne). Rien dans
`vinted-sync-extension/`, aucune migration, aucune fonction `api/` de plus, CLAUDE.md non touché.

Julien : « je veux que tu améliores tout le site parce que là il est pas ouf ». Un influenceur va
bientôt poster `vrm.center/?code=CODE` (programme partenaire construit à part, `claude/partenaires`).
Périmètre : tout ce que voit un visiteur NON connecté.

## Ce qui a changé

### La page d'accueil (`src/Accueil.jsx`, style `src/accueil/accueil.css`)
- **Premier écran** (390 × 844 comme 1512 × 900, sans défiler) : les pictogrammes des quatre
  plateformes + « Pour les revendeurs : tous articles, un ou plusieurs comptes. » ; le titre
  **« Tes ventes Vinted, Leboncoin, eBay et Vestiaire au même endroit. »** ; dessous « Numéros de
  rangement, colis, codes de retrait et compta : chaque matin, VRM te dit quoi faire, sans te
  tromper d'article. » ; **UN bouton plein** « Essayer gratuitement » et la touche en porcelaine
  « Découvrir avec des exemples › » ; le prix (« Gratuit pour l'instant, puis 16,99 € par mois
  après 7 jours d'essai gratuit · sans engagement ») et le prérequis (l'ordinateur, les navigateurs
  servis) ; **une vraie capture de l'app** (Ma journée, mode exemple, photos CC0) déjà à l'écran :
  au téléphone elle monte du bas, à l'ordinateur l'écran du bureau et le téléphone devant, à droite
  du texte. « Se connecter » vit dans la barre (plus de doublon dans le haut de page).
- **Les fonctions, montrées** : six tuiles en porcelaine (« Tout ce qui suit une vente »), chacune
  sa capture réelle dans un téléphone qui sort du bas de la tuile, le bon morceau de l'écran cadré
  (les N° gravés, « Imprimer 1 », le code de retrait) : numéros de rangement · bordereaux en un
  toucher · codes de retrait · tous les comptes et toutes les plateformes (pictogrammes + Messages)
  · compta (Argent) · l'extension (installée une fois, ses navigateurs, 50 actions/h, compte de
  l'onglet, aucune suppression sans confirmation). Elles remplacent les « cinq moments » au
  téléphone fixe (long, une capture à la fois).
- Le calculateur du temps gagné, la confiance et les trois étapes (deux panneaux), les deux offres
  (montants des CGV, Pro sur l'encre), la FAQ, une plaque de fin, le pied (non-affiliation, liens).
- **Sans abonnement = aperçu** dit sous les offres (§3) : « tes données restent : VRM s'ouvre en
  aperçu — le début de chaque liste, le reste flouté, aucune action. Rien n'est supprimé. »
- **FAQ, sécurité du compte Vinted** : les garde-fous réels — compte ouvert dans l'onglet, une
  requête à la fois, 50 actions/heure, pause dès que Vinted ralentit, aucune suppression sans
  confirmation. « Pourquoi une extension ? », données, résiliation gardées.
- **Vestiaire compté** : `VESTIAIRE_BRANCHE` passe à `true` (MESURÉ : `ventesFaites` et
  `ventesDeclarables` d'App.jsx comptent les ventes Vestiaire) — la question « Et Vestiaire ? En
  cours : ses ventes n'entrent encore dans aucun total » était devenue fausse ; elle disparaît.
- **Aucun faux** : ni nombre de vendeurs, ni avis, ni étoiles, ni témoignage, ni logo de presse ;
  les marques citées en texte, leurs pictogrammes monochromes de `public/brands/` (fabriqués depuis
  `src/plateformes/marques.js`, masque CSS : 0 octet de JS) ; « VRM n'est pas affilié à Vinted,
  Leboncoin, eBay ou Vestiaire Collective » en pied.
- **La suite de l'adresse passe intacte jusqu'à l'inscription** (`src/accueil/lienEntree.js`) :
  `vrm.center/?utm_source=insta&ref=AB12` ⇒ « Essayer gratuitement » mène à
  `/?inscription&utm_source=insta&ref=AB12` (lien, et `onEntrer` de `src/main.jsx`). La page ne
  lit, ne range ni ne change rien de cette suite (le programme partenaire la rattache).
  ⚠️ `?code=` seul va déjà droit dans l'app (retour Google/Discord, `veutLApp` de main.jsx) :
  inchangé — c'est au programme partenaire d'en décider.

### Les captures (`scripts/accueil-captures.cjs`, `public/accueil/`)
Refaites sur l'app au studio, en mode exemple, **avec les photos CC0** de `public/exemple/` (le jeu
de « Découvrir avec des exemples » ; `CATALOGUE=varie` rend l'ancien catalogue sans photo). Nouvelle
capture `expedier` (Ventes, « À expédier », « Imprimer 1 »). Annonces sans défilement (la barre en
verre passait sur les rangées). Compta = Argent → Résumé (« Déclarer » disait « Pas encore calculé »
dans l'exemple). Registre `captures.json` réécrit par le script. Textes alternatifs refaits (5 langues).

### Le partage (Instagram, TikTok, WhatsApp…)
`index.html` : titre « VRM — tes ventes Vinted, Leboncoin, eBay et Vestiaire au même endroit »,
description qui nomme les quatre plateformes, Open Graph mis à jour + balises Twitter (titre,
description, image) ; données structurées (même description, prix inchangés). Image
`public/og-vrm.jpg` refaite au studio (Inter embarquée, la capture Ma journée au registre) par
`scripts/accueil-og.cjs`. Manifeste : couleurs du studio (`#EEF6FD`), description des plateformes.

### L'écran de connexion (`src/App.jsx` AuthScreen, `src/design/studio-reste.css`)
E-mail + mot de passe d'abord, « Se connecter », puis « ou » et Google/Discord EN DESSOUS (touche en
porcelaine, 48 px), toujours seulement s'ils sont activés chez Supabase (règle inchangée). Aucun
« recevoir un code » ajouté (les e-mails de code ne sont pas configurés). Les étiquettes flottantes
semées autour de la marque (décor) sont retirées ; la carte est centrée dans sa colonne. Le point 2
nomme Vestiaire (`auth.point2.texte`, 5 langues) ; `auth.ouEmail` → `auth.ou`.

### Les pages statiques (forme seulement, aucun texte)
`public/confiance.html` (« Ce que VRM fait — et ne fait jamais »), `public/aide/aide.css` (centre
d'aide et installation de l'extension), `public/legal/legal.css` (pages légales) : la palette du
studio (bleu clair éclairé du haut, porcelaine, encre ; la nuit, bleu-nuit), liens de navigation
légale à 44 px.

### Textes
Tout par `tr()`, cinq langues (`src/i18n/langues/*-accueil.js` ; `auth.*` dans `<l>.js`).
Clés retirées : `accueil.moment.matin.*`, `accueil.moment.messages.*`. Nouvelles : `accueil.moment.
{expedier,comptes,extension}.*`, `accueil.offres.sansAbonnement`.

## Pour la fusion avec `claude/partenaires` (lien `vrm.center/p/CODE`)

- Ce lot ne touche PAS au routage : `veutLApp`, les redirections de `vercel.json` et l'ordre de `Racine`
  (main.jsx) sont inchangés. Seul `onEntrer` de main.jsx passe par `lienEntree` (la suite de l'adresse).
- Sur `claude/partenaires` (9bd066f4), `/p/CODE` → `/?partenaire=CODE` (redirection Vercel) → `veutLApp`
  (mot `partenaire`) ⇒ l'app, donc l'INSCRIPTION — pas la vitrine ; `/pa/<jeton>` → `?espace-partenaire=` ⇒
  `VuePartenaire`, testé AVANT la vitrine dans `Racine`. Ni l'un ni l'autre ne peut tomber sur la vitrine.
- Si le programme partenaire décide de montrer la vitrine à `/?partenaire=CODE` (retirer `partenaire` de
  `veutLApp`), « Essayer gratuitement » et « Se connecter » porteront `&partenaire=CODE` jusqu'au formulaire
  (`lienEntree`, contrôlé par le banc P6). La vitrine ne lit, n'efface ni ne range aucun paramètre ni
  stockage du partenariat.
- `git merge-tree HEAD origin/claude/partenaires` : aucun conflit (15 nov., 15 h).

## Preuves

Machine très chargée (charge 20 à 60) : une construction prend 10 à 20 min.

- `npm run build` vert.
- **Banc neuf `scripts/bancs/site-public.cjs`** (P1–P8, voir l'en-tête) sur le build final : **93 verts,
  0 rouge** (390 tactile et 1512, clair et sombre ; 320/768/1024 pour le débordement ; connexion 390 clair,
  390 sombre, 1512).
  - **Sur le code d'avant** (`BANC_DIST` = build d'`origin/main` 70fbef70) : **29 rouges** (h1, capture
    visible 59 px seulement au téléphone, les six fonctions absentes, non-affiliation sans Vestiaire,
    pictogrammes absents, titre, Twitter, manifeste, la suite de l'adresse perdue au clic, Discord AU-DESSUS
    du formulaire ×3…).
  - **Mutations** (copies du `dist`) : « Plus de 10 000 vendeurs nous font confiance » ⇒ P3 rouge ;
    « Découvrir avec des exemples » en plein d'encre ⇒ P1 « un seul plein » rouge (390 et 1512) ; haut de
    page poussé de 420 px ⇒ 14 rouges (capture, boutons, prix et prérequis hors du premier écran) ;
    `suiteAdresse` qui rend '' ⇒ P6 rouge.
  - Mesures : avant de défiler à 390, 437 Ko NON compressés (react 138, entrée 99, Inter 47, capture 45 ;
    sur origin/main 374 Ko — la police Inter, 47 Ko, est la différence) ; 4G lente (banc accueil) : LCP
    2,1 s, 354 Ko.
- **Banc `accueil.cjs`** (mis à jour : promesse « tes ventes Vinted… », « pour qui » sans le nom des
  plateformes, Vestiaire compté, « Se connecter » dans la barre) : **192 verts, 2 rouges, tous deux déjà
  rouges sur origin/main** : le budget du fichier d'entrée (≤ 26 Ko : 38,8 Ko sur origin/main mesuré au
  gzip -9, **35,3 Ko après** — ce lot l'allège de 3,5 Ko en sortant le style de la page dans une feuille) et
  « le film est une fonction pure du temps » (`?film`, rouge depuis le 11 nov., non touché).
- `exemple-accueil` : tout vert. `connexion-claire` (320, 390, 1512) : vert. `confiance` : vert.
  `accueil-temps` : 44/0.
- Audits verts : `traduction` (45), `csp`, `tdz`, `variables`, `studio`, `quoi-de-neuf`, `plans-solo-pro`
  (109), `accueil-navigateurs` (27 — rouge en cours de route, le prérequis était devenu un `<p>` et la tuile
  de l'extension ne nommait pas les navigateurs : corrigé), `lancement`, `comptes-sup`, `accueil-nouveaux`,
  `accueil-reste`, `mentions-paiement`, `chrome-en-dur`, `exemple-photos`, `mode-exemple`, `icones`,
  `violet`, `boutons`, `connexions-oauth` (55), `confiance` (39), `coherence`, `identite`, `temps-gagne`.
- Rouges HORS de ce lot (présents sans lui, aucun fichier de ce lot) : `confiance-publique` G5/G10
  (`vrm-badge.js` de l'extension), `textes-courts` (`src/ecrans/Ebay.jsx:2595`), `vendeur-generaliste`
  S1/S2/S3 et `vocabulaire-article` S1/B8 (autres écrans ; la seule ligne de ce lot — un texte alternatif qui
  nommait une Nike Cortez — a été réécrite), `stockage-sur` (clés d'index d'autres fichiers).

## Captures à regarder (dossier de la session, hors dépôt)

`/tmp/claude-0/-home-user-cancale-v67/31464966-7138-5129-91cc-9bcff32ecc28/scratchpad/site-public/`
- avant : `avant/accueil-390-clair-ecran.png`, `avant/accueil-390-clair-pleine.png`,
  `avant/connexion-390-clair-ecran.png`, `avant/connexion-1512-clair-ecran.png` ;
- après : `apres/site-{390,1512}-{clair,sombre}-1-premier-ecran.png` (premier écran),
  `apres/site-{390,1512}-{clair,sombre}-2-page.png` (page entière), `apres/connexion-{390-clair,390-sombre,1512-clair}.png`.
Dans le dépôt : `public/og-vrm.jpg` (l'aperçu de partage), `public/accueil/*.webp` (les captures).

## Défaut de l'app vu sur les captures (pas corrigé ici, hors périmètre)

Ma journée, tuile « À retirer » : le titre « À retirer · 2 · Nike Terminator Low rose et grise taille 41 et
1 autre » passe sur deux lignes et la seconde chevauche les plaques des codes (visible dans
`public/accueil/journee-*.webp` et `bureau-*.webp`). À corriger dans l'écran (studio-journee) ; puis
refaire `node scripts/accueil-captures.cjs && node scripts/accueil-og.cjs`.

## Gestes de Julien

Aucun pour la page. Après la mise en ligne : coller `https://vrm.center` dans un message WhatsApp
pour voir l'aperçu (WhatsApp et Facebook gardent l'ancienne image en cache quelques jours ; l'outil
de débogage de partage de Facebook la rafraîchit).
