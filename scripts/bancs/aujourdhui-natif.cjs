// ════════════════════════════════════════════════════════════════════════════
//  BANC — « AUJOURD'HUI » ET « À RÉGLER » EN « VRM NATIF », JUGÉS SEULS DANS LA COQUE NATIVE (19 nov.).
//  Le VRAI écran (src/natif/ecrans/Aujourdhui.jsx) et le VRAI bloc (src/designV2/ARegler.jsx), montés par
//  outils/natif-aujourdhui/ecran.jsx (esbuild, hors du paquet de prod) avec des données INVENTÉES qui reproduisent la
//  capture de Julien (8 colis dont 3 pas prêts, un point au nom très long, 15 colis · 6 points, un prix à 4 chiffres,
//  des ventes sans photo ni titre). Contrat : docs/design/NATIF.md §5.
//  390 × 844 tactile (zone sûre : 47 en haut, 34 en bas), 1512 × 900, 1280 × 800 ; clair et sombre ; bases `capture`,
//  `volume`, `vide`, `attente`. Les mesures sont celles de scripts/bancs/aujourdhui-propre.cjs (`DESSIN`, `contrastes`) :
//    D1 la bande : aucune vignette n'en chevauche une autre, chaque plaque N° ENTIÈRE dans sa case, au plus un signe
//       d'urgence, vignettes + « +N » = le nombre de colis ;
//    D2 la passe : le nom du point sur UNE ligne, le code centré ;
//    D3 la barre d'onglets : 5 onglets de même largeur, chacun son libellé ; rien de lisible ni de touchable dessous ;
//    D4 UN seul plein, collé au-dessus de la barre, et il fait SON geste au toucher ; cibles ≥ 44 ; rien coupé sans « … » ;
//    D5 contraste ≥ 4,5:1 sur le fond RENDU (lu dans les pixels) ;
//    N  natif : aucun style en ligne ni `!important` dans l'écran, aucune liste « À faire » ;
//    R  « À régler » : replié s'il ne presse pas, ouvert sinon ; 3 rangées puis « Tout voir » ; chaque rangée se touche ;
//    V  base vide : ni bande, ni plein, « — » ou 0 (jamais « NaN ») ; attente : la même boîte, rien d'autre.
//  Mutations (`MUTATION=bande|plaque|passe|barre|sous|plein|contraste`, injectées dans la page) : chacune rougit SA mesure.
//  `SHOTS=dossier` (les captures se REGARDENT), `DSF=2`, `BASES`, `LARGEURS`, `THEMES`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
process.env.BANC_PORT = process.env.BANC_PORT || '';
const { DESSIN, contrastes, LIRE, ECRAN, BARRE, ONGLET } = require('./aujourdhui-propre.cjs');
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const BASES = liste('BASES', 'capture,volume,vide,attente'), LARGEURS = liste('LARGEURS', '390,1512,1280').map(Number), THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-aujourdhui-natif'); fs.mkdirSync(SHOTS, { recursive: true });
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'natif-aujourdhui-'));
const MUT = process.env.MUTATION || '', DSF = Number(process.env.DSF || 1);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable dans src/App.jsx');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'natif-aujourdhui', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'vrm-icones-app': gen }, nodePaths: [NM], logLevel: 'error' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'natif-aujourdhui', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = () => new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }); s.listen(0, () => res(s)); });

