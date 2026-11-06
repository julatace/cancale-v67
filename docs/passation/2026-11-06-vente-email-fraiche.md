# 6 nov. — La vente vue par e-mail, pas encore relue sur Vinted

Julien : « ma vente shopcancale n'apparaît pas dans VRM, j'ai capté sur Orion ». Branche
LOCALE `v36-vente-email-fraiche`, partie de `claude/project-review-nsk5su` (be6b7179). Rien
dans `vinted-sync-extension/` (lu seulement), `public/` intact. Rien poussé.

## Mesuré d'abord (sa base, SELECT seulement — aucun nom, pseudo, adresse ni n° ici)

**Forme des lignes.**
- `email_sale_*` : 210 lignes, toutes `type: 'vente'` (la branche « Ton article s'est vendu »
  du serveur). L'identifiant est une EMPREINTE (`pseudo|prix|titre`), jamais le n°. Le n° de
  transaction n'est que dans `transaction` (data ET `meta->>transaction`), et seulement sur les
  **10 ventes Vinted PRO** (`pro: true`, 30 oct. → 6 nov.) : lu par le serveur dans la pièce
  jointe « Formulaire-retour-commande-{tx} » ou « Numéro de transaction »
  (`transactionVentePro`). Les 11 ventes `pro: false` et les 189 anciennes (`pro` absent,
  juillet → 16 oct.) ont `transaction` vide. Champs : `designation`, `prix` (« 45.00 »),
  `uid`/`account` (rangés d'après l'adresse de RÉCEPTION), `receivedAt`, `pseudo`, `numero`,
  `nomComplet`, `adresse`, `email`, `pro`.
- `email_bord_{tx}` : 222 lignes `type: 'bordereau'`, les 222 avec un n° numérique
  (`transaction`, data et meta) — c'est l'identifiant de la ligne. 1 ligne sans champs
  (supprimée).
