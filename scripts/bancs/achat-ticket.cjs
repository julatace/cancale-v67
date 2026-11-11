// ════════════════════════════════════════════════════════════════════════════
// BANC : « NOUVEL ACHAT » — LA PHOTO DU TICKET PROPOSE L'ACHAT (11 nov.)
//        node scripts/bancs/achat-ticket.cjs   (après la construction ;
//        BANC_PORT, 7993 par défaut ; SHOTS=dossier pour garder les captures ;
//        BANC_DIST=dossier pour servir un autre build ; BANC_PASSES=390,1512…)
// ════════════════════════════════════════════════════════════════════════════
// La VRAIE lecture : Tesseract (le moteur que l'app charge de cdn.jsdelivr.net,
// aux MÊMES adresses) est servi ici depuis les paquets npm officiels
// (`npm pack`, mis en cache dans le dossier temporaire ; BANC_TESS=dossier pour
// en donner un). Aucun simulateur de texte : c'est l'image du ticket qui est lue.
// Tickets INVENTÉS, dessinés par le banc (aucune donnée réelle).
// Exigé, 390 tactile et 1512, clair et sombre :
//   T1. « Photo du ticket » est en tête du formulaire, cible ≥ 44 px ;
//   T2. le lecteur ne charge pas ⇒ le champ prix reste VIDE et la raison est dite ;
//   T3. ticket lu ⇒ prix 45,00 (le TOTAL TTC, pas le sous-total 50,00 ni le rendu
//       5,00), la date du ticket, le lieu écrit, « 3 articles » ; le prix marqué
//       « Lu sur le ticket — vérifie », le bouton « Valider 45,00 € et ajouter » ;
//   T4. RIEN n'est écrit avant SON clic (aucun achat, aucune facture) ;
//   T5. SON clic ⇒ l'achat à 45 €, daté et situé, le ticket joint comme facture ;
//   T6. un prix qu'il a tapé avant n'est jamais écrasé ;
//   T7. un ticket sans total ⇒ prix vide, « Tape le prix » ;
//   + gestes comptés avant/après, aucune erreur de page, aucun défilement horizontal.
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { execSync } = require('child_process');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const sc = require('./_scenario-colis.cjs');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7993;
const SHOTS = process.env.SHOTS || '';
const J = 86400e3;
let ko = 0, ok = 0; const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d ? ' — ' + d : '')); };

