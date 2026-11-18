# 17 nov. — Les favoris en liste à cocher dans la carte de l'extension (5.407.0)

Branche `claude/extension-favoris-liste`, partie de `origin/claude/extension-carte-v2` (#1247, 5.406).
Extension **5.407.0** (libre : aucune branche ni PR ouverte ne la portait le 17 nov.).

## Ce que Julien a dit

Après avoir vu la carte 5.406 sur vinted.fr : « il faut une liste avec les favoris pour pouvoir les
sélectionner etc ». Ses décisions du 12 nov. restent : par compte, du plus récent au plus ancien, une
case par favori, les favoris d'articles vendus retirés, « Rapide » (jamais « Vintex »), 8–20 s
aléatoires entre l'offre et le message.

## Ce qui change

Carte du logo sur vinted.fr → segment **Favoris** :

- **La liste** de TOUS les favoris du compte de l'onglet dont l'article est encore en vente (jusqu'à 1 000,
  les plus récents), du plus récent au plus ancien, par pages de 100 : « Voir les 100 suivants » jusqu'au
  dernier — aucun favori hors d'atteinte (revue du coordinateur). Chaque rangée : une case (cible 44 × 44 px), la photo
  avec son étiquette N° en kraft (par identité d'annonce, `infosDuCompte`, compte de l'onglet seulement),
  le titre (2 lignes), « acheteur · il y a 2 h », le prix (barré + prix de l'offre quand il y en a une).
  Une rangée se touche entière.
- **Déjà contacté** : la rangée reste visible, grisée (la photo, jamais le texte), case inactive, la raison
  écrite : « offre déjà envoyée », « message déjà envoyé », « message en cours », « à vérifier sur
  Vinted », « pas envoyé, pas reproposé », « destinataire pas encore sûr : ouvre ce favori depuis la
  cloche de Vinted », « prix de l'offre pas calculable ».
- **En haut** : « 20 cochés · 15 par heure maximum » (la raison du plafond, à côté), « Tout cocher » (tous
  les favoris visibles qu'on peut contacter) / « Rien » ; les filtres « Toutes les annonces (N) » (une annonce, avec son N°) et
  « Pas encore contactés ». « N favoris d'articles vendus ou retirés : cachés ».
- **Un seul plein** : « Envoyer à 12 favoris » ⇒ un **récapitulatif** : par annonce (photo, N°, combien de
  favoris, prix → offre), « Avec une offre −10 % », le message (une de ses N versions, au hasard), la
  durée au vrai rythme (« Environ 25 min · 15 par heure maximum ») ; « Confirmer l'envoi » lance, « Retour
  à la liste » revient. Puis l'écran « action en cours » de la 5.406 (Tout arrêter, Réduire) tel quel.
- **15 par heure** (garde gardée) : un envoi part avec les 15 plus récents cochés ; « Les 5 autres restent
  cochés : ils partiront à l'envoi suivant ». Après un envoi de 15, le bouton dit « Envoyer les 15 suivants
  à 20:45 » et attend l'heure (`vrmFavLot[uid]`, heure du dernier lot, chrome.storage.local).
- **Le choix survit** à un rechargement : `chrome.storage.local.vrmFavSelection[uid]` (par compte, 30 j),
  réduit aux favoris encore cochables ; sans choix gardé, les 15 plus récents.
- Les longues listes restent fluides : cocher ne redessine rien (le compteur et le bouton suivent sur place, deux
  cases < 50 ms mesuré), `content-visibility: auto` sur les rangées, images paresseuses ; le défilement
  est gardé à chaque redessin (`data-defil`).
- Textes neufs en 5 langues dans `vrm-ui.js` (`fl_*`, `fr_*`).

## Une seule règle par notion

- Le serveur (`api/_lib/favoris-carte.js`, `apercuCarte`) rend `tous` avec les MÊMES règles qu'avant
  (`etatFavori` de l'app, `etatAnnonceAuto`, destinataire prouvé, `prixOffreFavori`,
  `personnaliserMessageFavori`) : un favori est `cochable` exactement quand l'envoi d'avant l'aurait
  retenu (`liste`) — l'audit le vérifie. Vendue (ici ou ailleurs), réservée, en pause, fermée, absente du
  dressing ⇒ cachée et comptée (`retires`). `liste` et `selection` restent (cartes d'avant).
- La carte ne décide rien : elle trie, filtre, coche.
- Durée : chaque message ≈ 45 s (ouvrir, offre, 8–20 s, écriture) + l'écart choisi (« Rapide » 6–10 s), au
  plus 15 par heure (`dureeFavMs`, vrm-badge.js) — une estimation, dite « environ ».

## Les gardes (aucune retirée)

Nouvelle garde dans le fond (`favorisCarte`, `lancer`) : seulement des favoris **cochables de l'aperçu
montré** de ce compte (`vrmFavorisApercu[uid].cochables`, `cochablesApercu`), lu il y a moins de 30 min ;
après un lancement l'aperçu gardé est vidé (un second envoi exige une liste relue). Restent : `confirme`
(posé seulement par « Confirmer l'envoi » du récapitulatif), 15 au plus par envoi, compte de l'onglet,
« Tout arrêter », hors ligne, une file à la fois ; puis à l'envoi 50/h et sa réserve, plafond du jour,
15/h favoris, pause 429/403, une requête à la fois, arrêt sur captcha, chaque favori contacté une fois
(serveur : `etatFavori`).

## Preuves

- `scripts/audit-favoris-liste.cjs` (vraie règle du serveur + vrai `background.js` + vraie file) :
  35/35 (dont S2 : 400 favoris, tous dans la liste, réponse bornée) ; rouge sur `claude/extension-carte-v2` (15 rouges puis lève) ; `--prouve` 7/7 (cochables, déjà
  contactés, fraîcheur, confirmation, plafond 15, vendus, contactés côté serveur).
- `scripts/bancs/extension-favoris-liste.cjs` : 390 tactile, 1280, 1512, clair et sombre — 120 favoris ;
  contraste ≥ 4,5:1, cibles ≥ 44 px, rien de coupé, rien ne déborde ; gestes au doigt et à la souris
  (Rien, trois rangées touchées, déjà contacté non cochable, filtres, Tout cocher ≤ 15, rechargement,
  récapitulatif, rien avant « Confirmer », puis exactement les 3 cochés avec `confirme: true` ; F5 : 250 favoris, « Voir les suivants » jusqu'au dernier ; F6 : tout cocher ⇒ 15 envoyés, les autres restent cochés, « Envoyer les 15 suivants à HH:MM »).
  Captures regardées ; planche : scratchpad `onglets/extension-favoris.png`.
- `audit-coherence` (capacité `favorisliste2`), `audit-extension-zip`, `audit-traduction`, build.

## Geste de Julien

Installer l'extension **5.407.0** (remplacer le dossier, ⟳ dans chaque Chrome ; Orion :
`VRM-Orion-dossier.zip`). Le serveur doit être déployé (la liste vient de `apercu.tous`) : sans lui, la
carte garde l'aperçu d'avant (15 à cocher).

## Ajouts du même lot (retours de Julien sur la 5.406 en usage réel, relayés par le coordinateur)

### « L'affichage qui bloque de l'extension disparaît 1 s » (écran « action en cours »)
Causes trouvées (toutes corrigées, `vrm-action.js`, `content.js`, `background.js`) :
1. **Vinted bloqué = l'écran tombe** : pendant une attente qui ne change rien (pause 429/403, vérification,
   autre compte…), la file ne réécrivait pas l'état ; au bout de 3 min il passait pour « fond mort » ⇒
   l'écran affichait « Terminé » et s'effaçait, puis revenait au geste suivant. ⇒ battement : chaque tour
   d'une file active rafraîchit `maj` (`battreActionEnCours`, ≤ 1 écriture / 20 s).
2. **Service worker endormi / en réveil** : une réponse absente valait « rien » ⇒ écran éteint jusqu'à la
   lecture suivante. ⇒ « pas su ≠ fini » : l'état du MÊME lot se relit dans `chrome.storage.local`.
3. **Une lecture « rien » isolée** éteignait l'écran ⇒ il faut deux lectures à 1,5 s d'écart.
4. **Chaque pas redessinait tout et rejouait le fondu** (opacité 0 → 1, flou réappliqué) ⇒ mise à jour
   SUR PLACE (compteur, barre, article, suite, suivants), l'entrée calme une fois par lot (`.anim`), pas
   rejouée après un rechargement du même lot.
5. **Route SPA / document réécrit** ⇒ le MÊME hôte (même shadow root) se raccroche, le verrou se repose.
6. **Rechargement complet** : l'écran n'arrivait qu'à `document_idle` ⇒ `content.js` (document_start) pose
   un voile bloquant si l'écran plein était là il y a < 3 min (`sessionStorage.vrm_action_gel`), retiré dès
   que l'écran a repris (8 s au plus).
7. **Un message bref de Vinted** (`role=alert`) écartait l'écran ⇒ une alerte doit tenir 800 ms ; la mise de
   côté (vérification ou alerte) est DITE en bandeau et tenue ≥ 3 s — jamais un éclair.

### « Le pavé tactile permet de descendre dans Vinted »
La molette au-dessus de l'écran n'était pas retenue (le bouclier laissait passer tout évènement visant
l'écran) et la page défilait derrière. ⇒ `html`/`body` en `overflow: hidden` (valeurs en ligne d'avant et
position gardées, rendues exactement à la fin, sur « Réduire », « Tout arrêter », et pendant une
vérification), molette / `touchmove` / touches de défilement retenues hors de la boîte (`passive:false`,
capture), `overscroll-behavior: contain` sur l'écran et sa boîte.

### « Arrêté : Vinted demande une vérification »
Lecture seule de la base (17 nov.) : **2 arrêts « vérification » aujourd'hui** (un par compte, `vinted_robot`),
**0 message parti aujourd'hui** ; avant le second, 2 actions dans l'heure sur ce compte (bien sous 15/h et
50/h). Ce n'est pas une panne d'envoi : c'est la garde « arrêt au premier captcha ». L'expérience :
- la file n'est plus ARRÊTÉE mais **en pause** (`st.robot`) ; rien ne part (l'arrêt « captcha » de
  l'extension tient) ; l'écran s'écarte en carte calme : « Vinted demande une vérification (anti-robot).
  Fais-la ici sur la page. » + « 6 sur 15 envoyés · 9 en attente » ;
- vérification FAITE (plus de captcha dans la page ET Vinted a répondu normalement depuis,
  `vrmFlux.vinted.okAt`) ⇒ « Vérification faite · On reprend plus doucement pendant 24 h · Reprendre » ;
  SON toucher reprend la MÊME file (`reprendre`, `api/_lib/favoris-file.js` `reprendreFile` : seuls les
  favoris encore en attente de ce lot) ; jamais tout seul ; la prudence de 24 h (20/h, délais doublés) reste ;
- onglet fermé : la file reste en pause ; l'app lit chez VRM « Vinted demande une vérification… puis
  « Reprendre » sur la carte VRM de vinted.fr ».

### Le prix mini à côté du N°
Chaque favori de la liste (et du récapitulatif) : étiquette N° kraft + « mini 42 € » (le prix mini
d'acceptation posé à côté du N°, `vinted_annonce_numeros[id].min`, lu par `offreAutoReglages`) ; pas posé ⇒
« mini — » et « N sans prix mini · Fixer » (ouvre Annonces, où il se pose) — jamais deviné. Au
récapitulatif, une offre sous le mini est dite (« offre 41 € < mini 50 € ») avec « Les décocher » / « Fixer ».

### Preuves ajoutées
- `scripts/audit-action-continu.cjs` : vrai `background.js` (pause de Vinted, worker redémarré) + vrais
  `vrm-action.js`/`vrm-ui.js`/bloc de `content.js` dans Chromium, échantillons toutes les 50 ms (écran vu,
  centre bloqué) à travers pas, fond muet, « rien » isolé, routes SPA, hôte arraché, toast, rechargement ;
  molette et touches sans effet ; carte de vérification, « Reprendre » ; fin rendue exactement. Rouge sur
  5.406, `--prouve` 9/9.
- `audit-favoris-liste` B5 (pause, reprise seulement vérification faite, même lot, prudence intacte).
- banc `extension-favoris-liste` F7 (mini, « Fixer », offre sous le mini, « Les décocher »).
