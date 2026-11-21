# Spécification — la page d'accueil publique de VRM et son film

Rédigée le 11 octobre 2026 pour l'agent qui construit. Elle se suffit à
elle-même : ne relis pas les directions, tout ce qu'il faut est ici.

**Base retenue : la direction 2, « Le revendeur d'abord ».** Le haut de page
montre la liste du matin d'un revendeur ; trois sections répondent aux trois
questions de sa journée. Greffes prises aux directions 0 et 1, et corrections
exigées par les deux jugements, toutes intégrées ci-dessous (rien n'est à
« fusionner » de ton côté).

Compétences du dépôt appliquées : `emil-design-eng`, `apple-design`, `animate`
(`.claude/skills/`). Relis-les si un réglage de mouvement te fait hésiter :
toutes les durées et courbes viennent d'elles.

---

## 0. En dix lignes

1. Une pastille DÉFINIT (« L'outil de gestion des revendeurs de seconde main »),
   le titre PROMET (« Tu ouvres VRM. Tu sais quoi faire. »), le sous-titre
   CONCRÉTISE (colis, ventes ailleurs, URSSAF).
2. À côté (dessous sur téléphone), la **carte « Aujourd'hui »** : quatre onglets
   se replient en un seul (« tous tes comptes en un »), puis une vente tombe et
   crée **toute seule** deux choses à faire. Elle joue **une fois**, en 4,5 s,
   puis s'arrête. Ses lignes servent de sommaire.
3. Dans le premier écran, aux deux tailles : le produit, le prix, « aucun mot de
   passe Vinted » et le prérequis (« un ordinateur avec Chrome »).
4. Trois sections-questions : **8 h 02** quels colis je poste · **8 h 03** vendu
   sur Vinted, encore en ligne ailleurs ? · **Fin du mois** combien je déclare.
   Chaque écran dessiné joue une fois quand on arrive dessus, moins de 5 s.
5. Un seul article inventé, **la N°128** (Nike Air Max 90 · T42), traverse la
   page et le film. Son numéro **vole** jusqu'au bordereau et s'y tamponne : le
   geste signature.
6. Grammaire visible : ce que **VRM** fait arrive **sans curseur** ; ce que
   **TU** fais passe par un **curseur dessiné**.
7. Puis : les petites questions, l'installation (dite franchement), la
   confiance (une fois, en positif), le prix et la FAQ, la fin « Demain matin,
   ouvre VRM » avec le tampon « N° 1 ».
8. Une seule couleur d'accent, rare. Aucun texte sous 12 px. Aucune boucle.
   « Réduire les animations » affiche l'état final.
9. Le film (35 s, et 15 s en version courte, 60 images/s) : la galère en
   typographie, tout est aspiré dans VRM, puis les trois questions restent à
   l'écran pendant leur réponse ; on passe d'un plan à l'autre en suivant un
   élément commun (le 128, puis les 85,00 €), jamais par le noir.
10. Page ≤ 5 000 px sur téléphone, ≤ 4 600 px sur ordinateur. Le film et les
    scènes du bas de page sont dans des morceaux chargés à part.

---

## 1. Ce qui ne bouge pas (règles du dépôt, appliquées ici)

| règle | ce qu'elle impose |
|---|---|
| Aucune preuve sociale inventée | Aucun nombre de vendeurs, aucune étoile, aucun avis, aucun logo de client, aucune citation. Pas de « note du fondateur » sans le oui de Julien. |
| Le prix vient des CGV | `public/legal/cgv.html` : « abonnement à 9,99 € par mois, sans engagement » et « Tant que l'application ne l'exige pas, l'accès à VRM reste gratuit ». Aucun autre montant mensuel, jamais « 0 € ». |
| « Accès offert » = UNE constante | `ACCES_OFFERT` (§2.2). Le jour où Julien rend l'abonnement obligatoire, on la passe à `false` : toutes les phrases « gratuit pour l'instant » et « aucune carte bancaire » disparaissent d'un coup. |
| Aucune adresse écrite en dur | Le pied de page lit `src/contact.js` (`contactEmail()`, `CONTACT_A_VENIR`). ⚠️ `scripts/audit-lancement.cjs` exige que **`src/Accueil.jsx`** importe `./contact.js`, appelle `contactEmail()` et affiche `{CONTACT_A_VENIR}` : le pied de page reste dans ce fichier. Aucune chaîne qui ressemble à une adresse email nulle part dans les fichiers de la page (même dans la démo). |
| Aucune vraie donnée | Tout est dessiné. Comptes = **libellés** « Perso » et « Boutique », jamais un pseudo. Aucun nom ni adresse d'acheteur. Codes de retrait et relais inventés et génériques. Code-barres = motif dessiné illisible. Aucun logo de transporteur ou de plateforme : leur nom en texte, et un point de couleur de 6 à 8 px. |
| Réduire les animations | Tout s'affiche dans son **état final**, sans notification, sans vol, sans curseur, sans compteur qui défile. Le réglage est écouté **en direct** (`matchMedia(...).addEventListener('change')`). ⚠️ `index.html` coupe déjà toute animation et transition CSS sous ce réglage : n'en dépends jamais pour afficher un état. |
| Page légère | Aucune bibliothèque, aucune vidéo, aucune image en plus des logos déjà présents (`/logo-vrm-96.png`, `/logo-vrm-192.png`). Plafonds au §2.4. La page ne lit **rien** en base. |
| Français simple | Pas de « PDF tamponné », « file », « CA des ventes finalisées », « non empaquetée ». « Article » dans le texte général ; « paire » seulement pour la N°128 (une basket). La démo montre aussi une veste : VRM sert à tous les revendeurs (décision du 20 septembre). |
| Ne rien promettre qui n'existe pas | Chaque phrase est dans le registre du §11, avec la fonction qui la rend vraie. Interdits : « publie » tout court pour Leboncoin, « rien ne part sans ton clic », « en direct », « encaissé », « deux minutes », Vestiaire ou le détourage présentés comme disponibles. |

---

## 2. Fichiers, morceaux, constantes

### 2.1 Les fichiers

| fichier | contenu | chargé |
|---|---|---|
| `src/accueil-reglages.js` (nouveau, JS pur) | les constantes du §2.2 | avec la page |
| `src/accueil-demo.js` (nouveau, JS pur, ESM) | l'objet `DEMO` (§2.3) et `euros(n)` | avec la page |
| `src/accueil-mouvement.js` (nouveau) | courbes, `seg`, `mix`, `retombe`, l'horloge partagée, `useScene`, `useMoinsDeMouvement`, `useSansSouris` (§3.6) | avec la page |
| `src/accueil-carte.jsx` (nouveau) | `CarteJour` (le haut de page, §5) | avec la page |
| `src/Accueil.jsx` (réécrit) | la page, sa CSS, ses textes, la barre, le pied de page | avec la page (import statique de `main.jsx`) |
| `src/accueil-scenes.jsx` (nouveau) | `SceneColis`, `SceneAilleurs`, `SceneMois`, `ScenePremier`, `Curseur`, `Feuille` | **à part** : `React.lazy`, préchargé pendant un temps mort (§2.4) |
| `src/AccueilFilm.jsx` (nouveau) | le film (§10) | **à part** : `main.jsx` le charge en `React.lazy` **seulement** avec `?film` |
| `scripts/film-accueil.cjs` | export MP4 (§10.8) | — |
| `scripts/bancs/accueil.cjs` | banc (§12) | — |
| `scripts/audit-accueil-demo.cjs` (nouveau) | arithmétique de la démo (§12.4) | — |

`main.jsx` : remplacer `import Accueil, { Film } from './Accueil.jsx'` par
`import Accueil from './Accueil.jsx'` et
`const Film = React.lazy(() => import('./AccueilFilm.jsx'))` ; rendre
`<React.Suspense fallback={<FondApp />}><Film /></React.Suspense>` quand
`filmDemande`. Le reste du routage ne change pas (session, `?code`, `?tab`,
`?connexion`, `?inscription`, `popstate`, préchargement de l'app au survol).

**À retirer de `Accueil.jsx`** : `SCENES`, `SceneComptes`, `SceneVentes`,
`SceneBordereau`, `SceneRangement`, `SceneMessages`, `SceneChiffres`,
`Fenetre`, `Legende`, `RAIL`, `PLATEFORMES`, `DemoAnimee`, `Film`, `FONCTIONS`,
`ETAPES`, `GARANTIES`, l'ancienne `FAQ`, la bande `.acc-plats`, les cartes
numérotées. Vérifie après coupe que plus rien ne les appelle (`grep`) et que la
page rend (§4.11 du dossier : une coupe se vérifie sur ce qui reste).

### 2.2 `src/accueil-reglages.js`

```js
// Un seul endroit à changer le jour J. Le banc lit ces valeurs.
export const ACCES_OFFERT = true;            // false le jour où l'abonnement est obligatoire
export const EXTENSION_SUR_LE_STORE = false; // true le jour où la fiche Chrome Web Store existe
export const DETOURAGE_POUR_TOUS = false;    // true quand PHOTOROOM_POUR=tous (chantier Vestiaire + Photoroom)
export const VESTIAIRE_BRANCHE = false;      // true quand VRM compte vraiment Vestiaire
export const PRIX_MOIS = '9,99';             // doit rester égal aux CGV (le banc compare)
```

- `DETOURAGE_POUR_TOUS` et `VESTIAIRE_BRANCHE` ne servent aujourd'hui qu'à
  cacher ce qui est prêt : une 7ᵉ petite question (§7.1) et la réponse FAQ
  Vestiaire (§7.4). Rien d'autre n'en dépend.
- Dans CLAUDE.md, la consigne « le jour où Julien passe le réglage à '1',
  retirer cette phrase de `src/Accueil.jsx` » devient « passer `ACCES_OFFERT` à
  `false` dans `src/accueil-reglages.js` ».

### 2.3 `src/accueil-demo.js` — UNE table pour la page et le film

```js
export const PLATEFORMES = {
  vinted:    { nom: 'Vinted',    point: '#12B7BE' },
  leboncoin: { nom: 'Leboncoin', point: '#F56B2A' },
  ebay:      { nom: 'eBay',      point: '#86B817' }, // ⚠️ jamais bleu : il se confondait avec l'accent
};
export const DEMO = {
  comptes: [                                          // libellés, jamais un pseudo
    { id: 'perso',    nom: 'Perso',     plateforme: 'vinted' },
    { id: 'boutique', nom: 'Boutique',  plateforme: 'vinted' },
    { id: 'lbc',      nom: 'Leboncoin', plateforme: 'leboncoin' },
    { id: 'ebay',     nom: 'eBay',      plateforme: 'ebay' },
  ],
  vente: { n: '128', titre: 'Nike Air Max 90', taille: 'T42', prix: 85, compte: 'perso',
           transporteur: 'Mondial Relay', delai: '5 j pour poster',
           ailleurs: [
             { plateforme: 'leboncoin', titre: 'Nike Air Max 90 T42',       prix: 90, ident: 'réf. VRM-128' },
             { plateforme: 'ebay',      titre: 'Nike Air Max 90 Taille 42', prix: 95, ident: 'SKU VRM-128' },
           ] },
  colis: [                                            // l'écran Colis, dans l'ordre affiché
    { n: '131', titre: 'Adidas Samba OG', taille: 'T40', compte: 'boutique', transporteur: 'Vinted Go',
      delai: "à poster aujourd'hui", court: "aujourd'hui", urgent: true, pret: true },
    { n: '128', titre: 'Nike Air Max 90', taille: 'T42', compte: 'perso', transporteur: 'Mondial Relay',
      delai: '5 j pour poster', court: '5 j', urgent: false, pret: true },
    { n: '97',  titre: 'Veste en jean Levi’s', taille: 'M', compte: 'boutique', transporteur: 'Vinted',
      delai: '4 j pour poster', court: '4 j', urgent: false, pret: false },
  ],
  stock: ['124', '125', '126', '127', '128', '129', '130', '131'],   // téléphone : 127, 128, 129
  jour: {
    colisAvant: 2, colisApres: 3, urgents: 1,
    aRetirerAvant: 0, aRetirerApres: 2,
    relais: { n: 2, lieu: 'Relais du Marché' },
    messages: { n: 4, comptes: ['Perso', 'Boutique'] },
    recu: 812.30,                                     // « Reçu ce mois-ci », le matin
    derniereAvant: { titre: 'Veste en jean Levi’s', prix: 38, compte: 'Boutique', quand: 'hier' },
  },
  mois: { avant: 1159.50, apres: 1244.50, ventesAvant: 22, ventesApres: 23,
          vintedAvant: 956.00, vinted: 1041.00, leboncoin: 158.50, ebay: 45.00,
          aDater: { n: 2, total: 64.00 } },
  reste: { code: '4821 73', lieu: 'Relais du Marché', attente: 212.40, dispo: 96.00,
           vente: { titre: 'Sac Longchamp Le Pliage', prix: 45, compte: 'Boutique' } },
};
// 1 244,50 € — espace fine insécable, virgule, deux décimales.
export const euros = (n) => `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
```

Les écrans dessinés **lisent** `DEMO` : aucun nombre n'est tapé en dur dans un
composant. L'audit du §12.4 vérifie que la table se tient.

### 2.4 Le poids

- Mesuré le 11 octobre sur le `dist/` présent : le fichier d'entrée
  `assets/index-*.js` (celui que nomme `dist/index.html`) pèse **59 Ko bruts,
  19,0 Ko compressés (gzip)**. Remesure-le sur un build de `HEAD` avant de
  commencer et note la valeur dans le banc.
- **Plafond : fichier d'entrée ≤ 26 Ko gzip.** On retire les six scènes et la
  fenêtre actuelles du fichier d'entrée, ce qui doit compenser la carte et le
  moteur.
- `accueil-scenes-*.js` ≤ 20 Ko gzip ; `AccueilFilm-*.js` ≤ 25 Ko gzip.
- Le morceau des scènes est demandé pendant un temps mort
  (`requestIdleCallback(..., { timeout: 2000 })`, repli `setTimeout(1200)`), ou
  plus tôt dès qu'une section à scène approche (`IntersectionObserver`,
  `rootMargin: '800px 0px'`). Pendant le chargement, chaque emplacement garde
  **sa hauteur finale** (boîte réservée) : la page ne saute pas.
- Un visiteur de `/` ne télécharge jamais `App-*` ni `AccueilFilm-*`. Une page
  `?film` ne télécharge jamais `App-*`.

---

## 3. Le système visuel

### 3.1 Jetons (objet `K` de `Accueil.jsx`, réutilisé par les autres fichiers)

| jeton | valeur | usage |
|---|---|---|
| `bg` | `#07090D` | fond de page (et de `document.body`, comme aujourd'hui) |
| `surface` | `#0B0E13` | bande de la section 5, barre d'onglets de la carte |
| `card` | `#10141B` | cartes et écrans dessinés |
| `card2` | `#151A23` | encadrés, badges, pile de comptes |
| `line` / `line2` | `rgba(255,255,255,.08)` / `.13` | filets |
| `text` | `#EEF1F6` | texte (17,6:1) |
| `muted` | `#9AA3B2` | texte secondaire (7,8:1) |
| `faint` | **`#8A93A3`** (remplace `#687284`, qui échouait à 4,11:1) | petit texte discret (6,4:1) |
| `cta` | **`#2458E6`** (l'accent du thème clair de l'app) | **fond du bouton principal** (blanc dessus : 5,8:1) |
| `accent` | `#3D7BFF` | **ce qui bouge** dans un écran dessiné, l'anneau de focus |
| `accentSoft` | `rgba(61,123,255,.14)` | éclairage d'une ligne qui vient de changer |
| `warn` | `#FFB23E` | **seulement dans les écrans dessinés** : « à poster aujourd'hui », point « à retirer » |
| `paper` / `ink` | `#F4F6FA` / `#111620` | la feuille du bordereau |

- **Budget d'accent, dans le cadre de la page** (hors écrans dessinés) : le fond
  des boutons principaux et l'anneau de focus. Rien d'autre : pas de mot bleu
  dans les titres, pas de sur-titre bleu, pas de coche bleue, pas de numéro
  d'étape bleu.
- **Ambre et couleurs de plateformes : jamais dans le cadre de la page**,
  seulement dans les écrans dessinés et le film.
- Le focus : `.acc :focus-visible{outline:2px solid #3D7BFF;outline-offset:2px}`.
  Il doit battre la règle globale d'`index.html` (`#0f6b4f`, l'ancien vert).

### 3.2 Typographie (six tailles)

Space Grotesk (600, 700) pour les titres et les montants ; Inter (400, 500, 600)
pour le texte. Déjà hébergées sur le site (`main.jsx`). Tous les nombres en
`font-variant-numeric: tabular-nums` (déjà sur `body`).

| rôle | ordinateur | téléphone (< 760 px) | réglage |
|---|---|---|---|
| H1 | 56 px | 32 px | Space Grotesk 700, interligne 1,04, −0,03 em |
| H2 (les questions) | 40 px | 28 px | Space Grotesk 700, interligne 1,1, −0,02 em |
| Réponse courte, sous-titre | 19 px | 17 px | Inter 400, interligne 1,5 |
| Texte | 16 px | 15 px | Inter 400, interligne 1,55, `muted` |
| Écrans dessinés, précisions | 14 px | 14 px | Inter, interligne 1,45 |
| Petit (horodatages, lignes du haut, pied, méta des écrans) | 13 px | 13 px (méta des écrans : 12 px au plus petit) | Inter 500 |

**Aucun texte rendu sous 12 px**, nulle part sur la page. Aucun `transform:
scale` sur un écran dessiné de la page : chaque écran est mis en page pour sa
largeur.

### 3.3 Formes, matière, profondeur

- Rayons : **12** (cartes, écrans), **10** (boutons), **8** (puces, pastille de
  définition, onglets, badges), **5** (petits carrés de la pile).
- Carte : fond `card`, filet `line2`, reflet `inset 0 1px 0 rgba(255,255,255,.06)`,
  ombre à deux couches `0 1px 2px rgba(0,0,0,.5), 0 24px 60px rgba(0,0,0,.45)`.
- **Une lueur, immobile** : dégradé radial `rgba(61,123,255,.12)` derrière la
  carte « Aujourd'hui », et la même à 8 % derrière la fin. Rien ne respire,
  rien ne tourne en fond.
- La section 5 est sur `surface` avec un filet `line` en haut et en bas : on
  sait où on en est.

### 3.4 Les boutons : une forme, trois poids

| poids | classe | forme |
|---|---|---|
| **Principal** | `acc-btn acc-p` | Fond `cta`, texte blanc 15 px / 600 (16 px dans le haut de page sur ordinateur). Rayon 10. Hauteur 48 (52 en pleine largeur sur téléphone, 38 dans la barre). Marges `0 20px`. Reflet `inset 0 1px 0 rgba(255,255,255,.18)`. Ombre `0 1px 2px rgba(0,0,0,.5), 0 8px 24px rgba(36,88,230,.28)`. Un chevron « › » à droite, `aria-hidden`. Libellé **toujours** « Créer mon compte ». |
| **Lien** | `acc-lien` | Texte `muted` 14 px / 500, sans fond ; « Se connecter » en `text`, 600. Souligné au survol, décalage 3 px. Zone de clic ≥ 44 px de haut. |
| **Ligne** | `acc-ligne` | Les lignes de la carte « Aujourd'hui » : pleine largeur, ≥ 52 px, fond transparent, chevron à droite. |

- **Appui** : `scale(.97)` en 120 ms, `cubic-bezier(0.23,1,0.32,1)`. Sélecteur
  `.acc .acc-btn:active:not(:disabled)` — sinon la règle globale d'`index.html`
  (`scale(.975)`) gagne. Les lignes : fond `rgba(255,255,255,.06)` à l'appui.
- **Survol** (uniquement sous `@media (hover:hover) and (pointer:fine)`) : le
  chevron avance de 2 px (`translateX`, 160 ms, même courbe) ; l'ombre colorée
  monte à `0 10px 28px rgba(36,88,230,.36)` ; **le fond ne change pas** (on ne
  dégrade pas le contraste). Lignes : fond `rgba(255,255,255,.04)` + chevron.
- Transitions nommées propriété par propriété : jamais `transition: all`.
- Téléphone : `-webkit-tap-highlight-color: transparent`,
  `touch-action: manipulation` sur tout ce qui se touche.
- Deux libellés pour deux actions, partout : « Créer mon compte » et « Se
  connecter ». « Commencer » et « J'ai déjà un compte » disparaissent.

### 3.5 Les courbes et les règles de mouvement

| nom | valeur | sert à |
|---|---|---|
| `sortie` | `cubic-bezier(0.23, 1, 0.32, 1)` | toute entrée, tout appui, tout changement d'état |
| `trajet` | `cubic-bezier(0.77, 0, 0.175, 1)` | ce qui se déplace à l'écran (onglets, vols en X, curseur, caméra du film) |
| `retombe` | `x ↦ 1 + 2,2·(x−1)³ + 1,2·(x−1)²` (easeOutBack, c1 = 1,2) | **uniquement** l'atterrissage d'un tampon (il arrive avec de l'élan, après un vol) |
| `lineaire` | — | le fil de la journée, la lente avancée de caméra du film |

Règles, valables partout :
1. **Un seul élément bouge à la fois** dans un écran.
2. On n'anime que `transform`, `opacity`, `clip-path`, `filter: blur(≤ 6px)` et
   le `stroke-dashoffset` d'un trait SVG. Jamais largeur, hauteur, marge, top.
3. Une entrée part de `scale(.96–.98)` ou d'un `translateY` de 6 à 10 px, avec
   l'opacité à 0. Jamais `scale(0)`.
4. **La sortie est plus rapide que l'entrée** (≈ 200 ms contre 300–500 ms).
5. **Rien ne boucle.** Tout ce qui démarre seul dure **moins de 5 s** et
   s'arrête (aucune pause à fournir, WCAG 2.2.2). Ensuite, aucune image n'est
   calculée.
6. Rien ne prend la main sur le défilement.
7. Un vol (badge, puce, montant) est un **clone** qui part de la position de
   l'original : X en `trajet`, Y en `sortie` (ça dessine un arc). L'original
   reste en place.
8. Les positions de départ et d'arrivée d'un vol se **mesurent** sur le DOM
   (`getBoundingClientRect` relatif au conteneur de l'écran), dans un
   `useLayoutEffect` relancé par un `ResizeObserver`. L'image reste une fonction
   pure de `(s, mesures)` : même temps, même image.

### 3.6 Le moteur (`src/accueil-mouvement.js`)

- `bezier(x1, y1, x2, y2)` : évaluateur de courbe CSS (Newton, 8 itérations,
  repli par dichotomie), ~25 lignes. `sortie`, `trajet` en sont deux instances.
  Les fonctions actuelles `sortie`, `douce`, `rebond` disparaissent.
- `seg(s, a, b)` = avancée bornée à [0, 1] de `s` entre `a` et `b` (secondes) ;
  `mix(a, b, x)`.
- **Une horloge partagée pour toute la page** : un `Set` de lecteurs actifs au
  niveau du module ; **une seule** boucle `requestAnimationFrame`, qui ne tourne
  que si le `Set` n'est pas vide. Pas de temps `dt = min(0,25 s, max(0,
  now − prec))` (un pas négatif vaut 0 : la leçon de `dansBoucle`).
- `useScene(ref, duree, { seuil = 0.35, attente = 0 })` rend
  `{ s, etat, rejouer }` :
  - `etat` vaut `'debut'` tant que rien n'a commencé, `'joue'`, puis `'fin'` ;
  - démarre **une fois**, quand l'élément est visible à `seuil`
    (`IntersectionObserver`) **et** que `document.fonts.ready` est résolu, après
    `attente` ms ;
  - se met en pause onglet caché (`visibilitychange`) ou élément hors de l'écran
    (seuil 0,05), et reprend où il en était ;
  - `rejouer()` remet `s` à 0 et repart (s'il est visible) ;
  - avec moins de mouvement : `s = duree`, `etat = 'fin'` **dès le premier
    rendu**, et tout de suite si le réglage change pendant la lecture.
- `useMoinsDeMouvement()` : `matchMedia('(prefers-reduced-motion: reduce)')`,
  écouté en direct ; une erreur vaut `false`.
- `useSansSouris()` : `(pointer: coarse)` **et** `(hover: none)`, écouté en
  direct ; une erreur vaut `false`. C'est **le même test** que `useSansSouris`
  d'`App.jsx` (ligne ~7555) ; écris un commentaire qui le dit, pour qu'ils ne
  divergent pas.

---

## 4. Le haut de page et le premier écran

### 4.1 Les textes exacts

```
Pastille     L’outil de gestion des revendeurs de seconde main          [data-definition]
H1           Tu ouvres VRM.                    ← ton atténué (muted)
             Tu sais quoi faire.               ← ton plein (text)
Sous-titre   Tes comptes Vinted, Leboncoin et eBay au même endroit — un compte ou dix :
             les colis à poster, les articles vendus ailleurs, la compta pour l’URSSAF.
Bouton       [ Créer mon compte  › ]                                    [data-cta="inscription"]
Lien         Déjà un compte ? Se connecter                              [data-cta="connexion"]
Ligne 1      Gratuit pour l’instant, puis 9,99 € par mois · Sans engagement · Aucun mot de passe Vinted demandé
             └ « Gratuit pour l’instant, puis » seulement si ACCES_OFFERT ; sinon « 9,99 € par mois · … »
             └ « Gratuit pour l’instant » porte [data-acces-offert] ; « 9,99 € » en text 600
Ligne 2      [data-prerequis] — deux variantes, une seule affichée :
  souris     S’installe une fois dans Chrome, sur ton ordinateur. Ensuite, ton téléphone suffit.
  tactile    Sur ton téléphone, crée ton compte dès maintenant : l’extension s’installe ensuite une fois, dans Chrome sur un ordinateur.
```

- **Pourquoi trois étages.** La pastille, lue en premier en haut à gauche, dit
  ce qu'est VRM et pour qui (une marque inconnue n'a pas droit au slogan seul).
  Le titre promet un soulagement que tout revendeur connaît. Le sous-titre, collé
  au titre (16 px d'écart), donne le concret et annonce les trois sections dans
  l'ordre. « un compte ou dix » : le vendeur à un seul compte n'est pas écarté.
- `data-prerequis` porte `data-variante="souris"` ou `"tactile"` selon
  `useSansSouris()`. Les deux contiennent le mot « ordinateur ».
- `document.title` : `VRM — l’outil de gestion des revendeurs Vinted, Leboncoin et eBay`
  (rendu au démontage, comme aujourd'hui).
- La pastille : 14 px / 600, `text` sur `card2`, filet `line2`, rayon 8, marges
  `6px 12px`. Pas d'icône.
- Rien ne bouge dans la colonne de texte : la promesse est lisible à la
  première image.

### 4.2 Ordinateur (≥ 1100 px ; mesuré à 1512 × 900)

```
┌ barre collante 64 px ────────────────────────────────────────────────────────┐
│ [logo 32] VRM   Colis · Vendu ailleurs · URSSAF · Prix · Questions   Se connecter [Créer…]* │
└──────────────────────────────────────────────────────────────────────────────┘
 y≈120 ┌ texte 580 px ─────────────────┐   ┌ carte « Aujourd'hui » 500 px ──────┐
       │ (L’outil de gestion des …)    │   │ [Perso][Boutique][Leboncoin][eBay] │ ← se replient en [VRM]
       │ Tu ouvres VRM.        (56 px) │   │ Aujourd’hui (exemple)   ▪▪▪▪ 4 comptes │
       │ Tu sais quoi faire.           │   │ Dernière vente : hier · Veste …     │
       │ Sous-titre 19 px, 3 lignes    │   │ Colis à poster                2  ›  │
       │ [Créer mon compte ›]  Déjà un compte ? Se connecter │ Annonces à retirer   —  ›  │
       │ ligne 1 · ligne 2 (14 px)     │   │ Colis au relais               2  ›  │
       └───────────────────────────────┘   │ Messages non lus              4  ›  │
                                           │ Reçu ce mois-ci 812,30 €  à déclarer › │
                                           └────────────────────────────────────┘
 y≈720   8 h 02 · avant d'aller au relais      ← la section 1 dépasse : invitation à descendre
```
\* « Créer mon compte » n'apparaît dans la barre qu'une fois le bouton du haut
de page sorti de l'écran (§8.1).

- Conteneur 1180 px, marges 20 px (1 140 px utiles). Grille
  `minmax(0,580px) minmax(0,500px)`, écart 60 px (580 + 60 + 500 = 1 140 : pas
  un pixel de trop). Le haut de la carte (barre d'onglets) est aligné sur le
  haut de la pastille.
- « Tu sais quoi faire. » doit tenir sur **une** ligne à 1512 px : si ce n'est
  pas le cas une fois rendu, réduire le H1 par pas de 2 px (jusqu'à 48 px au
  plus bas) — jamais élargir la colonne.
- Le bouton et le lien sont sur la même ligne (écart 20 px).
- À 1366 × 768, tout le haut de page tient (≈ 700 px utiles).

### 4.3 Tablette (760–1099 px)

Empilé : la colonne de texte (640 px au plus, alignée à gauche), puis la carte
(500 px au plus, alignée à gauche). Bouton et lien sur la même ligne.

### 4.4 Téléphone (< 760 px ; mesuré à 390 × 844, marges 20 px, colonne 350 px)

| y (px) | élément |
|---|---|
| 0–56 | barre collante : logo 28 + « VRM » (caché sous 380 px de large) ; à droite **« Se connecter »** (lien, toujours visible) ; « Créer mon compte » (38 px de haut, 13,5 px) n'y apparaît qu'après défilement |
| 76–104 | pastille de définition |
| 116–186 | H1 en 32 px, deux lignes |
| 202–302 | sous-titre 17 px, 4 lignes |
| 322–374 | « Créer mon compte › », pleine largeur, 52 px |
| 382–418 | « Déjà un compte ? Se connecter », centré |
| 430–510 | ligne 1 (2 lignes) puis ligne 2 (2 lignes), 13 px, `faint` |
| **≈ 530 →** | **la carte « Aujourd'hui »** : barre d'onglets, en-tête, « Dernière vente », et au moins les lignes **« Colis à poster » et « Annonces à retirer »** visibles sans défiler (bas de la 2ᵉ ligne ≤ 844) |

Le produit, le prix, « aucun mot de passe Vinted » et « ordinateur » sont dans
le premier écran. Aujourd'hui la démo commence à 618 px et le prix à 5 127 px.

### 4.5 Pourquoi un inconnu comprend en 5 secondes

| seconde | ce qu'il voit | ce qu'il comprend |
|---|---|---|
| 0–1 | « L'outil de gestion des revendeurs de seconde main » puis « Tu ouvres VRM. Tu sais quoi faire. » | ce que c'est, pour qui, la promesse |
| 1–2 | sous-titre ; à côté, quatre onglets (Perso, Boutique, Leboncoin, eBay) se replient en un seul onglet VRM | « tous mes comptes et mes sites, au même endroit » — sans le lire |
| 1,2–3,5 | une vente tombe sur « Perso » ; son numéro file vers « Colis à poster » (2 → 3) puis vers « Annonces à retirer » (— → 2) | **la valeur en une image** : une vente crée toute seule ce qu'il faut faire, partout |
| 3–5 | « Gratuit pour l'instant, puis 9,99 € par mois · Sans engagement · Aucun mot de passe Vinted demandé » et la ligne sur l'ordinateur | combien, quel risque, ce qu'il faut avoir |

Inspirations, et ce qu'on en prend : Linear (le produit en héros, surfaces
sombres à reflet d'1 px en haut) ; Apple (une idée par écran, posée en
question) ; Stripe (chiffres à chasse fixe) ; Raycast (une seule couleur vive,
rare) ; Superhuman (un bouton principal par bande, le même verbe partout).

---

## 5. La carte « Aujourd'hui » (`CarteJour`, `src/accueil-carte.jsx`)

### 5.1 Ce qu'elle est

Une **vraie liste cliquable** :
`<nav aria-label="Ta journée avec VRM — exemple" data-demo-animee data-etat="…">`.
C'est l'unique `[data-demo-animee]` de la page. Largeur 500 px (ordinateur),
100 % de la colonne (téléphone, 350 px). Fond `card`, rayon 12, matière du §3.3,
lueur derrière. Tout ce qui bouge seul (onglets, notification, vols) est
`aria-hidden`.

### 5.2 Son contenu (état final)

```
┌───────────────────────────────────────────────────────────┐
│ [logo 14] VRM ▔▔▔▔▔                                        │ barre d'onglets 36 px (34 tél.), fond surface
├───────────────────────────────────────────────────────────┤
│ Aujourd’hui (exemple)                  ▪▪▪▪ 4 comptes      │ 48 px
│ Dernière vente : à l’instant · Nike Air Max 90 · 85,00 € · Perso │ 22 px, 13 px, faint
│ ───────────────────────────────────────────────────────── │
│ Colis à poster                                    3   ›    │ [data-vers="colis"]     56 px
│   dont 1 à poster aujourd’hui                              │   « aujourd’hui » en warn
│ Annonces à retirer                         ●      2   ›    │ [data-vers="ailleurs"]  ● = warn
│   N°128 vendue sur Vinted · encore sur Leboncoin et eBay   │
│ Colis au relais                                   2   ›    │ [data-vers="questions"]
│   2 codes de retrait reçus · Relais du Marché              │
│ Messages non lus                                  4   ›    │ [data-vers="questions"]
│   sur Perso et Boutique                                    │
│ ───────────────────────────────────────────────────────── │
│ Reçu ce mois-ci   812,30 €                   à déclarer ›  │ [data-vers="urssaf"]    48 px
└───────────────────────────────────────────────────────────┘
```

- **Téléphone (variante `compact`, conteneur < 440 px)** : chaque sous-ligne
  tient sur **une** ligne à 13 px, sans points de suspension. Textes courts :
  « Dernière vente : Nike Air Max 90 · 85,00 € » (avant : « Dernière vente :
  Veste en jean Levi’s · 38,00 € ») ; « N°128 vendue · encore sur Leboncoin et
  eBay » ; « 2 codes reçus · Relais du Marché ». Les autres sont identiques.
- **« exemple »** : une petite puce à côté du titre (12 px, `faint`, filet
  `line2`, rayon 8). Elle dit, dès la première image, que ce sont des données
  inventées. C'est la seule mention : pas de légende sous la carte (§7 du
  dossier : une fois).
- **La pile** : 4 carrés de 18 × 18, rayon 5, fond `card2`, filet `line2`, qui
  se chevauchent de 6 px ; chacun porte au centre un point de 7 px à la couleur
  de sa plateforme (Vinted, Vinted, Leboncoin, eBay). Puis « 4 comptes » en
  13 px `muted`.
- Le titre « Aujourd'hui » : Space Grotesk 18 px / 600. Les intitulés de ligne :
  15 px / 600 `text` ; les sous-lignes : 13 px `muted` ; les nombres : Space
  Grotesk 22 px / 700 `text`, chasse fixe, alignés à droite avant le chevron.
- « Reçu ce mois-ci » est **avant** la vente du matin et **n'en bouge pas** :
  une vente faite à 8 h 01 n'est pas encore versée (vendu ≠ reçu, CLAUDE.md
  n° 20).
- **Accessibilité** : chaque ligne est un `<button>` dont l'`aria-label` dit
  l'état final (« Colis à poster : 3. Voir la section des colis. »). Les
  nombres qui défilent ne sont pas lus.

### 5.3 L'état de départ

- Barre d'onglets : **quatre onglets** côte à côte, le premier actif (fond
  `card`, il se fond dans la carte), les autres sur `surface`, rayon `8 8 0 0`,
  qui se chevauchent de 6 px comme dans Chrome. Chacun : point de plateforme
  6 px + libellé 12 px.
  - ordinateur : « Vinted · Perso », « Vinted · Boutique », « Leboncoin », « eBay » ;
  - téléphone : « Perso », « Boutique », « Leboncoin », « eBay » (≥ 12 px tenus,
    largeur d'onglet = (largeur − 24 + 3 × 6) / 4).
- Pile : invisible. « 4 comptes » : invisible.
- Dernière vente : « Dernière vente : hier · Veste en jean Levi’s · 38,00 € · Boutique ».
- Colis à poster **2** ; Annonces à retirer **—**, sous-ligne « rien de vendu
  ailleurs », pas de point ; le reste comme l'état final.

### 5.4 Le déroulé (une fois, 4,5 s)

Démarrage : `useScene(ref, 4.5, { seuil: 0.35, attente: 300 })` — polices
chargées, carte visible, 300 ms pour que l'œil se pose sur le titre.

| s (secondes) | ce qui bouge | comment | `data-etat` |
|---|---|---|---|
| 0,00–0,56 | les onglets 2, 3 et 4 glissent sur l'onglet 1 et s'effacent | `translateX` vers la position de l'onglet 1, 420 ms chacun, `trajet`, départs à 0 / 70 / 140 ms ; opacité 1 → 0 sur les derniers 40 % de chaque trajet | `onglets` |
| 0,55–0,80 | l'onglet 1 devient « [logo] VRM » | fondu enchaîné avec `blur(2px)` au milieu, 250 ms | `onglets` |
| 0,70–0,95 | la pile apparaît, puis « 4 comptes » | chaque carré `scale(.9→1)` + opacité, 200 ms, `sortie`, 40 ms d'écart ; texte : opacité 200 ms | `onglets` |
| 1,20–1,50 | **la notification** glisse en haut du corps de la carte, par-dessus « Dernière vente » : point Vinted · « **Nouvelle vente · Vinted · Perso** » / « Nike Air Max 90 · T42 · **N°128** — 85,00 € » / « à l'instant » | `translateY(-10px→0)`, opacité, 300 ms, `sortie` ; fond `card2`, filet `line2`, rayon 10, ombre `0 1px 2px rgba(0,0,0,.5), 0 12px 32px rgba(0,0,0,.5)` ; `[data-notif]` | `vente` |
| 1,75–2,25 | **vol 1** : un clone de la puce « N°128 » part de la notification et file vers le nombre de « Colis à poster » | 500 ms ; X `trajet`, Y `sortie` ; `scale` 1 → 1,15 (mi-course) → 0,9 ; opacité 1 → 0 sur les 80 derniers ms ; puce : fond `rgba(61,123,255,.18)`, filet `accent`, texte `text` 12 px / 600 ; `[data-vol]` | `vente` |
| 2,20–2,42 | « Colis à poster » : **2 → 3** | l'ancien chiffre monte (`translateY(-40%)`) et s'efface en 200 ms ; le nouveau arrive d'en bas en 220 ms, `sortie` ; la ligne s'éclaire `accentSoft` (150 ms), tient 500 ms, s'éteint (600 ms, `ease`) | `vente` |
| 2,45–2,95 | **vol 2** : vers le nombre d'« Annonces à retirer » | comme le vol 1 | `vente` |
| 2,90–3,12 | « — → **2** », le point ambre apparaît, la sous-ligne devient « N°128 vendue sur Vinted · encore sur Leboncoin et eBay » | fondu enchaîné avec `blur(2px)`, 220 ms ; même éclairage de ligne | `vente` |
| 4,20–4,40 | la notification repart vers le haut ; « Dernière vente » devient « à l'instant · Nike Air Max 90 · 85,00 € · Perso » | notification : `translateY(-6px)`, opacité → 0, **200 ms** ; ligne : fondu enchaîné 200 ms | `vente` |
| 4,50 | fin ; « ↻ Revoir » apparaît en bas à droite, sous la carte | opacité 200 ms | `fin` |

- **Aucun curseur** dans cette carte : c'est VRM qui travaille (§0, point 6).
- « ↻ Revoir » : lien 13 px `muted`, `data-revoir`, `aria-label="Revoir
  l'exemple"`. Il rejoue tout depuis l'état de départ.
- **Pendant le déroulé, la carte reste cliquable** : un clic sur une ligne fait
  défiler ; si la carte sort de l'écran, son temps s'arrête et reprend au
  retour.
- **Moins de mouvement** : la carte rend **directement l'état final** (onglet
  VRM, pile, 3, 2, « Dernière vente : à l'instant… »), `data-etat="fin"` dès le
  premier rendu, **aucun** `[data-notif]` ni `[data-vol]` jamais dans le DOM,
  pas de « Revoir ».

### 5.5 Les clics (sommaire)

| ligne | va vers |
|---|---|
| Colis à poster | `#colis` |
| Annonces à retirer | `#ailleurs` |
| Colis au relais, Messages non lus | `#questions` |
| Reçu ce mois-ci · à déclarer | `#urssaf` |

`el.scrollIntoView({ behavior: moinsDeMouvement ? 'auto' : 'smooth', block:
'start' })`. Chaque section a `scroll-margin-top: 80px` (la barre collante).

---

## 6. Les trois sections-questions

### 6.1 Le gabarit commun

```
horodatage     13 px / 500, chiffres pleins en text, contexte en muted         (ex. « 8 h 02 · avant d’aller au relais »)
H2             la question
réponse        19 px (17 tél.), text — UNE ou DEUX phrases : la réponse ET ce que VRM fait
VRM / Toi      deux lignes 14 px : « VRM » en text 600 puis le texte ; « Toi » en muted 600 puis le texte
précisions     ≤ 2 puces 14 px muted — cachées sous 760 px (CSS) ; le texte reste dans le DOM
écran dessiné  [data-scene], role="img", aria-label = l'état final
↻ Revoir       sous l'écran, à droite, quand il a fini
```

- Mise en page ordinateur : section 1 = texte à gauche (460 px), écran à droite
  (600 px) ; section 2 = texte en haut sur deux colonnes (H2 + réponse | VRM/Toi
  + précisions), écran pleine largeur dessous ; section 3 = écran à gauche
  (560 px), texte à droite. On casse le gabarit répétitif sans changer de fond.
- Téléphone : tout empilé, l'écran sous le texte.
- Moins de mouvement : chaque écran est rendu dans son état final, sans curseur,
  et **sans** « ↻ Revoir » (il n'y a rien à rejouer).
- Chaque écran : `useScene(ref, DUREE, { seuil: 0.35 })`,
  `data-scene="colis|ailleurs|urssaf"`, `data-etat="debut|joue|fin"`. Variante
  `compact` quand la largeur du conteneur est < 560 px (`ResizeObserver`).
- Tant que le morceau des scènes n'est pas chargé : la boîte réservée porte déjà
  `data-scene` et `data-etat="debut"`, et `data-pret` n'apparaît qu'au montage
  de la scène.

### 6.2 Section 1 — `#colis` (`data-section="colis"`)

**Textes**
```
8 h 02 · avant d’aller au relais
Quels colis je poste ce matin ?
Ceux-là, dans cet ordre : bordereau prêt d’abord, le plus pressé en haut — chacun avec le numéro de son carton imprimé dessus.
VRM  prépare le bordereau de chaque vente et y imprime le titre et le numéro.
Toi  tu imprimes, tu prends le carton 128, tu déposes.
· Un bordereau par feuille, en A4 ou sur imprimante thermique.
· Ton numéro de rangement, en chiffres ou en série (B125…), n’est jamais redonné à un autre article.
```

**L'écran (`SceneColis`, `DUREE_COLIS = 3.8`)**

*Tuile « Colis »* — en-tête : « **Colis · 3 à poster** » à gauche, bouton
« Tout imprimer (2) » à droite (principal miniature : 32 px, 13 px, fond `cta`).

| groupe | ligne (vignette dessinée 32 px + titre 14/600 + méta 12) | à droite |
|---|---|---|
| **Prêts à imprimer · 2** | Adidas Samba OG · T40 — méta : badge **N°131** · Vinted Go · Boutique | « à poster aujourd'hui » en `warn` (tél. : « aujourd'hui ») |
| | Nike Air Max 90 · T42 — méta : badge **N°128** · Mondial Relay · Perso | « 5 j pour poster » `muted` (tél. : « 5 j ») |
| **En attente du bordereau · 1** | Veste en jean Levi’s · M — méta : badge **N°97** · Vinted · Boutique | bouton encadré « Générer le bordereau » (tél. : « Générer ») |

Badge : fond `card2`, filet `line2`, rayon 8, 12 px / 600, chiffres fixes.
Vignette : le dégradé sombre + silhouette de l'actuelle `Photo` (une veste
dessinée pour le N°97 : un contour de veste au trait, même style).

