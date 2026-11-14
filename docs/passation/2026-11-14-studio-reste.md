# Studio bleu clair — les écrans « reste » — 14 nov. 2026

Branche `claude/studio-reste` (partie de `origin/claude/integration-refonte`). Décision de Julien (14 nov.) :
la direction t25 « Studio bleu clair » (Spatial × Bento × Aplats × Lumière, bleu clair partout, quatre formes
de bouton, aucun bouton moche ou inutile ; « tu peux changer les dispositions »). Référence :
`directions/t25-mix/note.md` + planche `apercu.png` ; noms fixés par `CONTRAT-STUDIO.md`.
D'autres chantiers font EN MÊME TEMPS la fondation (coque, `src/design/studio.css`), Ma journée,
Paires/Annonces/Stock, Ventes/Colis/Achats : ceux-ci ne sont pas touchés ici.

**Forme seulement** : aucun chiffre calculé autrement, aucun `data-*` changé, aucune règle §5 touchée
(« vendu ≠ reçu », CA daté au versement, jamais « encaissé », « — » quand pas su), rien de supprimé
sauf UN doublon nommé plus bas.

## Écrans faits

| écran | ce qui change |
|---|---|
| **Argent · Résumé** | grand titre Urbanist 34 ; segments creusés, le choisi posé + diode ; les quatre réponses en **Bento léger** : « Vendu » en grande tuile (2 colonnes, chiffre d'affiche Urbanist 200/68, `€` à 0,44 em remonté), « Reçu » · « Bénéfice » côte à côte, « À déclarer » en large avec sa date ; à l'ordinateur les quatre sur une ligne (Vendu plus large) ; « Pas encore calculé · Ouvrir Ventes » devient UNE ligne (point ambre + lien) au lieu d'une carte à bouton ; les replis (Ton bénéfice, Vendu et reçu, Bilan, Rapport, Délai, Porte-monnaie, Dépenses, Packs) = rangées de 56 px sur un plan de porcelaine, chevron qui tourne |
| **Argent · Déclarer** | la carte du mois en porcelaine, l'URSSAF du mois (`.vrm-compta-hero`) en grand chiffre fin ; « Quel est ton statut ? » : rangées au téléphone, quatre tuiles posées à l'ordinateur |
| **Argent · Factures** | « + Nouvelle facture » = LE plein (barre d'encre) ; les autres actions en touches (ordinateur) ou dans « ⋯ » (rond, téléphone) ; « En attente / Comptabilisées » : un segmenté au lieu d'un soulignement bleu ; les boutons de la facturation électronique (Récapitulatif tableur/fichier, Réessayer, Connecter Super PDP…) en touches |
| **Argent · Statistiques** | même matière ; records et cartes chiffrées en tuiles |
| **Messages** | le choix du site en segmenté creusé ; la recherche creusée ; la liste = un plan de verre (une seule couche), rangées de 72 px sans ombre, vignette posée 48, séparateur indenté ; la conversation sur le bleu clair, bulles reçues en porcelaine, les miennes à l'encre ; réponses rapides, négociation et **offres en touches** (Refuser · Proposer · Contre-offre · Accepter) ; « Répondre sur Vinted » reste le seul plein ; « Retirer » une touche, « Actualiser » un rond |
| **Paramètres** | recherche creusée, onglets en segmenté (diode), groupes de rangées sobres sur porcelaine (icône dans un creux gravé), « Protège ton compte » en porcelaine (rond ambre gardé, « Activer » touche, « Plus tard » lien). **Sécurité des données** : seule la matière change, son vocabulaire technique reste (§5) |
| **Communauté** | ses jetons `--cm-*` lisent ceux du Studio ; cartons en porcelaine, onglets en segmenté, primaire = plein, croix = rond |
| **E-mails** | ses jetons `--bx-*` lisent ceux du Studio ; rubriques en touches (choisie enfoncée + diode), le code de retrait en touche gravée (17/600, +0,07 em) |
| **Connexion / inscription** | le bleu clair éclairé du haut au lieu du panneau noir ; titre Urbanist ; la carte en porcelaine (rayon 28, ombre de premier plan) ; « Se connecter » = le plein d'encre ; « Découvrir avec des exemples » = un lien ; liens légaux à 44 px |
| **Accueil public, Tarifs** | `src/design/studio-reste-public.css` : leurs jetons (`.av`, `.vt`) prennent le bleu clair ; le bouton principal = plein d'ENCRE (plus de bouton bleu plein), « Découvrir avec des exemples » = touche en porcelaine |
| **Feuilles génériques** | `SheetShell` (`.vrm-fs`) : porcelaine, rayon 28 en haut, ombre de premier plan, voile bleuté ; primaire = plein (barre), secondaire = touche, discret = lien, croix = rond 44 ; la confirmation « irréversible » garde son geste (forme du plein) |

## Comment

- `src/design/studio-reste.css` (importé par `src/App.jsx`) : §0 jetons `--sb-*` et §1 les quatre formes
  `.sb-btn-plein` · `.sb-touche` · `.sb-rond` · `.sb-lien` + `.sb-tuile`, `.sb-chiffre-affiche`, `.sb-plaque`,
  **marqués « provisoire : vient de studio.css »** (la fondation n'était pas fusionnée : à retirer à la
  fusion de `studio.css`, mêmes noms, mêmes valeurs que `directions/_t25/tokens.cjs`) ; §2 le fond (provisoire
  lui aussi : la coque le posera) ; §3 la matière commune et le **remappage** : sur les racines de ce
  chantier, les jetons d'avant (`--d-*` de styles-systeme.css, que lisent toutes les familles, et `--vrm-muted`,
  `--p-gris`…) prennent les valeurs du Studio — le gris d'avant (#6E6E73) ne tenait que 4,0:1 sur le bas du
  bleu ; les gris écrits en ligne (`C.muted`) passent à l'encre 2 par sélecteur d'attribut.
- Tout vit dans `@layer vrm-premium` (la couche qui a le dernier mot sur les `!important`), préfixé `:root×6 body`
  + la racine de l'écran : rien ne sort des écrans du chantier.
- Racines : `data-espace="argent"` (Résumé/Déclarer, Factures, Statistiques, Prix qui marche) ;
  `data-espace="autres"` (Paramètres, Communauté et E-mails — un `div` en `display:contents` dans App.jsx —,
  la connexion) ; Messages par `.vrm-tache[data-tache="messages"]` (la ligne `rendreTache` est partagée avec
  Ventes/Achats, à l'autre chantier : non touchée) et `.vrm-chat-panel`.
- JSX (forme seulement) : `ArgentQuestions` rend la somme en deux morceaux (`<bdi class="sb-nb">1 625<span
  class="eur"> €</span></bdi>` — même texte lu, même `aria-label`, mêmes `data-argent-*`) ; « Pas encore calculé »
  : ses deux gestes en `variante="discret"` ; `btn2` de la facturation électronique porte `sb-touche` ;
  « En attente / Comptabilisées » porte `vrm-seg` / `vrm-seg-btn`.

## Inventaire : rien n'a disparu

`scripts/bancs/studio-reste-inventaire.cjs` : chaque geste relevé sur le build d'AVANT (par `data-*`, nom lu
ou libellé), écran par écran, union des quatre rendus (390/1512, clair/sombre) — Résumé 57, Déclarer 57,
Factures 65, Statistiques 53, Messages 7 (+ chaque rangée de conversation), Conversation 5, Paramètres 348,
Sécurité des données 262, Communauté 2, E-mails 26, Connexion 15. Le banc exige que chacun soit encore dans
l'écran (visible ou rangé : segment caché, repli, « ⋯ »).

**Retiré exprès (Règle des boutons n° 2, le doublon)** : « + Nouvelle facture » de l'état vide de Factures
(il était écrit deux fois sur l'écran) ; le geste reste UNE fois, le plein en tête (`data-fac-principal` au
téléphone). Le banc `finitions-12nov.cjs` (C : « la phrase et “+ Nouvelle facture” dans la carte ») est adapté.

Aucun autre bouton n'a quitté son écran : les autres ont changé de FORME (ex. « Ouvrir Ventes » bouton → lien,
les filtres de la boîte e-mails capsules noires → touches enfoncées + diode).

