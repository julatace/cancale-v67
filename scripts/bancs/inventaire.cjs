// Banc : L'INVENTAIRE DU STOCK (6 nov. 2026, src/InventaireStock.jsx, src/inventaire.js)
//
// Rendu réel, données INVENTÉES (dépôt public), 390 tactile et 1512 souris, clair et sombre :
//   A  Stock → « Inventaire » → « Commencer » ; « 1 » + Entrée ⇒ VERT « attendu » ;
//      « 007 » + OK ⇒ AMBRE « vendu — à sortir » (N°7 prouvée vendue) ; « 125 » ⇒ neutre
//      « pas su » (B125 ≠ 125, et un compte n'est pas lu : jamais « en trop ») ; « 60 »
//      (numérotée, plus en annonce) ⇒ AMBRE « en trop » ; « b125 » ⇒ VERT (B125 en ligne) ;
//      « 2 » ⇒ ROUGE (N°2 portée par deux paires, `vrm_num_doublons`) — le seul rouge ;
//      « Annuler » retire le dernier ; les couleurs sont lues sur le rendu (teinte calculée) ;
//   B  l'inventaire SURVIT : rechargement de la page, puis un AUTRE appareil (stockage
//      vide) le retrouve par la ligne `vrm_inventaire` (écrite avec `rev`, PATCH gardé) ;
//   C  « Terminer » ⇒ le bilan : manque (N°3, N°40), en trop (N°60), vendue rangée (N°7),
//      le compte pas lu NOMMÉ et sa N°30 jamais « manque » ;
//   D  Ma journée dit « Inventaire en cours » (avant « Terminer ») et y ramène ;
//   E  lecture de `vrm_inventaire` en panne : la saisie reste sur l'appareil, AUCUNE
//      écriture n'est envoyée (« lecture KO, écriture OK » est le cas qui détruit, §5) ;
//   F  aucune erreur de page, aucun défilement horizontal.
// Lancer : npm run build ; BANC_PORT=103xx SHOT=/chemin/prefixe node scripts/bancs/inventaire.cjs
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10310;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const AUJ = Date.now();
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);

const MAIN = {
  vinted_annonce_numeros: {
    '1001': { numero: '1', title: 'Paire inventée une 42', accountId: '111' },
    '1002': { numero: '2', title: 'Paire inventée deux 40', accountId: '111' },
    '1003': { numero: '3', title: 'Paire inventée trois 43', accountId: '111' },
    '1007': { numero: '7', title: 'Paire inventée sept 41', accountId: '111' },
    '1125': { numero: 'B125', title: 'Vieille paire inventée', accountId: '111' },
    '2030': { numero: '30', title: 'Paire du compte pas lu', accountId: '222' },
    // N°40 : en ligne sur eBay (SKU « VRM-40 ») ; N°60 : numérotée, plus en annonce nulle part.
    '3040': { numero: '40', title: 'Paire inventée sur eBay', accountId: '111', numberedAt: '2026-10-01T10:00:00Z' },
    '1060': { numero: '60', title: 'Paire inventée plus en ligne', accountId: '111' },
  },
  vinted_used_numeros: [1, 2, 3, 7, 30, 40, 60, 'B125'],
  vrm_meubles: [{ id: 'mA', name: 'Étagère banc', cols: 3, rows: 2 }],
  vrm_slots: { '1': { m: 'mA', i: 0 }, '7': { m: 'mA', i: 1 }, '30': { m: 'mA', i: 2 } },
  vrm_stock_vendus: { nums: ['7'], at: AUJ },
  vinted_nums_physiques: { nums: ['1', '2', '3', '7', 'B125'], at: AUJ },
  vrm_num_doublons: { nums: ['2'], at: AUJ },
};
const ann = (id, title) => ({ id, title, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: null, brand_title: 'Marque', size_title: '42', status: 'Très bon état', created_at_ts: ts('2026-10-10T10:00:00Z') });
const ROWS = () => [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), nItems: 4, payload: { items: [ann(1001, 'Paire inventée une 42'), ann(1002, 'Paire inventée deux 40'), ann(1003, 'Paire inventée trois 43'), ann(1125, 'Vieille paire inventée')] } } },
  { id: 'ebay_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), items: [{ itemId: '9040', sku: 'VRM-40', title: 'Paire inventée sur eBay', photo: null, depuis: '2026-10-02T10:00:00Z' }] } },
  // Vestiaire lu (frais, complet, aucune annonce) : sinon rien ne serait « jugeable ».
  { id: 'vc_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), items: {}, liens: {}, complet: true } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
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
    out[alias] = v == null ? null : (/->>[^>]*$/.test(src) && typeof v === 'object' ? JSON.stringify(v) : (/->>[^>]*$/.test(src) ? String(v) : v));
  }
  return out;
};

