#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  UN N° PAR ANNONCE VESTIAIRE (2 novembre, soir)
//  node scripts/audit-numeros-vestiaire.cjs              (le contrôle)
//  node scripts/audit-numeros-vestiaire.cjs --mutations  (chaque règle
//                       réaffaiblie doit faire passer l'audit au rouge)
//
//  Julien : « je veux un numéro attribué par annonce ». On EXÉCUTE la vraie
//  règle (src/numerosVestiaire.js), le VRAI `prochainLibre` extrait d'App.jsx
//  (le mécanisme de Vinted, jamais une copie) et les vraies règles d'identité de
//  api/_lib/vestiaire-regle.js. Exigé (§5 « Les numéros de rangement ») :
//   N1  50 annonces au MÊME titre ⇒ 50 N° distincts, liés par `productId` ;
//   N2  le N° neuf part du plus haut (jamais un trou), jamais un N° du pool ;
//   N3  une annonce relue garde son N° (rien n'est renuméroté) ;
//   N4  un N° n'est JAMAIS redonné (annonce partie, nouvelle annonce ⇒ N° neuf) ;
//   N5  la vente prend le N° de SON annonce (par `productId`) — partout :
//       `numVcVente`, `ventesVcDe`, `colisVcAPoster`, `retraitsVestiaire` ;
//   N6  lien posé par VRM et référence VRM-n° d'abord : pas de N° neuf ;
//   N7  le titre n'entre nulle part (titres échangés ⇒ mêmes N°) ;
//   N8  retirée ⇒ pas de N° ; vente à expédier sans annonce lue ⇒ un N° (son
//       produit) ; vente annulée ⇒ rien ;
//   N9  App.jsx : la règle branchée sur `prochainLibre`, les N° Vestiaire comptés
//       par la numérotation de Vinted (4 endroits), la carte fusionnée comme les
//       fiches, aucun lecteur qui calcule un N° Vestiaire sans `auto`.
//  ⚠️ Un audit ne meurt pas, il rapporte : chaque bloc passe par `essaie`.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const APP = path.join(RACINE, 'src', 'App.jsx');
const MODULE = path.join(RACINE, 'src', 'numerosVestiaire.js');
const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };

// ── LES MUTATIONS : chacune réaffaiblit UNE règle ────────────────────────────
const remplace = (s, avant, apres, nom) => { if (!s.includes(avant)) throw new Error('mutation ' + nom + ' : ancre introuvable'); return s.split(avant).join(apres); };
const MUTATIONS = {
  // Un N° déjà donné est oublié : l'annonce relue est renumérotée.
  'oublie-auto': { mod: (s) => remplace(s, "|| cleNum(numeroDeCarte(A, id)));", ");", 'oublie-auto') },
  // Le lien posé par VRM n'est plus une identité : N° neuf sur une paire numérotée.
  'oublie-lien': { mod: (s) => remplace(s, "!!(cleNum(L[id] || '') || cleNum(ref || '')", "!!(cleNum(ref || '')", 'oublie-lien') },
  // L'identité par le TITRE (une annonce au même titre qu'une numérotée en reprend le N°).
  'par-titre': { mod: (s) => remplace(s, "    if (cleNum(numeroDeCarte(out, id))) continue;   // jamais renuméroté", "    if (cleNum(numeroDeCarte(out, id))) continue;\n    { const t = (arguments[0].titres || {})[id]; const deja = t && Object.keys(out).find((k) => (arguments[0].titres || {})[k] === t && out[k]); if (deja) { out[String(id)] = out[deja]; nouveaux.push({ id: String(id), numero: out[deja].numero }); continue; } }", 'par-titre') },
  // Un trou comblé (le premier numéro absent) au lieu du plus haut + 1.
  'comble-trou': { prochain: () => (pris) => { let c = 1; while (pris.has(c)) c++; pris.add(c); return String(c); } },
  // La vente n'hérite plus du N° de son annonce.
  'vente-sans-auto': { regle: (s) => remplace(s, "|| (v && v.productId ? numAutoVc(auto, v.productId) : '') || '');", "|| '');", 'vente-sans-auto') },
  // Une annonce retirée reçoit un N°.
  'retiree-numerotee': { mod: (s) => remplace(s, "    if (etatRetiree(it)) continue;\n", "", 'retiree-numerotee') },
  // La numérotation de Vinted ne compte plus les N° Vestiaire.
  'vinted-aveugle': { app: (s) => remplace(s, "    ajouterNumerosHorsEcran(taken, takenK);   // (2 nov.) les N° donnés aux annonces Vestiaire\n", "", 'vinted-aveugle') },
};
if (args.includes('--mutations')) {
  let tuees = 0;
  for (const nom of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8' });
    const rouge = r.status !== 0;
    if (rouge) tuees++;
    console.log((rouge ? '✅ tuée    ' : '❌ SURVIT  ') + nom + (rouge ? '' : '\n' + String(r.stdout).split('\n').slice(-4).join('\n')));
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(`\n${tuees === n ? '✅' : '❌'} mutations : ${tuees}/${n} tuées`);
  process.exit(tuees === n ? 0 : 1);
}
const M = MUTATION ? MUTATIONS[MUTATION] : null;
if (MUTATION && !M) { console.log('mutation inconnue : ' + MUTATION); process.exit(2); }

// Un module ESM chargé depuis un fichier temporaire (mutation éventuelle).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-num-vc-'));
const charger = async (src, nom, transforme) => {
  let s = fs.readFileSync(src, 'utf8');
  if (transforme) s = transforme(s);
  // Les imports relatifs pointent vers le dépôt.
  s = s.replace(/from '\.\/([^']+)'/g, (_, f) => `from '${pathToFileURL(path.join(path.dirname(src), f)).href}'`);
  const f = path.join(tmp, nom + '.mjs'); fs.writeFileSync(f, s);
  return import(pathToFileURL(f).href);
};

