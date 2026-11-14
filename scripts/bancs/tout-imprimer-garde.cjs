// Banc (11 nov., revue colis) : « TOUT IMPRIMER » NE DOIT JAMAIS ÊTRE AVALÉ PAR UN ÉCRAN CACHÉ.
// Depuis le lot DJ3, DEUX moteurs `Comptabilite only="bordereaux"` existent : la section « À expédier »
// de Ventes et la section « À retirer » d'Achats. Achats est un écran GARDÉ (src/ecransGardes.jsx) :
// caché, il reste monté (suspendu), et ses écoutes `window` posées par `useEffect` restent branchées.
// Scénario : ouvrir Achats, toucher « Ventes » dans la barre, puis ⌘K « Imprimer les bordereaux du
// jour » (src/annulerCommandes.js `imprimer-jour`) ⇒ la feuille « Tout imprimer » DOIT s'ouvrir sur
// Ventes, avec les 2 colis à envoyer. Rouge si l'écoute d'Achats, caché, consomme la demande.
// Données inventées (le même jeu que colis-a-leur-place.cjs). BANC_PORT 9241.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const RACINE = process.env.BANC_RACINE || path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9241);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 11, 10, 0, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const TITRE = 'Salomon XT-6 Black 42';
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const AENV = [[7201, 1, 4], [7202, 5, 1]];
// (11 nov., demandes de Julien) Une VRAIE longueur de titre (le titre doit se lire en entier) ;
// 7203 : à expédier chez Vinted (statut figé) MAIS déposée — son étiquette, captée par l'extension sans
// e-mail de bordereau, porte XW600000001TS (lu au cron : `vrm_bord_transporteurs`), et l'e-mail « Preuve de
// dépôt » de CE n° est arrivé. Elle n'est ni dans « Tout imprimer », ni dans le compteur (identité seule).
const TITRE_LONG = 'Nike Air Max 95 Icons Yellow Stone taille 41 très bon état boîte d’origine';
const TITRES = { 7201: TITRE, 7202: TITRE_LONG, 7203: 'Bottes Dr Martens 1460 noir taille 36' };
const DEPOSEE = 7203, SUIVI_DEPOSE = 'XW600000001TS';
const fmtLimite = (j) => { const d = new Date(MS + j * J); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} 23:59`; };
const track = (id, d) => ({ id, data: Object.assign({ type: 'suivi', receivedAt: ilYa(0.2), emailAt: ilYa(0.2), arriveLe: ilYa(0.2), consigne: false, account: 'compte_a' }, d) });
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [...AENV, [DEPOSEE, 2, 3]].map(([tx, j]) => ({ transaction_id: tx, title: TITRES[tx], price: { amount: '80.0', currency_code: 'EUR' }, status: 'Bordereau d’envoi envoyé au vendeur', transaction_user_status: 'needs_action', date: ilYa(j) })) } } },
  { id: 'harvest_111_label_' + DEPOSEE, data: { uid: '111', tx: String(DEPOSEE), capturedAt: ilYa(1.5), pdfB64: PDF_B64 } },
  { id: 'vrm_bord_transporteurs', data: { v: 1, pdf: { [DEPOSEE]: { t: 'chronopost', s: SUIVI_DEPOSE } } } },
  track('email_track_chronopost_' + SUIVI_DEPOSE, { carrier: 'chronopost', suivi: SUIVI_DEPOSE, status: 'transit', statusLabel: 'En transit', subject: 'Preuve de dépôt de votre colis', sens: 'sortant', receivedAt: ilYa(0.5), emailAt: ilYa(0.5), arriveLe: undefined }),
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [] } } },
  ...AENV.map(([tx, j, lim]) => ({ id: 'email_bord_' + tx, data: { type: 'bordereau', transaction: String(tx), uid: '111', account: 'compte_a', filename: `Bordereau-Vinted-${tx}.pdf`, modele: TITRES[tx], article: TITRES[tx], receivedAt: ilYa(j - 0.1), pdfB64: PDF_B64, suivi: '', transporteur: '', dateLimite: fmtLimite(lim) } })),
  track('email_track_mondialrelay_90000001', { carrier: 'mondialrelay', suivi: '90000001', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis 90000001 est disponible', code: '012345', lieu: 'TABAC DE LA HOULE, 2 Quai Gambetta, 35260 Cancale', limite: iso(MS + 6 * J).slice(0, 10) }),
  track('email_track_chronopost_XW123456789FR', { carrier: 'chronopost', suivi: 'XW123456789FR', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis est arrivé en relais Pickup', code: '654321', lieu: 'PRESSE DU PORT, 1 Rue du Port, 35260 Cancale', limite: iso(MS + 8 * J).slice(0, 10) }),
];
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
async function ouvrir(b, vp, sombre, lien) {
  const tel = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(() => { const o = URL.createObjectURL; URL.createObjectURL = function (x) { try { if (x && x.type === 'application/pdf') (window.__pdfs = window.__pdfs || []).push(x); } catch (_) {} return o.call(this, x); }; window.open = () => null; });
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', JSON.stringify(true)); localStorage.setItem('vinted_dark', JSON.stringify(s)); } catch (_) {} }, !!sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font', 'script'].includes(r.request().resourceType()) ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' })));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const h = { 'access-control-allow-origin': '*' };
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { ...h, 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: h, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: h, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(MS), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/^"|"$/g, '')); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  ctx.on('page', (p) => { if (p !== pg) p.close().catch(() => {}); });
  await pg.goto(`http://localhost:${PORT}/${lien}`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, tel };
}
// Ce que l'écran montre, mesuré DANS la page (éléments visibles seulement).
const mesure = (pg) => pg.evaluate(() => {
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const n = (q) => [...document.querySelectorAll(q)].filter(vis).length;
  const main = document.querySelector('.vrm-main') || document.body;
  const sec = document.querySelector('[data-colis-section]');
  const tache = document.querySelector('[data-tache]');
  // « En tête » : la section vient AVANT tout le reste du contenu propre de l'écran.
  const liste = document.querySelector('.vrm-market-space, .vrm-ventes-toutes, [data-ventes-toutes]');
  const avant = sec && liste ? !!(sec.compareDocumentPosition(liste) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
  return {
    tache: tache ? tache.getAttribute('data-tache') : null,
    section: sec && vis(sec) ? sec.getAttribute('data-colis-section') : null,
    nSections: n('[data-colis-section]'), avant,
    titre: sec ? (sec.querySelector('h2') || {}).textContent || '' : '',
    choixEnvoyer: n('[data-colis-onglet-choix="envoyer"]'), choixEnvoyes: n('[data-colis-onglet-choix="envoyes"]'), choixRetirer: n('[data-colis-onglet-choix="retirer"]'),
    cartesEnvoi: n('[data-bord-card]'), colonneRetirer: n('[data-cc-colonne="retirer"]'), outils: document.querySelectorAll('[data-colis-retraits="outils"]').length,
    imprimer: n('[data-colis-barre-btn="imprimer"]'), scanner: n('[data-colis-scanner]'), barres: n('[data-colis-barre]'), depot: n('[data-depot-ouvrir]'), relais: n('[data-relais-ouvrir]'),
    versColis: n('[data-ventes-vers-colis]') + n('[data-achats-vers-colis]'),
    h1Colis: [...document.querySelectorAll('h1')].filter(vis).some((h) => /^\s*Colis\s*$/.test(h.textContent || '')),
    navColis: n('[data-nav-entree="cat_bord"]'), navAchats: document.querySelectorAll('[data-nav-entree="achats"]').length,
    texte: main.innerText || '',
    codes: [...new Set([...document.querySelectorAll('[data-code-retrait]')].map((e) => e.getAttribute('data-code-retrait')).filter(Boolean))].sort(),
    pubEnv: JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'), pubRet: JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'),
    deb: document.documentElement.scrollWidth - window.innerWidth,
    // (11 nov.) Le titre de chaque colis : en entier (ni « … », ni coupé), jugé sur le RENDU.
    titres: [...document.querySelectorAll('.vrm-colis-section .vrm-colis-titre, .vrm-colis-section .vrm-rpf-titre, .vrm-tip [data-titre-entier]')].filter(vis).map((e) => { const cs = getComputedStyle(e); return { t: (e.textContent || '').trim().slice(0, 80), coupe: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2 || (cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap'), lignes: Math.round(e.getBoundingClientRect().height / (parseFloat(cs.lineHeight) || 18)) }; }),
    // (la liste des VENTES montre la vente 7203, c'est juste : seule la section des colis est jugée)
    deposee: document.querySelectorAll('.vrm-colis-section [data-bord-card*="7203"], [data-lot-ligne="7203"]').length + [...document.querySelectorAll('.vrm-colis-section')].filter((e) => (e.innerText || '').includes('Dr Martens 1460')).length,
    pretsImprimer: (document.querySelector('[data-colis-barre-btn="imprimer"]') || { getAttribute: () => null }).getAttribute('data-imprimer-prets'),
  };
});
const attendre = async (pg, q) => { await pg.waitForSelector(q, { timeout: 30000 }); await pg.waitForTimeout(1500); };

(async () => {
  try { srv.listen(PORT); } catch (_) {}
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 390, height: 844 }, true, '390-sombre']]) {
      console.log(`\n— ${nom}`);
      // TEMOIN=1 : le même geste sans passer par Achats (doit être vert sur toute version : prouve le banc).
      const temoin = process.env.TEMOIN === '1';
      const { ctx, pg, errs, tel } = await ouvrir(b, vp, sombre, temoin ? '?tab=journee' : '?tab=achats');
      await essaie('G ' + nom, async () => {
        await attendre(pg, temoin ? '[data-nav-entree="ventes"]' : '[data-tache="achats"] [data-achats-onglet]');
        // Le toucher de la barre (écran gardé réutilisé) : Ventes.
        const nav = pg.locator('[data-nav-entree="ventes"]').filter({ visible: true }).first();
        if (tel) await nav.tap(); else await nav.click();
        await attendre(pg, '[data-colis-barre-btn="imprimer"]:not([disabled])');
        const avant = await pg.evaluate(() => (document.querySelector('[data-tache]') || { getAttribute: () => null }).getAttribute('data-tache'));
        dit(avant === 'ventes', 'G Ventes est montré, « Tout imprimer » prêt', String(avant));
        // ⌘K « imprimer » ⇒ Entrée (le chemin de annuler-commandes.cjs).
        if (tel) { await pg.locator('.vrm-hdr-recherche, [data-recherche-ouvrir], [aria-label*="Rechercher"]').filter({ visible: true }).first().tap().catch(() => {}); }
        else { await pg.mouse.click(5, 300); await pg.keyboard.press('Control+K'); }
        await pg.waitForTimeout(500);
        await pg.keyboard.type('imprimer');
        await pg.waitForSelector('[data-recherche-action="imprimer-jour"]', { timeout: 8000 });
        await pg.locator('[data-recherche-action="imprimer-jour"]').first().click();
        const ouverte = await pg.waitForSelector('[data-lot-etape="choix"]', { timeout: 12000 }).then(() => true).catch(() => false);
        const f = ouverte ? await pg.evaluate(() => [...document.querySelectorAll('[data-lot-ligne]')].map((e) => e.getAttribute('data-lot-ligne'))) : [];
        const tache = await pg.evaluate(() => (document.querySelector('[data-tache]') || { getAttribute: () => null }).getAttribute('data-tache'));
        dit(ouverte && tache === 'ventes', 'G ⌘K « Imprimer les bordereaux du jour » ouvre la feuille sur Ventes (jamais avalée par Achats caché)', `${ouverte} · ${tache}`);
        dit(f.length === 2, 'G la feuille porte les 2 colis à envoyer', JSON.stringify(f));
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `imprimer-garde-${nom}.png`) });
      });
      dit(errs.length === 0, 'U aucune erreur', errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s), ${ok} vert(s)` : `\n✅ Tout imprimer, écran gardé : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
