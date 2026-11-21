# 6 nov. — Le message d'origine comme dans Mail : HTML assaini, 30 jours (v36)

Décision de Julien (6 nov.) : garder pendant **30 jours** le HTML d'origine **assaini** des seuls
e-mails « à geste » (colis disponible / code de retrait, vente, bordereau, achat, offre, et leurs
équivalents Vestiaire / Leboncoin / eBay rangés sous ces types), pour que l'e-mail ouvert dans VRM
s'affiche comme dans Mail. Branche LOCALE `v36-emails-html` (partie de `claude/project-review-nsk5su`,
fusionnée deux fois par un vrai `git merge`). Rien dans `vinted-sync-extension/` ni `public/`. Rien
poussé. Toujours 12 fonctions `api/`.

## Mesuré d'abord (sa base, SELECT seulement, des agrégats — aucun contenu lu)

- **7 derniers jours : 724 e-mails rangés (~103/jour)**, dont **284 « à geste » (39 %, ~41/jour)** :
  91 colis au relais (code lu ou « disponible »), 94 offres, 66 achats, 17 ventes, 16 bordereaux.
  Le reste (245 « rien à faire », 65 favoris, 35 actions, 27 messages, 5 versements) ne garde pas son HTML.
- **Aucun HTML d'e-mail rangé n'est gardé aujourd'hui** ; les seuls HTML en base sont les 176
  `email_inconnu_*` à balises (champ `brut`) : **médiane 10,8 Ko, moyenne 20 Ko, 90 % sous 69 Ko,
  maximum 111 Ko** ; sans `<style>` ni blancs ≈ 12 Ko en moyenne. Aucun au-delà de 150 Ko.
- Base à ~236 Mo sur 500.

### Poids estimé
~41 e-mails à geste/jour × ~15 Ko assainis (feuille de style gardée, blancs resserrés, tête, scripts,
commentaires et pixels retirés) ≈ **0,6 Mo/jour, ~18 Mo par mois de texte**, soit **~5 à 9 Mo sur
disque** (le texte HTML de `data` est compressé par Postgres, 2 à 4×). Purgé à 30 jours, c'est aussi
le **plafond permanent** (~18 Mo de texte au pire du rythme actuel ; pessimiste, tous à 69 Ko :
~85 Mo de texte, ~25-40 Mo sur disque). L'égress : un e-mail à la fois, à l'ouverture seulement.

## Ce qui change

### Réception — `api/_lib/email-html.js` (NOUVEAU, une règle) + `api/email-inbound.js`
- `emailAGeste(type, resume)` : `vente`, `vente-vestiaire`, `bordereau`, `achat`, `offre`, et `suivi`
  avec code lu ou `st:'available'` (jamais un colis sortant). Pas `finalisation` (versement), ni le reste.
- `assainirHtml(html)` : un lecteur écrit ici (aucune dépendance) qui RÉÉCRIT ce qu'il garde — liste
  blanche de balises (texte, tableaux, listes, images, liens) et d'attributs (présentation,
  `style`, `class`, `href`, `src`/`alt`) ; supprimés avec leur contenu : script, style dangereux,
  iframe, object, embed, svg, math, template, noscript, textarea, select, title, head ; `meta`,
  `base`, `link`, `form`/`input`/`button` (balises) ; aucun `on…`, `id`, `name`, `srcset`, `background`,
  `formaction`, `xlink:href`. Liens : http(s), mailto, tel seulement (entités décodées, blancs retirés
  AVANT le jugement), toujours `target="_blank" rel="noopener noreferrer"`. CSS (attribut et bloc) :
  `url()`, `image-set()`, `expression()`, `@import`, `@font-face`, `behavior`, `-moz-binding`,
  `javascript:` neutralisés, barres obliques inverses et commentaires retirés. Images distantes : en
  `data-vrm-src` (https), jamais `src` ; `data:image/png|gif|jpeg|webp` gardées ; `cid:` retirées ;
  **pixels de suivi supprimés** (≤ 2 px, cachés, adresses d'ouverture). Sortie **stable** (relue,
  identique). Plafond **150 Ko assainis** : au-delà, la ligne ne garde que le poids (`trop:1`).
