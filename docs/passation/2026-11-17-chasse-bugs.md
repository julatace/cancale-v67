# Chasse aux bugs VRM — 17 nov. 2026 (branche `claude/chasse-bugs`)

Méthode : base inventée des bancs (jamais la vraie base en écriture), build d'`origin/main` (40cb64c9d), Chromium 390 tactile et 1512 ;
parcours de chaque écran au doigt en touchant chaque bouton (script `chasse.cjs`, scratchpad) ; journal des plantages de production
lu en lecture seule (projections scalaires) ; erreurs Vercel 7 jours (0). WebKit : non installable dans ce conteneur — joué par la CI.

Légende : 🔴 données/argent faux, bloquant · 🟡 gênant · 🟢 cosmétique. ✅ corrigé ici · 🔁 réglé par une PR ouverte · 📋 banc périmé (pas un bug).

## 🔴 Données, argent, blocage

### 1. ✅ « Imprimer les 3 bordereaux » alors que 4 sont cochés (capture de Julien, Ventes à l'ordinateur)
- Étapes : Ventes → À envoyer, 3 ventes cochées + 1 RETOUR coché (« tu renvoies un achat »).
- Ce qui se passe : le bouton dit « Imprimer les 3 bordereaux » + une pastille « + 1 retour » ; les QUATRE partent dans le même PDF.
  « 2 colis n'y sont pas · Choisir » ne dit pas lesquels. Ma journée dit aussi « Imprimer les 3 bordereaux ».
- Attendu : le nombre du bouton = ce qui est coché et ce qui part : « Imprimer les 4 bordereaux · dont 1 retour » ; « N°193 attend son bordereau · Choisir ».
- Où : `src/App.jsx` pied de Ventes (~56553), plein Studio (~55309), barre (~55275), feuille « Choisir » (~55791), Ma journée (`tuiles.envoyer.emballer`, ~48831 / ~50644).
- Correctif : `src/lotSelection.js` `nombreAImprimer`, `libelleImprimer`, `texteExclus` (une règle pour les 5 boutons) ; `resumeLot` rend `exclus` nommés ;
  les colis de la liste sans ligne de lot (aucun bordereau) sont nommés aussi ; plus de pastille « + N retours ».
- Preuve : banc `imprimer-compte-exact` (1512 + 390 : bouton = cases cochées = étiquettes du PDF ; Ma journée même nombre ; « Choisir » nomme N°43) —
  origin/main 9 rouges, mutation (le retour non compté) 9 rouges, après vert. `impression-retours` R2 porté sur la règle (42/42).

## 🟡 Gênant

### 2. ✅ « J'ai déclaré » / segments d'Argent : l'écran s'ouvre au milieu de la page (captures iPhone de Julien)
- Étapes : Argent → Déclarer → « J'ai déclaré » (ou changer de segment Résumé/Statistiques/Déclarer/Factures après avoir fait défiler).
- Ce qui se passe : `MemoireDefilement` rendait à chaque écran sa position d'une visite d'avant, quelle que soit l'arrivée, ne remettait jamais
  la zone à 0 (la même `.vrm-main` gardait le défilement de l'écran d'avant) ; les 4 segments d'Argent partageaient une seule clé.
- Attendu : une action qui change d'écran/segment ouvre EN HAUT ; revenir par la barre garde la position ; retoucher l'onglet allumé remonte.
- Où : `src/App.jsx` `MemoireDefilement` (~20150), clé `ecran` (~66523), clic de la barre (~20345).
- Correctif : `src/defilementNavigation.js` (règle unique : `positionAOuvrir`, `revenirSurOnglet`, `cleDefilement`) ; clé avec le segment pour Argent ;
  l'onglet allumé retouché remonte même sur Statistiques (avant : il ramenait à Résumé).
- Preuve : banc `defilement-navigation` (N1–N7).

