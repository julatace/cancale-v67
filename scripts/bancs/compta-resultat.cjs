// Banc : LE RÉSULTAT APRÈS CHARGES, LE REGISTRE ANNUEL ET SES EXPORTS, L'ONGLET
// COMPTABILITÉ (revue de la production, 9 octobre).
//
// La revue de e6bda5c a rendu l'app et trouvé :
//   · deux « Résultat après charges » pour la même année — l'onglet
//     Comptabilité « CA − charges », le bilan annuel « bénéfice des SEULES
//     ventes au coût connu − charges de toute l'année », en rouge ;
//   · des ventes finalisées sans date de versement qui disparaissaient du bilan
//     sans un mot ;
//   · des exports CSV/PDF qui chiffraient ce que l'écran refusait de chiffrer
//     (pendant la lecture, dates illisibles), la mention de ce qui manque en
//     DERNIÈRE ligne ;
//   · un coût fixe compté depuis janvier, une saisie faite avant l'arrivée du
//     nuage qui effaçait les charges d'un autre appareil, une date du jour en UTC.
//
// Données INVENTÉES (aucune fixture : le banc vit dans le dépôt, public). Il
// juge ce qui est RENDU et ce qui est TÉLÉCHARGÉ — les nombres, jamais un
// libellé seul (§6.5). Port 4371.
//
//   node scripts/bancs/compta-resultat.cjs
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), zlib = require('zlib');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4371;

// L'année de PARIS (l'app date sa comptabilité à Paris).
const Y = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric' }).format(new Date()));
const auj = new Date();
const FIN = 'Commande finalisée';
const vente = (id, titre, prix, d) => ({ transaction_id: id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, status: FIN, date: `${Y}-01-0${d}T12:00:00+01:00` });
const V = [vente(9001, 'Nike Air Max 1 taille 42', 100, 2), vente(9002, 'Salomon XT-6 taille 40', 80, 2), vente(9003, 'Adidas Spezial taille 38', 60, 3)];
const VERS = { 9001: `${Y}-01-05T12:00:00+01:00`, 9002: `${Y}-01-05T12:00:00+01:00`, 9003: `${Y}-01-06T12:00:00+01:00` };
// Une quatrième vente FINALISÉE, sans date de versement (« pas encore datée »).
const V_ADATER = vente(9004, 'Asics Gel-Kayano taille 41', 50, 4);
const OV_COMPLET = { 9001: { buyPrice: '40' }, 9002: { buyPrice: '30' }, 9003: { buyPrice: '20' }, 9004: { buyPrice: '10' } };
const OV_PARTIEL = { 9001: { buyPrice: '40' } };
// Bénéfice complet : (100−40) + (80−30) + (60−20) = 150 ; charges 100 ⇒ 50.
const COMPTA = { depenses: [{ id: 'd1', date: `${Y}-01-07`, libelle: 'Scotch', cat: 'Emballage', montant: 100 }], fixes: [], packs: [] };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
// C.danger, dans les DEUX thèmes (clair, sombre) — interdit sur un résultat (§7).
// ⚠️ Le premier jet ne connaissait que le clair : le banc rend en sombre, et le
//    contrôle était vert sur le rouge sombre du code d'avant.
const ROUGES = ['rgb(192, 57, 43)', 'rgb(255, 107, 107)'];

