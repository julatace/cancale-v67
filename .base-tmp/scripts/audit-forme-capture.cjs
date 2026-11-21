// ⚠️⚠️ SENTINELLE DE DÉRIVE DE FORME — la robustesse aux MISES À JOUR des sites.
//
// Julien : « même s'il y a des mises à jour dans ces applications, il n'y ait
// plus aucun problème dans la récupération de données ». Le jour où Vinted (ou
// Leboncoin, ou eBay) renomme la clé de liste d'une réponse — `my_orders` →
// `orders`, `items` → `catalog_items`, ou renvoie un tableau NU — la capture
// tombe à 0 EN SILENCE : `parsed[cle]` vaut `undefined`, `listePlusRiche`
// l'ignore, et personne ne sait POURQUOI. C'est « rien lu ne vaut pas rien »
// déclenché par une forme, pas par une panne.
//
// `verifFormeListe` (background.js) ne DEVINE pas un nouveau parser — interdit
// par le dossier (pas de parser pour une forme jamais vue). Elle rend la dérive
// BRUYANTE : `forme_inconnue_<type>` + les NOMS des clés de tête + la
// clé-candidate, dans `panel_diag_capture`, pour que l'app le dise et que la
// passe suivante aliase sur une forme MESURÉE.
//
// Ce banc EXÉCUTE la vraie fonction dans un `vm`, et vérifie LES DEUX SENS :
//   · une forme dérivée (clé renommée, tableau nu) DÉCLENCHE ;
//   · une forme attendue, et une réponse légitimement VIDE, ne déclenchent RIEN
//     (sinon la sentinelle crierait au loup sur chaque compte sans vente).

const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

