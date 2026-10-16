// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA FICHE D'UN COMPTE DIT L'ESSENTIEL, ET « ADRESSES DE RÉCEPTION »
//        S'EXPLIQUE (15 octobre — node scripts/bancs/comptes-fiche.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « pour les comptes, il y a beaucoup trop d'informations qui ne
// servent à rien » et « mes adresses de réception, je ne comprends pas ce que
// c'est, réexplique ». Données INVENTÉES (aucune fixture : il vit dans le dépôt).
//
// A. Réglages → Comptes liés, aux deux tailles :
//   1. chaque fiche montre la PLATEFORME (logo), le nom, la SYNCHRO (« capté il
//      y a … ») et la place du STATUT (`data-statut-compte`, que le chantier
//      « comptes bloqués » remplit) ;
//   2. au repos, DEUX actions visibles, pas plus (Actif/Masqué · Détails) ; ni
//      email, ni téléphone, ni « Tester », ni « Supprimer » ;
//   3. « Détails » ouvre le reste — RIEN n'est perdu : email, téléphone, note,
//      « Tester la connexion », « Supprimer ce compte » ;
//   4. le compte ouvert dans Chrome est dit sur SA fiche, et seulement sur elle ;
//   5. ⚠️ la lecture de la dernière capture ÉCHOUE (522) : aucune fiche ne dit
//      « Jamais capté », aucune ne réclame « ouvre ta boutique » — « pas su »
//      n'est pas « jamais » ;
//   6. aucun débordement, aucune erreur de page.
// B. Réglages → Adresses email de réception :
//   7. le titre et la phrase disent ce que c'est (des adresses EMAIL vers
//      lesquelles il fait suivre ses emails Vinted) et ce que ce n'est PAS (pas
//      des adresses postales) ;
//   8. vendeur SEUL (le repli « installation » lui rend tout), rien de mis de
//      côté : la rubrique est REPLIÉE, avec sa raison et le nombre d'adresses ;
//      un clic la déplie et les adresses sont là ;
//   9. l'autre sens : un autre vendeur a déclaré les siennes (repli éteint) — la
//      rubrique n'est PAS repliée (sinon elle cacherait une alerte).
// On juge les ATTRIBUTS posés par l'app et le texte de la fiche.
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 5942);
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'comptes-fiche');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const SESSION = { access_token: 'jeton-de-banc', refresh_token: 'r', expires_at: Date.now() + 3600e3,
  user: { id: '33333333-3333-3333-3333-333333333333', email: 'vendeur.banc@exemple.test' } };
const MAINTENANT = Date.now();
const iso = (h) => new Date(MAINTENANT - h * 3600e3).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '810001', login: 'compte_alpha', domain: 'www.vinted.fr', updated_at: iso(24 * 30), refresh_token: 'r1' },
  { id: 2, vinted_user_id: '810002', login: 'compte_beta', domain: 'www.vinted.fr', updated_at: iso(24 * 20), refresh_token: 'r2' },
];
const MAIN = { vinted_account_emails: { 810001: 'alpha@exemple.test' }, vinted_account_phones: { 810002: '06 00 00 00 01' } };
const ADRESSES = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`reception${i + 1}@exemple.test`, { owner: SESSION.user.id, label: '', at: iso(48) }]));

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);

// Le pont simulé : une extension à jour, connectée, dont l'onglet Vinted est sur
// `compte_beta` (810002).
const PONT = () => {
  const version = '5.177.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: 'vendeur.banc@exemple.test' }, vinted: { uid: '810002', login: 'compte_beta' }, cmds: {} } });
  });
  post({ __vmr: 'ready', version });
};

