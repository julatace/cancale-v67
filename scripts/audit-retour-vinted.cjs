// ═══════════════════════════════════════════════════════════════════════════
// LE RATTRAPAGE « QUAND JE REVIENS SUR VINTED » (31 oct., 5.294)
//   node scripts/audit-retour-vinted.cjs [--src background.js] [--content content.js]
//   node scripts/audit-retour-vinted.cjs --prouve   (réaffaiblit chaque règle : chacune doit rougir)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (iPhone, Orion) : « fais le rattrapage quand je reviens sur Vinted ».
// Sans `alarms`, une tâche ne repart que si elle est due (dressing 10 min,
// moisson 20 min) : revenir sur l'onglet après 5 à 9 min ne relisait RIEN.
// Le VRAI background.js (vm, `_fond-vm.cjs`) et le VRAI content.js :
//   · retour après 5 min (dernière lecture complète vieille de 5 min) ⇒ UNE relecture ;
//   · retour 30 s après une relecture ⇒ rien (jamais une rafale) ;
//   · dernière lecture complète il y a 1 min ⇒ rien ;
//   · budget de lecture épuisé (20/h) ⇒ rien, et c'est noté ;
//   · pause demandée par Vinted ⇒ rien ;
//   · message venu d'un onglet qui n'est pas vinted.* ⇒ rien ;
//   · une lecture COMPLÈTE rangée date le compte ; une partielle, non ;
//   · content.js envoie le message au retour visible, sur vinted.* seulement.
// Données inventées.
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  content: arg('--content', path.join(racine, 'vinted-sync-extension/content.js')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['sansDateRetour', 'src', "if (maintenant - der < RETOUR_VINTED_MS) { noterDiag('retour_vinted_trop_tot'); return { ok: true, fait: false, code: 'trop-tot' }; }", ''],
    ['sansFraicheur', 'src', "if (maintenant - cap < RETOUR_VINTED_MS) { noterDiag('retour_vinted_frais'); return { ok: true, fait: false, code: 'frais' }; }", ''],
    ['sansBudget', 'src', "const g = await gardeLecture(uid, { domain }, 'enligne');", 'const g = null;'],
    ['sansOngletVinted', 'src', "if (!RE_ONGLET_VINTED.test(url) || (sender && sender.frameId > 0)) return { ok: false, code: 'pas-vinted' };", ''],
    ['sansMarqueComplete', 'src', "if (capturePrevue && ecritRow !== false) await noterCaptureComplete(uid);", ''],
    ['contentMuet', 'content', "chrome.runtime.sendMessage({ from: 'vrm-retour', action: 'vintedVisible' }", "void ({ from: 'vrm-retour', action: 'vintedVisible' }"],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'retour-vinted-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const UID = '111';
const ONGLET = { tab: { id: 7, url: 'https://www.vinted.fr/member/111' }, frameId: 0 };

// Un fond où `captureDomain` et `runActive` sont COMPTÉS (la moisson elle-même a
// ses propres audits) ; `activeAccountId` dit le compte connecté (la garde).
function fondRetour(store, opts = {}) {
  const f = faireFond({ src: F.src, connecte: UID, store });
  const appels = { capture: 0, active: 0 };
  f.ctx.captureDomain = async () => { appels.capture++; return UID; };
  f.ctx.runActive = async () => { appels.active++; return true; };
  f.ctx.activeAccountId = async () => (opts.compteOnglet || UID);
  return { f, appels };
}
const envoyerRetour = (f, sender) => f.envoyer({ from: 'vrm-retour', action: 'vintedVisible' }, sender || ONGLET);
const il = (ms) => Date.now() - ms;

(async () => {
  // 1. Retour après 5 min : une relecture.
  {
    const { f, appels } = fondRetour({ vrmCaptureComplete: { [UID]: il(5 * 60000) } });
    const r = await envoyerRetour(f);
    dit(appels.capture === 1 && appels.active === 1, '1 · retour sur Vinted 5 min après la dernière lecture complète ⇒ UNE relecture (jetons + moisson)', JSON.stringify({ r, appels }));
    const st = f.store.vrmRetourVinted;
    dit(st && Number(st.at) > il(10000), '1 · la relecture est datée dans chrome.storage.local (le fond peut mourir)', JSON.stringify(st || null));
    // 2. 30 s plus tard (un autre retour) : rien.
    f.store.vrmRetourVinted = { at: il(30000), uid: UID };
    await envoyerRetour(f);
    dit(appels.active === 1 && f.j.diags.includes('retour_vinted_trop_tot'), '2 · retour 30 s après une relecture ⇒ rien (au plus une fois par 3 min), noté', JSON.stringify(appels));
    // Retours en rafale (même instant) : une seule relecture.
    f.store.vrmRetourVinted = { at: 0 };
    f.store.vrmCaptureComplete = { [UID]: il(10 * 60000) };
    await Promise.all([envoyerRetour(f), envoyerRetour(f), envoyerRetour(f)]);
    dit(appels.active === 2, '2 · trois retours au même instant ⇒ une seule relecture de plus', JSON.stringify(appels));
  }
  // 3. Dernière lecture complète il y a 1 min : rien.
  {
    const { f, appels } = fondRetour({ vrmCaptureComplete: { [UID]: il(60000) } });
    await envoyerRetour(f);
    dit(appels.active === 0 && f.j.diags.includes('retour_vinted_frais'), '3 · lecture complète il y a 1 min ⇒ rien ne part', JSON.stringify(appels));
  }
  // 4. Budget de lecture épuisé : rien, noté.
  {
    const pleines = Array.from({ length: 20 }, (_, i) => il(60000 + i * 1000));
    const { f, appels } = fondRetour({ vrmCaptureComplete: { [UID]: il(30 * 60000) }, vrmLectures: { [UID]: pleines } });
    await envoyerRetour(f);
    dit(appels.active === 0 && appels.capture === 0, '4 · budget de lecture épuisé (20/h) ⇒ rien ne part', JSON.stringify(appels));
    dit(f.j.diags.some((d) => /^retour_vinted_(lectures|trop-de)/.test(d)), '4 · et c’est noté', f.j.diags.filter((d) => /retour/.test(d)).join(','));
    dit(!f.store.vrmRetourVinted, '4 · un refus ne consomme pas la place des 3 min');
  }
  // 5. Pause demandée par Vinted : rien.
  {
    const { f, appels } = fondRetour({ vrmCaptureComplete: { [UID]: 0 }, vrmPauseVinted: { jusqua: Date.now() + 3600e3, depuis: il(60000), statut: 429 } });
    await envoyerRetour(f);
    dit(appels.active === 0, '5 · pause posée par un 429 ⇒ rien ne part', JSON.stringify(appels));
  }
  // 6. Onglet qui n'est pas Vinted, cadre intérieur : rien.
  {
    const { f, appels } = fondRetour({ vrmCaptureComplete: { [UID]: 0 } });
    await envoyerRetour(f, { tab: { id: 9, url: 'https://www.leboncoin.fr/' }, frameId: 0 });
    await envoyerRetour(f, { tab: { id: 9, url: 'https://vinted.fr.exemple.com/' }, frameId: 0 });
    await envoyerRetour(f, { tab: { id: 7, url: 'https://www.vinted.fr/' }, frameId: 3 });
    dit(appels.active === 0, '6 · un message hors d’un onglet vinted.* (ou d’un cadre) ne déclenche rien', JSON.stringify(appels));
  }
  // 7. Une lecture COMPLÈTE rangée date le compte ; une partielle, non.
  {
    const f = faireFond({ src: F.src, connecte: UID, lignes: {} });
    const items = [{ id: 1, title: 'a' }, { id: 2, title: 'b' }];
    await f.ctx.storeHarvestRow(UID, 'listings', { items: items.slice(0, 1), pagination: { total_entries: 2 } }, 'www.vinted.fr', { complet: false });
    const avant = (f.store.vrmCaptureComplete || {})[UID];
    dit(!avant, '7 · une lecture partielle du dressing ne date rien', String(avant));
    await f.ctx.storeHarvestRow(UID, 'listings', { items, pagination: { total_entries: 2 } }, 'www.vinted.fr', { complet: true });
    const apres = Number((f.store.vrmCaptureComplete || {})[UID]);
    dit(apres > il(10000), '7 · une lecture COMPLÈTE rangée date le compte (le prochain retour s’en sert)', String(apres));
  }
  // 8. content.js envoie le message au retour visible, sur vinted.* seulement.
  for (const [hote, attendu] of [['www.vinted.fr', 1], ['www.leboncoin.fr', 0]]) {
    const SRC = fs.readFileSync(F.content, 'utf8');
    const ecoutes = {}, envoyes = [];
    const doc = { visibilityState: 'hidden', addEventListener: (t, fn) => { (ecoutes[t] = ecoutes[t] || []).push(fn); }, createElement: () => ({ remove() {}, setAttribute() {} }), head: { appendChild() {} }, documentElement: { appendChild() {} }, cookie: '', readyState: 'complete' };
    const ctx = { document: doc, location: { hostname: hote, href: 'https://' + hote + '/', origin: 'https://' + hote },
      window: { addEventListener() {}, postMessage() {} }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, console: { log() {}, warn() {}, error() {} }, URL,
      chrome: { runtime: { id: 'x', lastError: null, getURL: (p) => 'chrome-extension://x/' + p, sendMessage: (m, cb) => { envoyes.push(m); if (typeof cb === 'function') cb(undefined); }, onMessage: { addListener() {} } }, storage: { local: { get: (k, cb) => { if (cb) cb({}); return Promise.resolve({}); } }, onChanged: { addListener() {} } } } };
    vm.createContext(ctx);
    try { vm.runInContext(SRC, ctx, { filename: 'content.js' }); } catch (_) {}
    doc.visibilityState = 'visible';
    for (const fn of ecoutes.visibilitychange || []) { try { fn(); } catch (_) {} }
    await attendre(1700);
    const n = envoyes.filter((m) => m && m.from === 'vrm-retour' && m.action === 'vintedVisible').length;
    dit(n === attendu, `8 · content.js sur ${hote} : ${attendu ? 'le retour visible prévient le fond' : 'aucun message'}`, 'messages=' + n);
  }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ rattrapage au retour sur Vinted : tout est vert');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack)); process.exit(1); });
