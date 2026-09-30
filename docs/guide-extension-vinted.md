# Guide complet — construire ton extension Vinted (republication, favoris, offres)

Version du 1er octobre 2026. Tout ce qui est marqué ✅ a été **relevé dans tes
propres requêtes** (base VRM, lignes `harvest_*_wreq_*` et `*_seen_urls`) ou
tourne déjà dans l'extension VRM. Ce qui est marqué ❓ n'a **jamais été vu** :
à mesurer avant de t'en servir (la méthode est donnée).

Le dossier `docs/automatisation-vinted.md` reste la référence courte (liste des
requêtes, fonctionnement de Vintex). Ce guide-ci est la version « je construis ».

---

## 0. Les 4 pièges à connaître AVANT d'écrire une ligne

1. **Le jeton de session ne se lit PAS avec `document.cookie`.** Le cookie
   `access_token_web` est très probablement protégé (HttpOnly) : invisible pour
   le code de la page. Il se lit dans le **service worker** avec
   `chrome.cookies.get(...)` (permission `"cookies"`). C'est ce que fait l'extension
   VRM, et ça marche.
2. **Le jeton CSRF ne se trouve nulle part sauf dans les requêtes de la page.**
   Vinted l'envoie dans l'en-tête `x-csrf-token`. Il faut un petit script injecté
   **dans la page elle-même** (monde `MAIN`) qui observe `fetch`/`XMLHttpRequest`
   et récupère cet en-tête au passage (code au §3).
3. **`GET /api/v2/items/{id}` répond 404** (mesuré 120 fois sur 120). La fiche
   complète d'une annonce se lit dans la **page HTML** de l'annonce
   (`https://www.vinted.fr/items/{id}`), dans le bloc `<script id="__NEXT_DATA__">`
   (code au §6).
4. **Un service worker MV3 est tué au bout de ~30 s d'inactivité.** Aucune
   variable « en mémoire » ne survit : plafonds, mémo « déjà écrit à X »,
   file d'attente → tout dans `chrome.storage.local` (code au §5).

---

## 1. Architecture

```
mon-extension/
├── manifest.json      déclaration (permissions, scripts)
├── background.js      service worker : appels Vinted, garde, logique
├── content.js         tourne sur vinted.fr, injecte page-hook.js, relaie les messages
├── page-hook.js       tourne DANS la page : capte x-csrf-token et x-anon-id
└── popup.html/.js     (facultatif) boutons « Republier », « Lancer un cycle »…
```

Chemin d'une action :
```
popup / app  ──message──►  background.js  ──fetch (jeton + csrf)──►  www.vinted.fr/api/v2/...
                               ▲
page-hook.js ──postMessage──► content.js ──chrome.runtime.sendMessage── (csrf, anon_id)
```

Les appels partent du **service worker**, dans **ton navigateur**, avec la session
du compte ouvert dans l'onglet. Jamais d'un serveur (une IP de datacenter est un
signal de robot).

---

## 2. manifest.json

```json
{
  "manifest_version": 3,
  "name": "Mon relais Vinted",
  "version": "1.0.0",
  "permissions": ["cookies", "storage", "alarms", "tabs"],
  "host_permissions": [
    "https://www.vinted.fr/*",
    "https://*.vinted.net/*"
  ],
  "background": { "service_worker": "background.js" },
  "content_scripts": [
    { "matches": ["https://www.vinted.fr/*"], "js": ["content.js"], "run_at": "document_start" }
  ],
  "web_accessible_resources": [
    { "resources": ["page-hook.js"], "matches": ["https://www.vinted.fr/*"] }
  ],
  "action": { "default_popup": "popup.html" }
}
```

