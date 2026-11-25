// ════════════════════════════════════════════════════════════════════════════
//  SANS ABONNEMENT : L'EXTENSION LIT ET RANGE, ELLE N'AGIT PAS (5.453.0, 25 nov.)
//  node scripts/audit-lecture-sans-abonnement.cjs [--src chemin]
//
//  Julien (25 nov.) : « Tu peux directement faire la lecture et tu floutes tant que la personne
//  n'a pas d'abonnement. Sauf si il est en essai gratuit. » La base laisse l'extension ranger ses
//  lignes de capture (migration 050) ; ce qui reste fermé, c'est TOUTE action de plateforme —
//  le compteur d'actions (`compterActionUn`) se ferme pour un compte VRM coupé.
//  Le VRAI `background.js` dans un `vm` (`_fond-vm.cjs`), faux vrm.center (`mode=abonnement`).
//  `--src chemin` : la preuve sur le code d'AVANT (§6.1) — il laisse partir l'action.
//  Aucune donnée réelle (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();
let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };
const S = { origin: 'https://vrm.center', url: 'https://vrm.center/' };
const rep = (c) => ({ uid: '111', method: 'POST', endpoint: `/api/v2/conversations/${c}/replies`, body: { reply: { body: 'Bonjour' } } });
const abo = (x) => (e) => (e.mode === 'abonnement' ? { status: 200, body: { ok: true, ...x } } : null);
const COUPE = { acces: false, lecture: true, proprietaire: false, statut: 'canceled' };
const ESSAI = { acces: true, lecture: true, proprietaire: false, statut: 'trialing' };
const reponses = (f) => f.j.vinted.filter((v) => /\/replies$/.test(v.chemin)).length;

(async () => {
  console.log('── 1. Compte VRM coupé (ni abonnement ni essai) : aucune action ne part');
  await essaie('coupé', async () => {
    const f = faireFond({ src: SRC, connecte: '111', store: {}, vrm: abo(COUPE), vinted: () => ({ status: 200, body: { ok: true } }) });
    const r = await f.ctx.executerPourApp(rep(1), S);
    dit(!r.ok && r.code === 'abonnement' && reponses(f) === 0, 'une réponse à un acheteur sur clic : refusée « abonnement », rien chez Vinted', JSON.stringify({ code: r.code, parties: reponses(f) }));
    dit(/abonne/i.test(String(r.error || '')) && /Rien n'est parti/.test(String(r.error || '')), '  la raison dit quoi faire (s’abonner, l’essai) et que rien n’est parti', r.error);
    dit(((f.store.vrmActions || {})['111'] || []).length === 0, '  le refus ne prend aucune place du compteur');
    const g = await f.ctx.garde('111', { domain: 'www.vinted.fr' });
    dit(!!g && g.code === 'abonnement', 'un geste AUTOMATIQUE (garde : offres auto, bordereau de la visite) : refusé', JSON.stringify(g && g.code));
    for (const cle of ['lbc:compteA', 'vc:compteB']) {
      const c = await f.ctx.compterAction(cle, 50);
      dit(c && c.ok === false && c.code === 'abonnement', `${cle.split(':')[0] === 'lbc' ? 'Leboncoin' : 'Vestiaire'} : le compteur se ferme aussi`, JSON.stringify(c));
    }
    const lec = await f.ctx.compterLecture('111');
    dit(lec && lec.ok === true, 'LIRE reste permis (budget de lecture séparé, inchangé)', JSON.stringify(lec));
    const n = f.j.vrmApi.filter((x) => x.mode === 'abonnement').length;
    await f.ctx.compterAction('111', 50);
    dit(f.j.vrmApi.filter((x) => x.mode === 'abonnement').length === n, '  l’état lu est gardé (vrm_abo_ext) : pas un appel à vrm.center par geste', `${n} → ${f.j.vrmApi.filter((x) => x.mode === 'abonnement').length}`);
  });

  console.log('── 2. La capture, elle, part en base');
  await essaie('capture', async () => {
    const f = faireFond({ src: SRC, connecte: '111', store: {}, vrm: abo(COUPE) });
    const okE = await f.ctx.supabaseUpsert('app_data', [{ id: 'harvest_111_listings', data: { type: 'listings', uid: '111', capturedAt: new Date().toISOString(), nItems: 0, payload: { items: [] } } }], 'id');
    dit(okE === true, 'une ligne de capture (harvest_111_listings) est écrite sans abonnement (la base la permet, 050)', String(okE));
  });

  console.log('── 3. Essai gratuit, propriétaire, abonné : rien ne change');
  for (const [nom, x] of [['essai gratuit', ESSAI], ['propriétaire', { acces: false, proprietaire: true }], ['abonné', { acces: true, proprietaire: false, statut: 'active' }]]) {
    await essaie(nom, async () => {
      const f = faireFond({ src: SRC, connecte: '111', store: {}, vrm: abo(x), vinted: () => ({ status: 200, body: { ok: true } }) });
      const r = await f.ctx.executerPourApp(rep(2), S);
      dit(r.ok && reponses(f) === 1, `${nom} : la réponse part`, JSON.stringify({ code: r.code, parties: reponses(f) }));
    });
  }

  console.log('── 4. « Pas su » ne coupe pas un abonné ; un « coupé » se relit vite');
  await essaie('pas su', async () => {
    const f = faireFond({ src: SRC, connecte: '111', store: {}, vrm: () => ({ reseau: true }), vinted: () => ({ status: 200, body: { ok: true } }) });
    const r = await f.ctx.executerPourApp(rep(3), S);
    dit(r.ok, 'vrm.center injoignable, rien de connu : l’action part (on ne bloque pas un abonné sur un hoquet)', JSON.stringify(r.code || 'ok'));
    const t = Date.now();
    const f2 = faireFond({ src: SRC, connecte: '111', store: { vrm_abo_ext: { owner: 'owner-banc', coupe: true, at: t - 10 * 60000 } }, vrm: () => ({ reseau: true }) });
    const c = await f2.ctx.compterAction('111', 50);
    dit(c.ok === false && c.code === 'abonnement', '  injoignable mais « coupé » déjà lu : reste coupé (la dernière réponse)', JSON.stringify(c));
    const f3 = faireFond({ src: SRC, connecte: '111', store: { vrm_abo_ext: { owner: 'owner-banc', coupe: true, at: t - 3 * 60000 } }, vrm: abo(ESSAI) });
    const c3 = await f3.ctx.compterAction('111', 50);
    dit(c3.ok === true, '  il vient de commencer l’essai : relu au bout de 2 min, les actions repartent', JSON.stringify(c3));
    const f4 = faireFond({ src: SRC, connecte: '111', store: { vrm_abo_ext: { owner: 'autre-compte', coupe: true, at: t } }, vrm: abo(ESSAI) });
    dit((await f4.ctx.compterAction('111', 50)).ok === true, '  l’état d’un AUTRE compte VRM (même navigateur) ne vaut rien pour celui-ci');
  });

  console.log(`\n${ok} contrôle(s) conforme(s), ${ko} non conforme(s).`);
  process.exit(ko ? 1 : 0);
})();
