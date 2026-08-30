// LIRE UN EMAIL ENTRANT, QUELLE QUE SOIT SA FORME
// ────────────────────────────────────────────────────────────────────────────
// ⚠️ POURQUOI CE FICHIER EXISTE (23 août 2026).
// Le journal (`email_journal`) a montré un email arrivé à 06:36 avec un
// expéditeur ET un sujet VIDES, classé « ignoré » : l'app l'a reçu et n'a rien
// su en lire. Rien n'a été enregistré, donc aucun moyen de savoir ce que
// c'était — pendant que Julien attendait ses codes de retrait Chronopost.
//
// La cause : `normalizeInbound` ne connaissait que 4 formes (Postmark,
// SendGrid, Mailgun, JSON à plat). Un service de réception qui livre l'email
// BRUT (MIME), ou qui l'emballe dans un objet (`{message:{...}}`), ou qui met
// les en-têtes dans un tableau, passait entièrement à travers.
//
// RÈGLE : on ne devine jamais le CONTENU, mais on doit savoir LIRE le contenant.
// Tout est déterministe ici — aucun rapprochement, aucune heuristique métier.
'use strict';

// ── Décodages ──────────────────────────────────────────────────────────────
// Quoted-printable (RFC 2045) : « =C3=A9 » → « é », « =\n » = coupure de ligne.
function decodeQP(s) {
  return String(s || '')
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function bufFrom(s, enc) { return Buffer.from(String(s || ''), enc); }

// Décode un corps de partie selon son Content-Transfer-Encoding.
function decodeBody(body, enc, charset) {
  const e = String(enc || '').toLowerCase().trim();
  const cs = /iso-8859|latin1|windows-1252/i.test(charset || '') ? 'latin1' : 'utf8';
  if (e === 'base64') return bufFrom(String(body || '').replace(/\s+/g, ''), 'base64').toString(cs);
  if (e === 'quoted-printable') return bufFrom(decodeQP(body), 'binary').toString(cs);
  return String(body || '');
}

// En-tête RFC 2047 : « =?UTF-8?B?...?= » / « =?UTF-8?Q?...?= ».
function decodeEnTete(s) {
  return String(s || '').replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, t, txt) => {
    const enc = /iso-8859|latin1|windows-1252/i.test(cs) ? 'latin1' : 'utf8';
    try {
      if (/b/i.test(t)) return bufFrom(txt, 'base64').toString(enc);
      return bufFrom(decodeQP(txt.replace(/_/g, ' ')), 'binary').toString(enc);
    } catch (_) { return txt; }
  }).replace(/\?=\s+=\?/g, '');           // deux mots encodés collés
}

// ── MIME brut ──────────────────────────────────────────────────────────────
function separer(raw) {
  const s = String(raw || '').replace(/\r\n/g, '\n');
  const i = s.indexOf('\n\n');
  return i < 0 ? { head: s, body: '' } : { head: s.slice(0, i), body: s.slice(i + 2) };
}
function lireEnTetes(head) {
  const out = {};
  // Dépliage : une ligne qui commence par un espace prolonge la précédente.
  const lignes = String(head || '').split('\n');
  const plates = [];
  for (const l of lignes) {
    if (/^[ \t]/.test(l) && plates.length) plates[plates.length - 1] += ' ' + l.trim();
    else plates.push(l);
  }
  for (const l of plates) {
    const m = /^([A-Za-z0-9-]+)\s*:\s*(.*)$/.exec(l);
    if (m) { const k = m[1].toLowerCase(); if (out[k] == null) out[k] = m[2]; else out[k] += ', ' + m[2]; }
  }
  return out;
}
function param(v, nom) {
  const m = new RegExp(nom + '\\s*=\\s*"([^"]*)"|' + nom + '\\s*=\\s*([^;\\s]+)', 'i').exec(String(v || ''));
  return m ? (m[1] != null ? m[1] : m[2]) : '';
}

