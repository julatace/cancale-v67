# 7 nov. — Intégration de la finition : les bancs de `fiche-paire` à la fin

Branche `claude/attente-v36-finition-integ`, fusionnée avec `origin/main` 6c59c5e8
(vitesse : formateurs de dates en cache, `colisEnvoi`, `CarteMois`, `rangeesDefilantes` ;
fusion sans conflit). Suite du rapport « État au 7 nov., 2 h » de
`2026-11-07-passation-generale.md` §1.1 (155 bancs déjà faits jusqu'à `feuilles-coque`).

Méthode : un banc à la fois, `BANC_PORT=5520`, `timeout 1500`, porte de banc posée
du chemin absolu. Chaque rouge est relancé sur un arbre `git archive origin/main`
construit à part. Classement :
(a) orthographe seulement (U+00A0, « e-mail ») → banc adapté pour juger la règle ;
(b) vrai défaut de la finition → corrigé à la source ;
(c) même rouge sur `main` → listé, pas corrigé.

Aucune fixture réelle `fx/` dans ce conteneur : les bancs qui en ont besoin sont
rouges (ou sautés) des deux côtés, donc (c).

`audit-vc-recon` est vert : son exception est retirée de `scripts/audits-exceptions.json`.

## Avancement

198 bancs lancés sur 221 (de `fiche-paire` à `widget-multi`, ordre `LC_ALL=C`).

- **verts** (118) : `filtre-compte`, `finition`, `finition-premium`, `fluidite`, `fournisseurs`, `garde-ecrans`, `gestes-annuler`, `glisser-onglet`, `gros-volumes`, `hors-ligne`, `hors-reseau`, `ia`, `imprimante`, `inscription-fiable`, `inventaire`, `iphone-reprise`, `journal-emails`, `journee-chiffres`, `journee-premium`, `journee-widgets`, `lbc-bordereau`, `lbc-comme-vinted`, `lbc-demarrage`, `lbc-identite-privee`, `lbc-rappel-mise-a-jour`, `lbc-repondre`, `lbc-revue-complete`, `leboncoin`, `litiges-recherche`, `lot-bordereaux`, `messages-emails-communaute`, `messages-lisibles`, `messages-priorite`, `messages-sites`, `mesures-terrain`, `mode-exemple`, `morceau-perime`, `navigation-tache`, `notif-messages`, `nouveau-vendeur`, `nuage`, `numero-vinted`, `numeros-doublons`, `numeros-lettres`, `numeros-panne`, `numeros-reconnexion`, `numeros-remise-a-zero`, `offres-mini-push`, `onglets-a`, `onglets-c`, `panne`, `parametres-guides`, `parcours-quotidien`, `pave-plateformes`, `petits-plus`, `photo-vente`, `photoroom-carte`, `photos`, `plantages`, `plateformes-logo`, `pont`, `popup`, `poste-sans-depart`, `postes`, `prix-numerotage`, `prixmarche`, `profil-avatar`, `proxy`, `rappel-soir`, `rappel-urssaf`, `recap-vente`, `reception-emails`, `recherche-numero`, `recherche-photo`, `recherche-universelle`, `recuperation-auth`, `recuperation-retour`, `recus`, `relier-achat-filtres`, `relier-achat-suggestions`, `republier-main`, `retour-historique`, `retours-stock`, `retrait-conv-push`, `revue-19oct`, `revue-20oct`, `revue-21oct`, `revue-ecrans`, `routes-ecriture`, `sauvegarde`, `serveur`, `session-reveil`, `seuils-prevision`, `ship-multi`, `signal-annonces`, `signaler-etat`, `stats-compta`, `stats-premium`, `statut-colis`, `stock-2d`, `stock-2d-revue`, `stock-planches`, `stock-plateformes`, `stock-retrouver`, `stream-photos`, `suivi-colis`, `superpdp`, `sw-cache`, `tournee`, `traduire-messages`, `transporteurs-logos`, `type-compte`, `vague2-comptes`, `vague2-ventes`, `vague3-ecrans`, `vc-publier`, `vendeur-neuf`, `vendu-aujourdhui-relu`
- **(c) rouges identiques sur main** (68) : `fiche-paire`, `file-envoi`, `formes-communes`, `garage3d`, `indicateur-pro`, `jetons-coherence`, `journee-coherence`, `journee-mieux`, `journee-photos`, `lbc-messages`, `lbc-pause`, `lbc-publier-app`, `lbc-relier`, `lbc-supprimer`, `lbcprep`, `messages-volets`, `mobile`, `offres-objectif`, `onglets-d`, `oublies`, `outils-stats`, `parametres-sauvegarde`, `perfv`, `photos-vinted`, `plateformes-premium`, `premierjour`, `prixachat`, `publier`, `rangement`, `recap-mois`, `recherche-en-place`, `recu-achat`, `registres`, `reglages`, `reglages-premium`, `relais-telephone`, `republier`, `retrait`, `retrait-autre-ville`, `retrait-carte`, `retrait-lieux`, `retrait-relais-carte`, `revendeurs`, `revue-30oct`, `securite`, `selection-bordereaux`, `serie`, `session`, `seuils-vinted`, `stats-detail`, `stats-vitrine`, `statut-fiscal`, `statuts-colis`, `stock-annonces`, `stock-assistant`, `stock-finitions`, `stock-gestes`, `stock-partis`, `stock-piece`, `studio-photo`, `suivi-urssaf`, `supprimees`, `tampon-bordereau`, `tous-boutons`, `tout-generer`, `tout-imprimer`, `transporteurs`, `urssaf`
- **DIFF — à trancher / relancer seuls** : `fusion-app`, `lbc-flou-compte`, `lbc-preuve`, `menu-range`, `messagerie`, `notifs-destination`, `tampon-libre`
- **NEUF — à trancher / relancer seuls** : `lien-vc-frise`, `mode-stream`, `numero-etiquette`, `pave-vinted`, `rapport`

### Classement à la main

- **(b) `journee-mieux`** — « un détail raccourci l'est à la fin d'un mot » : `UneLigne`
  coupait par `split(/\s+/)` puis `join(' ')`, et `\s` attrape l'insécable : « 14 € » perdait
  son U+00A0 à la coupe (le banc ne retrouvait plus le début dans l'infobulle). Corrigé à la
  source (`src/UneLigne.jsx`, `ESPACES_SECABLES`) ; relancé : les 12 rouges restants sont ceux
  de main (titres sur deux lignes, nombres redits).
- **(c) `lbc-preuve`** — main s'arrête plus tôt (historique git illisible dans l'archive) ;
  même cause racine des deux côtés : l'écran Leboncoin ne propose rien (« null à publier »),
  les contrôles qui suivent en découlent.
- **(a) `messagerie`** — la finition a récrit « accepte-les en 1 tap » en « accepte-les d'un
  geste » : le banc accepte les deux tournures (la règle jugée : un geste, rien tout seul).
  L'autre rouge (« l'offre de l'acheteur (45 €) est lue dans le fil ») est identique sur main.
- **(a) `mode-stream`** (et `stream-photos`, même expression) — l'expression qui compte les
  montants lisibles n'avait que des espaces ORDINAIRES dans ses classes (`[\d   .,]`,
  `[   ]` : les insécables d'origine s'étaient perdues) : un « 89 € » à l'insécable n'était
  plus compté. Rouge « éteint d'un tap, les montants reviennent » (0 compté). Les classes
  disent maintenant `[   ]` : le contrôle « en stream, aucun montant lisible »
  redevient capable d'échouer (il passait à vide sur un texte à l'insécable).
- **(c) `notifs-destination`** — 12 rouges des deux côtés (« ni écran blanc ni
  garde-fou »), pas tout à fait les mêmes lignes : écran pas monté à temps, même défaut.
- **(a) `rapport`** — 15 expressions `\b75(?:,00)? ?€` (espace ordinaire facultative) :
  `\s?€` (l'insécable compte).
- **(c) `tampon-libre`** — `pdfjs-dist` absent du `node_modules` de ce conteneur (même
  cause que le rouge d'`audit-registres`) : ne se construit ni ici ni sur main.
- **(c) sans `fx/`** — `revue-30oct`, `securite` (et les autres bancs à fixtures réelles) :
  `ENOENT … scripts/bancs/fx/…` des deux côtés.
- **à relancer seuls** (rouge de transition sous charge, opacité/fond pris en plein
  mouvement) : `fusion-app` (fond rgba(…, 0,353) d'un bouton secondaire en sombre),
  `lbc-flou-compte` (opacité 0,31 sur « rien n'est flouté »).
