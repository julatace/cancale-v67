// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — UN COLIS À DEUX N° DE SUIVI : LA JONCTION PAR IDENTITÉ, LA PROPOSITION, LE LIEN CONTREDIT (17 nov.)
//  node scripts/audit-meme-colis.cjs
//  Exécute les VRAIES règles (src/memeColis.js, api/_lib/suivis-multiples.js, src/liensColis.js,
//  api/_lib/commande-colis.js, api/_lib/suivi-colis.js `liensDesLignes`) sur des données INVENTÉES :
//   A. un achat dont la liste de n° porte celui du colis Chronopost ⇒ le colis EST cet achat (app ET serveur) ;
//   B. la proposition « même colis » : seulement un colis + un achat au même point, même groupe de
//      transporteur, arrivé après l'achat, liste jamais lue, aucun autre achat en route ; chaque condition
//      retirée ⇒ aucune proposition (deux candidats ⇒ rien) ;
//   C. un lien posé à la main que la liste LUE contredit ne relie plus rien (app ET serveur) ; liste pas lue ⇒
//      rien n'est contredit.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
const imp = (p) => import(pathToFileURL(path.join(R, p)).href);
let ok = 0, ko = 0;
const dit = (b, m, d) => { if (b) ok++; else ko++; console.log((b ? '  ✅ ' : '  ❌ ') + m + (b || d == null ? '' : ' — ' + String(d).slice(0, 300))); };

