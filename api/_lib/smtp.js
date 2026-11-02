// ════════════════════════════════════════════════════════════════════════════
//  ENVOYER UN E-MAIL DEPUIS LA BOÎTE DU VENDEUR (SMTP) — 2 novembre
// ════════════════════════════════════════════════════════════════════════════
// La facture part de SA boîte (Gmail, iCloud, Orange…), avec SON mot de passe
// d'application, collé une fois et rangé chiffré dans le coffre du serveur
// (api/_lib/facture-pro.js). Règle §2.9 : aucun service d'envoi payé par Julien
// pour les autres — et l'acheteur voit l'adresse du vendeur, il lui répond.
//
// Un client SMTP minimal, sans dépendance (le registre npm n'était pas
// joignable le jour où il a été écrit, et il n'y a que quatre commandes à
// dire) : TLS direct (465) ou STARTTLS (587), AUTH PLAIN puis LOGIN,
// MAIL FROM / RCPT TO / DATA, message MIME multipart avec pièces jointes.
//
// ⚠️ TROIS ISSUES, JAMAIS DEUX (comme Super PDP) :
//    · `envoye`    le serveur a répondu 250 après le message ;
//    · `refuse`    un refus AVANT le message (connexion, identifiants,
//                  destinataire) : rien n'est parti, c'est sûr ;
//    · `incertain` la connexion a lâché APRÈS l'envoi du message, sans réponse :
//                  il a PU partir. L'écran le dit, ne prétend rien.
import net from 'net';
import tls from 'tls';
import crypto from 'crypto';

const CRLF = '\r\n';
const DELAI_MS = Number(process.env.SMTP_DELAI_MS) || 20000;
// Pour les bancs SEULEMENT : un faux serveur local (jamais réglé en production —
// rien ne l'écrit hors de scripts/).
export const _banc = { connecter: null, tlsOptions: null };

// Les boîtes connues : leur serveur d'envoi. « Autre » : le vendeur le donne.
export const FOURNISSEURS = {
  gmail: { l: 'Gmail', hote: 'smtp.gmail.com', port: 465, domaines: ['gmail.com', 'googlemail.com'] },
  icloud: { l: 'iCloud', hote: 'smtp.mail.me.com', port: 587, domaines: ['icloud.com', 'me.com', 'mac.com'] },
  orange: { l: 'Orange', hote: 'smtp.orange.fr', port: 465, domaines: ['orange.fr', 'wanadoo.fr'] },
  free: { l: 'Free', hote: 'smtp.free.fr', port: 465, domaines: ['free.fr'] },
  sfr: { l: 'SFR', hote: 'smtp.sfr.fr', port: 465, domaines: ['sfr.fr', 'neuf.fr'] },
  laposte: { l: 'La Poste', hote: 'smtp.laposte.net', port: 465, domaines: ['laposte.net'] },
  yahoo: { l: 'Yahoo', hote: 'smtp.mail.yahoo.com', port: 465, domaines: ['yahoo.fr', 'yahoo.com'] },
  ovh: { l: 'OVH', hote: 'ssl0.ovh.net', port: 465, domaines: [] },
  ionos: { l: 'IONOS', hote: 'smtp.ionos.fr', port: 465, domaines: [] },
};
export function fournisseurDe(email) {
  const d = String(email || '').split('@')[1] || '';
  for (const [k, f] of Object.entries(FOURNISSEURS)) if (f.domaines.includes(d.toLowerCase())) return k;
  return null;
}
// Un NOM d'hôte (jamais une adresse IP, jamais un nom local) : le serveur de
// VRM ne doit pas pouvoir être dirigé vers son propre réseau.
export const hoteValide = (h) => {
  const x = String(h || '').toLowerCase();
  return /^(?=.{1,200}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,24}$/.test(x)
    && !/(^|\.)(localhost|local|internal|lan|home|corp)$/.test(x);
};

