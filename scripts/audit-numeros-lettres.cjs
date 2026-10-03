#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « NUMÉROS À LETTRES » — B125, C123… (3 octobre)
//
//  Le numéro relie une annonce Leboncoin à SA paire par la référence
//  « VRM-{n°} » (§5 : jamais par titre). Avant, « VRM-B125 » se lisait « 125 » :
//  la paire N°125 — une AUTRE — était crue déjà en ligne et sortait de la file,
//  et la vraie B125 était proposée une seconde fois.
//  On EXÉCUTE le vrai `background.js` (vm) et les vrais helpers d'App.jsx, et
//  on exige que l'app et l'extension rendent les MÊMES clés (§11).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const racine = path.join(__dirname, '..');
const BG = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'background.js'), 'utf8');
const APP = fs.readFileSync(path.join(racine, 'src', 'App.jsx'), 'utf8');
const dual = (v) => function (...a) { const cb = a[a.length - 1]; if (typeof cb === 'function') { cb(v); return; } return Promise.resolve(v); };
let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = (nom, f) => { try { return f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message).slice(0, 120)); return undefined; } };

// ── L'extension ──────────────────────────────────────────────────────────
const ctx = {
  console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
  btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  chrome: {
    runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
    alarms: { create() {}, onAlarm: { addListener() {} } }, cookies: { get: dual(null), getAll: dual([]), onChanged: { addListener() {} } },
    downloads: { onCreated: { addListener() {} } }, action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    tabs: { onUpdated: { addListener() {} }, query: dual([]), sendMessage: dual(undefined) },
    storage: { local: { get: dual({}), set: dual(undefined), remove: dual(undefined) } },
  },
  fetch: async () => ({ ok: true, status: 200, json: async () => [], text: async () => '[]', headers: { get: () => 'application/json' } }),
};
ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
vm.createContext(ctx);
essaie('background.js se charge', () => vm.runInContext(BG, ctx, { filename: 'background.js' }));

const cles = (ad) => essaie('adRefKeys', () => ctx.adRefKeys(ad, {})) || [];
{
  const k = cles({ id: 1, customRef: 'VRM-B125', subject: 'Nike Air Max' });
  dit(k.includes('B125') && !k.includes('125'), 'extension : « VRM-B125 » désigne B125, jamais la paire 125', JSON.stringify(k));
}
{
  const k = cles({ id: 2, customRef: 'VRM-125', subject: 'Nike Air Max' });
  dit(k.length === 1 && k[0] === '125', 'extension : « VRM-125 » désigne toujours 125 (rien ne change en chiffres)', JSON.stringify(k));
}
{
  const k = cles({ id: 3, subject: 'Salomon XT-6 VRM-b12' });
  dit(k.includes('B12'), 'extension : la réf écrite en minuscules dans le titre se lit B12', JSON.stringify(k));
}
{
  const r = essaie('refFromText', () => ctx.refFromText('Très bon état.\n\nRéférence : VRM-C40'));
  dit(r === 'C40', 'extension : la référence de la description se lit C40', String(r));
}

// ── L'app : les helpers du module, extraits tels quels ─────────────────────
const debut = APP.indexOf('const cleNum = ');
const fin = APP.indexOf('// Annote un bordereau (PDF)', debut);
const H = {};
if (debut < 0 || fin < 0) dit(false, 'app : les helpers de numéro existent (cleNum…)', 'introuvables');
else {
  const hctx = { load: (k, d) => (k === 'vrm_num_prefixe' ? H.pref : d), H };
  vm.createContext(hctx);
  essaie('app : helpers chargés', () => vm.runInContext(APP.slice(debut, fin) + '\nH.cleNum=cleNum;H.refVRMDe=refVRMDe;H.entreePool=entreePool;H.prochainLibre=prochainLibre;H.NUM_OK=NUM_OK;', hctx, { filename: 'App.jsx' }));
  if (H.cleNum) {
    dit(H.cleNum('b 125') === 'B125' && H.cleNum('B-125') === 'B125' && H.cleNum('007') === '7', 'app : « b 125 », « B-125 » = B125 ; « 007 » = 7');
    dit(H.entreePool('B125') === 'B125' && H.entreePool('125') === 125 && H.entreePool('n/d') === null, 'app : le pool garde B125 (texte) et 125 (entier), refuse le reste');
    dit(H.prochainLibre(new Set([1, 2]), new Set(), '') === '3' && H.prochainLibre(new Set(), new Set(['B1', 'B2']), 'B') === 'B3', 'app : prochain libre = 3 en chiffres, B3 dans la série B');
    const entrees = ['VRM-B125', 'VRM-125', 'VRM-b12', 'Ref 2024-15', 'VRM-C40', 'VRM-007'];
    const ecarts = entrees.filter((t) => H.refVRMDe(t) !== ctx.refVRMDe(t));
    dit(ecarts.length === 0, 'app et extension lisent la MÊME référence (§11)', ecarts.map((t) => `${t}: app ${H.refVRMDe(t)} / ext ${ctx.refVRMDe(t)}`).join(' · '));
  }
}
console.log(ko ? `\n❌ numéros à lettres : ${ko} rouge(s)` : '\n✅ numéros à lettres : tout est vert');
process.exit(ko ? 1 : 0);
