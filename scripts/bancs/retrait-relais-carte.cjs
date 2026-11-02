// ── BANC : COLIS → « À RETIRER », PAR POINT RELAIS ET SUR UNE CARTE (31 oct.)
// Julien : « une carte avec les colis à aller chercher par point relais, et des
// prévisions ». Données INVENTÉES, à la forme des lignes réelles :
//   · un colis d'e-mail Vinted Go à Kusmi Tea (lieu sans code postal, comme la
//     version texte mesurée) et un colis vu dans la conversation, même consigne ;
//   · un achat EN ROUTE dont le suivi Vinted (`harvest_111_suivi_9500`, champs de
//     l'extension 5.295 lus en `meta`) donne la destination Kusmi Tea et une
//     arrivée ESTIMÉE ; un autre dont la destination n'a pas de rue ; un dernier
//     sans destination du tout.
//   · la Base Adresse Nationale (servie par le banc) ne connaît que la rue de Kusmi Tea.
// Exige : UN point Kusmi Tea (2 arrivés, 1 attendu, « arrivée estimée »), un
// point sans repère dit comme tel, l'achat sans destination compté à part, le
// repère cherché avec le code postal, et aucun écart à 390 px ni 1512 px.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4393);

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const dans = (j) => new Date(MAINTENANT + j * 86400000).toISOString().slice(0, 10);
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const ROUTE_ST = 'Le vendeur a expédié la commande';
const ACHATS = [
  { transaction_id: 9401, conversation_id: 7101, title: 'Adidas Samba noire taille 40', price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(3) },
  { transaction_id: 9500, conversation_id: 7200, title: 'Nike Dunk Low panda taille 42', price: { amount: '60', currency_code: 'EUR' }, status: ROUTE_ST, transaction_user_status: 'waiting', date: ilYa(2) },
  { transaction_id: 9501, conversation_id: 7201, title: 'Salomon XT-6 noire taille 43', price: { amount: '80', currency_code: 'EUR' }, status: ROUTE_ST, transaction_user_status: 'waiting', date: ilYa(2) },
  { transaction_id: 9502, conversation_id: 7202, title: 'New Balance 550 taille 41', price: { amount: '45', currency_code: 'EUR' }, status: ROUTE_ST, transaction_user_status: 'waiting', date: ilYa(1) },
];
const RELAIS = { '9401': { code: 'B11111', lieu: 'Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes, France', at: new Date(MAINTENANT).toISOString(), url: 'https://www.vinted.fr/inbox/7101' } };
const suivi = (tx, lieu) => ({ id: `harvest_111_suivi_${tx}`, data: Object.assign({ v: 1, tx: String(tx), source: 'journey', capturedAt: ilYa(0.5), transporteur: 'vinted', suivi: null, etapes: [{ t: 'Commande expédiée', at: ilYa(1), code: 'shipped' }], dernier: { t: 'Commande expédiée', at: ilYa(1), code: 'shipped' }, n: 1, forme: {} }, lieu) });
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const ROWS = [
  { id: 'main', data: {} },
  { id: 'panel_colis_relais', data: RELAIS },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
  { id: 'email_track_vinted_1790000000000001', data: { type: 'suivi', carrier: 'vinted', suivi: '1790000000000001', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(1), code: 'A22222', lieu: '*Consigne Vinted Go*, * Kusmi Tea *, * 13 Rue Saint-Vincent', limite: dans(4), consigne: true } },
  suivi(9500, { relaisNom: 'Kusmi Tea', relaisRue: '13 Rue Saint-Vincent', relaisCp: '56000', relaisVille: 'Vannes', arriveeEstimee: dans(2) }),
  suivi(9501, { relaisNom: 'Tabac Inconnu', relaisRue: null, relaisCp: '29200', relaisVille: 'Brest', arriveeEstimee: null }),
  suivi(9502, {}),
];

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
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function preparer(b, vp) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ban = [];
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) {
      ban.push(u);
      const sur = /Saint-Vincent/i.test(decodeURIComponent(u));
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: sur ? [{ geometry: { coordinates: [-2.7581, 47.6582] }, properties: { score: 0.93, type: 'housenumber', postcode: '56000', label: '13 Rue Saint-Vincent 56000 Vannes' } }] : [] }) });
    }
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
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ban };
}

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px';
      // (1er nov.) L'ANCIEN ÉCRAN « À RETIRER » D'ACHATS N'EXISTE PLUS (Julien : « l'onglet
      // Colis à retirer sert à rien si dans Colis on a les codes de retrait »). Son lien
      // (`cat_achats`, notifications) mène à Colis : la colonne « À retirer » porte les
      // points relais ET leur carte (jugés plus bas, essai « Colis »), le détail dessous
      // porte les codes et les blocs « Va à ». La carte n'est dessinée qu'UNE fois (§7).
      await essaie(T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-colis-retraits="ouvert"]').first().waitFor({ timeout: 20000 });
        await pg.locator('[data-cc-colonne="retirer"] [data-relais-point]').first().waitFor({ timeout: 25000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const r = await pg.evaluate(() => { const d = document.querySelector('[data-colis-retraits="ouvert"]');
          return { col: document.querySelectorAll('[data-cc-colonne="retirer"] [data-relais-point]').length, cartesDetail: d ? d.querySelectorAll('[data-relais-carte]').length : -1,
            blocs: d ? d.querySelectorAll('.vrm-pickup-point').length : 0, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
        dit(r.col >= 2, `${T} l'ancien lien mène à Colis : la colonne « À retirer » liste les points relais`, JSON.stringify(r));
        dit(r.cartesDetail === 0, `${T} la carte n'est pas redessinée dans le détail (une carte, celle de la colonne)`, JSON.stringify(r));
        dit(r.blocs >= 1, `${T} les blocs « Va à » (codes) sont dans le détail, sous les colonnes`, JSON.stringify(r));
        dit(r.sw <= r.cw + 1, `${T} aucun débordement`, JSON.stringify(r));
        dit(!errs.length, `${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
      // ── (1er nov.) LA COLONNE « À RETIRER » DE COLIS, PAR POINT ──────────────
      // Les mêmes données : le point Kusmi Tea (2 colis + l'achat en route) placé
      // par la Base Adresse Nationale (une recherche, avec le code postal), le
      // point « Tabac Inconnu » (achat en route, sans rue) listé avec la raison,
      // l'achat sans destination dit à part. Numéro du point = numéro de l'épingle ;
      // un clic sur l'épingle fait défiler jusqu'au point.
      await essaie(T + ' Colis', async () => {
        const { ctx, pg, errs, ban } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-cc-colonne="retirer"] [data-relais-point]').first().waitFor({ timeout: 25000 });
        await pg.waitForSelector('[data-cc-colonne="retirer"] [data-relais-point="kusmitea|56000"][data-relais-repere="oui"]', { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const pts = await pg.evaluate(() => [...document.querySelectorAll('[data-cc-colonne="retirer"] [data-relais-point]')].map((e) => ({ cle: e.getAttribute('data-relais-point'), n: e.getAttribute('data-relais-numero'), c: e.getAttribute('data-relais-point-comptes'), t: e.getAttribute('data-relais-point-attendus'), rp: e.getAttribute('data-relais-repere'), raison: (e.querySelector('[data-relais-sans-repere]') || { getAttribute: () => null }).getAttribute('data-raison'), past: (e.querySelector('[data-relais-pastille]') || {}).textContent || null, txt: e.innerText })));
        const k = pts.find((p) => p.cle === 'kusmitea|56000');
        dit(!!k && k.c === '2' && k.t === '1' && k.rp === 'oui' && k.n === '1', `${T} Colis : Kusmi Tea, point n° 1, 2 colis + 1 en route, placé sur la carte`, JSON.stringify(pts.map((p) => [p.cle, p.n, p.c, p.t, p.rp])));
        const ti = pts.find((p) => p.cle === 'tabacinconnu|29200');
        dit(!!ti && ti.rp === 'non' && ti.raison === 'adresse' && /Pas sur la carte : .{10,}/.test(ti.txt) && /date d’arrivée pas encore dite/.test(ti.txt), `${T} Colis : le point sans rue est listé, la raison dite`, ti && ti.txt.slice(0, 220));
        const miens = ban.filter((u) => /[?&]postcode=/.test(u));
        dit(miens.length === 1 && /postcode=56000/.test(miens[0]) && !ban.some((u) => /Brest|29200/.test(decodeURIComponent(u))), `${T} Colis : une seule recherche d'adresse, avec le code postal ; aucune pour l'adresse incomplète`, JSON.stringify(ban));
        const note = await pg.evaluate(() => (document.querySelector('[data-retirer-en-route-sans]') || {}).innerText || '');
        dit(/1 achat en route dont Vinted ne dit pas encore le point/.test(note), `${T} Colis : l'achat sans destination est dit à part`, note);
        const tot = await pg.evaluate(() => { const c = document.querySelector('[data-cc-colonne="retirer"]'); let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) {} return { n: Number(c.getAttribute('data-cc-n')), pub: pub && pub.total }; });
        dit(tot.n === 2 && tot.pub === 2, `${T} Colis : le compteur « À retirer » = Ma journée (2)`, JSON.stringify(tot));
        const ep = await pg.evaluate(() => [...document.querySelectorAll('[data-relais-epingle]')].map((e) => [e.getAttribute('data-relais-epingle'), e.getAttribute('data-relais-numero'), e.textContent]));
        if (ep.length) {
          dit(ep.length === 1 && ep[0][0] === 'kusmitea|56000' && ep[0][2] === '2' && k && k.past === '2', `${T} Colis : l'épingle porte le NOMBRE de colis à retirer (2), le même que la pastille du point`, JSON.stringify(ep));
          await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
          await pg.evaluate(() => document.querySelector('[data-relais-epingle]').click());
          await pg.waitForTimeout(900);
          const choisi = await pg.evaluate(() => !!document.querySelector('[data-relais-point="kusmitea|56000"].is-choisi'));
          dit(choisi, `${T} Colis : un clic sur l'épingle désigne le point dans la liste`, String(choisi));
        } else console.log(`INFO ${T} Colis : pas d'épingle dessinée ici (navigateur du banc sans WebGL) — la liste porte le contrôle`);
        if (process.env.SHOTS) {
          await pg.evaluate(() => { const c = document.querySelector('[data-cc-colonne="retirer"]'); if (c) c.scrollIntoView({ block: 'start' }); });
          await pg.waitForTimeout(300);
          await pg.screenshot({ path: path.join(process.env.SHOTS, `retrait-relais-colis-${vp.width}.png`), fullPage: false });
        }
        dit(!errs.length, `${T} Colis : aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ carte des points relais : ${ko} rouge(s).` : `\n✅ carte des points relais : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
