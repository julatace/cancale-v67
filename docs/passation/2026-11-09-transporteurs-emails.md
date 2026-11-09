# 9 nov. (soir) — Transporteurs inconnus, e-mails Vestiaire, SMS de 5 expéditeurs (branche `claude/transporteurs-emails`)

## Les demandes de Julien
1. « Règle le problème des transporteurs inconnus. » (Colis → Envoyés, À envoyer, la frise, Ma journée)
2. « Le transfert des e-mails est bien : pour les ventes Vestiaire Collective on est informé par Vestiaire
   par message, il y a énormément d'informations qui peuvent être envoyées par e-mail, pareil pour Chronopost. »
3. (précisions du soir, captures iPhone) Son « transfert de message » est le transfert de **SMS** par
   Raccourcis (déjà en place pour Mondial Relay) : il veut la même chose pour **VestiaireCo**, **Chronopost**,
   et les formes réelles reçues de **MRELAY**, **Pickup**, **VintedGo**. Plus 8 formes réelles d'e-mails Vestiaire.

## 1. Le transporteur lu sur l'ÉTIQUETTE (le PDF du bordereau)
**Cause restante** (après `2026-11-08-colis-envoyes-tri.md` et `2026-11-09-fiabilite.md`) : le transporteur ne
venait que de la forme du n°, de `depart_*`, de `email_track_*` du même n° et du nom écrit dans l'e-mail du
bordereau. Une vente dont l'e-mail ne nomme personne et dont le n° est vide ou ambigu restait « inconnu ».
Le **PDF** de son bordereau, lui, est rangé pour CETTE vente (son n° de transaction : une identité, §5).

**Ce qui est fait**
- `api/_lib/texte-pdf.js` — extracteur de texte **sans IA** sur `pdf-lib` (déjà là pour le tamponnage) :
  flux de contenu des 4 premières pages + formulaires XObject, opérateurs Tj/TJ/'/", polices simples
  (octet = caractère, `/Differences`) et composites **avec** table ToUnicode. Ce qu'il ne sait pas lire
  (police CID sans table, texte en image, logo) ne donne **rien**. Bornes : 3 Mo, 2 Mo décodés, 20 000 car.
