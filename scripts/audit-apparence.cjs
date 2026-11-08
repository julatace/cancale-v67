// ════════════════════════════════════════════════════════════════════════════
//  L'APPARENCE : CLAIR · SOMBRE · AUTOMATIQUE · LE SOIR (8 nov., « beauté »)
//        node scripts/audit-apparence.cjs [--prouve]
//
//  On EXÉCUTE les deux copies de la règle :
//   · src/apparence.js (React) ;
//   · public/demarrage-theme.js (le script de démarrage, AVANT le premier rendu)
//  sur toutes les entrées (24 heures × 5 valeurs de `vrm_apparence` × ancien
//  `vinted_dark` × préférence du système) : même verdict partout, sinon l'app
//  s'affiche d'une teinte puis bascule (le « flash »).
//  Et la règle elle-même : « Le soir » = 19 h–7 h ; « Automatique » = le système ;
//  absent ⇒ le choix d'avant (`vinted_dark`) ; un choix explicite écrit aussi
//  `vinted_dark` ; App.jsx branche la règle aux deux endroits (avant le cœur,
//  dans le cœur) et synchronise `vrm_apparence`.
//  `--prouve` : chaque mutation (copie du démarrage, règle, branchement) ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const racine = path.join(__dirname, '..');
const SRC = path.join(racine, 'src', 'apparence.js');
const DEM = path.join(racine, 'public', 'demarrage-theme.js');
const APP = path.join(racine, 'src', 'App.jsx');

async function verifier({ src, dem, app }, bavard = true) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apparence-'));
  const f = path.join(tmp, 'apparence.mjs'); fs.writeFileSync(f, src);
  let A;
  try { A = await import(pathToFileURL(f).href + '?t=' + Date.now() + Math.random()); }
  catch (e) { dit(false, 'src/apparence.js se charge', String(e.message).slice(0, 120)); return ko; }
  // Le script de démarrage, dans un faux navigateur.
  const lanceDemarrage = (stock, heure, systeme) => {
    const attrs = {}; let meta = null;
    const doc = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } }, querySelector: () => ({ setAttribute: (k, v) => { meta = v; } }) };
    const RealDate = Date;
    class FausseDate extends RealDate { constructor(...a) { if (a.length) super(...a); else { super(2026, 10, 8, heure, 30, 0); } } getHours() { return super.getHours(); } }
    const ctx = { window: {}, document: doc, localStorage: { getItem: (k) => (k in stock ? stock[k] : null) }, Date: FausseDate, JSON };
    ctx.window.matchMedia = (q) => ({ matches: /dark/.test(q) && systeme });
    ctx.window.localStorage = ctx.localStorage;
    try { vm.runInNewContext(dem, ctx, { timeout: 500 }); } catch (e) { return { erreur: e.message }; }
    return { theme: attrs['data-theme'], meta };
  };
  // 1. Les deux copies, sur toutes les entrées.
  const MODES = [undefined, 'clair', 'sombre', 'auto', 'soir', 'n_importe'];
  let ecarts = [], n = 0;
  for (const mode of MODES) for (const ancien of [undefined, false, true]) for (const sys of [false, true]) for (let h = 0; h < 24; h++) {
    const stock = {}; if (mode !== undefined) stock.vrm_apparence = JSON.stringify(mode); if (ancien !== undefined) stock.vinted_dark = JSON.stringify(ancien);
    const d = new Date(2026, 10, 8, h, 30, 0);
    const react = A.sombreEffectif(A.apparenceDe(mode === undefined ? null : mode, ancien === true), { date: d, systemeSombre: sys });
    const r = lanceDemarrage(stock, h, sys);
    n++;
    if (r.erreur || (r.theme === 'dark') !== react) ecarts.push(`${mode}/${ancien}/${sys ? 'sys-sombre' : 'sys-clair'}/${h}h : React ${react ? 'sombre' : 'clair'}, démarrage ${r.erreur || r.theme}`);
  }
  dit(ecarts.length === 0, `le script de démarrage et React donnent la MÊME teinte sur ${n} entrées (aucun flash)`, ecarts.slice(0, 3).join(' | '));
  const r0 = lanceDemarrage({ vrm_apparence: '"sombre"' }, 12, false);
  dit(r0.meta === '#000000', 'la barre d’état suit (theme-color = le fond sombre #000000)', String(r0.meta));
  // 2. La règle.
  const S = (mode, h, sys = false, ancien = false) => A.sombreEffectif(A.apparenceDe(mode, ancien), { date: new Date(2026, 10, 8, h, 0, 0), systemeSombre: sys });
  dit(S('soir', 19) && S('soir', 23) && S('soir', 0) && S('soir', 6), '« Le soir » : sombre de 19 h à 6 h 59');
  dit(!S('soir', 7) && !S('soir', 12) && !S('soir', 18), '« Le soir » : clair de 7 h à 18 h 59');
  dit(S('auto', 12, true) && !S('auto', 22, false), '« Automatique » : la préférence de l’appareil, jamais l’heure');
  dit(S(null, 12, false, true) && !S(null, 22, true, false), 'rien de choisi ⇒ le choix d’avant (`vinted_dark`), ni l’heure ni le système');
  dit(S('sombre', 12) && !S('clair', 22, true), 'Clair et Sombre : toujours, quoi qu’il arrive');
  const w1 = A.ecrituresApparence('sombre'), w2 = A.ecrituresApparence('soir');
  dit(w1 && w1.vinted_dark === true && w1.vrm_apparence === 'sombre' && w2 && !('vinted_dark' in w2), 'un choix explicite écrit aussi `vinted_dark` ; « Le soir » ne le touche pas');
  const p18 = A.prochainChangement('soir', new Date(2026, 10, 8, 18, 30, 0)), p23 = A.prochainChangement('soir', new Date(2026, 10, 8, 23, 0, 0));
  dit(p18 === 30 * 60000 && p23 === 8 * 3600000 && A.prochainChangement('auto', new Date()) === null, '« Le soir » se recale à 19 h et à 7 h pile', `${p18} / ${p23}`);
  // 3. Le branchement dans l'app.
  dit((app.match(/sombreEffectif\(/g) || []).length >= 2, 'App.jsx applique la règle AVANT le cœur et DANS le cœur (une source)');
  dit(/'vinted_dark','vinted_stock_vinted',[\s\S]{0,200}'vrm_apparence'/.test(app), '`vrm_apparence` voyage entre ses appareils (comme `vinted_dark`)');
  dit(/visibilitychange/.test(app.slice(app.indexOf('apparence !== \'soir\'') - 50, app.indexOf('apparence !== \'soir\'') + 1200)), '« Le soir » se recale quand le téléphone revient au premier plan');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  return ko;
}

