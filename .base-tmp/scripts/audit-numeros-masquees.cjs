// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « LES ANNONCES MASQUÉES REÇOIVENT LEUR N° » (15 nov., audit de fiabilité #3, #4)
//  Mesuré (lecture seule) : chez le premier vendeur, 4 annonces masquées par Vinted
//  (`is_hidden`, ni fermées ni brouillons) SANS fiche, chacune liée par l'extension à
//  un N° réservé à côté de « Publier » ; chez un autre, 5 masquées sans fiche ni
//  réservation (dressing de 3 semaines). Cause : la numérotation ne parcourait que les
//  annonces EN LIGNE. Une masquée est chez lui (§5, `annoncesPresentes`) : elle reçoit
//  son N° comme une annonce en ligne — identités d'abord (N° réservé lié à SON id, vente
//  de la même annonce, photo), un N° neuf seulement sur son dressing COMPLET et FRAIS,
//  jamais par titre. Et #4 : une réservation liée dont la fiche porte un autre N° ne
//  change RIEN toute seule ; elle est montrée « N° à vérifier sur ton carton », SON choix.
//  Le morceau de numérotation d'App.jsx est EXÉCUTÉ (scripts/_numerotation-vm.cjs).
//  `--src <arbre>` : juge un autre arbre (le code d'avant, §6.1).
//  `--mutation=<nom>` / `--mutation=toutes` : réaffaiblit la règle ⇒ doit être ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { charger, passageAvec } = require('./_numerotation-vm.cjs');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

const MUTATIONS = {
  enligne: ['src/App.jsx', 'const items = annoncesANumeroter(listings.items, masqueesSurEtagere);', 'const items = (listings.items || []);'],
  frais: ['src/numerosNouvelles.js', 'return age <= MASQUEE_FRAIS_MS && age >= -AVANCE_HORLOGE_MS;', 'return true;'],
  complet: ['src/numerosNouvelles.js', "if (!it || it._vrmMasquee !== true || it._vrmMasqueeComplete !== true) return false;", "if (!it || it._vrmMasquee !== true) return false;"],
  gate: ['src/App.jsx', "const neufPermis = (it) => numeroNeufPermis({ mode: ecritOn ? 'moi' : 'vrm', complet: lectureCompleteAnnonce(it, listings) });", "const neufPermis = (it) => numeroNeufPermis({ mode: ecritOn ? 'moi' : 'vrm', complet: true });"],
  reattribue: ['src/numerosNouvelles.js', 'if (ra && typeof ra === \'object\' && cle(ra.de) === cr && cle(ra.vers) === cf) return null;', ''],
  verifie: ['src/numerosNouvelles.js', '  if (fiche.cartonVerifie) return null;\n', ''],
  ligne: ['src/App.jsx', 'filter((it) => ficheAVerifier(numeros[it.id]) || !!reserveDe(it))', 'filter((it) => ficheAVerifier(numeros[it.id]))'],
  demande: ['src/App.jsx', 'demandesNumero({ items: annoncesANumeroter(listings.items, masqueesSurEtagere), fiches: numeros', 'demandesNumero({ items: listings.items, fiches: numeros'],
};

