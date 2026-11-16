// AUDIT — LES TAMPONS DES BORDEREAUX : UN SEUL RÉGLAGE, TOUTES LES IMPRESSIONS (16 nov., lot tampons-parametres)
// Julien : « une seule source de vérité utilisée par TOUTES les impressions » ; « quand je touche Imprimer, les
// réglages sont appliqués aux bordereaux ». Juge la RÈGLE (code exécuté, appels réels), pas l'orthographe :
//   T1 `vrm_tampons` synchronisé (SYNC_KEYS) ;
//   T2 aucune impression ne lit encore l'ancien réglage (`.tamponA4` / `.tamponTh`, `vrm_tampon_positions`) —
//      seule la migration de src/impression/tampons.js les lit ;
//   T3 CHAQUE appel de `tamponnerBordereau` reçoit le tampon résolu (`tampon:`) ;
//   T4 `poserBordereau` résout le réglage (`reglageTamponsChoisi`, `resoudreTampon`) et écrit les cases ;
//   T5 le PDF préparé d'avance est invalidé quand le réglage change (empreinte) ;
//   T6 la sélection OUVRE l'aperçu ; seul « Imprimer » de l'aperçu ouvre un PDF, fait avec SES placements ;
//   T7 les règles pures (migration, exception, repousser, origine, contenu, retour) exécutées ;
//   T8 chaque texte `tampons.*` existe dans les 5 langues.
// `--prouve` : chaque règle réaffaiblie dans une copie du code ⇒ l'audit DOIT rougir.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const PROUVE = process.argv.includes('--prouve');

