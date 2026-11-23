// ════════════════════════════════════════════════════════════════════════════
//  BANC — LE CONSEILLER (23 nov.). docs/passation/2026-11-23-conseiller.md
//  Les VRAIS composants et les VRAIES règles montés par outils/natif-conseiller/ecran.jsx (esbuild, hors du paquet de
//  prod) sur des données INVENTÉES. 390 × 844 tactile et 1512 × 900 ; clair et sombre ; bases `lu` et `vide`.
//    K1 la carte d'Aujourd'hui : 3 conseils au plus, les PREMIERS de la règle, dans son ordre ; « Tout voir » ;
//    K2 sans données suffisantes : AUCUNE carte (jamais une carte vide) ; l'écran dit « rien à conseiller » ;
//    K3 l'écran : tous les conseils, chacun son geste ; toucher le geste rend LE geste de la règle (rien d'autre) ;
//    K4 les chiffres affichés = ceux de la règle (data-cons-chiffres recopie la règle, le texte porte ses nombres) ;
//    K5 aucune requête vers /api/ai sans SA clé (l'écran charge, rien ne part) ;
//    K6 ambre seulement pour une limite aujourd'hui ; K7 la phrase du jour ; K8 deux colonnes à 1512, une à 390 ;
//    K9 les mini-visuels ; K10 les gestes en vrais boutons (règle commune) ; K11 « Pourquoi ? » ;
//    P  la présentation animée (premier passage, avance seule, « Passer », « Revoir », mouvement réduit) ;
//    N  aucun NaN / undefined / clé tr brute, aucun débordement horizontal, rangées ≥ 44 px, aucune erreur de page.
//  Mutations (`MUTATION=carte5|cartevide|ambre|colonne|boutontexte|pourquoi|presauto|orange|jauge`) appliquées à la SOURCE : chacune rougit sa mesure. `SHOTS=dossier`.
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
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-conseiller'); fs.mkdirSync(SHOTS, { recursive: true });
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'natif-conseiller-'));
const MUT = process.env.MUTATION || '';
const MUTS = {
  carte5: ['src/conseiller/regles.js', 'export const MAX_CARTE = 3;', 'export const MAX_CARTE = 5;'],
  ambre: ['src/conseiller/regles.js', "id: 'offres', ton: 'neutre'", "id: 'offres', ton: 'aujourdhui'"],
  colonne: ['src/conseiller/Conseiller.jsx', "<Colonne>{groupe('faire')}{groupe('savoir')}</Colonne>\n        <Colonne>{groupe('gagner')}</Colonne>", "<Colonne pleine>{groupe('faire')}{groupe('savoir')}{groupe('gagner')}</Colonne>"],
  jauge: ['src/conseiller/Conseiller.jsx', 'width={pct} height="8" rx="4" data-cons-plein=""', 'width={pct / 6} height="8" rx="4" data-cons-plein=""'],
  pourquoi: ['src/conseiller/Conseiller.jsx', "{ouvert ? <div className=\"n-cons-explication\"", "{false ? <div className=\"n-cons-explication\""],
  presauto: ['src/conseiller/Presentation.jsx', "if (!ouverte || reduit || k >= ETAPES.length - 1) return undefined;", "if (!ouverte || k >= ETAPES.length - 1) return undefined;"],
  orange: ['src/conseiller/Conseiller.jsx', "<Pastille ton=\"accent\">", "<Pastille ton=\"ambre\">"],
  boutontexte: ['src/conseiller/Conseiller.jsx', "<Bouton variante=\"teinte\" icone={Icon ? <Icon name={ICONE_GESTE[c.geste] || 'check'} size={18}/> : null}", "<Bouton variante=\"texte\" icone={null}"],
  tropdetexte: ['src/conseiller/Conseiller.jsx', "<Rangee icone={icone} titre={t.titre} lignes={2} ton=\"neutre\" pastille={pastille} attrs={attrs}", "<Rangee icone={icone} titre={t.titre} sousTitre={t.preuve} lignes={2} ton=\"neutre\" pastille={pastille} attrs={attrs}"],
  cartevide: ['src/conseiller/Conseiller.jsx', "  if (!Array.isArray(liste) || !liste.length) return null;\n  const L = pourCarte(liste);", '  const L = pourCarte(liste || []);'],
};
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  const mu = MUT ? MUTS[MUT] : null;
  const plugins = mu ? [{ name: 'mutant', setup(b) { b.onLoad({ filter: /\.(jsx?)$/ }, (a) => { if (path.resolve(a.path) !== path.join(RACINE, mu[0])) return undefined; const t = fs.readFileSync(a.path, 'utf8'); if (!t.includes(mu[1])) throw new Error('motif de mutation absent'); return { contents: t.replace(mu[1], mu[2]), loader: 'jsx' }; }); } }] : [];
  return esbuild.build({ entryPoints: [path.join(RACINE, 'outils', 'natif-conseiller', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'vrm-icones-app': gen }, external: ['/brands/*'], nodePaths: [NM], logLevel: 'error', plugins })
    .then(() => fs.copyFileSync(path.join(RACINE, 'outils', 'natif-conseiller', 'index.html'), path.join(DOSSIER, 'index.html')));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = () => new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }); s.listen(Number(process.env.BANC_PORT) || 0, () => res(s)); });

