# Ouverture aux clients — paiement, RGPD, aide (12 nov., second agent)

Branche `claude/agent2-ouverture-clients` (partie d'`origin/main` 184f46c2f). Validé
par Julien (« indispensable ») : lots 5, 6, 7, 8. Pas d'extension. Aucune fonction
`api/` de plus (deux modes ajoutés à `api/compte.js`).

## 5. Tout ce qui bloque le paiement — « Ouvrir les paiements »

- `api/_lib/ouverture-paiements.js` : pour le **propriétaire seul**, la route
  `mode=abonnement` rend `ouverture` : clé Stripe (et son mode test/réel), secret du
  webhook (`whsec_`), le webhook **relu chez Stripe** (`webhook_endpoints` : adresse
  vrm.center, activé, les 5 événements `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`, `invoice.paid` — un manquant est
  NOMMÉ), prix Solo et Pro (les règles existantes `prixConforme` / `offrePro`, prix
  LU chez Stripe s'il diffère), mentions (`mentionsManquantes`), contact
  (`src/contact.js` = champ `email` d'`editeur.js`). Trois états : ok · manque ·
  pas-su ; « pas su » n'est jamais ✓.
- `src/ouverturePaiements.js` (règle de l'app) ajoute les CGV relues
  (`/legal/cgv.html` : 16,99 €, 19,99 €, parrainage, rétractation, essai) et
  l'accueil (`PRO_OUVERT`). `src/composants/OuvrirPaiements.jsx` : Réglages →
  « Ouvrir les paiements » (propriétaire seul), 10 lignes ✓ / À faire / —, jauge,
  « N sur 10 prêts », toucher une ligne = où cliquer, « Revérifier ». Aucune écriture.
- Guide ultra détaillé : `docs/passation/2026-11-12-guide-paiement-julien.md`.
- **Mesuré le 12 nov. (lecture seule)** : `editeur.js` 9 champs vides sur 10 ;
  contact rempli ; CGV à jour ; Vercel : `STRIPE_SECRET_KEY` **absente**,
  `STRIPE_PRIX_PRO` **absente**, `STRIPE_WEBHOOK_SECRET` présente (webhook de test),
  `STRIPE_PRICE_LOOKUP=vrm_mensuel` ; base : `abonnement_obligatoire`=0, `parrainage`=1.
- Audit `audit-ouverture-paiements` : 29 verts, 7/7 mutations, 22 rouges sur
  origin/main.

## 6. Test complet du paiement — Stripe simulé

- `scripts/_monde-paiement.cjs` : un faux Stripe **à état** (prix, clients, cartes à
  empreinte, abonnements, soldes, webhooks déclarés, file des webhooks à envoyer) et
  une fausse base PostgREST (abonnements, essais, parrainage, comptes, `vrm_acces`
  recopiée de 006/027). Aucune vraie clé.
- `scripts/bancs/paiement-bout-en-bout.cjs` : le VRAI `api/compte.js` sert l'app
  (Playwright) ET reçoit les webhooks signés. E1 inscription (essai proposé) → E2 l'app
  coche CGV + accès immédiat, ouvre la vraie session (prix Solo, essai 7 j, dates),
  « 4242 », webhooks ⇒ « Encore 7 jours d'essai » → E3 premier prélèvement ⇒ « Abonné ·
  16,99 € / mois » → E4 Solo (compte 222 hors offre) / Pro 19,99 € (illimité) → E5
  parrainage (lien, rien sur l'essai à 0 €, −16,99 € aux deux au 1er paiement réel,
  rejeu sans doublon, y compris « crédité chez Stripe mais pas noté en base ») → E6
  résiliation en 2 clics, accès jusqu'à fin de période → E7 fin ⇒ aperçu (3 lignes
  nettes, reste flouté, `inert`, aucune écriture, rien supprimé). 390/1512, clair/sombre.
  **42 verts**, 1 ⏸ : « même carte refusée » (`memeCarte`) vit sur
  `claude/agent2-argent-parrainage`, pas encore sur main — le contrôle s'allume seul
  quand elle arrive. `--prouve` (partie route) : 6/6 mutations.
  Les modes non-argent de `/api/compte` (confidentialité…) sont servis `{ok:true}`
  (ils ont leurs bancs).
- **Défaut trouvé et corrigé** : abonnement obligatoire + compte NEUF (jamais abonné)
  ⇒ l'app disait « Ton abonnement a pris fin » et ne proposait pas l'essai.
  `etatAbonnement` rend désormais `sans` + `nouveau` (l'offre et l'essai), la carte de
  l'aperçu dit « Bienvenue sur VRM · Voir l'offre », la ligne de statut de Réglages dit
  « Sans abonnement : rien n'est enregistré pour l'instant ».

## 7. RGPD

- (a) **Export complet côté serveur** : `GET /api/compte?mode=mes-donnees&suite=…`
  (`api/_lib/export-rgpd.js`), pour le compte de SA session (jeton vérifié), chaque
  lecture `owner=eq.<lui>`, page par page (< 1,6 Mo par réponse, une ligne énorme part
  en morceaux et se recolle), lecture ratée ⇒ 503. Part : toutes ses lignes `app_data`
  (champs de jeton retirés), résumé des lignes lourdes (PDF, pièces jointes,
  transactions brutes), comptes de revente (sans jetons), abonnement, parrainage EN
  NOMBRES, adresses prouvées, signalements envoyés (sans `de`), e-mail de connexion,
  LISEZMOI. `src/exportRgpd.js` assemble ; « Exporter mes données » met tout dans le
  même zip (tableaux CSV + dossier `VRM-mes-donnees-AAAA-MM-JJ/`), ouvert sans
  abonnement, « INCOMPLET.txt » si une page rate. Audit `audit-export-rgpd` : 25 verts,
  8/8 mutations, rouge sur origin/main.
- (b) **Suppression** : existait déjà (9 nov., `?mode=supprimer`, confirmation forte,
  abonnement Stripe annulé, auth supprimée, factures Pro gardées 10 ans) et
  `audit-supprimer-compte` l'EXÉCUTE sur une base simulée (34 verts, l'autre vendeur
  intact). Rien changé.
- Politique de confidentialité (12 nov.) : l'export dit « toutes tes données », ce qui
  n'y est pas et pourquoi ; suppression et délai d'un mois déjà écrits.

## 8. Aide aux clients

- « Signaler un problème » (Paramètres et « ? ») complété : case **« Réponds-moi par
  e-mail »** décochée par défaut ; cochée, l'adresse de SA SESSION part (jamais du
  corps) et la feuille le dit ; le propriétaire a « Répondre par e-mail » ; « Ou écris
  à <contact> ».
- FAQ : 10 questions de rang 1 à 10 (`faq` dans `src/aideFiches.js`, `faqAide`) —
  prix, extension, relier Vinted, e-mails, colis, factures, résilier, données,
  supprimer, problème — dans chaque « ? » (« Les questions les plus posées ») et dans
  la recherche. Audit `audit-aide-client` : 12 verts, 5/5 mutations.
- Banc `scripts/bancs/ouverture-clients.cjs` (rendu : panneau propriétaire, FAQ,
  Signaler ; 390/1512, clair/sombre ; un vendeur n'a pas l'entrée).

## Gestes de Julien
1. Donner les 9 valeurs d'`editeur.js` (raison sociale, forme, adresse, SIRET,
   immatriculation, TVA, téléphone, directeur de la publication, médiateur) —
   guide §1 ; adhérer à un médiateur de la consommation.
2. Stripe test : créer VRM Solo 16,99 € (`vrm_mensuel`) et VRM Pro 19,99 €
   (`vrm_pro_mensuel`), vérifier les 5 événements du webhook — guide §4.
3. Vercel : `STRIPE_SECRET_KEY`, `STRIPE_PRIX_PRO` (et `STRIPE_WEBHOOK_SECRET` si le
   secret change) → Redeploy — guide §5. Puis Réglages → Ouvrir les paiements →
   Revérifier.
4. Essai complet avec 4242 (guide §6), puis mode réel (guide §7), puis « ouvre Pro
   sur l'accueil », puis, quand il veut, `abonnement_obligatoire` = 1.
5. Faire relire CGV + rétractation par un juriste.