function juger(src) {
  const res = [];
  const dit = (c, m) => res.push([!!c, m]);
  const A = src.app, sans = (s) => s.replace(/\/\/[^\n]*/g, '');
  const As = sans(A);
  dit(/'vrm_tampons'/.test(A.slice(A.indexOf('const SYNC_KEYS = ['), A.indexOf('const SYNC_KEYS = [') + 6000)), 'T1 vrm_tampons dans SYNC_KEYS');
  const lecteurs = [['src/App.jsx', As], ...src.autres.map(([f, s]) => [f, sans(s)])].filter(([f, s]) => /\.tampon(A4|Th)\b/.test(s));
  dit(!lecteurs.length, 'T2 aucune impression ne lit `.tamponA4`/`.tamponTh`' + (lecteurs.length ? ' — ' + lecteurs.map((x) => x[0]).join(', ') : ''));
  const posLu = (As.match(/load\(TAMPON_POSITIONS/g) || []).length;
  dit(posLu === 1 && /const reglageTamponsChoisi = \(\) => \{ try \{ return reglageTampons\(load\(CLE_TAMPONS, null\), \{ impression: load\(CLE_IMPRESSION, null\), positions: load\(TAMPON_POSITIONS, null\) \}\)/.test(As), 'T2 `vrm_tampon_positions` lu par la seule migration');
  const appels = As.split('\n').filter((l) => /await tamponnerBordereau\(PL, /.test(l));
  dit(appels.length >= 4 && appels.every((a) => /\btampon:/.test(a)), `T3 chaque appel de tamponnerBordereau reçoit le tampon résolu (${appels.filter((a) => /\btampon:/.test(a)).length}/${appels.length})`);
  const pb = As.slice(As.indexOf('const poserBordereau = async'), As.indexOf('// ⟦→ ecrans/Reglages.jsx #25⟧'));
  dit(/imp\.tampons = \(impression && impression\.tampons\) \|\| reglageTamponsChoisi\(\)/.test(pb) && /imp\.ts = resoudreTampon\(imp\.tampons/.test(pb) && /texteDuCartouche\(imp\.ts\.contenu/.test(pb), 'T4 poserBordereau : le réglage résolu, ses cases écrites (A4)');
  dit(/texteDuCartouche\(ts\.contenu/.test(As.slice(As.indexOf('const poserEtiquettesThermiques'), As.indexOf('const tamponDePage'))), 'T4 thermique : les cases du réglage');
  dit(/if \(imp\.retour\) imp\.ts = \{ \.\.\.imp\.ts, contenu: \{ \.\.\.imp\.ts\.contenu, num: true, titre: true \} \}/.test(pb), 'T4 un RETOUR garde toujours « RETOUR » (N° et titre écrits)');
  dit(/empreinteReglagesImpr = \(\) => [^\n]*reglageTamponsChoisi\(\)/.test(As), 'T5 l’empreinte du PDF préparé compte le réglage des tampons');
  const li = As.slice(As.indexOf('const lancerImpression = (cles, format'), As.indexOf('const imprimerApercu = () =>'));
  dit(/setApercuImpr\(\{ choisies, format, tampons, places: \{\}, tous: true, sig(?:, proprio)? \}\)/.test(li) && !/ouvrirPdfLot|attendrePuisOuvrir/.test(li), 'T6 la sélection ouvre l’aperçu, rien n’est imprimé sans « Imprimer »');
  const ia = As.slice(As.indexOf('const imprimerApercu = () =>'), As.indexOf('const poserApercu = '));
  dit(/const sig = a\.sig \|\| sigAvecPlaces\(sigImpr\(choisies, format, tampons\), places\)/.test(ia) && /composerLot\(choisies, format, tampons, \{ places,/.test(ia), 'T6 « Imprimer » de l’aperçu : le PDF de SES placements');
  dit(/const choix = pos \|\| \(imp\.places && imp\.places\.n !== undefined \? td\.libreN : choisir/.test(As) && /const choix = imp && imp\.places && imp\.places\.n !== undefined \? td\.libreN : choisir/.test(As), 'T6 la place posée dans l’aperçu prime sur la place gardée (A4 et thermique)');
  dit(/places: places && places\[l\.cle\] \? places\[l\.cle\] : null/.test(As) && /if \(it\.places\) impIt\.places = it\.places;/.test(As) && /pi = imp\.places \|\| \{\}/.test(As), 'T6 les places de l’aperçu vont jusqu’au tampon');
  // T7 — règles pures, exécutées
  try {
    const T = src.T;
    const m = T.reglageTampons(null, { impression: { tamponA4: 'num', tamponTh: 'rien' }, positions: { 'x·A4·portrait': { vx: 0.1, vy: 0.2, vw: 0.3, v: 1 } } });
    dit(m.a4.num && !m.a4.titre && !m.th.num && !m.th.mention && m.formes['x·A4·portrait'].n.vx === 0.1, 'T7 migration : choix et places d’avant repris tels quels');
    dit(T.reglageTampons(null).a4.titre === true && T.reglageTampons(null).th.titre === false && T.reglageTampons(null).placeMention === 'qr', 'T7 origine : titre en A4, N° seul en thermique, mention au-dessus du QR');
    const e = T.avecChoix(T.reglageTampons(null), 'mondialrelay', { contenu: { titre: false } });
    dit(!T.resoudreTampon(e, { famille: 'mondialrelay' }).contenu.titre && T.resoudreTampon(e, { famille: 'colissimo' }).contenu.titre, 'T7 exception « seulement Mondial Relay »');
    const p = T.repousserHorsInterdits({ x: 10, y: 10, w: 20, h: 10 }, [{ x: 0, y: 0, w: 50, h: 50 }], 200, 200);
    dit(p && p.repousse && !T.chevauche({ x: p.x, y: p.y, w: 20, h: 10 }, { x: 0, y: 0, w: 50, h: 50 }), 'T7 une place sur une zone interdite est repoussée hors d’elle');
    dit(T.estOrigine(T.reglageOrigine()) && !T.estOrigine(T.avecPlace(T.reglageOrigine(), 'k', 'n', { vx: 0.1, vy: 0.1, vw: 0.2 })), 'T7 « Revenir au réglage d’origine »');
    const c = T.texteDuCartouche({ num: true, titre: false, taille: true }, { numero: '7', titre: 'Veste 42', taille: '42' });
    dit(c.numero === '7' && c.titre === 'T 42', 'T7 cases : N° + taille sans le titre');
    dit(JSON.stringify(T.contenuDuMode('rien')) === JSON.stringify({ num: false, titre: false, taille: false, mention: false }), 'T7 « Rien » : rien d’écrit, pas de mention');
  } catch (e2) { dit(false, 'T7 règles pures : ' + String(e2.message || e2).slice(0, 120)); }
  // T8 — textes
  const cles = new Set();
  for (const s of [src.app, ...src.autres.map((x) => x[1])]) for (const mm of s.matchAll(/tr\(\s*[`'](tampons\.[a-zA-Z0-9.]+)[`']/g)) cles.add(mm[1]);
  for (const s of [src.app, ...src.autres.map((x) => x[1])]) for (const mm of s.matchAll(/tr\(`(tampons\.[a-z.]+)\.\$\{/g)) cles.add(mm[1] + '.*');
  const manque = [];
  for (const [l, d] of Object.entries(src.langues)) for (const k of cles) { if (k.endsWith('.*')) { if (!Object.keys(d).some((x) => x.startsWith(k.slice(0, -1)))) manque.push(`${l}:${k}`); } else if (!(k in d)) manque.push(`${l}:${k}`); }
  dit(cles.size >= 30 && !manque.length, `T8 ${cles.size} textes tampons.* dans les 5 langues` + (manque.length ? ' — manque ' + manque.slice(0, 8).join(', ') : ''));
  return res;
}

(async () => {
  const T = await import(path.join(R, 'src', 'impression', 'tampons.js'));
  const autresF = ['src/ecrans/Reglages.jsx', 'src/ecrans/Leboncoin.jsx', 'src/ecrans/Vestiaire.jsx', 'src/ImpressionSimple.jsx', 'src/parametres/TamponsBordereaux.jsx', 'src/impression/ApercuAvantImpression.jsx', 'src/impression/SceneTampons.jsx', 'src/impression/lotSimple.js', 'src/impression/planche4.js'];
  const langues = {};
  for (const l of ['fr', 'en', 'es', 'it', 'de']) langues[l] = (await import(path.join(R, 'src', 'i18n', 'langues', l, 'tampons.js'))).default;
  const src = { app: lire('src/App.jsx'), autres: autresF.filter((f) => fs.existsSync(path.join(R, f))).map((f) => [f, lire(f)]), T, langues };
  const res = juger(src);
  let ko = 0; for (const [c, m] of res) { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m); }
  if (PROUVE) {
    const mut = [
      ['T1', (s) => ({ ...s, app: s.app.replace("'vrm_tampon_positions','vrm_tampons',", "'vrm_tampon_positions',") })],
      ['T2', (s) => ({ ...s, app: s.app.replace('const contenu = texteDuCartouche(imp.ts.contenu,', 'const contenu = contenuTampon(reg.tamponA4,') })],
      ['T3', (s) => ({ ...s, app: s.app.replace('choix: tp.choix, tampon: tp.tampon });\n      posePrefs', 'choix: tp.choix });\n      posePrefs') })],
      ['T4', (s) => ({ ...s, app: s.app.replace('imp.tampons = (impression && impression.tampons) || reglageTamponsChoisi();', 'imp.tampons = reglageTampons(null);') })],
      ['T4', (s) => ({ ...s, app: s.app.replace('if (imp.retour) imp.ts = { ...imp.ts, contenu: { ...imp.ts.contenu, num: true, titre: true } };', '') })],
      ['T5', (s) => ({ ...s, app: s.app.replace('JSON.stringify([aEcrire(reglageTamponsChoisi()), reglageImpressionChoisi()])', 'JSON.stringify([reglageImpressionChoisi()])') })],
      ['T6', (s) => ({ ...s, app: s.app.replace("    setApercuImpr({ choisies, format, tampons, places: {}, tous: true, sig, proprio });", "    attendrePuisOuvrir(sig, choisies, [], () => null);") })],
      ['T6', (s) => ({ ...s, app: s.app.replace('composerLot(choisies, format, tampons, { places, pas:', 'composerLot(choisies, format, tampons, { pas:') })],
      ['T6', (s) => ({ ...s, app: s.app.replace('const choix = pos || (imp.places && imp.places.n !== undefined ? td.libreN : choisir ?', 'const choix = pos || (false ? td.libreN : choisir ?') })],
      ['T7', (s) => ({ ...s, T: { ...s.T, repousserHorsInterdits: (b) => ({ x: b.x, y: b.y, repousse: true }) } })],
      ['T8', (s) => ({ ...s, langues: { ...s.langues, de: Object.fromEntries(Object.entries(s.langues.de).filter(([k]) => k !== 'tampons.apercu.tous')) } })],
    ];
    let rouges = 0;
    for (const [n, f] of mut) { const r = juger(f(src)); const rouge = r.some(([c]) => !c); if (rouge) rouges++; console.log(`  ${rouge ? '✅' : '❌'} --prouve ${n} : la règle réaffaiblie ⇒ ${rouge ? 'rouge' : 'VERT (le contrôle ne prouve rien)'}`); }
    if (rouges < mut.length) ko++;
    console.log(`   --prouve : ${rouges}/${mut.length} mutations rouges`);
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-tampons : ${res.filter(([c]) => c).length} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})();
