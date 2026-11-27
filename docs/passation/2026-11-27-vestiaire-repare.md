# 27 nov. 2026 — « Plus rien de Vestiaire n'arrive » : l'enquête, et l'Observateur 2.1 (branche `claude/vestiaire-repare`)

Julien : l'extension (5.455.1 servie) ne fait plus rien arriver de Vestiaire Collective dans VRM (annonces, ventes,
colis, messages, favoris, offres). Son app dit « En pause » (« Tout arrêter ») et « Ordinateur éteint ».
La base de production n'a PAS pu être relue (l'outil SQL a refusé, 27 nov.) : tout est jugé sur le code, sur les
mesures déjà écrites dans les passations, et sur des données INVENTÉES.

## ÉTAT À LA REPRISE
- Branche `claude/vestiaire-repare` poussée (depuis `origin/main` 79c110349). Pas de PR.
- **Extension : AUCUNE version montée.** Aucun défaut du code n'a été trouvé (ci-dessous) : une 5.455.3 sans
  correctif aurait été une version pour rien. La 5.455.2 (police + vocabulaire, autre agent) n'est pas touchée.
- **VRM Observateur 2.1.0** (`vrm-observateur-extension/`, `public/VRM-Observateur.zip`) : note aussi Vestiaire.
- Nouvelle garde : `scripts/audit-vc-capture-pause.cjs` (16 contrôles, `--prouve` 6 mutations).

