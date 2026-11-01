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

function lignes(sc) {
  const L = [
    { id: 'harvest_111_listings', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { items: [] } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: sc === 'rien' ? [] : ACHATS } } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: sc === 'rien' ? [] : VENTES } } },
  ];
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
      const f = /Saint-Vincent/i.test(q) ? [{ geometry: { coordinates: [-2.7581, 47.6582] }, properties: { score: 0.93, type: 'housenumber', postcode: '56000' } }]
        : /Gambetta/i.test(q) ? [{ geometry: { coordinates: [-1.8516, 48.6763] }, properties: { score: 0.91, type: 'housenumber', postcode: '35260' } }] : [];
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: f }) });
    }
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
  let b;
  try {
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
        await pg.evaluate(() => { const t = document.querySelector('[data-tournee]'); if (t) t.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(300);
        await pg.screenshot({ path: path.join(SHOTS, `tournee-carte-${vp.width}.png`) });
        // ── B. LE MODE PLEIN ÉCRAN ────────────────────────────────────────────
        await pg.click('[data-tournee-ouvrir]');
        await pg.locator('[data-tournee-plein]').waitFor({ timeout: 8000 });
        await pg.waitForTimeout(800);
        const ar = await pg.evaluate(() => ({ ordre: !!document.querySelector('[data-tournee-ordre="limite"]'),
          l: [...document.querySelectorAll('[data-tournee-arret]')].map((e) => ({ cle: e.getAttribute('data-tournee-arret'), type: e.getAttribute('data-type'), n: e.getAttribute('data-n'), j: e.getAttribute('data-jours'), num: e.getAttribute('data-numero') })) }));
        const jours = ar.l.map((x) => (x.j === '' ? 9999 : Number(x.j)));
        const croissant = jours.every((j, k) => !k || j >= jours[k - 1]);
        dit(ar.ordre && croissant, `${T} plein écran : arrêts rangés par date limite la plus proche, dit comme tel (pas un itinéraire)`, JSON.stringify(ar.l.map((x) => [x.cle, x.j])));
        const attendu = ['d:Mondial Relay', 'r:', 'd:Vinted Go', 'r:', 'd:?'];
        const conf = ar.l.length === 5 && ar.l.every((x, k) => x.cle.startsWith(attendu[k])) && ar.l.map((x) => x.num).join(',') === '1,2,3,4,5';
        dit(conf, `${T} plein écran : Mondial Relay (1 j) · Tabac du Port (2 j) · Vinted Go (4 j) · Kusmi Tea (4 j) · dépôt sans transporteur (6 j)`, JSON.stringify(ar.l));
        const sommes = { d: ar.l.filter((x) => x.type === 'depot').reduce((t, x) => t + Number(x.n), 0), r: ar.l.filter((x) => x.type === 'retrait').reduce((t, x) => t + Number(x.n), 0) };
        dit(sommes.d === 3 && sommes.r === 3, `${T} plein écran : 3 colis à déposer et 3 à retirer, aucun perdu`, JSON.stringify(sommes));
        const carte = await pg.evaluate(() => ({ carte: !!document.querySelector('[data-tournee-plein] [data-relais-carte]') || !!document.querySelector('[data-tournee-plein] [data-tournee-sans-carte]'), km: /\bkm\b|\bmin\b/.test((document.querySelector('[data-tournee-plein]') || {}).innerText || ''), depots: !!document.querySelector('[data-tournee-depots-hors-carte]') }));
        dit(carte.carte && !carte.km && carte.depots, `${T} plein écran : la carte des points relais (ou sa raison), aucune distance ni durée inventée, les dépôts dits hors carte`, JSON.stringify(carte));
        const ep = await pg.evaluate(() => [...document.querySelectorAll('[data-tournee-plein] [data-relais-epingle]')].map((e) => [e.getAttribute('data-relais-epingle'), e.textContent]).sort());
        if (ep.length) dit(JSON.stringify(ep) === JSON.stringify([['kusmitea|56000', '4'], ['tabacduport|35260', '2']]), `${T} plein écran : chaque épingle porte le numéro de SON arrêt (Tabac du Port 2, Kusmi Tea 4)`, JSON.stringify(ep));
        else console.log(`INFO ${T} plein écran : pas d'épingle dessinée ici (navigateur du banc sans WebGL) — la liste porte le contrôle`);
        await pg.screenshot({ path: path.join(SHOTS, `tournee-plein-${vp.width}.png`) });
        await pg.click('[data-tournee-fermer]');
        await pg.waitForTimeout(400);
        dit(!(await pg.$('[data-tournee-plein]')), `${T} plein écran : se ferme`);
        // ── C. CHAQUE ÉTAPE OUVRE SON ÉCRAN ───────────────────────────────────
        await pg.evaluate(() => { const t = document.querySelector('[data-tournee]'); if (t) t.scrollIntoView({ block: 'start' }); });
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
        await pg.evaluate(() => { const t = document.querySelector('[data-tournee]'); if (t) t.scrollIntoView({ block: 'start' }); });
        await pg.waitForTimeout(300);
        await pg.screenshot({ path: path.join(SHOTS, `tournee-fait-${vp.width}.png`) });
        dit(!errs.length, `${T} D aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
      // ── E. RIEN À FAIRE ⇒ PAS DE CARTE ──────────────────────────────────────
      await essaie(T + ' E', async () => {
        const { ctx, pg, errs } = await preparer(b, vp, 'rien');
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-tuile="envoyer"]').first().waitFor({ timeout: 25000 });
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
