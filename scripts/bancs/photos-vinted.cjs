// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES PHOTOS DU CDN DE VINTED S'AFFICHENT, MÊME QUAND LE CDN REFUSE
//        (node scripts/bancs/photos-vinted.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, 11 octobre : « je n'ai plus les photos de mes annonces, ni dans les
// bordereaux, ni dans les ventes ». Les données sont intactes ; c'est
// l'affichage HORS de vinted.fr qui échoue (cause supposée : CORP ou
// anti-hotlink sur le référent, ou un logiciel de protection — mesurée chez lui
// par la sonde de `src/photosVinted.js`, jamais devinée).
//
// ⚠️ LE FAUX CDN EST UN VRAI SERVEUR HTTPS. Mesuré avant d'écrire ce banc : une
//    image servie par `page.route()` avec `Cross-Origin-Resource-Policy:
//    same-site` S'AFFICHE dans le Chromium du banc (l'interception de Playwright
//    passe à côté du contrôle CORP du réseau) — un banc construit comme ça
//    serait vert sur le défaut. Le CDN est donc un serveur HTTPS local, résolu
//    sous le nom `images1.vinted.net` (`--host-resolver-rules`), avec un
//    certificat jetable fabriqué à chaque lancement (jamais dans le dépôt) :
//    là, CORP bloque pour de vrai (vérifié en tête de banc, sinon il le dit).
//
// Données INVENTÉES (aucune fixture : il vit dans le dépôt, qui est public).
// Le pont de l'extension est simulé avec le VRAI dialogue de `vmrPhoto`
// (`photo` → `photo:result` + `dataUrl`), et compte ses demandes.
//
// Il exige, aux deux tailles (390 px tactile et 1512 px) :
//   A. CDN qui refuse (CORP) + extension : Ventes, Annonces et Colis affichent
//      leurs photos par le secours (naturalWidth > 0) ; au plus 3 demandes en
//      vol ; aucune demande pour une photo hors écran ; aucune redemande quand
//      l'écran se redessine ; aucune phrase (tout s'affiche) ;
//   B. CDN qui refuse, SANS extension : aucune image cassée (le pictogramme),
//      la phrase UNE fois (« bloquée », et le geste qui suit l'appareil), le
//      bilan `diag_photos` écrit SANS adresse, signature ni titre ;
//      et une lecture ratée de `diag_photos` n'écrit rien ;
//   C. CDN qui marche : aucune demande au pont, aucune phrase ;
//   D. CDN qui refuse un RÉFÉRENT : les photos s'affichent sans secours
//      (`no-referrer`), aucune phrase ;
//   E. CDN qui répond une erreur (la sonde reçoit une réponse) : une AUTRE
//      phrase que « bloquée » — on n'affirme pas ce qu'on n'a pas mesuré.
// ── REVUE DU 11 OCTOBRE (deux relecteurs, défauts reproduits) ──
//   A (suite). Ma journée et Achats aussi (le banc ne rendait que trois écrans).
//   G. des liens morts, l'extension rend les autres : aucune phrase (elle
//      disait « l'extension n'a pas pu les récupérer non plus : recharge ») ;
//   H. le CDN est INJOIGNABLE (connexion coupée), puis revient : la phrase
//      n'affirme pas un refus « dans VRM » qu'elle n'a pas mesuré, et APRÈS le
//      retour les photos s'affichent sans recharger (un échec passager était
//      figé pour la session) ;
//   M. les photos de Ventes passent (cache), celles d'Annonces sont bloquées :
//      la phrase sur Annonces (une photo vue ailleurs la faisait taire) ;
//   R. Vinted refuse tout, à l'extension aussi : la phrase ne dit pas
//      « recharge » (le geste ne peut pas marcher) ;
//   L. l'extension répond en 9 s : les photos s'affichent, aucune phrase, et
//      jamais plus de 3 demandes chez elle (un délai de 8 s libérait la place) ;
//   J. l'extension arrive APRÈS l'ouverture, sur Ma journée : les photos
//      reviennent sans changer d'écran (elles étaient retirées pour de bon) ;
//   U. l'extension est MUETTE et un bandeau le dit déjà : « ne répond pas » une
//      seule fois sur l'écran — et sans autre bandeau, la phrase porte le geste.
//      Mesurée 5,5 s après le changement d'écran : la cause s'y remesure, et la
//      phrase ne doit pas DISPARAÎTRE pendant ce temps (le premier jet de la
//      correction l'effaçait 8 s à chaque écran) ;
//   S. des liens morts sur Ventes, puis Annonces bloquée : la cause est
//      remesurée sur l'écran qui échoue (elle restait « le serveur répond ») ;
//   K. à 1512 px, aucun mot de la phrase sous l'île d'actions.
// ── SECONDE REVUE DU 11 OCTOBRE (sept constats confirmés, cinq défauts distincts) ──
//   T. l'extension refuse UNE fois chaque photo (un 503, une coupure de son
//      service worker — le pont ne dit pas pourquoi), puis les rendrait : sans
//      rien toucher, elles reviennent (le témoin la redemande, puis toutes) —
//      elles restaient des pictogrammes, sous « rien à régler ici » ;
//   X. Ma journée, le CDN injoignable à l'ouverture (l'extension, un vrai
//      aller-retour HORS page, échoue aussi), puis en CORP : aucune photo
//      RETIRÉE de la liste pendant la coupure, et elles reviennent ;
//   O. hors ligne sur Ma journée, puis en ligne : rien de retiré, tout revient ;
//   E (suite). le serveur répond (404) : aucune promesse que l'extension les
//      récupérera (elle rend `{ok:false}` sur un statut d'erreur) ;
//   W. PWA qui se réveille (3 s sans réseau) : aucune phrase « le serveur
//      répond » ni « injoignable » — tout réessaie quand le réseau revient ;
//   N. hors ligne mesuré : « pas de connexion », jamais « va sur l'ordinateur » ;
//   Y. le bilan `diag_photos` dit le RETOUR une fois le CDN revenu, et une
//      session sans échec REMPLACE un échec rangé par ce navigateur — sans rien
//      écrire quand rien n'est rangé (C).
// On juge les ÉLÉMENTS rendus (naturalWidth, `data-photo-vinted`,
// `data-photos-bloquees` = la cause affichée, `data-photos-geste`), les
// demandes reçues par le pont et le corps envoyé à la base — pas une formulation.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), https = require('https'), path = require('path'), os = require('os'), cp = require('child_process');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
// PORT_BANC / PORT_CDN : pour tourner à côté d'un autre banc (5741/5742 par défaut).
const PORT = +process.env.PORT_BANC || 5741, PORT_CDN = +process.env.PORT_CDN || 5742;

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();
const dansJ = (j) => { const d = new Date(MAINTENANT + j * 86400000); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
// La forme réelle d'une photo Vinted (mesurée) : /t/<jeton>/f800/<horodatage>.jpeg?s=<signature>.
// Jetons et signatures INVENTÉS.
const hex = (n, l) => (n * 2654435761 >>> 0).toString(16).padStart(8, '0').repeat(Math.ceil(l / 8)).slice(0, l);
const photoUrl = (k) => `https://images1.vinted.net/t/${hex(k, 46)}/f800/${1760000000 + k}.jpeg?s=${hex(k + 7, 40)}`;
const N_ANN = 40;
const ANNONCES = Array.from({ length: N_ANN }, (_, i) => ({
  id: 8100 + i, title: `Banc Annonce ${i + 1} taille 42`, price: { amount: String(40 + i), currency_code: 'EUR' },
  is_closed: false, is_draft: false, brand_title: 'Banc', size_title: '42', status: 'Très bon état', view_count: 3, favourite_count: 1,
  photo: { url: photoUrl(100 + i) }, nPhotos: 4, created_at_ts: Math.floor((MAINTENANT - (i + 1) * 86400000) / 1000),
}));
const VENTES = [
  { tx: 9301, titre: 'Banc Vente Alpha', status: 'Bordereau envoyé au vendeur', tus: 'needs_action', j: 1 },
  { tx: 9302, titre: 'Banc Vente Bravo', status: "Bordereau d'envoi commandé", tus: 'needs_action', j: 1.5 },
  { tx: 9303, titre: 'Banc Vente Charlie', status: "Commande expédiée et en cours d'acheminement ! ", tus: 'waiting', j: 2 },
  { tx: 9304, titre: 'Banc Vente Delta', status: "Commande finalisée - l'acheteur a validé la commande", tus: 'completed', j: 3 },
  { tx: 9305, titre: 'Banc Vente Echo', status: "Commande finalisée - l'acheteur a validé la commande", tus: 'completed', j: 4 },
].map((v, i) => ({ transaction_id: v.tx, title: v.titre, price: { amount: String(50 + i), currency_code: 'EUR' }, status: v.status,
  transaction_user_status: v.tus, date: ilYa(v.j), photo: { url: photoUrl(900 + i) } }));
const ACHATS = ['Banc Achat Un', 'Banc Achat Deux', 'Banc Achat Trois', 'Banc Achat Quatre'].map((t, i) => ({ transaction_id: 9401 + i, title: t,
  price: { amount: String(30 + i), currency_code: 'EUR' }, status: "Commande expédiée et en cours d'acheminement ! ", transaction_user_status: 'waiting',
  date: ilYa(1 + i), photo: { url: photoUrl(700 + i) } }));
const TITRES = [...ANNONCES.map((a) => a.title), ...VENTES.map((v) => v.title), ...ACHATS.map((v) => v.title)];
// Les familles de photos, par leur jeton (pour un CDN qui ne sert QUE certaines).
const JETONS_ANNONCES = ANNONCES.map((_, i) => hex(100 + i, 46));
const JETONS_VENTES = VENTES.map((_, i) => hex(900 + i, 46));
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_banc', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const PDF_B64 = fs.readFileSync(path.join(__dirname, 'bordereau-test.b64'), 'utf8').trim();
const ROWS = [
  { id: 'main', data: {} },
  { id: 'harvest_111_listings', data: { uid: '111', capturedAt: new Date(MAINTENANT).toISOString(), nItems: N_ANN, payload: { items: ANNONCES, pagination: { total_entries: N_ANN, total_pages: 1 } } } },
  { id: 'harvest_111_orders_sold', data: { uid: '111', capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: VENTES } } },
  { id: 'harvest_111_orders_purchased', data: { uid: '111', capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: ACHATS } } },
  { id: 'email_bord_banc_bravo', data: { transaction: '9302', filename: 'bordereau-bravo.pdf', modele: 'Banc Vente Bravo', article: 'Banc Vente Bravo', receivedAt: ilYa(0.2), dateLimite: dansJ(6), pdfB64: PDF_B64 } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
// SEUL=« A 1512 » (par exemple) ne joue que les scénarios dont le nom commence ainsi — pour chercher, jamais pour prouver.
const SEUL = process.env.SEUL || '';
const essaie = async (nom, f) => { if (SEUL && !nom.startsWith(SEUL)) return; try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

// ── L'application ──
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
// Le SERVICE WORKER de l'extension (`photoBytes`) : une requête faite HORS de la
// page — ni CORP, ni référent — vers le faux CDN, comme le vrai. `{dataUrl:null}`
// sur une erreur réseau ou un statut d'erreur (le pont ne relaie que ça).
const SW = { n: 0, ok: 0, ko: 0 };
const srv = http.createServer((q, r) => {
  // Une page VIDE de la même origine que l'app (contrôle 0 : le faux CDN bloque-t-il ?).
  if (q.url === '/__banc-vide') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end('<!doctype html><title>banc</title>'); }
  if (q.url.startsWith('/__sw?')) {
    const u = new URL('http://x' + q.url).searchParams.get('u'); const cible = new URL(u);
    SW.n++;
    const repondre = (j) => { try { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(j)); } catch (_) {} };
    const rq = https.request({ host: '127.0.0.1', port: PORT_CDN, servername: 'images1.vinted.net', path: cible.pathname + cible.search, method: 'GET', rejectUnauthorized: false, headers: { host: 'images1.vinted.net' } }, (rs) => {
      const ch = []; rs.on('data', (c) => ch.push(c)); rs.on('end', () => {
        const ok = rs.statusCode >= 200 && rs.statusCode < 300; const buf = Buffer.concat(ch);
        if (ok && buf.length) { SW.ok++; repondre({ dataUrl: `data:${rs.headers['content-type'] || 'image/jpeg'};base64,${buf.toString('base64')}` }); }
        else { SW.ko++; repondre({ dataUrl: null }); }
      });
    });
    rq.on('error', () => { SW.ko++; repondre({ dataUrl: null }); });
    rq.setTimeout(20000, () => rq.destroy(new Error('timeout')));
    rq.end(); return;
  }
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

// ── Le faux CDN : un VRAI serveur HTTPS, certificat jetable ──
// Une vraie image (PNG 2×2). Le pont rend une autre image (3×3) : on sait ainsi
// laquelle des deux voies a affiché la photo.
const PNG_CDN = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const PNG_PONT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAEklEQVR4nGNgYGBgYmBgYGAAAAAgAAOpuFE0AAAAAElFTkSuQmCC';
const dirCert = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-cdn-'));
cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dirCert, 'k.pem'), '-out', path.join(dirCert, 'c.pem'),
  '-days', '1', '-subj', '/CN=images1.vinted.net', '-addext', 'subjectAltName=DNS:images1.vinted.net'], { stdio: 'ignore' });
