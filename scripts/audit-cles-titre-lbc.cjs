// ⚠️ CONTRÔLE PERMANENT — LE « nXXX » D'UN TITRE VINTED N'EST PAS UNE CLÉ (31 oct.)
//
// La file Leboncoin (extension `buildLbcData` → `vintedKeys`, app → `vKeys`)
// reliait une annonce Vinted à une annonce Leboncoin aussi par le « n230 » écrit
// dans son TITRE. Après la remise à zéro 013, « n230 » d'un titre peut être
// l'ancien numéro d'une AUTRE paire : la paire N°5, jamais publiée, sortait de la
// file (« déjà en ligne sur Leboncoin ») parce que l'annonce Leboncoin de la
// N°230 existe. Un rapprochement par ressemblance (§5). Le N° de la fiche seul
// est une identité ; le dossier demandait de le retirer des deux côtés (§11).
//
// Le VRAI background.js (vm) et la VRAIE ligne `vKeys` de l'app.
// `--mutation=ext` remet le titre côté extension, `--mutation=app` côté app.
const fs = require('fs'), vm = require('vm'), path = require('path');
const { metaVersData } = require('./bancs/_meta.cjs');
const racine = path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let src = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
let APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
if (MUT === 'ext') src = src.replace("if (num != null && String(num).trim() !== '') { const k = cleNum(num); if (k) keys.push(k); }",
  "if (num != null && String(num).trim() !== '') { const k = cleNum(num); if (k) keys.push(k); } { const m = /\\bn\\s*°?\\s*(\\d{1,5})\\b/i.exec(String((o.raw && o.raw.title) || '')); if (m) keys.push(cleNum(m[1])); }");
if (MUT === 'app') APP = APP.replace("return e.numero ? [cleNum(e.numero)].filter(Boolean) : []; };",
  "const ks = e.numero ? [cleNum(e.numero)] : []; const m = /\\bn\\s*°?\\s*(\\d{1,5})\\b/i.exec(String(_title || e.title || '')); if (m) ks.push(cleNum(m[1])); return ks; };");
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const LU_RECENT = new Date(Date.now() - 3600e3).toISOString();
// La paire N°5 en ligne, au titre qui porte encore son ancien « n230 ».
const LISTINGS = [
  { id: 'harvest_9001_listings', data: { uid: '9001', capturedAt: LU_RECENT, payload: { items: [
    { id: 101, title: 'Nike dunk low noir n230', price: { amount: '40' } },
  ] } } },
  { id: 'harvest_9002_listings', data: { uid: '9002', capturedAt: LU_RECENT, payload: { items: [] } } },
];
function projette(rows, url) {
  const sel = decodeURIComponent((/[?&]select=([^&]*)/.exec(url) || [])[1] || '');
  if (!sel || sel === '*') return rows;
  const parts = sel.split(',').map((x) => x.trim()).filter(Boolean);
  return rows.map((row) => {
    const out = {};
    for (const part of parts) {
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

function ctxAvec(numeros, txns, lbcItems, exclus, quiEchoue, bloquesDef) {
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
      storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } },
    },
    fetch: async (url, opts = {}) => {
      const u = metaVersData(String(url));
      // ⚠️ On sert la VRAIE forme d'un échec : 522 + HTML, pas un JSON d'erreur.
      if (quiEchoue && u.includes(quiEchoue) && (opts.method || 'GET') === 'GET') {
        return { ok: false, status: 522, json: async () => { throw new Error('HTML'); }, text: async () => '<html>522</html>', headers: { get: () => 'text/html' } };
      }
      const j = (d) => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d), headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST') return { ok: true, status: 201, json: async () => ({}), text: async () => '', headers: { get: () => '' } };
      // ⚠️ MÊME RÈGLE POUR `main` : les files la lisent PROJETÉE (197 Ko sinon,
      //    §4.4). Servir la ligne brute ferait lire `main.vinted_annonce_numeros`
      //    sur un objet qui ne l'a pas → file VIDE, et l'audit crierait au loup
      //    sur un code intact. C'est le piège de l'écran Colis, deuxième fois.
      if (/id=eq\.main/.test(u)) return j(projette([{ data: { vinted_annonce_numeros: numeros, vinted_accounts_hidden: exclus || [], vinted_accounts: [
        { vinted_user_id: '9001', login: 'compteA' }, { vinted_user_id: '9002', login: 'compteB' }] } }], u));
      if (/id=like\.harvest_\*_listings/.test(u)) return j(LISTINGS);
      // La PREUVE d'une vente : `transaction → item_id` (§5, l'identité).
      // ⚠️⚠️ ET ON APPLIQUE LA PROJECTION POUR DE VRAI (§6.3). Le code demande
      //    `select=it:data->payload->transaction->>item_id` ; servir la ligne
      //    BRUTE ferait lire `r.it` sur un objet qui ne l'a pas — donc « aucune
      //    vente prouvée », et l'audit mesurerait une fiction. C'est le piège
      //    qui avait fait afficher « 0 bordereau prêt » sur l'écran Colis.
      if (/id=like\.harvest_\*_txn_\*/.test(u)) return j(projette(txns || [], u));
      // Les annonces Leboncoin captées — dont celles qui NE SONT PAS à lui.
      if (/id=eq\.lbc_listings/.test(u)) return j(lbcItems ? [{ data: { items: lbcItems } }] : []);
      // Les comptes supprimés DÉFINITIVEMENT (liste distincte de hidden/blocked).
      if (/id=eq\.vrm_blocked_accounts/.test(u)) return j(bloquesDef ? [{ data: { uids: bloquesDef.map(String), logins: [] } }] : []);
      return j([]);
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'background.js' });
  ctx.authToken = async () => ({user_id:'vendeur_banc',access_token:'jeton.banc.x',expires_at:Date.now()+3600e3}); ctx.loadSession=ctx.authToken;
  return ctx;
}


