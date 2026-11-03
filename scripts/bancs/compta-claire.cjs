// Banc « Comptabilité claire » (2 novembre).
//
// Julien : « il y a beaucoup d'incompréhension de ma part quand je vais dans […]
// SURTOUT comptabilité. Je veux que vraiment tout soit parfaitement amélioré
// pour que ce soit le plus simple possible pour les utilisateurs. »
//
// L'écran répond à TROIS questions, dans l'ordre : 1. Combien j'ai gagné ?
// 2. Combien je dois déclarer ? 3. Le détail (replié). Le banc juge la RÈGLE
// d'écran sur des données INVENTÉES (dépôt public : rien de réel) —
// ventes Vinted finalisées et en cours, une Leboncoin, une Vestiaire, des
// dépenses, un abonnement, des prix d'achat partiels — à 390 px tactile en
// clair et 1512 px en sombre :
//   Q. les trois questions, dans cet ordre (data-compta-question) ;
//   C. sous chaque réponse : un chiffre (data-compta-chiffre) PUIS une phrase
//      (data-compta-phrase) qui le suit, non vide ;
//   R. « Le détail » replié : chaque repli fermé tant qu'on ne l'ouvre pas ;
//   U. chaque montant en euros visible écrit UNE fois sur l'écran (§7) ;
//   M. les règles de calcul n'ont pas bougé (data-* : bénéfice, URSSAF du mois,
//      dépenses du mois — les mêmes valeurs que le code d'avant) ;
//   P. prix d'achat partiels ⇒ « — », le manque NOMMÉ (« pour N vente(s) sur
//      M ») et le geste « Compléter les prix d'achat » visible (§5) ;
//   G. les gestes : « Ajouter une dépense » ouvre « Tes dépenses » ET son
//      formulaire ; « dater dans « Vendu et reçu » » ouvre ce repli ;
//   J. aucun jargon à l'écran tant que rien n'est ouvert (« CA », « brut »,
//      « Finalisé », « encaissé », « n/d ») ;
//   D. aucun débordement (page et éléments) ; cibles ≥ 44 px au doigt ;
//      aucune erreur JavaScript ni console.
//
// Lancer : node <construire> && node scripts/bancs/compta-claire.cjs
//   (BANC_PORT pour changer de port ; SHOTS=dossier pour les captures)

require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9327;
const MAINTENANT = '2026-10-27T10:00:00+01:00';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'atelier_test', domain: 'www.vinted.fr', updated_at: '2026-10-27T08:00:00Z' }];
// [tx, titre, prix, vendue le, versée le (null = en cours)]
const VENTES = [
  [9301, 'Nike Air Max inventée taille 42', 100, '2026-09-10T12:00:00+02:00', '2026-09-15T08:00:00+02:00'],
  [9302, 'Salomon XT-6 inventée taille 40', 80, '2026-09-12T12:00:00+02:00', '2026-09-20T08:00:00+02:00'],
  [9303, 'Adidas Samba inventée taille 41', 120, '2026-09-25T12:00:00+02:00', '2026-09-29T08:00:00+02:00'],
  [9304, 'Asics Gel inventée taille 43', 60, '2026-10-05T12:00:00+02:00', '2026-10-10T08:00:00+02:00'],
  [9305, 'New Balance 550 inventée taille 44', 75, '2026-10-24T12:00:00+02:00', null],
];
// Une vente Leboncoin SANS date de vente (elle attend d'être datée : le renvoi « dater dans… »).
const LBC = { L1: { txId: 'L1', itemId: '701', isSeller: true, price: 5000, stepLabel: 'Paiement effectué', title: 'Puma inventée' } };
const VC = { V1: { productId: 'P90', ref: '90', aExpedier: false, etat: 'shipped', date: '2026-10-18T10:00:00.000Z', prix: 85 } };
// La ligne publiée par Ventes (la même forme que `vinted_urssaf_mois`).
const LIGNE = { at: Date.parse('2026-10-27T07:00:00Z'), mois: [{ ym: '2026-10', ca: 60, n: 1, par: { Vinted: { n: 1, ca: 60 } } }, { ym: '2026-09', ca: 300, n: 3, par: { Vinted: { n: 3, ca: 300 } } }], aDater: { n: 0, ca: 0, par: {} }, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu', Vestiaire: 'lu' } };
const ROWS_BASE = [
  { id: 'harvest_111_orders_sold', data: { capturedAt: '2026-10-27T07:30:00Z', payload: { my_orders: VENTES.map(([tx, t, p, d, v]) => ({ transaction_id: tx, title: t, price: { amount: String(p), currency_code: 'EUR' }, status: v ? 'Commande finalisée' : 'Le paiement a été validé', date: d })) } } },
  ...VENTES.filter((x) => x[4]).map(([tx, , , , v]) => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: '2026-10-27T07:30:00Z', payload: { transaction: { id: tx, item_id: tx + 500000, status: 450, status_title: 'Commande finalisée', status_updated_at: v } } } })),
  { id: 'ebay_orders', data: { orders: [] } },
];
// `complet` : Vinted seul (les chiffres sont ceux de compta-simple, jugés sur le code d'avant) ;
// `partiel` : + une vente Leboncoin pas datée et une vente Vestiaire.
const rows = (complets) => complets
  ? [...ROWS_BASE, { id: 'lbc_ventes', data: { ventes: {} } }]
  : [...ROWS_BASE, { id: 'lbc_ventes', data: { ventes: LBC } }, { id: 'vc_ventes', data: { ventes: VC } }, { id: 'vc_listings', data: { liens: {} } }];
