# 16 nov. — Lot `transporteurs-suivi` : Mondial Relay pour les colis vendus, Colissimo / UPS avec la clé DU VENDEUR

Branche `claude/transporteurs-suivi` (part de `origin/main` 5a9abe571). Mission (60) du brief du 16 nov.
Sources lues : `2026-11-11-suivi-commandes.md`, `2026-11-11-retraits-fiables.md`, `2026-11-12-restes.md`,
`2026-11-13-lot89-suivi-transporteurs.md`, `2026-11-13-guide-cles-transporteurs.md`.
**Aucune requête réelle aux transporteurs** n'est partie de ce lot : tous les contrôles servent de faux serveurs.
**Aucune écriture en vraie base.** 12 fonctions `api/` (aucune ajoutée : la route vit dans `api/compte.js`).
Extension **pas touchée** (décision « on ne fait pas avec l'extension » pour les transporteurs ; serveur seul).

## ÉTAT À LA REPRISE

- Code fait, vert en local (voir §5). PR : voir la fin de ce fichier.
- **Ce qui reste, et pourquoi (point 9 du brief : rien d'inventé)** :
  1. **La forme RÉELLE d'une étiquette Mondial Relay de vente n'a pas été mesurée ici** (le PDF porte l'adresse de
     l'acheteur ; aucune lecture de PDF réel n'a été faite). La règle lit seulement « 5 chiffres + nom de ville »
     et chaque code postal n'est GARDÉ que si Mondial Relay renvoie l'écho de CE n° à CE code postal : une étiquette
     qui ne l'écrit pas en texte (image, police sans table) donne « aucun code postal » ⇒ **aucune requête**, et Ventes
     le dit (« Mondial Relay : pas de code postal du point lisible sur l'étiquette »). **Mesure à faire** (lecture seule,
     sans recopier le texte) : sur 3 bordereaux Mondial Relay de vente, `cpsDeLEtiquette(await texteDuPdf(pdf))` rend-il
     le code postal du point de l'acheteur ? Puis regarder en base les lignes `depart_mondialrelay_*` : `cp` (prouvé),
     `cpsRefuses`, `essaiRes`.
  2. **Quel code postal la route `_mvc` accepte pour un colis vendu** (celui du point de l'acheteur seulement, ou aussi
     celui de l'expéditeur ?) n'est pas connu. Les deux sont essayés dans l'ordre de l'étiquette (au plus 4), un par
     passage, chacun prouvé par l'écho ; un refusé n'est jamais réessayé. Aucune hypothèse n'est codée.
  3. **La Poste / UPS : formes tirées de la documentation officielle, NON MESURÉES** (inchangé depuis le lot 89). À
     relire au premier appel réel d'un vendeur qui a posé sa clé : la ligne `transp_colissimo_*` / `transp_ups_*` et
     sa `forme` si « forme ». La vérification de la clé La Poste n'est faite qu'à sa PREMIÈRE lecture réelle
     (aucun appel « vérifier ma clé » n'est documenté ; on n'invente pas un n° pour sonder).
  4. DPD, GLS, Relais Colis : **rien branché** (voir §3).
  5. SMS Chronopost : **rien d'inventé** — le lecteur prudent du 9 nov. (`api/_lib/sms-chronopost.js`) ne range que la
     forme propre `XW/ZW…TS/SP`, sinon « à vérifier ». Il manque toujours UN vrai SMS Chronopost copié par Julien
     (`docs/passation/2026-11-09-transporteurs-emails.md`, « Copie-moi un SMS Chronopost »).

## Le geste de Julien (et de chaque vendeur)

**Où coller ses clés gratuites : VRM → Paramètres → Ventes et colis → « Suivi Colissimo et UPS ».**
- Colissimo / La Poste : compte gratuit sur developer.laposte.fr → créer une application → souscrire à l'API « Suivi »
  (offre gratuite) → copier la clé d'API → la coller dans le champ « Ta clé d'API La Poste (Okapi) » → « Ranger ma clé ».
- UPS : compte gratuit sur developer.ups.com → créer une application avec le produit « Tracking » → copier Client ID et
  Client Secret → les coller → « Ranger ma clé » (UPS est interrogé une fois pour un jeton : refusé ⇒ rien rangé, dit).
- Jamais une clé collée dans une conversation. Pas de Redeploy.
- Les anciennes variables Vercel `LAPOSTE_OKAPI_KEY`, `UPS_CLIENT_ID`, `UPS_CLIENT_SECRET` **ne sont plus lues** : il
  peut les supprimer (Vercel → Settings → Environment Variables). Le pas-à-pas du 13 nov. est annoté
  (`2026-11-13-guide-cles-transporteurs.md`).
- Rien à faire pour Mondial Relay : les ventes avec un bordereau Mondial Relay reçu par e-mail sont lues seules.

## 1. (a) Mondial Relay : un colis VENDU est lu chez le transporteur

Avant : « Mondial Relay ne se lit pas pour un colis vendu. Vinted et les e-mails font foi. » — la seule route lisible
(`_mvc`, mesurée le 24 oct.) exige un code postal, et VRM ne connaissait que ceux de SES points (achats).

Maintenant, par la MÊME voie que les achats (serveur, `api/_lib/transporteurs-lecture.js`, la même file, le même
User-Agent honnête, la même pause sur refus), dans les lignes de départ `depart_mondialrelay_{n°}` (jamais `transp_` :
le colis de l'acheteur n'est jamais « à retirer » chez Julien, rien ne sonne) :
- **qui** : un bordereau Vinted (`email_bord_{tx}`) ou un bon de retour (`email_bordretour_{tx}`) dont l'e-mail OU
  l'étiquette NOMME Mondial Relay (InPost compris ; deux noms différents ⇒ aucun) — jamais par la forme du n°
  (8 chiffres, banale) ; le transporteur relu des anciens bordereaux (`vrm_bord_transporteurs`) compte aussi ;
  un n° aussi porté par un ACHAT ⇒ ambigu, jamais lu ; une vente Vestiaire Mondial Relay (aucune étiquette lisible
  par VRM) n'est pas choisie ;
- **le code postal** : le PDF de l'étiquette de CETTE transaction (identité, §5) est lu UNE fois (un PDF par requête,
  `data->>pdfB64`), `cpsDeLEtiquette` garde « 5 chiffres + ville » (jamais un morceau de code-barres, jamais le siège
  59650), au plus 4, rangés en scalaires (`cpsPdf`, `cpsLu`). **Le texte n'est jamais gardé.**
- **la preuve** : chaque code postal est essayé (un par passage), et n'est GARDÉ (`cp`) que si la réponse porte l'ÉCHO
  de ce n° à ce code postal (`lireReponseMondialRelayMvc`) ; refusé (« pas de colis », écho autre) ⇒ `cp-inconnu`,
  noté dans `cpsRefuses`, jamais réessayé (la règle des achats, `resultatMondialRelay`). Plus rien à essayer ⇒ aucune
  requête, plus jamais relu (`mrSansCodePostal`).
- **la prise en charge** : datée du premier évènement « de route » mesuré (`classeMr` : pris en charge, remis…, jamais
  « en préparation chez l'expéditeur ») ⇒ « Mondial Relay l'a pris en charge le 11 nov. » (`departProuve`), la vente
  quitte « À envoyer » par la règle déjà partagée (app, widget, rappels).
- Ventes : la raison sans lecture vient de la ligne (`raisonPasLuVente`, App.jsx) : « Pas encore lu chez Mondial
  Relay. » ou, constaté, « Mondial Relay : pas de code postal du point lisible sur l'étiquette. Vinted et les e-mails
  font foi. » — par `tr()`, 5 langues (`src/i18n/langues/*/clesSuivi.js`).
- Fichiers : `api/_lib/depart-colis.js` (`DEPART_CARRIERS`, `cpsDeLEtiquette`, `cpDepartMr`, `mrSansCodePostal`,
  `idPdfDuSortant`, `nomDuBordereau`, `SELECT_DEPART_META` + `cp,cpsPdf,cpsRefuses,cpsLu`), `api/_lib/transporteurs-lecture.js`
  (`passageDeparts`, `lireCpsEtiquette`), `api/_lib/suivi-commandes.js` (noms).
- Confidentialité (`public/legal/confidentialite.html`) : les colis que tu ENVOIES, et « seuls les codes postaux sont
  gardés, jamais le reste de l'étiquette ».

## 2. (b) Colissimo / La Poste et UPS : la clé DU VENDEUR, jamais celle de Julien pour les autres (§2.9)

Avant (lot 89, 13 nov.) : les adaptateurs officiels existaient mais s'allumaient avec les variables Vercel de
l'INSTALLATION — le compte développeur de Julien lisait les colis de tous les vendeurs. Maintenant :
- `api/_lib/cles-transporteurs.js` : le coffre (comme Photoroom) — `suivi_cle_colissimo` / `suivi_cle_ups` par vendeur,
  chiffrées (AES-256-GCM, `api/_lib/coffre.js`, un usage par transporteur, l'identifiant du vendeur en donnée associée) ;
  la route `/api/compte?mode=cles-suivi` (GET l'état ; POST `poser` / `retirer` confirmé) ne renvoie jamais la clé ni le
  chiffré (la fin, la date, `verif`) ; base pas cloisonnée ⇒ 503 ; abonnement coupé ⇒ 402 (retirer reste possible) ;
  sans clé de coffre ⇒ rien rangé. UPS vérifié à la pose (jeton OAuth officiel : 400/401/403 ⇒ refusé, RIEN rangé).
- `api/_lib/transporteurs-lecture.js` : au début de CHAQUE passage, les clés du vendeur de ce passage sont lues et
  attachées à SON contexte (AsyncLocalStorage — le cron lit plusieurs vendeurs en parallèle) ; `T.fournirLecturesServeur`
  dit `{ colissimo, ups }` pour CE vendeur (hors passage : `null`, « pas su ») ; le jeton UPS est gardé PAR vendeur ;
  la pause d'une clé refusée est celle de SA clé (`colissimo@{vendeur}`), jamais celle des autres ; la première lecture
  note « acceptée » / « refusée » sur sa ligne (comparer-et-échanger sur `rev`).
- `api/_lib/transporteurs.js` : `lecturesCleDeEnv` / `VARIABLES_CLE` retirés (plus aucune lecture d'environnement),
  `CHAMPS_CLE`, `lecturesCleDe`, `fournirLecturesServeur`.
- Colis vendus : Colissimo et UPS entrent dans `DEPART_CARRIERS` (lus seulement avec SA clé, nommés par le bordereau).
- Sans clé : la ligne dit « **Colissimo : suivi non lu chez ce transporteur** » + « Colle ta clé Colissimo gratuite dans
  Paramètres → Ventes et colis, ou regarde le site de Colissimo. » (`src/retraitSuivi.js`) ; en Ventes, « Colissimo :
  suivi non lu chez ce transporteur. Colle ta clé gratuite dans Paramètres → Ventes et colis. »
- L'écran : `src/parametres/ClesSuivi.jsx`, rangée `cles-suivi` (icône neuve `suiviColis`), catégorie « Ventes et
  colis » (lien profond `?tab=settings&reglage=cles-suivi`). Les lignes `suivi_cle_*` sont exclues des exports et
  sauvegardes (`SECRETS`, `EXCLUS`).

## 3. DPD, GLS, Relais Colis : rien — pourquoi

Aucune API OFFICIELLE de suivi gratuite et ouverte à un particulier n'est documentée : les services web de DPD
(« DPD Web Services ») et de GLS (« ShipIT / Track & Trace ») sont réservés à leurs clients expéditeurs sous
contrat ; leurs pages publiques ne sont pas une API documentée et n'ont jamais été mesurées (le conteneur ne les joint
pas ; le bac à sable Vercel est épuisé jusqu'au 1er déc., lot 89) ; Relais Colis n'a aucun service de suivi public
documenté. On n'écrit pas un lecteur de page inventé : e-mails et SMS seulement, la ligne dit « suivi non lu chez ce
transporteur » (sans clé à coller). Raison écrite dans `api/_lib/suivi-public.js` (`VOIES_A_OUVRIR`).

## 4. (c) SMS Chronopost

Rien changé, rien inventé (voir « ÉTAT À LA REPRISE » 5).

## 5. Preuves

- `scripts/audit-suivi-ventes-mr.cjs` (neuf) — le VRAI passage sur une fausse base PostgREST, un VRAI PDF fabriqué
  par pdf-lib lu par le vrai `texteDuPdf`, un faux mondialrelay.fr à la forme MESURÉE : **18 verts** ; **10 rouges**
  sur le code d'avant (arbre `git archive origin/main`) ; `--prouve` **10/10 mutations** (code-barres pris pour un code
  postal, siège essayé, écho ignoré, code postal refusé réessayé, Mondial Relay par la forme, requête sans code postal,
  Mondial Relay pas lu en vente, prise datée du dernier évènement, texte de l'étiquette gardé, phrase oubliée).
- `scripts/audit-suivi-cles.cjs` (porté sur la nouvelle règle : la clé posée dans le coffre du vendeur, plus dans
  l'environnement) — **≈ 80 verts** dont : variables Vercel posées ⇒ rien (C5a, D5, G1), la clé de A ne sert jamais à B
  (H1–H3), pause par clé (E7–E7c), la route (R1–R8) ; sur le code d'avant : C5a, C11, C12, D5, E1–E7, F1–F7, G1, H1, H3
  rouges ; `--prouve` **26/26 mutations** (dont clé de l'installation, clé d'un autre vendeur, repli sur la variable
  Vercel, pause de tous les vendeurs, vérification jamais notée, la route qui renvoie la clé, UPS refusé rangé).
- Portés sur la nouvelle règle (ils encodaient « Mondial Relay vendu jamais lu ») : `audit-colis-sortants` (35 verts),
  `audit-suivi-commandes` (59 verts) ; `audit-politique-hotes` connaît les deux liens de Paramètres et le jeton UPS
  dans `cles-transporteurs.js`.
- Sans régression : statut-transporteurs, mondialrelay-serveur, depart-mondialrelay, transp-ext, transp-notif,
  transporteur-lu, suivi-public, retraits-irreprochables, fonctions-api (12/12), coherence, export-rgpd, export-donnees,
  sauvegarde-export, traduction, quoi-de-neuf, icones. Rouges d'avant inchangés (aussi sur origin/main) : parametres
  (« taille-texte », « mes-plateformes = zoom »), politique-hotes (liens d'autres lots), textes-courts (Ebay.jsx),
  retraits-suivi (module `alertesSeuils.js` absent de sa copie), vintedgo-adresse.
- Banc `scripts/bancs/cles-suivi.cjs` (neuf) — 390 tactile et 1512, clair et sombre : la rangée s'ouvre, « suivi non lu »
  sans clé, UN envoi `poser`, la clé n'est plus dans la page ni sur l'appareil, « Retirer » confirmé, UPS refusé dit,
  lecture ratée ⇒ « pas su » sans formulaire, 44 px, aucun débordement. Captures regardées.
