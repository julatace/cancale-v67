# 17 nov. — Un colis, deux transporteurs : une ligne (lot `suivi-multi-transporteurs`, extension 5.403.0)

## Le cas de Julien (captures du 17 nov.)

Au point relais (un tabac), il a UN colis arrivé ; VRM en montrait DEUX :
1. « Colis Chronopost Pickup », code de retrait, n° de suivi Chronopost, non relié ;
2. l'achat Vinted (un de ses comptes) en « À vérifier · Code sur Vinted · Incident ».

Mesuré en lecture seule (aucune valeur recopiée ici) : la ligne de suivi Vinted de l'achat
(`harvest_{uid}_suivi_{tx}`, écrite par l'extension) avait `suivi` = le n° de la PREMIÈRE étape
(« Shop2Shop by Chronopost », transporteur international), alors que la FORME rangée montre
`journey_summary.carriers[].tracking_code` (avec `code`, `is_current`), `current_carrier.tracking_code`
et `details[].carrier.tracking_code`. Le suivi Chronopost (`transp_chronopost_{n°}`) dit « Colis entré
dans le pays de destination ». Envoi international à deux transporteurs ⇒ deux n° pour LE MÊME colis ;
VRM ne gardait que le premier ⇒ aucune identité commune ⇒ deux lignes.

## Ce qui change

### 1. Extension 5.403.0 — tous les n° (la voie principale)
`numerosDuTrajet` (background.js, hors du bloc `<suivi-regle>`) lit, sous toute clé qui dit un
transporteur (`carriers[]`, `current_carrier`, `carrier`), le n° (`suiviNumero`), le code transporteur
(forme machine) et `is_current` — jamais une autre valeur. Rangés dans la ligne de suivi en SCALAIRES
(recopiés dans `meta`) : `suivisVinted` (« N1,N2 », union — un n° lu n'est jamais perdu, 8 au plus),
`transporteursVinted`, `suiviCourant`, `suivisLusAt` (une réponse `journey_summary` reconnue = la liste
LUE). `suivi` reste (compatibilité). Voies active (`capterSuivisAchats`) et passive (`noterSuiviPage`).
Une forme inconnue n'écrit rien (inchangé).

**Relecture prioritaire** (demande du coordinateur, « il ne doit pas y avoir d'erreur possible ») :
une ligne rangée AVANT la 5.403 (sans `suivisLusAt`), d'un achat expédié pas livré, est relue EN PREMIER
à la visite suivante sur vinted.fr (`listeARelire`, rang 0 au point relais, 1 en route), même si elle a
déjà son n° et son arrivée — dans les MÊMES bornes (3 par visite, 6/h, budget « suivi », une requête à la
fois, mémo de 3 h). Une fois la liste lue, l'achat arrivé n'est plus relu pour elle.

### 2. App + serveur — la jonction par TOUS les n° (identité exacte)
- `src/liensColis.js` (`suivisAchat`) : + `suivisV` de l'entrée d'index ⇒ `achatDuColis`,
  `commandeDuColisRegle`, « À retirer », Ma journée, QR, widget relient le colis du transporteur à son
  achat par n'importe lequel de ses n°. Deux achats au même n° ⇒ personne (inchangé).
- `App.jsx` lit `meta->>suivisVinted, transporteursVinted, suivisLusAt` (scalaires).
- Serveur : `liensDesLignes` (api/_lib/suivi-colis.js) lit `sv`/`sl` — rappels de retrait, nom de la
  paire dans les notifications, e-mails entrants. Règle commune : `api/_lib/suivis-multiples.js`.
- « Un colis, une ligne » : un achat Vinted déjà montré par le colis de SON transporteur (relié par
  identité) n'est plus remis en « à vérifier » par l'incident d'un AUTRE n° du trajet, et la ligne du
  transporteur ne devient pas « à vérifier » à cause de l'étape d'un autre transporteur du même trajet
  (son propre n° est jugé par son propre transporteur). ⇒ l'incident « Code sur Vinted » disparaît :
  le code et le QR viennent du colis Chronopost.

### 3. En attendant la liste — une PROPOSITION, jamais une liaison (`src/memeColis.js`)
Seulement si la liste des n° de l'achat n'a JAMAIS été lue (`listeLue` faux) et que TOUT est vrai :
au même point (nom + code postal, `cleLieuDoute`) exactement UN colis du transporteur non relié et
exactement UN achat Vinted non relié sans code ; même GROUPE de transporteur (Chronopost/Shop2Shop/Pickup ;
Mondial Relay/InPost ; Vinted Go ; Relais Colis ; La Poste ; DPD ; UPS ; DHL ; GLS — inconnu ⇒ rien) ;
colis arrivé APRÈS la date d'achat (la date d'expédition n'est pas lue sur cet écran : la date d'achat
est la borne sûre) ; AUCUN autre achat en route vers ce point (ni vers un point inconnu du même groupe ou
d'un groupe inconnu) ; pas de « Ce n'est pas le même » pour ce colis et cet achat.
La ligne du colis dit « C'est sans doute le même colis que « {article} ». Relier · Ce n'est pas le même ».
SON toucher range le lien comme les autres liens manuels (`colis_suivi_{transporteur}_{n°}` + tx/uid,
`relieDepuis: 'proposition'`) ; « Ce n'est pas le même » est gardé dans `vrm_colis_pas_meme` (synchronisé).

### 4. La liste lue TRANCHE — un lien manuel contredit est DIT
Quand la liste d'un achat est lue et qu'un lien posé à la main (`colis_suivi_*` portant `tx`) porte un n°
qu'elle n'a pas, ce lien ne relie plus rien (app et serveur) et la ligne du colis dit « Ce lien ne
correspond pas au suivi Vinted — délier ? » avec « Délier » (efface la ligne `colis_suivi_*`, sur son
clic). Liste pas lue ⇒ rien n'est contredit (pas su).

## Preuves
- `scripts/audit-suivi-multi-transporteurs.cjs` (EXÉCUTE le vrai background.js, `_fond-vm`) : 16 verts ;
  sur le background.js de `main` (`--src`) 10 rouges ; mutations `liste` (2 rouges), `relire` (2),
  `union` (1).
- `scripts/audit-suivi-vinted.cjs` : vert (deux attentes mises à jour : la clé `suivisLusAt` du contrat ;
  la ligne « arrivée avec son n° » du cas c porte `suivisLusAt`, sinon elle est relue une fois pour sa liste).
- `scripts/audit-meme-colis.cjs` : 25 verts (jonction app + serveur, chaque condition de la proposition,
  deux candidats ⇒ rien, lien contredit app + serveur).
- Banc `scripts/bancs/retirer-multi-transporteurs.cjs` : 67 verts (390 tactile et 1512, clair et sombre) —
  avec la liste ⇒ 1 ligne au nom de l'article, code et QR, aucune « Code sur Vinted » ; sans la liste ⇒ 2
  lignes + la proposition, aucune écriture avant le toucher, 1 ligne après ; deux achats ⇒ aucune
  proposition ; « pas le même » ; lien contredit + « Délier ». Captures regardées.
  **Rouge sur le build de `main`** : 28 rouges — exactement le cas de Julien (« Colis Chronopost Pickup » +
  « Baskets… » à vérifier, « Code sur Vinted »). **Mutation « relier sans son toucher »** (la proposition
  relie au rendu, build à part) : rouge (« rien n'est relié avant SON toucher », deux lignes attendues).
  « Proposer avec deux candidats » : rouge par mutation de `src/memeColis.js` dans `audit-meme-colis`.
- `audit-coherence`, `audit-extension-zip`, `audit-traduction`, `audit-relier-colis`, `audit-quoi-de-neuf`,
  `audit-icones`, `audit-fonctions-api` : verts.

## Gestes de Julien
Installer l'extension **5.403.0** (remplacer le dossier, ⟳ dans chaque Chrome ; Orion : `VRM-Orion-dossier.zip`),
puis ouvrir vinted.fr sur le compte de l'achat : la ligne de suivi reçoit son 2e n° à la visite suivante et
le colis Chronopost devient l'achat. D'ici là, la proposition « Relier » peut le faire d'un toucher.