// Prix d'achat : `complets` ⇒ les quatre finalisées ; sinon une seule (partiels).
const main = (sombre, complets) => ({
  vinted_dark: sombre, vinted_regime: 'micro', vinted_urssaf_taux: 12.4, vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: LIGNE,
  vinted_sale_overrides: complets ? { 9301: { buyPrice: '40' }, 9302: { buyPrice: '30' }, 9303: { buyPrice: '50' }, 9304: { buyPrice: '30' } } : { 9301: { buyPrice: '40' } },
  vrm_compta: { depenses: [{ id: 'd1', date: '2026-10-03', libelle: 'cartons', cat: 'Emballage', montant: 12.5 }, { id: 'd2', date: '2026-08-14', libelle: 'scotch', cat: 'Emballage', montant: 4.2 }], abonnements: [{ id: 'a1', libelle: 'VRM', montant: 12.99, periode: 'mois', debut: '2026-09-01', fin: '' }], fixes: [], packs: [] },
  vrm_urssaf_declare: { '2026-09': { ids: ['vinted:9301', 'vinted:9302', 'vinted:9303'], n: 3, ca: 300, montant: 300, regle: 'versement', at: Date.parse('2026-10-12T09:00:00Z') } },
  vrm_micro_options: { liberatoire: 'non', acre: false, at: Date.parse('2026-10-20T09:00:00Z') },
});

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
srv.on('error', (e) => { console.log(e.code === 'EADDRINUSE' ? `KO le port ${PORT} est pris — relance-le seul (BANC_PORT=…)` : `KO serveur : ${e.message}`); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => { if (!sel || sel === '*') return row; const out = {}; for (const part of sel.split(',')) { const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue; const src = m[2], alias = m[1] || src.split(/->>|->/).pop(); if (src === 'id') { out[alias] = row.id; continue; } if (src === 'data') { out[alias] = row.data; continue; } let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg]; if (/->>/.test(src) && v != null && typeof v !== 'object') v = String(v); out[alias] = v == null ? null : v; } return out; };

let ko = 0, ok = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log('✅ ' + msg); } else { ko++; console.log('❌ ' + msg); } };
const essaie = async (msg, fn) => { try { await fn(); } catch (e) { ko++; console.log(`❌ ${msg} — ${String(e.message || e).split('\n').filter((l) => /intercept|Timeout|waiting|not/.test(l)).slice(0, 4).join(' | ').slice(0, 400)}`); } };

