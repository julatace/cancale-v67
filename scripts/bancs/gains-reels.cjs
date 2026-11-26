// ════════════════════════════════════════════════════════════════════════════
//  BANC — « CE QUE TU GAGNES VRAIMENT » (24 nov., lot gains-reels). Données INVENTÉES (dépôt public).
//  Le VRAI écran Statistiques › Gains (outils/natif-gains, hors du paquet de prod) sur la VRAIE chaîne (releveVentes →
//  lignesReleve → gainsReels), à 390 × 844 tactile et 1512, en clair et en sombre :
//   B1 la carte existe dans le segment « Gains » ; le net total, sa couverture et le délai moyen = RECOMPTE ici, par un
//      code à part, depuis les ventes inventées (compte écarté, GBP et non finalisée hors) ;
//   B2 partiel ⇒ « sur K/N ventes » visible ; jamais « au moins » ; l'autre devise est dite ;
//   B3 « Saisir » et chaque vente sans prix d'achat ouvrent la saisie (`vrm:completer`, sujet achat, SON N°) ;
//   B4 les quatre vues (paire, modèle, source, compte) : rien n'est classé sous 3 ventes au prix connu (le 550 : 2) ;
//   B5 natif : pas de carte dans une carte, aucun débordement, aucune cible < 44 px, ni NaN ni « undefined » ;
//   B6 en lecture et « pas su » : « — » partout, jamais 0 €.
//  Captures dans SHOTS (à REGARDER). Lancer : node scripts/bancs/gains-reels.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number), THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-gains-reels'); fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 240)); } };

const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-gains-'));
function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'natif-gains', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'vrm-icones-app': gen }, external: ['/brands/*'], nodePaths: [NM], logLevel: 'error' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'natif-gains', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = (racine, port) => new Promise((res, rej) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/' || !path.extname(u)) u = '/index.html';
  const f = path.join(racine, u.replace(/^\/+/, '')); if (!f.startsWith(racine) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
  s.on('error', rej); s.listen(port, () => res(s)); });

// LE RECOMPTE À PART (pas le code de l'app), depuis les ventes inventées de la page.
const RECOMPTE = () => {
  const V = window.__VENTES.filter((o) => o.status === 'completed' && o._c !== 'compte_ecarte' && o.price.currency_code === 'EUR');
  const K = V.filter((o) => o._a != null);
  const net = K.reduce((s, o) => s + Math.round(Number(o.price.amount) * 100) - Math.round((o._f || 0) * 100) - Math.round(o._a * 100), 0);
  return { n: V.length, k: K.length, net, sans: V.length - K.length };
};
const NATIF = () => {
  const vis = (x) => x.getClientRects().length > 0;
  const carte = document.querySelector('[data-ps-bloc="gains"]');
  const cartes = [...document.querySelectorAll('.n-carte')].filter(vis);
  const empilees = cartes.filter((c) => c.parentElement && c.parentElement.closest('.n-carte')).length;
  const deborde = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const cibles = carte ? [...carte.querySelectorAll('button, [role="radio"], summary, a')].filter(vis).filter((x) => !x.closest('[aria-hidden="true"]')) : [];
  const petites = cibles.map((x) => [x.getBoundingClientRect().height, (x.textContent || '').trim().slice(0, 30)]).filter(([h]) => h > 0 && h < 44);
  return { empilees, deborde, petites, nan: /NaN|undefined|Infinity/.test(document.body.innerText) };
};

