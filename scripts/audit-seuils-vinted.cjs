#!/usr/bin/env node
/**
 * CE QUE VINTED TRANSMET AUX IMPÔTS — LES SEUILS, COMPTE PAR COMPTE (6 octobre,
 * revu le même jour après une relecture contradictoire)
 *
 * Chaque année, Vinted transmet aux impôts les vendeurs qui atteignent 30 ventes
 * OU dépassent 2 000 € dans l'année (directive européenne DAC7).
 *
 * Cet audit EXÉCUTE la vraie règle (`seuilsVintedParCompte`, extraite d'App.jsx
 * par l'analyseur Babel avec tout ce qu'elle appelle : `ventesDeclarables`,
 * `classifyOrderStatus`, `montantCommande`…) dans un `vm`, sur des ventes
 * INVENTÉES (le dépôt est public). Il juge ce qu'elle REND, jamais un libellé.
 *
 * ⚠️ La partie SÛRE d'un compte est le chiffre du REGISTRE annuel (`datees`,
 *    calculé par le registre et passé tel quel). Le registre vit dans un écran ;
 *    ici, `datees` est bâti avec la VRAIE `ventesDeclarables` (finalisée, datée
 *    du versement dans l'année — la règle du registre) — et un compte reçoit
 *    exprès un `datees` qui ne se déduit PAS de ses ventes : la carte doit le
 *    rendre tel quel, sans le recalculer (§11).
 *
 *   node scripts/audit-seuils-vinted.cjs                 → la règle d'App.jsx
 *   node scripts/audit-seuils-vinted.cjs --mutation X    → la règle RÉAFFAIBLIE
 *        (exclus · passu · versnull · seuil2000 · adater · recalcule · strict ·
 *         totalsous · reste · acejour) — chacune doit faire passer au moins un
 *        contrôle au ROUGE (§6.1 : « la fonction n'existait pas avant » n'est
 *        pas une preuve).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RACINE = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (m, f) => { try { return f(); } catch (e) { dit(false, m, 'a levé : ' + String(e && e.message).slice(0, 160)); return undefined; } };
const fin = () => { console.log(ko ? `\n❌ seuils Vinted : ${ko} rouge(s)` : '\n✅ seuils Vinted : tout est vert'); process.exit(ko ? 1 : 0); };

const iM = process.argv.indexOf('--mutation');
const MUTATION = iM > 0 ? process.argv[iM + 1] : null;

let parser;
try { parser = require(path.join(RACINE, 'node_modules', '@babel', 'parser')); }
catch (e) { dit(false, 'l’analyseur Babel est disponible', e.message); fin(); }

const SRC = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
let ast;
try { ast = parser.parse(SRC, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true }); }
catch (e) { dit(false, 'App.jsx se lit', e.message); fin(); }

// Les déclarations de MODULE, par nom → leur texte exact.
const decl = {};
for (const n of ast.program.body) {
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && d.id.name) decl[d.id.name] = SRC.slice(n.start, n.end);
  if (n.type === 'FunctionDeclaration' && n.id) decl[n.id.name] = SRC.slice(n.start, n.end);
}
const BESOINS = ['ventesDeclarables', 'SEUIL_VINTED_VENTES', 'SEUIL_VINTED_EUR', 'seuilsVintedParCompte'];
const manque = BESOINS.filter(n => !decl[n]);
dit(!manque.length, 'la règle des seuils est une fonction de MODULE, à côté du CA déclaré', manque.length ? 'introuvable : ' + manque.join(', ') : '');
if (manque.length) fin();
// Tout ce que la règle appelle, de proche en proche — jamais une copie :
// recopiée, la règle mesurerait MES hypothèses, pas celles de l'app.
const NOMS = Object.keys(decl).filter(n => /^[a-z_$][\w$]*$/.test(n) || /^[A-Z_][A-Z0-9_]+$/.test(n));
const ordre = [];
const tire = (nom, pile) => {
  if (ordre.includes(nom) || pile.has(nom)) return;
  pile.add(nom);
  const txt = decl[nom];
  for (const autre of NOMS) if (autre !== nom && txt.includes(autre) && new RegExp('(^|[^\\w$.])' + autre.replace(/\$/g, '\\$') + '(?![\\w$])').test(txt)) tire(autre, pile);
  ordre.push(nom);
};
tire('seuilsVintedParCompte', new Set());
if (process.argv.includes('--deps')) console.log('dépendances :', ordre.join(', '));

// ── Les mutations : la règle RÉAFFAIBLIE, pour prouver que les contrôles mordent.
const MUTATIONS = {
  exclus: [['(ecarte && ecarte(uid))', 'false'], ['!!(ecarte && ecarte(uidDe(o)))', 'false']],   // un compte exclu compte
  passu: [["(ko(uid) || versements === null) ? 'pasSu' : 'lu'", "'lu'"]],                       // lecture ratée = 0
  versnull: [['(ko(uid) || versements === null)', 'ko(uid)']],                                    // dates illisibles = 0 daté
  seuil2000: [['cts > SEUIL_VINTED_EUR * 100', 'cts >= SEUIL_VINTED_EUR * 100']],               // 2 000,00 € pile = atteint
  adater: [['r.nAd += 1; r.ctsAd += c;', 'r.n += 1; r.cts += c;']],                              // le défaut de la revue : pas encore datée comptée comme sûre
  recalcule: [['(etat === \'lu\' && datees[uid]) || {}', '{}']],                                // la carte ignore le chiffre du registre
  strict: [['Math.min(maintenant, t + VERSEMENT_MAX_J * 86400e3)', 'maintenant']],                // sans borne haute : 2024 « pas encore datée » en 2026
  totalsous: [['juge(total, !total.partiel)', 'juge(total, true)']],                              // un total partiel jugé « sous »
  reste: [['SEUIL_VINTED_EUR * 100 + 1 - r.cts', 'SEUIL_VINTED_EUR * 100 - r.cts']],              // « encore 0,10 € » alors qu'il faut 0,11 €
  acejour: [['anneeDe(maintenant) === annee', 'false']],                                          // l'année en cours présentée comme finie
};
let code = ordre.map(n => decl[n]).join('\n');
if (MUTATION) {
  const m = MUTATIONS[MUTATION];
  if (!m) { dit(false, 'mutation connue', MUTATION + ' — attendu : ' + Object.keys(MUTATIONS).join(' · ')); fin(); }
  for (const [a, b] of m) {
    if (!code.includes(a)) { dit(false, `mutation « ${MUTATION} » applicable`, 'motif absent : ' + a); fin(); }
    code = code.split(a).join(b);
  }
  console.log(`(règle réaffaiblie : ${MUTATION})\n`);
}

const ctx = { console, Date, Number, String, Math, isFinite, isNaN, Set, Array, Object, parseFloat, JSON,
  lbcAnnulee: () => false, lbcFinalisee: () => false };
vm.createContext(ctx);
if (essaie('la règle se charge', () => { vm.runInContext(code + '\n;Object.assign(this, { seuilsVintedParCompte, ventesDeclarables, SEUIL_VINTED_VENTES, SEUIL_VINTED_EUR });', ctx); return true; }) !== true) fin();

dit(ctx.SEUIL_VINTED_VENTES === 30 && ctx.SEUIL_VINTED_EUR === 2000, 'les seuils sont 30 ventes et 2 000 €', `${ctx.SEUIL_VINTED_VENTES} · ${ctx.SEUIL_VINTED_EUR}`);

// ── Des ventes INVENTÉES. Tout est daté en heure LOCALE.
const AN = 2026;
const MAINTENANT = new Date(AN, 9, 6, 12).getTime();          // 6 octobre 2026
const jour = (y, m, d) => new Date(y, m, d, 12).toISOString();
const acc = (uid) => ({ vinted_user_id: uid, login: 'compte_' + uid });
let tx = 1000;
const V = [], VERS = {};
const vente = (uid, eur, statut, date, versement) => {
  const t = ++tx;
  V.push({ transaction_id: t, title: 'Paire inventée ' + t, price: { amount: String(eur), currency_code: 'EUR' }, status: statut, date, _acc: acc(uid) });
  if (versement) VERS[String(t)] = versement;
  return t;
};
const FIN = 'Commande finalisée - l\'acheteur a validé la commande';
// 111 : 31 ventes de 10 € — 15 datées du versement, 16 pas encore → « atteint si »
for (let i = 0; i < 31; i++) vente('111', 10, FIN, jour(AN, 5, 1 + (i % 28)), i < 15 ? jour(AN, 5, 1 + (i % 28) + 1) : null);
vente('111', 999, 'Commande annulée', jour(AN, 6, 2));          // jamais
vente('111', 500, 'Le paiement a été validé', jour(AN, 8, 30));  // en cours : pas encore versée
vente('111', 400, 'Remboursement effectué', jour(AN, 7, 3));     // remboursée : jamais
// 222 : 1 200,01 € datés + 800 € pas encore datés = 2 000,01 € → « atteint si »
vente('222', 900, FIN, jour(AN, 2, 3), jour(AN, 2, 9));
vente('222', 800, FIN, jour(AN, 3, 3), null);
vente('222', 300.01, FIN, jour(AN, 4, 3), jour(AN, 4, 10));
// 333 : 28 datées (1 999,90 €) + 1 pas encore (0,10 €) = 2 000,00 € PILE → sous
for (let i = 0; i < 27; i++) vente('333', 70, FIN, jour(AN, 6, 1 + i), jour(AN, 6, 2 + i));
vente('333', 109.9, FIN, jour(AN, 7, 10), jour(AN, 7, 12));
vente('333', 0.1, FIN, jour(AN, 7, 11), null);
// 444 : EXCLU de l'app — 40 ventes qui ne doivent apparaître nulle part
for (let i = 0; i < 40; i++) vente('444', 60, FIN, jour(AN, 3, 1 + (i % 28)), null);
// 555 : sa lecture a ÉCHOUÉ — on ne sait rien (ses ventes ne sont pas dans la liste)
// 666 : 29 ventes datées cette année + 1 vendue le 28 décembre d'AVANT, VERSÉE le 2 janvier → 30
for (let i = 0; i < 29; i++) vente('666', 20, FIN, jour(AN, 7, 1 + (i % 28)), jour(AN, 7, 2 + (i % 28)));
vente('666', 20, FIN, jour(AN - 1, 11, 28), jour(AN, 0, 2));
// 777 : 29 ventes cette année + 1 vendue le 20 décembre d'AVANT — aucune datée du versement
for (let i = 0; i < 29; i++) vente('777', 15, FIN, jour(AN, 8, 1 + (i % 28)), null);
vente('777', 15, FIN, jour(AN - 1, 11, 20), null);
// 888 : 3 ventes d'il y a DEUX ans, versement pas daté
for (let i = 0; i < 3; i++) vente('888', 25, FIN, jour(AN - 2, 2, 3 + i), null);
// 999 : 32 ventes datées de 20 € → seuil atteint, SÛR
for (let i = 0; i < 32; i++) vente('999', 20, FIN, jour(AN, 4, 1 + (i % 28)), jour(AN, 4, 2 + (i % 28)));

const COMPTES = ['111', '222', '333', '444', '555', '666', '777', '888', '999'].map(u => ({ uid: u, nom: 'compte_' + u }));
const ecarte = (uid) => String(uid) === '444';
const echoues = new Set(['555']);
// Le chiffre du REGISTRE : finalisée, compte non exclu, versée dans l'année — la
// vraie `ventesDeclarables`, ventes regroupées par compte, en centimes.
const registre = (annee, versements = VERS) => {
  const out = {};
  const d = ctx.ventesDeclarables({ vinted: V, exclu: (o) => ecarte(o._acc.vinted_user_id), versements });
  for (const l of d.lignes) {
    if (l.plateforme !== 'Vinted' || new Date(l.ts).getFullYear() !== annee) continue;
    const u = String(l.o._acc.vinted_user_id); const q = out[u] || (out[u] = { n: 0, cts: 0 });
    q.n += 1; q.cts += Math.round(l.eur * 100);
  }
  return out;
};
const appel = (extra) => {
  const a = { comptes: COMPTES, ventes: V, ecarte, echoues, versements: VERS, annee: AN, maintenant: MAINTENANT, ...(extra || {}) };
  if (!('datees' in (extra || {}))) a.datees = registre(a.annee, a.versements || {});
  return ctx.seuilsVintedParCompte(a);
};
// La forme rendue : `{ comptes, total, aCeJour }` (une liste seule, c'était avant la revue).
const lignesDe = (R) => (R && Array.isArray(R.comptes)) ? R.comptes : (Array.isArray(R) ? R : []);
const indexe = (R) => Object.fromEntries(lignesDe(R).map(r => [r.uid, r]));
const vu = (r) => r ? `n=${r.n} · ${r.cts} cts · pas encore datées ${r.nAd} (${r.ctsAd} cts) · ${r.verdict} · ${r.etat}` : 'absent';

const R = essaie('la règle rend un résultat', () => appel());
const L = lignesDe(R);
const par = indexe(R);
const REG = registre(AN);

// 1. Le compte EXCLU n'y entre pas.
dit(!par['444'], 'un compte exclu de l’app n’apparaît pas (décision du 3 octobre)', vu(par['444']));
dit(L.length === 8, 'les huit autres comptes sont tous là — aucun n’est perdu', L.length + ' compte(s)');

// 2. LA PARTIE SÛRE EST LE CHIFFRE DU REGISTRE, compte par compte — jamais plus.
for (const u of ['111', '222', '333', '666', '777', '888', '999']) {
  const r = par[u], g = REG[u] || { n: 0, cts: 0 };
  dit(!!(r && r.etat === 'lu' && r.n === g.n && r.cts === g.cts), `compte_${u} : la partie sûre == le registre (${g.n} vente(s), ${g.cts} cts)`, vu(r));
}
// …et elle est LUE, pas recalculée : un registre qui dit autre chose est rendu tel quel.
const D = essaie('la règle rend le chiffre du registre tel quel', () => appel({ datees: { ...REG, '999': { n: 7, cts: 12345 } } }));
const d9 = indexe(D)['999'];
dit(!!(d9 && d9.n === 7 && d9.cts === 12345), 'la carte LIT le chiffre du registre, elle ne le recalcule pas (§11)', vu(d9));

// 3. Les ventes PAS ENCORE DATÉES sont à part — jamais dans la partie sûre.
dit(par['111'] && par['111'].n === 15 && par['111'].cts === 15000 && par['111'].nAd === 16 && par['111'].ctsAd === 16000,
  '15 datées (150 €) et 16 pas encore datées (160 €) — ni l’annulée, ni l’en cours, ni la remboursée', vu(par['111']));
dit(par['111'] && par['111'].verdict === 'atteintSi', '30 ventes seulement EN AJOUTANT les pas encore datées : « atteint si », jamais « atteint »', vu(par['111']));
dit(par['777'] && par['777'].n === 0 && par['777'].nAd === 30 && par['777'].verdict === 'atteintSi', 'aucune vente datée, 30 pas encore : « atteint si » — la partie sûre reste à 0', vu(par['777']));

// 4. Plus de 2 000 € (en centimes) — et 2 000,00 € pile ne l'atteint pas.
dit(par['222'] && par['222'].cts === 120001 && par['222'].ctsAd === 80000 && par['222'].verdict === 'atteintSi', '1 200,01 € datés + 800 € pas encore datés = 2 000,01 € : « atteint si »', vu(par['222']));
dit(par['333'] && par['333'].n === 28 && par['333'].cts === 199990 && par['333'].ctsAd === 10 && par['333'].verdict === 'sous', '1 999,90 € datés + 0,10 € pas encore datés = 2 000,00 € PILE : sous les seuils', vu(par['333']));

// 5. Ce qu'il reste avant le seuil, sur la partie SÛRE : 30 ventes, ou un centime de plus que 2 000 €.
dit(par['333'] && par['333'].reste && par['333'].reste.n === 2 && par['333'].reste.cts === 11, 'il reste 2 ventes ou 0,11 € avant le seuil (2 000 € ne suffit pas : « plus de »)', par['333'] ? JSON.stringify(par['333'].reste) : 'absent');
dit(par['999'] && par['999'].verdict === 'atteint' && par['999'].reste === null, 'seuil atteint sur la partie datée : « atteint », sans reste', vu(par['999']));
dit(R && R.aCeJour === true, 'l’année en cours est « à ce jour »', R ? String(R.aCeJour) : 'absent');

// 6. « Pas su » n'est jamais 0 — et se juge par l'IDENTITÉ du compte.
dit(par['555'] && par['555'].etat === 'pasSu' && par['555'].raison === 'ventes' && par['555'].verdict === null && par['555'].n === 0, 'un compte dont la lecture a échoué est « pas su » — aucun verdict, jamais « 0 vente · sous les seuils »', vu(par['555']));
const N = essaie('la règle juge un identifiant numérique', () => appel({ comptes: [{ uid: 555, nom: 'renommé' }] }));
dit(!!(indexe(N)['555'] && indexe(N)['555'].etat === 'pasSu'), 'un identifiant numérique, un autre nom : toujours « pas su » (identité, pas libellé)', vu(indexe(N)['555']));

// 7. L'année est celle du VERSEMENT : vendue en décembre, versée en janvier → janvier.
dit(par['666'] && par['666'].n === 30 && par['666'].verdict === 'atteint', 'vendue le 28 décembre, versée le 2 janvier : elle compte, sûre, pour la nouvelle année (30 → atteint)', vu(par['666']));
// 8. Une vente d'il y a DEUX ans, pas datée, n'est pas rattachée à cette année : le
//    versement suit la vente de quelques jours (25 au plus, mesuré) — sinon fausse alerte (§7).
dit(par['888'] && par['888'].n === 0 && par['888'].nAd === 0 && par['888'].verdict === 'sous', 'vendues il y a deux ans, versement pas daté : rien pour cette année', vu(par['888']));
const D2 = essaie('la règle rend l’année d’il y a deux ans', () => appel({ annee: AN - 2 }));
const p2 = indexe(D2)['888'];
dit(!!(p2 && p2.n === 0 && p2.nAd === 3), '…et pour leur année, elles sont « pas encore datées » — jamais sûres', vu(p2));
dit(D2 && D2.aCeJour === false, 'une année passée n’est pas « à ce jour »', D2 ? String(D2.aCeJour) : 'absent');

// 9. L'année d'AVANT.
const P = essaie('la règle rend l’année précédente', () => appel({ annee: AN - 1 }));
const pp = indexe(P);
dit(pp['666'] && pp['666'].n === 0 && pp['666'].nAd === 0, 'année précédente : la vente versée en janvier n’y compte pas', vu(pp['666']));
dit(pp['777'] && pp['777'].n === 0 && pp['777'].nAd === 1, 'année précédente : la vente de décembre sans date y est « pas encore datée » aussi — jamais sûre', vu(pp['777']));
dit(pp['111'] && pp['111'].n === 0 && pp['111'].nAd === 0, 'année précédente : une vente de cette année n’y remonte pas', vu(pp['111']));

// 10. Le TOTAL de tous les comptes sélectionnés.
const T = R && R.total;
const somme = L.filter(r => r.etat === 'lu').reduce((s, r) => s + r.n, 0);
dit(!!(T && T.partiel === true && JSON.stringify(T.manquants) === '["555"]' && T.n === somme && T.verdict === 'atteint'), 'le total additionne les comptes lus, dit qu’il manque compte_555, et « atteint » sur ce qu’on sait', T ? `n=${T.n} (somme ${somme}) · partiel ${T.partiel} · manquants ${JSON.stringify(T.manquants)} · ${T.verdict}` : 'absent');
const TP = essaie('la règle rend un total partiel sous les seuils', () => appel({ comptes: COMPTES.filter(c => ['333', '555'].includes(c.uid)) }));
const tp = TP && TP.total;
dit(!!(tp && tp.partiel && tp.verdict === null && tp.reste === null), 'un total PARTIEL sous les seuils n’est jamais « sous les seuils » : les ventes qui manquent pourraient l’y faire passer', tp ? `${tp.verdict} · reste ${JSON.stringify(tp.reste)}` : 'absent');
const TC = essaie('la règle rend un total complet', () => appel({ comptes: COMPTES.filter(c => ['333', '888'].includes(c.uid)) }));
const tc = TC && TC.total;
dit(!!(tc && !tc.partiel && tc.n === 28 && tc.cts === 199990 && tc.verdict === 'sous' && tc.reste && tc.reste.n === 2 && tc.reste.cts === 11), 'un total complet sous les seuils le dit, avec ce qu’il reste', tc ? `n=${tc.n} · ${tc.cts} · ${tc.verdict} · ${JSON.stringify(tc.reste)}` : 'absent');

// 11. Dates de versement ILLISIBLES (null) : « pas su », jamais « 0 daté ».
const NV = essaie('la règle rend un résultat sans dates de versement', () => appel({ versements: null, datees: {} }));
const lnv = lignesDe(NV);
dit(lnv.length === 8 && lnv.every(r => r.etat === 'pasSu' && r.verdict === null && r.n === 0), 'dates de versement illisibles : chaque compte est « pas su » — aucun verdict sur une partie sûre qu’on n’a pas pu lire', lnv.map(r => r.uid + ':' + r.etat + ':' + r.raison).join(','));
dit(NV && NV.total && NV.total.etat === 'pasSu' && NV.total.verdict === null, 'dates de versement illisibles : le total est « pas su »', NV && NV.total ? NV.total.etat : 'absent');

// 12. Pas encore lu (ventes, dates de versement ou registre) : « en cours », aucun chiffre.
for (const [quoi, extra] of [['ventes pas encore lues', { ventes: null }], ['dates de versement pas encore lues', { versements: undefined }], ['registre pas encore calculé', { datees: null }]]) {
  const E = essaie(`la règle rend un résultat (${quoi})`, () => appel(extra));
  const le = lignesDe(E);
  dit(le.length === 8 && le.every(r => r.etat === 'enCours' && r.verdict === null), `${quoi} : chaque compte est « en cours », aucun verdict`, le.map(r => r.etat).join(','));
}

fin();
