// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE MODE STREAM NE LAISSE RIEN PASSER (15 octobre)
//        (node scripts/bancs/mode-stream.cjs — après `npm run build`)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « mets un mode stream pour les influenceurs, il faut cacher leurs
// données sensibles comme leur CA ou leur nom de compte ». Le masquage est UN
// mécanisme pour tout le document (`src/modeStream.js`) : ce banc ne vérifie
// donc pas un écran, il les PARCOURT tous, avec des données INVENTÉES et
// reconnaissables (aucune donnée réelle : il vit dans le dépôt, qui est public),
// et exige qu'aucune ne s'affiche :
//   • ni dans le texte rendu (`innerText`, donc aussi un montant coupé en deux
//     nœuds « 45 » + « € ») ;
//   • ni dans une infobulle, un libellé lu à voix haute, un texte indicatif ;
//   • ni dans un champ de saisie qui n'est pas flouté ;
//   • ni aucun montant (« chiffre € » ou « € chiffre »), où qu'il soit ;
// aux deux tailles (390 px tactile, 1512 px), sur les écrans joignables, la
// recherche globale, la cloche, la fiche d'un fil de messages et le tiroir
// d'un compte.
//
// ⚠️ L'AUTRE SENS, sans quoi « tout effacer » passerait le banc :
//   • mode coupé, le banc VOIT ces mêmes données (il sait donc les trouver) ;
//   • mode allumé, ce qu'un streamer MONTRE reste lisible : le titre d'une
//     annonce, son N° de rangement, et l'ALIAS du compte (« Compte 1 ») — sur
//     neuf comptes il doit savoir sur lequel agir (CLAUDE.md §5).
// Et les chemins de l'état :
//   • l'interrupteur de Réglages allume, la pastille de l'en-tête coupe (après
//     confirmation) — le texte réel revient sans recharger ;
//   • le réglage part au nuage (`vrm_mode_stream`), et un appareil NEUF dont seul
//     le nuage dit « allumé » se masque ;
//   • ⚠️ un nuage PÉRIMÉ (« coupé » plus ancien que le « allumé » de l'appareil)
//     ne réaffiche rien : c'est le cas d'une écriture ratée pendant le live ;
//   • ouvrir un document dans un nouvel onglet (bordereau, facture) DEMANDE
//     avant, et ne s'ouvre pas si on refuse.
// Relecture du 15 octobre, sur ses vraies données — quatre trous, tous servis :
//   • le PREMIER montant d'une fourchette (« de 120,37 à 141,59 € ») ;
//   • un code de casier de QUATRE chiffres (deux, comme chez lui) ;
//   • les noms de ses comptes LEBONCOIN (Leboncoin → Messages) ;
//   • « pas su » : le nuage dit « allumé » mais il est lent, ou illisible.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 5941);
const CAPTURES = process.env.BANC_CAPTURES || path.join(os.tmpdir(), 'mode-stream');
try { fs.mkdirSync(CAPTURES, { recursive: true }); } catch (_) {}

const MAINTENANT = Date.now();
const iso = (h) => new Date(MAINTENANT - h * 3600e3).toISOString();
const dansJ = (j) => { const d = new Date(MAINTENANT + j * 86400000); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };

