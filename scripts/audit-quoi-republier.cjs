// Audit : « QUELLES ANNONCES REPUBLIER ? » (11 nov., lot quoi-republier) — src/quoiRepublier.js
// et ses branchements (Annonces → Republier, Republier sur Leboncoin, Ma journée).
//   · la règle : ancienne = `articlesQuiDorment` (src/quiDorment.js, au seuil 30/60/90) — aucune
//     copie de sa règle ; peu vue = vues LUES ≤ plafond ET favoris LUS ≤ plafond ; un compteur
//     pas lu ⇒ « à vérifier », jamais dans la liste (pas su ≠ peu) ; âge inconnu ⇒ compté à part ;
//     identité = la clé (compte + identifiant), 50 annonces au même titre = 50 lignes ;
//     seuils hors choix ⇒ le défaut ; pas lues ⇒ null ;
//   · les branchements : la carte coche (sélection de l'atelier, par identité) et ne lance rien ;
//     Ma journée ne compte que la liste proposée, une carte cachable (journee-perso).
// `--prouve` : chaque règle réaffaiblie doit faire passer l'audit au rouge.
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'quoiRepublier.js');
const APP = require('./_source-app.cjs').sourceAppDe(path.join(R, 'src', 'App.jsx'));
const LBC = fs.readFileSync(path.join(R, 'src', 'ecrans', 'Leboncoin.jsx'), 'utf8');
const CARTE = fs.readFileSync(path.join(R, 'src', 'design', 'QuoiRepublier.jsx'), 'utf8');

const MUTATIONS = {
  pas_lu_vaut_peu: (s) => s.replace('if (f == null || v == null) aVerifier.push(ligne); else liste.push(ligne);', 'liste.push(ligne);'),
  favoris_ignores: (s) => s.replace('if ((f != null && f > r.favoris) || (v != null && v > r.vues))', 'if ((v != null && v > r.vues))'),
  vues_ignorees: (s) => s.replace('if ((f != null && f > r.favoris) || (v != null && v > r.vues))', 'if ((f != null && f > r.favoris))'),
  plafond_strict: (s) => s.replace('(f != null && f > r.favoris) || (v != null && v > r.vues)', '(f != null && f >= r.favoris) || (v != null && v >= r.vues)'),
  age_recopie: (s) => s.replace('const d = articlesQuiDorment(base, r.jours);', 'const d = { total: base.length, datesConnues: base.length, n: base.length, liste: base.filter((x) => Number(x.age) > r.jours) };'),
  identite_titre: (s) => s.replace("const cleDe = (a) => String(a && (a.cle != null && a.cle !== '' ? a.cle : a.id));", "const cleDe = (a) => String(a && (a.titre || a.id));"),
  seuil_libre: (s) => s.replace('favoris: dans(SEUILS_FAVORIS_MAX, b.favoris, REGLAGE_DEFAUT.favoris),', 'favoris: Number(b.favoris ?? REGLAGE_DEFAUT.favoris),'),
  pas_lu_liste_vide: (s) => s.replace('if (!Array.isArray(annonces)) return null;', 'if (!Array.isArray(annonces)) annonces = [];'),
  journee_a_verifier: (s) => s.replace('(res && res.n > 0 ? { n: res.n,', '(res && (res.n + res.aVerifier.length) > 0 ? { n: res.n + res.aVerifier.length,'),
};

