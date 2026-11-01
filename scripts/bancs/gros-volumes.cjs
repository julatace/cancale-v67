// ════════════════════════════════════════════════════════════════════════════
//  PLUS DE 1 000 LIGNES — AUCUNE DEMI-LISTE PRÉSENTÉE COMME COMPLÈTE (1er nov.)
//
//  Audit « conditions difficiles », points 4, 8 et « lireTout non strict »
//  (vérifiés au banc jetable `s2-volume` / `s1c-ecritures`) : Supabase coupe
//  une réponse à 1 000 lignes SANS LE DIRE. Un vendeur actif (3 000 ventes)
//  dépasse ce plafond en bordereaux, suivis, emails de vente, reçus d'achat :
//  les bordereaux les plus RÉCENTS tombaient — Colis passait de 5 « prêts » à
//  0, chaque carte « bordereau pas encore là », « Tout générer (5) ».
//
//  Base à ÉTAT et à la vraie forme (`_base-ecritures.cjs` : plafond silencieux,
//  `Range`, 416 à la frontière). Aucune `fx/` : un vendeur INVENTÉ.
//
//   V1  1 105 bordereaux email, les 5 plus récents à expédier ⇒ Colis : 5 prêts,
//       aucun « Tout générer ».
//   V2  AUCUNE lecture coupée : chaque lecture qui a reçu une page pleine de
//       1 000 lignes d'une famille qui en a plus a demandé la page suivante
//       (email_bord, email_sale, email_track, email_achat) — sur Colis, Ma
//       journée, Annonces, Achats.
//   V3  une page 2 ratée (500) ⇒ jamais « Tout générer » sur une demi-liste.
//   V4  widget : annonces illisibles (500) ⇒ jamais `online: 0` ; le nombre
//       déjà publié reste.
//
//  §6.1 : rouge sur le build d'avant (`BANC_DIST=<dist d'avant>`), vert après.
//  Lancer : BANC_PORT=9421 node scripts/bancs/gros-volumes.cjs  (`BANC_SEUL=V1,V4`)
// ════════════════════════════════════════════════════════════════════════════
require('./_meta.cjs');
const H = require('./_base-ecritures.cjs');
const fs = require('node:fs'), path = require('node:path');
const CAPT = process.env.BANC_CAPTURES || path.join(require('node:os').tmpdir(), 'vrm-bancs', 'gros-volumes');
fs.mkdirSync(CAPT, { recursive: true });
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const SEUL = (process.env.BANC_SEUL || '').split(',').filter(Boolean);
const joue = (x) => !SEUL.length || SEUL.includes(x);