// Parcourt récursivement les parties d'un message MIME.
function parcourir(head, body, sortie, prof) {
  if (prof > 8) return;
  const h = lireEnTetes(head);
  const ct = h['content-type'] || 'text/plain';
  const enc = h['content-transfer-encoding'] || '';
  const nom = param(h['content-disposition'], 'filename') || param(ct, 'name');
  if (/^multipart\//i.test(ct)) {
    const b = param(ct, 'boundary');
    if (!b) return;
    const sep = '--' + b;
    const morceaux = String(body).split(new RegExp('^' + sep.replace(/[.*+?^${}()|[\]\\]/g, x => '\\' + x) + '(--)?\\s*$', 'm'));
    for (const mo of morceaux.slice(1)) {
      if (!mo || !mo.trim()) continue;
      const p = separer(mo.replace(/^\n/, ''));
      parcourir(p.head, p.body, sortie, prof + 1);
    }
    return;
  }
  const cs = param(ct, 'charset');
  if (nom || /^application\/|^image\//i.test(ct)) {
    sortie.attachments.push({ filename: decodeEnTete(nom), contentType: ct.split(';')[0].trim(),
      contentB64: /base64/i.test(enc) ? String(body).replace(/\s+/g, '') : bufFrom(body, 'utf8').toString('base64') });
    return;
  }
  const txt = decodeBody(body, enc, cs);
  if (/^text\/html/i.test(ct)) { if (txt.length > sortie.html.length) sortie.html = txt; }
  else if (/^text\//i.test(ct)) { if (txt.length > sortie.text.length) sortie.text = txt; }
}

// Un texte est-il un message MIME brut ? (en-têtes obligatoires en tête de
// chaîne — on ne se fie pas à un simple « Subject: » perdu au milieu.)
function ressembleAduMime(s) {
  const t = String(s || '').slice(0, 4000);
  return /^(from|to|subject|date|received|content-type|mime-version|delivered-to|return-path)\s*:/im.test(t.split(/\n\s*\n/)[0] || '');
}

function lireMime(raw) {
  const { head, body } = separer(raw);
  const h = lireEnTetes(head);
  const out = { from: '', to: '', subject: '', text: '', html: '', attachments: [] };
  out.from = decodeEnTete(h.from || h.sender || h['return-path'] || '');
  out.to = decodeEnTete(h.to || h['delivered-to'] || h['x-original-to'] || '');
  out.subject = decodeEnTete(h.subject || '');
  parcourir(head, body, out, 0);
  return out;
}

// ── Formes emballées ───────────────────────────────────────────────────────
const CLES_IMBRIQUEES = ['message', 'email', 'mail', 'data', 'payload', 'msg', 'value', 'record', 'item'];
const CLES_BRUTES = ['raw', 'rawEmail', 'raw_email', 'mime', 'rawMime', 'body-mime', 'bodyMime', 'rawMessage', 'content', 'eml'];

// Les en-têtes peuvent arriver en tableau [{name,value}] ou en objet {From:…}.
function depuisEnTetes(h) {
  const m = {};
  if (Array.isArray(h)) for (const e of h) { const k = String((e && (e.name || e.Name || e.key)) || '').toLowerCase(); if (k) m[k] = (e.value != null ? e.value : e.Value) || ''; }
  else if (h && typeof h === 'object') for (const k in h) m[String(k).toLowerCase()] = h[k];
  return m;
}

/**
 * Rend TOUJOURS { from, to, subject, text, html, attachments } — et `forme`,
 * le nom de la forme reconnue (pour le journal : savoir CE QU'ON A REÇU).
 */
function normaliserEntrant(body, prof = 0) {
  const vide = { from: '', to: '', subject: '', text: '', html: '', attachments: [], forme: 'inconnue' };
  if (body == null || prof > 4) return vide;

  // 1) Une chaîne : soit du JSON, soit un email brut.
  if (typeof body === 'string') {
    const s = body.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try { return normaliserEntrant(JSON.parse(s), prof + 1); } catch (_) { /* pas du JSON */ }
    }
    if (ressembleAduMime(s)) return { ...lireMime(s), forme: 'mime-brut' };
    return { ...vide, text: s, forme: 'texte-nu' };
  }
  if (Buffer.isBuffer(body)) return normaliserEntrant(body.toString('utf8'), prof + 1);
  if (typeof body !== 'object') return vide;

  const b = body;

  // 2) L'email brut est dans un champ (Cloudflare Email Workers, SES, Zapier…).
  for (const k of CLES_BRUTES) {
    const v = b[k];
    if (typeof v === 'string' && ressembleAduMime(v)) return { ...lireMime(v), forme: 'mime-dans-' + k };
  }

  // 3) Forme Postmark.
  if (b.FromFull || b.Subject != null || b.TextBody != null) {
    return {
      from: (b.FromFull && b.FromFull.Email) || b.From || '',
      to: (b.ToFull && b.ToFull[0] && b.ToFull[0].Email) || b.To || '',
      subject: b.Subject || '',
      text: b.TextBody || '', html: b.HtmlBody || '',
      attachments: (b.Attachments || []).map(a => ({ filename: a.Name, contentType: a.ContentType, contentB64: a.Content })),
      forme: 'postmark',
    };
  }

  // 4) Forme à plat (SendGrid / Mailgun / JSON générique).
  const heads = depuisEnTetes(b.headers || b.Headers);
  const env = b.envelope && typeof b.envelope === 'object' ? b.envelope : {};
  const plat = {
    from: b.from || b.sender || b.From || b.Sender || heads.from || env.from || '',
    to: b.to || b.recipient || b.To || b.Recipient || heads.to || (Array.isArray(env.to) ? env.to[0] : env.to) || '',
    subject: b.subject || b.Subject || b.title || heads.subject || '',
    text: b.text || b['body-plain'] || b.plain || b.textBody || b.TextBody || b['stripped-text'] || '',
    html: b.html || b['body-html'] || b.htmlBody || b.HtmlBody || b['stripped-html'] || '',
  };
  const atts = b.attachments || b.Attachments || [];
  plat.attachments = (Array.isArray(atts) ? atts : []).map(a => ({
    filename: a.filename || a.name || a.Name || '',
    contentType: a.contentType || a.type || a.ContentType || a.mimeType || '',
    contentB64: a.contentB64 || a.content || a.Content || a.data || '',
  }));
  // ⚠️ La forme à plat ne « gagne » que si elle a vraiment lu quelque chose.
  // Sinon on descend dans l'objet imbriqué — c'est ce cas-là qui produisait un
  // expéditeur et un sujet vides, donc un email perdu sans laisser de trace.
  if (plat.from || plat.subject || plat.text || plat.html) return { ...plat, forme: 'plate' };

  // 5) Emballé dans un sous-objet.
  for (const k of CLES_IMBRIQUEES) {
    if (b[k] && typeof b[k] === 'object') {
      const r = normaliserEntrant(b[k], prof + 1);
      if (r.from || r.subject || r.text || r.html) return { ...r, forme: k + '>' + r.forme };
    }
  }
  // 6) Un seul sous-objet inconnu : on tente quand même (aucun risque, on ne
  //    fait que LIRE des champs).
  const sous = Object.keys(b).filter(k => b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]));
  if (sous.length === 1) {
    const r = normaliserEntrant(b[sous[0]], prof + 1);
    if (r.from || r.subject || r.text || r.html) return { ...r, forme: sous[0] + '>' + r.forme };
  }
  return vide;
}

