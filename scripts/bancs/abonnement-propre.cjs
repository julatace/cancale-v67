require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « ABONNEMENT PROPRE » (8 nov.) — la page Abonnement, la ligne de la
//  coque et la lecture seule, RENDUES, avec un faux serveur (aucun Stripe réel).
//    · essai J-5 : la page dit « Encore 5 jours », la coque se tait ;
//    · essai J-3 et J-1 : une ligne discrète dans la coque (« dans 3 jours »,
//      « demain »), qui ouvre l'abonnement et se ferme pour la journée ;
//    · sans abonnement (Julien, 8 nov., puis 25 nov. : « Il voit 5 ventes et 5
//      annonces ») : sur Ventes et Annonces (données du mode exemple), les 5
//      premières lignes NETTES, la suite FLOUTÉE ; ailleurs 3 par liste ; `inert`
//      et `aria-hidden`, ni sélectionnables ; UNE carte là où le flou commence
//      (compteur lu, séquence, prix, « Débloquer tout ») ; tout clic dans l'écran
//      ramène à elle ; AUCUNE écriture n’atteint la base ; l'essai gratuit est net ;
//      le retour de Stripe défloute sur place ;
//    · expiré sans la 027 : l'ancienne porte (jamais une app vide) ;
//    · actif · résilié · impayé · Stripe absent : chacun son état, aucun
//      bouton qui mènerait nulle part quand Stripe n'est pas branché ;
//    · le parrainage : le lien et « 2 inscrits, 1 a payé » — des nombres ;
//    · 390 px tactile et 1512 px, clair et sombre : rien ne déborde.
//  Aucune fixture : tout est inventé ici (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4541;
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'banc-abonnement-propre');
fs.mkdirSync(CAPTURES, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const SESSION_BANC = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeuse@exemple.test' } };
const J = 864e5;
const finDans = (j) => new Date(Date.now() + j * J - 3600e3).toISOString();
const PRIX = { montant: 16.99, devise: 'eur', intervalle: 'month' };
const base = { ok: true, proprietaire: false, configure: true, modeTest: true, obligatoire: true, prix: PRIX, prixConforme: true, prixStripe: null, statut: null, finPeriode: null, annuleFinPeriode: false, peutGerer: false, actif: false, acces: true, lecture: true, lectureSeule: false, mentionsCompletes: true, essaiDispo: false, essaiJours: 7, prixAbonnement: null };
const ABO = { montant: 16.99, devise: 'eur', intervalle: 'month', texte: '16,99 € / mois' };
const essai = (j, extra = {}) => ({ ...base, statut: 'trialing', finPeriode: finDans(j), finEssai: finDans(j), peutGerer: true, actif: true, prixAbonnement: ABO, ...extra });
const ETATS = {
  essai5: essai(5), essai3: essai(3), essai1: essai(1), essai1Resilie: essai(1, { annuleFinPeriode: true }),
  actif: { ...base, statut: 'active', finPeriode: finDans(20), peutGerer: true, actif: true, prixAbonnement: ABO },
  resilie: { ...base, statut: 'active', finPeriode: finDans(20), annuleFinPeriode: true, peutGerer: true, actif: true, prixAbonnement: ABO },
  impaye: { ...base, statut: 'past_due', peutGerer: true, actif: true },
  expire: { ...base, statut: 'canceled', peutGerer: true, acces: false, lecture: true, lectureSeule: true },
  expireSans027: { ...base, statut: 'canceled', peutGerer: true, acces: false, lecture: false },
  stripeAbsent: { ...base, configure: false, modeTest: null, prix: null, prixConforme: null, obligatoire: false },
};
const FACTURES = { ok: true, carte: { marque: 'visa', fin: '4242', mois: 12, annee: 2027 }, factures: [{ id: 'in_1', numero: 'VRM-0001', date: '2026-10-04T10:00:00.000Z', montant: 16.99, devise: 'eur', statut: 'paid', pdf: 'https://pay.stripe.com/invoice/x/in_1/pdf', page: null }] };
const PARRAIN = { ok: true, installe: true, ouvert: true, code: 'K7MQ4RZP', suivi: { inscrits: 2, payes: 1, moisOfferts: 1, enAttente: 0 }, filleul: { parraine: false, moisOffert: false } };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 160)); } };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