## Hypothèse 1 — une pause bloque la lecture : FAUSSE (prouvé)
Tracé dans `background.js`, `vc.js`, `vc-inject.js` : `toutArreteDepuis` n'est appelé que par des chemins
d'ÉCRITURE (formulaire, compteur d'actions, `porteDiscretion`, favoris, offres aux « aimés », retraits LBC, baisses,
`etatDirectPourApp` qui ne fait que le DIRE). Aucun gestionnaire `cancale-vc` (annonces, compteurs, ventes, achats,
conversations, non-lus, fil, offres, « ont aimé », suivi, compte de l'onglet) ne lit une pause ; `vc-inject.js`
et `vc.js` n'en connaissent aucune ; l'import d'historique non plus. `gardeStricte(…, { lecture: true })` ne
regarde ni « Tout arrêter » ni le plafond (seulement captcha / 429-403 / compte de l'onglet, sur Vinted).
`audit-vc-capture-pause.cjs` pose TOUTES les pauses à la fois (« Tout arrêter » de ce Chrome et de l'app, pause
Vinted 429/403, pause Vestiaire, file en pause, vérification anti-robot Vestiaire du compte) et fait passer chaque
sorte de capture par le VRAI écouteur du fond : toutes rangées. Vert sur 5.455.1. `--prouve` : une garde
« Tout arrêter » posée dans 6 gestionnaires de capture ⇒ rouge à chaque fois.
Côté app (`src/extension/peutFaire.js`) : « Tout arrêter » ne refuse que `sorte === 'auto'` ; une lecture passe.

## Hypothèse 2 — une régression récente : AUCUNE trouvée
- `vc.js` et `vc-inject.js` sont identiques octet pour octet depuis la 5.440.3 (`06236db81`) ; le manifeste n'a
  changé que de version ; les gestionnaires `cancale-vc` du fond n'ont pas changé (diff relu : les 691 lignes
  ajoutées touchent favoris, panneau, écriture humaine — aucune garde d'hôte Vinted sur un chemin Vestiaire,
  aucun type de message renommé, aucun `garde`/`gardeStricte` sur une capture).
- La 5.454.0 (canal privé Vestiaire, `vestiaire-complet`) a été ANNULÉE le 26 nov. (#1425) : son `vc.js` /
  `vc-inject.js` ne sont plus servis.
- `node --check` vert sur chaque fichier ; le zip servi est identique au dossier source.
- Les 23 audits Vestiaire (`audit-*vc*`, `audit-*vestiaire*`, `audit-capture-vc-lbc`, `audit-lbc-vc-*`,
  `audit-fiabilite-vc-lbc`) : TOUS verts sur 5.455.1. Ils exécutent le vrai `vc-inject.js` → `vc.js` → `background.js`.
- Banc `vestiaire-bout-en-bout` : la partie EXTENSION est verte (« le vrai code a écrit vc_listings, vc_ventes,
  vc_messages, vc_session ») ; ses 35 rouges sont tous côté APP et viennent de sélecteurs d'avant le design
  « natif » (`?tab=annonces&site=vestiaire`, `data-vc-annonce`…) — déjà notés rouges sur main le 26 nov.
  (`2026-11-26-fiabilite-vc-lbc.md`, « Pas vérifié »). La capture d'écran montre l'annonce Vestiaire dans
  Annonces (tous les sites). Ces bancs (`vestiaire`, `vestiaire-ventes`, `vestiaire-messages`) sont à remettre à
  la navigation d'aujourd'hui : chantier à part.

## Ce que disent les mesures déjà écrites (sans valeur nouvelle)
- 13 nov. (`vc-inject.js`, commentaire 5.374) : depuis le 3 nov., seul l'iPhone (Orion) passait sur Vestiaire ;
  `vc_ventes` restait à la lecture du 2 nov.
- 20 nov. (`2026-11-20-lbc-vc-interesses.md`) : `vc_listings` = 3 articles lus le 2 nov. (18 jours), aucun
  `compte`, `favoris` null ; 0 `vc_offres`, 0 `vc_aimes`.
- 22 nov. (`2026-11-22-annulees-vc.md`) : 3 ventes dans `vc_ventes`, 1 annulée.
⇒ La dernière lecture Vestiaire de l'ORDINATEUR connue en base date du 2 nov. Ce n'est pas une panne d'hier.
« Ordinateur éteint » (ligne `presence_*`, écrite par `distanceTick`) veut dire que ce Chrome n'a pas parlé à VRM
récemment : extension pas chargée, Chrome fermé, ou session VRM de l'extension morte — dans ces cas RIEN
n'arrive, d'aucun site.

## Causes encore possibles (pas sues — sa capture les tranchera)
1. Le Chrome qui a l'extension n'est pas celui où il ouvre Vestiaire, ou n'est pas connecté à VRM (la carte du
   logo, onglet « Vestiaire », dit « lu à … · envoyé à VRM » pour chaque sorte : `vrmVcCapte`).
2. Vestiaire a changé son site (API ailleurs que `*.vestiairecollective.com`, réponses non JSON, page sans
   `__NEXT_DATA__` ⇒ compte jamais su). Le relevé de forme de l'extension (`vc_recon`) et l'Observateur 2.1 le diront.

## VRM Observateur 2.1.0
- `regle.js` : `estVestiaire` (`(^|\.)vestiairecollective\.com$`, un hôte qui imite le nom n'est pas suivi),
  `estSuivi` = Vinted ou Vestiaire ; requêtes, pages, onglets et liens de Vestiaire notés exactement comme ceux de
  Vinted (chemin normalisé, identifiants en empreintes salées, noms de paramètres, corps en formes, textes en
  longueur) ; champ `site` sur une requête ; un segment de chemin avec `@` ou `%` devient `{x}` (une adresse e-mail
  ne se garde jamais, sur les deux sites). La messagerie Stream partie d'une page Vestiaire : l'hôte seul.
- `manifest.json` : version 2.1.0, pages et permission `https://*.vestiairecollective.com/*` ; `fond.js`, `page.js`,
  `fenetre.*` : Vestiaire suivi, version lue dans le manifeste, texte de la fenêtre.
- `audit-observateur.cjs` : 22 contrôles (13 neufs pour Vestiaire) ; sur la 2.0.0 (`--src`) : **9 rouges** ;
  mutations (filtre `@` retiré, nom d'hôte non ancré, Vestiaire non suivi) : rouges.
- Installer : télécharger https://vrm.center/VRM-Observateur.zip (après fusion), dézipper (un dossier
  `VRM-Observateur`), `chrome://extensions` → mode développeur → retirer l'ancien Observateur → « Charger
  l'extension non empaquetée » → ce dossier. Puis : « Effacer », ouvrir Vestiaire, faire ses gestes, « Télécharger
  le rapport ».

## Favoris / « j'aime » Vestiaire : ce que VRM sait (code et mesures seulement)
- Le NOMBRE de favoris d'une annonce : lu dans `users/me/product-listings` sur une clé likes/favorites/wishlist
  (5.295) ; chez lui le 20 nov. : `null` (aucune clé vue).
- QUI a aimé : Vestiaire le DIT dans son fil de notifications (`…/notification-feed`, cartes
  `eventType: 'custom_community'`, lien `like_item`, `productLink.meta = { type: 'chat', data: { id:
  '{personne}-{article}' } }`, mesuré le 15 nov., 58 cartes). L'extension garde l'identifiant numérique de la
  personne dans le navigateur, la base ne reçoit que des nombres (`vc_aimes`). Jamais servi chez lui (0 `vc_aimes`).
- Écrire / faire une offre à un « aimé » : recette apprise de SON geste (5.393) — jamais apprise chez lui.
- Ce que son enregistrement doit montrer (Observateur 2.1, pendant qu'il le fait lui-même sur vestiairecollective.com) :
  ouvrir « Mes articles » ; ouvrir « Mes ventes » ; ouvrir la messagerie et une conversation ; ouvrir les
  notifications (la cloche) et une carte « … a aimé votre pièce » ; depuis cette carte, envoyer une offre / un
  message à la personne ; ouvrir une offre reçue et y répondre. On y lira : les hôtes et chemins de l'API
  aujourd'hui, si `notification-feed` et la forme `{personne}-{article}` existent encore, la requête (méthode,
  chemin, forme du corps) d'une offre à un « aimé », et l'ordre des gestes. L'Observateur ne voit pas les
  RÉPONSES (webRequest) : leur forme vient de `vc_recon` (relevé par l'extension VRM elle-même).

## Geste de Julien
- Ouvrir la carte du logo VRM sur un onglet Vestiaire : dire ce que disent les lignes « Vestiaire » (lu / envoyé).
- Installer l'Observateur 2.1.0 et faire l'enregistrement ci-dessus, puis envoyer le fichier.
