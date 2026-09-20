// ════════════════════════════════════════════════════════════════════════════
//  « Je veux que ça capture toutes les photos EN PASSIF » — Julien, 20 sept.
//  (« je veux pas aller sur l'annonce »).
//
//  MESURÉ sur sa base : la liste du dressing (`harvest_{uid}_listings`) ne porte
//  que la COUVERTURE (`photo` = un objet) + le vrai compte (`nPhotos`). Le jeu
//  complet ne vit que dans le détail de l'annonce. `capterPhotosAnnonces` va donc
//  le lire EN FOND — une lecture sur SES propres annonces (§3), avec les mêmes
//  garde-fous que `capterRetraits`/`capterReleves` : compte connecté (`garde`),
//  N par visite, une par une, pas de nouvel essai avant 24 h.
//
//  ⚠️ §4.10 : `node --check` ne voit rien. On EXÉCUTE le vrai `background.js`
//  dans un `vm` et on COMPTE ce qui part chez Vinted. §6.1 : on prouve la RÈGLE
//  en la RÉAFFAIBLISSANT (retirer le filtre « en ligne » ⇒ le contrôle rougit) —
//  « la fonction n'existait pas avant » n'est pas une preuve.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}${det ? ' — ' + det : ''}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const UID = '3171228253';
const img = (id, i) => `https://images1.vinted.net/t/aa_${id}/f800/${id}${i}`;
// Réponse de détail à la forme Vinted : { item:{ id, photos:[{full_size_url}], description } }.
const detail = (id, nb) => ({ item: { id: Number(id), description: 'desc ' + id, photos: Array.from({ length: nb }, (_, i) => ({ id: i, full_size_url: img(id, i), url: img(id, i) })) } });

// Le dressing capté : id + nPhotos + état, la forme MESURÉE (payload.items).
const LISTINGS = [
  { id: 111, nPhotos: 9, is_closed: false, is_hidden: false },  // capté 6 → manque
  { id: 222, nPhotos: 3, is_closed: false, is_hidden: false },  // capté 0 → manque
  { id: 333, nPhotos: 12, is_closed: true, is_hidden: false },  // FERMÉE → ne pas toucher
  { id: 444, nPhotos: 1, is_closed: false, is_hidden: false },  // 1 photo → rien à compléter
  { id: 555, nPhotos: 5, is_closed: false, is_hidden: false },  // déjà 5/5 → complet
];

