# De plus belles notifications (15 nov. 2026)

Branche `claude/notifications-belles` (depuis `origin/main`). Demande de Julien (iPhone, VRM
installée sur l'écran d'accueil) : « Fais de plus belles notifications », avec une capture de
quatre notifications. Aucune fonction `api/` de plus (12/12), aucune migration, **rien changé
dans l'extension** (elle ne fabrique aucun texte : `signalerCompteRelie` envoie seulement
`{action:'comptes'}`, le texte est fait par le serveur).

## 1. Avant → après (ce que montre le téléphone)

Mesuré par le banc `scripts/audit-notifs-redaction.cjs` : la vraie route, puis le vrai service
worker, sur le code d'avant (`--sur`, `origin/main` 70fbef70) et sur celui-ci. Données inventées.

| notification | avant (origin/main) | après |
|---|---|---|
| Compte Vestiaire relié (route `/api/push`, `comptes`) | « n° 37451417 est relié à VRM » / « Compte Vestiaire Collective · la première lecture commence. Ouvre VRM pour la suivre. » | « Ton compte Vestiaire est relié » / « Première lecture en cours : touche pour la suivre. » (avec un pseudo connu : « shop_x est relié à VRM ») |
| Prix d'achat (route `/api/push`, `prixachat`) | « Vendu 62 € · N°215 » / « Combien tu l'avais payée ? » | « Vendu 62 € · Nike Air Max 1 blanche T42 » / « N°215 · touche pour saisir ton prix d'achat. » — le toucher ouvre la feuille du prix de CETTE vente (`cible=prixachat&tx=…`) |
| Bordereau de retour d'un achat (route `/api/email-inbound`) | « Bordereau de retour reçu » / « Autry donna · à déposer avant le 23/11/2026 » — ouvrait la ligne de l'achat | « À renvoyer : Autry donna » / « Bordereau de retour reçu · à déposer avant le lun. 23 nov. 10 h » — ouvre LA CARTE du retour (`cible=retour&tx=…`) |
| Une offre (route `/api/email-inbound`) | « Offre de 50 € » / « « New balance 9060 vert et blanc taille 38 » · <pseudo de l'acheteuse> — expire en 24h. » | « Offre de 50 € · 9060 vert/blanc T38 » / « Accepte, refuse ou contre-propose · expire dans 24 h » |
| 8 offres regroupées | « 8 offres à trancher » / « Dernier : Offre de 57 € · « New balance 9060 vert et blanc taille 38 » · <pseudo> — expire en 24h. » (105 caractères) | « 8 offres à trancher » / « La plus récente : 9060 vert/blanc T38, expire dans 24 h » |
| Vente Vinted | « Vendu · 65 € » / « Adidas Samba OG noir taille 41 · boutique · Prépare le colis, le bordereau suit par e-mail » (95) | « Vendu 65 € · Adidas Samba OG noir T41 » / « boutique · Prépare le colis : le bordereau suit par e-mail. » |
| Bordereau d'une vente | « … à déposer avant le 17/11/2026 12:00 » | « N°124 · Air Max 90 · déjà tamponné · à déposer avant le mar. 17 nov. 12 h » |
| Message | « Message de <pseudo> » / « Air Max 90 blanche taille 42 · Nouveau message sur boutique · « … » » (96) | « Nouveau message · Air Max 90 blanche T42 » / « boutique · « Bonjour, toujours dispo ? » » |
| Annulation | « Annulation demandée » / « Air Max 90 · <pseudo> veut annuler (« … ») — accepte ou refuse dans la conversation Vinted. » (113) | « Annulation demandée · Air Max 90 » / « L'acheteur veut annuler (« … ») · accepte ou refuse sur Vinted » |
| Vendu sur Vestiaire | « … tu reçois 84,00 € · à envoyer avant le 19/11 » | « Vendu sur Vestiaire · Sac Longchamp Le… » / « tu reçois 84 € · à envoyer avant le jeu. 19 nov. » |
| Résumé du soir | « 2 colis à déposer demain, le premier avant 12 h. 1 déjà en retard : dépose-le en premier. Dernier jour pour retirer ton colis à Tabac des Halles. » (145) | « 2 à déposer, le premier avant 12 h · 1 déjà en retard · dernier jour pour retirer à Tabac des Halles » (le titre dit « Demain : 3 colis, 1 retrait ») |
| Rappel du matin (colis) | « 3 colis à envoyer (…). Date estimée pour 1 (vente + 7 j : bordereau pas reçu par email ; la vraie limite peut tomber jusqu'à 3 j plus tard). Ouvre l'app pour les préparer. » | « 3 colis à envoyer (1 en retard · 1 aujourd'hui · 1 demain avant 10 h · 1 estimée). » |
| Colis arrivé au point | « … · code 454602 · jusqu'au 12/11 » | « Tabac des Halles, Nantes · code 454602 · jusqu'au jeu. 12 nov. » ; un article trop long passe EN QUEUE du corps (le lieu, le code, la date et le n° ne sont jamais coupés) |
| URSSAF du 1er | « Déclaration URSSAF » / « Nouveau mois : déclaration URSSAF octobre 2026 à faire avant le 30 novembre. 1240,00 € reçus · à payer ≈ 153,76 € » (113, le montant aurait été coupé) | « Déclaration URSSAF octobre 2026 » / « 1240,00 € reçus · à payer ≈ 153,76 € · avant le 30 novembre » (les mêmes mots, autre ordre ; la phrase de Ma journée reste mot pour mot dans `corps`) |
| Comptes Vinted pas relus | 111 caractères | « rallume, vieux_compte et 2 autres : ouvre vinted.fr sur chacun, là où est l'extension VRM. » (les noms qui ne tiennent pas sont comptés) |

## 2. La règle (une seule, `api/_lib/notif-redaction.js`)

- **Titre ≤ 40** qui dit l'essentiel : le fait PUIS l'objet (« Vendu 62 € · Nike Air Max 1 ») ;
  le nom court prend la place qui reste (`nomCourt` : « taille 38 » ⇒ « T38 », « vert et blanc »
  ⇒ « vert/blanc », la marque en tête retirée seulement si ça ne tient pas, puis coupé sur un mot).
- **Corps ≤ 90** avec le geste ; un corps de plusieurs phrases garde ses phrases ENTIÈRES
  (`couperPhrases`), jamais coupé au milieu. Appliqué par `embellir` (notif-belle.js) à TOUT ce
  qui sonne (170 ⇒ 90).
- **Dates en clair, heure de Paris** (`dateClaire`) : « aujourd'hui 18 h », « demain 10 h »,
  « lun. 23 nov. 10 h ». Une notification qui ne sonne pas tout de suite (heures calmes, sans
  sonnerie) dit toujours le jour (« lun. 23 nov. ») : « demain » serait faux à la lecture.
- **Montants** « 62 € », « 61,20 € » (« €62 » en anglais).
- **Jamais un identifiant technique** (n° de compte, de transaction, uuid, clé de ligne) ni le
  **pseudo d'un acheteur** (offre, message, annulation ne le disent plus — il n'est même plus
  dans la charge) ; le N° de rangement « N°215 » quand il est lu par identité. Un n° de SUIVI de
  transporteur reste dans le rappel du dernier jour (imprimé sur le colis, demandé au point).
- **Langue du compte** : `user_metadata.langue` (comme les e-mails), cinq langues (fr, en, es,
  it, de), français par défaut. L'app y range la langue affichée (`alignerLangueCompte`,
  src/langueCompte.js, au démarrage et à chaque changement) ; le serveur la lit par la route
  d'administration (`langueDuVendeur`, api/_lib/push.js, gardée 10 min), pas de clé ou pas su ⇒
  français. Les fabriques rendent le texte français ET `redaction` (`{ sorte, …données }`) :
  `sendPushToAll` le REFAIT dans la langue du compte. Traduits : compte relié, vente, prix
  d'achat, retour, offre, versement, Vestiaire, bordereau, message, annulation, les titres et
  corps des regroupements et des résumés. **Restent en français** : les rappels qui ont leur
  propre texte (URSSAF, bilan, soir, comptes à relire, modération, avis, colis/retraits,
  transporteurs, signalements).
