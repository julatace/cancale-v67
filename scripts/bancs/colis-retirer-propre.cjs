// Banc : COLIS → « À RETIRER » PROPRE (3 nov., Julien, 10 h 19 : « beaucoup trop brouillon » ;
// 10 h 23 : « tout doit être parfait dans cet onglet »). Le cas de sa capture, en données INVENTÉES de
// même forme (dépôt public) : un relais Mondial Relay avec code connu, code à venir et QR ; un locker
// au dernier jour ; deux relais du MÊME nom dans deux villes (l'un sans échéance connue) ; un colis sans
// lieu (« Lieu à confirmer ») ; trois « à vérifier » (dont « Fin d'instance » chez le transporteur) ;
// 13 achats en route sans point ; un achat reparti (19,64 €) ; un compte aux données de 17 jours.
// Exige (jugé sur data-* et nombres, §6.4) : chaque colis UNE fois ; « À retirer · N » = la carte sombre
// = `vrm_colis_retirer` ; une carte par point (nom + adresse sur une ligne) ; une ligne par colis
// (vignette 44, titre, puces, « Code » s'il est connu sinon « Code à venir », « J'ai retiré ») ; le détail
// s'ouvre au toucher ; « Lieu à confirmer » à la fin ; « À vérifier · 3 » replié, statut en puce
// (« Fin d'instance » ⇒ « Retour à l'expéditeur ? ») ; « 13 en route » en puce (liste au toucher) ;
// « 1 compte à relire » ; « Remboursement à vérifier · 19,64 € » ; AUCUNE phrase explicative (texte des
// paragraphes interdits listés) ; rien ne déborde ; aucune erreur. Jeux (JR_JEU) : base · zero · un ·
// trente (30 colis) · neuf (9 au même relais). 390 tactile clair/sombre + 1512.
const path = require('path');
let chromium, PW;
try { PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright')); }
catch (_) { PW = require('playwright'); }
({ chromium } = PW);
// (6 nov., filet 6) `NAVIGATEUR=webkit` : le moteur de Safari (_navigateur.cjs).
const { lancer, estWebkit } = require('./_navigateur.cjs');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4421);
const SHOTS = process.env.SHOTS || '';
const JEU = process.env.JR_JEU || 'base';
const VUES = process.env.JR_VUES ? process.env.JR_VUES.split(',') : null;
const maintenant = new Date(2026, 10, 3, 10, 19, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J), dans = (j) => iso(MS + j * J);
// Une date limite rangée a la forme d'un JOUR (« 2026-11-07 », la forme réelle des lignes).
const jourDans = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) },
  { id: 2, vinted_user_id: '222', login: 'compte_b', domain: 'www.vinted.fr', updated_at: iso(MS) },
];
const cap = iso(MS);
const url = (k) => `https://images1.vinted.net/t/b${k}/f800/x${k}.jpeg?s=x`;
const achat = (id, titre, statut, k, extra = {}) => ({ transaction_id: id, conversation_id: 7000 + id % 1000, title: titre, price: { amount: '40', currency_code: 'EUR' }, status: statut, date: ilYa(5), photo: { url: url(k) }, ...extra });
const track = (suivi, lieu, code, extra = {}) => ({ id: `email_track_mondialrelay_${suivi}`, data: Object.assign({ type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', statusLabel: 'Arrivé au point de retrait', subject: `Votre colis ${suivi} est disponible`, receivedAt: ilYa(0.3), emailAt: ilYa(0.3), arriveLe: ilYa(0.3), code, lieu, limite: jourDans(4), consigne: false, account: 'compte_a' }, extra) });
const AU_RELAIS = 'Colis déposé en point relais';
let ACHATS_A = [], RELAIS = {}, TRACKS = [], EN_ROUTE = 0, REPARTI = false, VIEUX = false;
if (JEU === 'base') {
  ACHATS_A = [achat(9301, 'Nike Dunk Low panda taille 38', AU_RELAIS, 9, { transaction_user_status: 'needs_action' })];
  RELAIS = { 9301: { code: '012345', lieu: 'Phone Cash, 12 rue du Port, 35260 Cancale', transporteur: 'mondialrelay', at: ilYa(0) } };
  TRACKS = [
    track('90000021', 'Phone Cash, 12 rue du Port, 35260 Cancale', null),                                       // code pas encore reçu
    track('90000022', 'Phone Cash, 12 rue du Port, 35260 Cancale', null, { qrB64: 'iVBORw0KGgo=', qrType: 'image/png' }),   // QR seul
    // « Ton achat t'attend au point relais » (main, 3 nov. : `ligneArrivee`, api/_lib/achat-arrive-relais.js) :
    // arrivé, lieu connu, code pas encore reçu, pas de n° de suivi, titre de l'article lu dans l'e-mail.
    { id: 'email_track_vinted_commande_cmd01', data: { type: 'suivi', carrier: 'autre', suivi: '', status: 'available', statusLabel: 'Arrivé au point relais (Vinted)', subject: 'Ton achat t’attend au point relais', receivedAt: ilYa(0.2), emailAt: ilYa(0.2), arriveLe: ilYa(0.2), code: null, code2: null, artTitle: 'Sac seau toile écrue', lieu: 'TABAC DU QUAI, 12 Rue des Mouettes, 22000 Saint-Brieuc', limite: null, consigne: false, conv: '', source: 'vinted-commande', forme: 'relais', cleLigne: 'cmd01', account: 'compte_a' } },
    track('90000003', 'LOCKER 24/7 MARCHE DU PORT, Rue des Rosiers, 22100 Dinan', '333333', { consigne: true, limite: jourDans(0) }),
    track('90000006', 'POINT PRESSE, 3 Rue Haute, 56000 Vannes', '666666'),
    track('90000007', 'POINT PRESSE, 5 Grande Rue, 29200 Brest', '777777', { limite: null }),
    track('90000008', null, '888888'),
    track('90000011', 'TABAC DE LA HOULE, 2 Quai Gambetta, 35260 Cancale', '111111', { limite: jourDans(-2), receivedAt: ilYa(8), emailAt: ilYa(8), arriveLe: ilYa(8) }),
    track('90000012', 'TABAC DE LA HOULE, 2 Quai Gambetta, 35260 Cancale', '121212', { limite: jourDans(-2), receivedAt: ilYa(8), emailAt: ilYa(8), arriveLe: ilYa(8) }),
    track('90000013', 'TABAC DE LA HOULE, 2 Quai Gambetta, 35260 Cancale', '131313', { receivedAt: ilYa(3), emailAt: ilYa(3), arriveLe: ilYa(3) }),
    { id: 'transp_mondialrelay_90000013', data: { v: 1, cp: '35260', etat: 'incident', fini: false, suivi: '90000013', carrier: 'mondialrelay', libelle: 'Fin d’instance', lieuNom: '', lieuRue: '', lieuCp: '', lieuVille: '', limite: null, etatAt: ilYa(0.5), source: 'serveur', evenements: [] } },
  ];
  EN_ROUTE = 13; REPARTI = true; VIEUX = true;
} else if (JEU === 'un') {
  TRACKS = [track('90000003', 'LOCKER 24/7 MARCHE DU PORT, Rue des Rosiers, 22100 Dinan', '333333', { consigne: true })];
} else if (JEU === 'neuf') {
  TRACKS = Array.from({ length: 9 }, (_, k) => track(String(91000000 + k), 'Phone Cash, 12 rue du Port, 35260 Cancale', String(400000 + k), { limite: jourDans(k % 3) }));
} else if (JEU === 'trente') {
  const V = ['35000 Rennes', '56000 Vannes', '29200 Brest', '22100 Dinan', '35400 Saint-Malo', '44000 Nantes'];
  TRACKS = Array.from({ length: 30 }, (_, k) => track(String(92000000 + k), `RELAIS ${k % 6}, ${k + 1} Rue Longue, ${V[k % 6]}`, k % 4 ? String(500000 + k) : null, { limite: k % 5 ? jourDans(k % 6) : null }));
}
for (let k = 0; k < EN_ROUTE; k++) ACHATS_A.push(achat(9400 + k, `Achat en route ${k + 1}`, "Colis en cours d'acheminement", 20 + k));
if (REPARTI) ACHATS_A.push(achat(9501, 'Adidas Gazelle rouge taille 40', 'Commande non réclamée - Retournée à l\'expéditeur.rice', 12, { price: { amount: '19.64', currency_code: 'EUR' } }));
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: cap, payload: { my_orders: ACHATS_A } } },
  { id: 'harvest_222_orders_purchased', data: { capturedAt: VIEUX ? ilYa(16) : cap, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: cap, payload: { my_orders: [] } } },
  { id: 'harvest_222_orders_sold', data: { capturedAt: VIEUX ? ilYa(17) : cap, payload: { my_orders: [] } } },
  { id: 'panel_colis_relais', data: RELAIS },
  ...TRACKS,
];
const NB_ATTENDU = { base: 8, zero: 0, un: 1, neuf: 9, trente: 30 }[JEU];
// Les phrases que Julien ne veut plus voir (10 h 19) — aucune ne doit s'afficher.
const INTERDITS = [/Date limite de retrait inconnue/i, /4 à 7 j en général/i, /ne nomme pas le point/i, /dont Vinted ne dit pas encore le point/i, /datent d.il y a/i, /Achats relus/i, /sans suivi Vinted relev/i, /n.envoient aucun e-?mail/i, /Fond : OpenFreeMap/i, /Transporteur pas (lu|encore connu)/i, /Hors du compte/i, /Point pas encore connu/i, /est reparti chez son vendeur/i, /confirmé il y a/i];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

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
const TEINTES = ['#dfe3e8', '#e8e1d8', '#dfe5dd', '#e6dcdc', '#e2dfe8', '#e8e4d6'];
const photoSvg = (k) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${TEINTES[k % 6]}"/><path d="M60 250 C80 190 150 175 190 200 C230 222 285 205 330 232 C352 246 346 282 306 284 L84 284 C62 284 52 268 60 250 Z" fill="rgba(30,34,40,.62)"/><path d="M60 284 L330 284 L326 300 L66 300 Z" fill="rgba(255,255,255,.85)"/><text x="200" y="120" font-size="90" text-anchor="middle" fill="rgba(0,0,0,.35)" font-family="sans-serif">${k}</text></svg>`;
const sacSvg = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#efe9df"/><rect x="110" y="150" width="180" height="170" rx="18" fill="${c}"/><path d="M150 150 C150 80 250 80 250 150" stroke="${c}" stroke-width="16" fill="none"/></svg>`;

const ouvrir = async (b, vp, sombre) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const u = r.request().url();
    const m = /images1\.vinted\.net\/t\/b(\d+)\//.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg(Number(m[1])) });
    if (/api-adresse\.data\.gouv\.fr/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ features: [] }) });
    if (/\/favicon\.ico$/i.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="4" y="4" width="24" height="24" rx="5" fill="#8e8e93"/></svg>' });
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
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs };
};

