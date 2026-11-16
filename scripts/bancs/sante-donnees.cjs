// ════════════════════════════════════════════════════════════════════════════
//  BANC : « SANTÉ DE TES DONNÉES » (11 nov., lot sante-donnees)
//        npm run build && node scripts/bancs/sante-donnees.cjs [dist]
//        BANC_CAPTURES=dossier  BANC_PORT=4398  SD_SEUL=S|C|G|P|Z  SD_CLE=<geste G seul>
//  La VRAIE app (`dist`), une fausse base qui applique la projection `select=`.
//  Données INVENTÉES (dépôt public). Les publications des écrans propriétaires
//  sont rangées sur l'appareil SOUS LEUR FORME RÉELLE ; les attendus sont faits
//  À LA MAIN (jamais recalculés par le banc).
//   S  Paramètres → Santé de tes données, 1512 et 390, clair et sombre : une ligne
//      par vérification ; chaque nombre est celui de sa source ; « deux articles
//      sous un N° » en tête et SEULE en rouge ; chaque ligne à corriger a UN bouton
//      ≥ 44 px ; l'extension (aucune ancienne) est « à jour » ; aucune écriture vers
//      la base pendant 3 s écran ouvert ; aucune erreur de page.
//   C  « Tout va bien ? » porte la ligne compacte « N à corriger » (le même nombre) ;
//      la toucher ouvre la Santé de tes données.
//   G  Chaque bouton OUVRE le bon parcours (1512) et n'écrit aucune donnée : Colis
//      (onglet), Annonces + la saisie en série, Achats, Déclarer, E-mails, Tout va bien ?
//      « Aucune donnée » se juge sur une ligne `main` RÉALISTE (des fiches numérotées, le
//      pool, les comptes) et AU REPOS (la première synchronisation de l'appareil finie) :
//      une clé qui existait ne change pas, aucune clé de données n'apparaît ; seules les
//      publications d'écran déclarées (`ETAT_ECRANS`, `LIGNES_PUBLIEES`) peuvent bouger.
//   P  Rien publié, e-mails muets (503) : chaque ligne « — · pas lu », aucune à 0,
//      jamais « Tout est à jour ».
//   Z  Tout publié à 0, comptes relus, extension à jour, e-mails à 0 : « Tout est à jour ✓ ».
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const { metaVersData } = require('./_meta.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = process.argv[2] || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4398);
const CAPT = process.env.BANC_CAPTURES || path.join(__dirname, 'captures');
const SEUL = process.env.SD_SEUL || '';
fs.mkdirSync(CAPT, { recursive: true });
const ATTENDUE = (/const EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1];
// (15 nov., rouges-connus) La liste porte maintenant un commentaire (11 nov., `vrm_prix_lus`) : elle se lit comme du JS
// (vm), comme l'app la lit — plus en JSON brut (le banc plantait au chargement, sans rien juger).
const PUBLIEES = require('vm').runInNewContext('(' + ((/export const CLES_PUBLIEES = (\[[^\]]*\])/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'fileEnvoi.js'), 'utf8')) || [, '[]'])[1]) + ')', {});

