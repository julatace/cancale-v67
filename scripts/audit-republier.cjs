// ════════════════════════════════════════════════════════════════════════════
//  REPUBLICATION VINTED — BAISSE DE PRIX EN PLACE, SOUS GARDE (§4.10, EXÉCUTÉ)
//
//  Tranche 5 de l'atelier. Julien : « mettre en brouillon sur Vinted, attendre,
//  publier… baisser de tant de pourcentage le prix ». La forme SÛRE et mesurable
//  aujourd'hui : MODIFIER l'annonce en place (`PUT …/item_upload/items/{id}`)
//  avec un prix baissé — jamais une suppression, jamais une création : rien ne
//  peut être perdu (le pire cas est un prix refusé par Vinted).
//
//  On EXÉCUTE le vrai `republierVinted` de `background.js` dans un `vm` (faux
//  Vinted qui COMPTE les requêtes, fausse base à état) et on exige :
//    · tout prêt (confirmé · bon compte · coffre sauvegardé · modèle de CETTE
//      annonce appris) ⇒ UN seul PUT part, avec le prix BAISSÉ ;
//    · sans confirmation · autre compte Vinted · coffre non sauvegardé · coffre
//      illisible · modèle absent · modèle illisible ⇒ RIEN ne part (0 requête) ;
//    · le PLANCHER est respecté (une baisse ne descend jamais sous le prix donné) ;
//    · Vinted refuse ⇒ « échec », et toujours AUCUNE suppression ni création ;
//    · le MODÈLE se capte par annonce, et une lecture ratée ne l'efface pas.
//
//  §6.1 — `--prouve` rejoue « tout prêt » sur le background.js de `origin/main`
//  (où `republierVinted` n'existe pas) : 0 requête ⇒ rouge sur le code d'avant.
// ════════════════════════════════════════════════════════════════════════════
const { faireFond } = require('./_fond-vm.cjs');

let ok = 0, ko = 0;
const dit = (c, msg, det) => { if (c) { ok++; console.log('✅ ' + msg); } else { ko++; console.log('❌ ' + msg + (det ? '  → ' + det : '')); } };
const nowISO = () => new Date().toISOString();
const MODELE = JSON.stringify({ item: { id: 9101, title: 'Nike Air Max 1', description: 'nickel', price: '60.0', currency: 'EUR', catalog_id: 1234 } });

function monter({ confirme = true, pct = 10, plancher = null, connecte = '111', comptes = null, coffre = true, modele = true, coffreKO = false, modeleKO = false, vintedStatus = 200, src } = {}) {
  const lignes = { main: { capturedAt: nowISO(), vinted_annonce_numeros: { '9101': { numero: '41' } } } };
  if (coffre) lignes['coffre_111_9101'] = { id: '9101', photos: ['a', 'b'], description: 'nickel' };
  if (modele) lignes['vrm_vinted_modele'] = { '9101': { corps: MODELE, at: nowISO(), uid: '111' } };
  const lectureKO = (u) => (coffreKO && /id=eq\.coffre_111_9101/.test(u)) || (modeleKO && /id=eq\.vrm_vinted_modele/.test(u));
  return faireFond({ src, lignes, connecte, comptes, lectureKO,
    vinted: (e) => (e.methode === 'PUT' && /\/api\/v2\/item_upload\/items\/9101$/.test(e.chemin)) ? { status: vintedStatus, body: {} } : { status: 404, body: {} } });
}
const puts = (j) => j.vinted.filter((v) => v.methode === 'PUT' && /\/item_upload\/items\/9101$/.test(v.chemin));
const dangers = (j) => j.vinted.filter((v) => /\/items\/\d+\/delete$/.test(v.chemin) || (v.methode === 'POST' && /\/item_upload\/items\/?$/.test(v.chemin)));

async function run(opts) {
  const f = monter(opts);
  if (typeof f.ctx.republierVinted !== 'function') return { f, r: { absent: true }, absent: true };
  const confirme = !(opts && opts.confirme === false);   // confirmé par défaut, sauf si explicitement false
  let r = {}; try { r = await f.ctx.republierVinted({ cmd: 'republierVinted', uid: '111', id: '9101', baissePct: opts && opts.pct != null ? opts.pct : 10, plancher: opts && opts.plancher, confirme }); } catch (e) { r = { erreur: String(e.message) }; }
  return { f, r };
}

