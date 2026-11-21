#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — FACTURES PRO, LOT Q (10 nov.) : envoi automatique, « À envoyer »,
//  avoir, registre + zip, numérotation
// ════════════════════════════════════════════════════════════════════════════
// Exécute le VRAI code :
//   · la règle pure src/facturePro/registre.js (`etatVentePro`, `listeAEnvoyer`,
//     `eligibleAuto`, `trousNumerotation`, `csvRegistre`) et le zip de src/exportDonnees.js ;
//   · la VRAIE fonction serverless `api/ship-reminders.js?moment=factures` (→
//     api/_lib/factures-auto.js → api/_lib/facture-pro.js) et la route
//     `routeFacturePro`, contre une fausse base Supabase (forme réelle : app_data
//     owner/id/data, projections `alias:data->…`, filtres `eq` `gte` `cs` `in`,
//     PATCH `return=representation`, POST 409) et un FAUX SERVEUR SMTP en TLS.
// Aucune donnée réelle : vendeurs, acheteurs, SIRET (clé de Luhn calculée) inventés.
//
//   R  la règle « À envoyer » (prouvée, pas prouvée, annulée, envoyée, incertaine, pas su ;
//      50 paires identiques : chacune SON acheteur) ;
//   E  l'éligibilité à l'envoi automatique (éteint par défaut, date, une fois) ;
//   S  le passage serveur : éteint ⇒ personne ; SMTP absent ⇒ rien ne part, dit ; fiche
//      incomplète ⇒ rien, dit ; prouvée ⇒ émise ET envoyée à l'acheteur prouvé, une fois ;
//      pas prouvée, annulée, antérieure ⇒ rien ; sélection muette ⇒ 503 ; réponse en nombres ;
//   N  la numérotation : continue, jamais réattribuée (avoir, réémission, auto + clic) ;
//   D  aucune suppression d'une facture émise (aucun DELETE, aucune action) ;
//   G  le registre : trous dits, brouillons à part, reçus d'achat exclus, période à l'heure
//      de Paris, CSV, zip (PDF + CSV) relu.
// `--prouve` : chaque mutation (dont « numéro réattribué », « facture supprimée »,
// « envoi sans adresse prouvée ») doit rendre l'audit ROUGE.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const tls = require('tls');
const { execFileSync, spawnSync } = require('child_process');
const RACINE_DEPOT = path.resolve(__dirname, '..');
const racine = process.env.AUDIT_RACINE || RACINE_DEPOT;
const MUET = !!process.env.AUDIT_RACINE;

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; if (!MUET) console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' (planté)', String((e && e.stack) || e).slice(0, 300)); } };

const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const SIREN = (() => { for (let k = 0; k < 10; k++) if (luhn('90012345' + k)) return '90012345' + k; })();
const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();

