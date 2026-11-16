// ════════════════════════════════════════════════════════════════════════════
//  BANC « STUDIO BLEU CLAIR » — VENTES · À EXPÉDIER ET ACHATS · À RETIRER (14 nov.)
//  Décision de Julien : la direction t25 (bleu clair partout, quatre formes de bouton, un seul plein,
//  « tout doit être parfait, tu peux changer les dispositions », AUCUNE fonction ne disparaît).
//  Données INVENTÉES (dépôt public) : le jeu du banc colis-envoi (5 ventes à envoyer — 2 Chronopost,
//  2 Mondial Relay, 1 sans bordereau ; limite LUE demain 12 h ; une estimée dépassée ; 2 parties ; un
//  colis Mondial Relay à retirer, code 100001). Horloge figée (5 nov. 11 h). 390 tactile et 1512, clair et
//  sombre. Jugé sur data-*, styles calculés et nombres rendus (§6.4), jamais sur un libellé.
//   C  le grand chiffre = la publication « à envoyer » ; l'ambre « avant demain » = les limites d'aujourd'hui
//      et demain (jamais une estimée dépassée) ; c'est une affiche (≥ 80 px) ;
//   P  UN seul bouton plein à l'écran, « Imprimer N » (N = `resumeLot`), le rond d'encre 72/80 ;
//   R  au plus deux ronds en tête, nommés, 44 px ;
//   T  tuiles-filtres : la posée est ENFONCÉE + diode, la liste suit par identité, re-toucher rend tout ;
//   L  aucune rangée ne porte de bouton ; l'échéance courte à droite, ambre = « avant demain » ;
//   O  la rangée s'ouvre au premier plan avec SES gestes (imprimer ce bordereau, déposé, imprimé, suivre, masquer) ;
//   I  chaque geste de l'inventaire reste joignable (Scanner, « … », Préparer, Je dépose, tournée, Envoyés,
//      « Imprimer N » ⇒ la feuille « Tout imprimer », rien d'imprimé avant son clic) ;
//   A  contraste AA sur le fond réel (le pire point du dégradé quand le texte est posé dessus) ;
//   D  rien ne déborde ;
//   R  Achats : « À retirer » EN TÊTE et ouvert sans toucher, le code en grande plaque, « J'ai retiré »,
//      Mode relais, Scanner, aucun plein.
// Lancer : construire dist/, puis node scripts/bancs/studio-ventes.cjs   (BANC_PORT 9071, SHOTS=dossier, BANC_SEUL=390c,1512s…)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 9071);
const SHOTS = process.env.SHOTS || '';
const SEUL = process.env.BANC_SEUL ? process.env.BANC_SEUL.split(',') : null;
const maintenant = new Date(2026, 10, 5, 11, 0, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const jj = (n) => String(n).padStart(2, '0');
const jourFr = (j) => { const d = new Date(MS + j * J); return `${jj(d.getDate())}/${jj(d.getMonth() + 1)}/${d.getFullYear()}`; };
const jourIso = (j) => { const d = new Date(MS + j * J); return `${d.getFullYear()}-${jj(d.getMonth() + 1)}-${jj(d.getDate())}`; };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const LONG = 'Nike Air Force 1 Low Triple White édition limitée collaboration très longue description sans espace ni fin';
// tx, titre, n° de suivi (sa forme dit le transporteur), N°, âge de la vente (jours), PDF, date limite lue
const V = [
  { tx: 9301, titre: 'Air Max 90 blanche 42', suivi: 'XW123456789TS', num: '31', age: 1, pdf: true },
  { tx: 9302, titre: 'Air Max 90 blanche 42', suivi: 'XW223456789TS', num: '32', age: 3, pdf: true },
  { tx: 9303, titre: 'Samba noire 40', suivi: '', num: '33', age: 9, pdf: false },
  { tx: 9304, titre: 'Gel 1130 argent 41', suivi: '41234567', num: '34', age: 2, pdf: true, limite: `${jourFr(1)} à 12:00` },
  { tx: 9305, titre: LONG, suivi: '42234567', num: '35', age: 6, pdf: true },
];
const PARTIS = [
  { tx: 9306, titre: 'Forum Low 43', suivi: '43234567', num: '36', age: 4, status: 'Colis en transit' },
  { tx: 9307, titre: 'Club C 44', suivi: 'XW323456789TS', num: '37', age: 6, status: 'Colis livré' },
];
// L'ordre attendu de « À envoyer » (par transporteur, la plus pressée d'abord, à limite égale la plus ancienne).
// (9 nov., soir, lot AJ — décision de Julien) le plus RÉCENT en haut (âge 1, 2, 3, 6, 9 j) ; avant : la limite,
// puis la plus ancienne. Banc mis à jour ; règle : src/ordreRecent.js.
const ORDRE = ['9301', '9304', '9302', '9305', '9303'];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const LIEU = 'MAISON DU QUAI, 40 RUE DU QUAI, 35260 CANCALE';
const lignes = (sombre) => [
  { id: 'main', data: { vinted_dark: sombre, vinted_used_numeros: [...V, ...PARTIS].map((v) => Number(v.num)),
    vinted_annonce_numeros: Object.fromEntries([...V, ...PARTIS].map((v) => [`i${v.tx}`, { numero: v.num, title: v.titre, auto: false, numberedAt: ilYa(30) }])) } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [
    ...V.map((v) => ({ transaction_id: v.tx, title: v.titre, price: { amount: '50.0', currency_code: 'EUR' }, status: 'Le paiement a été validé', transaction_user_status: 'needs_action', date: ilYa(v.age) })),
    ...PARTIS.map((v) => ({ transaction_id: v.tx, title: v.titre, price: { amount: '64.5', currency_code: 'EUR' }, status: v.status, transaction_user_status: 'waiting', date: ilYa(v.age) })),
  ] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [] } } },
  ...[...V, ...PARTIS].map((v) => ({ id: `harvest_111_txn_${v.tx}`, data: { capturedAt: ilYa(0.5), payload: { transaction: { id: v.tx, item_id: `i${v.tx}` } } } })),
  ...[...V, ...PARTIS].filter((v) => v.pdf !== false).map((v) => ({ id: 'email_bord_' + v.tx, data: { transaction: String(v.tx), uid: '111', filename: `bordereau-${v.tx}.pdf`, modele: v.titre, article: v.titre, receivedAt: ilYa(Math.max(0.2, v.age - 0.5)), pdfB64: PDF_B64, suivi: v.suivi, dateLimite: v.limite || undefined } })),
  { id: 'email_track_mondialrelay_81000001', data: { type: 'suivi', carrier: 'mondialrelay', suivi: '81000001', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis 81000001 est disponible dans votre Point Relais', receivedAt: ilYa(0.3), emailAt: ilYa(0.3), arriveLe: ilYa(0.3), code: '100001', lieu: LIEU, limite: jourIso(5), consigne: false, account: 'compte_a', recuSur: ['boite@exemple.fr'] } },
  { id: 'panel_colis_relais', data: {} },
];
let ko = 0, ok = 0;
const rouges = [];
const dit = (c, m, d) => { if (c) ok++; else { ko++; rouges.push(m); } console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.mjs': 'text/javascript' };
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

async function ouvrir(b, vp, sombre) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const LIGNES = lignes(sombre);
  const mainData = LIGNES[0].data;
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(({ s, m, imprime }) => {
    try {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.setItem('vinted_dark', JSON.stringify(s));
      if (!sessionStorage.getItem('banc_init')) {
        sessionStorage.setItem('banc_init', '1');
        localStorage.setItem('vinted_annonce_numeros', JSON.stringify(m.vinted_annonce_numeros)); localStorage.setItem('vinted_used_numeros', JSON.stringify(m.vinted_used_numeros));
        localStorage.setItem('vinted_bords_printed', JSON.stringify(imprime));
      }
    } catch (_) {}
    // Faux détecteur (le scanner existant) : rend la file posée par le banc.
    window.__file = []; window.__scan = (v) => { window.__file.push(v); };
    window.BarcodeDetector = class { static async getSupportedFormats() { return ['code_128']; } async detect() { const v = window.__file.shift(); return v == null ? [] : [{ rawValue: v, format: 'code_128' }]; } };
    const gum = async () => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const x = c.getContext('2d'); setInterval(() => { x.fillStyle = '#888'; x.fillRect(0, 0, 320, 240); }, 200); return c.captureStream(5); };
    try { Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: gum }, configurable: true }); } catch (_) {}
  }, { s: sombre, m: mainData, imprime: { 9302: MS - 3600e3 } });
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
  await pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.querySelectorAll('[data-bord-card][data-tx-colis]').length >= 5, null, { timeout: 30000 }).catch(() => {});
  await pg.waitForFunction(() => ['N°31', 'N°32', 'N°34'].every((n) => document.body.innerText.includes(n)), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(900);
  return { ctx, pg, errs, tel };
}

