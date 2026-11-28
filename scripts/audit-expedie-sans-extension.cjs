#!/usr/bin/env node
require('./_source-app.cjs').brancher();   // Comptabilite vit dans src/ecrans/ : la lecture d'App.jsx rend le texte entier
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT (28 nov.) — UNE VENTE EXPÉDIÉE NE RESTE PAS « À IMPRIMER » SANS L'EXTENSION.
// Julien (28 nov.) : « L'extension n'était pas chargée sur un compte. Une paire VENDUE ET DÉJÀ
// EXPÉDIÉE, VRM me proposait encore d'imprimer le bordereau […] tout doit se mettre à jour
// automatiquement SANS l'extension. J'ai failli me tromper et envoyer une paire. »
//
// Ce qui est EXÉCUTÉ (jamais lu comme du texte, sauf §F) :
//  §A la règle (api/_lib/depart-vente.js) : un e-mail qui porte le n° de la TRANSACTION et dont le sujet
//     CONSTATE le départ ⇒ parti ; un rappel (« Expédiez-le ») ⇒ rien ; daté avant la vente ⇒ rien ;
//     n° inconnu ⇒ rien et rien n'est fabriqué ; la vente FINALISÉE ⇒ partie ; la phrase vient de la preuve ;
//  §B 50 paires identiques (même titre, même taille) : seule celle dont l'IDENTITÉ est prouvée change —
//     par e-mail (n° de transaction), par le scan du transporteur sur le n° de SON étiquette ;
//  §C la vraie route api/email-inbound.js : l'e-mail Vinted « Votre objet a été expédié » (lien
//     /transactions/{tx}, aucun n° de suivi) est rangé avec SON n° de transaction, SORTANT (c'est une de
//     ses ventes), sur SA ligne (deux ventes au même sujet ne partagent plus une ligne) ;
//  §D la vraie route api/widget.js sur la base qu'a écrite §C : le colis sort du widget ;
//  §E le passage de 15 min (api/_lib/colis-frequent.js) : un vendeur qui n'a qu'un colis VENDU pas
//     encore pris en charge est visité (avant : seulement au cron du matin ou app ouverte) ;
//  §F l'app : réimprimer un colis parti demande ; « à confirmer » sur une liste de plus de 24 h.
// `--prouve` : chaque correction réaffaiblie doit rendre ROUGE. Sur l'arbre d'avant (AUDIT_RACINE) : rouge.
// Données INVENTÉES (le dépôt est public) : aucun n°, aucune adresse réels.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'tx-ignore': ['api/_lib/depart-vente.js', "    if (px && !avantVente(px.at)) return out({ type: 'email-tx'", "    if (false) return out({ type: 'email-tx'"],
  'rappel-pris-pour-depart': ['api/_lib/depart-vente.js', "SUJET_CONSTATE_TX.test(s) && !SUJET_PAS_ENCORE_TX.test(s)", "SUJET_CONSTATE_TX.test(s)"],
  'sujet-pas-juge': ['api/_lib/depart-vente.js', "  if (!sujetConstateDepart(sujet)) return null;\n", ''],
  'avant-vente-accepte': ['api/_lib/depart-vente.js', "  const avantVente = (at) => v != null && at != null && at < v - TOLERANCE_AVANT_VENTE_MS;", "  const avantVente = () => false;"],
  'finalisee-ignoree': ['api/_lib/depart-vente.js', "    if (fz && !avantVente(fz.at)) return out({ type: 'finalisee'", "    if (false) return out({ type: 'finalisee'"],
  'route-sans-tx': ['api/email-inbound.js', "        ...(txLigne ? { transaction: txLigne } : {}),\n", ''],
  'route-ligne-partagee': ['api/email-inbound.js', "(txLu && !(track.sansSuivi && track.code) ? `tx${txLu}` : shortHash(", "(false ? '' : shortHash("],
  'tx-pris-pour-suivi': ['api/email-inbound.js', "      if (txLu && track.suivi && String(track.suivi).replace(/\\s+/g, '') === txLu) {", "      if (false) {"],
  'tx-premier-venu': ['api/email-inbound.js', "  return vus.size === 1 ? [...vus][0] : '';", "  return vus.size ? [...vus][0] : '';"],
  'serveur-sans-tx': ['api/_lib/depart-vente.js', "c:meta->>carrier,tx:meta->>transaction';", "c:meta->>carrier';"],
  'frequent-sans-vendus': ['api/_lib/colis-frequent.js', "    `app_data?id=like.email_bord_*&meta->>suivi=not.is.null", "    `app_data?id=like.rien_*&meta->>suivi=not.is.null"],
  'reimpression-silencieuse': ['src/ecrans/Comptabilite.jsx', "    if (!(await confirmerSiDejaParti(tx))) return;\n", ''],
  'fraicheur-ignoree': ['src/ecrans/Comptabilite.jsx', "    if (Number.isFinite(cap) && Date.now() - cap <= ENLIGNE_FRAIS_MS) return null;", "    return null;"],
};
if (process.argv.includes('--prouve')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-expedie-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const s = fs.readFileSync(path.join(t, f), 'utf8');
    if (s.split(de).length !== 2) { console.log(`❌ mutation ${nom} : ancre ${s.includes(de) ? 'pas unique' : 'introuvable'} dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), s.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 240000 });
    const rouges = (String(r.stdout || '').match(/^❌.*$/gm) || []);
    const tombe = r.status !== 0 && rouges.length > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges.length + ' rouge(s) — ' + rouges[0].slice(2, 110) : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 260)); } };
const importer = (p) => import('file://' + path.join(R, p));
const J = (x) => JSON.stringify(x);

// ── L'environnement des routes ──────────────────────────────────────────────
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-expedie';
process.env.CRON_SECRET = 'cle-banc-cron';
delete process.env.VAPID_PRIVATE_KEY; delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;

// ── Une fausse base à état, à la forme de PostgREST (scalaires `meta->>`, projections, filtres) ──
const base = new Map();
let comptesBanc = [{ vinted_user_id: '111' }];
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
const metaDe = (d) => { const m = {}; if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) { if (v == null || typeof v === 'object') continue; const s = String(v); if (s.length <= 600) m[k] = s; } return m; };
const valeur = (l, k) => {
  if (k === 'id') return l.id; if (k === 'owner') return l.owner;
  if (k.startsWith('meta->>')) return metaDe(l.data)[k.slice(7)];
  if (k.startsWith('data->>') || k.startsWith('data->')) { const v = chemin(l.data, k.replace(/^data(->>|->)/, '')); return v == null ? undefined : (typeof v === 'object' ? JSON.stringify(v) : String(v)); }
  return undefined;
};
const teste = (x, op) => {
  const i = op.indexOf('.'); const o = op.slice(0, i), v = op.slice(i + 1);
  if (o === 'eq') return x === v;
  if (o === 'neq') return x != null && x !== v;
  if (o === 'lt') return x != null && x < v;
  if (o === 'gte') return x != null && x >= v;
  if (o === 'like' || o === 'ilike') { const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', o === 'ilike' ? 'i' : ''); return x != null && re.test(x); }
  if (o === 'in') return x != null && v.replace(/^\(|\)$/g, '').split(',').map((y) => y.replace(/^"|"$/g, '')).includes(x);
  if (o === 'is') return v === 'null' ? x == null : true;
  if (o === 'not') { if (v.startsWith('is.null')) return x != null; return x != null && !teste(x, v); }
  return true;
};
const filtrer = (u) => {
  const conds = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'limit', 'order', 'offset', 'or'].includes(k)) continue;
    conds.push((l) => teste(valeur(l, k), v));
  }
  return [...base.entries()].map(([cle, d]) => { const i = cle.indexOf('|'); return { owner: cle.slice(0, i), id: cle.slice(i + 1), data: d }; }).filter((l) => conds.every((c) => c(l)));
};
const projeter = (l, sel) => {
  if (!sel || sel === '*') return { owner: l.owner, id: l.id, data: l.data };
  const o = {};
  for (const part of sel.split(',')) {
    const [alias, ch] = part.includes(':') ? part.split(/:(.+)/) : [part.split(/->>|->/).pop(), part];
    if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
    if (ch === 'data') { o[alias] = l.data; continue; }
    if (ch === 'meta') { o[alias] = metaDe(l.data); continue; }
    if (ch.startsWith('meta->>')) { const v = metaDe(l.data)[ch.slice(7)]; o[alias] = v == null ? null : v; continue; }
    const v = chemin(l.data, ch.replace(/^data(->>|->)/, ''));
    o[alias] = v === undefined ? null : (/->>[^>]*$/.test(ch) && v != null && typeof v !== 'object' ? String(v) : v);
  }
  return o;
};
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname === '/rest/v1/vinted_accounts') return rep(comptesBanc);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') { for (const r of JSON.parse(opts.body || '[]')) base.set(`${r.owner || A}|${r.id}`, r.data); return new Response('', { status: 201 }); }
  if (m !== 'GET') return new Response('', { status: 204 });
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };

// ── LES 50 PAIRES IDENTIQUES (INVENTÉES) ────────────────────────────────────
const H = 3600000, NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const TITRE = 'Nike Dunk Low Panda 42';
const TXS = Array.from({ length: 50 }, (_, i) => String(9100000000 + i));
const CIBLE = TXS[23], CIBLE2 = TXS[31];
const suiviDe = (i) => `XW${String(700000000 + i).padStart(9, '0')}TS`;
const vente = (tx) => ({ transaction_id: Number(tx), title: TITRE, size_title: '42', status: 'Bordereau d’envoi envoyé au vendeur', transaction_user_status: 'needs_action', date: iso(NOW - 30 * H), price: { amount: '60.0', currency_code: 'EUR' } });
const bord = (tx, i) => ({ type: 'bordereau', transaction: tx, suivi: suiviDe(i), numero: '', modele: TITRE, article: TITRE, receivedAt: iso(NOW - 28 * H), filename: `b-${tx}.pdf`, pdfB64: 'JVBERi0x', dateLimite: '' });
const bordsParTx = Object.fromEntries(TXS.map((t, i) => [t, bord(t, i)]));
const ventesMs = Object.fromEntries(TXS.map((t) => [t, NOW - 30 * H]));
const ligne = (o) => ({ type: 'suivi', carrier: 'vinted', suivi: '', status: 'transit', subject: 'Votre objet a été expédié', receivedAt: iso(NOW - 2 * H), emailAt: iso(NOW - 2 * H), ...o });
function poserBase() {
  base.clear(); comptesBanc = [{ vinted_user_id: '111' }];
  base.set(`${A}|vrm_email_owners`, { adresses: { 'boite@banc.test': { owner: A } } });
  base.set(`${A}|main`, { vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_bords_hidden: {}, vrm_colis_collected: [], vinted_accounts_hidden: [], vrm_lbc_colis_done: {}, vrm_vc_colis_done: {}, vrm_vc_numeros: {}, vrm_vc_liens: {} });
  base.set(`${A}|harvest_111_orders_sold`, { capturedAt: iso(NOW - 40 * H), payload: { my_orders: TXS.map(vente) } });
  base.set(`${A}|harvest_111_orders_purchased`, { capturedAt: iso(NOW - 40 * H), payload: { my_orders: [] } });
  base.set(`${A}|panel_accounts_off`, {});
  TXS.forEach((t, i) => base.set(`${A}|email_bord_${t}`, bord(t, i)));
}

(async () => {
  const D = await importer('api/_lib/depart-vente.js');

  // ══ §A LA RÈGLE ═══════════════════════════════════════════════════════════
  await essaie('§A', async () => {
    dit(typeof D.sujetConstateDepart === 'function', 'la règle lit le SUJET d’un e-mail identifié par sa transaction (`sujetConstateDepart`)');
    for (const s of ['Votre objet a été expédié', 'Ton colis est en route', 'Ton colis a été déposé', 'Ta commande a été livrée', 'L’acheteur a bien reçu sa commande'])
      dit(D.sujetConstateDepart(s) === true, `« ${s} » constate un départ`);
    for (const s of ['Vous avez vendu votre objet ! Expédiez-le maintenant', 'N’oublie pas d’expédier ton article', 'Ton bordereau d’envoi', 'Expédie ton article avant le 3 déc.', 'Ton colis sera livré demain', 'Commande annulée', 'Ton colis est-il bien parti ?', 'Rappel : ton colis a été déposé ?', 'Ton remboursement a été envoyé', 'Ta commande a été annulée, ton remboursement a été envoyé', 'Ton article n’est pas encore expédié'])
      dit(D.sujetConstateDepart(s) === false, `« ${s} » ne prouve RIEN (rappel, étiquette, futur, annulation)`);
    const base0 = { bordsParTx, ventesMs };
    const m1 = D.ventesPartiesParPreuve({ ...base0, lignesEmail: [ligne({ transaction: CIBLE })] });
    const r1 = m1.get(CIBLE);
    dit(!!r1 && r1.type === 'email-tx', 'e-mail « expédié » au n° de SA transaction ⇒ partie', J(r1));
    dit(!!r1 && /^E-mail Vinted « en route » du /.test(r1.phrase), 'la phrase vient de la même preuve (« E-mail Vinted « en route » du … »)', r1 && r1.phrase);
    dit(m1.size === 1, 'aucune autre vente ne bouge', `${m1.size} partie(s)`);
    const m2 = D.ventesPartiesParPreuve({ ...base0, lignesEmail: [ligne({ transaction: CIBLE, subject: 'Vous avez vendu votre objet ! Expédiez-le maintenant' })] });
    dit(m2.size === 0, 'un RAPPEL au n° de sa transaction ⇒ rien', `${m2.size}`);
    const m3 = D.ventesPartiesParPreuve({ ...base0, lignesEmail: [ligne({ transaction: CIBLE, emailAt: iso(NOW - 80 * H), receivedAt: iso(NOW - 80 * H) })] });
    dit(m3.size === 0, 'un e-mail daté plus d’un jour AVANT la vente contredit l’identité ⇒ rien', `${m3.size}`);
    const m4 = D.ventesPartiesParPreuve({ ...base0, lignesEmail: [ligne({ transaction: '9999999999' })] });
    dit(m4.size === 0 && !m4.has('9999999999'), 'n° de transaction INCONNU ⇒ rien ne change, aucune vente fabriquée', `${m4.size}`);
    const m5 = D.ventesPartiesParPreuve({ ...base0, lignesEmail: [ligne({ transaction: CIBLE, sens: 'entrant' })] });
    dit(m5.size === 0, 'un e-mail marqué ENTRANT (un achat) ⇒ rien', `${m5.size}`);
    const m6 = D.ventesPartiesParPreuve({ ...base0, finalisees: [{ tx: CIBLE2, at: iso(NOW - H) }] });
    dit(m6.get(CIBLE2) && m6.get(CIBLE2).type === 'finalisee' && m6.size === 1, 'la vente FINALISÉE (e-mail « Transaction finalisée » à SON n°) ⇒ partie, seule', J(m6.get(CIBLE2)));
    dit(D.ventesPartiesParPreuve({ ...base0, lignesEmail: null, finalisees: null }).size === 0, 'preuves illisibles (null) ⇒ rien (« pas su » ne vaut pas « parti »)');
    dit(/meta->>transaction/.test(D.SELECT_PREUVE_EMAIL) && /email_final_/.test(D.REQ_FINALISEES || ''), 'le serveur LIT ces preuves (n° de transaction des e-mails, finalisations), projetées');
  });

  // ══ §B 50 PAIRES IDENTIQUES — LE SCAN DU TRANSPORTEUR SUR LE N° DE SON ÉTIQUETTE ═════
  await essaie('§B', async () => {
    const C = await importer('api/_lib/depart-colis.js');
    const k = suiviDe(23);
    const departs = C.departsParSuivi([{ id: `depart_chronopost_${k}`, suivi: k, carrier: 'chronopost', etat: 'en_route', priseAt: iso(NOW - 3 * H), essai: iso(NOW - H), essaiRes: 'ok', fini: 'true' }]);
    const m = D.ventesPartiesParPreuve({ bordsParTx, ventesMs, departs });
    dit(m.size === 1 && m.get(CIBLE) && m.get(CIBLE).type === 'transporteur', '50 paires au même titre : le scan Chronopost du n° de SON étiquette ne fait partir QUE la sienne', J([...m.keys()]));
    dit(/Chronopost l’a pris en charge le /.test((m.get(CIBLE) || {}).phrase || ''), '« Chronopost l’a pris en charge le … »', (m.get(CIBLE) || {}).phrase);
    const autre = C.departsParSuivi([{ id: 'depart_chronopost_XW999999999TS', suivi: 'XW999999999TS', carrier: 'chronopost', etat: 'en_route', priseAt: iso(NOW - 3 * H) }]);
    dit(D.ventesPartiesParPreuve({ bordsParTx, ventesMs, departs: autre }).size === 0, 'un n° qui n’est l’étiquette d’aucune vente ⇒ rien');
  });

  // ══ §C LA VRAIE ROUTE email-inbound ═════════════════════════════════════════
  const inbound = await importer('api/email-inbound.js');
  const recoit = async (subject, tx, o = {}) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-expedie' }, body: {
    from: 'Vinted <shipping@relay.vinted.com>', to: 'boite@banc.test', subject,
    text: `${subject}\nBonne nouvelle : ton article « ${TITRE} » est en route vers ton acheteur.\nVoir la commande : https://www.vinted.fr/transactions/${tx}\n`, html: '', attachments: [], ...o } }, res); return res; };
  await essaie('§C', async () => {
    dit(typeof inbound.txDuTexteEmail === 'function' && inbound.txDuTexteEmail('lien https://www.vinted.fr/transactions/9100000023 et transaction_id=9100000023') === '9100000023', 'le n° de transaction est lu dans l’e-mail (`txDuTexteEmail`)');
    dit(inbound.txDuTexteEmail && inbound.txDuTexteEmail('/transactions/9100000023 puis /transactions/9100000031') === '', 'deux n° différents dans un e-mail ⇒ aucun (jamais choisi)');
    poserBase();
    const r = await recoit('Votre objet a été expédié', CIBLE);
    const r2 = await recoit('Votre objet a été expédié', CIBLE2);
    const lignes = [...base.entries()].filter(([k]) => k.includes('|email_track_'));
    const l1 = lignes.find(([, d]) => d && d.transaction === CIBLE), l2 = lignes.find(([, d]) => d && d.transaction === CIBLE2);
    dit((r.code === 200 || r.code == null) && !!l1, 'la route range l’e-mail AVEC le n° de SA transaction', `${r.code} ${J(r.corps).slice(0, 140)} · ${lignes.map(([k]) => k.split('|')[1]).join(',')}`);
    dit(!!l1 && String(l1[1].suivi || '') !== CIBLE, 'le n° de la transaction n’est jamais pris pour un n° de suivi', l1 && J(l1[1].suivi));
    dit(!!l1 && l1[1].sens === 'sortant', 'c’est une de SES ventes (son bordereau est là) ⇒ SORTANT (jamais « à retirer » chez lui)', l1 && l1[1].sens);
    dit(!!l1 && !!l2 && l1[0] !== l2[0], 'deux ventes au MÊME sujet ont chacune SA ligne (la seconde n’efface pas la première)', lignes.map(([k]) => k.split('|')[1]).join(','));
    // Le serveur relit ces lignes comme le widget le fera (projection + relecture).
    const lu = await D.lirePreuvesDepart(async (p) => { const u = new URL('https://x.supabase.co/rest/v1/' + p); return filtrer(u).map((l) => projeter(l, u.searchParams.get('select') || '')); });
    const m = D.ventesPartiesParPreuve({ bordsParTx, ventesMs, lignesEmail: lu.lignesEmail });
    dit(m.has(CIBLE) && m.has(CIBLE2) && m.size === 2, 'relues par le serveur : les DEUX ventes expédiées sont parties, les 48 autres attendent', `${m.size} · ${[...m.keys()].join(',')}`);
    // Un e-mail au n° inconnu, un rappel : rien.
    poserBase();
    await recoit('Votre objet a été expédié', '9999999999');
    await recoit('Vous avez vendu votre objet ! Expédiez-le maintenant', TXS[5]);
    const lu2 = await D.lirePreuvesDepart(async (p) => { const u = new URL('https://x.supabase.co/rest/v1/' + p); return filtrer(u).map((l) => projeter(l, u.searchParams.get('select') || '')); });
    dit(D.ventesPartiesParPreuve({ bordsParTx, ventesMs, lignesEmail: lu2.lignesEmail }).size === 0, 'n° inconnu, rappel « Expédiez-le » ⇒ AUCUNE vente ne change');
  });

  // ══ §D LA VRAIE ROUTE widget ═══════════════════════════════════════════════
  await essaie('§D', async () => {
    const w = (await importer('api/widget.js')).default;
    const lire = async () => { const res = faireRes(); await w({ method: 'GET', headers: {}, query: {} }, res); return res.corps && res.corps.ship ? res.corps.ship : null; };
    poserBase();
    const avant = await lire();
    dit(avant && avant.vinted === 50, 'widget : 50 colis à expédier (liste Vinted figée, extension absente)', J(avant));
    await recoit('Votre objet a été expédié', CIBLE);
    const apres = await lire();
    dit(apres && apres.vinted === 49, 'e-mail « expédié » reçu (rien relu sur Vinted) ⇒ le widget en compte 49 : SEULE la paire de CE n° de transaction sort', J(apres));
    poserBase();
    base.set(`${A}|email_final_tx${CIBLE2}`, { type: 'finalisation', subject: 'Transaction finalisée', transaction: CIBLE2, receivedAt: iso(NOW - H) });
    const fin = await lire();
    dit(fin && fin.vinted === 49, 'vente FINALISÉE (e-mail à SON n°) ⇒ le widget en compte 49', J(fin));
  });

  // ══ §E LE PASSAGE DE 15 MIN ═══════════════════════════════════════════════
  await essaie('§E', async () => {
    const F = await importer('api/_lib/colis-frequent.js');
    const B = 'aaaaaaaa-0000-0000-0000-000000000001', Cc = 'aaaaaaaa-0000-0000-0000-000000000002', Dd = 'aaaaaaaa-0000-0000-0000-000000000003';
    base.clear();
    base.set(`${B}|email_bord_9100000001`, { type: 'bordereau', transaction: '9100000001', suivi: 'XW700000001TS', receivedAt: iso(NOW - 5 * H) });   // bordereau frais, jamais lu
    base.set(`${Cc}|depart_chronopost_XW700000002TS`, { suivi: 'XW700000002TS', carrier: 'chronopost', essai: iso(NOW - 3 * H), essaiRes: 'passu', fini: false });   // pas pris, essai passé
    base.set(`${Dd}|email_bord_9100000003`, { type: 'bordereau', transaction: '9100000003', suivi: 'XW700000003TS', receivedAt: iso(NOW - 10 * 86400000) });   // vieux : pas de visite pour lui
    const lire = async (q) => { const u = new URL('https://x.supabase.co/rest/v1/' + q); return filtrer(u).map((l) => projeter(l, u.searchParams.get('select') || '')); };
    const vus = F.vendeursDus(await Promise.all(F.requetesColisDus(NOW).map(lire)));
    dit(Array.isArray(vus) && vus.includes(B), 'un vendeur dont le bordereau de vente vient d’arriver est visité toutes les 15 min (sa 1re lecture chez le transporteur)', J(vus));
    dit(Array.isArray(vus) && vus.includes(Cc), 'un colis vendu pas encore pris en charge, essai passé son rythme ⇒ visité', J(vus));
    dit(Array.isArray(vus) && !vus.includes(Dd), 'un vieux bordereau sans ligne de départ ne fait pas visiter (fenêtre bornée)', J(vus));
    const q = F.requetesColisDus(NOW).join(' ');
    dit(!/select=data\b/.test(q) && (q.match(/select=owner/g) || []).length === F.requetesColisDus(NOW).length, 'sélections projetées sur `owner` (§4.4)');
  });

  // ══ §F L'APP ═══════════════════════════════════════════════════════════════
  await essaie('§F', async () => {
    const src = fs.readFileSync(path.join(R, 'src/ecrans/Comptabilite.jsx'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    const corps = (nom) => { const i = src.indexOf(`const ${nom} = async`); return i < 0 ? '' : src.slice(i, i + 900); };
    dit(/const confirmerSiDejaParti = async \(tx\) => \{\s*const r = tx \? partisVinted\.get\(String\(tx\)\) : null;\s*if \(!r\) return true;/.test(src) && /askConfirm\(\{ title: tr\('envois\.dejaParti\.titre'\)/.test(src), 'réimprimer : la règle unique du départ (`partisVinted`) ⇒ « Ce colis est déjà parti le … », SON « Imprimer quand même »');
    dit(/confirmerSiDejaParti\(tx\)/.test(corps('imprimerBordereauVente')) && /confirmerSiDejaParti\(e && e\.txn\)/.test(corps('imprimerColisVinted')) && (src.match(/confirmerSiDejaParti\(e && e\.txn\)\)\) return; if \(b && b\.hasPdf && inv\)/g) || []).length === 3, 'chaque geste « Imprimer » d’une vente passe par la demande (Ventes, Colis, la rangée, la carte)');
    dit(/const fraicheurVentesColis = \(o\) =>/.test(src) && /_harvestSeen\[`\$\{acc\.vinted_user_id\}_orders_sold`\]/.test(src) && /ENLIGNE_FRAIS_MS\) return null;/.test(src), '« à envoyer » d’une liste de plus de 24 h (la règle « en ligne ») ⇒ « à confirmer » et le geste');
    dit((src.match(/fraicheurVentesColis\(o\)/g) || []).length >= 3, 'dit sur la carte, la rangée et la colonne de Colis', String((src.match(/fraicheurVentesColis\(o\)/g) || []).length));
    dit(/finalisees: versements && typeof versements === 'object' \? versements : null/.test(src), 'l’app passe la vente finalisée (date de versement) à la règle');
    for (const l of ['fr', 'en', 'es', 'it', 'de']) {
      let t = ''; try { t = fs.readFileSync(path.join(R, `src/i18n/langues/${l}/envois.js`), 'utf8'); } catch (_) {}
      dit(['envois.dejaParti.titre', 'envois.dejaParti.desc', 'envois.dejaParti.ok', 'envois.aConfirmer', 'envois.aConfirmerGeste'].every((k) => t.includes(`"${k}"`)), `textes traduits (${l})`);
    }
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ tout est vert');
  process.exit(ko ? 1 : 0);
})();
