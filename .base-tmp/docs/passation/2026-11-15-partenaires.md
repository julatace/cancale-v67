# 15 novembre 2026 — Le programme partenaire (branche `claude/partenaires`)

**Décision de Julien (15 nov.)** : un ami influenceur fait la promotion de VRM. Programme
**partenaire** : **3 € par mois et par client payant, à vie** (tant que le client paie),
quel que soit l'abonnement (Solo ou Pro). Construit À CÔTÉ du parrainage (8 nov.), sans le
toucher : mêmes règles de rattachement (fonctions de `api/_lib/parrainage.js` réutilisées).

## La règle (une seule, `api/_lib/partenaires-regle.js`, pure)

| question | réponse |
|---|---|
| Montant | **300 centimes** par commission, Solo comme Pro (jamais un pourcentage du prix) |
| Quand | à chaque `invoice.paid` **réel** : statut `paid`, `amount_paid` > 0, en euros, motif `subscription_create` ou `subscription_cycle` |
| Pas de commission | facture à 0 € (essai), régularisation `subscription_update` (Solo ⇒ Pro), facture manuelle, hors abonnement, autre devise, client sans code, paiement **avant** le rattachement |
| Idempotence | clé = **l'identifiant de la facture** (clé primaire en base) : un webhook rejoué n'ajoute rien |
| Par mois | un client = **une** commission par mois de Paris (index unique partiel ; une annulée ne bloque pas) |
| Datée | du paiement (`status_transitions.paid_at`) |
| Due | **14 jours** après le paiement (rétractation) ; avant : « en attente » |
| Annulée | `charge.refunded` / `refund.created` / `charge.refund.updated` (remboursement), `charge.dispute.created` (litige), `credit_note.created` (avoir) ⇒ la commission est **marquée** annulée (jamais effacée) ; reçu AVANT la facture payée (désordre) ⇒ elle naît annulée (`partenaire_annulations`) |
| Client parti | plus de facture ⇒ plus de commission ; il sort des « clients payants » (abonnement plus `active`/`past_due`) ; rien de ce qu'il a rapporté n'est effacé |
| Pause | le code n'attache plus personne ; les clients déjà venus comptent toujours (« à vie ») |
| Versé | **noté sur le clic de Julien** (date, montant). VRM ne verse RIEN : ni Stripe Connect, ni virement |
| Reste | par mois : dû − versé. Une commission annulée après versement ⇒ « Trop versé : 3,00 € à reprendre » (dit, jamais caché) |

**Rattacher un compte à un code** (`rattacherPartenaire`, mêmes règles que le parrainage) :
compte VRM de moins de 30 jours, jamais client Stripe, aucun essai déjà consommé (registre 022) ;
pas soi-même : le compte VRM du partenaire, son e-mail de contact **ou** l'e-mail de son compte à un
point ou un « + » près (`emailCanon`), un compte Vinted en commun ou déjà vu ailleurs dans VRM
(`verdictVinted`) ; une fois (clé primaire) ; jamais le propriétaire ; **une seule récompense par
client** : un compte déjà parrainé ne prend pas de code partenaire, et un compte venu par un code
ne prend plus de parrain (refus `deja-partenaire` ajouté à la route du parrainage, rien changé dans
`parrainage.js`). Le compte VRM du partenaire est retrouvé à la création par son e-mail de contact.

## Le chemin
- **Le lien** : `https://vrm.center/p/LEO` (vercel.json ⇒ `/?partenaire=LEO`). `?code=` n'a PAS été
  pris : c'est le retour d'une connexion Google. Le code est gardé sur l'appareil
  (`vrm_partenaire_code`), posé aussi sur le compte à l'inscription (`user_metadata.partenaire`),
  présenté UNE fois par `BandeauAbonnement` (`src/partenaires/lien.js`) ; le lien ouvre l'inscription.
- **Le serveur** : tout dans `api/compte.js` (12 fonctions, `audit-fonctions-api` vert) :
  le webhook (`invoice.paid` ⇒ `commissionFacturePayee` à côté du parrainage ; un 503 si rien n'est
  rangé, Stripe rejoue) ; `mode=partenaire` (POST rattacher, session ; GET `?j=` page du partenaire,
  sans session, `no-store`, `noindex`) ; `mode=partenaires` (Julien seul : `proprietaireInstallation`,
  sinon 403) ; `mode=checkout` pose le coupon du partenaire au PREMIER abonnement d'un filleul.
