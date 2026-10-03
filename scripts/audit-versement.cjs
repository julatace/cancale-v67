// ════════════════════════════════════════════════════════════════════════════
//  « Il faut dater la vente pour le CA du mois à la date de réception d'argent »
//  — Julien, 3 octobre.
//
//  La date certaine est celle où la transaction passe « finalisée » (statut 450,
//  `status_updated_at`). Mesuré : 26 ventes finalisées de septembre sur 56 la
//  portaient ; les autres n'avaient jamais eu leur détail relu après la
//  finalisation. `capterDatesVersement` va le relire — une LECTURE sur ses
//  propres ventes (§3), mêmes garde-fous que `capterRetraits`.
//
//  ⚠️ §4.10 : on EXÉCUTE le vrai `background.js` dans un `vm` et on COMPTE ce qui
//  part chez Vinted. §6.1 : on prouve la règle en la RÉAFFAIBLISSANT.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}${det ? ' — ' + det : ''}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const UID = '3171228253';
// La forme MESURÉE : payload.my_orders, statut en libellé, transaction_id.
const VENTES = [
  { transaction_id: 101, status: 'Commande finalisée ! Ton article est arrivé' },   // date déjà connue → rien
  { transaction_id: 102, status: 'Commande finalisée ! Ton article est arrivé' },   // détail relu AVANT la finalisation → à relire
  { transaction_id: 103, status: 'Commande finalisée ! Ton article est arrivé' },   // aucun détail → à lire
  { transaction_id: 104, status: 'Commande expédiée, en cours de livraison' },      // pas finalisée → jamais
  { transaction_id: 105, status: 'Remboursement effectué' },                         // annulée → jamais
];
const TXN = {
  101: { id: 101, status: 450, status_updated_at: '2026-09-02T10:00:00+02:00' },
  102: { id: 102, status: 300, status_updated_at: '2026-08-20T10:00:00+02:00' },
};
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

function faireCtx({ ventes = VENTES, txn = TXN, gardeStop = null, srcOverride = null, venteKO = false, txnKO = false } = {}) {
  const store = {};
  const journal = { gets: [], ecrits: [], notifs: [] };
  const lignes = { [`harvest_${UID}_orders_sold`]: { data: { payload: { my_orders: ventes } } } };
  for (const [tx, t] of Object.entries(txn)) lignes[`harvest_${UID}_txn_${tx}`] = { data: { payload: { transaction: t } } };
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
      if (m && venteKO && /orders_sold/.test(u)) return rep('<html>522</html>', 522);
      if (m && txnKO && /_txn_/.test(u)) return rep('<html>522</html>', 522);
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
  ctx.notifierApp = (e) => { journal.notifs.push(e); };
  ctx.vintedGet = async (acc, endpoint) => {
    journal.gets.push(endpoint);
    const tx = (endpoint.match(/transactions\/(\d+)/) || [])[1];
    if (!tx) return { ok: false, status: 404, json: null };
    return { ok: true, status: 200, json: { transaction: { id: Number(tx), status: 450, status_title: 'Commande finalisée', status_updated_at: '2026-09-' + String(10 + Number(tx) % 10).padStart(2, '0') + 'T08:00:00+02:00' } } };
  };
  ctx.__journal = journal; ctx.__store = store;
  return ctx;
}
const txLus = (j) => j.gets.map((e) => (e.match(/transactions\/(\d+)/) || [])[1]).filter(Boolean);
const lignesTxn = (j) => j.ecrits.flat().filter((r) => r && /_txn_/.test(r.id));

