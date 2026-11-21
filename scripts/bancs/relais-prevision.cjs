require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  ACHATS · À RETIRER, REFAIT (21 nov., ext. 5.411) — l'app RENDUE, téléphone d'abord. Récit :
//  docs/passation/2026-11-21-relais-prevision.md. Julien (captures iPhone du 21 nov.) : « c'est dégueulasse sur téléphone »,
//  « je veux prévoir : les colis à aller chercher pour chaque point relais ».
//  Base INVENTÉE (`design-passe.cjs`, 3 comptes, ~40 achats en route sans point) + :
//    · RELAIS DU MARCHE (Rennes) : 1 colis à retirer (e-mail, code 601234, relié à SON achat par le n° de suivi), et 2 achats
//      EN ROUTE vers lui (le point lu par l'extension 5.411 sur la ligne de suivi de CETTE transaction) — l'un « prévu demain »
//      (date lue), l'autre avec la période écrite par Vinted ;
//    · TABAC DE LA GARE (Dinan) : 1 colis à retirer (code 711111, pas relié) ;
//    · KIOSQUE TEST (Vannes) : rien à retirer, 1 achat en route sans date ⇒ « Bientôt » ;
//    · 50 achats au MÊME titre que les achats en route, finis : aucune ressemblance ne les range sous un point (§5).
//  Ce que le banc juge (data-*, jamais un libellé) :
//    L  une liste groupée PAR POINT : en tête nom, adresse, nombre, « Itinéraire » ; dessous chaque colis (code en grand,
//       toucher ⇒ plein écran pour le guichet) ;
//    E  « En route vers ce point » sous LEUR point (identité : la ligne de suivi de la transaction), date lue / « selon
//       Vinted » / « pas encore dite » ; « Bientôt » pour le point où rien n'attend ; les achats sans point UNE rangée repliée ;
//       chaque achat en route compté UNE fois (sous un point ou sans point), aucun perdu ;
//    X  ce qui est RETIRÉ de l'écran : « Mode relais », « Suivi vérifié », la ligne « 1 avec code · 3 à vérifier »,
//       la liste « EN ROUTE 20 · POINT PAS ENCORE DIT », « Je lis tes colis… » une fois lu, les grands logos Leboncoin /
//       eBay / Vestiaire vides et « Achats Vestiaire : pas encore lus », les trois ronds et le menu de compte de l'en-tête ;
//    G  aucun geste perdu : Ajouter un achat, Retrouver un colis, Arrivée d'un colis et le choix du compte sont dans la
//       feuille « ⋯ » de l'en-tête ; cibles ≥ 44, rien ne déborde ;
//    A  la liste des achats en rangées fines (vignette, titre complet, phrase grise, prix) ;
//    J  Aujourd'hui : « Demain : 1 colis chez RELAIS DU MARCHE … » (date LUE seulement).
//  `SHOTS=dossier` garde les captures (regarde-les). `BANC_DIST=<dist d'avant>` : la preuve sur l'ancien code (rouge attendu).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-relais-prevision');
fs.mkdirSync(SHOTS, { recursive: true });
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 700) : '')); } return c; };