function faireCtx({ items = LISTINGS, dejaPhotos = {}, gardeStop = null, srcOverride = null, detailKO = false } = {}) {
  const store = {};
  const journal = { gets: [], ecrits: [] };
  const lignes = {
    [`harvest_${UID}_listings`]: { data: { payload: { items } } },
    vinted_item_details: { data: dejaPhotos },
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)), clearTimeout, setInterval: () => 0, clearInterval,
    URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: '5.95.0' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: {
        get: function (k, cb) { const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {})); const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = store[c]; if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set: function (o, cb) { Object.assign(store, o); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined),
      } },
    },
    fetch: async (url, opts = {}) => {
      const u = String(url);
      const rep = (body, status = 200) => ({ ok: status < 400, status, json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST' && /\/rest\/v1\//.test(u)) {
        try { const corps = JSON.parse(opts.body || '[]'); journal.ecrits.push(corps);
          // lecture-après-écriture : l'écriture persiste, comme la vraie base.
          for (const row of corps) if (row && row.id) lignes[row.id] = { data: row.data };
        } catch (_) {}
        return rep('[]', 201);
      }
      const m = /app_data\?id=(?:eq|like)\.([^&]+)/.exec(u);
      if (m) {
        const cle = decodeURIComponent(m[1]).replace(/\*$/, ''); const exact = /id=eq\./.test(u);
        const sel = decodeURIComponent((u.match(/select=([^&]+)/) || [])[1] || 'data');
        // ⚠️ §6.3 — ON HONORE LA PROJECTION. Le code lit `rows[0].items` (alias
        //    `items:data->payload->items`), pas la ligne brute : servir `{id,data}`
        //    mesurerait une fiction (0 photo) sur un code intact.
        const projette = (ligne) => {
          const o = { id: ligne.__id };
          for (const champ of sel.split(',')) {
            const mm = champ.match(/^([^:]+):data->(?:>)?(.+)$/);
            if (mm) { const alias = mm[1]; let v = ligne.data; for (const p of mm[2].split('->').map(x => x.replace(/>/g, ''))) v = v == null ? v : v[p]; o[alias] = v; }
            else if (champ.trim() === 'data') o.data = ligne.data;
          }
          return o;
        };
        const sortie = [];
        for (const k of Object.keys(lignes)) { if (lignes[k] === undefined) continue; if (exact ? k === cle : (k === cle || k.startsWith(cle))) sortie.push(projette(Object.assign({ __id: k }, lignes[k]))); }
        return rep(JSON.stringify(sortie));
      }
      return rep('[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(srcOverride || SRC, ctx, { filename: 'background.js' });
  ctx.getStoredAccounts = async () => [{ vinted_user_id: UID, login: 'julatace3535', domain: 'www.vinted.fr' }];
  ctx.garde = async () => gardeStop;
  ctx.logActivity = async () => {};
  ctx.noterDiag = async () => {};
  ctx.echantillonRate = async () => {};
  // La porte vers Vinted : on COMPTE et on sert le détail (ou un refus).
  ctx.vintedGet = async (acc, endpoint) => {
    journal.gets.push(endpoint);
    const id = (endpoint.match(/items\/(\d+)/) || [])[1];
    if (detailKO) return { ok: false, status: 502, json: null };
    const nb = { '111': 9, '222': 3, '333': 12, '555': 5 }[id] || 0;
    return { ok: true, status: 200, json: detail(id, nb) };
  };
  ctx.__journal = journal; ctx.__store = store;
  return ctx;
}
const idsVus = (j) => j.gets.map((e) => (e.match(/items\/(\d+)/) || [])[1]).filter(Boolean);
// Ce qui a été RANGÉ dans vinted_item_details (dernière écriture de la ligne).
const photosRangees = (j) => { let out = {}; for (const e of j.ecrits) { const l = (e || []).find((x) => x && x.id === 'vinted_item_details'); if (l) out = l.data; } return out; };

(async () => {
  // ══ 1. LE CAS QUI COMPTE : il ouvre Vinted, l'extension complète les photos ══
  await essaie('capterPhotosAnnonces complète les annonces en ligne', async () => {
    const ctx = faireCtx({ dejaPhotos: {
      '111': { photos: [0, 1, 2, 3, 4, 5].map((i) => img(111, i)), description: 'x' },   // 6/9 → manque
      '555': { photos: [0, 1, 2, 3, 4].map((i) => img(555, i)) },                          // 5/5 → complet
    } });
    const n = await ctx.capterPhotosAnnonces(UID);
    const vus = idsVus(ctx.__journal);
    dit(vus.includes('111') && vus.includes('222'), 'elle va lire le détail des annonces à qui il MANQUE des photos', 'lues : ' + vus.join(',') || 'aucune');
    dit(!vus.includes('333'), 'une annonce FERMÉE n\'est pas touchée', vus.includes('333') ? 'elle a été lue' : 'ignorée');
    dit(!vus.includes('444'), 'une annonce à 1 photo n\'est pas relue pour rien');
    dit(!vus.includes('555'), 'une annonce déjà complète (5/5) n\'est pas relue');
    const rang = photosRangees(ctx.__journal);
    dit((rang['111'] || {}).photos && rang['111'].photos.length === 9, 'les 9 photos de la 111 sont rangées (le jeu COMPLET, pas la couverture)', 'rangées : ' + ((rang['111'] || {}).photos || []).length);
    dit((rang['222'] || {}).photos && rang['222'].photos.length === 3, 'et les 3 de la 222', 'rangées : ' + ((rang['222'] || {}).photos || []).length);
    dit(n >= 1, 'elle rapporte ce qu\'elle a fait', 'n=' + n);
  });

  // ══ 2. BORNÉ : 3 PAR VISITE (le garde-fou §3, sur NOS lectures Vinted) ══════
  await essaie('bornée à 3 lectures Vinted par visite', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: 900 + i, nPhotos: 5, is_closed: false, is_hidden: false }));
    const ctx = faireCtx({ items: many });
    await ctx.capterPhotosAnnonces(UID);
    const vus = idsVus(ctx.__journal);
    dit(vus.length <= 3, 'au plus 3 annonces lues, même quand 8 en ont besoin', vus.length + ' lues');
  });

  // ══ 3. COMPTE CONNECTÉ : garde refuse ⇒ RIEN ne part chez Vinted ═══════════
  await essaie('un refus de `garde` (plafond horaire / autre compte) arrête tout', async () => {
    const ctx = faireCtx({ gardeStop: { error: 'plafond atteint' } });
    await ctx.capterPhotosAnnonces(UID);
    dit(idsVus(ctx.__journal).length === 0, 'aucune lecture Vinted quand garde refuse', idsVus(ctx.__journal).length + ' lues');
  });

  // ══ 4. §6.1 — LA RÈGLE, RÉAFFAIBLIE : sans le filtre « en ligne », une annonce
  //      FERMÉE serait lue. Le contrôle doit alors ROUGIR (ici : « lue »).
  await essaie('§6.1 — retirer le filtre « en ligne » fait lire une annonce fermée (le contrôle mord)', async () => {
    const faible = SRC.replace('if (it.is_closed || it.is_hidden || it.is_draft) return false;   // en ligne seulement', '// (filtre retiré pour la preuve)');
    if (faible === SRC) { dit(false, 'la ligne de filtre attendue est introuvable — l\'audit ne prouve rien'); return; }
    const ctx = faireCtx({ srcOverride: faible });
    await ctx.capterPhotosAnnonces(UID);
    const lueFermee = idsVus(ctx.__journal).includes('333');
    dit(lueFermee, 'sur le code réaffaibli, la 333 (fermée) EST lue — donc le filtre est bien ce qui protège');
  });

  // ══ 5. L'AUTRE SENS : aucune donnée à compléter ⇒ zéro requête ═════════════
  await essaie('rien à compléter ⇒ aucune requête (pas de bruit dans l\'empreinte du compte)', async () => {
    const ctx = faireCtx({ items: [{ id: 555, nPhotos: 5, is_closed: false, is_hidden: false }], dejaPhotos: { '555': { photos: [1, 2, 3, 4, 5].map((i) => img(555, i)) } } });
    await ctx.capterPhotosAnnonces(UID);
    dit(idsVus(ctx.__journal).length === 0, 'aucune lecture quand tout est déjà capté');
  });

  console.log(`\n${ko ? '❌ ' + ko + ' rouge(s)' : '✅ tout vert'} · ${ok} contrôle(s)`);
  process.exit(ko ? 1 : 0);
})();
