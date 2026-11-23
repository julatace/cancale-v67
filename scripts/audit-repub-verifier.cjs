// ════════════════════════════════════════════════════════════════════════════
//  LE CONTRÔLE AVANT DE LANCER UNE REPUBLICATION (20 nov., extension 5.410 — `repubverif`)
//
//  Julien : « les catégories sont parfois mal remplies et ça bloque côté Vinted ».
//  Mesuré (compteurs de l'extension chez lui, 20 nov.) : refus nommant la taille ×10 (+ photos
//  et taille ×1), les photos ×7, la description ×2 ; « listing restricted » ×1.
//
//  On EXÉCUTE le vrai background.js (`_fond-vm.cjs`) contre un faux Vinted de la forme de Vinted
//  (formulaire de l'annonce, grille `item_upload/attributes` de la catégorie, refus 422 par champ)
//  et la vraie règle de l'atelier (src/repubVerif.js). Données inventées (dépôt public).
//    V1  annonce complète : « ok », AUCUN geste chez Vinted (que des lectures)
//    V2  taille plus dans la grille, même libellé présent : « corrigée seule », montrée, et le départ
//        de la paire pose CETTE taille (jamais de secours après un refus)
//    V3  taille introuvable : « à corriger », UNE question aux valeurs de Vinted ; SA réponse ⇒ ok
//    V4  catégorie refusée par Vinted (422, champ « category ») : « à corriger », la catégorie demandée
//    V5  annonce absente chez Vinted (404) : « absente », elle ne part pas
//    V6  budget de lecture : la vérification s'arrête AVANT d'entamer les lectures du départ
//    V7  l'onglet ouvert sur un autre compte : rien n'est lu
//    V8  la règle de l'atelier : Lancer fermé tant qu'il reste « à corriger » ; « pas vérifiée » ne
//        bloque pas ; une réponse ne voyage qu'avec SA paire
//  `--prouve` : rouge sur origin/main ET par mutation.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SRC = arg('--src') ? path.resolve(arg('--src')) : path.join(RACINE, 'vinted-sync-extension', 'background.js');
const REGLE = arg('--regle') ? path.resolve(arg('--regle')) : path.join(RACINE, 'src', 'repubVerif.js');
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; if (!process.env.SILENCE) console.log('✅ ' + m); } else { ko++; if (!process.env.SILENCE) console.log('❌ ' + m + (d ? '  → ' + d : '')); } };
const nowISO = () => new Date().toISOString();
const PHOTOS = ['https://images1.vinted.net/t/01_0121e_testAAAA0001/f800/1.jpeg'];
const ITEM = (id, x = {}) => ({ id: Number(id), title: 'Basket test', description: 'Très bon état, boîte', price: { amount: '60.0', currency_code: 'EUR' }, currency: 'EUR', catalog_id: 2050, brand_id: 53, brand: 'Marque test',
  color_ids: [1], item_attributes: [{ code: 'size', ids: [791] }, { code: 'condition', ids: [2] }], package_size_id: 2, isbn: null, measurement_length: null, measurement_width: null, manufacturer: null, manufacturer_labelling: null, shipment_prices: { domestic: null }, is_draft: false, ...x });
const GRILLE = (tailles) => ({ attributes: [{ code: 'size', configuration: { required: true }, options: tailles.map(([id, t]) => ({ id, title: t })) }, { code: 'condition', configuration: { required: true }, options: [{ id: 2, title: 'Très bon état' }, { id: 6, title: 'Neuf' }] }] });
const GESTE = /\/(photos|drafts|delete|completion)(\/|$)|\/item_upload\/items\/?$/;

