// ════════════════════════════════════════════════════════════════════════════
//  « Plusieurs lignes nommées, une seule lecture » (src/lectureGroupee.js,
//  8 nov., démarrage) — la VRAIE règle EXÉCUTÉE contre une fausse base qui
//  compte ses lectures et sert la forme réelle (`id=in.(…)` ⇒ les lignes qui
//  existent, avec leur `id`).
//   1. trois lignes demandées dans le même tour = UNE lecture ; chacun reçoit
//      SA ligne (jamais celle d'un autre), une ligne absente = `[]` ;
//   2. une lecture groupée ratée (503, réseau, JSON illisible) = `null` pour
//      TOUS (« pas su », jamais `[]`) ;
//   3. un refus « pas compris » (400) = chaque ligne relue SEULE ;
//   4. une réponse qu'on ne sait pas attribuer (ligne sans id, id pas demandé,
//      deux fois le même) = chaque ligne relue seule ;
//   5. une réponse groupée VIDE = relue ligne par ligne ;
//   6. deux sessions ne partagent jamais un lot ;
//   7. plus de MAX_LOT lignes = plusieurs lots, aucune perdue ;
//   8. deux appelants de la même ligne = deux tableaux distincts ;
//   9. 50 comptes « identiques » (§5) : chaque compte reçoit la ligne de SON id.
//  Et le câblage dans App.jsx : `fetchHarvestBrut` lit par `lireMoissonGroupee`
//  (projection `SEL_MOISSON`, `id=in.(…)`), « pas su » ⇒ `null`.
//  `--prouve` : mutations ⇒ ROUGE exigé.
//  Lancer : node scripts/audit-lecture-groupee.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src', 'lectureGroupee.js');
const APP = path.join(__dirname, '..', 'src', 'App.jsx');

async function charger(texte) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-'));
  const f = path.join(dir, 'lg.mjs');
  fs.writeFileSync(f, texte);
  return import(pathToFileURL(f).href);
}
// Un appelant qui n'est JAMAIS servi est un rouge (une ligne perdue), pas un arrêt muet.
const tous = (ps) => Promise.race([Promise.all(ps), new Promise((_, ko) => setTimeout(() => ko(new Error('appelant jamais servi')), 2000))]);
process.exitCode = 1;

function fausseBase(lignes, mode = {}) {
  const appels = { lots: [], seules: [] };
  const lireLot = async (ids, cle) => {
    appels.lots.push({ ids: [...ids], cle });
    if (mode.lot === 'panne') return { ok: false, statut: 503 };
    if (mode.lot === 'reseau') throw new Error('réseau');
    if (mode.lot === 'illisible') return { ok: false, statut: 0 };
    if (mode.lot === 'pascompris') return { ok: false, statut: 400 };
    if (mode.lot === 'vide') return { ok: true, rows: [] };
    if (mode.lot === 'sansid') return { ok: true, rows: ids.map((id) => ({ data: lignes[id] })) };
    if (mode.lot === 'intrus') return { ok: true, rows: [{ id: 'harvest_9_listings', data: 'intrus' }, ...ids.filter((i) => lignes[i]).map((id) => ({ id, data: lignes[id] }))] };
    if (mode.lot === 'double') return { ok: true, rows: [...ids, ids[0]].filter((i) => lignes[i]).map((id) => ({ id, data: lignes[id] })) };
    return { ok: true, rows: ids.filter((i) => lignes[i] !== undefined).map((id) => ({ id, data: lignes[id] })) };
  };
  const lireUne = async (id, cle) => {
    appels.seules.push({ id, cle });
    if (mode.une === 'panne') return null;
    return lignes[id] !== undefined ? [{ id, data: lignes[id] }] : [];
  };
  return { lireLot, lireUne, appels };
}

