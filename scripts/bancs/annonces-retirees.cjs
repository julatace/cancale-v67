// Banc : RETIRER POUR DE BON LES ANNONCES D'UN COMPTE BLOQUÉ PAR VINTED (26 octobre)
//
// Julien : « pour les annonces shop cancale je veux avoir la possibilité de les
// supprimer car ce compte est bloqué par Vinted et les annonces ne sont plus
// vendables ». Sur des données INVENTÉES (le dépôt est public), il exige :
//   1. un compte dans `vrm_annonces_retirees` n'a plus AUCUNE annonce sur l'écran
//      Annonces (une masquée par Vinted comprise), aux deux tailles ;
//   2. ni dans « Annonces en ligne » du tableau de bord, ni dans la file
//      Leboncoin de l'app — mais ses VENTES restent ;
//   3. l'autre sens : sans retrait, tout reste ;
//   4. le geste dans Comptes liés range le choix par identifiant de compte, la
//      carte le dit, et « Les remettre » l'annule.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 5761;

const now = Date.now();
const iso = (h) => new Date(now - h * 3600e3).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_bloque', domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(500) },
  { id: 2, vinted_user_id: '222', login: 'compte_vivant', domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(500) },
];
const ann = (id, title, o) => Object.assign({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false,
  photo: null, brand_title: 'Marque', size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, nPhotos: 4 }, o);
const dressing = (uid, items) => ({ id: `harvest_${uid}_listings`, data: { uid, capturedAt: new Date(now - 5 * 60e3).toISOString(), nItems: items.length,
  payload: { items, pagination: { total_entries: items.length, total_pages: 1 } } } });
// compte_bloque (111) : deux annonces dont une MASQUÉE par Vinted (elle compte d'ordinaire
// comme une paire présente), et une vente finalisée ; compte_vivant (222) : une annonce.
const ITEMS_111 = [ann(7001, 'Zeta Bloque Alpha 42'), ann(7002, 'Zeta Bloque Beta 41', { is_hidden: true })];
const VENTE_111 = { id: 'harvest_111_orders_sold', data: { uid: '111', capturedAt: new Date(now - 5 * 60e3).toISOString(), nItems: 1,
  payload: { my_orders: [{ transaction_id: 1110001, title: 'Zeta Vente Bloque', status: 'Commande finalisée', price: { amount: '30.0', currency_code: 'EUR' }, date: iso(30) }], pagination: { total_pages: 1 } } } };
