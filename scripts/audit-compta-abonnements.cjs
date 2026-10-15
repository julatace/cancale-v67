#!/usr/bin/env node
/**
 * LES ABONNEMENTS DE LA COMPTABILITÉ (15 octobre)
 *
 * Julien : « pour les abonnements logiciels on doit pouvoir marquer le coût fixe
 * par mois, et ensuite ça nous rappelle tous les mois combien on dépense ». Un
 * abonnement a désormais une PÉRIODICITÉ (mois · trimestre · an), une catégorie,
 * une TVA quand il la connaît, et un « payé » par mois, sur son clic.
 *
 * Cet audit EXÉCUTE les vraies règles d'App.jsx (extraites par l'analyseur
 * Babel, avec tout ce qu'elles appellent) dans un `vm`, sur des données
 * INVENTÉES, et juge ce qu'elles RENDENT :
 *   · une échéance par période, alignée sur le mois de début, jamais au-delà
 *     de l'arrêt ni du mois en cours (le total de l'année) ;
 *   · le tarif « par mois » ramène l'annuel au mois, sans le compter 12 fois ;
 *   · un poste sans périodicité (saisi avant) reste MENSUEL — rien ne change ;
 *   · le rappel du mois et la prévision viennent de la MÊME règle ;
 *   · la TVA n'est jamais inventée ;
 *   · « payé » se rejoue mois par mois après la fenêtre froide, sans effacer
 *     les mois payés sur un autre appareil ;
 *   · l'écran, Ma journée et « À faire » lisent la même règle
 *     (`abonnementsAPayer`, §11), et le rappel hors de l'écran SUIT « payé »
 *     (revue du 15 octobre : Collectif réclamait 42 € déjà payés) ;
 *   · la prévision annonce la prochaine échéance même quand rien ne tombe ce
 *     mois-ci (revue du 15 octobre : un trimestriel la faisait disparaître) ;
 *   · « Boost » n'est plus une catégorie de dépense : un boost se note sur sa
 *     paire et il est déjà retiré du résultat (revue du 15 octobre).
 *
 *   node scripts/audit-compta-abonnements.cjs                → les règles d'App.jsx
 *   node scripts/audit-compta-abonnements.cjs --mutation X   → une règle RÉAFFAIBLIE
 *        (periode · lisse · paye · tva · cloche · suivi · prevision · boostcat)
 *        — chacune doit faire passer au
 *        moins un contrôle au ROUGE (§6.1).
 *   node scripts/audit-compta-abonnements.cjs --src chemin   → un autre App.jsx
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RACINE = path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (m, f) => { try { return f(); } catch (e) { dit(false, m, 'a levé : ' + String(e && e.message).slice(0, 160)); return undefined; } };
const fin = () => { console.log(ko ? `\n❌ abonnements : ${ko} rouge(s)` : '\n✅ abonnements : tout est vert'); process.exit(ko ? 1 : 0); };

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const MUTATION = arg('--mutation');
const SRC_CHEMIN = arg('--src') || path.join(RACINE, 'src', 'App.jsx');

let parser;
try { parser = require(path.join(RACINE, 'node_modules', '@babel', 'parser')); }
catch (e) { dit(false, 'l’analyseur Babel est disponible', e.message); fin(); }
let SRC = fs.readFileSync(SRC_CHEMIN, 'utf8');

const MUTATIONS = {
  // la périodicité ignorée : un abonnement annuel compté chaque mois
  periode: [['% PERIODES_ABO[periodeAbo(f)].pas === 0', '% 1 === 0']],
  // le tarif « par mois » qui ne ramène plus l'annuel au mois
  lisse: [['(Number(x.montant) || 0) / PERIODES_ABO[periodeAbo(x)].pas', '(Number(x.montant) || 0)']],
  // « payé » rejoué en remplaçant tout l'objet par la copie froide
  paye: [['const payes = { ...((x.payes && typeof x.payes === \'object\') ? x.payes : {}) };', 'const payes = {};']],
  // une TVA inventée quand aucun taux n'est connu
  tva: [["const t = Number(taux), m = Number(ttc);", "const t = Number(taux) || 20, m = Number(ttc);"]],
  // le rappel recompte de son côté (une seconde règle : ce qui court, pas ce
  // qui tombe, et « payé » ignoré)
  cloche: [['const dus = echeancesDuMois(data, ym).filter(e => !e.paye);', "const dus = ((data && data.fixes) || []).filter(f => fixeActifEn(f, ym)).map(f => ({ montant: Number(f.montant) || 0, paye: false }));"]],
  // le rappel lu hors de l'écran ne suit plus « payé » (le défaut du 15 octobre)
  suivi: [["if (e && e.detail && e.detail.k === 'vrm_compta') setTick(t => t + 1);", ';']],
  // la prévision ne regarde plus que les trois mois suivants
  prevision: [['previsionAbonnements(data, ymDeRang(ymRang(ym) + 1), 12)', 'previsionAbonnements(data, ymDeRang(ymRang(ym) + 1), 3)']],
  // « Boost » redevient une catégorie de dépense (le double compte)
  boostcat: [["'Pack photos', 'Transport'", "'Pack photos', 'Boost', 'Transport'"]],
};
if (MUTATION) {
  const m = MUTATIONS[MUTATION];
  if (!m) { dit(false, 'mutation connue', MUTATION + ' — attendu : ' + Object.keys(MUTATIONS).join(' · ')); fin(); }
  for (const [a, b] of m) {
    if (!SRC.includes(a)) { dit(false, `mutation « ${MUTATION} » applicable`, 'motif absent : ' + a); fin(); }
    SRC = SRC.split(a).join(b);
  }
  console.log(`(règle réaffaiblie : ${MUTATION})\n`);
}
let ast;
try { ast = parser.parse(SRC, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true }); }
catch (e) { dit(false, 'App.jsx se lit', e.message); fin(); }

const decl = {}, plages = [];
for (const n of ast.program.body) {
  if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && d.id.name) { decl[d.id.name] = SRC.slice(n.start, n.end); plages.push([d.id.name, n.start, n.end]); }
  if (n.type === 'FunctionDeclaration' && n.id) { decl[n.id.name] = SRC.slice(n.start, n.end); plages.push([n.id.name, n.start, n.end]); }
}
const NOMS = Object.keys(decl).filter(n => /^[a-z_$][\w$]*$/i.test(n));
const ordre = [];
const tire = (nom, pile) => {
  if (!decl[nom] || ordre.includes(nom) || pile.has(nom)) return;
  pile.add(nom);
  const txt = decl[nom];
  for (const autre of NOMS) if (autre !== nom && txt.includes(autre) && new RegExp('(^|[^\\w$.]|\\.\\.\\.)' + autre.replace(/\$/g, '\\$') + '(?![\\w$])').test(txt)) tire(autre, pile);
  ordre.push(nom);
};
const REGLES = ['echeanceFixeEn', 'comptaChargesAnnee', 'echeancesDuMois', 'previsionAbonnements', 'tvaDe', 'rejouerCompta', 'abonnementsAPayer', 'prochainesEcheances'];
for (const r of REGLES) tire(r, new Set());
const code = ordre.filter(n => !['C', 'THEMES'].includes(n)).map(n => decl[n]).join('\n');
const ctx = { console, Date, Number, String, Math, isFinite, isNaN, Set, Map, Array, Object, parseFloat, JSON, Intl, RegExp };
vm.createContext(ctx);
const presentes = REGLES.filter(n => decl[n]);
essaie('les règles se chargent', () => { vm.runInContext(code + `\n;Object.assign(this, { ${presentes.join(', ')} });`, ctx); return true; });
for (const n of REGLES) dit(typeof ctx[n] === 'function', `la règle « ${n} » est une fonction de MODULE (une règle, un propriétaire, §11)`, typeof ctx[n] === 'function' ? '' : 'introuvable');

const OCT15 = Date.parse('2026-10-15T12:00:00+02:00');
const D = {
  depenses: [], packs: [],
  fixes: [
    { id: 'm', libelle: 'Mensuel', montant: 12, debut: '2026-01', periode: 'mois', tva: 20 },
    { id: 'a', libelle: 'Annuel', montant: 120, debut: '2026-06', periode: 'an' },
    { id: 't', libelle: 'Trimestriel', montant: 30, debut: '2026-04', periode: 'trimestre' },
    { id: 'v', libelle: 'Ancien poste (sans périodicité)', montant: 5, debut: '2026-09' },
  ],
};

// ── 1. UNE ÉCHÉANCE PAR PÉRIODE ─────────────────────────────────────────────
const E = ctx.echeanceFixeEn;
if (E) {
  const a = D.fixes[1], t = D.fixes[2];
  const moisA = ['2026-05', '2026-06', '2026-07', '2027-06'].map(ym => essaie('échéance', () => E(a, ym)));
  dit(moisA.join(',') === 'false,true,false,true', 'un abonnement ANNUEL pris en juin tombe en juin, et l’année suivante en juin — jamais entre', moisA.join(','));
  const moisT = ['2026-04', '2026-05', '2026-07', '2026-10', '2026-11'].map(ym => essaie('échéance', () => E(t, ym)));
  dit(moisT.join(',') === 'true,false,true,true,false', 'un TRIMESTRIEL pris en avril tombe en avril, juillet, octobre', moisT.join(','));
  dit(essaie('arrêté', () => E({ ...a, fin: '2027-05' }, '2027-06')) === false, 'arrêté avant sa prochaine échéance : elle ne tombe pas');
}
const CH = ctx.comptaChargesAnnee;
if (CH) {
  const r = essaie('charges 2026', () => CH(D, 2026, OCT15));
  // mensuel 10 × 12 + annuel 120 + trimestriel 3 × 30 + ancien 2 × 5 = 340
  dit(!!r && Math.abs(r.total - 340) < 0.005, 'le total 2026 au 15 octobre : 10 × 12 + 1 × 120 + 3 × 30 + 2 × 5 = 340 € (l’annuel UNE fois, pas 12)', r ? `${r.total} €` : '');
  dit(!!r && Math.abs(r.fixesParMois - 37) < 0.005, '« par mois » ramène l’annuel et le trimestriel au mois : 12 + 10 + 10 + 5 = 37 €', r ? `${r.fixesParMois} €` : '');
  // ⚠️ Un audit ne meurt pas, il rapporte : une forme absente est un rouge.
  const anc = r && Array.isArray(r.fixesLignes) ? r.fixesLignes.find(x => x.id === 'v') : null;
  dit(!!anc && anc.periode === 'mois' && anc.mois === 2, 'un poste saisi avant (sans périodicité) reste MENSUEL : septembre et octobre', anc ? JSON.stringify(anc) : '');
  const r27 = essaie('charges 2027 (mai)', () => CH(D, 2027, Date.parse('2027-05-15T12:00:00+02:00')));
  const a27 = r27 && Array.isArray(r27.fixesLignes) ? r27.fixesLignes.find(x => x.id === 'a') : undefined;
  dit(!!r27 && Array.isArray(r27.fixesLignes) && !a27, 'en mai 2027, l’annuel n’a pas encore retombé (juin) : rien de compté pour lui en 2027', a27 ? JSON.stringify(a27) : '');
}

// ── 2. LE RAPPEL DU MOIS ET LA PRÉVISION, DE LA MÊME RÈGLE ─────────────────
const EM = ctx.echeancesDuMois, PR = ctx.previsionAbonnements;
if (EM) {
  const oct = essaie('octobre', () => EM(D, '2026-10'));
  dit(!!oct && oct.map(x => x.id).join(',') === 'm,t,v' && oct.every(x => x.paye === false), 'octobre : ce qui tombe (mensuel, trimestriel, ancien poste), « prévu » — pas l’annuel', oct ? oct.map(x => x.id + ':' + x.paye).join(',') : '');
  const paye = essaie('payé', () => EM({ fixes: D.fixes.map(f => f.id === 't' ? { ...f, payes: { '2026-10': true } } : f) }, '2026-10'));
  dit(!!paye && paye.find(x => x.id === 't').paye === true && paye.find(x => x.id === 'm').paye === false, '« payé » vaut pour CE mois et CE poste seulement', paye ? paye.map(x => x.id + ':' + x.paye).join(',') : '');
  const nov = essaie('payé (mois suivant)', () => EM({ fixes: D.fixes.map(f => f.id === 'm' ? { ...f, payes: { '2026-10': true } } : f) }, '2026-11'));
  dit(!!nov && nov.find(x => x.id === 'm').paye === false, 'payé en octobre ne vaut pas payé en novembre', nov ? JSON.stringify(nov.map(x => x.id + ':' + x.paye)) : '');
}
if (PR) {
  const p = essaie('prévision', () => PR(D, '2026-11', 3));
  dit(!!p && p.map(x => `${x.ym}=${x.total}`).join(',') === '2026-11=17,2026-12=17,2027-01=47', 'la prévision : novembre 17 €, décembre 17 €, janvier 47 € (le trimestriel retombe)', p ? p.map(x => `${x.ym}=${x.total}`).join(',') : '');
}
// Le RAPPEL : ce qui reste à payer ce mois-ci (revue du 15 octobre) — UNE règle
// pour l'écran, Ma journée et « À faire ».
const AP = ctx.abonnementsAPayer;
if (AP) {
  const r = essaie('à payer en octobre', () => AP(D, '2026-10'));
  dit(!!r && r.n === 3 && Math.abs(r.total - 47) < 0.005, 'à payer en octobre : ce qui TOMBE (12 + 30 + 5 = 47 €), pas l’annuel de juin', r ? `${r.n} · ${r.total} €` : '');
  const r2 = essaie('après « payé »', () => AP({ fixes: D.fixes.map(f => f.id === 't' ? { ...f, payes: { '2026-10': true } } : f) }, '2026-10'));
  dit(!!r2 && r2.n === 2 && Math.abs(r2.total - 17) < 0.005, '« payé » sur le trimestriel : il reste 2 abonnements, 17 € — le rappel suit la coche', r2 ? `${r2.n} · ${r2.total} €` : '');
}
// La prévision quand RIEN ne tombe ce mois-ci (revue du 15 octobre) : un seul
// trimestriel pris en août — rien en octobre, 45 € en novembre.
const PE = ctx.prochainesEcheances;
if (PE) {
  const q = { fixes: [{ id: 'q', libelle: 'Trimestriel', montant: 45, debut: '2026-08', periode: 'trimestre' }] };
  const p = essaie('prochaines échéances', () => PE(q, '2026-10'));
  dit(!!p && p.map(x => `${x.ym}=${x.total}`).join(',') === '2026-11=45,2027-02=45,2027-05=45', 'rien ne tombe en octobre : la prévision annonce quand même novembre, février, mai (45 €)', p ? p.map(x => `${x.ym}=${x.total}`).join(',') : '');
  const a = essaie('annuel', () => PE({ fixes: [{ id: 'a', montant: 120, debut: '2026-06', periode: 'an' }] }, '2026-10'));
  dit(!!a && a.map(x => `${x.ym}=${x.total}`).join(',') === '2027-06=120', 'un annuel pris en juin : sa prochaine échéance (juin 2027) est annoncée, à huit mois', a ? a.map(x => `${x.ym}=${x.total}`).join(',') : '');
}

// ── 3. LA TVA N'EST JAMAIS INVENTÉE ─────────────────────────────────────────
const T = ctx.tvaDe;
if (T) {
  const v = essaie('TVA 20 %', () => T(12, 20));
  dit(!!v && v.ht === 10 && v.tva === 2, '12 € TTC à 20 % : 10 € HT, 2 € de TVA', JSON.stringify(v));
  dit(essaie('sans taux', () => T(12, undefined)) === null && essaie('taux 0', () => T(12, 0)) === null && essaie('taux absurde', () => T(12, 55)) === null, 'sans taux connu (ou un taux absurde) : AUCUNE TVA — jamais un 20 % par défaut');
  if (EM) { const oct = essaie('octobre', () => EM(D, '2026-10')); dit(!!oct && oct.filter(x => x.tva).map(x => x.id).join(',') === 'm', 'dans le rappel, seule la ligne qui porte un taux a une TVA', oct ? oct.map(x => x.id + ':' + (x.tva ? x.tva.tva : '-')).join(',') : ''); }
}

// ── 4. « PAYÉ » APRÈS LA FENÊTRE FROIDE ─────────────────────────────────────
const RJ = ctx.rejouerCompta;
if (RJ) {
  const nuage = { depenses: [], packs: [], fixes: [{ id: 'm', montant: 12, debut: '2026-01', payes: { '2026-09': true } }] };
  const r = essaie('rejouer payé', () => RJ(nuage, [{ op: 'paye', cle: 'fixes', id: 'm', ym: '2026-10', val: true }]));
  const f = r && r.fixes && r.fixes[0];
  dit(!!f && f.payes && f.payes['2026-09'] === true && f.payes['2026-10'] === true, 'un « payé » d’octobre coché avant le nuage s’ajoute à septembre payé ailleurs — il ne l’efface pas', f ? JSON.stringify(f.payes) : '');
  const r2 = essaie('rejouer décoché', () => RJ(nuage, [{ op: 'paye', cle: 'fixes', id: 'm', ym: '2026-09', val: false }]));
  dit(!!r2 && r2.fixes[0].payes && r2.fixes[0].payes['2026-09'] === undefined, 'décocher retire ce mois-là, et lui seul', r2 ? JSON.stringify(r2.fixes[0].payes) : '');
}

// ── 5. UNE RÈGLE, TROIS LECTEURS : L'ÉCRAN, MA JOURNÉE, « À FAIRE » (§11) ──
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const corps = (debut, finMarque) => { const i = SRC.indexOf(debut); if (i < 0) return ''; const j = SRC.indexOf(finMarque, i + debut.length); return sansCommentaires(SRC.slice(i, j < 0 ? i + 20000 : j)); };
const onglet = corps('function ComptaPro(', '\nfunction ');
dit(/abonnementsAPayer\(/.test(onglet), 'l’écran Comptabilité lit ce qui reste à payer par `abonnementsAPayer`');
// Qui appelle `echeancesDuMois` ? Seulement la règle du rappel, la prévision et
// l'écran (sa liste du mois) — aucun autre lecteur ne recompte (la coque le
// faisait dans un effet qui ne suivait pas « payé »).
// Commentaires neutralisés EN GARDANT LES LONGUEURS (les positions doivent
// rester celles de l'analyseur, pour savoir dans quelle déclaration on est).
const code0 = SRC.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])(\/\/[^\n]*)/g, (m, a, c) => a + c.replace(/./g, ' '));
const appelants = new Set();
for (let i = code0.indexOf('echeancesDuMois('); i >= 0; i = code0.indexOf('echeancesDuMois(', i + 1)) {
  const pl = plages.filter(([, a, b]) => a <= i && i < b).map(([n]) => n);
  appelants.add(pl.length ? pl.join('/') : '?');
}
appelants.delete('echeancesDuMois');
const permis = ['abonnementsAPayer', 'previsionAbonnements', 'ComptaPro'];
dit(appelants.size > 0 && [...appelants].every(n => permis.includes(n)), 'seuls la règle du rappel, la prévision et l’écran lisent `echeancesDuMois` — la coque ne recompte plus', [...appelants].join(', '));
// Le rappel lu hors de l'écran (Ma journée, la coque) passe par le crochet qui
// SUIT `vrm_compta` — c'est ce qui manquait.
const crochet = corps('function useAbonnementsAPayer(', '\n}\n');
dit(/abonnementsAPayer\(/.test(crochet) && /vrm:save/.test(crochet) && /['"]vrm_compta['"]/.test((/addEventListener\(\s*['"]vrm:save['"][\s\S]*?\n/.exec(crochet) || [''])[0] + (/const f = [^\n]*/.exec(crochet) || [''])[0]) && /onCloudReady\(/.test(crochet),
  'le rappel hors de l’écran SUIT chaque enregistrement de `vrm_compta` (« payé ») et l’arrivée du nuage', crochet ? '' : 'crochet introuvable');
const nAppels = (code0.match(/(?<!function )useAbonnementsAPayer\(\)/g) || []).length;
dit(nAppels >= 2, 'Ma journée ET la coque (« À faire ») lisent le rappel par ce crochet', `${nAppels} appel(s)`);
dit(!/ajouterPack\b/.test(onglet), 'plus de formulaire de packs à remplir d’office (Julien, 15 octobre)');
// « Boost » n'est plus proposé en dépense : un boost se note sur sa paire et le
// registre le retire déjà du résultat — noté deux fois, il comptait deux fois.
const cats = (() => { try { return vm.runInNewContext('(' + (/const COMPTA_CATS = (\[[^\]]*\])/.exec(SRC) || [, 'null'])[1] + ')'); } catch (_) { return null; } })();
dit(Array.isArray(cats) && cats.includes('Pack photos') && !cats.some(c => /boost/i.test(c)), '« Boost » n’est plus une catégorie de dépense (le boost se note sur sa paire, déjà retiré du résultat) ; « Pack photos » reste', JSON.stringify(cats));

fin();
