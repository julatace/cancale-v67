// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « BROUILLONS À REFAIRE » : CE QUI N'EST PLUS SUR VINTED SORT (19 nov. 2026)
//
//  Julien : « J'en ai 52, "brouillons à refaire" : il y en a qui ne sont même plus dans
//  Vinted, je ne comprends pas pourquoi ils sont encore là, c'est un bug horrible. »
//  On EXÉCUTE src/brouillonsARefaire.js (la règle que l'app appelle dans `useBrouillonsARefaire`) :
//   B1 en ligne (par l'id du brouillon, ou un autre brouillon de la même ancienne publié) ⇒ sort, « réglé » ;
//   B2 suppression PROUVÉE (`harvest_{uid}_supprimees`) ⇒ sort, comptée ;
//   B3 absent d'une lecture COMPLÈTE du dressing de SON compte, plus récente ⇒ sort ;
//   B4 lecture PARTIELLE, trop ancienne, d'un AUTRE compte, ou pas lue ⇒ reste, marqué « pas su » ;
//   B5 encore vu dans le dressing ⇒ reste (sans « pas su ») ;
//   B6 aucun brouillon créé (passage interrompu) ⇒ reste : la copie de VRM se refait ;
//   B7 l'identité est l'id du brouillon : deux lignes au même titre ne se confondent jamais ;
//   B8 l'app branche la règle (`trierARefaire` dans useBrouillonsARefaire) et dit les sortis / les « pas su ».
//  `--mutation=<nom>|toutes` : chaque règle affaiblie doit rougir. `--src=<dossier>` : un autre arbre.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();   // (22 nov., intégration finale) Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const SRC = (process.argv.find((a) => a.startsWith('--src=')) || '').slice(6) || path.join(__dirname, '..', 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const MUTATIONS = {
  supprime: ["if (S && typeof S === 'object' && S[draft] != null) return 'supprime';", ''],
  complet: ['L.complet === true && fini(L.lu)', 'fini(L.lu)'],
  recent: ['L.lu >= x.at + MARGE_REFAIRE_MS', 'true'],
  pasSuParti: ["  return 'passu';\n}", "  return 'plus-sur-vinted';\n}"],
  present: ["if (ctx.brouillonsVus instanceof Set && ctx.brouillonsVus.has(draft)) return 'present';", ''],
  pasLu: ['ctx.brouillonsVus instanceof Set && fini(x.at)', 'fini(x.at)'],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  let ok = 0;
  for (const nom of noms) {
    const m = MUTATIONS[nom]; const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-refaire-'));
    const src = fs.readFileSync(path.join(SRC, 'brouillonsARefaire.js'), 'utf8');
    if (!src.includes(m[0])) { console.log(`❌ mutation ${nom} : ancre introuvable`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, 'brouillonsARefaire.js'), src.replace(m[0], m[1]));
    fs.writeFileSync(path.join(t, 'package.json'), '{"type":"module"}');
    const r = spawnSync(process.execPath, [__filename, '--src=' + t, '--sans-app'], { encoding: 'utf8', timeout: 60000 });
    const rouge = r.status !== 0 && /^❌/m.test(r.stdout || ''); if (rouge) ok++;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'rouge' : 'VERTE (pas vue)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(ok === noms.length ? `\n✅ ${ok}/${noms.length} mutations attrapées` : `\n❌ ${noms.length - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === noms.length ? 0 : 1);
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (!c && d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 300) : '')); };
(async () => {
  const f = path.join(SRC, 'brouillonsARefaire.js');
  if (!fs.existsSync(f)) { dit(false, 'src/brouillonsARefaire.js existe (la règle)'); console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }
  let R; try { R = await import(pathToFileURL(f).href); } catch (e) { dit(false, 'la règle se charge', String(e.message)); process.exit(1); }
  const { jugerARefaire, trierARefaire, MARGE_REFAIRE_MS: M } = R;
  const T0 = Date.parse('2026-11-01T10:00:00Z'), H = 3600e3;
  const lectureComplete = { A: { lu: T0 + 48 * H, complet: true } };
  const vus = new Set(['900']);
  dit(jugerARefaire({ uid: 'A', draftId: '101', at: T0, ancienId: '1' }, { presentes: new Set(['101']) }) === 'en-ligne', 'B1 le brouillon est en ligne (son id) ⇒ réglé');
  dit(jugerARefaire({ uid: 'A', draftId: '102', at: T0, ancienId: '2' }, { publieParAncien: new Set(['2']) }) === 'en-ligne', 'B1 un autre brouillon de la même ancienne a été publié ⇒ réglé');
  dit(jugerARefaire({ uid: 'A', draftId: '103', at: T0 }, { supprimees: new Map([['A', { 103: '2026-11-02T00:00:00Z' }]]), brouillonsVus: null }) === 'supprime', 'B2 suppression prouvée sur Vinted ⇒ sort (même sans dressing relu)');
  dit(jugerARefaire({ uid: 'A', draftId: '104', at: T0 }, { lectures: lectureComplete, brouillonsVus: vus }) === 'plus-sur-vinted', 'B3 absent d’une lecture COMPLÈTE et plus récente de son compte ⇒ sort');
  dit(jugerARefaire({ uid: 'A', draftId: '105', at: T0 }, { lectures: { A: { lu: T0 + 48 * H, complet: false } }, brouillonsVus: vus }) === 'passu', 'B4 lecture partielle ⇒ reste, « pas su »');
  dit(jugerARefaire({ uid: 'A', draftId: '106', at: T0 }, { lectures: { A: { lu: T0 + M - 1, complet: true } }, brouillonsVus: vus }) === 'passu', 'B4 lecture complète mais PAS plus récente (marge) ⇒ reste, « pas su »');
  dit(jugerARefaire({ uid: 'B', draftId: '107', at: T0 }, { lectures: lectureComplete, brouillonsVus: vus }) === 'passu', 'B4 lecture complète d’un AUTRE compte ⇒ ne prouve rien');
  dit(jugerARefaire({ uid: 'A', draftId: '108', at: T0 }, { lectures: lectureComplete, brouillonsVus: null }) === 'passu', 'B4 brouillons pas lus (null) ⇒ « pas su », jamais « parti »');
  dit(jugerARefaire({ uid: 'A', draftId: '109', at: T0 }, {}) === 'passu', 'B4 rien lu du tout ⇒ « pas su »');
  dit(jugerARefaire({ uid: 'A', draftId: '900', at: T0 }, { lectures: lectureComplete, brouillonsVus: vus }) === 'present', 'B5 encore dans le dressing ⇒ reste');
  dit(jugerARefaire({ uid: 'A', draftId: '', at: T0 }, { lectures: lectureComplete, brouillonsVus: vus }) === 'sans-brouillon', 'B6 aucun brouillon créé ⇒ la copie de VRM se refait (reste)');
  const lignes = [
    { cle: 'c1', uid: 'A', id: '1', draftId: '104', titre: 'Nike Air Max 90 42', at: T0 },
    { cle: 'c2', uid: 'A', id: '2', draftId: '900', titre: 'Nike Air Max 90 42', at: T0 },
    { cle: 'c3', uid: 'C', id: '3', draftId: '105', titre: 'Nike Air Max 90 42', at: T0 },
    { cle: 'c4', uid: 'B', id: '4', draftId: '110', titre: 'Nike Air Max 90 42', at: T0 },
  ];
  const r = trierARefaire(lignes, { lectures: lectureComplete, brouillonsVus: vus, supprimees: new Map([['B', { 110: 'x' }]]) });
  dit(r.disparus.map((x) => x.cle).sort().join() === 'c1,c4' && r.restent.map((x) => x.cle).join() === 'c2,c3', 'B7 quatre lignes au même titre : chacune jugée par SON brouillon', { disparus: r.disparus.map((x) => x.cle), restent: r.restent.map((x) => x.cle) });
  dit(r.restent.find((x) => x.cle === 'c2').passu === false && r.restent.find((x) => x.cle === 'c3').passu === true, 'B7 « pas su » seulement pour celle qu’aucune lecture ne prouve');
  dit(r.disparus.find((x) => x.cle === 'c4').raison === 'supprime' && r.disparus.find((x) => x.cle === 'c1').raison === 'plus-sur-vinted', 'B2/B3 la raison de chaque sortie est gardée');
  if (!process.argv.includes('--sans-app')) {
    const app = fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8');
    const corps = (app.match(/function useBrouillonsARefaire\([\s\S]*?\n}\n/) || [''])[0];
    dit(/trierARefaire\(/.test(corps) && /lireSupprimeesTous\(/.test(corps), 'B8 l’app branche la règle et lit les suppressions prouvées');
    const rep = fs.readFileSync(path.join(SRC, 'ecrans', 'Republier.jsx'), 'utf8');
    dit(/refaireDisparus/.test(rep) && /refairePasSu/.test(rep), 'B8 la feuille dit combien sont sortis et combien sont « pas su »');
  }
  console.log(ko ? `\n❌ brouillons à refaire : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ brouillons à refaire : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
