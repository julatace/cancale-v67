# 20 nov. — Chasse aux bugs (branche `claude/chasse-bugs`)

Julien : « regarde tous les bugs que tu peux corriger ». Sources, dans l'ordre : production (lecture seule), les 739
audits, les bancs d'états (base vide, lectures en panne, hors ligne), l'extension 5.409 (aucun changement d'extension).

## Production (20 nov., lecture seule)
- Vercel : aucune erreur d'exécution sur 3 jours (le plan Hobby ne garde qu'une heure de journaux).
- Plantages remontés par l'app : le dernier date du 16 nov. (CSP `connect-src` d'un QR p.vintedgo.com / pickup-services.com,
  déjà corrigé le 17 par `qrLisibleParLaPage`) ; rien depuis le train du 19.
- `ext_appareil_*` : aucun `diag` (la 5.409, qui le publie, n'est installée nulle part : Chrome 5.408, 5.406, 5.400, Orion 5.377).
- Aucune ligne `*forme_inconnue*`.

## Défauts corrigés (contrôle rouge avant, vert après)
| défaut | où | cause | correctif | preuve |
|---|---|---|---|---|
| date limite d'un retrait perdue / fausse quand l'e-mail est traité plus tard (rejeu 503, script relancé, reclassement) | `api/email-inbound.js` | une date SANS année se lisait au jour du TRAITEMENT | `jourPourLireDates` : le jour de l'e-mail (`sourceDate`), jamais dans le futur | audit-retraits-fiables (rouge avant) |
| « d'ici le 16 nov. » lu le 20 ⇒ 16 nov. **2027** | `src/litiges.js` `limiteDuJour` | toute date passée de > 2 j sautait d'un an | l'année la plus proche de la réception | audit-retours-emails E2 (rouge avant) |
| « 8 offres à trancher » ne se regroupait plus | `api/_lib/push.js` | non-lues comptées sur `Date.now()`, l'entrée datée par l'horloge de la notification | la même horloge (`t`) | audit-notifs-redaction (5 rouges avant) |
| scènes de la page d'accueil : ReferenceError (latent : composants plus montés depuis le 8 nov.) | `src/accueil-mouvement.js` | `export { x } from` ne crée pas de nom local | import puis ré-export | nouvel **audit-portee-modules** (Babel, toute l'app/api/extension ; rouge avant, `--prouve`) |
| lecture `capte_journal_*` partie porte de confidentialité FERMÉE | `src/App.jsx` (FeuilleArrivee montée hors des portes) | `pret` toujours vrai | lecture refusée (« pas su ») tant que `_confidentialiteUid` ≠ l'utilisateur ; relue au `onCloudReady` | banc hors-ligne-froid : 12 rouges → 0 |
| Ma journée, lectures en panne : « Messages · 0 · Aucun message non lu », « Prix à baisser 0 » | `src/App.jsx` tuiles | `[]` + `error` pris pour une réponse | `pasSu` aussi sur `error` sans liste | banc etats-vides P (rouge avant) |
| « Bénéfice · mois : lecture… » sans fin, base en panne | `src/App.jsx` `usePreparation` | la borne de 8 s ne partait que d'une liste ARRIVÉE | elle part aussi d'une lecture ratée | banc etats-vides P 1512 |
| Annonces natif, lecture ratée : « Aucune annonce en ligne lue » | `src/natif/ecrans/Annonces.jsx` | le vide l'emportait sur `manque` | « VRM n'a pas pu lire tes annonces » | banc etats-vides P Annonces |
| « Publier sur… » : un morceau qui rate après une mise en ligne ⇒ « Cet écran a un souci » | `src/ecrans/AnnoncesEgalite.jsx` | `React.lazy` nu | `lazySur` | audit-ouverture (rouge avant) |
| « À écrire sur tes cartons » sans garde-fou (un plantage emportait le Stock) | `src/App.jsx` | monté hors `GardeEcran` | sous son garde-fou | audit-garde-ecrans |
| signalement depuis Extension / Automatisations parti sans écran | `api/_lib/signalement.js` | écrans du 19 nov. absents de `ECRANS` | ajoutés | audit-signalement |
| base d'essai neuve : 048 échoue | `supabase/essai/avant-048-capacite-3000.sql` | `sauvegarde.journal_ecritures` créée à la main sur la vraie base | pont (colonnes relevées sur la vraie base) | audit-base-essai 4 rouges → 0 |
| rouge du Stock en meubles lu par une règle « double » | `src/stockV2/*` | nom d'état | `doublon` | audit-rouge-doublon |

## Audits périmés remis sur la RÈGLE (aucun contrôle de sûreté affaibli)
`_source-app` (écrans écrits à la main : `export default`, imports paresseux entre écrans — ~10 audits ne se lisaient plus),
offres-auto + confiance-publique (le passage tourne aussi pour les paliers 5.409 : accepter reste sous `reg.actif`, UN chemin,
prouvé par mutation), enligne (depuis la 5.409, le suivi prioritaire laissait 4 lectures : les contrôles « rien rangé »
passaient À VIDE — décor « suivi noté à 0 » + contrôle B1b de la réserve « pas su »), argent, argent-a-venir, raccourcis,
garde-ecrans, colis-trois, relais-change, retraits-irreprochables, comptes-securite (9e source `prixAttente`), faits-achat,
ecrans-restes, relier-fiable, numeros-nouvelles, repli-retirer, reprise-ecran, coque-parametres, offre-annonce-partie,
annonces-coherence, apparence (nuit #000000), atelier (mail-textes.js), politique-hotes (Discord collé), stockage-sur,
bancs (écran Extension rendu).

## Vus, laissés (à qui)
- **Manifeste et écran de démarrage** encore bleus (#174C88 / #2563A8, dégradé « Verre dépoli ») alors que l'app est grise/noire
  (audit-ouverture, 4 rouges) → chantier demarrage-store.
- **Ventes · eBay sans compte** : écran blanc (titre seul), à 390 et 1512 ; Ventes vide à 1512 sans geste (banc etats-vides V)
  → chantier Ventes natif.
- **Vocabulaire** : « carton » (Stock « À écrire sur tes cartons », liaison, égalité, étiquetage) et « paire » hors Sneakers
  (audit-config-facture, -vendeur-generaliste, -vocabulaire-article) → à trancher avec Julien (décision du 9-11 nov. vs textes du 19).
- **Extension** : `->${owner}` nu dans `automatisationsCarte` (audit-chemin-json-guillemets) — inoffensif pour un uuid d'après
  la grammaire PostgREST, mais demande une 5.410 : à grouper au prochain lot d'extension.
- **Bancs périmés** : hors-ligne (sert `/api/*` = `{}` ⇒ l'abonnement n'est jamais su ⇒ la porte hors ligne reste fermée :
  le banc doit servir `mode=abonnement`), hors-ligne-froid D (« l'écran de connexion est là » sans session hors ligne),
  reseau-instable (2 requêtes vers la vraie base comptées par la garde réseau).
- Pastille Messages = « À régler » publié (`nMsgRegler`) : ne suit peut-être pas « retirer la conversation » sans republication.
- Paliers d'Automatisations : vider le champ pose 1 aussitôt (on ne peut pas taper « 5 » seul après l'avoir vidé).