const onglet = async (pg, v) => {
  // (11 nov., revue colis) « À retirer » est la section de tête d'Achats (lot DJ3), plus un onglet de Colis.
  if (v === 'retirer') { await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=retraits' }))); await pg.locator('[data-colis-section="achats"]').first().waitFor({ timeout: 30000 }).catch(() => {}); await pg.waitForTimeout(1200); return; }
  await pg.click(`[data-colis-onglet-choix="${v}"]`).catch(() => {});
  await pg.waitForFunction((x) => { const e = document.querySelector('[data-colis-onglet]'); return e && e.getAttribute('data-colis-onglet') === x; }, v, { timeout: 8000 }).catch(() => {});
  await pg.waitForTimeout(500);
};
const shot = async (pg, nom, plein = false) => { if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), fullPage: plein }); };


// ════════════════════════════════════════════════════════════════════════════
//  CE QUE LE BANC MESURE (data-*, styles calculés, nombres rendus — jamais un libellé)
// ════════════════════════════════════════════════════════════════════════════
const ATTENDU_PRESSES = ['9304', '9305'];   // limite LUE demain 12 h ; estimée demain (vente il y a 6 j). 9303 : estimée DÉPASSÉE ⇒ hors compte.
// Le contraste AA d'un texte : sa couleur contre le premier fond opaque de ses ancêtres, sinon contre le pire
// point du dégradé de l'espace.
// (15 nov., « Verre dépoli », docs/passation/2026-11-15-verre-depoli.md « La preuve ») La même règle que
// scripts/bancs/verre.cjs (V3), sans rien figer d'une matière : les fonds d'un ancêtre comptent AVEC leur dégradé
// (`background-image` : le verre est un dégradé translucide sur une couleur transparente) ; le fond de l'espace se
// LIT sur les jetons rendus — le haut éclairé de ses reflets, l'aplat, le bas — et chaque texte est jugé sur le PIRE.
// Avant le verre, ces jetons étaient le dégradé clair du studio (#C6DDF0 = son --sb-bas, #15263D = son --sb-haut
// nuit : les valeurs figées d'hier, gardées en repli si aucun jeton ne se lit).
const contrastes = (pg, sels, sombre) => pg.evaluate(({ sels, sombre }) => {
  const rgb = (s) => { s = String(s || '').trim(); const h = /^#([0-9a-f]{6})$/i.exec(s); if (h) return { r: parseInt(h[1].slice(0, 2), 16), g: parseInt(h[1].slice(2, 4), 16), b: parseInt(h[1].slice(4, 6), 16), a: 1 }; const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const couleursDe = (img) => (String(img || '').match(/rgba?\([^)]*\)|#[0-9a-f]{6}\b/gi) || []).map(rgb).filter((c) => c && c.a > 0);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const melange = (h, b) => ({ r: h.r * h.a + b.r * (1 - h.a), g: h.g * h.a + b.g * (1 - h.a), b: h.b * h.a + b.b * (1 - h.a), a: 1 });
  const ratio = (t, f) => { const L1 = lum(t), L2 = lum(f); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
  const coque = document.querySelector('.vrm-app-shell[data-espace]');
  const espace = document.querySelector('.vrm-tache[data-espace]') || coque || document.documentElement;
  const tok = (n) => rgb(getComputedStyle(espace).getPropertyValue(n));
  const haut = tok('--sb-haut'), aplat = tok('--sb-aplat'), bas = tok('--sb-bas'), reflet = tok('--sv-reflet'), reflet2 = tok('--sv-reflet-2');
  let eclaire = haut && haut.a >= 0.99 ? haut : null;
  if (eclaire && reflet2) eclaire = melange(reflet2, eclaire);
  if (eclaire && reflet) eclaire = melange(reflet, eclaire);
  const arrets = [eclaire, aplat, bas].filter((c) => c && c.a >= 0.99);
  const fonds = arrets.length ? arrets : [sombre ? { r: 0x15, g: 0x26, b: 0x3D, a: 1 } : { r: 0xC6, g: 0xDD, b: 0xF0, a: 1 }];
  // Les fonds possibles sous un texte : les couches de ses ancêtres (couleur, puis le dégradé posé dessus) jusqu'à
  // la première opaque, recomposées sur chaque arrêt du fond de l'espace (ou sur la couche opaque).
  const fondsDe = (el) => { const couches = []; let fin = false;
    for (let e = el; e && e !== coque && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e); const bg = rgb(cs.backgroundColor); const lay = [];
      if (bg && bg.a > 0) lay.push([bg]);
      if (/gradient/.test(cs.backgroundImage || '')) { const g = couleursDe(cs.backgroundImage); if (g.length) lay.push(g); }
      if (lay.length) { couches.push(...lay.reverse()); if ((bg && bg.a >= 0.99) || lay[0].every((x) => x.a >= 0.99)) { fin = true; break; } }
    }
    let cands = fin ? [] : fonds.slice();
    for (const lay of couches.reverse()) { const n = []; for (const col of lay) { if (!cands.length) n.push({ ...col, a: 1 }); else for (const b of cands) n.push(melange(col, b)); } cands = n.slice(0, 24); }
    return cands; };
  const out = [];
  for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
    if (!el.offsetParent || !(el.textContent || '').trim()) continue;
    const c = rgb(getComputedStyle(el).color); if (!c) continue;
    const r = Math.min(...fondsDe(el).map((f) => ratio(melange(c, f), f)));
    out.push({ sel, t: (el.textContent || '').trim().slice(0, 24), r: Math.round(r * 100) / 100 });
  }
  return out;
}, { sels, sombre });