// ── Le message MIME ─────────────────────────────────────────────────────────
// En-tête non ASCII : encodé (RFC 2047), découpé pour rester sous 76 colonnes.
export function enteteEncode(s) {
  const t = String(s == null ? '' : s).replace(/[\r\n]+/g, ' ');
  if (/^[\x20-\x7e]*$/.test(t)) return t;
  const b = Buffer.from(t, 'utf8');
  const morceaux = []; let i = 0;
  while (i < b.length) {
    let j = Math.min(b.length, i + 45);
    while (j < b.length && (b[j] & 0xc0) === 0x80) j--;                 // jamais au milieu d'un caractère
    morceaux.push(`=?UTF-8?B?${b.slice(i, j).toString('base64')}?=`); i = j;
  }
  return morceaux.join(`${CRLF} `);
}
const adresseNue = (a) => String(a || '').trim();
export const emailSur = (a) => /^[^\s@<>"',;()\[\]\\]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(adresseNue(a));
const base64Lignes = (buf) => (Buffer.isBuffer(buf) ? buf : Buffer.from(buf)).toString('base64').replace(/.{1,76}/g, (x) => x + CRLF);
const nomFichierSur = (n) => String(n || 'piece.pdf').replace(/[^\w.\-]/g, '_').slice(0, 120);

export function composerMessage({ de, nomDe, a, sujet, texte, html, pieces = [], domaine }) {
  const frontiere = `vrm-${crypto.randomBytes(12).toString('hex')}`;
  const alt = `vrm-alt-${crypto.randomBytes(12).toString('hex')}`;
  const id = `<${crypto.randomBytes(16).toString('hex')}@${domaine || String(de).split('@')[1] || 'vrm.center'}>`;
  const h = [
    `From: ${nomDe ? `${enteteEncode(nomDe)} ` : ''}<${adresseNue(de)}>`,
    `To: <${adresseNue(a)}>`,
    `Subject: ${enteteEncode(sujet)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${frontiere}"`,
  ];
  const corps = [
    `--${frontiere}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`, '',
    `--${alt}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', base64Lignes(Buffer.from(String(texte || ''), 'utf8')),
    ...(html ? [`--${alt}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', base64Lignes(Buffer.from(String(html), 'utf8'))] : []),
    `--${alt}--`, '',
  ];
  for (const p of pieces) {
    const nom = nomFichierSur(p.nom);
    corps.push(`--${frontiere}`, `Content-Type: ${p.type || 'application/pdf'}; name="${nom}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${nom}"`, '', base64Lignes(p.octets));
  }
  corps.push(`--${frontiere}--`, '');
  return { id, brut: h.join(CRLF) + CRLF + CRLF + corps.join(CRLF) };
}
// « Point seul sur une ligne » termine DATA : un point en tête de ligne est doublé.
export const pointsDoubles = (s) => s.replace(/(^|\r\n)\./g, '$1..');

// ── La conversation SMTP ────────────────────────────────────────────────────
// `connecter` est injectable (bancs : un faux serveur local).
export async function envoyerSmtp({ seulementConnexion = false, hote, port, utilisateur, motDePasse, de, nomDe, a, bcc = [], sujet, texte, html, pieces, connecter, tlsOptions = {} }) {
  if (!emailSur(de) || !emailSur(a)) return { issue: 'refuse', etape: 'adresse', message: "Adresse d'expéditeur ou de destinataire invalide." };
  const securise = Number(port) === 465;
  let sock = null; let tampon = ''; let attente = null; let ferme = false; let messageParti = false;
  const lignesLues = []; const recues = [];
  const surDonnees = (d) => {
    tampon += d.toString('utf8');
    let i;
    while ((i = tampon.indexOf('\n')) >= 0) {
      const l = tampon.slice(0, i).replace(/\r$/, ''); tampon = tampon.slice(i + 1);
      lignesLues.push(l);
      if (/^\d{3} /.test(l) || /^\d{3}$/.test(l)) { const rep = { code: Number(l.slice(0, 3)), lignes: lignesLues.splice(0) }; if (attente) { const r = attente; attente = null; r.ok(rep); } else recues.push(rep); }
    }
  };
  const brancher = (s) => {
    s.on('data', surDonnees);
    s.on('error', (e) => { if (attente) { const r = attente; attente = null; r.ko(e); } });
    s.on('close', () => { ferme = true; if (attente) { const r = attente; attente = null; r.ko(new Error('connexion fermée')); } });
  };
  const lire = () => new Promise((ok, ko) => {
    if (recues.length) { ok(recues.shift()); return; }
    if (ferme) { ko(new Error('connexion fermée')); return; }
    const t = setTimeout(() => { if (attente) { attente = null; ko(new Error('délai dépassé')); } }, DELAI_MS);
    attente = { ok: (r) => { clearTimeout(t); ok(r); }, ko: (e) => { clearTimeout(t); ko(e); } };
  });
  const dire = (cmd) => { sock.write(cmd + CRLF); return lire(); };
  const raison = (r) => r.lignes.map((l) => l.slice(4)).join(' ').replace(/\s+/g, ' ').slice(0, 300);
  const refus = (etape, r) => ({ issue: 'refuse', etape, code: r && r.code, message: r ? raison(r) : '' });
  try {
    if (_banc.tlsOptions) tlsOptions = { ...tlsOptions, ..._banc.tlsOptions };
    const ouvrir = connecter || _banc.connecter || ((o) => new Promise((ok, ko) => {
      const s = o.securise
        ? tls.connect({ host: o.hote, port: o.port, servername: o.hote, ...tlsOptions }, () => ok(s))
        : net.connect({ host: o.hote, port: o.port }, () => ok(s));
      s.once('error', ko); s.setTimeout(DELAI_MS, () => s.destroy(new Error('délai dépassé')));
    }));
    sock = await ouvrir({ hote, port: Number(port), securise });
    brancher(sock);
    let r = await lire(); if (r.code !== 220) return refus('connexion', r);
    r = await dire(`EHLO vrm.center`); if (r.code !== 250) return refus('connexion', r);
    if (!securise) {
      if (!r.lignes.some((l) => /STARTTLS/i.test(l))) return { issue: 'refuse', etape: 'connexion', message: "Ce serveur ne propose pas de connexion chiffrée : rien n'est envoyé en clair." };
      r = await dire('STARTTLS'); if (r.code !== 220) return refus('connexion', r);
      sock.removeAllListeners('data'); sock.removeAllListeners('close'); sock.removeAllListeners('error');
      const brut = sock;
      sock = await new Promise((ok, ko) => { const s = tls.connect({ socket: brut, servername: hote, ...tlsOptions }, () => ok(s)); s.once('error', ko); });
      brancher(sock);
      r = await dire('EHLO vrm.center'); if (r.code !== 250) return refus('connexion', r);
    }
    const capa = r.lignes.join(' ');
    if (/AUTH[ =][^\n]*PLAIN/i.test(capa)) {
      r = await dire(`AUTH PLAIN ${Buffer.from(`\u0000${utilisateur}\u0000${motDePasse}`, 'utf8').toString('base64')}`);
    } else {
      r = await dire('AUTH LOGIN'); if (r.code !== 334) return refus('identifiants', r);
      r = await dire(Buffer.from(String(utilisateur), 'utf8').toString('base64')); if (r.code !== 334) return refus('identifiants', r);
      r = await dire(Buffer.from(String(motDePasse), 'utf8').toString('base64'));
    }
    if (r.code !== 235) return refus('identifiants', r);
    if (seulementConnexion) { try { sock.write('QUIT' + CRLF); } catch (_) {} return { issue: 'connecte' }; }
    r = await dire(`MAIL FROM:<${adresseNue(de)}>`); if (r.code !== 250) return refus('expediteur', r);
    for (const dest of [a, ...bcc.filter(emailSur)]) {
      r = await dire(`RCPT TO:<${adresseNue(dest)}>`);
      if (r.code !== 250 && r.code !== 251) { if (dest === a) return refus('destinataire', r); }
    }
    r = await dire('DATA'); if (r.code !== 354) return refus('message', r);
    const { id, brut } = composerMessage({ de, nomDe, a, sujet, texte, html, pieces });
    messageParti = true;
    sock.write(pointsDoubles(brut.replace(/\r?\n/g, CRLF)) + `${CRLF}.${CRLF}`);
    r = await lire();
    if (r.code !== 250) return refus('message', r);
    try { sock.write('QUIT' + CRLF); } catch (_) {}
    return { issue: 'envoye', id, reponse: raison(r) };
  } catch (e) {
    return messageParti
      ? { issue: 'incertain', message: `La connexion a lâché après l'envoi du message (${e.message}) : il a peut-être été reçu.` }
      : { issue: 'refuse', etape: 'connexion', message: `Le serveur d'envoi n'a pas répondu (${e.message}).` };
  } finally { try { sock && sock.end(); } catch (_) {} }
}
