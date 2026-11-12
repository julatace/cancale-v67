// Banc : « Envoyer la facture » au téléphone (12 nov., demande de Julien,
// trois captures iPhone : « Corrige les bugs de facture »).
// Données INVENTÉES (dépôt public), aucune ligne en base réelle. Infrastructure
// reprise de scripts/bancs/facture-en-tva.cjs (même fausse base, même fausse
// route qui fabrique l'instantané avec la VRAIE règle).
//
// Il juge la RÈGLE (mesures et requêtes, jamais un libellé seul), au téléphone
// (390 tactile) et sur ordinateur (1512), en clair ET en sombre, sur une facture
// BILINGUE (acheteuse aux Pays-Bas, adresse e-mail privée de relais, titre long) :
//   1. aucun défilement horizontal (page ET feuille : scrollWidth ≤ clientWidth),
//      aucun élément de la feuille hors de l'écran ;
//   2. l'aperçu est une MINIATURE : la facture à sa vraie largeur, mise à
//      l'échelle pour tenir dans la feuille, entièrement visible (rien de coupé
//      à droite, aucun texte qui sort de la page blanche) ;
//   3. la colonne « Désignation » prend au moins 40 % du tableau ; Qté, Prix,
//      Total ne se coupent jamais ;
//   4. bilingue intact : « FACTURE / INVOICE », la mention 293 B en français PUIS
//      sa traduction, « acquittée » ;
//   5. toucher l'aperçu l'ouvre en grand (la visionneuse de PDF de l'app) ;
//   6. « envoyer depuis ma boîte » choisi, boîte PAS connectée, envoi VRM ouvert :
//      « Envoyer avec VRM » est là, et il appelle la route (émettre, puis envoyer
//      avec `via: 'vrm'`) ; envoi VRM FERMÉ : pas de bouton, une phrase le dit,
//      « Connecter ma boîte » et « Émettre sans envoyer » restent ;
//   7. après l'émission (boîte pas connectée), « Envoyer avec VRM » reste offert.
// Lancer : npm run build && NODE_OPTIONS=--require=./scripts/bancs/_porte-banc.cjs BANC_PORT=11873 node scripts/bancs/facture-mobile.cjs
// Captures : SHOTS=<dossier> …   SEUL='390 clair' pour une seule combinaison.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 11873);
const SHOTS = process.env.SHOTS || '';
const SEUL = process.env.SEUL || '';

const maintenant = new Date(2026, 10, 12, 8, 16, 0);
const il = (n, h = 12, m = 0) => { const d = new Date(maintenant); d.setHours(h, m, 0, 0); d.setDate(d.getDate() - n); return d; };
const plus = (d, sec) => new Date(d.getTime() + sec * 1000).toISOString();
const A = '111';
const TITRE = 'Nike SB Dunk Low Pro « Travis Scott » Cactus Jack Special Box édition limitée — Taille 44,5 EU, état neuf avec boîte d’origine';
const RELAIS = 'u8f2k9q4x7m1z3c5w6v0@privaterelay.vinted.test';
const vente = (id, titre, prix, d) => ({ transaction_id: id, conversation_id: 50000 + id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: 'Commande finalisée', transaction_user_status: 'completed', date: d.toISOString(), photo: { url: `https://images1.vinted.net/t/b1/f800/${id}.jpeg?s=x` } });
const ACCOUNTS = [{ id: 1, vinted_user_id: A, login: 'boutique_banc', domain: 'www.vinted.fr', updated_at: maintenant.toISOString() }];
const cap = maintenant.toISOString();
const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = ['900123450', '900123451', '900123452', '900123453', '900123454', '900123455', '900123456', '900123457', '900123458', '900123459'].find(luhn);
const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();
const CFG = { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'franchise', prefixe: 'FA', couleur: '#0071e3', email: 'boutique@banc.test', note: 'Merci pour votre achat !', envoiPar: 'boite' };
const DV = il(4, 10);
let emises = {};
const lignes = () => [
  { id: `harvest_${A}_orders_sold`, data: { capturedAt: cap, payload: { my_orders: [vente(7020, TITRE, 1234.5, DV)] } } },
  { id: `harvest_${A}_profile`, data: { uid: A, capturedAt: cap, payload: { user: { id: Number(A), login: 'boutique_banc', business: true, business_account_id: 4242 } } } },
  { id: 'email_sale_nl', data: { type: 'vente', pro: true, transaction: '7020', pseudo: 'sanne_banc', nomComplet: 'Sanne van der Berg-Hoogeveen', adresse: 'Prinsengracht, 263, Amsterdam, 1016 GV, NL, Nederland', email: RELAIS, designation: TITRE, prix: '1234.50', account: 'boutique_banc', uid: A, receivedAt: plus(DV, 50) } },
  ...Object.entries(emises).map(([tx, d]) => ({ id: 'email_invoice_tx' + tx, data: d })),
  { id: 'vrm_pro_facture', data: CFG },
];
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = cap; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
const photoSvg = () => '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#d9d4cc"/></svg>';

