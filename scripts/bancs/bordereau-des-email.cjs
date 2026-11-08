// ════════════════════════════════════════════════════════════════════════════
//  BANC « LE BORDEREAU D'UNE VENTE VUE PAR E-MAIL, PRÊT TOUT DE SUITE » (8 nov. ;
//  récit : docs/passation/2026-11-08-bordereau-des-email.md ; règle :
//  src/bordereauVenteEmail.js ; audit : scripts/audit-bordereau-des-email.cjs).
//  Données INVENTÉES (le dépôt est public) : le jeu du banc `nouveau-vendeur`
//  (comptes 111 et 222 ; une vente Vinted 62000 à envoyer avec son bordereau) +
//  une vente vue par e-mail (n° 62100099, compte 111 dont la liste des ventes
//  date d'hier) + l'e-mail de SON bordereau (même n°, PDF). La requête des
//  e-mails de vente est servie comme PostgREST (filtres, projection, §6.3).
//  Variantes :
//   B  « sans N° sûr » : le titre de l'e-mail ne porte aucun N° ; la ligne de
//      bordereau porte un `numero` 30 qu'un serveur aurait retrouvé PAR TITRE
//      (une fiche 30 au même titre existe) — il ne doit JAMAIS sortir.
//   N  « N° écrit » : le titre de l'annonce dans l'e-mail finit par « n12 »
//      (une fiche 12 au même titre) ⇒ N° 12.
//   A  « annulée » : la liste Vinted relue à l'instant porte le n°, annulé.
//  À 390 px tactile et 1512 px. Mesuré sur data-* et nombres (jamais un libellé) :
//   B1 COLIS — la vente e-mail a SA carte dans « À envoyer », groupe « prêt »,
//      SANS N° (`data-colis-num` vide, `data-colis-sans-num`) ; la publication
//      `vrm_colis_prets` compte 2 à imprimer sur 2 (62000 + elle).
//   B2 VENTES — la ligne « Vue par e-mail » porte « Imprimer » (`data-fu-imprimer`,
//      N° vide) et la mention sans N°.
//   B3 MA JOURNÉE — la tuile « à envoyer » dit 2.
//   N1 le N° écrit sort : carte et bouton disent 12.
//   A1 annulée : aucune carte, rien à imprimer pour ce n° ; 1 à imprimer.
//  Réglages : `BANC_PORT` (défaut 9716), `LARGEURS=390,1512`, `SHOTS=<dossier>`,
//  `BANC_DIST` (un autre dist/, pour juger la base). Un banc ne meurt pas : il rapporte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_PORT = process.env.BANC_PORT || '9716';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const NV = require('./nouveau-vendeur.cjs');
const { metaVersData } = require('./_meta.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const PORT = NV.PORT;
const LARGEURS = String(process.env.LARGEURS || '390,1512').split(',').map((x) => Number(x.trim())).filter(Boolean);
const SHOTS = process.env.SHOTS || '';
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

let ko = 0;
const compte = {};
const dit = (bon, cle, quoi, det) => {
  compte[cle] = compte[cle] || { ok: 0, ko: 0 };
  if (bon) compte[cle].ok++; else { compte[cle].ko++; ko++; }
  console.log(`${bon ? 'OK  ' : 'KO  '}${cle} ${quoi}${!bon && det ? ' — ' + String(det).slice(0, 500) : ''}`);
};
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }).catch(() => {}); };

