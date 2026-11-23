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

## ÉTAT À LA REPRISE

- Branche poussée ; PR après 15:30 UTC ; fusion pas avant le 24 nov. 07:00 UTC.
- Rien ne part tout seul (la sauvegarde hebdomadaire envoyée chez lui reste refusée, §3 du 11 oct.) : c'est un
  téléchargement sur SON clic.

Geste de Julien : aucun.
