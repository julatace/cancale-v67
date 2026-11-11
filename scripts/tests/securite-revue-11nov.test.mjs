// scripts/tests/securite-revue-11nov.test.mjs — revue de sécurité adverse du 11 nov.
// Chaque défaut corrigé est REJOUÉ sur la vraie route (fausse base, faux réseau),
// rouge sur origin/main (git archive + ce fichier copié dedans), vert après.
//   node --test scripts/tests/securite-revue-11nov.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const A = '11111111-1111-4111-8111-111111111111';
const JWT = (o) => 'e30.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.sig';
const SESSION_A = JWT({ sub: A });

function reponse() {
  const r = { statusCode: 200, corps: undefined, entetes: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (j) => { r.corps = j; return r; };
  r.send = (j) => { r.corps = j; return r; };
  r.end = () => r;
  r.setHeader = (k, v) => { r.entetes[k.toLowerCase()] = v; };
  return r;
}
// Faux réseau : la session A est reconnue ; `rest(u, opts)` sert la base ; le reste est noté.
function fauxReseau({ rest = () => new Response('[]', { status: 200 }), autre = () => new Response('{}', { status: 200 }) } = {}) {
  const appels = [];
  const avant = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    appels.push({ url: u, opts });
    if (u.includes('/auth/v1/user')) {
      const h = opts.headers || {};
      return (h.Authorization || h.authorization) === `Bearer ${SESSION_A}`
        ? new Response(JSON.stringify({ id: A, email: 'a@exemple.fr', email_confirmed_at: '2026-01-01' }), { status: 200 })
        : new Response('{}', { status: 401 });
    }
    if (u.includes('/rpc/vrm_acces_pour')) return new Response('true', { status: 200 });
    if (u.includes('.supabase.co/rest/v1/')) return rest(u, opts);
    return autre(u, opts);
  };
  return { appels, rendre: () => { globalThis.fetch = avant; } };
}
process.env.SUPABASE_SERVICE_KEY = 'cle-service-fictive';

test('/api/vinted-refresh : la colonne `domain` (écrite par le vendeur) ne choisit jamais l’hôte appelé', async () => {
  const { default: refresh } = await import('../../api/vinted-refresh.js');
  const expire = JWT({ exp: Math.floor(Date.now() / 1000) - 60 });
  const comptes = ['www.attaquant.example/x?', 'www.127.0.0.1.nip.io', 'www.vinted.fr.attaquant.example', 'www.vinted.it']
    .map((domain, i) => ({ owner: A, vinted_user_id: String(100 + i), domain, access_token: expire, refresh_token: 'r' }));
  const net = fauxReseau({ rest: (u, o) => new Response((o.method || 'GET') === 'GET' ? JSON.stringify(comptes) : '', { status: (o.method || 'GET') === 'GET' ? 200 : 204 }) });
  try {
    const r = reponse();
    await refresh({ method: 'GET', query: {}, headers: { authorization: `Bearer ${SESSION_A}` } }, r);
    const sortants = net.appels.filter((x) => !x.url.includes('.supabase.co/'));
    assert.equal(sortants.length, 4, 'un renouvellement par compte');
    for (const x of sortants) {
      const h = new URL(x.url).hostname;
      assert.match(h, /^www\.vinted\.(fr|it)$/, `hôte appelé : ${h}`);
      assert.notEqual(x.opts.redirect || 'follow', 'follow', 'redirection suivie');
      assert.ok(x.opts.signal, 'aucun délai');
    }
    assert.equal(sortants.filter((x) => new URL(x.url).hostname === 'www.vinted.it').length, 1, 'un site Vinted connu reste servi');
  } finally { net.rendre(); }
});

