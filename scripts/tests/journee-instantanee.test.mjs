// (9 nov.) Ma journée tout de suite (src/journeeInstantanee.js) et le reste de l'objectif du mois
// (src/objectifMois.js) : les règles pures. Le rendu est jugé par scripts/bancs/journee-instantanee.cjs.
// node --test scripts/tests/journee-instantanee.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { lireInstantane, instantaneMontrable, ecrireInstantane, effacerInstantanes, cleInstantane, ageTexte, AGE_MAX_INSTANTANE_MS, jourLocalIso } from '../../src/journeeInstantanee.js';
import { resteObjectif, phraseResteObjectif, joursRestantsMois } from '../../src/objectifMois.js';

const faux = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const T0 = new Date(2026, 10, 9, 15, 0, 0).getTime();
const snap = (uid, t = T0, o = {}) => ({ v: 1, uid, t, jour: jourLocalIso(t), mois: jourLocalIso(t).slice(0, 7), prenom: '', phrase: { texte: 'Des colis à envoyer' }, prochain: null,
  frise: { jours: [], panneau: { periode: '2026-11-08' } }, cases: [{ cle: 'vendu-mois', valeur: '18500', b: '185 €' }], objectif: null, gestes: 1, ...o });

test('un instantané ne se lit que pour SON uid (clé et valeur)', () => {
  const ls = faux();
  ecrireInstantane(snap('A'), { ls });
  assert.ok(lireInstantane('A', { maintenant: T0, ls }));
  assert.equal(lireInstantane('B', { maintenant: T0, ls }), null);
  // Rangé sous la clé de B mais porté par A : jamais rendu à B.
  ls.setItem(cleInstantane('B'), JSON.stringify(snap('A')));
  assert.equal(lireInstantane('B', { maintenant: T0, ls }), null);
  assert.equal(lireInstantane('', { maintenant: T0, ls }), null);
});
test('un seul instantané sur l’appareil ; effacer les retire tous', () => {
  const ls = faux();
  ecrireInstantane(snap('A'), { ls }); ecrireInstantane(snap('B'), { ls });
  assert.equal(ls.getItem(cleInstantane('A')), null);
  assert.ok(ls.getItem(cleInstantane('B')));
  effacerInstantanes({ ls });
  assert.equal(ls.length, 0);
  // La déconnexion efface toute clé `vrm_*` (wipeLocalData) : la clé en est une.
  assert.match(cleInstantane('x'), /^vrm_/);
});
test('trop vieux, du futur, illisible ⇒ rien', () => {
  const ls = faux();
  ecrireInstantane(snap('A'), { ls });
  assert.equal(lireInstantane('A', { maintenant: T0 + AGE_MAX_INSTANTANE_MS + 1, ls }), null);
  assert.equal(lireInstantane('A', { maintenant: T0 - 5 * 60000, ls }), null);
  ls.setItem(cleInstantane('A'), '{pas du json');
  assert.equal(lireInstantane('A', { maintenant: T0, ls }), null);
});
test('un autre jour : ni phrase ni panneau ; un autre mois : ni cases ni objectif', () => {
  const s = snap('A', T0, { objectif: { type: 'ca', cible: '200000', valeur: '18500' } });
  const meme = instantaneMontrable(s, T0 + 3600e3);
  assert.ok(meme.phrase && meme.cases && meme.objectif && meme.frise.panneau);
  const demain = instantaneMontrable(s, new Date(2026, 10, 10, 9).getTime());
  assert.equal(demain.phrase, null); assert.equal(demain.frise.panneau, null); assert.ok(demain.cases);
  const moisSuivant = instantaneMontrable(snap('A', new Date(2026, 9, 31, 22).getTime()), new Date(2026, 10, 1, 8).getTime());
  assert.equal(moisSuivant.cases, null); assert.equal(moisSuivant.objectif, null);
});
test('l’âge est toujours dit', () => {
  assert.equal(ageTexte(20e3), 'à l’instant');
  assert.equal(ageTexte(7 * 60e3), 'il y a 7 min');
  assert.equal(ageTexte(2 * 3600e3 + 5), 'il y a 2 h');
  assert.equal(ageTexte(50 * 3600e3), 'il y a 2 j');
});
// (intégration g1) La phrase suit le lot objectifs-mois (b5ec42113) : « en N jours » plutôt que « d’ici le 30 ».
test('objectif : le reste, le rythme arrondi VERS LE HAUT, aujourd’hui compris', () => {
  const p = { type: 'ca', objectif: 2000, valeur: 1240, pct: 62, partiel: false, atteint: false, manque: [] };
  const le9 = new Date(2026, 10, 9, 12).getTime();
  assert.deepEqual(joursRestantsMois(le9), { jours: 22, dernier: 30 });
  const r = resteObjectif(p, le9);
  assert.equal(r.reste, 760); assert.equal(r.parJour, 35);   // 760 / 22 = 34,5 ⇒ 35
  const montre = (v) => `${v.toLocaleString('fr-FR')} €`;
  assert.equal(phraseResteObjectif(p, montre, le9).replace(/ /g, ' '), 'encore 760 € en 22 jours · ≈ 35 €/jour');
  assert.equal(phraseResteObjectif(p, montre, new Date(2026, 10, 30, 12).getTime()), 'encore 760 € aujourd’hui');
  assert.equal(phraseResteObjectif({ ...p, partiel: true }, montre, le9).replace(/ /g, ' '), 'encore au plus 760 € en 22 jours · ≈ au plus 35 €/jour');
  assert.equal(phraseResteObjectif({ ...p, valeur: 2100, atteint: true, pct: 100 }, montre, le9), 'Objectif atteint ✓');
  assert.equal(phraseResteObjectif({ ...p, valeur: null, pct: null }, montre, le9), 'Vendu du mois pas lu');
  assert.equal(resteObjectif({ ...p, valeur: null }, le9), null);
  // Exact : 660 / 22 = 30 ⇒ 30, jamais 31.
  assert.equal(resteObjectif({ ...p, valeur: 1340 }, le9).parJour, 30);
  const v = { type: 'ventes', objectif: 40, valeur: 12, pct: 30, partiel: false, atteint: false, manque: [] };
  assert.equal(phraseResteObjectif(v, String, le9), 'encore 28 ventes en 22 jours · ≈ 2 ventes/jour');
});
