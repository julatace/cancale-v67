#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  BANC — DE PLUS BELLES NOTIFICATIONS (15 nov., capture de l'iPhone de Julien)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « Fais de plus belles notifications ». Sur sa capture :
//   « n° 37451417 est relié à VRM »            (l'identifiant d'un compte, pas un nom)
//   « Vendu 62 € · N°215 / Combien tu l'avais payée ? »   (sans la paire)
//   « Bordereau de retour reçu / Autry donna · à déposer avant le 23/11/2026 »
//   « 8 offres à trancher / Dernier : Nouvelle offre · « New balance 9060 vert et
//     blanc taille 38 » · <pseudo de l'acheteuse> — expire en 24h. »
// Ce banc EXÉCUTE les vraies routes — `api/push.js` (actions `comptes` et
// `prixachat`) et `api/email-inbound.js` (bordereau de retour, offres) — puis la
// vraie porte `sendPushToAll` pour les autres familles, contre une fausse base à
// état (la règle de table du mode exemple, src/exempleBase.js : `select=` projeté,
// `meta->>`, écritures gardées) et un faux Web Push ; chaque charge envoyée passe
// ensuite dans le VRAI service worker (`public/sw.js`, machine virtuelle) : ce que
// le téléphone montre, et l'adresse qu'ouvre le toucher. Horloge fixée (Paris).
// Pour CHAQUE notification : titre ≤ 40, corps ≤ 90, aucun identifiant technique,
// aucun pseudo d'acheteur, date en clair heure de Paris, adresse de l'écran EXACT,
// `tag` de l'objet (remplace au lieu d'empiler).
// Données INVENTÉES (le dépôt est public).
//   --sur <dossier> : juge un autre arbre (le code d'avant : il doit être ROUGE).
//   --mutations     : réaffaiblit la règle, chaque mutation doit rendre le banc rouge.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const vm = require('vm');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
const iSur = process.argv.indexOf('--sur');
const R = process.env.AUDIT_RACINE || (iSur > 0 ? path.resolve(process.argv[iSur + 1]) : path.join(__dirname, '..'));
const NM = path.join(__dirname, '..', 'node_modules');
let ok = 0, ko = 0;
const SILENCE = process.env.BANC_SILENCE === '1';
const dit = (c, l, d = '') => { if (c) { ok++; if (!SILENCE) console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + String(d).slice(0, 400) : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String((e && e.stack) || e).slice(0, 400)); } };

