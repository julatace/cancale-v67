// Banc (11 nov., lot DJ3) : LES COLIS À LEUR PLACE. Julien, mot pour mot : « Je pense que tu peux
// regrouper les colis à expédier dans les ventes, les colis à retirer dans achats, ça évite les
// répétitions et les erreurs. En veillant à bien tout garder, simplement déplacer pour pas avoir 2 fois
// la même chose. » Données INVENTÉES (dépôt public), formes réelles : deux ventes à expédier
// (`harvest_111_orders_sold`, `needs_action`, bordereau e-mail `email_bord_{tx}` avec PDF), deux colis
// arrivés au relais (`email_track_*`, code de retrait LU dans l'e-mail : 012345 et 654321).
// Jugé sur data-* et nombres (§6.4), 390 tactile et 1512, clair ET sombre :
//  N. la barre / la colonne : plus d'entrée « Colis » (`cat_bord`), « Achats » y est ;
//  V. `?tab=cat_bord` ⇒ Ventes, section « À expédier » EN TÊTE (avant la liste des ventes) : À envoyer ·
//     Envoyés, les 2 cartes, « Tout imprimer », « Je dépose » ; jamais « À retirer » ni ses colis ;
//     plus de « À envoyer : Colis › » ;
//  A. `?tab=retraits` ⇒ Achats, section « À retirer » EN TÊTE : les 2 colis, chaque CODE LU dans
//     l'e-mail affiché, les outils de retrait ; aucun colis à envoyer, aucun « Tout imprimer » ;
//     « Scanner » une fois ; plus de « → Colis » ;
//  C. une notification `?tab=cat_bord&cible=retrait&suivi=…` (le lien des e-mails) ouvre ACHATS ;
//     `?tab=cat_bord&vue=…` sans retrait ⇒ Ventes ;
//  P. les nombres publiés (`vrm_colis_aposter`, `vrm_colis_retirer`) le sont DÈS Ma journée, sans
//     qu'aucune des deux sections ait été ouverte (un propriétaire, monté comme avant) ;
//  U. chaque chose UNE fois par écran (section, barre, Mode relais, alerte), rien ne déborde, aucune erreur.
// Rouge sur origin/main. Lancer : construire dist/, puis node scripts/bancs/colis-a-leur-place.cjs
// (BANC_PORT 9233, BANC_DIST, SHOTS=dossier pour les captures).
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const RACINE = process.env.BANC_RACINE || path.join(__dirname, '..', '..');
const DIST = process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9233);
const SHOTS = process.env.SHOTS || '';
const maintenant = new Date(2026, 10, 11, 10, 0, 0);
const MS = maintenant.getTime(), J = 864e5;
const iso = (t) => new Date(t).toISOString();
const ilYa = (j) => iso(MS - j * J);
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MS) }];
const TITRE = 'Salomon XT-6 Black 42';
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const AENV = [[7201, 1, 4], [7202, 5, 1]];
const fmtLimite = (j) => { const d = new Date(MS + j * J); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} 23:59`; };
const track = (id, d) => ({ id, data: Object.assign({ type: 'suivi', receivedAt: ilYa(0.2), emailAt: ilYa(0.2), arriveLe: ilYa(0.2), consigne: false, account: 'compte_a' }, d) });
const LIGNES = [
  { id: 'main', data: { vrm_ville: 'Cancale' } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: AENV.map(([tx, j]) => ({ transaction_id: tx, title: TITRE, price: { amount: '80.0', currency_code: 'EUR' }, status: 'Bordereau d’envoi envoyé au vendeur', transaction_user_status: 'needs_action', date: ilYa(j) })) } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MS - 600e3), payload: { my_orders: [] } } },
  ...AENV.map(([tx, j, lim]) => ({ id: 'email_bord_' + tx, data: { type: 'bordereau', transaction: String(tx), uid: '111', account: 'compte_a', filename: `Bordereau-Vinted-${tx}.pdf`, modele: TITRE, article: TITRE, receivedAt: ilYa(j - 0.1), pdfB64: PDF_B64, suivi: '', transporteur: '', dateLimite: fmtLimite(lim) } })),
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
  };
});
const attendre = async (pg, q) => { await pg.waitForSelector(q, { timeout: 30000 }); await pg.waitForTimeout(1800); };

(async () => {
  try { srv.listen(PORT); } catch (_) {}
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      console.log(`\n— ${nom}`);
      // P : Ma journée seule publie les deux nombres (aucune section ouverte).
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, '?tab=journee');
        await essaie('P ' + nom, async () => {
          await pg.waitForFunction(() => { try { const a = JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'), r = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); return !!(a && r); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
          const m = await mesure(pg);
          dit(m.pubEnv && m.pubEnv.total === 2, 'P `vrm_colis_aposter` publié depuis Ma journée (2)', JSON.stringify(m.pubEnv && m.pubEnv.total));
          dit(m.pubRet && m.pubRet.total === 2, 'P `vrm_colis_retirer` publié depuis Ma journée (2)', JSON.stringify(m.pubRet && m.pubRet.total));
          dit(m.navColis === 0, 'N plus d’entrée « Colis » dans la navigation', String(m.navColis));
          dit(m.navAchats >= 1, 'N « Achats » est dans la navigation', String(m.navAchats));
        });
        dit(errs.length === 0, 'U aucune erreur (Ma journée)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // V : l'ancien lien de Colis ⇒ Ventes, « À expédier » en tête.
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, '?tab=cat_bord');
        await essaie('V ' + nom, async () => {
          await attendre(pg, '[data-colis-section="ventes"] ~ *, [data-bord-card]');
          const m = await mesure(pg);
          dit(m.tache === 'ventes' && m.section === 'ventes', 'V `?tab=cat_bord` ouvre Ventes, section « À expédier »', `${m.tache} · ${m.section}`);
          dit(/À expédier/.test(m.titre), 'V l’intertitre dit « À expédier »', m.titre);
          dit(m.avant === true, 'V la section est EN TÊTE (avant la liste des ventes)', String(m.avant));
          dit(m.choixEnvoyer === 1 && m.choixEnvoyes === 1 && m.choixRetirer === 0, 'V À envoyer · Envoyés, jamais « À retirer » dans Ventes', `${m.choixEnvoyer}/${m.choixEnvoyes}/${m.choixRetirer}`);
          dit(m.cartesEnvoi === 2, 'V les 2 colis à envoyer, chacun une fois', String(m.cartesEnvoi));
          dit(m.imprimer === 1 && m.depot === 1 && m.barres === 1, 'V « Tout imprimer » et « Je dépose », une fois', `${m.imprimer}/${m.depot}/${m.barres}`);
          dit(m.colonneRetirer === 0 && m.outils === 0 && m.codes.length === 0, 'V aucun colis à retirer dans Ventes', `${m.colonneRetirer}/${m.outils}/${m.codes.length}`);
          dit(m.versColis === 0 && !m.h1Colis, 'V plus de « À envoyer : Colis › » ni de titre « Colis »', `${m.versColis}/${m.h1Colis}`);
          dit(m.nSections === 1, 'U une seule section de colis sur Ventes', String(m.nSections));
          dit(m.deb <= 0, 'U rien ne déborde (Ventes)', String(m.deb));
          if (SHOTS) { await pg.evaluate(() => window.scrollTo(0, 0)); await pg.screenshot({ path: path.join(SHOTS, `colis-place-ventes-${nom}.png`) }); }
        });
        dit(errs.length === 0, 'U aucune erreur (Ventes)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // A : l'ancien lien des retraits ⇒ Achats, « À retirer » en tête, codes des e-mails.
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, '?tab=retraits');
        await essaie('A ' + nom, async () => {
          await attendre(pg, '[data-cc-colonne="retirer"]');
          await pg.waitForSelector('[data-code-retrait="012345"]', { state: 'attached', timeout: 15000 }).catch(() => {});
          const m = await mesure(pg);
          dit(m.tache === 'achats' && m.section === 'achats', '`?tab=retraits` ouvre Achats, section « À retirer »', `${m.tache} · ${m.section}`);
          dit(/À retirer/.test(m.titre), 'A l’intertitre dit « À retirer »', m.titre);
          dit(m.colonneRetirer === 1 && m.outils === 1, 'A la liste des colis à retirer et ses outils, une fois', `${m.colonneRetirer}/${m.outils}`);
          dit(m.codes.join(',') === '012345,654321', 'A chaque code de retrait LU dans l’e-mail est sur SON colis (par n° de suivi)', m.codes.join(','));
          dit(m.cartesEnvoi === 0 && m.imprimer === 0 && m.choixEnvoyer === 0, 'A aucun colis à envoyer ni « Tout imprimer » dans Achats', `${m.cartesEnvoi}/${m.imprimer}/${m.choixEnvoyer}`);
          dit(m.scanner === 1 && m.relais <= 1, 'U « Scanner » et « Mode relais » une fois', `${m.scanner}/${m.relais}`);
          dit(m.versColis === 0 && !m.h1Colis, 'A plus de « → Colis » ni de titre « Colis »', `${m.versColis}/${m.h1Colis}`);
          dit(m.deb <= 0, 'U rien ne déborde (Achats)', String(m.deb));
          if (SHOTS) { await pg.evaluate(() => window.scrollTo(0, 0)); await pg.screenshot({ path: path.join(SHOTS, `colis-place-achats-${nom}.png`) }); }
        });
        dit(errs.length === 0, 'U aucune erreur (Achats)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // C : le lien d'un e-mail de retrait (src/boiteEmails.js) vise encore `cat_bord` : il mène à Achats.
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, '?tab=cat_bord&cible=retrait&suivi=90000001');
        await essaie('C ' + nom, async () => {
          await attendre(pg, '[data-colis-section]');
          const m = await mesure(pg);
          dit(m.tache === 'achats' && m.section === 'achats', 'C une notification de retrait (`?tab=cat_bord&cible=retrait`) ouvre Achats', `${m.tache} · ${m.section}`);
        });
        dit(errs.length === 0, 'U aucune erreur (notification)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
    }
  } finally { await b.close(); srv.close(); }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s), ${ok} vert(s)` : `\n✅ Colis à leur place : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
