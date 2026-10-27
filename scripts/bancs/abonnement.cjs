require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « ABONNEMENT » — la carte de Réglages et la porte, RENDUES.
//
//  Demande de Julien (4 octobre) : 9,99 € par mois, pour tout le monde sauf
//  lui — 12,99 € depuis le 11 octobre (sa décision, après l'étude des coûts). Le serveur décide (api/compte.js, vérifié par audit-abonnement.cjs) ;
//  ce banc vérifie que l'app DIT ce que le serveur sait, et rien de plus :
//    · chaque état du serveur donne SA carte (`data-abonnement`) — et un état
//      illisible n'affirme rien (« pas su » ≠ « pas abonné ») ;
//    · le propriétaire ne voit aucun bouton de paiement ;
//    · la porte ne se ferme QUE si la BASE dit « pas d'accès » (`acces`, la
//      règle `vrm_regle_acces` qui ferme aussi ses lignes) — jamais sur une
//      réponse illisible (on ne bloque pas un abonné sur un hoquet), et l'app
//      ne recalcule rien de son côté (§11) ;
//    · un prélèvement en échec depuis plus de 14 jours envoie mettre la carte à
//      jour (le portail), jamais repayer un second abonnement ;
//    · « S'abonner » envoie vers une page Stripe et rien d'autre.
//  ONGLET « MON COMPTE » (Julien, 4 octobre : « un onglet pour gérer
//  l'abonnement et les factures dans les paramètres, avec ses infos de compte
//  regroupées ») :
//    · les Paramètres ont deux onglets ; l'abonnement vit dans « Mon compte » ;
//    · la carte bancaire est dite (marque, 4 derniers chiffres, expiration) ;
//    · les factures sont listées — et « pas su » n'est JAMAIS « aucune facture » ;
//    · un lien de facture qui ne mène pas chez Stripe n'est pas cliquable ;
//    · « Résilier » demande confirmation, part AVEC la session, et la carte dit
//      aussitôt jusqu'à quand l'accès reste ; « Reprendre » l'annule ;
//    · `?vue=compte` (retour de Stripe) ouvre directement le bon onglet.
//  Aucune fixture : comptes et statuts inventés ici (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4538;
const { cspBanc, bilanCsp } = require('./_vercel.cjs');   // CSP de vercel.json servie et observée (22 oct. : Stripe, Mon compte)
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeuse@exemple.test' } };
const PRIX = { montant: 14.99, devise: 'eur', intervalle: 'month' };
// ⚠️ 23 oct. — la forme du VRAI serveur : `mentionsCompletes` est TOUJOURS
//    présent (true · false · null). L'omettre servait un état que le serveur ne
//    rend jamais (§6.3), et l'app doit lire « absent » comme « pas su ».
const base = { ok: true, proprietaire: false, configure: true, modeTest: true, obligatoire: false, prix: PRIX, prixConforme: true, prixStripe: null, statut: null, finPeriode: null, annuleFinPeriode: false, peutGerer: false, actif: false, acces: true, mentionsCompletes: true };
const FACTURES = { ok: true,
  carte: { marque: 'visa', fin: '4242', mois: 12, annee: 2027 },
  factures: [
    { id: 'in_2', numero: 'VRM-0002', date: '2026-10-04T10:00:00.000Z', montant: 12.99, devise: 'eur', statut: 'paid', pdf: 'https://pay.stripe.com/invoice/acct_x/in_2/pdf', page: 'https://invoice.stripe.com/i/acct_x/in_2' },
    { id: 'in_1', numero: 'VRM-0001', date: '2026-09-04T10:00:00.000Z', montant: 12.99, devise: 'eur', statut: 'paid', pdf: 'https://site-pirate.example/facture.pdf', page: null },
  ] };
