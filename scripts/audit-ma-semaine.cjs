// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : « MA SEMAINE » (10 nov., lot BC) — node scripts/audit-ma-semaine.cjs
//         [--mutation=futur|ecart|avant|dorment|jourfutur|lien]   [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// L'écran du bilan de la semaine. On EXÉCUTE src/maSemaine.js avec les vraies
// fonctions d'App.jsx (`bilanLignes`, `beneficeDesJours`), `chiffreBrut`
// (src/beneficeNoms.js) et les bornes du bilan (api/_lib/bilan-semaine.js), sur des
// ventes INVENTÉES (aucune donnée réelle). On exige :
//   • LES NOMBRES DE LA NOTIFICATION : le dimanche soir, ventes et vendu de l'écran
//     = ceux de `calculerBilan` (le serveur) sur les mêmes commandes ;
//   • la semaine en cours finit MAINTENANT : une vente « future » n'est jamais comptée ;
//   • la comparaison se fait AU MÊME MOMENT de la semaine d'avant ; un « au moins »
//     ou un « — » ⇒ aucun écart (jamais une flèche fausse) ;
//   • un jour pas encore venu n'a pas de chiffre (jamais 0) ;
//   • « qui dorment » = la règle du bilan (`dormentDe`) ;
//   • la notification ouvre l'écran sur SA semaine ; Ma journée et Statistiques y mènent ;
//   • l'écran ne calcule rien, n'a pas de rouge.
// `--prouve` : chaque mutation doit rendre l'audit rouge.
require('./_source-app.cjs').brancher();
process.env.TZ = 'Europe/Paris';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), { spawnSync } = require('child_process');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';

if (process.argv.includes('--prouve')) {
  let rates = 0;
  for (const m of ['futur', 'ecart', 'avant', 'dorment', 'jourfutur', 'lien']) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8', env: process.env });
    const rouge = r.status !== 0;
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ${rouge ? 'rougit l’audit' : 'NE rougit PAS l’audit'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) passent inaperçues` : '\n✅ toutes les mutations rougissent');
  process.exit(rates ? 1 : 0);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d && (!c || process.env.BAVARD) ? ' — ' + d : '')); };
const lire = (f) => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const APP = lire('src/App.jsx');
let MODULE = lire('src/maSemaine.js');
let BILAN = lire('api/_lib/bilan-semaine.js');
let LIEN = lire('api/_lib/lien-notif.js');
const muter = (txt, avant, apres) => { if (!txt.includes(avant)) { console.log('❌ mutation impossible : ' + avant.slice(0, 80)); process.exit(2); } return txt.replace(avant, apres); };
if (MUT === 'futur') MODULE = muter(MODULE, 'debut: C.debut, fin: maintenant,', 'debut: C.debut, fin: minuitParis(plusJours(l, 7)),');
else if (MUT === 'ecart') MODULE = muter(MODULE, ' || x.partiel || y.partiel) return null;', ') return null;');
else if (MUT === 'avant') MODULE = muter(MODULE, '  if (!S.enCours) return semaineEntiere(l);', '  return semaineEntiere(l);');
else if (MUT === 'dorment') BILAN = muter(BILAN, 'maintenant - (Number(d.at) || 0) < 8 * JOUR) {\n    return', 'true) {\n    return');
else if (MUT === 'jourfutur') MODULE = muter(MODULE, "if (debut > maintenant) return { iso, lettre, futur: true, valeur: null, n: null };", "if (debut > maintenant) return { iso, lettre, futur: true, valeur: 0, n: 0 };");
else if (MUT === 'lien') LIEN = muter(LIEN, "semaine: ({ lundi } = {}) => lienNotif('semaine', {", "semaine: ({ lundi } = {}) => lienNotif('journee', {");
else if (MUT) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }

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
// Un module chargé depuis un fichier temporaire : ses imports relatifs pointent vers SON dossier d'origine.
const tmpFiles = [];
const ecrire = (texte, dossier, nom, remplace = {}) => {
  let t = texte.replace(/from '(\.{1,2}\/[^']+)'/g, (m, f) => remplace[f] ? `from '${remplace[f]}'` : `from 'file://${path.join(R, dossier, f)}'`);
  const tmp = path.join(os.tmpdir(), `${nom}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, t); tmpFiles.push(tmp);
  return 'file://' + tmp;
};

