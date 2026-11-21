// ════════════════════════════════════════════════════════════════════════════
//  audit-relais-prevision — QUAND un achat en route arrive, et le résumé d'Aujourd'hui (21 nov., ext. 5.411)
//  (node scripts/audit-relais-prevision.cjs [--mutation nom])
//  EXÉCUTE src/relaisPrevision.js (données inventées). Règles (docs/passation/2026-11-21-relais-prevision.md) :
//    · une date d'arrivée LUE (`estimee`, AAAA-MM-JJ) ⇒ « aujourd'hui », « demain », « le … », « passée » ;
//    · sinon le texte de Vinted (`periode`), dit tel quel ;
//    · sinon « pas encore dite » — JAMAIS une date devinée (ni la date de commande, ni « bientôt ») ;
//    · le résumé d'Aujourd'hui : « Demain : N colis chez X » sur des dates LUES seulement ; un point inconnu ne prévoit rien ;
//      rien à prévoir ⇒ null.
//  `--mutation` réaffaiblit une règle (copie modifiée du module) : l'audit doit passer au rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src', 'relaisPrevision.js');
const MUTATIONS = {
  // une date lue n'est plus prise : tout passe en « pas dite »
  dateLue: ['  if (a && jourValide(a.estimee)) {', '  if (false) {'],
  // le texte de Vinted n'est plus dit
  periode: ["  if (t) return { cle: 'vinted', texte: t };", '  if (false) return null;'],
  // une date DEVINÉE (la date de commande) quand rien n'est lu
  devine: ["  return { cle: 'pas-dite' };", "  if (a && a.date) return { cle: 'lue', jour: String(a.date).slice(0, 10), dans: 1 }; return { cle: 'pas-dite' };"],
  // un point inconnu prévoit aussi
  inconnu: ['    if (!p || p.inconnu) continue;', '    if (!p) continue;'],
};
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d) : '')); } };
(async () => {
  let fichier = SRC;
  const iM = process.argv.indexOf('--mutation');
  if (iM > 0) {
    const nom = process.argv[iM + 1]; const m = MUTATIONS[nom];
    if (!m) { console.log('mutation inconnue : ' + nom + ' (' + Object.keys(MUTATIONS).join(', ') + ')'); process.exit(2); }
    const s = fs.readFileSync(SRC, 'utf8'); const n = s.split(m[0]).length - 1;
    if (n !== 1) { console.log(`❌ mutation ${nom} : ancre trouvée ${n} fois`); process.exit(1); }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relais-prev-')); fichier = path.join(dir, 'relaisPrevision.mjs');
    fs.writeFileSync(fichier, s.replace(m[0], m[1])); console.log(`(mutation « ${nom} »)`);
  }
  const R = await import(pathToFileURL(fichier).href);
  // midi à Paris le 21 nov. 2026
  const maintenant = Date.parse('2026-11-21T11:00:00Z');
  console.log('\n── arriveePrevue');
  const a1 = R.arriveePrevue({ estimee: '2026-11-22' }, { maintenant });
  dit(a1.cle === 'lue' && a1.dans === 1 && a1.jour === '2026-11-22', 'date lue demain ⇒ « lue », dans 1 jour', a1);
  const a0 = R.arriveePrevue({ estimee: '2026-11-21' }, { maintenant });
  dit(a0.cle === 'lue' && a0.dans === 0, 'date lue aujourd’hui ⇒ dans 0 jour', a0);
  const ap = R.arriveePrevue({ estimee: '2026-11-19' }, { maintenant });
  dit(ap.cle === 'lue-passee', 'date lue passée ⇒ « lue-passee » (dite, jamais cachée)', ap);
  const av = R.arriveePrevue({ periode: '  entre le 24  et le 26 nov. ' }, { maintenant });
  dit(av.cle === 'vinted' && av.texte === 'entre le 24 et le 26 nov.', 'le texte de Vinted, tel quel (espaces resserrés)', av);
  const an = R.arriveePrevue({ date: '2026-11-19T10:00:00Z', titre: 'x' }, { maintenant });
  dit(an.cle === 'pas-dite', 'rien de lu ⇒ « pas encore dite » (la date de commande ne devient jamais une arrivée)', an);
  const am = R.arriveePrevue({ estimee: '22/11/2026' }, { maintenant });
  dit(am.cle === 'pas-dite', 'une date mal formée n’est pas une date lue', am);
  console.log('\n── prevoirRetraits (Aujourd’hui)');
  const pts = [
    { cle: 'a', nom: 'RELAIS A', attendus: [{ estimee: '2026-11-22' }, { estimee: '2026-11-22' }, { periode: 'bientôt selon Vinted' }] },
    { cle: 'b', nom: 'RELAIS B', attendus: [{ estimee: '2026-11-22' }] },
    { cle: 'z', nom: '', inconnu: true, attendus: [{ estimee: '2026-11-21' }] },
  ];
  const p = R.prevoirRetraits(pts, { maintenant });
  dit(!!p && p.quand === 'demain' && p.n === 3 && p.points[0].nom === 'RELAIS A' && p.points[0].n === 2, '« Demain : 3 colis », le point le plus chargé d’abord', p);
  dit(!!p && !p.points.some((x) => !x.nom), 'un point inconnu ne prévoit rien (ni « aujourd’hui »)', p);
  const p2 = R.prevoirRetraits([{ cle: 'a', nom: 'RELAIS A', attendus: [{}, { periode: 'x' }] }], { maintenant });
  dit(!!p2 && p2.quand === 'enroute' && p2.n === 2, 'sans date lue ⇒ « En route : 2 colis vers … » (jamais « demain »)', p2);
  dit(R.prevoirRetraits([], { maintenant }) === null && R.prevoirRetraits([{ cle: 'a', nom: 'A', attendus: [] }], { maintenant }) === null, 'rien à prévoir ⇒ null');
  console.log(`\n${ko ? '❌' : '✅'} audit-relais-prevision : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