function monter({ items = {}, grille = () => ({ status: 200, body: GRILLE([[791, '42'], [792, '43']]) }), connecte = '111', lectures = 0, tailleCoffre = '42' } = {}) {
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: {} }, vrm_vinted_modele: {} };
  for (const id of Object.keys(items)) lignes[`coffre_111_${id}`] = { id, uid: '111', title: 'Basket test', price: 60, desc: 'Très bon état, boîte', photos: PHOTOS, size: tailleCoffre };
  const t = Date.now();
  const store = lectures ? { vrmLectures: { '111': Array.from({ length: lectures }, (_, i) => t - 1000 - i) } } : {};
  return faireFond({ src: SRC, lignes, connecte, store, cdn: () => ({ status: 200 }),
    vinted: (e) => {
      const m = /\/api\/v2\/item_upload\/items\/(\d+)$/.exec(e.chemin);
      if (e.methode === 'GET' && m) { const it = items[m[1]]; return it === 404 ? { status: 404, body: {} } : it ? { status: 200, body: { item: it } } : { status: 404, body: {} }; }
      if (e.methode === 'POST' && /\/item_upload\/attributes$/.test(e.chemin)) { let cat = 0; try { cat = JSON.parse(e.corps).attributes[0].value[0]; } catch (_) {} return grille(cat); }
      if (e.methode === 'GET' && /\/item_upload\/colors$/.test(e.chemin)) return { status: 404, body: {} };
      if (e.methode === 'POST' && /\/api\/v2\/photos$/.test(e.chemin)) return { status: 200, body: { id: 900 + Math.floor(Math.random() * 99) } };
      if (e.methode === 'POST' && /\/item_upload\/drafts\/?$/.test(e.chemin)) return { status: 200, body: { draft: { id: 88001 } } };
      if (e.methode === 'POST' && /\/items\/\d+\/delete$/.test(e.chemin)) return { status: 200, body: {} };
      return { status: 404, body: {} };
    } });
}
const verifier = (f, ids, extra = {}) => f.ctx.verifierRepub({ cmd: 'verifierRepub', uid: '111', ids, ...extra }).catch((e) => ({ erreur: String(e && e.message) }));
const paire = (r, id) => (r && Array.isArray(r.paires) ? r.paires.find((p) => p.id === id) : null) || {};
const gestes = (f) => f.j.vinted.filter((x) => x.methode !== 'GET' && GESTE.test(x.chemin));

