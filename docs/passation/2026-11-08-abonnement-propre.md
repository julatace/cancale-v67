# 8 novembre 2026 — Abonnement propre (branche `claude/abonnement-propre`)

Julien : « des vendeurs vont payer — fais tout ». Ce qui existait déjà (Stripe en mode test
sans bibliothèque, essai de 7 jours une fois par e-mail et par compte Vinted — 022, CGV
acceptées dans VRM, résiliation et reprise en ligne, factures, portail Stripe, porte
d'abonnement) est gardé ; ce chantier le rend clair, cohérent et complet.

## Les gestes de Julien (Stripe et base), dans l'ordre

1. Supabase → SQL : passer `supabase/migrations/027-abonnement-apercu-et-parrainage.sql` (sans abonnement : lire oui, écrire non — pour l'aperçu ; tables du parrainage ; aucun DROP).
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

### 2. Sans abonnement : un extrait net, le reste flouté, aucune action
**Décision de Julien du 8 nov.** (après deux allers-retours le même jour : la « lecture
seule » complète a été REFUSÉE — « non, sans abonnement il a rien » —, puis précisée :
« on lui montre un extrait de ses données, le reste sera flouté tant qu'il ne paie pas »).
Elle remplace sa règle du 4 octobre (porte qui cachait tout). Ligne dans CLAUDE.md §3.
- **Base (027)** : `abonnement_requis` garde son WITH CHECK (écrire exige l'accès), son
  USING devient `true` (lire ses propres lignes est permis ; owner, 021 et 016 décident
  toujours qui lit quoi) ; une restrictive DELETE s'ajoute ; `vrm_acces()` dit
  `lecture: true`. Aucune écriture ne passe. Notifications et widget restent coupés.
  Le flou est une porte COMMERCIALE (ses données) : il n'est pas tenu par le serveur.
- **L'écran** (`src/abonnement/apercu.js`, monté par `ApercuSansAbonnement` dans la coque) :
  sur chaque écran sauf Paramètres, les titres et les **3 premières lignes de chaque liste**
  (≥ 4 enfants de même forme ; une rangée de filtres n'en est pas une) restent nets ; le
  reste — lignes suivantes, textes et chiffres des cartes, graphiques, images — est flouté
  (`blur(7px)`, voile), `aria-hidden`, `inert`, non sélectionnable. La règle lit le DOM
  rendu (un écran ajouté demain est couvert) et se rejoue à chaque changement
  (MutationObserver). Une liste de 1 à 3 lignes est floutée en entier (pas reconnue
  comme liste) : à savoir.
- **Aucune action** : clic, touche Entrée/Espace, saisie, copier, glisser dans l'écran sont
  arrêtés et font signe à la carte ; les deux exports (sauvegarde complète, export des
  données) sont fermés ; la garde d'écriture refuse sur place toute écriture vers la base
  (`vrm-lecture-seule`) ; « changements en attente d'envoi » ne s'affiche pas.
- **La carte** (verre, nette, au centre en bas) : « Ton abonnement a pris fin · Tes données
  sont là, rien n'est supprimé. Voici un aperçu ; reprends l'abonnement pour tout
  retrouver et agir à nouveau · Reprendre l'abonnement » (impayé > 14 j : « Mettre à jour
  ma carte », portail). Paramètres → Abonnement reste net : « Ton abonnement a pris fin »,
  CGV + « Reprendre l'abonnement ».
- **Sans la 027**, `lecture` est absent : la porte d'avant (rien de visible).
- Aujourd'hui `abonnement_obligatoire` = '0' : personne n'est coupé.
- Limites : la loupe du haut (hors de l'écran) n'est pas floutée ; les écritures tentées
  pendant l'aperçu restent dans la file d'envoi de l'appareil et partiront à la reprise.

### 3. La page Abonnement
- Une carte d'en-tête (état · titre · phrase · geste), puis des rangées iOS
  (`GroupeIos`/`RangeeIos`) : « Changer de carte » (carte lue), « Gérer chez Stripe »
  (factures, moyen de paiement, adresse — le **portail client**, `mode=portail` : session
  exigée, client = celui de SA ligne lue avec son jeton, un `customer` envoyé par le
  navigateur est ignoré, prouvé), « Résilier » (**2 clics** : la rangée puis la confirmation
  — L215-1-1, « résiliation en trois clics » respectée), « Tes factures » en rangées.
- États : essai · essai résilié · abonné · résilié (« Fin le … ») · paiement en échec ·
  abonnement terminé (aperçu) · pas d'abonnement · paiement pas encore ouvert (Stripe absent ou prix ≠ CGV
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
| `scripts/audit-abonnement-propre.cjs` (exécute `api/compte.js` + le module, lit la 027) | 60 verts | **30 rouges** | portail sur le `customer` du navigateur → 1 · porte qui ferme malgré `lecture` → 1 · crédit sans relire la marque Stripe → 1 |
| `scripts/bancs/abonnement-propre.cjs` (rendu 390/1512, clair/sombre, données du mode exemple, faux serveur) | 71 verts | **19 rouges** | reste lisible (`flouter` neutralisé) → 6 rouges · une action passe (`bloquerGestes` neutralisé) → 4 rouges |
| `audit-abonnement` 103 · `audit-lancement` 31 · `audit-mentions-paiement` 19 · `audit-fonctions-api` · `audit-variables` · `audit-tdz` · `audit-violet` | verts | — | — |
| banc `abonnement.cjs` | 108 verts, 1 rouge | **le même rouge** (« retour de Stripe ouvre Abonnement ») | — |

Captures regardées : Ventes 1512 (3 ventes nettes, la suite floutée, carte au centre),
Statistiques 1512 sombre, Annonces 390 sombre, Achats 1512, Paramètres → Abonnement.

## Ce qui reste
- Confirmation de résiliation par e-mail (support durable) : Stripe (geste 4) ou un envoi VRM.
- Relances e-mail pendant l'essai (`api/_lib/relances-essai.js`, demande du 5 nov.) : non touchées.
- Le rouge pré-existant du banc `abonnement.cjs` (retour `?abonnement=merci`).