const J = 86400000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();
const jourParis = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const ROUTE = 'Colis en cours d\'acheminement';
// Les achats EN ROUTE posés par le banc : [tx, titre, point (null = pas lu), estimee, periode]
const MARCHE = { nom: 'RELAIS DU MARCHE', rue: '12 RUE DES LILAS', cp: '35000', ville: 'RENNES' };
const KIOSQUE = { nom: 'KIOSQUE TEST', rue: '24 RUE EXEMPLE', cp: '56000', ville: 'VANNES' };
const EN_ROUTE = [
  [99300001, 'Nike Air Max 90 blanche taille 42', MARCHE, jourParis(Date.now() + J), null],
  [99300002, 'Adidas Samba OG noire taille 40', MARCHE, null, 'entre le 24 et le 26 nov.'],
  [99300003, 'New Balance 550 verte taille 41', KIOSQUE, null, null],
  [99300004, 'Asics Gel-Kayano 14 argent taille 43', null, null, null],
];
function baseRP({ sansRoute = false } = {}) {
  const b = base();
  const uid = b.accounts[0].vinted_user_id;
  const achats = (b.rows.find((r) => r.id === `harvest_${uid}_orders_purchased`) || {}).data;
  const my = achats.payload.my_orders;
  // Colis À RETIRER (e-mails du transporteur), l'un relié à SON achat par le n° de suivi.
  b.rows.push({ id: 'email_track_chronopost_XW700000001TS', data: { type: 'suivi', carrier: 'chronopost', suivi: 'XW700000001TS', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis XW700000001TS est disponible',
    receivedAt: iso(-5 * 3600000), emailAt: iso(-5 * 3600000), arriveLe: iso(-5 * 3600000), code: '601234', code2: null, artTitle: null, lieu: 'RELAIS DU MARCHE, 12 RUE DES LILAS, 35000 RENNES', limite: jourParis(Date.now() + 4 * J), consigne: false, account: '' } });
  my.unshift({ transaction_id: 99100001, conversation_id: 99100001, title: 'Nike Dunk Low Panda taille 44', price: { amount: '64.0', currency_code: 'EUR' },
    status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", date: iso(-3 * J), photo: { url: 'https://images1.vinted.net/t/r99100001/f800/p.jpeg' }, transaction_user_status: 'needs_action' });
  b.rows.push({ id: `harvest_${uid}_suivi_99100001`, data: { n: 1, v: 1, tx: '99100001', suivi: 'XW700000001TS', source: 'journey', capturedAt: iso(-60000), transporteur: 'chronopost',
    etapes: [{ t: 'Disponible pour retrait', at: iso(-5 * 3600000), code: 'available_for_pickup' }], dernier: { t: 'Disponible pour retrait', at: iso(-5 * 3600000), code: 'available_for_pickup' } } });
  b.rows.push({ id: 'email_track_mondialrelay_87100011', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '87100011', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis 87100011 est disponible',
    receivedAt: iso(-8 * 3600000), emailAt: iso(-8 * 3600000), arriveLe: iso(-8 * 3600000), code: '711111', code2: null, artTitle: 'Paire 011', lieu: 'TABAC DE LA GARE, 3 RUE EXEMPLE, 22100 DINAN', limite: jourParis(Date.now() + 6 * J), consigne: false, account: '' } });
  if (!sansRoute) for (const [tx, titre, pt, est, per] of EN_ROUTE) {
    my.unshift({ transaction_id: tx, conversation_id: tx, title: titre, price: { amount: '48.0', currency_code: 'EUR' }, status: ROUTE, date: iso(-2 * J), photo: { url: `https://images1.vinted.net/t/r${tx}/f800/p.jpeg` }, transaction_user_status: 'waiting' });
    b.rows.push({ id: `harvest_${uid}_suivi_${tx}`, data: { n: 1, v: 1, tx: String(tx), suivi: null, source: 'journey', capturedAt: iso(-60000), transporteur: 'mondialrelay',
      etapes: [{ t: 'Colis en transit', at: iso(-J), code: 'in_transit' }], dernier: { t: 'Colis en transit', at: iso(-J), code: 'in_transit' },
      ...(pt ? { relaisNom: pt.nom, relaisRue: pt.rue, relaisCp: pt.cp, relaisVille: pt.ville, lieuLuAt: iso(-60000) } : {}), ...(est ? { arriveeEstimee: est } : {}), ...(per ? { arriveePeriode: per } : {}) } });
  }
  // 50 achats au MÊME titre que les achats en route, finis : jamais rangés sous un point (identité seulement).
  for (let k = 0; k < 50; k++) my.push({ transaction_id: 99400001 + k, conversation_id: 99400001 + k, title: EN_ROUTE[k % 4][1], price: { amount: '48.0', currency_code: 'EUR' },
    status: 'Commande finalisée', date: iso(-30 * J), photo: { url: `https://images1.vinted.net/t/leurre${k}/f800/p.jpeg` }, transaction_user_status: 'completed' });
  // Leboncoin, eBay, Vestiaire reliés mais sans achat lu : rien ne doit s'afficher pour eux (décision du 20 nov.).
  b.main[0].data.vrm_plateformes_affichees = { sites: ['vinted', 'leboncoin', 'ebay', 'vestiaire'], at: '2026-11-01T10:00:00.000Z' };
  return b;
}

async function allumer(pg) {
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); } catch (_) {} });
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('.vrm-main', { timeout: 30000 }).catch(() => {});
}
async function releve(pg) {
  return pg.evaluate(() => {
    const q = (s, r = document) => [...r.querySelectorAll(s)];
    const vis = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden]'); };
    const main = document.querySelector('[data-tache="achats"]') || document;
    const points = q('[data-rp-point]', main).filter(vis).map((c) => ({ nom: ((c.querySelector('.n-rp-nom') || {}).textContent || '').trim(), n: Number(c.getAttribute('data-rp-n')), att: Number(c.getAttribute('data-rp-attendus')),
      adresse: ((c.querySelector('[data-rp-adresse]') || {}).textContent || '').trim(), itin: !!c.querySelector('[data-rp-itineraire]'), codes: q('[data-rp-code-grand]', c).map((e) => e.textContent.trim()),
      routes: q('[data-rp-route]', c).map((e) => ({ id: e.getAttribute('data-rp-route'), quand: e.getAttribute('data-rp-route-quand') })), bientot: !!c.closest('[data-rp-bientot-liste]') }));
    const sansPoint = document.querySelector('[data-rp-sans-point]');
    const txt = (main.innerText || '');
    const tete = document.querySelector('[data-tache-tete="achats"]');
    const ronds = tete ? q('button', tete).filter(vis).length : 0;
    const petits = q('.n-rp button, .n-rp a, .n-rp [role="button"], [data-tache-tete="achats"] button, [data-ach-plus]').filter(vis).filter((e) => { const b = e.getBoundingClientRect(); return b.height < 43.5 || b.width < 43.5; }).map((e) => (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 24) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
    const W = innerWidth;
    const deborde = q('[data-tache="achats"] *').filter(vis).filter((e) => { const b = e.getBoundingClientRect(); return b.right > W + 1 || b.left < -1; }).map((e) => String(e.className).slice(0, 40)).slice(0, 5);
    return { points, sansPoint: sansPoint ? { n: Number(sansPoint.getAttribute('data-rp-sans-point')), ids: q('[data-rp-route]', sansPoint).map((e) => e.getAttribute('data-rp-route')) } : null,
      modeRelais: q('[data-cc-relais]').filter(vis).length, suiviVerifie: q('[data-retirer-verifie]').filter(vis).length, resumeColis: q('[data-colis-resume="achats"]').filter(vis).length,
      enRouteAncien: q('[data-v2-en-route], .v2-en-route').filter(vis).length, lecture: q('[data-retraits-lecture]').filter(vis).length, jeLis: /Je lis tes colis/.test(txt),
      logosSites: q('.vrm-achats-site-titre').filter(vis).length, vcPasLus: /pas encore lus/i.test(txt), menuCompte: q('[data-v2-menu="achats"]').filter(vis).length,
      ronds, plus: q('[data-ach-plus]').filter(vis).length, petits, deborde,
      achats: q('[data-ach-rangee]').filter(vis).length, achatsVides: q('[data-ach-rangee] .n-vide-case, [data-ach-case-vide]').filter(vis).length };
  });
}
async function attendre(pg, f, ms = 40000) { const t0 = Date.now(); let r; while (Date.now() - t0 < ms) { r = await releve(pg); if (f(r)) return r; await pg.waitForTimeout(800); } return r; }

