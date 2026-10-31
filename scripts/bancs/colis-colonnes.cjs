// ── BANC : COLIS EN QUATRE COLONNES (31 oct., maquette choisie par Julien) ────
// « Prêts à imprimer » · « En attente » · « À retirer » · « Partis », côte à côte
// sur ordinateur (1512 px), empilées sur téléphone (390 px). Données INVENTÉES
// (le dépôt est public), à la forme des lignes réelles :
//   · 3 ventes à expédier AVEC leur bordereau (PDF reçu par e-mail) ⇒ prêts ;
//   · 1 vente à expédier SANS bordereau ⇒ en attente ;
//   · 1 vente à expédier cochée « postée » (`vinted_ship_done`) ⇒ partis ;
//   · 3 ventes que Vinted suit (en transit, au relais, livrée) ⇒ partis ;
//   · 1 achat au point relais (code lu en conversation) ⇒ à retirer ;
//   · 1 colis d'e-mail disponible, dernier jour demain ⇒ à retirer, en ambre ;
//   · 1 colis d'e-mail arrivé il y a 30 jours ⇒ à retirer, « à vérifier ».
// Exige : 4 colonnes dans l'ordre (côte à côte à 1512, empilées à 390), chaque
// colis dans EXACTEMENT une colonne, la bonne ; rien de perdu (somme des
// compteurs = total = nombre de colis posés) ; chaque compteur = ses cartes ;
// le bouton « Imprimer les N prêts » = le compteur des prêts, et il ouvre le
// lot d'impression ; la barre du haut (recherche, touche « / ») sur ordinateur.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 4397);
const SHOTS = process.env.SHOTS || os.tmpdir();

const M = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const ilYa = (j) => iso(M - j * 86400000);
const dans = (j) => new Date(M + j * 86400000).toISOString().slice(0, 10);
const AEXP = 'Le paiement a été validé';
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const v = (tx, titre, statut, tus, j, item) => ({ transaction_id: tx, title: titre, price: { amount: '50', currency_code: 'EUR' }, status: statut, ...(tus ? { transaction_user_status: tus } : {}), date: ilYa(j), ...(item ? { item_id: item } : {}) });
const VENTES = [
  v(7001, 'Adidas Samba OG taille 41', AEXP, 'needs_action', 0.2, 'an1'),
  v(7002, 'Nike Air Max 90 taille 42', AEXP, 'needs_action', 0.4, 'an2'),
  v(7003, 'Nike Dunk Low taille 44', AEXP, 'needs_action', 0.6, 'an3'),
  v(7004, 'New Balance 550 taille 43', AEXP, 'needs_action', 0.8, 'an4'),
  v(7005, 'Asics Gel-1130 taille 40', AEXP, 'needs_action', 2, 'an5'),
  v(7101, 'Converse Run Star taille 40', "Commande expédiée et en cours d'acheminement", 'waiting', 3, 'an6'),
  v(7102, 'Adidas Gazelle taille 42', RELAIS_ST, 'waiting', 4, 'an7'),
  v(7103, 'Asics GT-2160 taille 43', 'Le colis a été livré', 'waiting', 6, 'an8'),
];
const ACHATS = [
  { transaction_id: 9401, conversation_id: 7801, title: 'Vans Old Skool taille 41', price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(3) },
];
const NUMS = Object.fromEntries(['117', '42', '73', 'B233', '61', '64', '52', '70'].map((n, i) => ['an' + (i + 1), { numero: n, title: VENTES[i].title, price: 50 }]));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(M) }];
const ROWS = [
  { id: 'main', data: { vinted_ship_done: { 7005: M - 3600000 }, vinted_annonce_numeros: NUMS } },
  { id: 'panel_colis_relais', data: { 9401: { code: '418205', lieu: 'Locker Carrefour, 4 Rue de Paris, 35000 Rennes, France', at: iso(M), url: 'https://www.vinted.fr/inbox/7801' } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(M), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(M), payload: { my_orders: ACHATS } } },
  ...[7001, 7002, 7003].map((tx) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi: `TRK${tx}`, receivedAt: iso(M - 3 * 3600e3), pdfB64: 'JVBERi0xLjQK' } })),
  { id: 'email_track_vinted_1790000000000002', data: { type: 'suivi', carrier: 'vinted', suivi: '1790000000000002', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(4), code: '3904112', lieu: 'Relais Pressing Mermoz, 14 Avenue Mermoz, 35000 Rennes', limite: dans(1) } },
  { id: 'email_track_mondialrelay_55500001', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '55500001', status: 'available', statusLabel: 'Disponible', subject: 'Votre colis est disponible', receivedAt: ilYa(30), code: '771234', lieu: 'Tabac du Port, 2 Quai Gambetta, 35260 Cancale' } },
];
// La place attendue de chaque colis (sa clé d'identité → sa colonne).
const ATTENDU = {
  'v:7001': 'prets', 'v:7002': 'prets', 'v:7003': 'prets', 'v:7004': 'attente', 'v:7005': 'partis',
  'p:7101': 'partis', 'p:7102': 'partis', 'p:7103': 'partis',
  'r:v:9401': 'retirer', 'r:e:1790000000000002': 'retirer', 'r:e:55500001': 'retirer',
};
const ORDRE = ['prets', 'attente', 'retirer', 'partis'];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x === 'object' ? JSON.stringify(x) : x);
  }
  return out;
};

