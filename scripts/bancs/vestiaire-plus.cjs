// ═══════════════════════════════════════════════════════════════════════════
// BANC : VESTIAIRE « PLUS » (11 nov., lot vestiaire-plus) — après la construction
//        (BANC_PORT pour le port ; SHOTS=dossier pour garder les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Données INVENTÉES (dépôt public), un faux Vestiaire (les lignes que l'extension
// range) et un faux pont d'extension 5.364.0. À 390 px tactile (clair) et 1512 px (sombre) :
//   A. Ma journée : une ligne par offre Vestiaire reçue, celle qui expire le plus tôt
//      d'abord, « bientôt » sous 6 h, le geste « Répondre » ⇒ Messages · Vestiaire
//      (les offres), pas Annonces ; la ligne « messages non lus » aussi.
//   B. Ventes : le récapitulatif d'une vente en contrôle montre le parcours lu
//      (envoyé ✓, arrivé ✓, authentification en cours, validé/payé à venir) et
//      « Vestiaire estime : … · pas encore dans le CA ».
//   C. Mettre en vente : la liste des photos (étiquette pas choisie ⇒ « manque »),
//      « Préparer » DEMANDE d'abord ; « Compléter d'abord » n'envoie rien,
//      « Préparer quand même » envoie `vcPreparer`.
//   D. Baisser des prix : recette pas apprise ⇒ « Fais-le une fois à la main »,
//      rien ne part ; apprise ⇒ −5 € ⇒ UNE commande `vcPrix` (220 → 215), le prix
//      RELU affiché.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8071;
const SHOTS = process.env.SHOTS || process.env.BANC_SHOTS || '';
const MAINTENANT = Date.now(), H = 3600000, J = 24 * H;
const ilYaH = (h) => new Date(MAINTENANT - h * H).toISOString();
const dansH = (h) => new Date(MAINTENANT + h * H).toISOString();
const MOI = '11112222';
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: ilYaH(0) }];
const PHOTO = (n) => `https://images.vestiairecollective.com/produit/${n}-1_3.jpg`;
const offre = (id, produit, exp, cents) => ({ id, produit, compte: MOI, aToi: true, ouverte: true, titre: 'Nike Dunk Low', photo: PHOTO(produit), lien: `https://fr.vestiairecollective.com/x-${produit}.shtml`, offre: cents, net: Math.round(cents * 0.8), initial: 22000, min: 15000, expire: exp, dernier: { action: 'offer', par: 'acheteur', cents, at: ilYaH(3) }, evenements: [] });
const lignes = (appris) => [
  { id: 'main', data: { vinted_used_numeros: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], vinted_annonce_numeros: { '7001': { numero: '41', title: 'Salomon XT-6 blanc taille 40' } } } },
  { id: 'harvest_111_orders_sold', data: { capturedAt: ilYaH(0.2), payload: { my_orders: [] } } },
  { id: 'harvest_111_listings', data: { capturedAt: ilYaH(0.1), payload: { items: [{ id: 7001, title: 'Salomon XT-6 blanc taille 40', brand_title: 'Salomon', size_title: '40', price: { amount: '99.0' }, photo: { url: 'https://img.test/a.jpg' }, nPhotos: 2 }] } } },
  { id: 'vinted_item_details', data: { '7001': { photos: ['https://images1.vinted.net/t/a/f800/a.jpg', 'https://images1.vinted.net/t/a/f800/b.jpg'], description: 'Très bon état.' } } },
  { id: 'vc_session', data: { id: MOI, at: ilYaH(0.1), source: 'me' } },
  { id: 'vc_listings', data: { capturedAt: ilYaH(0.3), complet: true, liens: { 71000001: '41' }, items: {
    71000001: { titre: 'Salomon XT-6', photo: PHOTO(71000001), statut: 'published', vuAt: ilYaH(0.3), compte: MOI, prix: { valeur: 220, devise: 'EUR', cle: 'product.price.cents' } },
    71000002: { titre: 'Sac cabas', photo: PHOTO(71000002), statut: 'published', vuAt: ilYaH(0.3), compte: MOI, prix: { valeur: 150, devise: 'EUR', cle: 'product.price.cents' } },
  } } },
  { id: 'vc_ventes', data: { lectures: { ventes: { at: ilYaH(0.3) } }, ventes: {
    V1: { productId: '71000003', aExpedier: false, date: ilYaH(80), titre: 'Escarpins', photo: PHOTO(71000003), etat: 'IN_PROGRESS', statutVc: 'conformityInProgress',
      etapesVc: { sellerSale: 'done', sellerShipment: 'done', sellerConformity: 'pending', sellerDelivery: 'upcoming', sellerPayment: 'upcoming' }, paiementEstime: '24 nov. 2026',
      montant: { valeur: 120, devise: 'EUR', cle: 'sellerEarning' } },
  } } },
  { id: 'vc_messages', data: { compteur: { messages: 2, at: ilYaH(0.2) }, conversations: {} } },
  { id: 'vc_offres', data: { v: 1, capturedAt: ilYaH(0.2), lecture: { at: ilYaH(0.2), page: '/my-account/offers/', liste: true }, offres: {
    n170000001: offre('170000001', '71000001', dansH(30), 18000),
    n170000002: offre('170000002', '71000002', dansH(2), 12000),
    n170000003: offre('170000003', '71000001', '', 17000),
  } } },
  ...(appris ? [{ id: 'vc_prix_recette', data: { appris: true, raison: '', at: ilYaH(1), ver: '5.364.0' } }] : []),
];
let LIGNES = lignes(false);

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 200)); } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};
// Le faux pont de l'extension 5.364 : il note les commandes et répond comme le fond.
const PONT = ({ version }) => {
  window.__cmds = []; window.__VRM_BAISSE_PAUSE = 0;
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, vcOffre: true, vcPrix: true } });
    if (d.__vmr === 'cmd') {
      const c = {}; for (const k of Object.keys(d)) if (!['__vmr', 'reqId'].includes(k)) c[k] = d[k];
      window.__cmds.push(c);
      if (d.cmd === 'vcPrix') { post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, etape: 'fait', ancien: d.avantCents / 100, prixVu: d.apresCents / 100 } }); return; }
      post({ __vmr: 'cmd:result', reqId: d.reqId, resp: { accepte: true, jobId: 'vc:' + d.id, etape: 'depot' } });
    }
  });
  post({ __vmr: 'ready', version });
};

