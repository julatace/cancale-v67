#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LA FACTURE PRO (2 novembre)
// ════════════════════════════════════════════════════════════════════════════
// Exécute la VRAIE route (api/_lib/facture-pro.js) contre :
//   · une fausse base Supabase (la forme réelle : app_data owner/id/data, filtres
//     `id=eq.`, `owner=eq.`, `data->>rev=eq.|is.null`, `data=eq.N`, `data->>n=eq.N`,
//     PATCH `return=representation`, POST 409 sur doublon) ;
//   · un FAUX SERVEUR D'ENVOI local, en TLS (certificat fabriqué ici), qui parle
//     SMTP pour de vrai (EHLO, AUTH PLAIN, MAIL, RCPT, DATA) et garde ce qu'il reçoit.
// Aucune donnée réelle : vendeurs, acheteurs, SIRET (clé de Luhn calculée) inventés.
//
// Ce qui est prouvé :
//   N  la numérotation : continue, sans trou ni doublon (concurrence, même vente
//      cliquée deux fois, compteur d'avant en nombre, brouillon déjà numéroté,
//      compteur illisible ⇒ rien) ;
//   M  les mentions : franchise (293 B), marge (pas de TVA, mention), TVA (HT+TVA=TTC),
//      fiche incomplète ⇒ refus avec la liste ;
//   E  l'envoi : le PDF arrive en pièce jointe chez l'acheteur, copie au vendeur,
//      formulaire de retour joint puis purgé ; pas de double envoi ; refus et
//      coupure dits tels quels (refusée / incertaine) ;
//   B  la boîte : mot de passe faux ⇒ rien rangé ; rangé chiffré ; jamais relu ;
//   A  l'avoir : numéroté à part, montants négatifs, lié à la facture ;
//   P  le PDF : il s'ouvre (en-tête %PDF), porte le numéro et la mention.
// (6 nov.) Et :
//   R  la règle de rattachement (src/facturePro/rattachement.js), EXÉCUTÉE :
//      tx identique + heure dans la fenêtre + même montant ⇒ prouvé ; tx absent,
//      heure hors fenêtre, montant ou devise différents, autre compte, deux
//      candidats (deux e-mails, deux ventes), même pseudo sur une autre tx,
//      brouillon d'un autre acheteur ⇒ RIEN ; 50 paires identiques (même titre,
//      même prix, même minute) : chacune désigne SON acheteur ;
//   V  la route : le serveur relit lui-même la preuve (l'acheteur envoyé par le
//      navigateur est ignoré), refuse sans preuve, et l'envoi PAR VRM :
//      From = « <vendeur> via VRM » <adresse de VRM>, Reply-To = vendeur, Cc =
//      vendeur, To = l'acheteur PROUVÉ, texte + HTML, Message-ID, Date, jamais de
//      List-Unsubscribe ; SMTP de VRM absent ⇒ rien ne part ; plafond du jour ;
//      écriture ratée ⇒ rien ne part ; preuve devenue fausse ⇒ rien ne part ;
//      journal des envois ;
//   M10-M13 l'aperçu de « Ma facture » : chaque mention obligatoire manquante
//      est un trou « à compléter », aucune valeur témoin ne fuit ; une facture
//      complète porte les 14 mentions ;
//   N10 un numéro annulé par un avoir n'est jamais redonné.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const tls = require('tls');
const { execFileSync } = require('child_process');
const racine = path.resolve(__dirname, '..');

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };

