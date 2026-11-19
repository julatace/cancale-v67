// ═══════════════════════════════════════════════════════════
//  BANC — « PUBLIER SUR… », L'AGENT DE PUBLICATION SANS IA (19 nov. 2026)
//
//  Construit outils/publier-agent/ (esbuild, hors paquet de prod) : l'écran src/ecrans/PublierAgent.jsx nourri
//  par les VRAIES règles (src/publier/, src/articles/modele.js) sur une base INVENTÉE ; src/App.jsx et l'écran eBay
//  sont remplacés par des faux qui comptent (outils/publier-agent/app-stub.js). Mesures (data-* et nombres) —
//  390 × 844 tactile (zone sûre) et 1512 × 900, clair et sombre :
//   T. ordinateur : un TABLEAU (article · catégorie · un état par site) ; chaque case porte un état ;
//   B. un plein au plus, aucun dans une rangée ; C. contrastes ≥ 4,5:1 ; X. cibles ≥ 44 au doigt ; D. aucun débordement ;
//   Q. l'article Leboncoin « Chaussures » : UNE feuille, catégorie + état + pointure ensemble ; sa réponse ⇒ « Prêt » ;
//   S. sans catégorie lue ⇒ jamais « Prêt » ; livre ⇒ Vestiaire « Pas vendable ici » ; « Nike SB » ⇒ Vestiaire refusé ;
//   P. « Publier N » ⇒ l'extension reçoit `publierFiche`, UNE commande en vol à la fois, catégorie dans chaque fiche ;
//   K. la couverture : une ligne par catégorie du stock, livre ⇒ Vestiaire « impossible » ;
//   E. une extension trop vieille ⇒ Leboncoin et Vestiaire refusés, rien n'est envoyé ;
//   V. base vide ⇒ l'état vide dessiné.
//  `--prouve` : chaque mesure faussée dans la page (un plein dans une rangée, un texte pâle) doit rougir.
// ═══════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = [path.join(RACINE, 'node_modules')].find((p) => fs.existsSync(path.join(p, 'esbuild')));
if (!NM) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const PORT = Number(process.env.BANC_PORT) || 8947;
const PROUVE = process.argv.includes('--prouve');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-publier-agent');
const DOSSIER = path.join(os.tmpdir(), 'banc-publier-agent-build-' + process.pid);
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(DOSSIER, { recursive: true });
let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) { verts++; if (!PROUVE) console.log('  ✅ ' + quoi); } else { rouges++; if (!PROUVE) console.log('  ❌ ' + quoi + (d !== undefined ? '\n       ' + JSON.stringify(d).slice(0, 700) : '')); } return ok; };

async function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/);
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx');
  fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  const stub = path.join(RACINE, 'outils', 'publier-agent', 'app-stub.js');
  const ebay = path.join(DOSSIER, 'ebay-stub.js');
  fs.writeFileSync(ebay, "export async function preparerBrouillonPartout(p, o) { (window.__banc.brouillons = window.__banc.brouillons || []).push({ p, o }); return { accepte: true, etape: 'brouillon', brouillonId: 'b' + p.num }; }\n");
  await esbuild.build({ entryPoints: [path.join(RACINE, 'outils', 'publier-agent', 'banc.jsx')], bundle: true, outfile: path.join(DOSSIER, 'banc.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'error',
    plugins: [{ name: 'faux-app', setup(b) {
      b.onResolve({ filter: /(^|\/)App\.jsx$/ }, () => ({ path: stub }));
      b.onResolve({ filter: /\/Ebay\.jsx$/ }, () => ({ path: ebay }));
    } }] });
  fs.copyFileSync(path.join(RACINE, 'outils', 'publier-agent', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = () => new Promise((ok) => { const s = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); }); s.listen(PORT, () => ok(s)); });

