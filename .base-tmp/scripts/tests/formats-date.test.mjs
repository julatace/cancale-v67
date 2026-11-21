// (9 nov., vitesse) Les formats de date créés une fois (src/formatsDate.js, `dateJourFr`,
// api/_lib/bilan-semaine.js) écrivent EXACTEMENT ce qu'écrivait `toLocaleDateString` :
// chaque (langue, options) utilisée par l'app, sur deux ans d'instants (heure d'été et
// d'hiver, 1er du mois, minuit à Paris).
// node --test scripts/tests/formats-date.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { dateLocale } from '../../src/formatsDate.js';
import { dateParis, minuitParis } from '../../api/_lib/bilan-semaine.js';

const CAS = [
  ['fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }],
  ['fr-FR', { month: 'short' }], ['fr-FR', { month: 'long' }], ['fr-FR', { weekday: 'long' }],
  ['fr-CA', { timeZone: 'Europe/Paris' }], ['en-CA', { timeZone: 'Europe/Paris' }],
];
const instants = []; for (let t = Date.UTC(2025, 0, 1); t < Date.UTC(2027, 0, 1); t += 3600e3 * 5 + 61e3) instants.push(t);

test('dateLocale = toLocaleDateString, pour chaque format de l’app', () => {
  for (const [l, o] of CAS) for (const t of instants) assert.equal(dateLocale(new Date(t), l, o), new Date(t).toLocaleDateString(l, o), `${l} ${JSON.stringify(o)} ${t}`);
});
test('un nombre ou une date : même texte', () => { const t = Date.UTC(2026, 10, 9, 22, 30); assert.equal(dateLocale(t, 'en-CA', { timeZone: 'Europe/Paris' }), dateLocale(new Date(t), 'en-CA', { timeZone: 'Europe/Paris' })); });
test('dateParis et minuitParis (bilan de la semaine) inchangés', () => {
  for (const t of instants) assert.equal(dateParis(t), new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }));
  // minuit à Paris, été et hiver : l'instant rendu est bien 00:00 à Paris
  for (const ymd of ['2026-01-15', '2026-03-29', '2026-03-30', '2026-07-01', '2026-10-25', '2026-10-26']) {
    const t = minuitParis(ymd);
    assert.equal(dateParis(t), ymd); assert.equal(dateParis(t - 1), new Date(Date.parse(ymd) - 864e5).toISOString().slice(0, 10));
  }
});
