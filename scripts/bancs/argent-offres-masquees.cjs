// ── BANC : OFFRES VESTIAIRE · PORTE-MONNAIE · MASQUÉES (4 nov., extension 5.319)
// Données INVENTÉES (le dépôt est public), à la forme des lignes rangées par
// l'extension (`vc_offres`, `vc_offres_recette`, `harvest_{uid}_billing` sous ses
// deux formes mesurées, `harvest_{uid}_listings` avec `is_hidden`). Exige, à
// 390 px tactile et 1512 px, en clair ET en sombre :
//   · Messages · Vestiaire : l'offre à trancher (prix, ce que tu touches), un geste
//     n'existe que s'il est APPRIS (sinon « Répondre sur Vestiaire ↗ ») ; Accepter
//     demande une confirmation ; UNE commande `vcOffre` part sur SON second toucher ;
//     une contre-offre hors bornes ne part pas ; une extension d'avant la 5.319 ne
//     propose aucun geste ; la conversation de l'article montre l'offre ;
//   · Compta → Porte-monnaie : une ligne par compte (disponible, en attente, quand),
//     « — » pour un compte jamais lu, « à confirmer » au-delà de 24 h, l'écarté
//     nommé hors total ;
//   · Annonces → « Masquées » : par compte, le lien Vinted, « à confirmer » au-delà
//     de 24 h ; la masquée n'entre pas dans « en ligne ».
//   · rien ne déborde, cibles de 44 px, aucune erreur d'app.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4397);
const CAP = process.env.SHOTS || path.join(os.tmpdir(), 'vrm-bancs');
const now = Date.now();
const iso = (h) => new Date(now - h * 3600e3).toISOString();
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + String(d).slice(0, 300) : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8');
const VERSION = (APP.match(/const EXT_ATTENDUE = '([\d.]+)'/) || [])[1] || '0';

const ACCS = [
  { id: 1, vinted_user_id: '101', login: 'alpha_shop', domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(500) },
  { id: 2, vinted_user_id: '202', login: 'beta_shop', domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(500) },
  { id: 3, vinted_user_id: '303', login: 'gamma_shop', domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(500) },
  { id: 4, vinted_user_id: '404', login: 'delta_shop', domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(500) },
];
const eur = (c) => ({ cents: c, currency: 'EUR', formatted: '' });
const offre = (id, o) => Object.assign({ id, produit: '60001', compte: '777', ouverte: true, fermee: false, acceptee: false, aToi: true, titre: 'Nike Baskets Zeta Dunk', photo: '', lien: 'https://fr.vestiairecollective.com/men-shoes/nike-baskets-60001.shtml',
  offre: 20000, net: 16000, initial: 24900, min: 17500, expire: iso(-10), resteVendeur: 2, dernier: { action: 'offer', par: 'acheteur', cents: 20000, at: iso(2) }, evenements: [{ action: 'offer', par: 'acheteur', cents: 20000, at: iso(2) }] }, o || {});
