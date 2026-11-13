// Banc : NAVIGATION FUSIONNÉE (9 nov., lot AL).
//
// Julien, mot pour mot : « Je ne pense pas qu'un onglet Republier et Favoris & offres soient
// dans des onglets à part ; ils doivent exister, rien ne doit être supprimé, mais par exemple
// les favoris et offres doivent être dans Messages et Republier dans Annonces. »
// Données INVENTÉES (le dépôt est public, harnais repris d'annonces-coherence.cjs) ; 390 px
// tactile sombre et 1512 px clair ; un faux pont d'extension (onglet Vinted sur le compte 111).
//   C. la colonne (1512) et « Plus » + la barre du bas (390) n'ont plus `republier` ni
//      `favoris` ; Annonces et Messages y sont ; « Vendre » : absent de la colonne (vide),
//      Messages seul au téléphone ;
//   A. Annonces montre « Republier » (`data-vue-republier`) : ses annonces EN LIGNE à cocher,
//      « Republier · N » ouvre l'atelier (`data-republier-action="recreer"`) ; « Republier… »
//      de la barre d'outils mène à la même vue ;
//   M. Messages montre « Favoris & offres » (`data-messages-zone="favoris"`) et l'ouvre ;
//   L. chaque ancien chemin (`?tab=republier|favoris`, `vue=…`, `cat_annonces`, `cat_msg`,
//      un filtre Leboncoin retenu, `vrm:aller`) arrive au bon écran, filtre Vinted, bonne vue ;
//   F. aucun débordement, aucune erreur de page.
// §6.1 : rouge sur origin/main (les entrées existent, la vue « Republier » non) et par mutation.
// `SHOTS` (dossier des captures), `BANC_PORT`, `DIST`.
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const DIST = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || process.env.PORT) || 9031;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'navigation-fusion');
fs.mkdirSync(SHOTS, { recursive: true });
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const auj = new Date(); const s = Math.floor(auj / 1000);
const ann = (id, o) => Object.assign({ id, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, brand_title: 'Nike', size_title: '42', status: 'Très bon état', view_count: 40, favourite_count: 0, nPhotos: 5, descLen: 60, color1: 'Blanc', catalog_id: 1242, created_at_ts: s - 12 * 86400 }, o);
const ITEMS_111 = [
  ann(9101, { title: 'Nike Air Max 90 blanche taille 42' }),
  ann(9102, { title: 'Salomon XT-6 grise taille 41', brand_title: 'Salomon', price: { amount: '120.0', currency_code: 'EUR' }, created_at_ts: s - 45 * 86400 }),
  // Titre très long : rien ne doit déborder.
  ann(9103, { title: 'Adidas Samba OG noire et blanche semelle gomme édition limitée très longue taille 39', brand_title: 'Adidas', size_title: '39' }),
  ann(9104, { title: 'Asics Gel-Kayano 14 argent taille 43', brand_title: 'Asics' }),
];
const ITEMS_222 = [
  ann(9301, { title: 'New Balance 550 crème taille 40', brand_title: 'New Balance' }),
  ann(9302, { title: 'Puma Speedcat rouge taille 38', brand_title: 'Puma' }),
  ann(9303, { title: 'Brouillon du second compte', is_draft: true }),
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_essai', domain: 'www.vinted.fr', updated_at: auj.toISOString() }, { id: 2, vinted_user_id: '222', login: 'autre_essai', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
// Deux prix d'achat connus sur six annonces en ligne (9101, 9301).
const MAIN = { vinted_annonce_numeros: { 9101: { numero: '11', buyPrice: '30' }, 9102: { numero: '12' }, 9103: { numero: '13' }, 9301: { numero: '21', buyPrice: '25' }, 9302: { numero: '22' } } };
const ATTENDU_ACHATS = '2/6';
const lignes = () => [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS_111, pagination: { total_entries: ITEMS_111.length } } } },
  { id: 'harvest_222_listings', data: { capturedAt: auj.toISOString(), payload: { items: ITEMS_222, pagination: { total_entries: ITEMS_222.length } } } },
];
const VERSION = (/EXT_ATTENDUE = '([\d.]+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.322.0';
const PONT = (o) => {
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version: o.version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version: o.version, code: o.version, ext: 'banc-ext', vrm: { ok: true, connecte: true, email: '' }, vinted: { uid: '111', login: 'compte_essai' }, cmds: {} } });
    if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'recent' } });
  });
  post({ __vmr: 'ready', version: o.version });
};

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (!c) ko++; else ok++; console.log((c ? 'OK  ' : 'KO  ') + m + (d !== undefined && d !== '' && !c ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec un autre BANC_PORT'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^(data|meta)(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
async function contexte(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sb) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', sb ? 'true' : 'false'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: VERSION });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    const t = r.request().resourceType();
    if (t === 'document') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>vinted (banc)</title>' });
    if (['image', 'media', 'font'].includes(t)) return r.abort();
    return r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const rows = lignes();
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
const clic = async (pg, sel) => { const l = pg.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 4000 }).catch(async () => { await pg.$eval(sel, (x) => x.click()); }); };
const fermer = async (pg) => { const x = pg.locator('[role="dialog"] button[aria-label="Fermer"]').last(); if (await x.count()) await x.click().catch(() => pg.keyboard.press('Escape')); else await pg.keyboard.press('Escape'); await pg.waitForTimeout(350); };
// Couleurs : le bleu d'accent (aplat et texte, clair et sombre) et l'ambre.
const BLEUS = ['rgb(0, 113, 227)', 'rgb(10, 132, 255)', 'rgb(0, 102, 204)', 'rgb(64, 156, 255)'];
const AMBRES = ['rgb(178, 80, 0)', 'rgb(255, 179, 64)', 'rgb(201, 52, 0)', 'rgb(255, 159, 10)'];
const TUILES = ['Republier', 'Modifier prix ou titre', 'Mettre en brouillon', 'Mettre en ligne'];

