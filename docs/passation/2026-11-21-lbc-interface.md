# 21 novembre 2026 — Leboncoin : les écritures par l'INTERFACE de la page (branche `claude/lbc-interface`, extension 5.416.0)

Julien (21 nov.) : « on ne fait plus les requêtes », « pour tous les sites ». Vinted : `claude/extension-interface`
(5.414) ; Vestiaire : `vc-ecrire.js` (5.412, pris comme modèle). Ici : **Leboncoin**. eBay n'est pas dans ce lot
(API officielle côté serveur).

## 1. Inventaire — ce qui partait encore par requête (origin/main 52a52466f, ext. 5.410.8)

| écriture | chemin d'avant (fichier:ligne sur main) | comment | geste d'interface qui la remplace |
|---|---|---|---|
| Mettre en pause | `background.js:33885` `pauseLbcDepuisApp` → `lbc-relay.js:210-221` → `lbc-inject.js:1172-1196` | `PUT api.leboncoin.fr/api/pintad/v1/public/manual/pause/ads` `{list_ids:[n]}`, adresse écrite en dur | « Mes annonces » : le bouton de LA rangée de l'annonce (par son identifiant), le menu, la confirmation |
| Supprimer (son clic confirmé « sans retour ») | `background.js:34020` `supprimeLbcDepuisApp` (app, panneau `supprimerLbcCarte`, « Republier sur Leboncoin ») → même relais/capteur | `DELETE …/manual/delete/ads` | même chemin, dernier bouton = celui qui supprime |
| Changer le prix (son clic, `cmd_prix_*`, baisse par règle `regleBaisseLbcTick` → `prixAttenteTick`) | `background.js:34173` `baisserPrixLbc` → `lbc-relay.js:256-266` → `lbc-inject.js:1249-1303` | recette APPRISE de son geste, rejouée (`lbcprixappris`) | la fiche de l'annonce (son identifiant dans l'adresse) : prix affiché relu, nouveau tapé lettre à lettre, bouton de validation |
| Répondre dans une conversation (app, panneau, « Leur écrire » aux intéressés `deroulerInteressesLbc`) | `background.js:32851` `repondreLeboncoin` → `lbc-relay.js:241-253` → `lbc-inject.js:1199-1246` | recette APPRISE rejouée (`lbcenvoiappris`) | la conversation (son identifiant dans l'adresse ET chargée par la page) : champ, texte lettre à lettre, « Envoyer » |
| Publier (dépôt) | `lbc.js` `fillNow` / `publierSansBooster` | **déjà par l'interface** (formulaire rempli, clic) | inchangé — voir « Pas fait » |
| Marquer vendu / réactiver | — | n'existe pas chez VRM | — |

Restent des **lectures** : `importpage` (GET), la relecture des pages de « Mes annonces » que le site a lui-même
demandées (`completerListe`, `POST dashboard/v1/search` = une RECHERCHE, seule exception permise par l'audit),
le PDF des bordereaux (GET), la relecture en arrière-plan de « Mes annonces ».

## 2. Ce qui est fait

- **`vinted-sync-extension/lbc-ecrire.js`** (neuf, monde isolé, cadre principal, leboncoin.fr) : apprend et refait.
  - **Apprendre** (une fois, de SON geste à la main, évènements `isTrusted` seulement) : quand lbc-inject.js voit la
    page envoyer une pause / suppression / prix / message (2xx), les clics VRAIS des 30 s d'avant deviennent des
    étapes : une **signature** (balise, `data-testid`/`name`/`role`/`type`/`aria-label` sans chiffres, le mot court
    du bouton) — jamais un titre, un prix, un texte saisi, un identifiant. La 1re étape d'une pause/suppression doit
    être DANS la rangée de l'annonce (portée « ligne »), les suivantes « page » (menus, dialogues). La page apprise
    garde l'identifiant en trou (`{ad}`, `{conv}`). Rangé dans `chrome.storage.local` `vrmLbcUi` ; la base ne reçoit
    que « appris » (`lbc_envoi`, `lbc_prix_recette` : `{ appris, mode: 'interface' }`).
  - **Refaire** (`lbcGesteUI`, du fond seulement) : compte privé de la PAGE = celui attendu (sinon rien) ; annonce
    par son IDENTIFIANT (la rangée = le plus grand conteneur au-dessus d'un de ses liens qui ne porte aucun autre
    identifiant ; deux rangées ⇒ « ambigu ») ; chaque étape doit être UN élément visible et apparaître après la
    précédente (6 s) — la preuve à l'écran ; sinon arrêt, l'élément nommé, **avant** le clic final ; vérification
    visible (≥ 120 × 60) ⇒ arrêt ; une action à la fois ; même pause/suppression vue < 2 min ⇒ « déjà » ; délais
    500–1 500 ms entre clics, 40–160 ms entre lettres ; prix : la fiche doit montrer le prix lu (sinon rien n'est
    touché), le champ relu après la frappe ; message : champ vide exigé (jamais mêler son brouillon), texte relu.
    « Fait » SEULEMENT quand le capteur a vu la page envoyer CETTE écriture (annonce, prix, conversation + texte) ;
    pas vu ⇒ `pas-vu` (jamais « fait »).
- **`lbc-inject.js`** : les ordres `pause`, `supprime`, `repondre`, `prix` et leurs adresses en dur sont **retirés** ;
  `RECETTES_REQUETE_LBC = false` (plus de recette) ; `gesteVuLbc` regarde chaque écriture de la page (fetch et XHR,
  tout statut) et la dit au relais par le **canal privé** (`lbcgestevu`) ; `lbcconvvue` (conversation chargée) ;
  un ordre `etat` (lecture : compte privé, dernière conversation).
- **`lbc-relay.js`** : plus aucun écouteur d'écriture ; un pont `__vrmLbcPont` (monde isolé, invisible de la page)
  vers lbc-ecrire.js.
- **`background.js`** : `gesteLbcInterface` ouvre un **onglet de travail** leboncoin.fr en arrière-plan à l'adresse
  apprise, revérifie le compte de CET onglet (`attendreSessionOnglet`), attend lbc-ecrire.js, envoie `lbcGesteUI`,
  **referme l'onglet quoi qu'il arrive** (un texte à moitié tapé part avec lui). `pauseLbcDepuisApp`,
  `supprimeLbcDepuisApp`, `baisserPrixLbc`, `repondreLeboncoin` y passent ; `issueUiLbc` / `issueRetraitLbc` :
  rien parti ⇒ place rendue ; vu ⇒ statut de la page ; 403/429 ⇒ pause 30 min ; vérification ⇒ anti-robot
  (`secuObserver`) ; l'ordre des gardes : sécurité du compte, frein, interface apprise, PUIS le plafond. Pause
  notée < 10 min ⇒ « déjà ». Supprimer reste SON clic confirmé « sans retour ». Intéressés : `appris` = interface
  du message. Messages `lbcEnvoiAppris` / `lbcPrixAppris` refusés (`retire`) ; `lbcUiAppris` neuf.
- Version **5.416.0** : `CODE_VERSION`, manifeste (+ `lbc-ecrire.js`), `CAPTEUR_VERSION`, relais, `EXT_ATTENDUE`,
  `public/extension-version.json` ; capacité `lbcinterface` (`gesteLbcInterface`) dans `EXT_CAPACITES`,
  `audit-coherence`, §8 de CLAUDE.md ; « Quoi de neuf » `lbc-interface`. Zips **non** régénérés.

## 3. Mesuré (lecture seule, sa base, 21 nov.)
- `lbc_recon.envois` : `PUT …/manual/pause/ads`, `DELETE …/manual/delete/ads` vus (ses gestes) ; des
  `POST …/messaging/proxy/api/v1/hal/{moi}/conversations/{conv}…` (chemin tronqué) ⇒ la page envoie bien par HTTP
  (le capteur peut le voir) ; **aucune** écriture de prix jamais vue.
- `lbc_fil_*` : **0** ligne ⇒ l'adresse d'une conversation dans la page n'a jamais été relevée. `lbc_envoi` absent ;
  `lbc_prix_recette.appris = false`.

## 4. Preuves
- **Banc `scripts/bancs/lbc-interface.cjs`** (vrais lbc-inject + lbc-relay + lbc-ecrire dans Chromium, faux
  leboncoin.fr : « Mes annonces » de 50 annonces au MÊME titre, messagerie, fiche de prix) : **30 verts** — N1 clics
  fabriqués n'apprennent rien ; A1 apprentissage (3 étapes, rien de l'annonce) ; A2 la 31e seulement, une requête,
  faite par la page ; A3 double ordre ⇒ une action, puis « déjà » ; A4 autre compte ⇒ aucun clic ; A5 captcha
  visible ⇒ arrêt, invisible ⇒ passe ; A7 deux « Confirmer » ⇒ arrêt ; A6 annonce absente ; S1 bouton final
  renommé ⇒ arrêt AVANT, élément nommé, 0 requête ; suppression de la bonne ; M1 lettre à lettre, preuve ; M2 page
  muette ⇒ `pas-vu` ; M3 autre conversation (adresse, puis conversation chargée), brouillon ⇒ rien ; R1 prix relu
  puis tapé ; R2 autre prix / autre fiche ⇒ rien. `--prouve` : 15 mutations. Captures (390 puis 1512) regardées.
- **`scripts/audit-lbc-interface.cjs`** : statique S1–S6 (aucune écriture dans lbc-inject sauf la recherche de
  `completerListe`, plus d'ordre d'écriture, relais sans ordre d'écriture, lbc-ecrire/lbc.js n'envoient rien, le
  fond n'envoie plus rien à Leboncoin et ses 4 gestes passent par `gesteLbcInterface`, manifeste) + V1–V13 (vrai
  background.js) : **30 verts** ; **sur origin/main : 26 rouges puis plante** (lbc-ecrire absent) ; `--prouve` :
  14 mutations, toutes rouges.
- Audits adaptés (ils jugeaient l'ancienne requête) : `audit-lbc-supprimer` (23, `--prouve` vert sauf
  `appSansConfirmation` « texte introuvable », **déjà sur main**), `audit-lbc-plus-vue-pause` (65), `audit-lbc-plus`
  (49), `audit-lbc-repondre` (26 ; mutations compte/plafond/clic rouges — `plafond` réparée, son texte était périmé
  sur main), `audit-lbc-vc-interesses` (54), `audit-securite-comptes` (44), `audit-extension-moyennes` (30).
- Verts : `audit-coherence` (582), `audit-actions-gardees`, `audit-discretion`, `audit-traduction`,
  `audit-identite`, `audit-relais-lbc-kinds`, `audit-panneau-carte`, `audit-argent-lbc`, `audit-capture-vc-lbc`,
  `audit-lbc-messages`, `audit-quoi-de-neuf`. Rouges **identiques à main** : `audit-confiance-publique` (4),
  `audit-extension-porte-app` (2).

## 5. Sélecteurs et formes NON vérifiés sur le vrai leboncoin.fr (403 d'ici)
Rien n'est écrit en dur : tout s'apprend du premier geste à la main. Ce qui peut empêcher l'apprentissage (et VRM le
dit au clic, `pas-appris` / la raison) :
1. la rangée d'une annonce dans « Mes annonces » porte-t-elle un lien (ou `data-*`) avec SON identifiant ? sinon
   `rangee-introuvable` ;
