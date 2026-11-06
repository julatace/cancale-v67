// ════════════════════════════════════════════════════════════════════════════
//  BANC « VAGUE 2 — VENTES » (6 nov. ; docs/passation/2026-11-06-vague2-ventes.md)
//  Données INVENTÉES (le dépôt est public), servies par le harnais du banc
//  `nouveau-vendeur` — aucune écriture ne sort du banc. 390 px tactile et 1512 px,
//  clair et sombre. Il MESURE (data-*, styles calculés, rectangles, écritures du
//  banc — jamais un libellé seul) :
//   R  REMETTRE EN VENTE (point 1) — Ventes · Vinted : la vente annulée AVANT l'envoi
//      (transaction 520, colis jamais parti) porte « Remettre en vente » SUR la ligne,
//      N° gardé / N° d'archive / « paire pas reliée » ; l'annulée APRÈS le départ et les
//      ventes finalisées n'ont rien ; le geste ouvre « Republier à la main » sur
//      l'annonce fermée (rien à supprimer), AUCUNE écriture tant qu'il n'agit pas ;
//   J  MA JOURNÉE — « 3 ventes annulées avant l'envoi » et « 3 annonces sans achat
//      relié », une ligne chacune ; « Voir » mène à Ventes · Annulées ;
//   A  SANS ACHAT RELIÉ (point 4) — le filtre et sa file : une suggestion (marque +
//      taille, achat ANTÉRIEUR), rien quand l'achat est postérieur ; SON tap « Relier »
//      écrit le lien et le prix (écriture du banc), « Plus tard » range en fin de file ;
//   M  PRIX MINI (point 2) — Sélectionner deux comptes → « Prix mini… » possible (les
//      tuiles des moteurs grisées) ; N° · prix · mini (− 10 %, arrondi), « Refuser
//      sous », « sous ton prix d'achat » en ambre ; confirmation puis écriture `min` ;
//   S  SAISIE EN SÉRIE (point 7) — une piste seulement quand marque + taille + achat
//      antérieur ; l'achat postérieur n'est jamais proposé ;
//   B  BANDEAU (point 5) — « Prix d'achat 1/3 · Compléter » en tête de Ventes · Vinted ;
//      la case « Achat » de la ligne grise (jamais ambre) à l'ordinateur ;
//   G  PARTOUT — aucune erreur JS, rien ne déborde, cibles de 44 px au doigt, aucun rouge.
//  Réglages : `BANC_PORT` (9450–9499, 9460 par défaut), `LARGEURS=390,1512`,
//  `THEMES=clair,sombre`, `SCENES=R,J,A,M,S`, `SHOTS=<dossier>` (captures à REGARDER),
//  `BANC_DIST` (un autre dist/, pour juger la base). Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9460';
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
// (6 nov., finitions) P : « Plus tard » revient au bout de 7 jours ; N : un N° d'archive remis en vente
// entre dans « nouveaux numéros à écrire sur tes cartons » (docs/passation/2026-11-06-finitions.md).
const SCENES = liste('SCENES', 'R,J,A,M,S,P,N');
const SHOTS = process.env.SHOTS || '';

