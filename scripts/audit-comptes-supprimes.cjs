#!/usr/bin/env node
// Un compte supprimé pour de bon (shop_cancale) n'apparaît plus nulle part
// (29 octobre, « retire tout de ce compte »). Exécute la VRAIE règle
// (src/comptesSupprimes.js) et vérifie que `lireTout` (App.jsx) la passe.
//   --prouve : réaffaiblit la règle (aucun filtre) ⇒ des contrôles rougissent.
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const prouve = process.argv.includes('--prouve');
let ok = 0, ko = 0;
const verif = (c, m) => { if (c) { ok++; console.log('✅', m); } else { ko++; console.log('❌', m); } };

(async () => {
  let src = fs.readFileSync(path.join(RACINE, 'src', 'comptesSupprimes.js'), 'utf8');
  if (prouve) src = src.replace('return rows.filter(', 'return rows; rows.filter(');
  const tmp = path.join(require('os').tmpdir(), `vrm-supprimes-${process.pid}.mjs`);
  fs.writeFileSync(tmp, src);
  const M = await import('file://' + tmp);
  fs.unlinkSync(tmp);

  const BASE = 'https://x.supabase.co';
  const lignes = [
    { id: 'harvest_199082413_listings', data: 1 },
    { id: 'harvest_111_listings', data: 2 },
    { id: 'main', data: 3 },
  ];
  const sup = new Set(['199082413']);
  const vrai = (rows) => async () => new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });

  // 1. La règle pure.
  const f = M.sansComptesSupprimes(lignes, sup);
  verif(f.length === 2 && !f.some((r) => r.id.startsWith('harvest_199082413_')), 'les lignes du compte supprimé sortent, les autres restent');
  verif(M.sansComptesSupprimes(lignes, new Set()).length === 3, 'liste vide (pas su) ⇒ rien n\'est retiré');
  verif(M.sansComptesSupprimes(null, sup) === null, 'une réponse illisible passe telle quelle');
  verif(M.compteDeLigne('harvest_111_txn_42') === '111' && M.compteDeLigne('main') === '', 'compte d\'une ligne lu dans son identifiant');

  // 2. Sur fetch.
  const fe = M.creerFiltreSupprimes(vrai(lignes), BASE, () => sup);
  const r1 = await (await fe(`${BASE}/rest/v1/app_data?id=like.harvest_*_listings&select=id,data`)).json();
  verif(r1.length === 2 && !r1.some((r) => r.id.includes('199082413')), 'une lecture de famille ne rend plus ses lignes');
  const r2 = await (await fe(`${BASE}/rest/v1/app_data?id=eq.harvest_199082413_orders_sold&select=data`)).json();
  verif(Array.isArray(r2) && !r2.some((r) => r.id.includes('199082413')), 'une lecture directe de ses ventes ne les rend pas');
  const r3 = await (await fe(`${BASE}/rest/v1/app_data?id=like.harvest_*`, { headers: { Range: '0-999' } })).json();
  verif(r3.length === 3, 'une lecture paginée n\'est pas raccourcie (lireTout filtre après)');
  let methodeVue = null;
  const fw = M.creerFiltreSupprimes(async (u, i) => { methodeVue = i && i.method; return new Response('[]'); }, BASE, () => sup);
  await fw(`${BASE}/rest/v1/app_data?id=like.harvest_199082413_*`, { method: 'DELETE' });
  verif(methodeVue === 'DELETE', 'une écriture (suppression) passe telle quelle');
  const fv = M.creerFiltreSupprimes(vrai(lignes), BASE, () => new Set());
  verif((await (await fv(`${BASE}/rest/v1/app_data?id=like.harvest_*`)).json()).length === 3, 'aucun compte supprimé ⇒ réponse intacte');
  const ferr = M.creerFiltreSupprimes(async () => new Response('x', { status: 522 }), BASE, () => sup);
  verif((await ferr(`${BASE}/rest/v1/app_data?id=like.harvest_*`)).status === 522, 'un échec reste un échec');

  // 3. Branché dans l'app.
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  verif(/installerFiltreSupprimes\(SUPABASE_URL\)/.test(app), 'le filtre est posé sur fetch au démarrage');
  const lt = app.slice(app.indexOf('const lireTout = async'), app.indexOf('const lireTout = async') + 1500);
  verif(/return sansComptesSupprimes\(out\)/.test(lt), 'lireTout retire les lignes après la pagination');
  verif(/localStorage\.setItem\(CLE_SUPPRIMES/.test(app), 'la liste est rangée sur une lecture réussie des comptes');

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
