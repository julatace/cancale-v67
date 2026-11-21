// ── BANC : L'ATELIER « ACHAT ARRIVÉ → EN LIGNE » (15 nov.) ───────────────────
// Julien (« vas-y fais tout ») : quand un achat est retiré, UN écran enchaîne N° · case ·
// photos · prix d'achat · fiche · publier, avec une progression ; chaque étape se passe ;
// on reprend là où il s'est arrêté ; rien n'est écrit sans son geste.
// Récit : docs/passation/2026-11-15-atelier-arrivee.md · règle : src/atelierArrivee.js.
//
// Données INVENTÉES (dépôt public), la base du banc rangement-guide : un achat Vinted au
// point relais (tx 9301, « Nike Air Max 90 blanche taille 43 », 38 €), « Étagère A » 3 × 2
// dont deux cases prises (B230 et N°7), le pool 1…7, 9, 12 (des TROUS en 8, 10, 11).
// Exigé, à 390 tactile (clair) et 1512 (sombre) :
//   (20 nov., lot arrivee-scan : le départ a changé — « J'ai retiré » ouvre l'écran d'arrivée, l'atelier fait la suite)
//   W1 « J'ai retiré » ⇒ l'écran d'arrivée de 9301 : N°13 proposé (jamais un trou), la première case libre (niveau 1 ·
//      case 3) qui respire, RIEN d'écrit ;
//   W2 une case prise ne réagit pas ; « Ranger ici » ⇒ la fiche de l'ARTICLE N°13 (liée à 9301), N°13 au pool, dans sa
//      case, aucun prix ; « Rangé · N°13 » ;
//   W3 « Terminer » ⇒ Ma journée « 1 paire à finir » ⇒ l'atelier reprend AUX PHOTOS ;
//   W4 photos « Plus tard » ⇒ le prix : « 38 € · Article seul » (le prix LU de CET achat) ;
//      fermer ⇒ rien d'autre d'écrit ;
//   W5 Ma journée : « 1 paire à finir » ⇒ « Reprendre » rouvre l'atelier AU PRIX (la reprise) ;
//   W6 « Garder 38 € » ⇒ le coût de N°13 = 38,00 ; la fiche : titre, marque (Nike), couleur
//      (blanc) de l'ACHAT, prix de vente VIDE, la note ; « Enregistrer » ⇒ `completeAt` ;
//   W7 publier : « Créer sur Vinted » ; « Plus tard » ⇒ le bilan ; Ma journée ne rappelle plus rien ;
//   à chaque étape : un seul bouton plein, cibles ≥ 44 px (tactile), rien ne déborde de la
//   feuille, aucune clé de traduction brute ; aucune erreur de page. Captures (SHOTS=dossier).
// `BANC_DIST=<dist>` : un autre build (l'arbre de départ : il doit être ROUGE).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData, metaDe, filtreData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4393);
const SHOTS = process.env.SHOTS || '';
const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();

const ACHATS = [
  { transaction_id: 9301, conversation_id: 7001, title: 'Nike Air Max 90 blanche taille 43', price: { amount: '38', currency_code: 'EUR' },
    photo: { url: 'https://images1.vinted.net/t/9301_d/f800/9301.jpeg' }, status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', date: ilYa(4) },
];
const RELAIS = { '9301': { code: '012345', lieu: 'Relais exemple, 1 rue de l’Exemple, 35000 Exempleville', transporteur: 'mondialrelay', at: new Date(MAINTENANT).toISOString() } };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const MEUBLES = [{ id: 'mA', name: 'Étagère A', cols: 3, rows: 2 }];
const SLOTS = { B230: { m: 'mA', i: 0 }, 7: { m: 'mA', i: 1 } };
const POOL = [1, 2, 3, 4, 5, 6, 7, 9, 12];
const mainData = (sombre) => ({ vinted_dark: !!sombre, vinted_pickup_done: {}, vrm_colis_collected: [], vrm_colis_collected_at: {}, vrm_meubles: MEUBLES, vrm_slots: SLOTS, vinted_used_numeros: POOL });
const rows = (sombre) => [
  { id: 'main', data: mainData(sombre) },
  { id: 'panel_colis_relais', data: RELAIS },
  { id: 'panel_num_reserves', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (!c && d !== undefined ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
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
    if (src === 'meta') { out[alias] = metaDe(row.data); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};
const lireLocal = (pg) => pg.evaluate(() => { const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } };
  return { fiches: j('vrm_fiches_neuves') || {}, slots: j('vrm_slots') || {}, pool: (j('vinted_used_numeros') || []).map(String), couts: j('vinted_buyprice_by_num') || {}, marques: j('vrm_atelier_arrivee') || {} }; });
const attendre = async (fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 200)); } return v; };
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png'), timeout: 120000 }).catch((e) => console.log('   (capture ' + nom + ' : ' + String(e.message).split('\n')[0].slice(0, 80) + ')')); };

