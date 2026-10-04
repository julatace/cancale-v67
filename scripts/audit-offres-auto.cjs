// Banc `vm` : exécute le VRAI autoAccepterOffres() du background.
// On relève les requêtes réellement envoyées à Vinted -> on voit exactement
// quelles offres ont été acceptées, et lesquelles ne l'ont PAS été.
const fs = require('fs'), vm = require('vm');
const { metaVersData } = require('./bancs/_meta.cjs');
const path = require('path');

// Applique le `select=` comme PostgREST : sans ça un banc sert une FORME que le
// code ne sait pas lire, et il mesure une fiction (§6.3).
function projette(rows, url) {
  const sel = decodeURIComponent((/[?&]select=([^&]*)/.exec(url) || [])[1] || '');
  if (!sel || sel === '*') return rows;
  return rows.map((row) => {
    const out = {};
    for (const part of sel.split(',').map((x) => x.trim()).filter(Boolean)) {
      const m = /^(?:([^:]+):)?(.+)$/.exec(part); if (!m) continue;
      const src = m[2];
      const alias = m[1] || src.split('->').pop().replace(/^>/, '');
      if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
      if (src === 'data') { out[alias] = row.data; continue; }
      if (/^data(->|->>)/.test(src)) {
        let v = row.data;
        for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = (v == null ? null : v[seg]);
        out[alias] = (v == null) ? null : v;
        continue;
      }
      out[alias] = row[src];
    }
    return out;
  });
}

const src = fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

// Une conversation captée qui porte une offre de l'acheteur.
const conv = ({ id, tx, oid, item, prix, status = 10, current = true, titre = 'paire', deMoi = false }) => ({
  id: `harvest_111_conv_${id}`,
  data: {
    capturedAt: new Date().toISOString(),
    payload: {
      conversation: {
        id, description: titre,
        opposite_user: { id: 42 },
        transaction: { item_id: item },
        messages: [{
          entity_type: 'offer_request_message',
          entity: {
            user_id: deMoi ? 7 : 42, current, status,
            price: { amount: String(prix) },
            transaction_id: tx, offer_request_id: oid,
          },
        }],
      },
    },
  },
});

function faireBanc({ convs, mins = {}, minsApp = {}, actif = true, connecte = '111', memo = {}, ia = null, repondus = {} }) {
  const envois = [], logs = [], reponses = [];
  const store = { vrmAutoOffres: { actif }, vrmOffresFaites: memo, vrmActions: {} };
  const ctx = {
    console: { log: (...a) => logs.push(a.join(' ')), warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'), URL, TextDecoder, TextEncoder,
    chrome: {
      runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 'test' }), lastError: null, id: 'x' },
      alarms: { create() {}, onAlarm: { addListener() {} } },
      tabs: { onUpdated: { addListener() {} }, query: dual([]) },
      cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
      downloads: { onCreated: { addListener() {} } },
      storage: { local: {
        get: function (k, cb) { const out = {}; const ks = typeof k === 'string' ? [k] : (Array.isArray(k) ? k : Object.keys(k || {})); ks.forEach(x => { if (store[x] !== undefined) out[x] = store[x]; }); if (typeof cb === 'function') { cb(out); return; } return Promise.resolve(out); },
        set: function (o, cb) { Object.assign(store, o); if (typeof cb === 'function') { cb(); return; } return Promise.resolve(); },
        remove: dual(undefined) } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    },
    fetch: async (url, opt = {}) => {
      const u = metaVersData(String(url)); const m = (opt.method || 'GET').toUpperCase();
      const J = (o, st = 200) => ({ ok: st < 400, status: st, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => 'application/json' }, arrayBuffer: async () => new ArrayBuffer(0) });
      if (/\/rest\/v1\/vinted_accounts/.test(u)) return J([{ vinted_user_id: '111', login: 'moi', domain: 'www.vinted.fr', access_token: 't', anon_id: 'a', csrf_token: 'c' }]);
      if (/id=eq\.panel_min_prices/.test(u)) return J([{ data: mins }]);
      if (/id=eq\.main.*vinted_annonce_numeros/.test(u)) return J([{ nums: minsApp }]);
      if (/id=eq\.panel_msg_repondus/.test(u)) return J([{ data: repondus }]);
      // Réponse de l'IA (/api/ai, mode reply) : stubée par cas via `ia`.
      if (/\/api\/ai(\b|$)/.test(u) || /vrm\.center\/api\/ai/.test(u)) return J(ia || {});
      // ⚠️⚠️ ON APPLIQUE LA PROJECTION POUR DE VRAI (§6.3). `capterOffres` demande
      //    `select=id,cap:…,cid:…,msgs:…` : servir la ligne BRUTE ferait lire
      //    `r.msgs` sur un objet qui ne l'a pas, donc « aucune offre » — et
      //    l'audit mesurerait une fiction en se croyant vert. C'est le piège qui
      //    avait fait afficher « 0 bordereau prêt » sur l'écran Colis.
      if (/id=like\.harvest_111_conv_/.test(u)) return J(projette(convs, u));
      // Lecture d'UNE conversation par son id (convDernierMessageId, select=data).
      {
        const mc = /id=eq\.harvest_\d+_conv_(\d+)/.exec(u);
        if (mc) { const row = convs.find((c) => c.id.endsWith('_conv_' + mc[1])); return J(row ? [{ data: row.data }] : []); }
      }
      if (/\/rest\/v1\//.test(u)) return J([]);
      if (/vinted\.[a-z]+\/api\//.test(u)) {
        const chemin = u.replace(/^https:\/\/[^/]+/, '');
        envois.push(m + ' ' + chemin);
        if (/\/conversations\/\d+\/replies$/.test(chemin)) {
          let body = null; try { body = JSON.parse(opt.body || '{}'); } catch (_) {}
          reponses.push({ chemin, body: (body && body.reply && body.reply.body) || '' });
        }
        return J({ ok: true });
      }
      return J({});
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'background.js' });
  ctx.activeUidForDomain = async () => connecte;
  ctx.activeAccountId = async () => connecte;
  return { ctx, envois, logs, store, reponses };
}

