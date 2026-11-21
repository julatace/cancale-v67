#!/usr/bin/env node
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
// AUDIT (1er nov.) — LES CODES DE RETRAIT, DE BOUT EN BOUT.
// Julien : « la fiabilité des codes de retrait, c'est super important ». Un code
// faux ou manquant : il se déplace au relais pour rien, ou ne peut pas retirer.
//
// Il EXÉCUTE les vraies fonctions, jamais une copie :
//   A. `parseCarrierEmail` (api/email-inbound.js) sur un corpus d'e-mails
//      INVENTÉS à la forme des vrais (Mondial Relay, Chronopost Pickup et ses
//      consignes, Vinted Go, Relais Colis, HTML et entités) : chaque cas porte le
//      code attendu, ou « aucun » ;
//   B. `relireLigneSuivi` (api/_lib/suivi-colis.js) sur des lignes DÉJÀ rangées
//      (elles ne sont jamais réécrites : l'app, le widget et le rappel les relisent) ;
//   C. la vraie route `api/email-inbound` sur une fausse base à état : l'ordre de
//      traitement n'est pas l'ordre des e-mails (le script Gmail lit du plus
//      récent au plus ancien) — le code le plus récent pour CE n° doit gagner ;
//   D. les règles de l'app (src/App.jsx, extraites par Babel) qui fondent deux
//      lignes « disponible » du même n° de suivi (`fusionLignesMemeSuivi`) ;
//   E. le vrai background.js de l'extension dans un `vm` (scripts/_fond-vm.cjs) :
//      `retraitDeConversation` (rappel sans code, colis redirigé, nouveau code)
//      et `noterRetrait` (une relecture sans code n'efface pas le code rangé).
// `--prouve` : réaffaiblit chaque correction, chacune doit rendre ROUGE.
// §6.1 : lancé sur l'arbre d'avant (AUDIT_RACINE=<arbre>), il est rouge.
// Données INVENTÉES (le dépôt est public) : aucun code, n° ni adresse réels.
require('./_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'pin-dans-les-mots': ['api/email-inbound.js', '|\\bpin\\b)[\\s*_', '|pin)[\\s*_'],
  'ligne-suivante-libre': ['api/_lib/code-retrait-email.js', "  if (!/\\n/.test(s.slice(m.index, debut))) return true;", '  return true;'],
  'deux-codes-premier': ['api/email-inbound.js', 'let code = codesLus.length === 1 ? codesLus[0] : null;', 'let code = codesLus[0] || null;'],
  'code-egal-suivi': ['api/_lib/code-retrait-email.js', "  if (su && su === c) return 'suivi';", ''],
  'code-postal-du-lieu': ['api/_lib/code-retrait-email.js', '  if (/^\\d{5}$/.test(c) && new RegExp', '  if (false && new RegExp'],
  'identifiant-tronque': ['api/email-inbound.js', 'identifiant${DECOR}[:：]?${DECOR}(\\\\d{3,8})(?!\\\\d)`', 'identifiant${DECOR}[:：]?${DECOR}(\\\\d{3,8})`'],
  'vinted-go-une-lettre': ['api/email-inbound.js', '([A-Z]{1,2}\\d{3,10}|\\d{4,10})\\b/i);', '([A-Z]\\d{3,10})\\b/i);'],
  'ordre-emails-ignore': ['api/email-inbound.js', "if (plusAncien && prevLigne.status === 'available'", "if (false && plusAncien && prevLigne.status === 'available'"],
  'relecture-sans-garde': ['api/_lib/suivi-colis.js', 'if (codeLu(d.code) && codeImpossible(d.code, d))', 'if (false && codeImpossible(d.code, d))'],
  'fusion-perd-qr': ['src/App.jsx', 'const qrSrc = qrImage(src) ? src : (memeCode && qrImage(autre)) ? autre : {};', 'const qrSrc = m;'],
  'fusion-perd-identifiant': ['src/App.jsx', 'code2: src.code2 || (memeCode ? autre.code2 : null) || null,', 'code2: src.code2 || null,'],
  'fusion-qr-ancien-code': ['src/App.jsx', 'const memeCode = !codeRetrait(src.code)', 'const memeCode = true || !codeRetrait(src.code)'],
  'fusion-plus-complet': ['src/App.jsx', 'const neuf = !!(cm && cs && cm !== cs && quand(s) > quand(m));', 'const neuf = false;'],
  'conv-rappel-efface': ['vinted-sync-extension/background.js', 'for (let i = arrivees.length - 2; i >= 0 &&', 'for (let i = -1; i >= 0 &&'],
  'conv-autre-relais': ['vinted-sync-extension/background.js', '      if (!lieuxCompatibles(fin.lieu, e.lieu)) break;\n', ''],
  'noter-efface-code': ['vinted-sync-extension/background.js', 'if (avant && !r.code && avant.code && lieuxCompatibles(r.lieu, avant.lieu))', 'if (false)'],
};
if (process.argv.includes('--prouve')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-codes-'));
    for (const x of ['api', 'src', 'vinted-sync-extension', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (!src.includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    const tombe = r.status !== 0 && rouges > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.message || e).slice(0, 200)); } };