const MESURE = () => {
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const lire = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const sur = (c, f) => ({ r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a), a: 1 });
  const fondDe = (el) => { const pile = []; for (let e = el; e; e = e.parentElement) { const c = lire(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { pile.push(c); if (c.a >= 1) break; } }
    let f = document.documentElement.getAttribute('data-theme') === 'dark' ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 }; for (const c of pile.reverse()) f = sur(c, f); return f; };
  const r = { contrastes: [], cibles: [], debord: document.scrollingElement.scrollWidth - innerWidth, pleins: 0, pleinsRangee: 0 };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const el = t.parentElement; if (!t.nodeValue.trim() || !el) continue; const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || b.width === 0 || b.height === 0 || el.closest('[aria-hidden="true"],[hidden],option') || b.bottom < 0 || b.top > innerHeight) continue;
    const c = lire(cs.color); if (!c) continue; const fd = fondDe(el); const x = sur({ ...c, a: c.a * Number(cs.opacity || 1) }, fd); const L1 = lum(x), L2 = lum(fd); const k = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (k < 4.5) r.contrastes.push({ t: t.nodeValue.trim().slice(0, 24), k: Math.round(k * 100) / 100 });
  }
  for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select, .n-rangee[tabindex]')) {
    const b = el.getBoundingClientRect(); if (!b.width || !b.height || b.bottom < 0 || b.top > innerHeight || el.closest('[hidden],[aria-hidden="true"]')) continue;
    if (b.width < 44 || b.height < 44) r.cibles.push({ q: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 24), w: Math.round(b.width), h: Math.round(b.height) });
  }
  r.pleins = document.querySelectorAll('[data-n-variante="plein"]').length;
  r.pleinsRangee = document.querySelectorAll('[data-pa-article] [data-n-variante="plein"]').length;
  r.th = [...document.querySelectorAll('[data-pa-tableau] th')].map((e) => e.getAttribute('data-pa-th') || 'x');
  r.cases = [...document.querySelectorAll('tr[data-pa-article]')].map((tr) => ({ cle: tr.getAttribute('data-pa-article'), etats: [...tr.querySelectorAll('[data-pa-col]')].filter((td) => td.getAttribute('data-pa-col') !== 'categorie').map((td) => td.getAttribute('data-pa-col') + ':' + td.getAttribute('data-pa-etat')) }));
  r.rangees = [...document.querySelectorAll('[data-pa-liste] [data-pa-article]')].map((e) => ({ cle: e.getAttribute('data-pa-article'), q: e.getAttribute('data-pa-questions') }));
  r.n = Number((document.querySelector('[data-pa-n]') || {}).getAttribute ? document.querySelector('[data-pa-n]').getAttribute('data-pa-n') : -1);
  r.vide = !!document.querySelector('.n-vide');
  r.publier = (document.querySelector('[data-pa-publier]') || { getAttribute: () => null }).getAttribute('data-pa-publier');
  return r;
};
const TEL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const PC = { viewport: { width: 1512, height: 900 } };
async function ouvrir(nav, opts, q) {
  const ctx = await nav.newContext(opts); const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e)));
  await pg.goto(`http://127.0.0.1:${PORT}/${q}`); await pg.waitForSelector('[data-pa-ecran]', { timeout: 15000 });
  if (opts.isMobile) await pg.addStyleTag({ content: ':root{--n-zone-haut:47px;--n-zone-bas:34px}' });
  await pg.waitForFunction(() => !document.querySelector('.n-attente') || document.querySelector('[data-pa-n]') || document.querySelector('.n-vide'), null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(300); return { ctx, pg, erreurs };
}
const etatDe = (r, cle, site) => { const c = r.cases.find((x) => x.cle === cle); const e = c && c.etats.find((x) => x.startsWith(site + ':')); return e ? e.split(':')[1] : null; };

