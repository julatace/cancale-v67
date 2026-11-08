// ════════════════════════════════════════════════════════════════════════════
//  PAS D'ENVOI, ET PAS DE « REFUS », TANT QUE L'EXTENSION N'EST PAS CONNECTÉE
//  (5.328, 8 nov.)
//
//  Julien, sur sa capture iPhone (« Pas connecté » ET « Dernier envoi refusé à
//  l'instant ») : « il ne doit pas y avoir d'envoi si l'extension n'est pas
//  connectée ». Le VRAI background.js, exécuté dans `_fond-vm.cjs` (tout est
//  inventé : le dépôt est public) :
//   S1  aucune session : une écriture de capture et un envoi de ventes ⇒ 0
//       requête vers Supabase ou vrm.center ;
//   S2  et AUCUN refus noté : ni `koAt`/`refus` dans `vrmFlux`, ni diagnostic
//       `ecriture_ratee_*_sans_session` ; `attenteAt` est posé (la carte dit
//       « en attente ») ;
//   S3  session morte : pareil ;
//   S4  session expirée : UN renouvellement tenté, raté ⇒ aucune écriture, et
//       toujours « en attente », pas « refusé » ;
//   S5  autre sens : connecté, l'écriture part (1 POST) et « en attente » tombe ;
//       un VRAI refus (503) reste un refus, daté ;
//   S6  la connexion par mot de passe relance tout de suite la visite de
//       l'onglet Vinted (une capture fraîche, sans attendre le cycle).
//  `--src chemin` : une autre copie (preuve sur le code d'avant).
//  `--prouve` : rejoue l'audit sur deux mutations (doit virer au rouge).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

