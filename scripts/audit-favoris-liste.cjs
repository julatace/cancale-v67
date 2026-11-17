// ════════════════════════════════════════════════════════════════════════════
//  LA LISTE DES FAVORIS À COCHER DE LA CARTE (17 nov., ext. 5.407)
//
//  Julien (après la carte 5.406) : « il faut une liste avec les favoris pour pouvoir les
//  sélectionner etc ».
//
//  On EXÉCUTE la VRAIE règle du serveur (api/_lib/favoris-carte.js, `apercuCarte`) et le VRAI
//  `background.js` (scripts/_fond-vm.cjs) branché sur la VRAIE file du serveur
//  (api/_lib/favoris-file.js). Aucune donnée réelle : tout est inventé (dépôt public).
//   S1. la liste `tous` : du plus récent au plus ancien, articles VENDUS (ici ou ailleurs)
//       cachés et comptés, déjà contactés montrés NON cochables (offre / message), destinataire
//       pas prouvé non cochable, message rendu seulement pour les cochables ;
//   B1. `lancer` : seulement les favoris COCHABLES de l'aperçu montré — un favori vendu, déjà
//       contacté, inconnu, ou un aperçu de plus de 30 min ⇒ refusé, rien ne part chez VRM ;
//   B2. sans `confirme` (le bouton « Confirmer l'envoi ») ⇒ refusé ; plus de 15 ⇒ refusé ;
//       un onglet sur un autre compte ⇒ refusé ;
//   B3. ce qui part : la file ne contient QUE les favoris cochés, et seuls eux sont réservés ;
//       un second envoi des mêmes favoris est refusé (chacun contacté une fois) ;
//   B4. les plafonds tiennent après le clic : 15 favoris déjà partis cette heure ⇒ rien
//       réservé ni envoyé ; 44 actions prises (50/h, réserve 5) ⇒ rien ; « Tout arrêter » ⇒ rien.
//  §6.1 : `--src <ancien background.js>` et `BANC_RACINE=<ancien arbre>` ⇒ rouge.
//  `--prouve` : chaque mutation rend l'audit rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { faireFond } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const RACINE = process.env.BANC_RACINE ? path.resolve(process.env.BANC_RACINE) : path.join(__dirname, '..');
const iSrc = args.indexOf('--src');
const SRC0 = iSrc >= 0 ? path.resolve(args[iSrc + 1]) : path.join(RACINE, 'vinted-sync-extension', 'background.js');
const SERVEUR0 = path.join(RACINE, 'api', '_lib', 'favoris-carte.js');

// Chaque mutation réaffaiblit UNE règle ; `dans` : le fichier muté.
const MUTATIONS = {
  cochables: { dans: 'bg', a: "if (sel.some((id) => !ok.has(id))) return", b: 'if (false) return' },
  deja: { dans: 'bg', a: "x && x.cochable === true && x.envoi === 'a_envoyer'", b: 'x' },
  frais: { dans: 'bg', a: 'Date.now() - Number(ap.at || 0) < FAVORIS_CARTE_CHOIX_MS', b: 'true' },
  confirme: { dans: 'bg', a: "if (msg.confirme !== true) return", b: 'if (false) return' },
  max: { dans: 'bg', a: 'sel.length > FAVORIS_CARTE_MAX ||', b: '' },
  vendus: { dans: 'serveur', a: "if (annonce) { retires++; if (e.code === 'a_envoyer') ecartes++; continue; }", b: '' },
  contactes: { dans: 'serveur', a: "const cochable = e.code === 'a_envoyer' && !raison;", b: 'const cochable = !raison;' },
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`);
    if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let SRC = SRC0, SERVEUR = SERVEUR0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const M = MUTATIONS[mut];
  const orig = M.dans === 'bg' ? SRC0 : SERVEUR0;
  const s = fs.readFileSync(orig, 'utf8');
  if (!s.includes(M.a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  // Le serveur importe ses voisins par chemins relatifs : la copie mutée vit À CÔTÉ (effacée à la fin).
  const dest = M.dans === 'bg' ? path.join(os.tmpdir(), `bg-favoris-liste-${mut}-${process.pid}.js`) : path.join(path.dirname(orig), `.favoris-carte-mut-${mut}-${process.pid}.js`);
  fs.writeFileSync(dest, s.split(M.a).join(M.b));
  if (M.dans === 'bg') SRC = dest; else SERVEUR = dest;
}
const nettoyer = () => { if (mut) { try { if (SRC !== SRC0) fs.unlinkSync(SRC); } catch (_) {} try { if (SERVEUR !== SERVEUR0) fs.unlinkSync(SERVEUR); } catch (_) {} } };

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`); } };
const UID = '424242', OWNER = 'owner-banc', MIN = 60000, H = 3600000;
const T0 = Date.now(), iso = (t) => new Date(t).toISOString();
const ONGLET = { tab: { id: 7, url: 'https://www.vinted.fr/member/424242' } };