// ⚠️ « HIDE MY EMAIL » D'iCLOUD RÉÉCRIT L'EXPÉDITEUR — mesuré le 30 août :
// 37 des 453 emails conservés arrivent sous la forme
//   no-reply_at_vinted_fr_t9zxbbb6tn7gbf_bcrq1890@icloud.com
//   shipping_at_relay_vinted_com_t9zx4089tn7g48_18rq1890@icloud.com
// au lieu de `no-reply@vinted.fr` / `shipping@relay.vinted.com`. Tout test sur
// l'expéditeur (`/shipping@|relay\.vinted/`, `/chronopost/`, `/@team\.vinted/`)
// échoue donc sur ces emails-là. Le cas mesuré était un VRAI email de
// transporteur (SEUR, « Tu envío ha sido recogido ») que rien n'a reconnu.
// ⚠️ On NE reconstruit PAS l'adresse exacte : on ne sait pas où s'arrête le
// domaine et où commencent les jetons aléatoires, et deviner produirait une
// adresse fausse. On rend le nom et le domaine LISIBLES dans la chaîne — c'est
// tout ce dont les tests par sous-chaîne ont besoin — et on garde l'original.
function demasquerRelais(adr) {
  const a = String(adr || '');
  const m = a.match(/([A-Za-z0-9][A-Za-z0-9._-]*)_at_([A-Za-z0-9_]+)@(?:icloud\.com|privaterelay\.appleid\.com|duck\.com|simplelogin\.[a-z]+|anonaddy\.me)/i);
  if (!m) return '';
  return m[1] + '@' + m[2].replace(/_/g, '.');
}

// Empreinte du contenant, pour le journal : les clés reçues, rien du contenu.
function formeRecue(body) {
  if (body == null) return '(vide)';
  if (typeof body === 'string') return 'chaîne(' + body.length + ')';
  if (Buffer.isBuffer(body)) return 'buffer(' + body.length + ')';
  if (typeof body !== 'object') return typeof body;
  return Object.keys(body).slice(0, 25).join(',');
}

export { normaliserEntrant, formeRecue, lireMime, decodeEnTete, decodeQP, ressembleAduMime, demasquerRelais };
