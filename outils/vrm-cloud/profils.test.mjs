import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ouvrirProfil } from './lancer.mjs';

test('charge VRM dans deux profils, sépare leurs données et les retrouve après redémarrage', async (t) => {
  const etat = await mkdtemp(join(tmpdir(), 'vrm-cloud-test-'));
  const ancienEtat = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = etat;
  const ouverts = new Set();
  t.after(async () => {
    await Promise.allSettled([...ouverts].map((contexte) => contexte.close()));
    if (ancienEtat === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = ancienEtat;
    await rm(etat, { recursive: true, force: true });
  });

  async function ouvrir(nom) {
    const profil = await ouvrirProfil(nom, { horsLigne: true });
    ouverts.add(profil.contexte);
    return profil;
  }

  async function fermer(profil) {
    await profil.contexte.close();
    ouverts.delete(profil.contexte);
  }

  const lire = (profil) => profil.extension.evaluate(async () => (await chrome.storage.local.get('achatsPilote')).achatsPilote);
  const ecrire = (profil, achat) => profil.extension.evaluate((valeur) => chrome.storage.local.set({ achatsPilote: valeur }), achat);
  const achatA = { id: 'achat-a', statut: 'a-retirer' };
  const achatB = { id: 'achat-b', statut: 'en-route' };
  const a = await ouvrir('client-a');
  const b = await ouvrir('client-b');
  assert.match(a.version, /^\d+\.\d+\.\d+/);
  assert.equal(b.version, a.version);
  await ecrire(a, achatA);
  assert.equal(await lire(b), undefined);
  await ecrire(b, achatB);
  assert.deepEqual(await lire(a), achatA);
  await fermer(a);
  await fermer(b);

  const aRelance = await ouvrir('client-a');
  const bRelance = await ouvrir('client-b');
  assert.deepEqual(await lire(aRelance), achatA);
  assert.deepEqual(await lire(bRelance), achatB);
});