// ── Tesseract : les paquets npm officiels, aux adresses que l'app demande.
const TESS = process.env.BANC_TESS || path.join(os.tmpdir(), 'vrm-banc-tesseract');
const PAQUETS = [['tesseract.js@5.1.1', 'tesseract.js-5.1.1'], ['tesseract.js-core@5.1.1', 'tesseract.js-core-5.1.1'], ['@tesseract.js-data/fra@1.0.0', 'tesseract.js-data-fra-1.0.0']];
function preparerTesseract() {
  try {
    fs.mkdirSync(TESS, { recursive: true });
    for (const [p, d] of PAQUETS) {
      const dir = path.join(TESS, d);
      if (fs.existsSync(path.join(dir, 'package', 'package.json'))) continue;
      const tgz = execSync(`npm pack ${p} --silent`, { cwd: TESS, encoding: 'utf8' }).trim().split('\n').pop();
      fs.mkdirSync(dir, { recursive: true });
      execSync(`tar -xzf ${JSON.stringify(tgz)} -C ${JSON.stringify(dir)}`, { cwd: TESS });
    }
    return true;
  } catch (e) { console.log('  (paquets Tesseract pas obtenus : ' + (e && e.message ? e.message.split('\n')[0] : e) + ')'); return false; }
}
// https://cdn.jsdelivr.net/npm/<paquet>@<v>/<chemin> ⇒ le fichier du paquet.
function fichierCdn(url) {
  const u = new URL(url).pathname.replace(/^\/npm\//, '');
  const m = /^(@tesseract\.js-data\/fra@1\.0\.0|tesseract\.js-core@5\.1\.1|tesseract\.js@5\.1\.1)\/?(.*)$/.exec(u);
  if (!m) return null;
  const d = PAQUETS.find(([p]) => p === m[1])[1];
  let rel = m[2] || '';
  if (!rel && m[1].startsWith('tesseract.js-core')) rel = 'index.js';
  const f = path.join(TESS, d, 'package', rel);
  return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}

// ── Les tickets inventés (dessinés en HTML, photographiés par le banc).
const dateTicket = new Date(Date.now() - 2 * J);
const JJMMAAAA = `${String(dateTicket.getDate()).padStart(2, '0')}/${String(dateTicket.getMonth() + 1).padStart(2, '0')}/${dateTicket.getFullYear()}`;
const ISO_TICKET = `${dateTicket.getFullYear()}-${String(dateTicket.getMonth() + 1).padStart(2, '0')}-${String(dateTicket.getDate()).padStart(2, '0')}`;
const TICKET_OK = ['FRIPERIE DU PORT', '12 RUE INVENTEE', `LE ${JJMMAAAA} 14:32`, '', 'BASKET CUIR 38        30,00', 'BASKET TOILE 41       15,00', 'SAC TOILE              5,00', '3 ARTICLES', 'SOUS-TOTAL            50,00', 'REMISE                -5,00', 'TOTAL TTC             45,00', 'ESPECES               50,00', 'RENDU                  5,00', '', 'MERCI DE VOTRE VISITE'];
const TICKET_SANS_TOTAL = ['BON DE DEPOT', 'BASKET CUIR 38', 'BASKET TOILE 41', 'SAC TOILE'];
const ecrireTicket = async (b, lignes, nom) => {
  const pg = await b.newPage({ viewport: { width: 520, height: 60 + lignes.length * 34 }, deviceScaleFactor: 1 });
  await pg.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff"><pre style="margin:0;padding:28px 30px;font:22px/34px 'DejaVu Sans Mono',monospace;color:#111">${lignes.join('\n')}</pre>`);
  const f = path.join(os.tmpdir(), `vrm-banc-${nom}-${process.pid}.png`);
  await pg.screenshot({ path: f, fullPage: true }); await pg.close();
  return f;
};

const HORS = [{ id: 'ob_banc1', title: 'Nike Dunk Low gris 41', price: '25', date: new Date(sc.NOW - 3 * J).toISOString().slice(0, 10), source: 'Marché de la Croix-Rousse' }];
const main = (sombre) => sc.ligneMain({ vinted_dark: sombre, vinted_offvinted_buys: HORS, vinted_used_numeros: ['1'] });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mjs': 'text/javascript', '.wasm': 'application/wasm' };
const srv = http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); });
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); };
const local = (pg) => pg.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
const achatsLocaux = async (pg) => { const l = await local(pg); for (const [k, v] of Object.entries(l)) { if (!/vinted_offvinted_buys/.test(k)) continue; try { const o = JSON.parse(v); const a = Array.isArray(o) ? o : (o && Array.isArray(o.v) ? o.v : null); if (a) return a; } catch (_) {} } return []; };
const attendre = async (fn, ms = 8000) => { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 200)); } return v; };
const etatTicket = (pg) => pg.evaluate(() => { const x = document.querySelector('[data-achat-ticket]'); return x ? x.getAttribute('data-achat-ticket') : null; });
const finLecture = (pg, ms = 90000) => attendre(async () => { const e = await etatTicket(pg); return e && e !== 'lecture' ? e : null; }, ms);

