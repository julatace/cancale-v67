// Banc : eBay → Annonces · BROUILLONS ET PLANIFICATEUR (5 octobre) — l'écran
// RENDU, sur des données INVENTÉES (il vit dans le dépôt, qui est public :
// aucune fixture). Port 4721.
//
// Julien : « tout doit être personnalisable : le nombre d'annonces qu'il peut
// poster, sélectionner ses brouillons, ce qu'il veut mettre en ligne, etc.
// Tout doit être parfait. » Le banc fige l'horloge au mardi 20 octobre 2026,
// 10:00 à Paris — avec un navigateur réglé sur l'heure de NEW YORK, exprès :
// l'écran dit « heure de Paris », la conversion ne doit jamais passer par
// l'heure locale de l'appareil — rend l'écran à 390 et 1512 px, et exige — en jugeant les
// `data-*` posés par l'écran (§6.5) et ce qui PART vers `/api/ebay` :
//   · « Enregistrer en brouillon » range le brouillon dans SA ligne
//     `ebay_brouillons` SANS effacer les six autres (relire-fusionner-écrire) ;
//   · la sélection (tout sélectionner) ouvre le planificateur ; la paire déjà
//     en vente sur eBay (N°27) est écartée AVEC sa raison ;
//   · 2 par jour, 19:00–21:00, mardi→dimanche, une toutes les 30 min, par N° :
//     l'aperçu donne les heures EXACTES de Paris — et le changement d'heure
//     du dimanche 25 octobre (19:00 = 17:00 UTC le samedi, 18:00 UTC le
//     dimanche) ;
//   · un départ le samedi 7 novembre ⇒ 2 brouillons au-delà de 3 semaines,
//     comptés, qui RESTENT des brouillons ;
//   · les frais lus chez eBay POUR CETTE HEURE, par nom : programmation 0,20 €
//     ligne par ligne, « pas su » quand eBay ne l'annonce pas, le total, et
//     « non remboursés » parce qu'un frais de programmation est non nul ;
//   · la limite de vente lue chez eBay est dite ;
//   · la confirmation est fermée tant que le risque (annulation non garantie,
//     double vente) n'a pas été coché, puis passe par une feuille qui le redit ;
//   · ce qui part : six `programmer`, chacun avec la BONNE heure UTC, un UUID
//     de 32 hex DIFFÉRENT, `confirme:true` et les frais vus ;
//   · le bilan : « 4 sur 6 programmées · 2 refusées », chacune avec sa raison ;
//   · les programmées, groupées PAR JOUR ; « Déplacer » grisé (avec la raison)
//     pour celle qui part dans moins d'une heure ; « Annuler » rend la réponse
//     d'eBay telle quelle et renvoie au Seller Hub sur un refus ;
//   · aucun débordement horizontal, aucune erreur de page.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path'), os = require('os');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = 4721;
const MAINTENANT = Date.parse('2026-10-20T08:00:00.000Z');   // mardi 20 octobre, 10:00 à Paris

const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_test', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() }];
const PAIRES = [
  [21, 'Nike Dunk Low panda taille 42', 95], [22, 'Adidas Gazelle bleu taille 40', 80], [23, 'Salomon XT-6 noir taille 41', 120],
  [24, 'New Balance 550 blanc taille 43', 90], [25, 'Asics Gel 1130 argent taille 39', 70], [26, 'Puma Suede rouge taille 44', 60],
  [27, 'Vans Old Skool noir taille 42', 50],
];
const idDe = (n) => 7000 + n;
const LISTINGS = { capturedAt: new Date(MAINTENANT).toISOString(), payload: { items: PAIRES.map(([n, t, p]) => ({ id: idDe(n), title: t, price: { amount: String(p), currency_code: 'EUR' }, brand_title: t.split(' ')[0], is_closed: false, is_hidden: false, is_draft: false, nPhotos: 2, photo: { url: `https://img.test/v${idDe(n)}.jpg` } })) } };
const FICHES = Object.fromEntries(PAIRES.map(([n, t]) => [String(idDe(n)), { numero: String(n), title: t, photo: `https://img.test/v${idDe(n)}.jpg` }]));
const DETAILS = Object.fromEntries(PAIRES.map(([n]) => [String(idDe(n)), { photos: [`https://img.test/v${idDe(n)}.jpg`, `https://img.test/v${idDe(n)}b.jpg`] }]));
// Six brouillons déjà prêts (N°22 à N°27) ; le N°21 sera ENREGISTRÉ par le banc.
const brouillon = (n, t, p, k) => ({ id: 'b-' + n, creeLe: MAINTENANT - k * 60000, majLe: MAINTENANT - k * 60000, pairId: String(idDe(n)), numero: String(n), titre: t, prix: String(p), quantite: '1', etat: '3000', description: t, photos: [`https://img.test/v${idDe(n)}.jpg`], categorie: { id: '15709', nom: 'Baskets', requis: ['Marque'] }, aspects: { Marque: t.split(' ')[0] }, etatBrouillon: 'brouillon' });
const BROUILLONS = () => Object.fromEntries(PAIRES.filter(([n]) => n !== 21).map(([n, t, p], k) => ['b-' + n, brouillon(n, t, p, k + 1)]));
// Une annonce déjà EN LIGNE sur eBay (la N°27), et une déjà PROGRAMMÉE qui part
// dans 40 minutes (la N°30, pas dans les brouillons).
const EBAY_ANNONCES = [{ itemId: '110000000027', title: 'Vans Old Skool noir taille 42', price: '50.0', sku: 'VRM-27', photo: 'https://img.test/e27.jpg' }];
const PROG_INITIALES = () => [{ itemId: '110000000930', sku: 'VRM-30', title: 'Converse Chuck 70 blanc taille 41', price: '65.0', debut: new Date(MAINTENANT + 40 * 60000).toISOString(), photo: '' }];

