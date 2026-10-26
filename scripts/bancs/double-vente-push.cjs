// ═══════════════════════════════════════════════════════════════════════════
// BANC : « DOUBLE VENTE, APP FERMÉE » (fonction n°2 retenue le 11 octobre)
//        node scripts/bancs/double-vente-push.cjs [--mutation=titre|passu|dedup]
// ═══════════════════════════════════════════════════════════════════════════
// Une vente Vinted apprise par EMAIL (bordereau, « ton article s'est vendu »)
// dont le N° est PROUVÉ en vente ailleurs — SKU `VRM-{n°}` d'une annonce eBay
// active, référence VRM d'une annonce Leboncoin À LUI — doit faire partir UNE
// notification, même VRM fermé. Sans preuve : rien. « Pas su » : rien.
//
// §4.10 : on EXÉCUTE la VRAIE route (api/email-inbound.js + api/_lib/push.js)
// contre une fausse base À ÉTAT, cloisonnée, à DEUX vendeurs (registre des
// adresses de réception, une ligne par vendeur), et un faux Web Push qui note
// ce qui partirait et vers QUEL appareil. Données inventées.
// §6.1 : copié dans un arbre d'avant et lancé DEPUIS cet arbre, il doit être
// rouge (RACINE se déduit de __dirname, jamais un chemin absolu).
//
// --mutation=… réaffaiblit la route dans une copie temporaire d'`api/` :
//   titre : le N° retrouvé par ressemblance de TITRE compte comme une preuve ;
//   passu : une lecture ratée des annonces vaut « liste vide » ;
//   dedup : l'anti-doublon est retiré (envoi direct).
const path = require('path');
const fs = require('fs');
const os = require('os');
let RACINE = path.join(__dirname, '..', '..');

const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (MUT) {
  const MUTS = {
    titre: ['api/email-inbound.js', "numeroLu = jn.parTitre ? '' : jn.numero;", 'numeroLu = jn.numero;'],
    passu: ['api/email-inbound.js', "    if (!r.ok) return null;\n    let j; try { j = await r.json(); } catch (_) { return null; }\n    if (!Array.isArray(j)) return null;\n    out.push(...j);",
      "    if (!r.ok) return [];\n    let j; try { j = await r.json(); } catch (_) { return null; }\n    if (!Array.isArray(j)) return null;\n    out.push(...j);"],
    dedup: ['api/email-inbound.js', "if (notif) await pushOnce(notif, 'doublevente');", 'if (notif) await sendPushToAll(notif);'],
  };
  const m = MUTS[MUT];
  if (!m) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-dv-'));
  fs.cpSync(path.join(RACINE, 'api'), path.join(dest, 'api'), { recursive: true });
  fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(dest, 'package.json'));
  fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dest, 'node_modules'));
  const f = path.join(dest, m[0]);
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes(m[1])) { console.log('mutation « ' + MUT + ' » : motif introuvable'); process.exit(2); }
  fs.writeFileSync(f, src.replace(m[1], m[2]));
  RACINE = dest;
  console.log('⚠️  MUTATION « ' + MUT + ' » — ce banc DOIT sortir rouge.');
}

const A = '11111111-2222-3333-4444-555555555555';   // propriétaire de l'installation
const B = '99999999-8888-7777-6666-555555555555';   // second vendeur
process.env.VRM_OWNER_UID = A;
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
process.env.EMAIL_INBOUND_SECRET='cle-banc-notifications';

const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { ko++; console.log(`❌ ${m} — a levé : ${String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')}`); } };

