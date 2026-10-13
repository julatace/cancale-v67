import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const moduleUrl = new URL('../src/vintedPublication.js', import.meta.url);
if (process.argv.includes('--prouve')) {
  const original = fs.readFileSync(moduleUrl, 'utf8');
  const mutations = {
    'gel-retire': ["if (p.length) return", "if (false) return"],
    'gel-expire': ["const p = Object.values(e.pending || {});", "const p = Object.values(e.pending || {}).filter(v => Date.now() - v.depuis < 72 * 3600000);"],
    'capture-vide-efface': ["const pending = objet(precedent.pending) ? { ...precedent.pending } : {};", "const pending = {};"],
    'autre-compte-identite': ["m[1] !== uid || (r.tx", "false || (r.tx"],
    'ancre-glissante': ["return objet(r?.data) && Number.isFinite(r.data.at) ? r.data.at : undefined;", "return maintenant;"],
    'cas-ignore': ["const relu = ok ? await store.lire(id) : undefined;", "const relu = { data: next };"],
    'numero-multiple-accepte': ["if (ids.length > 1)", "if (false)"],
    'marqueur-inconnu-accepte': ["if (!marqueurLu)", "if (false)"],
  };
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-k1-mutations-'));
  try {
    for (const [name, [before, after]] of Object.entries(mutations)) {
      assert.ok(original.includes(before), 'ancre mutation ' + name);
      const file = path.join(temp, name + '.mjs');
      fs.writeFileSync(file, original.replace(before, after).replace("'../api/_lib/numerotation.js'", JSON.stringify(new URL('../api/_lib/numerotation.js', import.meta.url).href)));
      const r = spawnSync(process.execPath, [new URL(import.meta.url).pathname], { encoding: 'utf8', env: { ...process.env, VRM_K1_MODULE: file } });
      assert.notEqual(r.status, 0, 'mutation reste verte : ' + name);
      assert.match(r.stderr, /AssertionError/, 'mutation échoue pour une autre raison : ' + name);
      console.log('OK mutation détectée : ' + name);
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  process.exit(0);
}
const { calculerGelK1, activationK1, memoriserGelK1, gardePublicationK1, JOUR_K1 } = await import(process.env.VRM_K1_MODULE ? pathToFileURL(process.env.VRM_K1_MODULE).href : moduleUrl.href);
const now = Date.parse('2026-10-13T06:00:00Z');
const sale = (tx, days = 1, status = 'À expédier') => ({ transaction_id: tx, date: new Date(now - days * JOUR_K1).toISOString(), status });
const base = { activation: now, uid: '111', ventes: [sale('91')], transactions: [], bordereaux: [], maintenant: now };
let n = 0;
function test(name, fn) { return Promise.resolve().then(fn).then(() => { n++; console.log('OK ' + name); }); }
const fiches = { '701': { numero: '1', accountId: '111' }, '702': { numero: '10', accountId: '222' } };
const garde = (etats, pairId = '701', numero = '1', extra = {}) => gardePublicationK1({ etats, fiches, pairId, numero, marqueurLu: true, ...extra });
const memory = () => {
  const rows = new Map(); let writes = 0;
  return { rows, get writes() { return writes; },
    lire: async id => rows.has(id) ? structuredClone(rows.get(id)) : null,
    creer: async (id, data) => { writes++; if (!rows.has(id)) rows.set(id, { data: structuredClone(data), updated_at: String(writes) }); return true; },
    remplacer: async (id, data, version) => { writes++; if (rows.get(id)?.updated_at !== version) return false; rows.set(id, { data: structuredClone(data), updated_at: String(writes) }); return true; },
  };
};
await test('vente sans identité : gel du seul compte, même titre partout', () => {
  const a = calculerGelK1(base);
  assert.equal(Object.keys(a.pending).length, 1);
  assert.equal(garde({ '111': a, '222': { pending: {} } })?.k, 'compte-gele');
  assert.equal(garde({ '111': a, '222': { pending: {} } }, '702', '10'), null);
});
await test('J+4 et J+100 : aucune expiration, même après disparition de la capture', () => {
  const a = calculerGelK1(base);
  for (const days of [4, 100]) assert.equal(Object.keys(calculerGelK1({ ...base, precedent: a, ventes: [], maintenant: now + days * JOUR_K1 }).pending).length, 1);
  assert.equal(garde({ '111': { ...a, pending: { '91': { ...a.pending['91'], depuis: now - 100 * JOUR_K1 } } } })?.k, 'compte-gele');
});
await test('ancre fixe : historique ancien sans gel, fenêtre ne glisse jamais', () => {
  const a = calculerGelK1({ ...base, ventes: [sale('92', 31), sale('91', 29)] });
  assert.deepEqual(Object.keys(a.pending), ['91']); assert.deepEqual(Object.keys(a.anciens), ['92']);
  assert.deepEqual(Object.keys(calculerGelK1({ ...base, precedent: a, ventes: [], maintenant: now + 100 * JOUR_K1 }).pending), ['91']);
});
await test('date ou état inconnus : gel, jamais une absence de vente', () => {
  assert.equal(Object.keys(calculerGelK1({ ...base, ventes: [{ transaction_id: '91' }] }).pending).length, 1);
});
await test('identité sans état : paire bloquée, compte dégelé, zéro preuve auto', () => {
  const a = calculerGelK1({ ...base, transactions: [{ id: 'harvest_111_txn_91', it: '701', ti: '' }] });
  assert.equal(Object.keys(a.pending).length, 0); assert.equal(garde({ '111': a })?.k, 'vente-probable'); assert.equal(a.preuves, undefined);
  const b = calculerGelK1({ ...base, precedent: a, ventes: [], transactions: [] });
  assert.equal(garde({ '111': b })?.k, 'vente-probable');
});
await test('conversation seule sans vente : aucune preuve, aucun gel', () => {
  const a = calculerGelK1({ ...base, ventes: [], transactions: [{ id: 'harvest_111_txn_91', it: '701', ti: '' }] });
  assert.equal(garde({ '111': a }), null);
});
await test('bordereau seul, lot et autre compte : identités exactes', () => {
  const a = calculerGelK1({ ...base, bordereaux: [{ id: 'harvest_111_label_91', it: '701' }] });
  assert.equal(garde({ '111': a })?.k, 'vente-probable');
  const lot = calculerGelK1({ ...base, bordereaux: [{ id: 'harvest_111_label_91', items: [{ id: '701' }, { item_id: '703' }] }] });
  assert.deepEqual(lot.probables.sort(), ['701', '703']);
  const autre = calculerGelK1({ ...base, bordereaux: [{ id: 'harvest_222_label_91', it: '701' }, { id: 'harvest_111_label_latest', tx: '91', it: '701' }, { id: 'harvest_111_label_91', tx: '92', it: '701' }] });
  assert.equal(garde({ '111': autre })?.k, 'compte-gele');
});
await test('remboursement lu résout le gel et la paire, sans effacer les autres', () => {
  const a = calculerGelK1({ ...base, ventes: [sale('91'), sale('92')], bordereaux: [{ id: 'harvest_111_label_91', it: '701' }] });
  const b = calculerGelK1({ ...base, precedent: a, ventes: [sale('91', 1, 'Remboursement effectué')] });
  assert.deepEqual(Object.keys(b.pending), ['92']); assert.equal(b.probables.includes('701'), false);
});
await test('sources contradictoires : compte gelé, jamais une identité choisie au hasard', () => {
  const a = calculerGelK1({ ...base, transactions: [{ id: 'harvest_111_txn_91', it: '701', ti: 'Payée' }], bordereaux: [{ id: 'harvest_111_label_91', it: '703' }] });
  assert.equal(garde({ '111': a })?.k, 'compte-gele');
  assert.equal(garde({ '111': calculerGelK1({ ...base, precedent: a, ventes: [], transactions: [], bordereaux: [] }) })?.k, 'compte-gele');
});
await test('lien manuel : compte dégelé, paire vendue bloquée ; autre compte rejeté', () => {
  const lien = { uid: '111', tx: '91', numero: '1', itemId: '701', at: now };
  const a = calculerGelK1({ ...base, liens: { '111:91': lien } });
  assert.equal(Object.keys(a.pending).length, 0); assert.equal(garde({ '111': a })?.k, 'vente-probable');
  assert.equal(garde({ '111': a }, '701', '10', { fiches: { '701': { numero: '10', accountId: '111' } } })?.k, 'vente-probable');
  assert.equal(garde({ '111': a }, '703', '1', { fiches: { '703': { numero: '1', accountId: '111' } } }), null); // ancien numéro seul : jamais une identité
  assert.equal(Object.keys(calculerGelK1({ ...base, liens: { '111:91': { ...lien, uid: '222' } } }).pending).length, 1);
});
await test('numéro multiple, origine inconnue ou marqueur pas su : aucune décision positive', () => {
  assert.equal(garde({}, '701', '1', { marqueurLu: false })?.k, 'gel-pas-su');
  assert.equal(garde({ '111': { pending: {} } }, '701', '1', { marqueurLu: false })?.k, 'gel-pas-su');
  assert.equal(garde({}, '701', '1', { fiches: { '701': { numero: '1' } } })?.k, 'gel-pas-su');
  assert.equal(garde({}, '701', '1', { fiches: { ...fiches, '703': { numero: '1' } } })?.k, 'numero-ambigu');
  assert.equal(garde({}, '701', '10')?.k, 'numero-ambigu');
});
await test('activation concurrente et appareil tardif : même ancre', async () => {
  const store = memory(); const a = await Promise.all([activationK1(store, now), activationK1(store, now + JOUR_K1)]);
  assert.equal(a[0], a[1]); assert.equal(await activationK1(store, now + 100 * JOUR_K1), a[0]);
});
await test('créations concurrentes du gel : relecture bornée, deux états sûrs', async () => {
  const store = memory();
  const sources = { transactions: [], bordereaux: [], ordres: [{ id: 'harvest_111_orders_sold', cap: new Date(now).toISOString(), v: [sale('91')] }] };
  const args = { store, activation: now, uid: '111', sources, maintenant: now, liens: {} };
  const res = await Promise.all([memoriserGelK1(args), memoriserGelK1({ ...args, maintenant: now + 1 })]);
  assert.equal(res.every(r => !r.inconnu), true);
  assert.deepEqual(res[0].pending, res[1].pending);
});
await test('activation illisible : zéro création de repli', async () => {
  let writes = 0; assert.equal(await activationK1({ lire: async () => undefined, creer: async () => writes++ }, now), undefined); assert.equal(writes, 0);
});
const sources = { transactions: [], bordereaux: [], ordres: [{ id: 'harvest_111_orders_sold', cap: new Date(now).toISOString(), v: [sale('91')] }] };
await test('mémoire rangée et relue ; panne conserve la précédente sans écriture', async () => {
  const store = memory(); const args = { store, activation: now, uid: '111', sources, maintenant: now, liens: {} };
  const a = await memoriserGelK1(args); assert.equal(a.inconnu, false); const before = store.writes;
  for (const s of [null, { ...sources, ordres: [] }, { ...sources, ordres: [{ id: 'harvest_111_orders_sold', v: null }] }]) assert.equal((await memoriserGelK1({ ...args, sources: s })).inconnu, true);
  assert.equal(store.writes, before); assert.deepEqual(Object.keys(store.rows.get('vrm_vinted_publication_111').data.pending), ['91']);
});
await test('capture plus ancienne et CAS refusé : mémoire intacte, publication gelée', async () => {
  const store = memory(); const args = { store, activation: now, uid: '111', sources, maintenant: now, liens: {} };
  await memoriserGelK1(args); const before = store.writes;
  const ancien = { ...sources, ordres: [{ ...sources.ordres[0], cap: new Date(now - 1).toISOString(), v: [] }] };
  assert.equal((await memoriserGelK1({ ...args, sources: ancien })).inconnu, true); assert.equal(store.writes, before);
  store.remplacer = async () => false;
  assert.equal((await memoriserGelK1({ ...args, sources: { ...sources, ordres: [{ ...sources.ordres[0], v: [sale('91'), sale('92')] }] } })).inconnu, true);
  assert.deepEqual(Object.keys(store.rows.get('vrm_vinted_publication_111').data.pending), ['91']);
});
await test('création ignorée par concurrence : le candidat local ne devient pas vérité', async () => {
  let first = true; const store = { lire: async () => first ? (first = false, null) : { data: { pending: { '92': {} } } }, creer: async () => true };
  assert.equal((await memoriserGelK1({ store, activation: now, uid: '111', sources, maintenant: now, liens: {} })).inconnu, true);
});
console.log(`${n} scénarios K1 sans échec — sources simulées, aucun appel réel.`);
