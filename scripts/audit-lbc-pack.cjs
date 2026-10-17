// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : le PACK PHOTO Leboncoin est lu par l'extension, jamais deviné
//         node scripts/audit-lbc-pack.cjs [--src <background.js>] [--mutation <nom>]
// ═══════════════════════════════════════════════════════════════════════════
// 17 octobre — Julien : « le pack Leboncoin, je pense que l'extension peut capter
// si oui ou non l'utilisateur a pris un pack photo ». La page de son compte
// charge `api/usage-consumption-bff/v2/users/me/packages` (mesuré dans
// `lbc_recon.paths`) ; je n'en ai JAMAIS vu le corps. La règle ne décide donc
// que sur ce qui se lit sans deviner, et garde la FORME sinon. On EXÉCUTE le
// vrai `background.js` (§4.10) avec des réponses inventées :
//   1. un pack nommé « … photo … » ⇒ `lbc_pack_photo.actif = true` ;
//   2. une liste de packs lisible sans photo (ou vide) ⇒ `actif = false` ;
//   3. une forme qu'on ne sait pas lire ⇒ AUCUN `actif` (pas su), la forme gardée
//      (noms de clés et types, jamais une valeur) ;
//   4. le CATALOGUE (product-catalog : ce qui s'achète) ne vaut jamais « actif » ;
//   5. lecture de la ligne ratée ⇒ rien n'est écrit (lecture KO, écriture OK).
const fs = require('fs'), os = require('os'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

const MUTATIONS = {
  // une forme illisible vaudrait « pas de pack »
  passu: [['  return photo ? true : (lisible ? false : null);', '  return photo ? true : false;']],
  // la lecture ratée repartirait d'un objet vide
  lecture: [["      const rows = await sbGet('app_data?id=eq.lbc_pack_photo&select=data');", "      const rows = (await sbGet('app_data?id=eq.lbc_pack_photo&select=data')) || [];"]],
  // le catalogue compterait comme les packs possédés
  catalogue: [['const LBC_URL_PACKS = /\\/usage-consumption-bff\\/v\\d+\\/users\\/me\\/packages/i;', 'const LBC_URL_PACKS = /packages|product-catalog/i;']],
};
function sourceAJuger() {
  const src = cheminSource();
  const i = process.argv.indexOf('--mutation');
  if (i < 0) return src;
  const regles = MUTATIONS[process.argv[i + 1]];
  if (!regles) { console.log('mutation inconnue'); process.exit(2); }
  let s = fs.readFileSync(src, 'utf8');
  for (const [de, vers] of regles) { if (s.split(de).length !== 2) { console.log(`❌ ancre introuvable : ${de.slice(0, 60)}`); process.exit(1); } s = s.replace(de, vers); }
  const f = path.join(os.tmpdir(), `vrm-mut-pack-${process.pid}.js`); fs.writeFileSync(f, s); return f;
}
const SRC = sourceAJuger();
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const URL_PACKS = 'https://api.leboncoin.fr/api/usage-consumption-bff/v2/users/me/packages';
const URL_CATALOGUE = 'https://api.leboncoin.fr/api/selfserve-public-api/v1/users/me/product-catalog';
const attendre = () => new Promise((r) => setTimeout(r, 30));
const lance = async (url, corps, opts = {}) => {
  const f = faireFond({ src: SRC, lignes: opts.lignes || {}, lectureKO: (u) => !!opts.lectureKO && u.includes('lbc_pack_photo') });
  if (typeof f.ctx.handleLbcRaw !== 'function') throw new Error('handleLbcRaw absente');
  await f.ctx.handleLbcRaw(url, JSON.stringify(corps));
  await attendre();
  return f;
};
const ligne = (f) => f.lignes.lbc_pack_photo;

(async () => {
  console.log('\n── 1. Un pack photo possédé');
  await essaie('oui', async () => {
    const f = await lance(URL_PACKS, { packages: [{ name: 'Pack Photos+', code: 'PHOTO_PACK_10', remaining: 7 }, { name: 'Remontée', code: 'BUMP' }] });
    dit(ligne(f) && ligne(f).actif === true, 'un pack dont le nom dit « photo » ⇒ actif: true', JSON.stringify(ligne(f) && ligne(f).actif));
    dit(ligne(f) && ligne(f).source === 'extension' && !!ligne(f).at, 'avec sa source (« extension ») et sa date');
    dit(ligne(f) && !JSON.stringify(ligne(f).forme || []).includes('PHOTO_PACK_10'), 'la forme gardée ne contient AUCUNE valeur (noms de clés et types)');
  });

  console.log('\n── 2. Des packs lisibles sans photo, ou aucun pack');
  await essaie('non', async () => {
    const f = await lance(URL_PACKS, { packages: [{ name: 'Remontée hebdo', code: 'BUMP_7' }] });
    dit(ligne(f) && ligne(f).actif === false, 'packs lisibles, aucun ne dit « photo » ⇒ actif: false', JSON.stringify(ligne(f) && ligne(f).actif));
    const g = await lance(URL_PACKS, { packages: [] });
    dit(ligne(g) && ligne(g).actif === false, 'liste de packs vide ⇒ actif: false', JSON.stringify(ligne(g) && ligne(g).actif));
  });

  console.log('\n── 3. Une forme qu\'on ne sait pas lire');
  await essaie('passu', async () => {
    const f = await lance(URL_PACKS, { data: { items: [{ q: 3, z: true }] }, total: 1 });
    dit(ligne(f) && ligne(f).actif === undefined, 'aucun nom lisible ⇒ AUCUN « actif » écrit (pas su, jamais « non »)', JSON.stringify(ligne(f)));
    dit(ligne(f) && Array.isArray(ligne(f).forme) && ligne(f).forme.length > 0, 'la forme est gardée pour la passe suivante', JSON.stringify(ligne(f) && ligne(f).forme));
    const avant = { actif: true, at: new Date().toISOString(), source: 'extension' };
    const g = await lance(URL_PACKS, { data: { items: [{ q: 3 }] } }, { lignes: { lbc_pack_photo: avant } });
    dit(ligne(g) && ligne(g).actif === true, 'une forme illisible n\'efface pas un « oui » déjà lu', JSON.stringify(ligne(g) && ligne(g).actif));
  });

  console.log('\n── 4. Le catalogue (ce qui s\'ACHÈTE) n\'est pas une preuve');
  await essaie('catalogue', async () => {
    const f = await lance(URL_CATALOGUE, { products: [{ name: 'Pack Photos', code: 'PHOTO', price: 299 }] });
    dit(!ligne(f) || ligne(f).actif === undefined, 'un pack photo au CATALOGUE ne fait pas « actif: true »', JSON.stringify(ligne(f) || null));
  });

  console.log('\n── 5. Lecture de la ligne ratée (lecture KO, écriture OK)');
  await essaie('lecture', async () => {
    const avant = { actif: true, at: new Date().toISOString(), source: 'extension', forme: ['x:object'] };
    const f = await lance(URL_PACKS, { packages: [{ name: 'Remontée', code: 'BUMP' }] }, { lignes: { lbc_pack_photo: JSON.parse(JSON.stringify(avant)) }, lectureKO: true });
    dit(!f.j.posts.some((ids) => ids.includes('lbc_pack_photo')), 'rien n\'est écrit quand la ligne n\'a pas pu être lue');
    dit(ligne(f) && ligne(f).actif === true, 'le « oui » déjà lu reste', JSON.stringify(ligne(f) && ligne(f).actif));
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
