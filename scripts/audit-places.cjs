// ⚠️ CONTRÔLE PERMANENT — « LES ANNONCES QUE L'ON SÉLECTIONNE ».
//
// Demande de Julien (11 septembre) : « lorsqu'une annonce est publiée sur
// n'importe quel compte associé à VRM, je veux que ça publie les annonces que
// l'on SÉLECTIONNE sur Leboncoin, eBay, etc. »
// Le « peu importe le compte » était déjà vrai : la file se construit sur les
// annonces en ligne de TOUS les comptes moissonnés. Ce qui manquait, c'est le
// CHOIX. Il vit dans `vinted_annonce_numeros[id].mp` — la même ligne que le
// numéro, le prix d'achat et le prix plancher : l'app en est propriétaire,
// l'extension le lit (§11).
//
// Ce script exécute le VRAI `buildLbcData()` du service worker dans un `vm`,
// sur trois annonces en ligne de DEUX comptes différents :
//   · une sélectionnée explicitement  → dans la file
//   · une retirée explicitement       → PAS dans la file
//   · une jamais touchée              → dans la file (le défaut vaut OUI, sinon
//     la nouveauté aurait vidé sa file du jour au lendemain)
// Et il vérifie que l'app applique la MÊME règle : les deux calculent la file
// chacun de leur côté (le panneau tourne sur leboncoin.fr, où l'app n'est pas
// chargée), donc une règle appliquée d'un seul côté fait diverger les deux
// écrans — « 12 à publier » ici, 8 là-bas.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

// Deux comptes, trois annonces numérotées en ligne — « peu importe le compte ».
const NUMEROS = {
  '101': { numero: '101', title: 'Paire A', mp: { lbc: true } },   // choisie
  '202': { numero: '202', title: 'Paire B', mp: { lbc: false } },  // retirée
  '303': { numero: '303', title: 'Paire C' },                      // jamais touchée
};
const LISTINGS = [
  { id: 'harvest_9001_listings', data: { uid: '9001', payload: { items: [
    { id: 101, title: 'Paire A', price: { amount: '40' } },
    { id: 202, title: 'Paire B', price: { amount: '50' } },
  ] } } },
  { id: 'harvest_9002_listings', data: { uid: '9002', payload: { items: [
    { id: 303, title: 'Paire C', price: { amount: '60' } },
  ] } } },
];

function ctxAvec(numeros) {
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
      const u = String(url);
      const j = (d) => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d), headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST') return { ok: true, status: 201, json: async () => ({}), text: async () => '', headers: { get: () => '' } };
      if (/id=eq\.main/.test(u)) return j([{ data: { vinted_annonce_numeros: numeros, vinted_accounts: [
        { vinted_user_id: '9001', login: 'compteA' }, { vinted_user_id: '9002', login: 'compteB' }] } }]);
      if (/id=like\.harvest_\*_listings/.test(u)) return j(LISTINGS);
      return j([]);
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'background.js' });
  return ctx;
}

(async () => {
  const ctx = ctxAvec(NUMEROS);
  const r = await ctx.buildLbcData();
  const nums = (r.queue || []).map(a => String(a.numero)).sort();

  dit(nums.includes('101'), 'une annonce SÉLECTIONNÉE est dans la file Leboncoin', 'file : ' + (nums.join(', ') || 'vide'));
  dit(!nums.includes('202'), 'une annonce RETIRÉE n\'y est pas',
    nums.includes('202') ? 'elle serait préparée alors qu\'il l\'a décochée' : '');
  dit(nums.includes('303'), 'une annonce JAMAIS TOUCHÉE y est (le défaut vaut oui)',
    nums.includes('303') ? '' : 'la sélection a vidé sa file : une nouveauté ne doit pas éteindre ce qui marchait');
  // « Peu importe le compte » : la file mélange bien les deux comptes.
  dit(nums.includes('101') && nums.includes('303'), 'et elle prend les annonces de TOUS les comptes',
    'compteA + compteB');

  // ── Tout retirer doit vider la file, sinon le choix ne sert à rien ─────────
  {
    const aucun = {}; for (const k in NUMEROS) aucun[k] = { ...NUMEROS[k], mp: { lbc: false } };
    const r2 = await ctxAvec(aucun).buildLbcData();
    dit((r2.queue || []).length === 0, 'tout retirer vide vraiment la file', `${(r2.queue || []).length} restante(s)`);
  }

  // ── LA MÊME RÈGLE DES DEUX CÔTÉS ──────────────────────────────────────────
  // L'app et le panneau calculent la file chacun de leur côté. Une règle posée
  // d'un seul côté fait diverger les deux écrans.
  dit(/mpChoisi\s*\(\s*e\s*,\s*'lbc'\s*\)/.test(APP), 'l\'app applique le même filtre sur SA file',
    'sinon l\'app annonce un nombre et le panneau en montre un autre');
  const defExt = /const MP_DEFAUT = \{ lbc: true \}/.test(src);
  const defApp = /defaut: true/.test(APP) && /MP_PLACES/.test(APP);
  dit(defExt && defApp, 'et le même défaut (Leboncoin = oui tant qu\'on n\'a rien décoché)',
    `extension ${defExt ? 'ok' : 'non'} · app ${defApp ? 'ok' : 'non'}`);
  // `undefined` (jamais touché) ne doit jamais être confondu avec `false`.
  const troisEtats = (t) => /v === undefined \|\| v === null/.test(t);
  dit(troisEtats(src) && troisEtats(APP), '« jamais touché » reste distinct de « retiré exprès »',
    'sinon décocher et ne rien faire deviennent la même chose');
  // Une annonce qu'il a retirée ne doit pas disparaître SANS UN MOT (§5).
  dit(/retirees/.test(APP) && /pas dans cette file/.test(APP),
    'une annonce retirée est comptée et dite, jamais effacée en silence');

  console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nLa file part de SA sélection, sur tous ses comptes.');
  process.exit(ko ? 1 : 0);
})();
