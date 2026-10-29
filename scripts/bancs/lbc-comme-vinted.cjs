// Banc : LEBONCOIN « COMME VINTED » (29 octobre) — ventes, annonces, messages,
// favoris reçus, outil Republier.
//
// Julien : « côté vente fais les mêmes modifications que pour Vinted ; enlève
// N° », « le statut de l'annonce », « regarde ce qu'il y a dans l'onglet
// Messages », « messages aux favoris, tout pareil » (Leboncoin SEULEMENT),
// « un outil de republication comme pour Vinted, exactement pareil ».
// Données INVENTÉES (il vit dans le dépôt), 390 et 1512 px, port 6333
// (`BANC_PORT`). Il exige :
//   · Ventes : le titre d'une vente Leboncoin n'a PAS de « N° » (le N° reste
//     dans le tiroir, « Fiche article N°… ») ;
//   · Annonces : une annonce en ligne dit ses chiffres relevés (favoris, vues)
//     et depuis quand elle est en ligne ; jamais un chiffre absent écrit 0 ;
//   · Messages : deux zones (Conversations · ♡ Favoris reçus) ; les favoris
//     sont des NOMBRES par annonce en vente, triés, « — » quand pas relevé, et
//     la phrase dit que Leboncoin ne dit pas QUI ;
//   · Republier : seules les annonces dont la recréation est sûre sont
//     proposées (ni sans paire, ni paire vendue) ; Annuler n'envoie RIEN ;
//     Confirmer envoie, dans CET ordre : supprimer (confirmé) → retirer la
//     marque « publiée » → publier la fiche (au prix baissé), puis attend la
//     confirmation de Leboncoin ; un refus de suppression ARRÊTE tout (rien
//     d'autre ne part) ;
//   · aucun débordement, aucune erreur.
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 6333;