if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  let attrapees = 0;
  for (const nom of noms) {
    const m = MUTATIONS[nom]; if (!m) { console.log(`❌ mutation inconnue : ${nom}`); continue; }
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-nm-'));
    for (const d of ['src', 'api/_lib']) fs.cpSync(path.join(RACINE, d), path.join(t, d), { recursive: true, filter: (f) => !/node_modules|\.zip$|\.png$|\.woff2?$|\.jpg$/.test(f) });
    const p = path.join(t, m[0]); const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(m[1])) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${m[0]}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, src.replace(m[1], m[2]));
    const r = spawnSync(process.execPath, [__filename, '--src', t], { encoding: 'utf8', timeout: 180000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0; if (ok) attrapees++;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${ok ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(attrapees === noms.length ? `\n✅ ${attrapees}/${noms.length} mutations attrapées` : `\n❌ ${noms.length - attrapees} mutation(s) non attrapée(s)`);
  process.exit(attrapees === noms.length ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

(async () => {
  const L = await charger(RACINE);
  dit(!!L.corps, 'App.jsx porte la numérotation (de « const items = » à </numerotation-passage>)');
  dit(!L.manque.length, 'les fonctions d’App.jsx que le morceau appelle sont trouvées', L.manque.join(', '));
  if (!L.corps || L.manque.length || !L.N || !L.R || !L.E || !L.C) { console.log(`\n❌ Masquées : ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }
  const N = L.N;
  const MAINT = Date.now();
  const A = '24602614';   // un compte inventé (forme mesurée : identifiant numérique)
  const acc = { vinted_user_id: A };
  const ann = (id, title, o = {}) => ({ id, title, photo: `https://images1.vinted.net/t/01_${id}/f800/${id}.jpeg`, _acc: acc, t: 1000 + Number(String(id).slice(-4)), ...o });
  const masquee = (id, title, o = {}) => ann(id, title, { _vrmMasquee: true, _vrmVueMasqueeLe: MAINT - 10 * 60e3, _vrmMasqueeComplete: true, ...o });
  const pool216 = Array.from({ length: 216 }, (_, i) => i + 1);
  const P = (x) => { const r = passageAvec(L, x); if (r.erreur) dit(false, 'le morceau s’exécute', r.erreur); return r; };
  const num = (r, id) => (r.fiches && r.fiches[id] && r.fiches[id].numero) || null;

  console.log('— 1. Les masquées reçoivent leur N° (#3)');
  try {
    // Le cas mesuré : 4 masquées sans fiche, chacune liée à SON N° réservé (209, 210, 211, 214) ; dressing complet et frais.
    const ms = [masquee('10802018727', 'Paire A'), masquee('10802040874', 'Paire B'), masquee('10802068595', 'Paire C'), masquee('10802139469', 'Paire D')];
    const reserves = { 10802018727: '209', 10802040874: '210', 10802068595: '211', 10802139469: '214' };
    const enLigne = [ann('10800000001', 'En ligne 1')];
    const r = P({ items: enLigne, masquees: ms, fiches: { 10800000001: { numero: '215', auto: true } }, pool: pool216, reserves, complets: { [A]: true } });
    dit(['209', '210', '211', '214'].every((n, i) => num(r, ms[i].id) === n), 'chaque masquée reçoit le N° RÉSERVÉ lié à SON identifiant (209, 210, 211, 214)', JSON.stringify(ms.map((m) => num(r, m.id))));
    dit(ms.every((m) => !(r.fiches[m.id] && r.fiches[m.id].nouveau)) && !(r.nouveaux || []).length, '… aucune n’est « nouvelle » (le N° est déjà sur son carton), rien n’est dit « numéroté »');
    dit(!r.pool.includes(217), '… aucun N° neuf brûlé (217 reste libre)');
    const s = P({ items: enLigne, masquees: ms.map((m) => ({ ...m, _vrmVueMasqueeLe: MAINT - 3 * 86400e3 })), fiches: { 10800000001: { numero: '215', auto: true } }, pool: pool216, reserves, complets: { [A]: true } });
    dit(num(s, ms[0].id) === '209', 'dressing de 3 jours : la réservation (une identité) suffit — N°209', JSON.stringify(num(s, ms[0].id)));
  } catch (e) { dit(false, 'le bloc s’exécute', String(e && e.message).slice(0, 140)); }
  try {
    const m = masquee('10802200001', 'Paire masquée neuve');
    const r = P({ items: [], masquees: [m], pool: pool216, complets: { [A]: true } });
    dit(num(r, m.id) === '217' && r.fiches[m.id].nouveau, 'masquée sans identité, dressing COMPLET et frais ⇒ N° neuf (217), « à écrire »', JSON.stringify(r.fiches[m.id]));
    const st = P({ items: [], masquees: [{ ...m, _vrmVueMasqueeLe: MAINT - 30 * 3600e3 }], pool: pool216, complets: { [A]: true } });
    dit(!num(st, m.id), 'dressing de plus de 24 h ⇒ AUCUN N° neuf (peut-être supprimée ou vendue depuis)', JSON.stringify(st.fiches[m.id]));
    const pa = P({ items: [], masquees: [{ ...m, _vrmMasqueeComplete: false }], pool: pool216, complets: { [A]: true } });
    dit(!num(pa, m.id), 'dressing PARTIEL ⇒ aucun N° neuf', JSON.stringify(pa.fiches[m.id]));
    const k = P({ items: [], masquees: [m], pool: pool216, complets: { [A]: true }, ko: [A] });
    dit(!num(k, m.id), 'compte qui n’a pas répondu ⇒ aucun N° neuf');
    const v2 = Array.from({ length: 5 }, (_, i) => masquee(String(9760414300 + i), 'Masquée ancienne', { _vrmVueMasqueeLe: MAINT - 22 * 86400e3 }));
    const r2 = P({ items: [], masquees: v2, pool: pool216, complets: { [A]: true } });
    dit(v2.every((x) => !num(r2, x.id)), 'le second cas mesuré (5 masquées, dressing de 3 semaines) : aucun N° deviné — ils viendront à la prochaine lecture fraîche', JSON.stringify(v2.map((x) => num(r2, x.id))));
  } catch (e) { dit(false, 'le bloc s’exécute', String(e && e.message).slice(0, 140)); }
  try {
    const m = masquee('10802300001', 'Paire vendue');
    const r = P({ items: [], masquees: [{ ...m, _vrmVueMasqueeLe: MAINT - 5 * 86400e3 }], pool: pool216, ventesParItem: { 10802300001: '150' }, complets: { [A]: true } });
    dit(num(r, m.id) === '150' && !r.fiches[m.id].nouveau, 'masquée dont une VENTE de la même annonce porte N°150 ⇒ N°150 (même sur un dressing ancien)', JSON.stringify(r.fiches[m.id]));
    const ph = ann('10802300002', 'Autre annonce');
    const mm = masquee('10802300003', 'Même fichier photo', { photo: ph.photo });
    const r3 = P({ items: [], masquees: [mm], fiches: { 10802300002: { numero: '88', photo: ph.photo, auto: true } }, pool: pool216, complets: { [A]: true } });
    dit(num(r3, mm.id) === '88', 'masquée au MÊME fichier photo qu’une fiche N°88 ⇒ N°88 (identité §5)', JSON.stringify(r3.fiches[mm.id]));
    const mr = masquee('10802300004', 'Réservé déjà pris');
    const r4 = P({ items: [], masquees: [mr], fiches: { 10802300009: { numero: '205', auto: true } }, reserves: { 10802300004: '205' }, pool: pool216, complets: { [A]: true } });
    dit(num(r4, mr.id) !== '205', 'un N° réservé déjà porté par une autre fiche n’est pas pris (jamais deux paires sous un N°)', JSON.stringify(r4.fiches[mr.id]));
  } catch (e) { dit(false, 'le bloc s’exécute', String(e && e.message).slice(0, 140)); }
  try {
    const T = 'Nike Air Max 90 blanche 42';
    const ms = Array.from({ length: 50 }, (_, i) => masquee(String(10803000000 + i), T, { brand: 'Nike', size: '42', t: 2000 + i }));
    const r = P({ items: [ann('10802999999', T)], masquees: ms, fiches: { 10802999999: { numero: '10', title: T, auto: true } }, pool: Array.from({ length: 10 }, (_, i) => i + 1), complets: { [A]: true } });
    const nums = ms.map((m) => num(r, m.id));
    dit(JSON.stringify(nums) === JSON.stringify(Array.from({ length: 50 }, (_, i) => String(11 + i))) && !nums.includes('10'), '50 masquées identiques à côté d’une fiche N°10 au même titre ⇒ 11…60, aucune ne reçoit 10', nums.slice(0, 4).join(','));
  } catch (e) { dit(false, 'le bloc s’exécute', String(e && e.message).slice(0, 140)); }
  try {
    const fr = masquee('10804000001', 'Masquée à demander'), vx = masquee('10804000002', 'Masquée ancienne', { _vrmVueMasqueeLe: MAINT - 40 * 3600e3 });
    const dm = N.demandesNumero({ items: N.annoncesANumeroter([], [fr, vx]), fiches: {}, listings: { complets: { [A]: true }, ko: [] }, mode: 'moi', lectureEcrite: () => null });
    dit(dm.length === 1 && String(dm[0].id) === fr.id, '« je numérote moi-même » : la masquée (dressing frais) est DEMANDÉE, pas l’ancienne', JSON.stringify(dm.map((x) => x.id)));
    const ec = masquee('10804000003', 'Masquée écrite', { desc: 'Très bon état.\nN° 77' });
    const r = P({ items: [], masquees: [ec], pool: pool216, complets: { [A]: true }, moi: true });
    dit(num(r, ec.id) === '77', '« je numérote moi-même » : le N° écrit dans la description d’une masquée est pris (77)', JSON.stringify(r.fiches[ec.id]));
    dit(/demandesNumero\(\{ items: annoncesANumeroter\(listings\.items, masqueesSurEtagere\)/.test(sansCommentaires(L.APP)), 'Ma journée demande aussi le N° des masquées (la même liste que la numérotation)');
    dit(N.annoncesANumeroter([{ id: 1 }], [{ id: 1 }, { id: 2 }]).map((x) => x.id).join(',') === '1,2', 'une annonce démasquée depuis (déjà en ligne) n’est parcourue qu’une fois');
  } catch (e) { dit(false, 'le bloc s’exécute', String(e && e.message).slice(0, 140)); }

  console.log('— 2. Une réservation qui dit un autre N° que la fiche (#4)');
  try {
    const R = N.reserveEnDesaccord;
    dit(typeof R === 'function', 'src/numerosNouvelles.js porte `reserveEnDesaccord`');
    if (typeof R === 'function') {
      const c = L.A.cleNum;
      dit(R('1', { numero: '131', reattribue: { de: '128', vers: '131', at: 'x' } }, { 1: '128' }, c) === null, 'le cas mesuré (fiche 131 venue de la règle des doublons depuis 128, réservation 128) : déjà dit dans « à écrire », pas deux fois');
      const d = R('1', { numero: '131' }, { 1: '128' }, c);
      dit(!!d && d.fiche === '131' && d.reserve === '128', 'fiche N°131, réservation N°128 sans explication ⇒ « à vérifier » avec les deux N°', JSON.stringify(d));
      dit(R('1', { numero: '131', cartonVerifie: 'x' }, { 1: '128' }, c) === null, 'après SON choix (`cartonVerifie`) : plus rien');
      dit(R('1', { numero: '007' }, { 1: '7' }, c) === null && R('1', { numero: '131' }, {}, c) === null, '« 007 » = « 7 » ; sans réservation : rien');
    }
    const APP = sansCommentaires(L.APP);
    dit(/const aVerifierCarton = useMemo\(\(\) => \[[^\]]*\]\.filter\(\(it\) => ficheAVerifier\(numeros\[it\.id\]\) \|\| !!reserveDe\(it\)\)/.test(APP), 'la ligne « N° à vérifier sur ton carton » montre aussi ces paires');
    dit(/data-verif-reserve=\{String\(reserve\)\}/.test(APP) && /data-verif-prendre-reserve=\{String\(reserve\)\}/.test(APP), '… avec « La fiche dit N°X · l’extension avait réservé N°Y » et SON choix « Le carton dit N°Y »');
    dit(/const prendreReserve = async \(it, y\) => \{[\s\S]{0,200}cleNum\(reservesNum\.parItem\[moi\]\) !== cle\) return;/.test(APP), '« Le carton dit N°Y » ne prend que la réservation liée à CETTE annonce (par son identifiant)');
    dit(!/reserveDe\([^)]*\)[\s\S]{0,80}updatePair/.test(APP), 'rien ne change le N° tout seul (aucune écriture sans son clic)');
  } catch (e) { dit(false, 'le bloc s’exécute', String(e && e.message).slice(0, 140)); }

  console.log(ko ? `\n❌ Masquées : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ Masquées : ${ok} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
