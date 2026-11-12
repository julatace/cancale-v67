# 12 novembre 2026 — La discrétion (extension 5.370, second agent)

Branche `claude/agent2-discretion` — partie d'`origin/claude/agent2-ecriture-humaine` (5.369, finie
@ 073b81dfb), `origin/main` (11nov-f, 5.365) fusionné. Poussée à chaque commit, **aucune PR, aucune
fusion**. Elle CONTIENT `agent2-ecriture-humaine` (donc `agent2-extension-moyennes`, 5.356 → 5.362) :
**n'intégrer que celle-ci**. Extension **5.370.0** (5.367 = `annonce-vinted`, 5.368 =
`republier-programme`, 5.369 = `agent2-ecriture-humaine`).

Validé par Julien le 12 nov. pour limiter la détection par Vinted. Les garde-fous de toujours ne
sont JAMAIS affaiblis (50/h par compte, une requête à la fois, pause sur tout 429/403, compte de
l'onglet, aucun clic/touche simulé) : tout ce qui suit RETIENT davantage.

## Ce qui est livré, point par point

| n° | quoi | où |
|---|---|---|
| 2 | **Plafond par jour**, 200 par défaut, réglable (20–1 000, Paramètres → Mes comptes → Discrétion). Compté sur tous les Chrome du compte (chaque Chrome publie `jour: {d, n}` dans `actions_compte_…`, jour de Paris). L'automatique s'arrête 5 avant (la réserve de ses clics, comme l'heure). Base muette ⇒ ce Chrome prend la moitié. Jauge : « 12/50 cette heure · 112/200 aujourd’hui ». | `compterActionUn`, `plafondJourDe`, `src/jaugeActions.js` |
| 3 | **Rythme irrégulier** : périodes actives (25–60 min) et calmes (10–35 min) tirées par compte ; les gestes qui suivent le rythme (offres automatiques, baisses programmées) attendent la fin d'une période calme. **Jours calmes** : le plafond du jour est tiré entre 70 et 100 % du réglage, une fois par jour et par compte. | `phaseRythme`, `porteDiscretion({rythme})` |
| 4 | **Démarrage** : vinted.fr ouvert sur un compte après 30 min d'absence ⇒ 2 à 6 min (au hasard) sans geste automatique. Ses clics passent. | `noterOuvertureVinted` (visite) |
| 5 | **Un compte à la fois** dans un navigateur : un geste automatique pose un verrou de 10 min ; l'autre compte attend. | `vrmVerrouCompte` |
| 6 | **Même série décalée** (republication, baisse de prix, messages aux favoris) : un 2e compte attend 20 à 60 min (au hasard) après le dernier geste de la même sorte du 1er. | `vrmSeries` |
| 7 | **Compte neuf** (relié à VRM depuis < 4 semaines, `vinted_accounts.created_at` ; ou compte Vinted < 30 j, `created_at` du profil lu) : 10 → 20 → 35 → 50 /h, une semaine chacun. Date pas lue ⇒ plafond normal. ⚠️ Mesuré : 3 comptes reliés les 5, 7 et 10 nov. démarrent à 10/h. | `debutMontee`, `plafondMontee` |
| 8 | **Variables** {pseudo} (= {username}), {article} (titre lu dans CE fil), {prix} (l'offre faite, sinon le prix de l'annonce ; inconnu ⇒ le message ne part pas) — messages aux favoris ET refus automatique ; boutons dans l'éditeur des versions (`AutresVersions`) et des favoris. Copie identique app ⇄ extension (`<favoris-message-regle>`). | `src/favorisMessage.js` |
| 9 | **Offres la nuit** (0 h–7 h Paris) : 30 à 120 min au lieu de 3 à 20, toujours tiré au hasard. Aucun blocage de nuit (refusé). | `delaiOffreMs` |
| 11 | **Republier par petits groupes** de 3 à 6, pause de 15 à 45 min entre deux (allumé par défaut au-delà de 6 paires) : la ligne dit « Pause 27 min », « Autres groupes » retire, la case éteint. C'est lui qui lance. Une attente de la discrétion (autre compte, série…) fait repartir la MÊME paire plus tard, jamais un échec. | `planParGroupes` (src/discretion.js), `src/ecrans/Republier.jsx` |
| 12 | **Baisses irrégulières** : son choix varie de ± 20 % par annonce (8–12 % pour 10 %), arrondi à l'euro, remonté au plancher si la variation passait dessous ; « Dans les 6 h » (par défaut avec la 5.370) : l'extension garde la liste et fait UNE baisse due par minute, à son heure, dans le rythme, avec tous les garde-fous de `baisserPrixVinted` (prix relu avant/après). Pas partie 24 h après son heure ⇒ abandonnée et dite. « Annuler ». | `planifierBaisses`, `baissesTick`, `src/BaissePrixSerie.jsx` |
| 13 | **Arrêt net au captcha** (réponse qui parle de captcha / DataDome / robot) : plus AUCUN geste automatique du compte, sur aucun Chrome, jusqu'à SON « Reprendre » (`vinted_discretion.reprises[uid]`, synchronisé). Notification (`/api/push`, action `verification`, famille `capture`) + alerte ambre (Ma journée, jauges, Paramètres). Ses clics passent. | `poserArret`, `captchaEnCours`, `api/_lib/verification-vinted.js` |
| 14 | **Carnet des 7 jours** : refus 403/429, pauses, vérifications, prudences, modération, déconnexion — publiés (`ev`) ; Paramètres → Discrétion, et **un point de plus dans la Santé des comptes** (lot `sante-comptes` réutilisé : « Freins de Vinted (7 j) », à surveiller dès 2 refus ou une vérification). | `carnetDuCompte`, `src/santeComptes.js` |

### Ajouts du 12 nov. (coordinateur, validés par Julien)
- **Modération ⇒ coupure** : une modération NEUVE lue (lot `alerte-moderation` réutilisé : `rangerModeration`) arrête les gestes automatiques du compte (même mécanisme que le captcha) ; la notification est celle de la modération ; « Reprendre ».
- **Compte déconnecté** : un 401 sur une requête partie de l'ONGLET ⇒ arrêt (« Reconnecte-toi sur vinted.fr »), aucune nouvelle tentative en boucle ; levé tout seul par la première réponse réussie de l'onglet sur ce compte (ou « Reprendre ») ; notification.
- **« Tout arrêter »** : un interrupteur pour TOUS les comptes (offres, favoris, republications, baisses, bordereaux automatiques) — Paramètres → Discrétion, Ma journée (« Tout est arrêté · Reprendre »), et la carte du logo ; le plus récent des trois (app synchronisée, ce Chrome, les autres Chrome via `ta`) gagne. Ses clics passent.
- **Limite par sorte** : 15/h messages aux favoris, 15/h réponses automatiques aux offres (réglables 1–50), comptées sur tous les Chrome (`so`).
- **Relecture « seulement le nouveau »** (Julien : « une fois que tu as capté tout le compte, tu ne fais que ce qu'il y a de nouveau ») — MESURÉ avant : `rafraichirVentes` (chaque visite, ≤ 1/90 s) lisait jusqu'à 8 pages de 40, la moisson 10 pages de 100 ventes + 10 d'achats, même tout rangé ; `fusionnerCommandes` (5.323) évitait de RÉÉCRIRE, pas de RELIRE ; l'import (5.344) ne relit rien une fois fini. Désormais : type complet (import « Tout est récupéré », ou une lecture de ce Chrome allée d'elle-même jusqu'à la dernière page ET rangée) ⇒ page 1, arrêt dès qu'une page porte une transaction connue au MÊME état, sauf vente EN COURS connue pas revue (on lit jusqu'à elle). La relecture de chaque visite reste pendant la prudence (anti double vente). Mémoire `vrmCmdConnus` (1 500 n° par type), apprise seulement sur un rangement réussi. Mesuré au banc : **compte de 2 000 ventes : 1 requête au lieu de 8**. Le dressing n'est pas concerné (la règle « en ligne » exige une lecture complète < 24 h).
- **L'icône ouvre VRM dans un onglet** (« comme Vintex ») : plus de `default_popup` ; l'onglet VRM de CETTE fenêtre au premier plan, sinon un nouveau ; déconnecté ⇒ vrm.center (connexion, `lier-extension`). Ce que faisait la fenêtre (connexion e-mail / code / Google / Discord, lier à VRM, se déconnecter, version, permission transporteur, ouvrir VRM) : **clic droit sur l'icône** ⇒ « Connexion à VRM » / « État de l'extension » (la même page, dans un onglet ; permission `contextMenus`, sans avertissement Chrome), la carte du logo, Paramètres → « Tout va bien ? ». **Orion iPhone** (pas de clic droit) : le paquet garde la fenêtre (`default_popup` remis par `zip-extension.cjs`), déconnecté ⇒ la fenêtre de connexion comme avant. Textes de l'app mis à jour (« clic droit sur l'icône VRM »).

## Décisions prises seul
1. **Qui suit le rythme** : les offres automatiques et les baisses programmées. Pas les messages aux favoris (étalement refusé par Julien), pas les séries qu'il lance (Republier a ses groupes, la baisse son étalement), pas les bordereaux (obligation d'envoi : ils n'attendent que la vérification, la modération, la déconnexion et « Tout arrêter »).
2. **Clic ou automatique** : est « automatique » ce qui compte sous la réserve (`plafond < 50` : `garde`, `gardeStricte({reserve})`). Le mode vacances (sur son clic, mais réservé) est donc arrêté par une vérification.
3. **Le plafond du jour et le compte neuf touchent aussi ses clics** (comme la prudence) ; la réserve de 5 reste à ses clics.
4. **Compte neuf** : la plus récente des deux dates (relié à VRM, création Vinted) ; un compte retiré puis relié repart de 10/h (dit).
5. **Pas de nouvelle fonction serverless** : la notification passe par `/api/push` (12 fonctions).

## Preuves
- `node scripts/audit-discretion.cjs` : **78 verts** (le vrai background.js dans un vm, plus les règles de l'app) ; **27 rouges sur la branche de départ** (`git archive 073b81dfb`, et `BG_SRC=`) ; `--prouve` : **15/15 mutations** rougissent (jour, captcha, ouverture, verrou, série, rythme, montée, nuit, facteur du jour, relecture, limite par sorte, tout arrêter, déconnexion, modération, reprise).
- `node scripts/audit-icone-extension.cjs` : 13 verts ; 6 rouges sur la 5.369 (`SRC=`).
- `audit-ecriture-humaine` 34, `audit-moteur-offres` 24, `audit-sante-comptes` 39, `audit-coherence`, `audit-traduction`, `regles-achat-extension`, `audit-extension-zip`, `audit-extension-navigateurs`, `tests/orion-paquet` (135), `tests/favoris-message` : verts.
- Banc `scripts/bancs/discretion.cjs` (390 tactile / 1512, clair / sombre) : Paramètres → Discrétion, « Reprendre », « Tout arrêter », Ma journée, Santé des comptes ; captures regardées. Banc `sante-comptes` remis à la règle (8 points).
- Tous les audits : tableau comparatif branche / départ en fin de récit.

## Ce qui reste
- Les arrêts (captcha, modération, déconnexion) ne sont publiés que par l'extension 5.370 : une extension plus ancienne ne dit rien (« pas su », jamais « tout va bien »).
- `republier-programme` (5.368, agent principal) n'est pas sur cette branche : à son intégration, son départ programmé passera par `recreerVinted` (donc par la porte, sorte `republier`) — rien à faire de plus.

## Geste de Julien
Installer l'extension **5.370.0** (remplacer le dossier, puis ⟳ dans CHAQUE Chrome ; Orion : `VRM-Orion-dossier.zip`). Rien d'autre : les réglages ont leurs défauts (200/jour, 15/h favoris, 15/h offres).