// ── LE JEU INVENTÉ ──────────────────────────────────────────────────────────
const now = Date.now(), iso = (j) => new Date(now - j * 86400000).toISOString();
const TX = '62100099';
const TITRE = 'Nike Air Force 1 blanche taille 43';
const jeu = (variante) => {
  const l = JSON.parse(JSON.stringify(NV.JEU_LIGNES));
  const v1 = l.find((x) => x.id === 'harvest_111_orders_sold');
  v1.data.capturedAt = variante === 'A' ? iso(0.001) : iso(1);           // liste relue hier (le cas du 6 nov.) — ou à l'instant
  if (variante === 'A') v1.data.payload.my_orders.push({ transaction_id: Number(TX), title: TITRE, price: { amount: '72.00', currency_code: 'EUR' }, status: 'Commande annulée', transaction_user_status: 'failed', date: iso(0.05), photo: null });
  l.find((x) => x.id === 'harvest_111_listings').data.capturedAt = iso(0.0007);
  // Les fiches : une 30 et une 12 au MÊME titre (vendues, plus en ligne) — le titre seul ne dit pas laquelle.
  const fiches = l.find((x) => x.id === 'main').data.vinted_annonce_numeros;
  fiches['59030'] = { numero: '30', title: TITRE };
  fiches['59012'] = { numero: '12', title: TITRE };
  l.push({ id: 'email_sale_b1', data: { type: 'vente', designation: TITRE, prix: '72.00', pseudo: 'acheteur_x', account: 'vendeuse_a', uid: '111', transaction: TX, receivedAt: iso(0.05) } });
  const article = variante === 'N' ? TITRE + ' n12' : TITRE;
  l.push({ id: 'email_bord_' + TX, data: { type: 'bordereau', transaction: TX, filename: 'bordereau-' + TX + '.pdf', pdfB64: 'JVBERi0x', article, modele: TITRE,
    numero: variante === 'N' ? '12' : '30', account: 'vendeuse_a', uid: '111', receivedAt: iso(0.04), dateLimite: new Date(now + 4 * 86400000).toLocaleDateString('fr-FR') + ' 10 h 00' } });
  return l;
};

