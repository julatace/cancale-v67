#!/usr/bin/env node
// Exécute la VRAIE règle de src/annulationsCompte.js (3 nov.) avec la VRAIE
// règle « annulée » de l'app (`classifyOrderStatus`, extraite de src/App.jsx
// et exécutée dans un vm) : taux par compte sur la période, liste des
// annulations (lien de LA vente), compte pas lu ⇒ « — » et nommé, compte
// exclu absent, sans date compté à part, autres plateformes « pas comptées ».
// `--mutation=X` : absence-annulee · ko-zero · hors-periode · exclu-compte · lien-titre
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), vm = require('vm');
const ICI = path.join(__dirname, '..');
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let src = fs.readFileSync(path.join(ICI, 'src', 'annulationsCompte.js'), 'utf8');
const muter = (a, b) => { if (!src.includes(a)) { console.error('ancre absente :', a); process.exit(2); } src = src.replace(a, b); };
if (mut === 'ko-zero') muter('    if (koSet.has(uid)) continue;                       // compte pas lu : aucun chiffre pour lui\n', '');
if (mut === 'hors-periode') muter('if (t < de || t >= a) continue;', 'if (t < de) continue;');
if (mut === 'exclu-compte') muter('    if (ecarte(uid)) continue;\n', '');
if (mut === 'lien-titre') muter("if (o.conversation_id) return", "if (o.title) return `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(o.title)}`;\n  if (o.conversation_id) return");
const tmp = path.join(ICI, 'src', `.audit-annul-${process.pid}.mjs`);
fs.writeFileSync(tmp, src);
let ko = 0, n = 0;
const dit = (ok, l, d) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${l}${!ok && d !== undefined ? ' — ' + d : ''}`); };
(async () => {
  try {
    const M = await import(tmp);
    // La règle de l'app, telle qu'écrite dans src/App.jsx.
    const app = fs.readFileSync(path.join(ICI, 'src', 'App.jsx'), 'utf8');
    const i = app.indexOf('const classifyOrderStatus = (status) => {');
    const j = app.indexOf('\n};', i);
    if (i < 0 || j < 0) throw new Error('classifyOrderStatus introuvable dans App.jsx');
    let code = app.slice(i, j + 3);
    if (mut === 'absence-annulee') code = code.replace("return 'pending';", "return status ? 'pending' : 'cancelled';");
    const ctx = {}; vm.createContext(ctx); vm.runInContext(code + '\nthis.classifyOrderStatus = classifyOrderStatus;', ctx);
    const estAnnulee = (o) => ctx.classifyOrderStatus(o.status) === 'cancelled';
    const A = (uid, login) => ({ vinted_user_id: uid, login });
    const D = (j2) => new Date(2026, 9, j2, 12).toISOString();
    const ventes = [
      { transaction_id: 1, conversation_id: 'c1', title: 'Nike Dunk 42', price: { amount: '40.0' }, status: 'Commande finalisée', date: D(2), _acc: A('111', 'atelier') },
      { transaction_id: 2, title: 'Nike Dunk 42', price: { amount: '35.0' }, status: 'Commande annulée', date: D(5), _acc: A('111', 'atelier') },
      { transaction_id: 3, title: 'Samba 41', price: { amount: '50.0' }, status: 'Le paiement a échoué', date: D(8), _acc: A('111', 'atelier') },
      { transaction_id: 4, title: 'Samba 41', price: { amount: '50.0' }, status: '', date: D(9), _acc: A('111', 'atelier') },          // conversation sans état : pas annulée
      { transaction_id: 5, title: 'Puma 40', price: { amount: '20.0' }, status: 'Remboursement effectué', date: D(10), _acc: A('222', 'paris') },
      { transaction_id: 6, title: 'Puma 40', price: { amount: '20.0' }, status: 'Commande finalisée', date: D(11), _acc: A('222', 'paris') },
      { transaction_id: 7, title: 'Hors période', price: { amount: '20.0' }, status: 'Commande annulée', date: new Date(2026, 8, 20).toISOString(), _acc: A('222', 'paris') },
      { transaction_id: 8, title: 'Sans date', price: { amount: '20.0' }, status: 'Commande annulée', date: '', _acc: A('222', 'paris') },
      { transaction_id: 9, title: 'Compte en panne', price: { amount: '20.0' }, status: 'Commande annulée', date: D(12), _acc: A('333', 'panne') },
      { transaction_id: 11, title: 'Novembre', price: { amount: '20.0' }, status: 'Commande annulée', date: new Date(2026, 10, 2).toISOString(), _acc: A('222', 'paris') },
      { transaction_id: 12, title: 'Exclu lu', price: { amount: '20.0' }, status: 'Commande annulée', date: D(12), _acc: A('555', 'exclu2') },
      { transaction_id: 10, title: 'Compte exclu', price: { amount: '20.0' }, status: 'Commande annulée', date: D(12), _acc: A('444', 'exclu') },
    ];
    const de = new Date(2026, 9, 1).getTime(), a = new Date(2026, 10, 1).getTime();
    const R = M.annulationsParCompte({ ventes, ko: ['333', '444'], de, a, estAnnulee, ecarte: (u) => u === '444' || u === '555' });
    const C = (u) => R.comptes.find((g) => g.uid === u) || {};
    dit(R.etat === 'lu' && C('111').n === 4 && C('111').annulees === 2 && C('111').taux === 50, 'atelier : 4 ventes d\'octobre, 2 annulées (annulée, paiement échoué) ⇒ 50 % ; un état vide n\'est PAS une annulation', JSON.stringify(C('111')));
    dit(C('222').n === 2 && C('222').annulees === 1 && C('222').taux === 50, 'paris : remboursée = annulée ; septembre, novembre et sans date hors période ⇒ 1 sur 2', JSON.stringify(C('222')));
    dit(R.sansDate === 1, 'une vente sans date lisible : comptée à part (dans aucune période)', String(R.sansDate));
    dit(!R.comptes.some((g) => g.uid === '333') && R.partiel && R.manquants.join() === '333', 'compte en panne : aucun chiffre (jamais 0 %), nommé dans les manquants', JSON.stringify(R.manquants));
    dit(!R.comptes.some((g) => g.uid === '444' || g.uid === '555') && !R.manquants.includes('444'), 'compte exclu (lu ou en panne) : nulle part, même pas en manque');
    dit(R.n === 6 && R.annulees === 3 && R.taux === 50, 'total = somme des comptes : 3 sur 6', JSON.stringify({ n: R.n, a: R.annulees, t: R.taux }));
    const l2 = R.liste.find((x) => x.id === '2'), l1 = M.lienVenteVinted(ventes[0]);
    dit(l2 && l2.lien === 'https://www.vinted.fr/member/transactions/2' && l1 === 'https://www.vinted.fr/inbox/c1', 'chaque annulation ouvre SA vente (conversation, sinon transaction) — jamais un titre', JSON.stringify({ l2: l2 && l2.lien, l1 }));
    dit(R.liste.map((x) => x.id).join() === '5,3,2' && l2.eur === 35, 'liste : la plus récente d\'abord, montant lu', R.liste.map((x) => x.id).join());
    dit(R.nonCouvertes.join() === 'Leboncoin,eBay,Vestiaire', 'Leboncoin, eBay, Vestiaire dits « pas comptés » (jamais 0 %)');
    dit(M.annulationsParCompte({ ventes: null, de, a, estAnnulee }).etat === 'passu' && M.annulationsParCompte({ ventes: undefined, de, a, estAnnulee }).etat === 'encours', 'ventes pas lues ⇒ « — » ; en cours ⇒ en cours');
  } catch (e) { dit(false, 'la règle s\'exécute', String(e && e.stack || e).slice(0, 300)); }
  finally { try { fs.unlinkSync(tmp); } catch (_) {} }
  console.log(ko ? `\n❌ audit-annulations-compte${mut ? ' [' + mut + ']' : ''} : ${ko} rouge(s) sur ${n}` : `\n✅ audit-annulations-compte : ${n} verts`);
  process.exit(ko ? 1 : 0);
})();