const ann = (id, title, o) => Object.assign({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: 'Marque', size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, nPhotos: 4 }, o);
const dressing = (uid, items, h) => ({ id: `harvest_${uid}_listings`, data: { uid, capturedAt: iso(h), nItems: items.length, payload: { items, pagination: { total_entries: items.length, total_pages: 1 } } } });
const LIGNES = [
  { id: 'main', data: { vinted_annonce_numeros: { '7001': { numero: '11' }, '7002': { numero: '12' }, '7003': { numero: '13' }, '8001': { numero: '21' } }, vinted_accounts_hidden: [] } },
  dressing('101', [ann(7001, 'Zeta Alpha En Ligne'), ann(7002, 'Zeta Alpha Masquee', { is_hidden: true }), ann(7003, 'Zeta Alpha Masquee Deux', { is_hidden: true })], 0.2),
  dressing('202', [ann(8001, 'Zeta Beta Masquee', { is_hidden: true })], 30),
  { id: 'harvest_101_billing', data: { uid: '101', capturedAt: iso(1), payload: { main: { amount: '12.5', currency_code: 'EUR' }, escrow: { amount: '115.0', currency_code: 'EUR' } } } },
  { id: 'harvest_202_billing', data: { uid: '202', capturedAt: iso(30), payload: { balance: { amount: '38.0' }, pending_balance: { amount: '107.0' }, invoice_lines: [{ id: 91, entity_type: 'payout', amount: { amount: '-54.0' }, date: iso(40), pending: true, title: 'Transfert' }] } } },
  { id: 'harvest_404_billing', data: { uid: '404', capturedAt: iso(1), payload: { main: { amount: '500.0' }, escrow: { amount: '0.0' } } } },
  { id: 'harvest_101_releve_2026-10', data: { uid: '101', mois: '2026-10', lignes: [{ id: '77', quoi: 'payout', montant: -108, date: iso(500) }] } },
  { id: 'vc_messages', data: { compteur: { messages: 1, at: iso(0.3), compte: '777' }, conversations: { 'C9001': { productId: '60001', ref: '', nonLu: true, date: iso(1), apercu: 'Vous acceptez 200 € ?', apercuDeMoi: false, titre: 'Nike Baskets Zeta Dunk', photo: '', source: 'notifications', compte: '777' } }, lecture: { at: iso(0.3), total: 1, complet: true, page: '/chat/' } } },
  { id: 'vc_listings', data: { items: {}, liens: {}, capturedAt: iso(1), complet: true, total: 0 } },
  { id: 'vc_offres', data: { v: 1, offres: { n1001: offre('1001'), n1002: offre('1002', { produit: '60002', titre: 'Gucci Cabas Zeta', aToi: false, dernier: { action: 'offer', par: 'vendeur', cents: 23700, at: iso(3) } }), n1003: offre('1003', { produit: '60003', expire: iso(1) }) }, lecture: { at: iso(0.3) }, capturedAt: iso(0.3) } },
  { id: 'vc_offres_recette', data: { accepter: { appris: true, raison: '', at: iso(20) }, contre: { appris: true, raison: '', at: iso(20) }, refuser: { appris: false, raison: 'valeur-inconnue', at: iso(20) } } },
];
const projette = (row, sel) => {
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
const PONT = ({ version }) => {
  window.__cmds = [];
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }, vinted: null, cmds: {}, vcOffre: true } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(JSON.stringify(Object.fromEntries(Object.entries(d).filter(([k]) => !['__vmr', 'reqId'].includes(k)))));
      const resp = d.cmd === 'vcOffre' ? { accepte: true, etape: 'fait', statut: 200 } : { accepte: false, code: 'inconnue', raison: 'commande inconnue' };
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp }), 120);
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};
async function ouvrir(b, vp, sombre, url, { version = VERSION, lignes = LIGNES } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', s ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(lignes.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
}
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const cmds = (pg) => pg.evaluate(() => window.__cmds.map((x) => JSON.parse(x)).filter((x) => x.cmd === 'vcOffre'));

