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
import { stampBordereau } from './_lib/stamp.js';

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
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
    const low = (raw || '').toLowerCase();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=vinted_user_id,login`, { headers });
    const accts = res.ok ? await res.json() : [];
    // 1) Par EMAIL de compte (renseigné dans l'app : Comptes liés → champ 📧).
    //    Fiable même avec les adresses masquées iCloud : on cherche l'adresse
    //    destinataire dans le texte brut du mail (To inclus).
    try {
      const r2 = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=data->vinted_account_emails`, { headers });
      if (r2.ok) {
        const rows = await r2.json();
        const map = (rows[0] && rows[0].vinted_account_emails) || {};
        for (const uid in map) {
          const em = String(map[uid] || '').toLowerCase().trim();
          if (em && low.includes(em)) {
            const a = accts.find(x => String(x.vinted_user_id) === String(uid));
            return { uid: String(uid), login: (a && a.login) || '' };
          }
        }
      }
    } catch (_) {}
    // 2) Par pseudo cité dans le texte du mail.
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
  // Garde-fou : un vrai n° de suivi est en MAJUSCULES/chiffres — sinon c'est un
  // mot de phrase attrapé par erreur (ex. « suivi apparaissent »).
  if (suivi && /^[A-Z0-9]{8,}$/.test(suivi[1].trim())) data.suivi = suivi[1].trim();
  const date = all.match(/avant\s*le\s*:?\s*(\d{2}\/\d{2}\/\d{4}[\s\dh:]*?)(?:\s*pour|\n|$)/i);
  if (date) data.dateLimite = date[1].trim().replace(/\s+/g, ' ');

  return data.transaction ? data : null;
}

// ── Handler ─────────────────────────────────────────────────────────────────

// ── Facturation Pro ─────────────────────────────────────────────────────────
// Si l'utilisateur a activé la facturation dans l'app (ligne vrm_pro_facture)
// et que l'email de vente contient les coordonnées de l'acheteur (comptes
// Vinted Pro), on prépare la facture. Elle part automatiquement (via le script
// Gmail) UNIQUEMENT si le toggle « envoi automatique » est ON — sinon elle
// attend un envoi manuel dans l'onglet Factures.

async function supabaseGetRow(id) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&select=data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return (rows[0] && rows[0].data) || null;
  } catch (_) { return null; }
}

function buildInvoiceHtml(cfg, sale, number, dateStr) {
  const tauxTva = parseFloat(cfg.tauxTva || '0') || 0;
  const ttc = parseFloat(sale.prix) || 0;
  const ht = tauxTva > 0 ? Math.round(ttc / (1 + tauxTva / 100) * 100) / 100 : ttc;
  const tvaMt = tauxTva > 0 ? Math.round((ttc - ht) * 100) / 100 : 0;
  const eur = n => n.toFixed(2).replace('.', ',') + ' €';
  const adresse = [cfg.adresse, [cfg.codePostal, cfg.ville].filter(Boolean).join(' ')].filter(Boolean).join(' – ');
  const lignesTva = tauxTva > 0
    ? `<tr><td style="padding:6px 8px">Sous-total HT</td><td style="padding:6px 8px;text-align:right">${eur(ht)}</td></tr>` +
      `<tr><td style="padding:6px 8px">TVA ${tauxTva} %</td><td style="padding:6px 8px;text-align:right">${eur(tvaMt)}</td></tr>`
    : `<tr><td colspan="2" style="padding:6px 8px;color:#666;font-size:12px">TVA non applicable – art. 293 B du CGI</td></tr>`;
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#222">` +
    (cfg.logo ? `<img src="cid:logoFacture" style="max-height:80px;margin-bottom:16px" alt="logo"/>` : '') +
    `<h2 style="margin:0 0 4px">FACTURE ${number}</h2>` +
    `<p style="color:#666;margin:0 0 20px">Date : ${dateStr}</p>` +
    `<table style="width:100%;margin-bottom:20px"><tr>` +
    `<td style="vertical-align:top;font-size:13px"><b>${cfg.nom || ''}</b><br>${adresse}` +
    (cfg.siret ? `<br>SIRET : ${cfg.siret}` : '') + (cfg.tva ? `<br>N° TVA : ${cfg.tva}` : '') + `</td>` +
    `<td style="vertical-align:top;text-align:right;font-size:13px"><b>${sale.nomComplet || ''}</b><br>${sale.adresse || ''}<br>${sale.email}</td></tr></table>` +
    `<table style="width:100%;border-collapse:collapse;font-size:13px">` +
    `<tr style="background:#f5f5f5"><th style="text-align:left;padding:8px">Article</th><th style="text-align:right;padding:8px">Montant</th></tr>` +
    `<tr><td style="padding:8px;border-bottom:1px solid #eee">${sale.designation || 'Article Vinted'}</td>` +
    `<td style="padding:8px;text-align:right;border-bottom:1px solid #eee">${eur(ttc)}</td></tr>` +
    lignesTva +
    `<tr><td style="padding:8px"><b>Total TTC</b></td><td style="padding:8px;text-align:right"><b>${eur(ttc)}</b></td></tr>` +
    `</table>` +
    `<p style="color:#27a85d;font-weight:bold">Facture acquittée</p>` +
    (cfg.mentions ? `<p style="font-size:12px;color:#666;white-space:pre-line">${cfg.mentions}</p>` : '') +
    `</div>`;
}

