// ════════════════════════════════════════════════════════════════════════════
//  « UNE LECTURE PUBLIQUE VIDE N'EST PAS UNE RÉPONSE » (15 nov., audit fiabilité)
//
//  MESURÉ en lecture seule sur la base de production (aucune donnée réelle ici) :
//  le dressing du plus gros compte, capté connecté, portait 19 annonces ouvertes ;
//  45 min plus tard une lecture PUBLIQUE de ce même compte (rangée par une vieille
//  extension, 5.273, d'un autre navigateur) disait « complet, 0 annonce, total 0 ».
//  Plus récente, elle faisait foi dans `<enligne-regle>` : les 19 paires passaient
//  ABSENTES (rendues fermées) — le compteur « en ligne » tombait de 39 à 20, et
//  19 paires sur l'étagère sortaient des paires PRÉSENTES qui protègent un N° et
//  allument le rouge « deux paires sous un N° » (§5).
//
//  La règle (la MÊME dans l'app, l'extension et la copie serveur, §11) :
//   · lecture publique VIDE + dressing lu moins de 24 h avant elle qui montre au
//     moins une annonce ouverte ⇒ « pas su » : le dressing décide s'il a moins de
//     30 min, sinon « à confirmer » — jamais « absentes » ;
//   · un dressing de plus de 24 h face à une lecture publique vide : elle fait foi
//     (inchangé, 11 oct.) ; un dressing sans annonce ouverte (masquées, vendues) :
//     elle fait foi ; une lecture publique NON vide : inchangée.
//
//  On EXÉCUTE les vrais blocs (`<supprimees-regle>` + `<enligne-regle>`) des trois
//  fichiers. Données inventées.
//  Usage : node scripts/audit-enligne-public-vide.cjs [--src <arbre>] [--mutation garde|frais|ouverte]
//    --src : lit App.jsx / background.js / api/_lib/enligne-regle.js d'un autre
//            arbre (`git archive <avant> | tar -x -C <dossier>`, §6.1).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), vm = require('vm'), path = require('path');
const iS = process.argv.indexOf('--src');
const racine = iS > 0 ? path.resolve(process.argv[iS + 1]) : path.join(__dirname, '..');
const lire = (r) => fs.readFileSync(path.join(racine, r), 'utf8');
const F = { app: lire('src/App.jsx'), bg: lire('vinted-sync-extension/background.js'), srv: lire('api/_lib/enligne-regle.js') };

// ── RÉAFFAIBLIR LA RÈGLE (§6.1) : chaque mutation doit faire passer un contrôle au rouge ──
const GARDE = '  const pubPasSu = !!(pub && pub.passu === true) || pubVideContredit;';
const MUTATIONS = {
  // la lecture publique vide refait foi (le code d'avant)
  garde: [GARDE, '  const pubPasSu = !!(pub && pub.passu === true);'],
  // la garde vaudrait aussi face à un dressing de trois jours (on ne retirerait plus jamais rien)
  frais: ['&& isFinite(capL) && !(isFinite(capPub) && capPub - capL >= ENLIGNE_FRAIS_MS));', '&& isFinite(capL));'],
  // la garde vaudrait même quand le dressing ne montre aucune annonce ouverte
  ouverte: ['    && (itemsL || []).some(ouverteSurVinted) && isFinite(capL)', '    && isFinite(capL)'],
};
const iM = process.argv.indexOf('--mutation');
const MUT = iM > 0 ? process.argv[iM + 1] : '';
if (MUT) {
  if (!MUTATIONS[MUT]) { console.log(`mutation inconnue : ${MUT} (${Object.keys(MUTATIONS).join(', ')})`); process.exit(2); }
  const [de, vers] = MUTATIONS[MUT];
  for (const k of Object.keys(F)) {
    const n = F[k].split(de).length - 1;
    if (n !== 1) { console.log(`❌ mutation ${MUT} : ancre trouvée ${n} fois dans ${k}`); process.exit(1); }
    F[k] = F[k].replace(de, vers);
  }
  console.log(`(mutation « ${MUT} »)`);
}

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const bloc = (texte, nom) => {
  const m = new RegExp(`\\/\\/ <${nom}>[^\\n]*\\n([\\s\\S]*?)\\/\\/ <\\/${nom}>`).exec(texte);
  if (!m) throw new Error(`bloc <${nom}> introuvable`);
  return m[1];
};
function regle(texte) {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(bloc(texte, 'supprimees-regle') + '\n' + bloc(texte, 'enligne-regle') + '\n;this.c = enLigneDuCompte; this.l = enLigneDesLignes;', ctx);
  return { compte: ctx.c, lignes: ctx.l, nom: '' };
}
const R = { app: regle(F.app), extension: regle(F.bg), serveur: regle(F.srv) };

