#!/usr/bin/env node
/**
 * CE QUE VINTED TRANSMET AUX IMPÔTS — LES SEUILS, COMPTE PAR COMPTE (6 octobre)
 *
 * Chaque année, Vinted transmet aux impôts les vendeurs qui atteignent 30 ventes
 * OU dépassent 2 000 € dans l'année (directive européenne DAC7). Mesuré le
 * 6 octobre sur sa base : trois comptes y sont déjà (101 · 49 · 33 ventes
 * finalisées en 2026, l'un à 3 721,10 €) — et l'app n'en disait rien.
 *
 * Cet audit EXÉCUTE la vraie règle (`seuilsVintedParCompte`, extraite d'App.jsx
 * par l'analyseur Babel avec tout ce qu'elle appelle : `ventesDeclarables`,
 * `classifyOrderStatus`, `montantCommande`…) dans un `vm`, sur des ventes
 * INVENTÉES (le dépôt est public). Il juge ce qu'elle REND, jamais un libellé.
 *
 *   node scripts/audit-seuils-vinted.cjs                 → la règle d'App.jsx
 *   node scripts/audit-seuils-vinted.cjs --mutation X    → la règle RÉAFFAIBLIE
 *        (exclus · passu · seuil2000 · adater · strict · sansdater · datevente · encours)
 *        — chacune doit faire passer au moins un contrôle au ROUGE (§6.1 :
 *        « la fonction n'existait pas avant » n'est pas une preuve).
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
const BESOINS = ['classifyOrderStatus', 'tsCommande', 'montantCommande', 'venteFinalisee', 'ymDeTs', 'ventesDeclarables', 'SEUIL_VINTED_VENTES', 'SEUIL_VINTED_EUR', 'VERSEMENT_MAX_J', 'seuilsVintedParCompte'];
const manque = BESOINS.filter(n => !decl[n]);
dit(!manque.length, 'la règle des seuils est une fonction de MODULE, à côté du CA déclaré', manque.length ? 'introuvable : ' + manque.join(', ') : '');
if (manque.length) fin();
// Tout ce que la règle appelle, de proche en proche (la VRAIE `ventesDeclarables`
// et ce qu'elle appelle à son tour) — jamais une copie : recopiée, la règle
// mesurerait MES hypothèses, pas celles de l'app. Les composants (majuscule)
// et les gros blocs d'interface ne sont jamais tirés.
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
  passu: [["(echoues && echoues.has(uid)) ? 'pasSu' : 'lu'", "'lu'"]],                          // lecture ratée = 0
  seuil2000: [['cts > SEUIL_VINTED_EUR * 100', 'cts >= SEUIL_VINTED_EUR * 100']],               // 2 000,00 € pile = atteint
  adater: [['ajoute(l.o, l.eur, yMin === yMax)', 'ajoute(l.o, l.eur, true)']],                    // l'incertain compté comme sûr
  strict: [['Math.min(maintenant, t + VERSEMENT_MAX_J * 86400e3)', 'maintenant']],                // sans borne haute : 2023 « incertaine » en 2026
  sansdater: [['for (const l of d.aDater) {', 'for (const l of []) {']],                          // seules les ventes datées
  datevente: [['anneeDe(l.ts) === annee', 'anneeDe(tsCommande(l.o)) === annee']],                 // l'année de la VENTE
  encours: [['ventesDeclarables({ vinted: ventes,', 'ventesDeclarables({ vinted: (ventes || []).map(o => ({ ...o, status: /annul|rembours/i.test(o.status) ? o.status : "Commande finalisée" })),']],
};
let regle = decl.seuilsVintedParCompte;
if (MUTATION) {
  const m = MUTATIONS[MUTATION];
  if (!m) { dit(false, 'mutation connue', MUTATION + ' — attendu : ' + Object.keys(MUTATIONS).join(' · ')); fin(); }
  for (const [a, b] of m) {
    if (!regle.includes(a)) { dit(false, `mutation « ${MUTATION} » applicable`, 'motif absent : ' + a); fin(); }
    regle = regle.split(a).join(b);
  }
  console.log(`(règle réaffaiblie : ${MUTATION})\n`);
}

const ctx = { console, Date, Number, String, Math, isFinite, isNaN, Set, Array, Object, parseFloat,
  lbcAnnulee: () => false, lbcFinalisee: () => false };
vm.createContext(ctx);
const code = ordre.filter(n => n !== 'seuilsVintedParCompte').map(n => decl[n]).join('\n') + '\n' + regle
  + '\n;Object.assign(this, { seuilsVintedParCompte, SEUIL_VINTED_VENTES, SEUIL_VINTED_EUR });';
if (essaie('la règle se charge', () => { vm.runInContext(code, ctx); return true; }) !== true) fin();

dit(ctx.SEUIL_VINTED_VENTES === 30 && ctx.SEUIL_VINTED_EUR === 2000, 'les seuils sont 30 ventes et 2 000 €', `${ctx.SEUIL_VINTED_VENTES} · ${ctx.SEUIL_VINTED_EUR}`);

// ── Des ventes INVENTÉES, sur sept comptes. Tout est daté en heure LOCALE.
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
// 111 : 31 ventes de 10 € (15 datées du versement, 16 pas encore) → 30 ventes atteintes
for (let i = 0; i < 31; i++) vente('111', 10, FIN, jour(AN, 5, 1 + (i % 28)), i < 15 ? jour(AN, 5, 1 + (i % 28) + 1) : null);
vente('111', 999, 'Commande annulée', jour(AN, 6, 2));          // jamais
vente('111', 500, 'Le paiement a été validé', jour(AN, 8, 30));  // en cours : pas encore versée
vente('111', 400, 'Remboursement effectué', jour(AN, 7, 3));     // remboursée : jamais
// 222 : 3 ventes, 2 000,01 € → plus de 2 000 € atteint
vente('222', 900, FIN, jour(AN, 2, 3), jour(AN, 2, 9));
vente('222', 800, FIN, jour(AN, 3, 3), null);
vente('222', 300.01, FIN, jour(AN, 4, 3), jour(AN, 4, 10));
// 333 : 29 ventes, 2 000,00 € PILE → sous les seuils (« plus de » 2 000 €)
for (let i = 0; i < 27; i++) vente('333', 70, FIN, jour(AN, 6, 1 + i), jour(AN, 6, 2 + i));
vente('333', 109.9, FIN, jour(AN, 7, 10), jour(AN, 7, 12));
vente('333', 0.1, FIN, jour(AN, 7, 11), null);
// 444 : EXCLU de l'app — 40 ventes qui ne doivent apparaître nulle part
for (let i = 0; i < 40; i++) vente('444', 60, FIN, jour(AN, 3, 1 + (i % 28)), null);
// 555 : sa lecture a ÉCHOUÉ — on ne sait rien (ses ventes ne sont pas dans la liste)
// 666 : 29 ventes cette année + 1 vendue le 28 décembre d'AVANT, VERSÉE le 2 janvier → 30
for (let i = 0; i < 29; i++) vente('666', 20, FIN, jour(AN, 7, 1 + (i % 28)), null);
vente('666', 20, FIN, jour(AN - 1, 11, 28), jour(AN, 0, 2));
// 777 : 29 ventes cette année + 1 vendue le 20 décembre d'AVANT, SANS date de versement
for (let i = 0; i < 29; i++) vente('777', 15, FIN, jour(AN, 8, 1 + (i % 28)), null);
vente('777', 15, FIN, jour(AN - 1, 11, 20), null);

// 888 : 3 ventes vendues il y a DEUX ans, versement pas daté — leur année est sûre (versée dans les 45 j)
for (let i = 0; i < 3; i++) vente('888', 25, FIN, jour(AN - 2, 2, 3 + i), null);

const COMPTES = ['111', '222', '333', '444', '555', '666', '777', '888'].map(u => ({ uid: u, nom: 'compte_' + u }));
const ecarte = (uid) => String(uid) === '444';
const echoues = new Set(['555']);
const appel = (extra) => ctx.seuilsVintedParCompte({ comptes: COMPTES, ventes: V, ecarte, echoues, versements: VERS, annee: AN, maintenant: MAINTENANT, ...(extra || {}) });

const L = essaie('la règle rend un résultat', () => appel()) || [];
const par = Object.fromEntries((Array.isArray(L) ? L : []).map(r => [r.uid, r]));
const vu = (uid) => par[uid] ? `n=${par[uid].n} · ${par[uid].eur} € · ${par[uid].verdict} · ${par[uid].etat} · incertaines ${par[uid].nInc}` : 'absent';

// 1. Le compte EXCLU n'y entre pas, et aucune de ses ventes ne déborde ailleurs.
dit(!par['444'], 'un compte exclu de l’app n’apparaît pas (décision du 3 octobre)', vu('444'));
dit(L.length === 7, 'les sept autres comptes sont tous là — aucun n’est perdu', L.length + ' compte(s)');

// 2. Seules les ventes FINALISÉES comptent — ni annulée, ni en cours, ni remboursée.
dit(par['111'] && par['111'].n === 31 && par['111'].eur === 310, '31 ventes finalisées, 310 € : ni l’annulée (999 €), ni l’en cours (500 €), ni la remboursée (400 €)', vu('111'));
dit(par['111'] && par['111'].verdict === 'atteint', '30 ventes ou plus : seuil atteint', vu('111'));
// 3. Une vente finalisée SANS date de versement, faite cette année, compte cette année (bornes sûres).
dit(par['111'] && par['111'].nInc === 0, 'une vente de cette année, finalisée, compte cette année même sans date de versement (le versement est entre la vente et aujourd’hui)', vu('111'));

// 4. Plus de 2 000 € (en centimes) — et 2 000,00 € pile ne l’atteint pas.
dit(par['222'] && par['222'].n === 3 && Math.round(par['222'].eur * 100) === 200001 && par['222'].verdict === 'atteint', '3 ventes à 2 000,01 € : seuil atteint par le montant', vu('222'));
dit(par['333'] && par['333'].n === 29 && Math.round(par['333'].eur * 100) === 200000 && par['333'].verdict === 'sous', '29 ventes à 2 000,00 € PILE : sous les seuils (« plus de » 2 000 €)', vu('333'));

// 5. « Pas su » n'est jamais 0.
dit(par['555'] && par['555'].etat === 'pasSu' && par['555'].verdict === null, 'un compte dont la lecture a échoué est « pas su » — aucun verdict, jamais « 0 vente · sous les seuils »', vu('555'));

// 6. L'année est celle du VERSEMENT : vendue en décembre, versée en janvier → janvier.
dit(par['666'] && par['666'].n === 30 && par['666'].verdict === 'atteint', 'vendue le 28 décembre, versée le 2 janvier : elle compte pour la nouvelle année (30 → atteint)', vu('666'));
// 7. Bornes à cheval sur deux années, sans date : comptée À PART, jamais devinée.
dit(par['777'] && par['777'].n === 29 && par['777'].nInc === 1 && par['777'].verdict === 'peutEtre', 'vendue le 20 décembre, versement pas daté : « incertaine », à part — et le verdict le dit (peut-être)', vu('777'));

// 7 bis. Une vente d'il y a DEUX ans, pas datée, n'est pas « incertaine » cette année : le
//        versement suit la vente de quelques jours (25 au plus, mesuré) — sinon fausse alerte (§7).
dit(par['888'] && par['888'].n === 0 && par['888'].nInc === 0 && par['888'].verdict === 'sous', 'vendues il y a deux ans, versement pas daté : elles ne rendent pas cette année « incertaine »', vu('888'));
const D2 = essaie('la règle rend l’année d’il y a deux ans', () => appel({ annee: AN - 2 })) || [];
const p2 = (Array.isArray(D2) ? D2 : []).find(r => r.uid === '888');
dit(p2 && p2.n === 3 && p2.nInc === 0, '…et elles comptent, sûres, pour leur année', p2 ? `n=${p2.n} · inc ${p2.nInc}` : 'absent');

// 8. L'année d'AVANT : la vente de décembre versée en janvier n'y est pas ; l'incertaine y est à part.
const P = essaie('la règle rend l’année précédente', () => appel({ annee: AN - 1 })) || [];
const pp = Object.fromEntries((Array.isArray(P) ? P : []).map(r => [r.uid, r]));
dit(pp['666'] && pp['666'].n === 0 && pp['666'].nInc === 0, 'année précédente : la vente versée en janvier n’y compte pas', pp['666'] ? `n=${pp['666'].n} · inc ${pp['666'].nInc}` : 'absent');
dit(pp['777'] && pp['777'].n === 0 && pp['777'].nInc === 1, 'année précédente : la vente sans date y est « incertaine » aussi — jamais comptée deux fois comme sûre', pp['777'] ? `n=${pp['777'].n} · inc ${pp['777'].nInc}` : 'absent');
dit(pp['111'] && pp['111'].n === 0 && pp['111'].nInc === 0, 'année précédente : une vente de cette année n’y remonte pas', pp['111'] ? `n=${pp['111'].n} · inc ${pp['111'].nInc}` : 'absent');

// 9. Dates de versement ILLISIBLES (null) : rien n'est inventé, rien n'est mis à 0.
const N = essaie('la règle rend un résultat sans dates de versement', () => appel({ versements: null })) || [];
const pn = Object.fromEntries((Array.isArray(N) ? N : []).map(r => [r.uid, r]));
dit(pn['111'] && pn['111'].n === 31, 'dates de versement illisibles : les ventes de cette année restent comptées (31)', pn['111'] ? 'n=' + pn['111'].n : 'absent');
dit(pn['666'] && pn['666'].n === 29 && pn['666'].nInc === 1 && pn['666'].verdict === 'peutEtre', 'dates de versement illisibles : la vente de décembre devient « incertaine », pas comptée au hasard', pn['666'] ? `n=${pn['666'].n} · inc ${pn['666'].nInc} · ${pn['666'].verdict}` : 'absent');

// 10. Ventes pas encore lues : « en cours », aucun chiffre.
const E = essaie('la règle rend un résultat pendant la lecture', () => appel({ ventes: null })) || [];
dit(E.length === 7 && E.every(r => r.etat === 'enCours' && r.verdict === null), 'ventes pas encore lues : chaque compte est « en cours », aucun verdict', E.map(r => r.etat).join(','));

fin();
