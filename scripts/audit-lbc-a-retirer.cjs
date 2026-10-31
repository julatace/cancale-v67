// ═══════════════════════════════════════════════════════════════════════════
// « VENDUE SUR VINTED ⇒ À RETIRER DE LEBONCOIN » : UNE RÈGLE (29 oct.)
//   node scripts/audit-lbc-a-retirer.cjs [--app src/App.jsx] [--src background.js]
//   node scripts/audit-lbc-a-retirer.cjs --prouve   (réaffaiblit la règle : rouge exigé)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (29 oct.) : « J'ai vendu une paire sur Vinted et VRM ne m'a pas dit de
// la supprimer ». MESURÉ (lecture seule) : la N°18, vendue sur Vinted le 18
// octobre (transaction → annonce), est restée sur Leboncoin jusqu'au 28 ; Ma
// journée ne comptait que les ventes marquées à la main, et l'écran Leboncoin
// sautait un N° encore porté par une annonce Vinted « ouverte » (Vinted ne ferme
// pas toujours une annonce vendue). La VRAIE règle de l'app est exécutée (vm),
// sur des identifiants INVENTÉS ; et le VRAI background.js (le logo VRM sur
// leboncoin.fr lit le résumé publié par l'app).
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const F = { app: arg('--app', path.join(racine, 'src/App.jsx')), src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')) };
if (process.argv.includes('--prouve')) {
  const MUT = [
    ['preuveNePrimePas', 'app', "for (const id of (enLigne || [])) { if (vendus.has(String(id))) continue;", "for (const id of (enLigne || [])) {"],
    ['titreCommeIdentite', 'app', "const k = numeroLbcIdentite({ itemId: ad.id }, itemsLbc, liens);\n    if (!k) continue;\n    if (!annonceLbcEnVente(ad, vendusLbc)) continue;", "const k = clesAnnonceLbc(ad, liens)[0] || '';\n    if (!k) continue;\n    if (!annonceLbcEnVente(ad, vendusLbc)) continue;"],
    ['pasSuVautRien', 'app', "if (!(vendus && typeof vendus.has === 'function')) return null;", "if (!(vendus && typeof vendus.has === 'function')) vendus = new Set();"],
    ['revenueIgnoree', 'app', "if (k && (vivants.has(k) || out.has(k) || (sortis && sortis.has(k)))) continue;", "if (k && (out.has(k) || (sortis && sortis.has(k)))) continue;"],
    ['carteSansCache', 'src', "if (!c || !(Date.now() - Number(c.lu || 0) < LBC_A_RETIRER_RELU_MS)) {", "if (true) {"],
    ['carteSansCompte', 'src', "if (c && c.u !== u) c = null;", ""],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lbc-a-retirer-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const f = path.join(tmp, nom + path.extname(F[cle]));
    fs.writeFileSync(f, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, f]; for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000 });
    const n = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && n > 0; if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${n} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque réaffaiblissement fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}
