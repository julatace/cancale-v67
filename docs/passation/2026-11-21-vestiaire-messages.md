# 21 novembre 2026 — Vestiaire : ventes, messages, personnes qui ont aimé (branche `claude/vestiaire-messages-21nov`, extension 5.412.0)

Julien (21 nov.) : « j'ai déjà mis des annonces aujourd'hui sur Vestiaire ; prépare les ventes, les messages aux
favoris ; au moins lire les messages et écrire aux personnes, sans forcément automatiser ». Même jour, sa
décision : **les ÉCRITURES ne partent plus en requêtes** — elles se font par l'INTERFACE de
vestiairecollective.com, dans l'onglet (clic, saisie lettre à lettre, « Envoyer », vérification que le message
apparaît, sinon arrêt et dit ; bon destinataire vérifié par identifiant avant le geste ; clics `isTrusted:false`
assumés, aucun maquillage). Les lectures restent des GET dans leur budget.

Session reprise après une interruption (commits `aa5028354` → `d08d9e0b9` faits par la session d'avant, puis
cette session). Version : **5.412.0** (`CODE_VERSION`, manifeste, `lbc-inject.js`, `lbc-relay.js`, `EXT_ATTENDUE`,
`public/extension-version.json`) ; **zips pas régénérés** (l'intégrateur le fera).

## 1. Ventes Vestiaire — déjà en place, prouvées de bout en bout ici
Rien de neuf à capter : les ventes Vestiaire sont lues depuis la 5.296/5.316 (`vc_ventes`, `vc-inject.js`
`refVente`/`scalairesVente`), visibles dans Ventes (liste unique, logo du site — lot `sans-selecteur` du 20 nov.),
et entrent dans « vendue ailleurs » par `chargerRetraitsMulti` → `retraitsVestiaire`
(`api/_lib/vestiaire-regle.js`). Identité : le lien VRM de l'article (`vc_listings.liens`), la référence
« VRM-n° » lue (`ref`), l'annonce créée par VRM (`auto`) — **jamais le titre**. Une vente sans identité n'est pas
rapprochée : elle est NOMMÉE (« N ventes Vestiaire sans référence VRM-n° ») et la liste n'est pas « complète »
(rien n'est démasqué). Annulée (`etapeMotVc` = annulee, jamais si encore « à expédier ») ⇒ hors liste.
- Nouveau : `scripts/audit-vc-ventes-ailleurs.cjs` — la CHAÎNE entière avec les vraies règles (vestiaire-regle →
  `articlesVendusAilleurs` → `listeMasquerAilleurs`), puis le VRAI `background.js` (`_fond-vm.cjs`)
  `masquerAilleursTick` : V1 lien ⇒ masquée ; V2 50 annonces Vinted au même titre, vente sans identité ⇒ aucune,
  nommée ; V3 annulée ⇒ rien ; V4 autre N° ⇒ rien ; V5 `ref` lue ⇒ masquée ; F1 PUT `is_hidden: true`, aucun
  DELETE ; F2 onglet sur un autre compte ⇒ rien ; F3 geste pas appris ⇒ rien, dit. `--prouve` : 6 mutations
  rougissent (annulée comptée, titre pris pour identité, ventes ailleurs ignorées, N° pas comparé, compte de
  l'onglet ignoré, geste pas appris ignoré).
- Pas de capacité `vcventes` : aucune fonction d'extension nouvelle pour les ventes.

## 2. Messages — lire, et répondre par l'INTERFACE (fait)
- **Lecture** (inchangée, mesurée le 3 nov. — 5.317) : la messagerie de Vestiaire passe par Stream ; `vc-inject.js`
  lit `…/channels/{type}/{id}/query` (une conversation), la liste, `POST apiv2…/chat/channel/` (ouverture) ;
  rangé dans `vc_messages` (par compte) et `vc_fil_{conv}` (texte, date, « de toi », jamais un nom).
- **Panneau de l'extension** (`vrm-badge.js`, Messages sur vestiairecollective.com) : le FIL de la conversation
  (`filVcCarte`, seulement si `vc_fil_{conv}.compte` = compte de l'onglet), bulles de la personne / les tiennes ;
  la conversation montrée par la page est choisie d'office ; « Ouvrir la conversation » si l'onglet en montre une
  autre (VRM ne mène jamais l'onglet ailleurs tout seul).
- **Envoyer** (`repondreCarte` → `repondreVestiaire` → `vc-ecrire.js`, ordre `vcEcrireUI`) : une écriture Vestiaire
  à la fois, pause 429/403 (`vrmPauseVc`), arrêt anti-robot, sécurité du compte (`secuGeste … 'reponse', 'clic'`),
  50 actions/h `vc:{id}` (place rendue si rien n'est parti) ; conversation LUE et rangée sous le compte de l'onglet ;
  l'onglet doit MONTRER cette conversation (adresse + conversation ouverte chez Stream, par identifiant), sinon rien
  n'est tapé. Dans la page : champ et bouton APPRIS de SON envoi à la main (signature, jamais son texte, gardée
  dans ce navigateur `vrmVcUi` ; la base ne reçoit que `vc_envoi.appris`), un seul élément visible sinon rien,
  champ vide exigé, saisie lettre à lettre 40–160 ms, contenu relu = texte exact, clic, puis « fait » SEULEMENT
  quand Stream montre CE texte envoyé dans CETTE conversation (15 s) ; sinon « incertain » (jamais relancé) ;
  vérification visible (≥ 120 × 60) ⇒ arrêt + pause.
- **L'ancien envoi par REQUÊTE est retiré** : ordre « repondre » de `vc-inject.js`, relais `vcRepondre` de `vc.js`,
  rangement des recettes de requête (`noterRecetteVc`) — ne pas les remettre. `audit-capture-vc-lbc` C7 mis à la
  règle (rouge sur origin/main : l'ancien code envoyait une requête).
- **Nouveau ici : l'adresse d'une conversation est APPRISE** de SON envoi à la main (`vrmVcUi.adresse` :
  `{ modele: '/chat?id={conv}' }`, `{ modele: '/messages/{conv}' }`… ou `{ sansConv: true }`) ; la base reçoit un mot
  (`vc_envoi.adresse` : oui / sans). « Ouvrir la conversation » utilise la forme apprise ; si Vestiaire ne met pas la
  conversation dans son adresse, l'envoi depuis VRM est **refusé et dit** (`adresse-sans-conv` : destinataire pas
  vérifiable) plutôt que tenté « au mieux ».
- **App · Messages · Vestiaire** (`src/ecrans/Vestiaire.jsx`) : comptes SÉPARÉS (règle du 12 nov.) — le compte ouvert
  dans l'onglet, puis chaque autre compte, puis « compte pas encore su » ; le plus récent en haut dans chaque groupe ;
  un en-tête par groupe ; aucun bouton d'envoi dans l'app : « Répondre » ouvre le panneau (`BoutonExtension`).

## 3. Personnes qui ont aimé (fait, sans envoi automatique)
Vestiaire NOMME qui aime un article (notification « … vient d'aimer votre pièce », `productLink.meta = { type:
'chat', data: { id: '{personne}-{article}' } }`, mesuré le 15 nov.). L'extension ne garde que l'identifiant, dans
CE navigateur (`vrmVcAimes`). Panneau · Favoris (Vestiaire) : `aimesVcCarte` — les articles du compte de l'onglet
seulement, par article les personnes (plus récente d'abord, « déjà écrit » `vrmVcAimesEcrits`), **aucun nom**.
« Leur écrire » = ouvrir SA conversation dans l'onglet, puis écrire dans Messages (même chemin gardé, une personne
à la fois, sur son toucher). L'ancienne série d'OFFRES par requête aux personnes (`offrirAuxAimesVc`, 5.392) n'est
plus joignable : l'app refuse `vcOffreAimes` (`CMDS_PLATEFORME`) et le panneau ne l'appelle pas ; le code reste au
fond (à retirer par un lot dédié si Julien confirme que la décision vaut aussi pour les offres).

## Routes : vérifiées vs supposées
| quoi | état |
|---|---|
| Stream `…/channels/{type}/{id}/query`, `…/message` (envoi vu), liste des canaux | **mesuré** (3 nov., `vc_brut_*`) |
| `POST apiv2…/chat/channel/` (ouverture d'une conversation) | **mesuré** (3 nov.) |
| id de conversation `{personne}-{article}` | **mesuré** (notification « aime », 15 nov.) |
| page `/chat/` | **mesurée** |
| adresse `/chat?id={conv}` pour OUVRIR une conversation donnée | **SUPPOSÉE** — remplacée par la forme APPRISE dès son premier envoi à la main ; un mauvais lien n'ouvre rien et rien n'est tapé (vérification par identifiant) |
| champ et bouton d'envoi de la page | **jamais devinés** : appris de son premier envoi à la main |

## Capacités (`EXT_CAPACITES`, 5.412.0)
`vcecrireui` (`vc-ecrire.js:ecrire`), `vcfilpanneau` (`filVcCarte`), `vcaimespanneau` (`aimesVcCarte`) ;
`audit-coherence` vert.

## Preuves
- `audit-vc-ecrire` (vrai `vc-inject.js` + `vc-ecrire.js` dans Chromium sur une page Vestiaire INVENTÉE, puis le vrai
  fond) : E1–E7, E1b, F1–F9, F2b, F2c, P1–P3 ; `--prouve` (mutations, dont 3 neuves : adresse pas apprise, refus
  « sans conversation » retiré, forme apprise ignorée).
- `audit-vc-ventes-ailleurs` (nouveau, ci-dessus), `audit-capture-vc-lbc` (C7 mis à jour, rouge sur origin/main),
  `audit-vc-messages`, `audit-vc-conversations`, `audit-favoris-sites`, `audit-lbc-vc-interesses`, `audit-coherence`,
  `audit-actions-gardees`, `audit-discretion`, `audit-traduction`, `audit-identite`, `audit-fonctions-api` (aucun
  fichier ajouté dans `api/`) : verts.
- Banc `scripts/bancs/vestiaire-messages-comptes.cjs` (390 tactile clair, 1512 sombre) : Messages · Vestiaire
  (groupes par compte, ordre, aucun bouton d'envoi) et Ventes (la vente Vestiaire avec son logo). Résultats : voir
  le rapport de fin de session.

## Gestes de Julien
1. Installer la **5.412.0** (quand l'intégrateur la publie).
2. Sur vestiairecollective.com, dans ce Chrome : ouvrir la messagerie et **répondre UNE fois à la main** à une
   conversation (VRM apprend le champ, le bouton et l'adresse — jamais le texte). Ensuite, répondre depuis le
   panneau de l'extension (Messages).
3. Ouvrir « Mes articles » et « Mes ventes » sur Vestiaire (les annonces du jour et les ventes arrivent) ; une vente
   n'est rapprochée d'une paire que si l'article porte son N° (créé par VRM, lien posé, ou « VRM-n° » dans la
   description).
4. Ouvrir les notifications Vestiaire (les « j'aime » arrivent), puis Panneau → Favoris.
