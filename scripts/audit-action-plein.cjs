// ════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN « ACTION EN COURS » ET L'ATTENTE DES FAVORIS (17 nov., ext. 5.406)
//
//  Julien (capture Orion sur vinted.fr) : « tu ne penses pas que 10 mins c'est bcp » ;
//  « quand on fait une action sur vinted l'extension prend tout le site et qu'on puisse
//  pas faire, vinted autour est flouté ».
//
//  On EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs) branché sur la VRAIE file du
//  serveur (api/_lib/favoris-file.js + src/favorisProgression.js, état en mémoire) :
//   W1. « Vinted vient d'être ouvert » (attente tirée 2–6 min) : la suite est annoncée au
//       VRAI temps de la garde (≤ 6 min), avec sa raison (`quoi`), et AUCUNE réservation
//       n'est faite chez VRM (avant : réservée, refusée, puis 10 min FIXES) ;
//   W2. 15 messages aux favoris déjà partis cette heure : attente = quand le plus ancien
//       sort de l'heure (le vrai temps), raison « sorte » ; aucune requête Vinted ;
//   W3. 50/h : 44 actions déjà prises (réserve 5) ⇒ rien ne part, attente = la vraie
//       place libre, raison « heure » ; le compteur reste à 44 (le 50/h jamais franchi) ;
//   W4. budget frais, aucune garde : la carte réserve tout de suite (pas d'attente ajoutée) ;
//   W5. un refus d'attente APRÈS réservation (course) : le serveur reprend au vrai temps
//       (`apresMs`), plus 10 min fixes ; un ancien appel sans `apresMs` garde 10 min ;
//   O1. l'état « action en cours » (`vrmActionEnCours`) est posé PENDANT la file et
//       seulement pendant ; « Tout arrêter » (carte) l'éteint aussitôt et c'est dit ;
//   O2. vérification de Vinted (captcha) ⇒ l'état dit `verification` (l'écran s'écarte) ;
//   O3. vrm-action.js (le vrai fichier, dans un faux DOM) : rien n'est dessiné sans état
//       actif ; un état actif ⇒ un hôte à shadow root FERMÉE ; aucun `dispatchEvent`, aucun
//       `isTrusted`, aucun `.click()` sur la page ; captcha ⇒ l'écran se met de côté.
//  §6.1 : `--src <ancien background.js>` (et BANC_RACINE pour le serveur) ⇒ rouge.
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
const ACTION_JS = path.join(RACINE, 'vinted-sync-extension', 'vrm-action.js');

