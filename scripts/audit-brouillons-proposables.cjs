#!/usr/bin/env node
// ── audit-brouillons-proposables — QUEL BROUILLON VINTED SE MET EN LIGNE (2 nov.) ──
// Julien : « elle propose de mettre des brouillons en ligne sans dire que ces
// brouillons ne viennent pas de ce compte, et même quand ces brouillons
// n'existent plus ». Exige, sur la VRAIE règle (src/brouillonsProposables.js),
// EXÉCUTÉE sur des brouillons de deux comptes :
//   · seul un brouillon du compte ouvert dans Chrome est proposable ; un autre
//     compte ⇒ « autre-compte » ; compte de Chrome pas su ⇒ jamais proposable ;
//   · absent d'une lecture COMPLÈTE plus récente de SON dressing ⇒ « plus-sur-vinted » ;
//     une lecture PARTIELLE ne prouve aucune absence ;
//   · sans lecture complète et récente (< 24 h) ⇒ « a-verifier », jamais prêt ;
//   · enregistré il y a peu (vu par l'extension), sans lecture plus récente ⇒ prouvé ;
//   · contenu pas prêt ⇒ « pas-pret » ;
// et que l'app BRANCHE cette règle (§11, une règle) : `_place` décide du bouton
// « Mettre en ligne » de « Voir mes brouillons », du compte « prêts » du menu et
// du blocage des lignes de l'atelier « Brouillons → en ligne ».
//   node scripts/audit-brouillons-proposables.cjs              la règle du dépôt
//   node scripts/audit-brouillons-proposables.cjs --prouve     chaque mutation doit rougir
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const SRC = path.join(R, 'src', 'brouillonsProposables.js');
const APP = path.join(R, 'src', 'App.jsx');

