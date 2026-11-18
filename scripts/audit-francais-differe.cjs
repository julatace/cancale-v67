// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE FRANÇAIS DES ÉCRANS À LA DEMANDE ARRIVE AVEC EUX, JAMAIS APRÈS
//         node scripts/audit-francais-differe.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (17 nov., lot vitesse-poids — docs/passation/2026-11-17-vitesse-poids.md)
// Au build, vite.config.js (`francaisDiffere`) coupe le dictionnaire français en deux :
// la part du démarrage (dans le morceau App) et fr-reste (importé en premier par chaque
// module à la demande qui peut en lire une clé). Une clé mal rangée s'afficherait BRUTE
// (« stats.titre ») : cet audit EXÉCUTE la vraie analyse (scripts/_francais-differe.cjs)
// sur le vrai dépôt, plus des clés témoins posées en mémoire :
//   1. le graphe se lit (démarrage ≥ 800 modules, ≥ 40 entrées à la demande) ;
//   2. chaque clé est rangée une fois (démarrage + reste = fr.js, rien perdu) ;
//   3. une clé lue au démarrage par un PRÉFIXE (`'zzpre.' + x`), un SUFFIXE
//      (`x + '.zzsuffixe'`), un littéral, un fichier de api/, ou par un module que
//      main.jsx ouvre avant l'app, reste au démarrage ;
//   4. une clé lue seulement par un écran à la demande (Stats) part dans le reste, et
//      cet écran importe le reste ; Stats, Compta, eBay, Réglages et Republier aussi ;
//   5. le poids : la part du démarrage ≤ 75 Ko compressés (mesuré : 67) et le reste ≥ 60 Ko
//      — un écran entier réimporté en statique dans App la ferait déborder ;
//   6. le branchement : vite.config.js pose le greffon, App.jsx importe bien
//      `./i18n/langues/fr.js` (sinon le greffon ne remplacerait rien, en silence),
//      fr-reste.js est vide dans le dépôt et appelle `ajouterSourceDifferee`.
// `--prouve` : chaque mutation (en mémoire) réaffaiblit la règle ; l'audit doit rougir.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), Module = require('module');
const R = path.join(__dirname, '..');
const SRC_ANALYSE = fs.readFileSync(path.join(__dirname, '_francais-differe.cjs'), 'utf8');
const P = (r) => path.join(R, r);
const lireR = (r) => fs.readFileSync(P(r), 'utf8');
const gz = (o) => zlib.gzipSync(JSON.stringify(o), { level: 9 }).length;

function charger(src) {
  const m = new Module(path.join(__dirname, '_francais-differe.cjs'), module);
  m.filename = path.join(__dirname, '_francais-differe.cjs');
  m.paths = Module._nodeModulePaths(__dirname);
  m._compile(src, m.filename);
  return m.exports;
}

// Les témoins : des clés et des lectures posées en mémoire, jamais dans le dépôt.
const TEMOINS = {
  'zzpre.a': 'x', 'zz.b.zzsuffixe': 'x', 'zzlit.c': 'x', 'zzapi.d': 'x', 'zzmain.e': 'x', 'zzlazy.f': 'x', 'zzmort.g': 'x',
};
function textesTemoins() {
  const ajout = (r, l) => [P(r), lireR(r) + '\n' + l + '\n'];
  return Object.fromEntries([
    ajout('src/App.jsx', "const __zz1 = (x) => [tr('zzpre.' + x), tr(x + '.zzsuffixe'), tr('zzlit.c')];"),
    ajout('src/tarifs/Tarifs.jsx', "export const __zz2 = (tr) => tr('zzmain.e');"),
    ajout('src/ecrans/Stats.jsx', "export const __zz3 = (tr) => tr('zzlazy.f');"),
  ]);
}

