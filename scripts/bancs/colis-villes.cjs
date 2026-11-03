// Banc : COLIS → « À RETIRER » — LES VILLES RECONNUES (3 nov., 19 h).
// Julien (18 h 59) : « pour les colis ce n'est pas encore parfait, il ne reconnaît pas les villes, c'est
// chiant, l'app doit être intelligente ». Les FORMES mesurées chez lui (valeurs INVENTÉES, dépôt public) :
//  · e-mail Mondial Relay complet, en MAJUSCULES (« … , 35260 CANCALE ») et en minuscules (« 35260 Cancale ») ;
//  · consigne Vinted Go SANS code postal (« Consigne Vinted Go, <enseigne>, 13 Rue … ») + son suivi Vinted Go
//    (rue « 13 Rue …, Vannes », ville « France », jamais de code postal) ; le même point connu par une
//    conversation (« <enseigne>, 13 Rue …, 56000 Vannes, France ») ;
//  · e-mail Mondial Relay au NOM seul (« LOCKER 24/7 … ») dont le point est connu par un e-mail plus ancien ;
//  · un nom seul porté par DEUX points connus (Cancale et Vannes) ⇒ rien de pris ;
//  · « ST MALO » et « Saint-Malo » ; un code postal sans ville à UNE commune (table officielle servie) et à
//    PLUSIEURS communes (« 35350 ») ; un colis sans lieu.
// Exige (data-* et nombres, §6.4) : un bouton par ville (Cancale 4 · Vannes 2 · Saint-Malo 2 · Huelgoat 1 ·
// 35350 1), le nombre de chaque bouton = ses colis ; choisir Vannes : ses 2 colis, la carte sombre dit 2, et
// le point sans ville et « Lieu à confirmer » restent VISIBLES ; tous les colis une fois. 390 tactile + 1512.
// `SHOTS=dossier` garde les captures du sélecteur.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4433);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 3, 19, 5, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS);
const track = (carrier, suivi, lieu, code, extra = {}) => ({ id: `email_track_${carrier}_${suivi}`, data: Object.assign({ type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(0.3), emailAt: ilYa(0.3), arriveLe: ilYa(0.3), code, lieu, limite: jourDans(4), consigne: false, account: '' }, extra) });
const retire = (carrier, suivi, lieu) => track(carrier, suivi, lieu, null, { status: 'delivered', statusLabel: 'Livré / retiré', receivedAt: ilYa(12), emailAt: ilYa(12), arriveLe: ilYa(14) });
const TRACKS = [
  track('mondialrelay', '81000001', 'MAISON DU QUAI, 40 RUE DU QUAI, 35260 CANCALE', '100001'),
  track('mondialrelay', '81000002', 'MAISON DU QUAI, 40 RUE DU QUAI, 35260 CANCALE', '100002'),
  track('mondialrelay', '81000003', 'Tabac de la Houle, 3 Rue Haute, 35260 Cancale', '100003'),
  track('mondialrelay', '81000004', 'LOCKER 24/7 HYPER DU PORT', '100004'),                                           // nom seul
  retire('mondialrelay', '81000090', 'LOCKER 24/7 HYPER DU PORT, Rue des Rosiers, 35260 CANCALE'),                   // le même point, connu
  track('vinted', 'VGS0000000000101', 'Consigne Vinted Go, Thé Bleu, 13 Rue Saint-Vincent', 'A10101', { consigne: true }),
  track('vinted', 'VGS0000000000102', 'Consigne Vinted Go, Thé Bleu, 13 Rue Saint-Vincent', 'A10102', { consigne: true }),
  { id: 'transp_vinted_VGS0000000000101', data: { v: 1, etat: 'disponible', fini: false, suivi: 'VGS0000000000101', carrier: 'vinted', lieuNom: '', lieuRue: '13 Rue Saint-Vincent, Vannes', lieuCp: '', lieuVille: 'France', etatAt: ilYa(0.3), source: 'serveur', evenements: [] } },
  { id: 'transp_vinted_VGS0000000000102', data: { v: 1, etat: 'disponible', fini: false, suivi: 'VGS0000000000102', carrier: 'vinted', lieuNom: '', lieuRue: '13 Rue Saint-Vincent, Vannes', lieuCp: '', lieuVille: 'France', etatAt: ilYa(0.3), source: 'serveur', evenements: [] } },
  track('mondialrelay', '81000005', 'CARREFOUR EXPRESS', '100005'),                                                   // homonyme
  retire('mondialrelay', '81000091', 'CARREFOUR EXPRESS, 3 Place du Marché, 35260 CANCALE'),
  retire('mondialrelay', '81000092', 'CARREFOUR EXPRESS, 8 Rue Thiers, 56000 VANNES'),
  track('mondialrelay', '81000006', 'RELAIS DU SILLON, 2 Chaussée du Sillon, 35400 ST MALO', '100006'),
  track('mondialrelay', '81000007', 'Bar du Sillon, 4 Chaussée du Sillon, 35400 Saint-Malo', '100007'),
  track('mondialrelay', '81000008', 'PRESSE DU BOURG, 1 Place de l’Église, 29690', '100008'),                        // CP seul, une commune
  track('mondialrelay', '81000009', 'POINT VERT, 5 Rue du Bourg, 35350', '100009'),                                   // CP seul, plusieurs communes
  track('mondialrelay', '81000010', null, '100010'),                                                                  // aucun lieu
];
const RELAIS = { 5550001: { code: 'Z1', lieu: 'Thé Bleu, 13 Rue Saint-Vincent, 56000 Vannes, France', transporteur: '', at: ilYa(20) } };
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Vannes' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: RELAIS },
  ...TRACKS,
];
// La table officielle (Base Adresse, `type=municipality`) : la forme de api-adresse.data.gouv.fr.
const commune = (nom, cp, insee) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [-3.7, 48.3] }, properties: { label: nom, score: 0.9, type: 'municipality', name: nom, postcode: cp, citycode: insee, city: nom } });
const COMMUNES = { 29690: [commune('Huelgoat', '29690', '29081')], 35350: [commune('Saint-Méloir-des-Ondes', '35350', '35299'), commune('Saint-Benoît-des-Ondes', '35350', '35255'), commune('Saint-Coulomb', '35350', '35263')] };
const ATTENDU = { cancale: 4, vannes: 2, 'saint malo': 2, huelgoat: 1, 'cp:35350': 1 };
const TOTAL = 12;
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const ouvrir = async (b, vp) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const banDemandes = [];
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    if (/api-adresse\.data\.gouv\.fr/.test(u)) {
      banDemandes.push(u);
      const q = new URL(u).searchParams;
      const feats = q.get('type') === 'municipality' ? (COMMUNES[q.get('postcode') || q.get('q')] || []) : [];
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ type: 'FeatureCollection', features: feats }) });
    }
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, banDemandes };
};
const mesurer = (pg) => pg.evaluate(() => ({
  villes: [...document.querySelectorAll('[data-retirer-villes] [data-ville]')].map((b) => ({ v: b.getAttribute('data-ville'), n: b.getAttribute('data-ville-n'), txt: b.textContent.trim() })),
  ville: (document.querySelector('[data-retirer-ville]') || { getAttribute: () => null }).getAttribute('data-retirer-ville'),
  points: [...document.querySelectorAll('.vrm-rpf [data-relais-point]')].map((p) => ({ cle: p.getAttribute('data-relais-point'), ville: p.getAttribute('data-relais-ville'), n: p.querySelectorAll('[data-cc-carte]:not([data-hors-compte])').length, inconnu: p.classList.contains('is-inconnu'), nom: (p.querySelector('.vrm-rpf-nom') || {}).textContent || '' })),
  lignes: [...document.querySelectorAll('.vrm-rpf [data-cc-carte]:not([data-hors-compte])')].map((l) => l.getAttribute('data-cc-carte')),
  carte: (document.querySelector('[data-fu-colis-retirer]') || { getAttribute: () => null }).getAttribute('data-fu-colis-retirer'),
  pub: (() => { try { return JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return null; } })(),
  deb: document.documentElement.scrollWidth - window.innerWidth,
}));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, nom] of [[{ width: 390, height: 844 }, '390'], [{ width: 1512, height: 982 }, '1512']]) {
      console.log(`\n— Colis → À retirer · villes · ${nom}`);
      const { ctx, pg, errs, banDemandes } = await ouvrir(b, vp);
      try {
        await pg.locator('[data-colis-onglet-choix="retirer"]').first().waitFor({ timeout: 30000 });
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
        await pg.locator('[data-colis-onglet-choix="retirer"]').first().click();
        await pg.waitForFunction(() => document.querySelectorAll('[data-retirer-villes] [data-ville]').length >= 6, null, { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(600);
        const m = await mesurer(pg);
        const pub = m.pub && Number.isFinite(m.pub.total) ? m.pub.total : null;
        dit(pub === TOTAL && m.lignes.length === TOTAL && new Set(m.lignes).size === TOTAL, `les ${TOTAL} colis, chacun une fois (= vrm_colis_retirer)`, `${pub} / ${m.lignes.length}`);
        const parV = Object.fromEntries(m.villes.filter((x) => x.v).map((x) => [x.v, Number(x.n)]));
        for (const [v, n] of Object.entries(ATTENDU)) dit(parV[v] === n, `bouton « ${v} » : ${n} colis`, JSON.stringify(m.villes));
        dit(m.villes.length === Object.keys(ATTENDU).length + 1, 'une ville = un bouton (« CANCALE » = « Cancale », « ST MALO » = « Saint-Malo »), rien d’autre', JSON.stringify(m.villes.map((x) => x.txt)));
        dit(m.villes.some((x) => x.v === 'cp:35350' && /^35350\b/.test(x.txt)), 'le code postal à plusieurs communes dit « 35350 », jamais une ville devinée', '');
        for (const v of Object.keys(ATTENDU)) { const n = m.points.filter((p) => p.ville === v).reduce((t, p) => t + p.n, 0); dit(n === ATTENDU[v], `les points de « ${v} » portent ${ATTENDU[v]} colis (= le bouton)`, String(n)); }
        const carrefour = m.points.find((p) => /carrefour/i.test(p.nom));
        dit(carrefour && !carrefour.ville, 'le nom porté par deux points connus (Cancale, Vannes) : dans AUCUNE ville', JSON.stringify(carrefour));
        dit(m.points.some((p) => p.inconnu), '« Lieu à confirmer » listé', '');
        const noms = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf .vrm-rpf-nom, .vrm-rpf [data-relais-adresse]')].map((x) => x.textContent));
        dit(noms.length && noms.every((t) => !/[a-zà-ÿ][A-ZÀ-Þ]/.test(t)), 'noms et adresses sans majuscule au milieu d’un mot (« Thé », pas « ThÉ »)', JSON.stringify(noms.filter((t) => /[a-zà-ÿ][A-ZÀ-Þ]/.test(t))));
        dit(banDemandes.some((u) => /type=municipality/.test(u) && /postcode=29690/.test(u)), 'la table officielle est demandée pour un code postal seul', banDemandes.filter((u) => /municipality/.test(u)).join(' | '));
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); const el = pg.locator('[data-retirer-villes]').first(); await el.scrollIntoViewIfNeeded().catch(() => {}); await pg.screenshot({ path: path.join(SHOTS, `villes-toutes-${nom}.png`) }); }
        // Choisir Vannes : ses colis, la carte sombre suit, rien de caché.
        await pg.locator('[data-retirer-villes] [data-ville="vannes"]').first().click(); await pg.waitForTimeout(500);
        const v = await mesurer(pg);
        const nV = v.points.filter((p) => p.ville === 'vannes').reduce((t, p) => t + p.n, 0);
        dit(v.ville === 'vannes' && nV === 2 && v.carte === '2', 'Vannes choisie : ses 2 colis (les consignes sans code postal), la carte sombre dit 2', JSON.stringify({ ville: v.ville, nV, carte: v.carte }));
        dit(v.points.filter((p) => p.ville && p.ville !== 'vannes').length === 0, '… aucun point d’une autre ville', JSON.stringify(v.points.filter((p) => p.ville && p.ville !== 'vannes').map((p) => p.ville)));
        dit(v.points.some((p) => p.inconnu) && v.points.some((p) => /carrefour/i.test(p.nom)), '… « Lieu à confirmer » et le point sans ville restent VISIBLES', JSON.stringify(v.points.map((p) => p.nom || p.cle)));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `villes-vannes-${nom}.png`) });
        dit(m.deb <= 1 && v.deb <= 1, 'rien ne déborde', `${m.deb} / ${v.deb}`);
        dit(!errs.length, 'aucune erreur de page', errs.join(' | '));
      } catch (e) { dit(false, 'le banc a pu s’exécuter', String(e.message || e).slice(0, 200)); }
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