// ── LES DONNÉES SENSIBLES INVENTÉES (et reconnaissables) ─────────────────────
const S = {
  login1: 'zorglub_vend42', login2: 'pimpante_boutik', label1: 'Boutique Zorglub',
  email1: 'zorglub.secret@exemple.test', tel2: '06 12 34 56 78',
  prenom: 'Bérénice', ville: 'Plouzané', societe: 'Zorglub SARL', siret: '123 456 789 00012',
  rue: '17 rue des Glycines',
  acheteur: 'acheteur_mystere', vendeuse: 'vendeuse_cachee', curieux: 'curieux_77', negociateur: 'negociateur_secret',
  message: 'Le digicode secret est 4521B', code: 'C98765', relais: 'Tabac des Lilas',
  client: 'Marcel Pagnolux', clientEmail: 'marcel.p@exemple.test', clientRue: '3 impasse des Mouettes',
  reception: 'reception.zorglub@exemple.test', ebay: 'ebay_tresor_secret', acheteurEbay: 'acheteur_ebay_secret',
  uid1: '730001', uid2: '730002',
  // Un casier Chronopost : DEUX codes de quatre chiffres (la forme mesurée chez
  // lui) — trop courts pour être cherchés partout, ils doivent partir là où ils
  // se lisent comme des codes.
  codeCourt: '4821', codeCourt2: '7364',
  lbcNom1: 'Hortense Lbcmartin', lbcNom2: 'Gaspard Lbcboutique',
};
// Les valeurs cherchées (minuscules, espaces insécables ramenées) : chacune
// sous ses formes d'affichage.
const CHERCHES = [
  ...Object.values(S),
  '0612345678', '+33 6 12 34 56 78', '487,13', '487.13', '312,77', '312.77', '64,21', '401,99', '99,31', '31,50', '29280', 'mouettes', 'glycines',
  // Le PREMIER montant d'une fourchette (« de 120,37 à 141,59 € », Le prix qui marche).
  '120,37', '120.37', '141,59', '141.59',
];
// Ce qui DOIT rester lisible : un titre d'annonce et son N° de rangement.
const TITRE_ANNONCE = 'Zephyr Runner taille 42';
const NUM = '17';

