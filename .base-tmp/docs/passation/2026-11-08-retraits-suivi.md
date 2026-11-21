# 8 nov. — Retraits : le suivi lu sort un colis de « à retirer » en le disant (branche `claude/retraits-suivi`)

Julien (8 nov.) : « Améliore ça pour les colis pour le retrait parce que je vois qu'il y a encore des
erreurs, l'application doit pouvoir lire les informations de suivi afin de pouvoir enlever si
nécessaire. »

Périmètre : les colis ENTRANTS (achats à retirer). Les colis sortants (ventes « à envoyer » passées en
« parti » grâce au suivi) sont le chantier d'un autre agent, en parallèle ; ici `suivisAInterroger` n'est
touché que par trois changements localisés, tous sur les n° entrants. Aucune base réelle accessible
d'ici : tout est mesuré sur le code et sur des données INVENTÉES de la vraie forme. Extension : rien
changé (aucune version montée).

## 1. Les erreurs trouvées (avant de corriger)

| # | où | l'erreur | ce que Julien voyait |
|---|---|---|---|
| E1 | serveur `suivisAInterroger` | un e-mail rangé sous un transporteur **par défaut** (`vinted` = l'expéditeur shipping@relay.vinted.com, `autre` = le filet générique) dont le n° a une forme **propre** à un transporteur lu (8 chiffres = Mondial Relay ; XW/ZW…TS/SP = Chronopost ; VGS… = Vinted Go) n'était **jamais interrogé** (`carrierLisible('vinted', '12345678')` = null) — alors que le même n° saisi à la main ou relevé par Vinted l'était (`transporteurDeFormeT`). | un colis retiré restait « à retirer », sa carte ne disait rien |
| E2 | app `transpParSuivi`, serveur `lireBaseTransp`, cron `rappelsRetraitDuJour` | **deux lignes `transp_` pour un n°** (deux transporteurs essayés : avant le 29 oct. un n° de forme Chronopost lu chez Vinted Go) : l'app gardait la **première** que la base renvoie, le serveur et le cron la **dernière** (ordre PostgREST non garanti). La carte pouvait dire « Vinted Go n'a pas répondu » sous un colis que Chronopost lit ; le cron calculait ses fins sur la seule ligne gardée — un « retiré » sur l'autre ligne n'arrêtait pas « 📍 Dernier jour pour retirer ». | rappel du matin pour un colis déjà retiré ; carte fausse |
| E3 | serveur `suivisAInterroger` | la ligne **abandonnée** d'un AUTRE transporteur (introuvable 3 fois, jamais lue, `fini`) fermait le n° pour tous : le bon transporteur n'était plus jamais interrogé. | colis jamais lu |
| E4 | serveur `suivisAInterroger` | **fenêtre de 30 jours** : un n° déjà lu « disponible / en route / incident / inconnu » dont l'e-mail et l'évènement ont plus de 30 j n'était plus jamais relu (seuls les n° jamais lus ont une lecture de « fermeture »). | « à vérifier » (garde dépassée) pour toujours |
| E5 | app `pickupUnion` → Colis | un colis que le transporteur, l'e-mail ou la commande disent **fini** (`noterFini; continue`) disparaissait de Colis **sans un mot** (§5 « un colis caché est un colis perdu ») ; les repartis ne sont listés que dans Achats. Et une ligne d'e-mail réécrite « retiré » par la route ne passait par aucune boucle. | « il était là, il a disparu » |
| E6 | Colis → À retirer (détail de la carte) | la ligne « ce que dit le transporteur » n'était écrite **que si** une ligne `transp_` existait : transporteur que VRM ne lit pas (Colissimo, DPD, UPS…), n° sans transporteur reconnu, colis international, abandonné (introuvable 3 fois : la carte disait « pas encore enregistré ? ») ⇒ rien, ni pourquoi, ni le geste (§2.7). | aucune explication |
| E7 | widget (`colisEmailDepuis`) | un n° que le transporteur seul dit « disponible » après la photo de l'app est compté « à retirer » **sans regarder ses bordereaux** : dès que les envois sont lus chez le transporteur (le chantier sortant), le colis d'un ACHETEUR au point relais aurait compté dans « à retirer » sur l'iPhone. L'app, elle, l'écartait déjà (`isColisEnAttente` → `sensColis`). | le widget aurait dit un colis de plus |
| E8 | « à vérifier » transporteur | la raison recopiait le libellé du transporteur **sans sa date**. | « Mondial Relay dit … » sans quand |

Cas regardés et laissés : la pause d'un transporteur (le serveur passe la main à l'extension —
`aLireParNavigateur`, dit en tête d'Achats) ; le code postal Mondial Relay manquant (déjà dit :
`cp-inconnu`, `cpCherche`, la tête de liste) ; les colis en double e-mail + Vinted (`regrouperArrivees`,
inchangé) ; l'écart widget / Ma journée / cloche (Ma journée et la cloche lisent `pickupUnion.total`, le
widget relit la publication avec la même règle de fins — aucune autre divergence trouvée).