const MIN = 60e3, H = 60 * MIN, NOW = Date.parse('2026-11-15T14:30:00.000Z');
const art = (id, o) => Object.assign({ id: 10500000000 + id, title: 'Paire ' + id, price: { amount: '50.0', currency_code: 'EUR' }, is_closed: false, is_hidden: false, is_draft: false }, o);
const ids = (l) => (l || []).map((x) => String(x.id).slice(-2)).sort().join(',');
const sig = (r) => `en[${ids(r.enLigne)}] ac[${ids(r.aConfirmer)}] abs[${ids(r.absentes)}] ferm[${ids(r.fermees)}] ${r.source}`;
const L = (items, ilYa) => ({ items, cap: NOW - ilYa });
const P = (items, ilYa, o) => Object.assign({ complet: true, ids: items.map((x) => String(x.id)), items, cap: NOW - ilYa }, o);
const vendue = art(9, { is_closed: true, item_closing_action: 'sold' });

console.log('── La règle « en ligne » face à une lecture publique vide (app · extension · serveur)');
const cas = [
  // [nom, liste, pub, attendu]
  ['dressing de 82 min avec 3 ouvertes, lecture publique VIDE de 37 min ⇒ « à confirmer », jamais absentes (le cas mesuré)',
    L([art(1), art(2), art(3), vendue], 82 * MIN), P([], 37 * MIN), { en: '', ac: '01,02,03', abs: '', ferm: '09' }],
  ['dressing de 10 min, lecture publique VIDE de 5 min ⇒ le dressing (moins de 30 min) décide : en ligne',
    L([art(1), art(2)], 10 * MIN), P([], 5 * MIN), { en: '01,02', ac: '', abs: '', ferm: '' }],
  ['dressing de 72 h, lecture publique VIDE de ce matin ⇒ elle fait foi : elles sortent (inchangé, 11 oct.)',
    L([art(1), art(2), art(3)], 72 * H), P([], 1 * H), { en: '', ac: '', abs: '01,02,03', ferm: '' }],
  ['dressing de 2 h sans annonce ouverte (une masquée, une vendue), lecture publique vide ⇒ elle fait foi (source publique)',
    L([art(4, { is_hidden: true }), vendue], 2 * H), P([], 1 * H), { en: '', ac: '', abs: '', ferm: '04,09', src: 'public' }],
  ['lecture publique NON vide qui ne montre plus une annonce ⇒ elle sort (inchangé)',
    L([art(1), art(2)], 2 * H), P([art(1)], 1 * H), { en: '01', ac: '', abs: '02', ferm: '' }],
  ['lecture publique vide mais incomplète ⇒ ignorée (inchangé) : le dressing de 2 h décide',
    L([art(1)], 2 * H), P([], 1 * H, { complet: false }), { en: '01', ac: '', abs: '', ferm: '' }],
];
const sorties = {};
for (const [nom, liste, pub, att] of cas) {
  const r = {}; for (const k of Object.keys(R)) r[k] = R[k].compte(liste, pub, null, NOW);
  const a = r.app;
  dit(ids(a.enLigne) === att.en && ids(a.aConfirmer) === att.ac && ids(a.absentes) === att.abs && ids(a.fermees) === att.ferm && (!att.src || a.source === att.src), nom, `app ${sig(a)}`);
  sorties[nom] = Object.keys(R).map((k) => sig(r[k]));
}
const diverge = Object.entries(sorties).filter(([, s]) => new Set(s).size !== 1).map(([n]) => n);
dit(!diverge.length, "l'app, l'extension et le serveur rendent la MÊME sortie sur chaque cas (§11)", diverge.join(' · '));

// La même chose par la porte de l'app (`enLigneDesLignes`), dans la FORME des lignes rangées :
// `harvest_{uid}_listings` entière (data.payload.items, data.capturedAt) et `harvest_{uid}_enligne`
// projetée comme `SELECT_ENLIGNE` (id, cap, complet, ids, items).
console.log('── Par la porte des écrans (`enLigneDesLignes`), la forme des lignes en base');
{
  const lignesL = [{ id: 'harvest_700000001_listings', data: { uid: '700000001', type: 'listings', capturedAt: new Date(NOW - 82 * MIN).toISOString(), nItems: 4,
    payload: { code: 0, items: [art(1), art(2), art(3), vendue], pagination: { current_page: 1, total_pages: 1, total_entries: 4, per_page: 96 } } } }];
  const lignesP = [{ id: 'harvest_700000001_enligne', cap: new Date(NOW - 37 * MIN).toISOString(), complet: true, ids: [], items: [] }];
  for (const k of Object.keys(R)) {
    const out = R[k].lignes(lignesL, lignesP, null, NOW);
    const res = out.parCompte.get('700000001');
    const ac = out.aConfirmer.get('700000001') || [];
    const rendues = ((out.lignes[0] && out.lignes[0].data && out.lignes[0].data.payload && out.lignes[0].data.payload.items) || []);
    const absentes = rendues.filter((it) => it && it._vrmAbsente);
    dit(res && ids(res.absentes) === '' && ids(ac) === '01,02,03' && !absentes.length,
      `${k} : les 3 paires du dressing frais restent PRÉSENTES (« à confirmer »), aucune rendue absente`, res ? sig(res) + ` · rendues absentes ${absentes.length}` : 'compte absent');
  }
}

console.log(`\n${ok} ✅ · ${ko} ❌`);
process.exit(ko ? 1 : 0);
