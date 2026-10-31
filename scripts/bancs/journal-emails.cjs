require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  Banc de rendu — « Tes emails, ce que VRM en a fait » (31 oct.)
//  Données INVENTÉES, dans la vraie forme de `/api/email-rattacher?mode=journal`
//  (page de 20, résumé court, compteurs ; texte lu à part). 390 px tactile et
//  1512 px. Juge : la phrase de chaque type, l'état (data-etat), le lien vers
//  l'onglet de la chose concernée, le N° qui n'est ouvert QUE s'il est lu dans
//  l'email, le texte rendu en TEXTE (aucun HTML actif), « Ce n'est pas ça »
//  réversible, les filtres envoyés à la route, « Voir plus », l'entrée depuis
//  Colis (ambre, ouvre le journal filtré), aucune lecture tant que l'onglet
//  n'est pas affiché, aucune relecture toute seule.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT || 9231);
const CAPT = process.env.CAPTURE_DIR || path.join(__dirname, '..', '..', 'docs', 'style-2026-10-31', 'emails');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '22222222-2222-2222-2222-222222222222', email: 'vendeuse@exemple.test' } };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 200)); } };

const H = (min) => new Date(Date.UTC(2026, 9, 31, 15, 0) - min * 60000).toISOString();
const id = (i) => 'email_reception_' + String(i).padStart(4, '0') + 'b'.repeat(60);
const E = [
  { id: id(1), at: H(2), etat: 'integre', type: 'bordereau', subject: "Bordereau d'envoi pour Nike Air Max 90 N°42", from: "L'équipe Vinted <no-reply@vinted.fr>", resume: { v: 1, t: 'bordereau', tx: '12345678901', n: '42', pdf: 1, tp: 1, a: 'Nike Air Max 90' } },
  { id: id(2), at: H(9), etat: 'integre', type: 'suivi', subject: 'Votre colis 12345678 est disponible', from: 'Mondial Relay <noreply@mondialrelay.fr>', resume: { v: 1, t: 'suivi', tr: 'mondialrelay', s: '12345678', st: 'available', code: '418205', lieu: 'Relais Tabac du Port', lim: '07/11/2026' } },
  { id: id(3), at: H(20), etat: 'a-verifier', type: 'bordereau', subject: "Bordereau d'envoi pour Adidas Samba OG", from: 'no-reply@vinted.fr', resume: { v: 1, t: 'bordereau', tx: '22223333444', n: '117', nt: 1, pdf: 1, a: 'Adidas Samba OG', av: 'num-titre' } },
  { id: id(4), at: H(31), etat: 'integre', type: 'achat', subject: 'Ton reçu pour la commande « Nike Air Force 1 »', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'achat', tx: '98765432101', a: 'Nike Air Force 1', px: '45,00', id: 'email_achat_banc01', pdf: 0 } },
  { id: id(5), at: H(44), etat: 'a-verifier', type: 'achat', subject: 'Ton reçu pour la commande « Nike Air Force 1 »', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'achat', a: 'Nike Air Force 1', px: '45,00', pdf: 0, av: 'sans-tx' } },
  { id: id(6), at: H(60), etat: 'integre', type: 'suivi', subject: 'Votre colis a été livré', from: 'Chronopost <suivi@chronopost.fr>', resume: { v: 1, t: 'suivi', tr: 'chronopost', s: 'XY123456789FR', st: 'delivered' } },
  { id: id(7), at: H(75), etat: 'a-verifier', type: 'ignoré', subject: 'Nouvelle forme jamais vue', from: 'contact@exemple.test', resume: { v: 1, t: 'incompris', av: 'incompris' } },
  { id: id(8), at: H(90), etat: 'erreur', type: 'vente', subject: 'Ton article est vendu !', from: 'no-reply@vinted.fr', resume: { v: 1, t: 'panne', av: 'panne' } },
  { id: id(9), at: H(120), etat: 'integre', type: 'offre', subject: 'Nouvelle offre', from: 'no-reply@vinted.fr', resume: { v: 1, t: 'offre', mt: '35', de: 'marie_b', a: 'Nike Dunk Low' } },
  { id: id(10), at: H(2000), etat: 'integre', type: 'bordereau', subject: "Bordereau d'envoi pour Vans Old Skool", from: 'no-reply@vinted.fr', resume: null },
];
for (let i = 11; i <= 26; i++) E.push({ id: id(i), at: H(2000 + i * 30), etat: 'integre', type: 'connu-sans-action', subject: `Newsletter Vinted ${i}`, from: 'Vinted <news@team.vinted.fr>', resume: { v: 1, t: 'connu-sans-action', f: 'newsletter Vinted' } });
E.forEach((e) => { e.adresses = ['vendeuse@exemple.test']; e.compte = { id: '1', nom: 'vendeuse-un' }; e.compteAmbigu = false; e.sourceDate = null; });
const COMPTEURS = { sur: E.length, plus: false, integre: E.filter((e) => e.etat === 'integre').length, aVerifier: E.filter((e) => e.etat === 'a-verifier').length, erreur: 1, incompris: 1 };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { viewport, tab = 'settings', tactile = false }) {
  const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); } catch (_) {} }, SESSION);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    if (r.request().method() !== 'GET') return r.fulfill({ status: 201, contentType: 'application/json', body: '' });
    if (/id=eq\.vrm_email_owners/.test(decodeURIComponent(r.request().url()))) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ data: { adresses: { 'vendeuse@exemple.test': { owner: SESSION.user.id } } } }]) });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const journal = [];
  await pg.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get('mode') === 'confidentialite') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: SESSION.user.id }) });
    if (u.pathname === '/api/email-rattacher' && u.searchParams.get('mode') === 'journal') {
      const q = Object.fromEntries(u.searchParams.entries()); journal.push(q);
      if (q.texte) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: q.texte, texte: q.texte === id(7) ? 'Bonjour,\n<img src=x onerror="window.__xss=1"><b>gras</b>\nCode : 418205' : q.texte === id(10) ? null : 'Ton bordereau est prêt. N° de transaction : 12345678901' }) });
      if (q.compte === '1') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, compteurs: COMPTEURS }) });
      let l = E.slice();
      if (q.etat) l = l.filter((e) => e.etat === q.etat);
      if (q.type === 'achat') l = l.filter((e) => e.type === 'achat');
      const p = Number(q.page || 0);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: p, parPage: 20, suite: l.length > (p + 1) * 20, emails: l.slice(p * 20, p * 20 + 20), compteurs: COMPTEURS, adresses: [{ adresse: 'vendeuse@exemple.test', nom: 'vendeuse-un' }] }) });
    }
    if (u.searchParams.get('mode') === 'reception') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: [], adresses: [], collecteur: {}, limite: 100, plus: false }) });
    if (u.pathname === '/api/email-rattacher') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: [] }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3000);
  return { ctx, pg, erreurs, journal };
}
async function versJournal(pg) {
  const sousAdr = pg.locator('[data-sous-ouvrir="adresses"]').first();
  if (await sousAdr.isVisible().catch(() => false)) { await sousAdr.click(); await pg.waitForTimeout(500); }
  await pg.getByRole('navigation', { name: 'Rubriques des emails' }).getByRole('button', { name: /Journal/ }).click();
  await pg.locator('[data-journal-emails] .vrm-journal-ligne').first().waitFor();
}

