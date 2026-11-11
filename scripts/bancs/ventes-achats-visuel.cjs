// Banc : VENTES ET ACHATS, BEAUX ET SOBRES (11 nov., lot `ventes-achats-visuel`).
// Julien, sur ses captures de production : « ces visuels ne sont pas top du tout » ; principe : « plus beau,
// simple, surtout PRATIQUE ». Ce banc MESURE la forme (jamais un libellé, §6.4) :
//  B. UN seul bouton principal bleu plein visible sur l'écran Ventes (« Tout imprimer ») — chaque bordereau
//     s'imprime par une petite action de ligne (`data-fu-imprimer`), secondaire, compacte ;
//  W. sur ordinateur, AUCUN bouton plus large que la moitié de la liste (plus de bouton pleine largeur) ;
//  F. la frise : une barre FINE (≤ 4 px), UN seul mot visible par frise (l'étape actuelle), le bleu seulement
//     sur l'étape actuelle (les étapes passées neutres), l'ambre seulement si un geste est dû ;
//  H. hauteur des cartes de vente (ordinateur ≤ 96 px, téléphone ≤ 190 px) ;
//  S. « à saisir » n'est écrit sur AUCUNE ligne : une seule invitation en tête (`data-ventes-achats`, « Prix d'achat N/M connus · Compléter ») ;
//  T. au téléphone, toute cible tactile de la ligne ≥ 44 px ; rien ne déborde ;
//  E. en-tête de groupe transporteur (s'il existe) : logo ≤ 22 px, hauteur ≤ 40 px ;
//  A. Achats : aucun bandeau gris pleine largeur avec un logo centré ; ≤ 1 bouton bleu plein ;
//  Z. aucune erreur de page, l'écran n'est pas tombé sur le garde-fou.
// Données INVENTÉES (dépôt public), formes réelles (celles de `selection-bordereaux` et `suivi-commandes`).
// 390 tactile et 1512, clair et sombre. Lancer : npm run build, puis node scripts/bancs/ventes-achats-visuel.cjs
// (BANC_PORT 9083 ; SHOTS=dossier pour les captures ; BANC_SEUL=390,1512).
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const NM = path.join(__dirname, '..', '..', 'node_modules');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 9083);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date();
const MS = maintenant.getTime(), J = 864e5, H = 36e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
// À envoyer : 3 bordereaux (2 Mondial Relay, 1 Chronopost), dont un sans prix d'achat ; envoyées ; finalisées.
const AE = [
  { tx: 9601, titre: 'Alpha Nike Air Max 90 taille 42', suivi: '41234561', num: '61', forme: 'mr', achat: '30' },
  { tx: 9602, titre: 'Bravo Adidas Gazelle taille 40', suivi: '42234562', num: '62', forme: 'mr' },
  { tx: 9603, titre: 'Charlie Asics Gel-Lyte III taille 41', suivi: 'XA123456789FR', num: '63', forme: 'chrono' },
];
const EN = [
  { tx: 9611, titre: 'Delta New Balance 990 taille 43', num: '71', status: 'Colis en cours d’acheminement', tus: 'waiting' },
];
const FI = [
  { tx: 9621, titre: 'Echo Nike Dunk Low taille 44', num: '81', status: 'Commande finalisée', tus: 'completed', achat: '40' },
  { tx: 9622, titre: 'Foxtrot Puma Suede taille 39', num: '82', status: 'Commande finalisée', tus: 'completed' },
];
const TOUTES = [...AE.map((v) => ({ ...v, status: 'Bordereau d’envoi envoyé au vendeur', tus: 'needs_action' })), ...EN, ...FI];
async function pdfInvente(code, forme) {
  const { PDFDocument, StandardFonts } = require(path.join(NM, 'pdf-lib'));
  const d = await PDFDocument.create();
  const p = forme === 'mr' ? d.addPage([283.46, 425.2]) : d.addPage([595.28, 841.89]);
  const f = await d.embedFont(StandardFonts.Helvetica);
  p.drawText((forme === 'mr' ? 'MONDIAL RELAY' : 'CHRONOPOST') + ' ETIQUETTE ' + code, { x: 20, y: p.getHeight() - 30, size: 10, font: f });
  return Buffer.from(await d.save()).toString('base64');
}
async function lignes() {
  return [
    { id: 'main', data: { vinted_used_numeros: TOUTES.map((v) => Number(v.num)),
      vinted_sale_overrides: Object.fromEntries(TOUTES.map((v) => [String(v.tx), { numero: v.num, ...(v.achat ? { buyPrice: v.achat } : {}) }])),
      vinted_annonce_numeros: Object.fromEntries(TOUTES.map((v) => [`i${v.tx}`, { numero: v.num, title: v.titre, auto: false, numberedAt: ilYa(30) }])) } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: TOUTES.map((v, i) => ({ transaction_id: v.tx, title: v.titre, price: { amount: String(60 + i * 5), currency_code: 'EUR' }, status: v.status, transaction_user_status: v.tus, date: ilYa(2 + i) })) } } },
    { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [
      { transaction_id: 7101, title: 'Golf Adidas Samba OG 43', price: { amount: '55.0', currency_code: 'EUR' }, status: 'Le vendeur prépare le colis', transaction_user_status: 'waiting', date: ilYa(5) },
      { transaction_id: 7102, title: 'Hotel Converse Chuck 70 41', price: { amount: '35.0', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYa(12) },
    ] } } },
    ...TOUTES.map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: iso(MS - H), payload: { transaction: { id: v.tx, item_id: `i${v.tx}` } } } })),
    ...await Promise.all(AE.map(async (v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: v.titre, article: v.titre, receivedAt: ilYa(1), pdfB64: await pdfInvente(String(v.tx), v.forme), suivi: v.suivi } }))),
    { id: 'harvest_111_suivi_7101', data: { tx: '7101', suivi: 'XW300000009TS', transporteur: 'Chronopost', capturedAt: iso(MS - 2 * H), dernier: { t: 'Colis en transit', at: ilYa(1) } } },
  ];
}
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = iso(MS); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
async function ouvrir(b, vp, LIGNES, { tab, sombre }) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // (pas d'horloge figée : les dates sont relatives à maintenant)
  const m = LIGNES[0].data;
  await pg.addInitScript(({ m, sombre }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true));
      localStorage.setItem('vinted_dark', JSON.stringify(!!sombre));
      localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros));
      localStorage.setItem('vinted_sale_overrides', JSON.stringify(m.vinted_sale_overrides));
    } catch (_) {}
  }, { m, sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const h = { 'access-control-allow-origin': '*' };
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(MS), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tel };
}
// La page défile dans un conteneur : une capture de l'écran en haut, une autre sur la liste des ventes.
const shot = async (pg, nom, sel) => {
  if (!SHOTS) return;
  if (sel) await pg.evaluate((s) => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: 'start' }); }, sel);
  await pg.waitForTimeout(250);
  await pg.screenshot({ path: path.join(SHOTS, nom + '.png') });
  if (sel) await pg.evaluate(() => { const e = document.querySelector('.vrm-main'); if (e) e.scrollIntoView({ block: 'start' }); window.scrollTo(0, 0); });
};
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : Z aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : Z l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
};
// Mesures communes (dans la page) : boutons bleus pleins visibles, largeur des boutons, etc.
const MESURE = () => {
  const vis = (e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && !e.closest('[hidden],[inert],.vrm-ledger-drawer-host'); };
  const rgb = (s) => (/rgba?\(([^)]+)\)/.exec(s || '') || [, ''])[1].split(',').map((x) => parseFloat(x));
  // Une couleur « accent » : un bleu saturé (b fort, r faible) et opaque.
  const bleu = (s) => { const [r, g, b, a = 1] = rgb(s); return a > 0.6 && b > 180 && r < 60 && g > 80 && g < 170; };
  const main = document.querySelector('.vrm-main') || document.body;
  const btns = [...main.querySelectorAll('button, a[href], [role=button]')].filter(vis);
  const pleins = btns.filter((e) => bleu(getComputedStyle(e).backgroundColor));
  const liste = document.querySelector('.vrm-ventes-liste, [data-colis-section]') || main;
  const lw = liste.getBoundingClientRect().width;
  const carte = (s) => { const [r, g, b, a = 1] = rgb(s); return a > 0.95 && ((r > 245 && g > 245 && b > 245) || (r < 40 && g < 40 && b < 40)); };
  const rempli = (e) => { const [, , , a = 1] = rgb(getComputedStyle(e).backgroundColor); const bg = getComputedStyle(e).backgroundColor; return /rgba?\(/.test(bg) && !(rgb(bg).length === 4 && a === 0) && !carte(bg); };
  const larges = btns.filter((e) => rempli(e) && e.getBoundingClientRect().width > Math.max(360, lw * 0.5)).map((e) => (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 40) + ':' + Math.round(e.getBoundingClientRect().width));
  return { pleins: pleins.map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30)), larges, lw: Math.round(lw) };
};
(async () => {
  let b;
  try {
    srv.listen(PORT);
    const LIGNES = await lignes();
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const seul = process.env.BANC_SEUL ? process.env.BANC_SEUL.split(',') : ['390', '1512'];
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }].filter((v) => seul.includes(String(v.width)))) {
      for (const sombre of [false, true]) {
        const k = `${vp.width}-${sombre ? 'sombre' : 'clair'}`;
        console.log(`── ${k}`);
        const tel = vp.width < 600;
        { const { ctx, pg, errs } = await ouvrir(b, vp, LIGNES, { tab: 'ventes', sombre });
          await essaie('Ventes', async () => {
            // « Tous les sites » d'abord (l'écran tel qu'il s'ouvre), puis le filtre Vinted (la liste des ventes).
            await pg.waitForFunction(() => { const e = document.querySelector('[data-colis-section="ventes"]'); return e && e.getBoundingClientRect().height > 0 && !document.getElementById('vrm-demarrage'); }, null, { timeout: 40000 }).catch(() => {});
            await pg.waitForTimeout(2500);
            await shot(pg, `ventes-achats-visuel-tous-${k}`);
            await shot(pg, `ventes-achats-visuel-tous-liste-${k}`, '[data-colis-section="ventes"] ~ *');
            const MT = await pg.evaluate(MESURE);
            dit(MT.pleins.length <= 1, `${k} Ventes (Tous) : B au plus UN bouton bleu plein sur l'écran`, JSON.stringify(MT.pleins));
            if (!tel) dit(MT.larges.length === 0, `${k} Ventes (Tous) : W aucun bouton plus large que la moitié de la liste (${MT.lw} px)`, JSON.stringify(MT.larges));
            await pg.click('[data-filtre-site] button[data-site="vinted"]').catch(() => {});
            await pg.waitForFunction(() => document.querySelectorAll('[data-fu-imprimer]').length >= 3 && [...document.querySelectorAll('.vrm-sale-row[data-tx]')].filter((e) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden').length >= 6, null, { timeout: 40000 }).catch(() => {});
            await pg.waitForTimeout(1500);
            const nb = await pg.evaluate(() => ({ imp: document.querySelectorAll('[data-fu-imprimer]').length, lignes: document.querySelectorAll('.vrm-sale-row[data-tx]').length }));
            dit(nb.imp >= 3 && nb.lignes >= 6, `${k} Ventes : les 3 bordereaux et les 6 ventes sont à l'écran`, JSON.stringify(nb));
            await shot(pg, `ventes-achats-visuel-ventes-${k}`);
            await shot(pg, `ventes-achats-visuel-liste-${k}`, '.vrm-sale-row[data-tx]');
            const M = await pg.evaluate(MESURE);
            dit(M.pleins.length <= 1, `${k} Ventes : B au plus UN bouton bleu plein sur l'écran`, JSON.stringify(M.pleins));
            if (!tel) dit(M.larges.length === 0, `${k} Ventes : W aucun bouton plus large que la moitié de la liste (${M.lw} px)`, JSON.stringify(M.larges));
            const R = await pg.evaluate((tel) => {
              const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
              const rows = [...document.querySelectorAll('.vrm-sale-row[data-tx]')].filter(vis);
              const haut = rows.map((r) => Math.round(r.getBoundingClientRect().height));
              const imp = [...document.querySelectorAll('[data-fu-imprimer]')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), bg: getComputedStyle(e).backgroundColor }; });
              const frises = [...document.querySelectorAll('.vrm-sale-row [data-fu-frise]')].filter(vis).map((f) => {
                const segs = [...f.querySelectorAll('[data-fu-etape]')];
                const mots = segs.filter((s) => { const sp = s.querySelector(':scope > span'); if (!sp) return false; const r = sp.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(sp).visibility !== 'hidden' && +getComputedStyle(sp).opacity > 0.05; }).length;
                const traits = segs.map((s) => { const i = s.querySelector('i'); return i ? Math.round(i.getBoundingClientRect().height * 10) / 10 : 0; });
                const couleurs = segs.map((s) => ({ c: s.getAttribute('data-fu-etape'), fait: s.getAttribute('data-fait'), cours: s.hasAttribute('data-cours'), der: s.hasAttribute('data-derniere'), ton: s.getAttribute('data-ton') || '', bg: getComputedStyle(s.querySelector('i') || s).backgroundColor }));
                return { mots, traits, couleurs, h: Math.round(f.getBoundingClientRect().height) };
              });
              const saisir = rows.filter((r) => /à saisir/i.test(r.querySelector('.vrm-ledger-sale-toggle') ? [...r.children].filter((c) => !c.matches('.vrm-ledger-drawer-host')).map((c) => c.innerText).join(' ') : r.innerText)).length;
              const invite = document.querySelector('[data-ventes-achats]'); const nInvites = document.querySelectorAll('[data-ventes-achats]').length;
              const petites = tel ? rows.flatMap((r) => [...r.querySelectorAll('button, a[href]')].filter(vis).filter((e) => !e.closest('.vrm-ledger-drawer-host')).map((e) => ({ t: (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height) })).filter((x) => x.h < 44)) : [];
              const groupes = [...document.querySelectorAll('[data-groupe-transporteur]')].filter(vis).map((g) => { const im = g.querySelector('svg, img'); return { h: Math.round(g.getBoundingClientRect().height), logo: im ? Math.round(im.getBoundingClientRect().height) : 0 }; });
              return { nInvites, haut, imp, frises, saisir, invite: invite ? { n: invite.getAttribute('data-ventes-achats'), t: invite.innerText.trim().slice(0, 80) } : null, petites, groupes };
            }, tel);
            const maxH = tel ? 190 : 96;
            dit(R.haut.length >= 6 && Math.max(...R.haut) <= maxH, `${k} Ventes : H chaque carte de vente ≤ ${maxH} px`, R.haut.join(','));
            dit(R.imp.length >= 3 && R.imp.every((x) => x.w <= (tel ? 200 : 160) && x.h <= (tel ? 48 : 40)), `${k} Ventes : B « Imprimer » de la ligne est une petite action (≤ ${tel ? 200 : 160} px de large)`, JSON.stringify(R.imp));
            dit(R.frises.length >= 4 && R.frises.every((f) => f.mots === 1), `${k} Ventes : F UN seul mot visible par frise (l'étape actuelle)`, JSON.stringify(R.frises.map((f) => f.mots)));
            dit(R.frises.length >= 4 && R.frises.every((f) => f.traits.every((t) => t > 0 && t <= 4)), `${k} Ventes : F barre fine (≤ 4 px)`, JSON.stringify(R.frises.map((f) => f.traits)));
            const bleuS = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return false; const [r, g, b2, a = 1] = m[1].split(',').map(parseFloat); return a > 0.6 && b2 > 180 && r < 60 && g > 80 && g < 170; };
            const ambreS = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return false; const [r, g, b2, a = 1] = m[1].split(',').map(parseFloat); return a > 0.6 && r > 200 && g > 100 && g < 200 && b2 < 90; };
            const bleusHorsActuelle = R.frises.flatMap((f) => f.couleurs.filter((c) => bleuS(c.bg) && !c.der && !c.cours).map((c) => c.c));
            dit(R.frises.length >= 4 && bleusHorsActuelle.length === 0, `${k} Ventes : F le bleu seulement sur l'étape actuelle (passées neutres)`, JSON.stringify(bleusHorsActuelle));
            const ambresSansGeste = R.frises.flatMap((f) => f.couleurs.filter((c) => ambreS(c.bg) && c.ton !== 'urgent').map((c) => c.c));
            dit(ambresSansGeste.length === 0, `${k} Ventes : F l'ambre seulement si un geste est dû`, JSON.stringify(ambresSansGeste));
            dit(R.saisir === 0, `${k} Ventes : S « à saisir » n'est écrit sur aucune ligne`, String(R.saisir));
            dit(R.invite && /^\d+\/\d+$/.test(R.invite.n) && R.nInvites === 1, `${k} Ventes : S une seule invitation groupée en tête (prix d'achat à saisir)`, JSON.stringify(R.invite));
            if (tel) dit(R.petites.length === 0, `${k} Ventes : T toutes les cibles de la ligne ≥ 44 px`, JSON.stringify(R.petites.slice(0, 6)));
            dit(R.groupes.every((g) => g.h <= 40 && g.logo <= 22), `${k} Ventes : E en-tête de groupe transporteur sobre (logo ≤ 22 px, ≤ 40 px)`, JSON.stringify(R.groupes));
            await sain(pg, `${k} Ventes`);
            // Envoyés : la ligne de suivi (lot suivi-commandes) reste là.
            await pg.click('[data-colis-onglet-choix="envoyes"]').catch(() => {});
            await pg.waitForTimeout(1200);
            await shot(pg, `ventes-achats-visuel-envoyes-${k}`);
            const M2 = await pg.evaluate(MESURE);
            dit(M2.pleins.length <= 1, `${k} Ventes · Envoyés : B au plus UN bouton bleu plein`, JSON.stringify(M2.pleins));
            if (!tel) dit(M2.larges.length === 0, `${k} Ventes · Envoyés : W aucun bouton pleine largeur`, JSON.stringify(M2.larges));
          });
          dit(errs.length === 0, `${k} Ventes : Z aucune erreur de page`, errs.join(' | ').slice(0, 200));
          await ctx.close(); }
        { const { ctx, pg, errs } = await ouvrir(b, vp, LIGNES, { tab: 'achats', sombre });
          await essaie('Achats', async () => {
            await pg.waitForFunction(() => /Golf Adidas Samba/.test(document.body.innerText), null, { timeout: 40000 }).catch(() => {});
            await pg.waitForTimeout(1500);
            await shot(pg, `ventes-achats-visuel-achats-${k}`);
            await shot(pg, `ventes-achats-visuel-achats-liste-${k}`, '[data-colis-section="achats"] ~ *, .vrm-achats-liste, [data-achat-tx]');
            const M = await pg.evaluate(MESURE);
            dit(M.pleins.length <= 1, `${k} Achats : A au plus UN bouton bleu plein`, JSON.stringify(M.pleins));
            if (!tel) dit(M.larges.length === 0, `${k} Achats : W aucun bouton pleine largeur`, JSON.stringify(M.larges));
            await sain(pg, `${k} Achats`);
          });
          dit(errs.length === 0, `${k} Achats : Z aucune erreur de page`, errs.join(' | ').slice(0, 200));
          await ctx.close(); }
      }
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\nKO ventes-achats-visuel : ${ko} contrôle(s) non conforme(s), ${ok} conforme(s)` : `\nOK ventes-achats-visuel : ${ok} conformes`);
    process.exit(ko ? 1 : 0);
  }
})();
