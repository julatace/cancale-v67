// Banc : l'écran Statistiques (onglet `dashboard`) et sa carte du mois URSSAF,
// rendus sur des ventes INVENTÉES réalistes (aucune donnée réelle : ce banc vit
// dans le dépôt, qui est public), à 390 px (iPhone) et 1512 px (ordinateur).
//
// Demande de Julien (16 octobre) : « ça fait pas premium et classe, je veux que
// ce soit mieux ». La passe de mise en forme ne doit RIEN changer aux chiffres
// (§5) : ce banc juge
//   1. aucun débordement horizontal, écran rendu sans erreur ;
//   2. aucun MONTANT coupé sur deux lignes (« 2066,80 » puis « € » seul) ;
//   3. les chiffres attendus, calculés ICI depuis les ventes inventées — jamais
//      lus dans l'app : CA finalisé Vinted, CA par compte, CA des 12 mois,
//      meilleur mois, à payer = CA × taux, net = CA − à payer ;
//   4. la COUVERTURE reste dans la page (ventes sans date de versement, ventes
//      Leboncoin sans date, Vestiaire pas relié) : on peut la replier, jamais la
//      retirer — un total partiel ne se présente pas comme complet (§5) ;
//   5. l'ensemble des montants écrits dans la page (textContent, replié
//      compris) est le même qu'une photo de référence prise avant la passe
//      (`BASE=chemin.json` : écrite si absente, comparée sinon).
// Lancer : npm run build && SHOTS=/un/dossier node scripts/bancs/stats-premium.cjs
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4938;
const SHOTS = process.env.SHOTS || null;
const BASE = process.env.BASE || null;

const maintenant = new Date();
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
// Le jour `j` du mois décalé de `m` mois (midi local, jamais près de minuit).
const jourDe = (m, j) => { const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - m, 1, 12); d.setDate(Math.min(j, 28)); return d; };
const vente = (id, prix, statut, d) => ({ transaction_id: id, title: 'Nike Air Max ' + id, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, date: d.toISOString() });

// ── Les ventes inventées ─────────────────────────────────────────────────────
// Une saison réaliste : calme au printemps, montée en septembre-octobre.
// [mois en arrière, nombre de ventes finalisées, prix de base]
const PROFIL = [[11, 2, 38], [10, 3, 42], [9, 2, 35], [8, 4, 41], [7, 5, 44], [6, 6, 47], [5, 7, 39], [4, 9, 46], [3, 12, 43], [2, 18, 49], [1, 31, 52], [0, 14, 55]];
let id = 7000;
const VA = [], VB = [];
for (const [m, n, p] of PROFIL) {
  for (let i = 0; i < n; i++) {
    const d = jourDe(m, m === 0 ? Math.max(1, Math.min(maintenant.getDate(), 1 + (i % Math.max(1, maintenant.getDate())))) : 2 + i);
    if (m === 0 && d > maintenant) d.setTime(maintenant.getTime() - 3600e3);
    const prix = p + ((i * 7) % 23) + ((i % 2) ? 0.5 : 0);
    (i % 3 === 0 ? VB : VA).push(vente(++id, prix, 'Commande finalisée', d));
  }
}
// Ventes en cours ce mois-ci (pas finalisées) et une annulée.
const auj = new Date(maintenant); auj.setHours(Math.max(8, maintenant.getHours() - 1), 0, 0, 0);
VA.push(vente(++id, 48, 'Paiement validé', auj));
VB.push(vente(++id, 61.5, 'Paiement validé', auj));
VA.push(vente(++id, 70, 'Commande annulée', jourDe(0, 2)));

const LBC = {
  L1: { txId: 'L1', isSeller: true, price: 6000, parcelColor: 'finished', stepLabel: 'Vente finalisée', dateVente: jourDe(0, 3).toISOString(), title: 'lbc 1' },
  L2: { txId: 'L2', isSeller: true, price: 8500, parcelColor: 'finished', stepLabel: 'Vente finalisée', dateVente: jourDe(1, 9).toISOString(), title: 'lbc 2' },
};

