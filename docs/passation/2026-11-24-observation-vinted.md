# 24 nov. 2026 — Extension 5.440.3 : « Observer Vinted (10 min) »

Branche `claude/observation-vinted`, bâtie sur `claude/favoris-ancien` (5.440.2, en cours). Capacité `observation` = **5.440.3**
(`commandeObservation`).

## Pourquoi

Julien : Bleam réussit les « messages aux favoris » là où VRM a perdu le chemin plusieurs fois (le nouvel uuid de la
messagerie, les liens profonds `vintedfr://messaging?…`, une cloche qui ne montre que les dernières lignes). Sa demande :
« refais-moi une extension qui capte absolument tout ce que fait Bleam ».

Ce qui est fait — légitime, ses propres données : on observe le côté **Vinted** dans **son** onglet : les pages, les
requêtes que la page envoie, la FORME des réponses, et quels éléments ont reçu des clics. Cela dit le vrai chemin de
Vinted, à comparer avec celui de VRM.

Ce qui n'est PAS fait : lire, copier ou décompiler le code de Bleam ; intercepter l'intérieur d'une autre extension ;
noter un texte de message, un pseudo, un jeton ou un cookie.

## Ce qui est livré

### 1. L'interrupteur « Observer Vinted (10 min) »
- **Carte du logo** (vinted.fr) : dans « Détails » (sur le grand panneau : Paramètres → Détails), section « Observer Vinted »
  — interrupteur, « En cours · encore N min · N étapes notées », « Envoyer l'observation » (`vrm-badge.js`
  `observationHtml`, textes `ob_*` en 5 langues dans `vrm-ui.js`).
- **VRM → page Extension** (Plus → Extension, `?tab=extension`) : le groupe « Observer Vinted » — le même interrupteur
  (commande `observation` à l'extension de CE navigateur), « Envoyer l'observation », et la **frise en lecture seule**
  (`src/extension/ObservationVinted.jsx`, phrases par `src/observationVinted.js`, textes `obs.*` dans
  `src/i18n/langues/*/observation.js`).
- S'arrête seule au bout de 10 min (alarme `vrm-observation-fin` + constat à chaque lecture : le service worker a pu
  dormir ; la page s'éteint elle-même à l'heure de fin), sur « Arrêter », ou à 2 000 étapes (« limite »).

