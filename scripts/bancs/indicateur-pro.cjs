// Banc : L'INDICATEUR DE L'EN-TÊTE, SOBRE ET PRO (5 novembre — données INVENTÉES,
// il vit dans le dépôt).
//
// Julien, 5 nov. : « dans VRM, l'étiquette rouge "l'extension capte" remplacée par
// quelque chose de plus pro » · « elle affiche Chrome alors que je suis sur Orion »
// · « être mieux informé de la connexion et de la récupération des données — il
// faut impérativement améliorer cette partie ».
// Il juge par ATTRIBUTS et par couleurs CALCULÉES (jamais une formulation, §6.5) :
//   A. tout va bien (extension branchée, compte Vinted ouvert) : un point DISCRET,
//      ni accent ni ambre, sans halo, et le NOM du compte écrit ; au doigt, le
//      point de coin ne se montre pas ;
//   B. un geste à faire (pas d'extension ici) : le point est AMBRE — la seule fois ;
//   C. le panneau dit, compte par compte et toutes plateformes, la dernière
//      relecture et ce qui bloque, une ligne chacun (`data-fraicheur-*`) — avec la
//      règle de « Comptes liés » : la relecture PUBLIQUE d'un compte
//      (`harvest_{uid}_enligne`) ne le dit pas « relu » ;
//      ces lignes ne sont lues qu'à l'OUVERTURE du panneau ;
//   D. le nom du navigateur : sur Orion (`window.KAGI`), le panneau ne dit jamais
//      « Chrome » et dit « Orion » ; un navigateur qu'on ne sait pas nommer
//      (agent Safari, sans KAGI) : jamais « Chrome » non plus.
// Lancer : npm run build, puis BANC_PORT=7967 CHROMIUM_PATH=… node scripts/bancs/indicateur-pro.cjs
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 7967;
const CAP = process.env.BANC_CAPTURES || '';
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const H = 3600e3, maintenant = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_alpha', domain: 'www.vinted.fr', updated_at: iso(maintenant), created_at: iso(maintenant - 90 * 24 * H) },
  { id: 2, vinted_user_id: '222', login: 'compte_beta', domain: 'www.vinted.fr', updated_at: iso(maintenant), created_at: iso(maintenant - 60 * 24 * H) },
];
const rows = [
  { id: 'main', data: {} },
  { id: 'harvest_111_profile', data: { capturedAt: iso(maintenant - 2 * H), payload: { user: { id: 111, login: 'compte_alpha' } } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: iso(maintenant - 4 * 24 * H), payload: { my_orders: [] } } },
  // Relu PUBLIQUEMENT à l'instant, avec la session d'un AUTRE compte : ne dit pas « relu ».
  { id: 'harvest_222_enligne', data: { capturedAt: iso(maintenant - 60e3), ids: [], complet: true } },
  { id: 'panel_comptes_etat', data: { comptes: {} } },
  { id: 'lbc_accounts', data: { accounts: { '8442': { id: '8442', name: 'vendeur_lbc', type: 'particulier', sessionAt: iso(maintenant - 3 * 24 * H) } } } },
  { id: 'lbc_listings', data: { lectures: {} } },
  { id: 'ebay_comptes', data: { comptes: [{ principal: true, pseudo: 'pseudo_ebay' }] } },
  { id: 'ebay_orders', data: { capturedAt: iso(maintenant - 1 * H), orders: [] } },
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

const EXT_ATTENDUE = (/const EXT_ATTENDUE = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.300.0';
// Un pont d'extension SIMULÉ (forme de `vinted-ui.cjs`) : à jour, connectée à VRM,
// le compte 111 ouvert dans le navigateur.
const PONT_MINI = ({ version, extId }) => {
  const post = (m) => window.postMessage(m, '*');
  window.chrome = { runtime: { lastError: null, sendMessage(id, msg, cb) { setTimeout(() => cb && cb(msg && msg.type === 'liaison' ? { ok: true, besoin: false } : { ok: true }), 5); } } };
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: extId });
    if (d.__vmr === 'etat' && d.reqId) post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: extId, vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_alpha' }, cmds: {} } });
    if (d.__vmr === 'cmd' && d.reqId) post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
  });
  post({ __vmr: 'ready', version, id: extId });
};
const UA_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

async function ouvrir(b, { tel = false, pont = false, orion = false, safari = false } = {}) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true } : {}), ...(safari ? { userAgent: UA_SAFARI } : {}) });
  const pg = await ctx.newPage();
  const errs = [], lus = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_astuce_numeros', 'false'); } catch (_) {} });
  if (orion) await pg.addInitScript(() => { window.KAGI = {}; });
  if (pont) await pg.addInitScript(PONT_MINI, { version: EXT_ATTENDUE, extId: 'abcdefghijklmnopabcdefghijklmnop' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    lus.push(u);
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(maintenant), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-etat-actions]', { timeout: 20000 });
  await pg.waitForTimeout(1800);
  return { ctx, pg, errs, lus };
}
const capture = async (pg, nom) => { if (!CAP) return; fs.mkdirSync(CAP, { recursive: true }); await pg.screenshot({ path: path.join(CAP, nom + '.png') }); };

