# 11 nov. — Le mini-résumé du mois dans la carte du logo (lot extension-resume) — extension 5.354.0

Branche `claude/extension-resume`, partie de `claude/extension-visuel` (5.351), refusionnée avec
`origin/main` (vrai `git merge`). Version 5.354.0 (5.352–5.353 réservées à d'autres lots).
**Aucune PR, aucun merge dans `main`** (consigne du lot). Aucune requête Vinted de plus, aucune
écriture en base réelle (tout est joué sur des bancs).

## Ce que Julien voit

Sur vinted.fr, leboncoin.fr et Vestiaire, connecté à VRM, la carte du logo porte une ligne
discrète, **repliée** : « Ce mois dans VRM ». Ouverte :

> Ce mois : **1 340 €** vendus · **42** ventes · **3** à expédier
> Chiffres de VRM, publiés il y a 2 h.
> Voir dans VRM · Masquer ce résumé

- Elle se place sous « Ouvrir VRM » et les trois raccourcis, au-dessus de « Détails ».
- « Voir dans VRM » ouvre VRM sur Ma journée (l'écran `journee` de la liste blanche
  `ECRANS_CARTE`, 5.351).
- « Masquer ce résumé » : la ligne disparaît (réglage de CE navigateur, `vrmResumeMasque`) ;
  « Afficher le résumé du mois » attend dans « Détails ».
- Aucune couleur sur les chiffres (§7 : rien à rattraper ici).
- Chaque segment est insécable : la ligne se coupe aux « · », jamais « 3 à / expédier ».

## D'où viennent les chiffres (§5 : un propriétaire par règle, l'extension ne recalcule RIEN)

| chiffre | source | qui le calcule |
|---|---|---|
| vendus ce mois | `widget_stats.caMois` | la coque de l'app (le même que le widget iPhone) |
| « au moins » | `widget_stats.caMoisNonComptees > 0` | idem |
| ventes ce mois | `widget_stats.ventesMois` | idem |
| à expédier | `widget_stats.aExpedier` = `{ n, auMoins, at }` | **nouveau** : l'app y RECOPIE le badge de Colis (`vrm_colis_aposter`) |

⚠️ Mesuré dans le code avant de coder : `vrm_colis_aposter` n'est publié **que sur l'appareil**
(pas dans `SYNC_KEYS`, aucune ligne en base) — l'extension ne pouvait pas le lire. Plutôt que de
recompter les colis dans l'extension (interdit) ou d'ajouter une ligne, l'app ajoute un champ à la
ligne qu'elle publie déjà pour le widget : `aExpedierPourCarte(load('vrm_colis_aposter'))`
(`src/resumeCarte.js`), avec la fraîcheur du badge (12 h, `publicationColisFraiche`) — trop vieux
ou absent ⇒ `n: null`. Un site illisible (eBay, Leboncoin ou Vestiaire à `null`) ⇒ `auMoins`.
L'effet qui écrit `widget_stats` relit la publication (`colisCarte`, posé avant lui, §4.6) ; au
plus une écriture de plus par heure (la publication se rafraîchit toutes les heures).

Limite dite : `widget_stats` n'est réécrit que quand le « vendu » est COMPLET (règle d'avant,
inchangée). Pendant une lecture partielle, `aExpedier` vieillit donc avec le reste ; passé 12 h
la carte dit « — à expédier · colis : ouvre VRM pour les recompter », jamais un vieux nombre
présenté frais.

## Ce que fait le service worker (`moisPourCarte`, `resumeMoisCarte`, `ongletDuVendeur`)

- **Une** requête PROJETÉE (§4.4, jamais `select=data`) :
  `app_data?id=in.(widget_stats,lbc_accounts,vc_session)&select=id,ca:data->caMois,nv:data->ventesMois,nc:data->caMoisNonComptees,ae:data->aExpedier,maj:data->>updatedAt,la:data->accounts,vcc:data->comptes`,
  filtrée sur le compte VRM de la session (`sbGet` : `owner=eq.`).
- **Au plus une tentative toutes les 15 min**, réussie ou ratée (la tentative est notée AVANT
  la lecture) ; jamais plus d'1,2 s d'attente pour la carte ; lecture ratée ⇒ la dernière
  connue, sinon rien.