(async () => {
  const base = { src: fs.readFileSync(SRC, 'utf8'), dem: fs.readFileSync(DEM, 'utf8'), app: fs.readFileSync(APP, 'utf8') };
  const ko = await verifier(base);
  if (process.argv.includes('--prouve')) {
    const M = [
      ['démarrage : le soir commence à 20 h', (b) => ({ ...b, dem: b.dem.replace('heure >= 19', 'heure >= 20') })],
      ['démarrage : ignore vrm_apparence', (b) => ({ ...b, dem: b.dem.replace("lire('vrm_apparence')", 'null') })],
      ['démarrage : automatique ignoré', (b) => ({ ...b, dem: b.dem.replace("if (mode === 'auto') return systeme === true;", '') })],
      ['règle : le soir finit à 8 h', (b) => ({ ...b, src: b.src.replace('SOIR_FIN = 7', 'SOIR_FIN = 8') })],
      ['règle : explicite n’écrit plus vinted_dark', (b) => ({ ...b, src: b.src.replace("if (mode === 'sombre') out.vinted_dark = true;", '') })],
      ['règle : absent ⇒ clair', (b) => ({ ...b, src: b.src.replace("return ancienSombre === true ? 'sombre' : 'clair';", "return 'clair';") })],
      ['app : plus synchronisé', (b) => ({ ...b, app: b.app.replace("  'vrm_apparence',\n", '\n') })],
    ];
    let rates = 0;
    for (const [nom, mut] of M) { const k = await verifier(mut(base), false); console.log((k ? 'OK  mutation rouge : ' : 'KO  mutation VERTE : ') + nom); if (!k) rates++; }
    if (rates) { console.log(`\n${rates} mutation(s) non vue(s)`); process.exit(1); }
  }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
