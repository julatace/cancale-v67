// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA CASE SUR LA PHOTO » (11 nov. ; docs/passation/2026-11-11-ventes-vestiaire.md)
//  Julien : « corrige le bug visuel du carré sur la photo ». La case de sélection
//  en série (`CaseSerie … surPhoto`) dessinait un carré blanc sur chaque vignette
//  de Ventes et d'Achats, sélection FERMÉE. Données INVENTÉES (dépôt public),
//  harnais du banc `nouveau-vendeur`, photos servies en SVG dans la page.
//  Il MESURE (styles calculés et rectangles, jamais un libellé) :
//   R  REPOS — sélection fermée, souris hors de la ligne : rien n'est visible
//      au-dessus de la photo (opacité 0 ou non rendu), ni case ni fond.
//   S  SURVOL (souris) — la case paraît DANS LE COIN haut-gauche de la photo,
//      ronde (cercle de 22 px, bord blanc), jamais au milieu.
//   O  SÉLECTION OUVERTE — la case est là sur chaque photo, ronde, dans le
//      coin ; cochée = rond plein de la couleur d'accent.
//  Ventes et Achats, 390 px tactile et 1512 px, clair et sombre.
//  Réglages : `BANC_PORT`, `LARGEURS`, `THEMES`, `ECRANS=ventes,achats`, `SHOTS`.
//  Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || String(9600 + Math.floor(Math.random() * 300));
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const ECRANS = liste('ECRANS', 'ventes,achats');
const SHOTS = process.env.SHOTS || '';

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) ok++; else ko++; if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`); };

// Une photo inventée : un SVG coloré (aucune photo réelle, aucun réseau).
const svg = (n) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="hsl(${(n * 67) % 360},45%,45%)"/><circle cx="100" cy="110" r="50" fill="hsl(${(n * 67 + 180) % 360},50%,70%)"/></svg>`)}`;
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const vente = (tx, title, prix, status, tus, jours) => ({ transaction_id: tx, title, price: { amount: String(prix), currency_code: 'EUR' }, status, transaction_user_status: tus, date: iso(jours), photo: { url: svg(tx) } });
const achat = (tx, title, prix, jours, status, tus = 'needs_action') => ({ transaction_id: tx, conversation_id: 8500000 + tx % 1000, title, price: { amount: String(prix), currency_code: 'EUR' }, status, transaction_user_status: tus, date: iso(jours), photo: { url: svg(tx) } });
const jeu = () => [
  { id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vrm_numerotation: { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z' } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(0.01), payload: { my_orders: [
    achat(7400001, 'Adidas Spezial noire 42', 32, 3, 'Colis arrivé au point relais'),
    achat(7400002, 'Nike Dunk Low panda 41', 55, 4, 'Commande finalisée', 'completed'),
    achat(7400003, 'Asics Gel-1130 argent 43', 40, 5, 'Commande finalisée', 'completed'),
  ] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: [
    vente(64001, 'Salomon XT-6 grise taille 42', 120, 'Bordereau envoyé au vendeur', 'needs_action', 1),
    vente(64002, 'Vans Old Skool taille 42', 42, 'Commande finalisée', 'completed', 4),
    vente(64003, 'Puma Suede bleue taille 40', 45, 'Commande finalisée', 'completed', 6),
  ] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0.02), payload: { my_orders: [] } } },
];

const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };

// Ce que la case dessine AU-DESSUS de la photo : visible ? où ? quelle forme ?
const mesure = (pg) => pg.evaluate(() => [...document.querySelectorAll('.vrm-serie-case-photo')].map((c) => {
  const cadre = c.parentElement, rc = cadre.getBoundingClientRect();
  const visibleDe = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false; } return !!el.getClientRects().length; };
  const sl = getComputedStyle(c), inp = c.querySelector('input'), si = inp ? getComputedStyle(inp) : null, ri = inp ? inp.getBoundingClientRect() : null;
  const fondLabel = sl.backgroundColor !== 'rgba(0, 0, 0, 0)' && sl.backgroundColor !== 'transparent';
  return {
    ligne: (c.closest('[data-serie-ligne]') || {}).getAttribute ? c.closest('[data-serie-ligne]').getAttribute('data-serie-ligne') : '',
    visible: visibleDe(c) && !!inp && visibleDe(inp),
    fondLabel,
    // position du rond par rapport au coin haut-gauche du cadre de la photo
    dx: ri ? Math.round(ri.left - rc.left) : null, dy: ri ? Math.round(ri.top - rc.top) : null,
    w: ri ? Math.round(ri.width) : null, h: ri ? Math.round(ri.height) : null, cadreW: Math.round(rc.width), cadreH: Math.round(rc.height),
    rond: si ? (/50%/.test(si.borderTopLeftRadius) || parseFloat(si.borderTopLeftRadius) >= (ri.width / 2 - 1)) : false,
    bordBlanc: si ? (parseFloat(si.borderTopWidth) >= 1.5 && /rgb\(255, 255, 255\)|rgba\(255, 255, 255/.test(si.borderTopColor)) : false,
    natif: si ? si.appearance !== 'none' : true,
    fondCoche: si ? si.backgroundColor : '', coche: c.getAttribute('data-serie-on') === '1' || !!(c.closest('[data-serie-coche="1"]')),
  };
}));
const auCoin = (m) => m.dx != null && m.dx >= 0 && m.dx <= 8 && m.dy >= 0 && m.dy <= 8 && Math.abs(m.w - 22) <= 2 && Math.abs(m.h - 22) <= 2;
const forme = (m) => auCoin(m) && m.rond && m.bordBlanc && !m.natif && !m.fondLabel;

async function passe(nav, { W, theme, ecran }) {
  const sombre = theme === 'sombre', tel = W < 600, T = `[${ecran} ${W}px ${theme}]`, nomS = (x) => `case-photo-${ecran}-${W}-${theme}-${x}`;
  const o = await NV.ouvrir(nav, { W, sombre, base: { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 }, tab: ecran });
  const pg = o.pg; await pg.waitForTimeout(1500);
  if (ecran === 'ventes') await pg.locator('[data-selecteur-logos] button[data-site="vinted"]').first().click().catch(() => {});
  const L = ecran === 'ventes' ? '[data-serie-ligne="64001"]' : '[data-serie-ligne="7400001"]';
  const lu = await pg.waitForSelector(L + ' .vrm-serie-case-photo', { timeout: 25000, state: 'attached' }).then(() => true).catch(() => false);
  dit(lu, `${T} les lignes portent la case sur la photo`);
  if (!lu) { await capture(pg, nomS('vide')); await o.ctx.close(); return; }
  await pg.mouse.move(W - 5, 5); await pg.waitForTimeout(500);
  await pg.waitForFunction(() => [...document.querySelectorAll('.vrm-serie-case-photo')].some((c) => { const i = c.parentElement.querySelector('img'); return i && i.complete; }), null, { timeout: 5000 }).catch(() => {});
  // R — au repos
  const r = await mesure(pg);
  const vus = r.filter((m) => m.visible || m.fondLabel && m.visible);
  dit(r.length >= 3 && !vus.length, `${T} R · sélection fermée : rien au-dessus des ${r.length} photos`, JSON.stringify(vus.slice(0, 2)));
  await pg.locator(L).first().scrollIntoViewIfNeeded().catch(() => {});
  await capture(pg, nomS('repos'));
  // S — survol (souris seulement)
  if (!tel) {
    await pg.locator(L).first().hover({ position: { x: 300, y: 20 } }).catch(() => {});
    await pg.waitForTimeout(400);
    const s = (await mesure(pg)).find((m) => L.includes(`"${m.ligne}"`));
    dit(!!s && s.visible && forme(s), `${T} S · survol : un rond de 22 px, bord blanc, dans le coin de la photo`, JSON.stringify(s));
    const autres = (await mesure(pg)).filter((m) => !L.includes(`"${m.ligne}"`) && m.visible);
    dit(!autres.length, `${T} S · les autres lignes restent nues`, JSON.stringify(autres.slice(0, 1)));
    await capture(pg, nomS('survol'));
  }
  // O — sélection ouverte (bouton « Sélectionner » ; au doigt, appui long équivalent)
  await pg.mouse.move(W - 5, 5);
  const btn = pg.locator(`[data-serie-ouvrir="${ecran}"]`).first();
  if (await btn.count()) await btn.click().catch(() => {});
  else await pg.locator(`${L} .vrm-serie-case-photo input`).first().click({ force: true }).catch(() => {});
  await pg.waitForTimeout(400);
  if (!(await pg.$('[data-serie-case][data-serie-actif="1"]'))) await pg.locator(`${L} .vrm-serie-case-photo input`).first().click({ force: true }).catch(() => {});
  await pg.waitForTimeout(300);
  const ouv = await mesure(pg);
  dit(ouv.length >= 3 && ouv.every((m) => m.visible && forme(m)), `${T} O · sélection ouverte : un rond propre dans le coin de chaque photo`, JSON.stringify(ouv.filter((m) => !(m.visible && forme(m))).slice(0, 2)));
  // cocher la ligne : rond plein (accent), pas un fond blanc
  const deja = (ouv.find((m) => L.includes(`"${m.ligne}"`)) || {}).coche;
  if (!deja) await pg.locator(`${L} .vrm-serie-case-photo input`).first().click({ force: true }).catch(() => {});
  await pg.waitForTimeout(300);
  const c = (await mesure(pg)).find((m) => L.includes(`"${m.ligne}"`));
  const plein = c && /rgba?\((\d+), (\d+), (\d+)/.exec(c.fondCoche);
  const bleu = plein && Number(plein[3]) > 150 && Number(plein[1]) < 80;
  dit(!!c && c.coche && bleu && forme(c), `${T} O · cochée : rond plein de la couleur d'accent`, JSON.stringify(c));
  await capture(pg, nomS('ouverte'));
  dit(!o.journal.erreurs.length, `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((okk) => NV.srv.listen(NV.PORT, okk));
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  for (const W of LARGEURS) for (const theme of THEMES) for (const ecran of ECRANS) {
    try { await passe(nav, { W, theme, ecran }); } catch (e) { dit(false, `[${ecran} ${W}px ${theme}] le banc a planté`, e && e.message); }
  }
  await nav.close(); try { NV.srv.close(); } catch (_) {}
  console.log(`case-photo : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
