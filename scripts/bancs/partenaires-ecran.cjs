require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC D'ÉCRAN — LE PROGRAMME PARTENAIRE (15 nov.), RENDU (dist/ + faux serveur)
//    · Réglages → Abonnement, compte PROPRIÉTAIRE : le groupe « Partenaires » ;
//      « Leo · LEO » dit « 23 clients payants · 69,00 € à lui verser pour <mois> (au …) » ;
//      la fiche (bande de chiffres, son lien, mois par mois) ; « Versé » ouvre la
//      saisie et envoie mois + montant sur SON clic, rien avant ; Max en pause ;
//    · un vendeur (pas propriétaire) : aucun groupe Partenaires, aucune lecture de
//      `mode=partenaires` (le parrainage reste) ;
//    · la page privée du partenaire (`?espace-partenaire=`) : ses nombres, le tableau
//      mois par mois, la phrase « Publicité » / « Collaboration commerciale », aucun
//      e-mail ni identifiant ; un lien mort ⇒ « Ce lien n'est plus valable » ;
//    · 390 px tactile et 1512 px, clair et sombre : rien ne déborde de la page ; les
//      boutons du programme sont aux quatre formes, aucun « plein » ; aucun rouge.
//  Les chiffres servis sont calculés par la VRAIE règle (api/_lib/partenaires-regle.js)
//  sur des commissions INVENTÉES (le dépôt est public).
//  Captures : $BANC_CAPTURES (défaut : dossier temporaire « banc-partenaires-ecran »).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4561;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-partenaires-ecran');
fs.mkdirSync(CAPTURES, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'proprio@exemple.test' } };
const PRIX = { montant: 16.99, devise: 'eur', intervalle: 'month' };
const base = { ok: true, configure: true, modeTest: true, obligatoire: false, prix: PRIX, prixConforme: true, prixStripe: null, statut: null, finPeriode: null, annuleFinPeriode: false, peutGerer: false, actif: true, acces: true, lecture: true, lectureSeule: false, mentionsCompletes: true, essaiDispo: false, essaiJours: 7, prixAbonnement: null };
const ABO_PROPRIO = { ...base, proprietaire: true };
const ABO_VENDEUR = { ...base, proprietaire: false, statut: 'active', peutGerer: true, prixAbonnement: { montant: 16.99, devise: 'eur', intervalle: 'month', texte: '16,99 € / mois' } };
const JETON = 'Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4zAb7cDe0fGh2';
const J = 864e5, NOW = Date.now();

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + String(d).slice(0, 200) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 200)); } };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function donnees() {
  const R = await import(pathToFileURL(path.join(__dirname, '..', '..', 'api', '_lib', 'partenaires-regle.js')).href);
  const f = (i) => `99999999-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const leOct = NOW - 17 * J, leNov = NOW - 3 * J;
  const com = [];
  for (let i = 1; i <= 23; i++) com.push({ filleul: f(i), mois: R.moisParis(leOct), montant_centimes: 300, paye_le: new Date(leOct).toISOString(), due_le: new Date(leOct + 14 * J).toISOString(), annulee_le: null });
  com.push({ filleul: f(24), mois: R.moisParis(leOct), montant_centimes: 300, paye_le: new Date(leOct).toISOString(), due_le: new Date(leOct + 14 * J).toISOString(), annulee_le: new Date(leOct + J).toISOString(), annulee_raison: 'remboursement' });
  const moisNov = R.moisParis(leNov);
  if (moisNov !== R.moisParis(leOct)) for (let i = 1; i <= 6; i++) com.push({ filleul: f(i), mois: moisNov, montant_centimes: 300, paye_le: new Date(leNov).toISOString(), due_le: new Date(leNov + 14 * J).toISOString(), annulee_le: null });
  const avant = { mois: R.moisParis(NOW - 50 * J), montant_centimes: 1800, verse_le: new Date(NOW - 30 * J).toISOString().slice(0, 10) };
  for (let i = 1; i <= 6; i++) com.push({ filleul: f(i), mois: avant.mois, montant_centimes: 300, paye_le: new Date(NOW - 50 * J).toISOString(), due_le: new Date(NOW - 36 * J).toISOString(), annulee_le: null });
  const actifs = new Set(Array.from({ length: 23 }, (_, i) => f(i + 1)));
  const leo = R.chiffresPartenaire({ commissions: com, versements: [avant], inscrits: 31, actifs, maintenant: NOW });
  const max = R.chiffresPartenaire({ commissions: [], versements: [], inscrits: 2, actifs: new Set(), maintenant: NOW });
  const au = new Date(NOW).toISOString();
  const liste = { ok: true, installe: true, au, commissionCentimes: 300, delaiJours: 14, stripe: true, partenaires: [
    { id: 'aaaaaaaa-0000-4000-8000-00000000000a', nom: 'Leo', code: 'LEO', contact: 'leo@exemple.test', pause: false, pauseLe: null, coupon: null, lienPrivePose: true, cree: au, lien: 'https://vrm.center/p/LEO', chiffres: leo },
    { id: 'bbbbbbbb-0000-4000-8000-00000000000b', nom: 'Maximilien-Alexandre du Pont', code: 'MAXIMILIEN2026', contact: null, pause: true, pauseLe: au, coupon: null, lienPrivePose: true, cree: au, lien: 'https://vrm.center/p/MAXIMILIEN2026', chiffres: max },
  ] };
  const page = { ok: true, nom: 'Leo', code: 'LEO', lien: 'https://vrm.center/p/LEO', pause: false, commissionCentimes: 300, delaiJours: 14, au, chiffres: leo };
  return { liste, page, leo, R };
}

async function ouvrirReglages(nav, { largeur, sombre, abo, D }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', deviceScaleFactor: mobile ? 2 : 1 });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(({ s, sombre }) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); localStorage.setItem('vrm_reglages_vue', 'abonnement'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_configuration', JSON.stringify({ etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 })); const t = new Date().toISOString(); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ extension: t, emails: t, vinted: t, premiere: t, configuration: t })); } catch (_) {} }, { s: SESSION, sombre });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = r.request().url(), m = r.request().method();
    if (/rpc\/vrm_acces/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ obligatoire: false, proprietaire: abo.proprietaire, acces: true, lecture: true }) });
    if (m !== 'GET' && !/\/rpc\//.test(u)) { let rows = []; try { const b = JSON.parse(r.request().postData() || '[]'); rows = Array.isArray(b) ? b : [{ id: 'main', ...b }]; } catch (_) {} return r.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(rows) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  await pg.route('**/api/**', (r) => {
    const u = r.request().url(), m = r.request().method();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(abo) });
    if (/mode=factures/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, factures: [], carte: null }) });
    if (/mode=partenaires/.test(u)) {
      appels.push({ m, corps: r.request().postData() || '' });
      if (m === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(D.liste) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    if (/mode=parrainage/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, installe: true, ouvert: true, code: 'K7MQ4RZP', suivi: { inscrits: 0, payes: 0, moisOfferts: 0, enAttente: 0 }, filleuls: [], filleul: { parraine: false } }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  await pg.waitForFunction(() => { const w = document.querySelector('[data-abonnement]'); return !!w && w.getAttribute('data-abonnement') !== 'chargement'; }, null, { timeout: 15000 }).catch(() => {});
  return { ctx, pg, erreurs, appels };
}

// Rien ne déborde de la page ; les boutons du programme aux quatre formes ; aucun « plein » ; aucun rouge.
const regles = (pg, racine) => pg.evaluate((sel) => {
  const el = document.querySelector(sel);
  const boutons = el ? [...el.querySelectorAll('button')] : [];
  const formes = boutons.filter((b) => !/\bsb-(btn-plein|touche|rond|lien|rangee|tuile|lame)\b/.test(b.className) && !b.closest('.vrm-ios-rangee')).map((b) => b.className || b.innerText);
  const rouges = el ? [...el.querySelectorAll('*')].filter((x) => { const c = getComputedStyle(x).color.match(/\d+/g); return c && +c[0] > 180 && +c[1] < 80 && +c[2] < 80; }).length : -1;
  const deb = el ? [...el.querySelectorAll('*')].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1) && !x.closest('.vrm-pp-defile'); }).map((x) => x.className || x.tagName).slice(0, 3) : [];
  return { existe: !!el, page: document.documentElement.scrollWidth <= window.innerWidth + 1, deborde: deb, formes, pleins: el ? el.querySelectorAll('.sb-btn-plein').length : -1, rouges, cibles: boutons.filter((b) => { const r = b.getBoundingClientRect(); return r.height > 0 && r.height < 40; }).map((b) => b.innerText.trim()).slice(0, 3) };
}, racine);

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent — lance `npm run build` d’abord. Banc NON exécuté.'); process.exit(1); }
  await new Promise((r) => srv.listen(PORT, r));
  const D = await donnees();
  const nav = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const largeur of [390, 1512]) for (const sombre of [false, true]) {
      const nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n── Réglages → Abonnement · propriétaire · ${nom}`);
      await essaie('réglages ' + nom, async () => {
        const { ctx, pg, erreurs, appels } = await ouvrirReglages(nav, { largeur, sombre, abo: ABO_PROPRIO, D });
        await pg.waitForSelector('[data-partenaires="lu"]', { timeout: 15000 }).catch(() => {});
        const etat = await pg.evaluate(() => {
          const r = document.querySelector('[data-partenaires]');
          const leo = document.querySelector('[data-partenaire="LEO"]'), max = document.querySelector('[data-partenaire="MAXIMILIEN2026"]');
          return { etat: r && r.getAttribute('data-partenaires'), n: r && r.getAttribute('data-partenaires-n'), leo: leo ? leo.innerText : '', max: max ? max.innerText : '', pauseMax: max && max.getAttribute('data-pause') };
        });
        dit(etat.etat === 'lu' && etat.n === '2', 'le groupe « Partenaires » est rendu, deux partenaires', JSON.stringify(etat).slice(0, 160));
        dit(/23 clients payants · 69,00\s?€ à lui verser pour \S+ \d{4} \(au \d+/.test(etat.leo), '« Leo · LEO · 23 clients payants · 69,00 € à lui verser pour <mois> (au …) »', etat.leo.replace(/\s+/g, ' '));
        dit(etat.pauseMax === '1' && /En pause/.test(etat.max) && /rien à verser/.test(etat.max), 'Max : « En pause », « rien à verser »');
        await pg.click('[data-partenaire-ouvrir="LEO"]');
        await pg.waitForSelector('[data-partenaire-fiche="LEO"]', { timeout: 5000 });
        const fiche = await pg.evaluate(() => {
          const f = document.querySelector('[data-partenaire-fiche="LEO"]');
          const v = (k) => { const x = f.querySelector(`[data-chiffre="${k}"]`); return x ? x.textContent.trim() : null; };
          return { inscrits: v('inscrits'), payants: v('payants'), reste: f.querySelector('[data-chiffre="reste"]').getAttribute('data-centimes'), lien: (f.querySelector('[data-lien-partenaire]') || {}).textContent, mois: [...f.querySelectorAll('[data-mois]')].map((m) => [m.getAttribute('data-mois'), m.getAttribute('data-reste')]), verse: f.querySelectorAll('[data-verse-ouvrir]').length, annulees: !!f.querySelector('[data-annulees]') };
        });
        dit(fiche.inscrits === '31' && fiche.payants === '23', 'la bande : 31 inscrits · 23 clients payants', JSON.stringify(fiche));
        dit(fiche.lien === 'https://vrm.center/p/LEO', 'son lien vrm.center/p/LEO, à copier');
        dit(fiche.mois.length >= 2 && fiche.mois.some(([, r]) => r === '0') && fiche.mois.some(([, r]) => r === '6900'), 'mois par mois : le mois soldé (versé) et 69,00 € à verser', JSON.stringify(fiche.mois));
        dit(fiche.annulees, 'la commission annulée (remboursement) est dite');
        const avantVerse = appels.filter((a) => a.m === 'POST').length;
        dit(avantVerse === 0, 'ouvrir la fiche n’envoie rien');
        const mois69 = fiche.mois.find(([, r]) => r === '6900')[0];
        await pg.click(`[data-verse-ouvrir="${mois69}"]`);
        await pg.waitForSelector(`[data-verse-form="${mois69}"]`);
        dit(appels.filter((a) => a.m === 'POST').length === 0, '« Versé » ouvre la saisie (date, montant), rien n’est envoyé avant SON clic');
        const montant = await pg.inputValue(`[data-verse-form="${mois69}"] [data-champ="montant"]`);
        dit(montant === '69,00', 'le montant proposé est le reste du mois (69,00)', montant);
        await pg.screenshot({ path: path.join(CAPTURES, `reglages-${nom}.png`), fullPage: false });
        const R1 = await regles(pg, '[data-partenaires]');
        dit(R1.page && !R1.deborde.length, 'rien ne déborde de la page', JSON.stringify(R1.deborde));
        dit(!R1.formes.length, 'chaque bouton du programme est une des quatre formes', JSON.stringify(R1.formes));
        dit(R1.pleins === 0, 'aucun bouton « plein » dans le programme (UN par écran au plus : pas ici)');
        dit(R1.rouges === 0, 'aucun rouge (réservé aux doublons de N°)');
        if (largeur < 600) dit(!R1.cibles.length, 'cibles au doigt ≥ 40 px', JSON.stringify(R1.cibles));
        await pg.click(`[data-verse-form="${mois69}"] [data-verse-confirmer]`);
        await pg.waitForTimeout(400);
        const post = appels.filter((a) => a.m === 'POST').map((a) => JSON.parse(a.corps));
        dit(post.length === 1 && post[0].action === 'verse' && post[0].mois === mois69 && post[0].centimes === 6900 && /^\d{4}-\d{2}-\d{2}$/.test(post[0].le), 'son clic envoie « verse » : mois, 6900 centimes, la date', JSON.stringify(post));
        await pg.click('[data-partenaire-nouveau]');
        await pg.waitForSelector('[data-partenaire-form]');
        await pg.screenshot({ path: path.join(CAPTURES, `reglages-nouveau-${nom}.png`), fullPage: false });
        dit(erreurs.length === 0, 'aucune erreur JavaScript', erreurs.join(' | '));
        await ctx.close();
      });
    }
    console.log('\n── Un vendeur (pas propriétaire)');
    await essaie('vendeur', async () => {
      const { ctx, pg, appels } = await ouvrirReglages(nav, { largeur: 390, sombre: false, abo: ABO_VENDEUR, D });
      await pg.waitForTimeout(1500);
      const x = await pg.evaluate(() => ({ p: !!document.querySelector('[data-partenaires]'), parr: !!document.querySelector('[data-parrainage]') }));
      dit(!x.p && appels.length === 0, 'aucun groupe « Partenaires », aucune lecture de mode=partenaires', JSON.stringify(x));
      await ctx.close();
    });

    for (const largeur of [390, 1512]) for (const sombre of [false, true]) {
      const nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
      console.log(`\n── La page du partenaire · ${nom}`);
      await essaie('page ' + nom, async () => {
        const mobile = largeur < 600;
        const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', deviceScaleFactor: mobile ? 2 : 1 });
        const pg = await ctx.newPage();
        const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
        const appels = [];
        await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
        await pg.route('**/rest/v1/**', (r) => { appels.push('rest'); return r.fulfill({ status: 401, body: '' }); });
        await pg.route('**/api/**', (r) => { const u = r.request().url(); appels.push(u); if (/mode=partenaire&j=/.test(u) && u.includes(JETON)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(D.page) }); return r.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false,"raison":"lien"}' }); });
        await pg.goto(`http://localhost:${PORT}/?espace-partenaire=${JETON}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vue-partenaire="lu"]', { timeout: 20000 });
        await pg.waitForFunction(() => !document.getElementById('vrm-demarrage'), null, { timeout: 10000 }).catch(() => {});
        await pg.waitForTimeout(400);
        const theme = await pg.evaluate(() => document.documentElement.getAttribute('data-theme'));
        dit(theme === (sombre ? 'dark' : 'light'), 'la page suit le clair / sombre du téléphone du partenaire', theme);
        const v = await pg.evaluate(() => {
          const m = document.querySelector('[data-vue-partenaire]');
          return { txt: m.innerText, reste: m.querySelector('[data-chiffre="reste"]').getAttribute('data-centimes'), lignes: m.querySelectorAll('tbody tr').length, loi: (m.querySelector('[data-loi-influence]') || {}).textContent || '', app: !!document.querySelector('.vrm-app-shell') };
        });
        dit(/Bonjour Leo/.test(v.txt) && v.reste === String(D.leo.totaux.resteCentimes), 'ses chiffres : « Bonjour Leo », le reste à recevoir', v.reste);
        dit(v.lignes === D.leo.mois.length, 'le tableau mois par mois', String(v.lignes));
        dit(/«\s?Publicité\s?»/.test(v.loi) && /«\s?Collaboration commerciale\s?»/.test(v.loi), 'la phrase de la loi influenceurs (« Publicité » / « Collaboration commerciale »)', v.loi);
        dit(!/@/.test(v.txt) && !/99999999-/.test(v.txt), 'aucun e-mail, aucun identifiant de client');
        dit(!v.app && !appels.includes('rest') && appels.every((u) => /mode=partenaire&j=/.test(u)), "sans l'app ni session : une seule lecture, celle de la page", JSON.stringify(appels.slice(0, 3)));
        await pg.screenshot({ path: path.join(CAPTURES, `page-${nom}.png`), fullPage: true });
        const R2 = await regles(pg, '[data-vue-partenaire]');
        dit(R2.page && !R2.deborde.length, 'rien ne déborde de la page', JSON.stringify(R2.deborde));
        dit(!R2.formes.length && R2.pleins === 0 && R2.rouges === 0, 'quatre formes, aucun plein, aucun rouge', JSON.stringify(R2));
        dit(erreurs.length === 0, 'aucune erreur JavaScript', erreurs.join(' | '));
        await ctx.close();
      });
    }
    console.log('\n── Un lien mort');
    await essaie('lien mort', async () => {
      const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const pg = await ctx.newPage();
      await pg.route('**/api/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false,"raison":"lien"}' }));
      await pg.goto(`http://localhost:${PORT}/?espace-partenaire=${'z'.repeat(43)}`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-vue-partenaire="lien"]', { timeout: 20000 });
      dit(/n’est plus valable/.test(await pg.innerText('[data-vue-partenaire]')), '« Ce lien n’est plus valable »');
      await pg.screenshot({ path: path.join(CAPTURES, 'page-lien-mort.png') });
      await ctx.close();
    });
  } finally { await nav.close(); srv.close(); }
  console.log(`\nCaptures : ${CAPTURES}\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
