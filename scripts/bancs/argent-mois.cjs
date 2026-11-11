// ═══════════════════════════════════════════════════════════════════════════
// BANC : L'ARGENT À VENIR, COMPARER DEUX MOIS, FRAIS PAR SITE, JOURNAL DE LA
//        SEMAINE (4 novembre)       npm run build && node scripts/bancs/argent-mois.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (le dépôt est public), base servie par le banc (`app_data`
// clé-valeur, `select=` projeté, `meta->>`, `id=eq.` / `like.` / `in.`), à
// 390 px tactile et 1512 px, clair et sombre. On juge des NOMBRES (data-*, §6.4) :
//   A. Ventes → « À venir » = les ventes pas encore versées (Vinted en cours SANS
//      la vente dont la transaction est finalisée 450 — la liste la dit encore
//      « colis déposé » —, Vestiaire au versé avec SA date « paiement estimé ») ;
//      une ligne par site et compte ; aucun « (estimation) ».
//   B. Ma journée → le journal de la semaine passée EN TÊTE (titre « Semaine du
//      … », 4 cases = les ventes inventées de la semaine) ; le replier le garde
//      replié après un rechargement.
//   C. Statistiques → « Comparer » (ce mois au même point face au mois d'avant,
//      puis le même mois l'an dernier, choisi au second sélecteur — lot BL) et « Frais par site » (frais saisis + pack).
//   D. Partout : aucune erreur, aucun débordement à 390 px, cibles ≥ 44 px.
// `SHOTS=dossier` : les captures à REGARDER (§6.2).
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4593;
const SHOTS = process.env.SHOTS || '';
// Les bornes du jeu doivent suivre le même lundi que le navigateur à Paris.
// À 23 h UTC le dimanche, Paris est déjà lundi.
process.env.TZ = 'Europe/Paris';
const MAINT = new Date();
const iso = (d) => new Date(d).toISOString();
// La semaine passée (lundi → dimanche, heure de l'appareil = Paris au banc).
const lundiCourant = (() => { const d = new Date(MAINT); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; })();
const lundiPasse = new Date(lundiCourant); lundiPasse.setDate(lundiPasse.getDate() - 7);
const jourSemPassee = (k, h = 12) => { const d = new Date(lundiPasse); d.setDate(d.getDate() + k); d.setHours(h, 0, 0, 0); return d; };
// Ce mois-ci, AVANT maintenant (le banc peut tourner un 1er) ; le mois d'avant au même quantième.
const ceMoisAvant = (h) => { const d = new Date(MAINT.getFullYear(), MAINT.getMonth(), 1, 0, 30); return d.getTime() + Math.min(h * 3600e3, Math.max(0, MAINT - d - 60e3)); };
const moisAvant = (j, h = 12) => new Date(MAINT.getFullYear(), MAINT.getMonth() - 1, j, h);
const accounts = [
  { id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: iso(MAINT), created_at: iso(moisAvant(1)), owner: null },
  { id: 2, vinted_user_id: '222', login: 'paris_kicks', domain: 'www.vinted.fr', updated_at: iso(MAINT), created_at: iso(moisAvant(1)), owner: null },
];
// [compte, tx, prix, statut liste, date de vente, statut transaction, date de versement]
const VENTES = [
  ['111', '81001', 70, "Commande expédiée et en cours d'acheminement ! ", new Date(ceMoisAvant(1)), 230, null],           // à venir
  ['111', '81002', 82, 'La livraison n’a pas encore eu lieu - colis déposé en bureau de Poste ou point relais', moisAvant(2), 450, moisAvant(9)], // versée (450) : PAS à venir
  ['222', '81003', 45.5, 'Commande livrée ! ', new Date(ceMoisAvant(2)), 230, null],                                    // à venir
  ['222', '81004', 60, 'Commande finalisée', moisAvant(3), 450, moisAvant(6)],
  ['111', '81005', 38, 'Commande finalisée', jourSemPassee(1), 450, jourSemPassee(4)],
  ['222', '81006', 52, 'Commande finalisée', jourSemPassee(3), 450, jourSemPassee(5)],
];
const A_VENIR_VINTED = 70 + 45.5;
const VC_MONTANT = 203.23;
const prevuVc = new Date(MAINT.getTime() + 10 * 86400e3);
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const vente = (v) => ({ transaction_id: Number(v[1]), id: Number(v[1]), title: 'Baskets inventées ' + v[1], price: { amount: String(v[2]), currency_code: 'EUR' }, status: v[3], date: iso(v[4]) });
const rows = [];
for (const a of accounts) {
  const uid = a.vinted_user_id;
  rows.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: iso(MAINT), payload: { my_orders: VENTES.filter((v) => v[0] === uid).map(vente) } } });
  rows.push({ id: `harvest_${uid}_listings`, data: { capturedAt: iso(new Date(MAINT.getTime() - 60000)), payload: { items: [] } } });
  rows.push({ id: `harvest_${uid}_billing`, data: { capturedAt: iso(MAINT), payload: { escrow: { amount: '0.0' }, main: { amount: '12.5' } } } });
}
for (const v of VENTES) rows.push({ id: `harvest_${v[0]}_txn_${v[1]}`, data: { capturedAt: iso(MAINT), payload: { transaction: { id: Number(v[1]), item_id: Number(v[1]) + 500000, status: v[5], status_title: v[5] === 450 ? 'Commande finalisée' : 'Payée', status_updated_at: iso(v[6] || v[4]) } } } });
rows.push({ id: 'vc_ventes', data: { ventes: { 72900001: { productId: '72900001', etat: 'ACTION_NEEDED', date: iso(new Date(ceMoisAvant(3))), montant: { cle: 'sellerEarning', devise: 'EUR', valeur: VC_MONTANT }, etapesVc: { sellerPayment: 'upcoming' }, paiementEstime: `${prevuVc.getDate()} ${MOIS_FR[prevuVc.getMonth()]} ${prevuVc.getFullYear()}`, aExpedier: true, compte: '' } } } });
rows.push({ id: 'lbc_ventes', data: { ventes: {} } });
rows.push({ id: 'ebay_orders', data: { orders: [] } });
const ymL = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const SHIP = { 81005: jourSemPassee(2, 10).getTime(), 81006: jourSemPassee(4, 10).getTime(), 9999: jourSemPassee(-2, 10).getTime() };
const COMPTA = { depenses: [], abonnements: [], fixes: [], packs: [{ id: 'p1', plateforme: 'Vinted', compte: '', montant: 2.3, date: ymL(moisAvant(4)) }, { id: 'p2', plateforme: 'Leboncoin', compte: '', montant: 4.99, date: ymL(MAINT) }] };
const MAIN0 = { vinted_regime: 'micro', vrm_compta: COMPTA, vinted_ship_done: SHIP };

