// ════════════════════════════════════════════════════════════════════════════
//  BANC — MA JOURNÉE COURTE ET STATISTIQUES · PILOTAGE ET FINANCES (21 nov., lot journee-stats).
//  Les VRAIS écrans et les VRAIES règles montés par outils/natif-journee-stats/ecran.jsx (esbuild, hors du paquet de prod)
//  sur des données INVENTÉES. 390 × 844 tactile et 1512 × 900 ; clair et sombre ; bases `lu`, `attente`, `vide`.
//    J1 Ma journée est courte : par défaut « Colis » (à envoyer · à retirer) EN HAUT, puis les chiffres, puis les dernières
//       ventes — rien d'autre ; le lien « Toutes les statistiques » mène à Statistiques ;
//    J2 le bénéfice BRUT et NET, aujourd'hui ET le mois, sans activation : les tuiles portent les nombres de la règle
//       (`statsPeriodes` : brut = `brut`, net = `benefice` du propriétaire), recomptés ICI depuis les ventes inventées ;
//    J3 aucun saut : « Colis » et les chiffres ont la MÊME place et la MÊME hauteur en lecture et une fois lus ;
//    S1 Statistiques : deux segments (Pilotage · Finances), trois périodes (7 · 30 · 90 j) ; les cartes de chaque segment ;
//    S2 les nombres de la vue = ceux recomptés ICI depuis les mêmes ventes / le même journal (CA, ventes, panier, gestes,
//       messages aux favoris, barres) — une source, rien d'inventé ;
//    S3 aucun saut : la barre des segments et chaque carte de Pilotage ont la même place en lecture et lues ;
//       « Activité quotidienne » : N barres pour N jours (7, 30, 90) ;
//    N  natif partout : jamais une carte dans une carte, aucun débordement horizontal, cibles des rangées ≥ 44 px,
//       aucun « NaN » ni « undefined » ; base vide : « — » ou 0, jamais NaN.
//  Mutations (`MUTATION=empile|saut|brut|transp`), injectées dans la page : chacune rougit SA mesure. `SHOTS=dossier` (les
//  captures se REGARDENT), `LARGEURS`, `THEMES`. Doit être ROUGE sur le code d'avant (aucune de ces cartes n'existait).
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
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-journee-stats'); fs.mkdirSync(SHOTS, { recursive: true });
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'natif-journee-stats-'));
const MUT = process.env.MUTATION || '';
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 500) : '')); } return c; };

function construire() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const m = app.match(/const ICON_PATHS = \{[\s\S]*?\n\};/); if (!m) throw new Error('ICON_PATHS introuvable');
  const gen = path.join(DOSSIER, 'icones-app.gen.jsx'); fs.writeFileSync(gen, "import React from 'react';\nexport " + m[0] + '\n');
  esbuild.buildSync({ entryPoints: [path.join(RACINE, 'outils', 'natif-journee-stats', 'ecran.jsx')], bundle: true, outfile: path.join(DOSSIER, 'ecran.js'),
    loader: { '.jsx': 'jsx', '.js': 'jsx', '.woff2': 'file', '.woff': 'file' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, alias: { 'vrm-icones-app': gen }, external: ['/brands/*'], nodePaths: [NM], logLevel: 'error' });
  fs.copyFileSync(path.join(RACINE, 'outils', 'natif-journee-stats', 'index.html'), path.join(DOSSIER, 'index.html'));
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const servir = () => new Promise((res) => { const s = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(DOSSIER, u === '/' ? 'index.html' : u.replace(/^\/+/, ''));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }); s.listen(Number(process.env.BANC_PORT) || 0, () => res(s)); });

