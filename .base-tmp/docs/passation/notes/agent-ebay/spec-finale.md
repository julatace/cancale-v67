# L'agent eBay autonome — spécification finale

**Pour :** les sessions qui construiront (tout le document) ; Julien lit
`pour-julien.md`, à côté.
**Rédigée le :** 11 octobre 2026, au soir.
**Statut :** conception **définitive**. Elle part de `synthese.md` (même dossier)
et y intègre les deux relectures adverses (`relecture-surete.md`, défauts S1 à
S28 ; `relecture-verite.md`, défauts D1 à D18). Chaque correction est jugée au
§12 : intégrée (et où), ou rejetée (et pourquoi, en une ligne).

**Ordre de priorité des documents, pour une session qui construit :**
1. ce document ;
2. là où il ne dit rien : `synthese.md` (le détail des écrans, des textes, des
   tables de §5.1, des scénarios de vie) ;
3. là où la synthèse ne dit rien : la spec du 9 octobre du chantier concerné
   (`../agent-ebay/spec-*.md`) ;
4. toujours : `CLAUDE.md` (lois du code §4, identité §5, preuves §6).

**D'où vient chaque fait :**

| marque | sens |
|---|---|
| **[mesuré ce soir]** | lu par moi le 11 octobre au soir : sa base en lecture seule et projetée (aucun jeton, aucun nom, aucune adresse d'acheteur), le dépôt (`git`), le code |
| **[S n]**, **[D n]** | défaut de la relecture de sûreté ou de vérité, jugé au §12 |
| **(extrait officiel)** | extrait d'une page officielle rendu par un moteur de recherche ; la page elle-même est bloquée d'ici (`developer.ebay.com`, `sendcloud.dev`, `developer.boxtal.com` : `ENOTFOUND`, revérifié ce soir) |
| **(secondaire)** | forum, blog, bibliothèque non officielle |
| **[à vérifier]** | non établi. **Rien de ce qui porte cette marque ne devient une promesse à l'écran.** |

**Aucun appel** n'a été fait à eBay, à un transporteur, à un agrégateur ni à
Vinted. **Aucune écriture**, sauf ce fichier et `pour-julien.md`.

---

## 0. En une page

**Ce qu'on construit.** Un agent qui tourne **VRM fermé**, côté serveur, pour
chaque vendeur et chaque compte eBay : il voit une vente eBay dans la minute, la
range dans Colis avec le N° de la paire, empêche qu'une paire vendue ailleurs
reste en vente sur eBay, prépare le bordereau (et l'achète lui-même quand eBay
le permet et que le vendeur l'a allumé), suit le colis jusqu'au client, parle au
client quand ça sert, et écrit tout ce qu'il fait dans un journal relisible.

**Les trois limites qu'aucun code ne lève**, dites partout, jamais cachées :
1. **Quand eBay impose son étiquette, elle ne s'achète par aucune API en
   France** (la Logistics API ne fait que l'USPS aux États-Unis) : il reste un
   clic par vente dans eBay. Le champ qui le dit, `ShippingLabelPolicy =
   EBAY_ONLY`, **existe** (Trading 1455, extrait officiel, retrouvé ce soir) ; et
   sur le compte de Julien, eBay refuse déjà tout mode de livraison envoyé par
   VRM (mesuré le 27 septembre) : c'est probablement son cas.
2. **Imprimer et déposer restent à lui.**
3. **VRM ne touche jamais Vinted.** La double vente se **réduit** (preuve élargie,
   gel, veille serveur), elle ne se **ferme** pas : VRM apprend les ventes Vinted
   par l'extension, compte par compte (mesuré : de 12 min à 46 h, et jamais pour
   2 ventes sur 15 en octobre [synthèse §2.2]).

**Ce qui change par rapport à la synthèse (les plus lourds) :**
- **L'argent ne part jamais sans regarder la double vente** : tout geste qui
  engage (acheter, déclarer, baisser, offrir, écrire « merci ») exige « N° non
  prouvé vendu ailleurs » **et** « aucun gel sur le compte Vinted d'origine »
  [S1].
- **Le suivi se déclare à eBay au premier scan**, pas à l'achat : déclarer ferme
  la demande d'annulation de l'acheteur (extrait officiel, eBay, août 2024) [S2].
  Et Boxtal ne rend pas le n° de suivi à la commande [S3] : nouvel état « acheté,
  suivi attendu ».
- **Un achat incertain n'est jamais racheté par VRM**, chez aucun prestataire,
  tant que le bac à sable n'a pas prouvé l'idempotence [S4, S16, D10].
- **La numérotation 013 est appliquée** depuis 14 h 58 UTC [mesuré ce soir] :
  `VRM-553` = **N°1**, `VRM-559` = **N°10**. Le serveur lit les SKU par
  `api/_lib/numerotation.js` avec le marqueur relu, jamais par une copie de la
  version de l'app ; marqueur « pas su » ⇒ aucun N°, aucune décision par N° [S6].
- **Un compte eBay n'est actif dans l'agent que chez UN vendeur VRM** (registre
  des titulaires) [S5].
- **Cinq gestes exigent une re-vérification** (mot de passe), pas la seule
  session [S7].
- **Les notifications d'eBay** : une seule adresse pour l'installation, routée
  par `listingId` (une identité) [D13] ; toujours **204** après une signature
  valide, même base en panne (sinon eBay marque l'adresse `MARKED_DOWN`) [D3,
  S8] ; un test d'abonnement chaque semaine décide de la cadence de la veille
  [D2].
- **Les photos passent par la Media API** : `UploadSiteHostedPictures` est
  décommissionné depuis le 30 septembre 2026 (extrait officiel) [D1].
- **Vercel Pro avant que l'agent serve un autre vendeur que Julien** : en Hobby,
  dépasser l'inclus met **tout VRM** en pause [D7]. L'interrupteur
  d'installation a une position « propriétaire seulement ».
- **Le bordereau acheté par VRM (chantier K14) ne se construit qu'après une
  vraie commande lue « étiquette libre »** [D5] et les mesures du bac à sable
  [D9].

**18 chantiers** (K0 à K17), en huit vagues ; dans une vague, les chantiers se construisent en parallèle (§10). Les
chantiers sans argent viennent d'abord ; ils servent aussi Vinted (Imprimer la
journée).

---

## 0bis. DÉCISION DE JULIEN, 11 octobre — « pour eBay, c'est l'acheteur qui paie le bordereau »

Mot pour mot : « pour ebay on est d'accord c'est l'acheteur qui paye le bordereau ».
Cette décision **prime sur tout le reste de cette spec**. Elle ne se renégocie pas.

- **Le transport est payé par l'acheteur, jamais par Julien, jamais par VRM.**
  Aujourd'hui son compte est en **livraison gérée par eBay** (mesuré le 27 septembre :
  eBay refuse tout `<ShippingDetails>` envoyé par VRM ; `ebayGere: true` par défaut) :
  l'acheteur paie le port à eBay, eBay fournit l'étiquette prépayée. VRM ne fixe ni
  transporteur ni prix de port, et n'émet aucun bloc livraison.
- **Aucun chantier ne fait sortir d'argent du vendeur pour une étiquette.** K14
  (achat chez Boxtal/Sendcloud, prélevé au vendeur) reste **gelé** : il ne sert pas
  Julien. S'il est un jour construit pour un compte NON géré par eBay, ce n'est
  qu'avec un port **facturé à l'acheteur sur l'annonce, au moins égal au devis** —
  sinon rien n'est acheté. Jamais « livraison gratuite » posée par VRM.
- **La compta ne compte pas le port** : il n'est ni une recette (l'acheteur le paie à
  eBay) ni une charge (étiquette prépayée). Le CA eBay reste « l'argent que tu
  reçois » (décision du 3 octobre).
- **Ce que l'agent fait du bordereau eBay** : il le **récupère** (étiquette prépayée,
  voie eBay de §5.5), le range dans Colis avec le N° de la paire, et suit le colis.
  La limite n° 1 de §0 (pas d'API d'achat d'étiquette eBay en France) ne coûte donc
  rien à Julien : l'étiquette est déjà payée par l'acheteur ; il reste au plus un
  clic pour la générer dans eBay, que l'agent rappelle (J-1 18 h, J 9 h).
- Partout où l'écran parle d'un bordereau eBay : « payé par l'acheteur », jamais un
  montant à sa charge, jamais un plafond de dépense à régler.

---

## 1. Le point de départ, mesuré ce soir

| quoi | valeur | source |
|---|---|---|
| branche « plusieurs comptes eBay + règle d'offre » (`worktree-wf_30feaf2f-334-8`, `2a34c1c`) | **jamais fusionnée** ; **23 commits** hors de `main`, **42 commits** de retard (et non 32 : `main` a avancé) | [mesuré ce soir] `git rev-list --left-right --count` |
| `origin/main` | `93e9e0e` (PR #472) ; l'arbre `integ-11oct` porte en plus `aee8e5c` (013 consignée) ; extension **5.168.0** | [mesuré ce soir] |
| marqueur de numérotation | version 2, coupure 9 oct. 00:00 UTC, appliqué **11 oct. 14:58:07 UTC** ; `ebayAnnonces` = `{128086452103: {559: 10}, 128127336988: {553: 1}}` | [mesuré ce soir] `main.vrm_numerotation` |
| annonces eBay (miroir) | 3 : `128086452103` (`VRM-559` ⇒ **N°10**), `128101592740` (**aucun SKU**), `128127336988` (`VRM-553` ⇒ **N°1**, vendue sur Vinted le 10 oct. 22 h 25 Paris) | [mesuré ce soir] `ebay_listings`, capture **figée au 10 oct. 20:29:12 UTC** |
| commandes eBay | 0 | [mesuré ce soir] `ebay_orders` |
| retrait automatique eBay | **allumé** (`vrm_ebay_retrait_auto = "true"`), règle d'aujourd'hui (app ouverte, preuve par transaction, exception « publiée après la vente ») | [mesuré ce soir] |
| extensions de la base | `pgcrypto`, `supabase_vault` ; **pas** `pg_cron`, `pg_net` (disponibles) | [mesuré ce soir] ; [infra.md §1.1] |
| fonctions Vercel | 12 sur 12 ; un cron (08:00 UTC) ; **aucune `maxDuration`** dans `vercel.json` | [mesuré ce soir] |
| Trading | niveau de compatibilité **1149** partout | [état.md §5.1] |
| jeton eBay | en clair dans `app_data.ebay_tokens`, lisible par le navigateur du vendeur, recopié dans deux sauvegardes | [infra.md §1.1] |

**Geste immédiat de Julien** (avant tout chantier) : terminer l'annonce eBay
`128127336988` (« Autry reelwind beige taille 36 », 120 €, **N°1 dans VRM**,
ancienne 553) ; relier `128101592740` à sa paire. Voir `pour-julien.md`.

---

## 2. Les bornes de l'agent (non négociables)

1. **Vinted : rien ne change.** Aucune action automatique au-delà du §3 de
   `CLAUDE.md`. VRM ne touche jamais une annonce Vinted (ni retrait, ni pause,
   ni prix) ; « retire-la de Vinted » est un message. Les seules nouveautés côté
   extension sont des **lectures** de ses propres ventes (même forme que
   `capterDatesVersement`) et une **sonnette** vers VRM.
2. **eBay par son API officielle seulement** : aucune automatisation de page,
   aucun clic simulé, aucun pilotage d'onglet sur ebay.fr.
3. **Identité seulement** : SKU `VRM-{n°}` lu par `numeroExterne` serveur,
   `orderId`, `lineItemId`, `legacyItemId`, `listingId`, `fulfillmentId`, n° de
   transaction, n° de suivi, référence d'envoi `vrm-{orderId}`. **Jamais** un
   titre, une ressemblance, une date, une adresse, un point relais deviné.
4. **Tout geste qui coûte de l'argent ou ne se défait pas** : sur son clic avec
   confirmation, OU par un réglage qu'il allume lui-même (éteint par défaut,
   plafonné par geste, par jour, par mois), qui **commence en répétition**, et
   journalisé avec le texte ou le montant exact. **« Pas su » n'agit jamais.**
5. **Chaque vendeur son compte eBay, ses jetons, ses clés de prestataire** ;
   jamais un jeton d'un vendeur pour un autre ; rien en clair dans le dépôt
   public.
6. **Accepter une offre** : seulement par le seuil natif d'eBay posé annonce par
   annonce sur son clic (décision du 9 octobre, `CLAUDE.md` §3) ; VRM n'appelle
   aucune route d'acceptation. `audit-offres-auto.cjs` reste vert.
7. **12 fonctions Vercel, aucun nouveau cron Vercel** : tout est un **mode** d'une
   route existante ou une étape du battement.

---

## 3. Les invariants (chaque chantier les respecte, et ses audits les vérifient)

Numérotés **R1 à R22** : les chantiers y renvoient.

| # | règle | vient de |
|---|---|---|
| **R1** | **Trois états pour chaque fait lu** : la valeur · `null` (pas su : lecture ratée) · `undefined` (pas demandé). Un fait **requis** à `null` ⇒ `geste ∈ {rien, attendre}`, et l'écran ne le dit que si une **obligation** approche (date limite à moins de 24 h). Une liste lue en partie s'affiche « au moins », avec ce qui manque nommé. | `CLAUDE.md` « rien lu ne vaut pas rien » ; synthèse §7.4 |
| **R2** | **Le N° d'une paire, côté serveur**, ne se lit que par `numeroExterne(numDeSku(sku), id, 'ebayAnnonces', dateMs, marqueur)` de **`api/_lib/numerotation.js`**, avec le marqueur **relu pour ce vendeur** (`lireMarqueur`). Pour une **ligne de commande** : `id = legacyItemId`, `dateMs = Date.parse(creationDate)` (la règle de `numLigneEbay` de l'app). Pour une **annonce** : `dateMs = null`. Marqueur `undefined` (pas su) ⇒ **aucun N°** (`''`) et **aucune décision par N°** (ni tampon, ni retrait, ni achat, ni « retire-la de Vinted » nommée). Le `numeroExterne` de l'app (qui lit des globales du navigateur) n'est **jamais** recopié. | [S6] |
| **R3** | **Un N° porté par plusieurs fiches** (`vinted_annonce_numeros`, mesuré : 13 numéros sur 34 fiches, tous de l'archive B) n'autorise **aucun geste automatique** ; seulement « vérifie le carton ». | [S12] |
| **R4** | **Tout geste qui engage** (`acheter`, `declarer`, `baisser`, `offrir`, message à `payee`) exige, **lus** : « N° non prouvé vendu ailleurs » (toutes sources, §5.5) ; « aucun gel sur le compte Vinted d'origine du N° » ; et, pour `acheter`, « ventes du compte d'origine relues **après** la vente eBay » — sinon `a_confirmer` avec la raison. Prouvé vendu ailleurs ⇒ jamais d'achat : « vendue aussi sur Vinted — annule une des deux ventes ». | [S1] |
| **R5** | **Écrire avant d'agir** : (1) `en_cours` écrit sous bail et version — échec ⇒ ne pas agir ; (2) réservation d'argent ; (3) mémo `premiere_fois` vérifié ; (4) appel, avec un **délai** (`AbortController`) ; (5) **l'issue d'un geste qui engage s'écrit d'abord au journal** (ajout, sans bail), **puis** dans l'état. Une reprise qui trouve `en_cours` sous un bail expiré relit le journal ; sans issue au journal ⇒ **incertain**, jamais « à refaire ». | synthèse §7.2 ; [S15] |
| **R6** | **Un achat incertain n'est jamais racheté par VRM.** Chez **tous** les prestataires, `idempotentParRef: false` tant que le bac à sable n'a pas prouvé que deux `POST` de même référence donnent un seul envoi. La réponse « il y en a un : n° … » relie ; l'autre bouton est « achète-le moi-même » (voie eBay pour cette commande). « Réessaie » n'apparaît qu'après **24 h**, comme un **nouveau** geste confirmé avec son prix. | [S4, S16, D10] |
| **R7** | **Chaque appel sortant a un délai** : eBay 10 s, prestataire 20 s, La Poste 8 s ; toujours **inférieur** à la fin du battement et **bien inférieur** au bail (120 s). `maxDuration: 60` posé dans `vercel.json` pour `api/ship-reminders.js` et `api/ebay.js` (ne crée aucune fonction). | [S15, D8] |
| **R8** | **Le chemin « clic »** (un geste fait depuis l'app) prend **le même bail** que l'agent (`vrm_agent_prendre_cle`) ; pas de bail ⇒ **409** « l'agent travaille sur cette commande ». | [S15] |
| **R9** | **Le propriétaire d'une tâche** vient de la base (`vrm_agent_prendre`), jamais d'un navigateur ni d'une sonnette. Tout tourne dans `contexteVendeur.run({owner})` ; toute lecture et écriture passe par `portee(owner)` (`owner=eq.`). Le compte eBay se valide contre **son** registre (`resoudreCompte`) avant de tirer un jeton. | synthèse §14 |
| **R10** | **Un compte eBay n'est actif que chez UN vendeur VRM** (`vrm_ebay_titulaires`, unique sur l'identité eBay dérivée de l'`EIASToken`, `cleCompteDe`). Les clés d'idempotence des gestes qui engagent sont **globales par commande eBay** (`achat:{orderId}`, `msg:{orderId}:{type}`, `eval:{orderLineItemId}`), sous le propriétaire neutre `00000000-…`. | [S5] |
| **R11** | **Une sonnette n'est jamais une donnée** : elle avance l'heure d'une relecture faite chez la source avec le jeton du vendeur. Cela vaut aussi pour `AUTHORIZATION_REVOCATION` : elle déclenche un renouvellement de jeton ; **seul** un `invalid_grant` met le compte « refusé ». | synthèse §4.1 ; [S21] |
| **R12** | **Les mémos de gestes** (message, évaluation, offre, notification de vente) vivent dans **une seule** place, `vrm_agent_memos`, gardés au moins la fenêtre du geste (100 jours) ; seuls les identifiants de **notifications entrantes** (`vrm_agent_vus`) se purgent à 14 jours. | [S25] |
| **R13** | **Le texte rendu d'un message** est refusé s'il contient : une adresse web, un email, un téléphone, une suite de 9 chiffres ou plus qui n'est pas le n° de suivi de **cette** commande, une accolade restante, une demande d'évaluation avec contrepartie, **le nom d'une autre place de vente** (Vinted, Leboncoin, Vestiaire, Facebook Marketplace, Wallapop…), **un réseau ou une messagerie** (Instagram, Snapchat, WhatsApp, Telegram, TikTok…), **un `@pseudo`**, **une adresse écrite en toutes lettres** (« point com »), **une invitation hors plateforme** (« en dehors d'eBay », « en direct », « en privé »). La **signature** passe par le même contrôle. Jamais le N° de rangement. | synthèse §11.2 ; [S10] |
| **R14** | **Heures décentes** : un message au client ne part qu'entre 9 h et 20 h, heure de Paris (`Intl`, comme `partsParis`). | synthèse §4.5 |
| **R15** | **Les plafonds d'argent** se comparent à un montant **TTC** (l'écran nomme l'unité), avec une **marge de sécurité de +15 %** sur la réservation tant que les régularisations de poids ne sont pas mesurées ; réservés en une instruction ; rendus **seulement** sur un refus prouvé. « Coût réel » ne s'écrit qu'après la facture du prestataire ; avant, « devis ». | [S9] |
| **R16** | **La répétition, famille par famille** (bordereaux · messages · retrait serveur · prix · évaluations · offres) : `decider` rend le même geste, l'agent écrit « aurait fait » sans le faire ; passage en réel **par lui** (`agentvalider`, re-vérifié R17), conseillé après ≥ 3 vraies commandes ; **jamais** au bout d'un délai. Même en réel, **le premier de chaque sorte se confirme**. Après un changement de clés de prestataire : **24 h de répétition forcée**. | synthèse §7.5 ; [S7] |
| **R17** | **Re-vérification** (le mot de passe VRM retapé, vérifié par le serveur, valable 10 min) pour : poser ou changer des clés de prestataire · passer une famille en réel · monter un plafond · changer l'adresse d'expédition · changer un texte de message. Chaque changement de ces réglages sonne **sur tous ses appareils** (catégorie `agent`). | [S7] |
| **R18** | **Ce qu'on ne garde jamais** : adresse, nom, téléphone, email de l'acheteur (lus chez eBay au moment d'acheter, passés au prestataire, oubliés) ; le nom du point relais ; le texte brut d'une réponse d'eBay ou du prestataire ; rien de tout cela dans un `console.log`. Le **PDF** d'un bordereau eBay (qui porte nom et adresse) est purgé quand la commande est `livree` depuis 7 jours ou `close` ; la **ville** d'un devis est effacée avec le devis ; un PDF glissé n'est **jamais** gardé. | synthèse §5.5 ; [S23] |
| **R19** | **Le journal** (`vrm_agent_journal`) ne se réécrit qu'une fois, pour retirer le texte d'une entrée qui vise un acheteur supprimé (« texte retiré à la demande d'eBay »). | [S26] |
| **R20** | **Les promesses de l'écran** : « tout ce qui est fait en ton nom se relit ; ce qui se défait est marqué » (jamais « tout se défait ») ; « au prix du devis, puis de la facture » (jamais « au centime ») ; les paires nommées par leur **N° actuel** et, pour une annonce, par son identifiant et son titre. | [S27] |
| **R21** | **Une notification de vente dit trois états** de la présence de la paire ailleurs : « encore en ligne sur Vinted (tomj683) — retire-la » · rien (hors ligne, dressing lu **après** la vente eBay) · « **je ne sais pas** si elle est encore sur Vinted (tomj683 lu il y a 14 h) — vérifie ». Même règle pour Leboncoin. | [S28] |
| **R22** | **Une notion, une règle, un propriétaire** (`CLAUDE.md` §11) : les règles partagées app ↔ serveur vivent dans l'app et sont **recopiées** dans `api/_lib/ebay-regle.js` par le script `--recopie` (méthode d'`audit-bilan-semaine.cjs`), **jamais modifiées à la main** ; l'audit compare le code **et** les sorties. Exceptions **importées**, jamais recopiées : `cleNum`, `numeroExterne`, `archiveDe` (`api/_lib/numerotation.js`). | synthèse §8.4 ; [S6] |

---

## 4. L'architecture

### 4.1 Le schéma

```
 SONNETTES (n'apportent jamais une donnée crue ; elles avancent l'heure d'une tâche)
 ───────────────────────────────────────────────────────────────────────────────
 eBay, signé, UNE adresse d'installation   ORDER_CONFIRMATION (routée par listingId) ·
   /api/ebay-notif → compte?mode=ebay-notif   BUYER_QUESTION · NEW_MESSAGE ·
                                              AUTHORIZATION_REVOCATION (⇒ renouveler le jeton)
 eBay, suppression de compte (conformité)  /api/ebay-deletion → compte?mode=ebay-deletion
 prestataire, HMAC, une adresse par vendeur  /api/transporteur/{k} → compte?mode=transporteur
 extension (sa session VRM)                « une vente OU une preuve de vente vient d'être rangée »
 emails (adresse de réception)             email transporteur au MÊME n° ; email d'eBay transféré
 app (session)                             ↻, publier, relier, confirmer, régler
 l'agent lui-même                          « à 16 h 03 », « dans 48 h », « le 23/10 à 10 h »
          │ vérifier → retrouver le vendeur (identité) → dédoublonner → vrm_agent_planifier
          ▼
 ┌─────────────────────────── Supabase (plan Pro) ───────────────────────────────┐
 │ vrm_agent_file (tâches + baux) · compteurs (€, quotas) · memos · vus · coffre  │
 │ pg_cron chaque minute : « une tâche est-elle due ? » — sinon AUCUN appel       │
 └──────────────────────────────────┬────────────────────────────────────────────┘
                                    │ pg_net POST (secret lu dans le coffre de la base)
                                    ▼
   /api/ship-reminders?mode=battement : ≤ 8 tâches, 25 s, chacune dans le contexte de
   SON vendeur : relire → decider (pur) → agir si permis (R4, R5) → journal → état → reprogrammer
                                    │
   FILET : veille de chaque compte (60 min si le canal est prouvé, 15 sinon) ; suivi selon
   l'étape ; cron 08:00 : secours, alarme sur dernier_succes, recréation des tâches manquantes
```

### 4.2 Le battement (corrige synthèse §4.2-4.3)

**Migration 015 (sur le oui de Julien)** : installe `pg_cron` et `pg_net`, pose
la tâche. Esquisse corrigée :

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;      -- le schéma net n'est JAMAIS exposé à l'API

select cron.schedule('vrm-battement', '* * * * *', $$
  select net.http_post(
    url := 'https://vrm.center/api/ship-reminders?mode=battement',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                    where name = 'vrm_battement_secret')),
    body := jsonb_build_object('tic', extract(epoch from now())::bigint),
    timeout_milliseconds := 30000)
  where (select valeur from public.vrm_reglages where cle = 'agent_ebay') in ('proprietaire','1')
    and exists (select 1 from public.vrm_agent_file
                where prochain <= now() and coalesce(bail_jusqua, '-infinity') < now());
  update public.vrm_agent_horloge set dernier_tic = now() where id = 1;
$$);
select cron.schedule('vrm-purge-agent', '17 3 * * *', $$ select public.vrm_agent_purger() $$);
```

**La route** `POST /api/ship-reminders?mode=battement` (`Authorization: Bearer
VRM_BATTEMENT_SECRET`, comparé en temps constant ; **pas** `CRON_SECRET`, lisible
dans la file de `pg_net`) :

```
1. agent_ebay ∉ {'proprietaire','1'} ou illisible ..................... 200 {arrete:true}
2. anti-rafale, UNE instruction (D14 : jamais un NULL qui bloque tout) :
     update vrm_agent_horloge set dernier_battement = now()
     where id = 1 and coalesce(dernier_battement,'-infinity') < now() - interval '20 seconds'
     returning 1                         aucune ligne .................... 200 {ignore:true}
