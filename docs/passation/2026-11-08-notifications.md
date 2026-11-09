# De belles notifications, et seulement celles qui servent (8 nov. 2026)

Branche `claude/notifications` (depuis `origin/main`). Demande de Julien (8 nov.) : « Fais de
belles notifications, là elles ne sont pas très belles et pas forcément utiles, des fois des
infos qui servent à rien. » Il vend depuis l'iPhone (PWA vrm.center) et l'ordinateur ; des
vendeurs payants arrivent.

Aucune fonction `api/` de plus (12/12), aucune migration, **rien changé dans l'extension**
(elle n'envoie aucune notification : pas de permission `notifications`, aucun
`chrome.notifications` — vérifié). Les e-mails ne sont pas touchés (chantier
`claude/mails-envoyes`). La famille « Nouveau compte relié » (`claude/compte-relie`) n'existe
pas encore ici : elle tombera dans « Rappels » ou sa propre famille ; rien à prévoir de plus
que d'ajouter sa catégorie à `FAMILLE_DE` (et, si elle doit se regrouper, un genre dans
`GENRES`).

## 1. Mesurer la vraie base — pas possible ici

L'outil SQL de cette session ne voit pas le projet VRM (un seul projet listé, « mes-sejours ») ;
la clé publique du dépôt lit `push_journal` vide (RLS). **Aucun chiffre réel neuf** : l'« avant »
est la mesure du 3 nov. (`docs/passation/notifications.md` §1 : `push_dedup` et `email_journal`,
14 jours). Pour mesurer l'« après » sur sa base (lecture seule, sans rien copier dans le dépôt) :

```sql
select e->>'famille' famille, e->>'etat' etat, (e->>'at')::date jour, count(*)
from app_data, jsonb_array_elements(data->'entrees') e
where id = 'push_journal' and owner = '<son uid>'
group by 1,2,3 order by 3 desc, 4 desc;
```

## 2. Inventaire (toutes les voies qui sonnent)

| voie | où | ce qui change |
|---|---|---|
| Push serveur (Web Push) | `api/_lib/push.js` `sendPushToAll` — TOUTES les routes passent par là : `api/email-inbound.js` (vente, Vestiaire, bordereau, argent, offre, message, annulation, à confirmer, perdu, retour, arrivée, double vente, Leboncoin supprimé), `api/ship-reminders.js` (matin : colis à poster, dernier jour de retrait, offres au mini, URSSAF, bilan, compte pas relu, capture ; soir : demain N colis ; réveil), `api/_lib/transporteurs-notif.js`, `api/_lib/suivi-vinted.js`, `api/_lib/favoris.js`, `api/compte.js` (alertes de plantage), `api/push.js` (essai) | forme commune, regroupement, heures calmes par défaut, badge, actions, photo prouvée |
| Notifications LOCALES de l'app | `src/App.jsx` `pushNotif` (à l'ouverture : « Vinted : N ventes · N messages » ; « Vente comptabilisée » / « Nouvelle facture ») | doublons du serveur : ne sonnent plus que sur un appareil NON abonné, app en arrière-plan ; la facture ne sonne plus |
| Extension | `vinted-sync-extension/` | aucune notification système (rien à faire) |
| Cloche (centre) | `src/CentreNotifs.jsx`, `src/journalNotifs.js` | même texte, même regroupement, icône de famille, heure relative, geste |
| Toasts | confirmations d'un geste à l'écran | inchangés (ce ne sont pas des notifications) |

## 3. Le tri — gardée / fusionnée / retirée

Gardé = demande un geste ou protège d'une erreur. Rien de ce que Julien a demandé ne disparaît
(cherché dans `docs/passation/historique-*.md` : « argent reçu » et « messages aux favoris »
gardés ; les retraits du 3 nov. restent retirés).

