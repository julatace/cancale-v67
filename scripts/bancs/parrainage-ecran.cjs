require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « L'ÉCRAN PARRAINAGE » (25 nov. 2026 — Julien : « Tu dois faire un vrai interface »)
//  RENDU, avec un faux serveur (aucun Stripe, aucune base réelle, tout inventé ici) :
//    E1 parrain, mode crédit : le héros (gagné au total, ce mois, 12 barres), le lien,
//       Partager (partage natif, ou copie), Copier (presse-papiers = LE lien), le QR
//       (dessiné ici), les 3 étapes, 4 tuiles, l'historique par mois SANS identité ;
//    E2 le choix : « Virement » ⇒ POST { action:'choix', mode:'virement' } ; l'IBAN
//       saisi dans une feuille, refus DIT, puis rendu MASQUÉ ; jamais en clair ;
//    E3 aucun filleul : l'état vide et le bouton Partager ;
//    E4 programme fermé : « Bientôt disponible » ; E5 lecture : squelette ; E6 panne : « — » + raison ;
//    E7 filleul : « Offert par Marc : −10 % … » sur l'écran, et la remise AVANT de payer ;
//    E8 Julien : « Parrains à verser » (total, IBAN, « Versé » confirmé ⇒ POST verse-parrain) ;
//    E9 le lien ouvert sans session : « Offert par Julie », « −10 % … 1 semaine offerte ».
//  390 px tactile (clair ET sombre) et 1512 px ; rien ne déborde ; aucune erreur de page.
//  Captures : $BANC_CAPTURES (défaut : un dossier temporaire), chemins écrits à la fin.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 24377;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-parrainage-ecran');
fs.mkdirSync(CAPTURES, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
const UID = '11111111-2222-3333-4444-555555555555';
const SESSION_BANC = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: UID, email: 'vendeuse@exemple.test' } };
const CODE = 'K7MQ4RZP', LIEN = 'https://vrm.center/r/' + CODE;
const ABO = { ok: true, proprietaire: false, configure: true, modeTest: true, obligatoire: true, prix: { montant: 16.99, devise: 'eur', intervalle: 'month' }, prixConforme: true, statut: 'active', finPeriode: new Date(Date.now() + 20 * 864e5).toISOString(), annuleFinPeriode: false, peutGerer: true, actif: true, acces: true, lecture: true, lectureSeule: false, mentionsCompletes: true, essaiDispo: false, essaiJours: 7, prixAbonnement: { montant: 16.99, devise: 'eur', intervalle: 'month', texte: '16,99 € / mois' } };
const REGLE = { pourcent: 20, remise: 10, joursOfferts: 7, seuilCentimes: 2000, delaiJours: 14 };
const mois = (k) => { const d = new Date(); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 15)); return t.toISOString().slice(0, 7); };
const PAR_MOIS = Array.from({ length: 12 }, (_, i) => { const k = 11 - i; const c = [0, 0, 0, 0, 0, 0, 339, 339, 678, 1017, 1356, 877][i]; return { mois: mois(k), centimes: c, n: Math.round(c / 339) }; });
const HISTO = [
  { filleul: 1, mois: mois(0), payeLe: mois(0) + '-03', dueLe: mois(0) + '-17', centimes: 399, brutCentimes: 399, reduit: false, etat: 'credite' },
  { filleul: 2, mois: mois(0), payeLe: mois(0) + '-08', dueLe: mois(0) + '-22', centimes: 339, brutCentimes: 339, reduit: false, etat: 'attente' },
  { filleul: 3, mois: mois(0), payeLe: mois(0) + '-10', dueLe: mois(0) + '-24', centimes: 139, brutCentimes: 339, reduit: true, etat: 'attente' },
  { filleul: 1, mois: mois(1), payeLe: mois(1) + '-03', dueLe: mois(1) + '-17', centimes: 399, brutCentimes: 399, reduit: false, etat: 'credite' },
  { filleul: 2, mois: mois(1), payeLe: mois(1) + '-08', dueLe: mois(1) + '-22', centimes: 339, brutCentimes: 339, reduit: false, etat: 'credite' },
];
const CHIFFRES = { filleulsPayants: 3, filleulsAyantPaye: 4, moisCentimes: 877, totalCentimes: 5145, attenteCentimes: 478, crediteCentimes: 4667, aCrediterCentimes: 0, verseCentimes: 0, aVerserCentimes: 0, tropVerseCentimes: 0, seuilCentimes: 2000, virementPret: false, parMois: PAR_MOIS, historique: HISTO };
const PARRAIN = {
  ok: true, installe: true, ouvert: true, code: CODE, modeTest: false, moisCentimes: 1699, semaineCentimes: 396, regle: REGLE, nom: 'Julie',
  suivi: { inscrits: 4, payes: 3, moisOfferts: 1, enAttente: 0 },
  filleuls: [{ rang: 1, inscritLe: '2026-10-02', etat: 'offert' }, { rang: 2, inscritLe: '2026-10-09', etat: 'paye' }, { rang: 3, inscritLe: '2026-11-02', etat: 'paye' }, { rang: 4, inscritLe: '2026-11-20', etat: 'inscrit' }],
  filleul: null, gains: { installe: true, mode: 'credit', iban: null, chiffres: CHIFFRES },
};
const VIDE = { ...PARRAIN, nom: null, suivi: { inscrits: 0, payes: 0, moisOfferts: 0, enAttente: 0 }, filleuls: [], gains: { installe: true, mode: 'credit', iban: null, chiffres: { ...CHIFFRES, filleulsPayants: 0, filleulsAyantPaye: 0, moisCentimes: 0, totalCentimes: 0, attenteCentimes: 0, crediteCentimes: 0, parMois: PAR_MOIS.map((x) => ({ ...x, centimes: 0, n: 0 })), historique: [] } } };
const FILLEUL = { ...VIDE, filleul: { parraine: true, moisOffert: false, paye: false, offertPar: 'Marc', attendVinted: false } };
const ADMIN = { ok: true, installe: true, totalCentimes: 4268, seuilCentimes: 2000, parrains: [
  { parrain: 'aaaaaaaa-0000-4000-8000-000000000001', centimes: 2034, pret: true, depuis: '2026-10-31', gains: 6, email: 'camille@exemple.test', nom: 'Camille', iban: 'FR7630006000011234567890189', titulaire: 'Camille Martin' },
  { parrain: 'aaaaaaaa-0000-4000-8000-000000000002', centimes: 2234, pret: true, depuis: '2026-11-04', gains: 7, email: 'leo@exemple.test', nom: null, iban: null, titulaire: null },
  { parrain: 'aaaaaaaa-0000-4000-8000-000000000003', centimes: 678, pret: false, depuis: '2026-11-12', gains: 2, email: 'sam@exemple.test', nom: 'Sam', iban: null, titulaire: null },
] };