- `api/_lib/transporteur-pdf.js` — la règle : `transporteursNommes` (celle de l'e-mail du bordereau) + les
  noms longs cherchés aussi « collés » (lettres dessinées une à une) ; **un seul nom ⇒ sa clé, deux ⇒ rien**
  (`plusieurs`), aucun ⇒ `aucun`, PDF illisible ⇒ `illisible`. Le n° n'est gardé que s'il a la **forme
  propre** de CE transporteur, est **unique** dans le PDF, et pour Mondial Relay (8 chiffres, forme banale)
  seulement écrit après « suivi / expédition / colis / tracking ». **Le texte du PDF n'est jamais gardé**
  (adresse de l'acheteur).
- **À la réception** (`api/email-inbound.js`, branche « Bordereau d'envoi ») : `pdfLu`, `transporteurPdf`,
  `suiviPdf` rangés en **scalaires** (⇒ `meta`, le PDF n'est plus jamais relu pour ça) ; un bordereau sans n°
  dans l'e-mail prend celui de l'étiquette (`suiviSource: 'pdf'`).
- **Rattrapage borné** (`passeTransporteursPdf`, api/_lib/transporteur-anciens.js, appelé au cron du matin
  `api/ship-reminders.js`, aucune fonction de plus) : candidats `email_bord_*` avec PDF jamais lu (`pdfLu`
  absent) sans transporteur ou sans n°, et `harvest_*_label_{tx}` (capté par l'extension) quand aucun
  bordereau e-mail n'existe pour ce n° (`label_latest` jamais) ; **6 PDF par passage, un par requête**
  (`select=pdf:data->>pdfB64`), les plus récents d'abord ; résultat dans `vrm_bord_transporteurs`
  (`pdf: {tx:{t,s}}` lu par l'app, `pdfVus: {tx:{r,at}}` jamais lu par l'app) ; idempotent ; liste ou ligne
  illisible ⇒ rien écrit ; un PDF dont la lecture rate n'est pas noté (relu plus tard). L'autre passe (texte
  de l'e-mail) garde maintenant les clés `pdf`/`pdfVus` de la ligne (`{ ...cur, … }`).
- **App** : `fetchEmailBordereaux` projette `transporteurPdf, suiviPdf, pdfLu` et lit `pdf` de la ligne ;
  `transporteurRelu` fusionne l'étiquette relue **sans jamais remplacer** la réception ;
  `transporteurDeVente` (src/colisEnvoyes.js) : départ lu chez le transporteur → **étiquette (`pdf`)** →
  e-mail du bordereau / e-mails du même n° / forme. Les ventes **sans** bordereau e-mail prennent l'étiquette
  captée par l'extension par leur n° (`transporteurVente(b, tx)` sur Envoyés, À envoyer, frise).
- Leboncoin (`deliveryMethod`) et Vestiaire (`v.transporteur`) ont déjà leur transporteur par la plateforme ;
  eBay : aucun PDF rangé (étiquette eBay). Rien à faire là.

## 2. Les e-mails Vestiaire (formes réelles du 9 nov.)
`api/_lib/vestiaire-email-autres.js`, branché dans la branche Vestiaire de `email-inbound.js` (après la vente) :
| sujet | ce qui est rangé | où |
|---|---|---|
| « Il vous reste N jours pour expédier votre vente (#N) » | la date limite de CETTE vente (réf du sujet = Ref du corps), 23:59:59 Paris ; une vente connue : rien d'autre ne bouge | `vc_ventes` (fusion de la vente, CAS) |
| « Annonce en attente de validation » | état `attente`, prix de vente, « pour vous » (sera versé), marque/titre | `vc_email_annonces.annonces[ref]` |
| « Votre … vient d'être mis en ligne » | état `en_ligne` (ne redescend jamais en attente) | idem |
| « … a fait une contre-offre » | montant, échéance réception + 48 h, forme du lien | `vc_email_offres.offres` |
| « … a accepté votre offre ! » | montant, échéance + 24 h — **pas une vente** | idem |
| « Augmentez vos chances de vendre » | rien (journal seulement ; pas de prix conseillé, refus du 11 oct.) | — |
- Deux réf différentes ⇒ rien rangé, e-mail gardé entier. « ou votre vente sera automatiquement annulée » est
  une condition : rien n'est annulé. Le pseudo de l'acheteur et le prénom du vendeur ne sont jamais rangés
  (le journal des e-mails garde, comme pour tout e-mail, le sujet et le texte bornés).
- **Identité** : la réf « #N » = « Ref » = `productId`, la clé de `vc_ventes` (mesuré le 2 nov. sur les ventes).
  Pour les **annonces**, l'extension range l'id produit (`vc-inject.js` `idDe`) : c'est très probablement le
  même nombre, **pas mesuré** ⇒ `vc_email_annonces` est une ligne à part, l'app ne la relie pas encore.
- **Offres sans réf** : jamais rattachées. Le lien « Répondre à l'offre » : seule sa FORME est notée
  (`lienForme`, chiffres masqués) ; s'il porte un id d'offre/article stable, ce sera une identité — à mesurer
  (requête 6). Pas d'écran pour les offres e-mail dans cette branche.
- **Chronopost (e-mails)** : déjà reconnus (formes mesurées les 22-23 oct. : « Information sur votre colis »,
  « arrivé en consigne Pickup », code + QR, `audit-email-formes`). Rien ajouté sans forme réelle nouvelle.

## 3. Les SMS (POST /api/widget?mode=sms, jeton `vrm_sms_token`, vendeur = celui du JETON)
Un lecteur par expéditeur, chacun avec son en-tête de règles ; aiguillage `api/_lib/sms-autres.js` ; outils
communs `api/_lib/sms-commun.js` ; même plafond horaire, même essai, mêmes 503.
- **MRELAY** (`sms-mondialrelay.js`) : les formes réelles « est arrivé au **P. Relais** X.  Retirez-le vite avec
  le code N » et le rappel « Retirez vite votre colis N avec le code C! Il vous attend au Point Relais X »
  **n'étaient pas lues** (sur origin/main : « à vérifier » sans code). Corrigé ; le rappel ne crée rien de
  neuf (même n° ⇒ même ligne) et **ne date jamais l'arrivée**.
- **VintedGo** (`sms-vintedgo.js`) : « utilise le code K12345 pour récupérer ton colis avant le JJ/MM/AAAA ».
  Le **code** est l'identité : la ligne d'e-mail qui le porte déjà reçoit la date limite ; un code lu dans une
  conversation (`panel_colis_relais`) ⇒ `email_track_vinted_code-{code}` « à retirer » (l'app relie par code) ;
  code inconnu ⇒ « à vérifier » avec le code (Colis le dit, avec la date). Id du relais (`/e/N`) noté.
- **Pickup** (`sms-pickup.js`) : ni n° ni code ⇒ jamais un colis ; une information par **jeton de Pass**
  (`vrm_sms_infos`), montrée dans Colis → À retirer avec « Présenter le Pass » (lien ouvert sur son clic).
- **VestiaireCo** (`sms-vestiaire.js`) : marque + date limite (année de la réception) ⇒ une information
  (`vrm_sms_infos`), le rappel met à jour la MÊME (même marque + même jour) ; Colis → À envoyer la dit ;
  « c'est peut-être « … » » seulement si UNE seule vente Vestiaire à envoyer commence par cette marque ;
  la liaison n'existe que par son clic (`vrm_sms_liens`, écrite par l'app). Date passée ⇒ « vérifie sur
  Vestiaire s'il est parti », jamais « annulée ». Un e-mail de vente de même marque/date porte la réf :
  c'est lui qui range la vente ; le SMS ne rattache rien lui-même.
- **Chronopost** (`sms-chronopost.js`) : forme **pas mesurée** ⇒ prudent : n° de forme propre XW/ZW…TS/SP
  obligatoire ; « disponible » seulement avec un code écrit après « code » et sans condition dans la phrase ;
  sinon « à vérifier » avec le n° seul ; sans n° ⇒ rien.
- **Aide Raccourcis** (Réglages → Notifications, `src/smsColis.js`, `src/SmsColis.jsx`) : liste des 5
  expéditeurs ; « Expéditeur » vide (MRELAY, Pickup, VintedGo, Chronopost ne sont pas des contacts, leurs SMS
  contiennent « colis ») ; **2ᵉ automatisation sur le mot « article »** pour VestiaireCo ; champ facultatif
  `expediteur`.

## Preuves (§6)
| contrôle | branche | origin/main (git archive, contrôle copié dedans) | mutations |
|---|---|---|---|
| `audit-transporteur-pdf` (vraie route email-inbound, PDF fabriqués : MR, deux noms, illisible, Type0+ToUnicode, lettres une à une ; règle ; rattrapage ; fusion) | 28 verts | 16 rouges / 20 | source pdf retirée (5), deux noms ⇒ le premier (4), n° MR sans mot-clé (3), lecture ratée ignorée (2), ToUnicode ignorée (2), réception sans PDF (10) |
| `audit-transporteur-anciens` + T8 (le **cron exécuté** relit l'étiquette, un PDF par requête) | 31 verts | T8 rouge (4) | — |
| banc `colis-envoyes-tri` (8 ventes au même titre ; 7107 étiquette e-mail, 7108 étiquette relue ; info SMS Vestiaire) | 76 verts | 20 rouges / 68 (inconnu 5 au lieu de 3) | source pdf retirée ⇒ 20 rouges |
| `audit-sms-expediteurs` (vraie route `?mode=sms` via `api/widget.js`, formes réelles, valeurs fabriquées) | vert + 8 mutations rouges | 26 rouges | 8 mutations intégrées |
| `audit-vestiaire-emails-autres` (vraie route, 6 formes) | 16 verts | 11 rouges / 12 | réf ≠ acceptée, en ligne redescend, offre acceptée à 48 h, écriture ratée ⇒ 200 : chacune 2 rouges |
- Verts aussi : `npm run build`, `audit-{variables,tdz,coherence,identite,statuts,fonctions-api}`,
  `sms-colis`, `transporteur-bordereau`, `depart-mondialrelay`, `journal-emails`, `email-formes`,
  `bordereau-des-email`, `colis-ventes-email`, `vestiaire-email`, `vestiaire-partout`, `colis-envoi`,
  `colis-trois`, `transporteur-lu`, `a-envoyer-preuves`, `codes-retrait`, `mondialrelay-serveur`,
  `colis-sens`, `notif-colis`.
- `audit-transporteur-anciens` T3/T5 jugent maintenant ce que range LEUR passe (`parTx`/`vus`) : la passe
  des étiquettes écrit aussi dans la ligne.
- Captures regardées (Envoyés 1512 sombre : « Chronopost 3 · Mondial Relay 2 · Transporteur inconnu 3 »).
- Mesure de la vraie base : **pas faite** (pas d'accès à la base VRM depuis cette session). Aucun chiffre
  « N colis reconnus » n'est donc donné.

## Requêtes SQL pour Julien (lecture seule, scalaires, aucune donnée personnelle)
À coller dans l'éditeur SQL de Supabase (projet VRM). Elles ne lisent que des formes et des comptes.

**1. Formes des n° de bordereau (combien restent sans n° utilisable)**
```sql
select case
  when coalesce(meta->>'suivi','') = '' then 'vide'
  when meta->>'suivi' ~ '^[XZ]W[0-9]{9}(TS|SP)$' then 'Chronopost XW/ZW…TS/SP'
  when meta->>'suivi' ~ '^[0-9]{8}$' then '8 chiffres (Mondial Relay)'
  when meta->>'suivi' ~ '^VGS[0-9]{8,}$' then 'VGS (Vinted Go)'
  when meta->>'suivi' ~ '^[A-Z]{2}[0-9]{9}[A-Z]{2}$' then 'S10 …' || right(meta->>'suivi', 2)
  else 'autre : ' || regexp_replace(regexp_replace(meta->>'suivi', '[0-9]', '9', 'g'), '[A-Z]', 'A', 'g')
end as forme, count(*) as n
from app_data where id like 'email_bord_%' group by 1 order by 2 desc;
```
**2. Combien de bordereaux ont un PDF (e-mail et extension)**
```sql
select 'email_bord' as source, coalesce(meta->>'_pdf','false') as a_un_pdf, count(*) from app_data where id like 'email_bord_%' group by 2
union all
select case when id like '%\_label\_latest' then 'label_latest (copie)' else 'label_{tx}' end, coalesce(meta->>'_pdf','false'), count(*)
from app_data where id like 'harvest\_%\_label\_%' group by 1, 2 order by 1, 2;
```
**3. Poids des PDF (pour l'égress du rattrapage : 6 par vendeur et par jour)**
```sql
select count(*) as n, round(avg(length(data->>'pdfB64')) / 1024) as ko_moyen, round(max(length(data->>'pdfB64')) / 1024) as ko_max
from app_data where id like 'email_bord_%' and meta->>'_pdf' = 'true';
```
**4. Après le premier cron du matin : ce que les étiquettes ont dit**
```sql
select coalesce(meta->>'pdfLu','(pas encore lu)') as lu, coalesce(nullif(meta->>'transporteurPdf',''),'—') as transporteur, count(*)
from app_data where id like 'email_bord_%' group by 1, 2 order by 3 desc;
select 'nommé' as quoi, v->>'t' as detail, count(*) from app_data, jsonb_each(coalesce(data->'pdf','{}'::jsonb)) e(k, v) where id = 'vrm_bord_transporteurs' group by 2
union all
select 'rien', v->>'r', count(*) from app_data, jsonb_each(coalesce(data->'pdfVus','{}'::jsonb)) e(k, v) where id = 'vrm_bord_transporteurs' group by 2;
```
Si « aucun » domine : l'étiquette dessine le nom en image (logo) ou en police sans table — le dire à une
session, qui regardera UN PDF à blanc (jamais dans le dépôt).
**5. E-mails Vestiaire et Chronopost encore « à vérifier », par famille de sujet (mots-clés seulement)**
```sql
select case when data->>'from' ~* 'vestiaire' then 'Vestiaire' else 'Chronopost' end as expediteur,
  case when data->>'subject' ~* 'vendu' then 'vendu' when data->>'subject' ~* 'exp[ée]di' then 'expédier'
       when data->>'subject' ~* 'offre' then 'offre' when data->>'subject' ~* 'paiement|virement|vers' then 'paiement'
       when data->>'subject' ~* 'annul' then 'annulation' when data->>'subject' ~* 'authenti|expert|contr[ôo]l' then 'authentification'
       when data->>'subject' ~* 'livr' then 'livré' when data->>'subject' ~* 'relais|consigne|disponible|retir' then 'relais'
       when data->>'subject' ~* 'ligne|annonce|validation' then 'annonce' else 'autre' end as famille,
  data->>'etat' as etat, count(*) as n, min(length(data->>'subject')) as lg_min, max(length(data->>'subject')) as lg_max
from app_data where id like 'email_reception_%' and data->>'from' ~* 'vestiaire|chronopost'
group by 1, 2, 3 order by 1, 4 desc;
```
**6. La forme du lien « Répondre à l'offre » (une identité d'offre ?)**
```sql
select v->>'lienForme' as forme, count(*) from app_data, jsonb_each(coalesce(data->'offres','{}'::jsonb)) e(k, v)
where id = 'vc_email_offres' group by 1 order by 2 desc;
```
**7. Les SMS rangés (après quelques jours)**
```sql
select v->>'source' as source, count(*) as infos, sum((v->>'n')::int) as sms from app_data, jsonb_each(coalesce(data->'infos','{}'::jsonb)) e(k, v)
where id = 'vrm_sms_infos' group by 1;
select split_part(id, '_', 3) as transporteur, data->>'status' as statut, coalesce(data->>'smsAVerifier','') as a_verifier, count(*)
from app_data where id like 'email_track_%' and data->>'source' = 'sms' group by 1, 2, 3 order by 4 desc;
```

## Gestes de Julien
1. Réglages → Notifications → « SMS » : ajouter la **2ᵉ automatisation Raccourcis** sur le mot « article »
   (VestiaireCo), identique à la première. Les SMS Pickup / VintedGo / Chronopost passent par la première
   (« colis »).
2. **Copie-moi un SMS Chronopost** (appui long → Copier, en masquant le code si tu veux) : sa forme n'est pas
   apprise, seul son n° est gardé « à vérifier » en attendant.
3. Lancer les requêtes 1 à 3 maintenant, 4 après le cron de demain matin, 5-7 dans une semaine, et
   donner les résultats à une session.

## Ce qui reste
- Mesurer (requêtes ci-dessus) : part des étiquettes lisibles ; forme réelle des SMS Chronopost ; lien d'offre.
- Vestiaire : relier `vc_email_annonces` aux annonces de l'extension quand l'égalité réf = id produit est
  mesurée ; un écran pour les offres e-mail (suggestion « même marque + même prix affiché » sur SON clic).
- Leboncoin/eBay : rien (transporteur déjà lu par la plateforme ; aucun PDF eBay rangé).
- Aucune nouvelle version d'extension n'est nécessaire.
