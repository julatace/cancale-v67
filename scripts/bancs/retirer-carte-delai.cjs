// Banc : COLIS → « À RETIRER » — VILLES, CARTE, BARRE DU DÉLAI (8 nov.).
// Julien : « Pour les colis à retirer, tu dois adapter les villes en fonction des points relais où sont les
// colis. Je veux que tu réaffiches la carte et que tu mettes une barre d'évolution avec le délai pour retirer. »
// Données INVENTÉES de même forme (dépôt public) : deux colis au même relais de Cancale (même arrivée, même
// limite) ; Vannes : un relais au dernier jour et une consigne Vinted Go à rendre demain 9 h (< 24 h) ; Brest :
// un Mondial Relay SANS date limite (garde estimée) ; Saint-Malo : un achat Vinted au relais SANS date
// d'arrivée ; Quimper : un colis « à vérifier » SEUL (délai dépassé) ; un relais au nom seul (sans ville).
// Exige (data-* et nombres, §6.4) :
//  · villes = celles où un colis compté attend : Vannes 2 · Cancale 2 · Brest 1 · Saint-Malo 1 · Autres 1 ;
//    jamais Quimper ; triées par urgence (Vannes, puis Cancale) ; « Autres » à la fin ; « Toutes » en tête ;
//  · la carte est là AU TÉLÉPHONE aussi, en haut de la liste (~200 px), une épingle par point placé, un doigt
//    fait défiler la page (`touch-action` pan-y, gestes coopératifs) ; Vannes choisie ⇒ cadrée sur Vannes ;
//    toucher une épingle amène son point ; fond indisponible ⇒ la carte se tait, la liste reste ;
//    hors réseau ⇒ pas de carte ;
//  · la barre (12 nov. : UNE par ligne, la ligne unique) : Cancale sur chacune de ses 2 lignes, jamais en tête du
//    point ni redite en puce, « encore 3 j », neutre, % juste ; Vannes « dernier jour » ambre ; Vinted Go « encore
//    1 j » ambre (< 24 h) ; Brest « estimée » ; Saint-Malo (sans arrivée) : barre vide « Date limite inconnue » ; `role=progressbar` + aria-valuenow = % ; jamais rouge ;
//  · maplibre n'est pas chargé au démarrage de Ma journée.
// 390 tactile clair/sombre + 1512. `SHOTS=dossier` garde les captures. `BANC_PORT` change le port.
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4447);
const SHOTS = process.env.SHOTS || '';
const VUES = process.env.JR_VUES ? process.env.JR_VUES.split(',') : null;
const TZ = 'Europe/Paris';
process.env.TZ = TZ;
const maintenant = new Date(2026, 10, 8, 10, 0, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const finJour = (j) => new Date(`${jourDans(j)}T23:59:59.999`).getTime();
const demain9h = new Date(2026, 10, 9, 9, 0, 0).getTime();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const cap = iso(MS);
// Les points, leurs coordonnées (servies par la « Base Adresse » du banc).
const LIEUX = {
  cancale: { lieu: 'MAISON DU QUAI, 40 Rue du Quai, 35260 Cancale', rue: '40 Rue du Quai', cp: '35260', ville: 'Cancale', lon: -1.852, lat: 48.676 },
  vannesA: { lieu: 'POINT PRESSE, 3 Rue Haute, 56000 Vannes', rue: '3 Rue Haute', cp: '56000', ville: 'Vannes', lon: -2.757, lat: 47.657 },
  vannesB: { lieu: 'Consigne Vinted Go, Thé Bleu, 13 Rue Saint-Vincent, 56000 Vannes', rue: '13 Rue Saint-Vincent', cp: '56000', ville: 'Vannes', lon: -2.760, lat: 47.654 },
  brest: { lieu: 'TABAC DE SIAM, 5 Rue de Siam, 29200 Brest', rue: '5 Rue de Siam', cp: '29200', ville: 'Brest', lon: -4.486, lat: 48.389 },
  malo: { lieu: 'PRESSE DU SILLON, 5 Chaussée du Sillon, 35400 Saint-Malo', rue: '5 Chaussée du Sillon', cp: '35400', ville: 'Saint-Malo', lon: -2.010, lat: 48.651 },
  quimper: { lieu: 'TABAC KEREON, 9 Rue Kéréon, 29000 Quimper', rue: '9 Rue Kéréon', cp: '29000', ville: 'Quimper', lon: -4.102, lat: 47.996 },
};
const track = (carrier, suivi, lieu, code, extra = {}) => ({ id: `email_track_${carrier}_${suivi}`, data: Object.assign({ type: 'suivi', carrier, suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(2), emailAt: ilYa(2), arriveLe: ilYa(2), code, lieu, limite: jourDans(3), consigne: false, account: 'compte_a' }, extra) });
const TRACKS = [
  track('mondialrelay', '93000001', LIEUX.cancale.lieu, '100001'),
  track('mondialrelay', '93000002', LIEUX.cancale.lieu, '100002'),
  track('mondialrelay', '93000003', LIEUX.vannesA.lieu, '100003', { limite: jourDans(0), arriveLe: ilYa(4), receivedAt: ilYa(4), emailAt: ilYa(4) }),
  track('vinted', 'VGS0000000000301', LIEUX.vannesB.lieu, 'A30301', { consigne: true, limite: jourDans(1), limiteAt: iso(demain9h), arriveLe: ilYa(3), receivedAt: ilYa(3), emailAt: ilYa(3) }),
  track('mondialrelay', '93000005', LIEUX.brest.lieu, '100005', { limite: null, arriveLe: ilYa(1), receivedAt: ilYa(1), emailAt: ilYa(1) }),
  track('mondialrelay', '93000006', LIEUX.quimper.lieu, '100006', { limite: jourDans(-2), arriveLe: ilYa(8), receivedAt: ilYa(8), emailAt: ilYa(8) }),
  track('mondialrelay', '93000007', 'TABAC LE NARVAL', '100007'),
];
const AU_RELAIS = 'Colis déposé en point relais';
const ACHATS = [{ transaction_id: 9601, conversation_id: 7601, title: 'Nike Dunk Low panda taille 38', price: { amount: '40', currency_code: 'EUR' }, status: AU_RELAIS, transaction_user_status: 'needs_action', date: ilYa(6), photo: { url: 'https://images1.vinted.net/t/b9/f800/x9.jpeg?s=x' } }];
const RELAIS = { 9601: { code: '060606', lieu: LIEUX.malo.lieu, transporteur: 'mondialrelay' } };
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: ACHATS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: RELAIS },
  ...TRACKS,
];
// Les barres attendues, calculées ici (la même règle écrite autrement : temps écoulé / durée).
const pct = (arr, fin) => Math.round(((MS - arr) / (fin - arr)) * 100);
const ATTENDU_BARRES = {
  cancale: { code: 'date', txt: /^encore 3 j$/, ambre: '0', pct: pct(MS - 2 * J, finJour(3)), estimee: false },
  '93000003': { code: 'dernier', txt: /^dernier jour$/, ambre: '1', pct: pct(MS - 4 * J, finJour(0)), estimee: false },
  VGS0000000000301: { code: 'demain', txt: /^encore 1 j$/, ambre: '1', pct: pct(MS - 3 * J, demain9h), estimee: false },
  '93000005': { code: 'date', txt: /^encore 4 j · estimée$/, ambre: '0', pct: pct(MS - 1 * J, finJour(4)), estimee: true },
};
let ko = 0, ok = 0;
const ditBrut = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
// (11 nov., Julien : « tu peux enlever la carte pour les points relais, ça sert à rien ») LA CARTE EST RETIRÉE.
// Ses contrôles (épingles, cadrage, hauteur, gestes, « Agrandir ») ne s'appliquent plus : ils sont tus ici, et
// UN contrôle les remplace dans chaque vue — « aucune carte n'est rendue » (rouge sur le code d'avant). Tout le
// reste du banc (listes, villes, délais, comptes) est inchangé.
const CONTROLE_CARTE = /carte (est|ne porte|se cadre|se tait)|épingle|Agrandir|hauteur raisonnable|centre de la carte|un doigt fait défiler|sur la carte|se cadre|trente : les 30 points|non géocodable/;
let carteTus = 0;
const dit = (c, m, d) => { if (CONTROLE_CARTE.test(String(m))) { carteTus++; return; } ditBrut(c, m, d); };
const pasDeCarte = async (pg, nom) => { const n = await pg.evaluate(() => document.querySelectorAll('.vrm-rpf-carte, [data-retirer-carte-etat], .maplibregl-map').length); ditBrut(n === 0, `${nom} plus de carte des points relais (décision du 11 nov.)`, String(n)); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).split('\n')[0].slice(0, 200)); } };

