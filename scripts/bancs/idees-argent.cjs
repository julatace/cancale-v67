// BANC : IDÉES ARGENT (14 nov.) — node scripts/bancs/idees-argent.cjs après le build (BANC_PORT=…, BANC_DIST=…).
// Données INVENTÉES, rien de réel. 390 tactile et 1512, clair et sombre :
//   160 « Vente en main propre » (⌘K / loupe « vendu 124 ») : le N° EXACT désigne la paire, le prix, le
//       paiement, « Vendue » ⇒ vendue en main propre (décision datée du jour, paiement), sortie du stock,
//       « Annuler » offert ; un N° porté DEUX fois ⇒ la question (deux lignes, plaque rouge), aucun prix avant
//       son toucher ; le reçu PDF se télécharge ;
//   159 « Dépense en photo » : le ticket lu SUR la page (faux `TextDetector`), montant et date pré-remplis,
//       RIEN n'est écrit avant « Enregistrer » ; lecture ratée (rien lu, Tesseract injoignable) ⇒ saisie à la
//       main proposée ; « Enregistrer » ⇒ `vrm_compta.depenses` + la photo dans SA ligne ;
//   162 « Partager en image » depuis la fiche N°124 : toile 1080×1920 puis 1080×1080, PNG partagé par la
//       feuille du téléphone (Web Share simulé), N° seulement coché ;
//   161 Paramètres → Siri : créer le jeton ⇒ trois liens, une fois.
// Partout : aucune erreur de page, aucun débordement, cibles ≥ 44 px dans les feuilles.
// Captures : $TMPDIR/vrm-bancs/idees-argent/*.png (À REGARDER).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 12611;
const SHOTS = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'vrm-bancs', 'idees-argent');
fs.mkdirSync(SHOTS, { recursive: true });

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const jourLocal = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const HIER = jourLocal(MAINTENANT - 86400000), AUJ = jourLocal(MAINTENANT);
const [ha, hm, hj] = HIER.split('-');
const TICKET = `BRICO TEST\n${hj}/${hm}/${ha} 14:32\nCARTONS X10   8,90\nSCOTCH        3,60\nTOTAL TTC    12,50 EUR\nCB           12,50`;

const NUMEROS = {};
for (let i = 0; i < 50; i++) NUMEROS['p' + (201 + i)] = { numero: String(201 + i), title: 'Nike Dunk Low Panda', size: '42', price: '80', accountId: '111' };
NUMEROS['9124'] = { numero: '124', title: 'Asics Gel-Kayano 14 argent', size: '43', price: '90', accountId: '111', buyPrice: '37' };
NUMEROS['9880'] = { numero: '88', title: 'Air Max 90 blanche', size: '41', price: '70', accountId: '111' };
NUMEROS['9881'] = { numero: '88', title: 'Air Max 90 noire', size: '41', price: '75', accountId: '111' };
const ITEMS = [{ id: 9124, title: 'Asics Gel-Kayano 14 argent', brand_title: 'Asics', price: { amount: '90.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, size_title: '43', status: 'Très bon état', view_count: 3, favourite_count: 0, created_at_ts: MAINTENANT - 3 * 86400000, nPhotos: 2 }];
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const ROWS = () => [
  { id: 'main', data: { vinted_annonce_numeros: JSON.parse(JSON.stringify(NUMEROS)), vinted_dark: false, vrm_compta: { depenses: [{ id: 'd0', date: AUJ, libelle: 'Scotch', cat: 'Emballage', montant: 4 }], fixes: [], packs: [], abonnements: [] } } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: ITEMS } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), nItems: 0, payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: ilYaH(0.2), nItems: 0, payload: { my_orders: [] } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 300)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'object' ? String(v) : v);
  }
  return out;
};
const motif = (p) => new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

// Le faux détecteur de texte du navigateur (la voie que `lireTexteTicket` essaie en premier) et la
// fausse feuille de partage : pilotés par le banc.
const FAUX = ({ ticket }) => {
  window.__banc = { texte: ticket, partages: [] };
  window.TextDetector = class { async detect() { const t = window.__banc.texte; return t ? t.split('\n').map((l) => ({ rawValue: l })) : []; } };
  navigator.canShare = (d) => !!(d && d.files && d.files.length);
  navigator.share = async (d) => { const f = d.files[0]; const b = new Uint8Array(await f.arrayBuffer()); let w = 0, h = 0; if (b[0] === 0x89) { w = (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]; h = (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]; } window.__banc.partages.push({ nom: f.name, type: f.type, taille: b.length, w, h }); };
};

