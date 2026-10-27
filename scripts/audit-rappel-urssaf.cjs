// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LE RAPPEL URSSAF À L'ÉCHÉANCE (20 octobre) — ET SA NOTIFICATION DU 1er (22 octobre)
//         node scripts/audit-rappel-urssaf.cjs [--mutation=…]   ·   --recopie
// ═══════════════════════════════════════════════════════════════════════════
// Le rappel du 30 septembre partait le 1er de chaque mois, quel que soit le
// rythme (trimestriel : deux rappels sur trois pour une déclaration qui n'existe
// pas encore), sans date ni montant, même pour un mois déjà noté « déclaré ».
// Cet audit EXÉCUTE la vraie règle `rappelUrssaf` (extraite d'App.jsx, dans un
// vm) sur des dates et une ligne publiée INVENTÉES.
// (22 oct.) La NOTIFICATION du 1er (api/ship-reminders.js) avait gardé l'ancien
// texte fixe : sans montant, et elle sonnait pour un mois déjà noté. Elle passe
// par la MÊME règle, recopiée dans api/_lib/urssaf-regle.js (un miroir, pas une
// copie) — cet audit exige :
//   1. le miroir = la règle de l'app, au JETON près (Babel), et les mêmes
//      résultats sur les mêmes dates ;
//   2. la notification donne le montant de la ligne PUBLIÉE, se tait sur un
//      mois noté, suit le rythme, et « pas su » ⇒ le rappel sans montant ;
//   3. le VRAI cron (ship-reminders.js) exécuté un 1er octobre, faux Web Push :
//      ce qui part sur le téléphone, et rien quand le mois est noté.
// `--mutation=…` réaffaiblit une règle : chaque mutation doit faire passer au
// moins un contrôle au rouge. Aucune donnée réelle : tout est inventé ici.
//   rythme · declare · zero · fenetre · date · ancienne · fuseau   (la règle de l'app)
//   serveur-registre · serveur-montant · serveur-passu · serveur-ancienne   (la notification)
// (22 oct., revue) Deux défauts reproduits par le relecteur : une ligne publiée
// AVANT la période faisait dire « à payer ≈ au moins 0,00 € » (un zéro qui veut
// dire « pas su ») ; et la fin de la période se jugeait en heure LOCALE — UTC
// sur le serveur, Paris dans l'app : la notification disait « au moins » quand
// Ma journée ne le disait pas. La section 4 exécute la règle sous TZ=UTC et
// TZ=Europe/Paris, dans deux processus.
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const R = path.join(__dirname, '..');
let parser;
try { parser = require(path.join(R, 'node_modules', '@babel', 'parser')); }
catch (e) { console.log('❌ l\'analyseur Babel est disponible — ' + e.message); process.exit(1); }
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let src = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
const muter = (avant, apres) => { if (!src.includes(avant)) { console.log('❌ mutation impossible : motif absent'); process.exit(2); } src = src.replace(avant, apres); };
if (MUT === 'rythme') muter('if (_startOfDay(now) <= _startOfDay(due.periodEnd)) return null;', '');
else if (MUT === 'declare') muter('yms.every((ym) => moisDeclare(declare, ym))) return null;', 'false) return null;');
else if (MUT === 'zero') muter('return { ca: null, apayer: null, partiel: false };', 'return { ca: 0, apayer: 0, partiel: false };');
else if (MUT === 'fenetre') muter('const proche = due.daysLeft <= 7;', 'const proche = false;');
else if (MUT === 'date') muter('|| !(atPub >= finPeriode);', ';');
else if (MUT === 'ancienne') muter('if (atPub < debutPeriode || (!porte && partiel)) return { ca: null, apayer: null, partiel: false };', '');
else if (MUT === 'fuseau') muter('const finPeriode = minuitParisMs(due.periodEnd.getFullYear(), due.periodEnd.getMonth(), due.periodEnd.getDate() + 1);', 'const finPeriode = new Date(due.periodEnd.getFullYear(), due.periodEnd.getMonth(), due.periodEnd.getDate() + 1).getTime();');
else if (MUT && !MUT.startsWith('serveur-')) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 200)); } };

