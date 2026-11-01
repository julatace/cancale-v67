// ── BANC : LA TOURNÉE DE MA JOURNÉE (1er nov.) ────────────────────────────────
//        npm run build && node scripts/bancs/tournee.cjs
// Maquettes « journee-A-tournee » / « journee-mode-tournee » : Imprimer →
// Emballer → Déposer → Retirer, en tête de Ma journée, et un mode plein écran
// avec la carte des points relais et les arrêts rangés par date limite.
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles :
//   · 3 ventes Vinted à expédier (« Le paiement a été validé », needs_action),
//     vendues il y a 6, 3 et 1 jours (limite ESTIMÉE vente + 7 j ⇒ 1, 4, 6 jours),
//     N° 117, 42, 73 posés à la main (`vinted_sale_overrides`) ;
//   · 2 bordereaux reçus (9101 : suivi 8 chiffres = Mondial Relay ; 9102 :
//     « VGS… » = Vinted Go), 9103 sans bordereau ; 9101 déjà imprimé aujourd'hui ;
//   · à retirer : Kusmi Tea à Vannes (un e-mail Vinted Go + un achat vu dans sa
//     conversation, dernier jour dans 4 j) et Tabac du Port à Cancale (un e-mail
//     Mondial Relay, dernier jour dans 2 j).
// CALCULÉ À LA MAIN :
//   Imprimer 2 (1 restant) · Emballer 3 · Déposer 3 (Mondial Relay 1, Vinted Go
//   1, transporteur pas connu 1) · Retirer 3 (Kusmi Tea 2, Tabac du Port 1).
//   Arrêts par date limite : Mondial Relay (1 j) · Tabac du Port (2 j) ·
//   Vinted Go (4 j) · Kusmi Tea (4 j) · dépôt sans transporteur (6 j).
//   Les nombres = les cases « À envoyer » / « À retirer » = `vrm_colis_aposter`
//   / `vrm_colis_retirer` publiés (§11).
// Scénario « fait » : les 3 colis marqués déposés aujourd'hui et les deux
// bordereaux imprimés ⇒ Imprimer, Emballer, Déposer cochés ; Retirer en cours.
// Scénario « rien » : ni colis à poster ni à retirer ⇒ AUCUNE carte.
// Scénarios « kusmi* » (1er nov., sa capture « Kusmi Tea · 13 Rue Saint-Vincent ·
// 4 colis — pas sur la carte : ni code postal ni ville ») : QUATRE e-mails de la
// consigne Vinted Go, à la forme rangée (« *Consigne Vinted Go*, * Kusmi Tea *,
// * 13 Rue Saint-Vincent », sans code postal ni ville), et la ligne
// `transp_vinted_{n°}` de CHAQUE n° FABRIQUÉE PAR LE VRAI CODE du serveur
// (`lireReponseVintedGo` sur la forme réelle de la réponse Vinted Go mesurée le
// 1er nov., puis `ligneApresEssai`) :
//   · « kusmi » : le suivi dit « 13 Rue Saint-Vincent, Vannes, FR » ⇒ le point est
//     complété PAR LE N° ⇒ UNE épingle « 4 » ;
//   · « kusmi-sans » : aucun suivi lu ⇒ pas d'épingle, la raison et le geste ;
//   · « kusmi-deux » : le suivi dit « 24 Rue Hoche, Vannes, FR » ⇒ deux adresses ⇒
//     pas d'épingle, c'est dit.
// Jugé sur les attributs `data-tournee-*` (§6.4), jamais sur un libellé.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 4394);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-tournee');
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const dans = (j) => new Date(MAINTENANT + j * 86400000).toISOString().slice(0, 10);
const AEXP = 'Le paiement a été validé';
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const vente = (tx, titre, joursVente) => ({ transaction_id: tx, conversation_id: tx + 1000, title: titre, price: { amount: '80.00', currency_code: 'EUR' }, status: AEXP, transaction_user_status: 'needs_action', date: ilYa(joursVente) });
const VENTES = [vente(9101, 'Nike Air Max 90 taille 42', 6), vente(9102, 'Adidas Samba OG taille 41', 3), vente(9103, 'Nike Dunk Low taille 44', 1)];
const ACHATS = [{ transaction_id: 9401, conversation_id: 7101, title: 'Adidas Gazelle taille 40', price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(3) }];
const bord = (tx, suivi) => ({ id: `email_bord_${tx}`, data: { transaction: String(tx), filename: `bordereau_${tx}.pdf`, suivi, receivedAt: ilYa(0.2), uid: '111', account: 'compte_banc', pdfB64: 'JVBERi0xLjQK' } });
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const minuitIso = (() => { const d = new Date(); d.setHours(0, 0, 30, 0); return (d.getTime() > MAINTENANT ? new Date(MAINTENANT) : d).toISOString(); })();
const OV = { '9101': { numero: '117' }, '9102': { numero: '42' }, '9103': { numero: '73' } };

