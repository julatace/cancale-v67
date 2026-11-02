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
        s.write(u === 'boutique@banc.test' && p === MDP.replace(/\s/g, '') ? '235 ok\r\n' : '535 5.7.8 Identifiants refusés\r\n');
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
  const vente = (tx, extra = {}) => ({ action: 'emettre', confirme: true, tx, compte: 'boutique_banc', acheteur: { nom: 'Marie Banc', adresse: '12 rue Inventée\n75011 Paris', email: 'marie.banc@exemple.test' }, designation: 'Asics Metaspeed banc - Taille 43,5', centimes: 3000, venteLe: '2026-10-30T22:30:00Z', ...extra });
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
  await appel(A, vente('23000000020')); const rb = await appel(B, vente('23000000021'));
  dit(rb.corps.facture.numero === `FA-${annee}-0001`, 'N9 chaque vendeur a SA séquence (B commence à 0001)', rb.corps.facture.numero);
  dit(requetes.every((q) => /owner=eq\./.test(q.url) || q.methode === 'POST'), 'N9 aucune requête sans filtre de vendeur', requetes.filter((q) => !/owner=eq\./.test(q.url)).map((q) => q.methode + q.url).slice(0, 2).join(' | '));

  // ══ M : LES MENTIONS ══════════════════════════════════════════════════════
  raz(); base.set(cle(A, 'vrm_pro_facture'), { ...CFG, siret: '123', tva_regime: undefined, forme: 'SASU' });
  const m0 = await appel(A, vente('23000000030'));
  const champs = (m0.corps.manquants || []).map((x) => x.champ).sort().join(',');
  dit(m0.code === 409 && /siret/.test(champs) && /tva_regime/.test(champs) && /rcs/.test(champs) && /capital/.test(champs) && !base.has(cle(A, 'vrm_invoice_counter')),
    'M1 fiche incomplète : refus nommé (SIRET, régime de TVA, RCS et capital d’une société), aucun numéro pris', champs);
  const m0b = await appel(A, vente('23000000030', { acheteur: { nom: '', adresse: '', email: '' } }));
  dit((m0b.corps.manquants || []).some((x) => x.champ === 'acheteurNom') && (m0b.corps.manquants || []).some((x) => x.champ === 'acheteurAdresse'), 'M2 acheteur sans nom ni adresse : refusé et dit', JSON.stringify(m0b.corps.manquants && m0b.corps.manquants.map((x) => x.champ)));
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

  // ══ E : L'ENVOI À L'ACHETEUR ═════════════════════════════════════════════
  smtp.recus = [];
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

  serveur.close(); fs.rmSync(dossier, { recursive: true, force: true });
  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ a levé : ' + (e && e.stack || e)); try { serveur.close(); } catch (_) {} process.exit(1); });
