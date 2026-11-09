# 9 novembre 2026 — Solo et Pro (branche `claude/plans-solo-pro`)

Julien (9 nov.) : « Ça peut être 1 compte vendeur et plein de comptes achat, donc sur ces
comptes on prend que les achats ; pour avoir toutes ses ventes de tous ses comptes il prend
l'abonnement du dessus. » Puis : Pro = **19,99 € / mois** (Solo reste 16,99 €).

## Les gestes de Julien, dans l'ordre

1. **Stripe → Produits → « VRM Pro »** (créer le produit) → **prix récurrent 19,99 € EUR,
   mensuel**, clé de recherche (lookup key) **`vrm_pro_mensuel`** → copier l'identifiant
   `price_…` → **Vercel → Variables d'environnement → `STRIPE_PRIX_PRO`** = cet identifiant
   (une clé de recherche marche aussi). Redéployer.
   Tant que ce n'est pas fait : Pro s'affiche « Bientôt », 19,99 €, **sans bouton de paiement** ;
   la page Abonnement du propriétaire dit ce geste mot pour mot.
   Si Stripe dit un autre montant que 19,99 € : le paiement Pro reste **fermé** et le
   propriétaire voit le montant de Stripe (« le prix réglé chez Stripe (24,99 € / mois)
   n'est pas celui des conditions de vente »). Le montant prélevé est toujours celui de Stripe.
2. **Supabase → SQL** : passer `supabase/migrations/028-plans-solo-pro.sql` (deux colonnes
   `plan` et `compte_vendeur` sur `abonnements`, additif, aucun DROP). Sans elle tout marche,
   sauf une chose : les notifications de vente des comptes d'achat continuent de sonner
   (« pas su » ne coupe rien).
3. Le jour où Pro est ouvert au paiement : passer `PRO_OUVERT = true` dans
   `src/accueil-reglages.js` (la page d'accueil cesse de dire « bientôt »).
4. Portail Stripe (déjà demandé le 8 nov.) : si on veut que le passage Solo ⇄ Pro se fasse
   AUSSI depuis le portail, y autoriser « changer d'offre » avec les deux prix. Pas nécessaire :
   VRM le fait lui-même (route `changer-plan`, prorata).

## Ce qu'un vendeur voit

- **Paramètres → Abonnement** : les deux offres côte à côte (Solo · Pro), « Ton offre » sur
  la sienne, Pro « Bientôt » tant que le prix Stripe n'est pas posé ; en Solo, la rangée
  « Le compte qui vend » (son n°, prochain changement possible). Pro ouvert : cases CGV +
  « Passer à Pro » (confirmation, prorata Stripe). En Pro : « Revenir à Solo ».
- **Solo sans compte choisi** : une ligne dans la coque « Ton offre Solo : choisis le compte
  qui vend. Tant que tu n'as pas choisi, tous tes comptes comptent. » → la feuille
  **« Quel compte vend ? »** : ses comptes par pseudo ET n° (l'identité), « N ventes lues »,
  le plus vendeur marqué « proposé » (strictement le plus ; égalité ⇒ rien), **rien coché,
  rien envoyé avant son clic**. Changement : premier choix libre, puis une fois tous les 30 j
  (la date est dite ; trop tôt ⇒ refus du serveur avec la date).
- **Solo, compte choisi** : les ventes, annonces, colis à envoyer et totaux (vendu, CA
  déclaré/URSSAF, bénéfice, stats, porte-monnaie, Ma journée) ne comptent que le compte
  vendeur. Les achats, retraits, colis à retirer de TOUS les comptes restent (règle
  `compteEcarteChoix`). Sous la liste des ventes (« Tous » et Vinted) : un bloc par compte
  d'achat qui a des ventes — « Ventes de shop_x · 5 ventes, dont 1 à envoyer — hors de ton
  offre Solo : ni dans tes listes, ni dans tes totaux. Rien n'est supprimé. » — les 3
  premières nettes, la suite floutée, `inert`, aucun geste, et « Passe à Pro pour gérer les
  ventes de shop_x ». Le colis à envoyer est DIT (un colis caché est un colis perdu).
- **Passer à Pro** rend tout immédiatement (l'app se remonte quand la règle change).
- **Propriétaire de l'installation (Julien)** : Pro, jamais bridé, rien à choisir.

## La règle (une seule, `api/_lib/plan-regle.js`, importée par l'app ET le serveur)

- Le plan vient du **prix Stripe réel** de SON abonnement : clé `vrm_mensuel` ⇒ Solo ;
  `STRIPE_PRIX_PRO` (id ou clé) ou clé `vrm_pro_mensuel` ⇒ Pro ; autre ⇒ `null`. Jamais un
  champ du navigateur ni des métadonnées « plan ».
- **Pas su ne bride jamais** : plan illisible, Stripe muet, deux articles, Solo sans compte
  choisi ⇒ comportement d'avant (tout compte).
- ⚠️ **Un abonnement Solo souscrit sous des CGV d'avant le 9 nov. n'est jamais bridé**
  (`cgv_version` < `2026-11-09`) : ces CGV promettaient « pour tous tes comptes ». Décision à
  confirmer par Julien s'il veut faire autrement (il faudrait alors prévenir ces abonnés).
- Identité d'un compte = `vinted_user_id`, jamais le pseudo (50 comptes au même pseudo :
  audit). Une vente sans compte relevé n'est jamais écartée.
- Le compte vendeur vit dans les **métadonnées de SON abonnement Stripe**
  (`vrm_compte_vendeur`, `_le`, `_avant`), écrit par la route `compte-vendeur` (session,
  compte relu dans SES `vinted_accounts`, abonnement relu chez Stripe, 30 jours) ; le webhook
  le recopie dans `abonnements.compte_vendeur` (028).
- **Périmètre** : Solo porte sur les comptes **Vinted**. Leboncoin, eBay, Vestiaire : comme
  avant (à décider si Julien veut les y mettre). Restent volontairement NON bridés (sécurité) :
  double vente, ventes annulées « chez toi », litiges, paires sorties du stock.
- Notifications : « vendu » et « argent reçu » d'un compte d'achat ne sonnent pas
  (`api/_lib/plan-vendeur.js`, lu de la ligne rangée par le webhook ; la vente est rangée
  quand même). Vestiaire : inchangé.

## Serveur (`api/compte.js`, aucune fonction de plus : 12)

- `mode=abonnement` rend `plan`, `planRaison`, `compteVendeur`, `offres.{solo,pro}` (la raison
  de Pro fermé et le montant Stripe ne partent qu'au propriétaire).
- `mode=compte-vendeur` (POST `{uid}`), `mode=changer-plan` (POST `{plan, cgv:true}`, change le
  prix de l'article, `proration_behavior=create_prorations`), `checkout` accepte `plan:'pro'`
  quand Pro est ouvert.
- `PRIX_PRO_CGV = { centimes: 1999, devise: 'eur', intervalle: 'month' }`, `CGV_VERSION`
  `2026-11-09`. Webhook : `plan` + `compte_vendeur` écrits ; colonne absente (028 pas
  passée) ⇒ statut rangé sans elles.

## Textes

- CGV du 9 novembre 2026 : Solo (un compte vendeur + comptes d'achat, changement 1 fois / 30 j,
  rien supprimé, abonnements antérieurs gardent tous les comptes), Pro 19,99 €, passage
  Solo ⇄ Pro au prorata. À faire relire avec le reste.
- Accueil : « Deux offres. Tout VRM. » — Solo 16,99 €, Pro 19,99 € « bientôt » (`PRO_OUVERT`).

## Preuves

| contrôle | aujourd'hui | sur origin/main | mutations |
|---|---|---|---|
| `scripts/audit-plans-solo-pro.cjs --prouve` (règle, état de l'app, routes et webhook EXÉCUTÉS avec un faux Stripe, notifications, prix) | 56 verts (+6 mutations rouges) | rouge (module absent) | 6 mutations de la règle ⇒ chacune rouge |
| `scripts/bancs/plans-solo-pro.cjs` (390/1512, clair/sombre, mode exemple + 4 ventes inventées) | 32 verts | 25 rouges | `BANC_MUTATION=horsplan` ⇒ 18 rouges |
| bancs `abonnement-propre` 71 · `abonnement` 109 | verts | — | — |
| audits abonnement-propre, lancement (prix Solo/Pro), mentions-paiement, urssaf (suit `venteOffOf`), identite, statuts, variables, tdz, coherence, fonctions-api, boutons, icones, violet | verts | — | — |
| `audit-abonnement` | 1 rouge **venant de main** (santé rend `statut`, chantier « /statut automatique ») | le même | — |

`scripts/audits-plans.sh` relance la série. Captures regardées : Ventes Solo 1512 et 390
sombre (3 ventes nettes de 111, bloc vendeuse_b flouté après 3), feuille « Quel compte
vend ? » 390, offres 1512 sombre (Pro ouvert).

## Ce qui reste

- Décider : Leboncoin/eBay/Vestiaire dans Solo ? Annonces des comptes d'achat : retirées des
  listes et compteurs, sans bloc d'aperçu dédié (seules les ventes en ont un).
- Offres automatiques et favoris (extension) ne regardent pas l'offre : l'extension n'est pas
  touchée ici (5.331/5.332 en cours ailleurs).