async function juger(src, dire, opts = {}) {
  const F = charger(src);
  const fr = { ...(await F.dictionnaire(R)), ...TEMOINS };
  const textes = { ...textesTemoins(), ...(opts.textes || {}) };
  // le témoin « serveur » : une clé qu'un fichier de api/ nomme (fichier en mémoire seulement)
  textes[P('api/_lib/__zz-temoin-audit.js')] = "export const T = 'zzapi.d';\n";
  const a = F.analyser(R, fr, textes);
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (dire) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
  const B = a.base, Re = a.reste;
  dit(a.demarrage.size >= 800 && a.entrees.size >= 40, `le graphe se lit (${a.demarrage.size} modules au démarrage, ${a.entrees.size} entrées à la demande)`);
  const nB = Object.keys(B).length, nR = Object.keys(Re).length, nF = Object.keys(fr).length;
  const deux = Object.keys(B).filter((k) => k in Re);
  dit(nB + nR === nF && !deux.length, `chaque clé est rangée une fois (${nB} au démarrage + ${nR} dans le reste = ${nF})`, deux.slice(0, 3).join(', '));
  for (const [k, comment] of [['zzpre.a', 'par un préfixe'], ['zz.b.zzsuffixe', 'par un suffixe'], ['zzlit.c', 'par un littéral'], ['zzapi.d', 'par un fichier de api/'], ['zzmain.e', 'par un module que main.jsx ouvre avant l’app']]) {
    dit(k in B, `une clé lue au démarrage ${comment} reste au démarrage`, k in B ? '' : `${k} est parti dans le reste`);
  }
  dit('zzlazy.f' in Re, 'une clé lue seulement par un écran à la demande part dans le reste');
  dit('zzmort.g' in Re, 'une clé que personne ne lit part dans le reste');
  const inj = (r) => a.injecter.has(P(r));
  const ecrans = ['src/ecrans/Stats.jsx', 'src/ecrans/Compta.jsx', 'src/ecrans/Ebay.jsx', 'src/ecrans/Reglages.jsx', 'src/ecrans/Republier.jsx'];
  const sans = ecrans.filter((r) => !inj(r));
  dit(!sans.length, `chaque écran à la demande qui lit le reste l’importe (${ecrans.map((r) => path.basename(r, '.jsx')).join(', ')})`, sans.join(', '));
  const gB = gz(B), gR = gz(Re);
  dit(gB <= 75 * 1024, `la part du démarrage pèse au plus 75 Ko compressés`, Math.round(gB / 1024) + ' Ko');
  dit(gR >= 60 * 1024, `le reste (chargé avec les écrans) pèse au moins 60 Ko compressés`, Math.round(gR / 1024) + ' Ko');
  const vite = opts.vite != null ? opts.vite : lireR('vite.config.js');
  const app = opts.app != null ? opts.app : lireR('src/App.jsx');
  const reste = opts.reste != null ? opts.reste : lireR('src/i18n/langues/fr-reste.js');
  dit(/plugins:\s*\[\s*francaisDiffere\(\)/.test(vite) && /resolveId[\s\S]*?r\.id === FR \? BASE/.test(vite), 'vite.config.js pose le greffon (en premier) et remplace fr.js importé par App.jsx');
  dit(/\nimport\s+\w+\s+from\s+["']\.\/i18n\/langues\/fr\.js["'];\s*\n\s*ajouterSourceApp\(/.test(app), 'App.jsx importe ./i18n/langues/fr.js (la cible du greffon) et le pose');
  dit(/ajouterSourceDifferee\(\{\}\)/.test(reste) && !/["'][A-Za-z0-9_]+\.[A-Za-z0-9_.]+["']\s*:/.test(reste), 'fr-reste.js est vide dans le dépôt et appelle ajouterSourceDifferee');
  return ko;
}

(async () => {
  if (process.argv.includes('--prouve')) {
    const remplacer = (avant, apres) => { if (!SRC_ANALYSE.includes(avant)) throw new Error('mutation introuvable : ' + avant.slice(0, 60)); return SRC_ANALYSE.replace(avant, apres); };
    const MUTS = [
      ['les préfixes oubliés', () => remplacer("if (/[._-]$/.test(v)) o.prefixes.add(v); if (/^[._-]/.test(v)) o.suffixes.add(v); return; }", "if (/^[._-]/.test(v)) o.suffixes.add(v); return; }"), {}],
      ['les suffixes oubliés', () => remplacer("if (/[._-]$/.test(v)) o.prefixes.add(v); if (/^[._-]/.test(v)) o.suffixes.add(v); return; }", "if (/[._-]$/.test(v)) o.prefixes.add(v); return; }"), {}],
      ['les fichiers de api/ oubliés', () => remplacer("for (const f of ailleurs) {", "for (const f of []) {"), {}],
      ['les modules ouverts par main.jsx oubliés', () => remplacer("if (d !== APP) for (const g of fermer([d])) demarrage.add(g);", ';'), {}],
      ['aucun écran n’importe le reste', () => remplacer('if (clesReste.some((k) => lue(k, ex, PP, SS))) injecter.add(e);', ''), {}],
      ['tout le français au démarrage', () => remplacer("(lue(k, exacts, P, S) ? base : reste)[k] = v;", '(k.startsWith("zz") && !lue(k, exacts, P, S) ? reste : base)[k] = v;'), {}],
      ['Stats réimporté en statique dans App', () => SRC_ANALYSE, { textes: { [P('src/App.jsx')]: "import './ecrans/Stats.jsx';\nimport './ecrans/Compta.jsx';\nimport './ecrans/Ebay.jsx';\n" + textesTemoins()[P('src/App.jsx')] } }],
      ['App.jsx importe un autre fichier que fr.js', () => SRC_ANALYSE, { app: lireR('src/App.jsx').replace('import frApp from "./i18n/langues/fr.js";', 'import frApp from "./i18n/langues/fr-complet.js";') }],
    ];
    let rouges = 0;
    for (const [nom, src, opts] of MUTS) {
      const ko = await juger(src(), false, opts);
      console.log((ko ? '  ✅ ' : '  ❌ ') + `mutation « ${nom} » ⇒ ${ko ? 'rouge (' + ko + ')' : 'VERT (le contrôle ne la voit pas)'}`);
      if (ko) rouges++;
    }
    const ok = rouges === MUTS.length;
    console.log(ok ? `\n✅ audit-francais-differe --prouve : ${rouges}/${MUTS.length} mutations rouges` : `\n❌ audit-francais-differe --prouve : ${MUTS.length - rouges} mutation(s) restée(s) verte(s)`);
    process.exit(ok ? 0 : 1);
  }
  const ko = await juger(SRC_ANALYSE, true);
  console.log(ko ? `\n❌ audit-francais-differe : ${ko} rouge(s)` : '\n✅ audit-francais-differe : le français des écrans à la demande arrive avec eux');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
