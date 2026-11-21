// ════════════════════════════════════════════════════════════════════════════
//  UNE LECTURE PAGINÉE PORTE UN ORDRE STABLE (7 nov., audit « 1 000 vendeurs »)
//  Sans `order=`, Postgres rend les lignes dans l'ordre qui l'arrange : d'une
//  page `Range` à l'autre, une ligne peut sauter (jamais lue) ou revenir (lue
//  deux fois). Ce contrôle tient :
//   O1. Serveur (api/*.js, api/_lib/*.js) : chaque requête qui pose un en-tête
//       `Range:` (ou un `offset=`) nomme son `order=` ou passe par
//       `ordreStable(` (api/_lib/ordre-stable.js).
//   O2. `ordreStable` EXÉCUTÉ : ajoute le tri total de la table (clé primaire)
//       quand il manque, ne touche jamais une requête qui a le sien.
//   O3. `lireTout` de src/App.jsx EXÉCUTÉ (vm) contre un faux PostgREST qui
//       mélange les lignes quand on ne lui demande pas d'ordre (comme Postgres
//       peut le faire) : 2 500 lignes lues chacune UNE fois ; une requête qui a
//       son `order=` le garde, sans second `order=`.
//  Données inventées. `--prouve` : chaque mutation rougit.
//  Lancer : node scripts/audit-pagination-ordre.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const path = require('path'), fs = require('fs'), vm = require('vm');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const { prouver, sansCommentaires } = require('./_mutations-audit.cjs');

const MUTATIONS = {
  'ordreStable qui ne pose rien': [['api/_lib/ordre-stable.js', "if (/(^|&)order=/.test(requete)) return s;", 'return s;']],
  'ordreStable qui écrase un ordre existant': [['api/_lib/ordre-stable.js', "if (/(^|&)order=/.test(requete)) return s;", '']],
  'cron sans ordre': [['api/ship-reminders.js', '/rest/v1/${ordreStable(path)}`', '/rest/v1/${path}`']],
  'widget sans ordre': [['api/widget.js', '/rest/v1/${ordreStable(path)}`', '/rest/v1/${path}`']],
  'e-mails entrants sans ordre': [['api/email-inbound.js', 'await duVendeur(ordreStable(`${SUPABASE_URL}/rest/v1/app_data?${requete}`))', 'await duVendeur(`${SUPABASE_URL}/rest/v1/app_data?${requete}`)']],
  'app sans ordre': [['src/App.jsx', "const requete = /(^|&)order=/.test(String(query)) ? query : `${query}&order=id.asc`;", 'const requete = query;']],
};
if (process.argv.includes('--prouve')) prouver(__filename, R, MUTATIONS);
else {
let ko = 0, ok = 0;
const vrai = (c, m) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m); } };