// Les lignes `transp_vinted_…` des scénarios « kusmi* » : faites par le VRAI code
// du serveur sur la forme réelle de la réponse (`main` les fabrique avant tout).
let TRANSP_KUSMI = { kusmi: [], 'kusmi-deux': [] };
const SUIVIS_KUSMI = ['1790000000000011', '1790000000000012', '1790000000000013', '1790000000000014'];
async function fabriquerTranspKusmi() {
  const T = await import('file://' + path.join(__dirname, '..', '..', 'api', '_lib', 'transporteurs.js'));
  const iso = (ms) => new Date(ms).toISOString();
  const ev = (id, group, message, ms, metadata = {}) => ({ id, message, timestamp: iso(ms), metadata, banner_message: null, group_header: null, group, state: 'delivery' });
  const rep = (adresse) => JSON.stringify({ tracking_events: [
    ev(9000000011, 'ready_for_pickup', 'Le colis est prêt à être retiré en consigne', MAINTENANT - 20 * 3600000, { address: adresse, point_id: 900123 }),
    ev(9000000010, 'in_transit', 'Le colis est en chemin vers le/la consigne', MAINTENANT - 30 * 3600000),
    ev(9000000008, 'shipped', 'Le colis a été déposé en point relais', MAINTENANT - 60 * 3600000),
    ev(9000000007, 'created', "Bordereau d'envoi créé", MAINTENANT - 70 * 3600000),
  ], meta: { banner: null, expiration_time: iso(MAINTENANT + 3 * 86400000), contextual_faq: [] } });
  const fab = (adresse) => SUIVIS_KUSMI.map((su) => {
    const lu = T.lireReponseVintedGo(200, 'application/json', rep(adresse), { suivi: su });
    return { id: T.cleTransp('vinted', su), data: T.ligneApresEssai(null, lu, { carrier: 'vinted', suivi: su, source: 'serveur', statut: 200, maintenant: MAINTENANT }) };
  });
  TRANSP_KUSMI = { kusmi: fab('13 Rue Saint-Vincent, Vannes, FR'), 'kusmi-deux': fab('24 Rue Hoche, Vannes, FR') };
}

