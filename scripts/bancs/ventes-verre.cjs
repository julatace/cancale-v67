// ════════════════════════════════════════════════════════════════════════════
//  BANC « VENTES · VERRE DÉPOLI » (15 nov.) — les maquettes validées par Julien (« tout est parfait »)
//  Données INVENTÉES (dépôt public) : le « monde » des maquettes — deux comptes (shop_nord, kicks_sud), trois
//  colis à envoyer (N°103, 110, 119, bordereaux reçus), une étagère « Étagère A » (3 × 5) où ils sont rangés,
//  trois colis partis (en transit, livré, finalisé). Horloge figée (dim. 15 nov. 14 h 15). 390 tactile et 1512,
//  clair et sombre. Jugé sur data-*, styles calculés et nombres rendus (§6.4), jamais sur un libellé.
//   S  le segment À expédier · En route · Toutes, en verre fumé, « À expédier » posé, ses nombres ;
//   H  le grand chiffre = la publication « à envoyer » (`vrm_colis_aposter`), posé sur le fond (encre claire) ;
//   K  chaque colis porte SA case, COCHÉE d'office (la règle du lot) — NOUVEAU ;
//   E  chaque colis rangé dit SA place, lue du Stock par son N° (« Étagère A · r1 c3 ») — NOUVEAU ;
//   P  un seul plein, en barre sous la liste, « Imprimer les N » = les cochés ; décocher ⇒ N − 1 ;
//   L  la 1re rangée sur le premier écran (≤ 50 % de 844) ; rien ne déborde ; AA sur le fond réel ;
//   R  « En route » : chaque colis parti, ses quatre étapes cochées sur PREUVE seulement ;
//   T  « Toutes » replie les colis, garde le segment et montre la liste des ventes ;
//   O  1512 : le tableau (en-têtes, colonnes « où dans le stock » par identité) ;
//   F  la fiche d'une vente : Vendu · Pour toi, les étapes jusqu'au versement, la place et « Je l'ai sortie ».
// Lancer : construire dist/, puis node scripts/bancs/ventes-verre.cjs   (BANC_PORT, SHOTS=dossier, BANC_SEUL=390c,1512s…,
//          BANC_URL=http://127.0.0.1:5191 pour viser un serveur de développement au lieu de dist/)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 9181);
const BASE = process.env.BANC_URL || `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || '';
const SEUL = process.env.BANC_SEUL ? process.env.BANC_SEUL.split(',') : null;
const maintenant = new Date(2026, 10, 15, 14, 15, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'shop_nord', domain: 'www.vinted.fr', updated_at: iso(MS) },
  { id: 2, vinted_user_id: '222', login: 'kicks_sud', domain: 'www.vinted.fr', updated_at: iso(MS) },
];
const PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#e8eef5"/><path d="M10 52 Q30 30 50 44 L72 46 L72 58 L10 58Z" fill="#c62828"/></svg>');
// tx, titre, compte, N°, prix, âge (j), suivi (sa forme dit le transporteur), limite lue (jj/mm/aaaa à hh:mm), taille, acheteur
const V = [
  { tx: 9103, titre: 'Nike Cortez', uid: '111', num: '103', prix: '60.0', age: 2, suivi: 'XW103456789TS', limite: '17/11/2026 à 12:00', taille: '38', ach: 'paul_r' },
  { tx: 9110, titre: 'Nike Cortez', uid: '222', num: '110', prix: '65.0', age: 1, suivi: '41103456', limite: '18/11/2026 à 12:00', taille: '41', ach: 'lea.b' },
  // (16 nov., relier-fiable) la vente écrit sa couleur : l'achat n'est proposé que « très probable » (taille ET couleur).
  { tx: 9119, titre: 'Nike Terminator Low rose', uid: '111', num: '119', prix: '110.0', age: 0.2, suivi: '42119456', limite: '19/11/2026 à 12:00', taille: '36', ach: 'nina.k' },
];
const PARTIS = [
  { tx: 9146, titre: 'Adidas Samba OG', uid: '111', num: '146', prix: '80.0', age: 4, status: 'Colis en transit', tus: 'waiting' },
  { tx: 9172, titre: 'Nike Air Max 90', uid: '222', num: '172', prix: '85.0', age: 6, status: 'Colis livré', tus: 'waiting' },
  { tx: 9181, titre: 'New Balance 574', uid: '111', num: '181', prix: '70.0', age: 9, status: 'Commande finalisée', tus: 'completed' },
];
const ATTENDU_OU = { 103: 'Étagère A|1|3', 110: 'Étagère A|3|2', 119: 'Étagère A|5|3' };
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const MEUBLES = [{ id: 'mA', name: 'Étagère A', cols: 3, rows: 5 }];
const SLOTS = { 103: { m: 'mA', i: 2 }, 110: { m: 'mA', i: 7 }, 119: { m: 'mA', i: 14 } };
const commande = (v, partie) => ({ transaction_id: v.tx, title: v.titre, price: { amount: v.prix, currency_code: 'EUR' }, status: partie ? v.status : 'Le paiement a été validé',
  transaction_user_status: partie ? v.tus : 'needs_action', date: ilYa(v.age), size_title: v.taille || undefined, user_login: v.ach || 'acheteur_x', photo: { url: PHOTO } });
const lignes = (sombre) => [
  { id: 'main', data: { vinted_dark: sombre, vinted_used_numeros: [...V, ...PARTIS].map((v) => Number(v.num)), vrm_meubles: MEUBLES, vrm_slots: SLOTS,
    vinted_annonce_numeros: Object.fromEntries([...V, ...PARTIS].map((v) => [`i${v.tx}`, { numero: v.num, title: v.titre, auto: false, numberedAt: ilYa(30), ...(v.taille ? { size: v.taille } : {}) }])) } },
  ...['111', '222'].map((u) => ({ id: `harvest_${u}_orders_sold`, data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [
    ...V.filter((v) => v.uid === u).map((v) => commande(v, false)), ...PARTIS.filter((v) => v.uid === u).map((v) => commande(v, true)) ] } } })),
  // Un achat INVENTÉ qui ressemble à la vente N°119 (même marque, mots du modèle, taille, acheté avant la mise en ligne) :
  // la règle de liaison (src/liaisonAchat.js) le PROPOSE sur la fiche de la vente ; rien n'est relié sans son toucher.
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [{ transaction_id: 7001, title: 'Nike Terminator Low rose 36', price: { amount: '70.0', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: ilYa(40), photo: { url: PHOTO } }] } } },
  { id: 'harvest_222_orders_purchased', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [] } } },
  ...[...V, ...PARTIS].map((v) => ({ id: `harvest_${v.uid}_txn_${v.tx}`, data: { capturedAt: ilYa(0.1), payload: { transaction: { id: v.tx, item_id: `i${v.tx}`, ...(v.tus === 'completed' ? { status: 450 } : {}) } } } })),
  ...V.map((v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: v.uid, filename: `bordereau-${v.tx}.pdf`, modele: v.titre, article: v.titre, receivedAt: ilYa(Math.max(0.1, v.age - 0.1)), pdfB64: PDF_B64, suivi: v.suivi, dateLimite: v.limite } })),
  { id: 'email_track_mondialrelay_81000001', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '81000001', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis 81000001 est disponible dans votre Point Relais', receivedAt: ilYa(0.3), emailAt: ilYa(0.3), arriveLe: ilYa(0.3), code: 'K48291', lieu: 'TABAC DE LA GARE, 12 RUE EXEMPLE, 35000 RENNES', limite: '2026-11-19', consigne: false, account: 'shop_nord', recuSur: ['boite@exemple.fr'] } },
  { id: 'panel_colis_relais', data: {} },
];
let ko = 0, ok = 0;
const rouges = [];
const dit = (c, m, d) => { if (c) ok++; else { ko++; rouges.push(m); } console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
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

async function ouvrir(b, vp, sombre, ou = '?tab=ventes') {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const LIGNES = lignes(sombre);
  const mainData = LIGNES[0].data;
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ s, m }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.setItem('vinted_dark', JSON.stringify(s));
      if (!sessionStorage.getItem('banc_init')) {
        sessionStorage.setItem('banc_init', '1');
        for (const k of ['vinted_annonce_numeros', 'vinted_used_numeros', 'vrm_meubles', 'vrm_slots']) localStorage.setItem(k, JSON.stringify(m[k]));
      }
    } catch (_) {}
  }, { s: sombre, m: mainData });
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
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z]+)=(not\.)?is\.null/g)].map((m) => ({ k: m[1], non: !!m[2] }));
    const passe = (r) => filtres.every((f) => (f.non ? r.data[f.k] != null : r.data[f.k] == null));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id) && passe(r)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`${BASE}/${ou}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card][data-tx-colis]').length >= 3, null, { timeout: 45000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  return { ctx, pg, errs, tel };
}
const shot = async (pg, nom, plein = false) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein }); };
const enHaut = (pg) => pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });

