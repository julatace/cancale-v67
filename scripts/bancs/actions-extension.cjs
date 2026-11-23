// ═════════════════════════════════════════════════════════════════════════════
// BANC : CHAQUE ANCIEN GESTE DE PLATEFORME MÈNE AU BON LIEN DU PANNEAU (20 nov.,
// décision de Julien : « toute action doit être faite dans l'extension »).
// Les vrais composants (outils/actions-extension/ecran.jsx), 390 tactile et 1512.
//   G1 chaque ancien geste porte le lien attendu (domaine, page, ids, action — écrits ICI, pas recopiés du registre) ;
//   G2 le toucher ouvre CE lien (window.open enregistré), rien d'autre ne part ;
//   G3 sans extension ici : « s'ouvre sur … avec l'extension » ; avec : la phrase se tait ;
//   G4 « Changer le prix » : Vinted, Leboncoin, Vestiaire ouvrent le panneau sur CETTE annonce, seul eBay se coche et part ;
//   G5 au téléphone, onglet refusé : la même URL s'ouvre dans la page (Orion porte l'extension) ;
//   G6 la règle de baisse : son état lu + « Régler dans l'extension », aucun interrupteur.
// Captures : $SHOTS (défaut /tmp/banc-actions-extension). `BANC_PORT` libre.
// ═════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-actions-extension'); fs.mkdirSync(SHOTS, { recursive: true });
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'actions-extension-'));
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); } return c; };

// Ce que chaque geste DOIT ouvrir (indépendant du registre : le contrat avec le panneau).
const DOM = { vinted: 'https://www.vinted.fr/', leboncoin: 'https://www.leboncoin.fr/', vestiaire: 'https://fr.vestiairecollective.com/' };
const ATTENDU = {
  'annonces-republier': ['vinted', 'republier', '111,222', 'republier'], 'annonces-modifier': ['vinted', 'prix', '111', 'changer'],
  'annonces-brouillon': ['vinted', 'republier', '111', 'brouillon'], 'annonces-enligne': ['vinted', 'republier', 'd-9', 'mettre-en-ligne'],
  'annonces-baisser': ['vinted', 'prix', '111,222', 'baisser'], 'fiche-creer': ['vinted', 'publier', '124', 'creer'],
  'partout-lbc': ['leboncoin', 'publier', '111', 'publier'], 'partout-vc': ['vestiaire', 'publier', '111', 'publier'],
  'lbc-pause': ['leboncoin', 'annonces', '2900', 'pause'], 'lbc-supprimer': ['leboncoin', 'annonces', '2900', 'supprimer'],
  'lbc-baisser': ['leboncoin', 'prix', '2900,2901', 'baisser'], 'lbc-republier': ['leboncoin', 'republier', '2900', 'republier'],
  'vc-baisser': ['vestiaire', 'prix', 'p-5', 'baisser'], 'vinted-repondre': ['vinted', 'messages', 'c-77', 'repondre'],
  'vinted-offre': ['vinted', 'offres', 'c-77', 'repondre'], 'lbc-repondre': ['leboncoin', 'messages', 'conv-1', 'repondre'],
  'vc-repondre': ['vestiaire', 'messages', 'conv-2', 'repondre'], 'vc-offre': ['vestiaire', 'offres', 'nego-3', 'repondre'],
  'vc-aimes': ['vestiaire', 'favoris', 'p-5', 'envoyer'], favoris: ['vinted', 'favoris', '', 'envoyer'],
  'offres-auto': ['vinted', 'automatisations', 'offres', 'regler'], vacances: ['vinted', 'vacances', '', 'vacances'],
  soldes: ['vinted', 'prix', '111', 'remettre'],
};
const url = ([site, page, ids, action]) => `${DOM[site]}?vrm=panneau&page=${page}${ids ? '&ids=' + ids : ''}&action=${action}`;

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'actions-extension', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'error' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'actions-extension', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = () => new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); });
  s.listen(Number(process.env.BANC_PORT) || 0, () => res(s)); });