let ko = 0, ok = 0;
const captures = [];
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + String(d).slice(0, 220) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 200)); } };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
// `plein` : tout l'écran (la fenêtre s'allonge le temps de la capture : l'écran défile dans la coque, pas dans la page).
const capture = async (pg, nom, plein = true) => {
  const f = path.join(CAPTURES, nom + '.png');
  const v = pg.viewportSize();
  if (plein) { const h = await pg.evaluate(() => { const e = document.querySelector('.vrm-pr') || document.body; return Math.ceil(e.scrollHeight + 360); }).catch(() => 0); if (h > v.height) { await pg.setViewportSize({ width: v.width, height: Math.min(h, 4200) }); await pg.waitForTimeout(400); } }
  await pg.screenshot({ path: f }).catch(() => {});
  if (plein) await pg.setViewportSize(v);
  captures.push(f);
};

async function ouvrir(nav, { chemin = '/?tab=parrainage', largeur = 390, sombre = false, session = true, parrain = PARRAIN, abo = ABO, panne = false, tenir = false, partage = true, apercu = { ok: true, ouvert: true, connu: true, nom: 'Julie' } }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://localhost:${PORT}` }).catch(() => {});
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(({ s, sombre, session, partage }) => {
    try {
      localStorage.setItem('vinted_dark', sombre ? 'true' : 'false');
      if (session) {
        localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now()));
        localStorage.setItem('vrm_configuration', JSON.stringify({ etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 }));
        const t = new Date().toISOString(); localStorage.setItem('vrm_parcours_plus_tard', JSON.stringify({ extension: t, emails: t, vinted: t, premiere: t, configuration: t }));
        localStorage.setItem('vrm_nouveautes_vues', JSON.stringify({ vues: {} }));
      }
    } catch (_) {}
    window.__partages = [];
    try {
      if (partage) Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: function (d) { window.__partages.push(d); return Promise.resolve(); } });
      else Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined });
    } catch (_) {}
    window.open = (u) => { (window.__ouverts = window.__ouverts || []).push(String(u)); return null; };
  }, { s: SESSION_BANC, sombre, session, partage });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue());
  await pg.route('**/auth/v1/**', (r) => {
    const u = r.request().url();
    if (/\/auth\/v1\/settings/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { email: true }, disable_signup: false }) });
    if (!session) return r.fulfill({ status: 401, contentType: 'application/json', body: '{"msg":"pas de session"}' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION_BANC.user }) });
  });
  await pg.route('**/rest/v1/**', (r) => {
    const m = r.request().method();
    if (m !== 'GET' && !/\/rpc\//.test(r.request().url())) return r.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: '[]' });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  let etat = JSON.parse(JSON.stringify(parrain));
  let liberer = null; const tenue = tenir ? new Promise((res) => { liberer = res; }) : null;
  await pg.route('**/api/**', async (r) => {
    const u = r.request().url(), m = r.request().method(), corps = r.request().postData() || '';
    const json = (o, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) });
    if (/mode=abonnement/.test(u)) return json(abo);
    if (/mode=factures/.test(u)) return json({ ok: true, carte: null, factures: [] });
    if (/mode=partenaires/.test(u)) {
      appels.push({ m, u, corps });
      if (/vue=parrains/.test(u)) return json(ADMIN);
      if (m === 'POST') return json({ ok: true });
      return json({ ok: true, installe: true, partenaires: [], commissionCentimes: 300, delaiJours: 14, stripe: true, au: new Date().toISOString() });
    }
    if (/mode=parrainage/.test(u)) {
      appels.push({ m, u, corps });
      if (m === 'GET' && /[?&]code=/.test(u)) return json(apercu);
      if (m === 'POST') {
        let b = {}; try { b = JSON.parse(corps); } catch (_) {}
        if (b.action === 'choix') { etat.gains.mode = b.mode; return json({ ok: true, mode: b.mode }); }
        if (b.action === 'iban') {
          if (!/^FR76\s?3000/.test(b.iban || '') || /188$/.test(String(b.iban).replace(/\s/g, ''))) return json({ ok: false, raison: 'iban', message: 'IBAN incomplet ou faux.' }, 400);
          etat.gains.iban = 'FR76 •••• 0189'; return json({ ok: true, iban: 'FR76 •••• 0189' });
        }
        if (b.action === 'nom') { etat.nom = b.nom || null; return json({ ok: true, nom: etat.nom }); }
        return json({ ok: false }, 400);
      }
      if (tenue) await tenue;
      if (panne) return json({ ok: false }, 503);
      return json(etat);
    }
    return json({ ok: true });
  });
  await pg.goto(`http://localhost:${PORT}${chemin}`, { waitUntil: 'domcontentloaded' });
  if (!tenir) await pg.waitForTimeout(3000);
  return { ctx, pg, erreurs, appels, liberer };
}
const attendre = (pg, sel, ms = 15000) => pg.waitForSelector(sel, { timeout: ms }).then(() => true, () => false);
const deborde = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ pas de dist/ (npm run build)'); process.exit(1); }
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    console.log('\n── E1 le parrain (mode crédit)');
    for (const [largeur, sombre] of [[390, false], [390, true], [1512, false]]) {
      await essaie(`écran ${largeur}${sombre ? ' sombre' : ''}`, async () => {
        const { ctx, pg, erreurs, appels } = await ouvrir(nav, { largeur, sombre });
        const vu = await attendre(pg, '[data-parrainage="ouvert"]');
        const r = await pg.evaluate(() => {
          const g = document.querySelector('[data-parrainage="ouvert"]'); if (!g) return null;
          const t = (s) => { const e = g.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; };
          return { heros: t('[data-parrainage-heros]'), lien: t('[data-lien-parrainage]'), barres: g.querySelectorAll('[data-n-barre]').length,
            etapes: g.querySelectorAll('.vrm-pr-etape').length, tuiles: [...g.querySelectorAll('[data-tuile]')].map((x) => x.getAttribute('data-tuile')),
            gains: [...g.querySelectorAll('[data-gain]')].map((x) => x.getAttribute('data-gain')), histo: t('.vrm-pr-historique'), texte: g.innerText,
            ronds: [...g.querySelectorAll('.n-action-ronde')].map((b) => Math.round(b.getBoundingClientRect().height)), choix: g.getAttribute('data-mode') };
        });
        dit(vu && r && /51,45/.test(r.heros) && /8,77/.test(r.heros), `${largeur} px : héros « 51,45 € » au total, « ce mois : 8,77 € »`, r && r.heros);
        dit(r && r.barres === 12, '  12 barres (un an), le mois en cours choisi', r && r.barres);
        dit(r && r.lien === 'vrm.center/r/' + CODE, '  le lien en grand', r && r.lien);
        dit(r && r.etapes === 3 && /Filleul 1/.test(r.histo) && r.gains.length === 5, '  3 étapes, l’historique par mois (« Filleul 1 »)', r && r.gains.join(','));
        dit(r && r.tuiles.join(',') === 'payants,mois,attente,credite', '  4 tuiles : payants · ce mois · en attente · crédité', r && r.tuiles.join(','));
        dit(r && !/@|[0-9a-f]{8}-[0-9a-f]{4}-/.test(r.texte), '  aucune adresse ni identifiant de filleul');
        dit(r && r.ronds.every((h) => h >= 44), '  WhatsApp, Messages, Copier, QR : cibles ≥ 44 px', r && r.ronds.join(','));
        dit((await deborde(pg)) <= 0, '  rien ne déborde');
        dit(appels.every((a) => a.m === 'GET'), '  ouvrir l’écran n’écrit rien');
        await capture(pg, `parrain-${largeur}${sombre ? '-sombre' : '-clair'}`);
        if (largeur === 390 && !sombre) {
          await pg.click('[data-copier-parrainage]'); await pg.waitForTimeout(300);
          const presse = await pg.evaluate(() => navigator.clipboard.readText().catch(() => null));
          dit(presse === LIEN, '  Copier : le presse-papiers reçoit LE lien', presse);
          await pg.click('.n-page-plein [data-partager-parrainage], [data-partager-parrainage]'); await pg.waitForTimeout(200);
          const p = await pg.evaluate(() => window.__partages);
          dit(p.length === 1 && p[0].url === LIEN && /−10 %/.test(p[0].text || ''), '  Partager : le partage natif, avec le lien et « −10 % »', JSON.stringify(p));
          await pg.click('[data-partager-whatsapp]'); await pg.waitForTimeout(100);
          const o = await pg.evaluate(() => window.__ouverts || []);
          dit(o.length === 1 && /^https:\/\/wa\.me\/\?text=/.test(o[0]) && o[0].includes(encodeURIComponent(LIEN)), '  WhatsApp : wa.me avec le texte et le lien', o[0]);
          await pg.click('[data-parrainage-qr-ouvrir]');
          const qr = await attendre(pg, '[data-parrainage-qr] path', 4000);
          dit(qr, '  QR code dessiné ici (aucun service externe)');
          await capture(pg, 'parrain-qr-390-clair', false);
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        }
        dit(!erreurs.length, '  aucune erreur de page', erreurs.join(' | '));
        await ctx.close();
      });
    }

    console.log('\n── E2 le choix : virement, IBAN masqué');
    for (const sombre of [false, true]) {
      await essaie('virement ' + (sombre ? 'sombre' : 'clair'), async () => {
        const { ctx, pg, appels, erreurs } = await ouvrir(nav, { sombre });
        await attendre(pg, '[data-choix="virement"]');
        await pg.click('[data-choix="virement"]'); await pg.waitForTimeout(500);
        const post = appels.filter((a) => a.m === 'POST').map((a) => JSON.parse(a.corps));
        dit(post.length === 1 && post[0].action === 'choix' && post[0].mode === 'virement' && !('owner' in post[0]), 'un toucher « Virement » ⇒ POST { action:choix, mode:virement }', JSON.stringify(post));
        const v = await pg.evaluate(() => ({ mode: document.querySelector('[data-parrainage-choix]') && document.querySelector('[data-parrainage-choix]').getAttribute('data-parrainage-choix'), tuile: !!document.querySelector('[data-tuile="verse"]'), iban: !!document.querySelector('[data-parrainage-iban]') }));
        dit(v.mode === 'virement' && v.tuile && v.iban, '  la carte passe en virement : seuil, prêt, IBAN ; la tuile « Versé »', JSON.stringify(v));
        await pg.click('[data-parrainage-iban]');
        await attendre(pg, '[data-parrainage-iban-form] input', 4000);
        const champs = await pg.$$('[data-parrainage-iban-form] input');
        await champs[0].fill('FR76 3000 6000 0112 3456 7890 188'); await champs[1].fill('Julie Martin');
        await pg.click('[data-parrainage-iban-enregistrer]');
        const refus = await attendre(pg, '[data-parrainage-iban-refus]', 4000);
        dit(refus && /IBAN/.test(await pg.innerText('[data-parrainage-iban-refus]')), '  un IBAN faux : refusé, la raison DITE');
        if (!sombre) await capture(pg, 'parrain-iban-refus-390-clair', false);
        await champs[0].fill('FR76 3000 6000 0112 3456 7890 189');
        await pg.click('[data-parrainage-iban-enregistrer]'); await pg.waitForTimeout(700);
        const ib = await pg.evaluate(() => { const e = document.querySelector('[data-parrainage-iban]'); return e && e.getAttribute('data-parrainage-iban'); });
        const txt = await pg.evaluate(() => document.body.innerText);
        dit(ib === 'FR76 •••• 0189' && !/30006000011234567890/.test(txt), '  enregistré : affiché « FR76 •••• 0189 », jamais en clair', ib);
        dit((await deborde(pg)) <= 0 && !erreurs.length, '  rien ne déborde, aucune erreur', erreurs.join('|'));
        await capture(pg, `parrain-virement-390-${sombre ? 'sombre' : 'clair'}`);
        await ctx.close();
      });
    }

    console.log('\n── E3 à E6 : vide, fermé, lecture, panne');
    for (const sombre of [false, true]) {
      const s = sombre ? 'sombre' : 'clair';
      await essaie('vide ' + s, async () => {
        const { ctx, pg } = await ouvrir(nav, { sombre, parrain: VIDE });
        await attendre(pg, '[data-parrainage="ouvert"]');
        const r = await pg.evaluate(() => ({ vide: !!document.querySelector('.vrm-pr .n-vide'), partager: document.querySelectorAll('[data-partager-parrainage]').length }));
        dit(r.vide && r.partager === 1, `aucun filleul (${s}) : l’état vide et UN bouton Partager`, JSON.stringify(r));
        await capture(pg, `parrain-vide-390-${s}`);
        await ctx.close();
      });
      await essaie('fermé ' + s, async () => {
        const { ctx, pg } = await ouvrir(nav, { sombre, parrain: { ...PARRAIN, ouvert: false } });
        const vu = await attendre(pg, '[data-parrainage="ferme"]');
        const t = vu ? await pg.innerText('[data-parrainage="ferme"]') : '';
        dit(vu && /Bientôt disponible/.test(t) && !/vrm_reglages/.test(t), `fermé (${s}) : « Bientôt disponible », aucun réglage technique montré au vendeur`, t.slice(0, 80));
        await capture(pg, `parrain-ferme-390-${s}`);
        await ctx.close();
      });
      await essaie('lecture ' + s, async () => {
        const { ctx, pg, liberer } = await ouvrir(nav, { sombre, tenir: true });
        const sq = await attendre(pg, '[data-parrainage="lecture"]');
        dit(sq, `lecture (${s}) : le squelette, à la forme de l’écran (requête TENUE)`);
        await capture(pg, `parrain-lecture-390-${s}`, false);
        liberer(); const fini = await attendre(pg, '[data-parrainage="ouvert"]');
        dit(fini, '  puis l’écran');
        await ctx.close();
      });
      await essaie('panne ' + s, async () => {
        const { ctx, pg } = await ouvrir(nav, { sombre, panne: true });
        const vu = await attendre(pg, '[data-parrainage="pas-su"]');
        const t = vu ? await pg.innerText('[data-parrainage="pas-su"]') : '';
        dit(vu && /pas lu/.test(t) && /Réessayer/.test(t), `panne (${s}) : « Parrainage pas lu », la raison, « Réessayer » — jamais 0`, t.replace(/\s+/g, ' '));
        await capture(pg, `parrain-panne-390-${s}`, false);
        await ctx.close();
      });
    }

    console.log('\n── E7 le filleul');
    for (const sombre of [false, true]) {
      const s = sombre ? 'sombre' : 'clair';
      await essaie('filleul ' + s, async () => {
        const { ctx, pg } = await ouvrir(nav, { sombre, parrain: FILLEUL });
        await attendre(pg, '[data-parraine]');
        const t = (await pg.innerText('[data-parraine]')).replace(/\s+/g, ' ');
        dit(/Offert par Marc/.test(t) && /−10 % sur ton 1er mois \+ 1 semaine offerte/.test(t), `écran (${s}) : « Offert par Marc : −10 % sur ton 1er mois + 1 semaine offerte »`, t);
        await capture(pg, `filleul-ecran-390-${s}`);
        await ctx.close();
      });
      await essaie('filleul paiement ' + s, async () => {
        const abo = { ...ABO, statut: null, actif: false, essaiDispo: true, finPeriode: null };
        const { ctx, pg } = await ouvrir(nav, { sombre, parrain: FILLEUL, abo, chemin: '/?tab=settings&vue=abonnement' });
        const vu = await attendre(pg, '[data-parrainage-remise]', 15000);
        await pg.locator('[data-parrainage-remise]').scrollIntoViewIfNeeded().catch(() => {});
        const t = vu ? (await pg.innerText('[data-parrainage-remise]')).replace(/\s+/g, ' ') : '';
        const avant = await pg.evaluate(() => { const a = document.querySelector('[data-parrainage-remise]'), b = document.querySelector('[data-sabonner]'); return !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); });
        dit(vu && /−10 %/.test(t) && avant, `paiement (${s}) : la remise est visible AVANT « S’abonner »`, t);
        await capture(pg, `filleul-paiement-390-${s}`, false);
        await ctx.close();
      });
    }

    console.log('\n── E8 Julien : « Parrains à verser »');
    for (const [largeur, sombre] of [[390, false], [390, true], [1512, false]]) {
      await essaie('admin ' + largeur + (sombre ? ' sombre' : ''), async () => {
        const { ctx, pg, appels, erreurs } = await ouvrir(nav, { largeur, sombre, abo: { ...ABO, proprietaire: true } });
        const vu = await attendre(pg, '[data-parrains-verser]');
        await pg.locator('[data-parrains-verser]').scrollIntoViewIfNeeded().catch(() => {});
        const r = await pg.evaluate(() => { const g = document.querySelector('[data-parrains-verser]'); return g && { total: g.getAttribute('data-total-centimes'), pret: g.querySelectorAll('[data-parrain-verser="pret"]').length, sous: g.querySelectorAll('[data-parrain-verser="sous-seuil"]').length, iban: (g.querySelector('[data-parrain-iban]') || { getAttribute: () => null }).getAttribute('data-parrain-iban'), boutons: g.querySelectorAll('[data-parrain-verse]').length, texte: g.innerText }; });
        dit(vu && r && r.total === '4268' && /42,68/.test(r.texte) && r.pret === 2 && r.sous === 1, `${largeur} px : total « 42,68 € à verser », 2 prêts, 1 sous le seuil`, JSON.stringify(r && { t: r.total, p: r.pret, s: r.sous }));
        dit(r && r.iban === 'FR7630006000011234567890189' && r.boutons === 2, '  Julien lit l’IBAN en clair (pour verser) ; « Versé » sur les seuls prêts');
        await capture(pg, `admin-${largeur}-${sombre ? 'sombre' : 'clair'}`);
        if (largeur === 390 && !sombre) {
          await pg.click('[data-parrain-verse]'); await pg.waitForTimeout(200);
          const conf = await attendre(pg, '[data-parrain-verse-confirmer]', 3000);
          dit(conf && !appels.some((a) => a.m === 'POST'), '  « Versé » DEMANDE d’abord (rien n’est noté au 1er toucher)');
          await pg.click('[data-parrain-verse-confirmer]'); await pg.waitForTimeout(500);
          const post = appels.filter((a) => a.m === 'POST' && /partenaires/.test(a.u)).map((a) => JSON.parse(a.corps));
          dit(post.length === 1 && post[0].action === 'verse-parrain' && post[0].centimes === 2034 && /^\d{4}-\d{2}-\d{2}$/.test(post[0].le), '  confirmé ⇒ POST verse-parrain (20,34 €, daté du jour)', JSON.stringify(post));
        }
        dit(!erreurs.length && (await deborde(pg)) <= 0, '  aucune erreur, rien ne déborde', erreurs.join('|'));
        await ctx.close();
      });
    }

    console.log('\n── E9 le lien ouvert sans session');
    await essaie('lien', async () => {
      const { ctx, pg } = await ouvrir(nav, { session: false, chemin: `/r/${CODE}`, sombre: true });
      const vu = await attendre(pg, '[data-parrain-offert]');
      const t = vu ? (await pg.innerText('[data-parrain-offert]')).replace(/\s+/g, ' ') : '';
      dit(vu && /Offert par Julie/.test(t) && /−10 %/.test(t) && /1 semaine offerte/.test(t), '« Offert par Julie » : −10 % et 1 semaine offerte', t);
      await capture(pg, 'filleul-lien-390-sombre', false);
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 160)); }
  finally {
    await nav.close(); srv.close();
    console.log('\n  captures :'); for (const c of captures) console.log('   ' + c);
    console.log(`\n${ko ? '❌' : '✅'} banc parrainage-ecran : ${ok} verts, ${ko} rouge(s)`);
    process.exit(ko ? 1 : 0);
  }
})();