async function juger(nav, mutant = '') {
  for (const sombre of [false, true]) for (const [nomV, opts] of [['390', TEL], ['1512', PC]]) for (const v of ['melange', 'volume', 'vide']) {
    const { ctx, pg, erreurs } = await ouvrir(nav, opts, `?v=${v}${sombre ? '&theme=dark' : ''}`);
    if (mutant === 'plein') await pg.evaluate(() => { const r = document.querySelector('[data-pa-article]'); if (r) { const b = document.createElement('button'); b.setAttribute('data-n-variante', 'plein'); b.textContent = 'Publier'; r.appendChild(b); } });
    if (mutant === 'contraste') await pg.addStyleTag({ content: '.n-pa-article-titre,.n-rangee-titre{color:#bbb !important}' });
    const r = await pg.evaluate(MESURE);
    const ou = `${v} · ${nomV}${sombre ? ' · sombre' : ''}`;
    dit(!erreurs.length, `R ${ou} : aucune erreur dans la page`, erreurs);
    if (v === 'vide') dit(r.vide && r.n === -1, `V ${ou} : l'état vide est dessiné`);
    else {
      dit(r.n === (v === 'volume' ? 60 : 6), `N ${ou} : « ${r.n} articles » au-dessus de la liste`, r.n);
      dit(r.pleinsRangee === 0 && r.pleins <= 1, `B ${ou} : un plein au plus (${r.pleins}), aucun dans une rangée`, r);
      if (nomV === '1512') {
        dit(JSON.stringify(r.th) === JSON.stringify(['x', 'x', 'leboncoin', 'vestiaire', 'ebay']), `T ${ou} : le tableau (article · catégorie · Leboncoin · Vestiaire · eBay)`, r.th);
        dit(r.cases.length === r.n && r.cases.every((c) => c.etats.length === 3 && c.etats.every((e) => !/:null$/.test(e))), `T ${ou} : chaque case porte un état`, r.cases.find((c) => c.etats.length !== 3));
        if (v === 'melange') {
          dit(etatDe(r, 'vinted#101', 'leboncoin') === 'pret' && etatDe(r, 'vinted#101', 'vestiaire') === 'pret' && etatDe(r, 'vinted#101', 'ebay') === 'question', `S ${ou} : catégorie lue ⇒ Leboncoin et Vestiaire prêts, eBay à préciser (SA catégorie)`, r.cases[0]);
          dit(['leboncoin', 'vestiaire', 'ebay'].every((s) => etatDe(r, 'vinted#104', s) !== 'pret'), `S ${ou} : catégorie pas lue ⇒ aucun site « Prêt »`, r.cases.find((c) => c.cle === 'vinted#104'));
          dit(etatDe(r, 'vinted#105', 'vestiaire') === 'refus' && etatDe(r, 'vinted#102', 'vestiaire') === 'refus', `S ${ou} : livre et « Nike SB » ⇒ Vestiaire « Pas vendable ici »`, [etatDe(r, 'vinted#105', 'vestiaire'), etatDe(r, 'vinted#102', 'vestiaire')]);
        }
      } else {
        dit(r.rangees.length === Math.min(r.n, 999), `L ${ou} : une rangée par article`, r.rangees.length);
        dit(r.cibles.length === 0, `X ${ou} : cibles ≥ 44 × 44`, r.cibles.slice(0, 6));
      }
    }
    dit(r.contrastes.length === 0, `C ${ou} : contrastes ≥ 4,5:1`, r.contrastes.slice(0, 6));
    dit(r.debord <= 0, `D ${ou} : aucun débordement horizontal`, r.debord);
    if (!mutant) await pg.screenshot({ path: path.join(SHOTS, `${v}-${nomV}${sombre ? '-sombre' : ''}.png`) });
    await ctx.close();
  }
  if (mutant) return;
  // Q + P : la question groupée, puis la publication, au doigt et à la souris.
  for (const [nomV, opts] of [['390', TEL], ['1512', PC]]) {
    const { ctx, pg, erreurs } = await ouvrir(nav, opts, '?v=melange');
    await pg.click('[data-pa-article="leboncoin#9001"]'); await pg.waitForSelector('[data-pa-question]', { timeout: 5000 });
    await pg.waitForTimeout(350);
    const q = await pg.evaluate(() => [...document.querySelectorAll('[data-pa-q]')].map((e) => e.getAttribute('data-pa-q')));
    dit(q.includes(':categorie') && q.includes(':etat') && q.includes(':pointure') && q.filter((x) => x === ':categorie').length === 1, `Q ${nomV} : UNE feuille — catégorie, état et pointure ensemble`, q);
    if (!PROUVE) await pg.screenshot({ path: path.join(SHOTS, `question-${nomV}.png`) });
    if (nomV === '390') { const c = await pg.evaluate(MESURE); dit(c.cibles.length === 0 && c.contrastes.length === 0, `Q ${nomV} : la feuille — cibles ≥ 44, contrastes ≥ 4,5:1`, { c: c.cibles.slice(0, 5), k: c.contrastes.slice(0, 5) }); }
    await pg.selectOption('[data-pa-q=":categorie"] select', 'chaussures/baskets/homme');
    await pg.selectOption('[data-pa-q=":etat"] select', 'Bon état');
    await pg.fill('[data-pa-q=":pointure"] input', '43');
    if (q.includes(':marque')) await pg.fill('[data-pa-q=":marque"] input', 'Nike');
    await pg.click('[data-pa-enregistrer]'); await pg.waitForTimeout(500);
    const apres = await pg.evaluate(() => ({ mem: JSON.stringify(window.__banc.store.vrm_agent_publier || {}), q: (document.querySelector('[data-pa-article="leboncoin#9001"]') || { getAttribute: () => null }).getAttribute('data-pa-questions') }));
    dit(/chaussures\/baskets\/homme/.test(apres.mem) && /"pointure":"43"/.test(apres.mem), `Q ${nomV} : la réponse est retenue (vrm_agent_publier)`, apres.mem.slice(0, 300));
    if (nomV === '1512') {
      const r = await pg.evaluate(MESURE);
      dit(etatDe(r, 'leboncoin#9001', 'leboncoin') === 'deja' && etatDe(r, 'leboncoin#9001', 'vestiaire') === 'pret', `Q ${nomV} : après sa réponse, l'article Leboncoin part vers Vestiaire (déjà sur Leboncoin)`, r.cases.find((c) => c.cle === 'leboncoin#9001'));
      const n = Number(r.publier);
      await pg.click('[data-pa-publier]');
      await pg.waitForFunction(() => !document.querySelector('[data-pa-arreter]'), null, { timeout: 20000 }).catch(() => {});
      await pg.waitForTimeout(300);
      const b = await pg.evaluate(() => ({ cmds: window.__banc.cmds, max: window.__banc.maxEnVol, brouillons: (window.__banc.brouillons || []).length }));
      dit(n > 0 && b.cmds.length > 0 && b.cmds.every((c) => c.cmd === 'publierFiche' && c.fiche && c.fiche.categorie && /VRM-\w+/.test(c.fiche.description)), `P ${nomV} : « Publier ${n} » ⇒ ${b.cmds.length} commandes publierFiche, chacune avec SA catégorie et « VRM-n° »`, b.cmds.map((c) => c.site + ':' + c.fiche.numero));
      dit(b.max === 1, `P ${nomV} : une seule commande en vol à la fois (${b.max})`, b.max);
      dit(!b.cmds.some((c) => c.fiche.numero === '15' || c.fiche.numero === '16' && c.site === 'vestiaire'), `P ${nomV} : rien n'est parti pour l'article sans catégorie ni pour le livre vers Vestiaire`, b.cmds.map((c) => c.site + ':' + c.fiche.numero));
      const r2 = await pg.evaluate(MESURE);
      dit(['parti'].includes(etatDe(r2, 'vinted#101', 'leboncoin')), `P ${nomV} : la case dit « Envoyé »`, r2.cases[0]);
      if (!PROUVE) await pg.screenshot({ path: path.join(SHOTS, `apres-publier-${nomV}.png`) });
    }
    dit(!erreurs.length, `R ${nomV} : aucune erreur pendant la question et l'envoi`, erreurs);
    await ctx.close();
  }
  // K : la couverture.
  for (const [nomV, opts] of [['390', TEL], ['1512', PC]]) for (const sombre of [false, true]) {
    const { ctx, pg } = await ouvrir(nav, opts, `?v=melange${sombre ? '&theme=dark' : ''}`);
    await pg.locator('[data-pa-outils] [role="radio"]').nth(1).click().catch(() => {});
    await pg.waitForSelector('[data-pa-couverture]', { timeout: 5000 }).catch(() => {});
    const k = await pg.evaluate(() => ({ n: Number((document.querySelector('[data-pa-couverture]') || { getAttribute: () => -1 }).getAttribute('data-pa-couverture')), livre: !!document.querySelector('[data-pa-cat="livres/manuel-scolaire/"]'),
      livreVc: !!document.querySelector('[data-pa-cat="livres/manuel-scolaire/"] [data-pa-couv="vestiaire:impossible"]') || /Vestiaire impossible/.test((document.querySelector('[data-pa-cat="livres/manuel-scolaire/"]') || {}).textContent || '') }));
    const m = await pg.evaluate(MESURE);
    const ou = `${nomV}${sombre ? ' · sombre' : ''}`;
    dit(k.n >= 3 && k.livre && k.livreVc, `K ${ou} : une ligne par catégorie du stock (${k.n}) ; livre ⇒ Vestiaire impossible`, k);
    dit(m.contrastes.length === 0 && m.debord <= 0 && (nomV !== '390' || m.cibles.length === 0), `K ${ou} : contrastes, débordement, cibles`, { k: m.contrastes.slice(0, 4), d: m.debord, c: m.cibles.slice(0, 4) });
    if (!PROUVE) await pg.screenshot({ path: path.join(SHOTS, `couverture-${nomV}${sombre ? '-sombre' : ''}.png`) });
    await ctx.close();
  }
  // E : une extension trop vieille ⇒ rien n'est envoyé vers Leboncoin ou Vestiaire.
  { const { ctx, pg } = await ouvrir(nav, PC, '?v=melange&ext=0'); const r = await pg.evaluate(MESURE);
    dit(r.cases.every((c) => c.etats.filter((e) => /^(leboncoin|vestiaire):/.test(e)).every((e) => !/:pret$/.test(e))), 'E extension sans `publierfiche` ⇒ aucun Leboncoin / Vestiaire « Prêt »', r.cases.map((c) => c.etats.join('|')));
    await ctx.close(); }
}
(async () => {
  await construire();
  const s = await servir();
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    if (PROUVE) {
      let pris = 0;
      for (const m of ['plein', 'contraste']) { rouges = 0; verts = 0; await juger(nav, m); console.log(`${rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`); if (rouges) pris++; }
      console.log(`\n${pris}/2 mutations attrapées.`); process.exitCode = pris === 2 ? 0 : 1;
    } else {
      await juger(nav);
      console.log(`\n${rouges ? '❌' : '✅'} banc publier-agent : ${verts} vert(s), ${rouges} rouge(s) — captures : ${SHOTS}`);
      process.exitCode = rouges ? 1 : 0;
    }
  } finally { await nav.close(); s.close(); try { fs.rmSync(DOSSIER, { recursive: true, force: true }); } catch (_) {} }
})();
