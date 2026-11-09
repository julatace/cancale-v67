# 9 novembre 2026 (soir) — Solo par plateforme (branche `claude/solo-plateformes`, lot E)

Julien (9 nov.) : « fais absolument tout » — l'offre Solo (16,99 €) s'étend à Leboncoin,
eBay et Vestiaire. Base : `2026-11-09-plans-solo-pro.md` (Solo Vinted) et
`2026-11-09-suites-serveur.md` (Solo côté serveur).

## ⚠️ À confirmer par Julien : l'interprétation retenue

**Solo = UN compte vendeur PAR plateforme** (un Vinted, un Leboncoin, un eBay, un
Vestiaire) ; ses autres comptes de chaque plateforme sont des comptes d'ACHAT (achats,
retraits, colis à retirer : tout reste). **Pro = tous les comptes vendent.**
L'autre lecture possible (« un seul compte vendeur, toutes plateformes confondues ») n'a
PAS été retenue : elle obligerait un vendeur Vinted + Leboncoin à prendre Pro. S'il veut
l'autre, la règle est un seul endroit (`venteAutreHorsPlan`, `api/_lib/plan-regle.js`).

Règles gardées telles quelles : propriétaire de l'installation toujours Pro ; un Solo
souscrit sous les CGV d'avant le 9 nov. jamais bridé (`plan` = `null`) ; pas su ⇒ rien
bridé ; ventes des autres comptes en APERÇU, hors totaux, jamais supprimées ; un compte
exclu (Comptes liés) n'entre dans aucun total ; colis à envoyer jamais cachés.

## Ce qu'un vendeur voit

- **Solo, une plateforme avec DEUX comptes ou plus et rien de choisi** : la ligne de la
  coque « Ton offre Solo : choisis le compte qui vend sur Leboncoin. Tant que tu n'as pas
  choisi, tous tes comptes Leboncoin comptent. » → « Choisir » ouvre **« Quel compte vend
  sur Leboncoin ? »** — la MÊME feuille que Vinted (`QuelCompteVend`, `plateforme`) : ses
  comptes par nom lu + identité, « N ventes lues », le plus vendeur « proposé »
  (strictement ; égalité ⇒ rien), rien coché ni envoyé avant son clic, « Ce compte vend ».
  Vinted d'abord (comme avant, dès le Solo), puis Leboncoin, eBay, Vestiaire. Une
  plateforme à UN seul compte ne demande rien (il vend forcément).
- **Paramètres → Abonnement → « Le compte qui vend sur chaque plateforme »** : une
  rangée par plateforme (Vinted, puis Leboncoin / eBay / Vestiaire dès deux comptes ou un
  choix fait) ; chaque rangée ouvre SA feuille ; « Prochain changement le … ».
- **Changement** : premier choix libre, puis une fois tous les 30 jours, **compté par
  plateforme** (choisir Leboncoin ne bloque pas eBay). Trop tôt ⇒ refus du serveur avec
  la date.