const importer = (p) => import('file://' + path.join(R, p));

// ── Une fausse base à état, à la forme de PostgREST (celle d'audit-retrait-fiable) ──
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-codes';
delete process.env.VAPID_PRIVATE_KEY;
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const base = new Map();
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
const vraiFetch = global.fetch;
const fauxFetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    const prefer = String((opts.headers && (opts.headers.Prefer || opts.headers.prefer)) || '');
    const faites = [];
    for (const r of JSON.parse(opts.body || '[]')) {
      const cle = `${r.owner || A}|${r.id}`;
      if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue;
      base.set(cle, r.data); faites.push({ id: r.id });
    }
    return /return=representation/.test(prefer) ? rep(faites, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') {
    const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
    const own = (u.searchParams.get('owner') || '').replace(/^eq\./, '') || A;
    const rev = u.searchParams.get('data->>rev');
    const cle = `${own}|${id}`;
    if (!base.has(cle)) return rep([]);
    const d = base.get(cle) || {};
    const ok = rev === 'is.null' ? (d.rev == null) : (rev && rev.startsWith('eq.') ? String(d.rev) === rev.slice(3) : true);
    if (!ok) return rep([]);
    base.set(cle, JSON.parse(opts.body || '{}').data);
    return rep([{ id }]);
  }
  if (m !== 'GET') return rep([]);
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
  const idp = u.searchParams.get('id') || '';
  const own = (u.searchParams.get('owner') || '').replace(/^eq\./, '') || null;
  const exact = idp.startsWith('eq.') ? idp.slice(3) : null;
  const like = idp.startsWith('like.') ? new RegExp('^' + idp.slice(5).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$') : null;
  const filtresMeta = [...u.searchParams.entries()].filter(([k]) => /^meta->>/.test(k)).map(([k, v]) => [k.slice(7), v.replace(/^eq\./, '')]);
  const lignes = [...base.entries()].map(([k, d]) => { const i = k.indexOf('|'); return { owner: k.slice(0, i), id: k.slice(i + 1), data: d }; })
    .filter((l) => (!own || l.owner === own) && (exact ? l.id === exact : like ? like.test(l.id) : true))
    .filter((l) => filtresMeta.every(([k, v]) => { const x = String(l.data && l.data[k]); const mm = /^in\.\((.*)\)$/.exec(v); return mm ? mm[1].split(',').map((y) => y.replace(/^"|"$/g, '')).includes(x) : x === v; }));
  if (sel && sel !== 'data' && sel !== 'id,data' && sel !== 'owner,data') {
    return rep(lignes.map((l) => {
      const o = {};
      for (const part of sel.split(',')) {
        const [alias, ch] = part.includes(':') ? part.split(':') : [part.split(/->>|->/).pop(), part];
        if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
        if (/^meta->>/.test(ch)) { const v = l.data ? l.data[ch.slice(7)] : undefined; o[alias] = v == null ? null : (typeof v === 'object' ? null : String(v)); continue; }
        const v = chemin(l.data, ch.replace(/^data(->>|->)/, ''));
        o[alias] = v === undefined ? null : v;
      }
      return o;
    }));
  }
  return rep(lignes);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };

