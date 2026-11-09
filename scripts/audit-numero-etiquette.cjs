// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « OÙ EST TON NUMÉRO ? » ET « REMISE EN LIGNE » (9 nov., extension 5.334)
//  Julien : « la personne met son numéro d'étiquetage à la fin de sa
//  description : capte ce numéro et n'attribue pas de numéro automatiquement ;
//  ça peut être dans le titre aussi, ou dans le numéro d'étiquetage » ; « quand
//  je supprime un article et que je le remets en ligne, suggère le numéro de
//  l'ancien colis ».
//  1. La lecture (src/numeroEcrit.js), EXÉCUTÉE sur 50 descriptions piégées
//     (pointures, prix, années, « 2 paires », mesures, références de modèle,
//     deux N°, « 007 », « B125 », émojis, retours ligne, la lettre de Republier).
//  2. Le réglage `ou` (plusieurs cochables, jamais zéro) : une source décochée
//     n'est plus lue — ni pour poser, ni pour se dire « ambigu ».
//  3. L'extension : le bloc <numero-ecrit-lecture> de background.js est la
//     COPIE exacte de celui de l'app ; le VRAI background.js (vm) range la
//     lecture de la description du dressing (`numEcrit`, jamais le texte) et
//     de la description Leboncoin ENTIÈRE ; allumé, aucun N° réservé.
//  4. La remise en ligne (src/remiseEnLigne.js) : une proposition, jamais une
//     écriture ; photo identique ⇒ « forte », marque + taille + modèle ⇒
//     « simple », marque différente ⇒ rien ; 50 paires identiques supprimées ⇒
//     aucune proposition « forte » par ressemblance, et une proposition simple
//     ne désigne jamais une seule paire au hasard ; le N° écrit = l'ancien ⇒
//     repris sans question (identité qu'il a écrite) ; un N° porté par une
//     paire présente ou d'archive n'est jamais proposé.
//  5. L'app (commentaires retirés) : le réglage passe `ou` à chaque lecture ;
//     le dressing porte `numEcritDesc` ; « Oui, N°X » passe par `poserNumero`.
//  `--recopie` : réécrit le bloc de l'extension depuis l'app (puis zips).
//  `--src <arbre>` : juge une autre copie (preuve sur le code d'avant, §6.1).
//  `--mutation=<nom>|toutes` : réaffaiblit une règle ⇒ doit être ROUGE.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_source-app.cjs').brancher();
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const BLOC_RE = /\/\/ <numero-ecrit-lecture>[^\n]*\n([\s\S]*?)\/\/ <\/numero-ecrit-lecture>/;
const sansExport = (t) => t.replace(/^export /gm, '');

if (process.argv.includes('--recopie')) {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'numeroEcrit.js'), 'utf8');
  const m = BLOC_RE.exec(app); if (!m) { console.log('❌ bloc <numero-ecrit-lecture> introuvable dans src/numeroEcrit.js'); process.exit(1); }
  const f = path.join(RACINE, 'vinted-sync-extension', 'background.js');
  const bg = fs.readFileSync(f, 'utf8');
  if (!BLOC_RE.test(bg)) { console.log('❌ marques <numero-ecrit-lecture> introuvables dans background.js'); process.exit(1); }
  const bloc = '// <numero-ecrit-lecture> — COPIE de src/numeroEcrit.js (scripts/audit-numero-etiquette.cjs --recopie). Ne pas modifier ici.\n' + sansExport(m[1]) + '// </numero-ecrit-lecture>';
  fs.writeFileSync(f, bg.replace(BLOC_RE, () => bloc));
  console.log('✅ bloc recopié dans background.js');
  process.exit(0);
}