(async () => {
  construire();
  const port = Number(process.env.BANC_PORT || 4797);
  const srv = await servir(DOSSIER, port);
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) {
      const tel = W < 600, sombre = th === 'sombre';
      console.log(`\n── ${W} px · ${th}`);
      const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: W, height: 900 } }), deviceScaleFactor: 1, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
      const pg = await ctx.newPage();
      const url = (q) => `http://localhost:${port}/?${q}${sombre ? '&theme=dark' : ''}`;
      await essaie('B1 page', async () => {
        await pg.goto(url('base=lu&vue=modele'), { waitUntil: 'load' });
        await pg.waitForSelector('[data-ps-bloc="gains"]', { timeout: 15000 });
        const R = await pg.evaluate(RECOMPTE);
        const a = await pg.evaluate(() => { const t = document.querySelector('[data-gr-tuiles] [data-gr-net]'); return t ? { net: t.getAttribute('data-gr-net'), n: t.getAttribute('data-gr-n'), k: t.getAttribute('data-gr-nnet') } : null; });
        dit(a && a.net === String(R.net) && a.n === String(R.n) && a.k === String(R.k), `B1 net total ${R.net / 100} € sur ${R.k} des ${R.n} = recompte (compte écarté, GBP, non finalisée hors)`, { a, R });
        const txt = await pg.evaluate(() => document.querySelector('[data-ps-bloc="gains"]').innerText);
        dit(txt.includes(`sur ${R.k}/${R.n} ventes`) && !/au moins/i.test(txt), 'B2 « sur K/N ventes » visible, jamais « au moins »', txt.slice(0, 160));
        dit(/autre devise/.test(txt) && /eBay dans une autre devise/.test(txt), 'B2 l’autre devise est écartée ET dite');
        dit(txt.includes(`${R.sans} ventes sans prix d’achat`), 'B2 le manque est nommé (« N ventes sans prix d’achat »)');
        await pg.screenshot({ path: path.join(SHOTS, `gains-modele-${W}-${th}.png`), fullPage: true });
        // B3 la porte.
        await pg.evaluate(() => { window.__portes = []; window.addEventListener('vrm:completer', (e) => window.__portes.push(e.detail)); });
        await pg.locator('[data-gr-saisir]').first().click();
        const p1 = await pg.evaluate(() => window.__portes.slice());
        dit(p1.length === 1 && p1[0].sujet === 'achat', 'B3 « Saisir » ouvre la saisie des prix d’achat', p1);
        // B4 pas de classement sous le minimum.
        const rangs = await pg.evaluate(() => [document.querySelector('[data-gr-meilleurs]')?.getAttribute('data-gr-meilleurs'), document.querySelector('[data-gr-moinsbons]')?.getAttribute('data-gr-moinsbons')]);
        dit(rangs[0] === 'nike|dunk' && rangs[1] === 'adidas|samba' && !rangs.join().includes('550'), 'B4 par modèle : Dunk le meilleur, Samba le moins bon ; le 550 (2 ventes) jamais classé', rangs);
        const N = await pg.evaluate(NATIF);
        dit(!N.empilees && !N.deborde && !N.petites.length && !N.nan, 'B5 natif (modèle)', N);
        for (const v of ['paire', 'source', 'compte']) {
          await pg.locator('[data-ps-bloc="gains"] [role="radio"]', { hasText: { paire: 'Par paire', source: 'Par source', compte: 'Par compte' }[v] }).first().click();
          await pg.waitForSelector(`[data-gr-vue="${v}"]`, { timeout: 5000 });
          const Nv = await pg.evaluate(NATIF);
          dit(!Nv.empilees && !Nv.deborde && !Nv.petites.length && !Nv.nan, `B5 natif (${v})`, Nv);
          await pg.screenshot({ path: path.join(SHOTS, `gains-${v}-${W}-${th}.png`), fullPage: true });
          if (v === 'paire') {
            const porte = pg.locator('[data-gr-porte="1"]').first();
            const num = await pg.evaluate(() => { const l = window.__LIGNES.filter((x) => x.achat == null && x.eur != null).sort((a, b) => b.ts - a.ts)[0]; return l ? l.num : null; });
            await porte.click();
            const p2 = await pg.evaluate(() => window.__portes.slice(-1)[0]);
            dit(p2 && p2.sujet === 'achat' && p2.num === num, 'B3 une vente sans prix d’achat ouvre la saisie sur SON N°', { p2, num });
          }
          if (v === 'source') {
            const s = await pg.evaluate(() => [document.querySelector('[data-gr-meilleurs]')?.getAttribute('data-gr-meilleurs'), document.querySelector('[data-gr-racheter]')?.getAttribute('data-gr-racheter')]);
            dit(!s.join().includes('f:lbc') && !s.join().includes('non-saisie'), 'B4 par source : Leboncoin (2 reventes) et « pas saisie » jamais classés ni à racheter', s);
          }
        }
      });
      await essaie('B6 lecture et pas su', async () => {
        for (const b of ['attente', 'passu']) {
          await pg.goto(url('base=' + b + '&vue=modele'), { waitUntil: 'load' });
          await pg.waitForSelector('[data-ps-bloc="gains"]', { timeout: 15000 });
          const t = await pg.evaluate(() => ({ net: document.querySelector('[data-gr-tuiles] [data-gr-net]')?.getAttribute('data-gr-net'), txt: document.querySelector('[data-ps-bloc="gains"]').innerText }));
          dit(t.net === '' && !/0 €|0,00/.test(t.txt) && /—/.test(t.txt), `B6 ${b} ⇒ « — », jamais 0 €`, t.txt.slice(0, 160));
          if (b === 'passu') await pg.screenshot({ path: path.join(SHOTS, `gains-passu-${W}-${th}.png`), fullPage: true });
        }
      });
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); fs.rmSync(DOSSIER, { recursive: true, force: true }); }
  console.log(`\n${ko ? '❌' : '✅'} banc gains-reels : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