- Rangement : dans `repondre`, **après** l'écriture confirmée de `email_reception_*` (et du texte),
  une ligne à part `email_html_{empreinte}` `{v, at, html, octets, images, pixels, sombre}`. **Écriture
  à part et sans 503** : c'est un confort d'affichage — si elle rate, l'e-mail est rangé (200) et
  l'écran retombe sur le texte. Si le rangement rate, 503 comme avant et **aucun HTML n'est tenté**.
- Purge : `purgerHtml` dans le cron du MATIN (`api/ship-reminders.js`), une requête
  `DELETE app_data?id=like.email_html_*&or=(meta->>at.lt.X,and(meta->>at.is.null,updated_at.lt.X))&select=id`
  (tous vendeurs, clé de service, ne rend que des identifiants). Elle ne lève jamais ; son bilan est
  dans la réponse du cron (`purgeHtml`).

### Lecture — `api/_lib/reception-email.js`, `api/email-rattacher.js`
- `lireEmailBoite({…, html})` (route `mode=journal&lire=…&html=1`) lit SA ligne `email_html_*`,
  projetée, sous SON vendeur, et la **RÉ-ASSAINIT** (`origineLue`) : la garantie ne dépend pas de qui a
  écrit la ligne. Plus de 30 jours ⇒ `absent/trop-vieux` (une purge ratée ne montre rien de plus) ;
  lecture ratée ⇒ `origine:null` (pas su) et l'e-mail s'ouvre avec son texte. Sans `html=1`, la
  ligne n'est même pas lue. **Aucune liste** (journal, non-lus, compteurs, réception) ne la lit.
- L'export complet (Réglages, `select=id,data`) écarte `email_html_*` (`src/App.jsx`, `EXCLUS`).

### Écran — `src/CadreEmail.jsx`, `src/cadreEmail.js` (NOUVEAUX), `src/BoiteEmails.jsx`
- « Message d'origine » : `MessageOrigine` montre le **cadre** si la mise en page est gardée, sinon le
  texte remis en forme d'avant, avec une ligne quand il y a une raison (« trop lourde », « gardée 30
  jours », « pas lue cette fois »).
