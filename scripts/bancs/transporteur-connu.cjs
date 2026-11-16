// ════════════════════════════════════════════════════════════════════════════
//  BANC « TRANSPORTEUR CONNU » — VENTES · À EXPÉDIER (15 nov.)
//  Julien (capture iPhone, 23 h : « Tous 3 · Colissimo 1 colis · Transporteur inconnu 2 colis ») :
//  « Le transporteur inconnu n'est pas possible. »
//  Données INVENTÉES (dépôt public), la FORME mesurée sur sa base : deux comptes ; une vente au
//  bordereau e-mail dont le n° a la forme Mondial Relay ; une dont le PDF e-mail nomme Colissimo
//  (`transporteurPdf`) ; une SANS e-mail dont l'étiquette a été CAPTÉE par l'extension
//  (`harvest_{uid}_label_{tx}`, PDF) et LUE au cron (`vrm_bord_transporteurs.pdf[tx] = { t, s }`) ;
//  une sans rien (détail de transaction seul : `shipment` = id + statut 230, aucun transporteur).
//  Horloge figée (5 nov. 11 h). 390 tactile et 1512, clair. Jugé sur data-* et nombres rendus.
//   T  les tuiles : « Tous 4 · Chronopost 1 · Colissimo 1 · Mondial Relay 1 » — aucune tuile
//      « Transporteur inconnu » ; la tuile Chronopost filtre la liste sur SA vente (par identité) ;
//   C  la carte de la vente sans e-mail porte le logo Chronopost (la même règle que la tuile) ;
//   L  le reste en UNE ligne discrète : « 1 colis : transporteur pas encore lu — ouvre vinted.fr
//      sur compte_b » (raison + compte rendus en data-*) ;
//   X  « Transporteur inconnu » n'est écrit nulle part à l'écran ; aucune erreur ; rien ne déborde.
//  Rouge sur l'arbre d'avant (la tuile « Transporteur inconnu 2 », la carte Chronopost et la tuile
//  qui se contredisent). Lancer : construire dist/, puis node scripts/bancs/transporteur-connu.cjs
//  (BANC_PORT 9073, SHOTS=dossier, BANC_SEUL=390c,1512c).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 9073);
const SHOTS = process.env.SHOTS || '';
const SEUL = process.env.BANC_SEUL ? process.env.BANC_SEUL.split(',') : null;
const maintenant = new Date(2026, 10, 5, 11, 0, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(MS) },
];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
// tx, compte, titre, N°, âge, la source du transporteur
const V = [
  { tx: 9401, uid: '111', titre: 'Air Max 90 blanche 42', num: '41', age: 1, email: { suivi: '41234567' } },                                   // forme du n° ⇒ Mondial Relay
  { tx: 9402, uid: '111', titre: 'Samba noire 40', num: '42', age: 2, email: { suivi: '', transporteurPdf: 'colissimo', suiviPdf: '6A12345678901', pdfLu: 'ok' } },   // PDF e-mail ⇒ Colissimo
  { tx: 9403, uid: '222', titre: 'Handball Spezial bleue 43', num: '43', age: 0.2, capte: true },                                               // étiquette captée, LUE ⇒ Chronopost
  { tx: 9404, uid: '222', titre: 'Gel 1130 argent 41', num: '44', age: 2.5 },                                                                    // rien encore
];
const lignes = () => [
  { id: 'main', data: { vinted_used_numeros: V.map((v) => Number(v.num)),
    vinted_annonce_numeros: Object.fromEntries(V.map((v) => [`i${v.tx}`, { numero: v.num, title: v.titre, auto: false, numberedAt: ilYa(30) }])) } },
  ...['111', '222'].map((uid) => ({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: iso(MS - 600e3), payload: { my_orders: V.filter((v) => v.uid === uid).map((v) => ({
    transaction_id: v.tx, title: v.titre, price: { amount: '50.0', currency_code: 'EUR' }, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: ilYa(v.age) })) } } })),
  ...['111', '222'].map((uid) => ({ id: `harvest_${uid}_orders_purchased`, data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [] } } })),
  // Le détail de transaction, forme mesurée : `shipment` = id + statut, AUCUN transporteur.
  ...V.map((v) => ({ id: `harvest_${v.uid}_txn_${v.tx}`, data: { capturedAt: ilYa(0.1), payload: { transaction: { id: v.tx, item_id: `i${v.tx}`, status: 230, status_title: 'Le paiement a été validé',
    shipment: { id: 51000000000 + v.tx, status: 230, status_title: 'Bordereau envoyé au vendeur', status_updated_at: ilYa(0.1) }, order: { package_size: { code: 'SMALL' }, custom_shipment: false } } } } })),
  ...V.filter((v) => v.email).map((v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: v.uid, filename: `bordereau-${v.tx}.pdf`, modele: v.titre, article: v.titre,
    receivedAt: ilYa(Math.max(0.1, v.age - 0.5)), pdfB64: PDF_B64, ...v.email } })),
  ...V.filter((v) => v.capte).map((v) => ({ id: `harvest_${v.uid}_label_${v.tx}`, data: { uid: v.uid, tx: String(v.tx), item: `i${v.tx}`, url: 'https://exemple.invalid/label', capturedAt: ilYa(0.1), pdfB64: PDF_B64 } })),
  { id: 'vrm_bord_transporteurs', data: { v: 1, at: ilYa(0.05), parTx: {}, pdf: { 9403: { t: 'chronopost', s: 'XW987654321TS' } }, pdfVus: {} } },
  { id: 'panel_colis_relais', data: {} },
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = iso(MS); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};

