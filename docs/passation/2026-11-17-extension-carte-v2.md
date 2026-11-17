# 17 nov. — L'extension refaite (5.406.0) : carte design v2, écran « action en cours », la vraie attente des favoris

Branche `claude/extension-carte-v2` (depuis `origin/main`). Extension **5.406.0** (5.404 et 5.405 réservées à #1219 et #1231).

## Ce que Julien a dit

Capture Orion sur vinted.fr (« Messages aux favoris · 0/15 envoyés · prochain dans 10 min ») :
« tu ne penses pas que 10 mins c'est bcp et je veux que ça soit bcp plus clair et plus beau, là c'est
de la merde l'extension, je veux que quand on fait une action sur vinted l'extension prenne tout le site
et qu'on puisse pas faire, vinted autour est flouté » ; puis « fait tout mieux sur l'extension déjà parce
qu'elle est horrible ».

## 1. Pourquoi « prochain dans 10 min »

MESURÉ sur le vrai `background.js` branché sur la VRAIE file du serveur (`api/_lib/favoris-file.js`,
`src/favorisProgression.js`) — `scripts/audit-action-plein.cjs`, rouge sur `main` :

- la carte lance la file ; au premier tour, le fond RÉSERVE un message chez VRM (`suivant`) ;
- l'extension le refuse aussitôt par une garde d'ATTENTE — le plus souvent « Vinted vient d'être ouvert »
  (discrétion du 12 nov. : 2 à 6 min sans geste automatique après l'ouverture ; la capture de Julien dit
  « lu il y a 1 min ») ; aussi 15 favoris/h, 50 actions/h, séries, autre compte ;
- ce refus partait au serveur en `quota_extension`, et le serveur repoussait la suite de **10 min FIXES**
  (`QUOTA_ATTENTE_MS`), quelle que soit la vraie attente.

Mesures (même scénario, avant → après) :

| cas | avant (main) | après (5.406) |
|---|---|---|
| Vinted ouvert il y a moins d'une minute (garde tirée : 4 min) | 10,0 min, rien dit | **4,0 min**, « Vinted vient d'être ouvert : VRM attend un peu » |
| 15 favoris déjà partis (le plus ancien sort dans 10 min) | 10,0 min | 10,0 min, « 15 par heure maximum » (le vrai temps) |
| 44 actions déjà prises (la place se libère dans 1 min) | 10,0 min | **1,0 min**, « 50 actions par heure maximum » |
| budget frais, aucune garde | part tout de suite | part tout de suite (rien ajouté) |
| refus après réservation (course) | 10 min | le vrai temps (`apresMs`, borné 5 s – 60 min) ; une extension d'avant garde 10 min |

Le correctif : avant de réserver, la carte demande aux MÊMES gardes, en lecture, si une place est libre
(`attenteAvantFavori` : `porteDiscretion` + `compterAction(…, essai)` qui ne prend rien) ; sinon elle
range le vrai temps et sa raison (`quoi`). Le serveur reprend au vrai temps quand l'extension le dit.
**Aucune garde n'est retirée ni assouplie** : 50/h/compte et sa réserve, plafond du jour, pause 429/403,
une requête à la fois, compte de l'onglet, arrêt sur captcha, « Tout arrêter », 15/h favoris (sa décision
du 12 nov.), attente après ouverture (validée le 12 nov.). Un refus de la sécurité des comptes qui dit
QUAND (type, rodage, espace, jour) fait attendre la file au lieu de la couper.

« Étaler les 15 sur l'heure (3–5 min) » n'a PAS été fait : la carte envoie au plus 15 favoris par
lancement — étaler les ferait finir en une heure au lieu de quelques minutes (plus lent, pas plus court).

## 2. Une feuille et des pièces communes : `vinted-sync-extension/vrm-ui.js`

Chargé AVANT chaque surface (manifeste, popup.html). Jetons `--vu-*` (jour / nuit / choix de VRM), la coque
bleue, la porcelaine, le plein, le secondaire teinté, le lien, le contrôle segmenté, l'étiquette N° en
KRAFT, la barre de progression, le point d'état, le bandeau fin, le message bref ; `habiller(el)` pour les
éléments posés dans la page (bandeaux et messages de lbc.js, vc-depot.js, ebay.js : plus de style noir en
ligne) ; `T(clé, vars)` : textes neufs en fr/en/es/it/de, langue du navigateur, repli français.
`scripts/audit-extension-feuille.cjs` (6/6 mutations).