async function page(b, vp, sombre, complets, errs) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'Europe/Paris', ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errs.push('page : ' + e.message));
  // Les ressources coupées exprès (polices, images externes) ne sont pas des erreurs de l'app.
  pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_/i.test(m.text())) errs.push('console : ' + m.text()); });
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  let m = main(sombre, complets);
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      try { const corps = JSON.parse(route.request().postData() || 'null'); for (const x of [].concat(corps || [])) if (x && x.id === 'main' && x.data && typeof x.data === 'object') m = x.data; } catch (_) {}
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    if (/select=owner&limit=1/.test(u)) return j([{ owner: 'x' }]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: '2026-10-27T08:00:00Z', cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([forme({ id: 'main', data: m })]);
    if (eq) return j(rows(complets).filter((r) => r.id === eq[1]).map(forme));
    const dans = /id=in\.\(([^)]*)\)/.exec(u);
    if (dans) { const ids = dans[1].split(','); return j(rows(complets).filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows(complets).filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, tel };
}
const ouvrir = (pg, tab) => pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
const attr = (pg, sel, a) => pg.evaluate(([sel, a]) => { const e = document.querySelector(sel); return e ? e.getAttribute(a) : null; }, [sel, a]);
const avant = (pg, a, b) => pg.evaluate(([a, b]) => { const x = document.querySelector(a), y = document.querySelector(b); return !!(x && y && (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING)); }, [a, b]);
const visible = (pg, sel) => pg.evaluate((sel) => { const e = document.querySelector(sel); return !!(e && e.checkVisibility && e.checkVisibility()); }, sel);

// Le texte VISIBLE de l'écran Comptabilité (replis fermés exclus par le navigateur).
const texteEcran = (pg) => pg.evaluate(() => { const e = document.querySelector('.vrm-finance-page'); return e ? e.innerText : ''; });
const MONTANT = /-?\d{1,3}(?:[\u202f\u00a0 ]\d{3})*,\d{2}\s?€/g;

async function preparer(pg) {
  // Ventes publie le bénéfice (`vrm_benefice_jours`) : on attend l'ÉTAT, pas un délai.
  await ouvrir(pg, 'cat_ventes');
  await pg.waitForFunction(() => !!localStorage.getItem('vrm_benefice_jours'), null, { timeout: 90000 });
  await ouvrir(pg, 'compta');
  // (2 nov., 22 h) Les intitulés des questions et la carte URSSAF du mois ne s'affichent plus
  // (maquette FusionCompta) : on attend qu'ils soient DANS la page, pas visibles.
  await pg.locator('[data-compta-question="detail"]').first().waitFor({ state: 'attached', timeout: 40000 });
  await pg.locator('[data-benef-etat="lu"]').first().waitFor({ timeout: 40000 });
  await pg.locator('[data-compta-chiffre="urssaf-mois"]').first().waitFor({ state: 'attached', timeout: 40000 });
  await pg.locator('[data-urssaf-declaree]').first().waitFor({ state: 'attached', timeout: 40000 });
  await pg.waitForTimeout(900);
}

async function captures(pg, vp, sombre, etiquette) {
  if (!process.env.SHOTS) return;
  for (let i = 0; i < 8; i++) {
    await pg.screenshot({ path: path.join(process.env.SHOTS, `compta-claire-${etiquette}-${vp.width}${sombre ? '-sombre' : ''}-${i}.png`) }).catch(() => {});
    const fin = await pg.evaluate((h) => { const els = [document.scrollingElement, ...document.querySelectorAll('main, .vrm-main')].filter((e) => e && e.scrollHeight > e.clientHeight + 4); const e = els.find((x) => getComputedStyle(x).overflowY !== 'visible' || x === document.scrollingElement); if (!e) return true; const a = e.scrollTop; e.scrollTop += h * 0.85; return e.scrollTop === a; }, vp.height);
    if (fin) break;
    await pg.waitForTimeout(250);
  }
  await pg.evaluate(() => { for (const e of [document.scrollingElement, ...document.querySelectorAll('main, .vrm-main')]) if (e) e.scrollTop = 0; });
}