### 3. ✅ L'onglet allumé de la barre ≠ l'écran montré (capture : Argent à l'écran, « Ventes » allumé)
- Cause trouvée dans le code : la barre allumait `vise || tab` (le dernier onglet TOUCHÉ tant que `vise` n'était pas effacé) ; désormais le toucher
  ne l'emporte que PENDANT sa transition. Non reproduit sous Chromium (probablement WebKit : retour de feuille qui change d'écran) — N6 vert sous
  Chromium sur main ; joué sous WebKit par la CI.

### 4. ✅ « À vérifier » : un colis dont le code n'est pas encore lu porte la puce « Incident »
- Étapes : Achats → À retirer → À vérifier (décision du 14 nov. : aucun colis sans code dans « À retirer »).
- Ce qui se passe : la raison « Code pas lu dans l'e-mail du **transporteur** » contient « transporteur », que la règle de texte lit comme un incident.
- Correctif : `src/statutAVerifier.js` (l'état machine `sans_code` d'abord ⇒ « Code pas encore lu », 5 langues). Preuve : `audit-statut-a-verifier` (+ `--prouve`) ;
  `colis-retirer-propre` exige « Code pas encore lu » ×2 et jamais « Incident ».

### 5. 🔁 Focus clavier peu visible (2,36:1), arrêts invisibles — #1244 (accessibilité).
### 6. 🔁 Vocabulaire « paire » hors Sneakers, notifications, cibles 44 px (Annonces, Achats, Compta, Stats), « · aucun compte relié » — #1215.
### 7. 🟡 (non corrigé, passé à l'agent vitesse) lectures en double : `vrm_avis_bas` lue 2× sur chaque écran, `panel_num_reserves` 5× sur Achats (budget-vitesse).

## 🟢 Cosmétique

### 8. ✅ Ma journée 390 : le crayon « Modifier » de la carte du mois recouvre « Bénéfice · mois » (journee-coherence E6) — `src/design/verre-journee.css`.
### 9. ✅ Ventes 1512 : « 1 colis : transporteur pas encore lu » passait sous la barre du haut — rangé DANS la liste (`vv-pas-lus`).
### 10. ✅ Le bas de page sous la barre (capture Argent « Imprimer / Télécharger en PDF ») — mesuré par `defilement-navigation` N7 (voir le récit pour le résultat).
### 11. 🟢 (non corrigé) Achats 390 : « À retirer 2 » écrit deux fois (sélecteur + titre de section) ; Colis « Argent à vérifier » : 15 px d'air au lieu de 20–40.

## Production
- Journal des plantages : 16 nov. iOS « CSP connect-src ← p.vintedgo.com / pickup-services.com » (copie des QR) — 🔁 réglé sur main par #1245.
  12 nov. « reading 'default' » / 11 nov. « e.FactureVente » (morceaux périmés) — réglés le 14-15 nov. (chargementSur). Rien depuis.
- Vercel : aucune erreur d'exécution sur 7 jours.

## Rouges de main, triés
| rouge | verdict |
|---|---|
| audits vendeur-generaliste, vocabulaire-article, notifs-redaction | 🔁 #1215 |
| nouveau-vendeur, annonces-actions, navigation-tache, statut-colis, chiffres-coherents, ventes-e2 (annul), budget-vitesse (JS) | 🔁 #1215 |
| accessibilite-clavier (focus, arrêts invisibles) | 🔁 #1244 ; reste la garde réseau `images1.vinted.net` (banc) |
| colis-retirer-propre | 📋 périmé (règle du 14 nov. « aucun colis sans code », détail en fiche prop. 62) — porté ici + vrai bug 4 |
| retraits-suivi R5/R7/R8 | 📋 périmé (détail dans la fiche, prop. 62) — porté ici |
| morceau-perime | 📋 périmé (15 nov. : rechargement seulement vers une AUTRE version ; plus de « Plus ») — porté ici |
| iphone-reprise B1/B3–B6/O | 📋 périmé (barre flottante 14 nov. ; choix n° 61 : menu de l'avatar ; rail commun 15 nov.) — porté ici |
| journee-coherence E6 | ✅ bug 8 ; E7/E8 WebKit seulement (non jouables ici) |
| ventes-e2 G, tout-imprimer (WebKit) | WebKit seulement, non jouables ici — restent |