// ── Les mutations : chacune réaffaiblit UNE règle ; le banc doit devenir rouge ──
const MUTATIONS = {
  // Le texte d'avant (sans la règle) : « n° <identifiant> est relié à VRM ».
  'compte-par-identifiant': ['src/compteRelie.js', "  return r ? { title: r.title, body: r.body, redaction } : null;", "  return r ? { title: `n° ${String((comptes[0] && comptes[0].id) || '').slice(0, 8)} est relié à VRM`, body: r.body } : null;"],
  'sans-scrub-strict': ['api/_lib/notif-redaction.js', "  for (const re of strict ? [...RE_IDS, ...RE_IDS_STRICTS] : RE_IDS) x = x.replace(re, ' ');", "  for (const re of RE_IDS) x = x.replace(re, ' ');"],
  'paire-oubliee': ['src/prixAchatVente.js', "titre: str(v.titre).slice(0, 80) })) };", "titre: '' })) };"],
  'date-machine': ['api/_lib/notif-redaction.js', "export const avantClair = (v, ctx = {}) => { const d = dateClaire(v, ctx);", "export const avantClair = (v, ctx = {}) => { const d = v ? { texte: String(v).slice(0, 10), relatif: false } : null;"],
  // Le pseudo de l'acheteuse remis dans le corps de l'offre (comme avant).
  'pseudo-acheteur': ['api/email-inbound.js', "        ...texteOffre({ montant, article, juge }),", "        ...texteOffre({ montant, article, juge }), body: `${qui} — expire en 24h.`, redaction: null,"],
  'nom-long': ['api/_lib/notif-redaction.js', "  if (t.length > max) t = compacter(t);", "  if (false) t = compacter(t);"],
  'corps-170': ['api/_lib/notif-redaction.js', 'export const CORPS_MAX = 90;', 'export const CORPS_MAX = 170;'],
  'langue-ignoree': ['api/_lib/push.js', "  const red = redaction ? rediger(redaction, { langue, maintenant: t, relatif: !plusTard }) : null;", "  const red = redaction ? rediger(redaction, { langue: 'fr', maintenant: t, relatif: !plusTard }) : null;"],
  'retour-vers-achats': ['api/email-inbound.js', 'url: DESTINATIONS.retour({ tx: lu.transaction })', 'url: DESTINATIONS.achat({ tx: lu.transaction })'],
  // (16 nov.) L'échéance remise sur toute offre (la régression vue par Julien le 16 nov.).
  'offre-vinted-expire': ['api/_lib/notif-redaction.js', "const ech = str(d.site).toLowerCase() === 'vestiaire' ? T.expire24 : '';", "const ech = T.expire24;"],
  'groupe-dernier': ['api/_lib/notif-belle.js', "  const derniere = n.ligne ? n.ligne : (genre.sansTitre", "  const derniere = (genre.sansTitre"],
};
if (process.argv.includes('--mutations')) {
  let rouges = 0;
  for (const [nom, [fic, avant, apres]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-notifs-'));
    try {
      for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
      fs.symlinkSync(NM, path.join(t, 'node_modules'), 'dir');
      fs.mkdirSync(path.join(t, 'public'), { recursive: true });
      for (const f of ['sw.js', 'vrm-icon-v5-192.png', 'vrm-badge-96.png']) fs.copyFileSync(path.join(R, 'public', f), path.join(t, 'public', f));
      const p = path.join(t, fic); const src = fs.readFileSync(p, 'utf8');
      if (!src.includes(avant)) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${fic}`); rouges = -999; continue; }
      fs.writeFileSync(p, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t, BANC_SILENCE: '1' }, encoding: 'utf8', timeout: 600000 });
      // Rouge = le banc a TOURNÉ jusqu'au bout et une RÈGLE a échoué — jamais un banc qui lève
      // (un module introuvable rendrait toute mutation « rouge » : un contrôle qui ne peut pas échouer).
      const sortie = r.stdout || '';
      const fini = /\d+ vert\(s\), \d+ rouge\(s\)/.test(sortie) && !/a levé/.test(sortie);
      const rouge = r.status !== 0 && fini;
      if (!fini) console.log(`   (le banc n’a pas tourné jusqu’au bout : ${sortie.split('\n').filter((l) => /a levé/.test(l)).slice(0, 1).join('').slice(0, 200)})`);
      console.log(`${rouge ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouge ? 'ROUGE (la règle est gardée)' : 'encore vert : la règle n’est pas gardée'}`);
      if (rouge) { rouges++; console.log('   ' + (r.stdout || '').split('\n').filter((l) => l.startsWith('❌')).slice(0, 2).join('\n   ').slice(0, 300)); }
    } finally { fs.rmSync(t, { recursive: true, force: true }); }
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(`\n${rouges === n ? '✅' : '❌'} ${rouges}/${n} mutations rendent le banc rouge`);
  process.exit(rouges === n ? 0 : 1);
}

// ── Les données inventées ───────────────────────────────────────────────────
const UID = '11111111-2222-4333-8444-555555555555';
const HORLOGE = '2026-11-15T13:28:00.000Z';          // 14 h 28 à Paris, un dimanche
const T0 = Date.parse(HORLOGE);
const PSEUDOS = ['acheteuse_banc35260', 'client_test_91', 'mme_exemple_44', 'banc_achat_07', 'pseudo_fictif_12', 'essai_offre_88', 'exemple_lola_3', 'faux_acheteur_5'];
const TX_RETOUR = '7700112233';
const TX_VENTE = '7700445566';
const VC_ID = '37451417';
const iso = (ilYa) => new Date(T0 - ilYa).toISOString();
const ligne = (id, data, meta) => ({ id, owner: UID, data, ...(meta ? { meta } : {}), updated_at: iso(0) });
const SUB = ligne('push_subs', { subs: [{ endpoint: 'https://web.push.apple.com/banc-iphone', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } }], rev: 1 });

// ── Ce que toute notification doit tenir ────────────────────────────────────
const ID_TECH = [/\bn[°ºo]\s*\d{6,}\b/i, /(?<![\w,.])\d{9,}(?![\w,.])/, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, /\b(?:harvest|email|push|vc|lbc)_[A-Za-z0-9_]{3,}/];
const DATE_MACHINE = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\d{4}-\d{2}-\d{2}/;
function regle(p, nom, { pseudos = PSEUDOS, url = null, tag = null } = {}) {
  const tout = `${p.title || ''} ${p.body || ''}`;
  dit(!!p.title && p.title.length <= 40, `${nom} : titre ≤ 40 (${(p.title || '').length})`, p.title);
  dit((p.body || '').length <= 90, `${nom} : corps ≤ 90 (${(p.body || '').length})`, p.body);
  dit(!ID_TECH.some((re) => re.test(tout)), `${nom} : aucun identifiant technique`, tout);
  dit(!pseudos.some((q) => tout.includes(q)), `${nom} : aucun pseudo d’acheteur`, tout);
  dit(!DATE_MACHINE.test(tout), `${nom} : aucune date de machine (« 23/11/2026 »)`, tout);
  if (url) dit(p.url === url, `${nom} : le toucher ouvre ${url}`, p.url);
  if (tag) dit(p.tag === tag || p.tagGroupe === tag, `${nom} : étiquette « ${tag} » (remplace au lieu d’empiler)`, `${p.tag} / ${p.tagGroupe || ''}`);
}

// ── Le vrai service worker, dans une machine virtuelle ──────────────────────
function serviceWorker() {
  const ecoute = {}; const montrees = []; const ouvertes = [];
  const rep = (b) => new Response(b);
  const ctx = { self: { addEventListener: (n, f) => { ecoute[n] = f; }, registration: { showNotification: async (t, o) => { montrees.push({ t, o }); }, getNotifications: async () => [] }, skipWaiting() {} },
    clients: { matchAll: async () => [], openWindow: async (u) => { ouvertes.push(u); }, claim: async () => {} }, caches: {}, URL, Response, fetch: async () => rep(''), atob: (s) => Buffer.from(s, 'base64').toString('binary'), console, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(R, 'public', 'sw.js'), 'utf8'), ctx);
  const attente = []; const ev = (x) => ({ ...x, waitUntil: (pr) => attente.push(pr) });
  return {
    async montrer(p) {
      ecoute.push(ev({ data: { json: () => p, text: () => JSON.stringify(p) } }));
      await Promise.all(attente.splice(0));
      const m = montrees[montrees.length - 1];
      ecoute.notificationclick(ev({ action: '', notification: { close() {}, data: m.o.data } }));
      await Promise.all(attente.splice(0));
      return { titre: m.t, o: m.o, ouvre: ouvertes[ouvertes.length - 1] };
    },
  };
}

(async () => {
  process.env.SUPABASE_URL = 'https://banc.supabase.test';
  process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
  process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
  process.env.EMAIL_INBOUND_SECRET = 'cle-banc-notifs';
  process.env.VRM_OWNER_UID = UID;
  process.env.VRM_NOTIF_HORLOGE = HORLOGE;
  process.env.VRM_NOTIF_FENETRE = '0';     // chaque notification part seule (la fenêtre a son audit)
  delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  const webpush = require(path.join(NM, 'web-push'));
  const pushes = [];
  webpush.setVapidDetails = () => {};
  webpush.sendNotification = async (sub, body) => { pushes.push(JSON.parse(body)); return { statusCode: 201 }; };
  const { servirTable } = await import('file://' + path.join(R, 'src', 'exempleBase.js'));
  let tables = null; let langue = 'fr';
  const remettre = (rows, comptes = []) => { tables = { app_data: { lignes: rows }, vinted_accounts: { lignes: comptes } }; pushes.length = 0; };
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    const rep = (b, s = 200) => new Response(typeof b === 'string' ? b : JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
    if (u.pathname === '/auth/v1/user') return rep({ id: UID, email: 'vendeuse@exemple.test', created_at: '2025-01-10T10:00:00Z' });
    if (u.pathname.startsWith('/auth/v1/admin/users/')) return rep({ id: UID, user_metadata: { langue } });
    if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
    if (!u.pathname.startsWith('/rest/v1/')) return rep({});
    const t = u.pathname.replace('/rest/v1/', '');
    if (!tables || !tables[t]) return rep([]);
    let corps = null; try { corps = opts.body ? JSON.parse(opts.body) : null; } catch (_) {}
    const x = servirTable(tables[t], { methode: (opts.method || 'GET').toUpperCase(), url: u.pathname + u.search, entetes: opts.headers || {}, corps, owner: UID });
    return new Response(x.status === 204 || x.body == null ? null : JSON.stringify(x.body), { status: x.status, headers: x.headers });
  };
  const faireRes = () => ({ code: 0, corps: null, status(s) { this.code = s; return this; }, json(j) { this.corps = j; return this; }, setHeader() {}, end() { return this; }, send(b) { this.corps = b; return this; } });
  const P = await import('file://' + path.join(R, 'api', '_lib', 'push.js'));
  const L = await import('file://' + path.join(R, 'api', '_lib', 'lien-notif.js'));
  const A = await import('file://' + path.join(R, 'api', '_lib', 'notif-apercus.js'));
  const TX = await import('file://' + path.join(R, 'api', '_lib', 'notif-textes.js'));
  const { contexteVendeur } = await import('file://' + path.join(R, 'api', '_lib', 'owner.js'));
  const { default: routePush } = await import('file://' + path.join(R, 'api', 'push.js'));
  const { default: routeEmail } = await import('file://' + path.join(R, 'api', 'email-inbound.js'));
  const froid = () => { try { P.oublierPrefsVues(); } catch (_) {} try { if (P.oublierLangues) P.oublierLangues(); } catch (_) {} };
  const appelPush = async (corps) => { froid(); const res = faireRes(); await routePush({ method: 'POST', headers: { authorization: 'Bearer aaa.bbb.ccc', origin: 'https://vrm.center' }, body: corps }, res); return res; };
  const appelEmail = async (mail) => { froid(); const res = faireRes(); await routeEmail({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-notifs' }, body: { from: 'Vinted <no-reply@vinted.fr>', to: 'boite@banc.test', html: '', attachments: [], ...mail } }, res); return res; };
  const base = () => [SUB, ligne('push_journal_lu', {}), ligne('vrm_email_owners', { adresses: { 'boite@banc.test': { owner: UID } } })];
  const SW = serviceWorker();
  const auTelephone = async (p, nom, url) => {
    const m = await SW.montrer(p);
    dit(m.titre === p.title && m.o.body === p.body && m.o.tag === (p.tagGroupe || p.tag) && m.o.icon === '/vrm-icon-v5-192.png' && m.o.badge === '/vrm-badge-96.png', `${nom} : le service worker montre ce titre, ce corps, cette étiquette, l’icône et le badge VRM`, JSON.stringify({ t: m.titre, o: { body: m.o.body, tag: m.o.tag } }));
    if (url) dit(String(m.ouvre || '').split('&notif=')[0] === url, `${nom} : toucher ⇒ ${url}`, m.ouvre);
    return m;
  };
  const CAPTURE = [];   // avant → après (pour le récit)

  // ── 1. « n° 37451417 est relié à VRM » — la vraie route /api/push, action « comptes » ──
  await essaie('1 compte relié', async () => {
    remettre([...base(), ligne('vrm_comptes_relies', { v: 1, bases: { vinted: T0 - 30 * 864e5, leboncoin: T0 - 30 * 864e5, vestiaire: T0 - 30 * 864e5, ebay: T0 - 30 * 864e5 }, connus: {}, rev: 3 }),
      ligne('vc_session', { id: VC_ID, at: new Date(Date.now() - 5 * 60e3).toISOString(), comptes: {} })]);
    const r = await appelPush({ action: 'comptes' });
    const p = pushes[0] || {};
    CAPTURE.push(['compte relié', p.title, p.body]);
    dit(r.code === 200 && pushes.length === 1, '1 la route envoie UNE notification', JSON.stringify(r.corps));
    regle(p, '1 compte relié', { url: L.DESTINATIONS.comptes() });
    dit(!p.title.includes(VC_ID) && /Vestiaire/.test(p.title) && /relié/.test(p.title), '1 le compte Vestiaire sans pseudo connu : « Ton compte Vestiaire est relié », jamais son identifiant', p.title);
    dit(/^vrm-compte-/.test(p.tag || ''), '1 étiquette du compte (une mise à jour remplace)', p.tag);
    await auTelephone(p, '1 compte relié', L.DESTINATIONS.comptes());
  });

  // ── 2. « Vendu 62 € · N°215 » — la vraie route /api/push, action « prixachat » ──
  const prixAchat = async (lg) => {
    langue = lg;
    remettre([...base(), ligne(`harvest_111_txn_${TX_VENTE}`, { payload: { transaction: { id: Number(TX_VENTE), status_title: 'Commande finalisée' } } })]);
    const r = await appelPush({ action: 'prixachat', ventes: [{ tx: TX_VENTE, uid: '111', num: '215', eur: 62, titre: 'Nike Air Max 1 blanche taille 42' }] });
    return { r, p: pushes[0] || {} };
  };
  await essaie('2 prix d’achat', async () => {
    const { r, p } = await prixAchat('fr');
    CAPTURE.push(['prix d’achat', p.title, p.body]);
    dit(r.code === 200 && pushes.length === 1, '2 la route envoie UNE notification', JSON.stringify(r.corps));
    const url = `/?tab=journee&cible=prixachat&tx=${TX_VENTE}`;
    regle(p, '2 prix d’achat', { url, tag: `prix-achat-${TX_VENTE}` });
    dit(/^Vendu 62\s€ · Nike Air Max 1/.test(p.title || ''), '2 le titre dit le fait ET la paire : « Vendu 62 € · Nike Air Max 1… »', p.title);
    dit(/N°215/.test(p.body || '') && /prix d’achat/.test(p.body || ''), '2 le corps : le N° (sûr) et le geste « saisir ton prix d’achat »', p.body);
    await auTelephone(p, '2 prix d’achat', url);
    // La langue du compte (user_metadata.langue) : en anglais.
    const en = await prixAchat('en');
    dit(/^Sold €62 · Nike Air Max 1/.test(en.p.title || '') && /what you paid/.test(en.p.body || '') && en.p.lang === 'en', '2 compte en anglais ⇒ « Sold €62 · Nike Air Max 1… » (langue du compte)', `${en.p.title} / ${en.p.body} / ${en.p.lang}`);
    const de = await prixAchat('de');
    dit(/^Verkauft 62\s€/.test(de.p.title || '') && de.p.title.length <= 40, '2 compte en allemand ⇒ « Verkauft 62 € … »', de.p.title);
    langue = 'fr';
  });

  // ── 3. « Bordereau de retour reçu » — la vraie route /api/email-inbound ──
  // (15 nov., lot retours) Le corps dit QUI renvoie (« retourner la commande au vendeur ») : la route le lit
  // (`sensDuBordereau`) et garde « à vérifier » un bordereau qui ne le dit pas.
  await essaie('3 bordereau de retour', async () => {
    remettre(base());
    const r = await appelEmail({ subject: 'Bordereau de retour - Autry donna - à utiliser avant le 23/11/2026 10:00',
      text: `Bonjour,\nVoici ton bordereau de retour pour retourner la commande au vendeur.\nArticle : Autry donna\nNuméro de transaction : ${TX_RETOUR}\nNuméro de suivi : 1A2B3C4D5E6F\nDate limite d'envoi : 23/11/2026 10:00\n`,
      attachments: [{ filename: `Bon-Retour-Vinted-${TX_RETOUR}.pdf`, contentType: 'application/pdf', contentB64: Buffer.from('%PDF-1.4 bordereau de banc ' + 'x'.repeat(80)).toString('base64') }] });
    const p = pushes[0] || {};
    CAPTURE.push(['bordereau de retour', p.title, p.body]);
    dit(r.code === 200 && pushes.length === 1, '3 la route range le bordereau et envoie UNE notification', JSON.stringify(r.corps));
    const url = L.DESTINATIONS.retour ? L.DESTINATIONS.retour({ tx: TX_RETOUR }) : `/?tab=achats&vue=achats&cible=retour&tx=${TX_RETOUR}`;
    regle(p, '3 retour', { url, tag: `bordretour-${TX_RETOUR}` });
    dit(/^À renvoyer : Autry donna$/.test(p.title || ''), '3 un retour d’ACHAT : « À renvoyer : Autry donna »', p.title);
    dit(/avant le lun\. 23 nov\. 10 h/.test(p.body || ''), '3 la date en clair, heure de Paris : « avant le lun. 23 nov. 10 h »', p.body);
    await auTelephone(p, '3 retour', url);
  });

  // ── 4. « 8 offres à trancher » — la vraie route /api/email-inbound, huit offres ──
  await essaie('4 offres regroupées', async () => {
    remettre(base());
    for (let i = 0; i < 8; i++) {
      await appelEmail({ subject: 'Nouvelle offre', text: `${PSEUDOS[i]} t'a fait une offre de ${50 + i} € pour « New balance 9060 vert et blanc taille 38 »\n` });
    }
    const p1 = pushes[0] || {}, p = pushes[pushes.length - 1] || {};
    CAPTURE.push(['offre seule', p1.title, p1.body]);
    CAPTURE.push(['8 offres', p.title, p.body]);
    dit(pushes.length === 8, '4 huit e-mails d’offre ⇒ huit envois (la 8e remplace les autres)', String(pushes.length));
    regle(p1, '4 une offre');
    dit(/^Offre de 50\s€ · 9060 vert\/blanc T38$/.test(p1.title || ''), '4 une offre : « Offre de 50 € · 9060 vert/blanc T38 »', p1.title);
    regle(p, '4 huit offres', { url: L.DESTINATIONS.offres(), tag: 'vrm-offre' });
    dit(p.title === '8 offres à trancher', '4 le titre : « 8 offres à trancher »', p.title);
    // (16 nov., lot vente-email-absente) Une offre VINTED n'expire pas (Julien, 11 nov.) : jamais
    // « expire » dans son texte, seule ni regroupée ; une offre Vestiaire, elle, le dit.
    dit(/^La plus récente : 9060 vert\/blanc T38$/.test(p.body || ''), '4 le corps : « La plus récente : 9060 vert/blanc T38 » (une offre Vinted n’expire pas)', p.body);
    dit(!/expir/i.test(String(p1.title) + ' ' + String(p1.body)) && !/expir/i.test(String(p.title) + ' ' + String(p.body)), '4 offre Vinted : jamais « expire » (seule ni regroupée)', `${p1.body} | ${p.body}`);
    const RD = await import(pathToFileURL(path.join(R, 'api', '_lib', 'notif-redaction.js')).href);
    const vc = RD.rediger({ sorte: 'offre', montant: '40', article: 'Salomon XT-6 blanc taille 40', site: 'vestiaire' }, { langue: 'fr' });
    const vi = RD.rediger({ sorte: 'offre', montant: '40', article: 'Salomon XT-6 blanc taille 40' }, { langue: 'fr' });
    dit(/expire dans 24 h/.test(String(vc && vc.body)) && !/expir/i.test(String(vi && vi.body) + String(vi && vi.ligne)), '4 la règle : « expire dans 24 h » pour Vestiaire seulement', `${vc && vc.body} | ${vi && vi.body}`);
    await auTelephone(p, '4 huit offres', L.DESTINATIONS.offres());
  });

  // ── 5. Les autres familles, par la vraie porte `sendPushToAll` et les vraies fabriques ──
  await essaie('5 familles', async () => {
    const familles = [
      ['vente', { ...A.texteVendu({ article: 'Adidas Samba OG noir taille 41', prix: '65', compte: 'boutique_banc' }), tag: 'sale-k1', url: L.DESTINATIONS.vente({ tx: '7001' }) }, 'vente'],
      // Un n° de transaction glissé dans le titre d'une annonce n'est jamais montré.
      ['vente (n° dans le titre)', { ...A.texteVendu({ article: 'Puma Suede 7700998877 bleue', prix: '30', compte: 'boutique_banc' }), tag: 'sale-k9', url: L.DESTINATIONS.vente({ tx: '7009' }) }, 'vente'],
      ['argent', { ...A.texteArgentRecu({ montant: '61,20', article: 'Adidas Samba OG noir taille 41', compte: 'boutique_banc' }), tag: 'final-k2', url: L.DESTINATIONS.vente({}) }, 'argent'],
      ['bordereau', { ...A.texteBordereau({ modele: 'Air Max 90', numero: '124', tamponne: true, dateLimite: '17/11/2026 12:00' }), tag: 'bord-7003', url: L.DESTINATIONS.colis({ tx: '7003' }) }, 'expedier'],
      ['message', { ...A.texteMessage({ paire: 'Air Max 90 blanche taille 42', qui: PSEUDOS[1], compte: 'boutique_banc', extrait: 'Bonjour, toujours dispo ?' }), tag: 'msg-k4', url: L.DESTINATIONS.message({ conv: '55' }) }, 'message'],
      ['annulation', { ...A.texteAnnulation({ qui: PSEUDOS[2], article: 'Air Max 90', raison: 'Trompée de taille' }), tag: 'cancel-k5', url: L.DESTINATIONS.message({ conv: '56' }) }, 'action'],
      ['Vestiaire', { ...A.texteVenduVestiaire({ titre: 'Sac Longchamp Le Pliage noir', montant: 84, limite: '2026-11-19' }), tag: 'vc-vente-k6', url: L.DESTINATIONS.vcVente({ id: 'k6' }) }, 'vente'],
      ['arrivée', { ...TX.texteArrivee({ article: 'Adidas Samba OG', lieu: 'Tabac des Halles, 8 Rue des Lilas, 44000 Nantes', code: '454602', limite: '2026-11-17' }), tag: 'relais-k10', url: L.DESTINATIONS.retrait({ suivi: 'XW0001TS' }) }, 'colis'],
      ['soir', { ...A.texteSoir({ colis: { demain: 2, heure: '12:00', retard: 1, aVerifier: 0 }, retraits: { n: 1, lieu: 'Tabac des Halles, 8 Rue des Lilas, 44000 Nantes' }, offres: { n: 0 } }), tag: 'soir-k7', url: L.DESTINATIONS.colis({}) }, 'soir'],
    ];
    for (const [nom, payload, cat] of familles) {
      remettre(base());
      await contexteVendeur.run({ owner: UID }, async () => { froid(); await P.sendPushToAll({ ...payload, cat }); });
      const p = pushes[0] || {};
      CAPTURE.push([nom, p.title, p.body]);
      regle(p, `5 ${nom}`, { url: payload.url, tag: payload.tag });
      await auTelephone(p, `5 ${nom}`, payload.url);
    }
    // Un corps de plusieurs phrases trop long : des phrases ENTIÈRES, jamais coupées au milieu.
    remettre(base());
    await contexteVendeur.run({ owner: UID }, async () => { froid(); await P.sendPushToAll({ cat: 'bilan', title: 'Ta semaine du 9 au 15 nov.', body: 'Vendu : 9 ventes · 412 €.\nReçu : 380 €.\nÀ expédier maintenant : 2 colis.\n4 paires en ligne depuis plus de 30 jours.', tag: 'bilan-k8', url: '/?tab=semaine' }); });
    const b = pushes[0] || {};
    dit((b.body || '').length <= 90 && /Reçu : 380 €\./.test(b.body || '') && !/ depuis plus$| en ligne d…$/.test(b.body || ''), '5 un long corps garde ses phrases entières (≤ 90)', b.body);
  });

  // ── 6. L'icône et le badge ──────────────────────────────────────────────
  await essaie('6 icône', async () => {
    const ic = fs.readFileSync(path.join(R, 'public', 'vrm-icon-v5-192.png'));
    const ba = fs.readFileSync(path.join(R, 'public', 'vrm-badge-96.png'));
    dit(ic.length < 50e3 && ic.readUInt32BE(16) === 192, '6 l’icône VRM : 192 px, légère (< 50 Ko)', `${ic.length} o`);
    dit(ba.length < 10e3 && ba.readUInt32BE(16) === 96 && ba[25] === 6, '6 le badge : 96 px, monochrome sur transparent (RGBA), < 10 Ko', `${ba.length} o, type ${ba[25]}`);
  });

  if (!SILENCE) {
    console.log('\nCe que montre le téléphone (après) :');
    for (const [n, t, b] of CAPTURE) console.log(`  · ${n} : « ${t} » / « ${b} »`);
  }
  console.log(`\n${ko ? '❌' : '✅'} ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a levé : ' + String((e && e.stack) || e).slice(0, 500)); process.exit(1); });
