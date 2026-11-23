// ════════════════════════════════════════════════════════════════════════════
//  « MESSAGES AUX FAVORIS → VENTES OBTENUES » (21 nov., ext. 5.420) — la règle <favoris-ventes-regle>
//  EXÉCUTE la règle telle qu'elle est dans src/favorisVentes.js ET dans vinted-sync-extension/background.js :
//   V1. les deux copies sont identiques (`--recopie` la refait dans background.js) ;
//   V2. attribution PAR IDENTITÉ : 50 annonces au même titre, une seule vendue ⇒ seule l'annonce du message compte ;
//   V3. la fenêtre de 14 j (15 j ⇒ « sans contact ») et l'envoi APRÈS la vente ⇒ rien ;
//   V4. même acheteur si lu des deux côtés (un autre acheteur ⇒ « sans contact ») ;
//   V5. répartition : message seul · message + offre acceptée · offre de l'acheteur · sans contact ;
//   V6. date incertaine ⇒ dans aucune fenêtre, comptée à part (« au moins ») ;
//   V7. moins de 3 cas ⇒ délai, remise et taux `null` (« — ») ; 3 cas ⇒ valeurs exactes ;
//   V8. entonnoir par compte et par version, envois « auto » comptés ; bénéfice partiel dit.
//  `--prouve` : chaque mutation de la règle rend l'audit rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const F_SRC = path.join(R, 'src', 'favorisVentes.js'), F_BG = path.join(R, 'vinted-sync-extension', 'background.js');
const DEB = '// <favoris-ventes-regle>', FIN = '// </favoris-ventes-regle>';
const bloc = (s) => { const a = s.indexOf(DEB), b = s.indexOf(FIN); return a >= 0 && b > a ? s.slice(a, b + FIN.length) : null; };
const args = process.argv.slice(2);
if (args.includes('--recopie')) {
  const b = bloc(fs.readFileSync(F_SRC, 'utf8'));
  let bg = fs.readFileSync(F_BG, 'utf8');
  if (bloc(bg)) bg = bg.replace(bloc(bg), b);
  else { const ancre = '// </favoris-perso-regle>'; if (!bg.includes(ancre)) { console.log('ancre absente'); process.exit(1); } bg = bg.replace(ancre, ancre + '\n// 5.420 (`favorisreponses`) : LA règle des ventes obtenues par les messages aux favoris — copie de src/favorisVentes.js.\n' + b); }
  fs.writeFileSync(F_BG, bg); console.log('✅ bloc <favoris-ventes-regle> recopié dans background.js'); process.exit(0);
}
const MUTATIONS = {
  identite: ["if (!e || String(e.i || '') !== item) continue;", 'if (!e) continue;'],
  fenetre: ['ts - t > FV_JOURS * 864e5', 'ts - t > 400 * 864e5'],
  apres: ['if (t == null || t > ts ||', 'if (t == null ||'],
  acheteur: ["if (v.acheteur && e.a && String(v.acheteur) !== String(e.a)) continue;", ''],
  incertaine: ["if (ts == null || v.dateSure === false) { if (contactees.has(String(v.item))) incertaines += 1; continue; }", 'if (ts == null) continue;'],
  troisCas: ['(l.length >= FV_MIN_CAS ?', '(l.length >= 1 ?'],
  offre: ["e.oa ? 'message_offre' : e.ob ? 'offre_acheteur'", "e.ob ? 'offre_acheteur' : e.oa ? 'message_offre'"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 60000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  process.exit(rates ? 1 : 0);
}
let ok = 0, ko = 0;
const dit = (b, quoi, d) => { if (b) { ok++; console.log('  ✅ ' + quoi); } else { ko++; console.log('  ❌ ' + quoi + (d ? ' — ' + String(d).slice(0, 300) : '')); } };
const src = fs.readFileSync(F_SRC, 'utf8'), bg = fs.readFileSync(F_BG, 'utf8');
dit(bloc(src) && bloc(bg) && bloc(src) === bloc(bg), 'V1 le bloc est le même dans src/favorisVentes.js et background.js (--recopie)');
let B = bloc(src) || '';
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) { const [x, y] = MUTATIONS[mut]; if (!B.includes(x)) { console.log('mutation introuvable ' + mut); process.exit(2); } B = B.replace(x, y); }
const ctx = {}; vm.createContext(ctx); vm.runInContext(B + '\n;globalThis.__f = { attribuerVentesFavoris };', ctx);
const { attribuerVentesFavoris: A } = ctx.__f;
const J = 864e5, T0 = Date.UTC(2026, 10, 1), de = T0 - 30 * J, a = T0 + 30 * J;
// V2 : 50 annonces identiques (le titre n'est jamais lu), un message sur l'annonce 1007, la vente de 1007 et de 1008.
{
  const envois = [{ t: T0, k: 'u1', i: '1007', compte: 'c1' }];
  const ventes = Array.from({ length: 50 }, (_, n) => ({ item: String(1000 + n), titre: 'Nike Air Max 90 T42', ts: n === 7 || n === 8 ? T0 + 2 * J : null, dateSure: n === 7 || n === 8 })).filter((v) => v.ts);
  const r = A({ envois, ventes, de, a });
  dit(r.attribuees.n === 1 && r.repartition.message_seul === 1 && r.repartition.sans_contact === 1, 'V2 seule la vente de l’annonce du message est attribuée (identité, jamais le titre)', JSON.stringify(r.repartition));
}
// V3 : 14 j oui, 15 j non ; envoi après la vente ⇒ rien.
{
  const r = A({ envois: [{ t: T0, i: '1', compte: 'c' }, { t: T0, i: '2', compte: 'c' }, { t: T0 + 3 * J, i: '3', compte: 'c' }], ventes: [{ item: '1', ts: T0 + 14 * J - 1000 }, { item: '2', ts: T0 + 15 * J }, { item: '3', ts: T0 + 2 * J }], de, a });
  dit(r.repartition.message_seul === 1 && r.repartition.sans_contact === 2, 'V3 fenêtre de 14 jours, et un message parti APRÈS la vente n’en est pas la cause', JSON.stringify(r.repartition));
}
// V4 : acheteur lu des deux côtés.
{
  const r = A({ envois: [{ t: T0, i: '1', a: '77' }, { t: T0, i: '2', a: '77' }, { t: T0, i: '3' }], ventes: [{ item: '1', ts: T0 + J, acheteur: '77' }, { item: '2', ts: T0 + J, acheteur: '88' }, { item: '3', ts: T0 + J, acheteur: '88' }], de, a });
  dit(r.attribuees.n === 2 && r.repartition.sans_contact === 1, 'V4 un AUTRE acheteur lu ⇒ pas attribuée ; acheteur pas lu d’un côté ⇒ l’annonce seule décide', JSON.stringify(r.repartition));
}
// V5 : les catégories.
{
  const r = A({ envois: [{ t: T0, i: '1' }, { t: T0, i: '2', oa: 1, ob: 1 }, { t: T0, i: '3', ob: 1 }], ventes: [{ item: '1', ts: T0 + J }, { item: '2', ts: T0 + J }, { item: '3', ts: T0 + J }, { item: '4', ts: T0 + J }], de, a });
  const p = r.repartition;
  dit(p.message_seul === 1 && p.message_offre === 1 && p.offre_acheteur === 1 && p.sans_contact === 1, 'V5 message seul · message + offre acceptée · offre de l’acheteur · sans contact', JSON.stringify(p));
}
// V6 : date incertaine.
{
  const r = A({ envois: [{ t: T0, i: '1' }], ventes: [{ item: '1', ts: T0 + J, dateSure: false }, { item: '9', ts: null }], de, a });
  dit(r.incertaines === 1 && r.attribuees.n === 0 && r.repartition.sans_contact === 0, 'V6 une vente sans date sûre n’entre dans aucune fenêtre, comptée à part si l’annonce a été contactée', JSON.stringify(r));
}
// V7 : 2 cas ⇒ null ; 3 cas ⇒ délai et remise exacts.
{
  const E = [{ t: T0, i: '1' }, { t: T0, i: '2' }, { t: T0, i: '3' }];
  const V2 = [{ item: '1', ts: T0 + 2 * J, montant: 45, prixAnnonce: 50 }, { item: '2', ts: T0 + 4 * J, montant: 40, prixAnnonce: 50 }];
  const r2 = A({ envois: E, ventes: V2, de, a });
  dit(r2.attribuees.delaiMoyenJours === null && r2.attribuees.remiseMoyennePct === null && r2.tauxVente === 67 && A({ envois: E.slice(0, 2), ventes: V2, de, a }).tauxVente === null, 'V7 moins de 3 cas ⇒ délai, remise et taux « — » (le taux sur 3 contacts existe : 67 %)', JSON.stringify(r2.attribuees));
  const r3 = A({ envois: E, ventes: V2.concat([{ item: '3', ts: T0 + 6 * J, montant: 50, prixAnnonce: 50 }]), de, a });
  dit(r3.attribuees.delaiMoyenJours === 4 && r3.attribuees.remiseMoyennePct === 10 && r3.tauxVente === 100 && r3.attribuees.ca === 135, 'V7 3 cas ⇒ délai moyen 4 j, remise moyenne 10 %, CA 135 €', JSON.stringify(r3.attribuees));
}
// V8 : entonnoir par compte et par version, auto, bénéfice partiel.
{
  const envois = [{ t: T0, i: '1', k: 'u1', compte: 'A', r: T0 + 1000, l: T0 + 2000, au: 1 }, { t: T0, i: '2', k: 'u2', compte: 'B', l: T0 + 1000 }, { t: T0, i: '3', k: 'u1', compte: 'A', oa: 1, r: T0 + 5 }, { t: T0 - 60 * J, i: '4', k: 'u1', compte: 'A' }];
  const r = A({ envois, ventes: [{ item: '1', ts: T0 + J, compte: 'A', montant: 30, benefice: 10 }, { item: '3', ts: T0 + J, compte: 'A', montant: 30, benefice: null }], de, a });
  dit(r.total.contactes === 3 && r.parCompte.A.contactes === 2 && r.parCompte.B.contactes === 1 && r.parVersion.u1.ventes === 2 && r.parVersion.u2.ventes === 0, 'V8 entonnoir par compte et par version (un envoi hors fenêtre ne compte pas)', JSON.stringify(r.parVersion));
  dit(r.total.reponses === 2 && r.total.relues === 3 && r.total.offresAcceptees === 1 && r.total.auto === 1 && r.attribuees.auto === 1, 'V8 réponses sur les fils relus, offres acceptées, envois automatiques comptés', JSON.stringify(r.total));
  dit(r.attribuees.benefice === 10 && r.attribuees.beneficePartiel === true && r.attribuees.beneficeN === 1, 'V8 bénéfice des ventes attribuées : « au moins », sur 1 des 2', JSON.stringify(r.attribuees));
  const sans = A({ envois, ventes: null, de, a });
  dit(sans.attribuees === null && sans.repartition === null && sans.total.contactes === 3, 'V8 ventes pas lues ⇒ « pas su » (null), jamais 0');
}
console.log(`\n${ko ? '❌' : '✅'} audit-favoris-ventes : ${ok} vert(s), ${ko} rouge(s)`);
process.exit(ko ? 1 : 0);