*La feuille* (`[data-bordereau]`) : papier `paper`, encre `ink`, rayon 5, ombre
`0 1px 2px rgba(0,0,0,.4), 0 16px 40px rgba(0,0,0,.45)`, inclinée de −1°. Elle
porte « Mondial Relay » (texte 12 px / 700), un code-barres dessiné (barres
verticales régulières, illisibles), « Point relais : Relais du Marché », et en
bas **le tampon** `[data-tampon]` : cadre 1,5 px `cta`, rayon 5, « **N°128** ·
Nike Air Max 90 · T42 » (12 px / 600, `ink`).

*Le stock* : des cartons vus de face (rectangles `card2`, filet `line2`, rayon
5, bande de scotch plus claire, numéro 12 px / 600). `[data-carton="128"]` porte
`data-sorti="1"` quand il est sorti.

Mise en page :
- **ordinateur (600 × ~470)** : tuile 560 px ; feuille 240 × 160 qui sort de
  sous le bas de la tuile et la chevauche en bas à droite de 30 px ; rangée de
  8 cartons (124 à 131, 56 × 60) sous la tuile.
- **téléphone (350 × ~388)** : tuile pleine largeur (≈ 256) ; dessous une bande
  de 120 px : à gauche la feuille (196 × 120), à droite 3 cartons (127, 128, 129).

