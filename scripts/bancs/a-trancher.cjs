// ── BANC : « À TRANCHER » (9 nov. 2026, lot AC) ─────────────────────────────────
//        npm run build && node scripts/bancs/a-trancher.cjs [dist]
//        SHOTS=dossier  BANC_PORT=4497  AT_SEUL=S|G|T|J|Z (une partie)
// Données INVENTÉES (le dépôt est public). Un compte Vinted `compte_banc` (111) dont
// la dernière lecture date de 3 jours (⇒ « 1 compte à relire », la règle de la puce
// de Colis), une adresse de réception sans compte (`achat@exemple.test`), et — rangés
// sur l'appareil comme les écrans propriétaires les publient — un cas de CHAQUE autre
// source : `vrm_a_trancher` (N° portés deux fois 1, colis cochés « posté » 2, N° à
// écrire 1, N° à vérifier 3, SMS Vestiaire 1, SMS Pickup 1, supprimés de Vinted 1,
// remise en ligne 1, sans prix d'achat 4), `vrm_colis_retirer` (aVerifier 2) et
// `vinted_urssaf_mois` (aDater 5). Les attendus sont faits À LA MAIN.
// Jugé sur des data-* et des nombres rendus, jamais un libellé seul.
//  S  À trancher, 1512 clair et 390 tactile sombre : 12 lignes, une par source, dans
//     l'ordre (ce qui coûte un colis d'abord) ; le total (23) = la somme des sources
//     rangées, relue dans la page ; l'adresse jamais comptée est « — » (pas su) et le
//     total est « au moins » ; le badge de la navigation dit 23 ; AUCUNE écriture vers
//     la base pendant que l'écran est ouvert, sans geste.
//  G  Chaque geste ouvre le bon endroit (1512) : l'écran (entrée allumée de la colonne),
//     l'onglet de Colis (envoyer / envoyés / à retirer), la vue « Sans achat relié »,
//     la vue « Relier » des e-mails et son bloc d'adresses.
//  T  Trancher une chose la fait sortir : l'adresse est comptée par SON écran (1), puis
//     « C'est un compte acheteur » (son geste, confirmé) ⇒ elle sort, total et badge
//     baissent d'autant ; l'écriture part sur ce geste-là seulement.
//  J  Ma journée (390 sombre) : la ligne « N choses à trancher » porte la somme des
//     sources rangées à cet instant ; la toucher ouvre À trancher.
//  Z  Rien à trancher (tout à 0, lecture fraîche) : « Rien à trancher », aucun badge,
//     aucune ligne dans Ma journée.
require('./_porte-banc.cjs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4497);
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-a-trancher');
const SEUL = process.env.AT_SEUL || '';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const UID = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';   // la session de banc (_porte-banc.cjs)
const MAINTENANT = Date.now();
const iso = (t) => new Date(t).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT) }];
const lignesBase = (ageMs, zero = false) => [
  // Les annonces : lues il y a une minute (une annonce en ligne, pour que la barre d'Annonces existe) ;
  // seules les VENTES ont l'âge voulu (la fraîcheur « compte à relire » se lit sur `orders_sold`).
  { id: 'harvest_111_listings', data: { capturedAt: iso(MAINTENANT - 60000), payload: { items: zero ? [] : [{ id: 800001, title: 'Nike Dunk Low taille 42', price: { amount: '60', currency_code: 'EUR' }, created_at_ts: Math.floor((MAINTENANT - 5 * 86400e3) / 1000), promoted: false }] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MAINTENANT - ageMs), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MAINTENANT - ageMs), payload: { my_orders: [] } } },
  { id: 'email_reception_1', data: { at: iso(MAINTENANT - 3600e3), adresses: ['achat@exemple.test'] } },
  { id: 'vrm_email_owners', data: { adresses: {} } },
];
// Ce que les écrans propriétaires ont rangé sur l'appareil (forme réelle, src/aTrancher.js).
const SEMIS = { 'numeros-double': 1, 'colis-postes': 2, 'numeros-a-ecrire': 1, 'numeros-a-verifier': 3, 'sms-vestiaire': 1, 'sms-pickup': 1, 'supprimes-vinted': 1, 'remise-en-ligne': 1, 'achats-sans-prix': 4 };
const RETIRER = { total: 0, prets: 0, sansCode: 0, aVerifier: 2, urgents: 0, enVerification: 0 };
const ADATER = 5;
// Attendu À LA MAIN : 1+2+2+1+3+1+1+1+1+4 + 1 compte à relire + 5 à dater = 23.
const TOTAL_MAIN = 23;
const PUBLIEES = JSON.parse((/export const CLES_PUBLIEES = (\[[^\]]*\])/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'fileEnvoi.js'), 'utf8')) || [, '[]'])[1].replace(/'/g, '"'));
const ORDRE = ['numeros-double', 'colis-postes', 'colis-retirer', 'numeros-a-ecrire', 'numeros-a-verifier', 'sms-vestiaire', 'sms-pickup', 'supprimes-vinted', 'remise-en-ligne', 'achats-sans-prix', 'comptes-a-relire', 'ventes-a-dater'];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  if (f === '/' || !path.extname(f)) f = '/index.html';
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
    if (src === 'updated_at') { out[alias] = iso(MAINTENANT); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
// Un contexte : la base servie, les semis rangés UNE fois (au premier chargement).
async function contexte(b, vp, { theme = 'light', zero = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: theme, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  // L'annonce porte déjà son N° (posé à la main) : aucun écran n'a à la numéroter pendant le banc.
  const MAIN = { vinted_dark: theme === 'dark', vinted_account_emails: {}, ...(zero ? {} : { vinted_annonce_numeros: { '800001': { numero: '7', title: 'Nike Dunk Low taille 42', auto: false, manuelAt: iso(MAINTENANT - 86400e3) } } }) };
  const ROWS = lignesBase(zero ? 60000 : 3 * 86400e3, zero);
  const semis = { uid: UID, s: Object.fromEntries(Object.entries(SEMIS).map(([k, n]) => [k, { n: zero ? 0 : n, at: MAINTENANT }])) };
  if (zero) semis.s['adresses-sans-compte'] = { n: 0, at: MAINTENANT };
  const retirer = { ...RETIRER, aVerifier: zero ? 0 : RETIRER.aVerifier, at: MAINTENANT };
  const urssaf = { mois: [], aDater: { n: zero ? 0 : ADATER, ca: 0, par: {} }, at: MAINTENANT };
  await ctx.addInitScript(([sombre, semis, retirer, urssaf]) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
    localStorage.setItem('vinted_dark', JSON.stringify(sombre)); localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair'));
    if (!localStorage.getItem('__banc_seme')) { localStorage.setItem('__banc_seme', '1');
      localStorage.setItem('vrm_a_trancher', JSON.stringify(semis)); localStorage.setItem('vrm_colis_retirer', JSON.stringify(retirer)); localStorage.setItem('vinted_urssaf_mois', JSON.stringify(urssaf)); }
  } catch (_) {} }, [theme === 'dark', semis, retirer, urssaf]);
  const ecritures = [];   // [{ t, ids }] : chaque écriture vers la base
  const servir = (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) }).catch(() => {});
    if (route.request().method() !== 'GET') {
      let d = []; try { const x = JSON.parse(route.request().postData() || '[]'); d = Array.isArray(x) ? x : [x]; } catch (_) {}
      const ids = d.map((x) => (x && x.id) || '?');
      const cles = d.map((x) => (x && x.data && typeof x.data === 'object') ? Object.keys(x.data) : []).flat();
      // Le signe de vie du jour de la coque (`vrm_vu`, une fois par jour et par appareil, le JOUR seul) part
      // à la première ouverture quel que soit l'écran : ce n'est pas un geste ni une donnée — hors du compte.
      if (/\/rest\/v1\//.test(u) && !(ids.length === 1 && ids[0] === 'vrm_vu')) ecritures.push({ t: Date.now(), ids, cles, url: u.replace(/^https?:\/\/[^/]+/, '').slice(0, 80) });
      const m = d.find((x) => x && (x.id === 'main' || /id=eq\.main/.test(u)) && x.data && typeof x.data === 'object'); if (m) Object.assign(MAIN, m.data);
      return j(d);
    }
    if (/\/app_data\?select=owner&limit=1$/.test(u)) return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' }).catch(() => {});
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j([projette({ id: 'main', data: MAIN }, sel)]);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j([]);
  };
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await ctx.route('**/rest/v1/**', servir);
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, ecritures, MAIN };
}
const shot = (pg, nom) => pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: false }).catch(() => {});
const aller = async (pg, tab) => { await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' }); };
const ecranTrancher = async (pg) => { await pg.waitForSelector('[data-a-trancher]', { timeout: 30000 }); await pg.waitForTimeout(1500); };
// Ce que l'écran rend.
const lire = (pg) => pg.evaluate(() => {
  const r = document.querySelector('[data-a-trancher]');
  const badge = document.querySelector('[data-badge-nav="trancher"]');
  return { total: r ? Number(r.getAttribute('data-a-trancher')) : null, partiel: r ? r.getAttribute('data-a-trancher-partiel') : null,
    lignes: [...document.querySelectorAll('[data-a-trancher-ligne]')].map((e) => ({ cle: e.getAttribute('data-a-trancher-ligne'), n: Number(e.getAttribute('data-n')), geste: !!e.querySelector('button') })),
    passu: [...document.querySelectorAll('[data-a-trancher-passu]')].map((e) => ({ cle: e.getAttribute('data-a-trancher-passu'), valeur: (e.querySelector('.vrm-ios-valeur') || {}).textContent || '' })),
    vide: (document.querySelector('[data-a-trancher-vide]') || { getAttribute: () => null }).getAttribute('data-a-trancher-vide'),
    badge: badge ? Number(badge.getAttribute('data-badge-n')) : null };
});
// La somme des sources RANGÉES à cet instant, relue dans la page (indépendante de l'écran) ;
// `comptes` : les comptes à relire, connus à la main (la lecture servie a 3 jours ou 1 min).
const sommeRangee = (pg, comptes) => pg.evaluate(([uid, comptes]) => {
  const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
  const p = j('vrm_a_trancher'); let s = 0;
  if (p && p.uid === uid) for (const v of Object.values(p.s || {})) s += Number(v.n) || 0;
  const r = j('vrm_colis_retirer'); if (r) s += (Number(r.aVerifier) || 0) + (Number(r.enVerification) || 0);
  const u = j('vinted_urssaf_mois'); if (u && u.aDater) s += Number(u.aDater.n) || 0;
  return s + comptes;
}, [UID, comptes]);
const actif = (pg) => pg.evaluate(() => {
  const e = document.querySelector('.vrm-rail-button[aria-current="page"]');
  const o = document.querySelector('[data-colis-onglet-choix][aria-pressed="true"]');
  return { ecran: e ? e.getAttribute('data-nav-entree') : null, onglet: o ? o.getAttribute('data-colis-onglet-choix') : null };
});

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const PC = { width: 1512, height: 950 }, TEL = { width: 390, height: 844 };

  // ── S ───────────────────────────────────────────────────────────────────────────
  if (!SEUL || SEUL === 'S') for (const [nom, vp, theme] of [['1512-clair', PC, 'light'], ['390-sombre', TEL, 'dark']]) await essaie('S ' + nom, async () => {
    const { ctx, ecritures } = await contexte(b, vp, { theme });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await aller(pg, 'trancher'); await ecranTrancher(pg);
    const e0 = ecritures.length;
    await pg.waitForTimeout(3000);
    const r = await lire(pg);
    const somme = await sommeRangee(pg, 1);
    dit(r.total === TOTAL_MAIN, `S ${nom} : le total est celui fait à la main`, `${r.total} / ${TOTAL_MAIN}`);
    dit(r.total === somme, `S ${nom} : le total = la somme des sources rangées`, `${r.total} / ${somme}`);
    dit(r.partiel === '1', `S ${nom} : une source pas comptée ⇒ « au moins »`, r.partiel);
    dit(JSON.stringify(r.lignes.map((l) => l.cle)) === JSON.stringify(ORDRE), `S ${nom} : une ligne par source, dans l'ordre (un colis d'abord)`, r.lignes.map((l) => l.cle).join(','));
    const nAttendu = { ...SEMIS, 'colis-retirer': 2, 'comptes-a-relire': 1, 'ventes-a-dater': ADATER };
    dit(r.lignes.every((l) => l.n === nAttendu[l.cle]), `S ${nom} : chaque ligne porte le nombre de sa source`, r.lignes.map((l) => `${l.cle}=${l.n}`).join(' '));
    dit(r.lignes.every((l) => l.geste), `S ${nom} : chaque ligne a UN geste`);
    dit(r.passu.length === 1 && r.passu[0].cle === 'adresses-sans-compte' && r.passu[0].valeur.trim() === '—', `S ${nom} : la source jamais comptée dit « — », pas 0`, JSON.stringify(r.passu));
    if (vp.width > 600) dit(r.badge === TOTAL_MAIN, `S ${nom} : le badge de la colonne = le total`, r.badge);
    dit(ecritures.length === e0, `S ${nom} : aucune écriture vers la base sans geste (écran ouvert 3 s)`, JSON.stringify(ecritures.slice(e0)));
    dit(!errs.length, `S ${nom} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
    await shot(pg, 'S-' + nom);
    await ctx.close();
  });

  // ── G ───────────────────────────────────────────────────────────────────────────
  const ATTENDU_G = {
    'numeros-double': { ecran: 'cat_bord', onglet: 'envoyer' }, 'colis-postes': { ecran: 'cat_bord', onglet: 'envoyes' },
    'colis-retirer': { ecran: 'cat_bord', onglet: 'retirer' }, 'numeros-a-ecrire': { ecran: 'cat_bord', onglet: 'envoyer' },
    'numeros-a-verifier': { ecran: 'annonces' }, 'sms-vestiaire': { ecran: 'cat_bord', onglet: 'envoyer' }, 'sms-pickup': { ecran: 'cat_bord', onglet: 'retirer' },
    'supprimes-vinted': { ecran: 'journee' }, 'remise-en-ligne': { ecran: 'annonces' }, 'achats-sans-prix': { ecran: 'annonces', tri: 'sansachat' },
    'comptes-a-relire': { comptes: true }, 'ventes-a-dater': { ecran: 'compta' }, 'adresses-sans-compte': { ecran: 'emails', relier: true },
  };
  if (!SEUL || SEUL === 'G') for (const cle of Object.keys(ATTENDU_G)) await essaie('G ' + cle, async () => {
    const { ctx, ecritures, MAIN } = await contexte(b, PC, {});
    const pg = await ctx.newPage();
    await aller(pg, 'trancher'); await ecranTrancher(pg);
    const avantMain = JSON.parse(JSON.stringify(MAIN));
    const sel = cle === 'adresses-sans-compte' ? `[data-a-trancher-passu="${cle}"] button` : `[data-a-trancher-ligne="${cle}"] button`;
    const e0 = ecritures.length;
    await pg.click(sel);
    const A = ATTENDU_G[cle];
    if (A.comptes) {
      await pg.waitForSelector('[data-comptes-lies]', { timeout: 20000 }).catch(() => {});
      const v = await pg.evaluate(() => ({ cl: !!document.querySelector('[data-comptes-lies]'), at: !!document.querySelector('[data-a-trancher]') }));
      dit(v.cl && !v.at, `G ${cle} : ouvre « Comptes liés »`, JSON.stringify(v));
    } else {
      await pg.waitForFunction((e) => { const x = document.querySelector('.vrm-rail-button[aria-current="page"]'); return x && x.getAttribute('data-nav-entree') === e; }, A.ecran, { timeout: 20000 }).catch(() => {});
      if (A.onglet) await pg.waitForFunction((o) => !!document.querySelector(`[data-colis-onglet-choix="${o}"][aria-pressed="true"]`), A.onglet, { timeout: 20000 }).catch(() => {});
      if (A.tri) await pg.waitForFunction((t) => !!document.querySelector(`[data-ann-tri="${t}"]`), A.tri, { timeout: 20000 }).catch(() => {});
      if (A.relier) await pg.waitForFunction(() => !!document.querySelector('[data-boite-vue="relier"][aria-selected="true"]') && !!document.querySelector('[data-adresses-sans-compte]'), null, { timeout: 20000 }).catch(() => {});
      const a = await actif(pg);
      dit(a.ecran === A.ecran, `G ${cle} : ouvre l'écran ${A.ecran}`, a.ecran);
      if (A.onglet) dit(a.onglet === A.onglet, `G ${cle} : sur l'onglet « ${A.onglet} » de Colis`, a.onglet);
      if (A.tri) dit(await pg.$(`[data-ann-tri="${A.tri}"]`) != null, `G ${cle} : sur la vue « Sans achat relié »`);
      if (A.relier) {
        const v = await pg.evaluate(() => { const el = document.querySelector('[data-adresses-sans-compte]'); if (!el) return null; const r = el.getBoundingClientRect(); return { n: el.getAttribute('data-adresses-sans-compte'), dedans: r.top < innerHeight && r.bottom > 0 }; });
        dit(!!(v && v.n === '1' && v.dedans), `G ${cle} : vue « Relier », le bloc des adresses à l'écran`, JSON.stringify(v));
      }
    }
    // Ouvrir un écran n'écrit aucune DONNÉE : on compare, clé par clé, la ligne `main` servie avant le
    // geste et après (une écriture de `main` la réécrit en entier : seules les valeurs comptent), et
    // les autres lignes écrites (SMS reliés, adresses…).
    await pg.waitForTimeout(1500);
    // Les PUBLICATIONS d'écran (nombres dérivés, src/fileEnvoi.js `CLES_PUBLIEES`) et `rev` ne sont pas des données.
    const changees = Object.keys({ ...avantMain, ...MAIN }).filter((k) => k !== 'rev' && !PUBLIEES.includes(k) && JSON.stringify(avantMain[k]) !== JSON.stringify(MAIN[k]));
    const autres = ecritures.slice(e0).filter((w) => !w.ids.includes('main') && !/id=eq\.main/.test(w.url)).map((w) => w.ids.join(','));
    dit(!changees.length && !autres.length, `G ${cle} : le geste n'écrit aucune donnée (il ouvre)`, JSON.stringify({ changees, autres }));
    await shot(pg, 'G-' + cle);
    await ctx.close();
  });

  // ── T ───────────────────────────────────────────────────────────────────────────
  if (!SEUL || SEUL === 'T') await essaie('T', async () => {
    const { ctx, ecritures, MAIN } = await contexte(b, PC, {});
    const pg = await ctx.newPage();
    await aller(pg, 'trancher'); await ecranTrancher(pg);
    await pg.click('[data-a-trancher-passu="adresses-sans-compte"] button');
    await pg.waitForSelector('[data-adresses-sans-compte="1"]', { timeout: 20000 });
    await pg.waitForTimeout(800);
    await aller(pg, 'trancher'); await ecranTrancher(pg);
    let r = await lire(pg);
    const l1 = r.lignes.find((l) => l.cle === 'adresses-sans-compte');
    dit(!!l1 && l1.n === 1, 'T : l\'adresse, comptée par SON écran, devient une ligne (1)', JSON.stringify(l1));
    dit(r.total === TOTAL_MAIN + 1 && r.badge === TOTAL_MAIN + 1, 'T : total et badge +1', `${r.total} / ${r.badge}`);
    const avantGeste = ecritures.length;
    await pg.click('[data-a-trancher-ligne="adresses-sans-compte"] button');
    await pg.waitForSelector('[data-compte-acheteur="achat@exemple.test"]', { timeout: 20000 });
    await pg.waitForTimeout(800);
    const sansGeste = ecritures.slice(avantGeste).filter((w) => w.cles.includes('vrm_adresses_acheteur'));
    dit(!sansGeste.length, 'T : rien n\'est écrit avant SON geste', JSON.stringify(sansGeste));
    await pg.click('[data-compte-acheteur="achat@exemple.test"]');
    await pg.locator('.vrm-confirmation button').last().click();
    await pg.waitForFunction(() => !document.querySelector('[data-adresse-sans-compte="achat@exemple.test"]'), null, { timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(2500);
    const parGeste = ecritures.slice(avantGeste).filter((w) => w.cles.includes('vrm_adresses_acheteur'));
    dit(parGeste.length >= 1 && MAIN.vrm_adresses_acheteur && MAIN.vrm_adresses_acheteur['achat@exemple.test'], 'T : SON geste écrit (et lui seul) le choix « compte acheteur »', JSON.stringify(parGeste.map((w) => w.ids)));
    await pg.click('[data-nav-entree="trancher"]');
    await ecranTrancher(pg);
    r = await lire(pg);
    dit(!r.lignes.some((l) => l.cle === 'adresses-sans-compte') && !r.passu.some((l) => l.cle === 'adresses-sans-compte'), 'T : tranchée, la ligne SORT', JSON.stringify(r.lignes.map((l) => l.cle)));
    dit(r.total === TOTAL_MAIN && r.badge === TOTAL_MAIN && r.partiel === '0', 'T : total et badge reviennent (et plus rien n\'est « pas su »)', `${r.total} / ${r.badge} / ${r.partiel}`);
    await shot(pg, 'T-apres');
    await ctx.close();
  });

  // ── J ───────────────────────────────────────────────────────────────────────────
  if (!SEUL || SEUL === 'J') await essaie('J', async () => {
    const { ctx } = await contexte(b, TEL, { theme: 'dark' });
    const pg = await ctx.newPage();
    await aller(pg, 'journee');
    await pg.waitForSelector('[data-job="a-trancher"]', { timeout: 30000 });
    await pg.waitForTimeout(3000);
    const n = Number(await pg.getAttribute('[data-job="a-trancher"]', 'data-n'));
    const somme = await sommeRangee(pg, 1);
    dit(n === somme && n > 0, 'J : Ma journée dit la somme des sources rangées à cet instant', `${n} / ${somme}`);
    await shot(pg, 'J-journee-390-sombre');
    await pg.click('[data-job="a-trancher"]');
    await pg.waitForSelector('[data-a-trancher]', { timeout: 20000 }).catch(() => {});
    const r = await lire(pg);
    dit(r.total === n, 'J : la toucher ouvre À trancher, au même total', `${r.total} / ${n}`);
    await shot(pg, 'J-a-trancher-390-sombre');
    await ctx.close();
  });

  // ── Z ───────────────────────────────────────────────────────────────────────────
  if (!SEUL || SEUL === 'Z') for (const [nom, vp, theme] of [['1512-clair', PC, 'light'], ['390-sombre', TEL, 'dark']]) await essaie('Z ' + nom, async () => {
    const { ctx } = await contexte(b, vp, { theme, zero: true });
    const pg = await ctx.newPage();
    await aller(pg, 'trancher'); await ecranTrancher(pg);
    const r = await lire(pg);
    dit(r.total === 0 && r.vide === 'zero' && !r.lignes.length, `Z ${nom} : « Rien à trancher »`, JSON.stringify({ t: r.total, v: r.vide, l: r.lignes.length, p: r.passu }));
    dit(r.badge == null, `Z ${nom} : aucun badge (jamais « 0 »)`, r.badge);
    await shot(pg, 'Z-' + nom);
    await aller(pg, 'journee');
    await pg.waitForSelector('[data-job], [data-attente-ecran="journee"][data-attente="pret"]', { timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(3000);
    const zj = await pg.evaluate(() => { const e = document.querySelector('[data-job="a-trancher"]'); return { n: e ? e.getAttribute('data-n') : null, s: localStorage.getItem('vrm_a_trancher') }; });
    dit(zj.n == null, `Z ${nom} : aucune ligne « à trancher » dans Ma journée`, JSON.stringify(zj));
    await ctx.close();
  });

  await b.close(); srv.close();
  console.log(ko ? `\n${ko} contrôle(s) rouge(s)` : '\nTout est vert');
  process.exit(ko ? 1 : 0);
})();