// ══ (6 octobre) LA REVUE CONTRADICTOIRE DU PLANIFICATEUR — scénarios inventés ══
// Chacun est un défaut CONFIRMÉ en exécutant le code d'avant ; le banc le sert
// tel quel et juge ce qui PART vers `/api/ebay` et ce qui est ÉCRIT en base.
const annonceV = (id, t, p, ferme) => ({ id, title: t, price: { amount: String(p), currency_code: 'EUR' }, brand_title: t.split(' ')[0], is_closed: !!ferme, is_hidden: false, is_draft: false, nPhotos: 2, photo: { url: `https://img.test/v${id}.jpg` } });
const titreDe = (n) => (PAIRES.find((x) => x[0] === n) || [n, 'Paire ' + n, 50])[1];
const prixDe = (n) => (PAIRES.find((x) => x[0] === n) || [n, '', 50])[2];
const txnV = (k, item, titre) => ({ id: `harvest_111_txn_${k}`, data: { payload: { transaction: { id: k, item_id: item, status: titre ? 450 : 1, status_title: titre } } } });
// Des brouillons nommés : [id, N°, pairId|null, minutes depuis la dernière modif]
const brouillonsDe = (liste) => () => Object.fromEntries(liste.map(([id, n, pairId, k]) => {
  const num = String(n).replace(/^0+/, '') || String(n);
  const d = brouillon(Number(num), titreDe(Number(num)), prixDe(Number(num)), k);
  return [id, { ...d, id, numero: String(n), pairId: pairId == null ? null : String(pairId) }];
}));
// ── A. « DÉJÀ VENDUE AILLEURS », UN LOT EN DOUBLE, DES SKU MAL ÉCRITS ──────
//   N°21 : à programmer — une ANCIENNE annonce du N°21 (9021) est vendue, mais
//          la 7021 est en vente et pas vendue : la paire est REVENUE ;
//   N°22 : vendue sur eBay (commande PAID, SKU VRM-22) ;
//   N°23 : vendue sur Leboncoin — reliée SEULEMENT par son annonce (réf VRM-23) ;
//   N°24 : revendue sur Vinted sous une AUTRE annonce (8024) ; la sienne (7024) fermée ;
//   N°25 : deux brouillons de la même paire (« 25 » et « 025 ») ;
//   N°26 : vendue sur Vinted, brouillon SANS pairId ;
//   N°27 : en vente sur eBay sous le SKU « vrm-027 » ;
//   N°28 : programmée sur eBay sous le SKU « VRM 028 ».
const SC_AILLEURS = {
  fiches: { ...FICHES, '8024': { numero: '24', title: titreDe(24), photo: '' }, '9021': { numero: '21', title: titreDe(21), photo: '' } },
  listings: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { items: [
    annonceV(7021, titreDe(21), 95), annonceV(7022, titreDe(22), 80), annonceV(7023, titreDe(23), 120), annonceV(7024, titreDe(24), 90, true),
    annonceV(7025, titreDe(25), 70), annonceV(7026, titreDe(26), 60, true), annonceV(7027, titreDe(27), 50), annonceV(8024, titreDe(24), 90, true), annonceV(9021, titreDe(21), 95, true),
  ] } },
  annonces: [{ itemId: '110000000027', title: titreDe(27), price: '50.0', sku: 'vrm-027', photo: '' }],
  commandes: [{ orderId: '07-022', orderPaymentStatus: 'PAID', lineItems: [{ sku: 'VRM-22', title: titreDe(22) }] }],
  prog: () => [{ itemId: '110000000928', sku: 'VRM 028', title: 'Paire 28', price: '40.0', debut: new Date(MAINTENANT + 2 * 86400000).toISOString(), photo: '' }],
  brouillons: brouillonsDe([['b-21', 21, 7021, 9], ['b-22', 22, 7022, 8], ['b-23', 23, 7023, 7], ['b-24', 24, 7024, 6], ['b-25', 25, 7025, 1], ['b-25bis', '025', 7025, 2], ['b-26', 26, null, 4], ['b-27', 27, 7027, 3], ['b-28', 28, null, 5]]),
  lignes: [
    txnV(1, 8024, 'Commande finalisée'), txnV(2, 7026, 'Commande finalisée'), txnV(3, 9021, 'Commande finalisée'),
    txnV(4, 7025, ''),   // une CONVERSATION sur la N°25 : pas une vente
    { id: 'lbc_ventes', data: { ventes: { v23: { isSeller: true, itemId: 5023, title: 'Salomon XT-6', stepStatus: 'finished' } } } },
    { id: 'lbc_listings', data: { items: { 5023: { id: '5023', subject: 'Salomon XT-6 noir', customRef: 'VRM-23' } } } },
  ],
};
// ── B. LE SECOND ESSAI ne doit pas effacer le doute du premier ; l'UUID rangé
//    en base est gardé. N°21 : coupure, eBay a créé l'annonce mais ne la liste
//    pas encore, puis « les frais ont changé » au second essai. N°22 : coupure,
//    puis la route RETROUVE la paire (409 « déjà programmée » + son numéro).
const U1 = 'ABCDEF0123456789ABCDEF0123456789';
const SC_INCERTAIN = {
  brouillons: brouillonsDe([['b-21', 21, 7021, 2], ['b-22', 22, 7022, 1]]),
  programmer: (body, num, essai) => {
    const coupe = { status: 504, body: { ok: false, reason: 'incertain', uuid: body.uuid, error: 'eBay n\'a pas répondu à temps — je ne sais pas si elle est programmée. VRM relit tes annonces eBay avant de redemander quoi que ce soit.' } };
    if (num === '21') return essai === 1 ? coupe : { status: 409, body: { ok: false, reason: 'frais', error: 'Les frais ont changé depuis ta vérification (0,55 € au lieu de 0,20 €) — rien n\'a été envoyé.' } };
    if (num === '22') return essai === 1 ? coupe : { status: 409, body: { ok: false, reason: 'deja-programmee', itemId: '110000000822', error: 'La paire VRM-22 est déjà programmée sur eBay — rien n\'a été envoyé.' } };
    return null;
  },
};
// ── C. L'HORLOGE QUI AVANCE : 19:10 à Paris, « Maintenant », 3 brouillons. ──
const SOIR = '2026-10-20T17:10:00.000Z';
const SC_HORLOGE = { brouillons: brouillonsDe([['b-22', 22, 7022, 3], ['b-23', 23, 7023, 2], ['b-24', 24, 7024, 1]]), annonces: [] };
// ── D. « PUBLIER » (immédiat) passe par les mêmes gardes. ──────────────────
//   N°21 programmée sur eBay ; N°26 vendue sur Vinted (brouillon rouvert) ;
//   N°24 plus en vente sur Vinted (fermée, pas prouvée vendue) ; N°23 sera
//   programmée « entre-temps » pendant que son brouillon est ouvert ; N°25,
//   libre, se publie (l'autre sens : on ne bloque pas tout).
const SC_PUBLIER = {
  listings: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { items: [
    annonceV(7021, titreDe(21), 95), annonceV(7022, titreDe(22), 80), annonceV(7023, titreDe(23), 120), annonceV(7024, titreDe(24), 90, true),
    annonceV(7025, titreDe(25), 70), annonceV(7026, titreDe(26), 60, true), annonceV(7027, titreDe(27), 50),
  ] } },
  prog: () => [{ itemId: '110000000921', sku: 'VRM-21', title: titreDe(21), price: '95.0', debut: new Date(MAINTENANT + 2 * 86400000).toISOString(), photo: '' }],
  brouillons: brouillonsDe([['b-23', 23, 7023, 3], ['b-24', 24, 7024, 2], ['b-26', 26, 7026, 1]]),
  lignes: [txnV(1, 7026, 'Commande finalisée')],
};

let rows = [], progEbay = [], envois = [], ecritures = [], lectures = [], essais = {}, prochainId = 110000000801;
// La ligne des brouillons ne répond plus (la base debout par ailleurs) : le cas
// « lecture KO, écriture OK », celui qui EFFACE si on repart de vide (§5).
let panneBrouillons = false;
// (6 octobre) Le scénario courant : `null` = le scénario principal. Un scénario
// remplace les fiches, les annonces Vinted, eBay, les commandes, les brouillons,
// les programmées, ajoute des lignes (ventes, Leboncoin) et peut répondre à
// `programmer` à la place du faux eBay (`programmer(body, num, essai)`).
let SC = null;
const remettre = (sc) => {
  SC = sc || null;
  rows = [
    { id: 'main', data: { vinted_annonce_numeros: (SC && SC.fiches) || FICHES } },
    { id: 'harvest_111_listings', data: (SC && SC.listings) || LISTINGS },
    { id: 'vinted_item_details', data: DETAILS },
    { id: 'ebay_listings', data: { items: (SC && SC.annonces) || EBAY_ANNONCES, capturedAt: MAINTENANT } },
    { id: 'ebay_orders', data: { orders: (SC && SC.commandes) || [], capturedAt: MAINTENANT } },
    { id: 'ebay_brouillons', data: { items: (SC && SC.brouillons) ? SC.brouillons() : BROUILLONS(), majAt: MAINTENANT } },
    // ⚠️ PAS de ligne `ebay_programmees` : « jamais lue » — l'écran doit la
    //    demander à eBay, jamais conclure « aucune ».
    ...((SC && SC.lignes) || []),
  ];
  progEbay = (SC && SC.prog) ? SC.prog() : PROG_INITIALES(); envois = []; ecritures = []; lectures = []; essais = {}; prochainId = 110000000801;
};

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
// Un banc ne meurt pas, il rapporte : ce qui lève devient un contrôle ROUGE.
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { dit(false, quoi, 'a levé : ' + String((e && e.message) || e).split('\n')[0].slice(0, 160)); return null; } };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
// Projection PostgREST : `alias:data->champ` / `alias:data->>champ` (§6.3).
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

