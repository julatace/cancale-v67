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

221 bancs lancés sur 221 (de `fiche-paire` à `widget-multi`, ordre `LC_ALL=C`).

- **verts** (131) : `filtre-compte`, `finition`, `finition-premium`, `fluidite`, `fournisseurs`, `garde-ecrans`, `gestes-annuler`, `glisser-onglet`, `gros-volumes`, `hors-ligne`, `hors-reseau`, `ia`, `imprimante`, `inscription-fiable`, `inventaire`, `iphone-reprise`, `journal-emails`, `journee-chiffres`, `journee-premium`, `journee-widgets`, `lbc-bordereau`, `lbc-comme-vinted`, `lbc-demarrage`, `lbc-identite-privee`, `lbc-rappel-mise-a-jour`, `lbc-repondre`, `lbc-revue-complete`, `leboncoin`, `litiges-recherche`, `lot-bordereaux`, `messages-emails-communaute`, `messages-lisibles`, `messages-priorite`, `messages-sites`, `mesures-terrain`, `mode-exemple`, `morceau-perime`, `navigation-tache`, `notif-messages`, `nouveau-vendeur`, `nuage`, `numero-vinted`, `numeros-doublons`, `numeros-lettres`, `numeros-panne`, `numeros-reconnexion`, `numeros-remise-a-zero`, `offres-mini-push`, `onglets-a`, `onglets-c`, `panne`, `parametres-guides`, `parcours-quotidien`, `pave-plateformes`, `petits-plus`, `photo-vente`, `photoroom-carte`, `photos`, `plantages`, `plateformes-logo`, `pont`, `popup`, `poste-sans-depart`, `postes`, `prix-numerotage`, `prixmarche`, `profil-avatar`, `proxy`, `rappel-soir`, `rappel-urssaf`, `recap-vente`, `reception-emails`, `recherche-numero`, `recherche-photo`, `recherche-universelle`, `recuperation-auth`, `recuperation-retour`, `recus`, `relier-achat-filtres`, `relier-achat-suggestions`, `republier-main`, `retour-historique`, `retours-stock`, `retrait-conv-push`, `revue-19oct`, `revue-20oct`, `revue-21oct`, `revue-ecrans`, `routes-ecriture`, `sauvegarde`, `serveur`, `session-reveil`, `seuils-prevision`, `ship-multi`, `signal-annonces`, `signaler-etat`, `stats-compta`, `stats-premium`, `statut-colis`, `stock-2d`, `stock-2d-revue`, `stock-planches`, `stock-plateformes`, `stock-retrouver`, `stream-photos`, `suivi-colis`, `superpdp`, `sw-cache`, `tournee`, `traduire-messages`, `transporteurs-logos`, `type-compte`, `vague2-comptes`, `vague2-ventes`, `vague3-ecrans`, `vc-publier`, `vendeur-neuf`, `vendu-aujourdhui-relu`, `vendu-recu`, `vente-email-fraiche`, `ventes-benefice-glisser`, `ventes-bordereau`, `ventes-compte`, `ventes-e2`, `ventes-par-compte`, `vestiaire`, `vestiaire-colis`, `vestiaire-messages`, `vues-ventes`, `widget-colis`, `widget-multi`
- **(c) rouges identiques sur main** (78) : `fiche-paire`, `file-envoi`, `formes-communes`, `garage3d`, `indicateur-pro`, `jetons-coherence`, `journee-coherence`, `journee-mieux`, `journee-photos`, `lbc-messages`, `lbc-pause`, `lbc-publier-app`, `lbc-relier`, `lbc-supprimer`, `lbcprep`, `messages-volets`, `mobile`, `offres-objectif`, `onglets-d`, `oublies`, `outils-stats`, `parametres-sauvegarde`, `perfv`, `photos-vinted`, `plateformes-premium`, `premierjour`, `prixachat`, `publier`, `rangement`, `recap-mois`, `recherche-en-place`, `recu-achat`, `registres`, `reglages`, `reglages-premium`, `relais-telephone`, `republier`, `retrait`, `retrait-autre-ville`, `retrait-carte`, `retrait-lieux`, `retrait-relais-carte`, `revendeurs`, `revue-30oct`, `securite`, `selection-bordereaux`, `serie`, `session`, `seuils-vinted`, `stats-detail`, `stats-vitrine`, `statut-fiscal`, `statuts-colis`, `stock-annonces`, `stock-assistant`, `stock-finitions`, `stock-gestes`, `stock-partis`, `stock-piece`, `studio-photo`, `suivi-urssaf`, `supprimees`, `tampon-bordereau`, `tous-boutons`, `tout-generer`, `tout-imprimer`, `transporteurs`, `urssaf`, `ventes-colis-premium`, `ventes-frappe`, `verif-publication`, `verif_dark`, `verif_visuel`, `vestiaire-bout-en-bout`, `vestiaire-fiches`, `vestiaire-parite`, `vinted-ui`, `vitesse`
- **DIFF à la première passe (tranchés ci-dessous)** : `fusion-app`, `lbc-flou-compte`, `lbc-preuve`, `menu-range`, `messagerie`, `notifs-destination`, `tampon-libre`
- **NEUF à la première passe (tranchés ci-dessous)** : `lien-vc-frise`, `mode-stream`, `numero-etiquette`, `pave-vinted`, `rapport`

