// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA SANTÉ DE CHAQUE COMPTE VINTED (11 nov., lot sante-comptes)
//        (node scripts/bancs/sante-comptes.cjs — après `npm run build`)
//        BANC_PORT=… · BANC_DIST=… · BANC_SHOTS=<dossier> pour les captures
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (dépôt public) à la forme MESURÉE :
//   · compte_a (111) : note 0,98, 20 avis 5★, 4 ventes finalisées, actif ⇒ « En forme » ;
//   · compte_b (222) : note 0,96, 2 colis déposés APRÈS la date limite lue dans l'e-mail
//     du bordereau (« Colis fait » daté), 3 ventes annulées sur 6 ⇒ « À surveiller »,
//     LA raison « 2 colis envoyés après la date limite », LE geste « Voir » ⇒ Ventes ;
//   · scénario « tout va bien » : compte_b sans retard ni annulation ⇒ AUCUNE ligne
//     dans Ma journée (seulement quand un compte glisse).
// Il exige, à 390 px tactile et 1512 px, en clair ET en sombre :
//   Statistiques : la carte, deux comptes, états et raison ; « Pourquoi ? » montre les
//     7 points (valeur, seuil, source ; « — » + raison si pas su) ; cibles ≥ 44 px ;
//   Paramètres → Mes comptes : le panneau « Santé des comptes » ;
//   Ma journée : la ligne ambre (jamais rouge) seulement quand un compte glisse ;
//   aucun débordement, aucune erreur, aucun rouge, aucune écriture en base.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4437;
const SHOTS = process.env.BANC_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'sante-comptes-'));
fs.mkdirSync(SHOTS, { recursive: true });