async function ouvrir(b, { vp, captureKO = false, repli = true, pont = true, tab = 'vintedaccounts', sombre = false, ages = [2, 5] }) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_reglages_vue', 'reglages'); } catch (_) {} }, SESSION);
  if (pont) await pg.addInitScript(PONT);
  // (`vrm_bascule_mineral_v1` : la bascule « Minéral » repasse l'app en clair UNE
  //  fois ; posée, elle respecte le choix sombre.)
  if (sombre) await pg.addInitScript(() => { try { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'jeton-de-banc', refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
  await pg.route('**/rest/v1/**', (r) => {
    const u = decodeURIComponent(metaVersData(r.request().url()));
    const j = (d, h = {}) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...h }, body: JSON.stringify(d) });
    if (r.request().method() !== 'GET') return r.fulfill({ status: 201, contentType: 'application/json', body: '' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (/id=eq\.vrm_email_owners/.test(u)) return j([{ data: { adresses: ADRESSES } }]);
    if (/id=eq\.main/.test(u)) return j([{ id: 'main', data: sombre ? { ...MAIN, vinted_dark: true } : MAIN }]);
    // La dernière capture de chaque compte (balayage `harvest_*`).
    if (/id=like\.harvest_\*&select=id,updated_at,cap/.test(u)) {
      if (captureKO) return r.fulfill({ status: 522, contentType: 'text/html', body: '<!DOCTYPE html><title>522</title>' });
      return j([{ id: 'harvest_810001_orders_sold', updated_at: iso(ages[0]), cap: iso(ages[0]) }, { id: 'harvest_810002_listings', updated_at: iso(ages[1]), cap: iso(ages[1]) }], { 'content-range': '0-1/2' });
    }
    return j([], { 'content-range': '0-0/0' });
  });
  await pg.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/\/api\/email-rattacher/.test(u) && /mode=liste/.test(u)) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cloisonnee: true, emails: [], installation: { repli, personne: { n: 0, auMoins: false, causes: {} } } }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"pret":true}' });
  });
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4200);
  return { ctx, pg, errs };
}

// Une fiche : son texte, ses boutons VISIBLES, ses champs visibles.
const lireFiches = (pg) => pg.evaluate(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  // Sur le code d'avant, la fiche n'a pas d'attribut : on la trouve par le nom.
  const cartes = [...document.querySelectorAll('[data-fiche-compte]')];
  const parNom = cartes.length ? cartes : ['compte_alpha', 'compte_beta'].map((n) => {
    // Le nom affiché, puis le plus petit ancêtre qui porte aussi les boutons
    // du compte (« Actif »/« Masqué ») : c'est la fiche.
    const nom = [...document.querySelectorAll('div')].find((d) => (d.innerText || '').trim() === n && !d.querySelector('div'));
    let c = nom;
    while (c && !(c.querySelector && [...c.querySelectorAll('button')].some((b) => /Actif|Masqué/.test(b.innerText || '')))) c = c.parentElement;
    return c || null;
  }).filter(Boolean);
  return parNom.map((c) => ({
    uid: c.getAttribute('data-fiche-compte'),
    texte: c.innerText,
    boutons: [...c.querySelectorAll('button')].filter(vis).map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim()),
    champs: [...c.querySelectorAll('input')].filter(vis).length,
    logo: !!c.querySelector('svg, img'),
    statut: c.querySelector('[data-statut-compte]') ? c.querySelector('[data-statut-compte]').innerText : null,
    synchro: c.querySelector('[data-synchro-compte]') ? c.querySelector('[data-synchro-compte]').getAttribute('data-synchro-compte') : null,
    chrome: !!c.querySelector('[data-compte-chrome]'),
  }));
});