- Le service worker pose `lang` sur la notification (lecteur d'écran).

## 3. Où mène le toucher, l'étiquette

| notification | écran | `tag` |
|---|---|---|
| compte relié | Paramètres → Comptes liés (`?tab=vintedaccounts`) | `vrm-compte-<comptes>` |
| prix d'achat | Ma journée, la feuille du prix de CES ventes (`cible=prixachat&tx=…`) | `prix-achat-<tx>` |
| retour d'achat | Achats, **la carte du retour** (nouvelle cible `retour`, `data-cible="retour:<tx>"` sur la carte de `src/RetoursLitiges.jsx`) | `bordretour-<tx>` |
| offres (plusieurs) | Messages, filtre « Offres » | `vrm-offre` (le groupe ferme les autres) |
| les autres | inchangés (vente, colis, conversation…) | l'étiquette de l'objet |

Regroupement, heures calmes, familles, fenêtre de résumé : inchangés (même porte), seuls leurs
textes passent par la règle (« La plus récente : … » au lieu de « Dernier : … »).

## 4. « from VRM » sous chaque titre

**Ce n'est pas de notre fait, et on ne peut pas le retirer.** Aucun champ de la charge ne le
porte (le service worker montre `title`, `body`, `icon`, `badge`, `tag`, `lang`, `data`,
`actions` — vérifié par le banc, le titre est exactement le nôtre). iOS l'ajoute lui-même à
toute notification d'une **app web installée sur l'écran d'accueil** : « from » + le nom de
l'app (celui du manifeste, `"name": "VRM"`, ou celui choisi à l'ajout sur l'écran d'accueil),
pour qu'une app web ne puisse pas se faire passer pour une autre. Ce mot n'est pas traduit par
iOS (il reste en anglais sur un iPhone en français). Les éditeurs de notifications web le
documentent comme fixe (Progressier : « There is currently no way to remove the "from + app
name" line from PWA push notifications. This is how Apple chose to render push notifications on
iPhone and iPad » ; PushAlert : le nom vient du manifeste, non modifiable par message). Une
seule façon de le changer : le nom donné à l'app à l'ajout sur l'écran d'accueil.