// LA LIGNE `vrm_inventaire`, servie comme PostgREST : GET (select=data ou projeté),
// POST (création ; 409 si elle existe), PATCH gardé par `data->>rev=eq.N` / `is.null`
// (0 ligne rendue = conflit). `panne` : la LECTURE répond 500.
function nouvelleBase() { return { ligne: null, ecritures: 0, lectures: 0, panne: false }; }

async function rendre(b, { tel, sombre, tab, base, vide = false }) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/id=eq\.vrm_inventaire/.test(u) || (req.method() === 'POST' && /vrm_inventaire/.test(req.postData() || ''))) {
      if (req.method() === 'GET') {
        base.lectures++;
        if (base.panne) return j({ message: 'panne' }, 500);
        return j(base.ligne ? [sel && sel !== 'data' ? projette({ id: 'vrm_inventaire', data: base.ligne }, sel) : { data: base.ligne }] : []);
      }
      if (req.method() === 'POST') {
        base.ecritures++;
        if (base.ligne) return j({ message: 'existe' }, 409);
        const rows = JSON.parse(req.postData() || '[]'); base.ligne = rows[0].data; return j([], 201);
      }
      if (req.method() === 'PATCH') {
        base.ecritures++;
        const revAttendu = /data->>rev=is\.null/.test(u) ? null : Number((/data->>rev=eq\.(\d+)/.exec(u) || [])[1]);
        const revLigne = base.ligne && Number.isSafeInteger(base.ligne.rev) ? base.ligne.rev : null;
        if (!base.ligne || revAttendu !== revLigne) return j([]);
        base.ligne = JSON.parse(req.postData() || '{}').data; return j([{ id: 'vrm_inventaire' }]);
      }
    }
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([
      { id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 2, vinted_user_id: '222', login: 'compte_pas_lu', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]);
    // Le compte 222 : sa lecture RATE (pas su).
    if (/harvest_222_/.test(u)) return j({ message: 'panne' }, 500);
    const forme = (r) => (sel && !/^id,data$|^data$/.test(sel) ? projette(r, sel) : { ...r, updated_at: new Date(AUJ).toISOString() });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS().filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS().filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.addInitScript(({ m, sombre, vide }) => {
    try {
      if (sessionStorage.getItem('banc_pose')) return;          // un rechargement garde CE stockage
      sessionStorage.setItem('banc_pose', '1');
      localStorage.setItem('vrm_acces_direct', '1');
      for (const k in m) localStorage.setItem(k, JSON.stringify(m[k]));
      localStorage.setItem('vinted_dark', JSON.stringify(!!sombre));
      localStorage.setItem('vinted_garage_view', JSON.stringify('meubles'));
      if (vide) for (const k of Object.keys(localStorage)) if (/^vrm_inventaire_local_/.test(k)) localStorage.removeItem(k);
    } catch (_) {}
  }, { m: MAIN, sombre, vide });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}