// ── Les favoris inventés : 12 notifications, 12 annonces ─────────────────────────
//   5001 vendue sur Vinted (fermée « sold ») · 5002 vendue ailleurs (garde) · 5003 offre déjà faite
//   (job envoyé, 3 écritures) · 5004 message déjà envoyé · 5005 destinataire pas prouvé ; les autres libres.
const N = 12;
const notifs = Array.from({ length: N }, (_, i) => ({ id: 'n' + i, user_id: 900 + i, body: `acheteur_${i} a ajouté ton article à ses favoris.`,
  link: `/items/${5000 + i}/conversation/new?from_notification=true`, created_at: iso(T0 - ((i * 7) % N + 1) * H) }));
const items = Array.from({ length: N }, (_, i) => ({ id: 5000 + i, title: 'Baskets ' + i, price: { amount: String(40 + i) + '.0', currency_code: 'EUR' },
  ...(i === 1 ? { is_closed: true, item_closing_action: 'sold' } : {}) }));
const jobs = [
  { id: 'j3', notificationId: 'n3', etat: 'envoye', ecrits: 3, envoyeLe: T0 - 2 * H },
  { id: 'j4', notificationId: 'n4', etat: 'envoye', envoyeLe: T0 - 3 * H },
];
const PREFS = { version: 1, envoisActifs: false, message: 'Bonjour {pseudo}, ça te plaît toujours ?', pourcentage: 10, offreMode: 'pct', offreValeur: null, arrondi: false, intervalleMinutes: 0, intervalleMaxMinutes: null };
const VENDUS = new Set(['n1', 'n2']), CONTACTES = new Set(['n3', 'n4']), NON_PROUVE = 'n5';

async function apercuReel(M) {
  return M.apercuCarte({ prefs: PREFS, capture: { payload: { notifications: notifs }, domain: 'www.vinted.fr' }, vue: { jobs, active: false },
    dressing: { cap: iso(T0 - H / 2), pg: { total_entries: N }, items }, garde: (it) => (String(it) === '5002' ? 'vendue-ailleurs' : null),
    prouve: (id) => id !== NON_PROUVE, maintenant: T0 });
}

