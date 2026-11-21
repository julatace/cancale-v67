// ════════════════════════════════════════════════════════════════════════════
//  SUPPRIMER LE COMPTE « 35 » NE TOUCHE JAMAIS « 352… » (1er nov., audit point 5)
//
//  `deleteVintedAccount` lisait `or=(id.like.harvest_35_*,…)` — dans LIKE le `_`
//  est un JOKER, donc `harvest_35_*` attrape `harvest_352_listings` — puis
//  VIDAIT toutes les lignes rendues, sans la garde de préfixe exact de ses deux
//  voisines. Et aucune des trois ne paginait : au-delà de 1 000 lignes la purge
//  s'arrêtait (données personnelles restantes), et la reprise au démarrage
//  relisait les MÊMES 1 000 premières.
//
//  On EXÉCUTE les vraies fonctions d'App.jsx dans un `vm` (`lireTout`,
//  `lireLignesDuCompte`, `deleteVintedAccount`, `supprimerDonneesCompte`,
//  `purgerComptesSupprimes`, `familiesDeCompte`, `echapperLike`) contre une base
//  qui applique la VRAIE règle de LIKE (`_` joker, `\` échappe), le plafond
//  silencieux de 1 000 lignes et la pagination `Range` (`_base-ecritures.cjs`).
//   1. compte « 35 » supprimé : 0 ligne de « 352… » ni de « 3500 » touchée ;
//   2. ses 1 250 lignes TOUTES vidées (pagination) ;
//   3. une page ratée ⇒ rien n'est vidé (pas de purge à l'aveugle) ;
//   4. la purge du démarrage et l'effacement ciblé : mêmes garanties.
//  `--prouve` : sans échappement ET sans garde de préfixe, ou sans pagination,
//  au moins un rouge.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { reLike } = require('./bancs/_base-ecritures.cjs');
const APP0 = require("./_source-app.cjs").sourceAppDe(path.join(__dirname, '..', 'src', 'App.jsx'));

const extraire = (app, debut, fin = '\n};') => { const i = app.indexOf(debut); if (i < 0) throw new Error('introuvable : ' + debut); const j = app.indexOf(fin, i); return app.slice(i, j + fin.length); };
const extraireFn = (app, debut) => { const i = app.indexOf(debut); if (i < 0) throw new Error('introuvable : ' + debut); const j = app.indexOf('\n}\n', i); return app.slice(i, j + 3); };

function base(lignes) {
  const m = new Map(lignes.map((l) => [l.id, l]));
  const ecrits = [];
  const filtre = (expr) => {
    const v = decodeURIComponent(expr);
    let mm;
    if ((mm = /^eq\.(.*)$/.exec(v))) return (id) => id === mm[1];
    if ((mm = /^like\.(.*)$/.exec(v))) { const re = reLike(mm[1]); return (id) => re.test(id); }
    return () => true;
  };
  const fetch = async (url, init = {}) => {
    const u = String(url); const meth = (init.method || 'GET').toUpperCase();
    if (meth === 'POST') { for (const r of JSON.parse(init.body || '[]')) { ecrits.push(r.id); m.set(r.id, { id: r.id, data: r.data }); } return { ok: true, status: 201, json: async () => [], text: async () => '' }; }
    if (meth === 'DELETE') return { ok: true, status: 204, json: async () => [] };
    const q = u.split('?')[1] || '';
    const params = q.split('&').map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; });
    let L = [...m.values()];
    for (const [k, v] of params) {
      if (k === 'id') { const f = filtre(v); L = L.filter((r) => f(r.id)); }
      if (k === 'or') { const parts = decodeURIComponent(v).replace(/^\(|\)$/g, '').split(','); const fs = parts.map((p) => filtre(p.replace(/^id\./, ''))); L = L.filter((r) => fs.some((f) => f(r.id))); }
    }
    L.sort((a, b) => (a.id < b.id ? -1 : 1));
    const range = (init.headers && (init.headers.Range || init.headers.range)) || '';
    const mr = /^(\d+)-(\d+)$/.exec(range);
    const from = mr ? Number(mr[1]) : 0;
    if (base.panne && base.panne(u, from)) return { ok: false, status: 500, json: async () => ({}), text: async () => '' };
    if (mr && from > 0 && from >= L.length) return { ok: false, status: 416, headers: { get: (h) => (h.toLowerCase() === 'content-range' ? `*/${L.length}` : null) }, json: async () => ({}) };
    const page = L.slice(from, from + 1000);
    const sel = (params.find(([k]) => k === 'select') || [])[1] || 'id';
    const rows = page.map((r) => { const o = { id: r.id }; if (/sup:data->>supprime/.test(decodeURIComponent(sel))) o.sup = r.data && r.data.supprime === true ? 'true' : null; if (/data/.test(sel) && !/->/.test(sel)) o.data = r.data; return o; });
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => rows };
  };
  return { m, ecrits, fetch };
}
const fabriquer = () => {
  const lignes = [];
  for (let i = 0; i < 1200; i++) lignes.push({ id: `harvest_35_txn_${100000 + i}`, data: { x: 1 } });
  lignes.push({ id: 'harvest_35_listings', data: { x: 1 } });
  for (let i = 0; i < 49; i++) lignes.push({ id: `coffre_35_${9000 + i}`, data: { x: 1 } });
  for (let i = 0; i < 30; i++) lignes.push({ id: `harvest_352_txn_${200000 + i}`, data: { garde: 1 } });
  lignes.push({ id: 'harvest_352_listings', data: { garde: 1 } }, { id: 'harvest_3500_listings', data: { garde: 1 } }, { id: 'coffre_352_1', data: { garde: 1 } }, { id: 'harvest_35x_bizarre', data: { garde: 1 } });
  return lignes;
};
const siens = (id) => id.startsWith('harvest_35_') || id.startsWith('coffre_35_');

