// Banc : VESTIAIRE — ANNONCES EN FICHES, VENTES PAR ÉTAPE, COMPTE OUVERT MIS EN AVANT (1er nov.)
//
// Julien : « occupe-toi des dernières modifications : les annonces Vestiaire
// Collective, les ventes, tout ça — que tout soit parfait ».
// Données INVENTÉES (le dépôt est public) : deux comptes Vestiaire `compteA`
// (ouvert dans l'onglet il y a 10 min, `vc_session`) et `compteB`, trois
// annonces, trois ventes, deux achats, deux conversations. 390 px tactile et 1512 px.
// Il exige, en jugeant des data-* et des nombres rendus (jamais un libellé seul) :
//   1. Annonces · Vestiaire : une FICHE par annonce — photo, N° relié par la
//      référence (jamais le titre), prix lu, état (en ligne / vendue / en attente),
//      la fraîcheur de la lecture dite une fois ; « vendue » prouvée par une vente ;
//   2. Ventes · Vestiaire : l'ÉTAPE de chaque vente (à expédier avec la date
//      limite, contrôle par Vestiaire, mot inconnu recopié tel quel) et AUCUN
//      montant à l'écran — la raison dite UNE fois ;
//   3. flou : la ligne du compte ouvert nette, celle de l'autre compte estompée
//      (Annonces, Ventes, Achats, Messages) ; une ligne sans compte jamais floutée ;
//      sans extension, ou session de plus de 12 h : rien n'est flouté ;
//   4. lectures : un 401 passager est relu (l'écran s'affiche), une base en
//      panne dit « pas su » avec « Réessayer » (44 px), jamais une liste vide ;
//   5. aucune erreur, aucun débordement ; captures dans le dossier temporaire.
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8573;
const CAPTURES = process.env.BANC_CAPTURES || os.tmpdir();

const maintenant = Date.now();
const ilYaH = (h) => new Date(maintenant - h * 3600e3).toISOString();
const demain = new Date(maintenant + 30 * 3600e3).toISOString();
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const PHOTO = 'https://images.vestiairecollective.com/produit/banc-P1.jpg';
const lignes = ({ sessionH = 10 / 60 } = {}) => [
  { id: 'main', data: { vinted_annonce_numeros: {} } },
  { id: 'vc_session', data: { id: 'compteA', at: ilYaH(sessionH), source: 'users/me', comptes: { compteA: ilYaH(sessionH), compteB: ilYaH(50) } } },
  { id: 'vc_listings', data: { capturedAt: ilYaH(2), complet: true, total: 3, liens: {}, items: {
    P1: { boost: true, ref: '41', titre: 'Baskets Nike Dunk Low', photo: PHOTO, prix: { valeur: 99, devise: 'EUR', cle: 'price.cents' }, statut: 'on_sale', compte: 'compteA', favoris: 4, vuAt: ilYaH(2) },
    P2: { boost: null, ref: '42', titre: 'Adidas Samba', photo: '', prix: { valeur: 70, devise: 'EUR', cle: 'price' }, statut: 'on_sale', compte: 'compteB', vuAt: ilYaH(2) },
    P3: { boost: null, ref: '', titre: 'New Balance 550', photo: '', prix: null, statut: 'pending_review', compte: '', vuAt: ilYaH(2) },
  } } },
  { id: 'vc_ventes', data: { lectures: { 'a-expedier': { at: ilYaH(1), total: 1, complet: true }, ventes: { at: ilYaH(1), total: 3, complet: true } }, ventes: {
    V1: { productId: 'P9', ref: '41', etat: 'to_ship', date: ilYaH(20), montant: { valeur: 123.45, devise: 'EUR', cle: 'price' }, limite: demain, etiquette: true, aExpedier: true, compte: 'compteA' },
    V2: { productId: 'P2', ref: '42', etat: 'authentication_in_progress', date: ilYaH(60), montant: { valeur: 87.65, devise: 'EUR', cle: 'earnings' }, aExpedier: false, compte: 'compteB' },
    V3: { productId: 'P7', ref: '', etat: 'paid', date: ilYaH(90), montant: { valeur: 54.32, devise: 'EUR', cle: 'total' }, aExpedier: false, compte: '' },
  } } },
  { id: 'vc_achats', data: { lecture: { at: ilYaH(1), total: 2, complet: true }, achats: {
    AA: { productId: 'Q1', nom: 'Achat du compte A', etat: 'delivered', date: ilYaH(100), compte: 'compteA' },
    AB: { productId: 'Q2', nom: 'Achat du compte B', etat: 'delivered', date: ilYaH(110), compte: 'compteB' },
  } } },
  { id: 'vc_messages', data: { compteur: { messages: 1, at: ilYaH(0.5) }, lecture: { at: ilYaH(0.5), total: 2, complet: true, page: '/messages/' }, conversations: {
    CA: { productId: 'P1', ref: '41', nonLu: true, date: ilYaH(3), compte: 'compteA', apercu: 'Bonjour, toujours dispo ?' },
    CB: { productId: 'P2', ref: '42', nonLu: false, date: ilYaH(5), compte: 'compteB', apercu: 'Merci !' },
  } } },
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
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    const texte = /->>[^>]*$/.test(src);
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    if (texte && v != null && typeof v !== 'string') v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v == null ? null : v;
  }
  return out;
};
// Le pont : une extension à jour, connectée à CE compte VRM.
const PONT = () => {
  const version = '5.296.0';
  const post = (m) => window.postMessage(m, '*');
  const vrm = { ok: true, connecte: true, expiree: false, email: 'banc@vrm.test', user_id: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b', cloisonne: false };
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'authEtat') post({ __vmr: 'authEtat:result', reqId: d.reqId, etat: vrm });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm, vinted: null, cmds: {} } });
    if (d.__vmr === 'cmd') post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: false, code: 'banc' } });
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

