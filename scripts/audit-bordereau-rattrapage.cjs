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

function banc({ ventes = [], labels = [], mails = [], commandeRepond = null }) {
  const commandes = [];                      // les PUT « commander le bordereau »
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
      // ⚠️ LE PUT « commander le bordereau » se distingue du GET qui va chercher
      //    le PDF : sans ça on ne peut pas mesurer si un 409 enchaîne bien sur
      //    la récupération.
      const cmd = /vinted\.fr\/api\/v2\/transactions\/(\d+)\/shipment\/order/.exec(u);
      if (cmd) { commandes.push(cmd[1]); return J(commandeRepond === 409 ? { message: 'Shipment already ordered' } : {}, commandeRepond || 200); }
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
  // ⚠️ SEULEMENT quand on mesure la COMMANDE du bordereau. Surcharger ces deux-là
  //    pour tout le monde change l'état des contrôles voisins : sans adresse,
  //    `genererBordereau` sort avant le PUT — et c'est ce que mesurent les
  //    contrôles écrits avant celui-ci. (Mon premier jet l'a fait, et « une vente
  //    à générer n'est pas récupérée deux fois » est passé au rouge sur un code
  //    intact : *un harnais qui change l'état mesure autre chose.*)
  if (commandeRepond != null) {
    ctx.adresseVendeur = async () => 42;        // sinon on n'atteint jamais le PUT
    ctx.garde = async () => null;               // le garde-fou n'est pas l'objet ici
  }
  return { ctx, demandes, commandes };
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
  // 7. LE PLAFOND PAR VISITE TIENT — quelle que soit sa valeur.
  // ⚠️ On ne fige PAS le chiffre : il a bougé de 3 à 6 (§5.88) et il rebougera.
  // Ce qu'on vérifie, c'est qu'un plafond EXISTE et qu'il est respecté à
  // l'unité près : on donne deux ventes de plus que le plafond et on compte.
  {
    const cap = Number(/const BORD_MAX_PAR_VISITE = (\d+)/.exec(src)[1]);
    const ventes = [];
    for (let k = 0; k < cap + 2; k++) ventes.push(V('2100001' + k, EXPEDIE, k + 1));
    const b = banc({ ventes });
    await b.ctx.genererBordereauxEnAttente('111');
    const n = new Set(b.demandes).size;
    dit(n === cap, `${cap + 2} ventes en retard → ${cap} par visite, pas plus`, `${n} demandée(s)`);
    // ⚠️ Le plafond par visite ne doit JAMAIS dépasser le plafond horaire :
    // sinon une seule visite épuiserait le garde-fou anti-blocage (§48).
    const heure = Number(/const ACTIONS_MAX_HEURE = (\d+)/.exec(src)[1] || 0);
    dit(heure > 0 && cap <= heure,
      `le plafond par visite (${cap}) reste sous le plafond horaire (${heure})`);
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
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠️⚠️ UN 409 VEUT DIRE « IL Y EN A DÉJÀ UN », PAS « ÇA A RATÉ »
  // ══════════════════════════════════════════════════════════════════════════
  // Mesuré le 17 septembre sur sa base : `bordereau_genere` **1** contre
  // `bordereau_refuse_409` **1** — et dans les requêtes captées de SA page, à
  // 11:58:40, `PUT /api/v2/transactions/22355375065/shipment/order` : c'est LUI
  // qui l'a commandé à la main, et cette vente est bien passée en « Bordereau
  // envoyé au vendeur ». Quand l'extension repasse derrière, Vinted répond 409.
  // On traitait ça comme un échec sec : on n'allait JAMAIS chercher le PDF, et
  // la vente était bloquée 6 h. Le bordereau existait, et il n'arrivait jamais
  // dans l'app — mot pour mot ce qu'il décrit.
  {
    const b = banc({ ventes: [V('21000009', AGENERER, 1)], commandeRepond: 409 });
    await b.ctx.genererBordereauxEnAttente('111');
    dit(b.commandes.includes('21000009'), 'on commande bien le bordereau', b.commandes.join(',') || 'aucune');
    dit(b.demandes.includes('21000009'),
      'Vinted répond « déjà commandé » (409) → on va QUAND MÊME chercher le PDF',
      b.demandes.length ? b.demandes.join(',') : 'aucune récupération — le bordereau existe et n\'arrivera jamais');
    // ⚠️ Et on ne bloque pas la vente six heures sur un « c'est déjà fait ».
    const memo = await b.ctx.chrome.storage.local.get('vrmBordFaits');
    const m = (memo.vrmBordFaits || {})['21000009'];
    dit(!!m && m.ok === true, 'et le mémo ne met pas la vente en quarantaine 6 h',
      m ? `ok=${m.ok}` : 'aucun mémo');
  }

  // ⚠️ L'AUTRE SENS : un vrai refus reste un refus. Sans ça, « tout traiter
  //    comme déjà fait » passerait le contrôle ci-dessus.
  {
    const b = banc({ ventes: [V('21000010', AGENERER, 1)], commandeRepond: 403 });
    await b.ctx.genererBordereauxEnAttente('111');
    dit(!b.demandes.includes('21000010'),
      'un vrai refus (403) ne se fait PAS passer pour un bordereau existant',
      b.demandes.join(',') || 'aucune récupération');
  }

  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nLe rattrapage des bordereaux ne laisse plus filer une vente.');
  process.exit(ko ? 1 : 0);
})();