const shot = async (pg, nom) => { if (!process.env.SHOT) return; try { await pg.screenshot({ path: `${process.env.SHOT}-${nom}.png`, fullPage: false, timeout: 90000, animations: 'disabled' }); } catch (e) { dit(false, `capture ${nom}`, String(e && e.message).split('\n')[0]); } };
const toucher = async (pg, tel, sel) => { if (tel) await pg.tap(sel); else await pg.click(sel); };
// La teinte RENDUE (h, s) d'une couleur CSS calculée — on juge la couleur, pas son nom.
const teinte = (rgb) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || ''); if (!m) return null;
  let [r, g, bb] = [m[1], m[2], m[3]].map((x) => Number(x) / 255);
  const mx = Math.max(r, g, bb), mn = Math.min(r, g, bb); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); if (mx === r) h = (g - bb) / d + (g < bb ? 6 : 0); else if (mx === g) h = (bb - r) / d + 2; else h = (r - g) / d + 4; h *= 60; }
  return { h, s };
};
const famille = (t) => (!t || t.s < 0.3 ? 'neutre' : (t.h >= 90 && t.h <= 160 ? 'vert' : (t.h >= 20 && t.h <= 50 ? 'ambre' : ((t.h >= 345 || t.h <= 12) ? 'rouge' : 'autre'))));
const lireRetour = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-inv-retour]'); if (!el) return null;
  const t = el.querySelector('.vrm-inv-retour-t');
  return { etat: el.getAttribute('data-inv-retour'), couleur: t ? getComputedStyle(t).color : '', texte: el.innerText.replace(/\s+/g, ' ') };
});
async function taper(pg, tel, txt, { ok = false } = {}) {
  await pg.fill('[data-inv-champ]', txt);
  if (ok) await toucher(pg, tel, '[data-inv-valider]'); else await pg.press('[data-inv-champ]', 'Enter');
  await pg.waitForTimeout(250);
}
// Ce qui est sous le centre d'un élément (un geste refusé dit QUI le couvre : un banc rapporte).
const dessous = (pg, sel) => pg.locator(sel).first().evaluate((el) => {
  const vu = getComputedStyle(el); const fs = el.closest(".vrm-fs"); const tf = fs ? getComputedStyle(fs).transform : "";
  const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const h = document.elementFromPoint(x, y);
  return `${Math.round(x)},${Math.round(y)} ⇒ ${h ? (h.tagName + '.' + String(h.className || '').slice(0, 60) + ' ' + [...h.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name).join(' ')) : 'rien'}${h && (h === el || el.contains(h)) ? ' (lui-même)' : ''}`
  + ` · vh ${window.innerHeight} · top ${Math.round(r.top)} h ${Math.round(r.height)} · ${vu.visibility}/${vu.pointerEvents} · feuille ${tf}`; }, null, { timeout: 3000 });
