# 19 nov. — Codes de retrait parfaits (branche `claude/retraits-parfaits`)

Julien, mot pour mot : « l'app doit être en mesure de reconnaître absolument tous les types de code de retrait, que ça
soit QR code, code de retrait etc., là il y a trop d'erreurs ; pareil quand je me balade sur Vinted avec l'extension je
dois voir dans l'app quand un nouveau QR code ou colis à retirer a été détecté ». Avant : « il y a quatre colis, j'ai un
seul code de retrait » (Achats, passe Mondial Relay Intermarché « 1 sur 4 » — la mise en page en lignes est déjà faite,
commit `10835d56d`).

Partie d'`origin/claude/project-review-nsk5su`. Aucune écriture en base, aucune PR, aucune fonction `api/` ajoutée
(12/12). **Extension : rien changé** (voir §6 pour la 5.409). Aucune donnée réelle ici : des nombres seulement.

## 1. Mesuré sur la vraie base (lecture seule, projections `meta->>` et scalaires)

La liste publiée `main.vrm_colis_retirer.colis` : **16 colis**, tous des colis d'e-mail portés par leur n° de suivi
(`e:`), aucun achat Vinted relié (aucun n° de ces 16 dans les commandes lues ni dans `harvest_*_suivi_*`).
Pour chacun, toutes ses preuves de fin possibles :