// ── Ce que le banc ATTEND, calculé ici ──────────────────────────────────────
const fin = (L) => L.filter((o) => o.status === 'Commande finalisée');
const somme = (L) => L.reduce((a, o) => a + Number(o.price.amount), 0);
const c = (eur) => Math.round(eur * 100);
const caA = somme(fin(VA)), caB = somme(fin(VB));
const caFin = caA + caB;
// 12 mois (vendu, date de VENTE, hors annulées, toutes plateformes captées).
const lignes12 = [...VA, ...VB].filter((o) => o.status !== 'Commande annulée').map((o) => ({ d: new Date(o.date), eur: Number(o.price.amount) }))
  .concat(Object.values(LBC).map((v) => ({ d: new Date(v.dateVente), eur: v.price / 100 })));
const parMois = {};
for (const l of lignes12) parMois[ym(l.d)] = (parMois[ym(l.d)] || 0) + l.eur;
const debut12 = new Date(maintenant.getFullYear(), maintenant.getMonth() - 11, 1);
const tot12 = lignes12.filter((l) => l.d >= debut12).reduce((a, l) => a + l.eur, 0);
const meilleur = Object.entries(parMois).sort((a, b) => b[1] - a[1])[0];

// La ligne publiée par l'écran Ventes (le propriétaire, §11) : on la POSE, le
// tableau de bord la consomme. Ses chiffres sont inventés et cohérents.
const caMoisDecl = 612.4, nMoisDecl = 11;
const TAUX = 13.5;
const aPayer = Math.round(Number((c(caMoisDecl) * TAUX / 100).toFixed(6))) / 100;
const net = (c(caMoisDecl) - c(aPayer)) / 100;
const publie = {
  mois: [
    { ym: ym(maintenant), n: nMoisDecl, ca: caMoisDecl, nMasq: 0, caMasq: 0, par: { Vinted: { n: 10, ca: 552.4 }, Leboncoin: { n: 1, ca: 60 } }, nApres: 0, caApres: 0, nDouble: 0, caDouble: 0, nAilleurs: 0, caAilleurs: 0, declare: null },
    { ym: ym(jourDe(1, 1)), n: 30, ca: 1542.5, par: { Vinted: { n: 29, ca: 1457.5 }, Leboncoin: { n: 1, ca: 85 } } },
    { ym: ym(jourDe(2, 1)), n: 17, ca: 811, par: { Vinted: { n: 17, ca: 811 } } },
    { ym: ym(jourDe(3, 1)), n: 12, ca: 540, par: { Vinted: { n: 12, ca: 540 } } },
  ],
  aDater: { n: 53, ca: 1067.7, par: { Vinted: { n: 51, ca: 982.7 }, Leboncoin: { n: 2, ca: 85 } } },
  ecartees: 0, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'nonRelie' }, declare: 'lu', at: Date.now(),
};

