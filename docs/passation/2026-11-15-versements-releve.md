# Dates de versement : le relevé du porte-monnaie, vérifié avant de dater — extension 5.378.0 (15 nov. 2026)

Branche `claude/versements-releve`, partie de `origin/claude/project-review-nsk5su`. Aucune PR ouverte.
Demande : « Améliore tout, même l'extension pour capter les données » — le trou : « + 1 741 ventes
à dater » (ventes dans AUCUN mois du CA déclaré, §5 « le CA déclaré est daté au jour du versement »).

## Pour Julien, en mots simples

- **Le délai affiché est maintenant juste.** Avant : « environ 7 jours, Vinted ouvert » — ce calcul
  supposait vinted.fr ouvert 24 h sur 24 sur ce compte. Maintenant : « environ 146 h avec vinted.fr
  ouvert sur ce compte » (Argent → Déclarer, Ma journée, la carte du logo VRM sur vinted.fr). C'est
  le temps d'onglet ouvert qui fait avancer la lecture : 12 ventes par heure environ.
- **Le relevé du porte-monnaie ne date plus rien sans preuve.** Une vente n'est datée par le relevé
  que si, sur ce compte, au moins 5 ventes ont la même date dans le relevé ET dans le détail de la
  vente, sans aucun désaccord. Sinon l'écran le dit (« dates du relevé pas encore vérifiées ») et
  rien n'est deviné.
