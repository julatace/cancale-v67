# 8 nov. — « À envoyer » : une règle de preuves de départ, partout (branche `claude/a-envoyer-preuves`)

## La demande (Julien, 8 nov., mot pour mot)
« J'ai expédié des colis, c'est encore marqué qu'il faut que je les expédie. C'est inadmissible.
Chaque donnée doit avoir du sens et être au bon endroit. »

Contexte : ses listes Vinted sont figées depuis le 6 nov. (extension iPhone en échec, corrigée en
5.326, pas encore installée) ⇒ le statut Vinted de ses ventes dit encore « Bordereau envoyé ». Les
AUTRES preuves de départ existaient, mais chaque endroit en lisait une partie différente.

## Ce qui était faux
1. **Le widget et les rappels (matin, soir, bilan)** ne lisaient que « Colis fait », « expédié à la
   main » (par n° de transaction) et la prise en charge `depart_*`. Ni l'e-mail du transporteur pour
   le n° du bordereau, ni le panneau de l'extension (`panel_bords_done`). Le bilan ne lisait même pas
   les bordereaux : la prise en charge `depart_*` n'y servait à rien.
2. **Ventes, la loupe, « Tout sur le N° », la ligne « comptes à relier »** ne connaissaient que
   « Colis fait » : une vente déposée (e-mail de dépôt) disait « À envoyer ».
3. **Colis (app)** sortait une vente sur un e-mail du n° de son bordereau SANS règle d'identité :
   un n° porté par deux ventes faisait sortir les deux, un e-mail « disponible » d'un colis entrant
   aussi — et la vente sortie n'apparaissait **nulle part** (ni « À envoyer », ni « Envoyés ») :
   un colis caché, contraire au §5. Mesuré au banc sur `origin/main` : « À envoyer » = 1 seul colis
   (9505) au lieu de 4, « Envoyés » vide.

## Inventaire — qui compte « à envoyer », avec quelles preuves

| endroit | avant | maintenant |
|---|---|---|
| Colis → À envoyer (`expeditions` → `isBordDone` → `bordShipped`) | statut, Colis fait+bord, expédié, panneau, e-mail du n° (sans ambiguïté), `depart_*` | la règle (`partisVinted`) |
| Colis → Envoyés (`listeEnvoyes`) | coche, statut, `depart_*` | + e-mail du n°, avec SA raison (`data-depart-preuve`) |
| Ma journée, la cloche `vrm_colis_aposter`, le badge (`toShip`) | idem Colis (même `isBordDone`) | la règle |
| « Coché posté mais jamais vu partir » (`cochesNonPartis`) | e-mail du n° (sans ambiguïté), `depart_*` | la règle (e-mail / transporteur) |
| Ventes : étiquette (`etapeVente`), filtre « À envoyer », carte « à envoyer / en route », frise « Postée », bouton « Déposé », `RaisonBordereauxGrises` | Colis fait seul | la règle (`estParti`, registre `raisonDepartPubliee`) : « Envoyée », en route, frise datée |
| Loupe / « Tout sur le N° » (`aPoster`), ventes toutes plateformes, fiche paire | Colis fait seul | + registre publié par Colis (`src/departVente.js`) |
| `ComptesARelierColis`, compteur de repli de la coque | statut seul / Colis fait | + registre |
| widget (`api/widget.js` `shipTxns`) | Colis fait, expédié (par tx), `depart_*` | la règle (+ e-mail, panneau, ambiguïté) |
| rappels matin/soir (`lireDonneesColis` → `txsAExpedier`) | idem widget | la règle |
| bilan (`lireDonneesBilan` → `txsAExpedier`) | Colis fait, expédié — **sans bordereaux** | la règle, bordereaux lus |
| mode équipe (`lireColisEquipe`) | statut + `postes` | inchangé (l'aide n'a pas les e-mails ; non touché) |
| Vestiaire, eBay, Leboncoin | leurs règles (`colisVcAPoster`, `colisEbay`, `resumeColisSites`) | inchangés |

## La règle — `api/_lib/depart-vente.js` (pure, importée TELLE QUELLE par l'app et le serveur)
Une vente que Vinted dit « à expédier » (`aExpedier`, inchangée de chaque côté) n'attend plus l'envoi
dès qu'UNE preuve sûre, par identité, dit qu'elle est partie :
1. « Colis fait » (`vinted_ship_done[tx]`) — « Colis fait le 7 nov. » ;
2. expédié à la main (`vinted_bords_shipped[clé]`, clé = tx || n° || numéro) ;
3. traité depuis le panneau (`panel_bords_done[clé]`) ;
4. un e-mail du transporteur (transit, arrivé, livré, reparti) pour le n° EXACT du bordereau de
   CETTE transaction — « E-mail de dépôt Mondial Relay du 7 nov. » / « E-mail Chronopost « en route »
   du 7 nov. » ;