async function regleEcran(pg, nom, tel, errs) {
  // ── Q. trois questions, dans l'ordre
  const qs = await pg.evaluate(() => [...document.querySelectorAll('[data-compta-question]')].map((e) => e.getAttribute('data-compta-question')));
  check(JSON.stringify(qs) === JSON.stringify(['gagne', 'declarer', 'detail']), `${nom} — Q les trois questions, dans l'ordre : ${JSON.stringify(qs)}`);
  // Les intitulés « 1 · Combien j'ai gagné ? »… ne s'affichent plus — retiré à la demande de Julien, 2 nov. 22 h (maquette FusionCompta).
  for (const q of ['gagne', 'declarer', 'detail']) check(!(await visible(pg, `[data-compta-question="${q}"]`)), `${nom} — Q l'intitulé « ${q} » n'est plus affiché (retiré à la demande de Julien, 2 nov. 22 h (maquette FusionCompta))`);
  check(await visible(pg, '[data-compta-q="gagne"] [data-fu-carte]'), `${nom} — Q la carte sombre « Ce que tu as gagné » est là`);
  // ── C. un chiffre, puis sa ligne (la carte URSSAF du mois n'est plus affichée — retiré à la demande de Julien, 2 nov. 22 h (maquette FusionCompta))
  for (const c of ['gagne']) {
    const r = await pg.evaluate((c) => { const n = document.querySelector(`[data-compta-chiffre="${c}"]`), p = document.querySelector(`[data-compta-phrase="${c}"]`); return { n: !!n, p: !!p, suit: !!(n && p && (n.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING)), txt: p ? p.innerText.trim() : '', vis: !!(n && n.checkVisibility() && p && p.checkVisibility()) }; }, c);
    // (3 nov.) « Aucune vente finalisée ce mois-ci » n'est plus écrit sous la carte (retiré à la demande de Julien, 3 nov.) :
    // un mois sans vente finalisée n'a pas de ligne ; sinon, un chiffre puis sa ligne, comme avant.
    const n0 = await pg.evaluate(() => (document.querySelector('[data-benef-n]') || {}).getAttribute?.('data-benef-n'));
    check((r.n && r.p && r.suit && r.vis && r.txt.length > 0) || (r.n && !r.p && n0 === '0'), `${nom} — C « ${c} » : un chiffre puis une ligne courte dessous (« ${r.txt.slice(0, 90)} »)`);
  }
  // (« la prochaine déclaration avant ce qu'il faut mettre de côté » : la carte n'est plus affichée — retiré à la demande de Julien, 2 nov. 22 h (maquette FusionCompta))
  // ── R. le détail replié
  const replis = await pg.evaluate(() => [...document.querySelectorAll('[data-compta-q="detail"] details')].filter((d) => d.parentElement && d.parentElement.classList.contains('vrm-compta-replis')).map((d) => ({ id: d.id || d.getAttribute('data-micro-repli'), open: d.open })));
  check(replis.length >= 4 && replis.every((d) => !d.open), `${nom} — R « Le détail » : ${replis.length} replis, tous fermés : ${JSON.stringify(replis)}`);
  for (const sel of ['[data-ca-cur="vendu"]', '[data-compta-kpi="mois"]', '[data-suivi-urssaf]', '[data-compta-resultat]']) {
    check((await pg.locator(sel).count()) > 0 && !(await visible(pg, sel)), `${nom} — R ${sel} est dans le DOM (rien de supprimé) mais replié`);
  }
  // ── U. chaque montant une fois
  const t = await texteEcran(pg);
  const montants = (t.match(MONTANT) || []).map((x) => x.replace(/[\u202f\u00a0 ]/g, ' ').replace(/\s?€/, ' €'));
  const doubles = [...new Set(montants.filter((x, i) => montants.indexOf(x) !== i))];
  // (2 nov., 22 h : l'écran a moins de montants depuis la maquette FusionCompta — au moins 2.)
  check(montants.length >= 2 && doubles.length === 0, `${nom} — U chaque montant visible écrit une fois (${montants.length} montants${doubles.length ? ', redits : ' + doubles.join(' · ') : ''})`);
  // ── J. aucun jargon visible
  const jargon = [...(t.match(/\bCA\b|Finalisé(?!e)|\bn\/d\b/g) || []), ...(t.replace(/bénéfice brut/gi, '').match(/\bbrut\b|encaiss/gi) || [])]; // (3 nov.) « Bénéfice brut » est le NOM d'une notion (src/beneficeNoms.js, bénéfice unique) : permis ; « brut » seul reste du jargon
  check(jargon.length === 0, `${nom} — J aucun jargon visible : ${JSON.stringify(jargon)}`);
  // ── D. débordement
  const deb = await pg.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const page = document.documentElement.scrollWidth > innerWidth + 1;
    const sortis = [...document.querySelectorAll('.vrm-finance-page *')].filter((e) => {
      if (!e.checkVisibility || !e.checkVisibility()) return false;
      for (let p = e.parentElement; p; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') { if (p.classList.contains('vrm-finance-page')) break; return false; } }
      const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 1 || r.left < -1);
    }).slice(0, 4).map((e) => (e.className || e.tagName) + ':' + (e.innerText || '').slice(0, 30));
    return { page, sortis };
  });
  check(!deb.page && deb.sortis.length === 0, `${nom} — D aucun débordement : ${JSON.stringify(deb)}`);
  if (tel) {
    const petits = await pg.evaluate(() => [...document.querySelectorAll('.vrm-finance-page :is(button, summary, a[href], [role="button"])')].filter((e) => {
      if (!e.checkVisibility || !e.checkVisibility()) return false;
      if (getComputedStyle(e).display === 'inline') return false;          // un lien DANS une phrase : la phrase est la cible
      const r = e.getBoundingClientRect(); return r.height < 43.5;
    }).map((e) => `${(e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 28)} (${Math.round(e.getBoundingClientRect().height)} px)`));
    check(petits.length === 0, `${nom} — D cibles ≥ 44 px au doigt : ${JSON.stringify(petits)}`);
  }
  check(!errs.length, `${nom} — D aucune erreur JavaScript ni console${errs.length ? ' : ' + errs[0].slice(0, 200) : ''}`);
}