3. jeton = uuid ; fin = maintenant + 25 s
4. tant que maintenant < fin :
     taches = vrm_agent_prendre(8, jeton, 120)   -- ≤ 2 par vendeur, ≤ 1 par groupe EN VOL (S24)
     agent_ebay = 'proprietaire' ⇒ ne garder que owner = VRM_OWNER_UID (D7)
     vide ⇒ sortir
     en parallèle, chacune dans contexteVendeur.run({owner}) :
        r = executerTache(tache, {jeton, fin})   -- ne lève jamais ; chaque appel sous délai (R7)
        vrm_agent_rendre(owner, cle, jeton, r.prochain, r.echec, r.raison)
5. update vrm_agent_horloge set dernier_succes = now() where id = 1          (D4)
6. 200 {prises, faites, reportees, erreurs}   -- des NOMBRES : pg_net garde la réponse 6 h
```

**Le secours de 08:00** (cron Vercel existant, `api/ship-reminders.js` sans
mode) appelle `battementDeSecours()` (60 s au plus) :
- **alarme sur `dernier_succes`** (et non sur `dernier_tic`, qui avance même quand
  la route refuse) : plus de 30 min sans succès **alors qu'une tâche est due** ⇒
  une notification au propriétaire de l'installation (une par cause et par
  24 h) et une ligne dans le pouls ; il lit aussi `net._http_response` (6 h) : la
  part de codes non 2xx et le dernier code (« l'horloge bat, mais VRM refuse les
  battements : 401 ») [D4] ;
- toute tâche `veille` manquante pour un compte eBay actif est **recréée** ;
- puis un battement court (mêmes règles).

### 4.3 L'interrupteur d'installation

`vrm_reglages.agent_ebay` (table serveur seulement) : **`'0'` par défaut** ·
**`'proprietaire'`** (seul `VRM_OWNER_UID` est servi : c'est la position tant
que Vercel est en Hobby [D7]) · `'1'` (tous les vendeurs ; **seulement après le
passage en Vercel Pro** et l'« Application Growth Check » d'eBay [D6]). Mis à
`'0'`, tout s'arrête à la minute, pour tous.

### 4.4 Les fichiers (un fichier par famille, pour construire en parallèle)

| fichier | contenu | chantier qui le crée |
|---|---|---|
| `api/_lib/agent-ebay.js` | `executerTache` : **un simple répartiteur** (table `{famille: module}`) ; chaque chantier n'y ajoute qu'**une ligne** | K5 |
| `api/_lib/agent/veille.js` | relecture des commandes d'un compte, création des tâches `cmd` | K5 |
| `api/_lib/agent/commande.js` | la machine de la commande (rangs 0 à 2, branches) | K5 |
| `api/_lib/agent/expedier.js` | voie eBay : relecture des envois, rappels | K7 |
| `api/_lib/agent/doubles.js` | `vendeur:doubles`, gel, retrait serveur | K8 |
| `api/_lib/agent/notifs.js` | test hebdomadaire des abonnements, `getDestination` quotidien | K10 |
| `api/_lib/agent/suivi.js` | étapes du colis | K11 |
| `api/_lib/agent/messages.js` | messages et évaluation | K13 |
| `api/_lib/agent/bordereau.js` | achat, déclaration, annulation | K14 |
| `api/_lib/agent/boite.js`, `apresvente.js` | questions, offres, litiges | K15 |
| `api/_lib/agent/prix.js` | baisse des paires qui dorment, pause, remise en vente | K16 |
| `api/_lib/agent-ebay-regle.js` | `decider`, `voieEtiquette` — **purs**, exportés | K5 (K14 y ajoute la voie VRM) |
| `api/_lib/suivi-regle.js` | `etapeColis` — pur | K11 |
| `api/_lib/messages-regle.js` | contrôle du texte rendu (R13) — pur | K13 |
| `api/_lib/agent-evenements.js` | signatures eBay et prestataire, cache des clés publiques, routage | K2 (eBay), K10, K14 |
| `api/_lib/ebay-regle.js` | **recopie** des règles de l'app (R22) | K5, étendue par K7, K8 |
| `api/_lib/coffre.js` | AES-256-GCM, HKDF par vendeur, données associées | K4 |
| `api/_lib/ebay-media.js` | Media API | K12 |
| `api/_lib/ebay-signature.js` | signature numérique UE (Finances) | K9 |
| `api/_lib/transport/{boxtal,sendcloud,laposte}.js` | une interface commune | K14 (Boxtal, Sendcloud), K11 (La Poste) |

**Règle de cohabitation dans `api/ebay.js`** : chaque chantier ajoute ses actions
**en fin** de la table `ACTIONS`, dans un bloc commenté à son nom ; seul K2
modifie `handleSync`, `status`, `itemXml` ; seul K8 extrait `retirerAnnonceAuto`
de `handleRetirer` ; seul K12 touche le chemin des photos.

### 4.5 Les routes (aucune nouvelle fonction)

| adresse publique (`vercel.json`) | réécrite vers | chantier |
|---|---|---|
| `/api/ebay-deletion` | `/api/compte?mode=ebay-deletion` (**déplacée** ; l'adresse publique, donc `EBAY_DELETION_URL` et le réglage chez eBay, ne changent pas) | K2 |
| `/api/ebay-notif` | `/api/compte?mode=ebay-notif` | K10 |
| `/api/transporteur/:k` | `/api/compte?mode=transporteur&k=:k` | K14 |
| `/api/stripe-webhook`, `/api/sante` | existent | — |

`api/compte.js` lit déjà le corps brut (`bodyParser: false`, `corpsBrut()`) et
vérifie déjà une signature (Stripe) : les bancs eBay existants n'ont rien à
changer de leur façon de servir le corps. Chaque mode signé fait **quatre choses**
puis répond en moins d'une seconde : lire le corps brut (≤ 200 Ko, sinon 413) ·
vérifier la preuve d'origine · dédoublonner · planifier.

**Codes de réponse aux notifications d'eBay (corrige synthèse §8.1) [D3, S8]** :
- signature **valide** ⇒ **204**, **même si la base ne répond pas** (la sonnette
  est perdue, la veille rattrape ; pour une suppression de compte,
  l'anonymisation est mise en file en mémoire et, si elle est perdue, c'est noté
  dès que la base revient) ;
- signature **fausse** ⇒ **412**, rien n'est fait ;
- clé publique **introuvable** (ni en mémoire, ni en base, ni chez eBay) ⇒ **500**
  (c'est eBay qui ne répond pas : qu'il réessaie) ;
- `kid` **inconnu** : format vérifié ; au plus **10 nouveaux `kid` lus par heure**
  pour toute l'application ; un `kid` refusé est gardé « refusé » 1 h (contre une
  rafale de `kid` forgés qui viderait le quota de 10 000 lectures de clés).

### 4.6 Les notifications d'eBay (corrige synthèse §4.4) [D13, D2, D3]

- **Une seule adresse pour l'installation** : `createDestination` avec un
  **jeton d'application**, `endpoint = 'https://vrm.center/api/ebay-notif'`,
  jeton de vérification `EBAY_VERIF_TOKEN` (déjà posé ; 32 à 80 caractères
  [à vérifier sur sa valeur]). Le défi se calcule sur **cette adresse exacte**,
  reconstruite depuis une **base fixe**, jamais depuis `req.url` réécrite ni
  l'en-tête `Host` [D13].
- **Un abonnement par compte eBay et par sujet**, créé avec **le jeton de ce
  compte** (droit `commerce.notification.subscription`, jeu de portées `v2`) :
  `ORDER_CONFIRMATION`, `BUYER_QUESTION`, `NEW_MESSAGE`. Abonnement
  **d'application** : `AUTHORIZATION_REVOCATION`.
- **Routage par identité** : `ORDER_CONFIRMATION` porte, par ligne,
  `orderLineItemId`, `listingId`, `quantity` (extrait officiel du contrat
  `order_confirmation.yaml`) ; `listingId` → `vrm_ebay_annonces_index(listing_id,
  owner, compte)`, tenu à jour depuis le miroir des annonces de chaque vendeur.
  Annonce inconnue ⇒ **aucune** relecture (la veille rattrape) ; on ne réveille
  **jamais** tous les comptes « pour voir ». Une notification mal routée ne coûte
  qu'une relecture faite avec le jeton du vendeur désigné : elle ne montre rien
  à personne d'autre.
  - *Repli, seulement si la première vraie notification ne porte pas
    `listingId`* : une adresse opaque par compte (`/api/ebay-notif/{k}`), comme
    la synthèse (É). À ne construire que sur cette mesure.
- **Prouver le canal sans attendre une vente** : `POST /subscription/{id}/test`
  une fois par semaine et par compte (réponse 202, une notification de test
  signée arrive sur l'adresse ; extrait officiel `testSubscription`) ;
  `getDestination` une fois par jour (quota Notification 10 000/jour) ; statut
  **`MARKED_DOWN`** (posé par eBay) ⇒ `updateDestination {status: ENABLED}`,
  veille repassée à 15 min, alerte au pouls (I20).
- Dédoublonnage par `notificationId` (`vrm_agent_vus`, 14 jours).

### 4.7 Les cadences (corrige synthèse §4.5) [D2]

| quoi | quand | appels |
|---|---|---|
| `veille` (commandes, Fulfillment `lastmodifieddate`, recouvrement 1 h) | **60 min** si le canal est **prouvé** (test d'abonnement revenu depuis moins de 7 jours, ou vraie sonnette depuis moins de 7 jours) ; **15 min** sinon (pas encore abonné, test raté, `MARKED_DOWN`) ; **tout de suite** après une sonnette | 1-2 Fulfillment |
| `annonces` | 1 fois par jour + après publication, vente, retrait ; `GetMyeBaySelling`, `GetItem` seulement pour les annonces nouvelles (≤ 5) | 1-6 Trading |
| `vendeur:doubles` | à chaque sonnette de l'extension ; toutes les 30 min tant qu'une annonce eBay avec SKU est en ligne ; +10 min, +1 h, +6 h, +24 h après chaque publication eBay | 0 appel eBay |
| commande `payee` | tout de suite : `getOrder` + 1 `GetOrders` dédié au niveau 1455 (politique d'étiquette, une fois par commande) | 1 Fulfillment + 1 Trading |
| voie eBay en attente d'étiquette | `getShippingFulfillments` toutes les 2 h jusqu'à `shipByDate` + 1 jour ; rappels J-1 18 h et J 9 h (Paris) | Fulfillment |
| étiquette sans scan | transporteur toutes les 6 h ; alerte à 48 h ou à `shipByDate` | 1 lecture |
| en transit / au relais | toutes les 12 h ; « bloqué » après 5 jours ouvrés ; message J-2 à 10 h (si réglage et date lue) | 1 lecture (+ 1 message) |
| livré | plus de lecture ; évaluation (réglage) ; close à +30 jours | — |
| `apresvente` (K15) | sur sonnette ; sinon 1 fois par jour s'il existe une commande de moins de 60 jours | Post-Order (quota [à vérifier]) |
| `install:quota` | chaque heure : `getRateLimits` | 1 |
| `install:notifs` | test hebdomadaire par compte, `getDestination` quotidien | Notification |

La **boîte** (questions, offres) ne **sonde jamais** eBay à intervalles réguliers :
elle ne tourne que sur sonnette (`BUYER_QUESTION`, `NEW_MESSAGE`) ou sur son clic
[D6].

### 4.8 Le budget d'appels (corrige synthèse §14) [D6]

| quota (pour **toute** l'application) | plafond | consommation par compte et par jour (une vente par jour) | comptes tenus |
|---|---|---|---|
| Trading | **5 000** (forum du support eBay, secondaire ; extensible gratuitement par l'« Application Growth Check ») | **~20** : annonces ~2, `GetOrders` 1455 ~1, messages ~2, évaluation ~2, baisses ~2, « ↻ » de l'app ~12 | **~250 comptes** (moins de 200 vendeurs) |
| Fulfillment | 100 000 (extrait officiel) | veille à 60 min : ~24-48 ; par vente ~8 | ~1 300 comptes **si** le canal est prouvé ; à 15 min partout, dépassé dès ~700 |
| renouvellement de jeton | 50 000 (extrait officiel) | ≤ 13 avec le jeton d'accès **gardé 1 h 50** (K4) | ~3 800 |
| jeton d'application | 1 000 | ≤ 12 pour toute l'installation | — |
| Notification | 10 000 | 1 `getDestination` + 1/7 test | ~5 000 |
| Media API | 50 envois / 5 s par utilisateur | à la publication | — |

⇒ **Le garde-quota Trading** (K4) : compteur global réservé **avant** chaque
appel ; **obligations** (retrait d'une paire vendue ailleurs, déclaration, message
dû) avec 20 % réservés ; **détection** jusqu'à 80 % ; **confort** (statistiques,
baisses, « ↻ ») arrêté à 60 % ; au plus 1 % par compte et par jour hors
obligations ; recalage chaque heure sur `getRateLimits` (heure de remise à zéro
lue dans `reset`). **L'« Application Growth Check » se demande avant d'ouvrir
l'agent à d'autres vendeurs**, pas « vers 700 comptes ».

### 4.9 Quand ça casse (complète synthèse §4.6)

| panne | ce qui se passe | ce que fait l'agent |
|---|---|---|
| la route refuse les battements (secret différent, réécriture cassée, pare-feu) | `dernier_tic` avance, `dernier_succes` non | alarme du secours de 08:00 sur `dernier_succes` [D4] |
| fonction coupée en plein achat | `en_cours` + bail expiré | journal relu d'abord (R5) ; sans issue au journal ⇒ incertain (R6) |
| base en panne pendant une notification eBay signée | — | 204 quand même ; la veille rattrape au retour [D3] |
| adresse eBay `MARKED_DOWN` | plus de sonnettes | lu le jour même, rallumée, veille à 15 min [D3] |
| dépassement de l'inclus Vercel Hobby | **tout VRM en pause** | position `'proprietaire'` tant que le plan est Hobby ; onglet « Usage » relu une semaine après l'allumage [D7] |
| le reste | — | comme synthèse §4.6 |

---

## 5. La mémoire et les règles de décision

### 5.1 Les tables (migration 014 ; complète synthèse §5.1)

Les tables de la synthèse §5.1 sont reprises **telles quelles**, avec ces
changements :

| table | changement | pourquoi |
|---|---|---|
| `vrm_agent_horloge` | la migration **insère** la ligne `id = 1` avec `dernier_tic`, `dernier_battement`, `dernier_succes` à `'-infinity'` | un `NULL < …` ne vaut ni vrai ni faux : chaque battement serait ignoré pour toujours [D14] |
| `vrm_agent_vendeurs` | + `reverif_jusqua timestamptz` (R17) ; `reglages` porte `etiquettes` **par compte eBay** (`'ebay'` par défaut), l'adresse d'expédition, le colis type, les plafonds TTC, les textes | [S7] |
| `vrm_agent_commandes` | les rangs 6 à 9 de la synthèse deviennent la colonne `etape_colis` (déjà prévue) ; + `politique_etiquette text` (`EBAY_ONLY` · `aucune` · `null`), `pays text` (ISO 2 seulement), `pickup bool`, `reference_programme bool`, `cles_shipto text[]` (noms de clés, **jamais** les valeurs) | [D5, S19] |
| `vrm_agent_journal` | + `texte_retire_le timestamptz` ; une seule réécriture permise : effacer `texte` d'une entrée qui vise un acheteur supprimé | [S26] |
| **`vrm_agent_memos`** (nouvelle) | `(owner, cle, at, expire)`, clé primaire `(owner, cle)` ; les mémos de **gestes** (`msg:…`, `eval:…`, `offre:…`, `achat:…`, `push:vente:…`), gardés jusqu'à `expire` (≥ 100 jours) ; les clés des gestes qui engagent vivent sous le propriétaire neutre `00000000-…` (R10) | [S25, S5] |
| `vrm_agent_vus` | **seulement** les `notificationId` et évènements entrants ; purgés à 14 jours | [S25] |
| **`vrm_ebay_titulaires`** (nouvelle) | `(cle_ebay text primary key, owner uuid, compte text, depuis timestamptz)` ; `cle_ebay` = `cleCompteDe(EIASToken)` (l'identité existante de la branche multi-comptes) | [S5] |
| **`vrm_ebay_annonces_index`** (nouvelle) | `(listing_id text primary key, owner uuid, compte text, maj timestamptz)`, réécrite à chaque relecture des annonces d'un compte | routage des sonnettes [D13] |
| **`vrm_agent_preuves`** (nouvelle) | `(owner, numero_cle, source, ref, vue_le)` : la première fois que l'agent a **vu** la preuve qu'une paire est vendue (pour la décision 2, §9) | [S13] |
| `vrm_agent_routes` | ne sert plus qu'aux adresses **de prestataire** (une par vendeur) ; les adresses eBay par compte ne sont construites qu'en repli (§4.6) | [D13] |
| `vrm_reglages` (existe) | + `agent_ebay` (`'0'` · `'proprietaire'` · `'1'`), `ebay_transport_fr` (le JSON de `get_shipping_carriers` et `get_shipping_services` pour `EBAY_FR`, relu chaque mois) | [D7] ; K2 |

**Lecture par le vendeur** (RLS `select owner = (select auth.uid())`, **aucune**
règle d'écriture) : `vrm_agent_vendeurs`, `vrm_agent_commandes`,
`vrm_agent_journal`, avec la restrictive `abonnement_requis` (la règle de Julien
du 4 octobre : qui ne paie plus ne voit plus rien). **Serveur seulement** (RLS
activé, aucune règle, le modèle de `vrm_reglages`) : toutes les autres.

**Abonnement coupé alors que de l'argent est engagé** [S20, dans une forme
compatible avec sa règle] : `GET /api/compte?mode=abonnement` rend en plus
`engagements` = `{bordereauxNonDeposes: n, centimes, aAnnuler: n, incertains: n}`
(des nombres, aucun acheteur) ; la porte d'abonnement les affiche avec le geste
(« 1 commande annulée a un bordereau à annuler : fais-le dans Boxtal → Mes
envois »). À la coupure, **une** notification de clôture part (dernier envoi
autorisé, mémo avant). Les annulations de bordereaux **déjà décidées** se
terminent : c'est rendre son argent, pas un service nouveau (décision 9, §9).

**Garde d'écriture sur `app_data`** (migration 014) : un déclencheur `BEFORE
INSERT OR UPDATE OR DELETE` refuse toute écriture d'un rôle `authenticated` ou
`anon` (lu par `coalesce(auth.role(), current_user)`, comme
`sauvegarde.noter_ecriture`) sur les identifiants `ebay_tokens%`.

### 5.2 Les fonctions SQL (complète synthèse §5.3)

Toutes `SECURITY DEFINER`, `search_path ''`, exécutables par `service_role`
seulement, **le temps en paramètre** (`p_maintenant timestamptz default now()`).

| fonction | changement |
|---|---|
| `vrm_agent_prendre(lim, jeton, bail_s, p_maintenant)` | exclut aussi les groupes qui ont **déjà un bail vivant** (`not exists (… f2.groupe = f.groupe and f2.bail_jusqua > p_maintenant)`), sous `pg_try_advisory_xact_lock(hashtext(owner::text || groupe))` [S24, D15] |
| **`vrm_agent_prendre_cle(owner, cle, jeton, bail_s, p_maintenant)`** (nouvelle) | le bail d'**une** tâche pour le chemin « clic » ; occupée ⇒ `false` (la route répond 409) [S15] |
| `vrm_agent_premiere_fois(owner, cle, expire)` | écrit dans `vrm_agent_memos` (plus dans `vus`) [S25] |
| `vrm_agent_reserver(owner, compte, centimes_ttc, plafonds…)` | réserve `ceil(centimes_ttc × 1,15)` (R15) [S9] |
| **`vrm_agent_titulaire(cle_ebay, owner, compte)`** (nouvelle) | `insert … on conflict (cle_ebay) do nothing returning true` ; rend aussi `true` si la ligne existe **pour ce même owner** ; `false` ⇒ refusé [S5] |
| **`vrm_agent_anonymiser_journal(owner, cible)`** (nouvelle) | `update … set texte = null, texte_retire_le = now() where owner = … and cible = …` — la seule réécriture du journal [S26] |
| `vrm_agent_purger()` | `vus` > 14 j ; `memos` passés `expire` ; `cron.job_run_details` > 7 j ; compaction des commandes closes depuis 90 j ; journal > 13 mois |
| les autres (`ecrire_commande`, `rendre`, `planifier`, `rendre_reservation`, `quota`, `noter`) | comme la synthèse |

### 5.3 `decider`, pur (synthèse §6.2) — invariants complétés

`decider(etat, faits, reglages, maintenant)` vit dans
`api/_lib/agent-ebay-regle.js`, sans réseau ni horloge. Invariants, vérifiés sur
une matrice par `audit-agent-regle.cjs` :
1. un fait **requis** vaut `null` ⇒ `geste ∈ {rien, attendre}` (R1) ;
2. `engage` ⇒ réglage du geste allumé · famille sortie de la répétition ·
   abonnement `true` · compte `ok` · aucune branche · **R4 satisfaite** ; sinon
   `aurait-fait`, `a_confirmer` ou `rien` ;
3. `rang(suivant) ≥ rang(etat)` ;
4. **aucune décision ne lit un titre** : la matrice est rejouée avec chaque titre
   remplacé par celui d'une autre paire, la sortie doit rester identique ;
5. un N° n'existe que par R2 ; marqueur `undefined` ⇒ aucune décision par N° ;
6. un N° porté par plusieurs fiches ⇒ aucun geste automatique (R3) ;
7. un message dont le texte rendu échoue à R13 ⇒ `rien`, raison `texte`.

### 5.4 La preuve de vente et le gel (remplace synthèse §6.5) [S1, S11, S13]

**Une vente Vinted est PROUVÉE** (et peut alors faire retirer une annonce eBay,
si la famille est en réel) quand les **deux** conditions sont lues :
1. **l'identité** : la transaction → l'annonce, par `harvest_{uid}_txn_{tx}`
   (`meta->>item_id` **avec** un `status_title` non vide), **ou** par
   `harvest_{uid}_label_{tx}` (`item`, ou `items` pour un lot), **ou** par un
   lien posé **par Julien** (« cette vente, c'est la N°… », clé synchronisée
   `vrm_ventes_reliees = {tx: {numero, at}}`, rattrapée par `onCloudReady`) ;
2. **l'état** : l'état de la transaction **lu** (le `status_title` de la ligne
   `txn`, ou `my_orders[].status` de `harvest_{uid}_orders_sold` pour ce
   `transaction_id`), et cet état n'est **pas** dans `PAS_UNE_VENTE` (annulée,
   remboursée, retour, suspendue, paiement échoué).

Identité lue mais **état absent** (transaction absente d'`orders_sold`, ligne
illisible) ⇒ **probable** : elle bloque la publication de cette paire, elle ne
fait **rien retirer** (mesuré : 4 bordereaux captés sur 76 sont des ventes
**remboursées** [S13]).

**Une vente eBay** est prouvée par une commande engagée (`commandeEbayEngagee`)
dont une ligne porte le SKU ; **une vente Leboncoin** par la règle existante
(`doublesVenteLbc`).

**Le gel** : une vente Vinted rangée dans `orders_sold`, pas dans
`PAS_UNE_VENTE`, **sans aucune identité** (ni `txn`, ni bordereau, ni lien posé)
⇒ « une paire de ce compte est vendue, je ne sais pas laquelle ». C'est un « pas
su », et il agit comme tel :
- **aucune** paire de ce compte Vinted ne peut être publiée ni programmée sur
  eBay ; « Publier » est grisé avec la raison (« une vente du 11/10 sur tomj683
  n'est pas encore reliée à son annonce ») ;
- aucun geste qui engage (R4) sur une commande eBay dont la paire vient de ce
  compte ;
- si des paires de ce compte **sont** en vente sur eBay : une notification
  `double`, **sans nommer de paire** ; aucun retrait ;
- **le gel ne tombe que par une preuve, ou par le geste de Julien** (relier la
  vente à une paire). **Jamais par le temps** [S11]. Au-delà de 72 h, il devient
  une ligne dans Ma journée : « 1 vente du 10/10 sur arthuror2 n'est reliée à
  aucune paire — relie-la pour publier les paires de ce compte sur eBay » ;
- **portée** : les ventes rangées depuis la mise en service de K1 moins 30 jours
  (sinon l'historique gèlerait tout le premier jour). Les ventes plus anciennes
  jamais reliées sont listées **une fois**, sans gel.

**L'exception « annonce eBay publiée après la vente »** (qui a écarté la 553)
**est remplacée** par : une annonce eBay mise en ligne **après** `vue_le` (la
première fois que l'agent a vu la preuve, `vrm_agent_preuves`) n'est **pas**
retirée automatiquement, seulement **signalée** — elle a été publiée en sachant,
donc à dessein (la publication est refusée par VRM sur une paire prouvée ou
gelée). Une annonce publiée **avant** `vue_le` (le cas 553 : 20 h 29, preuve
captée à 21 h 55) est retirée si la famille est en réel. C'est la décision 2
(§9) ; recommandée.

### 5.5 La voie du bordereau (remplace synthèse §9.1) [D5, S19, S1]

```
voieEtiquette(cmd, faits, reglages) :
  branche ouverte (annulation demandée, annulée, litige)              ⇒ aucune : « Ne poste pas »
  faits.pickup (pickupStep présent : retrait sur place)               ⇒ aucune : rien à expédier
  faits.authentification (program.authenticityVerification présent)  ⇒ 'ebay'
  faits.politiqueEtiquette === 'EBAY_ONLY'                            ⇒ 'ebay'
  faits.politiqueEtiquette === null    (pas lu au niveau 1455)        ⇒ 'ebay', raison 'pas-su'
  faits.pays !== 'FR' || faits.referenceProgramme
      || instructions ≠ expédition simple || l'un de ces faits pas su ⇒ 'ebay'
  reglages.etiquettes[compte] !== 'vrm'      (DÉFAUT : 'ebay')        ⇒ 'ebay'
  service payé = relais  et  pas d'identifiant de point LU            ⇒ 'ebay', 'relais-illisible'
  coffre du prestataire absent, refusé ou pas su                      ⇒ 'ebay'
  transporteur absent de la table get_shipping_carriers (EBAY_FR)     ⇒ 'ebay' (jamais « Other »)
  poids : 1 ligne, quantité 1 ⇒ poids validé ;
          sinon ⇒ SOMME des poids validés + dimensions confirmées ;
          l'un manque                                                 ⇒ 'attendre'
  R4 non satisfaite (vendue ailleurs, gel, compte d'origine pas relu) ⇒ 'a_confirmer' (raison dite)
  sinon                                                               ⇒ 'vrm'
```

`politiqueEtiquette` a **trois états** : `'EBAY_ONLY'` · `'aucune'` (lue au
niveau 1455, champ **absent** : « if not returned, no shipping label policy is
enforced », extrait officiel des notes de version Trading 1455) · `null` (pas
lue). Elle se lit par **un appel Trading `GetOrders` dédié** au niveau de
compatibilité 1455 (en-tête `X-EBAY-API-COMPATIBILITY-LEVEL`), sur la commande
(`OrderIDArray` ; que l'`orderId` REST y soit accepté tel quel est très
probable, KB 1788, [à vérifier]) ; **les autres appels restent au niveau 1149**
(monter le niveau changerait des réponses que VRM lit déjà, sans preuve). Le
champ est sur `ShippingDetailsType` des lignes de commande (extrait officiel).
**Ta déclaration par compte** (« j'achète dans eBay » par défaut, ou « VRM
achète ») reste un filet **sous** le champ, jamais au-dessus.

**Le sens sûr est toujours « eBay »** : au pire un clic de trop ; l'autre sens
serait un bordereau payé deux fois, ou un suivi qu'eBay n'attend pas.

### 5.6 Les machines à états (corrige synthèse §6.1, §6.3)

**La commande eBay** (le rang ne descend jamais ; une branche arrête tout geste
automatique, les lectures continuent ; un évènement inconnu ne change rien) :

| rang | étape | on y entre quand (preuve) | l'agent fait |
|---|---|---|---|
| 0 | `historique` | à la **première lecture** du compte, la commande est **déjà expédiée, annulée ou close** | rien [S14] |
| 1 | `payee` | `PAID`, pas `FULFILLED` — **y compris** à la première lecture : alors **une** notification groupée (« 2 ventes eBay à poster, trouvées en branchant ce compte — la plus urgente avant ven. 12 h ») au lieu d'une par vente [S14] | sonne « Vendu sur eBay » (R21) ; N° par R2 ; lit la politique d'étiquette (1455) ; programme `vendeur:doubles` |
| 2 | `a_expedier` | voie décidée (§5.5) | rappels J-1 18 h et J 9 h ; voie eBay ⇒ bouton + relecture des envois toutes les 2 h ; voie VRM ⇒ rang 3 à la fin du délai de grâce |
| 2B | `a_confirmer` | voie VRM et (« prépare, je confirme », ou premier achat du compte, ou plafond refusé, ou R4 non satisfaite) | devis rangé (prix TTC, transporteur, **ville**, poids, valable jusqu'à) ; ville effacée avec le devis (R18) |
| 3 | `etiquette_en_cours` | écrit **avant** l'achat (R5) | achète (K14) |
| 3′ | `etiquette_incertaine` | coupure, ou `en_cours` sous bail expiré **sans issue au journal** | jamais racheté (R6) ; ta réponse |
| 4 | `etiquette_achetee` | le prestataire a rendu **son** identifiant d'envoi | attend le PDF (`pdf: true` ⇒ « Prêt à imprimer ») **et** le n° de suivi (**état « suivi attendu »** tant qu'il n'est pas arrivé par un évènement ou une lecture du prestataire **pour cet envoi**, avec la **forme** du transporteur : Mondial Relay 8 chiffres, Colissimo 13 caractères…) — l'identifiant du prestataire n'est **jamais** un suivi [S3] |
| 5 | `declaree` | **voie VRM** : suivi connu **et premier scan** (`pris_en_charge`) ⇒ `createShippingFulfillment` (après relecture de `cancelRequests`) ⇒ `fulfillmentId` rendu [S2] ; **voie eBay** : suivi lu chez eBay (`getShippingFulfillments`) ; **suivi tapé** : sur son clic, forme du transporteur vérifiée | suit le colis |
| 9 | `livree` | `etape_colis = livre` | preuve gardée ; messages et évaluation (réglages) |
| 10 | `close` | livrée + 30 jours, aucune branche | compaction ; PDF purgé (R18) |

**Le jour de `shipByDate` à 18 h (Paris), étiquette achetée par VRM sans scan** :
notification « dépose la N°… aujourd'hui — ou déclare l'envoi d'un clic (ça ferme
la demande d'annulation de l'acheteur) ». La déclaration automatique à cette
heure-là est la décision 3 (§9), **non** par défaut.

| branche | preuve | conséquence |
|---|---|---|
| `annulation_demandee` | `cancelRequests` dans un état ≠ refusé ou clos (inconnu ⇒ « demandée ») | « **Ne poste pas** — réponds dans eBay » en tête de Colis et Ma journée ; aucun achat, aucune déclaration ; un bordereau VRM existant n'est **pas** annulé |
| `annulee` | `cancelState = CANCELED` | annulation du bordereau VRM selon K14 (lecture du suivi réussie après l'annulation [S17]) |
| `authentification` | `program.authenticityVerification` **présent** (valeurs Fulfillment : `PENDING`, `PASSED`, `FAILED`, `PASSED_WITH_EXCEPTION` ; **pas** `INELIGIBLE`, qui est de l'API Buy) [D11] | voie eBay ; suivi jusqu'à l'authentificateur ; aucun message de transport ; jamais « livré au client » ; `FAILED` ⇒ « la paire revient », avec la raison |
| `retour_ouvert`, `reclamation`, `litige_paiement`, `remboursee` | Post-Order / Fulfillment (K15) | une ligne dans Ma journée avec la date limite et le lien eBay |

**Le colis** (`etape_colis`, sous-machine ; `etapeColis` pure, K11) :
`etiquette → pris_en_charge → en_transit → au_relais(dateLimite?) → livre`, drapeaux
`pas_scanne` (48 h ou `shipByDate`), `probleme` (5 jours ouvrés sans évènement,
incident, livraison estimée max + 3 jours ouvrés), et `retour`. Un code inconnu
vaut `en_transit` après un scan, `pas_su` avant ; **jamais** `livre`. Un `livre`
qui arrive **avant** `pris_en_charge` est refusé [S18].

**L'annonce eBay** (recalculée, jamais rangée) : comme synthèse §6.4, sauf :
`deux_annonces` (le même N° sur deux annonces eBay, même sur deux comptes) ⇒
**signalé, aucune n'est touchée** — la synthèse §3.1 qui retirait « l'autre
annonce eBay du même N° » est **retirée** [S12].

**Le compte eBay** : `ok` · `refuse` (**seul** `invalid_grant`) · `pas_su` ; une
`AUTHORIZATION_REVOCATION` déclenche un renouvellement, elle ne met pas
« refusé » toute seule [S21].

---

## 6. Les chantiers

**Pour tous** (la méthode du dossier, §6.1) : l'arbre d'avant par `git archive
HEAD | tar -x -C /tmp/avN`, le script **copié dedans** et lancé **depuis** cet
arbre, `DIST` déduit de `__dirname` ; **rouge sur l'avant, vert après, rouge sous
chaque mutation** du code d'après (« la fonction n'existait pas » ne prouve
rien). Tout passe par `essaie()` : un audit ne meurt pas, il rapporte. Les bancs
de rendu servent des **données inventées** (ils vivent dans le dépôt), rendent à
390 et 1 512 px, jugent les `data-*` et le **corps exact** de ce qui part vers la
route, jamais un libellé ; aucune `pageerror`, aucun « n'a pas pu s'afficher /
Cannot access / is not defined », aucun débordement. Les faux services (eBay,
Boxtal, Sendcloud, La Poste, Web Push) servent la **forme documentée**, jamais
une forme inventée qui arrangerait le code (un faux Sendcloud ne dédoublonne
**pas** tant que la mesure ne l'a pas prouvé, R6). Chaque chantier se termine
par : `npm run build` vert, **tous** les `scripts/audit-*.cjs` verts (dont
`audit-fonctions-api.cjs` à 12, `audit-secrets.cjs`, `audit-offres-auto.cjs`,
`audit-bilan-semaine.cjs` qui compare `PUSH_CATS` et `PUSH_DEFAUT`),
`verif_visuel.cjs` conforme aux deux tailles, une section datée dans
`CLAUDE.md`, poussé (§2.1). Une extension modifiée ⇒ bump, zip régénéré,
`EXT_ATTENDUE` suivie, et une entrée d'`EXT_CAPACITES` **si** l'app promet
quelque chose de neuf.

Ports réservés aux nouveaux bancs : **4841 à 4850** (libres, mesuré par la
synthèse) ; les specs du 9 octobre gardent 4831 à 4840.

---

### K0 — Fusionner « plusieurs comptes eBay + règle d'offre » dans `main`

- **Ce que Julien voit** : plusieurs comptes eBay, et la règle d'offre (eBay
  accepte seul au-dessus du seuil qu'il pose sur une annonce) arrivent en
  production. Rien d'autre.
- **Zone** : tout le périmètre eBay — `api/ebay.js`, `api/_lib/ebay.js`,
  `src/App.jsx` (écrans eBay), `scripts/audit-ebay-*.cjs`,
  `scripts/bancs/ebay-*.cjs`, `CLAUDE.md`. **Seul**, avant tout autre chantier
  qui touche eBay.
- **Dépend de** : rien.
- **Ce qui est connu** : 23 commits d'un côté, 42 de l'autre [mesuré ce soir].
  Conflit certain dans `handleRetirer` : `main` relit le marqueur de numérotation
  (`numeroExterne`, illisible ⇒ 503), la branche y a mis le contexte multi-comptes
  (`ctx`, `jetonDe`, `ligneDe`) ⇒ **garder les deux**, marqueur relu **pour ce
  vendeur**. Conflits dans `App.jsx` (≈ +1 300 lignes côté `main` depuis la
  séparation). Les tâches ouvertes de la règle d'offre (#69 preuves, #70 dossier)
  se terminent ici. Méthode : un vrai `git merge origin/main`, jamais `-s ours`
  ; après, `git diff origin/main --stat` ne montre que le périmètre eBay.
- **Preuves** : `audit-ebay-route.cjs` (354), `audit-ebay-retrait-auto.cjs`,
  `audit-ebay-deja-vendue.cjs`, `audit-offres-auto.cjs`,
  `audit-numerotation-lecteurs.cjs` (qui doit **rester rouge** si on retire la
  lecture du marqueur dans `handleRetirer` — mutation à refaire après la fusion),
  bancs `ebay-annonces`, `ebay-programmer`, `ebay-regle-offre`, `ebay-comptes`,
  `ebay-form`, `ebay-write`, `ebay-api`, `ebay-callback`, `ebay-deletion`.
- **Julien** : rien.

---

### K1 — La paire vendue ailleurs ne reste plus sur eBay sans un mot (app + extension)

- **Ce que Julien voit** :
  - eBay → Annonces : la **N°1** (ex-553) apparaît dans « à retirer d'eBay »,
    avec « vendue sur Vinted le 10/10 (prouvée par le bordereau) » et le bouton
    « Retirer » (clic + confirmation, existant) ;
  - « Publier » est **grisé** pour toute paire d'un compte **gelé** (§5.4), avec la
    raison et le geste « relie cette vente à une paire » (le lien posé par lui
    lève le gel) ; une vente jamais reliée depuis 72 h devient une ligne de Ma
    journée ;
  - « Publier » demande une confirmation quand les ventes du compte d'origine
    n'ont pas été relues depuis 30 min (« tes ventes de tomj683 datent de 4 h ») ;
  - une proposition **sur son clic** : « cette annonce porte encore l'ancien
    numéro (`VRM-559` = N°10) — réécrire le SKU en `VRM-10` ? » (`handleSku`
    existant) [S6] ;
  - « tes ventes Vinted de ce compte : lues il y a 3 h » sur les cartes eBay
    quand c'est vieux (I24).
- **Zone** : `src/App.jsx` — règles de preuve (`preuvesVentesVinted`,
  `lireVentesVintedProuvees`, `numerosDejaVendus`, `doublesVenteEbay`), garde de
  publication (`gardePublier`), cartes et blocs d'`EbayAnnonces`, la ligne de Ma
  journée ; la clé synchronisée `vrm_ventes_reliees` (SYNC_KEYS,
  `onCloudReady`) ; `vinted-sync-extension/background.js` (+ manifeste, zip,
  `EXT_ATTENDUE`).
- **Dépend de** : K0.
- **Appels** : **aucun** appel eBay nouveau. Extension, deux lectures Vinted sur
  ses **propres** ventes (§3 l'autorise, même forme que `capterDatesVersement`) :
  1. **`recupererLabel` range la transaction qu'il lit déjà** : il lit le détail
     `/api/v2/transactions/{tx}` pour trouver le PDF, et n'en gardait que
     `item` ; il range désormais aussi `harvest_{uid}_txn_{tx}` — **zéro requête
     Vinted de plus** ;
  2. **`capterPreuveVente(uid)`** : pour chaque vente d'`orders_sold` de moins de
     72 h **sans identité**, `GET /api/v2/transactions/{tx}`, rangée en
     `harvest_{uid}_txn_{tx}` ; au plus **3 par visite**, `gardeLecture` en classe
     prioritaire (avec `argent` et `colis`), dans la file Vinted (`requeteVinted`),
     pas de nouvel essai avant 30 min, rien pendant une pause Vinted, **uniquement
     le compte connecté dans l'onglet** (`garde`), rien si la lecture en base a
     échoué.
- **Données** : lit `harvest_{uid}_txn_*` (`meta->>item_id`, `meta->>status_title`),
  `harvest_{uid}_label_*` (`meta->>item` ; `items` projeté), `orders_sold`
  (`my_orders[].transaction_id`, `status`), `vrm_ventes_reliees`, le marqueur.
- **Trois états** : preuves illisibles ⇒ « je n'ai pas pu vérifier lesquelles
  sont déjà vendues » (ligne existante), aucune paire marquée « pas vendue » ;
  gel calculé sur une lecture ratée ⇒ **gelé** (le sens sûr), raison « pas su ».
- **Gardes** : §5.4 ; R2 (marqueur pas su ⇒ aucune décision par N°) ; R3 (N°
  porté par plusieurs fiches ⇒ « vérifie le carton », jamais « à retirer ») ;
  `deux_annonces` ⇒ signalé seulement [S12].
- **Le retrait automatique d'aujourd'hui (app ouverte) garde sa règle et sa
  preuve actuelles** : son consentement porte sur elles [S12]. La preuve élargie
  ne nourrit **que** l'alerte, le clic et le gel ; le retrait automatique élargi
  est une **nouvelle** famille (K8).
- **Identité** : transaction → annonce, jamais le titre ; le lien posé par
  Julien est une identité déclarée par lui (son clic).
- **Preuves** :
  - `audit-ebay-preuve-bordereau.cjs` (les vraies règles de l'app dans un `vm`) :
    bordereau + état lu ⇒ prouvée ; bordereau sans état lu ⇒ probable (gel de la
    paire, **0** dans « à retirer automatiquement ») ; conversation (état vide)
    ⇒ rien ; vente **remboursée** ⇒ rien ; vente sans identité ⇒ gel du compte ;
    le gel **tient à J+4** sans preuve, tombe par la preuve ou par le lien posé ;
    N° sur deux fiches ⇒ signalé ; `VRM-559` sur `128086452103` ⇒ N°10,
    `VRM-553` sur `128127336988` ⇒ N°1 ; marqueur `undefined` ⇒ aucune décision ;
    **le cas 553 rejoué** (vente 20:25, annonce eBay 20:29, bordereau 21:55, aucune
    `txn`) ⇒ dans « à retirer » et publication refusée. Mutations : source
    bordereau retirée (⇒ 553 invisible) ; état lu non exigé (⇒ la remboursée
    sort) ; gel retiré ; gel qui tombe à 72 h ; N° multiple traité comme unique.
  - `audit-preuve-vente-ext.cjs` (le vrai `background.js` dans un `vm`, banc
    commun `scripts/_fond-vm.cjs`) : `recupererLabel` range la `txn` sans requête
    de plus ; `capterPreuveVente` ≤ 3, sous `gardeLecture`, rien pendant une
    pause, rien pour un autre compte, lecture en base ratée ⇒ rien. Mutations :
    hors `garde` ; borne retirée.
  - Banc `ebay-doubles.cjs` (**4847**) : la N°1 dans « à retirer » (`data-*`),
    « Publier » gelé avec la raison, l'**autre sens** (compte sans vente non
    reliée ⇒ « Publier » actif), la proposition de réécriture du SKU, le lien
    « relie cette vente » qui lève le gel.
- **Extension** : **5.169.0** ; `EXT_CAPACITES.preuvevente = '5.169.0'` (l'app ne
  dit « la preuve arrive avec la vente pour le compte ouvert dans Chrome » qu'à
  une extension qui le sait).
- **Non mesurable d'ici** : le délai réel après livraison (la requête de la
  synthèse §2.2, relancée une semaine après).
- **Julien** : installer la 5.169 (un seul dossier VRM) ; relier les ventes que
  VRM lui présente comme « jamais reliées ».

---

### K2 — Le socle eBay (spec `socle`, avec ses corrections)

- **Ce que Julien voit** : « ✓ relié » / « eBay a refusé la connexion —
  Reconnecter » / gris « pas pu vérifier » par compte ; « Relu chez eBay il y a
  3 min (sauf …) » une fois sous le titre ; « Publier » exige l'état ; rien sur
  ses ventes ne disparaît plus du CA.
- **Zone** : `api/ebay.js` (`status`, `handleSync`, `handlePublish`,
  `handleVerify`, `itemXml`, retour de consentement), `api/_lib/ebay.js`
  (`accessToken` ⇒ raison `revoque`, `JEUX_PORTEES` avec `v1` **et `v2` défini**
  — demandé seulement par K4 —, délais d'appel R7), `api/compte.js` (+ mode
  `ebay-deletion`), `api/_lib/agent-evenements.js` (nouveau : signature eBay, cache
  des clés), `vercel.json` (réécriture `/api/ebay-deletion`, `maxDuration` R7),
  `src/App.jsx` (`EbayConnexion`, `EbayPublier`, ligne « Relu chez eBay »).
- **Dépend de** : K0.
- **Appels** :
  - tout `spec-socle.md` §3.1 à §3.6 (commandes paginées
    `filter=lastmodifieddate:[…]`, fusionnées, **minimisées** par
    `commandeMinimale` ; état exigé ; `]]>` échappé ; portées rangées) ;
  - **la politique d'étiquette** : un `GetOrders` Trading **dédié**, niveau
    **1455**, par commande `PAID` qui ne l'a pas encore ; rangée dans la commande
    minimisée sous trois états (§5.5) ; au même appel, les **noms** des clés de
    `shipTo` (jamais les valeurs), le pays (ISO 2), la présence de `pickupStep` et
    de `shipToReferenceId`, `fulfillmentInstructionsType` ;
  - **Metadata** : `GET /sell/metadata/v1/shipping/marketplace/EBAY_FR/get_shipping_carriers`
    et `…/get_shipping_services` (jeton d'application), une fois par mois, rangés
    dans `vrm_reglages.ebay_transport_fr` ;
  - **la suppression de compte passe par la porte `compte.js`** : défi GET
    inchangé (même adresse publique) ; POST : signature `X-EBAY-SIGNATURE`
    vérifiée sur le corps brut, puis en repli sur `JSON.stringify(JSON.parse(brut))`
    (comme le code officiel d'eBay), jamais relâchée ; codes de réponse du §4.5
    (**204 même base en panne** [S8]) ; clés publiques gardées **en mémoire** (et en
    base dès que K3 existe) ; `kid` freinés.
- **Données** : `ebay_orders{s}` minimisée (aucune adresse) ; plus aucun
  `fulfillmentStartInstructions` en base, y compris les anciennes lignes
  nettoyées au premier passage.
- **Trois états** : connexion `ok`/`refuse`/`pas-su` ; politique d'étiquette
  `EBAY_ONLY`/`aucune`/`null` ; synchro par source lue/pas lue.
- **Gardes** : spec `socle` §2 ; aucune valeur d'adresse dans une écriture ; seul
  le `GetOrders` dédié part au niveau 1455.
- **Cloisonnement** : spec `socle` §5 ; la suppression ne lit que les registres et
  réécrit chaque ligne au nom de **son** owner.
- **Preuves** : `audit-ebay-socle.cjs` (spec §7) **+** : un seul appel au niveau
  1455 (tous les autres à 1149) ; la politique lue `EBAY_ONLY`, absente ⇒
  `aucune`, appel raté ⇒ `null` ; aucune chaîne d'adresse servie ne se retrouve
  écrite ; suppression : base en panne + signature valide ⇒ **204** ; signature
  fausse ⇒ 412 et 0 écriture ; 50 `kid` forgés ⇒ ≤ 10 lectures de clé. Mutations
  : `commandeMinimale` qui garde l'adresse ; 1455 sur tous les appels ; 500 sur
  base en panne ; `kid` non freinés. Banc `ebay-socle.cjs` (**4831**, spec §7).
- **Non mesurable** : le chemin XML exact de `ShippingLabelPolicy` dans une vraie
  réponse ; l'`orderId` REST accepté par `GetOrders` ; la forme d'une vraie
  notification de suppression.
- **Julien** : ouvrir Compte eBay après le déploiement : « ✓ relié » ou
  « Reconnecter ».

---

### K3 — La mémoire de l'agent (migration 014, sans horloge)

- **Ce que Julien voit** : rien.
- **Zone** : `supabase/migrations/014-agent.sql`, `scripts/audit-agent-sql.cjs`.
  Aucun fichier de l'app ni des routes.
- **Dépend de** : rien (peut avancer en parallèle de K0 à K2).
- **Contenu** : les tables et fonctions de §5.1 et §5.2 (synthèse §5.1 et §5.3 +
  corrections), RLS, la restrictive `abonnement_requis` sur les trois tables
  lisibles, la garde d'écriture sur `ebay_tokens%`, un déclencheur jumeau de
  `sauvegarde.noter_ecriture` sur les tables lisibles, la ligne
  `vrm_agent_horloge (1)` à `'-infinity'`, `vrm_reglages.agent_ebay = '0'`.
  **Ni `pg_cron` ni `pg_net`** (c'est 015, sur le oui de Julien).
- **Application** : essai **annulé** d'abord (la méthode de la 013), puis
  application par la session ; rien ne tourne, rien d'irréversible (des tables
  vides). L'outil SQL attend une confirmation humaine pour un `DROP` : il n'y en a
  aucun.
- **Preuves** : `audit-agent-sql.cjs` (Postgres jetable, socle
  d'`audit-renum-b.cjs`) — synthèse §15.2-1 **+** : un groupe dont une tâche est
  **en vol dans un autre battement** n'est pas repris [S24] ; `prendre_cle`
  refuse une tâche tenue [S15] ; `premiere_fois` sur une clé globale appelée par
  deux owners ⇒ un seul `true` [S5] ; `titulaire` refuse un second owner [S5] ;
  `reserver` réserve 115 % [S9] ; l'anti-rafale avec la ligne d'horloge neuve
  rend une ligne [D14] ; `anonymiser_journal` est la seule réécriture possible.
  Mutations : `skip locked` retiré · condition de version retirée · condition de
  bail retirée · exclusion du groupe en vol retirée · règle d'écriture ajoutée
  pour `authenticated` · ligne d'horloge non insérée.
- **Julien** : rien.

---

### K4 — Le coffre, les jetons gardés, les titulaires, le garde-quota

- **Ce que Julien voit** : sur Compte eBay, une ligne « ta connexion eBay est
  désormais rangée chiffrée » et le bouton **« Reconnecter (une fois) »** ; un
  second compte VRM qui relie un eBay déjà relié voit « ce compte eBay est déjà
  relié à un autre compte VRM ».
- **Zone** : `api/_lib/coffre.js` (nouveau), `api/_lib/ebay.js` (`storeRefresh`,
  `lireRefresh`, `accessToken` avec jeton d'accès gardé 1 h 50 dans le coffre,
  retour de consentement + titulaire), `api/ebay.js` (garde-quota autour de
  `tradingCall`, « ↻ » sous le même compteur), `src/App.jsx` (Compte eBay).
- **Dépend de** : K2, K3.
- **Appels** : consentement eBay avec le jeu **`v2`** (`api_scope`,
  `sell.inventory`, `sell.account`, `sell.fulfillment`, `sell.finances`,
  `commerce.notification.subscription`, `sell.analytics.readonly`,
  `sell.payment.dispute`, `commerce.message` [noms exacts à vérifier]) : **une
  seule reconnexion pour tout**. Refus d'une portée (`invalid_scope`) ⇒ repli
  `v1`, rien n'est perdu (mécanisme du socle). `GetUser` pour l'identité
  (existant), puis `vrm_agent_titulaire`.
- **Données** : `vrm_coffre(owner, compte, 'ebay', …)` porte le refresh token et
  le jeton d'accès gardé ; `ebay_tokens{s}` ne garde que des métadonnées
  (`saved_at`, `portees`, `refuseLe`, `expireLe`) — **plus aucun secret**.
- **Gardes** : HKDF par owner + données associées `owner|compte|fournisseur|v` ;
  la valeur déchiffrée ne quitte jamais le serveur ; perdre `VRM_COFFRE_CLE` =
  ressaisir (aucune fuite, aucune perte d'argent).
- **Le vieux jeton** [S22] : le chiffrer ne retire pas les copies en clair (son
  navigateur, deux sauvegardes, tout outil `postgres`). Ordre : (1) Julien
  **retire VRM de ses applications autorisées dans eBay** (ce qui révoque tous les
  jetons de VRM pour ce compte — c'est la seule révocation sûre sans API documentée)
  ; (2) il se **reconnecte** dans VRM : le nouveau jeton va droit au coffre ; (3)
  les champs de jeton des sauvegardes `sauvegarde.app_data_20260930` et `_20261002`
  sont effacés (geste de Julien, `UPDATE`/`DROP` confirmé à l'écran, comme le
  dossier l'exige).
- **Garde-quota** : §4.8 ; compteur `trading:{jour}` sous l'owner neutre, réservé
  **avant** l'appel ; quota épuisé pour une priorité ⇒ l'appel n'est pas fait et
  l'écran le dit (« eBay est très sollicité aujourd'hui : relis demain »).
- **Preuves** : `audit-coffre.cjs` : une valeur recopiée chez un autre vendeur ne
  se déchiffre pas ; le refresh token **et** le jeton d'accès n'apparaissent dans
  **aucune** réponse de la route (balayage de tous les corps rendus) ; deux actions
  dans l'heure ⇒ un seul renouvellement ; quota de confort épuisé ⇒ 0 appel Trading
  de confort, une obligation passe ; second owner sur le même eBay ⇒ refusé, aucun
  jeton écrit ; ligne `ebay_tokens` en clair réécrite par `authenticated` ⇒ refusée
  par la base. Mutations : données associées retirées · garde-quota retiré · cache
  retiré (⇒ N renouvellements) · titulaire non vérifié.
- **Non mesurable** : les noms exacts des portées `v2` acceptées pour
  l'application ; l'heure de remise à zéro du quota Trading (lue dans `reset`).
- **Julien** : poser **`VRM_COFFRE_CLE`** (32 octets aléatoires en base64, type
  « sensitive », production) **et en garder une copie hors ligne** ; retirer VRM
  des applications autorisées d'eBay puis se reconnecter ; effacer les jetons des
  deux sauvegardes.

---

### K5 — Le moteur : le battement, la veille, « Vendu sur eBay » VRM fermé

- **Ce que Julien voit** : VRM fermé, son téléphone sonne « Vendu sur eBay · N°… ·
  titre · 120 € · à poster avant jeu. 16/10 » **suivi d'un des trois états de
  R21** (encore sur Vinted ⇒ « retire-la » · rien · « je ne sais pas, vérifie ») ;
  plusieurs ventes à la même minute ⇒ une notification. La vente apparaît dans eBay
  → Ventes avec son N°. Dans les 15 min au début, dans l'heure une fois le canal
  prouvé (K10), dans la minute avec la sonnette.
- **Zone** : `api/ship-reminders.js` (mode `battement`, `battementDeSecours`),
  `api/_lib/agent-ebay.js` (répartiteur), `api/_lib/agent/veille.js`,
  `api/_lib/agent/commande.js`, `api/_lib/agent-ebay-regle.js` (`decider`,
  `voieEtiquette` en lecture seule : la voie est **calculée et rangée**, aucune
  action d'expédition ici), `api/_lib/ebay-regle.js` + le script `--recopie`,
  `api/_lib/push.js` et `PUSH_CATS` de l'app (catégories `agent`, `double`,
  `livraison`, identiques des deux côtés), `supabase/migrations/015-horloge.sql`,
  `vercel.json` (`maxDuration` de `ship-reminders`).
- **Dépend de** : K1 (les règles à recopier), K2, K3, K4.
- **Appels** : Fulfillment `getOrders` (`lastmodifieddate`, recouvrement 1 h),
  `getOrder` ; Trading `GetOrders` 1455 (la politique, via K2) ; Trading
  `GetMyeBaySelling` 1 fois par jour (sous le garde-quota) ; Analytics
  `getRateLimits` (jeton d'application) chaque heure.
- **Données** : `vrm_agent_file`, `vrm_agent_commandes` (rangs 0 à 2, voie),
  `vrm_agent_memos` (`push:vente:{orderId}`), `vrm_agent_journal`,
  `vrm_agent_vendeurs.pouls`, `vrm_ebay_annonces_index` (tenu par `annonces`).
- **Trois états / gardes** : §4.2 (interrupteur, anti-rafale, `dernier_succes`) ;
  les trois portes de synthèse §4.3 (abonnement `false` ⇒ arrêt, `null` ⇒ lectures
  seulement ; ton interrupteur ; compte `refuse` ⇒ arrêt et une notification par
  7 jours) ; rang 0 corrigé [S14] ; R2 pour le N° de la notification (marqueur pas
  su ⇒ « N° inconnu », jamais le nombre brut du SKU) ; R21 pour la présence ailleurs
  (le dressing du compte d'origine lu **après** la vente eBay ⇒ certain ; sinon
  « je ne sais pas »).
- **Recopie** (R22) : `doublesVenteEbay`, `numerosDejaVendus`,
  `preuvesVentesVinted` (version K1), `commandeEbayEngagee`, `numDeSkuEbay`,
  `skuEbayDe`, `PAS_UNE_VENTE`, `limiteExpedition`. L'audit refuse toute référence
  à `window`, `localStorage`, `archiveNumeros`, `marqueurNumerotation` dans le
  fichier recopié, et toute recopie de `numeroExterne`/`cleNum`.
- **Cloisonnement** : R9 ; l'agent ne sert que `VRM_OWNER_UID` tant que
  l'interrupteur vaut `'proprietaire'`.
- **Preuves** :
  - `audit-agent-battement.cjs` (la vraie route dans un `vm`, le vrai Postgres
    jetable de K3, faux eBay qui compte, deux vendeurs, deux comptes eBay chez
    l'un) : chaque requête porte `owner=eq.` du bon vendeur ; un jeton de A jamais
    présenté pour B ; `'0'` ⇒ 0 appel ; `'proprietaire'` ⇒ seul l'owner servi ;
    abonnement `false` ⇒ 0 appel, `null` ⇒ lectures seulement ; première lecture :
    une commande **expédiée** ⇒ silence, deux **payées non expédiées** ⇒ 2 lignes
    et **1** notification groupée ; notification aux trois états de R21 ; marqueur
    pas su ⇒ aucun N° ; `VRM-559` ⇒ N°10 ; route qui répond 401 à chaque battement
    ⇒ alarme au secours de 08:00 alors que `dernier_tic` avance ; un appel eBay qui
    pend ⇒ coupé à 10 s (R7).
  - `audit-agent-vie.cjs` scénarios 1, 6, 10, 11, 20, 23 (synthèse §15.2).
  - Mutations : filtre `owner` retiré · interrupteur ignoré · `historique` = toute
    commande à la première lecture · l'état « je ne sais pas » retiré de la
    notification · `numeroExterne` recopié de l'app (⇒ `VRM-559` lu 559) · alarme
    sur `dernier_tic` · délai d'appel retiré.
- **Non mesurable** : le délai réel `pg_net` → `vrm.center` ; « Fluid compute »
  actif (le `maxDuration` posé tient dans les deux cas) ; la consommation Vercel
  (onglet Usage, une semaine après).
- **Julien** : dire **oui à la migration 015** ; poser **`VRM_BATTEMENT_SECRET`**
  (64 caractères aléatoires, « sensitive », production) puis la **même valeur**
  dans le coffre de la base (`select vault.create_secret('<valeur>',
  'vrm_battement_secret');`) ; **ne jamais** ajouter le schéma `net` aux schémas
  exposés de l'API ; mettre l'interrupteur d'installation à `'proprietaire'`, puis
  allumer **son** agent dans eBay → Agent.

---

### K6 — L'écran « Agent » : le pouls, les interrupteurs, le journal, la re-vérification

- **Ce que Julien voit** : un sous-onglet **eBay → Agent** (Achats ne s'affiche
  que s'il y a des achats eBay) :
  1. **le pouls**, une ligne : « Agent actif · dernier passage il y a 40 s · rien
     n'attend ton clic » ; « en répétition (bordereaux) depuis 3 jours · 12
     décisions à relire » ; « arrêté (ton choix) » ; « arrêté : abonnement » ;
     « eBay a refusé la connexion de {pseudo} — Reconnecter » ; pour le propriétaire
     de l'installation seulement : « l'horloge bat, mais VRM refuse les battements
     (code 401) ». **« Pas su » est gris, sans diagnostic** ;
  2. **« Ce que VRM fait seul »**, quatre familles : **Vendre** (retrait d'eBay VRM
     fermé, pause, prix, offres) · **Expédier** (voie du bordereau **par compte**,
     prestataire relié ✓/refusé/pas su, colis type, imprimante, délai de grâce,
     plafonds TTC et leur consommation du jour) · **Parler au client** (messages,
     textes) · **Protéger** (évaluations, alertes, sonnettes eBay) — chaque réglage
     dit « répétition » ou « réel » ; un gros bouton **« Arrêter l'agent »** (sans
     confirmation ; reprendre en demande une) ;
  3. **« Ce que VRM a fait en ton nom »**, le journal par jour, filtrable par
     compte et par N°, avec le texte exact et le montant ;
  4. dans Ma journée : « Hier, VRM a fait 4 choses en ton nom — les relire » ;
  5. les cinq gestes de R17 demandent **le mot de passe VRM** ; chaque changement
     sonne sur tous ses appareils (« tes clés Boxtal ont été changées à 03:12 — ce
     n'est pas toi ? Arrête l'agent »).
- **Zone** : `src/App.jsx` (nouveau composant `EbayAgent`, sous-navigation eBay,
  ligne de Ma journée, la porte d'abonnement qui affiche `engagements`),
  `api/ebay.js` (actions `agentetat`, `agentregler`, `agentarreter`,
  `agentreprendre`, `agentvalider`, `agentdefaire`, `agentrelire`, `agentjournal`,
  `reverifier`), `api/_lib/agent-reglages.js` (les maxima du serveur),
  `api/compte.js` (`mode=abonnement` rend `engagements`).
- **Dépend de** : K3, K4. **Parallèle à K5.**
- **La re-vérification** (R17) : action `reverifier {motDePasse}` ⇒ le serveur
  appelle GoTrue `POST /auth/v1/token?grant_type=password` avec l'email **de la
  session** (jamais un email reçu) et ferme aussitôt la session ainsi créée
  (`/logout`, portée locale) ; succès ⇒ `vrm_agent_vendeurs.reverif_jusqua =
  maintenant + 10 min`. Compte sans mot de passe (lien magique) : code par email
  (GoTrue `reauthenticate` [à vérifier sur son projet]). Échec 5 fois en 15 min ⇒
  20 min d'attente.
- **Les maxima du serveur** (un réglage au-delà est ramené au maximum, et l'écran
  le dit) : bordereau 25 € TTC · 30 bordereaux et 250 € par jour et par compte ·
  2 000 € par mois · 20 messages par jour et par compte · 3 messages par commande.
  Défauts : 12 € · 10 et 80 € · 300 € (des **propositions**, à valider avec lui).
- **Gardes** : `agentregler` versionné (périmé ⇒ 409, rien d'écrasé) ;
  `confirme:true` **et** la phrase affichée pour tout geste qui engage ; R17 ;
  `agentdefaire` relit l'état réel avant, et n'existe que pour ce qui se défait
  vraiment (R20).
- **Preuves** : `audit-agent-reglages.cjs` : maxima appliqués par le serveur ;
  version périmée ⇒ 409 ; les cinq gestes de R17 avec la seule session ⇒ 403
  `reverif` ; avec la re-vérification ⇒ passent et une notification part ; après
  un changement de clés ⇒ 24 h de répétition forcée ; `engagements` sans aucune
  chaîne d'acheteur. Mutations : re-vérification sautée · bornes lues dans le
  navigateur · « pas su » rendu vert. Banc `ebay-agent.cjs` (**4841**) : le pouls
  dans ses états (dont « pas su » gris, sans le mot « refusé »), les cinq gestes
  demandent le mot de passe et **rien ne part** avant, le journal se relit,
  « Arrêter » envoie `agentarreter` sans confirmation.
- **Julien** : rien d'obligatoire ; il découvre l'écran.

---

### K7 — Expédier, sans argent : Colis, Ma journée, voie eBay, « Imprimer la journée »

- **Ce que Julien voit** :
  - la vente eBay **dans les groupes existants de Colis** (« l'écran Colis se
    range sur ce qu'il peut faire ») : « **Ne poste pas** » en tête (annulation
    demandée) · « Prêts à imprimer » · « **Bordereau dans eBay** » (nouveau : la
    phrase commune dite une fois, un bouton par colis qui ouvre la page d'eBay de
    la commande) · « En attente » · « Partis » ; le compte eBay nommé une fois
    quand tout est sur le même (§7 du dossier) ;
  - Ma journée, le widget, la cloche et le rappel du matin comptent la vente eBay
    avec **le même nombre** que Colis ; rappels J-1 18 h et J 9 h s'il n'y a ni
    étiquette ni scan ;
  - le conseil, dit une fois : **acheter l'étiquette eBay au moment d'imprimer**
    (le soir), pas juste après la vente — l'acheter marque la commande expédiée et
    ferme la demande d'annulation de l'acheteur (extrait officiel, annonce eBay
    d'août 2024) ;
  - le soir, **« Imprimer la journée »** : une **liste de ramassage** triée par
    emplacement (Garage 3D), écrit « étagère 2 · case 3 », **jamais** au format d'un
    numéro (« B12 » est un numéro d'archive) [S6] ; puis un bordereau par feuille,
    Vinted et eBay mélangés, recto seul, tamponnés par `annotateAndDownloadBordereau`
    (le même code que Vinted) ; **Vinted en profite aussi** ;
  - une étiquette achetée dans eBay **glissée** dans VRM : tamponnée **seulement**
    si son n° de suivi est **exactement** celui qu'eBay porte sur une de ses
    commandes (relu chez eBay) ; sinon imprimée sans tampon, et c'est dit ; sinon
    une **fiche carton** A6 (N°, titre, n° de commande).
- **Zone** : `src/App.jsx` (Colis, `toShip`, Ma journée, impression, liste de
  ramassage, fiche carton), `api/widget.js`, `api/ship-reminders.js` (la part
  « rappel du matin » de `traiterVendeur` — pas le mode `battement`),
  `api/_lib/agent/expedier.js`, `api/ebay.js` (actions `bordereauglisse`,
  `expedier`), `api/_lib/ebay-regle.js` (recopie += `aExpedierEbay`).
- **Dépend de** : K5.
- **Appels** : Fulfillment `getShippingFulfillments(orderId)` toutes les 2 h en voie
  eBay jusqu'à `shipByDate` + 1 jour ; `createShippingFulfillment` **seulement**
  pour un suivi **tapé** par lui (action `expedier`, `confirme:true`).
- **Règles** : `aExpedierEbay` (spec `expedier`), une règle pour Colis, Ma
  journée, cloche, widget, rappel (§11 du dossier) ; « Ne poste pas » =
  `cancelRequests` ≠ refusé/clos (inconnu ⇒ demandée) ; `pickupStep` ⇒ rien à
  expédier ; authentification ⇒ « vers l'authentificateur d'eBay » ; un suivi tapé
  doit avoir **la forme** du transporteur [S3] ; `bordereauglisse` lit le PDF par
  `relevePage` et **ne garde rien** (R18) [S23].
- **Identité** : le N° par R2 sur `legacyItemId` + `creationDate` ; le suivi d'une
  étiquette eBay = `getShippingFulfillments` **de cette commande**.
- **Preuves** : `audit-ebay-expedier.cjs` (spec) **+** annulation demandée jamais
  comptée « à poster » ; le **même** nombre dans l'app et dans la copie serveur ;
  rappels annulés dès le scan ; `bordereauglisse` ne tamponne que sur un n°
  **exact** (n° voisin ⇒ pas de tampon) et n'écrit rien ; suivi tapé de mauvaise
  forme ⇒ refusé ; `pickupStep` ⇒ 0 « à poster ». Mutations : annulation comptée ;
  tampon sur un n° approchant ; widget recalculé à part. Banc `ebay-colis.cjs`
  (**4843**) : ordre des groupes, « Ne poste pas » en tête, liste de ramassage
  puis une feuille par bordereau **tamponnée** (flux décompressés, comme
  `lbc-bordereau.cjs`), aucun emplacement au format d'un numéro.
- **Non mesurable** : l'adresse exacte de la page d'eBay.fr où l'on achète
  l'étiquette d'une commande (repli : la page de la commande dans le Seller Hub)
  ; la forme d'un n° Mondial Relay rendu par `getShippingFulfillments`.
- **Julien** : rien.

---

### K8 — Les doubles et le retrait d'eBay, VRM fermé

- **Ce que Julien voit** : dans eBay → Agent → Vendre, une **nouvelle** famille
  « Retirer d'eBay une paire vendue ailleurs, **même VRM fermé** », qui démarre
  **en répétition** et qu'il rallume **en lisant sa portée** (VRM fermé · preuve
  par bordereau avec l'état de la vente lu · Leboncoin · règle de la décision 2)
  [S12] ; les notifications `double` (« vendue sur eBay, encore en ligne sur
  Vinted (tomj683) — retire-la », « vendue deux fois — annule une des deux
  ventes », le gel sans nom de paire) ; l'interrupteur d'aujourd'hui (app ouverte)
  ne change pas de sens.
- **Zone** : `api/_lib/agent/doubles.js`, `api/ebay.js` (action `veiller` ;
  extraction de `retirerAnnonceAuto` hors de `handleRetirer`, mêmes contrôles :
  réglage relu chez le vendeur, `GetItem` puis SKU comparé), `src/App.jsx`
  (famille dans l'écran Agent, publication de `vinted_accounts_blocked` vers le
  serveur, `EXT_CAPACITES.veilleebay`), `vinted-sync-extension/background.js`
  (la sonnette), `api/_lib/ebay-regle.js`.
- **Dépend de** : K1, K5 (et K6 pour l'écran de la famille).
- **Appels** : **aucun appel eBay pour décider** (lectures projetées en base) ;
  pour agir : Trading `GetItem` puis `EndFixedPriceItem` (`NotAvailable`), sous le
  garde-quota en priorité « obligation », 5 par passage.
- **La sonnette de l'extension** : après l'écriture **réussie** d'une vente
  nouvelle (`orders_sold`) **ou d'une preuve** (`label_{tx}` avec `item`,
  `txn_{tx}` avec un état), `POST /api/ebay {action:'veiller'}` avec **sa** session
  VRM ; au plus une par 2 min, la dernière jamais perdue (`chrome.storage.local`,
  §4.9 du dossier). Elle planifie `vendeur:doubles`.
- **Gardes** : §5.4 (preuve **avec état lu** ; transaction absente ⇒ pas su ⇒ 0
  retrait ; gel) ; règle `vue_le` (décision 2) ; R2 ; R3 ; `deux_annonces` ⇒ signalé
  ; comptes bloqués publiés depuis moins de 7 jours, illisibles ⇒ « pas su » (jamais
  « aucun ») ; revérification +10 min, +1 h, +6 h, +24 h après chaque publication
  eBay ; `vrm_agent_preuves.vue_le` écrit la première fois qu'une preuve est vue.
- **Preuves** : `audit-ebay-retrait-serveur.cjs` (spec) **+** le cas 553 (preuve
  par bordereau avec état lu, annonce eBay 4 min après la vente, avant `vue_le`) ⇒
  retirée en réel, « aurait retiré » en répétition ; bordereau d'une vente
  **remboursée** ⇒ 0 ; transaction absente d'`orders_sold` ⇒ 0 ; N° sur deux fiches
  ⇒ 0 et signal ; même N° sur un autre compte eBay ⇒ signal seulement ; annonce
  publiée **après** `vue_le` ⇒ signal seulement ; marqueur pas su ⇒ 0. 
  `audit-veiller-ext.cjs` (le vrai `background.js`) : sonnette après une preuve
  rangée, **pas** après une écriture ratée ; frein de 2 min ; la dernière jamais
  perdue. Mutations : état lu non exigé · comptes bloqués `null` lus « aucun » ·
  la règle `vue_le` retirée (⇒ retrait d'une annonce republiée à dessein). Banc
  `ebay-retrait-serveur.cjs` (**4835**, spec).
- **Extension** : bump (5.170.0), `EXT_CAPACITES.veilleebay` (l'app ne dit « tes
  ventes Vinted retirent tes annonces eBay dans les minutes » qu'à une extension
  qui le sait).
- **Julien** : installer l'extension ; lire la nouvelle portée et passer la
  famille en réel quand il le veut (re-vérifié) ; trancher la décision 2.

---

### K9 — L'argent juste (spec `argent`)

- **Ce que Julien voit** : le CA eBay = **l'argent qu'il reçoit** (décision du
  3 octobre), jamais ce que l'acheteur paie ; « 182 € disponibles sur eBay —
  demande ton virement » (I14 ; depuis le 1ᵉʳ septembre 2026 eBay garde l'argent
  d'un particulier jusqu'à ce qu'il le demande, extrait officiel de l'aide
  eBay.fr) — **un lien**, jamais un geste.
- **Zone** : `src/App.jsx` (règles d'argent, montant d'`EbayVentes`),
  `api/_lib/ventes-regle.js` (`--recopie`), `api/ebay.js` (`handleFinances`),
  `api/_lib/ebay-signature.js`.
- **Dépend de** : K2, K4 (la clé de signature se range dans le coffre, pas dans
  `vrm_reglages`). **À livrer avant sa première vente eBay.**
- **Règles** : `totalDueSeller − totalMarketplaceFee` ; frais **absents** ⇒
  « inconnu » (jamais 0), sauf un particulier pour qui eBay rend **0** explicite ;
  autre devise ⇒ écartée et dite ; signature numérique RFC 9421 sur les appels
  Finances (obligatoire pour un vendeur européen, extrait officiel « Digital
  Signatures for APIs » ; `createShippingFulfillment` n'en a **pas** besoin).
- **Preuves** : `audit-urssaf.cjs` étendu, `audit-ebay-signature.cjs` (spec), banc
  `ebay-argent.cjs` (**4836**). Mutation : total acheteur remis.
- **Julien** : « Activer la lecture des paiements eBay » (un clic, spec `argent`).

---

### K10 — L'oreille : les notifications d'eBay

- **Ce que Julien voit** : dans Agent → Protéger, « sonnettes eBay : ✓ (testées
  lundi) » / « en panne depuis hier — VRM relit tes ventes toutes les 15 min en
  attendant » / « pas su » (gris) ; ses ventes eBay sonnent **dans la minute**.
- **Zone** : `api/compte.js` (mode `ebay-notif`), `api/_lib/agent-evenements.js`,
  `vercel.json` (réécriture `/api/ebay-notif`), `api/_lib/agent/notifs.js`,
  `api/ebay.js` (action `abonnernotif`), `api/email-inbound.js` (un email d'eBay
  transféré ⇒ sonnette `veille`, jamais une donnée — I19).
- **Dépend de** : K5 (la file), K4 (les portées `v2` de la reconnexion), K2 (la
  vérification de signature).
- **Appels** : `createDestination` (jeton d'application, adresse **fixe**, §4.6) ;
  `createSubscription` par compte et par sujet (jeton du compte) ;
  `POST /subscription/{id}/test` chaque semaine ; `getDestination` chaque jour ;
  `updateDestination {status: ENABLED}` sur `MARKED_DOWN` ;
  `GET /commerce/notification/v1/public_key/{kid}` (jeton d'application, gardé
  24 h en base **et** en mémoire).
- **Gardes** : §4.5 (204 après signature valide, même base en panne ; 412 ; 500
  seulement sans clé ; `kid` freinés) ; §4.6 (routage par `listingId`, jamais
  « tous les comptes ») ; R11 (révocation ⇒ renouvellement, pas « refusé ») ;
  dédoublonnage par `notificationId` ; cadence de la veille §4.7.
- **Preuves** : `audit-agent-evenements.cjs` (paire ECDSA générée par l'audit) :
  signature fausse ⇒ 412 et 0 écriture ; même `notificationId` deux fois ⇒ 1 tâche ;
  faux titre, prix, acheteur dans le corps ⇒ aucune de ces chaînes écrite ;
  `listingId` inconnu ⇒ 204 et 0 relecture ; **base en panne + signature valide ⇒
  204** ; 50 `kid` forgés ⇒ ≤ 10 lectures ; le défi calculé sur l'adresse fixe
  même quand `Host` diffère ; `MARKED_DOWN` lu ⇒ `updateDestination` et veille à
  15 min ; test d'abonnement revenu ⇒ veille à 60 min ; révocation rejouée après
  une reconnexion ⇒ compte `ok`. Mutations : signature non vérifiée · contenu de la
  sonnette cru · 500 sur base en panne · défi calculé sur `Host` · révocation lue
  comme « refusé ». Banc `ebay-veille.cjs` (**4842**).
- **Non mesurable** : la vraie notification `ORDER_CONFIRMATION` d'un vendeur
  eBay.fr (délai, `listingId` présent, signature sur le corps brut ou re-sérialisé)
  ; le seuil qui déclenche `MARKED_DOWN` ; un plafond d'adresses par application.
  **Le test d'abonnement en montre la forme sans attendre une vente.**
- **Julien** : rien de plus si sa reconnexion de K4 a pris le jeu `v2` ; sinon se
  reconnecter une fois.

---

### K11 — Le suivi jusqu'au client

- **Ce que Julien voit** : dans Colis « Partis », une ligne d'étape par colis
  (« parti le 11/10 », « attend au relais jusqu'au 14/10 », « livré le 12/10 ·
  preuve gardée ») ; dans Ma journée seulement ce qui demande un geste (« 1 colis
  pas encore scanné », « 1 colis bloqué depuis le 9/10 », « la N°… revient ») ;
  sur la vente (eBay → Ventes), la frise et la **preuve de livraison** ; « suivi
  pas lu pour 2 colis (Mondial Relay : pas d'accès direct) », dit **une fois**.
- **Zone** : `api/_lib/suivi-regle.js` (`etapeColis`, pur),
  `api/_lib/transport/laposte.js`, `api/_lib/agent/suivi.js`, `src/App.jsx`
  (lignes de « Partis », frise d'eBay → Ventes, lignes de Ma journée).
- **Dépend de** : K7.
- **Appels** : La Poste « Suivi v2 » `GET https://api.laposte.fr/suivi/v2/idships/{n°}`
  (en-tête `X-Okapi-Key`, clé d'installation `LAPOSTE_OKAPI_KEY`) pour Colissimo,
  Chronopost, Lettre suivie ; le prestataire pour un bordereau acheté par VRM
  (K14) ; `getShippingFulfillments` pour une étiquette eBay.
- **Le témoin email** (gratuit) : une ligne `email_track_*` ne compte que si son
  n° est **exactement** celui de l'envoi, **et** que son **transporteur** est celui
  de l'envoi, **et** qu'elle est **datée après** le bordereau (ou `shippedDate`) ;
  un « livré » qui arrive avant `pris_en_charge` est refusé ; la preuve garde sa
  **source** (prestataire, La Poste, email) [S18].
- **Gardes** : §5.6 (colis) ; alertes : pas scanné (48 h, même seuil que
  `posteSansDepart`), bloqué (5 jours ouvrés ou livraison estimée max + 3 jours
  ouvrés), au relais non retiré (date limite **lue**), renvoyé ; authentification
  ⇒ jamais « livré au client » ; preuve sans adresse ni nom de relais (R18).
- **Preuves** : `audit-ebay-suivi.cjs` : code inconnu jamais `livre` ; une étape
  ne recule pas ; « pas scanné » seulement sur un statut lu après le bordereau ;
  email daté d'avant le bordereau ⇒ ignoré ; email d'un autre transporteur au même
  n° ⇒ ignoré ; « pas su » jamais affiché « en transit ». Mutations : borne de date
  retirée · « pas su » ⇒ « en transit ». Banc `ebay-suivi.cjs` (**4844**).
- **Non mesurable** : le code La Poste « au point de retrait », la **date limite
  de retrait** dans la réponse, le quota de la clé gratuite.
- **Julien** : créer une **clé « Suivi » sur developer.laposte.fr** (compte
  gratuit) et la poser sur Vercel (`LAPOSTE_OKAPI_KEY`).

---

### K12 — Les photos hébergées chez eBay (Media API)

- **Ce que Julien voit** : une paire publiée depuis VRM a ses photos **chez eBay**
  (`i.ebayimg.com`), plus des liens Vinted signés qui peuvent expirer (la N°1 /
  553 en portait 16) ; si eBay refuse une photo, rien n'est publié et c'est dit.
- **Zone** : `api/_lib/ebay-media.js` (nouveau), `api/ebay.js` (le chemin des
  photos de `handlePublish` et `handleProgrammer`, `itemXml` `<PictureURL>`),
  `src/App.jsx` (`EbayPublier` : la phrase).
- **Dépend de** : K2 (seul K2 touche `itemXml` avant). **Parallèle à K3-K6.**
- **Appels** : Media API `createImageFromUrl` (URL de la photo) sur
  `https://apim.ebay.com/commerce/media/v1_beta/…` ; l'identifiant revient dans
  l'en-tête `Location` ; `getImage` rend l'URL eBay (EPS) et sa date d'expiration ;
  repli `createImageFromFile` (octets) si eBay ne lit pas l'adresse Vinted ; au
  plus 50 envois par 5 s. `UploadSiteHostedPictures` est **décommissionné depuis le
  30 septembre 2026** (extrait officiel, page « API deprecation status ») [D1].
- **Gardes** : `<PictureURL>` ne contient **jamais** `vinted.net` ; une photo
  refusée ⇒ aucune publication ; une image EPS non rattachée à une annonce est
  effacée par eBay au bout de 30 jours (extrait officiel) : on ne prépare pas les
  photos plus de quelques heures avant de publier.
- **Preuves** : `audit-ebay-media.cjs` : publication ⇒ chaque `<PictureURL>` est
  une adresse rendue par `getImage` ; Media en échec ⇒ 0 `AddFixedPriceItem` ;
  rythme ≤ 50 / 5 s. Mutation : repli sur l'adresse Vinted. Banc : `ebay-form.cjs`
  étendu, ou `ebay-photos.cjs` (**4850**).
- **Non mesurable** : si eBay sait lire une adresse `images1.vinted.net` signée ;
  la portée OAuth exacte de la Media API ; la taille maximale d'un corps de requête
  Vercel pour le repli par octets (4,5 Mo [à vérifier]).
- **Julien** : rien.

---

### K13 — Les messages au client et l'évaluation

- **Ce que Julien voit** : dans Agent → Parler au client, des messages **éteints
  par défaut**, chacun avec son texte modifiable et **l'aperçu du texte rendu** :
  « merci » · « au relais jusqu'au {date} » (J-2 à 10 h, **le premier conseillé**)
  · « livré le {date} » (+ phrase d'évaluation facultative, second interrupteur) ;
  « problème de transport » = **préparé, sur son clic** ; le journal garde le
  texte exact.
- **Zone** : `api/_lib/agent/messages.js`, `api/_lib/messages-regle.js` (R13, pur),
  `src/App.jsx` (Parler au client), `api/ebay.js` (actions `messagepreparer`,
  `messageenvoyer`).
- **Dépend de** : K11, K6.
- **Appels** : Trading `AddMemberMessageAAQToPartner` (jeton du compte qui porte la
  commande ; `RecipientID` relu sur la commande, jamais reçu du navigateur ;
  jusqu'à 90 jours) ; évaluation : `GetItemsAwaitingFeedback` d'abord, puis
  `LeaveFeedback` **positive seulement**.
- **Gardes** : R13, R14, R12 (mémo **avant**, vérifié ; incertain jamais renvoyé),
  R4 pour « merci » (pas sur une paire prouvée vendue ailleurs), R16 (premier de
  chaque type confirmé), R19 ; plafonds 20 par jour et par compte, 3 par commande ;
  aucun message sur « pas su », sur une commande annulée ou en authentification ;
  un refus d'eBay jamais réessayé dans l'heure ; changer un texte exige R17.
  **Recommandé à Julien** : l'évaluation par le réglage **natif** d'eBay
  (« Automatiser les évaluations ») ; la version VRM « après livraison » reste
  éteinte et dit à l'allumage qu'une évaluation ne se retire pas.
- **Preuves** : `audit-agent-messages.cjs` : éteint ⇒ 0 ; mémo illisible ou non
  écrit ⇒ 0 ; deux passages ⇒ 1 ; date limite inconnue ⇒ pas de J-2 ; message dû à
  3 h ⇒ parti à 9 h ; texte rendu avec une URL, un email, un téléphone, une `{`,
  « Vinted », « Instagram », « @julien », « point com », « en dehors d'eBay » (dans
  le corps **ou la signature**) ⇒ refusé ; plafonds ; > 90 jours ⇒ 0 ; coupure ⇒
  « incertain », jamais renvoyé ; mémo gardé à J+60 ; anonymisation du journal.
  Mutations : contrôle d'autre plateforme retiré · mémo écrit après l'envoi ·
  fenêtre horaire retirée. Banc `ebay-messages.cjs` (**4846**).
- **Non mesurable** : la longueur maximale et ce que voit l'acheteur (un message,
  sur sa prochaine vente, sur son clic).
- **Julien** : choisir ses messages ; allumer l'évaluation automatique **dans
  eBay**.

---

### K14 — Les bordereaux achetés par VRM (seulement quand eBay laisse le choix)

⛔ **GELÉ par la décision du 11 octobre (§0bis) : c'est l'acheteur qui paie le bordereau.** Ne pas construire pour Julien ; jamais sans un port facturé à l'acheteur ≥ devis.


**Porte d'entrée, mesurée, sans laquelle ce chantier ne commence pas** [D5, D9] :
1. **au moins une vraie commande eBay lue « étiquette libre »** (politique lue au
   niveau 1455, champ absent), sur le compte de Julien ou d'un autre vendeur. Si
   toutes ses commandes portent `EBAY_ONLY`, ce chantier **ne lui servira pas** —
   et c'est le plus probable (eBay refuse déjà tout mode de livraison venant de
   VRM sur son compte) ;
