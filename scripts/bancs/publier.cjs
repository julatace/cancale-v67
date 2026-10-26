// Banc : « PUBLIER SUR LEBONCOIN » DEPUIS L'APP (5.130).
//
// Julien, 2 octobre : « c'est l'application qui contrôle l'extension ; il faut
// que l'extension soit allumée, sinon floute les boutons ». Les panneaux sur
// leboncoin.fr sont retirés : le bouton vit sur l'écran « À publier » de l'app.
// Sur des données INVENTÉES (il vit dans le dépôt), il rend l'écran avec le
// VRAI dialogue du pont dans trois situations et exige :
//   · extension à jour : chaque paire a son bouton, le clic envoie `lbcPublier`
//     avec l'IDENTIFIANT seul (jamais un titre ni un prix), et le bouton suit
//     l'étape que l'extension renvoie ;
//   · extension trop ancienne / absente : bouton GRISÉ, jamais caché, et la
//     raison dite UNE fois au-dessus de la liste (§7) ;
//   · plus de lien orange « Déposer une annonce » au bas de l'écran (§7 : un
//     seul accent) ;
//   · la paire sans photo n'a pas de bouton (Leboncoin la refuserait).
// Ajouté le 11 octobre (« quand je vais poster des paires sur le bon coin, je
// ne peux pas ») — reproduit 2 sur 2 : un dépôt qui n'aboutissait pas laissait
// le bouton « en cours » 15 minutes, et un clic ne faisait RIEN, sans un mot.
//   · un dépôt ABANDONNÉ (onglet fermé, remplissage arrêté) : « Le dépôt n'a pas
//     abouti » + la raison, et le bouton dit « Réessayer » — qui renvoie ;
//   · « en cours » : un clic renvoie la commande (l'extension remet l'onglet
//     devant, ou relance) — jamais un clic muet ;
//   · un clic refusé DIT pourquoi (grisé, refus de l'extension) ;
//   · le bouton annonce les photos captées sur le total de l'annonce.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4792;
const auj = new Date().toISOString();
const MAIN = { vinted_annonce_numeros: { '7001': { numero: '41', title: 'Salomon XT-6 blanc taille 40' }, '7002': { numero: '42', title: 'Autry blanc taille 36' } } };
const LISTINGS = { payload: { items: [
  { id: 7001, title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', size_title: '40', price: { amount: '99.0' }, photo: { url: 'https://img.test/a.jpg' }, nPhotos: 5 },
  { id: 7002, title: 'Autry blanc taille 36', brand_title: 'Autry', size_title: '36', price: { amount: '24.0' }, nPhotos: 0 },
] }, capturedAt: auj };
const DETAILS = { '7001': { photos: ['https://img.test/a.jpg', 'https://img.test/b.jpg'], description: 'Très bon état, portées deux fois.' } };
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: LISTINGS },
  { id: 'vinted_item_details', data: DETAILS },
  { id: 'vinted_lbc_posted', data: { ids: [] } },
];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj }];
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
    out[alias] = v == null ? null : v;
  }
  return out;
};
const SEUIL_PUBLIER = (/publication:\s*'([^']+)'/.exec(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')) || [])[1] || '5.160.0';
// Le pont simulé : `version` annoncée, et ce que répond la commande.
const PONT = ({ mode, version, suite = 'fait' }) => {
  window.__cmds = [];
  if (mode === 'absente') return;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {} } });
    if (d.__vmr === 'cmd') {
      window.__cmds.push(Object.keys(d).filter((k) => !['__vmr', 'reqId'].includes(k)).sort().join(',') + '=' + d.cmd + ':' + d.id);
      const jobId = 'lbc:' + d.id;
      // `suite` : ce que fait l'extension ensuite — `fait` (publiée), `abandon`
      // (l'onglet du dépôt fermé avant la fin), `rien` (le dépôt reste ouvert),
      // `refus` (l'extension refuse, avec sa raison).
      if (suite === 'refus') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'inconnue', raison: 'Cette paire n’est plus dans la file (vendue ou décochée).' } }); return; }
      // `confirmer` (revue du 11 octobre) : l'extension découvre au clic que le
      // dépôt précédent est abandonné (onglet parti ailleurs) et exige SA
      // confirmation — il a pu le finir à la main.
      if (suite === 'confirmer' && !d.confirme) { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'confirmer', jobId, etape: 'abandonne', raison: 'VRM n’a pas vu la fin du dépôt précédent' } }); return; }
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId, etape: 'depot' } });
      if (suite === 'fait') setTimeout(() => post({ __vmr: 'evt', evt: { type: 'cmd', jobId, etape: 'fait', at: Date.now() } }), 400);
      if (suite === 'abandon' && window.__cmds.length === 1) setTimeout(() => post({ __vmr: 'evt', evt: { type: 'cmd', jobId, etape: 'abandonne', raison: 'onglet-ferme', at: Date.now() } }), 400);
    }
  });
  post({ __vmr: 'ready', version });
};

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    // ⚠️ « À jour » = le seuil de `EXT_CAPACITES.publication`, lu dans l'app :
    //    il est passé de 5.130 à 5.160 (le relais des commandes ne transportait
    //    pas l'identifiant avant), et ce banc servait encore 5.130 — rouge sur
    //    une app intacte depuis (§6.3 : servir la forme que le code attend).
    for (const cas of [{ mode: 'ok', version: SEUIL_PUBLIER }, { mode: 'ok', version: '5.129.0' }, { mode: 'absente' },
      { mode: 'ok', version: SEUIL_PUBLIER, suite: 'abandon' }, { mode: 'ok', version: SEUIL_PUBLIER, suite: 'rien' }, { mode: 'ok', version: SEUIL_PUBLIER, suite: 'refus' }, { mode: 'ok', version: SEUIL_PUBLIER, suite: 'confirmer' }]) {
      const nom = (cas.mode === 'absente' ? 'extension absente' : 'extension ' + cas.version) + (cas.suite ? ' · dépôt ' + cas.suite : '');
      console.log('── ' + nom);
      const ctx = await b.newContext({ viewport: { width: 1512, height: 950 } });
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
      await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
      await pg.addInitScript(PONT, cas);
      await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
      await pg.route('**/rest/v1/**', (route) => {
        const u = decodeURIComponent(metaVersData(route.request().url()));
        const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
        if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
        if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
        const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
        const eq = /id=eq\.([^&]*)/.exec(u);
        if (eq) return j(rows.filter((r) => r.id === eq[1]).map((r) => projette(r, sel)));
        const lk = /id=like\.([^&]*)/.exec(u);
        if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map((r) => projette(r, sel))); }
        return j([]);
      });
      await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
      await pg.goto(`http://localhost:${PORT}/?tab=leboncoin`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3500);
      // Machine chargée : la file peut arriver après 3,5 s, et le banc lisait
      // alors « aucun bouton » sur un écran intact (4 rouges, 20 oct.). On
      // attend l'ÉTAT — la file rendue —, borné ; les contrôles restent exacts.
      await pg.waitForSelector('[data-bouton-publier]', { timeout: 15000 }).catch(() => {});
      const lire = () => pg.evaluate(() => ({
        boutons: [...document.querySelectorAll('[data-bouton-publier]')].map((e) => ({ id: e.getAttribute('data-id'), etat: e.getAttribute('data-bouton-publier'), txt: e.innerText,
          photos: e.getAttribute('data-photos'), total: e.getAttribute('data-photos-total'),
          refus: (e.querySelector('[data-refus-publier]') || {}).innerText || '', abandon: (e.querySelector('[data-depot-abandonne]') || {}).innerText || '' })),
        raisons: document.querySelectorAll('[data-raison-publier]').length,
        orange: [...document.querySelectorAll('a')].some((a) => /Déposer une annonce/.test(a.innerText)),
        texte: document.body.innerText,
      }));
      // 5.182 : le bouton de la ligne OUVRE LA FICHE ; c'est elle qui publie.
      // `publier()` = ouvrir la fiche (si elle n'est pas déjà ouverte) puis
      // cliquer son bouton ; `ficheTxt()` = ce qu'elle dit.
      const publier = async () => {
        if (!(await pg.$('[data-fiche-lbc]'))) { await pg.click('[data-bouton-publier] button'); await pg.waitForSelector('[data-fiche-lbc]', { timeout: 5000 }); }
        await pg.click('[data-fiche-publier]');
      };
      const ficheTxt = () => pg.evaluate(() => { const f = document.querySelector('[data-fiche-lbc]'); return f ? { etat: f.getAttribute('data-fiche-etat'), txt: f.innerText } : null; });
      const v = await lire();
      dit(!errs.length, 'aucune erreur', errs[0]);
      dit(v.boutons.length === 1 && v.boutons[0].id === '7001', 'la paire avec photos a SON bouton, la paire sans photo n\'en a pas', JSON.stringify(v.boutons.map((x) => x.id)));
      dit(!v.orange, 'plus de lien orange « Déposer une annonce » au bas de l\'écran');
      if (cas.suite === 'abandon') {
        await publier();
        await pg.waitForTimeout(1000);
        const fa = await ficheTxt();
        dit(fa && fa.etat === 'abandonne' && /onglet Leboncoin a été fermé/.test(fa.txt) && /Déjà publiée/.test(fa.txt), 'la fiche ouverte le dit aussi (raison + « Déjà publiée »)', fa && fa.etat);
        await pg.click('[data-fiche-lbc] button[aria-label="Fermer"]');
        await pg.waitForTimeout(300);
        const a = (await lire()).boutons[0] || {};
        // ⚠️ Revue du 11 octobre : VRM ne voit pas la fin d'un dépôt fini À LA
        //    MAIN — « n'a pas abouti » était une affirmation sans mesure. On dit
        //    « pas su », la raison, et « Déjà publiée » en face de « Réessayer ».
        dit(a.etat === 'abandonne' && !/n'a pas abouti/.test(a.abandon) && /onglet Leboncoin a été fermé/.test(a.abandon) && /Déjà publiée/.test(a.abandon) && /Réessayer/.test(a.txt), 'onglet du dépôt fermé : la raison, « si tu l’as publiée toi-même, Déjà publiée », et le bouton dit « Réessayer » — jamais « n’a pas abouti »', JSON.stringify(a));
        await publier();
        await pg.waitForTimeout(600);
        const avantOk = await pg.evaluate(() => window.__cmds.length);
        dit(avantOk === 1, '« Réessayer » ne relance RIEN avant sa confirmation (un second dépôt publierait une seconde fois)', String(avantOk));
        const annuler = await pg.$('[data-fiche-confirmer] button:has-text("Annuler")');
        if (annuler) { await annuler.click(); await pg.waitForTimeout(400); }
        dit(!!annuler && (await pg.evaluate(() => window.__cmds.length)) === 1, 'Annuler : rien ne part', String(await pg.evaluate(() => window.__cmds.length)));
        await publier();
        await pg.waitForTimeout(500);
        const relancer = await pg.$('[data-fiche-relancer]');
        if (relancer) { await relancer.click(); await pg.waitForTimeout(700); }
        const cmds = await pg.evaluate(() => window.__cmds);
        dit(cmds.length === 2 && /confirme/.test(cmds[1]), 'confirmé : « Réessayer » renvoie la commande, AVEC sa confirmation (l’extension l’exige)', JSON.stringify(cmds));
        await pg.screenshot({ path: path.join(require('os').tmpdir(), 'publier-abandon.png') });
      } else if (cas.suite === 'confirmer') {
        await publier();
        await pg.waitForTimeout(900);
        const relancer = await pg.$('[data-fiche-relancer]');
        const a = (await ficheTxt()) || {};
        dit(!!relancer && a.etat === 'abandonne' && (await pg.evaluate(() => window.__cmds.length)) === 1, 'l’extension découvre un dépôt abandonné : l’app le dit, et DEMANDE avant de relancer', JSON.stringify({ relancer: !!relancer, etat: a.etat }));
        if (relancer) { await relancer.click(); await pg.waitForTimeout(800); }
        const cmds = await pg.evaluate(() => window.__cmds);
        dit(cmds.length === 2 && /confirme/.test(cmds[1]), 'confirmé : la commande repart avec sa confirmation', JSON.stringify(cmds));
      } else if (cas.suite === 'rien') {
        await publier();
        await pg.waitForTimeout(800);
        const a = (await ficheTxt()) || {};
        dit(a.etat === 'encours' && /Remettre le dépôt devant/.test(a.txt), 'le dépôt est ouvert : la fiche dit « Remettre le dépôt devant »', JSON.stringify(a.etat));
        await pg.click('[data-fiche-publier]');
        await pg.waitForTimeout(600);
        const cmds = await pg.evaluate(() => window.__cmds);
        dit(cmds.length === 2, '« en cours » : un clic RENVOIE la commande (l’extension remet l’onglet devant, ou relance) — jamais un clic muet', JSON.stringify(cmds));
      } else if (cas.suite === 'refus') {
        await publier();
        await pg.waitForTimeout(800);
        const a = (await ficheTxt()) || {};
        dit(/plus dans la file/.test(a.txt || ''), 'un refus de l’extension est DIT dans la fiche, avec sa raison', JSON.stringify(a.etat));
      } else if (cas.version === SEUIL_PUBLIER) {
        dit(v.boutons[0] && v.boutons[0].etat === 'pret', 'extension à jour : le bouton est actif', v.boutons[0] && v.boutons[0].etat);
        dit(v.boutons[0] && v.boutons[0].photos === '2' && v.boutons[0].total === '5' && /2 photos sur 5/.test(v.boutons[0].txt), 'le bouton annonce les photos CAPTÉES sur le total de l’annonce (« 2 photos sur 5 »)', JSON.stringify(v.boutons[0]));
        dit(v.raisons === 0, 'et aucune raison de blocage affichée');
        await publier();
        await pg.waitForTimeout(900);
        const cmds = await pg.evaluate(() => window.__cmds);
        // Extension au seuil de publication (avant la fiche, 5.182) : la fiche
        // non corrigée part « tel quel » — l'identifiant SEUL, comme avant.
        dit(cmds.length === 1 && cmds[0] === 'cmd,id=lbcPublier:7001', 'le clic commande `lbcPublier` avec l\'identifiant SEUL', JSON.stringify(cmds));
        const fo = await ficheTxt();
        dit(fo && fo.etat === 'publiee' && /Publiée sur Leboncoin/.test(fo.txt), 'la fiche suit ce que l\'extension renvoie (« Publiée »)', fo && fo.etat);
        await pg.click('[data-fiche-lbc] button[aria-label="Fermer"]');
        await pg.waitForTimeout(300);
        const apres = await lire();
        dit(apres.boutons[0] && apres.boutons[0].etat === 'fait' && /Publiée/.test(apres.boutons[0].txt), 'et le bouton suit ce que l\'extension renvoie (« Publiée »)', JSON.stringify(apres.boutons[0]));
        await pg.screenshot({ path: path.join(require('os').tmpdir(), 'publier-ok.png') });
      } else {
        dit(v.boutons[0] && v.boutons[0].etat === 'grise', `${nom} : le bouton est GRISÉ, jamais caché`, v.boutons[0] && v.boutons[0].etat);
        dit(v.raisons === 1, 'et la raison est dite UNE fois au-dessus de la liste (§7)', v.raisons + ' fois');
        await pg.click('[data-bouton-publier] button', { force: true });
        await pg.waitForTimeout(400);
        dit((await pg.evaluate(() => window.__cmds.length)) === 0, 'cliquer un bouton grisé n\'envoie rien');
        const g = (await lire()).boutons[0] || {};
        dit(/Mets l'extension à jour|pas détectée/.test(g.txt), '… mais DIT pourquoi, sous le bouton (avant : un clic muet)', JSON.stringify(g));
        await pg.screenshot({ path: path.join(require('os').tmpdir(), 'publier-' + cas.mode + (cas.version || '') + '.png') });
      }
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e.message).slice(0, 160)); }
  if (b) await b.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} publier : ${ko ? ko + ' rouge(s)' : 'tout est vert'}`);
  process.exit(ko ? 1 : 0);
})();
