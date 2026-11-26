// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : RENTABILITÉ PAR SOURCE D'ACHAT (23 nov., lot rentabilite-source)
// Il EXÉCUTE les vraies règles (src/meilleuresSources.js `bilanSources` → src/rentabiliteSource.js) sur une base
// INVENTÉE (le dépôt est public) et recompte chaque nombre par un code À PART :
//   S1 le taux de revente d'une source = articles revendus ÷ articles achetés (recompté sur la base) ;
//   S2 le bénéfice moyen = la moyenne des bénéfices CONNUS des reventes reliées, sa couverture (`nBenef`) rendue ;
//      « au plus » quand des frais ne sont pas confirmés ;
//   S3 identité : 50 paires au même titre, même marque, même taille — une vente SANS lien d'achat n'entre dans
//      aucune source (comptée « sans achat relié »), jamais rattachée par ressemblance ;
//   S4 les tris : marge (le plus haut d'abord), vitesse (le délai le plus court), volume ; une source sans la mesure
//      à la fin ; « source pas saisie » toujours dernière ;
//   S5 « pas su » : publication absente ⇒ null ; pas encore lue ⇒ undefined ; jamais une liste vide ;
//   S6 une source par chiffre : la vue ne calcule rien (aucune somme, aucune division, l'ordre vient du modèle) ;
//      la lecture est celle de CE compte VRM (`lireMeilleures(owner)`) ; l'axe vit dans l'écran existant (aucun
//      second écran de rentabilité) ; chaque texte passe par tr() dans les cinq langues.
// Lancer : node scripts/audit-rentabilite-source.cjs [--mutation=<nom>]  (chaque mutation doit rougir)
//   mutations : taux moyenne ordre passu vue owner ressemblance
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-rsrc-'));
fs.cpSync(path.join(R, 'src'), path.join(T, 'src'), { recursive: true, filter: (s) => !/\.(png|jpe?g|webp|mp4|onnx|woff2?)$/i.test(s) });
fs.writeFileSync(path.join(T, 'package.json'), '{"type":"module"}');
const MUTS = {
  taux: ['src/rentabiliteSource.js', 'Math.round((revendus / articles) * 100)', 'Math.round((revendus / Math.max(1, revendus)) * 100)'],
  moyenne: ['src/rentabiliteSource.js', "beneficeMoyen: fini(s.beneficeMoyen) ? Math.round(Number(s.beneficeMoyen)) : null,", "beneficeMoyen: fini(s.benefice) && s.revendus ? Math.round(Number(s.benefice) / s.revendus) : null,"],
  ordre: ['src/rentabiliteSource.js', 'sort((a, b) => (a.pasSaisie - b.pasSaisie)\n    || ', 'sort((a, b) => '],
  passu: ['src/rentabiliteSource.js', "if (!bilan || !Array.isArray(bilan.sources)) return null;", "if (!bilan || !Array.isArray(bilan.sources)) bilan = { sources: [] };"],
  vue: ['src/natif/ecrans/StatsVendsMieux.jsx', "const ordre = S ? S.ordre[tri].map((k) => parK.get(k)).filter(Boolean) : [];", "const ordre = S ? S.groupes.slice().sort((x, y) => y.revendus - x.revendus) : [];"],
  owner: ['src/aujourdhui/StatsBranche.jsx', "const relire = () => setBilanSrc(lireMeilleures(owner));", "const relire = () => setBilanSrc(lireMeilleures(''));"],
  ressemblance: ['src/meilleuresSources.js', "  const tx = txLien(e.buyFromId);\n  if (tx) return { genre: 'vinted', id: tx };", "  const tx = txLien(e.buyFromId) || txLien(e._titreAchat);\n  if (tx) return { genre: 'vinted', id: tx };"],
};
if (MUT) {
  const m = MUTS[MUT];
  if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  const f = path.join(T, m[0]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(m[1])) { console.log('❌ mutation impossible : motif absent — ' + m[1].slice(0, 90)); process.exit(2); }
  fs.writeFileSync(f, s.replace(m[1], m[2]));
  console.log('… mutation « ' + MUT + ' » posée');
}
const imp = (f) => import(pathToFileURL(path.join(T, f)).href).catch((e) => { dit(false, `${f} se charge`, String(e.message).slice(0, 200)); return {}; });
const sansCommentaires = (f) => fs.readFileSync(path.join(T, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

(async () => {
  // localStorage minimal (la lecture de la publication)
  const mem = new Map();
  global.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  global.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
  global.CustomEvent = class { constructor(t) { this.type = t; } };
  const MS = await imp('src/meilleuresSources.js');
  const RS = await imp('src/rentabiliteSource.js');
  if (!MS.bilanSources || !RS.rentabiliteParSource) { dit(false, 'les modules exportent bilanSources et rentabiliteParSource'); return fin(); }

  // ── La base inventée ──────────────────────────────────────────────────────
  // 50 paires « Nike Air Max 90 · 42 », toutes au MÊME titre : 30 achetées sur Vinted (transactions 7000001…),
  // 12 hors plateforme (Leboncoin 6, vide-grenier 4, rien de saisi 2), 8 jamais reliées à un achat.
  const J = 86400000, T0 = Date.parse('2026-06-01T12:00:00Z'), MAINTENANT = Date.parse('2026-11-23T12:00:00Z');
  const TITRE = 'Nike Air Max 90 blanche 42';
  const achatsVinted = [], hors = [], fiches = {}, ventes = [];
  const cleNum = (x) => String(x).toUpperCase().replace(/\s+/g, '').replace(/^0+(?=\d)/, '');
  for (let i = 0; i < 30; i++) {
    const tx = String(7000001 + i);
    achatsVinted.push({ transaction_id: tx, title: TITRE, date: new Date(T0 + i * J).toISOString(), price: { amount: String(30 + i) } });
    fiches['it' + i] = { numero: String(i + 1), title: TITRE, buyFromId: tx };
    if (i < 20) {   // 20 revendues ; bénéfice connu pour 17 (3 sans prix d'achat connu ⇒ benefice null) ; 2 « partiel »
      ventes.push({ id: 'vinted:' + (9000001 + i), ts: T0 + i * J + (5 + i) * J, entree: { numero: String(i + 1), title: TITRE, buyFromId: tx },
        prix: (60 + i) * 100, benefice: i < 17 ? (25 + i) * 100 : null, partiel: i === 3 || i === 4 });
    }
  }
  const SRC_HORS = ['Leboncoin', 'Leboncoin', 'Leboncoin', 'Leboncoin', 'Leboncoin', 'Leboncoin', 'vide grenier', 'Vide-grenier', 'vide-grenier', 'Vide grenier', '', ''];
  SRC_HORS.forEach((src, j) => {
    const num = String(100 + j);
    hors.push({ id: 'h' + j, title: TITRE, price: '20', date: new Date(T0 + j * J).toISOString().slice(0, 10), source: src, numero: num });
    if (j % 2 === 0) ventes.push({ id: 'lbc:' + j, ts: T0 + j * J + (3 + j) * J, entree: { numero: num, title: TITRE }, prix: 5000, benefice: 3000 - j * 100, partiel: false });
  });
  // 8 ventes au MÊME titre, sans aucun lien d'achat (ni transaction, ni N° d'un achat hors plateforme).
  for (let k = 0; k < 8; k++) ventes.push({ id: 'vinted:' + (9100001 + k), ts: T0 + 40 * J, entree: { numero: String(500 + k), title: TITRE, _titreAchat: '7000001' }, prix: 7000, benefice: 4000, partiel: false });

  const bilan = MS.bilanSources({ achatsVinted, estAnnule: () => false, montantVinted: (o) => Number(o.price.amount), hors, prixHors: (b) => Number(b.price),
    registre: null, fiches, saleOv: {}, ventes, cleNum, maintenant: MAINTENANT });
  const S = RS.rentabiliteParSource(bilan);
  const par = new Map((S && S.groupes || []).map((g) => [g.k, g]));

  // ── Le recompte À PART ────────────────────────────────────────────────────
  console.log('── S1-S2. Les chiffres, recomptés à part');
  const vinted = par.get('vinted');
  const vVinted = ventes.filter((v) => /^vinted:90000/.test(v.id));
  const connus = vVinted.filter((v) => v.benefice != null);
  const moyV = Math.round(connus.reduce((t, v) => t + v.benefice, 0) / connus.length);
  dit(vinted && vinted.articles === 30 && vinted.revendus === 20 && vinted.taux === Math.round((20 / 30) * 100), 'S1 Vinted : 20 revendus sur 30 achetés ⇒ 67 %', vinted);
  dit(vinted && vinted.beneficeMoyen === moyV && vinted.nBenef === 17, `S2 Vinted : bénéfice moyen = moyenne des 17 bénéfices connus (${moyV} c), « sur 17 »`, vinted && { m: vinted.beneficeMoyen, n: vinted.nBenef });
  dit(vinted && vinted.partiel === true, 'S2b deux reventes aux frais pas confirmés ⇒ « au plus »');
  const delaiV = Math.round(vVinted.reduce((t, v, i) => t + (v.ts - (T0 + i * J)), 0) / vVinted.length / J);
  dit(vinted && vinted.delai === delaiV && vinted.nDelai === 20, `S1b délai moyen achat → vente recompté (${delaiV} j)`, vinted && vinted.delai);
  const lbc = par.get('leboncoin'), vg = par.get('vide-grenier'), ns = par.get('non-saisie');
  const vLbc = ventes.filter((v) => /^lbc:/.test(v.id) && Number(v.id.split(':')[1]) < 6);
  dit(lbc && lbc.articles === 6 && lbc.revendus === vLbc.length && lbc.taux === Math.round((vLbc.length / 6) * 100), `S1c Leboncoin (saisi « Leboncoin ») : ${vLbc.length} revendus sur 6`, lbc);
  dit(lbc && lbc.beneficeMoyen === Math.round(vLbc.reduce((t, v) => t + v.benefice, 0) / vLbc.length), 'S2c Leboncoin : la moyenne recomptée', lbc && lbc.beneficeMoyen);
  dit(vg && vg.articles === 4, 'S1d « vide grenier », « Vide-grenier », « vide-grenier » : une seule source (4 achats)', vg);
  dit(ns && ns.pasSaisie === true && ns.articles === 2, 'S1e deux achats sans source écrite : « source pas saisie », à part', ns);

  console.log('── S3. L’identité, jamais la ressemblance (50 paires au même titre)');
  dit(S && S.sansAchat === 8, 'S3 les 8 ventes au même titre SANS lien d’achat ne vont dans aucune source', S && S.sansAchat);
  const total = (S && S.groupes || []).reduce((t, g) => t + g.revendus, 0);
  dit(total === 20 + vLbc.length + ventes.filter((v) => /^lbc:/.test(v.id) && Number(v.id.split(':')[1]) >= 6).length, 'S3b chaque revente comptée une fois, dans SA source', total);

  console.log('── S4. Les tris');
  const o = S ? S.ordre : {};
  dit(o.marge && o.marge[o.marge.length - 1] === 'non-saisie' && o.vitesse[o.vitesse.length - 1] === 'non-saisie' && o.volume[o.volume.length - 1] === 'non-saisie', '« source pas saisie » toujours dernière', o);
  const mesure = (k, f) => (k || []).filter((x) => x !== 'non-saisie').map((x) => f(par.get(x)));
  const croiss = (l) => l.every((x, i) => i === 0 || l[i - 1] == null || x == null || l[i - 1] <= x);
  const decr = (l) => l.every((x, i) => i === 0 || l[i - 1] == null || x == null || l[i - 1] >= x);
  dit(decr(mesure(o.marge, (g) => g.beneficeMoyen)), 'S4 marge : le bénéfice moyen le plus haut d’abord', mesure(o.marge, (g) => g.beneficeMoyen));
  dit(croiss(mesure(o.vitesse, (g) => g.delai)), 'S4b vitesse : le délai le plus court d’abord', mesure(o.vitesse, (g) => g.delai));
  const sansMesureFin = (l, f) => { const v = mesure(l, f); const i = v.indexOf(null); return i < 0 || v.slice(i).every((x) => x == null); };
  dit(sansMesureFin(o.marge, (g) => g.beneficeMoyen) && sansMesureFin(o.vitesse, (g) => g.delai), 'S4c une source sans la mesure va à la fin (jamais classée sur un chiffre qu’elle n’a pas)');

  console.log('── S5. « Pas su »');
  dit(RS.rentabiliteParSource(null) === null && RS.rentabiliteParSource(undefined) === undefined && RS.rentabiliteParSource({}) === null, 'S5 publication absente ⇒ null, pas encore lue ⇒ undefined (jamais [])');
  MS.publierMeilleures(bilan, { owner: 'vendeur-A' });
  dit(MS.lireMeilleures('vendeur-B') === null && Array.isArray((MS.lireMeilleures('vendeur-A') || {}).sources), 'S5b la publication d’un autre compte VRM n’est jamais lue');

  console.log('── S6. Une source par chiffre, le même écran');
  const vue = sansCommentaires('src/natif/ecrans/StatsVendsMieux.jsx');
  const ps = (vue.split('function ParSource')[1] || '');
  dit(ps && !/\.reduce\(|\/ *g\.articles|\/ *g\.revendus|\.sort\(/.test(ps) && /S\.ordre\[tri\]/.test(ps), 'S6 la vue ne calcule rien (aucune somme, division ni tri ; l’ordre vient du modèle)');
  const br = sansCommentaires('src/aujourdhui/StatsBranche.jsx');
  dit(/lireMeilleures\(owner\)/.test(br) && !/lireMeilleures\(\s*['"`]/.test(br), 'S6b la publication lue est celle de CE compte VRM');
  dit(/AXE_SOURCE/.test(vue) && !fs.existsSync(path.join(T, 'src/natif/ecrans/StatsSources.jsx')), 'S6c l’axe « Source » vit dans « Ce que tu vends le mieux » (aucun second écran)');
  const cles = [...new Set([...ps.matchAll(/tr\('([^']+)'/g)].map((m) => m[1]))].concat(['rt.axe.source']);
  const manque = [];
  for (const l of ['fr', 'en', 'es', 'it', 'de']) { const t = fs.readFileSync(path.join(T, `src/i18n/langues/${l}/rentabilite.js`), 'utf8') + fs.readFileSync(path.join(T, `src/i18n/langues/${l}.js`), 'utf8');
    for (const k of cles) if (!/^(rt|v2)\./.test(k) || k === 'rt.axe.source') { if (!t.includes(JSON.stringify(k))) manque.push(l + ':' + k); } }
  dit(manque.length === 0, `S6d chaque texte de l’axe dans les cinq langues (${cles.length} clés)`, manque);
  fin();
})().catch((e) => { dit(false, 'exécution', String(e && e.stack || e).slice(0, 400)); fin(); });

function fin() {
  try { fs.rmSync(T, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ko ? '❌' : '✅'} audit-rentabilite-source : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
}