### 2. La frise (inject.js, monde de la page)
Allumée par le fond seul (`vrmObservation` dans `chrome.storage.local`) ; content.js dit à la page jusqu'à quand
regarder (`fin`) par le **canal privé** (une page ne peut ni l'allumer ni écrire au fond). Chaque entrée est datée :

| sorte | ce qui est noté | jamais |
|---|---|---|
| `page` | l'adresse (forme : `/inbox/{uuid}`), les CLÉS de la requête | les valeurs, le fragment |
| `req` | `fetch`/`xhr`, méthode, hôte (Vinted, DataDome), chemin (forme), statut, durée, type de contenu, les CLÉS du corps envoyé et leur type (`content:string`, `offer.price:string`, `iban:form`), les clés de tête de la réponse et leur type | une valeur, un en-tête, un autre site |
| `clic` | `isTrusted` (`conf`), balise, rôle, `data-testid` (forme), nom accessible s'il est fait de mots d'interface (sinon `{texte}`), `aria-expanded`/`aria-haspopup`, sa place dans l'en-tête (`i` sur `n`), les `data-testid` de 4 ancêtres, la forme du lien | le texte de l'élément, ce qui est tapé (aucun écouteur de touche ni de saisie) |
| `notifs` | la liste de la cloche reçue par la page (`…/inbox-notifications/v1/notifications`, `/api/v2/notifications`) : nombre de lignes, formes des liens (8 au plus), sortes (`entry_type`), page, par page, pages en tout | le corps des notifications, les pseudos |
| `cloche` | les lignes visibles quand la cloche s'ouvre (0,9 s et 2,5 s après le clic) ou sur la page des notifications : nombre, formes | |
| `defile` | la page des notifications qui s'allonge au défilement (avant → après) | |

La règle `<observation-regle>` (identifiant ⇒ `{id}`/`{uuid}`, `{id}-nike-…` ⇒ `{id}-{slug}`, ce qui suit `/member/` ⇒
`{x}` sauf une sous-page connue, valeur de paramètre ⇒ `{v}` sauf un petit nombre ou une énumération connue —
`portal=fr` —, clé à deux chiffres de suite ⇒ `{x}`, un autre site ⇒ `{tiers}`) est **la même, texte pour texte**, dans
`inject.js` et `background.js`.

Exemple de frise (simulation O1) : *clic (script) « notifications » · GET api.vinted.fr/inbox-notifications/v1/notifications
200 · notifs 3 · clic (lui) « notifications » (en-tête 2/3) · notifs 3 (liens `vintedfr://messaging?item_id={id}&user_id={id}&portal=fr`)
· cloche 3 lignes · clic (lui) `/inbox/want_it/new?receiver_id={id}&item_id={id}` · POST api.vinted.fr/messaging/main/inquiries
201 (corps `item_id:string`, `receiver_id:string`) · page `/inbox/{uuid}` · GET …/messaging/main/conversations/{uuid} 200 · clic
textarea · POST …/conversations/{uuid}/replies 201 (`content:string`) · POST /api/v2/transactions/{id}/offers 200.*

### 3. Le rangement (background.js)
- Chaque entrée est **rebâtie champ par champ** (`entreeObservation` : liste blanche, la règle rejouée ; un champ inconnu,
  une sorte inconnue, un autre hôte tombent). N° d'onglet (`o`) : un autre outil peut travailler dans son propre onglet.
- `chrome.storage.local` (`vrmObservation`, `vrmObservationEv`), puis la ligne dédiée
  **`observation_vinted_{compte}_{navigateur}`** (un seul écrivain, jamais `main`), écrite au plus toutes les 15 s pendant
  l'observation, à l'arrêt, et sur « Envoyer l'observation ». Écriture `rejeu` (pas mise en file de captures).
- **« Envoyer l'observation »** = la ligne écrite tout de suite + un **rapport de l'extension** (`envoyerRapport`,
  `rapportext`) qui porte `observation: { n, debut, fin }` (le serveur `api/_lib/rapport-extension.js` le garde par sa liste
  blanche ; jamais la frise). On lit la frise dans la base : `select id, data->>n, data->ev from app_data where id like 'observation_vinted_%'`.

### 4. §3 inchangé
Aucune requête vers Vinted, aucun clic, aucune touche, pas de `chrome.debugger` : on ne fait que REGARDER ce que la page
fait. Prouvé : la simulation O1 compte les écritures reçues par Vinted (seulement les 3 de la page, ses clics), l'audit
compte les requêtes de la page (seulement les siennes).

## Preuves
- `scripts/audit-observation-vinted.cjs` (VRAI content.js + inject.js dans Chromium, page aux vraies valeurs — pseudo,
  message tapé, e-mail dans l'adresse, identifiants, uuid, jeton dans l'en-tête et le cookie, IBAN dans un formulaire —, puis
  VRAI background.js jusqu'à la ligne écrite) : A règle identique · F phrases de VRM · B chaque sorte présente · C rien dans
  ce que la page relaie · D rien dans la ligne, le fond rebâtit un message forgé · E aucune requête de plus, éteinte = muette,
  heure de fin passée = muette. Mutations (`--mutation`) : `valeur-parametre`, `slug`, `aria` (règle partagée affaiblie ⇒ C
  et D rouges), `corps-valeur`, `texte-clic` (page seule ⇒ C rouge, le fond tient D), `fond-brut` (le fond ne rebâtit plus ⇒
  D rouge), `sans-fin` (la page ne s'éteint plus ⇒ E rouge). Résultats : voir la PR.
- `scripts/bancs/sim-extension.cjs --seul O1` : la VRAIE extension chargée, Vinted simulé ; un envoi À LA MAIN (clics de
  Playwright : cloche, ligne du favori, champ, message tapé, Envoyer, offre) ; la frise relue dans la fausse base : chaque
  étape attendue, dans l'ordre ; aucune valeur ; arrêt au bout des 10 min ; arrêtée = muette.
- `audit-coherence` (capacité `observation` ⇒ `commandeObservation`), `audit-endpoints-vus`, `audit-extension-zip`,
  `audit-extension-navigateurs`, `audit-traduction`, `audit-quoi-de-neuf`, build.

## Ce qui reste / limites
- Les lignes de la cloche « visibles » sont reconnues par un `data-testid`/classe contenant « notification » ou un lien de
  favori (`want_it`, `receiver_id`, `offering_id`, `messaging?`) : si Vinted change tout, `cloche` dira 0 — la liste reçue
  (`notifs`) reste, elle, lue sur la réponse.
- Un autre outil qui agit HORS de l'onglet Vinted (requêtes de son propre service worker) ne passe pas par la page : il
  n'est pas vu (et ne doit pas l'être : c'est son intérieur). Ce qu'il fait FAIRE à la page (navigations, clics, requêtes de
  la page) est vu, avec `isTrusted` qui dit si c'était une vraie main.
- Orion (canal « douteux ») : l'observation marche aussi ; c'est un diagnostic, elle ne prouve rien.

## Geste de Julien
1. Installer l'extension **5.440.3** (remplacer le dossier, ⟳ dans chaque Chrome).
2. Sur vinted.fr : logo VRM → Détails → « Observer Vinted (10 min) » (ou VRM → Plus → Extension).
3. Faire un envoi à un favori avec Bleam, ou à la main.
4. « Envoyer l'observation ».
