# 13 nov. — Lot 11 : les horaires des points Mondial Relay (point 11 de Julien)

Branche `claude/lot11-horaires-mr`. Rien d'écrit en base (lectures SQL projetées). Fixtures inventées (dépôt
public). `vinted-sync-extension/` pas touché. Aucune fonction `api/` ajoutée (12). Suite de
`2026-11-13-horaires-relais.md` (Chronopost, Vinted Go : horaires lus dans l'e-mail).

## 1. Mesuré (lecture seule, 13 nov. vers 21 h)
- **À l'écran aujourd'hui** : la liste publiée `vrm_colis_retirer` (main) compte **4 colis à retirer, aucun Mondial
  Relay** (transporteur « autre »). Donc **0 point Mondial Relay sur 0** n'a d'horaires ce soir — il n'y en a pas.
- **Ce qui arrive** : 52 e-mails Mondial Relay « disponible » depuis le 1er nov. ; leurs 52 lignes `transp_mondialrelay_*`
  ont été lues par le SERVEUR (voie `mr-fr-mvc`, code postal connu pour les 52) et sont aujourd'hui « retiré ».
  Toutes les lignes `transp_mondialrelay_*` (80) : `pointId` vide partout (le serveur ne le gardait pas).
- **L'identité du point dans l'e-mail** : le texte gardé (`email_texte_*`) donne nom + adresse + code postal
  (« MAISON DE LA PRESSE / 40 RUE DU PORT / 35260 CANCALE »), « Horaires d'ouvertures, photo, itinéraire : toutes les
  informations juste ici ! » et **aucun n° de point**. Le HTML gardé (`email_html_*`, 28 e-mails Mondial Relay) : le
  lien est une **redirection de suivi opaque** `notification.mondialrelay.fr/c?q=…`, propre au destinataire — on ne
  la suit pas (elle compte un clic et ne dit pas le n° de point).
- **La source** : la réponse de suivi que le serveur lit DÉJÀ pour chaque colis
  (`www.mondialrelay.fr/_mvc/fr-FR/SuiviExpedition/RechercherJsonResponsive`, n° + code postal, écho exigé) porte,
  **mesuré le 24 oct.** depuis dub1 (récit dans `api/_lib/transporteurs-lecture.js`, en tête), le n° du point
  (`<input id="numeroTemp">`, `<input id="codePaysTemp">`) et ses horaires (`div.points_relais PCL_Details ›
  div.detail-mag`, un tableau « Horaires d'ouverture : », une ligne par jour, `Fermé` sur deux colonnes).
- ⚠️ **Pas de nouvelle mesure aujourd'hui** : le bac à sable Vercel est refusé (« Hobby plan usage limit exceeded »,
  jusqu'au 1er déc.), le conteneur et l'outil de lecture web ne joignent pas mondialrelay.fr (refus du réseau). Je
  n'ai donc ni relu la forme du tableau ce soir, ni lu les CGU de mondialrelay.fr. Ce qui suit n'ajoute **aucune
  requête** : il lit mieux la réponse que le serveur reçoit déjà depuis le 24 oct.

## 2. La règle
- `api/_lib/horaires-relais.js` · `pointEtHorairesMr(html)` (pure) : un seul n° de point, pays `FR`, un tableau (ou
  plusieurs identiques) dont CHAQUE ligne est « jour + plages » ou « jour + Fermé » ⇒ `{ pointId, horaires }`, les
  jours aux mêmes plages regroupés (« lun.–sam. 9 h–12 h, 14 h–19 h »). Deux points, un autre pays, deux tableaux
  différents, une ligne illisible, une heure impossible ⇒ **rien**, et la FORME seule (comptes de points, blocs,
  lignes, cellules — jamais le contenu) dans `horairesForme` sur la ligne `transp_`, pour la mesurer en base.
- `api/_lib/transporteurs.js` · `lireReponseMondialRelayMvc` : n° de point et horaires gardés **seulement quand le
  colis y attend** (« disponible ») ; en route (le point peut changer), retiré ⇒ rien.
- `ligneApresEssai` : rangés (`horaires`, `horairesPoint`, `horairesAt`) **seulement si la lecture est celle du
  SERVEUR** (décision de Julien : jamais l'extension ; une réponse relayée en C4 n'en pose pas). Une lecture qui ne
  les redonne pas garde les précédents **7 jours au plus** (`HORAIRES_TRANSP_VALIDES_MS`), du même point, tant que le
  colis attend ; sinon effacés. Refus ou panne : rien ne change.
- **Le cache** : la ligne `transp_mondialrelay_{n°}` elle-même, relue au rythme du suivi (au point relais : 15 min
  app ouverte, crons) — **aucun appel par affichage, aucune requête de plus**, 7 jours de validité.
- Lecture : `SELECT_TRANSP_META` projette `horaires:data->horaires` (+ `horairesPoint`, `horairesAt` en `meta`),
  `ligneTranspDeMeta` ne croit que la forme exacte.
- `api/_lib/suivi-colis.js` · `horairesDuTransporteur` / `fusionTransporteur` : posés sur la ligne « à retirer » du
  MÊME n° seulement si le code postal que Mondial Relay a confirmé pour ce colis (`cp`, écho) est le SEUL code postal
  du point affiché ; l'e-mail qui écrit ses horaires garde les siens ; lus il y a plus de 7 jours ⇒ rien.
- Écran (`src/CarteRelais.jsx`) : la ligne existante « Ouvert … · ouvert maintenant · ferme à … », datée de la lecture
  chez le transporteur pour choisir la plus récente du point. Neutre, heure de Paris ; pas su ⇒ rien.

## 3. Preuves
- `scripts/audit-horaires-mondialrelay.cjs` : 45 contrôles (règle pure, 9 formes qui ne doivent rien donner,
  analyseur, ligne après essai, lecture projetée, fusion, **vraie route `api/relais.js`** C5 puis C4 sur une base à
  état : une seule requête, la ligne porte les horaires, C4 les efface au retrait). **14 rouges sur `origin/main`**.
  `--prouve` : **10/10 mutations rouges** (deux points acceptés, tableaux différents, horaires en route, extension
  acceptée, jamais expirés, pas relus par l'app, code postal ignoré, périmés affichés, e-mail écrasé, fusion muette).
- Banc `scripts/bancs/retirer-horaires-mr.cjs` (390 tactile, 1512, clair, sombre, vendredi 10 h 19 et 20 h 30) :
  **64 verts** ; sur le build d'`origin/main` : voir le rapport de la session (rouges attendus sur le Tabac). Captures
  regardées : « Ouvert lun.–sam. 9 h–12 h, 14 h–19 h · ouvert maintenant · ferme à 12 h » sous l'adresse, discrète ;
  rien pour le point à un autre code postal ni pour des horaires de 9 jours.
- Audits verts : mondialrelay-serveur, statut-transporteurs, suivi-colis, horaires-relais, relais-change,
  rappels-colis, suivis-sans-qr, retrait-fiable, colis-retrait, transporteurs, relais-carte, retraits-irreprochables,
  vintedgo-adresse, fonctions-api, tdz, variables, coherence. Banc `retirer-horaires` (d'avant) relancé.

## 4. Ce qui reste
- **Vérifier en base après mise en ligne**, au prochain colis Mondial Relay arrivé (lecture seule) :
  `select id, meta->>'etat', meta->>'horairesPoint', meta->>'horairesAt', meta->>'horairesForme' from app_data
  where id like 'transp_mondialrelay_%' and meta->>'etat'='disponible'`. `horairesPoint` vide ⇒ la réponse ne porte
  plus `numeroTemp` ; `horairesForme` rempli ⇒ le tableau a changé de forme (la règle ne montre rien, elle dit la
  forme). Dans les deux cas : remesurer depuis un bac à sable (dès le 1er déc.) avant de toucher la règle.
- Lire les CGU de mondialrelay.fr quand le réseau le permet (la route est utilisée par le serveur depuis le 24 oct.).
- Un colis Mondial Relay dont le serveur n'a pas le code postal (`cp-inconnu`) n'est pas lu ⇒ pas d'horaires.

Geste de Julien : aucun.