- ⚠️ **Le `numero` d'un bordereau n'est PAS une identité** : 135 bordereaux portent un N°, et
  **aucun** ne l'a lu dans l'e-mail (le titre ne contient jamais le N°) — les 135 l'ont reçu
  du serveur PAR TITRE (`findNumeroByTitle`, `parTitre` n'est pas rangé sur la ligne). Il n'a
  donc pas été utilisé (§5 « jamais par titre »), contrairement à la piste de départ.

**Les ventes e-mail récentes (< 14 j) absentes de la liste de leur compte.**
- 17 e-mails de vente sur 6 comptes ; 10 portent un n° (tous sur le compte PRO de la vente du
  matin) ; **1** est absent de l'`orders_sold` de son compte, et il est arrivé **après** la
  dernière lecture de cette liste ; 0 absent « avant la lecture ». Les 7 autres (comptes
  particuliers) n'ont pas de n° : cette règle ne peut pas les juger.
- Bordereaux < 14 j : 18 ; 1 absent de la liste de son compte (le même), après la lecture.
- Le compte concerné : `orders_sold` lue le 5 nov. 14:11 UTC ; `listings` et `profile` le
  6 nov. 07:50, `inbox` 07:59. Sa ligne `orders_sold` porte **2 000** ventes
  (`nItems`), pour **2 162** annoncées par Vinted (`pagination.total_entries`). Les 6 comptes
  relus ce matin (07:41-07:43) ont, eux, une liste de ventes du jour.
- Compteurs de l'extension (`panel_diag_capture`, tous navigateurs) :
  `ignore_partiel_actif_orders_sold` = 18, `ignore_partiel_orders_sold` = 1 119,
  `ventes_lecture_ratee_401` = 397.

## Pourquoi l'extension relit les annonces et la boîte, pas les ventes (lecture du code)

Trois chemins lisent `my_orders?type=sold`, chacun avec son plafond de pages :

| chemin | quand | plafond |
|---|---|---|
| `rafraichirVentes` (`background.js`, début de chaque visite) | 1 / 90 s / compte (`VENTES_DELAI_MS`) | `fetchAllOrders` : 8 pages × 40 = **320** |
| `runActive` → `toutesCommandes` (moisson complète) | 1 / 5 min / compte (`VISITE_DELAI_MS`) | 10 pages × 100 = **1 000** |
| `inject.js` → `activeHarvest` (dans la page, monde MAIN) | 1 / 30 min (`ACTIVE_TTL`, `localStorage`), onglet au premier plan | 20 pages × 100 = **2 000** |

Toutes écrivent par `storeHarvestRow`/`storeHarvest`, qui protège la liste par
`listePlusRiche` : une capture n'est rangée que si elle est **complète** (`n ≥
total_entries`) ou **au moins aussi longue** que la ligne en base (`nItems`). Pour ce compte
(2 162 ventes, 2 000 en base) :
- aucun chemin n'atteint 2 162 ⇒ jamais « complète » ;
- 320 et 1 000 < 2 000 ⇒ **refusées en silence** (`plus-pauvre`, compteur
  `ignore_partiel_actif_orders_sold`). Et ce refus compte comme « lu » : `rafraichirVentes`
  rend `ok: true` (la garde de 90 s reste posée), `runActive` compte `plus-pauvre` comme rangé
  (« Données rafraîchies en arrivant sur Vinted »).
- seule la lecture de la PAGE (exactement 2 000) passe — au plus toutes les 30 min, onglet au
  premier plan, si le script de page tourne dans ce navigateur et si ses 20 pages répondent
  toutes (un 429 la coupe : plus courte, refusée). Le 5 nov. à 14:11 elle est passée ; le
  6 au matin, dans Orion, non.
- Les annonces passent parce qu'un dressing lu en entier FAIT FOI
  (`dressingCompletFaitFoi`), la boîte parce qu'elle se FUSIONNE par conversation
  (`inboxFusionnee`) : ni l'une ni l'autre ne compare des nombres.

**Piste (non faite, l'extension appartient à une autre session)** : traiter `orders_sold`
comme la boîte — fusionner par `transaction_id` (une page 1 fraîche met à jour le haut de la
liste, une page plus profonde complète), au lieu de comparer des longueurs. Un compte de plus
de 2 000 ventes est aujourd'hui figé pour toutes les lectures du fond.

## Ce qui change (côté app)

### 1. La règle : `src/venteEmailFraiche.js`
On ne rouvre PAS la reconstruction générale depuis les e-mails (`ordersFromEmailSales` reste
débranché). Une vente e-mail entre dans Ventes **seulement si** :
- (a) `type === 'vente'` et un n° de transaction numérique (`/^\d{6,20}$/`) ;
- (b) son `uid` (celui de l'adresse de réception) est un compte Vinted lié, pas écarté
  (masqué, hors des totaux : `compteEcarte`) ;
- (c) le n° est absent de la liste Vinted (de N'IMPORTE quel compte : l'identité est le n°) ET
  l'e-mail est arrivé APRÈS la dernière lecture de la liste de ce compte (`capturedAt` rangé
  dans `_harvestSeen`, jamais `updated_at`). Liste pas lue (`failedUids`) ou aucune lecture
  datée ⇒ rien (« pas su »).
- Deux e-mails du même n° ⇒ une ligne (la plus ancienne date). Lecture PROJETÉE
  (`meta->>type=eq.vente`, `meta->>transaction=not.is.null`, 30 derniers jours), jamais
  `select=data` (la ligne porte l'adresse de l'acheteur) ; partagée et gardée 60 s.
- `avecVentesEmail` : dès que la liste Vinted porte le n°, la ligne e-mail sort — jamais deux
  lignes. Une liste « pas su » reste « pas su ».

### 2. Où elle apparaît
- **Ventes** (`ventesAffichees`) : une ligne marquée « Vue par e-mail », la phrase « Vendue —
  vue par e-mail, pas encore relue sur Vinted · ventes de ce compte relues hier 15 h 11 » et
  le geste « Ouvre Vinted › Mes commandes sur ce compte » + le navigateur
  (`motsNavigateur()` ; « sur l'ordinateur où est l'extension VRM » quand elle n'est pas ici).
  Aucun geste d'envoi (ni « Déposé », ni bordereau) ; ni « À envoyer » ni « En route » dans
  les filtres (son état n'est pas lu chez Vinted).
- **VENDU** : `vendus` (Ventes, Ma journée), la coque (`liveStatsVus`, la carte du mois, le
  widget), « Vendu et reçu » (`CaParPeriodeCarte`), la liste « Tous » (`VentesToutes`).
- **Jamais** : le CA déclaré (`ventesDeclarables`), l'argent à venir (`aVenirCoque`), Colis,
  les numéros (auto-numéro, verrous `vinted_txn_link`), l'anti double vente, la publication
  `publierVentesCoque` — tous lisent la liste Vinted seule.

**Décision — CA déclaré : non.** Le CA déclaré est daté au jour du VERSEMENT (§5, décision du
3 oct.). Une vente vue par e-mail n'est pas finalisée et n'a pas de versement : elle n'entre
dans aucun mois, même « à dater ». Elle y entrera par la ligne Vinted, finalisée, à la date de
son versement. VENDU (date de vente) la compte : l'e-mail de Vinted dit qu'elle est vendue et
payée, au prix de l'e-mail (illisible ⇒ « prix pas lu », nommé, jamais 0 €).

**N° de rangement** : par identité seulement, la règle de la ligne (`effEntry` : N° posé à la
main sur le n° de transaction, transaction → annonce, photo). Le N° du bordereau e-mail n'est
pas lu (trouvé par titre, voir la mesure). Pour la vente du matin, le N° viendra à la relecture
(ou s'il le pose sur la ligne).

### 3. L'indicateur des comptes (`src/fraicheurComptes.js`)
`lireCapturesDetail` (la même lecture que `lireDernieresCaptures`) rend aussi, par compte, la
date de sa liste de VENTES et de ses ANNONCES. Ventes plus vieilles que les annonces de plus
d'une heure ⇒ la ligne le dit, daté à l'heure de Paris (« ventes relues hier 15 h 11 — ouvre
Vinted › Mes commandes sur ce compte dans Orion »), en ambre (un geste) — et ne dit plus
« relu à chaque passage sur Vinted », faux pour ses ventes. Date inconnue, compte masqué,
banni ou délié ⇒ rien de plus. La phrase du geste est UNE (`gesteRelireVentes`, reprise par la
ligne de Ventes).

⚠️ Pour le compte de 2 162 ventes, rouvrir Vinted ne relit ses ventes que si la lecture de la
page passe (voir la cause) : le geste dit où regarder, la cause est dans l'extension.

## Preuves
- `node scripts/audit-vente-email-fraiche.cjs` : 41 contrôles verts (la règle EXÉCUTÉE :
  sans n° ⇒ rien ; n° dans la liste ⇒ une ligne, la Vinted ; e-mail plus vieux que la lecture
  ⇒ rien ; compte non lié / écarté / pas lu ⇒ rien ; statut « Commande mise à jour » ⇒ rien ;
  `ventesFaites` la compte, `ventesDeclarables` jamais ; l'indicateur). **Arbre d'avant**
  (`git archive be6b7179`) : 34 rouges (dont « relu à chaque passage sur Vinted » au lieu des
  ventes en retard). `--prouve` : **9/9 mutations** attrapées.
- `node scripts/bancs/vente-email-fraiche.cjs` (port 9712, `SHOTS=`) : 64 verts à 390 px et
  1512 px, clair et sombre — une ligne pour la vente fraîche, aucune pour les cinq autres
  e-mails, aucun geste d'envoi, rien de coupé ; VENDU du mois +72 € (exactement), le même
  une fois la liste relue ; l'indicateur dit les ventes du compte 111 en retard, pas celles
  du 222. Captures regardées. Sur le `dist/` de l'arbre d'avant (`BANC_DIST`, 390 et 1512,
  clair) : **18 rouges** — aucune ligne pour la vente du matin, VENDU inchangé (188 € avec ou
  sans l'e-mail), l'indicateur muet.
- `npm run build`, `audit-identite`, `audit-coherence`, `audit-chiffres`, `audit-urssaf`,
  `audit-statuts`, `audit-tdz`, `audit-chrome-en-dur`, `audit-double-vente` : verts.

## Gestes de Julien
- Rien à installer. Ouvrir Ventes : la vente du matin y est, marquée « Vue par e-mail ».
- La ligne « Tes comptes · dernière relecture » dit quel compte a ses ventes en retard.
- Décider de la piste extension (fusion par n° de transaction pour `orders_sold`).
