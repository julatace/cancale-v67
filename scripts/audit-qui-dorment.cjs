// Audit : « ARTICLES QUI DORMENT » (3 novembre) — src/quiDorment.js et son
// branchement dans l'écran Annonces.
//   · la règle : en ligne depuis AU MOINS le seuil (30/60/90, seuils cumulés),
//     âge inconnu ⇒ dans aucune liste (compté à part), le plus ancien d'abord ;
//   · les mêmes bornes que le stock qui dort de Statistiques (`stockQuiDort`) :
//     sur le même jeu, la liste à 30/60/90 j = les nombres de Statistiques ;
//   · le branchement : la liste est celle de la grille (`annBase`, la règle
//     « en ligne »), chaque geste ouvre l'écran EXISTANT (Republier → modifier /
//     recréer avec CET article pré-choisi, la fiche Leboncoin, le formulaire eBay),
//     aucun appel à l'extension ni à eBay depuis la liste elle-même.
// `--prouve` : chaque règle réaffaiblie doit faire passer l'audit au rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const R = path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'quiDorment.js');
const STATS = fs.readFileSync(path.join(R, 'src', 'statsVentes.js'), 'utf8');
const APP = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');

const MUTATIONS = {
  seuil_strict: (s) => s.replace('if (age >= s) liste.push(a);', 'if (age > s) liste.push(a);'),
  inconnu_vaut_zero: (s) => s.replace("const age = a.age == null ? NaN : Number(a.age);", 'const age = Number(a.age);'),
  tri_inverse: (s) => s.replace('liste.sort((x, y) => Number(y.age) - Number(x.age) ||', 'liste.sort((x, y) => Number(x.age) - Number(y.age) ||'),
  seuil_libre: (s) => s.replace('export const seuilValide = (s) => (SEUILS_QUI_DORMENT.includes(Number(s)) ? Number(s) : 30);', 'export const seuilValide = (s) => Number(s) || 30;'),
};

async function charger(src, nom) {
  const f = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, src);
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

// Le jeu : 10 annonces en ligne. Âges : 120, 95, 90, 61, 61, 60, 59, 30, 29, inconnu.
// À la main : ≥ 30 ⇒ 8 ; ≥ 60 ⇒ 6 ; ≥ 90 ⇒ 3 ; âges connus 9 sur 10 ;
// ordre 120 · 95 · 90 · 61 · 61 · 60 · 59 · 30.
// Deux annonces au MÊME âge (61) : rangées par identifiant (a4 avant a9).
const JEU = [
  { id: 'a1', age: 59, prix: 40 }, { id: 'a2', age: 120, prix: 80 }, { id: 'a3', age: 29, prix: 30 }, { id: 'a4', age: 61, prix: 55 },
  { id: 'a5', age: null, prix: 60 }, { id: 'a6', age: 90, prix: 70 }, { id: 'a7', age: 30, prix: 45 }, { id: 'a8', age: 95, prix: 50 },
  { id: 'a9', age: 61, prix: 65 }, { id: 'a10', age: 60, prix: 20 },
];
const ATT = { 30: ['a2', 'a8', 'a6', 'a4', 'a9', 'a10', 'a1', 'a7'], 60: ['a2', 'a8', 'a6', 'a4', 'a9', 'a10'], 90: ['a2', 'a8', 'a6'] };

async function audit(src, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
  let M, S;
  try { M = await charger(src, 'quiDorment'); S = await charger(STATS, 'statsVentes'); } catch (e) { dit(false, 'les modules se chargent', e.message); return ko || 1; }
  for (const s of [30, 60, 90]) {
    const r = M.articlesQuiDorment(JEU, s);
    dit(r && r.liste.map((x) => x.id).join(',') === ATT[s].join(','), `seuil ${s} j : ${ATT[s].length} articles, du plus ancien au plus récent (à âge égal, par identifiant)`, r && r.liste.map((x) => `${x.id}:${x.age}`).join(' '));
    dit(r && r.total === 10 && r.datesConnues === 9 && r.n === ATT[s].length, `seuil ${s} j : 10 en ligne, 9 âges connus (l’inconnu n’est dans aucune liste)`, r && `${r.total}/${r.datesConnues}/${r.n}`);
    const st = S.stockQuiDort(JEU.map((a) => ({ age: a.age, prix: a.prix, achat: null })));
    dit(st && st.seuils[s].n === r.n, `seuil ${s} j : le même nombre que « le stock qui dort » de Statistiques (${st && st.seuils[s].n})`, String(r.n));
  }
  dit(M.articlesQuiDorment(JEU, 45).seuil === 30 && M.seuilValide('60') === 60 && M.seuilValide('abc') === 30, 'un seuil hors 30/60/90 retombe sur 30 (jamais un seuil inventé)');
  dit(M.articlesQuiDorment(null, 30) === null, 'annonces pas lues ⇒ null (« — »), jamais une liste vide');
  return ko;
}

