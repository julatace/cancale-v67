// api/email-inbound.js
// ────────────────────────────────────────────────────────────────────────────
// PIPELINE EMAIL UNIVERSEL (remplace l'Apps Script Gmail, marche pour TOUS les
// fournisseurs : iCloud, Gmail, Outlook…).
//
// Principe : l'utilisateur met une règle « transférer les mails Vinted » vers une
// adresse à nous (ex. recu@usevrm.com). Un service de réception (Cloudflare Email
// Routing, Postmark inbound, Mailgun…) POST le contenu du mail sur cette route.
// On parse ici (ventes, factures, bordereaux) et on range dans Supabase, comme
// le reste de l'app. Aucune dépendance à Google.
//
// Sécurité : on exige ?key=EMAIL_INBOUND_SECRET (variable d'env Vercel) pour que
// personne d'autre ne puisse injecter de fausses données.
//
// Formats acceptés (normalisés) : Postmark, SendGrid, Mailgun, ou un JSON
// générique { from, to, subject, text, html, attachments:[{filename,
// contentType, content(base64)}] } — ce que renvoie un Worker Cloudflare.
// ────────────────────────────────────────────────────────────────────────────

import { sendPushToAll } from './_lib/push.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

// ── Utilitaires ─────────────────────────────────────────────────────────────

function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n').replace(/<\/tr>/gi, '\n').replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&euro;/g, '€')
    .replace(/&#8364;/g, '€').replace(/&#\d+;/g, ' ');
}

// Normalise le corps de requête (selon le service de réception) vers une forme
// unique : { from, to, subject, text, html, attachments:[{filename, contentType, contentB64}] }
function normalizeInbound(body) {
  const b = body || {};
  const out = { from: '', to: '', subject: '', text: '', html: '', attachments: [] };

  // Postmark inbound
  if (b.FromFull || b.Subject != null || b.TextBody != null) {
    out.from = (b.FromFull && b.FromFull.Email) || b.From || '';
    out.to = (b.ToFull && b.ToFull[0] && b.ToFull[0].Email) || b.To || '';
    out.subject = b.Subject || '';
    out.text = b.TextBody || '';
    out.html = b.HtmlBody || '';
    out.attachments = (b.Attachments || []).map(a => ({ filename: a.Name, contentType: a.ContentType, contentB64: a.Content }));
    return out;
  }
  // SendGrid inbound parse (champs "subject", "text", "html", "from", "to")
  // Mailgun ("subject", "body-plain", "body-html", "sender", "recipient")
  // + JSON générique (Cloudflare Worker) : { from, to, subject, text, html, attachments }
  out.from = b.from || b.sender || '';
  out.to = b.to || b.recipient || '';
  out.subject = b.subject || '';
  out.text = b.text || b['body-plain'] || '';
  out.html = b.html || b['body-html'] || '';
  const atts = b.attachments || b.Attachments || [];
  out.attachments = (Array.isArray(atts) ? atts : []).map(a => ({
    filename: a.filename || a.name || a.Name || '',
    contentType: a.contentType || a.type || a.ContentType || '',
    contentB64: a.contentB64 || a.content || a.Content || a.data || '',
  }));
  return out;
}

async function supabaseUpsert(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  return res.ok;
}

