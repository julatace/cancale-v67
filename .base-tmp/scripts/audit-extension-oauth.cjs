// ════════════════════════════════════════════════════════════════════════════
//  « CONTINUER AVEC GOOGLE / DISCORD » DANS L'EXTENSION (8 nov., 5.325)
//  + LES REFUS D'ENVOI DATÉS (carte du logo, même version)
//
//  Julien : « une personne qui a créé son compte avec Google ou Discord et qui
//  veut se connecter à l'extension, il ne va pas pouvoir ». Le VRAI
//  background.js, exécuté dans `_fond-vm.cjs` (réponses FABRIQUÉES, dépôt public) :
//   F1  les fournisseurs se lisent dans `/auth/v1/settings` (clé publique) :
//       `true` lu ⇒ proposé, `false` ⇒ non ; lu au plus une fois par 10 min.
//   F2  « pas su » (5xx, réseau, forme inattendue) ⇒ `ok:false` : aucun bouton.
//   F3  le clic ouvre VRM avec `lier-extension=<id>&connexion=<fournisseur>` ;
//       un autre nom, ou un message qui ne vient pas de la fenêtre ⇒ sans `connexion`.
//       Jamais un jeton dans l'adresse.
//   F4  la demande de liaison est notée (`demandeAt`) comme « Se connecter avec VRM ».
//   R1  un envoi refusé garde son code, sa famille et la taille du corps ;
//       les 5 derniers refus, datés, dans `vrmFlux.<plateforme>.refus`.
//   R2  un succès n'efface pas l'historique (il dit ce qui s'est passé).
//   C1  l'app : `lieroauth` dans `EXT_CAPACITES`, et `fournisseursConnexion` existe.
//  `--src chemin` : une autre copie de background.js (preuve sur le code d'avant).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();
const APP = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + det}`); };
const ID = 'abcdefghijklmnopabcdefghijklmnop';

// Le fond, avec un faux `/auth/v1/settings` et des onglets qui NOTENT l'adresse ouverte.
function fond(settings, opts = {}) {
  const f = faireFond(Object.assign({ src: SRC }, opts));
  const f0 = f.ctx.fetch;
  f.lectures = 0;
  f.ctx.fetch = async (u, o) => {
    if (/\/auth\/v1\/settings$/.test(String(u))) {
      f.lectures++;
      f.cleUtilisee = o && o.headers && o.headers.apikey;
      const r = typeof settings === 'function' ? settings() : settings;
      if (r === 'reseau') throw new TypeError('Failed to fetch');
      return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body, text: async () => JSON.stringify(r.body) };
    }
    if (opts.reseauEcriture && /\/rest\/v1\//.test(String(u)) && (o && o.method) === 'POST') throw new TypeError('Load failed');
    return f0(u, o);
  };
  f.ouverts = [];
  f.ctx.chrome.runtime.id = ID;
  f.ctx.chrome.tabs.query = (q, cb) => { if (typeof cb === 'function') { cb([]); return; } return Promise.resolve([]); };
  f.ctx.chrome.tabs.create = (o, cb) => { f.ouverts.push(o.url); if (typeof cb === 'function') cb({}); return Promise.resolve({}); };
  f.ctx.chrome.tabs.update = (id, o, cb) => { f.ouverts.push(o.url); if (typeof cb === 'function') cb({}); return Promise.resolve({}); };
  return f;
}
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try {
    // ── F1 / F2 : ce que Supabase dit ─────────────────────────────────────
    {
      const f = fond({ status: 200, body: { external: { google: true, discord: false, email: true } } });
      if (typeof f.ctx.fournisseursConnexion !== 'function') { dit(false, 'F0 · `fournisseursConnexion` existe dans le fond'); throw new Error('absent'); }
      const r = await f.envoyer({ from: 'cancale-popup', action: 'fournisseursConnexion' }, {});
      dit(r && r.ok === true && r.google === true && r.discord === false, 'F1 · Google activé, Discord non : la fenêtre reçoit exactement ça', JSON.stringify(r));
      dit(f.cleUtilisee && f.cleUtilisee.length > 20 && /^eyJ/.test(f.cleUtilisee), 'F1 · lu avec la clé PUBLIQUE de l’extension (apikey)', String(f.cleUtilisee).slice(0, 12));
      await f.envoyer({ from: 'cancale-popup', action: 'fournisseursConnexion' }, {});
      dit(f.lectures === 1, 'F1 · une seconde ouverture de la fenêtre dans les 10 min ne relit pas', `${f.lectures} lectures`);
      const g = fond({ status: 200, body: { external: { google: true, discord: true } } }, { store: { vrmFournisseurs: { google: false, discord: false, at: Date.now() - 11 * 60000 } } });
      const rg = await g.envoyer({ from: 'cancale-popup', action: 'fournisseursConnexion' }, {});
      dit(rg && rg.google === true && rg.discord === true && g.lectures === 1, 'F1 · au-delà de 10 min, on relit (un fournisseur activé entre-temps apparaît)', JSON.stringify(rg));
    }
    for (const [nom, rep] of [['503', { status: 503, body: {} }], ['réseau', 'reseau'], ['forme inattendue (texte)', { status: 200, body: { external: { google: 'oui' } } }], ['sans `external`', { status: 200, body: { autre: 1 } }]]) {
      const f = fond(rep);
      const r = await f.envoyer({ from: 'cancale-popup', action: 'fournisseursConnexion' }, {});
      dit(r && r.ok === false && !r.google && !r.discord, `F2 · « pas su » (${nom}) ⇒ ok:false, aucun fournisseur promis`, JSON.stringify(r));
      dit(!(f.store.vrmFournisseurs), `F2 · « pas su » (${nom}) n’est pas mémorisé comme une réponse`, JSON.stringify(f.store.vrmFournisseurs));
    }

    // ── F3 / F4 : le clic ouvre VRM, avec le fournisseur, sans jeton ───────
    for (const fourn of ['google', 'discord']) {
      const f = fond({ status: 200, body: { external: {} } });
      const r = await f.envoyer({ from: 'cancale-popup', action: 'lierAvecVRM', urlActive: 'https://www.vinted.fr/items/1', connexion: fourn }, {});
      await attendre(20);
      const u = f.ouverts[0] || '';
      dit(r && r.ok && u === `https://vrm.center/?tab=plat_vinted&lier-extension=${ID}&connexion=${fourn}`, `F3 · « Continuer avec ${fourn} » ouvre VRM avec lier-extension ET connexion=${fourn}`, u);
      dit(!/token|session|code=/.test(u), 'F3 · aucun jeton dans l’adresse', u);
      const l = f.store.vrmLiaison || f.store.vrmLier || Object.values(f.store).find((v) => v && typeof v === 'object' && 'demandeAt' in v);
      dit(!!(l && l.demandeAt), 'F4 · la demande de liaison est notée (comme « Se connecter avec VRM »)', JSON.stringify(Object.keys(f.store)));
    }
    {
      const f = fond({ status: 200, body: {} });
      await f.envoyer({ from: 'cancale-popup', action: 'lierAvecVRM', urlActive: '', connexion: 'facebook' }, {});
      await f.envoyer({ from: 'cancale-popup', action: 'lierAvecVRM', urlActive: '', connexion: 'google&x=1' }, {});
      await f.envoyer({ from: 'vrm-badge', action: 'lierAvecVRM', connexion: 'google' }, { tab: { url: 'https://www.vinted.fr/' } });
      await f.envoyer({ from: 'cancale-popup', action: 'lierAvecVRM', urlActive: '' }, {});
      await attendre(20);
      dit(f.ouverts.length === 4 && f.ouverts.every((u) => !/connexion=/.test(u) && u.includes('lier-extension=' + ID)), 'F3 · un autre nom, un texte piégé, la carte du logo, ou rien : VRM s’ouvre SANS `connexion`', JSON.stringify(f.ouverts));
    }

    // ── R1 / R2 : les refus datés ─────────────────────────────────────────
    {
      const f = fond({ status: 200, body: {} }, { ecritureKO: (id) => /orders_sold/.test(id) });
      const gros = { my_orders: Array.from({ length: 300 }, (_, i) => ({ transaction_id: i, title: 'x'.repeat(200) })) };
      for (let i = 0; i < 7; i++) {
        const ok = await f.ctx.supabaseUpsert('app_data', [{ id: 'harvest_111_orders_sold', data: { payload: gros } }], 'id');
        await f.ctx.noterFlux('vinted', ok);
      }
      const p = (f.store.vrmFlux || {}).vinted || {};
      const h = Array.isArray(p.refus) ? p.refus : [];
      dit(p.koStatut === '503' && h.length === 5, 'R1 · sept refus 503 : le code est gardé, et les 5 DERNIERS seulement', JSON.stringify({ ko: p.koStatut, n: h.length }));
      dit(h.every((r) => r.statut === '503' && r.famille === 'harvest_orders_sold' && r.octets > 60000 && Number(r.at) > 0), 'R1 · chacun daté, avec sa famille (sans identifiant) et la taille de l’envoi', JSON.stringify(h[0]));
      dit(!/harvest_111|"111"/.test(JSON.stringify(h)), 'R1 · aucun identifiant de compte dans l’historique', JSON.stringify(h[0]));
      await f.ctx.noterFlux('vinted', true);
      const p2 = (f.store.vrmFlux || {}).vinted || {};
      dit(Array.isArray(p2.refus) && p2.refus.length === 5 && p2.okAt >= p2.koAt, 'R2 · un envoi réussi ensuite n’efface pas l’historique', JSON.stringify({ n: p2.refus && p2.refus.length }));
    }
    {
      const f = fond({ status: 200, body: {} }, { reseauEcriture: true });
      const ok = await f.ctx.supabaseUpsert('app_data', [{ id: 'harvest_111_listings', data: { payload: { items: [] } } }], 'id');
      await f.ctx.noterFlux('vinted', ok);
      const h = (((f.store.vrmFlux || {}).vinted || {}).refus) || [];
      dit(ok === false && h.length === 1 && h[0].statut === 'reseau' && h[0].famille === 'harvest_listings', 'R1 · un envoi coupé par le navigateur est noté « reseau » (et pas « la base n’a pas répondu »)', JSON.stringify(h));
    }

    // ── O1–O6 : 5.328, l'OAuth DANS l'extension (sans VRM) ─────────────────
    {
      const BON = { status: 200, body: { external: { google: true, discord: false } } };
      const avecToken = (f, rep) => { const f1 = f.ctx.fetch; f.tokens = []; f.ctx.fetch = async (u, o) => { if (/\/auth\/v1\/token\?grant_type=pkce/.test(String(u))) { f.tokens.push(JSON.parse(o.body)); return { ok: rep.status === 200, status: rep.status, json: async () => rep.body }; } return f1(u, o); }; };
      const f = fond(BON, { store: { __sansSession: true } });
      if (typeof f.ctx.oauthDepart !== 'function') { dit(false, 'O0 · `oauthDepart` existe dans le fond'); throw new Error('absent'); }
      const r = await f.envoyer({ from: 'cancale-popup', action: 'oauthDepart', fournisseur: 'google' }, { tab: { id: 7, url: 'https://www.vinted.fr/' } });
      const u = f.ouverts[0] ? new URL(f.ouverts[0]) : null;
      const d = f.store.vrmOAuthDepart || {};
      dit(!!(r && r.ok) && !!u && u.origin === 'https://lgonxzrzjcqthjtbdpzo.supabase.co' && u.pathname === '/auth/v1/authorize' && u.searchParams.get('provider') === 'google' && u.searchParams.get('redirect_to') === 'https://vrm.center/extension-retour.html' && u.searchParams.get('code_challenge_method') === 's256' && (u.searchParams.get('code_challenge') || '').length >= 43, 'O1 · « Continuer avec Google » : un onglet Supabase en PKCE s256, retour sur la page de l’extension — jamais l’app', String(f.ouverts[0]));
      dit(typeof d.v === 'string' && d.v.length >= 43 && !String(f.ouverts[0]).includes(d.v), 'O1 · le vérificateur reste dans l’extension (jamais dans l’adresse)', '');
      const ferme = await f.envoyer({ from: 'cancale-popup', action: 'oauthDepart', fournisseur: 'discord' }, {});
      dit(ferme && ferme.ok === false && /pas ouverte sur VRM/.test(ferme.message || '') && f.ouverts.length === 1, 'O2 · Discord pas activé : rien ne s’ouvre, la raison est DITE', JSON.stringify(ferme));
      const inc = await f.envoyer({ from: 'cancale-popup', action: 'oauthDepart', fournisseur: 'facebook' }, {});
      dit(inc && inc.ok === false && f.ouverts.length === 1, 'O2 · un autre nom : rien', JSON.stringify(inc));
      avecToken(f, { status: 200, body: { access_token: 'a.oauth', refresh_token: 'r.oauth', expires_in: 3600, user: { id: 'u-1', email: 'vendeuse@exemple.test', created_at: '2020-01-01T00:00:00Z', identities: [{ provider: 'google' }, { provider: 'email' }] } } });
      const faux = await f.envoyer({ from: 'vrm-oauth-retour', action: 'oauthRetour', fixe: true, code: 'abcdefgh123' }, { tab: { id: 9, url: 'https://evil.example/extension-retour.html' } });
      dit(faux && faux.ok === false && faux.code === 'origine' && f.tokens.length === 0, 'O3 · un code venu d’ailleurs que vrm.center : refusé, aucun échange', JSON.stringify(faux));
      const bon = await f.envoyer({ from: 'vrm-oauth-retour', action: 'oauthRetour', fixe: true, code: 'abcdefgh123' }, { tab: { id: 9, url: 'https://vrm.center/extension-retour.html?code=abcdefgh123' } });
      dit(bon && bon.ok === true && f.tokens.length === 1 && f.tokens[0].code_verifier === d.v && f.tokens[0].auth_code === 'abcdefgh123', 'O4 · le code est échangé avec NOTRE vérificateur (grant_type=pkce)', JSON.stringify({ bon, t: f.tokens }));
      const s = f.store.vrmSession || {};
      dit(s.access_token === 'a.oauth' && s.user_id === 'u-1' && Number(s.depuis) > 0 && (f.store.vrmOAuthEtat || {}).etat === 'ok', 'O4 · la session est rangée DANS l’extension, datée (`depuis`)', JSON.stringify({ u: s.user_id, e: f.store.vrmOAuthEtat }));
      const deux = await f.envoyer({ from: 'vrm-oauth-retour', action: 'oauthRetour', fixe: true, code: 'abcdefgh123' }, { tab: { id: 9, url: 'https://vrm.center/extension-retour.html' } });
      dit(deux && deux.ok === false && f.tokens.length === 1, 'O5 · une seule fois : le même retour rejoué n’échange rien', JSON.stringify(deux));
      // Plus de 10 minutes : refusé.
      const g = fond(BON, { store: { __sansSession: true, vrmOAuthDepart: { f: 'google', v: 'x'.repeat(64), at: Date.now() - 11 * 60000 } } });
      avecToken(g, { status: 200, body: {} });
      const vieux = await g.envoyer({ from: 'vrm-oauth-retour', action: 'oauthRetour', fixe: true, code: 'abcdefgh123' }, { tab: { id: 9, url: 'https://vrm.center/extension-retour.html' } });
      dit(vieux && vieux.ok === false && g.tokens.length === 0 && /plus de 10 minutes/.test(vieux.message || ''), 'O5 · un départ de plus de 10 min : refusé, et dit', JSON.stringify(vieux));
      // Refus du fournisseur : dit, jamais muet.
      const h = fond(BON, { store: { __sansSession: true, vrmOAuthDepart: { f: 'google', v: 'x'.repeat(64), at: Date.now() } } });
      const ann = await h.envoyer({ from: 'vrm-oauth-retour', action: 'oauthRetour', fixe: true, error: 'access_denied' }, { tab: { id: 9, url: 'https://vrm.center/extension-retour.html' } });
      dit(ann && ann.ok === false && /annulée/.test(ann.message || '') && (h.store.vrmOAuthEtat || {}).etat === 'erreur', 'O6 · annulé chez Google : « annulée », noté pour la fenêtre', JSON.stringify(ann));
    }

    // ── C1 : l'app ────────────────────────────────────────────────────────
    const caps = /const EXT_CAPACITES\s*=\s*\{([^}]*)\}/.exec(APP);
    const man = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vinted-sync-extension', 'manifest.json'), 'utf8'));
    dit(!!caps && /lieroauth\s*:\s*'([0-9.]+)'/.test(caps[1]), 'C1 · `lieroauth` est dans EXT_CAPACITES', '');
    const bg = fs.readFileSync(SRC, 'utf8');
    dit(/function\s+fournisseursConnexion\b/.test(bg) && /CODE_VERSION\s*=\s*'([^']+)'/.exec(bg)[1] === man.version, 'C1 · la fonction est dans le fond, et le code suit le manifeste', man.version);
  } catch (e) { if (e && e.message !== 'absent') { ko++; console.log('❌ l’audit est tombé :', e && e.stack); } }
  console.log(`\n${ko ? '❌' : '✅'} audit-extension-oauth : ${ko} rouge${ko > 1 ? 's' : ''}`);
  process.exit(ko ? 1 : 0);
})();