// (16 nov., bancs-rouges-a) MESURÉ (chaque écriture de `main` journalisée clé par clé, valeur égale ou non) : une
// écriture de `main` réécrit la ligne ENTIÈRE (vinted_sales, vinted_accounts… y repassent à valeur ÉGALE — c'était
// le « colis-a-confirmer réécrit vinted_sales » du 15 nov.) ; ce qui CHANGE après un bouton n'est que publications et
// état de l'app. Pas des données, écrites par l'app sans geste (la même liste qu'a-trancher, plus deux publications
// en ligne à part, §5 « un écran publie ») : l'écran ouvert (`vrm_reprise_ecrans`, ignoré aussi par `compterEnAttente`),
// le point de restauration automatique (`restore_*`), la veille des chiffres (`vrm_veille_chiffres`), le widget
// (`widget_stats`, écrit quand ce qu'il afficherait change) et « à retirer de Leboncoin » (`lbc_a_retirer`, écrit
// quand il change ou toutes les 6 h). Toute autre clé ou ligne écrite reste rouge.
const NON_DONNEES = (k) => k === 'vrm_reprise_ecrans' || k === 'vrm_veille_chiffres' || /^restore_\d+$/.test(k) || k === 'widget_stats' || k === 'lbc_a_retirer';
const UID = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';   // la session de banc (_porte-banc.cjs)
const H = 3600e3, M = 60e3, MAINTENANT = Date.now();
const iso = (ilYa) => new Date(MAINTENANT - ilYa).toISOString();
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: iso(0) }];
const appareil = (id, ap, code) => ({ id: 'ext_appareil_' + id, data: { v: 1, appareil: ap, ver: code, code, at: iso(5 * M), atMs: MAINTENANT - 5 * M, flux: { vinted: { okAt: MAINTENANT - 6 * M, koAt: null, refus: [] } }, vus: { vinted: { 111: MAINTENANT - 6 * M } } } });
// Le compte : relu il y a 3 jours (cas S) ou à l'instant (cas Z).
const lignesBase = (ageMs) => [
  { id: 'harvest_111_profile', data: { capturedAt: iso(ageMs) } },
  { id: 'harvest_111_listings', data: { capturedAt: iso(ageMs), uid: '111', payload: { items: [] } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: iso(ageMs), payload: { my_orders: [] } } },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: iso(ageMs), payload: { my_orders: [] } } },
  { id: 'panel_comptes_etat', data: { comptes: {} } },
  { id: 'panel_diag_capture', data: { ver: ATTENDUE, verCode: ATTENDUE, majAt: iso(6 * M), n: {}, rates: {} } },
  appareil('0f1e2d3c4b5a6978', { paquet: 'chromium', nav: 'chrome', systeme: 'mac' }, ATTENDUE),
];
// Les publications des propriétaires (forme réelle : src/aTrancher.js, src/santeDonnees.js, src/sourceAchats.js).
const TR = { 'numeros-double': 1, 'numeros-a-ecrire': 2, 'colis-postes': 1, 'achats-sans-prix': 3 };
const SA = { 'colis-a-confirmer': 1, 'annonces-a-confirmer': 2 };
// 4 ventes publiées par Ventes : 2 sans achat relié (cle ''), 1 Vinted, 1 « source pas saisie ».
const VENTES = [['9001', MAINTENANT - 5 * 86400e3, '', '', null, 0], ['9002', MAINTENANT - 4 * 86400e3, 'vinted', 'Vinted', 1200, 0], ['9003', MAINTENANT - 3 * 86400e3, '', '', null, 0], ['9004', MAINTENANT - 2 * 86400e3, 'non-saisie', '', 500, 0]];
const ADATER = 4, MIS_DE_COTE = 1, A_VERIFIER = 2;
// Attendu À LA MAIN.
const ATTENDU_S = { 'numeros-double': 1, 'numeros-a-ecrire': 2, 'colis-a-confirmer': 1, 'colis-postes': 1, 'emails-mis-de-cote': 1, 'emails-a-verifier': 2,
  'achats-sans-prix': 3, 'ventes-sans-achat': 2, 'ventes-a-dater': 4, 'comptes-a-relire': 1, 'annonces-a-confirmer': 2, 'extension-en-retard': 0 };
const N_A_CORRIGER = 11;

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ port ' + PORT + ' pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    if (src === 'updated_at') { out[alias] = null; continue; }
    const texte = /->>[^>]*$/.test(src);
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};

