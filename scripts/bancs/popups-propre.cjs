// ════════════════════════════════════════════════════════════════════════════
//  BANC « POP-UPS PROPRES » (9 nov., soir — lot AI, branche claude/popups-propre)
//
//  Julien : « Je veux que tous les textes comme ça soient remplacés par des
//  pop-ups car actuellement ça fait très moche » ; « tu peux proposer des
//  pop-ups pour faire des propositions » ; « deux boutons font la même chose » ;
//  la carte du compte ⇒ Paramètres ; le point du compte Vinted « pas ouf ».
//
//  Données INVENTÉES (dépôt public) : un compte Vinted `compte_test`, son dressing
//  lu il y a 15 h (⇒ « lu hier / aujourd'hui à … »), une annonce supprimée (N°7)
//  et une nouvelle qui lui ressemble (remise en ligne), Vestiaire lu il y a 7 j
//  (à confirmer), une vente à expédier avec son bordereau.
//  390 px tactile (sombre ET clair) et 1512 px. Juge des data-* et des nombres :
//   P1  aucun bloc de texte VISIBLE de plus de SEUIL caractères hors d'une
//       feuille, sur Annonces (Vinted, Toutes, Vestiaire), Stock, Colis, Ma
//       journée. SEUIL = 90 : à 390 px une ligne de 13 px tient ~48 caractères —
//       au-delà de 90, c'est un paragraphe de 2 lignes et plus (ce qu'il refuse).
//       Un texte coupé sur UNE ligne (« … ») n'est pas un paragraphe ;
//   P2  chaque ligne courte (fraîcheur des annonces, Vestiaire, Stock) tient sur
//       une ligne, porte sa pastille ⓘ, ouvre SA pop-up (portail, `[data-feuille]`)
//       qui contient le texte d'avant (la règle, le manque nommé), se ferme à la
//       croix ET à Échap ;
//   P3  la proposition « même paire que N°7 ? » : une puce ; rien n'est relié
//       avant SON clic ; la pop-up porte « Oui, N°7 » / « Non, une autre paire » ;
//       « Oui, N°7 » relie 9303 au N°7 (et seulement là) ;
//   P4  Colis : UN seul bouton qui imprime le lot (« Tout imprimer ») — la ligne
//       « N bordereaux à imprimer » ne porte plus son « Imprimer » ;
//   P5  ordinateur : toucher la carte du compte ouvre Paramètres ;
//   P6  le compte Vinted en haut à droite : un avatar (`.vrm-etat-avatar`), le
//       point devenu badge DEDANS ; aucun rouge rendu (§7) dans l'écran ni l'en-tête.
//  Rouge sur origin/main : P1 (paragraphes), P2/P3 (pas de pop-up), P4, P5, P6.
//  BANC_PORT (7991), BANC_DIST (dist), BANC_CAPTURES (dossier des captures).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { routeMain, attendre } = require('./_base-ecritures.cjs');
const { servir } = require('./_minipgrest.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7991;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-popups-propre');
const SEUIL = 90;
process.env.BANC_SESSION_UID = process.env.BANC_SESSION_UID || '7a1e0c55-2b1d-4c3e-9f00-0000000000ad';
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}