// ── Les règles de l'app, extraites telles quelles (Babel) ───────────────────
function chargeApp(noms, injecte) {
  const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
  const src = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
  const ast = parser.parse(src, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const t = {};
  for (const n of ast.program.body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && noms.includes(d.id.name)) t[d.id.name] = 'const ' + src.slice(d.start, d.end) + ';';
  }
  const ctx = { ...injecte }; vm.createContext(ctx);
  for (const nom of noms) { if (!t[nom]) { ctx['__absent_' + nom] = true; continue; } try { vm.runInContext(t[nom] + `\nthis.${nom}=${nom};`, ctx); } catch (e) { ctx['__err_' + nom] = e.message; } }
  return ctx;
}

// ── A. LE CORPUS D'E-MAILS ──────────────────────────────────────────────────
// [nom, transporteur, sujet, texte, code attendu (null = aucun), code2 attendu (undefined = non jugé), html]
const CORPUS = [
  // — Ce qui marche et doit continuer de marcher —
  ['Mondial Relay : « Votre code de retrait : 123456 »', 'mondialrelay', 'Votre colis 38230001 est disponible', "Bonjour,\nVotre colis 38230001 est disponible.\n\nPOINT RELAIS®\nTABA'TEST\n12 Rue Exemple\n56000 Vannes\n\nRETRAIT JUSQU'AU 26/10\n\nVotre code de retrait : 123456\n", '123456'],
  ['Mondial Relay : libellé et code dans deux cases de tableau (ligne suivante, nombre SEUL)', 'mondialrelay', 'Votre colis 38230002 est disponible', 'Code de retrait :\n482913\n\nPOINT RELAIS\nLE TEST\n3 Rue Exemple\n35000 Rennes\n', '482913'],
  ['code qui commence par 0 : gardé tel quel', 'mondialrelay', 'Votre colis 38230003 est disponible', 'Votre code de retrait : 012345\n', '012345'],
  ['espace insécable (&nbsp;) entre le libellé et le code', 'mondialrelay', 'Votre colis 38230004 est disponible', 'Votre code de retrait\u00a0:\u00a0654321\n', '654321'],
  ['« Votre code de retrait EST 715204 »', 'mondialrelay', 'Votre colis 38230005 est disponible', 'Votre code de retrait est 715204\n', '715204'],
  ['Chronopost Pickup : « code de retrait suivant au commer&ccedil;ant : » (HTML, entité)', 'chronopost', 'Votre colis VINTED est arrivé en relais Pickup', '', '731204', undefined,
    '<p>Votre colis XW611500001TS est arrivé en relais Pickup.</p><p>Communiquez le code de retrait suivant au commer&ccedil;ant&nbsp;: 731204</p><p>TERRA TEST<br>11 RUE EXEMPLE<br>56000 VANNES</p>'],
  ['Chronopost consigne : identifiant ET code d’ouverture (gras de la version texte)', 'chronopost', 'Votre colis XW611500002TS est arrivé en consigne Pickup', 'Identifiant : *8156*\nCode d’ouverture : *9539*\n', '9539', '8156'],
  ['Vinted Go : « Saisis le code suivant : X12345 » (une lettre)', 'vinted', 'Ton colis est arrivé à la consigne Vinted Go #1790000000000001', "Ton colis t'attend à la consigne Vinted Go.\nSaisis le code suivant : X12345\nNuméro de suivi : 1790000000000001\n", 'X12345'],
  ['le mot « suivant » n’est jamais un code', 'chronopost', 'Votre colis XW611500003TS est arrivé en relais Pickup', 'Communiquez le code de retrait suivant au commerçant :\nsuivant\n', null],
  ['« code de retrait » sans nombre : aucun code', 'mondialrelay', 'Votre colis 38230006 est disponible', 'Présentez votre code de retrait et une pièce d’identité.\n', null],
  ['« Code postal : 56000 » n’est jamais un code', 'mondialrelay', 'Votre colis 38230007 est disponible', 'Code postal : 56000\n', null],
  ['un code à lettre « O » au lieu de zéro n’est pas lu (blanc plutôt qu’un faux)', 'mondialrelay', 'Votre colis 38230008 est disponible', 'Votre code de retrait : 12O456\n', null],
  ['le même code écrit deux fois (sujet et corps) reste UN code', 'mondialrelay', 'Votre colis 38230009 est disponible — code de retrait 246810', 'Votre code de retrait : 246810\n', '246810'],
  // — Les défauts trouvés (rouges sur le code d'avant) —
  ['DÉFAUT : libellé seul, code dans l’image du QR, adresse dessous ⇒ « 56000 » n’est PAS le code', 'mondialrelay', 'Votre colis 38230010 est disponible', 'Présentez votre code de retrait\n56000 Vannes\n', null],
  ['DÉFAUT : « Code : » puis « 35260 CANCALE » à la ligne ⇒ aucun code', 'mondialrelay', 'Votre colis 38230011 est disponible', 'Code :\n35260 CANCALE\n', null],
  ['DÉFAUT : « pin » DANS un mot (« Offre Lapin 2026 ») au-dessus du vrai code', 'mondialrelay', 'Votre colis 38230012 est disponible', 'Offre Lapin 2026\nVotre code de retrait : 123456\n', '123456'],
  ['DÉFAUT : deux codes DIFFÉRENTS dans un e-mail ⇒ aucun (on ne sait pas lequel est celui de ce n°)', 'mondialrelay', 'Vos colis sont disponibles', 'Colis 38230013 — code de retrait : 111111\nColis 38230014 — code de retrait : 222222\n', null],
  ['DÉFAUT : le « code » est le n° de suivi du colis ⇒ aucun', 'mondialrelay', 'Votre colis est disponible', 'Votre code de retrait :\n38230015\n', null],
  ['DÉFAUT : identifiant de casier à 9 chiffres TRONQUÉ à 8 ⇒ aucun identifiant', 'chronopost', 'Votre colis XW611500004TS est arrivé en consigne Pickup', 'Identifiant : 123456789\nCode d’ouverture : 9539\n', '9539', null],
  ['DÉFAUT : code d’ouverture à 9 chiffres TRONQUÉ à 8 ⇒ aucun code', 'chronopost', 'Votre colis XW611500005TS est arrivé en consigne Pickup', 'Identifiant : 8156\nCode d’ouverture : 953912345\n', null, '8156'],
  ['DÉFAUT (manqué) : Vinted Go, code tout en chiffres après « saisis le code suivant »', 'vinted', 'Ton colis est arrivé à la consigne Vinted Go #1790000000000002', "Ton colis t'attend à la consigne Vinted Go.\nSaisis le code suivant : 493417\nNuméro de suivi : 1790000000000002\n", '493417'],
  ['DÉFAUT (manqué) : Vinted Go, code à DEUX lettres', 'vinted', 'Ton colis est arrivé à la consigne Vinted Go #1790000000000003', "Ton colis t'attend à la consigne Vinted Go.\nSaisis le code suivant : CA4934\nNuméro de suivi : 1790000000000003\n", 'CA4934'],
];

