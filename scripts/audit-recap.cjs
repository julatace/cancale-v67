// ⚠️ CONTRÔLE PERMANENT — « ça ne s'allume QUE s'il y a du nouveau ».
// Exécute le VRAI `nouveautes()` / `proposerBordereaux()` du service worker dans
// un `vm`, avec un faux `chrome` et un faux Supabase. Ce qu'on vérifie :
//   1. rien de neuf  → AUCUN message envoyé à l'onglet (la fenêtre ne s'ouvre pas)
//   2. une vente     → un message, avec la vente et le bon montant
//   3. deux passages → la 2e fois, plus rien (le repère a été posé)
//   4. 1re visite    → on ne déballe pas tout l'historique comme une nouveauté
//   5. onglet pas prêt → on NE marque PAS « déjà vu » (sinon la question ne
//      revient jamais — c'était « la génération a du mal à se faire »)
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

function banc({ ventes = [], convs = [], labels = [], memo = null, ongletPret = true }) {
  const envoyes = [];
  const store = memo ? { vrmRecapVu: { '111': memo } } : {};
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
      tabs: {
        onUpdated: { addListener() {} },
        query: dual([{ id: 1 }]),
        sendMessage: (id, msg) => { if (!ongletPret) return Promise.reject(new Error('pas prêt')); envoyes.push(msg); return Promise.resolve(); },
      },
      storage: { local: {
        get: function (k, cb) { const out = {}; const ks = typeof k === 'string' ? [k] : (Array.isArray(k) ? k : Object.keys(k || {})); ks.forEach(x => { if (store[x] !== undefined) out[x] = store[x]; }); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set: function (o, cb) { Object.assign(store, o); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined) } },
    },
    fetch: async (url) => {
      const u = String(url);
      const J = (o, st = 200) => ({ ok: st < 400, status: st, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => 'application/json' } });
      if (/orders_sold/.test(u)) return J([{ data: { payload: { my_orders: ventes } } }]);
      if (/_inbox/.test(u)) return J([{ data: { payload: { conversations: convs } } }]);
      if (/email_bord_/.test(u)) return J([]);
      if (/_label_/.test(u)) return J(labels.map(tx => ({ tx })));
      if (/harvest_111_conv_/.test(u)) return J([]);
      if (/rest\/v1\//.test(u)) return J([]);
      return J({});
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'background.js' });
  return { ctx, envoyes, store };
}

const V = (tx, titre, prix, statut) => ({ transaction_id: tx, title: titre, price: { amount: String(prix) }, status: statut || 'Le paiement a été validé' });

