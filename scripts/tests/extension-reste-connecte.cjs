// ════════════════════════════════════════════════════════════════════════════
//  « ÇA SE DÉCONNECTE À CHAQUE FOIS » (Julien, 8 nov., 22 h, iPhone, Orion 5.328)
//  — le VRAI background.js (scripts/_fond-vm.cjs) contre un faux GoTrue à état
//  (scripts/tests/_faux-gotrue.cjs : rotation, parent rendu, réutilisation 10 s,
//  famille révoquée sur un jeton déjà consommé).
//
//  R1 connexion par mot de passe : session rangée, mot de passe nulle part.
//  R2 service worker relancé : toujours connecté, sans réseau.
//  R3 horloge +6 h : UN renouvellement, connecté, famille vivante ; relancé : idem.
//  R4 deux contextes de l'extension qui renouvellent EN MÊME TEMPS (deux réveils
//     du service worker, iOS qui gèle Orion) : UN SEUL jeton envoyé pour toute
//     l'extension (chaque rotation de trop est un pas vers la famille révoquée).
//  R5 service worker tué pendant un renouvellement (le serveur a tourné le jeton,
//     la réponse est perdue) : le réveil suivant reste connecté.
//  R6 rangement de la session raté : il est NOTÉ (`session_non_rangee`), jamais
//     en silence.
//  R7 renouvellement « pas su » (en cours) : l'icône ne rouvre pas la connexion
//     comme si la session était perdue (`incertain` ≠ déconnecté).
//  `--src chemin` : un autre background.js (preuve sur la 5.328, §6.1).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { faireFond, cheminSource } = require('../_fond-vm.cjs');
const { fauxGoTrue } = require('./_faux-gotrue.cjs');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log('✅ ' + quoi); } else { ko++; console.log('❌ ' + quoi + (detail ? ' — ' + detail : '')); } };
const SRC = cheminSource();
let decalage = 0;
const maintenant = () => Date.now() + decalage;
const gt = fauxGoTrue({ maintenant });

// Un « réveil » du service worker : un nouveau fond, le MÊME stockage.
function reveil(store, opts = {}) {
  const f = faireFond(Object.assign({ src: SRC, store, onglets: [] }, opts));
  const VraiDate = Date;
  class DateBanc extends VraiDate { constructor(...a) { if (a.length) super(...a); else super(VraiDate.now() + decalage); } static now() { return VraiDate.now() + decalage; } }
  f.ctx.Date = DateBanc;
  gt.brancher(f.ctx);
  return f;
}
const etat = (f) => f.envoyer({ from: 'cancale-popup', action: 'authEtat' });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
// Laisse finir un renouvellement lancé (l'état n'attend que 2 ms au banc).
async function finirRenouv(f) { try { await f.ctx.refreshSession(); } catch (_) {} await attendre(20); }

