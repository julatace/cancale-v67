# 11 nov. 2026 — Lot DJ1, Facture Pro : SIRET ⇒ « C'est bien toi ? », compte pro seulement, bon de retour, plus de pied VRM

Branche `claude/facture-siret` (depuis `origin/main` 3cb90230), poussée à chaque commit. Pas de PR.
Rien dans `vinted-sync-extension/`. Aucune nouvelle fonction `api/` (toujours 12), aucun nouvel hôte.

## Ses mots (11 nov.)

« Je veux sur la facture que quand on remplit le SIRET, le nom, le RCS, le nom de l'entreprise se
remplissent automatiquement, tu vois ça fait une animation recherche et après on demande à la personne
de vérifier si les infos sont bonnes ; pareil lorsqu'on choisit le statut de l'entreprise. » « Quand je
remplis le numéro de SIRET, je veux que quand je valide ça cherche le RCS, je veux que le visuel soit
mieux. » « Les factures doivent être envoyées et générées que sur compte professionnel, ou alors on
demande au vendeur sur quel compte il veut que ça soit envoyé. » « — Cette facture vous est envoyée par
VRM pour le compte de … Pour toute question, répondez simplement à cet e-mail … Je veux pas de ce
message. » « Je viens de faire une vente sur mon compte Pro, et je n'ai pas le bouton envoyer la facture
à l'acheteur, je veux que tu l'ajoutes ; pareil, il doit y avoir à côté de chaque vente le bon de retour
pour toutes les ventes sur un compte professionnel. »

## Mesuré (lecture seule, Supabase, formes et nombres seulement)

| quoi | mesure |
|---|---|
| ventes Pro des 9-10 nov. (`email_sale_*`, `pro:true`, compte Pro) | 3 (n° 24068954156, 23958820471, 24118055815) |
| … dans `harvest_<uid>_orders_sold` (`my_orders`, 2 010 lignes) | 3/3, même prix, e-mail 70 à 84 s APRÈS la vente |
| … brouillon `email_invoice_tx<n°>` | 3/3, même e-mail d'acheteur |
| profil du compte (`business`) | `true` |
| ⇒ la règle `preuveAcheteur` | PASSE sur les 3 : la donnée était bonne |
| formulaire de retour joint par Vinted (`retourNom` + `retourB64`) | **20 brouillons sur 20** (≤ 58 Ko en base64) |
| API Recherche d'entreprises | `recherche-entreprises.api.gouv.fr` **refusée par le réseau de la session** (403 du proxy) ; forme relue dans `open-api.yml` du dépôt officiel `annuaire-entreprises-data-gouv-fr/search-api` : `etablissement.nom_commercial`, `liste_enseignes[]`, `activite_principale` (APE), `result.activite_principale`, `tva[]`, `nature_juridique` ; **aucun champ greffe / ville du RCS** |

**Pourquoi le bouton manquait sur sa vente du jour** : `FacturePro.jsx` lisait les e-mails de vente Pro
et les factures UNE fois par chargement (`_donnees`, jamais relu). L'app restée ouverte (iPhone) avant
l'arrivée de l'e-mail (~1 min après la vente) ne le voyait jamais ⇒ pas de bouton (ou la raison « aucun
e-mail », regroupée en tête). Corrigé : relues au-delà de 60 s (`FACTURES_FRAICHES_MS`) au retour sur
l'app (`visibilitychange`), au montage d'une ligne, et dès qu'une vente d'un compte Pro n'a pas encore
son e-mail ; une relecture ratée ne remplace pas une lecture réussie.

## Ce qui a changé