const MUTATIONS = {
  precheck: ['const av = await attenteAvantFavori(st.uid, 3);', 'const av = null;'],
  apres: ['if(arretPlafond){const at=attenteDeRefus(arretPlafond);if(at>0)apresMs=at;}', ''],
  essai: ['if (essai) return { ok: true, n: tous.length, essai: true };', ''],
  etat: ["await poserActionEnCours(st);", ''],
  arret: ["await finirActionEnCours('arret');", ''],
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
  SRC = path.join(os.tmpdir(), `bg-action-plein-${mut}-${process.pid}.js`);
  fs.writeFileSync(SRC, s.split(a).join(b));
}

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 400) : ''}`); } };
const UID = '424242', OWNER = 'owner-banc', MIN = 60000;
const mn = (ms) => (ms == null ? '—' : (ms / MIN).toFixed(1) + ' min');

// La VRAIE file du serveur, en mémoire (un propriétaire, un compte).
async function serveur() {
  const F = await import(pathToFileURL(path.join(RACINE, 'api', '_lib', 'favoris-file.js')).href);
  const P = await import(pathToFileURL(path.join(RACINE, 'src', 'favorisProgression.js')).href);
  let d = null, n = 0;
  const jeton = () => { n++; return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`; };
  const s = { d: () => d, reservations: 0, terminer: [] };
  s.lancer = (k = 3, intervalle = 0) => {
    const targets = Array.from({ length: k }, (_, i) => ({ itemId: String(9000 + i), recipientId: String(7000 + i), notificationId: 'n' + i, initiator: 'favourite' }));
    d = F.lancerFile(d, { owner: OWNER, targets, message: 'Bonjour {pseudo}', intervalleMinutes: intervalle, maintenant: Date.now(), lot: 'lot1' }).data;
  };
  s.vrm = async (req) => {
    if (req.mode !== 'favoris') return { status: 404, body: {} };
    const now = Date.now(), c = req.corps || {};
    const carte = (v) => ({ total: v.jobs.length, envoyes: v.jobs.filter((j) => j.etat === 'envoye').length, active: v.active });
    try {
      if (req.methode === 'GET') { const v = F.vueFile(F.initialiserFile(d), OWNER); return { status: 200, body: { ok: true, uid: UID, vue: v, carte: carte(v), serveur: now } }; }
      let r;
      if (c.action === 'suivant') { r = F.reserverFile(d, { owner: OWNER, maintenant: now, jeton: jeton(), suivi: 's' }); if (r.valeur.travail) s.reservations++; }
      else if (c.action === 'consommer') r = F.consommerFile(d, { owner: OWNER, jeton: c.jeton, maintenant: now });
      else if (c.action === 'verifier') r = F.verifierReservation(d, { owner: OWNER, jeton: c.jeton, maintenant: now });
      else if (c.action === 'terminer') { const t = P.traduireResultatFavori(c.brut); s.terminer.push(t); r = F.terminerFile(d, { owner: OWNER, jeton: c.jeton, resultat: t.resultat, raison: t.raison, maintenant: now, ecrits: Number.isInteger(t.ecrits) ? t.ecrits : null, apresMs: Number.isSafeInteger(t.apresMs) ? t.apresMs : null }); }
      else if (c.action === 'arreter') r = F.arreterFile(d, OWNER);
      else return { status: 400, body: { message: 'inconnu' } };
      if (r.data) d = r.data;
      const v = ['suivant', 'consommer', 'verifier'].includes(c.action) ? r.valeur.vue : r.valeur;
      const corps = ['suivant', 'consommer', 'verifier'].includes(c.action) ? r.valeur : { vue: r.valeur };
      return { status: 200, body: Object.assign({ ok: true, uid: UID, serveur: now }, corps, v && v.jobs ? { carte: carte(v) } : {}) };
    } catch (e) { return { status: e.status || 503, body: { message: String(e.message) } }; }
  };
  s.prochain = () => { const v = F.vueFile(F.initialiserFile(d), OWNER); return v.prochain ? v.prochain - Date.now() : null; };
  s.F = F; s.P = P;
  return s;
}
const etatFile = () => ({ v: 1, uid: UID, dom: 'www.vinted.fr', actif: true, debut: Date.now(), total: 3, file: null, attente: null, prochain: null, fin: null });
async function monde(o = {}) {
  const sv = await serveur();
  sv.lancer(3, 0);
  const store = Object.assign({ vrmFavorisCarte: etatFile() }, o.store || {});
  const vinted = [];
  const f = faireFond({ src: SRC, connecte: UID, store, vrm: sv.vrm, vinted: (req) => { vinted.push(req); return o.vinted ? o.vinted(req) : { status: 500, body: {} }; } });
  // La base : rien d'autre (les autres Chrome n'ont rien fait), réglages par défaut.
  return { f, sv, vinted };
}
const lireSt = (f) => f.store.vrmFavorisCarte || {};