function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const alias = m[1] || m[2].split('->').pop().replace(/^>/, ''); const src = m[2];
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) { const reste = src.replace(/^data(->>|->)/, ''); let v = row.data; for (const seg of reste.split(/->>|->/)) v = (v == null ? null : v[seg]); out[alias] = (v == null) ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v); continue; }
    out[alias] = row[src];
  }
  return out;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.onnx': 'application/octet-stream', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

async function contexte(b, T, sombre, etat) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, timezoneId: 'Europe/Paris' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { if (!sessionStorage.getItem('banc_init')) { sessionStorage.setItem('banc_init', '1'); localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); } } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') {
      try { const corps = JSON.parse(route.request().postData() || 'null'); for (const x of [].concat(corps || [])) if (x && x.id === 'main' && x.data && typeof x.data === 'object') etat.main = x.data; } catch (_) {}
      return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    }
    if (/select=owner/.test(u)) return j([{ owner: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: etat.main }, S)]);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, S)));
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/"/g, '')); return j(rows.filter((r) => ids.includes(r.id)).map((r) => projette(r, S))); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u); if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, S))); }
    return j([]);
  });
  await pg.route('**/api/**', (r2) => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  return { ctx, pg, errs };
}
const aller = async (pg, tab, repere, ms = 1500) => {
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  if (repere) await pg.waitForFunction((r) => document.querySelector(r) || /pas pu s'afficher/.test(document.body.innerText), repere, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(ms);
};
const attrs = (pg, sel) => pg.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const o = {}; for (const a of e.getAttributeNames()) if (a.startsWith('data-')) o[a.slice(5)] = e.getAttribute(a); return o; }, sel);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const cibles = (pg, sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.innerText || '').trim().slice(0, 30), h: Math.round(r.height) }; }).filter((x) => x.h < 44), sel);
const capture = async (pg, nom, sel) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); const e = sel ? await pg.$(sel) : null; if (e) { await e.scrollIntoViewIfNeeded().catch(() => {}); await e.screenshot({ path: path.join(SHOTS, nom + '.png') }).catch(() => {}); } else await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const TAILLES = [
    { nom: '390-clair', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: false },
    { nom: '390-sombre', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sombre: true },
    { nom: '1512-clair', vp: { width: 1512, height: 950 }, sombre: false },
    { nom: '1512-sombre', vp: { width: 1512, height: 950 }, sombre: true },
  ];
  for (const T of TAILLES) {
    console.log(`── ${T.nom}`);
    const etat = { main: JSON.parse(JSON.stringify(MAIN0)) };
    const { ctx, pg, errs } = await contexte(b, T, T.sombre, etat);
    await essaie(`A ${T.nom}`, async () => {
      await aller(pg, 'cat_ventes', '[data-a-venir]', 3000);
      const V = await attrs(pg, '[data-a-venir]');
      dit(V && V['a-venir-site'] === 'Vinted' && Number(V['a-venir']) === Math.round(A_VENIR_VINTED * 100) && V['a-venir-n'] === '2', `A : Ventes · Vinted — « À venir » = ${A_VENIR_VINTED} € sur 2 ventes (la vente versée — 450, liste « colis déposé » — n'y est pas)`, JSON.stringify(V));
      await capture(pg, `A-ventes-vinted-${T.nom}`, '[data-a-venir]');
      await pg.click('[data-filtre-site] [data-site="toutes"]').catch(() => {});
      await pg.waitForFunction(() => { const e = document.querySelector('[data-a-venir]'); return e && e.getAttribute('data-a-venir-site') === 'toutes'; }, null, { timeout: 15000 }).catch(() => {});
      await pg.waitForTimeout(800);
      const A = await attrs(pg, '[data-a-venir]');
      const att = Math.round((A_VENIR_VINTED + VC_MONTANT) * 100);
      dit(A && A['a-venir-site'] === 'toutes' && Number(A['a-venir']) === att && A['a-venir-n'] === '3', `A : Ventes · Tous — « À venir » = ${att / 100} € sur 3 ventes (Vinted + Vestiaire)`, JSON.stringify(A));
      // (6 nov.) Le détail par compte est replié : le total seul, puis le détail au toucher.
      const replieAvant = await pg.evaluate(() => ({ ferme: !!document.querySelector('[data-a-venir-replier="ferme"]'), lignes: document.querySelectorAll('[data-a-venir-ligne]').length }));
      dit(replieAvant.ferme && replieAvant.lignes === 0, 'A : le détail par compte est replié (le total seul)', JSON.stringify(replieAvant));
      await pg.click('[data-a-venir-replier="ferme"]').catch(() => {});
      await pg.waitForSelector('[data-a-venir-ligne]', { timeout: 5000 }).catch(() => {});
      const lignes = await pg.evaluate(() => [...document.querySelectorAll('[data-a-venir-ligne]')].map((e) => ({ s: e.getAttribute('data-a-venir-ligne'), c: e.getAttribute('data-a-venir-compte'), eur: e.getAttribute('data-a-venir-eur'), prevu: e.getAttribute('data-a-venir-prevu') })));
      dit(lignes.length === 3 && lignes.some((l) => l.s === 'Vinted' && l.c === 'atelier_sneak' && l.eur === '7000') && lignes.some((l) => l.s === 'Vinted' && l.c === 'paris_kicks' && l.eur === '4550'), 'A : une ligne par site et par compte', JSON.stringify(lignes));
      const vc = lignes.find((l) => l.s === 'Vestiaire');
      dit(vc && vc.prevu === new Date(prevuVc.getFullYear(), prevuVc.getMonth(), prevuVc.getDate(), 12).toISOString().slice(0, 10), 'A : Vestiaire avec SA date « paiement estimé »', JSON.stringify(vc));
      dit(lignes.filter((l) => l.s === 'Vinted').every((l) => !l.prevu), 'A : aucune date inventée pour Vinted');
      const txt = await pg.evaluate(() => document.body.innerText);
      dit(!/Argent en attente \(estimation\)|≈\s*\d/.test(txt), 'A : plus d’« estimation » ni de « ≈ » sur l’argent');
      const petits = await cibles(pg, '[data-a-venir-ligne]');
      dit(!petits.length, 'A : lignes de 44 px', JSON.stringify(petits));
      dit(T.vp.width > 500 || (await deborde(pg)) <= 1, 'A : aucun débordement à 390 px');
      await capture(pg, `A-ventes-tous-${T.nom}`, '[data-a-venir]');
    });
    await essaie(`B ${T.nom}`, async () => {
      // (11 nov.) Depuis Ma journée v2 (9 nov., 60febc6f, docs/passation/2026-11-09-journee-v2.md) la carte
      // « Semaine du … » est FUSIONNÉE dans la frise de la tête sombre : « Semaine du … » se touche et montre
      // la semaine passée (même règle `journalSemaine`, même période que le bilan du lundi). Les règles
      // jugées restent : la bonne semaine, en tête, ses nombres exacts (le geste hors semaine n'y est pas),
      // « — » jamais 0. La carte repliable n'existe plus (choix de Julien) : le repli est remplacé par
      // l'aller-retour jours ⇄ semaine.
      await aller(pg, 'journee', '[data-jv2-semaine]', 3500);
      await pg.click('[data-jv2-semaine]', { timeout: 10000 });
      await pg.waitForSelector('[data-journal-semaine]', { timeout: 8000 }).catch(() => {});
      const J = await attrs(pg, '[data-journal-semaine]');
      dit(J && J['journal-semaine'] === ymL(lundiPasse), `B : le journal de la semaine du ${ymL(lundiPasse)} est en tête de Ma journée`, JSON.stringify(J));
      const ordre = await pg.evaluate(() => { const j = document.querySelector('[data-journal-semaine]'); const t = document.querySelector('.vrm-fu-tete'); return !!(j && t && t.contains(j)) && j.getBoundingClientRect().top + window.scrollY < 900; });
      dit(ordre, 'B : dans la tête sombre, en haut');
      const cases = await pg.evaluate(() => { const p = document.querySelector('[data-journal-semaine]'); if (!p) return {}; const o = Object.fromEntries([...p.querySelectorAll('[data-journal-case]')].map((e) => [e.getAttribute('data-journal-case'), e.getAttribute('data-valeur')])); const v = p.querySelector('[data-jv2-vendu]'); o.vendu = v ? v.getAttribute('data-jv2-vendu') : null; o.texte = p.innerText.replace(/\s+/g, ' '); return o; });
      const dansSem = (d) => d >= lundiPasse && d < lundiCourant;
      const vSem = VENTES.filter((v) => v[3] && dansSem(v[4]));
      const vcDate = new Date(rows.find((r) => r.id === 'vc_ventes').data.ventes[72900001].date);
      const nAtt = vSem.length + (dansSem(vcDate) ? 1 : 0), eAtt = Math.round((vSem.reduce((t, v) => t + v[2], 0) + (dansSem(vcDate) ? VC_MONTANT : 0)) * 100);
      dit(cases.ventes === String(nAtt) && cases.vendu === String(eAtt) && cases.colis === '2', `B : ${nAtt} ventes, ${eAtt / 100} €, 2 colis envoyés (le geste hors semaine n’y est pas)`, JSON.stringify(cases));
      dit(!/b[ée]n[ée]fice[^·]*\b0\s*€|\b0\s*€[^·]*b[ée]n[ée]fice/i.test(cases.texte || ''), 'B : aucun bénéfice à 0 inventé (aucun prix d’achat saisi)', cases.texte);
      const petits = await cibles(pg, '[data-jv2-semaine], [data-jv2-toucher]');
      dit(!petits.length, 'B : « Semaine du … » et les jours font 44 px', JSON.stringify(petits));
      await capture(pg, `B-journee-${T.nom}`, '.vrm-fu-tete');
      await pg.click('[data-jv2-semaine]');
      await pg.waitForTimeout(300);
      const retour = await pg.evaluate(() => ({ sem: !!document.querySelector('[data-journal-semaine]'), periode: (document.querySelector('[data-jv2-argent]') || { getAttribute: () => null }).getAttribute('data-jv2-periode') }));
      dit(!retour.sem && /^\d{4}-\d{2}-\d{2}$/.test(retour.periode || ''), 'B : « Revenir aux jours » rend un jour', JSON.stringify(retour));
      dit(T.vp.width > 500 || (await deborde(pg)) <= 1, 'B : aucun débordement à 390 px');
    });
    await essaie(`C ${T.nom}`, async () => {
      await aller(pg, 'dashboard', '[data-comparer]', 3500);
      const C = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-comparer-ligne]')].map((e) => [e.getAttribute('data-comparer-ligne'), { a: e.getAttribute('data-a'), b: e.getAttribute('data-b'), ecart: e.getAttribute('data-ecart'), pct: e.getAttribute('data-pct') }])));
      const meme = await attrs(pg, '[data-comparer]');
      // Au même point : ce mois-ci, 81001 + 81003 (et pas la Vestiaire, au montant sûr ⇒ comptée aussi) ; le mois d'avant jusqu'au même quantième.
      const auj = MAINT.getDate();
      const avantVentes = VENTES.filter((v) => v[4].getMonth() === moisAvant(1).getMonth() && v[4].getFullYear() === moisAvant(1).getFullYear() && v[4] <= new Date(MAINT.getFullYear(), MAINT.getMonth() - 1, auj, MAINT.getHours(), MAINT.getMinutes()));
      const semDansMoisA = VENTES.filter((v) => v[4].getMonth() === MAINT.getMonth() && v[4] <= MAINT);
      const nA = semDansMoisA.length + 1, nB = avantVentes.length + VENTES.filter((v) => false).length;
      dit(meme && meme['comparer-meme-point'] === '1', 'C : ce mois en cours se compare au même point', JSON.stringify(meme));
      dit(C.ventes && Number(C.ventes.a) === nA && Number(C.ventes.b) === nB, `C : ventes ${nA} face à ${nB}`, JSON.stringify(C.ventes));
      dit(C.vendu && C.vendu.ecart !== '' && C.recu && C.benefice && C.paires, 'C : cinq lignes (paires achetées comprises), l’écart du vendu écrit', JSON.stringify(C));
      // (10 nov., lot BL) Deux sélecteurs : le mois d'en face se CHOISIT (le même mois l'an dernier).
      await pg.selectOption('[data-comparer-mois="b"]', `${MAINT.getFullYear() - 1}-${String(MAINT.getMonth() + 1).padStart(2, '0')}`); await pg.waitForTimeout(400);
      const an = await attrs(pg, '[data-comparer]');
      dit(an && an.comparer === 'an' && an['comparer-b'] === `${MAINT.getFullYear() - 1}-${String(MAINT.getMonth() + 1).padStart(2, '0')}`, 'C : « Il y a un an » ⇒ le même mois l’an dernier', JSON.stringify(an));
      const L = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-comparer-ligne]')].map((e) => [e.getAttribute('data-comparer-ligne'), e.getAttribute('data-b')])));
      dit(L.ventes === '0' && L.benefice === '', 'C : l’an dernier, 0 vente ; bénéfice pas couvert ⇒ « — »', JSON.stringify(L));
      await capture(pg, `C-comparer-${T.nom}`, '[data-comparer]');
      await pg.selectOption('[data-comparer-mois="b"]', `${moisAvant(1).getFullYear()}-${String(moisAvant(1).getMonth() + 1).padStart(2, '0')}`); await pg.waitForTimeout(300);
      const F = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-frais-site]')].map((e) => [e.getAttribute('data-frais-site'), { eur: e.getAttribute('data-frais-eur'), pct: e.getAttribute('data-frais-pct'), lus: e.getAttribute('data-frais-lus') }])));
      dit(!!(await pg.$('[data-frais-sites]')) && F.Leboncoin && F.Leboncoin.eur === '499' && F.Leboncoin.pct === '', 'C : « Frais par site » : le pack Leboncoin du mois (4,99 €), pas de % sans vente', JSON.stringify(F));
      // (10 nov., lot BL) Les deux sélecteurs de mois : 44 px partout (au doigt comme à la souris).
      const petits = await cibles(pg, '[data-comparer] select, [data-comparer] button');
      dit(!petits.length, 'C : les sélecteurs de mois font 44 px', JSON.stringify(petits));
      dit(T.vp.width > 500 || (await deborde(pg)) <= 1, 'C : aucun débordement à 390 px', String(await deborde(pg)));
      await capture(pg, `C-frais-${T.nom}`, '[data-frais-sites]');
      // Le mois d'avant ENTIER : frais saisis (pack Vinted 2,30 €) sur la période « Mois » d'avant n'est pas affichée ici ;
      // la période de la page est ce mois : le pack du mois d'avant n'y est PAS.
      dit(!F.Vinted || F.Vinted.eur === '0', 'C : le pack du mois d’avant n’entre pas dans les frais de ce mois', JSON.stringify(F.Vinted));
    });
    dit(!errs.length, `D ${T.nom} : aucune erreur de page`, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} banc argent-mois : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