async function cas(nav, { W, sombre }) {
  const th = `${W} ${sombre ? 'sombre' : 'clair'}`;
  const b = baseRP();
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre, b, url: '/?tab=achats' });
  await allumer(pg);
  const r = await attendre(pg, (x) => x.points.length >= 3 && x.points.some((p) => p.routes.length >= 2) && !!x.sansPoint);
  await pg.waitForTimeout(1200);
  Object.assign(r, await releve(pg));
  await pg.screenshot({ path: path.join(SHOTS, `achats-${th.replace(' ', '-')}-haut.png`) });
  await pg.screenshot({ path: path.join(SHOTS, `achats-${th.replace(' ', '-')}-page.png`), fullPage: true }).catch(() => {});
  const marche = r.points.find((p) => /MARCHE/i.test(p.nom)), tabac = r.points.find((p) => /TABAC/i.test(p.nom)), kiosque = r.points.find((p) => /KIOSQUE/i.test(p.nom));
  // L — la liste par point
  dit(!!marche && !!tabac && marche.codes.includes('601234') && tabac.codes.includes('711111'), `L ${th} : un groupe par point, chaque code dans SON point`, r.points);
  dit(r.points.filter((p) => p.n > 0).every((p) => p.itin && p.adresse), `L ${th} : chaque point avec colis a son adresse et « Itinéraire »`, r.points);
  // E — la prévision
  dit(!!marche && marche.routes.length === 2 && marche.routes.some((x) => x.id === 'v:99300001' && x.quand === 'demain') && marche.routes.some((x) => x.id === 'v:99300002' && x.quand === 'vinted'),
    `E ${th} : « En route vers ce point » sous RELAIS DU MARCHE : l'un « prévu demain » (lu), l'autre « selon Vinted »`, marche);
  dit(!!kiosque && kiosque.bientot && kiosque.n === 0 && kiosque.routes.length === 1 && kiosque.routes[0].quand === 'pas-dite', `E ${th} : KIOSQUE TEST dans « Bientôt », date « pas encore dite » (jamais devinée)`, kiosque);
  const ids = [...r.points.flatMap((p) => p.routes.map((x) => x.id.replace(/^v:/, ''))), ...((r.sansPoint && r.sansPoint.ids) || [])];
  dit(new Set(ids).size === ids.length, `E ${th} : chaque achat en route une fois seulement (aucun en double)`, ids.length);
  dit(!!r.sansPoint && r.sansPoint.ids.includes('99300004') && !ids.some((x) => /^994/.test(x)), `E ${th} : l'achat sans point est dans la rangée repliée ; aucun des 50 achats au même titre n'est rangé`, r.sansPoint);
  // X — retiré
  dit(!r.modeRelais && !r.suiviVerifie && !r.resumeColis, `X ${th} : plus de « Mode relais », de « Suivi vérifié », de « 1 avec code · 3 à vérifier »`, { m: r.modeRelais, s: r.suiviVerifie, c: r.resumeColis });
  dit(!r.enRouteAncien && !r.lecture && !r.jeLis, `X ${th} : plus de liste « EN ROUTE · POINT PAS ENCORE DIT » ni de « Je lis tes colis… » une fois lu`, { e: r.enRouteAncien, l: r.lecture, j: r.jeLis });
  dit(!r.logosSites && !r.vcPasLus, `X ${th} : aucun grand logo de site vide ni « Achats Vestiaire : pas encore lus »`, { l: r.logosSites, v: r.vcPasLus });
  dit(!r.menuCompte && r.ronds <= 1 && r.plus === 1, `X ${th} : l'en-tête n'a plus qu'un rond « ⋯ » (ni +, ni loupe, ni cube, ni menu de compte)`, { menu: r.menuCompte, ronds: r.ronds, plus: r.plus });
  // G — aucun geste perdu : la feuille « ⋯ »
  const g = await pg.evaluate(async () => {
    const b = [...document.querySelectorAll('[data-ach-plus]')].find((e) => e.getBoundingClientRect().width > 0); if (!b) return { absent: true };
    b.click(); await new Promise((r) => setTimeout(r, 500));
    const f = document.querySelector('[data-ach-plus-feuille]'); if (!f) return { feuille: false };
    return { feuille: true, gestes: [...f.querySelectorAll('[data-ach-geste]')].map((e) => e.getAttribute('data-ach-geste')), compte: !!f.querySelector('[data-ach-compte]') };
  });
  await pg.screenshot({ path: path.join(SHOTS, `achats-${th.replace(' ', '-')}-feuille.png`) });
  dit(g.feuille && ['ajouter', 'retrouver', 'arrivee'].every((x) => (g.gestes || []).includes(x)) && g.compte, `G ${th} : la feuille « ⋯ » porte Ajouter un achat, Retrouver un colis, Arrivée d'un colis et le compte`, g);
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
  dit(!r.petits.length, `G ${th} : cibles ≥ 44 px`, r.petits);
  dit(!r.deborde.length, `G ${th} : rien ne déborde`, r.deborde);
  // le code au guichet : toucher ⇒ plein écran
  const plein = await pg.evaluate(async () => { const c = document.querySelector('[data-rp-point] [data-v2-en-grand]'); if (!c) return 'absent'; c.click(); await new Promise((r) => setTimeout(r, 700)); return document.querySelector('.vrm-qr-view, [data-qr-view], [data-relais-plein], [role="dialog"]') ? 'ouvert' : 'rien'; });
  dit(plein === 'ouvert', `L ${th} : toucher un code l'ouvre en plein écran (guichet)`, plein);
  await pg.screenshot({ path: path.join(SHOTS, `achats-${th.replace(' ', '-')}-guichet.png`) });
  dit(!erreurs.length, `${th} : aucune erreur de page`, erreurs);
  await ctx.close();
}

