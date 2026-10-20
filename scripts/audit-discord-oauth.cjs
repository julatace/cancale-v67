#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « SE CONNECTER AVEC DISCORD » (api/_lib/discord.js, 20 octobre)
//  Exécute la VRAIE route (api/compte.js) avec un faux Discord : le lien ne
//  marche que dans le navigateur qui l'a demandé (nonce en cookie), une fois ;
//  la preuve lie le pseudo au compte VRM qui a demandé ; un ancien pseudo « #1234 »
//  n'est pas inventé ; sans configuration, c'est dit ; seule la portée `identify`.
//  --mutation=sansnonce | sanspreuve  ⇒ doit sortir rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + String(d).slice(0, 200) : '')); };
process.env.DISCORD_CLIENT_ID = '1562176038098702467';
process.env.DISCORD_CLIENT_SECRET = 'secret-de-banc-0123456789abcdef';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
(async () => {
  // Une mutation modifie le CODE de la route (copie temporaire), jamais le test.
  let src = path.join(__dirname, '../api/_lib/discord.js');
  if (MUT) {
    let t = fs.readFileSync(src, 'utf8');
    const avant = t;
    if (MUT === 'sansnonce') t = t.replace("  if (!NONCE_RE.test(String(nonce || ''))) return null;\n  const m = /^", "  const m = /^").replace("return egal(mac('etat', m[2], m[1], nonce), m[3]) ? m[2] : null;", "return m[2];");
    if (MUT === 'sanspreuve') t = t.replace("return egal(mac('preuve', String(owner).toLowerCase(), pseudo, m[1]), m[2]);", 'return true;');
    if (t === avant) { console.log('❌ mutation sans effet (ancre introuvable)'); process.exit(1); }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-discord-')); src = path.join(dir, 'discord.mjs'); fs.writeFileSync(src, t);
  }
  const d = await import(src);
  const res = () => { const r = { statusCode: 200, h: {}, corps: null, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, status(n) { this.statusCode = n; return this; }, json(o) { this.corps = o; return this; }, end() { return this; } }; return r; };
  // 1. Le début : URL Discord, portée identify, cookie nonce HttpOnly.
  const r1 = res(); await d.debutDiscord({}, r1, { id: A });
  const u = new URL(r1.corps.url);
  dit(u.origin === 'https://discord.com' && u.searchParams.get('scope') === 'identify' && u.searchParams.get('redirect_uri') === d.DISCORD_REDIRECT, 'l’adresse part chez Discord, portée « identify » seule, bon retour', r1.corps.url);
  const ck = String(r1.h['set-cookie'] || ''); const nonce = (/vrm_discord_etat=([0-9a-f]{32})/.exec(ck) || [])[1];
  dit(!!nonce && /HttpOnly/.test(ck) && /Secure/.test(ck), 'un nonce aléatoire part en cookie HttpOnly Secure');
  const state = u.searchParams.get('state');
  // Faux Discord.
  const faux = (user, okTok = true) => async (url) => {
    if (/oauth2\/token/.test(url)) return { ok: okTok, json: async () => (okTok ? { access_token: 'tok' } : { error: 'invalid_grant' }) };
    if (/users\/@me/.test(url)) return { ok: true, json: async () => user };
    throw new Error('url ' + url);
  };
  const retour = async (q, cookie, user = { username: 'julien.vrm', discriminator: '0' }) => {
    const r = res(); await d.retourDiscord({ query: q, headers: { cookie: cookie ? 'vrm_discord_etat=' + cookie : '' } }, r, faux(user)); return r;
  };
  const r2 = await retour({ code: 'abcdefghij12', state }, nonce);
  const loc = String(r2.h.location || '');
  const h = new URLSearchParams(loc.split('#')[1] || '');
  dit(r2.statusCode === 302 && h.get('discord') === 'julien.vrm' && !!h.get('preuve'), 'le retour renvoie à l’app avec le pseudo lu chez Discord et une preuve', loc);
  dit(/Max-Age=0/.test(String(r2.h['set-cookie'])), 'le cookie est effacé (le lien ne sert qu’une fois)');
  const r3 = await retour({ code: 'abcdefghij12', state }, '');
  dit(/discord-erreur=lien/.test(r3.h.location), 'ouvert dans un AUTRE navigateur (sans le nonce) : refusé, rien n’est rendu', r3.h.location);
  const autreNonce = 'f'.repeat(32);
  const r4 = await retour({ code: 'abcdefghij12', state }, autreNonce);
  dit(/discord-erreur=lien/.test(r4.h.location), 'un autre nonce : refusé');
  const r5 = await retour({ code: 'abcdefghij12', state: state.replace(A, B) }, nonce);
  dit(/discord-erreur=lien/.test(r5.h.location), 'un state dont on change le compte VRM : refusé (la signature ne tient plus)');
  const r6 = await retour({ code: 'abcdefghij12', state }, nonce, { username: 'vieux', discriminator: '1234' });
  dit(/discord-erreur=ancien/.test(r6.h.location), 'un ancien compte « nom#1234 » : pas de pseudo inventé, c’est dit');
  const r7 = await retour({ error: 'access_denied', state }, nonce);
  dit(/discord-erreur=annule/.test(r7.h.location), 'refusé chez Discord : « annulé », rien n’a changé');
  // 2. La preuve : liée au compte VRM et au pseudo.
  const preuve = h.get('preuve');
  const lire = d.lirePreuve;
  dit(lire(preuve, A, 'julien.vrm') === true, 'la preuve vaut pour le compte qui a demandé et ce pseudo');
  dit(lire(preuve, B, 'julien.vrm') === false, 'un AUTRE compte VRM ne peut pas s’en servir');
  dit(lire(preuve, A, 'autre.pseudo') === false, 'elle ne vaut pas pour un autre pseudo');
  dit(lire(preuve, A, 'julien.vrm', Date.now() + 16 * 60000) === false, 'elle expire (15 min)');
  // 3. Sans configuration.
  delete process.env.DISCORD_CLIENT_SECRET;
  const r8 = res(); await d.debutDiscord({}, r8, { id: A });
  dit(r8.statusCode === 503 && r8.corps.erreur === 'non-configure', 'sans DISCORD_CLIENT_SECRET : « pas encore réglée », aucune adresse');
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