async function auditer() {
  if (true) {
    const f0 = faireFond({ src: SRC, connecte: '111' });
    if (typeof f0.ctx.verifierRepub !== 'function') { dit(false, 'V0 — l’extension sait vérifier avant de lancer (verifierRepub)'); return fin(); }
  }
  // V1
  { const f = monter({ items: { '9101': ITEM(9101) } }); const r = await verifier(f, ['9101']);
    dit(r.accepte && paire(r, '9101').etat === 'ok' && !gestes(f).length, 'V1 — annonce complète : « ok », et AUCUN geste chez Vinted (que des lectures)', JSON.stringify(r).slice(0, 300) + ' gestes=' + gestes(f).length); }
  // V2
  { const it = ITEM(9102, { item_attributes: [{ code: 'size', ids: [790] }, { code: 'condition', ids: [2] }] });
    const f = monter({ items: { '9102': it } }); const r = await verifier(f, ['9102']); const p = paire(r, '9102');
    dit(p.etat === 'corrige' && (p.corrections || []).some((c) => c.champ === 'size') && !gestes(f).length, 'V2 — la taille n’est plus dans la grille, le même libellé (42) y est : « corrigée seule », dite, rien envoyé', JSON.stringify(p));
    const r2 = await f.ctx.recreerVinted({ cmd: 'recreerVinted', uid: '111', id: '9102', prix: 60, titre: 'Basket test', viaBrouillon: true, differer: true, confirme: true }).catch((e) => ({ erreur: String(e) }));
    const b = f.j.vinted.filter((x) => /drafts\/?$/.test(x.chemin)).map((x) => { try { return JSON.parse(x.corps).draft; } catch (_) { return null; } })[0];
    const sz = b && (b.item_attributes || []).find((a) => a.code === 'size');
    dit(sz && sz.ids[0] === 791 && f.j.vinted.filter((x) => /drafts\/?$/.test(x.chemin)).length === 1, 'V2b — au départ, le brouillon porte la taille corrigée (791) du premier coup : un seul brouillon, aucun secours', JSON.stringify({ sz, e: r2.etape, r: r2.raison })); }
  // V3
  { const it = ITEM(9103, { item_attributes: [{ code: 'size', ids: [790] }, { code: 'condition', ids: [2] }] });
    const f = monter({ items: { '9103': it }, grille: () => ({ status: 200, body: GRILLE([[801, '44'], [802, '45']]) }) });
    const r = await verifier(f, ['9103']); const p = paire(r, '9103');
    const opts = p.question && Array.isArray(p.question.options) ? p.question.options.map((o) => String(o[0])) : [];
    dit(p.etat === 'a-corriger' && p.question && p.question.champ === 'size' && opts.includes('801') && opts.includes('802'), 'V3 — taille introuvable dans la grille : « à corriger », UNE question aux valeurs de Vinted (44, 45)', JSON.stringify(p));
    const r2 = await verifier(f, ['9103'], { reponses: { '9103': { size: '802' } } }); const p2 = paire(r2, '9103');
    dit(p2.etat === 'ok' || p2.etat === 'corrige', 'V3b — SA réponse (45) revient avec SA paire : plus rien à corriger', JSON.stringify(p2));
    const r3 = await verifier(f, ['9103'], { reponses: { '9103': { size: '999' } } });
    dit(paire(r3, '9103').etat === 'a-corriger', 'V3c — une réponse qui n’est pas une valeur de Vinted est refusée (toujours à corriger)', JSON.stringify(paire(r3, '9103'))); }
  // V4
  { const f = monter({ items: { '9104': ITEM(9104, { catalog_id: 3333 }) }, grille: (cat) => cat === 3333 ? { status: 422, body: { code: 99, errors: [{ field: 'category', value: 'refus de test' }] } } : { status: 200, body: GRILLE([[791, '42']]) } });
    const r = await verifier(f, ['9104']); const p = paire(r, '9104');
    dit(p.etat === 'a-corriger' && /catégorie/.test((p.manque || []).join(' ')) && p.question && p.question.champ === 'catalog_id', 'V4 — catégorie refusée par Vinted (422 sur « category ») : « à corriger », la catégorie est demandée', JSON.stringify(p)); }
  // V5
  { const f = monter({ items: { '9105': 404 } }); const r = await verifier(f, ['9105']);
    dit(paire(r, '9105').etat === 'absente' && !gestes(f).length, 'V5 — Vinted ne connaît plus l’annonce (404) : « absente », elle ne partira pas', JSON.stringify(paire(r, '9105'))); }
  // V6
  { const ids = ['9201', '9202', '9203', '9204', '9205', '9206'];
    const items = Object.fromEntries(ids.map((id) => [id, ITEM(id)]));
    const f = monter({ items, lectures: 12 });   // 12 lues dans l'heure ; 6 à republier : 20 − 12 − 6 = 2 vérifiées au plus
    const r = await verifier(f, ids, { total: 6 });
    const lus = f.j.vinted.filter((x) => x.methode === 'GET' && /item_upload\/items\/\d+$/.test(x.chemin)).length;
    const pas = (r.paires || []).filter((p) => p.etat === 'pas-verifie').length;
    dit(lus <= 2 && pas >= 4 && /départ/.test(((r.paires || []).find((p) => p.etat === 'pas-verifie') || {}).raison || ''), 'V6 — budget de lecture : au plus 2 lectures (les 6 du départ sont gardées), les autres « vérifiées à leur départ », dit', `lus=${lus} pas=${pas}`); }
  // V7
  { const f = monter({ items: { '9101': ITEM(9101) }, connecte: '222' }); const r = await verifier(f, ['9101']);
    dit(r.accepte === false && !f.j.vinted.length, 'V7 — l’onglet est sur un autre compte : rien n’est lu, c’est dit', JSON.stringify(r)); }
  // V8 — la règle de l'atelier
  { const R = await import(REGLE + '?t=' + Date.now());
    const v = { a: { id: 'a', etat: 'ok' }, b: { id: 'b', etat: 'a-corriger', rep: { size: '802' } }, c: { id: 'c', etat: 'pas-verifie' }, d: { id: 'd', etat: 'absente' } };
    const lp = R.lancerPermis(['a', 'b', 'c'], v, false);
    dit(lp.ok === false && lp.raison === 'a-corriger' && lp.n === 1, 'V8a — Lancer reste fermé tant qu’une annonce est « à corriger »', JSON.stringify(lp));
    dit(R.lancerPermis(['a', 'c'], v, false).ok === true, 'V8b — « pas vérifiée » ne bloque pas (vérifiée au départ, comme avant)');
    dit(R.lancerPermis(['a'], v, true).ok === false, 'V8c — pendant la vérification, Lancer est fermé');
    dit(R.partiraPas(v, 'd') === true && R.partiraPas(v, 'a') === false, 'V8d — une annonce « absente » ne part jamais');
    dit(JSON.stringify(R.reponsesDe(v, 'b')) === '{"size":"802"}' && R.reponsesDe(v, 'a') === undefined, 'V8e — une réponse ne voyage qu’avec SA paire');
    const rs = R.resumeVerif(['a', 'b', 'c', 'd'], v);
    dit(rs.ok === 1 && rs.aCorriger === 1 && rs.pasVerifie === 1 && rs.absente === 1 && rs.verifiees === 3, 'V8f — le récapitulatif compte chaque état une fois', JSON.stringify(rs)); }
  // V9 — l'atelier branche la règle (Lancer, départ, réponses)
  { const s = fs.readFileSync(path.join(RACINE, 'src', 'ecrans', 'Republier.jsx'), 'utf8');
    dit(/disabled=\{!ok \|\| !aFaire\.length \|\| !lp\.ok\}/.test(s) && /partiraPas\(verif, a\.id\)/.test(s) && /reponsesDe\(verif, suiv\.id\)/.test(s), 'V9 — l’atelier : Lancer suit la règle, une absente est sautée, SA réponse part avec SA paire'); }
  fin();
}
function fin() { console.log(`\n${ko ? '❌' : '✅'} audit-repub-verifier : ${ok} verts, ${ko} rouges`); process.exit(ko ? 1 : 0); }