const lignes = (ventes) => [
  { id: 'lbc_ventes', data: { ventes: {} } },
  { id: 'ebay_orders', data: { orders: [] } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: auj.toISOString(), payload: { my_orders: ventes } } },
  ...Object.entries(VERS).map(([tx, d]) => ({ id: 'harvest_111_txn_' + tx, data: { capturedAt: auj.toISOString(), payload: { transaction: { id: Number(tx), status: 450, status_updated_at: d } } } })),
  { id: 'harvest_111_orders_purchased', data: { capturedAt: auj.toISOString(), payload: { my_orders: [] } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const nombre = (t) => { const m = /(-?[\d\s  ]+(?:[,.]\d+)?)\s*€/.exec(t || ''); return m ? parseFloat(m[1].replace(/[\s  ]/g, '').replace(',', '.')) : NaN; };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

// La fausse base. `etat` : `rows` (les lignes servies), `txnLent` (la lecture
// des dates de versement met N ms), `txnKO` (522 + HTML, la vraie forme),
// `main` (la ligne des réglages synchronisés) et `mainAttend` (une promesse :
// le nuage n'arrive qu'à sa résolution — la fenêtre froide), `posts` (les
// écritures de `main`, pour lire ce qui part au nuage).
const brancher = async (pg, etat) => {
  // ⚠️ §6.6 : Playwright essaie la DERNIÈRE route enregistrée en premier — le
  // filtre des images externes passe donc AVANT la fausse base, sinon il
  // laisserait partir les lectures vers le vrai réseau (« base injoignable »).
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st = 200) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }).catch(() => {});
    if (req.method() === 'POST' && /\/app_data/.test(u)) { try { (etat.posts || (etat.posts = [])).push(JSON.parse(req.postData() || '[]')); } catch (_) {} return j([], 201); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/_txn_/.test(u) && /like\./.test(u)) {
      if (etat.txnLent) await new Promise((ok) => setTimeout(ok, etat.txnLent));
      if (etat.txnKO) return route.fulfill({ status: 522, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>522</html>' }).catch(() => {});
    }
    if (/id=eq\.main/.test(u) && /select=data(&|$)/.test(u)) {
      if (etat.mainAttend) await etat.mainAttend;
      return j(etat.main ? [{ id: 'main', data: etat.main }] : []);
    }
    const rows = etat.rows || [];
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || '';
    const forme = (r) => {
      if (/^[a-z]+:data->[a-z]+$/i.test(sel)) { const [al, src] = sel.split(':'); return { [al]: (r.data || {})[src.split('->')[1]] }; }
      if (/^[a-z]+:data->/i.test(sel)) {
        const o = {};
        for (const champ of sel.split(',')) { const m = /^([a-z]+):data->(.+)$/i.exec(champ); if (!m) continue; let v = r.data; for (const p of m[2].split(/->>?/)) v = v == null ? v : v[p]; o[m[1]] = (v != null && /->>/.test(m[2])) ? String(v) : v; }
        return o;
      }
      return { ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt };
    };
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
};

const LOCAL = (cles) => (c) => { try { localStorage.setItem('vrm_acces_direct', '1'); for (const [k, v] of Object.entries(c)) localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };

// Ce que dit la case « Résultat après charges » du registre annuel : son texte
// et la couleur du nombre (lus dans le conteneur des cases, qui existait avant).
const lireBilan = (pg) => pg.evaluate((ROUGES) => {
  const e = document.querySelector('[data-annuel-vinted]');
  if (!e) return null;
  const t = e.innerText;
  const lignesT = t.split('\n').map((x) => x.trim()).filter(Boolean);
  const iR = lignesT.findIndex((l) => /^résultat après charges$/i.test(l));
  const iC = lignesT.findIndex((l) => /^ca des ventes finalisées$/i.test(l));
  let couleur = '';
  if (iR >= 0) {
    const v = lignesT[iR + 1];
    const feuille = [...e.querySelectorAll('*')].find((x) => x.children.length === 0 && x.innerText && x.innerText.trim() === v);
    couleur = feuille ? getComputedStyle(feuille).color : '';
  }
  return { tout: t, resultat: iR >= 0 ? lignesT[iR + 1] : null, sousResultat: iR >= 0 ? (lignesT[iR + 2] || '') : '', ca: iC >= 0 ? lignesT[iC + 1] : null, sousCa: iC >= 0 ? (lignesT[iC + 2] || '') : '', couleur, rouge: ROUGES.includes(couleur) };
}, ROUGES);
// Le héro de l'onglet Comptabilité : la valeur qui suit « Résultat {année} ».
const lireHero = (pg) => pg.evaluate((Y) => {
  const t = document.body.innerText;
  const lignesT = t.split('\n').map((x) => x.trim()).filter(Boolean);
  const i = lignesT.findIndex((l) => l.toLowerCase().startsWith(('résultat ' + Y).toLowerCase()));
  return i < 0 ? null : { valeur: lignesT[i + 1], suite: lignesT.slice(i + 1, i + 9).join(' | ') };
}, Y);
const ouvrirBilan = async (pg) => {
  await pg.getByText('Outils', { exact: false }).first().click({ timeout: 8000 });
  await pg.getByText('Registre annuel', { exact: true }).first().click({ timeout: 8000 });
  await pg.waitForTimeout(1500);
};
const telechargerCsv = async (pg) => {
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 8000 }), pg.getByText('CSV (registre détaillé)', { exact: false }).first().click()]);
  return fs.readFileSync(await dl.path(), 'utf8').replace(/^\uFEFF/, '');
};
// Le texte d'un PDF fait par pdf-lib : ses flux sont compressés, et ses
// chaînes écrites en hexadécimal (WinAnsi). On les décompresse et décode.
// (Le `TextDecoder('windows-1252')` de ce Node rend VIDE pour 0x80–0x9F : on
// décode nous-mêmes les quelques signes qui y vivent.)
const CP1252 = { 0x80: '€', 0x85: '…', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x99: '™' };
const cp1252 = (bytes) => [...bytes].map((c) => CP1252[c] || String.fromCharCode(c)).join('');
const textePdf = (buf) => {
  const s = buf.toString('latin1'); const out = [];
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g; let m;
  while ((m = re.exec(s))) {
    let flux = Buffer.from(m[1], 'latin1');
    try { flux = zlib.inflateSync(flux); } catch (_) {}
    const t = flux.toString('latin1');
    for (const h of t.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) out.push(cp1252(Buffer.from(h[1], 'hex')));
    for (const h of t.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) out.push(h[1]);
  }
  return out;
};
const telechargerPdf = async (pg) => {
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.getByText('📄 PDF').first().click()]);
  return textePdf(fs.readFileSync(await dl.path()));
};
const champ = (csv, re) => { const l = csv.split('\n').find((x) => re.test(x)); return l ? l.split(';').map((x) => x.replace(/^"|"$/g, '')) : null; };