// Le contraste AA d'un texte : sa couleur contre le premier fond opaque de ses ancêtres, sinon contre le pire point du dégradé.
const contrastes = (pg, sels, sombre) => pg.evaluate(({ sels, sombre }) => {
  const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const melange = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const css = getComputedStyle(document.documentElement);
  const hex = (v) => { const m = /#([0-9a-f]{6})/i.exec(v || ''); if (!m) return null; const n = parseInt(m[1], 16); return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 }; };
  // le pire point du fond : le haut (clair) pour un texte clair, le bas (sombre) pour un texte sombre posé sur du verre
  const haut = hex(css.getPropertyValue('--sv-haut')) || { r: 0x25, g: 0x63, b: 0xA8, a: 1 }, bas = hex(css.getPropertyValue('--sv-bas')) || { r: 0x0E, g: 0x2C, b: 0x52, a: 1 };
  const out = [];
  for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
    if (!el.offsetParent || !(el.textContent || '').trim()) continue;
    const c = rgb(getComputedStyle(el).color); if (!c) continue;
    const pile = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const k = rgb(getComputedStyle(e).backgroundColor); if (k && k.a > 0) { pile.push(k); if (k.a >= 0.99) break; } }
    const clair = lum(c) > 0.5;
    // Un texte SOMBRE sans aucun fond peint (le verre se peint en dégradé, pas en couleur) est posé sur le VERRE : .80 sur le bas.
    const verre = sombre ? { r: 16, g: 30, b: 50, a: .62 } : { r: 247, g: 250, b: 253, a: .80 };
    const fonds = pile.length && pile[pile.length - 1].a >= 0.99 ? [pile.pop()] : (!clair && !pile.length ? [melange(verre, bas)] : [haut, bas]);
    let pireR = 99;
    for (const f0 of fonds) { let f = f0; for (const k of [...pile].reverse()) f = melange(k, f); const t = melange(c, f); const L1 = lum(t), L2 = lum(f); pireR = Math.min(pireR, (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)); }
    out.push({ sel, t: (el.textContent || '').trim().slice(0, 24), r: Math.round(pireR * 100) / 100, clair });
  }
  return out;
}, { sels, sombre });

