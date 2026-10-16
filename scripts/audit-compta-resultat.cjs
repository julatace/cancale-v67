#!/usr/bin/env node
/**
 * LA COMPTABILITÉ : LE RÉSULTAT APRÈS CHARGES, LES COÛTS FIXES, LA FENÊTRE
 * FROIDE, LE CALENDRIER DE PARIS (revue de la production, 9 octobre)
 *
 * La revue de e6bda5c a trouvé, dans l'onglet Comptabilité arrivé avec main et
 * dans le registre annuel :
 *   · deux « Résultat après charges » pour la même année — l'onglet disait
 *     « CA − charges » (+260 €), le bilan « bénéfice des SEULES ventes au coût
 *     connu − charges de TOUTE l'année » (−180 €, en rouge) ;
 *   · un coût fixe saisi aujourd'hui compté 12 mois dans 2023, 2024 et 2025 ;
 *   · une saisie faite avant l'arrivée du nuage qui effaçait, à la saisie
 *     suivante, les charges saisies sur un autre appareil ;
 *   · la date proposée d'une dépense en UTC (le 1er janvier à 00:30, la veille).
 *
 * Cet audit EXÉCUTE les vraies règles d'App.jsx (extraites par l'analyseur
 * Babel, avec tout ce qu'elles appellent) dans un `vm`, sur des données
 * INVENTÉES (le dépôt est public), et juge ce qu'elles RENDENT.
 *
 *   node scripts/audit-compta-resultat.cjs                 → les règles d'App.jsx
 *   node scripts/audit-compta-resultat.cjs --mutation X    → une règle RÉAFFAIBLIE
 *        (couts · adater · manque · debut · utc · froid) — chacune doit faire
 *        passer au moins un contrôle au ROUGE (§6.1).
 *   node scripts/audit-compta-resultat.cjs --src chemin    → un autre App.jsx
 *        (le code d'avant, pour prouver que le contrôle mord).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RACINE = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (m, f) => { try { return f(); } catch (e) { dit(false, m, 'a levé : ' + String(e && e.message).slice(0, 160)); return undefined; } };
const fin = () => { console.log(ko ? `\n❌ comptabilité : ${ko} rouge(s)` : '\n✅ comptabilité : tout est vert'); process.exit(ko ? 1 : 0); };

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const MUTATION = arg('--mutation');
const SRC_CHEMIN = arg('--src') || path.join(RACINE, 'src', 'App.jsx');

let parser;
try { parser = require(path.join(RACINE, 'node_modules', '@babel', 'parser')); }
catch (e) { dit(false, 'l’analyseur Babel est disponible', e.message); fin(); }
const SRC = fs.readFileSync(SRC_CHEMIN, 'utf8');
let ast;
try { ast = parser.parse(SRC, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true }); }
catch (e) { dit(false, 'App.jsx se lit', e.message); fin(); }

// Les déclarations de MODULE, par nom → leur texte exact.
const decl = {};
for (const n of ast.program.body) {
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && d.id.name) decl[d.id.name] = SRC.slice(n.start, n.end);
  if (n.type === 'FunctionDeclaration' && n.id) decl[n.id.name] = SRC.slice(n.start, n.end);
}
const NOMS = Object.keys(decl).filter(n => /^[a-z_$][\w$]*$/i.test(n));
const ordre = [];
// (`...NOM` est une lecture : le spread ne doit pas passer pour un accès `x.NOM`.)
const tire = (nom, pile) => {
  if (!decl[nom] || ordre.includes(nom) || pile.has(nom)) return;
  pile.add(nom);
  const txt = decl[nom];
  for (const autre of NOMS) if (autre !== nom && txt.includes(autre) && new RegExp('(^|[^\\w$.]|\\.\\.\\.)' + autre.replace(/\$/g, '\\$') + '(?![\\w$])').test(txt)) tire(autre, pile);
  ordre.push(nom);
};
const REGLES = ['comptaChargesAnnee', 'resultatApresCharges', 'raisonResultat', 'rejouerCompta', 'aujourdhuiParis'];
for (const r of REGLES) tire(r, new Set());
// `C` (le thème) et ses palettes ne servent qu'aux couleurs : on ne les charge pas.
let code = ordre.filter(n => !['C', 'THEMES'].includes(n)).map(n => decl[n]).join('\n');

const MUTATIONS = {
  // le résultat chiffré malgré des coûts d'achat incomplets (le défaut du bilan)
  couts: [["if (etat === 'lu' && nc < n) causes.push(", 'if (false) causes.push(']],
  // le résultat chiffré malgré des ventes finalisées pas encore datées
  adater: [['if (nAd) causes.push(', 'if (false) causes.push(']],
  // le résultat chiffré malgré une source qui n'a pas répondu
  manque: [['if (noms.length) causes.push(', 'if (false) causes.push(']],
  // un coût fixe court depuis toujours (le défaut de l'onglet)
  debut: [['const fixeActifEn = (f, ym) => ', 'const fixeActifEn = (f, ym) => true || ']],
  // le jour de l'UTC, pas celui de Paris
  utc: [['const aujourdhuiParis = (ms = Date.now()) => { const p = partsParis(ms);', "const aujourdhuiParis = (ms = Date.now()) => { const p = (() => { const d = new Date(ms).toISOString(); return { y: +d.slice(0, 4), mo: +d.slice(5, 7), date: d.slice(0, 10) }; })();"]],
  // le rattrapage « seulement si vide » : la saisie froide garde la main
  froid: [['const out = { ...COMPTA_DEFAUT, ...d };', 'const out = { ...COMPTA_DEFAUT, ...((Array.isArray(journal) && journal.length) ? {} : d) };']],
};
if (MUTATION) {
  const m = MUTATIONS[MUTATION];
  if (!m) { dit(false, 'mutation connue', MUTATION + ' — attendu : ' + Object.keys(MUTATIONS).join(' · ')); fin(); }
  for (const [a, b] of m) {
    if (!code.includes(a)) { dit(false, `mutation « ${MUTATION} » applicable`, 'motif absent : ' + a); fin(); }
    code = code.split(a).join(b);
  }
  console.log(`(règle réaffaiblie : ${MUTATION})\n`);
}

const ctx = { console, Date, Number, String, Math, isFinite, isNaN, Set, Map, Array, Object, parseFloat, JSON, Intl, RegExp };
vm.createContext(ctx);
const presentes = REGLES.filter(n => decl[n]);
essaie('les règles se chargent', () => { vm.runInContext(code + `\n;Object.assign(this, { ${presentes.join(', ')} });`, ctx); return true; });
for (const n of REGLES) dit(typeof ctx[n] === 'function', `la règle « ${n} » est une fonction de MODULE (une règle, un propriétaire, §11)`, typeof ctx[n] === 'function' ? '' : 'introuvable');

// Paris : 9 octobre 2026, midi.
const OCT9 = Date.parse('2026-10-09T12:00:00+02:00');
const CH = ctx.comptaChargesAnnee;

// ── 1. LES COÛTS FIXES COURENT DE LEUR DÉBUT À LEUR ARRÊT ────────────────────
if (CH) {
  const saisiAujourdhui = { depenses: [], packs: [], fixes: [{ id: 'f1', libelle: 'Abonnement', montant: 30, debut: '2026-10' }] };
  const t = (an) => essaie(`charges ${an}`, () => CH(saisiAujourdhui, an, OCT9));
  for (const an of [2023, 2024, 2025]) {
    const r = t(an);
    dit(!!r && r.total === 0, `un abonnement commencé en octobre 2026 ne compte RIEN dans le bilan ${an}`, r ? `${r.total} €` : '');
  }
  const r26 = t(2026);
  dit(!!r26 && r26.total === 30, 'il compte UN mois en 2026 (octobre), pas les dix mois depuis janvier', r26 ? `${r26.total} €` : '');
  dit(!!r26 && r26.fixesParMois === 30, 'et il est dans le tarif mensuel en cours', r26 ? `${r26.fixesParMois} €` : '');
  const arrete = { fixes: [{ id: 'f2', libelle: 'Logiciel', montant: 20, debut: '2026-03', fin: '2026-06' }] };
  const a26 = essaie('charges arrêté', () => CH(arrete, 2026, OCT9));
  dit(!!a26 && a26.total === 80 && a26.fixesParMois === 0, 'arrêté fin juin : 4 mois comptés (mars → juin), plus rien dans le tarif en cours', a26 ? `${a26.total} € · ${a26.fixesParMois} €/mois` : '');
  const a27 = essaie('charges arrêté 2027', () => CH(arrete, 2027, Date.parse('2027-05-01T12:00:00+02:00')));
  dit(!!a27 && a27.total === 0, 'et rien en 2027 : l’arrêter ne le retire pas des mois où il a couru, ni ne le prolonge', a27 ? `${a27.total} €` : '');
  const avenir = essaie('charges futur', () => CH(saisiAujourdhui, 2027, OCT9));
  dit(!!avenir && avenir.total === 0, 'une année à venir ne compte aucun mois', avenir ? `${avenir.total} €` : '');
  const sansDebut = essaie('charges sans début', () => CH({ fixes: [{ id: 'f3', libelle: 'Ancien', montant: 15 }] }, 2026, OCT9));
  dit(!!sansDebut && sansDebut.total === 0 && sansDebut.fixesSansDebut === 1, 'un coût fixe SANS date de début n’est compté nulle part, et il est compté À PART pour être dit', sansDebut ? `${sansDebut.total} € · sans début ${sansDebut.fixesSansDebut}` : '');
  const dep = essaie('dépense', () => CH({ depenses: [{ id: 'd', date: '2027-01-01', montant: 50 }] }, 2027, Date.parse('2027-01-01T00:30:00+01:00')));
  dit(!!dep && dep.total === 50, 'une dépense du 1er janvier compte dans SON année', dep ? `${dep.total} €` : '');
  // Le mois en cours est celui de PARIS : le 1er novembre à 00:30 (Paris) =
  // le 31 octobre 23:30 UTC — un coût commencé en novembre y compte déjà.
  const nov = essaie('charges au 1er novembre', () => CH({ fixes: [{ id: 'f4', libelle: 'Box', montant: 10, debut: '2026-11' }] }, 2026, Date.parse('2026-11-01T00:30:00+01:00')));
  dit(!!nov && nov.total === 10, 'le 1er novembre à 00:30 (Paris), un coût commencé en novembre compte déjà — le mois en cours est celui de Paris, pas de l’UTC', nov ? `${nov.total} €` : '');
}

// ── 2. LE JOUR DE PARIS ──────────────────────────────────────────────────────
if (ctx.aujourdhuiParis) {
  const j = essaie('jour de Paris', () => ctx.aujourdhuiParis(Date.parse('2027-01-01T00:30:00+01:00')));
  dit(!!j && j.date === '2027-01-01' && j.y === 2027 && j.ym === '2027-01', 'le 1er janvier 2027 à 00:30 (Paris) est le 1er janvier 2027 — pas le 31 décembre de l’UTC', j ? j.date : '');
  const e = essaie('jour de Paris (été)', () => ctx.aujourdhuiParis(Date.parse('2026-08-01T01:30:00+02:00')));
  dit(!!e && e.date === '2026-08-01', 'le 1er août à 01:30 (heure d’été) est le 1er août', e ? e.date : '');
}

// ── 3. LE RÉSULTAT APRÈS CHARGES : UNE RÈGLE, RIEN DE CHIFFRÉ SUR DU PARTIEL ──
const R = ctx.resultatApresCharges;
if (R) {
  const base = { etat: 'lu', manque: [], nb: 3, nbCout: 3, benefNet: 150, aDater: { n: 0, eur: 0 }, charges: 100 };
  const ok = essaie('résultat complet', () => R(base));
  dit(!!ok && ok.valeur === 50 && ok.etat === 'chiffre', 'tout est connu : bénéfice net − charges = 50 €', ok ? JSON.stringify(ok) : '');
  const partiel = essaie('résultat coûts partiels', () => R({ ...base, nbCout: 1, benefNet: 60 }));
  dit(!!partiel && partiel.valeur === null && partiel.causes.some(c => c.code === 'couts'), 'coût d’achat connu sur 1 vente sur 3 : AUCUN résultat chiffré (le bilan disait −40 €, en rouge)', partiel ? JSON.stringify(partiel) : '');
  const ad = essaie('résultat à dater', () => R({ ...base, aDater: { n: 4, eur: 400 } }));
  dit(!!ad && ad.valeur === null && ad.causes.some(c => c.code === 'adater' && c.n === 4 && c.eur === 400), '4 ventes finalisées pas encore datées : le CA de l’année peut être incomplet, aucun résultat chiffré', ad ? JSON.stringify(ad) : '');
  const mq = essaie('résultat source muette', () => R({ ...base, manque: ['Leboncoin'] }));
  dit(!!mq && mq.valeur === null && mq.causes.some(c => c.code === 'manque'), 'Leboncoin n’a pas répondu : aucun résultat chiffré', mq ? JSON.stringify(mq) : '');
  const ps = essaie('résultat pas su', () => R({ ...base, etat: 'passu' }));
  dit(!!ps && ps.valeur === null && ps.causes.some(c => c.code === 'passu'), 'dates de versement Vinted illisibles : aucun résultat chiffré', ps ? JSON.stringify(ps) : '');
  const ec = essaie('résultat en cours', () => R({ ...base, etat: 'encours' }));
  dit(!!ec && ec.valeur === null && ec.etat === 'encours', 'pendant la lecture : « en cours », jamais un nombre', ec ? JSON.stringify(ec) : '');
  // L'autre sens : une année vraiment vide, avec des charges, est une vraie perte.
  const vide = essaie('résultat sans vente', () => R({ ...base, nb: 0, nbCout: 0, benefNet: 0 }));
  dit(!!vide && vide.valeur === -100, 'l’autre sens : une année lue SANS vente et 100 € de charges, c’est −100 € (un vrai chiffre, pas un « — »)', vide ? JSON.stringify(vide) : '');
  if (ctx.raisonResultat && partiel && ad) {
    const t1 = essaie('raison', () => ctx.raisonResultat(partiel)), t2 = essaie('raison', () => ctx.raisonResultat(ad)), t3 = essaie('raison courte', () => ctx.raisonResultat(ad, true));
    dit(/1 vente sur 3/.test(t1 || ''), 'la raison vient du même objet que le chiffre : « coût d’achat connu sur 1 vente sur 3 »', t1);
    dit(/4 ventes finalisées pas encore datées \(400,00 €\)/.test(t2 || ''), 'la raison dit le NOMBRE et le MONTANT des ventes pas encore datées', t2);
    dit(!!t3 && !/€/.test(t3), 'sous une case du bilan, la forme courte ne répète pas le montant déjà écrit à côté du CA (§7)', t3);
  }
}

// ── 4. LA FENÊTRE FROIDE : LES GESTES SONT REJOUÉS SUR LE NUAGE ─────────────
const RJ = ctx.rejouerCompta;
if (RJ) {
  const nuage = { depenses: [{ id: 'a', montant: 1 }, { id: 'b', montant: 2 }, { id: 'c', montant: 3 }], fixes: [{ id: 'f', montant: 30, debut: '2026-01' }], packs: [] };
  const d1 = { id: 'd1', montant: 9 };
  const r1 = essaie('rejouer un ajout', () => RJ(nuage, [{ op: 'ajout', cle: 'depenses', item: d1 }]));
  const ids1 = r1 && Array.isArray(r1.depenses) ? r1.depenses.map(x => x.id).join(',') : '';
  dit(ids1 === 'd1,a,b,c', 'une dépense saisie avant le nuage + les trois du nuage : les QUATRE restent (la saisie suivante n’efface plus rien)', ids1);
  const r2 = essaie('rejouer un retrait', () => RJ(nuage, [{ op: 'retrait', cle: 'depenses', id: 'b' }]));
  const ids2 = r2 && Array.isArray(r2.depenses) ? r2.depenses.map(x => x.id).join(',') : '';
  dit(ids2 === 'a,c', 'un retrait fait avant le nuage est rejoué sur lui', ids2);
  const r3 = essaie('rejouer un ajout déjà présent', () => RJ(nuage, [{ op: 'ajout', cle: 'depenses', item: { id: 'a', montant: 1 } }]));
  dit(!!r3 && Array.isArray(r3.depenses) && r3.depenses.length === 3, 'un geste déjà arrivé dans le nuage ne crée pas de doublon', r3 && r3.depenses ? String(r3.depenses.length) : '');
  const r4 = essaie('rejouer un arrêt', () => RJ(nuage, [{ op: 'modif', cle: 'fixes', id: 'f', champs: { fin: '2026-10' } }]));
  const f4 = r4 && Array.isArray(r4.fixes) ? r4.fixes.find(x => x && x.id === 'f') : null;
  dit(!!f4 && f4.fin === '2026-10' && f4.debut === '2026-01', 'un coût fixe arrêté avant le nuage l’est aussi après, sans perdre son début', f4 ? JSON.stringify(f4) : JSON.stringify(r4 && r4.fixes));
  const r5 = essaie('rejouer sur un nuage vide', () => RJ(null, [{ op: 'ajout', cle: 'packs', item: { id: 'p', montant: 5 } }]));
  dit(!!r5 && Array.isArray(r5.packs) && r5.packs.length === 1 && Array.isArray(r5.depenses) && Array.isArray(r5.fixes), 'premier jour (rien dans le nuage) : la saisie reste, et la forme est complète', r5 ? JSON.stringify(r5) : '');
  const r6 = essaie('aucun geste', () => RJ(nuage, []));
  dit(!!r6 && Array.isArray(r6.depenses) && r6.depenses.length === 3 && r6.depenses !== nuage.depenses, 'aucun geste : le nuage tel quel (une copie, jamais l’objet partagé)', r6 && r6.depenses ? String(r6.depenses.length) : '');
}

// ── 5. UNE RÈGLE, DEUX ÉCRANS (§11) ──────────────────────────────────────────
// Le bilan annuel ET l'onglet Comptabilité passent par la même fonction, et
// aucun des deux ne soustrait lui-même ses charges d'un CA ou d'un bénéfice.
// (Les commentaires sont neutralisés d'abord : un audit lit le CODE.)
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const corps = (debut, finMarque) => { const i = SRC.indexOf(debut); if (i < 0) return ''; const j = SRC.indexOf(finMarque, i + debut.length); return sansCommentaires(SRC.slice(i, j < 0 ? i + 20000 : j)); };
const onglet = corps('function ComptaPro(', '\nfunction ');
const bilan = corps('const annual = useMemo(', 'const [capturedReceipts');
dit(/resultatApresCharges\(/.test(onglet), 'l’onglet Comptabilité chiffre son résultat par `resultatApresCharges`', onglet ? '' : 'onglet introuvable');
dit(/resultatApresCharges\(/.test(bilan), 'le bilan annuel chiffre son résultat par `resultatApresCharges`', bilan ? '' : 'bilan introuvable');
dit(!/benefNet\s*-\s*charges\.total/.test(bilan) && !/recettesAnnee\s*-\s*chargesAnnee/.test(onglet), 'aucun des deux ne soustrait lui-même les charges (deux définitions, deux nombres)', '');

fin();