| notification | décision | pourquoi |
|---|---|---|
| Vendu (Vinted, Vestiaire) | **gardée**, regroupée « N ventes » ; photo de l'article quand l'e-mail de CETTE vente la porte | geste : préparer le colis |
| Double vente | **gardée**, jamais regroupée, sonne la nuit | le seul cas où attendre coûte une paire |
| Bordereau prêt à imprimer | **gardée**, regroupée « N bordereaux prêts à imprimer », action « Imprimer » | geste + échéance |
| Rappel du matin (colis à poster), veille au soir | **gardées** | geste + échéance |
| Arrivée au point (code de retrait) | **gardée**, regroupée « N colis t'attendent », action « Voir le code » | geste + code |
| Dernier jour de retrait | **gardée**, jamais regroupée ; sonne la nuit si la limite tombe avant 10 h (`echeance`) | expire |
| Colis reparti / a quitté le point / problème / statut inconnu | **gardées** (textes refaits : le fait d'abord) | évite un déplacement inutile |
| Offre reçue, offre au-dessus du prix mini | **gardées**, regroupées « N offres à trancher » | geste |
| Message, annulation demandée, à confirmer, colis peut-être perdu | **gardées**, messages regroupés « N nouveaux messages » | geste |
| URSSAF, bilan de la semaine, compte pas relu, compte qui n'arrive plus, Leboncoin a supprimé | **gardées** (Rappels) | geste, une fois |
| Argent reçu | **gardée** (sa règle « on sonne pour l'argent »), regroupée « N versements reçus » | sa demande |
| Messages aux favoris : file finie SANS souci | **sans sonnerie** (rangée dans la cloche, état « Sans sonnerie ») | il l'a lancée lui-même, rien à faire |
| … file interrompue, ou messages à vérifier, ou mode auto bloqué | **gardées** | geste |
| Veille des plantages / lenteurs (au propriétaire, ~6 h) | **gardée** mais catégorie `signalement` : rangée dans sa cloche, soumise aux heures calmes ; titre « Un écran a planté » au lieu de « VRM » | même info qu'avant, sans réveiller |
| Alerte de plantage groupée (1/h, propriétaire) | **gardée**, titre « Un écran est tombé chez des vendeurs » | geste (ouvrir Sécurité des données) |
| Locale « Vinted : N ventes · N messages » à l'ouverture | **fusionnée** dans le push du serveur (ne sonne que sans abonnement, app en arrière-plan) | doublon du même fait |
| Locale « Vente comptabilisée » | **fusionnée** de même (« Nouvelle vente ») | doublon |
| Locale « Nouvelle facture » | **retirée** (le bandeau de l'app la dit) | aucun geste |
| Suivi « en transit / en route / livré / retiré », « Achat confirmé », « Nouveau favori », agent eBay | **restent retirées** (3 et 5 nov., `CATEGORIES_RETIREES`) | bruit |
| Rappel des messages sans réponse 24 h, rappel d'évaluation, « argent bloqué », « achat jamais arrivé » | **n'existent pas** (refus du 11 oct.) — `audit-notifs-belles` X2/X3 l'exige | refus §3 |

## 4. Ce qui a été fait

1. **Une forme pour tout** (`api/_lib/notif-belle.js`, appliquée dans `sendPushToAll`, donc à
   toutes les voies et à ce que la cloche range) : aucun emoji ; titre ≤ 40 caractères ; un
   titre trop long est coupé sur son séparateur (« · », « — », « : » si ce qui précède est déjà
   un fait), la suite descend dans le corps — rien n'est perdu (« N°124 vendu sur Vinted » /
   « Encore en ligne sur Leboncoin · Nike… »). Textes des fabriques refaits (le fait, puis
   l'objet, le geste, l'échéance) : `api/_lib/notif-apercus.js` (vendu « Vendu · 65,00 € »,
   argent « 61,20 € reçus », bordereau « … à déposer avant le 12/11 », offre « Offre de 55 € »,
   message « Message de <pseudo> », annulation), `texteArrivee` (un article long descend dans le
   corps), transporteurs (« Ton colis a quitté le point relais », « Ton colis repart chez
   l'expéditeur », « Problème sur ton colis Chronopost »), plantages.
2. **Regroupement par genre, allumé par défaut** (`push_prefs.regrouper`, un `false` posé est
   gardé) : le genre se lit sur l'étiquette que chaque émetteur pose déjà par objet (`bord-`,
   `sale-`/`vc-vente-`, `final-`, `relais-`/`retrait-code-`, `offer-`, `msg-`). Seule, une
   notification garde l'étiquette de SON objet (et son écran) ; dès qu'une autre du même genre
   attend (non lue, 24 h, dans la cloche), la nouvelle pose `tagGroupe: vrm-<genre>`, dit
   « 3 bordereaux prêts à imprimer » / « Dernier : … », ouvre la LISTE, et le service worker
   ferme les autres du même genre. `lu` illisible ⇒ aucun nombre inventé. `renotify` seulement
   pour un fait nouveau (`maj: true` = mise à jour sans re-sonner).
3. **Heures calmes ALLUMÉES par défaut, 22 h → 8 h (Paris)** (`CALME_DEFAUT.actif = true` ; un
   `actif: false` posé est gardé). Sonnent quand même : la double vente, et tout ce qui porte
   une `echeance` qui tombe avant 10 h le matin (dernier jour d'un retrait avant 10 h). Le
   reste est rangé « Heures calmes » ; au réveil (`?moment=reveil`, GitHub toutes les 30 min
   le matin) : UNE gardée ⇒ elle sonne telle quelle (son titre, son écran) ; plusieurs ⇒
   « Cette nuit : 3 notifications » + le détail par famille.
4. **Icône v5 + badge monochrome** (`public/vrm-badge-96.png`, « VRM » blanc sur transparent,
   tiré de l'icône v5) ; **actions** (Android/Chrome/Edge — iOS les ignore) : « Imprimer »,
   « Voir le code », « Répondre », « Retirer l'annonce », « Déclarer »… qui ouvrent le même
   écran que le toucher ; une adresse hors de l'app n'est jamais ouverte.
5. **Photo** seulement prouvée : la photo de l'article dans l'e-mail de CETTE vente
   (`photoVenteEmail`, serveurs d'images de Vinted), `{ url, preuve: 'meme-email' }` ; une
   `image` posée nue, une photo d'une autre source ou « par titre » ne part pas ; un groupe ne
   porte la photo d'aucune.
6. **`discret`** : rangée dans la cloche (« Sans sonnerie »), ne sonne pas.
7. **Paramètres → Notifications** : aperçus passés par la même mise en forme ; « Heures
   calmes » dit « sauf la double vente et ce qui expire avant 10 h ; au réveil, une seule
   notification » ; « Regrouper » montre l'exemple « 3 bordereaux prêts à imprimer ».
8. **La cloche** : icône de la famille (point bleu du non-lu posé dessus), « Il y a 5 min »,
   le geste sous la ligne (« Voir le code », « Répondre »…), et le MÊME regroupement : les
   entrées d'un genre le même jour = une ligne « 2 bordereaux prêts à imprimer », dépliable.
   Les entrées d'avant le 8 nov. perdent leurs emoji à l'affichage.
9. **Alertes locales** (`alerteLocale`, `src/App.jsx`) : jamais au premier plan, jamais sur un
   appareil abonné au serveur (ni quand l'abonnement est illisible).

## 5. Avant / après (par jour, pour Julien)

Pas de mesure neuve possible (§1). Ce que le code change, mécaniquement :
- la nuit (22 h → 8 h) : 0 sonnerie au lieu de chacune (sauf double vente / limite < 10 h),
  puis 1 au réveil ;
- 3 bordereaux du même matin : 1 notification affichée au lieu de 3 (idem ventes, codes,
  offres, messages, versements) ;
- à l'ouverture de l'app : 0 notification locale en double (avant : 1 « Vinted : … » + 1
  « Vente comptabilisée » pour des ventes déjà sonnées par le serveur) ;
- file de favoris finie sans souci : 0 au lieu de 1 ; « Nouvelle facture » : 0 au lieu de 1.

## 6. Preuves

| preuve | résultat |
|---|---|
| `scripts/audit-notifs-belles.cjs` — EXÉCUTE `sendPushToAll`, `resumeReveil`, la cloche (`src/journalNotifs.js`) et le VRAI `public/sw.js` (machine virtuelle) ; horloge de Paris simulée (`VRM_NOTIF_HORLOGE`) | **41/41** ; sur `origin/main` (`--sur`) **25 rouges** (37 contrôles d'alors) ; 6 mutations ⇒ rouges : regroupement éteint par défaut (4), heures calmes éteintes par défaut (5), photo sans preuve (1), échéance < 10 h ignorée (1), emoji gardés (7), toucher qui ouvre l'accueil (1) |
| `scripts/bancs/notifs-apercus.cjs` — vraies fabriques + vraie mise en forme, dessinées façon iOS / Android / macOS | 30/30 ; capture `apercus-notifications.png` regardée |
| banc `centre-notifs` (390 tactile / 1512, clair / sombre ; F3/F4 remis : heures calmes allumées par défaut, le toucher les coupe) | **98/98**, captures regardées |
| bancs `retrait-conv-push` 15, `colis-relais-push` 14, `offres-mini-push` 11, `double-vente-push` 29, `notif-messages` 38, `emails-action` 14, `agent-ebay-push` 16, `cible-evidence` (vert au 2e passage ; le 1er : un « à chaud » rouge, chemin non touché) | verts |
| rouges IDENTIQUES sur `origin/main` (pas de ce chantier) | `rappel-soir` 9 (HTTP 503 de sa fausse base), `bilan-semaine` 21, `reglages` 6, `reglages-premium` 4 (import des e-mails, bilan du mois) |
| `suivi-colis` (banc) | 1 rouge « K : `panel_colis_relais` illisible ⇒ aucune publication » — écran Colis/widget, pas les notifications ; non comparé à `main` (l'arbre de `main` n'a pas servi la page dans ce conteneur) |
| audits voisins | `audit-statut-transporteurs`, `audit-rappel-urssaf`, `audit-double-vente(-ailleurs)`, `audit-suivi-colis`, `audit-suivi-vinted`, `audit-colis-heure`, `audit-signalement`, `audit-aide-signalement`, `audit-lbc-suppression`, `audit-sans-bruit`, `audit-vapid`, `audit-push`, `audit-variables`, `audit-tdz`, `audit-icones`, `audit-boutons`, `audit-violet`, `audit-coherence`, `audit-fonctions-api`, `audit-identite`, `audit-confiance`, `audit-premieres-minutes` : verts |
| audits remis à la règle (sans emoji, regroupement par genre, heures calmes par défaut) | `audit-notifications` 31/31, `audit-notifs-centre` 28/28, `audit-reveil-calme` 13/13, `audit-transp-notif`, `audit-compte-pas-relu` 51/51, `audit-veille-plantages` 32/32, `audit-cibles-notif` |
| `npm run build` | vert |

⚠️ **Heures calmes allumées par défaut ⇒ les bancs** : un banc qui juge autre chose (« une
arrivée sonne une fois ») aurait été vert le jour et rouge la nuit. `scripts/_horloge-notif.cjs`
(une ligne en tête des 113 bancs/audits qui touchent un envoi) fixe à midi (Paris) l'instant qui
décide des heures calmes — lu par `api/_lib/push.js` (`VRM_NOTIF_HORLOGE`), jamais posé en
production. Un banc qui juge les heures calmes pose lui-même l'heure.

## 7. Gestes de Julien

Aucun. Les heures calmes et le regroupement s'appliquent tout seuls ; il peut les couper dans
Paramètres → Notifications (son choix est gardé). Les notifications d'avant restent dans la
cloche (sans emoji à l'affichage).