async function passe(b, nom, ctxOpts, sombre, tickets, tessOk) {
  console.log(`── ${nom}`);
  const ctx = await b.newContext({ ...ctxOpts });
  const pg = await ctx.newPage();
  const errs = [], ecrits = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(!!sb)); } catch (_) {} }, sombre);
  let cdnCoupe = true; const servis = new Set();
  await pg.route('https://cdn.jsdelivr.net/**', (r) => {
    const f = !cdnCoupe && tessOk ? fichierCdn(r.request().url()) : null;
    if (!f) return r.abort();
    servis.add(path.basename(f));
    return r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': MIME[path.extname(f)] || (f.endsWith('.gz') ? 'application/gzip' : 'application/octet-stream'), 'access-control-allow-origin': '*' } });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request(), u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { ecrits.push(String(req.postData() || '')); return j([], 201); }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(sc.comptes());
    if (/id=eq\.main/.test(u)) return j(main(sombre));
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  const tactile = !!ctxOpts.hasTouch;
  const ouvrir = async () => {
    await pg.goto(`http://localhost:${PORT}/?tab=achats&achat=1`, { waitUntil: 'domcontentloaded' });
    await pg.locator('[data-achat-ticket-bouton]').first().waitFor({ timeout: 30000 }).catch(() => {});
    await pg.waitForTimeout(400);
  };

  // T1. Le bouton en tête du formulaire.
  await ouvrir();
  const t1 = await pg.evaluate(() => {
    const f = document.querySelector('[data-achat-hors-form]'); if (!f) return null;
    const bt = f.querySelector('[data-achat-ticket-bouton]'), ph = f.querySelector('[data-achat-hors-photo]');
    return { bt: !!bt, avant: !!(bt && ph && (bt.compareDocumentPosition(ph) & Node.DOCUMENT_POSITION_FOLLOWING)), h: bt ? bt.getBoundingClientRect().height : 0, texte: bt ? bt.textContent : '' };
  });
  dit(t1 && t1.bt && t1.avant && t1.h >= 44, `${nom} · T1 · « Photo du ticket » en tête, cible ≥ 44 px`, JSON.stringify(t1));
  await capture(pg, `achat-ticket-${nom}-1-form`);
  if (!t1 || !t1.bt) {
    // Un banc ne meurt pas, il rapporte : sans le bouton, chaque contrôle du parcours est dit rouge.
    for (const k of ['T2', 'T3a', 'T3b', 'T3c', 'T3d', 'T3e', 'T3f', 'T3g', 'T4', 'T5a', 'T5b', 'T6', 'T7']) dit(false, `${nom} · ${k} · pas joué : aucun bouton « Photo du ticket »`);
    await ctx.close(); return;
  }

  // T2. Le lecteur ne charge pas (CDN coupé) ⇒ vide, et la raison est dite.
  await pg.setInputFiles('[data-achat-ticket-fichier]', tickets.ok);
  await finLecture(pg, 60000);
  const t2 = await pg.evaluate(() => ({ e: document.querySelector('[data-achat-ticket]').getAttribute('data-achat-ticket'), r: document.querySelector('[data-achat-ticket]').getAttribute('data-achat-ticket-raison'), prix: document.querySelector('[data-champ="prix"]').value, dit: (document.querySelector('[data-achat-ticket-resume]') || {}).textContent || '' }));
  dit(t2.e === 'impossible' && t2.prix === '' && /Tape le prix/.test(t2.dit), `${nom} · T2 · lecteur pas chargé ⇒ prix vide, raison dite`, JSON.stringify(t2));
  await capture(pg, `achat-ticket-${nom}-2-impossible`);

  // T3. La vraie lecture.
  cdnCoupe = false;
  await ouvrir();
  const t0 = Date.now();
  await pg.setInputFiles('[data-achat-ticket-fichier]', tickets.ok);
  const e3 = await finLecture(pg, 120000);
  const duree = Math.round((Date.now() - t0) / 100) / 10;
  const t3 = await pg.evaluate(() => {
    const f = document.querySelector('[data-achat-hors-form]'); const q = (s) => f.querySelector(s);
    return { prix: q('[data-champ="prix"]').value, prixLu: q('[data-champ="prix"]').getAttribute('data-prix-lu'), note: (q('[data-prix-lu-note]') || {}).textContent || '',
      date: q('[data-champ="date"]').value, lieu: q('[data-champ="lieu"]').value, articles: (q('[data-achat-ticket-articles]') || { getAttribute: () => null }).getAttribute('data-achat-ticket-articles'),
      bouton: q('[data-achat-hors-enregistrer]').textContent, aValider: q('[data-achat-hors-enregistrer]').getAttribute('data-prix-a-valider'),
      facture: !!q('[data-facture-du-ticket="1"]'), resume: (q('[data-achat-ticket-resume]') || {}).textContent || '' };
  });
  console.log(`     (lecture : ${duree} s · « ${t3.resume} » · servis : ${[...servis].join(', ')})`);
  const detecteur = await pg.evaluate(() => 'TextDetector' in window);
  dit(!detecteur && servis.has('tesseract.min.js') && servis.has('fra.traineddata.gz') && [...servis].some((x) => /\.wasm/.test(x)), `${nom} · T3 · c'est Tesseract qui a lu l'image (moteur, langue, wasm servis)`, JSON.stringify({ detecteur, servis: [...servis] }));
  dit(e3 === 'lu' && t3.prix === '45,00', `${nom} · T3a · prix proposé 45,00 (TOTAL TTC ; ni 50,00 ni 5,00)`, JSON.stringify({ e3, prix: t3.prix }));
  dit(t3.prixLu === '1' && /Lu sur le ticket — vérifie/.test(t3.note), `${nom} · T3b · le prix marqué « Lu sur le ticket — vérifie »`, JSON.stringify(t3.note));
  dit(t3.date === ISO_TICKET, `${nom} · T3c · la date du ticket (${ISO_TICKET})`, t3.date);
  dit(/friperie du port/i.test(t3.lieu), `${nom} · T3d · le lieu écrit sur le ticket`, t3.lieu);
  dit(t3.articles === '3', `${nom} · T3e · « 3 articles sur ce ticket »`, String(t3.articles));
  dit(/Valider 45,00\s€ et ajouter/.test(t3.bouton) && t3.aValider === '1', `${nom} · T3f · le bouton dit « Valider 45,00 € et ajouter »`, t3.bouton);
  dit(t3.facture, `${nom} · T3g · « Ticket joint comme facture »`);
  await pg.locator('[data-achat-ticket]').evaluate((x) => x.scrollIntoView({ block: 'start' }));
  await capture(pg, `achat-ticket-${nom}-3-lu`);
  await pg.locator('[data-champ="prix"]').evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await capture(pg, `achat-ticket-${nom}-3-prix`);

  // T4. Rien n'est écrit avant SON clic.
  const avant = await achatsLocaux(pg);
  dit(!avant.some((a) => Number(String(a.price).replace(',', '.')) === 45) && !ecrits.some((x) => /achat_facture_/.test(x)), `${nom} · T4 · rien d'écrit avant son clic (ni achat ni facture)`);

  // T5. SON clic.
  await pg.fill('[data-champ="titre"]', 'Lot friperie inventé');
  await pg.locator('[data-achat-hors-enregistrer]').evaluate((x) => x.click());
  const a = await attendre(async () => (await achatsLocaux(pg)).find((x) => x && x.title === 'Lot friperie inventé'), 10000);
  dit(!!a && Number(String(a.price).replace(',', '.')) === 45 && a.date === ISO_TICKET && /friperie du port/i.test(a.source || ''), `${nom} · T5a · SON clic enregistre 45 €, la date et le lieu lus`, JSON.stringify(a));
  const fac = await attendre(async () => ecrits.find((x) => /achat_facture_hors_/.test(x) && /data:image\/jpeg;base64,/.test(x)), 8000);
  dit(!!fac, `${nom} · T5b · le ticket part comme facture de l'achat (sa ligne)`);

  // T6. Un prix tapé avant n'est jamais écrasé.
  await ouvrir();
  await pg.fill('[data-champ="prix"]', '38');
  await pg.setInputFiles('[data-achat-ticket-fichier]', tickets.ok);
  await finLecture(pg, 120000);
  const t6 = await pg.evaluate(() => ({ prix: document.querySelector('[data-champ="prix"]').value, lu: document.querySelector('[data-champ="prix"]').getAttribute('data-prix-lu'), b: document.querySelector('[data-achat-hors-enregistrer]').textContent }));
  dit(t6.prix === '38' && !t6.lu && /Ajouter l'achat/.test(t6.b), `${nom} · T6 · son prix tapé (38) n'est pas écrasé`, JSON.stringify(t6));

  // T7. Un ticket sans total.
  await ouvrir();
  await pg.setInputFiles('[data-achat-ticket-fichier]', tickets.sans);
  const e7 = await finLecture(pg, 120000);
  const t7 = await pg.evaluate(() => ({ prix: document.querySelector('[data-champ="prix"]').value, dit: (document.querySelector('[data-achat-ticket-resume]') || {}).textContent || '' }));
  dit(e7 === 'rien' && t7.prix === '' && /Tape le prix/.test(t7.dit), `${nom} · T7 · sans total ⇒ prix vide, « Tape le prix »`, JSON.stringify({ e7, ...t7 }));
  await capture(pg, `achat-ticket-${nom}-7-rien`);

  dit(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nom} · aucun défilement horizontal`);
  dit(!errs.length, `${nom} · aucune erreur de page`, errs.slice(0, 2).join(' | '));
  if (tactile) console.log('     gestes : avant 7 (nom, prix, lieu, date, facture ×2, ajouter) · après 4 (ticket ×2, nom, valider)');
  await ctx.close();
}

(async () => {
  srv.listen(PORT);
  const tessOk = preparerTesseract();
  dit(tessOk, 'les paquets Tesseract officiels sont là (lecture réelle)');
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    const tickets = { ok: await ecrireTicket(b, TICKET_OK, 'ticket-ok'), sans: await ecrireTicket(b, TICKET_SANS_TOTAL, 'ticket-sans') };
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); fs.copyFileSync(tickets.ok, path.join(SHOTS, 'ticket-invente.png')); }
    const seul = (process.env.BANC_PASSES || '').split(',').filter(Boolean);
    const passes = [
      ['390', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'fr-FR' }, false],
      ['390-sombre', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', locale: 'fr-FR' }, true],
      ['1512', { viewport: { width: 1512, height: 950 }, locale: 'fr-FR' }, false],
      ['1512-sombre', { viewport: { width: 1512, height: 950 }, colorScheme: 'dark', locale: 'fr-FR' }, true],
    ];
    for (const [n, o, s] of passes) if (!seul.length || seul.includes(n)) await passe(b, n, o, s, tickets, tessOk);
  } catch (e) { ko++; console.log('❌ le banc a levé — ' + (e && e.message)); }
  await b.close(); srv.close();
  console.log(`\n${ko ? '❌ ' + ko + ' contrôle(s) au rouge' : '✅ Nouvel achat : le ticket propose, il valide'} (${ok} verts)`);
  process.exit(ko ? 1 : 0);
})();