(async () => {
  if (!/async function capterDatesVersement\(/.test(SRC)) { dit(false, 'capterDatesVersement existe dans background.js'); }
  await essaie('le cas qui compte', async () => {
    const ctx = faireCtx();
    await ctx.capterDatesVersement(UID);
    const lus = txLus(ctx.__journal);
    dit(lus.includes('102') && lus.includes('103'), 'elle relit les ventes FINALISÉES dont la date de versement manque', 'lues : ' + (lus.join(',') || 'aucune'));
    dit(!lus.includes('101'), 'une vente dont la date est déjà connue n\'est pas relue');
    dit(!lus.includes('104') && !lus.includes('105'), 'ni une vente en cours, ni une remboursée (jamais du CA)');
    const ecr = lignesTxn(ctx.__journal);
    const l103 = ecr.find((r) => r.id === `harvest_${UID}_txn_103`);
    dit(!!l103 && l103.data && l103.data.payload && l103.data.payload.transaction && String(l103.data.payload.transaction.status) === '450' && !!l103.data.payload.transaction.status_updated_at,
      'la ligne est rangée sous la FORME que l\'app lit (payload.transaction.status + status_updated_at)', l103 ? 'ok' : 'non écrite');
    dit(!!l103 && l103.data.capturedAt, 'et datée de sa capture (capturedAt — §4.3, updated_at ment)');
    dit(ctx.__journal.notifs.some((e) => e && e.quoi === 'versements'), 'l\'app ouverte est prévenue (elle relit ses dates)');
    // Deuxième visite : le mémo empêche de redemander tout de suite.
    const avant = ctx.__journal.gets.length;
    ctx.__journal.gets.length = 0;
    await ctx.capterDatesVersement(UID);
    dit(txLus(ctx.__journal).length === 0, 'une seconde visite dans l\'heure ne redemande rien', txLus(ctx.__journal).length + ' lues (avant : ' + avant + ')');
  });

  const CAP = Number((/VERSEMENT_MAX_PAR_VISITE\s*=\s*(\d+)/.exec(SRC) || [])[1] || 0);
  await essaie(`bornée à ${CAP} lectures par visite`, async () => {
    const many = Array.from({ length: CAP + 4 }, (_, i) => ({ transaction_id: 900 + i, status: 'Commande finalisée' }));
    const ctx = faireCtx({ ventes: many, txn: {} });
    await ctx.capterDatesVersement(UID);
    dit(CAP > 0 && txLus(ctx.__journal).length === CAP, `au plus ${CAP} lectures quand ${CAP + 4} en ont besoin`, txLus(ctx.__journal).length + ' lues');
  });

  await essaie('garde refuse ⇒ rien', async () => {
    const ctx = faireCtx({ gardeStop: { error: 'autre compte connecté' } });
    await ctx.capterDatesVersement(UID);
    dit(txLus(ctx.__journal).length === 0, 'un refus de `garde` (autre compte, plafond) : aucune requête chez Vinted');
  });

  // « Pas su » ne vaut pas « rien » : une lecture ratée ne relance pas tout l'historique.
  await essaie('lecture des détails ratée', async () => {
    const ctx = faireCtx({ txnKO: true });
    await ctx.capterDatesVersement(UID);
    dit(txLus(ctx.__journal).length === 0, 'détails illisibles (522) ⇒ aucune requête (sinon même la 101, déjà datée, repartirait)', txLus(ctx.__journal).length + ' lues');
  });
  await essaie('lecture des ventes ratée', async () => {
    const ctx = faireCtx({ venteKO: true });
    await ctx.capterDatesVersement(UID);
    dit(txLus(ctx.__journal).length === 0, 'ventes illisibles ⇒ aucune requête');
  });

  // §6.1 — la règle RÉAFFAIBLIE : sans le test « déjà datée », la 101 est relue.
  await essaie('§6.1', async () => {
    const faible = SRC.replace("if (!/^\\d+$/.test(tx) || datees.has(tx)) continue;", "if (!/^\\d+$/.test(tx)) continue;");
    if (faible === SRC) { dit(false, 'la ligne « déjà datée » est introuvable — l\'audit ne prouve rien'); return; }
    const ctx = faireCtx({ srcOverride: faible });
    await ctx.capterDatesVersement(UID);
    dit(txLus(ctx.__journal).includes('101'), 'sur le code réaffaibli, la 101 (déjà datée) EST relue — le contrôle mord');
  });

  console.log(ko ? `\n${ko} contrôle(s) en échec.` : `\nLes dates de versement arrivent toutes seules, sans requête de trop. (${ok} contrôles)`);
  process.exit(ko ? 1 : 0);
})();