5. la prise en charge lue chez le transporteur (`depart_*`, `departProuve`).

Ne prouve RIEN : un e-mail « info » ; un sujet qui ne parle que du bordereau/de l'étiquette ; un
e-mail `sens: 'entrant'` ; un n° porté par deux ventes ou aussi par un achat (`transp_`) ⇒ ambigu ;
un e-mail daté plus d'un jour avant la vente (ou le bordereau si la date de vente manque, côté
serveur) ; le titre (jamais) ; une lecture ratée (`null` ⇒ la preuve manque, le colis reste compté).
Une vente annulée/remboursée n'est jamais « à envoyer » (c'est `aExpedier`). État DÉDUIT, recalculé :
rien n'est écrit dans les données.

- App : `partisVinted` (dans `Comptabilite`, après `shipDone`), `estParti(o)`, `bordShipped` sort une
  vente reliée par la règle (sauf « Colis fait », dont la sortie reste celle d'avant) ; `shippedSuivis`
  ne sert plus qu'aux bordereaux SANS transaction (diagnostic). `publierDepartsVinted` → registre
  `src/departVente.js` lu par `etapeVente` (« Envoyée ») et les écrans hors de `Comptabilite`.
- Serveur : `lirePreuvesDepart` (scalaires `meta->>` des `email_track_*`, `panel_bords_done`, ids des
  `transp_*`), relu par `avecSuiviDuSujet(relireLigneMeta(x))` (la règle de l'app).
- ⚠️ Écart connu : côté serveur, le résumé de l'extension n'a pas la date de vente ⇒ la borne « avant
  la vente » prend la date du bordereau. Ne diffère de l'app que si un e-mail précède son bordereau.

## Limites (dites)
- Mondial Relay : le n° n'est jamais capté dans l'e-mail du bordereau Vinted (mesuré le 2 nov.) ⇒ un
  e-mail de dépôt Mondial Relay ne se relie à AUCUNE vente (pas d'identité commune) : la vente reste
  « à envoyer » jusqu'à « Colis fait » ou la relecture Vinted. Jamais relié par titre.
- La carte Colis « Déposé » (compteur du jour) ne compte que les coches.

## Preuves (§6)
- `scripts/audit-a-envoyer-preuves.cjs` — 27 contrôles EXÉCUTÉS : la règle (dépôt ⇒ parti + phrase,
  n° partagé, achat, entrant, étiquette, « info », ancien, illisible, 50 jumelles ⇒ une seule sort),
  la route `api/widget` sur une fausse base PostgREST (56 restent sur 61), les rappels
  (`lireDonneesColis`) et le bilan (`lireDonneesBilan`) donnent les 56 mêmes, l'annulée jamais.
  `--prouve` : **10/10 mutations attrapées**. Sur `origin/main` (git archive) : **10 rouges**.
- `scripts/bancs/a-envoyer-preuves.cjs` — 390 tactile et 1512 : Colis « À envoyer » = 9502, 9503,
  9504, 9505 ; « Envoyés » = 9501 (`data-depart-preuve="email"`, « E-mail de dépôt Chronopost du
  7 nov. ») ; Ventes « Envoyée » ; Ma journée 4 ; cloche publiée 4. **34 verts** ; sur `origin/main`
  (dist reconstruit) : **10 rouges** (À envoyer = 9505 seul, Envoyés vide, Ma journée 1, cloche 1).
  Captures regardées (Colis Envoyés 390, Ventes 1512).
- Audits retouchés (la règle a déménagé, pas affaiblie) : `audit-colis-sortants` (§7 lit
  `ventesPartiesParPreuve`), `audit-statuts` (bac à sable : `partisVinted`, `raisonDepartPubliee`).
- Verts : `audit-colis-sortants`, `audit-statuts`, `audit-identite`, `audit-coherence`,
  `audit-fonctions-api` (12), `audit-statut-transporteurs`, `audit-bilan-semaine`, et 28 audits qui
  lisent widget/rappels. Rouge préexistant : `audit-politique-hotes` (`src/enLigneLbc.js`).
- Bancs verts : `a-envoyer-preuves`, `colis-sortants`, `widget-colis`, `colis-envoi`,
  `journee-chiffres`, `journee-widgets`, `poste-sans-depart`, `vestiaire-colis`, `colis-colonnes`.
  Rouges IDENTIQUES sur `origin/main` : `chiffres-coherents` (widget 503, E et R), `colis-tous-sites`
  (12), `colis` (4), `statuts-colis` (34, même liste), `journee-coherence` (1), `journee-mieux`
  (B, J), `colis-fiables` (58).

## Geste de Julien
Aucun. (Installer l'extension 5.326 sur l'iPhone fera aussi avancer le statut Vinted.)
