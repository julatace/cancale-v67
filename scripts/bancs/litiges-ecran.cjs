// ═══════════════════════════════════════════════════════════════════════════
// BANC : « LITIGES EN COURS » + « RETOURS PAR MODÈLE » (10 nov., lots BB et BI)
//        (node scripts/bancs/litiges-ecran.cjs — après `npm run build`)
//        BANC_PORT=… pour un autre port · BANC_DIST=… pour un autre build
// ═══════════════════════════════════════════════════════════════════════════
// Ventes INVENTÉES à la forme mesurée dans sa base le 10 novembre (transactions
// 440 « Retour initié » / 430 « suspendue » en `meta`, « Remboursement effectué »
// `failed`, e-mail « Action requise : problème avec la commande » relié par SA
// conversation, bordereau e-mail `email_bord_{tx}` avec son n° de suivi, ligne
// du transporteur `transp_mondialrelay_{n°}`). Dépôt public : aucune vraie donnée.
//   9401  Dunk, transaction 440, annonce i401 → N°21, bordereau + suivi lu ⇒ carte
//   9402  Samba, e-mail « problème » relié par conversation ⇒ carte « Litige »
//   9403  MÊME TITRE que 9401, finalisée ⇒ jamais une carte (identité, §5)
//   9404  « Transaction suspendue », sans N° ⇒ carte « Sans N° »
//   9405  Dunk, remboursée APRÈS un retour (440) ⇒ BI : retour (pas de carte : clos)
//   9406  Dunk, remboursée, transaction pas captée ⇒ BI : cause pas lue (« au moins »)
//   9407  Samba, annulée (500) ⇒ ni carte ni vente
//   9408-9410 Dunk finalisées ⇒ BI : dénominateur
//   + un retour d'ACHAT par e-mail (« Retourne ta commande d'ici le … ») ⇒ jamais ici.
// Il exige, à 390 px tactile et 1512 px, en clair ET en sombre : l'écran ouvert
// par `?tab=litiges`, EXACTEMENT les trois cartes, leur N° par identité, « Date
// limite non lue », les preuves (suivi + statut du transporteur, bordereau, photo,
// carton « bientôt »), le geste = un LIEN vers vinted.fr (44 px et plus), aucun
// rouge ; « Retours par modèle » : Dunk « au moins 2 sur 6 », Samba « 1 sur 1 »,
// « Autres » en dernier ; l'entrée « Litiges et retours » de Ventes (avec le
// nombre publié) qui OUVRE l'écran ; la source dans « À trancher » ; un second
// rendu où les ventes sont illisibles : « pas pu être lues », jamais « Aucun
// litige ». Aucune requête vers Vinted, aucun débordement, aucune erreur.
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 4417;
const SHOTS = process.env.BANC_SHOTS || os.tmpdir();

