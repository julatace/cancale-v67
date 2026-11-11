#!/usr/bin/env node
// ── audit-en-ligne-deux-fois — LA MÊME PAIRE EN LIGNE DEUX FOIS (6 nov., vague 3) ──
// Exécute la VRAIE règle (src/enLigneDeuxFois.js) avec la VRAIE clé de photo
// (`photoKey`, extraite de src/App.jsx) et le VRAI règlement des doublons
// (`doublonsAReattribuer`, bloc <doublons-reattribuer-regle>), sur des données
// INVENTÉES. Ce qu'il exige :
//   · 50 paires au même titre (deux comptes, N° et photos différents) : AUCUN
//     doublon — jamais le titre (§5) ;
//   · deux annonces Vinted à la même PHOTO EXACTE (même sous deux tailles d'URL,
//     ou par la `photoK` de leur fiche) : un groupe, « photo » ; reliées par
//     `recreeDe` : un groupe, « recree » ;
//   · le même DOSSIER de photo, fichier différent : rien (le dossier n'est pas une
//     identité, §5) ;
//   · le même N° seul sur deux annonces Vinted : pas un « en ligne deux fois »
//     (le bloc rouge le dit déjà) — rendu à part, `numeroSeul` ;
//   · une lecture ratée, sans heure ou de plus de 24 h : NE CONCLUT RIEN, nommée ;
//   · Vinted + eBay sous le même N° : `sites` (voulu), jamais une carte ;
//   · le règlement des doublons ne renumérote pas deux annonces de même photo
//     exacte (la même paire), mais renumérote toujours deux paires différentes ;
//   · Ma journée passe par la règle, avec les annonces EN LIGNE seulement, et la
//     feuille ne supprime rien (aucun envoi, aucune commande) ;
//   · (6 nov., finitions) le bloc ROUGE (`conflitsDeNumeros`, exécuté) se tait pour les
//     groupes que la carte ambre affiche — et seulement pour eux : même N° seul, lecture
//     pas sûre ⇒ le rouge reste.
//   node scripts/audit-en-ligne-deux-fois.cjs                 la règle du dépôt
//   node scripts/audit-en-ligne-deux-fois.cjs --mutation=NOM  une règle réaffaiblie
//   node scripts/audit-en-ligne-deux-fois.cjs --prouve        chaque mutation doit rougir
'use strict';
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const RACINE = path.join(__dirname, '..');
const REGLE = path.join(RACINE, 'src', 'enLigneDeuxFois.js');
const APP = path.join(RACINE, 'src', 'App.jsx');
const FEUILLE = path.join(RACINE, 'src', 'EnLigneDeuxFois.jsx');

