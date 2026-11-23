require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — 5.411 (21 nov.) : LE POINT RELAIS OÙ VA ARRIVER UN ACHAT
//  (node scripts/audit-relais-dest.cjs [--src background.js] [--mutation nom])
//
//  Julien : « l'extension peut essayer de capter le nom des points relais dans lesquels les colis vont arriver
//  pour pouvoir prévoir ». MESURÉ (lecture seule, 21 nov.) : aucune des 49 lignes de suivi n'avait de point ; le
//  suivi (`journey_summary`) n'en porte pas ; l'expédition d'une commande (`escrow_orders/{id}/shipment`) porte
//  `pickup_point_name`, `pickup_point_address`, `carrier.name`, `receiver_id` (forme PLATE) et était jetée.
//  Ce banc EXÉCUTE le vrai `background.js` (`scripts/_fond-vm.cjs`) et le bloc `<suivi-regle>` du vrai inject.js
//  sur des réponses de CETTE forme (valeurs inventées — dépôt public) et exige :
//    R. la règle lit la forme plate (nom, rue, code postal, ville ; « , France » en fin) ; un nom exigé ;
//       la période `estimated_detail.time_period` est lue ; deux points ⇒ rien ;
//    P. voie passive : la page d'une commande ⇒ la ligne `harvest_{uid}_suivi_{tx}` reçoit le point, même sans
//       étape ; la transaction est trouvée par IDENTITÉ (`transaction.order.id`), jamais deux ; un destinataire
//       qui n'est pas ce compte (une vente) ⇒ rien ; pas de point ⇒ rien ;
//    A. voie active : un achat en route sans point lit l'expédition de SA commande (id de commande lu, jamais
//       deviné), dans les mêmes bornes (une requête à la fois, ≤ 3 par visite) ; la période est rangée ;
//       une lecture de la base ratée n'écrit rien.
//  `--src` : la preuve sur le code d'AVANT (§6.1) ; `--mutation` : réaffaiblir la règle ⇒ rouge.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { faireFond } = require('./_fond-vm.cjs');
const iS = process.argv.indexOf('--src');
const SRC = iS > 0 ? path.resolve(process.argv[iS + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const INJ = path.join(path.dirname(SRC), 'inject.js');
let bg = fs.readFileSync(SRC, 'utf8');
const MUTATIONS = {
  // la forme plate n'est plus lue (le code d'avant)
  plate: ["    if (!interdit && typeof v.pickup_point_name === 'string') {", "    if (false) {"],
  // le destinataire n'est plus vérifié (une VENTE donnerait le point de l'acheteur)
  destinataire: ["  if (rc && rc !== String(uid)) { noterDiag('suivi_relais_pas_le_destinataire'); return null; }", "  if (false) { return null; }"],
  // deux transactions pour la même commande : la première est prise
  identite: ["    return txs.length === 1 && achats && achats.has(txs[0]) ? txs[0] : '';", "    return txs.length >= 1 && achats && achats.has(txs[0]) ? txs[0] : '';"],
  // un point lu sans étape n'ouvre plus la ligne (le code d'avant)
  sansEtape: ["    const relaisNeuf = !!rel && (!r0 || lieuChange);", "    const relaisNeuf = false;"],
  // la voie active ne lit plus l'expédition
  actif: ["        const oid = await commandeDeTx(uid, tx);", "        const oid = '';"],
};
const iM = process.argv.indexOf('--mutation');
const MUT = iM > 0 ? process.argv[iM + 1] : '';
if (MUT) {
  const m = MUTATIONS[MUT]; if (!m) { console.log('mutation inconnue : ' + MUT + ' (' + Object.keys(MUTATIONS).join(', ') + ')'); process.exit(2); }
  const n = bg.split(m[0]).length - 1; if (n !== 1) { console.log(`❌ mutation ${MUT} : ancre trouvée ${n} fois`); process.exit(1); }
  bg = bg.replace(m[0], m[1]); console.log(`(mutation « ${MUT} »)`);
}
const BG = path.join(os.tmpdir(), `vrm-relais-dest-${process.pid}.js`);
fs.writeFileSync(BG, bg);

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det != null ? ' — ' + String(det).slice(0, 300) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const H = (h) => new Date(T0 - h * 3600000).toISOString();

// La règle de la PAGE (le bloc <suivi-regle> du vrai inject.js), pour fabriquer le message comme la page le fait.
const RI = (() => {
  try {
    const t = fs.readFileSync(INJ, 'utf8'); const i = t.indexOf('// <suivi-regle>'), j = t.indexOf('// </suivi-regle>');
    if (i < 0 || j < i) return null;
    const noms = ['allegerSuivi', 'relaisDestination', 'periodeEstimeeSuivi', 'formeSuivi'].filter((n) => new RegExp('function ' + n + '\\(').test(t.slice(i, j)));
    return vm.runInContext(t.slice(i, j) + `\n;({ ${noms.join(', ')} })`, vm.createContext({ console }));
  } catch (e) { console.log('inject.js illisible : ' + e.message); return null; }
})();

// ── Données INVENTÉES, de la forme mesurée ─────────────────────────────────
const UID = '111', TX = '31800000001', TX2 = '31800000002', OID = '7700000001', OID2 = '7700000002';
const commande = (tx, status, tus, h = 30) => ({ transaction_id: Number(tx), title: `Achat banc ${tx.slice(-3)}`, status, transaction_user_status: tus, date: H(h), conversation_id: 900000 + Number(tx.slice(-3)) });
const txn = (tx, oid) => ({ type: 'transaction', payload: { transaction: { id: Number(tx), status: 230, order: { id: Number(oid), transaction_id: Number(tx), title: 'banc' }, shipment: { id: Number('55' + tx.slice(-6)), status: 200, status_title: 'banc' } } } });
// L'expédition d'une commande, forme PLATE mesurée dans `panel_formes_suivi.escrow` (valeurs inventées).
const expedition = ({ nom = 'Tabac du Banc', adresse = '12 Rue du Banc, 35000 Rennes, France', receveur = Number(UID), transp = 'Relais Banc' } = {}) => ({
  id: 5500000001, code: 0, type: 1, status: 200, sender_id: 222, entry_type: 1, pickup_type: 2, receiver_id: receveur,
  carrier: { icon: 'https://exemple.test/i.png', name: transp, reservation_link: null, drop_off_point_url: null, drop_off_map_available: false },
  to_address_id: null, pickup_point_name: nom, shipping_order_id: 6600000001, pickup_point_address: adresse,
});
// Le suivi (`journey_summary`), forme mesurée (valeurs inventées) : étapes, transporteurs, `estimated_detail`.
const trajet = (periode = '24 – 26 nov.') => ({ code: 0, journey_summary: {
  status: 'in_transit', user_side: 'buyer', actions: [],
  carriers: [{ code: 'BANC', tracking_code: 'BN10000001FR', tracking_url: 'https://suivi.exemple.test/a', is_current: true, priority: 1, logo_url: 'https://exemple.test/l.png', network_party_type: 'last_mile' }],
  current_carrier: { code: 'BANC', tracking_code: 'BN10000001FR', is_current: true, priority: 1, logo_url: 'https://exemple.test/l.png', tracking_url: 'https://suivi.exemple.test/a', network_party_type: 'last_mile' },
  details: [{ status: 'in_transit', message: 'Colis en transit', timestamp: H(6), cell_type: 'event', delivery_information: null, carrier: { code: 'BANC', tracking_code: 'BN10000001FR' } },
    { status: 'picked_up', message: 'Colis pris en charge', timestamp: H(20), cell_type: 'event', delivery_information: null, carrier: { code: 'BANC', tracking_code: 'BN10000001FR' } }],
  estimated_detail: periode ? { status: 'estimated', message: null, time_period: periode } : null,
} });
const ligne = (lignes, tx) => lignes[`harvest_${UID}_suivi_${tx}`];
const TAB = { tab: { id: 7, url: 'https://www.vinted.fr/transaction/1' }, url: 'https://www.vinted.fr/transaction/1' };
const msgEscrow = (oid, j) => {
  const m = { from: 'cancale-content', domain: 'www.vinted.fr', kind: 'suivi', quoi: 'escrow', id: oid, forme: RI.formeSuivi(j), allege: RI.allegerSuivi(j) };
  const rl = RI.relaisDestination(j); if (rl) m.relais = rl;
  if (j.receiver_id != null) m.receveur = String(j.receiver_id);
  if (j.carrier && j.carrier.name) m.transp = j.carrier.name;
  return m;
};

(async () => {
  try {
    console.log('── R. La règle lit la forme PLATE de l’expédition (inject.js, la page)');
    await essaie('R', async () => {
      dit(!!RI && typeof RI.relaisDestination === 'function', 'le bloc <suivi-regle> d’inject.js se charge');
      const r = RI.relaisDestination(expedition());
      dit(!!r && r.nom === 'Tabac du Banc' && r.rue === '12 Rue du Banc' && r.cp === '35000' && r.ville === 'Rennes', 'nom, rue, code postal, ville lus (« , France » retiré)', JSON.stringify(r));
      dit(RI.relaisDestination({ ...expedition(), pickup_point_name: null }) === null, 'sans nom de point ⇒ rien (pas su)');
      dit(RI.relaisDestination({ a: expedition(), b: expedition({ nom: 'Autre Tabac', adresse: '3 Rue Autre, 29200 Brest' }) }) === null, 'deux points différents ⇒ rien (on ne choisit pas)');
      dit(RI.relaisDestination({ sender: expedition() }) === null, 'un point sous l’EXPÉDITEUR ⇒ rien');
      dit(typeof RI.periodeEstimeeSuivi === 'function' && RI.periodeEstimeeSuivi(trajet()) === '24 – 26 nov.', 'la période d’arrivée `estimated_detail.time_period` est lue', RI.periodeEstimeeSuivi && RI.periodeEstimeeSuivi(trajet()));
      dit(typeof RI.periodeEstimeeSuivi === 'function' && RI.periodeEstimeeSuivi(trajet(null)) === null, 'sans période ⇒ rien');
    });

    console.log('\n── P. Voie passive : la page d’une commande range le point de l’ACHAT');
    await essaie('P1', async () => {
      const lignes = { [`harvest_${UID}_orders_purchased`]: { type: 'orders_purchased', payload: { my_orders: [commande(TX, 'Colis expédié', 'waiting')] } }, [`harvest_${UID}_txn_${TX}`]: txn(TX, OID) };
      const f = faireFond({ src: BG, lignes });
      await f.envoyer(msgEscrow(OID, expedition()), TAB);
      await pause(300);
      const d = ligne(lignes, TX);
      dit(!!d, 'une ligne de suivi est ouverte pour l’achat (sans étape)', Object.keys(lignes).join(' '));
      dit(!!d && d.relaisNom === 'Tabac du Banc' && d.relaisRue === '12 Rue du Banc' && d.relaisCp === '35000' && d.relaisVille === 'Rennes', 'le point de destination est rangé en SCALAIRES', d && JSON.stringify([d.relaisNom, d.relaisRue, d.relaisCp, d.relaisVille]));
      dit(!!d && d.transporteur === 'Relais Banc', 'le transporteur de l’expédition est rangé', d && d.transporteur);
      dit(!!d && Array.isArray(d.etapes) && d.etapes.length === 0 && d.dernier == null, 'aucune étape inventée', d && JSON.stringify(d.etapes));
      dit(!!d && !!d.lieuLuAt, '`lieuLuAt` daté', d && d.lieuLuAt);
      dit(f.j.vinted.length === 0, 'voie passive : AUCUNE requête Vinted', f.j.vinted.length);
    });
    await essaie('P2', async () => {
      const lignes = { [`harvest_${UID}_orders_purchased`]: { type: 'orders_purchased', payload: { my_orders: [commande(TX, 'Colis expédié', 'waiting')] } }, [`harvest_${UID}_txn_${TX}`]: txn(TX, OID) };
      const f = faireFond({ src: BG, lignes });
      await f.envoyer(msgEscrow(OID, expedition({ receveur: 999 })), TAB);
      await pause(300);
      dit(!ligne(lignes, TX), 'un DESTINATAIRE qui n’est pas le compte de l’onglet (une vente) ⇒ rien', JSON.stringify(ligne(lignes, TX)));
    });
    await essaie('P3', async () => {
      const lignes = { [`harvest_${UID}_orders_purchased`]: { type: 'orders_purchased', payload: { my_orders: [commande(TX, 'Colis expédié', 'waiting'), commande(TX2, 'Colis expédié', 'waiting')] } },
        [`harvest_${UID}_txn_${TX}`]: txn(TX, OID), [`harvest_${UID}_txn_${TX2}`]: txn(TX2, OID) };
      const f = faireFond({ src: BG, lignes });
      await f.envoyer(msgEscrow(OID, expedition()), TAB);
      await pause(300);
      dit(!ligne(lignes, TX) && !ligne(lignes, TX2), 'deux transactions pour la même commande ⇒ personne (identité unique)', Object.keys(lignes).filter((k) => /suivi/.test(k)).join(' '));
    });
    await essaie('P4', async () => {
      const lignes = { [`harvest_${UID}_orders_purchased`]: { type: 'orders_purchased', payload: { my_orders: [commande(TX, 'Colis expédié', 'waiting')] } }, [`harvest_${UID}_txn_${TX}`]: txn(TX, OID2) };
      const f = faireFond({ src: BG, lignes });
      await f.envoyer(msgEscrow(OID, expedition()), TAB);
      await f.envoyer(msgEscrow(OID2, { ...expedition(), pickup_point_name: null, pickup_point_address: null }), TAB);
      await pause(300);
      dit(!ligne(lignes, TX), 'commande d’aucun achat, ou point pas dit ⇒ rien d’écrit', JSON.stringify(ligne(lignes, TX)));
    });

    console.log('\n── A. Voie active : un achat en route lit l’expédition de SA commande');
    await essaie('A1', async () => {
      const lignes = { [`harvest_${UID}_orders_purchased`]: { type: 'orders_purchased', payload: { my_orders: [commande(TX, 'Colis expédié', 'waiting')] } }, [`harvest_${UID}_txn_${TX}`]: txn(TX, OID) };
      const vinted = (req) => {
        if (/\/journey_summary$/.test(req.chemin)) return { status: 200, body: trajet() };
        if (new RegExp(`/escrow_orders/${OID}/shipment$`).test(req.chemin)) return { status: 200, body: expedition() };
        if (/\/transactions\/\d+$/.test(req.chemin)) return { status: 200, body: { transaction: { id: Number(TX) } } };
        return { status: 404, body: {} };
      };
      const f = faireFond({ src: BG, lignes, vinted });
      await f.ctx.capterSuivisAchats(UID);
      const d = ligne(lignes, TX);
      const lus = f.j.vinted.map((v) => v.chemin);
      dit(lus.some((c) => c.endsWith(`/escrow_orders/${OID}/shipment`)), 'l’expédition est lue par l’identifiant de SA commande (lu, jamais deviné)', lus.join(' '));
      dit(!!d && d.relaisNom === 'Tabac du Banc' && d.relaisCp === '35000', 'le point est rangé sur la ligne de suivi', d && JSON.stringify([d.relaisNom, d.relaisCp]));
      dit(!!d && d.arriveePeriode === '24 – 26 nov.', 'la période d’arrivée écrite par Vinted est rangée (`arriveePeriode`)', d && d.arriveePeriode);
      dit(!!d && d.etapes && d.etapes.length >= 1, 'les étapes du suivi restent rangées', d && JSON.stringify(d.etapes));
      dit(f.j.maxEnVol <= 1, 'une requête Vinted à la fois', f.j.maxEnVol);
      dit(lus.length <= 3, 'au plus 3 lectures pour cette visite (le budget « suivi »)', lus.length);
      dit(f.j.vinted.every((v) => !v.methode || v.methode === 'GET'), 'des lectures seulement (GET)', f.j.vinted.map((v) => v.methode).join(','));
      // la visite suivante : le point est connu, l'expédition n'est plus relue
      const memo = f.store.vrmSuiviFaits || {}; for (const k of Object.keys(memo)) memo[k] = Date.now() - 10 * 3600000;
      const avant = f.j.vinted.length;
      await f.ctx.capterSuivisAchats(UID);
      dit(!f.j.vinted.slice(avant).some((v) => /escrow_orders/.test(v.chemin)), 'point déjà connu ⇒ l’expédition n’est plus relue', f.j.vinted.slice(avant).map((v) => v.chemin).join(' '));
    });
    await essaie('A2', async () => {
      const lignes = { [`harvest_${UID}_orders_purchased`]: { type: 'orders_purchased', payload: { my_orders: [commande(TX, 'Colis expédié', 'waiting')] } } };
      const vinted = (req) => /\/journey_summary$/.test(req.chemin) ? { status: 200, body: trajet() } : /escrow_orders/.test(req.chemin) ? { status: 200, body: expedition() } : { status: 404, body: {} };
      const f = faireFond({ src: BG, lignes, vinted });
      await f.ctx.capterSuivisAchats(UID);
      dit(!f.j.vinted.some((v) => /escrow_orders/.test(v.chemin)), 'sans la transaction rangée (id de commande inconnu) ⇒ aucune requête devinée', f.j.vinted.map((v) => v.chemin).join(' '));
      const d = ligne(lignes, TX);
      dit(!d || !d.relaisNom, 'et aucun point', d && d.relaisNom);
    });
    await essaie('A3', async () => {
      const lignes = { [`harvest_${UID}_orders_purchased`]: { type: 'orders_purchased', payload: { my_orders: [commande(TX, 'Colis expédié', 'waiting')] } }, [`harvest_${UID}_txn_${TX}`]: txn(TX, OID) };
      const vinted = (req) => /\/journey_summary$/.test(req.chemin) ? { status: 200, body: trajet() } : /escrow_orders/.test(req.chemin) ? { status: 200, body: expedition({ receveur: 999 }) } : { status: 404, body: {} };
      const f = faireFond({ src: BG, lignes, vinted });
      await f.ctx.capterSuivisAchats(UID);
      const d = ligne(lignes, TX);
      dit(!!d && !d.relaisNom, 'voie active, destinataire qui n’est pas ce compte ⇒ suivi rangé, AUCUN point', d && d.relaisNom);
    });
    await essaie('A4', async () => {
      const lignes = { [`harvest_${UID}_orders_purchased`]: { type: 'orders_purchased', payload: { my_orders: [commande(TX, 'Colis expédié', 'waiting')] } }, [`harvest_${UID}_txn_${TX}`]: txn(TX, OID) };
      const f = faireFond({ src: BG, lignes, lectureKO: (u) => /_suivi_31800000001&select=d:/.test(u) });
      await f.envoyer(msgEscrow(OID, expedition()), TAB);
      await pause(300);
      dit(!ligne(lignes, TX), 'la relecture de la ligne ratée ⇒ RIEN d’écrit (lire-fusionner-réécrire gardé)', JSON.stringify(ligne(lignes, TX)));
    });
  } finally {
    try { fs.unlinkSync(BG); } catch (_) {}
    console.log(`\n${ko ? '❌' : '✅'} audit-relais-dest : ${ok} vert(s), ${ko} rouge(s)`);
    process.exit(ko ? 1 : 0);
  }
})();