async function scenarioComplet(b, vp, sombre) {
  const nom = `complet ${vp.width}${sombre ? ' sombre' : ' clair'}`;
  const errs = [];
  const { ctx, pg, tel } = await page(b, vp, sombre, true, errs);
  await essaie(`${nom} — l'écran se rend`, () => preparer(pg));
  await captures(pg, vp, sombre, 'complet');
  await essaie(nom, async () => {
    check(!/n'a pas pu s'afficher|Cannot access|is not defined/.test(await texteEcran(pg)), `${nom} — aucun écran tombé sur le garde-fou`);
    await regleEcran(pg, nom, tel, errs);
    // ── M. les chiffres n'ont pas bougé (mêmes valeurs que compta-simple sur le code d'avant)
    check((await attr(pg, '[data-benef-net]', 'data-benef-net')) === '-2.93', `${nom} — M bénéfice net −2,93 € : ${await attr(pg, '[data-benef-net]', 'data-benef-net')}`);
    check((await attr(pg, '[data-compta-chiffre="gagne"]', 'data-eur')) === '-2.93', `${nom} — M le chiffre de la question 1 est ce net`);
    check((await attr(pg, '[data-compta-chiffre="urssaf-mois"]', 'data-eur')) === '7.44', `${nom} — M URSSAF d'octobre 7,44 € (12,4 % de 60 €)`);
    check((await attr(pg, '[data-compta-kpi="mois"]', 'data-eur')) === '25.49', `${nom} — M dépenses du mois 25,49 €`);
    check((await attr(pg, '[data-compta-kpi="annee"]', 'data-eur')) === '42.68', `${nom} — M dépenses de l'année 42,68 € (12,50 + 4,20 + 2 × 12,99) : ${await attr(pg, '[data-compta-kpi="annee"]', 'data-eur')}`);
    check((await attr(pg, '[data-echeance-suivante]', 'data-echeance-suivante')) === 'octobre 2026', `${nom} — M la prochaine déclaration nommée est octobre 2026`);
    // (la phrase de la carte URSSAF du mois n'est plus affichée — retiré à la demande de Julien, 2 nov. 22 h (maquette FusionCompta) ; son chiffre reste vérifié ci-dessus)
    // ── G. « Ajouter une dépense » ouvre le repli et le formulaire
    // (« Ajouter une dépense » n'est plus sur la carte du bénéfice — retiré à la demande de Julien, 2 nov. 22 h (maquette FusionCompta) : il est dans « Tes dépenses ».)
    await pg.locator('#compta-charges > summary').first().click();
    await pg.locator('[data-dep-ouvrir]').first().click();
    await pg.waitForFunction(() => { const d = document.getElementById('compta-charges'); const f = document.querySelector('[data-dep-form]'); return !!(d && d.open && f && f.checkVisibility()); }, null, { timeout: 5000 }).catch(() => {});
    check(await pg.evaluate(() => { const d = document.getElementById('compta-charges'); return !!(d && d.open); }) && await visible(pg, '[data-dep-libelle]'), `${nom} — G « Ajouter une dépense » ouvre « Tes dépenses » et son formulaire`);
    check(!errs.length, `${nom} — aucune erreur après les gestes${errs.length ? ' : ' + errs[0].slice(0, 160) : ''}`);
  });
  await ctx.close();
}

