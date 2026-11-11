// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE JOURNAL DE LA SEMAINE (MA JOURNÉE) — LA SEMAINE PASSÉE, SES RÈGLES
//         node scripts/audit-journal-semaine.cjs [--mutation=semaine|colis|brut|ebay|repli]
// ═══════════════════════════════════════════════════════════════════════════
// Julien (4 nov.) : en tête de Ma journée, du lundi au dimanche, « Semaine du
// 27 oct. » — ventes, CA vendu, bénéfice, colis envoyés de la semaine passée
// (lundi → dimanche, heure de Paris), mêmes règles, AUCUNE notification.
// L'audit EXÉCUTE src/journalSemaine.js avec `semainePassee` (api/_lib/
// bilan-semaine.js, la borne du bilan hebdomadaire) et les vraies fonctions
// d'App.jsx (`bilanLignes`, `beneficeDesJours`), sur des ventes INVENTÉES.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
process.env.TZ = 'Europe/Paris';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const APP = lire('src/App.jsx');
let MODULE = lire('src/journalSemaine.js');
const muter = (avant, apres) => { if (!MODULE.includes(avant)) { console.log('❌ mutation impossible : ' + avant.slice(0, 80)); process.exit(2); } MODULE = MODULE.replace(avant, apres); };
if (MUT === 'semaine') muter('const S = R.semainePassee(maintenant);', 'const S = (() => { const fin = maintenant, debut = fin - 7 * 86400000; const x = R.semainePassee(maintenant); return { ...x, debut, fin }; })();');
else if (MUT === 'colis') muter('if (t != null && t >= debut && t < fin) n++;', 'if (t != null) n++;');
else if (MUT === 'brut') muter('const CB = R.chiffreBrut(B);', 'const CB = { valeur: B.ca, partiel: false };');
else if (MUT === 'ebay') muter("...(ebaySemaine ? ['eBay'] : []), ", '');
else if (MUT === 'repli') muter("export const repliePourSemaine = (memo, lundi) => !!memo && String(memo) === String(lundi);", 'export const repliePourSemaine = (memo) => !!memo;');
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
function extraire(src, nom) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}
const charger = async (texte, nom) => {
  const tmp = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte.replace(/from '\.\/([^']+)'/g, (m, f) => `from 'file://${path.join(R, 'api/_lib', f)}'`));
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};