// La mesure d'une étape, DANS la page : la feuille de l'atelier seulement.
function mesureEtape(tactile) {
  const f = document.querySelector('[data-atelier-arrivee]');
  if (!f) return null;
  const feuille = f.closest('[role="dialog"]') || f;
  const R = feuille.getBoundingClientRect();
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nom = (e) => (e.getAttribute('data-aa-suivant') != null ? 'suivant' : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(/\s+/).slice(0, 2).join('.') : '') + ' « ' + (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30) + ' »';
  const pleins = [...feuille.querySelectorAll('.vrm-b-plein, .sb-btn-plein')].filter(vis).map(nom);
  const cibles = tactile ? [...feuille.querySelectorAll('button, a[href], input, textarea, select, [role="button"]')].filter(vis).filter((e) => { // taille de MISE EN PAGE (offset*) : un bouton sous le doigt (:active, scale .97) n'est pas une cible trop petite.
    const r = { width: e.offsetWidth || e.getBoundingClientRect().width, height: e.offsetHeight || e.getBoundingClientRect().height }; return Math.min(r.width, r.height) < 43.5 && !e.closest('.vrm-ra-grille') ? true : false; }).map((e) => `${nom(e)} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`) : [];
  const debord = [...feuille.querySelectorAll('*')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return (r.right > R.right + 1.5 || r.left < R.left - 1.5) && !e.closest('.vrm-ra-defile, .vrm-ra-meubles'); }).slice(0, 5).map(nom);
  const texte = feuille.innerText || '';
  const cles = (texte.match(/\b(?:arr|acc|lt|ranger|atelier|reglages)\.[a-zA-Z.-]+\b/g) || []).slice(0, 5);
  const violet = [...feuille.querySelectorAll('*')].filter(vis).some((e) => { const c = getComputedStyle(e).color; const m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); if (!m) return false; const [r, g, b] = [+m[1], +m[2], +m[3]]; return b > 150 && r > 110 && g < 90; });
  const prog = f.querySelector('[data-aa-prog]');
  // Le corps de l'étape se VOIT (une opacité figée à 0 passait tous les autres contrôles : capture 1512 sombre).
  const corps = f.querySelector('[data-aa-corps]');
  const opaciteCorps = corps ? (() => { let o = 1; for (let e = corps; e && e !== feuille.parentElement; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return Math.round(o * 100) / 100; })() : 1;
  return { courante: prog ? prog.getAttribute('data-aa-courante') : '', etapes: [...f.querySelectorAll('[data-aa-etape]')].map((x) => x.getAttribute('data-aa-etape') + ':' + x.getAttribute('data-aa-etat')),
    reprise: (f.querySelector('[data-aa-reprise]') || {}).getAttribute ? f.querySelector('[data-aa-reprise]').getAttribute('data-aa-reprise') : '',
    pleins, cibles, debord, cles, violet, opaciteCorps, page: document.documentElement.scrollWidth - window.innerWidth };
}