// ── Le fond servi (style raster quadrillé, comme carte-stable.cjs) ──────────
const crc = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const morceau = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const TUILE = (() => {
  const T = 256, lignes = [];
  for (let y = 0; y < T; y++) { const l = Buffer.alloc(1 + T * 3); for (let x = 0; x < T; x++) { const trait = x % 32 === 0 || y % 32 === 0; const v = trait ? 200 : 238; l[1 + x * 3] = v; l[2 + x * 3] = v; l[3 + x * 3] = trait ? 210 : 242; } lignes.push(l); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(T, 0); ihdr.writeUInt32BE(T, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), morceau('IHDR', ihdr), morceau('IDAT', zlib.deflateSync(Buffer.concat(lignes))), morceau('IEND', Buffer.alloc(0))]);
})();
const STYLE = { version: 8, sources: { banc: { type: 'raster', tiles: ['https://tiles.openfreemap.org/banc/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'OpenFreeMap © OpenMapTiles © OpenStreetMap' } }, layers: [{ id: 'fond', type: 'background', paint: { 'background-color': '#eef0f2' } }, { id: 'banc', type: 'raster', source: 'banc' }] };

const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const ext = path.extname(p);
  r.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
  if (ext === '.js') {
    // Le seul crochet (celui de carte-stable.cjs) : la carte construite par l'app est GARDÉE pour la mesurer.
    // (le code servi est minifié : le nom de la variable change, d'où la forme générale `X.once("load",`).
    const s = fs.readFileSync(p, 'utf8').replace(/([A-Za-z_$][\w$]*)\.once\("load", ?/g, '(window.__vrmPose && window.__vrmPose($1), $1).once("load",');
    return r.end(s);
  }
  fs.createReadStream(p).pipe(r);
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

const ouvrir = async (b, vp, { sombre = false, fondKo = false, tab = 'cat_bord', reduit = false } = {}) => {
  const ctx = await b.newContext({ viewport: vp, timezoneId: TZ, reducedMotion: reduit ? 'reduce' : 'no-preference', ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = [], requetes = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('request', (q) => requetes.push(q.url()));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.removeItem('vrm_retirer_ville'); } catch (_) {}
    window.__vrmCartes = [];
    window.__vrmPose = (m) => { window.__vrmCartes.push(m); };
  }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const j = (d, st = 200) => r.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (/images1\.vinted\.net/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#dfe3e8"/></svg>' });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) {
      const q = decodeURIComponent(u).replace(/\+/g, ' ');
      if (/type=municipality/.test(q)) return j({ features: [] });
      const p = Object.values(LIEUX).find((x) => q.includes(x.rue));
      return j({ features: p ? [{ geometry: { coordinates: [p.lon, p.lat] }, properties: { score: 0.95, type: 'housenumber', postcode: p.cp, city: p.ville, name: p.rue, label: `${p.rue} ${p.cp} ${p.ville}` } }] : [] });
    }
    if (/tiles\.openfreemap\.org\/styles\//.test(u)) return fondKo ? j({ m: 'panne' }, 503) : j(STYLE);
    if (/tiles\.openfreemap\.org\/banc\//.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: TUILE });
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
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non);
    const inn = /[?&]id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, requetes };
};
const allerRetirer = async (pg) => {
  await pg.locator('[data-colis-section]').first().waitFor({ timeout: 30000 });
  await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); /* (11 nov., lot DJ3) « À retirer » est en tête d'Achats */ await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
  await pg.locator('.vrm-rpf').first().waitFor({ timeout: 15000 });
  await pg.waitForTimeout(1500);
  await pasDeCarte(pg, 'À retirer');
};
// Une couleur rouge (teinte < 15° ou > 345°, saturée) : jamais sur une barre.
const teinte = (rgb) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(rgb || ''); if (!m) return null; const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number(x) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; const s = mx === 0 ? 0 : d / mx; let h = 0; if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); } if (h < 0) h += 360; return { h, s }; };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n— Colis → À retirer · villes, carte, délai · ${nom}`);
      const { ctx, pg, errs, requetes } = await ouvrir(b, vp, { sombre });
      await essaie('retirer', async () => {
        await allerRetirer(pg);
        // ── 1. Les villes ──
        const vil = await pg.evaluate(() => [...document.querySelectorAll('[data-retirer-villes] [data-ville]')].map((x) => ({ v: x.getAttribute('data-ville'), n: x.getAttribute('data-ville-n'), u: x.getAttribute('data-ville-urgence'), txt: x.textContent.trim() })));
        const parV = Object.fromEntries(vil.filter((x) => x.v).map((x) => [x.v, Number(x.n)]));
        const ATT = { vannes: 2, cancale: 2, brest: 1, 'saint malo': 1, __autres: 1 };
        dit(vil.length && vil[0].v === '', '« Toutes » en tête', JSON.stringify(vil.map((x) => x.v)));
        dit(JSON.stringify(Object.keys(parV).sort()) === JSON.stringify(Object.keys(ATT).sort()), 'seulement les villes où un colis attend (+ « Autres ») — jamais Quimper (un « à vérifier » seul)', JSON.stringify(parV));
        dit(Object.entries(ATT).every(([k, n]) => parV[k] === n), 'le nombre de chaque bouton = ses colis comptés', JSON.stringify(parV));
        const ordre = vil.filter((x) => x.v).map((x) => x.v);
        dit(ordre[0] === 'vannes' && ordre[1] === 'cancale' && ordre[ordre.length - 1] === '__autres', 'triées par urgence (Vannes au dernier jour, puis Cancale), « Autres » à la fin', ordre.join(','));
        // ── 2. La carte ──
        await pg.waitForFunction(() => document.querySelectorAll('.vrm-rpf-carte [data-relais-epingle]').length >= 6, null, { timeout: 15000 }).catch(() => {});
        await pg.waitForFunction(() => document.querySelector('[data-retirer-carte-etat="pret"]'), null, { timeout: 15000 }).catch(() => {});
        const c = await pg.evaluate(() => {
          const k = document.querySelector('.vrm-rpf-carte'); const v = document.querySelector('[data-retirer-villes]'); const s = document.querySelector('.vrm-rpf-section');
          const m = (window.__vrmCartes || []).filter((x) => x.getContainer && x.getContainer().isConnected && x.getContainer().closest('.vrm-rpf-carte')).pop();
          const can = k && k.querySelector('.maplibregl-canvas');
          return { la: !!k, etat: (document.querySelector('[data-retirer-carte-etat]') || { getAttribute: () => '' }).getAttribute('data-retirer-carte-etat'), h: k ? Math.round(k.getBoundingClientRect().height) : 0, avantVilles: !!(k && v && k.getBoundingClientRect().bottom <= v.getBoundingClientRect().top + 1), avantListe: !!(k && s && k.getBoundingClientRect().bottom <= s.getBoundingClientRect().top), epingles: [...document.querySelectorAll('.vrm-rpf-carte [data-relais-epingle]')].map((e) => ({ cle: e.getAttribute('data-relais-epingle'), n: e.getAttribute('data-relais-n') })), coop: m && m.cooperativeGestures ? m.cooperativeGestures.isEnabled() : null, touch: can ? getComputedStyle(can).touchAction : '', cadre: (document.querySelector('.vrm-rpf-carte [data-relais-cadre]') || { getAttribute: () => '' }).getAttribute('data-relais-cadre') };
        });
        const tel = vp.width < 600;
        dit(c.la && c.etat === 'pret', `la carte est affichée${tel ? ' AU TÉLÉPHONE' : ''} (fond prêt)`, JSON.stringify({ la: c.la, etat: c.etat }));
        dit(c.avantVilles && c.avantListe, 'la carte est en haut, avant les villes et la liste', JSON.stringify(c));
        dit(tel ? c.h >= 180 && c.h <= 230 : c.h >= 180 && c.h <= 260, `hauteur raisonnable (${c.h} px)`);
        // (9 nov., retraits frais — Julien : « À retirer · 0 » sous une carte à 18 points) LA CARTE NE MONTRE QUE
        // CE QUE L'ONGLET COMPTE : Quimper (un « à vérifier » seul) n'a plus d'épingle ; son colis reste VISIBLE
        // sous « À vérifier » (contrôlé plus bas). Avant ce jour, ce banc exigeait l'épingle de Quimper.
        dit(c.epingles.length === 5 && !c.epingles.some((e) => /tabackereon/.test(e.cle)), 'une épingle par point où un colis COMPTÉ attend (Cancale, 2 × Vannes, Brest, Saint-Malo) — Quimper « à vérifier » n’en a pas', JSON.stringify(c.epingles));
        const sortes = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('.vrm-rpf-carte [data-relais-epingle]')].map((e) => [e.getAttribute('data-relais-epingle'), e.getAttribute('data-relais-sorte')])));
        dit(Object.values(sortes).length === 5 && Object.values(sortes).every((v) => v === 'aretirer'), 'toutes les épingles sont « à retirer »', JSON.stringify(sortes));
        const quimperVu = await pg.evaluate(() => [...document.querySelectorAll('[data-rp-section="verifier"] [data-cc-carte]')].some((l) => /93000006/.test(l.getAttribute('data-cc-carte') || '')));
        dit(quimperVu, 'le colis de Quimper reste visible sous « À vérifier » (jamais caché)');
        const epC = c.epingles.find((e) => /maisonduquai/i.test(e.cle));
        dit(!!epC && epC.n === '2', 'l’épingle de Cancale porte ses 2 colis', JSON.stringify(epC));
        if (tel) dit(c.coop === true && /pan-y/.test(c.touch), 'au doigt : un doigt fait défiler la page (gestes coopératifs, touch-action pan-y)', `${c.coop} · ${c.touch}`);
        // Vannes choisie : la carte se cadre sur Vannes.
        await pg.locator('[data-retirer-villes] [data-ville="vannes"]').first().click();
        await pg.waitForFunction(() => { const e = [...document.querySelectorAll('.vrm-rpf-carte [data-relais-epingle]')]; return e.length === 2; }, null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        const cv = await pg.evaluate(() => ({ ep: [...document.querySelectorAll('.vrm-rpf-carte [data-relais-epingle]')].map((e) => e.getAttribute('data-relais-epingle')), cadre: (document.querySelector('.vrm-rpf-carte [data-relais-cadre]') || { getAttribute: () => '' }).getAttribute('data-relais-cadre'), centre: (() => { const m = (window.__vrmCartes || []).filter((x) => x.getContainer && x.getContainer().isConnected && x.getContainer().closest('.vrm-rpf-carte')).pop(); if (!m) return null; const z = m.getCenter(); return [z.lng, z.lat]; })() }));
        const [w, s0, e0, n0] = String(cv.cadre).split(',').map(Number);
        dit(cv.ep.length === 2 && w >= -2.77 && e0 <= -2.75 && s0 >= 47.65 && n0 <= 47.66, 'Vannes choisie : la carte ne porte que les 2 points de Vannes, cadrée sur eux', JSON.stringify(cv));
        dit(!!cv.centre && Math.abs(cv.centre[0] + 2.7585) < 0.02 && Math.abs(cv.centre[1] - 47.6555) < 0.02, 'le centre de la carte est à Vannes', JSON.stringify(cv.centre));
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.evaluate(() => window.scrollTo(0, 0)); if (await pg.$('.vrm-rpf-carte')) await pg.locator('.vrm-rpf-carte').first().scrollIntoViewIfNeeded(); /* (intégration) plus de carte : capture du haut de la liste */ await pg.screenshot({ path: path.join(SHOTS, `retirer-carte-vannes-${nom}.png`) }); }
        await pg.locator('[data-retirer-villes] [data-ville=""]').first().click();
        await pg.waitForFunction(() => document.querySelectorAll('.vrm-rpf-carte [data-relais-epingle]').length >= 6, null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(800);
        // Toucher une épingle amène son point (le plus bas de la liste : Saint-Malo, sans date).
        const TOP = (k) => pg.evaluate((k) => { const p = [...document.querySelectorAll('[data-relais-point]')].find((x) => x.getAttribute('data-relais-point') === k); if (!p) return null; const r = p.getBoundingClientRect(); return { top: Math.round(r.top), choisi: p.classList.contains('is-choisi') }; }, k);
        const cleB = 'pressedusillon|35400';
        const t0 = await TOP(cleB);
        await pg.evaluate((k) => { const e = [...document.querySelectorAll('.vrm-rpf-carte [data-relais-epingle]')].find((x) => x.getAttribute('data-relais-epingle') === k); if (e) e.click(); }, cleB);
        await pg.waitForTimeout(1500);
        const vu = await TOP(cleB);
        dit(!!t0 && !!vu && t0.top > vp.height * 0.6 && vu.top >= -2 && vu.top < vp.height * 0.7 && vu.top < t0.top - 300 && vu.choisi, 'toucher l’épingle de Saint-Malo amène son point (plus bas) à l’écran (en haut, ou la page au bout)', JSON.stringify({ t0, vu }));
        await pg.evaluate(() => window.scrollTo(0, 0));
        // ── 3. Les barres ──
        const barres = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf [data-rp-delai]')].map((d) => {
          const ligne = d.closest('[data-cc-carte]'); const point = d.closest('[data-relais-point], [data-relais-point-suite]');
          const pb = d.querySelector('[role="progressbar"]'); const plein = d.querySelector('.vrm-rpf-delai-plein'); const txt = d.querySelector('.vrm-rpf-delai-txt');
          return { ligne: ligne ? ligne.getAttribute('data-cc-carte') : '', point: point ? (point.getAttribute('data-relais-point') || point.getAttribute('data-relais-point-suite')) : '', tete: d.getAttribute('data-rp-delai-tete') === '1', code: d.getAttribute('data-rp-delai'), pct: Number(d.getAttribute('data-rp-delai-pct')), ambre: d.getAttribute('data-rp-delai-ambre'), estimee: d.getAttribute('data-rp-delai-estimee') === '1', txt: txt ? txt.textContent.trim() : '', now: pb ? Number(pb.getAttribute('aria-valuenow')) : null, vt: pb ? pb.getAttribute('aria-valuetext') : '', w: plein ? Math.round(plein.getBoundingClientRect().width) : 0, wp: pb ? Math.round(pb.getBoundingClientRect().width) : 0, fond: plein ? getComputedStyle(plein).backgroundColor : '', couleurTxt: txt ? getComputedStyle(txt).color : '', h: pb ? pb.getBoundingClientRect().height : 0 };
        }));
        const lignesSans = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf [data-cc-carte]')].filter((l) => !l.querySelector('[data-rp-delai]')).map((l) => ({ id: l.getAttribute('data-cc-carte'), hors: l.hasAttribute('data-hors-compte'), point: (l.closest('[data-relais-point], [data-relais-point-suite]') || { getAttribute: () => '' }).getAttribute('data-relais-point'), puce: (l.querySelector('[data-rp-echeance]') || { getAttribute: () => null }).getAttribute('data-rp-echeance') })));
        // (12 nov., finitions — Julien : « rien n'est cohérent ») UNE FORME DE LIGNE : chaque colis porte SA barre (la
        // barre unique en tête de point est retirée). La limite du point n'est donc jamais dite deux fois : aucune barre
        // en tête, aucune puce d'échéance en plus de la barre sur une ligne.
        const deCancale = barres.filter((x) => /maisonduquai/i.test(x.point));
        const tC = deCancale.find((x) => !x.tete && x.ligne);
        dit(deCancale.length === 2 && deCancale.every((x) => !x.tete && x.ligne), 'Cancale (2 colis, même arrivée, même limite) : une barre sur CHAQUE ligne, aucune en tête du point', JSON.stringify(deCancale));
        const enTete = await pg.evaluate(() => document.querySelectorAll('.vrm-rpf-tete-delai, [data-rp-delai-tete="1"]').length);
        const puces = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf [data-cc-carte]')].filter((l) => l.querySelector('[data-rp-delai]') && l.querySelector('.vrm-rpf-puce[data-rp-echeance]')).map((l) => l.getAttribute('data-cc-carte')));
        dit(enTete === 0 && !puces.length, '… la limite n’est jamais dite deux fois (ni barre en tête du point, ni puce d’échéance à côté d’une barre)', JSON.stringify({ enTete, puces }));
        const juge = (nomB, x, a) => {
          dit(!!x && x.code === a.code && a.txt.test(x.txt) && x.ambre === a.ambre && x.estimee === a.estimee, `${nomB} : « ${x && x.txt} », ${a.ambre === '1' ? 'AMBRE' : 'neutre'}${a.estimee ? ', estimée' : ''}`, JSON.stringify(x));
          dit(!!x && Math.abs(x.pct - a.pct) <= 1 && x.now === x.pct && !!x.vt && Math.abs(x.w - (x.wp * x.pct) / 100) <= 2, `${nomB} : ${a.pct} % écoulé (aria-valuenow, largeur), aria-valuetext dit`, x ? `${x.pct}/${a.pct} · ${x.w}/${x.wp} · ${x.vt}` : '');
        };
        juge('Cancale', tC, ATTENDU_BARRES.cancale);
        for (const k of ['93000003', 'VGS0000000000301', '93000005']) juge(k, barres.find((x) => x.ligne.includes(k)), ATTENDU_BARRES[k]);
        // Sans date d'arrivée, aucune progression inventée : la barre est là, VIDE, avec ce qu'on sait (« Date limite inconnue »).
        const sm = barres.find((x) => /9601/.test(x.ligne));
        dit(!lignesSans.length && !!sm && sm.pct === 0 && sm.w === 0 && /^Date limite inconnue$/.test(sm.txt), 'Saint-Malo (date d’arrivée inconnue) : la barre vide, « Date limite inconnue » (aucune progression inventée)', JSON.stringify({ sm, lignesSans }));
        const qp = barres.find((x) => /93000006/.test(x.ligne));
        dit(!qp || (qp.pct === 0 && qp.w === 0), '« à vérifier » (Quimper) : aucune progression inventée sur sa barre', JSON.stringify(qp));
        const rouges = barres.filter((x) => [x.fond, x.couleurTxt].some((cc) => { const t = teinte(cc); return t && t.s > 0.45 && (t.h < 15 || t.h > 345); }));
        dit(!rouges.length, 'jamais rouge (remplissage ni texte)', JSON.stringify(rouges));
        const ambres = barres.filter((x) => x.ambre === '1'), neutres = barres.filter((x) => x.ambre === '0');
        dit(ambres.every((x) => { const t = teinte(x.fond); return t && t.s > 0.5 && t.h >= 18 && t.h <= 50; }) && neutres.every((x) => { const t = teinte(x.fond); return t && t.s < 0.2; }), 'ambre dans les dernières 24 h, neutre sinon (couleur rendue)', JSON.stringify(barres.map((x) => [x.ambre, x.fond])));
        dit(barres.filter((x) => x.h > 0).every((x) => x.h >= 3 && x.h <= 6), 'barre fine (3–6 px)', JSON.stringify(barres.map((x) => x.h)));
        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        dit(deb <= 1, 'rien ne déborde', String(deb));
        if (SHOTS) {
          await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(300);
          await pg.screenshot({ path: path.join(SHOTS, `retirer-carte-delai-${nom}.png`) });
          if (tel) { await pg.setViewportSize({ width: vp.width, height: 2600 }); await pg.waitForTimeout(600); await pg.screenshot({ path: path.join(SHOTS, `retirer-carte-delai-${nom}-long.png`) }); await pg.setViewportSize(vp); }
        }
        // Agrandir.
        const ag = pg.locator('[data-retirer-agrandir]').first();
        if (await ag.count()) { const hb = await ag.evaluate((e) => e.getBoundingClientRect().height); dit(hb >= 44, '« Agrandir » ≥ 44 px', String(hb)); await ag.click(); await pg.waitForTimeout(500); const h2 = await pg.evaluate(() => Math.round(document.querySelector('.vrm-rpf-carte').getBoundingClientRect().height)); dit(h2 > c.h + 100, '« Agrandir » donne de la place à la carte', `${c.h} → ${h2}`); }
        else dit(false, '« Agrandir » présent');
        // Hors réseau : la carte part, la liste reste.
        await ctx.setOffline(true);
        await pg.waitForTimeout(800);
        const nReq = requetes.length;
        const hr = await pg.evaluate(() => ({ carte: document.querySelectorAll('.maplibregl-map').length, texte: (document.querySelector('.vrm-main') || document.body).innerText }));
        const apres = requetes.slice(nReq).filter((u) => /openfreemap|api-adresse/.test(u));
        dit(hr.carte === 0 && !apres.length && /100001/.test(hr.texte), 'hors réseau : plus de carte (ni fond ni Base Adresse), les colis et leurs codes restent', JSON.stringify({ carte: hr.carte, apres, code: /100001/.test(hr.texte) }));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `retirer-hors-reseau-${nom}.png`) });
        await ctx.setOffline(false);
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    if (!VUES || VUES.includes('fond-ko')) {
      console.log('\n— fond de carte indisponible · 390');
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, { fondKo: true });
      await essaie('fond ko', async () => {
        await allerRetirer(pg);
        await pg.waitForFunction(() => document.querySelector('[data-retirer-carte-etat="ko"]'), null, { timeout: 15000 }).catch(() => {});
        await pg.waitForTimeout(1500);
        const m = await pg.evaluate(() => { const k = document.querySelector('.vrm-rpf-carte'); return { etat: (document.querySelector('[data-retirer-carte-etat]') || { getAttribute: () => '' }).getAttribute('data-retirer-carte-etat'), visible: !!(k && k.getBoundingClientRect().height > 0), lignes: document.querySelectorAll('.vrm-rpf [data-cc-carte]').length, ko: !!document.querySelector('[data-relais-carte-ko]'), cartes: (window.__vrmCartes || []).length }; });
        dit(m.etat === 'ko' && !m.visible && !m.ko && m.lignes >= 7, 'fond indisponible : la carte se tait (rien de visible), la liste reste entière', JSON.stringify(m));
        await pg.waitForTimeout(2500);
        const n2 = await pg.evaluate(() => (window.__vrmCartes || []).length);
        dit(n2 <= m.cartes, 'et elle ne se recharge pas en boucle', `${m.cartes} → ${n2}`);
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    if (!VUES || VUES.includes('reduit')) {
      console.log('\n— mouvement réduit · 390');
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 }, { reduit: true });
      await essaie('reduit', async () => {
        await allerRetirer(pg);
        await pg.waitForFunction(() => document.querySelectorAll('.vrm-rpf-carte [data-relais-epingle]').length >= 6, null, { timeout: 15000 }).catch(() => {});
        await pg.evaluate(() => window.scrollTo(0, 0));
        const t = await pg.evaluate(async () => { const k = 'pressedusillon|35400'; const top = () => { const p = [...document.querySelectorAll('[data-relais-point]')].find((x) => x.getAttribute('data-relais-point') === k); return p ? Math.round(p.getBoundingClientRect().top) : null; }; const e = [...document.querySelectorAll('.vrm-rpf-carte [data-relais-epingle]')].find((x) => x.getAttribute('data-relais-epingle') === k); if (!e) return null; const y0 = top(); e.click(); await new Promise((r) => requestAnimationFrame(() => r())); return { y0, y1: top() }; });
        await pg.waitForTimeout(800);
        const y2 = await pg.evaluate(() => { const p = [...document.querySelectorAll('[data-relais-point]')].find((x) => x.getAttribute('data-relais-point') === 'pressedusillon|35400'); return p ? Math.round(p.getBoundingClientRect().top) : null; });
        dit(!!t && t.y1 !== t.y0 && Math.abs(t.y1 - y2) <= 2, 'mouvement réduit : toucher une épingle saute au point sans défilement animé', JSON.stringify({ ...t, y2 }));
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
    if (!VUES || VUES.includes('journee')) {
      console.log('\n— Ma journée au démarrage · 390');
      const { ctx, pg, errs, requetes } = await ouvrir(b, { width: 390, height: 844 }, { tab: 'journee' });
      await essaie('journee', async () => {
        await pg.waitForTimeout(6000);
        // (La Base Adresse « limit=1 » de Ma journée — la distance au point — est d'avant ce chantier : pas jugée ici.)
        const ml = requetes.filter((u) => /maplibre|fondCarte|openfreemap/.test(u));
        dit(!ml.length, 'maplibre (et son fond) ne partent pas au démarrage de Ma journée', ml.join(' | '));
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
