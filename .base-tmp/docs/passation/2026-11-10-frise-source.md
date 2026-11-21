# 10 nov. — Lots BE (frise d'une vente) et BG (d'où viennent mes achats) — branche `claude/frise-source`

Validés par Julien (peu de texte, du visuel). Extension : rien touché. Aucune migration, aucune
fonction `api/` ajoutée. Pas de PR, pas de fusion (session agent).

## BE — La frise d'une vente

**Où** : Ventes → toucher une vente Vinted → le récapitulatif. Elle REMPLACE, dans le récapitulatif
seulement, la frise à 4 segments (« Vendue · Postée · Livrée · Payée », `friseVente` +
`friseVenteFusion`) — la ligne de la vente garde ses 4 segments, inchangés.

**Les étapes** : Vendue → Bordereau → Déposée → En route → Livrée → Finalisée → Versée
(+ « Vérification » entre En route et Livrée quand la transaction dit « Envoi au centre de
vérification », jamais cochée).

**La règle** (`src/friseProuvee.js`, pure) — chaque étape n'est cochée que par SA preuve, par identité :
| étape | preuve | date |
|---|---|---|
| vendue | la transaction, avec un état écrit | date de la vente |
| bordereau | bordereau e-mail ou capté, par n° de transaction | réception / capture |
| deposee | la règle unique du départ (`partisVinted` = api/_lib/depart-vente.js : Colis fait / scan, expédié à la main, panneau, e-mail du n° exact, prise en charge) ; ou l'état Vinted « déposé » | celle de la raison |
| enroute | ligne `depart_` du n° de SON bordereau (`priseAt`), e-mail « en route » de ce n° ; ou l'état Vinted « en cours d'acheminement » | prise en charge / e-mail |
| livree | ligne `depart_` du même n° à l'état livré/retiré, e-mail « livré » ; ou l'état Vinted « livré » | `etatAt` / e-mail ; « lu » sans date |
| finalisee | 450, « finalisée », `completed` | « lu » (sa date n'est pas lue à part) |
| versee | la date de versement LUE (`versements`, la compta) | cette date |

⚠️ **Différence voulue avec `friseVente`** : AUCUNE déduction. Une vente finalisée sans bordereau
lu montre « Bordereau · pas lu » en gris (avant : cochée « déduite »). Demande explicite de Julien
(« jamais devinée ni cochée par déduction »).
- n° porté par deux ventes ou aussi par un achat (`suivisAmbigus`) ⇒ rien lu du transporteur ;
  e-mail daté de plus d'un jour avant la vente ⇒ ignoré ;
- vente en litige / retour / annulée : les états de LISTE ne prouvent rien (mesuré au 3 nov. :
  « colis déposé » y décrivait le colis de RETOUR) ;
- **ambre** : seulement l'étape en cours où SON geste est attendu (à expédier ⇒ « Bordereau · à
  générer », puis « Déposée · à déposer ») ; la dernière étape prouvée porte l'accent ; jamais de rouge ;
- **bifurcation** (`bifurcationVente`) : ligne de `src/litiges.js` (`litigeDeVente`), étape de
  `etapeRetourVinted`, étiquette de la vente, annulée — rien de redécidé ; ambre si un litige
  « problème » ou une annulation demandée attend SA réponse ; les étapes suivantes pâlissent ;
- « En route » porte le logo du transporteur de SON bordereau (`LogoTransporteur`).
- La ligne « Versé sur ton porte-monnaie » de « L'argent » est retirée : c'est l'étape « Versée »
  (sa date une fois ; `data-recap-verse` reste sur cette étape).

