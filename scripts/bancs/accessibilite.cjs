// ════════════════════════════════════════════════════════════════════════════
//  BANC « ACCESSIBILITÉ WCAG 2.1 AA » (11 nov., lot accessibilité).
//  Données INVENTÉES (celles du banc clavier-voiceover : un compte, quatre annonces,
//  une vente, un achat), aucune fx/, aucune écriture réelle.
//
//  A. axe-core (paquet npm `axe-core`, version exacte en devDependency) sur CHAQUE
//     écran principal, à 390 px tactile et 1512 px, en clair ET en sombre :
//     règles wcag2a, wcag2aa, wcag21a, wcag21aa. Toute violation d'impact
//     « serious » ou « critical » est ROUGE (EXCEPTIONS ci-dessous, une par une,
//     justifiée — vide de préférence). Les « moderate »/« minor » sont seulement dites.
//  B. Zones tactiles (390 px) : chaque bouton visible fait au moins 44 × 44 px
//     de zone touchable (CLAUDE.md §7) — la boîte du bouton, ou son ::before étendu.
//  C. Feuilles (1512 px, clair et sombre) : « ? » ouvre la feuille des raccourcis,
//     axe y passe aussi (feuille ouverte) ; Échap la ferme et le focus REVIENT là
//     où il était (ici : le bouton du profil, focalisé avant).
//  D. La page : <html lang="fr"> et un <title> non vide qui nomme l'écran.
//  BANC_PORT (aléatoire si absent), BANC_DIST, BANC_CAPTURES, BANC_LARGEUR, BANC_ECRANS=a,b.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { routeMain } = require('./_base-ecritures.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || (20000 + Math.floor(Math.random() * 20000));
const CAPTURES = process.env.BANC_CAPTURES || path.join(require('os').tmpdir(), 'banc-accessibilite');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const PNG = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'icon-512.png'));
const auj = new Date();
const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const photo = (n) => `https://images1.vinted.net/t/01_banc${n}/f800/170000000${n}.jpeg`;
const ann = (id, title, heures, extra = {}) => ({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', size: '42', status: 'Très bon état', view_count: 30, favourite_count: 13, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000), ...extra });
const ITEMS = [
  ann(9303, 'Nike Dunk Low Panda taille 42', 2, { photo: photo(3) }),
  ann(9202, 'Salomon XT-6 noir taille 41', 40, { brand_title: 'Salomon', photo: photo(2), favourite_count: 48 }),
  ann(9401, 'Adidas Handball Spezial taille 43', 90, { brand_title: 'Adidas', photo: photo(4), price: { amount: '65.0', currency_code: 'EUR' } }),
  ann(9402, 'Nike P-6000 noir taille 44', 150, { photo: photo(5), price: { amount: '59.0', currency_code: 'EUR' } }),
];
const VENTES = [{ transaction_id: 9301, title: 'Nike Banc vendue taille 42', price: { amount: '80', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYa(48) }];
const ACHATS = [{ transaction_id: 9501, title: 'Achat Vinted banc', price: { amount: '30', currency_code: 'EUR' }, status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: ilYa(96) }];
const MAIN = () => ({
  vinted_annonce_numeros: {
    '9202': { numero: '5', auto: false, manuelAt: ilYa(30), numberedAt: ilYa(40), buyPrice: '25' },
    '9401': { numero: '12', auto: true, numberedAt: ilYa(90) },
    '9402': { numero: '13', auto: true, numberedAt: ilYa(150) },
  },
  vinted_used_numeros: [5, 12, 13],
});
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const ECRANS = [
  ['journee', 'Ma journée'], ['annonces', 'Annonces'], ['ventes', 'Ventes'], ['cat_bord', 'Colis'], ['messages', 'Messages'],
  ['achats', 'Achats'], ['garage', 'Stock'], ['compta', 'Argent'], ['trancher', 'À trancher'], ['emails', 'E-mails'],
  ['settings', 'Paramètres'],
];
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 180)); } };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop().replace(/"/g, '');
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg.replace(/"/g, '')];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function ouvrir(b, { largeur, sombre, tab }) {
  const base = { main: MAIN(), maj: new Date(Date.now() - 86400e3).toISOString(), ecritures: [] };
  const rows = [
    { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: VENTES } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: ACHATS } } },
    { id: 'vinted_item_details', data: {} },
  ];
  const mobile = largeur < 700;
  const ctx = await b.newContext({ bypassCSP: true, viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route(/images1\.vinted\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: typeof d === 'string' ? d : JSON.stringify(d) });
    if (req.method() !== 'GET' && req.method() !== 'HEAD') ecrits.push({ meth: req.method(), u: u.slice(0, 160), at: Date.now() });
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'banc' }]);
    const mm = routeMain(req, base); if (mm) return j(mm.body, mm.status);
    if (req.method() !== 'GET') return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab || 'journee'}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5000);
  return { pg, ctx, errs, base, ecrits };
}
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [path.join(__dirname, '..', '..')] }), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
// Exceptions JUSTIFIÉES, une par une : { regle, cible (regexp sur le sélecteur), raison }.
const EXCEPTIONS = [];
const excuse = (regle, cible) => EXCEPTIONS.find((e) => e.regle === regle && new RegExp(e.cible).test(cible));
// Les animations d'entrée finies d'abord (un texte en fondu à opacité 0 serait sauté par axe).
const finirAnimations = (pg) => pg.evaluate(() => { try { for (const a of document.getAnimations()) { try { a.finish(); } catch (_) {} } } catch (_) {} });
async function axe(pg, contexte) {
  await finirAnimations(pg);
  await pg.evaluate(AXE);
  return pg.evaluate(async ({ tags, ctx }) => {
    const r = await window.axe.run(ctx ? document.querySelector(ctx) || document : document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, aide: v.help, noeuds: v.nodes.map((n) => ({ cible: n.target.join(' '), html: n.html.replace(/\s+/g, ' ').slice(0, 150), msg: (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 220) })) }));
  }, { tags: TAGS, ctx: contexte || null });
}
function juger(T, nom, viols) {
  const graves = [], legeres = [];
  for (const v of viols) for (const n of v.noeuds) {
    if (excuse(v.id, n.cible)) continue;
    (['serious', 'critical'].includes(v.impact) ? graves : legeres).push(`${v.id} [${v.impact}] ${n.cible} — ${n.html} — ${n.msg}`);
  }
  dit(graves.length === 0, `${T} ${nom} · aucune violation axe « serious »/« critical »`, `${graves.length} : ` + graves.slice(0, 8).join(' ║ '));
  if (legeres.length) console.log(`     ℹ︎ ${legeres.length} moindre(s) : ` + legeres.slice(0, 3).join(' ║ '));
  if (process.env.BANC_DUMP) for (const g of graves) console.log('       · ' + g);
}
// B : zones tactiles. Un bouton (ou lien-bouton) visible plus petit que 44 × 44 px
// en boîte, et sans zone étendue (::before/::after en position absolue plus grand).
async function petitesCibles(pg) {
  await finirAnimations(pg);
  return pg.evaluate(() => {
    const out = [];
    const sel = 'button, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], input[type="checkbox"], input[type="radio"], a.vrm-lien-action, a[role]';
    for (const e of document.querySelectorAll(sel)) {
      if (e.closest('[aria-hidden="true"],[inert]')) continue;
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (r.bottom < 0 || r.top > innerHeight * 3) continue;
      const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      let w = r.width, h = r.height;
      for (const p of ['::before', '::after']) {
        const s = getComputedStyle(e, p);
        if (s.content && s.content !== 'none' && s.position === 'absolute') {
          const ins = (k) => parseFloat(s[k]) || 0;
          w = Math.max(w, r.width - ins('left') - ins('right')); h = Math.max(h, r.height - ins('top') - ins('bottom'));
        }
      }
      // Le label d'une case (la cible au doigt est le label entier).
      if (e.tagName === 'INPUT') { const l = e.closest('label'); if (l) { const lr = l.getBoundingClientRect(); w = Math.max(w, lr.width); h = Math.max(h, lr.height); } }
      if (w + 0.5 < 44 || h + 0.5 < 44) out.push(`${Math.round(w)}×${Math.round(h)} ${(e.outerHTML || '').replace(/\s+/g, ' ').slice(0, 120)}`);
    }
    return out;
  });
}

