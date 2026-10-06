// ⚠️⚠️ LE BILAN DE LA SEMAINE — UNE RÈGLE, CELLE DE L'APP, ET DES TOTAUX QUI DISENT S'ILS SONT PARTIELS
//
// Julien, 5 octobre : un bilan de la semaine en notification (vendu, reçu,
// colis à expédier, paires qui dorment). Le serveur ne peut pas importer
// src/App.jsx ; il porte donc un MIROIR des règles (api/_lib/ventes-regle.js).
// Ce contrôle prouve que le miroir n'est pas une seconde règle :
//   1. chaque déclaration du miroir est, au JETON près (commentaires et blancs
//      mis à part), celle d'App.jsx — l'analyseur Babel, jamais une recopie ;
//   2. exécutées sur les MÊMES ventes, les deux rendent la MÊME chose ;
//   3. la condition des dates de versement est celle de `fetchVersementsVinted` ;
//   4. la semaine est bornée à l'heure de PARIS (lundi 00:00 → lundi 00:00),
//      y compris la semaine du passage à l'heure d'hiver ;
//   5. un total PARTIEL se dit partiel et NOMME ce qui manque (§5) — et c'est
//      la DONNÉE qui déclenche (un compte lu jeudi, Leboncoin illisible…),
//      jamais une formulation attendue ;
//   6. « bilan » est une catégorie de notification, activée par défaut, la même
//      des deux côtés (Réglages → notifications ⇄ api/_lib/push.js).
//
//   node scripts/audit-bilan-semaine.cjs            → le contrôle
//   node scripts/audit-bilan-semaine.cjs --recopie  → refabrique le miroir depuis App.jsx
// Aucune donnée réelle : tout est inventé ici.
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };

let parser;
try { parser = require(path.join(R, 'node_modules', '@babel', 'parser')); }
catch (e) { console.log('❌ analyseur Babel introuvable — ' + e.message); process.exit(1); }

const NOMS = ['classifyOrderStatus', 'tsCommande', 'montantCommande', 'lbcAnnulee', 'lbcFinalisee', 'venteFinalisee', 'ymDeTs', 'ventesDeclarables', 'ventesFaites', 'compteEcarte'];
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return null; } };
// Les déclarations de premier niveau `const X = …` d'un fichier, par nom.
function declarations(src, plugins) {
  const out = {};
  if (src == null) return out;
  const ast = parser.parse(src, { sourceType: 'module', plugins, errorRecovery: true, tokens: true });
  for (const n of ast.program.body) {
    const d0 = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
    if (!d0 || d0.type !== 'VariableDeclaration') continue;
    for (const d of d0.declarations) {
      const nom = d.id && d.id.name;
      if (!nom || out[nom]) continue;
      const jetons = ast.tokens.filter((t) => t.start >= d.start && t.end <= d.end && t.type !== 'CommentLine' && t.type !== 'CommentBlock')
        .map((t) => (t.type && t.type.label ? t.type.label : t.type) + ':' + (t.value === undefined ? '' : String(t.value)));
      out[nom] = { texte: 'const ' + src.slice(d.start, d.end) + ';', jetons: jetons.join(' ') };
    }
  }
  return out;
}
const app = lire('src/App.jsx');
const declApp = declarations(app, ['jsx']);

// ── --recopie : refabrique le miroir (le seul moyen de le modifier) ─────────
if (process.argv.includes('--recopie')) {
  const miroir = lire('api/_lib/ventes-regle.js') || '';
  const tete = miroir.slice(0, Math.max(0, miroir.indexOf('export const ')));
  let corps = tete;
  for (const n of NOMS) { if (!declApp[n]) { console.log(`❌ ${n} introuvable dans App.jsx`); process.exit(1); } corps += 'export ' + declApp[n].texte + '\n\n'; }
  fs.writeFileSync(path.join(R, 'api/_lib/ventes-regle.js'), corps.replace(/\n+$/, '\n'));
  console.log(`✅ miroir refabriqué (${NOMS.length} déclarations)`);
  process.exit(0);
}