const ETATS = {
  sans: { ...base },
  actif: { ...base, statut: 'active', finPeriode: '2026-11-04T10:00:00.000Z', peutGerer: true, actif: true },
  resilie: { ...base, statut: 'active', finPeriode: '2026-11-04T10:00:00.000Z', annuleFinPeriode: true, peutGerer: true, actif: true },
  impaye: { ...base, statut: 'past_due', peutGerer: true, actif: true },
  proprietaire: { ...base, proprietaire: true, actif: true },
  nonBranche: { ...base, configure: false, modeTest: null, prix: null, prixConforme: null },
  // 11 octobre : Stripe facture encore l'ancien prix (9,99 €) alors que les CGV
  // disent 12,99 € — le serveur n'ouvre pas le paiement et ne relaie pas ce
  // prix (`prix: null`, `prixConforme: false`) ; seul le propriétaire reçoit le
  // montant de Stripe, pour le corriger.
  prixDifferent: { ...base, prix: null, prixConforme: false },
  proprietairePrixDifferent: { ...base, proprietaire: true, actif: true, prix: null, prixConforme: false, prixStripe: { montant: 9.99, devise: 'eur', intervalle: 'month', texte: '9,99 € / mois' } },
  // 22 octobre : les mentions de l'éditeur sont vides — le serveur n'ouvre pas
  // le paiement (503 `mentions-legales`) ; la liste ne part qu'au propriétaire.
  mentionsVides: { ...base, mentionsCompletes: false },
  proprietaireMentionsVides: { ...base, proprietaire: true, actif: true, mentionsCompletes: false, mentionsManquantes: ['SIRET', 'médiateur de la consommation'] },
  proprietaireMentionsPasSu: { ...base, proprietaire: true, actif: true, mentionsCompletes: null, mentionsManquantes: null, mentionsErreur: "Unexpected identifier 'Exemple'" },
  // 23 oct. (revue) — mentions ILLISIBLES (editeur.js mal écrit : une apostrophe
  // dans une chaîne entre apostrophes). Le serveur REFUSE le paiement (503
  // `mentions-legales`, « pas su » = fermé) : l'écran ne doit rien proposer.
  vendeurMentionsPasSu: { ...base, mentionsCompletes: null },
  // Revue du 11 octobre — ce que le VRAI serveur rend dans les états de la
  // transition (audit-abonnement.cjs exécute api/compte.js) :
  //  · un ANCIEN abonné (résilié, client Stripe) quand le prix diffère : ses
  //    factures restent (sa compta), aucun bouton pour payer ;
  ancienPrixDifferent: { ...base, prix: null, prixConforme: false, statut: 'canceled', peutGerer: true },
  //  · un abonné ACTIF pendant la transition : le serveur ne relaie plus le prix
  //    de l'offre, et le prix de SON abonnement n'a pas pu être lu ⇒ la carte ne
  //    retombe JAMAIS sur le prix des CGV (il paie peut-être 9,99 €) ;
  actifPrixDifferent: { ...base, prix: null, prixConforme: false, statut: 'active', finPeriode: '2026-11-04T10:00:00.000Z', peutGerer: true, actif: true, prixAbonnement: null },
  //  · un abonné souscrit à 9,99 € quand l'offre est passée à 12,99 € : la carte
  //    dit le prix de SON abonnement, pas celui de l'offre ;
  actifAncienPrix: { ...base, statut: 'active', finPeriode: '2026-11-04T10:00:00.000Z', peutGerer: true, actif: true, prixAbonnement: { montant: 9.99, devise: 'eur', intervalle: 'month', texte: '9,99 € / mois' } },
  //  · le propriétaire quand Stripe a un prix en DOLLARS, ou sans montant fixe :
  //    l'alerte écrit le texte du serveur, jamais deux prix identiques ni 0,00 €.
  proprietaireUsd: { ...base, proprietaire: true, actif: true, prix: null, prixConforme: false, prixStripe: { montant: 12.99, devise: 'usd', intervalle: 'month', texte: '12,99 USD / mois' } },
  proprietairePaliers: { ...base, proprietaire: true, actif: true, prix: null, prixConforme: false, prixStripe: { montant: null, devise: 'eur', intervalle: 'month', texte: 'sans montant fixe, par mois' } },
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 160)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// `abo` : la réponse de /api/compte?mode=abonnement — un objet, ou 'panne' (503).
// `fx` : la réponse de ?mode=factures — un objet, ou 'panne' (502).
// `compte` : cliquer l'onglet « Mon compte » après le chargement.
// `fermer` : la réponse de ?mode=fermer — `{ status, body }`.
async function ouvrir(nav, { abo, tab = 'settings', checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_banc', fx = FACTURES, compte = true, onglet = 'abonnement', extra = '', fermer = null, largeur = 1512 }) {
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile });
  await cspBanc(ctx, `http://localhost:${PORT}`, `abonnement ${largeur}`);
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); } catch (_) {} }, SESSION);
  // (21 oct.) Le compte propriétaire sans double vérification voit au démarrage
  // l'écran qui la propose (banc `mfa-proprio.cjs`). Ce banc juge la carte
  // d'abonnement : on note « Plus tard » d'aujourd'hui, comme il le ferait.
  await pg.addInitScript((uid) => { try { localStorage.setItem('vrm_mfa_plus_tard_' + uid, String(Date.now())); } catch (_) {} }, SESSION.user.id);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    // ⚠️ Le faux site est SERVI : s'il ne répondait pas, Chromium afficherait
    //    une page d'erreur à une autre adresse, et le contrôle « jamais suivie »
    //    serait vert sur le défaut (vu sur le code réaffaibli).
    if (/checkout\.stripe\.com|billing\.stripe\.com|site-pirate\.example/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>stripe</body></html>' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = r.request().url();
    if (/select=owner/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/\/api\/compte\?mode=abonnement/.test(u)) {
      return abo === 'panne' ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"erreur":"base-injoignable"}' })
        : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(abo) });
    }
    if (/\/api\/compte\?mode=factures/.test(u)) {
      appels.push({ mode: 'factures', auth: r.request().headers().authorization || '' });
      return fx === 'panne' ? r.fulfill({ status: 502, contentType: 'application/json', body: '{"erreur":"stripe"}' })
        : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fx) });
    }
    if (/\/api\/compte\?mode=(resilier|reprendre)/.test(u)) {
      const mode = /resilier/.test(u) ? 'resilier' : 'reprendre';
      appels.push({ mode, methode: r.request().method(), auth: r.request().headers().authorization || '' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, annuleFinPeriode: mode === 'resilier', finPeriode: '2026-11-04T10:00:00.000Z' }) });
    }
    if (/\/api\/compte\?mode=fermer/.test(u)) {
      appels.push({ mode: 'fermer', methode: r.request().method(), auth: r.request().headers().authorization || '', corps: r.request().postData() || '' });
      const f = fermer || { status: 200, body: { ok: true, message: 'Ton compte VRM est fermé : 3 données effacées.' } };
      return r.fulfill({ status: f.status, contentType: 'application/json', body: JSON.stringify(f.body) });
    }
    if (/\/api\/compte\?mode=(checkout|portail)/.test(u)) {
      appels.push({ mode: /checkout/.test(u) ? 'checkout' : 'portail', auth: r.request().headers().authorization || '', corps: r.request().postData() || '' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: checkoutUrl }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}${extra}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  if (tab === 'settings' && compte) {
    // (17 oct.) L'abonnement a son onglet ; « Mon compte » garde l'identité,
    // la connexion et « Fermer mon compte ».
    let o = pg.locator(`[data-onglets-reglages] [data-vue="${onglet}"]`);
    if (!(await o.count())) o = pg.locator('[data-onglets-reglages] [data-vue="compte"]');
    if (await o.count()) { await o.first().click(); await pg.waitForTimeout(1200); }
  }
  return { ctx, pg, erreurs, appels };
}
const etatCarte = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-abonnement]'); return e ? e.getAttribute('data-abonnement') : null; });
const texteCarte = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-abonnement]'); return e ? e.innerText : ''; });
const boutons = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-abonnement]'); return e ? [...e.querySelectorAll('button')].map((b) => b.innerText.trim()) : []; });