## 2. Les corrections (une règle, un propriétaire)

- `api/_lib/transporteurs.js` :
  - `carrierLuDeLigne(carrier, n°)` — le transporteur par défaut (`''`, `vinted`, `autre`) cède à la forme
    propre du n° ; un transporteur NOMMÉ non lu (Colissimo, DPD…) ne se remplace jamais. Utilisé par
    `suivisAInterroger` (E1) et par l'app (`LigneTransporteur`, `pourquoiPasLu`).
  - `ligneTranspPreferee` / `indexTranspParSuivi` — une lecture réussie l'emporte ; entre deux, la plus
    récente ; sans lecture, le dernier essai (E2). Le serveur (`lireBaseTransp`), le cron
    (`rappelsRetraitDuJour`, qui calcule désormais ses fins sur TOUTES les lignes) et l'app
    (`transpParSuivi`) lisent la même.
  - dans `suivisAInterroger` : la ligne abandonnée et jamais lue d'un autre transporteur est ignorée (E3) ;
    `relireApresFenetre` — UNE lecture de « fermeture » pour un n° lu non fini dont la dernière lecture
    date d'avant la fin de sa fenêtre, au plus `FERMETURE_ESSAIS_MAX` essais ratés (E4).
- `src/retraitSuivi.js` (nouveau, pur) : `finDatee` (la fin d'un colis par ses n°, depuis les mêmes lignes
  que la règle : la lecture du transporteur, sinon l'e-mail ; un « retiré » gagne sur un « retour »),
  `texteSortie` (« Mondial Relay : retiré le 5 nov. », « E-mail de Chronopost : retiré le 5 nov. »,
  « Vinted : commande finalisée », « — par le n° de suivi de sa commande »), `sortiRecent` (3 jours ; sans
  date, une arrivée de moins de 10 jours), `pourquoiPasLu` (sans n°, international, transporteur non lu,
  inconnu, pas encore lu, abandonné, expiré — chacun avec son geste).
- `src/App.jsx` :
  - `pickupUnion` : chaque sortie prouvée (n° propre, autre identité, commande, achat Vinted, ligne d'e-mail
    réécrite « retiré ») est NOTÉE (`sortis`) avec sa raison — la décision ne change pas, le total non plus ;
    jamais « sorti » un colis encore montré ailleurs (à retirer, à vérifier, en double) (E5) ;
  - Colis → À retirer : section repliée « Sortis de « à retirer » · N · 3 derniers jours », une phrase,
    puis chaque colis (titre, la raison lue, son n°), hors compte (E5) ;
  - le détail d'une carte : `RaisonPasLu` quand le transporteur n'a jamais répondu ou a été abandonné,
    sinon la ligne du transporteur comme avant (E6) ;
  - aucune ligne synthétique « à retirer » pour un n° de ses bordereaux (déjà écarté plus loin par
    `isColisEnAttente` : défense en profondeur) ; `raisonAVerifier` date l'évènement du transporteur (E8).
- `api/widget.js` : `colisEmailDepuis` reçoit les n° de ses bordereaux (`bordRows`, déjà lus) ; un n° de
  bordereau n'est jamais compté ; bordereaux pas lus ⇒ « au moins », jamais un nombre deviné (E7).

## 3. Ce que Julien verra

- Colis → À retirer : sous les points, « Sortis de « à retirer » » (replié, avec le nombre) : « Colis
  n°…0001 — Mondial Relay : retiré le 5 nov. · n° 82000001 ».
- En ouvrant une carte jamais lue : « Colissimo : VRM ne lit pas ce transporteur — Regarde ses e-mails ou
  le site de Colissimo. », « Mondial Relay : pas encore lu — VRM le lit tant que l'app est ouverte »,
  « Chronopost ne trouve pas ce n° (3 essais) : VRM ne le relit plus — Regarde sur le site du
  transporteur. ».
- Les colis dont l'e-mail venait de Vinted avec un n° Mondial Relay / Chronopost sont maintenant lus chez
  le transporteur (ils sortent seuls de « à retirer » une fois retirés).

## 4. Preuves (§6)

- `scripts/bancs/retraits-suivi.cjs` (R1-R9, 390 tactile clair/sombre + 1512) : **39 verts**.
  Arbre d'avant (`git archive origin/main`, banc copié dedans, lancé depuis lui) : **24 rouges** (R1, R2,
  R3, la section, R5, R6, R7, R8 sur chaque vue ; R4 et R9 verts : l'app écartait déjà ses bordereaux).
  Mutations de l'app (build + banc dans une copie) : A « première ligne gagne + sortie par le n° propre
  non notée » ⇒ 3 rouges ; B « pourquoi pas lu jamais rendu + e-mail réécrit non noté » ⇒ 5 rouges ;
  C « sortie d'un achat Vinted non notée » ⇒ 2 rouges.
- `scripts/audit-retraits-suivi.cjs` (A1-A7, B1-B2, C1, D1-D7, exécute les vraies règles) : vert ;
  `--prouve` **10/10** mutations rouges.
- `audit-statut-transporteurs` §8 : le widget exécuté (fausse base PostgREST) — un n° de ses bordereaux
  « disponible » n'est pas compté (1 sans le bordereau, 0 avec) ; **rouge sur l'arbre d'avant**
  (`envoi=1`) ; mutation `widget-bordereau-compte` attrapée.
- Captures regardées : 390 clair/sombre (section des sortis, détail R6, détail R8), 1512.
- Audits verts : build, `audit-identite`, `audit-statuts`, `audit-coherence`, `audit-retrait-preuves`,
  `audit-retrait-fiable`, `audit-suivi-colis`, `audit-transporteur-lu`, `audit-transporteurs`,
  `audit-statut-transporteurs`, `audit-fonctions-api`, `audit-colis-trois`, `audit-codes-retrait`,
  `audit-tdz`, `audit-transp-notif`, `audit-mondialrelay-serveur` (sa sonde de `LigneTransporteur` reçoit
  `carrierLuDeLigne`), `audit-retrait`, `audit-achat-attend-relais`, `audit-sms-colis`,
  `audit-colis-prochain`, `audit-icones`.
- Bancs voisins : voir le rapport de la session (lancés un par un sur le build final).

## 5. Ce qui reste impossible (et pourquoi)

- **Colissimo, DPD, UPS, Relais Colis, GLS** : VRM ne lit pas leur suivi (aucune voie mesurée) — la carte le
  dit et donne le geste ; rien n'est deviné.
- **Un colis international (S10 d'un autre pays)** : pas de transporteur lisible — dit tel quel.
- **Un n° abandonné (introuvable 3 fois)** reste abandonné : la carte le dit ; une nouvelle lecture ne se
  fait que si l'identité change (code postal Mondial Relay appris, autre transporteur).
- **Une pause de transporteur** (refus du serveur) sans extension à jour sur l'ordinateur : rien n'est lu
  jusqu'à la levée — la tête d'Achats le dit (inchangé).
- **La forme réelle** d'un retour Mondial Relay et d'un `return_*` Vinted Go autre que ceux relevés : jamais
  vue (inchangé depuis le 29 oct.).
- Rien n'a été mesuré sur sa base (pas d'accès d'ici) : les cas sont ceux du code et des historiques.

## Geste de Julien

Aucun. Ouvrir Colis → À retirer : un colis sorti est sous « Sortis de « à retirer » » avec la raison.
