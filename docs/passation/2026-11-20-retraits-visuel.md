# 20 nov. — Colis à retirer beaucoup plus visuel (branche `claude/retraits-visuel`)

Julien : « Colis à retirer beaucoup plus visuel, c'est pas exceptionnel, tu peux encore faire. »

## Ce qui est livré
- **Une carte par point** (`src/natif/RetraitsPoints.jsx`, `src/natif/retraits.css`) : sorte (consigne / comptoir),
  transporteur, adresse + Itinéraire, horaires LUS, compte à rebours d'une limite LUE, bande résumé et plan des points,
  « Rien à retirer » illustré. Règles de vue pures : `src/retraitsVue.js`.
- **Le contenu d'abord, en grand** (Julien : « même quand c'est à retirer, on doit voir ce qu'il y a à l'intérieur ») :
  photo 72 px (88 à l'ordinateur) et titre de l'achat relié PAR IDENTITÉ (`x.contenu`, `contenuDuColis`), taille,
  prix payé, compte, « Lot · N articles » quand SA transaction en compte plusieurs (une seule photo est lue : jamais
  d'autre vignette inventée). Pas relié ⇒ vignette grise + « Contenu pas encore lu · ouvre vinted.fr sur {compte} »,
  jamais « Colis Mondial Relay » en titre (le titre de l'e-mail de CE colis, s'il en a un, reste).
- **La barre du trajet** (`src/retraitTrajet.js`) : Payé · Expédié · En transit · Au point · Retiré. Chaque étape est
  allumée par SA date lue, sinon grise et sans date — jamais déduite d'une étape plus loin. Sources : date de la
  commande reliée ; évènements du transporteur de SON n° (`transp_*`, `data.evenements`, classés par les tables
  mesurées `CP_CODES` / `VG_GROUPES` / `classeMr`) ; e-mails « en route » du même n° ; arrivée prouvée. Les évènements
  sont lus par une lecture BORNÉE (`id=in.(…)` ≤ 60 lignes, `select=id,ev:data->evenements`) des seuls colis montrés.
- **Le QR à droite du code** : 124 px au téléphone, 168 px à l'ordinateur, fond blanc, toucher = plein écran (`openQrView`,
  comme avant). Jamais fabriqué. Le code ne se coupe plus en deux (taille selon la largeur).
- **Toutes les plateformes** (Julien : « les mêmes dispositions sur toutes les plateformes ») : un colis d'un achat
  Leboncoin ou Vestiaire (relié par SON n° de suivi, `achatsAutres`) a la même carte : photo et titre de SON achat, le
  site dit, trajet, code, QR, rétention ; le filtre de site d'Achats garde la même mise en page. Corrigé en passant : un
  colis Leboncoin/Vestiaire « à vérifier » était rangé « vinted » et disparaissait sous le filtre de son site.
- **« Je suis au point » retiré** (Julien, 20 nov. : « je ne veux plus de Je suis au point ») : ni bouton, ni plein
  écran, textes retirés des 5 langues. « J'ai retiré » reste dans « Tout le détail des retraits ».

## Rétention (demande 2) — ce qui a été trouvé et corrigé
- `pickupUnion` ne jetait PAS un colis à sa date limite : il passe « à vérifier » (`estAVerifier` ⇒ `aVerifier.push`).
  Mais **la carte par point le cachait** (`aPresenter` écartait tout « à vérifier ») : à la date limite, le code et le QR
  disparaissaient de l'écran. Corrigé : `colisDuPoint` (src/retraitsVue.js) garde dans la carte tout « à vérifier » qui
  a encore un code ou un QR, avec « Date limite dépassée · à vérifier », hors du compte. Un « à vérifier » sans code ni
  QR reste dans le détail (décision du 14 nov. : pas de colis sans code dans « à retirer »).
- **La copie des codes (hors ligne, `vrm_codes_hors_ligne`)** gardait les e-mails « à vérifier » mais PAS les achats
  Vinted « à vérifier » : un achat vu seulement par Vinted perdait son code à la limite. Corrigé (`listeCodesRetrait`,
  `compte: false`).
- Les fins qui sortent un colis restent celles d'avant, toutes PAR IDENTITÉ : retiré (transporteur, e-mail, coche),
  reparti (« retour expéditeur », « non réclamé »), commande annulée / remboursée (`finDeCommandeAchat`).

## Preuves
- `node scripts/audit-retraits-visuel.cjs` (rétention, trajet) et `--mutation` : 11/11 (masquer à la limite dans la vue,
  la carte, `pickupUnion`, la copie des codes ; étape devinée ; évènement non mesuré ; courante pas la plus loin).
- Banc `scripts/bancs/retraits-visuel.cjs` : **215 verts, 0 rouge** — 390 tactile clair/sombre, Safari 390×664,
  1512 clair/sombre, 1280, base vide ; 15 colis + dépassé (code + QR) + retourné + annulé + 50 achats au même titre
  (aucune photo de leurre) ; acheteur QUE Leboncoin et QUE Vestiaire (390 et 1512). `CAS=sites` pour ces deux-là seuls.
  La photo d'un achat Leboncoin est jugée par identité (`data-rp-photo-src`) : l'image de img.leboncoin.fr ne se charge
  pas dans le banc (celle de Vestiaire oui), l'app la montre comme les autres.
- `retraits-parfaits` 17 verts (il jugeait l'échafaudage d'avant : `vrm_banc_dom_ancien` retiré), `colis-achat-auto`
  121 verts, audits `retraits-parfaits`, `quoi-de-neuf`, `traduction`, `coherence` verts.

## Geste de Julien
Aucun.
