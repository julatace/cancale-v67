#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — DOUBLE VENTE, APP FERMÉE, DANS TOUS LES SENS (3 nov.)
//        node scripts/audit-double-vente-ailleurs.cjs [--mutation=…] [--prouve]
// ════════════════════════════════════════════════════════════════════════════
// Julien (3 nov., 14 h 09) : quand le SERVEUR apprend une vente (e-mail Vinted,
// e-mail Vestiaire), si l'article — par IDENTITÉ seulement — est encore EN LIGNE
// sur un autre site (eBay, Leboncoin, Vestiaire, et maintenant VINTED, la règle
// « en ligne » de l'app recopiée par script), UNE notification :
// « ⚠️ N°124 vendu sur Vinted · encore en ligne sur Leboncoin ».
// On EXÉCUTE la vraie route `api/email-inbound.js` (§4.10) contre une fausse base
// à état, cloisonnée (deux vendeurs), web-push intercepté. Données inventées.
//   E1 Vinted vendu, encore sur Leboncoin ⇒ une notif, texte exact, ouvre « à retirer »
//   E2 Vestiaire vendu (e-mail), encore en ligne sur Vinted ⇒ une notif, ouvre Ma journée
//   E3 « pas su » (dressing illisible, lecture > 24 h, liens Vestiaire illisibles) ⇒ rien
//   E4 50 articles au même titre en ligne : seul celui du N° identifié est nommé ;
//      une vente sans identité (même titre) ⇒ rien
//   E5 une seule notif par vente (e-mail rejoué ; « vendu » + bordereau)
//   E6 eBay déjà retiré par le retrait automatique ⇒ « retiré d'eBay », aucun appel eBay
//   E7 l'annonce vendue elle-même n'est jamais « ailleurs »
//   E8 la copie serveur de la règle « en ligne » = les blocs de src/App.jsx
// --mutation=… réaffaiblit la route dans une copie de `api/` : chacune DOIT rougir.
//   dedup · plateforme (le site de la vente compté) · passu (lecture ratée = vide)
//   titre (N° Vinted lu dans le TITRE) · retire (journal eBay ignoré) · frais (24 h ignorées)
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
let RACINE = path.join(__dirname, '..');
const MUTS = {
  dedup: ['api/email-inbound.js', "if (notif) await pushOnce(notif, 'doublevente');", 'if (notif) await sendPushToAll(notif);'],
  plateforme: ['api/_lib/double-vente.js', 'if (p === venduSur) continue;', 'if (false) continue;'],
  passu: ['api/email-inbound.js', "    if (!r.ok) return null;\n    let j; try { j = await r.json(); } catch (_) { return null; }\n    if (!Array.isArray(j)) return null;\n    out.push(...j);",
    "    if (!r.ok) return [];\n    let j; try { j = await r.json(); } catch (_) { return null; }\n    if (!Array.isArray(j)) return null;\n    out.push(...j);"],
  titre: ['api/_lib/double-vente.js', "const k = f && f.numero != null ? cleNum(f.numero) : '';", "const k = f && f.numero != null ? cleNum(f.numero) : cleNum((/\\bn(\\d+)\\b/i.exec(String(it.title || '')) || [])[1] || '');"],
  retire: ['api/email-inbound.js', 'retiresEbay: retires,', 'retiresEbay: new Set(),'],
  frais: ['api/_lib/enligne-regle.js', 'if (isFinite(r.lu) && age <= ENLIGNE_FRAIS_MS && sur)', 'if (isFinite(r.lu) && sur)'],
};
if (process.argv.includes('--prouve')) {
  let rouges = 0;
  for (const m of Object.keys(MUTS)) {
    let code = 0;
    try { execFileSync(process.execPath, [__filename, '--mutation=' + m], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    console.log(`${code === 1 ? '✅' : '❌'} mutation « ${m} » ⇒ ${code === 1 ? 'ROUGE (attrapée)' : 'pas attrapée (code ' + code + ')'}`);
    if (code === 1) rouges++;
  }
  console.log(`${rouges}/${Object.keys(MUTS).length} mutations attrapées`);
  process.exit(rouges === Object.keys(MUTS).length ? 0 : 1);
}
const MUT = (process.argv.find((a) => a.startsWith('--mutation=')) || '').split('=')[1] || '';
if (MUT) {
  const m = MUTS[MUT];
  if (!m) { console.log('mutation inconnue : ' + MUT); process.exit(2); }
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-dva-'));
  fs.cpSync(path.join(RACINE, 'api'), path.join(dest, 'api'), { recursive: true });
  fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(dest, 'package.json'));
  fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(dest, 'node_modules'));
  const f = path.join(dest, m[0]);
  const s = fs.readFileSync(f, 'utf8');
  if (!s.includes(m[1])) { console.log('mutation « ' + MUT + ' » : motif introuvable'); process.exit(2); }
  fs.writeFileSync(f, s.replace(m[1], m[2]));
  RACINE = dest;
  console.log('⚠️  MUTATION « ' + MUT + ' » — cet audit DOIT sortir rouge.');
}