// Modes : ok · corp · referent · erreur (404) · coupe (connexion coupée = CDN
// injoignable, comme une panne ou un filtre) · tout403 (refuse TOUT, à
// l'extension aussi) · un-ok (les photos d'annonces en CORP, les autres servies).
const cdnEtat = { mode: 'corp', vues: [] };
const cdn = https.createServer({ key: fs.readFileSync(path.join(dirCert, 'k.pem')), cert: fs.readFileSync(path.join(dirCert, 'c.pem')) }, (q, r) => {
  cdnEtat.vues.push({ url: q.url, ref: q.headers.referer || '', dest: q.headers['sec-fetch-dest'] || '' });
  const m = cdnEtat.mode;
  if (m === 'coupe') { q.socket.destroy(); return; }
  if (m === 'tout403') { r.writeHead(403, { 'content-type': 'text/plain' }); return r.end('hotlink'); }
  if (m === 'erreur' || (m === 'v404-a-corp' && JETONS_VENTES.some((x) => q.url.includes(x)))) { r.writeHead(404, { 'content-type': 'text/html' }); return r.end('<html>introuvable</html>'); }
  if (m === 'referent' && q.headers.referer) { r.writeHead(403, { 'content-type': 'text/plain' }); return r.end('hotlink'); }
  const h = { 'content-type': 'image/png', 'cache-control': 'no-store' };
  if (m === 'corp') h['cross-origin-resource-policy'] = 'same-site';
  if ((m === 'un-ok' || m === 'v404-a-corp') && JETONS_ANNONCES.some((x) => q.url.includes(x))) h['cross-origin-resource-policy'] = 'same-site';
  r.writeHead(200, h); r.end(PNG_CDN);
});
cdn.on('error', (e) => { console.log('KO  le port ' + PORT_CDN + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });

// ── Projection PostgREST minimale (§6.3) ──
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

// ── Le pont de l'extension : le VRAI dialogue de vmrPhoto, et ses compteurs ──
// Options : `refuse` (des morceaux d'adresse que l'extension NE rend PAS — un
// lien mort), `lentPremiers`/`lentMs` (les N premières réponses tardent),
// `retard` (le pont n'existe pas avant ce délai : extension installée ou
// réactivée pendant que VRM est ouvert), `muet` (il annonce sa présence, puis
// ne répond plus à rien : service worker mort).
// `refusUneFois` : {cles, n} — la PREMIÈRE demande de n photos de ces familles
// est refusée (un 503, une coupure du service worker), les suivantes rendues ;
// `sw` : chaque demande fait un vrai aller-retour HORS page (`/__sw`) ;
// `refuseHorsLigne` : hors ligne, l'extension n'obtient rien (son fetch échoue).
const PONT = ({ dataUrl, delai, refuse, refusePremieres, lentPremieres, lentMs, retard, muet, refusUneFois, sw, refuseHorsLigne }) => {
  window.__pont = { enVol: 0, max: 0, total: 0, rendues: 0, refusees: 0, parUrl: {} };
  const version = '5.164.0';
  const t0 = Date.now();
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (retard && Date.now() - t0 < retard) return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'banc' });
    if (muet) return;
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, vrm: { ok: true, connecte: true, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' /* la session de banc (_porte-banc.cjs) */ }, vinted: null, cmds: {} } });
    if (d.__vmr === 'photo') {
      const p = window.__pont;
      p.enVol++; p.total++; p.max = Math.max(p.max, p.enVol); p.parUrl[d.url] = (p.parUrl[d.url] || 0) + 1;
      // `refusePremieres` : {cles, n} — les n PREMIÈRES photos demandées parmi
      // ces familles sont introuvables (un lien mort, à l'écran par construction).
      let nul = !!(refuse && refuse.some((x) => String(d.url).includes(x)));
      if (refusePremieres && refusePremieres.cles.some((x) => String(d.url).includes(x))) {
        p.refusPris = p.refusPris || [];
        if (p.refusPris.includes(d.url)) nul = true;
        else if (p.refusPris.length < refusePremieres.n) { p.refusPris.push(d.url); nul = true; }
      }
      // `lentPremieres` : {cles, n} — les n PREMIÈRES photos demandées parmi ces
      // familles tardent (à l'écran par construction) ; leurs redemandes, non.
      let lente = false;
      if (lentPremieres && lentPremieres.cles.some((x) => String(d.url).includes(x))) {
        p.lentesPrises = p.lentesPrises || [];
        if (!p.lentesPrises.includes(d.url) && p.lentesPrises.length < lentPremieres.n) { p.lentesPrises.push(d.url); lente = true; }
      }
      if (refusUneFois && refusUneFois.cles.some((x) => String(d.url).includes(x))) {
        p.uneFois = p.uneFois || {};
        if (p.uneFois[d.url] === undefined && Object.keys(p.uneFois).length < refusUneFois.n) { p.uneFois[d.url] = 1; nul = true; }
      }
      if (refuseHorsLigne && !navigator.onLine) { nul = true; p.horsLigne = (p.horsLigne || 0) + 1; }
      if (sw && !nul) {
        fetch('/__sw?u=' + encodeURIComponent(d.url)).then((r) => r.json()).catch(() => ({ dataUrl: null })).then((j) => {
          p.enVol--; if (j.dataUrl) p.rendues++; else p.refusees++;
          post({ __vmr: 'photo:result', reqId: d.reqId, dataUrl: j.dataUrl || null });
        });
        return;
      }
      const ms = lente ? lentMs : delai;
      setTimeout(() => { p.enVol--; if (nul || !dataUrl) p.refusees++; else p.rendues++; post({ __vmr: 'photo:result', reqId: d.reqId, dataUrl: nul ? null : dataUrl }); }, ms);
    }
  });
  if (retard) setTimeout(() => post({ __vmr: 'ready', version, id: 'banc' }), retard);
  else post({ __vmr: 'ready', version, id: 'banc' });
};

