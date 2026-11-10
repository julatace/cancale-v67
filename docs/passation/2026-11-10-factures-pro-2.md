# 10 nov. 2026 — Factures Pro, lot Q : envoi automatique (éteint), « À envoyer », avoir proposé, registre + zip

Branche `claude/factures-pro-2` (depuis `origin/main` ae0e418d), poussée à chaque commit. Pas de PR,
pas de fusion. Rien dans `vinted-sync-extension/`. Aucune nouvelle fonction `api/` (toujours 12).

## La demande (lot Q = propositions 23 + 24 + 25 + 26, validées par Julien le 9 nov. au soir)

1. Envoi automatique de la facture à l'acheteur, **ÉTEINT par défaut**, allumé seulement par son choix ;
   jamais à une adresse devinée ; envoi par le SMTP de l'installation (`RELANCES_SMTP_*`) ou sa propre
   boîte ; absent ⇒ rien ne part et c'est dit.
2. Liste « à envoyer » (ventes Pro sans facture envoyée).
3. Avoir (facture d'annulation liée, numérotation continue, jamais de suppression d'une facture émise).
4. Registre des factures + export zip (PDF + CSV) d'une période.

## Mesuré sur la vraie base (lecture seule, SELECT, formes et nombres seulement)

| quoi | mesure |
|---|---|
| lignes `email_invoice_*` | **18**, toutes `facture_pro` `draft` : **5 numérotées** (FA-2026-0001…0005), 13 sans numéro ; **0 émise**, 0 `contenu`, 0 `preuve`, 0 `envoi` ; jusqu'à ~60 Ko (formulaire de retour en base64 ⇒ jamais `select=data`) |
| `vrm_invoice_counter` | le nombre `5` (forme d'avant le 2 nov.) |
| `vrm_pro_facture` (clés) | `actif, adresse, autoSend, codePostal, forme, logo, mentions, nom, prefixe, siret, tauxTva, tva, ville` ; ⚠️ un ancien `autoSend: "false"` existe — **lu nulle part** (grep) ; la nouvelle clé est `envoiAuto` (jamais `autoSend`, pour qu'aucune vieille valeur ne l'allume) |
| `envoiAuto` allumé / journal `vrm_facture_auto` | 0 / 0 |
| ventes Pro (`email_sale_*`, `pro:true`) | **18** |

Conséquence : le registre de Julien est vide aujourd'hui ; les 5 brouillons numérotés y sont dits
« brouillon d'avant », jamais comptés comme un trou.

## La règle (une seule, app = serveur) — `src/facturePro/registre.js`

`etatVentePro` (identité = n° de transaction, §5) : avoir émis ⇒ `annulee` · vente Vinted annulée
(`classifyOrderStatus`, la règle de l'app et de `api/_lib/ventes-regle.js`) : facture émise ⇒
`a-annuler` (avoir PROPOSÉ), sinon `annulee-sans-facture` (rien à facturer) · envoyée ⇒ `envoyee` ·
en cours / incertaine ⇒ `a-verifier` (jamais renvoyée seule) · émise sans preuve ⇒ `sans-preuve` ·
sinon la preuve de l'acheteur (`rattachement.js`, inchangée) : `a-envoyer` ou `pas-prouvee` + la
raison ; ventes Vinted pas lues ⇒ `pas-su`. `listeAEnvoyer` : le plus récent en haut.

`eligibleAuto` : `envoiAuto === true` ET une date `envoiAutoDepuis` lisible (posées ensemble par son
geste) ; vente APRÈS cette date et de moins de 48 h ; **aucune tentative d'envoi jamais faite** sur
cette facture (à la main ou seule : chaque facture part au plus une fois seule) ; « pas prouvée »
retentée au plus toutes les 2 h ; `a-envoyer` seulement.

## Ce qui a changé

- **Argent → Factures, « À envoyer »** (`FacturesAEnvoyer`, `src/FacturePro.jsx`) : ventes Pro (e-mail
  Pro, ou compte Vinted Pro sur 30 jours) sans facture envoyée ; les ventes Vinted viennent de la coque
  (`useVentesCoque`, aucune lecture de plus). Prouvée ⇒ rangée qui s'ouvre (la feuille d'envoi
  existante) + « Tout envoyer (N) » confirmé, une par une (émettre puis envoyer, le serveur relit la
  preuve à chaque fois ; arrêt sur 503/429/fiche incomplète ; bilan dit) ; fiche incomplète ⇒
  « Compléter ma fiche » ; envoi fermé ⇒ le geste ; pas prouvée ⇒ la raison, aucun bouton ; vente
  annulée facturée ⇒ « Émettre l'avoir » (confirmé).
- **« Ma facture » → Envoi** : case « Envoyer chaque nouvelle facture tout seul », décochée par défaut
  (`VIDE.envoiAuto: false`) ; la cocher DEMANDE (« Les ventes d'avant restent dans « À envoyer » »),
  puis écrit `envoiAuto` + `envoiAutoDepuis` par la fusion relue de la fiche ; décocher écrit `false`.
  Dessous : « vérifié le … », la PAUSE en ambre telle que le serveur l'a écrite (fiche incomplète —
  le manque nommé ; envoi par VRM pas ouvert ; e-mail du vendeur absent ; boîte pas connectée ;
  plafond), et les ventes pas envoyées seules avec leur raison.
- **Le passage serveur** : `api/ship-reminders.js?moment=factures` (CRON_SECRET) →
  `api/_lib/factures-auto.js`, appelé toutes les 30 min de 6 h à 23 h par GitHub
  (`.github/workflows/factures-auto.yml`). Ne visite QUE les vendeurs `envoiAuto=true` ; pause ⇒
  rien émis, rien envoyé, dit au journal ; sinon ventes Pro reçues depuis l'allumage (≤ 48 h, 5 par
  passage), preuve relue (`lirePreuveEtCommandes`, nouvelle : la même lecture rend aussi l'état de la
  vente Vinted), `emettre` puis `envoyer(…, { auto: true })` — les MÊMES fonctions que son clic
  (numéro par comparer-et-échanger, plafond 50/jour, « en cours » avant l'envoi) ; journal
  `vrm_facture_auto` (n° de transaction, issue, raison, aucun e-mail) écrit par comparer-et-échanger ;
  lecture muette ⇒ vendeur laissé pour le passage suivant ; sélection muette ⇒ 503. La réponse ne
  porte que des nombres. Le GET de la route rend le journal (`auto`).
- **L'envoi marque `auto: true`** dans `envoi` et le journal des envois quand il vient du passage.
- **Le registre** (`ListeFacturesPro`, remplace la liste « Factures Pro émises ») : période (mois, ou
  année), factures ET avoirs émis dans l'ordre d'émission (heure de Paris), total de la période
  (« au moins » si un montant manque), **trous de la numérotation dits** (« Numéro pris sans pièce :
  n° 4 »), brouillons d'avant à part, reçus d'achat exclus. « Exporter (zip) » : le registre CSV
  (BOM, `;`, virgule décimale, avoir négatif) + un PDF par pièce (le même instantané que l'envoyé) ;
  une pièce illisible ⇒ AUCUN zip. Lecture projetée `id=in.(…)&select=id,contenu:data->contenu` par
  paquets de 25 (jamais `select=data`). Zip « stored » de `src/exportDonnees.js` (accepte maintenant
  des `octets`).
- **Aucune suppression** : il n'existe aucun geste ni aucune action serveur qui supprime une facture
  (le seul `DELETE` du code des factures retire la BOÎTE d'envoi). L'avoir existait (2 nov.) ; il est
  maintenant PROPOSÉ quand la vente est annulée sur Vinted.
- `api/_lib/facture-pro.js` : `emettre`, `envoyer`, `lireListe`, `creer`, `modifierSi`, `condRev`,
  `nouveauRev`, `lireBoite` exportés pour le passage ; `journalAutoPublic`.
- `DEPS_FACTURE` reçoit `useVentesCoque` et `classifyOrderStatus`.

## Preuves (§6)

| contrôle | résultat |
|---|---|
| `scripts/audit-factures-pro-2.cjs` (exécute la VRAIE `api/ship-reminders.js?moment=factures`, la route, un faux SMTP TLS) | **48 verts** (R règle, E éligibilité, S passage serveur, N numérotation, D suppression, G registre + zip relu octet par octet) |
| … `--prouve` : 14 mutations | **14/14 rouges** : numéro réattribué (réémission ; compteur qui ne monte pas), facture supprimée (action « supprimer »), envoi sans adresse prouvée (attrapé aussi par la preuve relue à l'émission), SMTP absent pas vérifié, fiche incomplète pas vérifiée, auto allumé par défaut, ventes d'avant envoyées, facture renvoyée seule, vente annulée facturée, brouillon compté comme trou, reçu d'achat au registre, zip partiel, `moment=factures` absent |
| … sur `origin/main` (git archive) | rouge (les modules n'existent pas — la preuve est la mutation) |
| `scripts/bancs/factures-pro-2.cjs` 390 tactile / 1512, clair / sombre | **24 / 24 / 22 / 22 verts** ; captures regardées |
| … sur `origin/main` (arbre d'avant construit, banc copié dedans) | **rouge** (3 rouges : ni « À envoyer », ni registre, ni case d'envoi auto) |
| `bancs/facture-pro.cjs` (l'existant) 390 clair / 1512 sombre | 34 / 30 verts |
| audits variables, tdz, coherence, identite, icones, urssaf, argent, politique-hotes, fonctions-api (12), facture-pro (95), export-donnees, xss-facture, flux-divers, secrets, csp, colis-frequent, cle-service, statut-auto, verifier-production | verts |
| `audit-config-facture` | 1 rouge **pas de ce chantier** : `src/aTrancher.js` « Écris ce N° sur son carton » (texte du lot À trancher, déjà sur `origin/main`) |

Captures (vues) : défaut vu et corrigé — en sombre, les deux cartes n'avaient pas de fond (`--vrm-card`
n'existe pas) ⇒ `--w-carte` (DA6) ; la pause disait « RELANCES_SMTP_* » à tout vendeur ⇒ phrase sans
jargon avec le geste (les variables restent nommées au propriétaire dans « Prêt / pas encore ouvert »).

## Ce qui reste

- Le registre dans « Exporter pour mon comptable » (proposition 26) : le zip vit dans Argent →
  Factures ; l'export comptable n'a pas encore la ligne « registre des factures ».
- L'avoir d'une vente annulée n'est pas envoyé seul à l'acheteur (la route sait `envoyer {avoir:true}`,
  l'écran ne le propose pas encore).
- Les anciennes factures manuelles (`vinted_invoices`, « + Nouvelle facture ») gardent leur 🗑 :
  hors du lot Q (pas des factures Pro) — à décider par Julien (une facture numérotée ne devrait pas se
  supprimer non plus).
- Une vente Pro d'un compte Pro SANS e-mail de vente n'apparaît dans « À envoyer » que sur 30 jours.

## Gestes de Julien

1. Poser `RELANCES_SMTP_*` + `RELANCES_EXPEDITEUR` (déjà listé) — sans eux, rien ne part et c'est dit.
2. `CRON_SECRET` dans les secrets GitHub (déjà demandé pour colis-frais) : sans lui, l'envoi
   automatique ne passe jamais.
3. S'il veut l'envoi automatique : « Ma facture » → Envoi → cocher (rien ne part avant).
