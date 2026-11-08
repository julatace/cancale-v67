// 5.328 : le VRAI bridge.js annonce `canal: 'pont'` quand SON manifeste n'a pas
// `externally_connectable` (paquet Orion, Firefox) — et rien sinon (Chrome).
// Exécuté dans un `vm` avec une fausse page ; aucune donnée réelle.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const racine = process.env.VRM_UI_ROOT || path.resolve(__dirname, '../..');
const SRC = fs.readFileSync(path.join(racine, 'vinted-sync-extension/bridge.js'), 'utf8');
function annonce(manifeste) {
  const postes = [];
  const fenetre = { postMessage: (m) => postes.push(m), addEventListener() {}, removeEventListener() {} };
  const ctx = { window: fenetre, document: { addEventListener() {}, removeEventListener() {}, createElement() { return { style: {}, setAttribute() {}, remove() {} }; } },
    setTimeout: () => 0, clearTimeout() {}, console,
    chrome: { runtime: { id: 'abcdefghijklmnopabcdefghijklmnop', getManifest: () => manifeste, getURL: (p) => 'chrome-extension://x/' + p, sendMessage() {}, onMessage: { addListener() {} } } } };
  ctx.globalThis = ctx;
  vm.createContext(ctx); vm.runInContext(SRC, ctx);
  return postes.find((m) => m && m.__vmr === 'ready');
}
const orion = annonce({ version: '5.328.0', manifest_version: 2 });
assert.equal(orion && orion.canal, 'pont', 'paquet sans externally_connectable : « canal: pont »');
const chrome = annonce({ version: '5.328.0', manifest_version: 3, externally_connectable: { matches: ['https://vrm.center/*'] } });
assert.ok(chrome && !('canal' in chrome), 'Chrome (externally_connectable) : aucun « canal »');
console.log('2 contrôles : le pont dit « canal: pont » sans canal direct, et rien sur Chrome.');