async function createProInvoice(sale, acc, cfg, now) {
  // Numéro séquentiel : compteur partagé dans Supabase (jamais réutilisé).
  const counter = (parseInt(await supabaseGetRow('vrm_invoice_counter'), 10) || 0) + 1;
  await supabaseUpsert([{ id: 'vrm_invoice_counter', data: counter }]);
  const number = `${cfg.prefixe || 'FA'}-${new Date().getFullYear()}-${('0000' + counter).slice(-4)}`;
  const dateStr = new Date().toLocaleDateString('fr-FR');
  const html = buildInvoiceHtml(cfg, sale, number, dateStr);
  const key = shortHash(`${sale.pseudo}|${sale.prix}|${(sale.designation || '').slice(0, 40)}`);
  const status = cfg.autoSend ? 'queued' : 'draft';
  await supabaseUpsert([{ id: `email_invoice_${key}`, data: {
    type: 'facture_pro', number, status,
    designation: sale.designation || '', prix: sale.prix || '',
    buyerName: sale.nomComplet || '', buyerEmail: sale.email, buyerAddress: sale.adresse || '',
    numero: sale.numero || '', pseudo: sale.pseudo || '',
    account: acc.login || '', html, createdAt: now,
  } }]);
  return { number, status };
}

// Journal des emails traités (30 derniers, même les « ignorés ») : permet de
// vérifier qu'un email a bien atteint le serveur et comment il a été classé.
async function logEmail(entry) {
  try {
    const cur = (await supabaseGetRow('email_journal')) || { entries: [] };
    const entries = [{ ...entry, at: new Date().toISOString() }, ...(cur.entries || [])].slice(0, 30);
    await supabaseUpsert([{ id: 'email_journal', data: { entries } }]);
  } catch (_) {}
}