async function ouvrir(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, locale: 'fr-FR', timezoneId: 'America/New_York', ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  // (6 octobre) `horloge` : une horloge INSTALLÉE qui avance (pour faire passer
  // le tic de 30 s du planificateur avec `runFor`) ; sinon l'heure est figée.
  if (opts.horloge) await pg.clock.install({ time: new Date(opts.horloge) });
  else await pg.clock.setFixedTime(new Date(MAINTENANT));
  await pg.addInitScript(([fiches]) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_annonce_numeros', JSON.stringify(fiches)); } catch (_) {} }, [(SC && SC.fiches) || FICHES]);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() === 'GET') lectures.push(u);
    if (route.request().method() !== 'GET') {
      try {
        for (const l of [].concat(JSON.parse(route.request().postData() || 'null') || [])) {
          if (!l || !l.id) continue;
          ecritures.push(JSON.parse(JSON.stringify(l)));
          const i = rows.findIndex((r) => r.id === l.id);
          if (i >= 0) rows[i] = { id: l.id, data: l.data }; else rows.push({ id: l.id, data: l.data });
        }
      } catch (_) {}
      return j([]);
    }
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (panneBrouillons && /ebay_brouillons/.test(u)) return j({ message: 'timeout' }, 500);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(rows.filter((r) => r.id === eq[1]).map(forme));
    const inn = /id=in\.\(([^)]*)\)/.exec(u);
    if (inn) { const ids = inn[1].split(','); return j(rows.filter((r) => ids.includes(r.id)).map(forme)); }
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(rows.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  // ⚠️ enregistré APRÈS le fourre-tout → Playwright le prend en PREMIER (§6.6).
  // Un faux eBay qui répond comme la VRAIE route (formes de `api/ebay.js`).
  await pg.route('**/api/ebay**', (route) => {
    const req = route.request();
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (req.method() !== 'POST') return j({ ok: true, ready: true, canConsent: true });
    let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (_) {}
    envois.push(JSON.parse(JSON.stringify(body)));
    const num = String((body.item && body.item.numero) || '');
    if (body.action === 'status') return j({ ok: true, connected: true });
    if (body.action === 'offreinfo') return j({ ok: true, eligibles: [], complet: true });
    if (body.action === 'finances') return j({ ok: false, reason: 'scope' });
    if (body.action === 'limites') return j({ ok: true, quantite: 10, montant: 500, devise: 'EUR', inscrit: true });
    if (body.action === 'pubinfo') return j({ ok: true, categorie: { categoryId: '15709', suggeree: { categoryId: '15709', categoryName: 'Baskets' } }, categories: [{ categoryId: '15709', categoryName: 'Baskets' }], conditions: [{ id: '3000', label: "D'occasion" }, { id: '1000', label: 'Neuf' }], attributs: [{ nom: 'Marque', requis: true, mode: 'SELECTION_ONLY', valeurs: ['Nike', 'Adidas', 'Salomon', 'New Balance', 'Asics', 'Puma', 'Vans'] }], attributsObligatoires: ['Marque'] });
    if (body.action === 'pubverify') {
      const prog = !!body.scheduleTime;
      // La N°26 : eBay n'annonce PAS de frais de programmation (« pas su »).
      if (prog && num === '26') return j({ ok: true, fees: 0, frais: { total: 0, insertion: 0, programmation: null, remises: null, devise: 'EUR', lignes: [] }, programme: body.scheduleTime });
      return j({ ok: true, fees: prog ? 0.2 : 0, frais: { total: prog ? 0.2 : 0, insertion: 0, programmation: prog ? 0.2 : null, remises: null, devise: 'EUR', lignes: prog ? [{ nom: 'SchedulingFee', montant: 0.2, devise: 'EUR', remise: null }] : [] }, programme: body.scheduleTime || null });
    }
    if (body.action === 'publish') return j({ ok: true, itemId: '110000000777', url: 'https://www.ebay.fr/itm/110000000777', sku: num ? 'VRM-' + num : null });
    if (body.action === 'programmer') {
      essais[num] = (essais[num] || 0) + 1;
      if (SC && SC.programmer) { const r = SC.programmer(body, num, essais[num]); if (r) return j(r.body, r.status); }
      if (num === '24') return j({ ok: false, reason: 'frais', error: 'Les frais ont changé depuis ta vérification (0,55 € au lieu de 0,20 €) — rien n\'a été envoyé.' }, 409);
      if (num === '25') return j({ ok: false, error: 'La catégorie ne convient pas à cet objet.' }, 422);
      const itemId = String(prochainId++);
      progEbay.push({ itemId, sku: 'VRM-' + num, title: body.item.title, price: body.item.price, debut: body.scheduleTime, photo: '' });
      return j({ ok: true, itemId, sku: 'VRM-' + num, demande: body.scheduleTime, debut: body.scheduleTime, fin: null, enLigneMaintenant: false, frais: { total: 0.2 } });
    }
    if (body.action === 'programmees') {
      const data = { items: progEbay.slice(), enLigne: ((SC && SC.annonces) || EBAY_ANNONCES).map((a) => ({ itemId: a.itemId, sku: a.sku })), complet: true, capturedAt: MAINTENANT };
      const i = rows.findIndex((r) => r.id === 'ebay_programmees');
      if (i >= 0) rows[i] = { id: 'ebay_programmees', data }; else rows.push({ id: 'ebay_programmees', data });
      return j({ ok: true, ...data });
    }
    if (body.action === 'deprogrammer') return j({ ok: false, reason: 'refus', error: 'Une annonce programmée ne peut pas être terminée par cet appel.' }, 422);
    return j({ ok: true });
  });
  return { ctx, pg, errs };
}
const feuille = (pg) => pg.locator('div[style*="z-index: 2000"]');
// Une capture de ce que l'œil voit : l'élément amené à l'écran, puis la vue
// (l'app défile dans un conteneur : une capture « pleine page » ne montre que
// la vue). §6.2 : regarder la capture fait partie du test.
const photo = async (pg, sel, nom) => {
  try {
    await pg.locator(sel).first().evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await pg.waitForTimeout(250);
    await pg.screenshot({ path: path.join(os.tmpdir(), nom + '.png') });
  } catch (_) {}
};
const deborde = (pg) => pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const lignesPlan = (pg) => pg.$$eval('[data-planif-ligne]', (els) => els.map((e) => ({ id: e.getAttribute('data-planif-ligne'), paris: e.getAttribute('data-heure-paris'), utc: e.getAttribute('data-utc') })));

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      remettre();
      const { ctx, pg, errs } = await ouvrir(b, vp);
      await essaie('écran', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(1500);
        await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 });
        await pg.waitForSelector('[data-ebay-brouillons="lu"]', { timeout: 15000 });
        await pg.waitForSelector('[data-ebay-programmees="lu"]', { timeout: 10000 }).catch(() => {});
        const nb = await pg.$eval('[data-ebay-brouillons]', (e) => e.getAttribute('data-nb'));
        dit(nb === '6', 'les six brouillons enregistrés sont listés', 'data-nb=' + nb);
        const prog = await pg.$eval('[data-ebay-programmees]', (e) => e.getAttribute('data-ebay-programmees')).catch(() => '∅');
        dit(prog === 'lu' && envois.some((e) => e.action === 'programmees'),
          'la ligne des programmées n\'existait pas : l\'écran l\'a DEMANDÉE à eBay (« jamais lue » n\'est pas « aucune »)', 'état=' + prog);
      });
      // ── 1. ENREGISTRER EN BROUILLON ───────────────────────────────────────
      await essaie('enregistrer en brouillon', async () => {
        await pg.click('[data-poster="ebay"]');
        await pg.locator('button', { hasText: 'N°21' }).first().click({ timeout: 8000 });
        await pg.getByRole('button', { name: 'Trouver la catégorie eBay' }).click({ timeout: 5000 });
        await pg.waitForSelector('text=Catégorie eBay', { timeout: 8000 });
        await pg.fill('input[placeholder="ex. 74"]', '95');
        await pg.click('[data-publier-brouillon]');
        await pg.waitForSelector('[data-brouillon-msg]', { timeout: 8000 });
        const msg = await pg.$eval('[data-brouillon-msg]', (e) => e.textContent);
        await pg.waitForFunction(() => { const e = document.querySelector('[data-ebay-brouillons]'); return e && e.getAttribute('data-nb') === '7'; }, null, { timeout: 8000 }).catch(() => {});
        const w = ecritures.filter((x) => x.id === 'ebay_brouillons').pop();
        const items = (w && w.data && w.data.items) || {};
        const neuf = Object.values(items).find((d) => d && d.numero === '21');
        dit(/✓/.test(msg) && neuf && neuf.prix === '95' && neuf.categorie && neuf.categorie.id === '15709' && neuf.aspects && neuf.aspects.Marque === 'Nike',
          '« Enregistrer en brouillon » range la N°21 (prix, catégorie, marque) — rien ne part chez eBay', msg.trim());
        dit(Object.keys(items).length === 7 && ['b-22', 'b-23', 'b-24', 'b-25', 'b-26', 'b-27'].every((k) => items[k]),
          'et les SIX autres brouillons sont toujours là (relire-fusionner-écrire, jamais repartir de vide)', Object.keys(items).join(','));
        dit(!envois.some((e) => ['publish', 'programmer'].includes(e.action)), 'aucune publication, aucune programmation n\'est partie');
        await photo(pg, '[data-publier-brouillon]', 'ebay-publier-brouillon-' + vp.width);
      });
      // ── 1 bis. ROUVRIR UN BROUILLON ET LE MODIFIER ─────────────────────────
      await essaie('modifier un brouillon', async () => {
        await pg.click('[data-brouillon-modifier="b-22"]');
        await pg.waitForFunction(() => { const e = document.querySelector('[data-publier-brouillon-id]'); return e && e.getAttribute('data-publier-brouillon-id') === 'b-22'; }, null, { timeout: 8000 });
        const titre = await pg.$eval('input[maxlength="80"]', (e) => e.value);
        const bouton = await pg.$eval('[data-publier-brouillon]', (e) => e.textContent);
        dit(/Adidas Gazelle/.test(titre) && /Mettre à jour/.test(bouton), '« Modifier » rouvre le brouillon dans le formulaire (son titre, « Mettre à jour le brouillon »)', `${titre} · ${bouton}`);
        await pg.fill('input[placeholder="ex. 74"]', '85');
        await pg.click('[data-publier-brouillon]');
        await pg.waitForFunction(() => /✓/.test((document.querySelector('[data-brouillon-msg]') || {}).textContent || ''), null, { timeout: 8000 });
        const w = ecritures.filter((x) => x.id === 'ebay_brouillons').pop();
        const items = (w && w.data && w.data.items) || {};
        dit(items['b-22'] && items['b-22'].prix === '85' && items['b-22'].creeLe === MAINTENANT - 60000 && Object.keys(items).length === 7,
          'la mise à jour garde le même brouillon (sa date de création), change le prix, et ne touche pas aux autres', `prix=${items['b-22'] && items['b-22'].prix} · ${Object.keys(items).length} brouillons`);
        await photo(pg, '[data-ebay-brouillons]', 'ebay-brouillons-' + vp.width);
      });
      // ── 2. LE PLANIFICATEUR ───────────────────────────────────────────────
      await essaie('planificateur', async () => {
        await pg.click('[data-brouillons-tout]');
        const coches = await pg.$$eval('[data-brouillon-choix]', (els) => els.filter((e) => e.checked).length);
        dit(coches === 7, '« Tout sélectionner » coche les sept brouillons', String(coches));
        await pg.click('[data-brouillons-programmer]');
        await pg.waitForSelector('[data-planif]', { timeout: 5000 });
        await pg.click('[data-planif-libre]');
        await pg.fill('[data-planif-depart-date]', '2026-11-07');
        await pg.fill('[data-planif-depart-heure]', '19:00');
        await pg.fill('[data-planif-parjour]', '2');
        await pg.fill('[data-planif-de]', '19:00');
        await pg.fill('[data-planif-a]', '21:00');
        if ((await pg.$eval('[data-planif-jour="1"]', (e) => e.getAttribute('aria-pressed'))) === 'true') await pg.click('[data-planif-jour="1"]');
        await pg.selectOption('[data-planif-ecart]', '30');
        await pg.selectOption('[data-planif-ordre]', 'numero');
        await pg.waitForTimeout(300);
        const l1 = await lignesPlan(pg);
        const hh = await pg.$eval('[data-planif-hors-horizon]', (e) => e.getAttribute('data-planif-hors-horizon')).catch(() => null);
        dit(l1.length === 4 && hh === '2' && l1.map((x) => x.paris).join('|') === '2026-11-07 19:00|2026-11-07 19:30|2026-11-08 19:00|2026-11-08 19:30',
          'départ le samedi 7 novembre : 4 heures planifiées, et les 2 dernières (mardi 10, au-delà de 3 semaines) RESTENT des brouillons — dit à l\'écran', `${l1.map((x) => x.paris).join(' | ')} · hors horizon ${hh}`);
        const exclues = await pg.$eval('[data-planif-exclues]', (e) => e.textContent).catch(() => '');
        dit(/N°27/.test(exclues) && /déjà en vente sur eBay/.test(exclues), 'la N°27, déjà en vente sur eBay, est écartée AVEC sa raison', exclues.trim().slice(0, 120));
        // Le vrai départ : le vendredi 23 octobre, 19:00.
        await pg.fill('[data-planif-depart-date]', '2026-10-23');
        await pg.waitForTimeout(300);
        const l2 = await lignesPlan(pg);
        const attendu = [
          ['b-21', '2026-10-23 19:00', '2026-10-23T17:00:00.000Z'], ['b-22', '2026-10-23 19:30', '2026-10-23T17:30:00.000Z'],
          ['b-23', '2026-10-24 19:00', '2026-10-24T17:00:00.000Z'], ['b-24', '2026-10-24 19:30', '2026-10-24T17:30:00.000Z'],
          ['b-25', '2026-10-25 19:00', '2026-10-25T18:00:00.000Z'], ['b-26', '2026-10-25 19:30', '2026-10-25T18:30:00.000Z'],
        ];
        const neuf = l2.find((x) => x.paris === '2026-10-23 19:00');
        const vu = l2.map((x) => [x.id === (neuf && neuf.id) ? 'b-21' : x.id, x.paris, x.utc]);
        dit(JSON.stringify(vu) === JSON.stringify(attendu),
          '2 par jour, 19:00–21:00, mar.→dim., toutes les 30 min, par N° : les heures EXACTES de Paris, et le changement d\'heure du 25 (19:00 = 17:00 UTC samedi, 18:00 UTC dimanche)',
          vu.map((x) => `${x[1]}→${x[2].slice(11, 16)}Z`).join(' · '));
        const jours = await pg.$$eval('[data-planif-jour-groupe]', (els) => els.map((e) => e.getAttribute('data-planif-jour-groupe')));
        dit(jours.join(',') === '2026-10-23,2026-10-24,2026-10-25', 'l\'aperçu est groupé par jour', jours.join(','));
        const lim = await pg.$eval('[data-planif-limites]', (e) => ({ etat: e.getAttribute('data-planif-limites'), t: e.textContent }));
        dit(lim.etat === 'lu' && /10 annonces/.test(lim.t) && /500,00 €/.test(lim.t), 'la limite de vente lue chez eBay est dite (10 annonces, 500 € par mois)', lim.t.trim().slice(0, 90));
      });
      // ── 3. LES FRAIS, LUS CHEZ eBAY POUR CETTE HEURE ──────────────────────
      await essaie('frais', async () => {
        const avant = await pg.$eval('[data-planif-confirmer]', (e) => e.disabled);
        dit(avant, 'tant que les frais ne sont pas vérifiés, rien ne peut partir');
        await pg.click('[data-planif-verifier]');
        await pg.waitForFunction(() => document.querySelectorAll('[data-planif-frais]').length === 6, null, { timeout: 10000 });
        const fr = await pg.$$eval('[data-planif-frais]', (els) => els.map((e) => ({ prog: e.getAttribute('data-frais-programmation'), total: e.getAttribute('data-frais-total'), t: e.textContent })));
        const verifs = envois.filter((e) => e.action === 'pubverify');
        dit(verifs.length === 6 && verifs.every((e) => /^2026-10-2\dT\d\d:\d\d:00\.000Z$/.test(e.scheduleTime)), 'chaque annonce est vérifiée chez eBay AVEC son heure (scheduleTime UTC)', verifs.map((e) => e.scheduleTime && e.scheduleTime.slice(5, 16)).join(' '));
        dit(fr.filter((x) => x.prog === '0.2').length === 5 && fr.filter((x) => x.prog === 'pas-su').length === 1 && fr.every((x) => /programmation/.test(x.t)),
          'les frais par nom, ligne par ligne : programmation 0,20 € — et « pas su » quand eBay ne l\'annonce pas, jamais 0', fr.map((x) => x.prog).join(','));
        const tot = await pg.$eval('[data-planif-total]', (e) => ({ total: e.getAttribute('data-planif-total'), prog: e.getAttribute('data-planif-prog-total'), pasSu: e.getAttribute('data-planif-prog-pas-su'), t: e.textContent }));
        dit(tot.total === '1' && tot.prog === '1' && tot.pasSu === '1' && /pas su/.test(tot.t), 'le total : 1,00 € pour 6, dont programmation 1,00 €, et « pas su » pour une', tot.t.trim().slice(0, 120));
        const nr = await pg.$('[data-planif-non-rembourse]');
        dit(!!nr, 'un frais de programmation non nul ⇒ « facturé à la création, non remboursé si tu annules »');
        const fige = await pg.$eval('[data-planif-confirmer]', (e) => e.disabled);
        dit(fige && !!(await pg.$('[data-planif-risque]')), 'avant la PREMIÈRE programmation, rien ne part tant que le risque n\'est pas coché (annulation non garantie, double vente)');
        await photo(pg, '[data-planif]', 'ebay-planif-haut-' + vp.width); await photo(pg, '[data-planif-apercu]', 'ebay-planif-apercu-' + vp.width); await photo(pg, '[data-planif-confirmer]', 'ebay-planif-confirmer-' + vp.width);
      });
      // ── 4. CONFIRMER ⇒ CE QUI PART ────────────────────────────────────────
      await essaie('confirmer', async () => {
        // La capture précédente a laissé la case sous la barre du haut : on la
        // ramène au milieu de l'écran, comme un doigt qui fait défiler.
        await pg.locator('[data-planif-compris]').evaluate((e) => e.scrollIntoView({ block: 'center' }));
        await pg.check('[data-planif-compris]');
        await pg.click('[data-planif-confirmer]');
        await feuille(pg).getByRole('button', { name: 'Oui, programmer' }).waitFor({ timeout: 5000 });
        const texte = await feuille(pg).innerText();
        dit(/6 annonces/.test(texte) && /non rembours/.test(texte) && /annulation peut devoir se faire sur eBay/.test(texte),
          'la confirmation redit le nombre, les frais non remboursés et le risque d\'annulation', texte.replace(/\s+/g, ' ').slice(0, 160));
        await feuille(pg).getByRole('button', { name: 'Annuler' }).click();
        await pg.waitForTimeout(300);
        dit(!envois.some((e) => e.action === 'programmer'), 'Annuler la confirmation n\'envoie RIEN à eBay');
        await pg.click('[data-planif-confirmer]');
        await feuille(pg).getByRole('button', { name: 'Oui, programmer' }).click({ timeout: 5000 });
        await pg.waitForSelector('[data-planif-bilan]', { timeout: 20000 });
        const p = envois.filter((e) => e.action === 'programmer');
        const st = p.map((e) => e.scheduleTime).join(',');
        dit(p.length === 6 && st === '2026-10-23T17:00:00.000Z,2026-10-23T17:30:00.000Z,2026-10-24T17:00:00.000Z,2026-10-24T17:30:00.000Z,2026-10-25T18:00:00.000Z,2026-10-25T18:30:00.000Z',
          'six `programmer`, un par un, chacun à SON heure UTC (changement d\'heure compris)', st);
        const uu = p.map((e) => e.uuid);
        dit(uu.every((x) => /^[0-9A-F]{32}$/.test(x)) && new Set(uu).size === 6, 'chaque envoi porte un identifiant d\'envoi (UUID 32 hex) qui lui est propre', uu.map((x) => String(x).slice(0, 6)).join(' '));
        dit(p.every((e) => e.confirme === true && typeof e.fraisVus === 'number' && e.item && /^2[1-6]$/.test(String(e.item.numero))) && p.map((e) => e.item.numero).join(',') === '21,22,23,24,25,26',
          '`confirme:true`, les frais VUS et le N° de chaque paire partent avec', p.map((e) => `${e.item.numero}:${e.fraisVus}`).join(' '));
        const bl = await pg.$eval('[data-planif-bilan]', (e) => ({ p: e.getAttribute('data-programmees'), r: e.getAttribute('data-refusees'), t: e.innerText }));
        dit(bl.p === '4' && bl.r === '2' && /4 sur 6 programmées/.test(bl.t) && /N°24 — Les frais ont changé/.test(bl.t) && /N°25 — La catégorie ne convient pas/.test(bl.t),
          'le bilan : « 4 sur 6 programmées · 2 refusées », chaque refus avec SA raison — rien ne s\'arrête en silence', bl.t.replace(/\s+/g, ' ').slice(0, 200));
        const ligne = rows.find((r) => r.id === 'ebay_brouillons');
        const etats = Object.values((ligne && ligne.data && ligne.data.items) || {}).reduce((m, d) => { m[d.numero] = d.etatBrouillon + (d.programme && d.programme.itemId ? ':' + d.programme.itemId : '') + (d.envoi && d.envoi.ok === false ? ':échec' : ''); return m; }, {});
        dit(/^programmee:\d+$/.test(etats['21']) && /^programmee:/.test(etats['26']) && /échec/.test(etats['24']) && /^brouillon/.test(etats['27']),
          'les brouillons gardent la vérité d\'eBay : programmées avec leur ItemID, refusées marquées « échec », la N°27 reste un brouillon', JSON.stringify(etats));
        await photo(pg, '[data-planif-bilan]', 'ebay-planif-bilan-' + vp.width);
        await pg.getByRole('button', { name: 'Terminé' }).click();
      });
      // ── 5. LES PROGRAMMÉES, PAR JOUR ──────────────────────────────────────
      await essaie('programmées', async () => {
        await pg.waitForFunction(() => document.querySelectorAll('[data-prog]').length >= 5, null, { timeout: 10000 });
        const groupes = await pg.$$eval('[data-prog-jour]', (els) => els.map((e) => `${e.getAttribute('data-prog-jour')}:${e.querySelectorAll('[data-prog]').length}`));
        dit(groupes.join(',') === '2026-10-20:1,2026-10-23:2,2026-10-24:1,2026-10-25:1', 'les programmées sont groupées par jour (heure de Paris)', groupes.join(','));
        const statuts = await pg.$$eval('[data-prog]', (els) => els.map((e) => e.getAttribute('data-prog-statut')));
        dit(statuts.every((s) => s === 'programmee'), 'toutes « Programmée » (leur heure est à venir)', statuts.join(','));
        const dh = await pg.$eval('[data-prog-deplacer="110000000930"]', (e) => ({ dis: e.disabled, title: e.getAttribute('title') }));
        const autre = await pg.$eval('[data-prog-deplacer="110000000801"]', (e) => e.disabled).catch(() => null);
        dit(dh.dis && /moins d.une heure/.test(dh.title || '') && autre === false, '« Déplacer » est grisé, avec sa raison, pour celle qui part dans 40 minutes — et actif pour les autres', JSON.stringify(dh));
        await pg.click('[data-prog-annuler="110000000801"]');
        await feuille(pg).getByRole('button', { name: 'Oui, demander l\'annulation' }).waitFor({ timeout: 5000 });
        const t = await feuille(pg).innerText();
        dit(/n'est pas garantie/.test(t) && /Seller Hub/.test(t), 'la confirmation d\'annulation dit qu\'elle n\'est pas garantie, et où le faire sinon', t.replace(/\s+/g, ' ').slice(0, 120));
        await feuille(pg).getByRole('button', { name: 'Oui, demander l\'annulation' }).click();
        await pg.waitForSelector('[data-prog-info="110000000801"]', { timeout: 8000 });
        const info = await pg.$eval('[data-prog-info="110000000801"]', (e) => ({ t: e.textContent, refus: e.getAttribute('data-prog-refus'), lien: !!e.querySelector('a[href*="ebay.fr/sh/"]') }));
        dit(info.refus === '1' && /ne peut pas être terminée par cet appel/.test(info.t) && info.lien,
          'eBay refuse l\'annulation ⇒ SA réponse, telle quelle, et le lien vers le Seller Hub', info.t.trim().slice(0, 140));
        const d = envois.filter((e) => e.action === 'deprogrammer');
        dit(d.length === 1 && d[0].itemId === '110000000801' && d[0].confirme === true, 'l\'annulation envoyée : {action:deprogrammer, itemId, confirme:true}', JSON.stringify(d));
        await photo(pg, '[data-ebay-programmees]', 'ebay-programmees-' + vp.width);
      });
      await essaie('mise en page', async () => {
        const r = await deborde(pg);
        dit(r.sw <= r.cw + 1, 'aucun débordement horizontal', `${r.sw} > ${r.cw}`);
        const garde = await pg.evaluate(() => /n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText));
        dit(!garde && errs.length === 0, 'aucune erreur de page, aucun écran tombé sur le garde-fou', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }
    // ══ (6 octobre) LA REVUE CONTRADICTOIRE ══════════════════════════════════
    const versAnnonces = async (pg) => {
      await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(1500);
      await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 });
      await pg.waitForSelector('[data-ebay-brouillons="lu"]', { timeout: 15000 });
      await pg.waitForSelector('[data-ebay-programmees="lu"]', { timeout: 10000 }).catch(() => {});
    };
    const programmerTout = async (pg, nbFrais) => {
      await pg.waitForFunction((n) => { const b = document.querySelector('[data-planif-verifier]'); return b && !b.disabled && document.querySelectorAll('[data-planif-ligne]').length === n; }, nbFrais, { timeout: 10000 }).catch(() => {});
      await pg.click('[data-planif-verifier]');
      await pg.waitForFunction((n) => document.querySelectorAll('[data-planif-frais]').length === n, nbFrais, { timeout: 15000 }).catch(() => {});
      await pg.locator('[data-planif-compris]').evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
      await pg.check('[data-planif-compris]').catch(() => {});
      await pg.waitForFunction(() => { const b = document.querySelector('[data-planif-confirmer]'); return b && !b.disabled; }, null, { timeout: 15000 }).catch(() => {});
      const n = await pg.$eval('[data-planif-confirmer]', (e) => e.getAttribute('data-planif-confirmer')).catch(() => null);
      await pg.click('[data-planif-confirmer]', { timeout: 3000 }).catch(() => {});
      await feuille(pg).getByRole('button', { name: 'Oui, programmer' }).click({ timeout: 5000 }).catch(() => {});
      await pg.waitForSelector('[data-planif-bilan]', { timeout: 20000 }).catch(() => {});
      return n;
    };
    const brouillonsEnBase = () => ((rows.find((r) => r.id === 'ebay_brouillons') || {}).data || {}).items || {};

    // ── A. Déjà vendue ailleurs (toutes plateformes, par le N°), doublon dans
    //       le lot, SKU mal écrits ─────────────────────────────────────────
    console.log('── A. déjà vendue ailleurs · doublon dans le lot · SKU mal écrits (1512 px)');
    {
      remettre(SC_AILLEURS);
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 });
      await essaie('A', async () => {
        await versAnnonces(pg);
        await pg.click('[data-brouillons-tout]');
        await pg.click('[data-brouillons-programmer]');
        await pg.waitForSelector('[data-planif]', { timeout: 5000 });
        await pg.waitForFunction(() => !document.querySelector('[data-planif-ventes-en-cours]'), null, { timeout: 10000 }).catch(() => {});
        const exclues = await pg.$eval('[data-planif-exclues]', (e) => e.textContent).catch(() => '');
        const lignes = await pg.$$eval('[data-planif-ligne]', (els) => els.map((e) => e.getAttribute('data-planif-ligne')));
        dit(/N°22 \(déjà vendue sur eBay\)/.test(exclues), 'N°22, vendue sur eBay (commande VRM-22) : écartée, avec sa raison', exclues.replace(/\s+/g, ' ').slice(0, 260));
        dit(/N°23 \(déjà vendue sur Leboncoin\)/.test(exclues), 'N°23, vendue sur Leboncoin (reliée par son annonce, réf VRM-23) : écartée');
        dit(/N°24 \(déjà vendue sur Vinted\)/.test(exclues), 'N°24, revendue sur Vinted sous une AUTRE annonce du même N° : écartée');
        dit(/N°26 \(déjà vendue sur Vinted\)/.test(exclues), 'N°26, vendue sur Vinted, brouillon SANS pairId : écartée');
        dit(/N°25 \(un autre brouillon de la même paire/.test(exclues) && lignes.filter((x) => /^b-25/.test(x)).length === 1, 'deux brouillons de la N°25 (« 25 » et « 025 ») : UN dans le lot, l\'autre écarté avec sa raison', JSON.stringify(lignes));
        dit(/N°27 \(déjà en vente sur eBay\)/.test(exclues), 'N°27 en vente sur eBay sous « vrm-027 » : reconnue (forme canonique du SKU)');
        dit(/N°28 \(déjà programmée sur eBay/.test(exclues), 'N°28 programmée sur eBay sous « VRM 028 » : reconnue');
        dit(lignes.includes('b-21'), 'N°21 : une ancienne annonce vendue, mais la paire est REVENUE (une autre annonce en vente, pas vendue) ⇒ elle part', JSON.stringify(lignes));
        await photo(pg, '[data-planif-exclues]', 'ebay-planif-exclues-1512');
        dit(lectures.some((u) => /lbc_listings/.test(u)), 'les annonces Leboncoin ne sont lues que parce qu\'une vente ne se reliait pas sans elles');
        await programmerTout(pg, 2);
        const p = envois.filter((e) => e.action === 'programmer').map((e) => String(e.item && e.item.numero));
        dit(JSON.stringify(p.slice().sort()) === '["21","25"]', 'ce qui part chez eBay : la N°21 et UNE N°25 — rien d\'autre', JSON.stringify(p));
        await photo(pg, '[data-planif-bilan]', 'ebay-planif-ailleurs-1512');
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }

    // ── B. Second essai : le doute du premier ne s'efface pas ; l'UUID rangé
    //       en base est gardé ───────────────────────────────────────────────
    console.log('── B. coupure puis refus au second essai · UUID déjà rangé (390 px)');
    {
      remettre(SC_INCERTAIN);
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 });
      await essaie('B', async () => {
        await versAnnonces(pg);
        await pg.click('[data-brouillons-tout]');
        await pg.click('[data-brouillons-programmer]');
        await pg.waitForSelector('[data-planif]', { timeout: 5000 });
        // Un AUTRE onglet (ou un essai « incertain » d'avant) a déjà rangé un
        // identifiant d'envoi pour la N°21 : la copie de l'écran ne l'a pas.
        brouillonsEnBase()['b-21'].uuid = U1;
        await programmerTout(pg, 2);
        const p21 = envois.filter((e) => e.action === 'programmer' && String(e.item && e.item.numero) === '21');
        dit(p21.length === 2 && p21.every((e) => e.uuid === U1), 'l\'identifiant d\'envoi déjà RANGÉ en base est gardé, aux deux essais (eBay pourra dire « déjà fait », 488)', p21.map((e) => String(e.uuid).slice(0, 8)).join(' '));
        dit(brouillonsEnBase()['b-21'].uuid === U1, 'et il n\'est pas écrasé en base', String(brouillonsEnBase()['b-21'].uuid));
        const bl = await pg.$eval('[data-planif-bilan]', (e) => ({ p: e.getAttribute('data-programmees'), r: e.getAttribute('data-refusees'), i: e.getAttribute('data-incertaines'), t: e.innerText })).catch(() => ({}));
        dit(bl.i === '1' && bl.r === '0', 'N°21 : coupure puis « les frais ont changé » au second essai ⇒ INCERTAINE, jamais « refusée »', JSON.stringify({ p: bl.p, r: bl.r, i: bl.i }));
        dit(bl.p === '1' && /110000000822/.test(JSON.stringify(brouillonsEnBase()['b-22'].programme || {})) && brouillonsEnBase()['b-22'].etatBrouillon === 'programmee',
          'N°22 : coupure puis la route la RETROUVE (« déjà programmée » + son numéro) ⇒ programmée, avec son numéro d\'annonce', JSON.stringify(brouillonsEnBase()['b-22'].programme || null));
        const b21 = brouillonsEnBase()['b-21'];
        dit(!(b21.envoi && b21.envoi.ok === false), 'le brouillon de la N°21 n\'est PAS marqué « échec » (il serait reprogrammé ou republié : une seconde annonce)', JSON.stringify(b21.envoi || null));
        dit(/peut-être/.test(bl.t || '') && /frais ont changé/.test(bl.t || ''), 'le bilan le dit : « peut-être programmée », avec la réponse d\'eBay au second essai', String(bl.t || '').replace(/\s+/g, ' ').slice(0, 220));
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }

    // ── C. L'horloge avance de 31 s entre « Vérifier » et « Programmer » ─────
    console.log('── C. l\'horloge avance entre la vérification et la confirmation (1512 px)');
    {
      remettre(SC_HORLOGE);
      const { ctx, pg, errs } = await ouvrir(b, { width: 1512, height: 950 }, { horloge: SOIR });
      await essaie('C', async () => {
        await versAnnonces(pg);
        await pg.click('[data-brouillons-tout]');
        await pg.click('[data-brouillons-programmer]');
        await pg.waitForSelector('[data-planif]', { timeout: 5000 });
        await pg.waitForFunction(() => document.querySelectorAll('[data-planif-ligne]').length === 3, null, { timeout: 8000 });
        await pg.click('[data-planif-verifier]');
        await pg.waitForFunction(() => document.querySelectorAll('[data-planif-frais]').length === 3, null, { timeout: 15000 });
        const avant = await lignesPlan(pg);
        const nAvant = await pg.$eval('[data-planif-confirmer]', (e) => e.getAttribute('data-planif-confirmer'));
        await pg.clock.runFor(31000);
        await pg.waitForTimeout(600);
        const apres = await lignesPlan(pg);
        const nApres = await pg.$eval('[data-planif-confirmer]', (e) => e.getAttribute('data-planif-confirmer'));
        dit(nAvant === '3' && avant[0] && avant[0].utc === '', '19:10 à Paris, « Maintenant » : la 1ʳᵉ part tout de suite, 3 annonces vérifiées', `${nAvant} · ${avant.map((x) => x.paris).join(' | ')}`);
        dit(JSON.stringify(apres.map((x) => x.utc)) === JSON.stringify(avant.map((x) => x.utc)), '31 s plus tard (le tic du planificateur) : les heures n\'ont PAS bougé', apres.map((x) => (x.utc || 'immédiat').slice(11, 19)).join(' · '));
        dit(nApres === '3', 'et les frais vérifiés tiennent toujours : « Programmer 3 annonces », pas 1', `${nAvant} → ${nApres}`);
        await pg.locator('[data-planif-compris]').evaluate((e) => e.scrollIntoView({ block: 'center' }));
        await pg.check('[data-planif-compris]');
        await pg.click('[data-planif-confirmer]');
        await feuille(pg).getByRole('button', { name: 'Oui, programmer' }).click({ timeout: 5000 });
        await pg.waitForSelector('[data-planif-bilan]', { timeout: 20000 });
        const st = envois.filter((e) => e.action === 'programmer').map((e) => e.scheduleTime || '');
        const vu = envois.filter((e) => e.action === 'pubverify').map((e) => e.scheduleTime || '');
        dit(st.length === 3 && JSON.stringify(st) === JSON.stringify(vu), 'ce qui part est EXACTEMENT ce qui a été vérifié (mêmes heures, à la seconde)', `${st.map((x) => (x || 'immédiat').slice(11, 19)).join(' ')} / vu ${vu.map((x) => (x || 'immédiat').slice(11, 19)).join(' ')}`);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }

    // ── D. « Publier » (immédiat) : les mêmes gardes ─────────────────────────
    console.log('── D. « Publier sur eBay » : paire programmée, vendue, plus en vente ; brouillon parti entre-temps (390 px)');
    {
      remettre(SC_PUBLIER);
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 });
      const publies = () => envois.filter((e) => e.action === 'publish');
      const essayerPublier = async () => {
        await pg.waitForSelector('button:has-text("Publier sur eBay")', { timeout: 8000 });
        await pg.waitForFunction(() => !document.querySelector('[data-publier-garde="en-cours"]'), null, { timeout: 10000 }).catch(() => {});
        const g = await pg.$eval('[data-publier-garde]', (e) => ({ k: e.getAttribute('data-publier-garde'), t: e.textContent })).catch(() => ({ k: null, t: '' }));
        const dis = await pg.$eval('button:has-text("Publier sur eBay")', (e) => e.disabled).catch(() => null);
        await pg.locator('button:has-text("Publier sur eBay")').click({ force: true, timeout: 3000 }).catch(() => {});
        await pg.waitForTimeout(500);
        return { g, dis };
      };
      await essaie('D', async () => {
        await versAnnonces(pg);
        await pg.click('[data-poster="ebay"]');
        await pg.waitForSelector('button:has-text("N°21")', { timeout: 8000 });
        const marque = await pg.$eval('button:has-text("N°21")', (e) => { const b = e.querySelector('[data-paire-deja-ebay]'); return b ? b.getAttribute('data-paire-deja-ebay') + ' · ' + b.textContent : ''; }).catch(() => '');
        dit(/^programmee/.test(marque) && /déjà programmée sur eBay/.test(marque), 'le choix de la paire dit « déjà programmée sur eBay » pour la N°21 (pas seulement les annonces en ligne)', marque);
        await pg.locator('button', { hasText: 'N°21' }).first().click();
        await pg.getByRole('button', { name: 'Trouver la catégorie eBay' }).click({ timeout: 5000 });
        await pg.waitForSelector('text=Catégorie eBay', { timeout: 8000 });
        await pg.fill('input[placeholder="ex. 74"]', '95');
        let r = await essayerPublier();
        await photo(pg, '[data-publier-garde]', 'ebay-publier-garde-390');
        dit(r.g.k === 'deja-programmee' && r.dis === true && publies().length === 0, 'une paire DÉJÀ PROGRAMMÉE ne se publie pas une seconde fois : bouton grisé, la raison dite, rien n\'est envoyé', `${r.g.k} · grisé=${r.dis} · ${publies().length} publish`);
        await pg.click('[data-brouillon-modifier="b-26"]');
        await pg.waitForFunction(() => { const e = document.querySelector('[data-publier-brouillon-id]'); return e && e.getAttribute('data-publier-brouillon-id') === 'b-26'; }, null, { timeout: 8000 });
        r = await essayerPublier();
        dit(r.g.k === 'vendue' && /vendue sur Vinted/.test(r.g.t) && publies().length === 0, 'un brouillon rouvert d\'une paire VENDUE sur Vinted ne part pas', `${r.g.k} · ${r.g.t.trim().slice(0, 90)} · ${publies().length} publish`);
        await pg.click('[data-brouillon-modifier="b-24"]');
        await pg.waitForFunction(() => { const e = document.querySelector('[data-publier-brouillon-id]'); return e && e.getAttribute('data-publier-brouillon-id') === 'b-24'; }, null, { timeout: 8000 });
        r = await essayerPublier();
        dit(r.g.k === 'plus-en-vente' && publies().length === 0, 'une paire qui n\'est PLUS en vente sur Vinted (sans preuve de vente) ne part pas non plus — et c\'est dit', `${r.g.k} · ${r.g.t.trim().slice(0, 90)} · ${publies().length} publish`);
        // N°23 : son brouillon est ouvert ; il est programmé « entre-temps »
        // (depuis la liste, ou un autre onglet).
        await pg.click('[data-brouillon-modifier="b-23"]');
        await pg.waitForFunction(() => { const e = document.querySelector('[data-publier-brouillon-id]'); return e && e.getAttribute('data-publier-brouillon-id') === 'b-23'; }, null, { timeout: 8000 });
        const it = brouillonsEnBase();
        it['b-23'] = { ...it['b-23'], etatBrouillon: 'programmee', uuid: U1, programme: { itemId: '110000000823', debut: new Date(MAINTENANT + 86400000).toISOString(), sku: 'VRM-23', at: MAINTENANT } };
        const nAvant = ecritures.length;
        await pg.click('[data-publier-brouillon]');
        await pg.waitForFunction(() => { const e = document.querySelector('[data-brouillon-msg]'); return e && e.textContent.trim(); }, null, { timeout: 8000 });
        const msg = await pg.$eval('[data-brouillon-msg]', (e) => e.textContent);
        const apres = ecritures.slice(nAvant).filter((x) => x.id === 'ebay_brouillons').map((x) => (x.data.items['b-23'] || {}).etatBrouillon);
        dit(apres.length === 0 && brouillonsEnBase()['b-23'].etatBrouillon === 'programmee' && brouillonsEnBase()['b-23'].uuid === U1 && /programmé/.test(msg),
          '« Mettre à jour le brouillon » sur un brouillon programmé entre-temps : AUCUNE écriture (son état, son identifiant d\'envoi restent), et c\'est dit', `${JSON.stringify(apres)} · ${msg.trim().slice(0, 90)}`);
        // L'autre sens : une paire libre se publie toujours (écran rouvert à neuf).
        await versAnnonces(pg);
        await pg.click('[data-poster="ebay"]');
        await pg.locator('button', { hasText: 'N°25' }).first().click({ timeout: 8000 });
        await pg.getByRole('button', { name: 'Trouver la catégorie eBay' }).click({ timeout: 5000 });
        await pg.waitForSelector('text=Catégorie eBay', { timeout: 8000 });
        await pg.fill('input[placeholder="ex. 74"]', '70');
        r = await essayerPublier();
        await pg.waitForTimeout(500);
        dit(r.g.k === null && r.dis === false && publies().length === 1 && String(publies()[0].item.numero) === '25', 'l\'autre sens : la N°25, libre, se publie (on ne bloque pas tout)', `${r.g.k} · ${publies().map((x) => x.item && x.item.numero).join(',')}`);
        await photo(pg, '[data-poster], [data-publier-brouillon-id]', 'ebay-publier-gardes-390');
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      await ctx.close();
    }
    // ── LECTURE KO, ÉCRITURE OK : on n'efface JAMAIS ses brouillons ───────────
    console.log('── la ligne des brouillons ne répond plus (390 px)');
    {
      remettre(); panneBrouillons = true;
      const { ctx, pg, errs } = await ouvrir(b, { width: 390, height: 844 });
      await essaie('pas su', async () => {
        await pg.goto(`http://localhost:${PORT}/?tab=plat_ebay`, { waitUntil: 'domcontentloaded' });
        await pg.waitForTimeout(1500);
        await pg.getByRole('button', { name: 'Annonces', exact: true }).first().click({ timeout: 8000 });
        await pg.waitForSelector('[data-ebay-brouillons]', { timeout: 15000 });
        const e = await pg.$eval('[data-ebay-brouillons]', (x) => ({ etat: x.getAttribute('data-ebay-brouillons'), t: x.textContent }));
        dit(e.etat === 'pas-su' && /pas pu lire tes brouillons/.test(e.t), 'brouillons illisibles ⇒ « je n\'ai pas pu lire », jamais « aucun brouillon »', e.etat);
        // Il prépare une annonce et l'enregistre pendant la panne.
        await pg.click('[data-poster="ebay"]');
        await pg.locator('button', { hasText: 'N°21' }).first().click({ timeout: 8000 });
        await pg.fill('input[placeholder="ex. 74"]', '95').catch(() => {});
        await pg.click('[data-publier-brouillon]');
        await pg.waitForSelector('[data-brouillon-msg]', { timeout: 8000 });
        const msg = await pg.$eval('[data-brouillon-msg]', (x) => x.textContent);
        const w = ecritures.filter((x) => x.id === 'ebay_brouillons');
        dit(w.length === 0 && /rien n'a été enregistré/.test(msg) && /intacts/.test(msg),
          'la relecture échoue ⇒ RIEN n\'est écrit (ses six brouillons ne sont pas remplacés par un seul) — et on le dit', `${w.length} écriture(s) · ${msg.trim()}`);
        dit(errs.length === 0, 'aucune erreur de page', errs.join(' | ').slice(0, 160));
      });
      panneBrouillons = false;
      await ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ eBay → brouillons et planificateur : ${ko} rouge(s)` : '\n✅ eBay → brouillons et planificateur : heures exactes de Paris (changement d\'heure compris), frais lus par nom, ce qui part est exactement ce qui a été vu, et eBay a le dernier mot');
  process.exit(ko ? 1 : 0);
})();
