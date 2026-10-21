#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — « SE CONNECTER AVEC DISCORD » (api/_lib/discord.js, 20 octobre)
//  Exécute la VRAIE route (api/compte.js) avec un faux Discord : le lien ne
//  marche que dans le navigateur qui l'a demandé (nonce en cookie), une fois ;
//  la preuve lie le pseudo au compte VRM qui a demandé ; un ancien pseudo « #1234 »
//  n'est pas inventé ; sans configuration, c'est dit ; seule la portée `identify`.
//  21 oct. : un retour arrivé dans un AUTRE navigateur (téléphone : app Discord →
//  Safari, l'app d'écran d'accueil n'a pas ses cookies) n'est plus refusé : la
//  preuve est rangée pour CE compte, l'app qui connaît le ticket la reprend.
//  --mutation=sanssignature | sanspreuve | sansempreinte  ⇒ doit sortir rouge.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + String(d).slice(0, 200) : '')); };
process.env.DISCORD_CLIENT_ID = '1562176038098702467';
process.env.DISCORD_CLIENT_SECRET = 'secret-de-banc-0123456789abcdef';
process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
process.env.SUPABASE_URL = 'https://base.test';
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
(async () => {
  // Une mutation modifie le CODE de la route (copie temporaire), jamais le test.
  let src = path.join(__dirname, '../api/_lib/discord.js');
  if (MUT) {
    let t = fs.readFileSync(src, 'utf8');
    const avant = t;
    if (MUT === 'sanssignature') t = t.replace("    if (!egal(mac('etat2', n2[2], n2[1], n2[4], n2[3]), n2[5])) return null;\n", '');
    if (MUT === 'sansempreinte') t = t.replace("!egal(String(d.h || ''), empreinte(ticket)) || ", '');
    if (MUT === 'sanspreuve') t = t.replace("return egal(mac('preuve', String(owner).toLowerCase(), pseudo, m[1]), m[2]);", 'return true;');
    if (t === avant) { console.log('❌ mutation sans effet (ancre introuvable)'); process.exit(1); }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-discord-')); src = path.join(dir, 'discord.mjs'); fs.writeFileSync(src, t);
  }
  const d = await import(src);
  const res = () => { const r = { statusCode: 200, h: {}, corps: null, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, status(n) { this.statusCode = n; return this; }, json(o) { this.corps = o; return this; }, end(x) { this.sortie = x; return this; } }; return r; };
  // 1. Le début : URL Discord, portée identify, cookie nonce HttpOnly.
  const r1 = res(); await d.debutDiscord({}, r1, { id: A });
  const u = new URL(r1.corps.url);
  dit(u.origin === 'https://discord.com' && u.searchParams.get('scope') === 'identify' && u.searchParams.get('redirect_uri') === d.DISCORD_REDIRECT, 'l’adresse part chez Discord, portée « identify » seule, bon retour', r1.corps.url);
  const ck = String(r1.h['set-cookie'] || ''); const nonce = (/vrm_discord_etat=([0-9a-f]{32})/.exec(ck) || [])[1];
  dit(!!nonce && /HttpOnly/.test(ck) && /Secure/.test(ck), 'un nonce aléatoire part en cookie HttpOnly Secure');
  const state = u.searchParams.get('state');
  // Faux Discord.
  // Fausse base : la ligne app_data (owner, id) rangée par le serveur.
  const base = new Map();
  const fauxBase = async (url, o = {}) => {
    const u2 = new URL(url); const m = (o.method || 'GET');
    if (m === 'POST') { for (const l of JSON.parse(o.body)) base.set(l.owner + '|' + l.id, l.data); return { ok: true, json: async () => null }; }
    const own = (u2.searchParams.get('owner') || '').slice(3), id = (u2.searchParams.get('id') || '').slice(3);
    if (m === 'DELETE') { base.delete(own + '|' + id); return { ok: true, json: async () => null }; }
    const v = base.get(own + '|' + id); return { ok: true, json: async () => (v ? [{ data: v }] : []) };
  };
  const faux = (user, okTok = true) => async (url, o) => {
    if (/oauth2\/token/.test(url)) return { ok: okTok, json: async () => (okTok ? { access_token: 'tok' } : { error: 'invalid_grant' }) };
    if (/users\/@me/.test(url)) return { ok: true, json: async () => user };
    if (url.startsWith('https://base.test/')) return fauxBase(url, o);
    throw new Error('url ' + url);
  };
  dit(r1.corps.ticket === nonce, 'le ticket rendu à l’app est celui du cookie (elle seule le connaît, hors du navigateur)');
  const retour = async (q, cookie, user = { username: 'julien.vrm', discriminator: '0' }) => {
    const r = res(); await d.retourDiscord({ query: q, headers: { cookie: cookie ? 'vrm_discord_etat=' + cookie : '' } }, r, faux(user)); return r;
  };
  const r2 = await retour({ code: 'abcdefghij12', state }, nonce);
  const loc = String(r2.h.location || '');
  const h = new URLSearchParams(loc.split('#')[1] || '');
  dit(r2.statusCode === 302 && h.get('discord') === 'julien.vrm' && !!h.get('preuve'), 'le retour renvoie à l’app avec le pseudo lu chez Discord et une preuve', loc);
  dit(/Max-Age=0/.test(String(r2.h['set-cookie'])), 'le cookie est effacé (le lien ne sert qu’une fois)');
  // TÉLÉPHONE : le retour arrive dans un AUTRE navigateur (pas de cookie).
  const r3 = await retour({ code: 'abcdefghij12', state }, '');
  const page = String(r3.sortie || '');
  dit(r3.statusCode === 200 && /data-discord-ailleurs="range"/.test(page) && /retourne dans VRM/.test(page), 'autre navigateur : page « retourne dans VRM », la preuve est rangée', r3.statusCode + ' ' + page.slice(0, 120));
  dit(/default-src 'none'/.test(String(r3.h['content-security-policy'] || '')) && !/<script/i.test(page), 'la page n’a aucun script (politique stricte)');
  const reprise = async (qui, ticket) => { const r = res(); await d.attenteDiscord({}, r, { id: qui }, { ticket }, fauxBase); return r; };
  const rB = await reprise(B, nonce);
  dit(rB.corps && rB.corps.pret === false, 'un AUTRE compte VRM avec le bon ticket : rien (la ligne est rangée chez celui qui a demandé)');
  const rX = await reprise(A, 'e'.repeat(32));
  dit(rX.corps && rX.corps.pret === false, 'le bon compte avec un autre ticket : rien');
  const rA = await reprise(A, nonce);
  dit(rA.corps && rA.corps.pret === true && rA.corps.discord === 'julien.vrm' && d.lirePreuve(rA.corps.preuve, A, 'julien.vrm'), 'l’app qui a lancé (son compte + son ticket) reprend le pseudo et une preuve valable', JSON.stringify(rA.corps));
  const rA2 = await reprise(A, nonce);
  dit(rA2.corps && rA2.corps.pret === false, 'une seule fois : reprise, la ligne est effacée');
  const rP = res(); await d.attenteDiscord({}, rP, { id: A }, { ticket: nonce }, async () => ({ ok: false, json: async () => null }));
  dit(rP.statusCode === 503, 'base muette : « pas su » (503), jamais « pas encore »');
  const autreNonce = 'f'.repeat(32);
  const r4 = await retour({ code: 'abcdefghij12', state }, autreNonce);
  dit(r4.statusCode === 200 && /data-discord-ailleurs/.test(String(r4.sortie || '')), 'un autre cookie : traité comme un autre navigateur (rien n’est rendu dans le fragment)');
  const r5 = await retour({ code: 'abcdefghij12', state: state.replace(A, B) }, nonce);
  dit(/discord-erreur=lien/.test(r5.h.location), 'un state dont on change le compte VRM : refusé (la signature ne tient plus)');
  const r6 = await retour({ code: 'abcdefghij12', state }, nonce, { username: 'vieux', discriminator: '1234' });
  dit(/discord-erreur=ancien/.test(r6.h.location), 'un ancien compte « nom#1234 » : pas de pseudo inventé, c’est dit');
  const r7 = await retour({ error: 'access_denied', state }, nonce);
  dit(/discord-erreur=annule/.test(r7.h.location), 'refusé chez Discord : « annulé », rien n’a changé');
  // 1 bis. Lancé depuis Paramètres → Mon compte : le retour y revient (20 oct.).
  const rc = res(); await d.debutDiscord({}, rc, { id: A }, { ou: 'compte' });
  const uc = new URL(rc.corps.url); const stc = uc.searchParams.get('state');
  const noncec = (/vrm_discord_etat=([0-9a-f]{32})/.exec(String(rc.h['set-cookie'] || '')) || [])[1];
  const rc2 = await retour({ code: 'abcdefghij12', state: stc }, noncec);
  dit(/^\/\?tab=settings&vue=compte#discord=julien\.vrm&preuve=[^&]+&ou=compte$/.test(String(rc2.h.location)), 'lancé depuis Mon compte : le retour revient à Paramètres → Mon compte', rc2.h.location);
  const rc3 = await retour({ code: 'abcdefghij12', state: String(stc).replace('.c.', '.') }, noncec);
  dit(/discord-erreur=lien/.test(String(rc3.h.location)), 'la destination fait partie de la signature (la retirer : refusé)', rc3.h.location);
  dit(/^\/\?tab=communaute#/.test(loc), 'sans destination : le retour revient à la carte, comme avant');
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
