// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LES STATISTIQUES DES OFFRES DISENT CE QUE VRM SAIT, ET RIEN DE PLUS
//         node scripts/audit-stats-offres.cjs [--mutation=contre|moteur|aumoins0|lecture|lot|sys|acheteur|periode|centimes]
// ═══════════════════════════════════════════════════════════════════════════
// Exécute src/statsOffres.js sur des conversations et des transactions
// INVENTÉES, à la FORME mesurée le 4 nov. sur sa base (lecture seule) :
//   · conversation : messages[] avec `offer_request_message` (entity.status
//     10/20/30/40, offer_request_id, user_id, created_at_ts au niveau du
//     message) et `offer_message` (sa contre-offre : user_id = lui) ;
//   · transaction projetée par PostgREST (`->>` rend du TEXTE) : sys 'false',
//     op '37.0', ic '1', ip '39.0', oc/icur 'EUR'.
// Vérifie : une offre comptée une fois, seulement celles de l'acheteur côté
// vendeur ; la contre-offre = refus PUIS son offre ; « au moins » dès que la
// période dépasse la dernière lecture, « — » si rien n'est lu (jamais « au
// moins 0 ») ; « par le moteur » toujours « — » (aucun journal en base) ; la
// remise = prix affiché − prix conclu, une seule paire, même devise ; un lot
// sort de la couverture ; les centimes justes ; puis le branchement dans App.jsx.
const fs = require('fs'), path = require('path'), os = require('os');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; if (!c || process.env.BAVARD) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
let MOD = lire('src/statsOffres.js');
const APP = lire('src/App.jsx');
const JSX = lire('src/design/CarteOffres.jsx');
const muter = (avant, apres) => { if (!MOD.includes(avant)) { console.log('❌ mutation impossible : motif absent — ' + avant.slice(0, 90)); process.exit(2); } MOD = MOD.replace(avant, apres); };
if (MUT === 'contre') muter("if (x.entity_type === 'offer_message' && x.entity && x.entity.user_id != null && String(x.entity.user_id) !== opp) { etat = 'contre'; break; }", '');
else if (MUT === 'moteur') muter('      parMoteur: null,\n', '      parMoteur: o(g.acceptees),\n');
else if (MUT === 'aumoins0') muter('const rienOffres = !offresLues || (partielOffres && g.recues === 0);', 'const rienOffres = !offresLues;');
else if (MUT === 'lecture') muter('const partielOffres = !offresLues ? false : !(Number.isFinite(lu) && lu >= fin);', 'const partielOffres = false;');
else if (MUT === 'lot') muter("if (ic > 1) return { etat: 'lot', remise: null };", '');
else if (MUT === 'sys') muter("if (sys || cents(op) === cents(ip)) return { etat: 'sans', remise: 0 };", "if (cents(op) === cents(ip)) return { etat: 'sans', remise: 0 };");
else if (MUT === 'acheteur') muter("if (e.user_id == null || String(e.user_id) !== opp || e.offer_request_id == null) continue;", 'if (e.offer_request_id == null) continue;');
else if (MUT === 'periode') muter('if (o.ts == null || o.ts < de || o.ts >= a) continue;', 'if (o.ts == null) continue;');
else if (MUT === 'centimes') muter("g.cout = (cents(g.cout) + cents(v.remise)) / 100;", 'g.cout = g.cout + v.remise;');
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
const charger = async (texte, nom) => {
  const tmp = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, texte);
  try { return await import('file://' + tmp); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
};
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
function extraire(src, nom) {
  const m = new RegExp(`^(?:export )?(?:async )?function ${nom}\\(|^(?:export )?const ${nom}\\s*=\\s*`, 'm').exec(src);
  if (!m) return '';
  const estFn = /function/.test(m[0]); let prof = 0, vuCorps = false;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vuCorps = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vuCorps && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1);
  }
  return '';
}