// [fichier, ancre, remplacement]
const MUTATIONS = {
  'par-titre': ['regle', "  parts.forEach((p, i) => { if (p.recreeDe && parId.has(p.recreeDe)) lie(i, parId.get(p.recreeDe), 'recree'); });",
    "  parts.forEach((p, i) => { if (p.recreeDe && parId.has(p.recreeDe)) lie(i, parId.get(p.recreeDe), 'recree'); });\n  { const t = new Map(); parts.forEach((p, i) => { const k = p.titre.toLowerCase(); if (!k) return; if (t.has(k)) lie(i, t.get(k), 'titre'); else t.set(k, i); }); }"],
  'dossier': ['regle', "photos: [...new Set([clePhoto && it.photo ? clePhoto(it.photo) : '', f.photoK ? String(f.photoK) : ''].filter(Boolean))],",
    "photos: [...new Set([clePhoto && it.photo ? String(clePhoto(it.photo)).split('/')[0] : '', f.photoK ? String(f.photoK).split('/')[0] : ''].filter(Boolean))],"],
  'photo-ignoree': ['regle', "    for (const k of p.photos) { if (parPhoto.has(k)) lie(i, parPhoto.get(k), 'photo'); else parPhoto.set(k, i); }\n", ''],
  'photok-ignoree': ['regle', ", f.photoK ? String(f.photoK) : ''].filter(Boolean))],", "].filter(Boolean))],"],
  'recree-ignore': ['regle', "  parts.forEach((p, i) => { if (p.recreeDe && parId.has(p.recreeDe)) lie(i, parId.get(p.recreeDe), 'recree'); });\n", ''],
  'numero-unit': ['regle', "  parts.forEach((p, i) => { if (p.recreeDe && parId.has(p.recreeDe)) lie(i, parId.get(p.recreeDe), 'recree'); });",
    "  parts.forEach((p, i) => { if (p.recreeDe && parId.has(p.recreeDe)) lie(i, parId.get(p.recreeDe), 'recree'); });\n  { const t = new Map(); parts.forEach((p, i) => { if (!p.cle) return; if (t.has(p.cle)) lie(i, t.get(p.cle), 'numero'); else t.set(p.cle, i); }); }"],
  'vieille-conclut': ['regle', "  if (!(Number(maintenant) - lu <= EN_LIGNE_FRAIS_MS)) return 'lecture de plus de 24 h';\n", ''],
  'jamais-conclut': ['regle', "  if (c.lu == null || !Number.isFinite(lu)) return 'jamais lue';\n", ''],
  'ko-conclut': ['regle', "  if (!c || c.ok === false) return 'lecture ratée';\n", '  if (!c) return \'lecture ratée\';\n'],
  'sites-alerte': ['regle', "    sites.push(sortie(g, ['numero']));", "    sites.push(sortie(g, ['numero'])); vintedG.push(sortie(g, ['numero']));"],
  'manque-tu': ['regle', "    if (r !== 'ok') { manque.push({ plateforme: 'vinted', uid: String(c.uid || ''), nom: String(c.nom || c.uid || ''), raison: r }); continue; }",
    "    if (r !== 'ok') { continue; }"],
  'doublon-renumerote': ['app', "    if (annonces.length === 2) { const pk = annonces.map((x) => String((fiches[x.id] || {}).photoK || '')); if (pk[0] && pk[0] === pk[1]) continue; }\n", ''],
  'rouge-ignore-groupes': ['app', 'conflitsDeNumeros(porteursNum, groupesDeuxFois)', 'conflitsDeNumeros(porteursNum)'],
  'rouge-groupes-de-tout': ['app', "    ? enLigneDeux.vinted.map((g) => (g.annonces || []).filter((a) => a.plat === 'vinted').map((a) => String(a.id)))", "    ? [...enLigneDeux.vinted, ...(enLigneDeux.numeroSeul || [])].map((g) => (g.annonces || []).filter((a) => a.plat === 'vinted').map((a) => String(a.id)))"],
  'journee-a-confirmer': ['app', "        enLigne: listings.items.filter((it) => String(it && it._acc && it._acc.vinted_user_id) === uid) };",
    "        enLigne: [...listings.items, ...(listings.aConfirmer || [])].filter((it) => String(it && it._acc && it._acc.vinted_user_id) === uid) };"],
};

const arg = process.argv.slice(2);
const mut = (arg.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (arg.includes('--prouve')) {
  let ok = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    console.log(`${r.status !== 0 && rouges ? '✅' : '❌'} mutation « ${m} » : ${rouges} rouge(s)`);
    if (r.status !== 0 && rouges) ok++;
  }
  console.log(`\n${ok}/${Object.keys(MUTATIONS).length} mutations attrapées.`);
  process.exit(ok === Object.keys(MUTATIONS).length ? 0 : 1);
}

