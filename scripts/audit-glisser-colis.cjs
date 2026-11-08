// ════════════════════════════════════════════════════════════════════════════
//  « COLIS FAIT » AU GLISSER (src/GlisserColis.js) — EXÉCUTÉ (8 nov., « beauté »)
//        node scripts/audit-glisser-colis.cjs [--prouve]
//  On joue de faux gestes sur une fausse carte (événements pointeur) :
//   · glisser franc à droite au-delà du seuil ⇒ `onFait` UNE fois, la carte revient ;
//   · glisser court ⇒ rien, retour élastique ;
//   · défilement vertical, diagonale surtout verticale, glisser à GAUCHE ⇒ rien,
//     la carte ne bouge jamais ;
//   · souris ⇒ rien ; le clic qui suit un glisser est avalé ;
//   · au-delà du seuil la carte résiste (élastique), jamais plus loin que le doigt ;
//   · App.jsx : la carte « à envoyer » Vinted le porte, sur le geste existant
//     `gesteColisFait(o, b, true)` (pilule « Annuler »), jamais sur une carte déjà partie.
//  `--prouve` : chaque mutation ⇒ au moins un rouge.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const SRC = path.join(__dirname, '..', 'src', 'GlisserColis.js'), APP = path.join(__dirname, '..', 'src', 'App.jsx');

function fausseCarte(largeur = 360) {
  const attrs = {}, style = { setProperty: (k, v) => { style[k] = v; } };
  return { offsetWidth: largeur, style, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; }, hasAttribute: (k) => k in attrs, setPointerCapture() {}, attrs };
}
function jouer(G, { dx, dy, pas = 10, type = 'touch', largeur = 360 }) {
  let faits = 0; const el = fausseCarte(largeur); let maxTr = 0;
  const p = G.propsGlisserFait({ actif: true, onFait: () => { faits++; } });
  const ev = (x, y) => ({ pointerType: type, isPrimary: true, pointerId: 1, clientX: x, clientY: y, currentTarget: el, target: { closest: () => null } });
  p.onPointerDown(ev(20, 300));
  for (let i = 1; i <= pas; i++) { p.onPointerMove(ev(20 + (dx * i) / pas, 300 + (dy * i) / pas)); const t = parseFloat(el.style.translate || '0') || 0; maxTr = Math.max(maxTr, Math.abs(t)); }
  p.onPointerUp(ev(20 + dx, 300 + dy));
  let avale = false; p.onClickCapture({ currentTarget: el, preventDefault: () => { avale = true; }, stopPropagation() {} });
  return { faits, fin: el.style.translate || '', maxTr, avale };
}

async function verifier(src, app, bavard = true) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (bavard) console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'glisser-')); const f = path.join(tmp, 'g.mjs');
  fs.writeFileSync(f, src);
  global.window = { matchMedia: () => ({ matches: false }) }; global.navigator = { vibrate: () => true };
  let G; try { G = await import(pathToFileURL(f).href + '?' + Math.random()); } catch (e) { dit(false, 'le module se charge', e.message); return ko; }
  const a = jouer(G, { dx: 220, dy: 6 });
  dit(a.faits === 1 && !a.fin && a.avale, 'glisser franc à droite (220 px sur 360) : « Déposé » une fois, la carte revient, le clic qui suit est avalé', JSON.stringify(a));
  const b = jouer(G, { dx: 60, dy: 0 });
  dit(b.faits === 0 && !b.fin && b.maxTr > 0, 'glisser court (60 px) : la carte a suivi, puis revient — rien écrit', JSON.stringify(b));
  const c = jouer(G, { dx: 4, dy: -260 });
  dit(c.faits === 0 && c.maxTr === 0, 'défilement vertical : la carte ne bouge pas, rien écrit', JSON.stringify(c));
  const d = jouer(G, { dx: 160, dy: -240 });
  dit(d.faits === 0 && d.maxTr === 0, 'diagonale surtout verticale : rien', JSON.stringify(d));
  const e = jouer(G, { dx: -240, dy: 0 });
  dit(e.faits === 0 && e.maxTr === 0, 'vers la GAUCHE : rien (le geste est vers la droite)', JSON.stringify(e));
  const s = jouer(G, { dx: 240, dy: 0, type: 'mouse' });
  dit(s.faits === 0 && s.maxTr === 0, 'à la souris : rien ne glisse', JSON.stringify(s));
  const w = 360, seuil = G.seuilGlisse(w);
  dit(G.positionGlisse(seuil / 2, w) === seuil / 2 && G.positionGlisse(seuil + 200, w) < seuil + 200 && G.positionGlisse(seuil + 200, w) > seuil && G.positionGlisse(-50, w) === 0, '1:1 jusqu’au seuil, élastique au-delà, jamais vers la gauche');
  dit(G.seuilGlisse(200) === 96 && G.seuilGlisse(400) === 140, 'le seuil : 35 % de la largeur, 96 px au moins');
  dit(/\{\.\.\.propsGlisserFait\(\{ actif: !posted && !!o && o\.transaction_id != null, onFait: \(\) => gesteColisFait\(o, b, true\) \}\)\}/.test(app), 'App.jsx : la carte « à envoyer » le porte, sur le geste existant (gesteColisFait, pilule « Annuler »), jamais une carte déjà partie');
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  return ko;
}
(async () => {
  const src = fs.readFileSync(SRC, 'utf8'), app = fs.readFileSync(APP, 'utf8');
  const ko = await verifier(src, app);
  if (process.argv.includes('--prouve')) {
    const M = [
      ['un défilement vertical compte comme un glisser', (s) => s.replace("return dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.4 ? 'h' : 'v';", "return 'h';")],
      ['une diagonale verticale passe pour horizontale', (s) => s.replace('Math.abs(dx) > Math.abs(dy) * 1.4', 'Math.abs(dx) > Math.abs(dy) * 0.5')],
      ['plus de seuil', (s) => s.replace('const pret = dx >= seuilGlisse(s.w);', 'const pret = dx > 0;')],
      ['la souris glisse aussi', (s) => s.replace("if (e.pointerType === 'mouse' || !e.isPrimary) return;", 'if (!e.isPrimary) return;')],
      ['pas de retour en place', (s) => s.replace('      poser(el, 0, true);\n      if (s.pret && onFait)', '      if (s.pret && onFait)')],
      ['plus d’élastique', (s) => s.replace('if (dx <= seuil) return dx;', 'return dx;')],
    ];
    let rates = 0;
    for (const [nom, mut] of M) { const m = mut(src); if (m === src) { console.log('KO  mutation sans effet : ' + nom); rates++; continue; } const k = await verifier(m, app, false); console.log((k ? 'OK  mutation rouge : ' : 'KO  mutation VERTE : ') + nom); if (!k) rates++; }
    if (rates) process.exit(1);
  }
  console.log(ko ? `\n${ko} échec(s)` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