(async () => {
  console.log('── 1. Le miroir est la règle de l’app, au jeton près');
  const declSrv = declarations(lire('api/_lib/ventes-regle.js'), []);
  for (const n of NOMS) {
    dit(!!declApp[n] && !!declSrv[n] && declApp[n].jetons === declSrv[n].jetons,
      `${n} : identique dans App.jsx et api/_lib/ventes-regle.js`,
      !declSrv[n] ? 'absent du serveur' : !declApp[n] ? 'absent de l’app' : declApp[n].jetons === declSrv[n].jetons ? '' : 'le code diffère — `--recopie` après avoir vérifié la règle de l’app');
  }

  // Les règles de l'APP, exécutées telles quelles.
  const ctxApp = vm.createContext({});
  for (const n of NOMS) { if (declApp[n]) try { vm.runInContext(declApp[n].texte + `\nthis.${n} = ${n};`, ctxApp); } catch (_) {} }
  let srv = {}, bil = {}, pushLib = {};
  try { srv = await import('file://' + path.join(R, 'api', '_lib', 'ventes-regle.js')); } catch (e) { dit(false, 'api/_lib/ventes-regle.js se charge', e.message); }
  try { bil = await import('file://' + path.join(R, 'api', '_lib', 'bilan-semaine.js')); } catch (e) { dit(false, 'api/_lib/bilan-semaine.js se charge', e.message); }

  console.log('\n── 2. Exécutées sur les mêmes ventes, elles rendent la même chose');
  const J = 86400000, T0 = Date.parse('2026-09-30T12:00:00Z');
  const vinted = [
    { transaction_id: 1, title: 'a', status: 'Commande finalisée', date: new Date(T0).toISOString(), price: { amount: '40.0', currency_code: 'EUR' }, _acc: { vinted_user_id: '11' } },
    { transaction_id: 2, title: 'b', status: 'Le paiement a été validé', date: new Date(T0 + J).toISOString(), price: { amount: '25,50' }, _acc: { vinted_user_id: '11' } },
    { transaction_id: 3, title: 'c', status: 'Remboursement effectué', date: new Date(T0).toISOString(), price: { amount: '99' }, _acc: { vinted_user_id: '11' } },
    { transaction_id: 4, title: 'd', status: 'Commande finalisée', date: new Date(T0 - 9 * J).toISOString(), price: 30, _acc: { vinted_user_id: '22' } },
    { transaction_id: 1, title: 'doublon', status: 'Commande finalisée', date: new Date(T0).toISOString(), price: { amount: '40' }, _acc: { vinted_user_id: '11' } },
    { transaction_id: 5, title: 'masquée', status: 'Commande finalisée', date: new Date(T0).toISOString(), price: { amount: '12' }, _acc: { vinted_user_id: '33' } },
  ];
  const lbc = [
    { txId: 'L1', isSeller: true, price: 5000, dateVente: new Date(T0).toISOString(), stepStatus: 'done' },
    { txId: 'L2', isSeller: true, price: 2000, stepStatus: 'done' },
    { txId: 'L3', isSeller: false, price: 7000, dateVente: new Date(T0).toISOString() },
    { txId: 'L4', isSeller: true, price: 1000, dateVente: new Date(T0).toISOString(), stepStatus: 'cancelled' },
  ];
  const ebay = [
    { orderId: 'E1', orderPaymentStatus: 'PAID', creationDate: new Date(T0).toISOString(), pricingSummary: { total: { value: '61.20', currency: 'EUR' } } },
    { orderId: 'E2', orderPaymentStatus: 'PAID', creationDate: new Date(T0).toISOString(), pricingSummary: { total: { value: '10', currency: 'GBP' } } },
  ];
  const versements = { 1: new Date(T0 + 2 * J).toISOString() };
  const masques = new Set(['33']);
  const cachee = (o) => o.transaction_id === 5;
  const exclu = (o) => masques.has(String(o._acc && o._acc.vinted_user_id));
  const sansObjets = (x) => JSON.stringify(x, (k, v) => (k === 'o' ? undefined : v));
  await essaie('ventesFaites', async () => {
    const a = ctxApp.ventesFaites({ vinted, lbc, ebay, cachee }), b = srv.ventesFaites({ vinted, lbc, ebay, cachee });
    dit(sansObjets(a) === sansObjets(b) && a.lignes.length > 0, 'ventesFaites : même résultat (app = serveur)', `${a.lignes.length} lignes · sans date ${a.sansDate}`);
  });
  await essaie('ventesDeclarables', async () => {
    const a = ctxApp.ventesDeclarables({ vinted, lbc, ebay, exclu, versements }), b = srv.ventesDeclarables({ vinted, lbc, ebay, exclu, versements });
    dit(sansObjets(a) === sansObjets(b) && a.lignes.length > 0, 'ventesDeclarables : même résultat (app = serveur)', `${a.lignes.length} lignes · à dater ${a.aDater.length} · écartées ${a.ecartees.length}`);
  });
  await essaie('compteEcarte', async () => {
    const cas = [['1', new Set(['1']), {}], ['1', new Set(['1']), { 1: false }], ['2', new Set(), { 2: true }], ['3', null, null]];
    dit(cas.every(([u, m, p]) => ctxApp.compteEcarte(u, m, p) === srv.compteEcarte(u, m, p)), 'compteEcarte : même réponse (masqué, rallumé exprès, éteint au panneau)');
  });

  console.log('\n── 3. Les dates de versement : la condition de l’app');
  const bilSrc = lire('api/_lib/bilan-semaine.js') || '';
  // La condition entre « for (const r of rows) if ( » et « ) map[ », côté serveur.
  const iC = bilSrc.indexOf('for (const r of rows) if (');
  const cond = iC < 0 ? '' : bilSrc.slice(iC + 'for (const r of rows) if ('.length, bilSrc.indexOf(') map[', iC));
  const fv = (/const fetchVersementsVinted = async \(\) => \{([\s\S]*?)\n\};/.exec(app || '') || [])[1] || '';
  dit(!!cond && fv.includes(cond), 'versementsDeLignes reprend la condition exacte de fetchVersementsVinted (statut 450, date lisible)', cond ? cond.slice(0, 80) : 'condition introuvable côté serveur');
  await essaie('versementsDeLignes', async () => {
    const m = bil.versementsDeLignes([{ tx: '9', s: '450', su: '2026-10-01T10:00:00Z' }, { tx: '8', s: '400', su: '2026-10-01T10:00:00Z' }, { tx: '7', s: '450', su: 'n/a' }]);
    dit(m && m['9'] && !m['8'] && !m['7'], 'seule une transaction FINALISÉE (450) à date lisible est datée');
    dit(bil.versementsDeLignes(null) === null, 'lecture ratée ⇒ `null` (pas su), jamais « aucun versement »');
  });

  console.log('\n── 4. La semaine, à l’heure de Paris');
  await essaie('semainePassee', async () => {
    const paris = (t) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(t));
    // Lundi 5 octobre 2026, 10 h à Paris (08:00 UTC) : la semaine du 28 sept. au 4 oct.
    const s1 = bil.semainePassee(Date.parse('2026-10-05T08:00:00Z'));
    dit(s1.jour === 1 && s1.lundi === '2026-09-28' && s1.dimanche === '2026-10-04', 'lundi 5 octobre ⇒ la semaine du lundi 28 septembre au dimanche 4 octobre', JSON.stringify({ jour: s1.jour, lundi: s1.lundi, dimanche: s1.dimanche }));
    dit(paris(s1.debut) === 'lundi 00:00' && paris(s1.fin) === 'lundi 00:00' && s1.fin - s1.debut === 7 * J, 'bornes : lundi 00:00 → lundi 00:00, À PARIS', `${paris(s1.debut)} → ${paris(s1.fin)}`);
    // Passage à l'heure d'hiver le dimanche 25 octobre 2026 : la semaine a 169 h.
    const s2 = bil.semainePassee(Date.parse('2026-10-26T09:00:00Z'));
    dit(s2.lundi === '2026-10-19' && paris(s2.debut) === 'lundi 00:00' && paris(s2.fin) === 'lundi 00:00' && s2.fin - s2.debut === 7 * J + 3600000,
      'la semaine du changement d’heure fait 169 h, bornée à minuit de Paris des deux côtés', `${(s2.fin - s2.debut) / 3600000} h`);
    // Dimanche soir 23:30 à Paris (21:30 UTC) : c'est encore la semaine en cours.
    const s3 = bil.semainePassee(Date.parse('2026-10-04T21:30:00Z'));
    dit(s3.jour === 7 && s3.lundi === '2026-09-21', 'dimanche 23:30 à Paris ⇒ jour 7 (le bilan ne part pas sur une semaine pas finie)', JSON.stringify({ jour: s3.jour, lundi: s3.lundi }));
  });

  console.log('\n── 5. Ce que le bilan dit — trois états, et la DONNÉE qui déclenche');
  // ⚠️ Un audit ne meurt pas, il rapporte : sur le code d'avant `semainePassee`
  //    n'existe pas — les bornes sont alors posées à la main (les mêmes), et
  //    chaque contrôle ci-dessous sort ROUGE au lieu de tuer le processus.
  const sem = typeof bil.semainePassee === 'function' ? bil.semainePassee(Date.parse('2026-10-05T08:00:00Z'))
    : { lundi: '2026-09-28', dimanche: '2026-10-04', debut: Date.parse('2026-09-27T22:00:00Z'), fin: Date.parse('2026-10-04T22:00:00Z'), jour: 1 };
  const DANS = sem.debut + 2 * J, AVANT = sem.debut - 2 * J, APRES_FIN = new Date(sem.fin + 3600000).toISOString();
  const base = () => ({
    comptes: [{ uid: '11', login: 'paire_a' }, { uid: '22', login: 'paire_b' }],
    commandes: {
      11: { cap: APRES_FIN, orders: [
        { transaction_id: 101, status: 'Commande finalisée', date: new Date(DANS).toISOString(), price: { amount: '40' } },
        { transaction_id: 102, status: 'Le paiement a été validé', date: new Date(DANS).toISOString(), price: { amount: '25.5' } },
        { transaction_id: 103, status: 'Commande finalisée', date: new Date(AVANT).toISOString(), price: { amount: '70' } },
        { transaction_id: 104, status: 'Remboursement effectué', date: new Date(DANS).toISOString(), price: { amount: '99' } },
        { transaction_id: 105, status: 'Le paiement a été validé', date: new Date(DANS).toISOString(), price: { amount: '15' } },
      ] },
      22: { cap: APRES_FIN, orders: [{ transaction_id: 201, status: 'Commande finalisée', date: new Date(DANS).toISOString(), price: { amount: '10' } }] },
    },
    masquesTx: new Set(['105']), masquesComptes: new Set(), panneau: {},
    lbc: [{ txId: 'L1', isSeller: true, price: 3000, dateVente: new Date(DANS).toISOString(), stepStatus: 'done', at: new Date(DANS).toISOString() }],
    ebay: [],
    versements: { 101: new Date(DANS + J).toISOString(), 103: new Date(DANS).toISOString(), 201: new Date(DANS).toISOString() },
    colis: 2, dorment: { n: 4, total: 30, datesKnown: 30, at: Date.parse('2026-10-04T18:00:00Z') },
    debut: sem.debut, fin: sem.fin, maintenant: Date.parse('2026-10-05T08:00:00Z'),
  });
  await essaie('complet', async () => {
    const b = bil.calculerBilan(base());
    // Vendu = 101 (40) + 102 (25,5) + 201 (10) + L1 (30) ; 103 avant la semaine, 104 remboursée, 105 masquée.
    dit(b.vendu.etat === 'su' && b.vendu.n === 4 && b.vendu.eur === 105.5, 'vendu : 4 ventes · 105,50 € (date de VENTE ; remboursée, masquée et hors semaine écartées)', JSON.stringify(b.vendu));
    // Reçu = versements dans la semaine : 101 (40) + 103 (70, vendue AVANT, payée DANS) + 201 (10) + L1 (30, daté à la vente).
    dit(b.recu.etat === 'su' && b.recu.eur === 150, 'reçu : 150 € (date de VERSEMENT — la vente d’avant, payée cette semaine, compte)', JSON.stringify(b.recu));
    dit(b.colis.n === 2 && b.dorment.n === 4 && !b.dorment.auMoins, 'colis et paires qui dorment : repris tels que publiés');
    const t = bil.texteBilan(b, sem);
    dit(!/au moins/i.test(t.corps) && t.corps.includes('105,5') && t.corps.includes('150'), 'complet ⇒ le texte donne les nombres, sans réserve', t.corps.replace(/\n/g, ' | '));
  });
  await essaie('compte lu jeudi', async () => {
    const e = base(); e.commandes[22].cap = new Date(sem.debut + 3 * J + 10 * 3600000).toISOString();
    const b = bil.calculerBilan(e), complet = bil.texteBilan(bil.calculerBilan(base()), sem), t = bil.texteBilan(b, sem);
    dit(b.vendu.etat === 'partiel' && b.vendu.manque.some((m) => m.includes('paire_b')), 'un compte capté avant la fin de la semaine ⇒ PARTIEL, et le compte est NOMMÉ', JSON.stringify(b.vendu.manque));
    dit(t.corps !== complet.corps && t.corps.includes('paire_b'), '… et le texte le dit (il diffère du complet et nomme le compte)', t.corps.split('\n')[0]);
  });
  await essaie('leboncoin illisible', async () => {
    const e = base(); e.lbc = null;
    const b = bil.calculerBilan(e);
    dit(b.vendu.etat === 'partiel' && b.vendu.n === 3 && b.vendu.manque.some((m) => /Leboncoin/.test(m)), 'Leboncoin illisible ⇒ partiel, « Leboncoin » nommé, ses ventes ni inventées ni comptées', JSON.stringify(b.vendu));
  });
  await essaie('jamais capté', async () => {
    const e = base(); delete e.commandes[22];
    const b = bil.calculerBilan(e);
    dit(b.vendu.etat === 'partiel' && b.vendu.manque.some((m) => m.includes('paire_b')), 'un compte lié jamais capté ⇒ partiel et nommé (pas « 0 vente »)');
  });
  await essaie('compte exclu', async () => {
    const e = base(); e.masquesComptes = new Set(['22']); e.commandes[22].cap = null;
    const b = bil.calculerBilan(e);
    dit(b.vendu.etat === 'su' && b.vendu.n === 3 && !b.vendu.manque.some((m) => m.includes('paire_b')), 'un compte EXCLU (son choix) : ni compté, ni réclamé comme manquant');
  });
  await essaie('à dater', async () => {
    const e = base(); delete e.versements[201];
    const b = bil.calculerBilan(e);
    dit(b.recu.etat === 'partiel' && b.recu.eur === 140 && b.recu.manque.some((m) => /sans date de versement/.test(m)), 'une vente finalisée sans date de versement ⇒ reçu « au moins », jamais daté au hasard', JSON.stringify(b.recu));
    dit(/au moins/i.test(bil.texteBilan(b, sem).corps), '… et le texte dit « au moins »');
  });
  await essaie('versements illisibles', async () => {
    const e = base(); e.versements = null;
    const b = bil.calculerBilan(e);
    dit(b.recu.etat === 'pas-su' && b.vendu.etat === 'su', 'dates de versement illisibles ⇒ reçu « pas su » (aucun nombre), le vendu reste dit');
    dit(!/Reçu : [0-9]/.test(bil.texteBilan(b, sem).corps), '… et aucun montant reçu n’est écrit');
  });
  await essaie('tout illisible', async () => {
    const e = base(); e.comptes = null; e.lbc = null; e.ebay = null;
    const b = bil.calculerBilan(e);
    dit(b.vendu.etat === 'pas-su' && !bil.bilanAEnvoyer(b), 'tout illisible ⇒ rien à envoyer (on réessaie le lendemain, jamais « 0 vente »)');
  });
  await essaie('dorment', async () => {
    const e1 = base(); e1.dorment = { n: 4, total: 30, datesKnown: 20, at: e1.maintenant - J };
    dit(bil.calculerBilan(e1).dorment.auMoins === true, 'paires qui dorment : moins de dates connues que d’annonces ⇒ « au moins »');
    const e2 = base(); e2.dorment = { n: 4, total: 30, datesKnown: 30, at: e2.maintenant - 9 * J };
    dit(bil.calculerBilan(e2).dorment.etat === 'pas-su', 'publication de plus de 8 jours ⇒ plus une mesure (rien n’est dit)');
    const e3 = base(); e3.dorment = null;
    dit(!/dort|dorment|30 jours/i.test(bil.texteBilan(bil.calculerBilan(e3), sem).corps), 'jamais publié ⇒ la ligne n’apparaît pas (pas de « 0 » inventé)');
  });

  console.log('\n── 6. « bilan » est une catégorie de notification, la même des deux côtés');
  await essaie('catégories', async () => {
    try { pushLib = await import('file://' + path.join(R, 'api', '_lib', 'push.js')); } catch (e) { pushLib = {}; }
    const D = pushLib.PUSH_DEFAUT || {};
    const cats = [...(app || '').matchAll(/\{\s*id:'(\w+)',\s*def:(true|false)/g)].map((m) => [m[1], m[2] === 'true']);
    dit(D.bilan === true, 'serveur : « bilan » activé par défaut (PUSH_DEFAUT)');
    dit(cats.some(([id, def]) => id === 'bilan' && def === true), 'app : « Bilan de la semaine » dans Réglages → notifications, activé par défaut');
    const ecarts = cats.filter(([id, def]) => D[id] !== def).map(([id]) => id).concat(Object.keys(D).filter((k) => !cats.some(([id]) => id === k)));
    dit(cats.length > 0 && ecarts.length === 0, 'mêmes catégories et mêmes défauts dans l’app et sur le serveur', ecarts.join(', '));
  });
  await essaie('publication', async () => {
    const sync = (/const SYNC_KEYS = \[([\s\S]*?)\];/.exec(app || '') || [])[1] || '';
    const srvSrc = lire('api/ship-reminders.js') || '';
    dit(/'vrm_paires_dorment'/.test(sync) && /save\('vrm_paires_dorment'/.test(app || ''), 'l’écran Annonces PUBLIE les paires qui dorment (clé synchronisée)');
    dit(/vrm_paires_dorment/.test(srvSrc) && !/SLEEP_DAYS|listedAgeDays/.test(srvSrc), 'le serveur les CONSOMME, sans les recalculer (§11)');
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