**Rendu** (`src/FriseVente.jsx`, `src/styles-frise-vente.css`, classes `vrm-frv-*` — ⚠️ `vrm-fp`
est déjà la fiche paire plein écran) : verticale au téléphone, horizontale dès 440 px de conteneur
(le panneau de l'ordinateur).

**Câblage** (`src/App.jsx`, Comptabilite) : `friseProuveeDe(o, litige)` après `estParti`
(e-mails indexés par n°, n° ambigus mémorisés), appelée dans `preparerLigneVente` (sa clé entre dans
les `deps` de la ligne : les lectures arrivent après le premier rendu).

## BG — D'où viennent mes achats

**Où** : Argent → Statistiques (l'écran `dashboard`), une carte isolée juste sous « Ce qui
rapporte le plus » (`src/SourcesAchats.jsx`), sur la période choisie.

**La source** (`src/sourceAchats.js`, `sourceDeVente`) — lue ou saisie, jamais devinée :
1. `buyFromId` (achat Vinted relié par sa transaction, posé par son clic) ⇒ Vinted ;
2. `buyGros.id` connu du registre `vrm_fournisseurs` ⇒ Fournisseur ;
3. le N° de la fiche ⇒ l'achat hors plateforme UNIQUE portant ce N° (`cleNum`) ⇒ rattaché à un
   fournisseur : Fournisseur ; sinon la source QU'IL a écrite dans « Où » (liste courte : Brocante,
   Vide-grenier, **Magasin** (ajouté), Fournisseur, Leboncoin (main propre), Particulier ; texte
   libre gardé tel quel) ; rien d'écrit ⇒ « source pas saisie » (compté à part) ;
4. sinon ⇒ « sans achat relié » (compté à part). Jamais le titre.

**Le bénéfice** : la règle unique — `beneficeLigneVente` (Vinted, finalisées, hors masquées) et la
règle de `ventesAutresBenefice` (Leboncoin, eBay, Vestiaire via `ficheUniqueDuNumero`). Calculé et
**publié par Ventes** (`vrm_sources_ventes`, localStorage de l'appareil, estampillé du compte VRM,
comme `vrm_valeur_stock`), rien publié si un compte de ventes a raté ou Leboncoin/eBay pas lus ;
Statistiques LIT. Moyenne sur les ventes au bénéfice CONNU : « 32 € en moyenne · sur 14 ventes ·
prix d'achat manquant pour 3 » ; « au plus » si des frais ne sont pas confirmés ; **jamais « au
moins » sur un bénéfice** (règle de `src/beneficeNoms.js` / `fournisseurs.js` : une paire au prix
inconnu peut être à perte — la couverture « sur N » est dite à la place). Barres neutres, la
meilleure moyenne à l'accent.

## Preuves
- `node scripts/audit-frise-source.cjs` : **40 verts** ; `--prouve` **16/16 mutations** rouges
  (déduction, liste lue en litige, n° ambigu lu, e-mail avant la vente, versée sans date, geste
  partout, annulée tue, N° ambigu de source, source par le titre, moyenne sur tout, « au plus » tu,
  manque tu, « pas saisie » en barre, frise absente du récap, rouge, second calcul dans Stats).
  Sur `origin/main` (git archive) : rouge (modules absents).
- Banc neuf `scripts/bancs/frise-source.cjs` (données inventées ; 390 tactile et 1512, clair et
  sombre) : **76 verts** ; sur `origin/main` rebâti : **24 rouges** (frise et carte absentes) ; sur
  un build MUTÉ (déduction + n° ambigu lu + moyenne sur tout) : **20 rouges** (BE10-12, BG1, BG4).
- Bancs touchés, mis à la règle et relancés un à la fois : `recap-vente` **80 verts** (attentes
  changées : 7005 finalisée = Vendue, Finalisée, Versée ; annulée = bifurcation), `vague2-comptes`
  vert (le récap porte l'étape « centre »), `stats-vitrine` 112, `argent` 268 verts.
- Audits : variables, tdz, coherence, identite, icones, benefice, cout-vente, statuts : verts.
  `npm run build` vert. Captures regardées (390 / 1512, clair / sombre) : frise verticale/horizontale,
  ambre « à générer », bifurcation « Retour initié », carte des sources.
- `git merge origin/main` (Argent arrivé) : sans conflit ; la carte est dans le segment Statistiques.

## Ce qui reste
- Leboncoin, eBay, Vestiaire : leurs récapitulatifs n'ont pas la frise prouvée (pas de recap
  détaillé chez eux) — à faire avec leurs preuves propres.
- « Finalisée » sans date propre (`TXN_ETATS` ne garde pas `status_updated_at`) ; « Versée » porte la
  date de versement de la compta.
- Mondial Relay / Colissimo ne sont pas lus comme départ côté serveur ⇒ « En route » souvent « pas
  lu » pour eux (vrai, pas une panne).
- Une source pour une paire au prix tapé sur la fiche seule (sans achat relié) n'est pas saisissable :
  la relier à un achat (Vinted, hors plateforme par N°) la donne.