async function ouvrir(nav, port, { W, sombre, base, vue = 'aujourdhui' }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: W, height: W === 1512 ? 900 : 800 } }), deviceScaleFactor: DSF, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  if (tel) { try { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }); } catch (_) {} }
  await pg.goto(`http://localhost:${port}/?base=${base}&vue=${vue}${sombre ? '&theme=dark' : ''}`, { waitUntil: 'load' });
  await pg.waitForSelector(vue === 'regler' ? '[data-v2-regler]' : ECRAN, { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(700);
  return { ctx, pg, erreurs, tel };
}
async function muter(pg) {
  const css = { bande: '[data-v2-colis] { margin-left: -34px; }', plaque: '[data-v2-colis] .n-plaque { transform: translateX(46px); }',
    passe: '[data-v2-passe-lieu] .n-rangee-titre { white-space: normal; display: block; max-width: 90px; overflow: visible; }',
    barre: '.n-onglet:first-child { flex: 3 1 0; min-width: 160px; } .n-onglet:not(:first-child) .n-onglet-libelle { font-size: 0; }',
    sous: '.n-onglets { transform: translateY(-90px); }', contraste: '.n-affiche-libelle, .n-rangee-sous { color: rgb(150 160 175); opacity: .45; }' }[MUT];
  if (css) await pg.addStyleTag({ content: css });
  if (MUT === 'plein') await pg.evaluate(() => { const p = document.querySelector('[data-v2-principal]'); if (p) { const c = p.cloneNode(true); p.parentElement.appendChild(c); } });
  await pg.waitForTimeout(250);
}

async function unEcran(nav, port, base, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `${base} · ${W} · ${th}`;
  console.log(`\n── ${ou}`);
  const { ctx, pg, erreurs, tel } = await ouvrir(nav, port, { W, sombre, base });
  try {
    if (MUT) await muter(pg);
    const w = await pg.evaluate(LIRE, ECRAN);
    if (!dit(!!w, `${ou} : l’écran est rendu`)) { await ctx.close(); return; }
    await pg.screenshot({ path: path.join(SHOTS, `aujourdhui-${base}-${W}-${th}.png`) });
    const natif = await pg.evaluate((s) => { const e = document.querySelector(s); const tous = [e, ...e.querySelectorAll('*')];
      return { styles: tous.filter((x) => x.getAttribute('style') && !x.closest('.n-vignettes-photo') && !/^--n-/.test(x.getAttribute('style').trim())).map((x) => x.className + ':' + x.getAttribute('style')).slice(0, 5), horsNatif: [...e.querySelectorAll('[class]')].filter((x) => ![...x.classList].every((c) => /^n-/.test(c))).map((x) => String(x.className)).slice(0, 5) }; }, ECRAN);
    dit(w.jobs === 0 && !natif.styles.length && !natif.horsNatif.length, `N ${ou} : aucune liste « À faire », aucun style en ligne, seulement des composants natifs`, { jobs: w.jobs, ...natif });
    if (base === 'attente') { dit(w.etat === 'encours' && w.blocs.join() === 'chiffres' && !w.plein && w.colis === 0, `V ${ou} : en attente — les chiffres à leur taille (« — »), rien d’autre`, { blocs: w.blocs, etat: w.etat });
      const h = await pg.evaluate(() => Math.round(document.querySelector('[data-v2-bloc="chiffres"]').getBoundingClientRect().height));
      const p2 = await ouvrir(nav, port, { W, sombre, base: 'capture' }); const h2 = await p2.pg.evaluate(() => Math.round(document.querySelector('[data-v2-bloc="chiffres"]').getBoundingClientRect().height)); await p2.ctx.close();
      dit(Math.abs(h - h2) <= 1, `V ${ou} : la boîte des chiffres a la MÊME hauteur en attente (${h}) et lue (${h2}) — rien ne saute`, [h, h2]); }
    else if (base === 'vide') dit(!w.plein && w.colis === 0 && w.alertes === 0 && w.blocs.includes('rien') && !/NaN|undefined|null/.test(w.texte) && w.jour === '0', `V ${ou} : rien à envoyer ni à retirer ⇒ ni bande, ni plein, ni alerte ; 0 € lu, « — » pour le pas su`, { blocs: w.blocs, jour: w.jour });
    else {
      dit(w.blocs.join() === 'chiffres,envoyer,retirer,ventes' && w.alertes <= 1, `${ou} : les chiffres, À envoyer, À retirer, Dernières ventes — rien d’autre ; au plus une alerte (${w.alertes})`, w.blocs);
      // (19 nov., « plus de stats […] le CA, le bénéfice ») Jour · Semaine · Mois : un toucher change la période, l'affiche et
      // les faits suivent ; l'écart est nommé ; un chiffre se touche et ouvre Argent sur SA période.
      if (base === 'capture' && !MUT) {
        const lireS = () => pg.evaluate(() => { const c = document.querySelector('[data-v2-bloc="chiffres"]'); const f = (k) => { const x = document.querySelector(`[data-v2-stat="${k}"] .n-fait-valeur`); return x ? x.textContent.trim() : null; };
          return { p: c.getAttribute('data-v2-periode'), grand: (document.querySelector('.n-affiche-valeur') || {}).textContent, ecart: (document.querySelector('.n-affiche-ecart') || { textContent: '' }).textContent, ben: f('benefice'), ventes: f('ventes'), panier: f('panier'),
            detB: ((document.querySelector('[data-v2-stat="benefice"] .n-fait-detail') || {}).textContent || ''), seg: document.querySelectorAll('.n-segmente [role="radio"]').length }; });
        const toucherS = (s2) => (tel ? pg.locator(s2).first().tap({ timeout: 5000 }) : pg.locator(s2).first().click({ timeout: 5000 })).catch(() => {});
        let s1 = await lireS();
        dit(s1.seg === 3 && s1.p === 'jour' && s1.grand === '102' && /\+85 %/.test(s1.ecart) && s1.ventes === '2' && /51/.test(s1.panier || ''), `S ${ou} : Jour — 102 € vendus, « +85 % » nommé, 2 ventes, panier 51 €`, s1);
        await toucherS('.n-segmente [role="radio"]:nth-of-type(2)'); await pg.waitForTimeout(300); s1 = await lireS();
        dit(s1.p === 'semaine' && s1.grand === '497' && /−12 %/.test(s1.ecart) && /au moins/.test(s1.detB) && /8 \/ 10/.test(s1.detB), `S ${ou} : Semaine — 497 €, « −12 % », bénéfice « au moins · prix d’achat 8 / 10 »`, s1);
        await pg.screenshot({ path: path.join(SHOTS, `aujourdhui-semaine-${W}-${th}.png`) });
        await toucherS('[data-v2-stat="benefice"]'); await pg.waitForTimeout(200);
        dit(await pg.evaluate(() => document.documentElement.getAttribute('data-banc-argent')) === 'semaine', `S ${ou} : toucher le bénéfice ouvre Argent sur la semaine`);
        await pg.goto(pg.url(), { waitUntil: 'load' }); await pg.waitForSelector(ECRAN, { timeout: 20000 }).catch(() => {}); await pg.waitForTimeout(600);
      }
      const d = await pg.evaluate(DESSIN, [ECRAN, BARRE, ONGLET]);
      dit(d.bande.cases >= 2 && !d.bande.chev.length && !d.bande.chevTextes.length && d.bande.horsBande === 0, `D1 ${ou} : ${d.bande.cases} vignettes, aucune n’en chevauche une autre, aucun texte superposé`, d.bande);
      dit(d.bande.plaques >= 1 && !d.bande.plaquesKo.length, `D1 ${ou} : ${d.bande.plaques} plaques N°, chacune ENTIÈRE dans sa case`, d.bande.plaquesKo);
      dit(d.bande.urgencesMax <= 1 && w.colis + w.plus === Number(w.affiche), `D1 ${ou} : au plus un signe d’urgence par vignette ; ${w.colis} vignettes + ${w.plus} résumées = ${w.affiche} colis`, { u: d.bande.urgencesMax, colis: w.colis, plus: w.plus });
      dit(!!d.passe && d.passe.rects === 1 && d.passe.lignes === 1 && !(d.passe.coupe && !d.passe.ellipse), `D2 ${ou} : le nom du point tient sur UNE ligne${d.passe && d.passe.coupe ? ' (ellipse)' : ''}`, d.passe);
      dit(!!d.passe && !!d.passe.code && d.passe.code.decalage <= 2, `D2 ${ou} : le code est centré dans sa zone (écart ${d.passe && d.passe.code && d.passe.code.decalage} px)`, d.passe && d.passe.code);
      if (tel) {
        dit(!!d.barre && d.barre.n === 5 && d.barre.ecart <= 1, `D3 ${ou} : 5 onglets de MÊME largeur (${d.barre ? d.barre.ws.join(' · ') : '—'})`, d.barre && d.barre.ws);
        dit(!!d.barre && d.barre.libs.every((l) => l && l.vu) && d.barre.h.every((h) => h >= 44), `D3 ${ou} : chaque onglet a son libellé visible, cibles ≥ 44`, d.barre && { libs: d.barre.libs, h: d.barre.h });
        // Rien sous la barre : défilé tout en bas, le dernier groupe finit au-dessus du plein, qui finit au-dessus de la barre.
        const bas = await pg.evaluate(async (args) => { const [sel, selBarre] = args; const vis = (x) => x.getClientRects().length > 0;
          const barre = [...document.querySelectorAll(selBarre)].find(vis); const hb = barre.getBoundingClientRect().top;
          const defile = [...document.querySelectorAll('*')].find((x) => x.scrollHeight > x.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(x).overflowY)) || document.scrollingElement;
          defile.scrollTo(0, defile.scrollHeight); await new Promise((r) => setTimeout(r, 350));
          const e = document.querySelector(sel); const blocs = [...e.querySelectorAll('[data-v2-bloc]')].filter(vis); const fin = Math.max(...blocs.map((x) => x.getBoundingClientRect().bottom));
          const p = e.querySelector('[data-v2-principal]'); const pq = p ? p.getBoundingClientRect() : null;
          const touchables = [...e.querySelectorAll('button, a[href]')].filter(vis).filter((x) => { const q = x.getBoundingClientRect(); const y = q.top + q.height / 2; if (y < hb || y > innerHeight) return false; const h = document.elementFromPoint(q.left + q.width / 2, y); return !!h && (x === h || x.contains(h)); }).length;
          defile.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 200));
          return { fin: Math.round(fin), plein: pq ? [Math.round(pq.top), Math.round(pq.bottom)] : null, barre: Math.round(hb), touchables }; }, [ECRAN, BARRE]);
        dit(bas.touchables === 0 && (!bas.plein || (bas.fin <= bas.plein[0] + 1 && bas.plein[1] <= bas.barre)) && (bas.plein || bas.fin <= bas.barre), `D3 ${ou} : rien sous la barre — fin du contenu ${bas.fin} ≤ plein ${bas.plein ? bas.plein.join('–') : '—'} ≤ barre ${bas.barre}`, bas);
      }
      dit(d.pleins === 1, `D4 ${ou} : UN seul bouton plein (${d.pleins})`, d.pleins);
      if (tel) dit(!d.petits.length, `D4 ${ou} : toutes les cibles ≥ 44 × 44`, d.petits);
      dit(!d.coupes.length && d.deborde <= 1 && !d.hors.length, `D4 ${ou} : aucun texte coupé sans « … », rien ne déborde`, { coupes: d.coupes, deborde: d.deborde, hors: d.hors });
      const c = await contrastes(pg, ECRAN);
      dit(c.juges > 15 && !c.faibles.length, `D5 ${ou} : ${c.juges} textes ≥ 4,5:1 sur leur fond RENDU (min ${c.min})`, c.faibles ? c.faibles.slice(0, 5) : c);
      // Le plein fait SON geste au toucher (il imprime : ici, le geste reçu en prop).
      if (!MUT) { await (tel ? pg.locator('[data-v2-principal]').first().tap({ timeout: 5000 }) : pg.locator('[data-v2-principal]').first().click({ timeout: 5000 })).catch(() => {});
        dit(await pg.evaluate(() => document.documentElement.getAttribute('data-banc-imprime')) === w.plein, `D4 ${ou} : un vrai toucher sur « Imprimer ${w.plein} bordereaux » fait son geste`, w.plein); }
    }
    dit(!erreurs.length, `${ou} : aucune erreur JS`, erreurs);
  } catch (e) { dit(false, `${ou} : le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 500)); }
  await ctx.close();
}

async function regler(nav, port, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `À régler · ${W} · ${th}`;
  console.log(`\n── ${ou}`);
  const { ctx, pg, erreurs, tel } = await ouvrir(nav, port, { W, sombre, base: 'capture', vue: 'regler' });
  try {
    const lire = () => pg.evaluate(() => [...document.querySelectorAll('[data-v2-regler]')].map((x) => ({ o: x.getAttribute('data-v2-regler'), n: Number(x.getAttribute('data-v2-regler-n')), ouvert: x.getAttribute('data-v2-regler-ouvert') === '1', h: Math.round(x.getBoundingClientRect().height),
      rangees: [...x.querySelectorAll('[data-v2-regler-groupe]')].map((g) => ({ id: g.getAttribute('data-v2-regler-groupe'), bouton: !!(g.matches('button, a') || g.querySelector('button, a') || g.closest('button, a')), h: Math.round(g.getBoundingClientRect().height) })), tout: !!x.querySelector('[data-v2-regler-tout]') })));
    let r = await lire(); const v = r.find((x) => x.o === 'ventes'), a = r.find((x) => x.o === 'achats');
    dit(!!v && v.ouvert && v.n === 4 && v.rangees.length === 3 && v.tout && v.rangees[0].id === 'colis-limite', `R ${ou} : Ventes presse ⇒ ouvert, l’urgent d’abord, 3 rangées sur 4 puis « Tout voir »`, v);
    dit(!!a && !a.ouvert && a.n === 1 && a.rangees.length === 0 && a.h <= 60, `R ${ou} : Achats ne presse pas ⇒ replié en UNE ligne (${a && a.h} px)`, a);
    dit(!!v && v.rangees.every((x) => x.bouton && x.h >= 44), `R ${ou} : chaque rangée se touche (≥ 44)`, v && v.rangees);
    await pg.screenshot({ path: path.join(SHOTS, `a-regler-${W}-${th}.png`) });
    const toucher = (s) => (tel ? pg.locator(s).first().tap({ timeout: 5000 }) : pg.locator(s).first().click({ timeout: 5000 })).catch(() => {});
    await toucher('[data-v2-regler="ventes"] [data-v2-regler-tout]'); await pg.waitForTimeout(250); r = await lire();
    dit(r.find((x) => x.o === 'ventes').rangees.length === 4, `R ${ou} : « Tout voir » montre les 4`, r.find((x) => x.o === 'ventes').rangees.length);
    await toucher('[data-v2-regler="achats"] .n-groupe-repli'); await pg.waitForTimeout(250); r = await lire();
    dit(r.find((x) => x.o === 'achats').ouvert && r.find((x) => x.o === 'achats').rangees.length === 1, `R ${ou} : un toucher sur « À régler » l’ouvre`, r.find((x) => x.o === 'achats'));
    const c = await contrastes(pg, '.n-page, [data-v2-regler]');
    dit(c.juges > 6 && !c.faibles.length, `D5 ${ou} : ${c.juges} textes ≥ 4,5:1 sur leur fond RENDU (min ${c.min})`, c.faibles ? c.faibles.slice(0, 5) : c);
    const d = await pg.evaluate(() => ({ deborde: Math.max(0, document.documentElement.scrollWidth - innerWidth) }));
    dit(d.deborde <= 1 && !erreurs.length, `R ${ou} : rien ne déborde, aucune erreur JS`, { ...d, erreurs });
    await pg.screenshot({ path: path.join(SHOTS, `a-regler-ouvert-${W}-${th}.png`) });
  } catch (e) { dit(false, `${ou} : le contrôle est allé au bout`, String(e && e.stack || e).slice(0, 500)); }
  await ctx.close();
}

(async () => {
  try { construire(); } catch (e) { dit(false, 'l’écran se construit (esbuild)', String(e.message || e).slice(0, 600)); process.exit(1); }
  // La source : un écran natif n'écrit ni style en ligne ni `!important`, et ne rend plus « À faire ».
  const src = ['src/natif/ecrans/Aujourdhui.jsx', 'src/designV2/ARegler.jsx'].map((f) => fs.readFileSync(path.join(RACINE, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')).join('\n');
  dit(!/style=\{|!important|v2-afaire|data-v2-job/.test(src), 'N la source : ni `style={`, ni `!important`, ni rangée « À faire » dans l’écran et dans « À régler »');
  const css = fs.readFileSync(path.join(RACINE, 'src', 'natif', 'complements.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  dit(!/!important|:has\(|#[0-9a-fA-F]{3,8}\b|gradient/.test(css), 'N complements.css : ni `!important`, ni `:has()`, ni couleur en dur, ni dégradé');
  const s = await servir(); const port = s.address().port;
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const base of BASES) for (const W of LARGEURS) for (const t of THEMES) await unEcran(nav, port, base, W, t === 'sombre');
    if (!MUT && !process.env.SANS_REGLER) for (const W of LARGEURS) for (const t of THEMES) await regler(nav, port, W, t === 'sombre');
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 900)); }
  await nav.close(); s.close();
  console.log(`\n${ko ? '❌' : '✅'} aujourdhui-natif${MUT ? ' [MUTATION=' + MUT + ']' : ''} : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
