# 8 nov. — L'adresse de réception UNIQUE de chaque vendeur (« comme vtools »)

Julien, 8 nov. : « il faut absolument qu'on mette ça en place ». Chaque vendeur a SA
propre adresse VRM, aléatoire (`k7p2m9…@<domaine>`), vers laquelle il crée un transfert
automatique (Gmail, iCloud, Outlook, Yahoo) ou qu'il donne directement comme e-mail d'un
compte Vinted. Tout e-mail livré à cette adresse est rangé chez LUI, sans autre preuve :
c'est VRM qui l'a fabriquée pour lui. Branche `claude/adresse-reception`.

## Gestes de Julien (6 lignes)
1. Acheter un domaine court dédié à la réception (≈ 10 €/an, ex. `recu-vrm.fr`) — pas `vrm.center`.
2. L'ajouter à Cloudflare (gratuit) et poser ses deux nameservers chez le registrar.
3. Cloudflare → Email → Email Routing → activer → Routing rules → **Catch-all** → « Send to a Worker » → le Worker de `docs/email-pipeline.md` (il transmet `envelopeTo`).
4. Vercel → Settings → Environment Variables : `DOMAINE_RECEPTION` = le domaine (sans `@`), puis redéployer.
5. `EMAIL_INBOUND_SECRET` : la même valeur sur Vercel et dans le Worker.
6. VRM → E-mails → Relier ma boîte → « Ton adresse VRM » → « Envoyer un e-mail d'essai » : « Dernier e-mail reçu à l'instant » doit apparaître.

Tant que `DOMAINE_RECEPTION` est vide, la feuille dit « Bientôt ici : ton adresse VRM » et
aucune adresse n'est fabriquée ; tout le reste marche comme avant.

## Ce qui est fait

### Serveur (aucune 13e fonction)
- `api/_lib/adresse-reception.js` (la règle) : jeton de 24 caractères, `crypto.randomBytes`
  avec tirage par rejet, alphabet sans ambiguïté `abcdefghjkmnpqrstuvwxyz23456789`
  (≈ 2^119) ; `domaineReception()` lit `DOMAINE_RECEPTION` (vide/mal formé ⇒ '') ;
  `enveloppeDe` (l'enveloppe réelle fait foi) ; `jetonsDesAdresses` (étiquette « + »
  ignorée) ; `vendeurDeJeton` (index par empreinte sous le NEUTRE, jeton RE-COMPARÉ en durée
  constante à la ligne du vendeur, `actif` relu ; `absent` · `remplacee` · `perime` ·
  `inactif` · `trouve` ; `undefined` = pas su) ; `lireCodeTransfert` (Gmail : la règle stricte
  de `transfert-gmail.js` avec `destination` = SON adresse ; Yahoo/Outlook : par l'expéditeur
  et le sujet ; le lien seulement sur les hôtes du fournisseur).
- Lignes : `vrm_adresse_reception` (vendeur : jeton, actif, creeLe, remplaceLe) ;
  `jeton_reception_{sha256}` (NEUTRE : owner ; `remplaceeLe` pour une ancienne) ;
  `vrm_adresse_reception_vu` (dernier e-mail : date, sujet, expéditeur) ;
  `vrm_adresse_reception_code` (dernier code de confirmation).
- `api/_lib/jeton-index.js` : `CHAMP_JETON.reception`, `LIGNE_JETON` (le widget et les SMS
  inchangés : `main`).
- `api/email-inbound.js` : `adresseUniqueDe` passe AVANT toutes les règles (avant le
  registre et avant le code Gmail de la boîte collective). Une adresse du domaine désigne
  le vendeur ; inconnue, mal formée, deux adresses VRM, remplacée, désactivée, index qui ne
  correspond plus ⇒ `mettreEnQuarantaine(mail, [], raison)` sous le NEUTRE **sans adresse
  réclamable** (personne ne peut la « rattacher ») ; lecture de l'index ratée ⇒ 503 ;
  quarantaine ratée ⇒ 503 ; code de confirmation pas rangé ⇒ 503. Le « dernier reçu » est un
  confort (une écriture ratée ne fait pas rejouer).
- `api/email-rattacher.js?mode=adresse-unique` (session du vendeur) : GET crée l'adresse au
  premier appel (insertion `ignore-duplicates` puis relue : deux appareils, une adresse) ;
  POST `{geste:'remplacer'}` (comparer-et-échanger sur l'ancien jeton, nouvel index, ancien
  index marqué `remplaceeLe`) ; POST `{geste:'actif', actif}`. ⚠️ La ligne vit chez le
  vendeur, donc SON navigateur peut l'écrire sous RLS : un index qui existe au nom d'un
  AUTRE n'est jamais réécrit (la ligne est tenue pour fausse, une adresse neuve est
  fabriquée — banc K). `preuve-demander` refuse une adresse du domaine VRM (409).
- `docs/email-pipeline.md` : section « adresse unique », Worker avec `envelopeTo` et
  `authentification`, catch-all.

