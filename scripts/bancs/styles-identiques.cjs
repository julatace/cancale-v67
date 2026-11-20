// ════════════════════════════════════════════════════════════════════════════
//  BANC « STYLES IDENTIQUES » (20 nov., chantier iphone-rapide — docs/passation/2026-11-20-iphone-rapide.md).
//
//    node scripts/bancs/styles-identiques.cjs <dist-avant> <dist-apres>
//    LARGEURS=390,1512 · THEMES=clair,sombre · ECRANS=journee,annonces,… · MUTATION=1 (une règle changée : ROUGE attendu)
//
//  Une réécriture de la FEUILLE DE STYLE au build (scripts/_selecteurs-ranges.cjs : `X :is(.a, .b)` → `X .a, X .b`) ne doit
//  rien changer à l'écran. On ne juge pas le texte du CSS : on juge ce que le navigateur en CALCULE. Les deux builds sont
//  ouverts côte à côte sur la même base inventée (`_base-volume`), les mêmes écrans, à la même largeur, dans le même thème ;
//  puis, pour CHAQUE élément de la page (et ses ::before / ::after), on compare TOUTES les propriétés calculées
//  (getComputedStyle, ~350 propriétés). Les deux pages ne portent pas toujours le même DOM (une donnée arrivée une
//  seconde plus tard) : on compare les éléments qui ont le même CHEMIN (balise, classes, rang parmi ses frères) — et on
//  dit combien n'ont pas de jumeau. Une seule propriété différente sur un élément jumeau ⇒ rouge, avec l'élément, la
//  propriété et les deux valeurs. Les propriétés qui bougent seules (animations, curseur clignotant, horloge) sont
//  écartées par une première passe A/A (le MÊME build ouvert deux fois) : ce qui diffère entre A et A n'est pas jugé.
//  Base INVENTÉE ; rien ne sort (garde réseau).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: 300, achats: 200, annonces: 200 });
const [DA, DB] = process.argv.slice(2).map((x) => path.resolve(x));
if (!DA || !DB) { console.log('usage : styles-identiques.cjs <dist-avant> <dist-apres>'); process.exit(2); }
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const ECRANS = liste('ECRANS', 'journee,annonces,ventes,achats,compta,messages,garage,settings');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const serveur = (DIST) => { const s = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); }); return new Promise((ok) => s.listen(0, () => ok(s))); };

// Dans la page : chaque élément, sa clé de chemin et une EMPREINTE de toutes ses propriétés calculées (et de celles de
// ::before / ::after quand ils existent). Le détail (propriété par propriété) n'est relu que pour les éléments qui diffèrent.
function releve() {
  const cle = (e) => { const l = []; for (let x = e; x && x.nodeType === 1; x = x.parentElement) { const p = x.parentElement; const i = p ? Array.prototype.indexOf.call(p.children, x) : 0; l.push(x.tagName.toLowerCase() + (typeof x.className === 'string' && x.className ? '.' + x.className.trim().split(/\s+/).sort().join('.') : '') + ':' + i); } return l.reverse().join('>'); };
  // (L'ordre des variables CSS énumérées change d'une ouverture à l'autre : trié.)
  const texte = (cs) => { const l = []; for (let i = 0; i < cs.length; i++) l.push(cs[i] + '=' + cs.getPropertyValue(cs[i])); return l.sort().join('\u0001'); };
  const pseudo = (e, q) => { const cs = getComputedStyle(e, q); const c = cs.getPropertyValue('content'); return c && c !== 'none' && c !== 'normal' ? texte(cs) : ''; };
  const out = {};
  for (const e of document.querySelectorAll('*')) {
    if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
    out[cle(e)] = { s: texte(getComputedStyle(e)), b: pseudo(e, '::before'), a: pseudo(e, '::after') };
  }
  window.__vrmReleve = out;
  return Object.keys(out).length;
}
// Les empreintes du relevé gardé, sans les propriétés `exclure` (celles qui bougent seules d'une ouverture à l'autre).
function empreintes(exclure) {
  const ex = new Set(exclure);
  const h = (t) => { let x = 2166136261; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36) + ':' + t.length; };
  const net = (t) => (ex.size ? t.split('\u0001').filter((x) => !ex.has(x.slice(0, x.indexOf('=')))).join('\u0001') : t);
  const out = {};
  for (const [k, v] of Object.entries(window.__vrmReleve || {})) out[k] = h(net(v.s)) + '|' + h(net(v.b)) + '|' + h(net(v.a));
  return out;
}
const detailDe = (cles) => Object.fromEntries(cles.map((k) => [k, (window.__vrmReleve || {})[k] || null]));