- Copie rangée au nom d'UN compte VRM (`u`) : la copie d'un autre compte ne sert jamais.
- **Mois** : `updatedAt` doit être dans le mois en cours (heure de Paris) ; sinon montant et
  ventes ⇒ `null` (« VRM n'a pas encore publié les chiffres de ce mois : ouvre VRM une fois »).
- **Le compte de l'onglet doit être PROUVÉ à ce compte VRM**, sinon rien n'est montré :
  - Vinted : le compte du cookie est dans `vrmLogins` de CETTE session (la liste
    `vinted_accounts`), et pas « ignoré » ⇒ preuve **sans réseau** ; sinon aucune lecture ;
  - Leboncoin : le compte de l'onglet est dans SON `lbc_accounts`, vu sur une page « moi »
    (`session`, `sessionAt`, ou source hors `LBC_URL_AUTRUI` — un vendeur vu sur une fiche ne
    compte pas) ;
  - Vestiaire : le compte de l'onglet (`vrmVcOnglets`) est dans SON `vc_session.comptes` ;
  - eBay : pas d'identité de l'onglet ⇒ jamais (et aucune lecture).
- Pas connecté à VRM, ou masqué ⇒ aucune lecture du tout.
- Les identifiants de comptes lus ne partent jamais à la page (seuls les chiffres).
- `EXT_CAPACITES.resumemois = '5.354.0'` (`moisPourCarte`, `audit-coherence`).

## Preuves

- `npm run build` vert ; `audit-{variables,tdz,coherence,identite,icones,textes-courts,
  fonctions-api,secrets,extension-zip,csp}` verts (après `git fetch --unshallow`) ;
  `orion-base-validee`, `orion-garde-regression` verts.
- **`scripts/audit-resume-carte.cjs`** (NEUF, exécute le VRAI `background.js` dans un vm,
  `scripts/_fond-vm.cjs`) : 39 contrôles verts — chiffres publiés, une lecture projetée filtrée
  sur le propriétaire, aucune requête Vinted, 15 min (réussie comme ratée), mois d'avant, colis
  > 12 h, zéro publié = 0, « au moins », Vinted/Leboncoin/Vestiaire/eBay, compte d'autrui, liste
  d'un autre compte VRM, copie d'un autre compte VRM, sans session, masquer/afficher, et la
  règle côté app (`aExpedierPourCarte`).
  - **Sur le code d'avant** (`--src` = background.js de `claude/extension-visuel`) : 28 rouges.
  - **Mutations** (chacune rouge) : preuve du compte retirée (6), cache 15 min à 0 (4), mois
    ignoré (3), fraîcheur des colis ignorée (2), tentative non notée (2), copie d'un autre
    compte VRM acceptée (2), masque ignoré (2), `select=data` ajouté (2).
- **`scripts/bancs/carte-resume-mois.cjs`** (NEUF, le vrai `vrm-badge.js`, 390 px au doigt et
  1512 px, clair et sombre) : 63 verts — replié/ouvert, texte exact, nombres rendus (`data-mois-*`),
  âge, aucune couleur, cibles ≥ 44 px au doigt, carte dans l'écran, « — » jamais 0, jamais
  « au moins 0 », « 0 vente / 1 vente / 42 ventes », rien sans connexion ni compte prouvé,
  Voir dans VRM / Masquer / Afficher. **Mutations** (chacune rouge) : « 0 » au lieu de « — »
  pour les ventes (2), « au moins 0 € » permis (3), affiché sans connexion (3), colis `null`
  montrés 0 (4). Captures regardées : `scripts/bancs/captures/carte-resume-mois/`.
  Défauts trouvés par le banc et corrigés : « 0 ventes » (→ « 0 vente ») ; le faux `chrome`
  du banc rendait le même objet à chaque appel (un vrai `sendMessage` copie) ; « 3 à /
  expédier » coupé (segments insécables).
- Bancs existants de la carte du logo repassés : `badge` 138, `extension-visuel` 63,
  `import-depart` 40, `lbc-clair-carte` 136, `carte-orion-sans-onglet` (voir le rapport) — verts.
  `carte-stable` (la carte MapLibre de Colis/Communauté, pas celle du logo) : 3 rouges, les MÊMES
  sur le code d'avant (`claude/extension-visuel`, rejoué dans un arbre `git archive`) — pas de ce lot.

## Geste de Julien

Installer l'extension **5.354.0** (remplacer le dossier, ⟳ dans chaque Chrome ; Orion :
`VRM-Orion-dossier.zip`), puis ouvrir VRM une fois pour que `widget_stats` porte `aExpedier`.