// Détection best-effort du compte : on cherche un login/email de compte connu
// dans le texte brut du mail. (Optionnel : la donnée reste utile sans compte.)
async function detectAccount(raw) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=vinted_user_id,login`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return { uid: '', login: '' };
    const accts = await res.json();
    const low = (raw || '').toLowerCase();
    for (const a of accts) {
      if (a.login && low.includes(String(a.login).toLowerCase())) return { uid: String(a.vinted_user_id), login: a.login };
    }
  } catch (_) {}
  return { uid: '', login: '' };
}

function shortHash(s) {
  let h = 0; const str = String(s || '');
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(36);
}

// ── Parsers (portés fidèlement de l'Apps Script) ────────────────────────────

function extraireNumerosLot(body) {
  const numeros = [];
  const sectionMatch = body.match(/Commande\s*[\n:]\s*([\s\S]+?)(?=\nAdresse|\ne-mail|www\.|http|Conditions|TVA|$)/i);
  const section = sectionMatch ? sectionMatch[1] : '';
  const push = (txt) => { const re = /[nN][º°]?(\d{2,6})(?!\d)/g; let m; while ((m = re.exec(txt)) !== null) { if (!numeros.includes(m[1])) numeros.push(m[1]); } };
  if (section) push(section);
  if (numeros.length === 0) push(body.length > 2000 ? body.slice(-2000) : body);
  return numeros;
}

function parseSaleEmail({ subject, text, html }) {
  let body = text || '';
  if (body.length < 100) body = htmlToText(html);
  const cleanBody = body.replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
  const data = { pseudo: '', designation: '', prix: '', numero: '', nomComplet: '', adresse: '', email: '' };
  const stripBrackets = s => s.replace(/^\[.*?\]\s*/, '').trim();

  const pseudoMatch = cleanBody.match(/(\S+)\s+a\s+achet/i);
  if (pseudoMatch) data.pseudo = pseudoMatch[1].trim();

  const prixMatch = cleanBody.match(/(\d+[,.]\d{2})\s*€/);
  if (prixMatch) data.prix = prixMatch[1].replace(',', '.');

  let designMatch = cleanBody.match(/a\s+achet[éeè]\s*\n?([\s\S]+?)\s*\n?\s*\d+[,.]\d{2}\s*€/i);
  if (designMatch) data.designation = stripBrackets(designMatch[1].trim().replace(/\s+/g, ' '));
  if (!data.designation) {
    const d2 = cleanBody.match(/a\s+achet[éeè]\s+(.+?)\s+\d+[,.]\d{2}\s*€/i);
    if (d2) data.designation = stripBrackets(d2[1].trim().replace(/\s+/g, ' '));
  }

  let numMatch = data.designation.match(/[nN][º°]?(\d{2,6})(?!\d)/);
  if (!numMatch) numMatch = (subject || '').match(/[nN][º°]?(\d{2,6})(?!\d)/);
  if (numMatch) {
    data.numero = numMatch[1];
    data.designation = data.designation.replace(/-?\s*[nN][º°]?\d{2,6}(?!\d)/, '').trim().replace(/\s+/g, ' ');
  }
  if (!data.numero && /^\d+\s+articles?$/i.test(data.designation)) {
    const lot = extraireNumerosLot(cleanBody);
    if (lot.length > 0) data.numero = lot.join('+');
  }

  const adresseMatch = cleanBody.match(/Adresse\s*:\s*([\s\S]+?)\s*Adresse\s*e-mail/i);
  if (adresseMatch) {
    const full = adresseMatch[1].replace(/\s+/g, ' ').trim();
    const parts = full.split(',');
    if (parts.length >= 2) { data.nomComplet = parts[0].trim(); data.adresse = parts.slice(1).join(',').trim(); }
    else data.adresse = full;
  }
  const emailMatch = cleanBody.match(/Adresse\s*e-mail\s*:\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) data.email = emailMatch[1].trim();

  return (data.pseudo && data.prix) ? data : null;
}

function parseBordereauEmail({ subject, text, html, attachments }) {
  const body = text || '';
  const htmlText = htmlToText(html);
  const attachNames = (attachments || []).map(a => a.filename || '').join(' ');
  const all = (subject + '\n' + body + '\n' + htmlText + '\n' + attachNames).replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
  const data = { article: '', modele: '', numero: '', taille: '', suivi: '', transaction: '', dateLimite: '' };

  let art = subject.match(/pour\s+(.+?)\s*$/i);
  if (!art) art = all.match(/Article\s*:?\s*([^\n]+?)\s*(?:Format|N[°ºo]?\s*de|\n)/i);
  if (art) data.article = art[1].trim().replace(/\s+/g, ' ');
  if (data.article) {
    const numMatch = data.article.match(/[nN][º°]?(\d{2,6})(?!\d)/);
    if (numMatch) { data.numero = numMatch[1]; data.modele = data.article.replace(/-?\s*[nN][º°]?\d{2,6}(?!\d)/, '').trim().replace(/\s+/g, ' '); }
    else data.modele = data.article;
  }
  for (const pat of [/(?:Taille|T\.?|Size)\s*(\d{2,3}(?:[.,]\d)?)\b/i, /\b(\d{2,3}(?:[.,]\d)?)\s*(?:EU|FR|US|UK)\b/i]) {
    const tm = (data.article || '').match(pat); if (tm) { data.taille = tm[1]; break; }
  }
  let trans = attachNames.match(/Bordereau[- ]Vinted[- ](\d{6,})/i);
  if (!trans) trans = all.match(/N[°ºo]?\s*de\s*transaction\s*:?\s*(\d{6,})/i);
  if (!trans) trans = all.match(/transaction\s*:?\s*(\d{8,})/i);
  if (trans) data.transaction = trans[1].trim();
  let suivi = all.match(/N[°ºo]?\s*de\s*suivi\s*:?\s*([A-Z]{2}[A-Z0-9]{6,})/i);
  if (!suivi) suivi = all.match(/suivi\s*:?\s*([A-Z]{2}[A-Z0-9]{6,})/i);
  if (suivi) data.suivi = suivi[1].trim();
  const date = all.match(/avant\s*le\s*:?\s*(\d{2}\/\d{2}\/\d{4}[\s\dh:]*?)(?:\s*pour|\n|$)/i);
  if (date) data.dateLimite = date[1].trim().replace(/\s+/g, ' ');

  return data.transaction ? data : null;
}

// ── Handler ─────────────────────────────────────────────────────────────────

// ── Emails transporteurs (Mondial Relay / Chronopost) : n° de suivi + étape ──
function parseCarrierEmail(mail, carrier) {
  const txt = mail.text || htmlToText(mail.html) || '';
  const all = (mail.subject || '') + '\n' + txt;

  // N° de suivi / d'expédition
  let suivi = null;
  const m1 = all.match(/n[°o]\s*(?:d['e]?\s*)?(?:exp[ée]dition|colis|suivi|envoi)\s*[:\-]?\s*([A-Z0-9]{6,20})/i);
  if (m1) suivi = m1[1];
  if (!suivi && carrier === 'chronopost') {
    const m = all.match(/\b([A-Z]{2}\d{9}[A-Z]{2})\b/); // format international XX123456789XX
    if (m) suivi = m[1];
  }
  if (!suivi) { const m = all.match(/\b(\d{8,14})\b/); if (m) suivi = m[1]; }

  // Étape du colis (du plus avancé au moins avancé)
  const t = all.toLowerCase();
  let status = 'info', label = 'Mise à jour';
  if (/livr[ée]|remis au destinataire|a bien [ée]t[ée] retir[ée]|r[ée]ceptionn[ée]/.test(t)) { status = 'delivered'; label = 'Livré / retiré'; }
  else if (/disponible|à retirer|arriv[ée] (?:dans|en|au) point|pr[êe]t.*retrait/.test(t)) { status = 'available'; label = 'Arrivé au point de retrait'; }
  else if (/acheminement|en transit|exp[ée]di[ée]|pris en charge|d[ée]pos[ée]|enregistr[ée]|en cours de livraison/.test(t)) { status = 'transit'; label = 'En transit'; }
  return { suivi, status, label };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  // Garde-fou : clé secrète partagée avec le service de réception.
  const secret = process.env.EMAIL_INBOUND_SECRET;
  if (secret) {
    const key = (req.query && req.query.key) || '';
    if (key !== secret) { res.status(401).json({ error: 'clé invalide' }); return; }
  }

  let mail;
  try { mail = normalizeInbound(typeof req.body === 'string' ? JSON.parse(req.body) : req.body); }
  catch (_) { res.status(200).json({ ok: false, error: 'corps illisible' }); return; }

  const subject = mail.subject || '';
  const rawForDetect = `${mail.from}\n${mail.to}\n${subject}\n${mail.text}`;
  const acc = await detectAccount(rawForDetect);
  const now = new Date().toISOString();

  try {
    // 0) TRANSPORTEURS (Mondial Relay / Chronopost) → suivi de colis.
    const carrier = /mondial\s*relay|mondialrelay/i.test(mail.from) ? 'mondialrelay'
                  : /chronopost/i.test(mail.from) ? 'chronopost' : null;
    if (carrier) {
      const track = parseCarrierEmail(mail, carrier);
      const rowId = `email_track_${carrier}_${track.suivi || shortHash(subject)}`;
      await supabaseUpsert([{ id: rowId, data: {
        type: 'suivi', carrier, suivi: track.suivi || '', status: track.status,
        statusLabel: track.label, subject, receivedAt: now,
      } }]);
      // Notif push selon l'étape du colis.
      const icons = { delivered: '✅', available: '📍', transit: '🚚', info: '📦' };
      const titles = { delivered: 'Colis livré', available: 'Colis arrivé au point de retrait', transit: 'Colis en transit', info: 'Suivi colis' };
      try { await sendPushToAll({
        title: `${icons[track.status]} ${titles[track.status]}`,
        body: `${carrier === 'mondialrelay' ? 'Mondial Relay' : 'Chronopost'}${track.suivi ? ' — n°' + track.suivi : ''} : ${track.label}.`,
        tag: `track-${track.suivi || rowId}`, url: '/',
      }); } catch (_) {}
      res.status(200).json({ ok: true, type: 'suivi', carrier, suivi: track.suivi, status: track.status });
      return;
    }

    // 1) BORDEREAU (a une pièce jointe PDF) — prioritaire.
    if (/Bordereau\s+d['’]envoi/i.test(subject)) {
      const data = parseBordereauEmail(mail);
      if (!data) { res.status(200).json({ ok: false, type: 'bordereau', error: 'parse échec' }); return; }
      const pdf = (mail.attachments || []).find(a => /application\/pdf/i.test(a.contentType || '') || /\.pdf$/i.test(a.filename || ''));
      const row = {
        id: `email_bord_${data.transaction}`,
        data: { type: 'bordereau', ...data, account: acc.login || '', uid: acc.uid || '', pdfB64: pdf ? pdf.contentB64 : null, filename: pdf ? pdf.filename : null, receivedAt: now },
      };
      await supabaseUpsert([row]);
      // Notif push : bordereau prêt = colis à expédier.
      try { await sendPushToAll({ title: '📦 Bordereau reçu', body: `${data.modele || 'Article'}${data.numero ? ` — N°${data.numero}` : ''} : à expédier${data.dateLimite ? ` avant le ${data.dateLimite}` : ''}.`, tag: `bord-${data.transaction}`, url: '/' }); } catch (_) {}
      res.status(200).json({ ok: true, type: 'bordereau', transaction: data.transaction, numero: data.numero, pdf: !!pdf });
      return;
    }

    // 2) FINALISATION (argent reçu).
    if (/transaction\s+finalis/i.test(subject)) {
      const key = shortHash(subject + '|' + (mail.text || '').slice(0, 400));
      await supabaseUpsert([{ id: `email_final_${key}`, data: { type: 'finalisation', subject, account: acc.login || '', uid: acc.uid || '', receivedAt: now } }]);
      // Notif push : l'argent arrive dans le porte-monnaie.
      try { await sendPushToAll({ title: '💰 Argent reçu', body: subject.replace(/vinted/gi, '').trim() || 'Une transaction vient d\'être finalisée.', tag: `final-${key}`, url: '/' }); } catch (_) {}
      res.status(200).json({ ok: true, type: 'finalisation' });
      return;
    }

    // 3) VENTE ("Ton article s'est vendu") → facture.
    if (/vendu/i.test(subject) || /a\s+achet/i.test(mail.text || '')) {
      const data = parseSaleEmail(mail);
      if (!data) { res.status(200).json({ ok: false, type: 'vente', error: 'parse échec' }); return; }
      const key = shortHash(`${data.pseudo}|${data.prix}|${(data.designation || '').slice(0, 40)}`);
      await supabaseUpsert([{ id: `email_sale_${key}`, data: { type: 'vente', ...data, account: acc.login || '', uid: acc.uid || '', receivedAt: now } }]);
      // Notif push : vente en temps réel, même app fermée et ordi éteint.
      try { await sendPushToAll({ title: '💸 Vendu !', body: `${data.designation || 'Article'}${data.prix ? ` — ${data.prix} €` : ''}${acc.login ? ` (${acc.login})` : ''}`, tag: `sale-${key}`, url: '/' }); } catch (_) {}
      res.status(200).json({ ok: true, type: 'vente', pseudo: data.pseudo, prix: data.prix, numero: data.numero });
      return;
    }

    res.status(200).json({ ok: true, type: 'ignoré', subject });
  } catch (e) {
    // On répond 200 pour éviter que le service de mail ne rejoue / bounce.
    res.status(200).json({ ok: false, error: String(e) });
  }
}