const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
  { id: 2, vinted_user_id: '222', login: 'paris_kicks', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() },
];
const annonce = (uid, n) => ({ id: 'harvest_' + uid + '_listings', data: { capturedAt: maintenant.toISOString(), payload: { items: Array.from({ length: n }, (_, i) => ({ id: Number(uid) * 100 + i, title: 'Annonce ' + uid + '-' + i, price: { amount: String(40 + i), currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false })) } } });
const LIGNES = [
  annonce('111', 6), annonce('222', 4),
  { id: 'harvest_111_orders_sold', data: { capturedAt: maintenant.toISOString(), payload: { my_orders: VA } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: maintenant.toISOString(), payload: { my_orders: VB } } },
  { id: 'lbc_ventes', data: { ventes: LBC } },
];

let ko = 0, ok = 0;
const dit = (cond, m, d) => { if (cond) ok++; else ko++; console.log((cond ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const ouvrir = async (b, vp, opts = {}) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((d) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_regime', JSON.stringify('micro')); localStorage.setItem('vinted_urssaf_taux', '13.5'); localStorage.setItem('vinted_urssaf_mois', JSON.stringify(d.publie)); localStorage.setItem('vrm_ca_objectif', '2000'); if (d.dark) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { publie, dark: !!opts.dark });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: maintenant.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelector('[data-dash-vendu-jour]') || /pas pu s'afficher/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(1800);
  return { ctx, pg, errs };
};

const lire = (pg) => pg.evaluate(() => {
  const page = document.querySelector('.vrm-finance-page') || document.body;
  const RE = /\d[\d\u00a0\u202f ]*,\d{2}[\u00a0\u202f ]?€/g;
  // Montants coupés : un montant VISIBLE dont les morceaux tombent sur deux lignes.
  const coupes = [];
  const w = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  // Le texte d'un montant peut être découpé en plusieurs nœuds (un <b> autour) :
  // on juge chaque élément dont le texte PROPRE contient un montant entier.
  const els = new Set();
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.parentElement) els.add(n.parentElement);
  for (const el of els) {
    const t = el.textContent; if (!RE.test(t)) continue; RE.lastIndex = 0;
    // On travaille au niveau des nœuds texte directs.
    for (const n of el.childNodes) {
      if (n.nodeType !== 3) continue;
      let m; RE.lastIndex = 0;
      while ((m = RE.exec(n.nodeValue))) {
        const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
        const rects = [...rg.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
        if (!rects.length) continue;
        const tops = new Set(rects.map((r) => Math.round(r.top / 4)));
        if (tops.size > 1) coupes.push(m[0]);
      }
    }
  }
  // Les montants \u00e9crits, n\u0153ud texte par n\u0153ud texte (repli\u00e9 compris) : joindre
  // tout le texte collerait \u00ab octobre 2026 \u00bb au montant voisin (\u00ab 20261097,00 \u00bb).
  const montants = [];
  const w2 = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  for (let n = w2.nextNode(); n; n = w2.nextNode()) for (const s of (n.nodeValue.match(RE) || [])) montants.push(s.replace(/[\u00a0\u202f ]/g, ''));
  const a = (sel, at) => { const e = document.querySelector(sel); return e ? e.getAttribute(at) : null; };
  // Les notions (§5) : chaque grosse carte dit CE qu'elle compte, de sa source.
  const carte = (k) => { const e = document.querySelector(`[data-stats-carte="${k}"]`); return e ? { notion: e.getAttribute('data-notion'), texte: e.innerText, tc: e.textContent } : null; };
  // L'échelle typographique : la taille calculée de chaque texte VISIBLE.
  const tailles = {};
  const w3 = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  for (let n = w3.nextNode(); n; n = w3.nextNode()) {
    const el = n.parentElement; if (!el || !n.nodeValue.trim()) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue;
    const fs = parseFloat(getComputedStyle(el).fontSize); const k = String(Math.round(fs * 10) / 10);
    (tailles[k] = tailles[k] || []).push(n.nodeValue.trim().slice(0, 24));
  }
  return {
    hero: carte('hero'), courbe: carte('courbe'), plateformes: carte('plateformes'), tailles,
    coupes, montants,
    texte: page.innerText, textContent: page.textContent.replace(/\s+/g, ' '),
    tombe: /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText),
    deb: document.documentElement.scrollWidth - window.innerWidth,
    couverture: !!document.querySelector('[data-urssaf-couverture]'),
    declare: a('[data-urssaf-declare]', 'data-urssaf-declare'),
    caMois: a('[data-dash-stat="caMois"]', 'data-dash-cents'),
  };
});

const fr = (eur) => Number(eur).toFixed(2).replace('.', ',') + '€';

(async () => {
  let b; const base = {};
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, dark] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, false]]) {
      const nom = `${vp.width}${dark ? '-sombre' : ''}`;
      console.log(`\n── Statistiques, ${nom}`);
      await essaie(nom, async () => {
        const { ctx, pg, errs } = await ouvrir(b, vp, { dark });
        if (SHOTS) {
          fs.mkdirSync(SHOTS, { recursive: true });
          // L'app défile DANS un conteneur : on agrandit la fenêtre à la hauteur
          // du contenu pour photographier tout l'écran d'un coup.
          const h = await pg.evaluate(() => Math.max(...[...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map((e) => e.scrollHeight + 160), document.documentElement.scrollHeight));
          await pg.setViewportSize({ width: vp.width, height: Math.min(16000, h) });
          await pg.waitForTimeout(400);
          await pg.screenshot({ path: path.join(SHOTS, `stats-${nom}.png`), fullPage: true });
          await pg.setViewportSize(vp);
          await pg.waitForTimeout(300);
          // Plans rapprochés : la carte du mois et la courbe.
          for (const [sel, f] of [['[data-urssaf-declare]', 'urssaf'], ['[data-stats-courbe]', 'courbe'], ['[data-stats-plateformes]', 'plateformes']]) {
            const h = await pg.$(sel);
            if (h) { const card = await h.evaluateHandle((e) => e.closest('[data-stats-carte]') || e.closest('.vrm-card') || e.parentElement); await card.asElement().screenshot({ path: path.join(SHOTS, `stats-${nom}-${f}.png`) }).catch(() => {}); }
          }
        }
        const lu = await lire(pg);
        dit(!lu.tombe && errs.length === 0, 'l’écran s’affiche, sans erreur', errs.join(' | ').slice(0, 160));
        dit(lu.deb <= 1, 'aucun débordement horizontal', `${lu.deb} px`);
        dit(lu.coupes.length === 0, 'aucun montant coupé sur deux lignes', lu.coupes.slice(0, 4).join(' · '));
        const tc = lu.textContent.replace(/[\u00a0\u202f ]/g, '');
        dit(tc.includes(fr(caFin)), 'CA finalisé Vinted = somme des ventes finalisées des deux comptes', fr(caFin));
        dit(tc.includes(fr(caA)) && tc.includes(fr(caB)), 'CA par compte = somme des finalisées de chaque compte', `${fr(caA)} · ${fr(caB)}`);
        dit(tc.includes(fr(tot12)), 'courbe : total des 12 derniers mois (vendu, toutes plateformes captées)', fr(tot12));
        dit(tc.includes(fr(meilleur[1])), 'courbe : la valeur du meilleur mois est écrite', `${meilleur[0]} ${fr(meilleur[1])}`);
        // (17 oct.) La déclaration URSSAF a quitté Statistiques : elle vit dans
        // Comptabilité (jugée plus bas, sur cet onglet-là).
        dit(!lu.declare && !/À payer \(/.test(lu.texte), 'la déclaration URSSAF n’est plus dans Statistiques');
        // ── Trois chiffres d'affaires, trois notions, trois libellés (§5) ─────
        // Le héros (finalisé, Vinted seul, depuis le début) peut être plus petit
        // que la courbe (vendu, toutes plateformes, en cours comprises, 12 mois) :
        // chacun doit DIRE ce qu'il compte, sinon 12 mois > depuis le début se lit
        // comme une erreur de calcul.
        dit(lu.hero && lu.hero.notion === 'finalise-vinted' && /finalis/i.test(lu.hero.texte) && /Vinted/.test(lu.hero.texte.split('\n')[0]),
          'héros : finalisé, Vinted seul — dit dans son libellé', lu.hero ? `${lu.hero.notion} · ${lu.hero.texte.split('\n')[0]}` : 'absent');
        dit(lu.courbe && lu.courbe.notion === 'vendu' && /^Vendu/.test(lu.courbe.texte) && /en cours/i.test(lu.courbe.tc) && /toutes plateformes/i.test(lu.courbe.tc) && !/Chiffre d.affaires/i.test(lu.courbe.texte.split('\n')[0]),
          'courbe : « Vendu », toutes plateformes, en cours comprises — pas « Chiffre d’affaires »', lu.courbe ? `${lu.courbe.notion} · ${lu.courbe.texte.split('\n')[0]}` : 'absente');
        dit(lu.plateformes && lu.plateformes.notion === 'finalise' && /Finalisé par plateforme/.test(lu.plateformes.texte) && (!/Total/.test(lu.plateformes.texte) || /Total finalisé/.test(lu.plateformes.texte)),
          'par plateforme : finalisé, et son total le dit', lu.plateformes ? lu.plateformes.notion : 'absente');
        // La jauge lit le VENDU du mois (toutes plateformes, en cours compris) :
        // sa phrase le dit, elle ne parle plus de « Vinted, finalisées ».
        dit(/% de ton objectif · vendu ce mois, toutes plateformes/.test(lu.textContent) && !/Vinted, ventes finalisées et en cours du mois/.test(lu.textContent),
          'objectif : la phrase dit « vendu ce mois, toutes plateformes » (la source de la jauge)', (/[^.]{0,30}% de ton objectif[^<]{0,70}/.exec(lu.textContent) || [''])[0]);
        {
          const OK = new Set(['11', '13', '15', '20']);
          const hors = Object.entries(lu.tailles).filter(([k]) => !OK.has(k) && !(Number(k) >= 28));
          dit(!hors.length, 'échelle 28 / 20 / 15 / 13 / 11 — aucune autre taille de texte', hors.map(([k, v]) => `${k}px « ${v[0]} »×${v.length}`).slice(0, 6).join(' · '));
          dit(!Object.keys(lu.tailles).some((k) => Number(k) < 11), 'aucun texte sous 11 px', Object.keys(lu.tailles).filter((k) => Number(k) < 11).join(', '));
        }
        // ── La carte URSSAF du mois, dans Comptabilité (même ligne publiée) ──
        await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-compta-urssaf]', { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const lc = await lire(pg);
        const tcC = lc.textContent.replace(/[\u00a0\u202f ]/g, '');
        dit(tcC.includes(fr(caMoisDecl)) && tcC.includes(fr(aPayer)) && tcC.includes(fr(net)), 'carte du mois : CA × 13,5 % = à payer, CA − à payer = net', `${fr(caMoisDecl)} → ${fr(aPayer)} · ${fr(net)}`);
        dit(new RegExp('(?<!\\d)' + nMoisDecl + '(?!\\d)').test(lc.textContent), 'carte du mois : nombre de ventes finalisées de la ligne publiée', String(nMoisDecl));
        dit(lc.couverture && /51 ventes Vinted/.test(lc.textContent) && tcC.includes(fr(982.7)), 'couverture : 51 ventes Vinted sans date de versement (982,70 €) restent dans la page');
        // (29 oct.) « Vestiaire Co : pas encore relié » est retiré de la carte URSSAF
        // (dit à tous, n'apprenait rien) : seul Leboncoin sans date reste à dire.
        dit(/2 ventes Leboncoin/.test(lc.textContent) && !/Vestiaire Co\s*:\s*pas encore reli/.test(lc.textContent), 'couverture : Leboncoin sans date reste dans la page, plus « Vestiaire pas relié »');
        dit(/sans date/.test(lc.texte), 'la couverture se VOIT sans rien déplier (au moins « sans date »)');
        // La lecture de `urssaf.cjs` (mêmes motifs, sur le texte VISIBLE) doit
        // toujours retrouver taux, CA cité, à payer, net et nombre de ventes.
        {
          const t = lc.texte, e2 = (s) => s == null ? null : Number(String(s).replace(/[\s  €]/g, '').replace(',', '.'));
          const taux = e2((/À PAYER \(([\d,.]+) ?%\)/i.exec(t) || [])[1]);
          const ap = e2((/À PAYER \([\d,.]+ ?%\)\s*\n\s*([\d\s.,  ]+€)/i.exec(t) || [])[1]);
          const nt = e2((/NET APRÈS PAIEMENT\s*\n\s*([\d\s.,  ]+€)/i.exec(t) || [])[1]);
          const cc = e2((/CA des ventes finalisées[^\n]*?\(([\d\s.,  ]+€)\)/i.exec(t) || [])[1]);
          const nf = Number((/VENTES FINALISÉES\s*\n\s*(\d+)/i.exec(t) || [])[1]);
          dit(taux === TAUX && ap === aPayer && nt === net && cc === caMoisDecl && nf === nMoisDecl,
            'la carte se lit comme urssaf.cjs la lit (libellé puis montant, phrase de calcul visible)', `${taux} · ${cc} · ${ap} · ${nt} · ${nf}`);
        }
        dit(lc.declare === 'lu', 'la phrase de calcul porte toujours data-urssaf-declare', String(lc.declare));
        if (!dark) {
          base[nom] = [...lu.montants].sort();
        }
        await ctx.close();
      });
    }
    if (BASE) {
      if (!fs.existsSync(BASE)) { fs.writeFileSync(BASE, JSON.stringify(base, null, 1)); console.log('\n  (photo de référence écrite : ' + BASE + ')'); }
      else {
        const ref = JSON.parse(fs.readFileSync(BASE, 'utf8'));
        for (const k of Object.keys(ref)) {
          const A = new Set(ref[k]), B = new Set(base[k] || []);
          const manquent = [...A].filter((x) => !B.has(x)), nouveaux = [...B].filter((x) => !A.has(x));
          dit(!manquent.length && !nouveaux.length, `${k} px : les mêmes montants qu’avant la passe`, `manquent ${manquent.join(' ')} · nouveaux ${nouveaux.join(' ')}`);
        }
      }
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ stats-premium : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ stats-premium : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