let requetesApi = [];
const ouvrir = async (b, vp, sombre, { vrmPret = true } = {}) => {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && /FacturePro|facture/i.test(m.text())) errs.push(m.text()); });
  await pg.clock.install({ time: maintenant });
  await pg.addInitScript(([s]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_visite_vue', '1'); } catch (_) {} }, [!!sombre]);
  await pg.route(/^https?:\/\/[^/]*vinted\.net\//i, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: photoSvg() }));
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|[^/]*vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const L = lignes();
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: cap, cap: r.data.capturedAt });
    const filtres = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=(not\.)?is\.null/g)];
    const egal = [...u.matchAll(/[?&]data->>([a-zA-Z_]+)=eq\.([^&]*)/g)];
    const passe = (r) => filtres.every(([, k, non]) => (r.data[k] == null) === !non) && egal.every(([, k, v]) => String(r.data[k]) === v);
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1] && passe(r)).map(forme));
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id) && passe(r)).map(forme)); }
    return j([]);
  });
  const regle = await import(path.join(__dirname, '..', '..', 'src', 'facturePro', 'regle.js'));
  await pg.route('**/api/compte?mode=facture-pro', async (r) => {
    const q = r.request(); const corps = q.method() === 'POST' ? JSON.parse(q.postData() || '{}') : null;
    requetesApi.push(corps || { get: true });
    const rep = (code, j) => r.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(j) });
    if (!corps) return rep(200, { ok: true, coffre: true, boite: { etat: 'aucune' }, fournisseurs: { gmail: { l: 'Gmail' } }, prochain: 6, vrm: { pret: vrmPret, manque: vrmPret ? [] : ['RELANCES_SMTP_HOTE'], plafond: 50, aujourdhui: 0 } });
    if (corps.action === 'emettre') {
      const m = lignes().find((x) => x.id === 'email_sale_nl');
      const v = lignes()[0].data.payload.my_orders[0];
      const contenu = regle.contenuFacture(CFG, { acheteur: { nom: m.data.nomComplet, adresse: regle.adresseVintedLisible(m.data.adresse), email: m.data.email }, designation: corps.designation, centimes: Math.round(Number(v.price.amount) * 100), venteLe: v.date, reference: corps.tx, plateforme: 'Vinted' }, { numero: 'FA-2026-0006', emiseLe: maintenant.getTime(), langue: corps.langue === 'en' ? 'en' : 'fr' });
      emises[corps.tx] = { type: 'facture_pro', number: 'FA-2026-0006', status: 'emise', transaction: corps.tx, emiseLe: contenu.emiseLe, contenu, preuve: { tx: corps.tx } };
      return rep(200, { ok: true, facture: { id: 'email_invoice_tx' + corps.tx, numero: 'FA-2026-0006', emise: true, emiseLe: contenu.emiseLe, contenu, envois: [] } });
    }
    if (corps.action === 'envoyer') {
      // Le serveur respecte le réglage : « boîte » sans `via: 'vrm'` explicite ⇒ refus (boîte pas connectée).
      if (corps.via !== 'vrm') return rep(409, { erreur: 'boite', message: 'Connecte d’abord ta boîte e-mail.' });
      const envoi = { etat: 'envoyee', at: maintenant.toISOString(), a: RELAIS, via: 'vrm', cc: 'boutique@banc.test' };
      emises[corps.tx] = { ...emises[corps.tx], status: 'sent', envoi, envois: [envoi] };
      return rep(200, { ok: true, issue: 'envoye', envoi, envois: [envoi] });
    }
    return rep(400, {});
  });
  await pg.route(/\/api\/(?!compte\?mode=facture-pro)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  await pg.locator('.vrm-sale-row[data-tx] .vrm-ledger-sale-toggle').first().waitFor({ timeout: 30000 });
  await pg.waitForTimeout(1500);
  return { ctx, pg, errs };
};
const ligneFacture = (pg, tx) => pg.locator(`.vrm-sale-row[data-tx="${tx}"] [data-fp-forme="ligne"]`).first();