// ── Un SIRET inventé dont la clé de Luhn est juste ─────────────────────────
const luhn = (s) => { let t = 0; for (let i = 0; i < s.length; i++) { let n = +s[s.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; } return t % 10 === 0; };
const sirenInvente = () => { for (let k = 0; k < 10; k++) if (luhn('90012345' + k)) return '90012345' + k; };
const SIREN = sirenInvente();
const SIRET = (() => { for (let k = 0; k < 100000; k++) { const s = SIREN + String(k).padStart(5, '0'); if (luhn(s)) return s; } })();

// ── La fausse base ─────────────────────────────────────────────────────────
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
let base = new Map();                         // `${owner}|${id}` → data
const pannes = new Set();                     // ids dont la LECTURE échoue
const requetes = [];
const cle = (o, i) => `${o}|${i}`;
const filtreOk = (data, f) => {
  if (!f) return true;
  let m;
  if ((m = /^data->>rev=eq\.(.*)$/.exec(f))) return data && String(data.rev) === decodeURIComponent(m[1]);
  if (f === 'data->>rev=is.null') return data && (data.rev == null);
  if ((m = /^data->>n=eq\.(\d+)$/.exec(f))) return data && typeof data === 'object' && String(data.n) === m[1];
  if ((m = /^data=eq\.(\d+)$/.exec(f))) return JSON.stringify(data) === m[1];
  throw new Error('filtre inconnu du banc : ' + f);
};
global.fetch = async (u, o = {}) => {
  const url = new URL(u);
  const methode = (o.method || 'GET').toUpperCase();
  requetes.push({ methode, url: decodeURIComponent(url.search) });
  const rep = (code, corps) => ({ ok: code >= 200 && code < 300, status: code, json: async () => corps, text: async () => JSON.stringify(corps) });
  if (!url.pathname.endsWith('/rest/v1/app_data')) return rep(404, {});
  const q = url.searchParams;
  const id = (q.get('id') || '').replace(/^eq\./, '');
  const owner = (q.get('owner') || '').replace(/^eq\./, '');
  const autres = [...q.entries()].filter(([k]) => !['id', 'owner', 'select', 'on_conflict'].includes(k)).map(([k, v]) => `${k}=${v}`);
  if (methode === 'GET') {
    if (!owner) return rep(400, { message: 'lecture sans vendeur' });
    const like = (q.get('id') || '').startsWith('like.') ? q.get('id').slice(5) : null;
    if (like) {
      // Une LISTE : la vraie forme PostgREST (filtres `data->>k=eq.v`, `data->a->b=cs.[…]`, projection `alias:data->…`).
      if ([...pannes].some((x) => x === 'like:' + like)) return rep(522, '<html>');
      const re = new RegExp('^' + like.replace(/[.]/g, '\\.').replace(/\*/g, '.*') + '$');
      const fil = autres.map((f) => { const m = /^(data(?:->>?[A-Za-z_]+)+)=(eq|cs)\.(.*)$/.exec(f); if (!m) throw new Error('filtre inconnu du banc : ' + f); return m; });
      const val = (data, chemin) => { let v = { data }; for (const seg of chemin.split(/->>?/)) v = v == null ? undefined : v[seg]; return v; };
      const contient = (a, b) => (Array.isArray(b) ? Array.isArray(a) && b.every((x) => a.some((y) => contient(y, x))) : b && typeof b === 'object' ? a && typeof a === 'object' && Object.entries(b).every(([k, v]) => contient(a[k], v)) : a === b);
      const lignes = [...base.entries()].filter(([k]) => k.startsWith(owner + '|')).map(([k, d]) => ({ id: k.slice(owner.length + 1), data: d }))
        .filter((r) => re.test(r.id))
        .filter((r) => fil.every(([, ch, op, v]) => (op === 'eq' ? String(val(r.data, ch)) === v : contient(val(r.data, ch), JSON.parse(v)))));
      const sel = (q.get('select') || 'data').split(',');
      return rep(200, lignes.map((r) => Object.fromEntries(sel.map((x) => { const [al, src] = x.includes(':') ? x.split(':') : [x.split(/->>?/).pop(), x]; if (src === 'id') return [al, r.id]; if (src === 'data') return [al, r.data]; const v = val(r.data, src); return [al, v == null ? null : /->>[A-Za-z_]+$/.test(src) && typeof v !== 'string' ? String(v) : v]; }))));
    }
    if (pannes.has(id)) return rep(522, '<html>');
    const d = base.get(cle(owner, id));
    if (d === undefined) return rep(200, []);
    return rep(200, [{ id, data: d }]);
  }
  if (methode === 'POST') {
    const lignes = JSON.parse(o.body);
    const fusion = /merge-duplicates/.test((o.headers || {}).Prefer || (o.headers || {}).prefer || '');
    for (const l of lignes) {
      if (!l.owner) return rep(400, { message: 'écriture sans vendeur' });
      if (base.has(cle(l.owner, l.id)) && !fusion) return rep(409, { message: 'doublon' });
    }
    for (const l of lignes) base.set(cle(l.owner, l.id), JSON.parse(JSON.stringify(l.data)));
    return rep(201, null);
  }
  if (methode === 'PATCH') {
    if (pannes.has('patch:' + id)) return rep(503, {});
    const k = cle(owner, id);
    if (!owner || !base.has(k)) return rep(200, []);
    const d = base.get(k);
    if (!autres.every((f) => filtreOk(d, f))) return rep(200, []);
    base.set(k, JSON.parse(o.body).data);
    return rep(200, [{ id }]);
  }
  if (methode === 'DELETE') { if (!owner) return rep(400, {}); base.delete(cle(owner, id)); return rep(204, null); }
  return rep(405, {});
};

// ── Le faux serveur d'envoi (TLS + SMTP) ───────────────────────────────────
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-smtp-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dossier, 'k.pem'), '-out', path.join(dossier, 'c.pem'), '-days', '1', '-subj', '/CN=banc.local'], { stdio: 'ignore' });
const CERT = fs.readFileSync(path.join(dossier, 'c.pem'));
const MDP = 'abcd efgh ijkl mnop';
const smtp = { recus: [], mode: 'ok', connexions: 0 };
const serveur = tls.createServer({ key: fs.readFileSync(path.join(dossier, 'k.pem')), cert: CERT }, (s) => {
  smtp.connexions++;
  let tampon = ''; let enData = false; let msg = { rcpt: [], from: '', data: '' };
  s.write('220 banc ESMTP\r\n');
  s.on('data', (d) => {
    tampon += d.toString('utf8');
    for (;;) {
      if (enData) {
        const fin = tampon.indexOf('\r\n.\r\n');
        if (fin < 0) return;
        msg.data = tampon.slice(0, fin); tampon = tampon.slice(fin + 5); enData = false;
        if (smtp.mode === 'coupe') { s.destroy(); return; }
        smtp.recus.push(msg); msg = { rcpt: [], from: '', data: '' };
        s.write('250 2.0.0 OK reçu\r\n'); continue;
      }
      const i = tampon.indexOf('\r\n'); if (i < 0) return;
      const l = tampon.slice(0, i); tampon = tampon.slice(i + 2);
      if (/^EHLO/i.test(l)) s.write('250-banc\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
      else if (/^AUTH PLAIN /i.test(l)) {
        const [, u, p] = Buffer.from(l.slice(11), 'base64').toString('utf8').split('\u0000');
        s.write((u === 'boutique@banc.test' && p === MDP.replace(/\s/g, '')) || (u === 'vrm-banc' && p === 'mdp-vrm-banc') ? '235 ok\r\n' : '535 5.7.8 Identifiants refusés\r\n');
      } else if (/^MAIL FROM:/i.test(l)) { msg.from = l.slice(10); s.write('250 ok\r\n'); }
      else if (/^RCPT TO:/i.test(l)) { if (smtp.mode === 'rcpt-refuse') s.write('550 5.1.1 Destinataire inconnu\r\n'); else { msg.rcpt.push(l.slice(8)); s.write('250 ok\r\n'); } }
      else if (/^DATA/i.test(l)) { enData = true; s.write('354 vas-y\r\n'); }
      else if (/^QUIT/i.test(l)) { s.write('221 bye\r\n'); s.end(); }
      else s.write('502 ?\r\n');
    }
  });
  s.on('error', () => {});
});

const faireRes = () => { const r = { code: 0, corps: null }; r.status = (c) => { r.code = c; return { json: (j) => { r.corps = j; return r; } }; }; return r; };

(async () => {
  await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
  const port = serveur.address().port;
  process.env.SUPABASE_SERVICE_KEY = 'sb_secret_banc';
  process.env.VRM_COFFRE_CLE = 'cle-de-coffre-du-banc';
  process.env.SMTP_DELAI_MS = '3000';
  const smtpMod = await import(path.join(racine, 'api/_lib/smtp.js'));
  smtpMod._banc.connecter = () => new Promise((okc, koc) => { const s = tls.connect({ host: '127.0.0.1', port, ca: CERT, servername: 'banc.local' }, () => okc(s)); s.once('error', koc); });
  const R = await import(path.join(racine, 'api/_lib/facture-pro.js'));
  const regle = await import(path.join(racine, 'src/facturePro/regle.js'));
  const { pdfFacture } = await import(path.join(racine, 'src/facturePro/pdf.js'));
  const appel = async (owner, corps, methode = 'POST') => { const r = faireRes(); await R.routeFacturePro({ method: methode }, r, { vendeur: { id: owner }, corps, acces: true, cloisonnee: true }); return r; };

  const CFG = { nom: 'Boutique Banc', forme: 'EI', siret: SIRET, adresse: '1 rue du Banc', codePostal: '35000', ville: 'Rennes', tva_regime: 'franchise', prefixe: 'FA', couleur: '#0071e3', email: 'boutique@banc.test' };
  // (6 nov.) Une vente Pro = sa PREUVE en base : l'e-mail de vente Vinted Pro
  // (forme `email_sale_*`) et la vente Vinted (`orders_sold` du compte), même n°,
  // e-mail arrivé 60 s après, même prix. `semer:false` : rien en base.
  const UID = '4040';
  const semer = (owner, tx, { mail = {}, vinted = {}, uid = UID, sansMail = false, sansVinted = false } = {}) => {
    if (!sansMail) base.set(cle(owner, 'email_sale_m' + tx + (mail._suffixe || '')), { type: 'vente', pro: true, transaction: tx, pseudo: 'acheteuse_banc', nomComplet: 'Marie Banc', adresse: 'rue Inventée, 12, Paris, 75011, FR, France', email: 'marie.banc@exemple.test', designation: 'Asics Metaspeed banc - Taille 43,5', prix: '30.00', uid, receivedAt: '2026-10-30T22:31:00.000Z', ...mail });
    if (!sansVinted) {
      const k = cle(owner, `harvest_${vinted._uid || uid}_orders_sold`);
      const d = base.get(k) || { capturedAt: '2026-10-30T23:00:00Z', payload: { my_orders: [] } };
      d.payload.my_orders.push({ transaction_id: Number(tx), title: 'Asics Metaspeed banc - Taille 43,5', price: { amount: '30.00', currency_code: 'EUR' }, status: 'Commande expédiée', date: '2026-10-30T22:30:00Z', ...vinted });
      base.set(k, d);
    }
  };
  const vente = (tx, extra = {}) => { const { semer: sem = true, preuve = {}, ...reste } = extra; if (sem && !base.has(cle(A, 'email_sale_m' + tx))) semer(A, tx, preuve); return { action: 'emettre', confirme: true, tx, compte: 'boutique_banc', acheteur: { nom: 'Marie Banc', adresse: '12 rue Inventée\n75011 Paris', email: 'marie.banc@exemple.test' }, designation: 'Asics Metaspeed banc - Taille 43,5', centimes: 3000, venteLe: '2026-10-30T22:30:00Z', ...reste }; };
  const venteB = (tx) => { if (!base.has(cle(B, 'email_sale_m' + tx))) semer(B, tx); return { action: 'emettre', confirme: true, tx, compte: 'autre', designation: 'Banc B' }; };
  const raz = () => { base = new Map(); pannes.clear(); requetes.length = 0; smtp.recus = []; smtp.mode = 'ok'; };
  const annee = new Date().getFullYear();

  // ══ N : LA NUMÉROTATION ═══════════════════════════════════════════════════
  raz(); base.set(cle(A, 'vrm_pro_facture'), CFG); base.set(cle(A, 'vrm_invoice_counter'), 5);
  const r1 = await appel(A, vente('23000000001'));
  dit(r1.code === 200 && r1.corps.facture.numero === `FA-${annee}-0006`, 'N1 compteur d’avant (le nombre 5) : la facture suivante est la 0006', JSON.stringify(r1.corps));
  dit(JSON.stringify(base.get(cle(A, 'vrm_invoice_counter'))).includes('"n":6'), 'N1 le compteur passe à 6 et garde le journal', JSON.stringify(base.get(cle(A, 'vrm_invoice_counter'))));
  const r1b = await appel(A, vente('23000000001', { designation: 'AUTRE TITRE', centimes: 1 }));
  dit(r1b.corps.deja === true && r1b.corps.facture.numero === `FA-${annee}-0006` && r1b.corps.facture.contenu.lignes[0].designation === 'Asics Metaspeed banc - Taille 43,5',
    'N2 la même vente émise deux fois : la MÊME facture, contenu inchangé (pas de second numéro, pas de réécriture)', JSON.stringify(r1b.corps.facture && r1b.corps.facture.numero));
  // Concurrence : 6 ventes différentes en même temps + la même vente 3 fois.
  const lots = await Promise.all([...['02', '03', '04', '05', '06', '07'].map((n) => appel(A, vente('230000000' + n))), appel(A, vente('23000000099')), appel(A, vente('23000000099')), appel(A, vente('23000000099'))]);
  const nums = lots.slice(0, 6).map((r) => r.corps.facture && r.corps.facture.numero);
  const n99 = lots.slice(6).map((r) => r.corps.facture && r.corps.facture.numero);
  const tous = [...nums, n99[0]].map((x) => Number(String(x).slice(-4))).sort((a, b) => a - b);
  dit(new Set(nums).size === 6 && !nums.includes(undefined), 'N3 six ventes émises EN MÊME TEMPS : six numéros différents', nums.join(', '));
  dit(new Set(n99).size === 1, 'N4 la même vente cliquée trois fois en même temps : un seul numéro', n99.join(', '));
  dit(tous.join(',') === '7,8,9,10,11,12,13', 'N5 aucun trou : 0007 → 0013 exactement', tous.join(','));
  // Brouillon d'avant, déjà numéroté (FA-2026-0003, jamais envoyé) : il garde SON numéro.
  base.set(cle(A, 'email_invoice_tx23000000500'), { type: 'facture_pro', number: 'FA-2026-0003', status: 'draft', buyerEmail: 'marie.banc@exemple.test', retourB64: Buffer.from('%PDF-1.4 retour').toString('base64'), retourNom: 'Formulaire-retour-commande-23000000500.pdf', html: '<p>vieux</p>' });
  const avantCompteur = JSON.stringify(base.get(cle(A, 'vrm_invoice_counter')));
  const r5 = await appel(A, vente('23000000500'));
  dit(r5.corps.facture.numero === 'FA-2026-0003' && JSON.stringify(base.get(cle(A, 'vrm_invoice_counter'))) === avantCompteur, 'N6 un brouillon numéroté avant le 2 nov. garde SON numéro, le compteur ne bouge pas', r5.corps.facture.numero);
  dit(base.get(cle(A, 'email_invoice_tx23000000500')).retourB64 && base.get(cle(A, 'email_invoice_tx23000000500')).html === '', 'N6 … son formulaire de retour est gardé, l’ancien HTML retiré', '');
  // Compteur illisible : RIEN.
  raz(); base.set(cle(A, 'vrm_pro_facture'), CFG); base.set(cle(A, 'vrm_invoice_counter'), 41); pannes.add('vrm_invoice_counter');
  const r6 = await appel(A, vente('23000000010'));
  dit(r6.code === 503 && !base.has(cle(A, 'email_invoice_tx23000000010')) && base.get(cle(A, 'vrm_invoice_counter')) === 41, 'N7 compteur illisible : 503, aucune facture, compteur intact', `HTTP ${r6.code}`);
  // Fiche illisible : RIEN.
  pannes.clear(); pannes.add('vrm_pro_facture');
  const r7 = await appel(A, vente('23000000010'));
  dit(r7.code === 503 && base.get(cle(A, 'vrm_invoice_counter')) === 41, 'N8 fiche entreprise illisible : 503, aucun numéro pris', `HTTP ${r7.code}`);
  // Deux vendeurs : chacun SA séquence, aucune lecture sans vendeur.
  raz(); base.set(cle(A, 'vrm_pro_facture'), CFG); base.set(cle(B, 'vrm_pro_facture'), { ...CFG, nom: 'Autre Banc' });
  await appel(A, vente('23000000020')); const rb = await appel(B, venteB('23000000021'));
  dit(rb.corps.facture.numero === `FA-${annee}-0001`, 'N9 chaque vendeur a SA séquence (B commence à 0001)', rb.corps.facture.numero);
  dit(requetes.every((q) => /owner=eq\./.test(q.url) || q.methode === 'POST'), 'N9 aucune requête sans filtre de vendeur', requetes.filter((q) => !/owner=eq\./.test(q.url)).map((q) => q.methode + q.url).slice(0, 2).join(' | '));

  // ══ M : LES MENTIONS ══════════════════════════════════════════════════════
  raz(); base.set(cle(A, 'vrm_pro_facture'), { ...CFG, siret: '123', tva_regime: undefined, forme: 'SASU' });
  const m0 = await appel(A, vente('23000000030'));
  const champs = (m0.corps.manquants || []).map((x) => x.champ).sort().join(',');
  dit(m0.code === 409 && /siret/.test(champs) && /tva_regime/.test(champs) && /rcs/.test(champs) && /capital/.test(champs) && !base.has(cle(A, 'vrm_invoice_counter')),
    'M1 fiche incomplète : refus nommé (SIRET, régime de TVA, RCS et capital d’une société), aucun numéro pris', champs);
  base.set(cle(A, 'vrm_pro_facture'), CFG);
  const m0b = await appel(A, vente('23000000031', { preuve: { mail: { nomComplet: '', adresse: '' } } }));
  dit(m0b.code === 409 && m0b.corps.erreur === 'pas-prouve' && m0b.corps.code === 'acheteur' && /nom/.test(m0b.corps.raison) && /adresse/.test(m0b.corps.raison) && !base.has(cle(A, 'vrm_invoice_counter')), 'M2 e-mail de vente sans nom ni adresse d’acheteur : refusé, dit, aucun numéro pris', JSON.stringify(m0b.corps));
  const C = (cfg, v = {}) => regle.contenuFacture({ ...CFG, ...cfg }, { acheteur: { nom: 'X', adresse: 'Y', email: '' }, designation: 'Z', centimes: 12950, venteLe: '2026-10-30T22:30:00Z', ...v }, { numero: 'FA-2026-0001', emiseLe: Date.parse('2026-11-02T10:00:00Z') });
  const cf = C({ tva_regime: 'franchise' });
  dit(cf.mentions.includes('TVA non applicable, art. 293 B du CGI') && cf.totaux.tva === null && cf.totaux.ttc === 12950, 'M3 franchise : « TVA non applicable, art. 293 B du CGI », aucune TVA', JSON.stringify(cf.totaux));
  const cm = C({ tva_regime: 'marge', tva: 'FR00' + SIREN });
  dit(cm.mentions.some((m) => /Régime particulier – Biens d'occasion/.test(m)) && cm.totaux.tva === null, 'M4 marge : mention « Biens d’occasion », la TVA n’apparaît JAMAIS (art. 297 E)', JSON.stringify(cm.mentions));
  const cn = C({ tva_regime: 'normal', tva_taux: 20, tva: 'FR00' + SIREN });
  dit(cn.totaux.ht + cn.totaux.tva === cn.totaux.ttc && cn.totaux.ht === 10792 && cn.totaux.tva === 2158, 'M5 TVA 20 % : HT 107,92 + TVA 21,58 = TTC 129,50, au centime', JSON.stringify(cn.totaux));
  dit(regle.manquantsVendeur({ ...CFG, tva_regime: 'marge', tva: '' }).some((x) => x.champ === 'tva'), 'M6 marge ou TVA sans n° de TVA intracom : refusé', '');
  dit(cf.vendeur.nom === 'Boutique Banc EI' && cf.vendeur.legal.some((l) => l.startsWith('SIRET ')), 'M7 entrepreneur individuel : « EI » accolé au nom, SIRET écrit', JSON.stringify(cf.vendeur));
  dit(cf.venteJour === '30/10/2026' && cf.emiseJour === '02/11/2026', 'M8 dates à l’heure de Paris (une vente à 23 h 30 UTC reste le 30)', `${cf.venteJour} · ${cf.emiseJour}`);
  const cav = C({ tva_regime: 'franchise' }, { venteLe: '2026-10-31T23:30:00Z' });
  dit(cav.venteJour === '01/11/2026', 'M8 … et 23 h 30 UTC le 31 octobre est le 1er novembre à Paris', cav.venteJour);

  const adr = regle.adresseVintedLisible;
  dit(adr('rue de la Paix, 12, Saint Malo, 35400, FR, France') === '12 rue de la Paix\n35400 Saint Malo' && adr('12 rue Inventée, Lisbonne, 1000-001, PT, Portugal') === '12 rue Inventée\n1000-001 Lisbonne\nPortugal' && adr('forme inconnue') === 'forme inconnue',
    'M9 l’adresse de l’e-mail Vinted Pro remise en lignes postales (pays dit hors de France), une forme inconnue rendue telle quelle', JSON.stringify(adr('rue de la Paix, 12, Saint Malo, 35400, FR, France')));

  // ══ P : LE PDF ════════════════════════════════════════════════════════════
  const octets = Buffer.from(await pdfFacture(cn));
  dit(octets.slice(0, 5).toString() === '%PDF-' && octets.length > 1500, 'P1 le PDF s’ouvre (en-tête %PDF, taille plausible)', `${octets.length} octets`);
  const PL = require(path.join(racine, 'node_modules/pdf-lib'));
  const doc = await PL.PDFDocument.load(octets);
  dit(doc.getPageCount() === 1 && /FA-2026-0001/.test(doc.getTitle() || ''), 'P2 une page, titrée du numéro', doc.getTitle());
  const emoji = Buffer.from(await pdfFacture(C({ tva_regime: 'franchise' }, { designation: 'Air Max 👟 « Infrared » 漢字 ' + 'x'.repeat(400) })));
  dit(emoji.slice(0, 5).toString() === '%PDF-', 'P3 emoji, idéogrammes et titre interminable : le PDF se fait quand même', `${emoji.length} octets`);
  dit(!/Cancale|VRM/.test(octets.toString('latin1').replace(/\/Producer[^\n]*/g, '')), 'P4 aucune marque VRM sur la facture du vendeur', '');

  // ══ B : LA BOÎTE D'ENVOI ═════════════════════════════════════════════════
  raz(); base.set(cle(A, 'vrm_pro_facture'), CFG);
  const b0 = await appel(A, { action: 'boite-poser', adresse: 'boutique@banc.test', motDePasse: 'faux', fournisseur: 'gmail' });
  dit(b0.code === 400 && !base.has(cle(A, R.ID_BOITE)), 'B1 mot de passe refusé par la boîte : rien n’est rangé', JSON.stringify(b0.corps));
  const b1 = await appel(A, { action: 'boite-poser', adresse: 'Boutique@banc.test', motDePasse: MDP, fournisseur: 'gmail' });
  const ligneB = base.get(cle(A, R.ID_BOITE));
  dit(b1.code === 200 && ligneB && /^v1\./.test(ligneB.chiffre) && !JSON.stringify(ligneB).includes(MDP.replace(/\s/g, '')), 'B2 identifiants vérifiés puis rangés CHIFFRÉS (le mot de passe n’apparaît nulle part en clair)', JSON.stringify(b1.corps));
  dit(smtp.recus.length === 0, 'B3 la vérification n’envoie aucun message', `${smtp.recus.length} message(s)`);
  const g = await appel(A, null, 'GET');
  dit(g.code === 200 && g.corps.boite.etat === 'posee' && !JSON.stringify(g.corps).includes('chiffre') && !JSON.stringify(g.corps).includes(MDP.replace(/\s/g, '')), 'B4 l’app apprend « connectée » et l’adresse — jamais le mot de passe ni le chiffré', JSON.stringify(g.corps.boite));
  const hv = smtpMod.hoteValide;
  dit(hv('smtp.gmail.com') && hv('ssl0.ovh.net') && !hv('127.0.0.1') && !hv('10.0.0.5') && !hv('172.16.0.1') && !hv('localhost') && !hv('smtp.internal') && !hv('metadata.google.internal'), 'B6 le serveur d’envoi est un NOM public (jamais une IP ni un nom local)', '');
  const e0 = await appel(A, { action: 'boite-essai' });
  dit(e0.corps.issue === 'envoye' && smtp.recus.length === 1 && /boutique@banc\.test/.test(smtp.recus[0].rcpt[0]), 'B5 l’e-mail d’essai part à SA propre adresse', JSON.stringify(e0.corps));

  // ══ E : L'ENVOI À L'ACHETEUR, DEPUIS SA BOÎTE (envoiPar: 'boite') ═════════
  smtp.recus = []; base.set(cle(A, 'vrm_pro_facture'), { ...CFG, envoiPar: 'boite' });
  base.set(cle(A, 'email_invoice_tx23000000040'), { type: 'facture_pro', number: '', status: 'draft', transaction: '23000000040', retourB64: Buffer.from('%PDF-1.4 formulaire').toString('base64'), retourNom: 'Formulaire-retour-commande-23000000040.pdf' });
  const em = await appel(A, vente('23000000040'));
  const env = await appel(A, { action: 'envoyer', tx: '23000000040', confirme: true });
  const m = smtp.recus[0] || { rcpt: [], data: '' };
  dit(env.corps.issue === 'envoye' && env.corps.envoi.etat === 'envoyee', 'E1 la facture part : « envoyée »', JSON.stringify(env.corps.envoi));
  dit(m.rcpt.some((x) => /marie\.banc@exemple\.test/.test(x)) && m.rcpt.some((x) => /boutique@banc\.test/.test(x)) && /^From: .*<boutique@banc\.test>/m.test(m.data), 'E2 de SA boîte, à l’acheteur, copie cachée au vendeur', m.rcpt.join(' '));
  const pj = /filename="(Facture-[^"]+\.pdf)"[\s\S]*?\r\n\r\n([A-Za-z0-9+/=\r\n]+)/.exec(m.data);
  dit(pj && pj[1] === `Facture-FA-${annee}-0001.pdf` && Buffer.from(pj[2].replace(/\s/g, ''), 'base64').slice(0, 5).toString() === '%PDF-', 'E3 le PDF de la facture est joint et s’ouvre', pj ? pj[1] : 'aucune pièce jointe');
  dit(/Formulaire-retour-commande-23000000040\.pdf/.test(m.data), 'E4 le formulaire de retour de Vinted est joint', '');
  const apres = base.get(cle(A, 'email_invoice_tx23000000040'));
  dit(apres.status === 'sent' && !apres.retourB64 && apres.retourNom && apres.contenu.numero === em.corps.facture.numero, 'E5 après l’envoi : « sent », octets du formulaire purgés, instantané intact', `${apres.status}`);
  const env2 = await appel(A, { action: 'envoyer', tx: '23000000040', confirme: true });
  dit(env2.code === 409 && env2.corps.erreur === 'deja' && smtp.recus.length === 1, 'E6 un second clic n’envoie pas deux fois (sans « Renvoyer » explicite)', JSON.stringify(env2.corps.erreur));
  const env3 = await appel(A, { action: 'envoyer', tx: '23000000040', confirme: true, renvoyer: true });
  dit(env3.corps.issue === 'envoye' && smtp.recus.length === 2 && /Facture-FA-\d{4}-0001\.pdf/.test(smtp.recus[1].data), 'E7 « Renvoyer » renvoie LA MÊME facture (même numéro)', '');
  // Refus du destinataire : « refusée », jamais « envoyée ».
  await appel(A, vente('23000000041')); smtp.mode = 'rcpt-refuse';
  const er = await appel(A, { action: 'envoyer', tx: '23000000041', confirme: true });
  dit(er.corps.issue === 'refuse' && base.get(cle(A, 'email_invoice_tx23000000041')).envoi.etat === 'refusee' && base.get(cle(A, 'email_invoice_tx23000000041')).status !== 'sent', 'E8 destinataire refusé : « refusée » avec la raison, rien de marqué envoyé', JSON.stringify(er.corps.envoi));
  // Coupure APRÈS le message : « incertaine », pas « refusée ».
  smtp.mode = 'coupe';
  const ec = await appel(A, { action: 'envoyer', tx: '23000000041', confirme: true });
  dit(ec.corps.issue === 'incertain' && base.get(cle(A, 'email_invoice_tx23000000041')).envoi.etat === 'incertaine', 'E9 coupure après le message : « incertaine » (il a peut-être été reçu), jamais « refusée »', JSON.stringify(ec.corps.envoi));
  smtp.mode = 'ok';
  const ec2 = await appel(A, { action: 'envoyer', tx: '23000000041', confirme: true });
  dit(ec2.code === 409, 'E10 après un envoi incertain, pas de renvoi sans « Renvoyer » explicite', `HTTP ${ec2.code}`);
  // Base muette au moment de marquer « en cours » : rien ne part.
  await appel(A, vente('23000000042')); const nAvant = smtp.recus.length; pannes.add('email_invoice_tx23000000042');
  const eb = await appel(A, { action: 'envoyer', tx: '23000000042', confirme: true });
  dit(eb.code === 503 && smtp.recus.length === nAvant, 'E11 base muette : 503, rien n’est parti', `HTTP ${eb.code}`);
  pannes.clear();
  // Pas de boîte : refus clair.
  base.delete(cle(A, R.ID_BOITE));
  const enb = await appel(A, { action: 'envoyer', tx: '23000000042', confirme: true });
  dit(enb.code === 409 && enb.corps.erreur === 'boite', 'E12 aucune boîte connectée : refus qui dit le geste', enb.corps.message);

  // ══ A : L'AVOIR ═══════════════════════════════════════════════════════════
  const av = await appel(A, { action: 'avoir', tx: '23000000040', confirme: true });
  const ca = av.corps.avoir && av.corps.avoir.contenu;
  dit(ca && ca.numero === `AV-${annee}-0001` && ca.origine === `FA-${annee}-0001` && ca.totaux.ttc === -3000, 'A1 l’avoir : AV-…-0001, annule la facture, montant négatif', ca && `${ca.numero} · ${ca.origine} · ${ca.totaux.ttc}`);
  dit(base.get(cle(A, 'email_invoice_tx23000000040')).annuleePar === ca.numero && base.get(cle(A, 'email_invoice_tx23000000040')).contenu.totaux.ttc === 3000, 'A2 la facture est marquée annulée, son contenu ne change pas', '');
  const av2 = await appel(A, { action: 'avoir', tx: '23000000040', confirme: true });
  dit(av2.corps.deja === true && av2.corps.avoir.numero === ca.numero, 'A3 un second clic rend le même avoir', '');
  const avPdf = Buffer.from(await pdfFacture(ca));
  dit(avPdf.slice(0, 5).toString() === '%PDF-', 'A4 l’avoir se dessine en PDF', '');


  // ══ R : LE BON ACHETEUR, PROUVÉ (la règle, exécutée) ═════════════════════
  const RT = await import(path.join(racine, 'src/facturePro/rattachement.js'));
  const M = (tx, x = {}) => ({ transaction: tx, receivedAt: '2026-11-05T10:01:00.000Z', prix: '30.00', email: 'marie.banc@exemple.test', nom: 'Marie Banc', adresse: 'rue Inventée, 12, Paris, 75011, FR, France', uid: '4040', pseudo: 'acheteuse_banc', designation: 'Asics banc', ...x });
  const V = (tx, x = {}) => ({ transaction_id: Number(tx), date: '2026-11-05T10:00:00Z', price: { amount: '30.00', currency_code: 'EUR' }, uid: '4040', title: 'Asics banc', ...x });
  const P = (o) => RT.preuveAcheteur({ adresseLisible: regle.adresseVintedLisible, ...o });
  const p1 = P({ tx: '7001', mails: [M('7001')], commandes: [V('7001')] });
  dit(p1.prouve === true && p1.acheteur.email === 'marie.banc@exemple.test' && p1.centimes === 3000 && p1.ecartS === 60 && p1.acheteur.adresse === '12 rue Inventée\n75011 Paris', 'R1 même n° de transaction + e-mail 60 s après la vente + même montant : acheteur PROUVÉ', JSON.stringify(p1));
  const p2 = P({ tx: '', mails: [M('7001')], commandes: [V('7001')] });
  dit(p2.prouve === false && p2.code === 'tx', 'R2 vente sans n° de transaction : RIEN', JSON.stringify(p2));
  const p2b = P({ tx: '7001', mails: [], commandes: [V('7001')] });
  dit(p2b.prouve === false && p2b.code === 'mail', 'R2 aucun e-mail de vente Pro à ce n° : RIEN', p2b.raison);
  const p2c = P({ tx: '7001', mails: [M('7001')], commandes: [] });
  dit(p2c.prouve === false && p2c.code === 'vinted', 'R2 vente pas lue sur Vinted : RIEN', p2c.raison);
  const p3 = P({ tx: '7001', mails: [M('7001', { receivedAt: '2026-11-05T10:16:01.000Z' })], commandes: [V('7001')] });
  const p3b = P({ tx: '7001', mails: [M('7001', { receivedAt: '2026-11-05T09:57:59.000Z' })], commandes: [V('7001')] });
  const p3c = P({ tx: '7001', mails: [M('7001', { receivedAt: '2026-11-05T10:15:00.000Z' })], commandes: [V('7001')] });
  const p3d = P({ tx: '7001', mails: [M('7001', { receivedAt: '' })], commandes: [V('7001')] });
  dit(p3.prouve === false && p3.code === 'heure' && p3b.prouve === false && p3b.code === 'heure' && p3c.prouve === true && p3d.prouve === false && p3d.code === 'heure',
    'R3 heure : 15 min 01 s après ⇒ RIEN, 2 min 01 s avant ⇒ RIEN, 15 min pile ⇒ prouvé, heure pas lue ⇒ RIEN', [p3.raison, p3b.raison, p3c.prouve, p3d.raison].join(' | '));
  const p4 = P({ tx: '7001', mails: [M('7001'), M('7001', { email: 'paul.autre@exemple.test', nom: 'Paul Autre' })], commandes: [V('7001')] });
  const p4b = P({ tx: '7001', mails: [M('7001')], commandes: [V('7001'), V('7001', { uid: '5050' })] });
  const p4c = P({ tx: '7001', mails: [M('7001'), M('7001')], commandes: [V('7001'), V('7001')] });
  dit(p4.prouve === false && p4.code === 'mails' && p4b.prouve === false && p4b.code === 'ventes' && p4c.prouve === true,
    'R4 deux candidats (deux acheteurs au même n°, ou deux comptes) : RIEN ; le même e-mail reçu deux fois reste UN candidat', [p4.raison, p4b.raison, p4c.prouve].join(' | '));
  const p5 = P({ tx: '7002', mails: [M('7001', { pseudo: 'acheteuse_banc' })], commandes: [V('7002')] });
  dit(p5.prouve === false && p5.code === 'mail', 'R5 même pseudo, même titre, même prix, AUTRE n° de transaction : RIEN (jamais par pseudo ni par titre)', p5.raison);
  const p6 = P({ tx: '7001', mails: [M('7001', { prix: '31.00' })], commandes: [V('7001')] });
  const p6b = P({ tx: '7001', mails: [M('7001')], commandes: [V('7001', { price: { amount: '30.00', currency_code: 'GBP' } })] });
  const p6c = P({ tx: '7001', mails: [M('7001', { prix: '' })], commandes: [V('7001')] });
  dit(p6.prouve === false && p6.code === 'montant' && p6b.prouve === false && p6c.prouve === false, 'R6 montant différent, autre devise, prix pas lu : RIEN', [p6.raison, p6b.raison, p6c.raison].join(' | '));
  const p7 = P({ tx: '7001', mails: [M('7001', { uid: '9999' })], commandes: [V('7001')] });
  dit(p7.prouve === false && p7.code === 'compte', 'R7 e-mail d’un autre compte Vinted que la vente : RIEN', p7.raison);
  const p8 = P({ tx: '7001', mails: [M('7001')], commandes: [V('7001')], brouillon: { transaction: '7001', buyerEmail: 'quelquun@exemple.test' } });
  const p8b = P({ tx: '7001', mails: [M('7001', { email: 'pas-une-adresse' })], commandes: [V('7001')] });
  dit(p8.prouve === false && p8.code === 'brouillon' && p8b.prouve === false && p8b.code === 'acheteur', 'R8 brouillon d’un autre acheteur, adresse e-mail invalide : RIEN', [p8.raison, p8b.raison].join(' | '));
  // 50 paires identiques : même titre, même prix, même minute — chacune SON acheteur.
  const mails50 = []; const cmd50 = [];
  for (let k = 0; k < 50; k++) { const tx = String(8000000 + k); mails50.push(M(tx, { email: `acheteur${k}@exemple.test`, nom: `Acheteur ${k}` })); cmd50.push(V(tx)); }
  const res50 = cmd50.map((c) => P({ tx: String(c.transaction_id), mails: mails50, commandes: cmd50 }));
  dit(res50.every((r, k) => r.prouve && r.acheteur.email === `acheteur${k}@exemple.test`), 'R9 50 paires identiques (titre, prix, minute) : chaque vente désigne SON acheteur, et lui seul', res50.filter((r, k) => !(r.prouve && r.acheteur.email === `acheteur${k}@exemple.test`)).length + ' faux');
  dit(RT.FENETRE_AVANT_S === 120 && RT.FENETRE_APRES_S === 900, 'R10 fenêtre : 2 min avant, 15 min après (mesuré : 33 à 118 s sur 10 ventes réelles)', `${RT.FENETRE_AVANT_S}/${RT.FENETRE_APRES_S}`);

  // ══ V : LA ROUTE RELIT LA PREUVE ELLE-MÊME, L'ENVOI PAR VRM ════════════════
  raz(); base.set(cle(A, 'vrm_pro_facture'), CFG); base.set(cle(A, 'vrm_invoice_counter'), 5);
  const v1 = await appel(A, vente('23000000700', { semer: false }));
  dit(v1.code === 409 && v1.corps.erreur === 'pas-prouve' && v1.corps.code === 'vinted' && base.get(cle(A, 'vrm_invoice_counter')) === 5 && !base.has(cle(A, 'email_invoice_tx23000000700')), 'V1 vente sans preuve en base (le navigateur envoie pourtant un acheteur) : 409, aucun numéro, aucune facture', JSON.stringify(v1.corps));
  const v2 = await appel(A, vente('23000000701', { acheteur: { nom: 'Pirate', adresse: 'Ailleurs', email: 'pirate@exemple.test' }, centimes: 1, venteLe: '2020-01-01T00:00:00Z' }));
  const c2 = v2.corps.facture && v2.corps.facture.contenu;
  dit(v2.code === 200 && c2.acheteur.email === 'marie.banc@exemple.test' && c2.totaux.ttc === 3000 && c2.venteJour === '30/10/2026' && !JSON.stringify(c2).includes('pirate'), 'V2 l’acheteur, le prix et la date viennent de la PREUVE lue par le serveur, jamais du navigateur', c2 && `${c2.acheteur.email} · ${c2.totaux.ttc}`);
  dit(base.get(cle(A, 'email_invoice_tx23000000701')).preuve && base.get(cle(A, 'email_invoice_tx23000000701')).preuve.ecartS === 60, 'V2 la facture garde sa preuve (n°, écart de 60 s, montant)', JSON.stringify(base.get(cle(A, 'email_invoice_tx23000000701')).preuve));
  const v3 = await appel(A, vente('23000000702', { preuve: { mail: { receivedAt: '2026-10-30T23:30:00.000Z' } } }));
  dit(v3.code === 409 && v3.corps.code === 'heure' && !base.has(cle(A, 'email_invoice_tx23000000702')), 'V3 e-mail arrivé 1 h après la vente : le serveur refuse, aucune facture', v3.corps.raison);
  const v3b = await appel(A, vente('23000000703', { preuve: { mail: { prix: '45.00' } } }));
  dit(v3b.code === 409 && v3b.corps.code === 'montant', 'V3 montant différent : le serveur refuse', v3b.corps.raison);
  semer(A, '23000000704'); semer(A, '23000000704', { mail: { _suffixe: 'bis', email: 'autre@exemple.test', nomComplet: 'Autre Personne' } });
  const v3c = await appel(A, vente('23000000704', { semer: false }));
  dit(v3c.code === 409 && v3c.corps.code === 'mails', 'V3 deux e-mails de vente au même n°, deux acheteurs : le serveur refuse', v3c.corps.raison);
  semer(A, '23000000705'); pannes.add('like:harvest_*_orders_sold');
  const v4 = await appel(A, vente('23000000705', { semer: false }));
  dit(v4.code === 503 && !base.has(cle(A, 'email_invoice_tx23000000705')), 'V4 lecture des ventes Vinted en panne : 503, rien', `HTTP ${v4.code}`);
  pannes.clear();
  const reqVentes = requetes.filter((q) => /orders_sold/.test(q.url));
  dit(reqVentes.length && reqVentes.every((q) => /owner=eq\./.test(q.url) && /my_orders=cs\.\[\{"transaction_id":\d+\}\]/.test(q.url) && /select=id,commandes:data->payload->my_orders/.test(q.url)), 'V4 la lecture des ventes est filtrée par vendeur ET par n° (`cs`), jamais `select=data`', reqVentes.map((q) => q.url).slice(0, 1).join(''));
  // N10 : un numéro annulé par un avoir n'est jamais redonné.
  const avN = await appel(A, { action: 'avoir', tx: '23000000701', confirme: true });
  const nApres = await appel(A, vente('23000000706'));
  dit(avN.code === 200 && nApres.corps.facture && nApres.corps.facture.numero === `FA-${annee}-0007` && c2 && v2.corps.facture.numero === `FA-${annee}-0006`, 'N10 la facture 0006 annulée par un avoir : la suivante est 0007 (un numéro donné n’est jamais réutilisé)', nApres.corps.facture && nApres.corps.facture.numero);

  // L'envoi PAR VRM (défaut).
  const ENV_VRM = { RELANCES_SMTP_HOTE: 'smtp.vrm-banc.test', RELANCES_SMTP_PORT: '465', RELANCES_SMTP_UTILISATEUR: 'vrm-banc', RELANCES_SMTP_MOT_DE_PASSE: 'mdp-vrm-banc', RELANCES_EXPEDITEUR: 'factures@vrm-banc.test' };
  const poserEnv = (on) => { for (const [k, v] of Object.entries(ENV_VRM)) { if (on) process.env[k] = v; else delete process.env[k]; } };
  poserEnv(true); smtp.recus = []; smtp.mode = 'ok';
  const g1 = await appel(A, null, 'GET');
  dit(g1.code === 200 && g1.corps.vrm && g1.corps.vrm.pret === true && g1.corps.prochain === 8 && g1.corps.vrm.plafond === R.PLAFOND_JOUR, 'V5 l’app apprend : envoi par VRM prêt, plafond, prochain n° = 8 (lu au compteur)', JSON.stringify({ vrm: g1.corps.vrm, prochain: g1.corps.prochain }));
  const ev = await appel(A, { action: 'envoyer', tx: '23000000706', confirme: true });
  const mv = smtp.recus[0] || { rcpt: [], data: '', from: '' };
  const tete = mv.data.split('\r\n\r\n')[0];
  const hdr = (n) => ((new RegExp('^' + n + ': (.*)$', 'mi')).exec(tete) || [])[1] || '';
  const fromDecode = hdr('From').replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_, b) => Buffer.from(b, 'base64').toString('utf8')).replace(/\r\n /g, '');
  dit(ev.corps.issue === 'envoye' && ev.corps.envoi.via === 'vrm', 'V5 « Envoyer » : la facture part par VRM', JSON.stringify(ev.corps.envoi));
  dit(/<factures@vrm-banc\.test>$/.test(hdr('From')) && /Boutique Banc EI via VRM/.test(fromDecode) && /factures@vrm-banc\.test/.test(mv.from), 'V6 From = « Boutique Banc EI via VRM » <adresse d’envoi de VRM> (MAIL FROM aussi)', fromDecode + ' · ' + mv.from);
  dit(hdr('Reply-To') === '<boutique@banc.test>', 'V6 Reply-To = l’e-mail du VENDEUR (l’acheteur lui répond, jamais à VRM)', hdr('Reply-To'));
  dit(hdr('Cc') === '<boutique@banc.test>' && mv.rcpt.some((x) => /boutique@banc\.test/.test(x)), 'V6 Cc = le vendeur (en-tête ET destinataire SMTP)', hdr('Cc') + ' · ' + mv.rcpt.join(' '));
  dit(hdr('To') === '<marie.banc@exemple.test>' && mv.rcpt[0] === '<marie.banc@exemple.test>' && mv.rcpt.length === 2, 'V6 To = l’acheteur PROUVÉ, et personne d’autre que lui et le vendeur', hdr('To') + ' · ' + mv.rcpt.join(' '));
  dit(/^Message-ID: <[0-9a-f]{32}@vrm-banc\.test>$/mi.test(tete) && /^Date: /mi.test(tete) && !/^List-Unsubscribe/mi.test(tete), 'V6 en-têtes propres : Message-ID, Date, et JAMAIS List-Unsubscribe (transactionnel)', '');
  dit(/Content-Type: text\/plain/.test(mv.data) && /Content-Type: text\/html/.test(mv.data) && /filename="Facture-FA-\d{4}-0007\.pdf"/.test(mv.data), 'V6 texte + HTML, et le PDF de la facture en pièce jointe', '');
  const corpsTexte = (() => { const m = /Content-Type: text\/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+)/.exec(mv.data); return m ? Buffer.from(m[1].replace(/\s/g, ''), 'base64').toString('utf8') : ''; })();
  dit(/envoyée par VRM pour le compte de Boutique Banc EI/.test(corpsTexte) && /répondez simplement à cet e-mail/.test(corpsTexte), 'V6 le message dit que VRM l’envoie pour le vendeur, et qu’on répond au vendeur', corpsTexte.slice(-160));
  const lv = base.get(cle(A, 'email_invoice_tx23000000706'));
  dit(lv.status === 'sent' && Array.isArray(lv.envois) && lv.envois.length === 1 && lv.envois[0].a === 'marie.banc@exemple.test' && lv.envois[0].via === 'vrm' && lv.envois[0].etat === 'envoyee', 'V7 journal des envois : date, destinataire, chemin, issue', JSON.stringify(lv.envois));
  const evR = await appel(A, { action: 'envoyer', tx: '23000000706', confirme: true, renvoyer: true });
  dit(evR.corps.issue === 'envoye' && base.get(cle(A, 'email_invoice_tx23000000706')).envois.length === 2 && smtp.recus.length === 2, 'V7 « Renvoyer » : le journal garde les deux envois', '');
  dit(base.get(cle(A, R.ID_ENVOIS_JOUR)) && base.get(cle(A, R.ID_ENVOIS_JOUR)).n === 2, 'V8 le plafond du jour compte chaque envoi par VRM', JSON.stringify(base.get(cle(A, R.ID_ENVOIS_JOUR))));
  // Plafond atteint : rien ne part.
  await appel(A, vente('23000000707'));
  base.set(cle(A, R.ID_ENVOIS_JOUR), { ...base.get(cle(A, R.ID_ENVOIS_JOUR)), n: R.PLAFOND_JOUR });
  const nPl = smtp.recus.length;
  const epl = await appel(A, { action: 'envoyer', tx: '23000000707', confirme: true });
  dit(epl.code === 429 && epl.corps.erreur === 'plafond' && smtp.recus.length === nPl && !base.get(cle(A, 'email_invoice_tx23000000707')).envoi, `V8 plafond atteint (${R.PLAFOND_JOUR}/jour) : 429, rien ne part, la facture n’est pas marquée`, JSON.stringify(epl.corps));
  base.delete(cle(A, R.ID_ENVOIS_JOUR));
  // SMTP de VRM absent : rien ne part, « pas envoyé ».
  poserEnv(false);
  const ens = await appel(A, { action: 'envoyer', tx: '23000000707', confirme: true });
  dit(ens.code === 503 && ens.corps.erreur === 'vrm-smtp' && ens.corps.manque.includes('RELANCES_SMTP_HOTE') && smtp.recus.length === nPl && !base.get(cle(A, 'email_invoice_tx23000000707')).envoi, 'V9 SMTP de VRM pas configuré : 503, la variable manquante est nommée, rien ne part', JSON.stringify(ens.corps));
  const gN = await appel(A, null, 'GET');
  dit(gN.corps.vrm.pret === false && gN.corps.vrm.manque.includes('RELANCES_EXPEDITEUR'), 'V9 … et l’app l’apprend (pour dire le geste au propriétaire)', JSON.stringify(gN.corps.vrm));
  poserEnv(true);
  // E-mail du vendeur manquant : rien ne part (pas de Reply-To ni de Cc possibles).
  base.set(cle(A, 'vrm_pro_facture'), { ...CFG, email: '' });
  const eme = await appel(A, { action: 'envoyer', tx: '23000000707', confirme: true });
  dit(eme.code === 409 && eme.corps.erreur === 'email-vendeur' && smtp.recus.length === nPl, 'V10 pas d’e-mail du vendeur : rien ne part (le geste est dit)', eme.corps.message);
  base.set(cle(A, 'vrm_pro_facture'), CFG);
  // La preuve devenue fausse APRÈS l'émission (un second e-mail au même n°) : rien ne part.
  semer(A, '23000000707', { mail: { _suffixe: 'bis', email: 'intrus@exemple.test', nomComplet: 'Intrus' }, sansVinted: true });
  const epf = await appel(A, { action: 'envoyer', tx: '23000000707', confirme: true });
  dit(epf.code === 409 && epf.corps.erreur === 'pas-prouve' && smtp.recus.length === nPl, 'V11 la preuve relue au moment d’envoyer n’est plus unique : rien ne part', epf.corps.message);
  base.delete(cle(A, 'email_sale_m23000000707bis'));
  // Une facture émise sans preuve (avant le 6 nov.) : VRM ne l'envoie pas.
  const sansP = { ...base.get(cle(A, 'email_invoice_tx23000000707')) }; delete sansP.preuve; base.set(cle(A, 'email_invoice_tx23000000707'), sansP);
  const esp = await appel(A, { action: 'envoyer', tx: '23000000707', confirme: true });
  dit(esp.code === 409 && esp.corps.erreur === 'pas-prouve' && smtp.recus.length === nPl, 'V12 facture émise sans preuve : aucun envoi ne part', esp.corps.message);
  base.set(cle(A, 'email_invoice_tx23000000707'), { ...sansP, preuve: { tx: '23000000707' } });
  // Écriture « en cours » ratée : rien ne part, jamais « envoyée ».
  pannes.add('patch:email_invoice_tx23000000707');
  const eko = await appel(A, { action: 'envoyer', tx: '23000000707', confirme: true });
  pannes.clear();
  dit(eko.code === 503 && smtp.recus.length === nPl && !(base.get(cle(A, 'email_invoice_tx23000000707')).envoi), 'V13 l’écriture « en cours » ratée (avant l’envoi) : 503, rien ne part, rien n’est marqué envoyé', `HTTP ${eko.code}`);
  // Le serveur d'envoi refuse le destinataire : « refusée », jamais « envoyée ».
  smtp.mode = 'rcpt-refuse';
  const erf = await appel(A, { action: 'envoyer', tx: '23000000707', confirme: true });
  smtp.mode = 'ok';
  dit(erf.corps.issue === 'refuse' && base.get(cle(A, 'email_invoice_tx23000000707')).status !== 'sent' && base.get(cle(A, 'email_invoice_tx23000000707')).envois.slice(-1)[0].etat === 'refusee', 'V13 refus du serveur d’envoi : « pas envoyée », écrit au journal', JSON.stringify(erf.corps.envoi));
  poserEnv(false);

  // ══ M10-M13 : L'APERÇU DE « MA FACTURE » ═════════════════════════════════
  const EX = { acheteur: { nom: 'Camille Exemple', adresse: '8 rue des Exemples\n75011 Paris', email: '' }, designation: 'Exemple', centimes: 12950, venteLe: '2026-10-30T10:00:00Z' };
  const ap0 = regle.contenuApercu({ prefixe: 'FA' }, EX, { numero: 'FA-2026-0006', emiseLe: Date.parse('2026-11-06T10:00:00Z') });
  const trous = JSON.stringify(ap0.contenu).match(/"trou":"[a-zA-Z_]+"/g) || [];
  dit(['nom', 'adresse', 'codePostal', 'siret', 'forme', 'tva_regime'].every((t) => trous.includes(`"trou":"${t}"`)), 'M10 fiche vide : l’aperçu se dessine quand même, chaque mention manquante est un trou « à compléter » (nom, adresse, CP/ville, SIRET, forme, TVA)', trous.join(' '));
  const json0 = JSON.stringify(ap0.contenu);
  dit(!/732829320|§|"nom":"X"|"X"/.test(json0), 'M11 aucune valeur témoin ne fuit dans l’aperçu (ni SIRET, ni « X »)', json0.slice(0, 200));
  const mq0 = regle.mentionsManquantes(ap0.contenu);
  dit(['vendeur', 'forme', 'adresse', 'siret', 'tva'].every((k) => mq0.includes(k)), 'M12 les mentions obligatoires manquantes sont comptées', mq0.join(','));
  const plein = regle.contenuFacture(CFG, { ...EX, acheteur: { ...EX.acheteur, email: 'x@exemple.test' } }, { numero: 'FA-2026-0006', emiseLe: Date.parse('2026-11-06T10:00:00Z') });
  const sas = regle.contenuFacture({ ...CFG, forme: 'SASU', nom: 'Banc SAS', rcs: 'RCS Rennes', capital: '1000', tva_regime: 'normal', tva_taux: 20, tva: 'FR00' + SIREN }, EX, { numero: 'FA-2026-0006', emiseLe: Date.parse('2026-11-06T10:00:00Z') });
  dit(regle.mentionsManquantes(plein).length === 0 && regle.mentionsManquantes(sas).length === 0 && regle.MENTIONS_OBLIGATOIRES.length === 14, 'M13 une facture complète (EI en franchise, SASU à la TVA) porte les 14 mentions obligatoires', regle.mentionsManquantes(plein).concat(regle.mentionsManquantes(sas)).join(','));
  const apPlein = regle.contenuApercu(CFG, EX, { numero: 'FA-2026-0006', emiseLe: Date.parse('2026-11-06T10:00:00Z') });
  dit(JSON.stringify(apPlein.contenu) === JSON.stringify(regle.contenuFacture(CFG, EX, { numero: 'FA-2026-0006', emiseLe: Date.parse('2026-11-06T10:00:00Z') })), 'M13 fiche complète : l’aperçu est EXACTEMENT l’instantané du PDF', '');
  const mail = regle.emailFacture(CFG, plein, { via: 'vrm' });
  dit(mail.nomExpediteur === 'Boutique Banc EI via VRM' && /<p/.test(mail.html) && !/<script/i.test(regle.emailFacture({ ...CFG, message: '<script>x</script>' }, plein).html), 'M14 l’e-mail : « … via VRM », HTML échappé (aucune valeur n’écrit du HTML)', mail.nomExpediteur);

  // ══ T : « FACTURE EN ANGLAIS » PAR LA VRAIE ROUTE (10 nov., lot T) ═══════
  // Choisie à l'émission, FIGÉE dans l'instantané ; le français ne bouge pas.
  raz(); base.set(cle(A, 'vrm_pro_facture'), CFG);
  const ten = await appel(A, vente('23000000901', { langue: 'en' }));
  const lten = base.get(cle(A, 'email_invoice_tx23000000901')) || {};
  dit(ten.code === 200 && lten.contenu && lten.contenu.anglais && lten.contenu.mentions[0] === regle.MENTION_FRANCHISE && /^VAT not applicable, article 293 B/.test(lten.contenu.anglais.mentions[0]) && regle.mentionsManquantes(lten.contenu).length === 0,
    'T1 émise « en anglais » : la traduction est figée dans l’instantané, la mention 293 B reste mot pour mot, les 14 mentions y sont', JSON.stringify(lten.contenu && lten.contenu.anglais));
  const tfr = await appel(A, vente('23000000902'));
  const ltfr = base.get(cle(A, 'email_invoice_tx23000000902')) || {};
  dit(tfr.code === 200 && ltfr.contenu && !('anglais' in ltfr.contenu), 'T2 sans l’option : la facture est exactement celle d’avant (aucune clé « anglais »)', Object.keys(ltfr.contenu || {}).join(','));
  const ten2 = await appel(A, vente('23000000901', { langue: 'fr' }));
  dit(ten2.corps.deja === true && (base.get(cle(A, 'email_invoice_tx23000000901')).contenu || {}).anglais, 'T3 une facture émise ne change plus de langue (même numéro, même instantané)', JSON.stringify(ten2.corps.deja));
  const tbad = await appel(A, vente('23000000903', { langue: 'de' }));
  dit(tbad.code === 200 && !('anglais' in (base.get(cle(A, 'email_invoice_tx23000000903')).contenu || {})), 'T4 une langue inconnue n’invente rien : facture en français', '');

  serveur.close(); fs.rmSync(dossier, { recursive: true, force: true });
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); try { serveur.close(); } catch (_) {} process.exit(1); });