// `diagStock` : { data } — la ligne `diag_photos` de la base, lue ET réécrite
// (sinon une écriture n'est jamais relue, et « remplacer un échec rangé » ne se
// mesure pas).
async function preparer(b, vp, { pont = false, diagKO = false, pontOpts = {}, diagStock = null } = {}) {
  const ctx = await b.newContext({ viewport: vp, ignoreHTTPSErrors: true, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (pont) await pg.addInitScript(PONT, Object.assign({ dataUrl: PNG_PONT, delai: 700 }, pontOpts));
  // Tout le reste d'Internet est coupé (déterminisme) — sauf le faux CDN, qui
  // passe par le VRAI réseau de Chromium (c'est là que CORP s'applique).
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|images1\.vinted\.net)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      ecrits.push({ url: u, body: req.postData() || '' });
      if (diagStock && /diag_photos/.test(req.postData() || '')) { try { diagStock.data = JSON.parse(req.postData())[0].data; } catch (_) {} }
      return j([]);
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (/id=eq\.diag_photos/.test(u)) return diagKO ? route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' }) : j(diagStock && diagStock.data ? [{ data: diagStock.data }] : []);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecrits };
}

// Ce que l'écran montre : les photos Vinted (adresse du CDN ou URL objet du
// secours), à l'écran ou pas, affichées ou cassées, et les pictogrammes.
const mesurer = (pg) => pg.evaluate(() => {
  // « À l'écran » = dans la fenêtre ET dans la zone visible du conteneur qui
  // défile (`<main data-defile>` : la barre du bas est hors de lui) — sinon une
  // vignette cachée sous la barre compterait comme visible.
  // Et pareil pour tout ancêtre qui ROGNE (un groupe replié à hauteur nulle).
  const dansEcran = (el) => {
    let r = el.getBoundingClientRect();
    let t = r.top, bo = r.bottom, l = r.left, ri = r.right;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
        const ar = a.getBoundingClientRect();
        t = Math.max(t, ar.top); bo = Math.min(bo, ar.bottom); l = Math.max(l, ar.left); ri = Math.min(ri, ar.right);
      }
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      // Un `<details>` FERMÉ garde une boîte à son contenu, mais ne le peint pas.
      if (a.tagName === 'DETAILS' && !a.open && !(el.closest('summary') && a.contains(el.closest('summary')))) return false;
    }
    t = Math.max(t, 0); bo = Math.min(bo, window.innerHeight); l = Math.max(l, 0); ri = Math.min(ri, window.innerWidth);
    return bo - t > 2 && ri - l > 2;
  };
  const imgs = [...document.querySelectorAll('img')].filter((i) => /images1\.vinted\.net|^blob:/.test(i.currentSrc || i.src));
  const out = { total: imgs.length, ecran: 0, affichees: 0, cassees: 0, cassesEcran: 0, secours: 0, picto: 0, pictoEcran: 0, pasAffichees: [] };
  for (const i of imgs) {
    const e = dansEcran(i);
    if (e) out.ecran++;
    if (i.complete && i.naturalWidth > 0 && e) out.affichees++;
    else if (e) {
      const r = i.getBoundingClientRect();
      const ch = []; for (let a = i.parentElement, k = 0; a && k < 6; a = a.parentElement, k++) { const cs = getComputedStyle(a); ch.push(`${a.tagName.toLowerCase()}${a.hasAttribute('data-parti') ? '[parti]' : ''}${a.tagName === 'DETAILS' ? (a.open ? '[open]' : '[ferme]') : ''}:${cs.display}/${cs.overflow}/${Math.round(a.getBoundingClientRect().height)}`); }
      out.pasAffichees.push({ src: (i.src || '').slice(0, 40), complete: i.complete, nw: i.naturalWidth, loading: i.loading, etat: i.getAttribute('data-photo-vinted'), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], chemin: ch.join(' < ') });
    }
    if (i.complete && i.naturalWidth === 0) { out.cassees++; if (e) out.cassesEcran++; }
    if (/^blob:/.test(i.src) && i.naturalWidth > 0) out.secours++;
  }
  for (const s of document.querySelectorAll('[data-photo-vinted="attente"],[data-photo-vinted="perdue"]')) { out.picto++; if (dansEcran(s)) out.pictoEcran++; }
  const ph = [...document.querySelectorAll('[data-photos-bloquees]')];
  out.phrases = ph.length;
  out.sonde = ph[0] ? ph[0].getAttribute('data-photos-bloquees') : null;
  out.geste = ph[0] ? ph[0].getAttribute('data-photos-geste') : null;
  out.texte = ph[0] ? ph[0].innerText : '';
  out.perdues = document.querySelectorAll('[data-photo-vinted="perdue"]').length;
  const t = document.body.innerText;
  out.garde = (/n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(t) || [null])[0];
  out.sw = document.documentElement.scrollWidth; out.cw = document.documentElement.clientWidth;
  return out;
});
const pont = (pg) => pg.evaluate(() => window.__pont ? { ...window.__pont, parUrl: { ...window.__pont.parUrl } } : null);
const ouvrir = async (pg, onglet, ms = 6000) => { await pg.goto(`http://localhost:${PORT}/?tab=${onglet}`, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(ms); };
// (31 oct., navigation par tâche) Les « sections » de Vinted sont devenues des
// TÂCHES : Ventes et Annonces sont des onglets de la navigation (barre du bas,
// colonne), filtrés sur « Vinted » ; les achats Vinted s'ouvrent par la porte
// « Tes achats Vinted › » sous la tâche. Toujours DANS la page (aucun
// rechargement : le cache des photos et le pont restent ceux de la visite).
const allerSection = async (pg, id) => {
  if (id === 'achats') { await pg.locator('[data-espace-site="vinted"]:visible').first().click({ timeout: 8000 }); return; }
  await pg.locator(`.vrm-mobile-nav [data-nav-entree="${id}"]:visible, .vrm-sidebar [data-nav-entree="${id}"]:visible`).first().click({ timeout: 8000 });
  // Un seul site lu (Vinted) ⇒ pas de rangée de filtres : l'écran est déjà celui de Vinted.
  await pg.waitForSelector(`[data-tache="${id}"]`, { timeout: 8000 });
  const filtre = pg.locator(`[data-filtre-site="${id}"] button[data-site="vinted"]`);
  if (await filtre.count()) await filtre.first().click({ timeout: 8000 });
  await pg.waitForSelector(`[data-tache="${id}"][data-tache-site="vinted"]`, { timeout: 8000 });
};
const section = async (pg, id, ms = 4000) => {
  try { await allerSection(pg, id); }
  catch (e) { await capture(pg, 'echec-section-' + id); console.error('Navigation photo :',e.message); throw e; }
  await pg.waitForTimeout(ms);
};
// Amène la première photo en haut de la zone qui défile (sur téléphone, le
// résumé du haut occupe presque tout l'écran), puis laisse le secours arriver.
const versPhotos = async (pg, ms = 4500) => {
  await pg.evaluate(() => {
    const el = document.querySelector('[data-photo-vinted], img[src*="images1.vinted.net"]');
    const m = document.querySelector('main[data-defile]');
    if (el && m) { const r = el.getBoundingClientRect(), mr = m.getBoundingClientRect(); m.scrollTop += r.top - mr.top - 60; }
  });
  await pg.waitForTimeout(ms);
};
// (31 oct.) Depuis les « grandes photos » des écrans Vinted (29 oct.), une
// carte d'annonce occupe tout l'écran d'un téléphone : UNE photo à l'écran à la
// fois (trois par rangée à 1512 px). Les règles jugées ne changent pas — « au
// moins deux photos vues », « trois perdues ⇒ la phrase » — mais sur téléphone
// elles se vérifient en PARCOURANT les cartes comme le ferait Julien : la photo
// n°0, puis n°1, puis n°2 amenée en haut de l'écran, une mesure à chaque arrêt,
// et la somme de ce qui a été VU (chaque photo comptée à son arrêt seulement).
// Ce qui ne se somme pas (la phrase, sa cause, son geste) est lu au dernier arrêt.
const versPhotoN = async (pg, n, ms) => {
  await pg.evaluate((n) => {
    const els = [...document.querySelectorAll('[data-photo-vinted], img[src*="images1.vinted.net"], img[src^="blob:"]')]
      .filter((e, i, a) => !a.some((x, j) => j < i && x.contains(e)));
    const el = els[n]; const m = document.querySelector('main[data-defile]');
    if (el && m) { const r = el.getBoundingClientRect(), mr = m.getBoundingClientRect(); m.scrollTop += r.top - mr.top - 60; }
  }, n);
  await pg.waitForTimeout(ms);
};
const parcourir = async (pg, k = 3, ms = 2500) => {
  let tot = null;
  for (let n = 0; n < k; n++) {
    await versPhotoN(pg, n, ms);
    const m = await mesurer(pg);
    if (!tot) { tot = { ...m, pasAffichees: [...m.pasAffichees] }; continue; }
    for (const c of ['ecran', 'affichees', 'cassesEcran', 'pictoEcran']) tot[c] += m[c];
    for (const c of ['cassees', 'secours', 'picto', 'perdues', 'total']) tot[c] = Math.max(tot[c], m[c]);
    tot.pasAffichees.push(...m.pasAffichees);
    for (const c of ['phrases', 'sonde', 'geste', 'texte', 'garde', 'sw', 'cw']) tot[c] = m[c];
  }
  return tot;
};
// Annonces : à 1512 px une rangée suffit ; sur téléphone, trois cartes parcourues.
const photosAnnonces = async (pg, L, ms) => (L < 600 ? parcourir(pg, 3, Math.max(ms, 2500)) : (await versPhotos(pg, ms), mesurer(pg)));
const detail = (m) => JSON.stringify({ ecran: m.ecran, affichees: m.affichees, cassees: m.cassesEcran, picto: m.pictoEcran, secours: m.secours, pasAffichees: m.pasAffichees.slice(0, 3) });
const defiler = (pg, y) => pg.evaluate((y) => { const m = document.querySelector('main[data-defile]'); if (m) m.scrollTop = y === 'bas' ? m.scrollHeight : y; else window.scrollTo(0, y === 'bas' ? document.body.scrollHeight : y); }, y);
const sain = (m, nom) => {
  dit(!m.garde, `${nom} : l'écran n'est pas tombé sur le garde-fou`, m.garde || '');
  dit(m.sw <= m.cw + 1, `${nom} : aucun débordement horizontal`, `${m.sw} > ${m.cw}`);
};
const capture = (pg, nom) => pg.screenshot({ path: path.join(os.tmpdir(), `photos-vinted-${nom}.png`), fullPage: false }).catch(() => {});
// L’en-tête de main peut être entièrement AU-DESSUS de la phrase. On exige
// sa visibilité dans le viewport, pas un chevauchement vertical artificiel.
// K. Les mots de la phrase qui passent SOUS l'île d'actions (`header` flottant,
// ordinateur) — mesurés mot par mot (un rectangle de bloc ne dit pas quels mots
// sont cachés : c'était le GESTE).
// ⚠️ Mesuré EN HAUT de la page : une phrase défilée hors de l'écran ne passe
//    sous rien, et le contrôle serait vert par vacuité.
const motsSousIle = async (pg) => { await defiler(pg, 0); await pg.waitForTimeout(400); return pg.evaluate(() => {
  const ph = document.querySelector('[data-photos-bloquees]'); const h = document.querySelector('header');
  if (!ph || !h) return { phrase: !!ph, ile: !!h, mots: '' };
  const hb = h.getBoundingClientRect();
  const caches = [];
  const w = document.createTreeWalker(ph, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const re = /\S+/g; let m;
    while ((m = re.exec(n.data))) {
      const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
      for (const c of rg.getClientRects()) if (c.right > hb.left && c.left < hb.right && c.bottom > hb.top && c.top < hb.bottom) { caches.push(m[0]); break; }
    }
  }
  const pb = ph.getBoundingClientRect();
  return { phrase: true, ile: true, mots: caches.join(' '), boite: [Math.round(hb.left), Math.round(hb.top), Math.round(hb.right), Math.round(hb.bottom)],
    viewportHeight:innerHeight, phraseBoite: [Math.round(pb.left), Math.round(pb.top), Math.round(pb.right), Math.round(pb.bottom)] };
}); };
// Ma journée · « Dernières ventes » : les vignettes, et l'icône que l'écran met
// À LA PLACE d'une photo qu'il a retirée de sa liste (`imgMortes`).
const carrousel = (pg) => pg.evaluate(() => {
  const c = document.querySelector('.vrm-carrousel'); if (!c) return null;
  const cartes = [...c.children];
  const imgs = [...c.querySelectorAll('img')];
  return { cartes: cartes.length, affichees: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    secours: imgs.filter((i) => /^blob:/.test(i.src) && i.naturalWidth > 0).length,
    composant: c.querySelectorAll('[data-photo-vinted]').length,
    retirees: cartes.filter((b) => !b.querySelector('img,[data-photo-vinted]')).length };
});
const pageTexte = (pg) => pg.evaluate(() => document.body.innerText);

(async () => {
  let b;
  await new Promise((ok) => srv.listen(PORT, ok));
  await new Promise((ok) => cdn.listen(PORT_CDN, '127.0.0.1', ok));
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
      args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', `--host-resolver-rules=MAP images1.vinted.net 127.0.0.1:${PORT_CDN}`] });

    // ── 0. Le banc mesure-t-il ce qu'il croit mesurer ? ───────────────────────
    await essaie('0', async () => {
      const ctx = await b.newContext({ ignoreHTTPSErrors: true });
      const pg = await ctx.newPage();
      await pg.goto(`http://localhost:${PORT}/__banc-vide`);
      const essai = async (mode) => { cdnEtat.mode = mode; return pg.evaluate((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => ok(0); i.src = u + '&e=' + Math.random(); }), photoUrl(1)); };
      const avecCorp = await essai('corp'), sans = await essai('ok');
      dit(avecCorp === 0 && sans > 0, 'le faux CDN est un vrai serveur : CORP same-site BLOQUE l’image dans ce Chromium, et sans CORP elle s’affiche', `avec CORP ${avecCorp} px · sans ${sans} px`);
      await ctx.close();
    });

    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const L = vp.width;
      console.log(`\n══ ${L} px`);

      // ── A. CDN qui refuse (CORP) + extension ──────────────────────────────
      console.log('── A. le CDN refuse (CORP), l’extension est là');
      cdnEtat.mode = 'corp';
      await essaie(`A ${L}`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { pont: true });
        await ouvrir(pg, 'plat_vinted', 6000);                     // Vinted s'ouvre sur les Ventes
        await versPhotos(pg);
        let m = await mesurer(pg);
        await capture(pg, `A-ventes-${L}`);
        dit(m.ecran >= 2 && m.affichees === m.ecran && m.cassesEcran === 0 && m.pictoEcran === 0,
          `A ${L} Ventes : les photos à l'écran s'affichent (par le secours)`, detail(m));
        sain(m, `A ${L} Ventes`);
        await section(pg, 'annonces', 6000);
        m = await photosAnnonces(pg, L, 4500);
        await capture(pg, `A-annonces-${L}`);
        let p = await pont(pg);
        dit(m.ecran >= 2 && m.affichees === m.ecran && m.cassesEcran === 0 && m.pictoEcran === 0,
          `A ${L} Annonces : les photos à l'écran s'affichent (par le secours)`, detail(m));
        dit(!!p && p.total > 0 && p.total < N_ANN, `A ${L} Annonces : seules les photos à l'écran sont demandées à l'extension (pas les ${N_ANN})`, p ? `${p.total} demande(s)` : 'pont muet');
        const avant = p ? p.total : 0;
        // L'écran se redessine (on change de section et on revient) : rien n'est redemandé.
        await section(pg, 'ventes', 2500);
        await section(pg, 'annonces', 4000);
        p = await pont(pg);
        const doublons = p ? Object.values(p.parUrl).filter((n) => n > 1).length : -1;
        dit(!!p && p.total === avant && doublons === 0, `A ${L} : l'écran redessiné ne redemande rien (cache par photo)`, p ? `${avant} → ${p.total} demande(s), ${doublons} photo(s) demandée(s) deux fois` : 'pont muet');
        // (fin oct.) Sur téléphone, le haut d'Annonces porte plusieurs blocs : la
        // première photo est sous le pli, et changer de section remonte en haut.
        // On redescend vers elles — sans attendre : elles sont déjà en cache.
        await versPhotos(pg, 600);
        m = await mesurer(pg);
        dit(m.affichees === m.ecran && m.ecran > 0, `A ${L} : après le retour, les photos sont toujours là`, JSON.stringify({ ecran: m.ecran, affichees: m.affichees }));
        // On fait défiler : les photos suivantes sont demandées, jamais plus de 3 à la fois.
        for (let y = 600; y < 12000; y += 700) { await defiler(pg, y); await pg.waitForTimeout(450); }
        await defiler(pg, 'bas'); await pg.waitForTimeout(4000);
        p = await pont(pg);
        dit(!!p && p.total > avant, `A ${L} : en faisant défiler, les photos suivantes sont demandées`, p ? `${avant} → ${p.total}` : 'pont muet');
        dit(!!p && p.max >= 1 && p.max <= 3, `A ${L} : au plus 3 demandes en vol à la fois`, p ? `max ${p.max}` : 'pont muet');
        m = await mesurer(pg);
        dit(m.cassees === 0, `A ${L} : aucune image cassée nulle part`, `${m.cassees} cassée(s)`);
        dit(m.phrases === 0, `A ${L} : aucune phrase (tout s'affiche)`, `${m.phrases} phrase(s) : ${m.texte.slice(0, 100)}`);
        // Colis (rechargement : nouvelle ouverture de l'app).
        await ouvrir(pg, 'cat_bord', 6000);
        await versPhotos(pg);
        m = await mesurer(pg);
        await capture(pg, `A-colis-${L}`);
        dit(m.ecran >= 1 && m.affichees === m.ecran && m.cassesEcran === 0,
          `A ${L} Colis : les photos des bordereaux s'affichent (par le secours)`, detail(m));
        sain(m, `A ${L} Colis`);
        // Ma journée (l'écran d'ouverture) : « Dernières ventes ».
        await ouvrir(pg, 'journee', 7000);
        await pg.evaluate(() => { const c = document.querySelector('.vrm-carrousel'); const mn = document.querySelector('main[data-defile]'); if (c && mn) { mn.scrollTop += c.getBoundingClientRect().top - mn.getBoundingClientRect().top - 60; } });
        await pg.waitForTimeout(4500);
        const cj = await carrousel(pg);
        await capture(pg, `A-journee-${L}`);
        dit(!!cj && cj.cartes >= 3 && cj.secours >= 2 && cj.retirees === 0,
          `A ${L} Ma journée : les photos des dernières ventes s'affichent (par le secours)`, JSON.stringify(cj));
        sain(await mesurer(pg), `A ${L} Ma journée`);
        // Achats.
        await ouvrir(pg, 'plat_vinted', 3000);
        await section(pg, 'achats', 4000);
        await pg.click('button:has-text("En route")', { timeout: 8000 });
        await pg.waitForTimeout(3000);
        await versPhotos(pg);
        m = await mesurer(pg);
        await capture(pg, `A-achats-${L}`);
        dit(m.ecran >= 2 && m.affichees === m.ecran && m.cassesEcran === 0 && m.pictoEcran === 0,
          `A ${L} Achats : les photos des achats s'affichent (par le secours)`, detail(m));
        sain(m, `A ${L} Achats`);
        dit(errs.length === 0, `A ${L} : aucune erreur d'app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── B. CDN qui refuse, SANS extension ─────────────────────────────────
      console.log('── B. le CDN refuse, AUCUNE extension ici');
      cdnEtat.mode = 'corp';
      await essaie(`B ${L}`, async () => {
        const { ctx, pg, errs, ecrits } = await preparer(b, vp, { pont: false });
        await ouvrir(pg, 'plat_vinted', 3000);
        await section(pg, 'annonces', 9000);                       // > 7 s : l'extension ne s'est pas manifestée
        await capture(pg, `B-haut-${L}`);
        const m = await photosAnnonces(pg, L, 2500);
        await capture(pg, `B-annonces-${L}`);
        dit(m.cassees === 0, `B ${L} Annonces : aucune image cassée — le pictogramme à la place`, `${m.cassees} cassée(s), ${m.picto} pictogramme(s)`);
        dit(m.pictoEcran >= 2, `B ${L} Annonces : les photos qui ne s'affichent pas gardent leur place (pictogramme)`, `${m.pictoEcran} à l'écran`);
        dit(m.phrases === 1, `B ${L} : la phrase est dite UNE fois`, `${m.phrases} phrase(s)`);
        // Deux échecs réseau espacés, et rien n'a récupéré les photos ici : la
        // phrase dit « n'arrive pas à les charger », pas « refusées dans VRM ».
        dit(m.sonde === 'injoignable', `B ${L} : la cause affichée est celle mesurée (deux échecs réseau, sans extension pour départager)`, String(m.sonde));
        if (L > 1000) {
          const k = await motsSousIle(pg);
          dit(k.phrase && k.ile && k.phraseBoite[1]>=0 && k.phraseBoite[3]<=k.viewportHeight && !k.mots, `K ${L} (sans extension) : la phrase est visible en haut de page, et aucun mot ne passe sous l’en-tête`, k.mots || JSON.stringify(k));
        }
        dit(m.geste === (L < 600 ? 'telephone' : 'chrome'), `B ${L} : le geste suit l'appareil (${L < 600 ? 'sur le téléphone : l’ordinateur' : 'le Chrome où l’extension est installée'})`, String(m.geste) + ' · ' + m.texte.slice(0, 140));
        sain(m, `B ${L} Annonces`);
        await section(pg, 'ventes', 3000);
        const mv = await mesurer(pg);
        dit(mv.cassees === 0 && mv.phrases === 1, `B ${L} Ventes : aucune image cassée, et la phrase toujours UNE fois`, `${mv.cassees} cassée(s), ${mv.phrases} phrase(s)`);
        // Le bilan dans SA base : écrit, et sans rien qui désigne une photo.
        await pg.waitForTimeout(2000);
        const diag = ecrits.filter((e) => /diag_photos/.test(e.body));
        dit(diag.length >= 1, `B ${L} : le bilan diag_photos est écrit`, `${diag.length} écriture(s)`);
        if (diag.length) {
          const corps = diag[diag.length - 1].body;
          const fuites = [/vinted\.net\/t\//i, /f800/, /\?s=/, /\.jpeg/i, /Banc /].filter((r) => r.test(corps)).map(String);
          dit(fuites.length === 0, `B ${L} : le bilan ne porte ni adresse, ni signature, ni titre`, fuites.join(' '));
          let d = null; try { d = JSON.parse(corps)[0].data.dernier; } catch (_) {}
          dit(!!d && d.sonde === 'bloquee' && d.hote === 'images1.vinted.net' && d.ext === 'absente' && d.ko > 0 && d.ok === 0 && typeof d.ecran === 'string',
            `B ${L} : le bilan dit ce qui a été mesuré (sonde, hôte, extension, nombres)`, JSON.stringify(d).slice(0, 220));
        }
        dit(errs.length === 0, `B ${L} : aucune erreur d'app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── C. CDN qui marche ─────────────────────────────────────────────────
      console.log('── C. le CDN marche');
      cdnEtat.mode = 'ok';
      await essaie(`C ${L}`, async () => {
        const { ctx, pg, errs, ecrits } = await preparer(b, vp, { pont: true });
        await ouvrir(pg, 'plat_vinted', 3000);
        await section(pg, 'annonces', 5000);
        const m = await photosAnnonces(pg, L, 2500); const p = await pont(pg);
        dit(m.ecran >= 2 && m.affichees === m.ecran, `C ${L} : les photos s'affichent directement`, JSON.stringify({ ecran: m.ecran, affichees: m.affichees }));
        dit(!!p && p.total === 0, `C ${L} : aucune demande à l'extension`, p ? `${p.total} demande(s)` : 'pont muet');
        dit(m.phrases === 0, `C ${L} : aucune phrase`, `${m.phrases}`);
        // Y (l'autre sens) : tout s'affiche et aucun échec n'est rangé ⇒ AUCUNE
        // écriture de diag_photos (pas une ligne de plus à chaque ouverture).
        await pg.waitForTimeout(4000);
        const diagC = ecrits.filter((e) => /diag_photos/.test(e.body));
        dit(diagC.length === 0, `Y ${L} : tout s'affiche, rien d'échoué n'est rangé ⇒ aucune écriture de diag_photos`, `${diagC.length} écriture(s)`);
        dit(errs.length === 0, `C ${L} : aucune erreur d'app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── D. CDN qui refuse un référent ─────────────────────────────────────
      console.log('── D. le CDN refuse les requêtes qui portent un référent');
      cdnEtat.mode = 'referent'; cdnEtat.vues = [];
      await essaie(`D ${L}`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { pont: false });
        await ouvrir(pg, 'plat_vinted', 3000);
        await section(pg, 'annonces', 7000);
        const m = await photosAnnonces(pg, L, 3000);
        const avecRef = cdnEtat.vues.filter((v) => v.ref).length;
        dit(m.ecran >= 2 && m.affichees === m.ecran && m.cassees === 0, `D ${L} : les photos s'affichent sans secours (aucun référent envoyé)`, JSON.stringify({ ecran: m.ecran, affichees: m.affichees, cassees: m.cassees, demandesAvecReferent: avecRef }));
        dit(m.phrases === 0, `D ${L} : aucune phrase`, `${m.phrases}`);
        dit(errs.length === 0, `D ${L} : aucune erreur d'app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── H. Le CDN est INJOIGNABLE (connexion coupée), puis revient ─────────
      // Un réseau qui hoquette (PWA qui se réveille, filtre, panne) donne la
      // MÊME erreur que CORP. Sur c02ffcf : « Ce navigateur bloque les photos de
      // Vinted dès qu'elles s'affichent en dehors de vinted.fr », puis 36
      // pictogrammes jusqu'au rechargement, le CDN revenu.
      console.log('── H. le CDN est injoignable, puis revient (aucune extension)');
      cdnEtat.mode = 'coupe';
      await essaie(`H ${L}`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { pont: false });
        await ouvrir(pg, 'plat_vinted', 3000);
        await section(pg, 'annonces', 10500);
        // Téléphone : trois cartes parcourues VITE — la coupure doit finir avant
        // le premier passage du témoin (20 s après le premier échec, qui peut
        // dater de l'ouverture : la première carte affleure en bas de l'écran).
        let m = L < 600 ? await parcourir(pg, 3, 1200) : await photosAnnonces(pg, L, 1500);
        await capture(pg, `H-coupe-${L}`);
        dit(m.pictoEcran >= 2 && m.cassees === 0, `H ${L} pendant la coupure : le pictogramme, aucune image cassée`, detail(m));
        dit(m.phrases <= 1 && (m.phrases === 0 || ['injoignable', 'passu'].includes(m.sonde)),
          `H ${L} pendant la coupure : la phrase n'affirme pas un refus « dans VRM » qu'elle n'a pas mesuré`, `${m.phrases} phrase(s), cause ${m.sonde} · ${m.texte.slice(0, 140)}`);
        cdnEtat.mode = 'ok';
        // Sans rien toucher : le témoin réessaie (20 s après le premier constat).
        await pg.waitForTimeout(19000);
        // Téléphone : on remonte les trois cartes vues pendant la coupure (défiler
        // n'est ni recharger ni changer d'écran).
        m = L < 600 ? await parcourir(pg, 3, 800) : await mesurer(pg);
        await capture(pg, `H-retour-${L}`);
        dit(m.ecran >= 2 && m.affichees === m.ecran && m.pictoEcran === 0, `H ${L} le CDN revenu : les photos d'Annonces s'affichent, sans recharger ni changer d'écran`, detail(m));
        dit(m.phrases === 0, `H ${L} le CDN revenu : plus de phrase`, `${m.phrases} : ${m.texte.slice(0, 120)}`);
        await section(pg, 'ventes', 4000);
        await versPhotos(pg, 1500);
        m = await mesurer(pg);
        dit(m.ecran >= 2 && m.affichees === m.ecran && m.pictoEcran === 0, `H ${L} le CDN revenu : celles de Ventes (échouées plus tôt) aussi`, detail(m));
        dit(errs.length === 0, `H ${L} : aucune erreur d'app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });

      // ── M. Ventes passent, Annonces bloquées (aucune extension) ────────────
      // Une photo déjà en cache s'affiche encore quand le CDN se met à refuser
      // les autres (mesuré dans Chromium par la relecture). Sur c02ffcf, une
      // seule photo affichée DANS LA SESSION faisait taire la phrase partout.
      console.log('── M. les photos de Ventes passent, celles d’Annonces sont bloquées');
      cdnEtat.mode = 'un-ok';
      await essaie(`M ${L}`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { pont: false });
        await ouvrir(pg, 'plat_vinted', 4000);
        await versPhotos(pg, 2000);
        let m = await mesurer(pg);
        dit(m.affichees >= 2 && m.phrases === 0, `M ${L} Ventes : les photos passent (le banc sert bien ce mélange), aucune phrase`, detail(m));
        await section(pg, 'annonces', 13500);
        m = await photosAnnonces(pg, L, 2500);
        await capture(pg, `M-annonces-${L}`);
        dit(m.pictoEcran >= 2 && m.phrases === 1, `M ${L} Annonces : toutes bloquées ⇒ la phrase, une fois (une photo vue sur Ventes ne la fait plus taire)`, `${m.phrases} phrase(s), ${m.pictoEcran} pictogramme(s) à l'écran`);
        dit(errs.length === 0, `M ${L} : aucune erreur d'app`, errs.join(' | ').slice(0, 160));
        await ctx.close();
      });
    }

    const V1512 = { width: 1512, height: 950 };
    // ── V. VITESSE : mur connu ⇒ plus de requête directe perdue avant chaque photo ──
    // Julien, 13 octobre : « ça apparaît à certains endroits mais ça prend du
    // temps à charger ». Chaque vignette tentait le direct (voué à échouer en
    // CORP) AVANT de demander l'extension. Une fois PROUVÉ, cette session, que
    // le direct ne passe jamais mais que l'extension réussit, une vignette NEUVE
    // va droit au secours : zéro requête directe de plus au CDN (dest=image),
    // et l'affichage ne paie plus l'échec direct. Les requêtes du SECOURS, elles,
    // atteignent le CDN hors page (dest='') — on ne compte QUE les directes.
    console.log('\n── V. mur connu : un écran neuf ne retente plus le direct — 1512 px');
    cdnEtat.mode = 'corp';
    await essaie('V', async () => {
      const { ctx, pg, errs } = await preparer(b, V1512, { pont: true });
      // 1) Un premier écran établit le mur (direct échoue, l'extension réussit).
      await ouvrir(pg, 'plat_vinted', 6000);
      await versPhotos(pg);
      let m = await mesurer(pg);
      dit(m.ecran >= 2 && m.affichees === m.ecran, 'V : le premier écran affiche ses photos (par le secours)', detail(m));
      // 2) Mur établi : journal du CDN remis à zéro, puis un écran NEUF.
      cdnEtat.vues = [];
      await section(pg, 'annonces', 6000);
      await versPhotos(pg);
      m = await mesurer(pg);
      const directes = cdnEtat.vues.filter((v) => v.dest === 'image').length;
      dit(m.ecran >= 2 && m.affichees === m.ecran, 'V : l’écran neuf affiche ses photos (par le secours)', detail(m));
      dit(directes === 0, 'V : mur connu ⇒ AUCUNE requête directe au CDN pour les photos de l’écran neuf', `${directes} requête(s) directe(s) au CDN`);
      dit(errs.length === 0, 'V : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
    // ── G. Des liens morts, l'extension rend les autres ───────────────────────
    // TROIS refusées (le seuil de la phrase) : c'est la photo récupérée par
    // l'extension À L'ÉCRAN qui doit la faire taire, pas le nombre.
    console.log('\n── G. le CDN refuse (CORP), l’extension rend toutes les photos sauf TROIS — 1512 px');
    cdnEtat.mode = 'corp';
    await essaie('G', async () => {
      const { ctx, pg, errs } = await preparer(b, V1512, { pont: true, pontOpts: { refusePremieres: { cles: JETONS_ANNONCES, n: 3 } } });
      await ouvrir(pg, 'plat_vinted', 3000);
      await section(pg, 'annonces', 9000);
      // Défile vers les photos : l’en-tête compact ne garantit pas que deux
      // photos récupérables soient dans le viewport initial (main aussi).
      await versPhotos(pg,2500);
      // (31 oct.) Grandes photos : une rangée de trois cartes remplit l'écran, et
      // ce sont justement les trois refusées. On descend jusqu'à voir le BAS de
      // la première rangée et le HAUT de la deuxième (rendue par l'extension) :
      // liens morts et photos récupérées à l'écran ensemble, comme avant.
      await pg.evaluate(() => {
        const els = [...document.querySelectorAll('[data-photo-vinted], img[src*="images1.vinted.net"], img[src^="blob:"]')].filter((e, i, a) => !a.some((x, j) => j < i && x.contains(e)));
        const el = els[3], m = document.querySelector('main[data-defile]');
        if (el && m) { const r = el.getBoundingClientRect(); m.scrollTop += r.top - (window.innerHeight - 300); }
      });
      await pg.waitForTimeout(4000);
      const m = await mesurer(pg); const p = await pont(pg);
      await capture(pg, 'G-annonces');
      dit(m.pictoEcran >= 1 && m.affichees >= 1,'G : liens morts et photos récupérées à l’écran ensemble (le scénario est visible)', detail(m));
      dit(!!p && p.refusees >= 3 && m.secours >= 2, 'G : le scénario est réel (l’extension en refuse trois, en rend d’autres)', JSON.stringify({ refusees: p && p.refusees, secours: m.secours }));
      dit(m.phrases === 0, 'G : des liens morts à côté de photos que l’extension a récupérées ⇒ aucune phrase (« l’extension n’a pas pu les récupérer non plus » serait faux)', `${m.phrases} phrase(s) : ${m.texte.slice(0, 160)}`);
      dit(m.perdues >= 3 && m.cassees === 0, 'G : les photos introuvables gardent leur place (pictogramme), aucune image cassée', `${m.perdues} perdue(s), ${m.cassees} cassée(s)`);
      dit(errs.length === 0, 'G : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── R. Vinted refuse TOUT, à l'extension aussi ─────────────────────────
    console.log('\n── R. le CDN refuse tout (403), l’extension n’obtient rien non plus — 1512 px');
    cdnEtat.mode = 'tout403';
    await essaie('R', async () => {
      const { ctx, pg, errs } = await preparer(b, V1512, { pont: true, pontOpts: { dataUrl: null, delai: 300 } });
      await ouvrir(pg, 'plat_vinted', 3000);
      await section(pg, 'annonces', 9000);
      await versPhotos(pg, 2500);
      let m = await mesurer(pg);
      await capture(pg, 'R-annonces');
      dit(m.phrases === 1 && m.sonde === 'reponse', 'R : la phrase, une fois, avec la cause mesurée (le serveur répond)', `${m.phrases} phrase(s), cause ${m.sonde}`);
      dit(m.geste === 'refus' && !/recharge/i.test(m.texte), 'R : l’extension a répondu sans image ⇒ aucun « recharge cette page » (le geste ne pourrait pas marcher)', `${m.geste} · ${m.texte.slice(0, 200)}`);
      const k = await motsSousIle(pg);
      await capture(pg, 'R-haut');
      dit(k.phrase && k.ile && k.phraseBoite[1]>=0 && k.phraseBoite[3]<=k.viewportHeight && !k.mots, 'K 1512 (avec extension) : la phrase est visible en haut de page, et aucun mot ne passe sous l’en-tête', k.mots || JSON.stringify(k));
      await ouvrir(pg, 'plat_vinted', 3000);
      await section(pg, 'annonces', 9000);
      m = await mesurer(pg);
      dit(m.phrases === 1 && m.geste === 'refus', 'R : rouverte, la page dit la même chose (aucune promesse de retour)', `${m.phrases} · ${m.geste}`);
      dit(errs.length === 0, 'R : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── L. L'extension répond en 9 s ───────────────────────────────────────
    console.log('\n── L. le CDN refuse (CORP), l’extension met 9 s à rendre les premières photos d’Annonces — 1512 px');
    cdnEtat.mode = 'corp';
    await essaie('L', async () => {
      const { ctx, pg, errs } = await preparer(b, V1512, { pont: true, pontOpts: { lentPremieres: { cles: JETONS_ANNONCES, n: 3 }, lentMs: 9000 } });
      await ouvrir(pg, 'plat_vinted', 3000);
      await section(pg, 'annonces', 2000);
      await pg.waitForTimeout(16000);
      const m = await mesurer(pg); const p = await pont(pg);
      await capture(pg, 'L-annonces');
      dit(m.ecran >= 2 && m.affichees === m.ecran && m.pictoEcran === 0, 'L : une extension lente (9 s) ⇒ les photos arrivent, aucune perdue', detail(m));
      dit(m.phrases === 0, 'L : aucune phrase « l’extension n’a pas pu les récupérer »', `${m.phrases} : ${m.texte.slice(0, 120)}`);
      dit(!!p && (p.lentesPrises || []).length === 3, 'L : le scénario est réel (trois photos d’Annonces ont tardé 9 s)', p ? String((p.lentesPrises || []).length) : 'pont muet');
      dit(!!p && p.max >= 1 && p.max <= 3, 'L : jamais plus de 3 demandes chez l’extension (la place reste prise jusqu’à la réponse)', p ? `max ${p.max} · ${p.total} demande(s) · ${p.rendues} rendue(s)` : 'pont muet');
      dit(errs.length === 0, 'L : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── J. L'extension arrive APRÈS l'ouverture, sur Ma journée ───────────────
    console.log('\n── J. l’extension arrive 15 s après l’ouverture (Ma journée) — 1512 px');
    cdnEtat.mode = 'corp';
    await essaie('J', async () => {
      const { ctx, pg, errs } = await preparer(b, V1512, { pont: true, pontOpts: { retard: 15000, delai: 300 } });
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(12000);
      const c1 = await carrousel(pg);
      await capture(pg, 'J-journee-12s');
      dit(!!c1 && c1.cartes >= 3 && c1.retirees === 0, 'J à 12 s (pas encore d’extension) : aucune photo RETIRÉE de la liste (elle attend, pictogramme)', JSON.stringify(c1));
      await pg.waitForTimeout(13000);
      const c2 = await carrousel(pg); const p = await pont(pg);
      await capture(pg, 'J-journee-25s');
      dit(!!c2 && c2.secours >= 2 && c2.retirees === 0, 'J à 25 s (extension arrivée à 15 s) : les photos reviennent, sans changer d’écran', JSON.stringify(c2) + ` · ${p ? p.total : 0} demande(s) au pont`);
      dit(errs.length === 0, 'J : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── U. L'extension est MUETTE, et un bandeau le dit déjà ─────────────────
    console.log('\n── U. l’extension est présente mais muette, une vente à expédier — 1512 px');
    cdnEtat.mode = 'corp';
    await essaie('U', async () => {
      const { ctx, pg, errs } = await preparer(b, V1512, { pont: true, pontOpts: { muet: true } });
      await ouvrir(pg, 'plat_vinted', 42000);
      await versPhotos(pg, 1500);
      const repli=await mesurer(pg);
      // ⚠️ Depuis le 16 octobre la raison des bordereaux grisés n'est plus repliée (seule l'aide « sur Vinted »
      //    l'est) : le bandeau muet est VISIBLE sans rien déplier, avec son « Recharger la page ». La règle jugée ne
      //    change pas : le geste utile est À L'ÉCRAN sans rien ouvrir — dans la phrase des photos, ou dans le
      //    bandeau visible (et alors la phrase ne le redit pas, §7).
      const visibleGeste=await pg.evaluate(()=>{const v=e=>!!e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';const bd=document.querySelector('[data-raison-bord="muette"]');return v(bd)&&v(bd.querySelector('[data-recharger]'));});
      dit(repli.phrases===1 && ((repli.geste==='muette' && /recharge/i.test(repli.texte)) || (visibleGeste && !/recharge/i.test(repli.texte))),'U replié : une aide cachée ne prive pas les photos du geste utile',`${visibleGeste?'bandeau visible · ':''}${repli.geste} · ${repli.texte}`);
      // L'aide repliée « sur Vinted » n'existe plus sur Ventes (il ne reste qu'une
      // `.vrm-label-help`, celle de l'imprimante, sur Colis) : on la déplie
      // seulement si elle est là — la règle jugée ensuite reste la même.
      const aideRepliee = pg.locator('[data-raison-bord] .vrm-label-help > summary').first();
      if (await aideRepliee.isVisible().catch(() => false)) await aideRepliee.click();
      await pg.waitForTimeout(500);
      let m = await mesurer(pg);
      await capture(pg, 'U-ventes');
      const bandeau = await pg.evaluate(() => !!document.querySelector('[data-raison-bord="muette"]'));
      const texte = await pageTexte(pg);
      const nNeRepondPas = (texte.match(/ne répond pas/gi) || []).length;
      dit(bandeau, 'U Ventes : le scénario est réel (le bandeau des bordereaux dit que l’extension est muette)', String(bandeau));
      dit(m.phrases === 1, 'U Ventes : la phrase des photos est là (une fois)', `${m.phrases}`);
      dit(nNeRepondPas === 1 && !/recharge/i.test(m.texte), 'U Ventes : « ne répond pas » dit UNE fois sur l’écran, et la phrase des photos ne redit pas le geste', `« ne répond pas » ×${nNeRepondPas} · phrase : ${m.geste} · ${m.texte.slice(0, 160)}`);
      // L'autre sens : là où aucun bandeau ne le dit, la phrase porte le geste.
      await section(pg, 'annonces', 4000);
      await versPhotos(pg, 1500);
      m = await mesurer(pg);
      const autreVoix = await pg.evaluate(() => !!document.querySelector('[data-raison-bord="muette"],[data-raison-publier="muette"]'));
      dit(autreVoix || (m.phrases === 1 && m.geste === 'muette' && /recharge/i.test(m.texte)), 'U Annonces : sans autre bandeau, la phrase dit le geste (recharger)', `${autreVoix ? 'un bandeau le dit' : ''} ${m.phrases} · ${m.geste} · ${m.texte.slice(0, 160)}`);
      dit(errs.length === 0, 'U : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── S. La cause se mesure sur l'écran qui échoue ─────────────────────────
    // Des liens morts (404) sur Ventes, puis Annonces bloquée par CORP. Sur
    // c02ffcf, la sonde ne tournait qu'au PREMIER échec : « le serveur répond »
    // pour toute la session, Annonces comprise.
    console.log('\n── S. liens morts sur Ventes, puis Annonces bloquée — 1512 px');
    cdnEtat.mode = 'v404-a-corp';
    await essaie('S', async () => {
      const { ctx, pg, errs } = await preparer(b, V1512, { pont: false });
      await ouvrir(pg, 'plat_vinted', 12000);
      let m = await mesurer(pg);
      dit(m.phrases === 1 && m.sonde === 'reponse', 'S Ventes : liens morts ⇒ cause « le serveur répond » (le scénario est réel)', `${m.phrases} · ${m.sonde}`);
      await section(pg, 'annonces', 13000);
      m = await mesurer(pg);
      dit(m.phrases === 1 && m.sonde === 'injoignable', 'S Annonces : la cause est REMESURÉE sur l’écran qui échoue (pas celle des liens morts de Ventes)', `${m.phrases} · ${m.sonde} · ${m.texte.slice(0, 120)}`);
      dit(errs.length === 0, 'S : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── E. Le serveur RÉPOND (une erreur) : une autre phrase que « bloquée » ──
    console.log('\n── E. le CDN répond une erreur (la sonde reçoit une réponse) — 1512 px');
    cdnEtat.mode = 'erreur';
    await essaie('E', async () => {
      const { ctx, pg, errs } = await preparer(b, { width: 1512, height: 950 }, { pont: false });
      await ouvrir(pg, 'plat_vinted', 3000);
      await section(pg, 'annonces', 12000);
      const m = await mesurer(pg);
      dit(m.phrases === 1 && m.sonde === 'reponse', 'E : la sonde a mesuré « le serveur a répondu », et la phrase est dite une fois', `${m.phrases} phrase(s), sonde ${m.sonde}`);
      dit(m.phrases === 1 && !/bloque/i.test(m.texte), 'E : la phrase n’affirme pas un blocage du navigateur qu’on n’a pas mesuré', m.texte.slice(0, 160));
      // ⚠️ Seconde revue : sur une réponse d'erreur, l'extension rend `{ok:false}`
      // (photoBytes) — la phrase ne promet pas qu'elle « va les chercher ».
      dit(m.phrases === 1 && m.geste === 'reponse', 'E : le serveur répond ⇒ aucune promesse que l’extension les récupérera (le geste ne dépend pas d’elle)', `${m.geste} · ${m.texte.slice(0, 200)}`);
      dit(m.cassees === 0, 'E : aucune image cassée', `${m.cassees}`);
      dit(errs.length === 0, 'E : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
    // Le même cas sur téléphone : c7efee0 y disait « sur l'ordinateur où
    // l'extension VRM est installée, c'est elle qui les récupère » — la même
    // promesse non mesurée, sous le geste `telephone`.
    cdnEtat.mode = 'erreur';
    await essaie('E390', async () => {
      const { ctx, pg, errs } = await preparer(b, { width: 390, height: 844 }, { pont: false });
      await ouvrir(pg, 'plat_vinted', 3000);
      await section(pg, 'annonces', 12000);
      // Les photos sont sous le pli du téléphone : la phrase ne parle que de
      // celles À L'ÉCRAN (décision du 11 oct.), on descend vers elles.
      // (31 oct.) Une carte par écran : trois cartes parcourues (photosAnnonces).
      const m = await photosAnnonces(pg, 390, 3000);
      dit(m.phrases === 1 && m.sonde === 'reponse', 'E390 : le scénario est réel (sonde « le serveur a répondu », la phrase est là)', `${m.phrases} phrase(s), sonde ${m.sonde}`);
      dit(m.phrases === 1 && m.geste === 'reponse' && !/les r[ée]cup[èe]re|va les chercher/i.test(m.texte), 'E390 : sur téléphone non plus, aucune promesse que l’extension les récupérera', `${m.geste} · ${m.texte.slice(0, 220)}`);
      dit(errs.length === 0, 'E390 : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── F. La lecture de diag_photos rate : rien n'est écrit ─────────────────
    console.log('\n── F. la base ne rend pas diag_photos (522) — 1512 px');
    cdnEtat.mode = 'corp';
    await essaie('F', async () => {
      const { ctx, pg, ecrits } = await preparer(b, { width: 1512, height: 950 }, { pont: false, diagKO: true });
      await ouvrir(pg, 'plat_vinted', 3000);
      await section(pg, 'annonces', 13000);
      const diag = ecrits.filter((e) => /diag_photos/.test(e.body));
      dit(diag.length === 0, 'F : lecture ratée de diag_photos ⇒ aucune écriture (« rien lu » ne vaut pas « rien »)', `${diag.length} écriture(s)`);
      await ctx.close();
    });
    // ══ SECONDE REVUE DU 11 OCTOBRE ══════════════════════════════════════════
    const V390 = { width: 390, height: 844 };
    const urlsRefusees = (p) => (p && p.uneFois ? Object.keys(p.uneFois) : []);

    // ── T. L'extension refuse UNE fois chaque photo, puis les rendrait ─────────
    // Un 503 ou un 429 du CDN, une coupure de son service worker : le pont ne
    // relaie que `dataUrl`, la réponse arrive comme un lien mort. Sur c7efee0 :
    // 3 pictogrammes pour toute la session, une seule demande par photo.
    console.log('\n── T. l’extension refuse une fois trois photos d’Annonces, puis les rendrait — 1512 px');
    cdnEtat.mode = 'corp';
    await essaie('T', async () => {
      const { ctx, pg, errs } = await preparer(b, V1512, { pont: true, pontOpts: { refusUneFois: { cles: JETONS_ANNONCES, n: 3 } } });
      await ouvrir(pg, 'plat_vinted', 3000);
      await section(pg, 'annonces', 6000);
      await versPhotos(pg, 2000);
      let m = await mesurer(pg); let p = await pont(pg);
      const refusees = urlsRefusees(p);
      await capture(pg, 'T-annonces-t0');
      dit(refusees.length === 3 && m.perdues >= 3, 'T : le scénario est réel (trois photos refusées une fois, « perdues » à l’écran)', `${refusees.length} refusée(s), ${m.perdues} perdue(s)`);
      // Sans rien toucher : le témoin passe à 20 s.
      await pg.waitForTimeout(24000);
      m = await mesurer(pg); p = await pont(pg);
      await capture(pg, 'T-annonces-t30');
      const redemandes = refusees.map((u) => p.parUrl[u] || 0);
      dit(m.ecran >= 2 && m.affichees === m.ecran && m.pictoEcran === 0 && m.perdues === 0, 'T : sans rien toucher, les photos refusées une fois reviennent (l’extension leur est redemandée)', detail(m) + ` · perdues ${m.perdues}`);
      dit(redemandes.length === 3 && redemandes.every((n) => n === 2), 'T : chacune redemandée UNE fois de plus, pas davantage', JSON.stringify(redemandes));
      dit(m.phrases === 0, 'T : aucune phrase', `${m.phrases} : ${m.texte.slice(0, 120)}`);
      dit(errs.length === 0, 'T : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });
    console.log('\n── T390. Ventes : l’extension refuse une fois toutes les photos — 390 px');
    cdnEtat.mode = 'corp';
    await essaie('T390', async () => {
      const { ctx, pg, errs } = await preparer(b, V390, { pont: true, pontOpts: { refusUneFois: { cles: JETONS_VENTES, n: 99 } } });
      // La cause se mesure en deux sondes espacées de 8 s : la phrase arrive vers 11 s.
      await ouvrir(pg, 'plat_vinted', 9000);
      await versPhotos(pg, 3500);
      let m = await mesurer(pg);
      await capture(pg, 'T390-ventes-t0');
      dit(m.phrases === 1 && m.geste === 'refus', 'T390 : le scénario est réel (la phrase « l’extension n’a pas pu » est là)', `${m.phrases} · ${m.geste}`);
      dit(!/rien à régler/i.test(m.texte), 'T390 : la phrase ne dit plus « rien à régler ici » (un rechargement les faisait revenir)', m.texte.slice(0, 200));
      await pg.waitForTimeout(24000);
      m = await mesurer(pg);
      await capture(pg, 'T390-ventes-t30');
      dit(m.ecran >= 2 && m.affichees === m.ecran && m.pictoEcran === 0, 'T390 : sans rien toucher, les photos de Ventes reviennent', detail(m));
      dit(m.phrases === 0, 'T390 : et la phrase s’en va', `${m.phrases} : ${m.texte.slice(0, 120)}`);
      dit(errs.length === 0, 'T390 : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── X. Ma journée : le CDN injoignable à l'ouverture, puis en CORP ─────────
    // L'extension fait un VRAI aller-retour hors page : pendant la coupure elle
    // échoue aussi. Sur c7efee0 : les 5 photos RETIRÉES de la liste (onError sur
    // un refus « définitif »), et jamais remontrées une fois le réseau revenu.
    console.log('\n── X. Ma journée : le CDN coupé à l’ouverture (l’extension échoue aussi), puis en CORP — 1512 px');
    cdnEtat.mode = 'coupe';
    SW.n = SW.ok = SW.ko = 0;
    await essaie('X', async () => {
      const { ctx, pg, errs } = await preparer(b, V1512, { pont: true, pontOpts: { sw: true } });
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(6000);
      await pg.evaluate(() => { const c = document.querySelector('.vrm-carrousel'); const mn = document.querySelector('main[data-defile]'); if (c && mn) { mn.scrollTop += c.getBoundingClientRect().top - mn.getBoundingClientRect().top - 60; } });
      await pg.waitForTimeout(6000);
      const c1 = await carrousel(pg); const p1 = await pont(pg);
      await capture(pg, 'X-journee-coupe');
      dit(!!p1 && p1.refusees >= 2 && SW.ko >= 2, 'X : le scénario est réel (l’extension, hors page, a échoué pendant la coupure)', `pont ${p1 && p1.refusees} refusée(s) · service worker ${JSON.stringify(SW)}`);
      dit(!!c1 && c1.cartes >= 3 && c1.retirees === 0, 'X pendant la coupure : aucune photo RETIRÉE de la liste (elles gardent leur place)', JSON.stringify(c1));
      cdnEtat.mode = 'corp';                        // le réseau revient ; la PAGE reste refusée (CORP)
      await pg.waitForTimeout(30000);
      const c2 = await carrousel(pg); const p2 = await pont(pg);
      await capture(pg, 'X-journee-retour');
      dit(!!c2 && c2.secours >= 2 && c2.retirees === 0, 'X le réseau revenu : les photos des dernières ventes reviennent par l’extension, sans recharger', JSON.stringify(c2) + ` · pont ${p2 && p2.total} demande(s) · service worker ${JSON.stringify(SW)}`);
      dit(errs.length === 0, 'X : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── O. Hors ligne sur Ma journée, puis en ligne ────────────────────────────
    console.log('\n── O. hors ligne sur Ma journée (l’extension n’obtient rien), puis en ligne — 1512 px');
    cdnEtat.mode = 'corp';
    await essaie('O', async () => {
      const { ctx, pg, errs } = await preparer(b, V1512, { pont: true, pontOpts: { refuseHorsLigne: true } });
      // ⚠️ (20 octobre) Passer par Vinted d'abord affichait la section Ventes
      //    (l'onglet s'ouvre sur elle) : l'extension y rendait les photos des
      //    ventes, mises en cache — Ma journée les montrait hors ligne SANS
      //    rien demander, et le contrôle « le scénario est réel » tombait. On
      //    part d'un écran sans photo de vente : Ma journée les demande bien
      //    hors ligne (sinon rien ne prouve qu'elles « reviennent »).
      await ouvrir(pg, 'settings', 3000);
      await ctx.setOffline(true);
      await pg.getByRole('button', { name: /Ma journée/ }).first().click();
      await pg.waitForTimeout(5000);
      // ⚠️ (21 oct., 5588c02 — vu au rendu le 22 oct.) Hors ligne, la COQUE remplace
      //    tous les écrans par la copie de Ma journée, en lecture seule
      //    (`JourneeHorsLigne`, `data-hors-ligne`) : plus aucune liste de photos
      //    n'est montée pendant la coupure, donc aucune ne peut en être RETIRÉE —
      //    c'est le retour qui juge (plus bas : rien de retiré, tout revient).
      //    Le scénario est réel quand la coupure est bien celle que l'app voit.
      const hl = await pg.evaluate(() => ({ horsLigne: navigator.onLine === false, copie: (document.querySelector('[data-hors-ligne]') || {}).dataset ? document.querySelector('[data-hors-ligne]').dataset.horsLigne : null, carrousel: !!document.querySelector('.vrm-carrousel') }));
      await capture(pg, 'O-horsligne');
      dit(hl.horsLigne && !!hl.copie && !hl.carrousel, 'O : le scénario est réel (hors ligne, la coque montre la copie de Ma journée, aucune liste de photos montée)', JSON.stringify(hl));
      await ctx.setOffline(false);
      await pg.waitForTimeout(12000);
      const c2 = await carrousel(pg);
      await capture(pg, 'O-enligne');
      dit(!!c2 && c2.secours >= 2 && c2.retirees === 0, 'O de nouveau en ligne : les photos reviennent, sans recharger ni changer d’écran', JSON.stringify(c2));
      dit(errs.length === 0, 'O : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── W. PWA qui se réveille : 3 s sans réseau, puis il revient ──────────────
    console.log('\n── W. le réseau manque 3 s à l’ouverture d’Annonces, puis revient (téléphone, aucune extension)');
    cdnEtat.mode = 'ok';
    await essaie('W', async () => {
      const { ctx, pg, errs } = await preparer(b, V390, { pont: false });
      await ouvrir(pg, 'plat_vinted', 9000);
      cdnEtat.mode = 'coupe';
      await section(pg, 'annonces', 300);
      await versPhotos(pg, 0);                    // plusieurs photos À L'ÉCRAN échouent pendant la coupure
      const t0 = Date.now();
      const journal = [];
      let bascule = false, faux = '', maxPicto = 0, tour = 0;
      // (31 oct.) Une carte par écran sur téléphone : pendant la coupure on
      // passe d'une carte à l'autre (0, 1, 2…) et on additionne le plus de
      // pictogrammes vus à CHAQUE arrêt — trois photos vues échouer, comme avant.
      const parArret = [0, 0, 0];
      while (Date.now() - t0 < 30000) {
        if (!bascule && Date.now() - t0 > 3000) { cdnEtat.mode = 'ok'; bascule = true; journal.push(`${((Date.now() - t0) / 1000).toFixed(1)} s : réseau revenu`); }
        if (!bascule) await versPhotoN(pg, tour % 3, 0);
        const m = await mesurer(pg);
        if (!bascule) { parArret[tour % 3] = Math.max(parArret[tour % 3], m.pictoEcran); maxPicto = parArret.reduce((a, x) => a + x, 0); tour++; }
        const etat = `${m.phrases ? m.sonde + '/' + m.geste : '—'} · ${m.affichees} affichée(s) / ${m.pictoEcran} picto(s)`;
        if (!journal.length || !journal[journal.length - 1].endsWith(etat)) journal.push(`${((Date.now() - t0) / 1000).toFixed(1)} s : ${etat}`);
        if (m.phrases && /reponse|injoignable/.test(m.sonde || '') && !faux) faux = m.texte.slice(0, 160);
        await pg.waitForTimeout(bascule ? 700 : 300);
      }
      const m = await parcourir(pg, 3, 1500);
      dit(maxPicto >= 3, 'W : le scénario est réel (au moins trois photos à l’écran échouent pendant la coupure)', `${maxPicto} pictogramme(s) au plus`);
      dit(!faux, 'W : réseau revenu en 3 s — aucune phrase « le serveur répond » ni « injoignable »', journal.join(' | ').slice(0, 400) + (faux ? ' · « ' + faux + ' »' : ''));
      dit(m.ecran >= 2 && m.affichees === m.ecran && m.phrases === 0, 'W : les photos sont là, sans phrase', detail(m));
      dit(errs.length === 0, 'W : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── N. Hors ligne mesuré (téléphone, aucune extension) ─────────────────────
    console.log('\n── N. le téléphone perd le réseau (navigator.onLine = false), aucune extension');
    cdnEtat.mode = 'ok';
    await essaie('N', async () => {
      const { ctx, pg, errs } = await preparer(b, V390, { pont: false });
      await ouvrir(pg, 'plat_vinted', 6000);
      await ctx.setOffline(true);
      await pg.waitForTimeout(3000);
      // ⚠️ (21 oct., 5588c02 — vu au rendu le 22 oct.) Hors ligne, la coque montre la
      //    copie de Ma journée À LA PLACE de tous les écrans : la navigation des
      //    sections n'existe plus pendant la coupure (le banc y cliquait encore,
      //    et mourait sur le délai du clic). Ce que la coupure doit encore
      //    garantir : la coque dit « hors ligne », et aucune phrase des photos ne
      //    dit « pas pu mesurer » ni « va sur l'ordinateur ». Puis, le réseau
      //    revenu, des photos JAMAIS chargées (Annonces) s'affichent sans phrase :
      //    la coupure n'a rien laissé de figé.
      const m = await mesurer(pg);
      const horsLigne = await pg.evaluate(() => navigator.onLine === false);
      const copie = await pg.evaluate(() => !!document.querySelector('[data-hors-ligne]') && /hors ligne/i.test(document.body.innerText));
      await capture(pg, 'N-horsligne');
      dit(horsLigne && copie, 'N : le scénario est réel (hors ligne, la coque le dit)', `onLine=${!horsLigne} · copie hors ligne ${copie}`);
      dit(m.phrases === 0 || (m.sonde === 'horsligne' && m.geste === 'reseau'), 'N : hors ligne ⇒ « pas de connexion », jamais « pas pu mesurer » ni « va sur l’ordinateur »', `${m.phrases} · ${m.sonde}/${m.geste} · ${m.texte.slice(0, 180)}`);
      await ctx.setOffline(false);
      await pg.waitForTimeout(3000);
      await section(pg, 'annonces', 6000);
      const m2 = await parcourir(pg, 3, 3000);   // une carte par écran : trois parcourues
      dit(m2.ecran >= 2 && m2.affichees === m2.ecran && m2.phrases === 0, 'N de nouveau en ligne : les photos reviennent, plus de phrase', detail(m2));
      dit(errs.length === 0, 'N : aucune erreur d’app', errs.join(' | ').slice(0, 160));
      await ctx.close();
    });

    // ── Y. Le bilan diag_photos dit le RETOUR (téléphone, aucune extension) ────
    console.log('\n── Y. le bilan diag_photos après le retour du CDN, et une session sans échec qui remplace un échec rangé');
    cdnEtat.mode = 'coupe';
    await essaie('Y', async () => {
      const stock = { data: null };
      const { ctx, pg, ecrits } = await preparer(b, V390, { pont: false, diagStock: stock });
      await ouvrir(pg, 'plat_vinted', 3000);
      await section(pg, 'annonces', 4000);
      // Les photos sont sous le pli du téléphone : on les amène À L'ÉCRAN pendant
      // la coupure (le témoin ne surveille qu'une photo visible).
      await versPhotos(pg, 12000);
      const nav = await pg.evaluate(() => { const u = navigator.userAgent || ''; return (/iPhone|iPad/.test(u) ? 'iOS ' : /Android/.test(u) ? 'Android ' : /Mac/.test(u) ? 'Mac ' : /Windows/.test(u) ? 'Windows ' : '') + (/Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'autre'); });
      const d1 = stock.data && stock.data.parNavigateur && stock.data.parNavigateur[nav];
      dit(!!d1 && d1.ko > 0 && d1.ok === 0, 'Y : le scénario est réel (pendant la coupure, le bilan rangé dit l’échec)', JSON.stringify(d1).slice(0, 200));
      cdnEtat.mode = 'ok';
      await pg.waitForTimeout(38000);
      const m = await parcourir(pg, 3, 2000);    // une carte par écran : trois parcourues
      const d2 = stock.data && stock.data.parNavigateur && stock.data.parNavigateur[nav];
      dit(m.ecran >= 2 && m.affichees === m.ecran && m.phrases === 0, 'Y : les photos sont revenues (le témoin), plus de phrase', detail(m));
      dit(!!d2 && d2.retours > 0 && d2.ok > 0 && d2.enEchec === 0, 'Y : le bilan rangé dit le RETOUR (revenues, 0 en échec) — plus « bloquée, 0 affichée, 0 revenue »', JSON.stringify(d2).slice(0, 240));
      await ctx.close();
      // Une session suivante où tout s'affiche REMPLACE l'échec rangé par ce navigateur.
      cdnEtat.mode = 'ok';
      const stock2 = { data: { at: new Date(MAINTENANT - 3600e3).toISOString(), parNavigateur: { [nav]: { at: new Date(MAINTENANT - 3600e3).toISOString(), ko: 9, ok: 0, retours: 0, sonde: 'bloquee', ext: 'absente' } } } };
      const s2 = await preparer(b, V1512, { pont: false, diagStock: stock2 });
      await ouvrir(s2.pg, 'plat_vinted', 3000);
      await section(s2.pg, 'annonces', 12000);
      const d3 = stock2.data && stock2.data.parNavigateur && stock2.data.parNavigateur[nav];
      dit(!!d3 && d3.ko === 0 && d3.ok > 0 && d3.sansEchec === true, 'Y : une session où tout s’affiche remplace l’échec rangé par ce navigateur', JSON.stringify(d3).slice(0, 200));
      await s2.ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally {
    if (b) await b.close();
    srv.close(); cdn.close();
    try { fs.rmSync(dirCert, { recursive: true, force: true }); } catch (_) {}
  }
  console.log(ko ? `\n❌ photos-vinted : ${ko} rouge(s)` : '\n✅ photos-vinted : tout est vert');
  process.exit(ko ? 1 : 0);
})();