test('/api/widget : une clé inventée ne déclenche jamais la lecture de toutes les lignes `main`', async () => {
  const { default: widget } = await import('../../api/widget.js');
  const lus = [];
  const net = fauxReseau({ rest: (u) => {
    lus.push(u);
    if (u.includes('select=owner&limit=1')) return new Response('[]', { status: 200 });   // base cloisonnée
    if (u.includes('/app_data?') && u.includes('vrm_widget_token') && !u.includes('vrm_widget_token=eq.')) {
      // l'ancienne forme : toutes les lignes `main`, par pages
      return new Response(JSON.stringify(Array.from({ length: 1000 }, (_, i) => ({ owner: 'o' + i, vrm_widget_token: 'x' + i }))), { status: 206 });
    }
    return new Response('[]', { status: 200 });
  } });
  try {
    for (const k of ['', 'a', 'Z'.repeat(28), 'x&or=(id.neq.0)']) {
      const r = reponse();
      await widget({ method: 'GET', query: { k }, headers: {} }, r);
      assert.equal(r.statusCode, 401, `clé « ${k} »`);
    }
    const balayages = lus.filter((u) => u.includes('vrm_widget_token') && !u.includes('vrm_widget_token=eq.') && !u.includes('jeton_index') && !u.includes('vrm_jeton'));
    assert.equal(balayages.length, 0, `lecture de toutes les lignes main : ${balayages.length}`);
    assert.ok(lus.every((u) => !/vrm_widget_token=eq\.[^&]*[&(),]/.test(decodeURIComponent(u.split('vrm_widget_token=eq.')[1] || '').split('&select')[0] + '&')), 'valeur brute dans le filtre');
  } finally { net.rendre(); }
});

test('/api/widget : la bonne clé (hors index) désigne SON vendeur par un filtre exact', async () => {
  const { default: widget } = await import('../../api/widget.js');
  const K = 'AbCdEfGhIjKlMnOpQrStUvWxYz12';
  const net = fauxReseau({ rest: (u) => {
    if (u.includes('select=owner&limit=1')) return new Response('[]', { status: 200 });
    if (u.includes(`vrm_widget_token=eq.${K}`)) return new Response(JSON.stringify([{ owner: A, vrm_widget_token: K }]), { status: 200 });
    return new Response('[]', { status: 200 });
  } });
  try {
    const r = reponse();
    await widget({ method: 'GET', query: { k: K }, headers: {} }, r);
    assert.notEqual(r.statusCode, 401, 'la vraie clé est refusée');
    assert.ok(net.appels.some((x) => x.url.includes(`owner=eq.${A}`)), 'aucune lecture cadrée sur le vendeur de la clé');
  } finally { net.rendre(); }
});