async function journee(nav, { W }) {
  const b = baseRP();
  const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: false, b, url: '/?tab=journee' });
  await allumer(pg);
  const t0 = Date.now(); let s = null;
  while (Date.now() - t0 < 40000) { s = await pg.evaluate(() => { const e = document.querySelector('[data-journee-prevision], [data-prevision-retraits]'); return e ? { att: e.getAttribute('data-journee-prevision') || e.getAttribute('data-prevision-retraits'), t: e.textContent.trim() } : null; }); if (s) break; await pg.waitForTimeout(800); }
  await pg.screenshot({ path: path.join(SHOTS, `journee-${W}.png`) });
  dit(!!s && s.att === 'demain' && /MARCHE/i.test(s.t), `J ${W} : Aujourd'hui prévoit « Demain : 1 colis chez RELAIS DU MARCHE » (date lue)`, s);
  dit(!erreurs.length, `J ${W} : aucune erreur de page`, erreurs);
  await ctx.close();
}

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  try {
    await cas(nav, { W: 390, sombre: false });
    if (!process.env.VITE) { await cas(nav, { W: 390, sombre: true }); await cas(nav, { W: 1512, sombre: false }); }
    await journee(nav, { W: 390 });
  } catch (e) { ko++; console.log('  ❌ le banc s’est arrêté : ' + String(e && e.stack || e).slice(0, 1500)); }
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} relais-prevision : ${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