(async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  if (process.argv.includes('--prouve')) {
    let rate = 0;
    for (const [nom, f] of Object.entries(MUTATIONS)) {
      const m = f(src);
      if (m === src) { console.log(`❌ mutation ${nom} : motif absent`); rate++; continue; }
      const ko = await audit(m, false);
      console.log(`${ko ? '✅' : '❌'} mutation ${nom} : ${ko ? ko + ' rouge(s)' : 'AUCUN rouge'}`);
      if (!ko) rate++;
    }
    console.log(rate ? `\n❌ ${rate} mutation(s) non détectée(s)` : `\n✅ toutes les mutations (${Object.keys(MUTATIONS).length}) sont rouges`);
    process.exit(rate ? 1 : 0);
  }
  let ko = await audit(src, true);
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');
  const dit = (c, m) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m); };
  dit(/annSort==='sleeping'\) \{\s*arr = articlesQuiDorment\(arr\.map\(it=>\(\{id:String\(it\.id\),it,age:listedAgeDays\(it\)\}\)\), seuilDort\)\.liste\.map\(x=>x\.it\);/.test(code),
    'la vue « qui dorment » d’Annonces passe par `articlesQuiDorment` au seuil choisi, sur la base de la grille');
  dit(/const annBase = useMemo\(\(\) => \(listings\.items \|\| \[\]\)\.filter\(garderAnnonce\)/.test(code), 'la base est `listings.items` (la règle « en ligne ») filtrée comme la grille');
  // (5 nov.) Depuis le 4 nov. (0b293942, « Masquées ») la vue est une branche d'une
  // chaîne de ternaires (`) : annSort==='sleeping' ? (`), la grille dans le DERNIER
  // « sinon ». Même règle : dans cette vue, la liste, et la grille seulement ailleurs.
  dit(/\{annSort==='sleeping' \? \(\s*<QuiDorment /.test(code)
    || /\) : annSort==='sleeping' \? \(\s*<QuiDorment [^\n]*\n(?:(?!\) : )[^\n]*\n)*?\s*\) : \(<>\s*<div className="vrm-ledger-heading[^\n]*\n\s*<div className="vrm-ann-grid/.test(code), 'la liste remplace la grille dans cette vue');
  const menu = (/\{dortAgir && \(\(\)=>\{[\s\S]*?<\/SheetShell>/.exec(code) || [''])[0];
  dit(/versRepub\('modifier'\)/.test(menu) && /versRepub\('recreer'\)/.test(menu) && /setRepubReprise\(\[String\(it\.id\)\]\); setRepubAction\(act\);/.test(menu),
    'Baisser le prix / Republier ouvrent l’atelier Republier existant (« modifier » / « recréer ») avec CET article pré-choisi');
  dit(/DEMANDE_LBC_FICHE\.id = String\(it\.id\)/.test(menu) && /onNav\('leboncoin'\)/.test(menu) && /DEMANDE_EBAY_PAIRE\.id = String\(it\.id\)/.test(menu) && /onNav\('ebay_annonces'\)/.test(menu),
    'Leboncoin / eBay : l’écran de préparation existant, désigné par l’identifiant de l’article');
  dit(!/vmrCmd|appelEbay|fetch\(/.test(menu), 'aucune action envoyée depuis la liste : chaque geste ouvre un écran où c’est SON clic qui lance');
  dit(/data\.queue\.find\(\(x\) => String\(x\.id\) === String\(d\.id\)\)/.test(code) && /paires\.find\(\(x\) => String\(x\.id\) === String\(d\.id\)\)/.test(code), 'Leboncoin et eBay retrouvent l’article par son identifiant (jamais un titre)');
  console.log(ko ? `\n❌ audit-qui-dorment : ${ko} rouge(s)` : '\n✅ audit-qui-dorment : tout vert');
  process.exit(ko ? 1 : 0);
})();
