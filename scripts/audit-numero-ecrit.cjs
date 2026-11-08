// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « JE NUMÉROTE MOI-MÊME DANS MES ANNONCES » (7 nov.)
//  1. La règle src/numeroEcrit.js, EXÉCUTÉE : les formes acceptées (N° 123,
//     N°123, No 123, Réf 123, Ref. 123, #123, N° B125, Réf. VRM-123) ; jamais un
//     nombre nu (pointure 42, prix 45 €, « 2 paires », une année), ni une
//     référence de modèle (CW2288-111, DD1391, B75806), ni un prix marqué
//     (#45 €) ; deux numéros ⇒ « ambigu » ; un N° au milieu de la description
//     n'est pas « à la fin » ; titre ≠ description ⇒ ambigu ; le SKU entier.
//  2. Les décisions : 50 annonces identiques sans N° écrit, réglage allumé ⇒
//     AUCUNE ne reçoit de numéro ; N° écrit qui contredit celui de VRM ⇒ rien
//     changé (« contredit ») ; deux annonces présentes au même N° ⇒ doublon
//     (le rouge) ; un N° d'archive ne se redonne pas ; la clé = `cleNum` de l'app.
//  3. App.jsx (commentaires retirés) : le réglage est synchronisé ; allumé, le
//     numéroteur des annonces passe par `decisionEcrite` et s'arrête AVANT
//     `prochainLibre` ; ni la vente à expédier, ni les doublons, ni Vestiaire
//     ne donnent un N° neuf. L'extension ne réserve plus de N° (5.324).
//  `--src <arbre>` : juge une autre copie (preuve sur le code d'avant, §6.1).
//  `--mutation=<nom>` : réaffaiblit la règle dans une copie ⇒ doit être ROUGE
//  (`--mutation=toutes` les essaie toutes).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);

// [fichier relatif, de, vers]
const MUTATIONS = {
  prix: ['src/numeroEcrit.js', 'if (SUITE_INTERDITE.test(suite)) continue;', ''],
  ambigu: ['src/numeroEcrit.js', "if (cles.length > 1) return { etat: 'ambigu'", "if (false) return { etat: 'ambigu'"],
  fin: ['src/numeroEcrit.js', 'const surFin = numerosMarques(derniere);', 'const surFin = numerosMarques(t);'],
  contredit: ['src/numeroEcrit.js', 'if (k && k !== lecture.cle) return null;', ''],
  archive: ['src/numeroEcrit.js', 'if (!reprenable(lecture.cle)) return null;', ''],
  modele: ['src/numeroEcrit.js', 'if (chiffres.length > 4) continue;', ''],
  neuf: ['src/App.jsx', 'if (!dec) continue;', 'if (!dec) {}'],
  doublons: ['src/App.jsx', "    if (numeroEcritActif()) return;\n    if (!listings.items || listings.loading", "    if (!listings.items || listings.loading"],
  vestiaire: ['src/App.jsx', 'if (numeroEcritActif()) return 0;', ''],
  vente: ['src/App.jsx', "!== '') && numeroEcritActif()) {", "!== '') && false) {"],
  extension: ['vinted-sync-extension/background.js', "if (numeroEcritAllume(main)) { noterDiag('resa_numero_ecrit'); return { ok: false, raison: 'ecrit' }; }", ''],
};

