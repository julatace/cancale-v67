require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris)
// ════════════════════════════════════════════════════════════════════════════
// AUDIT « LE PARRAINAGE, CLAIR ET VISIBLE » (13 nov., lot 54)
//   node scripts/audit-parrainage-lot54.cjs [--mutation=…] [--prouve]
// EXÉCUTE la vraie route `api/compte.js?mode=parrainage` et le vrai webhook
// Stripe (`invoice.paid`) dans un monde inventé (fausse base, faux Stripe) :
//   A. le lien ouvert SANS session : le nom CHOISI seul (« Offert par … »),
//      jamais un identifiant, un e-mail ni un pseudo Vinted ; revalidé à la
//      lecture (une ligne écrite par le navigateur ne passe pas) ; fermé ⇒ rien ;
//   B. le nom : posé par la route sous le vendeur de la SESSION (un `owner` du
//      corps est ignoré), jamais un pseudo Vinted, un lien, une adresse, un
//      numéro, « VRM »/« Vinted »/« support » ; pas su ⇒ 503, rien écrit ;
//   C. l'anti-abus au rattachement : même e-mail à un point / « + » près ⇒ soi-
//      même ; un compte Vinted déjà vu chez un autre compte VRM ⇒ refusé ;
//      lectures muettes ⇒ 503, rien rattaché ;
//   D. le mois offert : sans compte Vinted ⇒ ni crédit ni refus (refait à la
//      facture suivante) ; compte Vinted neuf ⇒ un mois à chacun ; compte Vinted
//      vu ailleurs (lecture d'un autre compte VRM, essai d'un autre compte) ⇒
//      refus rangé, rien crédité ; lecture muette ⇒ 503 (Stripe rejoue) ;
//   E. l'état de CHAQUE filleul (sans identité) et le cloisonnement : un autre
//      vendeur ne voit rien de mes filleuls ; aucune réponse ne porte d'uuid ni
//      d'adresse.
//   M. `--prouve` : chaque mutation de la règle rend l'audit ROUGE.
// Aucune donnée réelle : tout est inventé ici (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
require('./_source-app.cjs').brancher();
const path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');

