// ════════════════════════════════════════════════════════════════════════════
//  GARDIEN — FAMILLE « DATES À L'HEURE DE PARIS » (11 nov., familles de l'app)
//  Une vente, un versement, une facture se classent au JOUR / MOIS de Paris.
//  Règle unique : src/dateParis.js (jourParis, moisParis, anneeParis, moisRecents).
//  Ce gardien :
//   A. exécute la règle sous trois fuseaux d'APPAREIL (New York, Tokyo, UTC) et sans Intl ;
//   B. interdit `toISOString().slice(0, 10 | 7 | 4)` dans tout src/ (le jour UTC : une
//      vente à 0 h 30 tombait la veille) — hors liste blanche NOMMÉE (zone d'un autre lot) ;
//   C. interdit, dans la chaîne de DÉCLARATION (CA déclaré, URSSAF, registres, exports,
//      factures), une clé « AAAA-MM » fabriquée avec les heures de l'APPAREIL ;
//   D. exécute les copies autonomes d'App.jsx (ymDeTs, moisDeVente, dateLocaleISO) et la
//      copie serveur (api/_lib/ventes-regle.js) sous un autre fuseau : même réponse.
//    node scripts/audit-dates-paris.cjs            → contrôle
//    node scripts/audit-dates-paris.cjs --prouve   → chaque mutation doit faire rougir
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const { prouver, sansCommentaires, fichiers, extraire } = require('./_mutations-gardien.cjs');

const R = process.env.VRM_RACINE || path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['jourParis rendu en UTC', 'src/dateParis.js', "{ timeZone: 'Europe/Paris', year: 'numeric'", "{ timeZone: 'UTC', year: 'numeric'"],
    ['secours sans Intl en UTC', 'src/dateParis.js', "return new Date(d.getTime() + decalageParis(d.getTime()) * 60000).toISOString().slice(0, 10);", "return d.toISOString().slice(0, 10);"],
    ['historique des prix au jour UTC', 'src/historiquePrix.js', "const jour = (ms) => jourParis(ms);", "const jour = (ms) => new Date(ms).toISOString().slice(0, 10);"],
    ['registres au mois de l’appareil', 'src/registres.js', "const ymLocal = (t) => moisParis(t);", "const ymLocal = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };"],
    ['ymDeTs (app) au mois de l’appareil', 'src/App.jsx', "const ymDeTs = (t) => { try { return (ymDeTs._f", "const ymDeTs = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }; const _x0 = (t) => { try { return (ymDeTs._f"],
    ['DAC7 à l’année de l’appareil', 'src/dac7Comptes.js', "const anneeDe = (t) => Number(anneeParis(t)) || NaN;", "const anneeDe = (t) => new Date(t).getFullYear();"],
  ];
  process.exit(prouver(__filename, MUT, R) ? 0 : 1);
}