// ── La fausse base ─────────────────────────────────────────────────────────
const A = '11111111-1111-4111-8111-111111111111';   // auto ÉTEINT
const B = '22222222-2222-4222-8222-222222222222';   // auto ALLUMÉ
const NEUTRE = '00000000-0000-0000-0000-000000000000';
let base = new Map();
const pannes = new Set();
const requetes = [];
const cle = (o, i) => `${o}|${i}`;
const val = (data, chemin) => { let v = { data }; for (const seg of chemin.split(/->>?/)) v = v == null ? undefined : v[seg]; return v; };
const contient = (a, b) => (Array.isArray(b) ? Array.isArray(a) && b.every((x) => a.some((y) => contient(y, x))) : b && typeof b === 'object' ? a && typeof a === 'object' && Object.entries(b).every(([k, v]) => contient(a[k], v)) : a === b);
const projeter = (r, selBrut) => {
  const sel = (selBrut || 'data').split(',');
  return Object.fromEntries(sel.map((x) => {
    const [al, src] = x.includes(':') ? x.split(':') : [x.split(/->>?/).pop(), x];
    if (src === 'id') return [al, r.id]; if (src === 'owner') return [al, r.owner]; if (src === 'data') return [al, r.data];
    const v = val(r.data, src);
    return [al, v == null ? null : /->>[A-Za-z_0-9]+$/.test(src) && typeof v !== 'string' ? String(v) : v];
  }));
};
global.fetch = async (u, o = {}) => {
  const url = new URL(u);
  const methode = (o.method || 'GET').toUpperCase();
  requetes.push({ methode, url: decodeURIComponent(url.search), owner: (url.searchParams.get('owner') || '').replace(/^eq\./, '') });
  const rep = (code, corps) => ({ ok: code >= 200 && code < 300, status: code, json: async () => corps, text: async () => JSON.stringify(corps), headers: { get: () => null } });
  if (!url.pathname.endsWith('/rest/v1/app_data')) return rep(404, {});
  const q = url.searchParams;
  const idq = q.get('id') || '';
  const owner = (q.get('owner') || '').replace(/^eq\./, '');
  const autres = [...q.entries()].filter(([k]) => !['id', 'owner', 'select', 'on_conflict', 'order', 'limit'].includes(k)).map(([k, v]) => `${k}=${v}`);
  if (methode === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep(200, [{ owner: A }]);  // la base sépare les vendeurs
    if ([...pannes].some((p) => decodeURIComponent(url.search).includes(p))) return rep(522, '<html>');
    let lignes = [...base.entries()].map(([k, d]) => { const i = k.indexOf('|'); return { owner: k.slice(0, i), id: k.slice(i + 1), data: d }; });
    if (owner) lignes = lignes.filter((r) => r.owner === owner);
    if (idq.startsWith('eq.')) lignes = lignes.filter((r) => r.id === idq.slice(3));
    else if (idq.startsWith('like.')) { const re = new RegExp('^' + idq.slice(5).replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$'); lignes = lignes.filter((r) => re.test(r.id)); }
    else if (idq.startsWith('in.(')) { const ids = idq.slice(4, -1).split(','); lignes = lignes.filter((r) => ids.includes(r.id)); }
    else if (idq) throw new Error('filtre id inconnu du banc : ' + idq);
    if (!owner && !/vrm_pro_facture/.test(idq)) return rep(400, { message: 'lecture sans vendeur' });
    for (const f of autres) {
      const m = /^(data(?:->>?[A-Za-z_]+)+)=(eq|cs|gte|is)\.(.*)$/.exec(f);
      if (!m) throw new Error('filtre inconnu du banc : ' + f);
      const [, ch, op, v] = m;
      lignes = lignes.filter((r) => { const x = val(r.data, ch); return op === 'eq' ? String(x) === v : op === 'gte' ? x != null && String(x) >= v : op === 'is' ? (v === 'null' ? x == null : true) : contient(x, JSON.parse(v)); });
    }
    return rep(200, lignes.map((r) => projeter(r, q.get('select'))));
  }
  if (methode === 'POST') {
    const lignes = JSON.parse(o.body);
    const fusion = /merge-duplicates/.test((o.headers || {}).Prefer || (o.headers || {}).prefer || '');
    for (const l of lignes) { if (!l.owner) return rep(400, {}); if (base.has(cle(l.owner, l.id)) && !fusion) return rep(409, { message: 'doublon' }); }
    for (const l of lignes) base.set(cle(l.owner, l.id), JSON.parse(JSON.stringify(l.data)));
    return rep(201, null);
  }
  if (methode === 'PATCH') {
    const id = idq.replace(/^eq\./, ''); const k = cle(owner, id);
    if (!owner || !base.has(k)) return rep(200, []);
    const d = base.get(k);
    const passe = autres.every((f) => { let m; if ((m = /^data->>rev=eq\.(.*)$/.exec(f))) return d && String(d.rev) === m[1]; if (f === 'data->>rev=is.null') return d && d.rev == null; if ((m = /^data->>n=eq\.(\d+)$/.exec(f))) return String(d.n) === m[1]; if ((m = /^data=eq\.(\d+)$/.exec(f))) return JSON.stringify(d) === m[1]; throw new Error('filtre PATCH inconnu : ' + f); });
    if (!passe) return rep(200, []);
    base.set(k, JSON.parse(o.body).data);
    return rep(200, [{ id }]);
  }
  if (methode === 'DELETE') { const id = idq.replace(/^eq\./, ''); base.delete(cle(owner, id)); return rep(204, null); }
  return rep(405, {});
};

// ── Le faux serveur d'envoi (TLS + SMTP) ───────────────────────────────────
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-smtp-q-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dossier, 'k.pem'), '-out', path.join(dossier, 'c.pem'), '-days', '1', '-subj', '/CN=banc.local'], { stdio: 'ignore' });
const CERT = fs.readFileSync(path.join(dossier, 'c.pem'));
const smtp = { recus: [] };
const serveur = tls.createServer({ key: fs.readFileSync(path.join(dossier, 'k.pem')), cert: CERT }, (s) => {
  let tampon = ''; let enData = false; let msg = { rcpt: [], from: '', data: '' };
  s.write('220 banc ESMTP\r\n');
  s.on('data', (d) => {
    tampon += d.toString('utf8');
    for (;;) {
      if (enData) { const fin = tampon.indexOf('\r\n.\r\n'); if (fin < 0) return; msg.data = tampon.slice(0, fin); tampon = tampon.slice(fin + 5); enData = false; smtp.recus.push(msg); msg = { rcpt: [], from: '', data: '' }; s.write('250 2.0.0 OK\r\n'); continue; }
      const i = tampon.indexOf('\r\n'); if (i < 0) return;
      const l = tampon.slice(0, i); tampon = tampon.slice(i + 2);
      if (/^EHLO/i.test(l)) s.write('250-banc\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
      else if (/^AUTH PLAIN /i.test(l)) s.write('235 ok\r\n');
      else if (/^MAIL FROM:/i.test(l)) { msg.from = l.slice(10); s.write('250 ok\r\n'); }
      else if (/^RCPT TO:/i.test(l)) { msg.rcpt.push(l.slice(8)); s.write('250 ok\r\n'); }
      else if (/^DATA/i.test(l)) { enData = true; s.write('354 vas-y\r\n'); }
      else if (/^QUIT/i.test(l)) { s.write('221 bye\r\n'); s.end(); }
      else s.write('502 ?\r\n');
    }
  });
  s.on('error', () => {});
});
const faireRes = () => { const r = { code: 0, corps: null }; r.setHeader = () => {}; r.status = (c) => { r.code = c; return { json: (j) => { r.corps = j; return r; } }; }; return r; };

(async () => {
  await new Promise((okc) => serveur.listen(0, '127.0.0.1', okc));
  const port = serveur.address().port;
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  process.env.VRM_COFFRE_CLE = 'cle-de-coffre-du-banc';
  process.env.CRON_SECRET = 'cle-banc-cron';
  process.env.SMTP_DELAI_MS = '3000';
  const SMTP_ENV = { RELANCES_SMTP_HOTE: 'smtp.banc.test', RELANCES_SMTP_PORT: '465', RELANCES_SMTP_UTILISATEUR: 'vrm-banc', RELANCES_SMTP_MOT_DE_PASSE: 'mdp-vrm-banc', RELANCES_EXPEDITEUR: 'factures@vrm.banc.test' };
  const poserSmtp = (oui) => { for (const [k, v] of Object.entries(SMTP_ENV)) { if (oui) process.env[k] = v; else delete process.env[k]; } };
  const imp = (p) => import(path.join(racine, p));
  const smtpMod = await imp('api/_lib/smtp.js');
  if (smtpMod._banc) smtpMod._banc.connecter = () => new Promise((okc, koc) => { const s = tls.connect({ host: '127.0.0.1', port, ca: CERT, servername: 'banc.local' }, () => okc(s)); s.once('error', koc); });
  const REG = await imp('src/facturePro/registre.js');
  const RAT = await imp('src/facturePro/rattachement.js');
  const REGLE = await imp('src/facturePro/regle.js');
  const FP = await imp('api/_lib/facture-pro.js');
  const VR = await imp('api/_lib/ventes-regle.js');
  const ZIP = await imp('src/exportDonnees.js');
  const classer = VR.classifyOrderStatus;
  const maintenant = Date.now();
  const iso = (t) => new Date(t).toISOString();

  // ══ R : la règle « À envoyer » ════════════════════════════════════════════
  await essaie('R', async () => {
    const tV = maintenant - 3 * 3600e3;
    const mail = (tx, x = {}) => ({ transaction: tx, receivedAt: iso(tV + 60e3), prix: '30.00', email: `a${tx}@exemple.test`, nom: `Acheteur ${tx}`, adresse: 'rue Inventée, 12, Paris, 75011, FR, France', uid: '77', designation: 'Paire banc', ...x });
    const cmd = (tx, x = {}) => ({ transaction_id: tx, date: iso(tV), price: { amount: '30.00', currency_code: 'EUR' }, uid: '77', title: 'Paire banc', status: 'Commande expédiée', ...x });
    const E = (o) => REG.etatVentePro({ classer, adresseLisible: REGLE.adresseVintedLisible, ...o });
    const p = E({ tx: '9100000001', mails: [mail('9100000001')], commandes: [cmd('9100000001')] });
    dit(p.etat === 'a-envoyer' && p.preuve.acheteur.email === 'a9100000001@exemple.test', 'R1 vente Pro prouvée (n°, heure, montant) ⇒ « à envoyer », à SON acheteur', JSON.stringify(p).slice(0, 160));
    const h = E({ tx: '9100000002', mails: [mail('9100000002', { receivedAt: iso(tV + 3 * 3600e3) })], commandes: [cmd('9100000002')] });
    dit(h.etat === 'pas-prouvee' && /3 h après/.test(h.raison), 'R2 e-mail 3 h après ⇒ pas prouvée, la raison dite', h.raison);
    const an = E({ tx: '9100000003', mails: [mail('9100000003')], commandes: [cmd('9100000003', { status: 'Commande annulée' })], facture: { emiseLe: iso(maintenant), numero: 'FA-2026-0009', preuve: '9100000003' } });
    dit(an.etat === 'a-annuler', 'R3 vente annulée avec une facture émise ⇒ l’avoir est PROPOSÉ', an.etat);
    const an2 = E({ tx: '9100000004', mails: [mail('9100000004')], commandes: [cmd('9100000004', { status: 'Remboursée' })] });
    dit(an2.etat === 'annulee-sans-facture' && !REG.A_MONTRER.has(an2.etat), 'R3 vente annulée sans facture ⇒ rien à facturer (pas dans la liste)', an2.etat);
    const av = E({ tx: '9100000003', mails: [mail('9100000003')], commandes: [cmd('9100000003', { status: 'Commande annulée' })], facture: { emiseLe: iso(maintenant), numero: 'FA-2026-0009' }, avoir: { emiseLe: iso(maintenant), numero: 'AV-2026-0001' } });
    dit(av.etat === 'annulee', 'R4 avoir émis ⇒ annulée, plus rien à faire', av.etat);
    const env = E({ tx: '9100000001', mails: [mail('9100000001')], commandes: [cmd('9100000001')], facture: { emiseLe: iso(maintenant), numero: 'FA-2026-0010', preuve: '9100000001', envoi: { etat: 'envoyee' } } });
    const inc = E({ tx: '9100000001', mails: [mail('9100000001')], commandes: [cmd('9100000001')], facture: { emiseLe: iso(maintenant), numero: 'FA-2026-0010', preuve: '9100000001', envoi: { etat: 'incertaine' } } });
    dit(env.etat === 'envoyee' && inc.etat === 'a-verifier', 'R5 envoyée ⇒ sortie ; incertaine ⇒ « à vérifier » (jamais renvoyée seule)', `${env.etat} · ${inc.etat}`);
    const ps = E({ tx: '9100000001', mails: [mail('9100000001')], commandes: null });
    dit(ps.etat === 'pas-su', 'R6 ventes Vinted pas lues ⇒ « pas su », jamais « prouvée »', ps.etat);
    const sp = E({ tx: '9100000001', mails: [mail('9100000001')], commandes: [cmd('9100000001')], facture: { emiseLe: iso(maintenant), numero: 'FA-2026-0010' } });
    dit(sp.etat === 'sans-preuve', 'R7 facture émise sans preuve ⇒ VRM ne l’envoie pas', sp.etat);
    // 50 paires identiques (même titre, même prix, même minute) : chacune désigne SON acheteur.
    const vp = new Map(); const cmds = new Map();
    for (let i = 0; i < 50; i++) { const tx = String(9200000000 + i); vp.set(tx, [mail(tx)]); cmds.set(tx, [cmd(tx)]); }
    const l = REG.listeAEnvoyer({ ventesPro: vp, factures: new Map(), avoirs: new Map(), commandesParTx: cmds, classer, adresseLisible: REGLE.adresseVintedLisible });
    dit(l.length === 50 && l.every((x) => x.etat === 'a-envoyer' && x.preuve.acheteur.email === `a${x.tx}@exemple.test`), 'R8 50 paires identiques : chacune part à SON acheteur, aucune à celui d’une autre', `${l.length}`);
    const l2 = REG.listeAEnvoyer({ ventesPro: new Map([['9300000001', [mail('9300000001', { receivedAt: iso(tV - 86400e3 + 60e3) })]], ['9300000002', [mail('9300000002')]]]), factures: new Map(), avoirs: new Map(), commandesParTx: new Map([['9300000001', [cmd('9300000001', { date: iso(tV - 86400e3) })]], ['9300000002', [cmd('9300000002')]]]), classer, adresseLisible: REGLE.adresseVintedLisible });
    dit(l2[0].tx === '9300000002', 'R9 le plus récent en haut', l2.map((x) => x.tx).join(','));
  });

  // ══ E : l'éligibilité à l'envoi automatique ═══════════════════════════════
  await essaie('E', async () => {
    const it = { etat: 'a-envoyer', venteLe: iso(maintenant - 3600e3), envois: 0 };
    const depuis = iso(maintenant - 86400e3);
    const src = fs.readFileSync(path.join(racine, 'src', 'FacturePro.jsx'), 'utf8');
    const VIDE = /const VIDE = (\{[^\n]*\});/.exec(src);
    dit(VIDE && /envoiAuto: false/.test(VIDE[1]) && !REG.eligibleAuto(it, { cfg: {}, maintenant }), 'E1 ÉTEINT par défaut (fiche vide, `envoiAuto: false`)');
    dit(!REG.eligibleAuto(it, { cfg: { envoiAuto: true }, maintenant }), 'E2 allumé sans date ⇒ éteint (jamais d’envoi sans SON geste daté)');
    dit(REG.eligibleAuto(it, { cfg: { envoiAuto: true, envoiAutoDepuis: depuis }, maintenant }), 'E3 allumé + vente prouvée après ⇒ part');
    dit(!REG.eligibleAuto({ ...it, venteLe: iso(maintenant - 2 * 86400e3) }, { cfg: { envoiAuto: true, envoiAutoDepuis: depuis }, maintenant }), 'E4 vente d’AVANT qu’il allume ⇒ ne part pas seule');
    dit(!REG.eligibleAuto({ ...it, envois: 1 }, { cfg: { envoiAuto: true, envoiAutoDepuis: depuis }, maintenant }) && !REG.eligibleAuto(it, { cfg: { envoiAuto: true, envoiAutoDepuis: depuis }, essai: { issue: 'refusee', at: iso(maintenant - 86400e3) }, maintenant }), 'E5 une tentative déjà faite (à la main ou seule) ⇒ jamais retentée seule');
    dit(!REG.eligibleAuto({ ...it, etat: 'pas-prouvee' }, { cfg: { envoiAuto: true, envoiAutoDepuis: depuis }, maintenant }) && !REG.eligibleAuto({ ...it, etat: 'a-annuler' }, { cfg: { envoiAuto: true, envoiAutoDepuis: depuis }, maintenant }), 'E6 pas prouvée ou annulée ⇒ ne part pas');
    const setters = [...src.matchAll(/envoiAuto: true/g)].length;
    dit(setters === 1 && /askConfirm\(\{ title: 'Envoyer les factures tout seul \?'/.test(src), 'E7 un seul endroit allume l’envoi auto, après SA confirmation');
  });

  // ══ S : le passage serveur (la VRAIE fonction serverless) ═════════════════
  const CFG = { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'franchise', prefixe: 'FA', couleur: '#0071e3', email: 'boutique@banc.test', envoiPar: 'vrm' };
  const UID = '4040';
  const semer = (owner, tx, { mail = {}, vinted = {}, tVente = maintenant - 3600e3 } = {}) => {
    base.set(cle(owner, 'email_sale_m' + tx), { type: 'vente', pro: true, transaction: tx, nomComplet: `Client ${tx}`, adresse: 'rue Inventée, 12, Paris, 75011, FR, France', email: `client${tx}@exemple.test`, designation: 'Asics banc', prix: '30.00', uid: UID, account: 'boutique_banc', receivedAt: iso(tVente + 60e3), ...mail });
    const k = cle(owner, `harvest_${UID}_orders_sold`);
    const d = base.get(k) || { capturedAt: iso(maintenant), payload: { my_orders: [] } };
    d.payload.my_orders.push({ transaction_id: Number(tx), title: 'Asics banc', price: { amount: '30.00', currency_code: 'EUR' }, status: 'Commande expédiée', date: iso(tVente), ...vinted });
    base.set(k, d);
  };
  const route = (await imp('api/ship-reminders.js')).default;
  const passer = async (auth = true) => { const r = faireRes(); await route({ method: 'GET', query: { moment: 'factures' }, headers: auth ? { authorization: 'Bearer cle-banc-cron' } : {} }, r); return r; };
  const facture = (o, tx) => base.get(cle(o, 'email_invoice_tx' + tx));
  await essaie('S', async () => {
    base = new Map(); smtp.recus = []; poserSmtp(false);
    base.set(cle(A, 'vrm_pro_facture'), { ...CFG });                                        // ÉTEINT
    base.set(cle(B, 'vrm_pro_facture'), { ...CFG, envoiAuto: true, envoiAutoDepuis: iso(maintenant - 86400e3) });
    semer(A, '7100000001');
    semer(B, '7200000001');                                                               // prouvée, après
    semer(B, '7200000002', { tVente: maintenant - 3 * 86400e3 });                          // AVANT qu'il allume
    semer(B, '7200000003', { tVente: maintenant - 5 * 3600e3, mail: { receivedAt: iso(maintenant - 3 * 3600e3) } }); // e-mail 2 h après ⇒ pas prouvée
    semer(B, '7200000004', { vinted: { status: 'Commande annulée' } });                    // annulée
    const r0 = await passer(false);
    dit(r0.code === 401 && smtp.recus.length === 0, 'S0 sans la clé du cron ⇒ 401, rien', String(r0.code));
    // SMTP absent : rien ne part, rien n'est numéroté, c'est DIT.
    const r1 = await passer();
    const j1 = base.get(cle(B, 'vrm_facture_auto'));
    dit(r1.code === 200 && smtp.recus.length === 0 && !facture(B, '7200000001') && !base.has(cle(B, 'vrm_invoice_counter')), 'S1 serveur d’envoi absent ⇒ rien ne part, aucun numéro pris', JSON.stringify(r1.corps));
    dit(j1 && j1.pause && j1.pause.code === 'smtp' && /rien n'est parti/.test(j1.pause.texte), 'S1 … et c’est dit (journal : pause « smtp »)', JSON.stringify(j1 && j1.pause));
    const g = faireRes(); await FP.routeFacturePro({ method: 'GET' }, g, { vendeur: { id: B }, corps: null, acces: true, cloisonnee: true });
    dit(g.code === 200 && g.corps.auto && g.corps.auto.pause && g.corps.auto.pause.code === 'smtp', 'S1 … et « Ma facture » le lit (GET)', JSON.stringify(g.corps.auto));
    // Fiche incomplète : rien, le manque nommé.
    poserSmtp(true);
    base.set(cle(B, 'vrm_pro_facture'), { ...base.get(cle(B, 'vrm_pro_facture')), siret: '' });
    await passer();
    const j2 = base.get(cle(B, 'vrm_facture_auto'));
    dit(smtp.recus.length === 0 && j2.pause && j2.pause.code === 'fiche' && /SIRET/.test(j2.pause.texte) && !base.has(cle(B, 'vrm_invoice_counter')), 'S2 fiche incomplète ⇒ rien ne part, le manque est nommé (SIRET)', JSON.stringify(j2.pause));
    base.set(cle(B, 'vrm_pro_facture'), { ...base.get(cle(B, 'vrm_pro_facture')), siret: SIRET });
    // Tout est prêt.
    const n0 = requetes.length;
    const r3 = await passer();
    const vus = new Set(requetes.slice(n0).map((x) => x.owner).filter(Boolean));
    dit(!vus.has(A) && !facture(A, '7100000001'), 'S3 vendeur qui n’a PAS allumé : jamais visité, rien émis', JSON.stringify([...vus].map((x) => x.slice(0, 2))));
    const f1 = facture(B, '7200000001');
    const m = smtp.recus[0] || { rcpt: [], data: '' };
    dit(f1 && f1.contenu && f1.envoi && f1.envoi.etat === 'envoyee' && f1.envoi.auto === true && smtp.recus.length === 1, 'S4 vente prouvée, après : émise ET envoyée, une fois, marquée « auto »', JSON.stringify(f1 && f1.envoi));
    dit(m.rcpt.some((x) => /client7200000001@exemple\.test/.test(x)) && m.rcpt.some((x) => /boutique@banc\.test/.test(x)) && m.rcpt.length === 2, 'S4 … à l’acheteur PROUVÉ, le vendeur en copie, personne d’autre', m.rcpt.join(' '));
    dit(!facture(B, '7200000002'), 'S5 vente d’avant qu’il allume ⇒ rien (elle reste dans « À envoyer »)');
    dit(!facture(B, '7200000003') || !facture(B, '7200000003').contenu, 'S6 acheteur pas prouvé ⇒ rien émis, rien envoyé');
    dit(!facture(B, '7200000004'), 'S7 vente annulée ⇒ jamais facturée seule');
    const j3 = base.get(cle(B, 'vrm_facture_auto'));
    dit(j3.essais['7200000003'] && j3.essais['7200000003'].issue === 'pas-prouvee' && /après la vente|heure/.test(j3.essais['7200000003'].raison), 'S6 … la raison est au journal', JSON.stringify(j3.essais['7200000003']));
    dit(!JSON.stringify(j3).includes('@exemple.test'), 'S8 le journal ne porte aucun e-mail d’acheteur');
    const txt = JSON.stringify(r3.corps || {});
    dit(r3.code === 200 && ![A, B].some((o) => txt.includes(o)) && !/7200000001/.test(txt), 'S9 la réponse ne porte que des nombres', txt.slice(0, 200));
    // Deuxième passage : rien ne repart.
    await passer();
    dit(smtp.recus.length === 1, 'S10 passage suivant : la facture ne repart pas', `${smtp.recus.length} message(s)`);
    // Sélection muette ⇒ 503, personne visité.
    pannes.add('envoiAuto=eq.true');
    const n1 = requetes.length; const r4 = await passer();
    dit(r4.code === 503 && requetes.slice(n1).every((x) => !x.owner || x.owner === NEUTRE), 'S11 sélection muette ⇒ 503, aucun vendeur visité', String(r4.code));
    pannes.clear();
  });

  // ══ N : la numérotation ═══════════════════════════════════════════════════
  const appel = async (owner, corps) => { const r = faireRes(); await FP.routeFacturePro({ method: 'POST' }, r, { vendeur: { id: owner }, corps, acces: true, cloisonnee: true }); return r; };
  await essaie('N', async () => {
    const n1 = facture(B, '7200000001').number;
    semer(B, '7200000010'); semer(B, '7200000011');
    const e1 = await appel(B, { action: 'emettre', confirme: true, tx: '7200000010' });
    const e1b = await appel(B, { action: 'emettre', confirme: true, tx: '7200000010' });
    dit(e1.corps.facture && e1b.corps.facture && e1.corps.facture.numero === e1b.corps.facture.numero && e1b.corps.deja === true, 'N1 la même vente émise deux fois : le MÊME numéro', `${e1.corps.facture && e1.corps.facture.numero}`);
    const av = await appel(B, { action: 'avoir', confirme: true, tx: '7200000010' });
    const e2 = await appel(B, { action: 'emettre', confirme: true, tx: '7200000011' });
    const suf = (n) => Number(String(n).slice(-4));
    dit(suf(n1) === 1 && suf(e1.corps.facture.numero) === 2 && suf(e2.corps.facture.numero) === 3, 'N2 continue : auto 0001, clic 0002, puis 0003 (jamais un trou)', [n1, e1.corps.facture.numero, e2.corps.facture.numero].join(' '));
    dit(av.corps.avoir && /^AV-\d{4}-0001$/.test(av.corps.avoir.numero) && e2.corps.facture.numero !== e1.corps.facture.numero, 'N3 un numéro annulé par un avoir n’est JAMAIS redonné ; l’avoir a SA série', `${av.corps.avoir && av.corps.avoir.numero}`);
    const f10 = facture(B, '7200000010');
    dit(f10 && f10.contenu && f10.number === e1.corps.facture.numero && f10.annuleePar === av.corps.avoir.numero, 'N4 la facture annulée reste là, intacte, liée à son avoir', JSON.stringify({ n: f10 && f10.number, par: f10 && f10.annuleePar }));
    const rows = [...base.entries()].filter(([k]) => k.startsWith(B + '|email_invoice_')).map(([k, d]) => ({ id: k.split('|')[1], numero: d.number, type: d.type, emiseLe: d.emiseLe }));
    const t = REG.trousNumerotation(rows);
    dit(t.facture.manquants.length === 0 && t.facture.max === 3 && t.avoir.max === 1, 'N5 le registre ne voit aucun trou', JSON.stringify(t));
  });

  // ══ D : aucune suppression ════════════════════════════════════════════════
  await essaie('D', async () => {
    const avant = [...base.keys()].filter((k) => /\|email_invoice_/.test(k)).sort().join();
    for (const action of ['supprimer', 'effacer', 'delete', 'retirer']) await appel(B, { action, confirme: true, tx: '7200000010' });
    await appel(B, { action: 'boite-retirer', confirme: true });
    const apres = [...base.keys()].filter((k) => /\|email_invoice_/.test(k)).sort().join();
    dit(avant === apres && !requetes.some((q) => q.methode === 'DELETE' && /email_invoice/.test(q.url)), 'D1 aucune action de la route ne supprime une facture (aucun DELETE sur email_invoice_*)');
    const sans = (f) => fs.readFileSync(path.join(racine, f), 'utf8').replace(/\/\/[^\n]*/g, '');
    const fp = sans('api/_lib/facture-pro.js'); const fa = sans('api/_lib/factures-auto.js'); const ui = sans('src/FacturePro.jsx');
    const deletes = (fp.match(/method: 'DELETE'/g) || []).length;
    dit(deletes === 1 && /url\(ID_BOITE, owner\), \{ method: 'DELETE'/.test(fp) && !/DELETE/.test(fa) && !/DELETE|'supprimer'/.test(ui), 'D2 le seul DELETE du code des factures retire la BOÎTE d’envoi, jamais une facture');
  });

  // ══ G : le registre et le zip ════════════════════════════════════════════
  await essaie('G', async () => {
    const rows = [
      { id: 'email_invoice_tx1', type: 'facture_pro', numero: 'FA-2026-0001', status: 'draft' },                         // brouillon d'avant
      { id: 'email_invoice_tx2', type: 'facture_pro', numero: 'FA-2026-0002', emiseLe: '2026-10-31T23:30:00Z', ttc: '3000', ht: '3000', acheteur: 'Marie; "Banc"', designation: 'Paire', regime: 'franchise', venteJour: '31/10/2026', envoi: { etat: 'envoyee', at: '2026-11-01T08:00:00Z' }, transaction: '2' },
      { id: 'email_invoice_tx4', type: 'facture_pro', numero: 'FA-2026-0004', emiseLe: '2026-11-05T10:00:00Z', ttc: '12950', ht: '10792', tva: '2158', regime: 'normal', transaction: '4' },
      { id: 'email_invoice_av4', type: 'avoir_pro', numero: 'AV-2026-0001', emiseLe: '2026-11-06T10:00:00Z', ttc: '-12950', ht: '-10792', tva: '-2158', origine: 'FA-2026-0004', transaction: '4' },
      { id: 'email_invoice_tx9', numero: 'VINTED-0099', status: 'recu', emiseLe: '2026-11-03T10:00:00Z', ttc: '5000' },                                                         // reçu d'ACHAT
    ];
    const t = REG.trousNumerotation(rows);
    dit(t.facture.manquants.join() === '3' && t.facture.brouillons.join() === '1' && t.avoir.manquants.length === 0, 'G1 trou dit (n° 3 pris sans pièce) ; le brouillon d’avant n’est pas un trou', JSON.stringify(t));
    const L = REG.lignesRegistre(rows);
    dit(L.length === 3 && L.every((x) => x.numero), 'G2 le registre : factures ET avoirs émis, ni brouillon ni reçu d’achat', L.map((x) => x.numero).join(','));
    const nov = L.filter((x) => REG.dansPeriode(x, '2026-11'));
    dit(nov.length === 3 && REG.periodesRegistre(L).mois.join() === '2026-11', 'G3 la période à l’heure de Paris (31/10 23 h 30 UTC = novembre)', nov.map((x) => x.numero).join(','));
    const csv = REG.csvRegistre(L);
    const lignesCsv = csv.replace(/^﻿/, '').trim().split('\r\n');
    dit(csv.startsWith('﻿') && lignesCsv.length === 4 && lignesCsv[0].split(';').length === REG.ENTETES_CSV.length && /;107,92;21,58;129,50;/.test(csv) && /;-107,92;-21,58;-129,50;/.test(csv) && /"Marie; ""Banc"""/.test(csv), 'G4 CSV : BOM, point-virgule, virgule décimale, avoir négatif, cellule échappée', lignesCsv[2]);
    const tot = REG.totauxRegistre(nov);
    dit(tot.ttc === 3000 && tot.n === 3 && tot.inconnus === 0, 'G5 le total de la période (avoir déduit)', JSON.stringify(tot));
    const { pdfFacture } = await imp('src/facturePro/pdf.js');
    const c = REGLE.contenuFacture(CFG, { acheteur: { nom: 'X', adresse: '1 rue\n75011 Paris', email: 'x@exemple.test' }, designation: 'Paire', centimes: 3000, venteLe: '2026-11-01T10:00:00Z', reference: '2', plateforme: 'Vinted' }, { numero: 'FA-2026-0002', emiseLe: Date.parse('2026-11-01T10:00:00Z') });
    const pdf = new Uint8Array(await pdfFacture(c));
    const zip = ZIP.zipStocke([{ nom: 'Registre-factures-2026-11.csv', texte: csv }, { nom: REGLE.nomFichier(c), octets: pdf }]);
    const relu = ZIP.lireZipStocke(zip);
    dit(relu.length === 2 && relu.every((x) => x.crcOk) && relu[1].nom === 'Facture-FA-2026-0002.pdf' && Buffer.from(relu[1].octets).slice(0, 5).toString() === '%PDF-' && relu[1].octets.length === pdf.length && Buffer.from(relu[0].octets).toString('utf8') === csv, 'G6 le zip : le CSV et le PDF intacts (octets, CRC)', relu.map((x) => `${x.nom}:${x.crcOk}`).join(' '));
    const ui = fs.readFileSync(path.join(racine, 'src', 'FacturePro.jsx'), 'utf8');
    dit(/if \(manque\.length\) \{[^\n]*rien n'a été téléchargé/.test(ui), 'G7 une pièce illisible ⇒ AUCUN zip (jamais un zip partiel)');
    dit(/select=id,contenu:data->contenu/.test(ui) && !/select=data[,'`&]/.test(ui.replace(/select=data->/g, '')), 'G8 aucune lecture `select=data` (projection du seul instantané)');
  });

  serveur.close();
  console.log(`\n${ko ? '❌' : '✅'} audit-factures-pro-2 : ${ok} vert(s), ${ko} rouge(s)`);
  if (!process.argv.includes('--prouve') || ko) process.exit(ko ? 1 : 0);

  // ── --prouve : chaque mutation doit rendre l'audit rouge ──────────────────
  const MUTATIONS = [
    ['api/_lib/facture-pro.js', 'numéro réattribué (réémission ⇒ nouveau n°)', "  if (ligne && ligne.contenu) return repondre(res, 200, { ok: true, deja: true, facture: facturePublique(ligne, id) });\n", ''],
    ['api/_lib/facture-pro.js', 'numéro réattribué (compteur qui ne monte pas)', '    const n = c.n + 1;', '    const n = Math.max(1, c.n);'],
    ['api/_lib/facture-pro.js', 'facture supprimée (action « supprimer »)', "  if (action === 'avoir') return avoir(owner, corps, res);", "  if (action === 'avoir') return avoir(owner, corps, res);\n  if (action === 'supprimer') { await fetch(url(idFacture(corps.tx), owner), { method: 'DELETE', headers: enTetes() }); return repondre(res, 200, { ok: true }); }"],
    ['api/_lib/factures-auto.js', 'envoi sans adresse prouvée', '    if (!eligibleAuto(it, { cfg, essai: deja || null, maintenant })) {', "    if (!(it.etat === 'pas-prouvee' || eligibleAuto(it, { cfg, essai: deja || null, maintenant }))) {"],
    ['api/_lib/factures-auto.js', 'SMTP absent pas vérifié', "  if (!conf.pret) return { code: 'smtp'", "  if (false) return { code: 'smtp'"],
    ['api/_lib/factures-auto.js', 'fiche incomplète pas vérifiée', '  if (mv.length) return { code:', '  if (false) return { code:'],
    ['src/facturePro/registre.js', 'auto allumé par défaut', "export const autoAllume = (cfg) => !!(cfg && cfg.envoiAuto === true && Number.isFinite(Date.parse(cfg.envoiAutoDepuis || '')));", 'export const autoAllume = (cfg) => !!cfg;'],
    ['src/facturePro/registre.js', 'ventes d’avant envoyées seules', '  if (!Number.isFinite(vente) || vente < depuis) return false;', ''],
    ['src/facturePro/registre.js', 'facture renvoyée seule', '  if (it.envois > 0) return false;\n  if (essai && essai.issue !== \'pas-prouvee\') return false;', ''],
    ['src/facturePro/registre.js', 'vente annulée facturée', "  if (annulee) return { ...base, etat: emise ? 'a-annuler' : 'annulee-sans-facture' };", ''],
    ['src/facturePro/registre.js', 'brouillon compté comme trou', "(estAvoir(x) ? series.avoir : series.facture).set(n, x.emiseLe ? 'emise' : 'brouillon');", "if (x.emiseLe) (estAvoir(x) ? series.avoir : series.facture).set(n, 'emise');"],
    ['src/facturePro/registre.js', 'reçu d’achat dans le registre', "const estPiece = (x) => !!(x && (x.type === 'facture_pro' || x.type === 'avoir_pro'));", 'const estPiece = (x) => !!x;'],
    ['src/FacturePro.jsx', 'zip partiel', "      if (manque.length) {", "      if (false) {"],
    ['api/ship-reminders.js', 'moment factures absent', "  if (moment === 'factures') {", '  if (false) {'],
  ];
  let rates = 0;
  for (const [fichier, nom, avant, apres] of MUTATIONS) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-fp2-'));
    for (const x of ['src', 'api']) fs.cpSync(path.join(RACINE_DEPOT, x), path.join(d, x), { recursive: true });
    fs.writeFileSync(path.join(d, 'package.json'), fs.readFileSync(path.join(RACINE_DEPOT, 'package.json')));
    fs.symlinkSync(path.dirname(path.dirname(require.resolve('web-push/package.json', { paths: [RACINE_DEPOT] }))), path.join(d, 'node_modules'));
    const p = path.join(d, fichier); const brut = fs.readFileSync(p, 'utf8');
    if (!brut.includes(avant)) { console.log(`KO  mutation introuvable : ${nom}`); rates++; fs.rmSync(d, { recursive: true, force: true }); continue; }
    fs.writeFileSync(p, brut.replace(avant, apres));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: d }, encoding: 'utf8', timeout: 120000 });
    const rouge = r.status !== 0;
    const premier = ((r.stdout || '').split('\n').find((l) => l.startsWith('❌ ') && !/audit-factures-pro-2/.test(l)) || '').slice(0, 110);
    console.log(`${rouge ? 'OK  rouge' : 'KO  VERT'} sous mutation : ${nom}${rouge ? ` (${premier})` : ''}`);
    if (!rouge) rates++;
    fs.rmSync(d, { recursive: true, force: true });
  }
  console.log(rates ? `❌ ${rates} mutation(s) pas attrapée(s)` : `✅ ${MUTATIONS.length}/${MUTATIONS.length} mutations attrapées`);
  process.exit(rates ? 1 : 0);
})().catch((e) => { console.log('❌ audit planté : ' + ((e && e.stack) || e)); process.exit(1); });
