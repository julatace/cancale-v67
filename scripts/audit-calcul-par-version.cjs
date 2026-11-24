// ════════════════════════════════════════════════════════════════════════════
//  UN CALCUL DÉRIVÉ, UNE FOIS PAR VERSION DES DONNÉES (16 nov., lot vitesse-moteur)
//  node scripts/audit-calcul-par-version.cjs [--prouve]
//
//  src/calculParVersion.js garde une réponse tant que CHAQUE clé est la même (identité). Le risque :
//  une réponse d'une version d'avant servie pour des données neuves — un chiffre faux. Ce contrôle
//  EXÉCUTE le module et les deux calculs de Ma journée qui passent par lui, sur des données inventées :
//   · même clés ⇒ calcul pas refait, même réponse ; une clé neuve (même contenu ou non) ⇒ refait ;
//   · deux versions qui alternent (deux écrans) ne s'effacent pas ; `jusqua` passé ⇒ refait ;
//   · `rythmeVendu` gardé par jour : à toute heure d'un jour, la réponse gardée = celle calculée
//     à cette heure-là (la règle ne lit l'heure que par son minuit) ; un autre jour ⇒ autre clé ;
//   · le CA de l'année de Ma journée (`caAnnee`, ventes à dater) : gardé = calculé à chaque instant,
//     y compris quand l'heure rattrape une vente à dater datée dans le futur ;
//   · App.jsx passe par lui aux deux endroits.
//  --prouve : mutations (clés comparées par longueur seulement, `jusqua` ignoré, jour retiré de la
//  clé du rythme) ⇒ chacune rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const os = require('os');
const R = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m); };
const J = 86400000;

