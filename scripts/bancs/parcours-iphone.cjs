// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA JOURNÉE DE JULIEN SUR IPHONE » (24 nov., « elle bug trop encore »)
//  Récit : docs/passation/2026-11-24-parcours-iphone.md
//
//  Un robot joue SA journée, au doigt, à 390 px (appareil « iPhone 15 » : tactile,
//  agent iOS), sur une base INVENTÉE (_base-messages-stock.cjs + deux colis au point
//  relais avec code) — jamais de vraies données. Chromium par défaut, WebKit (Safari)
//  par `NAVIGATEUR=webkit` (CI : iphone-webkit.yml ; ce conteneur ne peut pas le
//  télécharger). Le parcours :
//    ouvrir · Aujourd'hui · chaque onglet du bas · une vente puis retour · imprimer ·
//    Achats → À retirer → code en grand → retour · Annonces → une annonce → retour ·
//    Argent → un mois → retour · Messages · Paramètres (chaque section) · la loupe ·
//    tourner, quitter et revenir, réseau lent.
//  (Le démarrage à froid hors ligne a son banc : hors-ligne-froid.cjs. Réseau lent : l'ouverture attend UNE
//  vérification de la séparation des données — PorteConfidentialite, voulu — d'où un seuil d'un aller-retour + 1,5 s.)
//  Après CHAQUE geste, jugé sur la règle (attributs, boîtes, nombres — jamais un libellé) :
//    P1 aucune erreur JS ; P2 ni écran blanc ni garde-fou ; P3 le geste a fait quelque
//    chose (l'état attendu est là) ; P4 une feuille ouverte se ferme par le geste
//    « retour » et le retour reste dans VRM, sur le même écran ; P5 le défilement de la
//    liste est retrouvé au retour ; P6 rien de touchable sous la barre du bas ni sous
//    l'encoche ; P7 aucun texte coupé sans points de suspension ni deux textes l'un sur
//    l'autre ; P8 chaque cible visible ≥ 44 px (rapporté, plafonné : `CIBLES_MAX`) ;
//    P9 la mise en page ne saute pas pendant le chargement (layout-shift, Chromium) ;
//    P10 l'état attendu est visible en moins de `SEUIL_MS` (1 000) après le toucher (rouge en CI ou SEUIL_STRICT=1 ;
//    rapporté sur une machine partagée) ; P11 la loupe nomme le transporteur d'un colis (jamais « mondial_relay »).
//  `SHOTS=<dossier>` (captures, À REGARDER), `BANC_DIST=<dist>` (un autre build : celui
//  d'avant doit être ROUGE), `THEMES=clair,sombre`. Un banc ne meurt pas, il rapporte ;
//  il sort en erreur s'il y a un rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const { lancer, NAVIGATEUR } = require('./_navigateur.cjs');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));

const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'banc-parcours-iphone');
fs.mkdirSync(SHOTS, { recursive: true });
const THEMES = String(process.env.THEMES || 'clair').split(',').filter(Boolean);
const SEUIL_MS = Number(process.env.SEUIL_MS || 1000);
const CIBLES_MAX = Number(process.env.CIBLES_MAX || 0);
const IPHONE = PW.devices['iPhone 15'];
const CHARGE = (() => { try { const os = require('os'); return (os.loadavg()[0] / os.cpus().length).toFixed(1) + ' par cœur'; } catch (_) { return '?'; } })();
// Les sauts de mise en page TROUVÉS le 24 nov. et pas corrigés (docs/passation/2026-11-24-parcours-iphone.md) : rapportés,
// pas rouges. Cette liste ne fait que RACCOURCIR : un saut corrigé en sort.
// (24 nov., lot sauts-orange — docs/passation/2026-11-24-sauts-orange.md) CORRIGÉS et sortis : Achats (les codes de retrait
// n'arrivent plus après « À vérifier » : la colonne attend ses deux sources), la loupe (les suggestions attendent leur
// lecture), Argent (« Tes seuils de l'année » prise à l'ouverture en tête, sinon en bas du résumé). Un saut qui revient sur
// ces écrans est ROUGE.
// La fin d'Achats aussi (la réserve de ParPaquets, les blocs du bas sans squelette). Plus AUCUN saut connu.
const SAUTS_CONNUS = /(?!)/;
const STRICT = process.env.CI === 'true' || process.env.SEUIL_STRICT === '1';
const LENT = { ms: 0 };
const PANNE = { re: null };   // une lecture qui échoue (500) : Argent « pas encore calculé »

