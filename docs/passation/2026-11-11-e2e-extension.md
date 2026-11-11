# 11 nov. — L'app et la VRAIE extension ensemble, dans un vrai Chromium

Branche `claude/e2e-extension`. Aucune PR, aucun merge dans `main` (consigne de la mission).
Aucune requête vers le vrai Vinted ni la vraie base : tout est servi en local.

## Ce qui existe maintenant

- `scripts/bancs/_e2e-monde.cjs` — UN serveur HTTPS local qui répond sous les vrais noms
  (`--host-resolver-rules`, `MAP * ~NOTFOUND` pour le reste) :
  - **www.vinted.fr** : des pages HTML (le dressing d'un membre est une page qui charge
    `/api/v2/wardrobe/{id}/items`, comme la SPA de Vinted) et l'API v2 à la forme réelle
    (`users/current`, `wardrobe/{id}/items`, `my_orders`, `inbox`, `item_upload/items/{id}`
    GET/PUT). Le compte qui parle est celui du cookie `access_token_web` (JWT,
    `account_id`), posé par le SITE (`/banc/connexion?uid=…`, `Set-Cookie` hôte seul) —
    `chrome.cookies.onChanged` part comme chez lui. Chaque requête est notée (méthode,
    chemin, compte du cookie, `Authorization`, origine) avec combien sont en vol ; une
    réponse peut être forcée (429).
  - **lgonxzrzjcqthjtbdpzo.supabase.co** : GoTrue (mot de passe, renouvellement, `/user`)
    et un PostgREST À ÉTAT (lectures par `_minipgrest.cjs` : projection, filtres, `or=`,
    `Range`, `meta->>` via `_meta.cjs`). RLS : une lecture ne rend que les lignes du
    vendeur du jeton, une écriture prend son `owner` ; `on_conflict=owner,id`
    (cloisonné) ; `select=*` rend la ligne entière ; `vinted_accounts.id` par séquence
    (forme de `scripts/sauvegarde/schema-exemple.sql`).
  - **vrm.center** : le `dist/` construit, et les routes `api/` réduites à ce que l'app
    attend (`confidentialite` rend l'uid du jeton, `abonnement` propriétaire,
    `equipe` non installé, `session-extension` fabrique une session À PART).
