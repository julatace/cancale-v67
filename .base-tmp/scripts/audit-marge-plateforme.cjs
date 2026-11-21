#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LOT I (10 nov.) — MARGE PAR PLATEFORME (Argent → Statistiques)
//         node scripts/audit-marge-plateforme.cjs [--mutation=…] [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// EXÉCUTE src/margePlateforme.js sur des données INVENTÉES (dépôt public) et lit
// dans le code de l'écran que :
//   M. une ligne par site (Vinted, Leboncoin, eBay, Vestiaire), toujours les
//      quatre ; vendu = les lignes de `ventesFaites` du site sur la période ;
//      une vente à l'argent pas lu compte en vente, hors du montant, et fait dire
//      « au moins » au VENDU seulement ; un site pas lu ⇒ « — » et la raison ;
//   B. bénéfice par vente = vente − achat − frais (le relevé de Ventes) ; médiane
//      et total sur les seules ventes au prix d'achat CONNU ; la couverture dite
//      (« prix d'achat manquant pour N ») ; frais pas sus ≠ 0 ; JAMAIS « au
//      moins » sur un bénéfice ; relevé pas publié ⇒ « — », « ouvre Ventes » ;
//      l'accent seulement sur une meilleure médiane CONCLUE (≥ SEUIL ventes,
//      deux sites) ;
//   E. Statistiques monte la carte à côté de « D'où viennent mes achats » et
//      « Vitesse d'envoi », lui passe le relevé de la PÉRIODE ; la carte ne relit
//      aucun prix d'achat (aucun second calcul) ; jamais de rouge.
// `--mutation=…` réaffaiblit une règle dans une copie de src/ et api/ : rouge exigé.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUTS = {
  'mediane-sur-tout': ["if (b.c == null) { if (b.pourquoi === 'achat')", "if (b.c == null) { connus.push(cts(l.eur) || 0); if (b.pourquoi === 'achat')"],
  'achat-zero': ["if (a == null) return { c: null, pourquoi: 'achat' };", "if (a == null) return { c: v - (cts(l.frais) ?? 0), pourquoi: '' };"],
  'frais-zero': ["if (l.frais === null) return { c: null, pourquoi: 'frais' };", ''],
  'au-moins-benefice': ["mediane: eurosMarge(p.mediane), total: eurosMarge(p.total)", "mediane: (p.nSansAchat ? 'au moins ' : '') + eurosMarge(p.mediane), total: eurosMarge(p.total)"],
  'manque-tu': ['if (p.nSansAchat) sur +=', 'if (false) sur +='],
  'passu-zero': ["if (AUTRES.has(plat) && man.includes(plat)) { P.etat = 'passu';", "if (false) { P.etat = 'passu';"],
  'non-comptees-tues': ["P.venduPartiel = nc > 0 ||", 'P.venduPartiel ='],
  'hors-periode': ["if (!l || l.plateforme !== plat || !dans(l.ts)) continue;\n      const e", "if (!l || l.plateforme !== plat) continue;\n      const e"],
  'accent-sans-seuil': ['p.nConnu >= SEUIL_CONCLUSION', 'p.nConnu >= 1'],
  'releve-absent-zero': ["benef: releve == null ? 'releve' : 'lu'", "benef: 'lu'"],
  'ecran-absent': ['<MargePlateforme liveStats', '<div data-retire liveStats', 'ecrans/Stats.jsx'],
  'ecran-second-calcul': ["import './styles-marge-plateforme.css';", "import './styles-marge-plateforme.css';\nimport { beneficePaire } from './beneficePaire.js';", 'MargePlateforme.jsx'],
  'ecran-rouge': ['background: var(--vrm-accent, #0066CC); opacity: 1; }', 'background: #D70015; opacity: 1; }', 'styles-marge-plateforme.css'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'marge-plateforme-'));
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true });
  fs.cpSync(path.join(R, 'api'), path.join(d, 'api'), { recursive: true });
  const f = path.join(d, 'src', MUTS[MUT][2] || 'margePlateforme.js'); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MUTS[MUT][0])) { console.log('motif introuvable : ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(MUTS[MUT][0], MUTS[MUT][1]));
  SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };
const lire = (f) => { try { return fs.readFileSync(path.join(SRC, f), 'utf8'); } catch (_) { return ''; } };
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const url = (f) => require('url').pathToFileURL(path.join(SRC, f)).href;

(async () => {
  let M;
  try { M = await import(url('margePlateforme.js')); }
  catch (e) { dit(false, 'src/margePlateforme.js existe et se charge', e.message); console.log(`\n${ok} verts, ${ko} rouges`); process.exit(1); }
  const J = 864e5, de = Date.parse('2026-11-01T00:00:00'), a = de + 30 * J, t = (j) => de + j * J + 3600e3;
  const P = (r, k) => r.plateformes.find((p) => p.plat === k);

  console.log('\n── M. Une ligne par site ; vendu = la règle de « Vendu »');
  const vendu = [
    { plateforme: 'Vinted', ts: t(1), eur: 100 }, { plateforme: 'Vinted', ts: t(2), eur: 50 }, { plateforme: 'Vinted', ts: t(-3), eur: 999 },
    { plateforme: 'eBay', ts: t(4), eur: 80 }, { plateforme: 'Leboncoin', ts: t(5), eur: 60 },
  ];
  const r0 = M.margeParPlateforme({ vendu, manque: [], nonComptees: [], releve: [], de, a });
  dit(r0.plateformes.map((p) => p.plat).join(',') === 'Vinted,Leboncoin,eBay,Vestiaire', 'M1 toujours les quatre sites, dans l’ordre');
  dit(P(r0, 'Vinted').n === 2 && P(r0, 'Vinted').vendu === 15000 && !P(r0, 'Vinted').venduPartiel, 'M2 Vinted : 2 ventes, 150 € (la vente hors période n’entre pas)', JSON.stringify(P(r0, 'Vinted')));
  dit(P(r0, 'Vestiaire').etat === 'lu' && P(r0, 'Vestiaire').n === 0 && P(r0, 'Vestiaire').vendu === 0, 'M3 Vestiaire lu sans vente : 0 vente, pas « — »');
  const r1 = M.margeParPlateforme({ vendu, manque: ['Vestiaire'], nonComptees: [{ plateforme: 'eBay', raison: 'frais eBay inconnus', ts: t(6) }, { plateforme: 'eBay', raison: 'x', ts: t(-9) }], releve: [], de, a });
  const v = P(r1, 'Vestiaire'), e = P(r1, 'eBay');
  dit(v.etat === 'passu' && /pas lues/.test(v.raison) && M.texteMarge(v).vendu === '—' && M.texteMarge(v).mediane === '—', 'M4 Vestiaire pas lu : « — » partout et la raison', JSON.stringify(v));
  dit(e.n === 2 && e.vendu === 8000 && e.venduPartiel && e.nNonComptees === 1 && /^au moins /.test(M.texteMarge(e).vendu) && M.texteMarge(e).manques.some((x) => /1 au montant pas lu/.test(x)), 'M5 eBay : la commande aux frais pas lus compte en vente, « au moins » sur le vendu, nommée', JSON.stringify(e));
  const r2 = M.margeParPlateforme({ vendu, manque: ['shop_b'], nonComptees: [], releve: [], de, a });
  dit(P(r2, 'Vinted').venduPartiel && /shop_b/.test(P(r2, 'Vinted').raison) && P(r2, 'Leboncoin').etat === 'lu', 'M6 un compte Vinted pas lu : Vinted « au moins », le compte nommé ; les autres sites intacts');
  const ru = M.margeParPlateforme({ vendu: undefined, releve: null, de, a }), rn = M.margeParPlateforme({ vendu: null, releve: null, de, a });
  dit(ru.plateformes.every((p) => p.etat === 'encours') && rn.plateformes.every((p) => p.etat === 'passu' && M.texteMarge(p).vendu === '—'), 'M7 trois états : lecture en cours · pas lu (« — ») · lu');

  console.log('\n── B. Bénéfice : vente − achat − frais, sur les ventes au prix CONNU');
  const releve = [
    { plateforme: 'Vinted', ts: t(1), eur: 100, achat: 60, frais: 5 },      // 35
    { plateforme: 'Vinted', ts: t(2), eur: 50, achat: null, frais: 0 },     // prix d'achat manquant
    { plateforme: 'Vinted', ts: t(3), eur: 70, achat: 40, frais: 0 },       // 30
    { plateforme: 'Vinted', ts: t(4), eur: 90, achat: 20, frais: 10 },      // 60
    { plateforme: 'Vinted', ts: t(-2), eur: 500, achat: 1, frais: 0 },      // hors période
    { plateforme: 'Leboncoin', ts: t(5), eur: 60, achat: 70, frais: 0 },    // −10 (perte réelle)
    { plateforme: 'eBay', ts: t(4), eur: 80, achat: 30, frais: null },      // frais pas sus
    { plateforme: 'Vestiaire', ts: t(6), eur: null, achat: 10, frais: 0 },  // prix pas lu
  ];
  const r3 = M.margeParPlateforme({ vendu, manque: [], nonComptees: [], releve, de, a });
  const vi = P(r3, 'Vinted');
  dit(vi.nFin === 4 && vi.nConnu === 3 && vi.nSansAchat === 1 && vi.mediane === 3500 && vi.total === 12500, 'B1 Vinted : médiane 35 €, total 125 € sur 3 ventes au prix connu (la 4e nommée, la hors-période absente)', JSON.stringify(vi));
  const tv = M.texteMarge(vi);
  dit(/sur 3 ventes finalisées/.test(tv.sur) && /prix d’achat manquant pour 1/.test(tv.sur), 'B2 la couverture dite : « sur 3 · prix d’achat manquant pour 1 »', tv.sur);
  dit(!/au moins/.test(tv.mediane + tv.total) && !/au moins|au plus/.test(tv.sur), 'B3 jamais « au moins » sur un bénéfice', tv.mediane + ' / ' + tv.total);
  dit(P(r3, 'Leboncoin').mediane === -1000 && /^−10/.test(M.texteMarge(P(r3, 'Leboncoin')).mediane), 'B4 une perte réelle reste négative (−10 €)', M.texteMarge(P(r3, 'Leboncoin')).mediane);
  dit(P(r3, 'eBay').mediane === null && P(r3, 'eBay').nSansFrais === 1 && M.texteMarge(P(r3, 'eBay')).mediane === '—', 'B5 frais pas sus ≠ 0 : bénéfice « — », « frais pas lus pour 1 »');
  dit(P(r3, 'Vestiaire').mediane === null && P(r3, 'Vestiaire').nSansPrix === 1, 'B6 prix de vente pas lu : pas de bénéfice, nommé');
  dit(M.mediane([1, 2, 3, 4]) === 3 && M.mediane([5, 1, 3]) === 3 && M.mediane([]) === null, 'B7 médiane : paire = moyenne des deux du milieu ; vide ⇒ null');
  const r4 = M.margeParPlateforme({ vendu, manque: [], nonComptees: [], releve: null, de, a });
  const t4 = M.texteMarge(P(r4, 'Vinted'));
  dit(P(r4, 'Vinted').mediane === null && t4.mediane === '—' && /ouvre Ventes/.test(t4.sur) && t4.vendu !== '—', 'B8 relevé pas publié : bénéfice « — » (« ouvre Ventes »), le vendu reste lu', JSON.stringify(t4));
  dit(r3.meilleur === null, 'B9 trop peu de ventes : aucune « meilleure » plateforme à l’accent');
  const gros = [];
  for (let i = 0; i < 5; i++) { gros.push({ plateforme: 'Vinted', ts: t(i), eur: 100, achat: 70, frais: 0 }); gros.push({ plateforme: 'eBay', ts: t(i), eur: 100, achat: 50, frais: 0 }); }
  const r5 = M.margeParPlateforme({ vendu, manque: [], nonComptees: [], releve: gros, de, a });
  dit(r5.meilleur === 'eBay', 'B10 deux sites à 5 ventes connues : la meilleure médiane (eBay) à l’accent', String(r5.meilleur));
  // 50 ventes identiques sans prix d'achat : aucune médiane inventée.
  const cinquante = Array.from({ length: 50 }, (_, i) => ({ plateforme: 'Vinted', ts: t(1), eur: 100, achat: null, frais: 0, titre: 'Nike Dunk Low Panda 42', id: String(i) }));
  const r6 = M.margeParPlateforme({ vendu, releve: cinquante, de, a });
  dit(P(r6, 'Vinted').mediane === null && P(r6, 'Vinted').nSansAchat === 50, 'B11 50 paires identiques sans prix d’achat : « — », rien deviné du titre');

  console.log('\n── E. L’écran');
  const stats = sansCommentaires(lire('ecrans/Stats.jsx')), carte = sansCommentaires(lire('MargePlateforme.jsx')), css = lire('styles-marge-plateforme.css');
  const iS = stats.indexOf('<SourcesAchats'), iV = stats.indexOf('<VitesseEnvoi'), iM = stats.indexOf('<MargePlateforme liveStats');
  dit(iM > 0 && iS > 0 && iV > 0 && iM > iV && iM - iV < 400, 'E1 Statistiques monte la carte juste après « D’où viennent mes achats » et « Vitesse d’envoi »');
  dit(/<MargePlateforme liveStats=\{liveStats\} releve=\{lp\} de=\{b\.de\} a=\{b\.a\}/.test(stats), 'E2 la carte reçoit le relevé de la PÉRIODE (lp) et ses bornes');
  dit(/margeParPlateforme/.test(carte) && !/beneficePaire|achatDe|chargesVente|coutsVente|lireReleveVentes/.test(carte), 'E3 la carte ne relit aucun prix d’achat ni frais : elle range (aucun second calcul)');
  dit(!/#(D70015|FF3B30|FF453A|E30000)|\bred\b/i.test(css), 'E4 aucun rouge');
  dit(/min-height:\s*44px/.test(css) && !/inline-flex/.test(css), 'E5 la porte de saisie fait 44 px ; aucun display:inline-flex sur un bouton');

  console.log(`\n${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