async function preparer(b, vp, sombre) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', colorScheme: sombre ? 'dark' : 'light', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript((sombre) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_langue', 'fr'); localStorage.setItem('vinted_dark', JSON.stringify(!!sombre)); localStorage.setItem('vrm_visite_vue', 'true'); } catch (_) {} }, sombre);
  await pg.addInitScript(PONT, { version: '5.364.0' });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => {
    if (/images\.vestiairecollective\.com|img\.test|vinted\.net/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#c8b08a"/></svg>' });
    return r.fulfill({ status: 404, body: '' });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: r.data.capturedAt || ilYaH(0), cap: r.data.capturedAt });
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(LIGNES.filter((r) => ids.includes(r.id)).map(forme)); }
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(LIGNES.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(LIGNES.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}
// « Préparer sur Vestiaire » ouvre la feuille commune « VRM travaille » (lot suivi-travail), qui revient
// « Interrompu » après un rechargement : le banc la referme comme lui (Arrêter, puis Fermer).
const degeler = async (pg) => {
  for (let k = 0; k < 3; k++) {
    await pg.waitForTimeout(400);
    const e = await pg.evaluate(() => ({ arr: !!document.querySelector('[data-suivi-arreter]'), oui: !!document.querySelector('[data-suivi-arreter-oui]'), fer: !!document.querySelector('[data-suivi-fermer]') }));
    if (e.oui) { await pg.click('[data-suivi-arreter-oui]').catch(() => {}); continue; }
    if (e.fer) { await pg.click('[data-suivi-fermer]').catch(() => {}); continue; }
    if (e.arr) { await pg.click('[data-suivi-arreter]').catch(() => {}); continue; }
    return;
  }
};
const capture = async (pg, nom) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, 'vp-' + nom + '.png'), fullPage: false }); };
const sain = async (pg, ecran) => {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined|vcParcours\.|vcPhotos\.|vcBaisse\.|journee\.vc/.exec(r.t);
  dit(!m, `${ecran} : ni garde-fou ni clé de traduction affichée`, m && m[0]);
};