async function unEcran(nav, port, W) {
  const tel = W < 600;
  const ctx = await nav.newContext({ viewport: { width: W, height: tel ? 844 : 960 }, hasTouch: tel, isMobile: tel, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { window.__OUVERTS = []; window.open = (u) => { window.__OUVERTS.push(String(u)); return window.__REFUSE ? null : { opener: 1 }; }; });
  const ou = `${W}${tel ? ' tactile' : ''}`;
  for (const ext of ['0', '1']) {
    const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
    await pg.goto(`http://localhost:${port}/?ext=${ext}`, { waitUntil: 'load' }); await pg.waitForSelector('[data-banc-geste]', { timeout: 15000 }).catch(() => {});
    dit(!erreurs.length, `G0 ${ou} ext=${ext} : rendu sans erreur`, erreurs);
    const liens = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-banc-geste]')].map((x) => [x.getAttribute('data-banc-geste'), x.getAttribute('data-vrm-panneau-lien')])));
    if (ext === '0') {
      const faux = Object.entries(ATTENDU).filter(([id, a]) => liens[id] !== url(a)).map(([id]) => `${id}: ${liens[id]}`);
      dit(!faux.length && Object.keys(ATTENDU).length === 23, `G1 ${ou} : les ${Object.keys(ATTENDU).length} anciens gestes portent le lien attendu`, faux);
      const tapes = [];
      for (const id of Object.keys(ATTENDU)) {
        const el = pg.locator(`[data-banc-geste="${id}"]`).first();
        await el.scrollIntoViewIfNeeded(); if (tel) await el.tap(); else await el.click();
        const o = await pg.evaluate(() => window.__OUVERTS.splice(0));
        if (o.length !== 1 || o[0] !== url(ATTENDU[id])) tapes.push(`${id}: ${o.join(' | ')}`);
      }
      dit(!tapes.length, `G2 ${ou} : chaque toucher ouvre UN onglet, sur CE lien`, tapes);
      const t = await pg.evaluate(() => ({ phrases: document.querySelectorAll('[data-vrm-panneau-phrase]').length, texte: document.body.innerText }));
      dit(/s’ouvre sur Vinted avec l’extension/.test(t.texte) && /s’ouvre sur Leboncoin avec l’extension/.test(t.texte), `G3 ${ou} : sans extension ici, « s’ouvre sur … avec l’extension » est dit`, t.phrases);
      const rf = await pg.evaluate(() => { const b = document.querySelector('[data-rf-geste]'); return b ? b.getAttribute('data-vrm-panneau-lien') : null; });
      dit(rf === 'https://www.vinted.fr/?vrm=panneau&page=favoris&ids=111&action=envoyer', `G7 ${ou} : « Relancer au bon moment » ouvre les favoris de CETTE annonce dans l'extension`, rf);
      const cibles = await pg.evaluate(() => [...document.querySelectorAll('[data-vrm-panneau]')].map((x) => x.getBoundingClientRect()).filter((r) => r.width && r.height < 44).length);
      if (tel) dit(!cibles, `G8 ${ou} : chaque geste fait au moins 44 px`, cibles);
      await pg.screenshot({ path: path.join(SHOTS, `liste-${W}.png`), fullPage: true });
      if (tel) {
        await pg.evaluate(() => { window.__REFUSE = true; });
        await ctx.route('https://www.vinted.fr/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p id="vinted">vinted</p>' }));
        const el = pg.locator('[data-banc-geste="annonces-republier"]').first(); await el.scrollIntoViewIfNeeded();
        await Promise.all([pg.waitForURL(/vinted\.fr/, { timeout: 8000 }).catch(() => {}), el.tap()]);
        dit(pg.url() === url(ATTENDU['annonces-republier']), `G5 ${ou} : onglet refusé ⇒ la même URL s'ouvre dans la page`, pg.url());
      }
    } else {
      const n = await pg.evaluate(() => document.querySelectorAll('[data-vrm-panneau-phrase]').length + (/avec l’extension/.test(document.body.innerText) ? 1 : 0));
      dit(n === 0, `G3 ${ou} : extension ici ⇒ la phrase se tait`, n);
    }
    await pg.close();
  }
  // G4 / G6 : la feuille « Changer le prix »
  const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.goto(`http://localhost:${port}/?vue=prix`, { waitUntil: 'load' }); await pg.waitForSelector('[data-prix-partout]', { timeout: 15000 }).catch(() => {});
  const p = await pg.evaluate(() => ({
    ext: [...document.querySelectorAll('[data-prix-site][data-vrm-panneau="changerPrix"]')].map((x) => x.getAttribute('data-prix-site') + '=' + x.getAttribute('data-vrm-panneau-lien')),
    coche: [...document.querySelectorAll('[data-prix-coche]')].map((x) => x.getAttribute('data-prix-coche')),
    plein: (document.querySelector('[data-prix-appliquer]') || {}).innerText || '',
    regle: !!document.querySelector('[data-prix-regle]'), interrupteur: document.querySelectorAll('[data-prix-regles] input[role="switch"]').length,
    regler: (document.querySelector('[data-prix-regles] [data-vrm-panneau="automatisations"]') || {}).getAttribute ? document.querySelector('[data-prix-regles] [data-vrm-panneau="automatisations"]').getAttribute('data-vrm-panneau-lien') : null,
  }));
  dit(!erreurs.length, `G4 ${ou} : la feuille s'affiche sans erreur`, erreurs);
  dit(p.ext.join(' ') === ['vinted=https://www.vinted.fr/?vrm=panneau&page=prix&ids=111&action=changer', 'leboncoin=https://www.leboncoin.fr/?vrm=panneau&page=prix&ids=2900&action=changer', 'vestiaire=https://fr.vestiairecollective.com/?vrm=panneau&page=prix&ids=p-5&action=changer'].join(' '),
    `G4 ${ou} : Vinted, Leboncoin, Vestiaire ouvrent le panneau sur CETTE annonce`, p.ext);
  dit(p.coche.join() === 'ebay:777' && /eBay/.test(p.plein), `G4 ${ou} : seul eBay se coche, le plein dit « Appliquer sur eBay »`, p);
  await pg.locator('[data-prix-site="leboncoin"]').first().click();
  const o = await pg.evaluate(() => window.__OUVERTS.splice(0));
  dit(o.length === 1 && o[0] === 'https://www.leboncoin.fr/?vrm=panneau&page=prix&ids=2900&action=changer', `G4 ${ou} : toucher Leboncoin ouvre son panneau`, o);
  await pg.locator('[data-prix-champ]').fill('55'); await pg.locator('[data-prix-appliquer]').click(); await pg.waitForTimeout(200);
  const ap = await pg.evaluate(() => ({ a: window.__APPLIQUE || null, o: window.__OUVERTS.length }));
  dit(JSON.stringify(ap.a) === '["ebay:777"]' && ap.o === 0, `G4 ${ou} : « Appliquer » n'envoie QUE eBay (aucun onglet ouvert)`, ap);
  dit(p.regle && p.interrupteur === 0 && p.regler === 'https://www.vinted.fr/?vrm=panneau&page=automatisations&ids=42&action=regler', `G6 ${ou} : la règle de baisse : son état lu, aucun interrupteur, « Régler dans l'extension »`, p);
  await pg.screenshot({ path: path.join(SHOTS, `prix-${W}.png`), fullPage: true });
  await ctx.close();
}

(async () => {
  construire();
  const s = await servir(); const port = s.address().port;
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try { for (const W of [390, 1512]) await unEcran(nav, port, W); }
  catch (e) { dit(false, 'le banc est allé au bout', String(e && e.stack || e).slice(0, 600)); }
  finally { await nav.close(); s.close(); try { fs.rmSync(DOSSIER, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${ko ? '❌' : '✅'} banc actions-extension : ${ok} verts, ${ko} rouges · captures ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
