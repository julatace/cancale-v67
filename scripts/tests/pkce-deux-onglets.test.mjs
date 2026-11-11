// Deux connexions Google/Discord lancées en même temps (relecture du lot connexions-oauth, 11 nov.).
// Onglet A part avec Google, onglet B avec Discord ; A revient le premier ; B revient dans une
// AUTRE fenêtre (app installée, nouvel onglet du téléphone : sessionStorage vide). Le retour de A
// ne doit pas effacer le vérificateur de B : sinon B échoue (« a commencé sur un autre appareil »).
// Et après l'échange réussi, SON vérificateur ne sert plus jamais.
import test from 'node:test';
import assert from 'node:assert/strict';
import { poserEssai, prendreEssais, oterEssai, candidatsVerificateur } from '../../src/auth/essaisPkce.js';

const stockage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const V = (c) => c.repeat(43);

test('deux départs en parallèle : le retour de A laisse celui de B', () => {
  const appareil = stockage(), ongletA = stockage(), ongletB = stockage(), fenetreC = stockage();
  const t0 = Date.now();
  poserEssai([ongletA, appareil], 'aaaaaa', V('a'), t0);
  poserEssai([ongletB, appareil], 'bbbbbb', V('b'), t0 + 1000);
  // Retour de A dans A.
  const ca = candidatsVerificateur({ idRetour: 'aaaaaa', essais: prendreEssais([ongletA, appareil], t0 + 5000) });
  assert.equal(ca[0].v, V('a'));
  if (typeof oterEssai === 'function') oterEssai([ongletA, appareil], ca[0].v);   // échange réussi
  // Retour de B dans une autre fenêtre (onglet vide).
  const cb = candidatsVerificateur({ idRetour: 'bbbbbb', essais: prendreEssais([fenetreC, appareil], t0 + 8000) });
  assert.ok(cb.length > 0, 'le vérificateur de B a été effacé par le retour de A');
  assert.equal(cb[0].v, V('b'));
});

test('un vérificateur échangé ne revient jamais', () => {
  const appareil = stockage(), onglet = stockage();
  const t0 = Date.now();
  poserEssai([onglet, appareil], 'aaaaaa', V('a'), t0);
  const c = candidatsVerificateur({ idRetour: 'aaaaaa', essais: prendreEssais([onglet, appareil], t0 + 1000) });
  oterEssai([onglet, appareil], c[0].v);
  assert.deepEqual(prendreEssais([onglet, appareil], t0 + 2000), {});
});

test('un essai périmé (> 10 min) est oublié', () => {
  const appareil = stockage();
  const t0 = Date.now();
  poserEssai([appareil], 'aaaaaa', V('a'), t0);
  assert.deepEqual(prendreEssais([appareil], t0 + 11 * 60 * 1000), {});
});

// « Délier » la seule liaison : le conseil doit mener quelque part (un mot de passe n'ajoute
// aucune identité chez Supabase, le refus `single_identity_not_deletable` resterait).
import { planDelier, refusDelier } from '../../src/auth/delierOAuth.js';
test('délier la seule liaison : conseil qui débloque, jamais « ajoute un mot de passe »', () => {
  const p = planDelier({ email: 'x@exemple.test', identities: [{ provider: 'google', identity_id: 'g1' }] }, 'google', 'g1');
  assert.equal(p.ok, false);
  assert.doesNotMatch(p.error, /mot de passe/i);
  assert.match(p.error, /Relie d’abord Discord/);
  assert.match(refusDelier(422, { error_code: 'single_identity_not_deletable' }, 'discord'), /Relie d’abord Google/);
});
