// ⚠️⚠️ « FERMER MON COMPTE » EST DEVENU « SUPPRIMER MON COMPTE » (9 novembre, RGPD)
// `?mode=fermer` mène à la MÊME fonction que `?mode=supprimer`, avec la même
// confirmation forte (« SUPPRIMER » + mot de passe ou connexion récente) : la
// confirmation par l'adresse e-mail recopiée n'existe plus. Le contrôle exécuté
// vit dans scripts/audit-supprimer-compte.cjs ; ce nom est gardé pour qui le
// lance encore, et prouve en plus que l'ancien chemin ne contourne rien.
const path = require('path'), cp = require('child_process');
const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'audit-supprimer-compte.cjs'), ...process.argv.slice(2)], { stdio: 'inherit' });
if (r.status) process.exit(r.status);

require(path.join(__dirname, '_horloge-notif.cjs'));
const F = require('./_faux-compte-rgpd.cjs');
global.fetch = F.faux;
(async () => {
  process.env.SUPABASE_SERVICE_KEY = F.SERVICE;
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
  const compte = (await import('file://' + path.join(__dirname, '..', 'api', 'compte.js'))).default;
  const res = () => { const o = { code: 0, corps: null }; o.status = (n) => { o.code = n; return o; }; o.json = (x) => { o.corps = x; return o; }; o.setHeader = () => {}; o.end = () => o; return o; };
  const appel = async (corps) => { const b = Buffer.from(JSON.stringify(corps)); const q = { method: 'POST', query: { mode: 'fermer' }, headers: { authorization: 'Bearer ' + F.session(F.A) }, async *[Symbol.asyncIterator]() { yield b; } }; const r = res(); await compte(q, r); return r; };
  F.reset();
  const r1 = await appel({ confirmation: F.EMAIL[F.A] });
  const ok1 = r1.code === 400 && F.etat.deletes.length === 0 && F.etat.base.utilisateurs.has(F.A);
  console.log(`${ok1 ? '✅' : '❌'} l'ancien \`?mode=fermer\` avec l'ancienne confirmation (l'e-mail) : refusé, rien touché — HTTP ${r1.code}`);
  F.reset();
  const r2 = await appel({ confirmation: 'SUPPRIMER', motDePasse: F.MDP[F.A] });
  const ok2 = r2.code === 200 && !F.etat.base.utilisateurs.has(F.A) && F.etat.base.utilisateurs.has(F.B);
  console.log(`${ok2 ? '✅' : '❌'} … avec la confirmation forte : la même suppression — HTTP ${r2.code}`);
  process.exit(ok1 && ok2 ? 0 : 1);
})();
