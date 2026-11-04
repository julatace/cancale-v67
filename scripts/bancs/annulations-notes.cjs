// ═══════════════════════════════════════════════════════════════════════════
// BANC : STATISTIQUES — ANNULATIONS PAR COMPTE ET NOTES REÇUES (3 novembre)
//        npm run build && node scripts/bancs/annulations-notes.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (dépôt public), de la FORME réelle : ventes Vinted
// (`harvest_{uid}_orders_sold`, `payload.my_orders`), profils
// (`harvest_{uid}_profile`, `payload.user.feedback_*`), projection `select=`
// appliquée. Horloge : jeudi 29 octobre 2026, 15 h. 390 tactile et 1512.
//   A. Mois : atelier 2 annulées sur 4 (« annulée », « paiement échoué » ; une
//      conversation sans état n'en est pas une), paris 1 sur 2 (remboursée) ;
//      « troisieme » (lecture ratée) : aucun chiffre, NOMMÉ ; total « 3 sur 6 »
//      sans taux global ; la liste ouvre SA vente (transaction/conversation) ; Année :
//      atelier 3 sur 5 (l'annulation de septembre entre).
//   N. Notes : atelier 4,9 (100 avis, 2 négatifs), paris 5 (lu il y a 20 j ⇒
//      « lu le … »), troisieme « pas lu » (jamais 0) ; moyenne pondérée 4,9 ;
//      avis détaillés « pas encore lus ».
//   C. Ventes illisibles : « — » pour les annulations, aucun pourcentage.
// `BANC_CAPTURE=<dossier>` : captures 1512/390, clair et sombre.
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4531;
const CAPT = process.env.BANC_CAPTURE || '';
const MAINTENANT = new Date(2026, 9, 29, 15, 0, 0);
const D = (m, j, h = 12) => new Date(2026, m - 1, j, h, 0, 0).toISOString();
const ilya = (j) => new Date(MAINTENANT.getTime() - j * 86400000).toISOString();
const accounts = [
  { id: 1, vinted_user_id: '111', login: 'atelier_sneak', domain: 'www.vinted.fr', updated_at: ilya(0), created_at: D(1, 1), owner: null },
  { id: 2, vinted_user_id: '222', login: 'paris_kicks', domain: 'www.vinted.fr', updated_at: ilya(0), created_at: D(1, 1), owner: null },
  { id: 3, vinted_user_id: '333', login: 'troisieme', domain: 'www.vinted.fr', updated_at: ilya(0), created_at: D(1, 1), owner: null },
];
const FIN = 'Commande finalisée';
// [compte, tx, conv, prix, statut, date, titre]
const VENTES = [
  ['111', 81001, 'c81001', 60, FIN, D(10, 3), 'Nike Dunk inventée 42'],
  ['111', 81002, '', 35, 'Commande annulée', D(10, 8), 'Nike Dunk inventée 42'],
  ['111', 81003, 'c81003', 50, 'Le paiement a échoué', D(10, 12), 'Samba inventée 41'],
  ['111', 81004, '', 45, 'Le paiement a été validé', D(10, 20), 'Samba inventée 41'],
  ['111', 81005, '', 40, 'Commande annulée', D(9, 10), 'Puma inventée 40'],
  ['222', 82001, '', 20, 'Remboursement effectué', D(10, 15), 'Vans inventée 40'],
  ['222', 82002, '', 25, FIN, D(10, 16), 'Vans inventée 41'],
  ['333', 83001, '', 30, 'Commande annulée', D(10, 16), 'Compte en panne'],
];
const vente = (v) => ({ transaction_id: v[1], id: v[1], conversation_id: v[2] || undefined, title: v[6], price: { amount: String(v[3]), currency_code: 'EUR' }, status: v[4], date: v[5] });
const profil = (uid, at, rep, n, pos, neu, neg) => ({ id: `harvest_${uid}_profile`, data: { uid, capturedAt: at, payload: { user: { login: accounts.find((a) => a.vinted_user_id === uid).login, feedback_reputation: rep, feedback_count: n, positive_feedback_count: pos, neutral_feedback_count: neu, negative_feedback_count: neg } } } });
const rows = [];
for (const a of accounts) rows.push({ id: `harvest_${a.vinted_user_id}_orders_sold`, data: { capturedAt: ilya(0), payload: { my_orders: VENTES.filter((v) => v[0] === a.vinted_user_id).map(vente) } } });
rows.push(profil('111', ilya(1), 0.9800000000000001, 100, 98, 0, 2), profil('222', ilya(20), 1, 10, 10, 0, 0));
rows.push({ id: 'lbc_ventes', data: { ventes: {} } }, { id: 'ebay_orders', data: { orders: [] } });