2. **le bac à sable du prestataire mesuré** : la clé qui marche sur le devis (la
   v3 de Boxtal n'a pas de devis ; la bibliothèque officielle v1 s'authentifie par
   **identifiant et mot de passe** du compte, une bibliothèque testée dit que les
   clés v3 suffisent — code lu, contradictoire) ; le prix rendu par la commande ;
   l'encodage de `x-bxt-signature` ; la correspondance des codes d'offre
   (`MONRCpourToi` au devis, `MONR-CpourToi` à la commande) ; la réponse à deux
   `POST` de même référence (Boxtal `externalId`, Sendcloud
   `external_reference_id` : le support de Sendcloud dit que ses `POST` de
   création « tentent d'être idempotents » — extrait officiel —, une réponse 409
   avec l'envoi existant est rapportée par la relecture [à vérifier]) ;
   **si la v1 de Boxtal exige le mot de passe : Sendcloud passe premier. Jamais un
   mot de passe dans le coffre** ;
3. la **politique de confidentialité** dit que VRM transmet l'adresse de livraison
   au prestataire choisi par le vendeur, et garde le bordereau jusqu'à la
   livraison (R18).

- **Ce que Julien voit** : dans Agent → Expédier, par compte eBay : « j'achète mes
  bordereaux dans eBay » (défaut) ou « VRM les achète » ; « Relier Boxtal » (ou
  Sendcloud) : il colle ses clés **après re-vérification** (R17), VRM les teste par
  une lecture inoffensive et dit « ✓ » ; son colis type (à peser), son adresse
  d'expédition, son imprimante, le délai de grâce (2 h, réglable 0-24 h, jamais
  après `shipByDate − 24 h`), ses plafonds **TTC** ; la famille démarre en
  **répétition** (« aurait acheté Colissimo domicile, 8,40 € TTC, pour la N°… »,
  à côté de ce qu'il a fait lui-même), puis « prépare, je confirme », puis
  « achète seul » ; la confirmation montre prix TTC, transporteur, **ville**, poids
  et N° ; « Annuler » n'envoie rien ; dans Colis, « À confirmer » et « Prêts à
  imprimer ».
- **Zone** : `api/_lib/transport/boxtal.js`, `api/_lib/transport/sendcloud.js`,
  `api/_lib/agent/bordereau.js`, `api/_lib/agent-ebay-regle.js` (la voie `vrm` de
  §5.5), `api/ebay.js` (actions `coffreposer`, `coffretester`, `coffreretirer`,
  `bordereaudevis`, `bordereauacheter`, `bordereauannuler`, `bordereauincertain`,
  `bordereaupdf`, `declarermaintenant`), `api/compte.js` (mode `transporteur`),
  `vercel.json` (réécriture `/api/transporteur/:k`), `src/App.jsx` (Agent →
  Expédier, confirmation, Colis « À confirmer »), `public/legal/` (politique de
  confidentialité).
- **Dépend de** : K4, K6, K7, K11 (et la porte d'entrée ci-dessus).
- **L'interface prestataire** : synthèse §9.2, avec `idempotentParRef: false` pour
  **les deux** prestataires tant que la mesure 2 n'est pas faite (R6), et
  `acheter` qui rend `{id}` **sans** suivi (Boxtal ne rend que
  `shippingOrder.id` ; le suivi et les documents arrivent par `TRACKING_CHANGED`
  et `DOCUMENT_CREATED`, extrait officiel) [S3].
- **L'achat, pas à pas** (synthèse §9.3, corrigée) :
  1. relire chez eBay (`getOrder`, jeton du compte) : `PAID`, pas `FULFILLED`,
     aucun envoi déclaré (`getShippingFulfillments` vide — ce qui arrête aussi un
     vendeur qui aurait branché l'intégration eBay native de son prestataire),
     aucune annulation, adresse complète ; un « pas su » ⇒ pas d'achat ;
  2. relire la politique d'étiquette ; présente ou illisible ⇒ voie eBay ;
  3. **R4** : N° non prouvé vendu ailleurs, aucun gel sur le compte d'origine,
     ventes de ce compte relues **après** la vente eBay ⇒ sinon `a_confirmer` avec
     la raison [S1] ;
  4. devis (adresse lue maintenant, jamais rangée ; point relais **lu** par
     identité sinon voie eBay ; poids §5.5 ; **son** transporteur préféré, jamais
     « le moins cher » en silence) ;
  5. le mode (répétition ⇒ « aurait acheté » ; « prépare » ou premier achat du
     compte ⇒ `a_confirmer` + notification `agent`) ;
  6. réserver (TTC × 1,15, R15) et écrire `etiquette_en_cours` (R5), **sous la clé
     d'idempotence globale `achat:{orderId}`** (R10) ;
  7. commander (référence `vrm-{orderId}`, délai R7) ; succès ⇒ **l'identifiant
     d'envoi au journal d'abord**, puis l'état `etiquette_achetee` ; refus net ⇒
     réservation rendue, raison du prestataire telle quelle ; 409 portant
     l'envoi de **notre** référence ⇒ « déjà acheté », on le reprend ; coupure ⇒
     `etiquette_incertaine` ⇒ R6 ;
  8. le PDF (webhook `DOCUMENT_CREATED`, ou relu : chez Boxtal un 422 juste après
     la commande veut dire « pas prêt », réessai à 30 s, 2 min, 10 min) ;
     téléchargé **seulement chez l'hôte du prestataire** (liste blanche par motif),
     vérifié `%PDF`, rangé brut, purgé selon R18 ;
  9. le suivi : seulement d'un évènement ou d'une lecture **pour cet envoi**, avec
     la forme du transporteur [S3] ;
  10. **déclarer à eBay au premier scan** (`createShippingFulfillment`, code
      transporteur lu dans `vrm_reglages.ebay_transport_fr` — absent ⇒ pas de
      déclaration, jamais `Other`), après relecture de `cancelRequests` [S2] ;
      `shipByDate` 18 h sans scan ⇒ notification et bouton
      `declarermaintenant` (décision 3) ;
  11. journal (prix TTC du devis, poids, transporteur, référence) ; le « coût
      réel » du port n'est écrit qu'avec la facture du prestataire (R15).
- **Le chemin « clic »** (`bordereauacheter`) appelle **la même** fonction sous le
  **même** bail (R8) ; un double clic ⇒ un achat.
- **Les webhooks** : Boxtal — VRM crée l'abonnement avec un secret tiré par le
  serveur (ne reçoit que les envois de **la même application**, donc les clés du
  vendeur) ; Sendcloud — l'adresse `/api/transporteur/{k}` se règle **dans
  l'intégration, chez le vendeur** (un geste de plus pour lui), signée avec la clé
  secrète de l'intégration [D10]. Vérification HMAC sur le corps brut avec le
  secret de **ce** vendeur ; encodage accepté seulement celui que le bac à sable a
  montré ; un évènement ne fait que **réveiller** la tâche de la commande dont la
  référence `vrm-{orderId}` est **à ce vendeur**.
- **Annuler un bordereau inutile** (synthèse §9.9, corrigée) : « aucun scan »
  exige une **lecture du suivi réussie**, faite **après** l'annulation **et** au
  moins 24 h après elle ; lecture ratée ou transporteur non couvert ⇒ **proposé,
  jamais fait** [S17] ; Packlink ⇒ dit (ticket).
- **Plusieurs paires dans une commande** : un bordereau ; poids = somme des poids
  validés, dimensions confirmées, sinon `attendre` [S19].
- **Re-vérification** (R17) pour poser des clés, passer en réel, monter un
  plafond, changer l'adresse d'expédition ; après un changement de clés : 24 h de
  répétition forcée et premier achat reconfirmé [S7].
- **Preuves** : `audit-agent-bordereau.cjs` (faux Boxtal **à la forme documentée**
  : pas de suivi à la commande, 422 juste après ; faux Sendcloud **non
  idempotent** tant que la mesure ne dit pas le contraire) : `EBAY_ONLY` ⇒ 0 ;
  politique pas sue ⇒ 0 ; pays ≠ FR, référence de programme, `pickupStep` ⇒ 0 ;
  relais sans point lu ⇒ 0 ; poids pas su ⇒ 0 ; deux paires sans somme ⇒ 0 ;
  **vente Vinted du même N° prouvée 90 min après la vente eBay ⇒ 0 achat, 0
  déclaration, 1 notification `double`** ; gel ⇒ 0 ; au-dessus du plafond TTC ⇒ 0
  et « à confirmer » ; un seul `POST` par référence ; **coupure après le `POST` ⇒
  0 second achat sur 7 jours simulés** (Boxtal **et** Sendcloud) ; prestataire qui
  répond en 130 s ⇒ issue retrouvée au journal, 1 achat ; double clic ⇒ 1 achat ;
  **aucune déclaration avant le premier scan** ; identifiant Boxtal jamais déclaré
  comme suivi ; PDF d'un autre hôte ⇒ refusé ; répétition ⇒ 0 appel payant ;
  deux vendeurs, un même compte eBay ⇒ refusé au titulaire ; suivi illisible +
  annulation ⇒ 0 annulation de bordereau ; clés posées par la seule session ⇒ 403.
  Mutations : état écrit après l'achat · plafond rendu sur un incertain ·
  HMAC non vérifié · R4 retirée (⇒ 1 achat sur une paire vendue) · déclaration à
  l'achat (⇒ annulation fermée trop tôt) · id prestataire rangé comme suivi ·
  second `POST` sur incertain · clé d'idempotence par owner (⇒ 2 achats chez deux
  vendeurs). Banc `ebay-bordereau.cjs` (**4845**) : la confirmation montre prix
  TTC, ville, poids, N° ; « Annuler » n'envoie rien ; « il n'y en a pas : réessaie »
  **absent** avant 24 h.
- **Non mesurable d'ici** : tout ce que liste la porte d'entrée ; le format
  10 × 15 par transporteur ; les régularisations de poids ; une limite de dépense
  réglable chez le prestataire [à vérifier] ; une API de facture.
- **Julien** (seulement si une commande « libre » existe et qu'il veut) : compte
  **pro** Boxtal (SIRET) · **prélèvement différé** (mandat SEPA) · une
  « application API v3 » · **bac à sable d'abord** · coller les clés dans VRM ·
  **peser une boîte** · régler, **chez le prestataire**, toute limite de dépense
  qui existe · plafonds dans VRM · répétition, puis « prépare, je confirme », puis
  « achète seul ».

---

### K15 — La boîte, l'après-vente et le niveau vendeur

- **Ce que Julien voit** : les questions et messages eBay dans Messages, avec une
  réponse **préparée** (sur son clic ; l'IA serveur est éteinte aujourd'hui ⇒
  bouton grisé et champ libre) ; annulations, retours, réclamations dans Ma
  journée avec leur date limite et le lien eBay ; pour « objet non reçu », la
  preuve de livraison et la réponse préparée ; son niveau vendeur **avant le 20**
  (I15).
- **Zone** : `api/_lib/agent/boite.js`, `api/_lib/agent/apresvente.js`,
  `src/App.jsx` (Messages, Ma journée), `api/ebay.js` (actions des specs `boite` et
  `litiges`).
- **Dépend de** : K10 (les sonnettes `BUYER_QUESTION`, `NEW_MESSAGE`), K11 (la
  preuve), K13 (le message préparé).
- **Gardes** : **aucune** relecture périodique de la boîte (D6) : sur sonnette ou
  sur son clic ; la **Message API REST** seulement si `EBAY_FR` est confirmé
  [à vérifier] ; chaque route Post-Order **revérifiée** contre les retraits du
  20 janvier et du 2 février 2026 (extrait officiel, notes de version Post-Order
  2.8.0) avant d'être écrite [D12], et son quota ajouté au budget ; offres : la
  règle d'offre native seulement (`audit-offres-auto.cjs`).
- **Preuves** : les audits et bancs des specs `boite` (**4837**), `litiges`
  (**4839**), `visibilite` (**4840**), plus : une question reçue sans sonnette ⇒
  aucun appel de lecture ; une route Post-Order retirée ⇒ absente du code.
- **Julien** : rien (la reconnexion `v2` de K4 porte les droits).

---

### K16 — Les annonces vivantes et les prix

- **Ce que Julien voit** : pause plutôt que fin (si le « hors stock » d'eBay est lu
  actif), « la paire revient : remettre en vente ? » (frais vérifiés à blanc),
  baisse proposée des paires qui dorment (jamais sous son plancher, ni au seuil de
  sa règle d'offre), offre aux observateurs **proposée** (≥ 2 observateurs, 14
  jours sans vente), mise en vente en lot **seulement** si la fenêtre de double
  vente mesurée est courte (I2).
- **Zone** : specs `annonces-vivantes` et `publier-lot` ; `api/_lib/agent/prix.js`,
  `src/App.jsx` (eBay → Annonces).
- **Dépend de** : K8, K10, K12.
- **Gardes** : **R4 avant toute baisse et toute offre** [S1] ; pas de plancher ⇒
  rien ; −5 % par palier, une fois par 7 jours, −20 % au total ; aucune offre en
  attente ; l'offre automatique aux observateurs est la décision 4 (§9).
- **Preuves** : `audit-agent-prix.cjs` : jamais sous le plancher, jamais sans
  plancher, jamais au seuil de la règle d'offre, une fois par 7 jours, **0 baisse
  sur une paire prouvée vendue ailleurs ou gelée**. Banc `ebay-vivantes.cjs`
  (**4848**).
- **Julien** : saisir des prix d'achat ou des planchers (sans eux, rien ne baisse).

---

### K17 — « Brancher ton agent » et le bilan de la semaine

- **Ce que Julien voit** (et chaque nouvel abonné) : « Brancher ton agent eBay »,
  une étape à la fois (modèle `PremiersPas`), chacune **à son état mesuré** : eBay
  relié ✓ · sonnettes eBay testées ✓ · comment tu expédies (eBay, ou relier un
  prestataire) · colis type et imprimante · plafonds · répétition 3/7 ; jamais
  « c'est prêt » à l'avance. Le bilan de la semaine gagne une ligne : « l'agent a
  acheté 3 bordereaux (24,60 € TTC, devis), suivi 5 colis, écrit 2 messages ».
- **Zone** : `src/App.jsx` (premiers pas eBay), `api/_lib/bilan-semaine.js`.
- **Dépend de** : K5, K6 (K14 pour l'étape prestataire).
- **Preuves** : banc `ebay-brancher.cjs` (**4849**) : chaque étape à trois états ;
  « pas su » jamais affiché « fait ». `audit-bilan-semaine.cjs` étendu (ligne de
  l'agent, partielle quand le journal est illisible).

---

## 7. Les trois preuves transversales

1. **`scripts/audit-agent-sql.cjs`** (K3) : la migration 014 exécutée sur un
   Postgres jetable ; contrôles et mutations de K3.
2. **`scripts/audit-agent-regle.cjs`** (K5, étendu par K11, K13, K14) : `decider`,
   `voieEtiquette`, `etapeColis`, le contrôle des messages, exécutés sur une
   matrice, avec **chaque** invariant de §5.3 sur **chaque** cas, titre muté
   compris.
3. **`scripts/audit-agent-vie.cjs`, le banc de vie** (K5, étendu à chaque
   chantier) : des commandes vécues de la vente à la clôture sur une **horloge
   simulée** ; le vrai `api/ship-reminders.js?mode=battement` et la vraie porte
   `api/compte.js` dans un `vm` ; le Postgres jetable de K3 ; des faux eBay,
   Boxtal, Sendcloud, La Poste et Web Push **à la forme documentée**, qui comptent
   chaque appel ; deux vendeurs, deux comptes eBay chez l'un.

   **Les scénarios** : les 23 de la synthèse §15.2, **corrigés** (le scénario 3
   déclare au premier scan, plus à l'achat ; le scénario 5 attend « 0 second
   achat », plus « relecture par référence » ; le scénario 21 passe par
   `numeroExterne` et le marqueur : la paire s'appelle N°1), **plus** :

   | # | ce qui est servi | attendu | vient de |
   |---|---|---|---|
   | 24 | vente eBay 14 h 02 ; vente Vinted du même N° à 13 h 40, prouvée à 15 h 30 | 0 achat, 0 déclaration, 1 notification `double` | S1 |
   | 25 | achat Boxtal à la forme documentée (pas de suivi à la commande) | 0 déclaration avant le suivi **et** le premier scan | S2, S3 |
   | 26 | Sendcloud **non** idempotent + coupure après le `POST` | 1 envoi, `etiquette_incertaine`, ta question | S4 |
   | 27 | deux vendeurs VRM reliant le même compte eBay | le second refusé ; 1 achat, 1 message | S5 |
   | 28 | marqueur illisible | 0 N°, 0 retrait, 0 achat, notification « N° inconnu » | S6 |
   | 29 | `VRM-559` sur `128086452103` + une nouvelle paire N°559 | lu N°10 ; la vente Vinted de la nouvelle 559 ne retire rien | S6 |
   | 30 | clés du prestataire changées par la seule session | 403 `reverif` | S7 |
   | 31 | base en panne + suppression de compte signée | 204 | S8, D3 |
   | 32 | signature « retrouvez mes paires sur Vinted » | refusée | S10 |
   | 33 | vente jamais prouvée, J+4 | publication refusée ; ligne Ma journée | S11 |
   | 34 | bordereau d'une vente remboursée ; transaction absente d'`orders_sold` | 0 retrait | S13 |
   | 35 | allumage avec 2 commandes payées non postées | 2 lignes Colis, 1 notification, rappels | S14 |
   | 36 | prestataire qui répond en 130 s ; double clic | issue retrouvée au journal ; 1 achat | S15 |
   | 37 | suivi illisible + commande annulée + 24 h | 0 annulation de bordereau, proposée | S17 |
   | 38 | email « livré » daté d'avant le bordereau | ignoré | S18 |
   | 39 | commande vers l'Allemagne avec référence de programme ; retrait sur place | voie eBay ; rien à expédier | S19 |
   | 40 | révocation rejouée après une reconnexion | compte `ok` | S21 |
   | 41 | route qui répond 401 à chaque battement pendant 2 h | alarme sur `dernier_succes` | D4 |
   | 42 | adresse eBay `MARKED_DOWN` | rallumée le jour même, veille à 15 min | D3 |
   | 43 | compte sans vente, test d'abonnement revenu | veille à 60 min | D2 |
   | 44 | dans une seule journée simulée, 300 comptes actifs | Trading ≤ 5 000, obligations servies | D6 |

   **Mutations, chacune rouge** : celles de la synthèse §15.2, **plus** R4
   retirée · déclaration à l'achat · second `POST` sur incertain · clé
   d'idempotence par owner · `numeroExterne` recopié de l'app · re-vérification
   sautée · 500 sur base en panne · gel qui tombe à 72 h · état de vente non exigé
   · `historique` sur une commande payée · délai d'appel retiré · alarme sur
   `dernier_tic` · cadence 15 min sans test.

---

## 8. Les gestes uniques de Julien, dans l'ordre

| # | quand | geste | où |
|---|---|---|---|
| 1 | **maintenant** | **terminer l'annonce eBay `128127336988`** (« Autry reelwind beige taille 36 », 120 € ; dans VRM c'est la **N°1**, ancienne 553 ; vendue sur Vinted le 10/10) | eBay → Mes annonces → mettre fin |
| 2 | maintenant | **relier l'annonce `128101592740`** à sa paire | VRM → eBay → Annonces → « Relier à une paire » |
| 3 | K1 | installer l'extension **5.169** (un seul dossier VRM), recharger les onglets Vinted | `chrome://extensions` |
| 4 | K1, puis au fil de l'eau | relier les ventes que VRM présente « jamais reliées » | Ma journée |
| 5 | K4 | poser **`VRM_COFFRE_CLE`** (« sensitive », production) **et en garder une copie hors ligne** | Vercel + son gestionnaire de mots de passe |
| 6 | K4 | **retirer VRM des applications autorisées de son compte eBay**, puis **« Reconnecter (une fois) »** dans VRM (le nouveau jeton va au coffre, avec les droits de la suite) | eBay → Mon compte → autorisations ; VRM → eBay → Compte eBay |
| 7 | K4 | confirmer l'effacement des jetons dans les sauvegardes du 30 septembre et du 2 octobre | à l'écran de l'outil SQL (confirmation humaine) |
| 8 | K5 | **oui à la migration 015** (l'horloge : `pg_cron`, `pg_net`) | une réponse |
| 9 | K5 | poser **`VRM_BATTEMENT_SECRET`** (64 caractères, « sensitive »), puis la **même** valeur dans le coffre de la base | Vercel ; Supabase → SQL Editor |
| 10 | toujours | **ne jamais** ajouter le schéma `net` aux schémas exposés de l'API | Supabase → Settings → API |
| 11 | K5 | mettre l'interrupteur d'installation à « propriétaire », puis allumer **son** agent | Supabase ; VRM → eBay → Agent |
| 12 | K8 | lire la portée du retrait « VRM fermé » et le passer en réel quand il veut | VRM → eBay → Agent → Vendre |
| 13 | K9 | « Activer la lecture des paiements eBay » | VRM → eBay → Compte eBay |
| 14 | K11 | créer une **clé « Suivi » La Poste**, la poser en `LAPOSTE_OKAPI_KEY` | developer.laposte.fr, puis Vercel |
| 15 | K13 | choisir ses messages (le **rappel J-2 au relais** d'abord) ; allumer **« Automatiser les évaluations »** dans eBay | VRM → eBay → Agent ; eBay → Préférences de vente |
| 16 | **à sa première vente eBay** | rien : regarder ce que VRM dit de la politique d'étiquette | VRM → eBay → Ventes |
| 17 | K14, **seulement** si une commande « libre » existe et qu'il le veut | compte pro Boxtal, prélèvement différé, application v3, **bac à sable d'abord**, clés dans VRM, **peser une boîte**, limite de dépense chez le prestataire, plafonds, répétition | Boxtal, puis VRM |
| 18 | K16 | saisir des prix d'achat ou des planchers | VRM → Annonces (saisie en série) |
| 19 | **avant d'ouvrir l'agent à un autre vendeur** | **passer Vercel en Pro** ; demander l'**« Application Growth Check »** à eBay (gratuit) ; puis l'interrupteur à « tous » | vercel.com → Billing ; developer.ebay.com [chemin exact à vérifier] |

---

## 9. Ce que Julien doit trancher (aucune n'est urgente)

| # | décision | recommandation | pourquoi |
|---|---|---|---|
| 1 | **Vercel Pro** | **oui**, avant que l'agent serve un autre vendeur, et avant les abonnés payants | Hobby est « non commercial » ; dépasser l'inclus y met **tout VRM** en pause (4 h de CPU, 360 Go-h, 1 M d'appels par mois, extrait officiel) [D7] |
| 2 | **L'exception « annonce eBay publiée après la vente »** du retrait automatique | **la remplacer** par « une annonce publiée après que VRM a **vu** la preuve n'est que signalée » (§5.4) | elle a écarté la 553 (publiée 4 min après une vente que VRM ne voyait pas) ; la retirer entièrement ferait retirer une annonce republiée à dessein [S13] |
| 3 | **Déclarer l'envoi à eBay le jour de `shipByDate` à 18 h** s'il n'y a pas encore de scan | **non** : déclarer au premier scan ; ce jour-là, une notification et un bouton | déclarer ferme la demande d'annulation de l'acheteur et affirme un envoi qui n'a peut-être pas eu lieu [S2] |
| 4 | **L'offre automatique aux observateurs** | **non pour l'instant** ; si oui : seulement sur une annonce avec règle d'offre, à un prix ≥ son seuil d'acceptation, ≥ 2 observateurs, 14 jours sans vente, une par 14 jours, R4 | une offre acceptée vend la paire |
| 5 | **Les réponses automatiques aux questions eBay** | d'abord **préparées** ; l'automatique après 20 réponses envoyées telles quelles, avec les gardes de Vinted | « elle répond à tout » (18 sept.) vaut pour Vinted ; eBay surveille les messages ; il faut une clé d'IA serveur, absente |
| 6 | **Un service de suivi payant pour Mondial Relay** | « pas su » + le témoin email d'abord ; décider après 10 ventes eBay | un sous-traitant de données de plus |
| 7 | **La clé La Poste** : une pour toute l'installation, ou une par vendeur | **une clé VRM**, résultats rangés par vendeur | elle ne lit que des numéros de suivi |
| 8 | (pas du code) **son compte eBay particulier revend-il des paires achetées pour être revendues ?** | — | eBay.fr écrit qu'il faut alors être professionnel (extrait officiel) ; ça décide aussi de la voie du bordereau |
| 9 | **Un vendeur qui cesse de payer** alors qu'un bordereau à annuler est en cours | **laisser l'annulation déjà décidée se terminer**, et lui montrer ses engagements sur la porte d'abonnement | c'est lui rendre son argent, pas un service nouveau ; sa règle du 4 octobre (« ne voit plus rien ») est respectée pour le reste [S20] |

---

## 10. La carte des zones et l'ordre de construction

| chantier | zone principale (disjointe des voisins de sa vague) | dépend de |
|---|---|---|
| **K0** fusion | tout le périmètre eBay (seul) | — |
| **K3** mémoire SQL | `supabase/migrations/014`, `audit-agent-sql.cjs` | — |
| **K1** doubles côté app | `App.jsx` : règles de preuve, `gardePublier`, blocs d'`EbayAnnonces`, Ma journée ; extension | K0 |
| **K2** socle | `api/ebay.js` (`status`, `handleSync`, publication, `itemXml`), `api/_lib/ebay.js`, `api/compte.js` (suppression), `agent-evenements.js`, `vercel.json` ; `App.jsx` : `EbayConnexion`, `EbayPublier` | K0 |
| **K4** coffre, jetons, quota | `api/_lib/coffre.js`, `api/_lib/ebay.js` (jetons), `tradingCall` ; `App.jsx` : Compte eBay | K2, K3 |
| **K12** photos | `api/_lib/ebay-media.js`, chemin des photos d'`api/ebay.js` | K2 |
| **K5** moteur | `api/ship-reminders.js` (mode `battement`), `api/_lib/agent-ebay.js`, `agent/veille.js`, `agent/commande.js`, `agent-ebay-regle.js`, `ebay-regle.js`, `push.js`, migration 015 | K1, K2, K3, K4 |
| **K6** écran Agent | `App.jsx` : `EbayAgent` ; actions `agent*` d'`api/ebay.js` ; `agent-reglages.js` ; `api/compte.js` (`engagements`) | K3, K4 |
| **K9** argent | `App.jsx` : règles d'argent ; `ventes-regle.js` ; `handleFinances` ; `ebay-signature.js` | K2, K4 |
| **K7** expédier | `App.jsx` : Colis, `toShip`, Ma journée, impression ; `widget.js` ; rappel du matin ; `agent/expedier.js` | K5 |
| **K8** doubles serveur | `agent/doubles.js` ; action `veiller`, `retirerAnnonceAuto` ; extension ; famille dans l'écran Agent | K1, K5 (K6) |
| **K10** oreille | `api/compte.js` (`ebay-notif`), `agent-evenements.js`, `agent/notifs.js`, `vercel.json`, `email-inbound.js` | K2, K4, K5 |
| **K11** suivi | `suivi-regle.js`, `transport/laposte.js`, `agent/suivi.js` ; `App.jsx` : « Partis », frise | K7 |
| **K13** messages | `agent/messages.js`, `messages-regle.js` ; `App.jsx` : Parler au client | K6, K11 |
| **K14** bordereaux VRM | `transport/boxtal.js`, `sendcloud.js`, `agent/bordereau.js`, actions `bordereau*`/`coffre*`, `compte.js` (`transporteur`), `public/legal` | K4, K6, K7, K11 + **porte d'entrée mesurée** |
| **K16** annonces vivantes | `agent/prix.js` ; `App.jsx` : cartes d'`EbayAnnonces` | K8, K10, K12 |
| **K15** boîte, après-vente | `agent/boite.js`, `agent/apresvente.js` ; `App.jsx` : Messages | K10, K11, K13 |
| **K17** brancher, bilan | `App.jsx` : premiers pas eBay ; `bilan-semaine.js` | K5, K6 (K14) |

**Les vagues** (dans une vague, les chantiers se construisent en parallèle) :

```
vague 1 :  K0  ‖  K3
vague 2 :  K1  ‖  K2                     (après K0)
vague 3 :  K4  ‖  K12                    (après K2 ; K4 après K3)
vague 4 :  K5  ‖  K6  ‖  K9              (après K1, K3, K4)
vague 5 :  K7  ‖  K8  ‖  K10             (après K5)
vague 6 :  K11 ‖  K16                    (K11 après K7 ; K16 après K8, K10, K12)
vague 7 :  K13 ‖  K14*                   (* seulement si la porte d'entrée de K14 est franchie)
vague 8 :  K15 ‖  K17
```

**Partages assumés** : `src/App.jsx` est touché par presque toutes les vagues,
**chacune dans sa région** (les composants nommés ci-dessus) ; `api/ebay.js`
reçoit les actions de chacun **en fin** de la table `ACTIONS`, un bloc par
chantier (§4.4) ; `CLAUDE.md` reçoit une section datée par chantier. Une fusion
se fait par un vrai `git merge`, conflits résolus à la main ; après, `git diff
origin/main --stat` ne montre que la zone du chantier (règle du dossier).

**Ce que Julien gagne, dans l'ordre** : après K1, plus de paire vendue ailleurs
qui reste sur eBay **sans un mot** ; après K5, son téléphone sonne **VRM fermé** ;
après K7, sa journée et son impression du soir incluent eBay (et Vinted y gagne) ;
après K8, le retrait se fait VRM fermé (s'il l'allume) ; après K10, dans la
minute ; après K11, il sait où est chaque colis ; après K14 (si eBay le permet),
un revendeur à étiquette libre n'a plus rien à faire entre la vente et
l'impression. **Total estimé : 25 à 35 sessions**, dont une bonne part en
parallèle.

---

## 11. Ce qui reste à mesurer, et le geste le moins risqué

| à mesurer | le geste | décide |
|---|---|---|
| `ShippingLabelPolicy` sur **ses** commandes | la lecture `GetOrders` 1455 de K2, sur sa première vente eBay | **si K14 sert un jour** |
| la vraie `ORDER_CONFIRMATION` (délai, `listingId`, signature brute ou re-sérialisée) | un abonnement, puis `POST /subscription/{id}/test` | le routage (§4.6) |
| ce qui déclenche `MARKED_DOWN` | `getDestination` quotidien, noté | la cadence |
| `getShippingFulfillments` après une étiquette achetée dans eBay (forme d'un n° Mondial Relay, code transporteur) | sa première vente eBay, lecture seule | le suivi en voie eBay |
| les codes de `get_shipping_carriers` pour `EBAY_FR` | la lecture mensuelle de K2 | la déclaration |
| eBay lit-il une adresse Vinted signée (Media API) ? | un `createImageFromUrl` sur une photo, sans rien publier | le repli par octets |
| Boxtal : clé du devis v1, prix rendu, encodage de la signature, codes d'offre, doublon | le bac à sable (rien n'est facturé) | **l'ordre des prestataires** |
| Sendcloud : réponse à un doublon de référence | son compte d'essai | R6 |
| La Poste : code « au point de retrait », date limite, quota | une clé gratuite, sur un n° Colissimo déjà livré | le rappel J-2 |
| `AddMemberMessageAAQToPartner` : ce que voit l'acheteur, longueur maximale | un message, sur sa prochaine vente, sur son clic | les textes |
| Fluid compute, durée réelle, consommation du battement | Vercel → Settings → Functions ; onglet Usage une semaine après | Vercel Pro |
| heure de remise à zéro du quota Trading | `getRateLimits` (`reset`) | le garde-quota |
| routes Post-Order encore vivantes sur eBay.fr | une recherche en lecture seule | K15 |
| délai d'annulation d'un acheteur eBay.fr | l'aide eBay.fr, puis une vraie commande | le délai de grâce |
| la fenêtre de double vente après K1 | la requête de la synthèse §2.2, relancée une semaine après | I2 (mise en vente en lot) |
| les noms exacts des portées `v2` acceptées pour l'application | la reconnexion de K4 (un refus ⇒ repli `v1`, rien n'est perdu) | K10, K15 |

---

## 12. Le registre des relectures : chaque correction jugée

**Relecture de sûreté** (`relecture-surete.md`) :

| # | verdict | où | en une ligne |
|---|---|---|---|
| S1 | **intégré** | R4, §5.5, K14 pas 3, K16, scénario 24 | aucun geste qui engage sans « non vendue ailleurs » et « pas de gel » |
| S2 | **intégré** | §5.6 rang 5, K7, K14 pas 10, décision 3 | confirmé par un extrait officiel (annonce eBay d'août 2024 : un suivi chargé ferme la demande d'annulation) ; l'auto-déclaration à `shipByDate` devient une décision, non par défaut |
| S3 | **intégré** | §5.6 rang 4, K14 | confirmé (extrait officiel Boxtal : la commande ne rend que `shippingOrder.id`) |
| S4 | **intégré en partie** | R6, K14 porte d'entrée | la correction tient (aucun second `POST` tant que le bac à sable ne l'a pas prouvé) ; l'affirmation « aucune page ne décrit `external_reference_id` » est inexacte : le support de Sendcloud dit que ses `POST` de création « tentent d'être idempotents » par ce champ (extrait officiel) — « tentent » n'est pas une garantie |
| S5 | **intégré** | R10, §5.1, §5.2, K4, scénario 27 | mesuré par la relecture : 1 compte Vinted sur 7 chez deux propriétaires VRM |
| S6 | **intégré** | R2, R22, K1, K5, scénarios 28-29 ; « carton B12 » retiré des exemples | revérifié ce soir : `ebayAnnonces` = `{128086452103:{559:10}, 128127336988:{553:1}}` ; `numeroExterne` serveur prend le marqueur en paramètre |
| S7 | **intégré** | R17, K6, K14 | mot de passe vérifié par le serveur (GoTrue), 10 min ; notification sur tous les appareils ; 24 h de répétition après un changement de clés |
| S8 | **intégré, élargi** | §4.5 | 204 après signature valide **pour toutes** les notifications d'eBay (pas seulement la suppression) ; la phrase « garder le 500 pour `ORDER_CONFIRMATION` » est **rejetée** : un 500 répété fait marquer l'adresse `MARKED_DOWN` (D3), et la sonnette ne porte rien que la veille ne rattrape |
| S9 | **intégré** | R15, K14 | TTC, +15 %, « devis » puis « facture », limite chez le prestataire |
| S10 | **intégré** | R13, K13, scénario 32 | — |
| S11 | **intégré** | §5.4, K1, scénario 33 | avec une **portée** (ventes depuis la mise en service de K1 moins 30 jours), sinon l'historique gèlerait tout le premier jour |
| S12 | **intégré** | K1 (le retrait app ouverte garde sa règle), K8 (nouvelle famille), R3, §5.6 (`deux_annonces`) | la synthèse §3.1 « une autre annonce eBay du même N° : retirée » est retirée |
| S13 | **intégré** | §5.4, K8, décision 2, scénario 34 | il infirme la décision 2 de la synthèse (retirer l'exception sans la remplacer) |
| S14 | **intégré** | §5.6 rang 0-1, K5, scénario 35 | — |
| S15 | **intégré** | R5, R7, R8, §5.2, K14, scénario 36 | — |
| S16 | **intégré** | R6 | — |
| S17 | **intégré** | K14, scénario 37 | — |
| S18 | **intégré** | K11, §5.6, scénario 38 | — |
| S19 | **intégré** | §5.5, K14, scénario 39 | — |
| S20 | **intégré dans une autre forme** | §5.1, K6, décision 9 | le journal reste **sous** la restrictive d'abonnement (règle de Julien du 4 octobre : qui ne paie plus ne voit plus ses données) ; ses **engagements** (des nombres) sont rendus par la porte d'abonnement, et une notification de clôture part |
| S21 | **intégré** | R11, §5.6, K10, scénario 40 | — |
| S22 | **intégré** | K4 | la « révocation par API » est remplacée par un geste sûr et documenté côté utilisateur : retirer VRM des applications autorisées d'eBay, puis se reconnecter |
| S23 | **intégré** | R18, K7 (`bordereauglisse`), K14 | — |
| S24 | **intégré** | §5.2 `prendre` | identique à D15 |
| S25 | **intégré** | R12, §5.1 | — |
| S26 | **intégré** | R19, §5.2 | l'option « une seule réécriture » est retenue (il veut relire le texte exact) |
| S27 | **intégré** | R20, §1, §8 | — |
| S28 | **intégré** | R21, K5 | — |

**Relecture de vérité** (`relecture-verite.md`) :

| # | verdict | où | en une ligne |
|---|---|---|---|
| D1 | **intégré** | K12 | confirmé ce soir (extrait officiel, « API deprecation status » : décommissionné le 30 septembre 2026, remplacé par la Media API) |
| D2 | **intégré** | §4.6, §4.7, scénario 43 | confirmé (extrait officiel `testSubscription` : 202) |
| D3 | **intégré** | §4.5, §4.6, K10, scénario 42 | confirmé (`MARKED_DOWN` posé par eBay, sortie par `updateDestination`) |
| D4 | **intégré** | §4.2, K5, scénario 41 | — |
| D5 | **intégré** | §0, §5.5, K2, K14 porte d'entrée | **confirmé ce soir** par une recherche indépendante : champ facultatif de `ShippingDetailsType`, WSDL 1455, rendu par `GetOrders` et `GetItemTransactions`, seule valeur `EBAY_ONLY`, absent ⇒ aucune politique ; la phrase de la synthèse « aucune page ne le cite » est **fausse** |
| D6 | **intégré** | §4.7, §4.8, K15, scénario 44 | le budget ~20 appels Trading par compte et par jour est retenu ; l'« Application Growth Check » passe avant l'ouverture aux autres vendeurs |
| D7 | **intégré** | §4.3, décision 1 | l'interrupteur gagne la position « propriétaire » |
| D8 | **intégré** | R7, K2, K5 | `maxDuration` dans `vercel.json` (bloc `functions`), qui ne crée aucune fonction |
| D9 | **intégré** | K14 porte d'entrée | « jamais un mot de passe dans le coffre » ; Sendcloud premier si Boxtal v1 l'exige |
| D10 | **intégré en partie** | K14, R6 | le webhook Sendcloud réglé chez le vendeur, `POST /shipping-options` pour le devis : retenus ; « 409 avec l'envoi existant » n'est pas retrouvé par ma recherche ⇒ [à vérifier], le code traite les deux cas (409 de **notre** référence = déjà acheté ; aucun second `POST`) ; le suivi d'un colis acheté ailleurs par Sendcloud reste une piste [à vérifier], non construite |
| D11 | **intégré** | §5.6 | — |
| D12 | **intégré** | K15 | — |
| D13 | **intégré** | §4.6 | **change la synthèse** : une adresse d'installation routée par `listingId` (une identité), au lieu d'une adresse par compte (un plafond d'adresses non documenté) ; l'adresse par compte reste un repli, construit seulement si la mesure l'exige ; le défi se calcule sur l'adresse fixe |
| D14 | **intégré** | §4.2, §5.1, K3 | — |
| D15 | **intégré** | §5.2 | identique à S24 |
| D16 | **intégré** | §1, §8 | N°1 (ex-553), N°10 (ex-559) |
| D17 | **intégré** | §4.8 | le quota Trading 5 000 est attribué au forum du support eBay (secondaire), pas à la KB 1362 (qui parle de l'API Shopping) |
| D18 | **noté, sans effet** | — | un second cron quotidien serait permis en Hobby (jusqu'à 100 par projet, une fois par jour chacun, extrait officiel), mais l'horloge vit dans la base : aucun cron Vercel n'est ajouté, et la prudence du dossier (un cron refusé bloque tous les déploiements) reste |

**Corrections de la synthèse trouvées ce soir, en plus des relectures** :
- la branche eBay a **42** commits de retard sur `main`, pas 32 [mesuré ce soir] ;
- `ShippingLabelPolicy` est documenté (D5, confirmé indépendamment) ;
- l'achat d'une étiquette **dans eBay** marque aussi la commande expédiée et ferme
  la demande d'annulation (extrait officiel, annonce eBay d'août 2024) : d'où le
  conseil de K7, acheter l'étiquette eBay au moment d'imprimer ;
- `recupererLabel` lit déjà la transaction pour trouver le PDF : la ranger
  (K1) donne la preuve **sans aucune requête Vinted de plus**.

---

## 13. Sources

**Ce dossier** : `synthese.md`, `relecture-surete.md`, `relecture-verite.md`,
`bordereaux.md`, `suivi.md`, `infra.md`, `etat.md`, `design-evenements.md`,
`design-battement.md`, `design-vendeur.md` ; la feuille de route du 9 octobre
(`../agent-ebay/feuille-de-route.md`, `possible.md`, `existant.md`, `spec-*.md`) ;
`CLAUDE.md`.

**Mesuré ce soir** (lecture seule, projetée, propriétaire `74eea6e7-…`) :
`main.vrm_numerotation` (version, coupure, `appliqueLe`, `ebayAnnonces`),
`main.vrm_ebay_retrait_auto`, `pg_extension` ; `ebay_listings` (3 annonces, SKU,
capture du 10 oct. 20:29:12 UTC), `ebay_orders` (0) ; `git` : `integ-11oct`
(`aee8e5c`), `origin/main` (`93e9e0e`), `worktree-wf_30feaf2f-334-8` (`2a34c1c`,
23 / 42) ; `api/_lib/numerotation.js` (`numeroExterne(k, id, liste, dateMs, mk)`,
`lireMarqueur`) ; `api/compte.js` (modes) ; `vercel.json` (réécritures, un cron,
aucune `maxDuration`).

**Recherches de ce soir** (extraits de moteur ; `developer.ebay.com` et
`sendcloud.dev` : `ENOTFOUND` d'ici) :
- [ShippingDetailsType (Trading)](https://developer.ebay.com/Devzone/xml/docs/Reference/ebay/types/ShippingDetailsType.html)
  et [notes de version Trading](https://developer.ebay.com/devzone/xml/Docs/ReleaseNotes.html) —
  `ShippingLabelPolicy`, WSDL 1455, `EBAY_ONLY` ;
- [API deprecation status](https://developer.ebay.com/develop/get-started/api-deprecation-status),
  [UploadSiteHostedPictures](https://developer.ebay.com/DevZone/XML/Docs/Reference/eBay/UploadSiteHostedPictures.html),
  [Media API overview](https://developer.ebay.com/api-docs/commerce/media/static/overview.html) ;
- [DestinationStatusEnum](https://developer.ebay.com/api-docs/sell/notification/types/api:DestinationStatusEnum),
  [updateDestination](https://developer.ebay.com/api-docs/commerce/notification/resources/destination/methods/updateDestination),
  [testSubscription](https://developer.ebay.com/api-docs/sell/notification/resources/subscription/methods/testSubscription) ;
- [« We're simplifying order cancellations » (communauté eBay)](https://community.ebay.com/forum/announcements-57928/topic/were-simplifying-order-cancellations-6873/),
  [version australienne](https://community.ebay.com.au/t5/eBay-Announcements/We-re-simplifying-order-cancellations/ba-p/2585134) ;
- [Boxtal — order API v3](https://developer.boxtal.com/fr/en/apiv3/guide/order-api-v3),
  [tracking events v3](https://developer.boxtal.com/fr/en/apiv3/guide/tracking-events-api-v3),
  [document events v3](https://developer.boxtal.com/fr/en/apiv3/guide/document-events-api-v3),
  [sandbox v3](https://developer.boxtal.com/fr/en/apiv3/guide/sandbox-api-v3) ;
- [Sendcloud — FAQ des API (idempotence par `external_reference_id`)](https://support.sendcloud.com/hc/en-us/articles/7789894544276).

Les sources des études et des relectures sont dans leurs propres fichiers ; ce
document ne les répète pas.
