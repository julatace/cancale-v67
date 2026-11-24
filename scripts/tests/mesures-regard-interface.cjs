// (24 nov., vitesse) LE REGARD DES MESURES NE COÛTE PLUS RIEN — src/mesuresCollecte.js (`ecranUtile`, `suivrePremierEcran`).
// Récit : docs/passation/2026-11-24-vitesse.md. EXÉCUTE le vrai module dans Chromium (esbuild).
//   node scripts/tests/mesures-regard-interface.cjs                 ⇒ le code d'aujourd'hui (vert)
//   MODULE=<chemin d'un autre mesuresCollecte.js> node …            ⇒ un autre code (celui d'avant : rouge)
// Juge :
//   1. MÊME RÈGLE : « l'écran a du contenu » rend la même réponse que `innerText` (non vide) sur 12 écrans types (caché
//      `display:none`, `visibility:hidden`, `hidden`, `display:contents`, blancs seuls, squelette, attente, texte au fond…) ;
//   2. AUCUN `innerText` lu (il sérialisait l'écran entier toutes les 50 ms) ;
//   3. RIEN pendant le rendu : `mesuresEcran` (appelé par l'app pendant son rendu) ne regarde pas la page tout de suite —
//      le premier regard vient après l'image (et voit donc le NOUVEL écran).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const { build } = require(path.join(root, 'node_modules', 'esbuild'));
const { chromium } = require(path.join(root, 'node_modules', 'playwright'));
const VRAI = path.join(root, 'src/mesuresCollecte.js');
const MODULE = path.resolve(process.env.MODULE || VRAI);
(async () => {
  let mod = './src/mesuresCollecte.js', copie = null;
  if (MODULE !== VRAI) { copie = path.join(root, 'src/.mesuresCollecte-essai.js'); fs.copyFileSync(MODULE, copie); mod = './src/.mesuresCollecte-essai.js'; }
  let bundle;
  try {
    bundle = await build({ stdin: { resolveDir: root, loader: 'js', contents: `import * as M from '${mod}'; window.M = M;` }, bundle: true, write: false, format: 'iife', logLevel: 'silent' });
  } finally { if (copie) fs.rmSync(copie, { force: true }); }
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox'] });
  let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; console.log('  ✅ ' + m); };
  try {
    const p = await nav.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message));
    // Une vraie origine (le stockage de l'appareil y existe ; `about:blank` le refuse) — servie par le contrôle, rien ne sort.
    await p.route('http://banc.local/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><main class="vrm-main" id="m"></main>' }));
    await p.goto('http://banc.local/');
    await p.addScriptTag({ content: bundle.outputFiles[0].text });
    const ECRANS = [
      ['vide', ''],
      ['blancs seuls', '<div>   </div><p>\n\t</p>'],
      ['texte simple', '<p>Ventes</p>'],
      ['caché display:none', '<section style="display:none"><p>Achats gardé</p></section>'],
      ['caché hidden', '<section hidden><p>Annonces gardée</p></section>'],
      ['caché visibility', '<section style="visibility:hidden"><p>Invisible</p></section>'],
      ['visible sous un caché', '<section style="visibility:hidden"><p style="visibility:visible">Revenu</p></section>'],
      ['display:contents', '<div style="display:contents"><span>Dedans</span></div>'],
      ['texte au fond après des caches', '<section style="display:none"><p>A</p></section>' + '<div><div><div></div></div></div>'.repeat(50) + '<div><span><b>Fond</b></span></div>'],
      ['opacité 0 (compte, comme innerText)', '<p style="opacity:0">Fondu</p>'],
      ['svg seul', '<svg width="10" height="10"><rect width="10" height="10"/></svg>'],
      ['texte de bouton', '<button>Imprimer</button>'],
    ];
    // 1. même règle qu'innerText (lu ici par le contrôle, pas par le module)
    const ecarts = await p.evaluate((E) => { const m = document.getElementById('m'); const out = []; for (const [nom, h] of E) { m.innerHTML = h; const attendu = (m.innerText || '').trim().length > 0; const vu = window.M.ecranUtile(document); if (vu !== attendu) out.push(nom + ' : ' + vu + ' au lieu de ' + attendu); } return out; }, ECRANS);
    ok(!ecarts.length, `1. « du contenu » rend la même réponse qu'innerText sur ${ECRANS.length} écrans types ${ecarts.join(' | ')}`);
    ok(await p.evaluate(() => { const m = document.getElementById('m'); m.innerHTML = '<p>x</p><div class="vrm-skeleton"></div>'; return window.M.ecranUtile(document) === false; }), '1. un squelette ⇒ pas encore utile (inchangé)');
    // 2. aucun innerText lu
    const lus = await p.evaluate(() => { const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText'); let n = 0;
      Object.defineProperty(HTMLElement.prototype, 'innerText', { configurable: true, get() { n++; return d.get.call(this); }, set(v) { d.set.call(this, v); } });
      const m = document.getElementById('m'); m.innerHTML = '<section style="display:none">' + '<p>caché</p>'.repeat(2000) + '</section><p>Ventes</p>';
      window.M.ecranUtile(document); Object.defineProperty(HTMLElement.prototype, 'innerText', d); return n; });
    ok(lus === 0, `2. aucun innerText lu pour regarder l'écran (${lus})`);
    // 3. rien pendant le rendu ; le premier regard après l'image, et il voit le nouvel écran
    const r = await p.evaluate(() => new Promise((fini) => {
      const qs = Document.prototype.querySelector; let n = 0; Document.prototype.querySelector = function (s) { n++; return qs.call(this, s); };
      const m = document.getElementById('m'); m.innerHTML = '<p>Écran quitté</p>';
      window.M.demarrerMesures({ jeton: () => '', ouverture: false });
      const avant = n; window.M.mesuresEcran('ventes'); const pendant = n - avant;
      m.innerHTML = '';   // le rendu pose le NOUVEL écran (vide le temps de ses données)
      setTimeout(() => { const apres = n - avant; Document.prototype.querySelector = qs; let lot = null;
        try { lot = JSON.parse(localStorage.getItem('vrm_mesures_lot') || 'null'); } catch (_) {} fini({ pendant, apres, notePeu: !!(lot && Object.keys(lot.h || {}).some((k) => /^ventes\|.*\|peu$/.test(k))) }); }, 300);
    }));
    ok(r.pendant === 0, `3. mesuresEcran ne regarde pas la page pendant le rendu (${r.pendant} lecture(s) pendant)`);
    ok(r.apres > 0, `3. le regard vient après l'image (${r.apres} lecture(s) ensuite)`);
    ok(!r.notePeu, '3. il ne note pas l\'écran QUITTÉ comme « premier écran utile » du nouveau (le nouvel écran est encore vide)');
    ok(!err.length, 'aucune erreur de page ' + err.join(' | '));
  } catch (e) { console.log('  ❌ ' + e.message.split('\n')[0]); process.exitCode = 1; }
  finally { await nav.close(); }
  console.log(process.exitCode ? `mesures-regard : ROUGE (${n} verts avant l'échec)` : `mesures-regard : ${n} verts`);
})();