async function ouvrir(nav, port, { W, sombre, base, vue, extra = '' }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: W, height: 900 } }), deviceScaleFactor: 1, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
  await pg.goto(`http://localhost:${port}/?vue=${vue}&base=${base}${sombre ? '&theme=dark' : ''}${extra}`, { waitUntil: 'load' });
  await pg.waitForSelector(vue === 'stats' ? '[data-ps]' : '[data-v2-ecran="aujourdhui"]', { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(500);
  if (MUT === 'empile') await pg.evaluate(() => { const a = document.querySelector('.n-carte'), b = document.querySelectorAll('.n-carte')[1]; if (a && b) a.appendChild(b.cloneNode(true)); });
  if (MUT === 'saut' && base === 'lu') await pg.addStyleTag({ content: '[data-v2-bloc="colis"], [data-ps-bloc="fait"] { margin-top: 40px; }' });
  // (21 nov.) Transporteurs : un délai faussé et l'« inconnu » retiré ⇒ T2 et T4 rougissent.
  if (MUT === 'transp') await pg.evaluate(() => { const t = document.querySelector('[data-pt-bloc="ventes"] [data-pt-ligne="mondialrelay"]'); if (t) t.setAttribute('data-pt-depot', '9');
    const i = document.querySelector('[data-pt-bloc="ventes"] [data-pt-ligne="pas-lu"]'); if (i) i.remove(); });
  if (MUT === 'brut') await pg.evaluate(() => { const t = document.querySelector('[data-v2-stat="brut"]'); if (t) t.setAttribute('data-benef-valeur', String(Number(t.getAttribute('data-benef-valeur') || 0) + 100)); });
  return { ctx, pg, erreurs, tel };
}
const NATIF = () => {
  const vis = (x) => x.getClientRects().length > 0;
  const cartes = [...document.querySelectorAll('.n-carte')].filter(vis);
  const empilees = cartes.filter((c) => c.parentElement && c.parentElement.closest('.n-carte')).length;
  const deborde = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const petites = [...document.querySelectorAll('[data-v2-cj-ligne], [data-ps] .n-rangee')].filter(vis).map((x) => (x.matches('button, a, [role="button"]') ? x : x.querySelector('button, a, [role="button"]') || x))
    .map((x) => x.getBoundingClientRect().height).filter((h) => h > 0 && h < 44).length;
  const texte = document.body.innerText;
  return { empilees, deborde, petites, nan: /NaN|undefined|Infinity/.test(texte) };
};
const BOITES = (sel) => [...document.querySelectorAll(sel)].map((x) => { const r = x.getBoundingClientRect(); return { k: x.getAttribute('data-v2-bloc') || x.getAttribute('data-ps-bloc') || x.className, top: Math.round(r.top + scrollY), h: Math.round(r.height) }; });

async function journee(nav, port, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `Ma journée · ${W} · ${th}`;
  console.log(`\n── ${ou}`);
  const A = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'journee' });
  try {
    await A.pg.screenshot({ path: path.join(SHOTS, `journee-lu-${W}-${th}.png`), fullPage: true });
    const w = await A.pg.evaluate(() => {
      const e = document.querySelector('[data-v2-ecran="aujourdhui"]');
      const blocs = [...document.querySelectorAll('[data-v2-bloc]')].map((x) => x.getAttribute('data-v2-bloc'));
      const t = (k) => { const x = document.querySelector(`[data-v2-stat="${k}"]`); return x ? x.getAttribute('data-benef-valeur') : null; };
      const seg = [...document.querySelectorAll('[data-v2-bloc="chiffres"] [role="radio"], [data-v2-bloc="chiffres"] button[aria-pressed], [data-v2-bloc="chiffres"] [role="tab"]')].length;
      return { cartes: e ? e.getAttribute('data-v2-cartes') : '', blocs, brut: t('brut'), net: t('net'), stats: window.__STATS, lignes: window.__LIGNES, M0: (() => { const d = new Date(window.__MAINTENANT); d.setHours(0, 0, 0, 0); return d.getTime(); })(),
        vers: !!document.querySelector('[data-v2-vers-stats]'), cj: [...document.querySelectorAll('[data-v2-cj-ligne]')].map((x) => x.getAttribute('data-v2-cj-ligne') + ':' + x.getAttribute('data-v2-cj-n')), seg };
    });
    dit(w.cartes === 'colis,chiffres,ventes' && w.blocs[0] === 'colis' && w.vers, `J1 ${ou} : par défaut « Colis » en haut, les chiffres, les dernières ventes — rien d’autre ; « Toutes les statistiques » en bas`, { cartes: w.cartes, blocs: w.blocs });
    dit(w.cj.join() === 'envoyer:6,retirer:3', `J1b ${ou} : « Colis » dit à envoyer 6 · à retirer 3, chacun sa rangée`, w.cj);
    // J2 : le brut et le net du jour, recomptés ICI depuis les ventes inventées (règle du faux propriétaire = celle de la fixture).
    const du = w.lignes.filter((x) => x.ts >= w.M0 && x.ts < w.M0 + 86400000);
    const c = du.filter((x) => x.achat != null);
    const brutJ = c.length ? Math.round(c.reduce((t, x) => t + (x.eur - x.achat) * 100, 0)) : (du.length ? '' : 0);
    const netJ = du.length && c.length === du.length ? Math.round(c.reduce((t, x) => t + (x.eur - x.achat) * 0.876 * 100, 0)) : '';
    dit(String(w.brut) === String(brutJ) && String(w.net) === String(netJ) && w.stats.jour.brut.valeur != null,
      `J2 ${ou} : aujourd’hui, bénéfice brut ${brutJ / 100} € et net ${netJ === '' ? '—' : netJ / 100 + ' €'} : les nombres de la règle, sans activation`, { vue: [w.brut, w.net], attendu: [brutJ, netJ] });
    await A.pg.locator('[data-v2-bloc="chiffres"] .n-segmente-choix').nth(1).click();
    await A.pg.waitForTimeout(250);
    const m = await A.pg.evaluate(() => { const t = (k) => { const x = document.querySelector(`[data-v2-stat="${k}"]`); return x ? x.getAttribute('data-benef-valeur') : null; };
      return { p: document.querySelector('[data-v2-bloc="chiffres"]').getAttribute('data-v2-periode'), brut: t('brut'), net: t('net'), S: window.__STATS.mois }; });
    const cents = (x) => (x == null ? '' : String(Math.round(x * 100)));
    dit(m.p === 'mois' && m.brut === cents(m.S.brut.valeur) && m.net === cents(m.S.net.valeur), `J2b ${ou} : le mois, brut et net de la même règle (segment Aujourd’hui · Mois)`, m);
    await A.pg.screenshot({ path: path.join(SHOTS, `journee-mois-${W}-${th}.png`) });
    const n = await A.pg.evaluate(NATIF);
    dit(!n.empilees && !n.deborde && !n.petites && !n.nan, `N ${ou} : aucune carte dans une carte, aucun débordement, cibles ≥ 44, ni NaN`, n);
    dit(!A.erreurs.length, `${ou} : aucune erreur de page`, A.erreurs);
    // J3 : la même place en lecture et lu.
    const avant = await ouvrir(nav, port, { W, sombre, base: 'attente', vue: 'journee' });
    await avant.pg.screenshot({ path: path.join(SHOTS, `journee-attente-${W}-${th}.png`) });
    const b0 = await avant.pg.evaluate(BOITES, '[data-v2-bloc="colis"], [data-v2-bloc="chiffres"]');
    await avant.ctx.close();
    const A2 = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'journee' });
    const b1 = await A2.pg.evaluate(BOITES, '[data-v2-bloc="colis"], [data-v2-bloc="chiffres"]');
    await A2.ctx.close();
    dit(b0.length === 2 && JSON.stringify(b0) === JSON.stringify(b1), `J3 ${ou} : « Colis » et les chiffres ont la même place et la même hauteur en lecture et lus (rien ne saute)`, { attente: b0, lu: b1 });
  } finally { await A.ctx.close(); }
}

