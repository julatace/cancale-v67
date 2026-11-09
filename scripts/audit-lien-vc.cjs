#!/usr/bin/env node
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// ════════════════════════════════════════════════════════════════════════════
//  UN SEUL N° POUR UN ARTICLE SUR VINTED ET VESTIAIRE (3 nov.)
//  node scripts/audit-lien-vc.cjs              (le contrôle)
//  node scripts/audit-lien-vc.cjs --mutations  (chaque règle réaffaiblie doit
//                                               faire passer l'audit au rouge)
//
//  On EXÉCUTE la vraie règle (src/lienVestiaire.js), les vraies identités
//  Vestiaire (api/_lib/vestiaire-regle.js), la vraie numérotation Vestiaire
//  (src/numerosVestiaire.js) et le VRAI `prochainLibre` extrait d'App.jsx.
//  Exigé (§5 « L'identité d'une paire », « Les numéros de rangement ») :
//   L1  50 articles identiques des deux côtés : des SUGGESTIONS, mais aucune
//       liaison sans son clic — aucun N° Vestiaire ne devient un N° Vinted, et
//       dans App.jsx la liaison ne s'écrit QUE dans le geste confirmé ;
//   L2  relier : l'annonce Vestiaire porte le N° Vinted (celui du carton) ; son
//       ancien N° part dans « à barrer » jusqu'à « C'est écrit » ;
//   L3  un N° n'est JAMAIS redonné : l'ancien reste servi, aucune annonce
//       reliée ne reçoit un N° neuf, la suivante prend le plus haut + 1 ;
//   L4  défaire rend EXACTEMENT l'état d'avant ;
//   L5  refus : un article Vinted relié deux fois, un produit relié deux fois,
//       un article Vinted sans N°, des identifiants illisibles ;
//   L6  seul un N° donné par VRM se relie (lien de publication / référence
//       VRM-n° : déjà une identité) ;
//   L7  double vente : une vente d'un côté rend l'article vendu de l'autre (les
//       règles de Vestiaire partout, branchées sur la liaison) ;
//   L8  suggestions : marque obligatoire, taille des deux côtés ou d'aucun,
//       couleur commune exigée sans taille (jamais la marque seule) ;
//   L9  tous les lecteurs (app, widget, rappels, e-mail entrant) passent par la
//       liaison ; la clé est synchronisée.
//  ⚠️ Un audit ne meurt pas, il rapporte : chaque bloc passe par `essaie`.
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const APP = path.join(RACINE, 'src', 'App.jsx');
const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };

const remplace = (s, avant, apres, nom) => { if (!s.includes(avant)) throw new Error('mutation ' + nom + ' : ancre introuvable'); return s.split(avant).join(apres); };
const MUTATIONS = {
  // L'ancien N° Vestiaire disparaît en silence (rien à barrer).
  'oublie-ancien': { lien: (s) => remplace(s, "const de = cleNum(numeroVc || '') && cleNum(numeroVc) !== n ? String(numeroVc) : '';", "const de = '';", 'oublie-ancien') },
  // Défaire ne retire rien.
  'defaire-garde': { lien: (s) => remplace(s, "  delete out[String(productId)];\n", '', 'defaire-garde') },
  // Un article Vinted relié à deux annonces Vestiaire.
  'vinted-deux-fois': { lien: (s) => remplace(s, "  if (autre && autre !== id) return { refus: 'vinted-deja-relie' };\n", '', 'vinted-deux-fois') },
  // La référence VRM-n° n'empêche plus de relier.
  'ref-ignoree': { lien: (s) => remplace(s, "  if (it && cleNum(it.ref || '')) return false;\n", '', 'ref-ignoree') },
  // Taille connue d'un seul côté acceptée.
  'taille-optionnelle': { lien: (s) => remplace(s, "    if (!!k.taille !== !!c.taille) continue;\n", '', 'taille-optionnelle') },
  // Sans taille : la marque seule suffit.
  'marque-seule': { lien: (s) => remplace(s, "    if (!c.taille && !communes) continue;          // sans taille : jamais la marque seule\n", '', 'marque-seule') },
  // La liaison n'est lue par personne (identité perdue).
  'lien-ignore': { regle: (s) => remplace(s, "    if (n) out[String(id)] = { numero: String(e.numero), lie: true };", "", 'lien-ignore') },
  // La numérotation Vestiaire ne voit plus la liaison : N° neuf pour un article relié.
  'numerotation-aveugle': { app: (s) => remplace(s, "liens: { ...liensMainVc, ...(L.liens || {}) }, auto, cleNum,", "liens: L.liens || {}, auto, cleNum,", 'numerotation-aveugle') },
  // Une liaison posée sans son clic (au montage de l'hôte).
  'clic-auto': { app: (s) => remplace(s, "function HoteLienVc({ comptes }) {\n  const [cible, setCible] = React.useState(null);", "function HoteLienVc({ comptes }) {\n  const [cible, setCible] = React.useState(null);\n  React.useEffect(() => { relierVc({ productId: '1', item: '2', numVinted: '3' }); }, []);", 'clic-auto') },
  // Relier sans confirmation.
  'sans-confirmation': { app: (s) => remplace(s, "  if (!ok) return false;\n  vcPoser('vrm_vc_liens', poserLienVc(", "  vcPoser('vrm_vc_liens', poserLienVc(", 'sans-confirmation') },
  // Le widget ignore la liaison.
  'widget-aveugle': { widget: (s) => remplace(s, "auto: numerosVcAvecLiens((m && m.vrm_vc_numeros) || {}, m && m.vrm_vc_liens),", "auto: (m && m.vrm_vc_numeros) || {},", 'widget-aveugle') },
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-lien-vc-'));
const charger = async (src, nom, transforme) => {
  let s = fs.readFileSync(src, 'utf8');
  if (transforme) s = transforme(s);
  s = s.replace(/from '\.\/([^']+)'/g, (_, f) => `from '${pathToFileURL(path.join(path.dirname(src), f)).href}'`);
  const f = path.join(tmp, nom + '.mjs'); fs.writeFileSync(f, s);
  return import(pathToFileURL(f).href);
};
// Les commentaires retirés (on juge le code, pas sa prose).
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
// Le corps d'une fonction `function nom(` d'App.jsx (jusqu'à l'accolade fermante en colonne 0).
const corps = (src, nom) => { const i = src.indexOf(`function ${nom}(`); if (i < 0) return ''; const j = src.indexOf('\n}\n', i); return src.slice(i, j < 0 ? undefined : j + 2); };