| source de fin | trouvée |
|---|---|
| e-mail « retiré / livré » du même n° | 0 |
| commande Vinted « finalisée » reliée par identité | 0 (aucun achat relié) |
| lecture transporteur `transp_*` « retiré » | 0 |
| lecture transporteur « disponible » (le colis EST là, lu aujourd'hui) | **11** |
| lecture transporteur **jamais réussie** (`essaiRes: cp-inconnu`) | **5** (Mondial Relay) |

Les 5 sans lecture : Mondial Relay ne lit un colis qu'avec le code postal du **destinataire** ; l'e-mail « disponible »
ne donne que celui du **point** (une commune voisine). Mesuré sur tous ses e-mails Mondial Relay « disponible » au point
de cette commune : **11 lus** — tous avec le code postal prouvé chez lui (`cpSource: essai`), jamais avec celui de
l'e-mail ; **5 jamais lus** : le serveur reprenait le code postal de l'e-mail à chaque passage (jusqu'à **34 refus de
suite** sur une ligne), l'essai par le code postal prouvé n'était jamais tenté. Ces 5 restaient « à retirer » sans que
rien puisse prouver leur retrait — dont 2 arrivés le 14 nov. à date limite le 19. Les 11 autres sont bien au point
(Mondial Relay, Chronopost, Vinted Go le disent aujourd'hui).

Sur l'ensemble des e-mails Mondial Relay « disponible » depuis le 1er nov. : 57 retirés lus chez le transporteur (sortis
seuls, la règle marchait), 6 disponibles lus, 5 jamais lus (ci-dessus).

**Codes manquants** (e-mails « disponible » depuis le 20 oct., par transporteur) : Mondial Relay 71/71 avec code,
Vinted Go 25/25 (code + QR), Chronopost 14/15 (le 15e porte le QR seul et son code dans une tournure déjà lue par
l'app depuis le 22 oct.), e-mails de Vinted « Commande mise à jour » 5/61 — les 56 autres n'ont **aucun code dans le
texte** (vérifié : « Ton colis a été livré dans le Point Relais … tu peux aller le récupérer », le code vient de l'e-mail
du transporteur). Aucun autre réseau (InPost, UPS, GLS, DPD, Relais Colis, Colissimo) n'a envoyé d'e-mail « disponible »
chez lui : leurs formes sont jugées au banc sur des e-mails inventés.

**Consigne / comptoir** : au même magasin, un comptoir et un « LOCKER 24/7 » au même code postal ; 11 e-mails de Vinted
dont le lieu dit « locker » rangés `consigne: false` ; un colis de consigne Vinted Go à un supermarché dont le nom ne
dit pas « locker » (le libellé du transporteur le dit : « prêt à être retiré en consigne »).

## 2. Ce qui change

- **Mondial Relay, code postal refusé** (`api/_lib/transporteurs.js`, `codePostalPourMondialRelay`) : le code postal que
  Mondial Relay vient de refuser pour CE n° (`cpRefuse`) n'est plus reproposé aux étapes e-mail / saisie / conversation ;
  l'essai borné (les codes postaux prouvés chez le vendeur, 2 par n° et par jour) part au passage suivant. Rien n'est
  inventé : sans autre code postal connu, rien. Les 5 colis seront lus au prochain passage du serveur et sortiront seuls
  s'ils sont retirés (par leur n° de suivi, la règle d'avant).
- **Tous les types de code** (`api/email-inbound.js` `parseCarrierEmail`, une forme partagée `api/_lib/forme-code-retrait.js`) :
  - le code d'une **consigne** à taper : « Saisissez / Tapez / Entrez / Composez / Utilisez le code … », « Code du
    casier », « Code de la consigne », « Code d'accès », « Code à saisir » ;
  - les codes **alphanumériques mêlés** (« 6A4B2C ») : au moins 2 chiffres et une lettre, sans O ni I (« 12O456 » reste
    « code pas lu ») ; la forme est la même dans l'app (`codeRetrait`), `src/retraitQr.js`, `api/_lib/suivi-colis.js`,
    `api/_lib/commande-colis.js` ;
  - un code **en groupes** en fin de ligne (« 731 204 » ⇒ 731204 ; un groupe de 5 chiffres n'est jamais joint) ;
  - le **code-barres** à présenter (jamais le n° de suivi) ;
  - les n° **UPS** (« 1Z… ») et **Locker InPost** (24 chiffres) : sans eux, l'e-mail restait « info », le colis nulle part ;
  - `consigne` reconnaît aussi Pickup Station, Parcel Locker, InPost, « consigne automatique ».
  QR : inchangé (l'image de l'e-mail, l'adresse Vinted Go, la capture de l'app Mondial Relay) — jamais fabriqué.
- **Consigne ≠ comptoir** (`src/retraitSorte.js`, `src/relaisColis.js`) : chaque colis porte sa sorte (le nom du lieu, le
  drapeau de SON e-mail, le libellé du transporteur de SON n°) ; elle entre dans l'identité du point : un casier et le
  comptoir du même magasin sont deux passes. La passe le dit une fois : « Consigne · code à taper sur l'écran » /
  « Comptoir · code à donner au commerçant ».
- **« Nouveau code de retrait » en direct** :
  - la veille (`src/tempsReel.js`) signale aussi `email_track_*` (un e-mail rangé par le serveur) et `panel_colis_relais`
    (un code lu dans une conversation par l'extension, de n'importe quel navigateur) ; l'app relit CETTE famille
    (`lireSuivis`, `relireColisRelais`) — Realtime si la 040 est posée, sinon le sondage de 25 s, onglet visible ;
  - `src/retraitsNouveaux.js` compare la liste comptée « à retirer » à ce que CET appareil a déjà vu, par identité
    (n° de suivi, transaction) : un colis neuf, un QR ou un code qui arrive ⇒ toast « Nouveau code de retrait · Mondial
    Relay Intermarché … » une fois, la ligne marquée « Nouveau » jusqu'à ce qu'il l'ouvre. La 1re fois sur un appareil,
    rien n'est annoncé ;
  - app fermée : la notification existait déjà (`api/email-inbound.js` « 📍 … t'attend », l'extension via `api/push`
    `notifRetraitConversation`) — inchangée.

## 3. Preuves

- `scripts/audit-retraits-parfaits.cjs` (vraies fonctions, données inventées) : vert ; **12/12 mutations** attrapées
  (`--mutation`) ; lancé sur l'arbre d'avant : **20 rouges**.
- Audits voisins verts : codes-retrait, statut-transporteurs, retrait-fiable, suivi-colis, transporteurs, retrait-qr,
  retrait-preuves, colis-retrait, retrait, retraits-irreprochables, relais-carte, retrait-vinted-go, veille,
  veille-plantages, quoi-de-neuf, traduction, fonctions-api, coherence, icones. `audit-retraits-fiables` : 1 rouge,
  le même sur l'arbre d'avant (antérieur).
- Banc `scripts/bancs/retraits-parfaits.cjs` (390 tactile et 1512) : deux passes au même magasin, la sorte dite, le
  toast, « Nouveau » sur la seule ligne neuve, retiré à l'ouverture, pas réannoncé au rechargement. Banc `design-v2`.

## 4. Ce qui reste

- Les 5 colis Mondial Relay seront lus par le serveur à son prochain passage après déploiement (aucune écriture faite
  d'ici). S'il en reste « à retirer » alors qu'il les a, « J'ai retiré » reste le geste.
- L'ancienne colonne « À retirer » (Colis, design d'avant) ne montre pas encore « Nouveau » ni la sorte en clair (les
  points y sont déjà séparés).
- Un code espacé autrement qu'en fin de ligne, un code d'e-mail transféré : non lus (« code pas lu », jamais un faux).

## 5. Geste de Julien

Aucun.

## 6. Extension (pour la 5.409.0, version partagée — rien changé ici, aucun zip)

Aucun changement nécessaire : l'extension écrit déjà `panel_colis_relais` et l'app le voit maintenant en direct.
À faire dans la 5.409 si on veut les codes mêlés aussi dans les conversations : `CODE_APRES` (background.js) et la
forme de `noterRetrait` sur `api/_lib/forme-code-retrait.js` (au moins 2 chiffres, une lettre, sans O ni I). Pas de
capacité `EXT_CAPACITES` à ajouter tant que rien ne change dans l'extension.