const importer = async (fichier, muter = (s) => s, remplacer = {}) => {
  let s = muter(fs.readFileSync(fichier, 'utf8'));
  for (const [de, vers] of Object.entries(remplacer)) s = s.split(de).join(vers);
  const f = path.join(os.tmpdir(), `cpv-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, s);
  try { return await import('file://' + f); } finally { fs.unlinkSync(f); }
};

(async () => {
  const prouve = process.argv.includes('--prouve');
  const app = require('./_source-app.cjs').sourceApp(R);   // (24 nov.) le moteur vit dans src/ecrans/Comptabilite.jsx : le texte de l'app RECOLLÉ
  const stats = await import('file://' + path.join(R, 'src', 'statsVentes.js'));
  const aDater = await import('file://' + path.join(R, 'src', 'aDaterAnnee.js'));
  // La clé du rythme et le calcul du CA de l'année, LUS dans App.jsx (la règle telle qu'écrite).
  const mRythme = app.match(/parVersion\('journee\.rythme', \[(vendus\.lignes, [^\]]*)\]/);
  dit(!!mRythme, 'App.jsx : le rythme de Ma journée passe par parVersion');
  const mCa = app.match(/const \{ adSurAn, caAnnee \} = parVersion\('journee\.caAnnee', \[declarables, anIci\], \(\) => \{([\s\S]*?)\n {8}\}, \{ jusqua: ([\s\S]*?) \}\);\n/);
  dit(!!mCa, 'App.jsx : le CA de l\'année de Ma journée passe par parVersion (avec `jusqua`)');
  if (!mRythme || !mCa) { console.log('\n❌ forme d\'App.jsx inattendue'); process.exit(1); }

  const mutations = [
    ['clés comparées par longueur seulement', (s) => s.replace('if (!Object.is(e.cles[k], cles[k])) { pareil = false; break; }', '')],
    ['jusqua ignoré', (s) => s.replace('if (e.jusqua != null && !(maintenant < e.jusqua)) { liste.splice(i, 1); break; }', '')],
    ['une seule version gardée', (s) => s.replace('const MAX_VERSIONS = 4;', 'const MAX_VERSIONS = 1;')],
    ['jour retiré de la clé du rythme', null],
  ];
  const essais = prouve ? mutations : [['code tel quel', null]];
  for (const [nom, muter] of essais) {
    const avant = ko;
    const M = await importer(path.join(R, 'src', 'calculParVersion.js'), muter || ((s) => s));
    const cleRythme = nom === 'jour retiré de la clé du rythme' ? 'vendus.lignes' : mRythme[1];
    // Le temps du contrôle : Date.now est piloté.
    const vraiNow = Date.now; let T = new Date(2026, 10, 16, 9, 0, 0).getTime(); Date.now = () => T;
    try {
      // 1) Bases.
      M.oublierCalculs();
      const a = { x: 1 }, b = { x: 1 };
      let n = 0; const f = (o) => () => { n++; return { v: o.x, o }; };
      const r1 = M.parVersion('t', [a, 1], f(a)), r2 = M.parVersion('t', [a, 1], f(a));
      dit(r1 === r2 && n === 1, `[${nom}] mêmes clés ⇒ calcul fait une fois, même réponse`);
      const r3 = M.parVersion('t', [b, 1], f(b));
      dit(n === 2 && r3.o === b, `[${nom}] une clé neuve au même contenu ⇒ recalculé (l'identité fait la version)`);
      M.parVersion('t', [a, 1], f(a)); M.parVersion('t', [b, 1], f(b));
      dit(n === 2, `[${nom}] deux versions qui alternent (deux écrans) ⇒ aucune recalculée`);
      const r4 = M.parVersion('t', [a, 2], f(a));
      dit(n === 3 && r4 !== r1, `[${nom}] une clé de plus qui change ⇒ recalculé`);
      let nj = 0; const lim = T + 1000;
      M.parVersion('j', [a], () => ++nj, { jusqua: () => lim }); M.parVersion('j', [a], () => ++nj, { jusqua: () => lim });
      T = lim; M.parVersion('j', [a], () => ++nj, { jusqua: () => lim });
      dit(nj === 2, `[${nom}] l'heure passe \`jusqua\` ⇒ recalculé`);
      T = new Date(2026, 10, 16, 9, 0, 0).getTime();

      // 2) Le rythme de Ma journée, gardé par jour : comparé au calcul fait à l'instant même.
      const lignes = []; let g = 11;
      const rnd = () => { g = (g * 1103515245 + 12345) % 2147483648; return g / 2147483648; };
      for (let i = 0; i < 4000; i++) lignes.push({ plateforme: 'Vinted', ts: T - Math.floor(rnd() * 120 * J) + Math.floor(rnd() * 2 * J), eur: Math.round(rnd() * 15000) / 100 });
      const vendus = { lignes };
      // eslint-disable-next-line no-new-func
      const cle = new Function('vendus', 'minuitLocal', `return [${cleRythme}];`);
      let pareilRythme = true;
      for (const h of [0, 1, 7.5, 12, 23.99, 24.01, 30, 47.9, 49]) {
        T = new Date(2026, 10, 16, 0, 0, 0).getTime() + h * 3600000;
        const garde = M.parVersion('journee.rythme', cle(vendus, stats.minuitLocal), () => stats.rythmeVendu(vendus.lignes));
        const frais = stats.rythmeVendu(vendus.lignes);
        if (JSON.stringify(garde) !== JSON.stringify(frais)) pareilRythme = false;
      }
      dit(pareilRythme, `[${nom}] rythme de Ma journée : la réponse gardée = celle calculée à l'instant, sur deux jours et demi`);

      // 3) Le CA de l'année (règle d'App.jsx exécutée telle qu'écrite).
      // eslint-disable-next-line no-new-func
      const caCalc = new Function('declarables', 'anIci', 'anneeSureDeVente', 'tsVenteADater', mCa[1]);
      // eslint-disable-next-line no-new-func
      const caJusqua = new Function('declarables', 'tsVenteADater', `return (${mCa[2]})();`);
      T = new Date(2026, 11, 31, 22, 0, 0).getTime();
      const declarables = { lignes: Array.from({ length: 300 }, (_, i) => ({ ym: i % 3 ? '2026-' + String(1 + (i % 12)).padStart(2, '0') : '2025-12', eur: 10 + i / 7 })),
        aDater: Array.from({ length: 200 }, (_, i) => ({ plateforme: 'Vinted', eur: 5 + i / 3, tsVente: T + (i % 10 === 0 ? (i / 10) * 600000 : -i * 3 * J) })) };
      let pareilCa = true;
      for (const m of [0, 5, 20, 59, 61, 90, 119, 121]) {
        T = new Date(2026, 11, 31, 22, 0, 0).getTime() + m * 60000;
        const anIci = String(new Date(T).getFullYear());
        const garde = M.parVersion('journee.caAnnee', [declarables, anIci], () => caCalc(declarables, anIci, aDater.anneeSureDeVente, aDater.tsVenteADater), { jusqua: () => caJusqua(declarables, aDater.tsVenteADater) });
        const frais = caCalc(declarables, anIci, aDater.anneeSureDeVente, aDater.tsVenteADater);
        if (garde.caAnnee !== frais.caAnnee || garde.adSurAn.length !== frais.adSurAn.length) pareilCa = false;
      }
      dit(pareilCa, `[${nom}] CA de l'année (ventes à dater datées dans le futur, passage de l'année) : gardé = calculé à l'instant`);
    } finally { Date.now = vraiNow; }
    if (prouve) { const rouge = ko > avant; ko = avant; dit(rouge, `mutation « ${nom} » ⇒ rouge`); }
  }
  console.log(ko ? `\n❌ ${ko} rouge(s)` : '\n✅ calculs par version : mêmes réponses');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
