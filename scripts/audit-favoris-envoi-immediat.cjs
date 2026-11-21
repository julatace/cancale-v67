// ════════════════════════════════════════════════════════════════════════════
//  « DÈS QU'ON APPUIE SUR VALIDER ÇA DOIT PARTIR » — L'ENVOI AUX FAVORIS LANCÉ À LA MAIN (21 nov., ext. 5.419)
//
//  Julien (21 nov., panneau de l'extension 5.418) : « les trois minutes d'attente à chaque fois, ce n'est pas obligé,
//  ça ne sert à rien, c'est beaucoup trop : dès qu'on appuie sur Valider ça doit partir ».
//  MESURÉ dans le code (5.418) : après « Confirmer l'envoi », `tickFavorisCarte` demandait aux gardes de la discrétion
//  (`attenteAvantFavori` → `porteDiscretion`) une place ; « Vinted vient d'être ouvert » (`OUVERTURE_MIN_MS` 2 min à
//  `OUVERTURE_MAX_MS` 6 min, tirées à chaque retour sur vinted.fr après 30 min d'absence) le faisait attendre 2 à 6 min
//  AVANT le premier message — les « trois minutes à chaque fois » ; puis le 1er message prenait le temps d'écriture
//  d'une SÉRIE (5 à 45 s), et entre deux messages la pause par défaut était de 40 à 90 s.
//
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs, sa fausse page vinted.fr) branché sur la VRAIE file du
//  serveur (api/_lib/favoris-file.js + src/favorisProgression.js) :
//   I1. Vinted ouvert à l'instant (attente de la discrétion tirée : 4 min) et SON envoi confirmé : le 1er message part
//       au premier tour, la somme des attentes AVANT lui (cloche, relecture, temps d'écriture de son clic…) < 15 s ;
//   I2. le 1er message prend le temps d'écriture de SON clic (2 à 6 s), jamais celui d'une série ;
//   I3. le message suivant reprend le temps d'une série (5 à 45 s) — la règle du 12 nov. pour les suivants ;
//   I4. le MODE AUTO, lui, attend toujours après l'ouverture (la garde n'est retirée que pour SON envoi) ;
//   I5. les plafonds tiennent pour son envoi : 15 favoris déjà partis cette heure ⇒ rien ne part, l'heure du prochain
//       est posée et sa raison (« sorte ») ; 44 actions prises (50/h, réserve 5) ⇒ rien, raison « heure » ;
//       vérification de Vinted ⇒ arrêt ; « Tout arrêter » ⇒ arrêt ;
//   I6. les espacements suivants : la pause par défaut de SA cadence est 20–60 s (au lieu de 40–90 s), TOUJOURS
//       envoyée au serveur (`plage`) ; 14 espacements tirés par la VRAIE file : tous dans 20–60 s, jamais deux fois de
//       suite le même ; « Plus prudent » garde 2–4 min (aucune plage envoyée) ;
//   I7. « attendre N min après le favori » (le filtre du mode auto) ne retire pas un favori de SON aperçu ;
//   I8. un drapeau « manuel » venu de l'APP n'est jamais cru (`executerPourApp` le remet à faux).
//  §6.1 : `--src <ancien background.js>` ⇒ rouge. `--prouve` : chaque mutation rend l'audit rouge.
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

const MUTATIONS = {
  ouverture: ["const ouv = opts.manuel ? null : (await lireLocal('vrmOuverture'))[u];", "const ouv = (await lireLocal('vrmOuverture'))[u];"],
  tick: ["const av = await attenteAvantFavori(st.uid, 3, { manuel: true });", 'const av = await attenteAvantFavori(st.uid, 3);'],
  premier: ["premier ? 'premier' : 'serie');   // 5.419", "'serie');   // 5.419"],
  premier2: ["attendreEcriture(uid,acc,texteFinal,premier?'premier':'serie')", "attendreEcriture(uid,acc,texteFinal,'serie')"],
  plage: ["if (msg.rythme !== 'prudent' && cad.pauseMax > cad.pauseMin) plage =", "if (msg.rythme !== 'prudent' && cad.poses.includes('pauseMin')) plage ="],
  defaut: ['const RA_CADENCE_DEFAUT = { favorisHeure: 15, actionsHeure: 50, parJour: null, pauseMin: 20, pauseMax: 60 };', 'const RA_CADENCE_DEFAUT = { favorisHeure: 15, actionsHeure: 50, parJour: null, pauseMin: 40, pauseMax: 90 };'],
  app: ["Object.assign({}, msg, { __manuel: false, __premier: false, __texte: null })", 'msg'],
  apresMin: ["filtrerApercuFavoris(r.json.apercu, Object.assign({}, RB.favoris, { apresMin: 0 }),", 'filtrerApercuFavoris(r.json.apercu, RB.favoris,'],
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
let SRC = SRC0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut];
  const s = fs.readFileSync(SRC0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  SRC = path.join(os.tmpdir(), `bg-envoi-immediat-${mut}-${process.pid}.js`);
  fs.writeFileSync(SRC, s.split(a).join(b));
}

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); } };
const UID = '424242', OWNER = 'owner-banc', MIN = 60000;
const s1 = (ms) => (ms == null ? '—' : (ms / 1000).toFixed(1) + ' s');