async function ouvrirAnnonces(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
  await pg.locator('[data-carte-annonce]').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
  for (let i = 0; i < 30; i++) { if ((await pg.locator('[data-carte-annonce]').count()) >= 6) break; await pg.waitForTimeout(250); }
  // (9 nov.) Depuis l'attente d'écran (6 nov., src/AttenteEcran.jsx), les cartes sont MONTÉES
  // invisibles (`visibility:hidden`) avant que l'écran s'ouvre : « attachées » ne veut plus dire
  // « montrées ». On attend que l'écran de démarrage soit parti et que l'écran soit OUVERT.
  for (let i = 0; i < 80; i++) {
    const pret = await pg.evaluate(() => { const e = document.querySelector('[data-attente-ecran="cat_annonces"]'); return !document.getElementById('vrm-demarrage') && !!e && /pret|plafond/.test(e.getAttribute('data-attente') || ''); }).catch(() => false);
    if (pret) break; await pg.waitForTimeout(250);
  }
  await pg.waitForTimeout(600);
}
const attendre = async (pg, f, arg, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await pg.evaluate(f, arg).catch(() => null); if (v) return v; await pg.waitForTimeout(200); } return pg.evaluate(f, arg).catch(() => null); };
const ecran = () => { const s = document.querySelector('section.vrm-tache[data-tache]'); const vis = s && s.getBoundingClientRect().height > 0; return vis ? { tache: s.getAttribute('data-tache'), site: s.getAttribute('data-tache-site') } : null; };
const vueRep = () => { const v = document.querySelector('[data-selection-vue="republier"]'); return v && v.getBoundingClientRect().height > 0 ? { n: Number(v.getAttribute('data-selection-n')), ids: [...v.querySelectorAll('[data-selection-annonce]')].map((x) => x.getAttribute('data-selection-annonce') + ':' + x.getAttribute('data-selection-etat')) } : null; };
const zoneFav = () => { const b = document.querySelector('[data-messages-zone="favoris"]'); if (!b || b.getBoundingClientRect().height === 0) return null; const z = b.parentElement && b.parentElement.nextElementSibling; return { presse: b.getAttribute('aria-pressed') === 'true', texte: b.textContent.trim(), zoneVisible: !!(z && !z.hidden && z.getBoundingClientRect().height > 0), contenu: z ? z.childElementCount : 0 }; };
// Un `goto` peut être interrompu par une navigation que l'app lance elle-même (remplacement d'adresse) : une seconde fois.
const ouvrirA = async (pg) => { try { await ouvrirAnnonces(pg); } catch (_) { await pg.waitForTimeout(800); await ouvrirAnnonces(pg); } };
const allerLien = async (pg, q) => { await pg.goto(`http://localhost:${PORT}/${q}`, { waitUntil: 'domcontentloaded' }).catch(async () => { await pg.waitForTimeout(800); await pg.goto(`http://localhost:${PORT}/${q}`, { waitUntil: 'domcontentloaded' }); }); for (let i = 0; i < 80; i++) { if (!(await pg.evaluate(() => !!document.getElementById('vrm-demarrage')).catch(() => true))) break; await pg.waitForTimeout(250); } await pg.waitForTimeout(800); };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: CHROMIUM, args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    // 390 px tactile en sombre, 1512 px en clair (la demande : « 390 tactile sombre + 1512 »).
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, true], [{ width: 1512, height: 950 }, false]]) {
      const tel = vp.width < 600;
      const T = `${vp.width}${sombre ? ' sombre' : ' clair'}`;
      const nomF = (x) => path.join(SHOTS, `nf-${vp.width}-${x}.png`);
      console.log(`── ${T}`);
      const { ctx, pg, errs } = await contexte(b, vp, sombre);
      try {
        // ── C : la navigation n'a plus ces deux entrées ──
        await ouvrirA(pg);
        if (tel) {
          await pg.locator('.vrm-mobile-nav button[aria-label^="Plus"]').tap().catch(() => {});
          await pg.waitForSelector('.vrm-sheet [data-nav-entree]', { timeout: 5000 }).catch(() => {});
        }
        const nav = await pg.evaluate((tel) => {
          const zone = tel ? document.querySelector('.vrm-sheet') : document.querySelector('.vrm-sidebar');
          if (!zone) return null;
          const barre = tel ? [...document.querySelectorAll('.vrm-mobile-nav [data-nav-entree]')].map((e) => e.getAttribute('data-nav-entree')) : [];
          return { entrees: [...zone.querySelectorAll('[data-nav-entree]')].map((e) => e.getAttribute('data-nav-entree')), barre, groupes: [...zone.querySelectorAll('[data-nav-groupe]')].map((g) => g.getAttribute('data-nav-groupe') + '=' + [...g.querySelectorAll('[data-nav-entree]')].map((e) => e.getAttribute('data-nav-entree')).join('+')), textes: zone.innerText };
        }, tel);
        await pg.screenshot({ path: nomF('navigation') });
        // (12 nov., finitions) Au téléphone, « Plus » ne porte plus que Messages, Stock, E-mails, Argent et
        // Communauté (GROUPES_PLUS) : Paramètres est passé au menu du profil (DJ6), « À trancher » dans Ma
        // journée (DJ4), Republier et Favoris dans leurs écrans (AL) — décisions de Julien. « ≥ 8 » datait
        // d'avant : la règle est désormais la liste voulue, entrée par entrée (aucune perdue), et rien d'autre.
        const PLUS_VOULU = ['messages', 'garage', 'emails', 'compta', 'communaute'];
        dit(nav && (tel ? PLUS_VOULU.every((k) => nav.entrees.includes(k)) && nav.entrees.length === PLUS_VOULU.length : nav.entrees.length >= 8), `C ${T} ${tel ? '« Plus » porte ses 5 entrées (Messages, Stock, E-mails, Argent, Communauté)' : 'la colonne est rendue'}`, nav && nav.entrees.join(','));
        dit(nav && !nav.entrees.some((e) => e === 'republier' || e === 'favoris') && !nav.barre.some((e) => e === 'republier' || e === 'favoris') && !/Republier|Favoris & offres/.test(nav.textes), `C ${T} ni « Republier » ni « Favoris & offres » dans la navigation`, nav && nav.entrees.join(','));
        dit(nav && (tel ? nav.barre : nav.entrees).includes('annonces') && nav.entrees.includes('messages'), `C ${T} Annonces et Messages, eux, y sont`, nav && nav.entrees.join(','));
        dit(nav && (tel ? nav.groupes.some((g) => g === 'Vendre=messages') : !nav.groupes.some((g) => /^Vendre=/.test(g))), `C ${T} le groupe « Vendre » : ${tel ? 'Messages seul au téléphone' : 'vide, donc absent de la colonne'}`, nav && nav.groupes.join(' | '));
        if (tel) { await pg.keyboard.press('Escape').catch(() => {}); await pg.waitForTimeout(500); }

        // ── A : Annonces porte « Republier » ──
        await ouvrirA(pg);
        const seg = await pg.evaluate(() => { const x = document.querySelector('[data-vue-republier]'); if (!x) return null; const r = x.getBoundingClientRect(); return { t: x.textContent.trim(), h: Math.round(r.height), vis: r.height > 0, groupe: !!x.closest('.vrm-stock-views') }; });
        dit(seg && seg.vis && seg.groupe && /Republier/.test(seg.t), `A ${T} Annonces montre « Republier » dans ses vues`, JSON.stringify(seg));
        if (tel) dit(seg && seg.h >= 43.5, `A ${T} 44 px au doigt`, seg && String(seg.h));
        await clic(pg, '[data-vue-republier]');
        const v = await attendre(pg, vueRep);
        dit(v && v.ids.length >= 4 && v.ids.every((x) => /:en-ligne$/.test(x)) && !v.ids.some((x) => x.startsWith('9303:')), `A ${T} la vue « Republier » : ses annonces EN LIGNE seulement (pas le brouillon)`, JSON.stringify(v));
        await pg.screenshot({ path: nomF('annonces-republier') });
        await clic(pg, '[data-selection-annonce="9101"] input');
        const lancer = await attendre(pg, () => { const x = document.querySelector('[data-republier-lancer]'); return x ? x.getAttribute('data-republier-lancer') : null; });
        dit(lancer === '1', `A ${T} une paire cochée ⇒ « Republier · 1 »`, String(lancer));
        await clic(pg, '[data-republier-lancer]');
        const at = await attendre(pg, () => { const x = document.querySelector('[data-republier-action]'); return x ? { action: x.getAttribute('data-republier-action'), etape: x.getAttribute('data-republier-etape') } : null; });
        dit(at && at.action === 'recreer' && at.etape === 'modif', `A ${T} « Republier » ouvre l'atelier (recreer, à l'étape d'après le choix)`, JSON.stringify(at));
        await pg.screenshot({ path: nomF('atelier') });
        await fermer(pg);
        // La barre d'outils « Republier… » mène à la même vue.
        await clic(pg, '[data-vue-toutes]');
        await clic(pg, '[data-actions-ouvrir]');
        dit(!!(await attendre(pg, vueRep)), `A ${T} « Republier… » de la barre d'outils mène à la même vue`);

        // ── M : Messages porte « Favoris & offres » ──
        await allerLien(pg, '?tab=messages&site=vinted');
        let z = await attendre(pg, zoneFav);
        dit(z && /Favoris/.test(z.texte) && /offres/.test(z.texte), `M ${T} Messages montre « Favoris & offres »`, JSON.stringify(z));
        await clic(pg, '[data-messages-zone="favoris"]');
        z = await attendre(pg, () => { const b = document.querySelector('[data-messages-zone="favoris"]'); const z = b && b.parentElement.nextElementSibling; return b && b.getAttribute('aria-pressed') === 'true' && z && !z.hidden && z.getBoundingClientRect().height > 0 ? { contenu: z.childElementCount, texte: z.innerText.slice(0, 80) } : null; });
        dit(z && z.contenu > 0, `M ${T} la section ouvre ses fonctions (FavorisConnectes rendu)`, JSON.stringify(z));
        await pg.screenshot({ path: nomF('messages-favoris') });

        // ── L : les anciens chemins mènent au nouvel endroit ──
        const cas = [
          ['?tab=republier', 'annonces', 'rep'],
          ['?tab=cat_annonces&vue=republier', 'annonces', 'rep'],
          ['?tab=annonces&vue=republier', 'annonces', 'rep', 'leboncoin'],
          ['?tab=favoris', 'messages', 'fav'],
          ['?tab=cat_msg&vue=favoris', 'messages', 'fav'],
          ['?tab=messages&vue=favoris', 'messages', 'fav', 'leboncoin'],
          ['?tab=messages&site=vinted&vue=favoris', 'messages', 'fav'],
        ];
        for (const [q, tache, quoi, retenu] of cas) {
          await pg.evaluate((r) => { try { if (r) localStorage.setItem('vrm_filtre_site', JSON.stringify({ annonces: r, messages: r })); else localStorage.removeItem('vrm_filtre_site'); sessionStorage.removeItem('vrm_vue_session'); } catch (_) {} }, retenu || '');
          await allerLien(pg, q);
          const e = await attendre(pg, ecran);
          const ok = quoi === 'rep' ? await attendre(pg, vueRep) : await attendre(pg, () => { const b = document.querySelector('[data-messages-zone="favoris"]'); return b && b.getAttribute('aria-pressed') === 'true'; });
          dit(e && e.tache === tache && e.site === 'vinted' && !!ok, `L ${T} ${q}${retenu ? ` (filtre retenu : ${retenu})` : ''} ⇒ ${tache} · Vinted · ${quoi === 'rep' ? 'Republier' : 'Favoris & offres'}`, JSON.stringify({ e, ok }));
        }
        await pg.evaluate(() => { try { localStorage.removeItem('vrm_filtre_site'); } catch (_) {} });
        // Un écran qui y mène par l'évènement `vrm:aller` (le journal des e-mails, etc.).
        for (const [cle, tache] of [['republier', 'annonces'], ['favoris', 'messages']]) {
          await allerLien(pg, '?tab=journee');
          await pg.evaluate((c) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: c })), cle);
          const e = await attendre(pg, (t) => { const s = document.querySelector(`section.vrm-tache[data-tache="${t}"]`); return s && s.getBoundingClientRect().height > 0; }, tache);
          const ok = cle === 'republier' ? await attendre(pg, vueRep) : await attendre(pg, () => { const b = document.querySelector('[data-messages-zone="favoris"]'); return b && b.getAttribute('aria-pressed') === 'true'; });
          dit(!!e && !!ok, `L ${T} \`vrm:aller\` « ${cle} » ⇒ ${tache}, sur sa vue`, JSON.stringify({ e, ok }));
        }

        const deb = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        dit(deb <= 1, `F ${T} aucun débordement horizontal`, String(deb));
        dit(!errs.length, `F ${T} aucune erreur de page`, errs.slice(0, 2).join(' | '));
      } catch (e) { dit(false, `${T} le parcours s'arrête`, e.message.split('\n')[0]); await pg.screenshot({ path: nomF('erreur') }).catch(() => {}); }
      await ctx.close();
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\nKO  ${ko} rouge(s), ${ok} vert(s) — captures : ${SHOTS}` : `\nOK  navigation fusionnée : ${ok} verts — captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})();