let ko = 0;
const compte = {};
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`);
};

// ── LE JEU INVENTÉ ──────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString(), ts = (j) => Math.floor((now - j * 86400000) / 1000);
const annonce = (id, title, prix, jours, o = {}) => ({ id, title, price: { amount: String(prix), currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, created_at_ts: ts(jours), status: 'Très bon état', ...o });
const fermee = (id, title, prix) => annonce(id, title, prix, 40, { is_closed: true, item_closing_action: 'sold' });
const vente = (tx, title, prix, statut, tus, jours) => ({ transaction_id: tx, title, price: { amount: String(prix), currency_code: 'EUR' }, status: statut, transaction_user_status: tus, date: iso(jours), photo: null });
const achat = (tx, title, prix, jours) => ({ transaction_id: tx, conversation_id: 8400000 + tx % 1000, title, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(jours), photo: null });
const txn = (uid, tx, item, status, ship) => ({ id: `harvest_${uid}_txn_${tx}`, data: { capturedAt: iso(0.01), payload: { transaction: { id: tx, item_id: item, status, status_title: status >= 500 ? 'Annulée' : 'Commande finalisée', status_updated_at: iso(4), user_side: 'seller', shipment: { status_title: ship } } } } });
const LONG = 'Nike Air Max 90 blanche édition anniversaire boîte d’origine double lacets taille 42 avec facture';
const jeu = () => [
  { id: 'main', data: {
    vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) },
    vrm_numerotation: { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z' },
    vinted_annonce_numeros: {
      51001: { numero: '3', auto: true, title: 'Adidas Spezial noir taille 42,5' },
      51002: { numero: '4', auto: true, title: 'Nike Dunk Low panda taille 41' },
      51003: { numero: '5', buyPrice: '35', title: 'Asics Gel-1130 argent taille 43' },
      51005: { numero: '6', buyFromId: '7300009', buyPrice: '50', title: 'New Balance 550 crème taille 44' },
      52001: { numero: '8', auto: true, title: 'Salomon XT-6 grise taille 42' },
      51900: { numero: '7', auto: true, title: LONG },
    },
    vinted_sale_overrides: { 62101: { numero: 'B230' }, 62001: { buyPrice: '30' } },
  } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(0.01), payload: { items: [
    annonce(51001, 'Adidas Spezial noir taille 42,5', 60, 20, { brand_title: 'Adidas', size_title: '42,5' }),
    annonce(51002, 'Nike Dunk Low panda taille 41', 90, 10, { brand_title: 'Nike', size_title: '41' }),
    annonce(51003, 'Asics Gel-1130 argent taille 43', 38, 8, { brand_title: 'Asics', size_title: '43' }),
    annonce(51004, 'Puma Suede bleue taille 40', 45, 60),   // mise en ligne AVANT la coupure : pas numérotée
    annonce(51005, 'New Balance 550 crème taille 44', 70, 12),
    fermee(51900, LONG, 55), fermee(51901, 'Converse Chuck 70 noire taille 41', 48), fermee(51902, 'Vans Old Skool taille 42', 42), fermee(51903, 'Reebok Club C blanche taille 43', 50),
  ] } } },
  { id: 'harvest_222_listings', data: { capturedAt: iso(0.02), payload: { items: [annonce(52001, 'Salomon XT-6 grise taille 42', 120, 15, { brand_title: 'Salomon', size_title: '42' })] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: [
    vente(62100, LONG, 55, 'Remboursement effectué', 'failed', 5),
    vente(62101, 'Converse Chuck 70 noire taille 41', 48, 'Remboursement effectué', 'failed', 7),
    vente(62102, 'Vans Old Skool taille 42', 42, 'Remboursement effectué', 'failed', 9),
    vente(62103, 'Reebok Club C blanche taille 43', 50, 'Remboursement effectué', 'failed', 11),
    vente(62001, 'Adidas Samba OG noire taille 40', 65, 'Commande finalisée', 'completed', 3),
    vente(62002, 'Asics Gel-Lyte III taille 42', 70, 'Bordereau envoyé au vendeur', 'needs_action', 1),
    vente(62003, 'Nike Air Force 1 blanche taille 43', 80, 'Commande finalisée', 'completed', 14),
  ] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0.02), payload: { my_orders: [] } } },
  // Les transactions : 520 avant l'envoi (bordereau envoyé, jamais parti) ; 62103 annulée APRÈS le départ.
  txn('111', 62100, 51900, 520, 'Bordereau envoyé au vendeur'), txn('111', 62101, 51901, 520, 'Bordereau envoyé au vendeur'),
  txn('111', 62102, 51902, 520, ''), txn('111', 62103, 51903, 520, 'Colis expédié'),
  txn('111', 62001, 51990, 450, 'Livré'), txn('111', 62002, 51991, 230, 'Bordereau envoyé au vendeur'), txn('111', 62003, 51992, 450, 'Livré'),
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(0.01), payload: { my_orders: [
    achat(7300001, 'Adidas Spezial noire 42.5', 32, 30),       // antérieur : LA suggestion de 51001
    achat(7300002, 'Nike Dunk Low panda 41', 55, 2),           // POSTÉRIEUR à la mise en ligne de 51002 : jamais proposé
    achat(7300009, 'New Balance 550 crème 44', 50, 40),        // déjà relié à 51005
    achat(7300010, 'Salomon XT-6 bleue 42', 70, 25),           // couleur contraire : jamais proposé pour 52001
  ] } } },
  { id: 'coffre_111_51900', data: { id: '51900', uid: '111', title: LONG, desc: 'Paire portée deux fois, boîte d’origine.', price: '55', photos: [] } },
];
const COMPTES = NV.JEU_COMPTES;
const lignesMain = (base) => (base.lignes.find((x) => x.id === 'main') || {}).data || {};

// ── Les mesures ─────────────────────────────────────────────────────────────
const calme = (pg) => pg.evaluate(() => new Promise((ok) => {
  const anims = () => (document.getAnimations ? document.getAnimations() : []);
  Promise.race([Promise.all(anims().map((a) => a.finished.catch(() => {}))), new Promise((r) => setTimeout(r, 2500))])
    .then(() => { for (const a of anims()) { try { if (a.playState === 'running') a.finish(); } catch (_) {} } setTimeout(ok, 120); });
})).catch(() => {});
const GENERAL = (pg, tel, zone) => pg.evaluate(({ tel, zone }) => {
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let p = e; p && p !== document.documentElement; p = p.parentElement) { const s = getComputedStyle(p); if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.05) return false; } return true; };
  const rgba = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; } return { h, s, l }; };
  const rouge = (c) => { const x = rgba(c); if (!x || x.a < 0.3) return false; const { h, s, l } = hsl(x); return (h >= 345 || h <= 12) && s >= 0.45 && l >= 0.25 && l <= 0.75; };
  const zones = [...document.querySelectorAll(zone)].filter(vis);
  const els = [...new Set(zones.flatMap((z) => [z, ...z.querySelectorAll('*')]))].filter(vis);
  const rouges = els.filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()) && rouge(getComputedStyle(e).color)).map((e) => (e.innerText || '').trim().slice(0, 30));
  const petits = tel ? els.filter((e) => e.matches('button, a[href], input[type="checkbox"], [role="button"]') && !e.closest('[aria-hidden="true"]')).filter((e) => { const r = e.getBoundingClientRect(); const lab = e.closest('label'); const h = lab ? Math.max(r.height, lab.getBoundingClientRect().height) : r.height; return h < 43.5; }).map((e) => (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30)) : [];
  const debord = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  return { n: zones.length, rouges, petits, debord };
}, { tel, zone });
const ambre = (pg, sel) => pg.evaluate((sel) => {
  const e = document.querySelector(sel); if (!e) return null;
  const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(e).color || ''); if (!m) return null;
  const [r, g, b] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number).map((x) => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; }
  return { ambre: h > 18 && h <= 48 && s >= 0.6 && l >= 0.3 && l <= 0.7, couleur: getComputedStyle(e).color };
}, sel);
const clic = async (pg, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 5000 }).catch(async () => { await pg.$eval(sel, (x) => x.click()).catch(() => {}); }); };
const capture = async (pg, nom) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }).catch(() => {});
};
const attendre = async (pg, sel, ms = 15000) => pg.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const ecriture = async (base, test, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (test(lignesMain(base))) return true; } catch (_) {} await new Promise((r) => setTimeout(r, 300)); } return false; };
const allerVinted = async (pg) => {
  await pg.locator('[data-selecteur-logos] button[data-site="vinted"]').first().click().catch(() => {});
  await attendre(pg, '.vrm-ventes-liste [data-tx]', 20000);
  await pg.waitForTimeout(1500);
};

async function passe(nav, { W, theme }) {
  const sombre = theme === 'sombre', tel = W < 600;
  const T = `[${W}px ${theme}]`;
  const nomS = (x) => `v2-${W}-${theme}-${x}`;
  const ouvrir = async (tab, modif = null) => { const lignes = jeu(); if (modif) modif(lignes); const base = { lignes, comptes: COMPTES, ecritures: 0 }; const o = await NV.ouvrir(nav, { W, sombre, base, tab }); await o.pg.waitForTimeout(1500); return { ...o, base }; };
  const mainDe = (l) => l.find((x) => x.id === 'main').data;

  // ── P (6 nov., finitions) : « Plus tard » revient au bout de 7 jours ──
  // 51001 reportée il y a 8 jours (revenue), 51002 il y a 2 jours (encore de côté) ; 52001 jamais reportée.
  if (SCENES.includes('P')) {
    const report = (l) => { mainDe(l).vrm_achat_plus_tard = { 51001: iso(8), 51002: iso(2) }; };
    const o = await ouvrir('journee', report);
    await attendre(o.pg, '[data-job="achat-a-relier"]', 20000);
    await calme(o.pg);
    const j = await o.pg.evaluate(() => { const e = document.querySelector('[data-job="achat-a-relier"]'); return e ? { n: e.getAttribute('data-n'), t: e.innerText.replace(/\s+/g, ' ') } : null; });
    dit(j && j.n === '2', 'P', `${T} Ma journée : « 2 annonces sans achat relié » — reportée il y a 8 j, elle REVIENT ; il y a 2 j, elle reste de côté`, JSON.stringify(j));
    await o.pg.locator('[data-job="achat-a-relier"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(o.pg, nomS('plus-tard-journee'));
    dit(!o.journal.erreurs.length, 'G', `${T} Plus tard (Ma journée) : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
    const a = await ouvrir('cat_annonces', report);
    await attendre(a.pg, '[data-vue-sans-achat]', 20000);
    const f0 = await a.pg.evaluate(() => (document.querySelector('[data-vue-sans-achat]') || { getAttribute: () => null }).getAttribute('data-vue-sans-achat'));
    await clic(a.pg, '[data-vue-sans-achat]');
    await attendre(a.pg, '[data-ar-ligne]', 8000);
    await a.pg.waitForTimeout(800); await calme(a.pg);
    const l = await a.pg.evaluate(() => [...document.querySelectorAll('[data-ar-ligne]')].map((x) => ({ id: x.getAttribute('data-ar-ligne'), pt: x.hasAttribute('data-ar-plus-tard'), rep: x.getAttribute('data-ar-reportee'), sous: ((x.querySelector('.vrm-ar-sous') || {}).textContent || '').trim(), gestePlusTard: !!x.querySelector('[data-ar-plus-tard-geste]') })));
    const p = Object.fromEntries(l.map((x) => [x.id, x]));
    dit(l.map((x) => x.id + (x.pt ? '*' : '')).join(',') === '51001,52001,51002*', 'P', `${T} la file : 51001 revenue à SA place (la plus ancienne), 51002 encore en fin de file`, JSON.stringify(l.map((x) => x.id + (x.pt ? '*' : ''))));
    dit(p['51001'] && p['51001'].rep === iso(8).slice(0, 10) && /reportée le/.test(p['51001'].sous) && !/revient/.test(p['51001'].sous) && p['51001'].gestePlusTard, 'P', `${T} 51001 dit « reportée le … » (et « Plus tard » se repose)`, JSON.stringify(p['51001']));
    dit(p['51002'] && /reportée le .+ · revient le /.test(p['51002'].sous) && !p['51002'].gestePlusTard, 'P', `${T} 51002 dit « reportée le … · revient le … »`, JSON.stringify(p['51002']));
    dit(f0 === '3', 'P', `${T} le filtre compte toujours les 3 (une reportée reste visible)`, f0);
    await a.pg.locator('[data-ar]').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(a.pg, nomS('plus-tard-file'));
    const g = await GENERAL(a.pg, tel, '[data-ar]');
    dit(!g.rouges.length && !g.debord, 'G', `${T} Plus tard (file) : ni rouge, ni débord`, JSON.stringify(g));
    dit(!a.journal.erreurs.length, 'G', `${T} Plus tard (file) : aucune erreur JS`, a.journal.erreurs.join(' ¦ '));
    await a.ctx.close();
  }

  // ── N (6 nov., finitions) : la vente 62101 (N° d'archive B230) remise en vente ──
  // SON clic a désigné la nouvelle annonce 51006 (`vrm_repub_main`, `numArchive`). Elle reçoit un N°
  // NEUF ; l'ancien B230 est écrit sur le carton : « nouveaux numéros à écrire sur tes cartons »
  // (la liste `reattribueAEcrire`) jusqu'à « C'est écrit ».
  if (SCENES.includes('N')) {
    const o = await ouvrir('cat_annonces', (l) => {
      mainDe(l).vrm_repub_main = { 51901: { uid: '111', num: '', titre: 'Converse Chuck 70 noire taille 41', domain: 'www.vinted.fr', at: iso(0.3), annulee: true, tx: '62101', numArchive: 'B230', nouvelId: '51006', nouveauTitre: 'Converse Chuck 70 noire taille 41', lieAt: iso(0.2) } };
      l.find((x) => x.id === 'harvest_111_listings').data.payload.items.push(annonce(51006, 'Converse Chuck 70 noire taille 41', 48, 0.25, { brand_title: 'Converse', size_title: '41' }));
    });
    const vu = await attendre(o.pg, '[data-a-ecrire="51006"]', 25000);
    await calme(o.pg);
    const e = await o.pg.evaluate(() => { const x = document.querySelector('[data-a-ecrire="51006"]'); return x ? { de: x.getAttribute('data-a-ecrire-de'), vers: x.getAttribute('data-a-ecrire-vers'), t: x.innerText.replace(/\s+/g, ' ') } : null; });
    // L'écriture de la fiche part au rythme de la sauvegarde : on l'attend (jamais un délai fixe seul).
    await ecriture(o.base, (m) => { const f = (m.vinted_annonce_numeros || {})['51006']; return f && f.reattribue; }, 15000);
    const fiche = (lignesMain(o.base).vinted_annonce_numeros || {})['51006'] || {};
    dit(vu && e && e.de === 'B230' && e.vers && /^\d+$/.test(e.vers) && e.vers === String(fiche.numero), 'N', `${T} la nouvelle annonce a un N° NEUF et entre dans « à écrire sur tes cartons » : B230 → N°${e && e.vers}`, JSON.stringify({ e, fiche }));
    dit(e && /Ancien numéro : il ne se redonne pas/.test(e.t) && /C.est écrit/.test(e.t), 'N', `${T} la ligne dit pourquoi (« Ancien numéro : il ne se redonne pas ») et porte « C’est écrit »`, e && e.t);
    dit(fiche.reattribue && fiche.reattribue.archive === true && fiche.reattribue.de === 'B230', 'N', `${T} écrit sur la fiche par la règle existante (\`reattribue\`, archive)`, JSON.stringify(fiche.reattribue));
    await o.pg.locator('[data-a-ecrire="51006"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(o.pg, nomS('archive-a-ecrire'));
    await o.pg.locator('[data-a-ecrire="51006"] button').filter({ hasText: /C.est écrit/ }).first().click().catch(() => {});
    const ecrit = await ecriture(o.base, (m) => { const f = (m.vinted_annonce_numeros || {})['51006']; return f && f.reattribue && f.reattribue.ecrit; });
    await o.pg.waitForTimeout(1500);
    const reste = await o.pg.evaluate(() => !!document.querySelector('[data-a-ecrire="51006"]'));
    dit(ecrit && !reste, 'N', `${T} « C’est écrit » : la ligne sort, et ne revient pas`, JSON.stringify({ ecrit, reste }));
    dit(!o.journal.erreurs.length, 'G', `${T} Archive à écrire : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }

  // ── R + B : Ventes · Vinted ──
  if (SCENES.includes('R')) {
    const o = await ouvrir('ventes');
    await allerVinted(o.pg);
    await attendre(o.pg, '[data-ventes-avis]', 8000);
    await calme(o.pg);
    // B (sur « Toutes ») : le bandeau et la case grise — les annulées vivent sous « Annulées ».
    const bd = await o.pg.evaluate(() => { const e = document.querySelector('[data-ventes-achats]'); const b = document.querySelector('[data-ventes-avis]'), l = document.querySelector('.vrm-ventes-liste'); return { b: e ? e.getAttribute('data-ventes-achats') : null, avant: !!(b && l && b.getBoundingClientRect().top < l.getBoundingClientRect().top) }; });
    dit(bd.b === '1/3' && bd.avant, 'B', `${T} bandeau « Prix d’achat 1/3 · Compléter » en tête de la liste (annulées hors du compte)`, JSON.stringify(bd));
    if (!tel) {
      const a = await ambre(o.pg, '.vrm-sale-row[data-tx="62002"] .vrm-ledger-sale-achat[data-achat-etat="manque"]');
      dit(a && !a.ambre, 'B', `${T} la case « Achat » d’une vente sans prix est grise (plus d’ambre répété)`, JSON.stringify(a));
    }
    await o.pg.locator('[data-ventes-avis]').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(o.pg, nomS('ventes-bandeau'));
    await o.pg.getByRole('button', { name: /^Annulées/ }).first().click().catch(() => {});
    await attendre(o.pg, '[data-remise-vente]', 12000);
    await calme(o.pg);
    const r = await o.pg.evaluate(() => {
      const L = (tx) => { const row = document.querySelector(`.vrm-sale-row[data-tx="${tx}"]`); if (!row) return null; const z = row.querySelector('[data-remise-vente]'); const b = row.querySelector('[data-remettre-vente]'); const vb = (e) => !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none'); return { z: z ? z.getAttribute('data-remise-num') : null, bouton: vb(b), sans: !!row.querySelector('[data-remise-sans-num]'), op: Number(getComputedStyle(row).opacity) }; };
      return { a: L('62100'), b: L('62101'), c: L('62102'), d: L('62103'), f: L('62001'), banniere: (document.querySelector('[data-ventes-achats]') || {}).getAttribute ? document.querySelector('[data-ventes-achats]').getAttribute('data-ventes-achats') : null,
        avantListe: (() => { const b = document.querySelector('[data-ventes-avis]'), l = document.querySelector('.vrm-ventes-liste'); return !!(b && l && b.getBoundingClientRect().top < l.getBoundingClientRect().top); })() };
    });
    dit(r.a && r.a.z === 'garde' && r.a.bouton && r.a.op === 1, 'R', `${T} vente annulée avant l’envoi : « Remettre en vente » SUR la ligne (visible sans « … »), N° gardé, ligne pleine`, JSON.stringify(r.a));
    dit(r.b && r.b.z === 'archive' && r.b.bouton, 'R', `${T} N° d’archive (B230) : la remise dit qu’un N° neuf viendra`, JSON.stringify(r.b));
    dit(r.c && r.c.z === 'sans' && r.c.sans && r.c.bouton, 'R', `${T} sans N° : « Paire pas reliée »`, JSON.stringify(r.c));
    dit(r.d && r.d.z === null && !r.f, 'R', `${T} annulée APRÈS le départ du colis : aucune remise (et une vente finalisée n’est pas sous « Annulées »)`, JSON.stringify({ d: r.d, f: r.f }));
    const g = await GENERAL(o.pg, tel, '.vrm-ventes-liste, [data-ventes-avis], [data-remise-vente]');
    dit(!g.rouges.length && !g.debord, 'G', `${T} Ventes : ni rouge, ni débord`, JSON.stringify(g));
    if (tel) dit(!g.petits.length, 'G', `${T} Ventes : 44 px au doigt`, g.petits.join(' ¦ '));
    await o.pg.locator('.vrm-sale-row[data-tx="62100"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(o.pg, nomS('ventes-remise'));
    const avant = o.base.ecritures;
    await clic(o.pg, '.vrm-sale-row[data-tx="62100"] [data-remettre-vente]');
    const sheet = await attendre(o.pg, '[data-repub-main="51900"]', 6000);
    await o.pg.waitForTimeout(1200);
    const s = await o.pg.evaluate(() => { const f = document.querySelector('[data-repub-main]'); if (!f) return null; return { annulee: !!f.querySelector('[data-main-annulee]'), supprime: /supprime l’ancienne/.test(f.innerText), titre: (f.querySelector('h2') || {}).textContent || '', desc: !!(f.querySelector('[data-main-champ="description"] .vrm-main-valeur') || {}).textContent && /deux fois/.test(f.querySelector('[data-main-champ="description"] .vrm-main-valeur').textContent) }; });
    dit(sheet && s && s.annulee && !s.supprime && /N°7/.test(s.titre) && s.desc, 'R', `${T} le geste ouvre « Republier à la main » depuis le coffre : N°7, description, « rien à supprimer »`, JSON.stringify(s));
    dit(o.base.ecritures === avant, 'R', `${T} ouvrir la remise n’écrit rien (jamais automatique : SON clic sur Vinted)`, `${avant} → ${o.base.ecritures}`);
    await capture(o.pg, nomS('remise-main'));
    // B : « Compléter » ouvre la saisie en série — S : une seule règle de suggestion.
    await o.pg.keyboard.press('Escape'); await o.pg.waitForTimeout(500);
    const x = o.pg.locator('[role="dialog"] button[aria-label="Fermer"]').last(); if (await x.count()) await x.click().catch(() => {});
    await o.pg.waitForTimeout(400);
    if (SCENES.includes('S')) {
      await o.pg.getByRole('button', { name: /^Toutes/ }).first().click().catch(() => {});
      await attendre(o.pg, '[data-ventes-achats-completer]', 6000);
      await clic(o.pg, '[data-ventes-achats-completer]');
      await attendre(o.pg, '[data-fillbuy-feuille]', 6000);
      await attendre(o.pg, '[data-fillbuy-piste]', 12000);
      await o.pg.waitForTimeout(800);
      const fb = await o.pg.evaluate(() => { const p = [...document.querySelectorAll('[data-fillbuy-piste]')]; return { pistes: p.map((x) => x.getAttribute('data-fillbuy-piste')), sur: p.filter((x) => x.getAttribute('data-fillbuy-sur') === '1').map((x) => x.getAttribute('data-fillbuy-piste')) }; });
      dit(fb.pistes.includes('7300001') && fb.sur.includes('7300001'), 'S', `${T} saisie en série : l’achat antérieur, même marque, même taille, même couleur est proposé (« C’est ça »)`, JSON.stringify(fb));
      dit(!fb.pistes.includes('7300002') && !fb.pistes.includes('7300010'), 'S', `${T} saisie en série : ni l’achat POSTÉRIEUR, ni la couleur contraire`, JSON.stringify(fb));
      await capture(o.pg, nomS('saisie-serie'));
    }
    dit(!o.journal.erreurs.length, 'G', `${T} Ventes : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }

  // ── J : Ma journée ──
  if (SCENES.includes('J')) {
    const o = await ouvrir('journee');
    await attendre(o.pg, '[data-job="remettre-en-vente"]', 20000);
    await attendre(o.pg, '[data-job="achat-a-relier"]', 8000);
    await calme(o.pg);
    const j = await o.pg.evaluate(() => { const g = (id) => { const e = document.querySelectorAll(`[data-job="${id}"]`); return { n: e.length, val: e[0] ? e[0].getAttribute('data-n') : null, txt: e[0] ? e[0].innerText.replace(/\s+/g, ' ') : '' }; }; return { r: g('remettre-en-vente'), a: g('achat-a-relier') }; });
    dit(j.r.n === 1 && j.r.val === '3' && /1 sans N°/.test(j.r.txt), 'J', `${T} « 3 ventes annulées avant l’envoi » : une ligne, la vente sans N° nommée`, JSON.stringify(j.r));
    dit(j.a.n === 1 && j.a.val === '3', 'J', `${T} « 3 annonces sans achat relié » : une ligne`, JSON.stringify(j.a));
    const g = await GENERAL(o.pg, tel, '[data-job="remettre-en-vente"], [data-job="achat-a-relier"]');
    dit(!g.rouges.length && !g.debord && (!tel || !g.petits.length), 'G', `${T} Ma journée : ni rouge, ni débord, 44 px`, JSON.stringify(g));
    await o.pg.locator('[data-job="remettre-en-vente"]').first().scrollIntoViewIfNeeded().catch(() => {});
    await capture(o.pg, nomS('journee'));
    await clic(o.pg, '[data-job="remettre-en-vente"]');
    const vu = await attendre(o.pg, '[data-remise-vente]', 20000);
    const filtre = await o.pg.evaluate(() => { const b = [...document.querySelectorAll('button[aria-pressed="true"]')].map((x) => x.innerText.trim()); return { b, lignes: [...document.querySelectorAll('.vrm-ventes-liste [data-tx]')].map((x) => x.getAttribute('data-tx')) }; });
    dit(vu && filtre.b.some((t) => /^Annulées/.test(t)) && !filtre.lignes.includes('62001'), 'J', `${T} « Voir » mène à Ventes · Vinted, filtre « Annulées »`, JSON.stringify(filtre));
    dit(!o.journal.erreurs.length, 'G', `${T} Ma journée : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }

  // ── A : Annonces · Sans achat relié ──
  if (SCENES.includes('A')) {
    const o = await ouvrir('cat_annonces');
    await attendre(o.pg, '[data-vue-sans-achat]', 20000);
    const f0 = await o.pg.evaluate(() => (document.querySelector('[data-vue-sans-achat]') || {}).getAttribute ? document.querySelector('[data-vue-sans-achat]').getAttribute('data-vue-sans-achat') : null);
    dit(f0 === '3', 'A', `${T} le filtre « Sans achat relié · 3 » (prix saisi, achat relié et sans N° hors de la file)`, f0);
    await clic(o.pg, '[data-vue-sans-achat]');
    await attendre(o.pg, '[data-ar-ligne]', 8000);
    await attendre(o.pg, '[data-ar-sugg]:not([data-ar-sugg=""])', 15000);
    await o.pg.waitForTimeout(800); await calme(o.pg);
    const a = await o.pg.evaluate(() => { const L = [...document.querySelectorAll('[data-ar-ligne]')]; return { ordre: L.map((x) => x.getAttribute('data-ar-ligne')), sugg: Object.fromEntries(L.map((x) => [x.getAttribute('data-ar-ligne'), x.getAttribute('data-ar-sugg-tx')])), relier: (document.querySelector('[data-ar-relier="7300001"]') || {}).innerText || '', sans: L.filter((x) => x.querySelector('[data-ar-sans-sugg]')).map((x) => x.getAttribute('data-ar-ligne')) }; });
    dit(a.ordre.length === 3 && a.sugg['51001'] === '7300001', 'A', `${T} 51001 : LA suggestion (même marque, même taille, achetée avant)`, JSON.stringify(a));
    dit(a.sugg['51002'] === '' && a.sans.includes('51002') && a.sugg['52001'] === '', 'A', `${T} achat postérieur, couleur contraire : aucune suggestion (dit)`, JSON.stringify(a));
    dit(/32\s?€/.test(a.relier), 'A', `${T} « Relier » montre le prix qu’il écrira`, a.relier);
    const g = await GENERAL(o.pg, tel, '[data-ar]');
    dit(!g.rouges.length && !g.debord && (!tel || !g.petits.length), 'G', `${T} Sans achat relié : ni rouge, ni débord, 44 px`, JSON.stringify(g));
    await o.pg.locator('[data-ar]').first().scrollIntoViewIfNeeded().catch(() => {});
    const doublon = await o.pg.evaluate(() => !!document.querySelector('[data-ann-filtre]'));
    dit(!doublon, 'A', `${T} le nombre de la file n’est pas redit par la ligne « N annonces affichées »`);
    await capture(o.pg, nomS('sans-achat'));
    dit(!((lignesMain(o.base).vinted_annonce_numeros || {})['51001'] || {}).buyFromId, 'A', `${T} rien n’est relié avant SON tap`);
    await clic(o.pg, '[data-ar-relier="7300001"]');
    const ecrit = await ecriture(o.base, (m) => { const e = (m.vinted_annonce_numeros || {})['51001']; return e && String(e.buyFromId) === '7300001' && Number(String(e.buyPrice).replace(',', '.')) === 32; });
    dit(ecrit, 'A', `${T} SON tap « Relier » écrit le lien et le prix (32 €)`, JSON.stringify((lignesMain(o.base).vinted_annonce_numeros || {})['51001']));
    await o.pg.waitForTimeout(600);
    await clic(o.pg, '[data-ar-ligne="51002"] [data-ar-plus-tard-geste]');
    await o.pg.waitForTimeout(800);
    const b = await o.pg.evaluate(() => [...document.querySelectorAll('[data-ar-ligne]')].map((x) => x.getAttribute('data-ar-ligne') + (x.hasAttribute('data-ar-plus-tard') ? '*' : '')));
    dit(b.length === 2 && b[b.length - 1] === '51002*', 'A', `${T} 51001 sort de la file ; « Plus tard » range 51002 en fin de file`, JSON.stringify(b));
    const pt = (lignesMain(o.base).vinted_annonce_numeros || {})['51002'] || {};
    dit(!pt.buyPrice && !pt.buyFromId, 'A', `${T} « Plus tard » n’écrit aucun prix`, JSON.stringify(pt));
    dit(!o.journal.erreurs.length, 'G', `${T} Sans achat relié : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }

  // ── M : Prix mini sur une sélection ──
  if (SCENES.includes('M')) {
    const o = await ouvrir('cat_annonces');
    await attendre(o.pg, '[data-vue-selection]', 20000);
    await clic(o.pg, '[data-vue-selection]');
    await attendre(o.pg, '[data-selection-annonce="52001"]', 10000);
    for (const id of ['51001', '51003', '52001']) await clic(o.pg, `[data-selection-annonce="${id}"] input`);
    await clic(o.pg, '[data-actions-possibles]');
    await attendre(o.pg, '[data-actions-selection]', 6000);
    const f = await o.pg.evaluate(() => { const m = document.querySelector('[data-action-sel="mini"]'); return { mini: m ? m.getAttribute('data-action-sel-ok') : null, tuiles: [...document.querySelectorAll('.vrm-act-choix')].map((x) => x.getAttribute('data-action-sel-ok')), h: m ? Math.round(m.querySelector('button').getBoundingClientRect().height) : 0 }; });
    dit(f.mini === 'oui' && f.tuiles.length === 4 && f.tuiles.every((x) => x === 'non'), 'M', `${T} deux comptes : les quatre tuiles des moteurs grisées, « Prix mini… » possible`, JSON.stringify(f));
    if (tel) dit(f.h >= 44, 'M', `${T} « Prix mini… » fait 44 px au doigt`, String(f.h));
    await capture(o.pg, nomS('actions-mini'));
    await clic(o.pg, '[data-action-sel="mini"] button');
    await attendre(o.pg, '[data-prix-mini]', 6000);
    await o.pg.waitForTimeout(400);
    const lire = () => o.pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-mini-ligne]')].map((x) => [x.getAttribute('data-mini-ligne'), { mini: x.getAttribute('data-mini-valeur'), refus: x.getAttribute('data-mini-refus'), sous: x.hasAttribute('data-mini-sous') }])));
    const vide = { mini: null, refus: null, sous: false };
    const sur = (m) => new Proxy(m || {}, { get: (o, k) => o[k] || vide });   // un banc ne meurt pas : une ligne absente se lit vide
    const m1 = sur(await lire());
    dit(m1['51001'] && m1['51001'].mini === '54' && m1['51003'].mini === '34' && m1['52001'].mini === '108', 'M', `${T} − 10 % arrondi : 60 → 54, 38 → 34, 120 → 108`, JSON.stringify(m1));
    dit(m1['51003'].sous && !m1['51001'].sous && !m1['52001'].sous, 'M', `${T} 34 € sous un achat de 35 € : la ligne le dit`, JSON.stringify(m1));
    const av = await ambre(o.pg, '[data-mini-sous-achat]');
    dit(av && av.ambre, 'M', `${T} « sous ton prix d’achat » en ambre (un geste à regarder)`, JSON.stringify(av));
    await clic(o.pg, '[data-mini-refus-on]');
    await o.pg.waitForTimeout(300);
    const m2 = sur(await lire());
    dit(m2['51001'].refus === '42' && m2['52001'].refus === '84', 'M', `${T} « Refuser sous » − 30 % : 42, 84 (toujours sous le mini)`, JSON.stringify(m2));
    const g = await GENERAL(o.pg, tel, '[data-prix-mini]');
    dit(!g.rouges.length && !g.debord && (!tel || !g.petits.length), 'G', `${T} Prix mini : ni rouge, ni débord, 44 px`, JSON.stringify(g));
    await capture(o.pg, nomS('prix-mini'));
    const avant = JSON.stringify(lignesMain(o.base).vinted_annonce_numeros || {});
    await clic(o.pg, '[data-mini-poser]');
    await o.pg.waitForTimeout(500);
    const conf = await o.pg.evaluate(() => { const d = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].pop(); return d ? d.innerText : ''; });
    dit(/N°3 · 60\s?€ → mini 54\s?€/.test(conf) && /N°8 · 120\s?€ → mini 108\s?€/.test(conf), 'M', `${T} la confirmation liste N° · prix · mini`, conf.slice(0, 300));
    dit(JSON.stringify(lignesMain(o.base).vinted_annonce_numeros || {}) === avant, 'M', `${T} rien n’est écrit avant la confirmation`);
    await capture(o.pg, nomS('prix-mini-confirmation'));
    await o.pg.getByRole('button', { name: 'Poser', exact: true }).last().click().catch(() => {});
    const ok = await ecriture(o.base, (m) => { const n = m.vinted_annonce_numeros || {}; return n['51001'] && n['51001'].min === '54' && n['51001'].refuse === '42' && n['52001'] && n['52001'].min === '108' && n['51003'].min === '34'; });
    dit(ok, 'M', `${T} écrit par le chemin de la carte : min « 54 », refuse « 42 »… (entiers lus par l’extension)`, JSON.stringify(lignesMain(o.base).vinted_annonce_numeros));
    dit(!o.journal.erreurs.length, 'G', `${T} Prix mini : aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
    await o.ctx.close();
  }
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const theme of THEMES) for (const W of LARGEURS) {
      try { await passe(nav, { W, theme }); }
      catch (e) { dit(false, 'G', `[${W}px ${theme}] le passage a pu aller au bout`, String(e && e.stack).slice(0, 300)); }
    }
  } catch (e) { dit(false, 'G', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ vague2-ventes : ${ko} défaut(s)` : '\n✅ vague2-ventes : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
