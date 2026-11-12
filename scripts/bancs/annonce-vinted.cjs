// ════════════════════════════════════════════════════════════════════════════
// BANC « CRÉER SUR VINTED » (11 nov., lot annonce-vinted) — la VRAIE feuille, la VRAIE règle et
// la VRAIE feuille « VRM travaille », montées seules (harnais esbuild :
// scripts/bancs/annonce-vinted/harnais.jsx), extension bouchonnée, données INVENTÉES, aucun réseau.
// 390 px tactile et 1512 px, clair et sombre.
//   1 la feuille : le compte de l'onglet affiché ; la fiche prête ; celle sans photo dit « Il manque : photos »
//   2 « N° à la fin de la description » (je numérote moi-même) : le titre affiché ne change pas
//   3 premier clic ⇒ confirmation nommant le compte ; second ⇒ VRM figé (feuille de suivi)
//   4 la QUESTION (catégorie) au-dessus du gel, recherche dans la liste de Vinted, réponse ⇒ reprise
//   5 la commande : compte de l'onglet, confirme, liste blanche, photos, réponse validée
//   6 la fin : « Brouillon prêt sur Vinted ✓ », lien vers le brouillon, « à choisir sur Vinted » dit
//   7 sans compte dans l'onglet : bouton éteint, le geste dit en ambre
//   8 rien ne déborde, cibles ≥ 44 px ; captures dans SHOTS (à regarder)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_garde-reseau.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { execFileSync } = require('child_process');
const RACINE = process.env.RACINE_BANC || path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
const { chromium } = require(path.join(NM, 'playwright'));
const PORT = Number(process.env.BANC_PORT) || 4688;
const SHOTS = process.env.SHOTS || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 400) : ''}`); };

function batir() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-cv-'));
  const stub = path.join(out, 'jauge-stub.jsx');
  fs.writeFileSync(stub, "import React from 'react'; export default function J(){ return React.createElement('div',{'data-jauge-stub':''},'12/50 cette heure'); }");
  const plug = path.join(out, 'plug.cjs');
  fs.writeFileSync(plug, `module.exports = { name: 'stub', setup(b) { b.onResolve({ filter: /JaugeActions\\.jsx$/ }, () => ({ path: ${JSON.stringify(stub)} })); } };`);
  const script = path.join(out, 'b.cjs');
  fs.writeFileSync(script, `require(${JSON.stringify(path.join(NM, 'esbuild'))}).build({ entryPoints: [${JSON.stringify(path.join(RACINE, 'scripts/bancs/annonce-vinted/harnais.jsx'))}], bundle: true, outdir: ${JSON.stringify(out)}, entryNames: 'h', jsx: 'automatic', loader: { '.js': 'jsx' }, nodePaths: [${JSON.stringify(NM)}], define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false' }, plugins: [require(${JSON.stringify(plug)})], logLevel: 'error' }).catch((e) => { console.error(e); process.exit(1); });`);
  execFileSync(process.execPath, [script], { stdio: 'inherit' });
  return out;
}

(async () => {
  const dist = batir();
  const page0 = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/h.css"></head><body style="margin:0"><script src="/h.js"></script></body></html>`;
  const srv = http.createServer((q, r) => {
    const u = q.url.split('?')[0].split('#')[0];
    if (u === '/h.js' || u === '/h.css') { const f = path.join(dist, u.slice(1)); if (!fs.existsSync(f)) { r.writeHead(200, { 'content-type': 'text/css' }); r.end(''); return; } r.writeHead(200, { 'content-type': u.endsWith('.js') ? 'text/javascript' : 'text/css' }); r.end(fs.readFileSync(f)); return; }
    r.writeHead(200, { 'content-type': 'text/html' }); r.end(page0);
  }).listen(PORT, '127.0.0.1');
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const themes = (process.env.THEMES || 'clair,sombre').split(',');
  for (const [w, h, tactile] of [[390, 844, true], [1512, 900, false]]) for (const theme of themes) {
    const tag = `${w}/${theme}`;
    const ctx = await nav.newContext({ viewport: { width: w, height: h }, hasTouch: tactile, isMobile: tactile, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const erreurs = []; p.on('pageerror', (e) => erreurs.push(String(e)));
    await p.goto(`http://127.0.0.1:${PORT}/#${theme}`);
    await p.waitForSelector('[data-creer-vinted]');
    // 1
    const lu = await p.evaluate(() => ({ compte: document.querySelector('[data-creer-vinted-compte]').getAttribute('data-creer-vinted-compte'), texteCompte: document.querySelector('[data-creer-vinted-compte]').textContent, e41: document.querySelector('[data-creer-vinted-fiche="41"]').getAttribute('data-creer-vinted-etat'), e42: document.querySelector('[data-creer-vinted-fiche="42"]').getAttribute('data-creer-vinted-etat'), manque: (document.querySelector('[data-creer-vinted-manque]') || { getAttribute: () => '' }).getAttribute('data-creer-vinted-manque'), n: document.querySelector('[data-creer-vinted-lancer]').getAttribute('data-creer-vinted-lancer'), titre41: document.querySelector('[data-creer-vinted-fiche="41"] b').textContent }));
    dit(lu.compte === '111' && /compte_banc/.test(lu.texteCompte), `${tag} 1 le compte de l'onglet vinted.fr est affiché`, lu);
    dit(lu.e41 === 'prete' && lu.e42 === 'manque' && lu.manque === 'photos' && lu.n === '1', `${tag} 1b fiche prête · fiche sans photo « Il manque : photos » ; 1 à créer`, lu);
    dit(lu.titre41 === 'Nike Air Max 90 blanches', `${tag} 2 le N° va à la fin de la description, le titre ne change pas`, lu.titre41);
    // 8
    const mesure = await p.evaluate(() => { const f = document.querySelector('.vrm-cv-feuille'); const pet = [...document.querySelectorAll('.vrm-cv-voile button')].filter((b) => b.offsetParent && b.getBoundingClientRect().height < 44 && !b.closest('.vrm-cv-photo')).map((b) => b.textContent.trim().slice(0, 20)); return { deborde: document.documentElement.scrollWidth > innerWidth + 1 || f.scrollWidth > f.clientWidth + 1, pet }; });
    dit(!mesure.deborde && !mesure.pet.length, `${tag} 8 rien ne déborde, cibles ≥ 44 px`, mesure);
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, `feuille-${w}-${theme}.png`) }); }
    // 3
    await p.click('[data-creer-vinted-lancer]');
    const conf = await p.evaluate(() => { const b = document.querySelector('[data-creer-vinted-lancer]'); return { c: b.getAttribute('data-creer-vinted-confirme'), t: b.textContent }; });
    dit(conf.c === '1' && /compte_banc/.test(conf.t) && await p.evaluate(() => window.__envois.length === 0), `${tag} 3 premier clic : la confirmation nomme le compte, rien n'est parti`, conf);
    await p.click('[data-creer-vinted-lancer]');
    await p.waitForSelector('[data-creer-vinted-question]', { timeout: 8000 }).catch(() => {});
    const q = await p.evaluate(() => { const qd = document.querySelector('[data-creer-vinted-question]'); if (!qd) return null; const st = document.querySelector('[data-suivi-travail]'); const b = qd.querySelector('[data-creer-vinted-option]'); const r = b ? b.getBoundingClientRect() : null; const e = r ? document.elementFromPoint(r.x + 10, r.y + 10) : null; return { champ: qd.getAttribute('data-creer-vinted-question'), fige: !!st, dessus: !!(e && e.closest('[data-creer-vinted-question]')), n: Number(qd.querySelector('[data-creer-vinted-options]').getAttribute('data-creer-vinted-options')) }; });
    dit(q && q.champ === 'catalog_id' && q.fige && q.dessus && q.n === 18, `${tag} 3b/4 VRM figé, la question (catégorie, 18 valeurs de Vinted) au-dessus et cliquable`, q);
    await p.fill('[data-creer-vinted-cherche]', 'hommes baskets');
    const filtre = await p.evaluate(() => [...document.querySelectorAll('[data-creer-vinted-option]')].map((b) => b.getAttribute('data-creer-vinted-option')));
    dit(filtre.join(',') === '1200', `${tag} 4b la recherche garde « Hommes > Chaussures > Baskets »`, filtre);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `question-${w}-${theme}.png`) });
    await p.click('[data-creer-vinted-option="1200"]');
    await p.waitForFunction(() => window.__cree, null, { timeout: 8000 }).catch(() => {});
    const env = await p.evaluate(() => window.__envois);
    const e1 = env[0] || {}, e2 = env[1] || {};
    dit(env.length === 2 && e1.cmd === 'creerVintedFiche' && e1.uid === '111' && e1.confirme === true && JSON.stringify(Object.keys(e1.fiche || {}).sort()) === JSON.stringify(['categorie', 'couleur', 'description', 'etat', 'id', 'marque', 'numero', 'photos', 'prix', 'taille', 'titre']) && e1.fiche.photos.length === 2 && /\n\nN°41$/.test(e1.fiche.description), `${tag} 5 la commande : compte de l'onglet, confirmée, liste blanche, 2 photos, « N°41 » en bas de la description`, e1.fiche && { k: Object.keys(e1.fiche), d: e1.fiche.description });
    dit(e2.reponses && e2.reponses.catalog_id === '1200' && !('catalog_id' in (e1.reponses || {})), `${tag} 5b SA réponse repart une fois, validée par l'extension`, e2.reponses);
    // 6
    await p.waitForSelector('[data-suivi-travail][data-suivi-statut="fini"]', { timeout: 8000 }).catch(() => {});
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `fin-suivi-${w}-${theme}.png`) });
    await p.evaluate(() => { const b = [...document.querySelectorAll('[data-suivi-travail] button')].find((x) => /Fermer/.test(x.textContent)); if (b) b.click(); });
    await p.waitForTimeout(200);
    const fin = await p.evaluate(() => { const f = document.querySelector('[data-creer-vinted-fait]'); return f ? { id: f.getAttribute('data-creer-vinted-fait'), lien: f.querySelector('a').getAttribute('href'), txt: f.textContent } : null; });
    dit(fin && fin.id === '88001' && fin.lien === 'https://www.vinted.fr/items/88001/edit' && /taille du colis/.test(fin.txt), `${tag} 6 « Brouillon prêt ✓ », lien vers le brouillon, « à choisir sur Vinted : la taille du colis »`, fin);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `fin-${w}-${theme}.png`) });
    dit(!erreurs.length, `${tag} aucune erreur de page`, erreurs);
    await ctx.close();
    // 7
    const ctx2 = await nav.newContext({ viewport: { width: w, height: h }, hasTouch: tactile, isMobile: tactile });
    const p2 = await ctx2.newPage();
    await p2.goto(`http://127.0.0.1:${PORT}/#${theme}-sanscompte`);
    await p2.waitForSelector('[data-creer-vinted]');
    const sc = await p2.evaluate(() => { const c = document.querySelector('[data-creer-vinted-compte]'); return { v: c.getAttribute('data-creer-vinted-compte'), ambre: c.classList.contains('vrm-cv-geste'), off: document.querySelector('[data-creer-vinted-lancer]').disabled }; });
    dit(sc.v === 'aucun' && sc.ambre && sc.off, `${tag} 7 sans compte dans l'onglet : bouton éteint, « ouvre vinted.fr » en ambre`, sc);
    if (SHOTS && theme === themes[0]) await p2.screenshot({ path: path.join(SHOTS, `sans-compte-${w}.png`) });
    await ctx2.close();
  }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} banc annonce-vinted : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
