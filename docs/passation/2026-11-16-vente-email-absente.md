# 16 nov. — Lot `vente-email-absente` : la vente vue par e-mail absente de Ventes, et « expire dans 24 h » sur une offre Vinted

Julien, cloche du 16 nov. : « Ventes · il y a 1 h · Vendu 64 € · 9060 vert/blanc T38 · Prépare le
colis : le bordereau suit par e-mail · Voir la vente » — et la vente n'est PAS dans Ventes. « D'habitude
ça prenait même avec les mails, ça disait que l'extension n'avait pas encore capté pour le bordereau. »
Même cloche : « Offre de 40 € · salomon XT-6 · … · expire dans 24 h » — or une offre Vinted n'expire
jamais (établi par Julien le 11 nov. ; seules les offres Vestiaire expirent).

## 1. Mesuré (lecture seule, vraie base — aucun nom, pseudo, adresse ni n° ici)

- La ligne `email_sale_m…` de la vente existe : `type: 'vente'`, `uid` du compte de RÉCEPTION (un
  compte lié, même propriétaire), `receivedAt` 16 nov. 13:05 UTC, prix « 64.00 », photo d'annonce,
  `pro: false`, **`transaction` vide** (`""`, data et meta).
- La liste des ventes de ce compte (`harvest_{uid}_orders_sold`) : `capturedAt` 15 nov. 17:52 UTC,
  donc AVANT l'e-mail ((c) tenait).
- Sur les e-mails de vente depuis le 1er nov. : **toutes les ventes Pro ont un n°, aucune vente de
  compte particulier n'en a** (0 sur 13, `pro: false`). Le n° n'est lu que dans la pièce jointe
  « Formulaire-retour-commande-{tx} » d'une vente Pro ; l'e-mail d'un particulier n'en porte pas.

## 2. Cause

La règle du 6 nov. (`src/venteEmailFraiche.js`, condition (a)) n'admettait qu'un e-mail de vente
avec un n° de transaction NUMÉRIQUE. Elle a été construite sur une vente du compte Pro : elle
marchait pour lui, jamais pour un compte particulier (le récit du 6 nov. le note : « Les 7 autres
(comptes particuliers) n'ont pas de n° : cette règle ne peut pas les juger »). La cloche, elle,
part de l'e-mail : elle annonçait une vente que Ventes écartait. Aucune des refontes des 3 derniers
jours ne l'a cassée (la règle, la lecture projetée et `_harvestSeen` sont intacts) : c'était un
trou de la règle, vu dès qu'une vente de compte particulier est arrivée app ouverte.

La mention « expire dans 24 h » : `api/_lib/notif-redaction.js` (lot du 15 nov. « notifications
belles ») l'ajoutait à TOUTE offre (`T.expire24`, corps et ligne du regroupement) — or l'e-mail
« Nouvelle offre » traité par `api/email-inbound.js` est celui de Vinted.

## 3. Ce qui change

### Ventes (src/venteEmailFraiche.js)
- (a) admet aussi l'e-mail de vente **sans n°** : il est identifié par SA ligne
  (`email_sale_{empreinte}`, `RE_ID_VENTE_EMAIL`), clé `email:email_sale_…` — jamais un nombre, donc
  aucune règle « par n° » (bordereau, facture Pro, colis, N° posé) ne la prend pour une transaction ;
  `_txMail` vide, `_sansTx: true`. Un n° présent mais pas numérique ⇒ toujours rien.
- Jamais par titre : deux e-mails de même titre (deux lignes) ⇒ deux ventes.
- (b) et (c) inchangées. Sans n°, la ligne Vinted ne peut pas la remplacer : elle sort dès que la
  liste du compte est relue ((c) la lecture fait foi) — jamais deux lignes après une relecture.
- Fenêtre ambiguë : si la liste, lue avant l'e-mail, porte déjà une vente de CE compte datée de
  moins de 30 min avant l'e-mail (`FENETRE_AMBIGUE_MS`), on ne sait pas si c'est la même ⇒ rien.
- La lecture projetée n'exige plus `meta->>transaction=not.is.null` (toujours `select=` scalaire).
- La ligne dit « Bordereau à venir : l'extension ne l'a pas encore capté. » (`ventes.venteEmailBordAVenir`,
  5 langues) tant qu'aucun bordereau de CE n° n'est là — sur la ligne, ou une fois dans l'en-tête du
  compte quand plusieurs lignes sont regroupées (§7).
- Inchangé : VENDU la compte (date = arrivée de l'e-mail) ; jamais le CA déclaré ; aucun geste d'envoi.

### Notifications (api/_lib/notif-redaction.js, notif-apercus.js)
- L'échéance « expire dans 24 h » n'est dite que pour `site: 'vestiaire'` ; une offre Vinted (le
  défaut, l'e-mail « Nouvelle offre ») n'a plus d'échéance, seule ni regroupée. `texteOffre` accepte
  `site` (seul 'vestiaire' passe). Les notifications déjà rangées dans la cloche gardent leur texte.

## 4. Preuves
- `node scripts/audit-vente-email-fraiche.cjs` : 54 verts (nouveau F10 : sans n° ⇒ une ligne par sa
  ligne, clé jamais numérique, deux titres égaux ⇒ deux lignes, avant la lecture ⇒ rien, fenêtre
  ambiguë ⇒ rien, autre compte ne gêne pas, (b) inchangée, requête sans filtre de n°). **Sur l'arbre
  de main** (`git archive origin/main`) : 7 rouges. `--prouve` : mutations (dont « vente sans n°
  écartée (avant le 16 nov.) », « fenêtre ambiguë retirée », « requête qui exige un n° ») — voir
  « ÉTAT À LA REPRISE ».
- `scripts/bancs/vente-email-fraiche.cjs` : E4 neuf (la forme réelle : `transaction: ''`) ⇒ SA ligne
  dans Ventes, « vue par e-mail », « bordereau à venir », aucun geste d'envoi, VENDU +64 €.
- `scripts/audit-notifs-redaction.cjs` : offre Vinted jamais « expire » (seule et regroupée), la règle
  dit l'échéance pour Vestiaire seulement ; mutation `offre-vinted-expire`.

## ÉTAT À LA REPRISE
Voir le rapport de la PR (chiffres des bancs et de la CI). Geste de Julien : aucun.