// (11 nov.) `script-src https://cdn.jsdelivr.net` laissait passer N'IMPORTE quel
// paquet npm ou fichier GitHub servi par jsDelivr : une injection HTML aurait
// suffi à charger un script choisi par l'attaquant. Seuls les paquets FIGÉS que
// l'app charge vraiment sont permis, chacun par son chemin `paquet@version/`.
test('CSP : jsDelivr n’est permis qu’aux paquets figés que l’app charge', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const v = JSON.parse(fs.readFileSync(path.join(racine, 'vercel.json'), 'utf8'));
  const csps = JSON.stringify(v).match(/default-src[^"]*/g) || [];
  assert.ok(csps.length, 'aucune CSP');
  const src = (csp) => (csp.split(';').map((x) => x.trim()).find((x) => x.startsWith('script-src')) || '').split(/\s+/).slice(1);
  // Ce que l'app charge (versions lues dans le code, pas recopiées ici).
  const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
  const app = lire('src/App.jsx'), ort = lire('src/studioPhoto.js'), tess = lire('src/depensesTicket.js'), zx = lire('src/ScannerColis.jsx');
  const voulus = [
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${app.match(/const PDFJS_V = '([^']+)'/)[1]}/build/pdf.min.js`,
    `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ort.match(/ORT_VERSION = '([^']+)'/)[1]}/dist/ort.wasm.min.js`,
    tess.match(/const TESS = '([^']+)'/)[1] + 'tesseract.min.js',
    tess.match(/const TESS_CORE = '([^']+)'/)[1] + '/tesseract-core-simd-lstm.wasm.js',
    zx.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/@zxing[^'"`\s]+/)[0],
  ];
  const permis = (liste, url) => liste.some((s) => s === url || (s.endsWith('/') && url.startsWith(s)) || (!s.includes('/', 8) && new URL(url).host === s.replace(/^https:\/\//, '')));
  for (const csp of csps) {
    const l = src(csp);
    if (!l.length) continue;
    assert.ok(!l.includes('https://cdn.jsdelivr.net') && !l.includes('https://cdn.jsdelivr.net/') && !l.includes('https://cdn.jsdelivr.net/npm/'), 'jsDelivr entier permis');
    assert.ok(!l.includes('*') && !l.some((s) => /^https:\/\/\*/.test(s)), 'joker dans script-src');
    for (const u of voulus) assert.ok(permis(l, u), `bloqué par la CSP : ${u}`);
    for (const u of ['https://cdn.jsdelivr.net/gh/attaquant/x/a.js', 'https://cdn.jsdelivr.net/npm/paquet-pirate@1.0.0/x.js', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@9.9.9/build/pdf.min.js'])
      assert.ok(!permis(l, u), `permis par la CSP : ${u}`);
  }
});

// (11 nov.) « Ce Discord est déjà sur ton compte VRM … » : la ligne `vrm_discord`
// que le navigateur peut écrire (RLS) ne fait plus foi — seule une ligne signée
// par le serveur. Avant : n'importe qui « portait » le Discord d'un autre (écran
// trompeur qui propose de supprimer le compte neuf, début d'e-mail d'un tiers).
test('/api/compte?mode=discord-deja : une ligne vrm_discord plantée par un tiers ne désigne personne', async () => {
  process.env.DISCORD_CLIENT_SECRET = 'secret-discord-fictif';
  const { default: compte } = await import('../../api/compte.js');
  const { signerAvatarPublic } = await import('../../api/_lib/avatar-discord.js');
  const DID = '123456789012345678', AV = `https://cdn.discordapp.com/avatars/${DID}/${'a'.repeat(32)}.png?size=96`;
  const B = '22222222-2222-4222-8222-222222222222';
  const jouer = async (rows) => {
    const admin = [];
    const avant = globalThis.fetch;
    globalThis.fetch = async (url, opts = {}) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: A, identities: [{ provider: 'discord', identity_data: { provider_id: DID, name: 'victime' } }] }), { status: 200 });
      if (u.includes('/auth/v1/admin/users/')) { admin.push(u); return new Response(JSON.stringify({ email: 'tiers@attaquant.example' }), { status: 200 }); }
      if (u.includes('id=eq.vrm_discord')) return new Response(JSON.stringify(rows), { status: 200 });
      return new Response('[]', { status: 200 });
    };
    try {
      const r = reponse();
      await compte({ method: 'GET', query: { mode: 'discord-deja' }, headers: { authorization: `Bearer ${SESSION_A}` } }, r);
      return { corps: r.corps, admin };
    } finally { globalThis.fetch = avant; }
  };
  const plantee = await jouer([{ owner: B, discord: 'victime', avatar: AV, pid: '', signatureAvatar: '' }, { owner: B, discord: 'victime', avatar: AV, pid: '', signatureAvatar: 'f'.repeat(64) }]);
  assert.equal(plantee.corps && plantee.corps.trouve, false, 'ligne non signée prise pour une preuve');
  assert.equal(plantee.admin.length, 0, 'e-mail d’un tiers lu');
  const vraie = await jouer([{ owner: B, discord: 'victime', avatar: AV, pid: '', signatureAvatar: signerAvatarPublic(B, 'victime', '', AV) }]);
  assert.equal(vraie.corps && vraie.corps.trouve, true, 'la vraie ligne signée n’est plus reconnue');
});