function lignes(sc) {
  const L = [
    { id: 'harvest_111_listings', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { items: [] } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: sc === 'rien' ? [] : ACHATS } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: sc === 'rien' ? [] : VENTES } } },
  ];
  if (sc === 'vannes') {
    // (1er nov., sa capture : 5 points, 3 épingles) Quatre relais à Vannes, à la
    // forme des e-mails rangés : Tabavap (TROIS colis, dont un n° de suivi écrit
    // par Mondial Relay ET par Vinted — compté une fois), Terra Cbd (11 rue
    // Hoche : deux relais dans la même rue), Phone Cash dont l'adresse est lue
    // SANS code postal (« 17 Rue Thiers, Vannes »), et Le Narval, dont la Base
    // Adresse rend DEUX endroits possibles (ambigu ⇒ pas d'épingle, raison dite).
    const tr = (carrier, suivi, lieu, j) => ({ id: `email_track_${carrier}_${suivi}`, data: { type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Disponible en Point Relais', subject: 'Votre colis est disponible', receivedAt: ilYa(1), code: String(suivi).slice(-6), lieu, limite: dans(j) } });
    L.push(tr('mondialrelay', '11110001', 'TABAVAP, 29 RUE HOCHE, 56000 VANNES', 3), tr('mondialrelay', '11110002', 'TABAVAP, 29 RUE HOCHE, 56000 VANNES', 3), tr('mondialrelay', '11110003', 'TABAVAP, 29 RUE HOCHE, 56000 VANNES', 5));
    L.push(tr('vinted', '11110003', 'TABAVAP, 29 RUE HOCHE, 56000 VANNES', 5));
    L.push(tr('chronopost', '22220001', 'TERRA CBD, 11 RUE HOCHE, 56000 VANNES', 4));
    L.push(tr('mondialrelay', '33330001', 'Phone Cash, 17 Rue Thiers, Vannes', 6));
    L.push(tr('mondialrelay', '44440001', 'LE NARVAL, 2 PLACE DU MARCHE, 56000 VANNES', 6));
    return L;
  }
  if (/^kusmi/.test(sc)) {
    for (const su of SUIVIS_KUSMI) L.push({ id: `email_track_vinted_${su}`, data: { type: 'suivi', carrier: 'vinted', suivi: su, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(1), code: 'K' + su.slice(-5), lieu: '*Consigne Vinted Go*, * Kusmi Tea *, * 13 Rue Saint-Vincent', limite: dans(3), consigne: true } });
    L.push(...(TRANSP_KUSMI[sc] || []));
    return L;
  }
  if (sc !== 'rien') {
    L.push(bord(9101, '12345678'), bord(9102, 'VGS12345678'));
    L.push({ id: 'panel_colis_relais', data: { '9401': { code: 'B11111', lieu: 'Kusmi Tea, 13 Rue Saint-Vincent, 56000 Vannes, France', at: new Date(MAINTENANT).toISOString(), url: 'https://www.vinted.fr/inbox/7101' } } });
    L.push({ id: 'email_track_vinted_1790000000000001', data: { type: 'suivi', carrier: 'vinted', suivi: '1790000000000001', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: "Ton colis t'attend", receivedAt: ilYa(1), code: 'A22222', lieu: '*Consigne Vinted Go*, * Kusmi Tea *, * 13 Rue Saint-Vincent', limite: dans(4), consigne: true } });
    L.push({ id: 'email_track_mondialrelay_87654321', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '87654321', status: 'available', statusLabel: 'Disponible en Point Relais', subject: 'Votre colis est disponible', receivedAt: ilYa(1), code: '554433', lieu: 'Tabac du Port, 12 Quai Gambetta, 35260 Cancale', limite: dans(2) } });
  }
  return L;
}
function main_(sc) {
  const m = { vinted_dark: false, vinted_sale_overrides: OV, vinted_bords_printed: { '9101': minuitIso } };
  if (sc === 'fait') { m.vinted_bords_printed = { '9101': minuitIso, '9102': minuitIso }; m.vinted_ship_done = { '9101': MAINTENANT - 60000, '9102': MAINTENANT - 60000, '9103': MAINTENANT - 60000 }; }
  if (sc === 'rien') { m.vinted_bords_printed = {}; }
  return m;
}

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
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = new Date(MAINTENANT).toISOString(); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function preparer(b, vp, sc) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ROWS = lignes(sc); const MAIN = main_(sc);
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) {
      const q = decodeURIComponent(u);
      const hn = (lon, lat, pr) => ({ geometry: { coordinates: [lon, lat] }, properties: { type: 'housenumber', ...pr } });
      const f = /Saint-Vincent/i.test(q) ? [{ geometry: { coordinates: [-2.7581, 47.6582] }, properties: { score: 0.93, type: 'housenumber', postcode: '56000', city: 'Vannes', name: '13 Rue Saint-Vincent' } }]
        : /Gambetta/i.test(q) ? [{ geometry: { coordinates: [-1.8516, 48.6763] }, properties: { score: 0.91, type: 'housenumber', postcode: '35260' } }]
        // Vannes (coordonnées inventées, ordre de grandeur réel) :
        : /29 Rue Hoche/i.test(q) ? [hn(-2.7590, 47.6572, { score: 0.95, postcode: '56000', city: 'Vannes', name: '29 Rue Hoche' })]
        : /11 Rue Hoche/i.test(q) ? [hn(-2.7584, 47.6581, { score: 0.95, postcode: '56000', city: 'Vannes', name: '11 Rue Hoche' })]
        // Sans code postal demandé : la Base rend la bonne adresse, À VANNES (la ville lue).
        : /17 Rue Thiers/i.test(q) ? [hn(-2.7606, 47.6553, { score: 0.91, postcode: '56000', city: 'Vannes', name: '17 Rue Thiers' }), hn(-1.5536, 47.2130, { score: 0.62, postcode: '44000', city: 'Nantes', name: '17 Rue Thiers' })]
        // Deux « 2 Place du Marché » à 56000, loin l'un de l'autre, scores proches : ambigu.
        : /Place du March/i.test(q) ? [hn(-2.7560, 47.6590, { score: 0.88, postcode: '56000', city: 'Vannes', name: '2 Place du Marché' }), hn(-2.7300, 47.6400, { score: 0.86, postcode: '56000', city: 'Vannes', name: '2 Place du Marché' })] : [];
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: f }) });
    }
    // Un fond minimal SERVI (une source GeoJSON, tuilée par MapLibre lui-même) : le
    // fond « dessine » au banc, et les phrases « pas sur la carte » s'affichent.
    if (/tiles\.openfreemap\.org\/styles\//.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ version: 8, sources: { banc: { type: 'geojson', attribution: 'OpenFreeMap © OpenMapTiles © OpenStreetMap', data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-2.759, 47.657] }, properties: {} }] } } },
        layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#eef0f2' } }, { id: 'pt', type: 'circle', source: 'banc', paint: { 'circle-radius': 2, 'circle-color': '#ccd' } }] }) });
    if (/tiles\.openfreemap\.org/.test(u)) return r.abort();
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: MAIN }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const lireEtapes = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-tournee-etape]')].map((e) => ({ id: e.getAttribute('data-tournee-etape'), etat: e.getAttribute('data-etat'), n: e.getAttribute('data-n'), courante: e.getAttribute('data-courante') === '1' })));
const attendreTournee = async (pg) => {
  await pg.locator('[data-tournee]').first().waitFor({ timeout: 25000 });
  // Les lectures arrivent les unes après les autres : on attend que les nombres se posent.
  await pg.waitForFunction(() => { const r = document.querySelector('[data-tournee-etape="retirer"]'); const e = document.querySelector('[data-tournee-etape="emballer"]'); const i = document.querySelector('[data-tournee-etape="imprimer"]');
    return r && e && i && r.getAttribute('data-etat') !== 'passu' && e.getAttribute('data-etat') !== 'passu' && i.getAttribute('data-etat') !== 'passu'; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1500);
};

async function main() {
  // (1er nov., Julien : « enlève Tournée » sur Ma journée) Tant que la carte est
  // retirée (`TOURNEE_SUR_JOURNEE = false` dans l'app), ce banc le DIT et s'arrête :
  // les épingles de relais restent vérifiées par retrait-relais-carte et colis-colonnes.
  if (/const TOURNEE_SUR_JOURNEE = false/.test(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8'))) {
    console.log('INFO Tournée retirée de Ma journée (décision du 1er nov.) — rien à vérifier ici tant qu’elle n’est pas remise.');
    srv.close(); return;
  }
  let b;
  try {
    await fabriquerTranspKusmi();
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px';
      // ── A. LES ÉTAPES ET LEURS NOMBRES ──────────────────────────────────────
      await essaie(T + ' A', async () => {
        const { ctx, pg, errs } = await preparer(b, vp, 'base');
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreTournee(pg);
        const et = await lireEtapes(pg);
        const par = Object.fromEntries(et.map((e) => [e.id, e]));
        dit(et.map((e) => e.id).join(',') === 'imprimer,emballer,deposer,retirer', `${T} quatre étapes, dans l'ordre Imprimer · Emballer · Déposer · Retirer`, JSON.stringify(et));
        dit(par.imprimer && par.imprimer.n === '2' && par.imprimer.etat === 'afaire' && par.imprimer.courante, `${T} Imprimer : 2 bordereaux prêts, pas tous imprimés ⇒ à faire, étape en cours`, JSON.stringify(par.imprimer));
        dit(par.emballer && par.emballer.n === '3' && par.emballer.etat === 'afaire', `${T} Emballer : 3 colis (calculé à la main)`, JSON.stringify(par.emballer));
        dit(par.deposer && par.deposer.n === '3' && par.deposer.etat === 'afaire', `${T} Déposer : 3 colis`, JSON.stringify(par.deposer));
        dit(par.retirer && par.retirer.n === '3' && par.retirer.etat === 'afaire', `${T} Retirer : 3 colis (Kusmi Tea 2 + Tabac du Port 1)`, JSON.stringify(par.retirer));
        const src = await pg.evaluate(() => { const L = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
          const t = (id) => { const e = document.querySelector(`[data-tuile="${id}"]`); return e ? e.getAttribute('data-n') : null; };
          return { aposter: (L('vrm_colis_aposter') || {}).total, retirer: (L('vrm_colis_retirer') || {}).total, tEnv: t('envoyer'), tRet: t('retirer') }; });
        dit(String(src.aposter) === par.emballer.n && src.tEnv === par.emballer.n, `${T} Emballer = la case « À envoyer » = vrm_colis_aposter (§11)`, JSON.stringify(src));
        dit(String(src.retirer) === par.retirer.n && src.tRet === par.retirer.n, `${T} Retirer = la case « À retirer » = vrm_colis_retirer (§11)`, JSON.stringify(src));
        const nums = await pg.evaluate(() => (document.querySelector('[data-tournee-numeros]') || {}).getAttribute ? document.querySelector('[data-tournee-numeros]').getAttribute('data-tournee-numeros') : null);
        dit(nums === '117,42,73', `${T} Emballer : les N° dans l'ordre de leur date limite (117 · 42 · 73), jamais par emplacement`, String(nums));
        const empl = await pg.evaluate(() => /imprimer la journée|par emplacement/i.test((document.querySelector('[data-tournee]') || {}).innerText || ''));
        dit(!empl, `${T} aucune « impression de la journée triée par emplacement » (refusée le 11 oct.)`);
        const sw = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(sw.sw <= sw.cw + 1, `${T} aucun débordement`, JSON.stringify(sw));
        await pg.evaluate(() => { const t = document.querySelector('[data-tournee]'); if (t) t.scrollIntoView({ block: 'center' }); });
        await pg.waitForTimeout(300);
        await pg.screenshot({ path: path.join(SHOTS, `tournee-carte-${vp.width}.png`) });
        // ── B. LE MODE PLEIN ÉCRAN ────────────────────────────────────────────
        await pg.locator('[data-tournee-ouvrir]:visible').first().click();
        await pg.locator('[data-tournee-plein]').waitFor({ timeout: 8000 });
        // La carte se charge à part (MapLibre) : on attend ses épingles, sans délai fixe.
        await pg.waitForFunction(() => document.querySelectorAll('[data-tournee-plein] [data-relais-epingle]').length >= 2 || !!document.querySelector('[data-relais-carte-ko]'), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const ar =await pg.evaluate(() => ({ ordre: !!document.querySelector('[data-tournee-ordre="limite"]'),
          l: [...document.querySelectorAll('[data-tournee-arret]')].map((e) => ({ cle: e.getAttribute('data-tournee-arret'), type: e.getAttribute('data-type'), n: e.getAttribute('data-n'), j: e.getAttribute('data-jours'), num: e.getAttribute('data-numero') })) }));
        const jours = ar.l.map((x) => (x.j === '' ? 9999 : Number(x.j)));
        const croissant = jours.every((j, k) => !k || j >= jours[k - 1]);
        dit(ar.ordre && croissant, `${T} plein écran : arrêts rangés par date limite la plus proche, dit comme tel (pas un itinéraire)`, JSON.stringify(ar.l.map((x) => [x.cle, x.j])));
        const attendu = ['d:Mondial Relay', 'r:', 'd:Vinted Go', 'r:', 'd:?'];
        const conf = ar.l.length === 5 && ar.l.every((x, k) => x.cle.startsWith(attendu[k])) && ar.l.map((x) => x.num).join(',') === '1,2,3,4,5';
        dit(conf, `${T} plein écran : Mondial Relay (1 j) · Tabac du Port (2 j) · Vinted Go (4 j) · Kusmi Tea (4 j) · dépôt sans transporteur (6 j)`, JSON.stringify(ar.l));
        const sommes = { d: ar.l.filter((x) => x.type === 'depot').reduce((t, x) => t + Number(x.n), 0), r: ar.l.filter((x) => x.type === 'retrait').reduce((t, x) => t + Number(x.n), 0) };
        dit(sommes.d === 3 && sommes.r === 3, `${T} plein écran : 3 colis à déposer et 3 à retirer, aucun perdu`, JSON.stringify(sommes));
        const carte = await pg.evaluate(() => ({ carte: !!document.querySelector('[data-tournee-plein] [data-relais-fond]') || !!document.querySelector('[data-tournee-plein] [data-tournee-sans-carte]'), km: /\bkm\b|\bmin\b/.test((document.querySelector('[data-tournee-plein]') || {}).innerText || ''), depots: !!document.querySelector('[data-tournee-depots-hors-carte]') }));
        dit(carte.carte && !carte.km && carte.depots, `${T} plein écran : la carte des points relais (ou sa raison), aucune distance ni durée inventée, les dépôts dits hors carte`, JSON.stringify(carte));
        const ep = await pg.evaluate(() => [...document.querySelectorAll('[data-tournee-plein] [data-relais-epingle]')].map((e) => [e.getAttribute('data-relais-epingle'), e.textContent]).sort());
        // (1er nov., Julien : « UN point par relais avec le NOMBRE de colis ») L'épingle
        // porte le nombre de colis à retirer : Kusmi Tea 2, Tabac du Port 1 (pas le n° d'arrêt).
        if (ep.length) dit(JSON.stringify(ep) === JSON.stringify([['kusmitea|56000', '2'], ['tabacduport|35260', '1']]), `${T} plein écran : une épingle par relais, qui porte SON nombre de colis (Kusmi Tea 2, Tabac du Port 1)`, JSON.stringify(ep));
        else dit(false, `${T} plein écran : les épingles sont posées (le banc a WebGL : elles existent dans le DOM même si le fond échoue)`);
        // (1er nov., Julien : « 5 points de retrait mais 3 sur la carte ») Chaque arrêt de
        // retrait est SUR la carte (une épingle à SA clé, au même nombre que la ligne) ou dit « Pas sur la carte » sous lui.
        const cov = await pg.evaluate(() => {
          const surEp = new Map([...document.querySelectorAll('[data-tournee-plein] [data-relais-epingle]')].map((e) => ['r:' + e.getAttribute('data-relais-epingle'), e.textContent]));
          return [...document.querySelectorAll('[data-tournee-arret][data-type="retrait"]')].map((e) => ({ cle: e.getAttribute('data-tournee-arret'), n: e.getAttribute('data-n'), carte: surEp.has(e.getAttribute('data-tournee-arret')), memeN: surEp.get(e.getAttribute('data-tournee-arret')) === e.getAttribute('data-n'), dit: !!e.querySelector('[data-tournee-hors-carte]'), ko: !!document.querySelector('[data-relais-carte-ko]') }));
        });
        dit(cov.filter((x) => x.carte).every((x) => x.memeN), `${T} plein écran : l'épingle dit le MÊME nombre que la ligne de son arrêt`, JSON.stringify(cov));
        if (!cov.some((x) => x.ko)) dit(cov.length > 0 && cov.every((x) => x.carte !== x.dit), `${T} plein écran : chaque point de retrait est sur la carte OU dit « pas sur la carte » avec sa raison`, JSON.stringify(cov));
        else console.log(`INFO ${T} plein écran : fond de carte indisponible ici — la liste porte le contrôle`);
        await pg.screenshot({ path: path.join(SHOTS, `tournee-plein-${vp.width}.png`) });
        await pg.click('[data-tournee-fermer]');
        await pg.waitForTimeout(400);
        dit(!(await pg.$('[data-tournee-plein]')), `${T} plein écran : se ferme`);
        // ── C. CHAQUE ÉTAPE OUVRE SON ÉCRAN ───────────────────────────────────
        await pg.evaluate(() => { const t = document.querySelector('[data-tournee]'); if (t) t.scrollIntoView({ block: 'center' }); });
        await pg.click('[data-tournee-etape="imprimer"] button');
        const lot = await pg.locator('[data-lot-imprimer]').first().waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
        dit(lot, `${T} Imprimer ouvre l'impression EXISTANTE des prêts (« Imprimer les N prêts » de Colis)`);
        dit(!errs.length, `${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
      await essaie(T + ' C2', async () => {
        const { ctx, pg, errs } = await preparer(b, vp, 'base');
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreTournee(pg);
        await pg.click('[data-tournee-etape="retirer"] button');
        const col = await pg.locator('[data-cc-colonne="retirer"]').first().waitFor({ timeout: 25000 }).then(() => true).catch(() => false);
        dit(col, `${T} Retirer ouvre Colis, colonne « À retirer »`);
        dit(!errs.length, `${T} C2 aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
      // ── D. COCHÉE SUR UNE DONNÉE RÉELLE ─────────────────────────────────────
      await essaie(T + ' D', async () => {
        const { ctx, pg, errs } = await preparer(b, vp, 'fait');
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreTournee(pg);
        const par = Object.fromEntries((await lireEtapes(pg)).map((e) => [e.id, e]));
        dit(par.imprimer && par.imprimer.etat === 'fait' && par.emballer.etat === 'fait' && par.deposer.etat === 'fait', `${T} déposés et imprimés aujourd'hui ⇒ Imprimer, Emballer, Déposer cochées`, JSON.stringify(par));
        dit(par.retirer && par.retirer.etat === 'afaire' && par.retirer.courante, `${T} Retirer reste à faire, c'est l'étape en cours`, JSON.stringify(par.retirer));
        const f = await pg.evaluate(() => document.querySelector('[data-tournee]').getAttribute('data-tournee-faites'));
        dit(f === '3', `${T} 3 sur 4 faites`, f);
        await pg.evaluate(() => { const t = document.querySelector('[data-tournee]'); if (t) t.scrollIntoView({ block: 'center' }); });
        await pg.waitForTimeout(300);
        await pg.screenshot({ path: path.join(SHOTS, `tournee-fait-${vp.width}.png`) });
        dit(!errs.length, `${T} D aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
      // ── V. SA CAPTURE : QUATRE RELAIS À VANNES (1er nov.) ───────────────────
      // CALCULÉ À LA MAIN : Tabavap 3 (le n° 11110003 écrit deux fois compte une
      // fois), Terra Cbd 1, Phone Cash 1 (adresse sans code postal, rue + ville
      // sûres), Le Narval 1 (Base Adresse ambiguë) ⇒ Retirer 6 = vrm_colis_retirer ;
      // 3 épingles « 3 », « 1 », « 1 » ; Le Narval « pas sur la carte », raison « ambigu ».
      await essaie(T + ' V', async () => {
        const { ctx, pg, errs } = await preparer(b, vp, 'vannes');
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreTournee(pg);
        const ret = await pg.evaluate(() => { const e = document.querySelector('[data-tournee-etape="retirer"]'); let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) {} return { n: e && e.getAttribute('data-n'), pub: pub && pub.total }; });
        dit(ret.n === '6' && String(ret.pub) === '6', `${T} V Retirer : 6 colis (Tabavap 3 dont un n° de suivi en double compté une fois, Terra Cbd 1, Phone Cash 1, Le Narval 1) = vrm_colis_retirer`, JSON.stringify(ret));
        await pg.locator('[data-tournee-ouvrir]:visible').first().click();
        await pg.locator('[data-tournee-plein]').waitFor({ timeout: 8000 });
        await pg.waitForFunction(() => !document.querySelector('[data-tournee-plein] [data-raison="cherche"]') && document.querySelectorAll('[data-tournee-plein] [data-relais-epingle]').length > 0, null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const L = await pg.evaluate(() => ({
          ep: [...document.querySelectorAll('[data-tournee-plein] [data-relais-epingle]')].map((e) => [e.getAttribute('data-relais-epingle'), e.textContent]).sort(),
          fond: (document.querySelector('[data-tournee-plein] [data-relais-fond]') || {}).getAttribute ? document.querySelector('[data-tournee-plein] [data-relais-fond]').getAttribute('data-relais-fond') : null,
          arr: [...document.querySelectorAll('[data-tournee-arret][data-type="retrait"]')].map((e) => { const h = e.querySelector('[data-tournee-hors-carte]'); return { cle: e.getAttribute('data-tournee-arret'), n: e.getAttribute('data-n'), carte: e.getAttribute('data-tournee-sur-carte'), raison: h ? h.getAttribute('data-raison') : null, txt: h ? h.textContent : '' }; }),
        }));
        dit(JSON.stringify(L.ep) === JSON.stringify([['phonecash|', '1'], ['tabavap|56000', '3'], ['terracbd|56000', '1']]), `${T} V une épingle par relais avec son NOMBRE : Tabavap 3 (trois colis ⇒ UNE épingle), Terra Cbd 1 et Tabavap, tous deux rue Hoche ⇒ deux épingles, Phone Cash (sans code postal) 1`, JSON.stringify(L.ep));
        const par = Object.fromEntries(L.arr.map((x) => [x.cle, x]));
        const nar = L.arr.find((x) => /narval/.test(x.cle));
        dit(!!nar && nar.carte === 'non' && nar.raison === 'ambigu' && nar.txt.length > 20, `${T} V Le Narval : la Base Adresse rend deux endroits ⇒ PAS d'épingle, « pas sur la carte » et la raison dite`, JSON.stringify(nar));
        dit(L.arr.length === 4 && L.arr.every((x) => (x.carte === 'oui') !== !!x.raison), `${T} V chaque point de retrait est sur la carte OU dit pourquoi il n'y est pas — jamais en silence`, JSON.stringify(L.arr));
        dit(L.ep.every(([k, t]) => par['r:' + k] && par['r:' + k].n === t), `${T} V l'épingle et la ligne de l'arrêt disent le même nombre`, JSON.stringify([L.ep, L.arr.map((x) => [x.cle, x.n])]));
        dit(L.fond === 'pret', `${T} V le fond de carte (servi au banc) est dessiné`, String(L.fond));
        await pg.screenshot({ path: path.join(SHOTS, `tournee-vannes-${vp.width}.png`) });
        // Toucher une épingle met SA ligne en avant.
        await pg.evaluate(() => { const e = [...document.querySelectorAll('[data-tournee-plein] [data-relais-epingle]')].find((x) => x.getAttribute('data-relais-epingle') === 'terracbd|56000'); if (e) e.click(); });
        await pg.waitForTimeout(700);
        const ch = await pg.evaluate(() => ({ li: [...document.querySelectorAll('[data-tournee-choisi]')].map((e) => e.getAttribute('data-tournee-arret')), ep: [...document.querySelectorAll('[data-relais-choisi]')].map((e) => e.getAttribute('data-relais-epingle')) }));
        dit(JSON.stringify(ch.li) === '["r:terracbd|56000"]' && JSON.stringify(ch.ep) === '["terracbd|56000"]', `${T} V toucher l'épingle Terra Cbd met SA ligne en avant (et l'épingle)`, JSON.stringify(ch));
        await pg.screenshot({ path: path.join(SHOTS, `tournee-vannes-choisi-${vp.width}.png`) });
        await pg.click('[data-tournee-fermer]');
        await pg.waitForTimeout(300);
        // ── La même chose dans Colis → À retirer ────────────────────────────
        await pg.evaluate(() => { const t = document.querySelector('[data-tournee]'); if (t) t.scrollIntoView({ block: 'center' }); });
        await pg.click('[data-tournee-etape="retirer"] button');
        await pg.locator('[data-cc-colonne="retirer"] [data-relais-point]').first().waitFor({ timeout: 25000 });
        await pg.waitForFunction(() => !document.querySelector('[data-cc-colonne="retirer"] [data-relais-repere="cherche"]'), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const K = await pg.evaluate(() => ({
          ep: [...document.querySelectorAll('[data-cc-colonne="retirer"] [data-relais-epingle]')].map((e) => [e.getAttribute('data-relais-epingle'), e.textContent]).sort(),
          pts: [...document.querySelectorAll('[data-cc-colonne="retirer"] [data-relais-point]')].map((e) => ({ cle: e.getAttribute('data-relais-point'), past: (e.querySelector('[data-relais-pastille]') || {}).textContent || null, rp: e.getAttribute('data-relais-repere'), raison: (e.querySelector('[data-relais-sans-repere]') || { getAttribute: () => null }).getAttribute('data-raison') })),
        }));
        dit(JSON.stringify(K.ep) === JSON.stringify(L.ep), `${T} V Colis → À retirer : les mêmes épingles, avec les mêmes nombres`, JSON.stringify(K.ep));
        const kp = Object.fromEntries(K.pts.map((x) => [x.cle, x]));
        dit(K.ep.every(([k, t]) => kp[k] && kp[k].past === t), `${T} V Colis : la pastille de chaque point dit le nombre de SON épingle`, JSON.stringify(K.pts));
        const kn = K.pts.find((x) => /narval/.test(x.cle));
        dit(!!kn && kn.rp === 'non' && kn.raison === 'ambigu', `${T} V Colis : Le Narval pas sur la carte, raison « ambigu » dite sous lui`, JSON.stringify(kn));
        await pg.evaluate(() => { const c = document.querySelector('[data-cc-colonne="retirer"]'); if (c) c.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(400);
        await pg.screenshot({ path: path.join(SHOTS, `colis-vannes-${vp.width}.png`) });
        dit(!errs.length, `${T} V aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
      // ── K. LA CONSIGNE VINTED GO SANS CODE POSTAL (1er nov., sa capture) ──────
      // CALCULÉ À LA MAIN : 4 colis à retirer chez Kusmi Tea (4 e-mails, 4 n°).
      //   kusmi      ⇒ adresse complétée par le suivi (13 Rue Saint-Vincent, Vannes)
      //                ⇒ une épingle « 4 », sur la carte, dans la tournée ET dans Colis ;
      //   kusmi-sans ⇒ aucune épingle, raison `vintedgo-pas-lu` + le geste dit ;
      //   kusmi-deux ⇒ aucune épingle, raison `deux-adresses` (24 Rue Hoche nommée).
      // (L’achat 9401, commun à tous les scénarios, reste sous « Point pas encore connu ».)
      for (const sc of ['kusmi', 'kusmi-sans', 'kusmi-deux']) await essaie(`${T} K ${sc}`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, sc);
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await attendreTournee(pg);
        const ret = await pg.evaluate(() => { const e = document.querySelector('[data-tournee-etape="retirer"]'); let pub = null; try { pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) {} return { n: e && e.getAttribute('data-n'), pub: pub && pub.total }; });
        dit(ret.n === '4' && String(ret.pub) === '4', `${T} K ${sc} Retirer : 4 colis chez Kusmi Tea = vrm_colis_retirer`, JSON.stringify(ret));
        await pg.locator('[data-tournee-ouvrir]:visible').first().click();
        await pg.locator('[data-tournee-plein]').waitFor({ timeout: 8000 });
        await pg.waitForFunction(() => !document.querySelector('[data-tournee-plein] [data-raison="cherche"]') && (document.querySelectorAll('[data-tournee-plein] [data-relais-epingle]').length > 0 || document.querySelectorAll('[data-tournee-plein] [data-tournee-hors-carte]').length > 0), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1200);
        const L = await pg.evaluate(() => ({
          ep: [...document.querySelectorAll('[data-tournee-plein] [data-relais-epingle]')].map((e) => [e.getAttribute('data-relais-epingle'), e.textContent]).sort(),
          arr: [...document.querySelectorAll('[data-tournee-arret][data-type="retrait"]')].map((e) => { const h = e.querySelector('[data-tournee-hors-carte]'); return { cle: e.getAttribute('data-tournee-arret'), n: e.getAttribute('data-n'), carte: e.getAttribute('data-tournee-sur-carte'), raison: h ? h.getAttribute('data-raison') : null, txt: h ? h.textContent : '' }; }),
        }));
        const k = L.arr.find((x) => /kusmi/.test(x.cle));
        if (sc === 'kusmi') {
          dit(JSON.stringify(L.ep) === JSON.stringify([['kusmitea|', '4']]), `${T} K kusmi : l'adresse lue dans le suivi Vinted Go DU MÊME N° ⇒ UNE épingle « 4 »`, JSON.stringify(L.ep));
          dit(!!k && k.carte === 'oui' && !k.raison && k.n === '4', `${T} K kusmi : l'arrêt Kusmi Tea est sur la carte, plus de « pas sur la carte »`, JSON.stringify(k));
        } else {
          const code = sc === 'kusmi-sans' ? 'vintedgo-pas-lu' : 'deux-adresses';
          const motif = sc === 'kusmi-sans' ? /ouvre le suivi Vinted Go/ : /deux adresses[\s\S]*24 Rue Hoche/;
          dit(L.ep.length === 0, `${T} K ${sc} : AUCUNE épingle (rien n'est deviné)`, JSON.stringify(L.ep));
          dit(!!k && k.carte === 'non' && k.raison === code && motif.test(k.txt), `${T} K ${sc} : « pas sur la carte », raison « ${code} » dite sous l'arrêt`, JSON.stringify(k));
        }
        await pg.screenshot({ path: path.join(SHOTS, `tournee-${sc}-${vp.width}.png`) });
        await pg.click('[data-tournee-fermer]');
        await pg.waitForTimeout(300);
        await pg.evaluate(() => { const t = document.querySelector('[data-tournee]'); if (t) t.scrollIntoView({ block: 'center' }); });
        await pg.click('[data-tournee-etape="retirer"] button');
        await pg.locator('[data-cc-colonne="retirer"] [data-relais-point]').first().waitFor({ timeout: 25000 });
        await pg.waitForFunction(() => !document.querySelector('[data-cc-colonne="retirer"] [data-relais-repere="cherche"]'), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const K = await pg.evaluate(() => ({
          ep: [...document.querySelectorAll('[data-cc-colonne="retirer"] [data-relais-epingle]')].map((e) => [e.getAttribute('data-relais-epingle'), e.textContent]).sort(),
          pts: [...document.querySelectorAll('[data-cc-colonne="retirer"] [data-relais-point]')].map((e) => ({ cle: e.getAttribute('data-relais-point'), past: (e.querySelector('[data-relais-pastille]') || {}).textContent || null, rp: e.getAttribute('data-relais-repere'), raison: (e.querySelector('[data-relais-sans-repere]') || { getAttribute: () => null }).getAttribute('data-raison'), txt: (e.querySelector('[data-relais-sans-repere]') || {}).textContent || '' })),
        }));
        dit(JSON.stringify(K.ep) === JSON.stringify(L.ep), `${T} K ${sc} Colis → À retirer : les mêmes épingles que la tournée`, JSON.stringify(K.ep));
        // (1er nov., sa capture de la colonne) La phrase du point porte le NOMBRE en
        // clair (« 4 colis à retirer »), le même que sa pastille ; sans photo, jamais
        // un carré gris vide : une icône de colis (`data-sans-photo`).
        const R = await pg.evaluate(() => {
          const p = [...document.querySelectorAll('[data-cc-colonne="retirer"] [data-relais-point]')].find((e) => /kusmi/.test(e.getAttribute('data-relais-point')));
          if (!p) return null;
          const res = p.querySelector('.vrm-rp-resume'); const vis = (e) => { const st = getComputedStyle(e); const r = e.getBoundingClientRect(); return st.visibility !== 'hidden' && r.width > 2 && r.height > 2; };
          const cartes = [...p.querySelectorAll('[data-cc-carte]')];
          return { resume: res ? res.innerText : '', past: (p.querySelector('[data-relais-pastille]') || {}).textContent || '', sorte: (p.querySelector('[data-relais-pastille]') || { getAttribute: () => '' }).getAttribute('data-relais-pastille-sorte'),
            cartes: cartes.length, vides: cartes.filter((c) => { const v = c.querySelector('.vrm-cc-photo-vide'); return v && vis(v); }).length,
            icones: cartes.filter((c) => { const i = c.querySelector('[data-sans-photo] svg'); return i && vis(i); }).length };
        });
        dit(!!R && /^4 colis à retirer\b/.test(R.resume) && R.past === '4' && R.sorte === 'aretirer', `${T} K ${sc} Colis : la phrase dit « 4 colis à retirer » en clair, la pastille dit le même nombre (sorte « à retirer »)`, JSON.stringify(R));
        dit(!!R && R.cartes === 4 && R.vides === 0 && R.icones === 4, `${T} K ${sc} Colis : 4 colis sans photo ⇒ 4 icônes de colis, aucun carré gris vide`, JSON.stringify(R));
        const kp = K.pts.find((x) => /kusmi/.test(x.cle));
        if (sc === 'kusmi') dit(K.pts.filter((x) => x.cle !== "__inconnu").length === 1 && !!kp && kp.rp !== 'non' && kp.past === '4' && !kp.raison, `${T} K kusmi Colis : UN point Kusmi Tea, pastille « 4 », sur la carte`, JSON.stringify(K.pts));
        else dit(K.pts.filter((x) => x.cle !== "__inconnu").length === 1 && !!kp && kp.raison === (sc === 'kusmi-sans' ? 'vintedgo-pas-lu' : 'deux-adresses') && kp.txt.length > 30, `${T} K ${sc} Colis : la même raison dite sous le point`, JSON.stringify(K.pts));
        await pg.evaluate(() => { const c = document.querySelector('[data-cc-colonne="retirer"]'); if (c) c.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(400);
        await pg.screenshot({ path: path.join(SHOTS, `colis-${sc}-${vp.width}.png`) });
        dit(!errs.length, `${T} K ${sc} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
      // ── E. RIEN À FAIRE ⇒ PAS DE CARTE ──────────────────────────────────────
      await essaie(T + ' E', async () => {
        const { ctx, pg, errs } = await preparer(b, vp, 'rien');
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-tuile="envoyer"]').first().waitFor({ timeout: 25000, state: 'attached' });
        await pg.waitForTimeout(3500);
        dit(!(await pg.$('[data-tournee]')), `${T} rien à poster ni à retirer ⇒ aucune carte « tournée » (pas de case vide)`);
        dit(!errs.length, `${T} E aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(`captures : ${SHOTS}`);
  console.log(ko ? `\n❌ tournée : ${ko} rouge(s).` : `\n✅ tournée : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