(async () => {
  let regleSrc = fs.existsSync(REGLE) ? fs.readFileSync(REGLE, 'utf8') : null;
  let appSrc = fs.readFileSync(APP, 'utf8');
  if (mut) {
    const m = MUTATIONS[mut]; if (!m) { console.log('mutation inconnue : ' + mut); process.exit(2); }
    const cible = m[0] === 'app' ? appSrc : regleSrc;
    if (!cible || !cible.includes(m[1])) { console.log('❌ ancre de mutation introuvable : ' + mut); process.exit(1); }
    if (m[0] === 'app') appSrc = appSrc.replace(m[1], m[2]); else regleSrc = regleSrc.replace(m[1], m[2]);
  }
  let ko = 0, n = 0;
  const dit = (c, m, d) => { n++; if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d != null && !c ? ' — ' + d : '')); };
  const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' : ' + e.message); } };

  // La VRAIE clé de photo et le VRAI règlement des doublons (App.jsx).
  const ctx = {}; vm.createContext(ctx);
  const deb = appSrc.indexOf('const photoKey = (url) => {');
  const finPk = appSrc.indexOf('\n};\n', deb);
  const a = appSrc.indexOf('// <doublons-reattribuer-regle>'), b = appSrc.indexOf('// </doublons-reattribuer-regle>');
  const dCle = appSrc.indexOf('\nconst cleNum = (v) => {');
  const mCle = dCle >= 0 ? [appSrc.slice(dCle, appSrc.indexOf('\n};\n', dCle) + 4)] : null;
  vm.runInContext([appSrc.slice(deb, finPk + 3), mCle ? mCle[0] : '', appSrc.slice(a, b),
    'this.photoKey = photoKey; this.doublonsAReattribuer = doublonsAReattribuer; this.cleNum = typeof cleNum === "function" ? cleNum : null;'].join('\n'), ctx);
  // Le VRAI bloc rouge (<conflits-numeros-regle>), pour juger ce que la carte ambre lui fait taire.
  { const c1 = appSrc.indexOf('// <conflits-numeros-regle>'), c2 = appSrc.indexOf('// </conflits-numeros-regle>');
    if (c1 >= 0 && c2 > c1) vm.runInContext("const triNum = (a, b) => String(a).localeCompare(String(b), 'fr', { numeric: true });\n" + appSrc.slice(c1, c2) + '\nthis.conflitsDeNumeros = conflitsDeNumeros;', ctx); }
  const photoKey = ctx.photoKey;
  const cle = ctx.cleNum || ((v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; });

  let R = null;
  if (regleSrc != null) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-en-ligne-deux-fois-'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'enLigneDeuxFois.js'), regleSrc);
    fs.copyFileSync(path.join(__dirname, '..', 'src', 'profilVendeur.js'), path.join(dir, 'profilVendeur.js'));   // (lot vocabulaire-article) le mot du vendeur, importé par la règle
    try { R = await import(pathToFileURL(path.join(dir, 'enLigneDeuxFois.js')).href); } catch (e) { dit(false, 'la règle ne se charge pas : ' + e.message); }
  } else dit(false, 'src/enLigneDeuxFois.js absent : aucune règle « en ligne deux fois »');

  const MAINT = Date.parse('2026-11-06T12:00:00Z');
  const H = 3600e3;
  const ph = (dossier, fichier, taille = 'f800') => `https://images1.vinted.net/t/${dossier}/${taille}/${fichier}.jpeg?s=abc`;
  const ann = (id, title, photo) => ({ id, title, photo, url: `https://www.vinted.fr/items/${id}-x` });
  const compte = (uid, enLigne, o = {}) => ({ uid, nom: 'compte-' + uid, ok: true, lu: MAINT - 2 * H, enLigne, ...o });
  const lancer = (o) => R.enLigneDeuxFois({ clePhoto: photoKey, cle, maintenant: MAINT, ...o });

  if (R) {
    await essaie('A · 50 paires identiques de titre', () => {
      const fiches = {}, l1 = [], l2 = [];
      for (let i = 0; i < 50; i++) {
        const id = String(9000000 + i);
        fiches[id] = { numero: String(i + 1), photoK: `05_00${i}_dossier${i}/17000000${i}` };
        (i % 2 ? l1 : l2).push(ann(id, 'Nike Dunk Low Panda 42', ph(`05_00${i}_dossier${i}`, `17000000${i}`)));
      }
      const r = lancer({ vinted: [compte('111', l1), compte('222', l2)], fiches });
      dit(r.su === true && r.vinted.length === 0 && r.numeroSeul.length === 0, '50 annonces au même titre, N° et photos différents : AUCUN doublon (jamais le titre)', JSON.stringify(r.vinted.slice(0, 2)));
    });
    await essaie('B · même photo exacte', () => {
      const fiches = { 1001: { numero: '12', photoK: '05_aaa_d1/1700000001' }, 2001: { numero: '40', photoK: '05_aaa_d1/1700000001' } };
      const r = lancer({ vinted: [compte('111', [ann('1001', 'Air Max', ph('05_aaa_d1', '1700000001'))]), compte('222', [ann('2001', 'Autre titre', ph('05_aaa_d1', '1700000001', 'f310'))])], fiches });
      const g = r.vinted[0];
      dit(r.vinted.length === 1 && g.annonces.length === 2 && g.preuves.includes('photo') && !g.memeCompte && g.comptes.length === 2,
        'même photo exacte (deux tailles d’URL), deux comptes, N°12 et N°40 : UN groupe « photo », deux comptes', JSON.stringify(r.vinted));
      dit(g && g.numeros.join(',') === '12,40', 'le groupe nomme les deux N°', g && g.numeros.join(','));
      dit(g && g.annonces.every((x) => /^https:\/\/www\.vinted\.fr\/items\//.test(x.url)), 'chaque annonce garde son lien Vinted (le geste)');
      const r2 = lancer({ vinted: [compte('111', [ann('1001', 'A', ph('05_x', '1')), ann('1002', 'B', ph('05_y', '2'))])], fiches: { 1001: { numero: '5', photoK: '05_z/9' }, 1002: { numero: '6', photoK: '05_z/9' } } });
      dit(r2.vinted.length === 1 && r2.vinted[0].memeCompte, 'même photo par la `photoK` des fiches (photos d’URL changées), même compte : un groupe', JSON.stringify(r2.vinted));
    });
    await essaie('C · recreeDe', () => {
      const fiches = { 3001: { numero: '7', photoK: '05_r/1' }, 3002: { numero: '7', photoK: '05_s/2', recreeDe: '3001' } };
      const r = lancer({ vinted: [compte('111', [ann('3001', 'Jordan', ph('05_r', '1')), ann('3002', 'Jordan', ph('05_s', '2'))])], fiches });
      dit(r.vinted.length === 1 && r.vinted[0].preuves.join() === 'recree' && r.vinted[0].memeCompte, 'recréée par VRM, l’ancienne pas supprimée (photos différentes) : un groupe « recree »', JSON.stringify(r.vinted));
      dit(r.numeroSeul.length === 0, 'la paire recréée n’est pas « deux paires sous un N° »', JSON.stringify(r.numeroSeul));
      const r2 = lancer({ vinted: [compte('111', [ann('3002', 'Jordan', ph('05_s', '2'))])], fiches });
      dit(r2.vinted.length === 0, 'l’ancienne supprimée (plus en ligne) : rien');
    });
    await essaie('D · même N° seul', () => {
      const fiches = { 4001: { numero: '33', photoK: '05_m/1' }, 4002: { numero: '033', photoK: '05_n/2' } };
      const r = lancer({ vinted: [compte('111', [ann('4001', 'Puma', ph('05_m', '1'))]), compte('222', [ann('4002', 'Puma', ph('05_n', '2'))])], fiches });
      dit(r.vinted.length === 0, 'même N° (« 33 » et « 033 »), photos différentes : PAS « en ligne deux fois » (peut-être deux paires — le bloc rouge le dit)', JSON.stringify(r.vinted));
      dit(r.numeroSeul.length === 1 && r.numeroSeul[0].annonces.length === 2, 'rendu à part dans `numeroSeul` (déjà dit)', JSON.stringify(r.numeroSeul));
    });
    await essaie('E · même dossier', () => {
      const fiches = { 5001: { numero: '1' }, 5002: { numero: '2' } };
      const r = lancer({ vinted: [compte('111', [ann('5001', 'X', ph('05_d', '1783338221')), ann('5002', 'X', ph('05_d', '1785602038'))])], fiches });
      dit(r.vinted.length === 0, 'même dossier de photo, fichier différent : rien (le dossier n’est pas une identité)', JSON.stringify(r.vinted));
    });
    await essaie('F · lectures pas sûres', () => {
      const fiches = { 6001: { numero: '8', photoK: '05_v/1' }, 6002: { numero: '9', photoK: '05_v/1' } };
      const l1 = [ann('6001', 'V', ph('05_v', '1'))], l2 = [ann('6002', 'V', ph('05_v', '1'))];
      const vieille = lancer({ vinted: [compte('111', l1), compte('222', l2, { lu: MAINT - 30 * H })], fiches });
      dit(vieille.vinted.length === 0, 'un des deux comptes lu il y a 30 h : RIEN conclu', JSON.stringify(vieille.vinted));
      dit(vieille.manque.some((m) => m.uid === '222' && m.raison === 'lecture de plus de 24 h') && vieille.auMoins, 'le compte vieux est NOMMÉ (« lecture de plus de 24 h »), « au moins »', JSON.stringify(vieille.manque));
      const jamais = lancer({ vinted: [compte('111', l1), compte('222', l2, { lu: null })], fiches });
      dit(jamais.vinted.length === 0 && jamais.manque.some((m) => m.uid === '222' && m.raison === 'jamais lue'), 'lecture sans heure : rien conclu, nommée', JSON.stringify(jamais));
      const rate = lancer({ vinted: [compte('111', l1), compte('222', l2, { ok: false })], fiches });
      dit(rate.vinted.length === 0 && rate.manque.some((m) => m.uid === '222' && m.raison === 'lecture ratée'), 'lecture ratée : rien conclu, nommée', JSON.stringify(rate));
      const rien = lancer({ vinted: [compte('111', l1, { ok: false })], fiches });
      dit(rien.su === false, 'rien lu : su false (jamais « aucun doublon »)');
      const frais = lancer({ vinted: [compte('111', l1), compte('222', l2, { lu: MAINT - 23 * H })], fiches });
      dit(frais.vinted.length === 1, 'lue il y a 23 h : conclut', JSON.stringify(frais.vinted));
    });
    await essaie('G · plusieurs sites', () => {
      const fiches = { 7001: { numero: '15', photoK: '05_e/1' } };
      const r = lancer({ vinted: [compte('111', [ann('7001', 'Asics', ph('05_e', '1'))])], fiches, autres: { ebay: [{ id: 'e1', numero: '15', title: 'Asics' }], leboncoin: null } });
      dit(r.vinted.length === 0 && r.sites.length === 1 && r.sites[0].annonces.map((x) => x.plat).join(',') === 'vinted,ebay', 'Vinted + eBay sous le N°15 : `sites` (voulu, « Publier ailleurs »), jamais une carte', JSON.stringify(r));
      dit(r.manque.some((m) => m.plateforme === 'leboncoin' && m.raison === 'pas lu'), 'Leboncoin pas lu : nommé');
    });
    await essaie('H · texte de la carte', () => {
      const g1 = { numeros: ['12', '40'], annonces: [{ nom: 'alpha' }, { nom: 'beta' }], comptes: ['1', '2'], memeCompte: false, preuves: ['photo'] };
      const t = R.texteCarte([g1]);
      dit(t.titre === 'N°12 en ligne deux fois' && t.detail === '2 comptes · supprimes-en une', 'un groupe : « N°12 en ligne deux fois », « 2 comptes · supprimes-en une »', JSON.stringify(t));
      dit(/N°12 et N°40/.test(t.complet) && /alpha et beta/.test(t.complet) && /sur Vinted/.test(t.complet), 'l’infobulle dit tout : les deux N°, les deux comptes, Vinted', t.complet);
      dit(t.titre.length <= 26 && t.detail.length <= 30, 'titre et ligne courts (une ligne chacun à 390 px)', `${t.titre.length} / ${t.detail.length}`);
      const t2 = R.texteCarte([g1, { numeros: [], annonces: [{ nom: 'a' }, { nom: 'a' }], comptes: ['1'], memeCompte: true, preuves: ['recree'] }]);
      dit(t2.titre === '2 paires en ligne deux fois' && /sans N°/.test(t2.detail), 'deux groupes : le nombre, les N°', JSON.stringify(t2));
      dit(R.texteCarte([]) === null, 'aucun groupe : aucune carte');
    });
  }

  await essaie('I · le règlement des doublons (App.jsx)', () => {
    const f = ctx.doublonsAReattribuer;
    const conflit = (n, ids) => [{ numero: n, porteurs: ids.map((id) => ({ type: 'annonce', id })) }];
    const meme = f(conflit('21', ['8001', '8002']), { 8001: { numero: '21', photoK: '05_p/1', numberedAt: '2026-11-01' }, 8002: { numero: '21', photoK: '05_p/1', numberedAt: '2026-11-02' } });
    dit(meme.length === 0, 'deux annonces au N°21, même photo exacte : la MÊME paire, aucun numéro neuf', JSON.stringify(meme));
    const deux = f(conflit('22', ['8003', '8004']), { 8003: { numero: '22', photoK: '05_q/1', numberedAt: '2026-11-01' }, 8004: { numero: '22', photoK: '05_q/2', numberedAt: '2026-11-02' } });
    dit(deux.length === 1 && deux[0].id === '8004', 'deux annonces au N°22, photos différentes : la plus récente reçoit un numéro neuf (règle du 20 oct. inchangée)', JSON.stringify(deux));
    const sansPk = f(conflit('23', ['8005', '8006']), { 8005: { numero: '23', numberedAt: '2026-11-01' }, 8006: { numero: '23', numberedAt: '2026-11-02' } });
    dit(sansPk.length === 1, 'sans photo connue : la règle du 20 oct. joue (une absence de photo n’est pas une identité)', JSON.stringify(sansPk));
  });

  if (R) await essaie('K · le rouge se tait pour UNE paire en ligne deux fois (6 nov., finitions)', () => {
    const rouge = ctx.conflitsDeNumeros;
    if (typeof rouge !== 'function') { dit(false, 'conflitsDeNumeros introuvable'); return; }
    const sans = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const app = sans(appSrc);
    const dG = app.indexOf('const groupesDeuxFois = useMemo(');
    const corpsG = dG >= 0 ? app.slice(dG, app.indexOf('[enLigneDeux]);', dG)) : '';
    // La MÊME transformation que l'app (groupes affichés → ids) — sinon l'audit jugerait une fiction.
    const groupes = (r) => (r && Array.isArray(r.vinted) ? r.vinted.map((g) => (g.annonces || []).filter((a) => a.plat === 'vinted').map((a) => String(a.id))) : []);
    dit(/enLigneDeux\.vinted\.map\(\(g\) => \(g\.annonces \|\| \[\]\)\.filter\(\(a\) => a\.plat === 'vinted'\)\.map\(\(a\) => String\(a\.id\)\)\)/.test(corpsG) && !/numeroSeul|sites/.test(corpsG), 'les groupes sont ceux que la carte ambre AFFICHE (`enLigneDeux.vinted`), jamais `numeroSeul` ni `sites`', corpsG.slice(0, 200));
    dit(/const conflitsNum = useMemo\(\(\) => conflitsDeNumeros\(porteursNum, groupesDeuxFois\), \[porteursNum, groupesDeuxFois\]\)/.test(app) && app.indexOf('const enLigneDeux = useMemo(') < dG, 'le bloc rouge (`conflitsNum`) reçoit ces groupes ; `enLigneDeux` est calculé AVANT (TDZ)');
    const porteurs = (n, ids) => ({ [n]: ids.map((id) => ({ type: 'annonce', titre: 'Jordan', id })) });
    // recreeDe, même N° : la carte ambre le dit ⇒ pas de rouge.
    const fC = { 3001: { numero: '7', photoK: '05_r/1' }, 3002: { numero: '7', photoK: '05_s/2', recreeDe: '3001' } };
    const rC = lancer({ vinted: [compte('111', [ann('3001', 'Jordan', ph('05_r', '1')), ann('3002', 'Jordan', ph('05_s', '2'))])], fiches: fC });
    dit(rC.vinted.length === 1 && rouge(porteurs('7', ['3001', '3002']), groupes(rC)).length === 0, 'recréée (`recreeDe`), N°7 sur les deux : la carte ambre la dit ⇒ PAS de rouge', JSON.stringify(groupes(rC)));
    dit(rouge(porteurs('7', ['3001', '3002'])).length === 1, '… sans la carte : le rouge (rien n’est dispensé d’office)');
    // photo exacte, même N°.
    const fP = { 9001: { numero: '50', photoK: '05_k/1' }, 9002: { numero: '50', photoK: '05_k/1' } };
    const rP = lancer({ vinted: [compte('111', [ann('9001', 'Samba', ph('05_k', '1'))]), compte('222', [ann('9002', 'Samba', ph('05_k', '1', 'f310'))])], fiches: fP });
    dit(rP.vinted.length === 1 && rouge(porteurs('50', ['9001', '9002']), groupes(rP)).length === 0, 'même PHOTO EXACTE, N°50 sur deux comptes : la carte ambre ⇒ PAS de rouge', JSON.stringify(groupes(rP)));
    // même N° seul (photos différentes) : deux paires peut-être ⇒ rouge.
    const fD = { 4001: { numero: '33', photoK: '05_m/1' }, 4002: { numero: '33', photoK: '05_n/2' } };
    const rD = lancer({ vinted: [compte('111', [ann('4001', 'Puma', ph('05_m', '1'))]), compte('222', [ann('4002', 'Puma', ph('05_n', '2'))])], fiches: fD });
    dit(rouge(porteurs('33', ['4001', '4002']), groupes(rD)).length === 1, 'même N° seul, photos différentes : le ROUGE reste (peut-être deux paires)', JSON.stringify(groupes(rD)));
    // lecture de 30 h : la carte se tait ⇒ le rouge reste.
    const rV = lancer({ vinted: [compte('111', [ann('9001', 'Samba', ph('05_k', '1'))]), compte('222', [ann('9002', 'Samba', ph('05_k', '1'))], { lu: MAINT - 30 * H })], fiches: fP });
    dit(rV.vinted.length === 0 && rouge(porteurs('50', ['9001', '9002']), groupes(rV)).length === 1, 'un compte lu il y a 30 h : la carte se tait, le ROUGE reste (jamais les deux muets)', JSON.stringify(groupes(rV)));
    // 50 annonces au même titre sous un même N° : jamais dispensées par le titre.
    const f50 = {}, l50 = [];
    for (let i = 0; i < 50; i++) { const id = String(9100000 + i); f50[id] = { numero: '60', photoK: `05_t${i}/1` }; l50.push(ann(id, 'Nike Dunk Low Panda 42', ph(`05_t${i}`, '1'))); }
    const r50 = lancer({ vinted: [compte('111', l50)], fiches: f50 });
    dit(rouge(porteurs('60', Object.keys(f50)), groupes(r50)).length === 1, '50 annonces au même titre sous le N°60 : rouge (jamais par le titre)');
  });

  await essaie('J · Ma journée et la feuille', () => {
    const sans = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const app = sans(appSrc);
    const comp = app.slice(app.indexOf('function Comptabilite('), app.indexOf('function Comptabilite(') + 700000);   // (9 nov., lot AC) fenêtre élargie : Comptabilite a grandi
    const dMemo = comp.indexOf('const enLigneDeux = useMemo(');
    const memo = dMemo >= 0 ? comp.slice(dMemo, comp.indexOf('}, [listings, numeros', dMemo)) : '';
    dit(/enLigneDeuxFois\(\{ vinted, fiches: numeros, clePhoto: photoKey, cle: cleNum(?: \}\)|, dateDe: )/.test(memo), 'Ma journée passe par la règle avec la VRAIE clé de photo et cleNum');
    dit(/enLigne: listings\.items\.filter\(/.test(memo) && !/aConfirmer|masquees/.test(memo), 'seulement les annonces EN LIGNE (jamais « à confirmer » ni masquées)');
    dit(/lu: listings\.lues \? listings\.lues\[uid\]/.test(memo) && /ok: !ko\.has\(uid\)/.test(memo), 'chaque compte porte l’heure de SA lecture et son échec');
    dit(/!acctOff\(a\.vinted_user_id\)/.test(memo), 'les comptes écartés n’entrent pas');
    dit(/data-en-ligne-deux-fois=/.test(comp) && /\(deuxFois\.length \? 1 : 0\)/.test(comp) && /vrm-day-task-note is-urgent" data-sous-ligne="deux-fois"/.test(comp), 'la carte est dans « À faire », comptée dans les gestes, sa ligne en ambre');
    const feuille = fs.existsSync(FEUILLE) ? sans(fs.readFileSync(FEUILLE, 'utf8')) : '';
    dit(!!feuille && !/fetch\(|vmrCmd|supprimer[A-Z]\w*\(|DELETE/i.test(feuille.replace(/supprime[^(]/gi, '')), 'la feuille ne supprime RIEN (aucune requête, aucune commande) — SON clic sur Vinted');
    const feuilleBrute = fs.existsSync(FEUILLE) ? fs.readFileSync(FEUILLE, 'utf8') : '';
    dit(/target="_blank"/.test(feuilleBrute) && /https:\/\/www\.vinted\.fr\/items\//.test(feuilleBrute), 'la feuille ouvre l’annonce sur vinted.fr');
  });

  console.log(`\n${n - ko}/${n} contrôles verts`);
  process.exit(ko ? 1 : 0);
})();
