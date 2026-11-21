# Audit de fiabilité des données — 15 novembre 2026

Branche `claude/audit-fiabilite`. Mesure faite sur la **vraie base de production en lecture
seule** (uniquement des `SELECT`, scalaires projetés, jamais `select=data` sur une ligne lourde).
Aucune donnée réelle dans ce récit : les vendeurs sont nommés V1…V8 (V1 = Julien, rangé par
nombre de lignes), les comptes Vinted « compte A, B… », et l'on parle en nombres.

Base au moment de la mesure : 12 693 lignes `app_data` (40 Mo compressés), 8 propriétaires
(dont le propriétaire neutre de quarantaine), 13 lignes `vinted_accounts`. Le déclencheur
`vrm_garde_numeros` (017) est actif.

## Ce qui a été corrigé ici

### Une lecture publique VIDE effaçait 19 paires présentes (règle « en ligne »)

**Mesuré (aujourd'hui, 13:08 → 13:53 UTC)** : le dressing du plus gros compte de V1, capté
connecté, porte 40 annonces dont **19 ouvertes**. 45 min plus tard, une lecture PUBLIQUE de ce
compte (`harvest_{uid}_enligne`) est rangée « `complet: true`, `lus: 0`, `total: 0`, `ids: []` »
— écrite par une extension **5.273.0** (un navigateur qu'aucune ligne `ext_appareil_*` ne
nomme : les appareils publiés sont en 5.377, 5.368, 5.336 et 5.329). Les neuf autres comptes
relus en public le même jour ont des lectures publiques qui collent à leur dressing.

**Effet** : dans `<enligne-regle>` (`enLigneDuCompte`), la lecture la plus récente fait foi ;
la lecture publique vide rendait les 19 annonces ABSENTES (fermées, `_vrmAbsente`) :
- `widget_stats.online` = **20** au lieu de **39** (chiffre faux, à l'écran et sur le widget) ;
- 19 paires sur l'étagère sortaient de `annoncesPresentes` : plus comptées pour la protection
  des N°, la règle des doublons et le rouge « deux paires sous un N° » (§5), ni pour la valeur
  du stock ; une annonce neuve de ce compte n'aurait pas reçu de N° tant que la lecture
  publique restait la plus récente ;
- elles pouvaient être dites « disparues ».

**Correction** (le même texte dans `src/App.jsx`, `vinted-sync-extension/background.js` et la
copie serveur refabriquée `api/_lib/enligne-regle.js` par `scripts/recopie-enligne-serveur.cjs`) :
une lecture publique **complète et VIDE**, alors que le dressing du compte, lu **moins de 24 h
avant elle**, montre au moins une annonce ouverte, vaut « pas su » (§4.1 : une liste vide n'est
jamais une réponse) — le dressing ne décide que s'il a moins de 30 min, sinon les annonces sont
« à confirmer » (présentes, jamais disparues). Inchangé : un dressing de plus de 24 h face à
une lecture publique vide (elle fait foi, décision du 11 oct.) ; un dressing sans annonce
ouverte ; une lecture publique non vide ; une lecture publique incomplète.

**Preuves** :
- `scripts/audit-enligne-public-vide.cjs` (données inventées, formes mesurées : ligne
  `harvest_{uid}_listings` entière et `harvest_{uid}_enligne` projetée comme `SELECT_ENLIGNE`)
  — **10 ✅** ; lancé sur le code d'avant (`--src` sur `origin/main`) : **5 ❌** ; mutations
  `garde`, `frais`, `ouverte` : rouges toutes les trois ; app = extension = serveur sur chaque cas.
- `audit-enligne` 101 ✅, `audit-masquees-numeros` 23 ✅, `audit-supprimees` 43 ✅,
  `audit-double-vente-ailleurs` 27 ✅, `audit-coherence` ✅, `audit-extension-zip` ✅,
  `recopie-enligne-serveur --verifier` ✅, `npm run build` ✅.
- Banc `scripts/bancs/enligne.cjs` : **rouge, mais déjà rouge avant** (25 KO : il attend encore
  qu'une annonce vue SEULEMENT en public entre dans la grille — refusé depuis la règle du 2 nov. —
  et d'anciens libellés). Prouvé sans le relancer sur l'ancien arbre : sur ses fixtures exactes,
  `enLigneDesLignes` d'avant et d'après rendent une sortie **identique** (le compte au dressing
  de 72 h garde l'ancien comportement). À remettre à jour par le chantier de l'écran Annonces.

Extension **5.385.0** (5.381 sur `main` ; 5.382 prise par `claude/numeros-nouvelles`, 5.383 par
`claude/meme-photo` et `claude/vestiaire-ventes` ; 5.384 laissée libre pour un lot voisin),
zips régénérés (Chrome + Orion).

**Geste de Julien** : installer la 5.385.0 ; et **retrouver le navigateur qui fait encore tourner
une extension 5.273** (aucun appareil connu ne la porte : un ancien profil Chrome, un autre
ordinateur, une tablette) — la mettre à jour ou la retirer. Elle relit en public des comptes et
range des lectures que plus rien ne vérifie.

## Tableau des anomalies

Gravité : **P** = peut envoyer la mauvaise paire / perdre la protection d'un N° · **C** = chiffre
faux · **D** = donnée en trop, confidentialité ou égress · **·** = cosmétique / historique.

| # | anomalie | mesure | depuis | cause (fichier) | gravité | statut |
|---|---|---|---|---|---|---|
| 1 | Lecture publique vide qui efface les annonces ouvertes d'un dressing frais | 1 compte (V1), 19 annonces rendues absentes, « en ligne » 20 au lieu de 39 | 15 nov. 13:53 (une seule ligne par compte : l'historique n'est pas gardé) | `enLigneDuCompte` (`<enligne-regle>`, App.jsx / background.js / api/_lib/enligne-regle.js) acceptait `ids: []` comme une preuve | P + C | **corrigé ici** (5.385.0) |
| 2 | Une vieille extension 5.273 écrit encore | 1 lecture publique rangée aujourd'hui ; aucune ligne `ext_appareil` pour elle | inconnu | navigateur pas à jour (la 5.273 précède `publierAppareil`, 5.327) | P (indirecte) | **geste de Julien** |
| 3 | Annonces MASQUÉES par Vinted, présentes, sans N° alors que l'extension leur avait lié un N° réservé | V1 : 4 masquées sans fiche, chacune avec une réservation `panel_num_reserves.items[id]` (6 réservations liées sans fiche au total, N° absents du pool) ; V2 : 5 masquées sans fiche ni réservation | réservations du 8 au 14 nov. | l'effet de numérotation de `Comptabilite` (App.jsx, « Numérotation AUTOMATIQUE », `const items = (listings.items \|\| [])`) ne parcourt que les annonces EN LIGNE ; les masquées (`listings.masquees`, présentes depuis le 22 oct.) n'y passent jamais. Elles sont protégées (la réservation compte dans `numerosReserves`) mais aucune fiche ne porte leur N° : écran sans N°, et une republication de la masquée partirait sans le N° du carton (`repriseNumerosRecreation` lit la fiche) | P (latente) | **confié à `claude/numeros-nouvelles`** (ils réécrivent exactement cet effet : y ajouter les masquées de `masqueesSurEtagere`, au minimum pour le N° réservé / l'identité de vente, jamais un N° deviné) |
| 4 | Une réservation liée dont la fiche porte un AUTRE N° | V1 : 1 sur 45 | nov. | à regarder avec #3 (fiche numérotée par une autre voie avant la liaison) | P (1 cas) | **confié à `claude/numeros-nouvelles`** ; Julien : regarder le carton |
| 5 | Deux fiches présentes sous un même N° | 0 (V1, V2, V3) en ne comptant que les annonces ouvertes ou masquées des dressings lus | — | — | — | **rien à faire** |
| 6 | Un même N° porté par deux fiches de paires différentes (historique) | V1 : 24 N° à 2–4 fiches. 7 sont une republication (`recreeDe`), 1 la même photo, **3 de paires différentes numérotées le 14–18 oct.** (panne de `main`, historique numéros), 13 « B » de juillet–août. Toutes ces annonces sont aujourd'hui fermées (vendues) | 14–18 oct. ; juillet–août | incidents déjà racontés (`historique-numeros.md`) | · | **historique** (aucune paire présente) |
| 7 | Vente et fiche de la même annonce avec deux N° différents | V1 : 1 vente finalisée (archive B, attribution automatique de septembre) ; 0 sur les ventes depuis le 9 oct. | sept. | ancienne attribution `autoAssigned` sur la vente | · | **historique** |
| 8 | N° du bordereau (email) ≠ N° de la vente | V1 : 10 bordereaux, tous du 16 au 22 juillet, tous « B » | juillet | renumérotations d'août | · | **historique** |
| 9 | Annonce en ligne sans N° (hors masquées) | 0 chez V1, V2, V3 | — | — | — | **rien à faire** |
| 10 | Pool : N° servis qui manquent | V1 : 8 entiers absents du pool entre 1 et le plus haut ; aucune fiche hors pool ; pool sans doublon | — | trous sans danger (`prochainLibre` part du plus haut) | · | **rien à faire** |
| 11 | « À expédier » d'un compte SUPPRIMÉ resté sur une lecture de septembre | V1 : 5 comptes retirés de `vinted_accounts` gardent leurs lignes `harvest_*` (≈ 420 lignes) ; 2 ventes y sont encore « needs_action » (lecture du 20 sept.) | 3 oct. | lignes gardées exprès (« Tout sur le N° » lit tous les comptes) ; les deux ventes portent `vinted_ship_done`, donc aucune n'est dite « à poster » | · | **rien à faire** (vérifié) |
| 12 | Liste des ventes partielle | V1, plus gros compte : 2 011 ventes rangées sur 2 174 annoncées | import en cours | `import_vinted_{uid}` (12 mois) | C (historique) | **en cours** (import) |
| 13 | Ventes sans date de versement | déjà mesuré : 1 741 sur le grand compte ; même cause ici : le détail de transaction est figé à 230 (« paiement validé ») alors que la liste dit « finalisée » | — | la date vient du détail 450 | C | **confié au chantier des dates de versement** |
| 14 | Le même état ancien bloque la purge des PDF | 27 `email_bord` + 18 `label_*` de plus de 30 jours gardent leur PDF (≈ 4,6 Mo) : leur détail de transaction est figé à 230/440 ou absent | — | `purgeBordereaux` (background.js) ne regarde que `harvest_*_txn_*` à 450 | D (égress) | **proposé** : accepter aussi « finalisée » lu dans la LISTE des ventes plus fraîche — destructif, donc à décider par Julien avant de coder |
| 15 | Une vente comptée deux fois entre sources | 0 : aucun « Vendu ailleurs » sur une annonce vendue sur Vinted (les 11 recoupements de `vrm_cycle_decisions` sont des conversations, statut 1) ; aucune transaction dans deux comptes | — | — | — | **rien à faire** |
| 16 | Un compte Vinted de V1 copié chez un AUTRE propriétaire | V5 garde 10 lignes `harvest_*` (annonces, ventes, achats) du 2 oct. d'un compte qui appartient à V1, sans ligne `vinted_accounts` | 2 oct. (avant la 023) | capture faite avant « un compte Vinted par VRM » | D (confidentialité) | **réparation SQL proposée** (ci-dessous) |
| 17 | Capture brute Vestiaire avec données d'acheteurs | 40 lignes `vc_brut_*` (262 Ko) | 2–3 nov. | 5.315, coupée en 5.323 ; suppression décidée le 6 nov., pas faite | D (données personnelles) | **réparation SQL proposée** |
| 18 | Comptes jamais relus depuis plus de 7 jours | V2 (22 j), V6 (24 j), V3 (3 j) ; chez V1, un dressing lu le 11 nov. (relu en public aujourd'hui) | — | lectures faites depuis leur navigateur | C (ces vendeurs) | la ligne de fraîcheur les nomme ; rien à coder |
| 19 | Formes inconnues | 1 ligne `harvest_*_forme_releve` (virement `payouts/new`, 13 nov.) | 13 nov. | forme du relevé | · | **confié au chantier des versements** |
| 20 | Appareils | 4 ; le plus actif est en **5.329** avec 5 envois refusés « réseau » (orders_sold, profile, listings, billing) le 14 nov. | 14 nov. | extension pas à jour | C | **geste de Julien** (installer la 5.383) |
| 21 | E-mails non reconnus | 2 039 `email_inconnu_*` (4,6 Mo), dont ~250 « aucune règle ». Familles récurrentes : « La commande … a été remboursée ! » (19, reconnu depuis le 31 oct. — les anciens restent), « … – Confirmation requise » (≈ 14, oct.), « Action requise : problème avec la commande … » (5, sept.), « L'acheteur a signalé un problème… » (1, 13 nov.), « L'acheteur souhaite annuler son achat » (1), Leboncoin « Suppression de vos annonces » (2) et « N annonces ont besoin de vous » (2), eBay « L'objet … a été mis en vente » (6), « Retourne ta commande… » / « Bordereau de retour » (4) | août → nov. | `api/email-inbound.js` (familles) | C (litiges et annulations non vus) | **retours / litiges / annulation : confiés à `claude/retours`** ; Leboncoin « Suppression de vos annonces » : proposé (preuve qu'une annonce LBC n'est plus en ligne) ; le reste : informatif |
| 22 | Quarantaine | 5 `email_quarantaine_*` chez le propriétaire neutre | 22 oct. → 12 nov. | adresse non prouvée (voulu) | · | **rien à faire** |

## Réparations SQL proposées (à appliquer par Julien, en connaissance de cause)

Rien n'a été écrit en production. Chaque bloc : sauvegarde, vérification, suppression, contrôle.
L'outil SQL demande une confirmation humaine pour un `DELETE`.

### A. La capture brute Vestiaire (`vc_brut_*`, décision du 6 nov.)

```sql
-- 1. Sauvegarde (une ligne, dans la base)
insert into app_data (owner, id, data)
select owner, 'backup_vc_brut_2026-11-15', jsonb_build_object('lignes', jsonb_agg(jsonb_build_object('id', id, 'data', data)))
from app_data where id like 'vc\_brut\_%' group by owner;
-- 2. Vérification : 40 attendues
select count(*) from app_data where id like 'vc\_brut\_%';
-- 3. Suppression
delete from app_data where id like 'vc\_brut\_%';
-- 4. Contrôle : 0
select count(*) from app_data where id like 'vc\_brut\_%';
```
⚠️ La sauvegarde garde les mêmes données personnelles : la supprimer à son tour une fois
vérifié (`delete from app_data where id = 'backup_vc_brut_2026-11-15';`), ou sauter l'étape 1
si une sauvegarde quotidienne existe déjà (la famille `vc_brut` est EXCLUE de la sauvegarde
quotidienne, `api/_lib/sauvegarde-quotidienne.js`).

### B. La copie, chez un autre propriétaire, d'un compte Vinted de Julien

```sql
-- 1. Les lignes visées : harvest_* d'un compte Vinted qui appartient à un AUTRE propriétaire
--    dans vinted_accounts (10 attendues, toutes du 2 oct.)
select a.owner, a.id from app_data a
where a.id ~ '^harvest_\d+_'
  and regexp_replace(a.id, '^harvest_(\d+)_.*$', '\1') in (select vinted_user_id::text from vinted_accounts v where v.owner <> a.owner)
  and not exists (select 1 from vinted_accounts v where v.owner = a.owner and v.vinted_user_id::text = regexp_replace(a.id, '^harvest_(\d+)_.*$', '\1'));
-- 2. Sauvegarde (dans la ligne du propriétaire de la copie)
insert into app_data (owner, id, data)
select a.owner, 'backup_copie_compte_2026-11-15', jsonb_build_object('lignes', jsonb_agg(jsonb_build_object('id', a.id, 'data', a.data)))
from app_data a
where a.id ~ '^harvest_\d+_'
  and regexp_replace(a.id, '^harvest_(\d+)_.*$', '\1') in (select vinted_user_id::text from vinted_accounts v where v.owner <> a.owner)
  and not exists (select 1 from vinted_accounts v where v.owner = a.owner and v.vinted_user_id::text = regexp_replace(a.id, '^harvest_(\d+)_.*$', '\1'))
group by a.owner;
-- 3. Suppression (mêmes conditions)
delete from app_data a
where a.id ~ '^harvest_\d+_'
  and regexp_replace(a.id, '^harvest_(\d+)_.*$', '\1') in (select vinted_user_id::text from vinted_accounts v where v.owner <> a.owner)
  and not exists (select 1 from vinted_accounts v where v.owner = a.owner and v.vinted_user_id::text = regexp_replace(a.id, '^harvest_(\d+)_.*$', '\1'));
-- 4. Contrôle : la requête 1 rend 0 ligne
```
À faire seulement si ce propriétaire n'est pas un compte d'essai de Julien qu'il veut garder tel quel.

## Pour les chantiers en cours

- **`claude/numeros-nouvelles`** : #3 et #4 ci-dessus. L'effet de numérotation de `Comptabilite`
  (que la branche réécrit) ne voit que `listings.items` ; `listings.masquees` (moins les masquées
  déclarées parties : `masqueesSurEtagere`) devrait y entrer, au moins pour poser le N° RÉSERVÉ
  lié par l'extension (`reservesNum.parItem[id]`) et le N° d'une vente de la même annonce.
  Mesuré : 4 masquées chez Julien, réservées du 8 au 14 nov., N° hors du pool.
- **Écran Annonces** : `scripts/bancs/enligne.cjs` est rouge AVANT ce chantier (attentes d'avant
  la règle du 2 nov.) ; à remettre à jour.
- **`claude/retours`** : familles d'e-mails « L'acheteur a signalé un problème avec la commande… »,
  « L'acheteur souhaite annuler son achat ! », « Action requise : problème avec la commande… »,
  « Retourne ta commande d'ici le… », « Bordereau de retour – … » (table, #21).
- **Dates de versement** : le détail de transaction figé à 230 alors que la liste dit
  « finalisée » est aussi ce qui bloque la purge des PDF (#14).
