// ── BANC : « STOCK JUSTE » (11 nov. 2026, lot DJ4) ─────────────────────────────────
//        npm run build && BANC_PORT=46xx node scripts/bancs/stock-juste.cjs [dist]
//        SHOTS=dossier   SJ_SEUL=S|J|A|P|T|M (une partie)
// Julien, 11 nov. : « Dans Stock je veux que ce soit que les paires en ligne, une seule si elle
// est présente sur tous les sites, mais là tu me proposes de vieilles annonces. » ; « À trancher,
// surtout un onglet exprès » ; « qu'elle me demande si je veux l'enlever du stock » ; « le bouton
// Annuler reste constamment sur l'app ». Données INVENTÉES (le dépôt est public) :
//   · compte_frais (111) lu il y a 1 min (lecture complète) : N°12 (aussi sur Leboncoin et
//     Vestiaire, même N°), 50 paires AU MÊME TITRE (N°100…149), N°40 MASQUÉE par Vinted ;
//   · compte_vieux (222) lu il y a 90 j : N°7 ⇒ « à confirmer » (la « vieille annonce ») ;
//   · fiche 7002 N°60 : vue en ligne il y a 2 j, absente de la lecture complète (supprimée) —
//     rangée dans une case du Stock.
// Jugé sur des data-* et des nombres rendus.
//  S  Stock (390 tactile / 1512, clair / sombre) : 51 paires en ligne ; N°12 UNE ligne, trois
//     pastilles (vinted, leboncoin, vestiaire) ; les 50 au même titre = 50 lignes, 50 N° ; N°7
//     et N°40 à part (replis), jamais dans la liste ; N°60 (supprimée) nulle part dans la liste ;
//     aucun débordement, aucune erreur.
//  J  Ma journée (390 clair, 1512 sombre) : la carte « à trancher » en tête, ouverte EN PLACE
//     (l'écran reste Ma journée) ; la question de N°60 : trois réponses ≥ 44 px ; plus de
//     seconde carte « supprimé de Vinted ».
//  A  « Non, enlève-la du stock » ⇒ quatre raisons ; « Donnée » ⇒ la carte sort, la pilule
//     « Annuler » ; écrit : décision `separe`/`donnee`, déclarée partie (id 7002), case de N°60
//     libérée ; le N° (`vinted_annonce_numeros`) inchangé ; la pilule part en ≤ 6 s.
//  P  LA PILULE (le bug) : « Oui, je la garde » → « Annuler » (clic) → la pilule part ; le geste
//     SUIVANT (« Oui » encore) : sa pilule part aussi en ≤ 6 s ; rechargement ⇒ aucune pilule.
//     « Plus tard » ⇒ la carte sort, et ne revient pas au rechargement.
//  T  `?tab=trancher` (ancien lien) ⇒ Ma journée, la carte ouverte ; plus d'entrée « À trancher ».
//  M  Annonces → Outils : plus de « Répartir un lot », « Inventaire physique », « Audit du stock ».
require('./_porte-banc.cjs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4617);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-stock-juste');
const SEUL = process.env.SJ_SEUL || '';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const MAINTENANT = Date.now();
const iso = (t) => new Date(t).toISOString();
const PH = (k) => `https://images.exemple.test/paire-${k}.svg`;
const SVG = (k) => { const h = (Number(k) * 47) % 360; return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="hsl(${h},35%,86%)"/><path d="M30 130c10-30 40-40 60-42 18-2 26-24 40-24 10 0 12 14 26 22 14 8 24 16 24 34v10H30z" fill="hsl(${h},45%,38%)"/></svg>`; };
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_frais', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT) },
  { id: 2, vinted_user_id: '222', login: 'compte_vieux', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT) },
];
const ann = (id, title, extra = {}) => ({ id, title, photo: { url: PH(id) }, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, created_at_ts: Math.floor((MAINTENANT - 5 * 86400e3) / 1000), ...extra });
const MEME = 'Nike Dunk Low Panda taille 42';
const items111 = [ann(1012, 'Air Jordan 1 Mid taille 43'), ann(1040, 'Salomon XT-6 taille 40', { is_hidden: true }), ...Array.from({ length: 50 }, (_, i) => ann(5000 + i, MEME))];
const FICHES = {
  1012: { numero: '12', accountId: '111', title: 'Air Jordan 1 Mid taille 43', photo: PH(1012) },
  1040: { numero: '40', accountId: '111', title: 'Salomon XT-6 taille 40', photo: PH(1040) },
  2007: { numero: '7', accountId: '222', title: 'Vieille annonce d’août', photo: PH(2007) },
  7002: { numero: '60', accountId: '111', title: 'New Balance 530 taille 41', photo: PH(7002), photoK: 'pk60', auto: true, numberedAt: iso(MAINTENANT - 10 * 86400e3) },
  ...Object.fromEntries(Array.from({ length: 50 }, (_, i) => [5000 + i, { numero: String(100 + i), accountId: '111', title: MEME, photo: PH(5000 + i) }])),
};
const ROWS = () => [
  { id: 'harvest_111_listings', data: { capturedAt: iso(MAINTENANT - 60000), uid: '111', payload: { items: items111, pagination: { total_entries: items111.length, total_pages: 1, current_page: 1 } } } },
  { id: 'harvest_222_listings', data: { capturedAt: iso(MAINTENANT - 90 * 86400e3), uid: '222', payload: { items: [ann(2007, 'Vieille annonce d’août')], pagination: { total_entries: 1, total_pages: 1, current_page: 1 } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MAINTENANT - 60000), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MAINTENANT - 60000), payload: { my_orders: [] } } },
  { id: 'lbc_listings', data: { items: { L12: { id: 'L12', customRef: 'VRM-12', subject: 'Air Jordan 1 Mid (Leboncoin)', status: 'active', account: 'lbc-account:77' } }, lectures: { 77: { at: iso(MAINTENANT - 60000), total: 1, n: 1, ids: ['L12'] } } } },
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'vc_listings', data: { items: { vc12: { titre: 'Air Jordan 1 Mid (Vestiaire)', ref: '12', statut: 'on_sale', vuAt: iso(MAINTENANT - 60000), photo: null, prix: { valeur: 120, devise: 'EUR', cle: 'price' }, compte: 'vc_compte' } }, liens: {}, capturedAt: iso(MAINTENANT - 60000), complet: true, total: 1 } },
  { id: 'vc_ventes', data: { ventes: {} } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = iso(MAINTENANT); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
async function contexte(b, vp, theme) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: theme, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const MAIN = { vinted_dark: theme === 'dark', vinted_account_emails: {}, vinted_annonce_numeros: FICHES, vrm_vus_en_ligne: { 7002: iso(MAINTENANT - 48 * 3600e3) },
    vrm_meubles: [{ id: 'mA', name: 'Étagère banc', cols: 4, rows: 2 }], vrm_slots: { 60: { m: 'mA', i: 0 }, 12: { m: 'mA', i: 1 } } };
  const rows = ROWS();
  await ctx.addInitScript(([sombre]) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
    localStorage.setItem('vinted_dark', JSON.stringify(sombre)); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair'));
  } catch (_) {} }, [theme === 'dark']);
  const servir = (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) }).catch(() => {});
    if (route.request().method() !== 'GET') {
      let d = []; try { const x = JSON.parse(route.request().postData() || '[]'); d = Array.isArray(x) ? x : [x]; } catch (_) {}
      const m = d.find((x) => x && (x.id === 'main' || /id=eq\.main/.test(u)) && x.data && typeof x.data === 'object'); if (m) Object.assign(MAIN, m.data);
      if (process.env.SJ_TRACE) console.log('ECRIT', route.request().method(), u.slice(0, 140), d.map((x) => x && x.id).join(','), m ? Object.keys(m.data).length : '-');
      return j(d);
    }
    if (/\/app_data\?select=owner&limit=1$/.test(u)) return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' }).catch(() => {});
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: MAIN }, sel)]);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  };
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await ctx.route('**/rest/v1/**', servir);
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await ctx.route('https://images.exemple.test/**', (r) => { const k = (/paire-(\d+)/.exec(r.request().url()) || [])[1] || '0'; return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG(k) }); });
  return { ctx, MAIN };
}
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }).catch(() => {});
const aller = (pg, tab) => pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
const CARTE = '[data-a-trancher-carte="supprimes-vinted"][data-a-trancher-id="7002"]';
const ouvrirTrancher = async (pg) => {
  await pg.waitForSelector('[data-job="a-trancher"]', { timeout: 40000 });
  if ((await pg.getAttribute('[data-job="a-trancher"]', 'aria-expanded')) !== 'true') await pg.click('[data-job="a-trancher"]');
  await pg.waitForSelector(CARTE, { timeout: 20000 });
};
const pilule = (pg) => pg.evaluate(() => ({ annuler: !!document.querySelector('[data-pilule-annuler]'), etat: (document.querySelector('[data-pilule]') || { getAttribute: () => null }).getAttribute('data-pilule-etat') }));
const attendrePartie = async (pg, ms) => { const vu = []; for (let t = 0; t < ms; t += 250) { const p = await pilule(pg); vu.push(p.etat); if (!p.etat) return t; await pg.waitForTimeout(250); } if (process.env.SJ_TRACE) console.log('PILULE', vu.join(' ')); return null; };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const PC = { width: 1512, height: 950 }, TEL = { width: 390, height: 844 };

  // ── S ───────────────────────────────────────────────────────────────────────────
  if (!SEUL || SEUL === 'S') for (const [nom, vp, theme] of [['390-clair', TEL, 'light'], ['390-sombre', TEL, 'dark'], ['1512-clair', PC, 'light'], ['1512-sombre', PC, 'dark']]) await essaie('S ' + nom, async () => {
    const { ctx } = await contexte(b, vp, theme);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await aller(pg, 'garage');
    await pg.waitForFunction(() => { const el = document.querySelector('[data-stock-actuelles]'); return el && el.getAttribute('data-stock-actuelles') !== 'encours'; }, null, { timeout: 40000 });
    await pg.waitForTimeout(800);
    const r = await pg.evaluate(() => {
      const lignes = [...document.querySelectorAll('[data-stock-annonce]')].map((e) => ({ k: e.getAttribute('data-stock-annonce'), p: e.getAttribute('data-stock-annonce-plats'), e: e.getAttribute('data-stock-annonce-etat'),
        sites: [...e.querySelectorAll('[data-site]')].map((x) => x.getAttribute('data-site')).join(','), t: (e.querySelector('.vrm-s2d-txt-t') || {}).textContent || '' }));
      const aPart = Object.fromEntries([...document.querySelectorAll('[data-stock-repli]')].map((d) => [d.getAttribute('data-stock-repli'), [...d.querySelectorAll('[data-stock-a-part]')].map((x) => x.getAttribute('data-stock-a-part')).join(',')]));
      return { n: document.querySelector('[data-stock-actuelles]').getAttribute('data-stock-actuelles'), lignes, aPart,
        large: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth) };
    });
    // La liste se montre 60 par 60 : le compte vient du résumé ; la liste porte les 51 (≤ 60).
    const k12 = r.lignes.filter((l) => l.k === '12');
    const meme = r.lignes.filter((l) => /Nike Dunk Low Panda/.test(l.t));
    dit(r.n === '51', `S ${nom} : 51 paires en ligne (N°12 une fois + 50 au même titre)`, r.n);
    dit(k12.length === 1 && k12[0].sites === 'vinted,leboncoin,vestiaire', `S ${nom} : N°12 = UNE ligne, une pastille par site (Vinted, Leboncoin, Vestiaire)`, JSON.stringify(k12));
    dit(meme.length === 50 && new Set(meme.map((l) => l.k)).size === 50, `S ${nom} : 50 paires au même titre ⇒ 50 lignes, 50 N° (aucune fusion par le titre)`, `${meme.length} lignes, ${new Set(meme.map((l) => l.k)).size} N°`);
    dit(r.lignes.every((l) => l.e === 'enligne') && !r.lignes.some((l) => ['7', '40', '60'].includes(l.k)), `S ${nom} : la liste = en ligne seulement (ni N°7 vieille, ni N°40 masquée, ni N°60 supprimée)`, JSON.stringify(r.lignes.filter((l) => l.e !== 'enligne' || ['7', '40', '60'].includes(l.k))));
    dit(r.aPart.aconfirmer === '7' && r.aPart.masquees === '40', `S ${nom} : à part : N°7 « à confirmer » (lu il y a 90 j), N°40 « masquée »`, JSON.stringify(r.aPart));
    dit(r.large <= 1, `S ${nom} : aucun défilement horizontal`, r.large);
    dit(!errs.length, `S ${nom} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
    await shot(pg, 'S-' + nom + '-haut');
    await pg.evaluate(() => { const d = document.querySelector('[data-stock-repli="aconfirmer"]'); if (d) { d.open = true; d.scrollIntoView({ block: 'center' }); } });
    await pg.waitForTimeout(300); await shot(pg, 'S-' + nom + '-a-part');
    await pg.evaluate(() => { const d = document.querySelector('[data-stock-annonce="12"]'); if (d) d.scrollIntoView({ block: 'center' }); });
    await pg.waitForTimeout(300); await shot(pg, 'S-' + nom + '-n12');
    await ctx.close();
  });

  // ── J + A ───────────────────────────────────────────────────────────────────────
  if (!SEUL || SEUL === 'J' || SEUL === 'A') for (const [nom, vp, theme] of [['390-clair', TEL, 'light'], ['1512-sombre', PC, 'dark']]) await essaie('J/A ' + nom, async () => {
    const { ctx, MAIN } = await contexte(b, vp, theme);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await aller(pg, 'journee');
    await pg.waitForSelector('[data-job="a-trancher"]', { timeout: 40000 });
    await pg.waitForTimeout(1500);
    const avant = await pg.evaluate(() => ({ cycle: !!document.querySelector('[data-job="supprime-vinted"], [data-cycle-groupe]'), ouvert: document.querySelector('[data-job="a-trancher"]').getAttribute('aria-expanded') }));
    dit(!avant.cycle, `J ${nom} : plus de seconde carte « supprimé de Vinted » (le doute est dans « à trancher », une fois)`);
    await shot(pg, 'J-' + nom + '-ferme');
    await ouvrirTrancher(pg);
    const j = await pg.evaluate((sel) => ({ url: location.search, corps: !!document.querySelector('[data-at-journee-corps] [data-a-trancher]'),
      gestes: [...document.querySelectorAll(sel + ' button')].map((x) => ({ r: x.getAttribute('data-role'), h: Math.round(x.getBoundingClientRect().height), w: Math.round(x.getBoundingClientRect().width) })) }), CARTE);
    dit(j.corps, `J ${nom} : la carte s'ouvre EN PLACE dans Ma journée (mêmes cartes, aucun autre écran)`, JSON.stringify(j.url));
    dit(j.gestes.map((g) => g.r).join() === 'oui,non,plus-tard' && j.gestes.every((g) => g.h >= 44), `J ${nom} : « Tu l'as encore ? » : trois réponses, ≥ 44 px`, JSON.stringify(j.gestes));
    await pg.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: 'center' }), CARTE); await pg.waitForTimeout(300);
    await shot(pg, 'J-' + nom + '-question');
    // A
    const num0 = JSON.stringify(MAIN.vinted_annonce_numeros);
    await pg.click(CARTE + ' [data-a-trancher-non]');
    const raisons = await pg.$$eval(CARTE + ' [data-a-trancher-raison]', (l) => l.map((x) => x.getAttribute('data-a-trancher-raison')));
    dit(raisons.join() === 'donnee,vendue-ailleurs,perdue,rendue', `A ${nom} : « Non » ⇒ quatre raisons au choix rapide`, raisons.join());
    await shot(pg, 'A-' + nom + '-raisons');
    await pg.click(CARTE + ' [data-a-trancher-raison="donnee"]');
    await pg.waitForTimeout(300);
    const v1 = await pg.evaluate((sel) => ({ carte: !!document.querySelector(sel), dialogue: !!document.querySelector('.vrm-confirmation') }), CARTE);
    const p1 = await pilule(pg);
    dit(!v1.carte && !v1.dialogue && p1.annuler, `A ${nom} : « Donnée » ⇒ la carte sort, aucune confirmation, pilule « Annuler »`, JSON.stringify({ ...v1, ...p1 }));
    await shot(pg, 'A-' + nom + '-pilule');
    for (let i = 0; i < 40 && !(MAIN.vrm_cycle_decisions && MAIN.vrm_cycle_decisions['7002']); i++) await pg.waitForTimeout(200);
    const dec = (MAIN.vrm_cycle_decisions || {})['7002'];
    const perdue = Object.entries(MAIN.vinted_pairs_lost || {}).find(([, v]) => v && String(v.id) === '7002');
    dit(!!dec && dec.choix === 'separe' && dec.raison === 'donnee', `A ${nom} : écrit — séparée, raison « donnée »`, JSON.stringify(dec));
    dit(!!perdue && perdue[1].raison === 'donnee', `A ${nom} : déclarée partie par IDENTITÉ (annonce 7002)`, JSON.stringify(perdue));
    dit(MAIN.vrm_slots && !MAIN.vrm_slots['60'] && !!MAIN.vrm_slots['12'], `A ${nom} : sa case (N°60) libérée, l'autre (N°12) intacte`, JSON.stringify(MAIN.vrm_slots));
    dit(JSON.stringify(MAIN.vinted_annonce_numeros) === num0, `A ${nom} : aucun N° changé (jamais réattribué)`);
    const parti = await attendrePartie(pg, 7000);
    dit(parti != null, `A ${nom} : la pilule part toute seule (≤ 7 s)`, parti);
    dit(!errs.length, `J/A ${nom} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
    await ctx.close();
  });

  // ── P ───────────────────────────────────────────────────────────────────────────
  if (!SEUL || SEUL === 'P') for (const [nom, vp, theme] of [['1512-clair', PC, 'light'], ['390-sombre', TEL, 'dark']]) await essaie('P ' + nom, async () => {
    const { ctx, MAIN } = await contexte(b, vp, theme);
    const pg = await ctx.newPage();
    await aller(pg, 'journee'); await ouvrirTrancher(pg);
    await pg.click(CARTE + ' [data-a-trancher-oui]');
    await pg.waitForSelector('[data-pilule-annuler]', { timeout: 5000 });
    if (vp.width < 600) await pg.tap('[data-pilule-annuler]'); else await pg.click('[data-pilule-annuler]');
    if (vp.width >= 600) await pg.mouse.move(vp.width / 2, 200);
    await pg.waitForSelector(CARTE, { timeout: 15000 }).catch(() => {});
    const t1 = await attendrePartie(pg, 7000);
    dit(t1 != null, `P ${nom} : après « Annuler », la pilule part (≤ 7 s)`, t1);
    for (let i = 0; i < 30 && MAIN.vrm_cycle_decisions && MAIN.vrm_cycle_decisions['7002']; i++) await pg.waitForTimeout(200);
    dit(!(MAIN.vrm_cycle_decisions && MAIN.vrm_cycle_decisions['7002']), `P ${nom} : « Annuler » ⇒ la décision est retirée`, JSON.stringify(MAIN.vrm_cycle_decisions || null));
    await pg.waitForSelector(CARTE, { timeout: 15000 });
    await pg.waitForTimeout(800);
    await pg.click(CARTE + ' [data-a-trancher-oui]');
    const p2 = await pilule(pg);
    const t2 = await attendrePartie(pg, 7000);
    dit(p2.annuler && t2 != null, `P ${nom} : le geste SUIVANT : sa pilule « Annuler » part aussi (≤ 7 s) — le bug du 11 nov.`, JSON.stringify({ p2, t2 }));
    await shot(pg, 'P-' + nom + '-apres');
    for (let i = 0; i < 30 && !(MAIN.vrm_cycle_decisions && MAIN.vrm_cycle_decisions['7002']); i++) await pg.waitForTimeout(200);
    dit((MAIN.vrm_cycle_decisions || {})['7002'] && MAIN.vrm_cycle_decisions['7002'].choix === 'chez-moi', `P ${nom} : « Oui, je la garde » ⇒ chez-moi`, JSON.stringify((MAIN.vrm_cycle_decisions || {})['7002']));
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-job]', { timeout: 40000 }).catch(() => {});
    await pg.waitForTimeout(2500);
    dit(!(await pilule(pg)).etat, `P ${nom} : rechargement ⇒ aucune pilule rejouée`);
    // Stock : la paire gardée est dite à part, « à republier ».
    await aller(pg, 'garage');
    await pg.waitForFunction(() => { const el = document.querySelector('[data-stock-actuelles]'); return el && el.getAttribute('data-stock-actuelles') !== 'encours'; }, null, { timeout: 40000 });
    await pg.waitForTimeout(800);
    const g = await pg.evaluate(() => [...document.querySelectorAll('[data-stock-repli="gardees"] [data-stock-a-part]')].map((x) => x.getAttribute('data-stock-a-part')).join(','));
    dit(g === '60', `P ${nom} : Stock : N°60 gardée chez toi, à part (« à republier »), pas « en ligne »`, g);
    await ctx.close();
  });
  if (!SEUL || SEUL === 'P') await essaie('P plus tard', async () => {
    const { ctx, MAIN } = await contexte(b, TEL, 'light');
    const pg = await ctx.newPage();
    await aller(pg, 'journee'); await ouvrirTrancher(pg);
    await pg.click(CARTE + ' [data-a-trancher-plus-tard]');
    await pg.waitForTimeout(400);
    const carte0 = !!(await pg.$(CARTE));
    await pg.waitForFunction(() => /7002/.test(localStorage.getItem('vrm_cycle_plus_tard') || ''), null, { timeout: 4000 }).catch(() => {});
    const v = await pg.evaluate(() => ({ pt: localStorage.getItem('vrm_cycle_plus_tard') })); v.carte = carte0;
    dit(!v.carte && /7002/.test(v.pt || ''), '« Plus tard » ⇒ la carte sort, le report est noté (sur l’appareil)', JSON.stringify(v));
    await attendrePartie(pg, 7000);
    await pg.reload({ waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-job]', { timeout: 40000 }).catch(() => {});
    await pg.waitForTimeout(4000);
    if (await pg.$('[data-job="a-trancher"]')) { if ((await pg.getAttribute('[data-job="a-trancher"]', 'aria-expanded')) !== 'true') await pg.click('[data-job="a-trancher"]'); await pg.waitForTimeout(800); }
    dit(!(await pg.$(CARTE)), '« Plus tard » ⇒ pas reposée au rechargement');
    dit(!(MAIN.vrm_cycle_decisions && MAIN.vrm_cycle_decisions['7002']), '« Plus tard » n’écrit aucune réponse');
    await ctx.close();
  });

  // ── T ───────────────────────────────────────────────────────────────────────────
  if (!SEUL || SEUL === 'T') await essaie('T', async () => {
    const { ctx } = await contexte(b, PC, 'light');
    const pg = await ctx.newPage();
    await aller(pg, 'trancher');
    await pg.waitForSelector('[data-at-journee="ouvert"]', { timeout: 40000 }).catch(() => {});
    const t = await pg.evaluate(() => ({ ouvert: !!document.querySelector('[data-at-journee="ouvert"] [data-a-trancher]'), entree: !!document.querySelector('[data-nav-entree="trancher"]') }));
    dit(t.ouvert, 'T : `?tab=trancher` ⇒ Ma journée, la carte « à trancher » ouverte');
    dit(!t.entree, 'T : plus d’entrée « À trancher » dans la navigation');
    await shot(pg, 'T-1512');
    await ctx.close();
  });

  // ── M ───────────────────────────────────────────────────────────────────────────
  if (!SEUL || SEUL === 'M') await essaie('M', async () => {
    const { ctx } = await contexte(b, PC, 'light');
    const pg = await ctx.newPage();
    await aller(pg, 'annonces');
    await pg.waitForSelector('[aria-label="Outils des annonces"]', { timeout: 40000 });
    await pg.click('[aria-label="Outils des annonces"]');
    await pg.waitForSelector('[data-outil-annonces]', { timeout: 10000 });
    const o = await pg.$$eval('[data-outil-annonces]', (l) => l.map((x) => x.getAttribute('data-outil-annonces')));
    dit(o.length > 0 && !o.some((k) => ['lot', 'inv', 'aud'].includes(k)), 'M : Outils d’Annonces : ni « Répartir un lot », ni « Inventaire physique », ni « Audit du stock »', o.join());
    await shot(pg, 'M-outils-1512');
    await ctx.close();
  });

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} rouge(s) — captures : ${SHOTS}` : `\nStock juste : tout est vert — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
