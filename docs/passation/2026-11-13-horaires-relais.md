# 13 nov. — Les horaires d'ouverture des points relais (agent2-horaires-relais)

Demande : les e-mails de retrait des transporteurs donnent les horaires du point (Chronopost Pickup : « Horaires
d'ouverture : lun. - sam. 09:00 - 19:30 » sous « Détails du relais Pickup ») ; VRM ne les gardait pas.
Branche `claude/agent2-horaires-relais`. Rien d'écrit en base (lectures SQL projetées seulement). Aucune donnée
réelle dans le dépôt : toutes les fixtures sont inventées. `vinted-sync-extension/` pas touché.

## Mesuré (lecture seule, 13 nov.)
- 916 textes d'e-mails gardés (`email_texte_*`), 82 disent « horaires ».
- **Vinted Go** : « Horaires d'ouverture » puis ligne par ligne `*Lundi*` / `Fermé`, `*Mardi–Vendredi*` /
  `10:00-19:00`, ou `*Lundi–Dimanche*` / `07:00-21:00`. Texte gardé ENTIER (≈ 8 e-mails) : relu pour l'ancien.
- **Chronopost Pickup** : « Détails du relais Pickup » … « Horaires d’ouverture : » puis `lun. - sam. 09:00 - 19:30`.
  Le texte gardé est borné à 1 500 caractères (`api/_lib/resume-email.js`) et s'arrête JUSTE là : « lun. - sa… ».
  Pour l'ancien : rien (jamais un bout pris pour le tout). Les nouveaux e-mails sont lus sur le texte ENTIER.
- **Mondial Relay** : « Horaires d'ouvertures, photo, itinéraire : toutes les informations juste ici ! » — un lien,
  aucune heure ⇒ rien. Les conseils Vinted « Vérifie les horaires d'ouverture du point relais » ⇒ rien.
- `email_track_chronopost_08448881184010` relue par `relireLigneSuivi` (vérifié localement, valeurs non copiées) :
  à retirer, code, QR (`qrUrl`), lieu complet, limite 2026-11-17 (« encore 4 j ») — **ligne complète**. Son e-mail
  (« vous attend toujours ») a le texte gardé coupé à « lun. - sa… » : pas d'horaires pour elle (le prochain e-mail
  Chronopost les portera).