// scen : 's' (des choses à corriger) · 'p' (rien publié, e-mails muets) · 'z' (tout à 0)
async function contexte(b, largeur, sombre, scen = 's', opts = {}) {
  const ctx = await b.newContext({ viewport: { width: largeur, height: largeur < 600 ? 844 : 950 }, colorScheme: sombre ? 'dark' : 'light', ...(largeur < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const MAIN = { vinted_dark: sombre, vinted_account_emails: {}, ...(opts.main || {}) };
  const ROWS = lignesBase(scen === 'z' ? M : 3 * 86400e3);
  const zero = scen === 'z';
  const semis = scen === 'p' ? null : {
    tr: { uid: UID, s: Object.fromEntries([...Object.keys(TR), ...(zero ? ['numeros-a-verifier', 'sms-vestiaire', 'sms-pickup', 'supprimes-vinted', 'remise-en-ligne', 'achats-doubles', 'litiges-en-cours', 'adresses-sans-compte'] : [])].map((k) => [k, { n: zero ? 0 : TR[k], at: MAINTENANT }])) },
    sa: { uid: UID, s: Object.fromEntries(Object.keys(SA).map((k) => [k, { n: zero ? 0 : SA[k], at: MAINTENANT }])) },
    so: { v: 1, owner: UID, partiel: false, l: zero ? VENTES.filter((v) => v[2]) : VENTES, at: MAINTENANT },
    retirer: { total: 0, prets: 0, sansCode: 0, aVerifier: 0, urgents: 0, enVerification: 0, at: MAINTENANT },
    urssaf: { mois: [], aDater: { n: zero ? 0 : ADATER, ca: 0, par: {} }, at: MAINTENANT },
  };
  await ctx.addInitScript(([s, semis]) => { try {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
    localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair'));
    if (semis && !localStorage.getItem('__banc_seme')) { localStorage.setItem('__banc_seme', '1');
      localStorage.setItem('vrm_a_trancher', JSON.stringify(semis.tr)); localStorage.setItem('vrm_sante', JSON.stringify(semis.sa)); localStorage.setItem('vrm_sources_ventes', JSON.stringify(semis.so));
      localStorage.setItem('vrm_colis_retirer', JSON.stringify(semis.retirer)); localStorage.setItem('vinted_urssaf_mois', JSON.stringify(semis.urssaf)); }
  } catch (_) {} }, [sombre, semis]);
  const ecritures = [];
  const j = (route, d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-${Math.max(0, d.length - 1)}/${d.length}` }, body: JSON.stringify(d) }).catch(() => {});
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /^https?:\/\/[^/]*vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    if (route.request().method() !== 'GET') {
      let d = []; try { const x = JSON.parse(route.request().postData() || '[]'); d = Array.isArray(x) ? x : [x]; } catch (_) {}
      const ids = d.map((x) => (x && x.id) || '?');
      if (!(ids.length === 1 && ids[0] === 'vrm_vu')) ecritures.push({ t: Date.now(), ids, url: u.replace(/^https?:\/\/[^/]+/, '').slice(0, 80) });
      const m = d.find((x) => x && (x.id === 'main' || /id=eq\.main/.test(u)) && x.data && typeof x.data === 'object'); if (m) Object.assign(MAIN, m.data);
      return j(route, d);
    }
    if (/\/app_data\?select=owner&limit=1$/.test(u)) return j(route, []);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' }).catch(() => {});
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(route, ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq && eq[1] === 'main') return j(route, [projette({ id: 'main', data: MAIN }, sel)]);
    if (eq) return j(route, ROWS.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(route, ROWS.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
    return j(route, []);
  });
  await ctx.route('**/api/**', (r) => {
    const u = r.request().url();
    if (/email-rattacher\?mode=liste/.test(u)) return scen === 'p' ? r.fulfill({ status: 503, body: '{}' }) : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, emails: Array.from({ length: zero ? 0 : MIS_DE_COTE }, (_, i) => ({ id: 'q' + i, sujet: 'Vente', raison: 'adresse', at: iso(H) })) }) });
    if (/email-rattacher\?mode=journal&compte=1/.test(u)) return scen === 'p' ? r.fulfill({ status: 503, body: '{}' }) : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, compteurs: { aVerifier: zero ? 0 : A_VERIFIER } }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  return { ctx, ecritures, MAIN };
}
const shot = (pg, nom) => pg.screenshot({ path: path.join(CAPT, 'sante-' + nom + '.png'), fullPage: true }).catch(() => {});
const ouvrirSante = async (pg) => {
  await pg.goto(`http://localhost:${PORT}/?tab=settings&section=sante`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('[data-sante]', { timeout: 30000 });
  // Les lectures (comptes, e-mails) arrivent : on attend qu'aucune ligne ne soit plus « en lecture ».
  await pg.waitForFunction(() => !document.querySelector('[data-sante-etat="lecture"]'), null, { timeout: 20000 }).catch(() => {});
  await pg.waitForTimeout(1200);
};
const lire = (pg) => pg.evaluate(() => {
  const r = document.querySelector('[data-sante]');
  return { ton: r && r.getAttribute('data-sante'), aFaire: r && Number(r.getAttribute('data-sante-a-faire')), aJour: r && r.getAttribute('data-sante-a-jour'),
    resume: ((document.querySelector('[data-sante-resume]') || {}).textContent || '').trim(),
    lignes: [...document.querySelectorAll('[data-sante-ligne]')].map((e) => { const b = e.querySelector('[data-sante-geste]'); const rb = b && b.getBoundingClientRect();
      return { cle: e.getAttribute('data-sante-ligne'), etat: e.getAttribute('data-sante-etat'), n: e.getAttribute('data-n') === '' ? null : Number(e.getAttribute('data-n')),
        valeur: ((e.querySelector('.vrm-sd-valeur') || {}).textContent || '').trim(), bouton: b ? { h: Math.round(rb.height), w: Math.round(rb.width) } : null,
        couleur: getComputedStyle(e.querySelector('.vrm-sd-valeur')).color }; }) };
});
const actif = (pg) => pg.evaluate(() => { const e = document.querySelector('.vrm-rail-button[aria-current="page"]'); const o = document.querySelector('[data-colis-onglet-choix][aria-pressed="true"]'); return { ecran: e ? e.getAttribute('data-nav-entree') : null, onglet: o ? o.getAttribute('data-colis-onglet-choix') : null }; });

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

  // ── S ──
  if (!SEUL || SEUL === 'S') for (const [largeur, sombre] of [[1512, false], [1512, true], [390, false], [390, true]]) await essaie(`S ${largeur}`, async () => {
    const nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
    const { ctx, ecritures } = await contexte(b, largeur, sombre);
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await ouvrirSante(pg);
    const e0 = ecritures.length;
    await pg.waitForTimeout(3000);
    const r = await lire(pg);
    const parCle = Object.fromEntries(r.lignes.map((l) => [l.cle, l]));
    dit(r.lignes.length === Object.keys(ATTENDU_S).length, `S ${nom} : une ligne par vérification (${Object.keys(ATTENDU_S).length})`, r.lignes.map((l) => l.cle).join(','));
    for (const [cle, n] of Object.entries(ATTENDU_S)) dit(parCle[cle] && parCle[cle].n === n, `S ${nom} : ${cle} = ${n} (fait à la main)`, parCle[cle] && `${parCle[cle].n} · ${parCle[cle].etat}`);
    dit(r.lignes[0] && r.lignes[0].cle === 'numeros-double' && r.lignes[0].etat === 'rouge', `S ${nom} : deux articles sous un N° en tête, en rouge`, r.lignes[0] && r.lignes[0].cle);
    dit(r.lignes.filter((l) => l.etat === 'rouge').length === 1, `S ${nom} : c'est la seule ligne rouge`);
    const rouge = parCle['numeros-double'], ambre = parCle['numeros-a-ecrire'];
    dit(rouge && ambre && rouge.couleur !== ambre.couleur, `S ${nom} : le rouge se voit (couleur différente de l'ambre)`, rouge && `${rouge.couleur} / ${ambre && ambre.couleur}`);
    const aCorr = r.lignes.filter((l) => l.etat === 'rouge' || l.etat === 'geste');
    dit(aCorr.length === N_A_CORRIGER && r.aFaire === N_A_CORRIGER && /^11 choses à corriger$/.test(r.resume), `S ${nom} : ${N_A_CORRIGER} choses à corriger, dites en tête`, `${aCorr.length} · ${r.aFaire} · ${r.resume}`);
    dit(aCorr.every((l) => l.bouton && l.bouton.h >= 44 && l.bouton.w >= 44), `S ${nom} : chaque ligne à corriger a UN bouton ≥ 44 px`, aCorr.filter((l) => !(l.bouton && l.bouton.h >= 44)).map((l) => l.cle + ':' + JSON.stringify(l.bouton)).join(' '));
    dit(r.lignes.filter((l) => l.etat === 'ok').every((l) => !l.bouton), `S ${nom} : une ligne à jour n'a pas de bouton`);
    dit(r.aJour === '0' && r.resume !== 'Tout est à jour ✓', `S ${nom} : pas « Tout est à jour » quand il reste à corriger`);
    const ecr = ecritures.slice(e0).filter((w) => w.ids.some((i) => !NON_DONNEES(i)));
    dit(!ecr.length, `S ${nom} : aucune écriture vers la base pendant 3 s écran ouvert`, JSON.stringify(ecr));
    const debord = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    dit(debord <= 0, `S ${nom} : aucun défilement horizontal`, debord);
    dit(!errs.length, `S ${nom} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
    await shot(pg, 'S-' + nom);
    await ctx.close();
  });

  // ── C ──
  if (!SEUL || SEUL === 'C') for (const [largeur, sombre] of [[390, true], [1512, false]]) await essaie(`C ${largeur}`, async () => {
    const nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
    const { ctx } = await contexte(b, largeur, sombre);
    const pg = await ctx.newPage();
    await pg.goto(`http://localhost:${PORT}/?tab=settings&section=toutvabien`, { waitUntil: 'domcontentloaded' });
    await pg.waitForSelector('[data-sante-compacte]', { timeout: 30000 });
    await pg.waitForFunction(() => { const e = document.querySelector('[data-sante-compacte]'); return e && Number(e.getAttribute('data-sante-a-faire')) > 0; }, null, { timeout: 20000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    const c = await pg.evaluate(() => { const e = document.querySelector('[data-sante-compacte]'); const r = e.getBoundingClientRect(); return { n: Number(e.getAttribute('data-sante-a-faire')), txt: e.textContent.trim(), h: Math.round(r.height) }; });
    dit(c.n === N_A_CORRIGER && new RegExp(`${N_A_CORRIGER} à corriger`).test(c.txt), `C ${nom} : « Tout va bien ? » dit « ${N_A_CORRIGER} à corriger » (le même nombre)`, JSON.stringify(c));
    dit(c.h >= 44, `C ${nom} : la ligne se touche (≥ 44 px)`, c.h);
    await pg.locator('[data-sante-compacte]').scrollIntoViewIfNeeded();
    await shot(pg, 'C-' + nom);
    await pg.click('[data-sante-compacte]');
    await pg.waitForSelector('[data-sante]', { timeout: 15000 }).catch(() => {});
    dit(!!(await pg.$('[data-sante]')), `C ${nom} : la toucher ouvre la Santé de tes données`);
    await ctx.close();
  });

  // ── G ──
  // (15 nov., achats-ecriture-main) Le rouge « colis-a-confirmer réécrit vinted_annonce_numeros,
  // vinted_sales, vinted_accounts… » était un EFFET DU BANC, mesuré : la ligne `main` servie ne
  // portait que deux clés, et la PREMIÈRE synchronisation de l'appareil (lancée au chargement, avant
  // tout geste) y ajoute ce que l'appareil sait — `vinted_annonce_numeros: {}`, `vinted_sales: []`,
  // la copie sans jetons de `vinted_accounts`, `vrm_je_vends`… (absent ⇒ vide, rien perdu). Sur une
  // machine chargée cet envoi arrivait APRÈS la photo « avant » : le banc l'attribuait au bouton
  // (CPU ×6 : envoi 2 s avant la photo ⇒ vert ; plus lent ⇒ rouge). Une vraie ligne `main` porte
  // déjà ces clés. D'où : (1) une ligne `main` réaliste (fiches numérotées, pool, comptes sous la
  // forme que l'app écrit) — une fiche qui existe doit rester IDENTIQUE, c'est la règle qui compte ;
  // (2) la photo « avant » prise AU REPOS (aucune écriture depuis 2,5 s) ; (3) le jugement par règle.
  const MAIN_SEME = () => ({
    vinted_annonce_numeros: {
      '9101': { numero: '5', auto: false, manuelAt: iso(30 * 86400e3), numberedAt: iso(40 * 86400e3), buyPrice: '25' },
      '9102': { numero: '12', auto: true, numberedAt: iso(20 * 86400e3), title: 'Nike Air Max 90 blanc 42', price: 70 },
    },
    vinted_used_numeros: [5, 12],
    vinted_accounts: ACCOUNTS.map(({ updated_at, ...c }) => c),
  });
  // Les publications d'écran et l'état de navigation (pas des données qu'il a saisies) : un écran
  // OUVERT publie ce qu'il a calculé de ses lectures (§11) et la reprise retient le dernier écran.
  //   · `vrm_reprise_ecrans` : le dernier écran ouvert (src/repriseSynchro.js) — ouvrir un écran l'écrit ;
  //   · `vrm_achats_jours` : la publication de l'écran Achats, jour par jour (App.jsx, « Dépensé ») ;
  //   · `vrm_annonces_achetees` : la publication de src/achatMemeAnnonce.js (`CLE_ANNONCES_ACHETEES`).
  const ETAT_ECRANS = [...PUBLIEES, 'vrm_reprise_ecrans', 'vrm_achats_jours', 'vrm_annonces_achetees'];
  // Les lignes hors `main` qu'un écran publie (§5 « un écran publie ») ou le point de restauration posé
  // AVANT une action en série (src/restauration.js, `restore_{0..23}`, une sauvegarde — jamais une donnée).
  const LIGNES_PUBLIEES = /^(widget_stats|lbc_a_retirer|restore_\d+)$/;
  // Au repos : aucune écriture vers la base depuis 2,5 s (borné à 40 s ; sinon dit).
  const auRepos = async (ecritures, t0) => {
    const fin = Date.now() + 40000;
    while (Date.now() < fin) { const der = ecritures.length ? ecritures[ecritures.length - 1].t : t0; if (Date.now() - Math.max(der, t0) > 2500) return true; await new Promise((r) => setTimeout(r, 250)); }
    return false;
  };
  const court = (v) => { const t = JSON.stringify(v === undefined ? null : v); return t.length > 240 ? t.slice(0, 240) + '…' : t; };
  const ATTENDU_G = {
    // (16 nov., bancs-rouges-a) Colis vit DANS Ventes depuis le 11 nov. (lot DJ3, revue-colis) : l'écran actif est Ventes,
    // l'onglet de colis reste jugé.
    'numeros-double': { ecran: 'ventes', onglet: 'envoyer' }, 'colis-postes': { ecran: 'ventes', onglet: 'envoyes' },
    'achats-sans-prix': { ecran: 'annonces', saisie: true }, 'ventes-sans-achat': { ecran: 'annonces', saisie: true },
    'colis-a-confirmer': { ecran: 'achats' }, 'ventes-a-dater': { ecran: 'compta' }, 'emails-mis-de-cote': { ecran: 'emails' },
    'comptes-a-relire': { reglage: 'toutvabien' }, 'annonces-a-confirmer': { ecran: 'annonces' },
  };
  if (!SEUL || SEUL === 'G') for (const cle of Object.keys(ATTENDU_G).filter((k) => !process.env.SD_CLE || k === process.env.SD_CLE)) await essaie('G ' + cle, async () => {
    const { ctx, ecritures, MAIN } = await contexte(b, 1512, false, 's', { main: MAIN_SEME() });
    const pg = await ctx.newPage();
    const t0 = Date.now();
    await ouvrirSante(pg);
    const repos = await auRepos(ecritures, t0);
    const avantMain = JSON.parse(JSON.stringify(MAIN));
    const e0 = ecritures.length;
    await pg.click(`[data-sante-geste="${cle}"]`);
    const A = ATTENDU_G[cle];
    if (A.reglage) {
      await pg.waitForSelector(`[data-sous-ecran-ouvert="${A.reglage}"]`, { timeout: 15000 }).catch(() => {});
      dit(!!(await pg.$(`[data-sous-ecran-ouvert="${A.reglage}"]`)), `G ${cle} : ouvre Paramètres → Tout va bien ?`);
    } else {
      await pg.waitForFunction((e) => { const x = document.querySelector('.vrm-rail-button[aria-current="page"]'); return x && x.getAttribute('data-nav-entree') === e; }, A.ecran, { timeout: 20000 }).catch(() => {});
      if (A.onglet) await pg.waitForFunction((o) => !!document.querySelector(`[data-colis-onglet-choix="${o}"][aria-pressed="true"]`), A.onglet, { timeout: 20000 }).catch(() => {});
      if (A.saisie) await pg.waitForSelector('[role="dialog"][aria-label="Prix d\'achat à compléter"]', { timeout: 20000 }).catch(() => {});
      const a = await actif(pg);
      dit(a.ecran === A.ecran, `G ${cle} : ouvre l'écran ${A.ecran}`, a.ecran);
      if (A.onglet) dit(a.onglet === A.onglet, `G ${cle} : sur l'onglet « ${A.onglet} » de Colis`, a.onglet);
      if (A.saisie) dit(!!(await pg.$('[role="dialog"][aria-label="Prix d\'achat à compléter"]')), `G ${cle} : la saisie en série s'ouvre`);
    }
    await pg.waitForTimeout(1500);
    await auRepos(ecritures, Date.now());
    const changees = Object.keys({ ...avantMain, ...MAIN }).filter((k) => k !== 'rev' && !ETAT_ECRANS.includes(k) && JSON.stringify(avantMain[k]) !== JSON.stringify(MAIN[k]));
    // Une clé qui existait et a changé (perdue, écrasée, remise en forme) · une clé de données apparue (inventée).
    const touchees = changees.filter((k) => avantMain[k] !== undefined).map((k) => ({ k, avant: court(avantMain[k]), apres: court(MAIN[k]) }));
    const apparues = changees.filter((k) => avantMain[k] === undefined).map((k) => ({ k, apres: court(MAIN[k]) }));
    const autres = ecritures.slice(e0).filter((w) => !w.ids.includes('main') && !/id=eq\.main/.test(w.url)).flatMap((w) => w.ids).filter((id) => !LIGNES_PUBLIEES.test(String(id)));
    dit(repos, `G ${cle} : la ligne est au repos avant le geste (première synchronisation finie)`);
    dit(!touchees.length && !apparues.length && !autres.length, `G ${cle} : le bouton n'écrit aucune donnée (il ouvre)`, JSON.stringify({ touchees, apparues, autres }));
    // La règle, en plus du « rien n'a bougé » : les fiches et le pool servis sont toujours là, à l'identique.
    const semees = MAIN_SEME();
    dit(Object.entries(semees.vinted_annonce_numeros).every(([id, f]) => JSON.stringify((MAIN.vinted_annonce_numeros || {})[id]) === JSON.stringify(f)) && semees.vinted_used_numeros.every((n) => (MAIN.vinted_used_numeros || []).map(String).includes(String(n))),
      `G ${cle} : les fiches numérotées et le pool de la base sont intacts`, court({ fiches: MAIN.vinted_annonce_numeros, pool: MAIN.vinted_used_numeros }));
    await shot(pg, 'G-' + cle);
    await ctx.close();
  });

  // ── P ──
  if (!SEUL || SEUL === 'P') for (const [largeur, sombre] of [[390, false], [1512, true]]) await essaie('P ' + largeur, async () => {
    const nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
    const { ctx } = await contexte(b, largeur, sombre, 'p');
    const pg = await ctx.newPage();
    await ouvrirSante(pg);
    const r = await lire(pg);
    const sources = ['numeros-double', 'numeros-a-ecrire', 'colis-a-confirmer', 'colis-postes', 'emails-mis-de-cote', 'emails-a-verifier', 'achats-sans-prix', 'ventes-sans-achat', 'annonces-a-confirmer'];
    const l = r.lignes.filter((x) => sources.includes(x.cle));
    dit(l.length === sources.length && l.every((x) => x.etat === 'passu' && x.n === null && x.valeur === '—'), `P ${nom} : chaque source jamais publiée (ou muette) dit « — », jamais 0`, l.map((x) => `${x.cle}=${x.valeur}`).join(' '));
    dit(r.aJour === '0' && r.resume !== 'Tout est à jour ✓', `P ${nom} : jamais « Tout est à jour »`, r.resume);
    const portes = await pg.evaluate(() => [...document.querySelectorAll('[data-sante-ouvrir]')].map((b) => ({ cle: b.getAttribute('data-sante-ouvrir'), h: Math.round(b.getBoundingClientRect().height) })));
    dit(portes.length === r.lignes.filter((x) => x.etat === 'passu').length && portes.length >= l.length && portes.every((p) => p.h >= 44), `P ${nom} : chaque ligne « pas lu » a sa porte « Ouvrir » (≥ 44 px) vers l'écran qui la compte`, JSON.stringify(portes));
    await shot(pg, 'P-' + nom);
    await ctx.close();
  });

  // ── Z ──
  if (!SEUL || SEUL === 'Z') for (const [largeur, sombre] of [[1512, false], [390, true]]) await essaie('Z ' + largeur, async () => {
    const nom = `${largeur}-${sombre ? 'sombre' : 'clair'}`;
    const { ctx } = await contexte(b, largeur, sombre, 'z');
    const pg = await ctx.newPage();
    await ouvrirSante(pg);
    const r = await lire(pg);
    const pasZero = r.lignes.filter((x) => x.n !== 0);
    dit(r.aJour === '1' && r.resume === 'Tout est à jour ✓', `Z ${nom} : tout lu et à 0 ⇒ « Tout est à jour ✓ »`, `${r.resume} · ${pasZero.map((x) => `${x.cle}=${x.etat}`).join(' ')}`);
    await shot(pg, 'Z-' + nom);
    await ctx.close();
  });

  await b.close(); srv.close();
  console.log(`\n${ok} vert(s), ${ko} rouge(s) — captures : ${CAPT}`);
  process.exit(ko ? 1 : 0);
})();