async function preparer(b, vp, { sombre = false, onglet = 'journee' } = {}) {
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  const rows = ROWS();
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(({ s }) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) localStorage.setItem('vinted_dark', 'true'); } catch (_) {} }, { s: sombre });
  await pg.addInitScript(FAUX, { ticket: TICKET });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {} ecrits.push({ url: u, corps }); return j([]); }
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = motif(lk[1]); let l = rows.filter((r) => re.test(r.id)); const rg = req.headers()['range']; if (rg) { const m = /(\d+)-(\d+)/.exec(rg); if (m) l = l.slice(+m[1], +m[2] + 1); } return j(l.map(forme)); }
    return j([]);
  });
  const SIRI = 'vs1_' + 'Ab3dEf6hIj9kLmNoPq2sTuVwXyZ0123456789abcde'.slice(0, 43);
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=siri/.test(u) && r.request().method() === 'POST') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, actif: true, jeton: SIRI, debut: SIRI.slice(4, 8), at: new Date().toISOString() }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => !document.getElementById('vrm-demarrage'), null, { timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs, ecrits, SIRI };
}
const attendre = (pg, f, arg, ms = 8000) => pg.waitForFunction(f, arg, { timeout: ms }).then(() => true).catch(() => false);
const debord = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const ouvrir = (pg, quoi, detail = {}) => pg.evaluate(([q, d]) => window.dispatchEvent(new CustomEvent('vrm:idees', { detail: { ...d, quoi: q } })), [quoi, detail]);
const fermer = async (pg) => { await pg.keyboard.press('Escape'); await attendre(pg, () => !document.querySelector('[data-ia-feuille]'), null, 4000); };
// Les cibles de la feuille ouverte : chaque bouton, champ, lien ≥ 44 px de haut (ou de large pour un rond).
const cibles = (pg) => pg.evaluate(() => { const f = document.querySelector('[data-ia-feuille]'); if (!f) return ['pas de feuille']; return [...f.querySelectorAll('button, input:not([type=file]):not([type=checkbox]), summary, label.ia-case')].filter((e) => e.getClientRects().length && !e.closest('.ia-cache')).map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.height >= 43.5 ? null : `${e.tagName.toLowerCase()}[${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}] ${r.height.toFixed(1)} px (min ${cs.minHeight}, transform ${cs.transform})`; }).filter(Boolean); });
const lireLS = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const png = () => { // un PNG 2×2 valide (le ticket « photographié »)
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const TOUTES = [[{ width: 390, height: 844 }, false], [{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false], [{ width: 1512, height: 950 }, true]];
    const voulues = process.env.BANC_TAILLES ? process.env.BANC_TAILLES.split(',') : null;   // ex. « 390,1512-sombre »
    for (const [vp, sombre] of TOUTES.filter(([v, s]) => !voulues || voulues.includes(`${v.width}${s ? '-sombre' : ''}`))) {
      const tel = vp.width < 600; const TT = `[${vp.width}${sombre ? ' sombre' : ''}]`; const suf = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${vp.width} px${sombre ? ' · sombre' : ' · clair'}`);
      const { ctx, pg, errs, ecrits, SIRI } = await preparer(b, vp, { sombre });
      const taper = async (sel, t) => { const l = pg.locator(sel).first(); if (tel) await l.tap(); else await l.click(); await l.fill(''); await pg.keyboard.type(t, { delay: 15 }); };
      const toucher = async (sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (tel) await l.tap(); else await l.click(); };

      // ── 160 · vente en main propre ──────────────────────────────────────
      await essaie('vente main', async () => {
        if (!tel) {   // la porte ⌘K : « vendu 124 »
          await pg.locator('body').click({ position: { x: 5, y: 400 } }).catch(() => {});
          await pg.keyboard.press('ControlOrMeta+k');
          await attendre(pg, () => !!document.querySelector('[data-recherche-champ]'));
          await pg.keyboard.type('vendu 124', { delay: 20 });
          const act = await attendre(pg, () => !!document.querySelector('[data-recherche-action="vente-main-num"][data-recherche-num="124"]'), null, 6000);
          dit(act, `${TT} ⌘K « vendu 124 » ⇒ l’action « N°124 vendu en main propre »`);
          if (act) await pg.locator('[data-recherche-action="vente-main-num"]').first().click();
        } else await ouvrir(pg, 'vente-main');
        const f = await attendre(pg, () => !!document.querySelector('[data-ia-feuille="vente-main"]'));
        dit(f, `${TT} la feuille « Vente en main propre » s’ouvre`);
        if (tel) await taper('[data-ia-recherche]', '124');
        const une = await attendre(pg, () => document.querySelector('[data-ia-etape]')?.getAttribute('data-ia-etape') === 'prix' && !!document.querySelector('[data-ia-paire="9124"]'));
        const focus = await pg.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-ia-recherche'));
        dit(une, `${TT} « 124 » ⇒ LA paire N°124 (identité), le prix demandé`);
        if (tel) dit(focus, `${TT} la frappe du N° n’est pas volée par le champ du prix`);
        await pg.screenshot({ path: path.join(SHOTS, `vente-numero-${suf}.png`) });
        await taper('[data-ia-prix]', '45');
        await toucher('[data-ia-paiement-choix="virement"]');
        const lib = await pg.evaluate(() => document.querySelector('[data-ia-valider]').textContent);
        dit(/45/.test(lib), `${TT} le bouton plein dit le prix (« Vendue · 45 € »)`, lib);
        dit((await cibles(pg)).length === 0, `${TT} cibles ≥ 44 px`, (await cibles(pg)).join(' ; '));
        dit((await debord(pg)) <= 1, `${TT} aucun débordement`);
        await pg.screenshot({ path: path.join(SHOTS, `vente-prix-${suf}.png`) });
        await toucher('[data-ia-valider]');
        const ok = await attendre(pg, ([a]) => { try { const d = JSON.parse(localStorage.getItem('vrm_cycle_decisions') || '{}')['9124']; const v = JSON.parse(localStorage.getItem('vinted_annonces_vendues') || '[]'); return d && d.choix === 'vendu-main' && d.montant === 45 && d.paiement === 'virement' && d.date === a && d.numero === '124' && v.includes('9124'); } catch (_) { return false; } }, [AUJ], 9000);
        dit(ok, `${TT} « Vendue » ⇒ vendue en main propre 45 €, virement, datée du jour, sortie du stock (identité 9124, N° gardé)`, JSON.stringify(await lireLS(pg, 'vrm_cycle_decisions')));
        const fait = await attendre(pg, () => !!document.querySelector('[data-ia-vente-faite="9124"]'));
        const pil = await pg.evaluate(() => /Annuler/.test(document.body.innerText));
        dit(fait && pil, `${TT} « N°124 vendu en main propre · 45 € » et « Annuler » offert`);
        const dl = pg.waitForEvent('download', { timeout: 15000 }).catch(() => null);
        await toucher('[data-ia-recu]');
        const d = await dl;
        let entete = '';
        if (d) { const p = await d.path(); entete = p ? fs.readFileSync(p).slice(0, 5).toString() : ''; }
        dit(d && /^recu-MP-\d{8}-124\.pdf$/.test(d.suggestedFilename()) && entete === '%PDF-', `${TT} le reçu PDF se télécharge`, d ? d.suggestedFilename() + ' ' + entete : 'aucun téléchargement');
        await pg.screenshot({ path: path.join(SHOTS, `vente-faite-${suf}.png`) });
        await toucher('[data-ia-nouvelle]');
        await taper('[data-ia-recherche]', '124');
        dit(await attendre(pg, () => !!document.querySelector('[data-ia-etat="deja"]')), `${TT} N°124 retapé ⇒ « déjà sorti du stock »`);
        await taper('[data-ia-recherche]', '88');
        const deux = await attendre(pg, () => document.querySelector('[data-ia-etat="plusieurs"]') && document.querySelectorAll('[data-ia-paire]').length === 2 && document.querySelectorAll('.sb-plaque.is-double').length === 2 && !document.querySelector('[data-ia-prix]'));
        dit(deux, `${TT} N°88 porté par deux paires ⇒ la question, deux lignes, plaque rouge, aucun prix demandé`);
        await pg.screenshot({ path: path.join(SHOTS, `vente-double-${suf}.png`) });
        await toucher('[data-ia-paire="9881"]');
        dit(await attendre(pg, () => !!document.querySelector('[data-ia-prix]') && !!document.querySelector('[data-ia-paire="9881"]')), `${TT} SON toucher choisit (9881), puis le prix`);
        await fermer(pg);
      });

      // ── 159 · dépense en photo ──────────────────────────────────────────
      await essaie('dépense', async () => {
        const avant = JSON.stringify(await lireLS(pg, 'vrm_compta'));
        const n0 = ecrits.length;
        await ouvrir(pg, 'depense-photo');
        dit(await attendre(pg, () => !!document.querySelector('[data-ia-feuille="depense-photo"] [data-ia-photo]')), `${TT} la feuille « Dépense en photo » s’ouvre sur « Prendre le ticket en photo »`);
        await pg.screenshot({ path: path.join(SHOTS, `depense-ouverte-${suf}.png`) });
        await pg.locator('[data-ia-ticket-fichier]').setInputFiles({ name: 'ticket.png', mimeType: 'image/png', buffer: png() });
        const lu = await attendre(pg, () => document.querySelector('[data-ia-note-lecture]')?.getAttribute('data-ia-note-lecture') === 'lu', null, 15000);
        const champs = await pg.evaluate(() => ({ m: document.querySelector('[data-ia-montant]')?.value, d: document.querySelector('[data-ia-date]')?.value }));
        dit(lu && champs.m === '12,50' && champs.d === HIER, `${TT} ticket lu sur la page : 12,50 € et la date du ticket pré-remplis`, JSON.stringify(champs));
        dit(JSON.stringify(await lireLS(pg, 'vrm_compta')) === avant && !ecrits.slice(n0).some((e) => /depense_ticket_/.test(JSON.stringify(e))), `${TT} RIEN n’est rangé avant son clic (ni dépense, ni photo)`);
        await toucher('[data-ia-cat="Envois"]');
        dit((await cibles(pg)).length === 0, `${TT} cibles ≥ 44 px`, (await cibles(pg)).join(' ; '));
        dit((await debord(pg)) <= 1, `${TT} aucun débordement`);
        await pg.screenshot({ path: path.join(SHOTS, `depense-lue-${suf}.png`) });
        await toucher('[data-ia-enregistrer]');
        const range = await attendre(pg, () => { try { const c = JSON.parse(localStorage.getItem('vrm_compta') || '{}'); const d = c.depenses && c.depenses[0]; return d && d.montant === 12.5 && d.cat === 'Envois' && d.ticket === true && c.depenses.length === 2; } catch (_) { return false; } }, null, 9000);
        dit(range, `${TT} « Enregistrer » ⇒ la dépense dans \`vrm_compta.depenses\` (12,50 €, Envois, photo jointe), l’ancienne gardée`, JSON.stringify(await lireLS(pg, 'vrm_compta')));
        dit(ecrits.slice(n0).some((e) => /app_data/.test(e.url) && JSON.stringify(e.corps).includes('depense_ticket_')), `${TT} la photo part dans SA ligne \`depense_ticket_…\``);
        const fait = await attendre(pg, () => !!document.querySelector('[data-ia-depense-faite]'));
        const txt = await pg.evaluate(() => document.querySelector('[data-ia-depense-faite]')?.innerText || '');
        dit(fait && /16,50/.test(txt.replace(/\s/g, ' ')), `${TT} « noté » et le mois dit (2 dépenses, 16,50 €)`, txt);
        await pg.screenshot({ path: path.join(SHOTS, `depense-faite-${suf}.png`) });
        // Lecture ratée ⇒ saisie à la main.
        await toucher('[data-ia-autre]');
        await pg.evaluate(() => { window.__banc.texte = ''; });
        await pg.locator('[data-ia-ticket-fichier]').setInputFiles({ name: 'flou.png', mimeType: 'image/png', buffer: png() });
        const rate = await attendre(pg, () => ['rate', 'rien'].includes(document.querySelector('[data-ia-note-lecture]')?.getAttribute('data-ia-note-lecture')), null, 60000);
        const m2 = await pg.evaluate(() => document.querySelector('[data-ia-montant]')?.value);
        dit(rate && m2 === '', `${TT} lecture ratée ⇒ le montant reste vide, la saisie à la main est proposée`, String(m2));
        await pg.screenshot({ path: path.join(SHOTS, `depense-ratee-${suf}.png`) });
        await pg.evaluate(() => { window.__banc.texte = null; });
        await fermer(pg);
      });

      // ── 162 · partager en image (depuis la fiche N°124) ─────────────────
      await essaie('image', async () => {
        // La loupe « ouvrir 124 » ⇒ l'action « Ouvrir N°124 » ⇒ la fiche de la paire.
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:fiche-article', { detail: 'ouvrir 124' })));
        const act = await attendre(pg, () => !!document.querySelector('[data-recherche-action="ouvrir-num"][data-recherche-num="124"]'), null, 8000);
        if (act) await pg.locator('[data-recherche-action="ouvrir-num"]').first().click();
        let ok = await attendre(pg, () => !!document.querySelector('[data-fiche-partager-image]'), null, 10000);
        if (!ok) await pg.screenshot({ path: path.join(SHOTS, `fiche-sans-partage-${suf}.png`) });
        dit(ok, `${TT} la fiche N°124 porte « Partager en image »`);
        if (ok) await pg.locator('[data-fiche-partager-image]').first().click();
        else await ouvrir(pg, 'partage-image', { paire: { titre: 'Asics Gel-Kayano 14 argent', taille: '43', prix: 90, num: '124' } });
        const pret = await attendre(pg, () => document.querySelector('[data-ia-feuille="partage-image"] [data-ia-pret="1"]') || document.querySelector('[data-ia-pret="1"]'), null, 12000);
        const dim = await pg.evaluate(() => { const c = document.querySelector('[data-ia-toile]'); return c ? [c.width, c.height] : null; });
        dit(pret && dim && dim[0] === 1080 && dim[1] === 1920, `${TT} story : toile 1080×1920`, JSON.stringify(dim));
        await pg.screenshot({ path: path.join(SHOTS, `image-story-${suf}.png`) });
        await toucher('[data-ia-format-choix="carre"]');
        const dim2 = await attendre(pg, () => { const c = document.querySelector('[data-ia-toile]'); return c && c.width === 1080 && c.height === 1080 && document.querySelector('[data-ia-pret="1"]'); });
        dit(dim2, `${TT} carré : toile 1080×1080`);
        const avecNum = await pg.$('[data-ia-avec-num]');
        dit(!!avecNum && !(await pg.evaluate(() => document.querySelector('[data-ia-avec-num]').checked)), `${TT} le N° est une case, décochée par défaut`);
        dit((await cibles(pg)).length === 0, `${TT} cibles ≥ 44 px`, (await cibles(pg)).join(' ; '));
        dit((await debord(pg)) <= 1, `${TT} aucun débordement`);
        await pg.screenshot({ path: path.join(SHOTS, `image-carre-${suf}.png`) });
        await toucher('[data-ia-partager]');
        const p = await attendre(pg, () => window.__banc.partages.length > 0, null, 8000);
        const pp = await pg.evaluate(() => window.__banc.partages[0] || null);
        dit(p && pp.type === 'image/png' && pp.w === 1080 && pp.h === 1080 && /1080x1080\.png$/.test(pp.nom) && pp.taille > 5000, `${TT} la feuille de partage reçoit un PNG 1080×1080`, JSON.stringify(pp));
        const texte = await pg.evaluate(() => document.querySelector('[data-ia-feuille="partage-image"]')?.innerText || '');
        dit(!/37/.test(texte), `${TT} la feuille ne montre aucun prix d’achat`);
        await fermer(pg);
        await pg.keyboard.press('Escape').catch(() => {});
      });

      // ── 161 · Paramètres → Siri ─────────────────────────────────────────
      await essaie('siri', async () => {
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:sante-aller', { detail: { reglage: 'raccourcis-siri' } })));
        let vu = await attendre(pg, () => { const e = document.querySelector('[data-siri-creer]'); return e && e.getClientRects().length; }, null, 12000);
        if (!vu) { const o = pg.locator('[data-sous-ouvrir="raccourcis-siri"]').first(); if (await o.count()) { await o.click().catch(() => {}); vu = await attendre(pg, () => { const e = document.querySelector('[data-siri-creer]'); return e && e.getClientRects().length; }, null, 8000); } }
        dit(vu, `${TT} Paramètres → Siri : « Créer mon jeton Siri »`);
        await pg.locator('[data-siri-jeton]').first().scrollIntoViewIfNeeded().catch(() => {});
        await pg.screenshot({ path: path.join(SHOTS, `siri-${suf}.png`) });
        await toucher('[data-siri-creer]');
        const liens = await attendre(pg, ([j]) => { const l = [...document.querySelectorAll('[data-siri-lien]')]; return l.length === 3 && l.every((e) => e.innerText.includes(j) && /mode=siri&q=(vendu|retirer|envoyer)/.test(e.innerText)); }, [SIRI]);
        dit(liens, `${TT} trois liens (vendu, retirer, envoyer) portent le jeton, montrés une fois`);
        await pg.locator('[data-siri-liens]').first().scrollIntoViewIfNeeded().catch(() => {});
        await pg.screenshot({ path: path.join(SHOTS, `siri-liens-${suf}.png`) });
        const ls = await pg.evaluate((j) => Object.keys(localStorage).some((k) => String(localStorage.getItem(k)).includes(j)), SIRI);
        dit(!ls, `${TT} le jeton n’est rangé nulle part sur l’appareil`);
      });
      dit((await debord(pg)) <= 1, `${TT} aucun débordement de la page`);
      dit(!errs.length, `${TT} aucune erreur de page`, errs.join(' | ').slice(0, 300));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a pu tourner', String(e && e.stack || e).slice(0, 400)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) en échec — captures : ${SHOTS}` : `\nTout est vert — captures (À REGARDER) : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
