# Audit des ACTIONS (Vinted, Leboncoin, cartons) — VRM, origin/main f04af748, 1er nov. 2026

Angle : ce qui ÉCRIT chez Vinted/Leboncoin ou change ce qui est écrit sur un carton.
Méthode : lecture du code, puis exécution du vrai `background.js` dans `scripts/_fond-vm.cjs` et des
vraies fonctions extraites de `src/App.jsx`, sur des scénarios inventés. Aucun fichier du dépôt modifié,
rien commité. Bancs jetables : `/tmp/claude-0/-home-user-cancale-v67/f70a9764-046d-5574-bac2-0a1794911434/scratchpad/audit-final/actions/`
(`favoris.cjs`, `conflits.cjs`, `impression.cjs` ; lancer avec `REPO=<arbre> node <banc>`).
Ce qui est déjà dans flux/utilisateurs/limites/plateformes/securite n'est pas recompté (A3, P2, P10, P11,
P12 en particulier).

## A. Défauts, du plus grave au moins grave

### X1 — GRAVE (porte du seul risque irréversible) · Deux paires différentes au même titre sous un même N° : AUCUNE alerte rouge, nulle part hors Annonces — vérifié (banc)
- **Scénario** : deux paires identiques « Nike Dunk Low Panda 42 » (22 % des ventes ont un titre en double)
  portent le N°40 : (a) une vente à poster + une annonce en ligne, ou (b) DEUX ventes à poster (la même
  paire vendue deux fois, ex. sur deux comptes, ou deux paires réellement sous le même N°).
  `conflitsDeNumeros` ne dit rien. Donc : pas de rouge dans Ma journée (46890), Colis/mode emballage
  (`etatNumeroColis`, 46034 — le N° n'est pas rouge sur la carte du colis), Stock (51396), et
  `doublonsAReattribuer` (41649) ne règle rien. Seul `numDoublons` (Annonces, 41780) voit le cas (b')
  « deux annonces en ligne » ; il ne voit pas les ventes.
- **Où** : `src/App.jsx:32940-32943` : `if (!(paires.length === 2 && titres.size === 1)) deux = true;` —
  deux porteurs au MÊME TITRE ne sont pas un conflit. Introduit le 17 août (ab3c7272) pour « une vente et
  son annonce encore ouverte » ; la règle juge par ressemblance (§2.4, §5 « jamais par titre »).
- **Preuve** : `actions/conflits.cjs` (bloc `<conflits-numeros-regle>` extrait tel quel) :
  `SILENCE vente à poster (A) + annonce (B) même titre` · `SILENCE deux annonces même titre` ·
  `SILENCE deux ventes à poster même titre` ; témoins (titres différents, 3 porteurs) : `ROUGE`.
- **Correction** : ne dispenser que la paire PROUVÉE identique (l'`item_id` de la vente = l'id de l'annonce,
  `identiteAnnonce`), jamais deux porteurs au même titre ; deux ventes à poster sous un N° = toujours rouge.
- **Vérifié** (règle). À vérifier : combien de cas réels en base (lecture seule).

### X2 — GRAVE · Une offre refusée par Vinted n'empêche pas le message « je t'ai fait une offre » — vérifié (vm)
- **Scénario** : file « messages aux favoris » avec réduction 10 %, message « Bonjour {username}, je t'ai fait
  une offre ! ». Vinted répond 422 à `POST /transactions/{tx}/offers` (ou le prix de la transaction n'est
  pas lisible : `favori_offre_prix_inconnu`). Le message part quand même, le résultat est `envoye` sans
  raison : l'acheteuse lit une offre qui n'existe pas, l'app compte un succès.
- **Où** : `vinted-sync-extension/background.js:10830-10840` (`executerMessageFavori` : `noterDiag` seul sur
  `!o.ok`, puis l'envoi du message continue).
- **Preuve** : `actions/favoris.cjs` cas B → `message envoyé quand même ? true  Bonjour acheteuse, je t'ai
  fait une offre !  résultat {"resultat":"envoye","raison":""}`.
- **Correction** : offre demandée mais pas faite (refus, prix inconnu) ⇒ ne pas envoyer le message, rendre
  `refuse` avec la raison `offre_refusee` / `prix_inconnu`.

### X3 — GRAVE · Le plafond 50/h et la réserve de 5 ne tiennent pas pour les favoris — vérifié (vm)
- **Scénario 1** : un message de favori = 3 écritures chez Vinted (conversation, offre, réponse), compté
  UNE action. Une file de 50 favoris = 150 écritures dans l'heure, sous « 50 actions/heure ».
- **Scénario 2** : 49 actions déjà prises, un favori passe et prend la 50ᵉ : une réponse à un acheteur
  (geste sur clic) est ensuite refusée « plafond ». La file des favoris (automatique, à son rythme) ne laisse
  pas la réserve `RESERVE_GESTES` que §3 promet aux gestes automatiques (« s'arrêtent à 45 »).
- **Scénario 3** : plafond plein (50/50) : la conversation est QUAND MÊME créée chez Vinted (écriture), puis
  le favori est refusé — une écriture part au-delà du plafond.
- **Où** : `background.js:10760` (création avant toute garde comptée) ; `10820`
  `const arret=await gardeStricte(uid,acc)` (sans `reserve`, `actions` = 1).
- **Preuve** : `actions/favoris.cjs` : A → `écritures Vinted: 3 … actions comptées: 1` ; C → `compteur 50` puis
  `réponse à un acheteur ensuite → plafond` ; D → `résultat refuse … écritures parties ['/api/v2/conversations']`.
- **Correction** : `gardeStricte(uid,acc,{reserve:RESERVE_GESTES, actions: offre?3:2})` AVANT la création de la
  conversation (et rendre les places non utilisées, comme `rendreActions` de Republier).
- (Voisin de P11 — refus auto — mais chemin différent.)

### X4 — GRAVE (fonction morte, à vérifier sur la vraie base) · « Supprimer de Leboncoin » et « Mettre en pause » lisent l'annonce par un chemin JSON que PostgREST prend pour un INDEX
- **Scénario** : clic « Supprimer de Leboncoin » sur une annonce (id Leboncoin à 10 chiffres, ex. 3290000104,
  la forme des audits). L'extension relit l'annonce par `select=a:data->items->3290000104`. PostgREST lit un
  segment numérique comme un index de tableau (`::int`) : au-delà de 2 147 483 647 la requête répond 400
  (⇒ « la base VRM n'a pas répondu — rien n'est parti ») ; en dessous, `objet -> int` rend NULL
  (⇒ « cette annonce n'est pas parmi tes annonces captées »). Rien ne part jamais ; la pause idem.
- **Où** : `background.js:15834` (suppression) et `15737` (pause). Le même fichier documente le piège et le
  contourne ailleurs : `lireFicheAnnonce`, `background.js:9988-9996` (« mesuré dans les journaux : 400 »,
  clé mise entre guillemets).
- **Preuve** : lecture + le commentaire mesuré de 9988 ; les audits `audit-lbc-supprimer` /
  `audit-lbc-plus-vue-pause` sont verts parce que la fausse base (`_fond-vm.cjs`, `projette`) traite tout
  segment comme une clé (§6.3 : la forme servie n'est pas la vraie). Pas pu rejouer contre PostgREST ici.
- **Correction** : `select=a:data->items->"${id}"` (clé entre guillemets), et faire refuser par la fausse
  base un segment numérique non guillemeté.
- **À vérifier** : une requête réelle (journaux Supabase du projet VRM, chercher `lbc_listings&select=a:data->items->`).

### X5 — GÊNANT (fausse alarme sur la seule alarme qui compte) · Chaque paire republiée déclenche « Le N°… est porté par deux paires » à l'impression — vérifié (fonction réelle)
- **Scénario** : N°12 republiée par VRM (ancienne annonce supprimée, nouvelle reprend le N° par
  `recreeDe`). Elle se vend ; « Imprimer le bordereau » demande « Le N°12 est porté par deux paires · Nike
  Air Max 90 · Nike Air Max 90 — Vérifie la photo… ». Avec 50 republications par jour, l'alerte sort sur
  presque chaque colis : elle sera cliquée sans lire le jour où elle est vraie.
- **Où** : `src/App.jsx:9976-9987` (`confirmerNumerosAVerifier` compte toutes les fiches de
  `vinted_annonce_numeros`, y compris celle de l'annonce supprimée ; aucune fiche n'est retirée après une
  reprise — `repriseNumero.js:47` copie la fiche, rien ne supprime l'ancienne). `doublonsAReattribuer`
  (32976) sait, lui, qu'une annonce et sa recréation sont la même paire.
- **Preuve** : `actions/impression.cjs` → `imprimée sans question ? false | question posée : [ 'Le N°12 est
  porté par deux paires' ]`.
- **Correction** : ne compter que les porteurs PRÉSENTS (`porteursNum`/`conflitsNum`, une seule règle §11),
  ou au moins écarter la chaîne `recreeDe`.

### X6 — GÊNANT · Plafonds et verrous de Republier par NAVIGATEUR, pas par compte — vérifié par lecture
- **Scénario** : Julien a plusieurs Chrome (§9 : « ⟳ dans CHAQUE Chrome »). Le compteur 50 actions/h
  (`vrmActions`), le quota `REPUB_PAR_JOUR` (`vrmRepubJour`), les verrous « recréation incertaine »
  (`vrmRecreerEnCours`, 30 min) vivent dans `chrome.storage.local` de CE Chrome. Deux Chrome sur le même
  compte Vinted = 100 actions/h, 100 republications/jour, et une republication « incertaine » dans le Chrome A
  peut être relancée depuis le Chrome B (second brouillon, puis seconde suppression — la 2ᵉ tombe sur 404).
- **Où** : `background.js:10485-10499` (compteur), `9453-9464` (quota du jour), `9471-9481` (verrous).
- **Ce qui tient** : le relais du téléphone est pris par écriture conditionnelle en base (un seul Chrome
  l'exécute, `11745`, `11849`) ; les favoris ont une autorisation serveur à usage unique.
- **Correction** : tenir compteur/quota/verrou de recréation dans une ligne de base par compte Vinted
  (écriture conditionnelle comme le relais), le local ne servant que de cache.

### X7 — GÊNANT · Stock : ranger une paire dans une case occupée sort l'occupante du plan sans le dire — vérifié par lecture (banc d'écran à faire)
- **Scénario** : case A1 = N°12. « Ranger » N°40 (pas encore rangée) puis toucher A1 par erreur. N°40 prend
  A1, N°12 repart dans « À ranger » (rien n'est demandé, le toast ne parle que de N°40). Le carton N°12 est
  toujours dans A1 : « Où est N°12 ? » ne le trouve plus, et le plan dit A1 = N°40.
- **Où** : `src/App.jsx:31237-31242` (`poser` : `if (ancien) u[occ] = ancien; else delete u[occ]`),
  appelé sans confirmation par `cliquerCase` (31260).
- **Correction** : case occupée ⇒ demander « A1 contient N°12 : échanger / annuler », et dire où va N°12.

### X8 — DÉTAIL · Les gestes « rendus » par Republier retirent les horodatages les plus récents, pas les siens
- `rendreActions` (`background.js:10463-10473`) supprime les n dernières entrées ≥ `depuis`, qui peuvent être
  celles d'autres gestes faits pendant la paire : le total est juste, mais une place se libère plus tard (ou
  plus tôt) que la vraie. Correction : rendre les horodatages exacts réservés (`tRes`).

### X9 — DÉTAIL · Suppression « incertaine » de Republier : pas de verrou, une relance refait un brouillon
- `recreerVinted`, `background.js:10220-10224` : suppression sans réponse claire ⇒ `etat:'a-publier'`, aucun
  `poserVerrouRecreer(id)`. Si l'ancienne est en fait encore en ligne, une relance crée un 2ᵉ brouillon (et
  retente la suppression). Pas de perte, un brouillon en trop. Correction : poser le verrou de 30 min ici aussi.

## B. Republier — ce qui tient (scénarios joués à la lecture du code exécuté, pour ne pas y revenir)
Ordre réel (5.254/5.277) : lecture de l'annonce → photos → **coffre écrit et vérifié** (sinon rien) →
brouillon → suppression → attente → mise en ligne (`background.js:10042-10303`, `finRepubBrouillon`
10367-10430). Aucune voie trouvée qui supprime l'annonce SANS brouillon rangé :
- 429/403 (pause), onglet fermé, pas de page : brouillon pas parti ⇒ rien supprimé ; suppression pas partie
  ⇒ l'ancienne reste, le brouillon en trop est dit ; mise en ligne pas partie ⇒ « Brouillons → en ligne ».
- 500/0 au brouillon : verrou 30 min (pas de 2ᵉ brouillon) ; 500 à la suppression : arrêt, jamais deux en ligne.
- Photo refusée, description < 5, couleur/taille absente ou changée : vérifiées AVANT de toucher l'annonce.
- Service worker tué pendant la mise en ligne planifiée : job orphelin dit « incertain », jamais rejoué ;
  tué entre suppression et planification : coffre + `vinted_brouillon_{id}` permettent « Refaire » /
  « Brouillons → en ligne », qui relit l'ancienne chez Vinted avant de publier (`publierBrouillon` 9660-9670).
- Deux republications de la même annonce : la 2ᵉ relit l'annonce dans la file (404 ⇒ s'arrête).
- Plafond : les 3 gestes réservés d'un coup avant le premier, rendus si la paire s'arrête.
- N° gardé : `tableRecrees` (brouillon `ancienId` + coffre `recreeDe`) ⇒ `repriseNumerosRecreation`, par
  identité, attend que la table soit lue (`recreesNum === undefined ⇒ return`, App.jsx:43677).

## C. Autres actions vérifiées sans défaut nouveau
- Bordereaux (`executerCommande`, 11443-11607) : `BORD_EN_COURS` + admission sérialisée (pas de double),
  compte du cookie revérifié à son tour de file, PDF déjà rangé ⇒ rien chez Vinted, rendez-vous de PDF
  par transaction. Vente annulée entre-temps : aucune vérification côté VRM, Vinted refuse (échec dit).
- Offres/messages depuis l'app (`executerPourApp`) : liste blanche, `confirme` exigé pour accepter,
  compte revérifié dans la file.
- Favoris : `{username}` remplacé par le pseudo lu dans LE fil vérifié ; variables inconnues refusées côté
  serveur (`preparerMessageFavori` dans `lancerFile`) ; prix d'offre au centime (`prixOffreFavori`), jamais
  ≥ prix ni < 1 € ; destinataire, article et historique vérifiés avant d'écrire.
- Relais téléphone : prise conditionnelle (un seul Chrome), jamais rejouée, expiration 10 min.
- Leboncoin supprimer : confirmation exigée côté extension, compte de l'onglet = compte de l'annonce,
  10/h, une action à la fois (mais voir X4).
- Numéros : `prochainLibre` du plus haut, pool append-only, correction manuelle d'un N° porté par une autre
  paire renumérotée ⇒ N° neuf pour l'autre (jamais un ancien).

## D. Non joué (à faire)
- X4 contre la vraie API (une seule requête de lecture).
- X7 au banc de rendu (Stock, 390 px).
- Vestiaire/eBay publication : non rejoués ici (plateformes.md couvre eBay P12/P13).
