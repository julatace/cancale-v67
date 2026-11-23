// ════════════════════════════════════════════════════════════════════════
//  AUDIT — UNE PAIRE VENDUE EST RETIRÉE PARTOUT (21 nov., choix 49 de Julien, ext. 5.426.0)
//  « C'est la force de l'app » : irréprochable. La chaîne ENTIÈRE, avec les vraies règles :
//    les données de `chargerRetraitsMulti` → `listeRetirerPartout` (src/retirerPartout.js, sur
//    `articlesVendusAilleurs` : identité seulement, jamais le titre) → la liste publiée `vrm_retirer_partout`
//    → le VRAI background.js (scripts/_fond-vm.cjs) : `retirerPartoutTick` met en pause l'annonce Leboncoin
//    par l'interface (`gesteLbcInterface`, servi ici par une fausse page qui dit ce qu'elle a envoyé), sur le
//    compte de l'ONGLET leboncoin.fr, geste appris seulement, réglage allumé seulement ; Vestiaire : rien de
//    cliqué, « à retirer toi-même », sonné à 30 min ; vente annulée ⇒ réactivée ; jamais une suppression.
//  Contrôles :
//    A  le bloc <retirer-partout-regle> est le MÊME dans l'app et l'extension (--recopie le refait) ;
//    L1 50 paires au MÊME titre, une vente Vinted PROUVÉE du N° 17 ⇒ seule l'annonce Leboncoin N° 17 est listée ;
//    L2 une vente NON prouvée (conversation, statut vide : `engagee` null) ⇒ rien ; L3 une vente sans N° ⇒ rien ;
//    L4 l'annonce déjà en pause reste listée (enLigne false) : la sortie de la liste veut dire « vente annulée » ;
//    L5 vente annulée ⇒ hors liste ; L6 un N° ambigu ⇒ liste « pas complète » (rien n'est remis) ;
//    F1 le vrai fond met en pause la BONNE (une seule, N° 17), aucune suppression, registre « retirée » ;
//    F2 aucun onglet leboncoin.fr ⇒ rien, « en attente : onglet », puis l'onglet ouvert ⇒ fait ;
//    F3 l'onglet sur un AUTRE compte Leboncoin ⇒ rien ; F4 réglage éteint ⇒ rien ; F5 geste pas appris ⇒ rien, dit ;
//    F6 vente annulée (liste complète sans l'annonce) ⇒ réactivée par le même chemin ; liste pas complète ⇒ rien ;
//    F7 la page ne dit rien (« je ne sais pas ») ⇒ « incertain », jamais relancé ; F8 Vestiaire ⇒ aucun geste,
//    « à retirer toi-même », et après 30 min UNE sonnerie (/api/push action retraits) ; F9 jamais DELETE, jamais
//    « supprime » ; F10 la liste périmée (> 48 h) ⇒ rien ;
//    N1 le serveur ne sonne que ce qui est en retard ET demandé par l'extension (api/_lib/retraits-retard-notif.js).
//  `--prouve` : chaque mutation doit rougir.  `--recopie` : recopie le bloc de l'app dans l'extension.
//  Aucune donnée réelle : tout est inventé (dépôt public).
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');
const RACINE = path.join(__dirname, '..');
const BG = process.argv.includes('--src') ? path.resolve(process.argv[process.argv.indexOf('--src') + 1]) : path.join(RACINE, 'vinted-sync-extension', 'background.js');   // --src : le fond d'AVANT (§6.1)
const SRC_RP = path.join(RACINE, 'src', 'retirerPartout.js');
const DEB = '// <retirer-partout-regle>', FIN = '// </retirer-partout-regle>';
const bloc = (t) => { const a = t.indexOf(DEB), b = t.indexOf(FIN); return a < 0 || b < 0 ? null : t.slice(a, b + FIN.length); };
if (process.argv.includes('--recopie')) {
  const b = bloc(fs.readFileSync(SRC_RP, 'utf8')); const bg = fs.readFileSync(BG, 'utf8'); const vieux = bloc(bg);
  if (!b || !vieux) { console.log('❌ bloc introuvable'); process.exit(1); }
  fs.writeFileSync(BG, bg.replace(vieux, b)); console.log('✅ bloc recopié dans background.js'); process.exit(0);
}
const H = 3600000, MN = 60000;
const MOI = '0c0c0c0c-0000-4000-8000-00000000000c';
const LBC_A = 'aaaaaaaa-1111-4222-8333-444444444444', LBC_B = 'bbbbbbbb-1111-4222-8333-444444444444';
const TITRE = 'Nike Dunk Low Panda 42';