- `cookies` + `host_permissions` vinted.fr : lire `access_token_web`.
- `*.vinted.net` : télécharger les photos (`images1.vinted.net`…) depuis le
  service worker (la page, elle, ne peut pas : pas d'en-tête CORS).

---

## 3. La session : jeton, compte, CSRF

### 3.1 Jeton et compte (background.js)
```js
const DOMAIN = 'www.vinted.fr';

function getCookie(name) {
  return new Promise((ok) => {
    chrome.cookies.get({ url: `https://${DOMAIN}`, name }, (c) => ok(c ? c.value : null));
  });
}
function jwtPayload(tok) {
  try {
    const p = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(p))));
  } catch (_) { return null; }
}
// Le compte CONNECTÉ dans le navigateur (celui de l'onglet).
async function compteActif() {
  const tok = await getCookie('access_token_web');
  const p = tok && jwtPayload(tok);
  return p && p.account_id ? { access: tok, uid: String(p.account_id) } : null;
}
```

### 3.2 CSRF et anon_id (page-hook.js — tourne DANS la page)
```js
(() => {
  const post = (d) => window.postMessage({ __relais: true, ...d }, location.origin);
  const lire = (h) => {
    try {
      if (!h) return;
      const get = (k) => h instanceof Headers ? h.get(k) : (h[k] || h[k.toLowerCase()]);
      const csrf = get('x-csrf-token'), anon = get('x-anon-id');
      if (csrf || anon) post({ csrf, anon });
    } catch (_) {}
  };
  const f0 = window.fetch;
  window.fetch = function (input, init) { lire(init && init.headers); return f0.apply(this, arguments); };
  const s0 = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    const kl = String(k).toLowerCase();
    if (kl === 'x-csrf-token') post({ csrf: v });
    if (kl === 'x-anon-id') post({ anon: v });
    return s0.apply(this, arguments);
  };
})();
```

### 3.3 content.js (injecte le hook, relaie au service worker)
```js
const s = document.createElement('script');
s.src = chrome.runtime.getURL('page-hook.js');
(document.head || document.documentElement).appendChild(s);
s.onload = () => s.remove();

window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || !e.data.__relais) return;
  chrome.runtime.sendMessage({ type: 'session', csrf: e.data.csrf || null, anon: e.data.anon || null });
});
```

### 3.4 background.js : garder le CSRF (dans le storage, pas en mémoire)
```js
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m && m.type === 'session') {
    const maj = {};
    if (m.csrf) maj.csrf = m.csrf;
    if (m.anon) maj.anon = m.anon;
    if (Object.keys(maj).length) chrome.storage.local.set(maj);
  }
});
```
⚠️ Le CSRF n'arrive qu'après que la page a fait **au moins une** requête : ouvre
une page de Vinted (dressing, messages) avant de lancer une action.

---

## 4. L'appel Vinted (background.js)

En-têtes relevés sur les vraies requêtes ✅ :
```js
async function vinted(method, path, body, { form = false } = {}) {
  const s = await compteActif();
  if (!s) throw new Error('Pas connecté à Vinted dans ce navigateur.');
  const { csrf, anon } = await chrome.storage.local.get(['csrf', 'anon']);
  const headers = {
    'Authorization': 'Bearer ' + s.access,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'fr-FR,fr;q=0.9',
    'locale': 'fr-FR',
  };
  if (csrf) headers['x-csrf-token'] = csrf;
  if (anon) headers['x-anon-id'] = anon;
  if (!form && body !== undefined) headers['Content-Type'] = 'application/json';
  const init = { method, headers, credentials: 'omit' };
  if (body !== undefined) init.body = form ? body : JSON.stringify(body);

  let res = await fetch(`https://${DOMAIN}${path}`, init);
  if (res.status === 401) {                     // jeton expiré : refresh UNIQUEMENT du compte actif
    await fetch(`https://${DOMAIN}/web/api/auth/refresh`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) }, body: '{}',
    });
    const s2 = await compteActif();
    if (s2) { headers.Authorization = 'Bearer ' + s2.access; res = await fetch(`https://${DOMAIN}${path}`, init); }
  }
  let json = null; try { json = await res.json(); } catch (_) {}
  return { ok: res.ok, status: res.status, json };
}
```
- **Un 401 ou 403 après refresh = on s'arrête**, on ne réessaie pas en boucle.
- `credentials: 'omit'` : on n'envoie pas les cookies, seulement le jeton (sinon
  les comptes se mélangent).

---

## 5. La garde (plafonds, une requête à la fois) — dans le storage

```js
const PLAFOND_HEURE = 20, PLAFOND_VISITE = 3;
let file = Promise.resolve();                    // sérialise les écritures (tant que le SW vit)

