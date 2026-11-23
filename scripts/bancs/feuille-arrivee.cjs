// ════════════════════════════════════════════════════════════════════════
//  BANC « DEPUIS TA DERNIÈRE VISITE » DANS L'APP (19 nov., ext. 5.409)
//
//  Le VRAI composant `src/capteNotif/FeuilleArrivee.jsx` (ses vraies règles `arrivee.js`, la vraie `Feuille` du design
//  natif, les vrais textes `tr()`), assemblé par esbuild dans une page qui imite la coque. La base est imitée par
//  `lire(query)` (lignes `capte_journal_*` à la forme réelle : `{ id, e }`), le nuage par un `load`/`save` en mémoire.
//  390 tactile et 1512, clair et sombre (`data-theme="dark"` comme l'app). Il juge :
//   · premier passage (aucun marqueur) : RIEN ne s'affiche, le point de départ est posé ;
//   · du neuf : UNE feuille, un groupe par sorte avec son nombre, deux Chrome qui ont rangé la même vente ⇒ une ligne ;
//   · toucher une ligne : `vrm:aller` vers SON élément (identité), la feuille se ferme, le marqueur est posé (ici ET
//     synchronisé) ; au retour rien n'est redit ;
//   · vu sur un autre appareil (marqueur synchronisé plus récent) ⇒ rien ; réglage coupé ⇒ rien ;
//   · une autre feuille ouverte ⇒ elle attend, puis s'affiche ; cibles ≥ 44 px ; rien ne déborde.
//  `BANC_MUTANT=doublon|marqueur` : la règle affaiblie ⇒ rouge. Captures : `SHOTS`.
// ════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 8773;
const MUTANT = process.env.BANC_MUTANT || '';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'captures', 'feuille-arrivee');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d != null && d !== '' ? '  → ' + String(d).slice(0, 300) : '')); } };
const MUTATIONS = {
  doublon: ['capteNotif/arrivee.js', '      if (!a || e.t < a.t) m.set(k, e);', '      m.set(k + Math.random(), e);'],
  marqueur: ['capteNotif/arrivee.js', '  return entrees.filter((e) => e.t > Number(vu)', '  return entrees.filter((e) => e.t > 0'],
};