async function chargerRegles(mut = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retirer-partout-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  try { fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dir, 'node_modules')); } catch (_) {}   // web-push (api/_lib/push.js)
  fs.mkdirSync(path.join(dir, 'api', '_lib'), { recursive: true });
  const lib = path.join(RACINE, 'api', '_lib');
  for (const f of fs.readdirSync(lib)) if (f.endsWith('.js')) { let t = fs.readFileSync(path.join(lib, f), 'utf8'); if (mut[f]) t = mut[f](t); fs.writeFileSync(path.join(dir, 'api', '_lib', f), t); }
  fs.cpSync(path.join(RACINE, 'src'), path.join(dir, 'src'), { recursive: true, filter: (s) => fs.statSync(s).isDirectory() || s.endsWith('.js') });
  for (const f of ['bilanSynchronisation.js', 'retirerPartout.js']) { let t = fs.readFileSync(path.join(RACINE, 'src', f), 'utf8'); if (mut[f]) t = mut[f](t); fs.writeFileSync(path.join(dir, 'src', f), t); }
  const rp = await import(pathToFileURL(path.join(dir, 'src', 'retirerPartout.js')).href);
  const nt = await import(pathToFileURL(path.join(dir, 'api', '_lib', 'retraits-retard-notif.js')).href);
  return { rp, nt, dir };
}

// 50 paires au MÊME titre : une annonce Vinted et une annonce Leboncoin chacune (N° 1 à 50, par identité).
const idV = (n) => String(9105000000 + n), idL = (n) => String(2600000000 + n);
function donnees({ vente = { n: 17, engagee: true }, lbcActive = () => true, manques = [], ambigu = false, vc = false } = {}) {
  const numeros = {}, annonces = [], ventes = [];
  for (let n = 1; n <= 50; n++) {
    numeros[idV(n)] = { numero: String(n), accountId: '111' };
    annonces.push({ id: idV(n), numero: String(n), plateforme: 'Vinted', compte: '111', titre: TITRE, active: !(vente && vente.n === n && vente.engagee === true) });
    annonces.push({ id: idL(n), numero: String(n), plateforme: 'Leboncoin', compte: LBC_A, titre: TITRE, active: lbcActive(n) });
  }
  if (ambigu) { numeros['9105999999'] = { numero: '17', accountId: '111' }; }
  if (vc) annonces.push({ id: '71000017', numero: '17', plateforme: 'Vestiaire', compte: '5555', titre: TITRE, active: true });
  if (vente) ventes.push({ id: idV(vente.n), numero: vente.num === undefined ? String(vente.n) : vente.num, plateforme: 'Vinted', engagee: vente.engagee });
  return { numeros, annonces, ventes, manques, memes: [] };
}