// La pastille : son ton, la couleur CALCULÉE de son point, comparée à l'accent et à l'ambre de la palette.
const lirePastille = (pg) => pg.evaluate(() => {
  const el = [...document.querySelectorAll('[data-etat-actions]')].find((e) => e.offsetParent !== null);
  if (!el) return null;
  const pt = el.querySelector('.vrm-etat-point');
  const sonde = (v) => { const s = document.createElement('span'); s.style.color = `var(${v})`; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; };
  const cs = pt ? getComputedStyle(pt) : null;
  return { ton: el.getAttribute('data-etat-ton'), niveau: el.getAttribute('data-etat-actions'), txt: el.innerText.trim(),
    point: cs ? cs.backgroundColor : '', halo: cs ? cs.boxShadow : '', pointVu: !!(pt && cs.display !== 'none' && pt.getBoundingClientRect().width > 0),
    accent: sonde('--vrm-accent'), warn: sonde('--vrm-warn') };
});
const ouvrirPanneau = async (pg) => {
  await pg.locator('[data-etat-actions]').filter({ visible: true }).first().click();
  await pg.waitForSelector('[data-etat-panneau]', { timeout: 5000 });
  await pg.waitForFunction(() => { const x = document.querySelector('[data-fraicheur-comptes]'); return x && x.getAttribute('data-fraicheur-comptes') !== 'encours'; }, null, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(300);
  return pg.evaluate(() => {
    const p = document.querySelector('[data-etat-panneau]');
    const z = p && p.querySelector('[data-fraicheur-comptes]');
    const lignes = z ? [...z.querySelectorAll('[data-fraicheur-compte]')].map((l) => ({ p: l.getAttribute('data-fraicheur-compte'), id: l.getAttribute('data-fraicheur-id'), etat: l.getAttribute('data-fraicheur-etat'), geste: l.getAttribute('data-fraicheur-geste'), txt: l.innerText })) : null;
    const ic = p && p.querySelector('.vrm-etat-icone');
    const sonde = (v) => { const s = document.createElement('span'); s.style.color = `var(${v})`; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; };
    return { txt: p ? p.innerText : '', zone: z ? z.getAttribute('data-fraicheur-comptes') : null, lignes, icone: ic ? getComputedStyle(ic).color : '', accent: sonde('--vrm-accent') };
  });
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: EXE, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    console.log('── A/C. 1512 px · extension branchée, compte_alpha ouvert');
    { const { ctx, pg, errs, lus } = await ouvrir(b, { pont: true });
      const p = await lirePastille(pg);
      dit(p && p.ton === 'ok' && p.niveau === 'ok', 'A · tout va bien : la pastille est au ton « ok »', JSON.stringify(p && { ton: p.ton, niveau: p.niveau }));
      dit(p && p.point !== p.accent && p.point !== p.warn, 'A · son point n’est ni l’accent ni l’ambre (aucune couleur quand tout va bien)', JSON.stringify(p && { point: p.point, accent: p.accent, warn: p.warn }));
      dit(p && (p.halo === 'none' || p.halo === ''), 'A · pas de halo autour du point', p && p.halo);
      dit(p && /compte_alpha/.test(p.txt) && !/Actions possibles/.test(p.txt), 'A · elle écrit le NOM du compte, pas « Actions possibles »', p && p.txt);
      const avant = lus.filter((u) => /vc_session&select=id:data->>id,at:data->>at,comptes/.test(u)).length;
      dit(avant === 0, 'C · rien des autres sites n’est lu tant que le panneau est fermé', avant);
      await capture(pg, 'pastille-ok-1512');
      const q = await ouvrirPanneau(pg);
      await capture(pg, 'panneau-ok-1512');
      dit(lus.some((u) => /vc_session&select=id:data->>id,at:data->>at,comptes/.test(u)), 'C · l’ouverture lit les comptes des autres sites');
      const L = q.lignes || [];
      const l = (pl, id) => L.find((x) => x.p === pl && x.id === id);
      dit(q.zone === 'lu' && L.length === 4, 'C · une ligne par compte (2 Vinted, 1 Leboncoin, 1 eBay)', JSON.stringify(L.map((x) => x.p + ':' + x.id)));
      dit(l('vinted', '111') && l('vinted', '111').etat === 'ouvert' && l('vinted', '111').geste === '0', 'C · le compte ouvert ici : « ouvert », aucun geste', JSON.stringify(l('vinted', '111')));
      dit(l('vinted', '222') && l('vinted', '222').etat === 'a-relire' && l('vinted', '222').geste === '1' && /il y a 4 j/.test(l('vinted', '222').txt) && /vinted\.fr/.test(l('vinted', '222').txt),
        'C · compte_beta : relu il y a 4 j (la relecture publique ne compte pas), avec LE geste', JSON.stringify(l('vinted', '222')));
      dit(l('leboncoin', '8442') && l('leboncoin', '8442').etat === 'a-relire' && l('leboncoin', '8442').geste === '1', 'C · Leboncoin relu il y a 3 j : à relire, avec le geste', JSON.stringify(l('leboncoin', '8442')));
      dit(l('ebay', 'principal') && l('ebay', 'principal').etat === 'lu' && l('ebay', 'principal').geste === '0' && /il y a 1 h/.test(l('ebay', 'principal').txt), 'C · eBay relu il y a 1 h : rien ne bloque', JSON.stringify(l('ebay', 'principal')));
      dit(L.length && L[0].geste === '1', 'C · ce qui demande un geste vient d’abord', L.length && L[0].p + ':' + L[0].id);
      dit(q.icone && q.icone !== q.accent, 'A · le panneau « tout va bien » n’est pas peint à l’accent', `${q.icone} / ${q.accent}`);
      dit(/Chrome/.test(q.txt), 'D · dans Chrome, le panneau peut dire « Chrome » (c’est vrai ici)');
      dit(!errs.length, 'aucune erreur', errs[0]);
      await ctx.close(); }

    console.log('── B. 1512 px · sans extension (un geste à faire)');
    { const { ctx, pg, errs } = await ouvrir(b);
      const p = await lirePastille(pg);
      dit(p && p.ton === 'attention' && p.point === p.warn, 'B · un geste à faire : le point est AMBRE', JSON.stringify(p && { ton: p.ton, point: p.point, warn: p.warn }));
      await capture(pg, 'pastille-absente-1512');
      dit(!errs.length, 'aucune erreur', errs[0]);
      await ctx.close(); }

    console.log('── D. 1512 px · Orion (window.KAGI), extension branchée');
    { const { ctx, pg, errs } = await ouvrir(b, { pont: true, orion: true });
      const q = await ouvrirPanneau(pg);
      await capture(pg, 'panneau-orion-1512');
      dit(!/Chrome/.test(q.txt), 'D · sur Orion, le panneau ne dit jamais « Chrome »', (q.txt.match(/.{0,40}Chrome.{0,30}/) || [''])[0]);
      dit(/Orion/.test(q.txt), 'D · sur Orion, il dit « Orion »');
      const l = (q.lignes || []).find((x) => x.id === '222');
      dit(l && /dans Orion/.test(l.txt), 'D · le geste du compte à relire dit « dans Orion »', l && l.txt);
      dit(!errs.length, 'aucune erreur', errs[0]);
      await ctx.close(); }

    console.log('── D. 1512 px · navigateur qu’on ne sait pas nommer (agent Safari, sans KAGI)');
    { const { ctx, pg, errs } = await ouvrir(b, { pont: true, safari: true });
      const q = await ouvrirPanneau(pg);
      dit(!/Chrome/.test(q.txt), 'D · navigateur inconnu : jamais « Chrome »', (q.txt.match(/.{0,40}Chrome.{0,30}/) || [''])[0]);
      dit(/ce navigateur|ton navigateur/.test(q.txt), 'D · il dit « ce navigateur »');
      dit(!errs.length, 'aucune erreur', errs[0]);
      await ctx.close(); }

    console.log('── A/B. 390 px tactile · extension branchée, puis sans');
    { const { ctx, pg, errs } = await ouvrir(b, { tel: true, pont: true });
      const p = await lirePastille(pg);
      dit(p && p.ton === 'ok' && !p.pointVu, 'A · au doigt, tout va bien : pas de point de couleur sur l’en-tête', JSON.stringify(p && { ton: p.ton, pointVu: p.pointVu, point: p.point }));
      const q = await ouvrirPanneau(pg);
      await capture(pg, 'panneau-ok-390');
      dit(q.zone === 'lu' && (q.lignes || []).length === 4, 'C · au doigt aussi, une ligne par compte', q.lignes && q.lignes.length);
      dit(!errs.length, 'aucune erreur', errs[0]);
      await ctx.close(); }
    { const { ctx, pg, errs } = await ouvrir(b, { tel: true });
      const p = await lirePastille(pg);
      // Au téléphone sans extension, aucun geste ICI (on agit depuis l'ordinateur) : gris, pas de point.
      dit(p && p.ton === 'neutre' && !p.pointVu, 'B · au doigt sans extension : rien à faire ici, aucune couleur', JSON.stringify(p && { ton: p.ton, pointVu: p.pointVu, point: p.point }));
      dit(!errs.length, 'aucune erreur', errs[0]);
      await ctx.close(); }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e.message).slice(0, 200)); }
  if (b) await b.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} indicateur pro : ${ko ? ko + ' rouge(s)' : 'tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