const auj = new Date();
const ilYa = (j) => new Date(Date.now() - j * 864e5).toISOString();
const jour = (j) => ilYa(j).slice(0, 10);
const MON = '8442aaaa-0000-4000-8000-000000000001';
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: auj.toISOString() }];
const annonce = (id, titre, prix, ferme) => ({ id, title: titre, price: { amount: String(prix), currency_code: 'EUR' }, brand_title: titre.split(' ')[0], size_title: (/taille (\d+)/.exec(titre) || [])[1] || '', is_closed: !!ferme, is_hidden: false, is_draft: false, photo: { url: 'https://img.test/v' + id + '.jpg' }, status: 'Très bon état' });
const LISTINGS = { capturedAt: auj.toISOString(), payload: { items: [
  annonce(5001, 'Nike shox TL noir et bleu marine taille 40', 55, true),   // N°18, vendue
  annonce(5002, 'Nike air max 1 Treeline taille 42', 100),                // N°13, en ligne — republiable
  annonce(5004, 'Salomon XT-6 blanc taille 40', 99),                      // N°15, en ligne — pas sur Leboncoin
], pagination: { total_entries: 3 } } };
const txn = (tx, item) => ({ id: `harvest_111_txn_${tx}`, data: { capturedAt: auj.toISOString(), payload: { transaction: { id: tx, item_id: item, status: 450, status_title: 'Commande expédiée', status_updated_at: auj.toISOString() } } } });
const MAIN = {
  vinted_annonce_numeros: {
    '5001': { numero: '18', title: 'Nike shox TL noir et bleu marine taille 40', mp: { lbc: true } },
    '5002': { numero: '13', title: 'Nike air max 1 Treeline taille 42', mp: { lbc: true } },
    '5004': { numero: '15', title: 'Salomon XT-6 blanc taille 40', mp: { lbc: true } },
  },
};
const DETAILS = { '5002': { title: 'Nike air max 1 Treeline taille 42', brand: 'Nike', size: '42', description: 'Très bon état, portées deux fois.', photos: ['https://images1.vinted.net/t/01_5002a/f800/1.jpeg', 'https://images1.vinted.net/t/02_5002b/f800/2.jpeg'] } };
const ITEMS = {
  // N°13 : reliée par sa référence VRM, en ligne, chiffres relevés — REPUBLIABLE.
  '3290000002': { id: '3290000002', subject: 'Nike air max 1 Treeline T42', price: 100, ref: '13', account: MON, accountName: 'Totomondu', platform: 'leboncoin', status: 'active', seenAt: auj.toISOString(), publieeLe: ilYa(20), url: 'https://www.leboncoin.fr/ad/chaussures/3290000002', images: ['https://img.test/l2.jpg'], stats: { favoris: 4, vues: 120, messages: 2, jours: 7, du: jour(7), au: jour(1), at: auj.toISOString() } },
  // N°18 : la paire est vendue sur Vinted — jamais proposée à la republication.
  '3290000001': { id: '3290000001', subject: 'Nike shox TL noir et bleu marine taille 40', price: 55, ref: '18', account: MON, platform: 'leboncoin', status: 'active', seenAt: auj.toISOString(), images: [], stats: { favoris: 9, vues: 300, at: auj.toISOString() } },
  // Sans référence ni lien : pas reliée ⇒ pas republiable ; favoris jamais relevés ⇒ « — ».
  '3290000005': { id: '3290000005', subject: 'Adidas Spezial noir taille 38,5', price: 44, account: MON, platform: 'leboncoin', status: 'active', seenAt: auj.toISOString(), images: [] },
  // Vendue sur Leboncoin : ni « en vente », ni favoris, ni republiable.
  '3290000009': { id: '3290000009', subject: 'Asics gel kayano 14', price: 70, ref: '16', account: MON, platform: 'leboncoin', status: 'sold', seenAt: auj.toISOString(), images: [] },
};
const VENTES = {
  T1: { txId: 'T1', itemId: '3290000009', isSeller: true, title: 'Asics gel kayano 14', price: 7000, stepStatus: 'paid', stepLabel: 'Paiement effectué', dateVente: ilYa(2), at: ilYa(2) },
};
const rows = [
  { id: 'main', data: MAIN },
  { id: 'harvest_111_listings', data: LISTINGS },
  { id: 'vinted_item_details', data: DETAILS },
  txn(9001, 5001),
  { id: 'vinted_lbc_posted', data: { ids: ['5001', '5002'], updatedAt: ilYa(3) } },
  { id: 'lbc_listings', data: { items: ITEMS, lectures: { [MON]: { at: ilYa(0.01), total: 3, n: 3 } } } },
  { id: 'lbc_accounts', data: { accounts: { [MON]: { id: MON, name: 'Totomondu', type: 'particulier', sessionAt: auj.toISOString(), source: 'session:messagerie' } } } },
  { id: 'lbc_ventes', data: { ventes: VENTES } },
  { id: 'lbc_messages', data: { compteurs: { [MON]: { unread: 3, at: auj.toISOString() } }, comptes: { [MON]: { name: 'Totomondu', pro: false, at: auj.toISOString() } } } },
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
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : v;
  }
  return out;
};
// Le pont simulé : une extension à jour qui sait supprimer et publier ; la
// commande `lbcPublier` acceptée émet ensuite l'évènement « fait » (la page de
// confirmation de Leboncoin vue par l'extension).
const PONT = ({ suppr }) => {
  window.__cmds = [];
  const version = '5.240.0';
  const post = (m) => window.postMessage(m, '*');
  window.addEventListener('message', (e) => {
    const d = e.data; if (e.source !== window || !d || typeof d !== 'object') return;
    if (d.__vmr === 'ping') post({ __vmr: 'ready', version, id: 'ext-banc' });
    if (d.__vmr === 'etat') post({ __vmr: 'etat:result', reqId: d.reqId, resp: { ok: true, version, code: version, ext: 'ext-banc', vrm: { ok: true, connecte: true, email: '' }, vinted: null, cmds: {}, lbcPause: true, lbcSupprime: true } });
    if (d.__vmr === 'cmd') {
      const c = Object.fromEntries(Object.entries(d).filter(([k]) => !['__vmr', 'reqId'].includes(k)));
      window.__cmds.push(c);
      let resp;
      if (c.cmd === 'lbcSupprime') resp = suppr === 'refuse' ? { accepte: true, etape: 'refuse', statut: 403, reponse: '{"error":"forbidden"}' } : { accepte: true, etape: 'fait', statut: 200, reponse: '{}', note: true };
      else if (c.cmd === 'lbcMarque') resp = { accepte: true, etape: 'fait' };
      else if (c.cmd === 'lbcPublier') {
        resp = { accepte: true, jobId: 'lbc:' + c.id, etape: 'depot' };
        setTimeout(() => post({ __vmr: 'evt', evt: { type: 'cmd', jobId: 'lbc:' + c.id, etape: 'fait', at: Date.now() } }), 1200);
      } else resp = { accepte: false, code: 'inconnue', raison: 'commande inconnue' };
      setTimeout(() => post({ __vmr: 'cmd:result', reqId: d.reqId, resp }), 120);
    }
  });
  post({ __vmr: 'ready', version, id: 'ext-banc' });
};