(async () => {
  let ko = 0;
  const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

  // 1. RIEN DU TOUT
  {
    const b = banc({});
    await b.ctx.proposerBordereaux('111');
    dit(b.envoyes.length === 0, "rien de neuf → la fenêtre ne s'ouvre pas", `${b.envoyes.length} message(s)`);
  }
  // 2. UNE VENTE NOUVELLE, repère déjà posé
  {
    const b = banc({ ventes: [V('t1', 'Adidas 38', 45), V('t2', 'Nike 42', 52)],
                     memo: { at: Date.now() - 3600e3, ventes: ['t1'], convs: {} } });
    await b.ctx.proposerBordereaux('111');
    const m = b.envoyes[0];
    dit(b.envoyes.length === 1 && m && m.ventes.length === 1 && m.ventes[0].tx === 't2' && m.eur === 52,
      'une vente nouvelle → un récap, la bonne vente, le bon montant',
      m ? `${m.ventes.length} vente(s), ${m.eur} €` : 'aucun message');
  }
  // 3. DEUXIÈME PASSAGE : plus rien
  {
    const b = banc({ ventes: [V('t1', 'Adidas 38', 45)], labels: ['t1'],
                     memo: { at: Date.now() - 3600e3, ventes: [], convs: {} } });
    await b.ctx.proposerBordereaux('111');
    const n1 = b.envoyes.length;
    b.envoyes.length = 0;
    await b.ctx.proposerBordereaux('111');
    dit(n1 === 1 && b.envoyes.length === 0, 'le repère est posé : le 2e passage ne réaffiche rien',
      `1er ${n1}, 2e ${b.envoyes.length}`);
  }
  // 4. PREMIÈRE VISITE : pas de déballage d'historique
  {
    const b = banc({ ventes: Array.from({ length: 40 }, (_, i) => V('h' + i, 'vieille vente', 20, 'Transaction finalisée')),
                     convs: [{ id: 'c1', unread: true, updated_at: 'x' }] });
    await b.ctx.proposerBordereaux('111');
    dit(b.envoyes.length === 0, "première visite → on pose le repère sans annoncer 40 ventes d'un coup",
      `${b.envoyes.length} message(s)`);
  }
  // 5. ONGLET PAS PRÊT : on ne marque pas « vu »
  {
    const b = banc({ ventes: [V('t9', 'Adidas', 30)], memo: { at: 1, ventes: [], convs: {} }, ongletPret: false });
    await b.ctx.proposerBordereaux('111');
    const marque = (b.store.vrmRecapVu || {})['111'] || {};
    dit(!(marque.ventes || []).includes('t9'),
      "onglet pas prêt → la vente n'est PAS marquée vue (la question reviendra)");
  }
  // 6. MESSAGE NON LU DÉJÀ VU DANS CET ÉTAT : ne resonne pas
  {
    const b = banc({ convs: [{ id: 'c1', unread: true, updated_at: '2026-08-26T10:00:00Z' }],
                     memo: { at: 1, ventes: [], convs: { c1: '2026-08-26T10:00:00Z' } } });
    await b.ctx.proposerBordereaux('111');
    dit(b.envoyes.length === 0, 'une conversation non lue laissée exprès ne resonne pas');
  }
  // 7. LA MÊME CONVERSATION QUI BOUGE : elle resonne
  {
    const b = banc({ convs: [{ id: 'c1', unread: true, updated_at: '2026-08-26T12:00:00Z' }],
                     memo: { at: 1, ventes: [], convs: { c1: '2026-08-26T10:00:00Z' } } });
    await b.ctx.proposerBordereaux('111');
    dit(b.envoyes.length === 1 && b.envoyes[0].messages === 1, 'un nouveau message dans la même conversation resonne');
  }
  // 8. LE BORDEREAU PART TOUT SEUL : le récap l'annonce même si rien d'autre
  //    n'a bougé (« une fois que la vente a été faite, je veux que le bordereau
  //    soit automatiquement envoyé dans l'app », Julien 27 août).
  {
    const b = banc({ memo: { at: Date.now(), ventes: [], convs: {} } });
    await b.ctx.proposerBordereaux('111', 2);
    const m = b.envoyes[0];
    dit(b.envoyes.length === 1 && m && m.envoyes === 2,
      "un bordereau parti tout seul est ANNONCÉ, même sans autre nouveauté",
      m ? `envoyes=${m.envoyes}` : 'aucun message');
  }
  // 9. LA VISITE GÉNÈRE (plus de lectureSeule) et rafraîchit les ventes vite.
  {
    const src2 = require('fs').readFileSync(require('path').join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
    const i = src2.indexOf('async function visiteVinted');
    const bloc = src2.slice(i, i + 2600);
    dit(/const genes = await genererBordereauxEnAttente\(uid\);/.test(bloc) && !/lectureSeule: true/.test(bloc),
      'la visite génère le bordereau toute seule (plus de lecture seule)');
    dit(/rafraichirVentes\(uid\)/.test(bloc) && /VENTES_DELAI_MS/.test(bloc),
      'les ventes se rafraîchissent seules, sans attendre la moisson complète');
    dit(/async function rafraichirVentes/.test(src2) && /fetchAllOrders\(acc, 'sold'\)/.test(src2),
      'rafraichirVentes réutilise fetchAllOrders + storeHarvestRow (une seule règle)');
  }
  console.log(ko ? `\n${ko} contrôle(s) non conforme(s).` : "\nLe récap ne s'allume que quand il y a vraiment du nouveau.");
  process.exit(ko ? 1 : 0);
})();
