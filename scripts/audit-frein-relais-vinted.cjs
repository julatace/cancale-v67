#!/usr/bin/env node
// Audit du 5 nov. — un bouton « relire » ne fait plus interroger Vinted par le
// SERVEUR pour tous les comptes, et le relais restant est freiné par compte.
// Exécute les VRAIES fonctions de src/App.jsx (extraites par @babel/parser) avec
// des doublures : on compte les requêtes parties vers `/api/vinted-proxy`.
// Mutation : `node scripts/audit-frein-relais-vinted.cjs --muter` réaffaiblit les
// règles et doit finir en rouge.
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), parser = require('@babel/parser');
const RACINE = path.join(__dirname, '..');
let src = fs.readFileSync(path.join(RACINE, 'src/App.jsx'), 'utf8');
let frein = fs.readFileSync(path.join(RACINE, 'src/freinRelaisVinted.js'), 'utf8');
const MUTER = process.argv.includes('--muter');
if (MUTER) {
  src = src.replace('  if (page === 1) {\n    // ⚠️ PAS de repli', '  if (page === 1 && !opts.force) {\n    // ⚠️ PAS de repli')
    .replace("  if (opts.force) {\n    const h=await fetchHarvest(account.vinted_user_id,'inbox');", "  if (false) {\n    const h=await fetchHarvest(account.vinted_user_id,'inbox');");
  frein = frein.replace('if (garde.length >= MAX_PAR_FENETRE)', 'if (false)');
}
const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
const fonction = (nom) => {
  for (const n of ast.program.body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.name === nom) return src.slice(n.start, n.end);
  }
  throw new Error('fonction introuvable : ' + nom);
};
let ok = 0, ko = 0;
const verif = (c, m) => { if (c) { ok++; console.log('  ✓ ' + m); } else { ko++; console.log('  ✗ ' + m); } };

const freinCjs = frein.replace(/export const /g, 'const ').replace(/export function /g, 'function ')
  + '\nmodule.exports = { prendrePlaceRelais, MAX_PAR_FENETRE, FENETRE_MS, CLE_FREIN };';
const modFrein = { exports: {} };
vm.runInNewContext(freinCjs, { module: modFrein, JSON, Array, Number, Object, Math, String });
const { prendrePlaceRelais, MAX_PAR_FENETRE, FENETRE_MS } = modFrein.exports;

const stockage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

(async () => {
  console.log('1. Le frein, seul');
  {
    const s = stockage(); let n = 0;
    for (let i = 0; i < MAX_PAR_FENETRE + 5; i++) if (prendrePlaceRelais('111', 1000 + i, s).ok) n++;
    verif(n === MAX_PAR_FENETRE, `au plus ${MAX_PAR_FENETRE} requêtes par compte dans la fenêtre (${n})`);
    verif(prendrePlaceRelais('222', 2000, s).ok, 'un autre compte a sa propre réserve');
    verif(prendrePlaceRelais('111', 1000 + FENETRE_MS + 1, s).ok, 'la fenêtre passée, la place revient');
    const casse = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    verif(!prendrePlaceRelais('111', 1, casse).ok, 'stockage illisible ⇒ refus (pas su ≠ oui)');
  }

  // Le monde doublé : la copie captée existe pour chaque compte.
  const monde = (opts = {}) => {
    const appels = { proxy: 0, exec: 0 };
    const s = stockage();
    const ctx = {
      console, JSON, Array, Number, Object, Math, String, Promise, Date, Map, Set, isNaN,
      window: { localStorage: s },
      prendrePlaceRelais,
      busyStart() {}, busyEnd() {},
      enTeteSession: () => ({}),
      persistRefreshedTokens: async () => {},
      fetch: async (url) => { if (String(url).includes('/api/vinted-proxy')) appels.proxy++; return { json: async () => ({ ok: true, status: 200, data: { my_orders: [], conversations: [] } }) }; },
      fetchHarvestOrders: async () => (opts.sansCopie ? null : { my_orders: [{ id: 1, status: 'Vendu' }], pagination: null }),
      fetchHarvest: async () => (opts.sansCopie ? null : { conversations: [{ id: 9 }], pagination: null }),
      extSait: () => (opts.extension ? 'ok' : 'absente'),
      vmrExec: async () => { appels.exec++; return { ok: true, data: { conversations: [{ id: 10 }] } }; },
      classifyOrderStatus: () => 'pending',
    };
    vm.createContext(ctx);
    vm.runInContext([fonction('vintedApiCall'), fonction('fetchVintedOrders'), fonction('fetchVintedConversations')].join('\n')
      + '\nthis.vintedApiCall = vintedApiCall; this.fetchVintedOrders = fetchVintedOrders; this.fetchVintedConversations = fetchVintedConversations;', ctx);
    return { ctx, appels };
  };
  const comptes = Array.from({ length: 8 }, (_, i) => ({ vinted_user_id: String(1000 + i), domain: 'www.vinted.fr' }));

  console.log('2. « Relire les données des comptes » (ventes forcées, 8 comptes, copie captée présente)');
  {
    const { ctx, appels } = monde();
    const r = await Promise.all(comptes.map((a) => ctx.fetchVintedOrders(a, 'sold', 1, 'all', { force: true })));
    verif(appels.proxy === 0, `aucune requête au relais serveur (${appels.proxy})`);
    verif(r.every((x) => x.ok && x.items.length === 1), 'chaque compte rend sa copie captée');
  }

  console.log('3. Flèche ↻ de Messages SANS extension (téléphone), 8 comptes');
  {
    const { ctx, appels } = monde({ extension: false });
    const r = await Promise.all(comptes.map((a) => ctx.fetchVintedConversations(a, 1, { force: true })));
    verif(appels.proxy === 0, `aucune requête au relais serveur (${appels.proxy})`);
    verif(r.every((x) => x.ok && x.stale === true), 'la copie captée, dite ancienne');
  }

  console.log('4. Flèche ↻ AVEC extension : elle seule lit, une requête par compte');
  {
    const { ctx, appels } = monde({ extension: true });
    await Promise.all(comptes.map((a) => ctx.fetchVintedConversations(a, 1, { force: true })));
    verif(appels.proxy === 0 && appels.exec === 8, `relais ${appels.proxy}, extension ${appels.exec}`);
  }

  console.log('5. Compte jamais capté, bouton martelé 30 fois : le relais est freiné');
  {
    const { ctx, appels } = monde({ sansCopie: true });
    for (let i = 0; i < 30; i++) await ctx.fetchVintedConversations(comptes[0], 1, {});
    verif(appels.proxy <= MAX_PAR_FENETRE, `au plus ${MAX_PAR_FENETRE} requêtes (${appels.proxy})`);
    const r = await ctx.vintedApiCall(comptes[0], '/api/v2/inbox?page=1');
    verif(r.ok === false && r.frein === true, 'freiné ⇒ un échec dit, rien ne part');
  }

  console.log(`\n${ok} ✓ · ${ko} ✗`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