async function cliquer(pg, tel, sel, timeout = 30000) {
  try { if (tel) await pg.tap(sel, { timeout }); else await pg.click(sel, { timeout }); }
  catch (e) { throw new Error(`${sel} : ${String(e && e.message).split('\n')[0]} — sous le doigt : ${await dessous(pg, sel).catch(() => '?')}`); }
}
async function ouvrirInventaire(pg, tel) {
  await pg.waitForSelector('[data-stock-inventaire-ouvrir]', { timeout: 25000 });
  await pg.waitForTimeout(800);
  await cliquer(pg, tel, '[data-stock-inventaire-ouvrir]');
  await pg.waitForSelector('[data-inventaire]', { timeout: 10000 });
}

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).split('\n')[0].slice(0, 300)); } };
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    // BANC_SEUL=390|1512 : une seule largeur (pour chercher un défaut).
    const tailles = process.env.BANC_SEUL === '390' ? [true] : (process.env.BANC_SEUL === '1512' ? [false] : [true, false]);
    for (const tel of tailles) for (const sombre of [false, true]) {
      const t = `${tel ? '390 tactile' : '1512 souris'} ${sombre ? 'sombre' : 'clair'}`;
      const nomShot = (x) => (tel ? '390' : '1512') + (sombre ? '-sombre' : '-clair') + '-' + x;
      const base = nouvelleBase();
      await essaie(t + ' A-B-C-D', async () => {
        let { ctx, pg, errs } = await rendre(b, { tel, sombre, tab: 'garage', base });
        await ouvrirInventaire(pg, tel);
        await pg.waitForSelector('[data-inv-commencer]:not([disabled])', { timeout: 25000 });
        const att = await pg.evaluate(() => { const el = document.querySelector('[data-inv-lecture]'); return el ? { l: el.getAttribute('data-inv-lecture'), n: el.getAttribute('data-inv-attendus'), txt: el.innerText } : null; });
        dit(att && att.l === 'ok' && /compte_pas_lu/.test(att.txt), `${t} : A — l'accueil dit les paires attendues et NOMME le compte pas lu`, JSON.stringify(att));
        await shot(pg, nomShot('accueil'));
        await toucher(pg, tel, '[data-inv-commencer]');
        await pg.waitForSelector('[data-inv-champ]', { timeout: 8000 });
        const focus = await pg.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-inv-champ'));
        const im = await pg.getAttribute('[data-inv-champ]', 'inputmode');
        dit(im === 'numeric', `${t} : A — clavier numérique (inputmode=numeric)${focus ? ', champ prêt' : ''}`, im);
        await taper(pg, tel, '1');
        let r = await lireRetour(pg);
        dit(r && r.etat === 'attendu' && famille(teinte(r.couleur)) === 'vert', `${t} : A — « 1 » + Entrée ⇒ VERT « attendu »`, JSON.stringify(r));
        await taper(pg, tel, '007', { ok: true });
        r = await lireRetour(pg);
        dit(r && r.etat === 'vendu' && famille(teinte(r.couleur)) === 'ambre' && /N°7/.test(r.texte), `${t} : A — « 007 » + OK ⇒ N°7, AMBRE « vendu — à sortir »`, JSON.stringify(r));
        await shot(pg, nomShot('vendu'));
        await taper(pg, tel, '125');
        r = await lireRetour(pg);
        dit(r && r.etat === 'passu' && /N°125/.test(r.texte) && famille(teinte(r.couleur)) === 'neutre', `${t} : A — « 125 » n'est PAS B125 ; un compte n'est pas lu ⇒ « pas su », neutre (jamais « en trop »)`, JSON.stringify(r));
        await taper(pg, tel, '60');
        r = await lireRetour(pg);
        dit(r && r.etat === 'trop' && famille(teinte(r.couleur)) === 'ambre', `${t} : A — « 60 » (numérotée, plus en annonce, son compte lu) ⇒ AMBRE « en trop »`, JSON.stringify(r));
        await toucher(pg, tel, '.vrm-inv-abc');
        const im2 = await pg.getAttribute('[data-inv-champ]', 'inputmode');
        await taper(pg, tel, 'b125');
        r = await lireRetour(pg);
        dit(im2 === 'text' && r && r.etat === 'attendu' && /B125/.test(r.texte), `${t} : A — « ABC » puis « b125 » ⇒ B125 attendue`, JSON.stringify({ im2, r }));
        await taper(pg, tel, '2');
        r = await lireRetour(pg);
        dit(r && r.etat === 'doublon' && famille(teinte(r.couleur)) === 'rouge', `${t} : A — « 2 » (portée par deux paires) ⇒ ROUGE, le seul`, JSON.stringify(r));
        await shot(pg, nomShot('doublon'));
        await taper(pg, tel, '9999');
        await toucher(pg, tel, '[data-inv-annuler]');
        await pg.waitForTimeout(300);
        r = await lireRetour(pg);
        const nApres = await pg.getAttribute('[data-inv-vue="saisie"]', 'data-inv-n');
        dit(r && r.etat === 'annule' && nApres === '6', `${t} : A — « Annuler » retire N°9999 (6 N° vus : 1, 7, 125, 60, B125, 2)`, JSON.stringify({ r, nApres }));
        await taper(pg, tel, '1');
        r = await lireRetour(pg);
        dit(r && r.etat === 'deja', `${t} : A — « 1 » une 2ᵉ fois ⇒ « déjà compté », rien de plus`, JSON.stringify(r));
        // Les couleurs des autres états : jamais rouge hors doublon.
        const rouges = await pg.evaluate(() => [...document.querySelectorAll('[data-inv-ligne]')].filter((li) => li.getAttribute('data-inv-etat') !== 'doublon').map((li) => getComputedStyle(li.querySelector('.vrm-inv-point')).backgroundColor));
        dit(rouges.every((c) => famille(teinte(c)) !== 'rouge'), `${t} : A — aucun point rouge hors du doublon`, rouges.join(' '));
        await shot(pg, nomShot('saisie'));
        await pg.waitForFunction(() => { const el = document.querySelector('[data-inv-sync]'); return el && el.getAttribute('data-inv-sync') === 'ok'; }, null, { timeout: 10000 }).catch(() => {});
        const sy = await pg.getAttribute('[data-inv-sync]', 'data-inv-sync');
        dit(sy === 'ok' && base.ligne && base.ligne.courant && Number(base.ligne.rev) >= 1, `${t} : B — enregistré dans la ligne vrm_inventaire (rev ${base.ligne && base.ligne.rev})`, sy);
        const large = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(large <= 1, `${t} : F — pas de défilement horizontal (inventaire)`, String(large));
        // B — rechargement : même appareil.
        await pg.reload({ waitUntil: 'domcontentloaded' });
        await ouvrirInventaire(pg, tel);
        await pg.waitForSelector('[data-inv-vue="saisie"]', { timeout: 10000 }).catch(() => {});
        const n1 = await pg.getAttribute('[data-inv-vue="saisie"]', 'data-inv-n').catch(() => null);
        dit(n1 === '6', `${t} : B — après rechargement, l'inventaire reprend (6 N° vus)`, String(n1));
        dit(errs.length === 0, `${t} : F — aucune erreur de page (saisie)`, errs.join(' | ').slice(0, 300));
        await ctx.close();
        // D — Ma journée (un AUTRE appareil : stockage vide, la ligne seule).
        ({ ctx, pg, errs } = await rendre(b, { tel, sombre, tab: 'journee', base, vide: true }));
        await pg.waitForSelector('[data-job="inventaire-en-cours"]', { timeout: 30000 }).catch(() => {});
        const job = await pg.evaluate(() => { const el = document.querySelector('[data-job="inventaire-en-cours"]'); return el ? { n: el.getAttribute('data-n'), txt: el.innerText.replace(/\s+/g, ' ') } : null; });
        dit(job && job.n === '6', `${t} : D — Ma journée (autre appareil) : « Inventaire en cours », 6 N° vus`, JSON.stringify(job));
        await shot(pg, nomShot('journee'));
        if (job) {
          await pg.evaluate(() => document.querySelector('[data-job="inventaire-en-cours"]').scrollIntoView({ block: 'center' }));
          await toucher(pg, tel, '[data-job="inventaire-en-cours"]');
          await pg.waitForSelector('[data-inv-vue="saisie"]', { timeout: 25000 }).catch(() => {});
          const n2 = await pg.getAttribute('[data-inv-vue="saisie"]', 'data-inv-n').catch(() => null);
          dit(n2 === '6', `${t} : B+D — « Inventaire en cours » ouvre le Stock sur l'inventaire, retrouvé par la LIGNE (6 N° vus)`, String(n2));
        }
        dit(errs.length === 0, `${t} : F — aucune erreur de page (Ma journée)`, errs.join(' | ').slice(0, 300));
        await ctx.close();
        // C — Terminer ⇒ le bilan, sur un AUTRE appareil (stockage vide : la ligne seule).
        // (Ma journée republie `vrm_stock_vendus` depuis SES ventes — le banc n'en sert
        // aucune : le bilan se juge sur le Stock, avec les données du banc.)
        ({ ctx, pg, errs } = await rendre(b, { tel, sombre, tab: 'garage', base, vide: true }));
        await ouvrirInventaire(pg, tel);
        await pg.waitForSelector('[data-inv-vue="saisie"]', { timeout: 25000 }).catch(() => {});
        const n3 = await pg.getAttribute('[data-inv-vue="saisie"]', 'data-inv-n').catch(() => null);
        dit(n3 === '6', `${t} : B — un autre appareil (stockage vide) retrouve l'inventaire par la ligne (6 N° vus)`, String(n3));
        await toucher(pg, tel, '[data-inv-terminer]');
        await pg.waitForTimeout(400);
        await pg.waitForSelector('button:has-text("Voir le bilan")', { timeout: 8000 });
        await pg.waitForTimeout(500);
        await cliquer(pg, tel, 'button:has-text("Voir le bilan")');
        await pg.waitForSelector('[data-inv-vue="bilan"]', { timeout: 8000 }).catch(() => {});
        const bil = await pg.evaluate(() => { const el = document.querySelector('[data-inv-vue="bilan"]'); if (!el) return null; const l = (s) => [...el.querySelectorAll(`[data-inv-section="${s}"] [data-inv-bilan]`)].map((x) => x.getAttribute('data-inv-bilan')); return { manque: l('manque'), trop: l('trop'), vendus: l('vendus'), doublons: l('doublons'), passu: l('passu'), lectures: (el.querySelector('[data-inv-lectures-manquent]') || {}).innerText || '' }; });
        dit(bil && bil.manque.join(',') === '3,40', `${t} : C — manquent : N°3 (Vinted) et N°40 (eBay) ; jamais N°30 (compte pas lu)`, JSON.stringify(bil && bil.manque));
        dit(bil && bil.trop.join(',') === '60' && bil.vendus.join(',') === '7' && bil.doublons.join(',') === '2' && bil.passu.join(',') === '125', `${t} : C — en trop : N°60 · vendue rangée : N°7 · deux paires : N°2 · pas su : 125`, JSON.stringify(bil));
        dit(bil && /compte_pas_lu/.test(bil.lectures), `${t} : C — le compte pas lu est NOMMÉ dans le bilan`, bil && bil.lectures);
        await shot(pg, nomShot('bilan'));
        const sortir = await pg.$('[data-inv-sortir="7"]');
        dit(!!sortir, `${t} : C — N°7 vendue rangée : « Je l'ai sortie » (le geste du Stock)`);
        const large2 = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(large2 <= 1, `${t} : F — pas de défilement horizontal (bilan)`, String(large2));
        dit(errs.length === 0, `${t} : F — aucune erreur de page (bilan)`, errs.join(' | ').slice(0, 300));
        const numsAvant = JSON.stringify(MAIN.vinted_annonce_numeros);
        const numsApres = await pg.evaluate(() => localStorage.getItem('vinted_annonce_numeros'));
        dit(numsApres === numsAvant, `${t} : C — aucun numéro changé par l'inventaire`);
        await ctx.close();
      });
      // E — la lecture de la ligne en panne : rien n'est écrit.
      await essaie(t + ' E', async () => {
        const bp = nouvelleBase(); bp.panne = true;
        const { ctx, pg, errs } = await rendre(b, { tel, sombre, tab: 'garage', base: bp });
        await ouvrirInventaire(pg, tel);
        await pg.waitForSelector('[data-inv-commencer]:not([disabled])', { timeout: 25000 });
        await toucher(pg, tel, '[data-inv-commencer]');
        await pg.waitForSelector('[data-inv-champ]', { timeout: 8000 });
        await taper(pg, tel, '3');
        await pg.waitForTimeout(1800);
        const sy = await pg.getAttribute('[data-inv-sync]', 'data-inv-sync');
        const local = await pg.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^vrm_inventaire_local_/.test(x)); return k ? localStorage.getItem(k) : null; });
        dit(sy === 'ko' && bp.ecritures === 0 && bp.lectures > 0 && /"k":"3"/.test(local || ''), `${t} : E — lecture en panne : AUCUNE écriture (${bp.ecritures}), la saisie gardée sur l'appareil, dit « pas encore enregistré »`, JSON.stringify({ sy, e: bp.ecritures, l: bp.lectures }));
        await shot(pg, nomShot('panne'));
        dit(errs.length === 0, `${t} : F — aucune erreur de page (panne)`, errs.join(' | ').slice(0, 300));
        await ctx.close();
      });
    }
  } finally {
    if (b) await b.close();
    srv.close();
  }
  console.log(ko ? `\n${ko} KO` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
})();