const ACCS = [
  { id: 1, vinted_user_id: S.uid1, login: S.login1, domain: 'www.vinted.fr', updated_at: iso(0), refresh_token: 'r1' },
  { id: 2, vinted_user_id: S.uid2, login: S.login2, domain: 'www.vinted.fr', updated_at: iso(0), refresh_token: 'r2' },
];
const LISTING = { id: 5550001, title: TITRE_ANNONCE, price: { amount: '487.13', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false,
  brand_title: 'Zephyr', size_title: '42', status: 'Très bon état', favourite_count: 3, view_count: 40, nPhotos: 5, created_at_ts: Math.floor((MAINTENANT - 5 * 86400e3) / 1000), photo: null };
const VENTES1 = [
  { transaction_id: 9901, title: 'Quasar Runner taille 41', price: { amount: '312.77', currency_code: 'EUR' }, status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: iso(30), user_login: S.acheteur },
  { transaction_id: 9902, title: 'Pulsar Runner taille 40', price: { amount: '99.31', currency_code: 'EUR' }, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: iso(2), user_login: S.acheteur },
  // Deux ventes du MÊME modèle et de la même taille : « Le prix qui marche » en
  // tire une fourchette « de 120,37 à 141,59 € ».
  { transaction_id: 9903, title: 'Adidas Samba noire taille 41', price: { amount: '120.37', currency_code: 'EUR' }, status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: iso(80), user_login: S.acheteur },
  { transaction_id: 9904, title: 'Adidas Samba noire taille 41', price: { amount: '141.59', currency_code: 'EUR' }, status: "Commande finalisée - l'acheteur a validé la commande", transaction_user_status: 'completed', date: iso(60), user_login: S.acheteur },
];
const ACHATS2 = [
  { transaction_id: 7701, title: 'Nebula Relay taille 40', price: { amount: '64.21', currency_code: 'EUR' }, conversation_id: 802,
    status: "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais", transaction_user_status: 'needs_action', date: iso(20), seller: S.vendeuse },
];
const mainRow = (extra = {}) => ({ id: 'main', data: {
  vinted_account_labels: { [S.uid1]: S.label1 }, vinted_account_emails: { [S.uid1]: S.email1 }, vinted_account_phones: { [S.uid2]: S.tel2 },
  vrm_prenom: S.prenom, vrm_ville: S.ville,
  vinted_entreprises: [{ id: 'ent_1', companyName: S.societe, companyType: 'EI', companyAddress: `${S.rue} 29280 ${S.ville}`, siret: S.siret, footer: '' }],
  vinted_entreprise_active: 'ent_1',
  vinted_annonce_numeros: { 5550001: { numero: NUM, title: TITRE_ANNONCE, buyPrice: '31,50', numberedAt: iso(24 * 5) } },
  vinted_used_numeros: [17],
  ...extra,
} });
const rowsDe = (extraMain) => [
  mainRow(extraMain),
  { id: `harvest_${S.uid1}_profile`, data: { capturedAt: iso(0), uid: S.uid1, payload: { user: { id: Number(S.uid1), login: S.login1, email: S.email1 } } } },
  { id: `harvest_${S.uid1}_listings`, data: { capturedAt: iso(0), nItems: 1, payload: { items: [LISTING] } } },
  { id: `harvest_${S.uid1}_orders_sold`, data: { capturedAt: iso(0), payload: { my_orders: VENTES1 } } },
  { id: `harvest_${S.uid2}_orders_purchased`, data: { capturedAt: iso(0), payload: { my_orders: ACHATS2 } } },
  { id: `harvest_${S.uid2}_listings`, data: { capturedAt: iso(0), nItems: 0, payload: { items: [] } } },
  { id: `harvest_${S.uid1}_billing`, data: { capturedAt: iso(0), payload: { user_balance: { available_amount: { amount: '231.47' }, escrow_amount: { amount: '118.09' } } } } },
  { id: `harvest_${S.uid1}_inbox`, data: { capturedAt: iso(0), payload: { conversations: [
    { id: 801, unread: true, updated_at: iso(1), description: S.message, opposite_user: { id: 6001, login: S.curieux } },
  ] } } },
  { id: `harvest_${S.uid1}_conv_801`, data: { capturedAt: iso(0), payload: { conversation: { id: 801, opposite_user: { id: 6001, login: S.curieux }, description: TITRE_ANNONCE,
    messages: [{ entity_type: 'message', entity: { user_id: 6001, body: S.message } }] } } } },
  { id: 'panel_colis_relais', data: { 7701: { code: S.code, lieu: `${S.relais}, 8 avenue Foch 29200 Brest`, at: iso(3) } } },
  { id: 'email_track_mondial_relay_MRZ9988776655', data: { status: 'available', statusLabel: 'Arrivé au point de retrait', code: S.code,
    lieu: `${S.relais}, 8 avenue Foch 29200 Brest`, carrier: 'mondial_relay', suivi: 'MRZ9988776655', receivedAt: iso(3), dateLimite: dansJ(6) } },
  { id: 'email_track_chronopost_XW000111222SP', data: { status: 'available', statusLabel: 'Arrivé au point de retrait', code: S.codeCourt, code2: S.codeCourt2, consigne: true,
    lieu: 'Consigne Pickup Gare, 1 place de la Gare 29200 Brest', carrier: 'chronopost', suivi: 'XW000111222SP', receivedAt: iso(4), dateLimite: dansJ(5) } },
  { id: 'lbc_messages', data: { compteurs: { lbc1: { unread: 3, at: iso(0) } }, comptes: { lbc1: { name: S.lbcNom1, pro: false, at: iso(0) }, lbc2: { name: S.lbcNom2, pro: true, at: iso(0) } } } },
  { id: 'lbc_accounts', data: { accounts: { lbc1: { id: 'lbc1', name: S.lbcNom1, seenAt: iso(1) }, lbc2: { id: 'lbc2', name: S.lbcNom2, seenAt: iso(2) } } } },
  { id: 'email_offer_os1', data: { type: 'offre', receivedAt: iso(2), article: TITRE_ANNONCE, montant: '401,99', qui: S.negociateur, uid: S.uid1, account: S.login1 } },
  { id: 'email_invoice_f1', data: { type: 'facture_pro', status: 'draft', number: 'F-2026-0007', designation: 'Quasar Runner', prix: 312.77,
    buyerName: S.client, buyerEmail: S.clientEmail, buyerAddress: `${S.clientRue} 29200 Brest`, createdAt: iso(20), account: S.login1 } },
  { id: 'email_bord_os1', data: { transaction: '9902', filename: 'bordereau-pulsar.pdf', article: 'Pulsar Runner taille 40', receivedAt: iso(1), dateLimite: dansJ(5) } },
  { id: 'vrm_email_owners', data: { adresses: { [S.reception]: { owner: '', label: '', at: iso(48) } }, updatedAt: iso(48) } },
  { id: 'ebay_comptes', data: { comptes: [{ cle: '', pseudo: S.ebay, principal: true }] } },
  { id: 'ebay_orders', data: { capturedAt: iso(0), orders: [{ orderId: '12-34567-89012', creationDate: iso(10), orderFulfillmentStatus: 'NOT_STARTED', orderPaymentStatus: 'PAID',
    buyer: { username: S.acheteurEbay }, pricingSummary: { total: { value: '99.31', currency: 'EUR' } },
    lineItems: [{ title: 'Orion Runner taille 43', sku: 'VRM-17', legacyItemId: '1234567890' }] }] } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 160)); } };

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