### Classement des rouges (après relance seule de chaque rouge douteux)

**(b) vrai défaut de la finition, corrigé à la source — 1**
- `journee-mieux` — « un détail raccourci l'est à la fin d'un mot » : `UneLigne` coupait par
  `split(/\s+/)` puis `join(' ')`, et `\s` attrape l'insécable : « 14 € » perdait son U+00A0
  à la coupe (le début du texte n'était plus dans l'infobulle). Corrigé dans
  `src/UneLigne.jsx` (`ESPACES_SECABLES` : on ne coupe qu'aux espaces ordinaires, « 14 € »
  et « 30 % » restent soudés). Relancé : il reste les rouges de main (titres sur deux lignes,
  nombres redits).

**(a) banc adapté pour juger la règle — 5**
- `rapport` — 15 expressions `\b75(?:,00)? ?€` → `\s?€`. Vert.
- `mode-stream` et `stream-photos` — les classes d'espaces de l'expression qui compte les
  montants n'avaient que des espaces ordinaires (`[\d   .,]`, `[   ]`, insécables perdues
  à une copie) : un montant à l'insécable n'était plus compté. Classes en
  `[   ]` ; le contrôle « en stream, aucun montant lisible » redevient capable
  d'échouer (il passait à vide). Verts tous les deux.
- `messagerie` — la finition a récrit « accepte-les en 1 tap » en « accepte-les d'un
  geste » : le banc accepte les deux tournures (règle jugée : un geste, rien tout seul).
  Les deux rouges restants sont ceux de main.
- `pave-vinted` — course du banc, pas de la finition : Échap remet l'adresse de l'app par
  une navigation à elle, et le `goto` de Colis qui suivait était annulé (ERR_ABORTED).
  Le banc attend cette navigation (mesuré : la même navigation a lieu sur main). Vert.

**Verts une fois relancés seuls (rouge de charge) —** `fusion-app` (comptabilité sombre :
couleur prise en pleine transition de 0,12 s ; seul, 2 fois sur 2 vert, ses 5 autres rouges
sont ceux de main), `lien-vc-frise` (attente de 20 s dépassée), `numero-etiquette` (clic
dépassé), `tous-boutons` (le navigateur tombait après 25 min : relancé 390 puis 1512,
0 défaut sur 50 écrans chacun).

**(c) rouges identiques sur main — à ne pas corriger ici** : la liste « (c) » ci-dessus,
plus, après relance : `lbc-flou-compte`, `menu-range` (10 = 10), `notifs-destination`
(12 = 12, lignes qui varient), `session` (G et P : 4 = 4, main relancé avec
`VRM_DEPOT`), `mobile` (« navigation hors du contenu » à 320 px : le titre qui se replie
décale `main` de 1 px, mesuré à l'identique sur main), `lbc-preuve` (même cause racine :
l'écran Leboncoin ne propose rien, « null à publier »), `tampon-libre` (`pdfjs-dist`
absent du `node_modules` du conteneur, comme `audit-registres`), `revue-30oct` et
`securite` (pas de `fx/` réelles, `ENOENT` des deux côtés).