// La base : celle du volume + deux colis arrivés au point relais avec leur code (forme des e-mails de suivi, comme
// hors-reseau.cjs) — sans eux « À retirer » est vide et le code en grand n'est jamais rendu.
const jour = (d) => { const x = new Date(Date.now() + d * 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const base = () => {
  const b = B.baseVolume();
  const at = new Date().toISOString();
  b.rows.push(
    { id: 'email_track_mondial_relay_MR999000111', data: { status: 'available', statusLabel: 'Arrivé au point de retrait', code: '4321', lieu: 'Tabac du Port', carrier: 'mondial_relay', suivi: 'MR999000111', artTitle: '', qrUrl: 'https://qr.exemple.test/api/barcode/AztecCode?d=PICKUPPASS:BANC', receivedAt: new Date(Date.now() - 3600e3).toISOString(), limite: jour(5) } },
    { id: 'email_track_vinted_VGSBANC000001', data: { status: 'available', statusLabel: 'Arrivé au point de retrait', code: 'C49341', lieu: 'Consigne Laverie du Port', carrier: 'vinted', suivi: 'VGSBANC000001', artTitle: '', receivedAt: new Date(Date.now() - 7200e3).toISOString(), limite: jour(4) } },
    { id: 'ebay_orders', data: { orders: [], capturedAt: at } },
  );
  return b;
};

// L'équipe lue (la forme de /api/compte?mode=equipe) : sinon l'app attend 2,5 s la base à CHAQUE ouverture, ce que
// l'appareil de Julien ne fait qu'une fois (le cache `vrm_equipe_cache_*` décide ensuite).
const apiBanc = (u, req) => /mode=equipe/.test(u) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true } : B.apiVolume(u, req);

// ── Dans la page, posé avant tout : l'heure du toucher, les sauts de mise en page. ──
const TEMOIN = () => {
  if (window.__pi) return;
  const t = { toucher: 0, sauts: [] };
  window.__pi = t;
  const noter = () => { t.toucher = performance.now(); };
  addEventListener('touchend', noter, true); addEventListener('click', noter, true);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { const src = (e.sources || []).filter((x) => x.node && x.node.nodeType === 1); if (src.length && src.every((x) => { try { return getComputedStyle(x.node).position === 'sticky'; } catch (_) { return false; } })) continue; /* un en-tête collé suit le défilement : pas un saut */ const n = (e.sources || []).map((x) => x.node && x.node.nodeType === 1 ? (x.node.tagName.toLowerCase() + '.' + String(x.node.className).split(' ').slice(0, 2).join('.') + '[' + Math.round(x.previousRect.top) + '→' + Math.round(x.currentRect.top) + ']') : '').filter(Boolean).slice(0, 3).join(' '); t.sauts.push([Math.round(e.startTime), Math.round(e.value * 1000) / 1000, n]); } }).observe({ type: 'layout-shift', buffered: true }); t.cls = true; } catch (_) { t.cls = false; }
};

