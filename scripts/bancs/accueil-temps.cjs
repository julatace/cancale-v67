require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE TEMPS QUE VRM TE FAIT GAGNER » (11 nov., lot temps-gagne) — le
//  calculateur de la page d'accueil publique (src/accueil/TempsGagne.jsx, règle
//  src/accueil/tempsGagne.js). Juge ce qui est RENDU (data-*, nombres, octets) :
//   • 390 px (doigt) et 1512 px (souris), clair et sombre ;
//   • le morceau du calculateur n'est PAS téléchargé au premier écran, il arrive
//     à l'approche de sa section ;
//   • le total affiché = la règle (valeurs de départ) ; bouger un curseur
//     (clavier) change le total selon la règle ; le mois suit ;
//   • la note « Estimation … pas des résultats de clients » est visible ;
//   • aucun débordement horizontal, curseurs ≥ 44 px de haut, texte ≥ 12 px.
//  ⚠️ AUCUNE FIXTURE : une page publique ne lit aucune donnée.
//  BANC_PORT=… · CAPTURES=dossier (une capture de la section par taille et thème).
// ════════════════════════════════════════════════════════════════════════════
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');

const RACINE = path.join(__dirname, '..', '..');
const DIST = path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 4531;
const CAPT = process.env.CAPTURES || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String(e && e.message || e).slice(0, 200)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0].split('#')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end('nope'); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  r.end(fs.readFileSync(p));
});

async function principal() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent : npm run build d’abord'); process.exit(1); }
  const R = await import(pathToFileURL(path.join(RACINE, 'src', 'accueil', 'tempsGagne.js')).href);
  await new Promise((res) => srv.listen(PORT, res));
  const nav = await chromium.launch({ args: ['--use-angle=swiftshader', '--no-sandbox'] });
  for (const [nom, o] of [['390 clair', { w: 390, h: 844, m: true }], ['390 sombre', { w: 390, h: 844, m: true, s: true }], ['1512 clair', { w: 1512, h: 900 }], ['1512 sombre', { w: 1512, h: 900, s: true }]]) {
    console.log(`\n── ${nom}`);
    await essaie(nom, async () => {
      const ctx = await nav.newContext({ viewport: { width: o.w, height: o.h }, isMobile: !!o.m, hasTouch: !!o.m, deviceScaleFactor: o.m ? 2 : 1, colorScheme: o.s ? 'dark' : 'light', reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'fr-FR' });
      await ctx.route(/supabase\.co|\/api\//, (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await ctx.route(/^https?:\/\/(?!localhost)/, (rt) => rt.abort());
      const pg = await ctx.newPage();
      const scripts = []; const erreurs = [];
      pg.on('request', (rq) => { const u = rq.url(); if (/\.js(\?|$)/.test(u)) scripts.push(u.split('/').pop()); });
      pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
      await pg.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-accueil]', { timeout: 15000 });
      await pg.waitForTimeout(700);
      dit(!scripts.some((s) => /^TempsGagne-/.test(s)) && !(await pg.$('[data-temps-gagne]')), `${nom} : au premier écran, le calculateur n'est pas téléchargé`, scripts.filter((s) => /TempsGagne/.test(s)).join(','));
      await pg.evaluate(() => document.getElementById('temps').scrollIntoView({ block: 'start' }));
      await pg.waitForSelector('[data-temps-gagne] [data-total-minutes]', { timeout: 10000 });
      await pg.waitForTimeout(300);
      dit(scripts.some((s) => /^TempsGagne-/.test(s)), `${nom} : il arrive à l'approche de sa section (un morceau à part)`, scripts.join(','));
      const lu = async () => pg.evaluate(() => { const t = document.querySelector('[data-total-minutes]'); return { sem: Number(t.getAttribute('data-total-minutes')), mois: Number(t.getAttribute('data-mois-minutes')), texte: t.innerText, gestes: [...document.querySelectorAll('[data-geste]')].map((g) => [g.getAttribute('data-geste'), Number(g.getAttribute('data-secondes'))]) }; });
      const a = await lu();
      const att = R.tempsGagne(R.valeursDepart());
      dit(a.sem === R.arrondiSemaine(att.secondes) && a.mois === R.arrondiMois(att.secondes), `${nom} : le total affiché = la règle (${a.sem} min/sem · ${a.mois} min/mois)`, JSON.stringify(a));
      dit(a.gestes.length === R.GESTES.length && a.gestes.every(([id, s]) => att.gestes.find((g) => g.id === id).secondes === s), `${nom} : chaque geste affiché = la règle`, JSON.stringify(a.gestes));
      dit(new RegExp(`${a.sem}\\s*min|\\d+ h`).test(a.texte), `${nom} : le nombre est écrit en clair`, a.texte);
      // Bouger « ventes » de +10 au clavier.
      await pg.focus('[data-champ="ventes"]');
      for (let i = 0; i < 10; i++) await pg.keyboard.press('ArrowRight');
      await pg.waitForTimeout(150);
      const b = await lu();
      const att2 = R.tempsGagne({ ...R.valeursDepart(), ventes: R.valeursDepart().ventes + 10 });
      dit(b.sem === R.arrondiSemaine(att2.secondes) && b.sem > a.sem, `${nom} : +10 ventes ⇒ le total suit la règle (${a.sem} → ${b.sem} min)`, JSON.stringify(b));
      const vu = await pg.evaluate(() => {
        const n = document.querySelector('[data-estimation]'); const r = n && n.getBoundingClientRect();
        const champs = [...document.querySelectorAll('[data-champ]')].map((i) => i.getBoundingClientRect().height);
        const petits = [...document.querySelectorAll('[data-section="temps"] *')].filter((e) => e.childNodes.length && [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 12).map((e) => e.innerText.slice(0, 30));
        return { note: n ? n.innerText : '', noteH: r ? r.height : 0, champs, deborde: document.documentElement.scrollWidth - innerWidth, petits };
      });
      dit(/estimation/i.test(vu.note) && /pas des résultats de clients/i.test(vu.note) && vu.noteH > 0, `${nom} : la note « Estimation … pas des résultats de clients » est visible`, vu.note);
      dit(vu.champs.length === R.CHAMPS.length && vu.champs.every((h) => h >= 44), `${nom} : ${vu.champs.length} curseurs, chacun ≥ 44 px de haut`, vu.champs.join(','));
      dit(vu.deborde <= 0, `${nom} : aucun débordement horizontal`, `${vu.deborde} px`);
      dit(!vu.petits.length, `${nom} : aucun texte sous 12 px`, vu.petits.join(' | '));
      dit(!erreurs.length, `${nom} : aucune erreur de page`, erreurs.join(' | '));
      if (CAPT) { fs.mkdirSync(CAPT, { recursive: true }); await pg.evaluate(() => document.getElementById('temps').scrollIntoView({ block: 'start' })); await pg.waitForTimeout(200); const el = await pg.$('#temps'); await el.screenshot({ path: path.join(CAPT, `temps-${nom.replace(' ', '-')}.png`) }); }
      await ctx.close();
    });
  }
  await nav.close(); srv.close();
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
}
principal().catch((e) => { console.error(e); process.exit(1); });
