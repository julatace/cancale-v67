// Messages aux favoris : la preuve du lien apprise sur UN compte vaut pour les
// autres comptes du MÊME vendeur (28 oct.). Seul le PARAMÈTRE du lien
// (offering_id = la personne) passe d'un compte à l'autre, jamais le user_id de
// la notification (mesuré : le même pour toutes les notifications d'un compte).
// Données inventées à la forme mesurée. `--mutation=userid|contredit|owner`.
const path = require('path'), fs = require('fs');
(async () => {
  const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
  let src = fs.readFileSync(path.join(__dirname, '..', 'api', '_lib', 'favoris-cibles.js'), 'utf8');
  if (mut === 'userid') src = src.replace("if(parametresSeuls)return", "if(parametresSeuls)return [{forme:'vinted.fr/want_it?offering_id',cle:'user_id'}];if(0)return");
  if (mut === 'contredit') src = src.replace('if(ailleurs.some(b=>b.forme===a.forme&&b.cle!==a.cle))continue;', '');
  const tmp = path.join(__dirname, '..', 'api', '_lib', `.favoris-cibles-audit-${process.pid}.js`);
  fs.writeFileSync(tmp, src);
  let R; try { R = await import(tmp); } finally { fs.unlinkSync(tmp); }
  let ko = 0; const dit = (ok, m, d) => { if (!ok) ko++; console.log(`${ok ? '  ✅' : '  ❌'} ${m}${d !== undefined ? ' — ' + d : ''}`); };
  const essaie = (f) => { try { return f(); } catch (e) { return { erreur: e.code || e.message }; } };
  const COMMUN = 9000000001;
  const N = (i, item, off) => ({ id: 'n' + i, body: 'quelqu’un a marqué ton article comme favori', link: `/items/${item}/want_it/new?offering_id=${off}`, user_id: COMMUN });
  const trace = (uid) => ({ uid, body: JSON.stringify({ initiator: 'buyer_enters_offer_form', item_id: 4000000001, opposite_user_id: 5000000001 }), path: '/api/v2/conversations', method: 'POST' });
  // Compte A : deux favoris ouverts depuis la cloche (deux personnes distinctes).
  const uA = '1000000001';
  const nav = (item, off) => ({ uid: uA, method: 'NAV', path: '/inbox/want_it', itemId: String(item), recipientId: String(off), contexteFavori: `https://www.vinted.fr/items/${item}/want_it/new?offering_id=${off}` });
  const capA = { uid: uA, type: 'notifications', domain: 'www.vinted.fr', payload: { notifications: [N(1, 2000000001, 3000000001), N(2, 2000000002, 3000000002)] } };
  const params = essaie(() => R.resoudreCiblesFavoris({ uid: uA, capture: capA, trace: trace(uA), selection: ['x'], lectures: [nav(2000000001, 3000000001), nav(2000000002, 3000000002)], parametresSeuls: true }));
  dit(Array.isArray(params) && params.length === 1 && params[0].cle === 'offering_id', 'compte A : le paramètre offering_id est prouvé par deux personnes distinctes', JSON.stringify(params));
  const une = essaie(() => R.resoudreCiblesFavoris({ uid: uA, capture: capA, trace: trace(uA), selection: ['x'], lectures: [nav(2000000001, 3000000001)], parametresSeuls: true }));
  dit(Array.isArray(une) && une.length === 0, 'une seule ouverture ne prouve pas le paramètre (règle inchangée)', JSON.stringify(une));
  // Compte B : aucune ouverture ; mêmes formes de lien, user_id commun.
  const uB = '1000000002';
  const capB = { uid: uB, type: 'notifications', domain: 'www.vinted.fr', payload: { notifications: [N(3, 2000000003, 3000000003), N(4, 2000000003, 3000000004), N(5, 2000000004, 3000000005)] } };
  const sans = essaie(() => R.resoudreCiblesFavoris({ uid: uB, capture: capB, trace: trace(uB), selection: ['n3'] }));
  dit(sans.erreur === 'favoris_preuve_absente', 'compte B sans preuve d\'ailleurs : refusé, rien n\'est envoyé', JSON.stringify(sans));
  const r = essaie(() => R.resoudreCiblesFavoris({ uid: uB, capture: capB, trace: trace(uB), selection: ['n3', 'n4', 'n5'], parametresAilleurs: Array.isArray(params) ? params : [] }));
  const dest = Array.isArray(r) ? r.map((t) => t.recipientId) : r;
  dit(Array.isArray(r) && dest.join(',') === '3000000003,3000000004,3000000005', 'compte B avec la preuve de A : chaque favori part vers SA personne (offering_id)', JSON.stringify(dest));
  dit(Array.isArray(r) && !dest.includes(String(COMMUN)), 'jamais vers le user_id commun des notifications', JSON.stringify(dest));
  const contre = essaie(() => R.resoudreCiblesFavoris({ uid: uB, capture: capB, trace: trace(uB), selection: ['n3'], parametresAilleurs: [{ forme: 'vinted.fr/want_it?offering_id', cle: 'offering_id' }, { forme: 'vinted.fr/want_it?offering_id', cle: 'autre' }] }));
  dit(!Array.isArray(contre), 'deux clés qui se contredisent pour une forme : refusé', JSON.stringify(contre));
  // La route ne lit que les comptes de CE vendeur.
  let route = fs.readFileSync(path.join(__dirname, '..', 'api', '_lib', 'favoris.js'), 'utf8');
  if (mut === 'owner') route = route.replace('app_data?owner=eq.${owner}&or=(', 'app_data?or=(');
  const f = /async function parametresDesAutresComptes[\s\S]*?\n}\n/.exec(route);
  dit(!!f && /app_data\?owner=eq\.\$\{owner\}&or=\(/.test(f[0]) && /r\.owner!==owner/.test(f[0]) && /m\[1\]===uid/.test(f[0]), 'la route ne lit que les autres comptes de CE vendeur', f ? 'trouvée' : 'absente');
  console.log(ko ? `\n❌ favoris, autres comptes : ${ko} rouge(s)` : '\n✅ favoris, autres comptes : tout est vert');
  process.exit(ko ? 1 : 0);
})();
