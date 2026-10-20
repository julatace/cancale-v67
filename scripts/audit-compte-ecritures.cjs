// ════════════════════════════════════════════════════════════════════════════
//  « LES JETONS D'UN COMPTE S'ÉCRIVENT QUAND ILS CHANGENT » (20 octobre, 5.197)
//
//  MESURÉ EN PRODUCTION (journaux de la passerelle, 20 octobre) : 687 écritures
//  `POST /rest/v1/vinted_accounts` en 73 minutes, jusqu'à 90 PAR MINUTE, depuis
//  le Chrome de Julien. Cause : chaque requête de la page Vinted qui porte un
//  `x-csrf-token` envoie un message `csrf` au fond, qui rappelle
//  `captureDomain` — la ligne ENTIÈRE réécrite, jetons identiques.
//
//  On EXÉCUTE le vrai `background.js` (`_fond-vm.cjs`) et on COMPTE les
//  écritures de `vinted_accounts` : 20 messages `csrf` identiques ⇒ 1 écriture ;
//  un jeton qui change ⇒ une écriture de plus ; une écriture refusée par la base
//  n'est pas mémorisée (la suivante repart) ; un compte refusé puis réautorisé
//  repart tout de suite. Aucune donnée réelle (jetons inventés).
//  `--src chemin` : le même audit sur une autre copie (§6.1).
// ════════════════════════════════════════════════════════════════════════════
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const vm = require('vm');
const poserCsrf = (ctx, v) => vm.runInContext(`lastCsrfByDomain['www.vinted.fr'] = ${JSON.stringify(v)}`, ctx);

let ko = 0, ok = 0;
const dit = (bon, quoi, det) => { if (bon) { ok++; console.log(`✅ ${quoi}${det ? ' — ' + det : ''}`); } else { ko++; console.log(`❌ ${quoi}${det ? ' — ' + det : ''}`); } };
const essaie = async (quoi, fn) => { try { return await fn(); } catch (e) { ko++; console.log(`❌ ${quoi} — a levé : ${e && e.message}`); return null; } };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (acc, n) => `${b64({ alg: 'none' })}.${b64({ account_id: acc, n })}.sig`;

function monter({ refuseEcriture = () => false } = {}) {
  const f = faireFond({ src: cheminSource() });
  const { ctx } = f;
  const cookies = { access_token_web: jwt(4242, 1), refresh_token_web: 'r1', anon_id: 'a1' };
  ctx.getCookie = async (_d, nom) => cookies[nom] || null;
  ctx.blockedAccounts = async () => new Set();
  ctx.unblockedAccounts = async () => new Set();
  ctx.compteRefuse = async () => false;
  const ecrits = [];
  const fetch0 = ctx.fetch;
  ctx.fetch = async (url, opts = {}) => {
    if (/\/rest\/v1\/vinted_accounts/.test(String(url)) && (opts.method || 'GET') === 'POST') {
      ecrits.push(JSON.parse(opts.body || '[]'));
      if (refuseEcriture(ecrits.length)) return { ok: false, status: 503, headers: { get: () => 'text/html' }, json: async () => ({}), text: async () => '<html>503</html>' };
      return { ok: true, status: 201, headers: { get: () => 'application/json' }, json: async () => [], text: async () => '' };
    }
    return fetch0(url, opts);
  };
  return Object.assign(f, { cookies, ecrits });
}

(async () => {
  await essaie('20 messages « csrf » identiques ⇒ une seule écriture', async () => {
    const f = monter();
    for (let i = 0; i < 20; i++) { poserCsrf(f.ctx, 'csrf-1'); await f.ctx.captureDomain('www.vinted.fr'); }
    dit(f.ecrits.length === 1, 'la ligne du compte n\'est écrite qu\'UNE fois quand rien n\'a changé', f.ecrits.length + ' écriture(s)');
    dit(f.ecrits[0] && f.ecrits[0][0] && f.ecrits[0][0].vinted_user_id === '4242', 'et c\'est bien la ligne du compte du cookie');
    // L'autre sens : un jeton renouvelé par Vinted part tout de suite.
    f.cookies.access_token_web = jwt(4242, 2);
    await f.ctx.captureDomain('www.vinted.fr');
    dit(f.ecrits.length === 2, 'un jeton qui CHANGE est écrit tout de suite', f.ecrits.length + ' écriture(s)');
    poserCsrf(f.ctx, 'csrf-2');
    await f.ctx.captureDomain('www.vinted.fr');
    dit(f.ecrits.length === 3, 'un nouveau csrf aussi (l\'app en a besoin pour agir)', f.ecrits.length + ' écriture(s)');
    const brut = JSON.stringify(f.store.vrmCompteEcrit || {});
    dit(brut.length > 2 && !/r1|csrf-|eyJ/.test(brut), 'aucun jeton en clair dans le mémo de l\'extension', brut.slice(0, 80));
  });

  await essaie('une écriture refusée par la base n\'est pas mémorisée', async () => {
    const f = monter({ refuseEcriture: (n) => n === 1 });
    await f.ctx.captureDomain('www.vinted.fr');
    await f.ctx.captureDomain('www.vinted.fr');
    dit(f.ecrits.length === 2, 'après un refus, la requête suivante réécrit (rien n\'est perdu)', f.ecrits.length + ' écriture(s)');
  });

  await essaie('au-delà de 30 min, la ligne est réécrite même inchangée', async () => {
    const f = monter();
    await f.ctx.captureDomain('www.vinted.fr');
    const m = f.store.vrmCompteEcrit || {}; if (!m['4242']) { dit(false, 'aucun mémo d\'écriture posé'); return; } m['4242'].at -= 31 * 60 * 1000;
    await f.ctx.captureDomain('www.vinted.fr');
    dit(f.ecrits.length === 2, 'une réécriture au plus toutes les 30 min', f.ecrits.length + ' écriture(s)');
  });

  await essaie('un compte refusé puis réautorisé repart sans attendre', async () => {
    const f = monter();
    await f.ctx.captureDomain('www.vinted.fr');
    await f.ctx.noterRefus('4242', 'www.vinted.fr', 'refuse');
    await f.ctx.oublierRefus('4242');
    await f.ctx.captureDomain('www.vinted.fr');
    dit(f.ecrits.length === 2, 'la réautorisation réécrit la ligne tout de suite', f.ecrits.length + ' écriture(s)');
  });

  console.log(`\n${ko ? '❌ ' + ko + ' rouge(s)' : '✅ tout vert'} · ${ok} contrôle(s)`);
  process.exit(ko ? 1 : 0);
})();
