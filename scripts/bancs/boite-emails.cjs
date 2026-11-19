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
//  (5 nov., soir — « ça doit être bcp plus clair ») Juge en plus les RÈGLES de
//  clarté : la feuille de lecture du téléphone est OPAQUE dès sa première image
//  (opacité 1 à chaque échantillon, fond sans transparence, aucun point de la
//  liste au-dessus d'elle) ; chaque ligne commence par CE QUE C'EST en mots
//  simples (tiré du résumé rangé, jamais le sujet brut) puis l'expéditeur avec
//  son logo, le compte, l'heure ; les e-mails groupés par jour (Aujourd’hui,
//  Hier, date) ; aucune balise affichée en texte dans le message ; la lecture
//  met en haut ce que c'est et le bouton de l'action, « De / Reçu sur / date »
//  sur une ligne discrète à la fin ; les rubriques au doigt avec leur nombre,
//  qui défilent ; les libellés techniques retirés.
//  (5 nov., nuit — « tu peux faire mieux », v33) Juge en plus : la MARQUE de
//  l'expéditeur à gauche (logo des sites, monogramme neutre « MR » sinon), la
//  nature en un mot fort avec l'heure alignée à droite, l'ESSENTIEL sur une
//  ligne (faits courts d'abord, le code jamais mangé par la coupure), le GESTE
//  marqué `data-boite-geste` (ambre seulement s'il est proche ou à vérifier), les
//  e-mails « rien à faire » atténués, AUCUN libellé coupé (pastilles, titres,
//  gestes ; ce qui dépasse de la rangée est sous un fondu de bord), le menu des
//  comptes sans adresse technique, « Actualiser » seulement quand la liste a
//  plus d'une minute, les ÉTATS (chargement tenu, vide, compte sans e-mail,
//  panne « — » + raison) avec LEUR geste, la feuille de lecture à barre
//  collante et marges de 16 px, le bouton principal pleine largeur au doigt, la
//  ligne qui répond à l'appui.
//  Horloge FIXÉE (5 nov. 2026, 16 h 05 à Paris) : les jours ne dépendent pas de
//  l'heure où le banc tourne.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 7967);
const CAPT = process.env.CAPTURE_DIR || path.join(os.tmpdir(), 'banc-boite-emails');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const MAINTENANT = Date.UTC(2026, 10, 5, 15, 5);
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Math.max(Date.now(), MAINTENANT) + 24 * 3600e3, user: { id: '22222222-2222-2222-2222-222222222222', email: 'vendeuse@exemple.test' } };
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 240)); } };