// Les données inventées du mode exemple (src/exempleDonnees.js), servies par
// la MÊME règle de table que lui (src/exempleBase.js) : des listes à plus de
// 3 lignes, à la vraie forme, pour juger l'aperçu.
let EX = null;
async function exemple() {
  if (EX) return EX;
  const d = await import('file://' + path.join(__dirname, '..', '..', 'src', 'exempleDonnees.js'));
  const b = await import('file://' + path.join(__dirname, '..', '..', 'src', 'exempleBase.js'));
  const jeu = d.jeuExemple(Date.now());
  EX = { uid: d.UID_EXEMPLE, servir: b.servirTable, base: { lignes: jeu.lignes }, comptes: { lignes: jeu.comptes } };
  return EX;
}
// (12 nov.) `nouveau` : un compte NEUF (« Tu vends quoi ? » pas encore fait). Depuis le 9-11 nov., ce compte
// voit d'abord Ma configuration puis le parcours d'arrivée en plein écran : les essais d'un vendeur EN COURS
// d'abonnement (J-5, J-3, J-1, résilier…) sont joués par un vendeur qui a déjà fait sa configuration (la forme
// réelle d'un abonné depuis plusieurs jours) ; le compte neuf a son propre essai (« le compte neuf voit l'offre »).
async function ouvrir(nav, { abo, tab = 'settings', largeur = 1512, sombre = false, vue = 'abonnement', parrain = PARRAIN, donnees = false, nouveau = false, suite = '', reduit = false }) {
  const ex = donnees ? await exemple() : null;
  const SESSION = ex ? { ...SESSION_BANC, user: { ...SESSION_BANC.user, id: ex.uid } } : SESSION_BANC;
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light', reducedMotion: reduit ? 'reduce' : 'no-preference' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(({ s, vue, sombre, nouveau }) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); if (vue) localStorage.setItem('vrm_reglages_vue', vue); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); if (!nouveau) { localStorage.setItem('vrm_configuration', JSON.stringify({ etat: 'fait', at: '2026-11-01T10:00:00.000Z', statut: null, version: 1 })); localStorage.setItem('vrm_parcours_plus_tard', (() => { const t = new Date().toISOString(); return JSON.stringify({ extension: t, emails: t, vinted: t, premiere: t, configuration: t }); })()); } } catch (_) {} }, { s: SESSION, vue, sombre, nouveau });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue());
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  const rest = { lectures: 0, ecritures: 0, origine: '' };
  await pg.route('**/rest/v1/**', (r) => {
    const u = r.request().url(), m = r.request().method();
    if (!rest.origine) rest.origine = new URL(u).origin;
    if (m === 'GET') rest.lectures++; else if (!/\/rpc\//.test(u)) rest.ecritures++;
    if (ex && !/\/rpc\//.test(u)) {
      const url = new URL(u), table = url.pathname.slice('/rest/v1/'.length).split('/')[0];
      const t = table === 'app_data' ? ex.base : table === 'vinted_accounts' ? ex.comptes : { lignes: [] };
      const x = ex.servir(t, { methode: m, url: url.pathname + url.search, entetes: r.request().headers(), corps: r.request().postData(), owner: ex.uid });
      return r.fulfill({ status: x.status, headers: x.headers, body: x.status === 204 || x.body == null ? '' : (typeof x.body === 'string' ? x.body : JSON.stringify(x.body)) });
    }
    if (/select=owner/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    // (12 nov.) Une écriture (POST/PATCH) est ACCEPTÉE et rendue telle quelle, comme PostgREST avec
    // `return=representation` : sans ça, « Plus tard » de Ma configuration attendait sa confirmation sans fin
    // (le compte neuf restait devant « Enregistrement… »). Aucune écriture n'est gardée : rien n'est relu.
    if (m !== 'GET' && !/\/rpc\//.test(u)) {
      let rows = []; try { const b = JSON.parse(r.request().postData() || '[]'); rows = Array.isArray(b) ? b : [{ id: (/id=eq\.([^&]+)/.exec(u) || [])[1] || 'main', ...b }]; } catch (_) {}
      return r.fulfill({ status: m === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify(rows) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(typeof abo === 'function' ? abo() : abo) });
    if (/mode=factures/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FACTURES) });
    if (/mode=parrainage/.test(u)) { appels.push({ mode: 'parrainage', m: r.request().method(), corps: r.request().postData() || '' }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(parrain) }); }
    if (/mode=(checkout|portail)/.test(u)) { appels.push({ mode: /checkout/.test(u) ? 'checkout' : 'portail', corps: r.request().postData() || '' }); return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Paiement de banc : rien ne part.' }) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}${suite}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3800);
  // (12 nov.) Machine lente : la page Abonnement peut encore dire « Je regarde… » à 3,8 s — on attend
  // qu'elle ait LU son état (10 s au plus), jamais un délai de plus à l'aveugle.
  await pg.waitForFunction(() => { const w = document.querySelector('[data-abonnement]'); return !w || w.getAttribute('data-abonnement') !== 'chargement'; }, null, { timeout: 10000 }).catch(() => {});
  return { ctx, pg, erreurs, appels, rest };
}
const lirePage = (pg) => pg.evaluate(() => {
  const w = document.querySelector('[data-abonnement]');
  const b = document.querySelector('[data-bandeau-abonnement]');
  return {
    etat: w && w.getAttribute('data-abonnement'), fin: w && w.getAttribute('data-abonnement-etat'), jours: w && w.getAttribute('data-essai-jours'),
    texte: w ? w.innerText : '', boutons: w ? [...w.querySelectorAll('button')].map((x) => x.innerText.trim()) : [],
    bandeau: b ? { type: b.getAttribute('data-bandeau-abonnement'), seuil: b.getAttribute('data-seuil'), t: b.innerText } : null,
    porte: !!document.querySelector('[data-abonnement-requis]'), coque: !!document.querySelector('.vrm-app-shell'),
    deborde: document.documentElement.scrollWidth - window.innerWidth,
  };
});
const capture = (pg, nom) => pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }).catch(() => {});

(async () => {
  await new Promise((res, rej) => { srv.once('error', rej); srv.listen(PORT, res); }).catch((e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ')'); process.exit(1); });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    const SEUL = process.env.BANC_SEUL || '';
    if (!SEUL) {
    console.log('\n── L’essai');
    await essaie('J-5', async () => {
      const { ctx, pg, erreurs } = await ouvrir(nav, { abo: ETATS.essai5 });
      const p = await lirePage(pg);
      dit(p.fin === 'essai' && p.jours === '5' && /Encore 5 jours d'essai/.test(p.texte) && /16,99\s€ \/ mois/.test(p.texte) && /sauf si tu résilies avant/.test(p.texte) && erreurs.length === 0, 'J-5 : la page dit les jours restants, le prix qui suivra et qu’on peut résilier avant', `${p.fin} · ${p.jours} · ${p.texte.replace(/\n/g, ' ').slice(0, 160)} ${erreurs.join('|')}`);
      dit(!p.bandeau, '  J-5 : la coque se tait', JSON.stringify(p.bandeau));
      dit(p.boutons.includes('Résilier') && p.boutons.some((x) => /Gérer chez Stripe/.test(x)), '  « Résilier » (2 clics : la rangée, puis la confirmation) et « Gérer chez Stripe »', p.boutons.join(' · '));
      await capture(pg, 'essai-j5-1512'); await ctx.close();
    });
    for (const [nom, j, seuil, re] of [['essai3', 3, 'j3', /dans 3\s*jours/], ['essai1', 1, 'j1', /demain/]]) {
      await essaie(nom, async () => {
        const { ctx, pg } = await ouvrir(nav, { abo: ETATS[nom], tab: 'dashboard', vue: 'reglages', largeur: 390 });
        const p = await lirePage(pg);
        dit(p.bandeau && p.bandeau.type === 'essai' && p.bandeau.seuil === seuil && re.test(p.bandeau.t) && /16,99/.test(p.bandeau.t), `J-${j} : une ligne discrète dans la coque (« ${re.source} »)`, JSON.stringify(p.bandeau));
        dit(p.deborde <= 0, `  390 px : rien ne déborde`, String(p.deborde));
        await capture(pg, `essai-j${j}-390`);
        await pg.locator('[data-bandeau-abonnement] button', { hasText: 'Gérer' }).first().click(); await pg.waitForTimeout(1500);
        const q = await lirePage(pg);
        dit(q.etat === 'actif' && q.fin === 'essai', '  « Gérer » ouvre la page Abonnement', `${q.etat} · ${q.fin}`);
        await pg.locator('[data-bandeau-abonnement] [aria-label^="Masquer"]').first().click().catch(() => {}); await pg.waitForTimeout(400);
        dit(!(await lirePage(pg)).bandeau, '  ×  la masque pour la journée');
        await ctx.close();
      });
    }
    await essaie('essai résilié', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.essai1Resilie });
      const p = await lirePage(pg);
      dit(p.fin === 'essai-resilie' && /rien ne sera prélevé/i.test(p.texte) && p.boutons.some((x) => /Reprendre/.test(x)) && !p.boutons.includes('Résilier'), 'essai résilié : « rien ne sera prélevé », et « Reprendre »', p.texte.replace(/\n/g, ' ').slice(0, 160));
      dit(p.bandeau && /Rien ne sera prélevé/.test(p.bandeau.t), '  la coque le redit à J-1', JSON.stringify(p.bandeau));
      await ctx.close();
    });

    }
    console.log('\n── Sans abonnement (25 nov.) : 5 ventes et 5 annonces nettes, le reste flouté, UNE carte, aucune action');
    const lireApercu = (pg, tab) => pg.evaluate((tab) => {
      const r = document.querySelector('[data-attente-ecran="' + tab + '"]');
      if (!r) return null;
      const fl = [...r.querySelectorAll('[data-apercu-floute]')];
      const vis = (e) => e.getClientRects().length > 0;
      // Les lignes jugées par la RÈGLE (data-*), jamais par un libellé : nettes, et lignes floutées VISIBLES.
      const nettes = [...r.querySelectorAll('[data-apercu-nette]')].filter(vis);
      const debut = r.querySelector('[data-apercu-debut]');
      // Une liste « extrait » d'un autre écran : ses 3 premières lignes nettes, la 4e floutée.
      const listes = [...r.querySelectorAll('*')].filter((e) => e.children.length >= 4 && e.children[3].hasAttribute('data-apercu-floute'));
      const extrait = listes.filter((e) => [0, 1, 2].every((i) => !e.children[i].hasAttribute('data-apercu-floute') && !e.children[i].closest('[data-apercu-floute]')));
      const echantillon = fl.map((e) => (e.innerText || '').trim()).find((t) => t.length > 6) || '';
      const s = fl[0] ? getComputedStyle(fl[0]) : null;
      document.getSelection().removeAllRanges();
      const plage = document.createRange(); plage.selectNodeContents(r); document.getSelection().addRange(plage);
      const choisi = document.getSelection().toString(); document.getSelection().removeAllRanges();
      const carte = document.querySelector('[data-carte-apercu]');
      const porteur = carte && carte.closest('[data-apercu-garde]');
      // La carte est là où le flou commence : juste avant la 1re ligne floutée (dans le fil), ou posée sur elle
      // (liste virtuelle), sinon juste après la dernière ligne nette.
      let place = 'ailleurs';
      if (porteur && debut) {
        const pr = porteur.getBoundingClientRect(), dr = debut.getBoundingClientRect();
        if (porteur.nextElementSibling === debut || Math.abs(pr.top - dr.top) < 2) place = 'debut-du-flou';
      } else if (porteur && nettes.length) {
        const der = nettes[nettes.length - 1]; if (der.nextElementSibling === porteur || (porteur.compareDocumentPosition(der) & Node.DOCUMENT_POSITION_PRECEDING)) place = 'apres-les-nettes';
      }
      const dessus = (() => { if (!carte) return false; const b = carte.querySelector('[data-apercu-debloquer]'); if (!b) return false; b.scrollIntoView({ block: 'center' }); const x = b.getBoundingClientRect(); const d = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return !!d && (d === b || b.contains(d)); })();
      return {
        apercu: r.hasAttribute('data-apercu'), floutes: fl.length, nettes: nettes.length, nettesPhoto: nettes.filter((e) => e.querySelector('img, [class*="photo"], [class*="vignette"]')).length,
        debut: !!debut, place, listes: listes.length, extraits: extrait.length,
        nettesTexte: nettes.slice(0, 5).map((e) => (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 30)),
        inertes: fl.every((e) => e.hasAttribute('inert') && e.getAttribute('aria-hidden') === 'true'),
        flou: s ? s.filter : '', selection: s ? (s.userSelect || s.webkitUserSelect) : '',
        echantillon: echantillon.slice(0, 30), copiable: !!echantillon && choisi.includes(echantillon.slice(0, 12)),
        cartes: document.querySelectorAll('[data-carte-apercu]').length, carte: carte ? carte.innerText : '', boutonLibre: dessus,
        boutons: carte ? [...carte.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean) : [],
        compteur: carte ? carte.hasAttribute('data-apercu-compteur') : false, anim: !!(carte && carte.querySelector('[data-apercu-anim]')), scenes: carte ? carte.querySelectorAll('[data-apercu-scene]').length : 0,
        prixSolo: ((carte && carte.querySelector('[data-apercu-prix-solo]')) || {}).innerText || '', prixPro: ((carte && carte.querySelector('[data-apercu-prix-pro]')) || {}).innerText || '',
        porte: !!document.querySelector('[data-abonnement-requis]'), coque: !!document.querySelector('.vrm-app-shell'),
        deborde: document.documentElement.scrollWidth - window.innerWidth,
      };
    }, tab);
    const ECRANS = [['ventes', 1512, false], ['ventes', 1512, true], ['ventes', 390, false], ['ventes', 390, true], ['annonces', 1512, false], ['annonces', 1512, true], ['annonces', 390, false], ['annonces', 390, true], ['achats', 1512, false], ['dashboard', 1512, true]];
    for (const [tab, largeur, sombre] of ECRANS) {
      if (SEUL && !SEUL.split(',').includes(tab)) continue;
      await essaie(`aperçu ${tab} ${largeur}${sombre ? ' sombre' : ''}`, async () => {
        const { ctx, pg, rest, erreurs, appels } = await ouvrir(nav, { abo: ETATS.expire, tab, vue: 'reglages', largeur, sombre, donnees: true });
        await pg.waitForSelector('[data-carte-apercu] [data-apercu-scene]', { timeout: 12000 }).catch(() => {}); await pg.waitForTimeout(600);
        const a = await lireApercu(pg, tab);
        const nom = `${tab} ${largeur}${sombre ? ' sombre' : ''}`;
        dit(a && !a.porte && a.coque && a.apercu && erreurs.length === 0, `${nom} : l’app s’ouvre en APERÇU (pas la porte), sur des données lues`, JSON.stringify(a && { porte: a.porte, coque: a.coque, apercu: a.apercu, lectures: rest.lectures }) + ' ' + erreurs.join('|'));
        if (tab === 'annonces') dit(a && a.nettes === 5 && a.debut, '  Annonces : les 5 PREMIÈRES lignes nettes (toutes listes confondues), la 6e floutée', JSON.stringify(a && { nettes: a.nettes, debut: a.debut, t: a.nettesTexte }));
        // Ventes du mode exemple : l'onglet « À envoyer » en montre 1 — elle est nette (avant : floutée, liste < 4).
        if (tab === 'ventes') dit(a && a.nettes >= 1 && a.nettes <= 5 && (a.debut ? a.nettes === 5 : true), '  Ventes : ses lignes nettes, jusqu’à 5 (une liste d’une seule vente n’est plus floutée)', JSON.stringify(a && { nettes: a.nettes, debut: a.debut, t: a.nettesTexte }));
        if (tab === 'dashboard') dit(a && a.extraits >= 1, '  autres écrans : la règle d’avant, 3 premières lignes par liste', JSON.stringify(a && { listes: a.listes, extraits: a.extraits }));
        dit(a && a.floutes > 0 && a.inertes && /blur/.test(a.flou) && a.selection === 'none', '  le reste flouté fort, `inert` + `aria-hidden`, non sélectionnable', JSON.stringify(a && { n: a.floutes, inertes: a.inertes, flou: a.flou, sel: a.selection }));
        const copie = await pg.evaluate((tab) => { const f = document.querySelector('[data-attente-ecran="' + tab + '"] [data-apercu-floute]'); if (!f) return null; const ev = new Event('copy', { bubbles: true, cancelable: true }); f.dispatchEvent(ev); return ev.defaultPrevented; }, tab);
        dit(copie === true, '  copier dans l’écran est refusé', String(copie));
        dit(a && a.cartes === 1 && (a.place === 'debut-du-flou' || a.place === 'apres-les-nettes'), '  UNE carte, posée là où le flou commence', JSON.stringify(a && { cartes: a.cartes, place: a.place }));
        dit(a && a.compteur && /Ventes lues : \d+/.test(a.carte) && a.anim && a.scenes === 5 && /16,99/.test(a.prixSolo) && /19,99/.test(a.prixPro) && a.boutons.length === 1 && a.boutons[0] === 'Débloquer tout' && a.boutonLibre,
          '  la carte : le compteur lu, la séquence (5 scènes), Solo et Pro au prix du serveur, UN bouton « Débloquer tout », touchable', a && JSON.stringify({ c: a.carte.replace(/\n/g, ' · ').slice(0, 220), b: a.boutons, libre: a.boutonLibre }));
        dit(a && a.deborde <= 0, '  rien ne déborde', String(a && a.deborde));
        await pg.evaluate(() => { const c = document.querySelector('[data-carte-apercu]'); if (c) c.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300);
        await capture(pg, `apercu-${tab}-${largeur}${sombre ? '-sombre' : ''}`);
        if (tab === 'ventes' && largeur === 390 && !sombre) {
          // L'animation : trois images à 2,5 s d'écart — trois scènes différentes.
          const vues = [];
          for (let i = 0; i < 3; i++) {
            await pg.waitForFunction(() => [...document.querySelectorAll('[data-apercu-scene]')].some((e) => Number(getComputedStyle(e).opacity) > 0.9), null, { timeout: 3000 }).catch(() => {});
            vues.push(await pg.evaluate(() => { const v = [...document.querySelectorAll('[data-apercu-scene]')].map((e) => [e.getAttribute('data-apercu-scene'), Number(getComputedStyle(e).opacity)]).sort((x, y) => y[1] - x[1])[0]; return v && v[1] > 0.2 ? v[0] : null; }));
            await capture(pg, `animation-${i + 1}-390`);
            await pg.waitForTimeout(2500);
          }
          dit(vues.every(Boolean) && new Set(vues).size === 3, '  l’animation passe d’une scène à l’autre (3 images, 3 scènes)', JSON.stringify(vues));
        }
        // Aucune action : un clic sur un bouton NET de l'écran est arrêté et ramène à CETTE carte.
        const avant = { ecr: rest.ecritures, url: pg.url() };
        const b = pg.locator(`[data-attente-ecran="${tab}"] button:not([data-apercu-floute] button):not([data-apercu-garde] button)`).first();
        const nb = await b.count();
        if (nb) await b.click({ timeout: 3000 }).catch(() => {});
        await pg.waitForTimeout(900);
        const apres = await pg.evaluate(() => { const c = document.querySelector('[data-carte-apercu]'); const x = c && c.getBoundingClientRect(); return { signe: c ? c.getAttribute('data-signe') : null, visible: !!x && x.top < innerHeight && x.bottom > 0, cartes: document.querySelectorAll('[data-carte-apercu]').length, feuille: !!document.querySelector('[role="dialog"]:not([data-carte-apercu])') }; });
        dit(nb > 0 && apres.signe && apres.visible && apres.cartes === 1 && !apres.feuille && pg.url() === avant.url, '  aucune action : un bouton net de l’écran ne fait que ramener CETTE carte sous les yeux', JSON.stringify({ boutons: nb, ...apres }));
        const actions = pg.locator('.vrm-main button:visible:not([data-apercu-garde] button)', { hasText: /imprimer|publier|répondre|exporter|scanner|générer/i });
        const na = await actions.count();
        let fuite = '';
        for (let i = 0; i < Math.min(na, 4); i++) {
          const t = (await actions.nth(i).innerText().catch(() => '')).trim();
          await actions.nth(i).click({ timeout: 2000 }).catch(() => {}); await pg.waitForTimeout(400);
          if (await pg.evaluate(() => !!document.querySelector('[role="dialog"]:not([data-carte-apercu]), .vrm-sheet, [data-feuille]'))) { fuite = t; break; }
        }
        dit(!fuite, `  aucune action de la ligne de titre ne s’ouvre (${na} essayée(s))`, fuite);
        const r = await pg.evaluate(async (o) => { const x = await fetch(o + '/rest/v1/app_data?on_conflict=owner,id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' }); return { s: x.status, j: await x.json().catch(() => null) }; }, rest.origine || 'https://lgonxzrzjcqthjtbdpzo.supabase.co');
        dit(r.s === 403 && r.j && r.j.code === 'vrm-lecture-seule' && rest.ecritures === 0, '  AUCUNE écriture de l’app n’atteint la base (garde : refus sur place)', JSON.stringify(r) + ` · parties=${rest.ecritures}`);
        if (tab === 'ventes' && largeur === 1512 && !sombre) {
          // « Débloquer tout » : 1er toucher ⇒ les deux cases légales DANS la carte ; cochées ⇒ le paiement part, avec le retour sur CET écran.
          await pg.locator('[data-apercu-debloquer]').first().click(); await pg.waitForTimeout(400);
          const cgv = await pg.evaluate(() => !!document.querySelector('[data-carte-apercu] [data-apercu-cgv] input[type="checkbox"]'));
          dit(cgv && appels.every((x) => x.mode !== 'checkout'), '  « Débloquer tout » : d’abord les deux cases (CGV, accès immédiat) dans la carte, rien ne part', JSON.stringify({ cgv, appels: appels.map((x) => x.mode) }));
          const cases = pg.locator('[data-carte-apercu] [data-apercu-cgv] input[type="checkbox"]');
          for (let i = 0; i < await cases.count(); i++) await cases.nth(i).check({ force: true }).catch(() => {});
          await pg.locator('[data-apercu-debloquer]').first().click(); await pg.waitForTimeout(800);
          const co = appels.find((x) => x.mode === 'checkout');
          let corps = null; try { corps = JSON.parse(co && co.corps); } catch (_) {}
          dit(!!corps && corps.cgv === true && corps.accesImmediat === true && corps.retour === 'ventes', '  cochées : le paiement part, CGV + accès immédiat, retour = « ventes »', JSON.stringify(corps));
        }
        await ctx.close();
      });
    }
    if (!SEUL || SEUL.split(',').includes('ventes')) {
      await essaie('mouvement réduit', async () => {
        const { ctx, pg } = await ouvrir(nav, { abo: ETATS.expire, tab: 'ventes', vue: 'reglages', largeur: 390, donnees: true, reduit: true });
        await pg.waitForSelector('[data-carte-apercu] [data-apercu-scene]', { timeout: 12000 }).catch(() => {}); await pg.waitForTimeout(600);
        const r = await pg.evaluate(() => { const s = [...document.querySelectorAll('[data-apercu-scene]')]; return { n: s.length, visibles: s.filter((e) => Number(getComputedStyle(e).opacity) > 0.9).length, anim: s.map((e) => getComputedStyle(e).animationName).filter((x) => x && x !== 'none').length }; });
        dit(r.n === 5 && r.visibles === 5 && r.anim === 0, 'mouvement réduit : une image fixe — les 5 scènes visibles ensemble, aucune animation', JSON.stringify(r));
        await pg.evaluate(() => { const c = document.querySelector('[data-carte-apercu]'); if (c) c.scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300);
        await capture(pg, 'animation-reduite-390');
        await ctx.close();
      });
      await essaie('essai gratuit : tout net', async () => {
        for (const [largeur, sombre] of [[390, false], [1512, true]]) {
          for (const tab of ['ventes', 'annonces']) {
            const { ctx, pg } = await ouvrir(nav, { abo: ETATS.essai5, tab, vue: 'reglages', largeur, sombre, donnees: true });
            await pg.waitForSelector('[data-attente-ecran="' + tab + '"]', { timeout: 12000 }).catch(() => {}); await pg.waitForTimeout(1500);
            const r = await pg.evaluate(() => ({ apercu: !!document.querySelector('[data-apercu]'), floutes: document.querySelectorAll('[data-apercu-floute]').length, carte: !!document.querySelector('[data-carte-apercu]'), coque: !!document.querySelector('.vrm-app-shell') }));
            dit(r.coque && !r.apercu && r.floutes === 0 && !r.carte, `essai gratuit ${tab} ${largeur}${sombre ? ' sombre' : ''} : tout est NET, aucune carte`, JSON.stringify(r));
            await capture(pg, `essai-${tab}-${largeur}${sombre ? '-sombre' : ''}`);
            await ctx.close();
          }
        }
      });
      await essaie('essai disponible', async () => {
        const { ctx, pg } = await ouvrir(nav, { abo: { ...ETATS.expire, essaiDispo: true, statut: null, peutGerer: false }, tab: 'annonces', vue: 'reglages', largeur: 390, donnees: true });
        await pg.waitForSelector('[data-carte-apercu] [data-apercu-scene]', { timeout: 12000 }).catch(() => {}); await pg.waitForTimeout(600);
        const b = await pg.evaluate(() => [...document.querySelectorAll('[data-carte-apercu] button')].map((x) => x.innerText.trim()).filter(Boolean));
        dit(b.length === 1 && b[0] === "Commencer l'essai gratuit", 'jamais eu d’essai : le même bouton dit « Commencer l’essai gratuit »', JSON.stringify(b));
        await ctx.close();
      });
      await essaie('retour de Stripe', async () => {
        // Le webhook arrive au 3e passage : l'aperçu se lève SUR PLACE, sans recharger, sans relire les données.
        let n = 0; const abo = () => (++n >= 3 ? ETATS.actif : ETATS.expire);
        const { ctx, pg, rest } = await ouvrir(nav, { abo, tab: 'ventes', vue: 'reglages', largeur: 390, donnees: true, suite: '&abonnement=merci' });
        await pg.evaluate(() => { window.__vrmMemePage = 1; });
        const lectures0 = rest.lectures;
        await pg.waitForFunction(() => !document.querySelector('[data-apercu]') && !document.querySelector('[data-carte-apercu]'), null, { timeout: 20000 }).catch(() => {});
        const r = await pg.evaluate(() => ({ meme: window.__vrmMemePage === 1, apercu: !!document.querySelector('[data-apercu]'), floutes: document.querySelectorAll('[data-apercu-floute]').length, carte: !!document.querySelector('[data-carte-apercu]'), ecran: !!document.querySelector('[data-attente-ecran="ventes"]') }));
        dit(r.meme && !r.apercu && r.floutes === 0 && !r.carte && r.ecran, 'retour de Stripe : sur Ventes, tout se défloute SUR PLACE (même page, aucun rechargement)', JSON.stringify({ ...r, appelsAbo: n }));
        const t0 = Date.now(), apresRetour = rest.lectures - lectures0;
        await capture(pg, 'retour-stripe-390');
        await ctx.close();
        // Le témoin : la même page, le même temps, l'abonnement qui ne vient pas — ce que l'app lit de toute façon.
        const temoin = await ouvrir(nav, { abo: ETATS.expire, tab: 'ventes', vue: 'reglages', largeur: 390, donnees: true, suite: '&abonnement=merci' });
        const l0 = temoin.rest.lectures; await temoin.pg.waitForTimeout(Math.max(1000, Date.now() - t0 + 6000)); const lt = temoin.rest.lectures - l0;
        await temoin.ctx.close();
        dit(apresRetour <= lt + 6, '  sans relire ses données : pas plus de lectures que la page qui attend toujours (témoin)', `retour=${apresRetour} · témoin=${lt}`);
      });
    }
    if (!SEUL) {
    await essaie('aperçu : Paramètres', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.expire, tab: 'settings', donnees: true });
      const q = await lirePage(pg);
      const c = await pg.evaluate(() => ({ carte: !!document.querySelector('[data-carte-apercu]'), apercu: !!document.querySelector('[data-apercu]') }));
      dit(q.etat === 'expire' && /a pris fin/.test(q.texte) && /rien n’est supprimé/.test(q.texte) && q.boutons.some((x) => /Reprendre l'abonnement/.test(x)) && !c.apercu && !c.carte,
        'Paramètres → Abonnement reste NET (de quoi reprendre) : « a pris fin », « Reprendre l’abonnement »', `${q.etat} · ${q.boutons.join(' · ')} · ${JSON.stringify(c)}`);
      await capture(pg, 'apercu-abonnement-1512');
      await ctx.close();
    });
    await essaie('expiré sans 027', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.expireSans027, tab: 'dashboard', vue: 'reglages' });
      const p = await lirePage(pg);
      dit(p.porte && !p.bandeau, 'la base ferme aussi la lecture (027 pas passée) : la porte, jamais une app vide', `porte=${p.porte}`);
      await ctx.close();
    });
    }

    if (!SEUL) {
    console.log('\n── Les autres états');
    for (const [nom, fin, verifie] of [
      ['actif', 'actif', (p) => /Abonné · 16,99/.test(p.texte) && /Prochain prélèvement le/.test(p.texte) && p.boutons.includes('Résilier') && p.boutons.some((x) => /carte/i.test(x))],
      ['resilie', 'resilie', (p) => /Fin le/.test(p.texte) && /aucun autre prélèvement/.test(p.texte) && p.boutons.some((x) => /Reprendre/.test(x)) && !p.boutons.includes('Résilier')],
      ['impaye', 'impaye', (p) => /n'est pas passé/.test(p.texte) && p.boutons.some((x) => /Mettre à jour ma carte/.test(x))],
      ['stripeAbsent', 'non-branche', (p) => /pas encore ouvert/.test(p.texte) && p.boutons.length === 0],
    ]) {
      await essaie(nom, async () => {
        const { ctx, pg } = await ouvrir(nav, { abo: ETATS[nom], largeur: nom === 'actif' ? 390 : 1512 });
        const p = await lirePage(pg);
        dit(p.fin === fin && verifie(p), `${nom} → « ${fin} »`, `${p.fin} · ${p.boutons.join(' · ')} · ${p.texte.replace(/\n/g, ' ').slice(0, 140)}`);
        if (nom === 'actif') { dit(p.deborde <= 0, '  390 px : rien ne déborde', String(p.deborde)); await capture(pg, 'actif-390'); }
        if (nom === 'stripeAbsent') await capture(pg, 'stripe-absent-1512');
        await ctx.close();
      });
    }
    await essaie('résilier en 2 clics', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.actif });
      await pg.locator('[data-abonnement] button', { hasText: /^Résilier$/ }).first().click(); await pg.waitForTimeout(500);
      const conf = await pg.locator('button', { hasText: 'Garder mon abonnement' }).count();
      dit(conf > 0, 'clic 1 : la rangée « Résilier » ouvre la confirmation (clic 2) — rien ne part avant');
      await ctx.close();
    });
    // (12 nov.) LE COMPTE NEUF VOIT L'OFFRE D'ESSAI : « Tu vends quoi ? » (et le parcours d'arrivée) d'abord, en
    // plein écran ; « Plus tard » s'y trouve toujours, et l'offre « 7 jours gratuits » est alors à portée de doigt.
    for (const largeur of [390, 1512]) {
      await essaie('compte neuf ' + largeur, async () => {
        const { ctx, pg, appels } = await ouvrir(nav, { abo: { ...base, essaiDispo: true }, largeur, nouveau: true });
        const cfg = await pg.locator('[data-configuration-plus-tard]').count();
        dit(cfg > 0, `${largeur} px : compte neuf ⇒ « Tu vends quoi ? » d’abord (le parcours d’arrivée n’est pas cassé)`);
        if (cfg) { await pg.locator('[data-configuration-plus-tard]').first().click(); await pg.locator('.vrm-cfg').first().waitFor({ state: 'detached', timeout: 15000 }).catch(() => {}); }
        for (let i = 0; i < 6; i++) {
          const pt = pg.locator('[data-parcours-plus-tard]:visible, [data-guide-plus-tard]:visible');
          if (!(await pt.count())) break;
          await pt.first().click(); await pg.waitForTimeout(300);
        }
        const offre = pg.locator('[data-abonnement] [data-sabonner][data-essai]');
        await offre.first().waitFor({ state: 'visible', timeout: 8000 });
        await offre.first().scrollIntoViewIfNeeded();
        const r = await pg.evaluate(() => { const b = document.querySelector('[data-abonnement] [data-sabonner][data-essai]'); const x = b.getBoundingClientRect(); const dessus = document.elementFromPoint(x.left + x.width / 2, x.top + x.height / 2); return { texte: (document.querySelector('[data-abonnement]') || {}).innerText || '', libre: !!dessus && (dessus === b || b.contains(dessus)), h: x.height }; });
        dit(/7 jours|gratuit/i.test(r.texte) && r.libre && r.h >= 44, `${largeur} px : puis l’offre d’essai est visible et touchable (rien ne la recouvre)`, JSON.stringify(r));
        dit(appels.every((a) => a.mode !== 'checkout'), `${largeur} px : rien ne part vers le paiement sans son clic`);
        await capture(pg, `compte-neuf-${largeur}`);
        await ctx.close();
      });
    }

    console.log('\n── Le parrainage');
    for (const [largeur, sombre] of [[1512, false], [390, true]]) {
      await essaie('parrainage ' + largeur, async () => {
        const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.actif, largeur, sombre });
        const r = await pg.evaluate(() => { const g = document.querySelector('[data-parrainage]'); return g ? { etat: g.getAttribute('data-parrainage'), i: g.getAttribute('data-inscrits'), p: g.getAttribute('data-payes'), lien: (g.querySelector('[data-lien-parrainage]') || {}).innerText, t: g.innerText } : null; });
        dit(!!r && r.etat === 'ouvert' && r.lien === 'https://vrm.center/r/K7MQ4RZP' && r.i === '2' && r.p === '1' && /un mois offert/i.test(r.t), `${largeur} px : le lien personnel et « 2 inscrits, 1 a payé »`, JSON.stringify(r && { ...r, t: r.t.replace(/\n/g, ' ').slice(0, 100) }));
        dit(appels.every((a) => a.m === 'GET'), '  ouvrir la page ne rattache rien (lecture seule)');
        if (largeur === 390) { const d = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); dit(d <= 0, '  390 px : rien ne déborde', String(d)); }
        await pg.locator('[data-parrainage]').scrollIntoViewIfNeeded().catch(() => {});
        await capture(pg, `parrainage-${largeur}${sombre ? '-sombre' : ''}`);
        await ctx.close();
      });
    }
    await essaie('parrainage fermé', async () => {
      const { ctx, pg } = await ouvrir(nav, { abo: ETATS.actif, parrain: { ok: true, installe: true, ouvert: false } });
      dit(!(await pg.evaluate(() => !!document.querySelector('[data-lien-parrainage]'))), 'parrainage éteint : aucun lien promis au vendeur');
      await ctx.close();
    });
    }
  } catch (e) { dit(false, 'le banc s’exécute', String(e && e.message || e).slice(0, 160)); }
  finally {
    await nav.close(); srv.close();
    console.log(`\n  captures : ${CAPTURES}`);
    console.log(ko ? `\n❌ abonnement-propre (rendu) : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ abonnement-propre (rendu) : ${ok} verts, 0 rouge`);
    process.exit(ko ? 1 : 0);
  }
})();
