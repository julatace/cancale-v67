// ── BANC : « MA SEMAINE » (10 nov. 2026, lot BC) ─────────────────────────────
//        npm run build && node scripts/bancs/ma-semaine.cjs [dist]
//        SHOTS=dossier  BANC_PORT=4523
// Données INVENTÉES (le dépôt est public), à la forme des lignes réelles. L'horloge de
// la page est FIGÉE au dimanche 8 nov. 2026, 19 h à Paris (l'heure du bilan du soir).
// Un compte Vinted et ses ventes :
//   lun. 2 nov. 10 h 60 € · mer. 4 nov. 15 h 45 € · dim. 8 nov. 18 h 30 30 € ·
//   dim. 8 nov. 21 h 777 € (PAS ENCORE — une vente future n'est jamais comptée) ;
//   la semaine d'avant : mar. 27 oct. 50 € · ven. 30 oct. 20 € · dim. 1er nov. 20 h 40 €
//   (après le « même moment » : hors de la comparaison du dimanche 19 h).
// Bénéfice publié par Ventes (`vrm_benefice_jours`) : prix d'achat 20 et 15, le 3ᵉ
// inconnu ⇒ « au moins 70 € », 2 sur 3 ; la semaine d'avant 30 et 5 (complète).
// Gestes « Colis fait » : 2 cette semaine, 1 avant ; qui dorment : 4 (publié il y a 1 h).
// Attendus faits À LA MAIN. Jugé sur les data-* et nombres rendus, jamais un libellé seul.
//  N  Le lien de la notification (`?tab=semaine&lundi=2026-11-02`) ouvre CETTE semaine :
//     vendu 135 €, 3 ventes, +65 € et +1 vs la semaine d'avant AU MÊME MOMENT ; une barre
//     par jour (lun. 60, mer. 45, dim. 30, les autres 0) ; bénéfice « au moins 70 € »
//     SANS flèche ; colis « au moins 2 » sans flèche ; qui dorment 4 ; reçu « — ».
//  V  Le visuel : 390 px tactile et 1512 px, clair et sombre — aucune couleur rouge ni
//     verte, boutons ≥ 44 px, pas de débordement horizontal, ≤ 12 mots par bloc, aucune
//     erreur de page. Captures dans SHOTS.
//  S  ‹ ⇒ la semaine du 26 oct. ENTIÈRE (110 €) ; › ⇒ retour ; › grisé sur la semaine en cours.
//  L  Le lien du lundi matin (`lundi=2026-10-26`) ouvre la semaine passée.
//  J  Ma journée et Statistiques mènent à « Ma semaine ».
require('./_porte-banc.cjs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4523);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-ma-semaine');
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