// ── Dans la page : P2, P6, P7, P8 sur ce qui est À L'ÉCRAN. ──
function controle() {
  const out = { blanc: null, sousBarre: [], sousEncoche: [], coupes: [], superposes: [], petites: [], nCibles: 0 };
  const g = document.querySelector('[data-garde-ecran], [data-garde-morceau]');
  const coque = document.querySelector('.vrm-app-shell, .n-coque');
  if (g) out.blanc = 'garde-fou ' + (g.getAttribute('data-garde-ecran') || g.getAttribute('data-garde-morceau') || '?');
  else if (!coque) out.blanc = 'aucune coque : ' + (document.body.innerText || '').slice(0, 80).replace(/\s+/g, ' ');
  else if ((document.body.innerText || '').replace(/\s+/g, '').length < 40) out.blanc = 'écran presque vide';
  // vu = peint à l'écran : ni caché, ni rogné par un ancêtre (overflow, clip-path « inset(50%) » des textes pour lecteur d'écran)
  const vis = (el) => {
    const c = getComputedStyle(el); if (c.display === 'none' || c.visibility === 'hidden' || parseFloat(c.opacity) < 0.05) return false;
    const r = el.getBoundingClientRect(); if (!(r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)) return false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ca = getComputedStyle(a); if (parseFloat(ca.opacity) < 0.05) return false;
      if (/inset\(50%/.test(ca.clipPath) || (ca.overflow !== 'visible' && ca.overflow !== '')) { const q = a.getBoundingClientRect(); if (Math.min(r.right, q.right) - Math.max(r.left, q.left) < 2 || Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) < 2 || /inset\(50%/.test(ca.clipPath)) return false; }
    }
    return true;
  };
  // la couche d'un élément : son ancêtre fixe / collé (barre, pied) — ce qui défile DESSOUS n'est pas « superposé »
  const couche = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') return a; } return null; };
  const nom = (el) => ((el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 32)) || el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0];
  const barre = document.querySelector('.n-onglets, .vrm-tabbar');
  const rb = barre && vis(barre) ? barre.getBoundingClientRect() : null;
  const tete = document.querySelector('.n-coque-tete, .n-tete-coque, [data-n-coque-tete]');
  const feuille = [...document.querySelectorAll('[role="dialog"], .vrm-fs, .n-feuille, .n-poussee, [data-n-recherche-ouverte]')].filter(vis).pop() || null;
  const racine = feuille || document;
  const cibles = [...racine.querySelectorAll('button, a[href], [role="button"], input:not([type=hidden]), select, summary, [role="tab"]')].filter((el) => vis(el) && !el.closest('[aria-hidden="true"], [inert]'));
  out.nCibles = cibles.length;
  for (const el of cibles) {
    const r = el.getBoundingClientRect();
    if (el.closest('.n-onglets, .vrm-tabbar')) continue;
    const cx = Math.min(innerWidth - 1, Math.max(1, (r.left + r.right) / 2)), cy = Math.min(innerHeight - 1, Math.max(1, (r.top + r.bottom) / 2));
    const h = document.elementFromPoint(cx, cy);
    const atteint = !!h && (h === el || el.contains(h) || h.contains(el));
    // P6 : son centre tombe sur la barre du bas (rien de touchable dessous) — hors feuille
    if (window.__piBas && !feuille && rb && cy > rb.top + 1 && !atteint && h && barre.contains(h)) out.sousBarre.push(`« ${nom(el)} » [${Math.round(r.top)}→${Math.round(r.bottom)}]`);
    // P8 : la cible (une case à cocher native se juge sur son étiquette)
    if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) continue;
    // la zone TOUCHABLE (une ::before / ::after élargie compte) : sondée au doigt, à 21 px de part et d'autre du centre
    if (atteint && (r.height < 43.5 || r.width < 43.5)) {
      const touche = (x, y) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return true; const q = document.elementFromPoint(x, y); return !!q && (q === el || el.contains(q)); };
      const h = r.height >= 43.5 || (touche(cx, cy - 21) && touche(cx, cy + 21));
      const w = r.width >= 43.5 || (touche(cx - 21, cy) && touche(cx + 21, cy));
      if (!h || !w) out.petites.push(`« ${nom(el)} » ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }
  // P6 bis : l'encoche (env(safe-area-inset-top) — 0 sous Chromium, réelle sur iPhone) : la tête de l'app la porte
  const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--n-sat') || '0') || 0;
  if (sat) for (const el of cibles) { const r = el.getBoundingClientRect(); if (r.top < sat - 1 && r.bottom > 0) out.sousEncoche.push(nom(el)); }
  // P7 : texte coupé (déborde sans points de suspension) ; deux textes peints au même endroit
  const feuilles = [];
  for (const el of racine.querySelectorAll('body *, :scope *')) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (!vis(el) || el.closest('[aria-hidden="true"], svg, .n-onglets')) continue;
    const c = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 2 && /hidden|clip/.test(c.overflowX) && c.textOverflow !== 'ellipsis' && !/^(auto|scroll)$/.test(c.overflowX) && el.clientWidth > 0) out.coupes.push(`« ${(el.innerText || '').trim().slice(0, 30)} » ${el.scrollWidth}>${el.clientWidth}`);
    const rng = document.createRange(); rng.selectNodeContents(el); const rr = [...rng.getClientRects()].filter((x) => x.width > 2 && x.height > 2);
    for (const x of rr) feuilles.push({ el, r: x });
    if (feuilles.length > 600) break;
  }
  for (let i = 0; i < feuilles.length; i++) for (let j = i + 1; j < feuilles.length; j++) {
    const a = feuilles[i], b = feuilles[j];
    if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el) || couche(a.el) !== couche(b.el)) continue;
    if (!(a.el.innerText || '').trim() || !(b.el.innerText || '').trim()) continue;
    const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (w > 6 && h > Math.min(a.r.height, b.r.height) * 0.45) { out.superposes.push(`« ${(a.el.innerText || '').trim().slice(0, 20)} » × « ${(b.el.innerText || '').trim().slice(0, 20)} »`); if (out.superposes.length > 6) break; }
  }
  out.docW = document.documentElement.scrollWidth; out.vw = innerWidth;
  return out;
}

const rapport = [];
let ROUGES = 0;
const dit = (ok, quoi, detail = '') => { if (!ok) ROUGES++; const l = `${ok ? '✅' : '❌'} ${quoi}${detail ? ' — ' + detail : ''}`; rapport.push(l); console.log('   ' + l); };
const note = (quoi) => { rapport.push('ℹ️  ' + quoi); console.log('   ℹ️  ' + quoi); };

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await lancer(PW, { executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  // Les lectures de la base passent par LENT (réseau lent) — même enveloppe que stabilite-iphone.cjs.
  const np = nav.newContext.bind(nav);
  nav.newContext = async (o) => {
    const ctx = await np({ ...o, userAgent: IPHONE.userAgent, viewport: { width: 390, height: 844 }, isMobile: !/webkit/.test(NAVIGATEUR) || IPHONE.isMobile, hasTouch: true, serviceWorkers: 'block' });
    const npg = ctx.newPage.bind(ctx);
    ctx.newPage = async (...x) => {
      const pg = await npg(...x); const r0 = pg.route.bind(pg);
      pg.route = (url, h, ...y) => r0(url, async (route, req) => { if (PANNE.re && PANNE.re.test(decodeURIComponent(route.request().url()))) return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }); if (LENT.ms && /\/rest\/v1\/|\/api\//.test(route.request().url())) await new Promise((ok) => setTimeout(ok, LENT.ms)); return h(route, req); }, ...y);
      await pg.addInitScript(TEMOIN);
      return pg;
    };
    return ctx;
  };
  try {
    for (const th of THEMES) {
      console.log(`\n── ${NAVIGATEUR} · 390 tactile · ${th}`);
      const o = await P.ouvrir(nav, { W: 390, sombre: th === 'sombre', b: base(), url: '/?tab=journee', api: apiBanc, dsf: 2 });
      const pg = o.pg;
      const consErr = [];
      pg.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon|status of 4\d\d|ERR_FAILED/i.test(m.text())) consErr.push(m.text().slice(0, 160)); });
      let n = 0, nErr = 0, nCons = 0;
      const ecran = () => pg.evaluate(() => (document.querySelector('.n-onglet[aria-current="page"]') || {}).getAttribute?.('data-n-onglet') || new URLSearchParams(location.search).get('tab'));
      const defile = () => pg.evaluate(() => { const se = document.scrollingElement; let best = se.scrollTop > 0 ? se : null; for (const el of document.querySelectorAll('.vrm-main, .vrm-main *, .n-coque *')) { if (el.scrollTop > 0 && el.clientHeight > innerHeight * 0.4) { best = el; break; } } return best ? Math.round(best.scrollTop) : 0; });
      const defiler = (y) => pg.evaluate((y) => { const se = document.scrollingElement; if (se.scrollHeight > se.clientHeight + 40) { se.scrollTop = y; return se.scrollTop; } for (const el of document.querySelectorAll('.vrm-main, .vrm-main *, .n-coque *')) { const c = getComputedStyle(el); if (/auto|scroll/.test(c.overflowY) && el.scrollHeight > el.clientHeight + 40 && el.clientHeight > innerHeight * 0.4) { el.scrollTop = y; return el.scrollTop; } } return 0; }, y);
      // Un geste : toucher, attendre l'état voulu, mesurer, regarder.
      const geste = async (nomEtape, faire, attendu, { capture = true, lent = SEUIL_MS } = {}) => {
        n++;
        // L'aide « VRM sur ton écran d'accueil » (Safari, une fois) : Julien la ferme d'un « Compris », le robot aussi.
        if (await pg.locator('[data-inst-geste="compris"]').isVisible().catch(() => false)) { await pg.locator('[data-inst-geste="compris"]').tap().catch(() => {}); await pg.waitForTimeout(300); note('aide « écran d’accueil » fermée (Compris)'); }
        await pg.evaluate(() => { window.__pi.sauts = []; window.__pi.toucher = performance.now(); const m = document.querySelector('.vrm-main, main'); window.__piAvant = m ? m.innerText.slice(0, 4000) : ''; });
        let ok = true;
        try { await faire(); } catch (e) { ok = false; dit(false, `${nomEtape} : le geste échoue`, String(e.message || e).split('\n')[0].slice(0, 140)); }
        let ms = null;
        if (ok && attendu) {
          try { await pg.waitForFunction(attendu.f, attendu.a, { timeout: 8000, polling: 'raf' }); ms = Math.round(await pg.evaluate(() => performance.now() - window.__pi.toucher)); }
          catch (_) { ok = false; dit(false, `${nomEtape} : rien ne se passe (P3)`, attendu.quoi || ''); }
        }
        // P10 : rouge en CI (machine à soi) ; sur une machine partagée (charge > 1 par cœur), rapporté seulement.
        if (ok && ms != null) { if (ms <= lent) dit(true, `${nomEtape} : visible en ${ms} ms (P10)`); else if (STRICT) dit(false, `${nomEtape} : visible en ${ms} ms (P10)`, `> ${lent} ms`); else note(`${nomEtape} : visible en ${ms} ms (P10, > ${lent} ms — machine chargée : ${CHARGE})`); }
        await pg.waitForTimeout(700);
        const c = await pg.evaluate(controle);
        const sauts = await pg.evaluate(() => window.__pi.sauts.reduce((s, x) => s + x[1], 0));
        const qui = await pg.evaluate(() => window.__pi.sauts.slice().sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[1] + ' ' + x[2]).join(' ; '));
        const fichier = path.join(SHOTS, `${NAVIGATEUR}-${th}-${String(n).padStart(2, '0')}-${nomEtape.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`);
        if (capture) await pg.screenshot({ path: fichier }).catch(() => {});
        if (o.erreurs.length > nErr) { dit(false, `${nomEtape} : erreur JS (P1)`, o.erreurs.slice(nErr).join(' | ')); nErr = o.erreurs.length; }
        if (consErr.length > nCons) { note(`${nomEtape} : console.error ${consErr.slice(nCons).join(' | ')}`); nCons = consErr.length; }
        if (c.blanc) dit(false, `${nomEtape} : écran blanc (P2)`, c.blanc);
        if (c.docW > c.vw + 1) dit(false, `${nomEtape} : la page déborde de côté`, `${c.docW} > ${c.vw}`);
        if (c.sousBarre.length) dit(false, `${nomEtape} : sous la barre du bas (P6)`, c.sousBarre.slice(0, 3).join(', '));
        if (c.sousEncoche.length) dit(false, `${nomEtape} : sous l'encoche (P6)`, c.sousEncoche.slice(0, 3).join(', '));
        if (c.coupes.length) dit(false, `${nomEtape} : texte coupé (P7)`, c.coupes.slice(0, 3).join(', '));
        if (c.superposes.length) dit(false, `${nomEtape} : textes superposés (P7)`, c.superposes.slice(0, 3).join(', '));
        if (c.petites.length) { const l = `${nomEtape} : ${c.petites.length} cible(s) < 44 px (P8)`; if (c.petites.length > CIBLES_MAX) note(l + ' — ' + c.petites.slice(0, 4).join(', ')); }
        if (sauts > 0.1) { const l = `${nomEtape} : la mise en page saute (P9)`; if (SAUTS_CONNUS.test(nomEtape)) note(`CONNU, pas corrigé — ${l} · CLS ${sauts.toFixed(3)} · ${qui}`); else dit(false, l, `CLS ${sauts.toFixed(3)} · ${qui}`); }
        return { ok, ms, c, fichier };
      };
      const tap = (sel) => async () => { const l = pg.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 6000 }); await l.tap({ timeout: 4000 }); };
      const surOnglet = (id) => ({ quoi: `onglet ${id} actif`, f: (id) => !!document.querySelector(`.n-onglet[data-n-onglet="${id}"][aria-current="page"]`) && !!document.querySelector('.vrm-main, main') && !document.querySelector('[data-en-cours]'), a: id });
      const feuilleOuverte = { quoi: 'une feuille ouverte', f: () => [...document.querySelectorAll('[role="dialog"], .vrm-fs, .n-feuille, .n-poussee, [data-n-recherche-ouverte]')].some((d) => { const r = d.getBoundingClientRect(); return r.width > 100 && r.height > 100 && getComputedStyle(d).visibility !== 'hidden'; }) };
      const aucuneFeuille = { quoi: 'feuille fermée', f: () => ![...document.querySelectorAll('[role="dialog"][aria-modal="true"], .vrm-fs, .n-feuille, .n-poussee, [data-n-recherche-ouverte]')].some((d) => { const r = d.getBoundingClientRect(); return r.width > 100 && r.height > 100 && getComputedStyle(d).visibility !== 'hidden'; }) };
      // P4 : le « retour » (geste d'iOS = history.back) ferme la feuille et reste dans VRM, sur l'écran.
      const retour = async (nomEtape, ecranAttendu, yAvant) => {
        const url0 = pg.url();
        const r = await geste(nomEtape, () => pg.goBack({ timeout: 3000 }).catch(() => null), ecranAttendu ? aucuneFeuille : change);
        const dans = /localhost|127\.0\.0\.1/.test(pg.url()) && pg.url() !== 'about:blank';
        const e = await ecran();
        if (!dans) { await pg.goForward().catch(() => {}); await pg.waitForTimeout(1500); }
        dit(dans && (!ecranAttendu || e === ecranAttendu), `${nomEtape} : le retour reste dans VRM, sur ${ecranAttendu} (P4)`, `écran ${e} · ${dans ? 'dans VRM' : 'SORTI : ' + pg.url()}${url0 === pg.url() ? '' : ''}`);
        if (yAvant != null) { const y = await defile(); dit(Math.abs(y - yAvant) <= 40, `${nomEtape} : la liste est restée où elle était (P5)`, `${yAvant} → ${y}`); }
        return r;
      };

      // Défilé tout en bas : le dernier contenu touchable reste au-dessus de la barre (P6), puis remonté.
      const basDePage = async (nomEtape) => {
        await defiler(999999); await pg.waitForTimeout(500); await defiler(999999);
        await pg.evaluate(() => { window.__piBas = true; });
        await geste(`${nomEtape}-bas`, async () => {}, null);
        await pg.evaluate(() => { window.__piBas = false; });
        await defiler(0); await pg.waitForTimeout(200);
      };
      // Toucher une LIGNE d'une liste par son titre (le haut-gauche de la ligne : le centre porte parfois un bouton).
      const tapLigne = (sel, rang) => async () => {
        const l = pg.locator(sel);
        const i = await pg.evaluate(([sel, rang]) => { const t = [...document.querySelectorAll(sel)]; const k = t.findIndex((x, j) => j >= rang && x.getBoundingClientRect().top > 160 && x.getBoundingClientRect().bottom < innerHeight - 200); return k < 0 ? rang : k; }, [sel, rang]);
        await l.nth(i).tap({ timeout: 4000, position: { x: 90, y: 12 } });
      };
      const change = { quoi: "l'écran a changé", f: () => { const m = document.querySelector('.vrm-main, main'); return !!m && m.innerText.slice(0, 4000) !== window.__piAvant && m.innerText.trim().length > 40; } };
      const feuillePresente = () => pg.evaluate(feuilleOuverte.f);

      // 1. Ouvrir l'app (le premier écran prêt)
      await geste('ouvrir', async () => {}, surOnglet('journee'), { lent: 8000 });
      await P.pret(pg);
      // 2. Aujourd'hui, jusqu'en bas
      await basDePage('aujourdhui');
      // 3. Chaque onglet du bas (et chaque écran jusqu'en bas)
      const onglets = await pg.evaluate(() => [...document.querySelectorAll('.n-onglet')].map((x) => x.getAttribute('data-n-onglet')));
      for (const id of [...onglets.slice(1), onglets[0]]) { await geste(`onglet-${id}`, tap(`.n-onglet[data-n-onglet="${id}"]`), surOnglet(id)); await basDePage(`onglet-${id}`); }
      // 4. Une vente, puis retour ; imprimer
      await geste('ventes', tap('.n-onglet[data-n-onglet="ventes"]'), surOnglet('ventes'), { capture: false });
      await defiler(260); await pg.waitForTimeout(300);
      const yVentes = await defile();
      const v = await geste('vente-ouverte', tapLigne('.vrm-main .n-rangee-corps', 2), feuilleOuverte);
      if (v.ok) await retour('vente-retour', 'ventes', yVentes);
      await defiler(0);
      await pg.evaluate(() => { window.__piImpr = 0; const o = window.open; window.open = (...a) => { window.__piImpr++; return o ? o.apply(window, a) : null; }; window.print = () => { window.__piImpr++; }; });
      const im = await geste('imprimer', tap('[data-imprimer-prets]'), { quoi: 'un PDF, une impression ou une feuille', f: () => window.__piImpr > 0 || [...document.querySelectorAll('[role="dialog"], .vrm-fs, .n-feuille, .n-poussee, [data-n-recherche-ouverte]')].some((d) => d.getBoundingClientRect().height > 20) });
      if (im.ok && await feuillePresente()) await retour('imprimer-retour', 'ventes', null);
      // 5. Achats → À retirer → code en grand → retour
      await geste('achats', tap('.n-onglet[data-n-onglet="achats"]'), surOnglet('achats'), { capture: false });
      await pg.waitForSelector('[aria-label="Montrer le code en grand"], [data-hl-code]', { timeout: 10000 }).catch(() => {});   // les codes arrivent après le reste (voir SAUTS_CONNUS)
      const dejaOuvert = await pg.evaluate(() => !!document.querySelector('[data-hl-code], [data-retrait-code], [data-code-retrait], [data-retirer-code], [aria-label="Montrer le code en grand"]'));
      note(`À retirer ${dejaOuvert ? 'déjà ouvert à l\'arrivée sur Achats' : 'replié'}`);
      const ar = dejaOuvert ? { ok: true } : await geste('a-retirer', tap('.vrm-achats-retirer-ligne'), { quoi: 'la liste « À retirer »', f: () => !!document.querySelector('[data-hl-code], [data-retrait-code], [data-code-retrait], [data-retirer-code]') });
      const selGrand = '[data-hl-en-grand], [data-en-grand], [aria-label="Montrer le code en grand"]';
      if (await pg.locator(selGrand).count()) {
        await pg.locator(selGrand).first().evaluate((e) => e.scrollIntoView({ block: 'center' })); await pg.waitForTimeout(400);
        const yA = await defile();
        const g = await geste('code-en-grand', tap(selGrand), { quoi: 'le code en grand', f: () => [...document.querySelectorAll('[role="dialog"], .vrm-fs, .n-feuille, .n-poussee, [data-hl-en-grand-code], [data-code-grand]')].some((d) => d.getBoundingClientRect().height > 20) });
        if (g.ok && await feuillePresente()) await retour('code-retour', 'achats', yA);
      } else dit(false, 'a-retirer : aucun bouton pour le code en grand (P3)');
      void ar;
      // 6. Annonces → une annonce → retour
      await geste('annonces', tap('.n-onglet[data-n-onglet="paires"]'), surOnglet('paires'), { capture: false });
      await defiler(300); await pg.waitForTimeout(300);
      const yAnn = await defile();
      const an = await geste('annonce-ouverte', tapLigne('.vrm-main .n-ar-corps', 3), feuilleOuverte);
      if (an.ok) await retour('annonce-retour', 'paires', yAnn);
      // 7. Argent → un mois → retour
      await geste('argent', tap('.n-onglet[data-n-onglet="compta"]'), surOnglet('compta'), { capture: false });
      const am = await geste('argent-mois', tap('[data-argent-q="vendu"]'), change);
      // Argent ↔ Statistiques sont des SEGMENTS d'Argent (src/navHistorique.js : l'un remplace l'autre, voulu) : on revient par « Résumé ».
      if (am.ok) await geste('argent-resume', tap('[data-section="resume"], [data-argent-seg="resume"], .vrm-seg-btn >> nth=0'), { quoi: 'le résumé', f: () => !!document.querySelector('[data-argent-q="vendu"]') });
      // 8. Messages
      const ms = await geste('messages', tap('[data-n-coque-messages]'), change);
      if (ms.ok) { await basDePage('messages'); await defiler(0); }
      // 9. Paramètres : le menu, puis chaque section
      const pm = await geste('menu', tap('[data-n-coque-plus]'), change);
      if (pm.ok) {
        await basDePage('menu');
        const pr = await geste('parametres', tap('[data-nav-entree="settings"]'), change);
        const sections = pr.ok ? await pg.evaluate(() => [...document.querySelectorAll('[data-categorie-ouvrir]')].map((x) => x.getAttribute('data-categorie-ouvrir'))) : [];
        note(`Paramètres : ${sections.length} sections (${sections.join(', ')})`);
        for (const s of sections) {
          const r = await geste(`parametres-${s}`, tap(`[data-categorie-ouvrir="${s}"]`), change);
          if (r.ok) { await basDePage(`parametres-${s}`); await retour(`parametres-${s}-retour`, null, null); }
          if (!(await pg.locator(`[data-categorie-ouvrir="${s}"]`).count())) { dit(false, `parametres-${s} : le retour ne ramène pas aux sections (P4)`); break; }
        }
      }
      // 10. La loupe
      if (await feuillePresente()) await pg.goBack().catch(() => {});
      await pg.locator('.n-onglet[data-n-onglet="journee"]').tap().catch(() => {}); await pg.waitForTimeout(800);
      const lp = await geste('loupe', tap('[data-recherche-loupe], [data-n-tete-loupe]'), { quoi: 'la recherche ouverte', f: () => !!document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName) });
      if (lp.ok) {
        // P11 : une ligne « colis » de la loupe dit le NOM du transporteur, jamais son identifiant machine (« mondial_relay »)
        await pg.waitForSelector('[data-recherche-resultat="colis"]', { timeout: 5000 }).catch(() => {});
        const colis = await pg.evaluate(() => [...document.querySelectorAll('[data-recherche-resultat="colis"]')].map((x) => (x.innerText || '').split('\n')[0].trim()));
        dit(colis.length > 0 && colis.every((t) => !/_/.test(t) && !/^Colis [a-z]/.test(t)), 'loupe : chaque colis porte le nom de son transporteur (P11)', colis.join(' | '));
        await pg.keyboard.type('1205', { delay: 40 }).catch(() => {});
        await geste('loupe-resultat', async () => {}, { quoi: 'un résultat', f: () => /1205/.test(document.body.innerText.replace(/\D+/g, ' ')) });
        if (await pg.evaluate(() => !!document.querySelector('[data-n-recherche-ouverte]'))) await retour('loupe-retour', 'journee', null);
        dit(await pg.evaluate(() => !document.querySelector('[data-n-recherche-ouverte]')), 'loupe : le retour ferme la recherche (P4)');
      }
      // 11. Tourner
      await geste('paysage', () => pg.setViewportSize({ width: 844, height: 390 }), null);
      await geste('portrait', () => pg.setViewportSize({ width: 390, height: 844 }), null);
      // 12. Quitter l'app (arrière-plan) puis revenir
      await geste('ventes-avant-arriere-plan', tap('.n-onglet[data-n-onglet="ventes"]'), surOnglet('ventes'), { capture: false });
      await defiler(300); await pg.waitForTimeout(300);
      const yQ = await defile();
      await geste('arriere-plan', () => pg.evaluate(async () => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange')); dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
        await new Promise((r) => setTimeout(r, 1500));
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        window.__pi.toucher = performance.now(); dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); document.dispatchEvent(new Event('visibilitychange')); dispatchEvent(new Event('focus'));
      }), surOnglet('ventes'));
      { const y = await defile(); dit(Math.abs(y - yQ) <= 40, 'arrière-plan : de retour au même endroit (P5)', `${yQ} → ${y}`); }
      // 13. Réseau lent (3 s par lecture) : chaque onglet reste dessiné pendant le chargement
      LENT.ms = 3000;
      await geste('lent-recharge', () => pg.reload({ waitUntil: 'domcontentloaded' }), { quoi: 'la coque dessinée', f: () => !!document.querySelector('.n-onglets') }, { lent: LENT.ms + 1500 });
      for (const id of ['achats', 'compta', 'journee']) await geste(`lent-${id}`, tap(`.n-onglet[data-n-onglet="${id}"]`), surOnglet(id));
      LENT.ms = 0;
      // 14. (24 nov., lot sauts-orange — trouvé par le lot tutos) Argent PAS ENCORE CALCULÉ (les ventes ne se lisent pas) avec un
      // statut choisi : la carte URSSAF est basse (ni montant ni pied) et « J'ai déclaré » couvrait « avant le 30 nov. ».
      // P7 bis : le bouton ne couvre aucun texte de sa carte (et P7 : aucun texte sur un autre).
      await pg.evaluate(() => { try { localStorage.setItem('vinted_regime', JSON.stringify('micro')); localStorage.setItem('vinted_urssaf_freq', JSON.stringify('mensuel')); localStorage.removeItem('vinted_urssaf_mois'); } catch (_) {} });
      PANNE.re = /orders|vinted_urssaf_mois|ventes/;
      await geste('argent-pas-calcule', () => pg.goto(pg.url().replace(/\?.*$/, '') + '?tab=compta', { waitUntil: 'domcontentloaded' }), { quoi: 'la carte URSSAF', f: () => !!document.querySelector('.vg-a-urssaf') }, { lent: 8000 });
      await pg.waitForTimeout(1500);
      const urs = await pg.evaluate(() => {
        const c = document.querySelector('.vg-a-urssaf'); if (!c) return { etat: 'pas de carte' };
        const b = c.querySelector('.vg-a-declare'); if (!b) return { etat: c.getAttribute('data-argent-urssaf') || '', bouton: false };
        const rb = b.getBoundingClientRect(); const sur = [];
        for (const el of c.querySelectorAll('*')) { if (el === b || b.contains(el) || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
          const rg = document.createRange(); rg.selectNodeContents(el);
          for (const r of rg.getClientRects()) { const w = Math.min(r.right, rb.right) - Math.max(r.left, rb.left), h = Math.min(r.bottom, rb.bottom) - Math.max(r.top, rb.top); if (w > 2 && h > 2) { sur.push((el.innerText || '').trim().slice(0, 24)); break; } } }
        return { etat: c.getAttribute('data-argent-urssaf') || '', bouton: true, pied: !!c.querySelector('.vg-a-urssaf-pied'), sur };
      });
      dit(urs.bouton === true && urs.pied === false, 'argent-pas-calcule : la carte URSSAF est dans l\'état voulu (statut choisi, rien de calculé, « J\'ai déclaré » montré)', JSON.stringify(urs));
      dit(urs.bouton === true && urs.sur.length === 0, 'argent-pas-calcule : « J\'ai déclaré » ne couvre aucun texte de sa carte (P7 bis)', (urs.sur || []).join(' | '));
      PANNE.re = null;
      await o.ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
  const rouges = rapport.filter((l) => l.startsWith('❌'));
  console.log(`\n${rouges.length ? '❌' : '✅'} parcours iPhone (${NAVIGATEUR}) : ${rouges.length} rouge(s) — captures : ${SHOTS}`);
  for (const l of rouges) console.log('   ' + l);
  if (rouges.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
