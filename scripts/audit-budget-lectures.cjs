// ════════════════════════════════════════════════════════════════════════════
//  L'ARGENT ET LES COLIS NE MANGENT PLUS LE BUDGET DES ACTIONS — ET PASSENT
//  AVANT LES PHOTOS (extension 5.162, 6 octobre)
//
//  MESURÉ avant de coder : `capterRetraits`, `capterDatesVersement` et
//  `capterReleves` passaient par `garde` → `compterAction`, le budget de 20
//  ACTIONS/heure partagé avec « Générer le bordereau » et les réponses — jusqu'à
//  10 créneaux par visite pour de simples LECTURES de ses propres données. Et
//  le budget de LECTURE, lui, les photos le vidaient (`tickPhotos` chaque
//  minute, jusqu'à 20 pages).
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) et on COMPTE ce qui part
//  chez Vinted et ce que chaque budget a consommé :
//   1. budget d'ACTIONS plein ⇒ codes, versements et relevés se lisent quand
//      même, et le budget d'actions ne bouge pas ;
//   2. les photos s'arrêtent avant la RÉSERVE de l'argent et des colis (10) —
//      même en tournant tout l'heure — et les lectures prioritaires y tiennent ;
//   3. la réserve se LIBÈRE quand les lecteurs prioritaires n'ont plus rien à
//      lire (l'autre sens : sinon les photos seraient bridées pour toujours) ;
//   4. « pas su » (une lecture ratée) garde la réserve de ce lecteur ;
//   5. un CLIC (publier) n'est pas bridé par la réserve ; le total ne dépasse
//      jamais 20 lectures/heure.
//  Données inventées. Usage : node scripts/audit-budget-lectures.cjs [--src f]
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const UID = '111', PID = 9001;
const FINALISEE = "Commande finalisée - l'acheteur a validé la commande";
const RELAIS = "La livraison n'a pas encore eu lieu - colis déposé en bureau de Poste ou point relais";
const html = (id) => '<!doctype html><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { item: {
  id: Number(id), description: 'desc', catalog_id: 1, photos: [0, 1, 2, 3, 4].map((i) => ({ id: i, full_size_url: `https://images1.vinted.net/t/x/f800/${id}${i}` })) } } } }) + '</script>';

function lignes({ ventes = 6, relais = 3, mois = 3, annonces = 30, datees = false } = {}) {
  const l = {
    [`harvest_${UID}_orders_sold`]: { capturedAt: new Date().toISOString(), payload: { my_orders: Array.from({ length: ventes }, (_, i) => ({ transaction_id: 5001 + i, title: 'Vente ' + i, status: FINALISEE })) } },
    [`harvest_${UID}_orders_purchased`]: { capturedAt: new Date().toISOString(), payload: { my_orders: Array.from({ length: relais }, (_, i) => ({ transaction_id: 6001 + i, conversation_id: 7001 + i, title: 'Achat ' + i, status: RELAIS })) } },
    panel_colis_relais: {},
    [`harvest_${UID}_billing`]: { payload: { history: Array.from({ length: mois }, (_, i) => ({ year: 2026, month: 9 - i })) } },
    [`harvest_${UID}_profile`]: { payload: { user: { id: PID } } },
    [`harvest_${UID}_listings`]: { payload: { items: Array.from({ length: annonces }, (_, i) => ({ id: 800 + i, nPhotos: 5, is_closed: false, is_hidden: false })) } },
    vinted_item_details: {},
  };
  if (datees) for (let i = 0; i < ventes; i++) l[`harvest_${UID}_txn_${5001 + i}`] = { payload: { transaction: { id: 5001 + i, status: 450, status_updated_at: '2026-10-01T10:00:00Z' } } };
  return l;
}
function vinted(r) {
  const c = r.chemin;
  let m;
  if ((m = /\/api\/v2\/transactions\/(\d+)$/.exec(c))) return { status: 200, body: { transaction: { id: Number(m[1]), status: 450, status_updated_at: '2026-10-01T10:00:00Z' } } };
  if (/\/api\/v2\/conversations\/\d+$/.test(c)) return { status: 200, body: { conversation: { id: 1, messages: [] } } };
  if ((m = /\/payouts\?year=(\d+)&month=(\d+)/.exec(c))) { const mm = String(m[2]).padStart(2, '0'); return { status: 200, body: { starting_date: `${m[1]}-${mm}-01`, invoice_lines_has_more: false, invoice_lines: [{ id: 1, amount: { amount: '10.0' }, date: `${m[1]}-${mm}-05`, entity_type: 'payout' }] } }; }
  if ((m = /^\/items\/(\d+)$/.exec(c))) return { status: 200, body: html(m[1]) };
  return { status: 404, body: {} };
}
const compte = (j, re) => j.vinted.filter((x) => re.test(x.chemin)).length;
const lect = (store) => ((store.vrmLectures || {})[UID] || []).length;
const actions = (store) => ((store.vrmActions || {})[UID] || []).length;
const maintenant = () => Date.now();
const prioritaires = async (ctx) => { await ctx.capterRetraits(UID); await ctx.capterDatesVersement(UID); await ctx.capterReleves(UID); };

