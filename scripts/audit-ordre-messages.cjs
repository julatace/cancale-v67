// Audit : L'ORDRE DES CONVERSATIONS (11 nov., Julien : « tu ne fais pas du plus récent au plus vieux »).
// Juge la règle pure `src/ordreConversations.js` (appuyée sur `ordreRecent`) et que CHAQUE vue de
// Messages la prend : Vinted (liste + lecture des boîtes), Leboncoin, Vestiaire, eBay (questions et tout).
//   node scripts/audit-ordre-messages.cjs            — les contrôles
//   node scripts/audit-ordre-messages.cjs --prouve   — chaque règle réaffaiblie doit faire ROUGE
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

async function juger(src, code, dire) {
  // Le module (ESM) chargé depuis une copie, avec `ordreRecent` à côté.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ordre-msg-'));
  fs.writeFileSync(path.join(dir, 'ordreRecent.mjs'), lire('src/ordreRecent.js'));
  fs.writeFileSync(path.join(dir, 'ordreConversations.mjs'), src.replace("from './ordreRecent.js'", "from './ordreRecent.mjs'"));
  const M = await import(path.join(dir, 'ordreConversations.mjs'));
  fs.rmSync(dir, { recursive: true, force: true });
  let ko = 0; const dit = (c, m, d) => { if (!c) ko++; if (dire) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const q = (c) => c.t;
  const L = [{ id: 'annulee', t: '2026-10-14T17:28:00+02:00' }, { id: 'sans', t: '' }, { id: 'jour', t: '2026-11-11T19:52:00+01:00' }, { id: 'offre', t: '2026-11-11T18:16:00+01:00' }, { id: 'aussi-sans', t: null }];
  dit(M.trierRecents(L, q).map((x) => x.id).join() === 'jour,offre,annulee,sans,aussi-sans', 'le plus récent en haut ; sans date en bas, dans l’ordre reçu', M.trierRecents(L, q).map((x) => x.id).join());
  const G = [{ id: 'b1', t: '2026-11-11T20:00:00Z', g: 1 }, { id: 'a1', t: '2026-11-10T10:00:00Z', g: 0 }, { id: 'a2', t: '2026-11-11T09:00:00Z', g: 0 }, { id: 'b0', t: '', g: 1 }];
  dit(M.trierRecents(G, q, (c) => c.g).map((x) => x.id).join() === 'a2,a1,b1,b0', 'le groupe dit (compte de l’onglet) d’abord, la même règle dans chaque groupe', M.trierRecents(G, q, (c) => c.g).map((x) => x.id).join());
  dit(M.trierRecents([{ id: 's', t: '1762887120' }, { id: 'ms', t: 1762887180000 }], q).map((x) => x.id).join() === 'ms,s', 'secondes et millisecondes se comparent');
  dit(M.sansDate(L, q) === 2, 'les conversations sans date sont comptées (dites)', String(M.sansDate(L, q)));
  const D = [{ id: 7, t: '2026-11-01T10:00:00Z', v: 'vieille' }, { id: 8, t: '2026-11-02T10:00:00Z' }, { id: 7, t: '2026-11-11T10:00:00Z', v: 'fraiche' }];
  const d = M.sansDoublons(D, (c) => String(c.id), q);
  dit(d.length === 2 && d[0].v === 'fraiche', 'la même conversation deux fois : UNE ligne, la copie la plus fraîche', JSON.stringify(d));
  const auj = new Date(2026, 10, 11, 20, 0).getTime();
  const h = [M.heureListe(new Date(2026, 10, 11, 19, 52).getTime(), auj), M.heureListe(new Date(2026, 10, 10, 9, 0).getTime(), auj), M.heureListe(new Date(2026, 9, 14, 17, 28).getTime(), auj), M.heureListe('', auj), M.heureListe(new Date(2025, 9, 14).getTime(), auj)];
  dit(h[0] === '19:52' && h[1] === 'hier' && /^14 oct\.?$/.test(h[2]) && h[3] === '' && /2025/.test(h[4]), 'heure de liste : « 19:52 » · « hier » · « 14 oct. » · rien sans date · l’année d’avant dite', JSON.stringify(h));
  // Chaque vue prend la règle (code lu, commentaires retirés).
  const sansCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
  const app = sansCom(code.app);
  dit(/const tri=trierRecents\(/.test(app) && !/reponseAttendue\(b\)\)-Number\(!!reponseAttendue\(a\)\)/.test(app), 'Vinted : la liste est rangée par `trierRecents` (plus « à répondre » ni offre devant)');
  dit(/convsSansDoublons\(r\.items/.test(app), 'Vinted : chaque boîte lue passe par `sansDoublons`');
  dit(/data-conv-sans-date=\{nSansDate\}/.test(app), 'Vinted : « N sans date lue » est dit sous la liste');
  dit(/trierRecents\((sansDoublons\()?d\.fils/.test(sansCom(code.lbc)), 'Leboncoin : `trierRecents` sur les fils (doublons fondus avant, 12 nov.)');
  dit(/trierRecents\(liste, \(v\) => v\.date\)/.test(sansCom(code.vc)), 'Vestiaire : `trierRecents` (plus les non-lus devant)');
  dit(/const affiches=trierRecents\(/.test(sansCom(code.eb)), 'eBay · Tout : `trierRecents`');
  dit(/\(b\.tsDerniere \|\| 0\) - \(a\.tsDerniere \|\| 0\)/.test(code.qe) && !/if \(!!a\.nSans !== !!b\.nSans\)/.test(code.qe), 'eBay · Questions : la plus récente en haut (une attente ne passe plus devant)');
  return ko;
}

(async () => {
  const src = lire('src/ordreConversations.js');
  const code = { app: lire('src/App.jsx'), lbc: lire('src/ecrans/MessagesLeboncoin.jsx'), vc: lire('src/ecrans/Vestiaire.jsx'), eb: lire('src/ebayGestion.jsx'), qe: lire('src/questionsEbay.js') };
  if (!process.argv.includes('--prouve')) {
    const ko = await juger(src, code, true);
    console.log(ko ? `\n❌ ordre-messages : ${ko} rouge(s)` : '\n✅ ordre-messages : tout est vert');
    process.exit(ko ? 1 : 0);
  }
  const mutations = [
    ['groupe ignoré', src.replace('if (!groupe) return ordreRecent(L, quand);', 'return ordreRecent(L, quand);')],
    ['doublon : la première copie', src.replace('if (!avant || (t != null && (avant.t == null || t > avant.t)))', 'if (!avant)')],
    ['doublon gardé', src.replace('if (vus.has(k)) continue;', '')],
    ['heure : « hier HH:MM »', src.replace("return 'hier';", "return 'hier ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });")],
    ['sans date compté 0', src.replace('export const sansDate = (liste, quand) => nbSansDate(liste, quand);', 'export const sansDate = () => 0;')],
  ];
  const mutCode = [
    ['Vinted : offre devant', { ...code, app: code.app.replace('const tri=trierRecents(', 'const tri=(x=>x)(') }],
    ['Vestiaire : non-lus devant', { ...code, vc: code.vc.replace('trierRecents(liste, (v) => v.date)', 'liste') }],
    ['eBay : attente devant', { ...code, qe: code.qe.replace('(b.tsDerniere || 0) - (a.tsDerniere || 0)', '0') }],
  ];
  let rates = 0;
  for (const [nom, s] of mutations) { if (s === src) { console.log('??  mutation sans effet : ' + nom); rates++; continue; } const ko = await juger(s, code, false); console.log((ko ? 'OK  rouge : ' : 'KO  reste vert : ') + nom); if (!ko) rates++; }
  for (const [nom, c] of mutCode) { const ko = await juger(src, c, false); console.log((ko ? 'OK  rouge : ' : 'KO  reste vert : ') + nom); if (!ko) rates++; }
  console.log(rates ? `\n❌ ordre-messages --prouve : ${rates} mutation(s) pas vue(s)` : `\n✅ ordre-messages --prouve : ${mutations.length + mutCode.length}/${mutations.length + mutCode.length} mutations rouges`);
  process.exit(rates ? 1 : 0);
})();