const servirVentesEmail = (lignes) => async (route) => {
  const u = decodeURIComponent(metaVersData(route.request().url()));
  const q = u.split('?')[1] || '';
  const filtres = []; let sel = null;
  for (const p of q.split('&')) {
    const i = p.indexOf('='); if (i < 0) continue;
    const k = p.slice(0, i), v = p.slice(i + 1);
    if (k === 'select') { sel = v; continue; }
    if (k === 'id' || k === 'order' || k === 'limit' || k === 'offset') continue;
    filtres.push([k, v]);
  }
  const champ = (d, k) => { let x = d; for (const s of k.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[s]; return x == null ? null : (typeof x === 'object' ? JSON.stringify(x) : String(x)); };
  const passe = (r) => filtres.every(([k, v]) => {
    const x = champ(r.data, k);
    if (v === 'not.is.null') return x != null;
    if (v === 'is.null') return x == null;
    if (v.startsWith('eq.')) return x === v.slice(3);
    if (v.startsWith('gte.')) return x != null && x >= v.slice(4);
    return true;
  });
  const out = lignes().filter((r) => /^email_sale_/.test(r.id) && passe(r)).map((r) => {
    const o = {};
    for (const part of String(sel || 'id').split(',')) { const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue; o[m[1] || m[2]] = m[2] === 'id' ? r.id : champ(r.data, m[2]); }
    return o;
  });
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, out.length - 1)}/${out.length}` }, body: JSON.stringify(out) });
};

const ferme = async (o) => { try { await o.ctx.close(); } catch (_) {} };
async function ouvrirSur(nav, { W, variante, tab }) {
  const base = { lignes: jeu(variante), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const o = await NV.ouvrir(nav, { W, sombre: false, base, tab: 'journee' });
  await o.pg.route(/\/rest\/v1\/app_data\?.*email_sale_/, servirVentesEmail(() => base.lignes));
  await o.pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await o.pg.waitForSelector('.vrm-main', { timeout: 20000 }).catch(() => {});
  return o;
}
const ongletEnvoyer = async (pg) => {
  await pg.waitForSelector('[data-colis-onglet-choix]', { timeout: 30000 }).catch(() => {});
  await pg.click('[data-colis-onglet-choix="envoyer"]').catch(() => {});
  await pg.waitForFunction(() => { const e = document.querySelector('[data-colis-onglet]'); return e && e.getAttribute('data-colis-onglet') === 'envoyer'; }, null, { timeout: 8000 }).catch(() => {});
  await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card]').length >= 1, null, { timeout: 20000 }).catch(() => {});
  await attendre(2500);
};
const lireColis = (pg) => pg.evaluate((tx) => {
  const carte = document.querySelector(`[data-bord-card][data-tx-colis="${tx}"]`);
  let prets = null; try { prets = JSON.parse(localStorage.getItem('vrm_colis_prets') || 'null'); } catch (_) {}
  return {
    cartes: [...document.querySelectorAll('[data-bord-card]')].map((x) => x.getAttribute('data-colis-ident')).filter(Boolean).sort(),
    carte: carte ? { groupe: carte.getAttribute('data-groupe-carte'), num: carte.getAttribute('data-colis-num'), email: carte.getAttribute('data-colis-vente-email'),
      sansNum: !!carte.querySelector('[data-colis-sans-num]'), imprime: !!carte.querySelector('[data-imprime="1"]'), texte: carte.innerText } : null,
    prets: prets ? { aImprimer: prets.aImprimer, prets: prets.prets, total: prets.total } : null,
    debord: document.documentElement.scrollWidth > window.innerWidth + 1,
    garde: /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.test(document.body.innerText),
  };
}, TX);

async function un(nav, W) {
  const T = `[${W}px]`;
  // B · sans N° sûr
  { const o = await ouvrirSur(nav, { W, variante: 'B', tab: 'cat_bord' });
    await ongletEnvoyer(o.pg);
    const r = await lireColis(o.pg);
    dit(!!r.carte && r.carte.groupe === 'pret' && r.carte.imprime && r.carte.email === '1', 'B1', `${T} Colis : la vente vue par e-mail a SA carte « prête à imprimer », bouton Imprimer`, JSON.stringify(r));
    dit(!!r.carte && r.carte.num === '' && r.carte.sansNum && !/N°\s*30\b/.test(r.carte.texte), 'B1', `${T} Colis : aucun N° deviné (le 30 retrouvé par titre ne sort pas), mention « sans N° »`, JSON.stringify(r.carte));
    dit(r.cartes.filter((c) => c === 'v:' + TX).length === 1 && r.cartes.includes('v:62000'), 'B1', `${T} Colis : une seule carte pour ce n°, la vente Vinted 62000 toujours là`, JSON.stringify(r.cartes));
    dit(!!r.prets && r.prets.aImprimer === 2 && r.prets.total === 2, 'B1', `${T} Colis publie 2 à imprimer sur 2 colis (vrm_colis_prets)`, JSON.stringify(r.prets));
    dit(!r.debord && !r.garde && !o.journal.erreurs.length, 'B0', `${T} Colis : rien ne déborde, aucune erreur`, JSON.stringify({ d: r.debord, g: r.garde, e: o.journal.erreurs }));
    await o.pg.locator(`[data-bord-card][data-tx-colis="${TX}"]`).first().scrollIntoViewIfNeeded().catch(() => {});
    await attendre(300); await capture(o.pg, `bde-colis-B-${W}`);
    await ferme(o); }
  { const o = await ouvrirSur(nav, { W, variante: 'B', tab: 'cat_ventes' });
    await o.pg.waitForSelector('[data-vente-email]', { timeout: 20000 }).catch(() => {});
    await o.pg.waitForSelector(`[data-fu-imprimer="${TX}"]`, { timeout: 15000 }).catch(() => {});
    const r = await o.pg.evaluate((tx) => {
      const l = document.querySelector(`.vrm-sale-row[data-tx="${tx}"]`);
      const bt = l && l.querySelector(`[data-fu-imprimer="${tx}"]`);
      return { ligne: !!l, email: !!(l && l.querySelector('[data-vente-email]')), bouton: bt ? bt.getAttribute('data-fu-imprimer-num') : null, sansNum: l ? (l.querySelector('[data-vente-sans-num]') || { getAttribute: () => null }).getAttribute('data-vente-sans-num') : null,
        debord: document.documentElement.scrollWidth > window.innerWidth + 1 };
    }, TX);
    dit(r.ligne && r.email && r.bouton === '' && r.sansNum === 'sans', 'B2', `${T} Ventes : la ligne « Vue par e-mail » porte Imprimer (sans N°) et la mention`, JSON.stringify(r));
    dit(!r.debord && !o.journal.erreurs.length, 'B0', `${T} Ventes : rien ne déborde, aucune erreur`, o.journal.erreurs.join(' ¦ '));
    await o.pg.locator(`.vrm-sale-row[data-tx="${TX}"]`).first().scrollIntoViewIfNeeded().catch(() => {});
    await attendre(300); await capture(o.pg, `bde-ventes-B-${W}`);
    await ferme(o); }
  { const o = await ouvrirSur(nav, { W, variante: 'B', tab: 'journee' });
    await o.pg.waitForSelector('[data-tuile="envoyer"]', { timeout: 30000, state: 'attached' }).catch(() => {});
    await attendre(3000);
    const n = await o.pg.evaluate(() => { const e = document.querySelector('[data-tuile="envoyer"]'); return e ? e.getAttribute('data-n') : null; });
    dit(n === '2', 'B3', `${T} Ma journée : 2 colis à envoyer (62000 + la vente vue par e-mail)`, String(n));
    dit(!o.journal.erreurs.length, 'B0', `${T} Ma journée : aucune erreur`, o.journal.erreurs.join(' ¦ '));
    await capture(o.pg, `bde-journee-B-${W}`);
    await ferme(o); }
  // N · N° écrit dans le titre de l'annonce (lu dans l'e-mail du bordereau)
  { const o = await ouvrirSur(nav, { W, variante: 'N', tab: 'cat_bord' });
    await ongletEnvoyer(o.pg);
    const r = await lireColis(o.pg);
    dit(!!r.carte && r.carte.num === '12' && !r.carte.sansNum, 'N1', `${T} Colis : le N° écrit dans le titre (« n12 ») est tamponné`, JSON.stringify(r.carte));
    await capture(o.pg, `bde-colis-N-${W}`);
    await ferme(o); }
  // A · la liste relue dit la vente annulée
  { const o = await ouvrirSur(nav, { W, variante: 'A', tab: 'cat_bord' });
    await ongletEnvoyer(o.pg);
    const r = await lireColis(o.pg);
    dit(!r.carte && !r.cartes.includes('v:' + TX), 'A1', `${T} Colis : vente annulée ⇒ aucune carte, rien à imprimer pour elle`, JSON.stringify(r.cartes));
    dit(!!r.prets && r.prets.aImprimer === 1 && r.prets.total === 1, 'A1', `${T} Colis publie 1 à imprimer (62000 seule)`, JSON.stringify(r.prets));
    await ferme(o); }
}

(async () => {
  await new Promise((ok) => NV.srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const W of LARGEURS) await un(nav, W).catch((e) => dit(false, 'B0', `[${W}] au bout`, String(e && e.message).slice(0, 300)));
  } catch (e) { dit(false, 'B0', 'le banc a pu aller au bout', String(e && e.stack).slice(0, 400)); }
  await nav.close(); NV.srv.close();
  console.log('\n── Rouges par mesure');
  for (const [k, v] of Object.entries(compte).sort()) console.log(`   ${k} : ${v.ko} rouge(s), ${v.ok} vert(s)`);
  console.log(ko ? `\n❌ bordereau-des-email : ${ko} défaut(s)` : '\n✅ bordereau-des-email : rien à signaler');
  process.exit(ko ? 1 : 0);
})();