## La règle (`api/_lib/horaires-relais.js`, pure, partagée)
- En-tête « Horaires (d'ouverture) (du point / relais) : », puis les lignes qui suivent : jours seuls ou groupés
  (« lun. - sam. », « Mardi–Vendredi », « du lundi au samedi », « Lun. au Ven. »), une ou plusieurs plages
  (« 09:00 - 12:00 14:00 - 19:00 », « de 9h à 12h et de 14h à 19h », « 09h00 - 12h00 / 14h00 - 19h00 »),
  « fermé », « 24h/24 7j/7 », « tous les jours ». Forme rangée : `[{ jours: [1..7], plages: [{ de, a }] }]`,
  `plages: []` = fermé.
- **Rien plutôt qu'un faux** : ligne à moitié comprise, texte coupé (« … »), jour sans heure ni « fermé », jour dit
  deux fois, heure impossible, plage à l'envers, deux blocs différents dans le même e-mail, horaires d'un point
  « de proximité » (`sansSuggestions`) ⇒ `null`. Un jour que l'e-mail ne nomme pas est INCONNU, jamais fermé.
- La route (`parseCarrierEmail`, colis arrivé seulement) range `horaires` sur la ligne `email_track_*`. Un tableau
  n'est pas dans `meta` : la lecture des suivis le lit par son chemin (`CHAMPS_HORS_META`, jamais `select=data`).
- Lignes d'avant : `lieuxRelusDansTextes` (src/lieuxRetrait.js) lisait déjà les textes gardés des colis au point ;
  il en relit aussi les horaires (même lecture projetée, aucune requête de plus). Deux e-mails du même n° aux horaires
  différents ⇒ rien ; des horaires déjà rangés ne sont jamais remplacés ; lecture ratée ⇒ liste telle quelle.

## L'écran (Achats → À retirer, en-tête du point, `src/CarteRelais.jsx`)
« Ouvert lun.–sam. 9 h–19 h 30 · ouvert maintenant · ferme à 19 h 30 » ; le soir « · fermé — ouvre demain à 9 h » ;
« fermé — ouvre mardi à 10 h » ; « fermé — ouvre à 14 h » (pause de midi). Heure de PARIS. Un jour inconnu avant la
réouverture ⇒ « fermé maintenant » (aucune promesse) ; aujourd'hui inconnu ⇒ la ligne d'horaires seule. Horaires
de l'e-mail le plus récent du point. Couleur et taille de l'adresse, jamais ambre ; au téléphone la phrase passe
entière à la ligne. Horaires pas sus ⇒ rien.

## Preuves
- `scripts/audit-horaires-relais.cjs` : 52 contrôles (fixtures inventées Chronopost ×2, Vinted Go ×2, Mondial Relay
  lien et tableau, Relais Colis, InPost, Colissimo, DPD ; 12 formes qui ne doivent RIEN donner ; heure fixée ; vraie
  `parseCarrierEmail` et vraie route ; relecture projetée). `--prouve` : 9 mutations, toutes rouges. Sur
  `origin/main` (avec la seule règle recopiée) : 6 rouges (route, lecture, relecture).
- Banc `scripts/bancs/retirer-horaires.cjs` (390 tactile, 1512, clair, sombre, vendredi 10 h 19 et 20 h 30 fixés) :
  56 verts ; **32 rouges** sur le build d'`origin/main`. Il a d'abord trouvé la phrase coupée au bord à 390 px
  (4 rouges) : corrigé (retour à la ligne). Captures regardées.
- Audits verts : variables, tdz, coherence, identite, icones, fonctions-api, suivis-sans-qr (ses mutations
  suivent la liste), retrait-fiable, journal-emails, vintedgo, codes-retrait, colis-retrait, transporteurs,
  retraits-irreprochables, relais-carte, relais-change, colis-sens. Bancs relancés : retirer-scene-julien,
  retirer-ligne-unique, colis-retirer-propre.

## Ce qui reste
- Chronopost d'avant : texte gardé coupé avant les horaires ⇒ rien jusqu'au prochain e-mail du colis.
- Mondial Relay n'écrit pas ses horaires dans l'e-mail (un lien) : rien, sauf lecture chez le transporteur (pas fait).

Geste de Julien : aucun.

---

# Suite du lot (demandes du coordinateur, même branche)

## A. PRIORITÉ — « ici ça doit être dans les Mondial Relay » (capture de Julien, 08:39)
- **Avant** : une carte à part « 5 colis changent de point relais → INTERMARCHE, LE PORTAIL… · En route · 5 colis, leurs
  codes » (titre ambre), en plus des listes.
- **Maintenant** : `AlerteRelaisChange` n'est plus rendue (la lecture `colisRelaisChange` reste). Chaque colis redirigé est
  UNE ligne de la forme commune (`LigneRetraitF` : « Colis Mondial Relay », logo MR, code s'il est sûr) sous SON nouveau
  point dans « En route » (`src/CarteRelais.jsx`, prop `redirige`), en-tête écrit comme les autres points
  (« Intermarché · Le Portail, 35350 St Meloir des Ondes · Itinéraire » ; sans point lu : « Nouveau point pas encore
  lu »), mention neutre « En route · point changé » à la place du délai. Un n° déjà dans « À retirer » n'y est jamais redit.
- **« Retiré » puis « changé de plan », dit DISPONIBLE par le transporteur** (forme de 42878264) : `fusionTransporteur`
  tranche (nouveau cas, `api/_lib/suivi-colis.js`) ⇒ à retirer, au point, avec le code déjà lu.
- **Mesuré** (lecture seule) : 80459659 a reçu « Votre colis a changé de plan » le 13 nov. à 02:14, APRÈS « Où vous
  livrer… » — c'est maintenant un vrai changement (vers Intermarché) ; 80380675 (« Où vous livrer… » seul) : nulle part.
- **Preuves** : banc `retirer-points-changes` (390 tactile / 1512, clair / sombre) 40/0 ; **24 rouges sur le build
  d'origin/main** ; mutation « n° déjà à retirer redit » 16 rouges. Captures regardées. `audit-relais-change` (9/9
  mutations), `audit-retraits-irreprochables`, bancs `colis-propre-logos`, `retraits-fiables`, `retraits-irreprochables`
  remis à la règle (restent F7 / R1 sur le libellé « vérifié par… », hors de ce lot).

## B. Les rappels des transporteurs (« je veux que l'app sache simplement lire les rappels »)
- **Mesuré depuis le 25 oct.** : 50 rappels — Vinted Go « Libère de la place… » 21, Mondial Relay « Le temps file… » 18,
  Vinted Go « Rappel : récupère ton colis avant le… » 6, Chronopost « …vous attend toujours… » 5. Tous ceux dont le n° est
  lisible sont sur la ligne de leur colis : **0 ligne à part** (11 lignes « info » à part datent de septembre, avant la
  lecture du n° du sujet), **0 « retiré » réveillé**, aucun code/point/QR perdu. **Défaut trouvé** : la date limite Vinted
  Go (« À retirer avant le » puis « *12/11/2026* » à la ligne, en gras) n'était **jamais** lue (19 lignes « Libère… » sans
  limite) — corrigé (`limiteRetraitDepuisTexte`), et relue pour l'ancien dans le texte gardé (`src/lieuxRetrait.js`,
  année lue, jamais devinée).