(async () => {
  let M = null; try { M = await charger(MODULE, 'journal'); if (typeof M.journalSemaine !== 'function') M = null; } catch (_) { M = null; }
  dit(!!M, 'src/journalSemaine.js exporte `journalSemaine`');
  const B = await charger(lire('api/_lib/bilan-semaine.js'), 'bilan');
  const N = await import('file://' + path.join(R, 'src/beneficeNoms.js'));
  const NOMS = ['BENEF_CHAMPS', 'beneficeVide', 'ajouterVenteBenefice', 'jourBeneficeEnTableau', 'cumulerBenefice', 'resumeBenefice', 'jourClef', 'beneficeDesJours', 'bilanLignes'];
  const ctx = { Date, Math, Number, String, Object, Array, JSON, isFinite, parseFloat, isNaN, console }; vm.createContext(ctx);
  const absents = [];
  for (const n of NOMS) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n); } }
  dit(!absents.length, 'les règles se lisent dans App.jsx', absents.join(', '));
  if (M && !absents.length) {
    const RG = { semainePassee: B.semainePassee, bilanLignes: ctx.bilanLignes, beneficeDesJours: ctx.beneficeDesJours, chiffreBrut: N.chiffreBrut };
    // Mercredi 4 novembre 2026, 9 h (Paris) : la semaine passée = lundi 26 oct. → dimanche 1er nov.
    // (passage à l'heure d'hiver le dimanche 25 oct. : la semaine d'AVANT fait 169 h).
    const MAINT = new Date(2026, 10, 4, 9).getTime();
    const T = (m, j, h = 12, mi = 0) => new Date(2026, m, j, h, mi).getTime();
    const lignes = [
      { plateforme: 'Vinted', ts: T(9, 25, 23, 30), eur: 999 },     // dimanche d'avant : hors
      { plateforme: 'Vinted', ts: T(9, 26, 0, 5), eur: 60 },        // lundi 00:05 : dedans
      { plateforme: 'Leboncoin', ts: T(9, 29), eur: 40 },
      { plateforme: 'Vinted', ts: T(10, 1, 23, 59), eur: 35 },      // dimanche 23:59 : dedans
      { plateforme: 'Vinted', ts: T(10, 2, 0, 1), eur: 500 },       // lundi suivant : hors
    ];
    const jours = {};
    const vend = (t, eur, achat) => { const k = ctx.jourClef(new Date(t)); const acc = ctx.beneficeVide(); if (jours[k]) ctx.cumulerBenefice(acc, jours[k]); ctx.ajouterVenteBenefice(acc, eur, achat, 0); jours[k] = ctx.jourBeneficeEnTableau(acc); };
    vend(T(9, 26), 60, 20); vend(T(9, 29), 40, null); vend(T(10, 1), 35, 15); vend(T(10, 2), 500, 100);
    const ship = { a: T(9, 27), b: T(10, 1, 22), c: T(9, 25, 22), d: T(10, 3) }, lbc = { x: new Date(T(9, 30)).toISOString() }, vc = {};
    const J = M.journalSemaine({ maintenant: MAINT, vendu: { lignes, manque: [], nonComptees: [] }, joursBenef: { jours }, colisFaits: { vinted: ship, lbc, vc }, R: RG });
    dit(J.lundi === '2026-10-26' && J.dimanche === '2026-11-01' && J.titre === 'Semaine du 26 oct.', 'la semaine passée : lundi 26 oct. → dimanche 1er nov., titre « Semaine du 26 oct. »', `${J.lundi} ${J.dimanche} ${J.titre}`);
    dit(J.ventes.valeur === 3 && J.vendu.valeur === 135, 'ventes 3, CA vendu 135 € (lundi 00:05 et dimanche 23:59 dedans, les bords hors)', `${J.ventes.valeur} / ${J.vendu.valeur}`);
    dit(J.brut.valeur === 60 && J.brut.partiel && J.brut.couverture === '2 sur 3', 'bénéfice brut 60 € (40 + 20) sur 2 ventes au prix d’achat connu sur 3, dit', JSON.stringify(J.brut));
    dit(J.colis.valeur === 3 && !J.colis.partiel, 'colis envoyés : 3 gestes « Colis fait » dans la semaine (Vinted 2, Leboncoin 1)', JSON.stringify(J.colis));
    const L2 = [...lignes, { plateforme: 'eBay', ts: T(9, 28), eur: 80 }];
    const J2 = M.journalSemaine({ maintenant: MAINT, vendu: { lignes: L2, manque: [], nonComptees: [] }, joursBenef: { jours }, colisFaits: { vinted: ship, lbc, vc }, R: RG });
    dit(J2.colis.partiel && J2.colis.manque.includes('eBay'), 'une vente eBay dans la semaine : colis « au moins », eBay nommé (eBay ne garde aucune date d’envoi)');
    const J3 = M.journalSemaine({ maintenant: MAINT, vendu: { lignes, manque: ['vendeuse_a'], nonComptees: [] }, joursBenef: null, colisFaits: {}, R: RG });
    dit(J3.vendu.partiel && J3.vendu.manque.includes('vendeuse_a') && J3.brut.valeur == null && J3.colis.valeur == null, 'un compte pas lu ⇒ « au moins », nommé ; rien de publié ⇒ « — »');
    const J4 = M.journalSemaine({ maintenant: MAINT, vendu: null, joursBenef: { jours: {} }, colisFaits: { vinted: {}, lbc: {}, vc: {} }, R: RG });
    dit(J4.ventes.valeur == null && J4.vendu.valeur == null, 'ventes pas lues ⇒ « — », jamais 0');
    const Jdim = M.journalSemaine({ maintenant: new Date(2026, 10, 8, 22).getTime(), vendu: { lignes, manque: [], nonComptees: [] }, joursBenef: { jours }, colisFaits: { vinted: ship, lbc, vc }, R: RG });
    dit(Jdim.lundi === '2026-10-26', 'le dimanche suivant, c’est toujours la semaine du 26 oct. (elle reste jusqu’au dimanche)');
    const Jlun = M.journalSemaine({ maintenant: new Date(2026, 10, 9, 0, 30).getTime(), vendu: { lignes, manque: [], nonComptees: [] }, joursBenef: { jours }, colisFaits: { vinted: ship, lbc, vc }, R: RG });
    dit(Jlun.lundi === '2026-11-02', 'le lundi d’après : la semaine du 2 nov.');
    const Jhiver = M.journalSemaine({ maintenant: new Date(2026, 9, 27, 9).getTime(), vendu: { lignes, manque: [], nonComptees: [] }, joursBenef: { jours }, colisFaits: { vinted: ship, lbc, vc }, R: RG });
    dit(Jhiver.fin - Jhiver.debut === 169 * 3600000, 'la semaine du passage à l’heure d’hiver fait 169 h');
    dit(M.repliePourSemaine('2026-10-26', '2026-10-26') && !M.repliePourSemaine('2026-10-19', '2026-10-26'), 'replié pour CETTE semaine seulement : la suivante se montre ouverte');
  }
  const A0 = sansCommentaires(APP);
  // (11 nov.) Depuis Ma journée v2 (9 nov., 60febc6f) la semaine passée se touche dans la frise de la tête
  // (`FriseJournee`, « Semaine du … ») : même règle (`journalSemaine`), plus de carte à part.
  const frise = (A0.match(/function FriseJournee\([\s\S]*?\n\}\n/) || [''])[0];
  dit(/<FriseJournee liveStats=\{liveStats\}/.test(A0) && /journalSemaine\(\{ maintenant, vendu, joursBenef: pub, colisFaits, R: \{ \.\.\.REGLES_JOURNAL, semainePassee:/.test(frise), 'Ma journée monte la semaine passée en tête (la frise, par `journalSemaine`)');
  dit(/const REGLES_JOURNAL = \{ semainePassee, bilanLignes, beneficeDesJours, chiffreBrut \};/.test(A0) && /import \{semainePassee\} from '\.\.\/api\/_lib\/bilan-semaine\.js';/.test(A0), 'avec les règles propriétaires (la semaine du bilan, vendu, bénéfice brut)');
  const carte = extraire(A0, 'JournalSemaineCarte');
  dit(carte && !/push|notif|Notification|setTimeout/i.test(carte), 'aucune notification, aucun rappel');
  console.log(`\n${ko ? '❌' : '✅'} audit-journal-semaine : ${ok} vert(s), ${ko} rouge(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
