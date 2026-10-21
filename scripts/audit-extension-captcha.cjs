// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « EXTENSION ET CAPTCHA » (21 octobre, 5.202)
//
//  Le jour où Julien allume Turnstile dans Supabase (Attack Protection), GoTrue
//  refuse `POST /auth/v1/token?grant_type=password` sans jeton captcha — 400,
//  `error_code: captcha_failed`, « captcha protection: request disallowed ».
//  Une page d'extension MV3 ne peut pas charger le script distant de Turnstile :
//  la connexion par mot de passe de la fenêtre de l'extension est fermée pour de
//  bon. Ce qui doit rester vrai :
//    1. le VRAI `authLogin` (background.js, dans un `vm`) traduit ce refus en
//       français, avec le geste qui marche (« Se connecter avec VRM »), le
//       marque `captcha: true`, et ne range AUCUNE session ;
//    2. l'autre sens : un mauvais mot de passe reste « incorrect » ;
//    3. les chemins qui gardent l'extension connectée ne passent pas par une
//       route protégée par le captcha (lu dans le code de GoTrue,
//       `internal/api/api.go`) : le renouvellement (`grant_type=refresh_token`)
//       et la session fabriquée par le serveur (`admin/generate_link` avec la
//       clé de service, puis `verify`).
//  `--src chemin` : un autre background.js (preuve sur le code d'AVANT, §6.1).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => {
  if (bon) { ok++; console.log(`  ✅ ${quoi}`); }
  else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + detail : ''}`); }
};
const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${e && e.message}`); } };

async function connexion(reponseGoTrue) {
  const f = faireFond({ src: cheminSource() });
  const appels = [];
  f.ctx.fetch = async (url, opts) => {
    const u = String(url);
    appels.push(u);
    const r = /\/auth\/v1\/token\?grant_type=password/.test(u) ? reponseGoTrue : { status: 404, body: {} };
    const texte = JSON.stringify(r.body);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: () => 'application/json' },
      json: async () => JSON.parse(texte), text: async () => texte };
  };
  const rep = await f.envoyer({ from: 'cancale-popup', action: 'authLogin', email: 'sophie@exemple.fr', password: 'motdepasse-vrm' }, { id: 'x' });
  return { rep, store: f.store, appels };
}

(async () => {
  console.log('\n── 1. GoTrue refuse pour captcha');
  await essaie('captcha', async () => {
    const { rep, store } = await connexion({ status: 400, body: { code: 400, error_code: 'captcha_failed', msg: 'captcha protection: request disallowed (no captcha response (captcha_token) found in request)' } });
    dit(rep && rep.ok === false, 'la connexion est refusée', JSON.stringify(rep));
    dit(rep && rep.captcha === true, 'et le refus est marqué « captcha » (la fenêtre propose le bon geste)', JSON.stringify(rep));
    const msg = String((rep && rep.error) || '');
    dit(/plus possible depuis l.extension/i.test(msg) && /Se connecter avec VRM/.test(msg), 'la phrase est en français et nomme « Se connecter avec VRM »', msg);
    dit(!/captcha protection|request disallowed/i.test(msg), 'et ce n’est pas le message brut de GoTrue', msg);
    dit(!store.vrmSession, 'aucune session n’est rangée', JSON.stringify(store.vrmSession || null));
  });
  await essaie('captcha seulement dans le message', async () => {
    const { rep } = await connexion({ status: 400, body: { error: 'invalid_request', error_description: 'captcha protection: request disallowed (captcha verification process failed)' } });
    dit(rep && rep.captcha === true, 'reconnu aussi quand seul le message parle du captcha', JSON.stringify(rep));
  });

  console.log('\n── 2. L’autre sens');
  await essaie('mauvais mot de passe', async () => {
    const { rep } = await connexion({ status: 400, body: { error: 'invalid_grant', error_description: 'Invalid login credentials' } });
    dit(rep && rep.ok === false && !rep.captcha && /incorrect/i.test(rep.error || ''), 'un mauvais mot de passe reste « Email ou mot de passe incorrect »', JSON.stringify(rep));
  });
  await essaie('connexion qui marche', async () => {
    const { rep, store } = await connexion({ status: 200, body: { access_token: 'a.b.c', refresh_token: 'r', expires_in: 3600, user: { id: 'u1', email: 'sophie@exemple.fr' } } });
    dit(rep && rep.ok === true && store.vrmSession, 'captcha éteint : la connexion par mot de passe marche comme avant', JSON.stringify(rep));
  });

  console.log('\n── 3. Ce qui garde l’extension connectée ne passe pas par le captcha');
  const bg = fs.readFileSync(cheminSource(), 'utf8');
  const routesBg = [...bg.matchAll(/\/auth\/v1\/([a-z_\/]+)(\?grant_type=([a-z_]+))?/g)].map((m) => m[1] + (m[3] ? '?' + m[3] : ''));
  dit(routesBg.includes('token?refresh_token'), 'le renouvellement passe par grant_type=refresh_token (exempté par GoTrue)', JSON.stringify(routesBg));
  const compte = fs.readFileSync(path.join(__dirname, '..', 'api', 'compte.js'), 'utf8');
  dit(/appelAuth\('admin\/generate_link',\s*sbCle\(SERVICE\)/.test(compte), 'la session de l’extension est fabriquée par admin/generate_link avec la clé de service (exemptée)');
  dit(/appelAuth\('verify',/.test(compte) && !/appelAuth\('(magiclink|otp|signup|recover|token\?grant_type=password)'/.test(compte), 'puis échangée par verify — aucune route protégée (signup, token mot de passe, otp, magiclink, recover)');

  console.log(`\n${ko ? '❌' : '✅'} extension-captcha : ${ok} verts, ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})();
