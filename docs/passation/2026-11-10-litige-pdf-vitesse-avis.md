# 10 nov. — Dossier de litige en PDF (BJ), vitesse d'envoi (BM), avis Vinted (BN) — branche `claude/vitesse-avis`

Validés par Julien (peu de texte, du visuel). Pas de PR, pas de fusion (session agent). Extension :
rien touché. Aucune migration, aucune fonction `api/` ajoutée, aucun service payant, aucune clé (§2.9).

## 1. Mesuré d'abord (lecture seule, sa base, 10 nov.)

`harvest_{uid}_feedbacks` (extension 5.319, `capterAvis`) : **3 comptes**, lignes < 1 Ko.
- `data` = `{ uid, type: 'feedbacks', domain, nItems: 20, capturedAt, payload }` ;
  `payload` = `{ user_feedbacks: [...], pagination: { total_entries, total_pages } }`.
- Chaque avis = **`{ id (10 chiffres), rating (entier), feedback (texte, jamais vide) }` — AUCUNE date**
  (`created_at` n'est pas dans la réponse de Vinted : `avisPropre` l'aurait gardée). Aucun pseudo
  (l'extension ne le range pas).
- Ordre de la page : les `id` **décroissent** sur les 3 comptes ⇒ du plus récent au plus ancien.
- Une ligne `harvest_{uid}_wreq_api_v2_user_feedbacks` est un ENVOI (il a laissé un avis), pas une lecture.
- ⚠️ Avant ce chantier, `lireAvis` (src/notesRecues.js) **écartait tout avis sans date** : 60 avis captés,
  zéro montré (« Avis détaillés : pas encore lus » restait affiché alors que tout était là).

## 2. Ce qui change pour lui

### BJ — « Dossier PDF » sur chaque carte de Litiges en cours
- Un bouton neutre « Dossier PDF » (48 px) sous le lien vers Vinted ; il **télécharge** un PDF fabriqué
  dans le navigateur (`pdf-lib`, déjà dans le dépôt, MIT). Rien n'est envoyé nulle part.
- Le PDF (une page A4) : « Dossier de litige », **N°** en grand (ou « Sans N° »), article, compte vendeur,
  date de vente, n° de transaction, situation, date limite (lue, sinon « non lue ») ; **photo de l'annonce**
  et **photo du carton fermé** côte à côte (`photoCartonDe`, par la transaction ; absente / pas lue /
  pas récupérée : DIT dans le cadre) ; **bordereau** : n° de suivi et date ; **suivi** : les étapes
  PROUVÉES de la frise (`friseProuveeDe` → `friseProuvee`), avec leur date (« date non lue » sinon), puis
  la bifurcation (Retour…). Pied : « Seules les étapes prouvées sont listées. »
- **Rien de l'acheteur** : le contenu est construit par liste blanche (`contenuDossierLitige`), l'app ne
  passe que `{ date }` de la vente.
- La page du bordereau elle-même porte l'**adresse de l'acheteur** : case « Joindre le bordereau (il porte
  l'adresse) », **décochée par défaut** ; cochée ⇒ ses pages (4 au plus) jointes à la suite.
- « PDF téléchargé ✓ » / « PDF pas créé : réessaie. » (ambre) sur la carte.
- Fichier : `dossier-litige-{N°}-{AAAA-MM-JJ}.pdf`.

### BM — « Vitesse d'envoi »
- Argent → Statistiques : une carte isolée sous « D'où viennent mes achats » : par compte, la **médiane**
  vente → dépôt (« 1 j 8 h »), une barre neutre, « sur N colis · M sans date de dépôt prouvée » ; plusieurs
  comptes ⇒ la médiane de tous en tête. Moyenne au survol (`title`).
- Ma semaine : un widget large « Vitesse d'envoi » (même lecture, 30 jours).
- Règle (`src/vitesseEnvoi.js`) : le départ = la règle unique `partisVinted` (api/_lib/depart-vente.js :
  Colis fait / scan, panneau, e-mail du n° EXACT, prise en charge) avec SA date ; « expédié à la main »
  (sans date) ou une date avant la vente (au-delà de la tolérance de la règle du départ) ⇒ « sans date »,
  jamais 0 ; une vente partie d'après Vinted sans preuve datée ⇒ « sans date » ; à envoyer, annulée,
  conversation ⇒ pas un colis ; fenêtre = ventes des 30 derniers jours.
- Publication : `vrm_vitesse_envoi` (localStorage de l'appareil, estampillé du compte VRM, même forme que
  `vrm_sources_ventes`), publiée par l'écran qui calcule `partisVinted` (Ventes / Colis / Litiges), rien
  tant qu'un compte de ventes a raté ou que les e-mails sont en lecture ; e-mails pas lus ⇒ « partiel », dit.
  Jamais publiée ⇒ « — · ouvre Colis ou Ventes pour la calculer ».

### BN — Avis Vinted (carte « Notes reçues » de Statistiques)
- `lireAvis` accepte la forme mesurée : `ts` seulement si une date est lue, sinon `null` (jamais inventée),
  `rang` = l'ordre de la page ; tri par date si les deux en ont une, sinon par la page.
- Sous les notes Vinted du profil (inchangées) : « Derniers avis » **4,3/5** « moyenne des 20 derniers
  lus · 120 en tout », l'évolution « ↑ 10 derniers 5 · avant 3,5 » (neutre ; seulement avec ≥ 5 avis de
  chaque côté), puis les 5 derniers : étoiles, date si lue, texte court (≤ 90 car.), jamais un pseudo ;
  « Vinted ne donne pas la date des avis : du plus récent au plus ancien. »
- Rien capté ⇒ « Avis pas encore lus : ouvre ton profil Vinted. » ; un compte sans ligne ⇒ nommé.
- Lecture : `id=like.harvest_*_feedbacks&data->>type=eq.feedbacks&select=id,avis:…,pag:…` (projection,
  jamais `select=data`). Aucun rappel d'évaluation (refusé le 11 oct.).

## 3. Preuves
- `node scripts/audit-dossier-vitesse-avis.cjs` : **38 verts** (PDF fabriqué par le vrai pdf-lib et relu
  par pdfjs-dist ; vitesse avec la vraie tolérance ; avis à la forme mesurée) ; `--prouve` **18/18**
  mutations rouges (étape pas lue listée, acheteur dans le contenu, bordereau toujours joint, photo ratée
  tue, case cochée par défaut, vente entière passée, sans-date compté 0, départ avant la vente, fenêtre
  30 j, moyenne au lieu de médiane, à envoyer compté, recalcul dans Stats, avis sans date écartés, ordre
  inversé, évolution sur 1 avis, date inventée, `select=data`, « pas encore lus » tu). Sur `origin/main`
  (git archive) : rouge (modules absents).
- Banc neuf `scripts/bancs/dossier-vitesse-avis.cjs` (390 tactile et 1512, clair ET sombre ; données
  inventées à la forme mesurée ; PDF téléchargé relu par pdfjs) : **vert** après le merge de `main`.
  Sur `origin/main` (git archive, build, banc copié dedans) : rouge (bouton absent, carte vitesse absente,
  0 avis lus). Sur un build MUTÉ (avis sans date écartés + case cochée + sans-date = 0 + vente entière +
  acheteur) : **44 rouges** (« 0 avis lus », « 10 h sur 4 colis », 3 pages, acheteur dans le PDF…).
- Bancs touchés relancés un à un (BANC_PORT aléatoire) : `litiges-ecran` vert, `argent` 268/0,
  `ma-semaine`, `annulations-notes` (voir rapport).
- Audits : variables, tdz, coherence, identite, icones, politique-hotes, litiges-ecran (22/22),
  frise-source (40), notes-recues (10), avis-vinted : verts. `npm run build` vert.
- Captures regardées (390/1512, clair/sombre) : carte Litiges avec « Dossier PDF » et la case, PDF converti
  en image (N°21, photos, bordereau, suivi), carte Vitesse d'envoi, Notes reçues + avis, widget de Ma semaine.

## 4. Ce qui reste
- **La date des avis** : Vinted ne la donne pas dans `user_feedbacks` (mesuré). L'extension la garderait si
  elle venait (`created_at`). Une vraie évolution dans le temps demanderait, côté extension, de garder les
  pages précédentes ou un historique daté par capture — **pas fait** (extension non touchée, à décider).
- Vitesse : seulement Vinted (Leboncoin / Vestiaire / eBay n'ont pas de date de dépôt prouvée lue dans VRM).
- Le dossier n'est fabriqué que pour une carte Vinted avec commande ; une carte e-mail sans commande ou eBay
  donne un dossier sans date de vente ni frise (« Suivi pas lu »).