// Le réseau d'essai : la clé du vendeur (aucune · posée) et la route de l'IA, comptées.
async function ouvrir(nav, port, { W, sombre, base, vue, cle = 'aucune', pres = false, reduit = false }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: W, height: 900 } }), deviceScaleFactor: 1, colorScheme: sombre ? 'dark' : 'light', reducedMotion: reduit ? 'reduce' : 'no-preference', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  const appelsIA = [];
  await pg.route('**/api/compte?mode=claude', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cle === 'posee' ? { ok: true, etat: 'posee', fin: 'a1b2' } : { ok: true, etat: 'aucune' }) }));
  await pg.route('**/api/ai**', (r) => { appelsIA.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, reponse: 'Baisse d’abord les 5 paires conseillées : elles dorment depuis plus de 30 jours.', chiffres: [{ libelle: 'Baisses conseillées', valeur: '5' }], geste: 'baisses', cout: 0.00041 }) }); });
  await pg.goto(`http://localhost:${port}/?vue=${vue}&base=${base}${sombre ? '&theme=dark' : ''}${pres ? '&pres=1' : ''}`, { waitUntil: 'load' });
  await pg.waitForSelector('.n-coque, [data-cons-ecran], [data-banc-carte]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(600);
  return { ctx, pg, erreurs, tel, appelsIA };
}
const NATIF = () => {
  const txt = document.body.innerText;
  const rangees = [...document.querySelectorAll('[data-cons]')].map((x) => x.getBoundingClientRect().height);
  return { nan: /NaN|undefined|\bcons\.[a-z]|\bia\.[a-z]/.test(txt), deborde: document.documentElement.scrollWidth > innerWidth + 1, petites: rangees.filter((h) => h < 44).length };
};

