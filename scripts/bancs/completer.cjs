require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « COMPLÉTER » (19 nov. 2026, lot completer-infos) — l'atelier, RENDU et JOUÉ.
//  390 × 844 tactile et 1512, clair et sombre. Base INVENTÉE (aucune donnée réelle) :
//  60 annonces en ligne numérotées (51 sans prix mini, 33 sans prix d'achat), 4 ventes
//  récentes sans achat (+ 2 de plus de 30 jours), 53 achats dont 50 AU MÊME TITRE.
//   E. l'entrée : Ma journée ne porte plus les cartes « N sans … », UNE entrée « à compléter » ;
//   J. dix articles d'affilée au doigt : le nombre de touchers par article et le temps entre
//      deux cartes sont MESURÉS ; relier écrit l'achat de la carte touchée et SON prix (parmi
//      50 au même titre) ; une puce écrit le prix mini montré ; « Je ne sais plus » n'écrit
//      aucun prix ; « Annuler » (bandeau) rend l'état d'avant ;
//   L. la règle en lot : ouvrir, « −15 % », « Poser N » = 3 touchers ; l'aperçu = ce qui est
//      écrit ; décoché = pas écrit ; « Annuler » = tout revient ;
//   F. la forme : un seul bouton plein, cibles ≥ 44 px, rien hors de l'écran ni sous la zone
//      sûre, aucun texte coupé, contrastes ≥ 4,5:1 ; la carte suivante est déjà dessinée ;
//   O. l'ordinateur : la file à gauche, la carte à droite, tout au clavier (1 = relier, chiffres +
//      Entrée, Tab), la grille éditable.
//  Captures dans SHOTS — à REGARDER (§6.2). Sur le build d'avant : pas d'atelier ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-completer');
fs.mkdirSync(SHOTS, { recursive: true });
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
let ko = 0, nOk = 0;
const dit = (bon, quoi, det) => { if (bon) nOk++; else ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det !== undefined ? ' — ' + String(typeof det === 'string' ? det : JSON.stringify(det)).slice(0, 600) : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ── La base inventée ────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString(), ts = (j) => Math.floor((now - j * 86400000) / 1000);
const TEINTES = ['#3B6EA8', '#8A5A44', '#4F7A5B', '#7A4F6E', '#A8763B', '#3D8A8A', '#555E6B', '#9A4A4A'];
const img = (i, t) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="${TEINTES[i % TEINTES.length]}"/><ellipse cx="160" cy="205" rx="118" ry="44" fill="rgba(255,255,255,.82)"/><rect x="60" y="150" width="150" height="56" rx="26" fill="rgba(255,255,255,.82)"/><text x="160" y="84" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif">${t}</text></svg>`);
const MODS = [['New Balance', '550 crème'], ['Salomon', 'XT-6 grise'], ['Puma', 'Suede rouge'], ['Reebok', 'Club C verte'], ['Vans', 'Old Skool bleue'], ['Converse', 'Chuck 70 jaune']];
const prixDe = (i) => (i === 1 ? 85 : i === 2 ? 70 : i >= 34 && i <= 51 ? 200 - i : 40 + i);
const titreDe = (i) => (i === 1 ? 'Nike Air Max 90 blanche taille 42' : i === 2 ? 'Adidas Spezial noire taille 42' : `${MODS[i % 6][0]} ${MODS[i % 6][1]} taille ${38 + (i % 8)} réf ${i}`);
const ANNONCES = Array.from({ length: 60 }, (_, k) => { const i = k + 1; return { id: 51000 + i, title: titreDe(i), price: { amount: String(prixDe(i)) + '.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false,
  photo: { url: img(i, 'N°' + (100 + i)) }, brand_title: i === 1 ? 'Nike' : i === 2 ? 'Adidas' : MODS[i % 6][0], size_title: i <= 2 ? '42' : String(38 + (i % 8)), status: 'Très bon état', view_count: 10 + i, favourite_count: i === 1 ? 5 : i === 2 ? 3 : 0, created_at_ts: ts(i === 1 ? 6 : i === 2 ? 4 : 3 + i) }; });
const NUMEROS = Object.fromEntries(ANNONCES.map((a, k) => { const i = k + 1; return [String(a.id), { numero: String(100 + i), title: a.title, ...(i >= 34 ? { buyPrice: i === 50 ? '140' : i === 51 ? '135' : String(18 + i) } : {}), ...(i >= 52 ? { min: String(prixDe(i) - 12) } : {}) }]; }));
const vente = (i, titre, prix, jours) => ({ transaction_id: 6200000 + i, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(jours), photo: { url: img(i + 3, 'vendue') } });
const VENTES = [vente(1, 'Asics Gel-1130 argent taille 43', 78, 1), vente(2, 'Salomon XT-6 grise taille 44', 96, 3), vente(3, 'Puma Suede rouge taille 41', 54, 5), vente(4, 'Reebok Club C verte taille 40', 61, 8),
  vente(5, 'Vans Old Skool bleue taille 42', 48, 45), vente(6, 'Converse Chuck 70 jaune taille 39', 52, 60)];
const achat = (i, titre, prix, jours) => ({ transaction_id: 7300000 + i, conversation_id: 8400000 + i, title: titre, price: { amount: prix.toFixed(2), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(jours), photo: { url: img(i, 'achat') }, user_login: 'vendeur_' + i });
const ACHATS = [achat(1, 'Nike Air Max 90 blanche 42', 52, 15), achat(2, 'Asics Gel 1130 argent 43', 41.5, 30), achat(3, 'Lot 3 paires Timberland', 90, 20),
  ...Array.from({ length: 50 }, (_, k) => achat(100 + k, 'Adidas Spezial noire', 30 + k + (k % 10) / 10, 20 + (k % 20)))];
const base0 = (NV) => ({ lignes: [
  { id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vinted_offres_auto: true, vinted_annonce_numeros: JSON.parse(JSON.stringify(NUMEROS)) } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(0.01), payload: { items: ANNONCES } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(0.01), payload: { my_orders: ACHATS } } },
], comptes: NV.JEU_COMPTES.slice(0, 1), ecritures: 0 });

// ── Les outils du banc ──────────────────────────────────────────────────────
const local = async (pg, k) => { await attendre(900); return pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k); };
const etat = (pg) => pg.evaluate(() => {
  const c = document.querySelector('[data-cp-carte]'); const q = document.querySelector('[data-cp-question]');
  return { ouvert: !!document.querySelector('[data-completer]'), vue: (document.querySelector('[data-completer]') || { getAttribute: () => '' }).getAttribute('data-cp-vue'), carte: c ? c.getAttribute('data-cp-carte') : '',
    question: q ? q.getAttribute('data-cp-question') : '', mode: q ? q.getAttribute('data-cp-mode') : '', progres: (document.querySelector('[data-cp-progres]') || { getAttribute: () => '' }).getAttribute('data-cp-progres'),
    achats: [...document.querySelectorAll('[data-cp-carte] [data-cp-achat]')].map((e) => ({ tx: e.getAttribute('data-cp-achat'), prix: e.getAttribute('data-cp-achat-prix'), niveau: e.getAttribute('data-cp-niveau') })),
    puces: [...document.querySelectorAll('[data-cp-carte] [data-cp-puce]')].map((e) => ({ id: e.getAttribute('data-cp-puce'), valeur: e.getAttribute('data-cp-puce-valeur'), sous: e.getAttribute('data-cp-puce-sous') === '1' })),
    suivante: (document.querySelector('[data-cp-suivante]') || { getAttribute: () => '' }).getAttribute('data-cp-suivante'), fin: !!document.querySelector('[data-cp-fin]'),
    bandeau: (document.querySelector('[data-cp-bandeau]') || { getAttribute: () => '' }).getAttribute('data-cp-bandeau') || '' };
});
// La forme de l'écran courant : pleins, cibles, débords, textes coupés, contrastes.
const forme = (pg) => pg.evaluate(() => {
  const P = document.querySelector('[data-completer]'); if (!P) return null;
  const feuille = [...document.querySelectorAll('[data-n-feuille-couche][data-n-etat="ouverte"]')].pop() || null;
  const racines = [feuille || P, ...document.querySelectorAll('.n-toast')];
  const tous = (sel) => racines.flatMap((r) => [...r.querySelectorAll(sel)]);
  const vis = (e) => { if (e.closest('.is-suivante')) return false; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const W = window.innerWidth, H = window.innerHeight;
  const nom = (e) => (typeof e.className === 'string' && e.className.split(' ')[0]) || e.tagName;
  const defile = (e) => !!e.closest('.n-feuille-corps, .vrm-cp-grille, .vrm-cp-file');
  const pleins = tous('[data-n-variante="plein"]').filter(vis).length;
  const petits = tous('button, a, input[type="text"]').filter(vis).filter((e) => !e.closest('.vrm-cp-grille') && !e.classList.contains('n-feuille-poignee')).map((e) => ({ r: e.getBoundingClientRect(), e }))
    .filter(({ r }) => r.height < 43.5 || r.width < 43.5).map(({ r, e }) => `${nom(e)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  const hors = tous('button, img, h1, h2, p, .vrm-cp-affiche, .vrm-cp-photo').filter(vis).filter((e) => !defile(e)).map((e) => ({ r: e.getBoundingClientRect(), e }))
    .filter(({ r }) => r.left < -0.5 || r.right > W + 0.5 || r.top < -0.5 || r.bottom > H + 0.5).map(({ r, e }) => `${nom(e)} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
  const coupes = tous('.vrm-cp-q, .n-rangee-valeur, .vrm-cp-puce-val, .n-bouton-libelle, .n-barre-centre, .vrm-cp-affiche-n, .n-fait-valeur, .n-segmente-libelle, .n-feuille-titre, .n-plaque').filter(vis).filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => nom(e) + ' « ' + e.textContent.trim().slice(0, 30) + ' »');
  // Le contraste se juge sur le fond RENDU : les calques translucides (bouton teinté) sont composés jusqu'au premier fond opaque.
  const rgba = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondDe = (e) => { const couches = []; for (let x = e; x; x = x.parentElement) { const c = rgba(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { couches.push(c); if (c.a >= 1) break; } }
    let f = { r: 255, g: 255, b: 255 }; for (const c of couches.reverse()) f = { r: c.r * c.a + f.r * (1 - c.a), g: c.g * c.a + f.g * (1 - c.a), b: c.b * c.a + f.b * (1 - c.a) }; return f; };
  const texteDirect = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const faibles = tous('*').filter((e) => texteDirect(e) && vis(e) && !e.closest('[aria-disabled="true"], :disabled, .vrm-cp-photo')).map((e) => { const st = getComputedStyle(e); const t = rgba(st.color); if (!t || Number(st.opacity) === 0) return null; const fd = fondDe(e);
    const a = lum({ r: t.r * t.a + fd.r * (1 - t.a), g: t.g * t.a + fd.g * (1 - t.a), b: t.b * t.a + fd.b * (1 - t.a) }), b = lum(fd); const c = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return c < 4.5 ? `${nom(e)} « ${e.textContent.trim().slice(0, 18)} » ${c.toFixed(2)}` : null; }).filter(Boolean);
  const tailles = [...new Set(tous('*').filter((e) => texteDirect(e) && vis(e)).map((e) => { const st = getComputedStyle(e); return Math.round(parseFloat(st.fontSize)) + '/' + st.fontWeight; }))].filter((x) => !/^(13|15|17|22|34)\/(400|600|700)$/.test(x));
  const ph = P.querySelector('[data-cp-carte] .vrm-cp-photo img'); const rp = ph ? ph.getBoundingClientRect() : null;
  return { pleins, petits: [...new Set(petits)], hors, coupes, faibles: [...new Set(faibles)], tailles, photo: rp ? { h: Math.round(rp.height), w: Math.round(rp.width), charge: ph.complete && ph.naturalWidth > 0 } : null,
    zone: W < 600 ? tous('button, img, h1, h2, .vrm-cp-affiche').filter(vis).filter((e) => !defile(e)).map((e) => ({ r: e.getBoundingClientRect(), e })).filter(({ r }) => r.top < 46.5 || r.bottom > H - 33.5).map(({ r, e }) => `${nom(e)} ${Math.round(r.top)}–${Math.round(r.bottom)}`) : null,
    defileX: document.documentElement.scrollWidth > W + 1, plaque: !!P.querySelector('[data-cp-carte] .vrm-cp-plaque .n-plaque'), titre: (P.querySelector('[data-cp-carte] [data-cp-titre]') || { textContent: '' }).textContent };
});
const jugerForme = (f, tag, quoi) => {
  if (f && f.zone) dit(!f.zone.length, `F ${tag} ${quoi} : rien dans la zone sûre (haut 47 px, bas 34 px)`, f.zone);
  dit(f && f.pleins <= 1, `F ${tag} ${quoi} : un seul bouton plein`, f && f.pleins);
  dit(f && !f.petits.length, `F ${tag} ${quoi} : cibles ≥ 44 px`, f && f.petits);
  dit(f && !f.hors.length && !f.defileX, `F ${tag} ${quoi} : rien hors de l'écran, aucun défilement horizontal`, f && f.hors);
  dit(f && !f.coupes.length, `F ${tag} ${quoi} : aucun texte coupé`, f && f.coupes);
  dit(f && !f.faibles.length, `F ${tag} ${quoi} : contrastes ≥ 4,5:1`, f && f.faibles);
  dit(f && !f.tailles.length, `F ${tag} ${quoi} : tailles 13 · 15 · 17 · 22 · 34, graisses 400 / 600 / 700`, f && f.tailles);
};
const ouvrirPorte = (pg, d) => pg.evaluate((d) => window.dispatchEvent(new CustomEvent('vrm:completer', { detail: { sujet: 'tout', num: '', lot: false, ...d } })), d);

(async () => {
  const NV = require('./nouveau-vendeur.cjs');
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const mesures = [];
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const tag = `${W}-${theme}`, sombre = theme === 'sombre', tel = W < 600;
      const base = base0(NV);
      const { ctx, pg, journal } = await NV.ouvrir(nav, { W, sombre, base, tab: 'journee' });
      const shot = (nom) => pg.screenshot({ path: path.join(SHOTS, `${nom}-${tag}.png`) }).catch(() => {});
      let zoneSure = false;
      if (tel) { try { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }); zoneSure = true; } catch (_) { zoneSure = false; } }
      if (tel) dit(zoneSure, `F ${tag} : la zone sûre de l'iPhone est posée (47 px en haut, 34 px en bas)`);
      // Les touchers et le temps entre deux cartes, mesurés DANS la page.
      await pg.addInitScript(() => {
        window.__cp = { touchers: 0, t0: 0, deltas: [] };
        const noter = () => { window.__cp.touchers++; window.__cp.t0 = performance.now(); };
        window.addEventListener('pointerdown', (e) => { if (e.target && e.target.closest && e.target.closest('[data-completer]')) noter(); }, true);
        let derniere = '';
        const obs = new MutationObserver(() => { const c = document.querySelector('[data-cp-carte]'); const q = document.querySelector('[data-cp-question]'); const k = (c ? c.getAttribute('data-cp-carte') : '') + '|' + (q ? q.getAttribute('data-cp-question') : '');
          if (k !== derniere) { derniere = k; if (window.__cp.t0) { const t0 = window.__cp.t0; requestAnimationFrame(() => window.__cp.deltas.push(Math.round(performance.now() - t0))); window.__cp.t0 = 0; } } })
        ;
        const brancher = () => obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-cp-carte', 'data-cp-question'] });
        if (document.documentElement) brancher(); else document.addEventListener('readystatechange', brancher, { once: true });
      });
      const toucher = async (sel) => { const l = pg.locator(sel).first(); if (tel) await l.tap({ timeout: 8000 }); else await l.click({ timeout: 8000 }); };
      const touchers = () => pg.evaluate(() => window.__cp.touchers);
      try {
        await pg.goto(`http://localhost:${NV.PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
        // ── E : l'entrée ──
        const selEntree = '[data-job="completer"], [data-v2-job^="completer"]';
        await pg.waitForSelector(selEntree, { timeout: 30000 }).catch(() => {});
        const entree = await pg.evaluate((sel) => { const e = document.querySelector(sel); const vieux = ['prix-mini-manquants', 'achat-a-relier', 'numeros-a-donner', 'prix-achat-vente'].filter((id) => document.querySelector(`[data-job="${id}"], [data-v2-job^="${id}"]`));
          return { n: e ? e.getAttribute('data-n') : null, txt: e ? e.innerText.replace(/\s+/g, ' ').slice(0, 120) : '', vieux }; }, selEntree);
        dit(entree.n === '88' && !entree.vieux.length, `E ${tag} : UNE entrée « 88 infos à compléter » (51 prix mini + 33 + 4 prix d'achat), plus aucune carte « N sans … »`, entree);
        if (tel && theme === 'clair') { await pg.locator(selEntree).first().scrollIntoViewIfNeeded().catch(() => {}); await attendre(200); await shot('entree'); }
        const gesteEntree = '[data-job="completer"] button, [data-v2-geste^="completer"], [data-job="completer"]';
        await pg.locator(gesteEntree).first().click({ timeout: 8000 }).catch(async () => { await ouvrirPorte(pg, {}); });
        await pg.waitForSelector('[data-cp-carte]', { timeout: 30000 }).catch(() => {});
        let e = await etat(pg);
        dit(e.ouvert && e.carte === 'v:6200001' && e.question === 'achat' && e.progres === '1/55', `E ${tag} : l'atelier s'ouvre sur la vente la plus récente, « 1 sur 55 »`, e);
        // Les achats arrivent (lecture + affectation) : la « très probable » de la vente.
        await pg.waitForFunction(() => document.querySelectorAll('[data-cp-carte] [data-cp-achat]').length > 0, null, { timeout: 30000 }).catch(() => {});
        e = await etat(pg);
        dit(e.achats.length === 1 && e.achats[0].tx === '7300002' && e.achats[0].prix === '41.5', `J ${tag} : la vente « Asics Gel-1130 argent 43 » reçoit UN achat proposé (7300002, payé 41,50 €)`, e.achats);
        dit(e.suivante === 'v:6200002', `F ${tag} : la carte suivante est déjà dessinée (cachée)`, e.suivante);
        await attendre(350);
        jugerForme(await forme(pg), tag, 'carte « achat proposé »');
        const f0 = await forme(pg);
        dit(f0 && f0.photo && f0.photo.charge && f0.photo.h >= (tel ? 150 : 200) && f0.plaque === true, `F ${tag} : la photo en grand (≥ ${tel ? 150 : 200} px de haut), chargée, sa plaque N° dessus`, f0 && f0.photo);
        await shot('carte-achat');

        if (tel) {
          // ── J : dix articles d'affilée, au doigt ──
          const journalJ = []; let t0 = await touchers();
          const fini = async (nom, cleAvant) => { await pg.waitForFunction((c) => { const x = document.querySelector('[data-cp-carte]'); return !x || x.getAttribute('data-cp-carte') !== c; }, cleAvant, { timeout: 8000 }).catch(() => {}); const t1 = await touchers(); journalJ.push({ article: cleAvant, quoi: nom, touchers: t1 - t0 }); t0 = t1; };
          // 1. la vente 6200001 : un toucher relie.
          await toucher('[data-cp-carte] [data-cp-achat="7300002"]'); await fini('achat proposé', 'v:6200001');
          if (process.env.BANC_DEBUG) console.log('     page : ' + JSON.stringify([...journal.erreurs, ...journal.console]).slice(0, 1500));
          let ov = await local(pg, 'vinted_sale_overrides');
          dit(ov && ov['6200001'] && String(ov['6200001'].buyFromId) === '7300002' && Number(String(ov['6200001'].buyPrice).replace(',', '.')) === 41.5, `J ${tag} : un toucher relie la vente à CET achat, à SON prix payé`, ov && ov['6200001']);
          e = await etat(pg);
          dit(e.bandeau && e.carte === 'v:6200002', `J ${tag} : la carte suivante arrive seule, le bandeau « Annuler » est là`, e);
          // 2. la vente 6200002 : aucun achat proposé ⇒ le pavé : 4, 0, OK.
          dit(e.mode === 'pave' && !e.achats.length, `J ${tag} : sans achat proposé, le pavé est là tout de suite`, e);
          await attendre(300); jugerForme(await forme(pg), tag, 'carte « pavé »'); if (theme === 'clair') await shot('carte-pave');
          await toucher('[data-cp-carte] [data-cp-touche="4"]'); await toucher('[data-cp-carte] [data-cp-touche="0"]'); await toucher('[data-cp-ok]'); await fini('prix tapé', 'v:6200002');
          ov = await local(pg, 'vinted_sale_overrides');
          dit(ov && ov['6200002'] && ov['6200002'].buyPrice === '40,00' && !ov['6200002'].buyFromId, `J ${tag} : « 40 » tapé ⇒ 40,00 € sur la vente 6200002, aucun achat relié`, ov && ov['6200002']);
          // 3. la vente 6200003 : « Je ne sais plus ».
          await toucher('[data-cp-carte] [data-cp-sans="achat"]'); await fini('je ne sais plus', 'v:6200003');
          ov = await local(pg, 'vinted_sale_overrides'); const sans = await local(pg, 'vrm_completer_sans');
          dit(!(ov && ov['6200003']) && sans && sans['v:6200003|achat'], `J ${tag} : « Je ne sais plus » ⇒ noté, AUCUN prix écrit`, { ov: ov && ov['6200003'], sans });
          // 4. la vente 6200004 : 3, 5, OK.
          await toucher('[data-cp-carte] [data-cp-touche="3"]'); await toucher('[data-cp-carte] [data-cp-touche="5"]'); await toucher('[data-cp-ok]'); await fini('prix tapé', 'v:6200004');
          // 5. N°101 (favoris) : achat proposé, puis le prix mini par une puce.
          await pg.waitForFunction(() => document.querySelectorAll('[data-cp-carte] [data-cp-achat]').length > 0, null, { timeout: 8000 }).catch(() => {});
          e = await etat(pg);
          dit(e.carte === 'a:51001' && e.achats.length === 1 && e.achats[0].tx === '7300001', `J ${tag} : puis l'annonce regardée (N°101, 5 favoris) et son achat proposé`, e);
          await toucher('[data-cp-carte] [data-cp-achat="7300001"]');
          await pg.waitForFunction(() => { const q = document.querySelector('[data-cp-question]'); return q && q.getAttribute('data-cp-question') === 'mini'; }, null, { timeout: 8000 }).catch(() => {});
          e = await etat(pg);
          dit(e.carte === 'a:51001' && e.question === 'mini' && JSON.stringify(e.puces.map((p) => [p.id, p.valeur])) === JSON.stringify([['p10', '76'], ['p15', '72'], ['p20', '68'], ['a10', '62']]),
            `J ${tag} : la question suivante du MÊME article : « Ton prix mini ? » — 85 € ⇒ 76 / 72 / 68, achat 52 € + 10 ⇒ 62`, e.puces);
          await attendre(300); jugerForme(await forme(pg), tag, 'carte « prix mini »'); await shot('carte-prix-mini');
          await toucher('[data-cp-carte] [data-cp-puce="p15"]'); await fini('achat proposé + puce', 'a:51001');
          let fiches = await local(pg, 'vinted_annonce_numeros');
          dit(fiches['51001'].min === '72' && String(fiches['51001'].buyFromId) === '7300001' && Number(String(fiches['51001'].buyPrice).replace(',', '.')) === 52, `J ${tag} : N°101 — achat 7300001 à 52 €, prix mini 72 € (ce que la puce disait)`, fiches['51001']);
          // 6. N°102 « Adidas Spezial noire » : 50 achats au même titre ⇒ 3 cartes ; toucher la 2e.
          await pg.waitForFunction(() => document.querySelectorAll('[data-cp-carte] [data-cp-achat]').length > 0, null, { timeout: 8000 }).catch(() => {});
          e = await etat(pg);
          dit(e.carte === 'a:51002' && e.achats.length === 3 && new Set(e.achats.map((a) => a.tx)).size === 3, `J ${tag} : N°102, 50 achats au même titre ⇒ 3 cartes au plus, chacune SON achat`, e.achats);
          await attendre(300); jugerForme(await forme(pg), tag, 'carte « 3 achats »'); if (theme === 'clair') await shot('carte-3-achats');
          const choisi = e.achats[1] || e.achats[0] || { tx: '', prix: '' };
          if (choisi.tx) await toucher(`[data-cp-carte] [data-cp-achat="${choisi.tx}"]`);
          await pg.waitForFunction(() => { const q = document.querySelector('[data-cp-question]'); return q && q.getAttribute('data-cp-question') === 'mini'; }, null, { timeout: 8000 }).catch(() => {});
          fiches = await local(pg, 'vinted_annonce_numeros');
          const autres = Object.entries(fiches).filter(([k, f]) => k !== '51002' && f && String(f.buyFromId || '') === choisi.tx).length;
          dit(!!choisi.tx && String(fiches['51002'].buyFromId) === choisi.tx && Number(String(fiches['51002'].buyPrice).replace(',', '.')) === Number(choisi.prix) && autres === 0,
            `J ${tag} : la 2e carte touchée ⇒ CET achat (${choisi.tx}) et SON prix (${choisi.prix} €), jamais un voisin au même titre`, fiches['51002']);
          await toucher('[data-cp-carte] [data-cp-puce="p10"]'); await fini('achat choisi + puce', 'a:51002');
          // 7 à 10. quatre annonces qui n'ont besoin que du prix mini : un toucher chacune.
          for (let k = 0; k < 4; k++) {
            e = await etat(pg);
            const p = e.puces.find((x) => x.id === 'p15') || e.puces[0];
            if (!p) { dit(false, `J ${tag} : article ${7 + k} — des puces`, e); break; }
            await toucher(`[data-cp-carte] [data-cp-puce="${p.id}"]`); await fini('puce', e.carte);
            if (k === 0) {
              // « Annuler » (bandeau) : l'état d'avant, l'article revient.
              const id = e.carte.slice(2);
              fiches = await local(pg, 'vinted_annonce_numeros');
              const pose = fiches[id] && fiches[id].min;
              await pg.waitForSelector('[data-cp-bandeau] .n-toast-action', { timeout: 4000 }).catch(() => {});
              await toucher('[data-cp-bandeau] .n-toast-action');
              await pg.waitForFunction((c) => { const x = document.querySelector('[data-cp-carte]'); return x && x.getAttribute('data-cp-carte') === c; }, e.carte, { timeout: 8000 }).catch(() => {});
              await attendre(900);
              fiches = await local(pg, 'vinted_annonce_numeros');
              const e2 = await etat(pg);
              dit(pose === p.valeur && !(fiches[id] && fiches[id].min) && e2.carte === e.carte, `J ${tag} : « Annuler » rend l'état d'avant (prix mini retiré) et l'article revient`, { pose, apres: fiches[id], carte: e2.carte });
              t0 = await touchers(); journalJ.pop();
              await toucher(`[data-cp-carte] [data-cp-puce="${p.id}"]`); await fini('puce', e.carte);
            }
          }
          const total = journalJ.reduce((s, x) => s + x.touchers, 0);
          const deltas = await pg.evaluate(() => window.__cp.deltas.slice());
          const med = deltas.slice().sort((a, b) => a - b)[Math.floor(deltas.length / 2)] || 0, max = Math.max(0, ...deltas);
          mesures.push({ tag, articles: journalJ.length, touchers: total, parArticle: (total / Math.max(1, journalJ.length)).toFixed(1), detail: journalJ.map((x) => `${x.quoi} ${x.touchers}`), cartesMs: { mediane: med, max, n: deltas.length } });
          dit(journalJ.length === 10 && total / 10 <= 2, `J ${tag} : dix articles d'affilée, ${total} touchers ⇒ ${(total / 10).toFixed(1)} par article (objectif : 1 à 2)`, journalJ);
          dit(journalJ.filter((x) => /proposé|puce|sais plus/.test(x.quoi) && !/\+/.test(x.quoi)).every((x) => x.touchers === 1), `J ${tag} : un achat proposé, une puce, « Je ne sais plus » = UN toucher`, journalJ);
          dit(deltas.length >= 10 && med <= 100 && max <= 250, `J ${tag} : entre deux cartes, ${med} ms (médiane ; max ${max} ms) — aucune attente`, deltas);
          e = await etat(pg);
          dit(/^\d+\/\d+$/.test(e.progres) && Number(e.progres.split('/')[0]) === 11, `J ${tag} : la progression suit (« 11 sur … »)`, e.progres);
          // « ‹ » : revoir la réponse précédente.
          await toucher('[data-cp-reculer]'); await attendre(250);
          const deja = await pg.evaluate(() => (document.querySelector('[data-cp-deja]') || { textContent: '' }).textContent);
          dit(/prix mini/.test(deja), `J ${tag} : « ‹ » revient à la réponse précédente et la dit`, deja);
          await toucher('[data-cp-plus-tard]'); await attendre(200);
          // Il ferme, il rouvre : il reprend où il s'est arrêté.
          const avantFermer = (await etat(pg)).carte;
          await toucher('[data-completer] .n-barre-retour'); await attendre(300);
          dit(!(await etat(pg)).ouvert, `J ${tag} : « × » ferme l'atelier`);
          await ouvrirPorte(pg, {}); await pg.waitForSelector('[data-cp-carte]', { timeout: 20000 }).catch(() => {});
          dit((await etat(pg)).carte === avantFermer, `J ${tag} : rouvert, il reprend où il s'était arrêté`, { avantFermer, apres: (await etat(pg)).carte });
          // « Ce qui reste », par sorte.
          await toucher('[data-cp-reste-ouvrir]'); await pg.waitForSelector('[data-cp-reste] [data-cp-sujet]', { timeout: 4000 }).catch(() => {});
          const reste = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-cp-reste] [data-cp-sujet]')].map((b) => [b.getAttribute('data-cp-sujet'), b.getAttribute('data-cp-n')])));
          dit(reste.mini === '45' && reste.achat === '31' && reste.anciennes === '2', `J ${tag} : « Ce qui reste » par sorte (45 prix mini, 31 prix d'achat, 2 ventes anciennes)`, reste);
          await attendre(350); jugerForme(await forme(pg), tag, '« Ce qui reste »'); if (theme === 'clair') await shot('ce-qui-reste');
          await toucher('[data-cp-reste] .n-feuille-croix'); await attendre(450);
          await toucher('[data-completer] .n-barre-retour'); await attendre(300);

          // ── L : la règle en lot — ouvrir, « −15 % », « Poser N » ──
          const tL0 = await touchers();
          await ouvrirPorte(pg, { sujet: 'mini' });
          await pg.waitForSelector('[data-cp-lot]', { timeout: 20000 }).catch(() => {});
          dit((await etat(pg)).vue === 'lot', `L ${tag} : l'entrée « prix mini » ouvre la règle en lot`, await etat(pg));
          await pg.locator('[data-cp-lot] .vrm-cp-regles [role="radio"]').nth(1).tap(); await attendre(250);
          const ap = await pg.evaluate(() => [...document.querySelectorAll('[data-cp-lot-ligne]')].map((l) => ({ id: l.getAttribute('data-cp-lot-ligne'), mini: l.getAttribute('data-cp-lot-mini'), coche: l.getAttribute('data-cp-lot-coche'), ecartee: l.getAttribute('data-cp-lot-ecartee') || '' })));
          const attendu = (id) => String(Math.floor(prixDe(Number(id) - 51000) * 0.85));
          dit(ap.length === 45 && ap.every((l) => l.mini === attendu(l.id)), `L ${tag} : l'aperçu ligne par ligne (45 annonces), prix − 15 % à l'euro du dessous`, ap.filter((l) => l.mini !== attendu(l.id)).slice(0, 4));
          const sousAchat = ap.filter((l) => l.ecartee === 'sous-achat');
          dit(sousAchat.every((l) => l.coche === '0') && ap.filter((l) => !l.ecartee).every((l) => l.coche === '1'), `L ${tag} : cochées d'office, sauf celles SOUS l'achat (${sousAchat.length}) — dites, décochées`, sousAchat.slice(0, 3));
          jugerForme(await forme(pg), tag, 'règle en lot'); await shot('regle-en-lot');
          // Décocher la première, poser.
          const premiere = ap.find((l) => l.coche === '1');
          await pg.locator(`[data-cp-lot-ligne="${premiere.id}"]`).first().tap().catch(() => {}); await attendre(150);
          const nPoser = Number(await pg.getAttribute('[data-cp-lot-poser]', 'data-cp-lot-poser'));
          const avantLot = await local(pg, 'vinted_annonce_numeros');
          await toucher('[data-cp-lot-poser]'); await attendre(900);
          fiches = await local(pg, 'vinted_annonce_numeros');
          const cochees = ap.filter((l) => l.coche === '1' && l.id !== premiere.id);
          dit(nPoser === cochees.length && cochees.every((l) => fiches[l.id].min === l.mini) && !fiches[premiere.id].min && sousAchat.every((l) => !fiches[l.id].min),
            `L ${tag} : « Poser ${nPoser} » écrit exactement l'aperçu ; la décochée et les « sous l'achat » ne sont pas écrites`, { nPoser, n: cochees.length, dec: fiches[premiere.id] });
          await pg.waitForSelector('[data-cp-bandeau] .n-toast-action', { timeout: 4000 }).catch(() => {});
          await toucher('[data-cp-bandeau] .n-toast-action'); await attendre(1200);
          fiches = await local(pg, 'vinted_annonce_numeros');
          dit(JSON.stringify(fiches) === JSON.stringify(avantLot), `L ${tag} : « Annuler » en bloc ⇒ l'état d'avant, exactement`);
          // Les 3 touchers : ouvrir, choisir, poser.
          await toucher('[data-completer] .n-barre-retour'); await attendre(300);
          const tL1 = await touchers();
          await ouvrirPorte(pg, { sujet: 'mini' }); await pg.waitForSelector('[data-cp-lot]', { timeout: 20000 }).catch(() => {});
          await pg.locator('[data-cp-lot] .vrm-cp-regles [role="radio"]').nth(1).tap(); await toucher('[data-cp-lot-poser]'); await attendre(900);
          const tL2 = await touchers();
          fiches = await local(pg, 'vinted_annonce_numeros');
          const restants = ap.filter((l) => !fiches[l.id].min).length;
          dit(tL2 - tL1 === 2 && restants === sousAchat.length, `L ${tag} : tout réglé en 3 touchers (ouvrir + ${tL2 - tL1} dans l'atelier) ; restent ${restants} « sous l'achat », à décider une par une`, { restants });
          mesures.push({ tag, lot: `${ap.length - restants} prix mini posés en 3 touchers (ouvrir, −15 %, poser)` });
          void tL0;
          // ── La fin ──
          if (restants === 0) {
            await pg.waitForSelector('[data-cp-fin]', { timeout: 6000 }).catch(() => {});
            dit((await etat(pg)).fin, `L ${tag} : plus rien dans « prix mini » ⇒ l'écran de fin`);
          } else {
            // celles « sous l'achat » : une par une, la puce le DIT ; « Pas de prix mini » les sort.
            e = await etat(pg);
            dit(e.question === 'mini' && e.puces.some((p) => p.sous), `L ${tag} : la suivante est une « sous l'achat » : sa puce porte l'avertissement`, e.puces);
            await attendre(300); if (theme === 'clair') await shot('carte-sous-achat');
            for (let k = 0; k < restants + 1; k++) { if ((await etat(pg)).fin) break; await toucher('[data-cp-carte] [data-cp-sans="mini"]'); await attendre(200); }
            await pg.waitForSelector('[data-cp-fin]', { timeout: 6000 }).catch(() => {});
            dit((await etat(pg)).fin, `L ${tag} : plus rien dans « prix mini » ⇒ l'écran de fin`);
          }
          await attendre(350); jugerForme(await forme(pg), tag, 'fin'); await shot('fin');
        } else {
          // ── O : l'ordinateur — la file à gauche, la carte à droite, tout au clavier ──
          const geo = await pg.evaluate(() => { const f = document.querySelector('[data-cp-file]'), c = document.querySelector('[data-cp-carte]'); return f && c ? { file: f.getBoundingClientRect().right, carte: c.getBoundingClientRect().left, n: f.getAttribute('data-cp-file') } : null; });
          dit(geo && geo.file <= geo.carte && geo.n === '55', `O ${tag} : la file (55) à gauche, la carte à droite`, geo);
          // Le filtre « Toutes · En ligne · Vendues » (la même attente que « Relier achats et ventes »).
          await pg.locator('[data-cp-reste-ouvrir]').first().click(); await pg.waitForSelector('[data-cp-reste] [data-cp-sujet]', { timeout: 4000 }).catch(() => {});
          const genre = (k) => pg.locator('[data-cp-reste] .n-segmente [role="radio"]').nth(k).click();
          const nDe = (s) => pg.evaluate((s) => { const e = document.querySelector(`[data-cp-reste] [data-cp-sujet="${s}"]`); return e ? e.getAttribute('data-cp-n') : null; }, s);
          await genre(2); await attendre(300);
          const gV = { tout: await nDe('tout'), mini: (await nDe('mini')) != null, file: await pg.getAttribute('[data-cp-file]', 'data-cp-file') };
          await genre(1); await attendre(300);
          const gA = { tout: await nDe('tout'), achat: await nDe('achat') };
          dit(gV.tout === '4' && !gV.mini && gV.file === '4' && gA.tout === '51' && gA.achat === '33', `O ${tag} : le filtre « Vendues » (4) / « En ligne » (51, dont 33 sans prix d'achat)`, { gV, gA });
          await attendre(200); await shot('ordinateur-ce-qui-reste');
          await genre(0); await attendre(200); await pg.locator('[data-cp-reste] .n-feuille-croix').first().click(); await attendre(450);
          await pg.locator('[data-completer]').first().focus().catch(() => {});
          await pg.keyboard.press('1');
          await pg.waitForFunction(() => { const x = document.querySelector('[data-cp-carte]'); return x && x.getAttribute('data-cp-carte') === 'v:6200002'; }, null, { timeout: 8000 }).catch(() => {});
          let ov = await local(pg, 'vinted_sale_overrides');
          dit(ov && ov['6200001'] && String(ov['6200001'].buyFromId) === '7300002', `O ${tag} : « 1 » choisit l'achat proposé`, ov && ov['6200001']);
          await pg.keyboard.press('4'); await pg.keyboard.press('2'); await pg.keyboard.press(','); await pg.keyboard.press('5');
          const aff = await pg.getAttribute('[data-cp-carte] [data-cp-affiche]', 'data-cp-affiche').catch(() => null);
          await pg.keyboard.press('Enter');
          await pg.waitForFunction(() => { const x = document.querySelector('[data-cp-carte]'); return x && x.getAttribute('data-cp-carte') === 'v:6200003'; }, null, { timeout: 8000 }).catch(() => {});
          ov = await local(pg, 'vinted_sale_overrides');
          dit(aff === '42,5' && ov && ov['6200002'] && ov['6200002'].buyPrice === '42,50', `O ${tag} : chiffres puis Entrée ⇒ 42,50 € posé, carte suivante`, { aff, ov: ov && ov['6200002'] });
          await pg.keyboard.press('Tab'); await attendre(250);
          dit((await etat(pg)).carte === 'v:6200004', `O ${tag} : Tab = plus tard (la question suivante), rien d'écrit`, await etat(pg));
          await attendre(300); jugerForme(await forme(pg), tag, 'carte'); await shot('ordinateur');
          // La grille.
          await pg.locator('[data-cp-reste-ouvrir]').first().click(); await pg.waitForSelector('[data-cp-grille-ouvrir]', { timeout: 4000 }).catch(() => {});
          await pg.locator('[data-cp-grille-ouvrir]').first().click().catch(() => {});
          await pg.waitForSelector('[data-cp-grille]', { timeout: 6000 }).catch(() => {});
          const champ = pg.locator('[data-cp-case="a:51001|mini"]').first();
          await champ.fill('70').catch(() => {}); await champ.press('Enter').catch(() => {}); await attendre(700);
          const fiches = await local(pg, 'vinted_annonce_numeros');
          dit(fiches['51001'] && fiches['51001'].min === '70', `O ${tag} : la grille — un prix mini tapé dans sa case, Entrée ⇒ écrit`, fiches['51001']);
          await attendre(200); await shot('ordinateur-grille');
          await pg.keyboard.press('Escape'); await attendre(200);
          dit((await etat(pg)).vue === 'cartes', `O ${tag} : Échap revient aux cartes`);
          await pg.locator('[data-completer]').first().focus().catch(() => {}); await pg.keyboard.press('Escape'); await attendre(400);
          dit(!(await etat(pg)).ouvert, `O ${tag} : Échap ferme l'atelier`);
        }
        const err = [...journal.erreurs, ...journal.console.filter((x) => !/favicon|manifest|ServiceWorker|service worker/i.test(x))];
        dit(!err.length, `F ${tag} : aucune erreur dans la page`, err.slice(0, 4));
      } catch (x) { dit(false, `${tag} : le banc est allé au bout`, String((x && x.stack) || x).slice(0, 500)); console.log('     page : ' + JSON.stringify([...journal.erreurs, ...journal.console]).slice(0, 1500)); await shot('erreur'); }
      await ctx.close();
    }
  } finally { await nav.close(); NV.srv.close(); }
  console.log('\nMESURES ' + JSON.stringify(mesures, null, 1));
  console.log(`\n${ko ? 'KO' : 'OK'}  banc completer : ${nOk} OK, ${ko} KO — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