async function ouvrir(b, vp, { ext = true, sessionH, panne = {} } = {}) {
  const rows = lignes({ sessionH });
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const lus = {};
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (ext) await pg.addInitScript(PONT);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    if (r.request().url() === PHOTO) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#bbb"/></svg>' });
    return ['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue();
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const eq = /id=eq\.([^&]*)/.exec(u);
    // Les pannes servies : `{ id: 'toujours' | 'une' }` — un 500 à chaque fois, ou un 401 la première fois.
    if (eq && panne[eq[1]]) {
      lus[eq[1]] = (lus[eq[1]] || 0) + 1;
      if (panne[eq[1]] === 'toujours') return route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"panne de banc"}' });
      if (panne[eq[1]] === 'une' && lus[eq[1]] === 1) return route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"message":"JWT expired"}' });
    }
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: ilYaH(0), cap: (r.data || {}).capturedAt });
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vestiaire`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, lus };
}
const aller = async (pg, tache, attendre) => {
  await pg.goto(pg.url().split('?')[0] + `?tab=${tache}&site=vestiaire`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await pg.waitForSelector(attendre, { timeout: 15000 }).catch(() => {});
  await pg.waitForTimeout(900);   // la lecture du compte ouvert (vc_session) arrive à côté
  // (11 nov., agent2-regroupe-comptes) Les lignes d'un autre compte sont dans un groupe REPLIÉ : on le
  // déplie (estompées, jamais masquées, à un toucher) ; rend le nombre de groupes dépliés.
  const n = await pg.evaluate(() => { const bs = [...document.querySelectorAll('[data-groupe-compte="compte"][aria-expanded="false"]')]; bs.forEach((x) => x.click()); return bs.length; });
  if (n) await pg.waitForTimeout(300);
  return n;
};
const etatLigne = (pg, sel) => pg.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const cs = getComputedStyle(e);
  return { attr: e.getAttribute('data-flou'), flou: /blur/.test(cs.filter), op: Number(cs.opacity) };
}, sel);
const net = (x) => !!(x && x.attr === '0' && !x.flou && x.op > 0.9);
const floue = (x) => !!(x && x.attr === '1' && x.flou && x.op < 0.6);
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const LIGNES = [
  ['annonces', 'Annonces', '[data-vc-annonces="lu"]', '[data-vc-annonce="P1"]', '[data-vc-annonce="P2"]'],
  ['ventes', 'Ventes', '[data-vc-ventes="lu"]', '[data-vc-vente="V1"]', '[data-vc-vente="V2"]'],
  ['achats', 'Achats', '[data-vc-achats="lu"]', '[data-vc-achat="AA"]', '[data-vc-achat="AB"]'],
  ['messages', 'Messages', '[data-vc-messages="lu"]', '[data-vc-conv="CA"]', '[data-vc-conv="CB"]'],
];

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px · extension connectée, compteA ouvert sur Vestiaire (il y a 10 min)`);
      const o = await ouvrir(b, vp);
      // 1. Les fiches.
      await aller(o.pg, 'annonces', '[data-vc-annonces="lu"]');
      const an = await o.pg.evaluate(() => {
        const e = document.querySelector('[data-vc-annonces]'); if (!e) return null;
        const f = [...e.querySelectorAll('[data-vc-annonce]')].map((x) => ({ id: x.getAttribute('data-vc-annonce'), num: x.getAttribute('data-vc-annonce-num'), etat: x.getAttribute('data-vc-annonce-etat'), prix: (x.querySelector('[data-vc-annonce-prix]') || { getAttribute: () => null }).getAttribute('data-vc-annonce-prix'), img: (x.querySelector('img') || {}).src || '', t: x.innerText }));
        const fr = e.querySelector('[data-vc-annonces-fraicheur]');
        return { etat: e.getAttribute('data-vc-annonces'), n: e.getAttribute('data-vc-annonces-n'), f, fr: fr ? fr.innerText : '' };
      });
      const P = (id) => an && an.f.find((x) => x.id === id);
      dit(an && an.etat === 'lu' && an.n === '3' && an.f.length === 3, 'Annonces : une fiche par annonce lue', JSON.stringify(an && an.f.map((x) => x.id)));
      dit(P('P1') && P('P1').num === '41' && P('P1').prix === '99' && /99,00/.test(P('P1').t) && P('P1').etat === 'en-ligne' && /banc-P1\.jpg/.test(P('P1').img), 'Annonces : la fiche porte la photo, le N° relié par la référence, le prix lu et « en ligne »', JSON.stringify(P('P1')));
      dit(P('P2') && P('P2').etat === 'vendue', 'Annonces : une annonce dont une VENTE est lue (même article) est « vendue », même si Vestiaire écrit encore on_sale', JSON.stringify(P('P2') && P('P2').etat));
      // (2 nov., soir, « un numéro par annonce ») Sans référence, l'annonce reçoit un N° NEUF
      // (par son productId, au-dessus de tout N° servi) — jamais celui d'une autre, jamais par le titre.
      dit(P('P3') && P('P3').etat === 'attente' && Number(P('P3').num) > 42 && P('P3').prix === '', 'Annonces : sans référence ⇒ un N° neuf (jamais deviné, jamais par le titre) ; sans prix ⇒ « — »', JSON.stringify(P('P3')));
      // (9 nov., lot AI) La ligne courte « 3 annonces · lues il y a 2 h » (la phrase entière est dans sa pop-up).
      dit(an && /lues? (sur Vestiaire )?il y a 2 h/.test(an.fr) && !/confirmer/i.test(an.fr), 'Annonces : la fraîcheur de la lecture dite une fois, en tête', an && an.fr.slice(0, 140));
      await o.pg.screenshot({ path: path.join(CAPTURES, `vc-fiches-annonces-${vp.width}.png`), fullPage: true }).catch(() => {});
      // 2. Les ventes.
      await aller(o.pg, 'ventes', '[data-vc-ventes="lu"]');
      const ve = await o.pg.evaluate(() => {
        const e = document.querySelector('[data-vc-ventes]'); if (!e) return null;
        const carte = e.closest('[data-tache-vestiaire]') || e.parentElement;
        const v = [...e.querySelectorAll('[data-vc-vente]')].map((x) => ({ id: x.getAttribute('data-vc-vente'), etape: x.getAttribute('data-vc-vente-etape'), t: x.innerText }));
        return { etat: e.getAttribute('data-vc-ventes'), v, txt: carte ? carte.innerText : '', phrase: document.querySelectorAll('[data-vc-ventes-montant]').length };
      });
      const V = (id) => ve && ve.v.find((x) => x.id === id);
      dit(V('V1') && V('V1').etape === 'a-expedier' && /À expédier/.test(V('V1').t) && /à envoyer avant le/.test(V('V1').t), 'Ventes : « à expédier » en tête, avec la date limite', JSON.stringify(V('V1')));
      dit(V('V2') && V('V2').etape === 'controle', 'Ventes : « authentication_in_progress » ⇒ l’étape « contrôle par Vestiaire »', JSON.stringify(V('V2') && V('V2').etape));
      dit(V('V3') && V('V3').etape === 'autre' && /« paid »/.test(V('V3').t), 'Ventes : « paid » (payée par qui ?) n’est pas rangé : recopié tel quel', JSON.stringify(V('V3')));
      // (2 nov., soir) Comme Vinted, la ligne montre ce que Vestiaire VERSE quand c'est sûr
      // (`montantRecuVc` : la clé « earnings » le dit) ; un montant pas sûr ne s'affiche jamais.
      dit(ve && !/123[,.]45|54[,.]32/.test(ve.txt) && /87,65/.test(ve.txt) && ve.phrase === 1, 'Ventes : seul le montant SÛR (versé) à l’écran, jamais un montant pas sûr ; la raison dite une seule fois', `phrase×${ve && ve.phrase}`);
      await o.pg.screenshot({ path: path.join(CAPTURES, `vc-fiches-ventes-${vp.width}.png`), fullPage: true }).catch(() => {});
      // 3. Le flou, sur les quatre écrans.
      for (const [k, nom, att, selA, selB] of LIGNES) {
        const replies = await aller(o.pg, k, att);
        if (k !== 'messages') dit(replies === 1, `${nom} : compteB regroupé à part, replié (11 nov.)`, String(replies));
        const a = await etatLigne(o.pg, selA), bb = await etatLigne(o.pg, selB);
        dit(net(a) && floue(bb), `${nom} : la ligne de compteA est nette, celle de compteB est là mais estompée`, JSON.stringify({ a, b: bb }));
      }
      await aller(o.pg, 'annonces', '[data-vc-annonces="lu"]');
      dit(net(await etatLigne(o.pg, '[data-vc-annonce="P3"]')), 'Annonces : une ligne sans compte relevé n’est jamais floutée');
      const d = await deborde(o.pg);
      dit(d.sw <= d.cw + 1, 'aucun débordement', `${d.sw}/${d.cw}`);
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 160));
      await o.ctx.close();
    }
    for (const [titre, opts] of [['sans extension dans ce navigateur', { ext: false }], ['session Vestiaire vue il y a 20 h (pas « ouverte »)', { sessionH: 20 }]]) {
      console.log(`── 390 px · ${titre}`);
      const o = await ouvrir(b, { width: 390, height: 844 }, opts);
      for (const [k, nom, att, selA, selB] of LIGNES) {
        await aller(o.pg, k, att);
        const a = await etatLigne(o.pg, selA), bb = await etatLigne(o.pg, selB);
        dit(net(a) && net(bb), `${nom} : rien n’est flouté`, JSON.stringify({ a, b: bb }));
      }
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 160));
      await o.ctx.close();
    }
    {
      console.log('── 390 px · lectures : vc_listings répond 401 une fois (jeton expiré), vc_ventes et vc_achats en panne');
      const o = await ouvrir(b, { width: 390, height: 844 }, { panne: { vc_listings: 'une', vc_ventes: 'toujours', vc_achats: 'toujours' } });
      await aller(o.pg, 'annonces', '[data-vc-annonces]:not([data-vc-annonces="charge"])');
      await o.pg.waitForSelector('[data-vc-annonces="lu"]', { timeout: 8000 }).catch(() => {});
      const e1 = await o.pg.evaluate(() => (document.querySelector('[data-vc-annonces]') || {}).getAttribute?.('data-vc-annonces') || null);
      dit(e1 === 'lu' && o.lus.vc_listings >= 2, 'un 401 passager est relu : les annonces s’affichent', `etat=${e1} lectures=${o.lus.vc_listings}`);
      await aller(o.pg, 'ventes', '[data-vc-ventes="pas-su"]');
      const pv = await o.pg.evaluate(() => { const e = document.querySelector('[data-vc-ventes]'); const bt = document.querySelector('[data-vc-ventes-relire]'); return e ? { etat: e.getAttribute('data-vc-ventes'), t: e.innerText, h: bt ? bt.getBoundingClientRect().height : 0 } : null; });
      dit(pv && pv.etat === 'pas-su' && /pas pu lire/.test(pv.t) && !/Aucune vente/.test(pv.t) && pv.h >= 44, 'une base en panne : « pas su » avec la raison et « Réessayer » (44 px), jamais « aucune vente »', JSON.stringify(pv));
      await o.pg.screenshot({ path: path.join(CAPTURES, 'vc-fiches-panne-390.png'), fullPage: true }).catch(() => {});
      await aller(o.pg, 'achats', '[data-vc-achats="pas-su"]');
      const pa = await o.pg.evaluate(() => { const e = document.querySelector('[data-vc-achats]'); return e ? e.getAttribute('data-vc-achats') : null; });
      dit(pa === 'pas-su', 'achats : la panne dit « pas su »', String(pa));
      dit(o.errs.length === 0, 'aucune erreur d’app', o.errs.join(' | ').slice(0, 160));
      await o.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Vestiaire, fiches et ventes : ${ko} rouge(s)` : '\n✅ Vestiaire, fiches et ventes : tout est vert');
  process.exit(ko ? 1 : 0);
})();
