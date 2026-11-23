# 19 nov. 2026 — « Extension claire » : UN endroit pour l'extension et les comptes (demande H)

Branche `claude/extension-claire` (partie de `claude/project-review-nsk5su` + `natif-fondation`). Pas de PR.
Julien : « on ne sait pas quand ton compte Vinted est ouvert, quelles actions on peut faire, on ne sait rien ; des fois
c'est marqué [qu'il y a] trop [d'onglets / de comptes] ouverts, vraiment pas clair du tout ; beaucoup mieux accompagné ».

## 1. Ce qui a été mesuré en production (lecture seule, 19 nov. vers 14 h)

| trace | mesuré | ce que ça dit |
|---|---|---|
| `ext_appareil_*` | 6 navigateurs, 1 seul compte VRM : 3 Chrome · Mac (5.406, 5.400, 5.329), 3 Orion (5.377, 5.368, 5.336). Vus < 24 h : 3 (5.406, 5.400, Orion 5.377) | personne n'a la même version ; « pas dans ce navigateur, mais vivante ailleurs » est l'état le plus courant |
| comptes lus par navigateur (`vus`, 48 h) | exactement 1 compte Vinted par navigateur | la consigne « un compte par navigateur » est déjà suivie : le « deux comptes » vient d'ailleurs (le verrou, voir §3) |
| refus d'envoi (`flux.refus`) | 5 refus « réseau » sur le Chrome 5.329 (14 nov.), aucun 429 / 403 | une pause demandée par Vinted n'a jamais été vue dans les lignes |
| `actions_compte_*` | 12 lignes, 5 comptes Vinted, 1 compte VRM. Prudence : 0. Vérification / modération / déconnecté : 0. « Tout arrêter » : 0. Compte neuf (plafond 20/h) : 1. Au plus 2 gestes dans une heure. Aujourd'hui : 0 geste sur les 3 navigateurs qui le publient | le plafond n'a jamais été approché ; les états « freins » sont rares : la page doit les dire sans les rendre permanents |
| `ext_rapport_*` (« Envoyer un rapport ») | 0 | personne n'a jamais envoyé de rapport |
| `journal_vrm_*`, `moderation_vinted_*`, `harvest_*_forme_inconnue` | 0, 0, 0 | — |
| fraîcheur `harvest_{uid}_*` | profil : 9 lus < 24 h, 2 < 7 j, 5 ≥ 7 j, 2 sans date ; annonces 9 / 1 / 5 / 3 ; ventes 9 / 1 / 7 | un tiers des comptes n'est plus relu : il faut dire « pas ouvert : ouvre vinted.fr connecté à X » compte par compte |
| `vinted_accounts` | 14 comptes, 4 vendeurs | — |

Aucune donnée réelle n'est entrée dans le dépôt (comptes, pseudos, identifiants) : seulement ces comptes.

## 2. L'inventaire : où l'app parlait de l'extension avant

- **La pastille de la coque** (`EtatActions`, App.jsx) : « Actions possibles », « Actions possibles · sauf publier »,
  « Actions via ton ordinateur », « Vérification… », « Extension à installer », « Extension : pas dans ce navigateur »,
  « Lecture seule » ; un panneau de 3 lignes (extension · compte VRM · compte Vinted) avec ses gestes.
- **`raisonExtGlobale`** (18 appels) : « Extension VRM pas détectée dans ce navigateur », « L'extension VRM est installée
  dans ce Chrome mais ne répond pas sur cette page — recharge… ouvre chrome://extensions, clique ⟳… l'accès au site est
  « sur tous les sites » », « Deux extensions VRM répondent dans ce navigateur (…) : chaque commande partirait deux fois,
  alors je n'en envoie aucune. Dans chrome://extensions, supprime l'ancienne… », « Mets l'extension à jour (5.408.0) :
  celle installée ne sait pas encore recevoir cette commande de l'app », « Je n'ai pas pu savoir sous quel compte VRM
  l'extension écrit », « L'extension est connectée au compte VRM x, pas au tien… », « Vinted a demandé de ralentir :
  l'extension n'envoie rien chez Vinted pendant encore N min (c'est elle qui protège tes comptes) », « Aucun compte
  Vinted n'est ouvert dans ce navigateur — les actions SUR VINTED (bordereau, répondre) attendent ; publier sur Leboncoin
  reste possible ». Affichés : Ventes (bandeau des bordereaux grisés, `RaisonBordereauxGrises`, `BoutonBordereau`,
  `BoutonToutGenerer`), feuilles Créer sur Vinted / Publier partout / Remettre les prix, baisses en série, suivi des
  achats, Vestiaire, Leboncoin.
- **Les refus de l'extension après le clic** (background.js) : « Un autre compte vient d'agir dans ce navigateur : VRM
  attend N min » (c'est le « trop de comptes ouverts » de Julien), « Vinted vient d'être ouvert : VRM attend N min avant
  d'agir seul », « 45 actions automatiques sur ce compte dans l'heure — les 5 dernières sont gardées pour tes gestes »,
  « ton navigateur est connecté à un autre compte — bascule… (sinon Vinted voit deux comptes depuis la même session) »,
  « Vinted demande une vérification : fais-la sur vinted.fr, puis touche « Reprendre » », « Tout est arrêté… ».
- **Ailleurs** : la jauge « 12/50 cette heure · repart à » (Paramètres → Ce que VRM a fait), « Prudence jusqu'à … »,
  `AlerteVerification` / `ToutArreter` (Discrétion), la ligne « Les photos de Vinted ne s'affichent pas ici » (Aujourd'hui),
  « Ton extension VRM est en retard » (ligne de fraîcheur), le menu du profil « Actions Vinted · {compte} ».

## 3. Ce qui est construit

**La règle** — `src/extension/peutFaire.js`, pure (aucune lecture, aucun rendu, aucune langue). Des faits (ce que le
pont a répondu, les lignes `ext_appareil_*` et `actions_compte_*`, les comptes reliés) elle tire :
- l'état du navigateur (15 codes : `ok`, `maj`, `verif`, `absente`, `ailleurs`, `muette`, `plusieurs`, `perime`, `vrm`,
  `vrm-passu`, `vrm-encours`, `autre-vrm`, `retard`, `telephone*`), UNE phrase, UN geste, un « Pourquoi ? » ;
- pour chaque compte de chaque site (Vinted, Leboncoin, Vestiaire) : ouvert où (« ici », « sur ton ordinateur »,
  « dans Chrome · Mac », « c'est X qui est ouvert », « pas ouvert ») et lu quand ;
- **ce que VRM peut faire maintenant**, geste par geste (Vinted : lire, codes, bordereaux, répondre, baisser, publier,
  republier, favoris, offres ; Leboncoin et Vestiaire : lire, publier, baisser, répondre, aimés), oui / non et la raison
  du non, dans l'ordre des garde-fous : navigateur → version (`EXT_CAPACITES`) → compte de l'onglet → pause 429/403 →
  « Tout arrêter » / vérification (l'automatique seulement ; ses clics passent) → discrétion (un autre compte vient
  d'agir, Vinted vient d'être ouvert) → plafond (45 pour l'automatique, 50 pour ses clics, 3 places d'un coup pour
  republier, prudence 20, plafond du jour). « Pas su » ne vaut jamais « oui » ; une jauge pas lue n'invente pas de refus.
- la pastille de la coque (un mot, un ton) et le pas-à-pas du premier branchement (4 étapes cochées en direct).

**La page** — `src/extension/EcranExtension.jsx`, en composants `src/natif/` (Page, Groupe repliable, Rangee, Bouton
plein unique, Attente), textes par `tr()` dans les 5 langues (`src/i18n/langues/*/extension.js`, 148 clés). Onglet
`extension`, entrée « Extension » de « Plus » (rail à l'ordinateur ; au téléphone, la ligne d'état du menu du profil,
renommée « Extension et comptes », y mène). **La pastille de la coque y mène** (son panneau n'est plus ouvert ; le
chemin `ouvrirEtatActions` y mène aussi). Le libellé de la pastille : « {compte} » / « VRM agit » · « Via ton
ordinateur » · « Extension… » · « Vinted pas ouvert » · « VRM en pause » · « Extension · à régler » — plus jamais
« Lecture seule ».

**L'extension 5.409.0** — `etatIciPourApp` (background.js), ajouté à la réponse `etat` (`ici`) : l'identifiant de ce
navigateur (pour ne pas se compter deux fois), le nombre d'onglets vinted.* / leboncoin.fr / vestiairecollective.com
ouverts, les comptes Vinted des domaines ouverts (deux différents ⇒ « deux comptes Vinted sont ouverts dans ce
navigateur : VRM n'agit que pour X »), les comptes lus (48 h), le verrou « un autre compte vient d'agir ici » et
l'attente après l'ouverture — DITS AVANT le geste au lieu d'après. Il ne fait que lire `chrome.storage.local`,
`chrome.tabs.query` et les cookies ; aucune requête Vinted, aucune écriture, rien dans le plafond ni le budget de
lecture ; aucun garde-fou retiré (ils décident toujours au moment du geste). Capacité `etatici` (5.409.0) dans
`EXT_CAPACITES` et `FONCTIONS` d'audit-coherence ; `CODE_VERSION`, manifeste, `lbc-inject.js`, `lbc-relay.js`,
`EXT_ATTENDUE` montés. **Zips NON régénérés** (à l'intégration) ; `public/extension-version.json`, l'aide et le texte
Orion disent encore 5.408.0 : à monter AVEC les zips. Une extension plus ancienne n'a pas `ici` : la page le gère
(onglets « pas su », rien n'est prétendu fermé).

## 4. Les phrases, avant → après (extraits)

| état | avant | après |
|---|---|---|
| pas d'extension | « Extension VRM pas détectée dans ce navigateur » · pastille « Extension à installer » | « L'extension n'est pas dans ce navigateur. Installe-la pour que VRM lise et agisse pour toi. » + [Installer l'extension] |
| ailleurs | « Extension VRM pas détectée dans ce navigateur — celle de ton compte a donné signe de vie il y a 20 min (Chrome · Mac, 5.406.0), mais pas dans ce navigateur-ci : ouvre VRM dans le navigateur où elle est, ou installe-la ici » | « L'extension est dans Chrome · Mac, pas dans ce navigateur. Ouvre VRM dans Chrome · Mac, ou installe-la ici. » |
| muette | « L'extension ne répond pas — recharge cette page ; si ça ne suffit pas, ouvre chrome://extensions et clique ⟳ sur VRM (dans ce Chrome). » | « L'extension est installée mais ne répond pas sur cette page. Recharge la page. » + [Recharger la page] ; Pourquoi ? « C'est souvent le cas juste après une installation… » |
| deux extensions | « Deux extensions VRM répondent dans ce navigateur (5.400.0 et 5.408.0) : chaque commande partirait deux fois, alors je n'en envoie aucune. Dans chrome://extensions, supprime l'ancienne… » | « Deux extensions VRM sont installées dans ce navigateur : VRM n'envoie rien tant qu'il y en a deux. Garde seulement la 5.409.0. » + la consigne en une ligne |
| pas branchée / autre compte VRM | « L'extension n'est pas connectée à ton compte VRM — je la connecte ; si ça ne vient pas, recharge cette page. » | « L'extension n'est pas encore branchée à ton compte VRM. » + [Brancher à mon compte] |
| compte de l'onglet ≠ | (rien avant le clic ; après : « ton navigateur est connecté à un autre compte — bascule… ») | sur le compte : « Pas ouvert : c'est atelier_b qui est ouvert sur vinted.fr » ; chaque geste « non · c'est atelier_b qui est ouvert : connecte-toi à boutique_a » |
| « trop de comptes » | « Un autre compte vient d'agir dans ce navigateur : VRM attend 4 min. » (après le clic) | AVANT : « Écrire aux favoris · non · un autre compte vient d'agir ici : reprend à 14:32 » ; et « Deux comptes Vinted sont ouverts dans ce navigateur. VRM n'agit que pour boutique_a, celui de vinted.fr. Garde un seul compte par navigateur. » |
| pause | « Vinted a demandé de ralentir : l'extension n'envoie rien chez Vinted pendant encore 12 min (c'est elle qui protège tes comptes). Rien à faire de ton côté. » · pastille « Lecture seule » | chaque geste « non · Vinted a demandé de ralentir : reprend seul à 14:12 » · pastille « VRM en pause » |
| plafond | « 45 actions automatiques sur ce compte dans l'heure — les 5 dernières sont gardées pour tes gestes. Réessaie plus tard. » | « 45/50 gestes cette heure · une place se libère à 14:17 » ; « Baisser un prix · non · 45 gestes cette heure, c'est le maximum : reprend à 14:17 » ; « Répondre aux messages · oui » |
| prudence | « Prudence jusqu'à 19 h 00 » | « Baisser un prix · oui · au ralenti (20 par heure) jusqu'à 19:00 » |
| aucun compte ouvert | « Aucun compte Vinted n'est ouvert dans ce navigateur — les actions SUR VINTED (bordereau, répondre) attendent ; publier sur Leboncoin reste possible. » | « Pas ouvert : ouvre vinted.fr connecté à boutique_a » (le compte se touche : ouvre vinted.fr) |

## 5. Ce que les AUTRES écrans doivent retirer (je ne les ai pas édités)

Chacun garde au plus UNE ligne courte qui mène à la page (`ouvrirPageExtension()`, exporté par App.jsx) :
- **Ventes** (`ventes-comme-avant`) : le bandeau `RaisonBordereauxGrises` (la phrase longue de `raisonExtGlobale`) et les
  raisons longues des boutons grisés `BoutonBordereau` / `BoutonToutGenerer` ⇒ « Bordereaux en attente · Extension » qui
  ouvre la page ; `BandeauLiaison` (« connectée ✓… ») ⇒ retiré (la page montre le branchement).
- **Aujourd'hui** (`aujourdhui-propre`) : la ligne « Les photos de Vinted ne s'affichent pas ici » et son « Pourquoi »
  (12740 env.), `AlertesVerificationJournee` (la vérification est sur la page, avec « Reprendre »), et la mention
  « extension en retard » de la ligne de fraîcheur ⇒ la pastille.
- **Fiche** (`fiche-directe`) : les raisons « mets l'extension à jour » / « pas détectée » des feuilles Créer sur Vinted
  (`FeuilleCreerVinted`), Publier partout (`HotePublierPartout`) ⇒ un bouton indisponible avec la raison COURTE de la
  règle (`ext.raison.*`) et un lien vers la page.
- **Annonces** (`annonces-a-egalite`, `prix-sans-manuel`) : `extRaison` des baisses en série (Vinted, Leboncoin,
  Vestiaire) et « Remettre les prix » ⇒ la raison courte du geste `baisser` de la règle ; la jauge reste.
- **Paramètres** : « Actions Vinted » / « Ce que VRM a fait » gardent la jauge et le journal ; la ligne « extension »
  de « Tout va bien ? » peut pointer ici (l'audit d'utilité la mettait dans Tout va bien ? : la demande H en fait une
  page à part, Tout va bien ? n'a qu'à y mener).
- Le **panneau** de l'ancienne pastille (`EtatActions`, son rendu `ouvert`) n'est plus ouvert par personne : à
  supprimer à l'intégration (laissé pour ne pas casser les bancs qui lisent ses data-*).

## 6. Preuves

- `node scripts/audit-extension-claire.cjs` : 75 verts — la règle EXÉCUTÉE sur 21 combinaisons (aucune extension,
  vérification, autre navigateur, muette, installée-muette, version inconnue, ancienne 5.300 geste par geste,
  compte de l'onglet ≠, aucun compte, cookie pas lu, pause, prudence, prudence pleine, 45/50, 50/50, places de
  republication, plafond du jour, jauge pas lue, deux comptes, « Tout arrêter », vérification / modération / reprise,
  verrou, ouverture, autre compte VRM, pas branchée, deux extensions, code périmé, téléphone éteint / relais,
  Leboncoin fermé / ouvert / sans bloc 5.409), les phrases produites présentes dans les 5 langues, aucun mot technique,
  le branchement dans l'app et dans l'extension, les garde-fous intacts.
- `--prouve` : 12 mutations de la règle, toutes rouges. Sur l'arbre de départ (`git archive
  origin/claude/project-review-nsk5su`, la règle copiée dedans) : 21 rouges (page pas montée, pastille, textes, extension).
- `scripts/bancs/extension-claire.cjs` : la page RENDUE dans le vrai `dist/`, pont simulé, 390 × 844 tactile et 1512,
  clair et sombre ; 3 scénarios + la pastille ; captures regardées (§7). 2 mutations du build.
- `audit-coherence`, `audit-traduction`, `audit-quoi-de-neuf` verts ; `npm run build` vert.

## 7. Gestes de Julien

Aucun pour la page. À l'intégration : régénérer les zips 5.409.0 et monter `public/extension-version.json`, l'aide et
le texte Orion ; puis installer la 5.409.0 (pour que « deux comptes », « un autre compte vient d'agir » et les onglets
Leboncoin / Vestiaire soient dits avant le geste ; sans elle, la page marche, ces trois lignes disent « pas su »).
