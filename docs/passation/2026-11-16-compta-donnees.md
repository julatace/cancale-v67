# 16 nov. 2026 — Lot `compta-donnees` (points 21, 47, 52, 53)

Branche `claude/compta-donnees` (depuis `origin/main` b8f26f36d). Pas d'extension touchée.
Aucune fonction `api/` ajoutée (toujours 12). La migration 043 (partenaires, PAS appliquée) est retouchée.

## ÉTAT À LA REPRISE

- Tout est écrit, poussé, vert en local (voir « Preuves »). **PR #1185 ouverte, PAS fusionnée** : règle de
  Julien du 16 nov. « zéro rouge pour fusionner, même les rouges déjà sur main ». La CI de la PR a 69 audits
  rouges ; 67 sont rouges À L'IDENTIQUE sur `origin/main` (rejoués un par un sur l'arbre de main :
  accueil-reste, config-facture, infos-vinted, vocabulaire-article, annonces-coherence, revue-fin…, et le job
  `regles` : `scripts/tests/lot-preparation-reprise.cjs`, « React is not defined ») ; le seul rouge NOUVEAU
  (`audit-ebay-lien-identite` : `modifierCle` absent de son bac à sable) et `textes-courts` (Ebay.jsx) sont
  corrigés. Bancs rouges de la CI (nouveau-vendeur, colis-retirer-propre, annonces-actions, iphone-reprise,
  argent-mois, chiffres-coherents, retraits-suivi, accessibilite-clavier) : aucun ne touche ce lot. À la
  reprise : quand main est revenu au vert, `git merge origin/main`, repousser, attendre la CI, fusionner.
- Rien n'attend Julien pour ce lot, SAUF la migration 043 (programme partenaire), déjà listée comme
  son geste : elle est retouchée ici (colonnes du remboursement partiel) et toujours pas appliquée —
  mesuré le 16 nov. (`list_tables` sur la vraie base, lecture seule : aucune table `partenaire_*`).
  Il colle le fichier ENTIER, comme écrit dans `2026-11-15-partenaires.md` §2.
- Pas fait (avec la raison) : en bas, « Restes ».

## Ce qui a changé

| point | avant | maintenant |
|---|---|---|
| 21 notification URSSAF du 1er | ouvrait `DESTINATIONS.urssaf` = le Résumé d'Argent, où la section URSSAF est cachée | `DESTINATIONS.urssafDeclarer()` (`/?tab=compta&section=declarer&cible=urssaf`, comme la veille de l'échéance) ; l'alerte de la veille « Ton CA d'octobre est passé de… » (`src/veilleChiffres.js`) aussi ; `audit-rappel-urssaf` et `audit-veille` attendent la nouvelle adresse |
| 47 `ecrireReglage` (Ma facture, Ma configuration, le choix d'un compte pro) | POST « fusion » de la fiche ENTIÈRE relue juste avant : un SIRET / régime de TVA posé sur un autre appareil dans l'intervalle était effacé | `ecrireDifference` (src/ligneCas.js) : l'appelant passe la fiche relue (`frais`) ; seul ce qu'il a changé est posé sur la ligne RELUE à l'écriture, gardée par `data.rev` ; relecture ratée ⇒ rien écrit (false). Les 3 appelants passent `frais` |
| 47 file par clé : `noterLienEbay`, `poserAchatVc`, `deposerLbc` (+ la coche « Colis fait » Leboncoin) | « load → modifier → save » : `save` attend 500 ms ; un 2e geste dans la demi-seconde repartait de la carte d'AVANT le 1er et le remplaçait (liens eBay posés en boucle sur les brouillons : un seul restait) | `modifierCle` (`src/modifierCle.js`, branchée sur `chargerPublie`) : chaque geste part de la valeur EN ATTENTE de sa clé |
| 47 dates | `audit-dates-paris` était ROUGE sur main : 7 `toISOString().slice(0, 10)` nouveaux dans src/ | jour d'achat (`src/achatMemeAnnonce.js`) et « prévu le » (`src/ArgentAVenirEcran.jsx`) au jour de PARIS (`jourParis`) ; l'arithmétique de jour de `src/soldes.js` et `src/recherchePhrase.js` passe par `decalerJour` (nouveau, `src/dateParis.js`) — une seule règle ; l'audit est vert |
| 47 totaux à 0 sans « au moins » | (revue métier 9-27, 46, 52) | relevé : déjà faits par `agent2-familles-app` et la revue du 12 nov. (eBay `eur(null)` ⇒ « — », « Vendu · mois » dit « au moins », la Trésorerie retirée le 15 nov.) ; `audit-pas-su` vert. Reste `vrm_achats_jours` (voir « Restes ») |
| 52 numéro de facture unique | — | DÉJÀ fait : facture Pro et avoirs par `prendreNumero` (comparer-et-échanger sur le compteur, `audit-facture-pro` N4, `audit-revue-fin` M75 « 40 et 41, jamais deux fois 40 ») ; factures manuelles par `src/factureNumeroCas.js` (`audit-revue-fin` A5). Rien à refaire |
| 52 « avec VRM » en série | la série « Facture Pro » (Ventes → Sélectionner) et « Tout envoyer » refusaient tout quand la boîte (réglage « depuis ma boîte ») n'était pas connectée | même règle que la feuille unitaire (`bloqueEnvoi(...).vrm`) : la confirmation dit « Envoyer N factures avec VRM ? » ; chaque envoi part avec `via: 'vrm'` (son clic, CES factures ; le réglage n'est pas réécrit) ; « À envoyer » montre « Connecter ma boîte » + « Tout envoyer avec VRM (N) ». Envoi VRM fermé ⇒ comme avant (la raison par vente). Textes par `tr()`, 5 langues (`facturePro.*`) |
| 53 partenaires : remboursement partiel | 1 € rendu annulait TOUTE la commission (choix prudent noté « à revoir ») | la règle écrite par Julien (« 3 € par mois et par client payant ») ne parle pas du partiel ; la commission devient PROPORTIONNELLE : `commissionNette` = 3 € × (payé − rendu) / payé, au centime INFÉRIEUR (1 € sur 16,99 € ⇒ 2,82 €). Litige, toute la facture rendue, ou montant pas lu ⇒ annulée (comme avant). `remboursementDe` : un geste de Stripe compté une fois (refund.created + charge.refunded du même euro), le plus grand de (cumul, Σ remboursements, Σ avoirs) — jamais deux familles additionnées. Les chiffres disent `nReduites`, le CSV « remboursement partiel 6,00 » |
| 53 « Quoi de neuf » pour le seul propriétaire | `pour` ne savait viser que tous / sneakers / autre / pro | `pour: 'proprietaire'` (`pourLui`, `proprietaire: useEstProprietaire()` ; pas su ⇒ cachée) ; deux lignes : `partenaires-prorata` (Julien seul), `serie-facture-vrm` (pro) |

