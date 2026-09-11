// ⚠️⚠️ CONTRÔLE PERMANENT — UNE LECTURE RATÉE NE DOIT JAMAIS EFFACER UNE LIGNE.
//
// L'extension range ses données dans des lignes DÉDIÉES (`panel_min_prices`,
// `panel_buyprices`, `panel_accounts_off`, `panel_bords_done`, …) et les met à
// jour en **lire-fusionner-réécrire** : elle relit la ligne, ajoute sa clé, et
// réécrit la ligne ENTIÈRE.
//
// Dix de ces onze endroits écrivaient `const cur = (rows && rows[0] && ...) || {}`.
// Or `sbGet` rend `null` quand la base n'a PAS RÉPONDU : la fusion repartait
// alors d'un objet vide, et l'écriture remplaçait la ligne par la seule clé
// courante. Un simple timeout de lecture — la base debout par ailleurs —
// suffisait donc à effacer :
//   · TOUS ses prix planchers (posés à la main, et sans plancher le moteur
//     d'offres ne fait plus rien) ;
//   · TOUS ses prix d'achat saisis depuis le panneau (§2.5) ;
//   · quels comptes il a éteints (un compte exclu se rallume) ;
//   · les codes de retrait déjà lus dans les conversations ;
//   · les bordereaux faits, les colis récupérés, ce qui est déjà sur Leboncoin.
// C'est le même défaut que `push_subs` côté serveur, en onze exemplaires.
//
// ⚠️ LE CAS QUI DÉTRUIT N'EST PAS LA PANNE TOTALE : quand tout est tombé,
//    l'écriture échoue aussi et rien n'est perdu. C'est **lecture KO, écriture
//    OK** qu'il faut servir — et c'est ce que fait ce contrôle.
//
// Il exécute le VRAI `background.js` dans un `vm`, comme audit-retrait-conv.
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };

let lectureKO = false;          // la lecture échoue-t-elle ?
let ligne = {};                 // ce que la base contient déjà
const ecrits = [];              // les upserts partis

function faireCtx() {
  ecrits.length = 0;
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
      const rep = (ok, body, status) => ({ ok, status: status || (ok ? 200 : 522), json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
      if ((opts.method || 'GET') === 'POST') {
        try { JSON.parse(opts.body || '[]').forEach(r => ecrits.push(r)); } catch (_) {}
        return rep(true, '', 201);
      }
      // ⚠️ LA VRAIE FORME DE LA PANNE : Cloudflare rend du HTML avec un 522.
      if (lectureKO) return { ok: false, status: 522, json: async () => { throw new Error('HTML'); }, text: async () => '<html>522</html>', headers: { get: () => 'text/html' } };
      const m = /id=eq\.([a-zA-Z0-9_]+)&select/.exec(u);
      if (m && ligne[m[1]] !== undefined) return rep(true, JSON.stringify([{ data: ligne[m[1]] }]));
      return rep(true, '[]');
    },
  };
  ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
  vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'background.js' });
  return ctx;
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };

// Chaque ligne dédiée : ce qu'elle contient DÉJÀ, et le geste qui la met à jour.
const CAS = [
  { id: 'panel_min_prices',      avant: { '111': 45, '222': 30 }, quoi: 'ses prix planchers',
    geste: (c) => c.setMinPrice('333', 60), garde: (d) => d['111'] === 45 && d['222'] === 30 && d['333'] === 60 },
  { id: 'panel_buyprices',       avant: { items: { '111': { price: 12 } } }, quoi: 'ses prix d\'achat saisis à la main',
    geste: (c) => c.setBuyPrice('222', '20', 't', 'Paire'), garde: (d) => d.items && d.items['111'] && d.items['222'] },
  { id: 'panel_accounts_off',    avant: { '9001': true }, quoi: 'les comptes qu\'il a éteints',
    geste: (c) => c.setAccountOff('9002', true), garde: (d) => d['9001'] === true && d['9002'] === true },
  { id: 'panel_bords_done',      avant: { 'AAA': 1 }, quoi: 'les bordereaux marqués faits',
    geste: (c) => c.markBordDone('BBB', true), garde: (d) => d['AAA'] === 1 && d['BBB'] },
  { id: 'panel_colis_collected', avant: { 'XX1': 1 }, quoi: 'les colis marqués récupérés',
    geste: (c) => c.markPickupDone('XX2', true), garde: (d) => d['XX1'] === 1 && d['XX2'] },
  { id: 'panel_colis_relais',    avant: { '700': { tx: '700', code: 'C1', lieu: 'L1', at: new Date().toISOString() } },
    quoi: 'les codes de retrait déjà lus',
    geste: (c) => c.noterRetrait({ tx: '800', code: 'C2', lieu: 'L2', at: new Date().toISOString() }),
    garde: (d) => d['700'] && d['700'].code === 'C1' && d['800'] },
  { id: 'vinted_lbc_posted',     avant: { ids: ['1', '2'] }, quoi: 'ce qui est déjà publié sur Leboncoin',
    geste: (c) => c.markLbcPosted('3'), garde: (d) => d.ids.includes('1') && d.ids.includes('2') && d.ids.includes('3') },
  { id: 'vinted_listing_dates',  avant: { '111': { ts: 1 } }, quoi: 'les dates de mise en ligne',
    geste: (c) => c.saveListingDate('222', 2, 'il y a 2 jours'), garde: (d) => d['111'] && d['222'] },
  { id: 'vinted_item_details',   avant: { '111': { description: 'd1', photos: [] } }, quoi: 'les descriptions captées',
    geste: (c) => c.saveItemDetail('222', { description: 'd2', photos: [] }), garde: (d) => d['111'] && d['222'] },
];

(async () => {
  console.log('── LECTURE RATÉE, ÉCRITURE POSSIBLE (le cas qui détruit)');
  for (const cas of CAS) {
    ligne = { [cas.id]: cas.avant }; lectureKO = true;
    const ctx = faireCtx();
    try { await cas.geste(ctx); } catch (_) {}
    const ecrase = ecrits.some(r => r.id === cas.id);
    dit(!ecrase, `${cas.id} : ${cas.quoi} ne sont pas effacés`,
      ecrase ? 'la ligne est réécrite depuis une lecture ratée' : '');
  }

  console.log('\n── ET EN MARCHE NORMALE, LA MISE À JOUR PASSE (l\'autre sens)');
  for (const cas of CAS) {
    ligne = { [cas.id]: cas.avant }; lectureKO = false;
    const ctx = faireCtx();
    try { await cas.geste(ctx); } catch (e) { dit(false, `${cas.id} : le geste lève`, e.message); continue; }
    const w = ecrits.find(r => r.id === cas.id);
    dit(!!w && cas.garde(w.data || {}), `${cas.id} : la nouvelle clé s'ajoute SANS perdre les anciennes`,
      w ? JSON.stringify(w.data).slice(0, 90) : 'aucune écriture');
  }

  console.log(ko ? `\n${ko} contrôle(s) en échec.` : '\nUne lecture ratée n\'efface plus rien.');
  process.exit(ko ? 1 : 0);
})();