const APP = fs.readFileSync(F.app, 'utf8'), SRC = fs.readFileSync(F.src, 'utf8');
let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${det ? ' — ' + det : ''}`); };
const essaie = async (nom, fn) => { try { return await fn(); } catch (e) { dit(false, nom, 'a levé : ' + (e && e.message)); return null; } };
function extraire(src, nom) {
  const re = new RegExp(`^(?:async )?function ${nom}\\(|^const ${nom}\\s*=\\s*`, 'm');
  const m = re.exec(src); if (!m) throw new Error(`« ${nom} » introuvable`);
  let i = m.index, prof = 0, vu = false; const estFn = /function/.test(m[0]);
  for (; i < src.length; i++) { const c = src[i];
    if (c === '(' || c === '[' || c === '{') { prof++; if (c === '{') vu = true; }
    else if (c === ')' || c === ']' || c === '}') { prof--; if (estFn && vu && prof === 0 && c === '}') return src.slice(m.index, i + 1); }
    else if (!estFn && c === ';' && prof === 0) return src.slice(m.index, i + 1); }
  throw new Error(`fin de « ${nom} » introuvable`);
}
(async () => {
  console.log('── 1. LA RÈGLE DE L’APP (aRetirerDeLbcVinted)');
  let R = null;
  await essaie('la règle se charge', async () => {
    const noms = ['cleNum', 'refVRMDe', 'NUM_OK', 'marqueurNumerotation', 'archiveNumeros', 'coupureNumerotation', 'numeroExterne', 'numeroLbcIdentite', 'LBC_PAUSE_INDEX_MS', 'lbcSortieDe', 'LBC_ANNONCE_MORTE', 'annonceLbcEnVente', 'numDeTitreLbc', 'clesAnnonceLbc', 'aRetirerDeLbcVinted'];
    const code = 'const load = (k, d) => d;\n' + noms.map((n) => extraire(APP, n)).join('\n') + '\n;this.R = { aRetirerDeLbcVinted };';
    const ctx = {}; vm.createContext(ctx); vm.runInContext(code, ctx); R = ctx.R;
  });
  const f = R ? R.aRetirerDeLbcVinted : () => { throw new Error('règle absente'); };
  const num = (n, t) => ({ numero: n, title: t || 'Paire ' + n });
  const ad = (id, ref, extra) => Object.assign({ id: String(id), subject: 'Annonce ' + id, ref, status: 'active', account: 'compte', seenAt: new Date().toISOString(), url: 'https://www.leboncoin.fr/ad/chaussures/' + id, price: 55 }, extra || {});
  const nums = { '1001': num('18', 'Nike shox TL'), '2001': num('2', 'Jordan 4 gris'), '2002': num('2', 'Jordan 4 gris'), '3001': num('23', 'Air max 1') };
  await essaie('N°18 réelle', async () => {
    const r = f({ posted: ['1001'], numeros: nums, enLigne: new Set(['1001', '3001']), vendus: new Set(['1001']), itemsLbc: { '3290000104': ad(3290000104, '18'), '3290000102': ad(3290000102, '23') }, liens: {}, vendusLbc: new Set(), sortis: new Set() });
    dit(Array.isArray(r) && r.length === 1 && r[0].numero === '18' && r[0].lbcId === '3290000104', 'vendue PROUVÉE sur Vinted, annonce Vinted encore ouverte, annonce Leboncoin réf 18 en vente ⇒ à retirer (une ligne, son annonce)', JSON.stringify(r));
  });
  await essaie('republiée', async () => {
    const r = f({ posted: ['2001'], numeros: nums, enLigne: new Set(['2002']), vendus: new Set(['2001']), itemsLbc: { '3290000101': ad(3290000101, '2') }, liens: {}, vendusLbc: new Set(), sortis: new Set() });
    dit(Array.isArray(r) && r.length === 0, 'une AUTRE annonce Vinted en ligne et non vendue porte le N° ⇒ la paire est revenue : rien', JSON.stringify(r));
  });
  await essaie('pas su', async () => {
    const r = f({ posted: ['1001'], numeros: nums, enLigne: new Set(), vendus: null, itemsLbc: { '3290000104': ad(3290000104, '18') }, liens: {}, vendusLbc: new Set(), sortis: new Set() });
    dit(r === null, 'preuve de vente illisible ⇒ `null` (pas su), jamais une alerte inventée ni « rien »', JSON.stringify(r));
  });
  await essaie('titre seul', async () => {
    const r = f({ posted: [], numeros: nums, enLigne: new Set(), vendus: new Set(['1001']), itemsLbc: { '3290000009': ad(3290000009, null, { subject: 'Nike shox TL n18' }) }, liens: {}, vendusLbc: new Set(), sortis: new Set() });
    dit(Array.isArray(r) && r.length === 0, 'une annonce Leboncoin qui n’a que « n18 » dans son TITRE ne désigne pas la paire (§5)', JSON.stringify(r));
  });
  await essaie('lien posé à la main', async () => {
    const r = f({ posted: [], numeros: nums, enLigne: new Set(), vendus: new Set(['1001']), itemsLbc: { '3290000009': ad(3290000009, null) }, liens: { '3290000009': '18' }, vendusLbc: new Set(), sortis: new Set() });
    dit(Array.isArray(r) && r.length === 1 && r[0].lbcId === '3290000009', 'un lien posé à la main est une identité ⇒ à retirer', JSON.stringify(r));
  });
  await essaie('déjà partie de Leboncoin', async () => {
    const it = { '3290000104': ad(3290000104, '18', { status: 'deleted', supprimeeAt: new Date().toISOString() }) };
    const r1 = f({ posted: ['1001'], numeros: nums, enLigne: new Set(), vendus: new Set(['1001']), itemsLbc: it, liens: {}, vendusLbc: new Set(), sortis: new Set() });
    dit(Array.isArray(r1) && r1.length === 1 && r1[0].lbcId === '', 'annonce reliée supprimée mais SANS preuve qu’aucune autre ne porte la paire ⇒ la ligne « publiée » reste (doute)', JSON.stringify(r1));
    const r2 = f({ posted: ['1001'], numeros: nums, enLigne: new Set(), vendus: new Set(['1001']), itemsLbc: it, liens: {}, vendusLbc: new Set(), sortis: new Set(['18']) });
    dit(Array.isArray(r2) && r2.length === 0, '… avec la preuve (liste complète de ses comptes après la marque) ⇒ plus rien à retirer', JSON.stringify(r2));
  });
  await essaie('vendue sur Leboncoin', async () => {
    const r = f({ posted: [], numeros: nums, enLigne: new Set(), vendus: new Set(['1001']), itemsLbc: { '3290000104': ad(3290000104, '18') }, liens: {}, vendusLbc: new Set(['3290000104']), sortis: new Set() });
    dit(Array.isArray(r) && r.length === 0, 'une annonce vendue sur Leboncoin n’y est plus en vente : rien à retirer (l’autre alerte, « vendue deux fois », la dit)', JSON.stringify(r));
  });

  console.log('\n── 2. LE LOGO VRM SUR LEBONCOIN.FR LIT LE RÉSUMÉ PUBLIÉ (background.js)');
  await essaie('carte du logo', async () => {
    const base = { lbc_a_retirer: { v: 1, at: '2026-10-29T10:00:00.000Z', liste: [{ numero: '18', lbcId: '3290000104', titre: 'Nike shox TL', url: 'https://www.leboncoin.fr/ad/chaussures/3290000104' }] } };
    let panne = false, lectures = 0;
    const local = {};
    const dual = (fn) => function (...a) { const cb = a[a.length - 1]; const v = fn(...(typeof cb === 'function' ? a.slice(0, -1) : a)); if (typeof cb === 'function') { Promise.resolve(v).then(cb); return; } return Promise.resolve(v); };
    const ctx = { console: { log() {}, warn() {}, error() {}, info() {} }, setTimeout, clearTimeout, setInterval, clearInterval, URL, TextDecoder, TextEncoder,
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'), atob: (s) => Buffer.from(s, 'base64').toString('binary'),
      chrome: { runtime: { onInstalled: { addListener() {} }, onStartup: { addListener() {} }, onMessage: { addListener() {} }, onMessageExternal: { addListener() {} }, getManifest: () => ({ version: 't' }), lastError: null, id: 'x' },
        alarms: { create() {}, clear() {}, get: dual(() => null), onAlarm: { addListener() {} } }, cookies: { get: dual(() => null), getAll: dual(() => []), onChanged: { addListener() {} } },
        downloads: { onCreated: { addListener() {} } }, action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
        tabs: { onUpdated: { addListener() {} }, onRemoved: { addListener() {} }, query: dual(() => []), get: dual(() => null), create: dual(() => ({})), remove: dual(() => {}), sendMessage: dual(() => undefined) },
        storage: { local: { get: dual((k) => { const ks = Array.isArray(k) ? k : [k]; const o = {}; for (const x of ks) if (x in local) o[x] = JSON.parse(JSON.stringify(local[x])); return o; }), set: dual((o) => { Object.assign(local, JSON.parse(JSON.stringify(o))); }), remove: dual(() => {}) }, onChanged: { addListener() {} } } },
      fetch: async (url) => {
        const u = decodeURIComponent(String(url));
        if (/lbc_a_retirer/.test(u)) { lectures++; if (panne) return { ok: false, status: 522, json: async () => ({}), text: async () => '<html>', headers: { get: () => 'text/html' } };
          const body = JSON.stringify([{ a: base.lbc_a_retirer }]); return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } }; }
        return { ok: true, status: 200, json: async () => [], text: async () => '[]', headers: { get: () => 'application/json' } };
      } };
    ctx.self = ctx; ctx.globalThis = ctx; ctx.window = undefined;
    vm.createContext(ctx); vm.runInContext(SRC, ctx, { filename: 'background.js' });
    ctx.authToken = async () => ({ access_token: 'jeton', user_id: 'vendeur', expires_at: Date.now() + 3600e3 }); ctx.loadSession = ctx.authToken;
    if (typeof ctx.lbcARetirerPourCarte !== 'function') throw new Error('lbcARetirerPourCarte absente');
    const d1 = await ctx.lbcARetirerPourCarte();
    dit(d1 && Array.isArray(d1.liste) && d1.liste.length === 1 && d1.liste[0].numero === '18', 'le résumé publié par VRM arrive sur la carte', JSON.stringify(d1));
    const n1 = lectures; await ctx.lbcARetirerPourCarte();
    dit(lectures === n1, 'relu au plus toutes les 5 min (pas une lecture par page)', `${n1} → ${lectures}`);
    // (29 oct., revue) Un AUTRE compte VRM connecté dans ce Chrome ne voit jamais
    // la liste du précédent (copie liée au compte).
    const sessA = ctx.loadSession;
    ctx.loadSession = async () => ({ access_token: 'jetonB', user_id: 'vendeur_B', expires_at: Date.now() + 3600e3 }); ctx.authToken = ctx.loadSession;
    const sauve = base.lbc_a_retirer; base.lbc_a_retirer = { v: 1, at: '2026-10-29T11:00:00.000Z', liste: [] };
    const dB = await ctx.lbcARetirerPourCarte();
    dit(dB && Array.isArray(dB.liste) && dB.liste.length === 0, 'un autre compte VRM dans ce Chrome ne voit pas la liste du précédent', JSON.stringify(dB));
    base.lbc_a_retirer = sauve; ctx.loadSession = sessA; ctx.authToken = sessA;
    await ctx.lbcARetirerPourCarte();
    local.vrmLbcARetirer.lu = Date.now() - 6 * 60e3; panne = true;
    const d2 = await ctx.lbcARetirerPourCarte();
    dit(d2 && d2.liste && d2.liste.length === 1, 'base en panne ⇒ la dernière connue (pas su ≠ rien à retirer)', JSON.stringify(d2));
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})();
