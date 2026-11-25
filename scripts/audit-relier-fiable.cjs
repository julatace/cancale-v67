#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — DES PROPOSITIONS D'ACHAT FIABLES (16 nov., lot relier-fiable)
//        node scripts/audit-relier-fiable.cjs [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Julien (16 nov., capture d'Achats) : la MÊME vente « N°116 Adidas Spezial » violette proposée
// « Possible · Relier » sous TROIS achats (bleu marine, marron, bordeaux) — « je veux que la liaison
// pour relier l'achat soit beaucoup plus fiable, sinon ça ne sert à rien de faire des propositions ».
// EXÉCUTE src/liaisonAchat.js avec la marque, les couleurs et le modèle de l'APP (extraits de
// src/App.jsx) :
//   C  la COULEUR : écrite des deux côtés et contraire ⇒ jamais proposée ; lue sur la PHOTO (couleur
//      dominante, src/couleurPhoto.js) quand le titre n'en dit rien ; le blanc d'une semelle n'accorde
//      pas un violet et un bleu ;
//   X  l'EXCLUSIVITÉ : en ligne, AU PLUS une proposition par article et par achat, toujours « très
//      probable » ; égalité ⇒ rien ; 50 paires identiques ⇒ rien ;
//   T  la pointure normalisée (« 42⅔ » = « 42 2/3 », « 42,0 » = « 42 ») ;
//   N  le niveau : « très probable » exige taille ET couleur ET modèle ;
//   F  « Ce n'est pas lui » : ni en ligne ni en piste ;
//   S  le branchement : Achats, « Sans achat relié », la feuille « Choisir un autre achat » (pistes
//      REPLIÉES), la saisie en série, la vente, le numérotage passent par la même règle.
// Aucune donnée réelle : tout est inventé ici.
// --prouve : chaque mutation réaffaiblit une règle ⇒ l'audit DOIT rougir.
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const MUTS = {
  'couleur-ignoree': ['src/liaisonAchat.js', "  if (accord === '') return null;\n", ''],
  'photo-ignoree': ['src/liaisonAchat.js', "  if (ph && ph.length) return { c: ph, source: 'photo', photo: ph };\n", ''],
  'semelle-accorde': ['src/liaisonAchat.js', 'const a = vx.length && vy.length ? vx : X, b = vx.length && vy.length ? vy : Y;', 'const a = X, b = Y;'],
  'exclusivite-article': ['src/liaisonAchat.js', '    if (e.score - rival < ECART_TRES_PROBABLE) continue;\n', ''],
  'exclusivite-achat': ['src/liaisonAchat.js', '    if (e.score - rivalA < ECART_TRES_PROBABLE) continue;\n', ''],
  'pistes-en-ligne': ['src/liaisonAchat.js', "    parArticle[key] = e0 ? [versProposition(key, e0, 'tres-probable', false)] : [];", "    parArticle[key] = l.slice(0, max).map((e) => versProposition(key, e, e === e0 ? 'tres-probable' : 'possible', false));"],
  'fort-sans-couleur': ['src/liaisonAchat.js', '&& tailleOk && !!couleur && accordPhotos', '&& (tailleOk || !!couleur) && accordPhotos'],
  'taille-tiers': ['src/suggestionsAchat.js', ".replace(/⅔/g, ' 2/3')", ''],
  'refus-piste': ['src/liaisonAchat.js', "if (refus.size && refus.has(P.key + '>' + A.tx)) return null;", ''],
  'app-pistes-ouvertes': ['src/ecrans/Achats.jsx', 'const [pistesOuvertes, setPistesOuvertes] = useState(false);', 'const [pistesOuvertes, setPistesOuvertes] = useState(true);'],
  'app-delier-sans-confirmer': ['src/App.jsx', '    if(ok!==true) return;\n    const patch=patchDelier(l.e); if(!patch) return;', '    const patch=patchDelier(l.e); if(!patch) return;'],
  'app-delier-sans-refus': ['src/App.jsx', "    for(const key of l.keys){ const id=cleRefusLiaison(key,l.tx); if(!refus[id]) ops.push({ k:'vrm_liaison_refus', type:'cle', id, apres:new Date().toISOString(), avant:undefined }); }\n", ''],
  'fiche-recu-lien-mort': ['src/FichePaire.jsx', "{lien.recu === true ? <button", "{lien.recu !== undefined ? <button"],
  'app-recu-par-titre': ['src/App.jsx', 'achat=Array.isArray(achats)?achats.find((a)=>a&&String(a.transaction_id)===l.tx)||null:null;', 'achat=Array.isArray(achats)?achats.find((a)=>a&&String(a.title||"")===String((l.e.buyFrom&&l.e.buyFrom.title)||""))||null:null;'],
  'app-sans-photo': ['src/App.jsx', 'couleurPhotoDe: (u) => (couleursLiaison && couleursLiaison.get(u)) || null });', '});'],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
let SRC = path.join(R, 'src');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
if (MUT) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'relier-fiable-'));
  process.on('exit', () => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} });   // (disque partagé : rien ne reste)
  fs.cpSync(path.join(R, 'src'), path.join(d, 'src'), { recursive: true, filter: (s) => !/node_modules/.test(s) });
  const [f, ...paires] = MUTS[MUT];
  const p = path.join(d, f); let s = fs.readFileSync(p, 'utf8');
  for (let i = 0; i < paires.length; i += 2) { if (!s.includes(paires[i])) { console.log('motif introuvable : ' + MUT); process.exit(2); } s = s.replace(paires[i], paires[i + 1]); }
  fs.writeFileSync(p, s); SRC = path.join(d, 'src');
  console.log('⚠️  MUTATION « ' + MUT + ' » — doit rougir');
}
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (c || !d ? '' : ' — ' + d)); };

