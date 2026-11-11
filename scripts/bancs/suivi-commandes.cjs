// Banc : LE SUIVI DES COMMANDES EN COURS (11 nov., lot `suivi-commandes`).
// Julien : « intègre les numéros de suivi sur les commandes en cours, comme ça tu regardes leur statut
// pour voir la cohérence ; est-ce que tu regardes les infos de suivi ? ».
// Données INVENTÉES (dépôt public), formes réelles : ventes Vinted (`harvest_111_orders_sold`), leurs
// bordereaux e-mail (`email_bord_{tx}`, n° Chronopost de SA transaction), l'état de la transaction
// (`harvest_111_txn_{tx}`, lu par `meta->>`), les lignes `depart_{c}_{n°}` que range le serveur, une
// vente Vestiaire « envoyée » (n° Vinted Go), un achat en route (`harvest_111_suivi_{tx}` + `transp_`).
// Horloge figée (11 nov., 12 h). 390 tactile et 1512, clair et sombre. Jugé sur data-* (§6.4).
//  E. Ventes · Envoyés : chaque colis en cours porte SON n° (copiable), « Suivre ↗ » et le dernier statut
//     lu (source, heure) ; 9502 « En transit · Lyon · hier 18:02 » ; 9501 « noté déposé il y a 4 j,
//     Chronopost ne l'a pas pris » (ambre) ; 9503 livré il y a 5 j, Vinted pas finalisé (ambre) ;
//     VC1 « envoyée » Vestiaire, Vinted Go à Lyon ; le n° se copie d'un tap ;
//  I. 50 ventes au même titre ? Ici 9502 et 9504 au MÊME titre : seul le n° de 9502 porte « Lyon » ;
//  A. Achats : l'achat en route dit « Étiquette créée il y a 4 j » + « Écris au vendeur » (ambre) ;
//  J. Ma journée : « 3 commandes à vérifier » (2 ventes + 1 achat) ;
//  P. « pas su » (lecture des départs en 503) : aucune incohérence inventée, aucune erreur ;
//  Z. aucune erreur de page, rien ne déborde.
// Lancer : construire dist/, puis node scripts/bancs/suivi-commandes.cjs   (BANC_PORT 9071, SHOTS=dossier)
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9071);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date('2026-11-11T11:00:00Z');   // midi à Paris
const MS = maintenant.getTime(), J = 864e5, H = 36e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
// « hier 18:02 » à Paris = 17:02 UTC le 10 nov.
const HIER_1802 = Date.parse('2026-11-10T17:02:00Z');
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const TITRE = 'Nike Dunk Low Panda 42';
const V = [
  { tx: 9501, suivi: 'XW200000001TS', num: '51', status: 'Bordereau d’envoi envoyé au vendeur', tus: 'needs_action', s: 230 },
  { tx: 9502, suivi: 'XW200000002TS', num: '52', status: 'Colis en cours d’acheminement', tus: 'waiting', s: 230 },
  { tx: 9503, suivi: 'XW200000003TS', num: '53', status: 'Colis en cours d’acheminement', tus: 'waiting', s: 230 },
  { tx: 9504, suivi: 'XW200000004TS', num: '54', status: 'Colis en cours d’acheminement', tus: 'waiting', s: 230 },
];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const dep = (c, n, o) => ({ id: `depart_${c}_${n}`, data: { v: 1, sens: 'sortant', suivi: n, carrier: c, essaiRes: 'ok', essais: 0, ...o } });
const lignes = () => [
  { id: 'main', data: { vinted_used_numeros: V.map((v) => Number(v.num)), vinted_annonce_numeros: Object.fromEntries(V.map((v) => [`i${v.tx}`, { numero: v.num, title: TITRE, auto: false, numberedAt: ilYa(30) }])) } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: V.map((v) => ({ transaction_id: v.tx, title: TITRE, price: { amount: '80.0', currency_code: 'EUR' }, status: v.status, transaction_user_status: v.tus, date: ilYa(6) })) } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [{ transaction_id: 7001, title: 'Adidas Samba OG 43', price: { amount: '55.0', currency_code: 'EUR' }, status: 'Le vendeur prépare le colis', transaction_user_status: 'waiting', date: ilYa(5) }] } } },
  ...V.map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: iso(MS - H), payload: { transaction: { id: v.tx, item_id: `i${v.tx}`, status: v.s, status_updated_at: ilYa(6), shipment: { status_title: 'Colis en route' } } } } })),
  ...V.map((v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: TITRE, article: TITRE, receivedAt: ilYa(6), pdfB64: PDF_B64, suivi: v.suivi } })),
  // 9501 : noté « Colis fait » il y a 4 j (localStorage), Chronopost n'a que l'étiquette (lu il y a 2 h).
  dep('chronopost', 'XW200000001TS', { etat: 'en_route', detail: 'prepare', etatAt: ilYa(5), derAt: ilYa(5), derLib: 'Envoi en cours de préparation', lu: iso(MS - 2 * H), essai: iso(MS - 2 * H), fini: false }),
  // 9502 : pris en charge il y a 2 j, en transit à Lyon hier 18:02.
  dep('chronopost', 'XW200000002TS', { etat: 'en_route', etatAt: iso(HIER_1802), priseAt: ilYa(2), derAt: iso(HIER_1802), derLib: 'Envoi en cours d’acheminement', derLieu: 'LYON - FR - AGENCE', lu: iso(MS - 2 * H), essai: iso(MS - 2 * H), fini: true }),
  // 9503 : retiré par l'acheteur il y a 5 j ; Vinted (lu il y a 1 h) ne l'a pas finalisé.
  dep('chronopost', 'XW200000003TS', { etat: 'retire', etatAt: ilYa(5), priseAt: ilYa(7), derAt: ilYa(5), derLib: 'Livraison effectuée', derLieu: 'RENNES - FR', lu: iso(MS - 3 * H), essai: iso(MS - 3 * H), fini: true, clos: true }),
  { id: 'vc_ventes', data: { ventes: {
    VC1: { productId: '900201', ref: '601', etat: 'shipped', aExpedier: false, transporteur: 'Vinted Go', suivi: 'VGS1000000000201', date: ilYa(3), titre: 'New Balance 550 41' },
  } } },
  { id: 'vc_listings', data: { liens: {} } },
  dep('vinted', 'VGS1000000000201', { etat: 'en_route', etatAt: iso(MS - 4 * H), priseAt: ilYa(2), derAt: iso(MS - 4 * H), derLib: 'Colis en transit', derLieu: 'Plateforme, 69007 LYON, FR', lu: iso(MS - H), essai: iso(MS - H), fini: true }),
  // L'achat 7001 : son n° relevé par Vinted (SA transaction), l'étiquette créée il y a 4 j.
  { id: 'harvest_111_suivi_7001', data: { tx: '7001', suivi: 'XW300000001TS', transporteur: 'Chronopost', capturedAt: iso(MS - 2 * H), dernier: { t: 'Le vendeur a généré le bordereau', at: ilYa(4) } } },
  { id: 'transp_chronopost_XW300000001TS', data: { v: 1, suivi: 'XW300000001TS', carrier: 'chronopost', etat: 'en_route', detail: 'prepare', etatAt: ilYa(4), libelle: 'Envoi en cours de préparation', lu: iso(MS - 3 * H), essai: iso(MS - 3 * H), essaiRes: 'ok', essais: 0, source: 'serveur', fini: false } },
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
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
async function ouvrir(b, vp, { panne = false, tab = 'cat_bord', sombre = false } = {}) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  try { await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }); } catch (_) {}
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const LIGNES = lignes();
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ m, sombre, coche }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
      localStorage.setItem('vinted_dark', JSON.stringify(!!sombre));
      localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros));
      localStorage.setItem('vinted_ship_done', JSON.stringify({ 9501: coche }));
    } catch (_) {}
  }, { m: LIGNES[0].data, sombre, coche: MS - 4 * J });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const h = { 'access-control-allow-origin': '*' };
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (panne && /id=like\.depart_/.test(u)) return route.fulfill({ status: 503, contentType: 'text/html', headers: h, body: '<html>503</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(MS), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tel };
}
const onglet = async (pg, v) => {
  await pg.click(`[data-colis-onglet-choix="${v}"]`).catch(() => {});
  await pg.waitForFunction((x) => { const e = document.querySelector('[data-colis-onglet]'); return e && e.getAttribute('data-colis-onglet') === x; }, v, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(800);
};
const shot = async (pg, nom) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: true }); };
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};
const lireSuivis = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-suivi-commande]')].map((x) => [x.getAttribute('data-suivi-commande'), {
  n: x.getAttribute('data-suivi-n'), src: x.getAttribute('data-suivi-source'), inc: x.getAttribute('data-suivi-incoherence') || '',
  texte: (x.querySelector('[data-suivi-texte]') || {}).innerText || '', lu: (x.querySelector('[data-suivi-lu]') || {}).innerText || '',
  lien: (x.querySelector('[data-suivi-lien]') || { getAttribute: () => '' }).getAttribute('href') || '',
}])));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const k = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
        console.log(`── ${k}`);
        { const { ctx, pg, errs } = await ouvrir(b, vp, { sombre });
          await essaie('Ventes · Envoyés', async () => {
            await pg.waitForSelector('[data-colis-onglet-choix]', { timeout: 30000 });
            await onglet(pg, 'envoyes');
            await pg.waitForFunction(() => document.querySelectorAll('[data-suivi-commande]').length >= 4, null, { timeout: 20000 }).catch(() => {});
            await pg.waitForTimeout(1200);
            const S = await lireSuivis(pg);
            const v2 = S['p:9502'] || S['v:9502'], v1 = S['v:9501'], v3 = S['p:9503'] || S['v:9503'], vc = S['vc:VC1'], v4 = S['p:9504'] || S['v:9504'];
            dit(v2 && v2.n === 'XW200000002TS' && v2.src === 'transporteur' && v2.texte === 'En transit · Lyon · hier 18:02' && /^lu chez Chronopost il y a 2 h$/.test(v2.lu.replace(/^ — /, '')), 'E. 9502 : « En transit · Lyon · hier 18:02 — lu chez Chronopost il y a 2 h »', JSON.stringify(v2 || Object.keys(S)));
            dit(v2 && /chronopost\.fr\/tracking-no-cms\/suivi-page\?listeNumerosLT=XW200000002TS/.test(v2.lien), 'E. « Suivre ↗ » ouvre la page publique de Chronopost, n° pré-rempli', v2 && v2.lien);
            dit(v1 && v1.inc === 'pas-pris', 'E. 9501 noté déposé il y a 4 j, Chronopost n’a que l’étiquette ⇒ ambre « pas pris en charge »', JSON.stringify(v1));
            dit(v3 && v3.inc === 'livre-pas-finalise', 'E. 9503 retiré il y a 5 j, Vinted pas finalisé (lu après) ⇒ ambre', JSON.stringify(v3));
            dit(vc && vc.n === 'VGS1000000000201' && /^En transit · Lyon · aujourd’hui 08:00$/.test(vc.texte) && /Vinted Go/.test(vc.lu), 'E. Vestiaire « envoyée » : suivie chez Vinted Go (« En transit · Lyon · aujourd’hui 08:00 »)', JSON.stringify(vc));
            dit(v4 && v4.src === 'vinted' && !/Lyon/.test(v4.texte) && v4.inc === '', 'I. 9504, même titre que 9502 : pas de lecture de SON n° ⇒ seulement ce que dit Vinted, jamais « Lyon »', JSON.stringify(v4));
            const ambres = await pg.evaluate(() => document.querySelectorAll('[data-incoherence]').length);
            dit(ambres === 2, 'E. exactement deux incohérences en ambre (aucune inventée)', String(ambres));
            // Le n° se copie d'un tap.
            await pg.click('[data-suivi-copier="XW200000002TS"]');
            await pg.waitForTimeout(300);
            const copie = await pg.evaluate(() => (document.querySelector('[data-suivi-copier="XW200000002TS"] [data-suivi-copie]') || {}).getAttribute && document.querySelector('[data-suivi-copier="XW200000002TS"] [data-suivi-copie]').getAttribute('data-suivi-copie'));
            dit(copie === '1', 'E. « Copier » : le n° est copié (« Copié ✓ »)', String(copie));
            const tailles = await pg.evaluate(() => [...document.querySelectorAll('[data-suivi-copier],[data-suivi-lien]')].map((x) => Math.round(x.getBoundingClientRect().height)));
            dit(tailles.length > 0 && tailles.every((h) => h >= 44), 'E. cibles au doigt de 44 px', tailles.join(','));
            await pg.evaluate(() => { const e = document.querySelector('[data-suivi-commande="v:9501"]'); if (e) e.scrollIntoView({ block: 'center' }); });
            await shot(pg, `suivi-commandes-envoyes-${k}`);
            await sain(pg, 'Ventes · Envoyés');
          });
          dit(errs.length === 0, 'Z. aucune erreur de page (Ventes)', errs.join(' | ').slice(0, 200));
          await ctx.close(); }
        { const { ctx, pg, errs } = await ouvrir(b, vp, { sombre, tab: 'cat_achats' });
          await essaie('Achats', async () => {
            await pg.waitForSelector('[data-suivi-commande="a:7001"]', { timeout: 30000, state: 'visible' }).catch(() => {});
            await pg.waitForTimeout(800);
            const S = await lireSuivis(pg);
            const a = S['a:7001'];
            dit(a && a.n === 'XW300000001TS' && a.inc === 'pas-depose-vendeur', 'A. achat en route : son n°, et « Étiquette créée il y a 4 j » + « Écris au vendeur »', JSON.stringify(a || Object.keys(S)));
            const t = await pg.evaluate(() => { const e = document.querySelector('[data-suivi-commande="a:7001"]'); return e ? e.innerText : ''; });
            dit(/Étiquette créée il y a 4 j\. Pas encore chez Chronopost\./.test(t) && /Écris au vendeur sur Vinted\./.test(t), 'A. la phrase et le geste sont écrits', t.replace(/\n/g, ' | ').slice(0, 200));
            await pg.evaluate(() => { const e = document.querySelector('[data-suivi-commande="a:7001"]'); if (e) e.scrollIntoView({ block: 'center' }); });
            await shot(pg, `suivi-commandes-achats-${k}`);
            await sain(pg, 'Achats');
          });
          dit(errs.length === 0, 'Z. aucune erreur de page (Achats)', errs.join(' | ').slice(0, 200));
          await ctx.close(); }
        { const { ctx, pg, errs } = await ouvrir(b, vp, { sombre, tab: 'journee' });
          await essaie('Ma journée', async () => {
            await pg.waitForSelector('[data-journee-suivi-verifier]', { timeout: 30000, state: 'visible' }).catch(() => {});
            await pg.waitForTimeout(1500);
            const t = await pg.evaluate(() => { const e = document.querySelector('[data-journee-suivi-verifier]'); return e ? { n: e.getAttribute('data-n'), v: e.getAttribute('data-suivi-ventes'), a: e.getAttribute('data-suivi-achats'), t: e.innerText } : null; });
            dit(t && t.n === '3' && t.v === '2' && t.a === '1' && /3 commandes à vérifier/.test(t.t), 'J. Ma journée : « 3 commandes à vérifier » (2 ventes, 1 achat), écrit', JSON.stringify(t));
            await shot(pg, `suivi-commandes-journee-${k}`);
            await sain(pg, 'Ma journée');
          });
          dit(errs.length === 0, 'Z. aucune erreur de page (Ma journée)', errs.join(' | ').slice(0, 200));
          await ctx.close(); }
      }
      { const { ctx, pg, errs } = await ouvrir(b, vp, { panne: true });
        await essaie('pas su', async () => {
          await pg.waitForSelector('[data-colis-onglet-choix]', { timeout: 30000 });
          await onglet(pg, 'envoyes');
          await pg.waitForTimeout(2500);
          const S = await lireSuivis(pg);
          const inc = Object.values(S).map((x) => x.inc).filter(Boolean);
          const lyon = Object.values(S).some((x) => /Lyon/.test(x.texte) && x.src === 'transporteur');
          dit(inc.length === 0 && !lyon, 'P. départs illisibles : aucune incohérence, aucun statut transporteur inventé', JSON.stringify(S));
        });
        dit(errs.length === 0, 'Z. aucune erreur de page (pas su)', errs.join(' | ').slice(0, 200));
        await ctx.close(); }
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ suivi des commandes : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ suivi des commandes : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
srv.listen(PORT);
