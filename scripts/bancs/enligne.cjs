// Banc : « IL FAUT VRAIMENT QUE CE SOIT LES PAIRES QUI SONT EN LIGNE ACTUELLEMENT,
// QUI SONT DANS ANNONCES » (Julien, 11 octobre — extension 5.166).
//
// MESURÉ le 11 octobre : l'écran Annonces montrait 27 annonces « en ligne », dont
// 16 d'une lecture du 8 octobre (deux comptes où il ne repassait pas). Il venait
// de tout supprimer pour reposter : l'ancienne annonce + la republiée = la même
// paire deux ou trois fois.
// Sur des données INVENTÉES (il vit dans le dépôt, qui est public), aux deux
// tailles, il exige :
//   1. TROIS annonces de la même paire, dont deux qui ne sont plus en ligne
//      (absente de la lecture publique la plus récente de son compte) ⇒ UNE seule
//      carte, et c'est la REPUBLIÉE (connue seulement par la lecture publique) ;
//   2. un compte figé depuis 3 jours ⇒ ses annonces ne sont PAS dans la grille ni
//      dans « Annonces en ligne » du tableau de bord ; elles sont dites UNE fois,
//      repliées, « à confirmer », et la ligne s'ouvre au clic ;
//   3. la même règle sur le tableau de bord et dans la file Leboncoin de l'app ;
//   4. panne de lecture (lectures publiques illisibles) ⇒ rien ne disparaît en
//      silence : ce qui n'est plus sûr est « à confirmer », jamais retiré sans un mot ;
//   5. l'autre sens : tout est frais ⇒ aucune ligne « à confirmer » ;
//   6. aucun débordement à 390 px, aucune erreur d'app ;
//   8 à 14. REVUE DE LA 5.167 (11 octobre), chaque défaut reproduit au rendu :
//      une paire « à confirmer » garde son numéro (le champ N° ne dit jamais
//      « n'est plus en ligne », aucun ♻️ sur un titre) ; « Annonces en ligne » et
//      le widget n'affirment pas un total quand des annonces sont à confirmer ;
//      la liste dépliée du tableau de bord porte les mêmes N° qu'Annonces ; une
//      lecture PUBLIQUE ne rend pas « À jour » un compte figé, ni ne lève
//      « Refusé par Vinted » ; l'écran Leboncoin dit la cause « à confirmer » ;
//      la promesse « vérifiées à ta prochaine visite » n'est faite qu'à une
//      extension connectée à VRM ; et les lectures publiques illisibles se disent.
// Ce qui est jugé : les cartes (`data-carte-annonce`), les attributs `data-*` et
// les nombres rendus — pas une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4771;