const { sourceApp } = require('./_source-app.cjs');
const APP = sourceApp(path.dirname(SRC));
const bout = (debut, fin) => { const a = APP.indexOf(debut); const b = APP.indexOf(fin, a); if (a < 0 || b < 0) throw new Error('introuvable : ' + debut); return APP.slice(a, b + fin.length); };
const ctx = {};
vm.runInNewContext([bout('const KNOWN_BRANDS=[', '];'), bout('function extractBrand(text){', '\n}'), bout('const COULEURS = {', '\n};'),
  bout('function extractColors(text){', '\n}'), bout('const KNOWN_MODELS = [', '];'), bout('function extractModel(text){', '\n}'), bout('function contientModele(t,k){', '\n}'),
  'this.extractBrand=extractBrand; this.extractColors=extractColors; this.extractModel=extractModel;'].join('\n'), ctx);
const regles = { marqueDe: ctx.extractBrand, couleursDe: ctx.extractColors, modeleDe: ctx.extractModel };

const J = 86400e3, T0 = Date.parse('2026-09-01T10:00:00Z');
const iso = (t) => new Date(t).toISOString();
let tx = 5000;
const achat = (title, jours = -12, extra = {}) => ({ transaction_id: ++tx, title, date: iso(T0 + jours * J), price: { amount: '30.0', currency_code: 'EUR' }, status: 'Transaction finalisée', ...extra });
const cible = (key, titre, taille, extra = {}) => ({ key, titre, taille, dateRef: iso(T0), prix: { amount: '60.0' }, ...extra });
// La couleur dominante « lue » des photos (ce que rend src/couleurPhoto.js) : par adresse.
const photos = (m) => (u) => (Object.prototype.hasOwnProperty.call(m, u) ? m[u] : null);
const enLigne = (r) => Object.values(r.parArticle).reduce((n, l) => n + (l || []).length, 0);