async function scenario(b, vp, sombre) {
  const nom = `${vp.width}${sombre ? '-sombre' : '-clair'}`;
  const { ctx, pg, errs, tel } = await ouvrir(b, vp, sombre);
  try {
    await pg.waitForSelector('[data-ventes-seg]', { timeout: 20000 }).catch(() => {});
    await enHaut(pg); await pg.waitForTimeout(500);
    await shot(pg, `ventes-verre-${nom}-expedier`);
    if (process.env.BANC_SONDE) console.log(await pg.evaluate((sel) => { const racine = document.querySelector(sel.split('@')[0]) ; if (!racine) return 'pas de racine';
      return [...racine.querySelectorAll(sel.split('@')[1])].map((x) => { const s = getComputedStyle(x); const q = x.getBoundingClientRect(); return `${x.tagName}.${String(x.className).slice(0, 50)} [${[...x.attributes].map((a) => a.name).filter((n) => n.startsWith('data-')).slice(0, 3).join(',')}] d=${s.display} w=${Math.round(q.width)} x=${Math.round(q.left)} y=${Math.round(q.top)} pl=${s.paddingLeft} jc=${s.justifyContent} fl=${s.flex} mw=${s.minWidth} wcss=${s.width}`; }).join('\n'); }, process.env.BANC_SONDE));
    if (false) console.log(await pg.evaluate((sel) => { const c = document.querySelector('[data-bord-card][data-tx-colis="9110"]'); if (!c) return 'pas de carte';
      return [...c.querySelectorAll(sel)].map((x) => { const s = getComputedStyle(x); const q = x.getBoundingClientRect(); return `${x.tagName}.${String(x.className).slice(0, 50)} d=${s.display} fd=${s.flexDirection} fw=${s.flexWrap} w=${Math.round(q.width)} h=${Math.round(q.height)} x=${Math.round(q.left)} y=${Math.round(q.top)}`; }).join('\n'); }, process.env.BANC_SONDE));
    // ── S : le segment
    const seg = await pg.evaluate(() => { const s = document.querySelector('[data-ventes-seg]'); if (!s) return null; const cs = getComputedStyle(s);
      return { v: s.getAttribute('data-ventes-seg'), choix: [...s.querySelectorAll('[data-ventes-seg-choix]')].map((x) => ({ v: x.getAttribute('data-ventes-seg-choix'), p: x.getAttribute('aria-pressed'), h: Math.round(x.getBoundingClientRect().height), n: (x.querySelector('.vv-seg-n') || {}).textContent || '' })), flou: cs.backdropFilter || cs.webkitBackdropFilter || '' }; });
    dit(!!seg && seg.v === 'envoyer' && seg.choix.map((c) => c.v).join() === 'envoyer,envoyes,toutes' && seg.choix[0].p === 'true' && seg.choix.every((c) => c.h >= 44), `${nom} : S le segment À expédier · En route · Toutes, « À expédier » posé, 44 px`, JSON.stringify(seg));
    dit(!!seg && seg.choix[0].n === '3' && seg.choix[1].n === '2', `${nom} : S les nombres du segment (3 à expédier, 2 en route : la vente finalisée n'est plus en route)`, JSON.stringify(seg && seg.choix.map((c) => c.n)));
    // ── H : le grand chiffre = la publication, en encre claire sur le fond
    const h = await pg.evaluate(() => { const t = document.querySelector('[data-sb-tete="ventes"]'); if (!t) return null; const ch = t.querySelector('[data-sb-chiffre]'); const a = t.querySelector('.sb-chiffre-affiche');
      const pub = (() => { try { return JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); } catch (_) { return null; } })();
      return { n: ch.getAttribute('data-sb-chiffre'), aff: a.textContent, pub: pub && pub.total, fs: parseFloat(getComputedStyle(a).fontSize), coul: getComputedStyle(a).color, haut: Math.round(t.getBoundingClientRect().top) }; });
    dit(!!h && h.n === '3' && h.aff === '3' && String(h.pub) === '3' && h.fs >= 48, `${nom} : H le grand chiffre = la publication « à envoyer » (3), en affiche`, JSON.stringify(h));
    // ── K + E : la case de chaque colis (cochée d'office), la place lue du Stock par le N°
    const rang = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].filter((c) => c.offsetParent).map((c) => {
      const k = c.querySelector('[data-vv-coche]'); const i = k && k.querySelector('input'); const ou = c.querySelector('[data-vv-ou]'); const q = c.getBoundingClientRect();
      return { tx: c.getAttribute('data-tx-colis'), num: c.getAttribute('data-colis-num'), coche: !!(i && i.checked), on: k ? k.getAttribute('data-vv-coche-on') : null, ou: ou ? ou.getAttribute('data-vv-ou') : null, ouVu: ou ? ou.offsetParent !== null && ou.getBoundingClientRect().width > 0 : false, top: Math.round(q.top), h: Math.round(q.height),
        cible: k ? Math.round(Math.max(k.getBoundingClientRect().width + 20, 0)) : 0 }; }));
    dit(rang.length === 3 && rang.every((r) => r.coche && r.on === '1'), `${nom} : K chaque colis porte sa case, COCHÉE d'office`, JSON.stringify(rang.map((r) => `${r.num}:${r.coche ? 'x' : 'o'}`)));
    dit(rang.length === 3 && rang.every((r) => r.ou === ATTENDU_OU[r.num] && (tel ? r.ouVu : true)), `${nom} : E chaque colis dit SA place dans le Stock, lue par son N°`, JSON.stringify(rang.map((r) => `${r.num}:${r.ou}`)));
    if (tel) dit(rang.length > 0 && Math.min(...rang.map((r) => r.top)) <= 844 * 0.5, `${nom} : L la 1re rangée sur le premier écran (≤ 50 %)`, JSON.stringify(rang.map((r) => r.top)));
    // ── P : un seul plein, en barre sous la liste, = les cochés ; décocher ⇒ N − 1
    const plein = () => pg.evaluate(() => { const ps = [...document.querySelectorAll('.sb-btn-plein, .vrm-b-primaire, [data-variante="primaire"]')].filter((x) => x.offsetParent && x.getBoundingClientRect().width > 0 && !x.closest('[role="dialog"], .vrm-fs, .vrm-fp'));
      const l = document.querySelector('.vv-liste'); const p = ps[0]; const q = p ? p.getBoundingClientRect() : null; const ql = l ? l.getBoundingClientRect() : null;
      return { n: ps.length, k: p ? p.getAttribute('data-colis-barre-btn') : '', prets: p ? p.getAttribute('data-imprimer-prets') : '', w: q ? Math.round(q.width) : 0, h: q ? Math.round(q.height) : 0, sous: q && ql ? q.top >= ql.bottom - 1 : false, lw: ql ? Math.round(ql.width) : 0 }; });
    const p0 = await plein();
    dit(p0.n === 1 && p0.k === 'imprimer' && p0.prets === '3' && p0.sous && p0.h >= 48 && (tel ? p0.w >= p0.lw - 2 : p0.w >= 300), `${nom} : P un seul plein, en barre SOUS la liste, « Imprimer les 3 »`, JSON.stringify(p0));
    await pg.locator('[data-vv-coche="9110"] input').click({ force: true }).catch(() => {});
    await pg.waitForTimeout(400);
    const p1 = await plein();
    const k1 = await pg.evaluate(() => { const i = document.querySelector('[data-vv-coche="9110"] input'); return { coche: !!(i && i.checked), fiche: !!document.querySelector('.vrm-fp-depuis-ligne') }; });
    dit(p1.prets === '2' && !k1.coche && !k1.fiche, `${nom} : P décocher un colis ⇒ « Imprimer les 2 », sans ouvrir sa fiche`, JSON.stringify({ p1: p1.prets, k1 }));
    await pg.locator('[data-vv-coche="9110"] input').click({ force: true }).catch(() => {});
    await pg.waitForTimeout(300);
    // ── L : rien ne déborde ; AA
    const deb = await pg.evaluate(() => { const vw = document.documentElement.clientWidth; const hors = [...document.querySelectorAll('.vrm-tache[data-tache="ventes"] *')].filter((x) => { if (!x.offsetParent || x.closest('.sb-tuiles-filtres, .vrm-rangee, [data-rangee-defile], .vrm-seg')) return false; const q = x.getBoundingClientRect(); return q.width > 0 && (q.right > vw + 1 || q.left < -1); }).map((x) => String(x.className || x.tagName).slice(0, 40));
      return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, hors: hors.slice(0, 5), n: hors.length }; });
    dit(deb.page <= 1 && deb.n === 0, `${nom} : L rien ne déborde`, JSON.stringify(deb));
    const aa = await contrastes(pg, ['.vv-seg-l', '.vv-hero .sb-chiffre-affiche', '.vv-hero .sb-tete-lib', '.vv-hero-sous', '.vv-liste .vrm-colis-titre', '.vv-cpt', '.vv-l3 .sb-echeance', '.vv-ou span', '.vv-end .vrm-colis-prix', '.vv-tr', '.vv-format-l', '.vv-format-v', '.vv-plein .sb-btn-plein-mot', '.vv-choisir', '.vv-col b', '.vv-col span'], sombre);
    const faibles = aa.filter((x) => x.r < 4.5);
    dit(aa.length >= 10 && !faibles.length, `${nom} : L contraste AA (≥ 4,5:1) sur le fond réel — ${aa.length} textes`, JSON.stringify(faibles.slice(0, 6)));
    // ── O : 1512, le tableau
    if (!tel) {
      const t = await pg.evaluate(() => { const e = document.querySelector('.vv-tab-tete'); const c = [...document.querySelectorAll('[data-bord-card][data-tx-colis] [data-vv-col="ou"]')].filter((x) => x.getBoundingClientRect().width > 0).map((x) => x.innerText.replace(/\s+/g, ' ').trim());
        return { tete: !!(e && e.getBoundingClientRect().height > 0), cols: e ? e.children.length : 0, ou: c }; });
      dit(t.tete && t.cols === 7 && t.ou.length === 3 && t.ou.every((x) => /Étagère A/.test(x)), `${nom} : O le tableau (en-têtes, « où dans le stock » par colis)`, JSON.stringify(t));
    }
    // ── F : la fiche d'une vente
    await pg.locator('[data-bord-card][data-tx-colis="9119"] .vrm-colis-titre').click().catch(() => {});
    await pg.waitForSelector('[data-vv-fiche-vente]', { timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(600);
    await shot(pg, `ventes-verre-${nom}-fiche`);
    const f = await pg.evaluate(() => { const z = document.querySelector('[data-vv-fiche-vente]'); if (!z) return null;
      return { etapes: [...z.querySelectorAll('[data-vv-fiche-etapes] [data-etape]')].map((x) => x.getAttribute('data-etape') + ':' + x.getAttribute('data-fait') + (x.classList.contains('is-geste') ? '!' : '')),
        vendu: (z.querySelector('[data-vv-vendu]') || {}).getAttribute ? z.querySelector('[data-vv-vendu]').getAttribute('data-vv-vendu') : '', ou: (z.querySelector('[data-vv-ou]') || { getAttribute: () => '' }).getAttribute('data-vv-ou'), sortir: !!z.querySelector('[data-vv-sortir]'),
        imprimer: !!document.querySelector('.vrm-fp-depuis-ligne [data-imprime="1"]') }; });
    dit(!!f && f.etapes.join() === 'vendue:1,bordereau:1,adeposer:0!,enroute:0,livree:0,versement:0' && !!f.vendu && f.ou === ATTENDU_OU[119] && f.sortir && f.imprimer, `${nom} : F la fiche : étapes jusqu'au versement (« À déposer » en geste), Vendu, la place, « Je l'ai sortie », imprimer`, JSON.stringify(f));
    await pg.keyboard.press('Escape').catch(() => {});
    await pg.waitForTimeout(500);
    // ── R : En route
    await pg.click('[data-ventes-seg-choix="envoyes"]').catch(() => {});
    await pg.waitForTimeout(900); await enHaut(pg); await pg.waitForTimeout(300);
    await shot(pg, `ventes-verre-${nom}-route`);
    const r = await pg.evaluate(() => [...document.querySelectorAll('[data-colis-envoye]')].filter((c) => c.offsetParent).map((c) => ({ id: c.getAttribute('data-colis-envoye'), et: [...c.querySelectorAll('[data-vv-etapes] [data-etape]')].map((x) => x.getAttribute('data-fait')).join('') })));
    const attendu = { 'v:9146': '1100', 'v:9172': '1110', 'v:9181': '1111' };
    dit(r.length === 2 && r.every((x) => attendu[x.id] === x.et), `${nom} : R chaque colis parti, ses quatre étapes cochées sur preuve`, JSON.stringify(r));
    // ── T : Toutes
    await pg.click('[data-ventes-seg-choix="toutes"]').catch(() => {});
    await pg.waitForTimeout(900); await enHaut(pg); await pg.waitForTimeout(300);
    await shot(pg, `ventes-verre-${nom}-toutes`);
    const t2 = await pg.evaluate(() => ({ seg: !!document.querySelector('[data-ventes-seg-choix="toutes"][aria-pressed="true"]'), colis: [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].filter((c) => c.getBoundingClientRect().height > 0).length }));
    dit(t2.seg && t2.colis === 0, `${nom} : T « Toutes » replie les colis, garde le segment`, JSON.stringify(t2));
    // ── V : la fiche d'une vente ouverte depuis « Toutes » (le récapitulatif) : le plein à l'ENCRE, aucun « à dater »,
    //       les dates des étapes jamais coupées au bord droit.
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=ventes&site=vinted' })));
    await pg.waitForFunction(() => [...document.querySelectorAll('[data-fu-ligne]')].some((x) => /Terminator/.test(x.innerText || '')), null, { timeout: 25000 }).catch(() => {});
    await pg.waitForTimeout(600);
    await pg.evaluate(() => { const l = [...document.querySelectorAll('[data-fu-ligne]')].find((x) => /Terminator/.test(x.innerText || '')); if (l) { l.scrollIntoView({ block: 'center' }); (l.querySelector('.vrm-ledger-sale-toggle') || l).click(); } });
    await pg.waitForSelector('[data-recap-vente] [data-recap-phrase]', { state: 'attached', timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(700);
    await shot(pg, `ventes-verre-${nom}-recap`);
    // (16 nov., intégration de la fiche D) la fiche de la vente s'ouvre en direction D : sa carte d'action propose l'achat ;
    // le récapitulatif de la ligne (la place « contexte ») vit derrière « ⋯ » → « Tout voir », jugé là, sur la même règle.
    await pg.evaluate(() => { const b = document.querySelector('.vrm-fp [data-fd-plus-ouvrir]'); if (b) b.click(); });
    await pg.waitForTimeout(300);
    await pg.evaluate(() => { const d = document.querySelector('.vrm-fp [data-fiche-plus]'); if (d) d.open = true; });
    await pg.waitForTimeout(500);
    if (SHOTS) { await pg.evaluate(() => { const x = document.querySelector('[data-recap-vente] .vrm-recap-argent'); if (x) x.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300); await shot(pg, `ventes-verre-${nom}-recap-argent`); await pg.evaluate(() => { const x = document.querySelector('[data-vv-achat-propose]'); if (x) x.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300); await shot(pg, `ventes-verre-${nom}-recap-relier`); }
    const rv = await pg.evaluate(() => { const z = [...document.querySelectorAll('[data-recap-vente]')].find((x) => x.getBoundingClientRect().height > 0); if (!z) return null;
      const p = [...z.querySelectorAll('.vrm-b-primaire, [data-variante="primaire"], .sb-btn-plein, [data-bouton-bord="pdf"]')].filter((x) => x.getBoundingClientRect().width > 0);
      const rgb = (s) => (/rgba?\(([^)]+)\)/.exec(s) || [, ''])[1].split(/[ ,/]+/).map(Number);
      const zr = z.getBoundingClientRect();
      const coupes = [...z.querySelectorAll('.vrm-frise *, [class*="frise"] *')].filter((x) => x.children.length === 0 && (x.textContent || '').trim() && x.getBoundingClientRect().width > 0 && (x.getBoundingClientRect().right > zr.right - 8 || x.scrollWidth > x.clientWidth + 1)).map((x) => x.textContent.trim().slice(0, 20));
      const pr = z.querySelector('[data-vv-achat-propose]');
      return { pleins: p.map((x) => { const c = rgb(getComputedStyle(x).backgroundColor); return c.slice(0, 3).join(','); }), aDater: /à dater/i.test(z.innerText), coupes,
        propose: pr ? pr.getAttribute('data-vv-achat-propose') : null, relier: !!z.querySelector('[data-vv-relier="7001"]'), autre: !!z.querySelector('[data-vv-autre-achat]'), saisir: !!z.querySelector('[data-cout-vente]'), unSeul: z.querySelectorAll('[data-vv-saisir-prix]').length === 0 }; });
    dit(!!rv && rv.pleins.length <= 1 && rv.pleins.every((c) => !/^0,96,204$|^0,74,159$/.test(c)) && !rv.aDater && !rv.coupes.length && rv.propose === '7001' && rv.relier && rv.autre && rv.saisir && rv.unSeul, `${nom} : V la fiche d'une vente : le plein à l'encre (jamais le bleu), l'achat PROPOSÉ et « Relier · prix », « Autre achat », « Saisir le prix » ; aucun « à dater », aucune date coupée`, JSON.stringify(rv));
    await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(400);
    // ── A : Achats · le code de retrait lisible, la feuille « Montre ce code au comptoir »
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' })));
    await pg.waitForSelector('[data-va-code-grand]', { timeout: 25000 }).catch(() => {});
    await pg.waitForTimeout(800); await enHaut(pg); await pg.waitForTimeout(300);
    await shot(pg, `ventes-verre-${nom}-achats`);
    const a = await pg.evaluate(() => { const c = document.querySelector('.vrm-rpf-code-gros[data-rp-code-visible]'); const l = document.querySelector('.va-code-lib');
      return { code: c ? c.getAttribute('data-rp-code-visible') : null, fs: c ? parseFloat(getComputedStyle(c).fontSize) : 0, lib: !!(l && l.offsetParent), rond: !!document.querySelector('[data-va-code-grand="K48291"]') }; });
    dit(a.code === 'K48291' && a.fs >= 26 && a.lib && a.rond, `${nom} : A le code de retrait lisible d'un coup d'œil, et son « en grand »`, JSON.stringify(a));
    if (!tel) {   // maquette ordinateur achats-1512 : les codes en colonne à gauche, un chiffre par case ; les achats à droite
      const o = await pg.evaluate(() => { const r = document.querySelector('.vrm-tache[data-tache="achats"] > .vrm-achats-retirer-repli'); const s = r && r.nextElementSibling;
        const cases = [...document.querySelectorAll('.vrm-rpf-code-gros[data-rp-code-visible="K48291"] .va-c')].map((x) => Math.round(x.getBoundingClientRect().height));
        const t = document.querySelector('.vrm-tache[data-tache="achats"] .vrm-rpf-titre'); return { cases, titreW: t ? Math.round(t.getBoundingClientRect().width) : 0, gauche: r ? Math.round(r.getBoundingClientRect().right) : null, droite: s ? Math.round(s.getBoundingClientRect().left) : null }; });
      dit(o.cases.length === 6 && o.cases.every((h) => h >= 56) && o.titreW >= 120 && o.gauche != null && o.droite != null && o.droite >= o.gauche, `${nom} : A ordinateur : les codes à gauche (un chiffre par case), les achats à droite`, JSON.stringify(o));
      if (process.env.BANC_SONDE2) console.log(await pg.evaluate(() => { const t = document.querySelector('.vrm-tache[data-tache="achats"] .vrm-rpf-titre'); const out = []; for (let x = t; x && !x.classList.contains('vrm-tache'); x = x.parentElement) { const s = getComputedStyle(x); out.push(x.tagName + '.' + String(x.className).slice(0, 40) + ' d=' + s.display + ' fd=' + s.flexDirection + ' fw=' + s.flexWrap + ' w=' + Math.round(x.getBoundingClientRect().width) + ' fl=' + s.flex + ' gtc=' + s.gridTemplateColumns.slice(0, 40)); } return out.join('\n'); }));
    }
    await pg.click('[data-va-code-grand="K48291"]').catch(() => {});
    await pg.waitForSelector('[data-va-comptoir]', { timeout: 6000 }).catch(() => {});
    await pg.waitForTimeout(400);
    await shot(pg, `ventes-verre-${nom}-comptoir`);
    const fc = await pg.evaluate(() => { const f = document.querySelector('[data-va-comptoir]'); if (!f) return null; const cases = [...f.querySelectorAll('.va-fc-code i')];
      return { code: f.getAttribute('data-va-comptoir'), cases: cases.map((x) => x.textContent).join(''), h: cases.length ? Math.round(cases[0].getBoundingClientRect().height) : 0, retire: !!f.querySelector('[data-va-retire]'), copier: !!f.querySelector('[data-va-copier]') }; });
    dit(!!fc && fc.cases === 'K48291' && fc.h >= 56 && fc.retire && fc.copier, `${nom} : A la feuille au comptoir : un chiffre par case, « Je l'ai retiré », copier`, JSON.stringify(fc));
    await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(300);
    dit(errs.length === 0, `${nom} : Z aucune erreur d'app`, errs.join(' | ').slice(0, 300));
  } catch (e) { dit(false, `${nom} : le scénario va au bout`, String(e.message || e).slice(0, 200)); }
  await ctx.close();
}

(async () => {
  let b;
  try {
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    if (!process.env.BANC_URL) await new Promise((r) => srv.listen(PORT, r));
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const sombre of [false, true]) {
      if (SEUL && !SEUL.includes(`${vp.width}${sombre ? 's' : 'c'}`)) continue;
      await scenario(b, vp, sombre);
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); try { srv.close(); } catch (_) {}
    console.log(ko ? `\n❌ ventes-verre : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ ventes-verre : ${ok} verts`);
    process.exit(ko ? 1 : 0);
  }
})();