const MUTATIONS = {
  'compte-ignore': ["  if (String(c.uidChrome) !== uid) return { place: 'autre-compte' };\n", ''],
  'compte-passu-oui': ["  if (c.uidChrome === undefined || c.uidChrome === null || c.uidChrome === '') return { place: 'compte-inconnu' };\n", ''],
  'disparu-ignore': ["  if (complete && fini(preuve) && L.lu >= preuve + BROUILLON_MARGE_MS) return { place: 'plus-sur-vinted', depuis: L.lu };\n", ''],
  'partielle-prouve-absence': ['  if (complete && fini(preuve) && L.lu >= preuve', '  if (L && fini(L.lu) && fini(preuve) && L.lu >= preuve'],
  'fraicheur-ignoree': ['if (fini(preuve) && maintenant - preuve <= BROUILLON_LECTURE_MAX_MS) {', 'if (fini(preuve)) {'],
  'complete-ignoree': ["present = source === 'extension' ? true : (complete && Math.abs(L.lu - preuve) < BROUILLON_MARGE_MS);", 'present = true;'],
  'pret-ignore': ["  if (b.etat !== 'pret') return { place: 'pas-pret' };\n", ''],
  'app-bouton': ['{proposable && complet && brouillonOk && (!e', '{complet && brouillonOk && (!e'],
  'app-atelier': ["bloque: b._place==='proposable' ? ''", "bloque: b._etat==='pret' ? ''"],
  'app-hors-compte': ["    ? toutes.map((a) => (String(a.uid || '') === compteUid || a.bloque) ? a : {", "    ? toutes.filter((a) => String(a.uid || '') === compteUid).map((a) => (String(a.uid || '') === compteUid || a.bloque) ? a : {"],
};
const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  let ko = 0, n = 0;
  const dit = (c, msg, det) => { n++; if (c) console.log('✅ ' + msg); else { ko++; console.log('❌ ' + msg + (det !== undefined ? ' — ' + JSON.stringify(det) : '')); } };
  if (!fs.existsSync(SRC)) { dit(false, 'la règle existe (src/brouillonsProposables.js)'); }
  let src = fs.existsSync(SRC) ? fs.readFileSync(SRC, 'utf8') : '';
  let app = fs.readFileSync(APP, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue'); process.exit(2); }
    const cible = mut.startsWith('app-') ? 'app' : 'src';
    const texte = cible === 'app' ? app : src;
    if (!texte.includes(m[0])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    if (cible === 'app') app = app.replace(m[0], m[1]); else src = src.replace(m[0], m[1]);
  }
  let G = null;
  if (src) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brouillons-'));
    const f = path.join(dir, 'brouillonsProposables.mjs'); fs.writeFileSync(f, src);
    try { G = await import(f); } catch (e) { dit(false, 'la règle se charge', e.message); }
  }

  console.log('\n1. LA RÈGLE, EXÉCUTÉE');
  if (G) {
    const now = Date.parse('2026-11-02T15:00:00Z'); const H = 3600e3;
    const lectures = {
      '111': { lu: now - 10 * 60000, complet: true },    // Chrome : lu il y a 10 min, complet
      '222': { lu: now - 20 * 60000, complet: true },    // autre compte : lu, complet
      '333': { lu: now - 30 * 60000, complet: false },   // une page seulement
      '444': { lu: now - 50 * H, complet: true },        // complet mais vieux de 2 jours
    };
    const ctx = { uidChrome: '111', lectures, maintenant: now };
    const J = (b, c = ctx) => G.jugerBrouillon(b, c).place;
    // Deux comptes, le même titre ne compte pas : l'identité est le draftId.
    dit(J({ uid: '111', source: 'dressing', vu: lectures['111'].lu, etat: 'pret' }) === 'proposable', 'compte de Chrome, vu dans la lecture complète de 10 min, prêt ⇒ proposable');
    dit(J({ uid: '222', source: 'dressing', vu: lectures['222'].lu, etat: 'pret' }) === 'autre-compte', 'même brouillon prêt sur un AUTRE compte ⇒ autre-compte (jamais proposable)');
    dit(J({ uid: '111', source: 'dressing', vu: lectures['111'].lu, etat: 'pret' }, { ...ctx, uidChrome: undefined }) === 'compte-inconnu', 'compte de Chrome PAS SU ⇒ jamais proposable');
    dit(J({ uid: '111', source: 'dressing', vu: lectures['111'].lu, etat: 'pret' }, { ...ctx, uidChrome: null }) === 'compte-inconnu', 'aucun compte Vinted dans Chrome ⇒ jamais proposable');
    // Disparu d'une lecture complète plus récente.
    dit(J({ uid: '111', source: 'extension', enregistre: now - 3 * H, etat: 'pret' }) === 'plus-sur-vinted', 'enregistré il y a 3 h, absent de la lecture COMPLÈTE de 10 min ⇒ plus sur Vinted');
    dit(J({ uid: '111', source: 'dressing', vu: now - 5 * H, etat: 'pret' }) === 'plus-sur-vinted', 'vu dans une lecture d’il y a 5 h, absent de la complète de 10 min ⇒ plus sur Vinted');
    dit(J({ uid: '222', source: 'extension', enregistre: now - 3 * H, etat: 'pret' }) === 'plus-sur-vinted', 'disparu sur un autre compte : plus sur Vinted (pas « ouvre ce compte »)');
    // Une lecture partielle ne prouve rien.
    dit(J({ uid: '333', source: 'extension', enregistre: now - 3 * H, etat: 'pret' }, { ...ctx, uidChrome: '333' }) === 'proposable', 'une lecture PARTIELLE plus récente ne fait pas disparaître un brouillon enregistré il y a 3 h');
    dit(J({ uid: '333', source: 'dressing', vu: lectures['333'].lu, etat: 'pret' }, { ...ctx, uidChrome: '333' }) === 'a-verifier', 'vu seulement dans une lecture partielle ⇒ à vérifier (pas de lecture complète)');
    // Sans lecture complète et récente.
    dit(J({ uid: '444', source: 'dressing', vu: lectures['444'].lu, etat: 'pret' }, { ...ctx, uidChrome: '444' }) === 'a-verifier', 'vu dans une lecture complète de 2 jours ⇒ à vérifier, jamais prêt');
    dit(J({ uid: '555', source: 'dressing', vu: NaN, etat: 'pret' }, { ...ctx, uidChrome: '555' }) === 'a-verifier', 'jamais daté, sans lecture ⇒ à vérifier');
    dit(J({ uid: '111', source: 'dressing', vu: lectures['111'].lu, etat: 'pret' }, { ...ctx, lectures: null }) === 'a-verifier', 'lectures pas sues ⇒ à vérifier');
    dit(J({ uid: '555', source: 'extension', enregistre: now - 30 * H, etat: 'pret' }, { ...ctx, uidChrome: '555' }) === 'a-verifier', 'enregistré il y a 30 h sans lecture ⇒ à vérifier');
    // Enregistré récemment, après la dernière lecture.
    dit(J({ uid: '111', source: 'extension', enregistre: now - 2 * 60000, etat: 'pret' }) === 'proposable', 'enregistré il y a 2 min, après la lecture de 10 min ⇒ proposable');
    dit(J({ uid: '444', source: 'extension', enregistre: now - 1 * H, etat: 'pret' }, { ...ctx, uidChrome: '444' }) === 'proposable', 'enregistré il y a 1 h, la dernière lecture a 2 jours ⇒ proposable');
    // Contenu.
    dit(J({ uid: '111', source: 'dressing', vu: lectures['111'].lu, etat: 'incomplet' }) === 'pas-pret', 'contenu incomplet ⇒ pas prêt');
    dit(J({ uid: '111', source: 'dressing', vu: lectures['111'].lu, etat: 'inconnu' }) === 'pas-pret', 'contenu inconnu ⇒ pas prêt');
    dit(J({ uid: '', source: 'dressing', vu: lectures['111'].lu, etat: 'pret' }) !== 'proposable', 'sans compte ⇒ jamais proposable');
    // La lecture d'un dressing.
    const L1 = G.lectureBrouillons({ items: [1, 2], pagination: { total_entries: 2 } }, now);
    const L2 = G.lectureBrouillons({ items: [1], pagination: { total_entries: 2 } }, now);
    const L3 = G.lectureBrouillons({ items: [1, 2] }, now);
    dit(L1 && L1.complet === true && L1.lu === now, 'lecture : total atteint ⇒ complète');
    dit(L2 && L2.complet === false, 'lecture : une page sur deux ⇒ partielle');
    dit(L3 && L3.complet === false, 'lecture : sans total de Vinted ⇒ partielle (pas su)');
    dit(G.lectureBrouillons(null, now) === null && G.lectureBrouillons({ items: [] }, NaN) === null, 'lecture absente ou non datée ⇒ null (pas su)');
  }

  console.log('\n2. L’APP BRANCHE CETTE RÈGLE (§11)');
  const sansCom = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  dit(/import \{[^}]*jugerBrouillon[^}]*\} from '\.\/brouillonsProposables\.js'/.test(sansCom), 'App.jsx importe la règle');
  dit(/_place: jugerBrouillon\(/.test(sansCom), 'chaque brouillon de la liste porte SA place (`_place`)');
  dit(/_vrmBrLecture: lectureBrouillons\(/.test(sansCom) && /brLectures\[uid\] = r\.brLecture/.test(sansCom), 'la lecture de SON dressing (datée, complète ou non) arrive jusqu’à la règle');
  dit(/useBrouillonsVinted\([^)]*listings\.brLectures\)/.test(sansCom), 'le hook reçoit les lectures des dressings');
  dit(/\{proposable && complet && brouillonOk && \(!e/.test(sansCom), '« Voir mes brouillons » : « Mettre en ligne » seulement pour un brouillon proposable');
  dit(/bloque: b\._place==='proposable' \? ''/.test(sansCom), 'atelier « Brouillons → en ligne » : seul un brouillon proposable se coche');
  dit(/action === 'enLigne'\s*\n?\s*\? toutes\.map\(/.test(sansCom), 'atelier : les brouillons des autres comptes sont MONTRÉS (grisés), pas cachés');
  dit(/filter\(b=>b\._place==='proposable'\)/.test(sansCom), 'le menu compte les brouillons PROPOSABLES, pas seulement « prêts »');
  dit(/data-brouillon-pseudo/.test(sansCom), 'chaque brouillon écrit son compte');
  dit(!/lu >= at \+ SUPPR_MARGE_MS/.test(sansCom), 'plus de disparition jugée sur une lecture quelconque (publique ou partielle)');

  console.log(`\n${ko ? '❌' : '✅'} audit-brouillons-proposables : ${n - ko}/${n}`);
  process.exit(ko ? 1 : 0);
})();
