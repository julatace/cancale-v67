# 21 nov. 2026 — Extension 5.415.0 : la connexion de l'extension, simple et sûre

Branche `claude/extension-connexion` (reprise d'une session interrompue : banc écrit, fenêtre refaite non commitée,
sauvegardée « En cours »). Pas de PR, pas de fusion (l'intégrateur). Zips NON régénérés.

Julien (21 nov.) : « même l'extension au moment de la connexion, ça doit s'améliorer, ce n'est vraiment pas bien,
le code est pourri ».

## 1. Le banc de bout en bout — `scripts/bancs/connexion-extension.cjs`

Vrai Chromium, VRAIE extension chargée (`--load-extension`, service worker MV3, pont, `externally_connectable`),
VRAI build de l'app (`dist/`), servis en local sous leurs vrais noms par `_e2e-monde.cjs` (DNS redirigé, rien ne
sort, jamais la production, données inventées). Dix cas : installation neuve · « Se connecter » VRM pas connecté ·
VRM déjà connecté · session morte · renouvellement en panne (GoTrue 503) · « Se déconnecter » VRM ouvert · deux
comptes VRM · Orion simulé (pas de canal adressé, pas de menu) · mise à jour de version (dossier remplacé + ⟳,
CDP `Extensions.loadUnpacked`) · worker tué au milieu de la liaison (CDP `ServiceWorker.stopWorker`) + attente sans
suite. Usage : `npm run build && BANC_PORT=48xx node scripts/bancs/connexion-extension.cjs [--seul 2,7]` ;
`BANC_EXT=<autre extension>` pour la preuve sur l'ancien code ; `BANC_CAPTURE`, `BANC_MESURES`.

**Résultat : 5.415.0 → 46 verts, 0 rouge ; extension d'origin/main (5.410.8) → 21 verts, 25 rouges.**

| mesure | 5.410.8 (main) | 5.415.0 |
|---|---|---|
| fenêtre à l'installation | 2 champs, état non dit (`data-connexion` absent), « Me connecter » | 0 champ, état `deconnecte`, une phrase, « Se connecter » |
| session morte | 2 champs à retaper | « Se reconnecter », 0 champ, réparée en 2,5 s |
| renouvellement en panne | « Connectée — ta session se renouvelle, un instant » pendant 15 s et plus, sans fin | « en cours » 3 s, puis « VRM ne répond pas… réessaie à 15:57 » + « Réessayer » (connecté 259 ms après) |
| « Se déconnecter », VRM ouvert | reconnectée en douce au battement suivant (26 s) | tient ; « Se connecter » la relie (2,4 s) |
| retour sur vinted.fr après la liaison (Chrome / Orion) | non / non (on restait sur VRM) | oui / oui |
| fenêtre après la liaison | fermée, rien dit | « Connecté à VRM · vendeur@… · Vinted : vendeur_a » |
| deux comptes VRM | la fenêtre ne nomme aucun compte | nomme A, puis B après « Ouvrir VRM » (VRM ouvert sur B) |
| attente sans suite | rien dit | « VRM est ouvert : connecte-toi… J'attends jusqu'à 16:13 », puis 15 min ⇒ « La connexion n'a pas abouti » |
| worker tué au milieu | liaison en 3,5 s | liaison en 2,3 s (tout dans `chrome.storage`) |
| mise à jour de version | toujours connectée | toujours connectée |

## 2. Les défauts trouvés

