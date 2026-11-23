// ════════════════════════════════════════════════════════════════════════════
//  LE GARDE-FOU SUR LE PRIX (21 nov., ext. 5.432, choix B de Julien) — STATIQUE + EXÉCUTÉ
//
//  La règle est src/gardePrix.js (<garde-prix-regle>), recopiée dans background.js et
//  api/_lib/garde-prix-regle.js par `--recopie`. On exige :
//    R  la RÈGLE : 4,50 au lieu de 45 ⇒ suspect (frappe + chute) ; sous le prix mini / l'achat + 10 % ;
//       plus de SON seuil % sous le prix actuel ; ≤ 0 jamais (même confirmé) ; à la main un prix suspect
//       ne passe QUE confirmé au centime près ; automatique : jamais (même « confirmé ») ; 5 000 prix
//       automatiques au hasard : aucun sous le plancher ne passe ;
//    C  les copies sont identiques à la source ;
//    S  STATIQUE : chaque écriture de prix ou d'offre du fond (interfaceVinted 'prix' | 'offre',
//       gesteLbcInterface 'prix', les envois Vestiaire de prix / d'offre) porte le billet de la garde, et la
//       fonction qui l'écrit appelle `gardePrixEcriture` AVANT ; chaque chemin nommé (à la main, lot, règle,
//       cycle de vie, favoris, contre-offres, Agent, relances, lots, prix partout) appelle la garde ;
//    V  le VRAI background.js (scripts/_fond-vm.cjs, faux vinted.fr) : la baisse à la main 45 → 4,50 est
//       arrêtée AVANT l'onglet (« garde-confirmer », 0 requête), puis part confirmée à 4,50 (et pas à 4,60) ;
//       la même par la file automatique (règle) ⇒ bloquée, au journal, notifiée ; une contre-offre sous le
//       plancher ⇒ rien ; un appel direct de l'écriture sans billet ⇒ rien ne part ;
//  `--prouve` : chaque mutation (garde contournée, billet non vérifié, auto confirmable, plancher ignoré,
//  frappe ignorée) doit faire rougir au moins un contrôle. `--src <background.js>` : l'arbre d'avant.
//  Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src', 'gardePrix.js');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
const API = path.join(RACINE, 'api', '_lib', 'garde-prix-regle.js');
const RE_BLOC = /(\/\/ <garde-prix-regle>[^\n]*\n)([\s\S]*?)(\/\/ <\/garde-prix-regle>)/;
const blocSource = (s) => { const m = /\/\/ <garde-prix-regle>\n([\s\S]*?)\/\/ <\/garde-prix-regle>/.exec(s); return m ? m[1] : null; };
const blocDe = (s) => { const m = RE_BLOC.exec(s); return m ? m[2] : null; };

if (process.argv.includes('--recopie')) {
  const b = blocSource(fs.readFileSync(SRC, 'utf8'));
  if (!b) { console.error('bloc <garde-prix-regle> introuvable dans src/gardePrix.js'); process.exit(1); }
  for (const f of [BG, API]) {
    const s = fs.readFileSync(f, 'utf8');
    if (!RE_BLOC.test(s)) { console.error('marqueurs absents : ' + f); process.exit(1); }
    fs.writeFileSync(f, s.replace(RE_BLOC, (_, a, __, c) => a + b + c));
    console.log('recopié : ' + path.relative(RACINE, f));
  }
  process.exit(0);
}
const { faireFond } = require('./_fond-vm.cjs');

