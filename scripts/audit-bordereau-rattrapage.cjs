// ⚠️ CONTRÔLE PERMANENT — « la vente s'en va sans même avoir envoyé le
// bordereau à l'app » (Julien, 27 août).
// La 2ᵉ passe de `genererBordereauxEnAttente` ne regardait QUE les ventes encore
// « en attente d'envoi » : à la seconde où Vinted passait la vente à « expédiée »
// ou « finalisée », on cessait DÉFINITIVEMENT d'aller chercher son PDF. Or le
// PDF n'est pas prêt à l'instant de la génération.
// MESURÉ sur la vraie base : 90 ventes de moins de 45 j avec leur étiquette chez
// Vinted et AUCUN PDF dans l'app — l'ancienne condition n'en couvrait qu'UNE.
//
// Ce script exécute le VRAI `genererBordereauxEnAttente()` dans un `vm` et
// vérifie QUELLES transactions sont réellement demandées à Vinted.
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
const jours = (n) => new Date(Date.now() - n * 86400000).toISOString();

function banc({ ventes = [], labels = [], mails = [] }) {
  const demandes = [];                       // les transactions réellement lues chez Vinted
  const store = {};
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (f) => f(), clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
      storage: { local: {
        get: function (k, cb) { const out = {}; const ks = typeof k === 'string' ? [k] : (Array.isArray(k) ? k : Object.keys(k || {})); ks.forEach(x => { if (store[x] !== undefined) out[x] = store[x]; }); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set: function (o, cb) { Object.assign(store, o); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined) } },
    },
    fetch: async (url) => {
      const u = String(url);
      const J = (o, st = 200) => ({ ok: st < 400, status: st, json: async () => o, text: async () => JSON.stringify(o), arrayBuffer: async () => new ArrayBuffer(0), headers: { get: () => 'application/json' } });
      // Appels VINTED : c'est ce qu'on mesure.
      const tx = /vinted\.fr\/api\/v2\/transactions\/(\d+)/.exec(u);
      if (tx) { demandes.push(tx[1]); return J({ transaction: {} }); }   // pas d'expédition exposée → échec propre
      if (/vinted\.fr\//.test(u)) return J({});
      // Supabase
      if (/orders_sold/.test(u)) return J([{ data: { payload: { my_orders: ventes } } }]);
      if (/email_bord_/.test(u)) return J(mails.map(t => ({ tx: t })));
      if (/_label_/.test(u)) return J(labels.map(t => ({ tx: t })));
      if (/vinted_accounts/.test(u)) return J([{ vinted_user_id: '111', domain: 'www.vinted.fr', access_token: 'x' }]);
      if (/rest\/v1\//.test(u)) return J([]);
      return J({});
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'background.js' });
  ctx.getStoredAccounts = async () => [{ vinted_user_id: '111', domain: 'www.vinted.fr', access_token: 'x' }];
  ctx.compteConnecte = async () => '111';
  return { ctx, demandes };
}
const V = (tx, statut, j, titre) => ({ transaction_id: tx, title: titre || ('Paire ' + tx), status: statut, date: jours(j), price: { amount: '40' } });
const EXPEDIE = "Commande expédiée et en cours d'acheminement !";
const FINAL = "Commande finalisée - l'acheteur a validé la commande";
const ATTEND = 'Bordereau envoyé au vendeur';
const AGENERER = 'Le paiement a été validé';

(async () => {
  let ko = 0;
  const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

  // 1. LE CŒUR DU DÉFAUT : une vente DÉJÀ PARTIE, sans PDF → on va le chercher.
  {
    const b = banc({ ventes: [V('21000001', EXPEDIE, 3)] });
    await b.ctx.genererBordereauxEnAttente('111');
    dit(b.demandes.includes('21000001'), "vente déjà expédiée sans PDF → on va quand même chercher son bordereau", b.demandes.join(',') || 'aucune demande');
  }
  // 2. Une vente FINALISÉE récente compte aussi (l'étiquette a existé).
  {
    const b = banc({ ventes: [V('21000002', FINAL, 5)] });
    await b.ctx.genererBordereauxEnAttente('111');
    dit(b.demandes.includes('21000002'), 'vente finalisée récente sans PDF → récupérée aussi', b.demandes.join(',') || 'aucune');
  }
  // 3. TROP VIEILLE : le lien n'existe plus, on n'insiste pas.
  {
    const b = banc({ ventes: [V('21000003', FINAL, 40)] });
    await b.ctx.genererBordereauxEnAttente('111');
    dit(!b.demandes.includes('21000003'), 'vente de 40 jours → on ne part pas à la pêche', b.demandes.join(',') || 'aucune');
  }
  // 4. LE PDF EST DÉJÀ LÀ (capté) → aucune requête.
  {
    const b = banc({ ventes: [V('21000004', EXPEDIE, 2)], labels: ['21000004'] });
    await b.ctx.genererBordereauxEnAttente('111');
    dit(!b.demandes.includes('21000004'), 'PDF déjà capté → aucune requête', b.demandes.join(',') || 'aucune');
  }
  // 5. LE PDF EST ARRIVÉ PAR EMAIL → aucune requête non plus.
  {
    const b = banc({ ventes: [V('21000005', EXPEDIE, 2)], mails: ['21000005'] });
    await b.ctx.genererBordereauxEnAttente('111');
    dit(!b.demandes.includes('21000005'), 'PDF reçu par email → aucune requête', b.demandes.join(',') || 'aucune');
  }
  // 6. ANNULÉE / REMBOURSÉE → jamais.
  {
    const b = banc({ ventes: [V('21000006', 'Remboursement effectué', 2)] });
    await b.ctx.genererBordereauxEnAttente('111');
    dit(!b.demandes.includes('21000006'), 'vente remboursée → on ne cherche rien', b.demandes.join(',') || 'aucune');
  }
  // 7. LE PLAFOND PAR VISITE TIENT (3).
  {
    const b = banc({ ventes: [V('21000011', EXPEDIE, 1), V('21000012', EXPEDIE, 2), V('21000013', EXPEDIE, 3), V('21000014', EXPEDIE, 4), V('21000015', EXPEDIE, 5)] });
    await b.ctx.genererBordereauxEnAttente('111');
    const n = new Set(b.demandes).size;
    dit(n === 3, '5 ventes en retard → 3 par visite, pas plus', `${n} demandée(s)`);
  }
  // 8. PRIORITÉ : ce qui attend TON envoi passe devant l'historique.
  {
    const b = banc({ ventes: [V('21000021', FINAL, 4), V('21000022', FINAL, 5), V('21000023', FINAL, 6), V('21000030', ATTEND, 9)] });
    await b.ctx.genererBordereauxEnAttente('111');
    dit(b.demandes.includes('21000030'), "la vente qui attend l'envoi passe avant les anciennes", b.demandes.join(','));
  }
  // 9. Une vente à GÉNÉRER n'est pas « à récupérer » (elle passe par la 1ʳᵉ passe).
  {
    const b = banc({ ventes: [V('21000009', AGENERER, 1)] });
    await b.ctx.genererBordereauxEnAttente('111');
    const lu = b.demandes.filter(x => x === '21000009').length;
    dit(lu <= 1, "une vente à générer n'est pas récupérée deux fois", `${lu} lecture(s)`);
  }
  // 10. ON N'INSISTE PAS SUR UNE VENTE DÉJÀ PARTIE (4 requêtes pour rien).
  {
    const b = banc({ ventes: [V('21000041', EXPEDIE, 2)] });
    await b.ctx.genererBordereauxEnAttente('111');
    const n = b.demandes.filter(x => x === '21000041').length;
    dit(n === 1, 'vente déjà partie → UNE seule requête, pas quatre', `${n} requête(s)`);
  }
  // 11. …MAIS ON INSISTE quand le PDF est en train d'être fabriqué.
  {
    const b = banc({ ventes: [V('21000042', ATTEND, 1)] });
    await b.ctx.genererBordereauxEnAttente('111');
    const n = b.demandes.filter(x => x === '21000042').length;
    dit(n > 1, "vente qui attend l'envoi → on réessaie le temps que le PDF arrive", `${n} requête(s)`);
  }
  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nLe rattrapage des bordereaux ne laisse plus filer une vente.');
  process.exit(ko ? 1 : 0);
})();