- **Solo, comptes choisis** : les totaux (vendu, CA déclaré/URSSAF, bénéfice, stats, Ma
  journée, carte des chiffres, widget publié par l'app) ne comptent que le compte vendeur
  de chaque plateforme. Ventes → « Tous » : les ventes des comptes d'achat Leboncoin /
  eBay / Vestiaire sortent de la liste et passent dessous en aperçu, un bloc par compte
  (« Ventes Leboncoin de Mes achats · 4 ventes — hors de ton offre Solo (un compte vendeur
  par plateforme) : ni dans tes listes, ni dans tes totaux. Rien n'est supprimé. »),
  3 nettes, la suite floutée et `inert`, « Passe à Pro pour gérer les ventes Leboncoin de
  … ». Un colis à envoyer y est DIT (« dont 1 à envoyer (dans Colis) ») et reste dans
  Colis : aucun calcul de colis ne lit l'offre.
- Les écrans propres à chaque plateforme (Leboncoin, eBay, Vestiaire) gardent toutes
  leurs lignes (comme un compte « hors totaux » de Comptes liés) ; seuls leurs totaux
  suivent l'offre. Pas de bloc d'aperçu dédié là (voir « Ce qui reste »).

## La règle (une seule, importée par l'app ET le serveur — aucune copie)

- `api/_lib/plan-regle.js` :
  - `regleVentes(x)` rend aussi `autres: { leboncoin, ebay, vestiaire }` (l'identité du
    compte vendeur choisi, seulement en Solo sûr ; Pro, pas su, propriétaire ⇒ tout `null`) ;
  - `venteAutreHorsPlan(regle, plateforme, compte)` : vrai seulement si Solo, un compte
    vendeur CHOISI sur cette plateforme, compte de la vente connu et différent ;
  - `idCompteVendeur` : Leboncoin `8442…` = `lbc-account:8442…` ; eBay `principal` ou la
    clé (16 hex) ; Vestiaire l'identifiant relevé, **jamais** `-` (« non identifié ») ;
  - `planDeLAbonnement(sub)` lit `vrm_vendeur_{leboncoin,ebay,vestiaire}` (+ `_le`) dans
    les métadonnées de SON abonnement Stripe ; `compteDefautAutre`, `signatureRegle`,
    `brideAutres` ; `OFFRES.solo.phrase` dit « un compte vendeur par plateforme ».
- `api/_lib/comptes-exclus.js` : `excluAutreDe(v, regle)` = le choix de Comptes liés **ou**
  l'offre — l'identité est celle que la vente PORTE (`compteDeVente`). Sans `regle` (ou
  pas su) : exactement le prédicat d'avant. C'est LE prédicat des totaux des autres
  plateformes : `useExcluAutre` (App.jsx : Ventes, Compta, Stats, coque) ET le bilan
  serveur (`api/_lib/bilan-semaine.js`, semaine et mois).
- `compteEcarteRegle` (Vinted) est inchangée ; `node scripts/audit-bilan-semaine.cjs
  --recopie` a été rejoué : `api/_lib/ventes-regle.js` ne change pas (la règle des autres
  plateformes n'est pas recopiée : elle est IMPORTÉE des deux côtés, comme `venteHorsPlan`).
- App : `src/abonnement/planVentes.js` garde `autres` sur l'appareil ; la signature
  (`signatureRegle`) change avec le compte vendeur de CHAQUE plateforme ⇒ l'app se remonte.

## Serveur (`api/compte.js`, toujours 12 fonctions)

- `mode=compte-vendeur` accepte `{ plateforme: 'leboncoin'|'ebay'|'vestiaire', id }`
  (Vinted garde `{ uid }`) : compte relu dans SES lignes (`lbc_accounts`, `ebay_comptes`
  — un compte eBay déconnecté ne compte pas —, `vc_session`) avec SON jeton (RLS) + filtre
  `owner` en base cloisonnée ; lecture ratée ⇒ 503, rien écrit ; abonnement relu chez
  Stripe ; Pro ou propriétaire ⇒ 409 ; 30 jours par plateforme ; métadonnées
  `vrm_vendeur_{p}`, `_le`, `_avant`, relues après écriture.
- `mode=abonnement` rend `comptesVendeurs: { p: { id, le, prochainChangement } }`.
- Webhook : `abonnements.comptes_vendeurs` (jsonb, migration **030**) ; colonne absente ⇒
  l'écriture se refait sans elle (statut, plan, compte Vinted rangés quand même).
- `api/_lib/plan-vendeur.js` (`regleDuVendeur`) lit `comptes_vendeurs` ; 030 absente ⇒
  relu sans la colonne : Vinted bridé comme avant, autres plateformes « pas su ».
- Notifications : inchangées (« vendu » Vestiaire par e-mail ne porte pas le compte
  Vestiaire ⇒ pas su ⇒ elle sonne). Le widget lit la photo publiée par l'app (déjà bridée).

## Migration 030 — PAS appliquée (geste de Julien)

`supabase/migrations/030-solo-plateformes.sql` : `alter table abonnements add column if
not exists comptes_vendeurs jsonb` + contrainte « objet ou null ». Additive, aucun DROP.
Essai `BEGIN … ROLLBACK` dans son en-tête (« ESSAI OK … »), puis le fichier entier.
**À passer après la 028.** Sans elle : l'app applique déjà l'offre (lue chez Stripe) ;
seuls les bilans serveur comptent tous les comptes Leboncoin / eBay / Vestiaire.

## Textes

- CGV (`public/legal/cgv.html`, toujours datées du 9 nov., `CGV_VERSION` inchangée) : Solo
  = « un compte vendeur par plateforme (un compte Vinted, un compte Leboncoin, un compte
  eBay et un compte Vestiaire Collective) », changement une fois / 30 j « plateforme par
  plateforme », sans choix tous les comptes de la plateforme comptent, colis à envoyer
  gardés affichés. **À faire relire avec le reste.**
- Accueil (FAQ « J'ai plusieurs comptes Vinted »), carte des offres (Paramètres, accueil :
  `OFFRES.solo.phrase`).

## Preuves

| contrôle | aujourd'hui | sur origin/main (`git archive 1cfeac87`) | mutations |
|---|---|---|---|
| `scripts/audit-plans-solo-pro.cjs --prouve` (+ §6 : deux comptes LBC/eBay/Vestiaire ; Solo, Pro, ancien Solo, pas su, propriétaire ; prédicat des totaux ; état de l'app ; câblage ; route réelle ; webhook avec/sans 030 ; `regleDuVendeur` avec/sans 030 ; CGV) | 96 verts (+11 mutations rouges) | **22 rouges** | 5 nouvelles (compte vendeur ignoré, bridé hors Solo, Vestiaire `-` écarté, `lbc-account:` pas reconnu, métadonnées ignorées) ⇒ chacune rouge ; les 6 d'avant aussi |
| `scripts/audit-suites-serveur.cjs --prouve` (+ §6 : VRAIE route du cron, bilans semaine ET mois, 5 vendeurs S2 Solo 4 · 250 € / P2 Pro, A2 ancien Solo, X2 pas su 8 · 2 850 € / N2 sans 030 7 · 2 350 €, « Reçu » aussi) | 47 verts | **4 rouges** (S2 : 7 ventes · 2 350 € au lieu de 4 · 250 €) | 4 nouvelles (`autres`, `predicat`, `colonne030`, `repli030`) ⇒ chacune rouge ; les 7 d'avant aussi |
| `scripts/bancs/solo-plateformes.cjs` (rendu réel, 390/1512, clair/sombre) | 43 verts | **30 rouges** | `BANC_MUTATION=autres` ⇒ rouge |
| `scripts/bancs/plans-solo-pro.cjs` | 32 verts | 3 rouges **venant de main** (plein écran « Ma configuration » qui couvrait la coque) — réparé dans le banc (configuration faite dans les données d'exemple) | — |
| variables, tdz, coherence, identite, statuts, fonctions-api (12), bilan-semaine (54), abonnement-propre, abonnement, comptes-exclus, lancement, mentions-paiement, urssaf, vendeurs-differents, ventes-e2, dac7-comptes, registres, achats-export, boutons, icones, violet, bilan-mois, double-vente, flux-divers, compte-pas-relu, colis-ventes-email ; `npm run build` | verts | — | — |

`scripts/audits-solo-plateformes.sh` relance la série. Captures regardées : feuille
« Quel compte vend sur Leboncoin ? » 390 clair et 1512 sombre, Ventes Solo 390 sombre
(bloc Leboncoin « Mes achats » 3 nettes + 1 floutée, bloc Vestiaire), Paramètres 1512
(une rangée par plateforme).

## Ce qui reste

- **Julien** : confirmer l'interprétation « un compte vendeur PAR plateforme ».
- Écrans propres à Leboncoin / eBay / Vestiaire : leurs listes gardent les ventes des
  comptes d'achat (totaux bridés) ; un bloc d'aperçu dédié par écran serait la suite.
- Annonces des comptes d'achat Leboncoin / eBay / Vestiaire : non retirées des listes
  (Vinted : retirées) — même suite.
- Extension non touchée (offres automatiques, favoris : Vinted).

## Gestes de Julien

1. Confirmer l'interprétation (ci-dessus).
2. Supabase → SQL : la **028** si pas faite, puis la **030** (essai `BEGIN … ROLLBACK`
   de l'en-tête ⇒ « ESSAI OK », puis le fichier entier).
3. Relire les CGV (paragraphe Solo) avec le reste des CGV du 9 nov.
Rien côté Stripe ni Vercel.