const MUTATIONS = {
  ou: ['src/numeroEcrit.js', "const veut = (k) => !Array.isArray(ou) || ou.includes(k);", 'const veut = (k) => true;'],
  jamaisZero: ['src/numeroEcrit.js', 'return ou.length ? { ...r, ou } : r;', 'return { ...r, ou };'],
  recue: ['src/numeroEcrit.js', "if (l.etat === 'lu' && typeof l.cle === 'string' && NUM_OK.test(l.cle) && l.cle !== '0')", "if (l.etat === 'lu')"],
  copie: ['vinted-sync-extension/background.js', "if (SUITE_INTERDITE.test(suite)) continue;", ''],
  dressing: ['vinted-sync-extension/background.js', "{ const ne = lectureNumeroDescription(it.description); if (ne) o.numEcrit = ne; }", ''],
  lbc: ['vinted-sync-extension/background.js', "...(bodyTxt.trim() ? { numEcrit: lectureNumeroDescription(bodyTxt) } : {}),", ''],
  marque: ['src/remiseEnLigne.js', "if (!ma || !mb || ma !== mb) return null;", 'if (false) return null;'],
  present: ['src/remiseEnLigne.js', 'if (portesPresents.has(cle)) continue;', ''],
  archive: ['src/remiseEnLigne.js', 'if (!reprenable(cle)) continue;', ''],
  compte: ['src/remiseEnLigne.js', 'if (String(s.compte) !== String(n.compte)) continue;', ''],
  avant: ['src/remiseEnLigne.js', 'if (Number.isFinite(cree) && Number.isFinite(at) && cree < at - MARGE_MS) continue;', ''],
  appOu: ['src/App.jsx', 'const lireNumeroEcrit = (o) => lireNumeroEcritRegle({ ou: ouNumeroEcrit(), ...o });', 'const lireNumeroEcrit = (o) => lireNumeroEcritRegle(o);'],
};