(async () => {
  const NUM = { '101': { numero: '5', title: 'Nike dunk low noir n230', mp: { lbc: true } },
                '777': { numero: '230', title: 'Autre paire', mp: { lbc: true } } };
  // L'annonce Leboncoin de la N°230 (référence VRM, à lui), toujours en vente.
  const ITEMS = { '900': { id: '900', ref: '230', customRef: 'VRM-230', subject: 'Autre paire', url: 'https://www.leboncoin.fr/ad/900', status: 'active' } };
  let r = null;
  try { r = await ctxAvec(NUM, [], ITEMS).buildLbcData(); } catch (e) { dit(false, 'buildLbcData a tourné', String(e && e.message || e)); }
  if (r) {
    const nums = (r.queue || []).map((a) => String(a.numero));
    dit(nums.includes('5'), 'extension : la N°5 (titre « n230 ») reste dans la file Leboncoin',
      nums.includes('5') ? '' : 'sortie comme « déjà sur Leboncoin » par le titre — §5');
    const ret = (r.removals || []).map((x) => String(x.numero));
    dit(ret.includes('230'), 'extension : l\'annonce Leboncoin de la N°230 (pas en ligne sur Vinted) est « à vérifier / à retirer »',
      ret.includes('230') ? '' : 'le « n230 » du titre de la N°5 la disait encore en ligne');
  }
  // L'app : la vraie ligne `vKeys`, exécutée.
  const m = /const vKeys = \(id, _?title\) => \{[^\n]*\};/.exec(APP);
  dit(!!m, 'app : la règle `vKeys` est retrouvée');
  if (m) {
    const f = new Function('numeros', 'cleNum', 'numFrom', m[0] + '\nreturn vKeys;')(NUM, (v) => String(v).toUpperCase().replace(/^0+(?=\d)/, ''),
      (t) => { const x = /\bn\s*°?\s*(\d{1,5})\b/i.exec(String(t || '')); return x ? x[1] : null; });   // le « numFrom » d'avant, si une copie ancienne l'appelle
    const ks = f('101', 'Nike dunk low noir n230');
    dit(ks.length === 1 && ks[0] === '5', 'app : seule la clé du N° de la fiche (5)', 'clés : ' + JSON.stringify(ks));
    dit(f('999', 'Sans fiche n42').length === 0, 'app : une annonce sans fiche n\'a aucune clé', 'jamais le titre');
  }
  // Et plus aucune lecture d'un « nXXX » de titre Vinted pour les N° « connus ».
  dit(!/numFrom\(e\.title\)/.test(APP), 'app : les N° « connus » ne viennent plus du titre');
  console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nLe N° de la fiche seul relie Vinted et Leboncoin.');
  process.exit(ko ? 1 : 0);
})();
