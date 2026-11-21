# 11 nov. 2026 · Lot DJ7 — les ventes sans date de versement

Branche `claude/dates-versement`. Ses mots : « Compta : 1756 ventes sans date de versement. Les dates
de versement sont dans le porte-monnaie et parfois elles peuvent être incomplètes car la personne a
payé avec l'argent du porte-monnaie, donc je sais pas comment faire si c'est vraiment important. »

**Réponse** : oui, c'est important — le CA déclaré est daté au jour du VERSEMENT (CLAUDE.md §5) ; une
vente sans date n'est dans aucun mois. On ne date que ce qui est PROUVÉ.

Sur « payé avec l'argent du porte-monnaie » : la date qui compte est celle où Vinted **crédite son
porte-monnaie** (la transaction passe « Commande finalisée », statut 450, `status_updated_at`). Ce que
l'acheteur ou lui font ensuite du solde (payer un achat, virer à la banque) ne la change pas. Un
virement vers sa banque (`entity_type: payout`) n'est jamais une recette (déjà la règle de
`src/versementReleve.js`). Il n'y a donc pas de cas « payée avec le solde » à dater autrement.

## 1. Mesuré sur SA base (lecture seule, 11 nov., projections seulement)

Ventes Vinted finalisées (`harvest_{uid}_orders_sold`, statut « finalisée ») jointes à la transaction
rangée (`harvest_*_txn_*`, `meta->>status`) — comptes de son compte VRM :

| compte | finalisées | datées (450) | sans transaction rangée | transaction rangée, pas 450 |
|---|---|---|---|---|
| le grand compte (≈ 2 000 ventes) 2025 | 855 | 0 | 855 | 0 |
| le grand compte 2026 | 934 | 38 | 896 | 0 |
| 6 autres comptes actifs (2023-2026) | 349 | 349 | 0 | 0 |
| comptes retirés (hors totaux) | 124 | 31 | 87 | 6 |

⇒ **1 751 des ~1 756 ventes sans date sont sur UN compte** (vendues de mai 2025 à juin 2026) ; la
**seule raison** : le détail de la transaction n'a **jamais été relu** (51 relus sur 1 789). Les autres
comptes sont datés à 100 %. Rythme mesuré de la relecture sur ce compte : 22 · 10 · 11 · 8 détails
les 5, 6, 8 et 10 nov. (≈ 10 par jour) ⇒ à ce rythme, ~6 mois pour tout dater.

**Le relevé du porte-monnaie** : **aucune** ligne `harvest_*_releve_*` en base (rien rangé, jamais).
Les lignes `harvest_*_billing` (réponse `wallet/invoices/current`) : 5 comptes, `invoice_lines`
VIDES pour novembre et `history` vide ; une seule ligne (août, un compte) : un virement vers la
banque (`entity_type: payout`, ni `transaction_id` ni nature « transaction »). Une forme rangée
(`harvest_*_forme_releve`) : `/payments/public/api/payouts/new` (un formulaire de virement, sans
mouvement). ⇒ **0 vente datable par le relevé aujourd'hui** ; la forme d'une ligne de VENTE dans le
relevé n'a jamais été vue. Le relevé n'est pas la bonne source pour rattraper l'historique : il ne
donne que le mois en cours, et le paramètre des mois passés n'a jamais été observé (`vrmReleveMuet`).

## 2. Dater ce qui est prouvé (déjà la règle — complétée)

- La transaction 450 date ; le relevé COMPLÈTE par le seul n° de transaction (`tx` posé par
  `txDeLigneReleve`, 5.323) — jamais par montant ou jour voisins (inchangé, `src/versementReleve.js`).
- Nouveau : `completerVersementsParReleve` dit LESQUELLES il a datées (`versementsParReleve`,
  propriété non énumérable : les lecteurs de la carte tx → date ne voient rien de plus).
- `src/versementRaisons.js` (règle pure) : `raisonsADater` range chaque vente à dater sous UNE raison
  prouvée par la base — `vinted-detail` (aucune transaction rangée ; par compte), `vinted-attente`
  (rangée, pas finalisée), `vinted-passu` (états non lus), `leboncoin`, `vestiaire`, `ebay` ;
  `venteDatees` compte les lignes à date lue, dont celles du relevé.
- L'écran Ventes (propriétaire) PUBLIE `vinted_urssaf_mois.aDater.raisons` et `.datees` ; « Déclarer »
  les LIT (§11).
