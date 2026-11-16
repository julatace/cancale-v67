// ════════════════════════════════════════════════════════════════════════════
//  BANC « VENTES — LA SÉLECTION » (16 nov. ; docs/passation/2026-11-16-ventes-selection.md)
//  Capture de Julien (iPhone, production) : « 1 sélectionné · Tout sélectionner · 2185 »,
//  la barre posée PAR-DESSUS les tuiles et la barre du bas, les tuiles lues À TRAVERS elle.
//  Données INVENTÉES (le dépôt est public) : 2 000 ventes finalisées + 3 ventes à envoyer,
//  harnais `nouveau-vendeur` (aucune écriture ne sort du banc). 390 px tactile et 1512 px.
//  Il MESURE (data-*, rectangles, nombres rendus) :
//   T  « Toutes » : la barre compte les lignes DESSINÉES (≤ 60), jamais l'historique (2 003) ;
//      « Tout sélectionner » coche ce nombre-là ; changer de filtre VIDE la sélection.
//   E  « À envoyer » (3 lignes) : « Tout sélectionner · 3 » ; « Imprimer » 0 sur 3 (aucun
//      bordereau prêt) grisé, « Je dépose » 3/3 ; changer d'écran vide la sélection.
//   R  RIEN RECOUVERT : barre ∩ tuiles = vide, barre ∩ barre du bas = vide (au téléphone la
//      barre du bas cède sa place), fond OPAQUE, la dernière ligne remonte au-dessus de la
//      barre ; « Annuler » à côté du compte ; les 4 actions sur UNE rangée ; cibles 44 px.
//  Réglages : `BANC_PORT` (au hasard par défaut), `LARGEURS=390,1512`, `THEMES=clair,sombre`,
//  `SHOTS=<dossier>`, `BANC_DIST`. Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || String(9600 + Math.floor(Math.random() * 300));
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const SHOTS = process.env.SHOTS || '';