const A = '11111111-2222-3333-4444-555555555555';   // propriétaire de l'installation
const B = '99999999-8888-7777-6666-555555555555';   // second vendeur
process.env.VRM_OWNER_UID = A;
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
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
let pannes = [];
const appelsEbay = [];                                 // prédicats (url décodée) → la LECTURE répond 522
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
  if (/ebay\.com/.test(u.hostname)) { appelsEbay.push(brut); return rep({}); }
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
  const dv = (qui) => pushes.filter((p) => String(p.tag || '').startsWith('dv-') && (!qui || p.endpoint.includes('/' + qui + '-')));
  const MAINT = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  // Un dressing Vinted capté connecté (forme mesurée : data.payload.items, data.capturedAt, data.uid).
  const dressing = (own, uid, items, capMs = MAINT - 3600e3) => pose(own, `harvest_${uid}_listings`, { type: 'listings', uid, capturedAt: iso(capMs), payload: { items } });
  const ann = (id, title, o = {}) => ({ id, title, is_closed: false, is_hidden: false, is_draft: false, ...o });
  const PID = '72987282';
  const vcVente = (to, pid = PID, marque = 'NIKE', titre = 'Air Max 90') => ({ messageId: `<vc-${pid}-${Math.random()}@audit>`, from: 'Vestiaire Collective <no-reply@vestiairecollective.com>', to,
    subject: `Votre article vient d'être vendu (#${pid})`, text: '', source: 'gmail-v2', sourceDate: iso(MAINT),
    html: `<p>Félicitations, votre article a été vendu le ${new Date(MAINT).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}.</p><table><tr><td><div>Réf&nbsp;: ${pid}</div><div><b>${marque}</b></div><div>${titre}</div><div>Votre prix de vente&nbsp;: 150,00&nbsp;€</div><div>Vous gagnez&nbsp;: 139,50&nbsp;€</div></td></tr></table>`, attachments: [] });

  // ══ E8. La copie serveur = les blocs de l'app ═════════════════════════════════
  console.log('\n── E8. api/_lib/enligne-regle.js refabriqué depuis src/App.jsx');
  await essaie('copie', async () => {
    let code = 0; try { execFileSync(process.execPath, [path.join(__dirname, 'recopie-enligne-serveur.cjs'), '--verifier'], { stdio: 'pipe' }); } catch (e) { code = e.status || 1; }
    dit(code === 0, 'E8 la règle « en ligne » du serveur est, texte pour texte, celle de l’app (recopie-enligne-serveur --verifier)');
  });

  // ══ E1. Vinted vendu, encore sur Leboncoin ════════════════════════════════════
  console.log('\n── E1. Vendu sur Vinted, N°231 encore en ligne sur Leboncoin');
  await essaie('E1', async () => {
    reset();
    pose(A, 'lbc_listings', { items: { L5: { id: 'L5', subject: 'Adidas Samba noire', customRef: 'VRM-231', status: 'active' } } });
    pose(A, 'lbc_ventes', { ventes: {} });
    await recoit(vente('a@vrm.test', 'Adidas Samba noire n231'));
    const n = dv('A');
    dit(n.length === 1, 'E1 UNE notification', `${n.length}`);
    const p = n[0] || {};
    dit(p.title === '⚠️ N°231 vendu sur Vinted · encore en ligne sur Leboncoin', 'E1 texte exact « ⚠️ N°231 vendu sur Vinted · encore en ligne sur Leboncoin »', JSON.stringify(p.title));
    dit(p.body === 'Adidas Samba noire', 'E1 le corps = l’article seul, aucun texte explicatif', JSON.stringify(p.body));
    dit(p.url === '/?tab=annonces&site=leboncoin&cible=doublon&num=231&plat=leboncoin', 'E1 ouvre « à retirer de Leboncoin » sur le N°231', p.url);
    dit(dv('B').length === 0, 'E1 rien chez l’autre vendeur');
  });

  // ══ E2. Vestiaire vendu (e-mail), encore en ligne sur Vinted ═══════════════════
  console.log('\n── E2. Vendu sur Vestiaire (e-mail), N°45 encore en ligne sur Vinted');
  const poseE2 = (own = A) => {
    pose(own, 'main', { vinted_annonce_numeros: { 9045: { numero: '45', title: 'Nike Air Max 90' } }, vrm_vc_numeros: {} });
    pose(own, 'vc_listings', { items: { [PID]: { titre: 'Air Max 90', statut: 'published', compte: 'c1' } }, liens: { [PID]: '45' }, capturedAt: iso(MAINT - 600e3) });
    pose(own, 'vc_ventes', { ventes: {} });
    dressing(own, '111', [ann(9045, 'Nike Air Max 90')]);
  };
  await essaie('E2', async () => {
    reset(); poseE2();
    const r = await recoit(vcVente('a@vrm.test'));
    dit(r.code === 200 && r.corps && r.corps.type === 'vente-vestiaire', 'E2 l’e-mail Vestiaire est rangé', JSON.stringify(r.corps).slice(0, 120));
    const n = dv('A'); const p = n[0] || {};
    dit(n.length === 1, 'E2 UNE notification double vente', `${n.length}`);
    dit(p.title === '⚠️ N°45 vendu sur Vestiaire · encore en ligne sur Vinted', 'E2 texte exact « ⚠️ N°45 vendu sur Vestiaire · encore en ligne sur Vinted »', JSON.stringify(p.title));
    dit(p.url === '/?tab=journee', 'E2 ouvre Ma journée (la carte « à retirer de Vinted »)', p.url);
    dit(!/vestiaire:/.test(p.tag || ''), 'E7 l’annonce Vestiaire vendue n’est pas « ailleurs »', p.tag);
  });

  // ══ E3. « Pas su » ⇒ rien ═════════════════════════════════════════════════════
  console.log('\n── E3. « Pas su » ⇒ rien');
  await essaie('E3', async () => {
    reset(); poseE2(); pannes = [(u) => /harvest_%_listings|harvest_\*_listings|_listings&select=id,cap/.test(u)];
    await recoit(vcVente('a@vrm.test'));
    dit(dv().length === 0, 'E3a dressings Vinted illisibles : rien', `${dv().length}`);
    reset(); poseE2(); dressing(A, '111', [ann(9045, 'Nike Air Max 90')], MAINT - 30 * 3600e3);
    await recoit(vcVente('a@vrm.test'));
    dit(dv().length === 0, 'E3b dressing lu il y a 30 h (« à confirmer ») : rien', `${dv().length}`);
    reset(); poseE2(); pannes = [(u) => /select=liens:data->liens(&|$)/.test(u)];
    await recoit(vcVente('a@vrm.test'));
    dit(dv().length === 0, 'E3c liens Vestiaire illisibles (N° de la vente pas su) : rien', `${dv().length}`);
    reset(); poseE2(); pose(A, 'harvest_111_supprimees', { ids: { 9045: iso(MAINT - 60e3) } });
    await recoit(vcVente('a@vrm.test'));
    dit(dv().length === 0, 'E3d annonce Vinted supprimée après la lecture : plus « en ligne »', `${dv().length}`);
    reset(); poseE2(); pose(A, 'main', { vinted_annonce_numeros: { 9045: { numero: '45', title: 'Nike Air Max 90' } }, vrm_vc_numeros: {}, vrm_annonces_retirees: { 111: { at: 1 } } });
    await recoit(vcVente('a@vrm.test'));
    dit(dv().length === 0, 'E3e compte Vinted retiré pour de bon : ne compte pas', `${dv().length}`);
  });

  await essaie('E3f', async () => {
    reset(); poseE2(); pose(A, 'harvest_111_supprimees', { ids: { 9045: iso(MAINT - 60e3) } });
    pannes = [(u) => /_supprimees/.test(u)];
    await recoit(vcVente('a@vrm.test'));
    dit(dv().length === 0, 'E3f suppressions illisibles : pas su ⇒ rien (jamais « aucune suppression »)', `${dv().length}`);
  });

  // ══ E4. 50 articles au même titre ═════════════════════════════════════════════
  console.log('\n── E4. 50 articles « Nike Air Max 90 » en ligne sur Vinted');
  await essaie('E4', async () => {
    reset();
    const fiches = {}, items = [];
    for (let i = 0; i < 50; i++) { fiches[8000 + i] = { numero: String(100 + i), title: 'Nike Air Max 90 n' + (100 + i) }; items.push(ann(8000 + i, 'Nike Air Max 90 n' + (100 + i))); }
    pose(A, 'main', { vinted_annonce_numeros: fiches, vrm_vc_numeros: {} });
    pose(A, 'vc_listings', { items: { [PID]: { titre: 'Air Max 90' } }, liens: { [PID]: '145' }, capturedAt: iso(MAINT) });
    pose(A, 'vc_ventes', { ventes: {} });
    dressing(A, '111', items);
    await recoit(vcVente('a@vrm.test'));
    const n = dv('A'); const p = n[0] || {};
    dit(n.length === 1 && p.title === '⚠️ N°145 vendu sur Vestiaire · encore en ligne sur Vinted', 'E4a seul le N°145 identifié est nommé', JSON.stringify(n.map((x) => x.title)));
    dit(/vinted:8045(?!\d)/.test(p.tag || '') && !/vinted:80(?!45)\d\d/.test(p.tag || ''), 'E4b la clé ne porte QUE l’annonce 8045', p.tag);
    reset();
    pose(A, 'main', { vinted_annonce_numeros: fiches, vrm_vc_numeros: {} });
    pose(A, 'vc_listings', { items: { [PID]: { titre: 'Air Max 90' } }, liens: {}, capturedAt: iso(MAINT) });
    pose(A, 'vc_ventes', { ventes: {} });
    dressing(A, '111', items.map((it) => ({ ...it, title: 'Nike Air Max 90' })));
    await recoit(vcVente('a@vrm.test'));
    dit(dv().length === 0, 'E4c vente Vestiaire SANS identité, même titre que 50 annonces : rien', `${dv().length}`);
    reset();
    pose(A, 'main', { vinted_annonce_numeros: { 9046: { title: 'Nike Air Max 90' } }, vrm_vc_numeros: {} });
    dressing(A, '111', [ann(9046, 'Nike Air Max 90 n230')]);
    pose(A, 'vc_listings', { items: {}, liens: { [PID]: '230' }, capturedAt: iso(MAINT) }); pose(A, 'vc_ventes', { ventes: {} });
    await recoit(vcVente('a@vrm.test'));
    dit(dv().length === 0, 'E4d une annonce Vinted sans N° sur sa fiche (« n230 » dans son titre) n’est pas la N°230', `${dv().length}`);
  });

  // ══ E5. Une seule fois par vente ══════════════════════════════════════════════
  console.log('\n── E5. Une seule notification par vente');
  await essaie('E5', async () => {
    reset(); poseE2();
    const m = vcVente('a@vrm.test');
    await recoit(m); await recoit({ ...m, messageId: '<autre@audit>' });
    dit(dv('A').length === 1, 'E5a e-mail Vestiaire rejoué : une seule', `${dv('A').length}`);
    reset();
    pose(A, 'lbc_listings', { items: { L5: { id: 'L5', customRef: 'VRM-231', status: 'active' } } });
    pose(A, 'lbc_ventes', { ventes: {} });
    await recoit(vente('a@vrm.test', 'Adidas Samba noire n231'));
    await recoit(bordereau('a@vrm.test', 'Adidas Samba noire n231'));
    dit(dv('A').length === 1, 'E5b « vendu » puis bordereau de la même vente : une seule', `${dv('A').length}`);
  });

  // ══ E6. eBay retiré tout seul ═════════════════════════════════════════════════
  console.log('\n── E6. eBay déjà retiré par le retrait automatique');
  await essaie('E6', async () => {
    reset(); appelsEbay.length = 0;
    pose(A, 'lbc_listings', { items: { L5: { id: 'L5', customRef: 'VRM-231', status: 'active' } } });
    pose(A, 'lbc_ventes', { ventes: {} });
    pose(A, 'ebay_retraits_auto', { items: [{ itemId: '1111', sku: 'VRM-231', titre: 'Adidas Samba', at: MAINT - 60e3, ou: 'Vinted' }] });
    await recoit(vente('a@vrm.test', 'Adidas Samba noire n231'));
    const p = dv('A')[0] || {};
    dit(p.title === "⚠️ N°231 vendu sur Vinted · encore en ligne sur Leboncoin · retiré d'eBay", 'E6a « … · retiré d’eBay » quand le journal le dit', JSON.stringify(p.title));
    dit(appelsEbay.length === 0, 'E6b le serveur n’appelle JAMAIS eBay (le retrait automatique n’est pas dupliqué)', `${appelsEbay.length}`);
    reset();
    pose(A, 'ebay_retraits_auto', { items: [{ itemId: '1111', sku: 'VRM-231', at: MAINT - 10 * 86400e3 }] });
    pose(A, 'lbc_listings', { items: { L5: { id: 'L5', customRef: 'VRM-231', status: 'active' } } }); pose(A, 'lbc_ventes', { ventes: {} });
    await recoit(vente('a@vrm.test', 'Adidas Samba noire n231'));
    dit(!/retiré/.test((dv('A')[0] || {}).title || ''), 'E6c un retrait vieux de 10 jours ne parle pas de cette vente', JSON.stringify((dv('A')[0] || {}).title));
  });

  // ══ E7. L'annonce vendue elle-même ════════════════════════════════════════════
  console.log('\n── E7. Vendu sur Vinted : son annonce Vinted encore dans le dressing');
  await essaie('E7', async () => {
    reset();
    pose(A, 'main', { vinted_annonce_numeros: { 9230: { numero: '230', title: 'Nike Air Max 90 n230' } } });
    dressing(A, '111', [ann(9230, 'Nike Air Max 90 n230')]);
    await recoit(vente('a@vrm.test', 'Nike Air Max 90 n230'));
    dit(dv().length === 0, 'E7 l’annonce Vinted de la vente n’est pas « encore en ligne ailleurs »', JSON.stringify(dv().map((x) => x.title)));
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