const MAINTENANT = Date.now(), H = 3600000;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const PH = (c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${c}"/><path d="M10 52 Q40 30 70 50 L70 60 L10 60Z" fill="#fff" opacity=".85"/></svg>`);
const T = 'Nike Dunk Low noir taille 42';
const fin = "Commande finalisée - l'acheteur a validé la commande";
const v = (tx, title, status, tus, h, extra = {}) => ({ transaction_id: tx, title, status, transaction_user_status: tus, conversation_id: '2461867' + tx, date: ilYaH(h), price: { amount: '70.0', currency_code: 'EUR' }, ...extra });
const VENTES = [
  v(9401, T, 'Retour initié', 'needs_action', 120, { photo: { url: PH('#3a3a3c') } }),
  v(9402, 'Adidas Samba OG blanc 41', 'Bordereau envoyé au vendeur', 'needs_action', 60, { photo: { url: PH('#8e8e93') } }),
  v(9403, T, fin, 'completed', 300),
  v(9404, 'Paire rare vintage', 'Transaction suspendue - en attente de vérification.', 'waiting', 40),
  v(9405, 'Nike Dunk High blanc 41', 'Remboursement effectué', 'failed', 700),
  v(9406, 'Nike Dunk Low gris 43', 'Remboursement effectué', 'failed', 800),
  v(9407, 'Adidas Samba OG 40', 'Remboursement effectué', 'failed', 900),
  v(9408, 'Nike Dunk Low panda 44', fin, 'completed', 1000),
  v(9409, 'Nike Dunk Low panda 45', fin, 'completed', 1100),
  v(9410, 'Nike Dunk Low panda 40', fin, 'completed', 1200),
];
const TXN = [
  { tx: 9401, item: 'i401', s: 440, ss: '' }, { tx: 9403, item: 'i403', s: 450, ss: 'Commande livrée ! ' },
  { tx: 9404, item: '', s: 430, ss: '' }, { tx: 9405, item: 'i405', s: 440, ss: 'Commande livrée ! ' },
  { tx: 9407, item: 'i407', s: 500, ss: 'Bordereau envoyé au vendeur' },
];
const NUMEROS = { i401: { numero: '21', title: T, auto: false }, i403: { numero: '22', title: T, auto: false }, i405: { numero: '23', title: 'Nike Dunk High blanc 41' } };
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const brut = (t) => JSON.stringify({ from: 'no-reply@vinted.fr', subject: 'x', text: t });
const rowsDe = (ventesOk, sombre) => [
  { id: 'main', data: { vinted_dark: !!sombre, vinted_annonce_numeros: NUMEROS, vinted_used_numeros: [21, 22, 23] } },
  ...(ventesOk ? [{ id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: VENTES } } }] : []),
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.2), payload: { items: [], pagination: { total_entries: 0 } } } },
  ...TXN.map((t) => ({ id: `harvest_111_txn_${t.tx}`, data: { capturedAt: ilYaH(1), payload: { transaction: { id: t.tx, item_id: t.item || null, status: t.s, status_title: '', status_updated_at: ilYaH(5), shipment: { status_title: t.ss } } } } })),
  { id: 'email_inconnu_l1', data: { subject: 'Action requise : problème avec la commande « Adidas Samba OG blanc 41 »', receivedAt: ilYaH(20), brut: brut("L'acheteur a signalé un problème. https://www.vinted.fr/inbox/24618679402") } },
  { id: 'email_inconnu_l2', data: { subject: "Retourne ta commande d'ici le 16 nov. : Asics Gel 1130", receivedAt: ilYaH(30), brut: brut('Renvoie-la.') } },
  { id: 'email_bord_9401', data: { uid: '111', type: 'bordereau', suivi: '3SBXAA000401', transaction: '9401', receivedAt: ilYaH(110), filename: 'b9401.pdf', modele: T, transporteur: 'mondialrelay' } },
  { id: 'transp_mondialrelay_3SBXAA000401', data: { suivi: '3SBXAA000401', carrier: 'mondialrelay', etat: 'en_route', libelle: 'Colis en route', etatAt: ilYaH(3), lu: ilYaH(2) } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).replace(/\s+/g, ' ').slice(0, 600)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT)'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let x = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) x = x == null ? null : x[seg];
    out[alias] = x == null ? null : (/->>/.test(src) && typeof x !== 'object' ? String(x) : x);
  }
  return out;
};
const reDe = (motif) => new RegExp('^' + motif.replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$');

async function preparer(b, vp, { ventesOk = true, sombre = false } = {}) {
  const ROWS = rowsDe(ventesOk, sombre);
  const ctx = await b.newContext({ viewport: vp, colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = [], versVinted = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); } catch (_) {} }, sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    if (/vinted\.(fr|com)/i.test(r.request().url()) && !/images\d*\.vinted\.net/.test(r.request().url())) versVinted.push(r.request().url());
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j([]);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    if (!ventesOk && /orders_sold|orders_%|orders_\*/.test(u)) return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne"}' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const eq = /[?&]id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const ou = /[?&]or=\(([^)]*)\)/.exec(u);
    if (ou && /id\.like\./.test(ou[1])) { const res = ou[1].split(',').map((x) => /^id\.like\.(.+)$/.exec(x.trim())).filter(Boolean).map((m) => reDe(m[1])); return j(ROWS.filter((r) => res.some((re) => re.test(r.id))).map(forme)); }
    const lk = /[?&]id=like\.([^&]*)/.exec(u);
    if (lk) { const re = reDe(lk[1]); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, versVinted };
}
async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}
const lire = (pg) => pg.evaluate(() => {
  const el = document.querySelector('[data-litiges-ecran]');
  if (!el) return null;
  const rgb = (c) => (/rgba?\(([^)]+)\)/.exec(c) || [, ''])[1].split(',').map((x) => parseFloat(x));
  const rouge = [...el.querySelectorAll('*')].some((x) => { const cs = getComputedStyle(x); return [cs.color, cs.backgroundColor].some((c) => { const [r, g, b2, a] = rgb(c); return a !== 0 && r > 190 && g < 90 && b2 < 90; }); });
  return {
    etat: el.getAttribute('data-litiges-ecran'), n: el.getAttribute('data-litiges-n'), rouge, txt: el.innerText,
    cartes: [...el.querySelectorAll('[data-litige-carte]')].map((x) => ({
      cle: x.getAttribute('data-litige-carte'), num: x.getAttribute('data-litige-num'), genre: x.getAttribute('data-litige-genre'), lue: x.getAttribute('data-litige-limite-lue'),
      phrase: (x.querySelector('[data-litige-phrase-limite]') || {}).innerText || '',
      preuves: Object.fromEntries([...x.querySelectorAll('[data-preuve]')].map((p) => [p.getAttribute('data-preuve'), { etat: p.getAttribute('data-preuve-etat'), suivi: p.getAttribute('data-preuve-suivi') || '', txt: p.innerText.replace(/\s+/g, ' ') }])),
      geste: (() => { const a = x.querySelector('a[data-litige-geste]'); if (!a) return null; const r = a.getBoundingClientRect(); return { href: a.href, cible: a.target, h: r.height }; })(),
    })),
    modeles: [...el.querySelectorAll('[data-retours-modele]')].map((x) => ({ cle: x.getAttribute('data-retours-modele'), n: x.getAttribute('data-retours-n'), ventes: x.getAttribute('data-ventes-n'), auMoins: x.getAttribute('data-au-moins'), txt: x.innerText.replace(/\s+/g, ' ') })),
    inconnues: (el.querySelector('[data-retours-modeles]') || { getAttribute: () => null }).getAttribute('data-retours-inconnues'),
  };
});
const carte = (a, cle) => (a && a.cartes.find((c) => c.cle === cle)) || null;
const attendre = async (pg, sel, ms = 20000) => { await pg.waitForSelector(sel, { timeout: ms }).catch(() => {}); };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      for (const sombre of [false, true]) {
        const nom = `${vp.width} px ${sombre ? 'sombre' : 'clair'}`;
        console.log(`── ${nom}`);
        const { ctx, pg, errs, versVinted } = await preparer(b, vp, { sombre });
        await essaie('écran', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=litiges`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-litiges-ecran="lu"] [data-litige-carte]');
          await attendre(pg, '[data-retours-modele]');
          await pg.waitForTimeout(2500);
          const a = await lire(pg);
          const cles = a ? a.cartes.map((c) => c.cle).sort().join(',') : '';
          dit(!!a && a.etat === 'lu' && cles === 'v:9401,v:9402,v:9404', `${nom} : EXACTEMENT les ventes en litige / retour (ni la finalisée au même titre, ni le retour d’achat, ni les remboursées closes)`, cles || (a ? a.etat : 'aucun écran'));
          const c1 = carte(a, 'v:9401');
          dit(c1 && c1.num === '21' && c1.genre === 'retour', '9401 : N°21 par identité (pas le 22 au même titre), « Retour »', JSON.stringify(c1 && [c1.num, c1.genre]));
          dit(c1 && c1.lue === '0' && /Date limite non lue/.test(c1.phrase), '9401 : aucune date écrite par Vinted ⇒ « Date limite non lue »', c1 && c1.phrase);
          dit(c1 && c1.preuves.suivi && c1.preuves.suivi.etat === 'ok' && c1.preuves.suivi.suivi === '3SBXAA000401' && /Colis en route/.test(c1.preuves.suivi.txt), '9401 : le suivi de SON bordereau et le statut lu chez le transporteur', JSON.stringify(c1 && c1.preuves.suivi));
          dit(c1 && c1.preuves.bordereau.etat === 'ok' && c1.preuves.photo.etat === 'ok', '9401 : bordereau et photo de l’annonce rangés', JSON.stringify(c1 && c1.preuves));
          dit(c1 && c1.preuves.carton && c1.preuves.carton.etat === 'a-venir' && /bientôt/.test(c1.preuves.carton.txt), 'l’emplacement de la photo du carton est là (« bientôt », lot AZ)', JSON.stringify(c1 && c1.preuves.carton));
          dit(c1 && c1.geste && /^https:\/\/www\.vinted\.fr\/inbox\/24618679401$/.test(c1.geste.href) && c1.geste.cible === '_blank' && c1.geste.h >= 44, 'le geste est un LIEN vers SA conversation sur Vinted, 44 px et plus', JSON.stringify(c1 && c1.geste));
          const c2 = carte(a, 'v:9402');
          dit(c2 && c2.genre === 'probleme' && c2.preuves.bordereau.etat === 'aucun' && c2.preuves.suivi.etat === 'aucun', '9402 : « Litige » relié par la conversation ; aucun bordereau ni suivi inventé', JSON.stringify(c2 && [c2.genre, c2.num, c2.preuves.bordereau]));
          const c4 = carte(a, 'v:9404');
          dit(c4 && c4.genre === 'suspendue' && c4.num === '', '9404 : « Transaction suspendue », sans N°', JSON.stringify(c4 && [c4.genre, c4.num]));
          dit(a && !a.rouge, 'aucun rouge sur l’écran (§7)');
          const m = Object.fromEntries((a ? a.modeles : []).map((x) => [x.cle, x]));
          dit(m['nike|dunk'] && m['nike|dunk'].n === '2' && m['nike|dunk'].ventes === '6' && m['nike|dunk'].auMoins === '1' && /au moins 2 sur 6/.test(m['nike|dunk'].txt), 'Retours par modèle : Dunk « au moins 2 sur 6 » (retours prouvés 440 ; la remboursée pas lue à part)', JSON.stringify(m['nike|dunk']));
          dit(m['adidas|samba'] && m['adidas|samba'].n === '1' && m['adidas|samba'].ventes === '1', 'Samba : « 1 sur 1 » (l’annulée n’est pas une vente)', JSON.stringify(m['adidas|samba']));
          dit(a && a.modeles.length && a.modeles[a.modeles.length - 1].cle === 'autres', '« Autres » en dernier', JSON.stringify(a && a.modeles.map((x) => x.cle)));
          dit(a && a.inconnues === '1' && /cause pas lue/.test(a.txt), 'la vente remboursée à cause pas lue est dite à part', a && a.inconnues);
          await pg.screenshot({ path: path.join(SHOTS, `litiges-ecran-${vp.width}-${sombre ? 'sombre' : 'clair'}.png`), fullPage: true }).catch(() => {});
          await sain(pg, 'Litiges');
        });
        await essaie('entrée depuis Ventes', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=ventes`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-entree-litiges]');
          await pg.waitForTimeout(800);
          const e = await pg.evaluate(() => { const x = document.querySelector('[data-entree-litiges]'); if (!x) return null; const r = x.getBoundingClientRect(); return { n: x.getAttribute('data-entree-litiges'), h: r.height }; });
          dit(e && e.n === '3' && e.h >= 44, 'Ventes : « Litiges et retours » porte le nombre PUBLIÉ (3), 44 px et plus', JSON.stringify(e));
          if (!sombre && vp.width === 390) await pg.screenshot({ path: path.join(SHOTS, 'litiges-entree-ventes-390.png') }).catch(() => {});
          await pg.click('[data-entree-litiges]');
          await attendre(pg, '[data-litiges-ecran]', 15000);
          dit(!!(await pg.$('[data-litiges-ecran]')), 'toucher l’entrée OUVRE l’écran Litiges');
        });
        await essaie('À trancher', async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=trancher`, { waitUntil: 'domcontentloaded' });
          await attendre(pg, '[data-a-trancher-type="ventes"]', 15000);
          const k = await pg.evaluate(() => [...document.querySelectorAll('[data-a-trancher-type="ventes"] [data-a-trancher-carte]')].map((x) => x.getAttribute('data-a-trancher-carte') + ':' + (x.getAttribute('data-num') || '')));
          dit(k.length === 3 && k.every((x) => x.startsWith('litiges-en-cours:')) && k.includes('litiges-en-cours:21'), 'À trancher : le groupe « Ventes » porte les litiges publiés (photo, N° par identité)', JSON.stringify(k));
          if (!sombre && vp.width === 390) await pg.screenshot({ path: path.join(SHOTS, 'litiges-a-trancher-390.png'), fullPage: true }).catch(() => {});
          await pg.click('[data-a-trancher-type="ventes"] [data-a-trancher-ouvrir]');
          await attendre(pg, '[data-litiges-ecran]', 15000);
          dit(!!(await pg.$('[data-litiges-ecran]')), 'le geste d’À trancher ouvre « Litiges en cours »');
        });
        dit(versVinted.length === 0, `${nom} : aucune requête vers Vinted (lecture seule)`, versVinted.slice(0, 3).join(' '));
        dit(errs.length === 0, `${nom} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      }
      const p2 = await preparer(b, vp, { ventesOk: false });
      await essaie('pas su', async () => {
        await p2.pg.goto(`http://localhost:${PORT}/?tab=litiges`, { waitUntil: 'domcontentloaded' });
        await attendre(p2.pg, '[data-litiges-site="vinted"]', 20000);
        await p2.pg.waitForTimeout(1500);
        const a = await lire(p2.pg);
        const site = await p2.pg.evaluate(() => { const x = document.querySelector('[data-litiges-site="vinted"]'); return x ? { etat: x.getAttribute('data-litiges-site-etat'), t: x.innerText.replace(/\s+/g, ' ') } : null; });
        const partiel = await p2.pg.evaluate(() => (document.querySelector('[data-litiges-ecran]') || { getAttribute: () => null }).getAttribute('data-litiges-partiel'));
        // Les e-mails restent lus : la carte de l'e-mail « problème » reste, SANS commande (rien relié).
        dit(!!a && site && site.etat === 'passu' && /ventes Vinted/.test(site.t) && partiel === '1' && !/Aucun litige en cours/.test(a.txt) && !a.cartes.some((c) => /^v:/.test(c.cle)),
          'ventes illisibles ⇒ Vinted « — pas lu : tes ventes Vinted », « Au moins », jamais « Aucun litige en cours »', JSON.stringify({ site, partiel, cartes: a && a.cartes.map((c) => c.cle) }));
        if (vp.width === 390) await p2.pg.screenshot({ path: path.join(SHOTS, 'litiges-passu-390.png'), fullPage: true }).catch(() => {});
        await sain(p2.pg, 'Litiges (pas su)');
      });
      await p2.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ litiges en cours : ${ko} rouge(s)` : '\n✅ litiges en cours : tout est vert');
  process.exit(ko ? 1 : 0);
})();
