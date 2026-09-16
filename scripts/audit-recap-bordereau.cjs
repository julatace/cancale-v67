// ════════════════════════════════════════════════════════════════════════════
//  DEUX PLAINTES DE JULIEN, MESURÉES SUR LE VRAI `background.js`.
//
//  1. « Dès que j'appuie sur un bouton dans Vinted, j'ai "offre à trancher" qui
//     apparaît. » — Cause : les ventes et les messages étaient comparés au mémo,
//     les OFFRES non. `out.offres` valait le nombre d'offres EN ATTENTE, pas le
//     nombre de NOUVELLES : tant qu'il en restait une non tranchée, la fenêtre
//     plein écran revenait à chaque cycle de capture (Vinted est une SPA, chaque
//     bouton en relance un).
//
//  2. « Je veux que la lecture des bordereaux aille plus vite. » — Mesuré sur sa
//     base le 16 septembre : `label_url_trouve` 25 contre `label_url_introuvable`
//     28 (l'URL manque une fois sur deux), et AUCUN compteur `label_via_*` :
//     son extension est antérieure à celle qui les écrit. On ne peut donc pas
//     savoir quel chemin gagne — réordonner serait une supposition. Ce qui SE
//     mesure sans ça : une vente dont le PDF n'est pas prêt refaisait la requête
//     de transaction à CHAQUE essai, et reprenait le même échantillon 4 fois.
//
//  ⚠️ §4.10 : `node --check` ne voit rien de tout ça. On EXÉCUTE.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => {
  if (bon) { ok++; console.log(`✅ ${quoi}`); }
  else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); }
};