(async () => {
  const b = await lancer(PW, { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch((e) => { if (estWebkit) throw e; return chromium.launch(); });
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair']]) {
      if (VUES && !VUES.includes(nom)) continue;
      console.log(`\n— Colis → À retirer · ${nom} · jeu ${JEU}`);
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie('retirer', async () => {
        await pg.locator('[data-colis-section]').first().waitFor({ timeout: 30000 });
        await pg.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); } catch (_) { return false; } }, null, { timeout: 20000 }).catch(() => {});
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); /* (11 nov., lot DJ3) « À retirer » est en tête d'Achats */ await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 });
        await pg.waitForTimeout(2500);
        if (process.env.JR_DBG) console.log(await pg.evaluate(() => [document.querySelector('[data-colis-retraits="outils"]'), document.querySelector('[data-colis-retraits="outils"] .vrm-achats'), ...document.querySelectorAll('[data-colis-retraits="outils"] .vrm-achats > *'), document.querySelector('.vrm-rpf-verifier'), document.querySelector('.vrm-rpf')].filter((e) => e && e.getBoundingClientRect().height > 0).map((e) => `${Math.round(e.getBoundingClientRect().top)}/${Math.round(e.getBoundingClientRect().height)} mt${getComputedStyle(e).marginTop} pt${getComputedStyle(e).paddingTop} ${e.tagName}.${String(e.className).slice(0, 30)} ${[...e.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name).join(' ')} :: ${e.innerText.slice(0, 90).replace(/\n/g, ' ')}`).join('\n')));
        if (process.env.JR_DBG) console.log('GAP2', await pg.evaluate(() => { const q = (x) => { const e = document.querySelector(x); if (!e) return x + ' —'; const c = getComputedStyle(e), r = e.getBoundingClientRect(); return `${x} top${Math.round(r.top)} h${Math.round(r.height)} mt${c.marginTop} mb${c.marginBottom} pt${c.paddingTop} pb${c.paddingBottom}`; }; return ['.vrm-rpf', '.vrm-colis-retirer', '[data-colis-retraits]', '[data-colis-retraits] > *', '.vrm-achats', '.vrm-achats > *', '.vrm-colis-fraicheur', '.vrm-rpf-verifier'].map(q).join('\n'); }));
        if (process.env.JR_DBG) console.log('GAP', await pg.evaluate(() => { const d = document.querySelector('.vrm-rpf-verifier'); const y0 = d ? d.getBoundingClientRect().bottom : 0; return [...document.querySelectorAll('.vrm-main *')].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top >= y0 - 1 && r.top < y0 + 90 && !e.closest('[data-colis-retraits]'); }).slice(0, 12).map((e) => `${Math.round(e.getBoundingClientRect().top)}/${Math.round(e.getBoundingClientRect().height)} mb${getComputedStyle(e).marginBottom} ${e.tagName}.${String(e.className).slice(0, 40)} ${[...e.attributes].filter((a) => a.name.startsWith('data-')).map((a) => a.name).join(' ')}`).join('\n'); }));
        // (9 nov., lot AG) la fraîcheur des comptes : la ligne UNIQUE du haut de l'app (plus de puce sur Colis).
        await pg.waitForFunction(() => { const e = document.querySelector('[data-fraicheur-unique]'); return e && !['encours', 'charge'].includes(e.getAttribute('data-fraicheur-unique')); }, null, { timeout: 25000 }).catch(() => {});
        const m = await pg.evaluate(() => {
          const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const main = document.querySelector('.vrm-main');
          const lignes = [...document.querySelectorAll('.vrm-rpf [data-cc-carte]')];
          const pub = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null');
          return {
            pub, onglet: (document.querySelector('[data-colis-onglet-choix="retirer"]') || { getAttribute: () => null }).getAttribute('data-colis-onglet-n'),
            carte: (document.querySelector('[data-fu-colis-retirer]') || { getAttribute: () => null }).getAttribute('data-fu-colis-retirer'),
            idents: lignes.map((l) => l.getAttribute('data-cc-carte')),
            comptes: lignes.filter((l) => !l.hasAttribute('data-hors-compte')).length,
            points: [...document.querySelectorAll('.vrm-rpf-section:not(.is-repli) .vrm-rpf-point')].map((p) => ({ cle: p.getAttribute('data-relais-point'), nom: (p.querySelector('.vrm-rpf-nom') || {}).textContent, adr: (p.querySelector('[data-relais-adresse]') || {}).textContent || '', h: (() => { const a = p.querySelector('.vrm-rpf-nom'), d = p.querySelector('[data-relais-adresse]'); if (!d) return 0; const ra = a.getBoundingClientRect(), rd = d.getBoundingClientRect(); return rd.top >= ra.bottom - 2 && a.scrollWidth <= a.clientWidth + 1 && rd.height <= 24 ? 0 : 99; })(), n: p.querySelectorAll('[data-cc-carte]').length, inconnu: p.classList.contains('is-inconnu') })),
            rangs: lignes.filter(vis).map((l) => { const r = l.querySelector('.vrm-rpf-ouvrir'); const v = l.querySelector('.vrm-rpf-vignette'); return { id: l.getAttribute('data-cc-carte'), code: !!l.querySelector('[data-rp-code]'), avenir: !!l.querySelector('[data-rp-code-a-venir]'), retire: !!l.querySelector('.vrm-rpf-rang [data-colis-retire]'), ech: (l.querySelector('[data-rp-echeance]') || { getAttribute: () => null }).getAttribute('data-rp-echeance'), statut: (l.querySelector('[data-rp-statut]') || {}).textContent || '', vw: v ? Math.round(v.getBoundingClientRect().width) : 0, boutons: [...l.querySelectorAll('.vrm-rpf-rang button')].map((x) => Math.round(x.getBoundingClientRect().height)), detail: !!l.querySelector('[data-rp-detail]') }; }),
            sections: [...document.querySelectorAll('[data-rp-section]')].map((x) => x.getAttribute('data-rp-section')),
            dansSection: Object.fromEntries([...document.querySelectorAll('.vrm-rpf [data-cc-carte]')].map((l) => [l.getAttribute('data-cc-carte'), (l.closest('[data-rp-section]') || { getAttribute: () => '' }).getAttribute('data-rp-section')])),
            air: (() => { const t = [...document.querySelectorAll('[data-rp-section]')]; return t.slice(1).map((x, i) => Math.round(x.getBoundingClientRect().top - t[i].getBoundingClientRect().bottom)); })(),
            verif: (() => { const d = document.querySelector('.vrm-rpf-verifier'); return d ? { n: d.getAttribute('data-retirer-a-verifier'), ouvert: d.open } : null; })(),
            enRoute: (document.querySelector('[data-retirer-en-route-sans]') || { getAttribute: () => null }).getAttribute('data-retirer-en-route-sans'),
            relire: (document.querySelector('[data-fraicheur-a-relire]') || { getAttribute: () => null }).getAttribute('data-fraicheur-a-relire'),
            puce: document.querySelectorAll('[data-comptes-a-relire]').length,
            reparti: [...document.querySelectorAll('.vrm-repartis-courts .vrm-reparti-court')].filter(vis).map((x) => { const p = x.querySelector('.vrm-rpf-puce.is-ambre'), mt = x.querySelector('[data-montant]'); return (p ? p.textContent : '') + ' · ' + (mt && vis(mt) ? mt.textContent : ''); }),
            texte: main ? main.innerText : '', deb: document.documentElement.scrollWidth - window.innerWidth,
            hors: [...document.querySelectorAll('.vrm-main *')].filter((e) => vis(e) && !e.closest('svg,.vrm-rangee,.vrm-filtres,[data-defile],.maplibregl-map') && getComputedStyle(e).position !== 'fixed' && e.getBoundingClientRect().right > window.innerWidth + 1).map((e) => String(e.className).slice(0, 40)).slice(0, 4),
          };
        });
        const N = m.pub && Number.isFinite(m.pub.total) ? m.pub.total : null;
        dit(N === NB_ATTENDU, `le nombre publié (vrm_colis_retirer) = ${NB_ATTENDU} colis du jeu`, JSON.stringify(m.pub));
        dit(m.onglet === String(N), '« À retirer · N » = vrm_colis_retirer', `${m.onglet} / ${N}`);
        if (N) dit(m.carte === String(N), 'la carte sombre dit le même N', `${m.carte} / ${N}`);
        dit(m.comptes === N, 'autant de lignes comptées que N (chaque colis une fois)', `${m.comptes} / ${N}`);
        dit(new Set(m.idents).size === m.idents.length, 'chaque colis UNE fois à l’écran', m.idents.join(','));
        // (6 nov., v36-visuel-2) LA RÈGLE A CHANGÉ (demande du 6 nov. : « l'adresse passe dessous ») : le NOM garde sa ligne,
        // entier ; l'adresse vit sur la ligne d'en dessous (une ligne). Avant : nom et adresse sur la même ligne, l'adresse rognée.
        dit(m.points.every((p) => p.h <= 60), 'le nom du point garde sa ligne (entier), l’adresse passe dessous (une ligne)', JSON.stringify(m.points.filter((p) => p.h > 60)));
        dit(m.rangs.every((r) => r.vw >= 44 && r.vw <= 64), 'vignette de 44 à 64 px sur chaque ligne (56 depuis v36-visuel-2)', JSON.stringify(m.rangs.map((r) => r.vw)));
        dit(m.rangs.every((r) => r.boutons.every((h) => h >= 44)), 'boutons de ligne ≥ 44 px', JSON.stringify(m.rangs.find((r) => r.boutons.some((h) => h < 44))));
        dit(m.rangs.filter((r) => !/^r:/.test(r.id)).every((r) => r.retire), '« J’ai retiré » sur chaque ligne', '');
        dit(m.rangs.every((r) => !r.detail), 'le détail est fermé (il s’ouvre au toucher)');
        const interdits = INTERDITS.filter((re) => re.test(m.texte)).map(String);
        dit(!interdits.length, 'aucune des phrases retirées ne s’affiche', interdits.join(' | '));
        dit(m.deb <= 1 && !m.hors.length, 'rien ne déborde', `${m.deb}px ${m.hors.join(' | ')}`);
        if (JEU === 'base') {
          const by = (s) => m.rangs.find((r) => r.id && r.id.includes(s)) || {};
          dit(by('9301').code && !by('9301').avenir, 'code connu ⇒ bouton « Code »', JSON.stringify(by('9301')));
          dit(by('90000021').avenir && !by('90000021').code, 'code pas encore lu ⇒ puce « Code à venir »', JSON.stringify(by('90000021')));
          dit(by('90000022').code, 'QR ⇒ bouton « Code »', JSON.stringify(by('90000022')));
          const cmd = await pg.evaluate(() => { const l = [...document.querySelectorAll('.vrm-rpf [data-cc-carte]')].find((x) => /Sac seau toile/.test(x.innerText)); return l ? { avenir: !!l.querySelector('[data-rp-code-a-venir]'), code: !!l.querySelector('[data-rp-code]'), point: (l.closest('[data-relais-point]') || { getAttribute: () => '' }).getAttribute('data-relais-point') } : null; });
          dit(!!cmd && cmd.avenir && !cmd.code && /tabacduquai/i.test(cmd.point || ''), '« Ton achat t’attend » : titre de l’e-mail, « Code à venir », dans le relais lu', JSON.stringify(cmd));
          const titres = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf [data-rp-titre]')].filter((t) => t.getBoundingClientRect().height > 0).map((t) => ({ t: t.textContent, h: Math.round(t.getBoundingClientRect().height) })));
          dit(titres.every((x) => x.h <= 22) && !titres.some((x) => /^Colis Mondial Relay$/.test(x.t)), 'titres sur UNE ligne, jamais « Colis Mondial Relay » (n° court ou achat relié)', JSON.stringify(titres.slice(0, 5)));
          const trou = await pg.evaluate(() => { const d = document.querySelector('[data-rp-section="route"]'); const r = document.querySelector('[data-rp-section="argent"]'); return d && r ? Math.round(r.getBoundingClientRect().top - d.getBoundingClientRect().bottom) : null; });
          dit(trou != null && trou <= 60, 'pas de grand vide entre « En route » replié et « Argent à vérifier »', String(trou));
          dit(by('90000003').ech === 'dernier', 'locker au dernier jour ⇒ puce ambre « dernier jour »', JSON.stringify(by('90000003')));
          // (8 nov., barre du délai) LA RÈGLE A CHANGÉ : sans date limite lue mais avec l'arrivée lue, la barre dit la garde
          // de SON transporteur, « estimée » (src/delaiRetrait.js) — jamais une date présentée comme lue.
          const est7 = await pg.evaluate(() => { const l = document.querySelector('[data-cc-carte="r:e:90000007"]'); const d = l && l.querySelector('[data-rp-delai]'); return d ? { est: d.getAttribute('data-rp-delai-estimee'), txt: d.innerText } : null; });
          dit(!!est7 && est7.est === '1' && /estimée/.test(est7.txt), 'échéance pas lue ⇒ barre « estimée » (garde du transporteur), jamais une date lue', JSON.stringify(est7));
          dit(by('90000006').ech === 'date', 'échéance connue ⇒ « jusqu’au jj/mm »', JSON.stringify(by('90000006')));
          const pp = m.points.filter((p) => /POINT PRESSE/i.test(p.nom || ''));
          dit(pp.length === 2, 'même nom de relais dans deux villes : deux cartes', JSON.stringify(pp));
          // (3 nov., 13 h 02) Des SECTIONS, dans l'ordre : aujourd'hui · prêts · code à venir · lieu à confirmer ·
          // à vérifier · en route · argent à vérifier ; chaque colis UNE fois, dans SA section.
          dit(m.sections.join(',') === 'aujourdhui,prets,avenir,lieu,verifier,route,argent', 'sections dans l’ordre (aujourd’hui > prêts > code à venir > lieu > à vérifier > en route > argent)', m.sections.join(','));
          const sec = (s) => Object.entries(m.dansSection).filter(([, v]) => v === s).map(([k]) => k);
          dit(sec('aujourdhui').length === 1 && /90000003/.test(sec('aujourdhui')[0]), '« À retirer aujourd’hui » : le seul colis au dernier jour', sec('aujourdhui').join());
          // (5 nov., Julien : « 2 points de retrait alors que c'est le même ») UN POINT, UNE CARTE : Phone Cash
          // (code connu, QR, code pas lu) va TOUT ENTIER dans « Prêts à retirer », la ligne sans code garde sa
          // puce « Code à venir » ; « Code à venir » ne garde que les points dont AUCUN colis n'a de code.
          dit(sec('prets').every((k) => !/cmd01|90000008/.test(k)) && sec('prets').some((k) => /9301/.test(k)) && sec('prets').some((k) => /90000022/.test(k)) && sec('prets').some((k) => /90000021/.test(k)), '« Prêts à retirer » : les points qui ont un colis avec code ou QR, tous leurs colis dedans', sec('prets').join());
          dit(sec('avenir').some((k) => /cmd01|conv|commande/.test(k) || k === 'r:e:email_track_vinted_commande_cmd01') && sec('avenir').every((k) => !/9301|90000022|90000021/.test(k)), '« Code à venir » : les points sans aucun code', sec('avenir').join());
          dit(!(await pg.evaluate(() => document.querySelectorAll('.vrm-rpf-section:not(.is-repli) [data-relais-point-suite]').length)), 'chaque point UNE fois (aucune carte « suite » dans une autre section)');
          dit(sec('lieu').length === 1 && /90000008/.test(sec('lieu')[0]), '« Lieu à confirmer » : le colis sans lieu', sec('lieu').join());
          dit(m.air.every((a) => a >= 20 && a <= 40), 'de l’air entre les sections (20–40 px)', m.air.join(','));
          dit(m.verif && m.verif.n === '3' && !m.verif.ouvert, '« À vérifier · 3 » replié', JSON.stringify(m.verif));
                    dit(m.enRoute === '13', '« En route » (13 sans point) replié à la fin', m.enRoute);
          // Les villes : lues dans l'adresse (CP + ville) ; choisir une ville filtre la liste, la carte sombre suit,
          // (3 nov., 19 h) « Lieu à confirmer » RESTE visible quand une ville est choisie (un colis caché est un
          // colis perdu) ; le nombre de la ville = ses colis seuls ; le choix est retenu.
          const vil = await pg.evaluate(() => [...document.querySelectorAll('[data-retirer-villes] [data-ville]')].map((b) => ({ v: b.getAttribute('data-ville'), n: b.getAttribute('data-ville-n'), txt: b.textContent })));
          dit(vil.length >= 3 && vil[0].v === '' && vil.some((x) => x.v === 'cancale') && vil.some((x) => x.v === 'vannes'), 'sélecteur « Toutes · Cancale · … » (villes lues dans l’adresse)', JSON.stringify(vil));
          const vC = vil.find((x) => x.v === 'cancale');
          await pg.locator('[data-retirer-villes] [data-ville="cancale"]').first().click(); await pg.waitForTimeout(500);
          const f = await pg.evaluate(() => ({ lignes: [...document.querySelectorAll('.vrm-rpf .vrm-rpf-point:not(.is-inconnu) [data-cc-carte]:not([data-hors-compte])')].length, nInconnu: [...document.querySelectorAll('.vrm-rpf .vrm-rpf-point.is-inconnu [data-cc-carte]')].length, inconnu: !!document.querySelector('.vrm-rpf-point.is-inconnu'), carte: (document.querySelector('[data-fu-colis-retirer]') || { getAttribute: () => null }).getAttribute('data-fu-colis-retirer'), memo: localStorage.getItem('vrm_retirer_ville'), pts: [...document.querySelectorAll('.vrm-rpf-point:not(.vrm-rpf-verifier) [data-relais-adresse]')].map((x) => x.textContent) }));
          dit(vC && f.lignes === Number(vC.n) && f.carte === vC.n && f.pts.every((a) => /Cancale/i.test(a)) && f.inconnu && f.nInconnu === 1, 'Cancale choisie : ses points seuls, la carte sombre dit son nombre, « Lieu à confirmer » (1) reste visible', JSON.stringify(f));
          dit(f.memo === 'cancale', 'le choix de ville est retenu', f.memo);
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `retirer-ville-cancale-${nom}.png`) });
          await pg.locator('[data-retirer-villes] [data-ville=""]').first().click(); await pg.waitForTimeout(400);
          dit(m.relire === '1' && m.puce === 0, '« 1 compte à relire » : nommé par la ligne du haut, plus en puce sur Colis (lot AG)', `${m.relire} · puce ×${m.puce}`);
          // (6 nov., v36-visuel-2) La RÈGLE : la ligne dit « Remboursement à vérifier » (puce) ET son montant (`montantCommande`,
          // écrit par `montant()`), visible — la puce et le montant vivent à part (une puce ne se coupe plus sur 2 lignes).
          dit(m.reparti.some((t) => /^Remboursement à vérifier · 19,64\u00a0?\s?€$/.test(t.replace(/\u202f/g, ' '))), '« Remboursement à vérifier » et son montant 19,64 €', m.reparti.join(' | '));
          // Ouvrir « À vérifier » : le statut en puce.
          await pg.evaluate(() => { const d = document.querySelector('.vrm-rpf-verifier'); if (d) d.open = true; });
          await pg.waitForTimeout(300);
          const st = await pg.evaluate(() => [...document.querySelectorAll('.vrm-rpf-verifier [data-rp-statut]')].map((x) => x.textContent));
          dit(st.length === 3 && st.includes('Retour à l’expéditeur ?'), 'À vérifier : statut en puce (« Fin d’instance » ⇒ « Retour à l’expéditeur ? »)', st.join(' | '));
          // Le détail au toucher.
          await pg.locator('[data-cc-carte*="9301"] .vrm-rpf-ouvrir').first().click();
          await pg.waitForTimeout(300);
          const det = await pg.evaluate(() => { const l = document.querySelector('[data-cc-carte*="9301"]'); const d = l && l.querySelector('[data-rp-detail]'); return d ? { code: !!d.querySelector('[data-code-retrait="012345"], .vrm-rp-gestes'), txt: d.innerText.slice(0, 200) } : null; });
          dit(!!det && det.code, 'toucher la ligne ouvre son détail (code, gestes)', JSON.stringify(det));
          await pg.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__codeCopie=t;}}}));
          await pg.locator('[data-cc-carte*="9301"] .vrm-rpf-code').first().click();
          dit(await pg.evaluate(()=>window.__codeCopie)==='012345','Code copie le texte exact en conservant le zéro initial');
          const gestes=await pg.locator('[data-cc-carte*="9301"] .vrm-rpf-rang button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.top+r.height/2;}));
          dit(gestes.every(y=>Math.abs(y-gestes[0])<2),'ouvrir, code et retrait restent côte à côte');
          await pg.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('refus');}}}));
          await pg.locator('[data-cc-carte*="9301"] .vrm-rpf-code').first().click();
          dit(await pg.locator('[data-cc-carte*="9301"] [data-rp-detail]').count()===1,'un presse-papiers refusé garde le détail disponible');
          await pg.locator('[data-rp-section="route"] > summary').first().click();
          await pg.waitForTimeout(300);
          const nl = await pg.evaluate(() => [...document.querySelectorAll('[data-en-route-liste] [data-en-route-achat]')].filter((x) => x.getBoundingClientRect().height > 0).length);
          dit(nl === 13, 'ouvrir « En route » montre les 13 achats', String(nl));
          await pg.locator('[data-rp-section="route"] > summary').first().click();
          await pg.evaluate(() => { const d = document.querySelector('.vrm-rpf-verifier'); if (d) d.open = false; });
          await pg.locator('[data-cc-carte*="9301"] .vrm-rpf-ouvrir').first().click();
          await pg.waitForTimeout(300);
        }
        if (SHOTS) {
          const suf = `${nom}${JEU === 'base' ? '' : '-' + JEU}`;
          await pg.screenshot({ path: path.join(SHOTS, `retirer-${suf}.png`) });
          if (vp.width < 600) { const h = await pg.evaluate(() => document.documentElement.scrollHeight); await pg.setViewportSize({ width: vp.width, height: 3400 }); await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(500); await pg.screenshot({ path: path.join(SHOTS, `retirer-${suf}-long.png`) }); await pg.setViewportSize(vp); }
        }
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