// Le dimanche 8 nov. 2026, 19 h à Paris (UTC+1 en hiver).
const MAINTENANT = Date.parse('2026-11-08T18:00:00Z');
const P = (j, h, mi = 0) => new Date(Date.parse(`2026-${j}T00:00:00Z`) + ((h - 1) * 60 + mi) * 60000).toISOString();   // heure de Paris (hiver)
const vente = (tx, titre, prix, date) => ({ transaction_id: tx, conversation_id: tx + 1000, title: titre, price: { amount: prix.toFixed(2), currency_code: 'EUR' }, status: 'Commande finalisée', date });
const VENTES = [
  vente(9201, 'Nike Air Max 90 taille 42', 60, P('11-02', 10)),
  vente(9202, 'Adidas Samba OG taille 41', 45, P('11-04', 15)),
  vente(9203, 'Nike Dunk Low taille 44', 30, P('11-08', 18, 30)),
  vente(9204, 'Jordan 1 taille 43', 777, P('11-08', 21)),
  vente(9205, 'New Balance 550 taille 42', 50, P('10-27', 10)),
  vente(9206, 'Asics Gel taille 40', 20, P('10-30', 9)),
  vente(9207, 'Puma Suede taille 41', 40, P('11-01', 20)),
];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
// La publication du bénéfice (forme de `jourBeneficeEnTableau` : n, ca, frais, nCout, cout, caCouvert, … en centimes).
const jb = (eur, achat) => [1, eur * 100, 0, achat == null ? 0 : 1, achat == null ? 0 : achat * 100, achat == null ? 0 : eur * 100, 0, 0, 0, 0, 0, 0];
const BENEF = { at: MAINTENANT - 3600e3, jours: { '2026-11-02': jb(60, 20), '2026-11-04': jb(45, 15), '2026-11-08': jb(30, null), '2026-10-27': jb(50, 30), '2026-10-30': jb(20, 5) } };
const SHIP = { 9201: P('11-03', 10), 9202: P('11-05', 10), 9205: P('10-28', 10) };
const DORMENT = { n: 4, total: 20, datesKnown: 20, at: MAINTENANT - 3600e3 };
const ROWS = [
  { id: 'harvest_111_listings', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { items: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: new Date(MAINTENANT - 60000).toISOString(), payload: { my_orders: VENTES } } },
];
// Les attendus, À LA MAIN.
const ATTENDU = { vendu: '13500', ventes: '3', ecartVendu: '6500', ecartVentes: '100', brut: '7000', colis: '2', dorment: '4',
  jours: { '2026-11-02': '6000', '2026-11-03': '0', '2026-11-04': '4500', '2026-11-05': '0', '2026-11-06': '0', '2026-11-07': '0', '2026-11-08': '3000' },
  avant: { lundi: '2026-10-26', vendu: '11000', ventes: '3' } };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
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
async function preparer(b, vp, { theme = 'light' } = {}) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: theme, timezoneId: 'Europe/Paris', locale: 'fr-FR', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  await pg.clock.setFixedTime(new Date(MAINTENANT));
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const MAIN = { vinted_dark: theme === 'dark', vinted_ship_done: SHIP, vrm_benefice_jours: BENEF, vrm_paires_dorment: DORMENT };
  await pg.addInitScript(([sombre, benef, dorment, ship]) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
    localStorage.setItem('vinted_dark', JSON.stringify(sombre)); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair'));
    localStorage.setItem('vrm_benefice_jours', JSON.stringify(benef)); localStorage.setItem('vrm_paires_dorment', JSON.stringify(dorment)); localStorage.setItem('vinted_ship_done', JSON.stringify(ship));
  } catch (_) {} }, [theme === 'dark', BENEF, DORMENT, SHIP]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
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
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: true }).catch(() => {});
const attendre = async (pg) => {
  await pg.waitForSelector('[data-ma-semaine]', { timeout: 30000 });
  await pg.waitForFunction(() => { const e = document.querySelector('[data-ms-chiffre="vendu"] [data-ms-valeur]'); return e && e.getAttribute('data-ms-valeur') !== ''; }, null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(800);
};
const lire = (pg) => pg.evaluate(() => {
  const r = document.querySelector('[data-ma-semaine]');
  const ch = (k) => { const w = document.querySelector(`[data-ms-chiffre="${k}"]`); if (!w) return null; const v = w.querySelector('[data-ms-valeur]'); const e = w.querySelector('[data-ms-ecart]');
    return { v: v ? v.getAttribute('data-ms-valeur') : null, partiel: v ? v.getAttribute('data-partiel') : null, ecart: e ? e.getAttribute('data-ms-ecart') : null, sens: e ? e.getAttribute('data-sens') : null, h: Math.round(w.getBoundingClientRect().height), tag: w.tagName }; };
  return { lundi: r && r.getAttribute('data-ma-semaine'), enCours: r && r.getAttribute('data-ms-en-cours'),
    vendu: ch('vendu'), ventes: ch('ventes'), brut: ch('brut'), recu: ch('recu'), colis: ch('colis'), dorment: ch('dorment'),
    jours: Object.fromEntries([...document.querySelectorAll('[data-ms-jour]')].map((l) => [l.getAttribute('data-ms-jour'), l.getAttribute('data-ms-jour-valeur')])),
    prec: (document.querySelector('[data-ms-prec]') || {}).disabled, suiv: (document.querySelector('[data-ms-suiv]') || {}).disabled };
});
// Le visuel : couleurs, cibles, débordement, mots.
const visuel = (pg) => pg.evaluate(() => {
  const r = document.querySelector('[data-ma-semaine]'); if (!r) return null;
  const rgb = (s) => (/rgba?\(([^)]+)\)/.exec(s || '') || [, ''])[1].split(',').map((x) => parseFloat(x));
  const vif = [];
  for (const e of r.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    for (const p of ['color', 'backgroundColor']) {
      const [R, G, B, A = 1] = rgb(cs[p]); if (!(A > 0.3)) continue;
      if (R > 180 && G < 110 && B < 110) vif.push(`${e.className} ${p} rouge ${cs[p]}`);
      if (G > 150 && R < 120 && B < 140) vif.push(`${e.className} ${p} vert ${cs[p]}`);
    }
  }
  const petits = [...r.querySelectorAll('button')].filter((b) => { const x = b.getBoundingClientRect(); return x.width > 0 && (x.height < 44 || x.width < 44); }).map((b) => `${b.className} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`);
  const mots = [...r.querySelectorAll('.vrm-ms-w, .vrm-ms-nav, .vrm-ms-pied')].map((w) => { const c = w.cloneNode(true); c.querySelectorAll('.vrm-ms-barres').forEach((x) => x.remove()); const t = (c.innerText || c.textContent || '').trim(); const n = t.split(/\s+/).filter((m) => /[A-Za-zÀ-ÿ]/.test(m)).length; return { k: w.getAttribute('data-ms-chiffre') || w.className, n, t: t.replace(/\s+/g, ' ') }; });
  const barres = [...r.querySelectorAll('.vrm-ms-jour')].map((l) => { const b = l.querySelector('.vrm-ms-barre'); const after = getComputedStyle(b, '::after'); return { j: l.getAttribute('data-ms-jour'), h: parseFloat(after.height) || 0, H: b.getBoundingClientRect().height }; });
  return { vif, petits, deborde: document.scrollingElement.scrollWidth - window.innerWidth, mots, barres, titre: (document.querySelector('.vrm-screen-head .vrm-display') || {}).textContent || '' };
});