const MUTATIONS = [
  ['taille non corrigée', 'bg', "if (t.id) { it.item_attributes = [...attrs.filter((x) => x && x.code !== 'size'), { code: 'size', ids: [t.id] }]; noterDiag('avant_taille_corrigee'); }", "if (false) {}"],
  ['catégorie refusée ignorée', 'bg', "if (g && g.categorieRefusee && !(rep && rep.catalog_id))", 'if (false)'],
  ['absente prise pour ok', 'bg', "if (appris && (appris.status === 404 || appris.status === 410)) { paires.push({ id, etat: 'absente'", "if (false) { paires.push({ id, etat: 'absente'"],
  ['budget du départ non gardé', 'bg', '- Math.min(total, 10));', ');'],
  ['manque jamais bloquant', 'bg', "const etat = manque.length ? 'a-corriger' : corrections.length ? 'corrige' : 'ok';", "const etat = corrections.length ? 'corrige' : 'ok';"],
  ['Lancer ouvert malgré « à corriger »', 'regle', 'if (r.bloque) return', 'if (false) return'],
  ['réponse d’une autre paire', 'regle', "const p = verif && verif[str(id)];\n  const r = p && p.rep", "const p = verif && Object.values(verif).find((x) => x && x.rep);\n  const r = p && p.rep"],
];
const lancer = (args) => { try { cp.execFileSync(process.execPath, [__filename, ...args], { stdio: 'pipe', env: { ...process.env, SILENCE: '1' }, maxBuffer: 1 << 26 }); return 'vert'; } catch (e) { return 'rouge'; } };
function prouver() {
  const res = [];
  { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-avant-'));
    try { fs.writeFileSync(path.join(dir, 'bg.js'), cp.execSync('git show origin/main:vinted-sync-extension/background.js', { cwd: RACINE, maxBuffer: 1 << 28 })); res.push(['origin/main (avant)', lancer(['--src', path.join(dir, 'bg.js')])]); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); } }
  for (const [nom, f, de, vers] of MUTATIONS) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verif-mut-'));
    try {
      const src = f === 'bg' ? SRC : REGLE; const s0 = fs.readFileSync(src, 'utf8');
      if (!s0.includes(de)) { res.push([nom, 'motif absent']); continue; }
      const p = path.join(dir, f === 'bg' ? 'bg.js' : 'repubVerif.mjs'); fs.writeFileSync(p, s0.replace(de, vers));
      res.push([nom, lancer([f === 'bg' ? '--src' : '--regle', p])]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  let bon = true; for (const [n, r] of res) { if (r !== 'rouge') bon = false; console.log(`${r === 'rouge' ? '✅' : '❌'} --prouve · ${n} : ${r}`); }
  console.log(bon ? `✅ --prouve : ${res.length}/${res.length} rouges` : '❌ --prouve : une version affaiblie passe encore');
  process.exit(bon ? 0 : 1);
}
if (process.argv.includes('--prouve')) prouver(); else auditer();