// ── Sous-processus : la règle exécutée sous le fuseau de l'appareil donné ─────
if (process.argv[2] === '--fuseau') {
  (async () => {
    const out = {};
    if (process.argv[3] === 'sansIntl') { const V = Intl.DateTimeFormat; Intl.DateTimeFormat = function () { throw new Error('pas d’Intl'); }; Intl.DateTimeFormat.prototype = V.prototype; }
    let P = null; try { P = await import('file://' + path.join(R, 'src', 'dateParis.js')); } catch (_) { out.regleAbsente = true; }
    const T = { a: '2026-10-31T23:30:00Z', b: '2026-06-30T22:30:00Z', c: '2026-10-25T22:30:00Z', d: '2026-03-29T00:30:00Z', e: '2026-12-31T23:10:00Z', f: '2026-11-01T10:00:00Z' };
    if (P) {
      for (const [k, v] of Object.entries(T)) out[k] = P.jourParis(Date.parse(v));
      out.mois = P.moisParis(T.a); out.annee = P.anneeParis(T.e); out.index = P.indexMoisParis(T.a);
      out.recents = P.moisRecents(3, Date.parse(T.a)); out.illisible = P.jourParis('pas une date');
      out.texte = P.jourParis(T.a); out.date = P.jourParis(new Date(T.a));
    }
    if (process.argv[3] !== 'sansIntl') {
      const imp = async (f) => import('file://' + path.join(R, f));
      try { const M = await imp('src/registres.js'); out.registreJour = M.jourFr(Date.parse(T.a)); } catch (e) { out.registreJour = 'ERR ' + e.message; }
      try { const M = await imp('src/facturationElectronique.js'); out.facture = M.isoJour(Date.parse(T.a)) + '|' + M.ymd(Date.parse(T.a)) + '|' + M.frJour(Date.parse(T.a)); } catch (e) { out.facture = 'ERR ' + e.message; }
      try { const M = await imp('src/exportDonnees.js'); out.nomExport = M.nomExport(new Date(T.a)); } catch (e) { out.nomExport = 'ERR ' + e.message; }
      try { const M = await imp('src/exportComptable.js'); out.periodes = M.periodesExport('mois', Date.parse(T.a)).slice(0, 2).join(','); out.annees = M.periodesExport('annee', Date.parse(T.e)).join(','); } catch (e) { out.periodes = 'ERR ' + e.message; }
      try { const M = await imp('src/moisBoucle.js'); out.boucle = M.moisChoisissables(Date.parse(T.a), 2).join(','); } catch (e) { out.boucle = 'ERR ' + e.message; }
      try { const M = await imp('src/objectifMois.js'); out.objectif = M.ymDe(Date.parse(T.a)); } catch (e) { out.objectif = 'ERR ' + e.message; }
      try { const M = await imp('src/comparerMois.js'); out.comparer = M.ymDe(Date.parse(T.a)); } catch (e) { out.comparer = 'ERR ' + e.message; }
      try { const M = await imp('src/clotureAnnee.js'); out.cloture = M.jourIso(Date.parse(T.a)); } catch (e) { out.cloture = 'ERR ' + e.message; }
      try { const M = await imp('src/inventaireAnnuel.js'); out.inventaire = M.isoJour(Date.parse(T.a)); } catch (e) { out.inventaire = 'ERR ' + e.message; }
      try { const M = await imp('api/_lib/ventes-regle.js'); out.serveur = M.ymDeTs(Date.parse(T.a)); } catch (e) { out.serveur = 'ERR ' + e.message; }
      // Les copies autonomes d'App.jsx, exécutées seules (comme les audits de la compta les exécutent).
      try {
        const APP = require(path.join(R, 'scripts', '_source-app.cjs')).sourceApp(R);
        const sb = { Date, Number, String, Math, isFinite, tsCommande: (o) => Date.parse(o.date) };
        vm.createContext(sb);
        const src = ['ymDeTs', 'moisDeVente', 'dateLocaleISO'].map((n) => (extraire(APP, n) || '').replace(/^const /mg, 'var ')).join('\n');
        vm.runInContext(src + '\n;this.r = { ymDeTs, moisDeVente, dateLocaleISO };', sb);
        out.appYm = sb.r.ymDeTs(Date.parse(T.a)); out.appMoisVente = sb.r.moisDeVente({ date: T.a });
        const RealDate = Date; const fixe = RealDate.parse(T.a);
        class D extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixe); } static now() { return fixe; } }
        sb.Date = D; vm.runInContext('Date = this.Date;', sb);
        out.appAuj = sb.r.dateLocaleISO();
      } catch (e) { out.appYm = 'ERR ' + e.message; }
    }
    console.log(JSON.stringify(out));
  })();
  return;
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const lance = (tz, mode) => {
  const r = spawnSync('node', [__filename, '--fuseau', mode || ''], { encoding: 'utf8', env: { ...process.env, TZ: tz, VRM_RACINE: R } });
  try { return JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch (_) { return { erreur: (r.stderr || r.stdout || '').slice(0, 300) }; }
};

console.log('── A · La règle (src/dateParis.js) sous trois fuseaux d’appareil, et sans Intl');
const ATTENDU = { a: '2026-11-01', b: '2026-07-01', c: '2026-10-25', d: '2026-03-29', e: '2027-01-01', f: '2026-11-01', mois: '2026-11', annee: '2027', index: 10, recents: ['2026-11', '2026-10', '2026-09'], illisible: '', texte: '2026-11-01', date: '2026-11-01' };
for (const [tz, mode] of [['America/New_York'], ['Asia/Tokyo'], ['UTC'], ['America/Los_Angeles', 'sansIntl']]) {
  const o = lance(tz, mode);
  const faux = Object.keys(ATTENDU).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(ATTENDU[k]));
  dit(!faux.length, `appareil en ${tz}${mode ? ' (sans Intl)' : ''} : 1er nov. 0 h 30, 1er juil. 0 h 30, changements d’heure, 1er janv. ⇒ jour de Paris`, faux.map((k) => `${k}=${JSON.stringify(o[k])} au lieu de ${JSON.stringify(ATTENDU[k])}`).join(' ; ') || o.erreur);
  if (!mode) {
    dit(o.registreJour === '01/11/2026', `${tz} : registres (livre des recettes) au jour de Paris`, o.registreJour);
    dit(o.facture === '2026-11-01|20261101|01/11/2026', `${tz} : facture électronique datée au jour de Paris`, o.facture);
    dit(o.nomExport === 'VRM-donnees-2026-11-01.zip', `${tz} : export « Tes données » daté au jour de Paris`, o.nomExport);
    dit(o.periodes === '2026-11,2026-10' && o.annees === '2027,2026', `${tz} : périodes de l’export comptable à partir du mois de Paris`, `${o.periodes} / ${o.annees}`);
    dit(o.boucle === '2026-11,2026-10', `${tz} : « Boucler le mois » propose les mois de Paris`, o.boucle);
    dit(o.objectif === '2026-11' && o.comparer === '2026-11', `${tz} : objectif du mois et comparaison au mois de Paris`, `${o.objectif} / ${o.comparer}`);
    dit(o.cloture === '2026-11-01' && o.inventaire === '2026-11-01', `${tz} : clôture de l’année et inventaire au jour de Paris`, `${o.cloture} / ${o.inventaire}`);
    dit(o.serveur === '2026-11', `${tz} : copie serveur (api/_lib/ventes-regle.js) au mois de Paris`, o.serveur);
    dit(o.appYm === '2026-11' && o.appMoisVente === '2026-11' && o.appAuj === '2026-11-01', `${tz} : App.jsx (ymDeTs, moisDeVente, dateLocaleISO exécutées seules) au mois/jour de Paris`, `${o.appYm} / ${o.appMoisVente} / ${o.appAuj}`);
  }
}

