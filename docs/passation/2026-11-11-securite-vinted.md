# Sécurité des comptes Vinted et Vestiaire (11 nov., lot `securite-vinted`, extension 5.366.0)

Demande de Julien : « améliore la sécurité des comptes Vinted pour faire comme Vintex, pour ne pas se faire
bannir ». Il l'a complétée le soir même avec ses précisions (repos de nuit par compte, plafond par jour en option),
dix ajouts validés, et l'extension à Vestiaire Collective (« on peut faire la même chose avec Vestiaire »).
Pas de repos entre deux comptes : « on s'en fiche ».

## ÉTAT À LA REPRISE
- Branche `claude/securite-vinted` (partie de `origin/main` f04d4a580), poussée, **rien fusionné**.
- Extension **5.366.0** réservée dans `docs/passation/COORDINATION-AGENTS.md` (branche `claude/coordination`).
- Preuve : `node scripts/audit-securite-comptes.cjs` (règle + vrai `background.js` dans un vm, `--mutation=toutes`,
  `--src <ancien background.js>` pour la preuve sur l'avant).
- Pas fait : le banc de rendu dédié est `scripts/bancs/securite-comptes.cjs` (voir « Preuves » plus bas).
- `agent2-vinted-forme` (5.357 : forme des réponses Vinted + prudence 24 h après un refus) n'est PAS sur `main` :
  rien n'en est repris. À l'intégration, sa prudence doit alimenter `secuObserver` (une seule prudence par compte),
  ou l'inverse : c'est écrit dans le fichier de coordination.

## Ce que fait la couche (une règle, un module, deux plateformes)
`src/securiteComptes.js` contient la règle pure (bloc `<securite-comptes-regle>`), **recopiée telle quelle** dans
`vinted-sync-extension/background.js` (`node scripts/audit-securite-comptes.cjs --recopie`) : la phrase de l'écran
et la décision de l'extension sortent de la même règle.

Chaque geste qui écrit chez un site passe par `secuGeste(plateforme, compte, sorte, mode)` **avant** le plafond
horaire, qui ne bouge pas (50/h/compte, réserve 5, 20 lectures/h ; vérifié par l'audit, E9).

Les modes : `auto` (offres auto, mode auto des favoris), `programme` (lancé par lui, part plus tard), `serie`
(baisses, Republier, favoris qu'il lance), `suite` (la mise en ligne d'une paire déjà commencée : jamais une paire
laissée entre suppression et brouillon), `visite`, `clic`.

| règle | qui elle touche | détail |
|---|---|---|
| Repos de nuit, **par compte** | auto, programme | défaut 23 h → 8 h (Paris), réglable par compte ou pour tous les comptes d'une plateforme |
| Horaires variables | idem | début et fin décalés chaque jour de ±9 min au plus, à la seconde, différents par compte (`secuDecalage`) |
| Rien ne se rattrape d'un coup au réveil | auto, programme | les 40 min après le repos : un geste toutes les 4 à 7 min ; un geste en retard attend son tour ou est abandonné au passage suivant (l'offre reste « prévue », jamais « faite ») |
| Plafond **par jour** (option) | auto, programme, serie | `parJour`, 0 = aucun (défaut), en plus des 50/h |
| Plafond **par type** | auto, programme, serie | offres, favoris, republications, baisses, réponses : N par heure, à l'intérieur des 50/h (bornés à 50) |
| Pas de rafale | tous | auto/programme : 40 s + tirage (jusqu'à +80 %) ; série : 8 à 14 s ; clic : 3 s (20 s en prudence). L'extension n'attend jamais plus de 25 s (l'app attend sa réponse) : au-delà, refus « plus tard », dit |
| Délais variables | tous | jamais une minute ronde (`secuDelaiVariable`, `secuCible`) |
| Mode prudence au premier refus | auto, programme, serie, visite | 429 ⇒ 3 h (ou le Retry-After s'il est plus long), 403 ⇒ 6 h, restriction lue (« activité automatisée », « restreint »…) ⇒ 24 h ; la phrase dit l'heure de reprise ; un clic passe, plus lentement |
| **Arrêt immédiat sur contrôle anti-robot** | tout, lectures comprises | DataDome (`x-datadome`, `captcha-delivery.com`), captcha, défi Cloudflare, page « Just a moment » : plus rien ne part pour ce compte, aucune nouvelle tentative ; « Vinted vérifie ton compte · fais la vérification toi-même sur vinted.fr » ; reprise **seulement** après une lecture normale de SA page (capture passive), suivie de 6 h de prudence |
| Retry-After | Vinted et Vestiaire | la pause 429/403 dure au moins ce délai (palier = plancher, 24 h au plus) |
| « N'agir que si tu es là » | auto | un vrai geste (`isTrusted`) dans l'onglet du site depuis moins de 30 min (réglable) ; ce qu'il lance lui-même n'est pas concerné |
| Journée calme | auto, programme | jours de la semaine au choix, par compte ; et « Calme aujourd'hui » proposé quand un refus a été vu (`journeeCalme` de `src/offresSures.js`, réutilisé) |
| Compte récent (lu) | auto, programme, serie | moins de 7 j ou moins de 3 ventes ⇒ 10/h ; moins de 30 j ou moins de 10 ventes ⇒ 25/h ; rien de lu ⇒ rien d'inventé |
| « Tout arrêter » | tout sauf ses clics | VRM (sa clé, et tout de suite dans ce navigateur) et la carte de l'extension ; le DERNIER arrêt/relance fait foi, d'où qu'il vienne ; couvre Vinted, Vestiaire, Leboncoin |
| Un seul compte à la fois | tous | inchangé : l'extension n'agit que pour le compte connecté dans l'onglet (`garde`, `gardeStricte`) |

Refusé et absent exprès (CLAUDE.md §3) : changer d'empreinte, d'appareil, d'adresse IP, modifier une photo pour
tromper, piloter la souris. L'écran le redit en une ligne.

### Décisions prises seul (dans l'esprit de la demande)
- Republier : l'espacement reste SON choix (fixe ou aléatoire) ; la couche n'y ajoute qu'un plancher de 8–14 s.
  La mise en ligne d'une paire déjà supprimée (`finRepubBrouillon`) ne s'arrête que sur « Tout arrêter » ou un
  contrôle anti-robot (le brouillon attend, « Brouillons → en ligne » le reprend).
- Les bordereaux et ses clics ne sont pas soumis au repos de nuit ni aux plafonds du jour (ils sont autorisés et il
  est là) ; ils restent soumis à l'arrêt anti-robot.
- Les réglages illisibles (base muette) : un geste `auto`/`programme` ne part pas ; une série reprend le dernier lu.

## Où c'est branché
- Vinted : `gardeStricte` (robot en tête, puis `secuGeste` avant `compterAction`), `garde`, `gardeLecture` (robot),
  le moteur d'offres (`secuGeste('vinted', uid, 'offre', 'auto')` avant chaque geste), baisse de prix (`serie`),
  Republier / recréer (`serie`), favoris (`auto` si mode auto, sinon `serie`), mode vacances (`clic`),
  `finRepubBrouillon` (`suite`). Observation : `vintedPage`, `vintedSend`, `vintedGet` (en-têtes, début du texte
  si ce n'est pas du JSON — jamais rangé) ⇒ `secuObserver`. Reprise : `storeHarvest` ⇒ `secuLectureNormale`.
- Vestiaire : `repondreVestiaire` et `repondreOffreVestiaire` (robot + `secuGeste` avant le plafond de 50/h, inchangé),
  `vc-inject.js` renvoie `defi` (oui/non) et `ra` (Retry-After), `poserPauseVc` les respecte ; captures passives
  (`vcAnnonces`, …) ⇒ `secuLectureNormale`. Le journal note `journal_vc_{compte}_{nav}` (sortes et heures seulement).
- Présence : `content.js` (Vinted) et `vc.js` (Vestiaire) signalent un vrai geste au plus toutes les 30 s.
- État publié : `securite_etat_{navigateur}` (robot, prudence, dernier geste, gestes par jour, arrêts/relances).
- App : Paramètres → Mes comptes → « Sécurité des comptes » (`src/SecuriteComptes.jsx`), clé `vrm_securite_comptes`
  (SYNC_KEYS), `EXT_CAPACITES.securite = 5.366.0`. Carte de l'extension : ligne « Sécurité du compte » + « Tout
  arrêter / Relancer » (`vrm-badge.js`, `secuArret`).
- Pour les lots parallèles (`vestiaire-plus`, `lbc-plus`) : `const s = await secuGeste('vestiaire', compte, 'baisse',
  'serie'); if (s) return refus(s.error);` puis `await secuObserver('vestiaire', compte, { status, defi, retryAfter })`.

## Ce que font Vintex et les outils comparables (sources : pages publiques, souvent commerciales — prudence)
- Vintex se présente comme une extension Chrome qui agit **dans la session du vendeur** (aucun mot de passe partagé) :
  republication, réponses, négociations, plusieurs comptes ([Friptadium, avis Vintex](https://friptadium.com/blogs/actualites/vintex-avis-prix-outil-vinted),
  [Friptadium, comparatif 2026](https://friptadium.com/blogs/actualites/meilleurs-outils-automatisation-vinted-2026)). Ces
  pages sont écrites par des concurrents ou des affiliés ; elles rappellent que republication de masse, messages et
  offres automatiques sont précisément ce que Vinted surveille ([Friptadium, guide](https://friptadium.com/blogs/actualites/vinted-automatisation-guide)).
- VintedCRM / Vantly : extension dans le navigateur, et une clause qui décline toute responsabilité en cas de
  suspension ([conditions Vantly](https://addons.mozilla.org/ja/android/addon/vantly/eula/), [VintedCRM](https://vintedcrm.com/extension/)).
- Vinted bloque un compte sur activité jugée suspecte ou multi-comptes ([aide Vinted](https://www.vinted.fr/help/92)).
- Ce que VRM mesurait déjà de Vintex (récit 29 oct., `historique-vinted-extension.md`) : requêtes parties de l'onglet
  vinted.fr avec les cookies du site, aucun `Authorization` ; pauses entre transaction, offre et message
  (3,2–6,0 s · 0,3–0,8 s · 0,4–0,5 s). VRM a copié cette forme (`vintedPage`, `PAUSES_FAVORI`).
- Aucune source sérieuse ne publie le seuil de Vinted : VRM ne le devine pas (50/h reste SA décision).

## Ce que VRM faisait déjà avant ce lot
Compte de l'onglet seulement, 50 actions/h/compte tous navigateurs confondus, réserve de 5 pour ses clics, budget
de lecture 20/h, une requête Vinted à la fois, pause 15 min → 4 h sur 429/403, frein de republication (30 min, 24 h
si restreint), délais aléatoires des offres auto (3–20 min), offres seulement sur une garde fraîche, mode auto des
favoris arrêté par un frein/captcha, tout depuis l'onglet vinted.fr (aucun `Bearer` pour les gestes), jauge et journal.

## Preuves
- `node scripts/audit-securite-comptes.cjs` : 35 verts (R1–R24 règle, C1 copie, E1–E10 vrai `background.js`).
- `--mutation=toutes` : chaque mutation rougit l'audit (repos, présence, robot, arrêt, plafond/jour, rafale, minute
  ronde, décalage, détection DataDome, Retry-After, moteur, observation, Vestiaire, lecture normale).
- `--src` sur le `background.js` d'`origin/main` : E1–E10 rouges (la couche n'existait pas).
- Build, audits `variables tdz coherence identite icones textes-courts fonctions-api secrets quoi-de-neuf traduction`.
- Banc `scripts/bancs/securite-comptes.cjs` : 390 px tactile et 1512 px, captures regardées.
