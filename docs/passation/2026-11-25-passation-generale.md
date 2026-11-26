# Passation générale — 25 nov. 2026

À lire en premier par la prochaine session. Ce dossier fait suite à
`2026-11-23-passation-generale.md` (à lire juste après). Le détail de chaque lot est dans son
récit daté (`docs/passation/2026-11-24-*.md`, `2026-11-25-*.md`).

## 1. Ce qui est en ligne depuis le 24 nov. (fusionné sur `main`, Vercel OK)

| PR | ce que Julien voit |
|---|---|
| #1389 | Extension **5.440.2** : favoris lus dans TOUTE la liste des notifications (page après page, onglet derrière), « en recherche » au lieu de « trop ancien », panneau qui se redessine seul |
| #1386 | Extension **5.440.3** (servie aujourd'hui) : « Observer Vinted (10 min) » — note le chemin de la page, aucune donnée personnelle, rien envoyé à Vinted |
| #1384 | Français du démarrage 79,96 → 73,6 Ko (budget 80 inchangé) |
| #1377 | Vente vue par e-mail ⇒ SON annonce quitte « en ligne » (photo exacte), sinon « Relier à l'annonce » |
| #1376 | ~32 bancs/audits rouges sur main réparés + vrais bugs (impression sans les exclus, pseudo « Terminées », repères du tour guidé) |
| #1390 | audit-cle-verifier (`venteMailItem`) et « regles » (membres Orion) verts |
| #1321 | Revue UX : Achats iPhone, Relier, fiche, Annonces |
| #1346 | Carte « Vinted a agi » UNIQUE (réconciliée avec #1321) |
| #1391 | Paramètres → Mon compte rangé sur grand écran ; « crash après déploiement » = artefact du banc `morceau-perime` (corrigé) |
| #1392 | WCAG AA sur les 6 écrans (contrastes, noms, focus, feuilles) |
| #1341 | « À retirer » variante C + retours d'achat suivis jusqu'au remboursement |
| #1373 | Squelettes au lieu de « — » pendant la lecture |
| #1355 | Pop-ups façon jeu (photo, étiquette N°, vente fêtée), ventes en grandes photos |
| #1387 | Aucun saut au chargement (0 px) ; Argent juste dès l'ouverture |
| #1365 | Argent, Messages, Paramètres en visuels (anneau objectif, jauges) |
| #1361 | Annonces : liste plus nette, glisser ⇒ Baisser/Republier, grille virtualisée |
| #1380 | **11 styles au choix dont « Monochrome »** (Paramètres → Apparence et langue → Apparence → Style), famille de boutons commune |
| #1351 | Parcours iPhone (code au comptoir fermé par le geste retour…) |
| #1378 | **Comptoir des retraits** : code énorme + QR, tous les colis du point, « Retiré » d'un geste, hors ligne |
| #1381 | Audit « chaque bouton », 2e passe |
| #1369 (+ #1338) | « Mes envois » : chaque colis vendu suivi jusqu'au versement ; « Colis en danger » (Vinted Go qui va repartir) |
| #1385 | `src/CLAUDE.md` : règles de design vérifiables |
| #1382 | Colis Chrono Relais Europe (n° XU…JF) suivis chez Chronopost, ventes seulement |
| #1388 (+ #1314) | Vitesse A : chaque écran ne calcule que ce qu'il lit |
| #1393 | Vitesse B : lectures partagées ; Achats ~4,5 → 3,6 s, aucun écran plus lent |

## 2. En cours au moment de la passation (dans l'ordre du train)

1. **#1394** (`claude/e2e-extension-vert`, extension **5.440.4**) — PRÊTE, en CI. Vrai bug corrigé : cache
   du dressing qui gardait « 0 annonce » ; « Baisser » refusé et dit si l'extension est trop ancienne ;
   le lien `action=baisser` ouvre le panneau directement sur l'étape du prix ; e2e-extension 44/0.
   → une fois en ligne : **envoyer le zip à Julien** (`public/VRM-extension.zip` et `VRM-Orion-dossier.zip`).
2. **#1374** (`claude/agir-tout`, extension **5.450.1**, contient #1364) — PAS prête.
   - Décision de Julien du 24 nov. (mot pour mot) : « Je vais devoir répondre à mes messages, republier dans
     l'application, faire absolument tout si l'extension est connectée. Si l'extension n'est pas connectée
     sur un compte, on peut voir les données mais on ne peut pas agir dessus. » Elle REMPLACE la règle du
     20 nov. « toute action se fait dans le panneau ». C'est toujours l'extension qui exécute (mêmes
     plafonds, captcha, pause, compte de l'onglet, confirmations).
   - À faire sur la PR : inscrire cette décision dans CLAUDE.md §3 ; réécrire les 17 contrôles de
     l'ancienne règle à la NOUVELLE (connecté ⇒ `peutAgir` + confirmation + commande pour CET article ;
     pas connecté ⇒ rien ne part, panneau/lecture seule pour CET article ; mutation qui retire la porte ⇒
     rouge) ; ramener le JS (+234 Ko sur chaque écran : charger agir/connexions à la demande) et la lecture
     `presence*` en double ; localStorage non gardé (iphone-reprise) ; libellé Stock `data-a-ranger` ;
     délais annonces-actions / navigation-tache / ventes-e2 / journee-coherence / colis-retirer-propre /
     barre-achats. Déjà corrigé : plantage après-vente (`relaisVu`), T1, écran connexions, « Chrome » en dur.