(async () => {
  let M = null;
  if (MOD) { try { M = await charger(MOD, 'stats-offres'); } catch (e) { dit(false, 'src/statsOffres.js se charge', e.message); } }
  dit(!!M && typeof M.statsOffres === 'function' && typeof M.offresDeConversation === 'function' && typeof M.venteParOffre === 'function', 'le module des offres existe (src/statsOffres.js)');
  if (!M) { console.log(`\n❌ stats-offres : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }

  // ── Les données inventées, à la forme mesurée ─────────────────────────────
  const LUI = '9001', A1 = '501', A2 = '502';
  const d = (j, h = 12) => new Date(Date.UTC(2026, 9, j, h)).toISOString().replace('Z', '+00:00');   // octobre
  const req = (id, user, st, j, prix = '40.0', orig = '50.0') => ({ id: 'm' + id, entity_type: 'offer_request_message', created_at_ts: d(j), entity: { offer_request_id: id, transaction_id: 7000 + id, user_id: Number(user), status: st, status_title: st === 20 ? '- Offre acceptée' : st === 30 ? 'Refusée' : st === 40 ? 'Annulée' : 'En attente', price: { amount: prix, currency_code: 'EUR' }, original_price: { amount: orig, currency_code: 'EUR' }, current: true } });
  const sienne = (j, prix = '45.0') => ({ id: 'o' + j, entity_type: 'offer_message', created_at_ts: d(j, 13), entity: { user_id: Number(LUI), price: { amount: prix, currency_code: 'EUR' }, original_price: { amount: '50.0', currency_code: 'EUR' }, current: true } });
  const msg = (user, j) => ({ id: 'x' + j, entity_type: 'message', created_at_ts: d(j, 14), entity: { user_id: Number(user), body: 'ok ?' } });
  const CONVS = [
    // compte « 11 » : acceptée (2 oct.), refusée puis contre-offre (5 oct.), refusée sèche (6 oct.), en attente (8 oct.)
    { compte: '11', side: 'seller', opp: A1, messages: [req(1, A1, 20, 2), msg(A1, 2)] },
    { compte: '11', side: 'seller', opp: A2, messages: [req(2, A2, 30, 5), sienne(5), msg(A2, 5), req(3, A2, 30, 6)] },
    { compte: '11', side: 'seller', opp: A1, messages: [req(4, A1, 10, 8)] },
    // la même offre captée deux fois (deux messages, même id) : l'état le plus frais (le dernier) gagne, comptée UNE fois
    { compte: '11', side: 'seller', opp: A1, messages: [req(5, A1, 10, 9), req(5, A1, 20, 9)] },
    // une offre faite PAR LUI quand il achète (côté acheteur) : pas une offre reçue
    { compte: '11', side: 'buyer', opp: A2, messages: [req(6, LUI, 20, 10)] },
    // une « demande » portée par lui-même côté vendeur (forme impossible) : ignorée
    { compte: '11', side: 'seller', opp: A2, messages: [req(7, LUI, 20, 10)] },
    // septembre : hors période
    { compte: '11', side: 'seller', opp: A1, messages: [{ ...req(8, A1, 20, 1), created_at_ts: '2026-09-28T12:00:00+00:00' }] },
    // compte « 22 » : une annulée (3 oct.), lu seulement jusqu'au 4 octobre
    { compte: '22', side: 'seller', opp: A1, messages: [req(9, A1, 40, 3)] },
  ];
  const DE = Date.UTC(2026, 9, 1), A = Date.UTC(2026, 10, 1), MAINT = Date.UTC(2026, 10, 4);
  const LECT = { 11: Date.UTC(2026, 10, 2), 22: Date.UTC(2026, 9, 4), 33: Date.UTC(2026, 9, 18) };
  const T = (j) => Date.UTC(2026, 9, j, 15);
  const VENTES = [
    { plateforme: 'Vinted', ts: T(2), uid: '11', compte: 'alice', tx: '101' },   // par offre : 50 → 49.9 (0,10)
    { plateforme: 'Vinted', ts: T(3), uid: '11', compte: 'alice', tx: '102' },   // par offre : 30 → 29.8 (0,20)
    { plateforme: 'Vinted', ts: T(4), uid: '11', compte: 'alice', tx: '103' },   // sans offre (système)
    { plateforme: 'Vinted', ts: T(5), uid: '11', compte: 'alice', tx: '104' },   // lot de 2 : pas jugé
    { plateforme: 'Vinted', ts: T(6), uid: '22', compte: 'bruno', tx: '105' },   // transaction pas lue
    { plateforme: 'Vinted', ts: T(7), uid: '22', compte: 'bruno', tx: '106' },   // par offre : 25 → 20 (5,00)
    { plateforme: 'Vinted', ts: T(8), uid: '22', compte: 'bruno', tx: '107' },   // livre sterling : illisible
    { plateforme: 'Vinted', ts: Date.UTC(2026, 8, 30), uid: '11', compte: 'alice', tx: '108' },   // septembre
  ];
  const TXN = {
    101: { sys: 'false', op: '49.9', oc: 'EUR', ic: '1', ip: '50.0', icur: 'EUR' },
    102: { sys: 'false', op: '29.8', oc: 'EUR', ic: '1', ip: '30.0', icur: 'EUR' },
    103: { sys: 'true', op: '45.0', oc: 'EUR', ic: '1', ip: '45.0', icur: 'EUR' },
    104: { sys: 'false', op: '70.0', oc: 'EUR', ic: '2', ip: '40.0', icur: 'EUR' },
    106: { sys: 'false', op: '20.0', oc: 'EUR', ic: '1', ip: '25.0', icur: 'EUR' },
    107: { sys: 'false', op: '20.0', oc: 'GBP', ic: '1', ip: '25.0', icur: 'GBP' },
    108: { sys: 'false', op: '10.0', oc: 'EUR', ic: '1', ip: '99.0', icur: 'EUR' },
  };

  console.log('── 1. Une conversation');
  const o2 = M.offresDeConversation(CONVS[1]);
  dit(o2.length === 2 && o2.find((o) => o.id === '2').etat === 'contre' && o2.find((o) => o.id === '3').etat === 'refusee', 'refus PUIS son offre = contre-offre ; refus sans offre ensuite = refusée', JSON.stringify(o2));
  const o5 = M.offresDeConversation(CONVS[3]);
  dit(o5.length === 1 && o5[0].etat === 'acceptee', 'la même offre captée deux fois compte une fois, état le plus frais', JSON.stringify(o5));
  dit(M.offresDeConversation(CONVS[4]).length === 0 && M.offresDeConversation(CONVS[5]).length === 0, 'côté acheteur, ou portée par lui : pas une offre reçue');
  dit(M.offresDeConversation(null).length === 0 && M.offresDeConversation({ side: 'seller', opp: A1, messages: 'x' }).length === 0, 'forme illisible ⇒ aucune offre (jamais une fausse)');

  console.log('── 2. Une vente');
  const v1 = M.venteParOffre({ sys: 'false', op: '40.1', oc: 'EUR', ic: '1', ip: '50.0', icur: 'EUR' });
  dit(v1.etat === 'offre' && v1.remise === 9.9, 'prix affiché 50 €, conclu 40,10 € ⇒ remise 9,90 €', JSON.stringify(v1));
  dit(M.venteParOffre(TXN[103]).etat === 'sans' && M.venteParOffre({ sys: 'true', op: '40.0', oc: 'EUR', ic: '1', ip: '50.0', icur: 'EUR' }).etat === 'sans', '`is_system` vrai ⇒ sans offre (un prix fixé par Vinted n’est pas une offre négociée)');
  dit(M.venteParOffre(TXN[104]).etat === 'lot', 'un lot n’est pas jugé (remise de lot ≠ offre)');
  dit(M.venteParOffre(TXN[107]).etat === 'illisible' && M.venteParOffre({ sys: 'false', op: '60', ic: '1', ip: '50' }).etat === 'illisible', 'autre devise, ou prix conclu au-dessus du prix affiché ⇒ illisible');
  dit(M.venteParOffre(undefined).etat === 'pasLue' && M.venteParOffre({ sys: null, op: '1', ic: '1', ip: '2' }).etat === 'illisible', 'transaction pas lue ⇒ « pas lue », `is_system` absent ⇒ illisible');

  console.log('── 3. La période, par compte');
  const S = M.statsOffres({ convs: CONVS, lectures: LECT, ventes: VENTES, txn: TXN, de: DE, a: A, maintenant: MAINT });
  const c11 = S.comptes.find((c) => c.compte === '11'), c22 = S.comptes.find((c) => c.compte === '22'), c33 = S.comptes.find((c) => c.compte === '33');
  dit(c11 && c11.recues === 5 && c11.acceptees === 2 && c11.refusees === 1 && c11.contre === 1 && c11.attente === 1, 'compte 11 : 5 reçues · 2 acceptées · 1 refusée · 1 contre-offre · 1 en attente (septembre et côté acheteur hors compte)', JSON.stringify(c11));
  dit(c11 && !c11.partielOffres, 'compte lu après la fin de la période ⇒ complet');
  dit(c22 && c22.recues === 1 && c22.annulees === 1 && c22.partielOffres === true && c22.luJusqua === LECT[22], 'compte 22 lu jusqu’au 4 oct. ⇒ « au moins », la date de lecture dite', JSON.stringify(c22));
  dit(c33 && c33.recues === null && c33.acceptees === null, 'compte 33 lu jusqu’au 18 oct., aucune offre lue ⇒ « — » (jamais « au moins 0 »)', JSON.stringify(c33));
  dit(S.comptes.every((c) => c.parMoteur === null) && S.total.parMoteur === null, 'acceptées par le moteur : « — » partout (le moteur ne garde aucun journal en base)');
  dit(c11.ventes === 4 && c11.lues === 3 && c11.lots === 1 && c11.parOffre === 2 && c11.cout === 0.3 && c11.remiseMoy === 0.15 && c11.partielVentes, 'compte 11 : 4 ventes, 3 lues (1 lot), 2 par offre, 0,30 € de remises (0,10 + 0,20 au centime, jamais 0,30000000000000004), 0,15 € en moyenne, « au moins »', JSON.stringify(c11));
  dit(c22.ventes === 3 && c22.lues === 1 && c22.illisibles === 2 && c22.cout === 5 && c22.parOffre === 1, 'compte 22 : transaction pas lue et livre sterling sortent de la couverture', JSON.stringify(c22));
  dit(S.total.cout === 5.3 && S.total.parOffre === 3 && S.total.lues === 4 && S.total.ventes === 7 && S.total.partielVentes, 'le total = la somme des comptes, « au moins », couverture 4/7', JSON.stringify(S.total));
  dit(S.total.partielOffres === true, 'un compte « au moins » ⇒ le total aussi');
  const S2 = M.statsOffres({ convs: null, lectures: null, ventes: null, txn: null, de: DE, a: A, maintenant: MAINT });
  dit(S2.total.recues === null && S2.total.cout === null && S2.total.parOffre === null && !S2.offresLues && !S2.ventesLues, 'rien de lu ⇒ « — » partout (jamais 0)');
  const S3 = M.statsOffres({ convs: [], lectures: { 11: MAINT }, ventes: VENTES, txn: {}, de: DE, a: A, maintenant: MAINT });
  dit(S3.total.cout === null && S3.total.parOffre === null, 'transactions lues mais aucune de ces ventes : « — », pas « 0 € »', JSON.stringify(S3.total));
  const S4 = M.statsOffres({ convs: CONVS, lectures: LECT, ventes: VENTES, txn: TXN, de: Date.UTC(2026, 10, 1), a: Date.UTC(2026, 11, 1), maintenant: MAINT });
  const n11 = S4.comptes.find((c) => c.compte === '11');
  dit(n11 && n11.recues === null && n11.partielOffres === false, 'novembre, lu jusqu’au 2 nov. sans offre lue ⇒ « — »', JSON.stringify(n11));

  console.log('── 4. Le branchement (lu dans le code, commentaires retirés)');
  const APPs = sansCommentaires(APP);
  const vf = extraire(APPs, 'ventesFaites');
  dit(/plateforme: 'Vinted'[^\n]*uid: String\(\(o\._acc && o\._acc\.vinted_user_id\) \|\| ''\), tx: tx != null \? String\(tx\) : ''/.test(vf), 'les lignes Vinted du « vendu » portent leur transaction et l’identité du compte');
  const conv = /const OFFRES_STATS_CONV = ([^\n]+)\n\s*\+ ([^\n]+);/.exec(APPs);
  dit(!!conv && /cs\./.test(conv[1]) && /current_user_side=eq\.seller/.test(conv[2]) && !/select=data[,&]|select=data'/.test(conv[2]), 'conversations : filtrées par la base (une offre, côté vendeur), projetées — jamais `select=data`');
  const txn = /const OFFRES_STATS_TXN = '([^']+)'/.exec(APPs);
  dit(!!txn && /offer->>is_system/.test(txn[1]) && /order->items->0->price->>amount/.test(txn[1]) && /order->>item_count/.test(txn[1]) && !/select=data(,|$)/.test(txn[1]), 'transactions : `is_system`, prix conclu, prix affiché, nombre de paires — projetés');
  const lo = extraire(APPs, 'lireOffresStats');
  dit(/lireTout\(OFFRES_STATS_CONV, \{ strict: true \}\)/.test(lo) && /Array\.isArray\(rc\) && Array\.isArray\(rl\) \?/.test(lo) && /Date\.parse\(r\.cap/.test(lo), 'une lecture ratée ⇒ null ; la dernière lecture vient de `capturedAt` (jamais `updated_at`)');
  dit(/statsOffres\(\{ convs, lectures, ventes, txn: offresBrut\.txn, de: b\.de, a: b\.a, maintenant \}\)/.test(APPs) && /compteEcarte\(uid, hAcc, panelOff \|\| \{\}\)/.test(APPs) && /IntersectionObserver/.test(APPs), 'Statistiques : la période choisie, les comptes écartés, lu quand la carte paraît');
  const jsx = sansCommentaires(JSX);
  dit(/v == null \? '—'/.test(jsx) && /Acceptées par le moteur : —/.test(jsx) && /lu jusqu’au/.test(jsx), 'la carte écrit « — » pour pas su, et nomme la dernière lecture');

  console.log(`\n${ko ? '❌' : '✅'} stats-offres : ${ko} rouge(s), ${ok} vert(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