| s | ce qui bouge | comment |
|---|---|---|
| 0,00–0,40 | les lignes entrent | `translateY(8px→0)` + opacité, 300 ms, `sortie`, 40 ms d'écart |
| 0,55–1,05 | **le curseur** entre par le bas à droite et va sur « Tout imprimer » | `[data-curseur]` ; flèche dessinée 18 px blanche à contour sombre ; `transform`, 500 ms, `trajet` |
| 1,10 | appui | bouton `scale(.97)` 100 ms puis retour 160 ms ; curseur `scale(.9)` ; un anneau blanc neutre de 14 px grossit et s'efface en 300 ms |
| 1,25–1,75 | la feuille sort ; le curseur s'efface (1,30–1,50) | feuille : `translateY(28px) rotate(-2deg)` → `translateY(0) rotate(-1deg)`, opacité, 500 ms, `sortie` |
| 1,90–2,50 | **le geste signature** : un clone du badge « N°128 » quitte la ligne de la Nike et vole jusqu'au tampon | 600 ms ; X `trajet`, Y `sortie` ; `scale` 1 → 1,25 (mi-course) → 1,1 ; `rotate` 0 → −4° ; le clone passe au contour `accent` en vol. L'original reste dans la ligne |
| 2,50–2,78 | **le tampon se pose** | `scale` 1,1 → 1 en `retombe`, 280 ms ; le cadre se révèle depuis le centre (`clip-path: inset(50% 50%)` → `inset(0)`, 180 ms) ; un anneau d'encre 2 px `accent` grossit de 1 à 1,6 en s'effaçant (0,35 → 0), 420 ms |
| 3,10–3,46 | **le carton 128 sort de la rangée** | `translateY(-6px)`, ombre plus profonde, contour `accent` 1,5 px en fondu, 360 ms, `sortie` ; au-dessus, « Carton 128 · Nike Air Max 90 · T42 » en fondu 200 ms (12 px) |
| 3,80 | fin ; « ↻ Revoir » | opacité 200 ms |