(async () => {
  console.log('── 1. budget d’ACTIONS plein (20 bordereaux/réponses dans l’heure)');
  await essaie('budget actions plein', async () => {
    const t = maintenant();
    const f = faireFond({ src: SRC, lignes: lignes(), vinted, store: { vrmActions: { [UID]: Array.from({ length: 20 }, () => t) } } });
    await prioritaires(f.ctx);
    dit(compte(f.j, /\/conversations\/\d+$/) > 0, 'les codes de retrait se lisent quand même', `${compte(f.j, /\/conversations\/\d+$/)} conversation(s) lue(s)`);
    dit(compte(f.j, /\/transactions\/\d+$/) > 0, 'les dates de versement se lisent quand même', `${compte(f.j, /\/transactions\/\d+$/)} transaction(s) lue(s)`);
    dit(compte(f.j, /\/payouts\?year=/) > 0, 'les relevés se lisent quand même', `${compte(f.j, /\/payouts\?year=/)} relevé(s) lu(s)`);
  });
  await essaie('budget actions intact', async () => {
    const f = faireFond({ src: SRC, lignes: lignes(), vinted, store: {} });
    await prioritaires(f.ctx);
    const lu = f.j.vinted.length;
    dit(actions(f.store) === 0, 'ces lectures ne consomment AUCUNE action (bordereau, réponse gardent leurs 20)', `actions=${actions(f.store)} pour ${lu} lecture(s)`);
    dit(lect(f.store) === lu && lu > 0, 'elles sont comptées sur le budget de LECTURE, une par requête', `lectures=${lect(f.store)} · requêtes=${lu}`);
  });

  console.log('── 2. les photos s’arrêtent avant la réserve de l’argent et des colis');
  await essaie('réserve', async () => {
    const f = faireFond({ src: SRC, lignes: lignes(), vinted, store: {} });
    await f.ctx.capterPhotosAnnonces(UID);
    await f.ctx.capterPhotosAnnonces(UID);           // le fond qui tourne chaque minute
    await f.ctx.capterPhotosAnnonces(UID);
    const ph = compte(f.j, /^\/items\/\d+$/);
    dit(ph === 10, 'trente annonces à compléter, tout l’heure : 10 pages lues, pas 20 (la réserve de 10 tient)', `${ph} page(s) lue(s)`);
    const avant = f.j.vinted.length;
    await prioritaires(f.ctx);
    const pr = f.j.vinted.length - avant;
    dit(pr === 10, 'et l’argent + les colis y tiennent : 5 versements, 3 codes, 2 relevés', `${pr} lecture(s) prioritaire(s)`);
    dit(lect(f.store) <= 20, 'le plafond total de 20 lectures/heure n’est jamais dépassé', `lectures=${lect(f.store)}`);
  });

  console.log('── 3. la réserve se LIBÈRE quand il n’y a plus rien à lire');
  await essaie('libération', async () => {
    const f = faireFond({ src: SRC, lignes: lignes({ relais: 0, mois: 0, datees: true }), vinted, store: {} });
    await prioritaires(f.ctx);                          // rien à lire : chacun note « reste 0 »
    dit(f.j.vinted.length === 0, 'rien à lire : aucune requête', `${f.j.vinted.length}`);
    await f.ctx.capterPhotosAnnonces(UID);
    await f.ctx.capterPhotosAnnonces(UID);
    const ph = compte(f.j, /^\/items\/\d+$/);
    dit(ph === 20, 'les photos retrouvent tout le budget (20), la réserve n’a plus d’objet', `${ph} page(s) lue(s)`);
  });

  console.log('── 4. « pas su » garde la réserve');
  await essaie('pas su', async () => {
    // Codes et relevés : rien à lire (noté). Versements : la lecture des ventes échoue.
    const f = faireFond({ src: SRC, lignes: lignes({ relais: 0, mois: 0 }), vinted, store: {},
      lectureKO: (u) => /orders_sold/.test(u) });
    await prioritaires(f.ctx);
    await f.ctx.capterPhotosAnnonces(UID);
    await f.ctx.capterPhotosAnnonces(UID);
    const ph = compte(f.j, /^\/items\/\d+$/);
    dit(ph === 15, 'ventes illisibles : la place des 5 versements reste gardée (15 photos, pas 20)', `${ph} page(s) lue(s)`);
  });

  console.log('── 5. un clic n’est pas bridé, et le total tient');
  await essaie('clic', async () => {
    const t = maintenant();
    const f = faireFond({ src: SRC, lignes: lignes(), vinted, store: { vrmLectures: { [UID]: Array.from({ length: 10 }, () => t) } } });
    const eu = await f.ctx.completerPhotos(UID, '801');
    dit(eu === true && compte(f.j, /^\/items\/801$/) === 1, 'publier une paire va chercher SES photos même quand les photos de fond sont à la réserve', `rendu=${eu}`);
    await f.ctx.capterPhotosAnnonces(UID);
    dit(compte(f.j, /^\/items\/\d+$/) === 1, 'mais le fond, lui, ne lit plus rien au-delà de la réserve', `${compte(f.j, /^\/items\/\d+$/)} page(s)`);
  });

  console.log(`\n${ko ? '❌' : '✅'} budget des lectures : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