## Preuves

- `npm run build` ✅.
- Audits : traduction, tdz, variables, coherence, composants, violet, rouge-doublon, urssaf, quoi-de-neuf,
  identite, csp — verts (`scripts/bancs/_studio-audits.sh`). Le rouge provisoire `--sb-doublon` n'est PAS
  redéfini ici (rouge-doublon) : `.sb-plaque.is-double` lit `var(--sb-doublon, var(--vrm-doublon))`.
- Banc **`scripts/bancs/studio-reste.cjs`** (390 tactile et 1512, clair et sombre, 11 vues : Résumé, Déclarer,
  Factures, Statistiques, Messages, Conversation, Paramètres, Sécurité des données, Communauté, E-mails,
  Connexion ; base inventée au volume réel `_base-messages-stock.cjs`) : S1 matière, S2 au plus un plein,
  S3 quatre formes (chaque bouton classé plein · touche · rond · lien · rangée/tuile ; 44 px au doigt, lien
  dans une phrase exempté), S4 AA (fond effectif, pire arrêt des dégradés), S5 rien ne déborde, S6 l'inventaire
  d'avant entier, S7 ni « encaissé », ni « au moins 0 », ni NaN, aucune erreur JS.
  RÉSULTAT_BANC
- Bancs existants : RÉSULTAT_BANCS_EXISTANTS
- `design-passe.cjs` adapté (B graisses, C tailles) : sous une racine du Studio, l'échelle de note.md §4
  (Urbanist 200/300, Inter 500/550/650 ; 12,5 · 13,5 · 14 · 38 · 56 · 68…) est permise — le reste du banc
  inchangé hors du Studio.

## Ce qui reste / à la fusion

- **Polices** : Urbanist et Inter variables sont à la fondation (`studio-polices.css`) ; sans elles, la
  pile retombe sur Inter/système (chiffres plus gras sur les captures de ce chantier).
- À la fusion de `src/design/studio.css` : retirer de `studio-reste.css` les §0, §1 et §2 marqués
  « provisoire » (même noms) ; garder §3 et suivants.
- Messages : `data-espace` n'est pas posé sur la ligne partagée `rendreTache` (Ventes/Achats/Messages) —
  l'agent Ventes la touche ; mes règles visent `.vrm-tache[data-tache="messages"]`.
- Le dessin des écrans dans l'accueil public (`accueil-scenes.jsx`) garde l'ancienne palette (une illustration).
