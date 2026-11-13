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
