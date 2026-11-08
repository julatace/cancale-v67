#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DES PARCOURS — LES DÉFAUTS A5 À A9, A11 À A14 (1er novembre 2026)
//  (node scripts/audit-flux-divers.cjs · --prouve : chaque mutation doit rougir)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « fais tout comme un pro, il ne doit y avoir aucune erreur possible ».
// L'audit des parcours métier (achat → vente → compta) a relevé des défauts que
// ce fichier EXÉCUTE (les vraies fonctions, jamais une copie) :
//   A5  la notification « double vente » Leboncoin vise la ligne de SON N°
//       (`src/cibleNotif.js`), jamais un repli sur la première ligne ;
//   A6  « Vendus ailleurs » compare les N° par leur clé (`cleNum`) : « 007 » = « 7 »,
//       « B 125 » = « B125 », un lot « 12+15 » désigne les deux cartons ;
//   A7  le conseil d'une offre reçue par email : un prix trouvé par le TITRE
//       n'est jamais présenté comme sûr, l'ambiguïté se juge avant d'écarter
//       les fiches sans prix (la vraie route `api/email-inbound`) ;
//   A8  « Reçu ce mois » du widget : la ligne publiée est re-datée par une
//       lecture complète (le widget juge une lecture, pas un changement) ;
//   A9  « Déclarer perdue » et le récapitulatif ne promettent plus un numéro
//       « libéré » ni une perte « dans ta compta » ;
//   A11 une vente Leboncoin datée à la main n'a pas d'heure (« Quand tu vends ») ;
//   A12 une seule règle « pas une vente » : `classifyOrderStatus` ⇔ `PAS_UNE_VENTE` ;
//   A13 aucune réponse rapide « toujours disponible » sous une annonce prouvée partie ;
//   A14 le serveur ne rapatrie plus `vinted_sales_hidden` (plus lue nulle part).
// Données INVENTÉES (le dépôt est public).
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
const lire = (p) => fs.readFileSync(path.join(R, p), 'utf8');
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const MUTATIONS = {
  'cible-repli-premiere-ligne': ['src/cibleNotif.js', "(n ? [`[data-lbc-retirer-num~=\"${q(n)}\"]`] : ['[data-lbc-retirer-bloc]'])", "(n ? [`[data-lbc-retirer-num~=\"${q(n)}\"]`, '[data-lbc-retirer]'] : ['[data-lbc-retirer-bloc]'])"],
  'cible-id-leboncoin': ['src/cibleNotif.js', "(n ? [`[data-lbc-retirer-num~=\"${q(n)}\"]`]", "(n ? [`[data-lbc-retirer=\"${q(n)}\"]`]"],
  'cible-sans-cle': ['src/cibleNotif.js', "const n = c.num ? cleNumCible(c.num) : '';", "const n = c.num ? String(c.num) : '';"],
  'ligne-sans-cle': ['src/App.jsx', ".split('+').map(cleNum).filter(Boolean).join(' ') || undefined) : undefined}", ".trim() || undefined) : undefined}"],
  'vendus-texte-brut': ['src/bilanSynchronisation.js', 'export const cleNumSync = (v) => cleNum(v);', 'export const cleNumSync = (v) => String(v == null ? "" : v).trim().toLowerCase();'],
  'vendus-lot-entier': ['src/bilanSynchronisation.js', '.split("+").map(cleNumSync)', '.split("§").map(cleNumSync)'],
  'vendus-lot-ambigu-ignore': ['src/bilanSynchronisation.js', 'return g.every(Boolean) ? g : null;', 'return g.some(Boolean) ? g.filter(Boolean) : null;'],
  'offre-ambigu-apres-prix': ['api/email-inbound.js', "const memes = Object.values(map || {}).filter((e) => e && norm(e.title) === t);", "const memes = Object.values(map || {}).filter((e) => e && norm(e.title) === t && e.buyPrice != null && String(e.buyPrice).trim() !== '');"],
  'offre-accepte-chiffre': ['api/email-inbound.js', "      const advice = phraseConseilOffre(juge, offerAmt);", "      const advice = buy != null && !isNaN(offerAmt) ? ` → ✅ Accepte : +${Math.round(offerAmt - buy)} € net (achat ${Math.round(buy)} €)` : phraseConseilOffre(juge, offerAmt);"],
  'urssaf-sur-changement': ['src/App.jsx', "if (!memeChose || !fraiche) save('vinted_urssaf_mois'", "if (!memeChose) save('vinted_urssaf_mois'"],
  'perdue-libere': ['src/App.jsx', "`• Son N°${n} reste le sien : il n'est jamais redonné à une autre paire.\\n` +", "`• Son numéro sera libéré (plus compté en stock).\\n` +"],
  'recap-libere': ['src/App.jsx', "elle est sortie du stock et sa case au garage est vidée. Son numéro n'est jamais redonné à une autre paire.", "son numéro est libéré et sa case au garage vidée."],
  'lbc-heure-midi': ['src/App.jsx', "heureLue: !(v.dateSaisie === true || /^\\d{4}-\\d{2}-\\d{2}$/.test(String(v.dateVente).trim())) });", "});"],
  'echoue-vendue': ['src/App.jsx', "  if (/[ée]chou/i.test(s)) return 'cancelled';\n", ''],
  'rapides-disponible': ['src/App.jsx', "const rapidesDuFil = (liste, partie) => (partie ? (liste || []).filter((q) => !REPONSE_DISPONIBLE.test(String(q && q.t || ''))) : liste);", "const rapidesDuFil = (liste, partie) => liste;"],
  'rapides-sans-regle': ['src/App.jsx', "    if (offrePartieDuFil(oc)) return true;\n    const tr = oc.conversation.transaction || {}, it = tr.item_id;", "    if (offrePartieDuFil(oc)) return true;\n    return false;\n    const tr = oc.conversation.transaction || {}, it = tr.item_id;"],
  'widget-masquees': ['api/widget.js', "'vinted_bords_shipped', 'vinted_urssaf_mois'", "'vinted_bords_shipped', 'vinted_sales_hidden', 'vinted_urssaf_mois'"],
};
if (process.argv.includes('--prouve')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-flux-'));
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
const APP = require("./_source-app.cjs").sourceApp();
const CODE = sansCommentaires(APP);

// Les déclarations de l'app, extraites telles quelles (Babel) et exécutées.
function chargeApp(noms, injecte = {}) {
  const parser = require(path.join(R, 'node_modules', '@babel', 'parser'));
  const ast = parser.parse(APP, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true });
  const t = {};
  for (const n of ast.program.body) {
    if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id && noms.includes(d.id.name)) t[d.id.name] = 'const ' + APP.slice(d.start, d.end) + ';';
    if (n.type === 'FunctionDeclaration' && n.id && noms.includes(n.id.name)) t[n.id.name] = APP.slice(n.start, n.end);
  }
  const ctx = { ...injecte }; vm.createContext(ctx);
  for (const nom of noms) { if (!t[nom]) throw new Error(nom + ' introuvable dans App.jsx'); vm.runInContext(t[nom] + `\nthis.${nom}=${nom};`, ctx); }
  return ctx;
}

