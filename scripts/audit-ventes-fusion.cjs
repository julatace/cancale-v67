// ════════════════════════════════════════════════════════════════════════════
//  LES VENTES SE FUSIONNENT PAR N° DE TRANSACTION (extension 5.323, 6 nov.)
//
//  MESURÉ (lecture seule, sa base, 6 nov.) : une vente faite à 07:50 n'était pas
//  dans VRM. Le compte a 2 162 ventes chez Vinted (`total_entries`), la ligne
//  `orders_sold` en porte 2 000 (`nItems`). `rafraichirVentes` lit 8 × 40 = 320,
//  la moisson de la page 10 × 100 = 1 000 : `listePlusRiche` refusait ces
//  lectures EN SILENCE (n < 2 000) et elles comptaient « lues » quand même
//  (`ignore_partiel_orders_sold` = 1 129 chez lui).
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`), on sert la vraie FORME
//  (`my_orders` + `pagination.total_entries`, lecture projetée
//  `data->payload->my_orders`), et on lit ce qui est RANGÉ en base :
//   1. 2 162 chez Vinted, 2 000 en base (rangées il y a 2 h), une visite lit
//      320 ventes dont 1 NEUVE en tête ⇒ la vente neuve est écrite, les 2 000
//      restent (2 001), l'état frais d'une vente relue gagne ;
//   2. la même visite 10 min plus tard, rien de neuf ⇒ ni relecture de la base
//      ni réécriture ; une vente neuve ⇒ écrite tout de suite ;
//   3. la fenêtre rangée il y a plus d'une heure ⇒ relue et réécrite ;
//   4. ligne rangée illisible (522) ⇒ RIEN écrit ; aucune identité ⇒ rien écrit,
//      et ce n'est pas « lu » ; une page profonde seule ne vole pas le haut (et en
//      passif elle ne relit pas la liste : égress) ;
//      une lecture complète remplace toujours toute la liste ;
//   5. les ACHATS (`orders_purchased`) par la voie passive suivent la même règle.
//  Données inventées (dépôt public). Usage : node scripts/audit-ventes-fusion.cjs [--src f]
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };

const UID = '111', ROW = `harvest_${UID}_orders_sold`, ROWA = `harvest_${UID}_orders_purchased`;
const H = 3600000;
// Une vente inventée : n° de transaction 9 000 000 + i (le plus récent d'abord).
const vente = (i, extra = {}) => Object.assign({ transaction_id: 9000000 + i, conversation_id: 7000000 + i, title: 'Paire ' + i,
  status: 'Commande finalisée', transaction_user_status: 'completed', date: new Date(Date.parse('2026-11-05T00:00:00Z') - i * 3600000).toISOString(),
  price: { amount: '50.0', currency_code: 'EUR' }, photo: null }, extra);
// La base : 2 000 ventes (i = 1…2000), rangées il y a `ilYa` ms, total 2 162.
const rangee = (ilYa, n = 2000, total = 2162) => ({ type: 'orders_sold', uid: UID, domain: 'www.vinted.fr', capturedAt: new Date(Date.now() - ilYa).toISOString(),
  nItems: n, payload: { pagination: { current_page: 1, per_page: 100, total_pages: 22, total_entries: total }, my_orders: Array.from({ length: n }, (_, k) => vente(k + 1)) } });
// Vinted : `liste` servie page par page (per_page lu dans l'adresse), total 2 162.
const vintedVentes = (liste, total = 2162, compte = { n: 0 }) => (req) => {
  const m = /\/api\/v2\/my_orders\?type=(sold|purchased)&page=(\d+)&per_page=(\d+)/.exec(req.chemin);
  if (!m) return { status: 404, body: {} };
  compte.n++;
  const page = Number(m[2]), per = Number(m[3]);
  const lot = liste.slice((page - 1) * per, page * per);
  return { status: 200, body: { my_orders: lot, pagination: { current_page: page, per_page: per, total_pages: Math.ceil(total / per), total_entries: total } } };
};
const lignes = (f) => (f.lignes[ROW] && f.lignes[ROW].payload && f.lignes[ROW].payload.my_orders) || [];
const ecritures = (f, id = ROW) => f.j.posts.filter((p) => p.includes(id)).length;
// Les lectures de la ligne rangée (projection du payload) — l'égress que la fenêtre inchangée épargne.
const lecturesListe = (lus, id = ROW) => lus.filter((u) => u.includes(`id=eq.${id}`) && /my_orders/.test(u)).length;

function fond(opts) {
  const lus = [];
  const f = faireFond(Object.assign({ src: SRC }, opts, {
    lectureKO: (u) => { lus.push(u); return opts.lectureKO ? opts.lectureKO(u) : false; },
  }));
  return { f, lus };
}

(async () => {
  console.log('── 1. Une vente neuve en tête d’une lecture de 320, devant 2 000 rangées (il y a 2 h)');
  await essaie('fusion 320 / 2 000', async () => {
    // Chez Vinted : la vente neuve (i = 0) en tête, puis les 2 161 autres ; la n°5 a changé d'état.
    const chezVinted = [vente(0, { status: 'Le paiement a été validé', transaction_user_status: 'needs_action' })]
      .concat(Array.from({ length: 2161 }, (_, k) => (k + 1 === 5 ? vente(5, { status: 'Retour initié' }) : vente(k + 1))));
    const { f, lus } = fond({ lignes: { [ROW]: rangee(2 * H) }, vinted: vintedVentes(chezVinted) });
    const r = await f.ctx.rafraichirVentes(UID);
    const l = lignes(f);
    dit(r && r.ecrit === true, 'la lecture de 320 ventes est ÉCRITE (elle était refusée « plus pauvre »)', JSON.stringify(r));
    dit(l.length === 2001, 'les 2 000 ventes rangées restent, la neuve s’ajoute (2 001)', `${l.length} vente(s) en base`);
    dit(l[0] && l[0].transaction_id === 9000000, 'la vente neuve est en TÊTE', l[0] && String(l[0].transaction_id));
    dit(l.some((o) => o.transaction_id === 9002000), 'la plus ancienne des 2 000 (hors fenêtre lue) est toujours là');
    const v5 = l.find((o) => o.transaction_id === 9000005);
    dit(!!v5 && v5.status === 'Retour initié', 'une vente relue prend son état FRAIS (identité = n° de transaction)', v5 && v5.status);
    dit(new Set(l.map((o) => o.transaction_id)).size === l.length, 'aucune vente en double');
    dit(f.lignes[ROW].nItems === 2001, '`nItems` suit la liste rangée', String(f.lignes[ROW].nItems));
    dit(Date.now() - Date.parse(f.lignes[ROW].capturedAt) < 60000, 'la date de lecture rajeunit (« lu il y a 2 h » → maintenant)', f.lignes[ROW].capturedAt);
    dit(f.lignes[ROW].payload.pagination && f.lignes[ROW].payload.pagination.total_entries === 2162, 'le total annoncé par Vinted est gardé');
    dit((f.lignes[ROW].resume || {}).txns && f.lignes[ROW].resume.txns.includes('9000000'), 'le résumé « à expédier » (widget) voit la vente neuve', JSON.stringify(f.lignes[ROW].resume && f.lignes[ROW].resume.txns));
    dit(f.j.vinted.filter((q) => /my_orders/.test(q.chemin)).length === 8, 'aucune requête Vinted de plus (les 8 pages de toujours)', String(f.j.vinted.length));
    dit(lecturesListe(lus) === 1, 'la liste rangée est relue UNE fois (pour fusionner)', String(lecturesListe(lus)));

    console.log('── 2. La même visite 10 min plus tard');
    const lus0 = lus.length, ecr0 = ecritures(f);
    f.store.vrmDerniereVente = {};
    // 10 min ont passé : l'empreinte notée par l'extension (§4.9) a 10 min.
    for (const row of Object.keys(f.store.vrmFenetreCommandes || {})) for (const k of Object.keys(f.store.vrmFenetreCommandes[row])) f.store.vrmFenetreCommandes[row][k] -= 10 * 60000;
    const r2 = await f.ctx.rafraichirVentes(UID);
    dit(r2 && r2.ok === true && r2.ecrit === false && r2.raison === 'inchange', 'rien de neuf : la fenêtre est reconnue (« inchangée »)', JSON.stringify(r2));
    dit(ecritures(f) === ecr0, 'ni réécriture…', `${ecritures(f) - ecr0} écriture(s)`);
    dit(lecturesListe(lus.slice(lus0)) === 0, '…ni relecture des 2 001 ventes (égress épargné)', String(lecturesListe(lus.slice(lus0))));
    // Une vente de plus chez Vinted : la fenêtre change ⇒ écrite tout de suite.
    chezVinted.unshift(vente(-1));
    const r3 = await f.ctx.rafraichirVentes(UID);
    dit(r3 && r3.ecrit === true && lignes(f).length === 2002 && lignes(f)[0].transaction_id === 8999999, 'une NOUVELLE vente dans les 10 min est écrite tout de suite', `${JSON.stringify(r3)} · ${lignes(f).length}`);
  });

  console.log('── 1 bis. Par la VRAIE visite (une page vinted.fr chargée)');
  await essaie('visite', async () => {
    const chezVinted = [vente(0)].concat(Array.from({ length: 2161 }, (_, k) => vente(k + 1)));
    const { f } = fond({ lignes: { [ROW]: rangee(2 * H) }, vinted: vintedVentes(chezVinted) });
    await f.ctx.visiteVinted();
    const l = lignes(f);
    dit(l.length === 2001 && l[0].transaction_id === 9000000, 'une visite avec des ventes lues il y a 2 h range la vente du matin', `${l.length} · tête ${l[0] && l[0].transaction_id}`);
  });

  console.log('── 3. La même fenêtre, rangée par nous il y a plus d’une heure');
  await essaie('plus d’une heure', async () => {
    const chezVinted = Array.from({ length: 2162 }, (_, k) => vente(k + 1));
    const { f, lus } = fond({ lignes: { [ROW]: rangee(2 * H) }, vinted: vintedVentes(chezVinted) });
    await f.ctx.rafraichirVentes(UID);
    const ecr = ecritures(f);
    // On vieillit d'1 h 01 l'empreinte notée (le stockage de l'extension, §4.9).
    const st = f.store.vrmFenetreCommandes || {};
    for (const row of Object.keys(st)) for (const k of Object.keys(st[row])) st[row][k] -= H + 60000;
    const lus0 = lus.length;
    const r = await f.ctx.rafraichirVentes(UID);
    dit(r && r.ecrit === true && ecritures(f) === ecr + 1, 'au-delà d’une heure, la fenêtre est relue et RÉÉCRITE (lecture rajeunie)', JSON.stringify(r));
    dit(lecturesListe(lus.slice(lus0)) === 1 && lignes(f).length === 2000, 'en fusionnant (rien de perdu)', `${lignes(f).length}`);
  });

  console.log('── 4. Ce qui ne doit RIEN écrire');
  await essaie('lecture KO', async () => {
    const chezVinted = [vente(0)].concat(Array.from({ length: 2161 }, (_, k) => vente(k + 1)));
    const { f } = fond({ lignes: { [ROW]: rangee(2 * H) }, vinted: vintedVentes(chezVinted), lectureKO: (u) => u.includes(`id=eq.${ROW}`) && /my_orders/.test(u) });
    const r = await f.ctx.rafraichirVentes(UID);
    dit(ecritures(f) === 0 && lignes(f).length === 2000, 'la liste rangée illisible (522) ⇒ RIEN n’est écrit (320 n’écrasent pas 2 000)', `${JSON.stringify(r)} · ${lignes(f).length}`);
  });
  await essaie('sans identité', async () => {
    const sansTx = Array.from({ length: 40 }, (_, k) => { const o = vente(k); delete o.transaction_id; return o; });
    const { f } = fond({ lignes: { [ROW]: rangee(2 * H) }, vinted: vintedVentes(sansTx, 2162) });
    const r = await f.ctx.rafraichirVentes(UID);
    dit(ecritures(f) === 0 && r && r.ok === false && r.raison === 'forme-inconnue', 'aucune vente avec un n° de transaction ⇒ rien écrit, et pas « lu »', JSON.stringify(r));
    dit(f.j.diags.includes('ignore_commandes_sans_identite_orders_sold'), 'et c’est DIT (diagnostic)');
  });
  await essaie('page profonde seule', async () => {
    const { f } = fond({ lignes: { [ROW]: rangee(2 * H) } });
    const p3 = { pagination: { current_page: 3, per_page: 20, total_pages: 109, total_entries: 2162 },
      my_orders: [vente(45, { status: 'Retour initié' }), vente(5000)] };
    await f.ctx.storeHarvestRow(UID, 'orders_sold', p3, 'www.vinted.fr');
    const l = lignes(f);
    dit(l.length === 2001 && l[0].transaction_id === 9000001, 'une page 3 seule ne vole pas le haut de la liste', `${l.length} · tête ${l[0] && l[0].transaction_id}`);
    dit(l[44] && l[44].transaction_id === 9000045 && l[44].status === 'Retour initié', 'sa vente déjà rangée est mise à jour EN PLACE', l[44] && `${l[44].transaction_id} ${l[44].status}`);
    dit(l[l.length - 1].transaction_id === 9005000, 'une vente inconnue d’une page profonde va en queue');
  });
  await essaie('page profonde passive', async () => {
    // Il fait défiler « Mes ventes » : la page charge la page 3. En PASSIF, elle garde la
    // règle d'avant (ni relue ni réécrite la liste entière à chaque page — égress, §4.4).
    const { f, lus } = fond({ lignes: { [ROW]: rangee(2 * H) } });
    const p3 = { pagination: { current_page: 3, per_page: 20, total_pages: 109, total_entries: 2162 }, my_orders: [vente(45, { status: 'Retour initié' }), vente(5000)] };
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_sold', null, JSON.stringify(p3));
    dit(ecritures(f) === 0 && lecturesListe(lus) === 0 && lignes(f).length === 2000, 'en passif, une page profonde seule ne relit ni ne réécrit la liste (la lecture du haut la couvre)', `${ecritures(f)} écriture(s), ${lecturesListe(lus)} lecture(s)`);
  });
  await essaie('complète', async () => {
    const chezVinted = Array.from({ length: 30 }, (_, k) => vente(k + 1));
    const { f } = fond({ lignes: { [ROW]: rangee(2 * H, 40, 40) }, vinted: vintedVentes(chezVinted, 30) });
    await f.ctx.rafraichirVentes(UID);
    dit(lignes(f).length === 30, 'une lecture COMPLÈTE (n ≥ total) remplace toujours toute la liste, comme avant', String(lignes(f).length));
  });

  console.log('── 5. Les achats, par la voie passive (la page charge « Mes achats »)');
  await essaie('achats', async () => {
    const base = { type: 'orders_purchased', uid: UID, capturedAt: new Date(Date.now() - 20 * H).toISOString(), nItems: 1985,
      payload: { pagination: { current_page: 1, per_page: 100, total_entries: 1990 }, my_orders: Array.from({ length: 1985 }, (_, k) => vente(k + 1)) } };
    const { f } = fond({ lignes: { [ROWA]: base } });
    const p1 = { pagination: { current_page: 1, per_page: 20, total_pages: 100, total_entries: 1990 }, my_orders: [vente(0, { status: 'Colis déposé au point relais' })].concat(Array.from({ length: 19 }, (_, k) => vente(k + 1))) };
    await f.ctx.storeHarvest('www.vinted.fr', 'orders_purchased', null, JSON.stringify(p1));
    const l = (f.lignes[ROWA].payload.my_orders) || [];
    dit(l.length === 1986 && l[0].transaction_id === 9000000, 'l’achat neuf de la page 1 (20) est rangé devant les 1 985 gardés', `${l.length}`);
  });

  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'} · ${ok} ✅`);
  process.exit(ko ? 1 : 0);
})();