`aria-label` : « Exemple d'écran Colis : trois colis à poster, deux bordereaux
prêts ; le bordereau de la N°128 sort avec son numéro imprimé, et le carton 128
est mis en avant. »

### 6.3 Section 2 — `#ailleurs` (`data-section="ailleurs"`)

**Textes**
```
8 h 03 · la Nike vient d’être vendue sur Vinted
Vendu sur Vinted… encore en ligne sur Leboncoin ?
VRM te le dit. Chaque annonce est reliée à son article par son numéro — jamais par son titre — et une vente prouvée sur un site te dit où le retirer ailleurs, dans les deux sens.
VRM  relie tes annonces par leur numéro et te signale celles à retirer.
Toi  tu la retires d’eBay d’un clic ; sur Vinted et Leboncoin, c’est toi qui la retires — VRM te dit laquelle.
· Publiée depuis VRM, l’annonce porte déjà son numéro ; sinon, tu la relies d’un clic.
· Ça marche aussi pour une veste, un sac ou un livre : le lien, c’est le numéro.
```

**L'écran (`SceneAilleurs`, `DUREE_AILLEURS = 4.2`)**

Trois tuiles, **titres volontairement différents** (VRM ne compare pas les
titres, il compare le numéro) :

| tuile | ligne 1 | titre (14/600) | identité (12, chiffres fixes) | emplacement d'état (à droite de l'identité) |
|---|---|---|---|---|
| Vinted | ● Vinted · Perso — 85,00 € | Nike Air Max 90 · T42 | `[data-ident]` **N°128** | « En ligne » → badge « Vendue » |
| Leboncoin | ● Leboncoin — 90,00 € | Nike Air Max 90 T42 | `[data-ident]` **réf. VRM-128** | « En ligne » → « À retirer » (point `warn`) |
| eBay | ● eBay — 95,00 € | Nike Air Max 90 Taille 42 | `[data-ident]` **SKU VRM-128** | « En ligne » → « À retirer » → « Retirée d'eBay ✓ » |

- Pied de la tuile Leboncoin (réservé, 24 px) : « Tu la retires sur Leboncoin. »
  (12 px `muted`, apparaît avec le bandeau). **Aucun bouton, aucun curseur** sur
  Vinted et Leboncoin : VRM ne touche jamais ces annonces.
- Pied de la tuile eBay (réservé, 36 px) : bouton encadré « Retirer d'eBay »
  (apparaît avec le bandeau).