1. **SIRET ⇒ recherche à la validation** (`src/RechercheEntreprise.jsx`, `src/entrepriseRecherche.js`,
   même composant dans Ma facture et Ma configuration) : taper ne cherche rien ; Entrée, sortie du champ
   ou « Rechercher » lancent. Pendant : carte-squelette (Dénomination, Forme, Adresse, Immatriculation,
   APE, TVA) dont les barres se remplissent une à une + barre de progression ; **arrêt à 8 s**
   (`DELAI_RECHERCHE_MS`) ⇒ « Pas trouvé à temps. Remplis à la main, ou réessaie. » Mouvement réduit ⇒
   immobile. Un SIRET faux (Luhn) ⇒ dit, aucune requête. Registre muet ⇒ « remplis à la main ».
2. **« C'est bien toi ? »** : dénomination, nom commercial (à vérifier, jamais écrit), forme juridique EN
   MOTS (table INSEE officielle : EI, EURL, SARL, SAS, SASU, SNC, SCI…), adresse, code postal, ville,
   **immatriculation**, code APE, n° de TVA (seulement si le registre DGFiP la porte : assujettie ; sinon
   « Pas de TVA au registre : TVA non applicable, art. 293 B »). « Oui, c'est moi » écrit (tout reste
   modifiable, coche « Rempli depuis le registre ») ; « Non, corriger » n'écrit rien. Un champ qu'il a
   écrit autrement : « La mienne » (par défaut) / « Le registre ».
   **RCS** : l'API publique ne donne PAS la ville du greffe ⇒ jamais inventée. Société (familles INSEE 5
   et 6) : « RCS [ville] 812 345 676 » avec un champ « Ville du greffe (sur ton Kbis) » dans la carte ;
   tapée ⇒ « RCS Rennes 812 345 676 » écrit avec le reste. EI : « Pas de RCS au registre public (EI au
   RNE) ». Répertoire des métiers : « RM », recopier le n° du D1.
3. **Choisir le statut ⇒ ses mentions, même carte** (`CarteMentionsForme`) : « Pour une SASU, ta facture
   porte : » nom · SASU, SIRET, RCS, capital social, régime de TVA — chaque mention ✓ ou « Remplir » (le
   doigt sur le champ) ; EI : « nom EI », pas de capital, RCS seulement si inscrit, et « Micro sous le
   seuil de TVA ? » ⇒ « Oui, franchise » (sur son clic). « C'est bon » ferme.