const UID = '7a1e0c55-2b1d-4c3e-9f00-0000000000ad';
const SESSION = { access_token: 'jeton-banc-popups', refresh_token: 'r', totp: [], expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeur.banc@exemple.test', totp: [] } };
const ilYa = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ann = (id, title, heures, extra = {}) => ({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: 'Nike', size_title: '42', size: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: Math.floor((Date.now() - heures * 3600e3) / 1000), ...extra });
const ITEMS = [
  ann(9303, 'Nike Dunk Low Panda taille 42', 2),
  ann(9202, 'Salomon XT-6 noir taille 41', 40, { brand_title: 'Salomon', size_title: '41', size: '41' }),
  ann(9203, 'Asics Gel-1130 argent taille 43', 60, { brand_title: 'Asics', size_title: '43', size: '43' }),
];
const MAIN = () => ({
  vrm_bienvenue_vue: { at: ilYa(1) }, vrm_visite_vue: { at: ilYa(1) },
  vinted_annonce_numeros: {
    '9202': { numero: '5', auto: false, manuelAt: ilYa(30), numberedAt: ilYa(40) },
    '9203': { numero: '6', auto: false, manuelAt: ilYa(50), numberedAt: ilYa(60) },
    '9100': { numero: '7', title: 'Nike Dunk Low Panda taille 42', size: '42', accountId: '111', buyPrice: 35, auto: true, numberedAt: ilYa(400) },
  },
  vinted_used_numeros: [1, 2, 3, 4, 5, 6, 7],
});
const VENTE = { transaction_id: 62000, title: 'Adidas Samba OG noire taille 40', price: { amount: '60', currency_code: 'EUR' }, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: ilYa(6), photo: null };
const LIGNES = () => [
  { id: 'harvest_111_listings', data: { capturedAt: ilYa(15), payload: { items: ITEMS } } },
  { id: 'harvest_111_supprimees', data: { ids: { 9100: ilYa(20) } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYa(0.2), payload: { my_orders: [VENTE] } } },
  { id: 'email_bord_62000', data: { transaction: '62000', filename: 'bordereau-62000.pdf', pdfB64: 'JVBERi0x', modele: VENTE.title, account: 'compte_test', receivedAt: ilYa(5), dateLimite: new Date(Date.now() + 3 * 86400e3).toLocaleDateString('fr-FR') + ' 10 h 00', type: 'vinted' } },
  { id: 'vc_listings', data: { capturedAt: ilYa(7 * 24), complet: false, liens: {}, items: {
    P1: { ref: '41', titre: 'Baskets Nike Dunk Low', photo: '', prix: { valeur: 99, devise: 'EUR', cle: 'price' }, statut: 'on_sale', compte: 'compteA', vuAt: ilYa(7 * 24) },
    P2: { ref: '', titre: 'Adidas Samba', photo: '', prix: { valeur: 70, devise: 'EUR', cle: 'price' }, statut: 'on_sale', compte: 'compteA', vuAt: ilYa(7 * 24) },
  } } },
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', owner: UID, updated_at: ilYa(0), created_at: ilYa(300) }];

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`  ${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + String(d).slice(0, 500) : ''}`); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log(`  ❌ le port ${PORT} est pris (${e.code}) — BANC_PORT=…`); process.exit(1); });

async function ouvrir(b, { url, largeur, sombre }) {
  const base = { main: MAIN(), maj: ilYa(24), ecritures: [] };
  const rows = LIGNES().map((l) => ({ owner: UID, updated_at: ilYa(0), created_at: ilYa(30), ...l }));
  const mobile = largeur < 700;
  const ctx = await b.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris', deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 200)));
  await pg.addInitScript(([s, sombre]) => { try { if (!sessionStorage.getItem('banc_init')) {
    localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id);
    localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
    localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: 'banc' })); localStorage.setItem('vrm_visite_vue', JSON.stringify({ at: 'banc' }));
    sessionStorage.setItem('banc_init', '1'); } } catch (_) {} }, [SESSION, !!sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200, rg) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': rg || `0-${Math.max(0, (Array.isArray(d) ? d.length : 1) - 1)}/${Array.isArray(d) ? d.length : 1}` }, body: JSON.stringify(d) });
    if (/\/rest\/v1\/rpc\//.test(u)) return j(null);
    if (/select=owner&limit=1/.test(u)) return j([{ owner: UID }]);
    const mm = routeMain(req, base); if (mm) return j(mm.body, mm.status);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(req.method() === 'GET' ? ACCS : []);
    if (!/\/rest\/v1\/app_data/.test(u) || req.method() !== 'GET') return j([]);
    const r = servir(rows, u, req.headers()); return j(r.body, 200, r.range);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  // (10 nov., 4e série) Organisation lit SON espace par /api/compte?mode=operations : un espace vide
  // (forme de `VIDE()` de src/operations/metier.js), sinon l'écran ne montre que sa panne. Enregistrée
  // APRÈS la route générale : Playwright essaie la dernière en premier.
  await pg.route(/\/api\/compte\?mode=operations/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, serveur: new Date().toISOString(), equipe: [],
    donnees: { version: 1, revision: 0, missions: [], reservations: [], lots: [], consommables: [], veilles: [], receptions: [], dossiers: [], journal: [], commandes: [] } }) }));
  await pg.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(6500);
  return { pg, ctx, errs, base };
}
const capture = async (pg, nom) => { try { await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); } catch (_) {} };
const toucher = async (pg, sel, mobile) => { const l = pg.locator(sel).filter({ visible: true }).first(); await l.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(() => {}); if (mobile) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };

// P1 — les blocs de texte visibles, hors feuille, dans l'écran.
const paragraphes = (pg, seuil) => pg.evaluate((seuil) => {
  const main = [...document.querySelectorAll('.vrm-main')].find((m) => m.getClientRects().length);
  if (!main) return { pasDEcran: true, longs: [] };
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && +s.opacity > 0.05; };
  const bloc = (d) => /^(block|flex|grid|list-item|table|table-cell|flow-root)$/.test(d);
  const longs = [];
  for (const el of main.querySelectorAll('*')) {
    if (el.closest('[data-feuille], [data-feuille-cadre], svg, script, style, select, table, [aria-hidden="true"], [hidden], details:not([open]) > :not(summary), .vrm-pop-corps')) continue;
    const s = getComputedStyle(el);
    if (!bloc(s.display) || !vis(el)) continue;
    // une feuille de texte : aucun enfant BLOC qui porte du texte
    if ([...el.children].some((c) => bloc(getComputedStyle(c).display) && (c.innerText || '').trim())) continue;
    const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (t.length <= seuil) continue;
    // une ligne coupée (« … ») n'est pas un paragraphe
    const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
    const lignes = Math.round(el.getBoundingClientRect().height / lh);
    if (lignes <= 1) continue;
    longs.push(`${t.length}c/${lignes}l « ${t.slice(0, 110)} »`);
  }
  return { longs };
}, seuil);

