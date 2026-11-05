// Banc : LE STOCK = TES ANNONCES ACTUELLES (5 novembre)
//
// Julien, mot pour mot : « pour le stock onglet je veux que ça soit les annonces
// actuelles ». Données INVENTÉES (dépôt public) : 2 comptes Vinted, 1 Leboncoin.
//   · compte_alpha (111) lu il y a 1 h : N°1 (rangée), N°2 (aussi sur Leboncoin),
//     N°5 MASQUÉE par Vinted, N°9 ;
//   · compte_beta (222) lu il y a 3 jours : N°21 (rangée) ⇒ « à confirmer » ;
//   · Leboncoin : N°2 (la même paire que Vinted) et N°31 (seulement là) ;
//   · N°7 rangée PUIS vendue ; N°8 rangée, plus en ligne nulle part ;
//   · N°3 : une vieille fiche numérotée, plus en ligne, jamais rangée.
// Aux deux tailles (390 tactile, 1512 souris), en clair et en sombre, il exige :
//   A  en tête : 6 annonces actuelles (N°2 comptée UNE fois), dont 1 à confirmer
//      NOMMÉE (compte_beta), dont 1 masquée — pas « au moins » (tout est lu) ;
//   B  la liste des annonces actuelles : chaque paire une fois, N°2 sur Vinted ET
//      Leboncoin, sa case ou « pas encore rangée » ; N°3 n'y est pas ;
//   C  « À ranger » = les annonces actuelles sans case (2, 5, 9, 31) — jamais la
//      vieille fiche N°3, ni les rangées ;
//   D  la case de N°7 (vendue) reste allumée et N°7 est dans « Vendues à sortir » ;
//   E  la case de N°8 ne disparaît pas : « Plus en ligne », ambre, dans sa liste ;
//      « Elle est encore là » éteint le signal ;
//   F  le filtre de plateforme : « Leboncoin » ne garde que N°2 et N°31 ;
//   G  une lecture qui manque (compte_beta pas lu) ⇒ « au moins », le compte
//      nommé, et sa paire rangée N°21 n'est PAS dite « plus en ligne » ;
//   H  rien lu du tout ⇒ « — » et la raison, jamais « aucune annonce », aucune
//      case dite « plus en ligne » ;
//   I  aucune erreur de page, aucun défilement horizontal.
// Lancer : BANC_PORT=84xx node scripts/bancs/stock-annonces.cjs   (SHOT=prefixe pour les captures)
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8431;
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const AUJ = Date.now();

const MAIN = {
  vinted_annonce_numeros: {
    '1001': { numero: '1', title: 'Paire inventée une 42', accountId: '111' },
    '1002': { numero: '2', title: 'Paire inventée deux 40', accountId: '111' },
    '1003': { numero: '3', title: 'Vieille paire inventée trois', accountId: '111' },
    '1005': { numero: '5', title: 'Paire inventée cinq 41', accountId: '111' },
    '1007': { numero: '7', title: 'Paire inventée sept 43', accountId: '111' },
    '1008': { numero: '8', title: 'Paire inventée huit 44', accountId: '111' },
    '1009': { numero: '9', title: 'Paire inventée neuf 39', accountId: '111' },
    '2001': { numero: '21', title: 'Paire inventée vingt et un 42', accountId: '222' },
  },
  vrm_meubles: [{ id: 'mA', name: 'Étagère banc', cols: 3, rows: 2, planches: [1] }],
  vrm_slots: { '1': { m: 'mA', i: 0 }, '7': { m: 'mA', i: 1 }, '8': { m: 'mA', i: 2 }, '21': { m: 'mA', i: 3 } },
  vrm_stock_vendus: { nums: ['7'], at: AUJ },
};
const ann = (id, title, extra = {}) => ({ id, title, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, photo: null, brand_title: 'Marque', size_title: '42', status: 'Très bon état', ...extra });
const LIGNES = {
  'harvest_111_listings': { id: 'harvest_111_listings', data: { capturedAt: new Date(AUJ - 3600000).toISOString(), payload: { items: [
    ann(1001, 'Paire inventée une 42'), ann(1002, 'Paire inventée deux 40'), ann(1005, 'Paire inventée cinq 41', { is_hidden: true }), ann(1009, 'Paire inventée neuf 39'),
    ann(1007, 'Paire inventée sept 43', { is_closed: true, item_closing_action: 'sold' }),
  ], pagination: { total_entries: 5 } } } },
  'harvest_222_listings': { id: 'harvest_222_listings', data: { capturedAt: new Date(AUJ - 3 * 86400000).toISOString(), payload: { items: [ann(2001, 'Paire inventée vingt et un 42')], pagination: { total_entries: 1 } } } },
  'lbc_listings': { id: 'lbc_listings', data: { items: {
    L1: { id: 'L1', customRef: 'VRM-2', subject: 'Paire inventée deux 40 (Leboncoin)', status: 'active' },
    L2: { id: 'L2', customRef: 'VRM-31', subject: 'Paire inventée trente et un', status: 'active' },
  }, lectures: {} } },
  'lbc_ventes': { id: 'lbc_ventes', data: { ventes: {} } },
};

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
// La VRAIE forme : projection `select=` (alias:data->x->>y), sinon la ligne entière.
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