// Une conversation qui porte une offre acceptable ET un message texte de
// l'acheteur (une question), pour tester la réponse après acceptation.
const convAvecQuestion = ({ id, tx, oid, item, prix, question, allowReply = true }) => ({
  id: `harvest_111_conv_${id}`,
  data: { capturedAt: new Date().toISOString(), payload: { conversation: {
    id, description: 'paire', allow_reply: allowReply,
    opposite_user: { id: 42 },
    transaction: { item_id: item },
    messages: [
      { entity_type: 'message', entity: { id: 7001, user_id: 42, body: question } },
      { entity_type: 'offer_request_message', entity: {
        user_id: 42, current: true, status: 10, price: { amount: String(prix) },
        transaction_id: tx, offer_request_id: oid } },
    ],
  } } },
});

// ⚠️⚠️ RETIRÉ LE 4 OCTOBRE — DÉCISION DE JULIEN : « je ne veux pas que ça accepte
//    tout seul les offres ». Cet audit PROUVAIT que le moteur accepte (au-dessus du
//    plancher, trois par visite, etc.) ; il prouve maintenant qu'il n'accepte
//    JAMAIS — quelles que soient les conditions les plus favorables à une
//    acceptation. C'est le nouvel invariant (§3, anti-blocage : une acceptation
//    automatique est de la même famille que les messages en série aux favoris et
//    la republication en file). L'acceptation MANUELLE depuis la messagerie reste
//    une autre voie, non testée ici.
//    §6.1 : rouge sur le code d'avant (il acceptait 1, 3, etc.), vert après.
(async () => {
  // Les conditions les PLUS favorables à une acceptation — interrupteur ON, bon
  // compte connecté, offre au-dessus (ou pile) du plancher : rien ne doit partir.
  const cas = [
    { nom: "offre au-dessus du plancher, interrupteur ON, bon compte → JAMAIS acceptée",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45 })], mins: { i1: 40 } },
    { nom: "offre PILE au plancher → JAMAIS acceptée",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 40 })], mins: { i1: 40 } },
    { nom: "plancher posé dans l'APP (vinted_annonce_numeros) → JAMAIS acceptée",
      convs: [conv({ id: 1, tx: 900, oid: 5001, item: 'i1', prix: 45 })], mins: {}, minsApp: { i1: { minPrice: 40 } } },
    { nom: "cinq offres toutes acceptables → AUCUNE acceptée (plus de « 3 par visite »)",
      convs: [1, 2, 3, 4, 5].map(i => conv({ id: i, tx: 900 + i, oid: 5000 + i, item: 'i' + i, prix: 45 })),
      mins: { i1: 40, i2: 40, i3: 40, i4: 40, i5: 40 } },
  ];

  let ko = 0;
  for (const c of cas) {
    const b = faireBanc(c);
    const n = await b.ctx.autoAccepterOffres('111');
    const acc = b.envois.filter(e => /offer_requests\/\d+\/accept$/.test(e));
    const ok = acc.length === 0 && !n;
    if (!ok) ko++;
    console.log(`${ok ? '✅' : '❌'} ${c.nom} — accepté ${acc.length}, retour ${n}`);
    if (!ok) console.log('     envois :', JSON.stringify(b.envois));
  }

  // La gare rend toujours « éteint », même interrupteur ON : c'est le chokepoint.
  {
    const b = faireBanc({ convs: [], actif: true });
    const actif = await b.ctx.offresAutoActif();
    const ok = actif === false;
    if (!ok) ko++;
    console.log(`${ok ? '✅' : '❌'} offresAutoActif() rend toujours false (interrupteur ON ignoré) — ${actif}`);
  }

  console.log(ko ? `\n${ko} cas non conforme(s).` : "\nL'acceptation automatique des offres est retirée : rien n'est accepté à sa place.");
  process.exit(ko ? 1 : 0);
})();
