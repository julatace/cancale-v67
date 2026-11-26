#!/usr/bin/env node
// VESTIAIRE : « EN ATTENTE DE VALIDATION » (22 nov.) — Julien : « sur Vestiaire Collective, voir quand une
// annonce est en attente de validation ». Exécute :
//   · la VRAIE règle api/_lib/vestiaire-regle.js (familles, `moderationVc`, `compteursVc`,
//     `transitionModerationVc`, `annoncesVcEnLigne`) ;
//   · le VRAI vc-inject.js dans une fausse page Vestiaire, le VRAI relais vc.js et le VRAI background.js
//     (`_fond-vm.cjs`, base à état) : les compteurs `users/me/products/count` (forme mesurée en production le
//     22 nov., noms de clés seulement) sont rangés sous le compte de l'onglet ; une annonce qui passe de
//     « en attente » à « en ligne » ou « refusée » entre deux lectures est notée — jamais une disparition.
// Données INVENTÉES. ⚠️ Le mot d'une annonce en attente (`type` de son enveloppe) n'a jamais été vu sur un
// vrai compte : les mots servis ici suivent le vocabulaire des compteurs de Vestiaire (waitingValidation…).
// `--prouve` : chaque règle réaffaiblie fait rougir l'audit.
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/vc-inject.js')),
  relais: arg('--relais', path.join(racine, 'vinted-sync-extension/vc.js')),
  regle: arg('--regle', path.join(racine, 'api/_lib/vestiaire-regle.js')),
};
if (process.argv.includes('--prouve')) {
  const MUT = [
    ['attenteEnLigne', 'regle', "if (!num || etatAnnonceVcBrut(it, vendus.has(String(id)), d.capturedAt) !== 'en-ligne') continue;", "if (!num || ['retiree', 'vendue'].includes(etatAnnonceVcBrut(it, vendus.has(String(id)), d.capturedAt))) continue;"],
    ['photosAvantAttente', 'regle', "  ['corriger', /waiting.?(picture|photo)", "  ['corriger-off', /zzzz|(picture|photo)"],
    ['refuseeRetiree', 'regle', "  ['refusee', /invalid|reject|refus/i, 'Refusée par Vestiaire'],", "  ['retiree', /invalid|reject|refus/i, 'Retirée'],"],
    ['compteurZero', 'regle', "const n = (x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : null);", "const n = (x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);"],
    ['gesteAttente', 'regle', "export const vcModerationGeste = (etat) => etat === 'corriger';", "export const vcModerationGeste = (etat) => etat === 'corriger' || etat === 'attente';"],
    ['disparitionValidee', 'regle', "  if (!a || !b || a === b) return '';\n  if ((a === 'attente' || a === 'corriger') && b === 'en-ligne') return 'validee';", "  if (a === 'attente' && !b) return 'validee';\n  if (!a || !b || a === b) return '';\n  if ((a === 'attente' || a === 'corriger') && b === 'en-ligne') return 'validee';"],
    ['compteurSansCompte', 'src', 'if (patch.compteurs && compte) {', 'if (patch.compteurs) {'],
    ['compteurInvente', 'inject', "if (Object.values(c).every((x) => x == null)) return;", ''],
    ['compteurAutreChemin', 'inject', "!/\\/users\\/me\\/products\\/count\\/?$/i.test(u.pathname)", "!/count/i.test(u.pathname)"],
    ['fondTransition', 'src', "if (versMod) { lus[id].moderation = { vers: versMod, at: maintenant, de: String(avantMod || '').slice(0, 40) };", "if (false) { lus[id].moderation = { vers: versMod, at: maintenant, de: String(avantMod || '').slice(0, 40) };"],
    ['fondFamilles', 'src', "  ['refusee', /invalid|reject|refus/i],", "  ['refusee', /zzzz/i],"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-moderation-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    // La règle importe ses voisins par chemin relatif : sa copie mutée vit à côté d'elle.
    const fichier = cle === 'regle' ? path.join(path.dirname(F.regle), `.audit-vcmod-${process.pid}-${nom}.mjs`) : path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 180000 });
    if (cle === 'regle') { try { fs.unlinkSync(fichier); } catch (_) {} }
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0, n = 0;
const dit = (ok, nom, det) => { n++; if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${!ok && det ? ' — ' + det : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const copie = (x) => JSON.parse(JSON.stringify(x));
const API = 'https://apiv2.vestiairecollective.com';
const ORIGINE = 'https://fr.vestiairecollective.com';
// Le pilote de page et le relais : les MÊMES que scripts/audit-capture-vc-lbc.cjs (son texte, exécuté ici).
const pilote = (() => {
  const t = fs.readFileSync(path.join(__dirname, 'audit-capture-vc-lbc.cjs'), 'utf8');
  const i = t.indexOf('function pageVc() {'), j = t.indexOf('const senderVc =');
  if (i < 0 || j < 0) throw new Error('pilote de page introuvable dans audit-capture-vc-lbc.cjs');
  // (5.446) le pilote sert le canal privé Vestiaire (`FauxCanal`, scripts/_canal-faux.cjs).
  return new Function('fs', 'vm', 'F', 'copie', 'attendre', 'API', 'ORIGINE', 'URL', 'Buffer', 'console', 'FauxCanal', t.slice(i, j) + '\nreturn { pageVc, relais };')(fs, vm, F, copie, attendre, API, ORIGINE, URL, Buffer, console, require('./_canal-faux.cjs').FauxCanal);
})();
const senderVc = (tab) => ({ tab: { id: tab, url: ORIGINE + '/listings/' }, frameId: 0, url: ORIGINE + '/listings/' });
// La forme MESURÉE de « Mes articles » : une enveloppe `{ type, [type]: { product: {…}, listingDate } }`.
const env = (type, id, titre) => ({ type, [type]: { product: { id, headline: titre, subHeadline: 'T40', price: { cents: 12000, currency: 'EUR', formatted: '120 €' }, picturePath: `${id}-1_3.jpg`, path: `/x/${id}.shtml` }, listingDate: '2026-11-20T10:00:00+00:00' } });

(async () => {
  try {
    const V = await import(pathToFileURL(F.regle).href);
    // ── 1. La règle : le vocabulaire de Vestiaire ──
    const fam = (mot) => V.etatAnnonceVcBrut({ statut: mot, vuAt: '2026-11-22T10:00:00Z' }, false, '2026-11-22T10:00:00Z');
    dit(fam('published') === 'en-ligne' && fam('onSale') === 'en-ligne', 'R1 · « published » (le seul mot vu chez lui) et « onSale » : en ligne', [fam('published'), fam('onSale')].join());
    dit(fam('waitingValidation') === 'attente' && fam('pendingValidation') === 'attente' && fam('inReview') === 'attente', 'R1 · « waitingValidation » (le nom du compteur de Vestiaire) : en attente de validation', [fam('waitingValidation'), fam('pendingValidation'), fam('inReview')].join());
    dit(fam('waitingPicture') === 'corriger', 'R1 · « waitingPicture » : À CORRIGER (des photos sont attendues), pas « en attente »', fam('waitingPicture'));
    dit(fam('refused') === 'refusee' && fam('rejected') === 'refusee', 'R1 · « refused » : refusée par Vestiaire — PAS « retirée » (la paire est toujours chez lui)', [fam('refused'), fam('rejected')].join());
    dit(fam('unpublished') === 'retiree' && fam('sold') === 'vendue' && fam('zorglub') === 'autre' && fam('') === 'pas-dit', 'R1 · retirée, vendue ; un mot inconnu reste « autre », aucun mot « pas dit » (jamais deviné)', [fam('unpublished'), fam('sold'), fam('zorglub'), fam('')].join());
    dit(V.moderationVc({ statut: 'waitingValidation', vuAt: '2026-11-22T10:00:00Z' }, '2026-11-22T10:00:00Z') === 'attente' && V.moderationVc({ statut: 'published', vuAt: '2026-11-22T10:00:00Z' }, '2026-11-22T10:00:00Z') === '', 'R1 · `moderationVc` : en attente ⇒ « attente » ; en ligne ⇒ rien');
    dit(V.vcModerationGeste('corriger') === true && V.vcModerationGeste('attente') === false && V.vcModerationGeste('refusee') === false, 'R2 · l’ambre seulement s’il y a un GESTE : « à corriger » — attendre n’en est pas un', JSON.stringify(['corriger', 'attente', 'refusee'].map(V.vcModerationGeste)));
    // ── 2. « En ligne » : une annonce en attente est PRÉSENTE, pas en ligne ──
    const frais = new Date(Date.now() - 3600e3).toISOString();
    const lst = { capturedAt: frais, items: { 101: { statut: 'published', ref: '11', vuAt: frais, titre: 'A' }, 102: { statut: 'waitingValidation', ref: '12', vuAt: frais, titre: 'B' }, 103: { statut: 'refused', ref: '13', vuAt: frais, titre: 'C' }, 104: { statut: 'waitingPicture', ref: '14', vuAt: frais, titre: 'D' } }, liens: {},
      compteurs: { c37: { enVente: 1, attenteValidation: 2, attentePhoto: 1, refusees: 1, vendues: 0, nonRecues: null, at: frais } } };
    for (const it of Object.values(lst.items)) it.compte = 'c37';
    const EL = V.annoncesVcEnLigne(lst, {});
    dit(EL.lue && EL.parNum.has('11') && !EL.parNum.has('12') && !EL.parNum.has('13') && !EL.parNum.has('14'), 'R3 · `annoncesVcEnLigne` : seule l’annonce « published » est EN LIGNE ; en attente, à corriger, refusée ne le sont pas', [...EL.parNum.keys()].join());
    // ── 3. Les compteurs ──
    const K = V.compteursVc(lst, 'c37');
    dit(K && K.attente === 2 && K.photos === 1 && K.refusees === 1 && K.enVente === 1 && K.vieux === false, 'R4 · `compteursVc` : les nombres de Vestiaire, sous leur nom', JSON.stringify(K));
    dit(K && K.lus.attente === 1 && K.inconnues.attente === 1 && K.inconnues.photos === 0 && K.inconnues.refusees === 0, 'R4 · Vestiaire compte 2 en attente, UNE annonce lue le porte ⇒ 1 « laquelle : pas su » (dit, jamais attribué)', JSON.stringify(K && [K.lus, K.inconnues]));
    dit(V.compteursVc(lst, 'autre') === null && V.compteursVc({ items: {} }, 'c37') === null, 'R4 · compteurs jamais lus pour ce compte : `null` (« pas su »), jamais 0');
    const K2 = V.compteursVc({ items: {}, compteurs: { c37: { attenteValidation: null, refusees: 3, at: '2026-01-01T00:00:00Z' } } }, 'c37');
    dit(K2 && K2.attente === null && K2.inconnues.attente === null && K2.refusees === 3 && K2.vieux === true, 'R4 · un compteur pas lu reste `null` ; une lecture de plus de 24 h est dite « vieille »', JSON.stringify(K2));
    // ── 4. Les transitions ──
    const T = V.transitionModerationVc;
    dit(T('waitingValidation', 'published') === 'validee' && T('waitingValidation', 'refused') === 'refusee' && T('waitingValidation', 'waitingPicture') === 'corriger', 'R5 · en attente → en ligne = « validée » ; → refusée ; → à corriger');
    dit(T('waitingValidation', '') === '' && T('', 'published') === '' && T('published', 'published') === '' && T('published', 'sold') === '', 'R5 · jamais déduit d’une DISPARITION ni d’une annonce jamais vue en attente', [T('waitingValidation', ''), T('', 'published'), T('published', 'published')].join('|'));
    // ── 5. La règle de l'extension = la règle de l'app (bloc <vc-moderation-regle>) ──
    const bg = fs.readFileSync(F.src, 'utf8');
    const b0 = bg.indexOf('// <vc-moderation-regle>'), b1 = bg.indexOf('// </vc-moderation-regle>');
    dit(b0 > 0 && b1 > b0, 'E1 · le bloc <vc-moderation-regle> existe dans background.js');
    const cx = {}; vm.createContext(cx);
    vm.runInContext(bg.slice(b0, b1) + '\nthis.familleModVc = familleModVc; this.transitionModVc = transitionModVc;', cx);
    const MOTS = ['published', 'onSale', 'waitingValidation', 'waitingPicture', 'refused', 'rejected', 'sold', 'unpublished', 'unreceived', 'draft', 'inReview', 'unpublishedSubmitted', 'zorglub', '', 'approved', 'invalid', 'toCorrect'];
    const ecartsF = MOTS.filter((m) => (cx.familleModVc(m) || 'pas-dit') !== fam(m));
    const ecartsT = []; for (const a of MOTS) for (const b of MOTS) if (cx.transitionModVc(a, b) !== T(a, b)) ecartsT.push(a + '→' + b);
    dit(ecartsF.length === 0 && ecartsT.length === 0, `E1 · extension et app : mêmes familles (${MOTS.length} mots) et mêmes transitions (${MOTS.length * MOTS.length} paires)`, JSON.stringify({ ecartsF, ecartsT: ecartsT.slice(0, 5) }));
    // ── 6. La chaîne : page → relais → fond ──
    const p = pilote.pageVc(), r = pilote.relais();
    await p.charge(`${API}/users/me`, { data: { id: 'c37', type: 'user' } });
    const cpt = await p.charge(`${API}/users/me/products/count?isoCountry=FR`, { data: { productOnSale: 1, productWaitingPicture: 0, productWaitingValidation: 2, productSold: 4, productRefused: 1, productUnreceived: 0 }, meta: { limit: 0, offset: 0, count: 0 } });
    const mc = cpt.find((x) => x.kind === 'vccompteurs');
    dit(mc && mc.compteurs.attenteValidation === 2 && mc.compteurs.refusees === 1 && mc.compteurs.attentePhoto === 0 && mc.moi === 'c37', 'C1 · la page lit `users/me/products/count` (sa propre requête) : six nombres sous leur nom', JSON.stringify(mc));
    const vide = await p.charge(`${API}/users/me/products/count?x=2`, { data: { autre: 3 }, meta: {} });
    dit(!vide.some((x) => x.kind === 'vccompteurs'), 'C1 · aucune des six clés ⇒ rien n’est dit (jamais six zéros inventés)', JSON.stringify(vide.map((x) => x.kind)));
    const ailleurs = await p.charge(`${API}/users/me/likes/count`, { data: { productWaitingValidation: 9 } });
    dit(!ailleurs.some((x) => x.kind === 'vccompteurs'), 'C1 · une autre adresse qui finit par « count » n’est pas lue');
    const avantReq = p.appels.length;
    dit(p.appels.slice(0, avantReq).every((a) => /users\/me$|products\/count|likes\/count/.test(a.u.split('?')[0])), 'C1 · VRM n’envoie AUCUNE requête de plus à Vestiaire pour ça (lecture au passage)', JSON.stringify(p.appels.map((a) => a.u)));
    const mr = mc ? r(mc).find((y) => y.action === 'vcCompteurs') : null;
    dit(mr && mr.compteurs.attenteValidation === 2 && mr.moi === 'c37', 'C2 · le relais transmet les compteurs rebâtis champ par champ', JSON.stringify(mr));
    const f = faireFond({ src: F.src, lignes: { vc_listings: { items: {}, liens: {} } } });
    await f.envoyer(mr || { from: 'cancale-vc', action: 'vcCompteurs', compteurs: { attenteValidation: 2 }, moi: 'c37' }, senderVc(31));
    dit(!(f.lignes.vc_listings.compteurs), 'C3 · le fond : onglet dont le compte n’est PAS su ⇒ les compteurs ne sont rangés sous aucun compte', JSON.stringify(f.lignes.vc_listings.compteurs));
    await f.ctx.noterSessionVc('c37', 31, []);
    await f.envoyer(mr || { from: 'cancale-vc', action: 'vcCompteurs', compteurs: { attenteValidation: 2 }, moi: 'c37' }, senderVc(31));
    const kc = (f.lignes.vc_listings.compteurs || {}).c37;
    dit(kc && kc.attenteValidation === 2 && kc.refusees === 1 && kc.enVente === 1 && typeof kc.at === 'string', 'C3 · le fond : compteurs rangés sous le compte de l’ONGLET, datés', JSON.stringify(kc));
    // Une annonce en attente, puis validée ; une autre refusée ; une troisième DISPARUE (rien n'est dit).
    const lire = async (data) => { const posts = await p.charge(`${API}/users/me/product-listings?limit=10&offset=0&n=${Math.random()}`, { data, meta: { limit: 10, offset: 0, count: data.length } }); const a = posts.find((x) => x.kind === 'vcannonces'); const m = a ? r(a).find((y) => y.action === 'vcAnnonces') : null; if (m) await f.envoyer(m, senderVc(31)); return a; };
    const a1 = await lire([env('waitingValidation', 5001, 'Escarpins'), env('waitingValidation', 5002, 'Sac'), env('waitingValidation', 5003, 'Bottes'), env('published', 5004, 'Mocassins')]);
    const it1 = f.lignes.vc_listings.items;
    dit(a1 && a1.items.length === 4 && it1['5001'] && it1['5001'].statut === 'waitingValidation' && !it1['5001'].moderation, 'C4 · une annonce lue en attente : son mot est rangé tel quel (`statut`), aucune transition inventée', JSON.stringify(it1['5001']));
    await lire([env('published', 5001, 'Escarpins'), env('refused', 5002, 'Sac'), env('published', 5004, 'Mocassins')]);
    const it2 = f.lignes.vc_listings.items;
    dit(it2['5001'] && it2['5001'].moderation && it2['5001'].moderation.vers === 'validee' && it2['5001'].statut === 'published', 'C4 · relue « published » : VALIDÉE par Vestiaire, notée sur CETTE annonce (son identifiant)', JSON.stringify(it2['5001'] && it2['5001'].moderation));
    dit(it2['5002'] && it2['5002'].moderation && it2['5002'].moderation.vers === 'refusee', 'C4 · relue « refused » : REFUSÉE, notée', JSON.stringify(it2['5002'] && it2['5002'].moderation));
    dit(!(it2['5003'] && it2['5003'].moderation) && !(it2['5004'] && it2['5004'].moderation), 'C4 · une annonce en attente qui n’est plus dans la liste : RIEN n’est dit (ni validée ni refusée) ; une annonce déjà en ligne non plus', JSON.stringify([it2['5003'] && it2['5003'].moderation, it2['5004'] && it2['5004'].moderation]));
    await lire([env('published', 5001, 'Escarpins'), env('refused', 5002, 'Sac'), env('published', 5004, 'Mocassins')]);
    dit(f.lignes.vc_listings.items['5001'].moderation && f.lignes.vc_listings.items['5001'].moderation.vers === 'validee', 'C4 · la lecture suivante garde l’événement (il n’est pas rejoué ni effacé)');
    dit(f.lignes.vc_listings.compteurs && f.lignes.vc_listings.compteurs.c37, 'C4 · lire les annonces n’efface pas les compteurs');
  } catch (e) { ko++; console.log('❌ exception : ' + ((e && e.stack) || e)); }
  console.log(`\n${ko ? '❌' : '✅'} ${n - ko}/${n} — modération Vestiaire`);
  process.exit(ko ? 1 : 0);
})();
