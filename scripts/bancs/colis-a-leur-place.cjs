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
    teteSection: sec ? sec.innerText || '' : '',
    depotDom: document.querySelectorAll('[data-depot-ouvrir]:not([data-depot-ouvrir="hors-ligne"])').length,
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
// (16 nov.) Après la visionneuse du PDF (iframe du lecteur PDF de Chromium), un `page.waitForTimeout` sous horloge
// installée fait planter l'onglet (« Page crashed », 4 vues sur 4, mesuré ; une attente côté Node, non) : on attend côté Node.
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const attendre = async (pg, q) => { await pg.waitForSelector(q, { timeout: 30000 }); await pg.waitForTimeout(1800); };

(async () => {
  try { srv.listen(PORT); } catch (_) {}
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    for (const [vp, sombre, nom] of [[{ width: 390, height: 844 }, false, '390-clair'], [{ width: 390, height: 844 }, true, '390-sombre'], [{ width: 1512, height: 982 }, false, '1512-clair'], [{ width: 1512, height: 982 }, true, '1512-sombre']]) {
      if (process.env.BANC_VUE && !nom.startsWith(process.env.BANC_VUE)) continue;   // (débogage) une seule vue
      console.log(`\n— ${nom}`);
      // P : Ma journée seule publie les deux nombres (aucune section ouverte).
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, '?tab=journee');
        await essaie('P ' + nom, async () => {
          await pg.waitForFunction(() => { try { const a = JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'), r = JSON.parse(localStorage.getItem('vrm_colis_retirer') || 'null'); return !!(a && r); } catch (_) { return false; } }, null, { timeout: 30000 }).catch(() => {});
          const m = await mesure(pg);
          dit(m.pubEnv && m.pubEnv.total === 2, 'P `vrm_colis_aposter` publié depuis Ma journée (2)', JSON.stringify(m.pubEnv && m.pubEnv.total));
          dit(m.pubRet && m.pubRet.total === 2, 'P `vrm_colis_retirer` publié depuis Ma journée (2)', JSON.stringify(m.pubRet && m.pubRet.total));
          dit(m.navColis === 0, 'N plus d’entrée « Colis » dans la navigation', String(m.navColis));
          // (14 nov., choix n° 61 de Julien) Au téléphone, « Achats » est dans « Annonces » (l'onglet `paires` de la
          // barre : Annonces · Stock · Achats, src/navPaires.js) : on touche l'onglet, l'entrée doit y être.
          let navAchats = m.navAchats;
          if (!navAchats && vp.width < 600) {
            await pg.locator('[data-nav-entree="paires"]').filter({ visible: true }).first().tap().catch(() => {});
            await pg.waitForSelector('[data-nav-entree="achats"]', { state: 'visible', timeout: 15000 }).catch(() => {});
            navAchats = await pg.evaluate(() => [...document.querySelectorAll('[data-nav-entree="achats"]')].filter((e) => e.getBoundingClientRect().width > 0).length);
          }
          dit(navAchats >= 1, 'N « Achats » est dans la navigation (au téléphone : dans l’onglet Annonces)', String(navAchats));
        });
        dit(errs.length === 0, 'U aucune erreur (Ma journée)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // V : l'ancien lien de Colis ⇒ Ventes, « À expédier » en tête.
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, '?tab=cat_bord');
        await essaie('V ' + nom, async () => {
          // (16 nov.) Une LISTE de sélecteurs fait attendre le PREMIER élément trouvé, ici un frère de la section
          // caché (hauteur 0) : la carte de colis seule est attendue.
          await attendre(pg, '[data-bord-card]');
          const m = await mesure(pg);
          dit(m.tache === 'ventes' && m.section === 'ventes', 'V `?tab=cat_bord` ouvre Ventes, section « À expédier »', `${m.tache} · ${m.section}`);
          // (16 nov.) La tête de la section n'a plus d'intertitre <h2> (maquette de Ventes du 15 nov. : le segment
          // « À envoyer · En route · Toutes » puis le grand chiffre) : le mot est jugé sur la tête entière.
          dit(/À envoyer/.test(m.teteSection) && !/exp[ée]dier/i.test(m.teteSection), 'V la tête de la section dit « À envoyer » (le mot de src/libelles.js, 16 nov.), jamais « à expédier »', m.teteSection.replace(/\s+/g, ' ').slice(0, 120));
          dit(m.avant === true, 'V la section est EN TÊTE (avant la liste des ventes)', String(m.avant));
          dit(m.choixEnvoyer === 1 && m.choixEnvoyes === 1 && m.choixRetirer === 0, 'V À envoyer · Envoyés, jamais « À retirer » dans Ventes', `${m.choixEnvoyer}/${m.choixEnvoyes}/${m.choixRetirer}`);
          dit(m.cartesEnvoi === 2, 'V les 2 colis à envoyer, chacun une fois', String(m.cartesEnvoi));
          // « Je dépose » vit derrière « … » depuis la refonte de Ventes (15 nov.) : présent UNE fois dans la page.
          dit(m.imprimer === 1 && m.depotDom === 1 && m.barres === 1, 'V « Imprimer » (visible) et « Je dépose » (derrière « … »), une fois', `${m.imprimer}/${m.depotDom}/${m.barres}`);
          dit(m.colonneRetirer === 0 && m.outils === 0 && m.codes.length === 0, 'V aucun colis à retirer dans Ventes', `${m.colonneRetirer}/${m.outils}/${m.codes.length}`);
          dit(m.versColis === 0 && !m.h1Colis, 'V plus de « À envoyer : Colis › » ni de titre « Colis »', `${m.versColis}/${m.h1Colis}`);
          dit(m.deposee === 0 && m.pretsImprimer === '2', 'B la vente DÉPOSÉE (e-mail de dépôt du n° de SON étiquette) n’est ni une carte, ni dans « Tout imprimer (2) »', `${m.deposee} · ${m.pretsImprimer}`);
          if (process.env.DEBUG_TITRE) console.log(await pg.evaluate(() => { const e = [...document.querySelectorAll('.vrm-colis-section .vrm-colis-titre')].find((x) => /Yellow/.test(x.textContent)); if (!e) return 'absent'; const out = [];
            for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (_) { continue; } const walk = (L) => { for (const r of L) { if (r.cssRules && !r.selectorText) { if (!r.media || matchMedia(r.media.mediaText).matches) walk(r.cssRules); continue; } try { if (r.selectorText && e.matches(r.selectorText) && /clamp|white-space|max-height|display|height/.test(r.style.cssText)) out.push(r.selectorText.slice(0, 160) + ' {' + r.style.cssText.slice(0, 200)); } catch (_) {} } }; walk(rs); }
            const cs = getComputedStyle(e); return JSON.stringify({ cls: e.className, parent: e.parentElement.className, clamp: cs.webkitLineClamp, ws: cs.whiteSpace, disp: cs.display, mh: cs.maxHeight, h: e.clientHeight, sh: e.scrollHeight, style: e.getAttribute('style') }) + '\n' + out.join('\n'); }));
          const longs = m.titres.filter((x) => /Yellow Stone/.test(x.t));
          dit(longs.length >= 1 && longs.every((x) => !x.coupe && /boîte d’origine/.test(x.t)), 'T le titre long se lit EN ENTIER sur sa carte (aucune coupe)', JSON.stringify(longs));
          dit(m.titres.length >= 2 && m.titres.every((x) => !x.coupe && x.lignes <= 4), 'T aucun titre de colis coupé (4 lignes au plus à 390, le titre réel le plus long)', JSON.stringify(m.titres.filter((x) => x.coupe || x.lignes > 4)));
          dit(m.nSections === 1, 'U une seule section de colis sur Ventes', String(m.nSections));
          dit(m.deb <= 0, 'U rien ne déborde (Ventes)', String(m.deb));
          if (SHOTS) { await pg.evaluate(() => window.scrollTo(0, 0)); await pg.screenshot({ path: path.join(SHOTS, `colis-place-ventes-${nom}.png`) }); }
        });
        dit(errs.length === 0, 'U aucune erreur (Ventes)', errs.slice(0, 2).join(' | '));
        await ctx.close(); }
      // I : « IMPRIMER » EN UN TOUCHER (14 nov., docs/passation/2026-11-14-impression-simple.md — l'ancien « Tout imprimer »
      //     en trois temps, aperçu A4 et « C'est imprimé ? » n'existe plus). Le plein « Imprimer les 2 bordereaux » ⇒ la
      //     question du papier (la première fois seulement) ⇒ UN PDF ouvert (ici la visionneuse : ni iPhone ni Android)
      //     ⇒ noté imprimé quand il est OUVERT ⇒ « Tout est sorti ? » avec les 2 vignettes, la déposée ni dedans ni
      //     dite absente ; « Choisir, réimprimer » liste les 2 (la déposée absente), décochés car déjà imprimés,
      //     le titre long en entier ; « Je dépose » (derrière « … » depuis le 15 nov.) ouvre le mode dépôt.
      { const { ctx, pg, errs } = await ouvrir(b, vp, sombre, '?tab=cat_bord');
        await essaie('I ' + nom, async () => {
          await attendre(pg, '[data-colis-barre-btn="imprimer"]:not([disabled])');
          const bt = await pg.evaluate(() => { const e = [...document.querySelectorAll('[data-colis-barre-btn="imprimer"]')].filter((x) => x.getBoundingClientRect().width > 0); return { n: e.length, lot: e[0] && e[0].getAttribute('data-impr-lot'), txt: e[0] ? e[0].innerText.trim() : '' }; });
          dit(bt.n === 1 && bt.lot === '2' && /(^|\D)2(\D|$)/.test(bt.txt), 'I un seul plein « Imprimer (2) » en tête de « À envoyer » (data-impr-lot)', JSON.stringify(bt));
          await pg.locator('[data-colis-barre-btn="imprimer"]').filter({ visible: true }).first().click();
          await pg.waitForSelector('[data-impr-papier-feuille="premiere"]', { timeout: 15000 });
          const avantPapier = await pg.evaluate(() => (window.__pdfs || []).length);
          dit(avantPapier === 0, 'I la PREMIÈRE fois : la question du papier, aucun PDF avant', String(avantPapier));
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `imprimer-1-papier-${nom}.png`) });
          await pg.click('[data-impr-papier-choix="normale"]');
          // (16 nov., lot tampons-parametres — Julien : « ça m'ouvre une vignette […] et quand je touche Imprimer, les
          // réglages sont appliqués ») L'APERÇU AVANT IMPRESSION : rien ne part avant son « Imprimer ».
          await pg.waitForSelector('[data-impr-apercu="pret"] [data-impr-apercu-imprimer]:not([disabled])', { timeout: 60000 });
          dit(await pg.evaluate(() => (window.__pdfs || []).length) === 0, 'I l’aperçu avant impression d’abord, aucun PDF avant son « Imprimer »');
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `imprimer-1b-apercu-${nom}.png`) });
          await pg.click('[data-impr-apercu-imprimer]');
          await pg.waitForSelector('[data-visionneuse-pdf="pret"]', { timeout: 30000 });
          // Noté imprimé quand le PDF est OUVERT (impression-simple) : on attend l'écriture (file du geste), sans délai fixe.
          await pg.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem('vinted_bords_printed') || '{}')).length >= 2, null, { timeout: 10000 }).catch(() => {});
          const ouvert = await pg.evaluate(() => ({ pdfs: (window.__pdfs || []).length, imprimes: Object.keys(JSON.parse(localStorage.getItem('vinted_bords_printed') || '{}')).sort().join(',') }));
          dit(ouvert.pdfs === 1, 'I UN seul PDF, ouvert dans la visionneuse', String(ouvert.pdfs));
          dit(ouvert.imprimes === '7201,7202', 'I les 2 colis du PDF notés imprimés (et seulement eux, jamais la déposée)', ouvert.imprimes);
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `imprimer-2-pdf-${nom}.png`) });
          await pg.click('[data-visionneuse-fermer]');
          await pg.waitForSelector('[data-impr-feuille="question"]', { timeout: 10000 });
          const apres = await pg.evaluate(() => { const f = document.querySelector('[data-impr-feuille]'); return { n: f.getAttribute('data-impr-n'), vign: f.querySelectorAll('[data-impr-vignette]').length, absents: [...f.querySelectorAll('[data-impr-absent]')].map((e) => e.getAttribute('data-impr-absent')), deb: f.scrollWidth - f.clientWidth }; });
          dit(apres.n === '2' && apres.vign === 2 && !apres.absents.some((a) => /7203/.test(a)), 'I « Tout est sorti ? » : les 2 vignettes ; la déposée ni dedans ni dite absente', JSON.stringify(apres));
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `imprimer-3-apres-${nom}.png`) });
          await pg.click('[data-impr-oui]');
          await pg.waitForFunction(() => !document.querySelector('[data-impr-feuille]'), null, { timeout: 8000 });
          // « Choisir, réimprimer » : la feuille qui choisit CE qui part.
          await pg.locator('[data-lot-ouvrir]').filter({ visible: true }).first().click();
          await pg.waitForSelector('[data-lot-etape="choix"]', { timeout: 15000 });
          await dormir(500);
          const f = await pg.evaluate(() => { const r = document.querySelector('[data-lot-etape]'); const q = (x) => [...r.querySelectorAll(x)];
            return { lignes: q('[data-lot-ligne]').map((e) => e.getAttribute('data-lot-ligne')), coches: q('[data-lot-ligne][data-coche="1"]').length,
              imprimes: (r.querySelector('[data-lot-pourquoi-imprimes]') || { getAttribute: () => null }).getAttribute('data-lot-pourquoi-imprimes'),
              cibles: q('input.vrm-tip-case').map((e) => { const l = e.closest('label').getBoundingClientRect(); return Math.round(l.height); }), deb: r.scrollWidth - r.clientWidth }; });
          dit(f.lignes.length === 2 && !f.lignes.some((l) => /7203/.test(l)), 'I « Choisir » : les 2 colis, la déposée absente', JSON.stringify(f.lignes));
          dit(f.coches === 0 && f.imprimes === '2', 'I déjà imprimés ⇒ décochés d’office (« 2 déjà imprimés — coche pour réimprimer »)', `${f.coches} · ${f.imprimes}`);
          dit(f.cibles.length === 2 && f.cibles.every((h) => h >= 44) && f.deb <= 0, 'I chaque ligne se touche sur 44 px au moins, rien ne déborde dans la feuille', JSON.stringify(f));
          const m = await mesure(pg);
          const longsF = m.titres.filter((x) => /Yellow Stone/.test(x.t));
          dit(longsF.length >= 1 && longsF.every((x) => !x.coupe), 'I le titre long se lit en entier dans la feuille', JSON.stringify(longsF));
          if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `imprimer-4-choisir-${nom}.png`) });
          await pg.locator('.vrm-lot [data-feuille-croix]').first().click().catch(async () => { await pg.keyboard.press('Escape'); });
          await pg.waitForFunction(() => !document.querySelector('[data-lot-etape]'), null, { timeout: 8000 });
          // « Je dépose » : derrière « … » (refonte de Ventes, 15 nov. : rien entre le chiffre et la liste), puis, au
          // téléphone, dans la feuille « À faire · N » (src/ui/AFaire.jsx, 14 nov.).
          if (!(await pg.locator('[data-depot-ouvrir]').filter({ visible: true }).count())) await pg.locator('[data-colis-outils-bascule]').filter({ visible: true }).first().click();
          await dormir(400);
          if (!(await pg.locator('[data-depot-ouvrir]').filter({ visible: true }).count())) { await pg.locator('[data-ui-afaire]').filter({ visible: true }).first().click(); await pg.waitForSelector('[data-ui-afaire-feuille] [data-depot-ouvrir]', { timeout: 8000 }); await dormir(400); }
          await pg.locator('[data-depot-ouvrir]').filter({ visible: true }).first().click();
          await dormir(800);
          const dep = await pg.evaluate(() => !!document.querySelector('.vrm-depot[data-depot]'));
          dit(dep, 'I « Je dépose » ouvre le mode dépôt', String(dep));
        });
        dit(errs.length === 0, 'U aucune erreur (Tout imprimer)', errs.slice(0, 2).join(' | '));
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
      // L : un lien écrit avec le nom de l'ancien onglet (`?tab=colis`) ⇒ Ventes « À expédier » ; `&sub=retirer` ⇒ Achats.
      for (const [lien, attendu] of [['?tab=colis', 'ventes'], ['?tab=colis&sub=retirer', 'achats']]) {
        const { ctx, pg, errs } = await ouvrir(b, vp, sombre, lien);
        await essaie('L ' + nom + ' ' + lien, async () => {
          await attendre(pg, '[data-colis-section]');
          const m = await mesure(pg);
          dit(m.tache === attendu && m.section === attendu, `L \`${lien}\` ouvre ${attendu} (jamais un écran vide)`, `${m.tache} · ${m.section}`);
        });
        dit(errs.length === 0, 'U aucune erreur (' + lien + ')', errs.slice(0, 2).join(' | '));
        await ctx.close();
      }
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
