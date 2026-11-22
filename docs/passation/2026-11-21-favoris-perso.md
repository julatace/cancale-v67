# Messages aux favoris personnalisés — 21 nov. 2026 (ext. 5.417.0, `favorisperso2`)

Branche `claude/favoris-perso` (depuis `origin/main` 52a52466f). Zips NON régénérés (l'intégration le fera).
Version 5.417.0 : `CODE_VERSION`, manifeste, `lbc-inject.js`, `lbc-relay.js`, `EXT_ATTENDUE`, `public/extension-version.json` ;
capacité `favorisperso2` (fonction `choisirMessageFavori`) dans `EXT_CAPACITES` et `audit-coherence`.

## La demande
Julien (21 nov.) : « pour les messages aux favoris ça doit être beaucoup mieux, on n'a pas la possibilité de personnaliser,
améliore ça ». Modèle regardé (jamais copié) : Bleam — « Message par défaut (1 article) », plusieurs messages tirés au
hasard avec leur compteur d'envois (« non mesuré »), « Insérer le prénom », message « lot », « Messages conditionnels »
(heure, jour, prix ; une seule règle : la plus précise, puis la plus haute), offre automatique en %, délai avant envoi.

## Ce qui est fait
### Le réglage (une source app = extension)
`vrm_reglages_auto` → `vinted_bleam.comptes[uid].favMessages`, normalisé par `fpReglage` (bloc `<reglages-auto-ligne>` de
`src/reglagesAutoLigne.js`, recopié dans background.js) : `un` (8 versions au plus), `lot` (8), `regles` (10 au plus :
`heures {de, a}` heure de Paris, par-dessus minuit permis ; `jours` ; `prix {min, max}` en € ; `marques` ; 5 versions
chacune ; une règle sans condition ou sans texte n'est pas gardée). `actif` est toujours faux : ce n'est pas une
automatisation, rien à allumer, aucune confirmation. Texte : 2 000 caractères au plus (la borne de l'envoi existant).
**Rétro-compatible** : tant qu'il n'a pas écrit de version « 1 article » ici, les textes d'avant servent
(`vrm_favoris_reglages_{uid}` : message + variantes = « Message 1, 2… » avec leurs n°, et le message lot de « comme Bleam »).
L'éditeur s'ouvre sur ces textes (ids `a1`, `a2`, `lot` : leurs statistiques suivent).

### La règle du choix — UNE fonction pure (`src/favorisPerso.js`, bloc `<favoris-perso-regle>`, recopié par
`node scripts/audit-favoris-perso.cjs --recopie`)
`choisirMessageFavori({ reglage, ancien, fav, offre, ctx, lotPermis, sur, refusee, derniere, hasard })` :
1. Cas dans l'ordre : lot (≥ 2 articles aimés, une fois par personne, séquence « comme Bleam » allumée — la règle d'avant),
   puis UNE règle conditionnelle (la plus précise = le plus de conditions ; à égalité la plus haute), puis « 1 article ».
   Une condition sur une valeur pas sue (prix, marque) est FAUSSE. Un cas dont aucune version ne peut partir laisse passer
   le suivant.
2. Variables : `{prénom}` = le PSEUDO lu dans le fil (Vinted ne donne aucun prénom sûr : jamais un prénom tiré du pseudo),
   `{article}` (« cet article » si le titre manque, règle d'avant), `{marque}` `{taille}` (SON dressing, par identité
   d'annonce, lus seulement si un texte ou une règle les demande), `{prix}` (règle d'avant : l'offre faite, sinon le prix),
   `{prix_offre}` `{remise}` (exigent l'offre). Une variable pas sue ⇒ la version est SAUTÉE (jamais un trou).
3. Jamais une version que la règle des mots interdits refuse (sur le texte posé) ni une version déjà refusée par Vinted.
4. Au hasard parmi les possibles, jamais la dernière version envoyée à CET acheteur, puis au compte (si une autre existe).
`fpUneEnvoyable` (au moins une version possible, jugée AVANT toute écriture chez Vinted), `fpBesoins`, `fpContexteParis`,
`statsVersionsFavoris`.

### Le point de raccord avec le moteur (pour la session `claude/extension-interface`)
Dans `executerMessageFavori` (background.js), la séquence d'envoi n'a pas changé ; seuls ces points :
- avant toute écriture : `persoF = await favPersoCompte(uid)` + `fpUneEnvoyable(...)` (remplace `versionsEnvoyables`) ;
- après la lecture du fil et du prix, AVANT `if (cbF.favoris)` : `const choixP = await choixMessageFavori({...})` — UNE
  fois ; il rend `version = { cle, n, lot, modele, texte }` (`texte` = variables nouvelles posées ; `{pseudo}` `{article}`
  `{prix}` `{a|b}` restent posés par `personnaliserMessageFavori`, inchangé) et `op` (l'offre de `offreAvecPlancher`) ;
- `versionB = choixP.version` (séquence Bleam) et `version = choixP.version` (chemin offre d'abord) — plus de second tirage ;
  l'offre annoncée se juge sur `version.modele` (`annonceOffreFavori` connaît aussi `{prix_offre}`) ;
- `op = choixP.op || ...` (la même offre que celle écrite dans le texte) ;
- après un envoi PARTI : `noterChoixFavori(uid, body, convId, version, offreFaite)` (clé de version par acheteur et par
  compte, `noterEnvoiFavori` avec `k` et `o`, lot noté) — y compris après `sequenceFavoriBleam` (qui ne notait pas l'envoi) ;
- deux raccords d'une ligne DANS `sequenceFavoriBleam` : la version refusée est notée sur `version.modele`, et
  `fini.offreFaite` dit si l'offre est partie (pour « avec offre »).
Si la séquence est réécrite « par l'interface », il suffit qu'elle reçoive `version` de `choixMessageFavori` et appelle
`noterChoixFavori` quand le message est parti.

### Le panneau (vrm-badge.js) — Favoris → « Réglages »
La feuille devient l'éditeur (`fpEditeurHtml`, `brancherFp`) : compte de l'onglet (« Sur @… ») ; « Message par défaut
(1 article) » et « Message lot » (versions, compteur n/2000, statistiques « ✈ 12 · 5 avec offre · 2 vendus en 14 j » ou
« ✈ 3 · non mesuré », « + Prénom / Article / Marque / Taille / Prix / Prix de l'offre / Remise » insérés au curseur,
« + Ajouter un message », ×) ; « Messages conditionnels » (heures de/à, prix de/à, jours, marques, versions ; ↑ ↓
réordonnent, nombre de conditions dit) ; « Offre automatique » (% et arrondi à l'euro inférieur ; toujours remontée au
plancher prix mini, sinon achat + 10 %) ; « Délai avant envoi et filtres » (les filtres de la 5.410.4 regroupés : attendre
N min après le favori, note, par article, période, réécrire — même section `vinted_bleam.favoris`, allumer = « Oui,
allumer ») ; rythme ; « Aperçu » sur un VRAI favori de la liste (choisi dans une liste) : « Ce favori recevrait · règle 2 ·
une version au hasard parmi 2 », la bulle, l'offre (« Offre 45 € : remontée à ton prix mini »), et le message lot.
Chaque version est jugée par le FOND pendant la frappe (`favorisPerso · verifier` : écriture, variables, mots qui font
refuser le compte) — signalée en ambre AVANT tout envoi. « Enregistrer » (`favorisPerso · enregistrer`) : refuse un texte
refusé, exige une version « 1 article » sans `{marque}` `{taille}` `{prix_offre}` `{remise}` (elle part quand
l'information manque), écrit `favMessages` (le chemin gardé `reglageAutoCarte`) et une copie des versions sûres
(`{prénom}` → `{pseudo}`) dans `vrm_favoris_reglages_{uid}` avec l'offre et le rythme (`reglagesFavorisCarte` : aperçu du
serveur, extension plus ancienne). Un redessin garde le curseur et l'endroit de la feuille. 82 clés de texte, 5 langues
(`vrm-ui.js`, `fp_*`).

### Statistiques
`vrmFavorisEnvois` porte désormais `k` (clé de version) et `o` (offre faite) ; « vendus » = l'annonce du message PROUVÉE
vendue (`lireVentesProuvees`, la règle partagée) dont la transaction est datée (`status_updated_at`) dans les 14 jours après
l'envoi ; une vente sans date n'est comptée nulle part (dite « + N vendus sans date ») ; moins de 10 envois ⇒ « non mesuré ».
⚠️ La date lue est celle du DERNIER état de la transaction (≥ la vente) : le nombre est un « au moins ».

## Preuves
- `scripts/audit-favoris-perso.cjs` : P1–P11 verts sur le vrai background.js (variables, conditions, priorité, aléa sans
  répétition sur 200 tirages, textes interdits, rétro-compat, offre remontée au plancher, statistiques, raccord du moteur,
  enregistrer) ; `--prouve` 10/10 mutations rouges ; sur `origin/main` : rouge (bloc absent).
- `scripts/bancs/favoris-perso.cjs` (nouveau ; le fond répond par le VRAI `favorisPersoCarte`) : 54 verts — 390 Orion,
  1512 clair et sombre ; sur `origin/main` : 0 vert. Captures regardées (voir le compte rendu).
- `panneau-favoris-tableau` 134 verts (T9 compte aussi les textes de l'éditeur). Audits verts : coherence, traduction,
  extension-feuille, messages-malins, reglages-auto, discretion, comme-bleam, bleam-suite, onglet-travail,
  favoris-offres-irreprochable, rythme-favoris, favoris-liste, favoris-clair, quoi-de-neuf.
- `audit-ecriture-humaine` : 1 rouge, LE MÊME sur `origin/main` (sans lien).

## Geste de Julien
Installer la 5.417.0 (à l'intégration), puis Favoris → Réglages : relire ses messages, en ajouter, enregistrer.