async function preparer(b, vp, { local = null, extraMain = {}, sombre = false, retardMain = 0, mainKO = false } = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  const ecrits = [];
  await pg.addInitScript((local) => {
    try { localStorage.setItem('vrm_acces_direct', '1'); if (local) localStorage.setItem('vrm_mode_stream', JSON.stringify(local)); } catch (_) {}
  }, local);
  if (sombre) await pg.addInitScript(() => { try { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_bascule_mineral_v1', '1'); } catch (_) {} });
  const lignes = rowsDe(sombre ? { vinted_dark: true, ...extraMain } : extraMain);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', async (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    // Le nuage (ligne `main`) lent, ou illisible (522) — la base debout par ailleurs.
    if (req.method() === 'GET' && /id=eq\.main/.test(u)) {
      if (mainKO) return route.fulfill({ status: 522, contentType: 'text/html', body: '<!DOCTYPE html><title>522</title>' });
      if (retardMain) await new Promise((r) => setTimeout(r, retardMain));
    }
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') { try { ecrits.push(req.postData() || ''); } catch (_) {} return j([]); }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data,updated_at/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: iso(0), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(lignes.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(',').map((x) => x.replace(/"/g, '')); return j(lignes.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(lignes.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs, ecrits };
}

// Tout ce qui s'AFFICHE : texte rendu, attributs lus, valeurs de champs non
// floutés. (Les attributs d'un élément caché comptent aussi : une infobulle
// s'affiche au survol.)
const lireAffiche = (pg) => pg.evaluate(() => {
  const morceaux = [document.body.innerText];
  for (const el of document.querySelectorAll('[title],[aria-label],[placeholder],[alt]')) {
    for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v) morceaux.push(`[${a}] ${v}`); }
  }
  for (const el of document.querySelectorAll('input,textarea')) {
    const t = (el.getAttribute('type') || '').toLowerCase();
    if (/^(checkbox|radio|hidden|file|range|color)$/.test(t)) continue;
    if (el.value && !el.hasAttribute('data-stream-flou')) morceaux.push(`[valeur] ${el.value}`);
  }
  return morceaux.join('\n');
});
const norm = (t) => String(t).replace(/[\u00a0\u202f]/g, ' ').toLowerCase();
// Sur UNE ligne : « ••• €⏎1 jour où tu as vendu » n'est pas un montant (deux
// blocs l'un sous l'autre), « 45 € » l'est, même coupé en deux nœuds.
const RE_MONTANT = /\d[\d \u00a0\u202f.,]*[ \u00a0\u202f]*(?:€|eur\b)|€[ \u00a0\u202f]*[+\-−]?\d/i;
function fuites(texte) {
  const t = norm(texte);
  const out = CHERCHES.filter((c) => t.includes(norm(c)));
  const m = RE_MONTANT.exec(String(texte).replace(/[\u00a0\u202f]/g, ' '));
  if (m) out.push('montant « ' + String(texte).slice(Math.max(0, m.index - 30), m.index + 20).replace(/\s+/g, ' ') + ' »');
  return out;
}

async function sain(pg, ecran) {
  const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, t: document.body.innerText }));
  dit(r.sw <= r.cw + 1, `${ecran} : aucun débordement horizontal`, `${r.sw} > ${r.cw}`);
  const m = /n'a pas pu s'afficher|n’a pas pu s’afficher|Cannot access|is not defined/.exec(r.t);
  dit(!m, `${ecran} : l'écran n'est pas tombé sur le garde-fou`, m && m[0]);
}