(async () => {
  await new Promise((res, rej) => { srv.once('error', (e) => rej(e)); srv.listen(PORT, res); }).catch((e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    console.log('\n── La carte suit ce que le serveur sait');
    const attendus = { sans: 'sans', actif: 'actif', resilie: 'actif', impaye: 'impaye', proprietaire: 'proprietaire', nonBranche: 'non-branche', prixDifferent: 'non-branche', proprietairePrixDifferent: 'proprietaire',
      ancienPrixDifferent: 'non-branche', actifPrixDifferent: 'actif', actifAncienPrix: 'actif', proprietaireUsd: 'proprietaire', proprietairePaliers: 'proprietaire',
      mentionsVides: 'non-branche', proprietaireMentionsVides: 'proprietaire', proprietaireMentionsPasSu: 'proprietaire', vendeurMentionsPasSu: 'non-branche' };
    for (const [nom, rendu] of Object.entries(attendus)) {
      await essaie(nom, async () => {
        const { ctx, pg, erreurs } = await ouvrir(nav, { abo: ETATS[nom] });
        const e = await etatCarte(pg), b = await boutons(pg), t = await texteCarte(pg);
        dit(e === rendu && erreurs.length === 0, `serveur « ${nom} » → carte « ${rendu} »`, `rendu ${e} ${erreurs.join(' | ')}`);
        if (nom === 'sans') dit(b.some((x) => /abonner/i.test(x)) && /14,99/.test(t), '  sans abonnement : le prix et le bouton pour s’abonner', b.join(' · '));
        // Le prix de Stripe n'est pas celui des CGV : aucun bouton qui mènerait
        // à un refus du serveur, et aucun montant affiché (ni 9,99, ni 12,99 à
        // payer) — « le paiement n'est pas encore ouvert ».
        if (nom === 'prixDifferent') dit(b.length === 0 && !/9,99/.test(t) && /pas encore ouvert/i.test(t), '  prix Stripe ≠ CGV : le paiement est dit fermé, aucun bouton pour payer', b.join(' · ') + ' / ' + t.replace(/\n/g, ' ').slice(0, 120));
        if (nom === 'proprietairePrixDifferent') {
          const w = await pg.evaluate(() => { const e = document.querySelector('[data-prix-stripe="different"]'); return e ? e.innerText : ''; });
          dit(b.length === 0 && /9,99/.test(w) && /14,99/.test(w) && /vrm_mensuel/.test(w), '  propriétaire : le prix réglé chez Stripe et celui des CGV, et le geste (clé « vrm_mensuel »)', w.replace(/\n/g, ' ').slice(0, 200));
        }
        if (nom === 'proprietaire') dit(!(await pg.evaluate(() => !!document.querySelector('[data-prix-stripe]'))), '  propriétaire, prix conforme : aucune alerte de prix');
        // ── 22 octobre : mentions de l'éditeur vides ─────────────────────────
        if (nom === 'mentionsVides') {
          const r = await pg.evaluate(() => { const e = document.querySelector('[data-abonnement]'); return { raison: e && e.getAttribute('data-raison'), sab: !!document.querySelector('[data-sabonner]'), cgv: !!document.querySelector('[data-case-cgv]') }; });
          dit(r.raison === 'mentions' && !r.sab && !r.cgv && b.length === 0 && /pas encore ouvert/i.test(t) && !/SIRET|médiateur|editeur/i.test(t),
            '  mentions vides : le paiement est dit fermé, ni case ni bouton, et aucun détail au vendeur', JSON.stringify(r) + ' / ' + t.replace(/\n/g, ' ').slice(0, 120));
        }
        if (nom === 'vendeurMentionsPasSu') {
          const r = await pg.evaluate(() => { const e = document.querySelector('[data-abonnement]'); return { raison: e && e.getAttribute('data-raison'), sab: !!document.querySelector('[data-sabonner]'), cgv: !!document.querySelector('[data-case-cgv]') }; });
          dit(r.raison === 'mentions' && !r.sab && !r.cgv && b.length === 0 && /pas encore ouvert/i.test(t) && !/14,99/.test(t) && !/editeur|apostrophe/i.test(t),
            '  vendeur, mentions ILLISIBLES (le serveur refuse 503) : paiement dit fermé, ni case ni « S’abonner », aucun prix ni détail', JSON.stringify(r) + ' / ' + b.join(' · ') + ' / ' + t.replace(/\n/g, ' ').slice(0, 120));
        }
        if (nom === 'proprietaireMentionsVides') {
          const w = await pg.evaluate(() => { const e = document.querySelector('[data-mentions-manquantes]'); return e ? { n: e.getAttribute('data-mentions-manquantes'), t: e.innerText } : null; });
          dit(!!w && w.n === '2' && /SIRET/.test(w.t) && /médiateur/.test(w.t) && /editeur\.js/.test(w.t) && /fermé/.test(w.t), '  propriétaire : la liste de ce qui manque et où le remplir', w ? w.t.replace(/\n/g, ' ').slice(0, 200) : 'rien');
        }
        if (nom === 'proprietaireMentionsPasSu') {
          const w = await pg.evaluate(() => { const e = document.querySelector('[data-mentions-manquantes]'); return e ? { n: e.getAttribute('data-mentions-manquantes'), t: e.innerText } : null; });
          dit(!!w && w.n === 'pas-su' && /pas pu relire/.test(w.t), '  propriétaire, mentions illisibles : « pas pu relire », jamais « complet »', w ? w.t : 'rien');
          // 23 oct. (revue) : la cause MESURÉE (l'erreur que le serveur a lue)
          // et la plus probable, avec le fichier à corriger — pas un « pas pu » muet.
          dit(!!w && /editeur\.js/.test(w.t) && /Unexpected identifier 'Exemple'/.test(w.t) && /apostrophe/.test(w.t),
            '  … avec le fichier, l’erreur lue par le serveur et la cause la plus courante (une apostrophe)', w ? w.t.replace(/\n/g, ' ').slice(0, 220) : 'rien');
        }
        if (nom === 'proprietaire') dit(!(await pg.evaluate(() => !!document.querySelector('[data-mentions-manquantes]'))), '  propriétaire, mentions complètes ou pas dites : aucune alerte de mentions');
        // ── Revue du 11 octobre ──────────────────────────────────────────────
        if (nom === 'ancienPrixDifferent') {
          const f = await pg.evaluate(() => { const e = document.querySelector('[data-factures]'); return e ? e.getAttribute('data-factures') : null; });
          const sab = await pg.evaluate(() => !!document.querySelector('[data-sabonner]'));
          dit(f === '2' && !sab && b.length === 0, '  ancien abonné, prix Stripe ≠ CGV : ses factures restent (sa compta), aucun bouton pour payer', `factures=${f} · s’abonner=${sab} · ${b.join(' · ')}`);
        }
        if (nom === 'actifPrixDifferent') dit(/abonné/i.test(t) && !/14,99/.test(t) && !/9,99/.test(t), '  abonné actif, prix de son abonnement pas su : « Abonné » sans montant — jamais le prix des CGV', t.replace(/\n/g, ' ').slice(0, 140));
        if (nom === 'actifAncienPrix') dit(/Abonné · 9,99 € \/ mois/.test(t) && !/14,99/.test(t), '  abonné à 9,99 € quand l’offre est à 14,99 € : la carte dit le prix de SON abonnement', t.replace(/\n/g, ' ').slice(0, 140));
        if (nom === 'proprietaireUsd' || nom === 'proprietairePaliers') {
          const w = await pg.evaluate(() => { const e = document.querySelector('[data-prix-stripe="different"]'); const x = document.querySelector('[data-prix-stripe-texte]'); return { t: e ? e.innerText : '', x: x ? x.innerText : null }; });
          const attendu = ETATS[nom].prixStripe.texte;
          const nCgv = (w.t.match(/14,99 € \/ mois/g) || []).length;
          dit(w.x === attendu && nCgv <= 1 && !/0,00/.test(w.t), `  propriétaire, prix Stripe « ${attendu} » : l’alerte écrit le texte du serveur — jamais deux prix identiques ni 0,00 €`, `texte=${w.x} · « 14,99 € / mois » ×${nCgv} · ${w.t.replace(/\n/g, ' ').slice(0, 160)}`);
        }
        if (nom === 'actif') dit(b.some((x) => /^résilier$/i.test(x)) && b.some((x) => /carte/i.test(x)) && !b.some((x) => /abonner/i.test(x)) && /prochain prélèvement le 4 novembre 2026/i.test(t), '  abonné : la date du prochain prélèvement, « changer de carte » et « résilier », jamais un second « s’abonner »', b.join(' · ') + ' / ' + t.replace(/\n/g, ' ').slice(0, 120));
        if (nom === 'actif') dit(/Visa •••• 4242/.test(t) && /12\/27/.test(t), '  abonné : la carte est dite (marque, 4 derniers chiffres, expiration)', t.replace(/\n/g, ' ').slice(0, 160));
        if (nom === 'resilie') dit(/jusqu'au 4 novembre 2026/.test(t) && b.some((x) => /reprendre/i.test(x)) && !b.some((x) => /^résilier$/i.test(x)), '  résilié : jusqu’à quand l’accès reste, et « reprendre »', b.join(' · ') + ' / ' + t.replace(/\n/g, ' ').slice(0, 120));
        if (nom === 'proprietaire') dit(b.length === 0 && /gratuit/i.test(t), '  propriétaire : gratuit, et AUCUN bouton de paiement', b.join(' · '));
        if (nom === 'nonBranche') dit(b.length === 0, '  paiement pas branché : aucun bouton qui mènerait nulle part', b.join(' · '));
        if (nom === 'sans' || nom === 'actif') dit(/mode test/i.test(t), '  le mode test est dit (aucune vraie carte débitée)');
        await ctx.close();
      });
    }
    await essaie('panne', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: 'panne' });
      const e = await etatCarte(pg), b = await boutons(pg);
      dit(e === 'pas-su' && b.length === 0, 'statut illisible → « pas su », ni « abonné » ni « s’abonner »', `rendu ${e} · ${b.join(' · ')}`);
      await ctx.close();
    });

    console.log('\n── « S’abonner » mène à Stripe, avec la session');
    await essaie('clic', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.sans });
      // Les CGV s'acceptent DANS VRM (6 octobre) : tant que la case n'est pas
      // cochée, le bouton est grisé et rien ne part.
      const bouton = pg.locator('[data-abonnement] button', { hasText: /abonner/i }).first();
      const grise = await bouton.isDisabled().catch(() => false);
      await bouton.click({ force: true, timeout: 2000 }).catch(() => {});
      await pg.waitForTimeout(400);
      dit(grise && !appels.some((a) => a.mode === 'checkout'), 'case des CGV non cochée : « S’abonner » est grisé et aucune demande de paiement ne part', JSON.stringify(appels));
      await pg.locator('[data-abonnement] [data-case-cgv] input').first().check();
      // 22 octobre : la case des CGV SEULE ne suffit pas — la demande d'accès
      // immédiat (art. L221-25) est cochée à côté, dans le même composant.
      const griseUne = await bouton.isDisabled().catch(() => false);
      await bouton.click({ force: true, timeout: 2000 }).catch(() => {});
      await pg.waitForTimeout(400);
      dit(griseUne && !appels.some((a) => a.mode === 'checkout'), 'CGV cochées SANS l’accès immédiat : « S’abonner » reste grisé, rien ne part', JSON.stringify(appels));
      const acces = await pg.evaluate(() => { const e = document.querySelector('[data-abonnement] [data-case-acces-immediat]'); return e ? { t: e.innerText, lien: [...e.querySelectorAll('a')].map((a) => a.getAttribute('href')) } : null; });
      dit(!!acces && /accès immédiat/.test(acces.t) && /période déjà écoulée/.test(acces.t) && acces.lien.includes('/legal/retractation.html'),
        'la case d’accès immédiat dit ce qu’elle engage et mène au formulaire de rétractation', acces ? acces.t.replace(/\n/g, ' ').slice(0, 160) + ' · ' + acces.lien.join(',') : 'absente');
      await pg.locator('[data-abonnement] [data-case-acces-immediat] input').first().check();
      await bouton.click();
      await pg.waitForURL(/checkout\.stripe\.com/, { timeout: 6000 }).catch(() => {});
      dit(appels.some((a) => a.mode === 'checkout' && /"cgv":true/.test(a.corps)), 'case cochée : la demande dit au serveur que les CGV sont acceptées (cgv:true)', JSON.stringify(appels));
      dit(appels.some((a) => a.mode === 'checkout' && /"accesImmediat":true/.test(a.corps)), '… et que l’accès immédiat est demandé (accesImmediat:true)', JSON.stringify(appels));
      dit(appels.some((a) => a.mode === 'checkout' && a.auth === 'Bearer jeton-de-banc'), 'le serveur reçoit la demande AVEC le jeton de session (c’est lui qui sait qui paie)', JSON.stringify(appels));
      dit(/checkout\.stripe\.com/.test(pg.url()), 'la page s’ouvre chez Stripe', pg.url());
      await ctx.close();
    });
    await essaie('url hostile', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.sans, checkoutUrl: 'https://site-pirate.example/payer' });
      await pg.locator('[data-abonnement] [data-case-cgv] input').first().check();
      await pg.locator('[data-abonnement] [data-case-acces-immediat] input').first().check();
      await pg.locator('[data-abonnement] button', { hasText: /abonner/i }).first().click();
      await pg.waitForTimeout(1200);
      dit(!/site-pirate/.test(pg.url()), 'une adresse de paiement qui n’est pas Stripe n’est jamais suivie', pg.url());
      await ctx.close();
    });

    console.log('\n── Trois onglets : « Réglages », « Mon compte » et « Abonnement »');
    await essaie('onglets', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.actif, compte: false });
      const onglets = await pg.evaluate(() => [...document.querySelectorAll('[data-onglets-reglages] [data-vue]')].map((b) => b.innerText.trim()));
      const aboAvant = await etatCarte(pg);
      const reglagesAvant = await pg.evaluate(() => /Comptes Vinted/i.test(document.body.innerText));
      dit(onglets.length === 3 && /réglages/i.test(onglets[0]) && /compte/i.test(onglets[1]) && /abonnement/i.test(onglets[2]), 'les Paramètres ont trois onglets, dont « Abonnement »', onglets.join(' · '));
      dit(!aboAvant && reglagesAvant, '  par défaut « Réglages » : les réglages de l’app, pas l’abonnement', `abonnement=${aboAvant} réglages=${reglagesAvant}`);
      await pg.locator('[data-onglets-reglages] [data-vue="compte"]').click(); await pg.waitForTimeout(1200);
      const apres = await pg.evaluate(() => ({ abo: (document.querySelector('[data-abonnement]') || {}).getAttribute ? document.querySelector('[data-abonnement]').getAttribute('data-abonnement') : null,
        email: /vendeuse@exemple\.test/.test(document.body.innerText), reglages: /Comptes Vinted/i.test(document.body.innerText), mdp: /mot de passe/i.test(document.body.innerText) }));
      dit(!apres.abo && apres.email && apres.mdp && !apres.reglages, '  « Mon compte » regroupe : identité, connexion — ni l’abonnement (son onglet), ni les réglages de l’app', JSON.stringify(apres));
      await pg.locator('[data-onglets-reglages] [data-vue="abonnement"]').click(); await pg.waitForTimeout(1200);
      const abo = await pg.evaluate(() => ({ abo: (document.querySelector('[data-abonnement]') || {}).getAttribute ? document.querySelector('[data-abonnement]').getAttribute('data-abonnement') : null, reglages: /Comptes Vinted/i.test(document.body.innerText), mdp: /Changer mon mot de passe/i.test(document.body.innerText) }));
      dit(abo.abo === 'actif' && !abo.reglages && !abo.mdp, '  « Abonnement » porte la carte de l’abonnement, et elle seule', JSON.stringify(abo));
      await ctx.close();
    });
    await essaie('lien direct', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.actif, compte: false, extra: '&vue=abonnement&abonnement=merci' });
      dit((await etatCarte(pg)) === 'actif', 'le retour de Stripe (`?vue=abonnement&abonnement=merci`) ouvre directement « Abonnement »');
      await ctx.close();
    });

    console.log('\n── Les factures');
    await essaie('liste', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.actif });
      const f = await pg.evaluate(() => { const e = document.querySelector('[data-factures]'); return e ? { etat: e.getAttribute('data-factures'), t: e.innerText, liens: [...e.querySelectorAll('a')].map((a) => a.href) } : null; });
      dit(f && f.etat === '2' && (f.t.match(/12,99/g) || []).length === 2 && /Payée/.test(f.t) && /4 octobre 2026/.test(f.t), 'deux factures : date, montant, statut', f ? f.t.replace(/\n/g, ' ').slice(0, 160) : 'aucune liste');
      dit(f && f.liens.length === 1 && /^https:\/\/pay\.stripe\.com\//.test(f.liens[0]), '  seul le PDF hébergé chez Stripe est un lien — une adresse étrangère ne l’est pas', f ? f.liens.join(' · ') : '');
      dit(appels.some((a) => a.mode === 'factures' && a.auth === 'Bearer jeton-de-banc'), '  demandées AVEC la session (le serveur sait de qui il s’agit)', JSON.stringify(appels.filter((a) => a.mode === 'factures')));
      await ctx.close();
    });
    await essaie('factures illisibles', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.actif, fx: 'panne' });
      const f = await pg.evaluate(() => { const e = document.querySelector('[data-factures]'); return e ? { etat: e.getAttribute('data-factures'), t: e.innerText } : null; });
      dit(f && f.etat === 'pas-su' && !/aucune facture/i.test(f.t), 'Stripe n’a pas répondu → « pas su », jamais « aucune facture »', f ? `${f.etat} · ${f.t.replace(/\n/g, ' ').slice(0, 100)}` : 'rien');
      await ctx.close();
    });
    await essaie('jamais abonné', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.sans });
      const f = await pg.evaluate(() => !!document.querySelector('[data-factures]'));
      dit(!f && !appels.some((a) => a.mode === 'factures'), 'jamais abonné : pas de liste de factures, et rien n’est demandé à Stripe');
      await ctx.close();
    });

    console.log('\n── Résilier, reprendre');
    await essaie('résilier : on change d’avis', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.actif });
      await pg.locator('[data-abonnement] button', { hasText: /^Résilier$/ }).first().click(); await pg.waitForTimeout(600);
      const garder = pg.getByRole('button', { name: 'Garder mon abonnement' });
      const vu = await garder.count();
      if (vu) { await garder.first().click(); await pg.waitForTimeout(600); }
      dit(vu > 0 && !appels.some((a) => a.mode === 'resilier'), '« Résilier » demande confirmation ; « Garder » n’envoie RIEN', JSON.stringify(appels.filter((a) => a.mode !== 'factures')));
      await ctx.close();
    });
    await essaie('résilier', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.actif });
      await pg.locator('[data-abonnement] button', { hasText: /^Résilier$/ }).first().click(); await pg.waitForTimeout(600);
      const conf = await pg.evaluate(() => document.body.innerText);
      dit(/4 novembre 2026/.test(conf) && /aucun autre prélèvement/i.test(conf), '  la confirmation dit jusqu’à quand l’accès reste, et qu’aucun prélèvement ne suit');
      // Le bouton de la fenêtre de confirmation : celui qui suit « Garder mon
      // abonnement » (la carte porte aussi un « Résilier », sous le voile).
      await pg.locator('button', { hasText: 'Garder mon abonnement' }).locator('xpath=following-sibling::button[1]').click(); await pg.waitForTimeout(1200);
      const a = appels.find((x) => x.mode === 'resilier');
      dit(a && a.methode === 'POST' && a.auth === 'Bearer jeton-de-banc', '  confirmé : la demande part, AVEC la session', JSON.stringify(a || null));
      const t = await texteCarte(pg), b = await boutons(pg);
      dit(/jusqu'au 4 novembre 2026/.test(t) && b.some((x) => /reprendre/i.test(x)), '  la carte dit aussitôt « résilié » et propose de reprendre', b.join(' · ') + ' / ' + t.replace(/\n/g, ' ').slice(0, 120));
      await ctx.close();
    });
    await essaie('reprendre', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.resilie });
      await pg.locator('[data-abonnement] button', { hasText: /reprendre/i }).first().click(); await pg.waitForTimeout(1200);
      const t = await texteCarte(pg);
      dit(appels.some((a) => a.mode === 'reprendre' && a.auth === 'Bearer jeton-de-banc') && /prochain prélèvement/i.test(t), '« Reprendre » annule la résiliation : la carte redit le prochain prélèvement', t.replace(/\n/g, ' ').slice(0, 120));
      await ctx.close();
    });

    console.log('\n── La porte');
    await essaie('porte fermée', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: { ...ETATS.sans, obligatoire: true, acces: false }, tab: 'journee' });
      const porte = await pg.evaluate(() => !!document.querySelector('[data-abonnement-requis]'));
      const appVisible = await pg.evaluate(() => /Bonjour|Bonsoir|Bon après-midi/.test(document.body.innerText));
      dit(porte && !appVisible, 'obligatoire + pas abonné → l’écran d’abonnement, pas l’app');
      const t = await pg.evaluate(() => (document.querySelector('[data-abonnement-requis]') || {}).innerText || '');
      dit(/14,99/.test(t) && /déconnecter/i.test(t), '  il dit le prix et laisse se déconnecter', t.replace(/\n/g, ' ').slice(0, 120));
      await ctx.close();
    });
    // 22 octobre : la porte vend aussi l'abonnement — les DEUX cases (CGV et
    // accès immédiat), le même composant que la carte (§11).
    await essaie('porte : deux cases', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: { ...ETATS.sans, obligatoire: true, acces: false }, tab: 'journee' });
      const bouton = pg.locator('[data-abonnement-requis] [data-sabonner]').first();
      await pg.locator('[data-abonnement-requis] [data-case-cgv] input').first().check();
      const griseUne = await bouton.isDisabled().catch(() => false);
      await pg.locator('[data-abonnement-requis] [data-case-acces-immediat] input').first().check();
      const actif = !(await bouton.isDisabled().catch(() => true));
      await bouton.click();
      await pg.waitForURL(/checkout\.stripe\.com/, { timeout: 6000 }).catch(() => {});
      dit(griseUne && actif && appels.some((a) => a.mode === 'checkout' && /"cgv":true/.test(a.corps) && /"accesImmediat":true/.test(a.corps)),
        '  porte : grisé avec la seule case des CGV ; les deux cochées, la demande porte cgv ET accesImmediat', JSON.stringify(appels));
      await ctx.close();
    });
    // ⚠️ REVUE DU 11 OCTOBRE : la porte — second écran qui vend l'abonnement —
    //    proposait « S'abonner » (case des CGV, 12,99 € / mois) quand le paiement
    //    est FERMÉ (prix Stripe ≠ CGV) : le clic menait au refus 503 du serveur,
    //    qui nommait par-dessus le montant de Stripe (9,99 €) à un vendeur. Elle
    //    ne propose plus rien, ne dit aucun prix, et laisse se déconnecter.
    for (const largeur of [1512, 390]) {
      for (const [nom, abo] of [
        ['prix Stripe ≠ CGV', { ...ETATS.prixDifferent, obligatoire: true, acces: false }],
        ['Stripe pas branché', { ...ETATS.nonBranche, obligatoire: true, acces: false }],
        ['mentions légales vides', { ...ETATS.mentionsVides, obligatoire: true, acces: false }],
        // 23 oct. (revue) : « pas su » côté serveur = fermé (503) ; la porte aussi.
        ['mentions légales ILLISIBLES (pas su)', { ...ETATS.vendeurMentionsPasSu, obligatoire: true, acces: false }],
      ]) {
        await essaie(`porte paiement fermé ${nom} ${largeur}`, async () => {
          const { ctx, pg, appels, erreurs } = await ouvrir(nav, { abo, tab: 'journee', largeur });
          const r = await pg.evaluate(() => {
            const p = document.querySelector('[data-abonnement-requis]');
            return p ? { t: p.innerText, sab: !!p.querySelector('[data-sabonner]'), cgv: !!p.querySelector('[data-case-cgv]'), boutons: [...p.querySelectorAll('button')].map((b) => b.innerText.trim()),
              debord: document.documentElement.scrollWidth > document.documentElement.clientWidth } : null;
          });
          dit(!!r && !r.sab && !r.cgv && !r.boutons.some((x) => /abonner|payer/i.test(x)) && erreurs.length === 0,
            `porte, ${nom} (${largeur} px) : ni case des CGV ni « S’abonner » — le serveur refuserait`, r ? r.boutons.join(' · ') : 'pas de porte');
          dit(!!r && !/9,99/.test(r.t) && !/14,99/.test(r.t) && /pas encore ouvert/i.test(r.t) && /rien n'a été prélevé/i.test(r.t) && /intactes/.test(r.t) && /déconnecter/i.test(r.t) && !r.debord,
            '  elle dit que le paiement n’est pas ouvert et que rien n’a été prélevé, sans aucun prix, et laisse se déconnecter', r ? r.t.replace(/\n/g, ' ').slice(0, 180) : '');
          dit(!appels.some((a) => a.mode === 'checkout'), '  et aucune demande de paiement ne part', JSON.stringify(appels));
          await ctx.close();
        });
      }
    }
    await essaie('impayé 14 jours', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: { ...ETATS.impaye, obligatoire: true, acces: false }, tab: 'journee' });
      const porte = await pg.evaluate(() => !!document.querySelector('[data-abonnement-requis]'));
      const t = await pg.evaluate(() => (document.querySelector('[data-abonnement-requis]') || {}).innerText || '');
      dit(porte && /14 jours/.test(t) && /intactes/.test(t), 'impayé depuis plus de 14 jours → la porte, qui dit pourquoi et que rien n’est perdu', t.replace(/\n/g, ' ').slice(0, 140));
      await pg.locator('[data-abonnement-requis] button', { hasText: /carte/i }).first().click();
      await pg.waitForTimeout(1200);
      dit(appels.some((a) => a.mode === 'portail') && !appels.some((a) => a.mode === 'checkout'), '  le bouton met la CARTE à jour (portail) — jamais un second abonnement', JSON.stringify(appels));
      await ctx.close();
    });
    await essaie('la base décide', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: { ...ETATS.actif, obligatoire: true, acces: false }, tab: 'journee' });
      const porte = await pg.evaluate(() => !!document.querySelector('[data-abonnement-requis]'));
      dit(porte, 'la porte suit la réponse de la BASE (`acces`), pas un recalcul à partir du statut');
      await ctx.close();
    });
    for (const [nom, abo] of [
      ['obligatoire + abonné', { ...ETATS.actif, obligatoire: true }],
      ['obligatoire + impayé (Stripe réessaie)', { ...ETATS.impaye, obligatoire: true }],
      ['obligatoire + propriétaire', { ...ETATS.proprietaire, obligatoire: true }],
      ['pas obligatoire + pas abonné', ETATS.sans],
      ['statut illisible', 'panne'],
    ]) {
      await essaie(nom, async () => {
        const { ctx, pg } = await ouvrir(nav, { abo, tab: 'journee' });
        const porte = await pg.evaluate(() => !!document.querySelector('[data-abonnement-requis]'));
        dit(!porte, `${nom} → l’app reste ouverte`);
        await ctx.close();
      });
    }
    // ── FERMER MON COMPTE + CONTACT (5 octobre) ──────────────────────────────
    // La politique de confidentialité promet l'effacement ; le bouton manquait.
    // Le serveur décide et dit ce qu'il a fait (audit-fermer-compte.cjs) ; ici
    // on vérifie que l'écran dit CE QUE LE SERVEUR DIT, rien de plus.
    console.log('\n── « Fermer mon compte » et le contact (onglet Mon compte)');
    const ouvrirFermer = async (pg) => { const b = pg.locator('[data-fermer-compte] button[aria-expanded]'); if (await b.count()) { await b.first().click(); await pg.waitForTimeout(900); } };
    const etatFermer = (pg) => pg.evaluate(() => { const e = document.querySelector('[data-fermer-compte] [data-fermer-etat]'); return e ? e.getAttribute('data-fermer-etat') : null; });
    await essaie('contact', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.actif, onglet: 'compte' });
      // (un banc ne meurt pas : sans src/contact.js — le code d'avant — la ligne
      //  Contact est simplement absente, et le contrôle le dit en rouge)
      let constante = ''; try { constante = ((/CONTACT_EMAIL\s*=\s*'([^']*)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'contact.js'), 'utf8')) || [])[1] || '').trim(); } catch (_) { constante = ''; }
      const c = await pg.evaluate(() => { const e = document.querySelector('[data-contact]'); return e ? { t: e.innerText, absent: !!e.querySelector('[data-contact-absent]'), mail: (e.querySelector('a[href^="mailto:"]') || {}).href || '' } : null; });
      dit(!!c && (constante ? c.mail === `mailto:${constante}` : (c.absent && /à venir/.test(c.t) && !c.mail)), `une ligne Contact dans « Mon compte » — ${constante ? 'l’adresse de src/contact.js' : '« à venir », aucune adresse inventée'}`, c ? c.t : 'absente');
      await ctx.close();
    });
    await essaie('fermer : vendeur', async () => {
      const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.actif, onglet: 'compte' });
      dit(await pg.evaluate(() => !!document.querySelector('[data-fermer-compte]')), '« Fermer mon compte » existe dans Mon compte');
      await ouvrirFermer(pg);
      dit((await etatFermer(pg)) === 'possible', 'un vendeur abonné peut fermer son compte');
      const btn = pg.locator('[data-fermer-bouton]');
      dit(await btn.isDisabled(), 'le bouton reste désactivé tant que l’adresse n’est pas recopiée');
      await pg.fill('[data-fermer-confirmation]', 'autre@exemple.test'); await pg.waitForTimeout(200);
      dit(await btn.isDisabled(), '… et avec une AUTRE adresse aussi');
      await pg.fill('[data-fermer-confirmation]', 'Vendeuse@Exemple.test'); await pg.waitForTimeout(200);
      dit(!(await btn.isDisabled()), '… et s’active avec SA propre adresse (majuscules indifférentes)');
      await btn.click(); await pg.waitForTimeout(1200);
      const a = appels.find((x) => x.mode === 'fermer');
      dit(!!a && a.methode === 'POST' && /^Bearer jeton-de-banc$/.test(a.auth) && /"confirmation":"Vendeuse@Exemple.test"/.test(a.corps), 'la demande part en POST, AVEC la session et l’adresse recopiée (le serveur la revérifie)', a ? `${a.methode} ${a.corps}` : 'aucune demande');
      const res = await pg.evaluate(() => { const e = document.querySelector('[data-fermer-resultat]'); return e ? { etat: e.getAttribute('data-fermer-resultat'), t: e.innerText } : null; });
      dit(!!res && res.etat === 'ferme' && /fermé/.test(res.t), 'le serveur dit « fermé » ⇒ l’écran le dit, avec ce que le serveur a fait', res && res.t.slice(0, 90));
      await ctx.close();
    });
    await essaie('fermer : incomplet', async () => {
      const message = 'Fermeture INCOMPLÈTE. Fait : 3 données effacées. Pas encore effacé : tes comptes Vinted, ton compte de connexion.';
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.sans, onglet: 'compte', fermer: { status: 502, body: { ok: false, message } } });
      await ouvrirFermer(pg);
      await pg.fill('[data-fermer-confirmation]', 'vendeuse@exemple.test'); await pg.waitForTimeout(200);
      await pg.locator('[data-fermer-bouton]').click(); await pg.waitForTimeout(1200);
      const res = await pg.evaluate(() => { const e = document.querySelector('[data-fermer-resultat]'); return e ? { etat: e.getAttribute('data-fermer-resultat'), t: e.innerText } : null; });
      dit(!!res && res.etat === 'incomplet' && res.t.includes('comptes Vinted') && !/Retour à l'accueil/.test(res.t), 'un échec à mi-chemin : l’écran dit ce qui reste, jamais « fermé »', res && res.t.slice(0, 120));
      await ctx.close();
    });
    await essaie('fermer : propriétaire', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.proprietaire, onglet: 'compte' });
      await ouvrirFermer(pg);
      const b = await pg.evaluate(() => !!document.querySelector('[data-fermer-bouton]'));
      dit((await etatFermer(pg)) === 'proprietaire' && !b, 'le propriétaire de l’installation : expliqué, AUCUN bouton (sa boutique ne s’efface pas d’un clic)');
      await ctx.close();
    });
    await essaie('fermer : pas su', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: 'panne', onglet: 'compte' });
      await ouvrirFermer(pg);
      const b = await pg.evaluate(() => !!document.querySelector('[data-fermer-bouton]'));
      dit((await etatFermer(pg)) === 'pas-su' && !b, 'compte illisible : aucun bouton tant qu’on ne sait pas s’il est le propriétaire');
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 160)); }
  finally {
    await nav.close(); srv.close();
    ko += bilanCsp();
    console.log(ko ? `\n❌ abonnement (rendu) : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ abonnement (rendu) : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
