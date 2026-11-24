// ════════════════════════════════════════════════════════════════════════════
//  LA COPIE D'UN ÉCRAN — les règles du stockage (src/copieEcran.js), sans navigateur.
//    node scripts/tests/copie-ecran.test.mjs            → vert attendu
//    node scripts/tests/copie-ecran.test.mjs --prouve   → la MUTATION « compte » (une copie qui n'est plus par compte)
//                                                          doit rendre ROUGE les contrôles du compte.
//  Le rendu, la capture, le nettoyage et « aucune écriture » se jugent dans le navigateur : scripts/bancs/copie-ecran.cjs.
// ════════════════════════════════════════════════════════════════════════════
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const prouve = process.argv.includes('--prouve');
if (prouve) globalThis.__VRM_COPIE_MUTATION_TEST__ = 'compte';
const M = await import(pathToFileURL(path.join(ICI, '..', '..', 'src', 'copieEcran.js')).href + '?t=' + Date.now());

let verts = 0, rouges = 0;
const dit = (ok, quoi) => { if (ok) { verts++; console.log('  ✅ ' + quoi); } else { rouges++; console.log('  ❌ ' + quoi); } };
// Un localStorage en mémoire (l'index synchrone).
const lsMem = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
globalThis.localStorage = lsMem();

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const MIDI = new Date(); MIDI.setHours(12, 0, 0, 0);
const T = MIDI.getTime();
const copie = (owner, ecran, extra = {}) => ({ v: M.SCHEMA_COPIE, owner, ecran, t: T - 3 * 60000, jour: (() => { const d = new Date(T); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(),
  largeur: 390, theme: '', hauteur: 1600, html: `<div class="n-groupe"><div class="n-rangee">Nike ${owner.slice(0, 4)}</div></div>`, rangees: [{ id: 'vinted#1', titre: 'Nike', photo: '', num: '12', prix: '30 €', statut: '' }], coque: { html: '<div class="vrm-app-shell"><div class="vrm-copie-zone"></div></div>', vw: 390, vh: 844 }, ...extra });

console.log('Copie d\'un écran — règles du stockage' + (prouve ? ' (MUTATION « compte » : rouge attendu)' : ''));
const stock = M.stockageMemoireCopies();
M.poserStockageCopies(stock);

// 1) Par compte : la copie de A n'est jamais rendue à B.
await M.ecrireCopie(copie(A, 'annonces'), stock);
const pourA = await M.lireCopie(A, 'annonces', { maintenant: T, largeur: 390, stock });
const pourB = await M.lireCopie(B, 'annonces', { maintenant: T, largeur: 390, stock });
dit(!!pourA && pourA.owner === A, 'A relit SA copie d\'Annonces');
dit(pourB === null, 'B ne reçoit JAMAIS la copie de A (clé et valeur portent l\'owner)');
// Une valeur d'un autre owner rangée sous la clé de B (une base abîmée) : refusée à la lecture.
stock.m.set(M.cleCopie(B, 'ventes'), { ...copie(A, 'ventes'), k: M.cleCopie(B, 'ventes') });
dit((await M.lireCopie(B, 'ventes', { maintenant: T, largeur: 390, stock })) === null, 'une valeur d\'un autre owner sous la clé de B est refusée');
// 2) Écrire pour B efface tout ce qui est à A (un seul compte sur l'appareil).
await M.ecrireCopie(copie(B, 'achats'), stock);
dit(![...stock.m.values()].some((e) => e.owner === A), 'écrire une copie de B efface les copies de A');
dit(Object.keys(M.lireIndexCopies(A)).length === 0, 'l\'index de A part quand B écrit');
// 3) L'effacement (déconnexion, changement de compte) vide tout.
await M.ecrireCopie(copie(B, 'ventes'), stock);
await M.effacerCopiesEcrans({ stock });
dit(stock.m.size === 0 && Object.keys(M.lireIndexCopies(B)).length === 0, 'effacerCopiesEcrans vide la base et l\'index');
// 4) Jamais présentée comme fraîche : seulement le jour de sa capture, datée.
const hier = copie(A, 'annonces', { t: T - 86400000, jour: '2000-01-01' });
dit(M.copieMontrable(hier, { owner: A, ecran: 'annonces', maintenant: T, largeur: 390 }) === null, 'une copie d\'un autre jour n\'est pas montrée');
dit(M.copieMontrable(copie(A, 'annonces'), { owner: A, ecran: 'annonces', maintenant: T, largeur: 390 }) !== null, 'une copie du jour est montrée');
dit(M.ageCopieMin(copie(A, 'annonces'), T) === 3, 'son âge est dit (3 min)');
dit(M.copieMontrable(copie(A, 'annonces'), { owner: A, ecran: 'annonces', maintenant: T, largeur: 1512 }) === null, 'une autre largeur de fenêtre : pas montrée (elle sauterait)');
dit(M.copieMontrable({ ...copie(A, 'annonces'), v: 0 }, { owner: A, ecran: 'annonces', maintenant: T, largeur: 390 }) === null, 'une autre version de schéma : pas montrée');
dit(M.copieMontrable(copie(A, 'ventes'), { owner: A, ecran: 'annonces', maintenant: T, largeur: 390 }) === null, 'la copie d\'un autre écran : pas montrée');
// 5) Rien de lourd : un HTML trop gros n'est pas montré.
dit(M.copieMontrable({ ...copie(A, 'annonces'), html: 'x'.repeat(M.MAX_HTML + 1) }, { owner: A, ecran: 'annonces', maintenant: T, largeur: 390 }) === null, `au-delà de ${M.MAX_HTML} caractères : jamais`);
// 6) Le module n'exporte rien qui rende une donnée à décider (un N°, un prix) : seulement des copies À MONTRER.
const exportes = Object.keys(M).sort();
dit(!exportes.some((k) => /prix|numero|num\b|envoi|ecrireLigne|save/i.test(k)), 'aucune fonction de décision exportée (' + exportes.length + ' exports)');

console.log(`\n${rouges ? '❌' : '✅'} copie-ecran : ${verts} vert(s), ${rouges} rouge(s)`);
if (prouve) { console.log(rouges ? '✅ la mutation est vue (rouge attendu)' : '❌ la mutation passe inaperçue'); process.exit(rouges ? 0 : 1); }
process.exit(rouges ? 1 : 0);
