// ════════════════════════════════════════════════════════════════════════════
//  LE PLAFOND DE 20 ACTIONS / HEURE TIENT AUSSI QUAND DEUX GESTES ARRIVENT
//  ENSEMBLE (revue adverse du 17 octobre) — node scripts/audit-compteurs-concurrents.cjs
//
//  `compterAction` et `compterLecture` font lire-ajouter-réécrire dans
//  `chrome.storage.local`. Deux appels simultanés (un geste du téléphone par le
//  relais pendant un clic dans l'app de l'ordinateur, un double clic, la
//  capture photo pendant une visite) lisaient TOUS LES DEUX la même liste à 19,
//  passaient TOUS LES DEUX, et la seconde écriture effaçait la première : 22
//  réponses parties chez Vinted dans l'heure, et seulement 20 notées — la
//  suite de l'heure dépassait encore (§3 : le plafond protège ses comptes).
//
//  Le VRAI `background.js` dans un `vm` (`_fond-vm.cjs`), stockage asynchrone.
//  `--src chemin` : la preuve sur le code d'AVANT (§6.1).
//  Aucune donnée réelle (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const S = { origin: 'https://vrm.center', url: 'https://vrm.center/' };
const rep = (c) => ({ uid: '111', method: 'POST', endpoint: `/api/v2/conversations/${c}/replies`, body: { reply: { body: 'Bonjour' } } });

(async () => {
  console.log('── 1. Trois réponses simultanées, 49 actions déjà dans l\'heure');
  await essaie('actions', async () => {
    const t = Date.now();
    const store = { vrmActions: { '111': Array.from({ length: 49 }, (_, i) => t - 60000 - i * 1000) } };
    const f = faireFond({ src: SRC, connecte: '111', store, vinted: () => ({ status: 200, body: { ok: true } }) });
    const r = await Promise.all([1, 2, 3].map((c) => f.ctx.executerPourApp(rep(c), S)));
    const parties = f.j.vinted.filter((v) => /\/replies$/.test(v.chemin)).length;
    dit(parties === 1, 'une seule part chez Vinted (la 50ᵉ de l\'heure)', `parties=${parties}, ${JSON.stringify(r.map((x) => x.code || (x.ok ? 'ok' : 'ko')))}`);
    dit(r.filter((x) => x.code === 'plafond').length === 2, 'les deux autres sont refusées « plafond »', JSON.stringify(r.map((x) => x.code || '')));
    const notes = ((f.store.vrmActions || {})['111'] || []).length;
    dit(notes === 50, 'et le compteur porte bien les 50 actions de l\'heure (aucune perdue)', `notées=${notes}`);
  });

  console.log('── 2. L\'autre sens : sous le plafond, les gestes simultanés partent tous');
  await essaie('autre sens', async () => {
    const f = faireFond({ src: SRC, connecte: '111', store: {}, vinted: () => ({ status: 200, body: { ok: true } }) });
    const r = await Promise.all([1, 2, 3, 4].map((c) => f.ctx.executerPourApp(rep(c), S)));
    const parties = f.j.vinted.filter((v) => /\/replies$/.test(v.chemin)).length;
    dit(parties === 4 && r.every((x) => x.ok), 'quatre réponses simultanées, budget vide : les quatre partent', `parties=${parties}`);
    const notes = ((f.store.vrmActions || {})['111'] || []).length;
    dit(notes === 4, 'et les quatre sont notées', `notées=${notes}`);
  });

  console.log('── 3. Le budget de LECTURE : même règle');
  await essaie('lectures', async () => {
    const t = Date.now();
    const store = { vrmLectures: { '111': Array.from({ length: 19 }, (_, i) => t - 60000 - i * 1000) } };
    const f = faireFond({ src: SRC, connecte: '111', store });
    const r = await Promise.all([1, 2, 3].map(() => f.ctx.compterLecture('111')));
    dit(r.filter((x) => x && x.ok).length === 1, 'trois lectures simultanées à 19 : une seule passe', JSON.stringify(r));
    const notes = ((f.store.vrmLectures || {})['111'] || []).length;
    dit(notes === 20, 'et le compteur de lectures porte bien 20', `notées=${notes}`);
  });

  console.log('── 4. Les gestes AUTOMATIQUES (garde : moteur d\'offres, bordereau de la visite) laissent la réserve aux clics');
  await essaie('reserve', async () => {
    const t = Date.now();
    const store = { vrmActions: { '111': Array.from({ length: 45 }, (_, i) => t - 20 * 60000 - i * 1000) } };
    const f = faireFond({ src: SRC, connecte: '111', store, vinted: () => ({ status: 200, body: { ok: true } }) });
    const g = await f.ctx.garde('111', { domain: 'www.vinted.fr' });
    dit(!!g && g.code === 'trop-d-actions', 'à 45 actions, un geste automatique est refusé (les 5 dernières sont gardées)', JSON.stringify(g));
    const notes = ((f.store.vrmActions || {})['111'] || []).length;
    dit(notes === 45, 'et le refus ne consomme rien', `notées=${notes}`);
    const r = await f.ctx.executerPourApp(rep(9), S);
    dit(r.ok, 'une réponse à un acheteur sur clic passe encore à 45', JSON.stringify(r.code || r.error || 'ok'));
    const f2 = faireFond({ src: SRC, connecte: '111', store: { vrmActions: { '111': Array.from({ length: 44 }, (_, i) => t - 20 * 60000 - i * 1000) } } });
    dit((await f2.ctx.garde('111', { domain: 'www.vinted.fr' })) === null, 'l\'autre sens : à 44, le geste automatique part');
  });

  console.log(`\n${ok} contrôle(s) conforme(s), ${ko} non conforme(s).`);
  process.exit(ko ? 1 : 0);
})();
