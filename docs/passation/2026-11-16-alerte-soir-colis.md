# 16 nov. — L'alerte du soir, une fois par colis (lot `alerte-soir-colis`)

Mission : `docs/passation/file-attente-16nov/5-alerte-soir.md` (validée ; « rappel la veille au soir » retenu le 11 oct.).

## Ce qui existait (vérifié avant de coder — rien n'est dupliqué)
- Le résumé du soir (10 nov., lot AT : `api/_lib/resume-soir.js`, `api/ship-reminders.js?moment=soir`) : UNE
  notification par soir et par vendeur (mémo `soir_reminder_dedup` écrit avant l'envoi), catégorie `soir`
  coupable dans Paramètres → Notifications, heure réglable 18–22 h (`push_prefs.soirHeure`, passage horaire
  GitHub), heures calmes tenues par `sendPushToAll`, rien si rien demain, toucher ⇒ Ventes · À envoyer
  (colonne « Prêts »), date limite LUE (e-mail du bordereau ; vente + 7 j = estimation, jamais « en retard »).
- Ce qui manquait : il comptait en NOMBRES ⇒ un colis en retard revenait CHAQUE soir ; aucun N° ; défaut = le
  cron de Vercel (18:00 UTC = 20 h l'été, 19 h l'hiver).

## Ce qui change
- `api/_lib/soir-colis.js` (pur) : chaque colis par identité (Vinted `v:<transaction>`, eBay `e:<commande>`),
  classé `demain` (limite lue demain) / `retard` / `verifier` (estimée passée) — la même classe que
  `compterEcheances`. **Un colis déjà dit un soir précédent n'est pas redit, sauf si sa limite est le
  lendemain** (mémo `colis` dans `soir_reminder_dedup`, 21 jours). Vestiaire reste compté en nombres
  (pas d'identité de colis côté serveur ici) — un retard Vestiaire peut donc revenir : à reprendre si besoin.
- N° dans le corps, **par identité seulement** : transaction → `meta->>item_id` du détail lu → 
  `vinted_annonce_numeros[item].numero` (projection article par article, jamais `main` entière). Le n° lu
  dans le titre d'un e-mail n'est PAS utilisé. Pas su ⇒ pas de N°. Ex. : « 1 avant 23 h 59 : N°215 · 1 déjà
  en retard : N°193 » (3 N° au plus, corps > 90 ⇒ redit sans N°).
- Défaut **19 h, heure de Paris** : sans heure choisie, le passage horaire sert à 19 h ; le cron de Vercel
  reste le filet (le mémo du jour fait qu'un seul part).
- Formulation gardée : « Demain : N colis à déposer » (texte validé du lot AT) ; le mot « poster » de la mission
  n'a pas été recopié pour ne pas changer un texte déjà validé.

## Preuves
- Banc `rappel-soir` (vraie route, faux temps, faux Web Push) : 44/44. Sur `origin/main` : 5 rouges.
- Mutations (copie) : filtre « déjà dit » retiré ⇒ rouge ; exception « limite demain » retirée ⇒ rouge ;
  défaut 19 h retiré ⇒ rouge.

## ÉTAT À LA REPRISE
Fini, PR ouverte (voir le rapport). Reste possible : identité des colis Vestiaire pour ne pas les redire.
Geste de Julien : aucun.
