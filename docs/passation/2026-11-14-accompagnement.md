# 14 nov. 2026 — L'accompagnement des gestes (branche `claude/accompagnement`)

Julien : « tout doit être plus accompagné dans l'app, chaque action doit être parfaite »,
« l'utilisateur ne doit pas se sentir seul ».

**Sa décision en cours de route (même jour)** : PAS de nouvel « Annuler 5 s », PAS de nouvelle
confirmation, PAS de « ? » ni de vidéo par action (« non, fais pas ça »). Ce qui existait
(pilule « Annuler » de `src/gesteAnnulable.js`, `askConfirm`, le « ? » de l'écran) n'a pas bougé.
Restent : AVANT (ce qui va se passer), PENDANT (progression + « Tout arrêter » quand c'est long),
APRÈS (résultat + suite), ÉCHEC (raison + geste), listes vides et premières fois.

## 1. La brique commune

| pièce | rôle |
|---|---|
| `src/accompagnement.js` §9 | Pur, sans React. `GESTES_ACC` (le catalogue : écran, sorte de la feuille « VRM travaille », lien de la suite) · `gesteDeSorte` · `raisonEchec`/`lireEchec` (une Error, `{ok:false,error}`, `{status:429}`, `{envoye:false}`, `{sansReponse}`, une phrase ⇒ UNE raison connue : horsligne, reseau, limite, session, refus, extension, onglet, serveur, pasSu, inconnu ; la phrase de l'écran gardée si elle est lisible, jamais un code) · `GESTES_RAISON` (le geste qui répare : lien ou « Réessayer ») · le magasin `accompagner(geste, { total })` ⇒ `.pendant(n)` `.fini(vars)` `.echec(err, { reessayer })` `.arretDemande()` · les premières fois (`vrm_premieres_fois`, sur l'appareil). |
| `src/ui/Accompagne.jsx` (+ `accompagne.css`) | `AccAvant` (ce qui va se passer + ce qui ne se passera PAS) · `AccPendant` (« 3 / 8 », barre, « Tout arrêter » à partir de 3) · `AccApres` (« ✓ résultat · Ensuite : … › ») · `AccEchec` (« Pas fait : raison. Geste › », point ambre, jamais rouge) · `AccHote` (gestes courts, posé DANS la zone des messages de la coque, s'en va seul : 7 s / 12 s) · `AccVide` · `AccPremiereFois`. Tout texte par `tr()` (`src/i18n/langues/<l>/accompagnement.js`, 5 langues ; le fichier est dans les MIGRES d'`audit-traduction`). |
| Réutilisé, pas dupliqué | La feuille « VRM travaille » (`SuiviTravail.jsx`) porte `data-acc-pendant` / `data-acc-apres` / `data-acc-echec` par la sorte du travail, et ajoute « Ensuite › » et la raison du premier refus (avec SON geste). La pilule « Annuler » porte le nom du geste (`gesteVrm(…, acc)` ⇒ `data-acc-apres`/`-echec`) — sans rien changer à l'annulation. `EmptyState` prend `vide=` ; `PhraseEcran` pose la phrase « première fois ». |

## 2. L'inventaire — 4 moments, AVANT (lu dans le code et vu à 390) → APRÈS

Note 1 = le moment existe ET dit l'essentiel (quoi, combien ; résultat + suite ; raison + geste).
`—` = sans objet (geste instantané). Le banc `scripts/bancs/accompagnement.cjs` JOUE ceux marqués « joué ».

| action | avant | pendant | après | échec | ce qui a changé | banc |
|---|---|---|---|---|---|---|
| Tout imprimer (Colis) | 1→1 | 1→1 | 1→1 | 0→1 | échec du lot : raison + « Réessayer » (était le texte brut) ; feuille de suivi : raison du refus + SON geste ; « ce qui ne part pas » sous le bouton | joué 4/4 |
| Tout générer (bordereaux) | 0→1 | 0→1 | 0→1 | 0→1 | avant (combien, rien payé) ; « k / n » + **Tout arrêter** ; bilan + « Ensuite : les imprimer » ; refus ⇒ raison + geste | joué 4/4 |
| Je dépose (mode dépôt) | 0→1 | 1→1 | 0→1 | 0→1 | « rien n'est envoyé à Vinted » ; n° inconnu ⇒ « vérifie le n° ou tape-le » ; tout déposé ⇒ « le suivi arrivera seul » | joué 4/4 |
| J'ai retiré | 0→0 | — | 1→1 | 1→1 | la pilule porte le geste (data-acc) ; pas de phrase avant ajoutée sur chaque ligne (§7 : une phrase par ligne = bruit) | — |
| Relier un achat | 0→1 | — | 0→1 | 1→1 | phrase dans la feuille (« rien n'est deviné ») ; « Achat relié · 45 € · Ensuite : voir le bénéfice › » | — |
| Coller des prix d'achat | 1→1 | — | 0→1 | 1→1 | « aucun autre prix écrasé » ; « le bénéfice se complète · Ensuite › » ; pas lu ⇒ raison + geste | — |
| Offre Vinted (accepter/refuser/contre) | 0→1 | 0→1 | 1→1 | 0→1 | phrase sous l'offre ; **le rouge retiré** du message d'échec (§7) ⇒ raison + geste | — |
| Offre Vestiaire | 1→1 | 1→1 | 1→1 | 0→1 | phrase sous « Offres reçues » ; « pas su » ⇒ « Vérifier avant de relancer » | — |
| Seuil d'offre eBay | 1→1 | 1→1 | 1→1 | 1→1 | « VRM n'accepte rien lui-même » ajouté ; data-acc | — |
| Messages aux favoris | 1→1 | 1→1 | 1→1 | 1→1 | phrase avant dans le récapitulatif ; la feuille de suivi dit la suite | — |
| Baisser le prix (Vinted / Leboncoin) | 1→1 | 1→1 | 1→1 | 0→1 | « rien d'autre ne change » ; bilan + « Ensuite › » ; rien de baissé ⇒ la raison du 1er refus + geste ; extension absente ⇒ raison + « Vérifier l'extension » | joué 4/4 (Vinted) |
| Baisser le prix (Vestiaire) | 1→1 | 1→1 | 1→1 | 0→1 | idem | — |
| Republier (atelier) | 1→1 | 1→1 | 1→1 | 1→1 | phrase avant « Je confirme » ; fin : « N republiées · Ensuite › » ou raison | — |
| Créer sur Vinted | 1→1 | 1→1 | 1→1 | 0→1 | « rien n'est mis en ligne » ; onglet/extension absent ⇒ raison + geste | — |
| Publier partout | 1→1 | 1→1 | 1→1 | 0→1 | bilan + « Ensuite › » ; rien publié ⇒ raison du 1er refus | — |
| Supprimer de Leboncoin | 1→1 | 0→1 | 1→1 | 0→1 | la confirmation existante dit « l'article reste dans ton stock » ; « Leboncoin a répondu 403 » ⇒ raison en mots + geste | — |
| Mode vacances | 1→1 | 1→1 | 1→1 | 1→1 | « annonces pas supprimées » ; extension absente ⇒ raison + geste | joué 2/2 (avant, échec) |
| J'ai déclaré ce mois (URSSAF) | 1→1 | — | 0→1 | 1→1 | « rien n'est envoyé à l'URSSAF » ; pilule « novembre 2026 noté déclaré · Ensuite › » | non joué (base sans mois à noter) |
| Facture Pro | 1→1 | 1→1 | 1→1 | 1→1 | « elle ne se modifie plus » ; « Envoi… » visible | — |
| Lien pour ton aide | 1→1 | — | 1→1 | 0→1 | échec ⇒ raison + « Réessayer » | — |
| Connexion par QR | 1→1 | 0→1 | 1→1 | 1→1 | « ton mot de passe n'est pas partagé » | — |
| Fusion de fiches | 1→1 | — | 1→1 | 1→1 | « aucun N° réattribué » | — |
| Exporter mes données | 1→1 | 1→1 | 0→1 | 0→1 | « Fichier téléchargé : nom » ; « Export pas créé : TypeError… » ⇒ raison + « Réessayer » ; export incomplet = échec dit (le zip part quand même) | joué 4/4 |
| Export comptable | 0→1 | 1→1 | 1→1 | 0→1 | « rien n'est envoyé : tu choisis à qui le donner » ; raison brute ⇒ mots + Réessayer | — |
| Supprimer mon compte | 1→1 | 1→1 | 1→1 | 1→1 | data-acc seulement (tout y était) | — |
| Remettre les prix (soldes) | 0→1 | 1→1 | 0→1 | 0→1 | arrivé par la fusion de `project-review-nsk5su` (5.376) : « un prix changé depuis n’est pas touché » ; « N prix remis » ; extension absente / refus ⇒ raison + geste | — |
| Lien comptable / catalogue | — | — | — | — | pas de geste de ce nom dans l'app | — |

Listes vides (base neuve, jouées) : Ventes, Achats, Annonces, Colis disent pourquoi ET le premier
geste (« Vérifier mon installation › », « Ajouter un achat › », « Ouvrir vinted.fr › », « Relier un compte »).
Premières fois (jouées) : Ventes, Colis, Stock — une phrase sous la phrase de l'écran, « Compris » la
range (absente au retour), « Ne plus afficher ces aides » les coupe toutes. Mémoire : l'appareil.
La porte des bancs (`_porte-banc.cjs`) la coupe partout sauf pour un banc qui la juge (`vrm_banc_aides`).

## 3. Preuves

- Banc `scripts/bancs/accompagnement.cjs` (390 tactile, base inventée `_base-volume`, vrais PDF par
  pdf-lib, faux pont d'extension qui TIENT les commandes ; échecs simulés : réseau coupé, 429, refus,
  extension absente) : **28 moments verts, 0 manquant, 3 non joués** (URSSAF : la base n'a pas de mois à
  noter ; « Tout imprimer » après : le PDF inventé déclenche « Placer le tampon », qui attend un vrai
  bordereau — vert au premier passage, dit « non joué » quand la feuille du tampon s'ouvre).
  Joués : Tout imprimer, Tout générer, Je dépose, Baisser le prix, Exporter mes données, Mode vacances,
  4 listes vides, 3 premières fois.
- **Rouge sur le build d'avant** (`BANC_DIST=` le build de `20b40950`) : 0 vert, 29 manquants.
- **Mutation** (`data-acc-echec` renommé dans une copie du build) : les échecs de « Tout générer » et du
  mode vacances deviennent rouges, le reste vert.
- `baisse-prix.cjs` : 26 verts, 0 rouge. `tout-generer.cjs` : 3 rouges **déjà présents sur le build
  d'avant** (même 3, lancés depuis l'arbre de `20b40950` : la raison « une seule fois », le bandeau du
  téléphone, un clic sur un bouton caché par la refonte de Colis) — pas de ce lot.
- Audits verts : traduction (45), tdz, coherence, variables, identite, quoi-de-neuf, conseils (135), geste-annulable.
- Captures regardées : feuille « Tout imprimer » (la phrase de « Tout générer » sous son bouton),
  échec du lot (raison + geste du refus), listes vides, premières fois.

## 4. Ce qui reste

- Jouer au banc les gestes « — » (offres Vinted/Vestiaire, favoris, Republier, Publier partout, Créer
  sur Vinted, LBC, facture, QR, fusion) : leur monde demande des conversations/commandes inventées
  à la forme réelle ; les marques `data-acc-*` sont posées.
- « Soldes » (poser un solde) : la feuille « Baisser le prix » porte déjà ses moments (même feuille).