(async () => {
  const APPSRC = (M && M.app ? M.app : (x) => x)(fs.readFileSync(APP, 'utf8'));
  const lien = await essaie('src/lienVestiaire.js chargé', () => charger(path.join(RACINE, 'src', 'lienVestiaire.js'), 'lien', M && M.lien));
  const regle = await essaie('api/_lib/vestiaire-regle.js chargé', () => charger(path.join(RACINE, 'api', '_lib', 'vestiaire-regle.js'), 'regle', M && M.regle));
  const numMod = await essaie('src/numerosVestiaire.js chargé', () => charger(path.join(RACINE, 'src', 'numerosVestiaire.js'), 'num'));
  const { cleNum } = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'numerotation.js')).href);
  const prochainLibre = await essaie('prochainLibre extrait d’App.jsx', () => {
    const x = /const prochainLibre = \(prisInt, prisCles, pref\) => \{[\s\S]*?\n\};/.exec(APPSRC);
    if (!x) throw new Error('prochainLibre introuvable');
    return vm.runInNewContext(x[0] + '\n;prochainLibre', {});
  });
  if (!lien || !regle || !numMod || !prochainLibre) { console.log(`\n❌ ${ko} rouge(s), ${ok} vert(s)`); process.exit(1); }
  const { poserLienVc, defaireLienVc, numerosABarrer, marquerBarre, lienDe, produitDeVinted, vcReliable, suggestionsLienVc } = lien;
  const { numerosVcAvecLiens, numVcAnnonce, numVcVente, annoncesVcEnLigne, retraitsVestiaire } = regle;
  const { produitsANumeroter, attribuerNumerosVc, carteNumerosVc } = numMod;
  // La passe de numérotation telle qu'App.jsx la fait (`numeroterVestiaire`) :
  // la liaison (`vrm_vc_liens`) comptée comme un lien, si App.jsx la branche.
  const brancheNumerotation = /liens: \{ \.\.\.liensMainVc, \.\.\.\(L\.liens \|\| \{\}\) \}/.test(APPSRC) && /const liensMainVc = carteNumerosVc\(numerosVcAvecLiens\(\{\}, vcCarte\('vrm_vc_liens'\)\)\)/.test(APPSRC);
  const passe = ({ items = {}, liensMain = {}, auto = {}, pool = [] }) => {
    const liens = brancheNumerotation ? carteNumerosVc(numerosVcAvecLiens({}, liensMain)) : {};
    const ids = produitsANumeroter({ items, ventes: {}, liens, auto, cleNum, etatRetiree: () => false });
    const pris = new Set(), prisK = new Set();
    const add = (v) => { const c = cleNum(v); if (!c) return; prisK.add(c); if (/^\d+$/.test(c)) pris.add(Number(c)); };
    pool.forEach(add); Object.values(liens).forEach(add); Object.values(carteNumerosVc(auto)).forEach(add);
    const r = attribuerNumerosVc({ ids, auto, pris, prisCles: prisK, pref: '', prochainLibre, cleNum });
    return { ...r, pool: pool.concat(r.nouveaux.map((x) => Number(x.numero))) };
  };
  // Les règles de l'app passées en paramètre (une seule définition) : on prend
  // les VRAIES `extractBrand` / `extractColors` d'App.jsx si elles s'extraient, sinon des bouchons sûrs.
  const MARQUES = ['nike', 'adidas', 'louis vuitton', 'gucci'], COULEURS = ['noir', 'blanc', 'beige', 'rouge'];
  const marqueDe = (t) => { const b = String(t || '').toLowerCase(); return MARQUES.find((m) => b.includes(m)) || null; };
  const couleursDe = (t) => { const b = String(t || '').toLowerCase(); return COULEURS.filter((c) => b.includes(c)); };

  const T = '2026-11-03T10:00:00.000Z';
  // ── L1 — 50 articles identiques ─────────────────────────────────────────────
  await essaie('L1', () => {
    const items = {}, auto = {}, vinted = [];
    for (let i = 0; i < 50; i++) { items[String(800 + i)] = { titre: 'Nike Air Max 90 noir taille 42', statut: 'published' }; auto[String(800 + i)] = { numero: String(100 + i), auto: true }; vinted.push({ id: String(5000000 + i), num: String(i + 1), titre: 'Nike Air Max 90 noir taille 42', marque: 'Nike', taille: '42' }); }
    const s = suggestionsLienVc({ cible: { titre: items['800'].titre }, candidats: vinted, marqueDe, couleursDe });
    dit(s.length > 0 && s.length <= 3, 'L1 · 50 identiques : des suggestions (la ressemblance PROPOSE)', `${s.length}`);
    const eff = numerosVcAvecLiens(auto, {});
    const portentVinted = Object.keys(items).filter((id) => Number(numVcAnnonce(id, items[id], {}, eff)) <= 50).length;
    dit(portentVinted === 0, 'L1 · …mais AUCUNE annonce Vestiaire ne prend un N° Vinted sans son clic', `${portentVinted}`);
    const p = passe({ items, auto, pool: Array.from({ length: 149 }, (_, i) => i + 1) });
    dit(p.nouveaux.length === 0, 'L1 · aucune numérotation ne bouge', `${p.nouveaux.length}`);
    // Dans l'app : la liaison ne s'écrit que dans les gestes (relier confirmé, défaire confirmé, « C'est écrit »).
    const src = sansCommentaires(APPSRC);
    // (6 nov., v36) « C'est écrit » est un geste annulable (src/gesteAnnulable.js) : il écrit `vrm_vc_liens` par
    // `gesteVrm(…, [{ k: 'vrm_vc_liens', … }])` — compté comme une écriture, et seulement dans le bloc « à barrer ».
    const ecritures = (src.match(/vcPoser\('vrm_vc_liens'|\{ k: 'vrm_vc_liens'/g) || []).length;
    const relier = corps(src, 'relierVc'), defaire = corps(src, 'defaireVc'), barrer = corps(src, 'BlocBarrerVc');
    const dansGestes = (relier.match(/vcPoser\('vrm_vc_liens'/g) || []).length + (defaire.match(/vcPoser\('vrm_vc_liens'/g) || []).length + (barrer.match(/onClick=\{\(\) => vcPoser\('vrm_vc_liens'|onClick=\{\(\) => \{[^\n]*gesteVrm\([^\n]*\{ k: 'vrm_vc_liens'/g) || []).length;
    dit(ecritures === 3 && dansGestes === 3, 'L1 · App.jsx écrit `vrm_vc_liens` seulement dans relier / défaire / « C’est écrit »', `${ecritures} écritures, ${dansGestes} dans les gestes`);
    dit(/const ok = await askConfirm\(/.test(relier) && relier.indexOf('if (!ok) return false;') > 0 && relier.indexOf('if (!ok) return false;') < relier.indexOf("vcPoser('vrm_vc_liens'"), 'L1 · relier DEMANDE (confirmation) avant d’écrire');
    const appels = (src.match(/(?<!function )relierVc\(\{/g) || []).length;
    const ouvert = corps(src, 'LienVcOuvert');
    dit(appels === 2 && (ouvert.match(/relierVc\(\{/g) || []).length === 2 && /const onRelier = async \(c\) =>/.test(ouvert), 'L1 · relier n’est appelé que par le toucher « Relier » de la feuille', `${appels} appel(s)`);
    dit((src.match(/poserLienVc\(/g) || []).length === 2 && (relier.match(/poserLienVc\(/g) || []).length === 2, 'L1 · `poserLienVc` n’est appelée que dans le geste');
  });

  // ── L2 — relier ─────────────────────────────────────────────────────────────
  const AUTO = { P1: { numero: '61', auto: true }, P2: { numero: '62', auto: true } };
  const ITEMS = { P1: { titre: 'Sac Gucci beige', statut: 'published' }, P2: { titre: 'Sac Gucci beige', statut: 'published' } };
  let L1 = {};
  await essaie('L2', () => {
    const r = poserLienVc({ liens: {}, productId: 'P1', item: '7001', numeroVinted: '12', numeroVc: '61', cleNum, maintenant: T });
    L1 = r.liens || {};
    dit(!r.refus && lienDe(L1, 'P1') && L1.P1.numero === '12' && L1.P1.item === '7001', 'L2 · la liaison est posée par identité (productId ↔ annonce Vinted)', JSON.stringify(L1));
    const eff = numerosVcAvecLiens(AUTO, L1);
    dit(numVcAnnonce('P1', ITEMS.P1, {}, eff) === '12', 'L2 · l’annonce Vestiaire porte le N° Vinted (celui du carton)', numVcAnnonce('P1', ITEMS.P1, {}, eff));
    dit(numVcAnnonce('P2', ITEMS.P2, {}, eff) === '62', 'L2 · l’autre annonce au même titre garde SON N°', numVcAnnonce('P2', ITEMS.P2, {}, eff));
    const b = numerosABarrer(L1);
    dit(b.length === 1 && b[0].de === '61' && b[0].vers === '12', 'L2 · « N°61 → N°12 » à barrer sur le carton', JSON.stringify(b));
    const e = marquerBarre(L1, 'P1', T);
    dit(numerosABarrer(e).length === 0 && e.P1.numero === '12', 'L2 · « C’est écrit » le sort de la liste, la liaison reste', JSON.stringify(e.P1));
    const sans = poserLienVc({ liens: {}, productId: 'P3', item: '7003', numeroVinted: '15', numeroVc: '', cleNum, maintenant: T });
    dit(sans.liens && numerosABarrer(sans.liens).length === 0, 'L2 · rien à barrer quand l’annonce Vestiaire n’avait pas encore de N°');
    const meme = poserLienVc({ liens: {}, productId: 'P4', item: '7004', numeroVinted: '007', numeroVc: '7', cleNum, maintenant: T });
    dit(meme.liens && meme.liens.P4.de === '', 'L2 · même N° (« 007 » = « 7 ») : rien à barrer');
  });

  // ── L3 — jamais redonné ─────────────────────────────────────────────────────
  await essaie('L3', () => {
    const pool = Array.from({ length: 62 }, (_, i) => i + 1);
    const items = { ...ITEMS, P5: { titre: 'Nouvelle annonce', statut: 'published' } };
    const p = passe({ items, liensMain: L1, auto: AUTO, pool });
    dit(p.nouveaux.length === 1 && p.nouveaux[0].id === 'P5' && p.nouveaux[0].numero === '63', 'L3 · seule la nouvelle annonce reçoit un N° : le plus haut + 1 (63), jamais 61', JSON.stringify(p.nouveaux));
    dit(p.auto.P1 && p.auto.P1.numero === '61', 'L3 · l’ancien N°61 reste servi (vrm_vc_numeros), jamais effacé', JSON.stringify(p.auto.P1));
    // Reliée AVANT d'avoir été numérotée : jamais un N° neuf.
    const L = poserLienVc({ liens: {}, productId: 'Q1', item: '7010', numeroVinted: '20', numeroVc: '', cleNum, maintenant: T }).liens;
    const q = passe({ items: { Q1: { titre: 'x', statut: 'published' } }, liensMain: L, auto: {}, pool: [1, 2, 20] });
    dit(q.nouveaux.length === 0, 'L3 · une annonce reliée avant sa numérotation ne reçoit pas de N° neuf (elle porte le N° Vinted)', JSON.stringify(q.nouveaux));
  });

  // ── L4 — défaire ────────────────────────────────────────────────────────────
  await essaie('L4', () => {
    const avant = { P9: { numero: '30', item: '9', de: '', at: T, ecrit: null } };
    const posee = poserLienVc({ liens: avant, productId: 'P1', item: '7001', numeroVinted: '12', numeroVc: '61', cleNum, maintenant: T }).liens;
    const apres = defaireLienVc(posee, 'P1');
    dit(JSON.stringify(apres) === JSON.stringify(avant), 'L4 · défaire rend EXACTEMENT la carte d’avant', JSON.stringify(apres));
    const eff = numerosVcAvecLiens(AUTO, apres);
    dit(numVcAnnonce('P1', ITEMS.P1, {}, eff) === '61' && numerosABarrer(apres).length === 0 && !produitDeVinted(apres, '7001'), 'L4 · l’annonce Vestiaire reprend son N°61, plus rien à barrer, l’article Vinted est libre');
  });

  // ── L5 — refus ──────────────────────────────────────────────────────────────
  await essaie('L5', () => {
    const r1 = poserLienVc({ liens: L1, productId: 'P2', item: '7001', numeroVinted: '12', numeroVc: '62', cleNum });
    dit(r1.refus === 'vinted-deja-relie', 'L5 · un article Vinted ne se relie qu’à UNE annonce Vestiaire', JSON.stringify(r1.refus || Object.keys(r1.liens || {})));
    const r2 = poserLienVc({ liens: L1, productId: 'P1', item: '7002', numeroVinted: '13', numeroVc: '61', cleNum });
    dit(r2.refus === 'deja-relie', 'L5 · une annonce Vestiaire déjà reliée ne se relie pas une 2ᵉ fois', String(r2.refus));
    const r3 = poserLienVc({ liens: {}, productId: 'P2', item: '7002', numeroVinted: '', numeroVc: '62', cleNum });
    dit(r3.refus === 'sans-numero', 'L5 · un article Vinted sans N° : rien', String(r3.refus));
    const r4 = poserLienVc({ liens: {}, productId: 'a b', item: 'x', numeroVinted: '3', cleNum });
    dit(r4.refus === 'identite', 'L5 · identifiants illisibles : rien', String(r4.refus));
  });

  // ── L6 — seul un N° donné par VRM se relie ─────────────────────────────────
  await essaie('L6', () => {
    dit(vcReliable({ productId: 'P1', item: ITEMS.P1, liensPub: {}, liens: {}, cleNum }), 'L6 · annonce au N° donné par VRM : reliable');
    dit(!vcReliable({ productId: 'P1', item: { ...ITEMS.P1, ref: 'VRM-12' }, liensPub: {}, liens: {}, cleNum }), 'L6 · référence VRM-n° lue : déjà une identité, pas de liaison');
    dit(!vcReliable({ productId: 'P1', item: ITEMS.P1, liensPub: { P1: '12' }, liens: {}, cleNum }), 'L6 · publiée depuis VRM (lien) : déjà une identité');
    dit(!vcReliable({ productId: 'P1', item: ITEMS.P1, liensPub: {}, liens: L1, cleNum }), 'L6 · déjà reliée : pas une 2ᵉ fois');
  });

  // ── L7 — double vente ───────────────────────────────────────────────────────
  await essaie('L7', () => {
    const now = Date.parse(T);
    const lst = { items: ITEMS, liens: {}, capturedAt: T, auto: numerosVcAvecLiens(AUTO, L1) };
    const enLigne = annoncesVcEnLigne(lst, {}, now);
    dit(enLigne.parNum.has('12') && enLigne.parNum.get('12')[0].id === 'P1' && !enLigne.parNum.has('61'), 'L7 · une vente Vinted du N°12 voit l’annonce Vestiaire P1 « encore en ligne » (à retirer)', JSON.stringify([...enLigne.parNum.keys()]));
    const v = { productId: 'P1', etat: 'shipped', aExpedier: false };
    dit(numVcVente(v, {}, numerosVcAvecLiens(AUTO, L1)) === '12', 'L7 · une vente Vestiaire de P1 désigne le N°12 (l’article Vinted)');
    const r = retraitsVestiaire({ lst, ventes: { V1: v }, maintenant: now });
    dit(r.ventes.some((x) => x.numero === '12'), 'L7 · « Vendus ailleurs » : la vente Vestiaire compte pour le N°12', JSON.stringify(r.ventes));
  });

  // ── L8 — suggestions ────────────────────────────────────────────────────────
  await essaie('L8', () => {
    const c = (o) => ({ id: o.id, titre: o.titre, marque: o.marque, taille: o.taille, couleur: o.couleur });
    const cands = [
      c({ id: 'a', titre: 'Nike Air Max noir 42' }), c({ id: 'b', titre: 'Adidas Samba noir 42' }), c({ id: 'c', titre: 'Nike Air Max noir 43' }),
      c({ id: 'd', titre: 'Nike Air Max noir' }), c({ id: 'e', titre: 'Nike Air Max 42' }),
    ];
    const s = suggestionsLienVc({ cible: { titre: 'Nike Air Max noir taille 42' }, candidats: cands, marqueDe, couleursDe });
    const ids = s.map((x) => x.id);
    dit(ids[0] === 'a' && ids.includes('e') && !ids.includes('b') && !ids.includes('c'), 'L8 · marque + taille ; couleur commune d’abord ; autre marque / autre taille écartées', ids.join(','));
    dit(!ids.includes('d'), 'L8 · taille connue d’un seul côté : écartée', ids.join(','));
    const sacs = [c({ id: 's1', titre: 'Sac Gucci beige' }), c({ id: 's2', titre: 'Sac Gucci noir' }), c({ id: 's3', titre: 'Sac Gucci' }), c({ id: 's4', titre: 'Gucci Ace beige taille 42' })];
    const t = suggestionsLienVc({ cible: { titre: 'Cabas Gucci beige' }, candidats: sacs, marqueDe, couleursDe }).map((x) => x.id);
    dit(t.join(',') === 's1', 'L8 · un sac (sans taille) : marque + couleur commune seulement ; une chaussure taille 42 de la même marque et couleur écartée', t.join(','));
    const u = suggestionsLienVc({ cible: { titre: 'Sac Gucci' }, candidats: sacs, marqueDe, couleursDe }).map((x) => x.id);
    dit(u.length === 0, 'L8 · sans taille ni couleur : jamais la marque seule', u.join(','));
    dit(suggestionsLienVc({ cible: { titre: 'Sac sans marque' }, candidats: sacs, marqueDe, couleursDe }).length === 0, 'L8 · marque inconnue : rien');
    const h = [{ id: 'h1', titre: 'Evelyne beige', marque: 'Hermès' }, { id: 'h2', titre: 'Evelyne beige', marque: 'Celine' }];
    const hs = suggestionsLienVc({ cible: { titre: 'Sac Hermes Evelyne beige' }, candidats: h, marqueDe, couleursDe }).map((x) => x.id);
    dit(hs.join(',') === 'h1', 'L8 · marque lue d’UN côté (champ Vinted) et écrite en toutes lettres dans le titre de l’autre', hs.join(','));
    dit(suggestionsLienVc({ cible: { titre: 'Sac Evelyne beige' }, candidats: h, marqueDe, couleursDe }).length === 0, 'L8 · …absente du titre : rien');
  });

  // ── L9 — tous les lecteurs ──────────────────────────────────────────────────
  await essaie('L9', () => {
    const src = sansCommentaires(APPSRC);
    dit(/'vrm_vc_liens',/.test(src.slice(src.indexOf('const SYNC_KEYS'), src.indexOf('const SYNC_KEYS') + 4000)), 'L9 · `vrm_vc_liens` est synchronisée (SYNC_KEYS)');
    dit(/const numerosVcEffectifs = \(\) => carteNumerosVc\(numerosVcAvecLiens\(vcCarte\('vrm_vc_numeros'\), vcCarte\('vrm_vc_liens'\)\)\)/.test(src), 'L9 · l’app : une seule carte effective (`numerosVcEffectifs`)');
    dit(/return \{ auto: numerosVcEffectifs\(\)/.test(src) && /avecNumerosVc = \(d\) => \(d && typeof d === 'object'\) \? \{ \.\.\.d, auto: numerosVcEffectifs\(\)/.test(src), 'L9 · les écrans (useVcLocal, avecNumerosVc) lisent la carte effective');
    dit(brancheNumerotation, 'L9 · la numérotation Vestiaire compte la liaison (jamais un N° neuf pour un article relié)');
    const W = (M && M.widget ? M.widget : (x) => x)(fs.readFileSync(path.join(RACINE, 'api', 'widget.js'), 'utf8'));
    const S = fs.readFileSync(path.join(RACINE, 'api', 'ship-reminders.js'), 'utf8');
    const E = fs.readFileSync(path.join(RACINE, 'api', 'email-inbound.js'), 'utf8');
    dit(/auto: numerosVcAvecLiens\(\(m && m\.vrm_vc_numeros\) \|\| \{\}, m && m\.vrm_vc_liens\)/.test(W) && /'vrm_vc_liens'/.test(W), 'L9 · widget : la liaison lue');
    dit((S.match(/numerosVcAvecLiens\(/g) || []).length === 3 && (S.match(/'vrm_vc_liens'/g) || []).length === 2, 'L9 · rappels (bilan, colis) : la liaison lue');
    dit((E.match(/numerosVcAvecLiens\(/g) || []).length === 2 && /vcLiensMain:data->vrm_vc_liens/.test(E) && /liensMain:data->vrm_vc_liens/.test(E), 'L9 · e-mail entrant (N° d’une vente, encore en ligne) : la liaison lue');
  });

  console.log(ko ? `\n❌ lien Vinted ↔ Vestiaire : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ lien Vinted ↔ Vestiaire : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
