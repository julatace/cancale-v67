// ════════════════════════════════════════════════════════════════════════
//  BANC « L'EXTENSION A CAPTÉ » DANS L'APP (14 nov., extension 5.377)
//
//  Le VRAI composant `src/capteNotif/CapteNotif.jsx` (avec ses vraies règles, ses
//  vrais textes `tr()`, sa vraie feuille de style), assemblé par esbuild dans une page
//  qui imite la coque : une barre du bas (`--vrm-barre-bas`), une île d'actions en haut
//  à droite, une feuille qu'on ouvre. L'extension est imitée par des `vrm:ext`
//  (`{ type: 'capte', lot }`) — sa règle « nouveau par identité » est EXÉCUTÉE sur le vrai
//  background.js par scripts/audit-popup-capte.cjs. 390 tactile et 1512, clair et sombre.
//  Il juge : le toast dit « L'extension a capté · shop_x » et « 2 nouvelles ventes · 1
//  bordereau » ; une fois par lot (le même lot redit ⇒ rien ; le même lot qui grossit ⇒
//  seulement le reste) ; « Voir » mène à l'écran (`vrm:aller ?tab=ventes&site=vinted`) ;
//  croix 44 px ; il part seul après ~6 s ; il ne recouvre ni la barre du bas ni l'île ;
//  jamais par-dessus une feuille (il attend qu'elle se ferme) ; réglage coupé ⇒ rien.
//  `BANC_MUTANT=feuille|unefois` : la règle affaiblie ⇒ rouge. Captures : `SHOTS`.
// ════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 8761;
const MUTANT = process.env.BANC_MUTANT || '';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'captures', 'toast-capte');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d != null && d !== '' ? '  → ' + String(d).slice(0, 300) : '')); } };
const MUTATIONS = {
  // (les deux gardes de la feuille ensemble : l'une seule est rattrapée par l'autre)
  feuille: ['CapteNotif.jsx', '    if (!l || feuilleOuverte()) return;', '    if (!l) return;', '  if (!montre || feuille) return null;', '  if (!montre) return null;'],
  unefois: ['CapteNotif.jsx', '      const reste = resteADire(ev.lot, dit.current);', '      const reste = resteADire(ev.lot, {});'],
};