// ── Fausse base à état, cloisonnée (owner, id) ─────────────────────────────
const base = new Map();                          // `${owner}|${id}` → data
let pannes = [];                                 // prédicats (url décodée) → la LECTURE répond 522
let acces = {};                                  // owner → booléen (abonnement)
const HTML522 = '<!DOCTYPE html><title>522</title>';
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } });
const chemin = (data, expr) => {                 // data->a->b · data->>a
  const txt = expr.includes('->>');
  const ks = expr.replace(/^data/, '').split(/->>?/).filter(Boolean);
  let v = data;
  for (const k of ks) v = v && typeof v === 'object' ? v[k] : undefined;
  if (txt) return v == null ? null : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  return v === undefined ? null : v;
};
const projeter = (sel, own, id, data) => {
  if (!sel || sel === '*') return { owner: own, id, data };
  const o = {};
  for (const part of sel.split(',')) {
    const [alias, expr] = part.includes(':') ? part.split(':') : [null, part];
    const e = expr.trim();
    const nom = alias || (e.startsWith('data') ? (e.split(/->>?/).pop()) : e);
    o[nom] = e === 'id' ? id : e === 'owner' ? own : e === 'data' ? data : chemin(data, e);
  }
  return o;
};
const lignes = (u) => {
  const f = [];
  for (const [k, v] of u.searchParams) if (!['select', 'on_conflict', 'limit', 'order'].includes(k)) f.push([k, v]);
  return [...base.entries()].filter(([cle, data]) => {
    const [own, id] = cle.split('|');
    return f.every(([k, v]) => {
      const val = k === 'id' ? id : k === 'owner' ? own : k.startsWith('data->>') ? chemin(data, k) : undefined;
      if (v === 'is.null') return val == null;
      if (v.startsWith('eq.')) return val === v.slice(3);
      if (v.startsWith('like.')) { const re = new RegExp('^' + v.slice(5).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$'); return re.test(String(val)); }
      return true;
    });
  });
};
global.fetch = async (url, opts = {}) => {
  const brut = String(url);
  const u = new URL(brut);
  const dec = decodeURIComponent(brut);
  const m = (opts.method || 'GET').toUpperCase();
  const prefer = String((opts.headers && (opts.headers.Prefer || opts.headers.prefer)) || '');
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') { const q = JSON.parse(opts.body || '{}'); return rep(acces[q.u] !== false); }
  if (u.pathname === '/rest/v1/vinted_accounts') return rep([]);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  const owner = (u.searchParams.get('owner') || '').replace(/^eq\./, '');
  if (m === 'POST') {
    const rows = JSON.parse(opts.body || '[]');
    const sansEcraser = /ignore-duplicates/.test(prefer);
    const rendus = [];
    for (const r of rows) { const cle = `${r.owner || A}|${r.id}`; if (sansEcraser && base.has(cle)) continue; base.set(cle, r.data); rendus.push(r); }
    return /return=representation/.test(prefer) ? rep(rendus, 201) : new Response('', { status: 201 });
  }
  if (m === 'PATCH') {
    const corps = JSON.parse(opts.body || '{}');
    const t = lignes(u);
    for (const [cle] of t) base.set(cle, corps.data);
    return /return=representation/.test(prefer) ? rep(t.map(([cle]) => ({ id: cle.split('|')[1], data: base.get(cle) }))) : new Response('', { status: 204 });
  }
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);   // la base sait séparer les vendeurs
  if (pannes.some((p) => p(dec))) return new Response(HTML522, { status: 522, headers: { 'content-type': 'text/html' } });
  let out = lignes(u).map(([cle, d]) => projeter(sel, cle.split('|')[0], cle.split('|')[1], d));
  void owner;
  const range = /^(\d+)-(\d+)$/.exec(String((opts.headers && opts.headers.Range) || ''));
  if (range) out = out.slice(+range[1], +range[2] + 1);
  return rep(out);
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.end = () => r; return r; };
const pose = (own, id, data) => base.set(`${own}|${id}`, data);

// ── Les emails (forme d'un bordereau et d'une vente Vinted, inventés) ──────
let tx = 50000000;
const bordereau = (to, article) => {
  const t = String(++tx);
  return { from: "\"L'équipe Vinted\" <no-reply@vinted.fr>", to, subject: `Bordereau d'envoi pour ${article}`,
    text: `Ton bordereau d'envoi est prêt.\nArticle : ${article}\nN° de transaction : ${t}\nÀ envoyer avant le 20/10/2026 pour`,
    html: '', attachments: [{ filename: `Bordereau-Vinted-${t}.pdf`, contentType: 'application/pdf', contentB64: 'JVBERi0xLjQK' }] };
};
const vente = (to, article, prix = '60,00') => ({ from: "\"L'équipe Vinted\" <no-reply@vinted.fr>", to, subject: 'Ton article s\'est vendu',
  text: `Bonne nouvelle !\nacheteur_banc a acheté ${article} ${prix} €\nPrépare ton colis.`, html: '', attachments: [] });

(async () => {
  const inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js'));
  const libPush = await import('file://' + path.join(RACINE, 'api', '_lib', 'push.js'));
  // Depuis le 22 octobre, une adresse déclarée n'est attribuée (base cloisonnée)
  // que PROUVÉE. Ce banc juge les notifications, pas la preuve : B a prouvé la
  // sienne (A est le propriétaire de l'installation — ses adresses restent).
  let libPreuve = null; try { libPreuve = await import('file://' + path.join(RACINE, 'api', '_lib', 'preuve-adresse.js')); } catch (_) {}
  let libAcces = {}; try { libAcces = await import('file://' + path.join(RACINE, 'api', '_lib', 'abonnement.js')); } catch (_) {}
  const recoit = async (mail) => { const res = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: {'x-vrm-email-key':'cle-banc-notifications'}, body: JSON.parse(JSON.stringify(mail)) }, res); return res; };
  const reset = () => {
    base.clear(); pannes = []; acces = {}; pushes.length = 0;
    if (typeof libPush.oublierPrefsVues === 'function') libPush.oublierPrefsVues();
    if (typeof inbound.oublierMemoEnAttente === 'function') inbound.oublierMemoEnAttente();
    if (typeof libAcces.oublierAcces === 'function') libAcces.oublierAcces();
    pose(A, 'vrm_email_owners', { adresses: { 'a@vrm.test': { owner: A } } });
    pose(B, 'vrm_email_owners', { adresses: { 'b@vrm.test': { owner: B } } });
    if (libPreuve) pose(libPreuve.PROPRIETAIRE_NEUTRE, libPreuve.idPreuve(B, 'b@vrm.test'), { owner: B, adresse: 'b@vrm.test', etat: 'prouvee' });
    pose(A, 'push_subs', { subs: [{ endpoint: 'https://fcm.googleapis.com/A-iphone' }] });
    pose(B, 'push_subs', { subs: [{ endpoint: 'https://fcm.googleapis.com/B-iphone' }] });
    pose(A, 'main', { vinted_annonce_numeros: {} });
    pose(B, 'main', { vinted_annonce_numeros: {} });
  };
  // Après la remise à zéro : la NOUVELLE 230 et la nouvelle 12 existent (fiches au
  // même titre, sinon l'email ne garde pas son N°) ; l'annonce eBay 7777 portait
  // « VRM-230 » à la coupure (= la B230), la 7778 « VRM-553 » provisoire (= la 12).
  const FICHES = { v9: { numero: '230', title: 'Nike Air Max 90 n230' }, v1: { numero: '12', title: 'Adidas Samba n12' } };
  const MK = { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z', ebayAnnonces: { 7777: { 230: 'B230' }, 7778: { 553: '12' } } };
  const dv = (qui) => pushes.filter((p) => String(p.tag || '').startsWith('dv-') && (!qui || p.endpoint.includes('/' + qui + '-')));

  // ══ 1. eBay : le N° sur une annonce active ⇒ une notification ═══════════════
  console.log('\n── 1. Vendue sur Vinted, N°230 encore en vente sur eBay');
  await essaie('ebay', async () => {
    reset();
    pose(A, 'ebay_listings', { items: [{ itemId: '1111', sku: 'VRM-230', title: 'Nike Air Max 90' }, { itemId: '2222', sku: '', title: 'Nike Air Max 90 n230' }] });
    const r = await recoit(bordereau('a@vrm.test', 'Nike Air Max 90 n230'));
    dit(r.code === 200, 'le bordereau est rangé', `HTTP ${r.code}`);
    const n = dv('A');
    dit(n.length === 1, 'UNE notification « double vente » part vers son téléphone', `${n.length}`);
    const p = n[0] || {};
    console.log(`     ce que lit le téléphone : « ${p.title} » / « ${p.body} »`);
    dit(/N°230/.test(p.title || '') && /eBay/.test(p.title || ''), 'elle nomme le N° et la plateforme', JSON.stringify(p.title));
    dit(/Nike Air Max 90/.test(p.body || '') && /retire/i.test(p.body || ''), 'elle nomme la paire et dit le geste', JSON.stringify(p.body));
    dit(p.url === '/?tab=ebay_annonces', 'elle ouvre eBay → Annonces', p.url);
    dit(dv('B').length === 0, 'le téléphone du vendeur B ne reçoit rien');
  });

  // ══ 2. Leboncoin : la référence VRM sur une annonce à lui ═══════════════════
  console.log('\n── 2. Vendue sur Vinted, N°231 encore en vente sur Leboncoin');
  await essaie('lbc', async () => {
    reset();
    pose(A, 'lbc_listings', { items: { L5: { id: 'L5', subject: 'Adidas Samba noire', customRef: 'VRM-231', status: 'active' },
      L6: { id: 'L6', subject: 'Chalet à louer n231', status: 'active', account: 'inconnu' } } });
    pose(A, 'lbc_ventes', { ventes: {} });
    await recoit(vente('a@vrm.test', 'Adidas Samba noire n231'));
    const n = dv('A');
    dit(n.length === 1, 'UNE notification « double vente »', `${n.length}`);
    dit(/N°231/.test((n[0] || {}).title || '') && /Leboncoin/.test((n[0] || {}).title || ''), 'elle nomme N°231 et Leboncoin', JSON.stringify((n[0] || {}).title));
    dit((n[0] || {}).url === '/?tab=leboncoin', 'elle ouvre Leboncoin', (n[0] || {}).url);
  });

  // ══ 3. Rien ailleurs ⇒ rien ═════════════════════════════════════════════════
  console.log('\n── 3. Le N° n’est en vente nulle part ailleurs');
  await essaie('absent', async () => {
    reset();
    pose(A, 'ebay_listings', { items: [{ itemId: '1111', sku: 'VRM-999', title: 'autre' }] });
    pose(A, 'lbc_listings', { items: { L5: { id: 'L5', customRef: 'VRM-998', status: 'active' } } });
    pose(A, 'lbc_ventes', { ventes: {} });
    const r = await recoit(bordereau('a@vrm.test', 'Nike Air Max 90 n230'));
    dit(r.code === 200 && pushes.some((p) => /Bordereau/.test(p.title || '')), 'le bordereau, lui, est bien notifié (la route a tourné)');
    dit(dv().length === 0, 'aucune notification « double vente »', `${dv().length}`);
  });

  // ══ 4. Même titre, aucun N° dans l'email ⇒ rien (§5) ════════════════════════
  console.log('\n── 4. Même titre qu’une paire en vente sur eBay, mais aucun N° dans l’email');
  await essaie('titre', async () => {
    reset();
    pose(A, 'main', { vinted_annonce_numeros: { v1: { numero: '230', title: 'Nike Air Max 90 taille 42' } } });
    pose(A, 'ebay_listings', { items: [{ itemId: '1111', sku: 'VRM-230', title: 'Nike Air Max 90 taille 42' }] });
    await recoit(bordereau('a@vrm.test', 'Nike Air Max 90 taille 42'));
    dit(dv().length === 0, 'aucune notification : un titre n’est pas une identité', `${dv().length}`);
  });

  // ══ 4bis. Un SKU qu'AUCUNE fiche ne porte ⇒ rien (parité avec l'app) ════════
  // VRM-230 publiée pendant la panne de synchro, la paire est devenue N°53 ;
  // plus aucune fiche ne porte 230. App ouverte, `numEbayLu` la classe « non
  // reliée » (null). Le push serveur doit en faire autant — sinon « N°230
  // encore en vente sur eBay » part, app fermée, sur une annonce qui n'est PAS
  // cette paire. Les fiches sont NON VIDES (ce n'est pas « pas su »).
  console.log('\n── 4bis. Un SKU VRM-230 qu’aucune fiche actuelle ne porte');
  await essaie('ebay-sku-orphelin', async () => {
    reset();
    pose(A, 'main', { vinted_annonce_numeros: { v1: { numero: '53', title: 'Autre paire' } } });
    pose(A, 'ebay_listings', { items: [{ itemId: '1111', sku: 'VRM-230', title: 'Nike Air Max 90' }] });
    await recoit(bordereau('a@vrm.test', 'Nike Air Max 90 n230'));
    dit(dv().length === 0, 'un SKU VRM-230 qu’AUCUNE fiche ne porte ne déclenche aucune notification (parité avec l’app)', `${dv().length}`);
  });

  // ══ 5. Lectures ratées ⇒ rien ═══════════════════════════════════════════════
  console.log('\n── 5. « Pas su » ⇒ rien');
  await essaie('passu-ebay', async () => {
    reset();
    pose(A, 'ebay_listings', { items: [{ itemId: '1111', sku: 'VRM-230' }] });
    pannes = [(u) => /ebay_listings/.test(u)];
    await recoit(bordereau('a@vrm.test', 'Nike Air Max 90 n230'));
    dit(dv().length === 0, 'annonces eBay illisibles : aucune notification', `${dv().length}`);
  });
  await essaie('passu-marqueur', async () => {
    reset();
    // Une annonce eBay d'AVANT la remise à zéro : « VRM-230 » y désigne la B230.
    pose(A, 'main', { vinted_annonce_numeros: FICHES, vrm_numerotation: MK });
    pose(A, 'ebay_listings', { items: [{ itemId: '7777', sku: 'VRM-230' }] });
    // Le marqueur lu pour le N° de l'email répond ; celui de la double vente, non.
    pannes = [(u) => /liens:data->vrm_lbc_liens/.test(u)];
    const r = await recoit(bordereau('a@vrm.test', 'Nike Air Max 90 n230'));
    dit(r.corps && r.corps.numero === '230', 'le bordereau garde bien son N°230 (sinon le contrôle suivant serait vide)', JSON.stringify(r.corps && r.corps.numero));
    dit(dv().length === 0, 'marqueur 013 illisible : aucune notification (« VRM-230 » pourrait être la B230)', `${dv().length}`);
  });
  await essaie('traduction', async () => {
    reset();
    pose(A, 'main', { vinted_annonce_numeros: FICHES, vrm_numerotation: MK });
    pose(A, 'ebay_listings', { items: [{ itemId: '7777', sku: 'VRM-230' }] });
    const r = await recoit(bordereau('a@vrm.test', 'Nike Air Max 90 n230'));
    dit(r.corps && r.corps.numero === '230', 'le bordereau garde bien son N°230', JSON.stringify(r.corps && r.corps.numero));
    dit(dv().length === 0, 'marqueur lu : « VRM-230 » d’avant la coupure est la B230, pas la nouvelle 230', `${dv().length}`);
    pushes.length = 0;
    pose(A, 'ebay_listings', { items: [{ itemId: '7777', sku: 'VRM-230' }, { itemId: '7778', sku: 'VRM-553' }] });
    await recoit(bordereau('a@vrm.test', 'Adidas Samba n12'));
    dit(dv('A').length === 1 && /N°12 /.test((dv('A')[0] || {}).title || ''), 'et « VRM-553 » provisoire est la nouvelle N°12 : notifiée', JSON.stringify((dv('A')[0] || {}).title));
  });
  await essaie('passu-ventes-lbc', async () => {
    reset();
    // L'annonce L9 est déjà VENDUE sur Leboncoin (elle n'y est plus en vente).
    pose(A, 'lbc_listings', { items: { L9: { id: 'L9', customRef: 'VRM-232', status: 'active' } } });
    pose(A, 'lbc_ventes', { ventes: { t1: { isSeller: true, itemId: 'L9', stepStatus: 'paid' } } });
    await recoit(vente('a@vrm.test', 'Puma Suede n232'));
    dit(dv().length === 0, 'annonce Leboncoin déjà vendue là-bas : pas « encore en vente »', `${dv().length}`);
    pushes.length = 0; pannes = [(u) => /lbc_ventes/.test(u)];
    await recoit(vente('a@vrm.test', 'Puma Suede n232', '61,00'));
    dit(dv().length === 0, 'ventes Leboncoin illisibles : aucune notification', `${dv().length}`);
  });

  // ══ 5 bis. Le SKU d'une annonce publiée AVANT que la paire ne reçoive ce N° ══
  //    (19 oct., chez Julien : VRM-82 publiée le 15, N°82 redonné le 18 à la
  //    Vapor Pro). La vente de la Vapor ne doit PAS sonner « encore sur eBay ».
  console.log('\n── 5 bis. Un N° redonné APRÈS la publication de l’annonce eBay');
  await essaie('sku-redonne', async () => {
    reset();
    pose(A, 'main', { vinted_annonce_numeros: { vapor: { numero: '82', auto: true, numberedAt: '2026-10-18T08:26:45.251Z', title: 'Nike Vapor Pro n82' } } });
    pose(A, 'ebay_listings', { items: [{ itemId: '8282', sku: 'VRM-82', title: 'Nike Air Max 1 noir', depuis: '2026-10-15T21:37:54.000Z' }] });
    await recoit(bordereau('a@vrm.test', 'Nike Vapor Pro n82'));
    dit(dv().length === 0, 'la Vapor (N°82 donné le 18) vendue : l’annonce VRM-82 du 15 n’est pas la sienne — aucune notification', `${dv().length}`);
    // Reliée à la main (identité) : là, oui.
    reset();
    pose(A, 'main', { vinted_annonce_numeros: { vapor: { numero: '82', auto: true, numberedAt: '2026-10-18T08:26:45.251Z', title: 'Nike Vapor Pro n82' } }, vrm_ebay_liens: { 8282: { pairId: 'vapor', numero: '82' } } });
    pose(A, 'ebay_listings', { items: [{ itemId: '8282', sku: 'VRM-82', title: 'Nike Vapor Pro', depuis: '2026-10-15T21:37:54.000Z' }] });
    await recoit(bordereau('a@vrm.test', 'Nike Vapor Pro n82'));
    dit(dv('A').length === 1, 'reliée par identité à la Vapor : la notification part', `${dv('A').length}`);
  });

  // ══ 6. Une seule fois ═══════════════════════════════════════════════════════
  console.log('\n── 6. Le même email rejoué, puis le bordereau de la même vente');
  await essaie('dedup', async () => {
    reset();
    pose(A, 'ebay_listings', { items: [{ itemId: '1111', sku: 'VRM-230' }] });
    const mail = vente('a@vrm.test', 'Nike Air Max 90 n230');
    await recoit(mail); await recoit(mail);
    await recoit(bordereau('a@vrm.test', 'Nike Air Max 90 n230'));
    dit(dv('A').length === 1, 'UNE seule notification pour la même vente', `${dv('A').length}`);
  });

  // ══ 7. Préférence coupée, abonnement coupé ═══════════════════════════════════
  console.log('\n── 7. « Double vente » coupée dans Réglages, puis abonnement coupé');
  await essaie('prefs', async () => {
    reset();
    pose(A, 'push_prefs', { doublevente: false });
    pose(A, 'ebay_listings', { items: [{ itemId: '1111', sku: 'VRM-230' }] });
    await recoit(bordereau('a@vrm.test', 'Nike Air Max 90 n230'));
    dit(dv().length === 0, 'préférence coupée : rien', `${dv().length}`);
    const D = libPush.PUSH_DEFAUT || {};
    dit(D.doublevente === true, 'catégorie « doublevente » activée par défaut sur le serveur');
  });
  await essaie('abonnement', async () => {
    reset();
    acces[A] = false;
    pose(A, 'ebay_listings', { items: [{ itemId: '1111', sku: 'VRM-230' }] });
    await recoit(bordereau('a@vrm.test', 'Nike Air Max 90 n230'));
    dit(dv().length === 0, 'abonnement coupé : rien', `${dv().length}`);
  });

  // ══ 8. Deux vendeurs ════════════════════════════════════════════════════════
  console.log('\n── 8. Deux vendeurs : chacun ses annonces, chacun ses téléphones');
  await essaie('vendeurs', async () => {
    reset();
    pose(B, 'ebay_listings', { items: [{ itemId: '3333', sku: 'VRM-230' }] });
    await recoit(bordereau('a@vrm.test', 'Nike Air Max 90 n230'));
    dit(dv().length === 0, 'A vend N°230, seul B l’a sur eBay : personne n’est notifié', `${dv().length}`);
    pushes.length = 0;
    await recoit(bordereau('b@vrm.test', 'Nike Air Max 90 n230'));
    dit(dv('B').length === 1 && dv('A').length === 0, 'B vend N°230 qu’il a sur eBay : B seul est notifié', `B=${dv('B').length} A=${dv('A').length}`);
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