async function verifier(mod) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (!process.env.SILENCE) console.log((c ? '  ✅ ' : '  ❌ ') + m + (d != null ? ' — ' + d : '')); };
  const L = { a: 'A', b: 'B', c: 'C' };
  const donnees = (r) => (Array.isArray(r) ? r.map((x) => x.data).join('') : String(r));

  // 1.
  let fb = fausseBase(L); let g = mod.creerLectureGroupee(fb.lireLot, fb.lireUne);
  let r = await tous(['a', 'b', 'z', 'c'].map((id) => g.charger(id, 'S1')));
  dit(fb.appels.lots.length === 1 && fb.appels.seules.length === 0, '1. quatre lignes du même tour = une seule lecture', `${fb.appels.lots.length} lot(s), ${fb.appels.seules.length} seule(s)`);
  dit(donnees(r[0]) === 'A' && donnees(r[1]) === 'B' && donnees(r[3]) === 'C', '1. chacun reçoit SA ligne', r.map(donnees).join(','));
  dit(Array.isArray(r[2]) && r[2].length === 0, '1. une ligne absente = [] (la lecture a répondu)');
  dit(r.every((x) => !Array.isArray(x) || x.every((l) => l.id === ['a', 'b', 'z', 'c'][r.indexOf(x)])), '1. aucune ligne d\'un autre id');

  // 2.
  for (const m of ['panne', 'reseau', 'illisible']) {
    fb = fausseBase(L, { lot: m }); g = mod.creerLectureGroupee(fb.lireLot, fb.lireUne);
    r = await tous(['a', 'b'].map((id) => g.charger(id, 'S1')));
    dit(r.every((x) => x === null) && fb.appels.seules.length === 0, `2. lecture groupée « ${m} » = null pour tous (pas su)`, r.map(String).join(','));
  }
  // 3. 4. 5.
  for (const m of ['pascompris', 'sansid', 'intrus', 'double', 'vide']) {
    fb = fausseBase(L, { lot: m }); g = mod.creerLectureGroupee(fb.lireLot, fb.lireUne);
    r = await tous(['a', 'b', 'z'].map((id) => g.charger(id, 'S1')));
    dit(fb.appels.seules.length === 3 && donnees(r[0]) === 'A' && donnees(r[1]) === 'B' && Array.isArray(r[2]) && !r[2].length, `${m === 'pascompris' ? 3 : m === 'vide' ? 5 : 4}. réponse « ${m} » = chaque ligne relue seule, bonnes lignes`, r.map(donnees).join(','));
  }
  fb = fausseBase(L, { lot: 'vide', une: 'panne' }); g = mod.creerLectureGroupee(fb.lireLot, fb.lireUne);
  r = await tous(['a', 'b'].map((id) => g.charger(id, 'S1')));
  dit(r.every((x) => x === null), '5. relue seule et ratée = null (jamais [])');

  // 6.
  fb = fausseBase(L); g = mod.creerLectureGroupee(fb.lireLot, fb.lireUne);
  r = await tous([g.charger('a', 'S1'), g.charger('b', 'S2'), g.charger('c', 'S1')]);
  dit(fb.appels.lots.length + fb.appels.seules.length === 2 && fb.appels.lots.every((l) => l.ids.every((id) => (l.cle === 'S1' ? id !== 'b' : id === 'b'))) && fb.appels.seules.every((s) => s.cle === 'S2' && s.id === 'b'), '6. deux sessions = deux lectures, jamais mêlées', JSON.stringify(fb.appels));

  // 7.
  const beaucoup = Object.fromEntries(Array.from({ length: 95 }, (_, i) => ['l' + i, 'v' + i]));
  fb = fausseBase(beaucoup); g = mod.creerLectureGroupee(fb.lireLot, fb.lireUne);
  r = await tous(Object.keys(beaucoup).map((id) => g.charger(id, 'S')));
  dit(fb.appels.lots.length === 3 && fb.appels.lots.every((l) => l.ids.length <= mod.MAX_LOT) && r.every((x, i) => donnees(x) === 'v' + i), '7. 95 lignes = 3 lots de 40 au plus, aucune perdue', fb.appels.lots.map((l) => l.ids.length).join('+'));

  // 8.
  fb = fausseBase(L); g = mod.creerLectureGroupee(fb.lireLot, fb.lireUne);
  r = await tous([g.charger('a', 'S'), g.charger('a', 'S'), g.charger('b', 'S')]);
  dit(r[0] !== r[1] && donnees(r[0]) === 'A' && donnees(r[1]) === 'A' && fb.appels.lots.length === 1 && fb.appels.lots[0].ids.length === 2, '8. deux appelants de la même ligne : un id demandé, deux tableaux');

  // 9. cinquante comptes au contenu identique.
  const cinquante = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`harvest_${3150000000 + i}_listings`, JSON.stringify({ titre: 'Nike Air Max 1 blanc 42', i })]));
  fb = fausseBase(cinquante); g = mod.creerLectureGroupee(fb.lireLot, fb.lireUne);
  const ids = Object.keys(cinquante).reverse();
  r = await tous(ids.map((id) => g.charger(id, 'S')));
  dit(r.every((x, k) => Array.isArray(x) && x.length === 1 && x[0].id === ids[k] && x[0].data === cinquante[ids[k]]), '9. 50 comptes identiques : chacun la ligne de SON id');

  dit(mod.idGroupable('harvest_3150000000_listings') && !mod.idGroupable('a,b') && !mod.idGroupable('a)') && !mod.idGroupable('a b') && !mod.idGroupable('a%') && !mod.idGroupable('"a"'), 'un id avec , ) espace % " n\'est jamais mis dans in.(…)');

  // Câblage.
  const app = fs.readFileSync(APP, 'utf8').replace(/\/\/[^\n]*/g, '');
  const brut = /const fetchHarvestBrut = async[\s\S]{0,1200}/.exec(app);
  dit(!!brut && /const rows = await lireMoissonGroupee\(`harvest_\$\{uid\}_\$\{type\}`\);\s*if \(!Array\.isArray\(rows\)\) return null;/.test(brut[0]), 'App.jsx : fetchHarvestBrut lit par la lecture groupée ; pas su ⇒ null');
  dit(/app_data\?id=in\.\(\$\{ids\.join\(','\)\}\)&select=\$\{SEL_MOISSON\}/.test(app) && /app_data\?id=eq\.\$\{id\}&select=\$\{SEL_MOISSON\}/.test(app), 'App.jsx : lot `id=in.(…)` et lecture seule, tous deux projetés `SEL_MOISSON`');
  dit(/idGroupable\(id\) \? _groupeMoisson\.charger\(id, auth\) : _lireLigneMoissonSeule\(id, auth\)/.test(app), 'App.jsx : la session est la clé du lot ; un id pas sûr part seul');
  return ko;
}