async function stats(nav, port, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `Statistiques · ${W} · ${th}`;
  console.log(`\n── ${ou}`);
  const A = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'stats' });
  try {
    await A.pg.screenshot({ path: path.join(SHOTS, `stats-pilotage-${W}-${th}.png`), fullPage: true });
    const w = await A.pg.evaluate(() => {
      const blocs = [...document.querySelectorAll('[data-ps-bloc]')].map((x) => x.getAttribute('data-ps-bloc'));
      const a = (k) => { const x = document.querySelector(`[data-ps-${k}]`); return x ? x.getAttribute(`data-ps-${k}`) : null; };
      const segs = [...document.querySelectorAll('.n-ps-barre > *')].map((x) => x.querySelectorAll('button, [role="radio"]').length);
      return { blocs, segs, gestes: a('gestes'), auto: a('gestes-auto'), fav: a('fav-envoyes'), favV: a('fav-ventes'), autoN: a('auto'), autoSur: a('auto-sur'), barres: a('barres'), serieV: document.querySelector('[data-ps-serie="ventes"]').getAttribute('data-ps-serie-valeurs'),
        J: window.__JOURNAL, L: window.__LIGNES, T: window.__MAINTENANT };
    });
    dit(w.blocs.join() === 'dernier,fait,favoris,activite,comptes' && w.segs.join() === '3,3', `S1 ${ou} : Pilotage — dernier geste, ce que VRM fait, messages aux favoris, activité quotidienne, comptes ; 3 segments et 3 périodes`, { blocs: w.blocs, segs: w.segs });
    dit(w.autoN === '1' && w.autoSur === '3', `S1c ${ou} : « Automatisations actives · 1 sur 3 » (la valeur passée, dite telle quelle)`, [w.autoN, w.autoSur]);
    // S2 : recompté ICI depuis le journal et les ventes inventés (30 jours, aujourd'hui compris).
    const { deMs, finMs } = await A.pg.evaluate(() => { const fin = new Date(window.__MAINTENANT); fin.setHours(0, 0, 0, 0); fin.setDate(fin.getDate() + 1); const de = new Date(fin); de.setDate(de.getDate() - 30); return { deMs: de.getTime(), finMs: fin.getTime() }; });
    const de = new Date(deMs), fin = new Date(finMs);
    const VRM = ['baisse_prix', 'favori', 'favori_offre', 'offre_acceptee', 'republication', 'bordereau', 'message_envoye', 'offre_faite'];
    const g = w.J.filter((e) => e.resultat === 'ok' && VRM.includes(e.type) && e.at >= de.getTime() && e.at < fin.getTime());
    const fav = g.filter((e) => e.type === 'favori' || e.type === 'favori_offre');
    dit(w.gestes === String(g.length) && w.auto === String(g.filter((e) => e.auto).length) && w.fav === String(fav.length),
      `S2 ${ou} : ${g.length} gestes acceptés sur 30 j (dont ${g.filter((e) => e.auto).length} automatiques), ${fav.length} messages aux favoris — recomptés depuis le journal`, { vue: [w.gestes, w.auto, w.fav] });
    // Les jours se coupent à minuit DE LA PAGE (Europe/Paris) : recomptés dans la page, par un code à part (pas celui de l'app).
    const parJour = await A.pg.evaluate(() => { const L = window.__LIGNES; const fin = new Date(window.__MAINTENANT); fin.setHours(0, 0, 0, 0); fin.setDate(fin.getDate() + 1);
      const out = []; for (let k = 30; k >= 1; k--) { const d = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - k), f = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - k + 1); out.push(L.filter((x) => x.ts >= d.getTime() && x.ts < f.getTime()).length); } return out; });
    const echelle = await A.pg.evaluate(() => document.querySelector('[data-ps-serie="ventes"] [data-ps-echelle]').getAttribute('data-ps-echelle'));
    dit(echelle === String(Math.max(...parJour)), `S3c ${ou} : l’échelle de la série des ventes est dite (max ${Math.max(...parJour)}), avec le premier jour et aujourd’hui`, echelle);
    dit(w.barres === '30' && w.serieV === parJour.join(','), `S3 ${ou} : « Activité quotidienne » : 30 barres, les ventes de chaque jour recomptées`, { vue: w.serieV.slice(0, 60), attendu: parJour.join(',').slice(0, 60) });
    // Les vendues après un message : PAR IDENTITÉ (l'annonce du message = celle de la vente), dans les 14 jours.
    const premier = new Map(); for (const e of fav) if (e.cle && e.cle.item && (!premier.has(e.cle.item) || e.at < premier.get(e.cle.item))) premier.set(e.cle.item, e.at);
    const vendues = new Set(w.L.filter((l) => l.plateforme === 'Vinted' && premier.has(l.item) && l.ts >= premier.get(l.item) && l.ts <= premier.get(l.item) + 14 * 86400000).map((l) => l.item));
    dit(w.favV === String(vendues.size), `S2b ${ou} : ${vendues.size} annonces vendues dans les 14 jours après un message, reliées par identité`, { vue: w.favV, attendu: vendues.size });
    // (ext. 5.420) Le taux de réponse et les ventes obtenues : recomptés ICI depuis les réponses inventées (fenêtre de 30 j,
    // réponses sur les fils relus ; une vente = l'annonce d'un message, au plus 14 j après).
    const rf = await A.pg.evaluate(() => { const a = (k) => { const x = document.querySelector(`[data-ps-${k}]`); return x ? x.getAttribute(`data-ps-${k}`) : null; }; return { taux: a('fav-reponse'), rep: a('fav-reponses'), rel: a('fav-relues'), obt: a('fav-obtenues'), E: window.__REP_FAV[0].e }; });
    const E30 = rf.E.filter((e) => e.t >= de.getTime() && e.t < fin.getTime());
    const rel = E30.filter((e) => e.r || e.l).length, rep = E30.filter((e) => e.r).length;
    const vend = w.L.filter((l) => l.plateforme === 'Vinted' && l.ts >= de.getTime() && l.ts < fin.getTime() && rf.E.some((e) => e.i === l.item && e.t <= l.ts && l.ts - e.t <= 14 * 86400000)).length;
    dit(rf.rep === String(rep) && rf.rel === String(rel) && rf.taux === (rel >= 3 ? String(Math.round(rep * 100 / rel)) : '') && rf.obt === String(vend),
      `S2c ${ou} : taux de réponse ${rel >= 3 ? Math.round(rep * 100 / rel) + ' %' : '—'} (${rep} sur ${rel} relus) et ${vend} ventes obtenues — recomptés depuis les réponses inventées`, { vue: rf.taux + ' ' + rf.rep + '/' + rf.rel + ' · ' + rf.obt, attendu: [rep, rel, vend] });
    // 7 j puis 90 j : N barres.
    for (const [lib, n] of [['7 j', 7], ['90 j', 90]]) {
      await A.pg.locator('.n-ps-barre > *').nth(1).getByText(lib, { exact: true }).click();
      await A.pg.waitForTimeout(250);
      const b = await A.pg.evaluate(() => document.querySelector('[data-ps-barres]').getAttribute('data-ps-barres'));
      dit(b === String(n), `S3b ${ou} : période ${lib} ⇒ ${n} barres`, b);
    }
    await A.pg.screenshot({ path: path.join(SHOTS, `stats-pilotage-90-${W}-${th}.png`) });
    await A.pg.locator('.n-ps-barre > *').nth(0).getByText('Finances', { exact: true }).click();
    await A.pg.locator('.n-ps-barre > *').nth(1).getByText('30 j', { exact: true }).click();
    await A.pg.waitForTimeout(300);
    await A.pg.screenshot({ path: path.join(SHOTS, `stats-finances-${W}-${th}.png`), fullPage: true });
    const fz = await A.pg.evaluate(() => { const a = (k) => { const x = document.querySelector(`[data-ps-${k}]`); return x ? x.getAttribute(`data-ps-${k}`) : null; };
      // (21 nov., lot rentabilite) les modèles : les rangées de « Ce que tu vends le mieux » sur l'axe Modèle (clé : le nom normalisé).
      const mod = [...document.querySelectorAll('[data-ps-bloc="mieux"][data-ps-mieux-axe="modele"] [data-ps-mieux-ligne]')].map((x) => x.getAttribute('data-ps-mieux-ligne') + ':' + x.getAttribute('data-n')).join(',');
      return { blocs: [...document.querySelectorAll('[data-ps-bloc]')].map((x) => x.getAttribute('data-ps-bloc')), vendu: a('vendu'), ventes: a('ventes'), panier: a('panier'), taux: a('taux'), modeles: mod }; });
    const L30 = w.L.filter((x) => x.ts >= de.getTime() && x.ts < fin.getTime());
    const ca = Math.round(L30.reduce((t, x) => t + x.eur * 100, 0));
    // Les modèles : seuls Nike et Adidas en portent un (la ligne sans modèle ne s'invente rien) ; recomptés ici.
    const nMod = (m) => L30.filter((x) => x.marque === m).length;
    const modAttendu = [['nike air max', nMod('Nike')], ['adidas samba', nMod('Adidas')]].filter((x) => x[1] > 0);
    const modLu = String(fz.modeles || '').split(',').filter(Boolean).map((x) => x.split(':')).sort();
    const modOk = modLu.length === modAttendu.length && modAttendu.slice().sort().every((x, i) => modLu[i][0] === x[0] && Number(modLu[i][1]) === x[1]);
    dit(fz.blocs.join() === 'ventes,stock,sites,mieux' && modOk && fz.vendu === String(ca) && fz.ventes === String(L30.length) && fz.panier === String(Math.round(ca / L30.length)) && fz.taux === String(Math.round(L30.length / 142 * 100)),
      `S1b ${ou} : Finances — ventes, stock, par site, ce que tu vends le mieux (modèles recomptés) ; CA ${ca / 100} €, ${L30.length} ventes, panier, taux de vente recomptés`, fz);
    const n = await A.pg.evaluate(NATIF);
    dit(!n.empilees && !n.deborde && !n.petites && !n.nan, `N ${ou} : aucune carte dans une carte, aucun débordement, cibles ≥ 44, ni NaN`, n);
    dit(!A.erreurs.length, `${ou} : aucune erreur de page`, A.erreurs);
    // Aucun saut : la barre et les cartes à hauteur fixe de Pilotage, en lecture puis lues.
    const sel = '.n-ps-barre, [data-ps-bloc="dernier"], [data-ps-bloc="fait"], [data-ps-bloc="favoris"], [data-ps-bloc="activite"]';
    const at = await ouvrir(nav, port, { W, sombre, base: 'attente', vue: 'stats' });
    await at.pg.screenshot({ path: path.join(SHOTS, `stats-attente-${W}-${th}.png`) });
    const b0 = await at.pg.evaluate(BOITES, sel); await at.ctx.close();
    const lu = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'stats' });
    const b1 = await lu.pg.evaluate(BOITES, sel); await lu.ctx.close();
    dit(b0.length === 5 && JSON.stringify(b0) === JSON.stringify(b1), `S4 ${ou} : la barre et les cartes de Pilotage ont la même place en lecture et lues`, { attente: b0, lu: b1 });
    const v = await ouvrir(nav, port, { W, sombre, base: 'vide', vue: 'stats', extra: '&seg=finances' });
    const nv = await v.pg.evaluate(NATIF); await v.pg.screenshot({ path: path.join(SHOTS, `stats-vide-${W}-${th}.png`) }); await v.ctx.close();
    dit(!nv.nan && !nv.deborde, `V ${ou} : base vide, ni NaN ni débordement`, nv);
  } finally { await A.ctx.close(); }
}