// ── O1. Lecture du code serveur ─────────────────────────────────────────────
const fichiers = [];
for (const d of ['api', 'api/_lib']) for (const f of fs.readdirSync(path.join(R, d))) if (f.endsWith('.js')) fichiers.push(path.join(d, f));
let lectures = 0;
const fautes = [];
for (const f of fichiers) {
  const src = sansCommentaires(fs.readFileSync(path.join(R, f), 'utf8'));
  // Un en-tête de page : `Range: \`` (jamais `Content-Range`).
  const re = /(^|[^-\w'"])Range\s*:\s*`/g; let m;
  while ((m = re.exec(src))) {
    lectures++;
    const avant = src.slice(Math.max(0, m.index - 900), m.index);
    const k = Math.max(avant.lastIndexOf('fetch('), avant.lastIndexOf('fetcher('), avant.lastIndexOf('fetchMemo('));
    const fen = k >= 0 ? avant.slice(k) : avant.slice(-300);
    if (!/order=/.test(fen) && !/ordreStable\(/.test(fen)) fautes.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
  }
  // Une page PostgREST par `offset=` (une requête à la base : `select=`) : la même ligne nomme son ordre.
  for (const [i, l] of src.split('\n').entries()) if (/[?&]offset=\$\{/.test(l) && /select=/.test(l)) { lectures++; if (!/order=/.test(l)) fautes.push(`${f}:${i + 1} (offset)`); }
}
vrai(lectures >= 10, `O1 lectures paginées trouvées côté serveur : ${lectures}`);
vrai(fautes.length === 0, `O1 chaque lecture paginée du serveur porte un ordre${fautes.length ? ' — sans ordre : ' + fautes.join(', ') : ''}`);

(async () => {
  // ── O2. ordreStable exécuté ─────────────────────────────────────────────
  const { ordreStable, ORDRE_PAR_TABLE } = await import(path.join(R, 'api/_lib/ordre-stable.js'));
  vrai(ordreStable('app_data?id=eq.main&select=owner') === 'app_data?id=eq.main&select=owner&order=owner.asc,id.asc', 'O2 app_data sans ordre ⇒ (owner, id) ajouté');
  vrai(ordreStable('vinted_accounts?select=vinted_user_id&owner=eq.x') === 'vinted_accounts?select=vinted_user_id&owner=eq.x&order=owner.asc,vinted_user_id.asc', 'O2 vinted_accounts ⇒ sa clé primaire');
  vrai(ordreStable('https://b.test/rest/v1/app_data?id=like.x*&select=id') === 'https://b.test/rest/v1/app_data?id=like.x*&select=id&order=owner.asc,id.asc', 'O2 URL complète');
  vrai(ordreStable('app_data?id=eq.ebay_comptes&order=owner.asc&select=x') === 'app_data?id=eq.ebay_comptes&order=owner.asc&select=x', 'O2 une requête qui a son ordre reste telle quelle');
  vrai(ordreStable('app_data?select=order:data->x') === 'app_data?select=order:data->x&order=owner.asc,id.asc', 'O2 un alias « order: » n’est pas un ordre');
  vrai(!!ORDRE_PAR_TABLE && Object.values(ORDRE_PAR_TABLE).every((o) => o.split(',').every((c) => /\.asc$/.test(c))), 'O2 la table des ordres ne nomme que des tris montants');

  // ── O3. lireTout (src/App.jsx) exécuté ──────────────────────────────────
  const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
  const debut = app.indexOf('const lireTout = async (query, opts = {}) => {');
  vrai(debut >= 0, 'O3 lireTout trouvé dans App.jsx');
  const code = 'const PAGE_SB = 1000;\n' + app.slice(debut, app.indexOf('\n};', debut) + 3) + '\nglobalThis.__lt = lireTout;';
  const lignes = []; for (let i = 0; i < 2500; i++) lignes.push({ id: 'harvest_1_txn_' + String(100000 + i) });
  const urls = [];
  // Le faux PostgREST : SANS `order=`, chaque page est tirée d'un ordre DIFFÉRENT
  // (ce que Postgres a le droit de faire) ; avec, l'ordre demandé.
  let graine = 7;
  const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
  const fauxFetch = async (url, init = {}) => {
    const u = String(url); urls.push(decodeURIComponent(u));
    const q = new URL(u).searchParams;
    let sel = [...lignes];
    if (q.get('order')) sel.sort((a, b) => (a.id < b.id ? -1 : 1));
    else for (let i = sel.length - 1; i > 0; i--) { const j = Math.floor(hasard() * (i + 1)); [sel[i], sel[j]] = [sel[j], sel[i]]; }
    const m = /^(\d+)-(\d+)$/.exec((init.headers || {}).Range || '0-999');
    const page = sel.slice(+m[1], Math.min(+m[2], +m[1] + 999) + 1);
    return { ok: true, status: 206, headers: { get: () => null }, json: async () => page };
  };
  const ctx = { SUPABASE_URL: 'https://x.test', sbAuth: (h) => ({ ...(h || {}) }), fetch: fauxFetch, fetchMemo: fauxFetch, sansComptesSupprimes: (r) => r, Object, Array, Number, String, RegExp, JSON, Promise };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'App.jsx' });
  const r = await ctx.__lt('id=like.harvest_*_txn_*&select=id', { strict: true });
  const vus = new Map(); for (const x of r || []) vus.set(x.id, (vus.get(x.id) || 0) + 1);
  vrai(Array.isArray(r) && r.length === 2500 && vus.size === 2500 && [...vus.values()].every((n) => n === 1), `O3 2 500 lignes sur 3 pages : chacune lue une fois (${r ? r.length : r} rendues, ${vus.size} distinctes)`);
  vrai(urls.length === 3 && urls.every((u) => /[?&]order=id\.asc(&|$)/.test(u)), 'O3 chaque page demande `order=id.asc`');
  urls.length = 0;
  await ctx.__lt('id=like.harvest_*&select=id&order=id.desc', { strict: true });
  vrai(urls.length >= 1 && urls.every((u) => (u.match(/[?&]order=/g) || []).length === 1 && /order=id\.desc/.test(u)), 'O3 une requête qui a son ordre le garde (un seul `order=`)');

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + (e && e.stack || e)); process.exit(1); });
}