(async () => {
  try {
    const urlBilan = ecrire(BILAN, 'api/_lib', 'bilan');
    const B = await import(urlBilan);
    const M = await import(ecrire(MODULE, 'src', 'ma-semaine', { '../api/_lib/bilan-semaine.js': urlBilan }));
    const L = await import(ecrire(LIEN, 'api/_lib', 'lien'));
    const V = await import('file://' + path.join(R, 'api/_lib/ventes-regle.js'));
    const N = await import('file://' + path.join(R, 'src/beneficeNoms.js'));
    const NOMS = ['BENEF_CHAMPS', 'beneficeVide', 'ajouterVenteBenefice', 'jourBeneficeEnTableau', 'cumulerBenefice', 'resumeBenefice', 'jourClef', 'beneficeDesJours', 'bilanLignes'];
    const ctx = { Date, Math, Number, String, Object, Array, JSON, isFinite, parseFloat, isNaN, console }; vm.createContext(ctx);
    const absents = [];
    for (const n of NOMS) { const t = extraire(APP, n); if (!t) { absents.push(n); continue; } try { vm.runInContext(t.replace(/^const /, 'var ') + `\n;this.${n} = ${n};`, ctx); } catch (e) { absents.push(n); } }
    dit(typeof M.maSemaine === 'function', 'src/maSemaine.js exporte `maSemaine`');
    dit(!absents.length, 'les règles se lisent dans App.jsx', absents.join(', '));
    if (absents.length || typeof M.maSemaine !== 'function') throw new Error('rien à exécuter');
    const RG = { bilanLignes: ctx.bilanLignes, beneficeDesJours: ctx.beneficeDesJours, chiffreBrut: N.chiffreBrut };

    // ── Le dimanche 8 nov. 2026, 19 h à Paris : le bilan du soir part ─────────
    const T = (m, j, h = 12, mi = 0) => new Date(2026, m, j, h, mi).getTime();
    const DIM = T(10, 8, 19, 0);
    const iso = (t) => new Date(t).toISOString();
    const cmd = (tx, t, eur, status = 'Commande finalisée') => ({ transaction_id: tx, status, date: iso(t), price: { amount: String(eur), currency_code: 'EUR' } });
    const orders = [
      cmd(1, T(10, 1, 23, 30), 999),   // dimanche d'avant : hors
      cmd(2, T(10, 2, 0, 5), 60),      // lundi 00:05 : dedans
      cmd(3, T(10, 4, 15), 45),
      cmd(4, T(10, 8, 18, 30), 30),    // dimanche 18:30 : dedans
      cmd(5, T(10, 8, 21, 0), 777),    // dimanche 21:00 — APRÈS maintenant : jamais compté
      cmd(6, T(9, 27, 10), 50),        // mardi d'avant
      cmd(7, T(9, 30, 9), 20),         // vendredi d'avant
      cmd(8, T(10, 1, 20, 0), 40),     // dimanche d'avant 20 h : APRÈS le même moment (19 h)
    ];
    const vinted = orders.map((o) => ({ ...o, _acc: { vinted_user_id: '11' } }));
    const lignes = V.ventesFaites({ vinted, lbc: [], ebay: [] }).lignes;
    const jours = {};
    const vend = (t, eur, achat) => { const k = ctx.jourClef(new Date(t)); const acc = ctx.beneficeVide(); if (jours[k]) ctx.cumulerBenefice(acc, jours[k]); ctx.ajouterVenteBenefice(acc, eur, achat, 0); jours[k] = ctx.jourBeneficeEnTableau(acc); };
    vend(T(10, 2), 60, 20); vend(T(10, 4), 45, 15); vend(T(10, 8, 18, 30), 30, 10); vend(T(9, 27), 50, 30); vend(T(9, 30), 20, 5);
    const ship = { 2: T(10, 3), 3: T(10, 5), 6: T(9, 28) };
    const dorment = { n: 4, total: 20, datesKnown: 20, at: DIM - 3600000 };
    const recuEntre = () => ({ valeur: null, raison: 'absente' });
    const E = { maintenant: DIM, vendu: { lignes, manque: [], nonComptees: [] }, joursBenef: { jours }, colisFaits: { vinted: ship, lbc: {}, vc: {} }, dorment, recuEntre, R: RG };
    const S = M.maSemaine(E);
    dit(S.lundi === '2026-11-02' && S.enCours && S.fin === DIM, 'le dimanche soir : la semaine EN COURS (lundi 2 nov. → maintenant)', `${S.lundi} fin=${S.fin}`);
    dit(S.chiffres.ventes.valeur === 3 && S.chiffres.vendu.valeur === 135, 'ventes 3, vendu 135 € (lundi 00:05 et dimanche 18:30 dedans ; 21 h, encore à venir, hors)', `${S.chiffres.ventes.valeur} / ${S.chiffres.vendu.valeur}`);

    // Les MÊMES nombres que la notification (calculerBilan, le serveur, semaineCourante).
    const sem = B.semaineCourante(DIM);
    const b = B.calculerBilan({ comptes: [{ uid: '11', login: 'vendeuse_banc' }], commandes: { 11: { orders, cap: iso(DIM - 600000) } }, masquesTx: new Set(), masquesComptes: new Set(), panneau: {}, lbc: [], ebay: [], versements: {}, dorment, debut: sem.debut, fin: sem.fin, seuilCapture: sem.seuilCapture, maintenant: DIM });
    dit(b.vendu.n === S.chiffres.ventes.valeur && b.vendu.eur === S.chiffres.vendu.valeur && b.vendu.etat === 'su', 'les nombres de la notification du dimanche soir : ventes et vendu identiques', `notif ${b.vendu.n} · ${b.vendu.eur} € — écran ${S.chiffres.ventes.valeur} · ${S.chiffres.vendu.valeur} €`);
    dit(b.dorment.etat === 'su' && S.dorment.etat === 'su' && b.dorment.n === S.dorment.n && b.dorment.auMoins === S.dorment.auMoins, 'qui dorment : le nombre du bilan (`dormentDe`)', JSON.stringify(S.dorment));

    // La semaine d'avant AU MÊME MOMENT : lundi 26 oct. → dimanche 1er nov. 19 h.
    dit(S.avant.ventes.valeur === 2 && S.avant.vendu.valeur === 70, 'semaine d’avant AU MÊME MOMENT (dimanche 19 h) : 2 ventes, 70 € — ses ventes de 20 h et 23 h 30 hors', `${S.avant.ventes.valeur} / ${S.avant.vendu.valeur}`);
    dit(S.ecarts.ventes && S.ecarts.ventes.delta === 1 && S.ecarts.ventes.sens === 'hausse' && S.ecarts.vendu && S.ecarts.vendu.delta === 65, 'écarts : +1 vente, +65 € (flèche vers le haut)', JSON.stringify(S.ecarts.vendu));
    dit(S.chiffres.brut.valeur === 90 && !S.chiffres.brut.partiel, 'bénéfice brut 90 € (40 + 30 + 20), aujourd’hui compté entier (la publication est au jour)', JSON.stringify(S.chiffres.brut));
    dit(S.avant.brut.valeur === 35 && S.ecarts.brut && S.ecarts.brut.delta === 55, 'bénéfice de la semaine d’avant jusqu’au même jour : 35 €, écart +55 €', JSON.stringify(S.avant.brut));
    dit(S.chiffres.colis.valeur === 2 && S.avant.colis.valeur === 1, 'colis envoyés : 2 (ses gestes « Colis fait »), 1 la semaine d’avant', `${S.chiffres.colis.valeur} / ${S.avant.colis.valeur}`);
    const jDim = S.jours[6], jLun = S.jours[0];
    dit(S.jours.length === 7 && jLun.valeur === 60 && jDim.valeur === 30 && jDim.aujourdhui, 'une barre par jour : lundi 60 €, dimanche (aujourd’hui) 30 €');

    // Mercredi : les jours à venir n'ont aucun chiffre.
    const MER = T(10, 4, 16);
    const W = M.maSemaine({ ...E, maintenant: MER });
    const futurs = W.jours.filter((j) => j.futur);
    dit(futurs.length === 4 && futurs.every((j) => j.valeur == null && j.n == null), 'un mercredi : jeudi → dimanche sans chiffre (jamais 0)', JSON.stringify(futurs.map((j) => j.valeur)));
    dit(W.chiffres.ventes.valeur === 2 && !W.jours.some((j) => j.iso === '2026-11-08' && j.valeur > 0), 'un mercredi : la vente de dimanche (pas encore faite) n’existe pas', String(W.chiffres.ventes.valeur));

    // Un « au moins » ou un « — » ⇒ aucun écart.
    const P = M.maSemaine({ ...E, vendu: { lignes, manque: ['vendeuse_b (jamais lu)'], nonComptees: [] } });
    dit(P.chiffres.vendu.partiel && P.ecarts.vendu === null && P.ecarts.ventes === null, 'un compte pas lu : « au moins », et AUCUNE flèche', JSON.stringify(P.ecarts.vendu));
    const Z = M.maSemaine({ ...E, vendu: null });
    dit(Z.chiffres.vendu.valeur == null && Z.ecarts.vendu === null && Z.jours.every((j) => j.valeur == null), 'ventes pas lues : « — » partout, aucune flèche, aucune barre');
    const BP = M.maSemaine({ ...E, joursBenef: null });
    dit(BP.chiffres.brut.valeur == null && BP.ecarts.brut === null, 'bénéfice pas publié : « — », aucune flèche');

    // Une semaine passée (le lien du lundi matin) : entière, comparée à la précédente entière.
    const LUN = T(10, 9, 7);
    const Q = M.maSemaine({ ...E, maintenant: LUN, lundi: '2026-11-02' });
    dit(Q.lundi === '2026-11-02' && !Q.enCours && Q.chiffres.ventes.valeur === 4 && Q.chiffres.vendu.valeur === 912, 'le lundi, le lien de la semaine passée : la semaine entière (dimanche 21 h compris)', `${Q.chiffres.ventes.valeur} / ${Q.chiffres.vendu.valeur}`);
    dit(Q.avant.ventes.valeur === 4 && Q.avant.vendu.valeur === 1109, 'et la semaine d’avant ENTIÈRE', `${Q.avant.ventes.valeur} / ${Q.avant.vendu.valeur}`);
    const F = M.maSemaine({ ...E, lundi: '2026-11-16' });
    dit(F.lundi === '2026-11-02' && F.enCours, 'une semaine future demandée : la semaine en cours (jamais l’avenir)');
    const X = M.maSemaine({ ...E, lundi: '2026-11-04' });
    dit(X.lundi === '2026-11-02', 'un mercredi demandé : le lundi de sa semaine');

    // « Qui dorment » vieux de 8 jours : pas su.
    const D = M.maSemaine({ ...E, dorment: { ...dorment, at: DIM - 9 * 86400000 } });
    dit(D.dorment.etat === 'pas-su' && D.dorment.n == null, 'qui dorment publié il y a 9 jours : « — » (la règle du bilan)');

    // La notification ouvre l'écran sur SA semaine.
    dit(L.DESTINATIONS.semaine({ lundi: '2026-11-02' }) === '/?tab=semaine&lundi=2026-11-02', 'la notification ouvre « Ma semaine » sur le lundi de sa semaine', L.DESTINATIONS.semaine({ lundi: '2026-11-02' }));
    dit(L.DESTINATIONS.semaine({ lundi: '<x>' }) === '/?tab=semaine', 'un lundi mal formé est omis (l’écran s’ouvre sur la semaine en cours)');
  } catch (e) { dit(false, 'exécution', String((e && e.stack) || e).split('\n').slice(0, 3).join(' ')); }
  finally { for (const f of tmpFiles) { try { fs.unlinkSync(f); } catch (_) {} } }

  // ── Le câblage ──
  const A0 = sansCommentaires(APP);
  const CR = sansCommentaires(lire('api/ship-reminders.js'));
  dit(/url: DESTINATIONS\.semaine\(\{ lundi: sem\.lundi \}\)/.test(CR) && !/'\/\?tab=journee'/.test(CR), 'le bilan de la semaine (cron) porte le lien de « Ma semaine »');
  dit(/const ONGLETS_LIENS=\[[^\]]*'semaine'/.test(A0), '`?tab=semaine` est dans la liste blanche des liens');
  dit(/\{tab==='semaine'&&<GardeEcran nom="semaine"><EcranMaSemaine /.test(A0), 'l’écran est monté (`tab===\'semaine\'`)');
  dit(/if\(t==='semaine'\)\{ const l=p\.get\('lundi'\)/.test(A0), 'le lien lit le lundi demandé');
  dit(/onSemaine=\{onNav \? \(\) => onNav\('semaine'\)/.test(A0) && /data-ouvre-ma-semaine/.test(A0), 'Ma journée mène à « Ma semaine »');
  dit(/onGo\('semaine'\)/.test(sansCommentaires(lire('src/ecrans/Stats.jsx'))), 'Statistiques mène à « Ma semaine »');
  const ecran = extraire(A0, 'EcranMaSemaine');
  dit(/maSemaine\(\{/.test(ecran) && /REGLES_SEMAINE/.test(ecran) && /const REGLES_SEMAINE = \{ bilanLignes, beneficeDesJours, chiffreBrut \};/.test(A0), 'l’écran passe les règles propriétaires (vendu, bénéfice brut)');
  const UI = sansCommentaires(lire('src/MaSemaine.jsx'));
  dit(UI && !/\.reduce\(|bilanLignes|beneficeDesJours|ventesFaites/.test(UI), 'le composant ne calcule aucun chiffre');
  const CSS = lire('src/styles-ma-semaine.css');
  dit(CSS && !/#(FF3B30|FF453A|D70015|FF6961)|\bred\b|#34C759|#30D158/i.test(CSS), 'aucun rouge ni vert : la comparaison est neutre');
  dit(/\.vrm-ms-nav-b \{[^}]*width: 44px/.test(CSS), 'les boutons de semaine font 44 px');
  const sig = lire('api/_lib/signalement.js');
  dit(/'semaine'[,\]]/.test(sig), 'un signalement depuis l’écran garde son nom (`ECRANS`)');
  console.log(`\n${ko ? '❌' : '✅'} audit-ma-semaine : ${ok} vert(s), ${ko} rouge(s)${MUT ? ' [mutation ' + MUT + ']' : ''}`);
  process.exit(ko ? 1 : 0);
})();
