# 23 nov. 2026 — « Télécharger toutes mes données » complété (lot `claude/mes-donnees`)

Validé par Julien le 23 nov. (n° 3) : « Télécharger toutes mes données » à la demande (ventes, achats, numéros,
factures, réglages ; JSON + CSV dans un zip), seulement les données de l'utilisateur connecté (owner), rien envoyé tout
seul ; sans `select=data` sur lignes lourdes (pagination `lireTout`, projections) ; route existante si possible.

## Ce qui existait (mesuré dans le code, pas refait)

- **15 nov., lot argent-plus** : Paramètres → Sécurité des données → « Télécharger toutes mes données »
  (`src/SauvegardeDonnees.jsx`, `src/sauvegardeDonnees.js`) : un zip FAIT DANS LE NAVIGATEUR, sur SON clic, depuis SES
  lignes (`owner=eq.` sur chaque lecture, `lireTout` paginé), JSON par catégorie (ventes, achats, annonces, colis,
  messages, compta, e-mails, réglages), lignes lourdes en RÉSUMÉ seulement (`meta`, jamais `select=data`), PDF de
  bordereaux un par un (`data->>pdfB64`), jetons et clés retirés, « incomplet » nommé (LISEZMOI). Aucune route serveur.
- **3 nov. / 12 nov.** : « Exporter mes données » (tableaux CSV `feuillesExport` + l'export RGPD du serveur
  `/api/compte?mode=mes-donnees`).

## Ce qui manquait, fait ici

- Le zip de la sauvegarde n'avait que trois tableaux (ventes, achats, annonces) : il porte maintenant **tous** ceux
  d'« Exporter mes données » — `numeros.csv` (le stock et ses N°, l'achat relié par SA transaction), `factures.csv`
  (métadonnées, jamais le PDF), `depenses.csv`, `urssaf.csv`, `declarations.csv` — rangés par `TABLEAUX`
  (src/sauvegardeDonnees.js) ; aucune règle neuve (`feuillesExport`). Une source pas lue ⇒ « — ».
- **Seulement SES lignes**, aussi dans les sources de l'export (`sourcesExportDonnees`, src/ecrans/Reglages.jsx) : les
  factures (`email_invoice_*`) et les achats (`lireAchatsLies(uids, owner)`, src/App.jsx — nouveau paramètre
  facultatif, les autres appels ne changent pas) portent `owner=eq.<lui>`, en plus du cloisonnement de la base.
- Le LISEZMOI nomme chaque tableau ; le texte de la carte (`argentPlus.svg.desc`, 5 langues) le dit.

## Preuves

- `node scripts/audit-mes-donnees.cjs` : **12 verts** (le zip relu fichier par fichier, CSV relus). Mutations rouges
  (5/5) : `numeros`, `vide`, `owner-factures`, `owner-achats`, `envoi`. Code d'avant : M1 rouge (pas de numeros.csv).
- `node scripts/audit-argent-plus.cjs` (la sauvegarde du 15 nov.) : 78 verts, inchangé.
- Aucun changement visible autre que la phrase de la carte : pas de banc de rendu neuf.

## Textes et boutons (consigne de Julien relayée le 23 nov. : « trop de texte, pas assez de beaux boutons »)

- Au plus une phrase courte par bloc (≤ 8 mots), le détail sous « Pourquoi ? » (repli `vrm-repli`), les gestes en
  boutons communs (`Bouton` natif, icône + verbe court). La branche `claude/style-clair` n'ajoute pas d'autre composant
  bouton : c'est celui de `src/natif/Bouton.jsx`.

## Mesures de la vraie base (lecture seule)

Mesures base (lecture seule, 23 nov. ~11:55 UTC, projections scalaires) :
- ext_appareil_* : 19 lignes, 1 owner, 19/19 à la forme attendue (data->>atMs, data->appareil->>nav).
- vrm_meilleures_sources : 0 ligne en base (publication sur l'appareil, normal).
- studio_photos_* : 0 ligne (personne n'a encore rangé de photo au studio).
- email_invoice_* : 24 lignes.
- main : vrm_colis_retirer présent sur 4 lignes main (1 colis, tuple à 8 cases, limite lue AAAA-MM-JJ, transporteur vinted) ;
  vrm_colis_aposter ABSENT de la base (publication de CET appareil seulement : la liste des envois n'existe que là où Colis/Ma journée l'a calculée) ;
  vrm_fiches_neuves ABSENT partout ; vrm_slots : 1 ligne main, 8 cases.

## ÉTAT À LA REPRISE

- Branche poussée ; PR après 15:30 UTC ; fusion pas avant le 24 nov. 07:00 UTC.
- Rien ne part tout seul (la sauvegarde hebdomadaire envoyée chez lui reste refusée, §3 du 11 oct.) : c'est un
  téléchargement sur SON clic.

Geste de Julien : aucun.