function projette(row, select) {
  if (!select || select === '*') return row;
  const out = {};
  for (const part of select.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id' || src === 'updated_at') { out[alias] = row[src]; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (/^data(->|->>)/.test(src)) { let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg]; out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v); continue; }
    out[alias] = row[src];
  }
  return out;
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null && d !== '' && !c ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const TAILLES = [{ nom: '1512', vp: { width: 1512, height: 950 } }, { nom: '390', vp: { width: 390, height: 844 }, isMobile: true, hasTouch: true }].filter((t) => !process.env.BANC_TAILLE || t.nom === process.env.BANC_TAILLE);
async function page(b, T, opts = {}) {
  const ctx = await b.newContext({ viewport: T.vp, isMobile: !!T.isMobile, hasTouch: !!T.hasTouch, colorScheme: opts.sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  await pg.clock.setFixedTime(MAINTENANT);
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_stats_replis', '{}'); if (sombre) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, !!opts.sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    const panne = () => route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (opts.ventesKO && /orders_sold|_orders_/.test(u)) return panne();
    if (/harvest_333_orders_sold/.test(u)) return panne();
    if (/select=owner/.test(u)) return j([{ owner: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: opts.main || {} }, S)]);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, S)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id) && !/harvest_333_orders_sold/.test(r.id)).map((r) => projette(r, S))); }
    return j([]);
  });
  await pg.route('**/api/**', (r2) => r2.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  return { ctx, pg, errs };
}
const lire = (pg) => pg.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const A = q('[data-sv-carte="annulations"]'), N = q('[data-sv-carte="notes"]');
  const comptes = Object.fromEntries([...document.querySelectorAll('[data-sv-annul-compte]')].map((e) => [e.getAttribute('data-sv-annul-compte'), { n: e.getAttribute('data-n'), a: e.getAttribute('data-annulees'), t: e.getAttribute('data-taux'), ventes: [...e.querySelectorAll('[data-sv-annul-vente]')].map((x) => [x.getAttribute('data-sv-annul-vente'), x.getAttribute('href')]) }]));
  const notes = Object.fromEntries([...document.querySelectorAll('[data-sv-notes-compte]')].map((e) => [e.getAttribute('data-sv-notes-compte'), { etat: e.getAttribute('data-etat'), note: e.getAttribute('data-note'), n: e.getAttribute('data-n'), neg: e.getAttribute('data-neg'), vieux: e.getAttribute('data-vieux'), texte: e.innerText.replace(/\s+/g, ' ') }]));
  const tot = q('[data-sv-annul-total]'), moy = q('[data-sv-notes-moyenne]');
  return {
    aEtat: A && A.getAttribute('data-sv-etat'), nEtat: N && N.getAttribute('data-sv-etat'), comptes, notes,
    total: tot && tot.getAttribute('data-sv-annul-total'), totalTexte: tot ? tot.innerText : '', manque: (q('[data-sv-annul-manque]') || {}).innerText || '',
    nonCouv: q('[data-sv-annul-non-couvertes]') && q('[data-sv-annul-non-couvertes]').getAttribute('data-sv-annul-non-couvertes'),
    moyenne: moy && moy.getAttribute('data-sv-notes-moyenne'), totalAvis: moy && moy.getAttribute('data-sv-notes-total'), listePasLue: !!q('[data-sv-notes-liste="pas-lue"]'),
    aTexte: A ? A.innerText : '', deb: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});
