require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — 5.449 (24 nov.) : L'EXPÉDITION D'UNE COMMANDE, À SA FORME RÉELLE
//  (node scripts/audit-suivi-escrow-forme.cjs [--src background.js] [--mutation nom | --prouve])
//
//  MESURÉ en production (lecture seule) : sur CHAQUE appareil, de la 5.410 à la 5.440, le compteur
//  `suivi_forme_inattendue_escrow` égale `suivi_vu_escrow` (1 à 11 par jour et par appareil) : la réponse de
//  `GET /api/v2/escrow_orders/{id}/shipment` n'était JAMAIS reconnue, le suivi de ces achats jamais rangé.
//  Sa forme (clés de tête et types, `harvest_*_seen_urls` → `conversation.req[…].tete`, 4 comptes, hôtes www et
//  core, identiques) : un objet PLAT — `id`, `code`, `type`, `status`, `sender_id`, `receiver_id`, `entry_type`,
//  `shipping_order_id` nombres ; `carrier` {`name`, `icon` textes, `reservation_link`, `drop_off_point_url` null,
//  `drop_off_map_available` booléen} ; `pickup_type`, `to_address_id`, `pickup_point_name`, `pickup_point_address`
//  null. La 5.411 ne l'acceptait qu'avec un point (`pickup_point_name` texte) : jamais le cas mesuré.
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) et la vraie règle de la page (`<suivi-regle>` d'inject.js) :
//    E1  la forme mesurée, l'achat de CE compte (destinataire = compte de l'onglet) ⇒ la ligne de suivi est ouverte
//        avec le transporteur, aucune étape ni point inventés ; la forme est « reconnue » ; plus de « inattendue » ;
//    E2  le destinataire est un AUTRE membre (une vente) ⇒ rien rangé, et ce n'est pas une forme inattendue ;
//    E3  une clé de plus / un type différent / une clé absente / l'objet sous `shipment` ⇒ « inattendue », rien rangé ;
//    E4  la relecture de la ligne ratée ⇒ rien écrit ; une ligne qui a déjà son transporteur n'est pas réécrite ;
//    E5  voie active (`capterSuivisAchats`) : la même forme lue pour un achat en route ⇒ transporteur rangé, forme reconnue.
//  Valeurs INVENTÉES (dépôt public). `--src` : la preuve sur le code d'AVANT (§6.1).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const iS = process.argv.indexOf('--src');
const SRC = iS > 0 ? path.resolve(process.argv[iS + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
const INJ = path.join(path.dirname(SRC), 'inject.js');
let bg = fs.readFileSync(SRC, 'utf8');
const MUTATIONS = {
  // la forme mesurée n'est plus reconnue (la 5.440)
  forme: ["    if (!contrat && quoi === 'escrow' && formeEscrowMesuree(forme)) {", "    if (false) {"],
  // le destinataire n'est plus comparé (une VENTE rangerait le transporteur de l'acheteur)
  destinataire: ["      if (String(msg.receveur == null ? '' : msg.receveur) !== String(uid)) {", "      if (false) {"],
  // une clé de plus est acceptée (une forme inconnue rangée)
  'cle-en-plus': ["  if (cles.length !== attendues.length) return false;", ""],
  // un type différent est accepté
  'type-libre': ["    if (!String(f[k]).split('|').every((t) => FORME_ESCROW_MESUREE[k].includes(t))) return false;", ""],
  // le transporteur seul n'ouvre plus la ligne
  ouverture: [" || (!r0 && source === 'escrow' && contrat.transporteur)", ""],
  // voie active : la forme mesurée n'est plus lue
  actif: ["const fe = formeSuivi(re.json), mesuree = !autreTx && formeEscrowMesuree(fe) && String(ex.receiver_id) === String(uid);", "const fe = formeSuivi(re.json), mesuree = false;"],
};
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation', m], { encoding: 'utf8' });
    const rouge = r.status === 1 && /❌ /.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`);
    if (!rouge) rate++;
  }
  process.exit(rate ? 1 : 0);
}
const iM = process.argv.indexOf('--mutation');
const MUT = iM > 0 ? process.argv[iM + 1] : '';
if (MUT) {
  const m = MUTATIONS[MUT]; if (!m) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  const n = bg.split(m[0]).length - 1; if (n !== 1) { console.log(`❌ mutation ${MUT} : ancre trouvée ${n} fois`); process.exit(1); }
  bg = bg.replace(m[0], m[1]); console.log(`(mutation « ${MUT} »)`);
}
const BG = path.join(os.tmpdir(), `vrm-escrow-forme-${process.pid}.js`);
fs.writeFileSync(BG, bg);
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det != null ? ' — ' + String(det).slice(0, 300) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const RI = (() => {
  const t = fs.readFileSync(INJ, 'utf8'); const i = t.indexOf('// <suivi-regle>'), j = t.indexOf('// </suivi-regle>');
  const noms = ['allegerSuivi', 'relaisDestination', 'periodeEstimeeSuivi', 'formeSuivi'].filter((n) => new RegExp('function ' + n + '\\(').test(t.slice(i, j)));
  return vm.runInContext(t.slice(i, j) + `\n;({ ${noms.join(', ')} })`, vm.createContext({ console }));
})();
const UID = '111', TX = '31800000001', OID = '7700000001';
const H = (h) => new Date(Date.now() - h * 3600000).toISOString();
const commande = (tx) => ({ transaction_id: Number(tx), title: 'Achat banc', status: 'Colis expédié', transaction_user_status: 'waiting', date: H(30), conversation_id: 900001 });
const txn = (tx, oid) => ({ type: 'transaction', payload: { transaction: { id: Number(tx), status: 230, order: { id: Number(oid), transaction_id: Number(tx), title: 'banc' }, shipment: { id: 5500001, status: 200, status_title: 'banc' } } } });
// LA FORME MESURÉE (clés et types exacts ; valeurs inventées) — livraison à domicile : aucun point.
const reelle = (o = {}) => Object.assign({
  id: 5500000001, code: 0, type: 1, status: 200, carrier: { icon: 'https://exemple.test/i.png', name: 'Colis Banc', reservation_link: null, drop_off_point_url: null, drop_off_map_available: false },
  sender_id: 222, entry_type: 1, pickup_type: null, receiver_id: Number(UID), to_address_id: null, pickup_point_name: null, shipping_order_id: 6600000001, pickup_point_address: null,
}, o);
// Le message de la page, fabriqué par le vrai code de la page (inject.js, noteSuivi).
const msgEscrow = (oid, j) => {
  const m = { from: 'cancale-content', domain: 'www.vinted.fr', kind: 'suivi', quoi: 'escrow', id: oid, forme: RI.formeSuivi(j), allege: RI.allegerSuivi(j) };
  const rl = RI.relaisDestination(j); if (rl) m.relais = rl;
  const o = (j.shipment && typeof j.shipment === 'object') ? j.shipment : j;
  if (o.receiver_id != null) m.receveur = String(o.receiver_id);
  if (o.carrier && typeof o.carrier.name === 'string') m.transp = o.carrier.name;
  return m;
};
const TAB = { tab: { id: 7, url: 'https://www.vinted.fr/transaction/1' }, url: 'https://www.vinted.fr/transaction/1' };
const base = () => ({ [`harvest_${UID}_orders_purchased`]: { type: 'orders_purchased', payload: { my_orders: [commande(TX)] } }, [`harvest_${UID}_txn_${TX}`]: txn(TX, OID) });
const ligne = (l) => l[`harvest_${UID}_suivi_${TX}`];
const formes = (l) => (l.panel_formes_suivi || {}).escrow || null;
(async () => {
  try {
    console.log('── E1. La forme mesurée, un achat de CE compte');
    await essaie('E1', async () => {
      const l = base(); const f = faireFond({ src: BG, lignes: l });
      await f.envoyer(msgEscrow(OID, reelle()), TAB); await pause(300);
      const d = ligne(l);
      dit(!!d, 'la ligne de suivi de l’achat est ouverte', Object.keys(l).join(' '));
      dit(!!d && d.transporteur === 'Colis Banc', 'le transporteur est rangé', d && d.transporteur);
      dit(!!d && Array.isArray(d.etapes) && d.etapes.length === 0 && d.dernier == null && !d.relaisNom && !d.suivi, 'aucune étape, aucun point, aucun n° inventés', d && JSON.stringify([d.etapes, d.relaisNom, d.suivi]));
      dit(!f.j.diags.includes('suivi_forme_inattendue_escrow'), 'plus de « forme inattendue »', f.j.diags.join(','));
      dit(f.j.diags.includes('suivi_vu_escrow'), 'la réponse est bien vue', f.j.diags.join(','));
      const fs2 = formes(l); dit(!!fs2 && fs2.etat === 'reconnue', 'la forme est rangée « reconnue »', JSON.stringify(fs2 && fs2.etat));
      dit(f.j.vinted.length === 0, 'aucune requête Vinted (voie passive)', f.j.vinted.length);
    });
    console.log('\n── E2. Le destinataire est un autre membre (une vente)');
    await essaie('E2', async () => {
      const l = base(); const f = faireFond({ src: BG, lignes: l });
      await f.envoyer(msgEscrow(OID, reelle({ receiver_id: 999, sender_id: Number(UID) })), TAB); await pause(300);
      dit(!ligne(l), 'rien rangé', JSON.stringify(ligne(l)));
      dit(!f.j.diags.includes('suivi_forme_inattendue_escrow') && f.j.diags.includes('suivi_escrow_pas_le_destinataire'), 'ce n’est pas une forme inattendue, c’est une vente', f.j.diags.join(','));
    });
    console.log('\n── E3. Toute autre forme reste « inattendue » (rien rangé)');
    const autres = {
      'une clé de plus (tracking_code)': reelle({ tracking_code: 'XX123' }),
      'id en texte': reelle({ id: 'a5500000001' }),
      'receiver_id absent': (() => { const o = reelle(); delete o.receiver_id; return o; })(),
      'transporteur sans nom': reelle({ carrier: { icon: null, name: null, reservation_link: null, drop_off_point_url: null, drop_off_map_available: false } }),
      'sous `shipment`': { shipment: reelle() },
    };
    for (const [nom, j] of Object.entries(autres)) {
      await essaie('E3 ' + nom, async () => {
        const l = base(); const f = faireFond({ src: BG, lignes: l });
        await f.envoyer(msgEscrow(OID, j), TAB); await pause(250);
        dit(!ligne(l) && f.j.diags.includes('suivi_forme_inattendue_escrow'), `${nom} ⇒ « inattendue », rien rangé`, JSON.stringify([ligne(l) && ligne(l).transporteur, f.j.diags.filter((x) => /escrow/.test(x))]));
      });
    }
    console.log('\n── E4. Lire-fusionner-réécrire');
    await essaie('E4a', async () => {
      const l = base(); const f = faireFond({ src: BG, lignes: l, lectureKO: (u) => /_suivi_31800000001&select=d:/.test(u) });
      await f.envoyer(msgEscrow(OID, reelle()), TAB); await pause(300);
      dit(!ligne(l), 'la relecture de la ligne ratée ⇒ rien écrit', JSON.stringify(ligne(l)));
    });
    await essaie('E4b', async () => {
      const l = base(); l[`harvest_${UID}_suivi_${TX}`] = { v: 1, tx: TX, source: 'journey', capturedAt: H(5), etapes: [{ t: 'Colis en transit', at: H(5), code: null }], dernier: { t: 'Colis en transit', at: H(5), code: null }, n: 1, transporteur: 'Autre', suivi: 'BN1FR' };
      const avant = JSON.stringify(ligne(l)); const f = faireFond({ src: BG, lignes: l });
      await f.envoyer(msgEscrow(OID, reelle()), TAB); await pause(300);
      dit(JSON.stringify(ligne(l)) === avant, 'une ligne qui a déjà ses étapes et son transporteur n’est pas touchée', JSON.stringify(ligne(l)));
    });
    console.log('\n── E5. Voie active : la même forme, lue pour un achat en route');
    await essaie('E5', async () => {
      const l = base();
      const trajet = { code: 0, journey_summary: { status: 'in_transit', user_side: 'buyer', actions: [], details: [{ status: 'in_transit', message: 'Colis en transit', timestamp: H(6), cell_type: 'event' }] } };
      const vinted = (req) => /\/journey_summary$/.test(req.chemin) ? { status: 200, body: trajet } : new RegExp(`/escrow_orders/${OID}/shipment$`).test(req.chemin) ? { status: 200, body: reelle() } : /\/transactions\/\d+$/.test(req.chemin) ? { status: 200, body: { transaction: { id: Number(TX) } } } : { status: 404, body: {} };
      const f = faireFond({ src: BG, lignes: l, vinted });
      await f.ctx.capterSuivisAchats(UID);
      const d = ligne(l);
      dit(f.j.vinted.some((v) => /escrow_orders/.test(v.chemin)), 'l’expédition est lue', f.j.vinted.map((v) => v.chemin).join(' '));
      dit(!!d && d.transporteur === 'Colis Banc', 'le transporteur de l’expédition est rangé', d && d.transporteur);
      const fs2 = formes(l); dit(!!fs2 && fs2.etat === 'reconnue', 'la forme est « reconnue »', JSON.stringify(fs2 && fs2.etat));
    });
  } finally {
    try { fs.unlinkSync(BG); } catch (_) {}
    console.log(`\n${ko ? '❌' : '✅'} audit-suivi-escrow-forme : ${ok} vert(s), ${ko} rouge(s)`);
    process.exit(ko ? 1 : 0);
  }
})();