(async () => {
  // ── W1 : Vinted vient d'être ouvert ──────────────────────────────────────────
  console.log('\nW1. Vinted vient d’être ouvert (attente de la discrétion : 4 min)');
  {
    const t = Date.now();
    const { f, sv, vinted } = await monde({ store: { vrmOuverture: { [UID]: { depuis: t, attente: 4 * MIN, vu: t } } } });
    await f.ctx.tickFavorisCarte();
    const st = lireSt(f);
    const carte = st.prochain ? st.prochain - Date.now() : null;
    const serveurMs = sv.prochain();
    console.log(`     mesuré : carte « prochain dans ${mn(carte)} » · serveur ${mn(serveurMs)} · réservations ${sv.reservations} · requêtes Vinted ${vinted.length}`);
    dit(carte != null && carte <= 6 * MIN + 2000 && carte >= 3.5 * MIN, 'la carte annonce le VRAI temps de la garde (≈ 4 min, jamais 10)', mn(carte));
    dit(st.quoi === 'ouverture', 'la raison est dite (« ouverture »)', st.quoi);
    dit(sv.reservations === 0, 'rien n’est réservé chez VRM tant qu’une garde ferait attendre', sv.reservations);
    dit(!(serveurMs > 6 * MIN), 'le serveur ne repousse pas la suite de 10 min', mn(serveurMs));
    dit(vinted.length === 0, 'aucune requête Vinted', vinted.length);
  }
  // ── W2 : 15 favoris déjà partis cette heure ──────────────────────────────────
  console.log('\nW2. 15 messages aux favoris déjà partis cette heure (sa décision du 12 nov.)');
  {
    const t = Date.now();
    const so = Array.from({ length: 15 }, (_, i) => t - 50 * MIN + i * 2 * MIN);   // le plus ancien sort dans 10 min
    const { f, sv, vinted } = await monde({ store: { vrmSortes: { [UID]: { favori: so, at: t } } } });
    await f.ctx.tickFavorisCarte();
    const st = lireSt(f), carte = st.prochain ? st.prochain - Date.now() : null;
    console.log(`     mesuré : « prochain dans ${mn(carte)} » · raison ${st.quoi} · réservations ${sv.reservations}`);
    dit(carte != null && Math.abs(carte - 10 * MIN) < 5000, 'attente = quand le plus ancien des 15 sort de l’heure', mn(carte));
    dit(st.quoi === 'sorte', 'raison « 15 par heure »', st.quoi);
    dit(sv.reservations === 0 && vinted.length === 0, 'rien réservé, rien envoyé', `${sv.reservations}/${vinted.length}`);
  }
  // ── W3 : 50/h ────────────────────────────────────────────────────────────────
  console.log('\nW3. 44 actions déjà prises cette heure (plafond 50, réserve 5)');
  {
    const t = Date.now();
    const acts = Array.from({ length: 44 }, (_, i) => t - 59 * MIN + i * 1000);
    const { f, sv, vinted } = await monde({ store: { vrmActions: { [UID]: acts } } });
    await f.ctx.tickFavorisCarte();
    const st = lireSt(f), carte = st.prochain ? st.prochain - Date.now() : null;
    const n = ((f.store.vrmActions || {})[UID] || []).filter((x) => x > Date.now() - 3600000).length;
    console.log(`     mesuré : « prochain dans ${mn(carte)} » · raison ${st.quoi} · actions de l’heure ${n}`);
    dit(carte != null && carte > 0 && carte <= 3 * MIN, 'attente = la vraie place libre (≈ 1 min), pas 10', mn(carte));
    dit(st.quoi === 'heure', 'raison « 50 par heure »', st.quoi);
    dit(n === 44 && vinted.length === 0 && sv.reservations === 0, 'le compteur reste à 44 : le 50/h n’est jamais franchi, rien ne part', `${n}/${vinted.length}`);
  }
  // ── W4 : budget frais ────────────────────────────────────────────────────────
  console.log('\nW4. Budget frais, aucune garde');
  {
    const { f, sv } = await monde();
    await f.ctx.tickFavorisCarte();
    console.log(`     mesuré : réservations ${sv.reservations} · attente annoncée ${mn(lireSt(f).prochain ? lireSt(f).prochain - Date.now() : null)}`);
    dit(sv.reservations >= 1, 'le premier message part tout de suite (aucune attente ajoutée)', sv.reservations);
  }
  // ── W5 : le serveur et `apresMs` ─────────────────────────────────────────────
  console.log('\nW5. Refus d’attente après réservation : le serveur reprend au vrai temps');
  {
    for (const [nom, brut, attendu] of [['avec apresMs (3 min)', { ok: false, data: { resultat: 'refuse', raison: 'quota_extension', ecrits: 0, apresMs: 3 * MIN } }, 3 * MIN], ['ancienne extension (sans apresMs)', { ok: false, data: { resultat: 'refuse', raison: 'quota_extension', ecrits: 0 } }, 10 * MIN]]) {
      const sv = await serveur();
      sv.lancer(2, 0);
      const r1 = await sv.vrm({ mode: 'favoris', methode: 'POST', corps: { action: 'suivant' } });
      const jt = r1.body.travail && r1.body.travail.jeton;
      await sv.vrm({ mode: 'favoris', methode: 'POST', corps: { action: 'terminer', jeton: jt, brut } });
      const p = sv.prochain();
      dit(p != null && Math.abs(p - attendu) < 5000, `${nom} ⇒ suite dans ${mn(attendu)}`, mn(p));
    }
  }
  // ── O1/O2 : l'état « action en cours » ───────────────────────────────────────
  console.log('\nO1. L’état « action en cours » suit la file, « Tout arrêter » l’éteint');
  {
    const t = Date.now();
    const { f } = await monde({ store: { vrmOuverture: { [UID]: { depuis: t, attente: 3 * MIN, vu: t } } } });
    dit(!f.store.vrmActionEnCours || f.store.vrmActionEnCours.actif !== true, 'aucun état avant la file');
    await f.ctx.tickFavorisCarte();
    const a = f.store.vrmActionEnCours || {};
    dit(a.actif === true && a.sorte === 'favoris' && a.uid === UID && Number(a.total) === 3, 'pendant la file : actif, favoris, ce compte, sur 3', JSON.stringify(a).slice(0, 200));
    dit(Number(a.prochain) > Date.now() && a.quoi === 'ouverture', 'le prochain pas et sa raison sont dans l’état', `${a.prochain} ${a.quoi}`);
    const r = await f.envoyer({ from: 'vrm-badge', action: 'favorisCarte', quoi: 'arreter', uid: UID }, { tab: { id: 7, url: 'https://www.vinted.fr/' } });
    const b = f.store.vrmActionEnCours || {};
    dit(b.actif === false && b.fin && b.fin.raison === 'arret', '« Tout arrêter » : l’état s’éteint aussitôt, fin « arrêté » dite', JSON.stringify(b.fin));
    dit(r && r.etat && r.etat.actif === false, 'la file est arrêtée');
  }
  console.log('\nO2. Vinted demande une vérification : l’écran s’écarte');
  {
    const t = Date.now();
    const { f } = await monde({ store: { vrmCaptcha: { [UID]: { depuis: t - 1000 } } } });
    await f.ctx.tickFavorisCarte();
    const a = f.store.vrmActionEnCours || {};
    dit(a.verification === true || (a.actif === false), 'état « vérification » (ou éteint) : jamais un écran plein sur un captcha', JSON.stringify(a).slice(0, 200));
    dit((lireSt(f).attente || '') === 'verification', 'la carte dit « vérification »', lireSt(f).attente);
  }
  // ── O3 : vrm-action.js ───────────────────────────────────────────────────────
  console.log('\nO3. vrm-action.js : shadow root fermée, aucune saisie simulée');
  {
    const src = fs.existsSync(ACTION_JS) ? fs.readFileSync(ACTION_JS, 'utf8') : '';
    dit(!!src, 'vrm-action.js existe');
    const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    dit(/attachShadow\(\{\s*mode:\s*'closed'\s*\}\)/.test(code), 'shadow root FERMÉE');
    dit(!/dispatchEvent|isTrusted|\.click\(\)|new (Mouse|Keyboard|Pointer|Input)Event/.test(code), 'aucune saisie simulée (dispatchEvent, isTrusted, .click(), new …Event)');
    dit(/prefers-reduced-motion/.test(code), 'suit « réduire les animations »');
    dit(/backdrop-filter/.test(code) && /@supports not/.test(code), 'flou + repli opaque');
    dit(/captcha|datadome/i.test(code), 'regarde le captcha de Vinted pour s’écarter');
  }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  if (mut) try { fs.unlinkSync(SRC); } catch (_) {}
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); process.exit(1); });