2. le menu « ⋯ » et la confirmation ont-ils des attributs/mots stables et uniques ? sinon `etape-ambigue` ;
3. une annonce au-delà de la 1re page de « Mes annonces » n'est pas sur la page ouverte ⇒ `annonce-absente` ;
4. la page de modification du prix porte-t-elle l'identifiant dans son adresse ? sinon le prix reste « à faire sur
   le site » (`adresse-sans-annonce`) ; la requête de prix n'a jamais été vue ;
5. l'adresse d'une conversation porte-t-elle son identifiant (`/messages/id/{conv}` supposé) ? sinon
   `adresse-sans-conv` ; le corps de l'envoi a-t-il UNE clé texte (`text`, `body`…) ?
6. `execCommand('insertText')` dans les champs React de Leboncoin (repli : setter natif + `input`).
Un onglet en arrière-plan ralentit les minuteries (~1 lettre/s) : un long message peut prendre plusieurs minutes
(budget 45 s + 1,3 s par caractère, au-delà « je ne sais pas »).

## 6. Pas fait
- Le **dépôt** (`lbc.js`) passe déjà par le formulaire, mais pose les textes d'un coup (setter natif), pas lettre à
  lettre : à convertir avec le vrai formulaire sous les yeux (risque de casser un dépôt éprouvé à l'aveugle).
- Zips de l'extension non régénérés (consigne) ; intégration avec 5.412 (Vestiaire) et 5.414 (Vinted) : les numéros
  de version et `EXT_CAPACITES` se croiseront — à l'intégrateur.

## Gestes de Julien
1. Installer la 5.416.0 quand elle sera servie.
2. Sur leboncoin.fr, dans ce Chrome, UNE fois chacun à la main : mettre une annonce en pause, supprimer une annonce
   (s'il le veut), changer un prix, répondre à une conversation. VRM apprend les boutons ; ensuite il les refait.