(async () => {
  fs.mkdirSync(CAPT, { recursive: true });
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const [viewport, tactile] of [[{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false]]) {
      const w = viewport.width;
      await essaie('journal ' + w, async () => {
        const { ctx, pg, erreurs, journal } = await ouvrir(nav, { viewport, tactile });
        dit(journal.filter((q) => !q.compte).length === 0, `${w} : aucune lecture du journal tant que son onglet n'est pas affiché`, JSON.stringify(journal));
        await versJournal(pg);
        const j = pg.locator('[data-journal-emails]');
        const ligne = (i) => j.locator(`[data-journal-email="${id(i)}"]`);
        dit(await j.locator('.vrm-journal-ligne').count() === 20, `${w} : une page de 20 emails`);
        const q = async (i) => (await ligne(i).locator('[data-journal-quoi]').innerText()).trim();
        const f = async (i) => (await ligne(i).locator('[data-journal-fait]').innerText()).trim();
        dit(await q(1) === 'Bordereau de la vente Nike Air Max 90' && /vente n° 12345678901 · N°42 · déjà tamponné/.test(await f(1)), `${w} : bordereau — la phrase et ce que VRM a fait`, await f(1));
        dit(await ligne(1).getAttribute('data-etat') === 'range' && await ligne(1).locator('[data-journal-lien="cat_bord"]').count() === 1 && await ligne(1).locator('[data-journal-num="42"]').count() === 1, `${w} : bordereau rangé, lien Colis, « Tout sur le N°42 »`);
        dit(/^Code de retrait 418 205 chez Relais Tabac du Port/.test(await q(2)) && (await f(2)) === 'Rangé avec le colis n° 12345678' && /Mondial Relay/.test(await ligne(2).innerText()), `${w} : code de retrait — Mondial Relay, code lisible, colis par son n°`, await q(2));
        dit(await ligne(3).getAttribute('data-etat') === 'verifier' && await ligne(3).locator('[data-journal-num]').count() === 0 && /retrouvé par le titre/.test(await ligne(3).locator('[data-journal-raison]').innerText()) && /carton/.test(await ligne(3).locator('[data-journal-raison]').innerText()), `${w} : N° deviné par le titre — à vérifier, raison + geste, aucun lien vers ce N°`);
        dit((await q(4)) === 'Reçu d’achat · Nike Air Force 1 (45,00 €)' && (await f(4)) === 'Reçu rangé avec ton achat n° 98765432101' && await ligne(4).locator('[data-journal-lien="cat_achats"]').count() === 1, `${w} : reçu d'achat — relié par son n° de transaction, lien Achats`);
        dit(await ligne(5).getAttribute('data-etat') === 'verifier' && /n° de transaction/.test(await ligne(5).innerText()) && await ligne(5).locator('[data-journal-delier]').count() === 0, `${w} : reçu au MÊME titre sans n° — à vérifier, jamais relié, rien à délier`);
        dit((await q(6)) === 'Colis livré' && /Chronopost/.test(await ligne(6).innerText()), `${w} : colis livré, de Chronopost`);
        dit(await ligne(7).getAttribute('data-etat') === 'incompris' && /jamais jeté/.test(await f(7)), `${w} : pas compris — gardé, jamais jeté`);
        dit(await ligne(8).getAttribute('data-etat') === 'reessai' && /renvoyer tout seul/.test(await f(8)), `${w} : en attente de réessai`);
        dit((await f(10)) === 'Classé avant le 31 oct. — détail non gardé.', `${w} : un ancien email ne s'invente pas d'action`);
        const sombre = await ligne(3).locator('.vrm-journal-etat').evaluate((n) => getComputedStyle(n).color);
        const neutre = await ligne(1).locator('.vrm-journal-etat').evaluate((n) => getComputedStyle(n).color);
        dit(sombre !== neutre, `${w} : « à vérifier » porte l'ambre, « rangé » reste neutre`, `${sombre} / ${neutre}`);
        // Le texte, en TEXTE.
        const avant = journal.length;
        await ligne(7).locator('[data-journal-voir]').click();
        await ligne(7).locator('[data-journal-texte="lu"]').waitFor();
        dit(journal.length === avant + 1 && journal[journal.length - 1].texte === id(7), `${w} : « Voir le texte » lit UN email, à la demande`);
        dit(await ligne(7).locator('.vrm-journal-texte img, .vrm-journal-texte b').count() === 0 && /<img src=x/.test(await ligne(7).locator('.vrm-journal-texte').innerText()) && !(await pg.evaluate(() => window.__xss)), `${w} : le texte est affiché en texte — aucune balise active`);
        await ligne(10).locator('[data-journal-voir]').click();
        await ligne(10).locator('[data-journal-texte="absent"]').waitFor();
        dit(/Texte non gardé/.test(await ligne(10).innerText()), `${w} : texte absent ⇒ « non gardé », jamais inventé`);
        // Ce n'est pas ça — réversible.
        await ligne(4).locator('[data-journal-delier]').click();
        await pg.waitForTimeout(800);
        const delies = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_recus_delies') || 'null'); } catch (_) { return null; } });
        dit(delies && delies.email_achat_banc01 && delies.email_achat_banc01.tx === '98765432101' && await ligne(4).getAttribute('data-etat') === 'delie' && await ligne(4).locator('[data-journal-relier]').count() === 1, `${w} : « Ce n'est pas ça » délie le reçu (sans rien supprimer)`, JSON.stringify(delies));
        if (w === 1512) await ligne(4).screenshot({ path: path.join(CAPT, 'journal-delie-1512.png') });
        await ligne(4).locator('[data-journal-relier]').click();
        await pg.waitForTimeout(800);
        const apres = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_recus_delies') || 'null'); } catch (_) { return null; } });
        dit(apres && !apres.email_achat_banc01 && await ligne(4).getAttribute('data-etat') === 'range', `${w} : « Relier à nouveau » le remet`);
        dit(await ligne(1).locator('[data-journal-delier]').count() === 0 && /n° de transaction/.test(await ligne(1).locator('.vrm-journal-pourquoi').textContent().catch(() => '')) , `${w} : bordereau — pas de « Ce n'est pas ça », et le pourquoi est dit`);
        await j.evaluate((n) => n.scrollIntoView({ block: 'start' })); await pg.evaluate(() => window.scrollBy(0, -70)); await pg.waitForTimeout(200);
        await pg.screenshot({ path: path.join(CAPT, `journal-${w}.png`), fullPage: false });
        if (w > 1000) await j.screenshot({ path: path.join(CAPT, `journal-complet-${w}.png`) });
        // Voir plus.
        const nAvant = journal.length;
        await j.locator('[data-journal-plus]').click();
        await pg.waitForTimeout(400);
        dit(journal.length === nAvant + 1 && journal[journal.length - 1].page === '1' && await j.locator('.vrm-journal-ligne').count() === E.length, `${w} : « Voir plus » demande la page suivante, et l'ajoute`);
        // Filtres.
        await j.locator('[data-journal-filtre="a-verifier"]').click();
        await pg.waitForTimeout(400);
        dit(journal[journal.length - 1].etat === 'a-verifier' && await j.locator('.vrm-journal-ligne').count() === 3 && (await j.locator('.vrm-journal-ligne').evaluateAll((l) => l.every((x) => ['verifier', 'incompris'].includes(x.dataset.etat)))), `${w} : « À vérifier » filtre par la route`);
        dit((await j.locator('[data-journal-filtre="a-verifier"]').getAttribute('data-n')) === '3', `${w} : le compteur « à vérifier » vient de la route`);
        await j.evaluate((n) => n.scrollIntoView({ block: 'start' })); await pg.evaluate(() => window.scrollBy(0, -70)); await pg.waitForTimeout(200);
        await pg.screenshot({ path: path.join(CAPT, `journal-a-verifier-${w}.png`), fullPage: false });
        await j.locator('[data-journal-type]').selectOption('achat');
        await pg.waitForTimeout(400);
        dit(journal[journal.length - 1].type === 'achat', `${w} : filtre par type envoyé à la route`);
        // Aucune relecture toute seule.
        const n0 = journal.length; await pg.waitForTimeout(2500);
        dit(journal.length === n0, `${w} : aucune relecture toute seule`);
        // Le lien ouvre l'onglet.
        await j.locator('[data-journal-filtre="tout"]').click(); await j.locator('[data-journal-type]').selectOption(''); await pg.waitForTimeout(400);
        await ligne(1).locator('[data-journal-lien="cat_bord"]').click();
        await pg.locator('[data-journal-entree]').waitFor();
        dit(await pg.locator('[data-journal-entree]').isVisible(), `${w} : « Ouvrir Colis » mène à Colis`);
        // Depuis Colis : l'entrée ambre ouvre le journal filtré.
        const entree = pg.locator('[data-journal-entree]');
        await pg.waitForFunction(() => { const e = document.querySelector('[data-journal-entree]'); return e && e.dataset.n !== ''; });
        dit((await entree.innerText()).includes('3 à vérifier'), `${w} : Colis — « 3 à vérifier » en ambre`, await entree.innerText());
        await entree.scrollIntoViewIfNeeded(); await entree.screenshot({ path: path.join(CAPT, `colis-entree-${w}.png`) });
        await entree.locator('button').click();
        await pg.locator('[data-journal-emails] .vrm-journal-ligne').first().waitFor();
        await pg.waitForTimeout(300);
        dit(await pg.locator('[data-journal-filtre="a-verifier"]').getAttribute('aria-pressed') === 'true' && journal[journal.length - 1].etat === 'a-verifier', `${w} : depuis Colis, le journal s'ouvre sur « À vérifier »`);
        const debord = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        dit(!debord, `${w} : aucun débordement horizontal`);
        const petits = await pg.locator('[data-journal-emails] button, [data-journal-emails] select').evaluateAll((l) => l.filter((x) => x.offsetParent && x.getBoundingClientRect().height < 43.5).map((x) => x.textContent.trim().slice(0, 30)));
        dit(petits.length === 0, `${w} : cibles au doigt ≥ 44 px`, petits.join(' | '));
        dit(erreurs.length === 0, `${w} : aucune erreur JavaScript`, erreurs.join(' '));
        await ctx.close();
      });
    }
  } finally { await nav.close(); srv.close(); }
  console.log({ ok, ko }); process.exit(ko ? 1 : 0);
})();