// P6 — du rouge rendu (texte, fond, bordure) dans l'écran et l'en-tête (hors feuilles).
const rouges = (pg) => pg.evaluate(() => {
  const rgba = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const rouge = (c) => c && c.a > 0.3 && c.r > 170 && c.g < 80 && c.b < 90;
  const out = [];
  for (const el of document.querySelectorAll('.vrm-main *, .vrm-app-header *')) {
    if (el.closest('[data-feuille], svg')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const s = getComputedStyle(el);
    for (const k of ['color', 'backgroundColor', 'borderLeftColor']) { const c = rgba(s[k]); if (rouge(c) && (k !== 'color' || (el.innerText || '').trim()) && (k !== 'borderLeftColor' || parseFloat(s.borderLeftWidth) > 0)) out.push(`${k} ${s[k]} ${(el.className || el.tagName).toString().slice(0, 40)}`); }
  }
  return out.slice(0, 6);
});

// P2 — une ligne courte : une ligne, ⓘ, ouvre sa pop-up, texte d'avant, se ferme (croix, Échap).
async function popup(pg, mobile, tag, { ligne, nom, attendu, quoi }) {
  const l = pg.locator(ligne).filter({ visible: true }).first();
  const la = await l.count() > 0;
  dit(la, `${tag} : ${quoi} — la ligne courte est là`);
  if (!la) return;
  // (10 nov.) Des pastilles (chacune ouvre la feuille) ou une ligne + ⓘ.
  const m = await l.evaluate((e) => { const b = e.querySelector('[data-popup-ouvrir]'); const r = (b || e).getBoundingClientRect(); return { bouton: !!b, i: !!(e.querySelector('.vrm-pop-i svg') || e.querySelector('.vrm-pop-chip')), h: Math.round(r.height), t: (e.innerText || '').replace(/\s+/g, ' ').trim() }; });
  dit(m.bouton && m.i && m.h <= 48 && m.t.length <= 90, `${tag} : ${quoi} — une ligne (${m.h} px), ⓘ, « ${m.t} »`, JSON.stringify(m));
  await toucher(pg, `${ligne} [data-popup-ouvrir]`, mobile);
  const corps = pg.locator(`[data-popup-corps="${nom}"]`);
  const ouverte = await corps.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
  dit(ouverte && await corps.evaluate((e) => !!e.closest('body > *') && !e.closest('.vrm-main')), `${tag} : ${quoi} — la pop-up s'ouvre (portail, hors de l'écran)`);
  if (!ouverte) return;
  // (10 nov.) La feuille dit d'abord UNE phrase (≤ 12 mots) ; le détail d'avant est replié sous « Pourquoi ? ».
  const phrase = ((await corps.locator('[data-popup-phrase]').allInnerTexts())[0] || '').trim();
  dit(!!phrase && phrase.split(/\s+/).length <= 12, `${tag} : ${quoi} — la feuille dit une phrase de 12 mots au plus`, phrase);
  await corps.locator('[data-popup-pourquoi] > summary').first().click().catch(() => {});
  const txt = (await corps.innerText()).replace(/\s+/g, ' ');
  dit(attendu.every((re) => re.test(txt)), `${tag} : ${quoi} — la pop-up dit le texte d'avant`, txt.slice(0, 300));
  await capture(pg, `${tag.replace(/\s+/g, '-')}-${nom}-popup`);
  await toucher(pg, '[data-feuille-croix]', mobile);
  dit(await corps.waitFor({ state: 'detached', timeout: 4000 }).then(() => true).catch(() => false), `${tag} : ${quoi} — la croix la ferme`);
  await toucher(pg, `${ligne} [data-popup-ouvrir]`, mobile);
  await corps.waitFor({ timeout: 4000 }).catch(() => {});
  await pg.keyboard.press('Escape');
  dit(await corps.waitFor({ state: 'detached', timeout: 4000 }).then(() => true).catch(() => false), `${tag} : ${quoi} — Échap la ferme`);
}

async function ecran(b, largeur, sombre, { nom, url, pret, apres, zone }) {
  const mobile = largeur < 700, tag = `${largeur}${sombre ? ' sombre' : ' clair'} · ${nom}`;
  const { pg, ctx, errs, base } = await ouvrir(b, { url, largeur, sombre });
  try {
    if (pret) await pg.waitForSelector(pret, { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(800);
    await pg.evaluate(() => window.scrollTo(0, 0));
    await capture(pg, `${largeur}-${sombre ? 'sombre' : 'clair'}-${nom}`);
    // La zone changée, amenée au milieu de l'écran (planches avant / après).
    if (zone) { const z = pg.locator(zone).filter({ visible: true }).first(); if (await z.count()) { await z.evaluate((e) => e.scrollIntoView({ block: 'center' })); await pg.waitForTimeout(400); await capture(pg, `${largeur}-${sombre ? 'sombre' : 'clair'}-${nom}-zone`); await pg.evaluate(() => window.scrollTo(0, 0)); } }
    const p = await paragraphes(pg, SEUIL);
    dit(!p.pasDEcran && p.longs.length === 0, `${tag} : P1 — aucun paragraphe visible de plus de ${SEUIL} caractères hors pop-up`, p.pasDEcran ? 'écran absent' : p.longs.join(' | '));
    const nc = await pg.evaluate(() => { const main = [...document.querySelectorAll('.vrm-main')].find((m) => m.getClientRects().length); return main ? (main.innerText || '').replace(/\s+/g, ' ').trim().length : 0; });
    // Le TEXTE COURANT : les phrases (blocs de texte de plus de 30 caractères, hors boutons et pastilles) —
    // c'est le « mur de texte » que Julien refuse ; le total compte aussi titres, chiffres et cartes.
    const np = await pg.evaluate(() => { const main = [...document.querySelectorAll('.vrm-main')].find((m) => m.getClientRects().length); if (!main) return 0; let n = 0;
      const bloc = (d) => /^(block|flex|grid|list-item|table|table-cell|flow-root)$/.test(d);
      for (const el of main.querySelectorAll('*')) { if (el.closest('[data-feuille], button, a, svg, [aria-hidden="true"], [hidden], details:not([open]) > :not(summary)')) continue; const s = getComputedStyle(el); if (!bloc(s.display) || !el.getClientRects().length || s.visibility === 'hidden') continue;
        if ([...el.children].some((c) => bloc(getComputedStyle(c).display) && (c.innerText || '').trim())) continue; const t = (el.innerText || '').replace(/\s+/g, ' ').trim(); if (t.length > 30) { n += t.length; (window.__phrases = window.__phrases || []).push(t); } }
      return n; });
    if (process.env.PHRASES) console.log(await pg.evaluate(() => (window.__phrases || []).map((t) => '    · ' + t).join('\n')));
    console.log(`  CARACTÈRES ${largeur}-${sombre ? 'sombre' : 'clair'}-${nom} total=${nc} phrases=${np}`);
    const rg = await rouges(pg);
    dit(rg.length === 0, `${tag} : P6 — aucun rouge rendu`, rg.join(' | '));
    if (apres) await apres(pg, mobile, tag, base);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | '));
  } catch (e) { dit(false, `${tag} : le scénario a tourné jusqu'au bout`, String(e && e.message).replace(/\x1b\[[0-9;]*m/g, '').slice(0, 300)); await capture(pg, `${largeur}-${nom}-erreur`); }
  finally { await ctx.close(); }
}

const fiches = (pg) => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_annonce_numeros') || '{}') || {}; } catch (_) { return {}; } });

const ECRANS = [
  { nom: 'annonces-vinted', url: '/?tab=annonces&site=vinted', pret: '[data-ann-fraicheur]', zone: '[data-ann-fraicheur]', apres: async (pg, mobile, tag) => {
    await popup(pg, mobile, tag, { ligne: '[data-ann-fraicheur]', nom: 'fraicheur-annonces', quoi: 'fraîcheur des annonces',
      attendu: [/annonces lues/i, /ce que tu as supprimé ou mis en ligne depuis n'y est pas/] });
    // P3 — la proposition : une carte VISUELLE (deux photos, « Même paire ? », [Oui] [Non]), sans paragraphe.
    // (10 nov., lot AM — « les propositions collées entre elles cachent le produit ») La proposition vit SUR la
    // vignette de la nouvelle annonce : ses deux photos = l'ancienne paire (dans la bande, avec son N°) et la
    // vignette elle-même ; une proposition hors de la grille garde sa carte à deux photos en tête.
    const carte = pg.locator('[data-remise-ligne="9303"]').first();
    const la = await carte.count() > 0;
    const m = la ? await carte.evaluate((e) => ({ photos: [...e.querySelectorAll('.vrm-remise-photo')].filter((p) => p.getBoundingClientRect().width > 0).length + (e.closest('[data-carte-annonce="9303"]') && e.closest('[data-carte-annonce="9303"]').querySelector('[data-fiche-photo]') ? 1 : 0), q: (e.querySelector('.vrm-remise-q b') || {}).innerText || '', oui: e.querySelectorAll('[data-remise-oui]').length, non: e.querySelectorAll('[data-remise-non]').length,
      txt: [...e.childNodes].map((c) => c.querySelector && c.querySelector('.vrm-pourquoi') ? (c.querySelector('b') || {}).innerText || '' : c.innerText || '').join(' ').replace(/\s+/g, ' ').trim() })) : null;
    dit(!!m && m.photos === 2 && /Même paire/.test(m.q) && /N°7/.test(m.q) && m.oui === 1 && m.non === 1, `${tag} : P3 — la proposition est une carte : deux photos, « Même paire que N°7 ? », [Oui] [Non]`, JSON.stringify(m));
    dit(!!m && m.txt.length <= 60, `${tag} : P3 — aucun paragraphe sur la carte (${m && m.txt.length} caractères)`, m && m.txt);
    const avant = String(((await fiches(pg))['9303'] || {}).numero || '');
    dit(avant !== '7', `${tag} : P3 — avant SON clic, 9303 ne porte pas le N°7`, JSON.stringify((await fiches(pg))['9303'] || null));
    await capture(pg, `${tag.replace(/\s+/g, '-')}-remise-carte`);
    await toucher(pg, '[data-remise-ligne="9303"] [data-remise-oui="7"]', mobile);
    await attendre(async () => String(((await fiches(pg))['9303'] || {}).numero || '') === '7', 10000);
    dit(String(((await fiches(pg))['9303'] || {}).numero || '') === '7', `${tag} : P3 — « Oui » relie 9303 au N°7`, JSON.stringify((await fiches(pg))['9303'] || null));
  } },
  { nom: 'annonces-toutes', url: '/?tab=annonces&site=toutes', pret: '.vrm-main', zone: '[data-ann-fraicheur]' },
  { nom: 'annonces-vestiaire', url: '/?tab=annonces&site=vestiaire', pret: '[data-vc-annonces]', zone: '[data-vc-annonces-fraicheur]', apres: async (pg, mobile, tag) => {
    await popup(pg, mobile, tag, { ligne: '[data-vc-annonces-fraicheur]', nom: 'vc-fraicheur', quoi: 'fraîcheur Vestiaire',
      attendu: [/\(au moins\)/, /À confirmer/, /la lecture a plus de 24 h/, /Mes articles/] });
  } },
  { nom: 'stock', url: '/?tab=garage', pret: '[data-stock-actuelles]', zone: '[data-stock-actuelles]', apres: async (pg, mobile, tag) => {
    await popup(pg, mobile, tag, { ligne: '[data-stock-resume-court]', nom: 'stock-resume', quoi: 'résumé du Stock',
      attendu: [/rangée/, /pas encore rangée/] });
  } },
  { nom: 'colis', url: '/?tab=cat_bord', pret: '[data-colis-barre]', zone: '[data-colis-prochain]', apres: async (pg, mobile, tag) => {
    const n = await pg.evaluate(() => {
      const vis = (e) => e.getClientRects().length > 0;
      const lot = [...document.querySelectorAll('[data-lot-ouvrir]')].filter(vis).length;
      const agir = [...document.querySelectorAll('[data-colis-prochain-agir]')].filter(vis).map((e) => e.innerText.trim());
      const prochain = (document.querySelector('[data-colis-prochain]') || {}).getAttribute ? document.querySelector('[data-colis-prochain]').getAttribute('data-colis-prochain') : '';
      return { lot, agir, prochain };
    });
    dit(n.lot === 1 && !n.agir.some((t) => /imprimer/i.test(t)), `${tag} : P4 — un seul bouton qui imprime le lot (« Tout imprimer »)`, JSON.stringify(n));
  } },
  { nom: 'journee', url: '/?tab=journee', pret: '.vrm-main[data-ecran="journee"]' },
  // (10 nov., suite — branche claude/textes-courts-suite) Les écrans passés à la même règle
  // (phrase courte, détail replié sous « Pourquoi ? » seulement s'il est indispensable) : P1, P6,
  // CARACTÈRES et « aucune erreur d'app » y sont jugés avec les mêmes données inventées.
  { nom: 'reglages', url: '/?tab=settings', pret: '.vrm-main[data-ecran="settings"]' },
  { nom: 'ventes-vinted', url: '/?tab=ventes&site=vinted', pret: '.vrm-main' },
  { nom: 'ventes-ebay', url: '/?tab=ventes&site=ebay', pret: '.vrm-main' },
  { nom: 'annonces-ebay', url: '/?tab=annonces&site=ebay', pret: '.vrm-main' },
  { nom: 'ventes-leboncoin', url: '/?tab=ventes&site=leboncoin', pret: '.vrm-main' },
  { nom: 'annonces-leboncoin', url: '/?tab=annonces&site=leboncoin', pret: '.vrm-main' },
  { nom: 'ventes-vestiaire', url: '/?tab=ventes&site=vestiaire', pret: '.vrm-main' },
  { nom: 'messages', url: '/?tab=messages', pret: '.vrm-main' },
  { nom: 'messages-leboncoin', url: '/?tab=messages&site=leboncoin', pret: '.vrm-main' },
  { nom: 'achats', url: '/?tab=achats', pret: '.vrm-main' },
  { nom: 'achats-vestiaire', url: '/?tab=achats&site=vestiaire', pret: '.vrm-main' },
  // (10 nov., 3e série — branche claude/textes-courts-3) Argent (Compta, Statistiques, Déclarer,
  // Factures) et Republier, passés à la même règle.
  { nom: 'argent', url: '/?tab=argent', pret: '.vrm-main' },
  { nom: 'argent-stats', url: '/?tab=stats', pret: '.vrm-main' },
  { nom: 'argent-declarer', url: '/?tab=argent_declarer', pret: '.vrm-main' },
  { nom: 'argent-factures', url: '/?tab=invoices', pret: '.vrm-main' },
  // (10 nov., 4e série — branche claude/textes-courts-4) Favoris (avertissement « Aucune garantie contre
  // un blocage Vinted » gardé À L'ÉCRAN, le reste sous « Pourquoi ? »), Organisation (formulaires ouverts
  // un à un : leurs notes), Communauté (carte, classement, groupes), Stock → inventaire.
  { nom: 'favoris', url: '/?tab=messages&site=vinted&vue=favoris', pret: '.vrm-main' },
  { nom: 'organisation', url: '/?tab=organisation', pret: '.vrm-operations', apres: async (pg, mobile, tag) => {
    // Chaque formulaire (onglet ⇒ « Nouvel élément ») : sa note dit une phrase courte, le détail est replié.
    const onglets = await pg.evaluate(() => [...document.querySelectorAll('.ops-onglets button')].map((b) => b.innerText.trim()).filter(Boolean));
    let vus = 0;
    for (const o of onglets) {
      await pg.locator('.ops-onglets button', { hasText: o }).first().click().catch(() => {});
      await pg.waitForTimeout(250);
      const nouveau = pg.locator('.vrm-operations button', { hasText: /^(\+ )?(Nouvel|Nouvelle|Ajouter)/ }).first();
      if (!(await nouveau.count())) continue;
      await nouveau.click().catch(() => {}); await pg.waitForTimeout(300);
      if (!(await pg.locator('.ops-form').count())) continue;
      vus++;
      await pg.locator('.ops-form').first().evaluate((e) => e.scrollIntoView({ block: 'start' })).catch(() => {});
      await capture(pg, `${tag.replace(/\s+/g, '-')}-organisation-form-${vus}`);
      const p = await paragraphes(pg, SEUIL);
      dit(p.longs.length === 0, `${tag} : P1 — formulaire « ${o} » : aucun paragraphe de plus de ${SEUIL} caractères`, p.longs.join(' | '));
      await pg.locator('.ops-form-head button').first().click().catch(() => {}); await pg.waitForTimeout(200);
    }
    dit(vus >= 1, `${tag} : au moins un formulaire d'Organisation ouvert et jugé (${vus})`);
  } },
  { nom: 'communaute', url: '/?tab=communaute', pret: '.vrm-main' },
].filter((e) => !process.env.ECRANS_SEULS || process.env.ECRANS_SEULS.split(',').includes(e.nom));

async function compte(b, sombre) {
  const tag = `1512${sombre ? ' sombre' : ' clair'} · compte`;
  const { pg, ctx, errs } = await ouvrir(b, { url: '/?tab=journee', largeur: 1512, sombre });
  try {
    const carte = pg.locator('[data-nav-compte]').filter({ visible: true }).first();
    const la = await carte.count() > 0;
    dit(la && await carte.evaluate((e) => e.tagName === 'BUTTON'), `${tag} : P5 — la carte du compte est un bouton`);
    if (la) { await carte.click(); await pg.waitForTimeout(1500); }
    dit(la && await pg.locator('.vrm-main[data-ecran="settings"]').count() > 0, `${tag} : P5 — la toucher ouvre Paramètres`);
    const av = await pg.evaluate(() => { const el = [...document.querySelectorAll('[data-etat-actions]')].find((e) => e.offsetParent !== null); if (!el) return null; const a = el.querySelector('.vrm-etat-avatar'); return { avatar: !!a, badge: !!(a && a.querySelector('.vrm-etat-point')), w: a ? Math.round(a.getBoundingClientRect().width) : 0 }; });
    dit(!!av && av.avatar && av.badge && av.w >= 22, `${tag} : P6 — un avatar (le point est son badge)`, JSON.stringify(av));
    await capture(pg, `1512-${sombre ? 'sombre' : 'clair'}-entete-compte`);
    dit(errs.length === 0, `${tag} : aucune erreur d'app`, errs.join(' | '));
  } catch (e) { dit(false, `${tag} : le scénario a tourné jusqu'au bout`, String(e && e.message).slice(0, 300)); }
  finally { await ctx.close(); }
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('  ❌ dist absent — npm run build'); process.exit(1); }
  await new Promise((r) => srv.listen(PORT, r));
  const b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    for (const [largeur, sombre] of [[390, true], [390, false], [1512, false]].filter(([l, s]) => !process.env.VUES_SEULES || process.env.VUES_SEULES.split(',').includes(`${l}${s ? 's' : 'c'}`))) {
      console.log(`\n── ${largeur} ${sombre ? 'sombre' : 'clair'}`);
      for (const e of ECRANS) await ecran(b, largeur, sombre, e);
    }
    if (!process.env.ECRANS_SEULS) { console.log('\n── Carte du compte et avatar (ordinateur)');
    await compte(b, false); await compte(b, true); }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} verts, ${ko} rouges — captures : ${CAPTURES}`);
  process.exit(ko ? 1 : 0);
})();
