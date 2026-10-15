// ═══════════════════════════════════════════════════════════════════════════
// BANC : ACHATS — colis à retirer lisibles, achats hors Vinted faciles, prix
//        d'achat sans paire, boost jamais inventé (15 octobre)
//        (node scripts/bancs/achats.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Demande de Julien (15 oct.) :
//   « le bouton À retirer est collé au code de retrait » · « je n'ai pas le
//   détail du colis, où il est arrivé » · « il me met point relais Tabac au lieu
//   de Mondial Relay » · « les achats hors Vinted… pas tout en bas de la page » ·
//   « des fois on veut juste mettre le prix d'achat » · « le prix du boost doit
//   être calculé automatiquement ».
// Données INVENTÉES (il vit dans le dépôt, qui est public). Aux deux tailles
// (390 px tactile, 1512 px), il exige :
//   A. RETRAIT — un e-mail Mondial Relay au « TABAC DU PORT » : le COMMERCE en
//      tête (« Tabac du Port »), son ADRESSE affichée, le TRANSPORTEUR à part
//      (« Mondial Relay », jamais en titre de carte), la source, et un lien
//      « Suivre » vers le transporteur. Un colis de la conversation Vinted au
//      « point relais TABAVAP, TABAVAP, 12 RUE HOCHE… » : « Tabavap » (pas
//      « point relais TABAVAP »), l'adresse, AUCUNE pastille « Vinted Go »
//      inventée, « Transporteur non indiqué ». Et « J'ai retiré » ne touche
//      JAMAIS un code (rectangles disjoints, ≥ 8 px d'écart ; ≥ 44 px de haut
//      au doigt). Le code copié garde ses zéros.
//   B. HORS VINTED — l'entrée est visible SANS défiler ; taper « 25 » dans le
//      prix donne 25 (l'ancien formulaire, déclaré dans le rendu, donnait « 2 »
//      et envoyait le « 5 » dans la désignation) ; frais, quantité, provenance ;
//      enregistrer SANS paire n'écrit aucun prix par numéro.
//   C. PRIX SANS RELIER — sur une vente, « Prix d'achat » ouvre un champ :
//      35 € enregistrés sans lien. Puis le lot (2 paires, 28,50 €) se rattache à
//      DEUX ventes (14,25 € chacune) et n'est plus proposé à une troisième
//      (aucun doublon).
//   D. BOOST — une annonce boostée sans montant connu dit « boost inconnu » et
//      « marge hors boost » ; un montant corrigé s'affiche ; une annonce non
//      boostée ne parle pas de boost ; le champ « Boost payé » obligatoire n'est
//      plus là (« Boost (si connu) »).
//   E. Aucune erreur, aucun débordement, aucun écran tombé — en clair ET en
//      sombre.
//   F. RELECTURE DU 15 OCTOBRE — la VRAIE forme des e-mails Vinted Go (lue en
//      production) : « *Consigne Vinted Go*, * Kusmi Tea *, * 13 Rue
//      Saint-Vincent ». Le point relais est le COMMERCE (« Kusmi Tea »), jamais
//      le type de casier ; aucun « * » ; « consigne » sur l'étiquette ; deux
//      casiers de deux commerces = deux groupes. Un transporteur « autre » ne
//      s'affiche pas comme un nom (« 📦 Transporteur »). Un point SANS lieu dit
//      la cause une fois, et sa source n'est pas « la conversation » (rien n'en
//      a été lu). Sur téléphone, aucune ligne d'en-tête ne commence par « · ».
//   G. « Associer à une paire » APPARAÎT dans le formulaire ouvert depuis
//      Achats (il ne s'affichait jamais : les annonces n'y étaient pas lues),
//      rattache pour de vrai, et ne se propose plus sur un achat déjà plein.
//   H. « Dépensé » suit la RECHERCHE pour les achats hors Vinted aussi.
//   I. Vente Vinted : un boost vide est INCONNU — « tous les frais sont
//      renseignés » ne se coche pas, le bénéfice reste « estimé » ; 0 tapé ⇒
//      complet. Aucune consigne « laisse la case vide » à côté de « cases vides
//      = 0 € ».
//   J. Pas de boîte vide (trait orphelin) sous la liste « Hors Vinted ».
// On juge des attributs (`data-*`), des rectangles et des valeurs écrites,
// jamais une formulation libre.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 5911;
const CAPT = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-achats');
fs.mkdirSync(CAPT, { recursive: true });

