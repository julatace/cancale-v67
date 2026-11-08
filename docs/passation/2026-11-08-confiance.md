# 8 nov. 2026 — Confiance : « Tes données », le journal des gestes, /statut

Branche `claude/confiance` (depuis `claude/amazing-lovelace-xd7obl`). Pas de PR, pas de merge.
Julien : « fais tout » — des vendeurs vont payer et doivent avoir confiance.

## Ce qui existait déjà (réutilisé, pas refait)
- **Exporter mes données** (`src/exportDonnees.js`, `exporterMesDonnees` dans `src/ecrans/Reglages.jsx`).
- **Fermer mon compte** (`FermerCompte`, `api/compte.js` « FERMER MON COMPTE ») : recopier son adresse,
  bouton éteint sinon, désactivé pour le propriétaire de l'installation. Rien n'a été supprimé en test.
- **Ce que VRM a fait** (`JournalVrm`, `api/compte.js?mode=journal`, `api/_lib/securite-compte.js`).
- **La page d'état** `/etat` (`public/etat.html`, `public/etat.js`, `api/_lib/etat-public.js`).

## 1. « Ce que VRM lit et fait » (Paramètres → Mon compte → Tes données)
- Composant `src/composants/TesDonnees.jsx` (rangées iOS, neutre, détails qui vont à la ligne,
  `src/tes-donnees.css`) ; textes dans `src/tesDonnees.js`.
- Groupes : ce qu'il lit (Vinted, Leboncoin, Vestiaire, eBay, e-mails) · ce que l'extension fait
  seule · seulement si tu l'as allumé · jamais sans ton clic · ce qu'elle ne fait jamais · où c'est
  rangé · qui y a accès · tes gestes (journal, Exporter, Fermer, État de VRM, politique).
- **Chaque phrase porte `preuve`** (fichier + morceau de code). Ce qui n'est pas prouvable n'est pas
  écrit : « l'extension ne clique jamais » serait FAUX (elle remplit les dépôts Leboncoin/eBay/Vestiaire).
- **Lieu** : base Supabase en Irlande (eu-west-1, MESURÉ le 6 nov. — `2026-11-06-sauvegarde-prix.md`,
  et dit pareil dans la politique) ; serveur Vercel à Dublin (`vercel.json` → `dub1`). Vercel Inc. et
  Cloudflare restent des sociétés américaines : la politique de confidentialité le dit, la page y renvoie.
- La phrase « l'extension n'a accès qu'à … » est FABRIQUÉE depuis `SITES_EXTENSION`, que l'audit
  compare au manifeste (un site ajouté sans être nommé ⇒ rouge).
- Aide : ligne « État de VRM » (ouvre /statut) et « VRM semble en panne » dans Résoudre un problème.
  Recherche des réglages : termes `tes-donnees`, `statut`.

## 2. Journal des gestes (« Ce que VRM a fait »)
- **Nouvelle source** : les commandes du téléphone `cmd_relais_*` (bordereau, publication Leboncoin,
  accepter/refuser/faire une offre, répondre, favori), exécutées par l'extension qui y écrit son
  résultat. Lues **champ par champ** (`cmd`, `etat`, dates, `args.uid/tx/id/method/endpoint`) —
  **jamais `args.body`** (le texte d'un message). En attente / annulée / expirée ⇒ rien n'est « fait ».
- **Chaque événement porte `preuve`** (`PREUVES_JOURNAL`, posé par le serveur) ; une source sans
  preuve ne sort pas. L'écran l'affiche sous chaque ligne (`data-journal-preuve`), « D'où vient cette
  ligne : pas su » en ambre si elle manque ; « · depuis ton téléphone ».
- Filtres : + « Offres et messages », « Leboncoin ».
- **Ce qui n'est PAS noté en base est dit** (`NON_JOURNALISE`) : offres Vinted acceptées/refusées
  depuis l'ordinateur ou par le réglage auto, réponses Vinted depuis l'ordinateur, Leboncoin,
  Vestiaire, remises en vente eBay.

### À faire dans l'extension (PAS fait ici : la version n'a pas été montée, une autre branche monte la 5.327)
Pour que ces trous disparaissent, l'extension devrait publier une ligne à elle, par exemple
`gestes_ext_{uid}` : `{ items: [{ at, geste: 'offre_acceptee'|'offre_refusee'|'message'|'offre'|
'lbc_supprime'|'vc_message'|'vc_offre'|'lbc_message', compte, tx|item|lbc, resultat, auto: bool }] }`,
bornée (200 derniers), écrite dans `repondreOffre` / `autoAccepterOffres`, `executerPourApp` (gestes non
lecture), `supprimeLbcDepuisApp`, `repondreLeboncoin`, `repondreVestiaire`, `repondreOffreVestiaire` —
**jamais le texte**. Puis `lireJournal` la lit (projection `items`), `PREUVES_JOURNAL.gestes_ext`, et la
ligne correspondante sort de `NON_JOURNALISE`. Penser à `EXT_CAPACITES` (« pas su » si l'extension est en retard).

## 3. Page publique vrm.center/statut
- `vercel.json` : `/statut` → `/statut.html`. `/etat` reste tel quel (audit-signalement).
- `public/statut.html` charge `/etat.js` (le même : `/api/sante` + `/etat-version.json`) et
  `/statut.js` (incidents). Aucun script en ligne (CSP), rien d'un autre site.
- **Incidents** : `public/statut-incidents.json`, écrit à la main (forme dans son champ `lisezmoi`).
  Vide aujourd'hui (aucun incident inventé). La page n'affiche que les champs connus, les résolus
  30 jours, en cours d'abord en ambre, et **retire tout texte** qui ressemble à une donnée personnelle
  (adresse, @pseudo, téléphone, ≥ 7 chiffres, identifiant). Fichier illisible ⇒ « pas pu être lue ».
- ⚠️ Avant chaque commit, la consigne `git checkout -- public/` REMET `public/statut*` à l'index :
  stager les fichiers statut d'abord (vécu : une retouche perdue une fois).

## Preuves
- `node scripts/audit-confiance.cjs --prouve` : 39 contrôles verts ; **rouge sur la branche de départ**
  (18 contrôles, git archive) et sur **13 mutations** (page qui lit le journal, la session, ne retire plus
  une adresse, recopie tous les champs ; incident qui nomme un vendeur ; `/api/sante` qui rend l'uid ;
  geste sans preuve ; corps de commande lu ; « en attente » = fait ; écran sans preuve ; plafond 60 ;
  commande DELETE d'annonce ; `<all_urls>`).
- `scripts/bancs/confiance.cjs` (S statut, T Tes données, J journal) 390/1512 clair/sombre : vert ;
  captures regardées. `audit-comptes-securite` (4.22 : 6 sources) vert ; banc `comptes-securite` E vert
  (il clique maintenant l'onglet « Mon compte » : `?vue=compte` n'est lu qu'au premier chargement).
- `npm run build`, `audit-fonctions-api`, `audit-variables`, `audit-tdz`, `audit-export-donnees`,
  `audit-politique-hotes`, `audit-violet`, `audit-signalement`, `audit-icones`, `audit-coherence`,
  `audit-entetes` : verts.

## Geste de Julien
Aucun. Pour annoncer un incident : éditer `public/statut-incidents.json` (sans aucun nom, numéro,
adresse) et déployer.