// La VRAIE file du serveur, en mémoire (un propriétaire, un compte) — la même que audit-action-plein.
async function serveur() {
  const F = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-file.js')).href);
  const P = await import(pathToFileURL(path.join(RACINE, 'src', 'favorisProgression.js')).href);
  let d = null, n = 0;
  const jeton = () => { n++; return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`; };
  const s = { d: () => d, reservations: 0, terminer: [], lancers: [] };
  const cibles = (k) => Array.from({ length: k }, (_, i) => ({ itemId: String(9000 + i), recipientId: String(7000 + i), notificationId: 'n' + i, initiator: 'favourite' }));
  s.lancer = (k = 3, o = {}) => { d = F.lancerFile(d, Object.assign({ owner: OWNER, targets: cibles(k), message: 'Bonjour {pseudo} !', intervalleMinutes: 0, maintenant: Date.now(), lot: 'lot1' }, o)).data; };
  s.vrm = async (req) => {
    if (req.mode !== 'favoris') return { status: 404, body: {} };
    const now = Date.now(), c = req.corps || {};
    const carte = (v) => ({ total: v.jobs.length, envoyes: v.jobs.filter((j) => j.etat === 'envoye').length, active: v.active });
    try {
      if (req.methode === 'GET') { const v = F.vueFile(F.initialiserFile(d), OWNER); return { status: 200, body: { ok: true, uid: UID, vue: v, carte: carte(v), serveur: now } }; }
      let r;
      if (c.action === 'lancer') { s.lancers.push(JSON.parse(JSON.stringify(c))); r = F.lancerFile(d, { owner: OWNER, targets: cibles((c.selection || []).length), message: 'Bonjour {pseudo} !', intervalleMinutes: 0, maintenant: now, lot: 'lot' + s.lancers.length, ...(c.rythme ? { rythme: c.rythme } : {}), ...(c.plage ? { plage: c.plage } : {}) }); d = r.data; const v = r.valeur; return { status: 200, body: { ok: true, uid: UID, vue: v, carte: carte(v), serveur: now } }; }
      if (c.action === 'suivant') { r = F.reserverFile(d, { owner: OWNER, maintenant: now, jeton: jeton(), suivi: 's' }); if (r.valeur.travail) s.reservations++; }
      else if (c.action === 'consommer') r = F.consommerFile(d, { owner: OWNER, jeton: c.jeton, maintenant: now });
      else if (c.action === 'verifier') r = F.verifierReservation(d, { owner: OWNER, jeton: c.jeton, maintenant: now });
      else if (c.action === 'terminer') { const t = P.traduireResultatFavori(c.brut); s.terminer.push(t); r = F.terminerFile(d, { owner: OWNER, jeton: c.jeton, resultat: t.resultat, raison: t.raison, maintenant: now, ecrits: Number.isInteger(t.ecrits) ? t.ecrits : null, apresMs: t.apresMs }); }
      else if (c.action === 'arreter') r = F.arreterFile(d, OWNER);
      else return { status: 400, body: { message: 'inconnu' } };
      if (r.data) d = r.data;
      const v = ['suivant', 'consommer', 'verifier'].includes(c.action) ? r.valeur.vue : r.valeur;
      const corps = ['suivant', 'consommer', 'verifier'].includes(c.action) ? r.valeur : { vue: r.valeur };
      return { status: 200, body: Object.assign({ ok: true, uid: UID, serveur: now }, corps, v && v.jobs ? { carte: carte(v) } : {}) };
    } catch (e) { return { status: e.status || 503, body: { message: String(e.message) } }; }
  };
  s.F = F; s.P = P;
  return s;
}
const etatFile = () => ({ v: 1, uid: UID, dom: 'www.vinted.fr', actif: true, debut: Date.now(), total: 3, file: null, attente: null, prochain: null, fin: null, premierFait: false });
// Le faux Vinted : la cloche porte les favoris, la conversation créée porte CET article et CETTE personne.
function vinted(req) {
  if (req.methode === 'GET' && /\/inbox-notifications\/v1\/notifications$/.test(req.chemin)) return { status: 200, body: { notifications: [0, 1, 2].map((i) => ({ id: 'n' + i, entry_type: 20 })) } };
  if (req.methode === 'POST' && /\/api\/v2\/conversations$/.test(req.chemin)) { let b = {}; try { b = JSON.parse(req.corps || '{}'); } catch (_) {} const i = Number(b.item_id) - 9000; return { status: 200, body: { code: 0, conversation: conv(i) } }; }
  const mc = /\/api\/v2\/conversations\/(\d+)$/.exec(req.chemin); if (req.methode === 'GET' && mc) return { status: 200, body: { conversation: conv(Number(mc[1]) - 3000) } };
  const mt = /\/api\/v2\/transactions\/(\d+)$/.exec(req.chemin); if (req.methode === 'GET' && mt) { const i = Number(mt[1]) - 5000; return { status: 200, body: { transaction: { id: 5000 + i, item_id: 9000 + i, item: { id: 9000 + i, price: { amount: '50.0', currency_code: 'EUR' } } } } }; }
  if (req.methode === 'POST' && /\/offers$/.test(req.chemin)) return { status: 200, body: { code: 0 } };
  if (req.methode === 'POST' && /\/replies$/.test(req.chemin)) return { status: 200, body: { code: 0 } };
  return { status: 404, body: {} };
}
const conv = (i) => ({ id: 3000 + i, opposite_user: { id: 7000 + i, login: 'acheteuse_' + i }, transaction: { id: 5000 + i, item_id: 9000 + i, item_title: 'Nike Air Max 90 ' + (40 + i) }, allow_reply: true, messages: [] });
async function monde(o = {}) {
  const sv = await serveur();
  sv.lancer(3, o.lancer || {});
  const store = Object.assign({ vrmFavorisCarte: etatFile(), __commeBleamDefaut: true }, o.store || {});
  const lignes = { main: { vinted_annonce_numeros: { '9000': { numero: '41', min: '40' }, '9001': { numero: '42', min: '40' }, '9002': { numero: '43' } } } };
  const f = faireFond({ src: SRC, connecte: UID, comptes: [{ vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' }], store, lignes: Object.assign(lignes, o.lignes || {}), vrm: sv.vrm, vinted });
  f.ctx.notifierApp = async () => {};
  f.ctx.__vrmPausesVues = [];
  return { f, sv };
}
const lireSt = (f) => f.store.vrmFavorisCarte || {};
const repliques = (f) => f.j.vinted.filter((v) => v.methode === 'POST' && /\/replies$/.test(v.chemin));
// Les attentes VOULUES avant le 1er message (le banc raccourcit les minuteries : on somme ce que le fond a demandé).
function attentesAvant(f) {
  const p = f.ctx.__vrmPausesVues || [];
  return p.reduce((s, x) => s + (Number(x[1]) || 0), 0);
}

(async () => {
  const t = Date.now();
  // ── I1 / I2 : Vinted ouvert à l'instant, SON envoi ─────────────────────────────────────────────────────
  console.log('\nI1. Vinted ouvert à l’instant (attente de la discrétion tirée : 4 min), son envoi confirmé');
  let f1;
  {
    const { f, sv } = await monde({ store: { vrmOuverture: { [UID]: { depuis: t, attente: 4 * MIN, vu: t } } } });
    f1 = f;
    // Le 1er tour : jusqu'au 1er message (le fond s'arrête après chaque favori ; on mesure CE favori).
    const pausesAvant = [];
    const orig = f.ctx.__vrmPausesVues;
    await f.ctx.tickFavorisCarte();
    const st = lireSt(f), rep = repliques(f);
    // La somme des attentes demandées jusqu'à la 1re réponse partie (tout ce qui est noté pendant CE favori).
    const total = attentesAvant(f);
    const attenteGarde = st.prochain && sv.reservations === 0 ? st.prochain - Date.now() : 0;
    console.log(`     mesuré : réservations ${sv.reservations} · messages partis ${rep.length} · attente de la garde ${s1(attenteGarde)} · attentes voulues avant le 1er message ${s1(total)} · ${JSON.stringify(orig.map((x) => [x[0], Math.round(x[1])]))}`);
    dit(sv.reservations >= 1 && st.quoi !== 'ouverture', 'aucune attente « Vinted vient d’être ouvert » pour SON envoi : la place est prise au premier tour', `${sv.reservations} ${st.quoi}`);
    dit(rep.length >= 1, 'le 1er message est PARTI (la page a envoyé sa réponse)', rep.length);
    dit(attenteGarde + total < 15000, 'le 1er message part moins de 15 s après « Confirmer l’envoi » (attentes voulues comprises)', s1(attenteGarde + total));
    const ec = (f.ctx.__vrmPausesVues || []).filter((x) => /^ecriture:/.test(x[0]));
    console.log('\nI2. Le 1er message : le temps d’écriture de SON clic');
    dit(ec.length >= 1 && ec[0][0] === 'ecriture:premier' && ec[0][1] >= 2000 && ec[0][1] <= 6000, '1er message : « ecriture:premier », 2 à 6 s', JSON.stringify(ec));
    dit(lireSt(f).premierFait === true, 'l’état de la file retient que le 1er est parti', JSON.stringify(lireSt(f).premierFait));
  }
  console.log('\nI2b. Même chose hors séquence « comme Bleam » (offre d’abord, puis le message)');
  {
    const { f } = await monde({ store: { vrmCommeBleam: { favoris: false } } });
    await f.ctx.tickFavorisCarte();
    const ec = (f.ctx.__vrmPausesVues || []).filter((x) => /^ecriture:/.test(x[0]));
    dit(repliques(f).length >= 1 && ec.length >= 1 && ec[0][0] === 'ecriture:premier' && ec[0][1] <= 6000, 'le 1er message part, au temps d’écriture de son clic', JSON.stringify(ec));
  }
  // ── I3 : le message suivant ────────────────────────────────────────────────────────────────────────────
  console.log('\nI3. Le message suivant : le temps d’une série');
  {
    const { f } = await monde({ store: { vrmFavorisCarte: Object.assign(etatFile(), { premierFait: true }) } });
    await f.ctx.tickFavorisCarte();
    const ec = (f.ctx.__vrmPausesVues || []).filter((x) => /^ecriture:/.test(x[0]));
    dit(ec.length >= 1 && ec[0][0] === 'ecriture:serie' && ec[0][1] >= 5000 && ec[0][1] <= 45000, 'les suivants : « ecriture:serie », 5 à 45 s (la règle du 12 nov.)', JSON.stringify(ec));
  }
  // ── I4 : le mode auto attend toujours après l'ouverture ────────────────────────────────────────────────
  console.log('\nI4. Le mode auto, lui, attend après l’ouverture');
  {
    const { f } = await monde({ store: { vrmOuverture: { [UID]: { depuis: t, attente: 4 * MIN, vu: t } } } });
    const r = await f.ctx.attenteAvantFavori(UID, 3);
    const m = await f.ctx.attenteAvantFavori(UID, 3, { manuel: true });
    dit(r && r.quoi === 'ouverture' && r.ms > 3 * MIN && r.ms <= 4 * MIN, 'automatique : attente « ouverture » (≈ 4 min) gardée', JSON.stringify(r));
    dit(m === null, 'son envoi : aucune attente', JSON.stringify(m));
    const p = await f.ctx.porteDiscretion(UID, 'favori', {});
    dit(p && p.quoi === 'ouverture', 'la porte de la discrétion garde l’ouverture pour tout geste automatique', JSON.stringify(p && p.quoi));
  }
  // ── I5 : les plafonds tiennent pour son envoi ──────────────────────────────────────────────────────────
  console.log('\nI5. Les plafonds tiennent pour son envoi (et le prochain est daté)');
  {
    const so = Array.from({ length: 15 }, (_, i) => t - 50 * MIN + i * 2 * MIN);
    const { f, sv } = await monde({ store: { vrmSortes: { [UID]: { favori: so, at: t } } } });
    await f.ctx.tickFavorisCarte();
    const st = lireSt(f), att = st.prochain ? st.prochain - Date.now() : null;
    dit(sv.reservations === 0 && repliques(f).length === 0 && st.quoi === 'sorte' && att != null && Math.abs(att - 10 * MIN) < 5000, '15 favoris cette heure ⇒ rien ne part, « 15 par heure », le prochain dans ≈ 10 min', `${sv.reservations} ${st.quoi} ${s1(att)}`);
  }
  {
    const acts = Array.from({ length: 44 }, (_, i) => t - 59 * MIN + i * 1000);
    const { f, sv } = await monde({ store: { vrmActions: { [UID]: acts } } });
    await f.ctx.tickFavorisCarte();
    const st = lireSt(f);
    dit(sv.reservations === 0 && repliques(f).length === 0 && st.quoi === 'heure' && Number(st.prochain) > Date.now(), '44 actions prises (50/h, réserve 5) ⇒ rien ne part, raison « heure », heure du prochain posée', `${sv.reservations} ${st.quoi}`);
  }
  {
    const { f, sv } = await monde({ store: { vrmCaptcha: { [UID]: { depuis: t - 1000 } } } });
    await f.ctx.tickFavorisCarte();
    dit(sv.reservations === 0 && repliques(f).length === 0 && lireSt(f).attente === 'verification', 'vérification de Vinted ⇒ arrêt, rien ne part', lireSt(f).attente);
  }
  {
    const { f, sv } = await monde({ store: { vrmToutArrete: { on: true, at: t } } });
    await f.ctx.tickFavorisCarte();
    dit(sv.reservations === 0 && repliques(f).length === 0 && lireSt(f).attente === 'tout_arrete', '« Tout arrêter » ⇒ rien ne part', lireSt(f).attente);
  }
  // ── I6 : les espacements ───────────────────────────────────────────────────────────────────────────────
  console.log('\nI6. Les espacements suivants : 20–60 s au hasard par défaut, jamais deux fois le même');
  {
    const { f } = await monde();
    const cad = await f.ctx.cadenceCompte(UID);
    dit(cad.pauseMin === 20 && cad.pauseMax === 60, 'défaut de SA cadence : pause 20 à 60 s (au lieu de 40 à 90 s)', `${cad.pauseMin}–${cad.pauseMax}`);
    // `lancer` : la plage part TOUJOURS au serveur (posée ou défaut) ; « Plus prudent » n'en envoie pas.
    const sv = await serveur();
    const ap = { [UID]: { at: Date.now(), etat: 'pret', total: 3, cochables: ['c0', 'c1', 'c2'] } };
    const f2 = faireFond({ src: SRC, connecte: UID, comptes: [{ vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' }], store: { vrmFavorisApercu: ap, __commeBleamDefaut: true }, vrm: sv.vrm, vinted });
    const cle = (f2.src || '').length ? null : null; void cle;
    const k = Object.keys(f2.store).find((x) => /Apercu/i.test(x));
    void k;
    const tab = { tab: { id: 7, url: 'https://www.vinted.fr/member/' + UID } };
    const r1 = await f2.ctx.favorisCarte({ quoi: 'lancer', uid: UID, confirme: true, selection: ['c0', 'c1', 'c2'], reglages: { version: 1, message: 'Bonjour {pseudo}' }, rythme: 'normal' }, tab);
    const l1 = sv.lancers[0] || {};
    dit(r1 && r1.ok && l1.plage && l1.plage.min === 20000 && l1.plage.max === 60000, '« Confirmer l’envoi » : la plage 20–60 s part au serveur sans réglage posé', JSON.stringify({ r: r1 && (r1.ok || r1.raison), plage: l1.plage }));
    const sv2 = await serveur();
    const f3 = faireFond({ src: SRC, connecte: UID, comptes: [{ vinted_user_id: UID, domain: 'www.vinted.fr', access_token: 'jeton' }], store: { vrmFavorisApercu: ap, __commeBleamDefaut: true }, vrm: sv2.vrm, vinted });
    await f3.ctx.favorisCarte({ quoi: 'lancer', uid: UID, confirme: true, selection: ['c0', 'c1', 'c2'], reglages: { version: 1, message: 'Bonjour {pseudo}' }, rythme: 'prudent' }, tab);
    dit(sv2.lancers[0] && !sv2.lancers[0].plage && sv2.lancers[0].rythme === 'prudent', '« Plus prudent » : aucune plage, le serveur garde 2 à 4 min', JSON.stringify(sv2.lancers[0] && { plage: sv2.lancers[0].plage, rythme: sv2.lancers[0].rythme }));
    // La VRAIE file : 15 favoris, la plage 20–60 s ; chaque espacement tiré (réservé, fini, le suivant).
    const F = sv.F; let d = null; const now0 = Date.now();
    const targets = Array.from({ length: 15 }, (_, i) => ({ itemId: String(9100 + i), recipientId: String(7100 + i), notificationId: 'm' + i, initiator: 'favourite' }));
    d = F.lancerFile(d, { owner: OWNER, targets, message: 'Bonjour {pseudo}', intervalleMinutes: 0, maintenant: now0, lot: 'x', plage: l1.plage || { min: 40000, max: 90000 } }).data;
    const ecarts = []; let horloge = now0;
    for (let i = 0; i < 15; i++) {
      const jt = `00000000-0000-4000-9000-${String(i).padStart(12, '0')}`;
      const r = F.reserverFile(d, { owner: OWNER, maintenant: horloge, jeton: jt, suivi: 's' }); d = r.data || d;
      if (!r.valeur.travail) break;
      ecarts.push(d.enCours.delai);
      const c = F.consommerFile(d, { owner: OWNER, jeton: jt, maintenant: horloge }); d = c.data || d;
      const v = F.verifierReservation ? F.verifierReservation(d, { owner: OWNER, jeton: jt, maintenant: horloge }) : null; if (v && v.data) d = v.data;
      const tt = F.terminerFile(d, { owner: OWNER, jeton: jt, resultat: 'envoye', maintenant: horloge + 1000, ecrits: 2 }); d = tt.data || d;
      horloge += 1000 + ecarts[ecarts.length - 1];
    }
    const suivants = ecarts.slice(0, 14);
    console.log(`     mesuré : ${suivants.map((x) => Math.round(x / 1000) + ' s').join(' · ')}`);
    dit(suivants.length === 14 && suivants.every((x) => x >= 20000 && x <= 60000), '14 espacements, tous dans 20–60 s', JSON.stringify(suivants));
    dit(suivants.every((x, i) => i === 0 || x !== suivants[i - 1]) && new Set(suivants).size >= 7, 'jamais deux fois de suite le même, et variés', JSON.stringify(suivants));
  }
  // ── I7 : le délai après le favori ne retire rien de SON aperçu ─────────────────────────────────────────
  console.log('\nI7. « Attendre N min après le favori » (mode auto) ne retire rien de SON aperçu');
  {
    const { f } = await monde();
    const recent = new Date(Date.now() - 2 * MIN).toISOString();
    f.ctx.apiFavorisCarte = async () => ({ ok: true, json: { apercu: { etat: 'pret', total: 1, tous: [{ id: 'z1', itemId: '9000', recipientId: '7000', pseudo: 'a', date: recent, cochable: true, envoi: 'a_envoyer' }] } } });
    f.ctx.bleamCompte = async () => ({ favoris: { actif: true, noteMin: 0, parArticle: 0, periodeJours: 0, apresMin: 30, reecrireJours: 0 } });
    const r = typeof f.ctx.apercuCarteFrais === 'function' ? await f.ctx.apercuCarteFrais(UID) : null;
    const x = r && r.apercu && r.apercu.tous ? r.apercu.tous[0] : null;
    dit(x && x.cochable === true, 'un favori de 2 min reste cochable malgré « 30 min après le favori »', JSON.stringify(x));
    const garde = (f.store.vrmFavorisApercu || {})[UID];
    dit(garde && Array.isArray(garde.cochables) && garde.cochables.includes('z1'), 'et l’aperçu gardé (celui que « lancer » relit) le compte cochable', JSON.stringify(garde));
  }
  // ── I8 : un drapeau venu de l'app n'est jamais cru ─────────────────────────────────────────────────────
  console.log('\nI8. Un « manuel » venu de l’app n’est jamais cru');
  {
    const { f } = await monde();
    let vu = null;
    const orig = f.ctx.executerPourAppCoeur;
    f.ctx.executerPourAppCoeur = async (m) => { vu = m; return { ok: false }; };
    await f.ctx.executerPourApp({ uid: UID, method: 'POST', endpoint: '/vrm/favoris', body: {}, __manuel: true, __premier: true, __texte: 'x' }, { origin: 'https://vrm.center' });
    f.ctx.executerPourAppCoeur = orig;
    dit(vu && vu.__manuel === false && vu.__premier === false && vu.__texte === null, 'executerPourApp remet `__manuel`, `__premier`, `__texte` à rien', JSON.stringify(vu && { m: vu.__manuel, p: vu.__premier, t: vu.__texte }));
  }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  if (mut) try { fs.unlinkSync(SRC); } catch (_) {}
  void f1;
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