async function scenarioPartiel(b, vp, sombre) {
  const nom = `partiel ${vp.width}${sombre ? ' sombre' : ' clair'}`;
  const errs = [];
  const { ctx, pg, tel } = await page(b, vp, sombre, false, errs);
  await essaie(`${nom} — l'écran se rend`, () => preparer(pg));
  await captures(pg, vp, sombre, 'partiel');
  await essaie(nom, async () => {
    await regleEcran(pg, nom, tel, errs);
    // ── P. le manque nommé, et la porte
    check((await attr(pg, '[data-benef-raison]', 'data-benef-raison')) === 'achats', `${nom} — P prix d'achat partiels : le net ne se calcule pas (raison « achats »)`);
    check((await pg.evaluate(() => (document.querySelector('[data-compta-chiffre="gagne"]') || {}).innerText)) === '—', `${nom} — P le chiffre dit « — », jamais un faux total`);
    const ph = (await pg.evaluate(() => (document.querySelector('[data-compta-phrase="gagne"]') || {}).innerText || ''));
    const n = await attr(pg, '[data-benef-n]', 'data-benef-n'), nc = await attr(pg, '[data-benef-ncout]', 'data-benef-ncout');
    const manque = Number(n) - Number(nc);
    check(manque > 0 && new RegExp(`${manque} prix d'achat à saisir`).test(ph), `${nom} — P la ligne nomme le manque, du même nombre (${manque} sur ${n}) : « ${ph.slice(0, 160)} »`);
    check(await visible(pg, '[data-benef-porte]'), `${nom} — P le manque est la porte vers la saisie (« N prix d'achat à saisir »)`);
    // ── G. « dater dans « Vendu et reçu » » ouvre ce repli
    // (Le renvoi « dater dans Vendu et reçu » vivait dans la carte URSSAF du mois, qui n'est plus
    // affichée — retiré à la demande de Julien, 2 nov. 22 h. « Vendu et reçu » s'ouvre de lui-même.)
    await pg.locator('#compta-ca > summary').first().click();
    await pg.waitForFunction(() => { const d = document.getElementById('compta-ca'); return !!(d && d.open); }, null, { timeout: 5000 }).catch(() => {});
    check(await visible(pg, '[data-ca-cur="vendu"]'), `${nom} — G « Vendu et reçu » s'ouvre d'un toucher (la vente Leboncoin s'y date)`);
    check(!errs.length, `${nom} — aucune erreur après le geste${errs.length ? ' : ' + errs[0].slice(0, 160) : ''}`);
  });
  await ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const TEL = { width: 390, height: 844 }, ORDI = { width: 1512, height: 950 };
  try {
    await scenarioComplet(b, TEL, false);
    await scenarioComplet(b, ORDI, true);
    await scenarioPartiel(b, TEL, false);
    await scenarioPartiel(b, ORDI, true);
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