// ── Les mutations : chacune réaffaiblit UNE règle de api/_lib/parrainage.js ──
const MUTS = {
  'sans-vinted-credite': ["if (verdict !== 'sans-vinted' && !l.credit_filleul_le) {", 'if (!l.credit_filleul_le) {'],
  'deja-vu-ignore': ["if (vu.length) return 'vinted-deja-vu';", 'if (false) return 0;'],
  'essai-autre-ignore': ["if (essais.some((x) => x && x.owner && String(x.owner) !== String(filleul))) return 'vinted-deja-vu';", ''],
  'email-brut': ["if (emailParrain && emailCanon(emailParrain) === emailCanon(u.email))", 'if (emailParrain && emailParrain === u.email)'],
  'nom-pseudo-vinted': ["if (q && (q === c || (q.length >= 4 && c.includes(q)))) return non('pseudo-vinted'", "if (false) return non('pseudo-vinted'"],
  'nom-pas-revalide': ['const v = nomAffichable(brut, pseudos);\n  return v.ok ? v.nom : null;', 'return brut;'],
  'nom-mots-reserves': ["if (NOM_MOTS_INTERDITS.some((m) => c.includes(m)))", 'if (false)'],
  'apercu-ferme': ["if (!ouvert || !CODE_RE.test(c)) return { ok: true, ouvert, connu: false, nom: null };", "if (!CODE_RE.test(c)) return { ok: true, ouvert, connu: false, nom: null };"],
  'pas-su-vinted': ["if (verdict === null) return { ok: false };", 'if (verdict === null) verdict = \'ok\';'],
  'parrain-sans-verdict': ["if (v === 'sans-vinted') return true;                   // rien : refait à la prochaine facture", "if (false) return true;"],
};
if (process.argv.includes('--prouve')) {
  let n = 0;
  for (const k of Object.keys(MUTS)) {
    let code = 0; try { execFileSync(process.execPath, [__filename, '--mutation=' + k], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${k} » ⇒ ${code === 1 ? 'ROUGE' : 'pas attrapée (' + code + ')'}`); if (code === 1) n++;
  }
  console.log(`${n}/${Object.keys(MUTS).length} mutations attrapées`); process.exit(n === Object.keys(MUTS).length ? 0 : 1);
}
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1];
// Une mutation : `api/` copié à côté (avec `src` et package.json reliés), la règle réaffaiblie dans la copie.
function racineApi() {
  if (!MUT) return RACINE;
  const [de, vers] = MUTS[MUT] || [];
  if (de == null) { console.log('mutation inconnue ' + MUT); process.exit(2); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-parrain-'));
  process.on('exit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} });   // rien ne reste sur le disque
  fs.cpSync(path.join(RACINE, 'api'), path.join(tmp, 'api'), { recursive: true });
  fs.symlinkSync(path.join(RACINE, 'src'), path.join(tmp, 'src'));
  fs.symlinkSync(path.join(RACINE, 'public'), path.join(tmp, 'public'));
  fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(tmp, 'node_modules'));
  fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(tmp, 'package.json'));
  const f = path.join(tmp, 'api', '_lib', 'parrainage.js');
  const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(de)) { console.log('mutation sans prise ' + MUT); process.exit(2); }
  fs.writeFileSync(f, s.replace(de, vers));
  return tmp;
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.stack || e).split('\n').slice(0, 2).join(' ')); } };

const A = '11111111-1111-4111-8111-111111111111';   // le parrain
const B = '22222222-2222-4222-8222-222222222222';   // un autre vendeur
const N = '33333333-3333-4333-8333-333333333333';   // un compte neuf (filleul)
const SECRET = 'whsec_banc_lot54';
const RECENT = new Date(Date.now() - 2 * 864e5).toISOString();
const ANCIEN = new Date(Date.now() - 90 * 864e5).toISOString();
const JETONS = {
  'aa.bb.A': { id: A, email: 'jul.ien+vrm@gmail.com', created_at: ANCIEN },
  'aa.bb.B': { id: B, email: 'b@exemple.test', created_at: ANCIEN },
  'aa.bb.N': { id: N, email: 'n@exemple.test', created_at: RECENT },
};
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// ── Le monde inventé ────────────────────────────────────────────────────────
let abos, codes, parr, reglages, essais, vinted, balance, appData, harvest, pannes, emails, ecritures;
const reset = () => {
  abos = {}; codes = {}; parr = {}; reglages = { parrainage: '1' }; essais = []; balance = {};
  vinted = { [A]: [{ vinted_user_id: '4100', login: 'juju_sneakers' }], [N]: [{ vinted_user_id: '5500', login: 'nouvelle_v' }] };
  appData = {}; harvest = {}; pannes = new Set(); ecritures = [];
  emails = { [A]: 'jul.ien+vrm@gmail.com', [B]: 'b@exemple.test', [N]: 'n@exemple.test' };
};
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const q = (u, k) => { const m = new RegExp('[?&]' + k + '=([^&]+)').exec(u); return m ? decodeURIComponent(m[1]) : null; };
const eq = (v) => String(v || '').replace(/^eq\./, '');
global.fetch = async (url, opts = {}) => {
  const u = String(url), m = opts.method || 'GET', h = opts.headers || {};
  const jwt = String(h.Authorization || '').replace('Bearer ', '');
  const service = !jwt.startsWith('aa.bb.');
  if (u.includes('/auth/v1/admin/users/')) {
    if (pannes.has('admin')) return rep({ msg: 'muet' }, 500);
    const id = decodeURIComponent(u.split('/auth/v1/admin/users/')[1].split('?')[0]);
    return emails[id] ? rep({ id, email: emails[id] }) : rep({ msg: 'introuvable' }, 404);
  }
  if (u.includes('/auth/v1/user')) return JETONS[jwt] ? rep(JETONS[jwt]) : rep({ msg: 'invalid' }, 401);
  if (u.includes('/rest/v1/rpc/vrm_acces')) { const qui = JETONS[jwt]; return qui ? rep({ obligatoire: true, proprietaire: false, acces: true, lecture: true }) : rep({}, 401); }
  if (u.includes('/rest/v1/abonnements')) {
    if (!service) { const qui = JETONS[jwt]; return rep(qui && abos[qui.id] ? [abos[qui.id]] : []); }
    const o = q(u, 'owner'), c = q(u, 'client_stripe');
    if (o) { const id = eq(o); return rep(abos[id] ? [{ ...abos[id], owner: id }] : []); }
    if (c) { const cl = eq(c); const e = Object.entries(abos).find(([, l]) => l.client_stripe === cl); return rep(e ? [{ owner: e[0] }] : []); }
    return rep([]);
  }
  if (u.includes('/rest/v1/vrm_reglages')) { if (pannes.has('reglages')) return rep({}, 500); return rep(reglages.parrainage != null ? [{ valeur: reglages.parrainage }] : []); }
  if (u.includes('/rest/v1/parrainage_codes')) {
    if (m === 'POST') { for (const l of JSON.parse(opts.body)) if (!codes[l.owner]) codes[l.owner] = l.code; return rep('', 201); }
    const o = q(u, 'owner'), c = q(u, 'code');
    if (o) { const id = eq(o); return rep(codes[id] ? [{ code: codes[id] }] : []); }
    if (c) { const cc = eq(c); const e = Object.entries(codes).find(([, v]) => v === cc); return rep(e ? [{ owner: e[0] }] : []); }
    return rep([]);
  }
  if (u.includes('/rest/v1/parrainages')) {
    if (m === 'POST') { const rendus = []; for (const l of JSON.parse(opts.body)) { if (parr[l.filleul]) continue; parr[l.filleul] = { ...l }; rendus.push(l); } return rep(rendus, 201); }
    if (m === 'PATCH') { const f = eq(q(u, 'filleul')); parr[f] = { ...parr[f], ...JSON.parse(opts.body) }; return new Response(null, { status: 204 }); }
    const f = q(u, 'filleul'), p = q(u, 'parrain');
    let l = Object.values(parr);
    if (f) l = l.filter((x) => x.filleul === eq(f));
    if (p) l = l.filter((x) => x.parrain === eq(p));
    if (/paye_le=not\.is\.null/.test(u)) l = l.filter((x) => x.paye_le);
    if (/credit_parrain_le=is\.null/.test(u)) l = l.filter((x) => !x.credit_parrain_le);
    return rep(l.map((x) => ({ paye_le: null, credit_filleul_le: null, credit_parrain_le: null, refus: null, inscrit: null, ...x })));
  }
  if (u.includes('/rest/v1/vinted_accounts')) {
    if (pannes.has('vinted')) return rep({}, 500);
    const o = eq(q(u, 'owner'));
    return rep((vinted[o] || []).map((v) => (/select=login/.test(u) ? { login: v.login } : { vinted_user_id: v.vinted_user_id })));
  }
  if (u.includes('/rest/v1/essais_gratuits')) {
    if (m === 'POST') return rep('', 201);
    const rows = essais.filter((e) => u.includes(encodeURIComponent(e.cle)));
    return rep(/select=owner/.test(u) ? rows.map((e) => ({ owner: e.owner })) : rows.map((e) => ({ cle: e.cle })));
  }
  if (u.includes('/rest/v1/app_data')) {
    if (m === 'POST') {
      if (pannes.has('app_data_ecrire')) return rep({}, 500);
      for (const l of JSON.parse(opts.body)) { appData[l.owner + '|' + l.id] = l; ecritures.push({ owner: l.owner, id: l.id, data: l.data }); }
      return rep('', 201);
    }
    const like = q(u, 'id');
    if (like && /^like\.harvest_/.test(like)) {
      if (pannes.has('harvest')) return rep({}, 500);
      const vid = like.replace(/^like\.harvest_/, '').replace(/_\*$/, '');
      const sauf = String(q(u, 'owner') || '').replace(/^neq\./, '');
      return rep((harvest[vid] || []).filter((o) => o !== sauf).slice(0, 1).map((o) => ({ owner: o })));
    }
    const o = eq(q(u, 'owner')), id = eq(q(u, 'id'));
    const l = appData[o + '|' + id];
    return rep(l ? [{ nom: l.data && l.data.nom != null ? String(l.data.nom) : null }] : []);
  }
  if (u.startsWith('https://api.stripe.com/v1/')) {
    const chemin = u.slice('https://api.stripe.com/v1/'.length).split('?')[0];
    const corps = new URLSearchParams(opts.body || u.split('?')[1] || '');
    const bt = /^customers\/([^/]+)\/balance_transactions$/.exec(chemin);
    if (bt) {
      const c = bt[1]; balance[c] = balance[c] || [];
      if (m === 'GET') return rep({ object: 'list', data: balance[c] });
      const t = { id: 'cbtxn_' + balance[c].length, amount: Number(corps.get('amount')), metadata: { vrm_parrainage: corps.get('metadata[vrm_parrainage]') } };
      balance[c].push(t); return rep(t);
    }
    if (chemin === 'payment_methods') { const c = corps.get('customer'); return rep({ object: 'list', data: [{ id: 'pm_' + c, type: 'card', card: { fingerprint: 'fp_' + c } }] }); }
    if (chemin === 'prices') return rep({ data: [{ id: 'price_banc', unit_amount: 1699, currency: 'eur', recurring: { interval: 'month', interval_count: 1 } }] });
    return rep({ error: { message: 'inconnu' } }, 404);
  }
  return rep({}, 404);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
const req = ({ method = 'GET', mode, headers = {}, corps = null, query = {} }) => {
  const buf = corps == null ? null : Buffer.from(typeof corps === 'string' ? corps : JSON.stringify(corps), 'utf8');
  return { method, query: { mode, ...query }, headers, async *[Symbol.asyncIterator]() { if (buf) yield buf; } };
};
const signer = (c) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${crypto.createHmac('sha256', SECRET).update(`${t}.${c}`).digest('hex')}`; };
const evt = (type, objet, created) => JSON.stringify({ id: 'evt_' + created, type, created, livemode: false, data: { object: objet } });

(async () => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  const base = racineApi();
  let compte, P;
  try { compte = (await import('file://' + path.join(base, 'api', 'compte.js'))).default; P = await import('file://' + path.join(base, 'api', '_lib', 'parrainage.js')); }
  catch (e) { dit(false, 'api/compte.js se charge', e.message); console.log(`\n❌ ${ko} rouge(s)`); process.exit(1); }
  const appel = async (o) => { const r = faireRes(); await compte(req(o), r); return r; };
  const get = (j) => appel({ mode: 'parrainage', headers: { authorization: 'Bearer ' + j } });
  const apercu = (code) => appel({ mode: 'parrainage', query: { code } });
  const post = (j, corps) => appel({ method: 'POST', mode: 'parrainage', headers: j ? { authorization: 'Bearer ' + j } : {}, corps });
  const rattacher = (j, code) => post(j, { action: 'rattacher', code });
  const nommer = (j, nom, extra = {}) => post(j, { action: 'nom', nom, ...extra });
  const facture = (client, montant, n) => evt('invoice.paid', { id: 'in_' + n, object: 'invoice', customer: client, amount_paid: montant, subscription: 'sub_x' }, 1000 + n);
  const webhook = async (c) => { const r = faireRes(); await compte(req({ method: 'POST', mode: 'webhook', headers: { 'stripe-signature': signer(c) }, corps: c }), r); return r; };
  const propre = (corps) => { const t = JSON.stringify(corps); return !UUID_RE.test(t) && !/@/.test(t) && !/juju_sneakers|nouvelle_v|4100|5500/.test(t); };

  console.log('── A. Le lien ouvert sans session : le nom choisi, rien d’autre');
  await essaie('A', async () => {
    reset(); const code = (await get('aa.bb.A')).corps.code;
    let r = await apercu('ZZZZZZZZ');
    dit(r.code === 200 && r.corps.connu === false && r.corps.nom === null, 'A1 code inconnu : « connu: false », aucun nom', JSON.stringify(r.corps));
    r = await apercu(code);
    dit(r.code === 200 && r.corps.connu === true && r.corps.ouvert === true && r.corps.nom === null, 'A2 aucun nom choisi : rien (l’écran dit « un vendeur VRM »)', JSON.stringify(r.corps));
    await nommer('aa.bb.A', 'Julie');
    r = await apercu(code);
    dit(r.code === 200 && r.corps.nom === 'Julie' && Object.keys(r.corps).sort().join(',') === 'connu,nom,ok,ouvert' && propre(r.corps), 'A3 nom choisi : « Julie », et SEULEMENT ça (ni uuid, ni e-mail, ni pseudo Vinted)', JSON.stringify(r.corps));
    appData[A + '|' + P.NOM_ID] = { owner: A, id: P.NOM_ID, data: { nom: 'Juju_Sneakers' } };   // écrite par le navigateur (RLS), sans la route
    r = await apercu(code);
    dit(r.corps.nom === null, 'A4 une ligne écrite à la main avec son pseudo Vinted : REVALIDÉE, rien ne sort', JSON.stringify(r.corps));
    appData[A + '|' + P.NOM_ID] = { owner: A, id: P.NOM_ID, data: { nom: 'Julie' } };
    reglages.parrainage = '0'; r = await apercu(code);
    dit(r.code === 200 && r.corps.ouvert === false && r.corps.nom === null && r.corps.connu === false, 'A5 programme fermé : rien n’est promis (aucun nom)', JSON.stringify(r.corps));
    reglages.parrainage = '1'; pannes.add('reglages'); r = await apercu(code);
    dit(r.code === 503 && !r.corps.nom, 'A6 base muette : 503, aucun nom', `HTTP ${r.code}`);
    pannes.clear(); r = await apercu('');
    dit(r.code === 200 && r.corps.ouvert === true && r.corps.connu === false, 'A7 sans code (la ligne du menu « Plus ») : seulement « ouvert »', JSON.stringify(r.corps));
  });

  console.log('\n── B. Le nom : choisi par le parrain, sous SA session, jamais un pseudo Vinted');
  await essaie('B', async () => {
    reset(); await get('aa.bb.A');
    let r = await nommer('aa.bb.A', '  Julie   M. ', { owner: B });
    dit(r.code === 200 && r.corps.nom === 'Julie M.' && appData[A + '|' + P.NOM_ID] && !appData[B + '|' + P.NOM_ID], 'B1 rangé sous le vendeur de la SESSION (un `owner` du corps est ignoré), espaces nettoyés', JSON.stringify({ c: r.corps, e: ecritures }));
    const refus = [['juju_sneakers', 'pseudo-vinted'], ['Juju Sneakers', 'pseudo-vinted'], ['jujusneakers92', 'pseudo-vinted'], ['Support VRM', 'reserve'], ['Vinted Julie', 'reserve'], ['julie@gmail.com', 'signes'], ['julie.fr', 'signes'], ['0612345678', 'signes'], ['x', 'longueur'], ['J'.repeat(25), 'longueur'], ['<script>', 'signes'], ['http julie', 'signes']];
    for (const [nom, raison] of refus) {
      const avant = ecritures.length;
      r = await nommer('aa.bb.A', nom);
      dit(r.code === 400 && r.corps.raison === raison && ecritures.length === avant && typeof r.corps.message === 'string', `B2 « ${nom.slice(0, 16)} » refusé (${raison}), rien écrit, la raison dite`, JSON.stringify(r.corps));
    }
    pannes.add('vinted'); const avant = ecritures.length; r = await nommer('aa.bb.A', 'Julie');
    dit(r.code === 503 && ecritures.length === avant, 'B3 pseudos Vinted pas lus : 503, rien écrit (on ne vérifie pas à moitié)', `HTTP ${r.code}`);
    pannes.clear(); r = await nommer('aa.bb.A', '');
    dit(r.code === 200 && r.corps.nom == null && appData[A + '|' + P.NOM_ID].data.nom === null, 'B4 « Ne plus montrer de nom » : effacé', JSON.stringify(r.corps));
    const n0 = ecritures.length; r = await nommer(null, 'Julie');
    dit(r.code === 401 && ecritures.length === n0, 'B5 sans session : 401, rien écrit', `HTTP ${r.code}`);
    r = await nommer('aa.bb.A', 12);
    dit(r.code === 400, 'B6 un nom qui n’est pas du texte : 400', `HTTP ${r.code}`);
    dit(P.nomAffichable('Élodie', []).ok && P.nomAffichable('Jean-Marc', []).ok && P.nomAffichable('Sneakers 92', []).ok && P.nomAffichable('O’Neil', []).ok, 'B7 prénoms et pseudos ordinaires acceptés (accents, tiret, apostrophe, 2 chiffres)');
  });

  console.log('\n── C. Le rattachement : pas soi-même (e-mail), compte Vinted jamais vu');
  await essaie('C', async () => {
    reset(); const code = (await get('aa.bb.A')).corps.code;
    emails[A] = 'julien@gmail.com'; JETONS['aa.bb.N'].email = 'jul.ien+2@googlemail.com';
    let r = await rattacher('aa.bb.N', code);
    dit(r.code === 400 && r.corps.raison === 'soi-meme' && !parr[N], 'C1 « jul.ien+2@googlemail.com » = « julien@gmail.com » : soi-même, rien rattaché', JSON.stringify(r.corps));
    JETONS['aa.bb.N'].email = 'n@exemple.test';
    pannes.add('admin'); r = await rattacher('aa.bb.N', code);
    dit(r.code === 503 && !parr[N], 'C2 adresse du parrain pas lue : 503, rien rattaché', `HTTP ${r.code}`);
    pannes.clear(); harvest['5500'] = [B];
    r = await rattacher('aa.bb.N', code);
    dit(r.code === 409 && r.corps.raison === 'vinted-deja-vu' && !parr[N], 'C3 son compte Vinted a déjà été lu chez un AUTRE compte VRM : refusé', JSON.stringify(r.corps));
    pannes.add('harvest'); r = await rattacher('aa.bb.N', code);
    dit(r.code === 503 && !parr[N], 'C4 lecture « déjà vu » muette : 503, rien rattaché', `HTTP ${r.code}`);
    pannes.clear(); harvest = { '5500': [N] };   // ses propres lectures : pas « vu ailleurs »
    r = await rattacher('aa.bb.N', code);
    dit(r.code === 200 && r.corps.ok && parr[N] && parr[N].parrain === A, 'C5 compte neuf, ses propres lectures seulement : rattaché', JSON.stringify(r.corps));
    r = await rattacher('aa.bb.A', code);
    dit(r.code === 400 && r.corps.raison === 'soi-meme', 'C6 son propre lien : soi-même', JSON.stringify(r.corps));
  });

  console.log('\n── D. Le mois offert : un compte Vinted jamais vu');
  await essaie('D', async () => {
    // D1-D2 : sans compte Vinted au paiement, rien ; relié ensuite, un mois à chacun.
    reset(); delete vinted[N]; let code = (await get('aa.bb.A')).corps.code; await nommer('aa.bb.A', 'Julie');
    await rattacher('aa.bb.N', code);
    abos[N] = { statut: 'active', client_stripe: 'cus_N' }; abos[A] = { statut: 'active', client_stripe: 'cus_A' };
    let r = await webhook(facture('cus_N', 1699, 1));
    dit(r.code === 200 && !(balance.cus_N || []).length && !(balance.cus_A || []).length && !parr[N].refus && parr[N].paye_le, 'D1 aucun compte Vinted relié : ni crédit ni refus (refait à la facture suivante), le paiement est noté', JSON.stringify({ p: parr[N], N: balance.cus_N, A: balance.cus_A }));
    let gN = (await get('aa.bb.N')).corps;
    dit(gN.filleul && gN.filleul.parraine && gN.filleul.attendVinted === true && gN.filleul.offertPar === 'Julie' && !gN.filleul.moisOffert, '  le filleul lit « Offert par Julie » et « relie ton compte Vinted »', JSON.stringify(gN.filleul));
    let gA = (await get('aa.bb.A')).corps;
    dit(Array.isArray(gA.filleuls) && gA.filleuls.length === 1 && gA.filleuls[0].etat === 'paye' && gA.filleuls[0].rang === 1 && /^\d{4}-\d{2}-\d{2}$/.test(gA.filleuls[0].inscritLe), '  le parrain lit « Filleul 1 · a payé son 1er mois » (en vérification)', JSON.stringify(gA.filleuls));
    vinted[N] = [{ vinted_user_id: '5500', login: 'nouvelle_v' }];
    r = await webhook(facture('cus_N', 1699, 2));
    dit(r.code === 200 && (balance.cus_N || []).length === 1 && (balance.cus_A || []).length === 1 && balance.cus_N[0].amount === -1699, 'D2 compte Vinted neuf relié : un mois (16,99 €) à chacun à la facture suivante', JSON.stringify({ N: balance.cus_N, A: balance.cus_A }));
    gA = (await get('aa.bb.A')).corps; gN = (await get('aa.bb.N')).corps;
    dit(gA.filleuls[0].etat === 'offert' && gA.suivi.moisOfferts === 1 && gN.filleul.moisOffert === true, '  « mois offert crédité » chez le parrain, et chez le filleul', JSON.stringify({ f: gA.filleuls, s: gA.suivi, n: gN.filleul }));
    dit(propre(gA) && propre(gN), '  aucune réponse ne porte un uuid, une adresse ou un pseudo/identifiant Vinted');
    // D3 : son compte Vinted a été lu chez un autre compte VRM.
    reset(); delete vinted[N]; code = (await get('aa.bb.A')).corps.code; await rattacher('aa.bb.N', code);
    vinted[N] = [{ vinted_user_id: '5500', login: 'nouvelle_v' }]; harvest['5500'] = [B];
    abos[N] = { statut: 'active', client_stripe: 'cus_N' }; abos[A] = { statut: 'active', client_stripe: 'cus_A' };
    r = await webhook(facture('cus_N', 1699, 1));
    dit(r.code === 200 && !(balance.cus_N || []).length && !(balance.cus_A || []).length && parr[N].refus === 'vinted-deja-vu', 'D3 compte Vinted relié APRÈS, mais déjà lu chez un autre compte VRM : refus rangé, rien crédité', JSON.stringify(parr[N]));
    dit((await get('aa.bb.A')).corps.filleuls[0].etat === 'refuse', '  le parrain lit « Pas retenu »');
    // D4 : un compte Vinted passé du parrain au filleul (son essai gratuit le porte encore).
    reset(); delete vinted[N]; code = (await get('aa.bb.A')).corps.code; await rattacher('aa.bb.N', code);
    vinted[N] = [{ vinted_user_id: '4100', login: 'juju_sneakers' }]; delete vinted[A]; essais = [{ cle: 'vinted:4100', owner: A }];
    abos[N] = { statut: 'active', client_stripe: 'cus_N' }; abos[A] = { statut: 'active', client_stripe: 'cus_A' };
    r = await webhook(facture('cus_N', 1699, 1));
    dit(r.code === 200 && !(balance.cus_N || []).length && !(balance.cus_A || []).length && parr[N].refus === 'vinted-deja-vu', 'D4 compte Vinted déplacé du parrain au filleul (essai du parrain) : refus, rien crédité', JSON.stringify(parr[N]));
    // D5 : lecture muette au paiement ⇒ 503, Stripe rejoue.
    reset(); code = (await get('aa.bb.A')).corps.code; await rattacher('aa.bb.N', code);
    abos[N] = { statut: 'active', client_stripe: 'cus_N' }; abos[A] = { statut: 'active', client_stripe: 'cus_A' };
    pannes.add('harvest'); r = await webhook(facture('cus_N', 1699, 1));
    dit(r.code === 503 && !(balance.cus_N || []).length && !(balance.cus_A || []).length && !parr[N].refus, 'D5 « déjà vu » pas lu au paiement : 503 (Stripe rejoue), rien crédité ni refusé', `HTTP ${r.code}`);
    pannes.clear(); r = await webhook(facture('cus_N', 1699, 1));
    dit(r.code === 200 && (balance.cus_N || []).length === 1 && (balance.cus_A || []).length === 1, '  au rejeu : un mois à chacun', JSON.stringify({ N: balance.cus_N, A: balance.cus_A }));
    // D6 : parrain jamais abonné ⇒ « ton mois t'attend » ; puis il s'abonne, mais le filleul a perdu son compte Vinted : rien.
    reset(); code = (await get('aa.bb.A')).corps.code; await rattacher('aa.bb.N', code);
    abos[N] = { statut: 'active', client_stripe: 'cus_N' };
    await webhook(facture('cus_N', 1699, 1));
    gA = (await get('aa.bb.A')).corps;
    dit((balance.cus_N || []).length === 1 && gA.filleuls[0].etat === 'attente-toi', 'D6 parrain pas encore abonné : « ton mois offert t’attend »', JSON.stringify(gA.filleuls));
    harvest['5500'] = [B]; abos[A] = { statut: 'trialing', client_stripe: 'cus_A' };
    await webhook(facture('cus_A', 0, 2));
    dit(!(balance.cus_A || []).length && parr[N].refus === 'vinted-deja-vu', '  il s’abonne, mais le compte Vinted du filleul est vu ailleurs : son mois n’est pas crédité', JSON.stringify(parr[N]));
    // D7 : le filleul a payé SANS compte Vinted, le parrain s'abonne ensuite : rien n'est refusé (seulement remis).
    reset(); delete vinted[N]; code = (await get('aa.bb.A')).corps.code; await rattacher('aa.bb.N', code);
    abos[N] = { statut: 'active', client_stripe: 'cus_N' };
    await webhook(facture('cus_N', 1699, 1));
    abos[A] = { statut: 'trialing', client_stripe: 'cus_A' };
    await webhook(facture('cus_A', 0, 2));
    dit(!(balance.cus_A || []).length && !parr[N].refus, 'D7 parrain abonné pendant que le filleul n’a pas encore de compte Vinted : rien crédité, RIEN refusé', JSON.stringify(parr[N]));
    vinted[N] = [{ vinted_user_id: '5500', login: 'nouvelle_v' }];
    await webhook(facture('cus_N', 1699, 3));
    dit((balance.cus_N || []).length === 1 && (balance.cus_A || []).length === 1, '  le filleul relie son compte Vinted : un mois à chacun à sa facture suivante', JSON.stringify({ N: balance.cus_N, A: balance.cus_A }));
  });

  console.log('\n── E. Cloisonnement et état sans identité');
  await essaie('E', async () => {
    reset(); const code = (await get('aa.bb.A')).corps.code; await nommer('aa.bb.A', 'Julie'); await rattacher('aa.bb.N', code);
    const gB = (await get('aa.bb.B')).corps;
    dit(Array.isArray(gB.filleuls) && gB.filleuls.length === 0 && gB.suivi.inscrits === 0 && gB.nom === null && gB.code !== code, 'E1 un autre vendeur ne lit RIEN de mes filleuls ni mon nom, et a son propre code', JSON.stringify({ f: gB.filleuls, s: gB.suivi, n: gB.nom }));
    const gA = (await get('aa.bb.A')).corps;
    dit(gA.filleuls.length === 1 && Object.keys(gA.filleuls[0]).sort().join(',') === 'etat,inscritLe,rang' && propre(gA), 'E2 chaque filleul : rang, jour d’inscription, état — rien d’autre', JSON.stringify(gA.filleuls));
    const now = Date.now(), an = new Date(now - 864e5).toISOString();
    const lignes = [...Array(12)].map((_, i) => ({ inscrit: '2026-0' + (1 + (i % 9)) + '-01', paye_le: an, credit_parrain_le: an })).concat([{ inscrit: '2026-11-12', paye_le: an }]);
    const e = P.etatsFilleuls(lignes, true, now);
    dit(e[e.length - 1].etat === 'plafond' && e.filter((x) => x.etat === 'offert').length === 12, 'E3 plafond : le 13e de l’année est dit « plafond atteint », jamais « en attente »', JSON.stringify(e.slice(-2)));
    dit(P.etatsFilleuls([{ inscrit: 'x', refus: 'meme-carte', paye_le: an }], true, now)[0].etat === 'refuse' && P.etatsFilleuls([{ inscrit: 'x' }], true, now)[0].etat === 'inscrit', 'E4 refus ⇒ « Pas retenu » ; rien payé ⇒ « Inscrit »');
    dit(P.emailCanon('J.Ean+x@GoogleMail.com') === 'jean@gmail.com' && P.emailCanon('a.b+c@exemple.fr') === 'a.b@exemple.fr', 'E5 adresse canonique : Gmail sans points ni « + », les autres sans « + »');
  });

  console.log(`\n${ko ? '❌' : '✅'} audit-parrainage-lot54 : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
