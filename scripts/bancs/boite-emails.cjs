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
const RUB = (e) => (e.type === 'suivi' && e.resume && e.resume.code ? 'codes' : ['vente', 'finalisation', 'vente-vestiaire'].includes(e.type) ? 'ventes' : e.type === 'achat' ? 'achats' : ['suivi', 'bordereau'].includes(e.type) ? 'colis' : 'autres');
const dans = (e, r) => !r || (r === 'colis' ? ['colis', 'codes'].includes(RUB(e)) : RUB(e) === r);
const parRubrique = { ventes: 0, achats: 0, codes: 0, colis: 0, autres: 0 }; E.forEach((e) => { const r = RUB(e); parRubrique[r]++; if (r === 'codes') parRubrique.colis++; });
const COMPTEURS = { sur: E.length, plus: false, integre: 25, aVerifier: 1, erreur: 0, incompris: 1, parRubrique };
// (revue du 5 nov.) La route compte sur l'adresse choisie et le dit (`adresse`).
const compteursDe = (adr) => { if (!adr) return COMPTEURS; const l = E.filter((e) => e.adresses.includes(adr)); const pr = { ventes: 0, achats: 0, codes: 0, colis: 0, autres: 0 }; l.forEach((e) => { const r = RUB(e); pr[r]++; if (r === 'codes') pr.colis++; }); return { ...COMPTEURS, sur: l.length, parRubrique: pr, adresse: adr }; };
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
        dit(await l1.getAttribute('data-rubrique') === 'codes' && /Mondial Relay/.test(await l1.innerText()), `${nom} : ligne — rubrique « codes », expéditeur lisible`, await l1.innerText());
        // ── CLARTÉ 1 : chaque ligne commence par CE QUE C'EST (jamais le sujet brut).
        // (v33) Le premier TEXTE lu est la nature (la marque à gauche est muette,
        // `aria-hidden`) ; en gras et plus grande que la ligne de l'expéditeur —
        // sauf un e-mail « rien à faire », atténué (jugé plus bas).
        {
          const lu = await lignes.evaluateAll((l) => l.map((x) => {
            const q = x.querySelector('[data-boite-quoi]'), p = x.querySelector('.vrm-boite-ligne-pied');
            const ecrit = [...x.querySelectorAll('*')].filter((n) => !n.closest('[aria-hidden="true"]') && [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()));
            return { id: x.dataset.boiteEmail, rien: x.dataset.boiteRien === '1', quoi: q ? q.innerText.trim() : '', titre: q ? q.dataset.boiteQuoi : '', premier: ecrit[0] === q, auDessus: !!(q && p && q.getBoundingClientRect().bottom <= p.getBoundingClientRect().top + 1), gras: q ? Number(getComputedStyle(q).fontWeight) : 0, tq: q ? parseFloat(getComputedStyle(q).fontSize) : 0, tp: p ? parseFloat(getComputedStyle(p).fontSize) : 0, texte: x.innerText };
          }));
          const parId = Object.fromEntries(lu.map((x) => [x.id, x]));
          const sujetDe = Object.fromEntries(E.map((e) => [e.id, e.subject]));
          const mauvaises = lu.filter((x) => !x.quoi || !x.titre || !x.premier || !x.auDessus || (!x.rien && x.gras < 600) || !(x.tq > x.tp) || x.texte.includes(sujetDe[x.id]));
          dit(lu.length === 20 && mauvaises.length === 0, `${nom} : chaque ligne commence par ce que c'est (en gras, plus grand), l'expéditeur en dessous — le sujet brut n'est sur aucune ligne`, JSON.stringify(mauvaises.slice(0, 2)));
          // (v33) Trois étages, une seule source (le résumé rangé) : la nature,
          // l'essentiel (faits courts d'abord), le geste.
          const ranges = await lignes.evaluateAll((l) => l.map((x) => ({ id: x.dataset.boiteEmail, titre: (x.querySelector('[data-boite-quoi]') || {}).innerText || '', essentiel: ((x.querySelector('[data-boite-essentiel]') || {}).innerText || '').replace(/\s+/g, ' ').trim(), geste: x.dataset.boiteGeste || '', mot: ((x.querySelector('[data-boite-geste-mot]') || {}).innerText || '').replace(/\s+/g, ' ').trim(), proche: x.dataset.boiteProche === '1' })));
          const rid = Object.fromEntries(ranges.map((x) => [x.id, x]));
          const attendu = {
            [id(1)]: ['Colis à retirer', 'code 418 205 · Relais Tabac du Port', 'retrait', 'avant le 9 nov.', false],
            [id(2)]: ['Vendu', 'N°42 · Nike Air Max 90', 'bordereau', 'bordereau prêt', false],
            [id(27)]: ['Vendu sur Vestiaire', 'tu reçois 82,40 € · Jordan 1 Mid', 'envoi', 'à envoyer avant le 6 nov. (demain)', true],
            [id(3)]: ['Vendu', 'N°17 · 55 € · Adidas Samba', '', '', false],
            [id(4)]: ['Achat', '45,00 € · Nike Air Force 1', '', '', false],
            [id(5)]: ['Newsletter Vinted', '', '', '', false],
            [id(6)]: ['Pas reconnu par VRM', '', 'verifier', 'à vérifier', false],
            [id(7)]: ['Vendu · bordereau', 'détail non gardé', '', '', false],
          };
          const faux = Object.entries(attendu).filter(([k, [t, es, g, m, pr]]) => { const x = rid[k]; return !x || x.titre !== t || x.essentiel !== es || x.geste !== g || x.mot !== m || x.proche !== pr; }).map(([k]) => rid[k] || k);
          dit(faux.length === 0, `${nom} : en mots simples, depuis ce que VRM a rangé — la nature, l'essentiel (code, N°, montant d'abord, le nom de l'article en dernier), le geste à part ; rien d'inventé pour un e-mail ancien`, JSON.stringify(faux));
          // La marque à gauche : logo du site, monogramme NEUTRE pour un transporteur.
          const marques = await lignes.evaluateAll((l) => l.map((x) => {
            const m = x.querySelector('.vrm-boite-marque'), q = x.querySelector('[data-boite-quoi]');
            if (!m || !q) return { id: x.dataset.boiteEmail, ok: false };
            const rm = m.getBoundingClientRect(), rq = q.getBoundingClientRect(), cs = getComputedStyle(m), lg = m.querySelector('[data-logo-site]');
            return { id: x.dataset.boiteEmail, k: m.dataset.marque, logo: lg ? lg.dataset.logoSite : '', mono: m.innerText.trim(), cache: m.getAttribute('aria-hidden') === 'true', gauche: rm.right <= rq.left, taille: Math.round(rm.width), fond: cs.backgroundColor, ok: true };
          }));
          const mq = Object.fromEntries(marques.map((x) => [x.id, x]));
          const chrono = E.find((e) => /Chronopost/.test(e.from) && parId[e.id]);
          const colore = (c) => { const n = (String(c).match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number); return n.length === 3 && Math.max(...n) - Math.min(...n) > 12; };
          const fondsColores = marques.filter((x) => x.ok && colore(x.fond));
          dit(marques.every((x) => x.ok && x.cache && x.gauche && x.taille >= 32) && mq[id(2)].logo === 'vinted' && mq[id(27)].logo === 'vestiaire' && mq[id(1)].k === 'monogramme' && mq[id(1)].mono === 'MR' && !!chrono && mq[chrono.id].mono === 'C' && fondsColores.length === 0, `${nom} : la marque de l'expéditeur à GAUCHE de chaque ligne (≥ 32 px) — logo du site, monogramme neutre (« MR », « C ») pour un transporteur, aucun fond de couleur`, JSON.stringify([mq[id(1)], mq[id(2)], fondsColores.slice(0, 1)]));
          // L'heure alignée à droite, sur la ligne de la nature ; le transporteur et le compte en dessous.
          const heures = await lignes.evaluateAll((l) => l.map((x) => { const t = x.querySelector('time'), q = x.querySelector('[data-boite-quoi]'), tx = x.querySelector('.vrm-boite-ligne-txt'); if (!t || !q || !tx) return null; const rt = t.getBoundingClientRect(), rq = q.getBoundingClientRect(), rx = tx.getBoundingClientRect(); return { droite: Math.abs(rt.right - rx.right) <= 1, ligne: rt.top < rq.bottom && rt.bottom > rq.top }; }));
          const heureLue = /\b15:58\b/.test(parId[id(1)].texte) && /compte-un/.test(parId[id(1)].texte) && /Mondial Relay/.test(parId[id(1)].texte);
          dit(heures.every((x) => x && x.droite && x.ligne) && heureLue, `${nom} : l'heure alignée à droite sur la ligne de la nature ; le transporteur nommé, le compte, plus petits`, JSON.stringify(heures.filter((x) => !(x && x.droite && x.ligne)).slice(0, 2)));
          // Ce qui demande un geste se voit : l'ambre seulement pour un délai proche ou « à vérifier ».
          const coul = await lignes.evaluateAll((l) => l.map((x) => { const g = x.querySelector('[data-boite-geste-mot]'), p = x.querySelector('.vrm-boite-ligne-pied'); return { id: x.dataset.boiteEmail, c: g ? getComputedStyle(g).color : '', w: g ? Number(getComputedStyle(g).fontWeight) : 0, pied: p ? getComputedStyle(p).color : '' }; }));
          const cId = Object.fromEntries(coul.map((x) => [x.id, x]));
          const ambre = (cId[id(6)] || {}).c;
          const ambres = coul.filter((x) => x.c && x.c === ambre).map((x) => x.id).sort();
          dit(!!ambre && ambre !== cId[id(6)].pied && ambres.join() === [id(27), id(6)].sort().join() && cId[id(1)].c !== ambre && cId[id(1)].w >= 600 && cId[id(1)].c !== cId[id(1)].pied && cId[id(2)].w >= 600 && !/rgb\(2[0-5]\d, [0-6]\d, [0-6]\d\)/.test(ambre), `${nom} : le GESTE marqué (\`data-boite-geste\`), en gras ; l'ambre seulement pour un délai à moins de 48 h ou « à vérifier » — jamais rouge`, JSON.stringify({ ambre, ambres: ambres.map((x) => x.slice(16, 20)), un: cId[id(1)] }));
          // « Rien à faire » : atténué (titre en gris, plus léger), jamais caché.
          const rien = await lignes.evaluateAll((l) => l.filter((x) => x.dataset.boiteRien === '1').map((x) => { const q = x.querySelector('[data-boite-quoi]'), p = x.querySelector('.vrm-boite-ligne-pied'); return { id: x.dataset.boiteEmail, c: getComputedStyle(q).color, w: Number(getComputedStyle(q).fontWeight), pied: getComputedStyle(p).color, h: x.getBoundingClientRect().height }; }));
          const autre = await b.locator(`[data-boite-email="${id(3)}"] [data-boite-quoi]`).evaluate((q) => ({ c: getComputedStyle(q).color, h: q.closest('[data-boite-email]').getBoundingClientRect().height }));
          dit(rien.length === 1 && rien[0].id === id(5) && rien[0].c === rien[0].pied && rien[0].c !== autre.c && rien[0].w < 600 && rien[0].h > 0 && rien[0].h < autre.h, `${nom} : la newsletter « rien à faire » est ATTÉNUÉE (titre gris, plus léger, ligne plus basse), jamais cachée`, JSON.stringify({ rien, autre }));
          // Aucun libellé coupé : pastilles, onglets, natures, gestes ; le pied tient sur une ligne ; le code jamais mangé par « … ».
          const coupe = await b.evaluate((racine) => {
            const coupes = (sel) => [...racine.querySelectorAll(sel)].filter((n) => n.getClientRects().length && n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent.trim().slice(0, 30));
            const out = { pastilles: coupes('[data-boite-rubrique], [data-boite-rubrique] > span'), vues: coupes('[data-boite-vue]'), natures: coupes('[data-boite-quoi]'), gestes: coupes('[data-boite-geste-mot]') };
            // Le pied : le geste, puis « qui » (expéditeur · compte · pièces) — chaque bloc
            // sur UNE ligne, aucun nom coupé (« Mondial Rel… »), aucun « · » en début de ligne.
            out.pieds = [...racine.querySelectorAll('.vrm-boite-ligne-pied')].filter((p) => [p, ...p.children].some((g) => g !== p && new Set([...g.children].map((c) => Math.round(c.getBoundingClientRect().top))).size > 1) || [...p.children].some((c) => /^\s*·/.test(c.innerText))).length;
            out.noms = coupes('.vrm-boite-exp-nom, .vrm-boite-compte-nom, .vrm-boite-ligne-pied > *');
            out.codes = [...racine.querySelectorAll('.vrm-boite-code')].filter((c) => c.getBoundingClientRect().right > c.parentElement.getBoundingClientRect().right + 1).length;
            out.sansCode = [...racine.querySelectorAll('[data-rubrique="codes"]')].filter((x) => !x.querySelector('.vrm-boite-code')).length;
            const row = racine.querySelector('.vrm-boite-rubriques');
            const mask = (n) => getComputedStyle(n).webkitMaskImage || getComputedStyle(n).maskImage || 'none';
            out.rangee = { deborde: row.scrollWidth > row.clientWidth + 1, droite: row.dataset.bordDroite || '', gauche: row.dataset.bordGauche || '', mask: mask(row).slice(0, 60) };
            return out;
          });
          const sansIndice = coupe.rangee.deborde && (coupe.rangee.droite !== '1' || !/gradient/.test(coupe.rangee.mask));
          dit(!coupe.pastilles.length && !coupe.vues.length && !coupe.natures.length && !coupe.gestes.length && !coupe.noms.length && coupe.pieds === 0 && coupe.codes === 0 && coupe.sansCode === 0 && !sansIndice, `${nom} : aucun libellé coupé — pastilles, onglets, natures, gestes, noms entiers ; chaque bloc du pied sur une ligne ; le code de retrait en tête, jamais mangé ; la rangée qui dépasse est sous un FONDU de bord`, JSON.stringify(coupe));
          if (coupe.rangee.deborde) {
            await b.locator('.vrm-boite-rubriques').evaluate((x) => { x.scrollLeft = x.scrollWidth; x.dispatchEvent(new Event('scroll')); });
            await pg.waitForTimeout(150);
            const fin = await b.locator('.vrm-boite-rubriques').evaluate((x) => ({ g: x.dataset.bordGauche, d: x.dataset.bordDroite, m: (getComputedStyle(x).webkitMaskImage || getComputedStyle(x).maskImage || '').slice(0, 50) }));
            dit(fin.g === '1' && fin.d === '0' && /gradient/.test(fin.m), `${nom} : rangée défilée au bout — le fondu passe à GAUCHE (il reste des pastilles de ce côté)`, JSON.stringify(fin));
            await b.locator('.vrm-boite-rubriques').evaluate((x) => { x.scrollLeft = 0; x.dispatchEvent(new Event('scroll')); });
          }
          // Le compte : un menu simple (le nom, jamais l'adresse quand le nom suffit), 44 px.
          const menu = await b.locator('[data-boite-adresse]').evaluate((s) => ({ options: [...s.options].map((o) => o.textContent), h: s.getBoundingClientRect().height }));
          dit(JSON.stringify(menu.options) === JSON.stringify(['Tous les comptes', 'compte-un', 'compte-deux', 'compte-trois']) && menu.h >= 44, `${nom} : le menu des comptes dit le NOM du compte (aucune adresse technique), 44 px`, JSON.stringify(menu));
          // « Actualiser » n'est là que s'il sert : la liste vient d'être lue.
          dit(await b.locator('[data-boite-actualiser]').count() === 0 && !/Actualiser/.test(await b.innerText()), `${nom} : liste toute fraîche ⇒ pas de bouton « Actualiser »`);
        }
        // ── CLARTÉ 2 : groupés par jour.
        {
          const jours = await b.locator('[data-boite-jour]').evaluateAll((l) => l.map((g) => ({ mot: g.dataset.boiteJour, titre: (g.querySelector('h2') || {}).innerText || '', ids: [...g.querySelectorAll('[data-boite-email]')].map((x) => x.dataset.boiteEmail) })));
          const mots = jours.map((j) => j.mot);
          const dans = (k, mot) => (jours.find((j) => j.mot === mot) || { ids: [] }).ids.includes(k);
          const total = jours.reduce((s, j) => s + j.ids.length, 0);
          dit(JSON.stringify(mots) === JSON.stringify(['Aujourd’hui', 'Hier', 'Mardi 3 novembre']) && jours.every((j) => j.titre.trim() === j.mot) && dans(id(1), 'Aujourd’hui') && dans(id(5), 'Aujourd’hui') && dans(id(6), 'Hier') && dans(id(7), 'Mardi 3 novembre') && total === 20, `${nom} : groupés par jour — « Aujourd’hui », « Hier », « Mardi 3 novembre », chaque e-mail une fois`, JSON.stringify(jours.map((j) => [j.mot, j.ids.length])));
        }
        // ── CLARTÉ 3 : les rubriques au doigt, avec leur nombre, qui défilent.
        {
          const r = await b.locator('.vrm-boite-rubriques').evaluate((row) => {
            const bs = [...row.querySelectorAll('[data-boite-rubrique]')];
            return { ox: getComputedStyle(row).overflowX, wrap: getComputedStyle(row).flexWrap, tops: [...new Set(bs.map((x) => Math.round(x.getBoundingClientRect().top)))].length, h: Math.min(...bs.map((x) => x.getBoundingClientRect().height)), n: bs.map((x) => [x.dataset.boiteRubrique, (x.querySelector('[data-boite-n]') || {}).textContent || null]), sw: row.scrollWidth, cw: row.clientWidth };
          });
          const attendu = { tout: String(E.length), ventes: String(parRubrique.ventes), achats: String(parRubrique.achats), codes: String(parRubrique.codes), colis: String(parRubrique.colis), autres: String(parRubrique.autres) };
          const nOk = r.n.every(([k, v]) => v === attendu[k]);
          dit(nOk && r.h >= 44 && r.tops === 1 && r.wrap === 'nowrap' && ['auto', 'scroll'].includes(r.ox), `${nom} : rubriques — une rangée (une seule ligne), 44 px au doigt, le nombre de CHAQUE rubrique, défilement si ça ne rentre pas`, JSON.stringify(r));
          if (tactile) {
            const avant = await b.locator('.vrm-boite-rubriques').evaluate((x) => x.scrollLeft);
            await b.locator('.vrm-boite-rubriques').evaluate((x) => { x.scrollLeft = x.scrollWidth; });
            const apres = await b.locator('.vrm-boite-rubriques').evaluate((x) => x.scrollLeft);
            dit(r.sw > r.cw && apres > avant, `${nom} : au téléphone, la rangée déborde et DÉFILE (pas de retour à la ligne)`, `${r.sw}/${r.cw} ${avant}→${apres}`);
            await b.locator('.vrm-boite-rubriques').evaluate((x) => { x.scrollLeft = 0; });
          }
          dit(await b.locator('[data-boite-sur]').count() === 0, `${nom} : tous les e-mails comptés ⇒ aucune phrase de couverture à lire`);
        }
        dit(await b.locator(`[data-boite-email="${id(2)}"] [data-boite-pj="1"]`).count() === 1, `${nom} : trombone + nombre de pièces jointes`);
        dit(await b.locator(`[data-boite-email="${id(6)}"] [data-boite-averifier]`).count() === 1 && await b.locator(`[data-boite-email="${id(1)}"] [data-boite-averifier]`).count() === 0, `${nom} : « à vérifier » seulement où il faut`);
        const coulAmbre = await b.locator(`[data-boite-email="${id(6)}"] [data-boite-averifier]`).evaluate((n) => getComputedStyle(n).color);
        const coulPied = await b.locator(`[data-boite-email="${id(6)}"] .vrm-boite-ligne-pied`).evaluate((n) => getComputedStyle(n).color);
        dit(coulAmbre !== coulPied && !/rgb\(2[0-5]\d, [0-6]\d, [0-6]\d\)/.test(coulAmbre), `${nom} : « à vérifier » en ambre (jamais rouge)`, coulAmbre);
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
          dit(pastille === String(nV) && await couv.count() === 1 && /compte-deux/.test(await couv.innerText()), `${nom} : compte choisi — le nombre de la pastille et la phrase portent sur CE compte`, `${pastille}/${nV}`);
        }
        await b.locator('[data-boite-adresse]').selectOption(''); await pg.waitForTimeout(500);
        await pg.mouse.move(1, 1); await pg.waitForTimeout(350); // un survol resté sur une ligne n'est pas à photographier
        await pg.screenshot({ path: path.join(CAPT, `boite-${nom}.png`) });
        await b.locator('[data-boite-liste]').screenshot({ path: path.join(CAPT, `liste-${nom}.png`) });
        // ── CLARTÉ 4 : libellés techniques retirés de la boîte.
        {
          const t = await b.innerText();
          dit(!/adresse de réception\)|Comptés sur tes|arrivée dans VRM/i.test(t), `${nom} : plus de « Compte (adresse de réception) », « Comptés sur tes N derniers e-mails », « (arrivée dans VRM) »`, (t.match(/adresse de réception\)|Comptés sur tes[^\n]*|arrivée dans VRM/i) || [''])[0]);
        }
        // ── (v33) La ligne répond À L'APPUI (avant le relâcher) : son fond change
        // tout de suite. Le pointeur quitte la ligne avant de relâcher : rien ne s'ouvre.
        if (!tactile) {
          const l3 = b.locator(`[data-boite-email="${id(3)}"]`);
          await l3.evaluate((n) => n.scrollIntoView({ block: 'center' })); await pg.waitForTimeout(100);
          const bx = await l3.boundingBox();
          const repos = await l3.evaluate((n) => getComputedStyle(n).backgroundColor);
          await pg.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await pg.mouse.down();
          const appui = await l3.evaluate((n) => getComputedStyle(n).backgroundColor);
          const sous = await pg.evaluate(([x, y]) => { const h = document.elementFromPoint(x, y); return h ? (h.closest('[data-boite-email]') || {}).dataset?.boiteEmail || h.className : ''; }, [bx.x + bx.width / 2, bx.y + bx.height / 2]);
          await pg.mouse.move(bx.x + bx.width / 2, bx.y - 400); await pg.mouse.up();
          await pg.waitForTimeout(150);
          dit(appui !== repos && !/rgba\(0, 0, 0, 0\)|transparent/.test(appui) && await pg.locator(`[data-boite-lecture="${id(3)}"]`).count() === 0, `${nom} : la ligne répond dès l’appui (fond plein tout de suite), sans rien ouvrir si le doigt s’en va`, `${repos} → ${appui} (sous le pointeur : ${String(sous).slice(0, 40)})`);
          await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
        }
        // Lire un email
        const nLire = journal(appels).filter((a) => a.q.lire).length;
        if (!tactile) await l1.click();
        else {
          // ── CLARTÉ 5 (défaut grave du 5 nov.) : la feuille est OPAQUE dès sa
          // première image. Le toucher et la mesure partent du MÊME script (aucun
          // aller-retour du banc entre les deux, qui laisserait passer le fondu) :
          // à chaque image pendant ≈ 500 ms, l’opacité de la feuille et de chacun
          // de ses parents vaut 1, son fond n'a aucune transparence, et au milieu
          // de la ligne touchée c'est la feuille qui est au-dessus (rien de la
          // liste visible derrière).
          const ech = await l1.evaluate(async (ligne) => {
            const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return c === 'transparent' ? 0 : 1; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; };
            const rl = ligne.getBoundingClientRect(); const cx = rl.left + rl.width / 2, cy = rl.top + rl.height / 2;
            const image = () => new Promise((r) => requestAnimationFrame(r));
            ligne.click();
            let n = null;
            for (let i = 0; i < 60 && !(n = document.querySelector('[data-boite-feuille]')); i++) await image();
            if (!n) return { out: [], couvre: false };
            const out = [];
            // 30 images (≈ 500 ms) — comptées en images : l'horloge du banc est figée.
            for (let i = 0; i < 30; i++) {
              let op = 1; for (let x = n; x && x.nodeType === 1; x = x.parentElement) op *= Number(getComputedStyle(x).opacity);
              const haut = document.elementFromPoint(cx, cy);
              out.push({ op, a: alpha(getComputedStyle(n).backgroundColor), fond: getComputedStyle(n).backgroundColor, dessus: !!(haut && n.contains(haut)) });
              await image();
            }
            const r = n.getBoundingClientRect();
            return { out, couvre: r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight };
          });
          const mauvais = ech.out.filter((x) => x.op < 0.999 || x.a < 0.999 || !x.dessus);
          dit(ech.out.length >= 5 && mauvais.length === 0 && ech.couvre, `${nom} : la feuille de lecture est OPAQUE dès la première image (opacité 1, fond plein, couvre l’écran, la liste n’est jamais visible au travers)`, `${ech.out.length} échantillons, ${mauvais.length} transparents ; 1er : ${JSON.stringify(ech.out[0])}`);
          const fond = (ech.out[ech.out.length - 1] || {}).fond;
          dit(fond === (sombre ? 'rgb(0, 0, 0)' : 'rgb(242, 242, 247)'), `${nom} : le fond de la feuille est celui du thème (${sombre ? 'noir' : 'gris clair'}), comme les autres feuilles`, fond);
        }
        const lec = pg.locator(`[data-boite-lecture="${id(1)}"]`);
        await lec.locator('[data-boite-sujet]').waitFor();
        dit(journal(appels).filter((a) => a.q.lire).length === nLire + 1, `${nom} : le corps se lit sur le clic, un e-mail à la fois`);
        dit((await lec.locator('[data-boite-sujet]').innerText()) === 'Votre colis 12345678 est disponible' && /Mondial Relay/.test(await lec.locator('[data-boite-de]').innerText()) && /noreply@mondialrelay\.fr/.test(await lec.locator('[data-boite-de]').innerText()) && /2026/.test(await lec.locator('[data-boite-date]').innerText()) && /vendeuse@exemple\.test/.test(await lec.locator('[data-boite-recu]').innerText()), `${nom} : le sujet d’origine reste visible ; expéditeur, date, adresse de réception`);
        const corps = await lec.locator('[data-boite-corps="lu"]').innerText();
        // ── CLARTÉ 6 : aucune balise affichée en texte, aucune exécutée ; le texte reste.
        dit(/\[lien suivi\.exemple\.test\]/.test(corps) && !/\n\n\n/.test(corps) && !/<\s*\/?\s*[a-z!]/i.test(corps) && !/&(amp|lt|gt|quot);/.test(corps) && /gras & fin/.test(corps) && await lec.locator('[data-boite-corps] img, [data-boite-corps] b').count() === 0 && !(await pg.evaluate(() => window.__xss)), `${nom} : message nettoyé — balises (<img …>, <b>, &lt;img&gt;, balise coupée) retirées, jamais exécutées, le texte gardé`, JSON.stringify(corps.slice(-80)));
        dit(await lec.locator('[data-boite-pieces="0"]').count() === 1, `${nom} : « aucune pièce jointe » quand on a lu qu’il n’y en a pas`);
        const objet = lec.locator('[data-boite-objet="retrait"]');
        dit(await objet.count() === 1 && /^Voir le colis à retirer/.test((await objet.innerText()).trim()), `${nom} : « Voir le colis à retirer » (identité : n° de suivi)`, await objet.innerText());
        // ── CLARTÉ 7 : en haut, en gros, ce que c'est et le bouton ; la ligne discrète à la fin.
        {
          const o = await lec.evaluate((a) => {
            const q = (s) => a.querySelector(s);
            const h = q('[data-boite-haut]'), ti = q('[data-boite-titre]'), bt = q('[data-boite-haut] button[data-boite-objet]'), co = q('[data-boite-corps]'), pi = q('[data-boite-pieces]'), me = q('[data-boite-meta]');
            const avant = (x, y) => !!(x && y && (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING));
            return { titre: ti ? ti.innerText.trim() : '', details: (q('.vrm-boite-details') || {}).innerText || '', code: (q('[data-boite-code]') || {}).innerText || '', tCode: q('[data-boite-code] b') ? parseFloat(getComputedStyle(q('[data-boite-code] b')).fontSize) : 0, tTitre: ti ? parseFloat(getComputedStyle(ti).fontSize) : 0, tCorps: co ? parseFloat(getComputedStyle(co).fontSize) : 0, tMeta: me ? parseFloat(getComputedStyle(me).fontSize) : 0, bouton: !!bt, ordre: avant(h, co) && avant(co, pi) && avant(pi, me), premier: h && a.querySelector('h2,h3') === ti };
          });
          // (v33) Le code de retrait EN GRAND (ce qu'on montre au relais), écrit une seule fois.
          dit(/Code de retrait\s*418\s205/.test(o.code) && o.tCode >= 28 && !/418/.test(o.details), `${nom} : lecture d’un colis à retirer — le code EN GRAND (≥ 28 px), une seule fois en haut`, JSON.stringify({ code: o.code, tCode: o.tCode, details: o.details }));
          dit(o.titre === 'Colis à retirer' && /^Relais Tabac du Port · avant le 9 nov\.$/.test(o.details.replace(/\s+/g, " ")) && o.tTitre >= 20 && o.tTitre > o.tCorps && o.bouton && o.premier && o.ordre && o.tMeta <= 13, `${nom} : lecture — en haut, en gros, ce que c’est et le bouton ; puis le message, les pièces jointes, et « De · Reçu sur · date » en petit à la fin`, JSON.stringify(o));
          const t = await lec.innerText();
          dit(!/arrivée dans VRM|adresse de réception\)/i.test(t), `${nom} : lecture sans « (arrivée dans VRM) »`, (t.match(/arrivée dans VRM/) || [''])[0]);
        }
        if (w > 1000) {
          // L'accent DU THÈME (--vrm-accent, src/themeMineral.js), résolu par le navigateur.
          const [accent, duTheme] = await objet.evaluate((n) => { const t = document.createElement('i'); t.style.color = 'var(--vrm-accent)'; document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return [getComputedStyle(n).backgroundColor, c]; });
          dit(accent === duTheme && /^rgb\(\d+, \d+, 2\d\d\)$/.test(accent), `${nom} : l’accent bleu du thème, rare, sur le seul bouton qui mène à l’objet`, `${accent} / ${duTheme}`);
          // La page défilée, le haut de la lecture (« Fermer », le titre) n'est pas caché sous la barre du haut.
          await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 500; window.scrollTo(0, 500); });
          await pg.waitForTimeout(200);
          const vus = await lec.evaluate((a) => ['[data-boite-fermer]', '[data-boite-titre]'].map((s) => { const n = a.querySelector(s); const r = n.getBoundingClientRect(); const h = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + r.height / 2); return !!(h && (h === n || n.contains(h))); }));
          dit(vus.every(Boolean), `${nom} : page défilée — « Fermer » et le titre de la lecture restent visibles (pas sous la barre du haut)`, JSON.stringify(vus));
          await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
          await pg.screenshot({ path: path.join(CAPT, `lecture-${nom}.png`) });
        } else {
          dit(await pg.locator('[data-boite-feuille]').count() === 1, `${nom} : au téléphone, l’e-mail s’ouvre en feuille plein écran`);
          await pg.waitForTimeout(400);
          // (v33) Marges de 16 px, le bouton principal pleine largeur au doigt.
          const mise = await lec.evaluate((a) => {
            const r = (s) => { const n = a.querySelector(s); return n ? n.getBoundingClientRect() : null; };
            const ti = r('[data-boite-titre]'), bt = r('[data-boite-objet]'), me = r('[data-boite-message], .vrm-boite-message'), ret = r('[data-boite-fermer]');
            return { titreG: ti && Math.round(ti.left), boutonG: bt && Math.round(bt.left), boutonD: bt && Math.round(innerWidth - bt.right), boutonH: bt && Math.round(bt.height), messageG: me && Math.round(me.left), retourH: ret && Math.round(ret.height), retourG: ret && Math.round(ret.left) };
          });
          dit(mise.titreG === 16 && mise.boutonG === 16 && mise.boutonD === 16 && mise.boutonH >= 44 && mise.messageG === 16 && mise.retourH >= 44 && mise.retourG <= 16, `${nom} : lecture — marges de 16 px, le bouton principal pleine largeur (≥ 44 px), le retour au doigt en haut à gauche`, JSON.stringify(mise));
          await pg.screenshot({ path: path.join(CAPT, `lecture-${nom}.png`) });
          await pg.locator('[data-boite-feuille]').evaluate((n) => { n.scrollTop = n.scrollHeight; });
          await pg.waitForTimeout(150);
          await pg.screenshot({ path: path.join(CAPT, `lecture-bas-${nom}.png`) });
          await pg.locator('[data-boite-feuille]').evaluate((n) => { n.scrollTop = 0; });
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
        if (tactile) {
          await pg.locator('[data-boite-feuille]').evaluate((n) => { n.scrollTop = n.scrollHeight; });
          await pg.waitForTimeout(150);
          // (v33) La feuille défilée, la barre du retour reste en haut, visible et touchable.
          const barre = await pg.locator('[data-boite-feuille]').evaluate((f) => { const b = f.querySelector('[data-boite-fermer]'); const r = b.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { haut: Math.round(r.top), vu: !!(h && (h === b || b.contains(h))), defile: f.scrollTop > 0 }; });
          dit(barre.defile && barre.vu && barre.haut >= 0 && barre.haut <= 8, `${nom} : feuille défilée — « ‹ Boîte de réception » reste collé en haut, touchable`, JSON.stringify(barre));
          await pg.screenshot({ path: path.join(CAPT, `extrait-bas-${nom}.png`) });
        }
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
    // ── (v33) LES ÉTATS : chacun beau, chacun dit le geste. ──────────────────
    for (const sombre of [false, true]) {
      const nom = `états-390-${sombre ? 'sombre' : 'clair'}`;
      await essaie(nom, async () => {
        // Le serveur de liste : la 1re lecture est TENUE (chargement), puis une panne,
        // puis une boîte vide ; un compte sans e-mail ; puis la vraie liste.
        let mode = 'tenue', lacher = null, nPanne = 0;
        const tenue = new Promise((r) => { lacher = r; });
        const vide = { status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: 0, parPage: 20, suite: false, emails: [], compteurs: { sur: 0, plus: false, integre: 0, aVerifier: 0, erreur: 0, incompris: 0, parRubrique: { ventes: 0, achats: 0, codes: 0, colis: 0, autres: 0 } }, adresses: [] }) };
        const liste = (q) => {
          if (mode === 'tenue') return tenue.then(() => ({ status: 500, contentType: 'application/json', body: '{"ok":false}' }));
          if (mode === 'panne') { nPanne++; return { status: 500, contentType: 'application/json', body: '{"ok":false}' }; }
          if (mode === 'vide') return vide;
          if (mode === 'compte' && q.adresse === 'troisieme@exemple.test') return { status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, page: 0, parPage: 20, suite: false, emails: [], compteurs: { ...compteursDe('troisieme@exemple.test') }, adresses: ADRESSES }) };
          return null;
        };
        const { ctx, pg, erreurs, appels } = await ouvrir(nav, { viewport: { width: 390, height: 844 }, tactile: true, sombre, liste });
        const b = pg.locator('[data-boite-emails]');
        // Chargement TENU : des lignes fantômes, occupées, sans texte trompeur.
        const sq = b.locator('[data-boite-chargement]');
        await sq.waitFor({ timeout: 8000 }); await pg.waitForTimeout(400);
        const ch = await sq.evaluate((n) => ({ busy: n.getAttribute('aria-busy'), op: Number(getComputedStyle(n).opacity), lignes: n.querySelectorAll('.vrm-boite-sq-ligne').length, dit: n.innerText.trim() }));
        await pg.screenshot({ path: path.join(CAPT, `etat-chargement-${nom}.png`) });
        dit(ch.busy === 'true' && ch.op > 0.99 && ch.lignes >= 3 && await b.locator('[data-boite-email]').count() === 0, `${nom} : lecture en cours — des lignes fantômes (occupé), aucune ligne inventée`, JSON.stringify(ch));
        // Panne : « — » et la raison, rien n'est perdu, Réessayer.
        mode = 'panne'; lacher();
        const pn = b.locator('[data-boite-etat="panne"]');
        await pn.waitFor({ timeout: 8000 });
        const tp = await pn.innerText();
        const btP = pn.locator('[data-boite-etat-geste="reessayer"]');
        dit(await pn.getAttribute('role') === 'alert' && /—/.test(tp) && /VRM n’a pas pu lire ta boîte|n’a pas répondu|connexion/.test(tp) && /Rien n’est perdu/.test(tp) && await btP.count() === 1 && (await btP.boundingBox()).height >= 44 && !/\b0\b/.test(await b.locator('.vrm-boite-rubriques').innerText()), `${nom} : panne — « — » + la raison, rien n’est perdu, « Réessayer » (44 px), aucun nombre inventé dans les pastilles`, tp.replace(/\n/g, ' | '));
        await pg.screenshot({ path: path.join(CAPT, `etat-panne-${nom}.png`) });
        // Réessayer relit (une requête de plus), et tombe ici sur la boîte vide.
        mode = 'vide'; const avant = journal(appels).length;
        await btP.click();
        const vd = b.locator('[data-boite-etat="vide"]');
        await vd.waitFor({ timeout: 8000 });
        dit(journal(appels).length === avant + 1, `${nom} : « Réessayer » relit la boîte (une lecture, sur SON geste)`);
        const btV = vd.locator('[data-boite-etat-geste="relier"]');
        const cV = await btV.evaluate((n) => { const t = document.createElement('i'); t.style.color = 'var(--vrm-accent)'; document.body.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return [getComputedStyle(n).backgroundColor, c, n.getBoundingClientRect().height]; });
        dit(/vide/.test(await vd.innerText()) && await btV.count() === 1 && cV[0] === cV[1] && cV[2] >= 44, `${nom} : boîte vide — dit quoi faire, LE geste « Relier ma boîte » (le bouton principal, 44 px)`, JSON.stringify(cV));
        await pg.screenshot({ path: path.join(CAPT, `etat-vide-${nom}.png`) });
        await btV.click();
        await pg.locator('[data-relier-boite]').waitFor({ timeout: 5000 });
        dit(await b.getAttribute('data-vue') === 'relier', `${nom} : « Relier ma boîte » ouvre l’accompagnement`);
        // Un compte sans e-mail : le nom du compte, et deux gestes.
        mode = 'compte';
        await b.locator('[data-boite-vue="boite"]').click();
        await b.locator('[data-boite-email]').first().waitFor({ timeout: 8000 });
        await b.locator('[data-boite-adresse]').selectOption('troisieme@exemple.test');
        const cv = b.locator('[data-boite-etat="compte-vide"]');
        await cv.waitFor({ timeout: 8000 });
        const tcv = await cv.innerText();
        dit(/compte-trois/.test(tcv) && /troisieme@exemple\.test/.test(tcv) && await cv.locator('[data-boite-etat-geste="relier"]').count() === 1 && await cv.locator('[data-boite-etat-geste="comptes"]').count() === 1, `${nom} : un compte sans e-mail — son nom, l’adresse où rien n’arrive, « Relier ma boîte » et « Tous les comptes »`, tcv.replace(/\n/g, ' | '));
        await pg.screenshot({ path: path.join(CAPT, `etat-compte-vide-${nom}.png`) });
        await cv.locator('[data-boite-etat-geste="comptes"]').click();
        await b.locator('[data-boite-email]').first().waitFor({ timeout: 8000 });
        dit(await b.locator('[data-boite-adresse]').inputValue() === '', `${nom} : « Tous les comptes » revient à la boîte entière`);
        // « Actualiser » : absent tant que la liste est fraîche, là quand elle a plus d'une minute.
        dit(await b.locator('[data-boite-actualiser]').count() === 0, `${nom} : liste fraîche ⇒ pas d’« Actualiser »`);
        await pg.clock.setFixedTime(MAINTENANT + 3 * 60e3);
        await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        const act = b.locator('[data-boite-actualiser]');
        await act.waitFor({ timeout: 3000 });
        const nAv = journal(appels).length;
        dit((await act.boundingBox()).height >= 44 && /Actualiser/.test(await act.innerText()), `${nom} : la liste a plus d’une minute (retour dans l’app) ⇒ « Actualiser » apparaît (44 px)`);
        await pg.screenshot({ path: path.join(CAPT, `etat-actualiser-${nom}.png`) });
        await act.click();
        await b.locator('[data-boite-email]').first().waitFor({ timeout: 8000 });
        dit(journal(appels).length === nAv + 1 && await b.locator('[data-boite-actualiser]').count() === 0, `${nom} : « Actualiser » relit une fois, puis s’efface (liste fraîche)`);
        const debord = await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        dit(!debord, `${nom} : aucun débordement horizontal (états)`);
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
      // (v33) La lecture s'ouvre sans glisser, les fantômes ne battent pas.
      await pg.locator('[data-boite-vue="boite"]').click();
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