### La migration 043 (pas appliquée) retouchée

- `partenaire_commissions.rembourse_centimes` (≥ 0, et < `facture_centimes` sauf annulée) ;
- `partenaire_annulations` : clé `(cle, signal)` — une ligne par clé Stripe ET par geste (`re_…`,
  `cn_…`, `cumul:N`, `litige`, `total`), `centimes` (null = pas lu). Le webhook range le signal, relit
  TOUS ceux de la commission, puis : annulée, ou `rembourse_centimes` posé (il ne fait que monter :
  `rembourse_centimes=lt.X`). Relecture ratée ⇒ 503, Stripe rejoue, rien deviné.

## Preuves

| contrôle | sur le code d'avant (git archive de main) | ici | mutations |
|---|---|---|---|
| `audit-compta-donnees.cjs` (neuf : ecrireReglage contre une base qui juge `data->>rev`, deux écrivains EN MÊME TEMPS, LECTURE KO ⇒ rien écrit ; file par clé exécutée sur le vrai code extrait avec un `save` différé de 500 ms ; série Facture Pro bundlée par esbuild et exécutée) | **14 rouges** | 22 verts | `--prouve` **8/8** |
| `audit-partenaires.cjs` (règle : prorata, rejeu, deux familles, litige, désordre, CSV) | rouge (pas de `remboursementDe`) | 66 verts | **20/20** (5 neuves) |
| banc `partenaires-serveur.cjs` (webhook réel, faux PostgREST : 1 € rendu par deux événements, rejeu, deux remboursements EN MÊME TEMPS, rendu avant la facture, relecture des signaux EN PANNE ⇒ 503 puis rejeu) | — | 97 verts | **12/12** (2 neuves) |
| `audit-partenaires-sql.cjs` (la 043 sur un Postgres jetable) | — | 63 verts | 11 (2 neuves : signal deux fois, tout rendu sans annulation) |
| `audit-rappel-urssaf` / `audit-veille` | 1 rouge chacun (l'ancienne adresse) | verts | — |
| `audit-dates-paris` | 1 rouge (main) | 54 verts | — |
| `audit-quoi-de-neuf` | — | vert (le propriétaire SU seulement) | — |

Le faux PostgREST des bancs (`scripts/bancs/_faux-postgrest.cjs`) compare désormais une colonne nombre en
NOMBRE (`lt`, `gt`… : 100 < 282, comme Postgres). Les bancs facture qui répondaient `[]` à toute écriture
rendent la forme de PostgREST (`scripts/bancs/_ecriture-representee.cjs`) : sans ça le comparer-et-échanger
y voyait un refus permanent (§6.3).

## Restes

- `vrm_achats_jours` (publication des achats par jour pour l'accompagnement) compte 0 € un achat au prix
  illisible : le dire demande une clé de plus dans la forme validée par la base
  (`vrm_accomp_chiffres_ok`, migration 025 : liste fermée de clés) ⇒ une migration. Pas fait.
- Partenaires : un `invoice.paid` et un remboursement qui arrivent EXACTEMENT ensemble peuvent encore
  se croiser (chacun lit avant l'écriture de l'autre) — la même fenêtre qu'avant ce lot ; à fermer par
  une fonction SQL atomique le jour où la 043 passe.
- Écran Partenaires : le nombre de commissions réduites (`nReduites`) est dans les chiffres et le CSV,
  pas encore écrit en toutes lettres sur la ligne du mois.
- `audit-config-facture` (T1 « le carton ») et `textes-courts` (Ebay.jsx l.2605) : rouges déjà sur main,
  hors de ce lot.

## Geste de Julien

Aucun de neuf. La migration 043 reste à appliquer (geste déjà listé, fichier retouché : le coller entier).