const visibles = (pg, sel) => pg.evaluate((s) => [...document.querySelectorAll(s)].filter((x) => { if (!x.offsetParent) return false; const q = x.getBoundingClientRect(); return q.width > 0 && q.height > 0; }).length, sel);

async function scenario(b, vp, sombre) {
  const nom = `${vp.width}${sombre ? '-sombre' : '-clair'}`;
  const { ctx, pg, errs, tel } = await ouvrir(b, vp, sombre);
  try {
    await onglet(pg, 'envoyer');
    await pg.waitForSelector('[data-sb-tete="ventes"]', { timeout: 20000 }).catch(() => {});
    await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
    await pg.waitForTimeout(400);
    await shot(pg, `studio-ventes-${nom}-expedier`);
    if (SHOTS) { await pg.evaluate(() => { const c = document.querySelector('[data-bord-card][data-tx-colis="9302"]'); if (c) c.scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300); await shot(pg, `studio-ventes-${nom}-liste`); await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); }); }
    if (process.env.BANC_SONDE) console.log(await pg.evaluate(() => { const k = document.querySelector('[data-bord-card][data-tx-colis="9303"]'); return [...k.querySelectorAll('*')].filter((x) => x.getBoundingClientRect().height > 0).slice(0, 25).map((x) => x.tagName + '.' + String(x.className).slice(0, 25) + ' ' + [...x.attributes].map((a) => a.name).filter((n) => n.startsWith('data-')).slice(0, 2).join(',') + ' h=' + Math.round(x.getBoundingClientRect().height) + ' top=' + Math.round(x.getBoundingClientRect().top - k.getBoundingClientRect().top) + ' ps=' + getComputedStyle(x, '::before').content).join('\n'); }));
    if (process.env.BANC_SONDE) console.log(await pg.evaluate(() => { const c = document.querySelector('[data-bord-card][data-tx-colis="9304"]'); if (!c) return 'pas de carte'; const e = c.querySelector('.sb-echeance'); const out = [];
      for (let x = e; x && x !== c; x = x.parentElement) { const s = getComputedStyle(x); out.push(`${x.tagName}.${String(x.className).slice(0, 30)} d=${s.display} pos=${s.position} w=${Math.round(x.getBoundingClientRect().width)} gtc=${s.gridTemplateColumns} fd=${s.flexDirection}`); }
      const t = c.querySelector('.vrm-colis-titre'); const ts = getComputedStyle(t); out.push('match=' + t.matches('html:root:root:root:root body .vrm-app-shell .vrm-main .vrm-tache[data-espace="ventes"] .vrm-colis-carte .vrm-colis-titre') + ' m2=' + t.matches('.vrm-tache .vrm-colis-titre') + ' m3=' + t.matches('.vrm-main .vrm-colis-titre') + ' m4=' + t.matches('.vrm-app-shell .vrm-colis-titre') + ' m5=' + t.matches('html:root body .vrm-colis-titre')); out.push(`titre d=${ts.display} pos=${ts.position} w=${Math.round(t.getBoundingClientRect().width)} flex=${ts.flex} ws=${ts.whiteSpace} ov=${ts.overflow} mw=${ts.minWidth} sw=${t.scrollWidth}`); const q=c.querySelector('.vrm-colis-photo + div'); const qs=getComputedStyle(q); out.push(`corps flex=${qs.flex} w=${Math.round(q.getBoundingClientRect().width)} mw=${qs.maxWidth}`); return out.join('\n'); }));
    // ── C : LE GRAND CHIFFRE = la publication (« À envoyer » de Ma journée), l'ambre = les colis « avant demain ».
    const tete = await pg.evaluate(() => { const t = document.querySelector('[data-sb-tete="ventes"]'); if (!t) return null;
      const ch = t.querySelector('[data-sb-chiffre]'); const pr = t.querySelector('[data-sb-presses]');
      const pub = (() => { try { return JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); } catch (_) { return null; } })();
      const q = ch.getBoundingClientRect();
      return { n: ch.getAttribute('data-sb-chiffre'), affiche: (t.querySelector('.sb-chiffre-affiche') || {}).textContent || '', presses: pr ? pr.getAttribute('data-sb-presses') : '0', pub: pub && pub.total, haut: Math.round(q.top), fs: parseFloat(getComputedStyle(t.querySelector('.sb-chiffre-affiche')).fontSize) }; });
    dit(!!tete && tete.n === '5' && tete.affiche === '5' && String(tete.pub) === '5', `${nom} : C le grand chiffre = la publication « à envoyer » (5)`, JSON.stringify(tete));
    dit(!!tete && tete.presses === String(ATTENDU_PRESSES.length), `${nom} : C « avant demain » = les limites d'aujourd'hui/demain, jamais une estimée dépassée`, tete ? tete.presses : '');
    // (15 nov., maquette validée « Verre dépoli ») le chiffre posé sur le fond : 56 px (maquette), une affiche ≥ 48.
    dit(!!tete && tete.fs >= 48, `${nom} : C le chiffre est une affiche (≥ 48 px)`, tete ? String(tete.fs) : '');
    // ── P : UN SEUL BOUTON PLEIN à l'écran, et c'est « Imprimer N » (la fonction d'avant : la feuille « Tout imprimer »).
    const pleins = await pg.evaluate(() => [...document.querySelectorAll('.sb-btn-plein, .vrm-b-primaire, [data-variante="primaire"]')].filter((x) => x.offsetParent && x.getBoundingClientRect().width > 0 && !x.closest('[role="dialog"], .vrm-fs, .vrm-fp')).map((x) => ({ c: x.className.toString().slice(0, 40), k: x.getAttribute('data-colis-barre-btn') || '', n: x.getAttribute('data-imprimer-prets') || '' })));
    dit(pleins.length === 1 && pleins[0].k === 'imprimer' && pleins[0].n === '3', `${nom} : P un seul bouton plein, « Imprimer N » (N = les bordereaux qui partent)`, JSON.stringify(pleins));
    const forme = await pg.evaluate(() => { const p = document.querySelector('.sb-btn-plein'); if (!p) return null; const q = p.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), r: getComputedStyle(p).borderTopLeftRadius }; });
    // (15 nov., maquette validée « Verre dépoli ») le plein est une BARRE sous la liste (52 px), plus le rond d'encre du studio.
    dit(!!forme && forme.h >= 48 && forme.w >= (tel ? 300 : 300), `${nom} : P le plein est la barre de la maquette (≥ 48 px de haut, large)`, JSON.stringify(forme));
    // ── R : AU PLUS DEUX RONDS en tête, chacun nommé (aria-label), 44 px.
    const ronds = await pg.evaluate(() => [...document.querySelectorAll('[data-sb-tete="ventes"] .sb-rond')].filter((x) => x.offsetParent).map((x) => ({ k: x.getAttribute('data-colis-barre-btn'), l: !!x.getAttribute('aria-label'), w: Math.round(x.getBoundingClientRect().width), h: Math.round(x.getBoundingClientRect().height) })));
    dit(ronds.length >= 1 && ronds.length <= 2 && ronds.every((r) => r.l && r.w === 44 && r.h === 44), `${nom} : R au plus deux ronds en tête, nommés, 44 px`, JSON.stringify(ronds));
    // ── T : LES TUILES-FILTRES — enfoncée + diode, la liste suit, une deuxième touche rend tout.
    // (15 nov., « Verre dépoli ») les tuiles-filtres vivent derrière « … » (maquette : rien entre le chiffre et la liste).
    await pg.click('[data-colis-barre-btn="outils"]').catch(() => {}); await pg.waitForTimeout(400);
    const tuiles = await pg.evaluate(() => [...document.querySelectorAll('[data-envoyer-filtres] [data-envoyer-filtre-choix]')].filter((x) => x.offsetParent).map((x) => ({ v: x.getAttribute('data-envoyer-filtre-choix'), n: x.getAttribute('data-envoyer-filtre-n'), p: x.getAttribute('aria-pressed'), h: Math.round(x.getBoundingClientRect().height) })));
    dit(tuiles.length >= 4 && tuiles[0].v === 'tous' && tuiles[0].p === 'true' && tuiles.some((t) => t.v === 'avant-demain' && t.n === '2'), `${nom} : T les tuiles (Tous posée, Avant demain · 2, transporteurs)`, JSON.stringify(tuiles));
    dit(tuiles.every((t) => t.h >= 44), `${nom} : T chaque tuile ≥ 44 px`, JSON.stringify(tuiles.map((t) => t.h)));
    const etatTuile = (v) => pg.evaluate((v) => { const t = document.querySelector(`[data-envoyer-filtre-choix="${v}"]`); if (!t) return null; t.style.transition = 'none'; t.querySelector('.sb-diode').style.transition = 'none'; const s = getComputedStyle(t); const d = getComputedStyle(t.querySelector('.sb-diode'));
      return { p: t.getAttribute('aria-pressed'), ombre: s.boxShadow, fond: s.backgroundImage + '|' + s.backgroundColor, diode: d.backgroundColor, liste: [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].filter((c) => c.offsetParent).map((c) => c.getAttribute('data-tx-colis')) }; }, v);
    const avant = await etatTuile('avant-demain');
    await pg.evaluate(() => { const t = document.querySelector('[data-envoyer-filtre-choix="avant-demain"]'); if (t) t.scrollIntoView({ block: 'center', inline: 'nearest' }); }); await pg.waitForTimeout(200);
    await pg.locator('[data-envoyer-filtre-choix="avant-demain"]').click().catch(() => {});
    await pg.waitForFunction(() => { const t = document.querySelector('[data-envoyer-filtre-choix="avant-demain"]'); return t && t.getAttribute('aria-pressed') === 'true'; }, null, { timeout: 4000 }).catch(() => {});
    await pg.mouse.move(2, 2).catch(() => {});
    await pg.waitForTimeout(700);
    const apres = await etatTuile('avant-demain');
    dit(!!apres && !!avant && apres.p === 'true' && apres.ombre !== avant.ombre && apres.fond !== avant.fond && apres.diode !== avant.diode, `${nom} : T la tuile posée est ENFONCÉE (autre ombre, creux) et sa diode s'allume`, JSON.stringify({ avant: avant && avant.diode, apres: apres && apres.diode }));
    dit(!!apres && JSON.stringify([...apres.liste].sort()) === JSON.stringify(ATTENDU_PRESSES), `${nom} : T « Avant demain » : la liste montre ces colis-là, par leur identité`, apres ? JSON.stringify(apres.liste) : '');
    await shot(pg, `studio-ventes-${nom}-filtre`);
    await pg.click('[data-envoyer-filtre-choix="avant-demain"]').catch(() => {});
    await pg.waitForTimeout(400);
    const retour = await etatTuile('tous');
    dit(!!retour && retour.p === 'true' && retour.liste.length === 5, `${nom} : T toucher la tuile posée rend la liste entière (aucun colis caché)`, retour ? String(retour.liste.length) : '');
    // (15 nov.) « … » refermé : la liste revient telle quelle (les outils rangés).
    if (await pg.evaluate(() => document.documentElement.hasAttribute('data-colis-outils'))) { await pg.click('[data-colis-barre-btn="outils"]').catch(() => {}); await pg.waitForTimeout(400); }
    // ── L : LA LISTE — aucune rangée ne porte de bouton visible ; l'échéance courte à droite, ambre « avant demain ».
    const lignes = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].filter((c) => c.offsetParent).map((c) => {
      const boutons = [...c.querySelectorAll('button, a')].filter((x) => x.offsetParent && x.getBoundingClientRect().width > 0).length;
      const e = c.querySelector('.sb-echeance'); const q = c.getBoundingClientRect();
      return { tx: c.getAttribute('data-tx-colis'), boutons, ech: e ? e.getAttribute('data-sb-echeance') : null, ambre: e ? e.classList.contains('is-ambre') : false, h: Math.round(q.height), droite: e ? Math.round(q.right - e.getBoundingClientRect().right) : null }; }));
    dit(lignes.length === 5 && lignes.every((l) => l.boutons === 0), `${nom} : L aucune rangée ne contient de bouton (la rangée entière s'ouvre)`, JSON.stringify(lignes.map((l) => l.tx + ':' + l.boutons)));
    dit(lignes.every((l) => l.ech != null) && lignes.filter((l) => l.ambre).map((l) => l.tx).sort().join() === ATTENDU_PRESSES.join() && (lignes.find((l) => l.tx === '9303') || {}).ech === 'estimee-depassee', `${nom} : L l'échéance à droite ; ambre = « avant demain » ; l'estimée dépassée dit « à vérifier »`, JSON.stringify(lignes.map((l) => `${l.tx}:${l.ech}${l.ambre ? '*' : ''}`)));
    // (15 nov., maquette validée) quatre lignes par colis au téléphone (plaque · titre · échéance · place) : ≤ 112 px.
    dit(lignes.every((l) => l.h <= (tel ? 112 : 96)), `${nom} : L rangées denses (≤ ${tel ? 112 : 96} px)`, JSON.stringify(lignes.map((l) => l.h)));
    // ── O : LA RANGÉE S'OUVRE au premier plan avec SES gestes : imprimer CE bordereau, marquer déposé, imprimé, suivre, masquer.
    await pg.evaluate(() => { const c = document.querySelector('[data-bord-card][data-tx-colis="9304"]'); if (c) c.scrollIntoView({ block: 'center' }); });
    await pg.locator('[data-bord-card][data-tx-colis="9304"] .vrm-colis-titre').click().catch(() => {});
    await pg.waitForSelector('.vrm-fp-depuis-ligne [data-imprime="1"]', { state: 'attached', timeout: 8000 }).catch(() => {});
    await pg.waitForTimeout(500);
    // (16 nov., intégration de la fiche D) les gestes de la ligne vivent derrière « ⋯ » (feuille de tuiles, « Tout voir ») :
    // un toucher les montre — comme le banc studio-paires. La règle jugée ne change pas : ils sont JOIGNABLES depuis la rangée ouverte.
    await pg.evaluate(() => { const b = document.querySelector('.vrm-fp [data-fd-plus-ouvrir]'); if (b) b.click(); });
    await pg.waitForTimeout(300);
    await pg.evaluate(() => { const d = document.querySelector('.vrm-fp [data-fiche-plus]'); if (d) d.open = true; });
    await pg.waitForTimeout(400);
    const fiche = await pg.evaluate(() => { /* (15 nov.) la fiche porte DEUX places depuis la ligne : « contexte » (la fiche de la vente) et « actions » */ const zs = [...document.querySelectorAll('.vrm-fp-depuis-ligne')]; if (!zs.length) return null; const vis = (s) => zs.flatMap((z) => [...z.querySelectorAll(s)]).some((x) => x.offsetParent && x.getBoundingClientRect().width > 0);
      return { imprimer: vis('[data-imprime="1"]'), depose: vis('[data-geste="fait"]'), imprime: vis('[data-geste="imprime"]'), suivre: vis('[data-geste="suivre"]'), masquer: vis('[data-geste="masquer"]'), plus: vis('[data-colis-plus]') }; });
    dit(!!fiche && fiche.imprimer && fiche.depose && fiche.imprime && fiche.suivre && fiche.masquer, `${nom} : O la rangée ouverte porte ses gestes (imprimer ce bordereau, déposé, imprimé, suivre, masquer)`, JSON.stringify(fiche));
    await shot(pg, `studio-ventes-${nom}-ouverte`);
    if (process.env.BANC_SONDE) console.log(await pg.evaluate(() => { const b = document.querySelector('.vrm-fp-depuis-ligne [data-imprime="1"]'); if (!b) return 'pas de bouton'; const out = [];
      for (let x = b; x && !x.classList.contains('vrm-fp-depuis-ligne'); x = x.parentElement) { const s = getComputedStyle(x); out.push(`${x.tagName}.${String(x.className).slice(0, 40)} w=${Math.round(x.getBoundingClientRect().width)} d=${s.display} fl=${s.flex} mw=${s.maxWidth} wcss=${s.width} ar=${s.aspectRatio} pr=${x.hasAttribute('data-fiche-principal')}`); } return out.join('\n'); }));
    await pg.keyboard.press('Escape').catch(() => {});
    await pg.waitForTimeout(500);
    // ── I : CHAQUE GESTE DE L'INVENTAIRE EST JOIGNABLE : Scanner, « … » (Emballer, Tout générer), Préparer mes colis,
    //       Je dépose, la tournée, Envoyés, À faire (téléphone), « Choisir » ⇒ la feuille « Tout imprimer » (rien imprimé avant son clic).
    const joint = {};
    // (15 nov.) « … » ouvert : les outils et « À faire » (Préparer, Je dépose, la tournée) sont là.
    if (!(await pg.evaluate(() => document.documentElement.hasAttribute('data-colis-outils')))) { await pg.click('[data-colis-barre-btn="outils"]').catch(() => {}); await pg.waitForTimeout(400); }
    joint.scanner = await visibles(pg, '[data-colis-barre-btn="scanner"]') > 0;
    joint.outils = await visibles(pg, '[data-colis-barre-btn="outils"]') > 0;
    joint.envoyes = await visibles(pg, '[data-colis-onglet-choix="envoyes"]') > 0;
    const aFaire = await pg.$('[data-ui-afaire]');
    const dansAFaire = async (sel) => { if (await visibles(pg, sel)) return true; if (aFaire && await aFaire.isVisible()) { await aFaire.click().catch(() => {}); await pg.waitForTimeout(500); const v = await visibles(pg, sel) > 0; await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(300); return v; } return false; };
    joint.preparer = await dansAFaire('[data-preparer-ouvrir]');
    joint.depose = await dansAFaire('[data-depot-ouvrir]');
    joint.tournee = await dansAFaire('[data-tournee-ouvrir]');
    // (version studio) « Imprimer N » IMPRIME en un toucher (impression-simple, son banc le juge) : la feuille « Tout
    // imprimer » (choisir, réimprimer) reste joignable par « … · Choisir » (`ouvrirLot`), à côté du papier.
    await pg.click('button.vrm-impr-lien[data-lot-ouvrir]').catch(() => {});
    await pg.waitForSelector('[data-lot]', { timeout: 8000 }).catch(() => {});
    joint.toutImprimer = !!(await pg.$('[data-lot]'));
    await shot(pg, `studio-ventes-${nom}-imprimer`);
    await pg.keyboard.press('Escape').catch(() => {});
    await pg.waitForTimeout(400);
    dit(Object.values(joint).every(Boolean), `${nom} : I chaque geste d'« À expédier » reste joignable`, JSON.stringify(joint));
    if (await pg.evaluate(() => document.documentElement.hasAttribute('data-colis-outils'))) { await pg.click('[data-colis-barre-btn="outils"]').catch(() => {}); await pg.waitForTimeout(400); }
    // ── A : AA sur le fond réel (titre, chiffre, ambre, tuiles, rangées, échéances).
    const aa = await contrastes(pg, ['.sb-tete-titre', '.sb-tete-lib', '.sb-tete-ambre', '.sb-chiffre-affiche', '.sb-tuile-lib', '.sb-tuile-unite', '.sb-tuile-chiffre', '.vrm-colis-titre', '[data-colis-dates]', '.sb-echeance', '.vrm-colis-resume', '[data-date-tete]'], sombre);
    const faibles = aa.filter((x) => x.r < 4.5);
    dit(aa.length >= (tel ? 10 : 8) && !faibles.length, `${nom} : A contraste AA (≥ 4,5:1) sur le fond réel — ${aa.length} textes`, JSON.stringify(faibles.slice(0, 6)));
    // ── D : RIEN NE DÉBORDE (page, tête, rangées).
    const deb = await pg.evaluate(() => { const vw = document.documentElement.clientWidth; const hors = [...document.querySelectorAll('.vrm-tache[data-espace] *')].filter((x) => { if (!x.offsetParent || x.closest('.sb-tuiles-filtres, .vrm-rangee, [data-rangee-defile], .vrm-seg')) return false; const q = x.getBoundingClientRect(); return q.width > 0 && (q.right > vw + 1 || q.left < -1); }).map((x) => (x.className || x.tagName).toString().slice(0, 30));
      return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, hors: hors.slice(0, 5), n: hors.length }; });
    dit(deb.page <= 1 && deb.n === 0, `${nom} : D rien ne déborde`, JSON.stringify(deb));
    // ── ACHATS · À RETIRER : EN TÊTE, OUVERT sans toucher ; le code en grande plaque ; « J'ai retiré » ; Mode relais ; aucun plein.
    await onglet(pg, 'retirer');
    await pg.waitForSelector('[data-sb-tete="achats"]', { timeout: 20000 }).catch(() => {});
    await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
    await pg.waitForTimeout(600);
    await shot(pg, `studio-ventes-${nom}-retirer`);
    const ret = await pg.evaluate(() => { const r = document.querySelector('[data-retirer-repli]'); const t = document.querySelector('[data-sb-tete="achats"]');
      const pl = [...document.querySelectorAll('.vrm-rpf-code-gros.sb-plaque--grande')].filter((x) => x.offsetParent).map((x) => ({ code: x.getAttribute('data-rp-code-visible'), fs: parseFloat(getComputedStyle(x).fontSize), h: Math.round(x.getBoundingClientRect().height), haut: Math.round(x.getBoundingClientRect().top) }));
      const liste = document.querySelector('.vrm-tache[data-tache="achats"] [data-achat-ligne], .vrm-tache[data-tache="achats"] [data-fiche-ligne][data-fl-ctx="achat"]');
      return { repli: r && r.getAttribute('data-retirer-repli'), ligneCachee: !!(document.querySelector('.vrm-achats-retirer-ligne') || {}).hidden, tete: t ? Math.round(t.getBoundingClientRect().top) : null, n: t ? t.querySelector('[data-sb-chiffre]').getAttribute('data-sb-chiffre') : null,
        plaques: pl, retire: [...document.querySelectorAll('[data-colis-retire]')].some((x) => x.offsetParent), relais: [...document.querySelectorAll('[data-relais-ouvrir]')].some((x) => x.offsetParent),
        scanner: [...document.querySelectorAll('[data-sb-tete="achats"] [data-colis-barre-btn="scanner"]')].some((x) => x.offsetParent),
        pleins: [...document.querySelectorAll('.sb-btn-plein')].filter((x) => x.offsetParent).length, vh: innerHeight, listeApres: liste && t ? liste.getBoundingClientRect().top > t.getBoundingClientRect().top : null }; });
    // (14 nov., version studio) La règle du repli est celle de main (`etatRepliRetirer`, src/repliRetirer.js, banc
    // achats-retirer-visible) : ouvert d'office dès qu'un colis est à retirer, la ligne RESTE pour refermer (R3).
    dit(!!ret && ret.repli === 'ouvert' && !ret.ligneCachee && ret.tete != null && ret.tete < ret.vh * 0.5, `${nom} : R « À retirer » est EN TÊTE d'Achats et ouvert sans toucher (la ligne reste pour refermer)`, JSON.stringify({ repli: ret && ret.repli, cachee: ret && ret.ligneCachee, tete: ret && ret.tete }));
    dit(!!ret && ret.n === '1' && ret.plaques.some((p) => p.code === '100001' && p.fs >= 16 && p.h >= 30), `${nom} : R le code de retrait en grande plaque, visible sans toucher`, JSON.stringify(ret && ret.plaques));
    dit(!!ret && ret.retire && ret.relais && ret.scanner && ret.pleins === 0, `${nom} : R « J'ai retiré », Mode relais, Scanner joignables ; aucun bouton plein sur Achats`, JSON.stringify({ retire: ret && ret.retire, relais: ret && ret.relais, scanner: ret && ret.scanner, pleins: ret && ret.pleins }));
    const aaR = await contrastes(pg, ['.sb-tete-titre', '.sb-tete-lib', '.sb-chiffre-affiche', '.vrm-rpf-code-gros', '.vrm-rpf-titre', '.vrm-colis-resume'], sombre);
    const faiblesR = aaR.filter((x) => x.r < 4.5);
    dit(aaR.length >= 4 && !faiblesR.length, `${nom} : A « À retirer » contraste AA (${aaR.length} textes)`, JSON.stringify(faiblesR.slice(0, 6)));
    const debR = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    dit(debR <= 1, `${nom} : D « À retirer » ne déborde pas`, String(debR));
    dit(errs.length === 0, `${nom} : Z aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${nom} : le scénario va au bout`, String(e.message || e).slice(0, 200)); }
  await ctx.close();
}

(async () => {
  let b;
  try {
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    await new Promise((r) => srv.listen(PORT, r));
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const sombre of [false, true]) {
      if (SEUL && !SEUL.includes(`${vp.width}${sombre ? 's' : 'c'}`)) continue;
      await scenario(b, vp, sombre);
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ studio-ventes : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ studio-ventes : ${ok} verts`);
    process.exit(ko ? 1 : 0);
  }
})();
