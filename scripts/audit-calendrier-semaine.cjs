// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LES 7 PROCHAINS JOURS DES COLIS (23 nov., lot calendrier-semaine)
// Il EXÉCUTE la vraie règle (src/calendrierSemaine.js, sur api/_lib/retrait-colis.js et api/_lib/bilan-semaine.js)
// sur des publications INVENTÉES à la forme réelle (`vrm_colis_aposter.liste`, `vrm_colis_retirer.colis`) :
//   C1 un envoi à la date LUE est rangé à SON jour ; une date ESTIMÉE est marquée « estimée » ; une estimation passée
//      n'est JAMAIS « en retard » ; une limite lue et dépassée l'est ;
//   C2 un retrait : la limite LUE ([0]) ; sinon le jour de PARIS de `limiteAt` ; sinon l'estimation arrivée + la garde
//      de SON transporteur ; transporteur inconnu ⇒ « sans date » (jamais une garde prêtée) ;
//   C3 la semaine = 7 jours de PARIS à partir d'aujourd'hui (23 h 30 UTC = le lendemain à Paris) ; au-delà « plus tard » ;
//   C4 « pas su » : une publication absente ⇒ pasSu, jamais une semaine vide prise pour « rien » ; les autres sites :
//      leur NOMBRE, sans jour inventé ;
//   C5 rien n'est perdu : chaque colis publié ressort UNE fois (jour, retard, estimation passée, plus tard, sans date) ;
//   C6 la vue ne calcule aucune date ; un envoi ouvre la fiche de SON N° (`vrm:fiche-paire`), jamais par titre ;
//      la feuille est montée depuis Aujourd'hui ; chaque texte dans les cinq langues.
// Lancer : node scripts/audit-calendrier-semaine.cjs [--mutation=<nom>]  (chaque mutation doit rougir)
//   mutations : estimee-retard garde-pretee utc perdu passu vue-date titre
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const R = process.env.VRM_RACINE || path.join(__dirname, '..');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + (typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 400) : '')); };

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cal-'));
for (const d of ['src', 'api/_lib']) fs.cpSync(path.join(R, d), path.join(T, d), { recursive: true, filter: (s) => !/\.(png|jpe?g|webp|mp4|onnx|woff2?)$/i.test(s) });
fs.writeFileSync(path.join(T, 'package.json'), '{"type":"module"}');
const MUTS = {
  'estimee-retard': ['src/calendrierSemaine.js', 'retard: !!x.retard && !x.estimee', 'retard: !!x.retard || (!!x.estimee && str(x.jour) < jourDe(Date.now()))'],
  'garde-pretee': ['src/calendrierSemaine.js', "const e = limiteEstimee({ arriveeMs: Number(c[1]) || null, transporteur });", "const e = limiteEstimee({ arriveeMs: Number(c[1]) || null, transporteur: transporteur || 'mondialrelay' }) || limiteEstimee({ arriveeMs: Number(c[1]) || null, transporteur: 'mondialrelay' });"],
  utc: ['src/calendrierSemaine.js', 'const auj = jourDe(maintenant);', 'const auj = new Date(maintenant).toISOString().slice(0, 10);'],
  perdu: ['src/calendrierSemaine.js', "    if (!x.jour) { sansDate[cle].push(x); return; }", "    if (!x.jour) return;"],
  passu: ['src/calendrierSemaine.js', 'pasSu: { envois: !envoisLus, retraits: !retraitsLus },', 'pasSu: { envois: false, retraits: false },'],
  'vue-date': ['src/calendrierSemaine/CalendrierSemaine.jsx', "const estimee = x.estimee ?", "const estimee = (x.estimee || Date.parse(x.jour) < Date.now()) ?"],
  titre: ['src/calendrierSemaine/CalendrierSemaine.jsx', "onClick={x.num ? ouvrirFiche(x.num) : versColis}", "onClick={ouvrirFiche(x.num || x.nom)}"],
};
if (MUT) {
  const m = MUTS[MUT];
  if (!m) { console.log('❌ mutation inconnue : ' + MUT); process.exit(2); }
  const f = path.join(T, m[0]); const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(m[1])) { console.log('❌ mutation impossible : motif absent — ' + m[1].slice(0, 90)); process.exit(2); }
  fs.writeFileSync(f, s.replace(m[1], m[2]));
  console.log('… mutation « ' + MUT + ' » posée');
}
const sansCommentaires = (f) => fs.readFileSync(path.join(T, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

(async () => {
  let C;
  try { C = await import(pathToFileURL(path.join(T, 'src/calendrierSemaine.js')).href); } catch (e) { dit(false, 'src/calendrierSemaine.js se charge', String(e.message).slice(0, 200)); return fin(); }
  // Le 23 nov. 2026 à 23 h 30 UTC = le 24 nov., 0 h 30 à Paris : la semaine commence le 24.
  const M = Date.parse('2026-11-23T23:30:00Z');
  const aposter = { total: 9, vinted: 7, ebay: 2, leboncoin: 0, vestiaire: null, at: M - 3600000, liste: [
    { nom: 'Nike Air Max 90 blanche 42', num: '12', jour: '2026-11-24', heure: '', estimee: false, retard: false },        // aujourd'hui (Paris), lue
    { nom: 'Nike Air Max 90 blanche 42', num: '13', jour: '2026-11-26', heure: '', estimee: true, retard: false },         // estimée
    { nom: 'Nike Air Max 90 blanche 42', num: '14', jour: '2026-11-20', heure: '', estimee: true, retard: false },         // estimation passée
    { nom: 'Adidas Samba 40', num: '15', jour: '2026-11-22', heure: '', estimee: false, retard: true },                     // lue, dépassée
    { nom: 'Asics Gel 44', num: '', jour: '2026-11-30', heure: '12:00', estimee: false, retard: false },                   // dernier jour (24 + 6)
    { nom: 'New Balance 550', num: 'B230', jour: '2026-12-01', heure: '', estimee: false, retard: false },                // plus tard
    { nom: 'Puma Suede', num: '17', jour: '', heure: '', estimee: true, retard: false },                                  // sans date
  ] };
  const arr = Date.parse('2026-11-21T09:00:00Z');
  const retirer = { total: 5, at: M - 7200000, colis: [
    ['2026-11-25', arr, 'mondialrelay', 'e:MR1', 1, '', '', 'Colis A'],                    // limite lue
    ['', arr, 'vinted', 'e:VG1', 1, '', '2026-11-26T23:15:00Z', 'Colis B'],                // limiteAt seul : 27 à Paris
    ['', arr, 'mondialrelay', 'e:MR2', 1, '', '', 'Colis C'],                              // estimée : 21 + 5 = 26
    ['', arr, 'colissimo', 'e:CO1', 1, '', '', 'Colis D'],                                 // transporteur sans garde mesurée : sans date
    ['', 0, 'chronopost', 'e:CH1', 0, '', '', 'Colis E'],                                  // pas d'arrivée : sans date
  ] };
  const S = C.calendrierSemaine({ aposter, retirer, maintenant: M });
  const tous = (k) => [...S.jours.flatMap((j) => j[k]), ...S.avant[k], ...S.plusTard[k], ...S.sansDate[k]];
  const trouve = (k, f) => { for (const j of S.jours) { const x = j[k].find(f); if (x) return { ou: j.jour, x }; } for (const g of ['avant', 'plusTard', 'sansDate']) { const x = S[g][k].find(f); if (x) return { ou: g, x }; } return null; };

  console.log('── C3. La semaine de Paris');
  dit(S.jours.length === 7 && S.jours[0].jour === '2026-11-24' && S.jours[6].jour === '2026-11-30' && S.jours[0].aujourdhui, 'C3 7 jours, du 24 au 30 (23 h 30 UTC = le 24 à Paris)', S.jours.map((j) => j.jour));

  console.log('── C1. Les envois');
  const e12 = trouve('envois', (x) => x.num === '12'), e13 = trouve('envois', (x) => x.num === '13'), e14 = trouve('envois', (x) => x.num === '14'), e15 = trouve('envois', (x) => x.num === '15');
  dit(e12 && e12.ou === '2026-11-24' && !e12.x.estimee, 'C1 la date lue : rangé à SON jour', e12);
  dit(e13 && e13.ou === '2026-11-26' && e13.x.estimee === true, 'C1b une date estimée est marquée « estimée »', e13);
  dit(e14 && e14.ou === 'avant' && e14.x.estimee && e14.x.retard === false, 'C1c une estimation passée n’est JAMAIS « en retard »', e14);
  dit(e15 && e15.ou === 'avant' && e15.x.retard === true && !e15.x.estimee, 'C1d une limite lue et dépassée est en retard', e15);
  const e30 = trouve('envois', (x) => x.nom === 'Asics Gel 44'), eB = trouve('envois', (x) => x.num === 'B230'), e17 = trouve('envois', (x) => x.num === '17');
  dit(e30 && e30.ou === '2026-11-30' && eB && eB.ou === 'plusTard' && e17 && e17.ou === 'sansDate', 'C3b le dernier jour, « plus tard », « sans date »', [e30 && e30.ou, eB && eB.ou, e17 && e17.ou]);

  console.log('── C2. Les retraits');
  const r = (id) => trouve('retraits', (x) => x.id === id);
  dit(r('e:MR1') && r('e:MR1').ou === '2026-11-25' && !r('e:MR1').x.estimee, 'C2 la limite LUE', r('e:MR1'));
  dit(r('e:VG1') && r('e:VG1').ou === '2026-11-27' && !r('e:VG1').x.estimee, 'C2b `limiteAt` seul : le jour de PARIS (23 h 15 UTC le 26 = le 27)', r('e:VG1'));
  dit(r('e:MR2') && r('e:MR2').ou === '2026-11-26' && r('e:MR2').x.estimee === true, 'C2c sans limite : arrivée + la garde de SON transporteur, « estimée »', r('e:MR2'));
  dit(r('e:CO1') && r('e:CO1').ou === 'sansDate' && r('e:CH1') && r('e:CH1').ou === 'sansDate', 'C2d transporteur sans garde mesurée, ou pas d’arrivée : « sans date » (jamais une garde prêtée)', [r('e:CO1'), r('e:CH1')]);

  console.log('── C4-C5. Pas su, rien perdu');
  dit(tous('envois').length === aposter.liste.length && tous('retraits').length === retirer.colis.length, 'C5 chaque colis publié ressort une fois', [tous('envois').length, tous('retraits').length]);
  const V = C.calendrierSemaine({ aposter: null, retirer: null, maintenant: M });
  dit(V.pasSu.envois && V.pasSu.retraits && V.autres === null, 'C4 publications absentes ⇒ « pas su » (jamais une semaine vide prise pour « rien »)', V.pasSu);
  dit(S.autres && S.autres.ebay === 2 && S.autres.leboncoin === 0 && S.autres.vestiaire === null && !S.pasSu.envois, 'C4b les autres sites : leur nombre lu (null = pas lu), sans jour inventé', S.autres);

  console.log('── C6. La vue et son branchement');
  const vue = sansCommentaires('src/calendrierSemaine/CalendrierSemaine.jsx');
  dit(!/Date\.parse|limiteEstimee|plusJours|Date\.now\(\)/.test(vue) && /calendrierSemaine\(/.test(vue), 'C6 la vue ne calcule aucune date (tout vient de la règle)');
  dit(/onClick=\{x\.num \? ouvrirFiche\(x\.num\) : versColis\}/.test(vue) && /'vrm:fiche-paire', \{ detail: String\(num\) \}/.test(vue), 'C6b un envoi ouvre la fiche de SON N° ; sans N°, Colis (jamais un titre)');
  const br = sansCommentaires('src/aujourdhui/Branche.jsx'), au = sansCommentaires('src/natif/ecrans/Aujourdhui.jsx');
  dit(/<CalendrierSemaine /.test(br) && /semaine=\{/.test(br) && /data-cal-ouvrir/.test(au) && /onClick=\{semaine\.ouvrir\}/.test(au), 'C6c la feuille est montée depuis Aujourd’hui (ligne « Les 7 prochains jours »)');
  const cles = [...new Set([...vue.matchAll(/tr\('([^']+)'/g)].map((m) => m[1]).filter((k) => k.startsWith('cal.') && !k.endsWith('.')))].concat(['cal.ligne', 'cal.ligneSous', 'cal.autreSite.ebay', 'cal.autreSite.leboncoin', 'cal.autreSite.vestiaire']);
  const manque = [];
  for (const l of ['fr', 'en', 'es', 'it', 'de']) { const t = fs.readFileSync(path.join(T, `src/i18n/langues/${l}/colisplus.js`), 'utf8'); for (const k of cles) if (!t.includes(JSON.stringify(k))) manque.push(l + ':' + k); }
  dit(manque.length === 0, `C6d chaque texte dans les cinq langues (${cles.length} clés)`, manque);
  fin();
})().catch((e) => { dit(false, 'exécution', String(e && e.stack || e).slice(0, 400)); fin(); });

function fin() {
  try { fs.rmSync(T, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ko ? '❌' : '✅'} audit-calendrier-semaine : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
}