async function ouvrir(b, vp) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, colorScheme: 'light', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const LIGNES = lignes();
  const mainData = LIGNES[0].data;
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ m, imprime }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.setItem('vinted_dark', JSON.stringify(false));
      if (!sessionStorage.getItem('banc_init')) {
        sessionStorage.setItem('banc_init', '1');
        localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros));
        localStorage.setItem('vinted_bords_printed', JSON.stringify(imprime));
      }
    } catch (_) {}
  }, { m: mainData, imprime: { 9403: MS - 3600e3 } });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const h = { 'access-control-allow-origin': '*' };
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(MS), cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z]+)=(not\.)?is\.null/g)].map((m) => ({ k: m[1], non: !!m[2] }));
    const passe = (r) => filtres.every((f) => (f.non ? r.data[f.k] != null : r.data[f.k] == null));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card][data-tx-colis]').length >= 4, null, { timeout: 30000 }).catch(() => {});
  // Les tuiles se posent quand les bordereaux, l'étiquette captée et la relecture sont lus.
  await pg.waitForFunction(() => !!document.querySelector('[data-envoyer-filtre-choix="Chronopost"], [data-envoyer-filtre-choix="Transporteur inconnu"]'), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs, tel };
}
const shot = async (pg, nom, plein = false) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein }); };