async function audit(src, bavard = true) {
  let ko = 0;
  const dit = (ok, nom, det) => { if (!ok) ko++; if (bavard) console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + det}`); };
  const fond = (opts = {}) => {
    const f = faireFond(Object.assign({ src }, opts));
    const f0 = f.ctx.fetch;
    f.reseau = [];
    f.ctx.fetch = async (u, o) => {
      const url = String(u);
      if (/supabase\.co|vrm\.center|vercel\.app/.test(url)) f.reseau.push({ url, methode: String((o && o.method) || 'GET') });
      if (/\/auth\/v1\/token\?grant_type=refresh_token/.test(url)) return { ok: false, status: 503, json: async () => ({}), text: async () => '{}' };
      if (/\/auth\/v1\/token\?grant_type=password/.test(url)) return { ok: true, status: 200, json: async () => ({ access_token: 'jeton.neuf', refresh_token: 'r2', expires_in: 3600, user: { id: 'owner-banc', email: 'banc@vrm.test' } }) };
      return f0(u, o);
    };
    return f;
  };
  const LIGNE = [{ id: 'harvest_111_profile', data: { payload: { id: 111 }, capturedAt: new Date().toISOString() } }];
  const essai = async (f) => {
    const ok = await f.ctx.supabaseUpsert('app_data', LIGNE, 'id');
    await f.ctx.noterFlux('vinted', ok);
    let r2 = null;
    if (typeof f.ctx.appelCommandesServeur === 'function') { r2 = await f.ctx.appelCommandesServeur({ uid: '111', type: 'orders_sold', lot: [] }, 'harvest_orders_sold'); await f.ctx.noterFlux('vinted', !!r2); }
    await new Promise((r) => setTimeout(r, 30));
    const p = (f.store.vrmFlux || {}).vinted || {};
    return { ok, p, ecritures: f.reseau.filter((x) => !/\/auth\/v1\/token/.test(x.url)), renouv: f.reseau.filter((x) => /grant_type=refresh_token/.test(x.url)), diags: f.j.diags.filter((d) => /^ecriture_ratee_.*sans_session/.test(d)) };
  };
  try {
    {
      const r = await essai(fond({ store: { __sansSession: true } }));
      dit(r.ok === false && r.ecritures.length === 0 && r.renouv.length === 0, 'S1 · aucune session : 0 requête vers Supabase ou vrm.center', JSON.stringify(r.ecritures.concat(r.renouv)));
      dit(!r.p.koAt && !(r.p.refus || []).length && r.diags.length === 0, 'S2 · et aucun refus noté (ni koAt, ni historique, ni diagnostic « sans_session »)', JSON.stringify({ p: r.p, diags: r.diags }));
      dit(Number(r.p.attenteAt) > 0, 'S2 · « en attente » est posé (la carte le dit calmement)', JSON.stringify(r.p));
    }
    {
      const r = await essai(fond({ store: { vrmSession: { access_token: 'x', refresh_token: 'r', user_id: 'owner-banc', expires_at: Date.now() - 1000, mort: true } } }));
      dit(r.ecritures.length === 0 && r.renouv.length === 0 && !r.p.koAt && r.diags.length === 0 && Number(r.p.attenteAt) > 0, 'S3 · session morte : rien ne part, rien n’est « refusé », en attente', JSON.stringify({ e: r.ecritures, p: r.p, d: r.diags }));
    }
    {
      const r = await essai(fond({ store: { vrmSession: { access_token: 'x', refresh_token: 'r', user_id: 'owner-banc', expires_at: Date.now() - 1000 } } }));
      dit(r.ecritures.length === 0 && r.renouv.length >= 1 && !r.p.koAt && r.diags.length === 0 && Number(r.p.attenteAt) > 0, 'S4 · session expirée : un renouvellement tenté, raté ⇒ aucune écriture, « en attente » (pas « refusé »)', JSON.stringify({ e: r.ecritures.length, renouv: r.renouv.length, p: r.p, d: r.diags }));
    }
    {
      const f = fond();
      const ok = await f.ctx.supabaseUpsert('app_data', LIGNE, 'id');
      f.store.vrmFlux = { vinted: { attenteAt: Date.now() - 5000 } };
      await f.ctx.noterFlux('vinted', ok);
      const p = (f.store.vrmFlux || {}).vinted || {};
      dit(ok === true && f.reseau.filter((x) => x.methode === 'POST').length === 1 && !p.attenteAt && p.okAt > 0, 'S5 · connecté : l’écriture part (1 POST), « en attente » tombe', JSON.stringify({ ok, p, n: f.reseau.length }));
      const g = fond({ ecritureKO: () => true });
      const ok2 = await g.ctx.supabaseUpsert('app_data', LIGNE, 'id');
      await g.ctx.noterFlux('vinted', ok2);
      const q = (g.store.vrmFlux || {}).vinted || {};
      dit(ok2 === false && q.koAt > 0 && (q.refus || []).length === 1 && !q.attenteAt, 'S5 · un VRAI refus de la base (connecté) reste un refus, daté', JSON.stringify(q));
    }
    {
      const f = fond({ store: { __sansSession: true } });
      const r = await f.envoyer({ from: 'cancale-popup', action: 'authLogin', email: 'banc@vrm.test', password: 'fictif', ouvrir: false }, {});
      await new Promise((res) => setTimeout(res, 60));
      dit(!!(r && r.ok) && f.j.diags.includes('visite_apres_connexion'), 'S6 · connecté par mot de passe : la visite de l’onglet Vinted repart tout de suite', JSON.stringify({ r, diags: f.j.diags }));
    }
  } catch (e) { ko++; if (bavard) console.log('❌ a levé : ' + (e && e.stack || e)); }
  return ko;
}

(async () => {
  const src = cheminSource();
  const ko = await audit(src);
  if (process.argv.includes('--prouve')) {
    const code = fs.readFileSync(src, 'utf8');
    const MUT = [
      ['le refus « sans session » noté comme avant', "  if (statut === 'sans_session') return sessionAbsente();\n", ''],
      ['« en attente » oublié par noterFlux', "    else if (attente) p.attenteAt = Date.now();\n", ''],
    ];
    let attrapees = 0;
    for (const [nom, a, b] of MUT) {
      if (!code.includes(a)) { console.log(`❌ mutation introuvable : ${nom}`); continue; }
      const t = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mut-')), 'background.js');
      fs.writeFileSync(t, code.replace(a, b));
      const k = await audit(t, false);
      console.log(`${k > 0 ? '✅' : '❌'} mutation « ${nom} » : ${k > 0 ? 'attrapée (' + k + ' rouge(s))' : 'PAS attrapée'}`);
      if (k > 0) attrapees++;
    }
    if (attrapees !== MUT.length) { console.log(`\n❌ ${MUT.length - attrapees} mutation(s) non attrapée(s)`); process.exitCode = 1; return; }
  }
  console.log(ko ? `\n❌ audit-sans-session-envoi : ${ko} rouge(s)` : '\n✅ audit-sans-session-envoi : 0 rouge');
  if (ko) process.exitCode = 1;
})();