const now = Date.now();
const iso = (h) => new Date(now - h * 3600e3).toISOString();
const ACCS = ['111', '222', '333', '444'].map((u, i) => ({ id: i + 1, vinted_user_id: u, login: 'compte_' + u, domain: 'www.vinted.fr', updated_at: iso(0) }));
const ann = (id, title, o) => Object.assign({ id, title, price: { amount: '55.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false,
  photo: null, brand: 'Jordan', size: '43', status: 'Très bon état', view_count: 3, favourite_count: 0, nPhotos: 4 }, o);
const PAIRE = 'Zeta Fear Trois 43';
const dressing = (uid, capH, items) => ({ id: `harvest_${uid}_listings`, data: { type: 'listings', uid, capturedAt: iso(capH), nItems: items.length,
  payload: { items, pagination: { total_entries: items.length, total_pages: 1 } } } });
const publique = (uid, capH, items) => ({ id: `harvest_${uid}_enligne`, data: { type: 'enligne', uid, source: 'public', complet: true, capturedAt: iso(capH),
  n: items.length, ids: items.map((x) => String(x.id)), items } });
// compte_111 : dressing du « 8 octobre » (72 h) — 7001 (la paire) et 7011 ; relu en
//   public il y a 1 h : 7001 n'y est plus (supprimée), 7011 y est.
// compte_222 : dressing de 72 h — 7002 (la même paire) ; relu en public : vide.
// compte_333 : dressing de 3 h — 7031 ; relu en public il y a 10 min : 7031 et
//   7003, la paire REPUBLIÉE (jamais vue par son dressing).
// compte_444 : dressing de 72 h, jamais relu — 7041, 7042 : « à confirmer ».
const BASE = () => [
  { id: 'main', data: { vinted_annonce_numeros: {
    '7001': { numero: '11', mp: { lbc: true } }, '7002': { numero: '12', mp: { lbc: true } }, '7003': { numero: '13', mp: { lbc: true } },
    '7011': { numero: '21', mp: { lbc: true } }, '7031': { numero: '31', mp: { lbc: true } }, '7041': { numero: '41', mp: { lbc: true } }, '7042': { numero: '42', mp: { lbc: true } } } } },
  dressing('111', 72, [ann(7001, PAIRE), ann(7011, 'Zeta Garde Alpha 42')]),
  dressing('222', 72, [ann(7002, PAIRE)]),
  dressing('333', 3, [ann(7031, 'Zeta Garde Gamma 41')]),
  dressing('444', 72, [ann(7041, 'Zeta Figee Delta 40'), ann(7042, 'Zeta Figee Epsilon 39')]),
  publique('111', 1, [ann(7011, 'Zeta Garde Alpha 42')]),
  publique('222', 1, []),
  publique('333', 10 / 60, [ann(7031, 'Zeta Garde Gamma 41'), ann(7003, PAIRE, { price: { amount: '49.0', currency_code: 'EUR' } })]),
];
const FRAIS = () => [
  BASE()[0],
  dressing('111', 0.1, [ann(7011, 'Zeta Garde Alpha 42')]),
  dressing('333', 0.1, [ann(7031, 'Zeta Garde Gamma 41'), ann(7003, PAIRE)]),
];

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
    if (src === 'updated_at') { out[alias] = (row.data && row.data.capturedAt) || iso(0); continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};
// Un pont d'extension À JOUR, dans la vraie forme ; `sansPont` : un téléphone.
// « À jour » = la version que l'app ATTEND (EXT_ATTENDUE, lue dans la source) :
// une version écrite ici en dur passerait « en retard » au prochain bump, et le
// banc mesurerait le bump, pas la règle (même leçon que le banc `publier`).
const VERSION_A_JOUR = (fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8').match(/const EXT_ATTENDUE = '([\d.]+)'/) || [])[1];
if (!VERSION_A_JOUR) { console.log('KO EXT_ATTENDUE introuvable dans src/App.jsx'); process.exit(1); }
// La VRAIE forme de l'état (§6.3) : depuis `CODE_DANS_ETAT` (lu dans la source),
// une extension à jour joint `code` (la version du code qui répond). Sans lui,
// l'app la dit « périmée » — un état « à jour » sans `code` est une fiction.
// `perime` : le manifeste est à jour, le service worker exécute un code d'avant.
const CODE_DANS_ETAT = (fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8').match(/const CODE_DANS_ETAT = '([\d.]+)'/) || [])[1] || '';
const PONT = (o) => {
  const version = o.version, connecte = o.connecte !== false;
  const vn = (v) => String(v || '').split('.').map((x) => parseInt(x, 10) || 0);
  const auMoins = (v, r) => { const a = vn(v), b = vn(r); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return true; };
  const code = !o.perime && o.codeDansEtat && auMoins(version, o.codeDansEtat) ? { code: version } : {};
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: Object.assign({ ok: true, version, vrm: connecte ? { ok: true, connecte: true, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' /* la session de banc (_porte-banc.cjs) */ } : { ok: true, connecte: false }, vinted: null, cmds: {} }, code) });
  });
  post({ __vmr: 'ready', version });
};

async function rendre(b, { lignes, tel = false, onglet = 'cat_annonces', enligneKO = false, sansPont = false, accs = ACCS, posts = null, ls = null, pontConnecte = true, pontPerime = false }) {
  const vp = tel ? { width: 390, height: 844 } : { width: 1512, height: 950 };
  const ctx = await b.newContext({ viewport: vp, ...(tel ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (!sansPont) await pg.addInitScript(PONT, { version: VERSION_A_JOUR, connecte: pontConnecte, perime: pontPerime, codeDansEtat: CODE_DANS_ETAT });
  // Un réglage PROPRE À L'APPAREIL (ex. « refusé par Vinted »), posé une seule fois.
  if (ls) await pg.addInitScript((o) => { try { for (const k in o) if (!localStorage.getItem('__fait_' + k)) { localStorage.setItem(k, JSON.stringify(o[k])); localStorage.setItem('__fait_' + k, '1'); } } catch (_) {} }, ls);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') { if (posts) { try { posts.push(JSON.parse(route.request().postData() || 'null')); } catch (_) {} } return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(accs);
    // Les lectures publiques ILLISIBLES (522 Cloudflare, en HTML), la base debout par ailleurs.
    if (enligneKO && /_enligne/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: (r.data && r.data.capturedAt) || iso(0), cap: r.data && r.data.capturedAt });
    // Pagination par `Range` (lireTout) : tout tient dans la première page.
    const rng = route.request().headers()['range'];
    if (rng && !/^0-/.test(rng)) return j([]);
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(lignes.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  // Le relais Vinted en panne : l'app ne doit vivre que de NOTRE base.
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
  return { ctx, pg, errs };
}
const lireAnnonces = (pg) => pg.evaluate((PAIRE) => {
  const f = [...document.querySelectorAll('[data-ann-fraicheur]')];
  const el = f[0];
  const cartes = [...document.querySelectorAll('[data-carte-annonce]')];
  return {
    cartes: cartes.map((x) => x.getAttribute('data-carte-annonce')).sort(),
    paire: cartes.filter((x) => x.innerText.includes(PAIRE)).map((x) => x.getAttribute('data-carte-annonce')),
    nFraicheur: f.length,
    aConfirmer: el ? el.getAttribute('data-a-confirmer') : null,
    comptesAC: el ? el.getAttribute('data-a-confirmer-comptes') : null,
    supprimees: el ? el.getAttribute('data-supprimees') : null,
    cap: el ? el.getAttribute('data-cap') : null,
    texte: el ? el.innerText : '',
    liste: [...document.querySelectorAll('[data-a-confirmer-annonce]')].map((x) => x.getAttribute('data-a-confirmer-annonce')).sort(),
    couleurs: el ? [...new Set([...el.querySelectorAll('*')].concat([el]).map((x) => getComputedStyle(x).color))] : [],
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  };
}, PAIRE);

(async () => {
  let b;
  // `SECTIONS=8,9` : seulement ces sections (preuve par mutation, plus rapide).
  const veut = (k) => !process.env.SECTIONS || process.env.SECTIONS.split(',').includes(String(k));
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : le scénario a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); } };
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    for (const tel of [false, true]) {
      const t = tel ? '390 px' : '1512 px';
      console.log(`── 1-2. ${t} — trois annonces de la même paire, un compte figé`);
      if (veut('1')) await essaie('1 ' + t, async () => {
        const r = await rendre(b, { lignes: BASE(), tel });
        const a = await lireAnnonces(r.pg);
        dit(a.paire.length === 1, `${t} : la paire supprimée deux fois et republiée apparaît UNE fois`, JSON.stringify(a.paire));
        dit(a.paire[0] === '7003', `${t} : et c'est la REPUBLIÉE (7003, connue par la lecture publique de ce matin)`, JSON.stringify(a.paire));
        dit(!a.cartes.includes('7001') && !a.cartes.includes('7002'), `${t} : les deux anciennes (absentes de la lecture la plus récente) ne sont plus là`, JSON.stringify(a.cartes));
        dit(a.cartes.includes('7011') && a.cartes.includes('7031'), `${t} : les autres paires en ligne restent`, JSON.stringify(a.cartes));
        dit(!a.cartes.includes('7041') && !a.cartes.includes('7042'), `${t} : le compte figé depuis 3 jours n'est PAS dans la grille`, JSON.stringify(a.cartes));
        dit(a.nFraicheur === 1, `${t} : une seule ligne au-dessus de la grille (§7)`, `${a.nFraicheur} bloc(s)`);
        dit(a.aConfirmer === '2' && a.comptesAC === '444' && /compte_444/.test(a.texte), `${t} : elle dit « 2 annonces de compte_444 à confirmer »`, JSON.stringify({ n: a.aConfirmer, c: a.comptesAC, t: a.texte }));
        dit(/3 j/.test(a.texte), `${t} : avec l'âge de la dernière lecture`, a.texte);
        dit(a.cap === 'ok' && /n.importe lequel de tes comptes/.test(a.texte), `${t} : et le geste vrai pour une extension à jour (n'importe lequel de ses comptes)`, a.texte);
        dit(a.supprimees === '2', `${t} : elle dit aussi combien sont sorties parce qu'elles ne sont plus en ligne`, JSON.stringify(a.supprimees));
        dit(a.liste.length === 0, `${t} : la liste « à confirmer » est REPLIÉE par défaut`, JSON.stringify(a.liste));
        await r.pg.click('[data-a-confirmer-ouvrir]');
        await r.pg.waitForTimeout(300);
        const a2 = await lireAnnonces(r.pg);
        dit(JSON.stringify(a2.liste) === '["7041","7042"]', `${t} : elle s'ouvre au clic, avec ces deux annonces`, JSON.stringify(a2.liste));
        dit(a2.couleurs.every((c) => !/rgb\((2[0-9]{2}), ?([0-9]{1,2}), ?([0-9]{1,2})\)/.test(c)), `${t} : aucune couleur d'alerte (rien n'est cassé, c'est une date)`, JSON.stringify(a2.couleurs));
        dit(a2.sw <= a2.cw + 1, `${t} : aucun débordement`, `${a2.sw} > ${a2.cw}`);
        dit(r.errs.length === 0, `${t} : aucune erreur d'app`, r.errs.join(' | ').slice(0, 160));
        await r.pg.screenshot({ path: path.join(os.tmpdir(), `enligne-annonces-${tel ? 390 : 1512}.png`), fullPage: false });
        await r.ctx.close();
      });
    }

    console.log('── 3. Tableau de bord : le même chiffre, la même ligne');
    if (veut('3')) await essaie('3', async () => {
      const r = await rendre(b, { lignes: BASE(), onglet: 'dashboard' });
      await r.pg.waitForTimeout(1500);
      const d = await r.pg.evaluate(() => {
        const s = document.querySelector('[data-dash-stat="online"]');
        const f = [...document.querySelectorAll('[data-dash-fraicheur]')];
        return { online: s ? (s.innerText.match(/\d+/) || [null])[0] : null, n: f.length, ac: f[0] ? f[0].getAttribute('data-a-confirmer') : null, texte: f[0] ? f[0].innerText : '' };
      });
      dit(d.online === '3', '« Annonces en ligne » compte 3 (7003, 7011, 7031) — ni les anciennes, ni le compte figé', JSON.stringify(d));
      dit(d.n === 1 && d.ac === '2', 'et la même ligne « à confirmer », une fois', JSON.stringify(d));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    });

    console.log('── 4. File Leboncoin de l’app');
    if (veut('4')) await essaie('4', async () => {
      const r = await rendre(b, { lignes: BASE(), onglet: 'leboncoin' });
      await r.pg.waitForTimeout(1500);
      const txt = await r.pg.evaluate(() => document.body.innerText);
      const vus = (txt.match(/Zeta [A-Za-z]+ [A-Za-z]+/g) || []).join(' · ');
      dit(/Zeta Fear Trois/.test(txt), 'la republiée est proposée à la publication', vus);
      dit(!/Zeta Figee/.test(txt), 'les annonces « à confirmer » ne sont pas proposées', vus);
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
    });

    for (const tel of [false, true]) {
      const t = tel ? '390 px' : '1512 px';
      console.log(`── 5. ${t} — panne : les lectures publiques sont illisibles`);
      if (veut('5')) await essaie('5 ' + t, async () => {
        const r = await rendre(b, { lignes: BASE(), tel, enligneKO: true });
        const a = await lireAnnonces(r.pg);
        await r.pg.click('[data-a-confirmer-ouvrir]').catch(() => {});
        await r.pg.waitForTimeout(300);
        const a2 = await lireAnnonces(r.pg);
        const vues = new Set([...a2.cartes, ...a2.liste]);
        const manquent = ['7001', '7002', '7011', '7031', '7041', '7042'].filter((id) => !vues.has(id));
        dit(!manquent.length, `${t} : rien ne disparaît en silence — chaque annonce connue est soit en ligne, soit « à confirmer »`, `manquent : ${manquent.join(',')}`);
        // Revue de la 5.167 : sans les lectures publiques, un dressing ne décide QUE
        // s'il a moins de 30 min (aucune lecture plus récente ne peut exister). Le
        // dressing de 3 h de compte_333 a justement été dépassé par une lecture
        // publique (la republiée 7003) : le croire ferait cacher la republiée.
        dit(!a.cartes.includes('7001') && !a.cartes.includes('7002') && !a.cartes.includes('7031'), `${t} : aucune lecture de plus de 30 min ne décide seule — tout est « à confirmer », rien n'est ressuscité`, JSON.stringify(a.cartes));
        dit(a.supprimees === '0', `${t} : et rien n'est dit « plus en ligne » sur une lecture qui n'a pas eu lieu`, JSON.stringify(a.supprimees));
        const pk = await r.pg.evaluate(() => { const f = document.querySelector('[data-ann-fraicheur]'); const s = f && f.querySelector('[data-pub-ko-dit]'); return { attr: f && f.getAttribute('data-pub-ko'), n: document.querySelectorAll('[data-pub-ko-dit]').length, t: s ? s.innerText : '' }; });
        dit(pk.attr === '1' && pk.n === 1 && /n.ont pas pu être lues/.test(pk.t), `${t} : et la panne est DITE, une fois`, JSON.stringify(pk));
        dit(r.errs.length === 0, `${t} : aucune erreur d’app`, r.errs.join(' | ').slice(0, 160));
        await r.ctx.close();
      });
    }

    console.log('── 6. Sur un téléphone (sans extension) : la même règle, sur les lignes en base');
    if (veut('6')) await essaie('6', async () => {
      const r = await rendre(b, { lignes: BASE(), tel: true, sansPont: true });
      const a = await lireAnnonces(r.pg);
      dit(JSON.stringify(a.paire) === '["7003"]' && a.aConfirmer === '2', 'la même grille et la même ligne « à confirmer »', JSON.stringify({ p: a.paire, ac: a.aConfirmer }));
      dit(a.cap === 'absente' && /extension VRM à jour/.test(a.texte), 'et le geste ne promet rien d’un téléphone : il dit à quelle condition', a.texte);
      await r.ctx.close();
    });

    console.log('── 7b. Panne des lectures publiques, dressings de moins de 30 min : ils décident encore');
    if (veut('7b')) await essaie('7b', async () => {
      const r = await rendre(b, { lignes: FRAIS(), enligneKO: true });
      const a = await lireAnnonces(r.pg);
      dit(a.cartes.includes('7011') && a.cartes.includes('7031') && a.cartes.includes('7003'), 'un dressing lu il y a 6 min reste en ligne (aucune lecture plus récente ne peut exister)', JSON.stringify(a.cartes));
      await r.ctx.close();
    });

    console.log('── 7. L’autre sens : tout est frais');
    if (veut('7')) await essaie('7', async () => {
      const r = await rendre(b, { lignes: FRAIS() });
      const a = await lireAnnonces(r.pg);
      dit(a.nFraicheur === 0 && a.paire.length === 1, 'aucune ligne quand tout a été lu il y a moins de 30 min, et la paire une fois', JSON.stringify(a));
      await r.ctx.close();
    });

    // ══════════════════════════════════════════════════════════════════════
    // REVUE DE LA 5.167 — chaque défaut reproduit au rendu (données inventées)
    // ══════════════════════════════════════════════════════════════════════
    const autre = (uid, type, capH, payload) => ({ id: `harvest_${uid}_${type}`, data: { type, uid, capturedAt: iso(capH), payload } });
    const ventesVides = (uid, capH = 0.05) => autre(uid, 'orders_sold', capH, { my_orders: [], pagination: { total_entries: 0, total_pages: 0 } });

    console.log('── 8. Une paire « à confirmer » garde son numéro');
    if (veut('8')) await essaie('8 numéro', async () => {
      // 8001 (compte_111, lu il y a 2 h, N°3) ; 8002 (compte_222, lu il y a 30 h : « à confirmer ») porte le N°7.
      const lignes = [{ id: 'main', data: { vinted_annonce_numeros: { '8001': { numero: '3', title: 'Beta Alpha 40', accountId: '111' }, '8002': { numero: '7', title: 'Beta Beta 41', accountId: '222', buyPrice: '35' } }, vinted_used_numeros: ['3', '7'] } },
        ventesVides('111'), ventesVides('222'), ventesVides('333'), ventesVides('444'), dressing('333', 0.05, []), dressing('444', 0.05, []),
        dressing('111', 2, [ann(8001, 'Beta Alpha 40')]), dressing('222', 30, [ann(8002, 'Beta Beta 41')])];
      const posts = [];
      const r = await rendre(b, { lignes, posts });
      await r.pg.waitForTimeout(1500);
      await r.pg.click('[data-carte-annonce="8001"] [data-edition="numero"]', { timeout: 8000 });
      await r.pg.keyboard.press('Control+A'); await r.pg.keyboard.type('7'); await r.pg.keyboard.press('Enter');
      await r.pg.waitForTimeout(1200);
      const t = await r.pg.evaluate(() => document.body.innerText);
      const i = t.indexOf('N°7');
      const dialogue = i >= 0 ? t.slice(Math.max(0, i - 20), i + 260) : '';
      dit(!/n.est plus en ligne/.test(dialogue) && !/Oui, le même article revient/.test(t), 'taper le N° d’une paire « à confirmer » : jamais « elle n’est plus en ligne », jamais « le même article revient »', dialogue.replace(/\n+/g, ' | '));
      dit(/peut-être encore/.test(dialogue) && /Annuler/.test(t), 'le dialogue dit qu’une paire le porte PEUT-ÊTRE encore, avec Annuler / un numéro neuf', dialogue.replace(/\n+/g, ' | '));
      // Annuler : rien n'est écrit sur 8002 (ni fiche supprimée, ni prix d'achat déplacé).
      await r.pg.click('text=Annuler', { timeout: 4000 }).catch(() => {});
      await r.pg.waitForTimeout(1500);
      const ecritMain = posts.flat().filter((x) => x && x.id === 'main').map((x) => x.data && x.data.vinted_annonce_numeros).filter(Boolean);
      const dernier = ecritMain[ecritMain.length - 1] || null;
      dit(!dernier || (dernier['8002'] && dernier['8002'].numero === '7' && dernier['8002'].buyPrice === '35' && !(dernier['8001'] && dernier['8001'].repriseDe)), 'la fiche « à confirmer » garde son N°7 et son prix d’achat', JSON.stringify(dernier && { a: dernier['8001'], b: dernier['8002'] }));
      dit(r.errs.length === 0, 'aucune erreur d’app', r.errs.join(' | ').slice(0, 160));
      await r.ctx.close();
      // Le bandeau ♻️ ne propose pas de lui prendre son numéro sur un simple titre.
      const lignes2 = [{ id: 'main', data: { vinted_annonce_numeros: { '8001': { numero: '9', auto: true, title: 'Beta Beta 41', accountId: '111' }, '8002': { numero: '5', auto: true, title: 'Beta Beta 41', accountId: '222' } }, vinted_used_numeros: ['5', '9'] } },
        ventesVides('111'), ventesVides('222'), ventesVides('333'), ventesVides('444'), dressing('333', 0.05, []), dressing('444', 0.05, []),
        dressing('111', 2, [ann(8001, 'Beta Beta 41')]), dressing('222', 30, [ann(8002, 'Beta Beta 41')])];
      const r2 = await rendre(b, { lignes: lignes2 });
      await r2.pg.waitForTimeout(1500);
      const t2 = await r2.pg.evaluate(() => document.body.innerText);
      dit(!/♻️/.test(t2), 'aucun bandeau ♻️ « paire déjà connue » sur une paire « à confirmer » au même libellé', (t2.slice(t2.indexOf('♻️'), t2.indexOf('♻️') + 120) || '').replace(/\n+/g, ' | '));
      await r2.ctx.close();
    });

    console.log('── 9. « Annonces en ligne » et le widget n’affirment pas un total partiel');
    if (veut('9')) await essaie('9 widget', async () => {
      const MAIN9 = { id: 'main', data: { vinted_annonce_numeros: { '8001': { numero: '1' }, '8002': { numero: '2' }, '8003': { numero: '3' } } } };
      for (const [nom, lignes, tuileOk] of [
        ['tout lu il y a 30 h', [MAIN9, ventesVides('111'), ventesVides('222'), ventesVides('333'), ventesVides('444'), dressing('444', 0.05, []), dressing('111', 30, [ann(8001, 'Alpha A 40')]), dressing('222', 30, [ann(8002, 'Beta B 41')]), dressing('333', 30, [ann(8003, 'Gamma C 42')])], (v) => /—/.test(v) && !/\b0\b/.test(v)],
        ['un compte relu il y a 2 h, deux à 30 h', [MAIN9, ventesVides('111'), ventesVides('222'), ventesVides('333'), ventesVides('444'), dressing('444', 0.05, []), dressing('111', 2, [ann(8001, 'Alpha A 40')]), dressing('222', 30, [ann(8002, 'Beta B 41')]), dressing('333', 30, [ann(8003, 'Gamma C 42')])], (v) => /≥\s*1/.test(v)],
      ]) {
        const posts = [];
        const r = await rendre(b, { lignes, onglet: 'dashboard', posts });
        await r.pg.waitForTimeout(5000);
        const tuile = await r.pg.evaluate(() => { const s = document.querySelector('[data-dash-stat="online"]'); return s ? s.innerText.replace(/\s+/g, ' ') : ''; });
        const w = posts.flat().filter((x) => x && x.id === 'widget_stats').map((x) => x.data && x.data.online);
        dit(tuileOk(tuile), `${nom} : la tuile ne présente pas un minorant comme un total (« — » ou « ≥ N »)`, tuile);
        dit(w.length > 0 && w.every((v) => v === null), `${nom} : le widget de l’iPhone ne reçoit AUCUN nombre (un tiret, jamais un zéro inventé)`, JSON.stringify(w));
        await r.ctx.close();
      }
    });

    console.log('── 10. La liste dépliée du tableau de bord porte les mêmes N° que l’écran Annonces');
    if (veut('10')) await essaie('10 numéros dépliés', async () => {
      const lu = {};
      for (const onglet of ['dashboard', 'cat_annonces']) {
        const r = await rendre(b, { lignes: BASE(), onglet });
        await r.pg.click(onglet === 'dashboard' ? '[data-dash-fraicheur] [data-a-confirmer-ouvrir]' : '[data-ann-fraicheur] [data-a-confirmer-ouvrir]', { timeout: 8000 });
        await r.pg.waitForTimeout(400);
        lu[onglet] = await r.pg.evaluate(() => [...document.querySelectorAll('[data-a-confirmer-annonce]')].map((x) => x.getAttribute('data-a-confirmer-annonce') + ' ' + ((x.innerText.match(/N°\S+|sans N°/) || [''])[0])));
        await r.ctx.close();
      }
      dit(JSON.stringify(lu.dashboard) === JSON.stringify(lu.cat_annonces) && /N°41/.test(lu.dashboard.join()), 'tableau de bord = Annonces (N°41, N°42), jamais « sans N° » pour une paire numérotée', JSON.stringify(lu));
    });

    console.log('── 11. Une lecture PUBLIQUE ne rend pas « À jour » un compte figé (Comptes liés)');
    if (veut('11')) await essaie('11 comptes liés', async () => {
      const vieux = 72;
      const sans = [BASE()[0], dressing('111', 0.2, [ann(7011, 'A')]), autre('111', 'orders_sold', 0.2, { my_orders: [] }), autre('111', 'profile', 0.2, { user: { id: 111 } }),
        dressing('444', vieux, [ann(7041, 'Zeta Figee Delta 40')]), autre('444', 'orders_sold', vieux, { my_orders: [] }), autre('444', 'profile', vieux, { user: { id: 444 } }), autre('444', 'inbox', vieux, { conversations: [] })];
      const avec = sans.concat([publique('444', 10 / 60, [ann(7041, 'Zeta Figee Delta 40')])]);
      // Des comptes AVEC leur jeton de renouvellement (sinon « À reconnecter » masquerait l'état).
      const accs = [ACCS[0], ACCS[3]].map((a) => ({ ...a, refresh_token: 'r' }));
      const etat = {};
      for (const [nom, lignes] of [['sans', sans], ['avec', avec]]) {
        const r = await rendre(b, { lignes, onglet: 'vintedaccounts', accs });
        await r.pg.waitForTimeout(1500);
        etat[nom] = await r.pg.evaluate(() => { const t = document.body.innerText; const i = t.indexOf('compte_444'); return t.slice(i, i + 120).replace(/\s+/g, ' '); });
        await r.ctx.close();
      }
      // (16 octobre) La pastille ne dit plus que « Actif / Banni » (#539) ; la
      // fraîcheur vit dans une ligne grise « capté il y a … ». La RÈGLE reste :
      // la lecture PUBLIQUE n'est pas une capture de SA session
      // (`ligneDeSaSession`) — la ligne doit dire le même âge (3 j) avec ou
      // sans elle, jamais « il y a moins d'une heure ».
      const age = (t) => (/capté il y a ([^A-Z]*?)(?= Gérer|$)/.exec(t) || [])[1] || null;
      dit(/3 j/.test(age(etat.avec) || '') && age(etat.avec) === age(etat.sans) && !/À jour|moins d.une heure/.test(etat.avec), 'compte figé depuis 3 jours, relu en public il y a 10 min : toujours « capté il y a 3 j », jamais rajeuni', JSON.stringify(etat));
      // Un compte « refusé par Vinted » (liste propre à l'appareil), sans aucune
      // capture de SA session depuis 10 jours, le reste — même relu en public.
      const dix = 240;
      const refuse = [BASE()[0], dressing('111', 0.2, [ann(7011, 'A')]), autre('111', 'orders_sold', 0.2, { my_orders: [] }), autre('111', 'profile', 0.2, { user: { id: 111 } }),
        dressing('444', dix, [ann(7041, 'Zeta Figee Delta 40')]), autre('444', 'orders_sold', dix, { my_orders: [] }), autre('444', 'profile', dix, { user: { id: 444 } }),
        publique('444', 10 / 60, [ann(7041, 'Zeta Figee Delta 40')])];
      const r = await rendre(b, { lignes: refuse, onglet: 'cat_annonces', accs, ls: { vinted_accounts_blocked: ['444'] } });
      await r.pg.waitForTimeout(2500);
      const ls = await r.pg.evaluate(() => localStorage.getItem('vinted_accounts_blocked'));
      dit(ls === '["444"]', 'un compte « refusé par Vinted » ne sort pas de la liste sur une simple lecture publique', ls);
      await r.ctx.close();
    });

    console.log('── 12. L’écran Leboncoin dit la cause « à confirmer »');
    if (veut('12')) await essaie('12 leboncoin', async () => {
      const tous = [BASE()[0], dressing('111', 30, [ann(7011, 'Zeta Garde Alpha 42')]), dressing('333', 30, [ann(7031, 'Zeta Garde Gamma 41')]), dressing('444', 30, [ann(7041, 'Zeta Figee Delta 40'), ann(7042, 'Zeta Figee Epsilon 39')])];
      const r = await rendre(b, { lignes: tous, onglet: 'leboncoin' });
      await r.pg.waitForTimeout(1500);
      const d = await r.pg.evaluate(() => ({ t: document.body.innerText, ac: (document.querySelector('[data-lbc-a-confirmer]') || {}).getAttribute ? document.querySelector('[data-lbc-a-confirmer]').getAttribute('data-lbc-a-confirmer') : null, vide: (document.querySelector('[data-lbc-vide]') || { getAttribute: () => null }).getAttribute('data-lbc-vide') }));
      dit(!/pas encore d.annonce en ligne/i.test(d.t), 'tout est « à confirmer » : il n’affirme PAS « tu n’as pas encore d’annonce en ligne »', '');
      dit(d.ac === '4' && d.vide === 'a-confirmer', 'il dit combien sont à confirmer, et que la file attend leur relecture', JSON.stringify({ ac: d.ac, vide: d.vide }));
      await r.ctx.close();
      const r2 = await rendre(b, { lignes: BASE(), onglet: 'leboncoin' });
      await r2.pg.waitForTimeout(1500);
      const ac2 = await r2.pg.evaluate(() => { const e = document.querySelector('[data-lbc-a-confirmer]'); return e ? e.getAttribute('data-lbc-a-confirmer') : null; });
      dit(ac2 === '2', 'un seul compte à confirmer : la file ne rétrécit pas sans un mot (2 annonces dites)', String(ac2));
      await r2.ctx.close();
    });

    console.log('── 13. La promesse « vérifiées à ta prochaine visite » suppose une extension CONNECTÉE à VRM');
    if (veut('13')) await essaie('13 sans session', async () => {
      const etats = {};
      for (const pc of [true, false]) {
        const r = await rendre(b, { lignes: BASE(), pontConnecte: pc });
        await r.pg.waitForTimeout(1500);
        etats[pc] = await r.pg.evaluate(() => { const f = document.querySelector('[data-ann-fraicheur]'); const g = f && f.querySelector('[data-geste-dit]'); return { relit: f && f.getAttribute('data-relit'), promesse: f && f.getAttribute('data-promesse'), geste: g ? g.innerText : '' }; });
        await r.ctx.close();
      }
      dit(etats.true.relit === '1' && /vérifiées à ta prochaine visite/.test(etats.true.geste), 'extension connectée : la promesse est faite', JSON.stringify(etats.true));
      dit(etats.false.relit === '0' && etats.false.promesse === '0' && !/vérifiées à ta prochaine visite|sort d.ici tout de suite/.test(etats.false.geste) && /pas connectée à ton compte VRM/.test(etats.false.geste), 'extension PAS connectée à VRM : aucune promesse, le geste à la place', JSON.stringify(etats.false));
    });
    // ⚠️⚠️ Fusion du 11 octobre (deux chantiers) : le manifeste est à jour mais
    //    le service worker exécute un code d'AVANT (⟳ jamais cliqué). La pastille
    //    dit « Lecture seule — clique ⟳ » ; l'écran Annonces promettait quand
    //    même « elles seront vérifiées à ta prochaine visite » — deux voix
    //    contraires, et une promesse que l'ancien code ne tient pas.
    console.log('── 13b. Code PÉRIMÉ (manifeste à jour, service worker d’avant) : aucune promesse de relecture');
    if (veut('13')) await essaie('13b périmé', async () => {
      const r = await rendre(b, { lignes: BASE(), pontPerime: true });
      await r.pg.waitForTimeout(1500);
      const e = await r.pg.evaluate(() => { const f = document.querySelector('[data-ann-fraicheur]'); const g = f && f.querySelector('[data-geste-dit]'); const x = document.querySelector('[data-etat-actions]');
        return { relit: f && f.getAttribute('data-relit'), promesse: f && f.getAttribute('data-promesse'), perime: f && f.getAttribute('data-perime'), geste: g ? g.innerText : '', pastille: x ? x.getAttribute('data-etat-code') : null }; });
      dit(e.pastille === 'perime', 'la pastille dit « périmé »', JSON.stringify(e.pastille));
      dit(e.relit === '0' && e.promesse === '0' && !/vérifiées à ta prochaine visite|sort d.ici tout de suite/.test(e.geste), 'et l’écran Annonces ne promet AUCUNE relecture (une voix, la même que la pastille)', JSON.stringify(e));
      dit(e.perime === '1' && /chrome:\/\/extensions/.test(e.geste) && /⟳/.test(e.geste), 'il dit le geste : ⟳ dans chrome://extensions', e.geste);
      await r.ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ enligne : ${ko} rouge(s)` : '\n✅ enligne : tout est vert');
  process.exit(ko ? 1 : 0);
})();