// scenario : 'complet' · 'partiel' (compte_beta pas lu) · 'rien' (aucune lecture ne répond)
async function rendre(b, { tel, sombre, scenario }) {
  const ctx = await b.newContext({ viewport: tel ? { width: 390, height: 844 } : { width: 1512, height: 950 }, ...(tel ? { isMobile: true, hasTouch: true } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const rows = [{ id: 'main', data: MAIN }, ...Object.values(LIGNES).filter((r) => !(scenario === 'partiel' && r.id === 'harvest_222_listings'))];
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j([
      { id: 1, vinted_user_id: '111', login: 'compte_alpha', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 2, vinted_user_id: '222', login: 'compte_beta', domain: 'www.vinted.fr', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ]);
    // « rien » : les annonces de chaque plateforme ne répondent pas (la base, elle, oui).
    if (scenario === 'rien' && /id=eq\.(harvest_\d+_listings|lbc_listings|lbc_ventes|ebay_comptes|ebay_listings)/.test(u)) return j({ message: 'panne inventée' }, 500);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data$|^data$/.test(sel) ? projette(r, sel) : { ...r, updated_at: new Date(AUJ).toISOString() });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  // Le relais Vinted du serveur ne rend rien d'utile : un compte sans lecture captée reste « pas su ».
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.addInitScript(({ m, sombre }) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const k in m) localStorage.setItem(k, JSON.stringify(m[k])); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); } catch (_) {} }, { m: MAIN, sombre });
  await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-meuble="mA"]', { timeout: 25000 }).catch(() => {});
  await pg.waitForFunction(() => { const el = document.querySelector('[data-stock-actuelles]'); return el && el.getAttribute('data-stock-actuelles') !== 'encours'; }, null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(800);
  return { ctx, pg, errs };
}
// Le Stock défile dans la coque : une capture par endroit (haut, étagère, liste).
const shot = async (pg, nom) => {
  if (!process.env.SHOT) return;
  for (const [ou, sel] of [['haut', null], ['etagere', '[data-meuble="mA"]'], ['liste', '[data-stock-liste]']]) {
    if (sel) { const ok = await pg.evaluate((s) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: 'start' }); return !!el; }, sel); if (!ok) continue; }
    else await pg.evaluate(() => { const el = document.querySelector('[data-stock-actuelles]'); if (el) el.scrollIntoView({ block: 'center' }); });
    await pg.waitForTimeout(250);
    await pg.screenshot({ path: `${process.env.SHOT}-${nom}-${ou}.png` });
  }
  await pg.evaluate(() => { const el = document.querySelector('[data-stock-actuelles]'); if (el) el.scrollIntoView({ block: 'center' }); });
};
const attr = (pg, sel, a) => pg.evaluate(([s, x]) => { const el = document.querySelector(s); return el ? el.getAttribute(x) : null; }, [sel, a]);
const toucher = async (pg, tel, sel) => { if (tel) await pg.tap(sel); else await pg.click(sel); };
const finPage = async (pg, errs, t, quoi) => {
  const large = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  dit(large <= 1, `${t} : I — pas de défilement horizontal de la page (${quoi})`, String(large));
  dit(errs.length === 0, `${t} : I — aucune erreur de page (${quoi})`, errs.join(' | ').slice(0, 300));
};

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).split('\n')[0].slice(0, 300)); } };
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const tel of [false, true]) for (const sombre of [false, true]) {
      const t = `${tel ? '390 tactile' : '1512 souris'} ${sombre ? 'sombre' : 'clair'}`;
      const nomShot = (tel ? '390' : '1512') + (sombre ? '-sombre' : '-clair');
      await essaie(t + ' complet', async () => {
        const { ctx, pg, errs } = await rendre(b, { tel, sombre, scenario: 'complet' });
        const theme = await pg.evaluate(() => document.documentElement.getAttribute('data-theme') || '');
        dit(theme === (sombre ? 'dark' : 'light'), `${t} : le thème demandé est rendu`, theme);
        // A — les chiffres en tête.
        const tete = await pg.evaluate(() => { const el = document.querySelector('[data-stock-actuelles]'); if (!el) return null; return { n: el.getAttribute('data-stock-actuelles'), am: el.getAttribute('data-stock-au-moins'), ac: el.getAttribute('data-stock-a-confirmer'), ma: el.getAttribute('data-stock-masquees'), txt: el.innerText.replace(/\s+/g, ' ') }; });
        dit(!!tete && tete.n === '6' && tete.am === '0', `${t} : A — 6 annonces actuelles (N°2 sur deux sites comptée une fois), pas « au moins »`, JSON.stringify(tete));
        dit(!!tete && tete.ac === '1' && /compte_beta/.test(tete.txt) && /à confirmer/.test(tete.txt), `${t} : A — dont 1 « à confirmer », le compte NOMMÉ`, tete && tete.txt);
        dit(!!tete && tete.ma === '1' && /masquée/.test(tete.txt), `${t} : A — dont 1 masquée par Vinted, comptée parmi les présentes`, tete && tete.txt);
        // B — la liste.
        const liste = await pg.evaluate(() => [...document.querySelectorAll('[data-stock-annonce]')].map((el) => ({ k: el.getAttribute('data-stock-annonce'), e: el.getAttribute('data-stock-annonce-etat'), p: el.getAttribute('data-stock-annonce-plats'), o: el.getAttribute('data-stock-annonce-place') })));
        const cles = liste.map((x) => x.k).sort();
        dit(JSON.stringify(cles) === JSON.stringify(['1', '2', '21', '31', '5', '9']), `${t} : B — la liste : chaque annonce actuelle une fois, jamais N°3 ni N°7 ni N°8`, JSON.stringify(cles));
        const l2 = liste.find((x) => x.k === '2') || {}, l1 = liste.find((x) => x.k === '1') || {}, l21 = liste.find((x) => x.k === '21') || {}, l5 = liste.find((x) => x.k === '5') || {};
        dit(l2.p === 'vinted,leboncoin' && l2.o === 'non-range', `${t} : B — N°2 : Vinted ET Leboncoin, « pas encore rangée »`, JSON.stringify(l2));
        dit(l1.o === 'Étagère banc|1|1' && l21.e === 'aconfirmer' && l5.e === 'masquee', `${t} : B — N°1 dit sa case ; N°21 « à confirmer » ; N°5 « masquée »`, JSON.stringify([l1, l21, l5]));
        // C — À ranger.
        const ar = await pg.evaluate(() => [...document.querySelectorAll('[data-a-ranger]')].map((el) => el.getAttribute('data-a-ranger')).sort().join(','));
        dit(ar === '2,31,5,9', `${t} : C — « À ranger » = les annonces actuelles sans case (jamais la vieille fiche N°3)`, ar);
        // D — vendue.
        dit(await attr(pg, '[data-case-num="7"]', 'data-case-etat') === 'vendue' && !!(await pg.$('[data-stock-vendues-sortir] [data-stock-rangee="7"]')), `${t} : D — N°7 (rangée puis vendue) : case allumée, dans « Vendues à sortir »`, await attr(pg, '[data-case-num="7"]', 'data-case-etat'));
        // E — plus en ligne.
        const e8 = await pg.evaluate(() => { const el = document.querySelector('[data-case-num="8"]'); return el ? { etat: el.getAttribute('data-case-etat'), ombre: getComputedStyle(el).boxShadow } : null; });
        dit(!!e8 && e8.etat === 'plusenligne' && e8.ombre !== 'none' && !!(await pg.$('[data-stock-plus-en-ligne] [data-stock-rangee="8"]')), `${t} : E — N°8 (rangée, plus en ligne) : sa case reste, signalée, dans « Plus en ligne »`, JSON.stringify(e8));
        dit(await attr(pg, '[data-case-num="1"]', 'data-case-etat') === 'occupee' && await attr(pg, '[data-case-num="21"]', 'data-case-etat') === 'occupee', `${t} : E — une case d'annonce actuelle (N°1, N°21 à confirmer) reste neutre`);
        await shot(pg, nomShot + '-complet');
        await pg.evaluate(() => window.scrollTo(0, 0));
        // F — filtre Leboncoin.
        if (await pg.$('[data-stock-filtre-plat] [data-plat="leboncoin"]')) {
          await toucher(pg, tel, '[data-stock-filtre-plat] [data-plat="leboncoin"]');
          await pg.waitForTimeout(400);
          const lf = await pg.evaluate(() => [...document.querySelectorAll('[data-stock-annonce]')].map((el) => el.getAttribute('data-stock-annonce')).sort().join(','));
          dit(lf === '2,31', `${t} : F — filtre « Leboncoin » : N°2 et N°31 seulement`, lf);
          await toucher(pg, tel, '[data-stock-filtre-plat] [data-plat="toutes"]');
          await pg.waitForTimeout(300);
        } else dit(false, `${t} : F — le filtre de plateforme est proposé`);
        // E (suite) — « Elle est encore là ».
        if (await pg.$('[data-stock-encore-la="8"]')) {
          await pg.evaluate(() => document.querySelector('[data-stock-encore-la="8"]').scrollIntoView({ block: 'center' }));
          await toucher(pg, tel, '[data-stock-encore-la="8"]');
          await pg.waitForTimeout(500);
          const apres = await attr(pg, '[data-case-num="8"]', 'data-case-etat');
          dit(apres === 'occupee' && !(await pg.$('[data-stock-plus-en-ligne]')), `${t} : E — « Elle est encore là » : la case reste, plus signalée`, String(apres));
        } else dit(false, `${t} : E — « Elle est encore là » est proposé`);
        await finPage(pg, errs, t, 'complet');
        await ctx.close();
      });
      await essaie(t + ' partiel', async () => {
        const { ctx, pg, errs } = await rendre(b, { tel, sombre, scenario: 'partiel' });
        const tete = await pg.evaluate(() => { const el = document.querySelector('[data-stock-actuelles]'); return el ? { n: el.getAttribute('data-stock-actuelles'), am: el.getAttribute('data-stock-au-moins'), txt: el.innerText.replace(/\s+/g, ' ') } : null; });
        dit(!!tete && tete.n === '5' && tete.am === '1' && /au moins/.test(tete.txt) && /compte_beta/.test(tete.txt), `${t} : G — compte_beta pas lu : « au moins 5 », le compte nommé`, JSON.stringify(tete));
        const e21 = await attr(pg, '[data-case-num="21"]', 'data-case-etat');
        dit(e21 !== 'plusenligne' && !(await pg.$('[data-stock-plus-en-ligne] [data-stock-rangee="21"]')) && !!(await pg.$('[data-stock-rangees-passu]')), `${t} : G — N°21 (de compte_beta) n'est PAS dite « plus en ligne » : « pas vérifiée »`, String(e21));
        dit(await attr(pg, '[data-case-num="8"]', 'data-case-etat') === 'plusenligne', `${t} : G — N°8 (de compte_alpha, bien lu) reste « plus en ligne »`);
        await shot(pg, nomShot + '-partiel');
        await finPage(pg, errs, t, 'partiel');
        await ctx.close();
      });
      await essaie(t + ' rien', async () => {
        const { ctx, pg, errs } = await rendre(b, { tel, sombre, scenario: 'rien' });
        const tete = await pg.evaluate(() => { const el = document.querySelector('[data-stock-actuelles]'); return el ? { n: el.getAttribute('data-stock-actuelles'), txt: el.innerText.replace(/\s+/g, ' ') } : null; });
        dit(!!tete && tete.n === 'passu' && /—/.test(tete.txt) && /pas pu lire/.test(tete.txt) && !/Aucune annonce/i.test(tete.txt), `${t} : H — rien lu : « — » et la raison, jamais « aucune annonce »`, JSON.stringify(tete));
        const pl = await pg.evaluate(() => [...document.querySelectorAll('[data-case-etat="plusenligne"]')].length);
        dit(pl === 0 && !(await pg.$('[data-stock-plus-en-ligne]')) && await attr(pg, '[data-case-num="7"]', 'data-case-etat') === 'vendue', `${t} : H — aucune case dite « plus en ligne » ; la vendue reste allumée`, String(pl));
        dit(!!(await pg.$('[data-case-num="1"]')) && !!(await pg.$('[data-case-num="8"]')), `${t} : H — les paires rangées restent dans leurs cases (rien ne disparaît)`);
        await shot(pg, nomShot + '-rien');
        await finPage(pg, errs, t, 'rien');
        await ctx.close();
      });
    }
  } finally {
    if (b) await b.close();
    srv.close();
    console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert');
    process.exit(ko ? 1 : 0);
  }
})();