(async () => {
  const store = { __sansSession: true };

  // R1
  let f = reveil(store);
  const r = await f.envoyer({ from: 'cancale-popup', action: 'authLogin', email: 'julien@exemple.fr', password: 'bon-mot-de-passe', ouvrir: false });
  await attendre(30);
  dit(r && r.ok === true, 'R1 · connexion par mot de passe acceptée', JSON.stringify(r));
  dit(!!(store.vrmSession && store.vrmSession.refresh_token), 'R1 · la session est rangée dans chrome.storage.local');
  dit(!JSON.stringify(store).includes('bon-mot-de-passe'), 'R1 · le mot de passe n’est rangé nulle part');

  // R2
  const nAvant = gt.j.refresh.length;
  f = reveil(store);
  let e = await etat(f);
  dit(e && e.connecte === true && gt.j.refresh.length === nAvant, 'R2 · service worker relancé : connecté, aucun renouvellement', JSON.stringify(e));

  // R3
  decalage += 6 * 3600e3;
  f = reveil(store);
  e = await etat(f); await finirRenouv(f); e = await etat(f);
  const fam = () => [...gt.familles.values()].every((x) => !x.morte);
  dit(e && e.connecte === true && fam(), 'R3 · horloge +6 h : renouvelée, connectée, famille vivante', JSON.stringify({ e, refus: gt.j.refus }));
  dit(gt.j.refresh.length - nAvant === 1, 'R3 · un seul renouvellement envoyé', 'envoyés : ' + (gt.j.refresh.length - nAvant));
  f = reveil(store);
  e = await etat(f);
  dit(e && e.connecte === true, 'R3 · relancé après les 6 h : toujours connecté', JSON.stringify(e));

  // R4
  decalage += 6 * 3600e3;
  const n4 = gt.j.refresh.length;
  const a = reveil(store), b = reveil(store);
  await Promise.all([etat(a), etat(b), a.ctx.refreshSession(), b.ctx.refreshSession()]);
  await attendre(40);
  const ea = await etat(a), eb = await etat(b);
  dit(gt.j.refresh.length - n4 === 1, 'R4 · deux contextes en même temps : UN SEUL jeton envoyé pour toute l’extension', 'envoyés : ' + (gt.j.refresh.length - n4));
  dit(ea.connecte === true && eb.connecte === true && fam(), 'R4 · les deux restent connectés, famille vivante', JSON.stringify({ ea: ea.connecte, eb: eb.connecte, refus: gt.j.refus }));

  // R5 : le premier réveil envoie, le serveur tourne le jeton, la réponse ne revient jamais.
  decalage += 6 * 3600e3;
  const tue = reveil(store);
  const fetchAvant = tue.ctx.fetch;
  // Tué : après l'envoi, ce contexte n'écrit plus rien et ne reçoit jamais la réponse.
  tue.ctx.fetch = async (url, opts) => { if (/grant_type=refresh_token/.test(String(url))) { const st = tue.ctx.chrome.storage.local; st.set = () => new Promise(() => {}); st.remove = () => new Promise(() => {}); await fetchAvant(url, opts); return new Promise(() => {}); } return fetchAvant(url, opts); };
  tue.ctx.refreshSession();
  await attendre(30);
  const g = reveil(store);
  await finirRenouv(g);
  e = await etat(g);
  dit(e && e.connecte === true && fam(), 'R5 · service worker tué pendant le renouvellement : le réveil suivant reste connecté', JSON.stringify({ e, refus: gt.j.refus }));

  // R6
  const store6 = { __sansSession: true };
  const h = reveil(store6);
  const vraiSet = h.ctx.chrome.storage.local.set;
  h.ctx.chrome.storage.local.set = function (o, cb) { if (o && o.vrmSession) { if (typeof cb === 'function') { cb(); return; } return Promise.reject(new Error('QUOTA_BYTES quota exceeded')); } return vraiSet.call(this, o, cb); };
  await h.envoyer({ from: 'cancale-popup', action: 'authLogin', email: 'julien@exemple.fr', password: 'bon-mot-de-passe', ouvrir: false });
  await attendre(30);
  dit(h.j.diags.includes('session_non_rangee'), 'R6 · une session pas rangée est NOTÉE (session_non_rangee), jamais en silence', JSON.stringify(h.j.diags.slice(-6)));

  // R7 : l'icône, un renouvellement « pas su ».
  const src = fs.readFileSync(SRC, 'utf8');
  const m = /chrome\.action\.onClicked\.addListener\(async \(tab\) => \{([\s\S]*?)\n  \}\);/.exec(src);
  dit(!!m && /incertain/.test(m[1].replace(/\/\/.*$/gm, '')), 'R7 · l’icône : « renouvellement en cours » ne rouvre pas la connexion', m ? '' : 'écouteur introuvable');

  console.log(`\n${ko ? '❌' : '✅'} extension-reste-connecte : ${ok} verts, ${ko} rouges`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
