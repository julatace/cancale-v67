# Passation générale — 23 novembre 2026 (soir)

À lire après `CLAUDE.md`. Remplace `2026-11-22-passation-generale.md` comme point d'entrée.
Écrite par la session qui a piloté ~25 agents le 23 nov. (démo publique de Julien à 17 h Paris).
« En ligne » = vu fusionné sur `main` + Vercel success. Tout le reste est sur une branche/PR, pas plus.

## 0. Méthode (inchangée — elle marche)

- Brief commun des agents : `docs/passation/file-attente-16nov/00-brief-commun.md` (worktree par lot, `lourd.sh` 3 créneaux, push à chaque commit, PR par REST — GraphQL interdit —, règle de fusion : **aucun rouge nouveau vs la CI du dernier main**, Vercel success).
- `lourd.sh` et `versions-reservees.txt` sont dans le scratchpad de la session (`/tmp/claude-0/-home-user-cancale-v67/01ffd5bd-.../scratchpad/`) : **ils disparaissent avec le conteneur** ; si absents, recréer `lourd.sh` (flock sur 3 verrous) et repartir des versions ci-dessous.
- **Disque** : l'allocation se remplit vite (bancs, dist, copies « avant »). Supprimer régulièrement les dossiers du scratchpad non modifiés depuis 1–2 h et les worktrees fusionnés. Ne jamais lancer `git sparse-checkout` dans le clone principal (fait par erreur le 23 nov., annulé aussitôt).
- **CI GitHub saturée** le 23 nov. (50–70 runs en file, jobs Audits/Bancs 2 h d'attente, Bancs 2/3 toujours annulé). Comparer job par job avec la CI d'une PR récente proche de main ; `scratchpad/integ/etat.sh <lot>` (agent intégration) aide.
- Les audits ne tournent PAS sur les push de main (seulement sur les PR) : prendre comme référence une PR fraîchement fusionnée.
- Environ **31–34 audits rouges sont déjà rouges sur main** (liste stable : arrivee-sans-gel, boutons-natifs, colis-trois, config-facture, coque-parametres, fiabilite-auto, gestes-fluides, parametres, plans-solo-pro, portee-modules, rouge, rouge-doublon, vendeur-generaliste, ventes-e2, vocabulaire-article…). Jobs CI rouges sur main : `regles`, `comptes-et-reception`, écrans `argent-mois` (banc périmé, chiffre juste), `offres-objectif`, `parcours-quotidien`, `bureau-chargement`, `comptes-securite`. Bancs `natif-coque` et `aujourdhui-propre` rouges sur main aussi.

## 1. En ligne le 23 nov. (`main` = 96db7a3e1)

| PR | Quoi |
|---|---|
| #1301 | Extension **5.438** (favoris/cloche, santé, compte précieux) |
| #1302 #1303 #1305 #1309 | Design « noir encre » tranches 1–4 (remplacé demain par le gris clair, §2) |
| #1304 | Latence : listes par paquets (Achats 2,0 → 0,8 s, Ventes 1,1 → 0,7 s) |
| #1306 | Robot « chaque bouton » : 26 boutons cassés réparés (Catalogue 12,50 → 1250 corrigé…) |
| #1307 | Ventes annulées par plateforme, Vestiaire « en attente de validation », ext. **5.439** |
| #1237 #1223 #1232 | Rappel avant prélèvement · Reprendre là où j'étais · barre du bas iPhone |
| #1308 | Extension **5.440** : nouvelle messagerie Vinted (`/messaging/main/inquiries`, `/inbox/{uuid}`), `vrm-trouver.js`, fenêtre d'envoi refaite, notification Vestiaire (permission `notifications`) — **servie** |
| #1313 | Achats ne plante plus (« Icon is not defined », colis sans photo) + `audit-identifiants-libres` |
| #1315 | Achats à l'ordinateur : plus de moitié vide (grille `ventes-verre.css`), « … » revenu |
| #1322 | **Mode présentation** (Paramètres → Apparence et langue → « Quand tu filmes » ; bouton écran à côté de l'œil ; pastille) |

Production surveillée pendant la démo : 0 plantage, 0 erreur Vercel, 0 5xx ; parcours CI « comme un client » vert pour la 1re fois depuis le 22 nov.

## 2. Train de fusions du 24 nov. (à partir de 07:00 UTC) — ordre conseillé

Une PR à la fois : vrai `git merge origin/main`, build, CI comparée, merge `gh api repos/julatace/cancale-v67/pulls/<n>/merge -X PUT -f merge_method=merge`, Vercel success, puis la suivante. Un rappel planifié de la session déclenche ce train à 07:05 UTC.

1. **#1325** demo-titre (un seul titre sur Aujourd'hui ordi, « · » collés).
2. **#1323** photos-nettes (`src/photoTaille.js`, visionneuse progressive ; 693 achats restent 150×210 jusqu'à la 5.443).
3. **#1310** bugs-totale (bordereau d'une vente e-mail sans n° → colis ; boucle de rendus divisée par 2).
4. **#1319** isolement (bordereau e-mail en temps réel ; isolement entre utilisateurs PROUVÉ, 0 faille).
5. **#1326** style-clair — **nouvelle apparence décidée par Julien** (gris clair étagé variante A, accent ardoise #3D4B5B, **plus aucun orange/ambre**, plus de grands aplats noirs ; gris foncé = mode sombre optionnel ; carte d'événement/pop-ups ; galerie « Voir tous les pop-ups » propriétaire ; iPhone compact ; dessin fin). Tous ses bancs verts. #1312 fermée.
6. **#1321** revue-ux (Achats iPhone, Relier distinguable, fiche « Prix d'achat », Annonces « Relier un achat » dans « … », Argent, verdict unique extension, annonces disparues en feuille avec photos, logos transporteurs complets).
7. Retours/À retirer (branche `claude/retours-suivi`, PR à ouvrir) : À renvoyer variante A (frise, étapes impliquées « date pas vue »), À retirer variante C (par point relais). **+ bug du point relais « pas encore connu »** (Vinted Go, capture `scratchpad/captures-julien/aretirer-point-inconnu.jpg`) en cours de diagnostic par cet agent.
8. **#1314** latence-2 (re-rendu Comptabilite supprimé, Annonces gardée ; démarrage à mesurer).
9. **#1317** scan-achat · **#1316** puis **#1318** conseiller (tranche 2 = clé Claude du VENDEUR, jamais celle de Julien) · **#1328** eBay en série.
10. Lots du 16 nov. prêts (agent intégration, récit #1324) : #1235 (+#1227), #1224, #1229, #1241, #1234, #1218, #1225, #1222, #1233, #1212, #1215, #1231, #1238. **#1189** serveur (après tout le reste, change le comportement serveur). #1221 stock à finir (contraste banc 1,19:1 inexpliqué). #1228 à reprendre seul (banc 20 000 ventes).
11. **#1320** tutos/site — APRÈS #1326 : refaire captures/films au gris clair (`PUBLIER=1`), puis Julien recolle les 6 modèles e-mail Supabase.
12. **Extensions dans l'ordre** : #1327 **5.441** → (5.442 = train #1186/#1191/#1219 à REFAIRE, conflits de fond) → #1311 **5.443** → #1329 **5.444** (contient 5.443) → #1331 **5.445**. Si une version manque, prendre la plus haute servie + 1 et régénérer les zips (`node scripts/zip-extension.cjs`). Envoyer à Julien **une seule** extension finale (Chrome + Orion).

Agents encore actifs le 23 au soir (leur travail est poussé ; reprendre depuis leur branche) : six fonctions (rentabilité par source, calendrier, mes données, appareils connectés, photos en un geste, historique paire), litiges/colis en danger/achats hors Vinted/export comptable/objectif/démarrage guidé, Republier à la main refait, audit-boutons-2, conseiller (version « incroyable » : synthèse, groupes, sans orange, présentation animée).

**#1330 `codex/vrm-cloud-pilot` n'est pas de cette session** : ne pas fusionner sans l'avoir lue (voir §4 sur le cloud).

## 3. Décisions de Julien du 23 nov. (ne pas re-négocier)

- **Apparence** : gris clair étagé (variante A froide), cartes presque blanches, texte #1D1D1F, accent ardoise unique et rare, **aucun orange/ambre** (« à faire » = gras + accent), rouge réservé aux deux paires sous un N°. Le gris foncé de vrm.center reste la page publique et le mode sombre.
- **iPhone** : simple, minimaliste, premium, **moins zoomé** (texte ~15 px, cibles ≥ 44 px, champs ≥ 16 px).
- **Règle « trop de texte, pas assez de beaux boutons »** : ≤ 1 phrase courte (≤ 8 mots) par bloc, détail sous « Pourquoi ? », actions = boutons icône + verbe (composants `Actions`/`Pourquoi` dans `src/natif/Actions.jsx`), banc `textes-visibles` (plafonds qui ne font que descendre).
- **Pop-ups** : beaux, photo par identité, empilement « +2 », galerie admin.
- **Favoris Vinted** : 15/h/compte, par la cloche réelle (entre enveloppe et cœur, « Voir tout » est un bouton, ligne choisie par son lien `offering_id`, jamais par son texte) ; relances permises mais jamais deux fois le même texte à la même personne pour le même article ; modèles en rotation ; ralentir/arrêter au moindre signe. Retirés à sa demande : démarrage progressif, séances/plafond quotidien, « un seul compte à la fois ».
- **REFUSÉ par les permissions de la session (ne pas reproposer, ne pas contourner)** : vrais clics `chrome.debugger`, rythme/gestes « humains », intermèdes de navigation destinés à paraître humain auprès de Vinted. **Refusé aussi** : une IP / empreinte par compte pour cacher le lien entre comptes, et l'hébergement des comptes Vinted dans un navigateur cloud. Alternatives proposées : relais par SON ordinateur (à tester sur vrai compte), Vinted Pro.
- **Conseiller** : conseils sans IA pour tous ; « Demande à VRM » seulement avec la clé Claude du vendeur (y compris Julien).
- **Leboncoin / Vestiaire / eBay** : eBay offres aux observateurs + remise en vente par l'API officielle (prix vu revérifié, 1 offre/48 h) ; Leboncoin : pas de favoris nominatifs, républier = supprimer/recréer sur son clic — **question ouverte** : relier annonce LBC ↔ paire par le **N° écrit en fin de description** (proposé, réponse de Julien attendue) ; Vestiaire : « vient d'aimer » nominatifs → offre sur son clic après recette apprise.
- Notification ordinateur quand Vestiaire valide/refuse (oui).
- Lots, retours, scan d'achat, porte-monnaie (« Montant en attente » en premier) dans Ma journée : validés.

## 4. Points ouverts / à vérifier

1. **Point relais « pas encore connu »** (Vinted Go) — diagnostic en cours (agent retours-suivi).
2. **Compte shop_cancale signalé « modéré par Vinted »** ce matin + 5 annonces disparues (21→23 nov.) : Julien doit lire ses messages Vinted ; ne pas relancer favoris/republication sur ce compte avant.
3. Favoris 5.440/5.441 jamais essayés sur vrai compte : à faire avec Julien, ligne par ligne.
4. Republication : plan dans `claude/republication-intelligente` (`docs/passation/2026-11-23-republication-plan.md`, débogueur RETIRÉ) ; aucune republication réelle depuis le 1er nov. ; formulaire jamais essayé en vrai.
5. 7 e-mails en quarantaine (propriétaire neutre) à réclamer par Julien.
6. Bancs à porter sur `data-*` du nouveau design : `volume-lbc-vestiaire`, `aujourdhui-propre`, `natif-coque`, `argent-mois`.
7. Les captures que Julien envoie dans le chat ne sont **pas toutes** enregistrées dans `images/` : vérifier le contenu (md5) avant de les donner à un agent (erreur du 23 : captures LBC remplacées par des VC).

## 5. Gestes de Julien

- Installer l'extension finale du train (une seule) dans chaque Chrome et Orion ; accepter les autorisations (notifications).
- Vestiaire : ouvrir Annonces, chaque vente (surtout le litige), Commandes, cloche, messagerie ; faire une offre et répondre une fois soi-même (apprentissage).
- Leboncoin : ouvrir Messages, Mes transactions (Ventes, Achats), son compte ; renvoyer les vraies captures du panneau.
- Installer les plugins (rappel planifié le 24 à 9 h Paris) : UI Design Review, finecomb, Backend Design, claude-code-review-council.
- Anciens gestes inchangés (`CLAUDE.md`) : migrations 016/042, Stripe, mentions légales, etc.

## 6. Pour reprendre

1. `git fetch`, lire ce fichier, vérifier `main` et Vercel.
2. Lancer le train §2 (ou vérifier qu'il a tourné : rappel 07:05 UTC).
3. Envoyer à Julien la dernière extension + un récapitulatif court en français simple.
4. Ne jamais dire « parfait » : dire ce qui est vérifié et ce qui ne l'est pas sans vrai compte.
