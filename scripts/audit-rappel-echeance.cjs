// Le rappel URSSAF avant l'échéance (29 octobre) : la vraie règle du serveur
// (api/_lib/rappel-urssaf.js) exécutée. Elle doit sonner à 3 jours ou moins,
// jamais avant, jamais pour une période notée « déclarée », jamais sur des
// réglages illisibles, et porter une clé par échéance (une seule fois).
// `--mutation=seuil|declare|passu` réaffaiblit la règle dans une copie.
const fs = require('fs'), path = require('path'), os = require('os');
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const LIB = path.join(__dirname, '..', 'api', '_lib');
let dir = LIB;
if (mut) {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'echeance-'));
  for (const f of ['rappel-urssaf.js', 'urssaf-regle.js']) fs.copyFileSync(path.join(LIB, f), path.join(dir, f));
  const f = path.join(dir, 'rappel-urssaf.js'); let s = fs.readFileSync(f, 'utf8');
  if (mut === 'seuil') s = s.replace('JOURS_AVANT_ECHEANCE = 3', 'JOURS_AVANT_ECHEANCE = 40');
  if (mut === 'declare') s = s.replace('if (!n.envoyer) return n;', 'if (!n.envoyer) return { ...n, envoyer: true, titre: TITRE_URSSAF, corps: "" };');
  if (mut === 'passu') s = s.replace("if (main === undefined || main === null) return { envoyer: false, raison: 'réglages illisibles — rien' };", "if (main === undefined || main === null) main = { vinted_regime: 'micro' };");
  fs.writeFileSync(f, s);
}
(async () => {
  const { rappelAvantEcheance } = await import(path.join(dir, 'rappel-urssaf.js'));
  let ko = 0; const ok = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) ko++; };
  const main = (extra) => ({ vinted_regime: 'micro', vinted_urssaf_freq: 'mensuel', ...extra });
  // Septembre se déclare jusqu'au 31 octobre.
  ok(!rappelAvantEcheance({ today: '2026-10-20', main: main() }).envoyer, '20 oct. (11 j avant) : rien');
  ok(!rappelAvantEcheance({ today: '2026-10-25', main: main() }).envoyer, '25 oct. (6 j avant, Ma journée le dit déjà) : pas de notification');
  const r28 = rappelAvantEcheance({ today: '2026-10-28', main: main() });
  ok(r28.envoyer && r28.cle === '2026-10-31' && /plus que 3 jours/.test(r28.titre), '28 oct. : rappel « plus que 3 jours », clé 2026-10-31');
  const r31 = rappelAvantEcheance({ today: '2026-10-31', main: main() });
  ok(r31.envoyer && /dernier jour/.test(r31.titre), "31 oct. : « dernier jour aujourd'hui »");
  ok(!rappelAvantEcheance({ today: '2026-10-29', main: main({ vrm_urssaf_declare: { '2026-09': { ids: [], n: 0, ca: 0, at: 1 } } }) }).envoyer, 'septembre noté « déclaré » : rien');
  ok(!rappelAvantEcheance({ today: '2026-10-29', main: undefined }).envoyer, 'réglages illisibles : rien');
  ok(!rappelAvantEcheance({ today: '2026-10-29', main: { vinted_regime: 'particulier' } }).envoyer, 'pas micro : rien');
  // Trimestriel : T3 jusqu'au 31 octobre.
  const t = rappelAvantEcheance({ today: '2026-10-30', main: main({ vinted_urssaf_freq: 'trimestriel' }) });
  ok(t.envoyer && t.cle === '2026-10-31' && /plus que demain/.test(t.titre), 'trimestriel, 30 oct. : « plus que demain »');
  ok(!rappelAvantEcheance({ today: '2026-10-30', main: main({ vinted_urssaf_freq: 'trimestriel', vrm_urssaf_declare: { '2026-07': { ids: [], at: 1 }, '2026-08': { ids: [], at: 1 }, '2026-09': { ids: [], at: 1 } } }) }).envoyer, 'T3 noté en entier : rien');
  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert'); process.exit(ko ? 1 : 0);
})();