const BASE = (retirees) => [
  { id: 'main', data: Object.assign({ vinted_annonce_numeros: { '7001': { numero: '11' }, '7002': { numero: '12' }, '8001': { numero: '21' } } },
    retirees ? { vrm_annonces_retirees: retirees } : {}) },
  dressing('111', ITEMS_111), dressing('222', [ann(8001, 'Zeta Vivant Delta 40')]), VENTE_111,
];
const RETIRE_111 = { '111': { at: iso(1), login: 'compte_bloque' } };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
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
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
// Les ponts d'extension, dans la vraie forme (`ping` → `ready {version[, id]}`).
// Par défaut UN pont à jour (les états « ok » de la phrase) ; `[]` : aucune
// extension (téléphone) ; deux ponts d'identifiants différents : deux extensions.
// La VRAIE forme de l'état (§6.3) : à partir de `CODE_DANS_ETAT` (lu dans la
// source), une extension joint `code` — sans lui, l'app la dit « périmée ».
const PONTS = ({ ponts, codeDansEtat }) => {
  const post = (m) => window.postMessage(m, '*');
  const vn = (v) => String(v || '').split('.').map((x) => parseInt(x, 10) || 0);
  const auMoins = (v, r) => { const a = vn(v), b = vn(r); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return true; };
  ponts.forEach((p) => {
    const ready = () => post(Object.assign({ __vmr: 'ready', version: p.version }, p.id ? { id: p.id } : {}));
    window.addEventListener('message', (e) => {
      const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
      if (d.__vmr === 'ping') ready();
      if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version: p.version, vrm: { ok: true, connecte: true, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' /* la session de banc (_porte-banc.cjs) */ }, vinted: null, cmds: {} }, codeDansEtat && auMoins(p.version, codeDansEtat) ? { code: p.version } : {}) });
    });
    ready();
  });
};
// « À jour » = la version que l'app ATTEND (EXT_ATTENDUE, lue dans la source) :
// une version écrite ici vieillirait au prochain numéro et ferait passer l'état
// « ok » pour « en retard » (la relecture des autres comptes arrive en 5.167).
const VERSION_A_JOUR = (fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8').match(/const EXT_ATTENDUE = '([\d.]+)'/) || [])[1];
const CODE_DANS_ETAT = (fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8').match(/const CODE_DANS_ETAT = '([\d.]+)'/) || [])[1] || '';
if (!VERSION_A_JOUR) { console.log('KO EXT_ATTENDUE introuvable dans src/App.jsx'); process.exit(1); }
const UN_PONT = [{ version: VERSION_A_JOUR, id: 'ext1' }];

async function rendre(b, { lignes, suppKO = false, tel = false, mobile, onglet = 'cat_annonces', etat = {}, ponts = UN_PONT, accs, section }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const mob = mobile === undefined ? tel : mobile;
  const ctx = await b.newContext({ viewport: vp, ...(mob ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(PONTS, { ponts, codeDansEtat: CODE_DANS_ETAT });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accs || ACCS);
    // La ligne des suppressions ILLISIBLE (522 Cloudflare, en HTML), la base debout par ailleurs.
    if ((suppKO || etat.suppKO) && /_supprimees/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    const L = etat.lignes || lignes;
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  // Le relais Vinted en panne : l'app ne doit vivre que de la moisson.
  await pg.route('**/api/**', (r) => (/vinted-proxy/.test(r.request().url())
    ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"erreur":"pas-su"}' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' })));
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  // Sous charge (plusieurs bancs à la fois), le premier rendu peut dépasser
  // 4,5 s : on attend que l'écran ait DIT quelque chose (une carte, le chiffre du
  // tableau de bord, la file) — au plus 25 s. Un écran qui ne rend jamais reste
  // rouge : l'attente ne cache rien, elle évite de mesurer la charge du banc.
  await pg.waitForFunction(() => document.querySelector('[data-carte-annonce]')
    || (document.querySelector('[data-dash-stat="online"]') && /\d/.test(document.querySelector('[data-dash-stat="online"]').innerText))
    || /Zeta/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(2000);
  if (section) { await pg.click(`[data-section="${section}"]`); await pg.waitForTimeout(2500); }
  return { ctx, pg, errs };
}
const lireAnnonces = (pg) => pg.evaluate(() => {
  const f = [...document.querySelectorAll('[data-ann-fraicheur]')];
  const el = f[0];
  return {
    cartes: [...document.querySelectorAll('[data-carte-annonce]')].map((x) => x.getAttribute('data-carte-annonce')).sort(),
    nFraicheur: f.length,
    vieux: el ? el.getAttribute('data-vieux') : null,
    supprimees: el ? el.getAttribute('data-supprimees') : null,
    promesse: el ? el.getAttribute('data-promesse') : null,
    ailleurs: el ? el.getAttribute('data-ailleurs') : null,
    // La coche « à jour » se reconnaît à ce qu'elle DIT (elle n'avait pas
    // d'attribut avant : un contrôle posé sur un attribut neuf serait vert par
    // accident sur le code d'avant).
    aJour: (document.body.innerText.match(/✓ (Données|Ventes) Vinted à jour/g) || []).length,
    texte: el ? el.innerText : '',
    couleurs: el ? [...el.querySelectorAll('*')].concat([el]).map((x) => getComputedStyle(x).color) : [],
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});
const lireDash = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-dash-stat="online"]');
  const f = [...document.querySelectorAll('[data-dash-fraicheur]')];
  return { online: s ? (s.innerText.match(/\d+/) || [null])[0] : null, nFraicheur: f.length,
    vieux: f[0] ? f[0].getAttribute('data-vieux') : null, supprimees: f[0] ? f[0].getAttribute('data-supprimees') : null, texte: f[0] ? f[0].innerText : '' };
});


(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 900)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [false, true]) {
      const t = tel ? '390 px' : '1512 px';
      console.log(`── 1. ${t} — annonces de compte_bloque retirées pour de bon`);
      await essaie('1 ' + t, async () => {
        const r = await rendre(b, { lignes: BASE(RETIRE_111), tel });
        const a = await lireAnnonces(r.pg);
        dit(!a.cartes.includes('7001') && !a.cartes.includes('7002'), `${t} : aucune annonce du compte retiré sur l’écran Annonces (masquée comprise)`, JSON.stringify(a.cartes));
        dit(a.cartes.includes('8001'), `${t} : l’autre compte garde la sienne`, JSON.stringify(a.cartes));
        dit(a.sw <= a.cw + 1, `${t} : aucun débordement`, `${a.sw} > ${a.cw}`);
        dit(r.errs.length === 0, `${t} : aucune erreur d’app`, r.errs.join(' | ').slice(0, 160));
        await r.ctx.close();
      });
    }
    console.log('── 2. Tableau de bord, file Leboncoin, ventes');
    await essaie('2', async () => {
      const r = await rendre(b, { lignes: BASE(RETIRE_111), onglet: 'dashboard' });
      await r.pg.waitForTimeout(1500);
      const d = await lireDash(r.pg);
      dit(d.online === '1', '« Annonces en ligne » compte 1 (8001), pas 2', JSON.stringify(d));
      await r.ctx.close();
      const r2 = await rendre(b, { lignes: BASE(RETIRE_111), onglet: 'leboncoin' });
      await r2.pg.waitForTimeout(1500);
      const txt = await r2.pg.evaluate(() => document.body.innerText);
      dit(!/Zeta Bloque/.test(txt) && /Zeta Vivant Delta/.test(txt), 'la file Leboncoin ne propose plus les annonces retirées, l’autre oui', (txt.match(/Zeta [A-Za-z]+ [A-Za-z]+/g) || []).join(' · '));
      await r2.ctx.close();
      const r3 = await rendre(b, { lignes: BASE(RETIRE_111), onglet: 'cat_ventes' });
      await r3.pg.waitForFunction(() => /Zeta Vente Bloque/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
      const v = await r3.pg.evaluate(() => document.body.innerText);
      dit(/Zeta Vente Bloque/.test(v), 'ses VENTES restent (seules les annonces sont retirées)', '');
      await r3.ctx.close();
    });
    console.log('── 3. L’autre sens : rien de retiré, tout reste');
    await essaie('3', async () => {
      const r = await rendre(b, { lignes: BASE(null) });
      const a = await lireAnnonces(r.pg);
      dit(a.cartes.includes('7001') && a.cartes.includes('8001'), 'sans retrait, les annonces des deux comptes sont là', JSON.stringify(a.cartes));
      await r.ctx.close();
    });
    console.log('── 4. Le geste, dans Comptes liés : retirer, puis remettre');
    await essaie('4', async () => {
      const r = await rendre(b, { lignes: BASE(null), onglet: 'vintedaccounts' });
      await r.pg.waitForFunction(() => /compte_vivant/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
      const cartes = r.pg.locator('button', { hasText: 'Supprimer des données…' });
      dit(await cartes.count() === 2, 'deux comptes, deux boutons « Supprimer des données… »', String(await cartes.count()));
      // Le premier compte affiché : on ouvre sa fenêtre, on retire ses annonces.
      // Le bouton vit dans le repli « Gérer ce compte » de la carte : on l'ouvre comme lui.
      await r.pg.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
      await cartes.first().click();
      await r.pg.locator('[data-retirer-annonces]').click();
      await r.pg.getByRole('button', { name: 'Retirer ses annonces', exact: true }).click();
      await r.pg.waitForTimeout(800);
      const m = await r.pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_annonces_retirees') || 'null'); } catch (_) { return 'illisible'; } });
      const uid = m && typeof m === 'object' ? Object.keys(m)[0] : null;
      dit(uid === '111' || uid === '222', 'le choix est rangé (clé synchronisée vrm_annonces_retirees), par identifiant de compte', JSON.stringify(m));
      dit(await r.pg.locator(`[data-annonces-retirees="${uid}"]`).count() === 1, 'la carte du compte le dit, avec « Les remettre »', '');
      await r.pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
      await r.pg.waitForFunction(() => document.querySelector('[data-carte-annonce]'), null, { timeout: 25000 }).catch(() => {});
      await r.pg.waitForTimeout(2000);
      const a = await lireAnnonces(r.pg);
      const sienne = uid === '111' ? ['7001', '7002'] : ['8001'];
      dit(sienne.every((id) => !a.cartes.includes(id)) && a.cartes.length > 0, 'ses annonces ont quitté l’écran Annonces, les autres restent', JSON.stringify(a.cartes));
      await r.pg.goto(`http://localhost:${PORT}/?tab=vintedaccounts`, { waitUntil: 'domcontentloaded' });
      await r.pg.waitForFunction((u) => document.querySelector(`[data-annonces-retirees="${u}"]`), uid, { timeout: 15000 }).catch(() => {});
      await r.pg.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
      await r.pg.locator(`[data-annonces-retirees="${uid}"] button`).click();
      await r.pg.waitForTimeout(500);
      const m2 = await r.pg.evaluate(() => JSON.parse(localStorage.getItem('vrm_annonces_retirees') || '{}'));
      dit(!Object.keys(m2).length, '« Les remettre » : plus aucun compte retiré', JSON.stringify(m2));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 900)); }
  finally { if (b) await b.close().catch(() => {}); srv.close(); }
  console.log(ko ? `\n❌ annonces retirées : ${ko} rouge(s)` : '\n✅ annonces retirées : tout est vert');
  process.exit(ko ? 1 : 0);
})();