(async () => {
  const { propositionsMemeColis, groupeTransporteur, liensContredits, clePasMeme } = await imp('src/memeColis.js');
  const { lienContredit, listesParAchat } = await imp('api/_lib/suivis-multiples.js');
  const { achatDuColis } = await imp('src/liensColis.js');
  const { commandeDuColisRegle } = await imp('api/_lib/commande-colis.js');
  const { liensDesLignes } = await imp('api/_lib/suivi-colis.js');
  const J = 864e5, T = Date.UTC(2026, 10, 17, 10);
  const N1 = 'SS10000001ES', N2 = 'XW200000002FR';
  const LIEU = 'Tabac du Banc, 4 place des Essais, 56000 Banc-Ville';
  const achat = { transaction_id: 31700000001, title: 'Baskets banc', date: new Date(T - 6 * J).toISOString(), _acc: { vinted_user_id: '111' } };

  console.log('── A. Tous les n° d’un achat sont ses identités (app et serveur)');
  {
    const index = { '111:31700000001': { uid: '111', suivi: N1, suivisV: [N1, N2], ligne: true } };
    dit(achatDuColis({ suivi: N2 }, [achat], index) === achat, 'le colis Chronopost (2e n° du trajet) est CET achat');
    dit(commandeDuColisRegle({ suivi: N2, code: '' }, { achats: [achat], index }) === achat, 'la jonction complète (commandeDuColisRegle) dit le même achat');
    dit(achatDuColis({ suivi: N2 }, [achat], { '111:31700000001': { uid: '111', suivi: N1 } }) === null, 'sans la liste (une ligne d’avant) : aucun lien deviné');
    const a2 = { ...achat, transaction_id: 31700000002 };
    dit(achatDuColis({ suivi: N2 }, [achat, a2], { ...index, '111:31700000002': { uid: '111', suivi: 'ZZ9', suivisV: [N2] } }) === null, 'deux achats au même n° : personne');
    const liens = liensDesLignes([{ id: 'harvest_111_suivi_31700000001', tx: '31700000001', suivi: N1, sv: `${N1},${N2}`, sl: new Date(T).toISOString() }], []);
    dit(Array.isArray(liens) && liens.some((l) => l.suivi === N2 && l.tx === '31700000001'), 'le serveur (rappels, nom de la paire) relie aussi par le 2e n°', JSON.stringify(liens));
  }

  console.log('\n── B. La proposition « C’est sans doute le même colis » — en attendant la liste, et seulement là');
  const colis1 = { cle: 'c1', suivi: N2, transporteur: 'chronopost', lieu: LIEU, arriveeMs: T - 1 * J };
  const achat1 = { cle: '111:31700000001', o: achat, lieu: 'Tabac du Banc, 4 place des Essais, 56000 Banc-Ville', transporteurs: ['Shop2Shop by Chronopost'], listeLue: false, aCode: false, dateMs: Date.parse(achat.date) };
  const base = { colis: [colis1], achats: [achat1], enRoute: [] };
  const p = (o) => propositionsMemeColis({ ...base, ...o });
  {
    const r = p({});
    dit(r.size === 1 && r.get('c1') && r.get('c1').achat === achat && r.get('c1').suivi === N2, 'un colis + un achat, même point, même groupe, arrivé après : UNE proposition', JSON.stringify([...r.keys()]));
    dit(p({ colis: [colis1, { ...colis1, cle: 'c2', suivi: 'XW300000003FR' }] }).size === 0, 'deux colis du transporteur au même point : aucune proposition');
    dit(p({ achats: [achat1, { ...achat1, cle: '111:31700000009', o: { ...achat, transaction_id: 31700000009 } }] }).size === 0, 'deux achats au même point : aucune proposition');
    dit(p({ achats: [{ ...achat1, listeLue: true }] }).size === 0, 'la liste de n° de l’achat est LUE : elle tranche, aucune proposition');
    dit(p({ achats: [{ ...achat1, aCode: true }] }).size === 0, 'l’achat a son code (une autre identité) : aucune proposition');
    dit(p({ achats: [{ ...achat1, transporteurs: ['Mondial Relay'] }] }).size === 0, 'un autre groupe de transporteur : aucune proposition');
    dit(p({ achats: [{ ...achat1, transporteurs: [] }] }).size === 0, 'transporteur de l’achat inconnu : aucune proposition');
    dit(p({ achats: [{ ...achat1, lieu: 'Autre Tabac, 56000 Banc-Ville' }] }).size === 0, 'un autre point : aucune proposition');
    dit(p({ colis: [{ ...colis1, arriveeMs: achat1.dateMs - J }] }).size === 0, 'colis arrivé AVANT l’achat : aucune proposition');
    dit(p({ colis: [{ ...colis1, arriveeMs: NaN }] }).size === 0, 'arrivée inconnue : aucune proposition');
    dit(p({ enRoute: [{ cle: '111:31700000005', lieu: LIEU, transporteurs: [] }] }).size === 0, 'un AUTRE achat en route vers ce point : aucune proposition');
    dit(p({ enRoute: [{ cle: '111:31700000005', lieu: '', transporteurs: ['CHRONOPOST'] }] }).size === 0, 'un autre achat en route, point inconnu, même groupe : aucune proposition');
    dit(p({ enRoute: [{ cle: '111:31700000005', lieu: 'Ailleurs, 75001 Paris', transporteurs: ['CHRONOPOST'] }] }).size === 1, 'un autre achat en route vers un AUTRE point : la proposition reste');
    dit(p({ enRoute: [{ cle: achat1.cle, lieu: LIEU, transporteurs: ['CHRONOPOST'] }] }).size === 1, 'l’achat candidat lui-même n’est pas « un autre »');
    dit(p({ pasMeme: new Set([clePasMeme(N2, achat1.cle)]) }).size === 0, '« Ce n’est pas le même » : plus proposé');
    dit(groupeTransporteur('SHOP2SHOP') === 'chronopost' && groupeTransporteur('chronopost') === 'chronopost' && groupeTransporteur('Mondial Relay') === 'mondialrelay' && groupeTransporteur('INPOST') === 'mondialrelay' && groupeTransporteur('Vinted Go') === 'vintedgo' && groupeTransporteur('') === '', 'les groupes de transporteur (Shop2Shop = Chronopost, InPost = Mondial Relay)');
  }

  console.log('\n── C. Un lien posé à la main que la liste LUE contredit');
  {
    const sv = { '111:31700000001': { uid: '111', tx: '31700000001', suivi: N1, suivisV: [N1, N2], listeLue: true } };
    const faux = { id: 'colis_suivi_autre_ZZ1', suivi: 'ZZ100000001FR', tx: '31700000001', uid: '111' };
    const bon = { id: 'colis_suivi_chronopost_' + N2, suivi: N2, tx: '31700000001', uid: '111' };
    dit(liensContredits(sv, [faux, bon]).map((m) => m.id).join() === faux.id, 'seul le lien dont le n° n’est pas dans la liste lue est contredit');
    dit(liensContredits({ '111:31700000001': { ...sv['111:31700000001'], listeLue: false } }, [faux]).length === 0, 'liste pas encore lue : rien n’est contredit (pas su)');
    const liens = liensDesLignes([{ id: 'harvest_111_suivi_31700000001', tx: '31700000001', suivi: N1, sv: `${N1},${N2}`, sl: new Date(T).toISOString() }], [faux, bon]);
    dit(!liens.some((l) => l.suivi === 'ZZ100000001FR'), 'le serveur ne relie plus par le lien contredit', JSON.stringify(liens));
    dit(lienContredit({ suivi: 'ZZ1X', tx: '1', uid: '' }, listesParAchat([{ id: 'harvest_111_suivi_1', suivi: 'AB12345678', sl: new Date(T).toISOString() }, { id: 'harvest_222_suivi_1', suivi: 'ZZ1X', sl: null }])) === false, 'sans compte sur le lien, une des listes pas lue : pas contredit');
  }

  console.log(`\n${ko ? '❌' : '✅'} audit-meme-colis : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