// TRANSPORTEURS (21 nov.) : les nombres de la vue recomptés ICI, par un code À PART (pas celui de l'app), depuis les colis
// inventés (window.__VT / __AT, déjà rangés) : nombre par transporteur, délais (médiane si écarts forts, sinon moyenne ;
// « — » sous 3 colis mesurés ; une date manquante sort le colis), à temps, retours, non réclamés, point le plus utilisé.
const recompteDelai = (paires) => {
  const v = paires.filter(([a, b]) => a != null && b != null && b >= a).map(([a, b]) => (b - a) / 86400000).sort((x, y) => x - y);
  if (v.length < 3) return '';
  const moy = v.reduce((t, x) => t + x, 0) / v.length, n = v.length, med = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  const fort = med > 0 ? (Math.abs(moy - med) / med > 0.25 || v[n - 1] > 3 * med) : moy > 0;
  return String(Math.round((fort ? med : moy) * 10) / 10);
};
async function transporteurs(nav, port, W, sombre) {
  const th = sombre ? 'sombre' : 'clair', ou = `Transporteurs · ${W} · ${th}`;
  console.log(`\n── ${ou}`);
  const A = await ouvrir(nav, port, { W, sombre, base: 'lu', vue: 'stats', extra: '&seg=transporteurs' });
  try {
    await A.pg.waitForSelector('[data-pt-bloc="ventes"]', { timeout: 10000 }).catch(() => {});
    await A.pg.screenshot({ path: path.join(SHOTS, `stats-transporteurs-${W}-${th}.png`), fullPage: true });
    const r = await A.pg.evaluate(() => {
      const fin = new Date(window.__MAINTENANT); fin.setHours(0, 0, 0, 0); fin.setDate(fin.getDate() + 1); const de = new Date(fin); de.setDate(de.getDate() - 30);
      const ligne = (sens, cle) => { const b = document.querySelector(`[data-pt-bloc="${sens}"]`); const x = b && b.querySelector(`[data-pt-ligne="${cle}"]`); if (!x) return null;
        return Object.fromEntries([...x.attributes].filter((a) => a.name.startsWith('data-pt-')).map((a) => [a.name.slice(8), a.value])); };
      const bloc = (sens) => { const b = document.querySelector(`[data-pt-bloc="${sens}"]`); return b ? { total: b.getAttribute('data-pt-total'), lignes: b.getAttribute('data-pt-lignes') } : null; };
      return { de: de.getTime(), fin: fin.getTime(), VT: window.__VT, AT: window.__AT, bv: bloc('ventes'), ba: bloc('achats'),
        mr: ligne('ventes', 'mondialrelay'), vg: ligne('ventes', 'vinted'), co: ligne('ventes', 'colissimo'), inc: ligne('ventes', 'pas-lu'), aut: ligne('ventes', 'autre'),
        amr: ligne('achats', 'mondialrelay'), arc: ligne('achats', 'relaiscolis'), table: !!document.querySelector('.n-pt-tableau[role="table"]'), note: !!document.querySelector('[data-pt-note]') };
    });
    const dans = (t) => t != null && t >= r.de && t < r.fin;
    const V = r.VT.filter((x) => dans(x.venteAt)), Ach = r.AT.filter((x) => dans(x.payeAt));
    const compte = (L) => { const m = {}; for (const x of L) m[x.t] = (m[x.t] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)); };
    const lignesV = (r.bv && r.bv.lignes || '').split(',').filter(Boolean).map((x) => x.split(':')).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((x) => x.join(':')).join();
    const attV = compte(V).map(([k, n]) => k + ':' + n).sort().join();
    dit(r.bv && r.bv.total === String(V.length) && lignesV === attV, `T1 ${ou} : ventes — ${V.length} colis, par transporteur recomptés (${attV})`, { vue: r.bv, attendu: attV });
    const mrV = V.filter((x) => x.t === 'mondialrelay');
    const dMr = recompteDelai(mrV.map((x) => [x.venteAt, x.depotAt])), lMr = recompteDelai(mrV.map((x) => [x.depotAt, x.livreAt]));
    const juges = mrV.filter((x) => x.retard != null);
    dit(r.mr && r.mr.depot === dMr && r.mr.livraison === lMr && r.mr.atemps === (juges.length >= 3 ? juges.filter((x) => !x.retard).length + '/' + juges.length : '') && r.mr.retours === mrV.filter((x) => x.issue === 'retour' || x.issue === 'renvoye').length + ':' + mrV.filter((x) => x.issue === 'litige').length,
      `T2 ${ou} : Mondial Relay — vente → dépôt ${dMr} j, dépôt → livraison ${lMr} j, à temps, retours et litiges recomptés (dates manquantes hors calcul)`, { vue: r.mr, attendu: [dMr, lMr] });
    dit(r.co && r.co.depot === '' && r.co.livraison === '' && r.co.atemps === '', `T3 ${ou} : Colissimo, 2 colis : « — » (moins de 3 colis mesurés)`, r.co);
    dit(!!r.inc && r.inc.inconnu === '1' && !!r.aut, `T4 ${ou} : « Transporteur inconnu » compté à part, l’« Autre » transporteur nommé à part`, { inc: r.inc, aut: r.aut });
    const aMr = Ach.filter((x) => x.t === 'mondialrelay');
    const e1 = recompteDelai(aMr.map((x) => [x.payeAt, x.expedieAt])), e2 = recompteDelai(aMr.map((x) => [x.expedieAt, x.pointAt])), e3 = recompteDelai(aMr.map((x) => [x.pointAt, x.retireAt]));
    const pts = {}; for (const x of aMr) if (x.point) pts[x.point] = (pts[x.point] || 0) + 1; const top = Object.entries(pts).sort((a, b) => b[1] - a[1])[0];
    dit(r.ba && r.ba.total === String(Ach.length) && r.amr && r.amr.expedition === e1 && r.amr.arrivee === e2 && r.amr.retrait === e3 && r.amr.nonreclames === String(aMr.filter((x) => x.nonReclame).length) && r.amr.point === String(top ? top[1] : ''),
      `T5 ${ou} : achats — ${Ach.length} colis ; Mondial Relay paiement → expédition ${e1} j, → point ${e2} j, → retrait ${e3} j, non réclamés, point le plus utilisé recomptés`, { vue: r.amr, attendu: [e1, e2, e3, top] });
    dit(W >= 900 ? r.table : !r.table, `T6 ${ou} : ${W >= 900 ? 'un tableau à colonnes' : 'des rangées (pas de tableau)'} ; la note des règles est dite`, { table: r.table });
    if (W < 900) {
      await A.pg.locator('[data-pt-bloc="ventes"] [data-pt-ligne="mondialrelay"]').first().click();
      await A.pg.waitForTimeout(200);
      const det = await A.pg.evaluate(() => { const d = document.querySelector('[data-pt-detail="mondialrelay"]'); return d ? d.querySelectorAll('.n-fait').length : 0; });
      await A.pg.screenshot({ path: path.join(SHOTS, `stats-transporteurs-detail-${W}-${th}.png`), fullPage: true });
      dit(det === 5, `T7 ${ou} : toucher la rangée ouvre son détail (5 faits)`, det);
    }
    const caps = await A.pg.evaluate(() => [...document.querySelectorAll('[data-pt-bloc] *')].filter((x) => x.childElementCount === 0 && x.textContent.trim().length > 3 && getComputedStyle(x).textTransform === 'uppercase').length);
    dit(caps === 0, `T8 ${ou} : aucune capitale nouvelle (aucun texte en text-transform: uppercase)`, caps);
    const n = await A.pg.evaluate(NATIF);
    dit(!n.empilees && !n.deborde && !n.petites && !n.nan, `N ${ou} : aucune carte dans une carte, aucun débordement, cibles ≥ 44, ni NaN`, n);
    dit(!A.erreurs.length, `${ou} : aucune erreur de page`, A.erreurs);
  } finally { await A.ctx.close(); }
}

(async () => {
  try { construire(); } catch (e) { dit(false, 'les écrans se construisent (esbuild)', String(e.message || e).slice(0, 600)); process.exit(1); }
  const s = await servir(); const port = s.address().port;
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const W of LARGEURS) for (const th of THEMES) { await journee(nav, port, W, th === 'sombre'); await stats(nav, port, W, th === 'sombre'); await transporteurs(nav, port, W, th === 'sombre'); }
  } finally { await nav.close(); s.close(); }
  console.log(`\n${ko ? '❌' : '✅'} banc journee-stats${MUT ? ' [MUTATION=' + MUT + ']' : ''} : ${ok} verts, ${ko} rouge(s) · captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