4. **Compte professionnel seulement** (`src/facturePro/comptes.js`) : Vinted = ce que Vinted dit
   (profil `business` ou e-mail Vinted Pro), inchangé. Leboncoin / eBay / Vestiaire (aucune ne dit
   « pro » ; Vestiaire facturable depuis l'extension 5.340, fusionnée ici) : `vrm_pro_facture.comptesFacture`
   { `leboncoin:<compte>` | `ebay:<compte VRM>` | `vestiaire:<compte ou principal>` : true/false } ;
   jamais répondu ⇒ la vente DEMANDE « <compte> est-il ton compte Leboncoin professionnel ? Oui, facturer
   / Non » (fiche relue avant d'écrire, lecture ratée ⇒ rien) ; non ⇒ aucun bouton ; Ma facture →
   « Sur quels comptes ? » les liste (cases). **Le serveur refuse** (`api/_lib/facture-autres.js`, 409
   `compte`, aucun numéro pris). eBay : le compte est celui de la LIGNE `ebay_orders[_<id>]`, jamais le
   pseudo affiché.
5. **Sur chaque vente d'un compte Pro** (ligne ET fiche) : « Envoyer la facture » (prouvée) et
   **« Bon de retour »** : le formulaire de retour que Vinted a joint à CETTE vente (lu au clic seulement,
   projeté `retourB64`, jamais dans une liste) ; sans lui (ou déjà purgé après l'envoi), un bon dessiné par
   VRM (`src/facturePro/bonRetour.js`) : vendeur (+ EI), adresse de retour de Ma facture, n° de la vente,
   article, date, « Droit de rétractation : 14 jours à compter de la réception (Code de la consommation,
   art. L221-18) », et le modèle de formulaire de rétractation (annexe R221-1). Pas d'adresse ⇒ pas de
   bon, le manque dit. Le bon reste sur la ligne même quand la raison « acheteur pas prouvé » est
   regroupée en tête.
6. **E-mail de facture sans pied** : plus de « Cette facture vous est envoyée par VRM pour le compte de … »
   (ni la version anglaise `PIED_VRM_EN`, retirée) ; texte et HTML = SON message signé de sa boutique ; la
   réponse va toujours au vendeur par **Reply-To** (inchangé), sans le dire. Expéditeur « <vendeur> via
   VRM » inchangé.

## Preuves

| contrôle | résultat |
|---|---|
| `scripts/audit-facture-siret.cjs` (nouveau : R règle exécutée sur la forme documentée, H recherche, C comptes, B bon de retour + PDF relu, E e-mail, F relecture) | 28 verts |
| … `--prouve` : 13 mutations (Oui écrase l'écart, RCS de la ville du siège, EI au RCS, nom commercial écrit, franchise à une société, recherche à la frappe, pas d'arrêt à 8 s, tout compte facturable, serveur sans contrôle, pied revenu, bon sans délai, factures lues une fois, pas de bon) | **13/13 rouges** |
| … sur `origin/main` (git archive) | rouge (modules absents) |
| `audit-facture-pro` (V6 réécrit : aucun pied, Reply-To) | 99 verts ; **rouge sur origin/main** (V6) |
| `audit-factures-autres` (+ C1 : compte jamais répondu / « non » / autre compte ⇒ 409, aucun n°) | 44 verts ; **3 rouges sur origin/main** |
| `audit-facture-en-tva` (F14 : plus de « on behalf of ») | 36 verts |
| `audit-config-facture` (B4 : arrêt à 8 s) | vert sauf **T1 « tes cartons »** (EmballagesCarte.jsx, InventaireAnnuel.jsx) — **rouge aussi sur origin/main**, pas de ce lot |
| `bancs/config-facture.cjs` F (Ma facture : pas de recherche à la frappe, squelette tenu, « C'est bien toi ? », ville du greffe, Oui, statut SASU, 8 s, panne) + C (configuration) — 390/1512 clair/sombre | **tout vert** ; sur l'arbre d'origin/main : 4 rouges |
| `bancs/facture-vente-pro.cjs` (nouveau : facture + bon de retour sur la ligne, formulaire Vinted lu au clic, e-mail arrivé après l'ouverture, bon VRM) — 390/1512 clair/sombre | **tout vert** ; sur origin/main : 5 rouges |
| `bancs/facture-pro` (390 clair), `factures-autres`, `factures-pro-2`, `facture-en-tva` | 34 / 44 / 92 / 88 verts |
| `npm run build`, audits variables, tdz, coherence, identite, icones, entreprise-siret, factures-pro-2, fonctions-api (12), textes-courts, secrets, xss-facture, politique-hotes, csp, mentions-paiement | verts |

Captures regardées (390 et 1512, clair et sombre) : squelette, « C'est bien toi ? », ville du greffe,
« Rempli depuis le registre », carte SASU, « Pas trouvé à temps », lignes Ventes (facture + bon de
retour), bon de retour VRM ouvert dans la visionneuse.

## Ce qui reste / limites

- La ville du greffe ne peut pas être trouvée sans inventer (registre public sans greffe ; le RNE de
  l'INPI demande un compte) : il la recopie une fois de son Kbis.
- L'API n'a pas pu être appelée depuis la session (réseau) : forme lue dans la doc officielle.
- Le bon de retour de VRM n'est pas joint à l'e-mail de facture (celui de Vinted l'est déjà, inchangé).

## Geste de Julien

Aucun obligatoire. Dans Ma facture : valider son SIRET (Entrée), vérifier la carte, taper la ville du
greffe s'il est en société. Sur sa première vente Leboncoin/eBay : répondre « Oui, facturer » / « Non ».