// Le vrai fond, une fausse page Leboncoin : elle dit ce qu'elle a envoyé (`rep`), ou rien (null).
function fond({ src, liste, reglage = { leboncoin: true }, ui = { pause: true, reprise: true }, onglet = LBC_A, items, registre, rep = () => ({ ok: true, statut: 200, geste: true, confirme: true }) }) {
  const st = {};
  st.vrmSession = { access_token: 'jeton.vrm.banc', refresh_token: 'rt', expires_at: Date.now() + H, user_id: MOI, email: 'banc@exemple.fr' };
  st.vrmCloisonne = true;
  const page = { modele: '/compte/part/mes-annonces', recherche: '' };
  st.vrmLbcUi = {};
  for (const q of ['pause', 'reprise']) if (ui[q]) st.vrmLbcUi[q] = { etapes: [{ sig: { tag: 'button', attrs: { 'aria-label': 'Plus' } }, portee: 'ligne' }, { sig: { tag: 'button', attrs: {}, mot: 'Confirmer' }, portee: 'page' }], page };
  const onglets = [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete' }];
  if (onglet) { onglets.push({ id: 8, url: 'https://www.leboncoin.fr/compte/part/mes-annonces', status: 'complete' }); st.vrmLbcTransport = { 8: { source: 'prive', compte: 'lbc-account:' + onglet, at: Date.now() } }; }
  const lignes = {
    main: { vrm_retirer_partout: liste, vrm_securite_comptes: { plateformes: { leboncoin: { repos: { actif: false } } } } },
    vrm_reglages_auto: { v: 1, at: Date.now(), par: 'extension', cles: { vrm_retirer_partout_reglage: Object.assign({ v: 1 }, reglage) } },
    lbc_listings: { items },
  };
  if (registre) lignes.vrm_retraits_partout = { v: 1, rev: 1, items: registre };
  const f = faireFond({ src, lignes, store: st, onglets });
  const gestes = [];
  f.ctx.gesteLbcInterface = async (quoi, compte, url, ordre) => { gestes.push({ quoi, compte, url, id: ordre && ordre.id }); return { rep: rep(quoi, ordre && ordre.id) }; };
  return { f, gestes };
}
const itemsLbc = (o = {}) => { const it = {}; for (let n = 1; n <= 50; n++) it[idL(n)] = Object.assign({ id: idL(n), subject: TITRE, status: 'active', account: 'lbc-account:' + LBC_A }, o[n] || {}); return it; };
const reg = (f) => (f.lignes.vrm_retraits_partout && f.lignes.vrm_retraits_partout.items) || {};
const tick = async (f) => (typeof f.ctx.retirerPartoutTick === 'function' ? f.ctx.retirerPartoutTick('banc') : { absent: true });
const deletes = (f) => f.j.ailleurs.filter((a) => a.methode === 'DELETE').concat(f.j.vinted.filter((v) => v.methode === 'DELETE'));

async function controles({ mut = {}, src = BG, sansA = false } = {}) {
  const res = [];
  const dit = (ok, m, d) => res.push({ ok: !!ok, m, d: d == null ? '' : (typeof d === 'string' ? d : JSON.stringify(d).slice(0, 600)) });
  if (!sansA) { const a = bloc(fs.readFileSync(SRC_RP, 'utf8')), b = bloc(fs.readFileSync(src, 'utf8')); dit(a && b && a === b, 'A le bloc <retirer-partout-regle> est le même dans l’app et l’extension (node scripts/audit-retirer-partout.cjs --recopie)'); }
  let R;
  try { R = await chargerRegles(mut); } catch (e) { dit(false, 'les règles se chargent', String(e && e.message)); return res; }
  try {
    const L = (d) => R.rp.listeRetirerPartout(d, Date.now() - MN);
    // L1 — 50 paires au même titre.
    const l1 = L(donnees());
    const lbc1 = l1.items.filter((x) => x.site === 'leboncoin');
    dit(lbc1.length === 1 && lbc1[0].id === idL(17) && lbc1[0].num === '17' && lbc1[0].venduSur === 'Vinted' && l1.items.every((x) => x.num === '17') && l1.complet === true,
      'L1 50 paires au MÊME titre, vente Vinted prouvée du N° 17 ⇒ seule l’annonce Leboncoin N° 17 est à retirer', l1.items);
    // L2 — vente non prouvée (conversation, statut vide).
    const l2 = L(donnees({ vente: { n: 17, engagee: null } }));
    dit(l2.items.length === 0, 'L2 vente NON prouvée (conversation, statut vide) ⇒ rien à retirer', l2.items);
    // L3 — vente sans N° (identité absente) : jamais le titre.
    const l3 = L(donnees({ vente: { n: 17, engagee: true, num: null } }));
    dit(l3.items.length === 0, 'L3 vente sans identité (titre identique, pas de N°) ⇒ rien à retirer', l3.items);
    // L4 — l'annonce déjà en pause reste dans la liste, « plus en ligne ».
    const l4 = L(donnees({ lbcActive: (n) => n !== 17 }));
    const x4 = l4.items.find((x) => x.site === 'leboncoin');
    dit(x4 && x4.id === idL(17) && x4.enLigne === false, 'L4 l’annonce Leboncoin déjà en pause reste listée (enLigne false) : la quitter voudrait dire « vente annulée »', l4.items);
    // L5 — vente annulée ⇒ hors liste.
    const l5 = L(donnees({ vente: null }));
    dit(l5.items.length === 0 && l5.complet === true, 'L5 vente annulée ⇒ plus rien à retirer, liste complète (ce qui a été retiré peut revenir)', l5);
    // L6 — un N° ambigu ⇒ pas complète.
    const l6 = L(donnees({ ambigu: true }));
    dit(l6.complet === false, 'L6 un N° porté par deux fiches (ambigu) ⇒ liste « pas complète » : rien n’est remis en ligne', { complet: l6.complet, n: l6.items.length });
    // F1 — le vrai fond met en pause la bonne.
    const lv = L(donnees({ vc: true }));
    const a1 = fond({ src, liste: lv, items: itemsLbc() });
    const r1 = await tick(a1.f);
    const e1 = reg(a1.f)[`leboncoin:${idL(17)}`];
    dit(a1.gestes.length === 1 && a1.gestes[0].quoi === 'pause' && a1.gestes[0].id === idL(17) && a1.gestes[0].compte === LBC_A && e1 && e1.etat === 'retiree',
      'F1 le VRAI fond met en pause par la page l’annonce Leboncoin N° 17 (une seule), registre « retirée »', { r: r1, gestes: a1.gestes, e1 });
    dit(!!(a1.f.lignes.lbc_listings.items[idL(17)] || {}).pauseAt && !(a1.f.lignes.lbc_listings.items[idL(18)] || {}).pauseAt, 'F1b la pause est notée sur CETTE annonce seulement (lbc_listings)', null);
    const r1b = await tick(a1.f);
    dit(a1.gestes.length === 1, 'F1c un 2e passage ne refait rien (déjà retirée)', { r: r1b, gestes: a1.gestes });
    // F9 — jamais DELETE, jamais « supprime ».
    dit(!deletes(a1.f).length && !a1.gestes.some((g) => g.quoi === 'supprime'), 'F9 aucune suppression (ni DELETE, ni geste « supprime »)', deletes(a1.f));
    // F8 — Vestiaire : aucun geste, « à faire », sonnerie après 30 min.
    const ev = reg(a1.f)['vestiaire:71000017'];
    dit(ev && ev.etat === 'a-faire' && !a1.gestes.some((g) => g.id === '71000017'), 'F8 Vestiaire : aucun clic, noté « à retirer toi-même »', ev);
    if (reg(a1.f)['vestiaire:71000017']) reg(a1.f)['vestiaire:71000017'].depuis = Date.now() - 31 * MN;   // le temps a passé
    await tick(a1.f);
    const push = a1.f.j.vrmApi.filter((x) => x.corps && x.corps.action === 'retraits');
    const ev2 = reg(a1.f)['vestiaire:71000017'];
    dit(push.length === 1 && ev2 && ev2.alerteAt > 0, 'F8b après 30 min sans retrait : UNE sonnerie (/api/push action retraits), notée', { push: push.length, ev2 });
    await tick(a1.f);
    dit(a1.f.j.vrmApi.filter((x) => x.corps && x.corps.action === 'retraits').length === 1, 'F8c la sonnerie ne repart pas au passage suivant', null);
    // F2 — aucun onglet leboncoin.fr ⇒ en attente, puis fait à l'ouverture.
    const a2 = fond({ src, liste: lv, items: itemsLbc(), onglet: null });
    await tick(a2.f);
    const e2 = reg(a2.f)[`leboncoin:${idL(17)}`];
    dit(a2.gestes.length === 0 && e2 && e2.etat === 'attente' && e2.raison === 'onglet', 'F2 aucun onglet leboncoin.fr ⇒ rien ne part, « en attente : ouvre Leboncoin »', { gestes: a2.gestes, e2 });
    a2.f.ctx.chrome.tabs.get = async (id) => (id === 8 ? { id: 8, url: 'https://www.leboncoin.fr/compte/part/mes-annonces', status: 'complete' } : { id, url: 'https://www.vinted.fr/' });
    a2.f.store.vrmLbcTransport = { 8: { source: 'prive', compte: 'lbc-account:' + LBC_A, at: Date.now() } };
    await tick(a2.f);
    dit(a2.gestes.length === 1 && a2.gestes[0].id === idL(17) && (reg(a2.f)[`leboncoin:${idL(17)}`] || {}).etat === 'retiree', 'F2b l’onglet Leboncoin ouvert ⇒ fait au passage suivant', a2.gestes);
    // F3 — onglet sur un AUTRE compte.
    const a3 = fond({ src, liste: lv, items: itemsLbc(), onglet: LBC_B });
    await tick(a3.f);
    dit(a3.gestes.length === 0 && (reg(a3.f)[`leboncoin:${idL(17)}`] || {}).raison === 'autre-compte', 'F3 l’onglet Leboncoin est sur un AUTRE compte ⇒ rien ne part, dit', reg(a3.f));
    // F4 — réglage éteint.
    const a4 = fond({ src, liste: lv, items: itemsLbc(), reglage: { leboncoin: false } });
    const r4 = await tick(a4.f);
    dit(a4.gestes.length === 0 && (reg(a4.f)[`leboncoin:${idL(17)}`] || {}).etat === 'attente', 'F4 réglage Leboncoin éteint (par défaut) ⇒ rien ne part', { r: r4, gestes: a4.gestes });
    const a4b = fond({ src, liste: lv, items: itemsLbc(), reglage: {} });
    await tick(a4b.f);
    dit(a4b.gestes.length === 0, 'F4b aucun réglage posé ⇒ éteint, rien ne part', a4b.gestes);
    // F5 — geste jamais appris.
    const a5 = fond({ src, liste: lv, items: itemsLbc(), ui: { pause: false, reprise: false } });
    await tick(a5.f);
    dit(a5.gestes.length === 0 && (reg(a5.f)[`leboncoin:${idL(17)}`] || {}).etat === 'pas-appris', 'F5 la pause jamais apprise ⇒ rien ne part, « fais-le une fois à la main »', reg(a5.f));
    // F6 — vente annulée ⇒ réactivée (liste complète sans l'annonce, en pause, retirée par VRM).
    const k17 = `leboncoin:${idL(17)}`;
    const regRetiree = { [k17]: { site: 'leboncoin', id: idL(17), num: '17', etat: 'retiree', voulu: true, compte: LBC_A, depuis: Date.now() - 2 * H } };
    const enPause = () => itemsLbc({ 17: { pauseAt: new Date(Date.now() - H).toISOString() } });
    const a6 = fond({ src, liste: L(donnees({ vente: null })), items: enPause(), registre: JSON.parse(JSON.stringify(regRetiree)) });
    await tick(a6.f);
    dit(a6.gestes.length === 1 && a6.gestes[0].quoi === 'reprise' && a6.gestes[0].id === idL(17) && !reg(a6.f)[k17], 'F6 vente annulée ⇒ l’annonce mise en pause par VRM est réactivée par la page, sortie du registre', { gestes: a6.gestes, reg: reg(a6.f) });
    const a6b = fond({ src, liste: Object.assign(L(donnees({ vente: null })), { complet: false }), items: enPause(), registre: JSON.parse(JSON.stringify(regRetiree)) });
    await tick(a6b.f);
    dit(a6b.gestes.length === 0, 'F6b liste PAS complète (une plateforme pas relue) ⇒ rien n’est réactivé (« pas su »)', a6b.gestes);
    const a6c = fond({ src, liste: L(donnees({ vente: null })), items: enPause(), registre: {} });
    await tick(a6c.f);
    dit(a6c.gestes.length === 0, 'F6c une pause qu’il a faite lui-même (pas au registre) n’est jamais réactivée', a6c.gestes);
    const a6d = fond({ src, liste: L(donnees({ vente: null })), items: enPause(), registre: { [k17]: { site: 'leboncoin', id: idL(17), num: '17', etat: 'attente', compte: LBC_A, depuis: Date.now() - 2 * H } } });
    await tick(a6d.f);
    dit(a6d.gestes.length === 0, 'F6d au registre mais jamais mise en pause PAR VRM (en attente) : sa pause à la main n’est pas réactivée', a6d.gestes);
    // F7 — la page ne dit rien ⇒ incertain, jamais relancé.
    const a7 = fond({ src, liste: lv, items: itemsLbc(), rep: () => null });
    await tick(a7.f);
    const e7 = reg(a7.f)[k17];
    a7.f.store.vrmRetirerProchain = {}; a7.f.store.vrmSecu = { presence: { vinted: Date.now(), vestiaire: Date.now(), leboncoin: Date.now() } };   // le temps a passé (espacement, sécurité)
    await tick(a7.f);
    dit(a7.gestes.length === 1 && e7 && e7.etat === 'incertain', 'F7 la page ne dit pas avoir envoyé ⇒ « à vérifier sur le site », jamais relancé seul', { gestes: a7.gestes, e7 });
    // F10 — liste périmée.
    const a10 = fond({ src, liste: Object.assign({}, lv, { at: Date.now() - 49 * H }), items: itemsLbc() });
    const r10 = await tick(a10.f);
    dit(a10.gestes.length === 0 && r10 && r10.saute === 'liste-perimee', 'F10 une liste de plus de 48 h ne fait plus rien', r10);
    // N1 — le serveur.
    const t = Date.now();
    const n1 = R.nt.retraitsEnRetard({ a: { site: 'leboncoin', num: '17', etat: 'attente', depuis: t - 31 * MN, alerteAt: t - MN }, b: { site: 'leboncoin', etat: 'attente', depuis: t - 10 * MN, alerteAt: t - MN }, c: { site: 'vestiaire', etat: 'retiree', depuis: t - 2 * H, alerteAt: t - MN }, d: { site: 'vestiaire', etat: 'a-faire', depuis: t - 2 * H, alerteAt: t - 2 * H } }, t);
    dit(n1.length === 1 && n1[0].cle === 'a' && /N°17/.test(R.nt.texteRetraits(n1).body), 'N1 le serveur ne sonne que le retard (> 30 min, pas fait) que l’extension vient de demander', n1);
  } finally { try { fs.rmSync(R.dir, { recursive: true, force: true }); } catch (_) {} }
  return res;
}

(async () => {
  const res = await controles();
  for (const r of res) console.log(`${r.ok ? '✅' : '❌'} ${r.m}${r.ok ? '' : ' — ' + r.d}`);
  const rouges = res.filter((r) => !r.ok).length;
  if (process.argv.includes('--prouve')) {
    const remplace = (a, b) => (t) => { if (!t.includes(a)) throw new Error('mutation introuvable : ' + a.slice(0, 70)); return t.split(a).join(b); };
    const MUT = [
      ['vente non prouvée comptée', { 'retirerPartout.js': remplace("v && v.engagee === true && v.plateforme && v.plateforme !== l.plateforme", "v && v.engagee !== false && v.plateforme && v.plateforme !== l.plateforme"), 'bilanSynchronisation.js': remplace('v.engagee === true &&\n', '(v.engagee === true || v.engagee == null) &&\n') }],
      ['N° pas comparé (ressemblance)', { 'bilanSynchronisation.js': remplace('(v.plateforme !== a.plateforme && croise(groupe(v.numero), n))', '(v.plateforme !== a.plateforme)') }],
      ['annonce retirée sortie de la liste', { 'retirerPartout.js': remplace("a && a.plateforme !== 'Vinted' ? { ...a, enLigne: a.active, active: true }", "a && a.plateforme !== 'Vinted' ? { ...a, enLigne: a.active }") }],
      ['ambigu ignoré', { 'retirerPartout.js': remplace("manques.length === 0 && !(calcul.ambigus > 0)", "manques.length === 0") }],
    ];
    const bg = fs.readFileSync(BG, 'utf8');
    const MUTF = [
      ['compte de l’onglet ignoré', bg.replace("if (!et || String(et.compte || '') !== c || et.enLigne !== true) continue;", "if (!et || et.enLigne !== true) continue;").replace("    const o = await ongletLbcDuCompte(compte);\n    if (!o.ok) {\n      const code", "    const o = { ok: true };\n    if (!o.ok) {\n      const code").replace("const o = await ongletLbcDuCompte(compte);\n    if (!o.ok) return { accepte: false, code: o.code ||", "const o = { ok: true };\n    if (!o.ok) return { accepte: false, code: o.code ||")],
      ['réglage ignoré', bg.replace("if (!reglage.leboncoin) return { lu: true, saute: 'lbc-eteint', tard: tard.length };", "")],
      ['geste pas appris ignoré', bg.replace("if (!url) return { accepte: false, code: 'pas-appris' };", "")],
      ['liste pas complète ⇒ remet quand même', bg.replace("  if (liste.complet === true) {\n    for (const k of Object.keys(reg)) {", "  if (true) {\n    for (const k of Object.keys(reg)) {")],
      ['pause à la main réactivée', bg.replace("if (!r || r.site !== site || r.etat !== 'retiree' || r.voulu === false) continue;", "if (!r || r.site !== site) continue;").replace("if (liste.complet === true) for (const [k, r] of Object.entries(registre)) if (r && !dans.has(k) && r.etat !== 'retiree') majs[k] = null;", "")],
      ['« je ne sais pas » relancé', bg.replace("if (r && (r.etat === 'retiree' || r.etat === 'envoye' || r.etat === 'incertain')) continue;", "if (r && (r.etat === 'retiree' || r.etat === 'envoye')) continue;")],
      ['sonnerie à chaque passage', bg.replace("t - Number(r.depuis) > RP_ALERTE_MS && !r.alerteAt &&", "t - Number(r.depuis) > RP_ALERTE_MS &&")],
      ['liste périmée acceptée', bg.replace("if (!Number.isFinite(at) || t - at > RP_AGE_MAX_MS || at > t + 120000) return 'perimee';", "if (!Number.isFinite(at)) return 'perimee';")],
    ];
    let tenu = 0;
    for (const [nom, mut] of MUT) {
      let r2; try { r2 = await controles({ mut, sansA: true }); } catch (e) { r2 = [{ ok: false, m: 'a levé ' + e.message }]; }
      const rouge = r2.some((x) => !x.ok);
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ${rouge ? 'rougit' : 'NE ROUGIT PAS'}`);
      if (rouge) tenu++;
    }
    for (const [nom, texte] of MUTF) {
      if (texte === bg) { console.log(`❌ mutation « ${nom} » introuvable`); continue; }
      const p = path.join(os.tmpdir(), `bg-retirer-partout-${process.pid}.js`); fs.writeFileSync(p, texte);
      let r2; try { r2 = await controles({ src: p, sansA: true }); } catch (e) { r2 = [{ ok: false }]; }
      fs.rmSync(p, { force: true });
      const rouge = r2.some((x) => !x.ok);
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ${rouge ? 'rougit' : 'NE ROUGIT PAS'}`);
      if (rouge) tenu++;
    }
    if (tenu !== MUT.length + MUTF.length) { console.log(`❌ ${MUT.length + MUTF.length - tenu} mutation(s) ne rougissent pas`); process.exit(1); }
  }
  console.log(rouges ? `❌ ${rouges} contrôle(s) rouge(s)` : '✅ une paire vendue est retirée partout : tout est vert');
  process.exit(rouges ? 1 : 0);
})();