- Le cadre : `<iframe sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc>`
  — **sans `allow-scripts`** (ni forms, ni top-navigation, ni modals). `allow-same-origin` sert à
  l'écran pour MESURER le document (hauteur au contenu, mise à l'échelle) ; sans scripts dedans, le
  cadre n'en fait rien. Le document porte SA CSP (`default-src 'none'; script-src 'none'; style-src
  'unsafe-inline'; img-src data:` — `https:` seulement après le geste ; `form-action 'none'; base-uri
  'none'`), `referrer no-referrer`, en plus de la CSP de la page héritée par le `srcdoc` (vercel.json
  inchangé : le banc la sert et ne voit aucune violation).
- Largeur de l'écran : un e-mail plus large que le cadre (600 px fixes) est réduit à l'échelle
  (0,53 à 390 px), jamais coupé ni défilant de côté ; hauteur = contenu.
- Nuit : fond **clair** dans le cadre si l'e-mail n'a pas de thème sombre ; s'il en a un
  (`prefers-color-scheme: dark`), il le suit. Le `<body>` d'origine retrouve sa place (ses règles
  `body {…}` jouent).
- « **N images bloquées · Afficher les images** » : chargées sur ce geste seulement, une fois par
  ouverture (jamais retenu).
- **Mode stream** : le HTML n'est jamais demandé (`html=1` absent) ; « Mise en page d'origine masquée
  en mode stream (elle contient noms et adresses) », puis le texte (sous la règle du stream, comme avant).

## Preuves
- **`audit-emails-html` (NEUF) : 55/55**. H1 les **48 vecteurs** de `scripts/bancs/_fx-email-html.cjs`
  (script, `<SCRIPT>`, script coupé, img onerror, `img/src/onerror`, svg onload, svg/script, math,
  body onload, `javascript:` sous entités / tabulation / sans `;` / espace / `&Tab;&colon;`,
  `data:text/html`, vbscript, style expression (échappée, commentée), url(javascript:), behavior,
  `@import`, sortie de `<style>`, iframe + srcdoc, frame, object/embed, meta refresh, base href,
  form action + formaction, link, commentaires, CDATA, noscript, textarea, title, template, attribut
  sans fin, attribut en entités, srcset, svg en data:, xlink, onclick, target _top, plaintext, NUL)
  jugés par un **lecteur indépendant** de la sortie (aucun survivant, sortie stable, contenu enfoui
  jamais en texte) ; H2 images/pixels/CSP du cadre/geste ; H3 plafond et choix ; H4 la **VRAIE route**
  `email-inbound` (HTML après rangement, même empreinte et vendeur ; HTML raté ⇒ 200 ; rangement raté ⇒
  503 sans HTML ; incompris ⇒ rien ; trop lourd ⇒ poids) ; H5 `lireEmailBoite` (ré-assaini, 30 jours,
  pas su, pas lu sans `html`) ; H6 listes et code (`like.email_*` jamais `data`, export) ; H7 purge sur
  une base mêlée (seules les `email_html_*` > 30 j partent, tous vendeurs, meta sinon création ; ratée
  ⇒ rien ne lève ; branchée au matin) ; H8 cadre et écran.
  `--prouve` : **19/19 mutations attrapées**. **Arbre d'avant** (a17fa285, audit copié dedans) :
  21 rouges (les règles), les seuls verts sont des « ne doit pas » tenus faute de code.
- **Banc `scripts/bancs/emails-html.cjs` (NEUF) : 66/0** — la VRAIE `lireEmailBoite`, ~950 e-mails
  inventés + 3 à HTML, en-têtes de vercel.json posés (0 violation CSP), 390 tactile et 1512, clair et
  sombre : E1 mise en page, largeur, sandbox, liens ; E2 aucune image avant le geste, 2 après, jamais
  un pixel ni une police / feuille / fond distant ; E3 fond clair la nuit, le colis à thème sombre le
  suit ; E4 ligne PIÉGÉE en base (48 vecteurs bruts) : `__xss` jamais appelé, images affichées
  comprises ; E5 vieil e-mail ⇒ texte ; E6 stream. Puis les **trois barrières une à une**, scripts
  PERMIS dans le harnais : X0 11 vecteurs bruts S'EXÉCUTENT (le harnais voit), X1 assainis : 0,
  X2 bruts dans le sandbox du cadre : 0. Les « Blocked script execution in about:srcdoc » de la console
  sont les scripts d'initialisation du banc (Playwright) refusés par le sandbox : comptés à part (4 par
  contexte), jamais une erreur de l'app.
- Captures regardées (scratchpad de la session, `eh-v36/capt/`) : `vente-bloquees-*`, `vente-images-*`,
  `retrait-*`, `piege-*`, `stream-390`. Vu et corrigé : le fond `body` de l'e-mail perdu (anneau clair
  autour de la carte sombre) ⇒ le `<body>` d'origine retrouve ses attributs ; l'échelle posée sur
  l'enveloppe, pas sur `body`.
- Bancs voisins : `boite-mail` **104/0**, `boite-emails` **282/0** (un premier passage 281/1 : « offres filtré » à 1512 clair, attente fixe de
  400 ms du banc après le toucher de la pastille — vert au passage suivant, filtres non touchés ici). Audits verts : `boite-mail` 38,
  `boite-emails` 82, `email-formes`, `csp`, `secrets`, `fonctions-api`, `lectures-lourdes`, `coherence`,
  `journal-emails` 58, `tdz`, `icones`, `bancs`. `export-donnees` X6 rouge **déjà sur la base** (non touché).
  `npm run build` vert.

## Ce qui reste / à décider
- Les images de FOND posées en CSS (`background:url(…)`) sont retirées, même après le geste (rare dans
  les e-mails mesurés ; les restituer demanderait de les garder à part).
- Rien n'est rétroactif : seuls les e-mails reçus après la mise en ligne ont leur mise en page.
- Un e-mail « offre » Vinted a son HTML (94/semaine, ~1/3 du volume gardé) : si la base serre, c'est
  le premier type à retirer de `TYPES_GESTE`.

## Geste de Julien
Aucun. Après la mise en ligne, ouvrir un e-mail de vente dans **E-mails** : la mise en page apparaît,
toucher « Afficher les images ».