// Les mesures, dans la page : débordements, miniature, tableau.
const mesurer = (pg) => pg.evaluate(() => {
  const f = document.querySelector('[data-fp-feuille-vente]'); if (!f) return null;
  const vw = window.innerWidth;
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('details:not([open]) > :not(summary)'); };
  const hors = [...f.querySelectorAll('*')].filter((e) => vis(e) && !e.closest('svg') && (e.getBoundingClientRect().right > vw + 1 || e.getBoundingClientRect().left < -1)).map((e) => String(e.className || e.tagName).slice(0, 30));
  // Les conteneurs qui défilent de côté (la feuille, son corps…).
  const defile = [f, ...f.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(e).overflowX)).map((e) => `${String(e.className || e.tagName).slice(0, 30)} ${e.scrollWidth}>${e.clientWidth}`);
  const deb = Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, document.body.scrollWidth - document.body.clientWidth, 0);
  const ap = f.querySelector('[data-fp-apercu]');
  let apercu = null;
  if (ap) {
    const ra = ap.getBoundingClientRect();
    const sorties = [...ap.querySelectorAll('*')].filter((e) => vis(e) && e.getBoundingClientRect().right > ra.right + 1).map((e) => `${(e.innerText || e.tagName).trim().slice(0, 24)}`);
    const coupes = [...ap.querySelectorAll('b, span, td, th, p, dt, dd')].filter((e) => vis(e) && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map((e) => (e.innerText || '').slice(0, 24));
    const mini = ap.closest('[data-fp-miniature]');
    const rm = mini ? mini.getBoundingClientRect() : null;
    const tab = ap.querySelector('.vrm-fp-a-table');
    const th = tab && tab.querySelector('th');
    const pageW = ap.offsetWidth;   // largeur VRAIE (non mise à l'échelle)
    // Une lettre par ligne : la hauteur d'une cellule de désignation ÷ sa ligne.
    const td = tab && tab.querySelector('tbody td');
    const lh = td ? parseFloat(getComputedStyle(td).lineHeight) || 16 : 16;
    apercu = {
      gauche: ra.left, droite: ra.right, vw, sorties: sorties.slice(0, 5), coupes: coupes.slice(0, 5),
      mini: !!mini, echelle: mini ? Number(mini.getAttribute('data-fp-echelle')) : null,
      dansMini: rm ? (ra.left >= rm.left - 1 && ra.right <= rm.right + 1 && ra.bottom <= rm.bottom + 1 && ra.top >= rm.top - 1) : false,
      pageW, part: th && tab ? th.offsetWidth / tab.offsetWidth : 0,
      lignesDesignation: td ? Math.round(td.offsetHeight / lh) : 0,
      // Chaque montant : UNE ligne de texte, entière dans sa cellule (rangée de rectangles du texte).
      chiffresUneLigne: tab ? [...tab.querySelectorAll('tbody td:nth-child(n+2)')].every((x) => {
        const r = document.createRange(); r.selectNodeContents(x); const rs = [...r.getClientRects()].filter((q) => q.width > 0);
        const tops = new Set(rs.map((q) => Math.round(q.top))); const rc = x.getBoundingClientRect();
        return rs.length > 0 && tops.size === 1 && rs.every((q) => q.left >= rc.left - 1 && q.right <= rc.right + 1);
      }) : false,
      texte: ap.innerText.replace(/\s+/g, ' '),
    };
  }
  return { deb, hors: hors.slice(0, 5), defile: defile.slice(0, 5), apercu };
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] }).catch(() => chromium.launch());
  try {
    const combos = [[{ width: 390, height: 844 }, false, '390 clair'], [{ width: 390, height: 844 }, true, '390 sombre'], [{ width: 1512, height: 982 }, false, '1512 clair'], [{ width: 1512, height: 982 }, true, '1512 sombre']].filter((c) => !SEUL || c[2] === SEUL);
    for (const [vp, sombre, nom] of combos) {
      console.log(`\n— ${nom}`);
      const tel = vp.width < 600; const nf = nom.replace(/\s+/g, '-');
      requetesApi = []; emises = {};
      const { ctx, pg, errs } = await ouvrir(b, vp, sombre);
      await essaie('feuille', async () => {
        await ligneFacture(pg, '7020').waitFor({ timeout: 8000 });
        await ligneFacture(pg, '7020').scrollIntoViewIfNeeded();
        await ligneFacture(pg, '7020').locator('[data-fp-vente="a-faire"]').click();
        const f = pg.locator('[data-fp-feuille-vente="7020"]');
        await f.locator('[data-fp-apercu]').waitFor({ timeout: 6000 });
        dit(await f.locator('[data-fp-anglais]').getAttribute('data-fp-anglais') === '1', '0. acheteuse aux Pays-Bas : facture bilingue pré-cochée');
        await f.locator('[data-fp-apercu]').scrollIntoViewIfNeeded();
        await pg.waitForTimeout(400);
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fm-apercu-${nf}.png`) });
        const m = await mesurer(pg);
        dit(m && m.deb <= 0, '1. la page ne défile pas de côté (scrollWidth ≤ clientWidth)', m && `${m.deb}px`);
        dit(m && !m.defile.length, '1. aucun conteneur de la feuille ne défile de côté', m && m.defile.join(' | '));
        dit(m && !m.hors.length, '1. aucun élément de la feuille hors de l’écran', m && m.hors.join(' | '));
        const a = m && m.apercu;
        dit(a && a.mini && a.dansMini, '2. l’aperçu est une miniature, la facture entière dans son cadre', a && `mini=${a.mini} dans=${a.dansMini} échelle=${a.echelle}`);
        if (tel) dit(a && a.echelle > 0.5 && a.echelle < 1 && a.pageW >= 480, '2. au téléphone : la facture à sa vraie largeur, réduite pour tenir', a && `largeur ${a.pageW}px × ${a.echelle}`);
        else dit(a && a.echelle === 1, '2. sur ordinateur : la facture à sa taille', a && String(a.echelle));
        dit(a && a.gauche >= -1 && a.droite <= a.vw + 1, '2. l’aperçu entier est dans l’écran', a && `${Math.round(a.gauche)} → ${Math.round(a.droite)} / ${a.vw}`);
        dit(a && !a.sorties.length && !a.coupes.length, '2. aucun texte ne sort de la page blanche ni n’est coupé', a && [...a.sorties, ...a.coupes].join(' | '));
        dit(a && a.part >= 0.4, '3. « Désignation » prend au moins 40 % du tableau', a && `${Math.round(a.part * 100)} %`);
        dit(a && a.lignesDesignation <= 6, '3. la désignation tient en quelques lignes (pas une lettre par ligne)', a && `${a.lignesDesignation} lignes`);
        dit(a && a.chiffresUneLigne, '3. Qté, prix et total sur une ligne chacun');
        dit(a && /FACTURE \/ INVOICE/.test(a.texte) && /TVA non applicable, art\. 293 B du CGI/.test(a.texte) && /VAT not applicable, article 293 B/.test(a.texte) && /acquittée/.test(a.texte) && /1\s234,50\s€/.test(a.texte) && a.texte.includes(RELAIS),
          '4. bilingue intact : titre, 293 B puis sa traduction, acquittée, montant, e-mail de relais', a && a.texte.slice(0, 120));

        // 5. Toucher l'aperçu ⇒ en grand.
        const mini = f.locator('[data-fp-miniature]');
        if (!(await mini.count())) throw new Error('pas de miniature à toucher');
        const bb = await mini.boundingBox();
        if (tel) dit(bb && bb.height >= 44, '5. l’aperçu se touche (cible ≥ 44 px)', bb && String(Math.round(bb.height)));
        await mini.click();
        const vis = pg.locator('[data-visionneuse-pdf]');
        const ouvert = await vis.first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
        dit(ouvert, '5. toucher l’aperçu l’ouvre en grand (visionneuse de PDF)');
        if (ouvert) { if (SHOTS) { await pg.waitForTimeout(600); await pg.screenshot({ path: path.join(SHOTS, `fm-grand-${nf}.png`) }); } await pg.keyboard.press('Escape'); await vis.first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => {}); await pg.waitForTimeout(300); }

        // 6. Les boutons du bas : boîte pas connectée, envoi VRM ouvert.
        const bas = f.locator('.vrm-fp-gestes.is-bas');
        await bas.scrollIntoViewIfNeeded();
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fm-boutons-${nf}.png`) });
        const bVrm = f.locator('[data-fp-envoyer-vrm]');
        dit(await bVrm.count() === 1 && /Envoyer avec VRM/.test(await bVrm.innerText()), '6. « Envoyer avec VRM » est offert (boîte pas connectée, envoi VRM ouvert)');
        dit(await f.locator('[data-fp-geste-manque="boite"]').count() === 1 && await f.locator('[data-fp-emettre]').count() === 1, '6. « Connecter ma boîte » et « Émettre sans envoyer » restent');
        if (tel) { const hb = await bVrm.boundingBox(); dit(hb && hb.height >= 43.5, '6. « Envoyer avec VRM » : cible de 44 px', hb && String(Math.round(hb.height))); }
        if (tel) { const hc = await f.locator('[data-fp-geste-manque="boite"]').boundingBox(); dit(hc && hc.height >= 43.5, '6. « Connecter ma boîte » : cible de 44 px', hc && String(Math.round(hc.height))); }
        const fondLien = await f.locator('[data-fp-geste-manque="boite"]').evaluate((e) => getComputedStyle(e).backgroundColor);
        dit(/rgba\(0, 0, 0, 0\)|transparent/.test(fondLien), '6. « Connecter ma boîte » est un lien (aucun fond gris)', fondLien);
        const mb = await mesurer(pg);
        dit(mb && mb.deb <= 0 && !mb.hors.length, '1. en bas aussi : rien ne déborde', mb && `${mb.deb}px ${mb.hors.join(' | ')}`);
        requetesApi = [];
        await bVrm.click();
        await pg.getByRole('button', { name: 'Envoyer', exact: true }).last().click();
        await f.locator('[data-fp-envoi="envoyee"]').waitFor({ timeout: 8000 }).catch(() => {});
        const em = requetesApi.find((x) => x.action === 'emettre') || {};
        const en = requetesApi.find((x) => x.action === 'envoyer') || {};
        dit(em.tx === '7020' && em.langue === 'en', '6. « Envoyer avec VRM » émet la facture (bilingue)', JSON.stringify(em).slice(0, 120));
        dit(en.tx === '7020' && en.via === 'vrm' && en.confirme === true, '6. … puis l’envoie par VRM (`via: vrm`)', JSON.stringify(en).slice(0, 120));
        dit(await f.locator('[data-fp-envoi="envoyee"]').count() === 1, '6. la feuille dit « envoyée »');
        const re = f.locator('[data-fp-envoyer-vrm]');
        dit(await re.count() === 1 && /^Renvoyer avec VRM$/.test((await re.innerText()).trim()), '6. déjà partie : le bouton dit « Renvoyer avec VRM » (jamais « Envoyer » une 2e fois)', await re.count() ? await re.innerText() : '');
        if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, `fm-envoyee-${nf}.png`) });
        await pg.keyboard.press('Escape');
        await pg.waitForTimeout(300);
      });
      dit(!errs.length, 'aucune erreur d’app', errs.join(' | ').slice(0, 300));
      await ctx.close();

      // 6 bis. Envoi VRM fermé (serveur sans RELANCES_SMTP_*) ; 7. après émission.
      if (!tel || !sombre) {
        requetesApi = []; emises = {};
        const o = await ouvrir(b, vp, sombre, { vrmPret: false });
        await essaie('vrm fermé', async () => {
          await ligneFacture(o.pg, '7020').scrollIntoViewIfNeeded();
          await ligneFacture(o.pg, '7020').locator('[data-fp-vente="a-faire"]').click();
          const f = o.pg.locator('[data-fp-feuille-vente="7020"]');
          await f.locator('[data-fp-apercu]').waitFor({ timeout: 6000 });
          const bloque = f.locator('.vrm-fp-gestes.is-bas [data-fp-bloque]');
          const t = (await bloque.innerText().catch(() => '')).replace(/\s+/g, ' ');
          dit(await f.locator('[data-fp-envoyer-vrm]').count() === 0 && /VRM/.test(t) && !/laisse VRM envoyer/.test(t), '6. envoi VRM fermé : pas de bouton, la phrase le dit (sans promettre « laisse VRM envoyer »)', t);
          dit(await f.locator('[data-fp-geste-manque="boite"]').count() === 1 && await f.locator('[data-fp-emettre]').count() === 1, '6. envoi VRM fermé : « Connecter ma boîte » et « Émettre sans envoyer » restent');
          if (SHOTS) { await f.locator('.vrm-fp-gestes.is-bas').scrollIntoViewIfNeeded(); await o.pg.screenshot({ path: path.join(SHOTS, `fm-vrm-ferme-${nf}.png`) }); }
          await o.pg.keyboard.press('Escape');
        });
        await o.ctx.close();
        requetesApi = []; emises = {};
        // 7. Facture déjà émise, pas envoyée : le même choix reste offert.
        const o2 = await ouvrir(b, vp, sombre);
        await essaie('émise', async () => {
          await ligneFacture(o2.pg, '7020').scrollIntoViewIfNeeded();
          await ligneFacture(o2.pg, '7020').locator('[data-fp-vente="a-faire"]').click();
          const f = o2.pg.locator('[data-fp-feuille-vente="7020"]');
          await f.locator('[data-fp-emettre]').waitFor({ timeout: 6000 });
          await f.locator('[data-fp-emettre]').click();
          await o2.pg.getByRole('button', { name: 'Émettre', exact: true }).last().click();
          await f.locator('[data-fp-envoi]').waitFor({ timeout: 8000 });
          const bVrm = f.locator('[data-fp-envoyer-vrm]');
          dit(await bVrm.count() === 1, '7. facture émise, boîte pas connectée : « Envoyer avec VRM » reste offert');
          requetesApi = [];
          if (await bVrm.count()) { await bVrm.click(); await o2.pg.waitForTimeout(800); }
          const en = requetesApi.find((x) => x.action === 'envoyer') || {};
          dit(en.via === 'vrm', '7. … et part par VRM', JSON.stringify(en).slice(0, 100));
          const m = await mesurer(o2.pg);
          dit(m && m.deb <= 0 && !m.hors.length, '1. feuille émise : rien ne déborde', m && `${m.deb}px ${m.hors.join(' | ')}`);
        });
        await o2.ctx.close();
      }
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