const ECRANS = ['journee', 'dashboard', 'plat_vinted', 'cat_ventes', 'cat_achats', 'cat_annonces', 'cat_msg', 'cat_bord', 'plat_leboncoin', 'plat_ebay', 'plat_vestiaire',
  'collectif', 'prixmarche', 'invoices', 'garage', 'settings', 'vintedaccounts', 'leboncoin', 'catalog', 'sales', 'stockvinted'];
const ALLUME = { on: true, at: MAINTENANT };

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });

    // ── 0. L'AUTRE SENS : mode coupé, le banc VOIT ces données ─────────────
    await essaie('mode coupé', async () => {
      const { ctx, pg } = await preparer(b, { width: 1512, height: 950 });
      const vus = new Set();
      for (const t of ['vintedaccounts', 'cat_ventes', 'settings', 'invoices']) {
        await pg.goto(`http://localhost:${PORT}/?tab=${t}`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3200);
        for (const f of fuites(await lireAffiche(pg))) vus.add(f.startsWith('montant') ? 'montant' : f);
      }
      dit(vus.has(S.login1) && vus.has(S.label1) && vus.has('montant'), 'mode COUPÉ : le banc voit bien les comptes, leurs noms et les montants (il sait les trouver)', [...vus].join(' · '));
      await ctx.close();
    });

    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '390 px' : '1512 px';
      console.log(`── mode stream ALLUMÉ · ${T}`);
      const { ctx, pg, errs } = await preparer(b, vp, { local: ALLUME });
      const fuitesParEcran = {};
      for (const t of ECRANS) {
        await essaie(`${T} · ${t}`, async () => {
          await pg.goto(`http://localhost:${PORT}/?tab=${t}`, { waitUntil: 'domcontentloaded' });
          await pg.waitForTimeout(3200);
          const f = fuites(await lireAffiche(pg));
          if (f.length) fuitesParEcran[t] = f;
          if (t === 'cat_annonces' || t === 'vintedaccounts' || t === 'cat_msg' || t === 'settings') await pg.screenshot({ path: path.join(CAPTURES, `stream-${t}-${vp.width}.png`), fullPage: true }).catch(() => {});
          if (['cat_annonces', 'cat_ventes', 'vintedaccounts', 'settings', 'cat_msg'].includes(t)) await sain(pg, `${T} · ${t}`);
        });
      }
      const ecransFuyants = Object.keys(fuitesParEcran);
      dit(ecransFuyants.length === 0, `${T} : aucun écran ne laisse passer une donnée sensible (${ECRANS.length} écrans)`,
        ecransFuyants.map((t) => `${t}: ${fuitesParEcran[t].slice(0, 4).join(', ')}`).join(' | '));

      // Ce qu'un streamer MONTRE reste lisible.
      await essaie(`${T} · ce qui reste lisible`, async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_annonces`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3500);
        const txt = await pg.evaluate(() => document.body.innerText);
        dit(txt.includes(TITRE_ANNONCE), `${T} : le titre de l'annonce reste lisible`, txt.slice(0, 80));
        dit(new RegExp(`(?:N°|#)\\s?${NUM}\\b`).test(txt), `${T} : son N° de rangement reste lisible`);
        await pg.goto(`http://localhost:${PORT}/?tab=vintedaccounts`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3200);
        const t2 = await pg.evaluate(() => document.body.innerText);
        dit(/Compte 1/.test(t2) && /Compte 2/.test(t2), `${T} : chaque compte garde un alias STABLE et distinct (« Compte 1 », « Compte 2 »)`, t2.slice(0, 120));
        const pastille = await pg.$('[data-pastille-stream]');
        dit(!!pastille, `${T} : la pastille « Stream » est dans l'en-tête`);
      });

      // La recherche globale et ses résultats.
      await essaie(`${T} · recherche`, async () => {
        await pg.click('[aria-label="Rechercher une paire"]', { timeout: 5000 });
        await pg.waitForTimeout(500);
        await pg.keyboard.type('Runner');
        await pg.waitForTimeout(2500);
        const f = fuites(await lireAffiche(pg));
        dit(f.length === 0, `${T} : la recherche globale ne laisse rien passer`, f.join(', '));
        await pg.click('[aria-label="Fermer la recherche"]').catch(() => {});
      });
      // La cloche.
      await essaie(`${T} · cloche`, async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3500);
        const btn = await pg.$('[aria-label="Notifications"]');
        if (btn) { await btn.click(); await pg.waitForTimeout(700); }
        const f = fuites(await lireAffiche(pg));
        dit(f.length === 0, `${T} : la cloche ne laisse rien passer`, f.join(', '));
      });
      // Le fil d'une conversation.
      await essaie(`${T} · fil de messages`, async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=cat_msg`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(3500);
        if (await pg.$('#vrm-sel-compte')) { await pg.selectOption('#vrm-sel-compte', '*').catch(() => {}); await pg.waitForTimeout(400); }
        const conv = await pg.$('[data-conv="801"]');
        dit(!!conv, `${T} : la conversation inventée est listée (le banc ouvre bien un fil)`);
        if (conv) { await conv.click(); await pg.waitForTimeout(1500); }
        const f = fuites(await lireAffiche(pg));
        dit(f.length === 0, `${T} : le fil ouvert ne laisse rien passer`, f.join(', '));
        await pg.screenshot({ path: path.join(CAPTURES, `stream-fil-${vp.width}.png`) }).catch(() => {});
      });
      // Leboncoin → Messages : les noms de SES comptes Leboncoin (relecture du
      // 15 octobre : ils n'étaient pas dans le dictionnaire).
      await essaie(`${T} · messages Leboncoin`, async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=plat_leboncoin`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(2500);
        await pg.click('[data-section="messages"]', { timeout: 5000 });
        await pg.waitForSelector('[data-messages-lbc]', { timeout: 8000 }).catch(() => {});
        await pg.waitForTimeout(500);
        const t = await pg.evaluate(() => { const e = document.querySelector('[data-messages-lbc]'); return e ? e.innerText : ''; });
        const f = fuites(await lireAffiche(pg));
        dit(!!t && f.length === 0, `${T} : Leboncoin → Messages ne laisse passer aucun nom de compte`, f.join(', ') || t.slice(0, 80));
        dit(/Compte Leboncoin 1/.test(t) && /Compte Leboncoin 2/.test(t), `${T} : chaque compte Leboncoin garde un alias distinct (il sait sur lequel répondre)`, t.replace(/\n/g, ' · ').slice(0, 140));
      });
      dit(errs.length === 0, `${T} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
      await ctx.close();
    }

    // ── « PAS SU » NE VAUT PAS « COUPÉ » (relecture du 15 octobre) ─────────
    // Le mode est allumé AILLEURS (le nuage le dit), mais cet appareil ne le
    // sait pas encore : il était resté sur « coupé » il y a une heure, ou il
    // est neuf, et la ligne `main` est lente — ou ne répond pas du tout.
    // Avant : ses logins et ses montants s'affichaient jusqu'à l'arrivée du
    // nuage (9 s), et pour toujours sur un 522. Et l'autre sens : un nuage qui
    // dit « coupé » démasque ; « Afficher ici » démasque sans rien écrire au nuage.
    const COUPE_IL_Y_A_1H = { on: false, at: MAINTENANT - 3600e3 };
    const NUAGE_ALLUME = { vrm_mode_stream: { on: true, at: MAINTENANT } };
    const sonder = async (pg, ms, t0) => { await pg.waitForTimeout(Math.max(0, ms - (Date.now() - t0))); return { st: await pg.evaluate(() => document.documentElement.hasAttribute('data-mode-stream')), f: fuites(await lireAffiche(pg)) }; };
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '390 px' : '1512 px';
      await essaie(`${T} · nuage lent`, async () => {
        for (const [nom, local] of [['appareil resté sur « coupé » il y a 1 h', COUPE_IL_Y_A_1H], ['appareil neuf', null]]) {
          const { ctx, pg } = await preparer(b, vp, { local, extraMain: NUAGE_ALLUME, retardMain: 6000 });
          await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
          const t0 = Date.now(); const obs = [];
          for (const ms of [1500, 4000, 9000]) obs.push([ms, await sonder(pg, ms, t0)]);
          const fuyants = obs.filter(([, o]) => o.f.length || !o.st);
          dit(fuyants.length === 0, `${T} · ${nom}, nuage « allumé » lent (6 s) : rien ne s'affiche en attendant, ni après`, fuyants.map(([ms, o]) => `${ms} ms stream=${o.st} ${o.f.slice(0, 3).join(' | ')}`).join(' ; '));
          await ctx.close();
        }
      });
      await essaie(`${T} · nuage illisible`, async () => {
        const { ctx, pg, ecrits } = await preparer(b, vp, { local: null, mainKO: true });
        await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(6000);
        const o = { st: await pg.evaluate(() => document.documentElement.hasAttribute('data-mode-stream')), f: fuites(await lireAffiche(pg)) };
        dit(o.st && o.f.length === 0, `${T} · réglage illisible (main en 522) : l'écran reste masqué`, `stream=${o.st} ${o.f.slice(0, 3).join(' | ')}`);
        await pg.screenshot({ path: path.join(CAPTURES, `stream-pas-su-${vp.width}.png`) }).catch(() => {});
        const p = await pg.$('[data-pastille-stream="pas-su"]');
        dit(!!p, `${T} · la pastille dit que c'est caché en attendant (et comment l'afficher)`);
        if (p) {
          await p.click(); await pg.waitForTimeout(500);
          await pg.locator('button', { hasText: 'Afficher ici' }).last().click();
          await pg.waitForTimeout(900);
          const t = norm(await lireAffiche(pg));
          dit(t.includes('312,77') || t.includes(norm(S.login1)), `${T} · « Afficher ici » montre ses données sur cet appareil`);
          await pg.waitForTimeout(1200);
          dit(!ecrits.some((e) => /vrm_mode_stream/.test(e)), `${T} · … sans rien écrire au nuage (sinon le mode se couperait sur l'ordinateur du live)`, String(ecrits.filter((e) => /vrm_mode_stream/.test(e)).length));
        }
        await ctx.close();
      });
    }
    await essaie('nuage lent qui dit coupé', async () => {
      const { ctx, pg } = await preparer(b, { width: 1512, height: 950 }, { local: null, extraMain: { vrm_mode_stream: { on: false, at: MAINTENANT - 60e3 } }, retardMain: 2500 });
      await pg.goto(`http://localhost:${PORT}/?tab=vintedaccounts`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(7000);
      const st = await pg.evaluate(() => document.documentElement.hasAttribute('data-mode-stream'));
      const t = norm(await lireAffiche(pg));
      dit(!st && t.includes(norm(S.login1)) && !(await pg.$('[data-pastille-stream]')), 'l’autre sens : le nuage arrive et dit « coupé » — tout se réaffiche, sans pastille', `stream=${st}`);
      await ctx.close();
    });

    // ── L'INTERRUPTEUR, LA PASTILLE, LE NUAGE ──────────────────────────────
    await essaie('interrupteur et pastille', async () => {
      const { ctx, pg, ecrits } = await preparer(b, { width: 1512, height: 950 });
      await pg.goto(`http://localhost:${PORT}/?tab=settings`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3500);
      const sw = await pg.$('[role="switch"][aria-label="Mode stream"]');
      dit(!!sw, 'Réglages porte l’interrupteur « Mode stream »');
      if (sw) await sw.click();
      await pg.waitForTimeout(1200);
      await pg.goto(`http://localhost:${PORT}/?tab=vintedaccounts`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3300);
      let f = fuites(await lireAffiche(pg));
      dit(f.length === 0, 'allumé à la main, Comptes liés ne montre plus rien de sensible (et ça tient au rechargement)', f.join(', '));
      const stocke = await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_mode_stream') || 'null'); } catch (_) { return 'illisible'; } });
      dit(stocke && stocke.on === true && Number(stocke.at) > 0, 'le réglage est rangé avec son heure ({ on, at })', JSON.stringify(stocke));
      dit(ecrits.some((e) => /vrm_mode_stream/.test(e) && /"on":true/.test(e)), 'il part au nuage (ligne main)', String(ecrits.length) + ' écriture(s)');
      // La pastille coupe — après confirmation — et le texte réel revient sans recharger.
      await pg.click('[data-pastille-stream]');
      await pg.waitForTimeout(600);
      await pg.locator('button', { hasText: 'Couper' }).last().click();
      await pg.waitForTimeout(900);
      const t = norm(await lireAffiche(pg));
      dit(t.includes(norm(S.login1)) && t.includes(norm(S.label1)), 'la pastille coupe le mode : les vrais noms reviennent, sans recharger');
      dit(!(await pg.$('[data-pastille-stream]')), 'et la pastille disparaît');
      await ctx.close();
    });

    await essaie('nuage seul', async () => {
      const { ctx, pg } = await preparer(b, { width: 1512, height: 950 }, { extraMain: { vrm_mode_stream: { on: true, at: MAINTENANT - 3600e3 } } });
      await pg.goto(`http://localhost:${PORT}/?tab=vintedaccounts`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(4000);
      const f = fuites(await lireAffiche(pg));
      dit(f.length === 0, 'appareil NEUF, seul le nuage dit « allumé » : l’écran se masque', f.join(', '));
      await ctx.close();
    });

    await essaie('nuage périmé', async () => {
      const { ctx, pg } = await preparer(b, { width: 1512, height: 950 }, { local: ALLUME, extraMain: { vrm_mode_stream: { on: false, at: MAINTENANT - 86400e3 } } });
      await pg.goto(`http://localhost:${PORT}/?tab=vintedaccounts`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(4500);
      const f = fuites(await lireAffiche(pg));
      dit(f.length === 0, 'nuage PÉRIMÉ (« coupé » d’hier, « allumé » ici à l’instant) : rien ne se réaffiche', f.join(', '));
      await ctx.close();
    });

    // ── En SOMBRE, aux deux tailles : le masquage tient, la pastille se voit.
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      await essaie(`sombre ${vp.width}`, async () => {
        const { ctx, pg, errs } = await preparer(b, vp, { local: ALLUME, sombre: true });
        for (const t of ['cat_annonces', 'vintedaccounts']) {
          await pg.goto(`http://localhost:${PORT}/?tab=${t}`, { waitUntil: 'domcontentloaded' });
          await pg.waitForTimeout(3300);
          const f = fuites(await lireAffiche(pg));
          const fond = await pg.evaluate(() => { const c = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000; });
          dit(f.length === 0 && fond < 80, `sombre ${vp.width} · ${t} : fond sombre, rien de sensible`, `fond ${fond} · ${f.join(', ')}`);
          await pg.screenshot({ path: path.join(CAPTURES, `stream-sombre-${t}-${vp.width}.png`), fullPage: true }).catch(() => {});
          await sain(pg, `sombre ${vp.width} · ${t}`);
        }
        dit(errs.length === 0, `sombre ${vp.width} : aucune erreur de page`, errs.join(' | ').slice(0, 200));
        await ctx.close();
      });
    }

    await essaie('document ouvert', async () => {
      const { ctx, pg } = await preparer(b, { width: 1512, height: 950 }, { local: ALLUME });
      await pg.goto(`http://localhost:${PORT}/?tab=dashboard`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(3000);
      let msg = '';
      pg.once('dialog', async (d) => { msg = d.message(); await d.dismiss(); });
      const ouvert = await pg.evaluate(() => { const w = window.open('', '_blank'); return w ? 'ouvert' : 'refusé'; });
      dit(/Mode stream/.test(msg) && ouvert === 'refusé', 'un document ouvert dans un nouvel onglet DEMANDE d’abord, et ne s’ouvre pas si on refuse', `${ouvert} · ${msg.slice(0, 80)}`);
      await ctx.close();
    });
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 200)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(`(captures : ${CAPTURES})`);
  console.log(ko ? `\n❌ mode stream : ${ko} rouge(s)` : '\n✅ mode stream : tout est vert');
  process.exit(ko ? 1 : 0);
})();