// La VRAIE file du serveur, en mémoire ; l'aperçu = la VRAIE règle (S1).
async function serveur(apercu) {
  const F = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-file.js')).href);
  const P = await import(pathToFileURL(path.join(RACINE, 'src', 'favorisProgression.js')).href);
  let d = null, n = 0;
  const jeton = () => { n++; return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`; };
  const s = { lancers: [], reserves: [], d: () => d };
  s.vrm = async (req) => {
    if (req.mode !== 'favoris') return { status: 404, body: {} };
    const now = Date.now(), c = req.corps || {};
    const carte = (v) => ({ total: v.jobs.length, envoyes: v.jobs.filter((j) => j.etat === 'envoye').length, active: v.active });
    try {
      if (req.methode === 'GET') { const v = F.vueFile(F.initialiserFile(d), OWNER); return { status: 200, body: { ok: true, uid: UID, vue: v, carte: carte(v), serveur: now } }; }
      if (c.action === 'apercu') return { status: 200, body: { ok: true, uid: UID, apercu: JSON.parse(JSON.stringify(apercu)), serveur: now } };
      let r;
      if (c.action === 'lancer') {
        s.lancers.push(c.selection.slice());
        const parId = new Map(notifs.map((x) => [x.id, x]));
        const targets = c.selection.map((id) => { const x = parId.get(id); return { itemId: String(/items\/(\d+)/.exec(x.link)[1]), recipientId: String(x.user_id), notificationId: id, initiator: 'favourite' }; });
        r = F.lancerFile(d, { owner: OWNER, targets, message: PREFS.message, intervalleMinutes: 0, maintenant: now, lot: 'lot' + s.lancers.length });
      } else if (c.action === 'suivant') { r = F.reserverFile(d, { owner: OWNER, maintenant: now, jeton: jeton(), suivi: 's' }); if (r.valeur.travail) s.reserves.push(r.valeur.travail.notificationId || r.valeur.travail.itemId); }
      else if (c.action === 'consommer') r = F.consommerFile(d, { owner: OWNER, jeton: c.jeton, maintenant: now });
      else if (c.action === 'verifier') r = F.verifierReservation(d, { owner: OWNER, jeton: c.jeton, maintenant: now });
      else if (c.action === 'terminer') { const t = P.traduireResultatFavori(c.brut); r = F.terminerFile(d, { owner: OWNER, jeton: c.jeton, resultat: t.resultat, raison: t.raison, maintenant: now, ecrits: Number.isInteger(t.ecrits) ? t.ecrits : null, apresMs: Number.isSafeInteger(t.apresMs) ? t.apresMs : null }); }
      else if (c.action === 'arreter') r = F.arreterFile(d, OWNER);
      else return { status: 400, body: { message: 'inconnu' } };
      if (r.data) d = r.data;
      const v = ['suivant', 'consommer', 'verifier'].includes(c.action) ? r.valeur.vue : r.valeur;
      const corps = ['suivant', 'consommer', 'verifier'].includes(c.action) ? r.valeur : { vue: r.valeur };
      return { status: 200, body: Object.assign({ ok: true, uid: UID, serveur: now }, corps, v && v.jobs ? { carte: carte(v) } : {}) };
    } catch (e) { return { status: e.status || 503, body: { message: String(e.message) } }; }
  };
  s.F = F;
  return s;
}
async function monde(apercu, o = {}) {
  const sv = await serveur(apercu);
  const vinted = [];
  const f = faireFond({ src: SRC, connecte: o.connecte || UID, store: Object.assign({}, o.store || {}), vrm: sv.vrm,
    vinted: (req) => { vinted.push(req); return { status: 500, body: {} }; } });
  return { f, sv, vinted };
}
const badge = (quoi, extra) => Object.assign({ from: 'vrm-badge', action: 'favorisCarte', quoi, uid: UID }, extra || {});

(async () => {
  const M = await import(pathToFileURL(SERVEUR).href);
  const a = await apercuReel(M);
  const tous = Array.isArray(a.tous) ? a.tous : [];
  // ── S1 : la liste du serveur ──────────────────────────────────────────────────
  console.log('\nS1. La liste des favoris (règle du serveur, celle de l’app)');
  {
    const ids = tous.map((x) => x.id), dates = tous.map((x) => Date.parse(x.date));
    console.log(`     mesuré : état ${a.etat} · ${tous.length} rangées · cachés ${a.retires} · cochables ${tous.filter((x) => x.cochable).map((x) => x.id).join(',')}`);
    dit(a.etat === 'pret' && tous.length > 0, 'l’aperçu rend la liste `tous`', JSON.stringify({ e: a.etat, n: tous.length }));
    dit(dates.length > 1 && dates.every((t, i) => isFinite(t) && (i === 0 || dates[i - 1] >= t)), 'du plus récent au plus ancien, chacun avec sa date', dates.slice(0, 5).join(','));
    dit(!ids.some((id) => VENDUS.has(id)) && Number(a.retires) === 2, 'articles vendus (sur Vinted, et ailleurs) : cachés et comptés (2)', JSON.stringify({ ids, retires: a.retires }));
    const n3 = tous.find((x) => x.id === 'n3'), n4 = tous.find((x) => x.id === 'n4'), n5 = tous.find((x) => x.id === 'n5');
    dit(!!n3 && n3.cochable === false && n3.envoi === 'envoye' && n3.offreFaite === true, 'offre déjà faite : montrée, NON cochable, « offre »', JSON.stringify(n3));
    dit(!!n4 && n4.cochable === false && n4.envoi === 'envoye' && !n4.offreFaite, 'message déjà envoyé : montré, NON cochable', JSON.stringify(n4));
    dit(!!n5 && n5.cochable === false && n5.raison === 'non_prouve', 'destinataire pas prouvé : NON cochable, raison dite', JSON.stringify(n5));
    const libres = tous.filter((x) => !VENDUS.has(x.id) && !CONTACTES.has(x.id) && x.id !== NON_PROUVE);
    dit(libres.length === N - 5 && libres.every((x) => x.cochable === true && typeof x.texte === 'string' && x.texte.includes('acheteur_') && Number(x.offre) > 0),
      `les ${N - 5} autres : cochables, message rendu à leur nom, offre calculée`, JSON.stringify(libres.map((x) => [x.id, x.cochable, !!x.texte, x.offre])));
    dit(!tous.some((x) => !x.cochable && 'texte' in x), 'aucun message préparé pour un favori qu’on ne peut pas contacter');
    dit(JSON.stringify((a.liste || []).map((x) => x.id).sort()) === JSON.stringify(tous.filter((x) => x.cochable).map((x) => x.id).slice(0, 15).sort()),
      'les cochables sont EXACTEMENT ceux que l’envoi d’avant retenait (`liste`, une seule règle)');
  }
  const cochables = tous.filter((x) => x.cochable).map((x) => x.id);
  if (!cochables.length) cochables.push('n0', 'n6', 'n7', 'n8', 'n9');   // (code d'avant : aucune liste ⇒ les contrôles suivants jugent quand même)
  // ── B1 : `lancer` n'accepte que les cochables ────────────────────────────────
  console.log('\nB1. « Envoyer » : seulement les favoris cochables de l’aperçu montré');
  {
    const { f, sv } = await monde(a);
    const ap = await f.envoyer(badge('apercu'), ONGLET);
    dit(ap && ap.ok === true, 'l’aperçu passe par l’extension', JSON.stringify(ap).slice(0, 200));
    const memo = ((f.store.vrmFavorisApercu || {})[UID] || {}).cochables || [];
    dit(JSON.stringify(memo.slice().sort()) === JSON.stringify(cochables.slice().sort()), 'l’extension garde les favoris cochables de l’aperçu montré', JSON.stringify(memo));
    for (const [nom, sel] of [['un favori VENDU (n1)', [cochables[0], 'n1']], ['un favori vendu AILLEURS (n2)', ['n2']], ['une OFFRE déjà faite (n3)', [cochables[0], 'n3']], ['un message déjà envoyé (n4)', ['n4']], ['un destinataire pas prouvé (n5)', ['n5']], ['un favori inconnu', ['n999']]]) {
      const r = await f.envoyer(badge('lancer', { selection: sel, reglages: PREFS, confirme: true, items: [] }), ONGLET);
      dit(r && r.ok === false && r.code === 'selection', `${nom} ⇒ refusé, rien ne part`, JSON.stringify(r).slice(0, 200));
    }
    dit(sv.lancers.length === 0, 'aucun lancement n’a atteint VRM', JSON.stringify(sv.lancers));
  }
  {
    const { f, sv } = await monde(a);
    await f.envoyer(badge('apercu'), ONGLET);
    const m = f.store.vrmFavorisApercu; m[UID].at = Date.now() - 31 * MIN;
    const r = await f.envoyer(badge('lancer', { selection: [cochables[0]], reglages: PREFS, confirme: true, items: [] }), ONGLET);
    dit(r && r.ok === false && sv.lancers.length === 0, 'un aperçu de plus de 30 min ⇒ relire d’abord, rien ne part', JSON.stringify(r).slice(0, 200));
  }
  {
    const { f, sv } = await monde(a);
    const r = await f.envoyer(badge('lancer', { selection: [cochables[0]], reglages: PREFS, confirme: true, items: [] }), ONGLET);
    dit(r && r.ok === false && sv.lancers.length === 0, 'aucun aperçu lu sur ce navigateur ⇒ rien ne part', JSON.stringify(r).slice(0, 200));
  }
  // ── B2 : confirmation, plafond par envoi, compte de l'onglet ─────────────────
  console.log('\nB2. Rien sans « Confirmer l’envoi », 15 au plus, le compte de l’onglet seulement');
  {
    const { f, sv } = await monde(a);
    await f.envoyer(badge('apercu'), ONGLET);
    const r1 = await f.envoyer(badge('lancer', { selection: [cochables[0]], reglages: PREFS, items: [] }), ONGLET);
    dit(r1 && r1.ok === false && r1.code === 'confirmation', 'sans confirmation ⇒ refusé', JSON.stringify(r1).slice(0, 160));
    // 20 favoris cochables (un aperçu à part) : en cocher 16 ⇒ refusé par le plafond d'un envoi, pas par autre chose.
    const vingt = { etat: 'pret', tous: Array.from({ length: 20 }, (_, i) => ({ id: 'm' + i, itemId: String(6000 + i), cochable: true, envoi: 'a_envoyer' })) };
    const w = await monde(vingt);
    await w.f.envoyer(badge('apercu'), ONGLET);
    const seize = vingt.tous.slice(0, 16).map((x) => x.id);
    const r2 = await w.f.envoyer(badge('lancer', { selection: seize, reglages: PREFS, confirme: true, items: [] }), ONGLET);
    dit(r2 && r2.ok === false && r2.code === 'selection' && w.sv.lancers.length === 0, '16 favoris cochables ⇒ refusé (15 au plus par envoi)', JSON.stringify(r2).slice(0, 160));
    const r3 = await f.envoyer(Object.assign(badge('lancer', { selection: [cochables[0]], reglages: PREFS, confirme: true, items: [] }), { uid: '777777' }), ONGLET);
    dit(r3 && r3.ok === false && r3.code === 'compte', 'un autre compte que celui de l’onglet ⇒ refusé', JSON.stringify(r3).slice(0, 160));
    dit(sv.lancers.length === 0, 'aucun lancement n’a atteint VRM', JSON.stringify(sv.lancers));
  }
  // ── B3 : ce qui part ─────────────────────────────────────────────────────────
  console.log('\nB3. Ce qui part : exactement les favoris cochés, une fois chacun');
  {
    const { f, sv } = await monde(a);
    await f.envoyer(badge('apercu'), ONGLET);
    const choisis = [cochables[0], cochables[2], cochables[4]];
    const r = await f.envoyer(badge('lancer', { selection: choisis, reglages: PREFS, confirme: true, items: choisis.map((id) => ({ itemId: String(5000 + Number(id.slice(1))), photo: '', titre: '' })) }), ONGLET);
    dit(r && r.ok === true, 'les 3 favoris cochés sont lancés', JSON.stringify(r).slice(0, 200));
    dit(sv.lancers.length === 1 && JSON.stringify(sv.lancers[0]) === JSON.stringify(choisis), 'VRM reçoit EXACTEMENT la sélection (ni plus, ni moins, dans l’ordre)', JSON.stringify(sv.lancers));
    const file = sv.F.vueFile(sv.F.initialiserFile(sv.d()), OWNER);
    dit(file.jobs.length === 3 && file.jobs.every((j) => choisis.includes(j.notificationId)), 'la file ne contient que ces 3 favoris', JSON.stringify(file.jobs.map((j) => j.notificationId)));
    await f.ctx.tickFavorisCarte();
    const res = sv.reserves.map(String);
    dit(res.length >= 1 && res.every((x) => choisis.includes(x) || choisis.map((id) => String(5000 + Number(id.slice(1)))).includes(x)), 'seuls des favoris cochés sont réservés pour l’envoi', JSON.stringify(res));
    const memo = ((f.store.vrmFavorisApercu || {})[UID] || {}).cochables || [];
    dit(memo.length === 0, 'après le lancement, l’aperçu gardé est vidé : un second envoi exige une liste relue', JSON.stringify(memo));
    const r2 = await f.envoyer(badge('lancer', { selection: choisis, reglages: PREFS, confirme: true, items: [] }), ONGLET);
    dit(r2 && r2.ok === false && sv.lancers.length === 1, 'renvoyer les mêmes favoris ⇒ refusé (chacun contacté une fois)', JSON.stringify(r2).slice(0, 200));
  }
  // ── B4 : les plafonds tiennent après le clic ─────────────────────────────────
  console.log('\nB4. Après le clic, les plafonds tiennent (15/h favoris, 50/h, « Tout arrêter »)');
  for (const [nom, store] of [
    ['15 favoris déjà partis cette heure', { vrmSortes: { [UID]: { favori: Array.from({ length: 15 }, (_, i) => T0 - 50 * MIN + i * 2 * MIN), at: T0 } } }],
    ['44 actions prises cette heure (50, réserve 5)', { vrmActions: { [UID]: Array.from({ length: 44 }, (_, i) => T0 - 59 * MIN + i * 1000) } }],
  ]) {
    const { f, sv, vinted } = await monde(a, { store });
    await f.envoyer(badge('apercu'), ONGLET);
    const r = await f.envoyer(badge('lancer', { selection: [cochables[0], cochables[1]], reglages: PREFS, confirme: true, items: [] }), ONGLET);
    await f.ctx.tickFavorisCarte();
    const st = f.store.vrmFavorisCarte || {};
    dit(r && r.ok === true && sv.reserves.length === 0 && vinted.length === 0 && Number(st.prochain) > Date.now(), `${nom} ⇒ lancé mais RIEN réservé ni envoyé, la suite attend`, JSON.stringify({ ok: r && r.ok, res: sv.reserves.length, v: vinted.length, q: st.quoi }));
  }
  {
    const { f, sv } = await monde(a);
    await f.envoyer(badge('apercu'), ONGLET);
    await f.ctx.poserToutArrete(true);
    const r = await f.envoyer(badge('lancer', { selection: [cochables[0]], reglages: PREFS, confirme: true, items: [] }), ONGLET);
    dit(r && r.ok === false && sv.lancers.length === 0, '« Tout arrêter » posé ⇒ rien ne part', JSON.stringify(r).slice(0, 160));
  }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  nettoyer();
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); nettoyer(); process.exit(1); });