async function construire() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toast-capte-'));
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import CapteNotif from ${JSON.stringify(path.join(RACINE, 'src', 'capteNotif', 'CapteNotif.jsx'))};
import { brancherExtensionCapte } from ${JSON.stringify(path.join(RACINE, 'src', 'capteNotif', 'regle.js'))};
import { ajouterSourceApp } from ${JSON.stringify(path.join(RACINE, 'src', 'i18n', 'index.js'))};
import frApp from ${JSON.stringify(path.join(RACINE, 'src', 'i18n', 'langues', 'fr.js'))};
ajouterSourceApp(frApp);   // comme App.jsx
const subs = new Set();
window.__feuille = false;
window.__poserFeuille = (v) => { window.__feuille = v; subs.forEach((f) => f()); };
window.__coupe = null;
brancherExtensionCapte({ coupe: () => window.__coupe, regler: async (c) => { window.__coupe = c; return { ok: true }; } });
window.__allers = [];
window.addEventListener('vrm:aller', (e) => window.__allers.push(e.detail));
function Coque() {
  const [f, setF] = React.useState(false);
  React.useEffect(() => { const s = () => setF(window.__feuille); subs.add(s); return () => subs.delete(s); }, []);
  return <div>
    <div data-ile="" style={{ position: 'fixed', top: 12, right: 12, display: 'flex', gap: 8 }}><button style={{ height: 44, padding: '0 14px' }}>Chercher</button><button style={{ height: 44, padding: '0 14px' }}>Imprimer</button></div>
    <main style={{ padding: 20 }}><h1>Ma journée</h1>{Array.from({ length: 30 }, (_, i) => <p key={i}>Ligne {i}</p>)}</main>
    {window.innerWidth < 744 ? <nav data-barre="" className="barre" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 64, display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#eee', borderTop: '1px solid #ccc' }}>{['Journée', 'Ventes', 'Stock', 'Plus'].map((x) => <button key={x} style={{ height: 44 }}>{x}</button>)}</nav> : null}
    {f ? <div data-feuille="" style={{ position: 'fixed', inset: 'auto 0 0 0', height: '60vh', background: '#fff', borderRadius: '28px 28px 0 0', boxShadow: '0 -10px 40px rgba(0,0,0,.3)', zIndex: 20000 }}><button style={{ margin: 20, height: 44 }}>Annuler</button></div> : null}
    <CapteNotif feuilleOuverte={() => window.__feuille} abonnerFeuilles={(fn) => { subs.add(fn); return () => subs.delete(fn); }}/>
  </div>;
}
createRoot(document.getElementById('r')).render(<Coque/>);
`);
  const mutant = MUTANT && MUTATIONS[MUTANT];
  const plugins = mutant ? [{ name: 'mutant', setup(b) {
    b.onLoad({ filter: new RegExp(mutant[0].replace(/\./g, '\\.') + '$') }, (a) => {
      let t = fs.readFileSync(a.path, 'utf8');
      for (let i = 1; i < mutant.length; i += 2) { if (!t.includes(mutant[i])) throw Error('mutation introuvable : ' + MUTANT); t = t.replace(mutant[i], mutant[i + 1]); }
      return { contents: t, loader: 'jsx' };
    });
  } }] : [];
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outdir: path.join(dir, 'out'), format: 'esm', jsx: 'automatic', plugins,
    loader: { '.js': 'jsx' }, nodePaths: [NM], logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"MODE":"production","PROD":true,"DEV":false}' } });
  fs.writeFileSync(path.join(dir, 'out', 'index.html'), '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/entree.css"><style>@media (max-width:743px){:root{--vrm-barre-bas:64px}}body{margin:0;font-family:-apple-system,system-ui,sans-serif}:root[data-theme="dark"] body{background:#000;color:#eee}</style></head><body><div id="r"></div><script type="module" src="/entree.js"></script></body></html>');
  return path.join(dir, 'out');
}
const LOT = (id, n, extra) => Object.assign({ lot: id, p: 'vinted', compte: '111', nom: 'shop_sophie', relie: false, n, at: Date.now(), maj: Date.now() }, extra || {});
const envoyer = (pg, lot) => pg.evaluate((l) => window.dispatchEvent(new CustomEvent('vrm:ext', { detail: { type: 'capte', lot: l } })), lot);
const lire = (pg) => pg.evaluate(() => {
  const t = document.querySelector('[data-capte-toast]');
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const croise = (a, b) => !!(a && b && a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y);
  const rt = r(t);
  return { vis: !!t, texte: t ? t.innerText.replace(/\s+/g, ' ').trim() : '', rt, ventes: t && t.getAttribute('data-capte-ventes'), bord: t && t.getAttribute('data-capte-bordereaux'),
    x: r(t && t.querySelector('[data-capte-fermer]')), voir: r(t && t.querySelector('[data-capte-voir]')),
    surBarre: croise(rt, r(document.querySelector('[data-barre]'))), surIle: croise(rt, r(document.querySelector('[data-ile]'))), surFeuille: croise(rt, r(document.querySelector('[data-feuille]'))),
    allers: window.__allers.slice(), debord: document.documentElement.scrollWidth > window.innerWidth, fond: t ? getComputedStyle(t).backgroundImage + getComputedStyle(t).backgroundColor : '' };
});

(async () => {
  const out = await construire();
  const srv = http.createServer((q, r) => { const f = path.join(out, q.url === '/' ? 'index.html' : q.url.split('?')[0]); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(fs.readFileSync(f)); });
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const [W, H, mobile] of [[1512, 900, false], [390, 844, true]]) for (const scheme of ['light', 'dark']) {
      const T = `${W} ${scheme}`; console.log('\n' + T);
      const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: W, height: H } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
      const pg = await ctx.newPage(); const err = []; pg.on('pageerror', (e) => err.push(String(e)));
      await pg.goto(`http://127.0.0.1:${PORT}/`);
      await pg.evaluate((s) => document.documentElement.setAttribute('data-theme', s === 'dark' ? 'dark' : 'light'), scheme);
      await pg.waitForSelector('main');
      await envoyer(pg, LOT('a1', { ventes: 2, bordereaux: 1 }));
      await pg.waitForTimeout(900);
      let a = await lire(pg);
      await pg.screenshot({ path: path.join(SHOTS, `toast-${W}-${scheme}.png`) });
      dit(a.vis && /L’extension a capté · shop_sophie/.test(a.texte) && /2 nouvelles ventes · 1 bordereau/.test(a.texte) && a.ventes === '2' && a.bord === '1', `${T} : « L’extension a capté · shop_sophie » · « 2 nouvelles ventes · 1 bordereau »`, a.texte);
      dit(a.x && a.x.w >= 44 && a.x.h >= 44 && a.voir && a.voir.h >= 44, `${T} : croix et « Voir » de 44 px`, JSON.stringify({ x: a.x, v: a.voir }));
      dit(!a.surBarre && !a.surIle && !a.debord && a.rt && a.rt.x >= 0 && a.rt.r <= W && a.rt.b <= H, `${T} : ne recouvre ni la barre du bas ni l’île, dans l’écran`, JSON.stringify(a.rt));
      await pg.click('[data-capte-voir]');
      await pg.mouse.move(5, 5);
      a = await lire(pg);
      dit(!a.vis && a.allers[0] === '?tab=ventes&site=vinted', `${T} : « Voir » mène à Ventes (vinted) et ferme`, JSON.stringify(a.allers));
      // Le même lot redit ⇒ rien ; le même lot qui grossit ⇒ seulement le reste.
      await envoyer(pg, LOT('a1', { ventes: 2, bordereaux: 1 }));
      await pg.waitForTimeout(900);
      a = await lire(pg);
      dit(!a.vis, `${T} : le même lot redit ⇒ aucun toast (une fois par lot)`, a.texte);
      await envoyer(pg, LOT('a1', { ventes: 2, bordereaux: 1, messages: 3 }));
      await pg.waitForTimeout(900);
      a = await lire(pg);
      dit(a.vis && /3 messages/.test(a.texte) && !/ventes/.test(a.texte), `${T} : le même lot qui grossit ⇒ seulement le reste (« 3 messages »)`, a.texte);
      await pg.waitForTimeout(6400);
      a = await lire(pg);
      dit(!a.vis, `${T} : il part seul après ~6 s`, a.texte);
      // Feuille ouverte : il attend ; fermée : il passe.
      await pg.evaluate(() => window.__poserFeuille(true));
      await envoyer(pg, LOT('a2', { achats: 1 }, { relie: false }));
      await pg.waitForTimeout(900);
      a = await lire(pg);
      await pg.screenshot({ path: path.join(SHOTS, `feuille-${W}-${scheme}.png`) });
      dit(!a.vis, `${T} : feuille ouverte ⇒ rien par-dessus`, a.texte);
      await pg.evaluate(() => window.__poserFeuille(false));
      await pg.waitForTimeout(800);
      a = await lire(pg);
      dit(a.vis && /1 nouvel achat/.test(a.texte), `${T} : feuille fermée ⇒ « 1 nouvel achat » arrive`, a.texte);
      await pg.click('[data-capte-fermer]'); await pg.mouse.move(5, 5);
      // Compte relié ; réglage coupé.
      await envoyer(pg, LOT('a3', { annonces: 14, ventes: 3 }, { relie: true, nom: 'julien_kicks', compte: '222' }));
      await pg.waitForTimeout(900);
      a = await lire(pg);
      await pg.screenshot({ path: path.join(SHOTS, `relie-${W}-${scheme}.png`) });
      dit(a.vis && /Compte relié · julien_kicks/.test(a.texte) && /3 ventes lues · 14 annonces lues/.test(a.texte), `${T} : « Compte relié · julien_kicks » · « 3 ventes lues · 14 annonces lues »`, a.texte);
      await pg.click('[data-capte-fermer]');
      await pg.evaluate(() => { window.__coupe = true; });
      await envoyer(pg, LOT('a4', { ventes: 1 }));
      await pg.waitForTimeout(900);
      a = await lire(pg);
      dit(!a.vis && err.length === 0, `${T} : réglage coupé ⇒ rien ; aucune erreur de page`, JSON.stringify({ t: a.texte, err }));
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ toast-capte : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ toast-capte : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