// Retrouve le N° d'une paire par le titre de l'annonce (annonces numérotées
// de l'app, synchronisées). Refuse de deviner si deux annonces ont le même titre.
async function findNumeroByTitle(title) {
  if (!title) return '';
  try {
    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const t = norm(title);
    if (!t) return '';
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=data->vinted_annonce_numeros`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return '';
    const rows = await res.json();
    const map = (rows[0] && rows[0].vinted_annonce_numeros) || {};
    const nums = [...new Set(Object.values(map)
      .filter(e => e && e.numero && norm(e.title) === t)
      .map(e => String(e.numero)))];
    return nums.length === 1 ? nums[0] : '';
  } catch (_) { return ''; }
}

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

  // Code de retrait (PIN) : « code de retrait : 123456 », « PIN : 1234 »...
  let code = (all.match(/(?:code\s+(?:de\s+)?(?:retrait|r[ée]ception|livraison)|pin)\s*[:\-]?\s*([A-Z0-9]{4,8})\b/i) || [])[1] || null;
  if (!code) {
    const m = all.match(/\bcode\s*[:\-]\s*([A-Z0-9]{4,8})\b/i);
    // garde-fou : ne pas confondre avec un code postal
    if (m && !/postal/i.test(all.slice(Math.max(0, m.index - 14), m.index + 4))) code = m[1];
  }
  // Titre de l'article (permet de retrouver la photo côté achats)
  const artTitle = ((all.match(/(?:article|commande|achat)\s*[:\-]\s*([^\n]{4,70})/i) || [])[1] || '').trim() || null;

  // Lieu de retrait : nom/adresse du point relais ou du locker.
  let lieu = null;
  for (const pat of [
    /point\s+relais\s*[:\-]?\s*([^\n]{5,90})/i,
    /(?:disponible|à retirer|retire[rz]?(?:\s+ton\s+colis)?)\s+(?:chez|au|à|dans)\s+([^\n]{5,90})/i,
    /adresse\s+du\s+point\s*[:\-]?\s*([^\n]{5,90})/i,
    /\bchez\s+([A-Z][^\n]{4,80})/,
  ]) {
    const m = all.match(pat);
    if (m) { lieu = m[1].trim().replace(/\s+/g, ' ').replace(/[.,;]\s*$/, ''); break; }
  }

  return { suivi, status, label, code, artTitle, lieu };
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
    // 0) SUIVI DE COLIS.
    // Trois provenances : les transporteurs eux-mêmes (Mondial Relay /
    // Chronopost), leurs emails relayés par une adresse masquée iCloud
    // (expéditeur réécrit → on regarde aussi le sujet), et les emails
    // d'expédition de Vinted (shipping@relay.vinted.com). Jamais pour un
    // bordereau (traité au point 1, prioritaire).
    const isBordereauSubject = /Bordereau\s+d['’]envoi/i.test(subject);
    const fromVinted = /vinted/i.test(mail.from);
    const isVintedShipping = /shipping@|relay\.vinted/i.test(mail.from);
    const carrierSrc = (fromVinted && !isVintedShipping)
      ? mail.from
      : `${mail.from} ${subject} ${(mail.text || '').slice(0, 800)}`;
    let carrier = /mondial\s*relay|mondialrelay/i.test(carrierSrc) ? 'mondialrelay'
                : /chronopost/i.test(carrierSrc) ? 'chronopost' : null;
    if (!carrier && isVintedShipping) carrier = 'vinted'; // suivi Vinted (Vinted Go...)
    if (isBordereauSubject) carrier = null; // un bordereau n'est pas un suivi
    if (carrier) {
      const track = parseCarrierEmail(mail, carrier);
      // QR / code-barres de retrait éventuellement joint à l'email
      const qr = (mail.attachments || []).find(a =>
        /image\//i.test(a.contentType || '') && /qr|barre|barcode|code|retrait|pickup/i.test(a.filename || ''));
      const rowId = `email_track_${carrier}_${track.suivi || shortHash(subject)}`;
      await supabaseUpsert([{ id: rowId, data: {
        type: 'suivi', carrier, suivi: track.suivi || '', status: track.status,
        statusLabel: track.label, subject, receivedAt: now,
        code: track.code || null, artTitle: track.artTitle || null, lieu: track.lieu || null,
        qrB64: qr ? qr.contentB64 : null, qrType: qr ? qr.contentType : null,
        account: acc.login || '',
      } }]);
      // Notif push selon l'étape du colis.
      const icons = { delivered: '✅', available: '📍', transit: '🚚', info: '📦' };
      const titles = { delivered: 'Colis livré', available: 'Colis arrivé au point de retrait', transit: 'Colis en transit', info: 'Suivi colis' };
      try { await sendPushToAll({
        title: `${icons[track.status]} ${titles[track.status]}`,
        body: `${carrier === 'mondialrelay' ? 'Mondial Relay' : carrier === 'chronopost' ? 'Chronopost' : 'Vinted'}${track.suivi ? ' — n°' + track.suivi : ''} : ${track.label}.${track.status === 'available' && track.code ? ` Code de retrait : ${track.code}` : ''}`,
        tag: `track-${track.suivi || rowId}`, url: '/?tab=cat_achats',
      }); } catch (_) {}
      await logEmail({ type: 'suivi', subject, from: mail.from, carrier, suivi: track.suivi, statut: track.label });
      res.status(200).json({ ok: true, type: 'suivi', carrier, suivi: track.suivi, status: track.status });
      return;
    }

    // 1) BORDEREAU (a une pièce jointe PDF) — prioritaire.
    if (/Bordereau\s+d['’]envoi/i.test(subject)) {
      const data = parseBordereauEmail(mail);
      if (!data) { res.status(200).json({ ok: false, type: 'bordereau', error: 'parse échec' }); return; }
      const pdf = (mail.attachments || []).find(a => /application\/pdf/i.test(a.contentType || '') || /\.pdf$/i.test(a.filename || ''));
      // N° absent du titre de l'annonce ? On le retrouve dans les annonces
      // numérotées de l'app (correspondance de titre, jamais si ambigu).
      if (!data.numero) data.numero = await findNumeroByTitle(data.modele || data.article);
      // Tamponnage AUTOMATIQUE : N° + titre imprimés sur le PDF à l'emplacement
      // mémorisé pour ce format d'étiquette (réglé une fois dans l'app).
      let pdfTamponneB64 = null, posKnown = false;
      if (pdf) {
        try {
          const rf = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=data->vinted_bordereau_formats`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
          });
          const rfRows = rf.ok ? await rf.json() : [];
          const formats = (rfRows[0] && rfRows[0].vinted_bordereau_formats) || {};
          const st = await stampBordereau(pdf.contentB64, data.numero, data.modele || data.article || '', formats);
          pdfTamponneB64 = st.b64; posKnown = st.posKnown;
        } catch (_) { /* PDF récalcitrant → tamponnage manuel dans l'app */ }
      }
      const row = {
        id: `email_bord_${data.transaction}`,
        data: { type: 'bordereau', ...data, account: acc.login || '', uid: acc.uid || '',
          pdfB64: pdf ? pdf.contentB64 : null, filename: pdf ? pdf.filename : null,
          pdfTamponneB64, posKnown, receivedAt: now },
      };
      await supabaseUpsert([row]);
      // Notif push : bordereau prêt = colis à expédier.
      try { await sendPushToAll({ title: pdfTamponneB64 ? '📦 Bordereau prêt à imprimer' : '📦 Bordereau reçu', body: `${data.modele || 'Article'}${data.numero ? ` — N°${data.numero}` : ''}${pdfTamponneB64 ? ' : déjà tamponné' : ''} — à expédier${data.dateLimite ? ` avant le ${data.dateLimite}` : ''}.`, tag: `bord-${data.transaction}`, url: '/?tab=cat_bord' }); } catch (_) {}
      await logEmail({ type: 'bordereau', subject, from: mail.from, numero: data.numero, transaction: data.transaction, tamponne: !!pdfTamponneB64 });
      res.status(200).json({ ok: true, type: 'bordereau', transaction: data.transaction, numero: data.numero, pdf: !!pdf, tamponne: !!pdfTamponneB64 });
      return;
    }

    // 2) FINALISATION (argent reçu).
    // Formes réelles : « Transaction finalisée », « La transaction est
    // finalisée », corps « Viré sur ton compte Vinted : 41,00 € ».
    const finText = `${subject}\n${(mail.text || htmlToText(mail.html) || '').slice(0, 1500)}`;
    if (/transaction\s+(?:est\s+)?finalis/i.test(finText) || /vir[ée]\s+sur\s+ton\s+compte/i.test(finText)) {
      const key = shortHash(subject + '|' + (mail.text || '').slice(0, 400));
      const article = ((finText.match(/la vente de\s+(.+?)\s+a été réalis/i) || [])[1] || '').trim();
      const montant = (finText.match(/vir[ée]\s+sur\s+ton\s+compte(?:\s+vinted)?\s*:?\s*(\d+[,.]\d{2})\s*€/i) || [])[1] || '';
      const numero = (article.match(/\bn[°º]?\s*(\d{2,6})\b/i) || [])[1] || '';
      await supabaseUpsert([{ id: `email_final_${key}`, data: {
        type: 'finalisation', subject, article, montant, numero,
        account: acc.login || '', uid: acc.uid || '', receivedAt: now,
      } }]);
      // Notif push : l'argent arrive dans le porte-monnaie.
      try { await sendPushToAll({
        title: '💰 Argent reçu',
        body: `${montant ? montant + ' € viré sur ton compte Vinted' : 'Transaction finalisée'}${article ? ' — ' + article.slice(0, 50) : ''}${acc.login ? ` (${acc.login})` : ''}.`,
        tag: `final-${key}`, url: '/?tab=cat_ventes',
      }); } catch (_) {}
      await logEmail({ type: 'finalisation', subject, from: mail.from, montant, article, account: acc.login || '' });
      res.status(200).json({ ok: true, type: 'finalisation', montant, article });
      return;
    }

    // 2b) ACHAT (confirmation de TA commande) — AVANT la branche vente :
    // « tu as acheté » matcherait sinon le détecteur de ventes (« X a
    // acheté ton article »). On archive l'email comme justificatif d'achat
    // (texte + PDF joint éventuel) pour le registre d'achats.
    const achText = `${subject}\n${(mail.text || htmlToText(mail.html) || '').slice(0, 2000)}`;
    if (/(?:tu as|vous avez)\s+achet|merci pour (?:ton|votre) achat|confirmation d['']achat|(?:ton|votre)?\s*re[çc]u pour (?:la |ta |votre )?commande|ta commande|r[ée]capitulatif de (?:ta |votre )?commande/i.test(achText)) {
      const prix = (achText.match(/(\d+[,.]\d{2})\s*€/) || [])[1] || '';
      const article = ((achText.match(/commande\s*[«"“]\s*([^»"”\n]{2,70})\s*[»"”]/i) || achText.match(/(?:achet[ée]e?\s*:?\s*|article\s*:?\s*)[«"“']?([^«»"”'\n]{4,70})/i) || [])[1] || '').trim();
      const transaction = (achText.match(/transaction\s*:?\s*#?(\d{6,})/i) || [])[1] || '';
      const pdfA = (mail.attachments || []).find(a => /application\/pdf/i.test(a.contentType || '') || /\.pdf$/i.test(a.filename || ''));
      const key = transaction || shortHash(subject + (mail.text || '').slice(0, 300));
      await supabaseUpsert([{ id: `email_achat_${key}`, data: {
        type: 'achat', subject, article, prix, transaction,
        account: acc.login || '', uid: acc.uid || '',
        texte: (mail.text || htmlToText(mail.html) || '').slice(0, 4000),
        pdfB64: pdfA ? pdfA.contentB64 : null, filename: pdfA ? pdfA.filename : null,
        receivedAt: now,
      } }]);
      try { await sendPushToAll({
        title: '🛍 Achat confirmé',
        body: `${article || 'Commande Vinted'}${prix ? ` — ${prix} €` : ''}${acc.login ? ` (${acc.login})` : ''} — justificatif archivé.`,
        tag: `achat-${key}`, url: '/?tab=cat_achats',
      }); } catch (_) {}
      await logEmail({ type: 'achat', subject, from: mail.from, prix, article, pdf: !!pdfA, account: acc.login || '' });
      res.status(200).json({ ok: true, type: 'achat', article, prix, transaction, pdf: !!pdfA });
      return;
    }

    // 3) VENTE ("Ton article s'est vendu") → facture.
    if (/vendu/i.test(subject) || /a\s+achet/i.test(mail.text || '')) {
      const data = parseSaleEmail(mail);
      if (!data) { res.status(200).json({ ok: false, type: 'vente', error: 'parse échec' }); return; }
      const key = shortHash(`${data.pseudo}|${data.prix}|${(data.designation || '').slice(0, 40)}`);
      await supabaseUpsert([{ id: `email_sale_${key}`, data: { type: 'vente', ...data, account: acc.login || '', uid: acc.uid || '', receivedAt: now } }]);
      // Notif push : vente en temps réel, même app fermée et ordi éteint.
      try { await sendPushToAll({ title: '💸 Vendu !', body: `${data.designation || 'Article'}${data.prix ? ` — ${data.prix} €` : ''}${acc.login ? ` (${acc.login})` : ''}`, tag: `sale-${key}`, url: '/?tab=cat_ventes' }); } catch (_) {}
      // Facturation Pro : ne se déclenche que si activée dans l'app ET que
      // l'email contient l'adresse email de l'acheteur (comptes Pro).
      let facture = null;
      try {
        if (data.email) {
          const cfg = await supabaseGetRow('vrm_pro_facture');
          if (cfg && cfg.actif) {
            facture = await createProInvoice(data, acc, cfg, now);
            try { await sendPushToAll({
              title: facture.status === 'queued' ? '🧾 Facture en cours d\'envoi' : '🧾 Facture préparée',
              body: `${facture.number} — ${data.designation || 'article'} (${data.prix} €) pour ${data.email}${facture.status === 'queued' ? '' : ' — envoi manuel dans Factures'}`,
              tag: `inv-${facture.number}`, url: '/?tab=invoices',
            }); } catch (_) {}
          }
        }
      } catch (_) {}
      await logEmail({ type: 'vente', subject, from: mail.from, prix: data.prix, numero: data.numero, facture: facture ? facture.number : null });
      res.status(200).json({ ok: true, type: 'vente', pseudo: data.pseudo, prix: data.prix, numero: data.numero, facture });
      return;
    }

    // 4) OFFRE reçue → notif immédiate (les offres expirent en 24h !).
    const textAll = `${subject}\n${mail.text || htmlToText(mail.html) || ''}`;
    // Extrait le contenu utile qui suit une phrase d'annonce (le texte du
    // message reçu, l'éventuel mot accompagnant une offre...). On coupe au
    // premier élément d'habillage (boutons, pied de page, liens).
    const extractAfter = (announceRe, maxLen = 140) => {
      const lines = (mail.text || htmlToText(mail.html) || '').split('\n').map(l => l.trim());
      const idx = lines.findIndex(l => announceRe.test(l));
      if (idx < 0) return '';
      const useful = [];
      for (let i = idx + 1; i < lines.length && useful.length < 4; i++) {
        const l = lines[i];
        if (!l) continue;
        if (/r[ée]pond|d[ée]sabonn|besoin d['']aide|vinted,?\s*uab|facebook|twitter|instagram|https?:|voir (?:le|la)|©|rejoins la/i.test(l)) break;
        useful.push(l);
      }
      return useful.join(' ').slice(0, maxLen);
    };

    if (/offre/i.test(subject) || /t['']a (?:fait|envoyé) une offre|nouvelle offre/i.test(textAll)) {
      const montant = (textAll.match(/(\d+[,.]?\d*)\s*€/) || [])[1] || '';
      const qui = (textAll.match(/(\S+)\s+t['']a\s+(?:fait|envoyé)\s+une\s+offre/i) || [])[1] || '';
      const article = (textAll.match(/offre\s+(?:de\s+[\d,.]+\s*€\s+)?pour\s+[«"“']?([^«»"”'\n]{3,60})/i) || [])[1] || '';
      const key = shortHash(subject + (mail.text || '').slice(0, 200));
      try { await sendPushToAll({
        title: `💰 Offre reçue${montant ? ' : ' + montant + ' €' : ''} !`,
        body: `${qui || 'Un acheteur'} propose ${montant ? montant + ' €' : 'un prix'}${article ? ` pour « ${article.trim().slice(0, 40)} »` : ''}${acc.login ? ` (${acc.login})` : ''} — expire en 24h.`,
        tag: `offer-${key}`, url: '/?tab=cat_msg',
      }); } catch (_) {}
      await logEmail({ type: 'offre', subject, from: mail.from, montant, de: qui, article, account: acc.login || '' });
      res.status(200).json({ ok: true, type: 'offre', montant, de: qui, article });
      return;
    }

    // 5) NOUVEAU MESSAGE → notif immédiate avec le TEXTE du message.
    if (/nouveau message|message de|t['']a envoyé un message|vous avez re[çc]u un message/i.test(textAll)) {
      const qui = (textAll.match(/(?:message de|de la part de)\s+(\S+)/i) || textAll.match(/(\S+)\s+t['']a envoyé/i) || [])[1] || '';
      const extrait = extractAfter(/envoy[ée] un message|nouveau message|message de/i);
      const key = shortHash(subject + (mail.text || '').slice(0, 200));
      try { await sendPushToAll({
        title: `💬 ${qui || 'Message Vinted'}${acc.login ? ` → ${acc.login}` : ''}`,
        body: extrait ? `« ${extrait} »` : 'Nouveau message — ouvre Vinted pour répondre.',
        tag: `msg-${key}`, url: '/?tab=cat_msg',
      }); } catch (_) {}
      await logEmail({ type: 'message', subject, from: mail.from, de: qui, extrait, account: acc.login || '' });
      res.status(200).json({ ok: true, type: 'message', de: qui, extrait });
      return;
    }

    // 6) FAVORI → signal d'achat imminent : bon moment pour faire une offre.
    if (/favoris?\b/i.test(textAll)) {
      const m = textAll.match(/(\S+)\s+a ajouté ton article\s*[«"“']?\s*(.+?)\s*[»"”']?\s+dans ses favoris/i);
      const qui = (m && m[1]) || '';
      const article = (m && m[2]) || '';
      const prix = (textAll.match(/(\d+[,.]\d{2})\s*€/) || [])[1] || '';
      const key = shortHash(subject + (mail.text || '').slice(0, 200));
      try { await sendPushToAll({
        title: '❤️ Nouveau favori !',
        body: `${qui || 'Quelqu\'un'} craque sur « ${(article || 'ton article').slice(0, 45)} »${prix ? ` (${prix} €)` : ''}${acc.login ? ` (${acc.login})` : ''} — fais-lui une offre !`,
        tag: `fav-${key}`, url: '/?tab=cat_annonces',
      }); } catch (_) {}
      await logEmail({ type: 'favori', subject, from: mail.from, de: qui, article, account: acc.login || '' });
      res.status(200).json({ ok: true, type: 'favori', de: qui, article });
      return;
    }

    await logEmail({ type: 'ignoré', subject, from: mail.from });
    res.status(200).json({ ok: true, type: 'ignoré', subject });
  } catch (e) {
    // On répond 200 pour éviter que le service de mail ne rejoue / bounce.
    res.status(200).json({ ok: false, error: String(e) });
  }
}