if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  let attrapees = 0;
  for (const nom of noms) {
    const m = MUTATIONS[nom]; if (!m) { console.log(`❌ mutation inconnue : ${nom}`); process.exitCode = 1; continue; }
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-ne-'));
    for (const f of ['src/numeroEcrit.js', 'src/App.jsx', 'vinted-sync-extension/background.js']) { fs.mkdirSync(path.dirname(path.join(t, f)), { recursive: true }); fs.copyFileSync(path.join(RACINE, f), path.join(t, f)); }
    const p = path.join(t, m[0]); const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(m[1])) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${m[0]}`); process.exitCode = 1; fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, src.replace(m[1], m[2]));
    const r = spawnSync(process.execPath, [__filename, '--src', t], { encoding: 'utf8', timeout: 120000 });
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

(async () => {
  let N = null;
  try { N = await import('file://' + path.join(RACINE, 'src', 'numeroEcrit.js')); } catch (e) { dit(false, 'src/numeroEcrit.js existe et se charge', String(e && e.message).slice(0, 120)); }
  const APP = sansCommentaires(lire('src/App.jsx'));
  if (N) {
    const { lireNumeroTexte: T, lireNumeroEcrit: E, etatAnnonce, apercuNumeroEcrit, decisionEcrite, cleNumero, lireReglageNumeroEcrit } = N;
    console.log('— 1. Les formes');
    const lu = (t, z, k) => { const r = T(t, z); return r.etat === 'lu' && r.cle === k; };
    const acceptees = [
      ['Très bon état.\nN° 123', 'description', '123'], ['Très bon état.\nN°123', 'description', '123'], ['x\nNo 123', 'description', '123'],
      ['x\nNo. 123', 'description', '123'], ['x\nNº 123', 'description', '123'], ['x\nRéf 123', 'description', '123'], ['x\nRef. 123', 'description', '123'],
      ['x\nRéf : 77', 'description', '77'], ['x\n#123', 'description', '123'], ['x\nN° B125', 'description', 'B125'], ['x\nn° b125', 'description', 'B125'],
      ['x\nRéf. VRM-123', 'description', '123'], ['x\nN° 12\n\nk', 'description', '12'], ['Bon état. N° 12', 'description', '12'],
      ['Nike Air Max 90 T42 N°12', 'titre', '12'], ['N° 007 Dunk', 'titre', '7'], ['#C40 Samba', 'titre', 'C40'],
    ];
    const ratesA = acceptees.filter(([t, z, k]) => !lu(t, z, k));
    dit(!ratesA.length, `${acceptees.length} formes acceptées sont lues (clé exacte)`, ratesA.map((x) => JSON.stringify(x[0])).join(', '));
    const refusees = [
      ['Pointure 42, très bon état', 'description'], ['Prix 45 €', 'description'], ['2 paires disponibles', 'description'], ['Achetées en 2024', 'description'],
      ['x\n#45 €', 'description'], ['x\nN° 3 cm', 'description'], ['Réf. CW2288-111', 'description'], ['Réf DD1391', 'titre'], ['Réf B75806', 'titre'],
      ['Réf 315122', 'titre'], ['Nike Air Max 90 taille 42', 'titre'], ['No stress 42', 'titre'], ['brun12', 'titre'], ['Air Force 1 (42)', 'titre'],
      ['N° 0', 'titre'], ['Dunk low 12/2024', 'titre'],
    ];
    const ratesR = refusees.filter(([t, z]) => T(t, z).etat !== 'rien');
    dit(!ratesR.length, `${refusees.length} textes sans numéro de rangement ne donnent rien (nombre nu, prix, pointure, année, référence de modèle)`, ratesR.map((x) => JSON.stringify(x[0]) + '→' + JSON.stringify(T(x[0], x[1]))).join(', '));
    dit(T('N° 12\nbla\nN° 13', 'description').etat === 'ambigu', 'deux numéros dans la description ⇒ ambigu');
    dit(T('Nike #12 #13', 'titre').etat === 'ambigu', 'deux numéros dans le titre ⇒ ambigu');
    dit(T('Nike N°12 et encore N° 12', 'titre').etat === 'lu', 'le même numéro deux fois n’est pas ambigu');
    dit(T('N° 12 au milieu\nEnvoi rapide', 'description').etat === 'rien', 'un N° au milieu de la description n’est pas « à la fin »');
    dit(E({ titre: 'Nike N°12', description: 'x\nN° 13' }).etat === 'ambigu', 'titre ≠ fin de description ⇒ ambigu');
    dit(E({ titre: 'Nike N°12', description: 'x\nN° 12' }).etat === 'lu' && E({ titre: 'Nike N°12', description: 'x\nN° 12' }).source === 'description', 'titre = description ⇒ lu, source « description »');
    dit(E({ ref: 'VRM-82', titre: 'Nike' }).cle === '82' && E({ ref: 'VRM-82' }).source === 'ref', 'SKU « VRM-82 » ⇒ 82 (la référence d’abord)');
    dit(E({ ref: '12345-ABC', titre: 'Nike' }).etat === 'rien', 'SKU « 12345-ABC » n’est pas un numéro');
    dit(E({ ref: '12', titre: 'Nike N° 13' }).etat === 'ambigu', 'référence ≠ titre ⇒ ambigu');
    dit(E({ titre: 'Nike', description: 'x'.repeat(390) + '\nN° 9', descriptionCoupee: true }).etat === 'rien', 'description COUPÉE (Leboncoin, 400 car.) : sa fin n’est pas sue, rien lu');
    dit(lireReglageNumeroEcrit(null).actif === false && lireReglageNumeroEcrit({ actif: 'oui' }).actif === false && lireReglageNumeroEcrit({ actif: true }).actif === true, 'réglage éteint par défaut ; seul `actif: true` l’allume');

    console.log('— 2. Les décisions');
    const rep = (k) => !/^B/.test(k);   // « B » = archive (013), comme `numeroReprenable`
    const cinquante = Array.from({ length: 50 }, (_, i) => ({ id: String(9000 + i), site: 'vinted', titre: 'Nike Air Max 90 blanches taille 42', lecture: E({ titre: 'Nike Air Max 90 blanches taille 42', description: 'Très bon état, pointure 42, 45 €.' }), connu: '', presente: true }));
    const poses = cinquante.map((l) => decisionEcrite({ lecture: l.lecture, ident: '', reprenable: rep })).filter(Boolean);
    dit(poses.length === 0, '50 annonces identiques sans N° écrit, réglage allumé ⇒ AUCUNE ne reçoit de numéro', `${poses.length} numéro(s) posé(s)`);
    const a50 = apercuNumeroEcrit(cinquante, { reprenable: rep });
    dit(a50.comptes.rien === 50 && a50.comptes['a-poser'] === 0, 'l’aperçu dit « 50 sans N° écrit »', JSON.stringify(a50.comptes));
    const ecrites = Array.from({ length: 50 }, (_, i) => ({ id: String(8000 + i), site: 'vinted', titre: 'Nike Air Max 90 blanches taille 42', lecture: E({ titre: 'Nike Air Max 90 blanches taille 42', description: `Très bon état.\nN° ${i + 1}` }), connu: '', presente: true }));
    const d50 = ecrites.map((l) => decisionEcrite({ lecture: l.lecture, reprenable: rep }));
    dit(d50.every((d, i) => d && d.numero === String(i + 1)), '50 annonces identiques AVEC leur N° écrit ⇒ chacune le sien, par son annonce (jamais par le titre)');
    dit(decisionEcrite({ lecture: E({ description: 'x\nN° 12' }), ident: '57', reprenable: rep }) === null, 'N° écrit 12, la paire porte déjà 57 par identité ⇒ rien posé');
    dit(etatAnnonce({ lecture: E({ description: 'x\nN° 12' }), connu: '57', reprenable: rep }) === 'contredit', 'N° écrit 12, VRM connaît 57 ⇒ « contredit » (à vérifier, son clic)');
    dit(etatAnnonce({ lecture: E({ description: 'x\nN° 12' }), connu: '57', refuse: '12', reprenable: rep }) === 'garde', 'il a choisi « Garder N°57 » ⇒ plus proposé');
    dit(etatAnnonce({ lecture: E({ description: 'x\nN° 12' }), connu: '012', reprenable: rep }) === 'accord', '« 012 » = « 12 » ⇒ accord');
    dit(decisionEcrite({ lecture: E({ description: 'x\nN° B125' }), reprenable: rep }) === null && etatAnnonce({ lecture: E({ description: 'x\nN° B125' }), reprenable: rep }) === 'archive', 'N° d’archive écrit (B125) ⇒ ne se redonne pas');
    dit(decisionEcrite({ lecture: E({ titre: 'Nike #12 #13' }), ident: '12', reprenable: rep }) === null, 'deux numéros écrits ⇒ rien, même avec une identité');
    dit((decisionEcrite({ lecture: E({ titre: 'Nike' }), ident: '57', reprenable: rep }) || {}).numero === '57', 'rien d’écrit, même photo / même vente ⇒ l’identité seule (aucun N° neuf)');
    dit(etatAnnonce({ lecture: E({ description: 'x\nN° 12' }), reprenable: rep, numerotable: false }) === 'avant', 'annonce d’avant la remise à zéro ⇒ rien pris tout seul');
    const deux = apercuNumeroEcrit([
      { id: '1', site: 'vinted', titre: 'A', lecture: E({ description: 'x\nN° 12' }), connu: '', presente: true },
      { id: '2', site: 'vinted', titre: 'A', lecture: E({ description: 'y\nN° 12' }), connu: '', presente: true },
      { id: '3', site: 'leboncoin', titre: 'A', lecture: E({ titre: 'A N° 12' }), connu: '', presente: true },
    ], { reprenable: rep });
    dit(deux.doublons.length === 1 && deux.doublons[0].cle === '12' && deux.doublons[0].site === 'vinted' && deux.doublons[0].ids.length === 2, 'deux annonces Vinted présentes au même N° lu ⇒ un doublon (le rouge) ; la même paire sur Leboncoin n’en est pas un', JSON.stringify(deux.doublons));
    // La clé : la même que `cleNum` de l'app.
    const m = /const cleNum = \(v\) => \{[\s\S]*?\n\};/.exec(lire('src/App.jsx'));
    let cleApp = null; try { cleApp = m ? new Function(m[0] + '; return cleNum;')() : null; } catch (_) { cleApp = null; }
    const essais = ['125', 'b125', ' B 125 ', '007', 'C-40', 'x_1', '0', ''];
    dit(cleApp && essais.every((v) => cleApp(v) === cleNumero(v)), 'la clé du module = `cleNum` de l’app (« b125 » = « B125 », « 007 » = « 7 »)');
  }

  console.log('— 3. L’app et l’extension');
  const sync = (/const SYNC_KEYS = \[([\s\S]*?)\];/.exec(APP) || [])[1] || '';
  dit(/'vrm_numero_ecrit'/.test(sync), 'le réglage est synchronisé (SYNC_KEYS), jamais un drapeau du navigateur seul');
  const iOn = APP.indexOf('if (ecritOn) {'), iNeuf = APP.indexOf('num = prochainLibre(taken, takenK, prefNum)');
  const bloc = iOn >= 0 && iNeuf > iOn ? APP.slice(iOn, iNeuf) : '';
  dit(bloc && /decisionEcrite\(/.test(bloc) && /if \(!dec\) continue;/.test(bloc) && /\n\s*continue;\n\s*\}/.test(bloc) && !/prochainLibre/.test(bloc), 'annonces : allumé, la décision vient de `decisionEcrite` et s’arrête AVANT `prochainLibre` (ni N° réservé, ni N° neuf)');
  dit(/const ecritOn = numeroEcritActif\(\);/.test(APP), 'annonces : le réglage est relu à chaque passage');
  const iDbl = APP.indexOf('doublonsAReattribuer(conflitsNum'), effDbl = iDbl > 0 ? APP.slice(APP.lastIndexOf('useEffect(', iDbl), iDbl) : '';
  dit(/if \(numeroEcritActif\(\)\) return;/.test(effDbl), 'doublons : allumé, aucun N° neuf (le rouge reste, il corrige son annonce)');
  const iVc = APP.indexOf('async function numeroterVestiaire'), vc = iVc > 0 ? APP.slice(iVc, APP.indexOf('produitsANumeroter(', iVc)) : '';
  dit(/if \(numeroEcritActif\(\)\) return 0;/.test(vc), 'Vestiaire : allumé, aucun N° donné');
  const iVente = APP.indexOf('const cand = prochainLibre(dejaPris, dejaPrisK, prefNum);'), avVente = iVente > 0 ? APP.slice(iVente - 1500, iVente) : '';
  dit(/!== ''\) && numeroEcritActif\(\)\) \{[\s\S]*lireNumeroEcrit\(\{ titre:[\s\S]*\} else if/.test(avVente), 'vente à expédier : allumé, le N° écrit dans le titre, jamais un N° neuf');
  dit(/numeroEcritActif\(\)/.test(APP.slice(APP.indexOf('const numeroVcIdentite'), APP.indexOf('const numeroVcIdentite') + 900)) && /numeroEcritLbc\(ad\)/.test(APP) && /skuEcrit\(\)/.test(APP), 'Vestiaire (titre), Leboncoin (référence, description, titre), eBay (SKU) lisent la même règle');
  const BG = sansCommentaires(lire('vinted-sync-extension/background.js'));
  const f = /function numeroEcritAllume\(main\) \{[^\n]*\}/.exec(BG);
  let allume = null; try { allume = f ? new Function(f[0] + '; return numeroEcritAllume;')() : null; } catch (_) { allume = null; }
  dit(allume && allume({ vrm_numero_ecrit: { actif: true } }) === true && allume({}) === false && allume({ vrm_numero_ecrit: { actif: 'oui' } }) === false && allume(null) === false, 'extension : `numeroEcritAllume` (EXÉCUTÉE) ne s’allume que sur `actif: true`');
  const iResa = BG.indexOf('async function reserverNumeroPourOnglet'), resa = iResa > 0 ? BG.slice(iResa, BG.indexOf('prochainNumeroDe(main, r)', iResa)) : '';
  dit(/'vrm_numero_ecrit'/.test(resa) && /if \(numeroEcritAllume\(main\)\) \{[^}]*return \{ ok: false/.test(resa), 'extension : allumé, aucun N° réservé à côté de « Publier » (avant `prochainNumeroDe`)');

  console.log(`\n${ko ? '❌' : '✅'} ${ok} vérifications passent${ko ? `, ${ko} échouent` : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { dit(false, 'l’audit a planté', String(e && e.stack || e).slice(0, 200)); process.exit(1); });