async function charger(src) {
  const abs = (m) => pathToFileURL(path.join(R, 'src', m)).href;
  const code = src.replace("from './quiDorment.js'", `from '${abs('quiDorment.js')}'`).replace("from './vendrePlus.js'", `from '${abs('vendrePlus.js')}'`);
  const f = path.join(os.tmpdir(), `quoiRepublier-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, code);
  try { return await import(pathToFileURL(f).href); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}

// Le jeu (réglage par défaut : 30 j, ≤ 1 favori, ≤ 25 vues). À la main :
//   p1 120 j · 0 fav · 10 vues   ⇒ liste
//   p2  95 j · 1 fav · 25 vues   ⇒ liste (bornes comprises)
//   p3  90 j · 2 fav · 5 vues    ⇒ marche (favoris au-dessus)
//   p4  60 j · 0 fav · 40 vues   ⇒ marche (vues au-dessus)
//   p5  45 j · fav PAS LU · 3 v  ⇒ à vérifier
//   p6  40 j · 0 fav · vues PAS LUES ⇒ à vérifier
//   p7  50 j · fav PAS LU · 99 v ⇒ marche (un compteur lu suffit à dire qu'elle est vue)
//   p8  29 j · 0 · 0            ⇒ trop récente
//   p9  âge inconnu             ⇒ sans date
//   + 50 annonces au MÊME titre, 70 j, 0 fav, 2 vues, clés distinctes ⇒ 50 lignes
const MEME = Array.from({ length: 50 }, (_, i) => ({ cle: `111:${8000 + i}`, id: String(8000 + i), titre: 'Nike Air Force 1 blanche 42', age: 70, favoris: 0, vues: 2 }));
const JEU = [
  { cle: '111:p1', id: 'p1', titre: 'A', age: 120, favoris: 0, vues: 10 },
  { cle: '111:p2', id: 'p2', titre: 'B', age: 95, favoris: 1, vues: 25 },
  { cle: '111:p3', id: 'p3', titre: 'C', age: 90, favoris: 2, vues: 5 },
  { cle: '222:p4', id: 'p4', titre: 'D', age: 60, favoris: 0, vues: 40 },
  { cle: '222:p5', id: 'p5', titre: 'E', age: 45, favoris: null, vues: 3 },
  { cle: '222:p6', id: 'p6', titre: 'F', age: 40, favoris: 0, vues: null },
  { cle: '222:p7', id: 'p7', titre: 'G', age: 50, favoris: null, vues: 99 },
  { cle: '222:p8', id: 'p8', titre: 'H', age: 29, favoris: 0, vues: 0 },
  { cle: '222:p9', id: 'p9', titre: 'I', age: null, favoris: 0, vues: 0 },
  ...MEME,
];

async function audit(src, bavard) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
  let M;
  try { M = await charger(src); } catch (e) { dit(false, 'le module se charge', e.message); return ko || 1; }
  const r = M.quoiRepublier(JEU, null);
  const ids = r ? r.liste.map((x) => x.cle) : [];
  dit(r && ids.slice(0, 2).join(',') === '111:p1,111:p2' && ids.length === 52, 'défaut (30 j, ≤ 1 favori, ≤ 25 vues) : p1, p2 (bornes comprises) puis les 50 au même titre, le plus ancien d’abord', ids.slice(0, 4).join(','));
  dit(r && ids.filter((x) => /^111:8\d{3}$/.test(x)).length === 50 && new Set(ids).size === ids.length, '50 annonces au même titre : 50 lignes, 50 identités distinctes (jamais le titre)');
  dit(r && !ids.includes('111:p3') && !ids.includes('222:p4') && !ids.includes('222:p7') && r.marchent === 3, 'p3 (2 favoris), p4 (40 vues), p7 (99 vues lues) : elles marchent, pas proposées', r && String(r.marchent));
  dit(r && r.aVerifier.map((x) => x.cle).join(',') === '222:p5,222:p6', 'p5 (favoris pas lus), p6 (vues pas lues) : « à vérifier », jamais dans la liste', r && r.aVerifier.map((x) => x.cle).join(','));
  dit(r && r.sansDate === 1 && !ids.includes('222:p8') && r.total === JEU.length, 'p9 (âge inconnu) compté à part ; p8 (29 j) trop récente', r && `${r.sansDate}/${r.total}`);
  const r60 = M.quoiRepublier(JEU, { jours: 60, favoris: 2, vues: 50 });
  dit(r60 && r60.liste.map((x) => x.cle).slice(0, 4).join(',') === '111:p1,111:p2,111:p3,111:8000' && r60.liste.length === 54, '60 j, ≤ 2 favoris, ≤ 50 vues : p1, p2, p3, les 50, p4 (60 j, 40 vues)', r60 && `${r60.liste.length} ${r60.liste.slice(-1)[0].cle}`);
  const r0 = M.quoiRepublier(JEU, { jours: 90, favoris: 0, vues: 10 });
  dit(r0 && r0.liste.map((x) => x.cle).join(',') === '111:p1', '90 j, 0 favori, ≤ 10 vues : p1 seule', r0 && r0.liste.map((x) => x.cle).join(','));
  const lr = M.lireReglage({ jours: 45, favoris: 7, vues: 'x' });
  dit(lr.jours === 30 && lr.favoris === 1 && lr.vues === 25 && M.lireReglage({ jours: 90, favoris: 5, vues: 100 }).vues === 100, 'un seuil hors des choix retombe sur le défaut (jamais un seuil inventé)', JSON.stringify(lr));
  dit(M.quoiRepublier(null, null) === null && M.ligneJourneeRepublier(null) === null, 'annonces pas lues ⇒ null (« — »), jamais une liste vide');
  const lj = M.ligneJourneeRepublier(M.quoiRepublier(JEU.filter((a) => ['222:p5', '222:p6'].includes(a.cle)), null));
  dit(lj === null, 'Ma journée : seulement des « à vérifier » ⇒ aucune ligne (pas su ≠ peu)');
  const lj2 = M.ligneJourneeRepublier(r);
  dit(lj2 && lj2.n === 52 && lj2.jours === 30, 'Ma journée : le nombre de la liste proposée et son seuil', JSON.stringify(lj2));
  const T0 = Date.UTC(2026, 10, 11, 12);
  dit(M.ageDepuis('2026-10-01T12:00:00Z', T0) === 41 && M.ageDepuis('', T0) === null && M.ageDepuis('pas une date', T0) === null && M.ageDepuis('2027-01-01', T0) === null, 'âge Leboncoin depuis la date LUE ; illisible ou future ⇒ null');
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
  const sans = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');
  const code = sans(APP), lbc = sans(LBC), carte = sans(CARTE);
  const dit = (c, m) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m); };
  dit(/import \{ articlesQuiDorment[^}]*\} from '\.\/quiDorment\.js';/.test(src) && /const d = articlesQuiDorment\(base, r\.jours\);/.test(src), 'la règle « ancienne » est celle de quiDorment (aucune copie)');
  dit(/const quoiRep = useMemo\(\(\) => \{\s*if \(!Array\.isArray\(listings\.items\) \|\| listings\.error\) return null;\s*return quoiRepublier\(annBase\.map\(/.test(code) && /cle: uid \+ ':' \+ String\(it\.id\)/.test(code), 'Vinted : la base de la grille (`annBase`), identité compte + identifiant ; pas lues ⇒ null');
  const bloc = (/<QuoiRepublier site="vinted"[\s\S]*?\/>\s*\) : null\}/.exec(code) || [''])[0];
  dit(/annSort==='republier' && /.test(code) && bloc && /setSelAnn\(/.test(bloc) && /x\.uid===l\.uid && x\.id===l\.id/.test(bloc), 'la carte Vinted coche dans la sélection de l’atelier Republier, par identité');
  dit(bloc && /a\.raisonPas/.test(bloc) && !/vmrCmd|setRepubAction|setKitMain|fetch\(/.test(bloc), 'la carte ne lance rien (ni commande, ni atelier) et respecte les refus de la liste');
  const lbloc = (/<QuoiRepublier site="leboncoin"[\s\S]*?\/> : null\}/.exec(lbc) || [''])[0];
  dit(lbloc && /sel\.has\(l\.cle\)/.test(lbloc) && /REPUB_LBC_MAX/.test(lbloc) && !/vmrCmd|lancer\(|setEtape/.test(lbloc), 'Leboncoin : la carte coche dans « Republier sur Leboncoin » (identifiant LBC, plafond du passage), ne lance rien');
  dit(/quoiRepublier\(liste\.map\(\(it\) => \(\{ cle: String\(it\.lbc\.id\), id: String\(it\.lbc\.id\), age: ageDepuis\(it\.lbc\.publieeLe\), vues: it\.lbc\.vues, favoris: it\.lbc\.favoris,/.test(lbc), 'Leboncoin : âge depuis la date LUE, vues et favoris LUS, la même règle');
  dit(/ligneJourneeRepublier\(quoiRep\)/.test(code) && /id: 'quoi-republier'/.test(code) && /demanderVue\('quoirepublier'\)/.test(code) && /prendreVue\('quoirepublier'\)\) setAnnSort\('republier'\)/.test(code), 'Ma journée : une ligne seulement s’il y en a ; « Voir » ouvre Annonces → Republier');
  dit(/republier: jobRepublier \? \[tache\(jobRepublier, 97\)\] : \[\]/.test(code) && /j\.id !== 'quoi-republier'/.test(code), 'Ma journée : SA carte (cachable, « Modifier ma journée »), pas mêlée aux autres rappels');
  dit(/tr\('qr\.raison\.vuesPasLues'\)/.test(carte) && /tr\('qr\.raison\.favorisPasLus'\)/.test(carte) && /\['src\/design\/QuoiRepublier\.jsx', \['\*'\]\]/.test(fs.readFileSync(path.join(R, 'scripts', 'audit-traduction.cjs'), 'utf8')), 'la carte : « pas lues » dit ; aucun texte en dur (fichier migré, contrôlé par audit-traduction F1)');
  console.log(ko ? `\n❌ audit-quoi-republier : ${ko} rouge(s)` : '\n✅ audit-quoi-republier : tout vert');
  process.exit(ko ? 1 : 0);
})();