- **Julien** : Réglages → Abonnement (compte propriétaire) → **Partenaires** (`src/partenaires/Partenaires.jsx`) :
  « Leo · LEO — 23 clients payants · 69,00 € à lui verser pour octobre 2026 (au 14 nov.) » ; la fiche :
  inscrits · clients payants · à verser · en attente, son lien, sa page privée (« Nouveau lien privé » :
  l'ancien meurt), mois par mois (« Reste 69,00 € » en ambre, « Versé » ⇒ date + montant proposé ⇒
  « Noter “Versé” »), l'avantage, la pause, l'export CSV (`;`, « 3,00 », clients « Client 1 », jamais
  un identifiant). Quatre formes de bouton, aucun plein, aucun rouge.
- **Le partenaire** : `https://vrm.center/pa/<jeton>` (⇒ `/?espace-partenaire=`) ; page sans l'app ni
  session (`src/VuePartenaire.jsx`) : « Bonjour Leo », à recevoir, inscrits, clients payants, en
  attente, son lien, mois par mois (au téléphone : un mois = une carte), la règle, et la phrase :
  « Chaque publication qui parle de VRM porte la mention « Publicité » ou « Collaboration
  commerciale » (loi du 9 juin 2023 sur l'influence commerciale). » Suit le clair/sombre de SON
  téléphone. Le jeton : 32 octets aléatoires, rendu UNE fois ; la base n'en garde que l'empreinte
  (SHA-256), recomparée à durée constante. Jamais un nom, un e-mail, un pseudo, un identifiant de
  client ; ni le contact du partenaire ni son coupon.
- **L'avantage du filleul** (éteint par défaut) : le nom d'un coupon que Julien crée chez Stripe,
  vérifié chez Stripe (`GET coupons/{id}`) avant d'être posé ; ajouté au paiement (`discounts`) d'un
  filleul jamais client. ⚠️ À essayer en mode test AVANT de l'allumer : avec l'essai de 7 jours, un
  coupon « once » peut être consommé par la facture à 0 € de l'essai (à vérifier chez Stripe) ; et
  les CGV doivent alors mentionner cette remise.
- **Les textes** : `tr()`, cinq langues (`src/i18n/langues/*/partenaires.js`).

## Les données — migration `supabase/migrations/043-partenaires.sql` (PAS appliquée)
Cinq tables : `partenaires` (code unique `^[A-Z0-9]{3,16}$`, nom, contact, compte, pause, coupon,
empreinte du jeton), `partenaire_filleuls` (un compte = un code, clé primaire), `partenaire_commissions`
(clé = la facture ; 300 seulement ; due ≥ paiement + 14 j ; « annulée » toujours avec sa raison ;
un par client et par mois hors annulées), `partenaire_annulations`, `partenaire_versements`.
RLS activée ET forcée, aucune policy, tous les droits retirés à `anon`, `authenticated` ET
`service_role` (les droits par défaut du schéma public lui donnaient tout), puis rendus au serveur
sans `delete`. Aucune suppression dans le fichier ; elle se rejoue. Sans elle : le webhook acquitte
sans rien écrire, le paiement reste ouvert, l'écran de Julien dit « pas installé ».

## Les preuves
| contrôle | résultat | mutations |
|---|---|---|
| `scripts/audit-partenaires.cjs` — la règle exécutée sur des factures Stripe inventées (forme 2026-08-26) | 52 verts | `--prouve` : 15/15 (0 € compté, montant du prix, rejeu doublé, deux par mois, motif libre, rétroactif, due tout de suite, annulée comptée, annulation ignorée, litige oublié, actifs sans statut, versé ignoré, attente = due, CSV nommé, devise libre) |
| `scripts/audit-partenaires-sql.cjs` — la 043 sur un Postgres jetable (rôles de production) | 58 verts | `--prouve` : 9/9 (commissions lisibles, partenaires écrits par un navigateur, partenaire qui lit sa ligne, droits par défaut gardés, montant libre, deux par mois, due immédiate, annulée sans raison, serveur qui supprime) |
| `scripts/bancs/partenaires-serveur.cjs` — le VRAI `api/compte.js` (webhook signé, routes), faux PostgREST (`_faux-postgrest.cjs`), faux Stripe | 87 verts | `--prouve` (copie mutée de `partenaires.js`, témoin vert d'abord) : 10/10 (soi-même par l'e-mail, par Vinted, compte neuf, pause, deux récompenses, panne acquittée, annulation perdue, jeton de tous, page bavarde, coupon non vérifié) |
| `scripts/bancs/partenaires-ecran.cjs` — Réglages (propriétaire, vendeur) et la page partenaire, 390 tactile + 1512, clair + sombre, lien mort | 104 verts | (sur `origin/main` : ni groupe ni page) |
| `fonctions-api` (12), `traduction`, `tdz`, `variables`, `studio` (+2 fichiers migrés), `csp`, `abonnement`, `abonnement-propre`, `argent-parrainage`, `parrainage-lot54`, `plans-solo-pro`, `lancement`, `mentions-paiement`, `ouverture-paiements`, `familles-serveur`, `robustesse-serveur`, `serveur-migrations`, `politiques-uniques-sql`, `export-rgpd`, `supprimer-compte`, `cloisonnement`, `quoi-de-neuf`, `suites-serveur`, `coherence` | verts | `revue-fin` : 1 rouge DÉJÀ sur `origin/main` (`partageFichiersPossible` déclaré dans App.jsx et Republier.jsx), pas touché |

Un partenaire ne lit pas un autre : prouvé au banc serveur (le jeton de Max ne montre RIEN de
Leo ; mutation « jeton-de-tous » ⇒ rouge) et en base (même un partenaire qui a un compte VRM ne lit
aucune ligne, la sienne comprise).

## Ce que Julien doit faire, dans l'ordre
1. **Contrat écrit avec l'influenceur** (avant toute publication) : 3 € par mois et par client
   payant, à vie tant que le client paie ; due 14 jours après le paiement ; annulée si remboursement,
   litige ou avoir ; versée par Julien (rythme à fixer : mensuel ?) ; pause possible ; mention
   « Publicité » / « Collaboration commerciale » obligatoire (loi n° 2023-451 du 9 juin 2023) ; le
   partenaire facture (auto-entrepreneur : facture ; sinon, voir le comptable).
2. **Passer la migration 043**, sans terminal : Supabase → **SQL Editor** → « New query » → coller
   TOUT `supabase/migrations/043-partenaires.sql` → **Run**. Vérifier : Table Editor → les cinq
   tables `partenaire…` existent, avec le cadenas « RLS enabled ». (Aucune suppression : l'outil ne
   demande pas de confirmation.) Elle se rejoue sans risque.
3. **Stripe → Développeurs → Webhooks** (l'adresse `/api/stripe-webhook` existe déjà) → « Modifier les
   événements » : garder `invoice.paid`, `customer.subscription.*`, `checkout.session.completed` et
   **ajouter** `charge.refunded`, `refund.created`, `charge.refund.updated`, `charge.dispute.created`,
   `credit_note.created`. Sans eux, une commission remboursée resterait due.
4. **Créer le partenaire** : VRM → Paramètres → Abonnement → Partenaires → « Nouveau partenaire » :
   nom « Leo », code « LEO », contact = son e-mail (s'il a un compte VRM, il est retrouvé : il ne
   pourra pas utiliser son propre code). **Copier tout de suite « Sa page privée »** (elle ne se
   réaffiche pas ; « Nouveau lien privé » en fait une autre) et la lui envoyer avec `vrm.center/p/LEO`.
5. (Facultatif, plus tard) l'avantage du filleul : créer le coupon chez Stripe, l'essayer en mode test
   avec l'essai de 7 jours, mettre les CGV à jour, puis « Choisir un coupon ».
6. Chaque mois : la ligne dit « … à lui verser pour octobre » ; payer Leo soi-même, puis « Versé »
   (date, montant). L'export CSV va au comptable.
7. Politique de confidentialité : ajouter une ligne « si tu arrives par le lien d'un partenaire, ce
   lien est noté sur ton compte ; le partenaire ne voit que des nombres ».

## Pas fait / à savoir
- (16 nov. : `pour: 'proprietaire'` existe, ligne `partenaires-prorata`.) Pas de ligne « Quoi de neuf » : l'outil ne sait pas viser le seul propriétaire (`pour` : tous,
  sneakers, autre, pro) et les clients ne voient rien de neuf ; Julien a ce récit.
- Pas mesuré : un vrai webhook Stripe (aucune clé dans le conteneur) ; la forme des événements suit
  l'API 2026-08-26 (`parent.subscription_details`, `payments`) ET l'ancienne (`subscription`,
  `charge`, `payment_intent`) ; si le paiement manque à la facture, il est lu chez Stripe
  (`invoice_payments?invoice=`), Stripe muet ⇒ 503.
- Une remise partielle (remboursement de 1 €) annule toute la commission : choix prudent, à revoir
  si Julien le veut. → (16 nov.) FAIT : commission au prorata, `2026-11-16-compta-donnees.md`.