(async () => {
  if (process.argv.includes('--prouve')) {
    const cp = require('child_process'), os = require('os'), fs = require('fs'), path = require('path');
    const avant = path.join(os.tmpdir(), 'bg-avant-republier.js');
    fs.writeFileSync(avant, cp.execSync('git show origin/main:vinted-sync-extension/background.js', { cwd: path.join(__dirname, '..'), maxBuffer: 64 * 1024 * 1024 }));
    const { f, absent } = await run({ src: avant });
    dit(puts(f.j).length === 0, "§6.1 — sur origin/main, aucune requête ne part (republierVinted n'existe pas)", `puts=${puts(f.j).length} absent=${!!absent}`);
    console.log(ko ? `\n❌ preuve §6.1 : ${ko} rouge(s)` : `\n✅ preuve §6.1 : rien ne partait avant — il fallait l'ajouter`);
    process.exit(ko ? 1 : 0);
  }

  // A — tout prêt : UN PUT, prix baissé de 10 % (60 → 54), aucune suppression/création.
  { const { f, r } = await run({ pct: 10 });
    const p = puts(f.j);
    dit(p.length === 1 && r.etape === 'fait', "tout prêt : UN seul PUT part (modification en place)", `puts=${p.length} etape=${r.etape} code=${r.code || ''}`);
    let prix = null; try { const b = JSON.parse(p[0].corps); prix = (b.item && b.item.price); } catch (_) {}
    dit(prix === '54', "le prix part BAISSÉ de 10 % (60 → 54), rien d'autre n'est touché", 'prix=' + JSON.stringify(prix));
    dit(dangers(f.j).length === 0, "AUCUNE suppression ni création : la republication ne peut rien perdre", `dangers=${dangers(f.j).length}`); }

  // B — plancher : baisse de 90 % mais plancher 30 ⇒ le prix ne descend pas sous 30.
  { const { f, r } = await run({ pct: 90, plancher: 30 });
    let prix = null; try { prix = JSON.parse(puts(f.j)[0].corps).item.price; } catch (_) {}
    dit(prix === '30' && r.nouveau === 30, "plancher respecté : −90 % bute sur le plancher (30), jamais en dessous", 'prix=' + JSON.stringify(prix)); }

  // C — sans confirmation : rien.
  { const { f, r } = await run({ confirme: false });
    dit(puts(f.j).length === 0 && r.code === 'confirmation', "sans confirmation : rien ne part (ce geste change le prix sur Vinted)", `puts=${puts(f.j).length} code=${r.code}`); }

  // D — navigateur sur un AUTRE compte : le compte 111 EXISTE, mais Chrome est
  //     connecté sur 999 ⇒ garde stricte, rien.
  { const { f, r } = await run({ connecte: '999', comptes: [{ vinted_user_id: '111', login: 'c', domain: 'www.vinted.fr', access_token: 'j' }] });
    dit(puts(f.j).length === 0 && /autre/.test(r.code || ''), "autre compte Vinted connecté : la garde bloque, rien ne part (§3)", `puts=${puts(f.j).length} code=${r.code}`); }

  // E — coffre non sauvegardé : rien (on ne touche pas sans filet).
  { const { f, r } = await run({ coffre: false });
    dit(puts(f.j).length === 0 && r.code === 'coffre-absent', "coffre non sauvegardé : rien ne part — on ne modifie rien sans filet", `puts=${puts(f.j).length} code=${r.code}`); }

  // F — coffre illisible : rien (pas su ≠ pas de filet).
  { const { f, r } = await run({ coffreKO: true });
    dit(puts(f.j).length === 0 && r.code === 'coffre-lecture', "coffre illisible (522) : rien ne part — « pas su » ne vaut pas « sauvegardé »", `puts=${puts(f.j).length} code=${r.code}`); }

  // G — modèle jamais appris pour cette annonce : rien (on ne devine pas une structure).
  { const { f, r } = await run({ modele: false });
    dit(puts(f.j).length === 0 && r.code === 'modele-absent', "modèle jamais vu pour CETTE annonce : rien ne part — on ne devine pas le format", `puts=${puts(f.j).length} code=${r.code}`); }

  // H — modèle illisible (522) : rien, et c'est « pas su », pas « absent ».
  { const { f, r } = await run({ modeleKO: true });
    dit(puts(f.j).length === 0 && r.code === 'modele-lecture', "modèle illisible (522) : rien ne part, distinct de « jamais appris »", `puts=${puts(f.j).length} code=${r.code}`); }

  // I — Vinted REFUSE : « échec », et toujours aucune suppression/création.
  { const { f, r } = await run({ vintedStatus: 422 });
    dit(r.etape === 'echec' && dangers(f.j).length === 0, "Vinted refuse : « échec » dit, annonce inchangée, aucune suppression ni création", `etape=${r.etape} dangers=${dangers(f.j).length}`); }

  // J — capture du modèle PAR annonce (lire-fusionner-réécrire), et pas sur une lecture ratée.
  { const f = monter({ modele: false });
    const corps = JSON.stringify({ item: { id: 9102, price: '40.0', title: 'x' } });
    const w1 = await f.ctx.noterModeleRepub('9102', corps, '111', 'www.vinted.fr');
    dit(w1 !== false && f.lignes.vrm_vinted_modele && f.lignes.vrm_vinted_modele['9102'], "le modèle de republication est capté PAR annonce (vrm_vinted_modele[id])", JSON.stringify(Object.keys(f.lignes.vrm_vinted_modele || {}))); }
  { const f = monter({ modele: true });
    // lecture ratée du modèle pendant l'écriture ⇒ on n'écrase pas ce qui est appris
    const avant = JSON.stringify(f.lignes.vrm_vinted_modele);
    f.ctx.sbGet = async () => null;   // force la lecture à échouer dans noterModeleRepub
    const w = await f.ctx.noterModeleRepub('9203', JSON.stringify({ item: { id: 9203, price: '10' } }), '111', 'www.vinted.fr');
    dit(w === false && JSON.stringify(f.lignes.vrm_vinted_modele) === avant, "une lecture ratée n'efface pas les modèles déjà appris (rien lu ≠ rien)", String(w)); }

  console.log(ko
    ? `\n❌ audit-republier : ${ko} rouge(s), ${ok} vert(s)`
    : `\n✅ audit-republier : ${ok} contrôles — la baisse de prix part sous garde, et rien ne part dans les sept cas refusés`);
  process.exit(ko ? 1 : 0);
})();