async function garde(uidAttendu) {
  const s = await compteActif();
  if (!s) return 'Pas connecté à Vinted.';
  if (uidAttendu && s.uid !== String(uidAttendu)) return `Ouvre Vinted sur le bon compte (connecté : ${s.uid}).`;
  const { heure = [], visite = { t: 0, n: 0 } } = await chrome.storage.local.get(['heure', 'visite']);
  const now = Date.now();
  const h = heure.filter((t) => now - t < 3600e3);
  if (h.length >= PLAFOND_HEURE) return `Plafond de ${PLAFOND_HEURE} actions par heure atteint.`;
  const v = (now - visite.t < 30 * 60e3) ? visite : { t: now, n: 0 };   // une « visite » = 30 min
  if (v.n >= PLAFOND_VISITE) return `Plafond de ${PLAFOND_VISITE} actions par visite atteint.`;
  return null;
}
async function compter() {
  const { heure = [], visite = { t: 0, n: 0 } } = await chrome.storage.local.get(['heure', 'visite']);
  const now = Date.now();
  const v = (now - visite.t < 30 * 60e3) ? visite : { t: now, n: 0 };
  await chrome.storage.local.set({ heure: [...heure.filter((t) => now - t < 3600e3), now], visite: { t: v.t, n: v.n + 1 } });
}
// Toute ÉCRITURE passe par ici.
function ecrire(method, path, body, opts, uid) {
  const p = file.then(async () => {
    const refus = await garde(uid);
    if (refus) throw new Error(refus);
    const r = await vinted(method, path, body, opts);
    await compter();                              // on compte ce qui est PARTI
    if (r.status === 401 || r.status === 403) throw new Error(`Vinted a refusé (${r.status}) — arrêt.`);
    return r;
  });
  file = p.catch(() => {});
  return p;
}
```

---

## 6. Lire les données

### 6.1 Lectures API ✅
| but | requête |
|---|---|
| compte connecté | `GET /api/v2/users/current` |
| annonces | `GET /api/v2/wardrobe/{uid}/items?page=1&per_page=100` → `items[]` : `id, title, price{amount,currency_code}, size, brand, status, photo, nPhotos, is_closed, is_hidden, is_draft, view_count, favourite_count` |
| ventes / achats | `GET /api/v2/my_orders?type=sold` / `type=purchased` (`&page=&per_page=40`) |
| boîte de réception | `GET /api/v2/inbox?page=1&per_page=30` |
| une conversation | `GET /api/v2/conversations/{id}` → `conversation.opposite_user{id,login}`, `conversation.transaction{id,item_id}`, `messages[]`, `allow_reply` |
| une transaction | `GET /api/v2/transactions/{id}` |
| « plus d'annonces » (vu, 200) | `GET /api/v2/items/{id}/more` |

⚠️ La liste du dressing ne donne **ni** la catégorie, **ni** les codes de taille/état,
**ni** toutes les photos (seulement la couverture + `nPhotos`).

### 6.2 La fiche complète : depuis la page ✅ (code de l'extension VRM)
```js
async function ficheAnnonce(id) {
  // Page publique : ni jeton, ni cookies (c'est ainsi que l'extension VRM la lit).
  const res = await fetch(`https://${DOMAIN}/items/${id}`, {
    method: 'GET', credentials: 'omit',
    headers: { 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'fr-FR,fr;q=0.9' },
  });
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;                           // ❓ Vinted peut changer de format : le noter
  const data = JSON.parse(m[1]);
  let item = null; const vu = new Set();
  (function walk(o, d) {
    if (!o || item || d > 9 || typeof o !== 'object' || vu.has(o)) return; vu.add(o);
    if (String(o.id) === String(id) && Array.isArray(o.photos) && o.photos.length) { item = o; return; }
    for (const k of Object.keys(o)) walk(o[k], d + 1);
  })(data, 0);
  if (!item) return null;
  return {
    title: item.title, description: item.description,
    catalog_id: item.catalog_id, brand_id: item.brand_id ?? item.brand_dto?.id, brand: item.brand ?? item.brand_dto?.title,
    size_id: item.size_id, status_id: item.status_id,
    color_ids: item.color_ids || [item.color1_id, item.color2_id].filter(Boolean),
    package_size_id: item.package_size_id,
    price: item.price?.amount ?? item.price, currency: item.price?.currency_code || 'EUR',
    is_unisex: !!item.is_unisex, isbn: item.isbn ?? null,
    photos: item.photos.map((p) => ({ id: p.id, url: p.full_size_url || p.url })),
  };
}
```
❓ **Le nom exact des champs** (`size_id`, `status_id`, `color1_id`…) dans cette page
n'a pas encore été relevé chez toi. L'extension VRM **5.120** le relève à ta
prochaine visite (`vinted_item_details[id].codes` + échantillon des clés dans
`panel_diag_capture`). Vérifie avec un `console.log(Object.keys(item))`.

---

## 7. Écrire (corps relevés ✅)

### Messages
| action | requête | corps |
|---|---|---|
| ouvrir une conversation avec quelqu'un sur un article | `POST /api/v2/conversations` | `{"initiator":"seller_enters_notification","item_id":"123","opposite_user_id":"456"}` |
| répondre | `POST /api/v2/conversations/{id}/replies` | `{"reply":{"body":"texte","photo_temp_uuids":null,"is_personal_data_sharing_check_skipped":false}}` |
| marquer lu | `PUT /api/v2/conversations/{id}/mark_as_read` | vide |

### Offres
| action | requête | corps |
|---|---|---|
| le vendeur propose un prix | `POST /api/v2/transactions/{tx}/offers` | `{"offer":{"price":"90","currency":"EUR"}}` |
| accepter une offre reçue | `PUT /api/v2/transactions/{tx}/offer_requests/{offre}/accept` | vide |
| refuser | `PUT /api/v2/transactions/{tx}/offer_requests/{offre}/reject` | vide |

### Annonces
| action | requête | corps |
|---|---|---|
| envoyer une photo | `POST /api/v2/photos` | `FormData` — ❓ **noms des champs non relevés** (voir §8.2) |
| créer | `POST /api/v2/item_upload/items` | voir §8.3 |
| modifier (dont le prix) | `PUT /api/v2/item_upload/items/{id}` | même objet complet, avec `"id": id` |
| supprimer | `POST /api/v2/items/{id}/delete` | vide |
| suggérer une catégorie | `POST /api/v2/item_upload/suggestions/categories` | `{"image_metadata":[{"image_id":"…","orientation":"0"}],"upload_session_id":"<uuid>"}` |

### Autres
| action | requête | corps |
|---|---|---|
| favori sur/hors | `POST /api/v2/user_favourites/toggle` | `{"type":"item","user_favourites":[123]}` |
| générer le bordereau | `PUT /api/v2/transactions/{tx}/shipment/order` | `{"seller_address_id":…,"drop_off_type":null,"label_type":null}` |

---

## 8. Republier, étape par étape

### 8.1 L'ordre (le seul sûr)
1. Lire la fiche (§6.2).
2. Télécharger chaque photo et la renvoyer à Vinted (§8.2).
3. **Créer** la nouvelle annonce (§8.3).
4. Vérifier qu'elle est en ligne (relire le dressing, retrouver son id).
5. **Seulement alors**, supprimer l'ancienne (`POST /api/v2/items/{ancien}/delete`).
6. Relire le dressing : l'ancienne a disparu ? Sinon, le dire.
7. Signaler à VRM le changement d'id pour le N° de rangement (§8.5).

Si ça plante entre 3 et 5 : deux annonces en ligne, **rien de perdu**. L'inverse
(supprimer d'abord, comme Vintex) peut faire perdre l'annonce.

### 8.2 Les photos
```js
async function renvoyerPhoto(url, uid) {
  const img = await fetch(url);                       // depuis le service worker (host_permissions vinted.net)
  if (!img.ok) throw new Error('Photo inaccessible (' + img.status + ')');
  const blob = await img.blob();
  const fd = new FormData();
  // ❓ NOMS DES CHAMPS À VÉRIFIER : l'extension VRM 5.120 les relève dans
  //    harvest_{uid}_wreq_api_v2_photos dès que tu ajoutes une photo à la main
  //    sur Vinted. Avant ça, tout nom est une supposition.
  fd.append('photo[file]', blob, 'photo.jpg');       // ❓
  fd.append('photo[type]', 'item');                  // ❓
  const r = await ecrire('POST', '/api/v2/photos', fd, { form: true }, uid);
  if (!r.ok) throw new Error('Envoi de photo refusé (' + r.status + ')');
  return r.json && (r.json.id || (r.json.photo && r.json.photo.id));   // ❓ forme de la réponse à relever
}
```
- Les photos repartent **telles quelles**. Les tourner ou recadrer ne sert à
  rien : Vinted relie les comptes par appareil, navigateur, adresse et paiement,
  pas par les images.
- ⚠️ Chaque envoi de photo compte comme une écriture : une annonce à 12 photos
  = 12 envois + 1 création + 1 suppression. Avec un plafond de 20 par heure, **une
  annonce par heure au plus**, ou relève le plafond en connaissance de cause.
- ❓ Piste à tester : réutiliser directement les `photos[].id` de l'ancienne annonce
  dans `assigned_photos` (sans renvoi). Les modifications d'annonce le font
  (`PUT`) ; pour une création, jamais vu. À tester sur **une** annonce, en
  vérifiant le résultat, avant de t'en servir.

### 8.3 Le corps de création ✅ (forme relevée sur tes créations)
```js
function corpsCreation(f, photoIds) {
  const uuid = crypto.randomUUID();
  return {
    item: {
      id: null, currency: f.currency || 'EUR', temp_uuid: uuid,
      title: f.title, description: f.description,
      brand_id: f.brand_id, brand: f.brand,
      catalog_id: f.catalog_id,
      isbn: f.isbn ?? null, is_unisex: !!f.is_unisex, ai_photo: false,
      price: Number(f.price),
      package_size_id: f.package_size_id,
      shipment_prices: { domestic: null, international: null },
      color_ids: f.color_ids || [],
      assigned_photos: photoIds.map((id) => ({ id, orientation: 0 })),
      measurement_length: null, measurement_width: null,
      item_attributes: [
        { code: 'size', ids: f.size_id ? [f.size_id] : [] },        // ❓ size_id = id de l'attribut « size » ? à vérifier
        { code: 'condition', ids: f.status_id ? [f.status_id] : [] }, // ✅ condition 2 = « Très bon état » (vu)
      ],
      manufacturer: null, manufacturer_labelling: null,
    },
    push_up: false,          // pas de mise en avant payante
    parcel: null,
    upload_session_id: uuid,
  };
}
```
Pour vérifier la correspondance `size_id` ↔ `item_attributes.size` : compare la
fiche d'une annonce (§6.2) avec le corps d'une de tes **modifications** d'annonce,
déjà en base (`harvest_{uid}_wreq_api_v2_item_upload_items_id`).

### 8.4 Le tout
```js
async function republier(ancienId, uid) {
  const f = await ficheAnnonce(ancienId);
  if (!f || !f.catalog_id) throw new Error('Fiche incomplète : ouvre l’annonce sur Vinted puis réessaie.');
  const ids = [];
  for (const p of f.photos) ids.push(await renvoyerPhoto(p.url, uid));
  const cree = await ecrire('POST', '/api/v2/item_upload/items', corpsCreation(f, ids), {}, uid);
  const nouvelId = cree.json && (cree.json.item?.id || cree.json.id);        // ❓ forme de la réponse
  if (!cree.ok || !nouvelId) throw new Error('Création refusée — l’ancienne annonce est intacte.');
  // Vérifier qu'elle est bien en ligne avant de toucher à l'ancienne.
  const d = await vinted('GET', `/api/v2/wardrobe/${uid}/items?page=1&per_page=100`);
  if (!(d.json?.items || []).some((it) => String(it.id) === String(nouvelId)))
    throw new Error('Nouvelle annonce introuvable dans le dressing — l’ancienne n’a pas été supprimée.');
  const del = await ecrire('POST', `/api/v2/items/${ancienId}/delete`, undefined, {}, uid);
  return { nouvelId, ancienSupprime: del.ok };
}
```

### 8.5 Le N° de rangement (VRM)
Dans VRM, les N° vivent dans la ligne `main` → `vinted_annonce_numeros`, **rangés
par id d'annonce**. La nouvelle annonce a un **nouvel id** : sans report, la paire
perd son numéro (et un numéro ne doit jamais être redonné à une autre paire).
L'extension ne doit **pas** réécrire la ligne `main` (c'est l'app qui en est
propriétaire). Elle écrit un signal dans sa propre ligne :
```
app_data, id = "panel_repub_pending", data.items[ancienId] = { numero, title, t, nouvelId }
```
et l'app reporte le N° (à brancher côté app : je le fais dès que la
republication tourne).

---

## 9. Messages aux personnes qui ont mis en favori

1. **Qui ?** Les notifications Vinted (la cloche) disent « X a marqué ton article
   Y comme favori ». ❓ La forme de la réponse n'a pas encore été vue : l'extension
   VRM ≥ 5.117 la range dans `harvest_{uid}_notifications` dès que tu **ouvres la
   cloche sur vinted.fr**. Il faut y lire l'id de la personne et l'id de l'article.
2. **Ouvrir la conversation** : `POST /api/v2/conversations` avec
   `initiator: "seller_enters_notification"` (§7). La réponse contient l'id de la
   conversation (❓ forme exacte à relever).
3. **Écrire** : `POST /api/v2/conversations/{id}/replies` (§7).
4. **Offre** (facultatif) : lire la conversation → `conversation.transaction.id`,
   puis `POST /api/v2/transactions/{tx}/offers`.
5. **Anti-doublon** (dans `chrome.storage.local`) : clé = `idPersonne + idArticle` ;
   ne jamais réécrire à la même personne pour le même article.

```js
async function relancerFavori(fav, texte, prix, uid) {
  const { deja = {} } = await chrome.storage.local.get('deja');
  const cle = `${fav.userId}_${fav.itemId}`;
  if (deja[cle]) return 'déjà fait';
  const c = await ecrire('POST', '/api/v2/conversations',
    { initiator: 'seller_enters_notification', item_id: String(fav.itemId), opposite_user_id: String(fav.userId) }, {}, uid);
  const convId = c.json && (c.json.conversation?.id || c.json.id);            // ❓
  if (!convId) throw new Error('Conversation non ouverte');
  await ecrire('POST', `/api/v2/conversations/${convId}/replies`,
    { reply: { body: texte, photo_temp_uuids: null, is_personal_data_sharing_check_skipped: false } }, {}, uid);
  if (prix) {
    const conv = await vinted('GET', `/api/v2/conversations/${convId}`);
    const tx = conv.json?.conversation?.transaction?.id;
    if (tx) await ecrire('POST', `/api/v2/transactions/${tx}/offers`, { offer: { price: String(prix), currency: 'EUR' } }, {}, uid);
  }
  deja[cle] = Date.now();
  await chrome.storage.local.set({ deja });
  return 'envoyé';
}
```
⚠️ Chaque relance = 2 à 4 écritures. Le plafond de 20/h en permet ~5 par heure.

---

## 10. Brancher sur VRM (facultatif)

- Base : `https://lgonxzrzjcqthjtbdpzo.supabase.co/rest/v1/app_data`.
- Clé : la clé **publique** (celle de l'app). **Jamais la clé secrète** dans une
  extension : n'importe qui pourrait la lire dans le zip.
- Après la fermeture de la base (étape 2 du verrouillage), chaque requête doit
  porter la session de l'utilisateur VRM (`Authorization: Bearer <jeton VRM>`),
  comme le fait l'extension VRM (`popup.js` → connexion).
- Lignes utiles : `harvest_{uid}_listings`, `harvest_{uid}_notifications`,
  `harvest_{uid}_conv_{id}`, `vinted_item_details`, `panel_repub_pending`.
- Toute écriture = lire, fusionner, réécrire — et **ne rien écrire si la lecture a
  échoué** (sinon tu effaces la ligne).

---

## 11. Tester et déboguer

- `chrome://extensions` → ton extension → « Inspecter les vues : service worker » :
  la console et l'onglet Réseau du background.
- Sur vinted.fr : DevTools → Network → coche « Preserve log » → fais le geste à la
  main (ajouter une photo, créer une annonce) → clic sur la requête → onglets
  **Payload** (ce qui part) et **Response** (ce qui revient). C'est comme ça qu'on
  lève les ❓ ci-dessus en deux minutes.
- Teste chaque écriture **sur une seule annonce** d'abord, et regarde le résultat
  sur Vinted avant d'en lancer une deuxième.

---

## 12. Ce qui reste à mesurer ❓ (et comment)

| inconnu | comment le lever |
|---|---|
| noms des champs de `POST /api/v2/photos` + réponse | ajoute une photo à une annonce sur Vinted, avec l'extension VRM 5.120 → `harvest_{uid}_wreq_api_v2_photos` ; ou DevTools → Payload |
| forme de la réponse de création d'annonce (où est le nouvel id) | DevTools → Response au moment d'une création manuelle |
| noms des champs de la fiche dans la page | extension VRM 5.120 → `vinted_item_details[id].codes` après une visite |
| correspondance `size_id` ↔ `item_attributes.size` | comparer une fiche et une modification d'annonce déjà en base |
| forme des notifications de favoris | ouvrir la cloche sur vinted.fr (extension VRM ≥ 5.117) → `harvest_{uid}_notifications` |
| réponse de `POST /api/v2/conversations` | DevTools → Response en ouvrant une conversation depuis une notification |
| réutiliser les ids de photos sans renvoi | test sur UNE annonce |

---

## 13. Ce qui fait bloquer un compte (à garder en tête)

- Agir avec le compte d'un autre onglet ou d'un autre navigateur (les comptes se
  relient entre eux) → toujours vérifier `compteActif()`.
- Enchaîner les écritures sans limite → plafonds §5.
- Insister après un 401/403 → arrêt immédiat.
- Supprimer avant de recréer → perte d'annonce possible.
- Ce guide ne contient pas de système de pauses aléatoires ni de retouche
  d'images destinés à tromper la détection de Vinted : c'est exactement ce qui a
  coûté `vanessa5723`.