## 5. Preuves

| preuve | résultat |
|---|---|
| `scripts/audit-notifs-redaction.cjs` (nouveau banc) — EXÉCUTE `api/push.js` (`comptes`, `prixachat`, en fr, en, de), `api/email-inbound.js` (bordereau de retour, 8 offres), la vraie porte `sendPushToAll` (vente, n° dans un titre, versement, bordereau, message, annulation, Vestiaire, arrivée au point, soir, long corps) et le VRAI `public/sw.js` (machine virtuelle : ce qui s'affiche, ce qu'ouvre le toucher) ; fausse base `src/exempleBase.js`, horloge fixée (14 h 28 à Paris) ; icône 192 px < 50 Ko, badge 96 px RGBA | **139/139** |
| le même sur `origin/main` 70fbef70 (`--sur`) | **27 rouges** : les quatre notifications de la capture reproduites mot pour mot (« n° 37451417 est relié à VRM », « Vendu 62 € · N°215 / Combien tu l'avais payée ? », « Bordereau de retour reçu / Autry donna · à déposer avant le 23/11/2026 », « 8 offres à trancher / Dernier : Offre de 57 € · « New balance 9060 vert et blanc taille 38 » · <pseudo> — expire en 24h. » (105)) |
| `--mutations` (10 : texte d'avant du compte relié, identifiants pas retirés, paire oubliée, date de machine, pseudo de l'acheteuse remis, nom pas raccourci, corps 170, langue ignorée, retour vers la ligne d'achat, regroupement « Dernier ») | **10/10 rouges** (un banc qui LÈVE ne compte pas comme rouge : il doit tourner jusqu'au bout) |
| `scripts/tests/langue-compte.test.mjs` | 3/3 |
| audits remis à la règle (textes plus courts, sans pseudo, insécable avant « € ») | `audit-cibles-notif`, `audit-notifs-belles` R3, `audit-notifs-groupees` G8, `audit-compte-pas-relu` A17-A19/B3, `audit-saisie-rapide` P3/P3b/S1/K1, `audit-suivi-colis`, `audit-rappels-paire`, `audit-colis-heure`, banc `rappel-soir` (39/39, ses rouges « 503 » d'avant ont disparu) |
| verts | `notifs-redaction`, `notifs-belles` 41, `notifs-groupees` 41, `notifs-centre` 28, `reveil-calme` 13, `cibles-notif`, `vente-verification`, `flux-divers`, `traduction` 45, `csp`, `identite`, `fonctions-api` (12/12), `saisie-rapide`, `compte-pas-relu` 51, `rappel-urssaf`, `alerte-moderation` 65, `retours-litiges`, `statut-transporteurs`, `transp-notif`, `suivi-colis`, `colis-heure` 32, `rappels-paire` 14, `avis-negatif` 70, `double-vente`, `double-vente-ailleurs`, `suites-serveur`, `quoi-de-neuf`, `rappels-perso` 43, `abonnement` 103, `familles-serveur` 34, `horaires-mondialrelay`, `lbc-plus` 56, `mondialrelay-serveur`, `nom-paire-retrait`, `push`, `suivi-cles`, `suivi-vinted` 133, `veille-plantages` 33, `lbc-suppression`, `sans-bruit` 44, `vapid`, `transp-ext` 129, `retrait-fiable`, `retraits-fiables` 95 ; bancs `notifs-apercus` 30/30 (capture regardée), `rappel-soir` 39/39 |
| bancs des envois | `notif-messages` 38/38 (remis à la règle : nom court, « Nouveau message », sans pseudo), `offres-mini-push` 11, `retrait-conv-push` 15, `colis-relais-push` 14, `double-vente-push` 34 |
| `npm run build` | vert (après fusion de `origin/main` 7bcbdceb) |

## 6. Rouges qui ne sont pas de ce chantier

Identiques sur `origin/main` avant ce chantier : `audit-notifications` B3 (le corps de l'arrivée de
l'exemple n'a pas de date sur main non plus), `audit-signalement` (écran « parrainage » pas dans la
liste), `audit-vocabulaire-article` (2), `audit-lus-deux-appareils` (ne finit pas dans ce conteneur).
Bancs de l'app, mesurés aussi sur `origin/main` construit à part : `notifs-destination` (9 rouges sur
main, 11-12 ici, les mêmes écrans : vente ouverte, URSSAF, double vente eBay, et des « ni écran blanc
ni garde-fou » qui changent d'un passage à l'autre dans ce conteneur chargé), `compte-relie` (cibles
de 44 px à 1512 px : 3 ici, 4 sur main ; sa partie serveur, la vraie route, est verte).

## 7. Gestes de Julien

Aucun. La langue des notifications suit celle de l'app dès sa prochaine ouverture. Le « from
VRM » d'iOS reste (§4).