if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  let attrapees = 0;
  for (const nom of noms) {
    const m = MUTATIONS[nom]; if (!m) { console.log(`❌ mutation inconnue : ${nom}`); process.exitCode = 1; continue; }
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-net-'));
    for (const f of ['src/numeroEcrit.js', 'src/remiseEnLigne.js', 'src/App.jsx', 'vinted-sync-extension/background.js']) { fs.mkdirSync(path.dirname(path.join(t, f)), { recursive: true }); try { fs.copyFileSync(path.join(RACINE, f), path.join(t, f)); } catch (_) {} }
    try { fs.cpSync(path.join(RACINE, 'src', 'ecrans'), path.join(t, 'src', 'ecrans'), { recursive: true }); } catch (_) {}
    const p = path.join(t, m[0]); const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(m[1])) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${m[0]}`); process.exitCode = 1; fs.rmSync(t, { recursive: true, force: true }); continue; }
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
const lire = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
const imp = async (f) => { try { return await import('file://' + path.join(RACINE, f) + '?t=' + Date.now()); } catch (e) { dit(false, `${f} se charge`, String(e && e.message).slice(0, 140)); return null; } };

// 50 descriptions piégées : [texte, attendu] — attendu = clé lue, 'rien' ou 'ambigu'.
const PIEGES = [
  ['Nike Air Max 90, pointure 42, très bon état.', 'rien'],
  ['Taille 42 EU / 8 US', 'rien'],
  ['Prix 45 € ferme', 'rien'],
  ['Vendu 45€ port compris', 'rien'],
  ['Achetées en 2024, portées 2 fois', 'rien'],
  ['2 paires disponibles', 'rien'],
  ['Semelle 27 cm', 'rien'],
  ['Réf. CW2288-111', 'rien'],
  ['Réf DD1391-100 — coloris Panda', 'rien'],
  ['Réf B75806', 'rien'],
  ['Réf 315122', 'rien'],
  ['Envoi sous 24h\n#45 €', 'rien'],
  ['Envoi rapide\nN° 3 cm', 'rien'],
  ['Dunk low 12/2024', 'rien'],
  ['No stress, envoi 42 h', 'rien'],
  ['Air Force 1 (42)', 'rien'],
  ['N° 0', 'rien'],
  ['Très bon état 👟🔥', 'rien'],
  ['', 'rien'],
  ['N° 12 au milieu\nEnvoi rapide, merci !', 'rien'],
  ['Très bon état.\nN° 123', '123'],
  ['Très bon état.\nN°123', '123'],
  ['Très bon état.\nNº 123', '123'],
  ['Très bon état.\nNo 123', '123'],
  ['Très bon état.\nNo. 123', '123'],
  ['Très bon état.\nRéf 123', '123'],
  ['Très bon état.\nRef. 123', '123'],
  ['Très bon état.\nRéf : 77', '77'],
  ['Très bon état.\n#123', '123'],
  ['Très bon état.\nN° B125', 'B125'],
  ['Très bon état.\nn° b125', 'B125'],
  ['Très bon état.\nN° 007', '7'],
  ['Très bon état.\nRéf. VRM-123', '123'],
  ['Pointure 42, 45 €, 2024.\nN° 57', '57'],
  ['Taille 44 — envoi 24h 📦\n\nN° 58 ✨', '58'],
  ['Très bon état\r\nN° 59\r\n', '59'],
  ['Très bon état.\nN° 60\n\nk', '60'],
  ['Très bon état.\n   N°   61   ', '61'],
  ['Bon état. N° 62', '62'],
  ['Portées 3 fois, taille 43.\n#C40', 'C40'],
  ['N° 12\nbla\nN° 13', 'ambigu'],
  ['Très bon état N° 12\nN° 40', 'ambigu'],
  ['#12 et #13', 'ambigu'],
  ['Réf 12\nN° 14', 'ambigu'],
  ['N° 12 et encore N° 12', '12'],
  ['N° B125\nN° 125', 'ambigu'],
  ['Taille 42\nN° 42', '42'],
  ['Pointure 41,5\n#64', '64'],
  ['Prix : 120€\nN°65 merci', '65'],
  ['Modèle 2023 — Réf. DV0833-100\nN° 66', '66'],
];

(async () => {
  const N = await imp('src/numeroEcrit.js');
  const APP = sansCommentaires(lire('src/App.jsx'));
  if (N) {
    const { lireNumeroTexte: T, lireNumeroEcrit: E, lireReglageNumeroEcrit: R, basculerOu, compacterLecture, lectureRecue, decisionEcrite } = N;
    console.log('— 1. La lecture : 50 descriptions piégées');
    dit(PIEGES.length === 50, '50 descriptions piégées');
    const rates = PIEGES.filter(([t, att]) => { const r = T(t, 'description'); return att === 'rien' ? r.etat !== 'rien' : att === 'ambigu' ? r.etat !== 'ambigu' : !(r.etat === 'lu' && r.cle === att); });
    dit(!rates.length, 'chacune donne exactement ce qui est écrit (N° lu, rien, ou ambigu)', rates.map(([t, a]) => `${JSON.stringify(t)} attendu ${a} → ${JSON.stringify(T(t, 'description'))}`).join(' | '));
    const nus = PIEGES.filter(([, a]) => a === 'rien').length;
    dit(nus >= 20, `${nus} textes sans N° marqué (pointure, prix, année, mesure, modèle) ne donnent JAMAIS un numéro`);

    console.log('— 2. Le réglage « Où est ton numéro ? »');
    dit(JSON.stringify(R(null).ou) === '["description","titre","ref"]' && R(null).actif === false, 'défaut : « VRM numérote pour moi » (éteint), les trois sources prêtes');
    dit(JSON.stringify(R({ actif: true, ou: ['titre'] }).ou) === '["titre"]' && JSON.stringify(R({ actif: true, ou: [] }).ou) === '["description","titre","ref"]' && JSON.stringify(R({ ou: ['x', 'ref'] }).ou) === '["ref"]', 'les sources cochées ; une liste vide ou inconnue ⇒ les trois');
    const b1 = basculerOu({ actif: true, ou: ['description'] }, 'description');
    dit(JSON.stringify(b1.ou) === '["description"]', 'décocher la dernière source : refusé (jamais zéro)');
    dit(JSON.stringify(basculerOu({ actif: true, ou: ['description'] }, 'titre').ou) === '["description","titre"]' && JSON.stringify(basculerOu({ actif: true }, 'titre').ou) === '["description","ref"]', 'cocher / décocher garde l’ordre');
    const art = { titre: 'Nike Dunk N° 12', description: 'Très bon état.\nN° 40', ref: '77' };
    dit(E(art).etat === 'ambigu', 'les trois sources : titre 12 ≠ description 40 ⇒ ambigu');
    const d = E({ ...art, ou: ['description'] });
    dit(d.etat === 'lu' && d.cle === '40' && d.source === 'description', 'seulement « fin de la description » ⇒ N°40 (le titre n’est plus lu)', JSON.stringify(d));
    const t = E({ ...art, ou: ['titre'] });
    dit(t.etat === 'lu' && t.cle === '12' && t.source === 'titre', 'seulement « titre » ⇒ N°12', JSON.stringify(t));
    const r = E({ ...art, ou: ['ref'] });
    dit(r.etat === 'lu' && r.cle === '77' && r.source === 'ref', 'seulement « référence » ⇒ N°77', JSON.stringify(r));
    dit(E({ titre: 'Nike', description: 'x\nN° 5', ou: ['titre'] }).etat === 'rien', 'une source décochée ne pose rien');
    const cinquante = Array.from({ length: 50 }, (_, i) => E({ titre: 'Nike Air Max 90 blanches taille 42', description: 'Très bon état, pointure 42, 45 €.', ou: ['description', 'titre'] }));
    dit(cinquante.every((l) => decisionEcrite({ lecture: l, ident: '' }) === null), '50 annonces identiques sans N° écrit ⇒ aucune ne reçoit de numéro');
    console.log('— 2 bis. La lecture rangée par l’extension');
    dit(JSON.stringify(compacterLecture(T('x\nN° 12', 'description'))) === '{"etat":"lu","cle":"12","brut":"N° 12"}', 'compactée : la lecture, jamais le texte');
    dit(lectureRecue({ etat: 'lu', cle: '12 ; drop' }) === null && lectureRecue({ etat: 'lu', cle: '0' }) === null && lectureRecue({ etat: 'ambigu', cles: ['12'] }) === null && lectureRecue('N° 12') === null, 'une forme reçue inconnue vaut « pas lue », jamais un N°');
    const sansTexte = E({ titre: 'Nike', descriptionLue: { etat: 'lu', cle: '33', brut: 'N° 33' } });
    dit(sansTexte.etat === 'lu' && sansTexte.cle === '33' && sansTexte.descriptionSue, 'la lecture rangée par l’extension compte comme la description lue');
    dit(E({ titre: 'Nike N° 8', descriptionLue: { etat: 'lu', cle: '33' } }).etat === 'ambigu', 'lecture rangée 33 ≠ titre 8 ⇒ ambigu');

    console.log('— 3. L’extension (copie exacte, vrai background.js)');
    const BGt = lire('vinted-sync-extension/background.js');
    const a = BLOC_RE.exec(lire('src/numeroEcrit.js')), b = BLOC_RE.exec(BGt);
    dit(!!a && !!b && sansExport(a[1]).trim() === b[1].trim(), 'le bloc <numero-ecrit-lecture> de background.js est la copie exacte de src/numeroEcrit.js', !a ? 'absent de l’app' : !b ? 'absent de l’extension' : 'différent : lancer --recopie');
    let lnd = null, maigre = null;
    try {
      const { faireFond } = require('./_fond-vm.cjs');
      const F = faireFond({ src: path.join(RACINE, 'vinted-sync-extension', 'background.js') });
      lnd = typeof F.ctx.lectureNumeroDescription === 'function' ? F.ctx.lectureNumeroDescription : null;
      maigre = typeof F.ctx.articleMaigre === 'function' ? F.ctx.articleMaigre : null;
    } catch (e) { dit(false, 'le vrai background.js s’exécute (scripts/_fond-vm.cjs)', String(e && e.message).slice(0, 160)); }
    dit(typeof lnd === 'function', 'extension : `lectureNumeroDescription` existe (capacité numerodescription, 5.334)');
    if (typeof lnd === 'function') {
      const ratesExt = PIEGES.filter(([tx]) => JSON.stringify(lnd(tx)) !== JSON.stringify(tx.trim() ? compacterLecture(T(tx, 'description')) : null));
      dit(!ratesExt.length, 'extension EXÉCUTÉE : les 50 descriptions piégées donnent la même lecture que l’app', ratesExt.map(([tx]) => JSON.stringify(tx)).join(' | '));
    }
    if (typeof maigre === 'function') {
      const o = maigre({ id: 1, title: 'Nike', price: { amount: '40' }, description: 'Très bon état, pointure 42.\nN° 57', photos: [] });
      dit(o && o.numEcrit && o.numEcrit.etat === 'lu' && o.numEcrit.cle === '57' && !('description' in o), 'le dressing allégé porte `numEcrit` (N°57) et jamais le texte de la description', JSON.stringify(o));
      const o2 = maigre({ id: 2, title: 'Nike', description: 'Pointure 42, 45 €' });
      dit(o2 && o2.numEcrit && o2.numEcrit.etat === 'rien', 'une description sans N° marqué ⇒ « rien » (jamais la pointure)', JSON.stringify(o2 && o2.numEcrit));
      const o3 = maigre({ id: 3, title: 'Nike' });
      dit(o3 && !('numEcrit' in o3), 'description absente ⇒ aucune lecture (pas su ≠ rien)');
    }
    const BG = sansCommentaires(BGt);
    dit(/numEcrit: lectureNumeroDescription\(bodyTxt\)/.test(BG) && /body: bodyTxt\.slice\(0, 400\)/.test(BG), 'Leboncoin : la description ENTIÈRE est lue avant d’en ranger 400 caractères');
    const iResa = BG.indexOf('async function reserverNumeroPourOnglet'), resa = iResa > 0 ? BG.slice(iResa, BG.indexOf('prochainNumeroDe(main, r)', iResa)) : '';
    dit(/if \(numeroEcritAllume\(main\)\) \{[^}]*return \{ ok: false/.test(resa), 'extension : « je l’écris » allumé ⇒ aucun N° réservé à côté de « Publier »');
    const man = JSON.parse(lire('vinted-sync-extension/manifest.json') || '{}');
    const cv = (/const CODE_VERSION = '([^']+)'/.exec(BGt) || [])[1];
    const cap = (/numerodescription: '([^']+)'/.exec(APP) || [])[1];
    const cmp = (x, y) => { const p = String(x).split('.').map(Number), q = String(y).split('.').map(Number); for (let i = 0; i < 3; i++) if ((p[i] || 0) !== (q[i] || 0)) return (p[i] || 0) - (q[i] || 0); return 0; };
    dit(cap && cmp(man.version, cap) >= 0 && cv === man.version && cmp(cap, '5.332.0') > 0, `capacité numerodescription (${cap}) ≤ version servie (${man.version}) = CODE_VERSION, au-dessus de 5.331/5.332/5.333`);
  }

  console.log('— 4. La remise en ligne');
  const RL = await imp('src/remiseEnLigne.js');
  if (RL && N) {
    const { suggestionsRemiseEnLigne: S } = RL;
    const rep = (k) => !/^B/.test(String(k));
    const marqueDe = (t) => (/nike/i.test(t) ? 'Nike' : /adidas/i.test(t) ? 'Adidas' : null);
    const modeleDe = (t) => (/dunk/i.test(t) ? 'dunk' : /samba/i.test(t) ? 'samba' : /air max/i.test(t) ? 'air max' : null);
    const J = 86400000, T0 = Date.parse('2026-11-01T10:00:00Z');
    const base = (o) => ({ marqueDe, modeleDe, reprenable: rep, maintenant: T0 + 3 * J, ...o });
    const nv = (id, o = {}) => ({ id, compte: '1', titre: 'Nike Dunk Low Panda taille 42', taille: '42', photoK: 'p' + id, createdTs: T0 + J, numero: '', manuel: false, ...o });
    const old = (id, num, o = {}) => ({ id, compte: '1', titre: 'Nike Dunk Low Panda taille 42', taille: '42', photoK: 'p' + id, supprimeeAt: T0, numero: num, ...o });
    let s = S(base({ nouvelles: [nv('n1', { photoK: 'pa' })], supprimees: [old('a1', '12', { photoK: 'pa' })] }));
    dit(s.length === 1 && s[0].nouvelle === 'n1' && s[0].options[0].numero === '12' && s[0].options[0].force === 'forte', 'photo identique ⇒ proposition « forte » du N°12', JSON.stringify(s));
    s = S(base({ nouvelles: [nv('n1')], supprimees: [old('a1', '12')] }));
    dit(s.length === 1 && s[0].options[0].force === 'simple', 'même marque + taille + modèle ⇒ proposition « simple »', JSON.stringify(s));
    s = S(base({ nouvelles: [nv('n1')], supprimees: [old('a1', '12', { titre: 'Adidas Samba taille 42' })] }));
    dit(s.length === 0, 'marque différente ⇒ rien', JSON.stringify(s));
    s = S(base({ nouvelles: [nv('n1')], supprimees: [old('a1', '12', { titre: 'Nike Air Max 90 taille 42' })] }));
    dit(s.length === 0, 'deux modèles différents (Dunk / Air Max) ⇒ rien');
    s = S(base({ nouvelles: [nv('n1')], supprimees: [old('a1', '12', { titre: 'Nike Dunk Low Panda taille 44', taille: '44' })] }));
    dit(s.length === 0, 'taille différente ⇒ rien');
    s = S(base({ nouvelles: [nv('n1')], supprimees: [old('a1', '12', { compte: '2' })] }));
    dit(s.length === 0, 'autre compte ⇒ rien');
    s = S(base({ nouvelles: [nv('n1', { createdTs: T0 - 3 * J })], supprimees: [old('a1', '12')] }));
    dit(s.length === 0, 'annonce mise en ligne AVANT la suppression ⇒ pas une remise en ligne');
    s = S(base({ nouvelles: [nv('n1')], supprimees: [old('a1', '12')], portesPresents: ['12'] }));
    dit(s.length === 0, 'N°12 encore porté par une paire présente ⇒ jamais proposé (deux paires sous un N°)');
    s = S(base({ nouvelles: [nv('n1')], supprimees: [old('a1', 'B230')] }));
    dit(s.length === 0, 'N° d’archive (B…) ⇒ jamais proposé');
    s = S(base({ nouvelles: [nv('n1', { numero: '12' })], supprimees: [old('a1', '12')] }));
    dit(s.length === 0, 'elle porte déjà le N°12 ⇒ rien à proposer');
    s = S(base({ nouvelles: [nv('n1', { numero: '57', manuel: true })], supprimees: [old('a1', '12')] }));
    dit(s.length === 0, 'N° posé à la main ⇒ rien proposé (son geste)');
    s = S(base({ nouvelles: [nv('n1', { ecrit: '12' })], supprimees: [old('a1', '12')] }));
    dit(s.length === 0, 'N° écrit dans l’annonce = l’ancien ⇒ repris sans question (identité qu’il a écrite), rien à proposer');
    s = S(base({ nouvelles: [nv('n1')], supprimees: [old('a1', '12')], refus: { n1: ['a1'] } }));
    dit(s.length === 0, '« Non, une autre paire » ⇒ plus proposé');
    s = S(base({ nouvelles: [nv('n1')], supprimees: [old('a1', '12', { supprimeeAt: T0 - 60 * J })] }));
    dit(s.length === 0, 'suppression trop ancienne (60 j) ⇒ rien');
    const cinquante = Array.from({ length: 50 }, (_, i) => old('x' + i, String(100 + i)));
    s = S(base({ nouvelles: [nv('n1')], supprimees: cinquante }));
    dit(s.length === 1 && s[0].options.every((o) => o.force === 'simple') && s[0].options.length <= 3 && s[0].plusieurs === true, '50 paires identiques supprimées ⇒ jamais « forte » par ressemblance ; au plus 3 choix, « plusieurs » dit', JSON.stringify(s).slice(0, 200));
    s = S(base({ nouvelles: [nv('n1', { photoK: 'x7' })], supprimees: cinquante.map((o, i) => (i === 7 ? { ...o, photoK: 'x7' } : o)) }));
    dit(s.length === 1 && s[0].options.length === 1 && s[0].options[0].numero === '107' && s[0].options[0].force === 'forte', 'la photo identique désigne LA paire parmi 50 identiques (N°107)', JSON.stringify(s).slice(0, 200));
    s = S(base({ nouvelles: [nv('n1'), nv('n2')], supprimees: [old('a1', '12')] }));
    dit(s.length === 2 && s.every((x) => x.options[0].numero === '12' && x.concurrence === true), 'deux nouvelles pour une ancienne ⇒ chacune proposée, « concurrence » dite (son clic choisit)');
  }

  console.log('— 5. L’app');
  dit(/const lireNumeroEcrit = \(o\) => lireNumeroEcritRegle\(\{ ou: ouNumeroEcrit\(\), \.\.\.o \}\);/.test(APP), 'chaque lecture de l’app passe les sources cochées (`ou`)');
  dit(/numEcritDesc: lectureRecue\(it\.numEcrit\)/.test(APP), 'le dressing apporte la lecture de la description (`numEcritDesc`)');
  dit(/suggestionsRemiseEnLigne\(/.test(APP) && /poserNumero\(it, o\.numero, [^,]+, \{ carton: true, memePaire: true \}\)/.test(APP), 'remise en ligne : proposée, et « Oui, N°X » passe par `poserNumero` (ses garde-fous), le carton porte déjà le N°');
  dit(/'vrm_remise_refus'/.test((/const SYNC_KEYS = \[([\s\S]*?)\];/.exec(APP) || [])[1] || ''), '« Non, une autre paire » est synchronisé');
  const REG = sansCommentaires(lire('src/ecrans/Reglages.jsx'));
  dit(/data-numero-ou=/.test(REG) && /basculerOu\(/.test(REG) && /data-numero-essai=/.test(REG), 'Réglages : « Où est ton numéro ? » (cases) et l’essai « Colle ta description »');

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vérifications passent${ko ? `, ${ko} échouent` : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { dit(false, 'l’audit a planté', String(e && e.stack || e).slice(0, 300)); process.exit(1); });
