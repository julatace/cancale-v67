# 9 nov. — Fiabilité : compte relié tout de suite, transporteur des anciens bordereaux, Mondial Relay au départ

Branche `claude/fiabilite-9nov` (depuis `origin/main` b3ec1b17, extension servie 5.330).
**Extension 5.331.0** (à installer). Aucune migration, aucune fonction `api/` de plus (12).

## 1. « shop_x est relié à VRM » tout de suite — extension 5.331 (`comptepush`)

Suite de `2026-11-08-compte-relie.md` (« Signal qui manque côté extension ») : l'extension
écrit les comptes directement en base ; sans app ouverte, le serveur ne voyait un compte neuf
qu'au cron du matin ou du soir.

- `background.js` : après la **première écriture réussie** d'un compte, `signalerCompteRelie`
  appelle `POST https://vrm.center/api/push { action:'comptes' }` avec la session VRM (Bearer).
  Le corps ne dit rien (ni compte, ni nom) : la route relit tout au nom du vendeur de la session
  et décide (point de départ, une fois par compte — `api/_lib/compte-relie.js`, inchangé).
  - Vinted : première écriture = aucune entrée `vrmCompteEcrit` pour cet uid dans CE Chrome
    (`compteDejaConnuIci` ; stockage illisible ⇒ « connu », rien signalé). Une mise à jour
    5.330 → 5.331 ne signale donc pas les comptes déjà là.
  - Leboncoin (`lbc_accounts`) : l'id (sous ses deux clés `X` / `lbc-account:X`) absent avant
    l'écriture, et source « moi » (session ou source non « autrui »).
  - Vestiaire (`vc_session`) : l'id absent de `comptes` et différent de `id` avant l'écriture.
  - eBay : rien côté extension (c'est la route eBay OAuth qui écrit `ebay_comptes`).
- **Une fois par compte** : `vrmComptesSignales` dans `chrome.storage.local`
  (`{ 'vinted:222': { at, fait } }`, 200 « faits » gardés). **Sans session ⇒ aucun appel**
  (le signal attend, 24 h au plus). Réseau / 5xx / 401 / 429 ⇒ gardé, retenté à la prochaine
  écriture d'un compte et à chaque visite (`envoyerComptesSignales` après `envoyerNotifsRetrait`) ;
  autre 4xx ⇒ oublié ; 2xx ⇒ fait. Un seul appel couvre tous les comptes en attente.
- CORS : `api/push.js` appelle déjà `corsExtension` (Orion) — vérifié, rien à changer.
- Version 5.331.0 : `CODE_VERSION`, manifeste, `lbc-inject.js`, `lbc-relay.js`, `EXT_ATTENDUE` ;
  capacité `comptepush` (`EXT_CAPACITES`, table §8 de CLAUDE.md, `audit-coherence`) ; zips
  régénérés (`node scripts/zip-extension.cjs`).
- Garde-fous du §3 intacts : aucune requête Vinted ajoutée, rien qui agit au nom d'un compte.

**Preuves** — `scripts/audit-compte-relie-push.cjs` (EXÉCUTE le vrai `background.js`,
`_fond-vm.cjs`) : **19 verts** ; sur la 5.330 (`--src` = background.js d'`origin/main`) :
**12 rouges** (aucun appel). Mutations (copies de background.js) : signal sans « première
écriture » ⇒ 3 rouges ; fiche Leboncoin d'autrui signalée ⇒ 1 ; appel sans session ⇒ 2 ;
réseau pris pour un refus ⇒ 3 ; jamais marqué « fait » ⇒ 4. Verts : `audit-extension-zip`
(5.331 jamais servie), `audit-paquets-boutiques`, `audit-sans-session-envoi`, `audit-coherence`,
`audit-extension-navigateurs`, `audit-compte-ecritures`.

## 2. Le transporteur des anciens bordereaux (cron du matin)

Suite de `2026-11-08-colis-envoyes-tri.md` (« Piste pour les bordereaux déjà reçus »). Mesuré
dans le code (pas sur la base : le projet Supabase joignable n'est pas celui de VRM) :
- la route garde, par e-mail, `email_reception_{empreinte}` (sujet, résumé `{ t:'bordereau', tx }`)
  et `email_texte_{empreinte}` (texte lisible, **borné à 1 500 caractères** + « … ») ;
- `email_bord_{tx}` porte son PDF : le réécrire demanderait `select=data` (§4.4, interdit).

**Ce qui est fait** — `api/_lib/transporteur-anciens.js`, appelé par `traiterVendeur` (matin
seulement) dans `api/ship-reminders.js` :
- candidats : `email_bord_*` dont la clé `transporteur` est **absente** (bordereaux d'avant le
  9 nov. ; une clé vide veut dire que la réception a déjà lu le texte entier ⇒ jamais touché) ;
- identité : le n° de transaction lu dans l'e-mail (résumé `tx`) = celui du bordereau ;
- règle : `transporteursNommes` / `transporteurDeTexteBordereau` (celle de la réception) sur
  sujet + texte de CHAQUE e-mail du n° ; deux noms dans un texte, ou deux e-mails qui ne disent
  pas le même ⇒ rien ; un rappel muet n'ajoute aucun nom ; **un texte coupé ne décide rien**
  (un second nom pouvait être après la coupure) ;
- rangé dans UNE ligne légère `vrm_bord_transporteurs` `{ v, parTx: { tx: { t, s?, at } },
  vus: { tx: { at, r } } }` (préfixe choisi pour ne tomber sous aucun `like.` existant :
  `transp_*` attrape aussi `transporteurs…`) ; 20 bordereaux par passage, les plus récents
  d'abord ; un n° décidé ou vu n'est plus relu (idempotent) ; 2 000 « vus » au plus ;
- lecture ratée (bordereaux, suivis, textes, ligne) ⇒ **rien écrit**, dit dans la réponse
  (`transporteursAnciens`) ;
- lectures projetées et paginées (`id,tx:meta->>…`, `data->resume->>tx`, `texte:data->>texte`),
  jamais `select=data` sur un bordereau ou un texte.
- L'app (`fetchEmailBordereaux`) lit `parTx` à côté des bordereaux et le fusionne par
  `transporteurRelu` : **jamais à la place** d'un transporteur rangé (`transporteurSource:
  'email-relu'`). Ligne illisible ⇒ rien fusionné.
- Limite dite : le texte gardé est `texteUtile` (le texte de l'e-mail, ou son HTML remis en
  texte) — la réception lisait texte ET HTML ; et un e-mail reçu avant que `email_texte_*`
  existe n'a rien à relire (compté `sansEmail`).

**Preuves** — `scripts/audit-transporteur-anciens.cjs` EXÉCUTE le vrai handler du cron contre
un faux PostgREST (meta comme la migration 004, projections, `owner=`, `like/eq/in`,
`data->resume->>t=eq.`, `Range`) : **27 verts** ; sur `origin/main` (arbre `git archive`) :
**20 rouges sur 26** ; `--prouve` : **17/17 mutations** rouges.

## 3. Mondial Relay au départ

Suite de `2026-11-08-restes-ventes.md` §3. **Ce qui existe déjà sur `main` (vérifié en
l'exécutant)** : depuis le 9 nov., `parseBordereauEmail` range le n° Mondial Relay (8 chiffres
après « N° de suivi ») écrit dans l'e-mail du bordereau ; l'e-mail Mondial Relay « entre de
bonnes mains » est rangé `email_track_mondialrelay_{n°}` (`transit`, `sortant`) ; la règle
partagée `depart-vente.js` fait alors sortir la vente par ce n° EXACT.
`scripts/audit-depart-mondialrelay.cjs` exécute la vraie route `email-inbound.js` (bordereau
puis dépôt) et juge avec `ventesPartiesParPreuve` servie comme le serveur lit la base :
**10 verts** (D1 même n° ⇒ sort « E-mail de dépôt Mondial Relay » ; D2 autre n° ⇒ reste ;
D3 sans n° ⇒ reste, rien inventé ; D4 n° partagé ⇒ ambigu ; 50 ventes au même titre ⇒ une
seule sort ; D6 e-mail d'étiquette ⇒ rien). `--prouve` : **4/4**. C'est un garde (vert sur
`main` aussi : la chaîne y est déjà).

**Ce qui est ajouté** — les **anciens** bordereaux sans n° : la passe du §2 relit aussi, dans
le texte de SON e-mail, le n° Mondial Relay par **la même règle** (`suiviMondialRelayLu`,
maintenant partagée par `parseBordereauEmail`), seulement pour un bordereau sans n° rangé ;
deux n° différents ⇒ rien ; un n° qui touche la coupure du texte ⇒ rien. Le n° relu (`s`)
est fusionné **seulement là où le bordereau n'a pas de n°** par l'app, `api/widget.js`
(`bordRows`) et les rappels/bilan (`lireBordsAvecRelus`) ⇒ `depart-vente.js` s'applique
seul. `audit-transporteur-anciens` T7 (vrai `api/widget.js` + composition du cron) : avant la
passe 4 ventes MR à envoyer ; après, seule celle dont le dépôt du MÊME n° est arrivé sort
(widget 3, rappels 3) ; ligne relue illisible ⇒ elle reste. Rouge sur `origin/main`.

**Ce qui manque encore, précisément (rien deviné)** :
1. **La forme réelle n'est pas mesurée** (aucune base VRM joignable ici) : l'e-mail
   « Bordereau d'envoi » Vinted écrit-il le n° MR après « N° de suivi » ? Le 2 nov., 120
   bordereaux sur 214 avaient un `suivi` vide. À mesurer : `select meta->>'suivi' from app_data
   where id like 'email_bord_%' and meta->>'receivedAt' > '2026-11-09'` — un n° de 8 chiffres
   apparaît-il ? Et `vrm_bord_transporteurs.parTx` (combien de `s`) après le premier cron.
2. L'e-mail MR de dépôt porte-t-il le **même** n° (8 chiffres) que le bordereau ? Mesure :
   `email_track_mondialrelay_*` récents, `meta->>suivi`, comparés aux `email_bord_*.suivi`.
3. Les bordereaux reçus **avant** `email_texte_*` (et ceux dont l'e-mail ne porte pas le n°)
   restent sans identité : seule voie restante, `journey_summary.current_carrier.tracking_code`
   d'une VENTE (restes-ventes §3, mesure 3) — nouvelle version d'extension, pas faite.
4. Pas fusionné (voulu, sens sûr) : les listes qui écartent NOS envois de « À retirer »
   (`ship-reminders` `rappelsColisRetrait`, `transporteurs-lecture`, l'app) lisent les seuls n°
   rangés — au pire un colis de plus « à vérifier », jamais un colis caché.

## Audits et bancs
Verts : `npm run build`, `audit-identite`, `-statuts`, `-variables`, `-tdz`, `-coherence`,
`-fonctions-api` (12), `-transporteur-bordereau`, `-a-envoyer-preuves`, `-colis-envoi`,
`-colis-ventes-email`, `-bordereau-des-email`, `-email-formes`, `-journal-emails`,
`-cron-lots`, `-compte-pas-relu`, `-purge-mesures`, `-cle-service`, `-pagination-ordre`,
`-lectures`, et les trois audits neufs. Bancs : voir le rapport de la session (colis-envoyes-tri,
colis-envoi, compte-relie).

## Gestes de Julien
1. Installer l'extension **5.331** (remplacer le dossier, ⟳ dans chaque Chrome ; Orion aussi).
2. Rien d'autre : la passe des anciens bordereaux tourne seule au cron du matin.
