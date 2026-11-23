// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « APPAREILS CONNECTÉS » — LES NAVIGATEURS DE L'EXTENSION (23 nov., lot appareils-connectes)
// Paramètres → Sécurité → « Appareils connectés » : les sessions (Supabase Auth, déjà là) ET, maintenant, les
// navigateurs où l'extension VRM tourne pour CE compte (lignes `ext_appareil_*`).
//   N1 la lecture ne demande que SES lignes (`owner=eq.<lui>`), en projection scalaire (jamais `select=data`) ; sans
//      identifiant valable, rien n'est demandé ;
//   N2 une FAUSSE BASE qui sert deux vendeurs (elle rend tout dès qu'un filtre manque) : rien de l'autre ne sort ;
//   N3 « pas su » : lecture ratée ⇒ null (l'écran dit « Réessayer »), jamais une liste vide ; une date illisible
//      n'est ni active ni ancienne ; une version illisible n'est pas affichée ;
//   N4 l'ordre : le plus récent d'abord ; un navigateur une fois ;
//   N5 l'écran : la carte est rendue dans « Appareils connectés », « Se déconnecter partout » reste confirmé et en
//      scope global ; chaque texte neuf passe par tr() dans les cinq langues.
// Lancer : node scripts/audit-appareils-extension.cjs [--mutation=<nom>]  (chaque mutation doit rougir)
//   mutations : owner data passu date ordre carte partout
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-appext-'));
const FICHIERS = ['src/appareilsExtension.js', 'src/NavigateursExtension.jsx', 'src/ecrans/Reglages.jsx', 'src/securiteCompte.js', ...['fr', 'en', 'es', 'it', 'de'].map((l) => `src/i18n/langues/${l}/parametres.js`)];
for (const f of FICHIERS) { if (!fs.existsSync(path.join(R, f))) continue; fs.mkdirSync(path.dirname(path.join(T, f)), { recursive: true }); fs.copyFileSync(path.join(R, f), path.join(T, f)); }
fs.writeFileSync(path.join(T, 'package.json'), '{"type":"module"}');
const MUTS = {
  owner: ['src/appareilsExtension.js', 'return `owner=eq.${encodeURIComponent(o)}&id=like.ext_appareil_*', 'return `id=like.ext_appareil_*'],
  data: ['src/appareilsExtension.js', '&select=id,ver:data->>ver,atMs:data->>atMs,', '&select=id,data,ver:data->>ver,atMs:data->>atMs,'],
  passu: ['src/appareilsExtension.js', 'if (!Array.isArray(rows)) return null;', 'if (!Array.isArray(rows)) rows = [];'],
  date: ['src/appareilsExtension.js', 'active: atMs != null ? maintenant - atMs < ACTIVE_MS : null', 'active: maintenant - (atMs || 0) < ACTIVE_MS'],
  ordre: ['src/appareilsExtension.js', 'return out.sort((a, b) => (b.atMs || 0) - (a.atMs || 0) || a.id.localeCompare(b.id));', 'return out;'],
  carte: ['src/ecrans/Reglages.jsx', "      <NavigateursExtension owner={(AUTH.user && AUTH.user.id) || ''} lireTout={lireTout} quand={quandCourt}/>\n", ''],
  partout: ['src/securiteCompte.js', '/auth/v1/logout?scope=global', '/auth/v1/logout?scope=local'],
};
if (MUT) {
  const m = MUTS[MUT];
  if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  const f = path.join(T, m[0]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(m[1])) { console.log('❌ mutation impossible : motif absent — ' + m[1].slice(0, 90)); process.exit(2); }
  fs.writeFileSync(f, s.replace(m[1], m[2]));
  console.log('… mutation « ' + MUT + ' » posée');
}
const sansCommentaires = (f) => fs.readFileSync(path.join(T, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

(async () => {
  let A;
  try { A = await import(pathToFileURL(path.join(T, 'src/appareilsExtension.js')).href); } catch (e) { dit(false, 'src/appareilsExtension.js se charge', String(e.message).slice(0, 200)); return fin(); }
  const MOI = '11111111-aaaa-4bbb-8ccc-000000000001', AUTRE = '22222222-aaaa-4bbb-8ccc-000000000002';
  const M = Date.parse('2026-11-23T12:00:00Z');
  // La fausse base (forme PostgREST) : deux vendeurs ; un filtre `owner` absent ⇒ elle rend TOUT.
  const base = [
    { owner: MOI, id: 'ext_appareil_aa1', data: { ver: '5.441.0', atMs: M - 3600000, appareil: { nav: 'Chrome', systeme: 'Mac' }, vus: { vinted: { 9: 1 } } } },
    { owner: MOI, id: 'ext_appareil_bb2', data: { ver: 'x.y', atMs: M - 3 * 86400000, appareil: { nav: 'Firefox', systeme: 'Windows' } } },
    { owner: MOI, id: 'ext_appareil_cc3', data: { ver: '5.300.0', atMs: 'jamais', appareil: { nav: 'Orion', systeme: 'Mac' } } },
    { owner: AUTRE, id: 'ext_appareil_zz9', data: { ver: '5.441.0', atMs: M, appareil: { nav: 'Edge', systeme: 'Windows' } } },
  ];
  const servir = (q) => {
    const p = new URLSearchParams(q);
    let l = base.slice().reverse();   // l'ordre de la base n'est pas celui de l'écran
    const own = /^eq\.(.+)$/.exec(p.get('owner') || ''); if (own) l = l.filter((r) => r.owner === decodeURIComponent(own[1]));
    const like = /^like\.(.*)$/.exec(p.get('id') || ''); if (like) { const re = new RegExp('^' + like[1].split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'); l = l.filter((r) => re.test(r.id)); }
    const sel = (p.get('select') || '').split(',');
    return l.map((r) => { const o = {}; for (const s of sel) { const [nom, chemin] = s.includes(':') ? s.split(':') : [s, s];
      if (chemin === 'id') o[nom] = r.id; else if (chemin === 'data') o[nom] = r.data;
      else { const parts = chemin.split(/->>?/).slice(1); let v = r.data; for (const k of parts) v = v && typeof v === 'object' ? v[k] : undefined; o[nom] = v == null ? null : String(v); } } return o; });
  };
  console.log('── N1-N2. Seulement SES lignes, en scalaires');
  const q = A.requeteNavigateurs(MOI);
  dit(q && /(^|&)owner=eq\./.test(q) && !/select=[^&]*(^|,)data(,|&|$)/.test(q), 'N1 `owner=eq.<lui>` et une projection scalaire (jamais `select=data`)', q);
  dit(A.requeteNavigateurs('') === null && A.requeteNavigateurs("x' or 1=1") === null, 'N1b sans identifiant valable : rien n’est demandé');
  const L = A.navigateursExtension(q ? servir(q) : null, M) || [];
  dit(L.length === 3 && !L.some((x) => x.id === 'zz9'), 'N2 rien de l’autre vendeur ne sort (la fausse base le rendrait sans filtre)', L.map((x) => x.id));
  console.log('── N3-N4. Pas su, ordre');
  dit(A.navigateursExtension(null) === null && A.navigateursExtension(undefined) === null, 'N3 lecture ratée ⇒ null (jamais une liste vide)');
  const c3 = L.find((x) => x.id === 'cc3'), b2 = L.find((x) => x.id === 'bb2'), a1 = L.find((x) => x.id === 'aa1');
  dit(c3 && c3.atMs === null && c3.active === null, 'N3b une date illisible : ni active ni ancienne', c3);
  dit(b2 && b2.ver === '' && a1 && a1.ver === '5.441.0' && a1.nom === 'Mac · Chrome' && a1.active === true && b2.active === false, 'N3c version illisible pas affichée ; active = vue depuis moins de 24 h', [a1, b2]);
  dit(L.map((x) => x.id).join() === 'aa1,bb2,cc3', 'N4 le plus récent d’abord', L.map((x) => x.id));
  const dbl = A.navigateursExtension([{ id: 'ext_appareil_aa1', atMs: '5' }, { id: 'ext_appareil_aa1', atMs: '6' }], M);
  dit(dbl.length === 1, 'N4b un navigateur une fois');
  console.log('── N5. L’écran');
  const reg = sansCommentaires('src/ecrans/Reglages.jsx');
  const ac = (reg.split('function AppareilsConnectes()')[1] || '').split('\nfunction ')[0];
  dit(/<NavigateursExtension owner=\{\(AUTH\.user && AUTH\.user\.id\) \|\| ''\} lireTout=\{lireTout\}/.test(ac), 'N5 la carte est rendue dans « Appareils connectés », avec SON identifiant');
  const ne = sansCommentaires('src/NavigateursExtension.jsx');
  dit(/requeteNavigateurs\(owner\)/.test(ne) && /lireTout\(q\)/.test(ne) && !/fetch\(/.test(ne), 'N5b elle lit par `requeteNavigateurs(SON id)` et `lireTout` (pagination), rien d’autre');
  const sec = sansCommentaires('src/securiteCompte.js');
  dit(/\/auth\/v1\/logout\?scope=global/.test(sec) && /askConfirm\(\{ title: 'Se déconnecter partout \?'/.test(reg), '« Se déconnecter partout » : confirmé, scope global');
  const cles = [...new Set([...ne.matchAll(/tr\('([^']+)'/g)].map((m) => m[1]))];
  const manque = [];
  for (const l of ['fr', 'en', 'es', 'it', 'de']) { const t = fs.readFileSync(path.join(T, `src/i18n/langues/${l}/parametres.js`), 'utf8'); for (const k of cles) if (!t.includes(JSON.stringify(k))) manque.push(l + ':' + k); }
  dit(cles.length >= 8 && manque.length === 0, `N5c chaque texte neuf dans les cinq langues (${cles.length} clés)`, manque);
  fin();
})().catch((e) => { dit(false, 'exécution', String(e && e.stack || e).slice(0, 400)); fin(); });

function fin() {
  try { fs.rmSync(T, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ko ? '❌' : '✅'} audit-appareils-extension : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
}