(async () => {
  let L = null, S = null;
  try { L = await import(require('url').pathToFileURL(path.join(SRC, 'liaisonAchat.js')).href); } catch (e) { dit(false, 'src/liaisonAchat.js se charge', e.message); }
  try { S = await import(require('url').pathToFileURL(path.join(SRC, 'suggestionsAchat.js')).href); } catch (_) {}
  if (!L) { console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(1); }
  const aff = (o) => { const r = L.affecterPropositions({ ...regles, liens: new Map(), ...o }); r.pistes = r.pistes || {}; return r; };
  // (un banc ne meurt pas, il rapporte : une fonction absente sur l'arbre d'avant rend un rouge, pas une exception)
  const manque = (f) => () => { throw new Error(f + ' absente'); };
  for (const f of ['couleursAccord', 'publierAffectation', 'seriePropositions', 'pistesArticle']) if (typeof L[f] !== 'function') { dit(false, `src/liaisonAchat.js exporte \`${f}\``); L = { ...L, [f]: f === 'publierAffectation' ? () => {} : f === 'couleursAccord' ? () => undefined : f === 'seriePropositions' ? () => ({}) : manque(f) }; }

  // ── C · LA CAPTURE DE JULIEN : la vente violette, trois achats d'une autre couleur ───────────
  {
    // (a) les couleurs lues sur les PHOTOS des achats (titres sans couleur, comme sur sa base)
    const A = [achat('Adidas spezial', -20, { photo: { url: 'p:bleu' } }), achat('adidas Spezial', -18, { photo: { url: 'p:marron' } }), achat('Adidas spézial', -15, { photo: { url: 'p:bordeaux' } })];
    const v = cible('v:116', 'Adidas Spezial violet taille 37,5', '37.5', { dateRefSource: 'vente', photo: 'p:violet' });
    const coul = photos({ 'p:bleu': [{ c: 'bleu', part: 0.6 }, { c: 'blanc', part: 0.3 }], 'p:marron': [{ c: 'marron', part: 0.7 }, { c: 'blanc', part: 0.25 }], 'p:bordeaux': [{ c: 'rouge', part: 0.65 }, { c: 'blanc', part: 0.3 }], 'p:violet': [{ c: 'violet', part: 0.6 }, { c: 'blanc', part: 0.3 }] });
    const r = aff({ cibles: [v], achats: A, couleurPhotoDe: coul });
    dit(enLigne(r) === 0 && !Object.keys(r.parAchat).length, 'C1 la capture : vente Spezial VIOLETTE, achats bleu / marron / bordeaux (photos) ⇒ AUCUNE proposition, sous aucun achat', JSON.stringify(r.parAchat));
    dit(!(r.pistes['v:116'] || []).length, 'C2 …et aucune piste non plus (couleur contraire = filtre dur)', String((r.pistes['v:116'] || []).length));
    // (b) les couleurs ÉCRITES dans les titres des achats
    const B = [achat('Adidas spezial bleu marine'), achat('Adidas spezial marron', -14), achat('Adidas Spezial bordeaux', -16)];
    const r2 = aff({ cibles: [cible('v:116', 'Adidas Spezial violet taille 37,5', '37.5', { dateRefSource: 'vente' })], achats: B });
    dit(enLigne(r2) === 0 && !(r2.pistes['v:116'] || []).length, 'C3 titres « bleu marine » / « marron » / « bordeaux » contre « violet » ⇒ rien, ni en ligne ni en piste');
    // (c) le blanc des semelles n'accorde pas deux couleurs vives
    dit(L.couleursAccord(['violet', 'blanc'], ['bleu', 'blanc'], { photo: true }) === '', 'C4 violet+blanc / bleu+blanc ⇒ désaccord (le blanc de la semelle ne compte pas)');
    dit(L.couleursAccord(['violet', 'blanc'], ['blanc']) === 'blanc', 'C5 violet+blanc / « blanc » écrit seul ⇒ accord prudent (rien n’est écarté sur un doute)');
    dit(L.couleursAccord(['rouge'], ['marron'], { photo: true }) === 'rouge' && L.couleursAccord(['rouge'], ['marron']) === '', 'C6 bordeaux lu « rouge » ou « marron » : toléré sur une PHOTO seulement');
    dit(L.couleursAccord(['bleu'], ['violet'], { photo: true }) === '', 'C7 bleu / violet : jamais tolérés, même sur une photo');
    dit(L.couleursAccord([], ['bleu']) === null, 'C8 une couleur pas sue ⇒ null (« pas su » n’écarte rien et n’accorde rien)');
    // (d) titre sans couleur des DEUX côtés, photo lue d'un seul : rien n'est « très probable »
    const r3 = aff({ cibles: [cible('a:1', 'Adidas Spezial taille 42', '42')], achats: [achat('Adidas Spezial 42')], couleurPhotoDe: photos({}) });
    dit(enLigne(r3) === 0 && (r3.pistes['a:1'] || []).length === 1, 'C9 couleur inconnue d’un côté ⇒ jamais « très probable », seulement une piste repliée');
    // (e) la photo de l'annonce et celle de l'achat lues et d'accord ⇒ « très probable »
    const r4 = aff({ cibles: [cible('a:2', 'Adidas Spezial taille 42', '42', { photo: 'p:a' })], achats: [achat('Adidas Spezial 42', -10, { photo: { url: 'p:b' } })], couleurPhotoDe: photos({ 'p:a': [{ c: 'violet', part: 0.7 }], 'p:b': [{ c: 'violet', part: 0.6 }, { c: 'blanc', part: 0.3 }] }) });
    dit((r4.parArticle['a:2'] || []).length === 1 && r4.parArticle['a:2'][0].niveau === 'tres-probable', 'C10 couleur lue sur les deux photos et d’accord ⇒ « très probable »');
    dit(L.morceauxPourquoi(r4.parArticle['a:2'] && r4.parArticle['a:2'][0]).some((m) => m.cle === 'couleurPhoto'), 'C11 le pourquoi dit que la couleur a été LUE sur la photo');
    const r5 = aff({ cibles: [cible('a:3', 'Adidas Spezial violet taille 42', '42', { photo: 'p:a' })], achats: [achat('Adidas Spezial violet 42', -10, { photo: { url: 'p:b' } })], couleurPhotoDe: photos({ 'p:a': [{ c: 'violet', part: 0.7 }], 'p:b': [{ c: 'vert', part: 0.7 }] }) });
    dit(enLigne(r5) === 0, 'C12 titres d’accord mais les DEUX photos lues en désaccord ⇒ pas « très probable »');
  }

  // ── X · L'EXCLUSIVITÉ ──────────────────────────────────────────────────
  {
    const r = aff({ cibles: [cible('v:9', 'Adidas Spezial violet taille 37,5', '37.5')], achats: [achat('Adidas Spezial violet 37,5')] });
    dit((r.parArticle['v:9'] || []).length === 1 && Object.keys(r.parAchat).length === 1 && r.parAchat[Object.keys(r.parAchat)[0]][0].key === 'v:9', 'X1 même modèle, même couleur, même taille ⇒ UNE proposition, sous UN seul achat');
    const r2 = aff({ cibles: [cible('v:9', 'Adidas Spezial violet taille 37,5', '37.5')], achats: [achat('Adidas Spezial violet 37,5'), achat('Adidas Spezial violet 37,5')] });
    dit(enLigne(r2) === 0 && !Object.keys(r2.parAchat).length, 'X2 deux achats identiques pour une vente ⇒ égalité ⇒ AUCUNE proposition (on ne devine pas)');
    const r3 = aff({ cibles: [cible('v:1', 'Adidas Spezial violet taille 37,5', '37.5'), cible('v:2', 'Adidas Spezial violet taille 37,5', '37.5')], achats: [achat('Adidas Spezial violet 37,5')] });
    dit(enLigne(r3) === 0 && !Object.keys(r3.parAchat).length, 'X3 deux ventes identiques pour un achat ⇒ aucune proposition');
    // 50 paires identiques, 50 achats identiques
    const cs = [], as = [];
    for (let i = 0; i < 50; i++) { cs.push(cible('a:' + (100 + i), 'Nike Air Force 1 blanc taille 42', '42')); as.push(achat('Nike air force 1 blanche 42', -10 - (i % 3))); }
    const r4 = aff({ cibles: cs, achats: as });
    dit(enLigne(r4) === 0 && r4.tresProbables.length === 0 && !Object.keys(r4.parAchat).length, '« Même avec 50 articles identiques » : 0 proposition en ligne, 0 « très probable »', String(enLigne(r4)));
    // Un grand jeu varié : l'invariant (≤ 1 par article, ≤ 1 par achat, toujours « très probable », parArticle ⇔ parAchat)
    const mods = [['Nike Air Max 90', 'noir'], ['Nike Air Max 1', 'blanc'], ['Adidas Samba', 'noir'], ['Adidas Gazelle', 'bleu'], ['Adidas Spezial', 'violet'], ['New Balance 550', 'vert'], ['Salomon XT-6', 'noir'], ['Asics Gel Kayano 14', 'gris']];
    const tailles = ['40', '41', '42', '43'];
    const C2 = [], A2 = [];
    let k = 0;
    for (const [m, c] of mods) for (const t of tailles) for (let j = 0; j < 3; j++) { C2.push(cible('a:' + (1000 + k++), `${m} ${c} taille ${t}`, t)); A2.push(achat(`${m} ${j % 2 ? c : ''} ${j === 2 ? '' : t}`.replace(/\s+/g, ' '), -5 - j * 7)); }
    const r5 = aff({ cibles: C2, achats: A2 });
    const vus = new Map(); let inv = true;
    for (const [key, l] of Object.entries(r5.parArticle)) { if (l.length > 1) inv = false; for (const p of l) { if (p.niveau !== 'tres-probable') inv = false; const t = String(p.achat.transaction_id); if (vus.has(t)) inv = false; vus.set(t, key); if (!r5.parAchat[t] || r5.parAchat[t][0].key !== key) inv = false; } }
    for (const [t, l] of Object.entries(r5.parAchat)) if (l.length !== 1 || vus.get(t) !== l[0].key) inv = false;
    dit(inv, `X4 invariant sur ${C2.length} articles × ${A2.length} achats : ≤ 1 proposition par article ET par achat, toujours « très probable », les deux sens identiques`);
    dit(Object.values(r5.pistes).every((l) => l.every((p) => p.niveau === 'piste')), 'X5 les pistes ne sont jamais « très probable »');
    dit(Object.entries(r5.pistes).every(([key, l]) => l.every((p) => { const t = String(p.achat.transaction_id); return !r5.parAchat[t] || r5.parAchat[t][0].key === key; })), 'X6 un achat retenu pour un article n’est la piste d’aucun autre');
    // L'isolé respecte l'affectation publiée
    L.publierAffectation(r, ['v:9']);
    const iso1 = L.propositionsArticle({ ...regles, cible: cible('a:autre', 'Adidas Spezial violet taille 37,5', '37.5'), achats: [achat('Adidas Spezial violet 37,5')].map((a) => ({ ...a, transaction_id: Number(Object.keys(r.parAchat)[0]) })), liens: new Map() });
    dit(iso1.length === 0, 'X7 un article jugé seul (numérotage, vente) ne reçoit jamais un achat déjà retenu pour un AUTRE article');
    L.publierAffectation(null);
  }

  // ── T · LA POINTURE ────────────────────────────────────────────────────
  {
    const t = S ? S.tailleNorm : () => '';
    dit(t('42⅔') === '42 2/3' && t('42 2/3') === '42 2/3' && t('42,66') === '42 2/3' && t('42⅓') === '42 1/3', 'T1 « 42⅔ » = « 42,66 » = « 42 2/3 » ; « 42⅓ » = « 42 1/3 »', [t('42⅔'), t('42,66'), t('42⅓')].join(' | '));
    dit(t('42,0') === '42' && t('42.0') === '42', 'T2 « 42,0 » = « 42 »');
    const r = aff({ cibles: [cible('a:t', 'Adidas Samba noir taille 42⅔', '42⅔')], achats: [achat('Adidas samba noire 42 2/3')] });
    dit((r.parArticle['a:t'] || []).length === 1, 'T3 « 42⅔ » (annonce) et « 42 2/3 » (achat) : la même taille ⇒ proposée');
    const r2 = aff({ cibles: [cible('a:t', 'Adidas Samba noir taille 42', '42')], achats: [achat('Adidas samba noire 43')] });
    dit(enLigne(r2) === 0 && !(r2.pistes['a:t'] || []).length, 'T4 42 / 43 écrites des deux côtés ⇒ jamais proposée');
  }

  // ── N · LE NIVEAU ──────────────────────────────────────────────────────
  {
    const r = aff({ cibles: [cible('a:n', 'Nike Air Max 90 noir taille 42', '42')], achats: [achat('Nike air max 90 noire')] });
    dit(enLigne(r) === 0, 'N1 couleur d’accord mais taille pas écrite sur l’achat ⇒ pas « très probable » (taille ET couleur exigées)');
    const r2 = aff({ cibles: [cible('a:n', 'Nike Air Max 90 taille 42', '42')], achats: [achat('Nike air max 90 42')] });
    dit(enLigne(r2) === 0, 'N2 taille d’accord mais aucune couleur ⇒ pas « très probable »');
    const r3 = aff({ cibles: [cible('a:n', 'Nike Air Max 90 noir taille 42', '42')], achats: [achat('Nike air max 90 noire taille 42')] });
    dit((r3.parArticle['a:n'] || [])[0] && r3.parArticle['a:n'][0].niveau === 'tres-probable', 'N3 marque + modèle + taille + couleur ⇒ « très probable »');
    const r4 = aff({ cibles: [cible('a:n', 'Nike Air Max 90 noir taille 42', '42')], achats: [achat('Adidas air max 90 noire taille 42')] });
    dit(enLigne(r4) === 0 && !(r4.pistes['a:n'] || []).length, 'N4 une autre marque ⇒ jamais, même en piste');
    const r5 = aff({ cibles: [cible('a:n', 'Nike Air Max 90 noir taille 42', '42')], achats: [achat('Nike air max 90 noire taille 42', +3)] });
    dit(enLigne(r5) === 0 && !(r5.pistes['a:n'] || []).length, 'N5 un achat commandé APRÈS la mise en ligne ⇒ jamais');
  }

  // ── F · « CE N'EST PAS LUI » ───────────────────────────────────────────
  {
    const a = achat('Nike air max 90 noire taille 42');
    const r = aff({ cibles: [cible('a:f', 'Nike Air Max 90 noir taille 42', '42')], achats: [a], refus: { [L.cleRefusLiaison('a:f', String(a.transaction_id))]: '2026-11-16' } });
    dit(enLigne(r) === 0 && !(r.pistes['a:f'] || []).length, 'F1 un couple refusé ne revient ni en ligne ni en piste');
    const s = L.seriePropositions({ ...regles, lignes: [{ key: 'f', titre: 'Nike Air Max 90 noir taille 42', taille: '42', dateRef: iso(T0) }], achats: [a], liens: new Map(), refus: { [L.cleRefusLiaison('a:f', String(a.transaction_id))]: '2026-11-16' } });
    dit(!s.f, 'F2 …ni dans la saisie en série (la même clé d’article)');
    const s2 = L.seriePropositions({ ...regles, lignes: [{ key: 'f', titre: 'Nike Air Max 90 noir taille 42', taille: '42', dateRef: iso(T0) }, { key: 'g', titre: 'Nike Air Max 90 noir taille 42', taille: '42', dateRef: iso(T0) }], achats: [a], liens: new Map() });
    dit(!((s2.f || []).some((x) => x.sur)) && !((s2.g || []).some((x) => x.sur)), 'F3 saisie en série : deux paires identiques pour un achat ⇒ aucune « C’est ça »');
  }

  // ── S · LE BRANCHEMENT ─────────────────────────────────────────────────
  {
    const sans = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    const A = sans(APP);
    const ACH = sans(fs.readFileSync(path.join(SRC, 'ecrans', 'Achats.jsx'), 'utf8'));
    dit(!/liaison\.autresPossibles/.test(A), 'S1 « Sans achat relié » ne montre plus « N autres achats possibles » en ligne');
    dit(/couleurPhotoDe: \(u\) => \(couleursLiaison && couleursLiaison\.get\(u\)\) \|\| null/.test(A) && /mettreAJourCouleurs\(/.test(A) && /chargerPhotoBoite\(u\)/.test(A), 'S2 l’affectation reçoit la couleur DOMINANTE des photos, lue sur l’appareil (src/indexCouleurs.js, chemin de l’extension / de VRM)');
    dit(/publierAffectation\(r, cibles\.map/.test(A), 'S3 l’affectation est PUBLIÉE (numérotage, vente, feuille : la même vérité)');
    dit(/seriePropositions\(\{ lignes: fillBuyRows/.test(A) && /refus: liaisonRefus/.test(A), 'S4 la saisie en série passe par la même affectation, refus compris');
    dit(/pistesArticle\(/.test(ACH) && /useState\(false\);[^\n]*$/m.test(ACH.split('const [pistesOuvertes')[1] ? 'const [pistesOuvertes' + ACH.split('const [pistesOuvertes')[1].split('\n')[0] : '') && /data-pistes-bouton/.test(ACH), 'S5 la feuille « Relier un achat » : pistes REPLIÉES sous « Autres pistes · N »');
    dit(/liaison\.parAchat\[String\(o\.transaction_id\)\]\[0\]/.test(A), 'S6 Achats : la proposition sous un achat vient de `parAchat` (au plus une, exclusive)');
    // (16 nov., ajout de Julien) Délier et Reçu dans la fiche, à côté de « Achetée ».
    const FP = sans(fs.readFileSync(path.join(SRC, 'FichePaire.jsx'), 'utf8'));
    const corpsDelier = (A.split('const delierAchatFiche=')[1] || '').split('\n  };')[0];
    dit(/askConfirm\(/.test(corpsDelier) && corpsDelier.indexOf('askConfirm(') < corpsDelier.indexOf('gesteVrm(') && /if\(ok!==true\) return;/.test(corpsDelier), 'D1 « Délier » demande d’abord (une phrase), puis un geste annulable (`gesteVrm`)');
    dit(/patchDelier\(l\.e\)/.test(corpsDelier) && /k:'vrm_liaison_refus', type:'cle', id, apres:/.test(corpsDelier), 'D2 délier retire le lien (et le prix posé par lui) et range le couple dans « Ce n’est pas lui »');
    const corpsRecu = (A.split('const [recuFicheDispo,setRecuFicheDispo]')[1] || '').split('const ouvrirRecuFiche')[0];
    dit(/String\(a\.transaction_id\)===l\.tx/.test(corpsRecu) && /recuDeLAchat\(achat,/.test(corpsRecu) && !/\.find\(\(a\)=>[^\n]*title/.test(corpsRecu), 'D3 le reçu se trouve par le N° DE TRANSACTION de l’achat relié, jamais par titre (§5)');
    // (20 nov., chasse-bugs) Fiche refaite (19 nov., fiche-directe) : l'achat relié vit dans l'histoire de la fiche native
    // (src/natif/ecrans/Fiche.jsx) — « Reçu » SEULEMENT s'il y en a un, « Délier » à côté, toujours. (« Pas de reçu » n'est
    // plus écrit : rien n'est montré à la place d'un lien mort.)
    const FN = sans(fs.readFileSync(path.join(SRC, 'natif', 'ecrans', 'Fiche.jsx'), 'utf8'));
    // (24 nov., main-vert) Boutons natifs : `<Bouton … attrs={{ 'data-fd-recu': achatRelie.tx }}>` au lieu de `<button data-fd-recu={…}>`.
    const fdAttr = (nom, val) => `(?:${nom}=\\{${val}\\}|'${nom}': ${val})`;
    const d4Natif = new RegExp(`\\{achatRelie\\.recu \\? <(?:button|Bouton)\\b[^\\n]*${fdAttr('data-fd-recu', 'achatRelie\\.tx')}[^\\n]*: null\\}`).test(FN)
      && new RegExp(`<(?:button|Bouton)\\b[^\\n]*onClick=\\{achatRelie\\.onDelier\\}[^\\n]*${fdAttr('data-fd-delier', 'achatRelie\\.tx')}`).test(FN) && /achatRelie=\{achatRelie\}/.test(FP);
    dit(d4Natif || (/lien\.recu === true \? <button[^\n]*data-fd-recu/.test(FP) && /lien\.recu === false \? <small[^\n]*data-fd-pas-recu/.test(FP) && /data-fd-delier=\{lien\.tx\}/.test(FP)), 'D4 la fiche : « Reçu » seulement s’il y a un reçu, sinon « Pas de reçu » (jamais un lien mort) ; « Délier » toujours');
    dit(/achatRelie=\{achatRelieFiche\}/.test(A) && /<FeuilleRecuAchat recu=\{recuFicheVue\} z=\{Z_CONFIRMATION \+ 10\}/.test(A), 'D5 branché sur la fiche ; le reçu s’ouvre AU-DESSUS d’elle');
  }

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