async function ouvrir(b, vp, pont, url) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.addInitScript(PONT, pont);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: auj.toISOString(), cap: (r.data || {}).capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/${url}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(2500);
  return { ctx, pg, errs };
}
const cliquer = (pg, texte) => pg.evaluate((tx) => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === tx); if (b) b.click(); return !!b; }, texte);
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px · Leboncoin → Ventes`);
      const o1 = await ouvrir(b, vp, { suppr: 'fait' }, '?tab=plat_leboncoin');
      await o1.pg.click('[data-section="ventes"]').catch(() => {});
      await o1.pg.waitForSelector('[data-lbc-vente]', { timeout: 10000 }).catch(() => {});
      const v1 = await o1.pg.evaluate(() => { const e = document.querySelector('[data-lbc-vente="T1"]'); const t = e && e.querySelector('.vrm-ledger-sale-nom'); return { titre: t ? t.textContent : null }; });
      dit(v1.titre && /Asics gel kayano 14/.test(v1.titre) && !/N°/.test(v1.titre), 'le titre d’une vente Leboncoin n’a pas de « N° »', JSON.stringify(v1));
      await o1.pg.click('[data-lbc-vente="T1"] .vrm-ledger-sale-toggle').catch(() => {});
      await o1.pg.waitForTimeout(500);
      const fiche = await o1.pg.evaluate(() => [...document.querySelectorAll('.vrm-fiche-vente-acces button')].map((x) => x.textContent.trim()));
      dit(fiche.some((x) => /Fiche article N°16/.test(x)), '… le N° reste dans le tiroir (« Fiche article N°16 »)', JSON.stringify(fiche));
      dit(o1.errs.length === 0, 'aucune erreur d’app (ventes)', o1.errs.join(' | ').slice(0, 160));
      await o1.ctx.close();

      console.log(`── ${vp.width} px · Leboncoin → Messages`);
      const o2 = await ouvrir(b, vp, { suppr: 'fait' }, '?tab=plat_leboncoin');
      await o2.pg.click('[data-section="messages"]').catch(() => {});
      await o2.pg.waitForSelector('[data-messages-lbc-zone] [data-messages-lbc]', { timeout: 10000 }).catch(() => {});
      const z0 = await o2.pg.evaluate(() => ({ zone: (document.querySelector('[data-messages-lbc-zone]') || { getAttribute: () => null }).getAttribute('data-messages-lbc-zone'), boutons: [...document.querySelectorAll('.vrm-messages-sections button')].map((x) => x.textContent.trim()), conv: (document.querySelector('[data-messages-lbc]') || { getAttribute: () => null }).getAttribute('data-messages-lbc') }));
      dit(z0.zone === 'conversations' && z0.boutons.length === 2 && /Conversations/.test(z0.boutons[0]) && /Favoris reçus/.test(z0.boutons[1]), 'deux zones, comme Vinted : Conversations · Favoris reçus', JSON.stringify(z0));
      dit(z0.conv === '3', 'Conversations : le nombre de non-lus relevé', z0.conv);
      await o2.pg.click('[data-lbc-zone-favoris]').catch(() => {});
      await o2.pg.waitForSelector('[data-favoris-lbc]', { timeout: 10000 }).catch(() => {});
      await o2.pg.waitForTimeout(400);
      const f = await o2.pg.evaluate(() => { const e = document.querySelector('[data-favoris-lbc]'); return e ? { etat: e.getAttribute('data-favoris-lbc'), t: e.innerText, lignes: [...e.querySelectorAll('[data-favoris-lbc-annonce]')].map((x) => x.getAttribute('data-favoris-lbc-annonce') + ':' + x.getAttribute('data-favoris')) } : null; });
      dit(f && f.lignes.join() === '3290000001:9,3290000002:4,3290000005:passu', 'Favoris reçus : SES annonces EN VENTE sur Leboncoin, triées par favoris (pas celle vendue sur Leboncoin)', f && f.lignes.join());
      dit(f && /jamais qui/i.test(f.t) && /écrire à personne/.test(f.t), '… la phrase dit que Leboncoin ne donne pas QUI, et que VRM n’écrit à personne', f && f.t.slice(0, 160));
      dit(f && !/\b0 ♡/.test(f.t) && /—/.test(f.t), '… un nombre jamais relevé s’écrit « — », pas 0', f && f.t.replace(/\n/g, ' · ').slice(0, 200));
      const d2 = await deborde(o2.pg);
      dit(d2.sw <= d2.cw + 1, 'aucun débordement (messages)', `${d2.sw}/${d2.cw}`);
      dit(o2.errs.length === 0, 'aucune erreur d’app (messages)', o2.errs.join(' | ').slice(0, 160));
      await o2.ctx.close();

      console.log(`── ${vp.width} px · Leboncoin → Annonces · chiffres et Republier`);
      const o3 = await ouvrir(b, vp, { suppr: 'fait' }, '?tab=leboncoin');
      await o3.pg.waitForSelector('[data-repub-lbc-porte]', { timeout: 15000 }).catch(() => {});
      await o3.pg.waitForTimeout(500);
      const a = await o3.pg.evaluate(() => {
        const l = document.querySelector('[data-lbc-catalog-id="3290000002"]');
        return {
          chiffres: l && l.querySelector('[data-lbc-catalog-chiffres]') ? l.querySelector('[data-lbc-catalog-chiffres]').textContent : null,
          depuis: l && l.querySelector('[data-lbc-catalog-depuis]') ? l.querySelector('[data-lbc-catalog-depuis]').textContent : null,
          sansStats: (() => { const x = document.querySelector('[data-lbc-catalog-id="3290000005"]'); return x ? !x.querySelector('[data-lbc-catalog-chiffres]') : null; })(),
          porte: (document.querySelector('[data-repub-lbc-porte]') || { getAttribute: () => null }).getAttribute('data-repub-lbc-porte'),
        };
      });
      dit(a.chiffres && /4 favoris/.test(a.chiffres) && /120 vues/.test(a.chiffres), 'Mes annonces : les chiffres relevés (favoris, vues) sur l’annonce', a.chiffres);
      dit(a.depuis && /en ligne depuis le/.test(a.depuis), '… et depuis quand elle est en ligne', a.depuis);
      dit(a.sansStats === true, '… une annonce jamais relevée n’affiche AUCUN chiffre (jamais 0)', String(a.sansStats));
      dit(a.porte === '1', 'Republier : une seule annonce peut l’être (la N°13 ; ni la vendue sur Vinted, ni la non reliée)', a.porte);
      await o3.pg.click('[data-repub-lbc-ouvrir]').catch(() => {});
      await o3.pg.waitForSelector('[data-repub-lbc]', { timeout: 8000 }).catch(() => {});
      const c = await o3.pg.evaluate(() => ({ lignes: [...document.querySelectorAll('[data-repub-lbc-ligne]')].map((x) => x.getAttribute('data-repub-lbc-ligne') + ':' + x.getAttribute('data-num')), exclues: (document.querySelector('[data-repub-lbc-exclues]') || { getAttribute: () => null }).getAttribute('data-repub-lbc-exclues') }));
      dit(c.lignes.join() === '3290000002:13', '1. Choisir : la N°13 seule', c.lignes.join());
      dit(c.exclues === '2', '… les deux autres sont comptées « ne peuvent pas être republiées », avec leur raison', c.exclues);
      await o3.pg.click('[data-repub-lbc-ligne="3290000002"] input').catch(() => {});
      await o3.pg.click('[data-repub-lbc-suivant]').catch(() => {});
      await o3.pg.waitForTimeout(300);
      await cliquer(o3.pg, 'Baisser de … €');
      await o3.pg.fill('[data-repub-lbc-baisse]', '5').catch(() => {});
      await o3.pg.waitForTimeout(300);
      const np = await o3.pg.evaluate(() => (document.querySelector('[data-repub-lbc-apercu="3290000002"]') || { getAttribute: () => null }).getAttribute('data-prix-nouveau'));
      dit(np === '95', '2. Modifier : baisser de 5 € ⇒ 95 € (depuis le prix de l’annonce Leboncoin)', np);
      await o3.pg.click('[data-repub-lbc-suivant]').catch(() => {});
      await o3.pg.waitForTimeout(300);
      const bq = await o3.pg.evaluate(() => { const e = document.querySelector('[data-repub-lbc-bloque]'); const l = document.querySelector('[data-repub-lbc-lancer]'); return { bloque: e ? e.innerText : '', lancer: l ? !l.disabled : null }; });
      dit(!bq.bloque && bq.lancer === true, '3. Republier : rien ne bloque une extension à jour, le bouton est actif', JSON.stringify(bq));
      await o3.pg.click('[data-repub-lbc-lancer]').catch(() => {});
      await o3.pg.waitForTimeout(500);
      const conf = await o3.pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Oui, republier'); let t = ''; let n = b; for (let i = 0; i < 6 && n; i++) { n = n.parentElement; if (n && n.innerText && n.innerText.length > t.length && n.innerText.length < 1200) t = n.innerText; } return { ok: !!b, t }; });
      dit(conf.ok && /sans retour/.test(conf.t) && /SUPPRIME/.test(conf.t) && /favoris/.test(conf.t), '3. la confirmation dit qu’elle SUPPRIME, sans retour, favoris perdus', conf.t.replace(/\s+/g, ' ').slice(0, 200));
      await cliquer(o3.pg, 'Annuler');
      await o3.pg.waitForTimeout(500);
      const c0 = await o3.pg.evaluate(() => window.__cmds.filter((x) => /^lbc(Supprime|Marque|Publier)$/.test(x.cmd)));
      dit(c0.length === 0, 'Annuler n’envoie RIEN', JSON.stringify(c0));
      await o3.pg.click('[data-repub-lbc-lancer]').catch(() => {});
      await o3.pg.waitForTimeout(400);
      await cliquer(o3.pg, 'Oui, republier');
      await o3.pg.waitForSelector('[data-repub-lbc-etat="fait"]', { timeout: 15000 }).catch(() => {});
      const c1 = await o3.pg.evaluate(() => window.__cmds.filter((x) => /^lbc(Supprime|Marque|Publier)$/.test(x.cmd)));
      const ordre = c1.map((x) => x.cmd + ':' + x.id).join(' → ');
      dit(ordre === 'lbcSupprime:3290000002 → lbcMarque:5002 → lbcPublier:5002', 'Confirmer : supprimer → retirer la marque → publier, dans cet ordre', ordre);
      const sup = c1.find((x) => x.cmd === 'lbcSupprime'), mq = c1.find((x) => x.cmd === 'lbcMarque'), pub = c1.find((x) => x.cmd === 'lbcPublier');
      dit(sup && sup.confirme === true, '… la suppression part CONFIRMÉE', JSON.stringify(sup));
      dit(mq && mq.etat === 'unposted', '… la marque « publiée » est retirée (sinon la file la croit en ligne)', JSON.stringify(mq));
      dit(pub && pub.annonce && pub.annonce.price === '95' && /VRM-13/.test(pub.annonce.description || ''), '… la fiche part au nouveau prix, avec sa référence VRM', JSON.stringify(pub && pub.annonce && { price: pub.annonce.price, ref: /VRM-13/.test(pub.annonce.description || '') }));
      const fin = await o3.pg.evaluate(() => { const e = document.querySelector('[data-repub-lbc-id="3290000002"]'); return e ? { etat: e.getAttribute('data-repub-lbc-etat'), t: e.innerText } : null; });
      dit(fin && fin.etat === 'fait' && /republiée/.test(fin.t), '… et la ligne dit « republiée » seulement APRÈS la confirmation de Leboncoin', fin && fin.t);
      const d3 = await deborde(o3.pg);
      dit(d3.sw <= d3.cw + 1, 'aucun débordement (annonces)', `${d3.sw}/${d3.cw}`);
      dit(o3.errs.length === 0, 'aucune erreur d’app (annonces)', o3.errs.join(' | ').slice(0, 160));
      await o3.pg.screenshot({ path: path.join(require('os').tmpdir(), 'lbc-republier-' + vp.width + '.png'), fullPage: true }).catch(() => {});
      await o3.ctx.close();

      console.log(`── ${vp.width} px · Republier : Leboncoin refuse la suppression`);
      const o4 = await ouvrir(b, vp, { suppr: 'refuse' }, '?tab=leboncoin');
      await o4.pg.waitForSelector('[data-repub-lbc-ouvrir]', { timeout: 15000 }).catch(() => {});
      await o4.pg.click('[data-repub-lbc-ouvrir]').catch(() => {});
      await o4.pg.click('[data-repub-lbc-ligne="3290000002"] input').catch(() => {});
      await o4.pg.click('[data-repub-lbc-suivant]').catch(() => {});
      await o4.pg.waitForTimeout(300);
      await o4.pg.click('[data-repub-lbc-suivant]').catch(() => {});
      await o4.pg.waitForTimeout(300);
      await o4.pg.click('[data-repub-lbc-lancer]').catch(() => {});
      await o4.pg.waitForTimeout(400);
      await cliquer(o4.pg, 'Oui, republier');
      await o4.pg.waitForSelector('[data-repub-lbc-etat="refuse"]', { timeout: 10000 }).catch(() => {});
      await o4.pg.waitForTimeout(500);
      const c2 = await o4.pg.evaluate(() => window.__cmds.filter((x) => /^lbc(Supprime|Marque|Publier)$/.test(x.cmd)).map((x) => x.cmd));
      const e2 = await o4.pg.evaluate(() => { const e = document.querySelector('[data-repub-lbc-id="3290000002"]'); return e ? { etat: e.getAttribute('data-repub-lbc-etat'), t: e.innerText } : null; });
      dit(c2.join() === 'lbcSupprime', 'un refus de suppression ARRÊTE tout : ni marque retirée, ni publication', c2.join());
      dit(e2 && e2.etat === 'refuse' && /pas touchée/.test(e2.t) && /403/.test(e2.t), '… et la ligne dit « pas touchée », avec le statut de Leboncoin', e2 && e2.t);
      await o4.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ Leboncoin comme Vinted : ${ko} rouge(s)` : '\n✅ Leboncoin comme Vinted : tout est vert');
  process.exit(ko ? 1 : 0);
})();