(async () => {
  const texte = fs.readFileSync(SRC, 'utf8');
  const ko = await verifier(await charger(texte));
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ audit-lecture-groupee : vert');
  if (!process.argv.includes('--prouve') || ko) process.exit(ko ? 1 : 0);
  const mutations = [
    ['la 1re ligne donnée à tous', texte.replace('const row = parId.get(id);', 'const row = rows[0];')],
    ['une panne rend []', texte.replace('for (const id of ids) for (const ok of attente.get(id)) ok(null);\n      return undefined;', 'for (const id of ids) for (const ok of attente.get(id)) ok([]);\n      return undefined;')],
    ['une réponse vide acceptée', texte.replace('let attribuable = rows.length > 0;', 'let attribuable = true;')],
    ['un id pas demandé accepté', texte.replace("if (!id || !demandes.has(id) || parId.has(id)) { attribuable = false; break; }", "if (!id) { attribuable = false; break; }")],
    ['sessions mêlées', texte.replace('const k = String(cle);', "const k = '';")],
    ['lot sans limite', texte.replace('for (let i = 0; i < ids.length; i += maxLot) {', 'for (let i = 0; i < ids.length; i += ids.length) {')],
    ['400 = pas su', texte.replace('if (st >= 400 && st < 500 && st !== 401', 'if (false && st >= 400 && st < 500 && st !== 401')],
    ['même tableau partagé', texte.replace('ok(row ? [row] : [])', 'ok(row ? (parId.__t = parId.__t || {}, parId.__t[id] = parId.__t[id] || [row]) : [])')],
    ['id avec virgule accepté', texte.replace('/^[A-Za-z0-9_.:-]+$/', '/^[^)]+$/')],
  ];
  let verts = 0;
  for (const [nom, m] of mutations) {
    if (m === texte) { console.log('  ⚠️ mutation sans effet : ' + nom); verts++; continue; }
    process.env.SILENCE = '1';
    const k = await verifier(await charger(m)).catch(() => 1);
    delete process.env.SILENCE;
    console.log((k ? '  🔴 ' : '  🟢 ') + 'mutation « ' + nom + ' » ' + (k ? `rouge (${k})` : 'VERTE — non vue'));
    if (!k) verts++;
  }
  console.log(verts ? `\n❌ ${verts} mutation(s) non vue(s)` : `\n✅ ${mutations.length}/${mutations.length} mutations rouges`);
  process.exit(verts ? 1 : 0);
})();