async function preparer(b, vp) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sd) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_ship_done', JSON.stringify(sd)); } catch (_) {} }, ROWS[0].data.vinted_ship_done);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"features":[]}' });
    if (/tiles\.openfreemap\.org/.test(u)) return r.abort();
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(M), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(ROWS.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}

// Ce que l'écran montre : chaque colonne (rang, place, compteur écrit) et ses cartes.
const lire = (pg) => pg.evaluate(() => {
  const racine = document.querySelector('[data-colis-colonnes]');
  const cols = [...document.querySelectorAll('[data-cc-colonne]')].map((c) => {
    const r = c.getBoundingClientRect();
    return { cle: c.getAttribute('data-cc-colonne'), n: Number(c.getAttribute('data-cc-n')), ecrit: ((c.querySelector('.vrm-cc-compte') || {}).textContent || '').trim(),
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width),
      cartes: [...c.querySelectorAll('[data-cc-carte]')].map((k) => ({ cle: k.getAttribute('data-cc-carte'), dans: k.getAttribute('data-cc-dans'), ambre: k.getAttribute('data-ambre') === '1', verif: k.getAttribute('data-a-verifier') === '1', h: Math.round(k.getBoundingClientRect().height), txt: k.innerText })) };
  });
  const bt = document.querySelector('[data-imprimer-prets]');
  return { total: racine ? Number(racine.getAttribute('data-colis-colonnes')) : null, cols,
    bouton: bt ? { n: Number(bt.getAttribute('data-imprimer-prets')), txt: bt.innerText.trim(), bg: getComputedStyle(bt).backgroundColor } : null,
    barre: !!document.querySelector('[data-barre-recherche]'), barreTxt: ((document.querySelector('[data-barre-recherche]') || {}).innerText || ''),
    sous: ((document.querySelector('[data-sous-titre]') || {}).innerText || ''),
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
});

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 1512, height: 950 }, { width: 390, height: 844 }]) {
      const T = vp.width + 'px', ordi = vp.width > 1000;
      await essaie(T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-colis-colonnes]').first().waitFor({ timeout: 25000 }).catch(() => {});
        // Attendre que les lectures se posent (ventes, bordereaux, achats, e-mails).
        for (let i = 0; i < 40; i++) { const t = await pg.evaluate(() => Number((document.querySelector('[data-colis-colonnes]') || { getAttribute: () => 0 }).getAttribute('data-colis-colonnes'))); if (t >= Object.keys(ATTENDU).length) break; await pg.waitForTimeout(500); }
        await pg.waitForTimeout(1200);
        // Les colonnes longues se replient derrière « Voir les N autres » : on ouvre tout.
        for (const btn of await pg.$$('[data-cc-plus]')) await btn.click().catch(() => {});
        const L = await lire(pg);
        dit(L.total != null, `${T} l'écran Colis porte les colonnes`, JSON.stringify(L.total));
        dit(JSON.stringify(L.cols.map((c) => c.cle)) === JSON.stringify(ORDRE), `${T} quatre colonnes, dans l'ordre de la maquette`, JSON.stringify(L.cols.map((c) => c.cle)));
        if (L.cols.length === 4) {
          const memeLigne = L.cols.every((c) => Math.abs(c.y - L.cols[0].y) <= 2) && L.cols.every((c, i) => !i || c.x > L.cols[i - 1].x);
          const empilees = L.cols.every((c, i) => !i || c.y > L.cols[i - 1].y) && L.cols.every((c) => Math.abs(c.x - L.cols[0].x) <= 2);
          dit(ordi ? memeLigne : empilees, `${T} ${ordi ? 'côte à côte sur une ligne' : 'empilées l’une sous l’autre'}`, JSON.stringify(L.cols.map((c) => [c.x, c.y, c.w])));
        }
        const toutes = L.cols.flatMap((c) => c.cartes.map((k) => ({ ...k, col: c.cle })));
        const vues = {}; for (const k of toutes) vues[k.cle] = (vues[k.cle] || 0) + 1;
        const doublons = Object.entries(vues).filter(([, n]) => n > 1);
        dit(!doublons.length, `${T} aucun colis dans deux colonnes`, JSON.stringify(doublons));
        const faux = Object.entries(ATTENDU).filter(([cle, col]) => !toutes.some((k) => k.cle === cle && k.col === col)).map(([cle, col]) => `${cle}→${col} vu dans ${(toutes.find((k) => k.cle === cle) || {}).col || 'aucune'}`);
        dit(!faux.length, `${T} chaque colis est dans SA colonne (prêt, en attente, à retirer, parti)`, JSON.stringify(faux));
        const somme = L.cols.reduce((t, c) => t + c.n, 0);
        dit(somme === L.total && L.total === toutes.length && toutes.length === Object.keys(ATTENDU).length, `${T} rien de perdu : somme des compteurs = total = cartes = colis posés (${Object.keys(ATTENDU).length})`, `somme ${somme} · total ${L.total} · cartes ${toutes.length}`);
        const faussesCompte = L.cols.filter((c) => !(String(c.n) === c.ecrit && c.n === c.cartes.length)).map((c) => `${c.cle}: écrit ${c.ecrit}, n ${c.n}, cartes ${c.cartes.length}`);
        dit(!faussesCompte.length, `${T} chaque compteur écrit = ses cartes`, JSON.stringify(faussesCompte));
        const prets = L.cols.find((c) => c.cle === 'prets');
        dit(!!L.bouton && prets && L.bouton.n === prets.n && new RegExp(`\\b${prets.n}\\b`).test(L.bouton.txt) && /prêts?/.test(L.bouton.txt), `${T} « Imprimer les N prêts » = le compteur des prêts`, JSON.stringify(L.bouton) + ' / ' + (prets && prets.n));
        const amb = toutes.find((k) => k.cle === 'r:e:1790000000000002');
        dit(!!amb && amb.ambre && /dernier jour demain/.test(amb.txt), `${T} le dernier jour de retrait est écrit en ambre`, amb && JSON.stringify(amb));
        const ver = toutes.find((k) => k.cle === 'r:e:55500001');
        dit(!!ver && ver.verif && /à vérifier/.test(ver.txt), `${T} un colis douteux reste VISIBLE, marqué « à vérifier »`, ver && JSON.stringify(ver));
        const n117 = toutes.find((k) => k.cle === 'v:7001');
        dit(!!n117 && /N°\S+/.test(n117.txt) && /Adidas Samba OG taille 41/.test(n117.txt), `${T} la carte porte le nom complet et le N° en pastille`, n117 && n117.txt);
        dit(/Rangés sur ce que tu peux faire maintenant/.test(L.sous) || !ordi, `${T} le sous-titre de la maquette`, L.sous);
        if (!ordi) { const petites = toutes.filter((k) => k.h < 44); dit(!petites.length, `${T} chaque carte se touche au doigt (44 px)`, JSON.stringify(petites.map((k) => [k.cle, k.h]))); }
        dit(L.sw <= L.cw + 1, `${T} aucun débordement horizontal`, `${L.sw} > ${L.cw}`);
        if (ordi) {
          dit(L.barre && /Tape un N°/.test(L.barreTxt) && /\//.test(L.barreTxt), `${T} la barre du haut : « Tape un N°… » avec la touche « / »`, L.barreTxt);
          dit(!!L.bouton && /rgb\(36, 66, 184\)/.test(L.bouton.bg), `${T} le bouton d'impression est cobalt`, L.bouton && L.bouton.bg);
        }
        await pg.screenshot({ path: path.join(SHOTS, `colis-colonnes-${vp.width}.png`), fullPage: false });
        if (process.env.PLEINE) await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 900; }).then(() => pg.waitForTimeout(300)).then(() => pg.screenshot({ path: path.join(SHOTS, `colis-colonnes-${vp.width}-bas.png`) })).then(() => pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; }));
        if (L.bouton) {
          await pg.click('[data-imprimer-prets]');
          await pg.waitForSelector('[data-lot][role=dialog]', { timeout: 5000 }).catch(() => {});
          const lot = await pg.evaluate(() => { const d = document.querySelector('[data-lot][role=dialog]'); return d ? Number(d.getAttribute('data-lot')) : null; });
          dit(lot === L.bouton.n, `${T} le bouton ouvre le lot d'impression des ${L.bouton.n} prêts (l'action de « Tout imprimer »)`, String(lot));
          await pg.keyboard.press('Escape').catch(() => {});
          await pg.evaluate(() => { const d = document.querySelector('[data-lot][role=dialog]'); if (d) d.click(); });
          await pg.waitForTimeout(300);
        }
        if (ordi) {
          await pg.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
          await pg.keyboard.press('/');
          await pg.waitForTimeout(500);
          const ouverte = await pg.evaluate(() => !!document.querySelector('.vrm-global-search'));
          dit(ouverte, `${T} la touche « / » ouvre la recherche`, String(ouverte));
        }
        dit(!errs.length, `${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ colis en colonnes : ${ko} rouge(s).` : `\n✅ colis en colonnes : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
