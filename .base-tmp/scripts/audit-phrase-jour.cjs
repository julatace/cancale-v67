// ════════════════════════════════════════════════════════════════════════════
//  LA PHRASE DU JOUR DE MA JOURNÉE (src/phraseJour.js) — EXÉCUTÉE (8 nov., « beauté »)
//        node scripts/audit-phrase-jour.cjs [--prouve]
//  · AUCUN compte n'est redit (§7 : les cartes de « À faire », juste dessous, les
//    écrivent déjà) — la phrase dit l'heure et ce qui reste, en mots ;
//  · l'heure dite est celle LUE (limite du plus pressé), en mots (« 18 h ») ;
//    une limite dépassée ne donne pas d'heure ;
//  · « pas su » ne vaut pas zéro : une case pas lue ne se dit pas ; aucune lue ⇒
//    `null` (la phrase fixe revient) ; « Aucun colis » seulement si les DEUX sont
//    lues et à zéro ; l'heure de la journée ne change que le ton ;
//  · App.jsx l'alimente par `T` (les cases de l'écran), jamais par un calcul neuf.
//  `--prouve` : chaque mutation ⇒ au moins un rouge.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const SRC = path.join(__dirname, '..', 'src', 'phraseJour.js');
const APP = path.join(__dirname, '..', 'src', 'App.jsx');

async function verifier(src, app, bavard = true) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phrase-jour-')); const f = path.join(tmp, 'p.mjs'); fs.writeFileSync(f, src);
  let P; try { P = await import(pathToFileURL(f).href + '?' + Math.random()); } catch (e) { dit(false, 'src/phraseJour.js se charge', e.message); return ko; }
  const ph = (env, ret, h = 10) => P.phraseDuJour({ envoyer: env, retirer: ret }, h);
  // §7 : les COMPTES sont écrits dans les cartes juste dessous ⇒ la phrase n'en écrit aucun
  // (le seul chiffre permis est l'heure LUE du plus pressé).
  const sansCompte = (t) => !/\d/.test(String(t || '').replace(/\d{1,2} h( \d{2})?/g, ''));
  const essais = [];
  const t1 = ph({ n: 3, presses: { n: 3, nAuj: 3, heure: '18:00' } }, { n: 2 }); essais.push(t1);
  dit(t1 === 'Premier colis à envoyer avant 18 h, puis les retraits', '« Premier colis à envoyer avant 18 h, puis les retraits »', t1);
  const t2 = ph({ n: 5, presses: { n: 2, nAuj: 1, heure: '10:30' } }, { n: 0 }); essais.push(t2);
  dit(t2 === 'Premier colis à envoyer avant 10 h 30', 'l’heure du plus pressé, en mots ; rien sur 0 à retirer', t2);
  const t3 = ph({ n: 2, presses: { n: 2, nAuj: 2, urgent: true, heure: '09:00' } }, { pasSu: true }); essais.push(t3);
  dit(t3 === 'Des colis à envoyer aujourd’hui', 'une limite dépassée ne donne pas d’heure ; « à retirer » pas lu ne se dit pas', t3);
  const t4 = ph({ n: 2, presses: { n: 1, nAuj: 0, heure: '09:00' } }, { n: 0 }); essais.push(t4);
  dit(t4 === 'Des colis à envoyer', 'une limite qui n’est pas aujourd’hui ne donne pas d’heure', t4);
  dit(ph({ pasSu: true }, { pasSu: true }) === null, 'rien de lu ⇒ rien (la phrase fixe de l’écran revient)');
  dit(ph({ n: 0, pasSu: true }, { n: 0 }) === null && ph({ n: 0 }, { n: 3, pasSu: true }) === null, 'une case « pas su » (comme l’écran la passe : n 0 + pasSu) ne compte ni comme zéro ni comme un nombre');
  dit(ph({ n: 0 }, { pasSu: true }) === null, 'une seule case lue à zéro ⇒ pas « aucun colis » (l’autre n’est pas lue)');
  dit(ph({ n: 0 }, { n: 0 }, 20) === 'Aucun colis ce soir.' && ph({ n: 0 }, { n: 0 }, 9) === 'Aucun colis ce matin.', 'les deux lues à zéro ⇒ « Aucun colis », le ton suit l’heure');
  const t5 = ph({ n: 0 }, { n: 4 }); essais.push(t5);
  dit(t5 === 'Des colis t’attendent au point relais', 'seulement des retraits : « Des colis t’attendent au point relais »', t5);
  dit(essais.every(sansCompte), 'aucun compte redit (§7 : le même nombre jamais deux fois sur un écran) — seule l’heure lue', essais.join(' | '));
  dit(P.heureEnMots('25:00') === '' && P.heureEnMots('') === '', 'une heure illisible n’est jamais écrite');
  // Le branchement : la phrase prend les cases `T` de l'écran.
  dit(/phraseDuJour\(\{ envoyer: \{ n: T\[0\]\.t \? T\[0\]\.t\.n : 0, pasSu: !!T\[0\]\.pasSu, presses: T\[0\]\.t && T\[0\]\.t\.presses \}, retirer: \{ n: T\[1\]\.t \? T\[1\]\.t\.n : 0, pasSu: !!T\[1\]\.pasSu \} \}/.test(app), 'App.jsx la nourrit des cases publiées de l’écran (T[0] « À envoyer », T[1] « À retirer »)');
  dit(/\{ id:'envoyer'[^\n]*\n[\s\S]{0,400}\{ id:'retirer'/.test(app.slice(app.indexOf('const T = ['), app.indexOf('const T = [') + 2500)), 'T[0] est « À envoyer » et T[1] « À retirer » (l’ordre que la phrase lit)');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  return ko;
}
(async () => {
  const src = fs.readFileSync(SRC, 'utf8'), app = fs.readFileSync(APP, 'utf8');
  const ko = await verifier(src, app);
  if (process.argv.includes('--prouve')) {
    const M = [
      ['le compte redit dans la phrase', (s) => s.replace("'Des colis à envoyer';", "`${nEnv} colis à envoyer`;")],
      ['pas su compté comme zéro', (s) => s.replace("(c && !c.pasSu && Number.isFinite", "(c && Number.isFinite")],
      ['« aucun » dès qu’une case est à zéro', (s) => s.replace('if (nEnv === 0 && nRet === 0)', 'if (nEnv === 0 || nRet === 0)')],
      ['heure donnée même en retard', (s) => s.replace('p && !p.urgent && aujourdhui ? heureEnMots', 'p && aujourdhui ? heureEnMots')],
      ['heure donnée pour un autre jour', (s) => s.replace('p && !p.urgent && aujourdhui ? heureEnMots', 'p && !p.urgent ? heureEnMots')],
    ];
    let rates = 0;
    for (const [nom, mut] of M) { const m = mut(src); if (m === src) { console.log('KO  mutation sans effet : ' + nom); rates++; continue; } const k = await verifier(m, app, false); console.log((k ? 'OK  mutation rouge : ' : 'KO  mutation VERTE : ') + nom); if (!k) rates++; }
    if (rates) process.exit(1);
  }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
