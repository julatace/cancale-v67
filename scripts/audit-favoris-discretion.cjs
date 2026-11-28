#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  5.455.7 (Julien, 27 nov. 23:10 : « pouvoir envoyer plein de messages aux favoris sans crainte de se faire embêter »)
//  LA DISCRÉTION, DE BOUT EN BOUT — un AUDIT, aucun réglage relâché (CLAUDE.md §3 « Plafond d'actions », « Discrétion »).
//  Exécuté sur le vrai background.js (scripts/_fond-vm.cjs) et la vraie file du serveur :
//   D1 la pause entre deux favoris : 20 à 60 s par défaut, au hasard, jamais deux fois de suite la même (500 tirages)
//   D2 les défauts de SA cadence : 15 favoris/h, 50 actions/h, pause 20–60 s ; plafond dur 15/h ; réserve 5 ; plafond du jour
//   D3 le temps d'écriture : 5 à 45 s pour une série, toujours tiré
//   D4 pause sur 403 et 429, arrêt sur une vérification (captcha / activité automatisée) — et la file s'arrête (rien de plus)
//   D5 une requête à la fois et le compte de l'onglet : chaque écriture des favoris passe par `vintedPageFavori`
//      (`requeteVinted` + `pageVintedPour`), la garde de l'onglet avant chaque écriture
//   D6 un compte à la fois : une seule file menée par ce navigateur (la carte refuse un 2ᵉ lancement)
//   D7 aucun maquillage refusé au §3 : ni permission `debugger`, ni réécriture d'`isTrusted`, ni empreinte / IP par compte
//  `--mutation=nom` ; `--prouve`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process'), vm = require('vm');
const RACINE = path.join(__dirname, '..');
let BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const MUTATIONS = {
  'pause-fixe': ['bg', "const RA_CADENCE_DEFAUT = { favorisHeure: 15, actionsHeure: 50, parJour: null, pauseMin: 20, pauseMax: 60 };", "const RA_CADENCE_DEFAUT = { favorisHeure: 15, actionsHeure: 50, parJour: null, pauseMin: 20, pauseMax: 20 };"],
  'plafond-30': ['bg', 'const FAVORIS_HEURE_MAX = 15;', 'const FAVORIS_HEURE_MAX = 30;'],
  '403-sans-pause': ['bg', "  if (r.status === 403) return 'vinted_frein';", ''],
  'ecriture-hors-file': ['bg', "  return requeteVinted('api', async () => {\n    const pg = await pageVintedPour(acc);\n    if (pg.refus) { noterDiag('page_' + pg.refus); return { status: 0, ok: false, json: null, rienParti: true, sansPage: pg.refus }; }\n    try {\n      const res = await executerMain(pg.tabId, async (adr, json, csrfFond, delai) => {", "  return (async (_, f) => f())('api', async () => {\n    const pg = await pageVintedPour(acc);\n    if (pg.refus) { noterDiag('page_' + pg.refus); return { status: 0, ok: false, json: null, rienParti: true, sansPage: pg.refus }; }\n    try {\n      const res = await executerMain(pg.tabId, async (adr, json, csrfFond, delai) => {"],
};
const argMut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) { const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' }); const rouge = r.status === 1 && /❌ D\d/.test(r.stdout || ''); console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`); if (!rouge) rate++; }
  process.exit(rate ? 1 : 0);
}
if (argMut) {
  const M = MUTATIONS[argMut]; if (!M) { console.log('mutation inconnue'); process.exit(2); }
  const s = fs.readFileSync(BG, 'utf8'); if (!s.includes(M[1])) { console.log('mutation introuvable : ' + argMut); process.exit(2); }
  const dest = path.join(os.tmpdir(), `bg-discretion-${argMut}-${process.pid}.js`); fs.writeFileSync(dest, s.split(M[1]).join(M[2])); BG = dest;
  process.on('exit', () => { try { fs.unlinkSync(dest); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };
(async () => {
  const { faireFond } = require('./_fond-vm.cjs');
  const UID = '111', ACC = { vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' };
  const f = faireFond({ src: BG, connecte: UID, comptes: [ACC], lignes: {}, store: { __commeBleamDefaut: true, __favorisVintex: true } });
  const V = (expr) => vm.runInContext(expr, f.ctx);
  const src = fs.readFileSync(BG, 'utf8');
  // D1 : la pause par défaut (la plage de SA cadence, tirée par le serveur)
  const { delaiRythme, plageValide } = await import(path.join(RACINE, 'api', '_lib', 'favoris-file.js'));
  const cad = V('RA_CADENCE_DEFAUT'), plage = plageValide({ min: cad.pauseMin * 1000, max: cad.pauseMax * 1000 });
  let prec = null, mini = Infinity, maxi = 0, deux = 0;
  for (let i = 0; i < 500; i++) { const d = plage ? delaiRythme(plage, 'jeton-' + i, prec) : null; if (d == null) { deux = -1; break; } if (d === prec) deux++; mini = Math.min(mini, d); maxi = Math.max(maxi, d); prec = d; }
  dit(plage && deux === 0 && mini >= 20000 && maxi <= 60000 && maxi - mini >= 30000, `D1 pause entre deux favoris : ${mini / 1000}–${maxi / 1000} s au hasard, jamais deux fois de suite la même (500 tirages)`, JSON.stringify({ plage, deux, mini, maxi }));
  // D2 : les défauts et les plafonds durs
  dit(cad.favorisHeure === 15 && cad.actionsHeure === 50 && cad.pauseMin === 20 && cad.pauseMax === 60 && V('FAVORIS_HEURE_MAX') === 15 && V('RESERVE_GESTES') === 5 && V('DISCRETION_JOUR_DEFAUT') > 0,
    'D2 défauts inchangés : 15 favoris/h, 50 actions/h, pause 20–60 s ; plafond dur 15/h ; réserve 5 ; plafond du jour', JSON.stringify({ cad, max: V('FAVORIS_HEURE_MAX'), res: V('RESERVE_GESTES'), jour: V('DISCRETION_JOUR_DEFAUT') }));
  // D3 : le temps d'écriture
  const te = [0, 0.5, 0.99].map((h) => V('tempsEcritureMs')('x'.repeat(120), 'serie', () => h)), court = V('tempsEcritureMs')('ok', 'serie', () => 0), long = V('tempsEcritureMs')('x'.repeat(5000), 'serie', () => 1);
  dit(te.every((x) => x >= 5000 && x <= 45000) && court === 5000 && long === 45000 && new Set(te).size === 3, `D3 temps d'écriture tiré, 5 à 45 s (${te.map((x) => Math.round(x / 1000)).join(' / ')} s)`, JSON.stringify({ te, court, long }));
  // D4 : 403, 429, vérification
  const fr = V('freinFavoriAuto');
  const r403 = fr({ status: 403, ok: false, json: {} }), r429 = fr({ status: 429, ok: false, json: {} }), rcap = fr({ status: 403, ok: false, json: { message: 'captcha-delivery datadome' } }), r200 = fr({ status: 200, ok: true, json: { is_suspicious: false } });
  const carte = src.slice(src.indexOf('async function tickFavorisCarte'), src.indexOf('async function favorisPourCarte'));
  dit(r403 === 'vinted_frein' && r429 === 'pause_vinted' && rcap === 'vinted_robot' && r200 === '' && /raison === 'vinted_robot'[\s\S]{0,1200}st2\.robot = \{ at: Date\.now\(\) \}/.test(carte),
    'D4 403 ⇒ pause, 429 ⇒ pause, vérification ⇒ arrêt et la file en pause jusqu’à SON « Reprendre » ; une réponse normale n’est jamais un frein', JSON.stringify({ r403, r429, rcap, r200 }));
  // D5 : une requête à la fois, le compte de l'onglet, la garde avant chaque écriture. 5.455.8 (reprise) : 5 appels, toujours les 3
  //    mêmes écritures — la demande refaite UNE fois après la page ramenée (rien n'était parti), l'offre posée APRÈS le message
  //    quand sa boîte manquait (jamais deux offres : registre) ; tous par `vintedPageFavori`, aucun autre chemin d'écriture.
  const vpf = src.slice(src.indexOf('async function vintedPageFavori('), src.indexOf('async function telephoneAVerifierVinted('));
  const chemin = src.slice(src.indexOf("if((await cheminFavoris())==='requetes'){"), src.indexOf("// 5.410.8 (export de l'Observateur, 21 nov. : « Bleam appuie sur la cloche »)"));
  const ecritures = (chemin.match(/vintedPageFavori\(/g) || []).length, autres = (chemin.match(/vintedPage\(acc,'(POST|PUT|DELETE)'/g) || []).length;
  dit(/return requeteVinted\('api', async \(\) => \{\s*const pg = await pageVintedPour\(acc\);/.test(vpf) && ecritures === 5 && autres === 0 && (chemin.match(/await garde\(\)/g) || []).length >= 3 && /if \(!ecritureFavoriPermise\(adresse\)\)/.test(vpf),
    `D5 les 3 écritures (demande, offre, message) passent par la file Vinted (une requête à la fois) depuis l’onglet du compte, la garde de l’onglet relue avant chacune, liste blanche`, JSON.stringify({ ecritures, autres }));
  // D6 : un compte à la fois (une seule file menée par ce navigateur)
  const lancer = src.slice(src.indexOf("if (quoi === 'lancer') {"), src.indexOf("if (quoi === 'arreter') {"));
  // 5.455.8 : une 2ᵉ sélection du MÊME compte s'AJOUTE à la file menée (une seule file, une requête à la fois) ; un AUTRE compte
  //    est refusé tant qu'une file est menée ; le mode auto attend.
  dit(/if \(avant && avant\.actif && avant\.uid !== o\.uid\) return refuse\('deja'/.test(lancer) && /if \(carte && carte\.actif\) return fin\('occupe'\)/.test(src), 'D6 un compte à la fois : une file menée sur un compte refuse un envoi d’un autre compte (le même compte s’y ajoute) ; le mode auto attend');
  // D7 : rien de ce que le §3 refuse
  const man = JSON.parse(fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', 'manifest.json'), 'utf8'));
  const tous = fs.readdirSync(path.join(RACINE, 'vinted-sync-extension')).filter((x) => x.endsWith('.js') && !/pdf-lib/.test(x)).map((x) => fs.readFileSync(path.join(RACINE, 'vinted-sync-extension', x), 'utf8')).join('\n');
  dit(!(man.permissions || []).includes('debugger') && !/chrome\.debugger\./.test(tous) && !/defineProperty\([^)]{0,80}['"]isTrusted['"]/.test(tous), 'D7 aucun maquillage (§3) : ni `debugger`, ni `isTrusted` réécrit');
  console.log(ko ? `❌ discrétion des favoris : ${ko} rouge(s), ${ok} vert(s)` : `✅ discrétion des favoris : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ D0 a levé : ' + (e && e.stack || e)); process.exit(1); });