- **La règle** (`api/_lib/rappel-colis.js`, utilisée par la route) : un e-mail suivant du même n° complète la ligne et
  n'efface jamais code, QR, point, date limite, horaires, titre ; un plus ancien ne remplace rien ; la date limite du
  rappel (sujet « avant le … ») gagne ; la clé de notification est celle de l'arrivée (pas de 2e notification).
- **Preuve** : `audit-rappels-colis` (route EXÉCUTÉE sur une base en mémoire, fixtures inventées des 4 formes) 38/0,
  **4 rouges sur origin/main** ; 6 mutations rouges (2e ligne, code effacé, retiré réveillé, horaires effacés, date en
  gras ignorée, relecture muette).

## C. Un colis = une fois (« le colis ne doit apparaître qu'une seule fois »)
- **Mesuré** : en base, 7 n° ont deux lignes (`email_track_vinted_N` « info » + `email_track_chronopost_N`) — l'app les
  fond par n° (`fusionLignesMemeSuivi`) ; aucun code de retrait sur deux n° au même point. La liste publiée
  (`vrm_colis_retirer`) : 10 colis, aucun n° en double.
- **Banc** `retirer-un-colis` : arrivée + 2 rappels + SMS + point changé (une ligne serveur, prouvé par l'audit B) + e-mail
  Vinted du même n° + lecture transporteur + achat Vinted relié par n° + « Commande mise à jour » de sa conversation ⇒
  **une ligne** au nom de l'article, avec son code ; un achat sans n° ni code au même point : une ligne à part (§5) ;
  total publié = lignes comptées. 20/0 sur la branche **et sur origin/main** (aucun doublon d'affichage dans cette scène :
  la règle existait) ; mutation « achat relié par identité plus écarté » ⇒ 8 rouges.

## D. Rappels de retrait (« tu peux peut-être faire des rappels »)
- **Mesuré** (`push_journal`, `colis_retrait_dedup`) : le « 📍 Dernier jour » part déjà au cron du matin (mémo : envois du
  29 oct. au 7 nov., un par n°) ; aucun depuis le 7 nov. (aucune date limite lue tombant ce jour-là). La veille n'était
  dite que dans le résumé du soir (groupée).
- **Maintenant** : au cron du matin, **la veille** « 📍 Demain dernier jour · {article} » et le jour même « 📍 Dernier jour ·
  {article} » (sinon « Colis {transporteur} »), corps « À retirer … · {point} · code X · {transporteur} n°… » ; une fois
  par colis et par étape (clés `demain-{n°}` / `dernier-{n°}`, par identité) ; jamais pour un retiré, jamais sans date
  limite LUE. Article : celui de l'e-mail de CE colis (`artTitle`, ajouté à `SELECT_SUIVI_META`).
- **Preuve** : `audit-suivi-colis` (route `api/ship-reminders.js` EXÉCUTÉE) étendu — veille au nom de l'article, retiré et
  sans date ⇒ rien ; mutations « veille muette », « veille d'un retiré ».

## Reste
- Le titre au nom de l'article quand le colis n'est relié à l'achat que par la commande Vinted (pas par l'e-mail) : le
  cron ne lit pas les titres des commandes (lecture lourde) — « Colis {transporteur} » dans ce cas.
- Le résumé du soir redit encore la veille (groupée) : à trancher (garder les deux, ou retirer la veille du résumé).