(async () => {
  let b;
  try {
    srv.listen(PORT);
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const [vp, sombre] of [[{ width: 390, height: 844 }, false], [{ width: 1512, height: 950 }, true]]) {
      const nomVp = `${vp.width}${sombre ? '-sombre' : ''}`;
      console.log(`── ${nomVp}`);
      LIGNES = lignes(false);
      const { ctx, pg, errs } = await preparer(b, vp, sombre);
      await essaie('A. Ma journée', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vc-offre-journee]', { timeout: 25000 });
        await pg.waitForTimeout(500);
        const l = await pg.evaluate(() => [...document.querySelectorAll('[data-vc-offre-journee]')].map((x) => ({ id: x.getAttribute('data-vc-offre-journee'), b: x.getAttribute('data-vc-offre-bientot'), t: (x.getAttribute('title') || '') + ' ' + x.innerText })));
        dit(l.map((x) => x.id).join(',') === '170000002,170000001,170000003', 'A · une ligne par offre, celle qui expire le plus tôt d’abord (2 h, 30 h, sans échéance)', JSON.stringify(l.map((x) => x.id)));
        dit(l[0] && l[0].b === '1' && l[1] && l[1].b == null, 'A · « expire dans 2 h » marqué bientôt (ambre), l’autre non', JSON.stringify(l.map((x) => x.b)));
        dit(l[0] && /Répondre/.test(l[0].t) && /120\s?€/.test(l[0].t) && /expire dans/.test(l[0].t) && l[2] && /échéance non dite/.test(l[2].t), 'A · le prix, l’échéance (ou « échéance non dite ») et le geste « Répondre »', JSON.stringify(l.map((x) => x.t.replace(/\s+/g, ' '))));
        await capture(pg, `journee-${nomVp}`);
        await sain(pg, 'Ma journée');
        await pg.click('[data-vc-offre-journee="170000002"]');
        await pg.waitForSelector('[data-vc-offres]', { timeout: 15000 });
        const m = await pg.evaluate(() => ({ offres: document.querySelector('[data-vc-offres]').getAttribute('data-vc-offres'), tache: (document.querySelector('[data-tache-vestiaire]') || {}).getAttribute ? document.querySelector('[data-tache-vestiaire]').getAttribute('data-tache-vestiaire') : '' }));
        dit(m.offres === '3' && m.tache === 'messages', 'A · « Répondre » ouvre Messages · Vestiaire, sur les offres (pas Annonces)', JSON.stringify(m));
        await capture(pg, `journee-repondre-${nomVp}`);
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-job="vestiaire-messages"]', { timeout: 20000 });
        await pg.click('[data-job="vestiaire-messages"]');
        const t2 = await pg.waitForSelector('[data-tache-vestiaire="messages"]', { timeout: 15000 }).then(() => 'messages', () => pg.evaluate(() => (document.querySelector('[data-tache-vestiaire]') || { getAttribute: () => 'aucune' }).getAttribute('data-tache-vestiaire')));
        dit(t2 === 'messages', 'A · « 2 messages Vestiaire non lus » ouvre Messages · Vestiaire (avant : Annonces)', t2);
      });
      await essaie('B. Parcours', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=ventes&site=vestiaire`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vc-vente="V1"]', { timeout: 20000 });
        await pg.click('[data-vc-vente="V1"] .vrm-ledger-sale-toggle');
        await pg.waitForSelector('[data-vc-parcours]', { timeout: 10000 });
        const p = await pg.evaluate(() => { const s = [...document.querySelectorAll('[data-vc-parcours]')].find((x) => x.offsetParent !== null) || document.querySelector('[data-vc-parcours]');
          return { etapes: [...s.querySelectorAll('[data-vc-parcours-etape]')].map((x) => x.getAttribute('data-vc-parcours-etape') + ':' + x.getAttribute('data-vc-parcours-etat')).join(','), argent: (document.querySelector('[data-vc-parcours-argent]') || { getAttribute: () => '' }).getAttribute('data-vc-parcours-argent'), t: (document.querySelector('[data-vc-parcours-argent]') || { innerText: '' }).innerText, phrase: (document.querySelector('[data-recap-phrase]') || { innerText: '' }).innerText, segs: s.querySelectorAll('[data-fu-etape]').length }; });
        dit(p.etapes === 'envoye:fait,arrive:fait,authentification:encours,verdict:avenir,paye:avenir', 'B · le parcours LU : envoyé ✓, arrivé ✓, authentification en cours, validé et payé à venir', p.etapes);
        dit(p.segs === 5 && p.argent === 'estime' && /24 nov\. 2026/.test(p.t) && /pas encore dans le CA/.test(p.t), 'B · la frise (5 étapes) et « Vestiaire estime : 24 nov. 2026 · pas encore dans le CA »', JSON.stringify({ segs: p.segs, a: p.argent }));
        dit(/Authentification/.test(p.phrase) && !/IN_PROGRESS/.test(p.phrase), 'B · la phrase du haut dit l’étape lue (« Authentification. »), plus le mot brut « IN_PROGRESS »', p.phrase);
        const nEst = await pg.evaluate(() => (document.body.innerText.match(/24 nov\. 2026/g) || []).length);
        dit(nEst === 1, 'B · la date estimée écrite UNE fois (§7)', String(nEst));
        await pg.evaluate(() => { const s = document.querySelector('[data-vc-parcours]'); if (s) s.scrollIntoView({ block: 'center' }); });
        await capture(pg, `parcours-${nomVp}`);
        await sain(pg, 'Ventes · récapitulatif');
        await pg.keyboard.press('Escape').catch(() => {});
      });
      await essaie('C. Photos avant Préparer', async () => {
        // Le récapitulatif qui se ferme peut interrompre la navigation (ERR_ABORTED) : refaite une fois.
        await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vestiaire`, { waitUntil: 'domcontentloaded' }).catch(() => pg.waitForTimeout(600).then(() => pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vestiaire`, { waitUntil: 'domcontentloaded' })));
        await pg.waitForSelector('[data-vc-photos="7001"]', { timeout: 20000 });
        const m0 = await pg.evaluate(() => document.querySelector('[data-vc-photos="7001"]').getAttribute('data-vc-photos-manque'));
        dit(/etiquette2/.test(m0) && /nombre/.test(m0), 'C · « Photos Vestiaire » : l’étiquette pas choisie et trop peu de photos (2, au moins 4) MANQUENT', m0);
        await pg.click('[data-vc-photos-ouvrir="7001"]');
        const vues = await pg.evaluate(() => [...document.querySelectorAll('[data-vc-photos="7001"] [data-vc-photo-vue]')].map((x) => x.getAttribute('data-vc-photo-vue') + ':' + x.getAttribute('data-vc-photo-etat')));
        dit(vues.includes('semelle:a-verifier') && vues.includes('serie:a-verifier') && vues.includes('origine:a-verifier'), 'C · semelle, n° de série, preuve d’origine : « à vérifier » (VRM ne voit pas une photo)', vues.join(','));
        await pg.evaluate(() => { const s = document.querySelector('[data-vc-photos="7001"]'); if (s) s.scrollIntoView({ block: 'center' }); });
        await capture(pg, `photos-${nomVp}`);
        await pg.click('[data-vc-preparer="7001"]');
        await pg.waitForSelector('button:has-text("Compléter d’abord")', { timeout: 6000 });
        await pg.click('button:has-text("Compléter d’abord")');
        await pg.waitForTimeout(500);
        const c0 = await pg.evaluate(() => window.__cmds.filter((c) => c.cmd === 'vcPreparer').length);
        dit(c0 === 0, 'C · « Compléter d’abord » : rien n’est envoyé à l’extension', String(c0));
        await pg.click('[data-vc-preparer="7001"]');
        await pg.waitForSelector('button:has-text("Préparer quand même")', { timeout: 6000 });
        await pg.click('button:has-text("Préparer quand même")');
        try { const f = await pg.waitForSelector('[data-verif-sheet]', { timeout: 1500 }); if (f) await pg.click('[data-verif-publier]'); } catch (_) {}
        await pg.waitForFunction(() => window.__cmds.some((c) => c.cmd === 'vcPreparer'), null, { timeout: 8000 }).catch(() => {});
        const c1 = await pg.evaluate(() => window.__cmds.filter((c) => c.cmd === 'vcPreparer').map((c) => c.id));
        dit(c1.join() === '7001', 'C · « Préparer quand même » envoie `vcPreparer` (son choix, dit avant)', JSON.stringify(c1));
        await sain(pg, 'Annonces · Vestiaire');
      });
      await essaie('D. Baisser des prix', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vestiaire`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vc-baisse-ouvrir]', { timeout: 20000 });
        await degeler(pg);
        await pg.click('[data-vc-baisse-ouvrir]');
        await pg.waitForSelector('[data-vc-baisse]', { timeout: 8000 });
        const r0 = await pg.evaluate(() => ({ rec: document.querySelector('[data-vc-baisse]').getAttribute('data-vc-baisse-recette'), lancer: document.querySelector('[data-bp-lancer]').disabled, t: document.querySelector('[data-vc-baisse]').innerText }));
        dit(r0.rec === 'pas-appris' && r0.lancer && /Fais-le une fois à la main/.test(r0.t), 'D · recette pas apprise : « Fais-le une fois à la main, VRM apprendra », le bouton ne part pas', JSON.stringify({ rec: r0.rec, l: r0.lancer }));
        await capture(pg, `baisse-apprendre-${nomVp}`);
        await pg.click('[data-bp-fermer]');
        LIGNES = lignes(true);
        await pg.goto(`http://localhost:${PORT}/?tab=annonces&site=vestiaire`, { waitUntil: 'domcontentloaded' });
        await pg.waitForSelector('[data-vc-baisse-ouvrir]', { timeout: 20000 });
        await degeler(pg);
        await pg.click('[data-vc-baisse-ouvrir]');
        await pg.waitForSelector('[data-vc-baisse-recette="pret"]', { timeout: 8000 });
        const l = await pg.evaluate(() => [...document.querySelectorAll('[data-bp-ligne]')].map((x) => [x.getAttribute('data-bp-ligne'), x.getAttribute('data-bp-ancien'), x.getAttribute('data-bp-nouveau'), x.getAttribute('data-bp-coche')].join(':')));
        dit(l.includes('71000001:220:215:1') && l.includes('71000002:150:145:1'), 'D · apprise : −5 € ⇒ 220 → 215 et 150 → 145, cochées', l.join(' '));
        await capture(pg, `baisse-pret-${nomVp}`);
        await pg.click('[data-bp-case="71000002"]');
        await pg.click('[data-bp-lancer]');
        await pg.click('[data-bp-confirmer]');
        await pg.waitForSelector('[data-bp-bilan]', { timeout: 15000 });
        const c = await pg.evaluate(() => ({ cmds: window.__cmds.filter((x) => x.cmd === 'vcPrix'), vu: (document.querySelector('[data-bp-ligne="71000001"]') || { getAttribute: () => '' }).getAttribute('data-bp-prix-vu'), etat: (document.querySelector('[data-bp-ligne="71000001"]') || { getAttribute: () => '' }).getAttribute('data-bp-etat'), autre: (document.querySelector('[data-bp-ligne="71000002"]') || { getAttribute: () => '' }).getAttribute('data-bp-etat') }));
        dit(c.cmds.length === 1 && c.cmds[0].produit === '71000001' && c.cmds[0].avantCents === 22000 && c.cmds[0].apresCents === 21500, 'D · UNE commande `vcPrix` : l’article, le prix LU avant (22 000 c) et le nouveau (21 500 c)', JSON.stringify(c.cmds));
        dit(c.etat === 'fait' && c.vu === '215' && !c.autre, 'D · « fait » au prix RELU (215 €) ; la décochée n’est pas partie', JSON.stringify(c));
        const gel = await pg.evaluate(() => ({ f: !!document.querySelector('[data-suivi-travail="baisse-prix-vestiaire"]'), t: (document.querySelector('[data-suivi-travail]') || { innerText: '' }).innerText }));
        dit(gel.f && /Vestiaire/.test(gel.t), 'D · VRM figé pendant la série : la feuille commune « VRM travaille » (suiviTravail) suit la baisse Vestiaire', gel.t.slice(0, 120));
        await capture(pg, `baisse-fini-${nomVp}`);
        await sain(pg, 'Baisser des prix');
      });
      dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 200));
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Vestiaire plus : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Vestiaire plus : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