(async () => {
  const APPSRC0 = fs.readFileSync(APP, 'utf8');
  const APPSRC = M && M.app ? M.app(APPSRC0) : APPSRC0;
  const mod = await essaie('module chargé', () => charger(MODULE, 'module', M && M.mod));
  const regle = await essaie('règle Vestiaire chargée', () => charger(path.join(RACINE, 'api', '_lib', 'vestiaire-regle.js'), 'regle', M && M.regle));
  const { cleNum } = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'numerotation.js')).href);
  // Le VRAI `prochainLibre` d'App.jsx.
  const prochainVrai = await essaie('prochainLibre extrait d’App.jsx', () => {
    const x = /const prochainLibre = \(prisInt, prisCles, pref\) => \{[\s\S]*?\n\};/.exec(APPSRC0);
    if (!x) throw new Error('prochainLibre introuvable');
    return vm.runInNewContext(x[0] + '\n;prochainLibre', {});
  });
  if (!mod || !regle || !prochainVrai) { console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }
  const prochainLibre = M && M.prochain ? M.prochain() : prochainVrai;
  const { produitsANumeroter, attribuerNumerosVc, carteNumerosVc } = mod;
  // Une passe de numérotation, comme App.jsx la fait (pris = tout ce qui est servi).
  const passe = ({ items = {}, ventes = {}, liens = {}, auto = {}, pool = [], titres }) => {
    const ids = produitsANumeroter({ items, ventes, liens, auto, cleNum, etatRetiree: (it) => /retir|delet/i.test(String(it.statut || '')), venteAnnulee: regle.vcVenteAnnulee });
    const pris = new Set(), prisK = new Set();
    const add = (v) => { const c = cleNum(v); if (!c) return; prisK.add(c); if (/^\d+$/.test(c)) pris.add(Number(c)); };
    pool.forEach(add); Object.values(liens).forEach(add); Object.values(carteNumerosVc(auto)).forEach(add);
    for (const it of Object.values(items)) if (it && it.ref) add(it.ref);
    const r = attribuerNumerosVc({ ids, auto, pris, prisCles: prisK, pref: '', prochainLibre, cleNum, titres });
    return { ...r, carte: carteNumerosVc(r.auto), pool: pool.concat(r.nouveaux.map((x) => Number(x.numero))) };
  };
  const TITRE = 'Sac cabas en toile monogramme';
  const items50 = {}; for (let i = 0; i < 50; i++) items50[String(70000100 + i)] = { titre: TITRE, statut: 'published', prix: { valeur: 100 } };
  const pool0 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  let p1;
  await essaie('N1', () => {
    p1 = passe({ items: items50, pool: pool0 });
    const nums = Object.values(p1.carte);
    dit(nums.length === 50 && new Set(nums).size === 50, 'N1 · 50 annonces au même titre ⇒ 50 N° distincts', `${new Set(nums).size} distincts sur ${nums.length}`);
    dit(Object.keys(p1.carte).every((id) => items50[id]), 'N1 · chaque N° est lié à SON productId', Object.keys(p1.carte).slice(0, 3).join(','));
  });
  await essaie('N2', () => {
    const nums = Object.values(p1.carte).map(Number).sort((a, z) => a - z);
    dit(nums[0] === 11 && nums[49] === 60, 'N2 · du plus haut + 1 (11 → 60), aucun N° du pool', `${nums[0]} → ${nums[49]}`);
    const trou = passe({ items: { 900: { titre: 'x', statut: 'published' } }, pool: [1, 2, 5] });
    dit(trou.carte['900'] === '6', 'N2 · un trou (3, 4) n’est jamais comblé : « 6 »', trou.carte['900']);
  });
  await essaie('N3', () => {
    const p2 = passe({ items: items50, pool: p1.pool, auto: p1.auto });
    dit(p2.nouveaux.length === 0 && JSON.stringify(p2.carte) === JSON.stringify(p1.carte), 'N3 · relue, chaque annonce garde son N° (aucun neuf)', `${p2.nouveaux.length} neuf(s)`);
    const ids = produitsANumeroter({ items: items50, ventes: {}, liens: {}, auto: p1.auto, cleNum });
    dit(ids.length === 0, 'N3 · relue, aucune annonce n’est même candidate à un N° neuf', `${ids.length} candidate(s)`);
  });
  await essaie('N4', () => {
    const sans = { ...items50 }; delete sans['70000100'];
    const p3 = passe({ items: { ...sans, 80000001: { titre: TITRE, statut: 'published' } }, pool: p1.pool, auto: p1.auto });
    dit(p3.carte['80000001'] === '61', 'N4 · la N° de l’annonce partie n’est pas redonnée : la nouvelle prend 61', p3.carte['80000001']);
    dit(p3.carte['70000100'] === p1.carte['70000100'], 'N4 · l’annonce partie garde son N° dans la carte (jamais libéré)', p3.carte['70000100']);
  });
  await essaie('N5', () => {
    const pid = '70000117', n = p1.carte[pid];
    const ventes = { V1: { productId: pid, aExpedier: true, limite: '', titre: TITRE }, V2: { productId: '70000118', aExpedier: false, etat: 'shipped' } };
    dit(regle.numVcVente(ventes.V1, {}, p1.auto) === n, 'N5 · numVcVente : la vente prend le N° de son annonce', `${regle.numVcVente(ventes.V1, {}, p1.auto)} ≠ ${n}`);
    const lv = regle.ventesVcDe({ ventes, liens: {}, auto: p1.auto }) || [];
    dit((lv.find((x) => x.id === 'V2') || {}).num === p1.carte['70000118'], 'N5 · ventesVcDe : idem (totaux, anti double vente)');
    const c = regle.colisVcAPoster({ ventes, liens: {}, auto: p1.auto }) || [];
    dit(c.length === 1 && c[0].num === n, 'N5 · colisVcAPoster : le colis porte le N° de son annonce', JSON.stringify(c.map((x) => x.num)));
    const r = regle.retraitsVestiaire({ lst: { items: items50, liens: {}, capturedAt: new Date().toISOString(), auto: p1.auto }, ventes });
    dit(r.ventes.some((x) => x.numero === n) && r.annonces.filter((a) => a.numero).length === 50, 'N5 · retraitsVestiaire : annonces et ventes numérotées (anti double vente)', `${r.annonces.filter((a) => a.numero).length} annonces`);
    const f = regle.colisVcAPoster({ ventes, liens: {}, auto: p1.auto, fait: { V1: Date.now() } }) || [];
    dit(f.length === 0, '« Colis fait » sort le colis de « à poster » (la règle de Colis, du widget, des rappels)', String(f.length));
  });
  await essaie('N6', () => {
    const p = passe({ items: { 501: { titre: 'a', statut: 'published' }, 502: { titre: 'b', statut: 'published', ref: '42' }, 503: { titre: 'c', statut: 'published' } }, liens: { 501: '17' }, pool: [17, 42] });
    dit(!p.carte['501'] && !p.carte['502'] && p.carte['503'] === '43', 'N6 · lien posé par VRM et référence VRM-n° : pas de N° neuf (la paire a son carton)', JSON.stringify(p.carte));
    dit(regle.numVcAnnonce('501', {}, { 501: '17' }, { 501: { numero: '99' } }) === '17', 'N6 · le lien l’emporte sur un N° donné');
  });
  await essaie('N7', () => {
    const A = passe({ items: { 601: { titre: 'Rouge' }, 602: { titre: 'Bleu' } }, pool: [] });
    const B = passe({ items: { 601: { titre: 'Bleu' }, 602: { titre: 'Rouge' } }, pool: [] });
    dit(A.carte['601'] === B.carte['601'] && A.carte['602'] === B.carte['602'], 'N7 · titres échangés ⇒ mêmes N° (le titre n’entre nulle part)');
    // Une annonce au même titre qu'une annonce DÉJÀ numérotée prend un N° NEUF.
    const C = passe({ items: { 701: { titre: TITRE }, 702: { titre: TITRE } }, auto: { 701: { numero: '5' } }, pool: [5], titres: { 701: TITRE, 702: TITRE } });
    dit(C.carte['702'] === '6', 'N7 · même titre qu’une annonce numérotée ⇒ N° neuf, jamais repris', C.carte['702']);
  });
  await essaie('N8', () => {
    const p = passe({ items: { 801: { titre: 'r', statut: 'deleted' } }, ventes: { VA: { productId: '802', aExpedier: true }, VB: { productId: '803', aExpedier: false, etat: 'cancelled' } }, pool: [] });
    dit(!p.carte['801'], 'N8 · une annonce retirée ne reçoit pas de N°', JSON.stringify(p.carte));
    dit(p.carte['802'] === '1' && !p.carte['803'], 'N8 · vente à expédier sans annonce lue ⇒ le N° de son produit ; annulée ⇒ rien', JSON.stringify(p.carte));
  });
  await essaie('N9', () => {
    const sans = (s) => s.replace(/\/\/[^\n]*/g, '');
    const A = sans(APPSRC);
    dit(/attribuerNumerosVc\(\{[^}]*prochainLibre/.test(A), 'N9 · App : la règle Vestiaire passe par LE `prochainLibre` de Vinted');
    dit((A.match(/ajouterNumerosHorsEcran\((taken|pris|dejaPris|t), /g) || []).length >= 4, 'N9 · App : les 4 numérotations de Vinted comptent les N° Vestiaire', String((A.match(/ajouterNumerosHorsEcran\((taken|pris|dejaPris|t), /g) || []).length));
    dit(/numerotationPermise\(\)/.test(A.slice(A.indexOf('async function numeroterVestiaire'), A.indexOf('function useNumerotationVestiaire'))), 'N9 · App : rien sans version de la numérotation relue (« pas su » ⇒ rien)');
    dit(/_saveTimers\[k\]/.test(A.slice(A.indexOf('async function numeroterVestiaire'), A.indexOf('function useNumerotationVestiaire'))), 'N9 · App : pas de numérotation pendant une écriture de numéros en route');
    const fus = fs.readFileSync(path.join(RACINE, 'src', 'fusionNuage.js'), 'utf8');
    dit(/CLES_FICHES = \[[^\]]*'vrm_vc_numeros'/.test(fus), 'N9 · la carte des N° Vestiaire se fusionne comme les fiches (conflit ⇒ rien écrit)');
    dit(!/cleNum\(\(v\.productId && [a-z.]*liens\[v\.productId\]\)/.test(A) && !/cleNum\(d\.liens\[id\] \|\| it\.ref/.test(A), 'N9 · App : aucun lecteur ne calcule un N° Vestiaire sans les N° donnés');
  });
  console.log(ko ? `\n❌ N° Vestiaire : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ N° Vestiaire : ${ok} verts`);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  process.exit(ko ? 1 : 0);
})();