// Les déclarations de premier niveau d'un fichier, par nom : le texte (pour le
// vm) et les JETONS (commentaires et blancs mis à part) pour la comparaison.
function declarations(code, plugins) {
  const out = new Map();
  if (code == null) return out;
  const ast = parser.parse(code, { sourceType: 'module', plugins, errorRecovery: true, tokens: true });
  for (const n of ast.program.body) {
    const d0 = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
    if (!d0) continue;
    if (d0.type === 'FunctionDeclaration' && d0.id) out.set(d0.id.name, { texte: code.slice(d0.start, d0.end), jetons: '' });
    if (d0.type !== 'VariableDeclaration') continue;
    for (const v of d0.declarations) {
      if (!v.id || !v.id.name || out.has(v.id.name)) continue;
      const jetons = ast.tokens.filter((t) => t.start >= v.start && t.end <= v.end && t.type !== 'CommentLine' && t.type !== 'CommentBlock')
        .map((t) => (t.type && t.type.label ? t.type.label : t.type) + ':' + (t.value === undefined ? '' : String(t.value))).join(' ');
      out.set(v.id.name, { texte: `${d0.kind} ${code.slice(v.start, v.end)};`, jetons });
    }
  }
  return out;
}
const decl = declarations(src, ['jsx']);
// Ce que le miroir porte (et que le vm de l'app exécute) — l'ordre est celui du fichier.
const NOMS = ['TAUX_URSSAF_DEFAUT', 'tauxDe', 'aPayerUrssaf', '_startOfDay', 'nextUrssafDeadline', 'moisPeriodeUrssaf', 'minuitParisMs', 'montantPeriodeUrssaf', 'moisDeclare', 'rappelUrssaf'];
const MIROIR = path.join(R, 'api', '_lib', 'urssaf-regle.js');

// ── --recopie : refabrique le miroir (le SEUL moyen de le modifier) ─────────
if (process.argv.includes('--recopie')) {
  const actuel = fs.existsSync(MIROIR) ? fs.readFileSync(MIROIR, 'utf8') : '';
  const i = actuel.indexOf('export const ');
  const tete = i >= 0 ? actuel.slice(0, i) : actuel;
  let corps = tete;
  for (const n of NOMS) { if (!decl.has(n)) { console.log(`❌ ${n} introuvable dans App.jsx`); process.exit(1); } corps += 'export ' + decl.get(n).texte + '\n\n'; }
  fs.writeFileSync(MIROIR, corps.replace(/\n+$/, '\n'));
  console.log(`✅ miroir refabriqué (${NOMS.length} déclarations)`);
  process.exit(0);
}