const J = 864e5, maintenant = Date.now();
const iso = (ms) => new Date(maintenant - ms).toISOString();
const UID = '3150000000';
function fabriquer({ nVentes = 1300, nAnnonces = 60, nBord = 1105, nSale = 1200, nTrack = 1100, nAchat = 1050 } = {}) {
  const lignes = [], numeros = {};
  const items = [];
  for (let i = 0; i < nAnnonces; i++) { const id = 7000000000 + i; items.push({ id, title: 'Nike Air Max ' + i + ' taille 42', brand_title: 'Nike', size_title: '42', status: 'Très bon état', price: { amount: String(30 + i % 90) + '.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false, favourite_count: 0, view_count: 10, created_at_ts: iso(i * 3600e3), photo: { url: `https://images1.vinted.net/t/${id}/f800/p.jpeg` } }); numeros[id] = { numero: String(i + 1), numberedAt: iso(i * 3600e3), auto: false }; }
  lignes.push({ id: `harvest_${UID}_listings`, data: { capturedAt: iso(60e3), nItems: items.length, payload: { items, pagination: { total_entries: items.length } } } });
  lignes.push({ id: `harvest_${UID}_enligne`, data: { capturedAt: iso(60e3), complet: true, n: items.length, ids: items.map((x) => x.id), items: items.map((x) => ({ id: x.id, title: x.title })) } });
  lignes.push({ id: `harvest_${UID}_profile`, data: { capturedAt: iso(60e3), payload: { user: { id: Number(UID), login: 'gros_vendeur' } } } });
  const sold = [];
  // Les 5 ventes les PLUS RÉCENTES (n° de transaction les plus hauts) sont à expédier, avec leur bordereau.
  for (let i = 0; i < nVentes; i++) {
    const t = 22000000000 + (nVentes - i);
    const aExp = i < 5;
    const st = aExp ? 'Le paiement a été validé' : 'Commande finalisée';
    sold.push({ transaction_id: t, title: 'Adidas Samba ' + i + ' taille 41', price: { amount: String(40 + i % 60) + '.0', currency_code: 'EUR' }, status: st, date: iso(i * 0.1 * J), item_id: 8000000000 + i, transaction_user_status: aExp ? 'needs_action' : 'completed', photo: { url: 'https://images1.vinted.net/t/x/f800/v.jpeg' } });
    lignes.push({ id: `harvest_${UID}_txn_${t}`, data: { capturedAt: iso(i * 0.1 * J), payload: { transaction: { id: t, item_id: 8000000000 + i, status: aExp ? 300 : 450, status_title: st, status_updated_at: iso(i * 0.1 * J) } } } });
    if (i < nBord) lignes.push({ id: `email_bord_${t}`, data: { filename: `b-${t}.pdf`, transaction: String(t), receivedAt: iso(i * 0.1 * J), suivi: 'XW' + t, account: 'gros_vendeur', uid: UID, dateLimite: new Date(maintenant + 3 * J).toISOString(), pdfB64: 'JVBERi0xxxx' } });
  }
  lignes.push({ id: `harvest_${UID}_orders_sold`, data: { capturedAt: iso(60e3), nItems: sold.length, payload: { my_orders: sold } } });
  lignes.push({ id: `harvest_${UID}_orders_purchased`, data: { capturedAt: iso(60e3), nItems: 0, payload: { my_orders: [] } } });
  for (let i = 0; i < nSale; i++) lignes.push({ id: `email_sale_${(i * 2654435761 >>> 0).toString(16).padStart(8, '0')}`, data: { type: 'vente', designation: 'Adidas Samba ' + i, prix: 40, account: 'gros_vendeur', uid: UID, receivedAt: iso(i * 0.1 * J) } });
  for (let i = 0; i < nTrack; i++) lignes.push({ id: `email_track_mondialrelay_${String(100000 + i)}`, data: { carrier: 'mondialrelay', tracking: String(100000 + i), status: 'livre', receivedAt: iso((i + 30) * J) } });
  for (let i = 0; i < nAchat; i++) lignes.push({ id: `email_achat_${String(500000 + i)}`, data: { subject: 'Ton reçu', article: 'Achat ' + i, prix: '20', transaction: String(30000000000 + i), account: 'gros_vendeur', uid: UID, receivedAt: iso((i + 30) * J), type: 'recu' } });
  lignes.push({ id: 'widget_stats', data: { online: 24, onlineAt: '2026-10-31', caMois: 0, ventesMois: 0 } });
  lignes.push({ id: 'main', data: { vinted_annonce_numeros: numeros, vinted_used_numeros: Object.values(numeros).map((x) => x.numero), vrm_bienvenue_vue: { at: 'banc' }, vrm_widget_token: 'jeton-banc' } });
  return H.creerBase({ accounts: [{ id: 1000, vinted_user_id: UID, login: 'gros_vendeur', domain: 'www.vinted.fr', updated_at: iso(3600e3), created_at: iso(60 * J) }], lignes });
}
const familleDe = (u) => { const m = /id=like\.([a-z]+_[a-z]+)_\*/.exec(u); return m ? m[1] : null; };
// Les lectures COUPÉES : une page pleine (1 000) d'une famille qui en a plus, sans la page suivante.
const lecturesCoupees = (base, familles) => {
  const totaux = {}; for (const f of familles) totaux[f] = [...base.lignes.keys()].filter((id) => id.startsWith(f + '_')).length;
  const out = [];
  base.lectures.forEach((l, i) => {
    const f = familleDe(l.url); if (!f || !familles.includes(f) || totaux[f] <= 1000) return;
    const from = Number((/^(\d+)-/.exec(l.range || '') || [0, 0])[1]);
    if (l.n < 1000 || from + l.n >= totaux[f]) return;
    const suite = base.lectures.slice(i + 1).some((m) => m.url === l.url && Number((/^(\d+)-/.exec(m.range || '') || [0, -1])[1]) === from + 1000);
    if (!suite) out.push(f + (l.range ? ` [${l.range}]` : ' [sans Range]'));
  });
  return out;
};
const colonnes = (pg) => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-cc-colonne]')].map((e) => [e.getAttribute('data-cc-colonne'), Number(e.getAttribute('data-cc-n'))])));

(async () => {
  const srv = await H.serveur(process.env.BANC_PORT || process.env.PORT || 0);
  const nav = await H.lancer();
  const errs = [];
  // ── V1 + V2 ────────────────────────────────────────────────────────────────
  if (joue('V1') || joue('V2')) {
    const base = fabriquer();
    const A = await H.appareil(nav, base, { nom: 'A', vp: { width: 1512, height: 900 } });
    const { pg, errs: e } = await A.ouvrir('A'); errs.push(e);
    await pg.goto(srv.url + '/?tab=cat_bord', { waitUntil: 'domcontentloaded' });
    await H.attendre(async () => { const c = await colonnes(pg); return Object.keys(c).length > 0 && (c.prets || 0) + (c.attente || 0) >= 5; }, 25000);
    await pg.waitForTimeout(3000);
    const c = await colonnes(pg);
    const txt = await pg.evaluate(() => document.body.innerText || '');
    await pg.screenshot({ path: path.join(CAPT, 'V1-colis.png') });
    if (joue('V1')) {
      dit(c.prets === 5, 'V1 : 1 105 bordereaux, les 5 ventes à expédier sont « prêtes »', JSON.stringify(c));
      dit(!/Tout générer/.test(txt), 'V1 : aucun « Tout générer » pour des bordereaux déjà là', (txt.match(/Tout générer[^\n]*/) || [''])[0]);
    }
    if (joue('V2')) {
      for (const t of ['journee', 'cat_annonces', 'cat_achats']) { await pg.goto(srv.url + '/?tab=' + t, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(9000); }
      const coupees = lecturesCoupees(base, ['email_bord', 'email_sale', 'email_track', 'email_achat']);
      const vues = ['email_bord', 'email_sale', 'email_track', 'email_achat'].filter((f) => base.lectures.some((l) => familleDe(l.url) === f));
      dit(vues.length >= 3, 'V2 : les familles de plus de 1 000 lignes sont bien lues par ces écrans', vues.join(', '));
      dit(coupees.length === 0, 'V2 : aucune lecture coupée à 1 000 lignes', [...new Set(coupees)].join(' · '));
    }
    await A.fermer();
  }
  // ── V3 (page 2 ratée) ─────────────────────────────────────────────────────
  if (joue('V3')) {
    const base = fabriquer();
    const A = await H.appareil(nav, base, { nom: 'A', vp: { width: 1512, height: 900 }, faute: (u, m, q) => (m === 'GET' && /email_bord_/.test(u) && /^1000-/.test((q.headers()['range'] || '')) ? { status: 500 } : null) });
    const { pg, errs: e } = await A.ouvrir('A'); errs.push(e);
    await pg.goto(srv.url + '/?tab=cat_bord', { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(14000);
    const txt = await pg.evaluate(() => document.body.innerText || '');
    const c = await colonnes(pg);
    await pg.screenshot({ path: path.join(CAPT, 'V3-colis-page2-ratee.png') });
    dit(!/Tout générer/.test(txt), 'V3 : page 2 en panne ⇒ jamais « Tout générer » sur une demi-liste', JSON.stringify(c));
    await A.fermer();
  }
  // ── V4 (widget) ───────────────────────────────────────────────────────────
  if (joue('V4')) {
    const base = fabriquer({ nVentes: 40, nBord: 10, nSale: 10, nTrack: 10, nAchat: 10 });
    const A = await H.appareil(nav, base, { nom: 'A', vp: { width: 390, height: 844 }, faute: (u, m) => (m === 'GET' && /_listings|_enligne/.test(u) ? { status: 500 } : null) });
    const { pg, errs: e } = await A.ouvrir('A'); errs.push(e);
    const t0 = Date.now();
    for (const t of ['journee', 'cat_annonces', 'journee']) { await pg.goto(srv.url + '/?tab=' + t, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(7000); }
    const w = base.ecritures.filter((x) => x.at >= t0 && [].concat(x.corps || []).some((r) => r && r.id === 'widget_stats'));
    const zeros = w.filter((x) => [].concat(x.corps).some((r) => r && r.id === 'widget_stats' && r.data && r.data.online === 0));
    dit(zeros.length === 0, 'V4 : annonces illisibles ⇒ le widget ne publie jamais « 0 en ligne »', w.map((x) => JSON.stringify([].concat(x.corps).find((r) => r.id === 'widget_stats').data.online)).join(', ') || 'aucune écriture');
    const fin = (base.lignes.get('widget_stats') || {}).data || {};
    dit(fin.online === 24, 'V4 : le nombre déjà publié (24) reste', JSON.stringify({ online: fin.online, raison: fin.onlineRaison }));
    await A.fermer();
    // Et l'autre sens : lues ⇒ le vrai nombre part (sans quoi « ne jamais écrire » passerait).
    const base2 = fabriquer({ nVentes: 40, nBord: 10, nSale: 10, nTrack: 10, nAchat: 10 });
    const B = await H.appareil(nav, base2, { nom: 'B', vp: { width: 390, height: 844 } });
    const o = await B.ouvrir('B'); errs.push(o.errs);
    for (const t of ['journee', 'cat_annonces', 'journee']) { await o.pg.goto(srv.url + '/?tab=' + t, { waitUntil: 'domcontentloaded' }); await o.pg.waitForTimeout(7000); }
    const fin2 = (base2.lignes.get('widget_stats') || {}).data || {};
    dit(fin2.online === 60, 'V4 : annonces lues ⇒ le widget publie le vrai nombre (60)', JSON.stringify(fin2.online));
    await B.fermer();
  }
  const jsErr = errs.flat().filter((m) => !/ResizeObserver|Failed to fetch|NetworkError/.test(m));
  dit(jsErr.length === 0, 'aucune erreur JS', jsErr.slice(0, 3).join(' | '));
  console.log(`\n${ok} OK, ${ko} KO`);
  await nav.close(); srv.fermer();
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
