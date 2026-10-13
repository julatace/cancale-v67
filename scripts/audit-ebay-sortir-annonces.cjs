// AUDIT : retirer une annonce de `ebay_listings` passe par le COMPARE-ET-ÉCHANGE.
//
//   `handleSync` réécrit TOUTE la ligne `ebay_listings` ; un retrait (manuel ou
//   automatique, `sortirDesAnnonces`) peut tomber EN MÊME TEMPS. Un
//   lire-fusionner-réécrire nu perd alors une écriture : la synchro réécrit la
//   liste complète et l'annonce retirée y revient (ou l'inverse). C'est la
//   famille destructrice n°1 du projet. `sortirDesRegles` (sibling) est déjà
//   passé au compare-et-échange `modifierDonnee` ; `sortirDesAnnonces` doit
//   suivre — même primitive, dont la concurrence est prouvée ailleurs
//   (`audit-ebay-route`, mutation `sans-cas`).
//
//   On ne juge pas l'orthographe : on EXÉCUTE la fonction. La nouvelle doit
//   router l'écriture par `modifierDonnee` (jamais un `lireDonnee`+`storeData`
//   nu), et son modificateur doit retirer la bonne annonce et n'écrire RIEN
//   quand il n'y a rien à retirer (une lecture ratée de `modifierDonnee` rend
//   `null` et n'écrit pas — la garde est dans le primitif).
//
//   node scripts/audit-ebay-sortir-annonces.cjs [chemin/api/ebay.js]
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = process.argv[2] || path.join(__dirname, '..', 'api', 'ebay.js');
const APP = fs.readFileSync(SRC, 'utf8');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };

// ── Extraire la fonction `sortirDesAnnonces` (et elle seule) ────────────────
const m = /async function sortirDesAnnonces\(itemId, ctx\) \{[\s\S]*?\n\}/.exec(APP);
dit(!!m, 'sortirDesAnnonces est extractible');
if (!m) { console.log(`\n❌ audit-ebay-sortir-annonces : ${ko} rouge(s)`); process.exit(1); }

// ── Un bac à sable qui ESPIONNE par quelle voie l'écriture passe ────────────
function executer() {
  const appels = { modifierDonnee: [], lireDonnee: 0, storeData: 0 };
  let modifierVu = null;
  const sandbox = {
    ligneDe: (base) => base + '_u1',
    // Le compare-et-échange : on capture le modificateur pour le juger, et on
    // rend `true` (écriture réussie) — sa concurrence est prouvée ailleurs.
    modifierDonnee: async (id, owner, modifier) => { appels.modifierDonnee.push(id); modifierVu = modifier; return true; },
    // Les voies NUES : si la fonction les emprunte, c'est le défaut.
    lireDonnee: async () => { appels.lireDonnee++; return { items: [{ itemId: 'A' }, { itemId: 'B' }] }; },
    storeData: async () => { appels.storeData++; return true; },
    String, Array, Object, Number, Boolean, Date, Promise, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(m[0] + '\nglobalThis.__f = sortirDesAnnonces;', sandbox);
  return { f: sandbox.__f, appels, getMod: () => modifierVu };
}

(async () => {
  const { f, appels, getMod } = executer();
  await f('A', { owner: 'u1' });

  // 1) L'écriture passe par le compare-et-échange, jamais par une voie nue.
  dit(appels.modifierDonnee.length === 1 && appels.modifierDonnee[0] === 'ebay_listings_u1',
    'le retrait passe par `modifierDonnee` sur la ligne `ebay_listings`', JSON.stringify(appels.modifierDonnee));
  dit(appels.lireDonnee === 0 && appels.storeData === 0,
    'aucune écriture par la voie NUE (lireDonnee + storeData)', `lireDonnee=${appels.lireDonnee} storeData=${appels.storeData}`);

  // 2) Le modificateur retire la bonne annonce, et n'écrit RIEN sans rien à retirer.
  const mod = getMod();
  dit(typeof mod === 'function', 'un modificateur est bien remis au compare-et-échange');
  if (typeof mod === 'function') {
    const apres = mod({ items: [{ itemId: 'A' }, { itemId: 'B' }], rev: 3 });
    dit(apres && Array.isArray(apres.items) && apres.items.length === 1 && apres.items[0].itemId === 'B',
      'il retire l’annonce visée et garde les autres', JSON.stringify(apres && apres.items));
    dit(mod({ items: [{ itemId: 'B' }] }) === undefined, 'annonce absente ⇒ aucune écriture (undefined)');
    dit(mod({}) === undefined && mod(null) === undefined, 'ligne vide ou malformée ⇒ aucune écriture (undefined)');
  }

  console.log(ko ? `\n❌ audit-ebay-sortir-annonces : ${ko} rouge(s)` : '\n✅ audit-ebay-sortir-annonces : le retrait d’une annonce est protégé par le compare-et-échange');
  process.exit(ko ? 1 : 0);
})();