// Le stockage local de l'extension, pour de vrai : c'est lui qui porte le mémo
// du récap, et c'est lui qu'on compte pour les échantillons.
function faireCtx({ lignes = {}, vinted = () => ({ status: 404, json: null }) } = {}) {
  const store = {};
  const journal = { vinted: [], storageSet: 0 };
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 1)),   // on ne dort pas au banc
    clearTimeout, setInterval: () => 0, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: {
        get: function (k, cb) {
          const cles = Array.isArray(k) ? k : (typeof k === 'string' ? [k] : Object.keys(k || {}));
          const out = {}; for (const c of cles) if (store[c] !== undefined) out[c] = store[c];
          if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out);
        },
        set: function (o, cb) {
          journal.storageSet++;
          Object.assign(store, o);
          if (typeof cb === 'function') { cb(); return; } return Promise.resolve();
        },
        remove: dual(undefined),
      } },
    },
    fetch: async (url, opts = {}) => {
      const u = String(url);
      // ⚠️ `status` par défaut : sans lui, `ok` valait `undefined < 400` =
      //    FAUX, `sbGetTout` rendait `null`, et le banc mesurait « aucune
      //    offre » sur un code intact. §6.3, dans mon propre banc.
      const rep = (body, status = 200) => ({ ok: status < 400, status, json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST') return rep('[]', 201);
      // Les lectures Supabase : on sert ce qu'on nous a donné.
      const m = /app_data\?id=(?:eq|like)\.([^&]+)/.exec(u);
      if (m) {
        const cle = decodeURIComponent(m[1]).replace(/\*$/, '');
        const sortie = [];
        for (const k of Object.keys(lignes)) if (k === cle || k.startsWith(cle)) sortie.push(Object.assign({ id: k }, lignes[k]));
        return rep(JSON.stringify(sortie));
      }
      return rep('[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'background.js' });
  // `vintedGet` est la porte vers Vinted : on la remplace pour COMPTER.
  ctx.vintedGet = async (acc, chemin) => { journal.vinted.push(chemin); return vinted(chemin); };
  ctx.__journal = journal; ctx.__store = store;
  return ctx;
}

// Une conversation qui porte une offre en attente, à l'identité donnée.
const conv = (cid, oid, prix) => ({
  id: `harvest_9_conv_${cid}`, cap: new Date().toISOString(), cid: String(cid),
  opp: '42', descr: 'Une paire', it: '777',
  msgs: [{ entity_type: 'offer_request_message', entity: {
    user_id: 42, current: true, status: 10, status_title: 'En attente',
    price: { amount: prix }, transaction_id: '900' + cid, offer_request_id: String(oid),
  } }],
});

(async () => {
  // ══ 1. LES OFFRES SE COMPTENT COMME LES VENTES : celles qu'on n'a pas vues ══
  console.log('\n── « Offre à trancher » ne doit plus revenir à chaque clic');
  const lignes = {
    'harvest_9_conv_1': { data: null }, // remplacé plus bas
  };
  // On sert les conversations par la projection que le code demande.
  const servir = (convs) => {
    const l = {};
    for (const c of convs) l[c.id] = c;
    l['harvest_9_orders_sold'] = { data: { payload: { my_orders: [] } } };
    l['harvest_9_inbox'] = { data: { payload: { conversations: [] } } };
    return l;
  };

  {
    const ctx = faireCtx({ lignes: servir([conv(1, 'OFF-A', 30), conv(2, 'OFF-B', 45)]) });
    const n1 = await ctx.nouveautes('9');
    dit(n1.offres === 2, 'première lecture : les deux offres sont neuves', `offres=${n1.offres}`);
    dit(Array.isArray(n1._marque && n1._marque.offres) && n1._marque.offres.length === 2,
      'et leur identité est notée pour la suite', JSON.stringify(n1._marque && n1._marque.offres));

    // On note « vu », exactement comme le fait le vrai chemin.
    await ctx.marquerRecapVu('9', n1._marque);
    const n2 = await ctx.nouveautes('9');
    dit(n2.offres === 0, 'deuxième passage, MÊMES offres : plus rien à annoncer',
      `offres=${n2.offres} — c'est ça, la fenêtre qui revenait à chaque bouton`);

    // Une VRAIE nouvelle offre doit, elle, ressortir : c'est de l'argent et 24 h.
    const ctx2 = faireCtx({ lignes: servir([conv(1, 'OFF-A', 30), conv(2, 'OFF-B', 45), conv(3, 'OFF-C', 60)]) });
    ctx2.__store.vrmRecapVu = ctx.__store.vrmRecapVu;
    const n3 = await ctx2.nouveautes('9');
    dit(n3.offres === 1, 'une offre VRAIMENT nouvelle ressort', `offres=${n3.offres}`);
  }

  // ══ 2. LA CAPTURE DE BORDEREAU NE REDEMANDE PAS CE QU'ELLE SAIT DÉJÀ ══════
  console.log('\n── Lecture du bordereau : moins d’allers-retours pour le même travail');
  {
    // Vinted répond : la transaction existe (expédition 555), mais AUCUN des
    // trois chemins ne donne d'URL — le cas mesuré une fois sur deux chez lui.
    const vinted = (chemin) => /transactions\//.test(chemin)
      ? { status: 200, json: { transaction: { shipment: { id: 555 } }, order: { items: [] } } }
      : { status: 404, json: {} };
    const ctx = faireCtx({ vinted });
    const r = await ctx.recupererLabelInsiste({ vinted_user_id: '9' }, '9', '1234');
    const j = ctx.__journal;
    const nTxn = j.vinted.filter((c) => /transactions\//.test(c)).length;
    const nChemins = j.vinted.length - nTxn;
    dit(!r.ok, 'sans URL, la capture échoue honnêtement', r.raison);
    dit(nTxn === 1, 'la transaction n’est demandée QU’UNE FOIS pour toute la série',
      `${nTxn} appels — avant : un par essai`);
    dit(nChemins === 12, 'les trois chemins sont bien essayés à chaque tentative',
      `${nChemins} appels`);
    dit(j.vinted.length === 13, 'total : 13 requêtes Vinted au lieu de 16',
      `${j.vinted.length} requêtes`);
  }

  {
    // L'AUTRE SENS : dès que Vinted donne l'URL, on s'arrête là.
    const vinted = (chemin) => /transactions\//.test(chemin)
      ? { status: 200, json: { transaction: { shipment: { id: 555 } }, order: { items: [{ id: 1 }] } } }
      : /label_url/.test(chemin) ? { status: 200, json: { label_url: 'https://exemple/x.pdf' } }
      : { status: 404, json: {} };
    const ctx = faireCtx({ vinted });
    // Le PDF lui-même passe par `fetch` : on le sert.
    const vraiFetch = ctx.fetch;
    ctx.fetch = async (u, o) => (/exemple\/x\.pdf/.test(String(u))
      ? { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer }
      : vraiFetch(u, o));
    const r = await ctx.recupererLabelInsiste({ vinted_user_id: '9' }, '9', '1234');
    dit(r.ok, 'quand l’URL est là, le bordereau part', r.raison || '');
    dit(ctx.__journal.vinted.length === 2, 'et ça n’a coûté que deux requêtes',
      `${ctx.__journal.vinted.length} requêtes : ${ctx.__journal.vinted.join(' · ')}`);
  }

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert${ok > 1 ? 's' : ''}, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error('❌ l’audit est tombé :', e && e.stack); process.exit(1); });