### Code de confirmation Gmail
Gmail envoie « (#123456789) Confirmation de transfert Gmail » à l'adresse VRM du vendeur :
VRM le range chez LUI et l'affiche en grand (« Copier le code », « Confirmer chez Gmail ↗ »
si le lien pointe chez Google, l'adresse source « Si ce n'est pas ta boîte, ne confirme
pas », « Signature de Google non vérifiée » si l'en-tête n'est pas transmis).

### App
- `src/AdresseReception.jsx` (+ `src/adresse-reception.css`, `src/adresseReception.js`) :
  la feuille « Ton adresse VRM » (SheetShell, portail, poignée, FermeAuRetour) — l'adresse
  en monospace (sélection d'un toucher), « Copier l'adresse », « Envoyer un e-mail d'essai »
  (`mailto:`), « Dernier e-mail reçu il y a 3 min » (relu toutes les 30 s, page visible),
  le code, « Adresse active » (interrupteur iOS, optimiste, revient sur un refus), « Ce que
  VRM lit », le pas-à-pas Gmail / iCloud / Outlook / Yahoo avec un schéma du champ où
  coller, « Ou l'e-mail d'un compte Vinted », « Pas de transfert à la main », « Ouvrir ma
  boîte VRM », « Remplacer l'adresse » (confirmé sur place) et « Terminé ».
- Entrées : Paramètres → E-mails → Adresses (en tête), E-mails → Relier ma boîte (en tête).
  Le guide de démarrage mène à « Relier ma boîte ».

### Le transfert à la main (mesuré, audit M)
Un « TR: » d'une vente Vinted et d'un colis Mondial Relay, envoyé depuis la boîte du
vendeur : les deux sont rangés chez lui ET reconnus (vente ; suivi avec son code) quand le
texte garde la ligne « De : Vinted » / « De : Mondial Relay » ; mais le lieu du point relais
a été mal lu (« . Code de retrait : … »), la date d'arrivée n'est qu'une borne (règle
`arrivee-colis`), et le bordereau n'existe que si le PDF est joint. La feuille le dit tel
quel.

## Compatibilité
Les adresses déclarées/prouvées, la boîte collective, le script Gmail et son code de
transfert ne changent pas : la nouvelle règle ne joue que pour une adresse du domaine de
réception. Sans `DOMAINE_RECEPTION`, aucune ligne de code neuve ne s'exécute à la réception.

## Preuves
- `scripts/audit-adresse-reception.cjs` : 45 contrôles, EXÉCUTE `api/email-inbound.js` et
  `api/email-rattacher.js` sur une fausse base à état (A jeton, B domaine absent, C création
  unique, D rangé chez le bon vendeur avant le registre + l'enveloppe fait foi, E 50 vendeurs
  sans mélange, F inconnu/mal formé/deux adresses, G active, H remplacer, I code Gmail et
  faux Google, J 503, K vol de jeton, L preuve refusée, M transfert à la main).
  Branche de départ (règle recopiée dedans) : 14 ✅ · 29 ❌. Mutations (8, toutes rouges) :
  désactivée traitée comme trouvée · jeton pas re-comparé · règle sautée · enveloppe ignorée ·
  index d'un autre réécrit · remplacée pas marquée · quarantaine ratée acquittée · lien hors
  Google rendu.
- Banc `scripts/bancs/adresse-reception.cjs` (390 tactile / 1512, clair/sombre, refus, pas
  ouverte, pas su) : 70 ✅ · 0 ❌, captures regardées. La première capture montrait les cartes
  coupées au bord droit au téléphone (une cellule de grille élargie par le schéma) : le
  contrôle « rien ne déborde » jugeait la feuille, pas l'écran — il est durci (il échoue
  sur le CSS d'avant : 4 ❌) et le CSS corrigé (`minmax(0,1fr)`, domaine sur sa ligne).
- Verts : `npm run build`, `audit-fonctions-api`, `audit-preuve-adresse`, `audit-email-cle`,
  `audit-secrets`, `audit-politique-hotes`, `audit-jeton-index`, `audit-vendeur-neutre`,
  `audit-email-rattacher`, `audit-proprietaire-email`, `audit-cle-service`, `audit-violet`,
  `audit-rouge-doublon`, `audit-composants`, `audit-icones`, `audit-coherence`, et les 40
  audits qui nomment `email-inbound`. `audit-politique-hotes` : les 4 liens « Ouvrir Gmail /
  iCloud / Outlook / Yahoo » ajoutés à sa liste fermée (liens ouverts d'un clic).

## Reste / limites
- Quiconque connaît l'adresse peut y écrire (c'est le principe : l'adresse est la preuve).
  Elle est longue et aléatoire ; « Remplacer l'adresse » coupe une adresse qui a fuité.
- Yahoo / Outlook : la forme de leurs messages de confirmation n'a pas été mesurée ici
  (Outlook.com ne demande en principe pas de confirmation) — un message pas reconnu reste
  simplement un e-mail de sa boîte VRM.
- Les e-mails mis en quarantaine d'une adresse désactivée ou remplacée ne sont réclamables
  par personne (voulu : jamais chez un autre) ; s'il en faut un, le propriétaire le retrouve
  sous le NEUTRE.