async function scenario(b, vp) {
  const nom = `${vp.width}`;
  const { ctx, pg, errs } = await ouvrir(b, vp);
  try {
    await pg.click('[data-colis-onglet-choix="envoyer"]').catch(() => {});
    await pg.waitForTimeout(500);
    await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
    await shot(pg, `transporteur-connu-${nom}`);
    const lu = await pg.evaluate(() => {
      const tuiles = [...document.querySelectorAll('[data-envoyer-filtre-choix]')].map((t) => ({ v: t.getAttribute('data-envoyer-filtre-choix'), cle: t.getAttribute('data-envoyer-filtre-cle'), n: Number(t.getAttribute('data-envoyer-filtre-n')) }));
      const carte = (tx) => { const c = document.querySelector(`[data-bord-card][data-tx-colis="${tx}"]`); if (!c) return null; const l = c.querySelector('[data-colis-logo-transp]');
        return { logo: l ? l.getAttribute('data-colis-logo-transp') : null, aria: l ? l.getAttribute('aria-label') : null, transp: c.getAttribute('data-transporteur') }; };
      const ligne = document.querySelector('[data-envoyer-pas-lus]');
      const raisons = ligne ? [...ligne.querySelectorAll('[data-pas-lu-raison]')].map((s) => ({ cle: s.getAttribute('data-pas-lu-raison'), n: Number(s.getAttribute('data-pas-lu-n')), comptes: s.getAttribute('data-pas-lu-comptes'), texte: s.textContent })) : null;
      const deborde = document.documentElement.scrollWidth > window.innerWidth + 1;
      return { tuiles, c3: carte('9403'), c4: carte('9404'), c1: carte('9401'), c2: carte('9402'), n: ligne ? Number(ligne.getAttribute('data-envoyer-pas-lus')) : 0, raisons,
        ecrit: /Transporteur inconnu/i.test(document.body.innerText), deborde };
    });
    const T = `[${nom}]`;
    const tu = lu.tuiles.filter((t) => t.v !== 'tous' && t.v !== 'avant-demain' && t.v !== '__avantDemain');
    const tous = lu.tuiles.find((t) => t.v === 'tous');
    dit(tous && tous.n === 4, `${T} T. tuile « Tous 4 »`, JSON.stringify(tous));
    const noms = tu.map((t) => `${t.v}:${t.n}`).sort().join('|');
    dit(noms === 'Chronopost:1|Colissimo:1|Mondial Relay:1', `${T} T. tuiles « Chronopost 1 · Colissimo 1 · Mondial Relay 1 »`, noms);
    dit(!lu.tuiles.some((t) => t.v === 'Transporteur inconnu' || t.cle === 'inconnu'), `${T} T. aucune tuile « Transporteur inconnu »`, JSON.stringify(lu.tuiles));
    dit(lu.c3 && lu.c3.logo === 'chronopost', `${T} C. la vente sans e-mail (étiquette captée, lue) porte le logo Chronopost`, JSON.stringify(lu.c3));
    dit(lu.c1 && lu.c1.logo === 'mondialrelay' && lu.c2 && lu.c2.logo === 'colissimo', `${T} C. Mondial Relay (forme du n°) et Colissimo (PDF e-mail) sur leurs cartes`, JSON.stringify([lu.c1, lu.c2]));
    dit(lu.n === 1 && lu.raisons && lu.raisons.length === 1 && lu.raisons[0].cle === 'pas-encore-lu' && lu.raisons[0].comptes === 'compte_b', `${T} L. une ligne discrète : 1 colis « pas encore lu », compte à ouvrir : compte_b`, JSON.stringify(lu.raisons));
    dit(lu.raisons && lu.raisons[0] && /vinted\.fr/.test(lu.raisons[0].texte) && /compte_b/.test(lu.raisons[0].texte), `${T} L. la ligne dit le geste (vinted.fr, le compte)`, lu.raisons && lu.raisons[0] && lu.raisons[0].texte);
    dit(lu.c4 && lu.c4.logo === 'inconnu' && !/inconnu/i.test(lu.c4.aria || ''), `${T} C. la vente sans source : pictogramme neutre, « pas encore lu » en libellé (jamais « inconnu »)`, JSON.stringify(lu.c4));
    dit(!lu.ecrit, `${T} X. « Transporteur inconnu » n'est écrit nulle part à l'écran`);
    dit(!lu.deborde, `${T} X. rien ne déborde en largeur`);
    // La tuile Chronopost filtre la liste sur SA vente (par identité, le n° de transaction).
    // (16 nov., intégration vague B) Ventes « Verre dépoli » : les tuiles-filtres vivent derrière « … » de la tête
    // (`data-colis-barre-btn="outils"`, maquette validée) — on l'ouvre d'abord, comme lui.
    if (!(await pg.locator('[data-envoyer-filtre-choix="Chronopost"]').first().isVisible().catch(() => false))) {
      await pg.locator('[data-colis-barre-btn="outils"]').first().click().catch(() => {}); await pg.waitForTimeout(500);
    }
    await pg.click('[data-envoyer-filtre-choix="Chronopost"]', { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(600);
    const filtre = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].filter((c) => c.offsetParent).map((c) => c.getAttribute('data-tx-colis')));
    dit(filtre.join(',') === '9403', `${T} T. la tuile Chronopost ne garde que la vente 9403`, filtre.join(','));
    await shot(pg, `transporteur-connu-${nom}-chronopost`);
    dit(!errs.length, `${T} X. aucune erreur de page`, errs.slice(0, 2).join(' | '));
  } finally { await ctx.close(); }
}

(async () => {
  let b;
  try {
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    await new Promise((r) => srv.listen(PORT, r));
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      if (SEUL && !SEUL.includes(`${vp.width}c`)) continue;
      await scenario(b, vp);
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ transporteur-connu : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ transporteur-connu : ${ok} verts`);
    process.exit(ko ? 1 : 0);
  }
})();
