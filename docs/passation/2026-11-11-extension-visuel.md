# 11 nov. — L'extension aussi belle et pratique que l'app (lot extension-visuel) — extension 5.351.0

Branche `claude/extension-visuel` (depuis `origin/main`, refusionnée avant la fin). Demande de
Julien : « l'extension VRM aussi belle et pratique que l'app ». Rien de fonctionnel retiré, aucun
garde-fou touché (compte de l'onglet, 50 actions/h, une requête à la fois, pause 429/403), **aucune
requête nouvelle vers Vinted** (le banc le vérifie sur le vrai `background.js`). Version 5.351.0
(5.343–5.350 réservées à d'autres lots).

## Ce que Julien voit

**La carte du logo** (Vinted, Leboncoin, eBay, Vestiaire) :

1. **Un message principal en tête**, une ligne, 12 mots au plus : « shop_x · à jour à 14:05 ✓ »,
   « À connecter à VRM », « Pause : Vinted freine · reprise à 13:34 », « Mises en ligne en pause
   · reprise à … », « Dernier envoi refusé : voir ci-dessous », « 2 paires à retirer de
   Leboncoin »… Point gris quand tout va bien (§7), **ambre seulement s'il y a un geste**, cerclé
   gris pour « Vinted freine » (une attente, pas une panne).
2. **Connecté : « Ouvrir VRM » puis Colis · Messages · Offres**, à un clic (souris ET doigt).
   Le service worker ouvre l'écran nommé (`ECRANS_CARTE`, liste blanche : `cat_bord`,
   `messages`, `messages&vue=favoris`, `journee`) ; un nom inconnu ouvre VRM comme avant.
3. **Le détail est replié** (« Détails » : compte VRM, compte du site, envois, historique des
   refus, « Changer de compte VRM », « Réduire le logo », « Logo en bas à droite ») — **ouvert tout
   seul** dès qu'il y a un geste, un compte ignoré (« Capter ce compte » reste sous les yeux) ou
   juste après la connexion (« C'est fait »).
4. **Leboncoin** : les trois lignes Compte · Annonces · Ventes (sa décision du 9 nov., 5.335)
   RESTENT le message principal, visibles ; pas de ligne de résumé en double.
5. **Cartes de progression** : « Dates de versement en cours de lecture · N restantes · environ
   X jours » et « Ton historique Vinted » (import de départ, 5.344, fusionné depuis `main`)
   restent visibles sous le message principal, jamais repliés — « Tout est récupéré ✓ » compris
   (c'est le signal promis : il laisse vinted.fr ouvert jusque-là).
6. **Le logo se glisse** (souris ou doigt) et **retient sa place par site** (`vrmBadgePos`,
   stockage local) ; la carte s'ouvre du côté où il y a la place (haut/bas, gauche/droite) et
   reste dans l'écran (390 et 1512 px) ; un glisser n'ouvre jamais VRM (le clic qui suit est
   mangé). **« Réduire le logo »** en fait une pastille de 30 px semi-transparente
   (`vrmBadgeMini`).
7. **La teinte choisie dans VRM** (Réglages → Apparence : clair, sombre, le soir ; automatique
   = le système) s'applique à la carte ET à la fenêtre de l'icône. Le pont de vrm.center
   (`bridge.js`) recopie le MODE seul (`vrm_apparence`, sinon `vinted_dark`) dans
   `vrmApparence` ; un mot hors liste n'écrit rien.
8. **Entrée douce** de la carte (0,18 s), **aucune** avec `prefers-reduced-motion`.

**Pas changé, exprès** : les infos sous ses annonces (« N°124 · acheté 60 € · en ligne depuis
23 j ») et l'encart « VRM » / calculette suivent déjà la page de Vinted (clair/sombre de
Vinted) au style de l'app — captures regardées, rien à reprendre sans risque. La fenêtre de
connexion garde ses textes ; seule la teinte de l'app s'y ajoute.

**Essayé puis retiré** : un raccourci clavier (manifeste `commands`, Alt+Maj+V). Il changeait le
manifeste Orion, figé sur une référence installée sur iPhone (`orion-base-validee` rouge) — pas
« simple » ici. À reprendre seulement avec une nouvelle référence Orion validée sur l'appareil.

**Pas fait** : « mise à jour disponible » dans la carte — l'extension ne connaît pas la dernière
version publiée sans une lecture de plus (l'app, elle, le dit déjà avec `EXT_ATTENDUE`) ; la
jauge 50/h et le journal restent dans l'app (`src/jaugeActions.js`) : un compte de CE Chrome seul
serait un total partiel présenté comme complet.

## Gestes comptés (avant → après)

| geste | avant (5.342) | après (5.351) |
|---|---|---|
| savoir si tout est à jour | survoler + lire 3 lignes (« Compte VRM », « Compte Vinted », « Tes données ») | survoler + lire **1 ligne** |
| ouvrir VRM sur les colis à poster | clic logo (VRM s'ouvre sur la plateforme) + aller à Colis = 2 clics | survoler + **1 clic** « Colis » |
| se connecter | logo → e-mail → code (inchangé) | inchangé (déjà le minimum : 5.329–5.332) |

## Fichiers

- `vinted-sync-extension/vrm-badge.js` : `resumeEtat` (une ligne, mêmes sources que le détail),
  raccourcis, `<details data-detail>`, glisser (`pointerdown/move/up`, capture, seuil 6 px),
  `placer`/`enregistrerPlace`/`poserMini`, `appliquerTeinte`, animation, image non tirable
  (sinon le navigateur annule le glisser par un `pointercancel` — trouvé au banc).
- `vinted-sync-extension/background.js` : `ECRANS_CARTE` + `ouvrirVRMDepuis(url, {ecran})` ;
  `etatSite` dit `site.pause` et `site.frein` LUS dans `chrome.storage.local` (aucune requête).
- `vinted-sync-extension/bridge.js` : `recopierApparence`.
- `vinted-sync-extension/popup.html` / `popup.js` : `data-theme` (teinte de l'app).
- Versions : `CODE_VERSION`, manifeste, `EXT_ATTENDUE`, `lbc-inject.js`, `lbc-relay.js` ; zips
  Chrome + Orion régénérés (aucun fichier ajouté au paquet Orion).

## Preuves

- **Banc neuf** `scripts/bancs/extension-visuel.cjs` (63 contrôles : message principal, repli,
  pause sans ambre, raccourcis ≥ 44 px, écran nommé, glisser/retenir/pastille dans l'écran,
  teinte carte + fenêtre + pont, mouvement réduit, fond en VM). **Rouge sur `origin/main`**
  (31 rouges, arbre `git archive`). **Mutations** : détail jamais ouvert, pause en ambre, écran
  hors liste, pont sans liste, mouvement réduit ignoré, teinte claire ignorée, clic après glisser
  ⇒ chacune rouge. (L'image tirable a trois protections : en retirer deux ne rougit pas.)
- Bancs existants adaptés : `badge.cjs` et `carte-orion-sans-onglet.cjs` ouvrent « Détails » le
  temps de lire (les règles restent jugées sur le texte de la carte) — 132 et 67 verts.
- Captures avant/après (clair et sombre, 1512 et 390) regardées.
- Après `git merge origin/main` : build, audits demandés + audits/bancs extension (dont
  `audit-import-depart`, `import-depart`), `orion-base-validee`, `orion-garde-regression` verts.
  ⚠️ `audit-coherence` est rouge dans un clone SUPERFICIEL (règle de `main` du 11 nov. : « pas
  su ») : `git fetch --unshallow origin main`, puis vert.