(async () => {
  const VOULUS = ['_startOfDay', 'nextUrssafDeadline', 'aPayerUrssaf', 'moisDeclare', 'rappelUrssaf'];
  const manq = VOULUS.filter((k) => !decl.has(k));
  dit(!manq.length, 'la règle `rappelUrssaf` existe dans App.jsx', manq.join(', '));
  if (manq.length) { console.log(`\n❌ audit-rappel-urssaf : ${ko} rouge(s)`); process.exit(1); }
  const ctx = { tauxUrssaf: () => 13.5, Date, Math, Number, String, Array, isFinite };
  vm.createContext(ctx);
  // Les déclarations présentes (le code d'avant n'a ni `tauxDe` ni `moisPeriodeUrssaf`).
  vm.runInContext(NOMS.filter((k) => decl.has(k)).map((k) => decl.get(k).texte).join('\n') + '\nthis.rappelUrssaf = rappelUrssaf;', ctx);
  const r = (o) => ctx.rappelUrssaf({ taux: 13.5, ...o });
  const LIGNE = { mois: [{ ym: '2026-07', ca: 100 }, { ym: '2026-08', ca: 200 }, { ym: '2026-09', ca: 300 }, { ym: '2026-10', ca: 999 }] };

  console.log('── 0. La règle de l\'app (Ma journée)');
  await essaie('trimestriel, 1er novembre', () => {
    const x = r({ freq: 'trimestriel', now: new Date(2026, 10, 1, 10) });
    dit(x === null, 'trimestriel en milieu de trimestre : aucun rappel le 1er du mois', x && x.text);
  });
  await essaie('trimestriel, 2 octobre', () => {
    const x = r({ freq: 'trimestriel', now: new Date(2026, 9, 2, 10), ligne: LIGNE });
    dit(!!(x && /T3 2026/.test(x.text) && /31 octobre/.test(x.text)), 'trimestriel, début du mois après le trimestre : rappel daté', x && x.text);
    dit(!!(x && x.ca === 600 && x.apayer === 81), 'le montant somme les mois DE la période seulement (600 € → 81 €)', x && `${x.ca} · ${x.apayer}`);
  });
  await essaie('trimestriel, 15 octobre', () => {
    const x = r({ freq: 'trimestriel', now: new Date(2026, 9, 15, 10) });
    dit(x === null, 'au milieu du mois de déclaration, loin de l\'échéance : rien', x && x.text);
  });
  await essaie('trimestriel, 27 octobre', () => {
    const x = r({ freq: 'trimestriel', now: new Date(2026, 9, 27, 10), ligne: LIGNE });
    dit(!!(x && x.proche && /dans 4 jours/.test(x.text)), 'les 7 derniers jours avant l\'échéance : rappel avec le délai', x && x.text);
  });
  await essaie('déjà déclarée', () => {
    const declare = { '2026-07': { ids: [] }, '2026-08': { ids: [] }, '2026-09': { ids: ['v:1'] } };
    const x = r({ freq: 'trimestriel', now: new Date(2026, 9, 27, 10), declare });
    dit(x === null, 'les trois mois notés « déclaré » : plus de rappel', x && x.text);
    const y = r({ freq: 'trimestriel', now: new Date(2026, 9, 27, 10), declare: { '2026-09': { ids: [] } } });
    dit(!!y, 'un seul mois noté sur trois : le rappel reste');
    // (22 oct.) « C'est déclaré » ouvre le formulaire sur le PREMIER mois pas noté.
    dit(!!(y && Array.isArray(y.aNoter) && y.aNoter.join(',') === '2026-07,2026-08'), 'les mois encore à noter sont rendus (juillet, août — septembre est noté)', y && JSON.stringify(y.aNoter));
  });
  await essaie('mensuel', () => {
    const x = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: LIGNE });
    dit(!!(x && /septembre 2026/.test(x.text) && x.ca === 300), 'mensuel, le 1er : septembre à déclarer, 300 €', x && x.text);
    dit(!!(x && Array.isArray(x.aNoter) && x.aNoter.join(',') === '2026-09'), 'mensuel : le mois à noter est septembre', x && JSON.stringify(x.aNoter));
    dit(r({ freq: 'mensuel', now: new Date(2026, 9, 12, 10) }) === null, 'mensuel, le 12 : rien');
  });
  await essaie('pas de ligne publiée', () => {
    const x = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: null });
    dit(!!(x && x.apayer == null && x.ca == null && !/0,00/.test(x.sub)), 'sans ligne publiée : aucun montant, jamais 0', x && x.sub);
  });
  await essaie('ventes à dater', () => {
    const x = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: { ...LIGNE, aDater: { n: 2 } } });
    dit(!!(x && x.partiel && /au moins/i.test(x.sub)), 'des ventes sans date de versement : « au moins »', x && x.sub);
  });
  await essaie('ligne publiée avant la fin de la période', () => {
    const avant = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: { ...LIGNE, at: new Date(2026, 8, 28, 20).getTime() } });
    dit(!!(avant && avant.partiel && /au moins/i.test(avant.sub)), 'publiée le 28 septembre : le total de septembre est un minimum (« au moins »)', avant && avant.sub);
    const apres = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: { ...LIGNE, at: new Date(2026, 9, 1, 2).getTime() } });
    dit(!!(apres && !apres.partiel && !/au moins/i.test(apres.sub)), 'publiée après la fin du mois : le total se dit tel quel', apres && apres.sub);
  });
  // (22 oct., revue) Un « au moins 0,00 € » est un zéro qui veut dire « pas su » (§7).
  const SANS_SEPT = { mois: [{ ym: '2026-07', ca: 900 }, { ym: '2026-08', ca: 500 }] };
  await essaie('ligne publiée avant le début de la période', () => {
    const x = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: { ...SANS_SEPT, at: Date.parse('2026-08-20T10:00:00Z') } });
    dit(!!(x && x.apayer == null && x.ca == null && !/0,00/.test(x.sub) && /se calcule dans Ventes/.test(x.sub)), 'publiée le 20 août, septembre à déclarer : aucun montant (« se calcule dans Ventes »), jamais « au moins 0,00 € »', x && x.sub);
  });
  await essaie('ligne sans aucun mois de la période, publiée avant sa fin', () => {
    const x = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: { ...SANS_SEPT, at: Date.parse('2026-09-05T10:00:00Z') } });
    dit(!!(x && x.apayer == null && !/0,00/.test(x.sub)), 'publiée le 5 septembre sans aucune vente de septembre : aucun montant', x && x.sub);
    const y = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: { ...SANS_SEPT, aDater: { n: 3 }, at: Date.parse('2026-10-01T06:00:00Z') } });
    dit(!!(y && y.apayer == null && !/0,00/.test(y.sub)), 'publiée après la fin, aucun mois de septembre mais des ventes sans date : aucun montant (« au moins 0 » ne dit rien)', y && y.sub);
    const z = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 10), ligne: { ...SANS_SEPT, at: Date.parse('2026-10-01T06:00:00Z') } });
    dit(!!(z && z.ca === 0 && z.apayer === 0 && !z.partiel && /0,00 € reçus/.test(z.sub) && !/au moins/i.test(z.sub)), 'l\'autre sens : publiée APRÈS la fin, lue et sans vente de septembre : un vrai 0,00 €, dit tel quel', z && z.sub);
  });
  const code = fs.readFileSync(path.join(R, 'src', 'App.jsx'), 'utf8');
  dit(!/Nouveau mois : pense à ta déclaration URSSAF/.test(code), 'l\'ancien rappel fixe du 1er du mois a disparu');
  dit(/rappelUrssaf\(\{\s*freq:/.test(code), 'le centre de notifications appelle `rappelUrssaf`');

  // ── 1. Le miroir serveur est la règle de l'app ──────────────────────────────
  console.log('\n── 1. Le miroir (api/_lib/urssaf-regle.js) est la règle de l\'app, au jeton près');
  const miroirSrc = fs.existsSync(MIROIR) ? fs.readFileSync(MIROIR, 'utf8') : null;
  dit(miroirSrc != null, 'le serveur porte un miroir de la règle', miroirSrc != null ? '' : 'api/_lib/urssaf-regle.js absent : la notification ne peut pas suivre la règle de l\'app');
  const declSrv = declarations(miroirSrc, []);
  for (const n of NOMS) {
    const a = decl.get(n), b = declSrv.get(n);
    dit(!!a && !!b && a.jetons === b.jetons, `${n} : identique dans App.jsx et le miroir`,
      !b ? 'absent du serveur' : !a ? 'absent de l\'app' : a.jetons === b.jetons ? '' : 'le code diffère — `--recopie` après avoir vérifié la règle de l\'app');
  }

  // Les fichiers serveur, éventuellement réaffaiblis dans une COPIE (jamais le dépôt).
  let API = path.join(R, 'api');
  if (MUT.startsWith('serveur-')) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-urssaf-'));
    fs.cpSync(API, path.join(tmp, 'api'), { recursive: true });
    fs.copyFileSync(path.join(R, 'package.json'), path.join(tmp, 'package.json'));
    fs.symlinkSync(path.join(R, 'node_modules'), path.join(tmp, 'node_modules'));
    API = path.join(tmp, 'api');
    const f = path.join(API, '_lib', 'rappel-urssaf.js');
    let g = fs.readFileSync(f, 'utf8');
    const m = (a, b) => { if (!g.includes(a)) { console.log('❌ mutation impossible : motif absent'); process.exit(2); } g = g.replace(a, b); };
    if (MUT === 'serveur-registre') m('const declare = objet(mm.vrm_urssaf_declare);', 'const declare = {};');
    else if (MUT === 'serveur-montant') m('const ligne = mm.vinted_urssaf_mois && Array.isArray(mm.vinted_urssaf_mois.mois) ? mm.vinted_urssaf_mois : null;', 'const ligne = null;');
    else if (MUT === 'serveur-passu') m("if (main === undefined) return { envoyer: false,", "if (main === undefined) return { envoyer: true, titre: TITRE_URSSAF, corps: RAPPEL_SANS_MONTANT, url, montant: null, raison: 'x' }; if (false) return { envoyer: false,");
    else if (MUT === 'serveur-statut') m("if (!main || main.vinted_regime !== 'micro')", "if (!main)");
    else if (MUT === 'serveur-ancienne') {
      const f2 = path.join(API, '_lib', 'urssaf-regle.js');
      const motif = 'if (atPub < debutPeriode || (!porte && partiel)) return { ca: null, apayer: null, partiel: false };';
      const g2 = fs.readFileSync(f2, 'utf8');
      if (!g2.includes(motif)) { console.log('❌ mutation impossible : motif absent'); process.exit(2); }
      fs.writeFileSync(f2, g2.replace(motif, ''));
    }
    else { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
    fs.writeFileSync(f, g);
  }

  let srv = null, glue = null;
  await essaie('le miroir se charge', async () => { srv = await import('file://' + path.join(API, '_lib', 'urssaf-regle.js')); });
  await essaie('la règle de la notification se charge', async () => { glue = await import('file://' + path.join(API, '_lib', 'rappel-urssaf.js')); });
  if (srv && srv.rappelUrssaf) {
    const cas = [
      { freq: 'mensuel', now: new Date(2026, 9, 1, 12), ligne: LIGNE },
      { freq: 'mensuel', now: new Date(2026, 9, 27, 12), ligne: { ...LIGNE, aDater: { n: 2 } } },
      { freq: 'trimestriel', now: new Date(2026, 9, 2, 12), ligne: LIGNE, declare: { '2026-08': { ids: [] } } },
      { freq: 'trimestriel', now: new Date(2026, 9, 27, 12), declare: { '2026-07': { ids: [] }, '2026-08': { ids: [] }, '2026-09': { ids: [] } } },
      { freq: 'trimestriel', now: new Date(2026, 10, 1, 12), ligne: LIGNE },
      { freq: 'mensuel', now: new Date(2026, 9, 1, 12), ligne: null },
    ];
    const diff = cas.filter((c) => JSON.stringify(r(c)) !== JSON.stringify(srv.rappelUrssaf({ taux: 13.5, ...c })));
    dit(!diff.length, `exécutés sur les mêmes dates, l'app et le miroir rendent la même chose (${cas.length} cas)`, diff.map((c) => c.freq + ' ' + c.now.toISOString().slice(0, 10)).join(' · '));
    dit(srv.tauxDe && srv.tauxDe('12,3') === 12.3 && srv.tauxDe(undefined) === 12.4 && srv.tauxDe('99') === 12.4, 'le taux se lit par la règle de l\'app (virgule, défaut 12,4 = achat-revente, borné à 50)');
  }

  // ── 2. La notification : la règle, le montant publié, « pas su » ──────────
  console.log('\n── 2. La notification du 1er (règle pure, api/_lib/rappel-urssaf.js)');
  // Publiée le 1er octobre au matin (après la fin de septembre) : un total complet.
  const PUB = { at: Date.parse('2026-10-01T06:00:00Z'), mois: [{ ym: '2026-09', ca: 4330.9, n: 89 }, { ym: '2026-10', ca: 999, n: 9 }] };
  // (27 oct.) Le rappel ne concerne qu'un micro-entrepreneur : les scénarios
  // ci-dessous sont les siens (`vinted_regime: 'micro'`), la section « statut » juge les autres.
  const N = (main, today = '2026-10-01') => glue.notificationUrssaf({ today, main: main && typeof main === 'object' && !('vinted_regime' in main) ? { vinted_regime: 'micro', vinted_urssaf_taux: '13,5', ...main } : main });
  await essaie('notification : mois à déclarer', () => {
    const n = N({ vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: PUB });
    dit(!!(n && n.envoyer), 'mensuel, 1er octobre, septembre pas noté : la notification part', n && n.raison);
    dit(!!(n && n.montant === 584.67 && /4330,90 €/.test(n.corps) && /584,67 €/.test(n.corps)), 'elle donne le montant de la ligne PUBLIÉE (4 330,90 € reçus, 584,67 € à payer)', n && n.corps);
    dit(!!(n && /31 octobre/.test(n.corps)), 'et l\'échéance (avant le 31 octobre)', n && n.corps);
    dit(!!(n && !/au moins/i.test(n.corps)), 'ligne publiée après la fin du mois : le montant se dit tel quel', n && n.corps);
    const p = N({ vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: { ...PUB, at: Date.parse('2026-09-27T18:00:00Z') } });
    dit(!!(p && p.envoyer && /au moins 4330,90 €/i.test(p.corps)), 'ligne publiée le 27 septembre : « au moins » (les ventes versées depuis n\'y sont pas)', p && p.corps);
    const app = r({ freq: 'mensuel', now: new Date(2026, 9, 1, 12), ligne: PUB });
    dit(!!(n && app && n.corps === `${app.text}. ${app.sub}`), 'mot pour mot la phrase de Ma journée (même règle, §11)', n && n.corps);
  });
  await essaie('notification : ligne publiée avant la période', () => {
    // La sonde du relecteur : Ventes pas rouvert depuis le 20 août.
    const ancienne = { at: Date.parse('2026-08-20T10:00:00Z'), mois: [{ ym: '2026-08', ca: 500, n: 5 }, { ym: '2026-07', ca: 900, n: 9 }], aDater: { n: 0 } };
    const n = N({ vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: ancienne, vrm_urssaf_declare: {} });
    dit(!!(n && n.envoyer && n.montant == null && !/0,00/.test(n.corps) && /se calcule dans Ventes/.test(n.corps)), 'ligne du 20 août, le 1er octobre : le rappel part SANS montant, jamais « à payer ≈ au moins 0,00 € »', n && n.corps);
  });
  await essaie('notification : mois noté', () => {
    const n = N({ vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: PUB, vrm_urssaf_declare: { '2026-09': { ids: ['vinted:1'], n: 1, ca: 4330.9, at: 1 } } });
    dit(!!(n && !n.envoyer), 'septembre noté « déclaré » : elle ne sonne plus', n && n.raison);
  });
  await essaie('notification : rythme', () => {
    const n = N({ vinted_urssaf_mois: PUB }, '2026-11-01');
    dit(!!(n && !n.envoyer), 'trimestriel (le défaut), 1er novembre : T4 pas fini, rien', n && n.raison);
    const t = N({ vinted_urssaf_freq: 'trimestriel', vinted_urssaf_mois: { at: PUB.at, mois: [{ ym: '2026-07', ca: 100 }, { ym: '2026-08', ca: 200 }, { ym: '2026-09', ca: 300 }] } });
    dit(!!(t && t.envoyer && t.montant === 81), 'trimestriel, 1er octobre : T3, 600 € reçus → 81 €', t && t.corps);
  });
  await essaie('notification : taux du vendeur', () => {
    const n = N({ vinted_urssaf_freq: 'mensuel', vinted_urssaf_taux: '21,2', vinted_urssaf_mois: { at: PUB.at, mois: [{ ym: '2026-09', ca: 100 }] } });
    dit(!!(n && n.montant === 21.2), 'son taux réglé (21,2 %) est celui de la notification', n && String(n.montant));
  });
  await essaie('notification : pas su', () => {
    const n = N(undefined);
    dit(!!(n && !n.envoyer), '« pas su » (main illisible) : on ne sait pas s\'il est micro-entrepreneur — rien ne part (Ma journée le rappelle)', n && n.raison);
    const s = N({ vinted_urssaf_freq: 'mensuel' });
    dit(!!(s && s.envoyer && s.montant == null && !/\d,\d\d €/.test(s.corps)), 'jamais publiée : le rappel, sans montant (jamais 0)', s && s.corps);
  });

  await essaie('notification : statut (27 oct.)', () => {
    for (const [r, nom] of [[undefined, 'jamais choisi'], ['particulier', 'particulier'], ['societe', 'société'], ['marge', 'régime de la marge']]) {
      const n = glue.notificationUrssaf({ today: '2026-10-01', main: { ...(r ? { vinted_regime: r } : {}), vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: PUB } });
      dit(!!(n && !n.envoyer), `statut ${nom} : aucune notification URSSAF`, n && n.raison);
    }
  });

  // ── 3. Le VRAI cron, un 1er octobre ─────────────────────────────────────────
  console.log('\n── 3. Le vrai cron (api/ship-reminders.js), le 1er octobre, faux Web Push');
  process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
  delete process.env.SUPABASE_SERVICE_KEY;
  process.env.CRON_SECRET = 'cle-audit-urssaf';
  const webpush = require(path.join(R, 'node_modules', 'web-push'));
  const pushes = [];
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (sub, body) => { pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
  let MAIN = {}, ecrits = [], mainKO = false;
  const rep = (o, status = 200) => new Response(typeof o === 'string' ? o : JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  const chemin = (o, p) => p.reduce((x, k) => (x == null ? undefined : x[k]), o);
  const projette = (ligne, select) => {
    if (!select) return ligne;
    const out = {};
    for (const item of select.split(',')) {
      const [alias, expr] = item.includes(':') ? item.split(/:(.+)/) : [item, item];
      const mor = expr.split(/->>?/); const base = mor.shift();
      let v = base === 'data' ? ligne.data : ligne[base];
      if (mor.length) v = chemin(v, mor);
      if (/->>/.test(expr) && v != null) v = typeof v === 'object' ? JSON.stringify(v) : String(v);
      out[alias] = v === undefined ? null : v;
    }
    return out;
  };
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url)), m = opts.method || 'GET';
    if (!u.includes('/rest/v1/')) return rep({}, 404);
    const [table, q = ''] = u.split('/rest/v1/')[1].split('?');
    if (m === 'POST') { try { for (const l of JSON.parse(opts.body || '[]')) ecrits.push(l.id); } catch (_) {} return rep('', 201); }
    if (table === 'app_data' && /select=owner&limit=1/.test(q)) return rep([{ owner: 'A' }]);
    if (table === 'app_data' && /id=eq\.main/.test(q) && !/owner=eq\./.test(q)) return rep([{ owner: 'A' }]);
    if (!/owner=eq\.A/.test(q)) return rep([]);
    if (table !== 'app_data') return rep([]);
    const select = (/(?:^|&)select=([^&]+)/.exec(q) || [])[1] || '';
    if (/id=eq\.main/.test(q)) {
      if (mainKO && /vinted_urssaf_freq/.test(select)) return rep('<html>522</html>', 522);
      return rep([projette({ id: 'main', data: MAIN }, select)]);
    }
    if (/id=eq\.push_subs/.test(q)) return rep([{ data: { subs: [{ endpoint: 'https://fcm.googleapis.com/A1', keys: {} }] } }]);
    if (/id=eq\.urssaf_reminder_dedup/.test(q)) return rep([]);
    return rep([]);
  };
  let cron = null;
  await essaie('api/ship-reminders.js se charge', async () => { cron = (await import('file://' + path.join(API, 'ship-reminders.js'))).default; });
  const vraiNow = Date.now;
  const lancer = async (main, iso = '2026-10-01T08:10:00Z', ko = false) => {
    MAIN = main && !('vinted_regime' in main) ? { vinted_regime: 'micro', vinted_urssaf_taux: '13,5', ...main } : main; ecrits = []; mainKO = ko; pushes.length = 0;
    Date.now = () => Date.parse(iso);
    try {
      const res = { code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } };
      await cron({ method: 'GET', headers: { authorization: 'Bearer cle-audit-urssaf' }, query: {} }, res);
      return res;
    } finally { Date.now = vraiNow; }
  };
  const urssafDe = () => pushes.filter((p) => /^urssaf-/.test(p.tag || ''));
  if (cron) {
    await essaie('cron : mois à déclarer', async () => {
      const res = await lancer({ vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: PUB });
      const u = urssafDe();
      dit(u.length === 1, 'le 1er octobre, septembre pas noté : UNE notification URSSAF part', `${u.length}`);
      dit(!!(u[0] && /4330,90 €/.test(u[0].body) && /584,67 €/.test(u[0].body)), 'elle porte le montant publié (4 330,90 € · 584,67 €)', u[0] && u[0].body);
      dit(!!(u[0] && u[0].url === '/?tab=journee'), 'elle ouvre Ma journée, où vit « C\'est déclaré »', u[0] && u[0].url);
      dit(ecrits.includes('urssaf_reminder_dedup'), 'le mémo du mois est écrit (une fois par mois)');
      const corps = JSON.stringify(res.corps || {});
      dit(!/€|4330|584/.test(corps), 'la réponse du cron ne porte AUCUN montant', corps.slice(0, 160));
    });
    await essaie('cron : mois noté', async () => {
      await lancer({ vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: PUB, vrm_urssaf_declare: { '2026-09': { ids: ['vinted:1'], n: 1, ca: 4330.9, at: 1 } } });
      dit(urssafDe().length === 0, 'septembre noté « déclaré » : la notification ne sonne plus', `${urssafDe().length} envoi(s)`);
    });
    await essaie('cron : pas su', async () => {
      await lancer({ vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: PUB }, '2026-10-01T08:10:00Z', true);
      const u = urssafDe();
      dit(u.length === 0, '« pas su » (main illisible) : statut inconnu, aucune notification URSSAF', `${u.length} envoi(s)`);
    });
    await essaie('cron : statut pas micro', async () => {
      await lancer({ vinted_regime: 'societe', vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: PUB });
      dit(urssafDe().length === 0, 'statut société : le cron n\'envoie aucune notification URSSAF', `${urssafDe().length} envoi(s)`);
      await lancer({ vinted_regime: undefined, vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: PUB });
      dit(urssafDe().length === 0, 'statut jamais choisi : aucune notification URSSAF', `${urssafDe().length} envoi(s)`);
    });
    await essaie('cron : trimestriel en cours', async () => {
      await lancer({ vinted_urssaf_freq: 'trimestriel', vinted_urssaf_mois: PUB }, '2026-11-01T08:10:00Z');
      dit(urssafDe().length === 0, 'trimestriel, 1er novembre (T4 en cours) : aucune notification', `${urssafDe().length} envoi(s)`);
    });
    await essaie('cron : pas le 1er', async () => {
      await lancer({ vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: PUB }, '2026-10-02T08:10:00Z');
      dit(urssafDe().length === 0, 'le 2 du mois : la notification ne repart pas (c\'est la notification du 1er)', `${urssafDe().length} envoi(s)`);
    });
  }
  // ── 4. Le même texte, que la règle tourne à Paris (l'app) ou en UTC (Vercel) ──
  console.log('\n── 4. Fuseau : la règle sous TZ=Europe/Paris (l\'app) et TZ=UTC (le serveur), deux processus');
  await essaie('fuseau', async () => {
    const { execFileSync } = require('child_process');
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-urssaf-tz-'));
    // La règle de l'app (éventuellement mutée) telle que le vm l'exécute.
    fs.writeFileSync(path.join(dossier, 'regle.js'), NOMS.filter((k) => decl.has(k)).map((k) => decl.get(k).texte).join('\n') + '\nthis.rappelUrssaf = rappelUrssaf;');
    // Trois publications, chacune à 00:30 OU 23:30 heure de Paris autour de la fin du mois :
    //   · 1er novembre 00:30 Paris (= 31 oct. 23:30 UTC, hiver) — après la fin d'octobre ;
    //   · 1er octobre 00:30 Paris (= 30 sept. 22:30 UTC, été) — après la fin de septembre ;
    //   · 31 octobre 23:30 Paris (= 22:30 UTC) — AVANT la fin : « au moins » des deux côtés.
    const CAS = [
      { nom: '1er nov. 00:30 Paris', at: '2026-10-31T23:30:00Z', ym: '2026-10', today: '2026-11-01', appNow: '2026-11-01T10:00:00+01:00', auMoins: false },
      { nom: '1er oct. 00:30 Paris', at: '2026-09-30T22:30:00Z', ym: '2026-09', today: '2026-10-01', appNow: '2026-10-01T10:00:00+02:00', auMoins: false },
      { nom: '31 oct. 23:30 Paris', at: '2026-10-31T22:30:00Z', ym: '2026-10', today: '2026-11-01', appNow: '2026-11-01T10:00:00+01:00', auMoins: true },
    ];
    fs.writeFileSync(path.join(dossier, 'cas.json'), JSON.stringify(CAS));
    // Enfant : `regle` exécute la règle de l'app dans un vm (comme Ma journée, ou
    // comme le serveur la construit : midi LOCAL du jour donné) ; `miroir` appelle
    // la VRAIE notification du serveur (api/_lib/rappel-urssaf.js).
    fs.writeFileSync(path.join(dossier, 'enfant.mjs'), `
      import fs from 'fs'; import vm from 'vm';
      const [mode, dossier, api] = process.argv.slice(2);
      const cas = JSON.parse(fs.readFileSync(dossier + '/cas.json', 'utf8'));
      const out = [];
      let glue = null;
      if (mode === 'miroir') glue = await import('file://' + api + '/_lib/rappel-urssaf.js');
      const ctx = { tauxUrssaf: () => 13.5, Date, Math, Number, String, Array, isFinite };
      vm.createContext(ctx); vm.runInContext(fs.readFileSync(dossier + '/regle.js', 'utf8'), ctx);
      for (const c of cas) {
        const ligne = { at: Date.parse(c.at), mois: [{ ym: c.ym, ca: 1000, n: 10 }], aDater: { n: 0 } };
        if (mode === 'miroir') { out.push(glue.notificationUrssaf({ today: c.today, main: { vinted_regime: 'micro', vinted_urssaf_taux: '13,5', vinted_urssaf_freq: 'mensuel', vinted_urssaf_mois: ligne, vrm_urssaf_declare: {} } }).corps); continue; }
        const [y, m, d] = c.today.split('-').map(Number);
        const now = mode === 'app' ? new Date(c.appNow) : new Date(y, m - 1, d, 12);
        const x = ctx.rappelUrssaf({ freq: 'mensuel', now, declare: {}, ligne, taux: 13.5 });
        out.push(x ? x.text + '. ' + x.sub : null);
      }
      console.log(JSON.stringify(out));
    `);
    const lance = (mode, tz) => JSON.parse(execFileSync(process.execPath, [path.join(dossier, 'enfant.mjs'), mode, dossier, API], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }).trim().split('\n').pop());
    const appParis = lance('app', 'Europe/Paris');
    const regleUtc = lance('serveur', 'UTC');
    const miroirUtc = lance('miroir', 'UTC');
    CAS.forEach((c, i) => {
      dit(appParis[i] != null && appParis[i] === regleUtc[i], `${c.nom} : la règle rend le même texte sous TZ=UTC (serveur) et TZ=Europe/Paris (Ma journée)`, appParis[i] === regleUtc[i] ? '' : `Paris « ${appParis[i]} » · UTC « ${regleUtc[i]} »`);
      dit(appParis[i] != null && appParis[i] === miroirUtc[i], `${c.nom} : la VRAIE notification (miroir, TZ=UTC) dit mot pour mot ce que dit Ma journée à Paris`, appParis[i] === miroirUtc[i] ? '' : `Ma journée « ${appParis[i]} » · notification « ${miroirUtc[i]} »`);
      dit(!!appParis[i] && /au moins/i.test(appParis[i]) === c.auMoins, `${c.nom} : ${c.auMoins ? '« au moins » (publiée avant la fin du mois, heure de Paris)' : 'pas de « au moins » (publiée après la fin du mois, heure de Paris)'}`, appParis[i]);
    });
  });

  console.log(ko ? `\n❌ audit-rappel-urssaf : ${ko} rouge(s)` : '\n✅ audit-rappel-urssaf : tout vert');
  process.exit(ko ? 1 : 0);
})();