(async () => {
  await essaie('A. corpus d’e-mails (vraie parseCarrierEmail)', async () => {
    const { parseCarrierEmail } = await importer('api/email-inbound.js');
    for (const [nom, carrier, subject, text, attendu, attendu2, html] of CORPUS) {
      const r = parseCarrierEmail({ from: 'noreply@banc.test', subject, text: text || '', html: html || '' }, carrier, '2026-10-21T10:00:00.000Z');
      const okCode = (r.code || null) === attendu;
      const ok2 = attendu2 === undefined || (r.code2 || null) === attendu2;
      dit(okCode && ok2, `A ${nom} ⇒ ${attendu === null ? 'aucun code' : attendu}${attendu2 !== undefined ? ' + ' + (attendu2 || 'aucun identifiant') : ''}`, `lu « ${r.code || ''} »${r.code2 ? ' + « ' + r.code2 + ' »' : ''}`);
      if (attendu === null && r.status === 'available') dit(!!r.extraitCode || !/code|pin|identifiant/i.test(text + (html || '')), `A ${nom} : sans code, les lignes « code » sont gardées pour l’écran (« code pas lu »)`, String(r.extraitCode || '').slice(0, 80));
    }
  });

  await essaie('B. lignes déjà rangées (vraie relireLigneSuivi)', async () => {
    const { relireLigneSuivi } = await importer('api/_lib/suivi-colis.js');
    const ligne = (o) => ({ type: 'suivi', carrier: 'mondialrelay', status: 'available', statusLabel: 'Arrivé au point de retrait', subject: 'Votre colis est disponible', receivedAt: '2026-10-21T10:00:00.000Z', ...o });
    const a = relireLigneSuivi(ligne({ suivi: '38230020', code: '56000', lieu: 'TABA’TEST, 12 Rue Exemple, 56000 Vannes' }));
    dit(!a.code, 'B ligne rangée avec le CODE POSTAL du lieu comme code (« 56000 ») ⇒ plus montré', `code « ${a.code || ''} »`);
    const b = relireLigneSuivi(ligne({ suivi: '38230021', code: '38230021' }));
    dit(!b.code, 'B ligne rangée avec le N° DE SUIVI comme code ⇒ plus montré', `code « ${b.code || ''} »`);
    const c = relireLigneSuivi(ligne({ suivi: '38230022', code: '482913', lieu: 'LE TEST, 3 Rue Exemple, 35000 Rennes' }));
    dit(c.code === '482913', 'B un vrai code reste (il n’est ni le suivi ni le code postal)', `code « ${c.code || ''} »`);
    const d = relireLigneSuivi(ligne({ suivi: '38230023', code: '35000', lieu: 'LE TEST, 3 Rue Exemple, 56000 Vannes' }));
    dit(d.code === '35000', 'B un code à 5 chiffres qui n’est PAS le code postal du lieu reste', `code « ${d.code || ''} »`);
  });

  await essaie('C. vraie route : le code le plus récent pour CE n° gagne', async () => {
    global.fetch = fauxFetch;
    try {
      base.clear();
      base.set(`${A}|vrm_email_owners`, { adresses: { 'boite@banc.test': { owner: A } } });
      const inbound = await importer('api/email-inbound.js');
      const recoit = async (subject, text, quand, sourceDate) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-codes' }, __recuLe: quand, body: { from: 'Mondial Relay <noreply@mondialrelay.fr>', to: 'boite@banc.test', subject, text, html: '', attachments: [], ...(sourceDate ? { sourceDate } : {}) } }, res); return res; };
      const ligne = (suivi) => { const e = [...base.entries()].find(([k]) => new RegExp(`\\|email_track_.*_${suivi}$`).test(k)); return e ? e[1] : {}; };
      const mr = (suivi, nom, rue, cpVille, limite, code) => `Bonjour,\nVotre colis ${suivi} est disponible.\n\nPOINT RELAIS®\n${nom}\n${rue}\n${cpVille}\n\nRETRAIT JUSQU'AU ${limite}\n\nVotre code de retrait : ${code}\n`;
      // 1. Ordre inversé (le script Gmail lit du plus récent au plus ancien) : le 23 (relais B, code 222222) traité AVANT le 21 (relais A, code 111111).
      const r1 = await recoit('Votre colis 38230030 est disponible', mr('38230030', 'RELAIS BETA', '9 Rue Exemple', '56000 Vannes', '28/10', '222222'), '2026-10-25T08:00:00.000Z', '2026-10-23T09:00:00.000Z');
      const r2 = await recoit('Votre colis 38230030 est disponible', mr('38230030', 'RELAIS ALPHA', '1 Rue Exemple', '56000 Vannes', '26/10', '111111'), '2026-10-25T08:00:05.000Z', '2026-10-21T09:00:00.000Z');
      const l1 = ligne('38230030');
      dit(r1.code === 200 && r2.code === 200 && l1.code === '222222', 'C e-mail PLUS ANCIEN traité après le plus récent : le code reste celui du plus récent (222222)', `code « ${l1.code} »`);
      dit(/BETA/i.test(String(l1.lieu || '')) && l1.limite === '2026-10-28', 'C …et le lieu et la date limite aussi (relais B, 28/10) — Julien n’est pas envoyé au relais A', `${l1.lieu} · ${l1.limite}`);
      // 2. Dans l'ordre : le plus récent remplace (inchangé).
      await recoit('Votre colis 38230031 est disponible', mr('38230031', 'RELAIS ALPHA', '1 Rue Exemple', '56000 Vannes', '26/10', '111111'), '2026-10-21T09:00:05.000Z', '2026-10-21T09:00:00.000Z');
      await recoit('Votre colis 38230031 est disponible', mr('38230031', 'RELAIS BETA', '9 Rue Exemple', '56000 Vannes', '28/10', '222222'), '2026-10-23T09:00:05.000Z', '2026-10-23T09:00:00.000Z');
      dit(ligne('38230031').code === '222222', 'C dans l’ordre : le nouveau code remplace l’ancien (inchangé)', `code « ${ligne('38230031').code} »`);
      // 3. Un rappel plus ancien SANS code ne vide rien (inchangé).
      await recoit('Votre colis 38230032 est disponible', mr('38230032', 'RELAIS ALPHA', '1 Rue Exemple', '56000 Vannes', '26/10', '333333'), '2026-10-22T09:00:05.000Z', '2026-10-22T09:00:00.000Z');
      await recoit('Votre colis 38230032 est disponible', 'Votre colis 38230032 est disponible.\n', '2026-10-22T09:00:09.000Z', '2026-10-21T09:00:00.000Z');
      dit(ligne('38230032').code === '333333', 'C un e-mail sans code ne vide pas le code rangé (inchangé)', `code « ${ligne('38230032').code} »`);
    } finally { global.fetch = vraiFetch; }
  });

  await essaie('D. app : deux lignes « disponible » du même n° (fusionLignesMemeSuivi)', async () => {
    // (10 nov.) La fusion note ce que chaque ligne disait du code (src/sourcesRetrait.js, importé par l'app).
    let injecte = {}; try { const sr = await importer('src/sourcesRetrait.js'); injecte = { codeLuDeLigne: sr.codeLuDeLigne }; } catch (_) {}
    // (14 nov.) `qrImage` passe par la règle partagée du QR prouvé (api/_lib/qr-retrait.js), importée par l'app.
    try { const qr = await importer('api/_lib/qr-retrait.js'); injecte.urlQrDuColis = qr.urlQrDuColis; } catch (_) {}
    const app = chargeApp(['URL_PAS_UN_QR', 'codeRetrait', 'URL_QR_CERTAIN', 'qrEnHttps', 'qrImage', 'titleCasePR', 'TYPE_LIEU', 'cleanLieuCorps', 'cleanLieu', 'scoreLigneRetrait', 'fusionLignesMemeSuivi'], injecte);
    const f = app.fusionLignesMemeSuivi, sc = app.scoreLigneRetrait;
    dit(typeof f === 'function' && typeof sc === 'function', 'D la fusion de deux lignes du même n° est une règle de l’app (exécutable)', app.__absent_fusionLignesMemeSuivi ? 'absente' : (app.__err_fusionLignesMemeSuivi || ''));
    if (typeof f !== 'function') return;
    const fusion = (a, b) => { const [m, s] = sc(b) > sc(a) ? [b, a] : [a, b]; return f(m, s); };
    // Vinted (code + lieu : 6) contre Chronopost consigne (code d'ouverture + identifiant + Pickup Pass, sans lieu : 5).
    const vinted = { carrier: 'vinted', suivi: 'XW611500040TS', status: 'available', code: '9539', lieu: 'TERRA TEST, 11 Rue Exemple, 56000 Vannes', receivedAt: '2026-10-22T11:00:00.000Z', emailAt: '2026-10-22T11:00:00.000Z' };
    const chrono = { carrier: 'chronopost', suivi: 'XW611500040TS', status: 'available', code: '9539', code2: '8156', consigne: true, qrUrl: 'https://banc.test/api/barcode/AztecCode?d=PICKUPPASS:TEST', receivedAt: '2026-10-22T11:01:00.000Z', emailAt: '2026-10-22T11:01:00.000Z' };
    const g = fusion(vinted, chrono);
    dit(g.code === '9539' && g.code2 === '8156', 'D l’identifiant du casier de l’autre ligne n’est pas perdu (au casier, il faut les deux)', `${g.code} + ${g.code2 || '—'}`);
    dit(!!app.qrImage(g) && g.consigne === true, 'D le Pickup Pass (QR) de l’autre ligne n’est pas perdu, ni « consigne »', `${g.qrUrl || '—'} · consigne ${g.consigne}`);
    dit(/TERRA/i.test(g.lieu || ''), 'D le lieu reste', g.lieu);
    // Deux codes différents : le plus récent gagne, même s'il est sur la ligne la moins complète.
    const ancien = { carrier: 'chronopost', suivi: 'XW611500041TS', status: 'available', code: '111111', lieu: 'RELAIS ALPHA, 1 Rue Exemple, 56000 Vannes', qrUrl: 'https://banc.test/api/barcode/AztecCode?d=A', receivedAt: '2026-10-21T09:00:00.000Z', emailAt: '2026-10-21T09:00:00.000Z' };
    const recent = { carrier: 'vinted', suivi: 'XW611500041TS', status: 'available', code: '222222', receivedAt: '2026-10-23T09:00:00.000Z', emailAt: '2026-10-23T09:00:00.000Z' };
    const h = fusion(ancien, recent);
    dit(h.code === '222222', 'D deux codes différents pour le même n° : le PLUS RÉCENT gagne (un nouveau code a été émis), pas le « plus complet »', `code « ${h.code} »`);
    dit(!app.qrImage(h) || h.qrUrl !== ancien.qrUrl, 'D …et le QR de l’ANCIEN code n’est pas montré à côté du nouveau', h.qrUrl || '—');
    const k = fusion({ ...ancien, code: '111111' }, { ...recent, code: '111111' });
    dit(k.code === '111111' && /ALPHA/i.test(k.lieu || '') && !!app.qrImage(k), 'D le même code des deux côtés : la ligne la plus complète garde son lieu et son QR (inchangé)', `${k.code} · ${k.lieu}`);
  });

  await essaie('E. extension : conversation Vinted (vrai background.js)', async () => {
    const { faireFond } = require(path.join(__dirname, '_fond-vm.cjs'));
    const f = faireFond({ src: path.join(R, 'vinted-sync-extension', 'background.js'), lignes: {} });
    const X = f.ctx;
    const conv = (msgs) => ({ conversation: { id: 900000001, conversation_url: 'https://www.vinted.fr/inbox/900000001',
      transaction: { id: 800000001, item_id: 700000001, item_title: 'Baskets banc 42', current_user_side: 'buyer' }, messages: msgs } });
    const act = (title, subtitle, ts) => ({ entity_type: 'action_message', created_at_ts: ts, entity: { title, subtitle } });
    const ARRIVE = (code, lieu) => act('Ton colis est arrivé !', `Il t'attend à l'adresse suivante : ${lieu}. <a href="https://banc.test/qr/${code}">Scanne ton code de retrait</a> ou saisis le code ${code} pour le récupérer.`, '2026-10-21T10:00:00+02:00');
    const RAPPEL = (lieu) => act('N’oublie pas ton colis', `Rends-toi au ${lieu} pour récupérer ta commande avant le 27/10.`, '2026-10-24T10:00:00+02:00');
    const KUSMI = 'Kusmi Test, 13 Rue Exemple, 56000 Vannes, France';
    const r1 = X.retraitDeConversation(conv([ARRIVE('C65735', KUSMI), RAPPEL('point relais Kusmi Test')]));
    dit(!!r1 && r1.code === 'C65735', 'E un RAPPEL sans code après le message d’arrivée : le code reste (C65735)', r1 ? `code « ${r1.code} » · ${r1.lieu}` : 'null');
    dit(!!r1 && /banc\.test\/qr\/C65735/.test(r1.qr || ''), 'E …et le lien du QR qui va avec', r1 ? r1.qr : 'null');
    const r2 = X.retraitDeConversation(conv([ARRIVE('C11111', KUSMI), act('Ton colis est arrivé !', "Il t'attend à l'adresse suivante : Phone Test, 17 Rue Autre, 35000 Rennes, France.", '2026-10-24T10:00:00+02:00')]));
    dit(!!r2 && r2.code === '' && /Phone Test/.test(r2.lieu), 'E colis REDIRIGÉ vers un autre relais (message sans code) : l’ancien code n’est PAS repris', r2 ? `code « ${r2.code} » · ${r2.lieu}` : 'null');
    const r3 = X.retraitDeConversation(conv([ARRIVE('C11111', KUSMI), ARRIVE('C22222', KUSMI)]));
    dit(!!r3 && r3.code === 'C22222' && /C22222/.test(r3.qr || ''), 'E un NOUVEAU code dans un message plus récent remplace l’ancien (et son QR)', r3 ? `code « ${r3.code} » · ${r3.qr}` : 'null');
    const r4 = X.retraitDeConversation(conv([ARRIVE('C65735', KUSMI)]));
    dit(!!r4 && r4.code === 'C65735' && /Kusmi Test/.test(r4.lieu), 'E un seul message d’arrivée : code et lieu (inchangé)', r4 ? `${r4.code} · ${r4.lieu}` : 'null');
    // noterRetrait : une relecture qui ne voit pas le code ne l'efface pas.
    const T = '800000002';
    f.lignes.panel_colis_relais = { [T]: { tx: T, code: 'C33333', qr: 'https://banc.test/qr/C33333', lieu: KUSMI, transporteur: 'vinted', at: new Date().toISOString() } };
    await X.noterRetrait({ tx: T, code: '', qr: '', lieu: 'point relais Kusmi Test', transporteur: '', at: new Date().toISOString() }, '111');
    const e1 = (f.lignes.panel_colis_relais || {})[T] || {};
    dit(e1.code === 'C33333' && e1.qr === 'https://banc.test/qr/C33333', 'E noterRetrait : une relecture SANS code (même point) n’efface pas le code rangé', `code « ${e1.code || ''} »`);
    await X.noterRetrait({ tx: T, code: '', qr: '', lieu: 'Phone Test, 17 Rue Autre, 35000 Rennes', transporteur: '', at: new Date().toISOString() }, '111');
    const e2 = (f.lignes.panel_colis_relais || {})[T] || {};
    dit(!e2.code && /Phone Test/.test(e2.lieu || ''), 'E noterRetrait : un AUTRE point sans code ⇒ l’ancien code n’est pas gardé', `code « ${e2.code || ''} » · ${e2.lieu}`);
    await X.noterRetrait({ tx: T, code: 'C44444', qr: '', lieu: 'Phone Test, 17 Rue Autre, 35000 Rennes', transporteur: '', at: new Date().toISOString() }, '111');
    dit(((f.lignes.panel_colis_relais || {})[T] || {}).code === 'C44444', 'E noterRetrait : un code neuf est rangé (inchangé)');
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ tous les contrôles des codes de retrait sont verts');
  process.exit(ko ? 1 : 0);
})();