let ko = 0; const compte = {};
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  if (!bon || process.env.BAVARD) console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 600) : ''}`);
};

// ── LE JEU INVENTÉ ──────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const vente = (tx, title, prix, status, tus, jours) => ({ transaction_id: tx, title, price: { amount: String(prix), currency_code: 'EUR' }, status, transaction_user_status: tus, date: iso(jours), photo: null });
const HISTO = 2000;
const jeu = () => {
  const v = [
    vente(64001, 'Salomon XT-6 grise taille 42', 120, 'Bordereau envoyé au vendeur', 'needs_action', 0.5),
    vente(64002, 'Vans Old Skool taille 42', 42, 'Bordereau envoyé au vendeur', 'needs_action', 1),
    vente(64003, 'Puma Suede bleue taille 40', 45, 'Bordereau envoyé au vendeur', 'needs_action', 1.5),
  ];
  for (let i = 0; i < HISTO; i++) v.push(vente(70000 + i, `Paire inventée n°${i} taille 4${i % 6}`, 30 + (i % 50), 'Commande finalisée', 'completed', 3 + i * 0.2));
  return [
    { id: 'main', data: { vrm_bienvenue_vue: { at: iso(0) }, vrm_visite_vue: { at: iso(0) }, vrm_numerotation: { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z' } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: iso(0.01), payload: { my_orders: v } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(0.01), payload: { my_orders: [] } } },
    { id: 'harvest_222_orders_sold', data: { capturedAt: iso(0.02), payload: { my_orders: [] } } },
  ];
};
const TOTAL = HISTO + 3;

const attendre = async (pg, sel, ms = 15000) => pg.waitForSelector(sel, { timeout: ms }).then(() => true).catch(() => false);
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); };
const barre = (pg) => pg.evaluate(() => {
  const b = document.querySelector('[data-serie-barre]:not([data-serie-fermee])'); if (!b) return null;
  const tout = b.querySelector('[data-serie-tout]');
  return { n: b.getAttribute('data-serie-n'), total: b.getAttribute('data-serie-total'), tout: tout ? tout.getAttribute('data-serie-tout') : null, toutTexte: tout ? tout.textContent.trim() : '' };
});
const dessinees = (pg) => pg.evaluate(() => new Set([...document.querySelectorAll('[data-serie-ligne]:not([data-serie-hors])')].filter((x) => x.getClientRects().length).map((x) => x.getAttribute('data-serie-ligne'))).size);
const appuiLong = async (pg, sel) => {
  await pg.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await pg.waitForTimeout(250);
  const box = await pg.locator(sel).first().boundingBox(); if (!box) return false;
  const x = box.x + box.width / 2, y = box.y + Math.min(box.height / 2, 30);
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await pg.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return true;
};
const ouvrirSelection = async (pg, tel, tx) => {
  if (tel) await appuiLong(pg, `[data-serie-ligne="${tx}"]`);
  else await pg.locator(`[data-serie-ligne="${tx}"] [data-serie-case] input`).first().click({ timeout: 5000, force: true }).catch(() => {});
  await pg.waitForTimeout(500);
};
// Géométrie : la barre contre les tuiles, la barre du bas et la fin de la liste.
const GEO = (pg) => pg.evaluate(() => {
  const b = document.querySelector('[data-serie-barre]:not([data-serie-fermee])'); if (!b) return null;
  const rb = b.getBoundingClientRect();
  const inter = (r) => r.width > 0 && r.height > 0 && !(r.right <= rb.left || r.left >= rb.right || r.bottom <= rb.top + 0.5 || r.top >= rb.bottom - 0.5);
  const tuiles = [...document.querySelectorAll('[data-fu-case]')].filter((x) => x.getClientRects().length).map((x) => x.getBoundingClientRect());
  const nav = document.querySelector('.vrm-mobile-nav, .vrm-tabbar');
  const rn = nav && nav.getClientRects().length && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect() : null;
  const fond = getComputedStyle(b).backgroundColor;
  const m = /rgba?\(([^)]+)\)/.exec(fond); const alpha = m ? (m[1].split(',').length === 4 ? Number(m[1].split(',')[3]) : 1) : 0;
  const tete = b.querySelector('.vrm-serie-tete'), comp = tete && tete.querySelector('[data-serie-compte]'), ann = tete && tete.querySelector('[data-serie-annuler]');
  const rc = comp && comp.getBoundingClientRect(), ra = ann && ann.getBoundingClientRect();
  const acts = [...b.querySelectorAll('[data-serie-action]')].map((x) => x.getBoundingClientRect());
  const rangee = acts.length ? new Set(acts.map((r) => Math.round(r.top))).size : 0;
  const coupe = [...b.querySelectorAll('[data-serie-action] .vrm-serie-action-nom')].filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent);
  const petits = [...b.querySelectorAll('button')].filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => x.textContent.trim());
  return {
    tuilesTouchees: tuiles.filter(inter).length, nTuiles: tuiles.length,
    navTouchee: !!(rn && inter(rn)), navVisible: !!rn, alpha,
    annulerACote: !!(rc && ra && Math.abs((rc.top + rc.bottom) / 2 - (ra.top + ra.bottom) / 2) < 8 && ra.left - rc.right < 40 && ra.left > rc.left),   // centres alignés, juste après le compte
    rangee, nActions: acts.length, coupe, petits, debord: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    barreHaut: rb.top,
  };
});
// Faire défiler jusqu'au bout : la dernière ligne dessinée remonte au-dessus de la barre.
const finVisible = async (pg) => {
  await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = m.scrollHeight; window.scrollTo(0, document.documentElement.scrollHeight); });
  await pg.waitForTimeout(400);
  return pg.evaluate(() => {
    const b = document.querySelector('[data-serie-barre]:not([data-serie-fermee])'); if (!b) return null;
    const ls = [...document.querySelectorAll('[data-serie-ligne]')].filter((x) => x.getClientRects().length);
    const d = ls[ls.length - 1]; if (!d) return null;
    return { basLigne: Math.round(d.getBoundingClientRect().bottom), hautBarre: Math.round(b.getBoundingClientRect().top) };
  });
};

async function passe(nav, { W, theme }) {
  const sombre = theme === 'sombre', tel = W < 600, T = `[${W}px ${theme}]`, nomS = (x) => `vsel-${W}-${theme}-${x}`;
  const o = await NV.ouvrir(nav, { W, sombre, base: { lignes: jeu(), comptes: NV.JEU_COMPTES, ecritures: 0 }, tab: 'ventes' });
  const pg = o.pg;
  await pg.waitForTimeout(1500);
  await pg.locator('[data-selecteur-logos] button[data-site="vinted"]').first().click().catch(() => {});
  const lu = await attendre(pg, '[data-serie-ligne="64001"]', 30000);
  dit(lu, 'T', `${T} Ventes · Vinted : les lignes inventées sont rendues`);

  // ── T : « Toutes » ─────────────────────────────────────────────────────────
  await ouvrirSelection(pg, tel, '64001');
  let b = await barre(pg), nd = await dessinees(pg);
  dit(b && b.n === '1', 'T', `${T} la sélection s'ouvre avec la ligne touchée (1)`, JSON.stringify(b));
  dit(b && Number(b.total) === nd && nd > 0 && nd <= 60, 'T', `${T} « Tout sélectionner » compte les lignes DESSINÉES (${nd}), pas l'historique (${TOTAL})`, JSON.stringify({ b, nd }));
  dit(b && Number(b.total) !== TOTAL && !/2\s?003/.test(b.toutTexte), 'T', `${T} jamais « Tout sélectionner · ${TOTAL} »`, JSON.stringify(b));
  const g = await GEO(pg);
  dit(g && g.tuilesTouchees === 0, 'R', `${T} barre ∩ tuiles = vide (${g && g.nTuiles} tuiles)`, JSON.stringify(g));
  dit(g && !g.navTouchee, 'R', `${T} barre ∩ barre du bas = vide${tel ? ' (elle cède sa place)' : ''}`, JSON.stringify(g));
  dit(g && g.alpha >= 0.99, 'R', `${T} fond de la barre opaque (alpha ${g && g.alpha})`, JSON.stringify(g));
  dit(g && g.annulerACote, 'R', `${T} « Annuler » à côté du compte`, JSON.stringify(g));
  dit(g && g.nActions === 4 && g.rangee === 1 && !g.coupe.length, 'R', `${T} les 4 actions sur UNE rangée, libellés entiers`, JSON.stringify(g));
  dit(g && !g.debord && (!tel || !g.petits.length), 'R', `${T} ni débord${tel ? ', cibles de 44 px' : ''}`, JSON.stringify(g));
  await capture(pg, nomS('toutes-ouverte'));
  await pg.locator('[data-serie-tout]').first().click().catch(() => {});
  await pg.waitForTimeout(300);
  b = await barre(pg);
  dit(b && b.n === b.total && Number(b.n) === nd, 'T', `${T} « Tout sélectionner » coche les ${nd} lignes dessinées`, JSON.stringify(b));
  const fin = await finVisible(pg);
  dit(fin && fin.basLigne <= fin.hautBarre + 1, 'R', `${T} au bout de la liste, la dernière ligne est AU-DESSUS de la barre`, JSON.stringify(fin));
  await capture(pg, nomS('toutes-fin'));
  // Changer de filtre vide la sélection.
  await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
  await pg.locator('.vrm-sales-workbar .vrm-filtres button', { hasText: 'Finalisées' }).first().click({ timeout: 5000 }).catch(() => {});
  await pg.waitForTimeout(600);
  dit(!(await barre(pg)), 'T', `${T} changer de filtre (Finalisées) VIDE la sélection`, JSON.stringify(await barre(pg)));
  dit(await pg.evaluate(() => !document.documentElement.hasAttribute('data-serie-ouverte')), 'R', `${T} sélection fermée : la barre du bas revient`);

  // ── E : « À envoyer » (3 lignes au milieu de 2 000) ───────────────────────
  await pg.evaluate((at) => { localStorage.setItem('vrm_reprise_ecrans', JSON.stringify({ vues: { 'ventes-filtre': { valeur: 'aexpedier', at } } })); }, Date.now() - 1000);
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1500);
  await pg.locator('[data-selecteur-logos] button[data-site="vinted"]').first().click().catch(() => {});
  await attendre(pg, '[data-serie-ligne="64001"]', 30000);
  await pg.waitForTimeout(500);
  const ndE = await dessinees(pg);
  dit(ndE === 3, 'E', `${T} filtre « À envoyer » : 3 lignes dessinées`, String(ndE));
  await ouvrirSelection(pg, tel, '64002');
  b = await barre(pg);
  dit(b && b.n === '1' && b.total === '3' && b.tout === '3' && /3$/.test(b.toutTexte), 'E', `${T} « Tout sélectionner · 3 »`, JSON.stringify(b));
  await pg.locator('[data-serie-tout]').first().click().catch(() => {});
  await pg.waitForTimeout(300);
  b = await barre(pg);
  dit(b && b.n === '3', 'E', `${T} « Tout sélectionner » coche les 3`, JSON.stringify(b));
  const port = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-serie-action]')].map((x) => [x.getAttribute('data-serie-action'), { p: x.getAttribute('data-serie-portee'), off: x.disabled, t: x.textContent.trim() }])));
  dit(port.imprimer && port.imprimer.p === '0/3' && port.imprimer.off && /0 sur 3/.test(port.imprimer.t), 'E', `${T} « Imprimer » : 0 sur 3 (aucun bordereau prêt), grisé`, JSON.stringify(port.imprimer));
  dit(port.depose && port.depose.p === '3/3' && !port.depose.off, 'E', `${T} « Je dépose » : les 3`, JSON.stringify(port.depose));
  const gE = await GEO(pg);
  dit(gE && gE.tuilesTouchees === 0 && !gE.navTouchee, 'R', `${T} « À envoyer » : rien recouvert`, JSON.stringify(gE));
  await capture(pg, nomS('aenvoyer-tout'));
  // Changer d'écran vide la sélection (téléphone : « Annuler » rend la barre du bas ; ordinateur : la barre latérale).
  if (tel) {
    dit(await pg.evaluate(() => { const n = document.querySelector('.vrm-mobile-nav'); return !n || getComputedStyle(n).display === 'none'; }), 'R', `${T} pendant la sélection, la barre du bas cède sa place`);
    await pg.locator('[data-serie-annuler]').first().click().catch(() => {});
    await pg.waitForTimeout(300);
    dit(!(await barre(pg)) && await pg.evaluate(() => { const n = document.querySelector('.vrm-mobile-nav'); return !!n && getComputedStyle(n).display !== 'none'; }), 'E', `${T} « Annuler » ferme et rend la barre du bas`);
    await ouvrirSelection(pg, tel, '64001');
  }
  // L'écran change (un autre onglet) puis revient : plus rien de sélectionné.
  const clic = await pg.evaluate(() => {
    const c = [...document.querySelectorAll('nav a, nav button, aside a, aside button')].find((x) => /^\s*Annonces\s*$/.test(x.textContent || '') && x.getClientRects().length);
    if (c) { c.click(); return 'nav'; }
    return '';
  });
  if (!clic) await pg.evaluate(() => { history.pushState({}, '', '?tab=annonces'); dispatchEvent(new PopStateEvent('popstate')); });
  await pg.waitForTimeout(1200);
  dit(!(await barre(pg)), 'E', `${T} autre écran (${clic || 'lien'}) : aucune barre de sélection`, JSON.stringify(await barre(pg)));
  const retour = await pg.evaluate(() => {
    const c = [...document.querySelectorAll('nav a, nav button, aside a, aside button')].find((x) => /^\s*Ventes\s*$/.test(x.textContent || '') && x.getClientRects().length);
    if (c) { c.click(); return true; } return false;
  });
  if (!retour) await pg.evaluate(() => { history.pushState({}, '', '?tab=ventes'); dispatchEvent(new PopStateEvent('popstate')); });
  await pg.waitForTimeout(1500);
  dit(!(await barre(pg)) && await pg.evaluate(() => !document.querySelector('[data-serie-coche="1"]')), 'E', `${T} retour sur Ventes : plus rien de sélectionné`, JSON.stringify(await barre(pg)));
  dit(!o.journal.erreurs.length, 'G', `${T} aucune erreur JS`, o.journal.erreurs.join(' ¦ '));
  await o.ctx.close();
}

(async () => {
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--use-angle=swiftshader', '--no-sandbox'] });
  for (const W of LARGEURS) for (const theme of THEMES) {
    try { await passe(nav, { W, theme }); } catch (e) { dit(false, 'G', `[${W}px ${theme}] le banc a planté`, e && e.message); }
  }
  await nav.close(); try { NV.srv.close(); } catch (_) {}
  const tot = Object.values(compte).reduce((s, x) => s + x.ok, 0);
  console.log(`ventes-selection : ${tot} verts, ${ko} rouges · ` + Object.entries(compte).map(([k, v]) => `${k} ${v.ok}/${v.ok + v.ko}`).join(' · '));
  process.exit(ko ? 1 : 0);
})();
