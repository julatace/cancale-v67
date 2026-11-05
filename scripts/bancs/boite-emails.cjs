require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  Banc de rendu — l'écran « E-mails » (5 nov.)
//  Données INVENTÉES, dans la vraie forme de `/api/email-rattacher?mode=journal`
//  (`boite=`, `adresse=`, `page=`, `lire=`). 390 px tactile et 1512 px, clair et
//  sombre. Juge : l'écran monté par `?tab=emails` et l'entrée de navigation ;
//  les rubriques (Ventes · Achats · Codes de retrait · Colis · Autres) envoyées
//  à la route et l'étiquette de chaque ligne ; le compte (adresse de réception) ;
//  la lecture d'un email (sujet, expéditeur, date, corps en TEXTE, pièces jointes
//  listées, « pas gardé » dit) ; le lien « Voir dans VRM » SEULEMENT par
//  identité, qui mène au bon chemin ; au téléphone une feuille plein écran ;
//  « Relier ma boîte » : cinq messageries, huit expéditeurs, une scène animée
//  (figée en mouvement réduit), AUCUNE requête envoyée ; ni débordement, ni
//  cible < 44 px, ni erreur JavaScript. Captures dans CAPTURE_DIR.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 7967);
const CAPT = process.env.CAPTURE_DIR || path.join(os.tmpdir(), 'banc-boite-emails');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '22222222-2222-2222-2222-222222222222', email: 'vendeuse@exemple.test' } };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 240)); } };