| # | cause | ce que Julien voyait | correction |
|---|---|---|---|
| 1 | `popup.js` (5.410.8) : fenêtre à deux chemins (formulaire d'abord, « par le site VRM » en dernier, Google/Discord, mot de passe) et aucun état lisible | deux champs et plusieurs boutons à l'ouverture, pas de phrase qui dit où on en est | une phrase d'état, UN plein (`data-se-connecter`), recours « Me connecter ici, sans ouvrir VRM » (e-mail + mot de passe, Google/Discord activés) |
| 2 | état lu à trois endroits (`authEtat`, minuteries de la fenêtre, carte) | « un instant » sans fin quand VRM ne répond pas | UNE source : `etatConnexion` (background.js) — `connecte · renouvellement · pause · attente · expiree · deconnecte`, tout lu dans `chrome.storage.local` (§4.9) ; la fenêtre ne montre jamais « renouvellement » plus de 12 s |
| 3 | `demanderLiaison` : « aucune session » ⇒ besoin, même juste après SON « Se déconnecter » | se déconnecter ne servait à rien : VRM ouvert la reconnectait en 20 s | marque `vrmDeconnexionVoulue` (posée par `authLogout`, levée par toute session vivante) ; l'app sans geste reçoit « pas besoin » ; son geste (« Se connecter », ou « Brancher à mon compte » dans l'app : `assurerSessionExtension({ geste: true })` ⇒ `force`) la relie |
| 4 | `lierAvecVRM` ne gardait pas l'onglet de départ | après la liaison, on restait sur VRM (Orion : « ça change de page ») | `retour` (onglet du site, revérifié par `retourOAuthPermis`) rangé avec la demande ; `revenirApresLiaison` 300 ms après la session reçue |
| 5 | `popup.js` (première version de la reprise) : `depuis=(\d{1,9})` | 1 fois sur 3 au banc, pas de retour : les identifiants d'onglet ont 10 chiffres | `\d{1,15}` + `Number.isSafeInteger` (`audit-connexion-simple` S5) |
| 6 | `compteVintedIci` lisait le cookie de `vinted.fr` | « Vinted : pas connecté ici » alors que le compte est ouvert (le cookie est posé sur l'hôte `www.vinted.fr`) | `compteConnecte('www.vinted.fr')`, la même règle que la page « Extension » de l'app |
| 7 | le message `lierAvecVRM` prenait `sender.tab.url` même quand la fenêtre est un onglet de l'extension | VRM ouvert sur l'écran par défaut | l'adresse de la carte seulement si c'est un site (`retourOAuthPermis`), sinon celle que la fenêtre nomme |
| 8 | clic sur l'icône (connectée, session expirée) : un chemin à part | — | `surClicIcone` nommé, la MÊME demande que « Se connecter » |
| 9 | `popup.html` : `#formMdp` alors que l'élément est `#mdpForm` ; titre en capitales | le titre du formulaire mal posé | `#mdpForm`, sans capitales |
| 10 | un commentaire « posé par popup.js » dans `popup.html` | (paquets Orion/Firefox : `indexOf('popup.js')` trouvait le commentaire) | commentaire reformulé (orion-paquet, audit-extension-navigateurs verts) |
| 11 | une relecture (stockage) redessinait le formulaire | le texte tapé disparaissait | formulaire ouvert jamais redessiné par une relecture |

## 3. Le parcours (5.415.0)

- **Pas reliée** : « L'extension n'est pas encore reliée à ton compte VRM. » · plein **Se connecter** · lien
  « Me connecter ici, sans ouvrir VRM ». Trois phrases distinctes : jamais reliée / « Tu as déconnecté
  l'extension de VRM » / « La connexion n'a pas abouti » (attente de plus de 15 min).
- **Se connecter** = la liaison existante (`lier-extension=<id>`, nonce, session fabriquée par le serveur et
  ADRESSÉE à cette extension ; Orion : par le pont). Aucun jeton dans une adresse, aucun secret nouveau.
  VRM déjà connecté : un toucher (2,5 s). Sinon : la connexion dans VRM, puis retour sur l'onglet du site.
- **Attente** : « VRM est ouvert : connecte-toi dans l'onglet VRM… J'attends jusqu'à HH:MM » · « Revenir sur
  VRM » · « Annuler ». Bornée à 15 min.
- **Connecté** : « Connecté à VRM » · Compte VRM · Vinted (login lu, sinon « pas connecté ici », jamais deviné)
  · plein « Ouvrir VRM » · « Se déconnecter ».
- **Panne** : « VRM ne répond pas pour l'instant. L'extension réessaie toute seule à HH:MM ; rien n'est perdu. »
  · « Réessayer maintenant » (`renouvelerMaintenant` : pause levée, un renouvellement).
- **Expirée** : « Ta session VRM a expiré. » · compte nommé · « Se reconnecter ».
- **Muet / code d'avant** : la fenêtre lit `authEtat` d'un fond d'avant la 5.415 ; muet ⇒ le geste ⟳ ; « Se
  connecter » sur un code périmé ouvre VRM quand même puis répare (⟳ une fois par version).
- Les textes de la fenêtre en 5 langues (langue du navigateur). La carte du logo (`?mode=carte`) et la
  réparation (`?mode=reparer`) sont inchangées.

⚠️ **Décision à confirmer par Julien** : le 8 nov. (5.328) il avait dit « je ne veux pas avoir besoin d'aller
sur le site pour connecter l'extension » (le bouton d'alors ouvrait VRM et, sur Orion, ne reliait pas). La
5.415 remet « Se connecter » sur la liaison par VRM, parce qu'elle marche maintenant partout (Orion compris, cas
8) et revient sur l'onglet du site ; la connexion DANS l'extension (mot de passe, Google, Discord) reste à un
toucher (« Me connecter ici, sans ouvrir VRM »). S'il préfère le formulaire d'emblée, c'est l'ordre de deux
blocs dans `rendre()` de `popup.js` (et les cas 1/4/8 du banc).