- **Lire le relevé mois par mois** (une lecture = tout un mois) : l'extension apprend l'adresse de
  la page quand TU ouvres une fois « Porte-monnaie → Historique → un mois passé » sur vinted.fr. Elle
  n'invente plus d'adresse (l'ancienne, devinée, répondait « introuvable » sur tous tes comptes).
  ⚠️ Mesuré : sur ton grand compte, Vinted ne liste **aucun** mois passé dans le porte-monnaie —
  cette voie ne l'aidera pas tant que Vinted n'en liste pas ; ses dates arrivent vente par vente.

**Ton geste** : installer l'extension **5.378.0** (remplacer le dossier, ⟳ dans CHAQUE Chrome ;
Orion : `VRM-Orion-dossier.zip`), puis **laisser vinted.fr ouvert sur le compte qui a les ventes à
dater** (le grand compte, `199082413` : 1 741 ventes) — c'est ce temps-là qui compte. Une fois,
sur chaque compte : Porte-monnaie → Historique → toucher un mois passé (s'il y en a).

## Ce qui a été MESURÉ (base de prod, lecture seule, 15 nov.)

- Chemins vus (`harvest_*_seen_urls.paths`, tous comptes) côté porte-monnaie : `wallet/invoices/current`
  (200), `wallet/income_reports/settings`, `users/{id}/payouts` (**404**, ou 401), `users/{id}/payouts/{id}`,
  `users/{id}/payouts/new`, `payments/public/api/payouts/{id|new}`. **Aucune adresse de relevé d'un
  mois passé n'a jamais été vue.** Les `wreq_*` ne sont que des écritures (POST/PUT) : rien d'utile ici.
- Relevé courant (`harvest_{uid}_billing.payload`) : `history` = `[]` sur 199082413, 221546061,
  3175765377, 3203327925 (le seul `history` non vide : 3170782324, `[{year:2026, month:7}]`, août).
  `invoice_lines` vide en novembre partout.
- La seule ligne de relevé jamais vue est un VIREMENT (`entity_type: "payout"`, `title`, `subtitle`
  = bout d'IBAN). **La forme d'une ligne de VENTE n'a jamais été vue** : on ne sait pas encore si
  elle porte `transaction_id` ou `entity_type: "transaction"` + `entity_id`.
- `harvest_*_txn_*` : 199082413 = 69 détails (48 finalisés, juin–juillet 2026) ; 221546061 = 10 ;
  16652001 = 7. Aucune ligne `harvest_*_versement_*` (la voie « conversation », 5.376, n'est installée
  nulle part : appareils vus en 5.329, 5.336, 5.368).
- `my_orders[].date` n'est PAS la date de finalisation (vente le 6 juin, finalisée le 30 juin) : pas
  une source.
- **Sur 469 ventes finalisées dont on a les deux dates, aucune n'a été finalisée le jour de sa vente**
  (0 / 469, 10,3 jours d'écart en moyenne). C'est ce qui justifie N = 5 (plus bas).

⇒ La voie « relevé mois par mois » demandée **n'est pas prouvable aujourd'hui** : adresse jamais vue,
forme d'une ligne de vente jamais vue, et le grand compte ne liste aucun mois. On n'a rien forcé :
la voie est construite SANS rien deviner (recette apprise, identité seule, vérification avant de dater)
et elle se taira tant que les preuves ne sont pas là. À côté, l'amélioration sûre et utile tout de
suite : l'estimation honnête, et la vérification du relevé (qui protège aussi la voie existante, 5.323,
qui datait par le relevé SANS comparaison).

## Ce qui est construit

### 1. La règle pure — `src/versementReleve.js` (une règle, un propriétaire)
- `verifierReleve(releveRows, txn)` : par compte (uid de la ligne `harvest_{uid}_releve_{mois}`),
  compare chaque vente du relevé (par SON n°, `tx`) qui a AUSSI un détail 450 : même jour **heure de
  Paris** (`jourParis`, Intl `Europe/Paris`) ⇒ accord, sinon désaccord. État : `verifie` (≥ 5 accords,
  0 désaccord) · `a-verifier` · `desaccord` · `sans-recouvrement`. Lecture ratée ⇒ `null`.
- `versementsDuReleveVerifies(releveRows, txn)` : la carte tx → date du relevé, **seulement des
  comptes vérifiés** ; le verdict suit la carte (non énumérable, `verifReleve`, `porterVerifReleve`).
- `relevesNonVerifies(carte, nomDe)` : ce que l'écran dit.
- **N = 5 (`RELEVE_ACCORDS_MIN`)** : l'erreur à attraper est une AUTRE NOTION (date de paiement,
  d'envoi…), donc systématique ; comme aucune vente n'est finalisée le jour de son paiement (0/469),
  elle se trahit sur chaque vente comparée. 5 accords d'affilée par hasard sont impossibles en
  pratique, et UN désaccord ferme le compte. Plus haut (30, 50), les petits comptes (7 à 10 détails)
  ne seraient jamais vérifiés.
- Branchée dans LA règle du CA déclaré : `fetchVersementsVinted` (App.jsx) et `versementsDeLignes`
  (api/_lib/bilan-semaine.js) — le MÊME module importé des deux côtés (pas de recopie à la main ;
  `datesDeVersement`, la copie refabriquée `api/_lib/ventes-regle.js`, n'a pas changé). Ordre
  inchangé : transaction 450 > relevé (vérifié) > conversation > e-mail ; **la 450 gagne toujours**.

### 2. L'écran
- Ventes publie `vinted_urssaf_mois.aDater.releve` (comptes au relevé pas vérifié) ; Argent →
  Déclarer ajoute la ligne `data-adater-raison="releve-non-verifie"` : « 5 ventes dans le relevé du
  porte-monnaie : dates du relevé pas encore vérifiées (4 sur 5 accords avec le détail des ventes).
  Rien n'en est daté d'ici là. » (ou « désaccord… le relevé de ce compte ne date rien »).
- Délai : `heuresPourDater` (src/versementRaisons.js, 12 par heure) remplace `joursPourDater`
  (288 par jour) dans Déclarer (`compta.environHeuresVinted`) et Ma journée (`veille.versement.heures`).
- « + 1 741 ventes à dater » baisse dès qu'une vente est datée par n'importe quelle source (rien
  à changer : c'est la même règle `ventesDeclarables`).
- Textes : `tr()`, 5 langues ; ligne « Quoi de neuf » `versements-releve-verifie`.

### 3. L'extension 5.378.0 (capacité `relevemois` → `apprendreRecetteReleve`)
- **Plus aucune adresse devinée** : `capterReleves` n'appelle plus `users/{pid}/payouts?year=&month=`
  (404 partout). `vrmReleveMuet` retiré.
- **Recette apprise** (`recetteReleveDe`, `apprendreRecetteReleve`) : une réponse de relevé captée EN
  PASSANT (compte de l'onglet, `storeHarvest`) dont le mois (`starting_date`) apparaît dans l'adresse —
  l'année ET le mois, une fois chacun, chemin `/api/v2/wallet/…` ou `…invoice…` — donne le modèle
  `{Y}`/`{M}`/`{MM}` (« 11 » ne dit pas si « 7 » s'écrit « 07 » : ces mois-là attendent). Un modèle
  qui porte un autre identifiant ne sert qu'à SON compte. Rangé dans `chrome.storage.local`
  (`vrmReleveRecette`), jamais en base.
- **Les mois que Vinted liste** (`history`) : notés à chaque relevé capté (union, `vrmReleveMois`) ;
  lus du plus récent au plus ancien, 2 par visite, et aussi au passage de fond (`tickVersements`,
  onglet vinted.fr ouvert) avant les détails (un mois date toute une série).
- Garde-fous inchangés : `gardeLecture(uid, acc, 'argent')` (compte de l'onglet, budget de LECTURE
  20/h, prudence, anti-robot, pause), `vintedGet` → `requeteVinted` (une à la fois), pause 2–5 s
  entre deux mois, 429/403 ⇒ pause et arrêt (`memoApresEchec`). Mois rendu ≠ demandé, ou forme
  inconnue ⇒ rien écrit, forme dans `harvest_{uid}_forme_releve`, **recette oubliée**.
- Rien de personnel : chaque ligne passe par `ligneReleve` (liste blanche : id, date, montant,
  devise, sens, nature, ref, `tx` seulement si la ligne PORTE le n° de transaction). Jamais `main`.
- Carte du logo : « Dates de versement en cours de lecture · N restantes · environ X h avec Vinted
  ouvert sur ce compte » (`datesPourCarte.heures`), et « Relevé du porte-monnaie : N mois à lire ·
  ouvre une fois Porte-monnaie → Historique → un mois passé » quand Vinted liste des mois sans recette.
- Version : `CODE_VERSION`, manifeste, `EXT_ATTENDUE`, transports Leboncoin (`CAPTEUR_VERSION`,
  `relaisVersion`), `public/extension-version.json`, zips Chrome + Orion régénérés une fois.
  ⚠️ Le tableau §8 de CLAUDE.md n'est pas touché (fait par la session parente).

## Preuves (§6)

| contrôle | sur ce code | code d'avant (`git archive a524255f`) | mutations |
|---|---|---|---|
| `audit-releve-mois.cjs` (vrai background.js, `_fond-vm`) | 25 ✅ | 16 ❌ (dont « sans recette : aucune requête » : l'ancien code appelle `users/3166000/payouts?year=2026&month=9`) | 9/9 mordent (garde du compte, mois rendu, identité, liste blanche, forme, année, plafond, ordre, fond) |
| `audit-releve-verif.cjs` (règle pure + serveur) | 22 ✅ | 13 ❌ (dont, sans les nouvelles fonctions : le serveur datait la vente par un relevé à 4 accords) | 5/5 mordent (seuil, désaccord, jour UTC, comptes non filtrés, détails illisibles) |
| `audit-releve.cjs` (section 3 réécrite : recette, plus d'adresse devinée) | 30 ✅ | — | — |
| `audit-versement-sources`, `-releve`, `-rapide`, `dates-versement`, `bilan-semaine` (mis à la nouvelle règle) | ✅ | | |
| `coherence`, `extension-zip`, `urssaf`, `identite`, `traduction`, `tdz`, `variables`, `fonctions-api`, `quoi-de-neuf`, `extension-navigateurs`, `paquets-boutiques` | ✅ | | |
| bancs `dates-versement` (60 ✅, + variante « 4 accords » : non daté, dit), `badge` (144 ✅), `extension-visuel` (63 ✅), `veille` (62 ✅), `argent` (268 ✅), `studio-journee` (vert) | ✅ | | |
| balayage des 630 `audit-*.cjs` | 45 rouges, TOUS rouges aussi sur le code d'avant (`git archive a524255f`) ; `versement-sources` une fois rouge en balayage (horodatage), vert relancé | | |

Captures regardées : carte « Déclarer » 390/1512 clair/sombre (« Environ 4 h avec vinted.fr ouvert
sur ce compte »), variante 4 accords (ligne « dates du relevé pas encore vérifiées (4 sur 5 accords) »),
carte du logo 390 (les deux lignes).

## Ce qui reste à vérifier EN VRAI (sur son navigateur)

1. Ouvrir Porte-monnaie → Historique sur un compte qui liste des mois (3170782324 en listait un) :
   l'adresse appelée porte-t-elle l'année et le mois ? Si oui, `vrmReleveRecette` se remplit (Diag :
   `releve_recette_apprise`) et le passage suivant lit les autres mois listés.
2. La forme d'une ligne de VENTE du relevé : `harvest_{uid}_releve_{mois}.formeLignes` et `nTx` le
   diront à la première capture. `nTx = 0` avec des crédits ⇒ la ligne de vente ne porte pas le n°
   de transaction : alors le relevé ne datera jamais rien (identité seule), et c'est voulu.
3. Le verdict (`aDater.releve` dans `vinted_urssaf_mois`) dès qu'un relevé porte des `tx` : il faut
   des ventes qui ont AUSSI leur détail 450 (les plus récentes en ont).
4. Le grand compte : `history` vide ⇒ seule la lecture vente par vente avance (≈ 12/h, onglet ouvert).