const H = (min) => new Date(Date.UTC(2026, 10, 5, 15, 0) - min * 60000).toISOString();
const id = (i) => 'email_reception_' + String(i).padStart(4, '0') + 'd'.repeat(60);
const E = [
  { id: id(1), at: H(2), etat: 'integre', type: 'suivi', subject: 'Votre colis 12345678 est disponible', from: 'Mondial Relay <noreply@mondialrelay.fr>', resume: { v: 1, t: 'suivi', tr: 'mondialrelay', s: '12345678', st: 'available', code: '418205', lieu: 'Relais Tabac du Port', lim: '09/11/2026' }, pj: 0 },
  { id: id(2), at: H(8), etat: 'integre', type: 'bordereau', subject: "Bordereau d'envoi pour Nike Air Max 90", from: "L'équipe Vinted <no-reply@vinted.fr>", resume: { v: 1, t: 'bordereau', tx: '12345678901', n: '42', pdf: 1, a: 'Nike Air Max 90' }, pj: 1 },
  { id: id(27), at: H(15), etat: 'integre', type: 'vente-vestiaire', subject: 'Votre article a été vendu', from: 'Vestiaire Collective <no-reply@vestiairecollective.com>', resume: { v: 1, t: 'vente-vestiaire', a: 'Jordan 1 Mid', mt: '82,40', lim: '2026-11-06' }, pj: 0 },
  { id: id(3), at: H(30), etat: 'integre', type: 'vente', subject: 'Ton article est vendu !', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'vente', a: 'Adidas Samba', px: '55', n: '17' }, pj: 0 },
  { id: id(4), at: H(55), etat: 'integre', type: 'achat', subject: 'Ton reçu pour la commande « Nike Air Force 1 »', from: 'Vinted <no-reply@vinted.fr>', resume: { v: 1, t: 'achat', tx: '98765432101', a: 'Nike Air Force 1', px: '45,00', id: 'email_achat_banc', pdf: 1 }, pj: 1 },
  { id: id(5), at: H(80), etat: 'integre', type: 'connu-sans-action', subject: 'Les nouveautés de la semaine', from: 'Vinted <news@team.vinted.fr>', resume: { v: 1, t: 'connu-sans-action', f: 'newsletter Vinted' }, pj: 0 },
  { id: id(6), at: H(1100), etat: 'a-verifier', type: 'ignoré', subject: 'Une forme jamais vue', from: 'contact@exemple.test', resume: { v: 1, t: 'incompris', av: 'incompris' }, pj: 0 },
  { id: id(7), at: H(3000), etat: 'integre', type: 'bordereau', subject: "Bordereau d'envoi pour Vans Old Skool", from: 'no-reply@vinted.fr', resume: null, pj: null },
];
for (let i = 8; i <= 26; i++) E.push({ id: id(i), at: H(3000 + i * 40), etat: 'integre', type: i % 2 ? 'offre' : 'suivi', subject: i % 2 ? `Nouvelle offre ${i}` : `Votre colis ${i} est en route`, from: i % 2 ? 'Vinted <no-reply@vinted.fr>' : 'Chronopost <suivi@chronopost.fr>', resume: i % 2 ? { v: 1, t: 'offre', mt: '30' } : { v: 1, t: 'suivi', s: 'CH' + i, st: 'transit' }, pj: 0 });
E.forEach((e, i) => { e.adresses = [i % 3 === 2 ? 'second@exemple.test' : 'vendeuse@exemple.test']; e.compte = { id: String(i % 3 === 2 ? 2 : 1), nom: i % 3 === 2 ? 'compte-deux' : 'compte-un' }; e.compteAmbigu = false; e.sourceDate = null; });
const RUB = (e) => (e.type === 'suivi' && e.resume && e.resume.code ? 'codes' : ['vente', 'finalisation', 'vente-vestiaire'].includes(e.type) ? 'ventes' : e.type === 'achat' ? 'achats' : ['suivi', 'bordereau'].includes(e.type) ? 'colis' : e.type === 'offre' ? 'offres' : 'autres');   // (6 nov., v36) + « Offres »
const dans = (e, r) => !r || (r === 'colis' ? ['colis', 'codes'].includes(RUB(e)) : RUB(e) === r);
const parRubrique = { ventes: 0, achats: 0, codes: 0, colis: 0, offres: 0, autres: 0 }; E.forEach((e) => { const r = RUB(e); parRubrique[r]++; if (r === 'codes') parRubrique.colis++; });
const COMPTEURS = { sur: E.length, plus: false, integre: 25, aVerifier: 1, erreur: 0, incompris: 1, parRubrique };
// (revue du 5 nov.) La route compte sur l'adresse choisie et le dit (`adresse`).
const compteursDe = (adr) => { if (!adr) return COMPTEURS; const l = E.filter((e) => e.adresses.includes(adr)); const pr = { ventes: 0, achats: 0, codes: 0, colis: 0, offres: 0, autres: 0 }; l.forEach((e) => { const r = RUB(e); pr[r]++; if (r === 'codes') pr.colis++; }); return { ...COMPTEURS, sur: l.length, parRubrique: pr, adresse: adr }; };
const TEXTE = {
  [id(1)]: 'Bonjour,​\n\n\n\nVotre colis est disponible au Relais Tabac du Port.\nCode de retrait : 418205\nSuivre : https://suivi.exemple.test/' + 'x'.repeat(120) + '\n<img src=x onerror="window.__xss=1"><b>gras</b> &amp; &lt;img src=y onerror="window.__xss=2"&gt;fin<div style="color:red',
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

const ADRESSES = [{ adresse: 'vendeuse@exemple.test', nom: 'compte-un' }, { adresse: 'second@exemple.test', nom: 'compte-deux' }, { adresse: 'troisieme@exemple.test', nom: 'compte-trois' }];
async function ouvrir(nav, { viewport, tactile, sombre, reduit, liste }) {
  const ctx = await nav.newContext({ viewport, hasTouch: tactile, isMobile: tactile, reducedMotion: reduit ? 'reduce' : 'no-preference', colorScheme: sombre ? 'dark' : 'light', timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(10000);
  await pg.clock.setFixedTime(MAINTENANT);
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(([s, sombre]) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_bienvenue_vue', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); localStorage.setItem('vrm_design_v2', '1'); localStorage.removeItem('vrm_banc_dom_ancien'); } catch (_) {} window.__aller = []; window.addEventListener('vrm:aller', (e) => window.__aller.push(e.detail)); window.__fiche = []; window.addEventListener('vrm:fiche-article', (e) => window.__fiche.push(e.detail)); }, [SESSION, sombre]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
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
      if (liste && !q.lire) { const rep = liste(q); if (rep) return rep.then ? rep.then((x) => r.fulfill(x)) : r.fulfill(rep); }
      if (q.lire) { const e = E.find((x) => x.id === q.lire); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: q.lire, email: e ? { ...e, receivedAt: e.at, pieces: e.pj === null ? null : (PIECES[e.id] || []), texte: TEXTE[e.id] || null, texteCoupe: TEXTE[e.id] ? TEXTE[e.id].length > 1500 && TEXTE[e.id].endsWith('…') : null } : null }) }); }
      let l = E.filter((e) => dans(e, q.boite || ''));
      if (q.adresse) l = l.filter((e) => e.adresses.includes(q.adresse));
      const p = Number(q.page || 0);
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: p, parPage: 20, suite: l.length > (p + 1) * 20, emails: l.slice(p * 20, p * 20 + 20), compteurs: compteursDe(q.adresse), adresses: ADRESSES }) });
    }
    if (u.searchParams.get('mode') === 'reception') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: [], adresses: [], collecteur: {}, limite: 100, plus: false }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=emails`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  return { ctx, pg, erreurs, appels };
}
const journal = (appels) => appels.filter((a) => a.chemin === '/api/email-rattacher' && a.q.mode === 'journal');

// (19 nov., lot emails-mail) Réécrit sur l'écran « comme Mail » (src/BoiteEmails.jsx, classes `n-mail-*`). Les règles
// du 5 et du 6 nov. restent jugées (rubriques envoyées à la route, compte, lecture sur le clic, corps en TEXTE, lien
// par IDENTITÉ, feuille opaque au téléphone, états dessinés, « Actualiser »), avec UNE règle remplacée, sur la demande
// de Julien du 19 nov. : la ligne porte l'expéditeur, le SUJET d'origine, ce que VRM a compris en une ligne et la date
// (la règle du 5 nov. « le sujet brut n'est sur aucune ligne » est retirée — récit : 2026-11-19-emails-mail.md).
(async () => {
  fs.mkdirSync(CAPT, { recursive: true });
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const sombre of [false, true]) for (const [viewport, tactile] of [[{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false]]) {
      const w = viewport.width, nom = `${w}-${sombre ? 'sombre' : 'clair'}`, large = w >= 1024;
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
        dit(await l1.getAttribute('data-rubrique') === 'codes' && /Mondial Relay/.test(await l1.innerText()), `${nom} : ligne — rubrique « codes », expéditeur lisible`, await l1.innerText());
        // La ligne (19 nov.) : expéditeur, sujet d'origine, ce que VRM a compris (une ligne), date.
        const L = await lignes.evaluateAll((l) => l.map((x) => ({ id: x.dataset.boiteEmail, de: (x.querySelector('[data-boite-de-ligne]') || {}).innerText || '', sujet: (x.querySelector('[data-boite-sujet-ligne]') || {}).innerText || '',
          quoi: (x.querySelector('[data-boite-quoi]') || { dataset: {} }).dataset.boiteQuoi || '', essentiel: ((x.querySelector('[data-boite-essentiel]') || {}).innerText || '').replace(/\s+/g, ' ').trim(), geste: x.dataset.boiteGeste || '',
          mot: ((x.querySelector('[data-boite-geste-mot]') || {}).innerText || '').replace(/\s+/g, ' ').trim(), heure: !!x.querySelector('time'), h: Math.round((x.querySelector('[data-boite-compris]') || { getBoundingClientRect: () => ({ height: 99 }) }).getBoundingClientRect().height) })));
        const sujetDe = Object.fromEntries(E.map((e) => [e.id, e.subject]));
        const mauvaises = L.filter((x) => !x.de || x.sujet !== sujetDe[x.id] || !x.quoi || !x.heure || x.h > 24);
        dit(L.length === 20 && !mauvaises.length, `${nom} : chaque ligne dit l'expéditeur, le SUJET d'origine, ce que VRM a compris sur UNE ligne, la date`, JSON.stringify(mauvaises.slice(0, 2)));
        const rid = Object.fromEntries(L.map((x) => [x.id, x]));
        const attendu = {
          [id(1)]: ['Colis à retirer', 'Relais Tabac du Port', 'retrait', 'avant le 9 nov.'],
          [id(2)]: ['Vendu', 'Nike Air Max 90', 'bordereau', 'bordereau prêt'],
          [id(27)]: ['Vendu sur Vestiaire', 'tu reçois 82,40 € · Jordan 1 Mid', 'envoi', 'à envoyer avant le 6 nov. (demain)'],
          [id(3)]: ['Vendu', '55 € · Adidas Samba', '', ''],
          [id(5)]: ['Newsletter Vinted', '', '', ''],
          [id(6)]: ['Pas reconnu par VRM', '', 'verifier', 'à vérifier'],
          [id(7)]: ['Vendu · bordereau', 'détail non gardé', '', ''],
        };
        const faux = Object.entries(attendu).filter(([k, [t, es, g, m]]) => { const x = rid[k]; return !x || x.quoi !== t || x.essentiel !== es || x.geste !== g || x.mot !== m; }).map(([k]) => rid[k] || k);
        dit(!faux.length, `${nom} : « compris » depuis ce que VRM a rangé — la nature, l'essentiel (le N° sur sa plaque), le geste à part ; rien d'inventé pour un e-mail ancien`, JSON.stringify(faux));
        const plaques = await lignes.evaluateAll((l) => l.filter((x) => x.dataset.v2Num).map((x) => x.dataset.v2Num + ':' + ((x.querySelector('[data-v2-etiquette]') || { dataset: {} }).dataset.v2Etiquette || '')));
        dit(plaques.includes('42:42') && plaques.includes('17:17'), `${nom} : le N° LU sur sa plaque (bordereau 42, vente 17)`, plaques.join(' '));
        // L'ambre seulement pour un délai à moins de 48 h ou « à vérifier » — jamais rouge.
        const coul = await lignes.evaluateAll((l) => l.map((x) => { const g = x.querySelector('[data-boite-geste-mot]'); return { id: x.dataset.boiteEmail, ambre: g ? g.dataset.ambre : '', c: g ? getComputedStyle(g).color : '' }; }));
        const ambres = coul.filter((x) => x.ambre === '1').map((x) => x.id).sort();
        dit(ambres.join() === [id(27), id(6)].sort().join() && !coul.some((x) => /rgb\(2[0-5]\d, [0-6]\d, [0-6]\d\)/.test(x.c)), `${nom} : l'ambre seulement pour un délai < 48 h ou « à vérifier », jamais rouge`, JSON.stringify(ambres));
        dit(!!(await l1.locator('xpath=..').locator('[data-boite-code-copier="418205"]').count()), `${nom} : le code de retrait LU, copiable d'un toucher, à côté de la ligne`);
        dit((await b.locator(`[data-boite-email="${id(2)}"] [data-boite-pj]`).count()) === 1, `${nom} : trombone des pièces jointes`);
        // Les jours : Aujourd'hui, Hier, puis la date.
        const jours = await b.locator('[data-boite-jour]').evaluateAll((l) => l.map((x) => x.dataset.boiteJour));
        dit(jours[0] === 'Aujourd’hui' && jours.includes('Hier'), `${nom} : groupées par jour (Aujourd’hui, Hier…)`, jours.join(' | '));
        // Sans sélection, la liste prend toute la place ; aucune colonne de lecture vide.
        const place = await pg.evaluate(() => { const e = document.querySelector('[data-boite-emails]'), c = e.querySelector('[data-boite-liste-col]'); const cs = getComputedStyle(e); return { part: c.getBoundingClientRect().width / (e.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)), vide: !!e.querySelector('[data-boite-vide-lecture], [data-boite-lecture-col]') }; });
        dit(place.part >= 0.92 && !place.vide, `${nom} : sans sélection, la liste prend toute la place`, JSON.stringify(place));
        // Les segments envoient la rubrique à la route ; « À traiter » = les « à vérifier ».
        const n0 = journal(appels).length;
        await b.locator('[data-boite-rubrique-v2="ventes"]').click();
        await pg.waitForTimeout(700);
        const qv = journal(appels).slice(n0).filter((a) => !a.q.lire).pop();
        const rubs = await lignes.evaluateAll((l) => [...new Set(l.map((x) => x.dataset.rubrique))]);
        dit(qv && qv.q.boite === 'ventes' && rubs.join() === 'ventes', `${nom} : « Ventes » envoyé à la route (boite=ventes), seules les ventes`, JSON.stringify({ q: qv && qv.q, rubs }));
        await b.locator('[data-boite-rubrique-v2="atraiter"]').click();
        await pg.waitForTimeout(700);
        const qa = journal(appels).filter((a) => !a.q.lire).pop();
        dit(qa && qa.q.etat === 'a-verifier' && !qa.q.boite, `${nom} : « À traiter » demande les e-mails à vérifier`, JSON.stringify(qa && qa.q));
        await b.locator('[data-boite-rubrique-v2="tout"]').click();
        await b.locator(`[data-boite-email="${id(1)}"]`).waitFor();
        // Le compte (adresse de réception) : au téléphone dans « ⋯ », à l'ordinateur dans la barre.
        if (large) {
          await b.locator('[data-boite-adresse]').selectOption('second@exemple.test');
          await pg.waitForTimeout(700);
          const qc = journal(appels).filter((a) => !a.q.lire).pop();
          dit(qc && qc.q.adresse === 'second@exemple.test', `${nom} : filtre par compte (adresse de réception) envoyé à la route`, JSON.stringify(qc && qc.q));
          await b.locator('[data-boite-adresse]').selectOption('');
          await b.locator(`[data-boite-email="${id(1)}"]`).waitFor();
        } else {
          await pg.locator('[data-v2-mail-plus]').click();
          const dansFeuille = await pg.locator('[data-v2-mail-compte-feuille] select').count();
          dit(dansFeuille === 1, `${nom} : le compte se choisit dans « ⋯ » au téléphone`);
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        }
        // La lecture : sur le clic, un e-mail à la fois ; sujet, expéditeur, date ; corps en TEXTE (aucune balise, aucun script).
        const nl = journal(appels).filter((a) => a.q.lire).length;
        await b.locator(`[data-boite-email="${id(1)}"]`).click();
        const lec = pg.locator(`[data-boite-lecture="${id(1)}"]`);
        await lec.locator('[data-boite-sujet]').waitFor();
        await pg.waitForTimeout(400);
        const lus = journal(appels).filter((a) => a.q.lire);
        dit(lus.length === nl + 1 && lus[lus.length - 1].q.lire === id(1), `${nom} : le corps se lit sur le clic, un e-mail à la fois`);
        const R = await lec.evaluate((n) => ({ sujet: (n.querySelector('[data-boite-sujet]') || {}).innerText || '', de: (n.querySelector('[data-boite-de]') || {}).innerText || '', recu: (n.querySelector('[data-boite-recu]') || {}).innerText || '',
          texte: (n.querySelector('[data-boite-corps]') || {}).innerText || '', balise: /<img|onerror|<b>|<div/.test((n.querySelector('[data-boite-corps]') || {}).innerText || ''), lien: [...n.querySelectorAll('[data-boite-lien]')].map((a) => a.getAttribute('rel') + '|' + a.getAttribute('target')),
          code: parseFloat(getComputedStyle(n.querySelector('[data-boite-code] [data-stream-type="code"]') || document.body).fontSize), objet: (n.querySelector('[data-boite-objet]') || { dataset: {} }).dataset.boiteObjet || '', ident: (n.querySelector('[data-boite-objet]') || { dataset: {} }).dataset.boiteIdent || '',
          avant: (() => { const h = n.querySelector('[data-boite-heros]'), o = n.querySelector('[data-boite-corps]'); return !!(h && o && (h.compareDocumentPosition(o) & 4)); })(), meta: !!n.querySelector('[data-boite-meta]') }));
        dit(R.sujet === E[0].subject && /Mondial Relay/.test(R.de) && /vendeuse@exemple\.test/.test(R.recu) && R.meta, `${nom} : le sujet d’origine en tête, l’expéditeur, l’adresse de réception, la date`, JSON.stringify(R).slice(0, 300));
        dit(!R.balise && /Relais Tabac du Port/.test(R.texte) && await pg.evaluate(() => window.__xss === undefined), `${nom} : le corps est du TEXTE (aucune balise affichée, aucun script exécuté)`);
        dit(R.lien.length >= 1 && R.lien.every((x) => /noopener/.test(x) && /_blank/.test(x)), `${nom} : un lien s’ouvre ailleurs (noopener, nouvel onglet)`, R.lien.join(' '));
        dit(R.code >= 40 && R.avant && R.objet === 'retrait' && /12345678/.test(R.ident), `${nom} : « Ce que VRM a compris » AVANT le message : code EN GRAND, « Voir le colis à retirer » par identité (n° de suivi)`, JSON.stringify({ code: R.code, avant: R.avant, objet: R.objet, ident: R.ident }));
        await pg.screenshot({ path: path.join(CAPT, `lecture-${nom}.png`) });
        if (!large) {
          const f = await pg.evaluate(() => { const f = document.querySelector('[data-boite-feuille]'); if (!f) return null; const r = f.getBoundingClientRect(), cs = getComputedStyle(f); return { op: cs.opacity, fond: cs.backgroundColor, couvre: r.top <= 0 && r.bottom >= innerHeight - 1 && r.width >= innerWidth - 1 }; });
          dit(f && f.op === '1' && /^rgb\(/.test(f.fond) && f.couvre, `${nom} : au téléphone, l’e-mail s’ouvre en feuille plein écran OPAQUE`, JSON.stringify(f));
        } else {
          const v = await pg.evaluate(() => { const c = document.querySelector('[data-boite-liste-col]'), l = document.querySelector('[data-boite-lecture-col]'); return { liste: Math.round(c.getBoundingClientRect().width), lecture: l ? Math.round(l.getBoundingClientRect().width) : 0 }; });
          dit(v.liste >= 300 && v.liste <= 440 && v.lecture > v.liste, `${nom} : un e-mail ouvert ⇒ deux volets`, JSON.stringify(v));
        }
        // Le geste mène au bon chemin, par identité.
        await lec.locator('[data-boite-objet="retrait"]').click();
        await pg.waitForTimeout(500);
        dit(/tab=cat_bord/.test(pg.url()) || await pg.evaluate(() => (window.__aller || []).some((x) => /cat_bord/.test(JSON.stringify(x)))) || !(await pg.locator(`[data-boite-lecture="${id(1)}"]`).count()), `${nom} : « Voir le colis à retirer » mène au colis par son identité`);
        await pg.goto(`http://localhost:${PORT}/?tab=emails`, { waitUntil: 'domcontentloaded' });
        await b.locator(`[data-boite-email="${id(7)}"]`).waitFor({ timeout: 9000 });
        await b.locator(`[data-boite-email="${id(7)}"]`).click();
        await pg.locator(`[data-boite-lecture="${id(7)}"] [data-boite-sujet]`).waitFor();
        await pg.waitForTimeout(300);
        const A = await pg.evaluate(() => { const n = document.querySelector('[data-boite-lecture]'); return { objet: n.querySelectorAll('[data-boite-objet]:not([data-boite-objet="aucun"])').length, aucun: !!n.querySelector('[data-boite-fait][data-boite-objet="aucun"]'), corps: (n.querySelector('[data-boite-corps]') || { dataset: {} }).dataset.boiteCorps, pieces: (n.querySelector('[data-boite-pieces]') || { dataset: {} }).dataset.boitePieces }; });
        dit(A.objet === 0 && A.aucun && A.corps === 'absent' && A.pieces === 'pas-su', `${nom} : e-mail ancien — sans identité aucun lien (dit), texte non gardé dit, pièces « pas su » (jamais « aucune »)`, JSON.stringify(A));
        if (!large) { await pg.locator('[data-boite-fermer]').click(); await pg.waitForTimeout(400); dit(!(await pg.locator('[data-boite-feuille]').count()), `${nom} : « ‹ E-mails » ferme la feuille`); }
        const Q = await pg.evaluate(() => ({ cote: document.documentElement.scrollWidth > innerWidth + 1, petites: [...document.querySelectorAll('[data-boite-emails] button, [data-boite-emails] input, [data-boite-emails] select')].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 2 && r.height > 0 && (r.height < 43.5 || r.width < 43.5) && !x.closest('.n-mail-msg'); }).map((x) => (x.className || x.tagName) + '|' + (x.innerText || x.getAttribute('aria-label') || '').slice(0, 20)) }));
        dit(!Q.cote, `${nom} : aucun débordement horizontal (boîte)`);
        dit(!Q.petites.length, `${nom} : cibles ≥ 44 px (boîte)`, Q.petites.slice(0, 4).join(' · '));
        await pg.screenshot({ path: path.join(CAPT, `boite-${nom}.png`) });
        dit(erreurs.length === 0, `${nom} : aucune erreur JavaScript`, erreurs.join(' '));
        await ctx.close();
      });
      // Les ÉTATS : lecture, panne (« Réessayer »), vide (« Relier ma boîte »), compte sans e-mail, « Actualiser ».
      await essaie('états ' + nom, async () => {
        let mode = 'attente', lib = null;
        const { ctx, pg, erreurs, appels } = await ouvrir(nav, { viewport, tactile, sombre, liste: (q) => {
          if (mode === 'attente') return new Promise((res) => { lib = () => res({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: 0, parPage: 20, suite: false, emails: [], compteurs: { ...COMPTEURS, sur: 0, aVerifier: 0, parRubrique: { ventes: 0, achats: 0, codes: 0, colis: 0, offres: 0, autres: 0 } }, adresses: ADRESSES }) }); });
          if (mode === 'panne') return { status: 503, contentType: 'application/json', body: '{"ok":false}' };
          if (mode === 'vide') return { status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: 0, parPage: 20, suite: false, emails: [], compteurs: { ...COMPTEURS, sur: 0, aVerifier: 0, parRubrique: { ventes: 0, achats: 0, codes: 0, colis: 0, offres: 0, autres: 0 } }, adresses: ADRESSES }) };
          return null;
        } });
        const b = pg.locator('[data-boite-emails]');
        await b.locator('[data-boite-chargement]').waitFor({ timeout: 8000 });
        dit(await b.locator('[data-boite-email]').count() === 0, `${nom} : lecture en cours — des lignes fantômes (occupé), aucune ligne inventée`);
        mode = 'panne'; if (lib) lib();
        await pg.waitForTimeout(400);
        await b.locator('[data-v2-mail-plus]').click(); await pg.waitForTimeout(200); await pg.keyboard.press('Escape');
        // Relire en panne : une rubrique relance une lecture.
        await b.locator('[data-boite-rubrique-v2="colis"]').click();
        await b.locator('[data-boite-etat="panne"]').waitFor({ timeout: 8000 });
        const p = await pg.evaluate(() => { const e = document.querySelector('[data-boite-etat="panne"]'); const r = e && [...e.querySelectorAll('button')].find((x) => /Réessayer/.test(x.innerText)); const segs = [...document.querySelectorAll('[data-boite-rubrique-v2] .n-segmente-n')].map((x) => x.textContent); return { r: r ? Math.round(r.getBoundingClientRect().height) : 0, segs }; });
        dit(p.r >= 44, `${nom} : panne — la raison, rien n’est perdu, « Réessayer » (44 px)`, JSON.stringify(p));
        mode = 'vide';
        const nAv = journal(appels).length;
        await b.locator('[data-boite-etat="panne"] button', { hasText: 'Réessayer' }).click();
        await b.locator('[data-boite-etat="vide"], [data-boite-etat="rubrique-vide"]').first().waitFor({ timeout: 8000 });
        dit(journal(appels).length === nAv + 1, `${nom} : « Réessayer » relit la boîte (une lecture, sur SON geste)`);
        await b.locator('[data-boite-rubrique-v2="tout"]').click();
        await b.locator('[data-boite-etat="vide"]').waitFor({ timeout: 8000 });
        const v = await pg.evaluate(() => { const g = document.querySelector('[data-boite-etat="vide"] [data-boite-etat-geste="relier"]'); return { plein: g && g.dataset.nVariante, h: g ? Math.round(g.getBoundingClientRect().height) : 0 }; });
        dit(v.plein === 'plein' && v.h >= 44, `${nom} : boîte vide — dit quoi faire, LE geste « Relier ma boîte » (le plein, ≥ 44 px)`, JSON.stringify(v));
        await pg.screenshot({ path: path.join(CAPT, `etat-vide-${nom}.png`) });
        await b.locator('[data-boite-etat-geste="relier"]').click();
        await pg.locator('[data-relier-ma-boite]').waitFor({ timeout: 8000 });
        dit(true, `${nom} : « Relier ma boîte » ouvre l’accompagnement`);
        dit(!appels.some((a) => a.methode !== 'GET' && ['journal', 'adresse-unique'].includes(a.q.mode)), `${nom} : « Relier ma boîte » n’écrit RIEN (il ne fait que lire)`);
        await pg.locator('[data-v2-mail-retour]').click();
        await b.locator('[data-boite-etat="vide"]').waitFor({ timeout: 8000 });
        // « Actualiser » : seulement quand la liste a plus d'une minute.
        mode = 'normal';
        await b.locator('[data-boite-rubrique-v2="ventes"]').click(); await b.locator('[data-boite-email]').first().waitFor({ timeout: 8000 });
        dit(await b.locator('[data-boite-actualiser]').count() === 0, `${nom} : liste fraîche ⇒ pas d’« Actualiser »`);
        await pg.clock.setFixedTime(MAINTENANT + 3 * 60e3);
        await pg.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
        const act = b.locator('[data-boite-actualiser]');
        await act.waitFor({ timeout: 3000 });
        const nA = journal(appels).length;
        dit((await act.boundingBox()).height >= 44, `${nom} : la liste a plus d’une minute ⇒ « Actualiser » apparaît (44 px)`);
        await act.click();
        await b.locator('[data-boite-email]').first().waitFor({ timeout: 8000 });
        dit(journal(appels).length === nA + 1 && await b.locator('[data-boite-actualiser]').count() === 0, `${nom} : « Actualiser » relit une fois, puis s’efface (liste fraîche)`);
        dit(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${nom} : aucun débordement horizontal (états)`);
        dit(erreurs.length === 0, `${nom} : aucune erreur JavaScript`, erreurs.join(' '));
        await ctx.close();
      });
    }
    await essaie('mouvement réduit', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { viewport: { width: 390, height: 844 }, tactile: true, sombre: false, reduit: true });
      await pg.locator(`[data-boite-email="${id(1)}"]`).click();
      await pg.locator(`[data-boite-lecture="${id(1)}"] [data-boite-sujet]`).waitFor();
      const anims = await pg.evaluate(() => [...document.querySelectorAll('[data-boite-feuille], [data-boite-feuille] *')].filter((x) => getComputedStyle(x).animationName !== 'none').length);
      dit(anims === 0, 'mouvement réduit : la feuille de lecture s’ouvre sans aucun mouvement', String(anims));
      dit(erreurs.length === 0, 'mouvement réduit : aucune erreur JavaScript', erreurs.join(' '));
      await ctx.close();
    });
  } finally { await nav.close(); srv.close(); }
  console.log({ ok, ko, captures: CAPT }); process.exit(ko ? 1 : 0);
})();
