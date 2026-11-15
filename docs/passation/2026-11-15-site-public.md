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

## Preuves

(complétées en fin de lot, voir plus bas)

## Captures à regarder

(voir plus bas)

## Gestes de Julien

Aucun pour la page. Après la mise en ligne : coller `https://vrm.center` dans un message WhatsApp
pour voir l'aperçu (WhatsApp et Facebook gardent l'ancienne image en cache quelques jours ; l'outil
de débogage de partage de Facebook la rafraîchit).
