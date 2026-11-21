# 13 nov. — Le nom de la paire dans les rappels de colis, une notification par colis et par jour (agent2-rappels-paire)

Branche `claude/agent2-rappels-paire`, partie de `claude/agent2-horaires-relais` (e26c9cfe7). Rien écrit en base
(lectures SQL projetées seulement). Fixtures inventées. `vinted-sync-extension/` pas touché ; App.jsx : 4 lignes.

## Mesuré (lecture seule, 13 nov.)
- Les commandes d'achat (`harvest_{uid}_orders_purchased`, `data.payload.my_orders`) portent `transaction_id`
  (nombre), `conversation_id`, `title`, `status`… ; ~72 Ko par compte, 19 lignes en tout.
- Les 46 lignes de suivi Vinted (`harvest_{uid}_suivi_{tx}`) ont toutes leur commande ; seules 3 ont une ligne
  de transaction (`harvest_*_txn_*`) : le titre se lit donc dans la COMMANDE, pas dans la transaction.
- `panel_colis_relais` : ~10 Ko, 49 entrées { code, conv, titre, … } par transaction.

## 1. Le nom de la paire (« Demain dernier jour », « Dernier jour », « t'attend »)
- **Une règle, deux lecteurs** : la jonction colis → achat de l'écran (`commandeDuColis`, src/App.jsx) vit
  maintenant dans `api/_lib/commande-colis.js` (`commandeDuColisRegle`) : conversation de la commande, puis n° de
  suivi (`achatDuColis`, src/liensColis.js — un seul achat candidat, sinon personne), puis code de retrait (deux
  transactions au même code ⇒ personne). L'app l'appelle (la fermeture `commandeDuColis` n'est plus qu'un appel) et
  le serveur aussi : ce n'est pas une copie, c'est le même module (mieux qu'une copie refabriquée : rien à
  resynchroniser). Jamais le titre, le lieu, la date (§5).
- **Cron** (`api/ship-reminders.js`, `retraitsDuJour`) : pour chaque rappel, le titre de l'achat relié par identité,
  sinon l'article de l'e-mail de CE colis, sinon « Colis {transporteur} ». **Aucune lecture de plus** : les commandes
  étaient déjà lues (projection `my_orders`) pour savoir si le colis est fini. `conv` ajouté à `SELECT_SUIVI_META`.
- **Arrivée** (`api/email-inbound.js`, `titreAchatDuColis`) : liens en scalaires (lignes de suivi, n° reliés à la
  main), `panel_colis_relais` seulement s'il y a un code, puis **seulement** les lignes d'achats qui CONTIENNENT la
  transaction candidate (`my_orders=cs.[{"transaction_id":N}]`, projetées) — jamais `select=data`. Lecture ratée ou
  rien de relié ⇒ le texte d'avant (l'article de l'e-mail, sinon « Ton colis {transporteur} t'attend ») : l'arrivée
  sonne toujours, sans nom deviné. La conversation n'est pas utilisée ici (l'e-mail Vinted qui la porte nomme déjà
  l'article).
- Un titre de plus de 40 caractères passe dans le corps (règle de `api/_lib/push.js`, inchangée).

## 2. Le résumé du soir ne redit pas la veille
Forme choisie : **le rappel du matin « 📍 Demain dernier jour » reste** (il est par colis, avec le point et le code) ;
**le résumé du soir saute les colis qui l'ont reçu le jour même** (mémo `colis_retrait_dedup`, clé `demain-{n°}` datée
d'aujourd'hui — l'identité du colis). Si le rappel du matin n'est pas parti (cron sauté, mémo sans la clé), le soir le
dit, une fois. Mémo illisible le soir ⇒ les retraits ne sont pas dits (« pas su » : mieux vaut rien que deux fois),
le cron le rapporte. Résultat : une notification par colis et par jour.

## 3. Banc `scripts/bancs/ventes-colis-premium.cjs`
Il cherchait `[data-ventes-vers-colis]` (lien « À envoyer : Colis › »), rendu sous `false &&` depuis le lot DJ3
(11 nov.) : Colis vit dans Ventes. Remis à la règle actuelle, plus exigeant : aucun filtre « À envoyer », le
récapitulatif ET les cartes des colis à envoyer rendus sur l'écran Ventes, AVANT la liste des ventes, au bon nombre,
chacun une fois (une carte par transaction). 32/0 (390 tactile et 1512), captures regardées.

## Preuves
- `scripts/audit-rappels-paire.cjs` (EXÉCUTE `api/ship-reminders.js` matin et soir, `api/email-inbound.js` ; base à
  état, filtre `cs` servi) : 14/14. **7 rouges sur e26c9cfe7** (branche de départ). `--prouve` : 5/5 mutations rouges
  — nom par ressemblance (achat « au point relais » du même point), nom pas pris, le soir redit la veille (deux
  notifications le même jour), arrivée sans nom, n° ambigu deviné.
- Verts : audits suivi-colis, rappels-colis, identite, variables, tdz, coherence, icones, fonctions-api,
  achat-attend-relais, colis-frequent, litiges, retrait-preuves, retrait-qr, retrait, statuts, vintedgo-adresse,
  notifs-centre, colis-heure, charge-rappels ; bancs notifs-apercus, retirer-un-colis. `npm run build` vert.
- Banc `rappel-soir` : 3 KO **déjà rouges sur e26c9cfe7** (lectures owner, deux libellés « 1 offre Vestiaire ») —
  hors de ce lot, rien changé.

## Restes
- Le nom n'arrive que si l'achat est relié : la 5.372 lit le n° de suivi dans « Détails » ; tant que Julien n'a pas
  repassé sur les conversations, beaucoup de colis restent « Colis {transporteur} ».

Geste de Julien : aucun.