Surfaces refaites (avant → après sur la planche) : carte Vinted (favoris en cours, aperçu prêt), carte
Leboncoin, carte Vestiaire, carte « à connecter » (dessinée, Orion ; l'iframe `popup.html?mode=carte` suit
popup.html), fenêtre de l'icône, ligne sous ses annonces (N° en étiquette kraft), encart d'achat, alertes du
formulaire de dépôt, pastille N° sur les photos, messages brefs et bandeaux, bandeau de version.

La carte : UNE ligne de tête (compte · point · « Normal »), UNE ligne principale (« Messages aux favoris ·
3 sur 15 », trait, « Prochain dans 3 min », la raison), UN plein (« Tout arrêter » pendant un envoi), la
ligne secondaire (jauge de l'heure et du jour · lu · capté), le bandeau « Version 5.406 disponible ·
Mettre à jour » (étapes repliées sous « Comment ? »), Favoris · Annonces · Ventes en UN contrôle segmenté ;
le choix « ce compte / tous les comptes » est dans la tête (« compte_banc ⌄ », un petit menu) ; ligne d'état à 13 px.
Les marques `data-q4*`, `data-fav*`, `data-maj*`, `data-onglet-b` restent (bancs).

## 3. L'écran « action en cours » : `vinted-sync-extension/vrm-action.js`

État `vrmActionEnCours` (chrome.storage.local) posé par le fond : la file des favoris de la carte
(`poserActionEnCours`, à chaque pas), les commandes de l'app Republier / Recréer / Baisser le prix
(`avecActionPlein`). L'écran (revu après la première planche : « trop timide ») : un panneau d'environ 600 px (feuille plein
écran au téléphone), grande photo 160 px et son étiquette N° kraft, grand titre, grand compteur « 3 sur 15 »,
barre large, la suite et son compte à rebours, les 3 suivants en vignettes, entrée calme (fondu + 0,98→1,
200 ms ; rien avec « réduire les animations »). Vinted flouté (repli : voile opaque), le clic et le clavier n'atteignent pas
Vinted, ce qui se passe, l'article (photo, étiquette N° du compte de l'onglet), la suite et son compte à
rebours, « Tout arrêter » (porte `toutArreter` + file des favoris arrêtée ; dit « Arrêté »), « Réduire »
(pastille, la page redevient utilisable). Captcha ou alerte de Vinted (présence seulement, jamais le texte)
⇒ l'écran s'écarte en bandeau et le dit. Shadow root fermée, aucun événement fabriqué, réduire les
animations suivi, état périmé (> 3 min) ⇒ éteint. Capacités `actionplein` et `carte5` (5.406.0).

## Preuves

- `scripts/audit-action-plein.cjs` : 32/32 ; rouge sur main (20 rouges) ; `--prouve` 5/5 (W6 : refus de la sécurité
  du compte APRÈS réservation ⇒ le serveur reprend au vrai temps, 20 min, et la file n'est plus coupée).
- `scripts/audit-extension-feuille.cjs` : 17/17 ; `--prouve` 6/6.
- `scripts/bancs/extension-surfaces.cjs` : carte (390, 1280, 1512, clair et sombre), aperçu, Leboncoin,
  Vestiaire, à connecter, écran plein (plein, réduit, captcha, arrêt, réduire les animations), fenêtre,
  message bref ; 141 verts ; contraste ≥ 4,5:1 mesuré, cibles ≥ 44 px, débordement ; `BANC_RACINE=<avant>` = captures
  « avant ». Planche : scratchpad `onglets/extension-carte.png`.
- `audit-carte-extension` : les deux contrôles « le plafond a refusé » attendent désormais « rien réservé,
  vraie attente et raison rangées ».

## Geste de Julien

Installer l'extension **5.406.0** (remplacer le dossier, ⟳ dans chaque Chrome ; Orion :
`VRM-Orion-dossier.zip`).

## Restes

- Les textes d'AVANT de la carte (Détails, Leboncoin, Vestiaire, connexion) restent en français : la
  traduction de la carte entière est le lot #1191 (`T()` + `_locales`) ; les textes neufs de ce lot sont
  dans `vrm-ui.js` et passeront sans peine à `_locales` le jour où #1191 fusionne.
- L'app pourrait envoyer `total` avec chaque commande de republication / baisse : l'écran dirait « 3 sur
  12 » au lieu de « 3 faits ».