async function passe(nav, port, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `${W} ${th}`;
  // K1 — la carte, base lue.
  let A = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'carte' });
  try {
    const r = await A.pg.evaluate(() => ({ L: window.__CONSEILS.map((c) => ({ id: c.id, geste: c.geste, chiffres: JSON.stringify(c.chiffres) })), ids: [...document.querySelectorAll('[data-banc-carte] [data-cons]')].map((x) => x.getAttribute('data-cons')),
      n: (document.querySelector('[data-v2-bloc="conseils"]') || { getAttribute: () => '' }).getAttribute('data-cons-n'), tout: !!document.querySelector('[data-cons-tout]') }));
    dit(r.L.length >= 5 && r.ids.length === 3 && r.ids.join() === r.L.slice(0, 3).map((x) => x.id).join() && r.n === String(r.L.length) && r.tout,
      `K1 ${ou} : la carte montre les 3 PREMIERS conseils de la règle (${r.ids.join(', ')}) sur ${r.L.length}, et « Tout voir »`, r);
    await A.pg.screenshot({ path: path.join(SHOTS, `carte-${W}-${th}.png`), fullPage: true });
    const n = await A.pg.evaluate(NATIF); dit(!n.nan && !n.deborde && !n.petites, `N ${ou} carte : ni NaN ni clé brute, aucun débordement, rangées ≥ 44`, n);
    dit(!A.erreurs.length, `${ou} carte : aucune erreur de page`, A.erreurs);
  } finally { await A.ctx.close(); }
  // K2 — sans données : aucune carte ; l'écran le dit.
  A = await ouvrir(nav, port, { W, sombre, base: 'vide', vue: 'carte' });
  try {
    const r = await A.pg.evaluate(() => ({ L: window.__CONSEILS.length, carte: !!document.querySelector('[data-v2-bloc="conseils"]') }));
    dit(r.L === 0 && !r.carte, `K2 ${ou} : rien de lu ⇒ aucun conseil, AUCUNE carte (jamais une carte vide)`, r);
  } finally { await A.ctx.close(); }
  A = await ouvrir(nav, port, { W, sombre, base: 'vide', vue: 'ecran' });
  try {
    const r = await A.pg.evaluate(() => ({ lignes: document.querySelectorAll('[data-cons]').length, vide: /Rien à te conseiller/.test(document.body.innerText) }));
    dit(r.lignes === 0 && r.vide, `K2 ${ou} : l'écran dit « Rien à te conseiller aujourd’hui », aucune ligne`, r);
    dit(A.appelsIA.length === 0, `K5 ${ou} : écran vide, aucune requête IA`, A.appelsIA.length);
    await A.pg.screenshot({ path: path.join(SHOTS, `ecran-vide-${W}-${th}.png`), fullPage: true });
  } finally { await A.ctx.close(); }
  // K3/K4 — l'écran, base lue.
  A = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'ecran' });
  try {
    const r = await A.pg.evaluate(() => ({ L: (() => { const G = { faire: [], gagner: [], savoir: [] }; const CAT = { colis: 'faire', offres: 'faire', prix: 'faire', baisses: 'gagner', racheter: 'gagner', rapporte: 'gagner', dorment: 'gagner', seuil: 'savoir', jour: 'savoir', compte: 'savoir' };
        for (const c of window.__CONSEILS) G[CAT[c.id]].push(c); return [...G.faire, ...G.savoir, ...G.gagner]; })().map((c) => ({ id: c.id, geste: c.geste, chiffres: JSON.stringify(c.chiffres || {}), params: c.params })),
      lignes: [...document.querySelectorAll('[data-cons]')].map((x) => ({ id: x.getAttribute('data-cons'), chiffres: x.getAttribute('data-cons-chiffres'), texte: x.innerText, bouton: !!x.querySelector('[data-cons-bouton]') })) }));
    dit(r.lignes.length === r.L.length && r.lignes.every((x, i) => x.id === r.L[i].id && x.bouton), `K3 ${ou} : l'écran montre les ${r.L.length} conseils, groupés (à faire · à savoir · pour gagner plus), chacun son bouton`, r.lignes.map((x) => x.id));
    const nombres = r.lignes.every((x, i) => x.chiffres === r.L[i].chiffres && (!['colis', 'offres', 'baisses', 'prix', 'dorment'].includes(r.L[i].id) || x.texte.includes(String(r.L[i].params.n))));
    dit(nombres, `K4 ${ou} : chaque chiffre affiché = celui de la règle (attribut, et le nombre du titre)`, r.lignes.map((x, i) => [x.id, x.chiffres === r.L[i].chiffres, r.L[i].params.n]));
    // K6 — §7 : l'ambre seulement pour une limite aujourd'hui (le colis du jour) ; K7 — la phrase du jour ; K8 — deux colonnes à
    // l'ordinateur, une au téléphone ; K9 — les mini-visuels ; K10 — les boutons du geste à la règle commune (pas du texte nu).
    const m = await A.pg.evaluate(() => {
      const ambres = [...document.querySelectorAll('[data-cons][data-cons-ton="aujourdhui"]')].map((x) => x.getAttribute('data-cons'));
      const orange = document.querySelectorAll('[data-cons-ecran] [data-n-ton="ambre"], [data-cons-ecran] [data-n-ton="ambre-plein"]').length;
      const pastAuj = [...document.querySelectorAll('[data-cons][data-cons-ton="aujourdhui"] .n-pastille[data-n-ton="accent"]')].length;
      const gras = [...document.querySelectorAll('[data-cons][data-cons-ton="aujourdhui"] .n-rangee-titre')].map((t) => Number(getComputedStyle(t).fontWeight));
      const syn = JSON.parse(document.querySelector('[data-cons-ecran]').getAttribute('data-cons-synthese') || '{}');
      const phrase = (document.querySelector('.n-cons-phrase') || {}).innerText || '';
      const box = (k) => { const g = document.querySelector(`[data-cons-groupe="${k}"]`); if (!g) return null; const b = g.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width) }; };
      const vis = Object.fromEntries([...document.querySelectorAll('[data-cons]')].map((x) => [x.getAttribute('data-cons'), (x.querySelector('[data-cons-visuel]') || { getAttribute: () => '' }).getAttribute('data-cons-visuel')]));
      const boutons = [...document.querySelectorAll('[data-cons-bouton]')].map((b) => ({ cls: b.className, v: b.getAttribute('data-n-variante'), ic: !!b.querySelector('.n-bouton-icone svg'), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) }));
      const texteSous = [...document.querySelectorAll('[data-cons] .n-rangee-sous-texte')].length;
      return { texteSous, ambres, orange, pastAuj, gras, syn, phrase, faire: box('faire'), gagner: box('gagner'), savoir: box('savoir'), vis, boutons };
    });
    dit(m.ambres.join() === 'colis' && m.orange === 0 && m.pastAuj === 1 && m.gras.every((w) => w >= 700), `K6 ${ou} : AUCUN orange ; « aujourd'hui » (le seul colis du jour) = titre en gras + pastille d'accent`, { a: m.ambres, o: m.orange, p: m.pastAuj, g: m.gras });
    dit(m.syn.faire === r.L.filter((x) => ['colis', 'offres', 'prix'].includes(x.id)).length && m.phrase.includes(String(m.syn.faire)) && m.syn.sommeOffres === 130 && /130/.test(m.phrase),
      `K7 ${ou} : la phrase du jour dit ${m.syn.faire} gestes et les 130 € d'offres (la somme publiée)`, { syn: m.syn, phrase: m.phrase });
    const deux = m.faire && m.gagner && m.gagner.x > m.faire.x + 100 && Math.abs(m.gagner.y - m.faire.y) < 40;
    const une = m.faire && m.gagner && Math.abs(m.gagner.x - m.faire.x) < 4 && m.gagner.y > m.faire.y;
    dit(W >= 1024 ? deux : une, `K8 ${ou} : ${W >= 1024 ? 'deux colonnes (à faire | pour gagner plus côte à côte)' : 'une colonne'}`, m);
    // K12 (23 nov., coordinateur) — chaque jauge est remplie à la VRAIE proportion (± 3 %), sur une largeur utile (≥ 40 % de la
    // rangée), et dit ce qu'elle mesure ; la comparaison des comptes : deux barres légendées (nom + ventes).
    const jauges = await A.pg.evaluate(() => [...document.querySelectorAll('[data-cons] [data-cons-visuel="barre"]')].filter((b) => !b.closest('.n-cons-anime')).map((b) => {
      const svg = b.querySelector('svg'), plein = b.querySelector('[data-cons-plein]'), rangee = b.closest('[data-cons]');
      const ws = svg ? svg.getBoundingClientRect().width : 0, wp = plein ? plein.getBoundingClientRect().width : 0;
      return { id: rangee.getAttribute('data-cons'), pct: Number(b.getAttribute('data-cons-pct')), rempli: ws ? Math.round((wp / ws) * 1000) / 10 : 0, piste: Math.round(ws), rangee: Math.round(rangee.getBoundingClientRect().width),
        libelle: (b.querySelector('.n-cons-barre-libelle') || {}).innerText || '' };
    }));
    const duo = await A.pg.evaluate(() => { const d = document.querySelector('[data-cons] [data-cons-visuel="duo"]'); if (!d) return null;
      return { legendes: [...d.querySelectorAll('.n-cons-duo-legende')].map((x) => x.innerText.replace(/\s+/g, ' ')), lignes: d.querySelectorAll('.n-cons-duo-ligne').length }; });
    const okJ = jauges.length >= 2 && jauges.every((j) => Math.abs(j.rempli - j.pct) <= 3 && j.piste >= 0.4 * j.rangee && j.libelle.includes(String(j.pct)) && j.libelle.length > String(j.pct).length + 4);
    dit(okJ, `K12 ${ou} : les jauges (prix, seuil) remplies à la vraie proportion ± 3 %, sur la largeur utile, avec ce qu'elles mesurent`, jauges);
    dit(!!duo && duo.lignes === 2 && duo.legendes.every((x) => /\d/.test(x) && x.length > 6), `K12 ${ou} : la comparaison des comptes = deux barres légendées (compte, ventes en 30 j)`, duo);
    dit(m.vis.colis === 'plaques' && m.vis.offres === 'photos' && m.vis.baisses === 'photos' && m.vis.seuil === 'barre' && m.vis.prix === 'barre' && (!m.vis.compte || m.vis.compte === 'duo'),
      `K9 ${ou} : mini-visuels (N° des colis, photos des offres et des baisses, barres du seuil et des prix, comptes)`, m.vis);
    dit(m.boutons.length === r.L.length && m.boutons.every((b) => /n-bouton/.test(b.cls) && b.v === 'teinte' && b.ic && b.h >= 30 && b.w < 220) && m.texteSous === 0, `K10 ${ou} : UN beau bouton par conseil (icône + verbe, règle commune) ; aucun texte sous le titre (la preuve est sous « Pourquoi ? »)`, m.boutons.slice(0, 3));
    // K11 — « Pourquoi ? » déplie l'explication de la règle (et son visuel animé), « Replier » la range.
    await A.pg.click('[data-cons-pourquoi="seuil"]');
    const pq = await A.pg.evaluate(() => { const b = document.querySelector('[data-cons-pourquoi="seuil"]'), e = document.querySelector('[data-cons-explication="seuil"]');
      return { exp: b && b.getAttribute('aria-expanded'), texte: e ? e.innerText.length : 0, anime: !!(e && e.querySelector('.n-cons-anime [data-cons-visuel="barre"]')) }; });
    dit(pq.exp === 'true' && pq.texte > 60 && pq.anime, `K11 ${ou} : « Pourquoi ? » déplie l'explication de la règle et son visuel animé`, pq);
    await A.pg.screenshot({ path: path.join(SHOTS, `ecran-pourquoi-${W}-${th}.png`), fullPage: true });
    await A.pg.click('[data-cons-pourquoi="seuil"]');
    await A.pg.locator('[data-cons-bouton]').nth(1).click();
    const g = await A.pg.evaluate(() => window.__GESTES.slice());
    dit(g.length === 1 && g[0] === r.L[1].geste, `K3 ${ou} : toucher le 2e conseil rend SON geste (« ${r.L[1].geste} »), rien d'autre`, g);
    dit(A.appelsIA.length === 0, `K5 ${ou} : sans SA clé, l'écran charge et aucune requête IA ne part`, A.appelsIA.length);
    await A.pg.screenshot({ path: path.join(SHOTS, `ecran-${W}-${th}.png`), fullPage: true });
    const n = await A.pg.evaluate(NATIF); dit(!n.nan && !n.deborde && !n.petites, `N ${ou} écran : ni NaN ni clé brute, aucun débordement, rangées ≥ 44`, n);
    dit(!A.erreurs.length, `${ou} écran : aucune erreur de page`, A.erreurs);
  } finally { await A.ctx.close(); }
  // P — la présentation animée : au premier passage, 4 étapes qui avancent seules (~4,5 s), « Passer » la range et la note ;
  // mouvement réduit : aucune animation, aucun défilement automatique.
  A = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'ecran', pres: true });
  try {
    await A.pg.waitForSelector('[data-pres]', { timeout: 5000 }).catch(() => {});
    const e1 = await A.pg.evaluate(() => ({ e: (document.querySelector('[data-pres]') || { getAttribute: () => '' }).getAttribute('data-pres'), anim: getComputedStyle(document.querySelector('.n-pres-ligne') || document.body).animationName }));
    await A.pg.screenshot({ path: path.join(SHOTS, `presentation-1-${W}-${th}.png`) });
    await A.pg.waitForTimeout(4900);
    const e2 = await A.pg.evaluate(() => (document.querySelector('[data-pres]') || { getAttribute: () => '' }).getAttribute('data-pres'));
    await A.pg.screenshot({ path: path.join(SHOTS, `presentation-2-${W}-${th}.png`) });
    dit(e1.e === 'conseil' && e1.anim !== 'none' && e2 === 'source', `P1 ${ou} : la présentation s'ouvre au premier passage, animée, et passe seule à l'étape 2`, { e1, e2 });
    await A.pg.click('[data-pres-passer]');
    await A.pg.waitForTimeout(600);
    const fin = await A.pg.evaluate(() => ({ ouverte: !!document.querySelector('[data-pres]'), vu: !!localStorage.getItem('vrm_conseiller_presentation_vue') }));
    dit(!fin.ouverte && fin.vu, `P2 ${ou} : « Passer » la range et la note (elle ne revient pas toute seule)`, fin);
    await A.pg.click('[data-pres-revoir]');
    await A.pg.waitForSelector('[data-pres]', { timeout: 3000 }).catch(() => {});
    dit(await A.pg.evaluate(() => !!document.querySelector('[data-pres="conseil"]')), `P2 ${ou} : « Revoir la présentation » la rouvre au début`);
    dit(!A.erreurs.length, `${ou} présentation : aucune erreur de page`, A.erreurs);
  } finally { await A.ctx.close(); }
  if (W < 600 && !sombre) {
    A = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'ecran', pres: true, reduit: true });
    try {
      await A.pg.waitForSelector('[data-pres]', { timeout: 5000 }).catch(() => {});
      const r1 = await A.pg.evaluate(() => ({ red: (document.querySelector('[data-pres]') || { getAttribute: () => '' }).getAttribute('data-pres-reduit'), anim: getComputedStyle(document.querySelector('.n-pres-ligne') || document.body).animationName }));
      await A.pg.waitForTimeout(4900);
      const e = await A.pg.evaluate(() => (document.querySelector('[data-pres]') || { getAttribute: () => '' }).getAttribute('data-pres'));
      dit(r1.red === '1' && r1.anim === 'none' && e === 'conseil', `P3 ${ou} : mouvement réduit — aucune animation, aucun défilement automatique`, { r1, e });
      await A.pg.click('[data-pres-suivant]');
      dit(await A.pg.evaluate(() => (document.querySelector('[data-pres]') || { getAttribute: () => '' }).getAttribute('data-pres')) === 'source', `P3 ${ou} : il avance à son rythme (« Suivant »)`);
    } finally { await A.ctx.close(); }
  }
  if (typeof global.passeIA === 'function') await global.passeIA({ nav, port, W, sombre, ou, th, ouvrir, dit, SHOTS });
}

(async () => {
  try { await construire(); } catch (e) { dit(false, 'les écrans se construisent (esbuild)', String(e.message || e).slice(0, 600)); process.exit(1); }
  try { require(path.join(__dirname, '_conseiller-ia.cjs')); } catch (_) { /* tranche 2 absente */ }
  const s = await servir(); const port = s.address().port;
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try { for (const W of LARGEURS) for (const th of THEMES) await passe(nav, port, W, th === 'sombre'); }
  finally { await nav.close(); s.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc conseiller${MUT ? ' [MUTATION=' + MUT + ']' : ''} : ${ok} verts, ${ko} rouge(s) · captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
