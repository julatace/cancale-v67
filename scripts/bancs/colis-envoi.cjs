// Banc : COLIS, CÔTÉ ENVOI (5 nov., chantier D de la revue de cohérence : points 2.17, 2.20, 2.21, 2.22).
// Données INVENTÉES (dépôt public), formes réelles : ventes Vinted à envoyer (`orders_sold`, `needs_action`),
// leurs transactions (tx → annonce → fiche N°), leurs bordereaux e-mail (`email_bord_{tx}` : PDF, n° de suivi,
// date limite LUE pour l'une), deux ventes parties (« en transit », « livré »), un colis à retirer (e-mail
// Mondial Relay au sujet vouvoyé, sans titre d'article) pour « En grand ». Deux ventes au MÊME titre.
// Horloge figée (5 nov. 11 h). 390 tactile et 1512, clair et sombre. Jugé sur data-*, styles calculés et
// nombres rendus (§6.4), jamais sur un libellé.
//  F. LA FRISE : l'encre ne va qu'à la DERNIÈRE étape faite (aucune encre si rien n'est fait) ; une étape à
//     venir n'est jamais à l'encre (ni son trait ni son mot) — plus de « Livré » pour un colis en route, plus
//     d'« Imprimé » quand rien n'est imprimé.
//  B. LA BARRE DU HAUT : les mêmes boutons, aux mêmes places, sur « À envoyer », « Envoyés » et « À retirer » ;
//     une forme (hauteur, rayon) ; 44 px au doigt ; plus de lien « Tes emails… » ni de réglage d'imprimante
//     (il est dans Paramètres), même avec « … » ouvert.
//  G. « EN GRAND » : `SheetShell` lumineuse (blanche même en sombre), titre = l'article ou « Colis <transporteur> »
//     (jamais un sujet d'e-mail au vouvoiement), aucun emoji, aucune phrase deux fois, chaque bouton ≥ 44 px.
//  L. LES COLONNES À L'ORDINATEUR : la liste « À envoyer » et « Envoyés » prennent toute la largeur de l'écran
//     (des lignes larges et fines, le choix de Julien du 19 oct.).
//  T. « TOURNÉE DE DÉPÔT » : les colis à envoyer regroupés par transporteur (le réseau où on les dépose), chacun
//     une fois, par SON identité ; « Déposé » en un geste écrit CE colis (jamais son jumeau au même titre) ; le
//     scanner existant s'ouvre depuis la tournée.
//  P. « TEMPS DE PRÉPARATION » : chaque vente dit depuis combien de jours elle attend (`data-attente-j`) ; à
//     limite égale, la plus ancienne d'abord ; une limite ESTIMÉE dépassée n'est jamais « en retard ».
//  Z. aucune erreur, rien ne déborde, cibles de la zone ≥ 44 px au doigt.
// Lancer : construire dist/, puis node scripts/bancs/colis-envoi.cjs   (BANC_PORT 9051, SHOTS=dossier)
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 9051);
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

// F — La frise : la couleur d'encre (celle de `--fu-encre`) seulement sur la dernière étape FAITE.
const lireFrises = (pg, portee) => pg.evaluate((sel) => {
  const sonde = document.createElement('span'); sonde.style.color = 'var(--fu-encre)'; sonde.style.background = 'var(--fu-encre)';
  const out = [];
  for (const f of document.querySelectorAll(sel)) {
    f.appendChild(sonde); const encre = getComputedStyle(sonde).color; sonde.remove();
    const segs = [...f.querySelectorAll('[data-fu-etape]')].map((s) => ({ cle: s.getAttribute('data-fu-etape'), fait: s.getAttribute('data-fait') === '1',
      mot: getComputedStyle(s.querySelector('span')).color, trait: getComputedStyle(s.querySelector('i')).backgroundColor }));
    const derniere = segs.map((s) => s.fait).lastIndexOf(true);
    out.push({ cle: f.getAttribute('data-fu-frise'), encre, derniere, segs });
  }
  return out;
}, portee);
const jugerFrises = (frises, nom, quoi) => {
  const fautes = [];
  for (const f of frises) {
    f.segs.forEach((s, i) => {
      const motEncre = s.mot === f.encre, traitEncre = s.trait === f.encre;
      if (i === f.derniere && !motEncre) fautes.push(`${f.cle}:${s.cle} dernière faite sans encre`);
      if (i !== f.derniere && motEncre) fautes.push(`${f.cle}:${s.cle} à l'encre (${s.fait ? 'pas la dernière' : 'pas faite'})`);
      if (!s.fait && traitEncre) fautes.push(`${f.cle}:${s.cle} trait à l'encre sans être fait`);
    });
  }
  dit(frises.length > 0 && !fautes.length, `${nom} : F ${quoi} — l'encre seulement sur la dernière étape faite (${frises.length} frises)`, fautes.slice(0, 4).join(' | '));
  return frises;
};