3. **#1383** (`claude/messages-pro`) — attend #1374 (elle le contient) ; verte sur ses bancs (116/0).
4. **Anciens lots de vitesse** #1356, #1362, #1371, #1375, #1366 (tirés de latence-2) : mêmes défauts que
   l'ancienne #1388 (Annonces vide en e2e, « 12 sur 13 » En route). À reprendre sur `main` (qui contient
   #1388/#1393) ; les FERMER s'ils n'apportent plus de gain mesuré.
5. Le reste de la file d'avant (voir 23 nov. §train) : #1317 #1363 (scanner), #1316 #1318 #1368
   (Conseiller, paires qui dorment), #1328 #1340 #1370 (gains), #1343 #1342 #1357 (connexions),
   #1339 #1334 #1336 #1337 #1333 #1335 #1359 (débutant), #1345 #1347 #1367 #1379 #1320, les extensions
   #1327 #1311 #1329 #1331 #1348 #1350 #1353 #1352 #1372 (à renuméroter au-dessus de la dernière servie),
   puis #1221, #1189. **Jamais** : #1228, #1268, #1330, #1186, #1191, #1219.

## 3. Méthode du train (tenue toute la journée)

- Une PR à la fois : vrai `git merge origin/main` dans la branche, CI COMPLÈTE, aucune ligne rouge
  NOUVELLE par rapport à `main` (comparer par nom), `gh api …/pulls/N/merge -X PUT -f merge_method=merge`,
  puis déploiement Vercel de production vérifié. Jamais d'annulation de CI, jamais de fusion sur CI
  partielle, jamais de budget relevé, jamais de force-push.
- Les « cliquets » (audit-stockage-sur D, audit-boutons-natifs) : une PR ne doit RIEN ajouter (comparer
  par fichier à `main`). Plusieurs PR ont été bloquées pour des clés d'index ou un `<button>` brut :
  corrigées par identité / composant natif, jamais en relevant le plafond.
- Bancs : les lancer **comme la CI** (`NODE_OPTIONS=--require=scripts/bancs/_garde-reseau.cjs` quand la
  CI le charge), sinon on teste d'autres écrans que la CI.
- Machine partagée (4 cœurs, disque ~3 Go) : commandes lourdes par
  `…/scratchpad/lourd.sh` (4 places) ou `lourd-prio.sh` (1 place prioritaire) ; supprimer `dist/` et les
  worktrees finis (propres et poussés seulement).
- CLAUDE.md < 60 000 octets ; la ligne « PASSATION GÉNÉRALE » reste dans §9 (elle pointe désormais ici).

## 4. Design — où on en est (décisions de Julien du 24 nov.)

- Il a vu : « Matin » (gris clair), « Cinéma » A/B/C (sombre vitré), « Monochrome » v1/v2 (noir et blanc
  sur gris #ECEDF0, très peu de texte), « C » gris clair / gris foncé puis **C3 gris clair** (anneau bleu,
  plaques N°, chaussures sur plaque, ~48 mots sur Ma journée, iPhone ET ordinateur).
- Ses mots : « j'aime bien la 1 [Monochrome] mais tu peux faire mieux », puis « J'aime bien gris continue à
  améliorer », « montre même ordi », et « on doit mieux distinguer les boutons », « très peu de texte ».
- **Monochrome est en ligne** comme style au choix (#1380). **C3 gris clair n'est PAS encore dans l'app** :
  maquettes rangées dans `docs/design/maquettes-25nov/` (HTML + captures, données inventées).
  Prochaine étape proposée : lui demander s'il veut C3 comme 12e style (même système, `scripts/styles-generer.cjs`).
- Règles de design qui ont tenu : un seul accent rare, pas d'orange/ambre/violet, rouge = doublon de N°,
  boutons distincts par forme (plein / contour ≥ 3:1 / lien souligné / rond), flèche sur toute rangée
  touchable, AA, 44 px, peu de mots.
- Superdesign : installé mais connexion jamais validée par Julien (le code expire en quelques minutes) ;
  hôtes `superdesign.dev`, `api.superdesign.dev` ajoutés au réseau de l'environnement.

## 5. Refus tenus (ne pas reproposer)

Débogueur Chrome (`chrome.debugger`), souris/clavier simulés au-delà de ce que §3 permet, événements
fabriqués (`isTrusted:false` dispatchés — refusé encore le 24 nov. pour le défilement des favoris),
rythme « humain » pour échapper à la détection, IP/empreinte par compte. Aucune étape à la main pour
Julien quand l'extension peut la faire (« c'est à l'extension d'aller capter les favoris »).

## 6. Gestes de Julien

- Installer l'extension **5.440.4** dès qu'elle est en ligne (remplacer le dossier, ⟳ dans CHAQUE Chrome ;
  Orion : `VRM-Orion-dossier.zip`), puis Messages → Favoris → « Reprendre ».
- Essayer « Observer Vinted (10 min) » pendant un envoi à un favori (Bleam ou à la main), puis « Envoyer
  l'observation » : la ligne `observation_vinted_*` dira le chemin réel de Vinted.
- Choisir son style : Paramètres → Apparence et langue → Apparence → Style (Monochrome).
- Les gestes plus anciens (Stripe, Supabase, e-mails, 016…) : CLAUDE.md §9 « Gestes encore attendus ».