- La bulle de confirmation (reprend le texte de l'app,
  `App.jsx` `retirer`) : « Retirer « Nike Air Max 90 » d'eBay ? » / « C'est
  sans retour côté eBay. » / [Annuler] [**Oui, retirer d'eBay**]. Elle part du
  bouton (`transform-origin` sur le bouton).
- Le trait : un `<svg>` en surimpression, chemin qui passe par les centres des
  trois `[data-ident]` (mesurés), trait 2 px `accent`, bouts arrondis.
- Mise en page : **ordinateur** trois tuiles de 300 × 170 côte à côte (trait
  horizontal) ; **téléphone** empilées (84, 108 et 120 px de haut, 8 px d'écart ;
  trait vertical). La bulle chevauche la tuile du dessus : elle est en
  `position: absolute`, sans pousser la mise en page.

| s | ce qui bouge | comment |
|---|---|---|
| 0,00–0,45 | les tuiles entrent | 60 ms d'écart, 300 ms, `translateY(8px)`, `sortie` |
| 0,70 | Vinted : badge « Vendue » ; le contenu de la tuile passe à 60 % | badge `scale(.96→1)` + opacité 200 ms ; contenu : opacité 200 ms |
| 1,00–1,60 | **le trait relie N°128 → VRM-128 → VRM-128** ; chaque identité s'éclaire à son passage | `stroke-dashoffset`, 600 ms, `trajet` ; fond `accentSoft` sur l'identité, 150 ms |
| 1,80–2,20 | Leboncoin puis eBay : « À retirer », point ambre, pieds de tuile | `translateY(-6px→0)` + opacité, 260 ms, 80 ms d'écart |
| 2,40–2,85 | **le curseur** va sur « Retirer d'eBay » | 450 ms, `trajet` |
| 2,90 | appui | bouton `scale(.97)` ; curseur `scale(.9)` ; anneau blanc |
| 3,00–3,20 | la bulle s'ouvre | `scale(.96→1)` + opacité, 200 ms, `sortie`, depuis le bouton |
| 3,30–3,60 | le curseur va sur « Oui, retirer d'eBay » ; appui à 3,65 | 300 ms, `trajet` |
| 3,75 | la bulle se ferme ; eBay devient « Retirée d'eBay ✓ », tuile à 50 % ; le curseur s'efface | bulle 150 ms ; fondu enchaîné `blur(2px)` 220 ms ; curseur 200 ms |
| 4,20 | fin ; « ↻ Revoir » | 200 ms |

`aria-label` : « Exemple : la N°128 est vendue sur Vinted ; VRM la relie par
son numéro à ses annonces Leboncoin et eBay, les signale à retirer, et l'annonce
eBay est retirée après confirmation. »

### 6.4 Section 3 — `#urssaf` (`data-section="urssaf"`)

**Textes**
```
Fin du mois
Combien je déclare à l’URSSAF ?
Ce chiffre-là. Le chiffre d’affaires de tes ventes finalisées sur Vinted, Leboncoin et eBay, mois par mois : une vente Vinted compte le mois où l’argent t’est versé ; Leboncoin et eBay, au jour de la vente.
VRM  compte, date chaque vente et prépare le rapport du mois.
Toi  tu reportes le montant sur ton espace URSSAF, puis tu le notes comme déclaré.
· « J’ai déclaré ce mois » : une vente notée ne se recompte jamais dans un autre mois.
· Le rapport du mois en PDF et en tableur, pour toi ou ton comptable.
```

**L'écran (`SceneMois`, `DUREE_MOIS = 3.8`)** — la carte « Ce mois-ci » :

```
Ce mois-ci · à déclarer
1 159,50 €                       [data-total]   Space Grotesk 40 px (32 tél.), chiffres fixes
22 ventes finalisées
[█████████████████|████|█]      barre empilée, trois gris (blanc à 70 / 40 / 22 %) — révélée après le compte
● Vinted 956,00 €   ● Leboncoin 158,50 €   ● eBay 45,00 €     (points de plateforme ; montants en text)
2 ventes pas encore datées · 64,00 € — comptées à part
[ J’ai déclaré ce mois ]          bouton encadré
```

| s | ce qui bouge | comment |
|---|---|---|
| 0,00–0,35 | la carte entre | `translateY(8px)` + opacité, 300 ms, `sortie` |
| 0,55–0,90 | une pastille « **+85,00 € · N°128 · Nike Air Max 90 · versé** » glisse au-dessus du total | `translateX(-16px→0)` + opacité, 350 ms, `sortie` ; filet `accent`, fond `rgba(61,123,255,.12)`, rayon 8, 12 px / 600 |
| 1,05–1,45 | la pastille plonge dans le total et disparaît | vers le centre du total, `scale(.9)`, opacité → 0, 400 ms, `trajet` |
| 1,25–2,05 | le total roule de **1 159,50 €** à **1 244,50 €** ; « Vinted 956,00 € » roule en même temps vers **1 041,00 €** ; à 1,65, « 22 » devient « 23 » (fondu enchaîné 200 ms) | 800 ms, `sortie`, arrondi au centime à chaque image. **Le compteur part d'un socle non nul** : jamais de « 0 € » transitoire |
| 2,00–2,60 | la barre se dévoile de gauche à droite, segment par segment | `clip-path: inset(0 100% 0 0)` → `inset(0)`, 600 ms, `sortie`, 80 ms d'écart |
| 2,80–3,20 | **le curseur** va sur « J'ai déclaré ce mois » ; appui à 3,25 | 400 ms, `trajet` ; appui comme ailleurs |
| 3,35 | le bouton devient « ✓ Noté comme déclaré » ; le curseur s'efface | fondu enchaîné `blur(2px)` 220 ms |
| 3,80 | fin ; « ↻ Revoir » | 200 ms |

Les couleurs de plateformes ne sont **que** les points de la légende : la barre
reste grise.

`aria-label` : « Exemple : la vente de la N°128, versée en fin de mois, porte le
chiffre à déclarer de 1 159,50 € à 1 244,50 €, toutes plateformes ; le mois est
ensuite noté comme déclaré. »

---

## 7. La suite de la page (textes exacts)

### 7.1 Section 4 — `#questions` (`data-section="questions"`)

```
Le reste de la journée
Et toutes les petites questions.
```

Six entrées, **rien ne bouge**. Ordinateur : grille 3 × 2 de cartes basses
(`card`, rayon 12, `20px 20px`). Téléphone : une liste compacte (icône à gauche,
question en gras, réponse dessous, filet `line` entre deux). Icônes au trait
18 px `muted` (SVG en ligne : colis, bulle, euro, flèche d'envoi, téléphone,
pile).

| question (15 px / 600) | réponse (14 px `muted`, ≤ 100 caractères) |
|---|---|
| Mon colis est au relais : c’est quoi le code ? | Le code de retrait et le point relais de tes achats, avec le compte qui a acheté. |
| Ce message, il est sur quel compte ? | Les conversations de tous tes comptes Vinted, chacune avec son compte. Tu réponds depuis VRM, sur ton ordinateur. |
| J’ai combien chez Vinted ? | L’argent en attente et l’argent disponible, compte par compte — jamais mélangés. |
| Je la mets aussi sur Leboncoin et eBay ? | Sans tout retaper : l’extension remplit l’annonce Leboncoin, et l’annonce eBay se crée depuis VRM. |
| Et sur mon téléphone ? | VRM s’ajoute à ton écran d’accueil : une notification à chaque vente si tu l’actives, un widget sur iPhone. |
| J’ai plusieurs comptes Vinted. | C’est fait pour, et un seul marche aussi : chacun se met à jour quand tu l’ouvres dans ton Chrome. |

- Si `DETOURAGE_POUR_TOUS` : une 7ᵉ entrée « Mes photos sur fond blanc ? — Tes
  photos sont détourées avant d'être attachées à ton annonce Leboncoin. » Elle
  n'est **pas rendue** tant que la constante vaut `false` (rien dans le DOM).

### 7.2 Section 5 — `#comment` : l'installation, puis la confiance (`data-section="comment"`)

Bande `surface`, deux colonnes sur ordinateur (installation à gauche, confiance
à droite), empilées sur téléphone.

**Colonne 1**
```
H2   Une installation, sur ton ordinateur. Ensuite, ton téléphone suffit.
1    Crée ton compte
     Un email et un mot de passe.[ Aucune carte bancaire.]        ← entre crochets : seulement si ACCES_OFFERT, porte [data-sans-carte]
2    Ajoute l’extension à Chrome
     EXTENSION_SUR_LE_STORE = false :
     Une seule fois, sur ton ordinateur. Elle n’est pas encore sur le Chrome Web Store : VRM te guide pas à pas, puis tu la connectes avec le même email.
     EXTENSION_SUR_LE_STORE = true :
     Une seule fois, sur ton ordinateur, depuis le Chrome Web Store. Puis connecte-la avec le même email.
3    Passe sur Vinted
     Avec chacun de tes comptes. Ventes, annonces, bordereaux et messages arrivent dans VRM.
```
Numéros dans des carrés de 28 px, rayon 8, fond `card2`, chiffres `text`,
**pas en bleu**. Rien ne bouge. **Aucune durée promise** (« deux minutes » n'a
jamais été mesuré).

**Colonne 2** (`[data-confiance]`)
```
H2   Tes comptes restent les tiens.
P1   VRM travaille comme toi : uniquement sur le compte ouvert dans ton Chrome, une action à la fois, jamais plus de 20 par heure.
P2   Il lit tes données et prépare le bordereau de ce que tu as déjà vendu ; vendre, publier, écrire à un acheteur, c’est toi qui le décides. Les automatismes — répondre aux questions des acheteurs, retirer d’eBay une annonce vendue ailleurs — restent éteints tant que tu ne les allumes pas.
P3   Et VRM refuse ce qui fait repérer un robot : relancer en série les personnes qui ont mis un article en favori, republier tes annonces en boucle, accepter une offre Vinted à ta place, supprimer une annonce.
```
- Les deux automatismes de P2 portent chacun `[data-automatisme]` (un `<span>`).
- P3 reste **visible** (pas dans un `<details>`) : le banc lit « favori » et
  « republi » dans le texte visible.
- La confiance est dite **une fois**, en positif d'abord. La FAQ y renvoie.

### 7.3 Section 6 — `#prix` et `#faq` (`data-section="prix"`)

Ordinateur : deux colonnes (la carte de prix à gauche, 440 px ; la FAQ à
droite). Téléphone : la carte, puis la FAQ.

**La carte de prix** (`card`, filet `line2`, rayon 12, `28px`)
```
H2       Un seul prix, et rien de caché.
puce     Gratuit pour l’instant                          ← seulement si ACCES_OFFERT, [data-acces-offert]
gros     9,99 €                                          ← PRIX_MOIS ; Space Grotesk 52 px (44 tél.), chiffres fixes
         par mois
ligne    Sans engagement · résiliable en ligne, depuis l’app
ligne    Tous tes comptes, toutes les fonctions.
texte    [Tant que l’abonnement n’est pas exigé, VRM reste gratuit. ]Aucun paiement ne te sera demandé sans que tu aies vu le prix et accepté les conditions générales de vente. Lire les CGV
         └ crochets : seulement si ACCES_OFFERT ; « Lire les CGV » = lien /legal/cgv.html
bouton   [ Créer mon compte › ]   pleine largeur
```
Le prix n'est écrit qu'**une fois** dans la carte (et une fois dans la ligne du
haut de page). La phrase ambiguë « tant que l'abonnement n'est pas activé »
disparaît.

**La FAQ** (`[data-faq]`, `<h2>Questions</h2>` en 28 px), `<details>` fermés :

| question | réponse |
|---|---|
| Vinted peut-il bloquer mon compte à cause de VRM ? | Personne ne peut garantir une décision de Vinted. VRM est conçu pour travailler comme toi, sans les automatismes qui font repérer un robot (voir « Tes comptes restent les tiens »). |
| C’est seulement pour les baskets ? | Non. Vêtements, sacs, livres… Le numéro de rangement, le bordereau, les ventes en double et la compta marchent pour n’importe quel article. |
| Et Vestiaire Collective ? | `VESTIAIRE_BRANCHE = false` : Pas encore : VRM apprend à lire Vestiaire, mais ne compte rien de ce site aujourd’hui. (Si `true` : la question disparaît, et Vestiaire rejoint le sous-titre et les écrans dans une passe à part.) |
| Comment j’arrête ? | Tu résilies en ligne, depuis l’app : l’abonnement s’arrête à la fin de la période payée. « Fermer mon compte » efface ensuite tes données, comme l’explique la politique de confidentialité. |
| Que deviennent mes données ? | Elles servent à faire marcher ta boutique, rien d’autre : VRM ne vend aucune donnée et ne fait pas de publicité. Lire la politique de confidentialité (lien). |

Ouverture : le « + » tourne de 45° en 200 ms (`sortie`) ; le contenu apparaît
en fondu d'opacité 150 ms, **sans** animer la hauteur. Ligne de 52 px.

### 7.4 Section 7 — la fin (`data-section="fin"`)

```
[petite feuille de bordereau dessinée, 220 × 132 (180 × 108 tél.), où se pose le tampon « N° 1 »]
Ton premier article aura le N° 1.                       ← 14 px muted, sous la feuille
H2      Demain matin, ouvre VRM.
Texte   Crée ton compte, ajoute l’extension sur ton ordinateur, passe sur Vinted : tu sauras quoi faire.
Bouton  [ Créer mon compte › ]      Déjà un compte ? Se connecter
```
- **Le seul moment « plaisir » de la page**, à l'endroit où il ne gêne rien :
  `ScenePremier` (`data-scene="premier"`, `DUREE = 0.9`), joue une fois quand
  la feuille est visible à 50 % : le tampon « N° 1 » (cadre `cta`) se pose —
  `scale(1.12→1)` en `retombe` 280 ms, anneau d'encre `accent` 420 ms. Moins de
  mouvement : tampon posé.
- C'est vrai : `prochainLibre` part de 1 (ou de la lettre suivie de 1 avec une
  série).
- Centré, la même lueur que le haut de page à 8 %. La page se ferme sur l'idée
  qui l'a ouverte.

### 7.5 Pied de page

