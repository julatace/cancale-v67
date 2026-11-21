require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — 5.403 (17 nov.) : TOUS LES N° DE SUIVI D'UN ACHAT À DEUX TRANSPORTEURS
//  (node scripts/audit-suivi-multi-transporteurs.cjs [--src background.js] [--mutation nom])
//
//  Julien (17 nov., captures) : un colis arrivé au point, deux lignes dans VRM. Un envoi international à
//  deux transporteurs (« Shop2Shop by Chronopost » puis Chronopost) porte DEUX n° pour le même colis ;
//  la ligne de suivi rangée par l'extension ne gardait que celui de la première étape. Ce banc EXÉCUTE
//  le vrai `background.js` (`scripts/_fond-vm.cjs`) sur une réponse SYNTHÉTIQUE de la même forme
//  (`journey_summary.carriers[]`, `current_carrier`, `details[].carrier` — formes mesurées, valeurs
//  inventées) et exige :
//    A. la lecture active range TOUS les n° (`suivisVinted`), leurs codes transporteur, le courant, et
//       `suivisLusAt` ; `suivi` reste (compatibilité) ;
//    B. une ligne rangée AVANT (un seul n°, colis arrivé, sans `suivisLusAt`) est RELUE en priorité à
//       la visite suivante (avant, un achat arrivé avec son n° n'était plus jamais relu) — dans les
//       mêmes bornes (3 par visite, le budget « suivi ») ;
//    C. la voie passive (la page reçoit le suivi) range la liste aussi ;
//    D. un n° lu n'est jamais perdu (union) ; une ligne qui a sa liste n'est plus relue pour elle ;
//    E. une réponse sans aucune étape reconnue n'écrit RIEN (pas su).
//  `--src` : la preuve sur le code d'AVANT (§6.1) ; `--mutation` : réaffaiblir la règle ⇒ rouge.
//  Aucune donnée réelle (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { faireFond } = require('./_fond-vm.cjs');
const iS = process.argv.indexOf('--src');
const SRC = iS > 0 ? path.resolve(process.argv[iS + 1]) : path.join(__dirname, '..', 'vinted-sync-extension', 'background.js');
let bg = fs.readFileSync(SRC, 'utf8');
const MUTATIONS = {
  // la liste n'est plus lue (seul `suivi`, comme avant)
  liste: ['  const liste = [...vus.values()].slice(0, 8);', '  const liste = [];'],
  // les lignes d'avant ne sont plus relues en priorité
  relire: ['  return !!(da && !da.sl && achatExpedie(o));', '  return false;'],
  // un n° déjà rangé se perd quand la lecture suivante ne le porte plus
  union: ['    const sv = unionNumerosSuivi(r0 && r0.sv, nt ? nt.liste.map((e) => e.n) : []);', '    const sv = unionNumerosSuivi(\'\', nt ? nt.liste.map((e) => e.n) : []);'],
};
const iM = process.argv.indexOf('--mutation');
const MUT = iM > 0 ? process.argv[iM + 1] : '';
if (MUT) {
  const m = MUTATIONS[MUT]; if (!m) { console.log('mutation inconnue : ' + MUT + ' (' + Object.keys(MUTATIONS).join(', ') + ')'); process.exit(2); }
  const n = bg.split(m[0]).length - 1; if (n !== 1) { console.log(`❌ mutation ${MUT} : ancre trouvée ${n} fois`); process.exit(1); }
  bg = bg.replace(m[0], m[1]); console.log(`(mutation « ${MUT} »)`);
}
const BG = path.join(os.tmpdir(), `vrm-suivi-multi-${process.pid}.js`);
fs.writeFileSync(BG, bg);

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det != null ? ' — ' + String(det).slice(0, 300) : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`); return null; } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const H = (h) => new Date(T0 - h * 3600000).toISOString();

// ── Données INVENTÉES, de la forme mesurée ─────────────────────────────────
const TX = '31700000001', TX2 = '31700000002';
const N1 = 'SS10000001ES', N2 = 'XW200000002FR';          // première étape (Shop2Shop), puis Chronopost
const commande = (tx, status, tus, h = 96) => ({ transaction_id: Number(tx), title: `Achat banc ${tx.slice(-3)}`, status, transaction_user_status: tus, date: H(h), conversation_id: 900000 + Number(tx.slice(-3)) });
const trajet = (avecCourant = true) => ({
  journey_summary: {
    carriers: [
      { code: 'SHOP2SHOP', tracking_code: N1, tracking_url: 'https://suivi.exemple.test/a', is_current: false, priority: 1, network_party_type: 'first_mile' },
      { code: 'CHRONOPOST', tracking_code: N2, tracking_url: 'https://suivi.exemple.test/b', is_current: avecCourant, priority: 2, network_party_type: 'last_mile' },
    ],
    current_carrier: avecCourant ? { code: 'CHRONOPOST', tracking_code: N2, is_current: true } : undefined,
    details: [
      { title: 'Colis disponible au point relais', date: H(2), carrier: { code: 'CHRONOPOST', tracking_code: N2 } },
      { title: 'Colis entré dans le pays de destination', date: H(30), carrier: { code: 'CHRONOPOST', tracking_code: N2 } },
      { title: 'Colis pris en charge', date: H(80), carrier: { code: 'SHOP2SHOP', tracking_code: N1 } },
    ],
  },
});
const vinted = (corps) => (req) => {
  if (/\/journey_summary/.test(req.chemin)) return { status: 200, body: corps(req) };
  if (/\/transactions\/\d+$/.test(req.chemin)) return { status: 200, body: { transaction: { id: 1 } } };
  return { status: 200, body: { user: { id: 111 } } };
};
const lusJ = (f) => f.j.vinted.filter((v) => /journey_summary/.test(v.chemin));
const AU_POINT = 'Colis déposé en point relais';
const ligne = (f, tx) => f.lignes ? f.lignes[`harvest_111_suivi_${tx}`] : null;
const nums = (d) => String((d && d.suivisVinted) || '').split(',').filter(Boolean);

(async () => {
  try {
    // ═══ A ═══
    console.log('── A. La lecture active range TOUS les n° du trajet');
    await essaie('A', async () => {
      const lignes = { harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [commande(TX, AU_POINT, 'needs_action')] } } };
      const f = faireFond({ src: BG, lignes, vinted: vinted(() => trajet()) });
      await f.ctx.capterSuivisAchats('111');
      const d = lignes[`harvest_111_suivi_${TX}`];
      dit(!!d, 'la ligne de suivi est rangée', Object.keys(lignes).join(' '));
      dit(!!d && nums(d).includes(N1) && nums(d).includes(N2), 'les DEUX n° du trajet sont rangés (`suivisVinted`)', d && d.suivisVinted);
      dit(!!d && /SHOP2SHOP/.test(d.transporteursVinted || '') && /CHRONOPOST/.test(d.transporteursVinted || ''), 'les deux codes transporteur sont rangés', d && d.transporteursVinted);
      dit(!!d && d.suiviCourant === N2, 'le n° du transporteur COURANT est dit', d && d.suiviCourant);
      dit(!!d && !!d.suivisLusAt && Number.isFinite(Date.parse(d.suivisLusAt)), 'la liste est marquée LUE (`suivisLusAt`)', d && d.suivisLusAt);
      dit(!!d && !!d.suivi, '`suivi` reste rangé (compatibilité)', d && d.suivi);
      dit(!!d && typeof d.suivisVinted === 'string' && d.suivisVinted.length < 600, 'la liste est un SCALAIRE court (recopié dans `meta`)', typeof (d && d.suivisVinted));
    });

    // ═══ B ═══
    console.log('\n── B. Une ligne rangée AVANT la liste est relue en priorité (dans les bornes)');
    await essaie('B', async () => {
      const achats = [commande(TX, AU_POINT, 'needs_action', 96)];
      // 4 achats récents EN ROUTE sans n° : avant, ils passaient devant (et l'achat arrivé avec son n° n'était plus lu)
      for (let i = 0; i < 4; i++) achats.push(commande(String(31700000100 + i), 'Colis expédié', 'waiting', 10 + i));
      const lignes = {
        harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: achats } },
        // rangée par une version d'avant : UN n° (celui de la première étape), colis arrivé, pas de liste
        [`harvest_111_suivi_${TX}`]: { v: 1, tx: TX, source: 'passif', capturedAt: H(20), etapes: [{ t: 'Disponible pour retrait', at: H(20), code: null }], dernier: { t: 'Disponible pour retrait', at: H(20), code: null }, transporteur: null, suivi: N1, forme: {} },
      };
      const f = faireFond({ src: BG, lignes, vinted: vinted(() => trajet()) });
      await f.ctx.capterSuivisAchats('111');
      const l = lusJ(f);
      dit(l.length >= 1 && l[0].chemin.includes(TX), 'l’achat au point relais sans sa liste est relu EN PREMIER', l.map((v) => v.chemin.split('/')[4]).join(' '));
      const d = lignes[`harvest_111_suivi_${TX}`];
      dit(nums(d).includes(N1) && nums(d).includes(N2), 'sa ligne reçoit son 2e n°', d && d.suivisVinted);
      dit(f.j.vinted.filter((v) => /\/transactions\//.test(v.chemin)).length <= 3, 'toujours au plus 3 lectures par visite (le budget « suivi »)', f.j.vinted.length);
      dit(f.j.maxEnVol <= 1, 'une requête Vinted à la fois', f.j.maxEnVol);
      // D. la visite suivante (plus tard que le mémo de 3 h) : la liste est lue, l'achat arrivé ne coûte plus de lecture
      const lus1 = lusJ(f).filter((v) => v.chemin.includes(TX)).length;
      const memo = f.store.vrmSuiviFaits || {}; for (const k of Object.keys(memo)) memo[k] = Date.now() - 10 * 3600000;
      f.store.vrmSuiviLus = {};
      await f.ctx.capterSuivisAchats('111');
      const lus2 = lusJ(f).filter((v) => v.chemin.includes(TX)).length;
      dit(lus2 === lus1, 'liste lue ⇒ l’achat arrivé n’est plus relu pour elle (aucune lecture gaspillée)', `${lus1} → ${lus2}`);
    });

    // ═══ C ═══
    console.log('\n── C. La voie passive (la page reçoit le suivi) range la liste aussi');
    await essaie('C', async () => {
      const lignes = { harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [commande(TX2, AU_POINT, 'needs_action')] } } };
      const f = faireFond({ src: BG, lignes });
      const TAB = { tab: { id: 7, url: 'https://www.vinted.fr/transaction/1' }, url: 'https://www.vinted.fr/transaction/1' };
      await f.envoyer({ from: 'cancale-content', domain: 'www.vinted.fr', kind: 'suivi', quoi: 'journey', id: TX2, forme: { 'journey_summary.carriers[].tracking_code': 'string' }, allege: trajet() }, TAB);
      await pause(300);
      const d = lignes[`harvest_111_suivi_${TX2}`];
      dit(!!d && nums(d).includes(N1) && nums(d).includes(N2), 'les deux n° rangés depuis la page', d && d.suivisVinted);
      dit(!!d && d.suiviCourant === N2, 'le courant (`current_carrier`) est dit depuis la page', d && d.suiviCourant);
    });

    // ═══ D ═══
    console.log('\n── D. Un n° lu n’est jamais perdu (union)');
    await essaie('D', async () => {
      const lignes = {
        harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [commande(TX, 'Colis expédié', 'waiting')] } },
        [`harvest_111_suivi_${TX}`]: { v: 1, tx: TX, source: 'journey', capturedAt: H(20), etapes: [{ t: 'Colis pris en charge', at: H(80), code: null }], dernier: { t: 'Colis pris en charge', at: H(80), code: null }, transporteur: 'SHOP2SHOP', suivi: N1, suivisVinted: N1, transporteursVinted: 'SHOP2SHOP', suivisLusAt: H(20), forme: {} },
      };
      // la réponse suivante ne nomme plus que le transporteur courant
      const seul = { journey_summary: { carriers: [{ code: 'CHRONOPOST', tracking_code: N2, is_current: true }], details: [{ title: 'Colis entré dans le pays de destination', date: H(10), carrier: { code: 'CHRONOPOST', tracking_code: N2 } }] } };
      const f = faireFond({ src: BG, lignes, vinted: vinted(() => seul) });
      await f.ctx.capterSuivisAchats('111');
      const d = lignes[`harvest_111_suivi_${TX}`];
      dit(nums(d).includes(N1) && nums(d).includes(N2), 'les deux n° restent (le 1er n’est pas effacé par une lecture qui ne le porte plus)', d && d.suivisVinted);
    });

    // ═══ E ═══
    console.log('\n── E. Forme inconnue ⇒ rien écrit');
    await essaie('E', async () => {
      const lignes = { harvest_111_orders_purchased: { type: 'orders_purchased', payload: { my_orders: [commande(TX, AU_POINT, 'needs_action')] } } };
      const f = faireFond({ src: BG, lignes, vinted: vinted(() => ({ quelque_chose: { carriers: [{ code: 'X1', tracking_code: N2 }] } })) });
      await f.ctx.capterSuivisAchats('111');
      dit(!lignes[`harvest_111_suivi_${TX}`], 'aucune étape reconnue : aucune ligne de suivi écrite (pas su)', Object.keys(lignes).join(' '));
    });
  } finally {
    try { fs.unlinkSync(BG); } catch (_) {}
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-suivi-multi-transporteurs : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