// ── LA RÈGLE (src, et la copie du background jugé) ──
async function chargerRegleSrc() {
  const f = path.join(os.tmpdir(), `garde-prix-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(f, fs.readFileSync(SRC, 'utf8'));
  try { return await import(f); } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
function regleDeBloc(bloc) {
  if (!bloc) return null;
  const c = {}; vm.createContext(c);
  try { vm.runInContext(bloc + '\n;globalThis.__R = { gardePrixRegle, gardeSeuil, gardePlancher, gardePhrase };', c); return c.__R; } catch (_) { return null; }
}
function controlesRegle(R, nom, dit) {
  if (!R || typeof R.gardePrixRegle !== 'function') { dit(false, `R0 ${nom} : la règle existe`, 'absente'); return; }
  const G = R.gardePrixRegle;
  const a = G({ prixC: 450, actuelC: 4500, mode: 'main' });
  dit(!a.ok && a.aConfirmer && a.raisons.includes('frappe') && a.raisons.includes('chute'), `R1 ${nom} : 4,50 € au lieu de 45 € à la main ⇒ à confirmer (frappe + chute)`, JSON.stringify(a.raisons));
  dit(G({ prixC: 450, actuelC: 4500, mode: 'main', confirmeC: 450 }).ok === true, `R2 ${nom} : confirmé AU CENTIME (450) ⇒ part`);
  dit(G({ prixC: 450, actuelC: 4500, mode: 'main', confirmeC: 460 }).ok === false, `R3 ${nom} : confirmé à un AUTRE chiffre (4,60) ⇒ ne part pas`);
  const b = G({ prixC: 450, actuelC: 4500, mode: 'auto', confirmeC: 450 });
  dit(!b.ok && b.bloque && !b.aConfirmer, `R4 ${nom} : automatique, même « confirmé » ⇒ BLOQUÉ (jamais de confirmation)`, JSON.stringify(b));
  dit(G({ prixC: 3000, actuelC: 4000, plancher: { c: 3500, de: 'mini' }, mode: 'auto' }).raisons.join() === 'plancher', `R5 ${nom} : sous le prix mini ⇒ « plancher »`);
  { const pl = R.gardePlancher(null, 3000); dit(pl && pl.c === 3300 && pl.de === 'achat' && G({ prixC: 3299, actuelC: 4000, plancher: pl, mode: 'auto' }).raisons.includes('plancher') && G({ prixC: 3300, actuelC: 4000, plancher: pl, mode: 'auto' }).ok, `R6 ${nom} : sans prix mini, l'achat + 10 % (33 €) est le plancher`, JSON.stringify(pl)); }
  dit(G({ prixC: 5900, actuelC: 10000, mode: 'auto' }).raisons.includes('chute') && G({ prixC: 6000, actuelC: 10000, mode: 'auto' }).ok && G({ prixC: 5900, actuelC: 10000, seuil: 50, mode: 'auto' }).ok, `R7 ${nom} : plus de 40 % sous le prix ⇒ « chute » ; 40 % juste ⇒ passe ; SON seuil 50 % ⇒ passe`);
  dit(!G({ prixC: 0, actuelC: 4500, mode: 'main', confirmeC: 0 }).ok && G({ prixC: 0, actuelC: 4500, mode: 'main', confirmeC: 0 }).bloque, `R8 ${nom} : 0 € ⇒ jamais, même confirmé`);
  dit(G({ prixC: 45000, actuelC: 4500, mode: 'main' }).raisons.join() === 'frappe', `R9 ${nom} : 450 € au lieu de 45 € (×10 à la hausse) ⇒ « frappe »`);
  dit(G({ prixC: 4000, actuelC: null, mode: 'auto' }).bloque && G({ prixC: 4000, actuelC: null, mode: 'main' }).ok, `R10 ${nom} : automatique sans prix actuel lu ⇒ bloqué (pas su ≠ oui) ; à la main ⇒ son chiffre`);
  dit(G({ prixC: 4000, actuelC: 4500, plancher: { c: 3500 }, mode: 'main' }).ok && G({ prixC: 4000, actuelC: 4500, plancher: { c: 3500 }, mode: 'auto' }).ok, `R11 ${nom} : 45 → 40 € au-dessus du plancher ⇒ passe (à la main comme seul)`);
  dit(G({ prixC: 4000, actuelC: 4500, plancherLu: false, mode: 'auto' }).bloque, `R12 ${nom} : automatique, plancher pas relu ⇒ bloqué`);
  // 5 000 prix automatiques au hasard : aucun qui passe n'est sous le plancher, ni à plus de 40 %, ni ×10.
  let faux = 0, passes = 0;
  for (let i = 0; i < 5000; i++) {
    const act = 100 + Math.floor(Math.random() * 50000), prix = Math.floor(Math.random() * act * 1.3) - 50;
    const pl = Math.random() < 0.7 ? { c: Math.floor(Math.random() * act) + 1 } : null;
    const g = G({ prixC: prix, actuelC: act, plancher: pl, mode: 'auto', confirmeC: prix });
    if (!g.ok) continue;
    passes++;
    const r = act / prix;
    if (prix <= 0 || (pl && prix < pl.c) || prix * 100 < act * 60 || (r >= 9.5 && r <= 10.5)) faux++;
  }
  dit(faux === 0 && passes > 100, `R13 ${nom} : 5 000 prix automatiques au hasard — aucun qui passe n'est suspect`, `passes=${passes} faux=${faux}`);
}

// ── STATIQUE ──
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n');
function fonctionsDe(src) {
  const out = [];
  const re = /^(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/gm; let m;
  const pos = [];
  while ((m = re.exec(src))) pos.push({ nom: m[1], at: m.index });
  for (let i = 0; i < pos.length; i++) out.push({ nom: pos[i].nom, debut: pos[i].at, corps: src.slice(pos[i].at, i + 1 < pos.length ? pos[i + 1].at : src.length) });
  return out;
}
const enclosant = (fns, at) => { let f = null; for (const x of fns) if (x.debut <= at) f = x; return f; };
const argsDe = (s, at) => { const i = s.indexOf('(', at); let d = 0; for (let k = i; k < s.length && k < i + 4000; k++) { if (s[k] === '(') d++; else if (s[k] === ')') { d--; if (!d) return s.slice(i, k + 1); } } return s.slice(i, i + 400); };
const ECRIVAINS = ['baisserPrixVinted', 'republierVinted', 'recreerVinted', 'baisserPrixLbc', 'baisserPrixVestiaire', 'repondreOffreVestiaire', 'offrirAuxAimesVc', 'deroulerAimesVc', 'contreOffreAuto', 'repondreOffre', 'sequenceFavoriBleam', 'executerMessageFavori', 'envoyerRelanceUne', 'envoyerLotFavori', 'changerPrixCarte', 'gesteAppParInterface'];
function controlesStatiques(bgSrc, apiSrc, dit) {
  const s = sansCommentaires(bgSrc);
  const fns = fonctionsDe(s);
  const re = /interfaceVinted\(\s*acc\s*,\s*'(prix|offre)'/g; let m; const sites = [];
  while ((m = re.exec(s))) {
    const f = enclosant(fns, m.index);
    if (f && f.nom === 'interfaceVinted') continue;
    const a = argsDe(s, m.index);
    const avant = f ? s.slice(f.debut, m.index) : '';
    sites.push({ nom: f ? f.nom : '?', geste: m[1], billet: /\bgarde\s*:/.test(a), garde: /gardePrixEcriture\(|ticketGardeValide\(/.test(avant) });
  }
  dit(sites.length >= 6, 'S0 les écritures de prix / d\'offre Vinted sont trouvées', sites.length);
  const sansBillet = sites.filter((x) => !x.billet), sansGarde = sites.filter((x) => !x.garde);
  dit(!sansBillet.length, 'S1 chaque `interfaceVinted(…, \'prix\' | \'offre\')` porte le billet de la garde (`garde:`)', sansBillet.map((x) => x.nom + ':' + x.geste).join(', '));
  dit(!sansGarde.length, 'S2 … et sa fonction appelle la garde AVANT l\'écriture', sansGarde.map((x) => x.nom).join(', '));
  const iv = fns.find((f) => f.nom === 'interfaceVinted');
  dit(!!iv && /geste === 'prix' \|\| geste === 'offre'[\s\S]{0,200}ticketGardeValide\(/.test(iv.corps), 'S3 `interfaceVinted` refuse un prix / une offre sans billet valide');
  const gl = fns.find((f) => f.nom === 'gesteLbcInterface');
  dit(!!gl && /quoi === 'prix' && !ticketGardeValide\(/.test(gl.corps), 'S4 `gesteLbcInterface` refuse un prix sans billet');
  const lbc = []; const reL = /gesteLbcInterface\(\s*'prix'/g; while ((m = reL.exec(s))) { const f = enclosant(fns, m.index); lbc.push({ nom: f && f.nom, billet: /\bgarde\s*:/.test(argsDe(s, m.index)) }); }
  dit(lbc.length >= 1 && lbc.every((x) => x.billet), 'S5 chaque `gesteLbcInterface(\'prix\'…)` porte le billet', JSON.stringify(lbc));
  const vc = []; const reV = /action: 'vc(Prix|Offre)'/g; while ((m = reV.exec(s))) { const f = enclosant(fns, m.index); vc.push({ nom: f && f.nom, garde: f ? /gardePrixEcriture\(/.test(s.slice(f.debut, m.index)) : false }); }
  dit(vc.length >= 3 && vc.every((x) => x.garde), 'S6 chaque envoi de prix / d\'offre Vestiaire passe la garde avant', JSON.stringify(vc));
  const manquent = ECRIVAINS.filter((n) => { const f = fns.find((x) => x.nom === n); return !f || !/gardePrixEcriture\(/.test(f.corps); });
  dit(!manquent.length, 'S7 chaque chemin nommé (main, lot, règle, cycle de vie, favoris, contre-offres, Agent, relances, lots, prix partout, Vestiaire) appelle la garde', manquent.join(', '));
  const api = sansCommentaires(apiSrc || '');
  const hr = fonctionsDe(api).find((f) => f.nom === 'handleRevise');
  dit(!!hr && /gardePrixRegle\(/.test(hr.corps) && hr.corps.indexOf('gardePrixRegle(') < hr.corps.indexOf('ReviseInventoryStatus') + (hr.corps.indexOf('ReviseInventoryStatus') < 0 ? 1e9 : 0), 'S8 eBay (`handleRevise`) : la garde avant l\'écriture');
}

// ── LE VRAI background.js ──
const ID = '91010001', UID = '111';
const MODELE = (prix) => JSON.stringify({ item: { id: Number(ID), title: 'Nike Air Max 1 blanche', description: 'Très bon état', price: { amount: String(prix), currency_code: 'EUR' }, catalog_id: 1234, assigned_photos: [{ id: 501, orientation: 0 }, { id: 502, orientation: 0 }] } });
const LU = (prix) => ({ item: { id: Number(ID), title: 'Nike Air Max 1 blanche', description: 'Très bon état', price: { amount: String(prix), currency_code: 'EUR' }, photos: [{ id: 501 }, { id: 502 }] } });
function monter({ src, lu = 45, fiche = null, seuil = null, listings = null, lbc = null, liensLbc = null, fiches = null, onglets } = {}) {
  const lignes = {};
  lignes[`coffre_${UID}_${ID}`] = { id: ID, photos: ['a', 'b'] };
  lignes.vrm_vinted_modele = { [ID]: { corps: MODELE(lu), at: new Date().toISOString(), uid: UID } };
  lignes.main = { vinted_annonce_numeros: fiches || (fiche ? { [ID]: fiche } : {}), vinted_buyprice_by_num: {}, ...(liensLbc ? { vrm_lbc_liens: liensLbc } : {}) };
  if (seuil != null) lignes.vrm_reglages_auto = { cles: { vrm_seuil_prix: { seuil } } };
  lignes.vinted_listing_dates = {};
  lignes[`harvest_${UID}_listings`] = { payload: { items: listings || [{ id: Number(ID), title: 'Nike Air Max 1 blanche', price: { amount: String(lu), currency_code: 'EUR' } }] } };
  if (lbc) lignes.lbc_listings = { items: lbc };
  let prix = lu;
  const vinted = (e) => {
    if (e.methode === 'GET' && e.chemin === `/api/v2/item_upload/items/${ID}`) return { status: 200, body: LU(prix) };
    if (e.methode === 'PUT' && e.chemin === `/api/v2/item_upload/items/${ID}`) { try { prix = Number(JSON.parse(e.corps).item.price.amount); } catch (_) {} return { status: 200, body: {} }; }
    return { status: 404, body: {} };
  };
  const f = faireFond({ src, lignes, vinted, connecte: UID, ...(onglets ? { onglets } : {}) });
  f.notifs = [];
  try { f.ctx.chrome.notifications = { create: (id, o, cb) => { f.notifs.push(o); if (cb) cb(); } }; } catch (_) {}
  return f;
}
const puts = (f) => f.j.vinted.filter((v) => v.methode === 'PUT');
const baisse = async (f, extra = {}) => {
  if (typeof f.ctx.baisserPrixVinted !== 'function') return { absent: true };
  try { return await f.ctx.baisserPrixVinted({ cmd: 'baisserPrixVinted', uid: UID, id: ID, prix: 4.5, prixAvant: 45, confirme: true, ...extra }); } catch (e) { return { erreur: String(e && e.message) }; }
};
async function controlesFond(bgSrc, dit) {
  { const f = monter({ src: bgSrc }); const r = await baisse(f);
    dit(r.code === 'garde-confirmer' && f.j.vinted.length === 0, 'V1 à la main 45 → 4,50 € ⇒ « à confirmer », AUCUNE requête, aucun onglet touché', `code=${r.code} req=${f.j.vinted.length}`); }
  { const f = monter({ src: bgSrc }); const r = await baisse(f, { gardeConfirmeC: 450 });
    const p = puts(f); let px = null; try { px = JSON.parse(p[0].corps).item.price.amount; } catch (_) {}
    dit(r.accepte === true && r.etape === 'fait' && Number(px) === 4.5, 'V2 … confirmé AU CENTIME ⇒ part (prix tapé 4,5, relu)', `${JSON.stringify(r).slice(0, 160)} put=${px}`); }
  { const f = monter({ src: bgSrc }); const r = await baisse(f, { gardeConfirmeC: 460 });
    dit(r.code === 'garde-confirmer' && puts(f).length === 0, 'V3 … confirmé à un autre chiffre ⇒ rien', r.code); }
  { const f = monter({ src: bgSrc }); const r = await baisse(f, { auto: true, gardeConfirmeC: 450 });
    const jr = ((f.store.vrmJournal || {})[UID] || []).filter((e) => e.s === 'prix_bloque');
    const bl = f.store.vrmGardePrixBloquees || [];
    dit(r.code === 'garde-prix' && f.j.vinted.length === 0, 'V4 la même baisse AUTOMATIQUE (règle) ⇒ BLOQUÉE, aucune requête', `code=${r.code} req=${f.j.vinted.length}`);
    dit(jr.length === 1 && f.notifs.length === 1 && /bloqu/i.test(String(f.notifs[0] && f.notifs[0].title)) && bl.length === 1, 'V5 … au journal (« prix_bloque »), notifiée « Baisse bloquée », dite au panneau', `journal=${jr.length} notifs=${f.notifs.length} panneau=${bl.length}`); }
  { const f = monter({ src: bgSrc, lu: 60 }); const r = await baisse(f, { prix: 54, prixAvant: 60 });
    dit(r.etape === 'fait' && puts(f).length === 1, 'V6 une baisse normale (60 → 54) passe la garde sans rien demander', JSON.stringify(r).slice(0, 120)); }
  { const f = monter({ src: bgSrc, lu: 60, fiche: { numero: '12', min: 50 } }); const r = await baisse(f, { prix: 48, prixAvant: 60 });
    dit(r.code === 'garde-confirmer' && r.garde && r.garde.raisons.includes('plancher') && f.j.vinted.length === 0, 'V7 à la main sous le prix mini (48 < 50) ⇒ à confirmer', r.code); }
  { const f = monter({ src: bgSrc, lu: 60, fiche: { numero: '12', min: 50 } }); const r = await baisse(f, { prix: 48, prixAvant: 60, auto: true });
    dit(r.code === 'garde-prix' && f.j.vinted.length === 0, 'V8 automatique sous le prix mini ⇒ jamais', r.code); }
  { const f = monter({ src: bgSrc, lu: 100, seuil: 60 }); const r = await baisse(f, { prix: 50, prixAvant: 100, auto: true });
    const bl = (f.store.vrmGardePrixBloquees || []).length;
    dit(!/^garde/.test(String(r.code || '')) && bl === 0, 'V9 SON seuil (60 %) ⇒ une baisse de 50 % automatique passe la garde (la suite : ses autres gardes, repos de nuit compris)', JSON.stringify(r).slice(0, 120)); }
  // Écrire SANS la garde : l'écriture elle-même refuse (un chemin oublié n'écrit rien).
  { const f = monter({ src: bgSrc });
    let r1 = null, r2 = null;
    try { const acc = (await f.ctx.getStoredAccounts()).find((a) => String(a.vinted_user_id) === UID); r1 = await f.ctx.interfaceVinted(acc, 'prix', { id: ID, prix: 4.5 }); r2 = await f.ctx.interfaceVinted(acc, 'offre', { conv: '123456', tx: '654321', prix: 4.5, garde: Object.freeze({ site: 'vinted', id: ID, prixC: 450, at: Date.now(), sorte: 'prix' }) }); } catch (e) { r1 = { erreur: String(e.message) }; }
    dit(r1 && r1.rienParti === true && r1.gardeAbsente === true && r2 && r2.gardeAbsente === true && puts(f).length === 0, 'V10 `interfaceVinted` appelé sans billet (ou avec un billet fabriqué) ⇒ rien ne part', JSON.stringify([r1, r2]).slice(0, 200)); }
  // Contre-offre automatique (paliers, Agent) sous le plancher ⇒ rien.
  { const f = monter({ src: bgSrc, lu: 60, fiche: { numero: '12', min: 50 } });
    let r = null; try { const acc = (await f.ctx.getStoredAccounts()).find((a) => String(a.vinted_user_id) === UID); r = await f.ctx.contreOffreAuto({ uid: UID, acc, o: { conv: '123456', tx: '654321', item: ID }, prix: 30, messages: [] }); } catch (e) { r = { erreur: String(e.message) }; }
    dit(r && r.code === 'garde-prix' && f.j.vinted.length === 0, 'V11 contre-offre automatique à 30 € (prix mini 50) ⇒ bloquée, rien ne part', JSON.stringify(r).slice(0, 160)); }
  { const f = monter({ src: bgSrc, lu: 60, fiche: { numero: '12', min: 50 } });
    let r = null; try { r = await f.ctx.repondreOffre({ uid: UID, tx: '654321', oid: '777', item: ID, quoi: 'accept', conv: '123456', prix: 20 }); } catch (e) { r = { erreur: String(e.message) }; }
    dit(r && r.code === 'garde-prix', 'V12 accepter automatiquement une offre de 20 € (prix mini 50, prix 60) ⇒ bloqué', JSON.stringify(r).slice(0, 160)); }
  // PRIX PARTOUT : 50 annonces au MÊME titre sur Vinted et sur Leboncoin ; seule CELLE reliée (N°, lien posé) est désignée.
  { const titre = 'Nike Air Max 1 blanche';
    const listings = [{ id: Number(ID), title: titre, price: { amount: '60.0', currency_code: 'EUR' } }].concat(Array.from({ length: 49 }, (_, i) => ({ id: 92000000 + i, title: titre, price: { amount: '60.0', currency_code: 'EUR' } })));
    const fiches = { [ID]: { numero: '12', accountId: UID } };
    for (let i = 0; i < 49; i++) fiches[String(92000000 + i)] = { numero: String(100 + i), accountId: UID };
    const lbc = {}; for (let i = 0; i < 50; i++) lbc[String(3000000000 + i)] = { id: String(3000000000 + i), subject: titre, status: 'active', price: [60], account: 'lbc-account:77' };
    const f = monter({ src: bgSrc, lu: 60, listings, fiches, lbc, liensLbc: { '3000000007': '12' } });
    f.ctx.relaisSessionOwner = async () => 'owner-banc';
    let s = null; try { s = await f.ctx.sitesDeLArticle('vinted', ID, UID); } catch (e) { s = { erreur: String(e.message) }; }
    const autres = s && Array.isArray(s.sites) ? s.sites.filter((x) => !(x.site === 'vinted' && x.id === ID)) : null;
    dit(!!autres && autres.length === 1 && autres[0].site === 'leboncoin' && autres[0].id === '3000000007', 'V13 prix partout, 50 annonces au même titre sur chaque site : seule l\'annonce Leboncoin RELIÉE (lien posé) est désignée', JSON.stringify(autres || s).slice(0, 200));
    // Le panneau envoie une annonce non reliée : refusée par identité ; la reliée est rangée ; jamais deux sites en même temps.
    let r = null; try { r = await f.ctx.changerPrixCarte({ confirme: true, items: [{ id: ID, prix: '54', prixVu: 60 }, { id: '3000000007', site: 'leboncoin', source: ID, prix: '54', prixVu: 60 }, { id: '3000000003', site: 'leboncoin', source: ID, prix: '54', prixVu: 60 }] }, { tab: { id: 7, url: 'https://www.vinted.fr/member/111' } }); } catch (e) { r = { erreur: String(e.message) }; }
    const refusId = r && Array.isArray(r.refus) ? r.refus.filter((x) => x.code === 'identite').map((x) => x.id) : [];
    const cmds = Object.keys(f.lignes).filter((k) => /^cmd_prix_/.test(k)).map((k) => f.lignes[k]);
    dit(refusId.length === 1 && refusId[0] === '3000000003' && cmds.length === 2 && cmds.some((d) => d.site === 'leboncoin' && d.args.id === '3000000007') && cmds.some((d) => d.site === 'vinted' && d.args.id === ID), 'V14 … le panneau ne peut pas désigner une annonce non reliée (refus « identité ») ; une commande PAR SITE', JSON.stringify({ refusId, cmds: cmds.map((d) => d.site + ':' + d.args.id) }));
    dit(r && Array.isArray(r.attente) && r.attente.some((a) => a.site === 'leboncoin'), 'V15 … sans onglet leboncoin.fr : Leboncoin ATTEND, et c\'est dit', JSON.stringify(r && r.attente));
    try { await f.ctx.prixAttenteTick('banc'); } catch (_) {}
    const apres = Object.keys(f.lignes).filter((k) => /^cmd_prix_/.test(k)).map((k) => f.lignes[k]);
    const partis = apres.filter((d) => d.etat !== 'attente');
    const lbcA = apres.find((d) => d.site === 'leboncoin');
    dit(apres.length === 2 && partis.length <= 1 && lbcA && lbcA.etat === 'attente', 'V16 … une seule file, un site à la fois : un passage traite au plus UNE commande ; Leboncoin (sans onglet) reste en attente', JSON.stringify(apres.map((d) => d.site + ':' + d.etat))); }
  // Prix partout à 4,50 € : la confirmation arrête TOUT le lot (rien n'est rangé).
  { const f = monter({ src: bgSrc, lu: 45 });
    f.ctx.relaisSessionOwner = async () => 'owner-banc'; f.ctx.prixAttenteTick = () => Promise.resolve({});
    let r = null; try { r = await f.ctx.changerPrixCarte({ confirme: true, items: [{ id: ID, prix: '4.5', prixVu: 45 }] }, { tab: { id: 7, url: 'https://www.vinted.fr/member/111' } }); } catch (e) { r = { erreur: String(e.message) }; }
    const cmds = Object.keys(f.lignes).filter((k) => /^cmd_prix_/.test(k));
    dit(r && r.code === 'garde-confirmer' && Array.isArray(r.aConfirmer) && r.aConfirmer[0].prixC === 450 && r.aConfirmer[0].actuelC === 4500 && !cmds.length, 'V17 panneau : 4,50 au lieu de 45 ⇒ la confirmation (chiffres rendus), RIEN rangé', JSON.stringify(r).slice(0, 200));
    let r2 = null; try { r2 = await f.ctx.changerPrixCarte({ confirme: true, items: [{ id: ID, prix: '4.5', prixVu: 45, gardeConfirmeC: 450 }] }, { tab: { id: 7, url: 'https://www.vinted.fr/member/111' } }); } catch (e) { r2 = { erreur: String(e.message) }; }
    const c2 = Object.keys(f.lignes).filter((k) => /^cmd_prix_/.test(k)).map((k) => f.lignes[k]);
    dit(r2 && r2.ok === true && c2.length === 1 && c2[0].gardeConfirmeC === 450, 'V18 … SON « Oui, 4,50 € » ⇒ rangée, le chiffre confirmé voyage avec la commande', JSON.stringify(r2).slice(0, 160)); }
}

const MUTATIONS = [
  { nom: 'garde contournée dans baisserPrixVinted', a: "if (!gp.ok) return { accepte: false, code: gp.code", b: "if (false) return { accepte: false, code: gp.code" },
  { nom: 'billet non vérifié par interfaceVinted', a: "if (!ticketGardeValide(t, 'vinted', Math.round(Number(x.prix) * 100)))", b: "if (false && !ticketGardeValide(t, 'vinted', Math.round(Number(x.prix) * 100)))" },
  { nom: 'automatique confirmable', a: "const confirme = m === 'main' && confirmable", b: "const confirme = confirmable" },
  { nom: 'plancher ignoré', a: "if (pl && p < pl.c) raisons.push('plancher');", b: "" },
  { nom: 'frappe ignorée', a: "if ((r >= 9.5 && r <= 10.5) || (r >= 1 / 10.5 && r <= 1 / 9.5)) raisons.push('frappe');", b: "" },
  { nom: 'garde contournée dans contreOffreAuto', a: "if (!gpO.ok) return { ok: false, code: gpO.code", b: "if (false) return { ok: false, code: gpO.code" },
  { nom: 'billet oublié (offre aux favoris)', a: "garde: gpF.ticket", b: "x: 1" },
  { nom: 'prix partout par titre', a: "if (!autre) { refus.push({ id, site: st, code: 'identite' }); continue; }", b: "if (!autre) autre = { site: st, id, prix: null, compte: '' };" },
  { nom: 'notification oubliée', a: "if (g.mode === 'auto') { try { if (chrome.notifications", b: "if (false) { try { if (chrome.notifications" },
];

async function tout(bgSrc, avecRegle = true) {
  const res = [];
  const dit = (ok, m, d) => res.push({ ok: !!ok, m, d: d == null ? '' : String(d) });
  if (avecRegle) controlesRegle(await chargerRegleSrc(), 'src', dit);
  controlesRegle(regleDeBloc(blocDe(bgSrc)), 'copie du fond', dit);
  if (avecRegle) {
    const b = blocSource(fs.readFileSync(SRC, 'utf8'));
    dit(b && blocDe(bgSrc) === b, 'C1 la copie de background.js est la règle de src/gardePrix.js, à la lettre');
    dit(b && blocDe(fs.readFileSync(API, 'utf8')) === b, 'C2 la copie du serveur (api/_lib/garde-prix-regle.js) aussi');
  }
  controlesStatiques(bgSrc, fs.existsSync(path.join(RACINE, 'api', 'ebay.js')) ? fs.readFileSync(path.join(RACINE, 'api', 'ebay.js'), 'utf8') : '', dit);
  const tmp = path.join(os.tmpdir(), `garde-bg-${process.pid}-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(tmp, bgSrc);
  try { await controlesFond(tmp, dit); } finally { try { fs.unlinkSync(tmp); } catch (_) {} }
  return res;
}

(async () => {
  const i = process.argv.indexOf('--src');
  const bgSrc = fs.readFileSync(i > 0 ? path.resolve(process.argv[i + 1]) : BG, 'utf8');
  const res = await tout(bgSrc, i < 0);
  for (const r of res) console.log(`${r.ok ? '✅' : '❌'} ${r.m}${r.ok || !r.d ? '' : '  — ' + r.d}`);
  const ko = res.filter((r) => !r.ok).length;
  if (process.argv.includes('--prouve')) {
    let tenues = 0;
    for (const mu of MUTATIONS) {
      if (!bgSrc.includes(mu.a)) { console.log(`❌ mutation « ${mu.nom} » : texte introuvable`); continue; }
      const r = await tout(bgSrc.split(mu.a).join(mu.b), false);
      const rouges = r.filter((x) => !x.ok).map((x) => x.m.split(' ')[0]);
      if (rouges.length) tenues++;
      console.log(`${rouges.length ? '✅' : '❌'} mutation « ${mu.nom} » ⇒ ${rouges.length ? 'rouge (' + rouges.join(', ') + ')' : 'RESTE VERT'}`);
    }
    console.log(`\n--prouve : ${tenues}/${MUTATIONS.length} mutations rougissent`);
    if (tenues !== MUTATIONS.length) process.exitCode = 1;
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-garde-prix : ${res.length} contrôles${ko ? `, ${ko} rouges` : ' — une garde unique, aucun chemin ne la contourne, 4,50 au lieu de 45 jamais sans son oui, l\'automatique jamais sous le plancher'}`);
  if (ko) process.exitCode = 1;
})();