async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '390 px' : '1512 px';
      console.log(`── Comptes liés · ${T}`);
      await essaie(`${T} · fiches`, async () => {
        const { ctx, pg, errs } = await ouvrir(b, { vp });
        const f = await lireFiches(pg);
        dit(f.length === 2, `${T} : deux fiches de compte`, String(f.length));
        for (const x of f) {
          const nom = /compte_alpha/.test(x.texte) ? 'alpha' : 'beta';
          dit(x.logo && !!x.statut && /capté il y a \d+ h/.test(x.texte), `${T} · ${nom} : plateforme (logo), statut à sa place, synchro (« capté il y a … »)`, `${x.statut} · ${x.texte.replace(/\n/g, ' ').slice(0, 90)}`);
          const actions = x.boutons.filter((t) => t && !/^OK$/.test(t));
          dit(actions.length <= 2, `${T} · ${nom} : au repos, deux actions au plus`, JSON.stringify(actions));
          dit(x.champs === 0 && !/Tester la connexion|Supprimer ce compte/.test(x.texte), `${T} · ${nom} : ni champ email/téléphone, ni « Tester », ni « Supprimer » au repos`, `${x.champs} champ(s)`);
        }
        const alpha = f.find((x) => /compte_alpha/.test(x.texte)), beta = f.find((x) => /compte_beta/.test(x.texte));
        dit(!!beta && beta.chrome && !!alpha && !alpha.chrome, `${T} : « ouvert dans Chrome » sur la fiche du compte de l'onglet Vinted, et sur elle seule`, `alpha=${alpha && alpha.chrome} beta=${beta && beta.chrome}`);
        // Détails : rien n'est perdu.
        const det = await pg.$('[data-details-compte="810001"]');
        dit(!!det, `${T} : la fiche a un bouton « Détails »`);
        if (det) { await det.click(); await pg.waitForTimeout(500); }
        const panneau = await pg.evaluate(() => { const p = document.querySelector('[data-panneau-compte="810001"]'); return p ? { texte: p.innerText, champs: [...p.querySelectorAll('input')].map((i) => i.value) } : null; });
        dit(!!panneau && panneau.champs.includes('alpha@exemple.test') && /Tester la connexion/.test(panneau.texte) && /Supprimer ce compte/.test(panneau.texte) && /Téléphone/.test(panneau.texte),
          `${T} : « Détails » ouvre le reste — email (sa valeur), téléphone, « Tester », « Supprimer »`, panneau ? panneau.texte.replace(/\n/g, ' ').slice(0, 160) : 'absent');
        await pg.screenshot({ path: path.join(CAPTURES, `fiches-${vp.width}.png`), fullPage: true }).catch(() => {});
        await sain(pg, `${T} · Comptes liés`);
        dit(errs.length === 0, `${T} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
      await essaie(`${T} · capture illisible`, async () => {
        const { ctx, pg } = await ouvrir(b, { vp, captureKO: true });
        const t = await pg.evaluate(() => document.body.innerText);
        dit(!/Jamais capté/.test(t) && !/Ouvre ta boutique/.test(t), `${T} : lecture de la capture en panne — aucune fiche ne dit « Jamais capté » ni ne réclame une capture`, (t.match(/Jamais capté|Ouvre ta boutique[^\n]*/g) || []).join(' | '));
        const f = await lireFiches(pg);
        dit(f.length === 2 && f.every((x) => x.synchro === 'passu'), `${T} : chaque fiche dit « pas su » pour sa synchro`, JSON.stringify(f.map((x) => x.synchro)));
        dit(f.length === 2 && f.every((x) => (x.texte.match(/pas pu (?:la )?lire/gi) || []).length === 1), `${T} : et elle le dit UNE fois (la pastille), pas deux`, f.map((x) => x.texte.replace(/\n/g, ' ').slice(0, 90)).join(' | '));
        await ctx.close();
      });
      // ⚠️ RELECTURE DU 15 OCTOBRE : en retard, la fiche disait « capté il y a
      //    5 j » ET « Pas capté (il y a 5 j) » — deux phrases, et qui se
      //    contredisent. La synchro se dit UNE fois, quelle que soit sa fraîcheur.
      await essaie(`${T} · capture en retard`, async () => {
        const { ctx, pg } = await ouvrir(b, { vp, ages: [30, 24 * 5] });
        const f = await lireFiches(pg);
        dit(f.length === 2, `${T} : deux fiches (captures de 30 h et 5 j)`, String(f.length));
        for (const x of f) {
          const nom = /compte_alpha/.test(x.texte) ? 'alpha' : 'beta';
          const n = (x.texte.match(/capt[ée]/gi) || []).length;
          dit(n === 1 && /il y a \d+ (?:h|j)/.test(x.statut || ''), `${T} · ${nom} : la synchro est dite UNE fois, par la pastille de statut`, `${n}× · ${x.texte.replace(/\n/g, ' ').slice(0, 110)}`);
        }
        await pg.screenshot({ path: path.join(CAPTURES, `fiches-retard-${vp.width}.png`), fullPage: true }).catch(() => {});
        await ctx.close();
      });

      console.log(`── Adresses email de réception · ${T}`);
      await essaie(`${T} · adresses seul`, async () => {
        const { ctx, pg } = await ouvrir(b, { vp, tab: 'settings', pont: false });
        const a = await pg.evaluate(() => { const r = document.querySelector('[data-reglage-adresses]'); return r ? { etat: r.getAttribute('data-reglage-adresses'), texte: r.innerText } : null; });
        dit(!!a && /email/i.test(a.texte.split('\n')[0]) && /pas des adresses postales/i.test(a.texte) && /fais suivre/.test(a.texte),
          `${T} : le titre et la phrase disent ce que c'est (adresses EMAIL où il fait suivre ses emails) et ce que ce n'est pas (pas postales)`, a && a.texte.replace(/\n/g, ' ').slice(0, 200));
        dit(!!a && a.etat === 'replie' && /seul vendeur/i.test(a.texte) && /15 adresses/.test(a.texte) && !/reception1@exemple\.test/.test(a.texte),
          `${T} : vendeur seul, rien de mis de côté — repliée, avec sa raison et le nombre`, a && `${a.etat} · ${a.texte.replace(/\n/g, ' ').slice(0, 220)}`);
        const bt = await pg.$('[data-adresses-repli] button');
        if (bt) { await bt.click(); await pg.waitForTimeout(400); }
        const a2 = await pg.evaluate(() => { const r = document.querySelector('[data-reglage-adresses]'); return r ? { etat: r.getAttribute('data-reglage-adresses'), texte: r.innerText } : null; });
        dit(!!a2 && a2.etat !== 'replie' && /reception1@exemple\.test/.test(a2.texte), `${T} : un clic la déplie, les adresses sont là`, a2 && a2.etat);
        // ⚠️ RELECTURE DU 15 OCTOBRE (mesuré chez lui : 6 de ses 15 adresses sont
        //    aussi l'« Email du compte Vinted » d'une fiche) : la phrase nomme
        //    l'email de ses comptes Vinted, et celui qui n'est pas déclaré est
        //    PROPOSÉ (à son clic) — les deux saisies sont reliées.
        dit(!!a && /email de chacun de tes comptes Vinted|email de tes comptes Vinted/i.test(a.texte), `${T} : la phrase dit que ce sont en général les emails de ses comptes Vinted`, a && a.texte.replace(/\n/g, ' ').slice(0, 200));
        const sg = await pg.evaluate(() => { const e = document.querySelector('[data-suggestion="alpha@exemple.test"]'); return e ? { t: e.innerText, src: (e.querySelector('[data-suggestion-source]') || {}).getAttribute && e.querySelector('[data-suggestion-source]').getAttribute('data-suggestion-source') } : null; });
        dit(!!sg && sg.src === 'compte' && /email du compte compte_alpha/.test(sg.t), `${T} : l'email du compte Vinted (Détails de sa fiche), pas encore déclaré, est proposé — et dit de quel compte il vient`, sg ? sg.t.replace(/\n/g, ' · ') : 'absent');
        await pg.screenshot({ path: path.join(CAPTURES, `adresses-${vp.width}.png`), fullPage: true }).catch(() => {});
        await ctx.close();
      });
      await essaie(`${T} · adresses plusieurs vendeurs`, async () => {
        const { ctx, pg } = await ouvrir(b, { vp, tab: 'settings', pont: false, repli: false });
        const a = await pg.evaluate(() => { const r = document.querySelector('[data-reglage-adresses]'); return r ? { etat: r.getAttribute('data-reglage-adresses'), texte: r.innerText } : null; });
        dit(!!a && a.etat !== 'replie' && /reception1@exemple\.test/.test(a.texte), `${T} : un autre vendeur a déclaré les siennes — la rubrique n'est PAS repliée`, a && `${a.etat} · ${a.texte.replace(/\n/g, ' ').slice(0, 120)}`);
        await ctx.close();
      });
    }
    // ── En SOMBRE : la fiche dépliée et les adresses repliées restent lisibles
    //    (le fond du document suit le thème, aucun débordement).
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = (vp.width < 600 ? '390 px' : '1512 px') + ' sombre';
      await essaie(T, async () => {
        const { ctx, pg, errs } = await ouvrir(b, { vp, sombre: true });
        const det = await pg.$('[data-details-compte="810001"]'); if (det) { await det.click(); await pg.waitForTimeout(400); }
        const fond = await pg.evaluate(() => { const c = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000; });
        dit(fond < 80, `${T} : le fond est sombre`, String(fond));
        await pg.screenshot({ path: path.join(CAPTURES, `fiches-sombre-${vp.width}.png`), fullPage: true }).catch(() => {});
        await sain(pg, `${T} · Comptes liés`);
        await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3500);
        await pg.evaluate(() => { const r = document.querySelector('[data-reglage-adresses]'); if (r) r.scrollIntoView(); });
        await pg.screenshot({ path: path.join(CAPTURES, `adresses-sombre-${vp.width}.png`) }).catch(() => {});
        await sain(pg, `${T} · Réglages`);
        dit(errs.length === 0, `${T} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`(captures : ${CAPTURES})`);
  console.log(ko ? `\n❌ fiches de comptes : ${ko} rouge(s)` : '\n✅ fiches de comptes : tout est vert');
  process.exit(ko ? 1 : 0);
})();
