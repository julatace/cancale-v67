// Banc : L'ANNONCE SUPPRIMÉE SORT DE VRM, ET L'ÉCRAN DIT DE QUAND DATE CE QU'IL MONTRE
// (10-11 octobre, extension 5.165).
//
// Julien, 9 octobre 18:40 : « je viens de supp bcp de paires de chaussures et
// elles sont encore marquées dans les annonces ». MESURÉ : le dressing de cinq
// comptes datait de la veille au soir (~41 annonces affichées « en ligne »), et
// l'écran Annonces ne disait NULLE PART de quand datait sa lecture (il ne
// prévenait qu'au-delà de 7 jours).
// Sur des données INVENTÉES (il vit dans le dépôt, qui est public), aux deux
// tailles, il exige :
//   1. une annonce supprimée APRÈS la lecture du dressing (`harvest_{uid}_supprimees`,
//      par son IDENTIFIANT Vinted) n'est plus sur l'écran Annonces, ni dans le
//      chiffre « Annonces en ligne » du tableau de bord, ni dans la file
//      Leboncoin de l'app ; les autres restent ;
//   2. le dressing RELU après la suppression fait foi (la carte revient s'il la
//      montre encore) ;
//   3. « pas su » ne cache rien : la ligne des suppressions illisible (522) ⇒
//      la carte reste, et rien n'est affirmé sur des suppressions ;
//   4. au-delà de 30 min, la date de la lecture est DITE, une fois au-dessus de
//      la grille (§7), en nommant le compte ; un compte frais n'est pas nommé ;
//      rien n'est dit quand tout est frais (l'autre sens) ;
//   5. en direct : l'extension prévient (`maj · annonces`), la carte part sans
//      recharger la page ;
//   6. aucun débordement à 390 px, aucune erreur d'app.
// Revue de la 5.165 (11 octobre), reproduit au rendu :
//   8. pas de « ✓ à jour » (ventes) au-dessus de la section Annonces ;
//   9. tous les comptes à repasser NOMMÉS (pas « a, b, c et 3 autres ») ;
//  10. le seuil : 12 h, ou vu actif après la lecture — pas 30 min pour tous ;
//  11. sur iPhone sans extension, le geste dit OÙ il se fait ;
//  12. le compteur = les cartes retirées (pas les pauses ni les brouillons) ;
//  13. « sort d'ici tout de suite » : une extension à jour ET seule, avec le geste.
// Ce qui est jugé : la présence des cartes (`data-carte-annonce`), des attributs
// `data-*` et des nombres rendus — pas une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 5731;