Inchangé dans son contenu : logo 22 px, « © {année} VRM · VRM n’est pas affilié
à Vinted, Leboncoin ou eBay. », les cinq liens légaux (Mentions légales, CGU,
CGV, Confidentialité, Cookies), et la ligne Contact lue dans `src/contact.js`
(`<a data-contact href="mailto:…">` si posée, sinon
`<span data-contact data-contact-absent>Contact : {CONTACT_A_VENIR}</span>`).
Texte `faint` (#8A93A3), liens `muted`.

---

## 8. La barre du haut et le fil de la journée

### 8.1 La barre (`header.acc-nav`, collante)

- Fond **transparent** en haut de page. Une sentinelle de 1 px en haut du
  `<main>`, observée par `IntersectionObserver` (pas d'écouteur de défilement) :
  dès 8 px de défilement, fond `rgba(7,9,13,.78)`, `backdrop-filter:
  saturate(1.4) blur(14px)`, filet `line` en bas ; transition
  `background-color, border-color` 200 ms `ease`.
  `@media (prefers-reduced-transparency: reduce)` : fond `#07090D` plein, pas de
  flou.
- Contenu : logo + « VRM » ; liens d'ancre (ordinateur ≥ 900 px) **Colis ·
  Vendu ailleurs · URSSAF · Prix · Questions** (`#colis`, `#ailleurs`, `#urssaf`,
  `#prix`, `#faq`) ; à droite « Se connecter » (`acc-lien`,
  `data-cta-nav="connexion"`) **toujours visible, y compris à 390 px** ; puis
  « Créer mon compte » (`acc-btn acc-p`, 38 px, `data-cta-nav="inscription"`).
- « Créer mon compte » de la barre n'apparaît **que si** le bouton du haut de
  page est sorti de l'écran (`IntersectionObserver` sur
  `.acc-hero [data-cta="inscription"]`) : `opacity 0→1`, `translateY(4px)→0`,
  180 ms, `sortie` ; il repart en 150 ms quand le bouton du haut revient.
  Caché : `opacity: 0`, `pointer-events: none`, `tabIndex = -1`,
  `aria-hidden="true"`. Un seul bouton principal visible à la fois.
- Hauteur 64 (56 tél.), `padding-top: env(safe-area-inset-top)`.

### 8.2 Le fil de la journée (ordinateur ≥ 1 280 px seulement)

Un filet vertical d'1 px (`line2`) dans la marge gauche
(`left: calc(50% − 590px − 48px)`), de la section 1 à la fin de la section 3,
avec trois repères alignés sur les horodatages : « 8 h 02 », « 8 h 03 », « Fin
du mois » (13 px `muted`). Le segment de chaque section se remplit avec le
défilement, **en CSS seul** :

```css
@supports (animation-timeline: view()) {
  .acc-fil-seg i { transform-origin: top; animation: accRemplit linear both;
    animation-timeline: view(); animation-range: entry 20% cover 55%; }
}
@keyframes accRemplit { from { transform: scaleY(0) } to { transform: scaleY(1) } }
@media (prefers-reduced-motion: reduce) { .acc-fil-seg i { animation: none; transform: none } }
```
Sans `animation-timeline`, ou avec moins de mouvement : le filet est plein,
immobile. Zéro JS. Le remplissage est `text` à 40 % (pas d'accent).

---

## 9. Le budget de hauteur

Chaque section porte `data-section`. Le banc les mesure et imprime le tableau.

| section | téléphone (390) max | ordinateur (1512) max |
|---|---|---|
| barre | 56 | 64 |
| haut de page (`hero`) | 900 | 780 |
| `colis` | 660 | 600 |
| `ailleurs` | 570 | 600 |
| `urssaf` | 550 | 580 |
| `questions` | 560 | 460 |
| `comment` | 590 | 480 |
| `prix` (prix + FAQ) | 780 | 540 |
| `fin` | 380 | 300 |
| pied | 160 | 120 |
| **total** | **≤ 5 000** (aujourd'hui 7 338) | **≤ 4 600** (aujourd'hui 4 477) |

Espacements de section : 32 px en haut et en bas sur téléphone, 64 px sur
ordinateur.

**Si le téléphone dépasse 5 000 px une fois construit, couper dans cet ordre,
et rien d'autre :**
1. vérifier que les précisions des sections 1 à 3 sont bien cachées sous 760 px ;
2. réduire les réponses des petites questions à une ligne et demie ;
3. retirer « Et sur mon téléphone ? » et ajouter à la ligne 2 du haut de page
   « …ton téléphone suffit, avec une notification à chaque vente. » ;
4. retirer « Comment j'arrête ? » de la FAQ et ajouter à la carte de prix
   « « Fermer mon compte » efface tes données. » ;
5. cacher le texte de la fin sous 760 px.

**Ne jamais couper** : la pastille, le H1, le sous-titre, les deux lignes du
haut, la carte « Aujourd'hui », les trois écrans dessinés, la phrase « favori /
republier » de la confiance, la carte de prix.

---

## 10. Le film « Une journée avec VRM »

### 10.1 L'intention

Un vrai film de motion design, muet et lisible sans le son (lecture automatique
sur les réseaux). Trois actes :
1. **la galère**, en typographie animée ;
2. **tout est aspiré dans VRM**, et la carte « Aujourd'hui » joue ;
3. **les trois questions**, qui **restent à l'écran** pendant leur réponse
   (elles rétrécissent en légende), avec l'horloge qui roule de 8 h 01 à
   8 h 02, 8 h 03, puis « 31 octobre ».

Trois règles de signature :
- **Jamais de passage par le noir** : on passe d'un plan au suivant en suivant
  un **élément commun** (la ligne « Colis à poster » → la question ; le « 128 »
  du carton → la tuile Vinted ; les « 85,00 € » de la tuile → la pastille
  « versé »).
- **Une seule chose bouge à la fois**, sauf la lente avancée de caméra du plan 6.
- **Aucun prix d'abonnement** (« 9,99 € », « gratuit ») : une vidéo publiée ne
  se met pas à jour. Elle renvoie à vrm.center. Ni Vestiaire, ni détourage.

Le film **n'a pas** de « réduire les animations » : c'est une vidéo.

### 10.2 Technique

- `src/AccueilFilm.jsx`, chargé seulement avec `?film`. Il importe `CarteJour`,
  les scènes (`accueil-scenes.jsx`), `DEMO`, le moteur. Il n'utilise **pas**
  `useScene` : chaque scène reçoit un temps `s` calculé à partir du temps du
  film `t` (« carte du temps » par plan, §10.4).
- `window.__filmT(secondes)` fixe le temps ; `window.__filmDuree` vaut **35**
  (`?film`) ou **15** (`?film=court`). Le plan courant est exposé :
  `[data-film-plan="ouverture|galere|carte|q1|colis|q2|ailleurs|q3|mois|reste|fin"]`
  sur la racine, et `window.__filmPlan`.
- **Fonction pure du temps** : le même `t` donne la même image. Les mesures
  (positions des cibles) sont prises une fois par mise en page.
- **La scène** : un plateau de taille fixe (paysage 1920 × 1080, portrait
  1080 × 1920 — choisi selon que la fenêtre est plus large que haute), mis à
  l'échelle de la fenêtre (`min(largeur / 1920, hauteur / 1080)` ; exactement 1
  à l'export), fond `bg` + lueur radiale `rgba(61,123,255,.14)` immobile. Les
  écrans de la page y sont posés à l'échelle `k` (paysage ×1,6, portrait ×1,9 en
  variante `compact`) : aucun texte d'interface sous 20 px.
- **La caméra** : `camera(t) → { x, y, s }`, posée en `transform` sur le
  plateau, interpolée entre des positions clés avec `trajet`. Les cibles sont
  des éléments marqués `data-cible="ligne-colis|tampon|carton|trait|ebay|total"`,
  mesurés. Pas de `will-change` dans le film (le texte resterait flou une fois
  agrandi).
- **Les titres** : Space Grotesk 600, 64 px (paysage) / 72 px (portrait),
  −0,02 em, deux lignes au plus. Entrée **mot par mot** : 45 ms d'écart, chaque
  mot opacité 0→1, `translateY(18px→0)`, `blur(6px→0)`, 420 ms, `sortie`.
  Sortie d'un bloc : opacité → 0, `translateY(-8px)`, 220 ms. **Jamais deux
  titres à l'écran** (la légende rétrécie n'est pas un titre : 28 px, `muted`).
- **L'horloge** : Space Grotesk 700, 120 px, chiffres fixes, `text`. Un chiffre
  qui change monte (`translateY(-40%)`, opacité → 0, 200 ms) et le nouveau
  arrive d'en bas (220 ms, `sortie`). Passage à la date : fondu enchaîné avec
  `blur(2px)`, 300 ms.
- **La légende** : la question rétrécit (`scale(.45)`) et file en haut à gauche
  (`translate`), 600 ms, `trajet` ; elle y reste à 60 % d'opacité pendant la
  réponse, puis s'efface en 200 ms au plan suivant.
- 60 images par seconde (les avancées de caméra saccadent à 30). Grille de
  rythme de 0,5 s (120 battements par minute) : chaque début de plan tombe sur
  la grille, pour qu'une musique s'y pose plus tard (choix de Julien, et
  question de droits).

### 10.3 La version longue : 35,0 s (paysage 1920 × 1080 et portrait 1080 × 1920)

| # | `data-film-plan` | t (s) | ce qu'on voit | mouvement |
|---|---|---|---|---|
| P0 | `ouverture` | 0,0–2,0 | Fond `bg`. Un trait `accent` d'1 px se dessine du centre vers les bords (0,2–0,9). Le logo VRM (`/logo-vrm-192.png`, 180 px) apparaît là où était le trait (0,9–1,5), le trait s'efface. | trait `scaleX(0→1)` 700 ms `trajet` ; logo `scale(.96→1)`, `blur(8px→0)`, opacité, 600 ms `sortie` ; tenue 0,5 s |
| P1 | `galere` | 2,0–5,5 | Le logo monte et rétrécit à 56 px en haut (2,0–2,5). Trois temps, une ligne chacun, centrés : **« Vinted, Leboncoin, eBay. »** (2,0–3,0) — derrière, sept onglets fantômes dérivent à 35 % (« Vinted · Perso », « Vinted · Boutique », « Leboncoin », « eBay », « Suivi colis », « Messages », « Tableur compta ») ; **« Des colis à poster. »** (3,0–4,0) — six cartons **sans numéro** tombent, un peu de travers ; **« Une déclaration à faire. »** (4,0–5,0) — une feuille aux lignes vides, « à déclarer : ? € ». La ligne précédente baisse à 35 % quand la suivante arrive. | logo 500 ms `trajet` ; lignes : mot par mot ; onglets : apparition 60 ms d'écart, dérive `lineaire` 4 px/s ; cartons : `translateY(-30px→0)` + opacité, 50 ms d'écart, 400 ms `sortie`, rotations fixes −8° à +8° ; les trois lignes sortent ensemble à 5,0 (`scale(.98)`, opacité, 250 ms) |
| P2 | `carte` | 5,5–9,0 | **Tout est aspiré au centre** (5,5–6,1) : onglets, cartons et feuille filent vers le centre en rétrécissant. Là, la carte « Aujourd'hui » **se matérialise** (5,8–6,4). Au-dessus : **« Tu ouvres VRM. »** (6,0–6,5). La carte joue sa vente (sans ses onglets : l'aspiration a déjà raconté l'histoire). À 8,4 : **« Tu sais quoi faire. »** sous la première ligne. | aspiration : `translate` + `scale→.3` + opacité → 0, 600 ms `trajet`, 30 ms d'écart ; carte : `scale(.94→1)`, `blur(10px→0)`, opacité, 600 ms `sortie` ; temps de la carte : `sCarte = 1,1` pendant la matérialisation, puis `sCarte = 1,1 + (t − 6,4)` (notification à 6,5, vols 7,05 et 7,75) |
| P3 | `q1` | 9,0–10,5 | **Raccord** : la caméra avance sur la ligne « Colis à poster · 3 » (9,0–9,6, ×1 → ×2,2) ; la carte se floute et s'efface (9,4–9,8). L'horloge « 8 h 01 » apparaît en haut au centre (9,5) et roule vers **« 8 h 02 »** (9,75–10,15). **« Quels colis je poste ce matin ? »** arrive mot par mot (9,85–10,35). | caméra `trajet` ; carte `blur(0→8px)` + opacité ; horloge et titre comme §10.2 |
| P4 | `colis` | 10,5–15,5 | La question devient légende (10,5–11,1). `SceneColis` monte d'en bas (10,6–11,2). Elle joue : `s = t − 11,2` jusqu'à 14,0 (le tampon se pose à 13,98). **La caméra avance sur le tampon** (13,9–14,5, ×1 → ×1,7) et **tient** (le temps de la scène reste figé à 2,8 jusqu'à 14,8). Puis la caméra glisse vers le carton 128 (14,8–15,4, ×1,7 → ×1,4) pendant que la scène reprend (`s = 2,8 + (t − 14,8)` : le carton sort à 15,1). En même temps, un clone du « 128 » du tampon **voyage** jusqu'à l'étiquette du carton (14,8–15,5). | scène : `translateY(40px→0)` + opacité, 600 ms `sortie` ; caméra `trajet` ; voyage du 128 : 700 ms, X `trajet`, Y `sortie` |
| P5 | `q2` | 15,5–17,0 | **Raccord sur le 128** : la caméra pousse sur l'étiquette « Carton 128 » (15,5–15,9, ×1,4 → ×2,4) ; la scène se floute et s'efface (15,7–16,1) ; **le « N°128 » reste**, grossit en une puce de 72 px (contour `accent`) à gauche du centre. La légende s'efface. L'horloge roule vers **« 8 h 03 »** (15,9–16,3). **« Vendu sur Vinted… encore en ligne sur Leboncoin ? »** (16,1–16,7, deux lignes). | comme P3 |
| P6 | `ailleurs` | 17,0–22,0 | La question devient légende (17,0–17,6). `SceneAilleurs` entre (17,1–17,7, `s` tenu à 0,45 : tuiles posées). La puce « N°128 » **se pose** dans l'identité de la tuile Vinted (17,6–18,2) : la scène reçoit `identExterne` et ne dessine pas ce « N°128 » avant l'arrivée de la puce, qui prend sa place. Puis la scène joue (`s = 0,45 + (t − 18,2)`). Caméra : lente avancée ×1 → ×1,04 sur tout le plan (`lineaire`) ; avancée nette sur le trait (18,75–19,35, ×1,25), recul (19,6–20,1) ; sur la tuile eBay pendant la bulle (20,1–20,5, ×1,2). | puce : 600 ms, X `trajet`, Y `sortie` |
| P7 | `q3` | 22,0–23,5 | **Raccord sur les 85,00 €** : le prix de la tuile Vinted se détache et file au centre (22,0–22,5) ; la scène se floute et s'efface (22,1–22,5). L'horloge **devient une date** : « 8 h 03 » → **« 31 octobre »** (22,4–22,8, fondu enchaîné avec flou). **« Combien je déclare à l'URSSAF ? »** (22,7–23,2). | comme P3 |
| P8 | `mois` | 23,5–28,0 | La question devient légende (23,5–24,1). `SceneMois` entre (23,6–24,2, `s = min(0,5, t − 23,6)` : carte posée, pastille pas encore là). **Les « 85,00 € » deviennent la pastille « +85,00 € · N°128 · versé »** (24,0–24,4 : fondu enchaîné du texte, la puce s'élargit par `clip-path`) ; la scène reçoit `pastilleExterne` et ne dessine pas sa propre entrée de pastille. Elle reprend à `s = 0,9 + (t − 24,4)` : la pastille plonge (24,55), le total roule (24,75–25,55). Caméra : avancée sur le total (24,6–25,2, ×1,5), tenue jusqu'à 25,8, recul (25,8–26,3). Le curseur coche « J'ai déclaré ce mois » (26,3–27,1). Tenue jusqu'à 28,0. | comme dans la page |
| P9 | `reste` | 28,0–30,5 | La légende s'efface ; la carte du mois recule (`scale(.96)`, opacité, 300 ms). **« Et tout le reste. »** (28,1–28,5). Quatre cartes s'assemblent en grille 2 × 2 (28,2–29,3) : « Code de retrait · 4821 73 · Relais du Marché » · « Messages · 4 non lus · Perso, Boutique » · « Chez Vinted · 212,40 € en attente · 96,00 € disponibles » · « Nouvelle vente · Vinted · Boutique · Sac Longchamp Le Pliage — 45,00 € ». Tenue jusqu'à 30,5. | cartes : `translateY(16px→0)` + opacité, 500 ms `sortie`, 150 ms d'écart |
| P10 | `fin` | 30,5–35,0 | Les cartes reculent (30,5–30,8). Le logo revient au centre (30,8–31,3, 120 px). **« Tu ouvres VRM. »** en `muted` (31,3–31,7), **« Tu sais quoi faire. »** en `text` (31,6–32,0) — les deux tons du H1. **« vrm.center »** en 40 px `text` (32,2–32,6), et dessous « Crée ton compte » en 24 px `muted`. **Tenue de 2,4 s, rien ne bouge**, pour qu'on lise l'adresse. | logo `scale(.96→1)`, `blur(6px→0)` ; textes mot par mot |

### 10.4 Le format portrait (1080 × 1920)

- Mêmes plans, mêmes temps.
- Titres et horloge dans la bande haute (de 12 % à 28 % de la hauteur). La
  légende se range en haut à gauche, sous une marge de sécurité de 8 %.
- Écrans entre 32 % et 80 % de la hauteur, en variante `compact`, échelle ×1,9.
- **Rien d'important dans les 20 % du bas** (les réseaux y posent leurs
  boutons), sauf la carte de fin, centrée.
- P4 : les cartons sont sous la tuile ; la caméra glisse vers le bas.
- P6 : tuiles empilées, le trait descend.
- P9 : grille 2 × 2 sur la largeur.

### 10.5 La version courte (`?film=court`) : 15,0 s

| t (s) | plan | contenu |
|---|---|---|
| 0,0–1,2 | `ouverture` | trait (0,1–0,5) puis logo (0,5–1,0) |
| 1,2–4,5 | `carte` | la carte se matérialise (1,2–1,7) avec « Tu ouvres VRM. » ; elle joue (`sCarte = 1,1 + (t − 1,7)`) ; « Tu sais quoi faire. » à 3,7 |
| 4,5–5,5 | `q1` | « 8 h 02 » (fixe, sans roulement) et la question |
| 5,5–9,5 | `colis` | `s = (t − 5,9) × 1,2` ; avancée sur le tampon à 8,2–8,7 ; on ne montre pas le carton |
| 9,5–10,3 | `q2` | « 8 h 03 » et la question |
| 10,3–12,8 | `ailleurs` | `s = 0,5 + (t − 10,3) × 1,5` (jusqu'à « Retirée d'eBay ✓ ») |
| 12,8–15,0 | `fin` | logo, « vrm.center », « Crée ton compte » ; tenue 1,4 s |

Fait pour les « stories » : produit par défaut en portrait seulement.

### 10.6 Ce que le film ne montre jamais

Aucun prix d'abonnement, « gratuit », « offert » ; aucun « Vestiaire » ;
aucun « Photoroom » ni « détour » ; aucun pseudo, aucune adresse email ; aucun
logo de plateforme ou de transporteur (des noms en texte et des points).

### 10.7 Le rendu dans la page `?film`

`document.body.style.background = K.bg` ; aucun accès réseau ; aucune requête en
base ; aucune barre de défilement. `__filmT` doit pouvoir être appelé dans
n'importe quel ordre (on n'accumule aucun état entre deux images).

