#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT : « ELLE N'EST QUE SUR CE SITE » DONNE SON N° PAR LA RÈGLE DES NUMÉROS (19 nov.)
//  EXÉCUTE `donnerNumero` (src/liaisonDonnees.js, chargé avec le parcours) avec les VRAIES
//  `cleNum`, `prochainLibre`, `entreePool`, `triPool`, `ajouterNumerosHorsEcran` d'App.jsx, sur
//  une base inventée (aucune donnée réelle : dépôt public). CLAUDE.md §5 « Les numéros » :
//    N1 après le plus haut servi, jamais dans un trou, jamais un N° d'archive (B…) ;
//    N2 le pool (append-only) reçoit le N° ; un N° du pool, d'une réserve, d'un lien Leboncoin,
//       d'une référence Vestiaire, d'une fiche à publier compte comme SERVI ;
//    N3 une lecture ratée (annonces Vestiaire, ventes Vestiaire, réserves) ⇒ RIEN donné, rien écrit ;
//    N4 une écriture de numéros en attente ⇒ rien ; « je numérote moi-même » ⇒ aucun N° neuf ;
//    N5 numérotation pas permise (marqueur 013 pas lu) / nuage pas prêt ⇒ rien.
//  `--mutation=<nom>|toutes` : réaffaiblit une garde ⇒ ROUGE.  `--src <dossier>` : un autre arbre.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
const M = 'src/liaisonDonnees.js';
const MUTATIONS = {
  lectureKO: [M, "    if (!Array.isArray(jl) || !Array.isArray(jv) || !Array.isArray(jr) || !numerotationPermise() || !isCloudReady()) return { refus: 'pas-su' };", "    if (!numerotationPermise() || !isCloudReady()) return { refus: 'pas-su' };"],
  sansPool: [M, "    if (!pool.map(cleNum).includes(cleNum(ep))) { pool.push(ep); save('vinted_used_numeros', pool.sort(triPool)); emettreClesRelues(['vinted_used_numeros']); }", ''],
  sansReserves: [M, '    numerosReserves(jr[0] ? jr[0].data : null).cles.forEach(add);', ''],
  sansLiensLbc: [M, "    Object.values(load('vrm_lbc_liens', {}) || {}).forEach(add);", ''],
  sansRefVc: [M, '    for (const it of Object.values((L0.items && typeof L0.items === \'object\') ? L0.items : {})) if (it && it.ref) add(it.ref);', ''],
  enAttente: [M, "    if (CLES_ECRITURE_NUMEROS.some((k) => saveTimers[k])) return { refus: 'pas-su' };", ''],
  ecritMoi: [M, "    if (numeroEcritActif()) return { refus: 'sans-numero' };", ''],
};
if (MUT) {
  const noms = MUT === 'toutes' ? Object.keys(MUTATIONS) : [MUT];
  let rouges = 0;
  for (const nom of noms) {
    const [f, a, b] = MUTATIONS[nom];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'liaison-num-'));
    fs.cpSync(path.join(RACINE, 'src'), path.join(tmp, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
    for (const s of ['_source-app.cjs']) if (fs.existsSync(path.join(RACINE, 'scripts', s))) fs.copyFileSync(path.join(RACINE, 'scripts', s), path.join(tmp, 'scripts', s));
    const t = fs.readFileSync(path.join(tmp, f), 'utf8');
    if (!t.includes(a)) { console.log(`❓ mutation ${nom} : texte introuvable`); fs.rmSync(tmp, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(tmp, f), t.replace(a, b));
    const r = spawnSync(process.execPath, [__filename, '--src', tmp], { encoding: 'utf8' });
    const rouge = r.status !== 0; if (rouge) rouges++;
    console.log(`${rouge ? '✅' : '❌'} mutation ${nom} ⇒ ${rouge ? 'ROUGE — ' + (r.stdout.split('\n').find((l) => l.startsWith('❌')) || '').slice(0, 120) : 'reste vert'}`);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`${rouges}/${noms.length} mutations rouges`);
  process.exit(rouges === noms.length ? 0 : 1);
}

let ko = 0, n = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${c ? '' : ' — ' + JSON.stringify(d)}`); };
(async () => {
  try {
    const { sourceApp } = require(path.join(RACINE, 'scripts', '_source-app.cjs'));
    const app = sourceApp(RACINE);
    const tranche = (debut, fin) => { const i = app.indexOf(debut); const k = i < 0 ? -1 : app.indexOf(fin, i); return i < 0 || k < 0 ? '' : app.slice(i, k + fin.length); };
    const code = [tranche('const cleNum = (v) => {', '\n};'), tranche('const NUM_OK = ', '\n'), tranche('const entreePool = (v) => {', '\n};'), tranche('const triPool = ', ';\n'),
      tranche('const prochainLibre = (prisInt, prisCles, pref) => {', '\n};'), tranche('const ajouterNumerosHorsEcran = (taken, takenK) => {', '\n};')];
    dit(code.every(Boolean), 'N0 · les vraies règles des numéros d’App.jsx se lisent (cleNum, entreePool, triPool, prochainLibre, ajouterNumerosHorsEcran)', code.map((x) => x.length));
    const { creerDonneesLiaison } = await import(path.join(RACINE, M));
    const base = (o = {}) => {
      const stock = { vinted_annonce_numeros: { 1: { numero: '12' }, 2: { numero: '40' }, 3: { numero: 'B230' } }, vinted_sale_overrides: {}, vrm_lbc_liens: { 9: '41' }, vinted_used_numeros: [1, 2, 3, 12, 40, 41, 'B230'], vrm_fiches_neuves: {}, ...(o.stock || {}) };
      const ecrits = [];
      const load = (k, d) => (k in stock ? JSON.parse(JSON.stringify(stock[k])) : d);
      const R = new Function('load', 'carteNumerosVc', 'vcCarte', 'lireStockImporte', code.join('\n') + '\nreturn { cleNum, entreePool, triPool, prochainLibre, ajouterNumerosHorsEcran };')(
        load, (c) => c || {}, () => (o.vcNumeros || {}), () => (o.importes || []));
      const reponses = { vc_listings: 'vc' in o ? o.vc : [{ items: { a: { ref: '44' } }, liens: { b: '45' } }], vc_ventes: 'ventes' in o ? o.ventes : [{ ventes: { v: { ref: '46' } } }], panel_num_reserves: 'reserves' in o ? o.reserves : [{ data: null }] };
      const D = creerDonneesLiaison({ load, lireAnnoncesVintedEnLigne: async () => ({}), chezMoiProposables: () => new Set(), chezMoiEntrees: () => [], placesAnnonces: () => ({}), ouDansMeubles: () => null,
        lireBaseRelue: async (u) => { const m = /id=eq\.([a-z_]+)/.exec(u); return m ? reponses[m[1]] : null; }, SUPABASE_URL: 'https://base.invalide',
        numeroEcritActif: () => !!o.ecritMoi, numerotationPermise: () => o.permise !== false, isCloudReady: () => o.nuage !== false, lireEnVol: (k, f) => f(), CLES_ECRITURE_NUMEROS: ['vinted_used_numeros', 'vinted_annonce_numeros'],
        saveTimers: o.timers || {}, cleNum: R.cleNum, numerosReserves: (d) => ({ cles: (d && d.cles) || [] }), ajouterNumerosHorsEcran: R.ajouterNumerosHorsEcran, prochainLibre: R.prochainLibre, prefixeNumeros: () => o.pref || '',
        entreePool: R.entreePool, save: (k, v) => { ecrits.push(k); stock[k] = v; }, triPool: R.triPool, emettreClesRelues: () => {} });
      return { D, stock, ecrits };
    };
    {
      const b = base({ stock: { vinted_used_numeros: [1, 2, 3, 12, 40, 41, 50, 'B230'] }, reserves: [{ data: { cles: ['47'] } }], importes: [{ numero: '48' }] });
      const r = await b.D.donnerNumero();
      dit(r.numero === '51' && b.stock.vinted_used_numeros.includes(51) && b.ecrits.includes('vinted_used_numeros'),
        'N1/N2 · après le plus haut SERVI (50, dans le pool sans fiche), jamais dans un trou ; le pool reçoit 51', { r: r.numero, pool: b.stock.vinted_used_numeros });
      dit(r.servis && ['44', '45', '46', '47', '48', '41', 'B230'].every((x) => r.servis.has(x)), 'N2 · référence Vestiaire, lien Vestiaire, vente Vestiaire, réserve, stock importé, lien Leboncoin, archive : tous SERVIS', r.servis && [...r.servis]);
    }
    {
      const b = base({ stock: { vinted_used_numeros: [1, 2, 3, 12, 40, 'B230'] }, reserves: [{ data: { cles: ['60'] } }] });
      const r = await b.D.donnerNumero();
      dit(r.numero === '61', 'N2 · un N° RÉSERVÉ (60) n’est jamais redonné : 61', r);
    }
    {
      const b = base({ stock: { vinted_used_numeros: [1, 2, 3, 12, 40, 'B230'], vrm_lbc_liens: { 9: '70' } } });
      dit((await b.D.donnerNumero()).numero === '71', 'N2 · le N° d’une autre annonce Leboncoin (70) est servi : 71', '');
      const c = base({ stock: { vinted_used_numeros: [1, 2, 3, 12, 40, 'B230'] }, vc: [{ items: { a: { ref: '80' } }, liens: {} }] });
      dit((await c.D.donnerNumero()).numero === '81', 'N2 · la référence d’une annonce Vestiaire (80) est servie : 81', '');
    }
    for (const [nom, o] of [['annonces Vestiaire', { vc: null }], ['ventes Vestiaire', { ventes: null }], ['réserves', { reserves: null }]]) {
      const b = base(o);
      const r = await b.D.donnerNumero();
      dit(r.refus === 'pas-su' && !b.ecrits.length, `N3 · lecture ratée (${nom}) ⇒ RIEN donné, rien écrit`, r);
    }
    {
      const b = base({ timers: { vinted_annonce_numeros: 1 } });
      const r = await b.D.donnerNumero();
      dit(r.refus === 'pas-su' && !b.ecrits.length, 'N4 · une écriture de numéros en attente ⇒ rien', r);
      const c = base({ ecritMoi: true });
      const r2 = await c.D.donnerNumero();
      dit(r2.refus === 'sans-numero' && !c.ecrits.length, 'N4 · « je numérote moi-même » ⇒ aucun N° neuf', r2);
      const d = base({ permise: false }), e = base({ nuage: false });
      const r3 = await d.D.donnerNumero(), r4 = await e.D.donnerNumero();
      dit(r3.refus === 'pas-su' && r4.refus === 'pas-su' && !d.ecrits.length && !e.ecrits.length, 'N5 · numérotation pas permise / nuage pas prêt ⇒ rien', { r3, r4 });
    }
    {
      const b = base({ pref: 'C', stock: { vinted_used_numeros: [1, 'C1', 'C2', 'B230'], vinted_annonce_numeros: { 1: { numero: 'C2' } } } });
      const r = await b.D.donnerNumero();
      dit(r.numero === 'C3' && b.stock.vinted_used_numeros.includes('C3'), 'N1 · série à lettres choisie (C) : C3, jamais une série « B » (archive)', r);
    }
  } catch (e) { dit(false, 'donnerNumero s’exécute (src/liaisonDonnees.js)', String((e && e.stack) || e).slice(0, 300)); }
  console.log(`\n${ko ? '❌' : '✅'} audit-liaison-numero : ${ko ? ko + ' rouge(s) sur ' + n : n + ' contrôles verts'}`);
  process.exit(ko ? 1 : 0);
})();
