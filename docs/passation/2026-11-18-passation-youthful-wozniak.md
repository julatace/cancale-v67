# Passation — session youthful-wozniak (17–18 nov. 2026)

À lire par la session qui reprend. Court exprès : le détail de chaque lot est dans son
`docs/passation/2026-11-17-*.md` / `2026-11-18-*.md` (sur sa branche ou sur main).

## 1. Ce que Julien veut (ses mots, 17–18 nov.)
- « Tout est moche, tout doit être revu », « fais un truc incroyable », « parfait, simple, original ».
- « Tout est lent, c'est une cata » (onglets, données, ouverture d'une vente).
- Pas de messages dans l'app : coucou sans texte → Discord.
- Il envoie des captures iPhone : chaque capture = un défaut à corriger EN PRIORITÉ.

## 2. Décisions prises (à ne pas renégocier)
- **Republication** : ordre réel **coffre → brouillon → suppression → en ligne** (5.277, 29 oct.), **reconfirmé par Julien le 17 nov.** Ne pas inverser. (La ligne §3 de CLAUDE.md est corrigée dans #1257.)
- **Barre d'onglets** : style **C « Épurée »** par défaut ; menu Paramètres → Apparence → « Barre d'onglets » (A, B, C, D, E) ; plus de « + » nulle part.
- **Nouveau design « Studio Premium » allumé par défaut** (#1246) ; « Ancien design » dans Apparence.
- **Signature** : étiquette N° kraft, chiffre d'affiche, ticket de retrait, rangée « faite ». Échelle d'espacement « AIR » (cartes ≥ 20 px, rangées ≥ 64, 32 entre sections).
- **Annonces** : affichage « Liste » (A, défaut) ou « Détaillé » (C) dans « ⋯ ».
- **« Créé par vrm.center »** : juste au-dessus du QR, jamais dessous/à côté, **ne s'enlève plus** (#1259, en ligne).
- **Achats annulés** cachés par défaut, filtre « Annulés · N ».
- **Relier** : un achat relié n'est plus proposé ; onglet « Déjà reliés » ; lots de N articles ; prix d'un lot jamais partagé tout seul.
- **Favoris (ext)** : liste à cocher, N° + « mini X € » à côté, 15/h, reprise après captcha sur SON toucher.
- **Coucou** : sans texte, limites 1/paire/24 h et 20/jour ; carte de la Communauté sans messagerie (#1262).
- Brief design complet : scratchpad `brief-design-final.md` (copié ci-dessous §7 si le scratchpad a disparu : règles AIR, QUALITÉ, SIGNATURE).

## 3. En ligne (17–18 nov.)
#1239 scanner bordereau · #1242 suivi multi-transporteurs (ext 5.403) · #1243 taille des achats ·
#1244 accessibilité · #1245 vitesse 1 · #1247 extension 5.406 (carte + écran d'action) ·
#1248 scan instantané · #1250 onglets rapides · #1259 tampon au-dessus du QR ·
#1260 e-mails dans 5 langues · #1246 **nouveau design** (6f4bb2dde) · #1261 app plus légère.

## 4. Pas encore en ligne — le TRAIN de fusion (agent dédié)
Ordre : **#1249 Stock → #1252 bugs → #1258 Ventes v2** → #1254 Argent+Paramètres → #1263 Messages+E-mails
→ #1255 Relier → #1256 groupes → #1262 carte coucou → #1251 ext 5.407 → #1257 ext 5.408.
Règle : vrai merge de main, aucun rouge NOUVEAU vs main (CI partielle acceptée si les jobs finis = main),
`gh api …/pulls/N/merge -X PUT -f merge_method=merge`, Vercel READY, note « en ligne » sur `claude/coordination`.
Rouges connus de main (pas à corriger dans un lot) : vocabulaire-article, vendeur-generaliste, notifs-redaction,
retraits-fiables, atelier (depuis #1260), nouveau-vendeur, accessibilite-clavier (3), annonces-actions,
chiffres-coherents, colis-retirer-propre, iphone-reprise, retraits-suivi ; bancs 2/3 dépasse 45 min ; WebKit 7.
**Runners GitHub saturés** : 1 à 2 h de file par CI.

## 5. Chantiers en cours (branches)
- **Vitesse — moteur** (`claude/moteur-rapide`, PR #1265/#1266, + #1253, #1264) : le vrai problème est le CALCUL
  (Comptabilite rendue 15–22 fois avant « prêt », écran vrai 9–11 s au ×4 ; lectures 80 ms). Plan : tuiles en
  composants mémorisés → version unique des données + mémo → Web Worker → `:has()` remplacés. Preuve par
  `audit-magasin-groupe` (les bancs d'écran ne voient pas une prévenance perdue). Récits : `2026-11-17-cache-onglets.md`,
  `2026-11-18-rendus-groupes.md`.
- **Design v2 suite** (`claude/design-v2-suite`) : finitions de l'audit visuel + `scripts/audit-visuel-v2.cjs`
  (19 règles) ; fusionner APRÈS le train.
- Rapport d'audit visuel : scratchpad `audit-visuel.md` (34 constats ; « absolument » faits).

## 6. Gestes de Julien (à lui rappeler)
1. Installer l'extension **5.406** maintenant ; puis **5.407** et **5.408** quand elles sont en ligne.
2. Premier essai de republication : UNE paire, onglet vinted.fr ouvert 4 min, puis dire « j'ai fait l'essai »
   (trace de forme `repub_trace_*`) ; seulement après, les 5 paires bloquées via « Brouillons à refaire ».
3. Supabase : appliquer **046** (coucous) puis **047** (carte), notices « ESSAI OK ».
4. Supabase → Authentication → Templates : recoller les 6 modèles `supabase/templates/*.html` + `sujets.json`.
5. Lien Discord du groupe (Inviter) + relier son Discord (Paramètres → Mon compte).
6. Anciens gestes toujours dus : sauvegarde (`SUPABASE_DB_URL`, `SAUVEGARDE_PHRASE`), Stripe + `editeur.js`,
   `RELANCES_SMTP_*`, migrations 016/042/043, retirer `LAPOSTE_OKAPI_KEY`/`UPS_*`.

## 7. Questions ouvertes à Julien
- Espace formateur (032, pas appliquée) : ses « annonces » au groupe sont des messages à sens unique — garder, ou Discord aussi ?
- UXKIN (exemples d'apps iPhone pour ui-compare) : bloqué par le réseau ; il faudrait un abonnement à son nom + ouvrir l'hôte.
- Autoriser l'annulation des runs CI (refusée par la sécurité automatique) pour accélérer la file ?

## 8. Méthode qui a marché / à garder
- Regarder CHAQUE planche avant de l'envoyer ; renvoyer les défauts à l'agent avant de la montrer.
- Un seul agent fusionne (train) ; geler les autres fusions quand une grosse PR est en cours (sinon « dirty » en boucle).
- Disque serré (~4 Go) : supprimer les worktrees finis (`git worktree remove`, un par un).
- Limites d'usage : tous les agents s'arrêtent ensemble ; les relancer un par un par SendMessage après la remise à zéro.
