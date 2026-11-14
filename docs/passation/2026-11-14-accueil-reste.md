# 14 novembre 2026 — L'accueil des nouveaux, le reste (idées 133 134 136 139 140 143 145 146 147)

Branche `claude/accueil-reste`. Julien a validé (« fais tout, lance tout en même temps ») le reste
des idées d'accueil. Un autre agent a fait 132, 135, 137, 138, 141, 142, 144 (`claude/accueil-nouveaux`,
fusionnée ici : dictionnaires, Quoi de neuf, coque et Paramètres gardés des deux côtés).

Tout vit dans `src/accueilReste/` : les RÈGLES en JS pur (exécutées par
`scripts/audit-accueil-reste.cjs`), un seul fichier qui dessine (`AccueilReste.jsx`), un CSS.
Les composants n'importent pas App.jsx : l'app leur prête ses outils (`poserOutilsAccueil`,
`deps.js` : `load`, `save`, `onCloudReady`, `lireTout`, `lireAbonnement`, date de création du compte).
Textes : `src/i18n/langues/{fr,en,es,it,de}/accueilReste.js` (152 clés) et 4 clés de la page
d'accueil dans `*-accueil.js`.

## Ce qui est livré

| idée | ce qu'il voit | règle | où |
|---|---|---|---|
| **134** « J'ai déjà mes N° sur mes cartons » | Ma journée : « Tes N° sont déjà sur tes cartons ? », les N° LUS dans ses descriptions, chacun avec son annonce, un N° écrit sur deux annonces en ROUGE (« rien n'est pris »), « Oui, ce sont mes N° » / « Non, VRM numérote » | `cartonsNumeros.js` | carte en bas de Ma journée ; la retenue dans l'effet de numérotation d'App.jsx |
| **133** « Ce que VRM a trouvé chez toi » | après l'import (import du passé fini, ou dressing lu), UNE liste : colis en retard (Voir), ventes sans date de versement (Dater), annonces sans N° (Voir, ou Répondre à la question des cartons) ; « C'est noté » | `trouveChezToi.js` | Ma journée, compte neuf seulement |
| **136** visite de 4 écrans | Ma journée, Annonces, Ventes, Achats : 4 bulles chacun sur les boutons RÉELS (la bulle de `VisiteBulles`), « Passer » ; rejouable par « Revoir la visite de cet écran » dans le « ? » et Paramètres → Aide | `visiteEcrans.js` | `VisiteEcranHote` dans la coque |
| **139** mini-glossaire | un mot souligné en pointillé (« versement », « à expédier », « N° »…) s'explique en une phrase au toucher ; « Les mots de VRM » dans chaque « ? » (10 mots) | `glossaire.js` | `Mot`, `GlossaireListe` |
| **140** conseil du jour | en bas de Ma journée, « Conseil du jour · 3 sur 30 », « Voir », « × » (rangé pour la journée) ; 30 conseils, chacun vers un écran qui existe | `conseilDuJour.js` | Ma journée |
| **143** Continuer avec Apple | RIEN tant que Supabase ne dit pas le fournisseur activé (`providerEnabled`, la même porte que Google/Discord) ; activé ⇒ le bouton (pomme à l'encre), « Relier Apple » dans Paramètres → Connexions (retour accepté seulement depuis `appleid.apple.com`) | `OAUTH_PROVIDERS` | App.jsx, `src/auth/*` |
| **145** ton essai | « Ton essai » : colis suivis, bordereaux imprimés, « ≈ N min gagnées, estimé » (repli « Comment c'est estimé »), « Encore N jours d'essai » | `essaiBilan.js` | Ma journée (pendant l'essai seulement) |
| **146** vidéo de 45 s | page d'accueil : « Voir VRM en 45 s » sous les deux gestes du haut ; rien n'est téléchargé avant le toucher ; vidéo muette (aucune piste audio, vérifié par ffprobe), sous-titres fr/en/es/it/de (la langue de la page montrée) | `scripts/films/accueil-video.cjs` | `src/accueil/AccueilVideo.jsx`, `public/accueil/film-45s.*` |
| **147** appel de bienvenue | compte Pro : « Appel de bienvenue, 15 min · Réserver » (Ma journée, carte de l'essai, et Paramètres → Aide) ; Julien range SON lien dans Paramètres → Aide (propriétaire seul) ; champ vide ⇒ rien nulle part | `appelBienvenue.js` + `api/_lib/appel-bienvenue.js` | `api/compte.js?mode=abonnement` → `appelBienvenue` |

Interrupteurs (Paramètres → Aide → « Visite, mots expliqués, conseil du jour ») : par compte VRM,
`vrm_aides_accueil` dans SYNC_KEYS (`off`, `vues` par écran, `conseil` fermé du jour, `trouveVu`).

## Les règles qui comptent

- **134, §5 numéros.** La retenue ne vise QUE un compte sans aucun N° (pool vide, aucun N° pris, aucune
  fiche numérotée) qui n'a jamais dit qui numérote (`vrm_numero_ecrit` sans `depuis`/`choisi`) et dont
  au moins une annonce sans N° porte un N° écrit lisible. Alors l'effet de numérotation saute le N° NEUF
  (`if (!num && retenueCartons) continue;`, juste avant `prochainLibre`) ; les identités (vente de la
  même annonce, même photo) restent prises. Sa réponse EST le réglage synchronisé (« Oui » = je
  numérote moi-même ; « Non » = VRM numérote), jamais un drapeau local ; aucune migration. « Oui » passe
  par la règle existante (`decisionEcrite`, par identifiant d'annonce) ; ajout pour TOUS : un N° écrit
  dans deux annonces (`clesLuesEnDouble`) ou déjà porté par une autre fiche n'est posé sur AUCUNE
  (rouge, rien adopté). Un N° d'archive (« B… » de la 013) n'est jamais repris (`reprenable`).
  La numérotation repasse quand le réglage est RANGÉ (`vrm:save` de `vrm_numero_ecrit`).
- **133.** Aucun calcul : `vrm_colis_aposter.enRetard` (Colis), `vinted_urssaf_mois.aDater.n` (Ventes),
  et `vrm_trouve_sans_numero` publié par Annonces avec `annStats.sansNum` (la base même de la grille).
  Publication de plus de 12 h (3 j pour l'URSSAF) ⇒ « — » (pas su), absente ⇒ rien ; total « au moins ».
  La vue « Sans numéro » est ouvrable par `demanderVue('nonum')`.
- **136.** Compte créé il y a 30 jours au plus ; une fois par écran ; jamais avec une feuille ouverte,
  la visite d'arrivée, ni quand un geste urgent est à l'écran (`[data-urgent="1"]`, N° portés deux fois,
  double vente, dernier jour de retrait) — elle attend une autre ouverture. Bouton absent ⇒ bulle sautée ;
  aucun ⇒ rien n'est noté vu. Libellés de `VisiteBulles` passés par `tr()`.
- **140.** Jours 1 à 30 depuis la création du compte VRM ; posé SOUS tous les gestes de Ma journée.
- **145.** `statut === 'trialing'` + `finEssai` lus du serveur ; début = fin − 7 jours (CGV) ; bordereaux
  = dates de `vinted_bords_printed` dans la fenêtre ; colis = n° DISTINCTS lus dans les e-mails reçus
  dans la fenêtre (`meta->>receivedAt`, projetés) ; temps = durées de référence de la page d'accueil
  (`GESTES` : 100 s par bordereau, 50 s par colis), arrondi, dit « estimé ».
- **147.** Le lien est relu par le serveur dans la ligne `main` du propriétaire (`data->vrm_appel_bienvenue->>lien`,
  clé de service, jamais `select=data`) et rendu seulement si le plan LU chez Stripe est « pro » (propriétaire
  exclu) ; https seulement, hôte public, ni identifiants ni port (la même règle côté app et serveur, vérifiée
  par l'audit). Aucun service payant intégré ; aucune fonction `api/` de plus (12).

## Preuves

- `node scripts/audit-accueil-reste.cjs` : 70 contrôles qui EXÉCUTENT les règles ; `--prouve` : **19/19
  mutations** rougissent (retenue retirée, N° en double adopté, archive redonnée, retenue chez un compte
  installé, « pas su » = 0, visite sur geste urgent, conseil au-delà de 30 j, lien http, Apple montré
  sans activation, aides hors SYNC_KEYS…).
- `scripts/bancs/accueil-reste.cjs` (base inventée, `BANC_PORT` aléatoire, 390 tactile et 1512, clair et
  sombre, `SHOTS=` ; `BANC_DIST=` un autre build) : A 134 (aucun N° neuf avant la réponse, 12 en rouge, « Oui » pose 4/5/9/15 sur LEURS
  annonces, « Non » numérote, compte installé jamais retenu), B 133, C 140, D 136, E 139, F 145/147,
  G 143. **Rouge sur origin/main** (build a8220150 : VRM donnait N°1…N°8 par-dessus les N° écrits, aucune
  des cartes) ; vert après. Captures regardées.
- Restés verts : build, `audit-traduction`, `tdz`, `coherence`, `variables`, `csp`, `lancement`,
  `quoi-de-neuf`, `identite`, `numero-ecrit`, `numero-*`, `numeros-*`, `reprise-numero`, `centre-aide`,
  `parcours-arrivee`, `connexions-oauth`, `fonctions-api`, `relances-essai`, `accueil-nouveaux`.

## Trouvé en route (corrigé)

- **Ma journée recouverte par « À trancher »** (arrivé avec `origin/main`, lot confort) : la règle plein écran de
  l'écran d'atelier (`.vrm-at { position: fixed; inset: 0; z-index: 20500 }`, `src/styles-confort.css`) visait aussi
  « À trancher » (`.vrm-a-trancher.vrm-at`), ouvert DANS Ma journée quand il y a 3 choses ou moins : tout l'écran
  était couvert, sans bouton pour fermer. Limitée à `.vrm-at.vrm-cf` (la classe de `EcranAtelier.jsx`).
- Le film tourné en un seul processus faisait tomber le navigateur au 3e écran : un processus par plan, mis bout à bout.

## Mesures du banc

- origin/main (a8220150) : **11 rouges** à 390 clair (aucune carte, N°1…N°8 donnés par-dessus les N° écrits, pas d'Apple).
- Après (fusionné avec origin/main 154750ed et `claude/accueil-nouveaux`) : 390 clair 47/47, 390 sombre 47/47,
  1512 clair 46/46, 1512 sombre 46/46.
- Vidéo : 39,0 s, 1,32 Mo, aucune piste audio (ffprobe), 5 pistes `.vtt`.

## Gestes de Julien

1. **Appel de bienvenue (147)** : Paramètres → Aide → « Visite, mots expliqués, conseil du jour » →
   « Lien de l'appel de bienvenue » : coller son lien de réservation (Calendly, Cal.com… en https), Enregistrer.
   Vide = rien n'apparaît. Seuls les comptes Pro le voient.
2. **Apple (143), seulement s'il le veut** : compte développeur Apple (99 €/an) → créer un « Services ID »
   (Sign in with Apple), une clé (.p8) et le domaine de retour
   `https://lgonxzrzjcqthjtbdpzo.supabase.co/auth/v1/callback` ; puis Supabase → Authentication → Providers →
   Apple : coller Services ID, Team ID, Key ID et la clé, activer. Le bouton apparaît tout seul ; tant que
   ce n'est pas fait, rien ne s'affiche. L'extension ne propose pas Apple (elle garde Google/Discord).
3. Rien d'autre : les aides sont allumées pour les comptes neufs et coupables dans Paramètres → Aide.

## Ce qui reste

- Le glossaire est posé dans les nouvelles cartes et dans chaque « ? » ; il pourra être posé sur d'autres
  écrans (titres en texte simple seulement : jamais un mot-bouton dans un bouton).
- La vidéo est tournée sur le monde inventé des films ; la retourner après un grand changement d'écran
  (`PUBLIER=1 node scripts/films/accueil-video.cjs`, jamais pendant un `npm run build`).