async function ouvrir(nav, DIST, port, W, sombre, ecran) {
  const ctx = await nav.newContext({ viewport: { width: W, height: W < 600 ? 844 : 900 }, ...(W < 600 ? { isMobile: true, hasTouch: true } : {}), colorScheme: sombre ? 'dark' : 'light', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? '1' : '0'); } catch (_) {} }, sombre);
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /vinted\.net\//i.test(r.request().url()) ? r.abort() : r.fallback()));
  await ctx.route('**/rest/v1/**', async (route) => { const rq = route.request(); if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base); return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }); });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  const pg = await ctx.newPage();
  await pg.goto(`http://localhost:${port}/?tab=${ecran}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(7000);
  // Le temps est figé pour les deux (animations finies, curseurs) : on attend le calme du DOM.
  await pg.evaluate(() => new Promise((ok) => { let t = setTimeout(ok, 1500); new MutationObserver(() => { clearTimeout(t); t = setTimeout(ok, 1500); }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); setTimeout(ok, 12000); }));
  if (process.env.MUTATION && DIST === DB) await pg.addStyleTag({ content: process.env.MUTATION_CSS || '.vrm-app-shell div { letter-spacing: 0.01px; }' }).catch(() => {});
  await pg.evaluate(releve);
  return { pg, ctx };
}
const props = (t) => Object.fromEntries(String(t || '').split('\u0001').filter(Boolean).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; }));

function comparer(a, b) {
  const diff = []; let jumeaux = 0, seuls = 0;
  for (const k of Object.keys(a)) { if (!(k in b)) { seuls++; continue; } jumeaux++; if (a[k] !== b[k]) diff.push(k); }
  return { diff, jumeaux, seuls: seuls + Object.keys(b).filter((k) => !(k in a)).length };
}

(async () => {
  const [sa, sb] = [await serveur(DA), await serveur(DB)];
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  let ko = 0, ok = 0, totalJumeaux = 0;
  try {
    for (const W of LARGEURS) for (const theme of THEMES) for (const ecran of ECRANS) {
      const sombre = theme === 'sombre';
      const A1 = await ouvrir(nav, DA, sa.address().port, W, sombre, ecran);
      const A2 = await ouvrir(nav, DA, sa.address().port, W, sombre, ecran);
      const B = await ouvrir(nav, DB, sb.address().port, W, sombre, ecran);
      // Les propriétés qui bougent SEULES d'une ouverture à l'autre (une variable posée avec l'heure…) : lues sur <html> en A/A.
      const [h1, h2] = await Promise.all([A1, A2].map((o) => o.pg.evaluate(detailDe, ['html:0'])));
      const p1 = props(h1['html:0'] && h1['html:0'].s), p2 = props(h2['html:0'] && h2['html:0'].s);
      const exclure = Object.keys(p1).filter((k) => p1[k] !== p2[k]);
      const [e1, e2, eb] = await Promise.all([A1, A2, B].map((o) => o.pg.evaluate(empreintes, exclure)));
      const aa = comparer(e1, e2);
      const ab = comparer(e1, eb);
      const aVoir = ab.diff.slice(0, 400);
      if (process.env.DEBUG) console.log('   (exclues ' + exclure.join(' ') + ' · A/A ' + aa.diff.length + ' · A/B ' + ab.diff.length + ')');
      const [dA1, dA2, dB] = aVoir.length ? await Promise.all([A1, A2, B].map((o) => o.pg.evaluate(detailDe, aVoir))) : [{}, {}, {}];
      const instablesAA = new Set(aa.diff);
      if (process.env.DEBUG && aVoir.length) { const k = aVoir[0]; console.log('   (empreintes ' + e1[k] + ' / ' + e2[k] + ' / longueurs ' + [dA1, dA2].map((d) => d[k] && [d[k].s.length, d[k].b.length, d[k].a.length].join(',')).join(' ; ') + ' égaux ' + (dA1[k] && dA2[k] && dA1[k].s === dA2[k].s) + ')'); }
      if (process.env.DEBUG && aVoir.length) { const k = aVoir[0]; const x = props(dA1[k] && dA1[k].s), z = props(dA2[k] && dA2[k].s); console.log('   (A/A sur ' + k.slice(-60) + ' : ' + Object.keys(x).filter((p) => x[p] !== z[p]).slice(0, 8).map((p) => p + ' « ' + String(x[p]).slice(0, 50) + ' » « ' + String(z[p]).slice(0, 50) + ' »').join(' ; ') + ')'); }
      const vrais = [];
      for (const k of aVoir) for (const part of ['s', 'b', 'a']) {
        const x = props(dA1[k] && dA1[k][part]), y = props(dB[k] && dB[k][part]), z = instablesAA.has(k) ? props(dA2[k] && dA2[k][part]) : x;
        for (const p of new Set([...Object.keys(x), ...Object.keys(y)])) if (x[p] !== y[p] && x[p] === z[p]) vrais.push({ k, part, p, a: x[p], b: y[p] });
      }
      for (const o of [A1, A2, B]) await o.ctx.close();
      totalJumeaux += ab.jumeaux;
      const nom = `${ecran} · ${W} · ${theme}`;
      if (vrais.length || ab.diff.length > 400) { ko++; console.log(`  ❌ ${nom} : ${vrais.length} propriété(s) calculée(s) différente(s) sur ${ab.jumeaux} éléments jumeaux (${ab.diff.length} empreintes différentes)`); for (const x of vrais.slice(0, 8)) console.log(`       …${x.k.slice(-120)} ${x.part === 's' ? '' : (x.part === 'b' ? '::before ' : '::after ')}${x.p} : « ${String(x.a).slice(0, 60)} » ≠ « ${String(x.b).slice(0, 60)} »`); }
      else { ok++; console.log(`  ✅ ${nom} : ${ab.jumeaux} éléments jumeaux, toutes leurs propriétés calculées identiques (${ab.seuls} sans jumeau ; ${ab.diff.length} empreintes différentes, toutes instables en A/A)`); }
      if (ab.jumeaux < 50) { ko++; console.log(`  ❌ ${nom} : trop peu d'éléments comparés (${ab.jumeaux}) — l'écran n'est pas monté ?`); }
    }
  } finally { await nav.close(); sa.close(); sb.close(); }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} écran(s) identiques, ${ko} rouge(s) — ${totalJumeaux} éléments comparés`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