const aller = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { const a = document.querySelector('[data-sv-carte="annulations"]'), n = document.querySelector('[data-sv-carte="notes"]'); return a && n && a.getAttribute('data-sv-etat') !== 'encours' && n.getAttribute('data-sv-etat') !== 'encours'; }, null, { timeout: 30000 }).catch(() => {});
  await pg.waitForTimeout(1200);
};
const capture = async (pg, nom) => {
  if (!CAPT) return;
  fs.mkdirSync(CAPT, { recursive: true });
  const el = await pg.$('[data-sv-annul-notes]'); if (!el) return;
  await el.scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
  await el.screenshot({ path: path.join(CAPT, `${nom}.png`) });
};
(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const T of TAILLES) {
      console.log(`\n══ ${T.nom} px${T.hasTouch ? ' (tactile)' : ''}`);
      await essaie('A' + T.nom, async () => {
        const { ctx, pg, errs } = await page(b, T);
        await aller(pg);
        let r = await lire(pg);
        const c1 = r.comptes['111'] || {}, c2 = r.comptes['222'] || {};
        dit(r.aEtat === 'lu' && c1.n === '4' && c1.a === '2' && c1.t === '50', 'mois : atelier 2 annulées sur 4 ⇒ 50 % (conversation sans état exclue)', JSON.stringify(c1));
        dit(c2.n === '2' && c2.a === '1' && c2.t === '50', 'mois : paris 1 sur 2 (remboursée = annulée)', JSON.stringify(c2));
        dit(!r.comptes['333'] && /troisieme/.test(r.manque) && r.total === '3/6' && !/%/.test(r.totalTexte), 'compte en panne : aucun chiffre, NOMMÉ ; total « 3 sur 6 » SANS pourcentage global (un taux partiel ne se donne pas)', JSON.stringify({ m: r.manque, t: r.total, tt: r.totalTexte }));
        const v2 = (c1.ventes || []).find((x) => x[0] === '81002'), v3 = (c1.ventes || []).find((x) => x[0] === '81003');
        dit(v2 && v2[1] === 'https://www.vinted.fr/member/transactions/81002' && v3 && v3[1] === 'https://www.vinted.fr/inbox/c81003' && (c1.ventes || []).length === 2, 'chaque annulation ouvre SA vente (transaction, ou conversation)', JSON.stringify(c1.ventes));
        dit(r.nonCouv === 'Leboncoin,eBay,Vestiaire', 'Leboncoin, eBay, Vestiaire : « pas comptés » (jamais 0 %)', r.nonCouv);
        const n1 = r.notes['111'] || {}, n2 = r.notes['222'] || {}, n3 = r.notes['333'] || {};
        dit(r.nEtat === 'lu' && n1.note === '4.9' && n1.n === '100' && n1.neg === '2' && /4,9/.test(n1.texte), 'notes : atelier 4,9 · 100 avis · 2 négatifs', JSON.stringify(n1));
        dit(n2.note === '5' && n2.vieux === '1' && /lu le/.test(n2.texte), 'notes : paris 5, profil ancien ⇒ « lu le … »', JSON.stringify(n2));
        dit(n3.etat === 'pasLu' && n3.n === '' && /—/.test(n3.texte) && !/\b0\b/.test(n3.texte), 'notes : troisieme jamais capté ⇒ « pas lu », « — », jamais 0', JSON.stringify(n3));
        dit(r.moyenne === '4.9' && r.totalAvis === '110' && r.listePasLue, 'moyenne pondérée 4,9 sur 110 avis ; avis détaillés « pas encore lus »', JSON.stringify({ m: r.moyenne, t: r.totalAvis, l: r.listePasLue }));
        // Ouvrir le compte : la liste se déplie au doigt / au clic.
        const s = pg.locator('[data-sv-annul-compte="111"] summary').first(); await s.scrollIntoViewIfNeeded();
        if (T.hasTouch) await s.tap(); else await s.click();
        await pg.waitForTimeout(300);
        const vis = await pg.evaluate(() => { const e = document.querySelector('[data-sv-annul-vente="81002"]'); return !!e && e.getBoundingClientRect().height >= 44; });
        dit(vis, 'toucher le compte déplie ses annulations (cibles ≥ 44 px)');
        dit(r.deb <= 1, 'aucun débordement horizontal', `${r.deb}px`);
        await capture(pg, `annul-notes-${T.nom}`);
        // Année : l'annulation de septembre entre.
        await pg.locator('[data-sv-choix="annee"]').first().click(); await pg.waitForTimeout(800);
        r = await lire(pg);
        dit((r.comptes['111'] || {}).n === '5' && (r.comptes['111'] || {}).a === '3' && (r.comptes['111'] || {}).t === '60', 'année : atelier 3 sur 5 ⇒ 60 %', JSON.stringify(r.comptes['111']));
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      if (CAPT) await essaie('S' + T.nom, async () => {
        const { ctx, pg } = await page(b, T, { sombre: true, main: { vinted_dark: true } });
        await aller(pg); await capture(pg, `annul-notes-${T.nom}-sombre`); await ctx.close();
      });
      await essaie('C' + T.nom, async () => {
        const { ctx, pg, errs } = await page(b, T, { ventesKO: true });
        await aller(pg);
        const r = await lire(pg);
        dit(r.aEtat === 'passu' && !/%/.test(r.aTexte), 'ventes illisibles : annulations « — », aucun pourcentage', JSON.stringify({ e: r.aEtat, t: r.aTexte.slice(0, 80) }));
        dit(errs.length === 0, 'aucune erreur d’app', errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); console.log(ko ? `\n❌ annulations-notes : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ annulations-notes : ${ok} verts, 0 rouge`); process.exit(ko ? 1 : 0); }
})();