const H = (min) => new Date(Date.UTC(2026, 10, 5, 15, 0) - min * 60000).toISOString();
const id = (i) => 'email_reception_' + String(i).padStart(4, '0') + 'd'.repeat(60);
const E = [
  { id: id(1), at: H(2), etat: 'integre', type: 'suivi', subject: 'Votre colis 12345678 est disponible', from: 'Mondial Relay <noreply@mondialrelay.fr>', resume: { v: 1, t: 'suivi', tr: 'mondialrelay', s: '12345678', st: 'available', code: '418205', lieu: 'Relais Tabac du Port', lim: '09/11/2026' }, pj: 0 },
  { id: id(2), at: H(8), etat: 'integre', type: 'bordereau', subject: "Bordereau d'envoi pour Nike Air Max 90", from: "L'équipe Vinted <no-reply@vinted.fr>", resume: { v: 1, t: 'bordereau', tx: '12345678901', n: '42', pdf: 1, a: 'Nike Air Max 90' }, pj: 1 },
  { id: id(3), at: H(30), etat: 'integre', type: 'vente', subject: 'Ton article est vendu !', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'vente', a: 'Adidas Samba', px: '55', n: '17' }, pj: 0 },
  { id: id(4), at: H(55), etat: 'integre', type: 'achat', subject: 'Ton reçu pour la commande « Nike Air Force 1 »', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'achat', tx: '98765432101', a: 'Nike Air Force 1', px: '45,00', id: 'email_achat_banc', pdf: 1 }, pj: 1 },
  { id: id(5), at: H(80), etat: 'integre', type: 'connu-sans-action', subject: 'Les nouveautés de la semaine', from: 'Vinted <news@team.vinted.fr>', resume: { v: 1, t: 'connu-sans-action', f: 'lettre d’information' }, pj: 0 },
  { id: id(6), at: H(120), etat: 'a-verifier', type: 'ignoré', subject: 'Une forme jamais vue', from: 'contact@exemple.test', resume: { v: 1, t: 'incompris', av: 'incompris' }, pj: 0 },
  { id: id(7), at: H(3000), etat: 'integre', type: 'bordereau', subject: "Bordereau d'envoi pour Vans Old Skool", from: 'no-reply@vinted.fr', resume: null, pj: null },
];
for (let i = 8; i <= 26; i++) E.push({ id: id(i), at: H(3000 + i * 40), etat: 'integre', type: i % 2 ? 'offre' : 'suivi', subject: i % 2 ? `Nouvelle offre ${i}` : `Votre colis ${i} est en route`, from: i % 2 ? 'Vinted <no-reply@vinted.fr>' : 'Chronopost <suivi@chronopost.fr>', resume: i % 2 ? { v: 1, t: 'offre', mt: '30' } : { v: 1, t: 'suivi', s: 'CH' + i, st: 'transit' }, pj: 0 });
E.forEach((e, i) => { e.adresses = [i % 3 === 2 ? 'second@exemple.test' : 'vendeuse@exemple.test']; e.compte = { id: String(i % 3 === 2 ? 2 : 1), nom: i % 3 === 2 ? 'compte-deux' : 'compte-un' }; e.compteAmbigu = false; e.sourceDate = null; });
const RUB = (e) => (e.type === 'suivi' && e.resume && e.resume.code ? 'codes' : ['vente', 'finalisation', 'vente-vestiaire'].includes(e.type) ? 'ventes' : e.type === 'achat' ? 'achats' : ['suivi', 'bordereau'].includes(e.type) ? 'colis' : 'autres');
const dans = (e, r) => !r || (r === 'colis' ? ['colis', 'codes'].includes(RUB(e)) : RUB(e) === r);
const parRubrique = { ventes: 0, achats: 0, codes: 0, colis: 0, autres: 0 }; E.forEach((e) => { const r = RUB(e); parRubrique[r]++; if (r === 'codes') parRubrique.colis++; });
const COMPTEURS = { sur: E.length, plus: false, integre: 25, aVerifier: 1, erreur: 0, incompris: 1, parRubrique };
// (revue du 5 nov.) La route compte sur l'adresse choisie et le dit (`adresse`).
const compteursDe = (adr) => { if (!adr) return COMPTEURS; const l = E.filter((e) => e.adresses.includes(adr)); const pr = { ventes: 0, achats: 0, codes: 0, colis: 0, autres: 0 }; l.forEach((e) => { const r = RUB(e); pr[r]++; if (r === 'codes') pr.colis++; }); return { ...COMPTEURS, sur: l.length, parRubrique: pr, adresse: adr }; };
const TEXTE = {
  [id(1)]: 'Bonjour,​\n\n\n\nVotre colis est disponible au Relais Tabac du Port.\nCode de retrait : 418205\nSuivre : https://suivi.exemple.test/' + 'x'.repeat(120) + '\n<img src=x onerror="window.__xss=1"><b>gras</b>',
  [id(2)]: 'Ton bordereau est prêt. N° de transaction : 12345678901',
  [id(3)]: 'Ton article Adidas Samba est vendu. ' + 'Suite du message. '.repeat(90).slice(0, 1464) + '…',
};
const PIECES = { [id(1)]: [], [id(2)]: [{ n: 'Bordereau-Vinted-12345678901.pdf', t: 'application/pdf', o: 48211 }], [id(4)]: [{ n: 'Recu-achat.pdf', t: 'application/pdf', o: 30200 }] };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function ouvrir(nav, { viewport, tactile, sombre, reduit }) {
  const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile, reducedMotion: reduit ? 'reduce' : 'no-preference', colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(([s, sombre]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); } catch (_) {} window.__aller = []; window.addEventListener('vrm:aller', (e) => window.__aller.push(e.detail)); window.__fiche = []; window.addEventListener('vrm:fiche-article', (e) => window.__fiche.push(e.detail)); }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    if (r.request().method() !== 'GET') return r.fulfill({ status: 201, contentType: 'application/json', body: '' });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  await pg.route('**/api/**', (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get('mode') === 'confidentialite') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, uid: SESSION.user.id }) });
    appels.push({ chemin: u.pathname, q: Object.fromEntries(u.searchParams.entries()), methode: r.request().method() });
    if (u.pathname === '/api/email-rattacher' && u.searchParams.get('mode') === 'journal') {
      const q = Object.fromEntries(u.searchParams.entries());
      if (q.lire) { const e = E.find((x) => x.id === q.lire); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: q.lire, email: e ? { ...e, receivedAt: e.at, pieces: e.pj === null ? null : (PIECES[e.id] || []), texte: TEXTE[e.id] || null, texteCoupe: TEXTE[e.id] ? TEXTE[e.id].length > 1500 && TEXTE[e.id].endsWith('…') : null } : null }) }); }
      let l = E.filter((e) => dans(e, q.boite || ''));
      if (q.adresse) l = l.filter((e) => e.adresses.includes(q.adresse));
      const p = Number(q.page || 0);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: p, parPage: 20, suite: l.length > (p + 1) * 20, emails: l.slice(p * 20, p * 20 + 20), compteurs: compteursDe(q.adresse), adresses: [{ adresse: 'vendeuse@exemple.test', nom: 'compte-un' }, { adresse: 'second@exemple.test', nom: 'compte-deux' }] }) });
    }
    if (u.searchParams.get('mode') === 'reception') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: [], adresses: [], collecteur: {}, limite: 100, plus: false }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=emails`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  return { ctx, pg, erreurs, appels };
}
const journal = (appels) => appels.filter((a) => a.chemin === '/api/email-rattacher' && a.q.mode === 'journal');

(async () => {
  fs.mkdirSync(CAPT, { recursive: true });
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const sombre of [false, true]) for (const [viewport, tactile] of [[{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false]]) {
      const w = viewport.width, nom = `${w}-${sombre ? 'sombre' : 'clair'}`;
      await essaie('boîte ' + nom, async () => {
        const { ctx, pg, erreurs, appels } = await ouvrir(nav, { viewport, tactile, sombre });
        const b = pg.locator('[data-boite-emails]');
        await b.locator('[data-boite-email]').first().waitFor({ timeout: 8000 });
        dit(await b.count() === 1, `${nom} : \`?tab=emails\` monte l'écran E-mails`);
        dit(await pg.locator('h1', { hasText: 'E-mails' }).count() >= 1, `${nom} : grand titre « E-mails »`);
        const th = await pg.evaluate(() => document.documentElement.getAttribute('data-theme'));
        dit(th === (sombre ? 'dark' : 'light'), `${nom} : thème ${sombre ? 'sombre' : 'clair'} posé`, th);
        const lignes = b.locator('[data-boite-email]');
        dit(await lignes.count() === 20, `${nom} : une page de 20 e-mails`, String(await lignes.count()));
        const l1 = b.locator(`[data-boite-email="${id(1)}"]`);
        dit(await l1.getAttribute('data-rubrique') === 'codes' && /Mondial Relay/.test(await l1.innerText()) && /Codes de retrait/.test(await l1.innerText()), `${nom} : ligne — expéditeur lisible, étiquette « Codes de retrait »`, await l1.innerText());
        dit(await b.locator(`[data-boite-email="${id(2)}"] [data-boite-pj="1"]`).count() === 1, `${nom} : trombone + nombre de pièces jointes`);
        dit(await b.locator(`[data-boite-email="${id(6)}"] [data-boite-averifier]`).count() === 1 && await b.locator(`[data-boite-email="${id(1)}"] [data-boite-averifier]`).count() === 0, `${nom} : « à vérifier » seulement où il faut`);
        const coulAmbre = await b.locator(`[data-boite-email="${id(6)}"] [data-boite-averifier]`).evaluate((n) => getComputedStyle(n).color);
        const coulTag = await b.locator(`[data-boite-email="${id(6)}"] .vrm-boite-tag`).evaluate((n) => getComputedStyle(n).color);
        dit(coulAmbre !== coulTag && !/rgb\(2[0-5]\d, [0-6]\d, [0-6]\d\)/.test(coulAmbre), `${nom} : « à vérifier » en ambre (jamais rouge)`, coulAmbre);
        // Rubriques
        await b.locator('[data-boite-rubrique="codes"]').click(); await pg.waitForTimeout(500);
        const dj = journal(appels).at(-1);
        dit(dj && dj.q.boite === 'codes' && await lignes.count() === 1, `${nom} : « Codes de retrait » envoyé à la route, une ligne`, JSON.stringify(dj && dj.q));
        await b.locator('[data-boite-rubrique="colis"]').click(); await pg.waitForTimeout(500);
        dit(journal(appels).at(-1).q.boite === 'colis' && (await lignes.evaluateAll((l) => l.every((x) => ['colis', 'codes'].includes(x.dataset.rubrique)))), `${nom} : « Colis » montre colis et codes`);
        for (const r of ['ventes', 'achats', 'autres']) {
          await b.locator(`[data-boite-rubrique="${r}"]`).click(); await pg.waitForTimeout(400);
          dit(journal(appels).at(-1).q.boite === r && (await lignes.count()) > 0 && (await lignes.evaluateAll((l, rr) => l.every((x) => x.dataset.rubrique === rr), r)), `${nom} : « ${r} » filtré`);
        }
        await b.locator('[data-boite-rubrique="tout"]').click(); await pg.waitForTimeout(400);
        await b.locator('[data-boite-adresse]').selectOption('second@exemple.test'); await pg.waitForTimeout(500);
        dit(journal(appels).at(-1).q.adresse === 'second@exemple.test' && (await lignes.count()) > 0 && /compte-deux/.test(await lignes.first().innerText()), `${nom} : filtre par compte (adresse de réception)`);
        {
          const nV = E.filter((e) => e.adresses.includes('second@exemple.test') && RUB(e) === 'ventes').length;
          const pastille = (await b.locator('[data-boite-rubrique="ventes"]').innerText()).replace(/\D/g, '');
          const couv = b.locator('[data-boite-sur-adresse="second@exemple.test"]');
          await pg.screenshot({ path: path.join(CAPT, `compte-${nom}.png`) });
          dit(pastille === String(nV) && await couv.count() === 1 && /reçus sur second@exemple\.test/.test(await couv.innerText()), `${nom} : compte choisi — le nombre de la pastille et la phrase portent sur CE compte`, `${pastille}/${nV}`);
        }
        await b.locator('[data-boite-adresse]').selectOption(''); await pg.waitForTimeout(500);
        if (!sombre) { await pg.screenshot({ path: path.join(CAPT, `boite-${nom}.png`) }); }
        // Lire un email
        const nLire = journal(appels).filter((a) => a.q.lire).length;
        await l1.click();
        const lec = pg.locator(`[data-boite-lecture="${id(1)}"]`);
        await lec.locator('[data-boite-sujet]').waitFor();
        dit(journal(appels).filter((a) => a.q.lire).length === nLire + 1, `${nom} : le corps se lit sur le clic, un e-mail à la fois`);
        dit((await lec.locator('[data-boite-sujet]').innerText()) === 'Votre colis 12345678 est disponible' && /Mondial Relay/.test(await lec.locator('[data-boite-de]').innerText()) && /noreply@mondialrelay\.fr/.test(await lec.locator('[data-boite-de]').innerText()) && /2026/.test(await lec.locator('[data-boite-date]').innerText()) && /vendeuse@exemple\.test/.test(await lec.locator('[data-boite-recu]').innerText()), `${nom} : sujet, expéditeur, date, adresse de réception`);
        const corps = await lec.locator('[data-boite-corps="lu"]').innerText();
        dit(/\[lien suivi\.exemple\.test\]/.test(corps) && !/\n\n\n/.test(corps) && /<img src=x/.test(corps) && await lec.locator('[data-boite-corps] img, [data-boite-corps] b').count() === 0 && !(await pg.evaluate(() => window.__xss)), `${nom} : corps nettoyé et rendu en TEXTE (aucune balise active)`);
        dit(await lec.locator('[data-boite-pieces="0"]').count() === 1 && /Aucune pièce jointe/.test(await lec.locator('[data-boite-pieces]').innerText()), `${nom} : « Aucune pièce jointe » quand on a lu qu’il n’y en a pas`);
        const objet = lec.locator('[data-boite-objet="retrait"]');
        dit(await objet.count() === 1 && /12345678/.test(await objet.innerText()), `${nom} : « Voir le colis n° 12345678 » (identité : n° de suivi)`);
        if (w > 1000) {
          // L'accent DU THÈME (--vrm-accent, src/themeMineral.js), résolu par le navigateur.
          const [accent, duTheme] = await objet.evaluate((n) => { const t = document.createElement('i'); t.style.color = 'var(--vrm-accent)'; document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return [getComputedStyle(n).backgroundColor, c]; });
          dit(accent === duTheme && /^rgb\(\d+, \d+, 2\d\d\)$/.test(accent), `${nom} : l’accent bleu du thème, rare, sur le seul bouton qui mène à l’objet`, `${accent} / ${duTheme}`);
          await pg.screenshot({ path: path.join(CAPT, `lecture-${nom}.png`) });
        } else {
          dit(await pg.locator('[data-boite-feuille]').count() === 1, `${nom} : au téléphone, l’e-mail s’ouvre en feuille plein écran`);
          const fond = await pg.locator('[data-boite-feuille]').evaluate((n) => getComputedStyle(n).backgroundColor);
          dit(sombre ? /rgb\((0|1\d|2\d), (0|1\d|2\d), (0|1\d|2\d|3\d)\)/.test(fond) : !/rgb\((0|1\d|2\d), /.test(fond), `${nom} : la feuille suit le thème`, fond);
          await pg.screenshot({ path: path.join(CAPT, `lecture-${nom}.png`) });
        }
        await objet.click(); await pg.waitForTimeout(600);
        const aller = await pg.evaluate(() => window.__aller.slice());
        dit(aller.includes('?tab=cat_bord&cible=retrait&suivi=12345678'), `${nom} : le lien mène au colis par son identité`, JSON.stringify(aller));
        // Retour à E-mails, un email sans identité et un email d'avant le 5 nov.
        await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: 'emails' }))); await pg.waitForTimeout(800);
        await b.locator(`[data-boite-email="${id(5)}"]`).click();
        const l5 = pg.locator(`[data-boite-lecture="${id(5)}"]`);
        await l5.locator('[data-boite-sujet]').waitFor();
        dit(await l5.locator('[data-boite-objet="aucun"]').count() === 1 && await l5.locator('button[data-boite-objet]').count() === 0, `${nom} : sans identité lue, aucun lien — et la phrase le dit`);
        dit(await l5.locator('[data-boite-corps="absent"]').count() === 1, `${nom} : texte non gardé ⇒ dit, jamais inventé`);
        if (!tactile) await l5.locator('[data-boite-fermer]').click(); else await pg.locator('[data-boite-feuille] [data-boite-fermer]').click();
        await pg.waitForTimeout(300);
        await b.locator(`[data-boite-email="${id(7)}"]`).scrollIntoViewIfNeeded(); await b.locator(`[data-boite-email="${id(7)}"]`).click();
        const l7 = pg.locator(`[data-boite-lecture="${id(7)}"]`);
        await l7.locator('[data-boite-sujet]').waitFor();
        dit(await l7.locator('[data-boite-pieces="pas-su"]').count() === 1 && /rangé avant le 5 nov/.test(await l7.locator('[data-boite-pieces]').innerText()), `${nom} : pièces d’un e-mail ancien : « liste non gardée » (pas su ≠ aucune)`);
        if (tactile) await pg.locator('[data-boite-feuille] [data-boite-fermer]').click(); else await l7.locator('[data-boite-fermer]').click();
        await pg.waitForTimeout(300);
        await b.locator(`[data-boite-email="${id(2)}"]`).scrollIntoViewIfNeeded(); await b.locator(`[data-boite-email="${id(2)}"]`).click();
        const l2 = pg.locator(`[data-boite-lecture="${id(2)}"]`);
        await l2.locator('[data-boite-sujet]').waitFor();
        dit(await l2.locator('[data-boite-piece="Bordereau-Vinted-12345678901.pdf"]').count() === 1 && /47 Ko/.test(await l2.locator('[data-boite-pieces]').innerText()) && await l2.locator('[data-boite-objet="colis"]').count() === 1, `${nom} : bordereau — pièce listée (nom, poids), lien vers le colis de SA vente`);
        if (tactile) await pg.locator('[data-boite-feuille] [data-boite-fermer]').click(); else await l2.locator('[data-boite-fermer]').click();
        await pg.waitForTimeout(300);
        await b.locator(`[data-boite-email="${id(3)}"]`).scrollIntoViewIfNeeded(); await b.locator(`[data-boite-email="${id(3)}"]`).click();
        const l3 = pg.locator(`[data-boite-lecture="${id(3)}"]`);
        await l3.locator('[data-boite-sujet]').waitFor();
        dit(await l3.locator('[data-boite-corps="extrait"]').count() === 1 && await l3.locator('[data-boite-extrait]').count() === 1 && /Extrait/.test(await l3.locator('[data-boite-extrait]').innerText()), `${nom} : texte coupé à la réception — dit « Extrait », jamais présenté comme le message entier`);
        await pg.screenshot({ path: path.join(CAPT, `extrait-${nom}.png`) });
        if (tactile) { dit(await pg.locator('[data-boite-feuille]').count() === 1, `${nom} : feuille ouverte`); await pg.locator('[data-boite-feuille] [data-boite-fermer]').click(); await pg.waitForTimeout(300); dit(await pg.locator('[data-boite-feuille]').count() === 0, `${nom} : « ‹ Boîte de réception » ferme la feuille`); }
        const debord = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        dit(!debord, `${nom} : aucun débordement horizontal (boîte)`);
        const petits = await pg.locator('[data-boite-emails] button:visible, [data-boite-emails] select:visible').evaluateAll((l) => l.filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => x.textContent.trim().slice(0, 30)));
        dit(petits.length === 0, `${nom} : cibles au doigt ≥ 44 px (boîte)`, petits.join(' | '));
        // Relier ma boîte
        const avant = appels.length;
        await b.locator('[data-boite-vue="relier"]').click();
        const rel = pg.locator('[data-relier-boite]');
        await rel.waitFor();
        dit(await rel.locator('[data-relier-messagerie]').count() === 5 && await rel.locator('[data-relier-exp]').count() === 8, `${nom} : Relier — 5 messageries, 8 expéditeurs`);
        const anim = await rel.locator('.vrm-relier-scene').first().evaluate((n) => [...n.querySelectorAll('*')].some((x) => getComputedStyle(x).animationName !== 'none'));
        dit(anim, `${nom} : la scène est animée (CSS)`);
        for (const m of ['icloud', 'outlook', 'fai', 'autre', 'gmail']) { await rel.locator(`[data-relier-messagerie="${m}"]`).click(); await pg.waitForTimeout(150); }
        dit(await rel.getAttribute('data-messagerie') === 'gmail', `${nom} : on passe d’une messagerie à l’autre`);
        // La lecture automatique avance toute seule : on lit l'étape juste avant « Suivant ».
        const eAv = Number(await rel.locator('[data-relier-etape]').getAttribute('data-relier-etape'));
        await rel.locator('[data-relier-suivant]').click(); await pg.waitForTimeout(200);
        const eAp = Number(await rel.locator('[data-relier-etape]').getAttribute('data-relier-etape'));
        const sc = await rel.locator('.vrm-relier-scene').getAttribute('data-scene');
        dit(eAp === eAv % 5 + 1 && await rel.locator('[data-relier-lecture]').getAttribute('aria-pressed') === 'false' && sc === ['reglages', 'adresse', 'code', 'filtre', 'flux'][eAp - 1], `${nom} : « Suivant » passe à l’étape d’après, sa scène, et met la lecture en pause`, `${eAv} → ${eAp} (${sc})`);
        await rel.locator('[data-relier-exp="chronopost"] .vrm-relier-exp-voir').click(); await pg.waitForTimeout(300);
        dit((await rel.locator('[data-relier-regle]').innerText()).trim() === 'chronopost' && await rel.locator('.vrm-relier-scene[data-scene="filtre"]').count() === 1, `${nom} : toucher un expéditeur montre SA règle dans l’animation`);
        await rel.locator('[data-relier-exp="chronopost"] .vrm-relier-exp-voir').click(); await pg.waitForTimeout(200);
        await rel.locator('[data-relier-exp="ebay"] input').click(); await pg.waitForTimeout(150);
        dit(!/ebay/.test(await rel.locator('[data-relier-regle]').innerText()) && /vinted OR vintedgo OR mondialrelay/.test(await rel.locator('[data-relier-regle]').innerText()), `${nom} : décocher un expéditeur le retire de la règle`);
        const scene = await rel.locator('.vrm-relier-scene').first().innerText();
        dit(/\.test/.test(scene) && !/vendeuse@exemple|vrm\.vinted35/.test(scene), `${nom} : la scène ne montre que des adresses inventées`);
        await rel.locator('[data-relier-messagerie="icloud"]').click(); await pg.waitForTimeout(200);
        await rel.scrollIntoViewIfNeeded();
        await pg.screenshot({ path: path.join(CAPT, `relier-${nom}.png`), fullPage: false });
        // Chaque scène regardée à la FIN de son mouvement (≈ 3 s), étape par étape.
        for (let k = 0; k < 5; k++) {
          if (k) { await rel.locator('[data-relier-suivant]').click(); }
          await pg.waitForTimeout(3000);
          if (w > 1000 || k === 3) await rel.locator('.vrm-relier-scene-bloc').screenshot({ path: path.join(CAPT, `relier-scene-${nom}-${k + 1}.png`) });
        }
        dit(appels.slice(avant).filter((a) => a.chemin !== '/api/compte').length === 0, `${nom} : « Relier ma boîte » n’envoie RIEN`, JSON.stringify(appels.slice(avant)));
        const debord2 = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        dit(!debord2, `${nom} : aucun débordement horizontal (Relier)`);
        const petits2 = await pg.locator('[data-relier-boite] button:visible').evaluateAll((l) => l.filter((x) => x.getBoundingClientRect().height < 43.5 || x.getBoundingClientRect().width < 43.5).map((x) => x.textContent.trim().slice(0, 30) || x.getAttribute('aria-label')));
        dit(petits2.length === 0, `${nom} : cibles ≥ 44 px (Relier)`, petits2.join(' | '));
        // L'entrée de navigation
        const entree = await pg.evaluate(() => [...document.querySelectorAll('a,button')].some((x) => x.textContent.trim() === 'E-mails'));
        dit(entree || tactile, `${nom} : « E-mails » dans la colonne de navigation`);
        dit(erreurs.length === 0, `${nom} : aucune erreur JavaScript`, erreurs.join(' '));
        await ctx.close();
      });
    }
    await essaie('mouvement réduit', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { viewport: { width: 390, height: 844 }, tactile: true, sombre: false, reduit: true });
      await pg.locator('[data-boite-vue="relier"]').click();
      await pg.locator('[data-relier-boite]').waitFor();
      const anim = await pg.locator('.vrm-relier-scene').first().evaluate((n) => [...n.querySelectorAll('*')].filter((x) => getComputedStyle(x).animationName !== 'none').length);
      const lecture = await pg.locator('[data-relier-lecture]').getAttribute('aria-pressed');
      dit(anim === 0 && lecture === 'false', 'mouvement réduit : scène figée, lecture automatique coupée', `${anim} ${lecture}`);
      const e0 = await pg.locator('[data-relier-etape]').getAttribute('data-relier-etape'); await pg.waitForTimeout(5000);
      dit(await pg.locator('[data-relier-etape]').getAttribute('data-relier-etape') === e0, 'mouvement réduit : l’étape ne défile pas toute seule');
      dit(erreurs.length === 0, 'mouvement réduit : aucune erreur JavaScript', erreurs.join(' '));
      await ctx.close();
    });
  } finally { await nav.close(); srv.close(); }
  console.log({ ok, ko, captures: CAPT }); process.exit(ko ? 1 : 0);
})();