console.log('\n── B · Aucun jour UTC (`toISOString().slice(0, 10|7|4)`) dans src/');
// Liste blanche NOMMÉE : zone d'un autre lot (Colis, agent principal) — à reprendre là-bas.
const BLANCHE = [
  ['src/colisEnvoi.js', 'secours sans Intl du jour d’envoi (zone Colis, agent principal)'],
  ['src/App.jsx', 'attribut de banc `data-sorti-at` des retraits (zone Colis, agent principal)'],
];
const MOTIF_UTC = /toISOString\(\)\s*\.\s*slice\(\s*0\s*,\s*(10|7|4)\s*\)/g;
const trouves = [];
for (const f of fichiers(path.join(R, 'src'))) {
  const rel = path.relative(R, f).split(path.sep).join('/');
  if (rel === 'src/dateParis.js') continue;
  const t = sansCommentaires(fs.readFileSync(f, 'utf8'));
  const n = (t.match(MOTIF_UTC) || []).length;
  if (n) trouves.push([rel, n, t]);
}
const horsListe = trouves.filter(([rel]) => !BLANCHE.some(([b]) => b === rel));
dit(!horsListe.length, 'aucun `toISOString().slice(0, 10|7|4)` hors de src/dateParis.js (une vente à 0 h 30 n’est jamais datée la veille)', horsListe.map(([r, n]) => `${r} ×${n}`).join(', '));
const app = trouves.find(([r]) => r === 'src/App.jsx');
dit(!app || (app[1] === 1 && /data-sorti-at=\{[^}]*toISOString\(\)\.slice\(0, 10\)/.test(app[2])), 'App.jsx : le seul jour UTC restant est l’attribut de banc des retraits (zone Colis)', app ? `${app[1]} occurrence(s)` : '');

console.log('\n── C · La chaîne de DÉCLARATION ne fabrique aucune clé de mois avec l’heure de l’APPAREIL');
const DECLARATION = ['src/registres.js', 'src/recapMois.js', 'src/exportComptable.js', 'src/exportDonnees.js', 'src/moisBoucle.js', 'src/facturationElectronique.js',
  'src/comparerMois.js', 'src/objectifMois.js', 'src/statsPlus.js', 'src/clotureAnnee.js', 'src/inventaireAnnuel.js', 'src/rapportMois.js', 'src/dac7Comptes.js',
  'src/historiquePrix.js', 'src/suggestionsAchat.js', 'src/notesRecues.js', 'src/satisfaction.js'];
const CLE_APPAREIL = /\$\{\s*[\w.()]+\.getFullYear\(\)\s*\}\s*-?\s*\$\{|getFullYear\(\)\s*\+\s*'-'|new Date\([^)]*\)\.getFullYear\(\)/;
for (const f of DECLARATION) {
  let t = '';
  try { t = sansCommentaires(fs.readFileSync(path.join(R, f), 'utf8')); } catch (_) { dit(false, `${f} lisible`); continue; }
  const m = CLE_APPAREIL.exec(t);
  dit(!m, `${f} : jour/mois/année d’un instant pris à Paris (src/dateParis.js)`, m ? m[0] : '');
}
{
  const APP = sansCommentaires(require(path.join(R, 'scripts', '_source-app.cjs')).sourceApp(R));
  for (const n of ['ymDeTs', 'moisDeVente', 'dateLocaleISO', 'ventesDeclarables']) {
    const t = extraire(APP, n) || '';
    dit(t && !CLE_APPAREIL.test(t) && !MOTIF_UTC.test(t), `App.jsx \`${n}\` : ni heure de l’appareil, ni jour UTC`, t ? t.slice(0, 120) : 'introuvable');
    MOTIF_UTC.lastIndex = 0;
  }
}

console.log(`\n${ko ? '❌' : '✅'} dates à l’heure de Paris : ${ok} vert(s), ${ko} rouge(s)`);
process.exit(ko ? 1 : 0);