const MAINTENANT = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const jour = (j) => new Date(MAINTENANT + j * 86400000).toISOString().slice(0, 10);
const ann = (id, o) => Object.assign({ id, price: { amount: '60.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 10, favourite_count: 1, created_at_ts: Math.floor((MAINTENANT - 3 * 86400000) / 1000) }, o);
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(MAINTENANT) }];
const ROWS0 = () => [
  { id: 'main', data: { vinted_annonce_numeros: {
    '9001': { numero: '1', buyPrice: '30', accountId: '111' },
    '9002': { numero: '2', buyPrice: '20', fees: '2.50', accountId: '111' },
    '9003': { numero: '3', buyPrice: '25', accountId: '111' },
  } } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(MAINTENANT - 60000), payload: { items: [
    ann(9001, { title: 'Alpha boostée sans montant taille 42', promoted: true }),
    ann(9002, { title: 'Bravo boostée montant corrigé taille 41', promoted: true }),
    ann(9003, { title: 'Charlie jamais boostée taille 40' }),
  ] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(MAINTENANT - 60000), payload: { my_orders: [
    { transaction_id: 7001, title: 'Paire relais conversation', price: { amount: '40.0', currency_code: 'EUR' }, status: 'Colis déposé en bureau de Poste ou point relais', transaction_user_status: 'needs_action', date: iso(MAINTENANT - 3 * 86400000), conversation_id: 55001 },
    // F. Un colis au relais dont la conversation n'a donné AUCUN lieu.
    { transaction_id: 7003, title: 'Paire sans lieu', price: { amount: '33.0', currency_code: 'EUR' }, status: 'Colis déposé en bureau de Poste ou point relais', transaction_user_status: 'needs_action', date: iso(MAINTENANT - 2 * 86400000), conversation_id: 55003 },
  ] } } },
  { id: 'panel_colis_relais', data: { '7001': { tx: '7001', item: '', titre: 'Paire relais conversation', lieu: 'point relais TABAVAP, TABAVAP, 12 RUE HOCHE, 56000 VANNES', code: 'C01234', qr: '', conv: '55001', url: 'https://www.vinted.fr/inbox/55001', photo: null, at: iso(MAINTENANT - 3600000) },
    '7003': { tx: '7003', item: '', titre: 'Paire sans lieu', lieu: '', code: '', qr: '', conv: '55003', url: 'https://www.vinted.fr/inbox/55003', photo: null, at: iso(MAINTENANT - 3600000) } } },
  { id: 'email_track_mr1', data: { id: 'mr1', carrier: 'mondial', status: 'available', lieu: 'TABAC DU PORT 12 RUE HOCHE 56000 VANNES', code: '012345', suivi: 'MR-TRACK-1', receivedAt: iso(MAINTENANT - 86400000), limite: jour(3) } },
  // Une consigne Chronopost : DEUX nombres (identifiant + code d'ouverture), délai dépassé.
  { id: 'email_track_ch1', data: { id: 'ch1', carrier: 'chronopost', status: 'available', consigne: true, lieu: 'CONSIGNE PICKUP GARE 1 PLACE DE LA GARE 35000 RENNES', code: '004567', code2: '009876', suivi: 'CH-TRACK-2', receivedAt: iso(MAINTENANT - 2 * 86400000), limite: jour(-1) } },
  // F. La forme RÉELLE d'un e-mail Vinted Go (lue en production le 15 oct.) : le
  //    gras de l'e-mail (« * ») et le TYPE en tête. Deux casiers, deux commerces.
  { id: 'email_track_vg1', data: { id: 'vg1', carrier: 'vinted', status: 'available', consigne: false, lieu: '*Consigne Vinted Go*, * Kusmi Tea *, * 13 Rue Saint-Vincent', code: 'C49341', suivi: 'VGS-TRACK-1', receivedAt: iso(MAINTENANT - 3 * 3600000), limite: jour(4) } },
  { id: 'email_track_vg2', data: { id: 'vg2', carrier: 'vinted', status: 'available', consigne: false, lieu: '*Consigne Vinted Go*, * Speed Queen - Vannes *, * 24 Rue Hoche', code: 'C77777', suivi: 'VGS-TRACK-2', receivedAt: iso(MAINTENANT - 4 * 3600000), limite: jour(5) } },
  // F. Un transporteur que le serveur ne connaît pas (`carrier: 'autre'`, son filet).
  { id: 'email_track_au1', data: { id: 'au1', carrier: 'autre', status: 'available', lieu: 'BAR DES SPORTS, 3 RUE DE LA PAIX, 35000 RENNES', code: '445566', suivi: 'XX-TRACK-3', receivedAt: iso(MAINTENANT - 5 * 3600000), limite: jour(6) } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(MAINTENANT - 60000), payload: { my_orders: [
    { transaction_id: 8001, title: 'Vente Delta taille 41', price: { amount: '70.0', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(MAINTENANT - 2 * 86400000) },
    { transaction_id: 8002, title: 'Vente Echo taille 42', price: { amount: '65.0', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(MAINTENANT - 3 * 86400000) },
    { transaction_id: 8003, title: 'Vente Foxtrot taille 43', price: { amount: '55.0', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(MAINTENANT - 4 * 86400000) },
    { transaction_id: 8004, title: 'Vente Golf taille 44', price: { amount: '50.0', currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: iso(MAINTENANT - 5 * 86400000) },
  ] } } },
];

let ko = 0, n = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
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
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const rows = ROWS0();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); if (s) { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    // Une écriture de `main` est GARDÉE (§6.3) : sans ça, l'écran suivant
    // relirait l'ancien `main` et le banc mesurerait une fiction.
    if (route.request().method() !== 'GET') {
      try { const corps = JSON.parse(route.request().postData() || 'null'); for (const l of [].concat(corps || [])) if (l && l.id === 'main' && l.data) rows[0].data = l.data; } catch (_) {}
      return j([]);
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(MAINTENANT), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, rows };
}
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}
const ls = (pg, k) => pg.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }, k);
const ouvrirDetails = (pg, sel) => pg.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; let d = e.closest('details'); while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); } e.scrollIntoView({ block: 'center' }); return true; }, sel);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      const { ctx, pg, errs } = await preparer(b, vp, false);
      const tactile = vp.width < 600;

      // ── A. Colis à retirer ───────────────────────────────────────────────
      await essaie('A. retrait', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('.vrm-pickup-card', { timeout: 15000 });
        await pg.waitForTimeout(1200);
        const g = await pg.evaluate(() => {
          const pts = [...document.querySelectorAll('.vrm-pickup-point')];
          const lire = (p) => ({
            texte: p.innerText,
            src: (p.querySelector('[data-source]') || {}).getAttribute ? p.querySelector('[data-source]').getAttribute('data-source') : null,
            transp: (p.querySelector('[data-transporteur]') || {}).getAttribute ? p.querySelector('[data-transporteur]').getAttribute('data-transporteur') : null,
            nom: ((p.querySelector('[data-point-relais]') || {}).innerText || '').trim(),
            adresse: ((p.querySelector('[data-adresse]') || {}).innerText || '').trim(),
            vintedGo: !!p.querySelector('[title="Vinted Go"]'),
            titres: [...p.querySelectorAll('.vrm-pickup-card')].map((c) => (c.innerText.split('\n').map((x) => x.trim()).filter(Boolean)[0] || '')),
          });
          const email = pts.find((p) => /012345/.test(p.innerText));
          const conv = pts.find((p) => /C01234/.test(p.innerText));
          return { email: email ? lire(email) : null, conv: conv ? lire(conv) : null };
        });
        const e = g.email || {}, c = g.conv || {};
        dit(!!g.email && e.nom === 'Tabac du Port', 'e-mail : le point relais est le COMMERCE (« Tabac du Port »)', JSON.stringify(e.nom || (e.texte || '').slice(0, 60)));
        dit(!!g.email && /12 Rue Hoche/i.test(e.adresse || ''), 'e-mail : l’adresse du point relais est AFFICHÉE', JSON.stringify(e.adresse));
        dit(!!g.email && e.transp === 'mondialrelay' && /Mondial Relay/.test(e.texte), 'e-mail : le transporteur est écrit à part (« Mondial Relay »)', e.transp);
        dit(!!g.email && !e.titres.some((t) => /^Mondial Relay$/i.test(t)), 'e-mail : aucune carte n’a le transporteur pour TITRE', JSON.stringify(e.titres));
        dit(!!g.email && e.src === 'email', 'e-mail : la source est dite', e.src);
        dit(!!g.conv && c.nom === 'Tabavap', 'conversation : « Tabavap », pas « point relais TABAVAP »', JSON.stringify(c.nom || (c.texte || '').slice(0, 60)));
        dit(!!g.conv && /12 Rue Hoche, 56000 Vannes/.test(c.adresse || ''), 'conversation : l’adresse sans le nom répété', JSON.stringify(c.adresse));
        dit(!!g.conv && !c.vintedGo, 'conversation : AUCUNE pastille « Vinted Go » inventée', String(c.vintedGo));
        dit(!!g.conv && c.transp === 'inconnu', 'conversation : « Transporteur non indiqué » (Vinted ne le dit pas)', c.transp);
        dit(!!g.conv && c.src === 'conversation', 'conversation : la source est dite', c.src);

        // « J'ai retiré » ne touche aucun code ni QR.
        const geo = await pg.evaluate(() => [...document.querySelectorAll('.vrm-pickup-card')].map((card) => {
          const btn = card.querySelector('button[aria-label="J’ai retiré ce colis"]');
          const r = (el) => { const x = el.getBoundingClientRect(); return { l: x.left, t: x.top, r: x.right, b: x.bottom }; };
          return { btn: btn ? r(btn) : null, codes: [...card.querySelectorAll('.vrm-pickup-code, button[aria-label^="Afficher le QR"]')].map(r) };
        }));
        const ecart = (a, z) => Math.max(z.l - a.r, a.l - z.r, z.t - a.b, a.t - z.b);   // < 0 : chevauchement
        const pire = geo.flatMap((g) => g.btn ? g.codes.map((z) => ecart(g.btn, z)) : []).reduce((m, x) => Math.min(m, x), Infinity);
        dit(geo.length >= 3 && geo.every((g) => g.btn) && geo.some((g) => g.codes.length), 'chaque carte porte « J’ai retiré » et au moins une porte un code', JSON.stringify(geo.map((g) => [!!g.btn, g.codes.length])));
        dit(pire >= 8, '« J’ai retiré » est SÉPARÉ du code (≥ 8 px, jamais par-dessus)', `écart minimal ${Math.round(pire)} px`);
        if (tactile) {
          const h = Math.min(...geo.filter((g) => g.btn).map((g) => g.btn.b - g.btn.t));
          dit(h >= 44, '« J’ai retiré » fait au moins 44 px au doigt', `${Math.round(h)} px`);
        }
        // La consigne : les DEUX nombres, chacun copiable, et le délai dépassé dit.
        const consigne = await pg.evaluate(() => ({
          ident: !!document.querySelector('button[aria-label="Copier identifiant 009876"]'),
          ouv: !!document.querySelector('button[aria-label="Copier code d’ouverture 004567"]'),
          delai: /délai dépassé/.test(document.body.innerText),
          suiviCache: !/CH-TRACK-2/.test(document.body.innerText),
        }));
        dit(consigne.ident && consigne.ouv, 'consigne : l’identifiant ET le code d’ouverture, chacun copiable', JSON.stringify(consigne));
        dit(consigne.delai, 'consigne : le délai dépassé reste dit');
        dit(consigne.suiviCache, 'le n° de suivi n’est pas présenté comme un code (il est dans le détail du colis)');
        // Le suivi et son lien, dans le détail du colis.
        const suivre = await pg.evaluate(() => { const a = [...document.querySelectorAll('a[data-suivre]')].find((x) => /mondialrelay/.test(x.getAttribute('href'))); return a ? a.getAttribute('href') : ''; });
        dit(/mondialrelay\.fr/.test(suivre) && /MR-TRACK-1/.test(suivre), 'le n° de suivi mène au suivi du transporteur', suivre || 'aucun lien');
        // Le code copié garde ses zéros.
        await pg.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (v) => { window.__copie = v; } } }); });
        await pg.click('button[aria-label="Copier code de retrait 012345"]', { timeout: 5000 });
        dit(await pg.evaluate(() => window.__copie) === '012345', 'le code copié garde son zéro de tête', String(await pg.evaluate(() => window.__copie)));
        await pg.screenshot({ path: path.join(CAPT, `achats-retrait-${vp.width}.png`), fullPage: true }).catch(() => {});
        await sain(pg, 'Achats · à retirer');
      });

      // ── F. Relecture : la vraie forme Vinted Go, « autre », un point sans lieu ──
      await essaie('F. en-têtes de retrait', async () => {
        const f = await pg.evaluate(() => {
          const grp = (v) => [...document.querySelectorAll('.vrm-pickup-point')].find((p) => p.querySelector(`[data-code="${v}"]`) || p.querySelector(`[data-tx="${v}"]`));
          const lire = (p) => p ? ({
            nom: ((p.querySelector('[data-point-relais]') || {}).innerText || '').trim(),
            adresse: ((p.querySelector('[data-adresse]') || {}).innerText || '').trim(),
            type: p.querySelector('[data-type-lieu]') ? p.querySelector('[data-type-lieu]').getAttribute('data-type-lieu') : null,
            transp: p.querySelector('[data-transporteur]') ? p.querySelector('[data-transporteur]').getAttribute('data-transporteur') : null,
            transpTexte: ((p.querySelector('[data-transporteur]') || {}).innerText || '').replace(/[\s\u00a0·]+$/, '').trim(),
            src: p.querySelector('[data-source]') ? p.querySelector('[data-source]').getAttribute('data-source') : null,
            entete: (p.firstElementChild || p).innerText,
          }) : null;
          const ga = grp('C49341'), gb = grp('C77777');
          const debris = [...document.querySelectorAll('.vrm-pickup-point')].flatMap((p) => (p.firstElementChild || p).innerText.split('\n').map((l) => l.trim()).filter((l) => /^·/.test(l)));
          return { a: lire(ga), b: lire(gb), au: lire(grp('445566')), sl: lire(grp('7003')), meme: !!(ga && gb && ga === gb), debris };
        });
        const a = f.a || {}, bb = f.b || {}, au = f.au || {}, sl = f.sl || {};
        dit(!!f.a && a.nom === 'Kusmi Tea', 'Vinted Go (e-mail) : le point relais est le COMMERCE (« Kusmi Tea »), pas le type de casier', JSON.stringify(a.nom));
        dit(!!f.a && a.adresse === '13 Rue Saint-Vincent', 'Vinted Go : l’adresse est l’adresse, sans le commerce', JSON.stringify(a.adresse));
        dit(!!f.a && !/\*/.test(a.entete), 'Vinted Go : aucun « * » de l’e-mail à l’écran', JSON.stringify((a.entete || '').slice(0, 90)));
        dit(!!f.a && a.type === 'consigne' && a.transp === 'vinted', 'Vinted Go : « consigne » sur l’étiquette, « Vinted Go » sur la ligne du transporteur', JSON.stringify([a.type, a.transp]));
        dit(!!f.b && bb.nom === 'Speed Queen - Vannes' && !f.meme, 'deux casiers de deux commerces = deux points distincts', JSON.stringify([bb.nom, f.meme]));
        dit(!!f.au && au.transp === 'inconnu' && !/📦/.test(au.entete) && au.transpTexte !== 'Transporteur', 'transporteur « autre » : pas de pastille ni de faux nom (« 📦 Transporteur »)', JSON.stringify([au.transp, au.transpTexte]));
        const nConv = ((sl.entete || '').match(/conversation/gi) || []).length;
        dit(!!f.sl && sl.src !== 'conversation' && !/conversation/i.test(sl.nom), 'point sans lieu : la case du nom ne porte pas une consigne, et la source n’est pas « la conversation » (rien n’en a été lu)', JSON.stringify([sl.nom, sl.src]));
        dit(!!f.sl && nConv <= 1, 'point sans lieu : la cause est dite UNE fois', `${nConv} × « conversation »`);
        if (tactile) dit(f.debris.length === 0, 'téléphone : aucune ligne d’en-tête ne commence par « · »', JSON.stringify(f.debris.slice(0, 3)));
        const g = await pg.$('.vrm-pickup-point:has([data-code="C49341"])');
        if (g) { await g.scrollIntoViewIfNeeded(); await g.screenshot({ path: path.join(CAPT, `achats-vintedgo-${vp.width}.png`) }).catch(() => {}); }
        const g2 = await pg.$('.vrm-pickup-point:has([data-tx="7003"])');
        if (g2) { await g2.scrollIntoViewIfNeeded(); await g2.screenshot({ path: path.join(CAPT, `achats-sanslieu-${vp.width}.png`) }).catch(() => {}); }
      });

      // ── B. Achat hors Vinted ─────────────────────────────────────────────
      let idLot = null;
      await essaie('B. hors Vinted', async () => {
        // On mesure là où il ARRIVE : en haut de l'écran (le clic « Copier »
        // ci-dessus a pu faire défiler la page).
        await pg.evaluate(() => { window.scrollTo(0, 0); for (const e of document.querySelectorAll('*')) if (e.scrollTop) e.scrollTop = 0; });
        await pg.waitForTimeout(200);
        const entree = await pg.evaluate(() => {
          const e = document.querySelector('[data-ajout-achat-hors]') || [...document.querySelectorAll('button')].find((x) => /hors Vinted/i.test(x.innerText));
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { top: r.top, bas: r.bottom, h: innerHeight, nouveau: e.hasAttribute('data-ajout-achat-hors') };
        });
        dit(!!entree && entree.top >= 0 && entree.bas <= entree.h, 'l’entrée « achat hors Vinted » est visible SANS défiler', entree ? `haut ${Math.round(entree.top)} / écran ${entree.h}` : 'introuvable');
        if (entree && entree.nouveau) await pg.click('[data-ajout-achat-hors]');
        else {
          // L'ancien chemin (pour mesurer le défaut sur le build d'avant) :
          // déplier la section, puis « ➕ Ajouter ».
          await pg.evaluate(() => { const e = [...document.querySelectorAll('button')].find((x) => /Achats hors Vinted/.test(x.innerText)); if (e) e.click(); });
          await pg.waitForTimeout(300);
          await pg.evaluate(() => { const e = [...document.querySelectorAll('button')].find((x) => /Ajouter$/.test(x.innerText.trim())); if (e) e.click(); });
        }
        await pg.waitForTimeout(400);
        const prix = (await pg.$('[data-champ="prix"]')) || (await pg.$('input[placeholder="0"][inputmode="decimal"]'));
        await prix.click();
        await pg.keyboard.type('25', { delay: 40 });
        await pg.waitForTimeout(150);
        const apres = await pg.evaluate(() => { const p = document.querySelector('[data-champ="prix"]') || document.querySelector('input[placeholder="0"][inputmode="decimal"]'); const a = document.activeElement; return { v: p ? p.value : null, focus: a === p }; });
        dit(apres.v === '25' && apres.focus, 'taper « 25 » dans le prix donne 25, et le curseur reste dans le prix', JSON.stringify(apres));
        if (!(await pg.$('[data-form-achat-hors]'))) throw new Error('formulaire « achat hors Vinted » introuvable');
        await pg.fill('[data-champ="frais"]', '3,50');
        await pg.fill('[data-champ="quantite"]', '2');
        await pg.click('[data-provenance="lot"]');
        await pg.fill('[data-champ="titre"]', 'Lot brocante deux paires');
        const part = await pg.getAttribute('[data-part-par-paire]', 'data-part-par-paire');
        dit(part === '1425', 'un lot de 2 à 28,50 € (prix + frais) ⇒ ≈ 14,25 € par paire, dit « réparti »', part);
        const avantNum = await ls(pg, 'vinted_buyprice_by_num');
        await pg.click('[data-enregistrer-achat]');
        await pg.waitForTimeout(1200);
        const ob = (await ls(pg, 'vinted_offvinted_buys')) || [];
        const x = ob[0] || {};
        idLot = x.id || null;
        dit(ob.length === 1 && x.price === '25.00' && x.frais === '3.50' && x.quantite === 2 && x.source === 'lot', 'l’achat est enregistré : prix, frais, quantité, provenance', JSON.stringify(x));
        dit(JSON.stringify(await ls(pg, 'vinted_buyprice_by_num')) === JSON.stringify(avantNum), 'enregistré SANS paire : aucun prix posé sur un numéro', JSON.stringify(await ls(pg, 'vinted_buyprice_by_num')));
        const liste = await pg.evaluate(() => { const l = document.querySelector('[data-liste-hors]'); return l ? l.innerText : ''; });
        dit(/28,50/.test(liste) && /14,25/.test(liste), 'la liste « Hors Vinted » montre le total et la part par paire', liste.slice(0, 120));
        await pg.screenshot({ path: path.join(CAPT, `achats-hors-${vp.width}.png`), fullPage: true }).catch(() => {});
        await sain(pg, 'Achats · hors Vinted');
      });

      // ── G. « Associer à une paire » depuis l'écran Achats ────────────────
      await essaie('G. associer à une paire', async () => {
        await pg.evaluate(() => window.scrollTo(0, 0));
        await pg.click('[data-ajout-achat-hors]');
        const champ = await pg.waitForSelector('[data-champ="paire"]', { timeout: 8000 }).catch(() => null);
        const opts = champ ? await pg.$$eval('[data-champ="paire"] option', (l) => l.map((o) => o.value)) : [];
        dit(!!champ && ['9001', '9002', '9003'].every((v) => opts.includes(v)), 'ouvert depuis Achats, « Associer à une paire » apparaît et propose les paires numérotées', champ ? JSON.stringify(opts) : 'champ absent');
        if (!champ) { await pg.click('button[aria-label="Fermer"]').catch(() => {}); return; }
        await pg.fill('[data-champ="prix"]', '40');
        await pg.fill('[data-champ="titre"]', 'Brocante une paire');
        await pg.selectOption('[data-champ="paire"]', '9003');
        await pg.click('[data-enregistrer-achat]');
        await pg.waitForTimeout(1200);
        const x = ((await ls(pg, 'vinted_offvinted_buys')) || []).find((y) => y.title === 'Brocante une paire') || {};
        const num = ((await ls(pg, 'vinted_annonce_numeros')) || {})['9003'] || {};
        dit(!!x.id && num.buyFromId === `hors:${x.id}` && num.buyPrice === '40.00', 'l’achat est rattaché à la paire choisie : 40 €, lien posé sur la fiche', JSON.stringify({ f: num.buyFromId, p: num.buyPrice }));
        if (x.id) {
          await pg.click(`[data-achat-hors="${x.id}"] button[aria-label="Modifier cet achat"]`);
          await pg.waitForTimeout(500);
          dit(!(await pg.$('[data-champ="paire"]')) && !(await pg.$('[data-champ-paire]')), 'un achat déjà rattaché à toutes ses paires ne repropose pas de paire (un second lien serait refusé)');
          await pg.click('button[aria-label="Fermer"]').catch(() => {});
          await pg.waitForTimeout(300);
        }
      });

      // ── J. Pas de boîte vide sous « Hors Vinted » ─────────────────────────
      await essaie('J. trait orphelin', async () => {
        const trait = await pg.evaluate(() => {
          const l = document.querySelector('[data-liste-hors]'); if (!l) return 'liste « Hors Vinted » introuvable';
          for (let e = l.nextElementSibling; e; e = e.nextElementSibling) {
            const r = e.getBoundingClientRect(), st = getComputedStyle(e);
            if (r.height > 0 && r.height < 6 && !e.children.length && !(e.innerText || '').trim() && parseFloat(st.borderTopWidth) > 0) return e.outerHTML.slice(0, 140);
          }
          return '';
        });
        dit(trait === '', 'aucune boîte vide (trait orphelin) sous la liste « Hors Vinted »', trait);
      });

      // ── H. « Dépensé » suit la recherche, hors Vinted compris ──────────────
      await essaie('H. dépensé', async () => {
        await pg.evaluate(() => window.scrollTo(0, 0));
        if (await pg.$('[data-filtre-achats="all"]')) await pg.click('[data-filtre-achats="all"]');
        else await pg.evaluate(() => { const t = [...document.querySelectorAll('button')].find((x) => /^Tous\b/.test(x.innerText.trim())); if (t) t.click(); });
        await pg.waitForTimeout(600);
        // Le montant : l'attribut quand il existe, sinon le chiffre rendu (pour
        // mesurer le build d'avant, qui ne le porte pas).
        const depense = () => pg.evaluate(() => {
          const g = document.querySelector('[data-chiffres-achats]');
          if (g) return Number(g.getAttribute('data-depense-c'));
          const b = [...document.querySelectorAll('*')].find((e) => e.children.length < 6 && /^Dépensé/i.test((e.innerText || '').trim()) && (e.innerText || '').length < 90);
          const m = b && /([\d\s\u202f\u00a0]+)\s*€/.exec(b.innerText); return m ? Number(m[1].replace(/[\s\u202f\u00a0]/g, '')) * 100 : null;
        });
        const champ = await pg.$('input[placeholder^="Rechercher (titre"]');
        if (!champ) throw new Error('recherche des achats introuvable');
        await champ.fill('zzzaucune'); await pg.waitForTimeout(900);
        const d0 = await depense();
        dit(d0 === 0, 'une recherche qui ne trouve aucun achat ⇒ « Dépensé » 0 €, hors Vinted compris', String(d0));
        await champ.fill('lot brocante'); await pg.waitForTimeout(900);
        const d1 = await depense();
        dit(d1 != null && Math.abs(d1 - 2850) < 100, 'la recherche « lot brocante » ne compte que le lot (28,50 €)', String(d1));
        await champ.fill('brocante'); await pg.waitForTimeout(900);
        const d2 = await depense();
        dit(d2 != null && Math.abs(d2 - 6850) < 100, 'l’autre sens : « brocante » compte les DEUX achats hors Vinted (68,50 €)', String(d2));
        await champ.fill(''); await pg.waitForTimeout(500);
      });
      await pg.waitForTimeout(2500);   // la synchro du nuage part (debounce)

      // ── C. Prix d'achat sans relier, puis rattachement sans doublon ───────
      await essaie('C. prix sans relier', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-prix-achat-vente], .vrm-sale-details', { timeout: 15000 });
        await pg.waitForTimeout(1000);
        const ouvre = async (tx) => { const ok = await ouvrirDetails(pg, `[data-prix-achat-vente="${tx}"]`); if (!ok) throw new Error(`pas de « Prix d'achat » sur la vente ${tx}`); await pg.click(`[data-prix-achat-vente="${tx}"]`); await pg.waitForTimeout(500); };
        await ouvre(8001);
        dit(!!(await pg.$('[data-prix-sans-relier]')), 'la modale s’ouvre sur un champ PRIX (sans obligation de relier)');
        await pg.fill('[data-champ="prix-direct"]', '35');
        await pg.click('[data-enregistrer-prix]');
        await pg.waitForTimeout(900);
        const ov1 = ((await ls(pg, 'vinted_sale_overrides')) || {})['8001'] || {};
        dit(ov1.buyPrice === '35.00' && !ov1.buyFromId, '35 € enregistrés sur la vente, SANS lien d’achat', JSON.stringify(ov1));

        await ouvre(8002);
        const dispo2 = await pg.$$eval('[data-relier-hors]', (l) => l.map((e) => e.getAttribute('data-relier-hors')));
        dit(dispo2.includes(idLot), 'le lot hors Vinted est proposé à une vente', JSON.stringify(dispo2));
        await pg.click(`[data-relier-hors="${idLot}"]`);
        await pg.waitForTimeout(700);
        await ouvre(8003);
        await pg.click(`[data-relier-hors="${idLot}"]`);
        await pg.waitForTimeout(900);
        const ov = (await ls(pg, 'vinted_sale_overrides')) || {};
        const a = ov['8002'] || {}, c = ov['8003'] || {};
        dit(a.buyFromId === `hors:${idLot}` && c.buyFromId === `hors:${idLot}`, 'le lot est rattaché aux DEUX ventes choisies (un clic chacune)', JSON.stringify([a.buyFromId, c.buyFromId]));
        dit(Math.round(Number(a.buyPrice) * 100) + Math.round(Number(c.buyPrice) * 100) === 2850, 'les deux parts somment EXACTEMENT au prix du lot (28,50 €)', JSON.stringify([a.buyPrice, c.buyPrice]));
        await ouvre(8004);
        const dispo3 = await pg.$$eval('[data-relier-hors]', (l) => l.map((e) => e.getAttribute('data-relier-hors')));
        dit(!dispo3.includes(idLot), 'plein (2/2) : le lot n’est plus proposé à une troisième vente — aucun doublon', JSON.stringify(dispo3));
        await pg.keyboard.press('Escape').catch(() => {});
        await pg.screenshot({ path: path.join(CAPT, `achats-ventes-${vp.width}.png`), fullPage: false }).catch(() => {});
        await sain(pg, 'Ventes');
      });

      // ── I. Vente Vinted : un boost vide est INCONNU, jamais 0 ─────────────
      await essaie('I. boost inconnu sur une vente', async () => {
        const etat = () => pg.evaluate(() => {
          const row = document.querySelector('[data-vente-tx="8001"]') || [...document.querySelectorAll('.vrm-sale-row')].find((r) => /Vente Delta/.test(r.innerText)); if (!row) return null;
          const d = row.querySelector('[data-couts-vente]') || [...row.querySelectorAll('details')].find((x) => /Détail des frais/.test(((x.querySelector('summary') || {}).innerText) || ''));
          if (d) { d.open = true; d.scrollIntoView({ block: 'center' }); }
          const prix = row.querySelector('.vrm-sale-price');
          return { estime: /estimé/.test(prix ? prix.innerText : ''), texte: d ? d.innerText : '', a: !!d };
        });
        const coche = () => pg.evaluate(() => { const row = document.querySelector('[data-vente-tx="8001"]') || [...document.querySelectorAll('.vrm-sale-row')].find((r) => /Vente Delta/.test(r.innerText)); const d = row && (row.querySelector('[data-couts-vente]') || [...row.querySelectorAll('details')].find((x) => /Détail des frais/.test(((x.querySelector('summary') || {}).innerText) || ''))); const c = d && d.querySelector('input[type=checkbox]'); if (c) c.click(); return !!c; });
        const e0 = await etat();
        if (!e0 || !e0.a) throw new Error('détail des frais de la vente 8001 introuvable');
        dit(!(/laisse la case vide/i.test(e0.texte) && /\(cases vides = 0/i.test(e0.texte)), 'pas de « laisse la case vide » à côté de « cases vides = 0 € »', e0.texte.slice(0, 160));
        await coche(); await pg.waitForTimeout(900);
        const ov = ((await ls(pg, 'vinted_sale_overrides')) || {})['8001'] || {};
        const e1 = await etat();
        dit(ov.fraisComplets !== true && e1.estime, 'boost vide : « tous les frais sont renseignés » ne passe pas, le bénéfice reste « estimé »', JSON.stringify({ fraisComplets: ov.fraisComplets, estime: e1.estime }));
        const boost = await pg.evaluateHandle(() => { const row = document.querySelector('[data-vente-tx="8001"]') || [...document.querySelectorAll('.vrm-sale-row')].find((r) => /Vente Delta/.test(r.innerText)); return row && row.querySelector('input[aria-label="Boost (si connu)"]'); });
        if (!boost || !(await boost.asElement())) throw new Error('champ « Boost (si connu) » de la vente 8001 introuvable');
        await boost.asElement().fill('0');
        await pg.keyboard.press('Tab'); await pg.waitForTimeout(700);
        await etat(); await coche(); await pg.waitForTimeout(900);
        const ov2 = ((await ls(pg, 'vinted_sale_overrides')) || {})['8001'] || {};
        const e2 = await etat();
        dit(ov2.fraisComplets === true && ov2.fees === '0' && !e2.estime, 'l’autre sens : boost 0 tapé ⇒ frais confirmés, bénéfice complet', JSON.stringify({ fraisComplets: ov2.fraisComplets, fees: ov2.fees, estime: e2.estime }));
      });

      // ── D. Boost : jamais inventé ────────────────────────────────────────
      await essaie('D. boost', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-carte-annonce="9001"]', { timeout: 15000 });
        await pg.waitForTimeout(800);
        const carte = (id) => pg.evaluate((id) => { const el = document.querySelector(`[data-carte-annonce="${id}"]`); if (!el) return null; const ch = el.querySelector('[data-chiffres]'); return { t: (ch || el).innerText, inconnu: !!el.querySelector('[data-boost="inconnu"]') }; }, id);
        const c1 = await carte(9001), c2 = await carte(9002), c3 = await carte(9003);
        dit(!!c1 && c1.inconnu && /boost\s*inconnu/i.test(c1.t), 'annonce boostée sans montant : « boost inconnu » (jamais 0 € présenté comme un fait)', c1 && c1.t);
        dit(!!c1 && /marge hors boost\s*\+30/i.test(c1.t), 'et la marge le dit : « marge hors boost +30 € »', c1 && c1.t);
        dit(!!c2 && /boost\s*2,50/.test(c2.t) && /marge\s*\+38/.test(c2.t) && !/hors boost/.test(c2.t), 'montant corrigé à la main : « boost 2,50 € », marge complète', c2 && c2.t);
        dit(!!c3 && !/boost/i.test(c3.t), 'annonce jamais boostée : on ne parle pas de boost', c3 && c3.t);
        const champ = await pg.evaluate(() => { const el = document.querySelector('[data-carte-annonce="9001"]'); return el ? el.innerHTML : ''; });
        dit(!/Boost payé/.test(champ) && /Boost \(si connu\)/.test(champ), 'la saisie du boost n’est plus exigée : « Boost (si connu) », facultatif', /Boost payé/.test(champ) ? '« Boost payé » encore là' : '');
        await sain(pg, 'Annonces');
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();

      // ── E. Sombre ────────────────────────────────────────────────────────
      await essaie('E. sombre', async () => {
        const s = await preparer(b, vp, true);
        await s.pg.goto(`http://localhost:${PORT}/?tab=cat_achats`, { waitUntil: 'domcontentloaded' });
        await s.pg.waitForSelector('.vrm-pickup-card', { timeout: 15000 });
        await s.pg.waitForTimeout(1000);
        const fond = await s.pg.evaluate(() => getComputedStyle(document.body).backgroundColor);
        const lum = (() => { const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(fond) || []; return (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3; })();
        dit(lum < 80, 'sombre : le fond du document est sombre', fond);
        await s.pg.screenshot({ path: path.join(CAPT, `achats-retrait-sombre-${vp.width}.png`), fullPage: true }).catch(() => {});
        await sain(s.pg, 'Achats (sombre)');
        await s.pg.click('[data-ajout-achat-hors]').catch(() => {});
        await s.pg.waitForTimeout(400);
        await s.pg.screenshot({ path: path.join(CAPT, `achats-form-sombre-${vp.width}.png`) }).catch(() => {});
        dit(s.errs.length === 0, 'sombre : aucune erreur de page', s.errs.join(' | ').slice(0, 200));
        await s.ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ achats : ${ko} rouge(s) sur ${n}` : `\n✅ achats : ${n} contrôles verts`);
  console.log('captures : ' + CAPT);
  process.exit(ko ? 1 : 0);
})();