async function scenario(b, vp, sombre) {
  const nom = `${vp.width}${sombre ? '-sombre' : '-clair'}`;
  const { ctx, pg, errs, tel } = await ouvrir(b, vp, sombre);
  try {
    await onglet(pg, 'envoyer');
    await shot(pg, `colis-envoi-${nom}-envoyer`, true);
    // Les cartes (la page défile dans la coque : on amène chaque groupe en haut, puis on photographie).
    if (SHOTS) for (const [k, sel] of [['liste1', '[data-groupe-transp]'], ['liste2', '[data-groupe-transp="Mondial Relay"]'], ['liste3', '[data-groupe-transp="Chronopost"]']]) {
      await pg.evaluate((s) => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: 'start' }); }, sel); await pg.waitForTimeout(250); await shot(pg, `colis-envoi-${nom}-${k}`);
    }
    if (process.env.BANC_TROU) console.log(await pg.evaluate(() => { const a = document.querySelector('.vrm-colis-onglets'); const out = []; let e = a; for (let i = 0; i < 8 && e; i++) { e = e.nextElementSibling || (e.parentElement && e.parentElement.nextElementSibling); if (e) { const r = e.getBoundingClientRect(); out.push((e.className || e.tagName) + ' ' + [...e.attributes].map((x) => x.name).filter((n) => n.startsWith('data-')).join(',') + ' h=' + Math.round(r.height) + ' mt=' + getComputedStyle(e).marginTop + ' mb=' + getComputedStyle(e).marginBottom); } } return out.join('\n'); }));
    await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
    // ── F : À envoyer (9301 rien d'imprimé ⇒ aucune encre ; 9302 imprimé ⇒ « Imprimé » seul à l'encre).
    const fE = jugerFrises(await lireFrises(pg, '[data-bord-card] [data-fu-frise]'), nom, 'À envoyer');
    const f9301 = fE.find((f) => f.cle === '9301');
    // (7 nov., design) La règle est devenue plus forte : rien de fait ⇒ AUCUNE frise posée (quatre
    // traits gris ne disaient rien). Une frise qui serait là quand même ne doit toujours rien encrer ;
    // et la carte imprimée (9302) garde la sienne — sinon « pas de frise » passerait pour la règle.
    const f9302 = fE.find((f) => f.cle === '9302');
    dit((!f9301 || (f9301.derniere === -1 && f9301.segs.every((s) => s.mot !== f9301.encre))) && !!f9302 && f9302.derniere >= 0, `${nom} : F rien d'imprimé ⇒ pas de frise (ou aucun mot à l'encre) ; imprimé ⇒ sa frise`, JSON.stringify({ f9301: f9301 ? f9301.segs.map((s) => s.mot) : 'absente', f9302: !!f9302 }));
    const sansFrise = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].filter((c) => { const f = c.querySelector('[data-fu-frise]'); return f && !f.querySelector('[data-fait="1"]'); }).map((c) => c.getAttribute('data-tx-colis')));
    dit(!sansFrise.length, `${nom} : F une frise n'est posée que si une étape est faite`, JSON.stringify(sansFrise));
    // ── P : temps de préparation.
    const cartes = await pg.evaluate(() => [...document.querySelectorAll('[data-bord-card][data-tx-colis]')].map((c) => ({ tx: c.getAttribute('data-tx-colis'), att: c.getAttribute('data-attente-j'),
      txt: (c.querySelector('[data-colis-attente]') || {}).textContent || '', lim: (c.querySelector('[data-colis-limite-texte]') || {}).textContent || '' })));
    dit(JSON.stringify(cartes.map((c) => c.tx)) === JSON.stringify(ORDRE), `${nom} : P ordre « À envoyer » (la vente la plus récente d'abord)`, JSON.stringify(cartes.map((c) => c.tx)));
    const ages = Object.fromEntries(V.map((v) => [String(v.tx), String(v.age)]));
    dit(cartes.length === 5 && cartes.every((c) => c.att === ages[c.tx] && /\d/.test(c.txt)), `${nom} : P chaque vente dit depuis combien de jours elle attend`, JSON.stringify(cartes.map((c) => `${c.tx}=${c.att}:${c.txt}`)));
    const c9303 = cartes.find((c) => c.tx === '9303');
    dit(!!c9303 && !/retard/i.test(c9303.lim + c9303.txt), `${nom} : P limite ESTIMÉE dépassée ⇒ jamais « en retard »`, c9303 ? c9303.lim : '');
    // ── B : la barre du haut.
    const barre = () => pg.evaluate(() => { const r = document.querySelector('[data-colis-barre]'); if (!r) return null;
      return [...r.querySelectorAll('[data-colis-barre-btn]')].filter((x) => x.offsetParent).map((x) => { const q = x.getBoundingClientRect(); const s = getComputedStyle(x);
        return { k: x.getAttribute('data-colis-barre-btn'), x: Math.round(q.x), w: Math.round(q.width), h: Math.round(q.height), r: s.borderTopLeftRadius, t: x.textContent.trim(), fw: s.fontWeight, wf: +q.width.toFixed(2) }; }); });
    const bE = await barre();
    // ── L : les colonnes à l'ordinateur.
    if (!tel) {
      const l = await pg.evaluate(() => { const g = document.querySelector('.vrm-colis-grille[data-colis-lignes]'); const m = g && g.closest('.vrm-main'); if (!g || !m) return null;
        const cs = getComputedStyle(m); const contenu = m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const blocs = [...m.querySelectorAll('[data-bord-card], [data-groupe-transp], [data-colis-urgence]')].filter((x) => x.offsetParent && !x.closest('.vrm-fs'));
        const etroits = blocs.filter((x) => x.getBoundingClientRect().width < contenu * 0.96).map((x) => (x.getAttribute('data-tx-colis') || x.getAttribute('data-groupe-transp') || x.className || '').toString().slice(0, 30) + ':' + Math.round(x.getBoundingClientRect().width));
        return { g: Math.round(g.getBoundingClientRect().width), contenu: Math.round(contenu), etroits }; });
      dit(!!l && l.g >= l.contenu * 0.96 && !l.etroits.length, `${nom} : L « À envoyer » occupe toute la largeur (liste, groupes, bandeau)`, JSON.stringify(l));
    }
    // Rien de la liste « emails » ni l'imprimante, même « … » ouvert.
    await pg.click('[data-colis-barre-btn="outils"]').catch(() => {});
    await pg.waitForTimeout(300);
    const intrus = await pg.evaluate(() => ({ journal: !!document.querySelector('[data-journal-entree]'), imprimante: [...document.querySelectorAll('.vrm-colis-imprimante, [data-imprimante-reglage]')].filter((x) => x.offsetParent).length }));
    dit(!intrus.journal && !intrus.imprimante, `${nom} : B ni « Tes emails, ce que VRM en a fait » ni le réglage d'imprimante dans Colis`, JSON.stringify(intrus));
    await shot(pg, `colis-envoi-${nom}-outils`);
    await pg.click('[data-colis-barre-btn="outils"]').catch(() => {});
    // ── T : la tournée de dépôt.
    const ouvrirT = await pg.$('[data-tournee-ouvrir]');
    dit(!!ouvrirT, `${nom} : T « Préparer la tournée de dépôt » est dans « À envoyer »`);
    if (ouvrirT) {
      const hb = await ouvrirT.boundingBox();
      if (tel) dit(hb && hb.height >= 44, `${nom} : T le bouton fait 44 px au doigt`, hb ? String(Math.round(hb.height)) : '');
      await ouvrirT.click();
      await pg.waitForSelector('[data-tournee-sheet]', { timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(500);
      const t = await pg.evaluate(() => [...document.querySelectorAll('[data-tournee-groupe]')].map((g) => ({ g: g.getAttribute('data-tournee-groupe'), n: Number(g.getAttribute('data-n')),
        colis: [...g.querySelectorAll('[data-tournee-colis]')].map((c) => c.getAttribute('data-tournee-colis')) })));
      const tous = t.flatMap((x) => x.colis);
      dit(tous.length === 5 && new Set(tous).size === 5 && ORDRE.every((tx) => tous.includes('v:' + tx)), `${nom} : T chaque colis à envoyer une fois, par son identité`, JSON.stringify(t));
      dit(t.length === 3 && t.every((x) => x.n === x.colis.length), `${nom} : T regroupés par transporteur (3 groupes), le nombre de chaque groupe juste`, JSON.stringify(t.map((x) => x.g + ':' + x.n)));
      const mr = t.find((x) => /mondial/i.test(x.g));
      dit(!!mr && JSON.stringify(mr.colis) === JSON.stringify(['v:9304', 'v:9305']), `${nom} : T dans un groupe, l'ordre de l'écran (le plus récent d'abord)`, JSON.stringify(mr));
      await shot(pg, `colis-envoi-${nom}-tournee`);
      const petits = await pg.evaluate(() => [...document.querySelectorAll('[data-tournee-sheet] button, [data-tournee-sheet] a')].filter((x) => x.offsetParent).map((x) => ({ t: (x.getAttribute('aria-label') || x.textContent || '').trim().slice(0, 20), h: Math.round(x.getBoundingClientRect().height) })).filter((x) => x.h < 44));
      if (tel) dit(!petits.length, `${nom} : T toutes les cibles de la tournée ≥ 44 px`, JSON.stringify(petits));
      // « Déposé » en un geste : CE colis (9301), jamais son jumeau 9302 au même titre.
      await pg.click('[data-tournee-depose="v:9301"]').catch(() => {});
      await pg.waitForTimeout(300);
      const att = await pg.getAttribute('[data-tournee-colis="v:9301"]', 'data-etat').catch(() => null);
      dit(att === 'attente', `${nom} : T « Déposé » se pose en un geste, annulable`, String(att));
      await pg.clock.runFor(5600).catch(() => {});
      await pg.waitForTimeout(400);
      const ecrits = await pg.evaluate(() => { try { return Object.keys(JSON.parse(localStorage.getItem('vinted_ship_done') || '{}')).sort(); } catch (_) { return null; } });
      dit(JSON.stringify(ecrits) === '["9301"]', `${nom} : T seul 9301 est écrit (le jumeau 9302 au même titre jamais)`, JSON.stringify(ecrits));
      const scan = await pg.$('[data-tournee-sheet] [data-tournee-scanner]');
      dit(!!scan, `${nom} : T le scanner existant s'ouvre depuis la tournée`);
      if (scan) { await scan.click(); await pg.waitForSelector('[data-scan-sheet]', { timeout: 5000 }).catch(() => {}); dit(!!(await pg.$('[data-scan-sheet]')), `${nom} : T le scanner s'ouvre`); await pg.click('[data-scan-fermer]').catch(() => {}); await pg.waitForTimeout(300); }
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.waitForTimeout(400);
      if (await pg.$('[data-tournee-sheet]')) await pg.click('[data-tournee-sheet] [aria-label="Fermer"]').catch(() => {});
      await pg.waitForTimeout(300);
    }
    // ── Envoyés.
    await onglet(pg, 'envoyes');
    await shot(pg, `colis-envoi-${nom}-envoyes`, true);
    const bS = await barre();
    const fS = jugerFrises(await lireFrises(pg, '.vrm-colis-envoyes [data-fu-frise]'), nom, 'Envoyés');
    const f9306 = fS.find((f) => /9306/.test(f.cle));
    const livre = f9306 && f9306.segs.find((s) => s.cle === 'livre');
    dit(!!livre && livre.mot !== f9306.encre && !livre.fait, `${nom} : F colis en route ⇒ « Livré » n'est pas à l'encre`, JSON.stringify(f9306 && f9306.segs.map((s) => s.cle + (s.fait ? '+' : '-'))));
    if (!tel) {
      const l = await pg.evaluate(() => { const g = document.querySelector('.vrm-colis-envoyes'); const m = g && g.closest('.vrm-main'); if (!g || !m) return null;
        const cs = getComputedStyle(m); return { g: Math.round(g.getBoundingClientRect().width), contenu: Math.round(m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) }; });
      dit(!!l && l.g >= l.contenu * 0.96, `${nom} : L « Envoyés » occupe toute la largeur`, JSON.stringify(l));
    }
    // ── À retirer : la barre seulement (l'onglet est à une autre branche), puis « En grand ».
    await onglet(pg, 'retirer');
    // (intégration journee-perso) Plus de bouton « Code » sur la ligne : le code y est ÉCRIT ; « En grand » est dans le
    // détail, qu'ouvre un toucher sur la ligne (la 1re ligne qui a un code ou un QR).
    await pg.waitForSelector('.vrm-rpf-ligne [data-rp-code-visible]', { timeout: 10000 }).catch(() => {});
    await shot(pg, `colis-envoi-${nom}-retirer`);
    await pg.evaluate(() => { const c = [...document.querySelectorAll('.vrm-rpf-ligne [data-rp-code-visible]')].find((x) => x.getAttribute('data-rp-code-visible') !== 'desaccord'); const b = c && c.closest('.vrm-rpf-ligne').querySelector('button[aria-expanded]'); if (b) b.click(); });
    await pg.waitForSelector('[data-colis-plein-ecran]', { timeout: 5000 }).catch(() => {});
    const bR = await barre();
    const sig = (x) => JSON.stringify((x || []).map((y) => [y.k, y.x, y.w, y.h]));
    // (11 nov., lot DJ3 intégré) « À envoyer » et « Envoyés » sont deux onglets de Ventes : leur barre ne bouge pas d'un
    // pixel. « À retirer » vit dans Achats, avec SA barre (le scanner seul) : même forme de bouton, pas les mêmes boutons.
    dit(!!bE && bE.length >= 2 && sig(bE) === sig(bS), `${nom} : B la barre du haut est la même sur « À envoyer » et « Envoyés »`, JSON.stringify({ envoyer: bE, envoyes: bS }));
    dit(!!bR && bR.length >= 1 && !!bE && bR.every((y) => y.h === bE[0].h && y.r === bE[0].r), `${nom} : B la barre d'Achats · À retirer a la même forme de bouton`, JSON.stringify({ retirer: bR }));
    dit(!!bE && new Set(bE.map((x) => x.h + '/' + x.r)).size === 1, `${nom} : B une seule forme de bouton (hauteur, rayon)`, JSON.stringify(bE));
    if (tel) dit(!!bE && bE.every((x) => x.h >= 44), `${nom} : B 44 px au doigt`, JSON.stringify(bE));
    const pl = await pg.$('[data-colis-plein-ecran]');
    if (pl) {
      await pl.click();
      await pg.waitForSelector('[data-qr-plein]', { timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(700);
      await shot(pg, `colis-envoi-${nom}-en-grand`);
      const g = await pg.evaluate(() => {
        const d = document.querySelector('[data-qr-plein]'); if (!d) return null;
        const feuille = d.closest('.vrm-fs');
        const fond = getComputedStyle(feuille || d).backgroundColor;
        const titre = ((feuille || d).querySelector('.vrm-fs-titre, [data-qr-plein-titre]') || {}).textContent || '';
        const txt = (feuille || d).innerText;
        const phrases = txt.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 20);
        const doubles = phrases.filter((s, i) => phrases.indexOf(s) !== i);
        const cibles = [...(feuille || d).querySelectorAll('button, a')].filter((x) => x.offsetParent).map((x) => ({ t: (x.getAttribute('aria-label') || x.textContent || '').trim().slice(0, 24), h: Math.round(x.getBoundingClientRect().height) }));
        return { sheet: !!feuille, fond, titre, emoji: /[\u2600-\u27BF\u{1F300}-\u{1FAFF}\u2B50\u23F0-\u23FF]/u.test(txt), doubles, petites: cibles.filter((x) => x.h < 44) };
      });
      dit(!!g && g.sheet, `${nom} : G « En grand » est une SheetShell`, JSON.stringify(g && { sheet: g.sheet }));
      dit(!!g && /^rgb\(255, 255, 255\)$/.test(g.fond), `${nom} : G variante lumineuse (fond blanc, même en sombre)`, g ? g.fond : '');
      dit(!!g && /^Colis Mondial Relay$/.test(g.titre.trim()) && !/\bvous\b|\bvotre\b/i.test(g.titre), `${nom} : G titre = « Colis <transporteur> », jamais le sujet vouvoyé`, g ? g.titre : '');
      dit(!!g && !g.emoji, `${nom} : G aucun emoji`);
      dit(!!g && !g.doubles.length, `${nom} : G aucune phrase dite deux fois`, g ? JSON.stringify(g.doubles) : '');
      dit(!!g && !g.petites.length, `${nom} : G chaque bouton ≥ 44 px`, g ? JSON.stringify(g.petites) : '');
      await pg.keyboard.press('Escape').catch(() => {});
      await pg.waitForTimeout(300);
    } else dit(false, `${nom} : G « En grand » est joignable depuis la carte à retirer`);
    const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    dit(deb <= 1, `${nom} : Z rien ne déborde`, String(deb));
    dit(errs.length === 0, `${nom} : Z aucune erreur d'app`, errs.join(' | ').slice(0, 200));
  } catch (e) { dit(false, `${nom} : le scénario va au bout`, String(e.message || e).slice(0, 200)); }
  await ctx.close();
}

(async () => {
  let b;
  try {
    await new Promise((r) => srv.listen(PORT, r));
    b = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) for (const sombre of [false, true]) {
      if (SEUL && !SEUL.includes(`${vp.width}${sombre ? 's' : 'c'}`)) continue;
      await scenario(b, vp, sombre);
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e.message || e).slice(0, 200)); }
  finally {
    if (b) await b.close(); srv.close();
    console.log(ko ? `\n❌ colis-envoi : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ colis-envoi : ${ok} verts`);
    process.exit(ko ? 1 : 0);
  }
})();