(async () => {
  let b;
  try {
    fs.mkdirSync(CAP, { recursive: true });
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server', '--use-angle=swiftshader'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 900 }]) for (const sombre of [false, true]) {
      const T = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`;
      // ── 1. Messages · Vestiaire : les offres ─────────────────────────────
      console.log(`── ${T} — Messages · Vestiaire, offres`);
      {
        const { ctx, pg, errs } = await ouvrir(b, vp, sombre, '?tab=messages&site=vestiaire');
        await pg.waitForSelector('[data-vc-offres]', { timeout: 20000 }).catch(() => {});
        const o = await pg.evaluate(() => { const s = document.querySelector('[data-vc-offres]'); const c = document.querySelector('[data-vc-offre="1001"]'); return s ? { n: s.getAttribute('data-vc-offres'), w: s.getAttribute('data-vc-offres-attente'), cartes: [...document.querySelectorAll('[data-vc-offre]')].map((x) => x.getAttribute('data-vc-offre')), prets: c && c.getAttribute('data-vc-offre-prets'), ailleurs: c && (c.querySelector('[data-vc-offre-ailleurs]') || {}).getAttribute && c.querySelector('[data-vc-offre-ailleurs]').getAttribute('data-vc-offre-ailleurs'), lien: c && c.querySelector('[data-vc-offre-ailleurs]') && c.querySelector('[data-vc-offre-ailleurs]').getAttribute('href'), cents: c && c.querySelector('[data-vc-offre-cents]').getAttribute('data-vc-offre-cents'), t: c && c.innerText, tag: (document.querySelector('[data-vc-conv-offre]') || {}).textContent || '', dark: document.documentElement.getAttribute('data-theme') } : null; });
        dit(o && o.n === '1' && o.w === '1' && o.cartes.join() === '1001', 'une offre à trancher (l’expirée n’y est pas), ta contre-offre en attente à part', JSON.stringify(o && { n: o.n, w: o.w, c: o.cartes }));
        dit(o && o.cents === '20000' && /200\s*€/.test(o.t) && /tu touches 160\s*€/.test(o.t) && /prix 249\s*€/.test(o.t), 'l’offre (200 €), ton prix, ce que tu touches', o && o.t);
        dit(o && o.prets === 'accepter,contre' && o.ailleurs === 'refuser:pas-sur' && /60001\.shtml$/.test(o.lien || ''), 'seuls les gestes APPRIS sont proposés ; « Refuser » pas sûr ⇒ « Répondre sur Vestiaire ↗ »', JSON.stringify(o && { p: o.prets, a: o.ailleurs }));
        dit(o && /offre 200\s*€/.test(o.tag), 'la conversation de l’article montre l’offre', o && o.tag);
        dit(o && (o.dark === 'dark') === sombre, `thème ${sombre ? 'sombre' : 'clair'} appliqué`, o && o.dark);
        const h = await pg.evaluate(() => [...document.querySelectorAll('[data-vc-offre="1001"] button, [data-vc-offre="1001"] a')].map((x) => Math.round(x.getBoundingClientRect().height)));
        dit(h.length >= 3 && h.every((x) => x >= 44), 'chaque geste se touche au doigt (44 px)', JSON.stringify(h));
        await pg.screenshot({ path: path.join(CAP, `argent-offres-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`) });
        await pg.click('[data-vc-offre="1001"] [data-vc-offre-geste="accepter"]');
        await pg.waitForTimeout(250);
        const c0 = await cmds(pg);
        const conf = await pg.evaluate(() => { const x = document.querySelector('[data-vc-offre="1001"] [data-vc-offre-geste="accepter"]'); return x ? { c: x.getAttribute('data-vc-offre-confirme'), t: x.textContent } : null; });
        dit(c0.length === 0 && conf && conf.c === '1' && /Confirmer/.test(conf.t), 'un premier toucher sur « Accepter » demande confirmation : RIEN ne part', JSON.stringify({ c0, conf }));
        await pg.click('[data-vc-offre="1001"] [data-vc-offre-geste="accepter"]');
        await pg.waitForSelector('[data-vc-offre-resultat]', { timeout: 8000 }).catch(() => {});
        const c1 = await cmds(pg);
        const res = await pg.evaluate(() => { const x = document.querySelector('[data-vc-offre-resultat]'); return x ? { ton: x.getAttribute('data-vc-offre-resultat'), t: x.textContent } : null; });
        dit(c1.length === 1 && c1[0].nego === '1001' && c1[0].geste === 'accepter' && c1[0].prixCents === undefined, 'sur SON second toucher : UNE commande `vcOffre { nego, geste }`', JSON.stringify(c1));
        dit(res && res.ton === 'ok' && /acceptée/.test(res.t), 'le résultat est dit', JSON.stringify(res));
        await pg.click('[data-vc-offre="1001"] [data-vc-offre-geste="contre"]');
        await pg.fill('[data-vc-offre="1001"] [data-vc-offre-contre] input', '200');
        const dis = await pg.evaluate(() => { const x = document.querySelector('[data-vc-offre-envoyer]'); return x ? x.disabled : null; });
        dit(dis === true, 'une contre-offre qui n’est pas au-dessus de son offre ne peut pas partir', String(dis));
        await pg.fill('[data-vc-offre="1001"] [data-vc-offre-contre] input', '230');
        await pg.click('[data-vc-offre-envoyer]');
        await pg.waitForTimeout(600);
        const c2 = await cmds(pg);
        dit(c2.length === 2 && c2[1].geste === 'contre' && c2[1].prixCents === 23000, 'la contre-offre part sur son clic, en centimes', JSON.stringify(c2[1]));
        const r = await deborde(pg); dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | '));
        await ctx.close();
      }
      // ── 2. Compta → Porte-monnaie ────────────────────────────────────────
      console.log(`── ${T} — Compta → Porte-monnaie`);
      {
        const lignes = LIGNES.map((x) => (x.id === 'main' ? { id: 'main', data: Object.assign({}, x.data, { vinted_accounts_hidden: ['404'] }) } : x));
        const { ctx, pg, errs } = await ouvrir(b, vp, sombre, '?tab=compta', { lignes });
        await pg.waitForSelector('#compta-porte-monnaie', { state: 'attached', timeout: 25000 }).catch(() => {});
        await pg.evaluate(() => { const d = document.getElementById('compta-porte-monnaie'); if (d) d.scrollIntoView({ block: 'center' }); });
        await pg.click('#compta-porte-monnaie > summary', { timeout: 15000 }).catch(() => {});
        await pg.waitForSelector('[data-pm="lu"]', { timeout: 15000 }).catch(() => {});
        const pm = await pg.evaluate(() => { const e = document.querySelector('[data-pm]'); if (!e) return null; const L = Object.fromEntries([...e.querySelectorAll('[data-pm-compte]')].map((x) => [x.getAttribute('data-pm-compte'), { t: x.innerText, j: x.getAttribute('data-pm-jamais'), v: x.getAttribute('data-pm-vieux') }]));
          return { etat: e.getAttribute('data-pm'), dispo: e.getAttribute('data-pm-dispo'), att: e.getAttribute('data-pm-attente'), manque: e.getAttribute('data-pm-manque'), exclus: (e.querySelector('[data-pm-exclus]') || {}).textContent || '', L, vir: (e.querySelector('[data-pm-virements]') || { getAttribute: () => '' }).getAttribute('data-pm-virements'), t: e.innerText }; });
        dit(pm && pm.etat === 'lu' && pm.dispo === '50.5' && pm.att === '222', 'le total : les comptes sélectionnés lus (12,50 + 38 · 115 + 107)', JSON.stringify(pm && { d: pm.dispo, a: pm.att }));
        dit(pm && pm.L['101'] && /12,50\s*€/.test(pm.L['101'].t) && /115,00\s*€/.test(pm.L['101'].t) && pm.L['202'] && pm.L['202'].v === '1' && /à confirmer/.test(pm.L['202'].t), 'une ligne par compte ; une lecture de plus de 24 h est « à confirmer »', JSON.stringify(pm && pm.L));
        dit(pm && pm.L['303'] && pm.L['303'].j === '1' && /—/.test(pm.L['303'].t) && /jamais lu/.test(pm.L['303'].t) && pm.manque === 'gamma_shop' && /au moins/.test(pm.t), 'un compte jamais lu : « — » (jamais 0) et le total dit « au moins »', JSON.stringify(pm && pm.L['303']));
        dit(pm && !pm.L['404'] && /Hors total : delta_shop/.test(pm.exclus), 'le compte écarté est nommé hors total', pm && pm.exclus);
        dit(pm && pm.vir === '2', 'les virements vers la banque (relevé et mois courant)', pm && pm.vir);
        await pg.evaluate(() => { const d = document.getElementById('compta-porte-monnaie'); if (d) d.scrollIntoView({ block: 'start' }); });
        await pg.screenshot({ path: path.join(CAP, `argent-porte-monnaie-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`) });
        const r = await deborde(pg); dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | '));
        await ctx.close();
      }
      // ── 3. Annonces → Masquées ───────────────────────────────────────────
      console.log(`── ${T} — Annonces → Masquées`);
      {
        const { ctx, pg, errs } = await ouvrir(b, vp, sombre, '?tab=cat_annonces');
        await pg.waitForSelector('[data-vue-masquees]', { timeout: 25000 }).catch(() => {});
        const bouton = await pg.evaluate(() => { const x = document.querySelector('[data-vue-masquees]'); return x ? { n: x.getAttribute('data-vue-masquees'), h: Math.round(x.getBoundingClientRect().height) } : null; });
        dit(bouton && bouton.n === '3', 'la vue rapide « Masquées » compte les 3 masquées', JSON.stringify(bouton));
        await pg.click('[data-vue-masquees]').catch(() => {});
        await pg.waitForSelector('[data-masquees-vue="lu"]', { timeout: 10000 }).catch(() => {});
        const m = await pg.evaluate(() => { const e = document.querySelector('[data-masquees-vue]'); if (!e) return null; return { n: e.getAttribute('data-masquees-n'), ac: e.getAttribute('data-masquees-a-confirmer'), comptes: [...e.querySelectorAll('[data-masquees-compte]')].map((x) => x.getAttribute('data-masquees-compte') + ':' + x.getAttribute('data-masquees-compte-n')), lien: (e.querySelector('[data-masquee-lien="7002"]') || {}).href || '', t: e.innerText, h: [...e.querySelectorAll('[data-masquee-lien]')].map((x) => Math.round(x.getBoundingClientRect().height)), cartes: document.querySelectorAll('.vrm-ann-grid [data-carte-annonce]').length }; });
        dit(m && m.n === '3' && m.comptes.join() === '101:2,202:1', 'par compte : alpha 2, beta 1', JSON.stringify(m && m.comptes));
        dit(m && m.lien === 'https://www.vinted.fr/items/7002/edit' && /N°12/.test(m.t), 'le N° et le lien pour corriger l’annonce sur Vinted', m && m.lien);
        dit(m && m.ac === '1' && /à confirmer/.test(m.t), 'une lecture de plus de 24 h ⇒ « à confirmer »', m && m.ac);
        dit(m && m.h.length === 3 && m.h.every((x) => x >= 44) && m.cartes === 0, 'liens de 44 px ; la grille des annonces en ligne laisse la place', JSON.stringify(m && { h: m.h, c: m.cartes }));
        await pg.screenshot({ path: path.join(CAP, `argent-masquees-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`) });
        const r = await deborde(pg); dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | '));
        await ctx.close();
      }
    }
    console.log('── 390 px — extension d’avant la 5.319');
    {
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, false, '?tab=messages&site=vestiaire', { version: '5.318.0' });
      await pg.waitForSelector('[data-vc-offres]', { timeout: 20000 }).catch(() => {});
      const o = await pg.evaluate(() => { const c = document.querySelector('[data-vc-offre="1001"]'); return c ? { prets: c.getAttribute('data-vc-offre-prets'), btn: c.querySelectorAll('[data-vc-offre-geste]').length, ail: (c.querySelector('[data-vc-offre-ailleurs]') || {}).textContent || '' } : null; });
      dit(o && o.prets === '' && o.btn === 0 && /Répondre sur Vestiaire/.test(o.ail), 'l’offre est montrée, mais aucun geste : « Répondre sur Vestiaire ↗ »', JSON.stringify(o));
      dit((await cmds(pg)).length === 0, 'aucune commande ne part');
      dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | '));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ argent · offres · masquées : ${ko} rouge(s)` : '\n✅ argent · offres · masquées : tout est vert');
  process.exit(ko ? 1 : 0);
})();
