# 9 nov. — Leboncoin clair (extension 5.335.0)

Branche `claude/leboncoin-clair` (depuis `origin/main`). Version réservée par la
coordination : **5.335.0** (`claude/securite-2` = 5.332, `claude/numero-etiquette` = 5.334).

## Ce que Julien voyait (carte du logo sur leboncoin.fr)

« Compte Leboncoin : Identifiant détecté · identité à confirmer — Tes données : Rien
envoyé depuis ce navigateur — Annonces / Transactions : nouvelle intégration non
confirmée dans cet onglet — À retirer : N°18, N°23 (vendues sur Vinted) — VRM n'a pas
confirmé l'enregistrement du compte ». Ses mots : « j'ai plus que 1 annonce […] le "à
confirmer" je ne comprends pas […] elle propose de supprimer des annonces vendues sur
Vinted qui ne sont plus sur Leboncoin ».

## Les causes (lues dans le code, prouvées par le banc sur la 5.331)

1. **Le refus « sans session » était définitif.** La page avait chargé son compte
   (`members/me/account`) et « Mes annonces » AVANT que l'extension soit connectée à VRM
   (il s'est connecté dans la carte : « C'est fait »). Le fond répondait `ok:false`
   (aucun compte VRM à qui écrire) ; `lbc-relay.js` prenait ce « non » pour un refus de
   l'identité (`identiteRefusee`), jetait les annonces du document, et rien n'était relu
   après la connexion. D'où « Identifiant détecté » (le compte vu dans l'onglet,
   `vrmLbcTransport[tab].compte`, jamais rangé dans `vrmLbcCompte`), « Rien envoyé »
   (`noterFlux` en attente de session ne pose ni `okAt` ni `koAt`) et « VRM n'a pas
   confirmé l'enregistrement » (`erreurCapture: 'identite'`).
2. **Ses annonces de « Mes annonces » n'étaient jamais reconnues comme les siennes.**
   Le compte privé est rangé sous `lbc-account:X` ; les annonces de `dashboard/v1/search`
   portent `owner.user_id = X`. La garde de `handleLbcRaw` comparait `X` à
   `lbc-account:X` ⇒ 0 annonce rangée, MÊME connecté (banc B, rouge sur la 5.331).
3. **La liste n'était jamais complète au-delà d'une page** : la page ne charge que la
   page regardée ; `lbcListeComplete` (la seule preuve « plus en ligne ») ne partait pas.
4. **« À retirer » ne demandait aucune preuve côté Leboncoin** : `annonceLbcEnVente`
   (le dernier statut capté) suffisait — décision « sens sûr » du 6 nov., démentie par
   Julien : les N°18 et 23 n'étaient plus sur Leboncoin.

## Ce qui change

- `lbc-relay.js` : une réponse `sansSession: true` du fond (identité, annonces, ventes,
  liste complète) est GARDÉE (mémoire du document, 48 messages / 4 Mo / 30 min) et
  rejouée — l'identité d'abord, par la même garde — sur `lbcRejouer` (envoyé par le fond
  dès qu'une session arrive, `saveSession`) ou quand le relais sonde (`lbcSessionPrete`,
  toutes les 30 s). Les listes d'un compte privé en attente attendent avec lui.
- `background.js` : `lbcSansSessionVrm()` (jeton absent ⇒ `sansSession`) ;
  `relancerLbcApresSession()` ; « X » = « lbc-account:X » dans la garde de
  `handleLbcRaw` ; `lectures[compte].ids` gardés ; `noterLectureCompleteLbc` (onglet +
  `vrmLbcLecture` de CE compte VRM) ; `resumeCarteLbc` (fonction pure, capacité
  `lbcclair`) ; `aRetirerProuveCarte`.
- `lbc-inject.js` : `completerListe` — quand le SITE a demandé une page de « Mes
  annonces » (`dashboard/v1/search` filtrée sur le seul vendeur), les pages manquantes
  sont relues avec SA requête (seul `offset` change), une à la fois, 700 ms, 30 pages au
  plus, arrêt sur 401/403/429. Jamais de requête inventée : sans requête du site, rien.