### 10.8 `scripts/film-accueil.cjs`

- `IPS` par défaut **60** (`IPS=30` reste possible).
- `FILMS=long,court` (défaut les deux). Formats : `long` en
  `paysage,portrait` ; `court` en `portrait` (`FORMATS_COURT=paysage,portrait`
  pour les deux).
- Navigue vers `/?film` ou `/?film=court`, attend `__filmT` et `__filmDuree`,
  puis `document.fonts.ready`, et rend `round(duree × IPS)` images.
- Sorties : `vrm-film-1920x1080.mp4`, `vrm-film-1080x1920.mp4`,
  `vrm-film-court-1080x1920.mp4` (H.264, CRF 20, `yuv420p`, `+faststart`).
- **Les MP4 ne montent jamais dans le dépôt.** Durées à reporter dans
  CLAUDE.md : 35 s et 15 s (il dit encore 25,2 s ; l'ancien film durait
  31,2 s).

---

## 11. Le registre des promesses (chaque phrase ↔ le code)

À vérifier avant de livrer ; une ligne qui ne tient plus se retire de la page.

| la page dit ou montre | où c'est vrai | la limite, dite sur la page |
|---|---|---|
| plusieurs comptes Vinted, Leboncoin et eBay au même endroit | `vinted_accounts`, onglets Leboncoin et eBay de l'app | « chacun se met à jour quand tu l'ouvres dans ton Chrome » |
| bordereau avec le titre et le numéro imprimés | `annotateAndDownloadBordereau` (Vinted ; Leboncoin depuis la 5.136) | — |
| VRM « prépare » le bordereau de ce qui est vendu | `genererBordereauxEnAttente` (extension, à la visite sur Vinted) | dit tel quel dans la confiance (P2), jamais « rien ne part sans ton clic » |
| « Tout imprimer », un par feuille, A4 ou thermique | `Tout imprimer (${n})`, `posePrefsImpression`, `zoneEtiquette` | — |
| « Générer le bordereau » | `BoutonBordereau`, commande de l'extension | montré sur une vente **Vinted** (pas Leboncoin) |
| numéro jamais redonné ; chiffres ou série | pool append-only, `prochainLibre`, `cleNum` | — |
| « Ton premier article aura le N° 1 » | `prochainLibre` part de 1 | (avec une série : B1) |
| vendue ici → à retirer ailleurs, par le numéro | `doublesVenteEbay` (SKU `VRM-n`), `doublesVenteLbc`, « à retirer de Leboncoin » | Vinted et Leboncoin : c'est lui qui retire |
| retirer d'eBay d'un clic, avec confirmation | `retirer` → `askConfirm` « Oui, retirer d'eBay », « sans retour côté eBay » | la bulle reprend ce texte |
| relier une annonce d'un clic | « Relier à une paire » (eBay), `relierAnnonceLbc` | — |
| les conversations de tous les comptes, répondre depuis VRM | messagerie 5.135, `executerPourApp` | « sur ton ordinateur » ; Vinted seulement |
| codes de retrait et point relais, avec le compte | `codeRetrait`, `relaisDe`, `capterRetraits` | (un code absent est montré absent dans l'app) |
| argent en attente et disponible, séparés | `harvest_*_billing` (`escrow` / `main`) | — |
| Leboncoin « sans tout retaper », eBay depuis VRM | `publierDepuisApp` + `lbc.js` (remplissage), `EbayPublier` | jamais « publie » tout court pour Leboncoin |
| chiffre à déclarer toutes plateformes ; Vinted au versement, Leboncoin et eBay au jour de la vente | `ventesDeclarables` | jamais « encaissé » ; aucun taux affiché |
| « J'ai déclaré ce mois » ; une vente notée ne se recompte pas | `vrm_urssaf_declare`, `declarerMois` | — |
| rapport du mois en PDF et tableur | rapport comptable (écran, CSV, PDF) | — |
| notification à chaque vente, widget iPhone, écran d'accueil | `api/push`, `api/widget`, la PWA | « si tu l'actives » |
| compte ouvert dans Chrome, une action à la fois, ≤ 20 par heure | `garde`, `requeteVinted`, plafond de 20 actions/h | — |
| automatismes éteints par défaut | `vinted_repond_auto`, `vrm_ebay_retrait_auto` | nommés tous les deux |
| refus : favoris en série, republication, accepter une offre Vinted, supprimer | CLAUDE.md §3 | — |
| aucun mot de passe Vinted | l'extension travaille dans le navigateur connecté | — |
| 9,99 € par mois, sans engagement, résiliable en ligne ; gratuit tant que non exigé | `public/legal/cgv.html` | `ACCES_OFFERT` |
| « Fermer mon compte » efface les données | `api/compte.js` mode `fermer` | « comme l'explique la politique » |

**Ce que la page ne dit pas, exprès** : « en direct », « à jour dès que tu
ouvres le site », « aucun colis oublié », « aucune double vente » (résultats non
garantis) ; « rien ne part sans ton clic » / « rien n'est envoyé à ta place »
(faux : génération automatique des bordereaux, et deux automatismes qui
existent) ; « accepte tes offres » ; « encaissé » ; un taux URSSAF ; « deux
minutes » ; « gratuit pendant le lancement » et « tu seras prévenu avant d'être
prélevé » (écrits nulle part) ; Vestiaire comme plateforme branchée ; le
détourage Photoroom (réservé au propriétaire tant que `PHOTOROOM_POUR` ne vaut
pas `tous`) ; le sens de « VRM » (on ne l'invente pas) ; un nombre de vendeurs,
des étoiles, des avis.

---

## 12. Le banc, l'audit, les preuves

### 12.1 Le contrat d'attributs (ce que le banc lit, jamais des phrases)

| attribut | où | valeurs |
|---|---|---|
| `data-accueil` | racine de la page | — |
| `data-definition` | la pastille | — |
| `data-cta="inscription|connexion"` | **dans `.acc-hero`** (et dans la carte de prix / la fin pour `inscription`) | — |
| `data-cta-nav="inscription|connexion"` | dans `.acc-nav` | — |
| `data-acces-offert`, `data-sans-carte` | phrases conditionnées par `ACCES_OFFERT` | absentes du DOM si `false` |
| `data-prerequis` + `data-variante` | ligne 2 du haut de page | `souris` / `tactile` |
| `data-demo-animee` + `data-etat` | la carte « Aujourd'hui » (une seule sur la page) | `debut`, `onglets`, `vente`, `fin` |
| `data-notif`, `data-vol` | notification, clones en vol | présents seulement pendant le déroulé |
| `data-vers` | lignes de la carte | `colis`, `ailleurs`, `questions`, `urssaf` |
| `data-scene` + `data-etat` (+ `data-pret`) | les écrans dessinés | `colis`, `ailleurs`, `urssaf`, `premier` ; `debut`, `joue`, `fin` |
| `data-revoir` | « ↻ Revoir » | — |
| `data-curseur` | le curseur dessiné | présent seulement pendant un geste de l'utilisateur |
| `data-bordereau`, `data-tampon`, `data-carton="128"` + `data-sorti` | écran Colis | — |
| `data-ident` | identités de l'écran Ailleurs | — |
| `data-total` | total de l'écran Mois | — |
| `data-confiance`, `data-automatisme` | section 5, colonne 2 | — |
| `data-faq` | la FAQ | — |
| `data-section` | chaque section | `hero`, `colis`, `ailleurs`, `urssaf`, `questions`, `comment`, `prix`, `fin` |
| `data-contact` (+ `data-contact-absent`) | pied de page | inchangé |
| `data-film-plan` | racine du film | §10.2 |
| `data-cible` | cibles de la caméra du film (sur la ligne « Colis à poster » de la carte, le tampon, le carton 128, le trait, la tuile eBay, le total) | `ligne-colis`, `tampon`, `carton`, `trait`, `ebay`, `total` |

### 12.2 `scripts/bancs/accueil.cjs` — ce qu'on GARDE tel quel

La page s'affiche · aucun écran tombé · aucune erreur de page · aucun
débordement · aucun `App-*` téléchargé · aucune lecture en base · cinq liens
légaux qui existent · ligne Contact lue dans `src/contact.js` · barre collante
(`top` à 0 après défilement) · les deux boutons `.acc-hero [data-cta=…]` ouvrent
le bon formulaire, l'adresse le dit, le retour arrière ramène · le lien de
retour depuis la connexion · aucun éclair de page d'accueil avec une session,
`?code`, `#access_token`, `?tab` · prix = CGV et jamais « 0 € » ·
« sans engagement » et « résili » · aucun chiffre de clientèle ni étoile ·
« aucune donnée revendue » appuyé sur la politique · « favori » et « republi »
visibles. Garde la règle « un banc ne meurt pas, il rapporte » (`essaie`) et le
port 4523.

### 12.3 Ce qu'on REMPLACE, puis ce qu'on AJOUTE

**Retirés** (ils décrivaient le carrousel) : « les scènes s'enchaînent toutes
seules » (`[aria-live]` qui change en 6,2 s), « la barre de progression mène à
la scène choisie » (`Voir : Tes chiffres`), « réduire les animations : immobile
puis on change de scène à la main » (`Voir : Le bordereau`).

**Ajoutés** — chacun juge ce qui est **rendu**, aux deux tailles quand c'est
pertinent (1512 × 900 ; 390 × 844 `isMobile`, `hasTouch`) :

1. **La carte vit, puis s'arrête.** `[data-demo-animee]` passe par `onglets`,
   `vente`, et atteint `fin` en moins de 8 s après le chargement ; un
   `[data-notif]` et au moins deux `[data-vol]` ont été vus (`MutationObserver`
   posé par `addInitScript`). Il n'y a qu'**un** `[data-demo-animee]`.
2. **Aucune boucle.** `requestAnimationFrame` compté (`addInitScript` qui
   l'enveloppe) : une fois la carte à `fin` et aucune scène à `joue`, au plus
   2 appels en 1,5 s.
3. **Moins de 5 s.** Pour la carte et chaque scène : (instant de `fin`) −
   (premier instant de `onglets` / `joue`) ≤ 5,0 s.
4. **Grammaire du curseur.** Jamais de `[data-curseur]` dans `[data-demo-animee]`
   pendant tout le déroulé ; au moins une fois dans `[data-scene="colis"]`
   pendant sa lecture.
5. **Chaque écran ne joue que s'il est vu.** Au chargement, les trois
   `[data-scene]` valent `debut` ; après `scrollIntoView` de l'un, il passe à
   `joue` puis `fin` en ≤ 6 s, les deux autres restent `debut`. Un clic sur
   son `[data-revoir]` le ramène à `debut` ou `joue`, puis `fin`.
6. **Le numéro voyage.** En `fin` : `[data-bordereau] [data-tampon]` contient
   « 128 » ; la ligne de la Nike garde son badge « 128 » ;
   `[data-carton="128"]` porte `data-sorti="1"` ; aucun autre carton ne l'a.
7. **Les chiffres tiennent.** En `fin` de `[data-scene="urssaf"]`, le nombre lu
   dans `[data-total]` vaut `DEMO.mois.apres` (le banc lit `src/accueil-demo.js`
   par `import()`) ; en `fin` de la carte, la ligne `[data-vers="colis"]`
   affiche `DEMO.jour.colisApres` et `[data-vers="ailleurs"]`
   `DEMO.jour.aRetirerApres`.
8. **Moins de mouvement** (`reducedMotion: 'reduce'`) : carte et scènes à `fin`
   dès que montées, sans défiler ; **jamais** de `[data-notif]`, `[data-vol]`,
   `[data-curseur]` ; rien ne change en 5 s ; les états finaux du 6 et du 7 sont
   là ; « Retirée d'eBay » et « À retirer » sont dans `[data-scene="ailleurs"]`.
9. **La carte sert de sommaire.** Un clic sur `[data-vers="colis"]` amène le
   haut de `#colis` entre 0 et 40 % de la hauteur de l'écran (attendre 1,2 s) ;
   pareil pour `ailleurs` et `urssaf`.
10. **Le premier écran porte tout**, sans défiler, aux deux tailles :
    `[data-definition]` visible et contenant « revendeurs » ; le haut de
    `[data-demo-animee]` au-dessus du bas de l'écran ; un montant « par mois »
    égal à celui des CGV, visible ; `[data-prerequis]` visible et contenant
    « ordinateur ». À 390 × 844 : le bas de `[data-vers="ailleurs"]` ≤ 844.
11. **La bonne variante du prérequis** : `tactile` dans le contexte téléphone
    (`isMobile` + `hasTouch`), `souris` à 1512.
12. **`ACCES_OFFERT` suivi** : le banc lit la constante dans
    `src/accueil-reglages.js` ; `true` ⇒ `[data-acces-offert]` visible dans le
    premier écran et `[data-sans-carte]` présent ; `false` ⇒ aucun des deux dans
    le DOM.
13. **Lisible.** Dans `[data-demo-animee]` et chaque `[data-scene]` en `fin`, la
    plus petite police **rendue** (taille calculée × échelle cumulée des
    ancêtres, mesurée par `getBoundingClientRect().height / offsetHeight`) est
    ≥ 12 px, et l'échelle vaut 1.
14. **Contraste.** Texte du bouton principal sur son fond ≥ 4,5:1 (couleurs
    calculées). Tout texte visible hors écrans dessinés ≥ 4,5:1 sur son fond
    réel (premier ancêtre au fond non transparent).
15. **L'accent est rare.** Dans le premier écran, hors `[data-demo-animee]`, au
    plus **2** éléments visibles (opacité > 0,1) dont la couleur ou le fond
    calculé vaut `rgb(36,88,230)` ou `rgb(61,123,255)`.
16. **Ambre et plateformes hors du cadre.** Hors `[data-demo-animee]` et
    `[data-scene]` : aucun élément visible coloré `#FFB23E`, `#12B7BE`,
    `#F56B2A` ou `#86B817`.
17. **Longueur.** `scrollHeight` ≤ 5 000 à 390 px et ≤ 4 600 à 1512 px ; le
    banc imprime la hauteur de chaque `[data-section]` et la compare au §9
    (au-delà : rouge, avec le nom de la section).
18. **« Se connecter » reste joignable** : à 390 px, après défilement de
    3 000 px, `.acc-nav [data-cta-nav="connexion"]` est visible (rect dans
    l'écran, `display` non `none`).
19. **Un seul bouton principal à la fois** : à `scrollY = 0`,
    `.acc-nav [data-cta-nav="inscription"]` a une opacité de 0 et
    `tabIndex = -1` ; après 1 500 px de défilement, opacité 1 et focusable.
20. **Rien qui ne soit branché.** Texte rendu de `[data-demo-animee]` et des
    `[data-scene]` : ni « Vestiaire », ni « À publier », ni « encaissé », ni
    « Photoroom », ni « détour ». Dans toute la page : « Vestiaire » seulement
    dans `[data-faq]` ; « Photoroom » et « détour » absents tant que
    `DETOURAGE_POUR_TOUS` vaut `false` (lu dans le fichier).
21. **Les deux fausses phrases mesurées le 11 octobre ne reviennent pas** :
    aucun `/rien ne part sans ton clic|rien n['’]est envoyé à ta place/i`,
    aucun `/(deux|2) minutes/i`, aucun `publi\w*` suivi de « Leboncoin » à moins
    de 40 caractères dans la même phrase. Et `[data-confiance]` contient
    exactement deux `[data-automatisme]`.
22. **Poids.** Le fichier d'entrée (nommé par `dist/index.html`) ≤ 26 Ko gzip ;
    `accueil-scenes-*.js` ≤ 20 Ko ; `AccueilFilm-*.js` ≤ 25 Ko. Sur `/`, aucun
    `AccueilFilm-*` téléchargé.
23. **Le film.** `/?film` : `__filmDuree === 35`, aucun `App-*`, `AccueilFilm-*`
    téléchargé ; `__filmT(12)` ⇒ `[data-film-plan="colis"]` ; `__filmT(0.5)`,
    `__filmT(6)`, `__filmT(20)`, `__filmT(33)` ⇒ `ouverture`, `carte`,
    `ailleurs`, `fin`. `/?film=court` : `__filmDuree === 15`.
    **Jamais de noir** : à 640 × 360, une capture toutes les 0,5 s de 1,0 à
    34,5 s (avant 1,0 s, seul le trait d'1 px est dessiné) ; dans chacune, plus de 0,5 % des pixels diffèrent du fond de plus
    de 24 niveaux. **Fonction pure** : `__filmT(17.3)`, puis `__filmT(4)`, puis
    `__filmT(17.3)` donnent deux captures identiques (empreinte). **Rien
    d'interdit** : aux mêmes instants, le texte rendu ne contient ni `9,99`, ni
    « par mois », ni « gratuit », ni « offert », ni « Vestiaire », ni
    « Photoroom », ni « @ ».

Ces contrôles tournent avec une page servie comme aujourd'hui (serveur maison,
`dist/` déduit de `__dirname`, routes `supabase.co` et `/api/` qui répondent
`[]` et comptent les lectures, tout autre hôte coupé).

### 12.4 `scripts/audit-accueil-demo.cjs` (nouveau)

Importe `src/accueil-demo.js` (`await import(pathToFileURL(...))` : le
`package.json` est en `"type": "module"`) et exige :
- `mois.avant + vente.prix === mois.apres` ; `mois.vintedAvant + vente.prix ===
  mois.vinted` ; `mois.vintedAvant + leboncoin + ebay === avant` ;
  `vinted + leboncoin + ebay === apres` ; `ventesAvant + 1 === ventesApres`
  (comparaisons en centimes entiers) ;
- `jour.colisApres === colis.length` ; `jour.colisAvant === colis.length − 1` ;
  `jour.urgents === colis.filter(c => c.urgent).length` ;
  `jour.aRetirerApres === vente.ailleurs.length` ;
- `jour.recu < mois.avant` (le matin, moins qu'en fin de mois) ;
- `colis` contient un article de `n === vente.n`, et `stock` contient `vente.n` ;
- aucun nom de compte hors de `['Perso', 'Boutique', 'Leboncoin', 'eBay']` ;
  aucune chaîne qui contient `@` ; aucun montant à 0 ;
- `PLATEFORMES.ebay.point` est à une distance RVB > 120 de `#3D7BFF` et de
  `#2458E6`.
Chaque règle réaffaiblie seule doit le faire passer au rouge.

### 12.5 Les preuves (§6.1 du dossier)

- **Rouge sur le build d'avant** : `git archive HEAD | tar -x -C /tmp/avN`,
  `npm ci && npm run build` dedans, copier le **nouveau** banc dans
  `/tmp/avN/scripts/bancs/`, le lancer **depuis cet arbre**. Attendu rouge sur
  l'avant : **1 à 15 et 17 à 23** (l'ancienne page boucle ; n'a ni `data-etat`,
  ni `data-definition`, ni `data-cta-nav`, ni curseur ; cache « Se connecter » à
  390 px ; rend sa démo à 6,8 px ; met son bouton à 3,84:1 ; montre
  « Vestiaire » dans sa démo ; écrit « Rien n'est envoyé à ta place » ;
  `AccueilFilm` n'existe pas). Le 16 peut y être vert (l'ancienne page n'a pas
  de couleur de plateforme hors démo). Note dans le message de commit combien
  sortent rouges.
- **Réaffaiblissements**, chacun doit faire tomber au moins un contrôle, à
  prouver une fois et à noter :
  - la carte rejoue en boucle ⇒ 2 et 3 ;
  - le bras « moins de mouvement » retiré ⇒ 8 ;
  - un `transform: scale(.8)` sur un écran dessiné ⇒ 13 ;
  - le mot « VRM » du H1 en bleu ⇒ 15 ;
  - un curseur ajouté dans la carte ⇒ 4 ;
  - « 0 € » comme socle du compteur ⇒ honnêteté du prix et 7 ;
  - `ACCES_OFFERT` à `false` sans retirer la puce ⇒ 12 ;
  - le film importé statiquement par `main.jsx` ⇒ 22.
- Regarde les captures (`CAPTURES=/un/dossier`) aux deux tailles, à 1 s, 3 s et
  6 s, et chaque scène à mi-parcours et en fin : un défaut d'affichage ne lève
  aucune erreur.
- Lance aussi `node scripts/audit-lancement.cjs` (contact), et
  `node scripts/audit-variables.cjs`, `audit-icones.cjs`, `audit-tdz.cjs`.

### 12.6 Documentation à mettre à jour

- **CLAUDE.md**, section « La page d'accueil publique (n° 22) » : la nouvelle
  structure en une phrase, la carte qui joue une fois, `src/accueil-reglages.js`
  et ses quatre constantes, le film (35 s et 15 s, 60 images/s, morceau chargé
  seulement avec `?film`, `vrm-film-*.mp4`), le nombre de contrôles du banc et
  combien sortent rouges sur l'avant. Dans « L'onglet Mon compte » : remplacer
  « retirer cette phrase de `src/Accueil.jsx` » par « passer `ACCES_OFFERT` à
  `false` ».
- `scripts/bancs/README.md` : la ligne `accueil.cjs` (ce qu'il juge maintenant).

---

## 13. Ce qui n'appartient qu'à Julien

- **Remplir `src/contact.js` et `public/legal/editeur.js`** : sinon la page la
  plus soignée finit sur « adresse de contact à venir », et les CGV disent cinq
  fois « à compléter ».
- **Publier l'extension sur le Chrome Web Store** : c'est la vraie marche de
  l'étape 2. Ensuite, `EXTENSION_SUR_LE_STORE = true`.
- **Le jour où l'abonnement devient obligatoire** : `ACCES_OFFERT = false`.
- **Dire si « VRM » veut dire quelque chose**, et s'il veut une courte note de
  fondateur (« fait par un revendeur qui gère plusieurs comptes ») : rien sans
  son oui.
- **La musique du film** : son choix, et ses droits. Le film est calé sur une
  grille de 120 battements par minute.
- **Hors de cette page, à signaler à la session de l'app** : on passe d'une page
  noire à un formulaire clair sans transition ; et quand la sonde de
  cloisonnement échoue, l'inscription affiche « un compte créé maintenant ouvre
  la MÊME boutique » (« pas su vaut non », sur l'écran qui accueille un inconnu).
- **Rappel (⛔ 6 octobre)** : une adresse email déclarée n'est pas encore
  prouvée. Tant que ce n'est pas réglé, VRM ne s'ouvre qu'à des gens de
  confiance, quelle que soit la page.