async function main() {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const theme of ['light', 'dark']) {
      const T = `${vp.width}px ${theme === 'dark' ? 'sombre' : 'clair'}`;
      await essaie('N ' + T, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { theme });
        await pg.goto(`http://localhost:${PORT}/?tab=semaine&lundi=2026-11-02`, { waitUntil: 'domcontentloaded' });
        await attendre(pg);
        const s = await lire(pg);
        dit(s.lundi === '2026-11-02' && s.enCours === '1', `N ${T} : la notification ouvre la semaine en cours (2 nov.)`, `${s.lundi} ${s.enCours}`);
        dit(s.vendu && s.vendu.v === ATTENDU.vendu && !s.vendu.partiel, `N ${T} : vendu 135 € (la vente de 21 h, à venir, hors)`, JSON.stringify(s.vendu));
        dit(s.ventes && s.ventes.v === ATTENDU.ventes, `N ${T} : 3 ventes`, JSON.stringify(s.ventes));
        dit(s.vendu && s.vendu.ecart === ATTENDU.ecartVendu && s.vendu.sens === 'hausse', `N ${T} : +65 € vs la semaine d’avant au même moment`, JSON.stringify(s.vendu));
        dit(s.ventes && s.ventes.ecart === ATTENDU.ecartVentes && s.ventes.sens === 'hausse', `N ${T} : +1 vente`, JSON.stringify(s.ventes));
        dit(JSON.stringify(s.jours) === JSON.stringify(ATTENDU.jours), `N ${T} : une barre par jour, le vendu de chacun`, JSON.stringify(s.jours));
        dit(s.brut && s.brut.v === ATTENDU.brut && s.brut.partiel === '1' && s.brut.ecart === '', `N ${T} : bénéfice « au moins 70 € » (2 sur 3), SANS flèche`, JSON.stringify(s.brut));
        dit(s.colis && s.colis.v === ATTENDU.colis && s.colis.ecart === '', `N ${T} : colis envoyés 2 (au moins), sans flèche`, JSON.stringify(s.colis));
        dit(s.dorment && s.dorment.v === ATTENDU.dorment, `N ${T} : 4 paires qui dorment (la publication d’Annonces)`, JSON.stringify(s.dorment));
        dit(s.recu && s.recu.v === '' && s.recu.ecart === '', `N ${T} : reçu pas publié ⇒ « — », sans flèche`, JSON.stringify(s.recu));
        dit(s.suiv === true && s.prec === false, `N ${T} : › grisé sur la semaine en cours, ‹ actif`);
        const v = await visuel(pg);
        dit(v && !v.vif.length, `V ${T} : aucune couleur rouge ni verte`, v && v.vif.slice(0, 3).join(' | '));
        dit(v && !v.petits.length, `V ${T} : chaque bouton fait au moins 44 px`, v && v.petits.join(' | '));
        dit(v && v.deborde <= 0, `V ${T} : aucun débordement horizontal`, v && String(v.deborde));
        dit(v && v.mots.every((m) => m.n <= 12), `V ${T} : ≤ 12 mots par bloc`, v && v.mots.filter((m) => m.n > 12).map((m) => `${m.k}:${m.n} « ${m.t} »`).join(' | '));
        const lun = v && v.barres.find((x) => x.j === '2026-11-02'), mer = v && v.barres.find((x) => x.j === '2026-11-04'), mar = v && v.barres.find((x) => x.j === '2026-11-03');
        dit(lun && mer && mar && lun.h > mer.h && mer.h > 0 && mar.h === 0, `V ${T} : la barre la plus haute est lundi, mardi n’en a pas`, v && JSON.stringify(v.barres.map((x) => Math.round(x.h))));
        dit(v && /Ma semaine/.test(v.titre), `V ${T} : le titre de l’écran`, v && v.titre);
        await shot(pg, `ma-semaine-${vp.width}-${theme}`);
        // S : ‹ puis ›
        if (vp.width === 390 && theme === 'light' || vp.width === 1512 && theme === 'dark') {
          await pg.click('[data-ms-prec]'); await pg.waitForTimeout(400);
          const a = await lire(pg);
          dit(a.lundi === ATTENDU.avant.lundi && a.enCours === '0' && a.vendu.v === ATTENDU.avant.vendu && a.ventes.v === ATTENDU.avant.ventes && a.suiv === false, `S ${T} : ‹ ⇒ la semaine du 26 oct. ENTIÈRE (110 €, 3 ventes)`, JSON.stringify({ l: a.lundi, v: a.vendu, n: a.ventes }));
          await shot(pg, `ma-semaine-${vp.width}-${theme}-avant`);
          await pg.click('[data-ms-suiv]'); await pg.waitForTimeout(400);
          const r = await lire(pg);
          dit(r.lundi === '2026-11-02' && r.vendu.v === ATTENDU.vendu, `S ${T} : › ⇒ retour à la semaine en cours`, r.lundi);
        }
        dit(!errs.length, `N ${T} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
    await essaie('L', async () => {
      const { ctx, pg } = await preparer(b, { width: 390, height: 844 });
      await pg.goto(`http://localhost:${PORT}/?tab=semaine&lundi=2026-10-26`, { waitUntil: 'domcontentloaded' });
      await attendre(pg);
      const s = await lire(pg);
      dit(s.lundi === '2026-10-26' && s.enCours === '0' && s.vendu.v === ATTENDU.avant.vendu, 'L : le lien du lundi matin ouvre la semaine passée (110 €)', JSON.stringify({ l: s.lundi, v: s.vendu }));
      await ctx.close();
    });
    for (const [nom, tab, vp] of [['Ma journée', 'journee', { width: 390, height: 844 }], ['Ma journée', 'journee', { width: 1512, height: 950 }], ['Statistiques', 'dashboard', { width: 390, height: 844 }]]) await essaie('J ' + nom, async () => {
      const { ctx, pg } = await preparer(b, vp);
      await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-ouvre-ma-semaine]', { timeout: 30000 });
      await pg.waitForTimeout(800); await shot(pg, `ma-semaine-lien-${tab}-${vp.width}`);
      await pg.click('[data-ouvre-ma-semaine]');
      await attendre(pg);
      const s = await lire(pg);
      dit(s.lundi === '2026-11-02' && s.vendu.v === ATTENDU.vendu, `J ${vp.width} : ${nom} mène à « Ma semaine » (semaine en cours)`, s.lundi);
      await ctx.close();
    });
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko ? 'KO' : 'OK'} — banc ma-semaine : ${ko} échec(s). Captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
}
main();
