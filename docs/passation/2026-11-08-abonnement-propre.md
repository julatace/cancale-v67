# 8 novembre 2026 — Abonnement propre (branche `claude/abonnement-propre`)

Julien : « des vendeurs vont payer — fais tout ». Ce qui existait déjà (Stripe en mode test
sans bibliothèque, essai de 7 jours une fois par e-mail et par compte Vinted — 022, CGV
acceptées dans VRM, résiliation et reprise en ligne, factures, portail Stripe, porte
d'abonnement) est gardé ; ce chantier le rend clair, cohérent et complet.

## Les gestes de Julien (Stripe et base), dans l'ordre

1. Supabase → SQL : passer `supabase/migrations/027-abonnement-lecture-et-parrainage.sql` (lecture seule à l'expiration + tables du parrainage ; aucun DROP).
2. Stripe → Paramètres → Billing → **Portail client** : l'activer ; cocher « mettre à jour le moyen de paiement », « historique des factures », « annuler l'abonnement » **en fin de période** ; lien de retour `https://vrm.center/?tab=settings&vue=abonnement`.
3. Stripe → Développeurs → Webhooks (l'adresse `/api/stripe-webhook` déjà posée) : ajouter l'événement **`invoice.paid`** (le parrainage) à côté de `customer.subscription.*` et `checkout.session.completed`.
4. Stripe → Paramètres → Billing → E-mails clients : activer les e-mails de **fin d'essai** (rappel avant la fin) et de **résiliation** s'ils sont proposés (la confirmation écrite d'une résiliation ; VRM la dit à l'écran seulement).
5. Ouvrir le parrainage quand il le décide : `update vrm_reglages set valeur = '1' where cle = 'parrainage';` (éteint par défaut : rien n'est rattaché ni crédité, le vendeur ne voit pas de lien).

Inchangés : prix `vrm_mensuel` à 16,99 €, `STRIPE_SECRET_KEY`, mentions de `public/legal/editeur.js` (tant qu'elles sont vides, le paiement reste fermé, exprès).

## Ce qui est livré

### 1. L'essai, clair
- **Page Abonnement** (Paramètres → Abonnement) : « Encore 5 jours d'essai », une jauge des
  7 jours, « Le 13 novembre, ton abonnement démarre : 16,99 € / mois prélevés sur ta carte,
  sauf si tu résilies avant. Rien n'est prélevé pendant l'essai. » Le montant est celui de SON
  abonnement (`prixAbonnement`, lu chez Stripe) ; pas su ⇒ aucun montant.
- **La ligne de la coque** (`BandeauAbonnement`, App.jsx) : à J-3 et J-1 (et le dernier jour),
  une ligne discrète « Ton essai gratuit se termine dans 3 jours (le 11 novembre) : ensuite
  16,99 € / mois, sauf si tu résilies avant. » — « Gérer » ouvre la page, × la masque pour la
  journée (appareil). Essai résilié : « Rien ne sera prélevé : tu l'as résilié. »
- Le serveur rend `finEssai` (pendant `trialing`, la période en cours EST l'essai) ; aucune
  colonne de plus (une colonne absente aurait fait échouer le webhook avant la migration).
- Une seule règle d'affichage : `src/abonnement/etatAbonnement.js` (`etatAbonnement`,
  `rappelEssai`) — la page, la coque et la porte la lisent.

### 2. L'expiration : les données restent LISIBLES
- **Avant** : 006 (4 oct.) fermait lecture ET écriture (`abonnement_requis for all`), et l'app
  remplaçait tout par la porte. ⚠️ **C'était la décision de Julien du 4 octobre (« ne doit plus
  voir ses données »)** ; ce chantier la remplace sur la demande du 8 nov. relayée par
  l'orchestrateur (« les données restent lisibles, seules les actions demandent
  l'abonnement ») — **à confirmer par Julien**. Revenir en arrière = ne pas passer la 027.
- **027** : `abonnement_requis` garde son WITH CHECK (écrire exige l'accès), son USING devient
  `true` (lire est libre ; les règles d'owner, de confidentialité 021 et d'équipe 016 décident
  toujours qui lit quoi) ; une restrictive DELETE s'ajoute ; `vrm_acces()` dit `lecture: true`.
  Notifications et widget restent coupés (`vrm_acces_pour` inchangé).
- **L'app** : `PorteAbonnement` ne ferme plus l'app quand la base laisse lire ; la garde
  `installerGardeEcriture` refuse toute écriture vers la base (REST, stockage) sans réseau,
  avec `vrm-lecture-seule` et une phrase ; lectures, `rpc/` et `/api/` (le paiement) passent.
  La coque dit « Lecture seule. … tout reste visible, rien n'est supprimé » + « Voir
  l'abonnement » (ou « Mettre à jour ma carte » pour un impayé > 14 j).
- **Sans la 027**, `lecture` est absent : la porte d'avant reste (jamais une app vide).
- Aujourd'hui `abonnement_obligatoire` = '0' : personne n'est coupé, rien ne change en prod.

### 3. La page Abonnement
- Une carte d'en-tête (état · titre · phrase · geste), puis des rangées iOS
  (`GroupeIos`/`RangeeIos`) : « Changer de carte » (carte lue), « Gérer chez Stripe »
  (factures, moyen de paiement, adresse — le **portail client**, `mode=portail` : session
  exigée, client = celui de SA ligne lue avec son jeton, un `customer` envoyé par le
  navigateur est ignoré, prouvé), « Résilier » (**2 clics** : la rangée puis la confirmation
  — L215-1-1, « résiliation en trois clics » respectée), « Tes factures » en rangées.
- États : essai · essai résilié · abonné · résilié (« Fin le … ») · paiement en échec ·
  lecture seule · pas d'abonnement · paiement pas encore ouvert (Stripe absent ou prix ≠ CGV
  ou mentions vides : dit calmement, **aucun bouton**) · propriétaire.
- Les `data-abonnement` d'avant sont gardés (le banc `abonnement.cjs` les lit) ;
  `data-abonnement-etat` dit l'état fin.

### 4. Parrainage
- `api/_lib/parrainage.js`, `mode=parrainage` (GET : SON lien et des nombres ; POST
  `rattacher`), webhook `invoice.paid`. Règle (CGV art. 2) : filleul = compte VRM de moins de
  30 jours, jamais client Stripe, sans essai déjà consommé (registre 022, e-mail ET Vinted) ;
  pas soi-même (même compte ou compte Vinted en commun) ; une fois par filleul ; au premier
  paiement RÉEL (> 0 €) du filleul, **un crédit de 16,99 € sur le solde client Stripe de
  chacun** (déduit de la prochaine facture) ; parrain sans client Stripe ⇒ en attente,
  crédité dès qu'il en a un ; 12 mois offerts au plus par parrain sur 365 jours ; éteint par
  défaut (`vrm_reglages.parrainage`).
- Idempotent deux fois : la date dans la ligne ET la marque `metadata[vrm_parrainage]` relue
  chez Stripe avant tout crédit (+ clé d'idempotence). Un webhook rejoué ne double rien.
- Le lien `?parrain=CODE` est gardé sur l'appareil jusqu'à la connexion, présenté UNE fois
  (un refus définitif l'efface, « pas su » le garde).
- L'écran : « Partager mon lien » (feuille de partage au doigt, copie à l'ordinateur), « Amis
  inscrits · Ont payé leur premier mois · Mois offerts pour toi ». Jamais qui.
- ⚠️ Pas mesuré : un crédit réel chez Stripe (aucune clé dans le conteneur).

### 5. Textes légaux (CGV du 8 novembre 2026, `CGV_VERSION = '2026-11-08'`)
Rappels d'essai (J-3, J-1), premier prélèvement à la fin de l'essai, parrainage (règles,
plafond, annulation en cas de fraude ou de remboursement, suspension pour l'avenir), lecture
seule à l'expiration et sur impayé > 14 jours (rien supprimé), chemins « Paramètres →
Abonnement → Résilier, puis confirmer » et « … → Tes factures ». Les champs vides de
`editeur.js` restent le geste de Julien.

## Les preuves
| contrôle | aujourd'hui | sur la branche de départ | mutations |
|---|---|---|---|
| `scripts/audit-abonnement-propre.cjs` (exécute `api/compte.js` + le module, lit la 027) | 59 verts | **29 rouges** | portail sur le `customer` du navigateur → 1 · porte qui ferme malgré `lecture` → 1 · crédit sans relire la marque Stripe → 1 |
| `scripts/bancs/abonnement-propre.cjs` (rendu 390/1512, clair/sombre, faux serveur) | 36 verts | **22 rouges** | porte qui ferme à l’expiration → 6 rouges |
| `audit-abonnement` 103 · `audit-lancement` 31 · `audit-mentions-paiement` 19 · `audit-fonctions-api` · `audit-variables` · `audit-tdz` | verts | — | — |
| banc `abonnement.cjs` | 108 verts, 1 rouge | **le même rouge** (« retour de Stripe ouvre Abonnement ») | — |

## Ce qui reste
- Confirmation de résiliation par e-mail (support durable) : Stripe (geste 4) ou un envoi VRM.
- Relances e-mail pendant l'essai (`api/_lib/relances-essai.js`, demande du 5 nov.) : non touchées.
- Le rouge pré-existant du banc `abonnement.cjs` (retour `?abonnement=merci`).