// ── Une fausse base PostgREST, pour la vraie route des emails ───────────────
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-flux';
delete process.env.VAPID_PRIVATE_KEY;
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
const base = new Map();
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
const fauxFetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  if (m === 'POST') {
    const prefer = String((opts.headers && (opts.headers.Prefer || opts.headers.prefer)) || '');
    for (const r of JSON.parse(opts.body || '[]')) { const cle = `${r.owner || A}|${r.id}`; if (/ignore-duplicates/.test(prefer) && base.has(cle)) continue; base.set(cle, r.data); }
    return new Response('', { status: 201 });
  }
  if (m !== 'GET') return rep([]);
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
  const idp = u.searchParams.get('id') || '';
  const exact = idp.startsWith('eq.') ? idp.slice(3) : null;
  const like = idp.startsWith('like.') ? new RegExp('^' + idp.slice(5).replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$') : null;
  const lignes = [...base.entries()].map(([k, d]) => { const i = k.indexOf('|'); return { owner: k.slice(0, i), id: k.slice(i + 1), data: d }; })
    .filter((l) => (exact ? l.id === exact : like ? like.test(l.id) : true));
  if (sel && sel !== 'data' && sel !== 'id,data' && sel !== 'owner,data') {
    return rep(lignes.map((l) => { const o = {}; for (const part of sel.split(',')) { const [alias, ch] = part.includes(':') ? part.split(':') : [part.split(/->>|->/).pop(), part]; if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; } const v = chemin(l.data, ch.replace(/^(data|meta)(->>|->)/, '')); o[alias] = v === undefined ? null : v; } return o; }));
  }
  return rep(lignes);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };

(async () => {
  // ── A5. La notification « double vente » vise SA ligne ─────────────────────
  await essaie('A5 cible de la notification', async () => {
    const { selecteursCible, lireCible, cleNumCible } = await importer('src/cibleNotif.js');
    const { cleNum } = chargeApp(['cleNum']);
    const ech = ['007', '7', 'b125', 'B 125', 'B-125', ' 40 ', '012', 'C3'];
    dit(typeof cleNumCible === 'function' && ech.every((x) => cleNumCible(x) === cleNum(x)), 'A5 la clé du N° de la cible est celle de l’app (`cleNum`)', typeof cleNumCible === 'function' ? ech.map((x) => x + '→' + cleNumCible(x)).join(' ') : 'absente');
    const lbc = selecteursCible(lireCible({ cible: 'doublon', plat: 'leboncoin', num: '40' }));
    // (5 nov.) Le crochet `data-cible` (jeton « doublon:leboncoin:40 ») passe en premier ; la règle
    // reste : CHAQUE sélecteur nomme le N°40, aucun ne vise un bloc ni « la première ligne ».
    const nommeN = (l, n) => l.length > 0 && l.every((x) => new RegExp('(~="|="|:)' + n + '"\\]$').test(x) && !/bloc|a-retirer/.test(x));
    dit(nommeN(lbc.essais, '40') && lbc.essais.includes('[data-lbc-retirer-num~="40"]') && lbc.essais.includes('[data-cible~="doublon:leboncoin:40"]'), 'A5 Leboncoin avec un N° : SEULE la ligne de ce N° répond (aucun repli sur la première ligne)', JSON.stringify(lbc.essais));
    const lbc7 = selecteursCible(lireCible({ cible: 'doublon', plat: 'leboncoin', num: '007' }));
    dit(nommeN(lbc7.essais, '7') && lbc7.essais.includes('[data-lbc-retirer-num~="7"]'), 'A5 « 007 » vise la ligne du N°7', JSON.stringify(lbc7.essais));
    const eb = selecteursCible(lireCible({ cible: 'doublon', plat: 'ebay', num: '117' }));
    dit(nommeN(eb.essais, '117'), 'A5 eBay avec un N° : seules les lignes de ce N° répondent (vendue sur Vinted ou sur Leboncoin)', JSON.stringify(eb.essais));
    const nu = selecteursCible(lireCible({ cible: 'doublon', plat: 'leboncoin' }));
    dit(nu.essais.length > 0 && nu.essais.every((x) => x === '[data-cible~="doublon:leboncoin"]' || x === '[data-lbc-retirer-bloc]'), 'A5 sans N° (aucune identité) : le BLOC où se règle la double vente, pas une ligne', JSON.stringify(nu.essais));
    // La ligne de l'app porte la clé de CHACUN de ses N°, sur les seules lignes vendues.
    dit(/data-lbc-retirer-num=\{pausable \? \(String\(r\.numero == null \? '' : r\.numero\)\.split\('\+'\)\.map\(cleNum\)\.filter\(Boolean\)\.join\(' '\) \|\| undefined\) : undefined\}/.test(CODE),
      'A5 la ligne Leboncoin porte `data-lbc-retirer-num` = la clé de chacun de ses N° (lot éclaté), sur les lignes VENDUES seulement');
    dit(/data-lbc-retirer-bloc="vinted"/.test(CODE) && /data-lbc-retirer-bloc="ebay"/.test(CODE), 'A5 les deux cartes « à retirer de Leboncoin » portent le bloc visé sans N°');
    // Le N° envoyé par le serveur est une clé (`numerosDeVente` → `cleNum`).
    const { notificationDoubleVente } = await importer('api/_lib/double-vente.js');
    const n = notificationDoubleVente([{ numero: '40', plateforme: 'leboncoin', annonces: [{ id: '329' }] }], 'Paire');
    const p = new URLSearchParams(n.url.split('?')[1]);
    dit(p.get('cible') === 'doublon' && p.get('plat') === 'leboncoin' && p.get('num') === '40', 'A5 l’adresse de la notification porte le N° (clé), que la cible lit', n.url);
  });

  // ── A6. « Vendus ailleurs » par la clé du N° ───────────────────────────────
  await essaie('A6 Vendus ailleurs', async () => {
    const { articlesVendusAilleurs, cleNumSync } = await importer('src/bilanSynchronisation.js');
    const { cleNum } = chargeApp(['cleNum']);
    const ech = ['007', 'b125', 'B 125', 'B-125', ' 40 ', '0', 'C3'];
    dit(typeof cleNumSync === 'function' && ech.every((x) => cleNumSync(x) === cleNum(x)), 'A6 la clé de « Vendus ailleurs » est celle de l’app (`cleNum`)');
    const v = (id, numero, plateforme) => ({ id, numero, plateforme, engagee: true });
    const a = (id, numero, plateforme) => ({ id, numero, plateforme, compte: 'c', active: true });
    let r = articlesVendusAilleurs({ numeros: { 333: { numero: '007' } }, ventes: [v('L1', '7', 'Leboncoin')], annonces: [a('333', '007', 'Vinted')] });
    dit(r.lignes.length === 1 && r.lignes[0].numero === '7', 'A6 fiche « 007 » vendue sur Leboncoin (réf « 7 ») ⇒ à retirer de Vinted', JSON.stringify(r));
    r = articlesVendusAilleurs({ numeros: { 444: { numero: 'B 125' } }, ventes: [v('E1', 'B125', 'eBay')], annonces: [a('444', 'b125', 'Vinted')] });
    dit(r.lignes.length === 1 && r.lignes[0].numero === 'B125', 'A6 « B 125 » / « b125 » / « B125 » : le même carton', JSON.stringify(r));
    r = articlesVendusAilleurs({ numeros: { 12: { numero: '12' }, 15: { numero: '15' } }, ventes: [v('L2', '12+15', 'Leboncoin')], annonces: [a('12', '12', 'Vinted'), a('15', '15', 'Vinted')] });
    dit(r.lignes.length === 2, 'A6 un lot « 12+15 » vendu sur Leboncoin fait sortir les DEUX annonces Vinted', JSON.stringify(r.lignes.map((x) => x.numero)));
    r = articlesVendusAilleurs({ numeros: { 12: { numero: '12' }, 99: { numero: '12' }, 15: { numero: '15' } }, ventes: [v('L3', '15', 'Leboncoin')], annonces: [a('x', '12+15', 'eBay')] });
    dit(r.lignes.length === 0 && r.ambigus === 1, 'A6 un lot dont UN N° est porté par deux paires est ambigu (rien deviné, compté)', JSON.stringify(r));
    r = articlesVendusAilleurs({ numeros: { 1: { numero: '7' } }, ventes: [v('L4', '17', 'Leboncoin')], annonces: [a('1', '7', 'Vinted')] });
    dit(r.lignes.length === 0, 'A6 « 17 » ne désigne jamais la « 7 »');
  });

  // ── A7. Le conseil d'une offre reçue par email ────────────────────────────
  await essaie('A7 conseil d’offre (vraie route)', async () => {
    global.fetch = fauxFetch;
    const inbound = await importer('api/email-inbound.js');
    const { jugerPrixParTitre, phraseConseilOffre } = inbound;
    const F = (t, b) => ({ title: t, ...(b != null ? { buyPrice: b } : {}) });
    await essaie('A7 règles pures', async () => {
    dit(jugerPrixParTitre('Nike Air Max 90', { 1: F('Nike Air Max 90', 40), 2: F('nike  air max 90') }).etat === 'ambigu',
      'A7 deux fiches du même titre, l’une SANS prix ⇒ ambigu (jugé avant d’écarter les fiches sans prix)');
    dit(jugerPrixParTitre('Nike Air Max 90', { 1: F('Nike Air Max 90', 40), 2: F('Nike Air Max 90', 40) }).etat === 'ambigu', 'A7 deux fiches du même titre au même prix ⇒ ambigu quand même (deux paires)');
    const u = jugerPrixParTitre('Nike Air Max 90', { 1: F('Nike Air Max 90', '40,5') });
    dit(u.etat === 'unique' && u.prix === 40.5, 'A7 une seule fiche, prix connu ⇒ proposition « unique »', JSON.stringify(u));
    dit(jugerPrixParTitre('Nike Air Max 90', { 1: F('Nike Air Max 90') }).etat === 'sans-prix', 'A7 une seule fiche sans prix ⇒ rien de chiffré');
    const phrases = [phraseConseilOffre(u, 60), phraseConseilOffre({ etat: 'ambigu', n: 2 }, 60), phraseConseilOffre(null, 60), phraseConseilOffre({ etat: 'sans-prix' }, 60)];
    dit(phrases.every((p) => !/Accepte|Refuse|net\b|\+\s*\d/.test(p)), 'A7 aucune phrase ne dit « Accepte : +X € net » ni « Refuse »', phrases.join(' | '));
    dit(/reconnue au titre seulement/.test(phrases[0]) && /vérifie que c'est elle/.test(phrases[0]), 'A7 le prix trouvé au titre est dit comme une proposition à vérifier', phrases[0]);
    dit(/paires portent ce titre/.test(phrases[1]), 'A7 ambigu ⇒ la phrase le dit et envoie à la conversation', phrases[1]);
    });
    // La vraie route, sur un email d'offre : deux paires du titre, une sans prix.
    base.clear();
    base.set(`${A}|vrm_email_owners`, { adresses: { 'boite@banc.test': { owner: A } } });
    base.set(`${A}|main`, { vinted_annonce_numeros: { 5001: F('Nike Air Max 90 blanche', 40), 5002: F('Nike Air Max 90 blanche') } });
    const recoit = async (texte) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-flux' }, body: { from: 'Vinted <no-reply@vinted.fr>', to: 'boite@banc.test', subject: 'Nouvelle offre', text: texte, html: '', attachments: [] } }, res); return res; };
    let res = await recoit("acheteuse_banc t'a fait une offre de 60 € pour « Nike Air Max 90 blanche »\n");
    const offres = [...base.entries()].filter(([k]) => /\|email_offer_/.test(k)).map(([, d]) => d);
    dit(res.code === 200 && res.corps && res.corps.type === 'offre', 'A7 la route range l’email comme une offre', JSON.stringify(res.corps).slice(0, 160));
    dit(offres.length === 1 && offres[0].buy == null && offres[0].net == null, 'A7 titre porté par deux paires (une sans prix) ⇒ ni prix d’achat ni « net » rangés', JSON.stringify(offres[0] || {}).slice(0, 200));
    base.set(`${A}|main`, { vinted_annonce_numeros: { 5001: F('Nike Air Max 90 blanche', 40) } });
    res = await recoit("autre_banc t'a fait une offre de 55 € pour « Nike Air Max 90 blanche »\n");
    const o2 = [...base.entries()].filter(([k]) => /\|email_offer_/.test(k)).map(([, d]) => d).find((d) => d.qui === 'autre_banc' || d.montant === '55');
    dit(o2 && o2.buy === 40 && o2.buySur === 'titre' && o2.net == null, 'A7 une seule fiche : le prix est rangé MARQUÉ « reconnu au titre », jamais un « net » présenté comme sûr', JSON.stringify(o2 || {}).slice(0, 200));
    const tE = sansCommentaires(lire('api/email-inbound.js'));
    dit(!/Accepte\s*:\s*\+/.test(tE) && !/findBuyPriceByTitle/.test(tE), 'A7 plus aucun « Accepte : +X € net » dans la route');
  });

  // ── A8. Le widget juge une LECTURE, pas un changement ──────────────────────
  await essaie('A8 Reçu ce mois', async () => {
    const W = await importer('api/widget.js');
    const ym = (t) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }).slice(0, 7);
    const now = Date.parse('2026-11-01T09:00:00Z');
    const ligne = { mois: [], recu: { '2026-10': 812 }, sources: { Vinted: 'lu', Leboncoin: 'lu', eBay: 'lu' }, at: now - 3600e3 };
    const r = W.recuDuMoisPublie(ligne, ym(now), now);
    dit(r.received === 0 && r.receivedRaison == null, 'A8 le 1er du mois, une ligne lue ce mois sans versement ⇒ « 0 € reçu », pas « — »', JSON.stringify(r));
    const m = /const URSSAF_REDATE_MS = ([^;]+);/.exec(CODE);
    const ms = m ? Function('return ' + m[1])() : NaN;
    dit(Number.isFinite(ms) && ms > 0 && ms < W.RECU_MAX_AGE_MS / 2, 'A8 une lecture complète re-date la ligne bien avant le seuil du widget', `${ms} ms < ${W.RECU_MAX_AGE_MS / 2}`);
    dit(/const fraiche = Number\.isFinite\(atAvant\) && maintenant - atAvant < URSSAF_REDATE_MS && moisParis\(atAvant\) === moisParis\(maintenant\);/.test(CODE) && /if \(!memeChose \|\| !fraiche\) save\('vinted_urssaf_mois', \{ \.\.\.charge, at: maintenant \}\);/.test(CODE),
      'A8 la ligne est republiée si elle CHANGE, ou si elle est vieille de plus de 6 h, ou d’un autre mois');
  });

  // ── A9. Ce que « Déclarer perdue » fait vraiment ───────────────────────────
  await essaie('A9 perdue', async () => {
    const perdue = (/const markPairLost = async[\s\S]*?\n  \};/.exec(CODE) || [''])[0];
    dit(perdue.length > 100, 'A9 `markPairLost` se lit');
    dit(!/lib[ée]r/i.test(perdue) && !/comme perte/i.test(perdue), 'A9 « Déclarer perdue » ne promet ni un numéro « libéré » ni une perte « dans ta compta »');
    dit(/jamais redonné/.test(perdue) && /ne compte aucune perte/.test(perdue), 'A9 elle dit ce qui se passe : N° jamais redonné, aucune perte comptée');
    dit(!/num[ée]ro est lib[ée]r|num[ée]ro sera lib[ée]r|dans ta compta comme perte/i.test(CODE), 'A9 nulle part dans l’app un numéro « libéré » ni une perte promise');
    const lus = (CODE.match(/vinted_pairs_lost/g) || []).length;
    dit(lus > 0 && !/pairsLost[\s\S]{0,80}(benefice|bénéfice|perte)/i.test(CODE), 'A9 aucun calcul ne lit les paires perdues comme une perte (la phrase n’en promet plus)');
  });

  // ── A11. Une date posée à la main n'a pas d'heure ─────────────────────────
  await essaie('A11 heure des ventes Leboncoin', async () => {
    const V = await importer('api/_lib/ventes-regle.js');
    const { quandTuVends } = await importer('src/statsVentes.js');
    const lbc = [
      { isSeller: true, txId: 't1', price: 5000, dateVente: '2026-10-20T12:00:00', dateSaisie: true },
      { isSeller: true, txId: 't2', price: 5000, dateVente: '2026-10-21' },
      { isSeller: true, txId: 't3', price: 5000, dateVente: '2026-10-22T18:42:10.000Z' },
    ];
    const { lignes } = V.ventesFaites({ vinted: [], lbc, ebay: [] });
    dit(lignes.length === 3 && lignes[0].heureLue === false && lignes[1].heureLue === false && lignes[2].heureLue === true, 'A11 datée à la main ou sans heure ⇒ `heureLue: false` ; lue avec son heure ⇒ true', JSON.stringify(lignes.map((l) => l.heureLue)));
    const q = quandTuVends(lignes, Date.parse('2026-10-30T10:00:00Z'));
    dit(q && q.sansHeure === 2 && q.heures[12].n === 0 && q.avecHeure === 1, 'A11 « Quand tu vends » : aucune vente datée à la main dans la case « 12 h »', JSON.stringify({ sansHeure: q && q.sansHeure, h12: q && q.heures[12].n }));
    const ftApp = (/const ventesFaites = \(\{[\s\S]*?\n\};/.exec(APP) || [''])[0];
    dit(/heureLue: !\(v\.dateSaisie === true/.test(ftApp), 'A11 la règle vit dans `ventesFaites` de l’app (la copie serveur est refabriquée)');
  });

  // ── A12. Une seule règle « pas une vente » ────────────────────────────────
  await essaie('A12 pas une vente', async () => {
    const { classifyOrderStatus, PAS_UNE_VENTE } = chargeApp(['classifyOrderStatus', 'PAS_UNE_VENTE']);
    const ext = /const PAS_UNE_VENTE = (\/[^\n]*\/[a-z]*);/.exec(lire('vinted-sync-extension/background.js'));
    dit(ext && ext[1] === PAS_UNE_VENTE.toString(), 'A12 `PAS_UNE_VENTE` : la même expression dans l’app et l’extension', ext && ext[1]);
    const S = ['Le paiement a été validé', 'Commande finalisée', 'Commande annulée', 'La commande a été annulée', 'Remboursement effectué', 'Retour initié', 'Retournée à l’expéditeur',
      'Transaction suspendue', 'Le paiement a échoué', 'La livraison a échoué', 'Échec du paiement', 'Commande refusée', 'Cancelled', 'Colis déposé en point relais', 'Livré', 'Commande expédiée',
      'Commande non réclamée', 'La vérification a échoué', 'En attente du bordereau', ''];
    // (2 nov., extension 5.310) L'écart « Échec du paiement » (mot « échec », pas
    // « échoué ») est aligné : `PAS_UNE_VENTE` le dit pas vendu, comme Ventes et la
    // compta. Plus AUCUN écart toléré.
    const ecarts = S.filter((s) => (classifyOrderStatus(s) === 'cancelled') !== PAS_UNE_VENTE.test(s));
    dit(ecarts.length === 0, 'A12 `classifyOrderStatus(s) === "cancelled"` ⇔ `PAS_UNE_VENTE.test(s)` sur chaque état (revenue d’un côté = pas vendue de l’autre)', ecarts.join(' · '));
    const V = await importer('api/_lib/ventes-regle.js');
    dit(S.every((s) => V.classifyOrderStatus(s) === classifyOrderStatus(s)), 'A12 la copie serveur (`api/_lib/ventes-regle.js`) dit la même chose');
  });

  // ── A13. Pas de « toujours disponible » sous une annonce partie ───────────
  await essaie('A13 réponses rapides', async () => {
    const X = chargeApp(['DEFAULT_QUICK_REPLIES', 'QUICK_REPLIES', 'listeRapides', 'REPONSE_DISPONIBLE', 'rapidesDuFil']);
    const toutes = [X.listeRapides(X.DEFAULT_QUICK_REPLIES), X.QUICK_REPLIES, X.listeRapides(['Toujours dispo !', 'Merci 🙂'])];
    dit(toutes.every((l) => l.some((q) => /disponible|dispo/i.test(q.t))), 'A13 chaque liste de départ a bien une réponse « disponible » (le contrôle peut échouer)');
    dit(toutes.every((l) => X.rapidesDuFil(l, true).every((q) => !/disponible|\bdispo\b/i.test(q.t)) && X.rapidesDuFil(l, true).length === l.length - l.filter((q) => /disponible|\bdispo\b/i.test(q.t)).length),
      'A13 annonce prouvée partie ⇒ aucune réponse « disponible », les autres restent');
    dit(toutes.every((l) => X.rapidesDuFil(l, false) === l), 'A13 « pas su » ou en vente ⇒ la liste entière');
    const { annonceOffreEnVente } = await importer('src/offresVinted.js');
    const lecture = { enLigne: new Set(), aConfirmer: new Set(), masquees: new Set(), brouillons: new Set(), lues: { 111: Date.parse('2026-10-30T10:00:00Z') }, ko: new Set() };
    const off = (ts) => ({ item: '9001', side: 'seller', ts });
    dit(annonceOffreEnVente(off(Date.parse('2026-10-29T10:00:00Z')), '111', lecture) === 'non' && annonceOffreEnVente(off(Date.parse('2026-10-31T10:00:00Z')), '111', lecture) === null && annonceOffreEnVente(off(null), '111', lecture) === null,
      'A13 la règle juge par identité : absente d’une lecture complète APRÈS la dernière activité ⇒ partie ; sinon pas su');
    // La fonction du fil, EXÉCUTÉE (extraite du composant) avec les vraies règles.
    const corpsFil = (/const annonceDuFilPartie = \(oc\) => \{[\s\S]*?\n  \};/.exec(APP) || [''])[0];
    const { majAuGeste } = await importer('src/conversationsRetirees.js');
    const ctxFil = { annonceOffreEnVente, majAuGeste, lectureOffres: lecture, offrePartieDuFil: () => null, Date, Number, String };
    vm.createContext(ctxFil);
    let fil = null; try { vm.runInContext(corpsFil + '\nthis.f = annonceDuFilPartie;', ctxFil); fil = ctxFil.f; } catch (e) { fil = null; }
    const oc = (ts) => ({ acc: { vinted_user_id: 111 }, inboxUpdatedAt: ts, messages: [], conversation: { transaction: { item_id: 9001, current_user_side: 'seller' } } });
    dit(typeof fil === 'function' && fil(oc('2026-10-29T10:00:00Z')) === true && fil(oc('2026-10-31T10:00:00Z')) === false && fil(oc(null)) === false && fil({ ...oc('2026-10-29T10:00:00Z'), conversation: { transaction: { item_id: 9001, current_user_side: 'buyer' } } }) === false,
      'A13 `annonceDuFilPartie` (exécutée) : partie seulement si une lecture complète APRÈS la dernière activité ne la montre plus ; sinon, et côté acheteur, pas su');
    dit(/const annonceDuFilPartie = \(oc\) => \{[\s\S]{0,700}majAuGeste\(oc\.inboxUpdatedAt \|\| null, oc\.messages\)[\s\S]{0,500}annonceOffreEnVente\([\s\S]{0,300}lectureOffres\) === 'non';/.test(CODE)
      && /<RapidesConv liste=\{rapidesDuFil\(listeRapides\(quickReplies\), annonceDuFilPartie\(openConv\)\)\}/.test(CODE),
      'A13 le fil ouvert passe ses réponses rapides par `rapidesDuFil(…, annonceDuFilPartie(openConv))` (règle de l’offre, datée de la dernière activité)');
  });

  // ── A14. `vinted_sales_hidden` n'est plus rapatriée ───────────────────────
  await essaie('A14 ventes masquées', async () => {
    const api = ['api/widget.js', 'api/ship-reminders.js'].map((f) => [f, sansCommentaires(lire(f))]);
    dit(api.every(([, t]) => !/vinted_sales_hidden/.test(t)), 'A14 le widget et les rappels ne projettent plus `vinted_sales_hidden`', api.filter(([, t]) => /vinted_sales_hidden/.test(t)).map(([f]) => f).join(', '));
  });

  console.log(ko ? `\n❌ audit-flux-divers : ${ko} rouge(s)` : '\n✅ audit-flux-divers : tout est vert');
  process.exit(ko ? 1 : 0);
})();
