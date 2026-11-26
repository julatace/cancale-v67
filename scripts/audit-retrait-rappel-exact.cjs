// ── AUDIT : LE RAPPEL DE RETRAIT EST EXACT (24 nov., lot retrait-parfait) ──────────────────────────────────────
// La règle du cron (api/_lib/suivi-colis.js `rappelsRetraitDuJour`), EXÉCUTÉE :
//   E1 la date limite LUE seulement : un colis sans `limite` (garde du transporteur, estimation) ne reçoit AUCUN rappel ;
//   E2 l'heure de PARIS décide du jour : à 23 h 30 UTC la veille de la limite, il est déjà le jour J à Paris ⇒ « dernier » ;
//   E3 une clé par colis ET par seuil (`demain-{n°}`, `dernier-{n°}`) : deux rappels distincts, jamais deux fois le même ;
//   E4 une limite DÉPASSÉE ne sonne pas « dernier jour » (elle passe « à vérifier », que le cron ne sonne plus).
// `--prouve` : chaque mutation de la règle doit rougir.
'use strict';
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'api', '_lib', 'suivi-colis.js');
const MUTATIONS = {
  'limite-estimee': ["const limite = (l.limite != null ? l.limite : l.l) || null;", "const limite = (l.limite != null ? l.limite : l.l) || l.limiteVers || null;"],
  'heure-muette': ["(limite || limiteAt) && e.jours === cible", "limite && e.jours === cible"],
  'jour-utc': ["const today = parisDate(0);", "const today = new Date().toISOString().slice(0, 10);"],
  'cle-sans-seuil': ['out.push({ cle: `${etat}-${k}`', 'out.push({ cle: `${k}`'],
};
async function juger(dossier) {
  const S = await import(dossier);
  let ko = 0; const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (c || d === undefined ? '' : ' — ' + JSON.stringify(d).slice(0, 300))); };
  const ligne = (suivi, limite, extra = {}) => ({ type: 'suivi', carrier: 'mondialrelay', suivi, status: 'available', subject: `Votre colis ${suivi} est disponible`,
    arriveLe: '2026-11-20T09:00:00Z', receivedAt: '2026-11-20T09:00:00Z', emailAt: '2026-11-20T09:00:00Z', code: '1234', lieu: 'TABAC TEST, 1 RUE A, 22100 DINAN', limite, ...extra });
  const parisJour = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  // E1 — 23 nov. 10 h Paris ; un colis SANS limite lue, seulement une estimation (« vers le », `limiteVers`) — aucun rappel, ni aujourd'hui ni la veille.
  const T = Date.parse('2026-11-23T09:00:00Z');
  for (const j of [0, 1]) {
    const l = S.rappelsRetraitDuJour({ lignes: [ligne('80000001', null, { arriveLe: '2026-11-21T09:00:00Z', limiteVers: j ? '2026-11-24' : '2026-11-23' })], maintenant: T, aujourdhui: parisJour(T), jourCible: j });
    dit(l.length === 0, `E1 sans date limite LUE, aucun rappel (${j ? 'veille' : 'jour J'})`, l);
  }
  // E1 bis — une ligne qui ne porte que l'HEURE limite lue (Vinted Go `limiteAt`) : « dernier » le jour même, avec son heure.
  const l1 = S.rappelsRetraitDuJour({ lignes: [ligne('80000005', null, { carrier: 'vinted', limiteAt: '2026-11-23T16:30:00Z' })], maintenant: T, aujourdhui: parisJour(T), jourCible: 0 });
  dit(l1.length === 1 && l1[0].etat === 'dernier' && l1[0].limiteAt, `E1 l'heure limite LUE seule suffit (${l1.map((x) => x.etat)})`, l1);
  // E2 — limite le 24 nov. ; il est 23 h 30 UTC le 23 = 0 h 30 le 24 à Paris : « dernier ».
  const T2 = Date.parse('2026-11-23T23:30:00Z');
  const l2 = S.rappelsRetraitDuJour({ lignes: [ligne('80000002', '2026-11-24')], maintenant: T2, aujourdhui: parisJour(T2), jourCible: 0 });
  dit(l2.length === 1 && l2[0].etat === 'dernier', `E2 0 h 30 à Paris le jour de la limite ⇒ « dernier » (${l2.map((x) => x.etat)})`, l2);
  // E3 — la veille puis le jour J : deux clés distinctes, une par seuil.
  const Tv = Date.parse('2026-11-23T09:00:00Z'), Tj = Date.parse('2026-11-24T09:00:00Z');
  const v = S.rappelsRetraitDuJour({ lignes: [ligne('80000003', '2026-11-24')], maintenant: Tv, aujourdhui: parisJour(Tv), jourCible: 1 });
  const d = S.rappelsRetraitDuJour({ lignes: [ligne('80000003', '2026-11-24')], maintenant: Tj, aujourdhui: parisJour(Tj), jourCible: 0 });
  dit(v.length === 1 && d.length === 1 && v[0].cle === 'demain-80000003' && d[0].cle === 'dernier-80000003', `E3 une clé par colis et par seuil (${v.map((x) => x.cle)} · ${d.map((x) => x.cle)})`, [v, d]);
  // E4 — limite d'hier : jamais « dernier ».
  const l4 = S.rappelsRetraitDuJour({ lignes: [ligne('80000004', '2026-11-22')], maintenant: T, aujourdhui: parisJour(T), jourCible: 0 });
  dit(!l4.some((x) => x.etat === 'dernier' || x.etat === 'demain'), `E4 limite dépassée : jamais « dernier jour » (${l4.map((x) => x.etat)})`, l4);
  // Le cron du serveur prend le jour de PARIS (`parisDate`), pas celui d'UTC.
  const cron = fs.readFileSync(path.join(RACINE, 'api', 'ship-reminders.js'), 'utf8');
  dit(/const today = parisDate\(0\);[\s\S]{0,400}aujourdhui: today/.test(cron), 'E2 le cron passe le jour de Paris à la règle');
  return ko;
}
// Une copie de la règle À CÔTÉ de l'original (mêmes imports relatifs), mutée ou non ; effacée après.
function copie(mut) {
  const f = path.join(RACINE, 'api', '_lib', `_audit-rappel-${process.pid}-${Date.now()}.js`);
  let s = fs.readFileSync(SRC, 'utf8');
  if (mut) { if (!s.includes(mut[0])) throw new Error('ancre introuvable : ' + mut[0]); s = s.replace(mut[0], mut[1]); }
  fs.writeFileSync(f, s);
  return f;
}
(async () => {
  const d = copie(null);
  let ko = await juger(d); fs.rmSync(d, { force: true });
  if (process.argv.includes('--prouve')) {
    for (const [nom, m] of Object.entries(MUTATIONS)) {
      if (nom === 'jour-utc') { const s = fs.readFileSync(path.join(RACINE, 'api', 'ship-reminders.js'), 'utf8'); const r = s.includes(m[0]) && !/const today = parisDate\(0\);[\s\S]{0,400}aujourdhui: today/.test(s.split(m[0]).join(m[1])); console.log((r ? '  ✅ ' : '  ❌ ') + `mutation ${nom} rougit`); if (!r) ko++; continue; }
      const dm = copie(m); console.log(`\n· mutation ${nom}`); const k = await juger(dm); fs.rmSync(dm, { force: true });
      console.log((k ? '  ✅ ' : '  ❌ ') + `mutation ${nom} rougit (${k})`); if (!k) ko++;
    }
  }
  console.log(ko ? `\n❌ audit-retrait-rappel-exact : ${ko} rouge(s)` : '\n✅ audit-retrait-rappel-exact : vert');
  process.exit(ko ? 1 : 0);
})();
