// ── BANC : À CONFIRMER AVANT LA DATE LIMITE + LA VRAIE DATE D'ARRIVÉE (21 oct., 5.204)
// L'extension range dans `panel_a_confirmer` le « Confirmation nécessaire »
// (« Tout est OK ») lu dans une conversation Vinted, avec sa date limite ; et
// dans `panel_colis_relais` l'heure du MESSAGE d'arrivée (`arriveLe`).
// Formes MESURÉES sur sa base (lecture seule), valeurs INVENTÉES. Exige, à 390 px
// tactile et 1512 px :
//   · Achats : « N retours/achats à confirmer avant le … », le compte nommé UNE
//     fois (le même pour tous), le lien vers SA conversation, l'expirée écartée ;
//   · Ma journée : la ligne `data-job="a-confirmer"`, même nombre, compte nommé ;
//   · ligne illisible (522) ⇒ Achats dit « pas pu lire », Ma journée se tait —
//     jamais « rien à confirmer » ; ligne absente ⇒ rien ;
//   · un colis dont la conversation a donné l'heure d'arrivée ⇒ date SÛRE.
// `BANC_MUTATION=passu` : l'app lit une ligne illisible comme vide (doit rougir).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 8139);
let PANNE = false;

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const jourLocal = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const RELAIS_ST = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const ACHATS = [
  { transaction_id: 9501, conversation_id: 7201, title: 'Nike Cortez blanche taille 41', price: { amount: '40', currency_code: 'EUR' }, status: RELAIS_ST, transaction_user_status: 'needs_action', date: ilYa(9) },
];
const ARRIVE = ilYa(2);
const RELAIS = { '9501': { code: 'C44444', lieu: 'Tabac du Port, 4 Quai Gambetta, 35260 Cancale', arriveLe: ARRIVE, at: ilYa(0.1), url: 'https://www.vinted.fr/inbox/7201' } };
const LIM1 = MAINTENANT + 20 * 3600000, LIM2 = MAINTENANT + 40 * 3600000;
const isoParis = (ms) => { const p = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)); const g = (t) => p.find((x) => x.type === t).value; return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`; };
const A_CONFIRMER = {
  '8801': { tx: '8801', conv: '7701', uid: '111', quoi: 'retour', titre: 'Salomon XT-6 bleue (retour)', limiteMs: LIM2, limite: isoParis(LIM2), limiteTexte: 'x', url: 'https://www.vinted.fr/inbox/7701', at: ilYa(0.2), msgAt: ilYa(0.3) },
  '8802': { tx: '8802', conv: '7702', uid: '111', quoi: 'retour', titre: 'Adidas Samba noire (retour)', limiteMs: LIM1, limite: isoParis(LIM1), limiteTexte: 'x', url: 'https://www.vinted.fr/inbox/7702', at: ilYa(0.2), msgAt: ilYa(0.3) },
  '8803': { tx: '8803', conv: '7703', uid: '111', quoi: 'retour', titre: 'Expirée', limiteMs: MAINTENANT - 3600000, limite: 'x', url: 'https://www.vinted.fr/inbox/7703', at: ilYa(3), msgAt: ilYa(3) },
};
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
let ROWS = [];
const lignes = (avecConfirmer) => [
  { id: 'main', data: {} },
  { id: 'panel_colis_relais', data: RELAIS },
  ...(avecConfirmer ? [{ id: 'panel_a_confirmer', data: A_CONFIRMER }] : []),
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };

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
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function preparer(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), permissions: opts.clavierRefuse ? [] : ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (opts.clavierRefuse) await pg.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new DOMException('refusé', 'NotAllowedError')) }) }); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    if (PANNE && /panel_a_confirmer/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}


async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }]) {
      const T = vp.width + 'px';
      await essaie(T + ' lu', async () => {
        ROWS = lignes(true); PANNE = false;
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-a-confirmer]').first().waitFor({ timeout: 15000 });
        const bloc = await pg.evaluate(() => { const e = document.querySelector('[data-a-confirmer]'); return e && { n: e.getAttribute('data-a-confirmer'), lim: e.getAttribute('data-a-confirmer-limite'), t: e.innerText,
          liens: [...e.querySelectorAll('[data-confirmer-lien]')].map((a) => a.getAttribute('href')), tx: [...e.querySelectorAll('[data-confirmer-tx]')].map((x) => x.getAttribute('data-confirmer-tx')),
          haut: Math.min(...[...e.querySelectorAll('[data-confirmer-lien]')].map((a) => a.getBoundingClientRect().height)) }; });
        dit(bloc && bloc.n === '2', `${T} Achats : 2 à confirmer (l'expirée écartée)`, bloc && bloc.n);
        dit(bloc && /2 retours à confirmer avant le/.test(bloc.t), `${T} « 2 retours à confirmer avant le … »`, bloc && bloc.t.split('\n')[0]);
        dit(bloc && bloc.lim === isoParis(LIM1) && bloc.tx[0] === '8802', `${T} la plus proche en tête (la date affichée est la sienne)`, bloc && `${bloc.lim} ${bloc.tx}`);
        dit(bloc && bloc.liens.join(' ') === 'https://www.vinted.fr/inbox/7702 https://www.vinted.fr/inbox/7701', `${T} le lien vers SA conversation, sur chaque ligne`, bloc && bloc.liens.join(' '));
        dit(bloc && (bloc.t.match(/compte_banc/g) || []).length === 1, `${T} le compte nommé UNE fois (le même pour tous, §7)`, bloc && String((bloc.t.match(/compte_banc/g) || []).length));
        dit(bloc && bloc.haut >= 44, `${T} le lien se touche au doigt (≥ 44 px)`, bloc && String(bloc.haut));
        const arr = await pg.evaluate(() => { const c = [...document.querySelectorAll('[data-arrive-le]')].find((x) => /Cortez/.test((x.closest('.vrm-pickup-card') || x).innerText)); return c && { le: c.getAttribute('data-arrive-le'), sur: c.getAttribute('data-arrive-sur') }; });
        dit(arr && arr.sur === 'oui' && arr.le === jourLocal(ARRIVE), `${T} l'heure du message d'arrivée (conversation) = date SÛRE`, arr && `${arr.le} ${arr.sur}`);
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.locator('[data-job="a-confirmer"]').first().waitFor({ timeout: 15000 }).catch(() => {});
        const job = await pg.evaluate(() => { const e = document.querySelector('[data-job="a-confirmer"]'); return e && { n: e.getAttribute('data-n'), t: e.innerText, title: e.getAttribute('title') }; });
        dit(job && job.n === '2' && /à confirmer avant le/.test(job.t), `${T} Ma journée : « 2 retours à confirmer avant le … »`, job && job.t);
        dit(job && /compte_banc/.test(`${job.t} ${job.title}`), `${T} Ma journée nomme le compte`, job && job.title);
        if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, `a-confirmer-${vp.width}.png`), fullPage: true });
        dit(!errs.length, `${T} aucune erreur d'app`, errs[0]);
        await ctx.close();
      });
      await essaie(T + ' pas su', async () => {
        ROWS = lignes(true); PANNE = true;
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('.vrm-pickup-point').first().waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1200);
        const v = await pg.evaluate(() => { const e = document.querySelector('[data-a-confirmer]'); return e ? e.getAttribute('data-a-confirmer') : null; });
        dit(v === 'passu', `${T} ligne illisible ⇒ Achats dit « pas pu lire » (jamais « rien à confirmer »)`, String(v));
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2500);
        dit(!(await pg.locator('[data-job="a-confirmer"]').count()), `${T} ligne illisible ⇒ Ma journée n'affirme rien`);
        dit(!errs.length, `${T} aucune erreur d'app (pas su)`, errs[0]);
        await ctx.close();
      });
      await essaie(T + ' vide', async () => {
        ROWS = lignes(false); PANNE = false;
        const { ctx, pg, errs } = await preparer(b, vp);
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.locator('.vrm-pickup-point').first().waitFor({ timeout: 15000 });
        await pg.waitForTimeout(1200);
        dit(!(await pg.locator('[data-a-confirmer]').count()), `${T} rien à confirmer ⇒ aucun bloc`);
        dit(!errs.length, `${T} aucune erreur d'app (vide)`, errs[0]);
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ à confirmer / date d'arrivée : ${ko} rouge(s).` : `\n✅ à confirmer / date d'arrivée : tout est vert`);
  process.exit(ko ? 1 : 0);
}
main();
