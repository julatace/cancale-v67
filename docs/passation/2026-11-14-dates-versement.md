# 14 nov. 2026 · Les dates de versement : une règle, quatre sources

Branche `claude/dates-versement` (la branche du lot DJ7, déjà fusionnée, reprise). Ses mots, devant
« Contrôle de cette nuit : 1741 ventes sans date de versement depuis 30 jours » : « Pour les ventes
sans dates, c'est pas possible, il y a les dates dans la conversation, la date de réception d'argent
et le jour de la vente. »

**Réponse courte** : il a raison, les dates existent chez Vinted (le message « Ta vente est
finalisée. » de la conversation porte la date du versement, à la seconde près). Mais **aucune** de
ces 1 741 dates n'était encore dans la base : VRM doit les lire, une vente à la fois. Ce lot fait
entrer la conversation (et l'e-mail « Transaction finalisée » quand il porte le n°) dans LA règle de
datation, les fait lire par l'extension 5.376.0, et remplace la phrase alarmante par une phrase qui
dit ce qui est daté, pourquoi le reste attend, et en combien de temps.

## 1. Mesuré sur SA base (lecture seule, 14 nov. midi, projections seulement, aucune donnée ici)

Les 1 741 ventes : toutes sur **un seul compte** (le grand compte), finalisées, vendues du
17 mai 2025 au 1er juin 2026 (aucune vente plus récente n'est sans date). Par IDENTITÉ (n° de
transaction), ce qui existe pour elles :

| source | lignes en base pour ces 1 741 | remarque |
|---|---|---|
| transaction « Commande finalisée » (450), `harvest_*_txn_*` | **0** | 69 détails rangés sur ce compte (48 finalisées, toutes vendues après juin 2026) ; 51 le 11 nov. ⇒ ≈ 6 par jour depuis le 5 nov. |
| relevé du porte-monnaie (`harvest_*_releve_*`, `txDeLigneReleve`) | **0** | aucune ligne de relevé rangée, tous comptes ; la réponse `wallet/invoices/current` de ce compte : `invoice_lines` vide, `history` **vide** (Vinted ne propose aucun mois passé pour ce compte) |
| conversation de la commande (`harvest_*_conv_*`) | **0** | 1 741 / 1 741 ont leur `conversation_id` dans la liste des ventes ; 1 seule conversation rangée sur ce compte (vide) |
| e-mails Vinted (`email_final_*`, `email_sale_*`) | **0** | les e-mails arrivent depuis le 16 juillet 2026 (après ces ventes) ; 188 « Transaction finalisée », 2 seulement portent le n° de transaction |
| date de vente (`my_orders[].date`) | 1 741 | c'est « Vendu », jamais « reçu » (§5) |
| statut de la commande | 1 741 « finalisée » | la liste le dit, sans la date |

**La conversation date juste** : sur les 41 ventes (autres comptes) où la base a à la fois la
conversation rangée et la transaction 450, le message système « Ta vente est finalisée. »
(`action_message`, `event_type: completed`, `event_group: completion`, `created_at_ts`) a **la même
date que `status_updated_at` de la 450, à la seconde, 41 fois sur 41** (côté acheteur, « Profite de ta
commande ! » : 5 sur 5). La conversation porte `transaction.id` (l'identité), `current_user_side`
(vendeur ou acheteur) et `transaction.status` (450).

Couverture **avant** : 356 ventes datées ✓ (toutes par la transaction 450), 0 par le relevé,
1 741 sans date. **Après ce lot, tout de suite** : la même chose pour ces 1 741 (aucune source n'est
encore en base pour elles) ; sur toute la base, +1 vente datée par un e-mail qui porte son n°
(`email_final_*` avec `transaction`, pas encore de 450). Les 40 conversations vendeur-450 déjà
rangées sont toutes déjà datées par leur 450. **Le gain vient de la lecture** (§3) : à 12 lectures/h
en fond (288 par jour, onglet vinted.fr ouvert sur ce compte), ≈ 7 jours pour les 1 741.

Pourquoi si lent jusqu'ici : le détail n'est lu que pour le compte **connecté dans l'onglet**
(garde-fou §3) ; depuis le 5 nov., ≈ 6 détails par jour sur ce compte (le passage de fond de la
5.341 n'a presque jamais tourné avec ce compte dans l'onglet). Les budgets ne sont pas en cause.

## 2. LA règle (`datesDeVersement`, src/App.jsx → api/_lib/ventes-regle.js par `--recopie`)

Une seule fonction pure, recopiée au jeton près dans le miroir serveur par
`node scripts/audit-bilan-semaine.cjs --recopie` (ajoutée à `NOMS`), appelée par l'app
(`fetchVersementsVinted`) ET par le cron (`versementsDeLignes`, api/_lib/bilan-semaine.js), sur les
mêmes lectures légères projetées (`VERSEMENT_CONV_SELECT`, `VERSEMENT_EMAIL_SELECT`, la même chaîne
dans api/ship-reminders.js). Ordre de confiance, documenté dans le code :

1. **transaction** 450 (`status_updated_at`) ;
2. **relevé** : une ligne qui porte le n° (`tx`), déjà dédoublonnée par src/versementReleve.js ;
3. **conversation** : la ligne légère `harvest_{uid}_versement_{tx}` (`source: 'conversation'`,
   écrite par l'extension 5.376 : n°, date, n° de conversation — jamais un texte, un pseudo, un montant) ;
4. **e-mail** « Transaction finalisée » (`email_final_*`) qui porte `transaction` (sa date de réception).

La première source qui date une vente gagne ; dans une même source, deux jours différents ⇒ « pas su »
pour cette vente. Sans n° de transaction (montant, titre, jour voisin) : ignorée. Transactions
illisibles ⇒ `null` (rien n'est daté sur une lecture ratée). D'où vient chaque date :
`__vrmSources` (non énumérable) ; `sourcesDeVersement` et `venteDatees` (src/versementRaisons.js)
en tirent « dont N par la conversation · N par l'e-mail ». `fusionnerVersements`
(src/versementsConnus.js) perdait ces propriétés à la copie (« dont 1 par ton porte-monnaie »
retombait à 0 après une relecture) : corrigé.

**La date de VENTE n'entre jamais** dans la règle (vendu ≠ reçu, §5 ; « LE CA DÉCLARÉ EST DATÉ AU
JOUR DU VERSEMENT », redemandé par Julien le 3 oct.). Il a cité « le jour de la vente » parmi les
dates disponibles : elle reste la date « Vendu ». **Si Julien veut déclarer une vente au jour de sa
vente quand le versement manque, c'est à lui de le dire** — ce lot ne le fait pas.

## 3. L'extension 5.376.0 (`vinted-sync-extension/background.js`)

- **Passif, aucune requête de plus** : toute conversation captée en passant (`storeHarvest`, type
  `conversation`) qui est une de SES ventes finalisée (côté vendeur, statut 450, UN message système
  « finalisée » daté) range `harvest_{uid}_versement_{tx}` (`versementDeConversation`,
  `rangerVersementConversation`).
- **Repli actif** dans `capterDatesVersement` : le détail reste lu d'abord ; s'il répond 404/410 ou
  sans transaction, la conversation de CETTE vente (`conversation_id` de la liste des ventes) est lue
  à la place — comptée dans les mêmes budgets (15/h argent `vrmVersementLus`, 20/h lecture
  `gardeLecture`, réserve des codes/preuves/relevés), pause 2–5 s, et rangée seulement si elle porte
  **le même n° de transaction**.
- **L'ordre** (`ordreVersements`) : les ventes des 45 derniers jours d'abord (le mois en cours se
  déclare), puis **les plus anciennes d'abord** (l'URSSAF se déclare mois après mois ; le plus vieux
  mois incomplet passe en premier) — la 5.341 lisait la plus récente d'abord.
- Une date déjà rangée depuis la conversation n'est pas relue (lue avec les 450).
- Le relevé : rien à ajouter — pour ce compte, Vinted ne liste aucun mois passé (`history` vide) ;
  `capterReleves` lit déjà les mois listés (le jour où une page en liste, elle passe d'abord).
- Version : `CODE_VERSION`, manifeste, `lbc-inject`/`lbc-relay`, `EXT_ATTENDUE` = 5.376.0 ;
  `EXT_CAPACITES.versementconv = '5.376.0'` (`versementDeConversation`, audit-coherence). **Zips non
  régénérés, `public/extension-version.json` inchangé** (consolidés par l'agent principal).

## 4. L'écran

- **Ma journée → « Contrôle de cette nuit »** (src/VeilleJournee.jsx) : le cron range maintenant avec
  le nombre ce qui l'explique (`detailVersement`, src/controleNuit.js : datées, cause, nombre de
  comptes — jamais un pseudo). Cause unique « détail pas encore lu » ⇒ « **1741** ventes à dater :
  leur date de versement est en cours de lecture · 356 déjà datées ✓ — Vinted ne donne cette date
  qu'en ouvrant chaque vente : l'extension les lit quand vinted.fr est ouvert sur ce compte. D'ici là,
  elles ne sont dans aucun mois ; aucune n'est devinée. Environ 7 jours, Vinted ouvert. [Voir le
  détail] », chiffre **neutre** (`data-ton="info"`, ni ambre ni rouge : rien n'est en faute). Une autre
  cause (Leboncoin à dater à la main…) reste un geste ambre ; une ligne d'avant ce lot garde l'ancienne
  phrase.
- **Argent → Déclarer → « Ce qui manque »** : « 6 datées ✓ dont 1 par ton porte-monnaie · 1 par la
  conversation de la vente · 1 par l'e-mail de Vinted » et, sur la ligne du compte, « Environ N jours
  avec vinted.fr ouvert sur ce compte. » (`joursPourDater`, 288 par jour : l'estimation de la carte
  de l'extension).
- Textes neufs par `tr()` dans les 5 langues (`veille.versement.*`, `compta.dontConversation`,
  `compta.dontEmail`, `compta.environJoursVinted`) ; « Quoi de neuf » : une ligne.

## 5. Preuves

- `scripts/audit-versement-sources.cjs` (nouveau) : **53 verts**. Exécute la règle de l'app (extraite
  du source) ET la copie serveur : chaque source, conflit de dates (transaction > relevé >
  conversation > e-mail), deux jours dans une source ⇒ pas su, source sans identité ignorée, 50 ventes
  au même montant le même jour ⇒ seules celles qui portent leur n°, date de vente jamais, lecture ratée
  ⇒ null ; `venteDatees`, la fusion qui garde les sources, 1 741 ⇒ 7 jours ; le vrai `background.js`
  (`_fond-vm.cjs`) : `versementDeConversation` (achat, 440, sans message, deux jours, sans n° ⇒ rien ;
  rien de personnel rangé), l'ordre, le repli 404 → conversation DANS le budget (≤ 15), GET seulement,
  une conversation d'une autre transaction n'écrit rien ; le contrôle de nuit ; le câblage.
  **Sur origin/main (`VRM_RACINE`) : 19 rouges.** **13 mutations, 13 rouges** (identité retirée, ordre
  inversé, deux jours ⇒ un choix, date de vente acceptée, copie serveur pas refabriquée, achat accepté,
  autre transaction acceptée, conversation hors budget, pas de repli, ordre d'avant, fusion qui perd
  les sources, ton ambre, datées perdues).
- `audit-bilan-semaine` (miroir refabriqué, `datesDeVersement` au jeton près ; check 3 réécrit : l'app
  et le cron appellent la même règle, même projection) : 57 verts. `audit-urssaf`, `audit-coherence`,
  `audit-versement`, `audit-versement-rapide` (ordre mis à jour : 20 verts), `audit-versement-releve`
  et `audit-dates-versement` (câblage relu : verts), `audit-veille`, `audit-traduction`,
  `audit-quoi-de-neuf`, `audit-variables`, `audit-tdz`, `audit-identite`, `audit-budget-lectures`,
  `audit-garde-fous-capture` : verts.
- Bancs de rendu : voir §6.

## 6. Bancs

- `scripts/bancs/veille.cjs` + cas **F** (le contrôle tel que le cron le range) : 1741, cause, ton
  neutre, « 356 déjà datées ✓ », pourquoi, « Environ 7 jours », plus l'ancienne phrase, 44 px.
- `scripts/bancs/dates-versement.cjs` : + une vente datée par sa conversation, une par l'e-mail qui
  porte son n°, 49 e-mails au même montant sans n° et une ligne de conversation sans n° (ne datent
  rien) ⇒ « 6 datées ✓ dont 1 par ton porte-monnaie · 1 par la conversation · 1 par l'e-mail · 46 ventes
  sans date », « Environ 1 jour… ». Le faux PostgREST (`nouveau-vendeur.cjs`) applique maintenant
  `data->>k=not.is.null` comme la vraie base.

## Geste de Julien

Installer l'extension **5.376.0** (quand elle est publiée), puis **ouvrir vinted.fr connecté sur le
grand compte et laisser l'onglet ouvert** : ≈ 7 jours pour les 1 741 (l'extension ne lit que le compte
de l'onglet). Rien d'autre. S'il veut une autre règle que « daté au jour du versement », la dire.