async function passe(b, vp, sombre) {
  const T = `${vp.width}px${sombre ? ' sombre' : ''}`;
  const tactile = vp.width < 600;
  const suf = `${vp.width}${sombre ? '-sombre' : '-clair'}`;
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', colorScheme: sombre ? 'dark' : 'light', ...(tactile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sb)); localStorage.setItem('vrm_conseils_appareil', JSON.stringify({ coupe: true })); } catch (_) {} }, sombre);
  await pg.route('**/images1.vinted.net/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)(?!.*\/rest\/v1\/)(?!.*images1\.vinted)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const R = rows(sombre);
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(R.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(R.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(R.filter((r) => re.test(r.id) && filtreData(u)(r)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  const juge = async (etape, attendue) => {
    const m = await pg.evaluate(mesureEtape, tactile);
    if (!m) { dit(false, `${T} ${etape} : l’atelier est ouvert`); return null; }
    dit(!attendue || m.courante === attendue, `${T} ${etape} : l’étape courante est « ${attendue} »`, m.courante);
    dit(m.pleins.length <= 1, `${T} ${etape} : un seul bouton plein`, m.pleins);
    dit(m.opaciteCorps >= 0.99, `${T} ${etape} : le corps de l’étape se voit (opacité ${m.opaciteCorps})`, m.opaciteCorps);
    if (tactile) dit(!m.cibles.length, `${T} ${etape} : cibles ≥ 44 px`, m.cibles);
    dit(!m.debord.length && m.page <= 1, `${T} ${etape} : rien ne déborde (feuille, page)`, { debord: m.debord, page: m.page });
    dit(!m.cles.length && !m.violet, `${T} ${etape} : aucune clé brute, pas de violet`, { cles: m.cles, violet: m.violet });
    return m;
  };
  const clic = async (sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); if (tactile) await l.tap(); else await l.click(); };

  await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
  const RETIRE = '[data-colis-retire], .vrm-pickup-collect';
  await pg.locator(`[data-cc-colonne="retirer"] .vrm-rpf-ouvrir, ${RETIRE}`).first().waitFor({ timeout: 40000 });
  if (!(await pg.locator(RETIRE).count())) await pg.locator('[data-cc-colonne="retirer"] .vrm-rpf-ouvrir').first().click();
  await pg.locator(RETIRE).first().waitFor({ timeout: 12000 }).catch(async (e) => { await capture(pg, `atelier-${suf}-debug`); throw e; });
  const avant = await lireLocal(pg);
  await pg.locator(RETIRE).first().click();

  // (20 nov., lot arrivee-scan) NOUVEAU DÉPART : « J'ai retiré » ouvre l'ÉCRAN D'ARRIVÉE de CET achat (src/ArriveeAchat.jsx :
  // N° et case en UN geste, « Ranger ici ») ; l'atelier en six étapes reste pour la SUITE (photos, prix, fiche, publier),
  // rouvert par « N paires à finir » (docs/passation/2026-11-20-arrivee-scan.md §3).
  const arv = () => pg.evaluate(() => { const a = (q, k) => { const e = document.querySelector(q); return e ? e.getAttribute(k) : null; };
    return document.querySelector('[data-arv]') ? { tx: a('[data-arv]', 'data-arv-tx'), etat: a('[data-arv-etat]', 'data-arv-etat'), numeros: a('[data-arv-numeros]', 'data-arv-numeros'),
      ici: a('[data-arv-ici]', 'data-arv-ici'), fait: a('[data-arv-fait]', 'data-arv-fait'), vise: !!document.querySelector('[data-arv] .sm-case.is-vise') } : null; });
  const mesureArv = (tact) => { const f = document.querySelector('[data-arv]'); if (!f) return null; const R = f.getBoundingClientRect(); const racine = f.closest('[role="dialog"]') || f;
    const vis = (e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 1 && r.height > 1 && st.visibility !== 'hidden' && st.display !== 'none'; };
    const nom = (e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 30);
    return { pleins: [...racine.querySelectorAll('[data-n-variante="plein"]')].filter(vis).map(nom),
      cibles: tact ? [...racine.querySelectorAll('button, a[href], input, [role="button"]')].filter(vis).filter((e) => !e.closest('.sm-meuble') && Math.min(e.offsetWidth || 99, e.offsetHeight || 99) < 43.5).map((e) => nom(e) + ' ' + e.offsetWidth + '×' + e.offsetHeight) : [],
      debord: [...f.querySelectorAll('*')].filter(vis).filter((e) => { if (e.closest('.arv-dessin, .arv-meubles')) return false; const r = e.getBoundingClientRect(); return r.right > R.right + 1.5 || r.left < R.left - 1.5; }).slice(0, 4).map((e) => String(e.className) + ' ' + nom(e)),
      cles: ((racine.innerText || '').match(/\b(?:arv|scan|arr|sm|aa)\.[a-zA-Z.]+\b/g) || []).slice(0, 4), page: document.documentElement.scrollWidth - window.innerWidth }; };
  const jugeArv = async (etape) => { const m = await pg.evaluate(mesureArv, tactile); if (!m) { dit(false, `${T} ${etape} : l’écran d’arrivée est là`); return; }
    dit(m.pleins.length <= 1, `${T} ${etape} : un seul bouton plein`, m.pleins);
    if (tactile) dit(!m.cibles.length, `${T} ${etape} : cibles ≥ 44 px`, m.cibles);
    dit(!m.debord.length && m.page <= 1, `${T} ${etape} : rien ne déborde (feuille, page)`, m);
    dit(!m.cles.length, `${T} ${etape} : aucune clé brute`, m.cles); };

  // W1 — l'écran d'arrivée de CET achat : N°13 proposé, sa case proposée, RIEN d'écrit.
  const w1 = await attendre(async () => { const e = await arv(); return e && e.etat !== 'lecture' && e.numeros ? e : null; }, 20000);
  dit(!!w1, `${T} W1 · « J’ai retiré » ouvre l’écran d’arrivée`);
  if (!w1) { await capture(pg, `atelier-${suf}-echec`); dit(!errs.length, `${T} aucune erreur de page`, errs[0]); await ctx.close(); return; }
  dit(w1.tx === '9301' && w1.numeros === '13', `${T} W1 · l’achat 9301, N°13 proposé (après 12, jamais un trou)`, w1);
  dit(w1.ici === 'mA:2' && w1.vise, `${T} W1 · sa case : la première LIBRE (niveau 1 · case 3), qui respire`, w1);
  const p1 = await lireLocal(pg);
  dit(!Object.keys(p1.fiches).length && !p1.pool.includes('13') && JSON.stringify(p1.slots) === JSON.stringify(avant.slots) && !Object.keys(p1.couts).length, `${T} W1 · rien n’est écrit avant SON geste`, p1);
  await jugeArv('W1 arrivée');
  await pg.waitForTimeout(1300); await capture(pg, `atelier-${suf}-1-arrivee`);

  // W2 — une case prise ne réagit pas ; « Ranger ici » : la fiche de l'ARTICLE N°13 (liée à 9301), son N° au pool, sa case ;
  // aucun prix d'achat (sans reçu, l'article seul n'est pas le payé : décision « 2 oui »).
  await pg.locator('[data-arv] [data-sm-case="mA:0"]').first().click({ force: true }).catch(() => {});
  const apresPrise = await arv();
  dit(!!apresPrise && apresPrise.ici === 'mA:2', `${T} W2 · toucher une case prise ne change rien`, apresPrise);
  await clic('[data-arv-ranger]');
  const w2 = await attendre(async () => { const l = await lireLocal(pg); const f = Object.values(l.fiches)[0]; return f && l.slots['13'] ? { l, f } : null; }, 10000);
  dit(!!w2 && w2.f.numero === '13' && w2.f.achat && w2.f.achat.tx === '9301' && w2.l.pool.includes('13'), `${T} W2 · « Ranger ici » : la fiche de l’article N°13 (liée à 9301), N°13 au pool`, w2 && w2.f);
  dit(!!w2 && w2.l.slots['13'].m === 'mA' && w2.l.slots['13'].i === 2 && w2.l.slots.B230 && w2.l.slots['7'], `${T} W2 · N°13 dans sa case (niveau 1 · case 3), les autres cases intactes`, w2 && w2.l.slots);
  dit(!!w2 && w2.l.couts['13'] == null && w2.f.prixAchat == null, `${T} W2 · aucun prix d’achat écrit sans SON tap`, w2 && w2.l.couts);
  const pil2 = await attendre(() => pg.evaluate(() => { const p = document.querySelector('[data-pilule-annuler]'); return p ? (p.getAttribute('aria-label') || p.textContent || '') : null; }), 4000);
  dit(!!pil2 && /13/.test(pil2), `${T} W2 · la pilule « Annuler » dit N°13`, pil2);
  const w2f = await attendre(async () => { const e = await arv(); return e && e.fait ? e : null; }, 5000);
  dit(!!w2f && w2f.fait === '13', `${T} W2 · l’écran dit « Rangé · N°13 »`, w2f);
  await jugeArv('W2 rangé');
  await pg.waitForTimeout(500); await capture(pg, `atelier-${suf}-2-range`);

  // W3 — « Terminer », puis Ma journée « 1 paire à finir » ⇒ l'atelier, AUX PHOTOS (N° et case faits par l'arrivée).
  await clic('[data-arv-fermer]');
  await attendre(() => pg.evaluate(() => !document.querySelector('[data-arv]')), 6000);
  await pg.waitForTimeout(1200);
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }).catch(async () => { await pg.waitForTimeout(1500); await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' }); });
  const carte3 = await attendre(() => pg.evaluate(() => { const c = document.querySelector('[data-job="atelier-arrivee"]'); return c ? c.getAttribute('data-n') : null; }), 25000);
  dit(carte3 === '1', `${T} W3 · Ma journée : « 1 paire à finir » (l’article rangé attend ses photos)`, carte3);
  if (carte3) await pg.locator('[data-job="atelier-arrivee"]').first().click();
  else await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:atelier-arrivee', { detail: {} })));
  const w3e = await attendre(() => pg.evaluate(() => { const p = document.querySelector('[data-atelier-arrivee] [data-aa-prog]'); return p && p.getAttribute('data-aa-courante') === 'photos' ? p.getAttribute('data-aa-prog') : null; }), 15000);
  dit(!!w3e, `${T} W3 · l’atelier reprend aux photos (N° et case faits)`, w3e);
  const w3l = await lireLocal(pg);
  dit(w3l.couts['13'] == null && w3l.slots['13'] && w3l.slots['13'].i === 2, `${T} W3 · rien de changé par la reprise (case gardée, aucun prix)`, { cout: w3l.couts['13'], slot: w3l.slots['13'] });
  await juge('W3 photos', 'photos');
  await pg.waitForTimeout(500); await capture(pg, `atelier-${suf}-3-photos`);

  // W4 — photos « Plus tard », le prix LU de CET achat ; fermer.
  await clic('[data-aa-plus-tard="photos"]');
  const w4 = await attendre(() => pg.evaluate(() => { const c = document.querySelector('[data-aa-corps="prix"]'); return c ? { v: c.getAttribute('data-aa-prix-propose'), s: c.getAttribute('data-aa-prix-source'), t: c.innerText } : null; }), 8000);
  dit(!!w4 && w4.v === '38,00' && w4.s === 'achat' && /Article seul/.test(w4.t), `${T} W4 · le prix LU de l’achat 9301 : 38 €, « Article seul » (sans port ni frais : dit)`, w4);
  const p4 = await lireLocal(pg);
  dit(p4.couts['13'] == null && p4.marques && Object.values(p4.marques).some((m) => m && m.e && m.e.photos === 'passe'), `${T} W4 · « Plus tard » noté (photos), aucun prix écrit sans « Garder »`, p4.marques);
  await juge('W4 prix', 'prix');
  await pg.waitForTimeout(300); await capture(pg, `atelier-${suf}-4-prix`);
  await pg.keyboard.press('Escape');
  await attendre(() => pg.evaluate(() => !document.querySelector('[data-atelier-arrivee]')), 5000);

  // W5 — Ma journée : « 1 paire à finir » ⇒ la reprise au prix.
  // Fermer la feuille passe par l’historique (FermeAuRetour) : on laisse ce retour finir, puis on va à Ma journée (une fois de plus si la navigation a été coupée).
  await pg.waitForTimeout(1200);
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: "domcontentloaded" }).catch(async () => { await pg.waitForTimeout(1500); await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: "domcontentloaded" }); });
  const carte = await attendre(() => pg.evaluate(() => { const c = document.querySelector('[data-job="atelier-arrivee"]'); return c ? c.getAttribute('data-n') : null; }), 25000);
  dit(carte === '1', `${T} W5 · Ma journée : « 1 paire à finir »`, carte);
  await pg.waitForTimeout(600); await capture(pg, `atelier-${suf}-5-journee`);
  if (carte) {
    await pg.locator('[data-job="atelier-arrivee"]').first().click();
    const rep = await attendre(() => pg.evaluate(() => { const p = document.querySelector('[data-atelier-arrivee] [data-aa-prog]'); return p ? p.getAttribute('data-aa-courante') : null; }), 15000);
    dit(rep === 'prix', `${T} W5 · « Reprendre » rouvre l’atelier là où il s’est arrêté (le prix)`, rep);
  } else {
    await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:atelier-arrivee', { detail: {} })));
    await attendre(() => pg.evaluate(() => !!document.querySelector('[data-atelier-arrivee]')), 8000);
  }

  // W6 — « Garder 38 € », la fiche, « Enregistrer ».
  await clic('[data-aa-prix-garder]');
  const w6 = await attendre(async () => { const l = await lireLocal(pg); const f = Object.values(l.fiches)[0]; return l.couts['13'] != null && f && f.prixAchat != null ? l : null; }, 8000);
  dit(!!w6 && String(w6.couts['13']) === '38,00' && Object.values(w6.fiches)[0].prixAchat === 38, `${T} W6 · « Garder » : le coût de N°13 = 38,00, sur SON tap`, w6 && w6.couts);
  const fiche = await attendre(() => pg.evaluate(() => { const c = document.querySelector('[data-aa-corps="fiche"]'); if (!c) return null; const v = (k) => { const e = c.querySelector(`[data-aa-champ="${k}"] input, [data-aa-champ="${k}"] textarea`); return e ? e.value : null; };
    return { titre: v('titre'), marque: v('marque'), couleur: v('couleur'), prix: v('prix'), note: !!c.querySelector('[data-aa-note]') }; }), 8000);
  dit(!!fiche && fiche.titre === 'Nike Air Max 90 blanche taille 43' && fiche.marque === 'Nike' && /blanc/i.test(fiche.couleur || '') && fiche.prix === '' && fiche.note,
    `${T} W6 · la fiche : titre, marque, couleur de l’ACHAT ; prix de vente VIDE ; la note`, fiche);
  await juge('W6 fiche', 'fiche');
  await pg.waitForTimeout(300); await capture(pg, `atelier-${suf}-6-fiche`);
  await pg.locator('[data-aa-champ="prix"] input').fill('85');
  await clic('[data-aa-fiche-enregistrer]');
  const w6b = await attendre(async () => { const l = await lireLocal(pg); const f = Object.values(l.fiches)[0]; return f && f.completeAt ? f : null; }, 8000);
  dit(!!w6b && w6b.prix === 85 && w6b.marque === 'Nike', `${T} W6 · « Enregistrer la fiche » : son prix de vente (85), \`completeAt\``, w6b);

  // W7 — publier, « Plus tard », le bilan ; Ma journée ne rappelle plus rien.
  const w7 = await attendre(() => pg.evaluate(() => !!document.querySelector('[data-aa-creer-vinted]')), 8000);
  dit(!!w7, `${T} W7 · publier : « Créer sur Vinted » (le chemin existant)`);
  await juge('W7 publier', 'publier');
  await pg.waitForTimeout(300); await capture(pg, `atelier-${suf}-7-publier`);
  await clic('[data-aa-plus-tard="publier"]');
  const fin = await attendre(() => pg.evaluate(() => { const b = [...document.querySelectorAll('[data-aa-bilan]')]; return b.length ? b.map((x) => x.getAttribute('data-aa-bilan') + ':' + x.getAttribute('data-aa-etat')) : null; }), 8000);
  dit(!!fin && fin.join(',') === 'numero:fait,case:fait,photos:passe,prix:fait,fiche:fait,publier:passe', `${T} W7 · le bilan : fait / plus tard, étape par étape`, fin);
  await juge('W7 fin', '');
  await pg.waitForTimeout(300); await capture(pg, `atelier-${suf}-8-fin`);
  const plusRien = await attendre(() => pg.evaluate(() => !document.querySelector('[data-job="atelier-arrivee"]')), 6000);
  dit(!!plusRien, `${T} W7 · Ma journée ne rappelle plus cette paire (tout est fait ou passé)`);
  dit(!errs.length, `${T} aucune erreur de page`, errs[0]);
  await ctx.close();
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    const vues = (process.env.VUES || '390-clair,1512-sombre').split(',');
    for (const v of vues) { const [w, th] = v.split('-'); const vp = w === '390' ? { width: 390, height: 844 } : { width: 1512, height: 950 }; await essaie(`${v}`, () => passe(b, vp, th === 'sombre')); }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ atelier d’arrivée : ${ko} rouge(s), ${ok} vert(s).` : `\n✅ atelier d’arrivée : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