- `scripts/bancs/e2e-extension.cjs` — le banc. Un profil Chrome persistant, la vraie
  extension chargée par `--load-extension` (copie dans un dossier temporaire : son
  identifiant ne dépend pas de l'emplacement du dépôt), headless nouveau mode.

## Les six scénarios (41 contrôles, tous verts sur le code de ce jour)

1. **Liaison** : fenêtre de l'extension → « Se connecter en passant par le site VRM »
   → VRM s'ouvre → l'extension a SA session (≠ celle de l'app), du MÊME vendeur ; VRM
   le dit (`data-liaison`).
2. **Dressing** : il se connecte sur vinted.fr, ouvre son dressing ⇒ `harvest_111_listings`,
   `harvest_111_orders_sold`, `vinted_accounts` écrits par l'extension, sous SON owner ⇒
   ses 2 annonces dans Annonces (`data-carte-annonce`). Puis il regarde le dressing d'un
   AUTRE membre (3 annonces, plus riche) : rien n'entre dans les siennes (§5).
3. **Vente** : sa vente est dans Ventes (`data-tx`, titre) ; celle de l'autre compte non.
4. **Commande** : il enregistre une fois l'annonce sur vinted.fr (la page envoie sa fiche :
   `vrm_vinted_modele` appris, `coffre_111_…` présent) ; Annonces → À relancer → Qui
   dorment → « Baisser le prix » → Oui ⇒ UN PUT chez Vinted, cookie 111, **aucun
   `Authorization`** (depuis l'onglet), prix arrivé, puis RELU, l'app affiche le prix relu,
   une requête à la fois pendant la commande. Plafond 45/50 posé dans
   `chrome.storage.local` ⇒ rien ne part, l'app le dit. Un 429 forcé ⇒ `vrmPauseVinted`
   posée ; la commande suivante n'envoie RIEN.
5. **Autre compte** : il bascule l'onglet sur autre_b ⇒ l'extension le voit ; la vente
   d'autre_b est rangée sous autre_b ; l'app ne lance pas la baisse (« Ouvre #111 sur
   Vinted ») ; une commande `baisserPrixVinted` pour 111 postée DIRECTEMENT au pont (un
   écran périmé) ⇒ refusée (`vinted-autre`), zéro requête chez Vinted.
6. **Extension en retard** : profil neuf, extension au manifeste **5.335.0** (avant
   `baisseprix`, `CODE_VERSION` aligné), connectée au même vendeur ⇒ le pont annonce 5.335,
   la feuille s'ouvre, « Baisser » est fermé, bandeau « Mets l'extension à jour (5.342.0) »,
   rien chez Vinted. (Une COPIE de l'extension dont seule la version change : on juge la
   règle de l'APP — elle décide sur la version annoncée, pas sur le code présent.)

Captures regardées (`BANC_CAPTURE=<dossier>`) : Annonces, Ventes, la feuille en 4, 5 et 6
— de vrais écrans, aucun garde-fou.

## La preuve par mutation (§6.1) — `node scripts/bancs/e2e-extension.cjs --prouve`

Un passage vert, puis chaque mutation (une règle réaffaiblie dans une COPIE de
`background.js` ou de `dist/`) doit rendre le banc rouge :

| mutation | ce qui est cassé | où |
|---|---|---|
| `liaison` | l'app n'obtient plus la session de l'extension | dist |
| `autre-membre` | le dressing d'un autre membre rangé comme le sien | extension |
| `compte-capture` | une capture rangée sous un compte qui n'est pas celui de l'onglet | extension |
| `garde-compte` | la garde ne compare plus le compte de l'onglet | extension |
| `plafond` | le plafond d'actions ne compte plus | extension |
| `pause-429` | un 429 ne pose plus de pause | extension |
| `capacite` | l'app croit la baisse arrivée en 5.335 (`EXT_CAPACITES`) | dist |

Résultat du `--prouve` (11 nov., ce conteneur) : passage tel quel **vert** ; **7/7 mutations
rouges** — liaison 25 contrôles, autre-membre 4, compte-capture 2, garde-compte 3 (la
lecture part avec le cookie 222), plafond 5 (GET+PUT+GET partis), pause-429 3, capacite 4
(« Baisser » ouvert, 3 requêtes parties pour une 5.335).

## Un CONSTAT (pas corrigé ici)

À l'arrivée sur vinted.fr, **deux moissons lisent les mêmes listes** : celle du fond
(dans la page, `wardrobe…per_page=100`, `moisson_page_rangee`) et celle d'`inject.js`
(`activeHarvest`, `per_page=200`, 6 s après) — `users/current` lu 3 fois sur une visite.
Et `activeHarvest` ne passe pas par la file `requeteVinted` : mesuré 2 fois sur 3
passages, **deux requêtes Vinted en vol en même temps** (`my_orders` de la page + `users/
current` du fond, ou `wardrobe` + `my_orders`). C'est contraire au §3 (« une requête à la
fois, quelle que soit la source ») et ça double l'empreinte de chaque visite. Le banc le
rapporte en ⚠️ CONSTAT ; `BANC_STRICT=1` le rend rouge. Le corriger demande de toucher
l'extension (version, zip, revue) : pas fait dans ce chantier, à décider.

## La CI

Job `e2e-extension` dans `.github/workflows/verifier.yml`, après `construire` (télécharge
`dist/`), **non bloquant** (`continue-on-error: true`) : à rendre bloquant après plusieurs
passages verts de suite sur GitHub. Le Chromium installé par `npx playwright install
chromium` est le binaire COMPLET (le lien `/opt/pw-browsers/chromium` vise
`chromium.executablePath()`) : il charge une extension MV3 en headless nouveau mode — c'est
ce que fait le banc ici. Le « headless shell » ne le ferait pas. Les captures sont jointes
au job (`e2e-extension-captures`).

## Lancer

```bash
npm run build
node scripts/bancs/e2e-extension.cjs            # ~4 min, 41 contrôles
node scripts/bancs/e2e-extension.cjs --seul 2   # liaison + dressing + vente seulement
node scripts/bancs/e2e-extension.cjs --prouve   # + 7 mutations, ~30 min
BANC_DEBUG=1 BANC_JOURNAL=1 …                   # console de l'app, requêtes en cours, lectures
```

## Pièges rencontrés (pour la suite)

- `select=*` sur `vinted_accounts` rendu à la forme d'`app_data` (sans `vinted_user_id`) :
  l'app recevait un compte sans identifiant et ne lisait ni annonces ni ventes, sans
  erreur. Toujours servir la ligne entière.
- `on_conflict=owner,id` : la clé de la ligne est `id` (owner = celui du jeton).
- Un cookie posé par `context.addCookies` sur `.vinted.fr` ne déclenche pas la capture
  (`VINTED_DOMAINS` = `www.vinted.fr`) : c'est le site qui pose son cookie, hôte seul.
- Chaque onglet est ramené au premier plan avant usage (`bringToFront`) : la moisson
  d'`inject.js` ne part que onglet visible.