async function main() {
  srv.listen(PORT);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const SEUL = (process.env.BANC_ECRANS || '').split(',').filter(Boolean);
  try {
    for (const largeur of [390, 1512].filter((l) => !process.env.BANC_LARGEUR || String(l) === process.env.BANC_LARGEUR)) {
      for (const sombre of [false, true]) {
        const T = `${largeur < 700 ? '📱' : '🖥️'}${sombre ? '🌙' : '☀️'}`;
        for (const [tab, nom] of ECRANS) {
          if (SEUL.length && !SEUL.includes(tab)) continue;
          await essaie(`${T} ${nom}`, async () => {
            const { pg, ctx, errs } = await ouvrir(b, { largeur, sombre, tab });
            await capture(pg, `${tab}-${largeur}-${sombre ? 'sombre' : 'clair'}`);
            juger(T, nom, await axe(pg));
            if (largeur < 700 && !sombre) {
              const p = await petitesCibles(pg);
              dit(p.length === 0, `${T} ${nom} · B chaque bouton offre 44 × 44 px au doigt`, `${p.length} : ` + p.slice(0, 6).join(' ║ '));
            }
            if (tab === 'journee' && !sombre) {
              const d = await pg.evaluate(() => ({ lang: document.documentElement.getAttribute('lang'), titre: document.title }));
              dit(d.lang === 'fr', `${T} D <html lang="fr">`, JSON.stringify(d));
              dit(/\S/.test(d.titre || '') && /VRM/.test(d.titre), `${T} D la page a un titre`, JSON.stringify(d));
            }
            dit(errs.length === 0, `${T} ${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
            await ctx.close();
          });
        }
      }
    }
    // ── C. Une feuille : axe dedans, focus rendu à la fermeture ───────────────
    for (const sombre of [false, true]) {
      if (SEUL.length || process.env.BANC_LARGEUR === '390') break;
      const T = `🖥️${sombre ? '🌙' : '☀️'}`;
      await essaie(`${T} feuille`, async () => {
        const { pg, ctx, errs } = await ouvrir(b, { largeur: 1512, sombre, tab: 'journee' });
        // Un déclencheur focalisé AVANT : le focus doit y revenir.
        const avant = await pg.evaluate(() => {
          const c = [...document.querySelectorAll('main button:not([disabled])')].find((e) => e.getClientRects().length);
          if (!c) return null; c.setAttribute('data-banc-avant', '1'); c.focus(); return document.activeElement === c;
        });
        await pg.keyboard.press('Shift+?'); await pg.waitForTimeout(800);
        const ouverte = await pg.evaluate(() => !!document.querySelector('[data-raccourcis-clavier]'));
        dit(avant && ouverte, `${T} C la feuille des raccourcis s'ouvre (un bouton focalisé avant)`, JSON.stringify({ avant, ouverte }));
        await capture(pg, `feuille-1512-${sombre ? 'sombre' : 'clair'}`);
        const viols = await axe(pg, '[role="dialog"]');
        juger(T, 'feuille ouverte', viols);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(700);
        const rendu = await pg.evaluate(() => ({ ferme: !document.querySelector('[data-raccourcis-clavier]'), retour: !!(document.activeElement && document.activeElement.hasAttribute('data-banc-avant')), actif: (document.activeElement && document.activeElement.outerHTML || '').slice(0, 100) }));
        dit(rendu.ferme && rendu.retour, `${T} C Échap ferme la feuille et rend le focus au bouton d'avant`, JSON.stringify(rendu));
        dit(errs.length === 0, `${T} feuille · aucune erreur de page`, errs.slice(0, 2).join(' | '));
        await ctx.close();
      });
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} ✅ · ${ko} ❌ — captures : ${CAPTURES}`);
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