async function juger(app, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const code = [
    'const PAGE_SB = 1000;',
    extraire(app, 'const lireTout = async (query, opts = {}) => {'),
    // (le code d'avant n'a ni l'un ni l'autre : on l'exécute tel quel, §6.1)
    app.includes('const echapperLike = ') ? extraire(app, 'const echapperLike = ', ';\n') : '',
    app.includes('async function lireLignesDuCompte(') ? extraireFn(app, 'async function lireLignesDuCompte(') : '',
    extraire(app, 'const deleteVintedAccount = async'),
    extraire(app, 'const purgerComptesSupprimes = async'),
    extraire(app, 'const familiesDeCompte = (uid, id, scopes) => {'),
    extraire(app, 'const supprimerDonneesCompte = async'),
    'globalThis.__f = { deleteVintedAccount, purgerComptesSupprimes, supprimerDonneesCompte };',
  ].join('\n');
  const lancer = async (quoi, panne) => {
    const b = base(fabriquer()); base.panne = panne || null;
    const ctx = { console: { log() {}, warn() {}, error() {} }, SUPABASE_URL: 'https://x.test', AUTH: { user: { id: 'o' } }, sbAuth: (h) => ({ ...(h || {}) }), withOwner: (o) => o, sansComptesSupprimes: (r) => r.filter((x) => !String(x.id).startsWith('harvest_35_')), fetch: b.fetch, encodeURIComponent, Promise, Date, JSON, String, Number, Array, Object, Map, Set, RegExp, Error };
    ctx.globalThis = ctx; vm.createContext(ctx);
    vm.runInContext(code, ctx, { filename: 'App.jsx' });
    // La liste noire et les comptes réautorisés, lus par la purge du démarrage.
    b.m.set('vrm_blocked_accounts', { id: 'vrm_blocked_accounts', data: { uids: ['35'] } }); b.m.set('panel_accounts_off', { id: 'panel_accounts_off', data: {} });
    const origFetch = b.fetch;
    ctx.fetch = async (u, init) => { const s = String(u); if (/id=eq\.(vrm_blocked_accounts|panel_accounts_off)/.test(s)) { const id = /id=eq\.([a-z_]+)/.exec(s)[1]; return { ok: true, status: 200, json: async () => [{ data: b.m.get(id).data }] }; } return origFetch(u, init); };
    vm.runInContext('void 0', ctx);
    let r;
    if (quoi === 'supprimer') r = await ctx.__f.deleteVintedAccount('35', 'trente_cinq');
    if (quoi === 'demarrage') r = await ctx.__f.purgerComptesSupprimes();
    if (quoi === 'cible') r = await ctx.__f.supprimerDonneesCompte('35', 'x', { annonces: true, ventes: true, bordereaux: true, releves: true, achats: true, messages: true, compte: true });
    return { b, r };
  };
  for (const quoi of ['supprimer', 'demarrage', 'cible']) {
    const { b } = await lancer(quoi);
    const touches = b.ecrits.filter((id) => id !== 'vrm_blocked_accounts' && !siens(id));
    dit(touches.length === 0, `${quoi} : le compte « 35 » ne touche ni « 352… », ni « 3500 », ni « 35x »`, touches.slice(0, 4).join(', '));
    const restants = [...b.m.values()].filter((l) => siens(l.id) && !(l.data && l.data.supprime === true)).length;
    dit(restants === 0, `${quoi} : ses 1 250 lignes sont toutes vidées (au-delà de 1 000)`, `${restants} restante(s)`);
    const p = await lancer(quoi, (u, from) => from >= 1000);
    const partis = p.b.ecrits.filter((id) => id !== 'vrm_blocked_accounts');
    dit(partis.length === 0, `${quoi} : une page ratée ⇒ rien n'est vidé (pas de purge sur une demi-liste)`, `${partis.length} vidée(s)`);
  }
  return ko;
}

(async () => {
  if (process.argv.includes('--prouve')) {
    const muts = [
      ['ni échappement ni garde de préfixe', (s) => s.replace("const rows = await lireTout(`id=like.${encodeURIComponent(echapperLike(prefixe))}*&select=${select}`", "const rows = await lireTout(`id=like.${prefixe}*&select=${select}`").replace('for (const x of rows) if (x && String(x.id).startsWith(prefixe)) out.push(x);', 'for (const x of rows) if (x) out.push(x);')],
      ['une page seulement', (s) => s.replace('const max = opts.maxPages || 20;', 'const max = 1;').replace('  if (!complet) return null;\n', '')],
      ['demi-liste rendue', (s) => s.replace('    if (!r.ok) return null;\n    const lot = await r.json();', '    if (!r.ok) { complet = p > 0; break; }\n    const lot = await r.json();')],
    ];
    let vertes = 0;
    for (const [nom, mut] of muts) {
      const m = mut(APP0);
      if (m === APP0) { console.log('KO  mutation sans effet : ' + nom); vertes++; continue; }
      const k = await juger(m, false).catch(() => 1);
      console.log((k ? 'OK  ' : 'KO  ') + `mutation « ${nom} » ⇒ ${k} rouge(s)`);
      if (!k) vertes++;
    }
    process.exit(vertes ? 1 : 0);
  }
  const avant = process.argv.indexOf('--app');
  const ko = await juger(avant > 0 ? fs.readFileSync(process.argv[avant + 1], 'utf8') : APP0, true);
  console.log(ko ? `\n${ko} KO` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