- **Pas de datation à la main pour Vinted** : la date existe chez Vinted et se lit ; une date par mois
  « en série » serait une date devinée pour des centaines de ventes. Leboncoin garde sa saisie à la main
  (`vrm_lbc_dates`, sur son clic), qui existait déjà.

## 3. L'écran (Argent → Déclarer → « Ce qui manque »)

« **4 datées ✓** dont 1 par ton porte-monnaie · **48 ventes sans date** : pas dans ce montant », puis
une ligne par raison et LE geste : « **47** sur **vendeuse_b** : ventes pas encore relues ·
Ouvrir Vinted ↗ » ; « 1 Vinted : pas encore finalisée, relue seule » ; Leboncoin « Dater à la main »
(`data-urssaf-dater`, ouvre « Vendu et reçu ») ; Vestiaire « Ouvrir Vestiaire ↗ ». « Pourquoi ? » :
la date qui compte, le solde n'y change rien, quelques-unes relues par visite, jamais devinée.
Une ligne publiée avant ce lot (sans `raisons`) garde l'ancien texte.

## 4. Preuves

- `scripts/audit-dates-versement.cjs` : 19 contrôles (50 ventes au même prix le même jour + relevé aux
  mêmes montants : seule la ligne qui porte SON n° date ; raisons par compte ; pas su ≠ jamais relue ;
  câblage). **11 rouges sur origin/main**. Mutations (`VRM_RACINE=<copie>`) : ressemblance par `ref`
  5 · pas su ⇒ détail 2 · sans compte 2 · datées sans date 2 · relevé perdu 3 · pas publié 2 · pas de
  geste 2 rouges.
- `scripts/bancs/dates-versement.cjs` (`BANC_PORT`, 390 tactile et 1512, clair et sombre) : 48 verts.
  Build d'origin/main : 4 rouges (390 clair) ; build muté « relevé perdu » : 2 rouges. Captures
  regardées (390 sombre, 1512 sombre, carte 390 clair).
- Audits verts : variables, tdz, coherence, identite, icones, onglets-d, versement-releve, versement,
  urssaf, textes-courts. Banc `onglets-d` : ses rouges K1 (« Pas encore calculé ») sont **les mêmes sur
  le build d'origin/main** — pas de ce lot.

## 5. Pour un lot suivant (extension — NE PAS faire ici, la 5.340 est en cours ailleurs)

Le vrai levier est `capterDatesVersement` (background.js), pas le relevé :
- aujourd'hui **5 détails par visite**, du plus récent au plus ancien, un essai par 24 h par vente,
  sur le budget de LECTURE (20/h, classe `argent`) ; le grand compte en a 1 751 à lire ;
- proposition : quand il reste des ventes à dater ET que rien d'autre n'attend (réserve des photos,
  colis), monter à **10 par visite et jusqu'à 15 lectures/h** pour `argent`, toujours une requête à la
  fois, `gardeLecture`, pause au premier 429/403 (`vrmPauseVinted`) ⇒ ~360/jour onglet ouvert,
  ~5 jours pour 1 751 ; afficher le reste (« 1 751 à relire ») via `vrmLecturesDues` que l'app lit déjà ;
- l'ordre peut rester du plus récent au plus ancien (les mois qu'il déclare d'abord).
- Relevé : seulement si une ligne de VENTE porte un jour un `transaction_id` (forme à mesurer sur
  `harvest_*_forme_releve` / `formeLignes`) ; rien à espérer pour 2025.

Geste de Julien : **ouvrir vinted.fr connecté sur le grand compte** (l'onglet ouvert suffit : les
dates arrivent quelques-unes à chaque visite) ; rien d'autre.


## Ligne de CLAUDE.md §9 (déplacée telle quelle le 11 nov., lot vocabulaire-article, pour rester sous 59 000 octets)
- **11 nov. · Ventes sans date de versement (lot DJ7)** : mesuré, 1 751 sur UN compte, détail de transaction jamais relu ; relevé : 0 vente datable. « Déclarer » : « N datées ✓ · M sans date », une raison par ligne + geste (« Ouvrir Vinted » par compte, Leboncoin à la main) ; jamais devinée (`src/versementRaisons.js`). `docs/passation/2026-11-11-dates-versement.md`. Geste : ouvrir vinted.fr sur ce compte.
