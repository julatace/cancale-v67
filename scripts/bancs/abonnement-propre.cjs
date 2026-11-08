require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  BANC « ABONNEMENT PROPRE » (8 nov.) — la page Abonnement, la ligne de la
//  coque et la lecture seule, RENDUES, avec un faux serveur (aucun Stripe réel).
//    · essai J-5 : la page dit « Encore 5 jours », la coque se tait ;
//    · essai J-3 et J-1 : une ligne discrète dans la coque (« dans 3 jours »,
//      « demain »), qui ouvre l'abonnement et se ferme pour la journée ;
//    · sans abonnement (Julien, 8 nov. : « un extrait de ses données, le reste
//      flouté ») : sur Ventes, Colis, Annonces… (données du mode exemple), les
//      3 premières lignes de chaque liste NETTES, la 4e et la suite FLOUTÉES,
//      `inert` et `aria-hidden`, ni sélectionnables ; une carte nette « Ton
//      abonnement a pris fin » ; tout clic dans l'écran est arrêté ; AUCUNE
//      écriture n'atteint la base ; l'export est fermé ;
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
async function ouvrir(nav, { abo, tab = 'settings', largeur = 1512, sombre = false, vue = 'abonnement', parrain = PARRAIN, donnees = false }) {
  const ex = donnees ? await exemple() : null;
  const SESSION = ex ? { ...SESSION_BANC, user: { ...SESSION_BANC.user, id: ex.uid } } : SESSION_BANC;
  const mobile = largeur < 600;
  const ctx = await nav.newContext({ viewport: { width: largeur, height: mobile ? 844 : 950 }, isMobile: mobile, hasTouch: mobile, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.addInitScript(({ s, vue, sombre }) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_mfa_plus_tard_' + s.user.id, String(Date.now())); if (vue) localStorage.setItem('vrm_reglages_vue', vue); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); } catch (_) {} }, { s: SESSION, vue, sombre });
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
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' });
  });
  const appels = [];
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/mode=abonnement/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(abo) });
    if (/mode=factures/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FACTURES) });
    if (/mode=parrainage/.test(u)) { appels.push({ mode: 'parrainage', m: r.request().method(), corps: r.request().postData() || '' }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(parrain) }); }
    if (/mode=(checkout|portail)/.test(u)) { appels.push({ mode: /checkout/.test(u) ? 'checkout' : 'portail' }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://billing.stripe.com/p/session/banc' }) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3800);
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
    console.log('\n── L’expiration : un aperçu net, le reste flouté, aucune action');
    const lireApercu = (pg, tab) => pg.evaluate((tab) => {
      const r = document.querySelector('[data-attente-ecran="' + tab + '"]');
      if (!r) return null;
      const fl = [...r.querySelectorAll('[data-apercu-floute]')];
      // Une liste « extrait » : ses 3 premières lignes nettes, la 4e floutée.
      const listes = [...r.querySelectorAll('*')].filter((e) => e.children.length >= 4 && e.children[3].hasAttribute('data-apercu-floute'));
      const extrait = listes.filter((e) => [0, 1, 2].every((i) => !e.children[i].hasAttribute('data-apercu-floute') && !e.children[i].closest('[data-apercu-floute]')));
      extrait.sort((x, y) => (y.innerText || '').length - (x.innerText || '').length);
      const echantillon = fl.map((e) => (e.innerText || '').trim()).find((t) => t.length > 6) || '';
      const nettes = extrait[0] ? [0, 1, 2].map((i) => (extrait[0].children[i].innerText || '').trim().slice(0, 40)) : [];
      const s = fl[0] ? getComputedStyle(fl[0]) : null;
      document.getSelection().removeAllRanges();
      const plage = document.createRange(); plage.selectNodeContents(r); document.getSelection().addRange(plage);
      const choisi = document.getSelection().toString(); document.getSelection().removeAllRanges();
      return {
        apercu: r.hasAttribute('data-apercu'), floutes: fl.length, listes: listes.length, extraits: extrait.length, nettes,
        inertes: fl.every((e) => e.hasAttribute('inert') && e.getAttribute('aria-hidden') === 'true'),
        flou: s ? s.filter : '', selection: s ? (s.userSelect || s.webkitUserSelect) : '',
        echantillon: echantillon.slice(0, 30), copiable: !!echantillon && choisi.includes(echantillon.slice(0, 12)),
        carte: (document.querySelector('[data-carte-apercu]') || {}).innerText || '',
        porte: !!document.querySelector('[data-abonnement-requis]'), coque: !!document.querySelector('.vrm-app-shell'),
        deborde: document.documentElement.scrollWidth - window.innerWidth,
      };
    }, tab);
    for (const [tab, largeur, sombre] of [['ventes', 1512, false], ['achats', 1512, false], ['annonces', 390, true], ['ventes', 390, false], ['dashboard', 1512, true]]) {
      if (SEUL && !SEUL.split(',').includes(tab)) continue;
      await essaie(`aperçu ${tab} ${largeur}`, async () => {
        const { ctx, pg, rest, erreurs } = await ouvrir(nav, { abo: ETATS.expire, tab, vue: 'reglages', largeur, sombre, donnees: true });
        await pg.waitForTimeout(1500);
        const a = await lireApercu(pg, tab);
        const nom = `${tab} ${largeur}${sombre ? ' sombre' : ''}`;
        dit(a && !a.porte && a.coque && a.apercu && erreurs.length === 0, `${nom} : l’app s’ouvre en APERÇU (pas la porte), sur des données lues`, JSON.stringify(a && { porte: a.porte, coque: a.coque, apercu: a.apercu, lectures: rest.lectures }) + ' ' + erreurs.join('|'));
        // Une liste de 4 lignes ou plus (Ventes, Annonces, Ma journée dans l'exemple) : l'extrait.
        if (tab !== 'achats') dit(a && a.extraits >= 1 && a.nettes.every((t) => t.length > 0), '  un EXTRAIT net : les 3 premières lignes d’une liste, la 4e floutée', JSON.stringify(a && { listes: a.listes, extraits: a.extraits, nettes: a.nettes }));
        dit(a && a.floutes > 0 && a.inertes && /blur/.test(a.flou) && a.selection === 'none', '  le reste flouté fort, `inert` + `aria-hidden`, non sélectionnable', JSON.stringify(a && { n: a.floutes, inertes: a.inertes, flou: a.flou, sel: a.selection }));
        const copie = await pg.evaluate((tab) => { const f = document.querySelector('[data-attente-ecran="' + tab + '"] [data-apercu-floute]'); if (!f) return null; const ev = new Event('copy', { bubbles: true, cancelable: true }); f.dispatchEvent(ev); return ev.defaultPrevented; }, tab);
        dit(copie === true, '  copier dans l’écran est refusé', String(copie));
        dit(a && /Ton abonnement a pris fin/.test(a.carte) && /rien n'est supprimé/.test(a.carte) && /Reprendre l'abonnement/.test(a.carte), '  la carte nette : « a pris fin · rien n’est supprimé · Reprendre l’abonnement »', a && a.carte.replace(/\n/g, ' · '));
        dit(a && a.deborde <= 0, '  rien ne déborde', String(a && a.deborde));
        await capture(pg, `apercu-${tab}-${largeur}${sombre ? '-sombre' : ''}`);
        // Aucune action : un clic sur un bouton NET de l'écran est arrêté.
        const avant = { ecr: rest.ecritures, url: pg.url() };
        const b = pg.locator(`[data-attente-ecran="${tab}"] button:not([data-apercu-floute] button)`).first();
        const nb = await b.count();
        if (nb) await b.click({ timeout: 3000 }).catch(() => {});
        await pg.waitForTimeout(700);
        const apres = await pg.evaluate(() => ({ signe: (document.querySelector('[data-carte-apercu]') || {}).getAttribute ? document.querySelector('[data-carte-apercu]').getAttribute('data-signe') : null, feuille: !!document.querySelector('[role="dialog"]:not([data-carte-apercu])') }));
        dit(nb > 0 && apres.signe && !apres.feuille && pg.url() === avant.url, '  aucune action : un bouton net de l’écran ne fait rien d’autre que montrer la carte', JSON.stringify({ boutons: nb, ...apres }));
        // Les actions de la ligne de titre (« Tout imprimer », « Publier »…), où qu'elles soient rendues.
        const actions = pg.locator('.vrm-main button:visible', { hasText: /imprimer|publier|répondre|exporter|scanner|générer/i });
        const na = await actions.count();
        let fuite = '';
        for (let i = 0; i < Math.min(na, 4); i++) {
          const t = (await actions.nth(i).innerText().catch(() => '')).trim();
          await actions.nth(i).click({ timeout: 2000 }).catch(() => {}); await pg.waitForTimeout(400);
          if (await pg.evaluate(() => !!document.querySelector('[role="dialog"]:not([data-carte-apercu]), .vrm-sheet, [data-feuille]'))) { fuite = t; break; }
        }
        dit(!fuite, `  aucune action de la ligne de titre ne s’ouvre (${na} essayée(s))`, fuite);
        // Aucune écriture : celles que l'app tente sont refusées AVANT le réseau.
        const r = await pg.evaluate(async (o) => { const x = await fetch(o + '/rest/v1/app_data?on_conflict=owner,id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' }); return { s: x.status, j: await x.json().catch(() => null) }; }, rest.origine || 'https://lgonxzrzjcqthjtbdpzo.supabase.co');
        dit(r.s === 403 && r.j && r.j.code === 'vrm-lecture-seule' && rest.ecritures === 0, '  AUCUNE écriture n’atteint la base (garde : refus sur place)', JSON.stringify(r) + ` · parties=${rest.ecritures}`);
        await ctx.close();
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

    console.log('\n── Le parrainage');
    for (const [largeur, sombre] of [[1512, false], [390, true]]) {
      await essaie('parrainage ' + largeur, async () => {
        const { ctx, pg, appels } = await ouvrir(nav, { abo: ETATS.actif, largeur, sombre });
        const r = await pg.evaluate(() => { const g = document.querySelector('[data-parrainage]'); return g ? { etat: g.getAttribute('data-parrainage'), i: g.getAttribute('data-inscrits'), p: g.getAttribute('data-payes'), lien: (g.querySelector('[data-lien-parrainage]') || {}).innerText, t: g.innerText } : null; });
        dit(!!r && r.etat === 'ouvert' && r.lien === 'https://vrm.center/?parrain=K7MQ4RZP' && r.i === '2' && r.p === '1' && /un mois offert/i.test(r.t), `${largeur} px : le lien personnel et « 2 inscrits, 1 a payé »`, JSON.stringify(r && { ...r, t: r.t.replace(/\n/g, ' ').slice(0, 100) }));
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