- `vrm-badge.js` : trois lignes — **Compte Leboncoin** (« Totomondu ✓ », ou ce qui se
  passe), **Annonces** (« 37 lues en entier il y a 2 min ✓ »), **Ventes** (« 4 lues il y
  a 1 min ✓ ») — puis UN geste (« Recharge cette page Leboncoin » avec un bouton
  « Recharger la page », « Ouvre « Mes annonces » », « Ouvre « Mes transactions » »).
  Plus aucun « intégration », « identité à confirmer », « enregistrement du compte ».
- App (`aRetirerDeLbcVinted`, `aRetirerDeLbcEbay`, écran Leboncoin, Ma journée, résumé
  `lbc_a_retirer`) : une ligne « à retirer » exige que la DERNIÈRE lecture COMPLÈTE de
  « Mes annonces » de son compte, de moins de 24 h, montre l'annonce en ligne
  (`etatEnLigneLbc` = la règle de Vinted). Sinon `aConfirmer` : carte « N vendues
  ailleurs — encore sur Leboncoin ? À confirmer » avec le lien « Ouvre « Mes annonces » »,
  jamais un bouton Supprimer. Une paire dont la seule annonce connue est sortie (absente
  d'une lecture complète, supprimée) ne s'affiche plus du tout. Le résumé publié porte
  `lu` et `compte` ; la carte n'affiche une ligne que si `lu` a moins de 24 h et qu'aucune
  lecture complète plus récente faite dans ce navigateur ne la contredit.

## Preuves

- `scripts/audit-lbc-clair.cjs` : VRAIS `lbc-inject.js` (monde page) + `lbc-relay.js`
  (monde isolé) + `background.js` (fausse base à état), Leboncoin à la forme mesurée.
  A : page chargée sans session, puis connexion ⇒ 37 annonces (2 pages : 35 + 2) rangées
  sans recharger, compte confirmé, lecture 37/37 avec ids, carte « Totomondu ✓ / 37 lues
  en entier ✓ ». B : connecté dès le départ ⇒ confirmé sans geste. C : deux comptes dans
  l'onglet ⇒ rien attribué + UN geste. D : à retirer seulement prouvé. **12 rouges sur la
  5.331** (`--ext` = `git archive origin/main`), 6 mutations rouges (`--prouve`).
- `scripts/audit-lbc-a-retirer.cjs` : la règle de l'app, + 6 cas (absente, vieille,
  jamais, partielle, prouvée, eBay), 9 mutations rouges.
- `scripts/bancs/lbc-clair-carte.cjs` : la carte (vraie `resumeCarteLbc`) 390 tactile et
  1512, clair et sombre, 4 états.
- `scripts/bancs/lbc-supprimer.cjs` (écran Leboncoin + Ma journée) : la N°15 vendue sur
  eBay, seulement « publiée », passe dans la carte « à confirmer » (attendu mis à jour) ;
  5 rouges restants **déjà rouges sur `origin/main`** (9 rouges là-bas : « 1 annonce à
  retirer » au lieu de « 1 à retirer » dans Ma journée, « Voir » de Ma journée, onglets
  rognés à 390) — pas de ce chantier.
- `audit-coherence` : vert après le merge de `origin/main` (5.332 sécurité-2, 5.334 N°).
- Audits extension-zip, paquets-boutiques, sans-session-envoi, coherence, identite,
  statuts, variables, tdz, les 25 `audit-*lbc*` et double-vente ; `npm run build`.

## Limites

- Aucune session Leboncoin réelle : formes simulées d'après l'historique. Si « Mes
  annonces » n'arrive QUE par le HTML (`__NEXT_DATA__`, sans `dashboard/v1/search`),
  aucune page de plus n'est demandée (pas de requête inventée) : la carte dit alors
  « liste pas encore lue en entier » et le geste.
- L'alerte serveur de double vente (`api/_lib/double-vente.js`) garde
  `annonceLbcEnVente` (pas changée ici).

## Geste de Julien

Installer l'extension **5.335.0** (remplacer le dossier, ⟳), puis sur leboncoin.fr
ouvrir « Mes annonces » de chaque compte Leboncoin : la carte doit dire « Compte
Leboncoin : <pseudo> ✓ » et « Annonces : N lues en entier ✓ ».