## 4. Preuves

- `connexion-extension.cjs` : 46/46 sur la 5.415 ; 25 rouges avec `BANC_EXT` = l'extension d'origin/main.
- `audit-connexion-simple.cjs` (nouveau, vrai background.js dans `_fond-vm`) : 13/13 ; 11 rouges sur origin/main ;
  mutations (`raison = 'aucune'` sans la marque ⇒ S3 rouge ; `\d{1,9}` ⇒ S5 rouge).
- `scripts/bancs/popup.cjs` refait sur le contrat 5.415 (vrai popup.js + vraie feuille vrm-ui.js, faux `chrome`) :
  83/83 ; 32 rouges sur origin/main. (L'ancien banc avait 14 rouges sur main : `vrm-ui.js` servi en HTML.)
- `audit-coherence` (capacité `connexionsimple` 5.415.0 → `etatConnexion`), `audit-traduction`,
  `audit-extension-zip`, `audit-actions-gardees`, `orion-*` (orion-connexion : formulaire derrière son lien),
  `extension-reste-connecte` (R7 suit `surClicIcone`), `audit-robustesse-extension` (J4 : `typeof FORCE`),
  `session-renouvellement`, `recuperation-*`, `session-reveil` : verts. `recuperation-auth` (banc) : 3 rouges, les
  mêmes sur origin/main.
- `verre-extension-site` : la partie « fenêtre » est jugée sur « VRM natif » (fond uni, un groupe, AA) au lieu du
  verre dépoli retiré le 19 nov. ; ses autres rouges (carte, site) sont ceux d'origin/main.
- Rouges déjà sur origin/main, inchangés : `session` G et P (code 5.164 périmé : `codeVersion` sans réponse ⇒
  « pas su », pas de ⟳ — depuis la 5.356), `e2e-extension` §3–4 (11 rouges, ventes et prix, hors connexion ; §1
  connexion vert), `extension-surfaces` (37), `extension-visuel` (19), `carte-orion-sans-onglet` (14).

## 5. Geste de Julien
Installer la 5.415.0 (dans CHAQUE Chrome, ⟳) une fois les zips régénérés par l'intégrateur ; essayer : clic droit
sur l'icône → « Connexion à VRM ».
