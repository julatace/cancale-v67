// (28 nov., vitesse-fluide) `nombre`, `monnaie`, `date`, `heure`, `dateRelative` (src/i18n/index.js) gardent leur formateur
// Intl : le texte rendu doit être EXACTEMENT celui d'un formateur neuf, pour chaque langue, options et valeur limite.
//   node scripts/tests/formats-i18n-gardes.test.mjs        (MUTATION=1 : un formateur gardé sans ses options ⇒ rouge)
import assert from 'node:assert/strict';
const I = await import('../../src/i18n/index.js');
const langues = ['fr', 'en', 'es', 'it', 'de'];
const nombres = [0, -0, 1, -1, 0.5, 1.005, 12.345, 999.995, 1234.5, 1e6, 123456789.987, -42.1, NaN, Infinity];
const optsN = [undefined, {}, { maximumFractionDigits: 0 }, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, { style: 'percent' }, { style: 'currency', currency: 'EUR' }, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }, { style: 'currency', currency: 'USD' }, { signDisplay: 'always' }, { maximumFractionDigits: undefined }];
const dates = [new Date('2026-11-28T14:05:00Z'), new Date('2026-01-01T00:00:00Z'), new Date('2025-12-31T23:59:59Z'), '2026-06-15T08:00:00+02:00', 0, Date.UTC(2026, 1, 29)];
const optsD = [undefined, { day: 'numeric', month: 'short' }, { weekday: 'long' }, { year: 'numeric', month: '2-digit', day: '2-digit' }, { hour: '2-digit', minute: '2-digit' }, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }];
let n = 0;
const MUT = process.env.MUTATION === '1';
for (const l of langues) {
  try { await I.appliquerLangue(l); } catch (_) {}
  if (I.langueCourante() !== l) { console.log('  (langue ' + l + ' pas chargée ici : sautée)'); continue; }
  const loc = I.localeCourante();
  for (let tour = 0; tour < 2; tour++) {   // le 2e tour sert les formateurs gardés
    for (const o of optsN) for (const v of nombres) {
      const attendu = (() => { try { return new Intl.NumberFormat(loc, MUT && tour ? undefined : o).format(v); } catch (_) { return String(v); } })();
      assert.equal(I.nombre(v, o), attendu, `nombre ${l} ${JSON.stringify(o)} ${v}`); n++;
    }
    for (const v of [0, 12.5, -3, null, undefined, 1234.56]) { const att = v == null || Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat(loc, { style: 'currency', currency: 'EUR' }).format(Number(v)); assert.equal(I.monnaie(v), att, `monnaie ${l} ${v}`); n++; }
    for (const o of optsD) for (const d of dates) {
      const dd = d instanceof Date ? d : new Date(d);
      assert.equal(I.date(d, o), new Intl.DateTimeFormat(loc, o || { day: 'numeric', month: 'long', year: 'numeric' }).format(dd), `date ${l} ${JSON.stringify(o)}`); n++;
      assert.equal(I.heure(d, o), new Intl.DateTimeFormat(loc, o || { hour: '2-digit', minute: '2-digit' }).format(dd), `heure ${l} ${JSON.stringify(o)}`); n++;
    }
    for (const [v, u] of [[-1, 'day'], [0, 'day'], [2, 'week'], [-3, 'month']]) { assert.equal(I.dateRelative(v, u), new Intl.RelativeTimeFormat(loc, { numeric: 'auto' }).format(v, u)); n++; }
  }
}
console.log(`${n} comparaisons identiques (formateurs gardés = formateurs neufs)`);
