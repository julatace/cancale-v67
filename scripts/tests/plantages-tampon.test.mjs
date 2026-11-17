// (16 nov., lot vitesse-lectures) Le tampon du démarrage (src/plantagesTampon.js) : rien n'est perdu ni
// noté deux fois entre le démarrage et l'arrivée du vrai journal (src/plantages.js).
// node --test scripts/tests/plantages-tampon.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { poserTamponPlantages } from '../../src/plantagesTampon.js';

const cible = () => { const l = new Map(); return { l, addEventListener: (n, f) => l.set(n, [...(l.get(n) || []), f]), removeEventListener: (n, f) => l.set(n, (l.get(n) || []).filter((g) => g !== f)), emettre: (n, ev) => { for (const f of [...(l.get(n) || [])]) f(ev); } }; };
const fauxJournal = () => { const notes = []; const m = { notes,
  ecouterPlantages: (c) => { m.ecoute = c; }, ecouterViolationsCsp: (c) => { m.ecouteCsp = c; },
  noterPlantage: (e, c) => notes.push(['p', e.message, c]), noterViolationCsp: (e, c) => notes.push(['c', e.blockedURI, c]), compterMorceauPerime: (p) => notes.push(['m', p]) }; return m; };

test('avant le vrai journal : tout est gardé avec son contexte, puis rendu dans l\'ordre, une fois', async () => {
  const win = cible(), doc = cible(); const J = fauxJournal(); let ecran = 'journee';
  const t = poserTamponPlantages({ win, doc, contexte: () => ({ ecran }), charger: async () => J });
  win.emettre('error', { error: new Error('un') });
  win.emettre('error', { error: null });                         // une image qui ne charge pas : rien
  ecran = 'ventes';
  win.emettre('unhandledrejection', { reason: new Error('deux') });
  win.emettre('unhandledrejection', { reason: 'pas une Error' });  // rien
  doc.emettre('securitypolicyviolation', { blockedURI: 'https://x.test/a' });
  t.compterMorceauPerime({ message: 'Unable to preload CSS' });
  await t.charger(); await t.charger();
  assert.deepEqual(J.notes, [
    ['p', 'un', { origine: 'page', ecran: 'journee' }],
    ['p', 'deux', { origine: 'promesse', ecran: 'ventes' }],
    ['c', 'https://x.test/a', { ecran: 'ventes' }],
    ['m', { message: 'Unable to preload CSS' }],
  ]);
  assert.equal(typeof J.ecoute, 'function'); assert.equal(typeof J.ecouteCsp, 'function');
  // Le tampon n'écoute plus : le vrai journal a pris la main (aucune note en double).
  win.emettre('error', { error: new Error('trois') });
  assert.equal(J.notes.length, 4);
  t.noter(new Error('filet'), { origine: 'demarrage' });
  assert.deepEqual(J.notes[4], ['p', 'filet', { origine: 'demarrage' }]);
});
test('un plantage attrapé par le dernier filet fait venir le journal tout de suite', async () => {
  const win = cible(), doc = cible(); const J = fauxJournal(); let charge = 0;
  const t = poserTamponPlantages({ win, doc, charger: async () => { charge++; return J; } });
  t.noter(new Error('filet'), { origine: 'demarrage' });
  await t.charger();
  assert.equal(charge, 1); assert.deepEqual(J.notes, [['p', 'filet', { origine: 'demarrage' }]]);
});
test('journal introuvable (réseau) : rien n\'est jeté, la tentative suivante le rend', async () => {
  const win = cible(), doc = cible(); const J = fauxJournal(); let essais = 0;
  const t = poserTamponPlantages({ win, doc, charger: async () => { if (++essais === 1) throw new Error('réseau'); return J; } });
  win.emettre('error', { error: new Error('un') });
  assert.equal(await t.charger(), null);
  await t.charger();
  assert.deepEqual(J.notes.map((x) => x[1]), ['un']);
});