const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
// « JJ/MM/AAAA HH h MM » (la forme mesurée de l'e-mail du bordereau), heure de Paris.
const limiteFr = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return `${p.day}/${p.month}/${p.year} ${p.hour} h ${p.minute}`; };
const fin = "Commande finalisée - l'acheteur a validé la commande";
const v = (tx, title, status, tus, h) => ({ transaction_id: tx, title, status, transaction_user_status: tus, conversation_id: '2461867' + tx, date: ilYaH(h), price: { amount: '70.0', currency_code: 'EUR' } });
const VENTES_A = [v(9101, 'Nike Dunk Low 42', fin, 'completed', 60), v(9102, 'Nike Dunk Low 43', fin, 'completed', 120), v(9103, 'Nike Dunk Low 44', fin, 'completed', 200), v(9104, 'Nike Dunk Low 45', fin, 'completed', 300)];
const venteB = (mauvais) => [
  v(9201, 'Air Max 90 41', fin, 'completed', 5 * 24), v(9202, 'Air Max 90 42', fin, 'completed', 8 * 24), v(9203, 'Air Max 90 43', fin, 'completed', 12 * 24),
  v(9204, 'Air Max 90 44', mauvais ? 'Commande annulée' : fin, mauvais ? 'cancelled' : 'completed', 3 * 24),
  v(9205, 'Air Max 90 45', mauvais ? 'Commande annulée' : fin, mauvais ? 'cancelled' : 'completed', 6 * 24),
  v(9206, 'Air Max 90 46', mauvais ? 'Commande annulée' : fin, mauvais ? 'cancelled' : 'completed', 9 * 24),
];
const venteMs = (h) => MAINTENANT - h * H;
// Colis fait : compte_a en 20 h ; compte_b 9201 et 9202 déposés 4 j après la vente, limite lue à +2 j.
const shipDe = (mauvais) => ({
  9101: venteMs(60) + 20 * H, 9102: venteMs(120) + 22 * H, 9103: venteMs(200) + 18 * H, 9104: venteMs(300) + 26 * H,
  9201: venteMs(5 * 24) + (mauvais ? 4 * J : 20 * H), 9202: venteMs(8 * 24) + (mauvais ? 4 * J : 20 * H), 9203: venteMs(12 * 24) + 20 * H,
  ...(mauvais ? {} : { 9204: venteMs(3 * 24) + 20 * H, 9205: venteMs(6 * 24) + 20 * H, 9206: venteMs(9 * 24) + 20 * H }),
});
const bord = (tx, uid, h) => ({ id: `email_bord_${tx}`, data: { uid, type: 'bordereau', suivi: '3SBX' + tx, transaction: String(tx), receivedAt: ilYaH(h - 1), filename: `b${tx}.pdf`, modele: 'Air Max 90', transporteur: 'mondialrelay', dateLimite: limiteFr(venteMs(h) + 2 * J) } });
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: ilYaH(0) },
];
const AVIS = Array.from({ length: 20 }, (_, i) => ({ id: String(9000000020 - i), rating: 5, feedback: 'Parfait' }));
const rowsDe = ({ sombre, mauvais }) => [
  { id: 'main', data: { vinted_dark: !!sombre, vinted_ship_done: shipDe(mauvais) } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: VENTES_A } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: venteB(mauvais) } } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: [], pagination: { total_entries: 0 } } } },
  { id: 'harvest_222_listings', data: { capturedAt: ilYaH(0.2), payload: { items: [], pagination: { total_entries: 0 } } } },
  ...[[9201, '222', 5 * 24], [9202, '222', 8 * 24], [9203, '222', 12 * 24]].map(([tx, u, h]) => bord(tx, u, h)),
  { id: 'harvest_111_profile', data: { uid: '111', capturedAt: ilYaH(2), payload: { user: { login: 'compte_a', feedback_reputation: 0.98, feedback_count: 120, positive_feedback_count: 120, neutral_feedback_count: 0, negative_feedback_count: 0 } } } },
  { id: 'harvest_222_profile', data: { uid: '222', capturedAt: ilYaH(3), payload: { user: { login: 'compte_b', feedback_reputation: 0.96, feedback_count: 48, positive_feedback_count: 47, neutral_feedback_count: 1, negative_feedback_count: 0 } } } },
  { id: 'harvest_111_feedbacks', data: { type: 'feedbacks', uid: '111', capturedAt: ilYaH(3), nItems: 20, payload: { user_feedbacks: AVIS, pagination: { total_entries: 120, total_pages: 6 }, historique: [{ at: ilYaH(24 * 34), total: 100, n: 20, c: [0, 0, 1, 1, 18] }, { at: ilYaH(3), total: 120, n: 20, c: [0, 0, 0, 0, 20] }] } } },
  { id: 'panel_comptes_etat', data: { comptes: { 111: { etat: 'actif', at: ilYaH(2) }, 222: { etat: 'actif', at: ilYaH(3) } } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 600)); } };
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
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
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
const reDe = (motif) => new RegExp('^' + motif.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

async function preparer(b, vp, { sombre = false, mauvais = true } = {}) {
  const ROWS = rowsDe({ sombre, mauvais });
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecritures = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/supabase\.co/.test(r.request().url()) ? r.continue() : r.abort()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { if (/moderation|feedbacks|panel_comptes_etat|sante/.test(u + (req.postData() || ''))) ecritures.push(req.method() + ' ' + u); return j([]); }
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const typeEq = /[?&]data->>type=eq\.([^&]*)/.exec(u);
    const filtre = (r) => !typeEq || (r.data && String(r.data.type) === typeEq[1]);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const ou = /[?&]or=\(([^)]*)\)/.exec(u);
    if (ou && /id\.like\./.test(ou[1])) { const res = ou[1].split(',').map((x) => /^id\.like\.(.+)$/.exec(x.trim())).filter(Boolean).map((m) => reDe(m[1])); return j(ROWS.filter((r) => res.some((re) => re.test(r.id)) && filtre(r)).map(forme)); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = reDe(lk[1]); return j(ROWS.filter((r) => re.test(r.id) && filtre(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecritures };
}
async function sain(pg, ecran, sel) {
  const r = await pg.evaluate((sel) => {
    const rgb = (c) => (/rgba?\(([^)]+)\)/.exec(c) || [, ''])[1].split(',').map((x) => parseFloat(x));
    const rouge = [...document.querySelectorAll(sel)].some((root) => [root, ...root.querySelectorAll('*')].some((x) => { const cs = getComputedStyle(x); return [cs.color, cs.backgroundColor].some((c) => { const [r, g, b2, a] = rgb(c); return a !== 0 && r > 190 && g < 90 && b2 < 90; }); }));
    return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText, rouge };
  }, sel);
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
  dit(!r.rouge, `${ecran} : aucun rouge (§7)`);
}
const attendre = async (pg, sel, ms = 25000) => { await pg.waitForSelector(sel, { timeout: ms }).catch(() => {}); };
const publier = async (pg) => {
  // L'écran propriétaire (`Comptabilite`, monté par Ma journée) publie les envois.
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => { try { const p = JSON.parse(localStorage.getItem('vrm_sante_envois') || 'null'); return !!(p && p.l && p.l.length >= 7); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const nom = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`, suf = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
        console.log(`── ${nom}`);
        const { ctx, pg, errs, ecritures } = await preparer(b, vp, { sombre, mauvais: true });
        await essaie('publication', async () => {
          await publier(pg);
          const p = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_sante_envois') || 'null'); } catch (_) { return null; } });
          const l = p && Array.isArray(p.l) ? p.l : [];
          const b9201 = l.find((x) => x[0] === '9201');
          dit(!!b9201 && Number.isFinite(b9201[4]) && b9201[3] > b9201[4], 'publication : 9201 porte la limite LUE dans l’e-mail et un départ après elle', JSON.stringify(b9201));
          const a9101 = l.find((x) => x[0] === '9101');
          dit(!!a9101 && a9101[4] === null, 'publication : sans e-mail de bordereau, aucune limite (jamais l’estimée)', JSON.stringify(a9101));
        });
        await essaie('statistiques', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-stats-carte="sante-comptes"] [data-sc-compte="222"]');
          await pg.waitForFunction(() => { const c = document.querySelector('[data-sc-compte="111"]'); return c && c.getAttribute('data-sc-etat') !== 'passu'; }, null, { timeout: 20000 }).catch(() => {});
          await pg.waitForTimeout(800);
          const s = await pg.evaluate(() => {
            const a = document.querySelector('[data-sc-compte="111"]'), b2 = document.querySelector('[data-sc-compte="222"]');
            const r = b2 && b2.querySelector('[data-sc-raison-texte]');
            const g = b2 && b2.querySelector('[data-sc-geste]');
            const gr = g && g.getBoundingClientRect(), pr = b2 && b2.querySelector('[data-sc-pourquoi]').getBoundingClientRect();
            return { a: a && a.getAttribute('data-sc-etat'), b: b2 && b2.getAttribute('data-sc-etat'), k: b2 && b2.getAttribute('data-sc-raison-k'), al: b2 && b2.getAttribute('data-sc-alertes'), r: r && r.innerText, geste: g && g.getAttribute('data-sc-geste'), gh: gr && gr.height, ph: pr && pr.height, couleur: r && getComputedStyle(r.parentElement).color, entete: (document.querySelector('[data-sc-entete]') || {}).innerText };
          });
          dit(s.a === 'forme', 'Stats : compte_a « En forme »', JSON.stringify(s));
          dit(s.b === 'surveiller' && s.k === 'retards' && /2 colis envoyés après la date limite/.test(s.r || '') && /annulees/.test(s.al || ''), 'Stats : compte_b « À surveiller » — LA raison : 2 colis envoyés après la date limite (les annulations aussi, dites « +1 »)', JSON.stringify(s));
          dit(s.geste === '?tab=ventes' && s.gh >= 44 && s.ph >= 44, 'Stats : « Voir » mène à Ventes ; « Voir » et « Pourquoi ? » font 44 px', JSON.stringify(s));
          dit(/1 à surveiller/.test(s.entete || ''), 'Stats : l’en-tête dit « 1 à surveiller »', s.entete);
          await pg.click('[data-sc-compte="222"] [data-sc-pourquoi]');
          await pg.waitForTimeout(300);
          const i = await pg.evaluate(() => [...document.querySelectorAll('[data-sc-compte="222"] [data-sc-ind]')].map((x) => ({ k: x.getAttribute('data-sc-ind'), lu: x.getAttribute('data-sc-lu'), al: x.getAttribute('data-sc-alerte'), t: x.innerText })));
          dit(i.length === 7, 'Pourquoi ? : les 7 points se lisent', String(i.length));
          const r = i.find((x) => x.k === 'retards') || {}, an = i.find((x) => x.k === 'annulees') || {}, av = i.find((x) => x.k === 'avisBas') || {}, no = i.find((x) => x.k === 'note') || {};
          dit(r.al === '1' && /2 sur 3 colis/.test(r.t) && /date limite lue/.test(r.t), 'Pourquoi ? : retards 2 sur 3, seuil et source (« date limite lue ») écrits', r.t);
          dit(an.al === '1' && /3 sur 6/.test(an.t) && /qui a annulé/.test(an.t), 'Pourquoi ? : annulations 3 sur 6, « Vinted ne dit pas qui a annulé »', an.t);
          dit(av.lu === '0' && /—/.test(av.t) && /ouvre ton profil Vinted/.test(av.t), 'Pourquoi ? : avis de compte_b pas lus ⇒ « — » + raison et geste', av.t);
          dit(no.lu === '1' && /4,8\/5/.test(no.t) && /À surveiller sous 4,5\/5/.test(no.t), 'Pourquoi ? : note 4,8/5 et son seuil écrit', no.t);
          const carte = await pg.$('[data-stats-carte="sante-comptes"]'); if (carte) await carte.screenshot({ path: path.join(SHOTS, `stats-${suf}.png`) });
          await sain(pg, `${nom} Statistiques`, '[data-stats-carte="sante-comptes"]');
        });
        await essaie('reglages', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=settings&section=santecomptes`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-sante-comptes="reglages"] [data-sc-compte="222"]');
          await pg.waitForTimeout(800);
          const s = await pg.evaluate(() => { const p = document.querySelector('[data-sante-comptes="reglages"]'); return p ? { n: p.querySelectorAll('[data-sc-compte]').length, b: (p.querySelector('[data-sc-compte="222"]') || {}).getAttribute && p.querySelector('[data-sc-compte="222"]').getAttribute('data-sc-etat') } : null; });
          dit(s && s.n === 2 && s.b === 'surveiller', 'Paramètres → Mes comptes : le panneau, deux comptes, compte_b à surveiller', JSON.stringify(s));
          const p = await pg.$('[data-sante-comptes="reglages"]'); if (p) await pg.screenshot({ path: path.join(SHOTS, `reglages-${suf}.png`) });
          await sain(pg, `${nom} Paramètres`, '[data-sante-comptes="reglages"]');
        });
        await essaie('journee', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-journee-sante]');
          await pg.waitForTimeout(600);
          const s = await pg.evaluate(() => { const x = document.querySelector('[data-journee-sante]'); if (!x) return null; const n = x.querySelector('[data-sous-ligne="sante-comptes"]'); return { uids: x.getAttribute('data-journee-sante'), t: x.innerText, c: n && getComputedStyle(n, '::before').backgroundColor, urgent: !!(n && n.classList.contains('is-urgent')), geste: x.getAttribute('data-sc-geste'), h: x.getBoundingClientRect().height }; });
          dit(s && s.uids === '222' && /compte_b à surveiller/.test(s.t) && /2 colis envoyés après la date limite/.test(s.t), 'Ma journée : UNE ligne « compte_b à surveiller » et LA raison', JSON.stringify(s));
          const ambre = s && (() => { const [r, g, bb] = (/rgba?\(([^)]+)\)/.exec(s.c) || [, ''])[1].split(',').map(Number); return r > 150 && g > 60 && g < 160 && bb < 80; })();
          dit(ambre && s.urgent, 'Ma journée : la raison porte le point AMBRE (`is-urgent`, la forme des autres gestes)', s && s.c);
          const el = await pg.$('[data-journee-sante]'); if (el) await el.screenshot({ path: path.join(SHOTS, `journee-${suf}.png`) });
          await sain(pg, `${nom} Ma journée`, '[data-journee-sante]');
        });
        dit(!errs.length, `${nom} : aucune erreur de page`, errs.join(' | ').slice(0, 400));
        dit(!ecritures.length, `${nom} : aucune écriture en base pour la santé`, ecritures.join(' | '));
        await ctx.close();
      }
    }
    // Tout va bien ⇒ rien dans Ma journée.
    await essaie('tout va bien', async () => {
      const { ctx, pg } = await preparer(b, { width: 390, height: 844 }, { mauvais: false });
      await publier(pg);
      await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
      await attendre(pg, '[data-stats-carte="sante-comptes"] [data-sc-compte="222"]');
      await pg.waitForTimeout(1000);
      const etats = await pg.evaluate(() => [...document.querySelectorAll('[data-sc-compte]')].map((x) => x.getAttribute('data-sc-etat')).join(','));
      dit(etats === 'forme,forme', 'tout va bien : les deux comptes « En forme »', etats);
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await attendre(pg, '.vrm-fu-afaire, [data-tout-a-jour]', 25000);
      await pg.waitForTimeout(2500);
      const n = await pg.evaluate(() => document.querySelectorAll('[data-journee-sante]').length);
      dit(n === 0, 'tout va bien : AUCUNE ligne dans Ma journée', String(n));
      await ctx.close();
    });
  } catch (e) { dit(false, 'banc', e && e.stack); }
  finally { if (b) await b.close(); srv.close(); console.log(`\nCaptures : ${SHOTS}`); console.log(ko ? `\n❌ sante-comptes : ${ko} rouge(s)` : '\n✅ sante-comptes : tout est vert'); process.exit(ko ? 1 : 0); }
})();
