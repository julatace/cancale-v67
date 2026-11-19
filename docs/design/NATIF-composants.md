# « VRM natif » — comment s'en servir

Le contrat (ce qu'on dessine, les jetons, les mesures) : `docs/design/NATIF.md`.
Ici : **comment un écran s'en sert**. Chaque fichier de `src/natif/` commence par son mode d'emploi (props, exemple) ;
la galerie montre tout, dans tous les états :

```bash
SHOTS=/tmp/natif node scripts/bancs/natif-galerie.cjs          # construit, juge, photographie
node scripts/bancs/natif-galerie.cjs --prouve                   # chaque mutation doit rougir
```

## En trois lignes

```jsx
import { Page, Groupe, Rangee, Vignette, Plaque, Bouton } from '../natif/index.js';   // les deux CSS partent avec
<Page titre="Ventes" plein={<Bouton variante="plein" onClick={imprimer}>Imprimer 3 bordereaux</Bouton>}>
  <Groupe titre="À envoyer">{ventes.map((v) => <Rangee key={v.id} vignette={<Vignette src={v.photo} alt=""/>} titre={v.titre} lignes={2}
     plaque={<Plaque numero={v.numero}/>} sousTitre={v.sous} valeur={v.prix} valeurForte fin="chevron" onClick={() => ouvrir(v)}/>)}</Groupe>
</Page>
```

Un écran natif n'écrit **ni style en ligne, ni classe à lui pour la mise en page, ni couleur** : il compose des composants.
Les composants sont **présentationnels** : ils ne lisent aucune donnée et ne portent aucune règle métier — l'écran leur
passe des textes déjà faits (`tr()`), des nombres déjà formatés, des fonctions.

## Les règles qui évitent 90 % des défauts

| À faire | À ne pas faire |
|---|---|
| UN `<Bouton variante="plein">` par écran, passé à `plein` de `<Page>` (il reste collé en bas) | deux pleins ; un plein au milieu d'une liste |
| Une rangée ENTIÈRE se touche (`onClick`) | un bouton DANS une rangée (les gestes secondaires vont dans `actions` : le balayage) |
| Un nombre inconnu = `null` ⇒ le composant écrit « — » (`Affiche`, `Fait`) | `0`, `'0 €'`, `''` pour « pas su » (CLAUDE.md §5) |
| `indisponible` **avec** `raison` (la phrase qui dit quoi faire) | un bouton grisé muet |
| `Plaque doublon` et `Pastille ton="doublon"` : SEULEMENT deux paires sous un N° | du rouge pour « supprimer », « erreur », « en retard » |
| `ton="ambre"` : un geste à faire, une date limite LUE proche | de l'ambre décoratif |
| Icônes : `<Icon name="…"/>` de l'app, passée en prop | un SVG dessiné dans l'écran, un emoji |
| Textes par `tr()` (clé dans `fr`, puis en / es / it / de) | une phrase en dur |
| Une saisie courte, un choix : `<Feuille>` ; une fiche, un atelier : `<PagePoussee>` | une fenêtre faite main (`position: fixed`), un `confirm()` |
| Défaire après coup : `<Toast onAnnuler>` | une confirmation avant un geste sans risque |
| Tailles : 13 · 15 · 17 · 22 · 34 · 48, graisses 400 · 600 · 700 — déjà dans les composants | `font-size`, `font-weight` dans l'écran |

Ce que le banc refuse (dans la galerie, et ce que ton banc d'écran doit refuser aussi) : un texte sous 4,5:1 sur son fond
rendu, une cible sous 44 × 44 au doigt, un débordement, un prix / un N° coupé, une graisse 500, une taille hors liste,
un rayon hors 8 / 10 / 12 / 14 / rond, un `!important`, un `:has()`.

## Jetons (`src/natif/jetons.css`)

Couleurs du contrat : `--n-fond` `--n-carte` `--n-carte-2` `--n-trait` `--n-encre` `--n-encre-2` `--n-encre-3` (jamais du
texte) `--n-accent` `--n-plein` `--n-sur-plein` `--n-teinte` `--n-ambre` `--n-ambre-fond` `--n-doublon`.
Dérivés (mesurés par le banc) : **`--n-sur-teinte`** (le texte SUR `--n-teinte` : l'accent n'y fait que 4,0:1),
`--n-sur-ambre`, `--n-sur-doublon`, `--n-inactif` / `--n-sur-inactif` (indisponible, lisible), `--n-appui` (le voile de
8 % d'un élément enfoncé), `--n-barre`, `--n-voile`, `--n-inverse` / `--n-sur-inverse` (toast), `--n-squelette`,
`--n-curseur`, `--n-pouce`.
Texte : `font: var(--n-t-grand | section | barre | corps | corps-fort | second | second-fort | legende | legende-fort | affiche)`.
Mesures : `--n-marge` (16, puis 20 dès 430 px), `--n-r-carte` `--n-r-bouton` `--n-r-plein` `--n-r-plaque` `--n-r-vignette`
`--n-r-rond`, `--n-cible` (44), `--n-bas` (ce que la barre d'onglets occupe : un élément collé en bas s'y pose).
Mouvement : `--n-courbe`, `--n-duree` (250), `--n-duree-lente` (300), `--n-duree-appui` (80).
Sombre : `data-theme="dark"` sur la racine (le choix `vinted_dark`), rien à faire dans l'écran.

Un ANCIEN écran qu'on convertit prend les mêmes jetons : `background: var(--n-carte)`, `color: var(--n-encre)`,
`font: var(--n-t-second)` — jamais une valeur.

## Les composants, un exemple chacun

**Page** — l'écran. Dans la coque, c'est la coque qui dessine le grand titre : ta `<Page>` n'ajoute que sa recherche, son
contenu et son plein (tu écris la même chose dans les deux cas).
```jsx
<Page titre="Annonces" recherche={<ChampRecherche valeur={q} onChange={setQ} placeholder="N°, titre" onScanner={scanner}/>}>…</Page>
```

**PagePoussee** — une fiche, un atelier. Téléphone : arrive de la droite, retour « ‹ », balayage du bord, geste « retour ».
Ordinateur à trois volets : s'ouvre toute seule dans le volet de détail (rien à changer dans l'écran).
```jsx
<PagePoussee ouverte={!!fiche} titre={'N° ' + fiche?.numero} libelleRetour="Annonces" onRetour={() => setFiche(null)}
             plein={<Bouton variante="plein">Republier</Bouton>}>…</PagePoussee>
```
⚠️ Rends-la TOUJOURS (avec `ouverte={false}`) plutôt que de la monter / démonter : elle anime sa sortie.

**Groupe** + **Rangee** — la liste groupée. Hauteur 44 (texte, icône) · 56 (`<Vignette taille={44}>`) · 72 (`<Vignette>`).
```jsx
<Groupe titre="Réglages" pied="La même sur tous tes appareils.">
  <Rangee icone={<Icon name="langue" size={22}/>} titre="Langue" valeur="Français" fin="chevron" onClick={ouvrirLangue}/>
  <Rangee icone={<Icon name="moon" size={22}/>} titre="Mode sombre" interrupteur={{ actif: sombre, onChange: setSombre }}/>
  <Rangee titre="Vinted" fin="coche" onClick={() => choisir('vinted')}/>
</Groupe>
<Groupe titre="À régler" repli={{ ouvert, onBascule: () => setOuvert(!ouvert), n: 4 }}>…</Groupe>
<Groupe grand titre="Ce mois">…</Groupe>          {/* titre de section 22/28 : un ou deux par écran */}
```
Balayage (le geste principal d'une liste) — la DERNIÈRE action est la plus proche du bord ; `franc` = balayer jusqu'au
bout la fait. Clavier : ← ouvre, Échap / → referme ; souris : clic droit. Une seule rangée ouverte à la fois.
```jsx
<Rangee … actions={[{ cle: 'baisser', libelle: 'Baisser', ton: 'neutre', onClick: baisser },
                    { cle: 'envoye', libelle: 'Envoyé', onClick: marquerEnvoye, franc: true }]}/>
```
Disposition d'une rangée : « titre | valeur » puis « sous-titre | détail ». `lignes={2}` pour un titre d'annonce.
`selectionnee` : la rangée ouverte dans le volet de détail. `ton="ambre"` : le sous-titre est un geste à faire.

**Bouton** — `plein` · `teinte` (défaut) · `texte` · `destructif` (deux touchers, jamais rouge).
```jsx
<Bouton variante="plein" chargement={enCours} onClick={imprimer}>Imprimer 3 bordereaux</Bouton>
<Bouton variante="plein" indisponible raison="Aucun bordereau prêt : ils arrivent par e-mail.">Imprimer</Bouton>
<Bouton variante="destructif" confirmation="Supprimer pour de bon" onClick={supprimer}>Supprimer l'annonce</Bouton>
<BoutonIcone libelle="Scanner un colis" icone={<Icon name="scan" size={22}/>} onClick={scanner}/>
```

**Segmente** — 2 à 5 choix (← → au clavier). `n` : un compte discret, pas une pastille.
```jsx
<Segmente libelle="Filtrer les ventes" valeur={f} onChange={setF} options={[{ cle: 'envoyer', libelle: 'À envoyer', n: 3 }, { cle: 'route', libelle: 'En route' }]}/>
```

**Feuille** — monte du bas (carte centrée à l'ordinateur). Portail, piège de focus, `FermeAuRetour`, poignée : tout seul.
```jsx
<Feuille ouverte={saisie} onFermer={() => setSaisie(false)} titre="Prix d'achat" detente="moitie" detentes={['moitie', 'pleine']}
         pied={<Bouton variante="plein" onClick={enregistrer}>Enregistrer</Bouton>}>…</Feuille>
```
⚠️ Rends-la toujours (`ouverte={false}`) : elle anime sa sortie et rend le focus. Dans une feuille les cartes passent
toutes seules en `--n-carte-2`.

**Faits** — la grille d'une fiche. Une valeur avec `onModifier` se touche ; `null` ⇒ « — » en accent (la porte pour la remplir).
```jsx
<Groupe><Faits colonnes={2}>
  <Fait libelle="Prix" valeur="45 €" onModifier={ouvrirPrix}/>
  <Fait libelle="Acheté" valeur={achat == null ? null : euros(achat)} onModifier={ouvrirAchat}/>
</Faits></Groupe>
```

**Plaque** — `<Plaque numero={124}/>` · `grand` · `doublon` (le seul rouge). Le N° s'affiche tel quel (jamais « 1 234 »).

**Pastille** — `<Pastille ton="ambre">À envoyer</Pastille>` · `<Pastille ton="ambre-plein">{3}</Pastille>` ; 0 ⇒ rien ; > 99 ⇒ « 99+ ».

**Affiche** — LE chiffre de l'écran, dans un `<Groupe>`. L'écart est NOMMÉ.
```jsx
<Groupe><Affiche valeur="186" unite="€" libelle="vendus aujourd'hui · 4 ventes" ecart="42 € de plus qu'hier"/></Groupe>
```

**Vide** — `<Vide icone={<Icon name="box" size={40}/>} phrase="Aucun colis à envoyer." action={<Bouton onClick={voir}>Voir les ventes</Bouton>}/>`

**Attente** — le squelette a la forme de ce qui arrive (jamais de saut) : `undefined` ⇒ `<Attente>`, `null` ⇒ « pas su », valeur ⇒ le contenu.
```jsx
{ventes === undefined ? <Attente forme="rangees" n={5} vignette={56} titre/> : <Groupe …/>}
```

**Toast** — au-dessus de la barre d'onglets, 10 s, annulable. `key` = l'identité du geste.
```jsx
{fait ? <Toast key={fait.id} message={`Marqué envoyé · N° ${fait.numero}`} onAnnuler={() => defaire(fait)} onFin={() => setFait(null)}/> : null}
```

**ChampRecherche** — 44 de haut, 17 px (l'iPhone ne zoome pas), scanner DANS le champ. `onOuvrir` : le champ est une porte
(le toucher ouvre la recherche de l'app, il ne saisit rien lui-même).

**Coque**, **BarreOnglets**, **BarreLaterale** — posées UNE fois par `src/App.jsx` ; un écran ne les rend pas. Ce qu'un
écran peut lire : `useOrdinateur()` (≥ 1024 px) ; ce qu'il obtient sans rien faire : sa `<PagePoussee>` dans le volet de
détail quand la coque est en `volets="trois"`.

### Dans l'app (livraison 2, 19 nov.) : comment un écran passe en natif

L'app garde sa propre structure (`<main>` qui défile, ses écrans gardés) et pose les PIÈCES de la coque :
`CoqueRacine` (`defile="ecran"`), `CoqueEcran` (le `<main>`), `TetePage` (la barre de titre + le champ de recherche),
`ActionsCoque` (Messages + la photo ⇒ « Plus »), `FeuillePlus`, `BarreOnglets`, `BarreLaterale`. Un écran d'AVANT garde
son titre ; la coque ne pose qu'une barre de titre fine (le titre y apparaît au défilement) et la recherche.

Pour qu'un écran REFAIT ait le grand titre et, à l'ordinateur, trois volets :
1. il rend `<Page titre={tr('…')} plein={…}>` (sans `actions` de coque : la coque les pose) ;
2. on ajoute son identifiant d'onglet à `ECRANS_NATIFS` dans `src/App.jsx` (une ligne : `new Set(['ventes'])`).
La coque dessine alors son grand titre (34, qui se réduit dans la barre), sa `<Page>` n'ajoute que le contenu ; à
l'ordinateur un volet de détail s'ouvre à droite et sa `<PagePoussee>` s'y pose d'elle-même (`ContexteCoque.voletDetail`).

À ne pas faire : poser une barre d'onglets, un menu, une loupe ou une cloche dans un écran (une seule navigation : les
5 onglets + « Plus ») ; poser un attribut qui suit l'onglet sur `<html>`, `<body>` ou la racine de la coque (chaque
changement d'onglet restylerait tout — banc `natif-coque` K8).

## Icônes

`poserIcone(Icon)` est appelé une fois par l'app : les glyphes internes (chevron, coche, loupe, croix, « ⋯ », scanner,
image) sont les tracés de `ICON_PATHS`. Un composant monté seul (un banc) appelle lui-même `poserIcone` avec le même
dessin (voir `outils/natif-galerie/galerie.jsx`), sinon les glyphes sont vides — sans erreur (CLAUDE.md §4.11 : le banc
`natif-galerie` compte les glyphes dessinés).

## Après « FONDATION PRÊTE »

Une API ne se casse plus : on **ajoute** une prop (avec sa valeur par défaut), on ne renomme rien, on ne change pas le
sens d'une valeur. Un besoin qui manque : ajoute-le dans `src/natif/`, montre-le dans la galerie, garde le banc vert.

## Ajoutés pour « Aujourd'hui » (19 nov., `src/natif/complements.css`)

**Barres** — une petite série (les 7 jours), dans une `<Affiche>` : `<Barres libelle="Les sept derniers jours" barres={[{ cle, lettre, libelle, valeur }]} choisie={6} onChoisir={setJour}/>` ; `valeur: null` = pas su (piste vide). Chaque barre est une cible ≥ 44.

**Vignettes** — la bande des colis : `<Vignettes elements={[{ cle, src, numero, presse, libelle, onClick }]} total={8} libellePlus={(n) => …} onPlus={…}/>` ; chaque case a SA plaque, au plus un point ambre ; ce qui ne tient pas devient « +N » (mesuré).

**CodeRetrait** — `<CodeRetrait code="416362" onClick={ouvrir} libelle="Voir les codes de retrait"/>` : le code en grand, centré.

**Colonnes** / **Colonne** — à l'ordinateur, des colonnes de 320 au moins (trois à 1280 et 1512) ; au téléphone elles
s'effacent et les groupes se suivent dans l'ordre écrit. Rends `<Colonnes>` directement dans `<Page>` : son plein se pose
alors à droite, à sa largeur.
```jsx
<Page titre="Aujourd'hui" plein={…}><Colonnes><Colonne>…</Colonne><Colonne>…</Colonne></Colonnes></Page>
```

## Ajouté le 19 nov. soir : le TABLEAU DE TRAVAIL (`src/natif/TableauTravail.jsx`, `src/natif/tableau.css`, NATIF.md §2 bis)

Une liste d'écran (Annonces, Ventes, Achats, Notifications) à l'ordinateur : barre de titre (pastille du compte, « Mis à jour
il y a … », ⟳), barre d'outils (« Choisir une action ▾ », recherche, **Statut ▾** à cases et compteurs, filtres de l'écran,
`outilsPlus`), « N articles », liste ⇄ grille, **Colonnes ▾** (mémorisé par écran, `vrm_tableau_{id}`, cet appareil), tableau
(case, vignette 48, colonnes triables, Statut en étiquette douce, ⋯), sélection ⇒ barre « N sélectionnés · {Action} » (LE plein).
Au téléphone : les rangées de 72 (§4). Présentationnel : l'écran passe des lignes déjà faites (`statut`, `texte`, `attrs`) et des
colonnes `{ cle, libelle, num, tri(l), rendu(l), defaut }`. **Les compteurs du filtre Statut sont comptés sur les lignes reçues
après la recherche** : coché seul, un statut affiche exactement son compteur (banc `app-tableaux` T6).
```jsx
<TableauTravail id="ventes" titre="Ventes" lignes={lignes} statuts={[{ cle: 'envoyer', libelle: 'À envoyer', ton: 'ambre' }]}
  colonnes={[{ cle: 'prix', libelle: 'Prix', num: true, tri: (l) => l.prix, rendu: (l) => euros(l.prix) }, { cle: 'statut', libelle: 'Statut' }]}
  actions={[{ cle: 'imprimer', libelle: 'Imprimer les bordereaux', pour: (l) => l.statut === 'envoyer' }]} onAction={(cle, ls) => …}/>
```
Un écran en tableau prend toute la largeur (`ECRANS_TABLEAU` dans src/App.jsx : pas de troisième volet) ; sa `<PagePoussee
className="n-tt-fiche">` s'ouvre en panneau à droite. Les contrôles d'un tableau passent par le pont `src/coque-native.css`.