async function construire() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feuille-arrivee-'));
  fs.writeFileSync(path.join(dir, 'entree.jsx'), `
import React from 'react';
import { createRoot } from 'react-dom/client';
import FeuilleArrivee from ${JSON.stringify(path.join(RACINE, 'src', 'capteNotif', 'FeuilleArrivee.jsx'))};
import { brancherExtensionCapte } from ${JSON.stringify(path.join(RACINE, 'src', 'capteNotif', 'regle.js'))};
import { ajouterSourceApp } from ${JSON.stringify(path.join(RACINE, 'src', 'i18n', 'index.js'))};
import frApp from ${JSON.stringify(path.join(RACINE, 'src', 'i18n', 'langues', 'fr.js'))};
ajouterSourceApp(frApp);
const subs = new Set();
window.__feuille = false;
window.__poserFeuille = (v) => { window.__feuille = v; subs.forEach((f) => f()); };
window.__coupe = window.__coupeInit === true;
brancherExtensionCapte({ coupe: () => window.__coupe, regler: async (c) => { window.__coupe = c; return { ok: true }; } });
window.__allers = [];
window.addEventListener('vrm:aller', (e) => window.__allers.push(e.detail));
window.__nuage = Object.assign({}, window.__nuageInit || {});
window.__saves = [];
const load = (k, d) => (k in window.__nuage ? window.__nuage[k] : d);
const save = (k, v) => { window.__nuage[k] = v; window.__saves.push([k, v]); };
const lire = async () => window.__rows;
createRoot(document.getElementById('r')).render(<div><main style={{ padding: 20 }}><h1>Aujourd’hui</h1>{Array.from({ length: 20 }, (_, i) => <p key={i}>Ligne {i}</p>)}</main>
  <FeuilleArrivee pret lire={lire} load={load} save={save} onCloudReady={() => () => {}} nomCompte={(p, c) => (c === '111' ? 'shop_sophie' : '')} exclu={() => false}
    feuilleOuverte={() => window.__feuille} abonnerFeuilles={(fn) => { subs.add(fn); return () => subs.delete(fn); }}/></div>);
`);
  const mutant = MUTANT && MUTATIONS[MUTANT];
  const plugins = mutant ? [{ name: 'mutant', setup(b) {
    b.onLoad({ filter: new RegExp(mutant[0].replace(/[./]/g, (c) => '\\' + c) + '$') }, (a) => {
      let t = fs.readFileSync(a.path, 'utf8');
      for (let i = 1; i < mutant.length; i += 2) { if (!t.includes(mutant[i])) throw Error('mutation introuvable : ' + MUTANT); t = t.replace(mutant[i], mutant[i + 1]); }
      return { contents: t, loader: 'jsx' };
    });
  } }] : [];
  await esbuild.build({ entryPoints: [path.join(dir, 'entree.jsx')], bundle: true, outdir: path.join(dir, 'out'), format: 'esm', jsx: 'automatic', plugins,
    loader: { '.js': 'jsx', '.svg': 'dataurl', '.png': 'dataurl', '.woff2': 'dataurl' }, nodePaths: [NM], logLevel: 'error', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{"MODE":"production","PROD":true,"DEV":false}' } });
  fs.writeFileSync(path.join(dir, 'out', 'index.html'), '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="/entree.css"></head><body style="margin:0;font-family:-apple-system,system-ui,sans-serif"><div id="r"></div><script type="module" src="/entree.js"></script></body></html>');
  return path.join(dir, 'out');
}
const T0 = Date.now(), H = 3600000;
const LIGNES = [
  { id: 'capte_journal_aaaaaaaaaaaaaaaa', e: [{ p: 'vinted', c: '111', s: 'ventes', id: '91000000001', t: T0 - H }, { p: 'vinted', c: '111', s: 'codes', id: '91000000002:AB12', t: T0 - 2 * H }, { p: 'vinted', c: '111', s: 'refus', id: 'pause@1', q: 'pause', t: T0 - 3 * H }, { p: 'vinted', c: '111', s: 'ventes', id: '91000000000', t: T0 - 50 * H }] },
  { id: 'capte_journal_bbbbbbbbbbbbbbbb', e: [{ p: 'vinted', c: '111', s: 'ventes', id: '91000000001', t: T0 - H + 5000 }, { p: 'vinted', c: '111', s: 'messages', id: '60000@2026', t: T0 - 4 * H }, { p: 'leboncoin', c: 'moi', s: 'ventes', id: 'T1', t: T0 - 5 * H }] },
];
const lire = (pg) => pg.evaluate(() => {
  const f = document.querySelector('[data-capte-arrivee]');
  const vis = (el) => !!(el && el.getClientRects().length);
  const ctl = f ? Array.from(f.querySelectorAll('button, a[href]')).filter(vis) : [];
  return { vis: !!f && vis(f), n: f ? Number(f.getAttribute('data-capte-arrivee')) : 0,
    groupes: Array.from(document.querySelectorAll('[data-capte-groupe]')).map((g) => g.getAttribute('data-capte-groupe') + ':' + g.getAttribute('data-n')),
    lignes: Array.from(document.querySelectorAll('[data-capte-ligne]')).map((l) => l.getAttribute('data-capte-lien')),
    petits: ctl.filter((b) => b.getBoundingClientRect().height < 44).map((b) => (b.innerText || b.getAttribute('aria-label') || '').slice(0, 20) + ':' + Math.round(b.getBoundingClientRect().height)),
    allers: window.__allers.slice(), saves: window.__saves.slice(), ici: localStorage.getItem('vrm_capte_vu_ici'), debord: document.documentElement.scrollWidth > window.innerWidth };
});

(async () => {
  const out = await construire();
  const srv = http.createServer((q, r) => { const f = path.join(out, q.url === '/' ? 'index.html' : q.url.split('?')[0]); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(fs.readFileSync(f)); });
  await new Promise((ok2) => srv.listen(PORT, ok2));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const ouvrir = async (W, Hh, mobile, scheme, init) => {
    const ctx = await nav.newContext(Object.assign({ colorScheme: scheme, viewport: { width: W, height: Hh } }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
    const pg = await ctx.newPage();
    const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
    await pg.addInitScript((o) => { window.__rows = o.rows; window.__nuageInit = o.nuage; window.__coupeInit = o.coupe; if (o.ici) localStorage.setItem('vrm_capte_vu_ici', String(o.ici)); if (o.sombre) { const poser = () => document.documentElement && document.documentElement.setAttribute('data-theme', 'dark'); if (document.documentElement) poser(); else document.addEventListener('readystatechange', poser, { once: true }); } }, init);
    await pg.goto(`http://127.0.0.1:${PORT}/`);
    await pg.waitForTimeout(1800);
    return { ctx, pg, erreurs };
  };
  try {
    for (const [W, Hh, mobile] of [[1512, 900, false], [390, 844, true]]) for (const scheme of ['light', 'dark']) {
      const T = `${W} ${scheme}`; console.log('\n' + T);
      const sombre = scheme === 'dark';
      // 1. Premier passage.
      let t = await ouvrir(W, Hh, mobile, scheme, { rows: LIGNES, nuage: {}, sombre });
      let a = await lire(t.pg);
      dit(!a.vis && a.saves.some(([k, v]) => k === 'vrm_capte_vu' && v && v.at > 0), `${T} : premier passage : rien ne s’affiche, le point de départ est posé`, JSON.stringify(a));
      await t.ctx.close();
      // 2. Du neuf depuis le marqueur.
      t = await ouvrir(W, Hh, mobile, scheme, { rows: LIGNES, nuage: { vrm_capte_vu: { at: T0 - 10 * H } }, sombre });
      a = await lire(t.pg);
      await t.pg.screenshot({ path: path.join(SHOTS, `feuille-${W}-${scheme}.png`) });
      dit(a.vis && a.groupes.join(',') === 'refus:1,ventes:2,codes:1,messages:1', `${T} : UNE feuille, un groupe par sorte (refus de Vinted d’abord), 2 ventes (Vinted et Leboncoin)`, JSON.stringify(a.groupes));
      dit(a.lignes.filter((l) => /tx=91000000001/.test(l)).length === 1, `${T} : deux Chrome qui ont rangé la même vente ⇒ une seule ligne`, JSON.stringify(a.lignes));
      dit(!a.lignes.some((l) => /91000000000/.test(l)), `${T} : rien d’avant le marqueur`, JSON.stringify(a.lignes));
      dit(a.lignes.some((l) => /cible=retrait&tx=91000000002/.test(l)) && a.lignes.some((l) => /cible=conv&conv=60000/.test(l)), `${T} : chaque ligne mène à SON élément (code de retrait, conversation)`, JSON.stringify(a.lignes));
      dit(a.petits.length === 0 && !a.debord, `${T} : cibles ≥ 44 px, rien ne déborde`, JSON.stringify(a.petits));
      await t.pg.click('[data-capte-ligne="codes"]');
      await t.pg.waitForTimeout(500);
      a = await lire(t.pg);
      dit(!a.vis && a.allers.some((x) => /cible=retrait&tx=91000000002/.test(x)) && Number(a.ici) === T0 - H && a.saves.some(([k, v]) => k === 'vrm_capte_vu' && v.at === T0 - H), `${T} : toucher la ligne mène au code, la feuille se ferme, le marqueur est posé (ici et synchronisé)`, JSON.stringify({ v: a.vis, al: a.allers, ici: a.ici, s: a.saves.slice(-1) }));
      await t.ctx.close();
      // 3. Vu sur un autre appareil.
      t = await ouvrir(W, Hh, mobile, scheme, { rows: LIGNES, nuage: { vrm_capte_vu: { at: T0 } }, ici: T0 - 10 * H, sombre });
      a = await lire(t.pg);
      dit(!a.vis, `${T} : déjà vu sur un autre appareil (marqueur synchronisé plus récent) ⇒ rien`);
      await t.ctx.close();
      // 4. Réglage coupé.
      t = await ouvrir(W, Hh, mobile, scheme, { rows: LIGNES, nuage: { vrm_capte_vu: { at: T0 - 10 * H } }, coupe: true, sombre });
      a = await lire(t.pg);
      dit(!a.vis, `${T} : réglage « Dire ce que l’extension capte » coupé ⇒ rien`);
      await t.ctx.close();
      dit(t.erreurs.length === 0, `${T} : aucune erreur de page`, JSON.stringify(t.erreurs));
    }
    // La feuille attend une autre feuille ouverte AVANT son arrivée.
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage();
    await pg.addInitScript((o) => { window.__rows = o.rows; window.__nuageInit = o.nuage; }, { rows: LIGNES, nuage: { vrm_capte_vu: { at: T0 - 10 * H } } });
    await pg.goto(`http://127.0.0.1:${PORT}/`);
    await pg.evaluate(() => window.__poserFeuille(true));
    await pg.waitForTimeout(1800);
    let a = await lire(pg);
    const attendait = !a.vis;
    await pg.evaluate(() => window.__poserFeuille(false)); await pg.waitForTimeout(600);
    a = await lire(pg);
    dit(attendait && a.vis, 'une autre feuille ouverte ⇒ la feuille d’arrivée attend, puis s’affiche quand elle se ferme', JSON.stringify({ attendait, vis: a.vis }));
    await ctx.close();
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ feuille-arrivee : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ feuille-arrivee : ${ok} contrôles`);
  process.exit(ko ? 1 : 0);
})();