const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le scénario s’exécute', String(e && e.message).split('\n')[0].slice(0, 200)); } };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const contexte = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1512, height: 950 }, acceptDownloads: true, ...opts });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    return { ctx, pg, errs };
  };

  // ── 1. TOUT EST CONNU : LES DEUX ÉCRANS DISENT LE MÊME RÉSULTAT (§11) ─────
  await essaie('complet', async () => {
    const { ctx, pg } = await contexte();
    await pg.addInitScript(LOCAL(), { vrm_compta: COMPTA, vinted_sale_overrides: OV_COMPLET });
    await brancher(pg, { rows: lignes(V) });
    await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3500);
    await ouvrirBilan(pg);
    const bi = await lireBilan(pg);
    const vb = bi ? nombre(bi.resultat) : NaN;
    dit(vb === 50, '[complet] le registre annuel : résultat après charges = 150 € de bénéfice − 100 € de charges = 50 €', bi ? `« ${bi.resultat} »` : 'registre introuvable');
    await pg.waitForTimeout(800);
    await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2500);
    const h = await lireHero(pg);
    const vh = h ? nombre(h.valeur) : NaN;
    dit(vh === vb && vh === 50, '[complet] l’onglet Comptabilité dit le MÊME résultat que le registre — une notion, une règle (§11)', h ? `onglet « ${h.valeur} » · registre « ${bi && bi.resultat} »` : 'héro introuvable');
    await ctx.close();
  });

  // ── 2. COÛTS D'ACHAT INCOMPLETS : AUCUN RÉSULTAT CHIFFRÉ, NULLE PART ───────
  await essaie('partiel', async () => {
    const { ctx, pg } = await contexte();
    await pg.addInitScript(LOCAL(), { vrm_compta: COMPTA, vinted_sale_overrides: OV_PARTIEL });
    await brancher(pg, { rows: lignes(V) });
    await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3500);
    await ouvrirBilan(pg);
    const bi = await lireBilan(pg);
    dit(!!bi && bi.resultat === '—' && /1 vente sur 3/.test(bi.sousResultat), '[partiel] registre : coût d’achat connu sur 1 vente sur 3 ⇒ « — » et la raison (avant : le bénéfice d’UNE vente moins les charges de toute l’année)', bi ? `« ${bi.resultat} » · « ${bi.sousResultat} »` : '');
    dit(!!bi && !bi.rouge, '[partiel] registre : pas de rouge sur le résultat (§7 : réservé à deux paires sous un même numéro)', bi ? bi.couleur : '');
    const csv = await telechargerCsv(pg);
    const r = champ(csv, /^"Resultat apres charges/);
    dit(!!r && r[1] === '—', '[partiel] CSV : le résultat après charges vaut « — », comme l’écran', r ? r.join(' ; ') : 'ligne absente');
    await pg.waitForTimeout(500);
    await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2500);
    const h = await lireHero(pg);
    dit(!!h && h.valeur === '—' && /1 vente sur 3/.test(h.suite), '[partiel] onglet Comptabilité : « — » et la MÊME raison (avant : CA − charges, un autre nombre)', h ? h.suite : 'héro introuvable');
    await ctx.close();
  });

  // ── 3. UNE VENTE FINALISÉE PAS ENCORE DATÉE : DITE À CÔTÉ DU TOTAL ─────────
  await essaie('adater', async () => {
    const { ctx, pg } = await contexte();
    await pg.addInitScript(LOCAL(), { vrm_compta: COMPTA, vinted_sale_overrides: OV_COMPLET });
    await brancher(pg, { rows: lignes([...V, V_ADATER]) });
    await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3500);
    await ouvrirBilan(pg);
    const bi = await lireBilan(pg);
    await pg.screenshot({ path: path.join(__dirname, 'compta-registre-adater.png') });   // §6.2 : on REGARDE le rendu
    dit(!!bi && nombre(bi.ca) === 240, '[à dater] le CA reste celui des ventes datées (240 €) — la vente pas encore datée n’est pas ajoutée en douce', bi ? `« ${bi.ca} »` : '');
    dit(!!bi && /1 vente finalisée pas encore datée \(50,00 €\)/.test(bi.sousCa), '[à dater] à côté du CA : « + 1 vente finalisée pas encore datée (50,00 €) » (avant : rien)', bi ? `« ${bi.sousCa} »` : '');
    dit(!!bi && bi.resultat === '—', '[à dater] le résultat après charges n’est pas chiffré sur un CA qui peut être incomplet', bi ? `« ${bi.resultat} »` : '');
    const csv = await telechargerCsv(pg);
    const L = csv.split('\n');
    const iAtt = L.findIndex((l) => /ATTENTION.*pas encore datee.*50\.00 EUR/.test(l)), iMois = L.findIndex((l) => /^"Mois"/.test(l));
    dit(iAtt >= 0 && iMois >= 0 && iAtt < iMois, '[à dater] CSV : la vente pas encore datée est dite EN TÊTE, avant le tableau des mois', `ligne ${iAtt} · tableau ${iMois}`);
    await pg.waitForTimeout(500);
    await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2500);
    const h = await lireHero(pg);
    await pg.screenshot({ path: path.join(__dirname, 'compta-onglet-adater.png') });
    dit(!!h && h.valeur === '—' && /1 vente finalisée pas encore datée \(50,00 €\)/.test(h.suite), '[à dater] onglet Comptabilité : « — », et la vente pas encore datée y est dite avec son montant', h ? h.suite : 'héro introuvable');
    await ctx.close();
  });

  // ── 4. PENDANT LA LECTURE : PAS D'EXPORT ───────────────────────────────────
  await essaie('lecture', async () => {
    const { ctx, pg } = await contexte();
    await pg.addInitScript(LOCAL(), { vrm_compta: COMPTA, vinted_sale_overrides: OV_COMPLET });
    await brancher(pg, { rows: lignes(V), txnLent: 40000 });
    await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3500);
    await ouvrirBilan(pg);
    const bi = await lireBilan(pg);
    dit(!!bi && bi.ca === '…', '[lecture] l’écran écrit « … » pendant la lecture (le contrôle ne vaut que si on est bien EN lecture)', bi ? `« ${bi.ca} »` : '');
    let fichier = null;
    const attente = pg.waitForEvent('download', { timeout: 3500 }).then(async (d) => { fichier = fs.readFileSync(await d.path(), 'utf8'); }).catch(() => {});
    await pg.evaluate(() => { const bt = [...document.querySelectorAll('button')].find((x) => /CSV \(registre détaillé\)/.test(x.innerText)); if (bt) bt.click(); });
    await attente;
    dit(fichier === null, '[lecture] aucun CSV ne part pendant la lecture (avant : « TOTAL 0.00 » et un résultat égal à −charges, sans un mot)', fichier ? fichier.split('\n').filter((l) => /TOTAL|Resultat/.test(l)).join(' | ') : '');
    await ctx.close();
  });

  // ── 5. DATES DE VERSEMENT ILLISIBLES : LE CSV ET LE PDF DISENT « — » ───────
  await essaie('illisibles', async () => {
    const { ctx, pg } = await contexte();
    await pg.addInitScript(LOCAL(), { vrm_compta: COMPTA, vinted_sale_overrides: OV_COMPLET });
    await brancher(pg, { rows: lignes(V), txnKO: true });
    await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(4500);
    await ouvrirBilan(pg);
    const csv = await telechargerCsv(pg);
    const L = csv.split('\n');
    const cot = champ(csv, /^"Estimation cotisations/), res = champ(csv, /^"Resultat apres charges/);
    dit(!!cot && /^—/.test(cot[1]), '[illisibles] CSV : cotisations « — » comme l’écran (avant : un montant calculé sans Vinted)', cot ? cot.join(' ; ') : 'ligne absente');
    dit(!!res && res[1] === '—', '[illisibles] CSV : résultat après charges « — » (avant : −100,00)', res ? res.join(' ; ') : 'ligne absente');
    const iAtt = L.findIndex((l) => /ATTENTION.*versement Vinted illisibles/.test(l)), iMois = L.findIndex((l) => /^"Mois"/.test(l));
    dit(iAtt >= 0 && iAtt < iMois, '[illisibles] CSV : la mention est EN TÊTE, avant les chiffres (avant : en dernière ligne)', `ligne ${iAtt} · tableau ${iMois}`);
    const pdf = await telechargerPdf(pg);
    const iA = pdf.findIndex((t) => /ATTENTION/.test(t)), iM = pdf.findIndex((t) => t === 'Mois');
    const iRes = pdf.findIndex((t) => /Resultat apres charges/.test(t));
    dit(iA >= 0 && iM >= 0 && iA < iM, '[illisibles] PDF : la mention est en tête, avant le tableau', `mention ${iA} · tableau ${iM}`);
    dit(iRes >= 0 && pdf[iRes + 1] === '—', '[illisibles] PDF : résultat après charges « — »', iRes >= 0 ? `« ${pdf[iRes + 1]} »` : 'ligne absente');
    await ctx.close();
  });

  // ── 6. LES COÛTS FIXES COURENT À PARTIR DE LEUR DÉBUT ──────────────────────
  await essaie('fixes', async () => {
    const { ctx, pg } = await contexte({ timezoneId: 'Europe/Paris' });
    await pg.clock.setFixedTime(new Date('2026-10-15T12:00:00+02:00'));
    const fixes = { depenses: [], packs: [], fixes: [
      { id: 'f1', libelle: 'Abonnement', montant: 30, debut: '2026-10' },
      { id: 'f2', libelle: 'Logiciel', montant: 20, debut: '2026-08', fin: '2026-09' },
    ] };
    await pg.addInitScript(LOCAL(), { vrm_compta: fixes });
    await brancher(pg, { rows: [] });
    await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3000);
    const cartes = await pg.evaluate(() => {
      const l = document.body.innerText.split('\n').map((x) => x.trim()).filter(Boolean);
      const v = (re) => { const i = l.findIndex((x) => re.test(x)); return i < 0 ? null : l[i + 1]; };
      return { total: v(/^total charges 2026$/i), mois: v(/^coûts fixes \/ mois$/i) };
    });
    dit(nombre(cartes.total) === 70, '[fixes] « Total charges 2026 » le 15 octobre : 30 € (octobre) + 2 × 20 € (août, septembre) = 70 € (avant : 50 € × 10 mois)', `« ${cartes.total} »`);
    dit(nombre(cartes.mois) === 30, '[fixes] « Coûts fixes / mois » ne compte que ce qui court ce mois-ci', `« ${cartes.mois} »`);
    await ctx.close();
  });

  // ── 7. LE JOUR DE PARIS : LE 1er JANVIER À 00:30 ───────────────────────────
  for (const tz of ['Europe/Paris', 'America/New_York']) {
    await essaie('date ' + tz, async () => {
      const { ctx, pg } = await contexte({ timezoneId: tz });
      await pg.clock.setFixedTime(new Date('2027-01-01T00:30:00+01:00'));
      await pg.addInitScript(LOCAL(), {});
      await brancher(pg, { rows: [] });
      await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3000);
      const d = await pg.evaluate(() => { const i = document.querySelector('input[type="date"]'); return i ? i.value : null; });
      dit(d === '2027-01-01', `[date · navigateur ${tz}] le 1er janvier 2027 à 00:30 (Paris), la dépense est proposée au 1er janvier — pas au 31 décembre (UTC)`, `« ${d} »`);
      await ctx.close();
    });
  }

  // ── 9. SUR TÉLÉPHONE : RIEN NE DÉBORDE (390 px, tactile) ──────────────────
  await essaie('mobile', async () => {
    const { ctx, pg } = await contexte({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Paris' });
    await pg.clock.setFixedTime(new Date('2026-10-15T12:00:00+02:00'));
    const c = { depenses: [{ id: 'd1', date: '2026-10-02', libelle: 'Scotch', cat: 'Emballage', montant: 12 }], packs: [], fixes: [
      { id: 'f1', libelle: 'Abonnement', montant: 30, debut: '2026-10' },
      { id: 'f2', libelle: 'Logiciel', montant: 20, debut: '2026-08', fin: '2026-09' },
      { id: 'f3', libelle: 'Ancien poste', montant: 15 },
    ] };
    const pub = { annee: 2026, ca: 240, nb: 3, nbCout: 1, benefNet: 60, aDater: { n: 1, eur: 50 }, manque: [], at: Date.parse('2026-10-15T10:00:00+02:00') };
    await pg.addInitScript(LOCAL(), { vrm_compta: c, vrm_resultat_annee: pub });
    await brancher(pg, { rows: [] });
    await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(3000);
    const m = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sans: !!document.querySelector('[data-fixe-sans-debut]'), arreter: document.querySelectorAll('[data-fixe-arreter]').length }));
    await pg.screenshot({ path: path.join(__dirname, 'compta-onglet-390.png'), fullPage: true });
    dit(m.sw <= m.cw + 1, '[390 px] l’onglet Comptabilité ne déborde pas', `${m.sw} / ${m.cw}`);
    dit(m.sans && m.arreter === 1, '[390 px] le coût fixe sans début demande « depuis quand ? », et seul celui qui court se propose à l’arrêt', JSON.stringify(m));
    const h = await lireHero(pg);
    dit(!!h && h.valeur === '—' && /pas encore datée/.test(h.suite) && /1 vente sur 3/.test(h.suite), '[390 px] le héro dit « — » et les DEUX causes, d’une phrase', h ? h.suite : '');
    await ctx.close();
  });

  // ── 8. LA FENÊTRE FROIDE : UNE SAISIE AVANT LE NUAGE N'EFFACE RIEN ─────────
  await essaie('froid', async () => {
    const { ctx, pg } = await contexte();
    let liberer; const mainAttend = new Promise((ok) => { liberer = ok; });
    const nuage = { vrm_compta: { depenses: [
      { id: 'a', date: `${Y}-01-10`, libelle: 'Achat Alpha', cat: 'Autre', montant: 1 },
      { id: 'b', date: `${Y}-01-11`, libelle: 'Achat Bravo', cat: 'Autre', montant: 2 },
      { id: 'c', date: `${Y}-01-12`, libelle: 'Achat Charlie', cat: 'Autre', montant: 3 },
    ], fixes: [], packs: [] } };
    const etat = { rows: [], main: nuage, mainAttend };
    await pg.addInitScript(LOCAL(), {});
    await brancher(pg, etat);
    await pg.goto(`http://localhost:${PORT}/?tab=compta`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(2500);
    const ajoute = async (lib, mnt) => {
      await pg.fill('input[placeholder="Ex. rouleau de scotch"]', lib);
      await pg.locator('input[placeholder="€"]').first().fill(String(mnt));
      await pg.getByRole('button', { name: 'Ajouter' }).first().click();
      await pg.waitForTimeout(300);
    };
    await ajoute('Pochettes Delta', 9);                        // AVANT le nuage
    liberer();
    await pg.waitForTimeout(3000);
    const vus = await pg.evaluate(() => ['Achat Alpha', 'Achat Bravo', 'Achat Charlie', 'Pochettes Delta'].filter((x) => document.body.innerText.includes(x)));
    dit(vus.length === 4, '[froid] le nuage arrivé : les trois dépenses du nuage ET celle saisie avant sont à l’écran (avant : la seule saisie froide)', vus.join(', '));
    await ajoute('Ruban Echo', 5);                              // la saisie suivante
    await pg.waitForTimeout(2800);
    const dernier = (etat.posts || []).map((p) => (Array.isArray(p) ? p : [p]).find((r) => r && r.id === 'main')).filter(Boolean).pop();
    const libs = dernier && dernier.data && dernier.data.vrm_compta ? dernier.data.vrm_compta.depenses.map((x) => x.libelle).sort() : null;
    dit(!!libs && ['Achat Alpha', 'Achat Bravo', 'Achat Charlie', 'Pochettes Delta', 'Ruban Echo'].every((x) => libs.includes(x)), '[froid] la saisie suivante part au nuage AVEC les cinq dépenses (avant : les trois du nuage étaient effacées)', libs ? libs.join(', ') : 'aucune écriture de main');
    await ctx.close();
  });

  await b.close(); srv.close();
  console.log(ko ? `\n❌ compta-resultat : ${ko} rouge(s)` : '\n✅ compta-resultat : tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('KO  le banc s’exécute — ' + (e && e.message)); process.exit(1); });