// storage.local en mémoire pour le tampon ; et une ligne `panel_diag_capture`
// stateful côté fetch — c'est là que `viderTampon` dépose les compteurs (il vide
// le tampon après flush, donc on ne peut pas se contenter de lire le tampon).
function faireCtx() {
  const store = {};
  const diagRow = { n: {}, rates: {} };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: {
        get: async (k) => { const key = Array.isArray(k) ? k[0] : (typeof k === 'object' && k ? Object.keys(k)[0] : k); return key == null ? { ...store } : { [key]: store[key] }; },
        set: async (o) => { Object.assign(store, o); },
        remove: async () => {},
      } },
    },
    // `viderTampon` lit puis réécrit `panel_diag_capture` : on sert la ligne
    // telle qu'elle s'accumule, exactement comme PostgREST.
    fetch: async (url, opts = {}) => {
      const rep = (ok, body) => ({ ok, status: ok ? 200 : 522, json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST' || (opts.method || '') === 'PATCH') {
        try {
          const rows = JSON.parse(opts.body || '[]');
          for (const r of rows) if (r && r.id === 'panel_diag_capture' && r.data) { diagRow.n = r.data.n || {}; diagRow.rates = r.data.rates || {}; }
        } catch (_) {}
        return rep(true, '[]');
      }
      if (/panel_diag_capture/.test(String(url))) return rep(true, JSON.stringify([{ data: diagRow }]));
      return rep(true, '[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'background.js' });
  ctx.__store = store; ctx.__diagRow = diagRow;
  return ctx;
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

// Appelle verifFormeListe puis attend que le tampon soit écrit, et le rend.
async function diag(type, parsed, id) {
  const ctx = faireCtx();
  // ⚠️ On NE MEURT PAS si la fonction est absente (code d'avant la sentinelle) :
  // on la traite comme un no-op — c'est exactement le comportement fautif
  // d'avant, le SILENCE. Les contrôles « déclenche » virent alors au rouge, ce
  // qui prouve la règle (silence → détecté), pas la simple absence de fonction.
  if (typeof ctx.verifFormeListe === 'function') ctx.verifFormeListe(type, parsed, id);
  await ctx.noterDiag('__sync__');      // la chaîne majTampon est sérialisée : ceci attend la fin
  // Les compteurs se répartissent entre le tampon (pas encore flushé) et la
  // ligne `panel_diag_capture` (flushée par viderTampon) : on fusionne les deux,
  // comme l'app qui ne lit QUE la ligne accumulée.
  const buf = ctx.__store.vrmDiagBuf || { n: {}, rates: {} };
  const row = ctx.__diagRow || { n: {}, rates: {} };
  return { n: { ...(row.n || {}), ...(buf.n || {}) }, rates: { ...(row.rates || {}), ...(buf.rates || {}) } };
}

// Même chose pour la sentinelle OBJET (transaction/conversation). Absente sur le
// code d'avant ⇒ no-op ⇒ silence : les contrôles « déclenche » virent au rouge.
async function diagO(type, parsed, id) {
  const ctx = faireCtx();
  if (typeof ctx.verifFormeObjet === 'function') ctx.verifFormeObjet(type, parsed, id);
  await ctx.noterDiag('__sync__');
  const buf = ctx.__store.vrmDiagBuf || { n: {}, rates: {} };
  const row = ctx.__diagRow || { n: {}, rates: {} };
  return { n: { ...(row.n || {}), ...(buf.n || {}) }, rates: { ...(row.rates || {}), ...(buf.rates || {}) } };
}

(async () => {
  // 1. CLÉ RENOMMÉE — `my_orders` → `orders` (le cas d'une mise à jour Vinted).
  {
    const d = await diag('orders_sold', { orders: [{ id: 1 }, { id: 2 }], pagination: { total_entries: 2 } }, 'x');
    dit(d.n.forme_inconnue_orders_sold === 1, 'clé renommée (orders) → forme_inconnue_orders_sold',
      'compteur=' + (d.n.forme_inconnue_orders_sold || 0));
    const r = d.rates.forme_orders_sold || {};
    dit(r.candidate === 'orders', 'la clé-candidate renommée est nommée', 'candidate=' + r.candidate);
    dit(Array.isArray(r.cles) && r.cles.includes('orders') && r.cles.includes('pagination'),
      'les noms de clés de tête sont relevés', 'cles=' + JSON.stringify(r.cles));
    // Promesse de confidentialité : aucun CONTENU ne doit fuir dans l'échantillon.
    dit(!JSON.stringify(r).includes('"id":1') && r.candidate === 'orders',
      'aucun contenu de liste ne fuit (noms de clés seulement)');
  }

  // 2. TABLEAU NU — Vinted renvoie `[...]` au lieu de `{ my_orders: [...] }`.
  {
    const d = await diag('listings', [{ id: 1 }], 'y');
    dit(d.n.forme_inconnue_listings === 1, 'tableau nu → forme_inconnue_listings');
    dit((d.rates.forme_listings || {}).candidate === '(racine)', 'candidate = (racine) pour un tableau nu');
  }

  // 3. FORME ATTENDUE — rien à signaler (clé de liste ET champs structurels présents).
  {
    const d = await diag('orders_sold', { my_orders: [{ id: 1, transaction_id: 't1', title: 'X' }], pagination: { total_entries: 1 } }, 'z');
    dit(!d.n.forme_inconnue_orders_sold, 'forme attendue (my_orders présent) ⇒ AUCUNE alerte');
    dit(!d.n.forme_inconnue_champ_orders_sold, 'et champs structurels présents ⇒ AUCUNE alerte de champ');
  }

  // 4. VIDE LÉGITIME — clé présente, tableau vide : un compte sans vente. Ne doit
  //    PAS crier au loup, sinon l'alerte serait permanente sur les comptes neufs.
  {
    const d = await diag('orders_sold', { my_orders: [], pagination: { total_entries: 0 } }, 'w');
    dit(!d.n.forme_inconnue_orders_sold, 'vide légitime (my_orders: []) ⇒ AUCUNE alerte');
  }

  // 5. CORPS SANS AUCUNE LISTE — une erreur applicative `{message, code}` : pas de
  //    liste ailleurs ⇒ on ne l'appelle pas une dérive de forme (le JSON a parsé,
  //    mais ce n'est pas une liste renommée). Mieux vaut un blanc qu'un faux.
  {
    const d = await diag('inbox', { message: 'temporarily unavailable', code: 503 }, 'v');
    dit(!d.n.forme_inconnue_inbox, 'erreur applicative sans liste ⇒ AUCUNE alerte (pas une dérive)');
  }

  // 6. TYPE NON-LISTE — un détail de transaction n'a pas de clé de liste attendue.
  {
    const d = await diag('transaction', { transaction: { id: 1, status: 450 } }, 't');
    dit(Object.keys(d.n).filter(k => k.startsWith('forme_inconnue')).length === 0,
      'type sans clé de liste (transaction) ⇒ jamais de sentinelle');
  }

  // ── DÉRIVE DE CHAMP : la clé de liste est bonne, un champ INTÉRIEUR a changé ──
  // C'est le vrai bug déjà vécu (`brand_title` vs `brand`) : l'allègement garde un
  // champ qui n'existe plus, la capture a l'air pleine mais l'app affiche
  // « manquant » partout, sans aucune erreur. Sur le code d'AVANT (5.139),
  // `verifFormeListe` revient dès que la clé de liste est présente → ces contrôles
  // tombent au ROUGE (silence), ce qui prouve la règle, pas l'absence de fonction.

  // 7. CHAMP RENOMMÉ — `price` → autre chose : la liste est pleine, aucun item n'a
  //    `price`. C'est une mise à jour de Vinted qui casse le prix de tout le stock.
  {
    const d = await diag('listings', { items: [{ id: 1, title: 'A', prix_v2: {} }, { id: 2, title: 'B', prix_v2: {} }] }, 'p');
    dit(d.n.forme_inconnue_champ_listings === 1, 'champ `price` disparu de TOUS les items → forme_inconnue_champ_listings',
      'compteur=' + (d.n.forme_inconnue_champ_listings || 0));
    const r = d.rates.forme_champ_listings || {};
    dit(r.champ === 'price', 'le champ perdu est NOMMÉ', 'champ=' + r.champ);
    dit(Array.isArray(r.cles) && r.cles.includes('prix_v2'), 'les clés d’un item sont relevées (pour aliaser ensuite)', 'cles=' + JSON.stringify(r.cles));
    dit(!JSON.stringify(r).includes('"title":"A"') && !JSON.stringify(r).includes('"id":1'),
      'aucune VALEUR ne fuit (noms de champs seulement)');
  }

  // 8. ANTI-FAUSSE-ALERTE (0/N) — un SEUL item sans prix (un brouillon), les autres
  //    l'ont : ce n'est PAS une dérive, c'est un item particulier. Rien ne doit se
  //    déclencher, sinon l'alerte serait permanente dès qu'un article est atypique.
  {
    const d = await diag('listings', { items: [{ id: 1, title: 'A', price: { amount: '10' } }, { id: 2, title: 'B' }] }, 'q');
    dit(!d.n.forme_inconnue_champ_listings, 'un seul item sans `price` (les autres l’ont) ⇒ AUCUNE alerte (seuil 0/N)');
  }

  // 9. CHAMP STRUCTUREL d'une VENTE renommé — `transaction_id` disparu de tout.
  {
    const d = await diag('orders_sold', { my_orders: [{ id: 1, title: 'X' }, { id: 2, title: 'Y' }], pagination: {} }, 'o');
    dit(d.n.forme_inconnue_champ_orders_sold === 1, 'champ `transaction_id` disparu → forme_inconnue_champ_orders_sold');
    dit((d.rates.forme_champ_orders_sold || {}).champ === 'transaction_id', 'le champ de vente perdu est nommé');
  }

  // 10. LISTE VIDE — champs non jugeables (aucun item). Un compte neuf ne doit
  //     JAMAIS déclencher la dérive de champ (sinon alerte permanente).
  {
    const d = await diag('listings', { items: [] }, 'e');
    dit(!d.n.forme_inconnue_champ_listings, 'liste vide (compte neuf) ⇒ AUCUNE alerte de champ');
  }

  // 11. L'ALERTE DE CHAMP REMONTE SOUS `forme_*` — l'app scanne `/^forme_/` et
  //     mappe par sous-chaîne (`/listings/` → « annonces »). La clé `forme_champ_
  //     listings` doit donc être lisible par ce même filtre, sans toucher l'app.
  {
    const d = await diag('listings', { items: [{ id: 1, title: 'A', prix_v2: {} }] }, 'z2');
    const k = Object.keys(d.rates).find(x => /^forme_/.test(x) && /listings/.test(x.slice('forme_'.length)));
    dit(!!k, 'la clé de dérive de champ est captée par le filtre /^forme_/ de l’app', 'clé=' + k);
  }

  // ── DÉRIVE SUR UNE CAPTURE OBJET (transaction, conversation) ────────────────
  // Un renommage du champ lu casse en silence la preuve de vente / la messagerie.
  // Sur le code d'avant, verifFormeObjet n'existe pas ⇒ no-op ⇒ silence ⇒ rouge.

  // 12. CONVERSATION — `messages` renommé, objet substantiel ⇒ déclenche.
  {
    const d = await diagO('conversation', { id: 9, unread: true, user: { id: 1 }, msgs_v2: [] }, 'c1');
    dit(d.n.forme_inconnue_champ_conversation === 1, 'conversation sans `messages` → forme_inconnue_champ_conversation',
      'compteur=' + (d.n.forme_inconnue_champ_conversation || 0));
    dit((d.rates.forme_champ_conversation || {}).champ === 'messages', 'le champ perdu (messages) est nommé');
    dit(JSON.stringify(d.rates.forme_champ_conversation || {}).includes('msgs_v2'), 'les clés de l’objet sont relevées (msgs_v2 vu)');
  }

  // 13. CONVERSATION légitimement VIDE — `messages: []`, la clé est là ⇒ rien.
  {
    const d = await diagO('conversation', { id: 9, unread: false, user: { id: 1 }, messages: [] }, 'c2');
    dit(!d.n.forme_inconnue_champ_conversation, 'messages présent mais vide ⇒ AUCUNE alerte (présence de clé)');
  }

  // 14. CONVERSATION ENVELOPPÉE `{conversation:{…}}` sans messages ⇒ déclenche
  //     (on juge l'objet métier, pas l'enveloppe).
  {
    const d = await diagO('conversation', { conversation: { id: 9, unread: true, user: { id: 1 }, msgs_v2: [] } }, 'c3');
    dit(d.n.forme_inconnue_champ_conversation === 1, 'enveloppe {conversation} sans messages → déclenche');
  }

  // 15. TRANSACTION — `status` renommé, transaction substantielle ⇒ déclenche.
  {
    const d = await diagO('transaction', { transaction: { id: 5, item_id: 7, status_v2: 450, buyer: 1 } }, 'x1');
    dit(d.n.forme_inconnue_champ_transaction === 1, 'transaction sans `status` → forme_inconnue_champ_transaction');
    dit((d.rates.forme_champ_transaction || {}).champ === 'status', 'le champ de vente perdu (status) est nommé');
    dit(!JSON.stringify(d.rates.forme_champ_transaction || {}).includes('"buyer":1'), 'aucune valeur ne fuit');
  }

  // 16. TRANSACTION normale — `status` présent (même à 0) ⇒ rien.
  {
    const d = await diagO('transaction', { transaction: { id: 5, item_id: 7, status: 0, buyer: 1 } }, 'x2');
    dit(!d.n.forme_inconnue_champ_transaction, 'status présent (0) ⇒ AUCUNE alerte (présence de clé, pas valeur)');
  }

  // 17. OBJET MAIGRE (< 3 clés) — réponse ratée/partielle, pas un jugement de forme.
  {
    const d = await diagO('transaction', { transaction: { id: 5 } }, 'x3');
    dit(!d.n.forme_inconnue_champ_transaction, 'transaction maigre (1 clé) ⇒ AUCUNE alerte (mieux vaut un blanc)');
  }

  // 18. DÉTAIL D'ANNONCE — `photos` renommé : le coffre ET la capture photo
  //     (Leboncoin/eBay) tombent à zéro en silence. Objet substantiel ⇒ déclenche.
  {
    const d = await diagO('item', { item: { id: 7, title: 'A', price: {}, photoz: [] } }, 'i1');
    dit(d.n.forme_inconnue_champ_item === 1, 'annonce sans `photos` → forme_inconnue_champ_item');
    dit((d.rates.forme_champ_item || {}).champ === 'photos', 'le champ photo perdu est nommé');
  }

  // 19. ANNONCE SANS PHOTO — `photos: []`, la clé est là ⇒ rien (présence de clé).
  {
    const d = await diagO('item', { item: { id: 7, title: 'A', price: {}, photos: [] } }, 'i2');
    dit(!d.n.forme_inconnue_champ_item, 'photos présent mais vide ⇒ AUCUNE alerte');
  }

  console.log(ko ? `\n❌ ${ko} échec(s)` : '\n✅ sentinelle de forme : tout vert');
  process.exit(ko ? 1 : 0);
})();