const now = Date.now();
const iso = (h) => new Date(now - h * 3600e3).toISOString();
const ACCS = [
  { id: 1, vinted_user_id: '111', login: 'compte_hier', domain: 'www.vinted.fr', updated_at: iso(0) },
  { id: 2, vinted_user_id: '222', login: 'compte_frais', domain: 'www.vinted.fr', updated_at: iso(0) },
];
const ann = (id, title, o) => Object.assign({ id, title, price: { amount: '49.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false,
  photo: null, brand_title: 'Marque', size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 0, nPhotos: 4 }, o);
// compte_hier (111) : dressing lu il y a 20 h — 3 annonces dont 7002 qu'il a SUPPRIMÉE il y a 2 h.
// compte_frais (222) : dressing lu il y a 5 min.
const dressing111 = (capH, items) => ({ id: 'harvest_111_listings', data: { uid: '111', capturedAt: iso(capH), nItems: items.length,
  payload: { items, pagination: { total_entries: items.length, total_pages: 1 } } } });
const ITEMS_111 = [ann(7001, 'Zeta Garde Alpha 42'), ann(7002, 'Zeta Supprimee Beta 41'), ann(7003, 'Zeta Garde Gamma 43')];
const BASE = () => [
  { id: 'main', data: { vinted_annonce_numeros: { '7001': { numero: '11' }, '7002': { numero: '12' }, '7003': { numero: '13' }, '8001': { numero: '21' } } } },
  dressing111(20, ITEMS_111),
  { id: 'harvest_222_listings', data: { uid: '222', capturedAt: new Date(now - 5 * 60e3).toISOString(), nItems: 1, payload: { items: [ann(8001, 'Zeta Fraiche Delta 40')], pagination: { total_entries: 1, total_pages: 1 } } } },
];
const SUPP = { id: 'harvest_111_supprimees', data: { uid: '111', ids: { '7002': iso(2) } } };

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
// Les ponts d'extension, dans la vraie forme (`ping` → `ready {version[, id]}`).
// Par défaut UN pont à jour (les états « ok » de la phrase) ; `[]` : aucune
// extension (téléphone) ; deux ponts d'identifiants différents : deux extensions.
// La VRAIE forme de l'état (§6.3) : à partir de `CODE_DANS_ETAT` (lu dans la
// source), une extension joint `code` — sans lui, l'app la dit « périmée ».
const PONTS = ({ ponts, codeDansEtat }) => {
  const post = (m) => window.postMessage(m, '*');
  const vn = (v) => String(v || '').split('.').map((x) => parseInt(x, 10) || 0);
  const auMoins = (v, r) => { const a = vn(v), b = vn(r); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return true; };
  ponts.forEach((p) => {
    const ready = () => post(Object.assign({ __vmr: 'ready', version: p.version }, p.id ? { id: p.id } : {}));
    window.addEventListener('message', (e) => {
      const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
      if (d.__vmr === 'ping') ready();
      if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version: p.version, vrm: { ok: true, connecte: true, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' /* la session de banc (_porte-banc.cjs) */ }, vinted: null, cmds: {} }, codeDansEtat && auMoins(p.version, codeDansEtat) ? { code: p.version } : {}) });
    });
    ready();
  });
};
// « À jour » = la version que l'app ATTEND (EXT_ATTENDUE, lue dans la source) :
// une version écrite ici vieillirait au prochain numéro et ferait passer l'état
// « ok » pour « en retard » (la relecture des autres comptes arrive en 5.167).
const VERSION_A_JOUR = (fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8').match(/const EXT_ATTENDUE = '([\d.]+)'/) || [])[1];
const CODE_DANS_ETAT = (fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8').match(/const CODE_DANS_ETAT = '([\d.]+)'/) || [])[1] || '';
if (!VERSION_A_JOUR) { console.log('KO EXT_ATTENDUE introuvable dans src/App.jsx'); process.exit(1); }
const UN_PONT = [{ version: VERSION_A_JOUR, id: 'ext1' }];

async function rendre(b, { lignes, suppKO = false, tel = false, mobile, onglet = 'cat_annonces', etat = {}, ponts = UN_PONT, accs, section }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const mob = mobile === undefined ? tel : mobile;
  const ctx = await b.newContext({ viewport: vp, ...(mob ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(PONTS, { ponts, codeDansEtat: CODE_DANS_ETAT });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accs || ACCS);
    // La ligne des suppressions ILLISIBLE (522 Cloudflare, en HTML), la base debout par ailleurs.
    if ((suppKO || etat.suppKO) && /_supprimees/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    const L = etat.lignes || lignes;
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || iso(0), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  // Le relais Vinted en panne : l'app ne doit vivre que de la moisson.
  await pg.route('**/api/**', (r) => (/vinted-proxy/.test(r.request().url())
    ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"erreur":"pas-su"}' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' })));
  await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' });
  // Sous charge (plusieurs bancs à la fois), le premier rendu peut dépasser
  // 4,5 s : on attend que l'écran ait DIT quelque chose (une carte, le chiffre du
  // tableau de bord, la file) — au plus 25 s. Un écran qui ne rend jamais reste
  // rouge : l'attente ne cache rien, elle évite de mesurer la charge du banc.
  await pg.waitForFunction(() => document.querySelector('[data-carte-annonce]')
    || (document.querySelector('[data-dash-stat="online"]') && /\d/.test(document.querySelector('[data-dash-stat="online"]').innerText))
    || /Zeta/.test(document.body.innerText), null, { timeout: 25000 }).catch(() => {});
  await pg.waitForTimeout(2000);
  if (section) { await pg.click(`[data-section="${section}"]`); await pg.waitForTimeout(2500); }
  return { ctx, pg, errs };
}
const lireAnnonces = (pg) => pg.evaluate(() => {
  const f = [...document.querySelectorAll('[data-ann-fraicheur]')];
  const el = f[0];
  return {
    cartes: [...document.querySelectorAll('[data-carte-annonce]')].map((x) => x.getAttribute('data-carte-annonce')).sort(),
    nFraicheur: f.length,
    vieux: el ? el.getAttribute('data-vieux') : null,
    supprimees: el ? el.getAttribute('data-supprimees') : null,
    promesse: el ? el.getAttribute('data-promesse') : null,
    ailleurs: el ? el.getAttribute('data-ailleurs') : null,
    // La coche « à jour » se reconnaît à ce qu'elle DIT (elle n'avait pas
    // d'attribut avant : un contrôle posé sur un attribut neuf serait vert par
    // accident sur le code d'avant).
    // 27 oct. (« téléphone épuré », demande de Julien) : sur téléphone la coche
    // porte `vrm-aide` et se tait. On la compte dans le DOM (cachée comprise) :
    // « aucune coche au-dessus du dressing » reste plus strict, et « elle reste
    // sur Ventes » juge qu'elle est rendue, pas qu'elle est montrée au doigt.
    aJour: (document.body.textContent.match(/✓ (Données|Ventes) Vinted à jour/g) || []).length,
    texte: el ? el.innerText : '',
    couleurs: el ? [...el.querySelectorAll('*')].concat([el]).map((x) => getComputedStyle(x).color) : [],
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
});
const lireDash = (pg) => pg.evaluate(() => {
  const s = document.querySelector('[data-dash-stat="online"]');
  const f = [...document.querySelectorAll('[data-dash-fraicheur]')];
  return { online: s ? (s.innerText.match(/\d+/) || [null])[0] : null, nFraicheur: f.length,
    vieux: f[0] ? f[0].getAttribute('data-vieux') : null, supprimees: f[0] ? f[0].getAttribute('data-supprimees') : null, texte: f[0] ? f[0].innerText : '' };
});

(async () => {
  let b;
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    for (const tel of [false, true]) {
      const t = tel ? '390 px' : '1512 px';
      console.log(`── 1. ${t} — lu il y a 20 h, 7002 supprimée il y a 2 h`);
      await essaie('1 ' + t, async () => {
        const r = await rendre(b, { lignes: [...BASE(), SUPP], tel });
        const a = await lireAnnonces(r.pg);
        dit(!a.cartes.includes('7002'), `${t} : l’annonce SUPPRIMÉE après la lecture n’est plus sur l’écran Annonces`, JSON.stringify(a.cartes));
        dit(a.cartes.includes('7001') && a.cartes.includes('7003') && a.cartes.includes('8001'), `${t} : les autres restent (une identité, pas un compte entier)`, JSON.stringify(a.cartes));
        dit(a.nFraicheur === 1, `${t} : la date de la lecture est dite UNE fois au-dessus de la grille (§7)`, `${a.nFraicheur} bloc(s)`);
        dit(a.vieux === '111' && /compte_hier/.test(a.texte) && !/compte_frais/.test(a.texte), `${t} : elle NOMME le compte lu il y a 20 h, pas celui lu il y a 5 min`, JSON.stringify({ vieux: a.vieux, texte: a.texte }));
        // 5.165 (11 octobre) : une extension à jour relit le dressing PUBLIC des
        // autres comptes à chaque visite — le geste vrai n'est plus « ouvre ce
        // compte-là », c'est une visite sur Vinted, sur n'importe lequel.
        dit(/prochaine visite sur Vinted, sur n.importe lequel de tes comptes/.test(a.texte), `${t} : avec le geste vrai (une visite sur Vinted, sur n'importe lequel de ses comptes)`, a.texte);
        dit(a.supprimees === '1', `${t} : et elle dit combien ont été retirées parce que supprimées`, JSON.stringify(a.supprimees));
        dit(a.sw <= a.cw + 1, `${t} : aucun débordement`, `${a.sw} > ${a.cw}`);
        dit(r.errs.length === 0, `${t} : aucune erreur d’app`, r.errs.join(' | ').slice(0, 160));
        await r.pg.screenshot({ path: path.join(os.tmpdir(), `supprimees-annonces-${tel ? 390 : 1512}.png`), fullPage: false });
        await r.ctx.close();
      });
    }

    console.log('── 2. Tableau de bord : le même chiffre, la même phrase');
    await essaie('2', async () => {
      const r = await rendre(b, { lignes: [...BASE(), SUPP], onglet: 'dashboard' });
      await r.pg.waitForTimeout(1500);
      const d = await lireDash(r.pg);
      dit(d.online === '3', '« Annonces en ligne » compte 3 (7001, 7003, 8001), pas 4', JSON.stringify(d));
      dit(d.nFraicheur === 1 && d.vieux === '111' && d.supprimees === '1', 'la même phrase que l’écran Annonces, une fois', JSON.stringify(d));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    });

    console.log('── 3. File Leboncoin de l’app');
    await essaie('3', async () => {
      const r = await rendre(b, { lignes: [...BASE(), SUPP], onglet: 'leboncoin' });
      await r.pg.waitForTimeout(1500);
      const txt = await r.pg.evaluate(() => document.body.innerText);
      dit(!/Zeta Supprimee Beta/.test(txt) && /Zeta Garde Alpha/.test(txt), 'l’annonce supprimée n’est pas proposée à la publication, l’autre l’est', (txt.match(/Zeta [A-Za-z]+ [A-Za-z]+/g) || []).join(' · '));
      await r.ctx.close();
      const r2 = await rendre(b, { lignes: [...BASE(), SUPP], onglet: 'leboncoin', suppKO: true });
      await r2.pg.waitForTimeout(1500);
      const txt2 = await r2.pg.evaluate(() => document.body.innerText);
      dit(/Zeta Supprimee Beta/.test(txt2), '« pas su » (suppressions illisibles) : la paire reste dans la file', (txt2.match(/Zeta [A-Za-z]+ [A-Za-z]+/g) || []).join(' · '));
      await r2.ctx.close();
    });

    console.log('── 4. Le dressing RELU après la suppression fait foi');
    await essaie('4', async () => {
      // relu il y a 1 h (la suppression date de 2 h) et la montre encore : elle revient.
      const r = await rendre(b, { lignes: [BASE()[0], dressing111(1, ITEMS_111), BASE()[2], SUPP] });
      const a = await lireAnnonces(r.pg);
      dit(a.cartes.includes('7002'), 'relu APRÈS la suppression et toujours en vente : la carte est là', JSON.stringify(a.cartes));
      dit(a.supprimees !== '1', 'et rien n’est affirmé sur une suppression', JSON.stringify(a.supprimees));
      await r.ctx.close();
    });

    console.log('── 5. « Pas su » : la ligne des suppressions est illisible');
    await essaie('5', async () => {
      const r = await rendre(b, { lignes: [...BASE(), SUPP], suppKO: true });
      const a = await lireAnnonces(r.pg);
      dit(a.cartes.includes('7002'), 'la carte RESTE (« pas su » ne cache pas une paire vivante)', JSON.stringify(a.cartes));
      dit(a.supprimees === '0' && !/supprimée/.test(a.texte.split('annonces lues')[0] || ''), 'aucune suppression affirmée', JSON.stringify({ s: a.supprimees, t: a.texte }));
      dit(a.vieux === '111', 'mais la date de la lecture est toujours dite (elle, on la connaît)', JSON.stringify(a.vieux));
      await r.ctx.close();
    });

    console.log('── 6. L’autre sens : tout est frais, rien de supprimé');
    await essaie('6', async () => {
      const r = await rendre(b, { lignes: [BASE()[0], dressing111(0.1, ITEMS_111), BASE()[2]] });
      const a = await lireAnnonces(r.pg);
      dit(a.nFraicheur === 0 && a.cartes.length === 4, 'aucune phrase : rien à dire quand tout a été lu il y a moins de 30 min', JSON.stringify(a));
      await r.ctx.close();
    });

    console.log('── 7. En direct : l’extension prévient, la carte part sans recharger');
    await essaie('7', async () => {
      const etat = { lignes: BASE() };
      const r = await rendre(b, { lignes: BASE(), etat });
      const a0 = await lireAnnonces(r.pg);
      dit(a0.cartes.includes('7002'), 'avant : 7002 est là (aucune suppression rangée)', JSON.stringify(a0.cartes));
      etat.lignes = [...BASE(), SUPP];                     // l'extension vient de la ranger…
      await r.pg.evaluate(() => window.postMessage({ __vmr: 'evt', evt: { type: 'maj', quoi: 'annonces', uid: '111' } }, '*'));   // …et prévient
      await r.pg.waitForTimeout(2500);
      const a1 = await lireAnnonces(r.pg);
      dit(!a1.cartes.includes('7002') && a1.cartes.includes('7001'), 'après « maj · annonces » : 7002 est partie, sans rechargement', JSON.stringify(a1.cartes));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    });
    // ════════════════════════════════════════════════════════════════════
    // Revue de la 5.165 (11 octobre) — défauts reproduits au rendu
    // ════════════════════════════════════════════════════════════════════
    const ventes = (u, capMin) => ({ id: `harvest_${u}_orders_sold`, data: { uid: u, capturedAt: new Date(now - capMin * 60e3).toISOString(), nItems: 1,
      payload: { my_orders: [{ transaction_id: Number(u) * 10 + 1, title: 'Vente ' + u, status: 'Commande finalisée', price: { amount: '30.0', currency_code: 'EUR' }, date: iso(30) }], pagination: { total_pages: 1 } } } });

    for (const tel of [false, true]) {
      const t = tel ? '390 px' : '1512 px';
      console.log(`── 8. ${t} — Vinted → Annonces : pas de « ✓ à jour » des ventes au-dessus d’un dressing d’hier`);
      await essaie('8 ' + t, async () => {
        const lignes = [...BASE(), ventes('111', 3), ventes('222', 3)];
        const r = await rendre(b, { lignes, tel, mobile: false, onglet: 'plat_vinted', section: 'annonces' });
        const a = await lireAnnonces(r.pg);
        dit(a.nFraicheur === 1 && a.aJour === 0, `${t} : la date du dressing est dite, et AUCUNE coche « à jour » ne la contredit sur le même écran (§11, §5)`, JSON.stringify({ fraicheur: a.nFraicheur, aJour: a.aJour }));
        await r.pg.click('[data-section="ventes"]'); await r.pg.waitForTimeout(2500);
        const v = await lireAnnonces(r.pg);
        dit(v.aJour === 1, `${t} : l’autre sens — sur la section Ventes, la coche des ventes captées à l’instant reste`, JSON.stringify({ aJour: v.aJour }));
        dit(r.errs.length === 0, `${t} : aucune erreur d’app`, r.errs.join(' | ').slice(0, 160));
        await r.ctx.close();
      });
    }

    console.log('── 9. Six comptes lus hier : TOUS nommés (sur Annonces et sur le tableau de bord)');
    await essaie('9', async () => {
      const uids = ['301', '302', '303', '304', '305', '306'];
      const accs = uids.map((u, i) => ({ id: 10 + i, vinted_user_id: u, login: 'compte_' + u, domain: 'www.vinted.fr', updated_at: iso(0) }));
      const lignes = [{ id: 'main', data: { vinted_annonce_numeros: {} } },
        ...uids.map((u, i) => ({ id: `harvest_${u}_listings`, data: { uid: u, capturedAt: iso(20 + 3 * i), nItems: 1, payload: { items: [ann(9100 + i, 'Zeta Six ' + u)], pagination: { total_entries: 1, total_pages: 1 } } } }))];
      for (const onglet of ['cat_annonces', 'dashboard']) {
        const r = await rendre(b, { lignes, accs, onglet });
        if (onglet === 'dashboard') await r.pg.waitForTimeout(1500);
        const txt = await r.pg.evaluate((sel) => { const el = document.querySelector(sel); return el ? el.innerText : ''; }, onglet === 'dashboard' ? '[data-dash-fraicheur]' : '[data-ann-fraicheur]');
        const manquent = uids.filter((u) => !txt.includes('compte_' + u));
        dit(txt && !manquent.length, `${onglet} : les six comptes à repasser sont NOMMÉS (le geste est par compte)`, manquent.length ? `absents : ${manquent.join(', ')} · « ${txt.slice(0, 160)} »` : '');
        await r.ctx.close();
      }
    });

    console.log('── 10. Le seuil : actionnable, pas permanent');
    await essaie('10', async () => {
      // Dressing lu il y a 2 h, rien vu depuis : pas nommé (avant : nommé au bout de 30 min, tous les comptes, tout le temps).
      const L2h = [BASE()[0], dressing111(2, ITEMS_111), BASE()[2]];
      const r = await rendre(b, { lignes: L2h });
      const a = await lireAnnonces(r.pg);
      dit(a.nFraicheur === 0, 'un dressing lu il y a 2 h, sans activité vue depuis, n’est pas nommé (30 min faisait du bruit permanent sur 7 comptes)', JSON.stringify({ n: a.nFraicheur, vieux: a.vieux }));
      await r.ctx.close();
      // Le même, mais ses ventes rangées il y a 3 min : il est passé dessus et le dressing n'a pas été relu.
      const r2 = await rendre(b, { lignes: [...L2h, ventes('111', 3)] });
      const a2 = await lireAnnonces(r2.pg);
      dit(a2.vieux === '111', 'l’autre sens : vu actif APRÈS la lecture (ventes rangées il y a 3 min), il est nommé', JSON.stringify({ vieux: a2.vieux }));
      await r2.ctx.close();
    });

    console.log('── 11. iPhone (390 px, tactile, sans extension) : le geste dit OÙ il se fait');
    await essaie('11', async () => {
      const r = await rendre(b, { lignes: [...BASE(), SUPP], tel: true, mobile: true, ponts: [] });
      const a = await lireAnnonces(r.pg);
      dit(a.ailleurs === '1' && /ordinateur/.test(a.texte), 'sans extension ici : « sur l’ordinateur où l’extension VRM est installée »', a.texte.slice(0, 220));
      dit(a.promesse === '0' && !/tout de suite/.test(a.texte), 'et aucune promesse « sort d’ici tout de suite »', a.texte.slice(0, 220));
      await r.ctx.close();
      const r2 = await rendre(b, { lignes: [...BASE(), SUPP] });
      const a2 = await lireAnnonces(r2.pg);
      dit(a2.ailleurs === '0' && !/ordinateur où/.test(a2.texte), 'l’autre sens : sur l’ordinateur où elle tourne, le geste reste « ouvre vinted.fr dans Chrome »', a2.texte.slice(0, 220));
      await r2.ctx.close();
    });

    console.log('── 12. Le compteur dit les CARTES retirées, pas les pauses et brouillons supprimés');
    await essaie('12', async () => {
      const items = [ann(7001, 'Zeta Garde Alpha 42'), ann(7002, 'Zeta Supprimee Beta 41'), ann(7003, 'Zeta Garde Gamma 43'),
        ann(7004, 'Zeta Pause 40', { is_hidden: true }), ann(7005, 'Zeta Brouillon 39', { is_draft: true })];
      const supp = { id: 'harvest_111_supprimees', data: { uid: '111', ids: { '7002': iso(2), '7004': iso(2), '7005': iso(2) } } };
      const lignes = [BASE()[0], dressing111(20, items), BASE()[2], supp];
      const r = await rendre(b, { lignes });
      const a = await lireAnnonces(r.pg);
      dit(a.cartes.length === 3 && a.supprimees === '1', 'Annonces : une carte retirée ⇒ « 1 annonce supprimée » (pas 3)', JSON.stringify({ cartes: a.cartes, dit: a.supprimees }));
      await r.ctx.close();
      const r2 = await rendre(b, { lignes, onglet: 'dashboard' });
      await r2.pg.waitForTimeout(1500);
      const d = await lireDash(r2.pg);
      dit(d.online === '3' && d.supprimees === '1', 'tableau de bord : le même nombre', JSON.stringify(d));
      await r2.ctx.close();
    });

    console.log('── 13. « Sort d’ici tout de suite » : seulement quand c’est vrai, avec le geste qui le rend vrai');
    await essaie('13', async () => {
      const lignes = [...BASE(), SUPP];
      const r = await rendre(b, { lignes });
      const a = await lireAnnonces(r.pg);
      dit(a.promesse === '1' && /recharge/i.test(a.texte), 'une extension à jour, seule : la promesse, avec « recharge les onglets Vinted ouverts avant la mise à jour »', a.texte.slice(0, 260));
      await r.ctx.close();
      const r2 = await rendre(b, { lignes, ponts: [{ version: '5.164.0', id: 'ancienne' }, { version: '5.166.0', id: 'neuve' }] });
      await r2.pg.waitForTimeout(1500);
      const a2 = await lireAnnonces(r2.pg);
      dit(a2.promesse === '0' && !/tout de suite/.test(a2.texte), 'deux extensions VRM répondent : AUCUNE promesse (l’ancienne patche la page à la place de la neuve)', a2.texte.slice(0, 260));
      await r2.ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ supprimees : ${ko} rouge(s)` : '\n✅ supprimees : tout est vert');
  process.exit(ko ? 1 : 0);
})();
