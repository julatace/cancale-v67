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
// Anti-doublon des notifications : mémorise les clés déjà notifiées (ligne
// Supabase push_dedup, 300 dernières). Renvoie true si c'est un NOUVEL envoi
// (à faire), false si déjà notifié (à ignorer). Évite les notifs en double
// quand un même email arrive deux fois (transféré via plusieurs boîtes…).
async function shouldNotify(key) {
  if (!key) return true;
  try {
    const cur = (await supabaseGetRow('push_dedup')) || { keys: [] };
    const keys = Array.isArray(cur.keys) ? cur.keys : [];
    if (keys.includes(key)) return false;
    const next = [key, ...keys].slice(0, 300);
    await supabaseUpsert([{ id: 'push_dedup', data: { keys: next } }]);
    return true;
  } catch (_) { return true; }
}
// Envoie une notification UNE seule fois (clé = son tag, déjà unique).
async function pushOnce(payload) {
  try { if (await shouldNotify(payload && payload.tag)) await sendPushToAll(payload); } catch (_) {}
}

async function logEmail(entry) {
  try {
    const cur = (await supabaseGetRow('email_journal')) || { entries: [] };
    const entries = [{ ...entry, at: new Date().toISOString() }, ...(cur.entries || [])].slice(0, 30);
    await supabaseUpsert([{ id: 'email_journal', data: { entries } }]);
  } catch (_) {}
}

// Retrouve le N° d'une paire par le titre de l'annonce (annonces numérotées
// de l'app, synchronisées). Refuse de deviner si deux annonces ont le même titre.
async function findNumeroByTitle(title, size) {
  if (!title) return '';
  try {
    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const normSz = s => String(s == null ? '' : s).toLowerCase().replace(',', '.').replace(/[^0-9.]/g, '').replace(/\.0+$/, '').trim();
    const t = norm(title);
    if (!t) return '';
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=data->vinted_annonce_numeros`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return '';
    const rows = await res.json();
    const map = (rows[0] && rows[0].vinted_annonce_numeros) || {};
    // Une entrée par numéro, titre identique.
    const byNum = new Map();
    for (const e of Object.values(map)) { if (e && e.numero != null && norm(e.title) === t) byNum.set(String(e.numero), e); }
    let cands = [...byNum.values()];
    if (cands.length === 1) return String(cands[0].numero);
    // Plusieurs paires même titre → on départage par la TAILLE si le bordereau
    // la donne (on garde tailles égales OU inconnues ; exacte prioritaire).
    const tgt = normSz(size);
    if (cands.length > 1 && tgt) {
      const exactSz = cands.filter(e => normSz(e.size) === tgt);
      if (exactSz.length === 1) return String(exactSz[0].numero);
      const compat = cands.filter(e => { const es = normSz(e.size); return !es || es === tgt; });
      if (compat.length === 1) return String(compat[0].numero);
    }
    return '';
  } catch (_) { return ''; }
}

// Prix d'achat d'une paire d'après le titre de l'annonce (pour le Copilote
// d'offres). Renvoie un nombre, ou null si introuvable / titre ambigu (plusieurs
// paires même titre avec des prix d'achat différents).
async function findBuyPriceByTitle(title) {
  if (!title) return null;
  try {
    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const t = norm(title); if (!t) return null;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=data->vinted_annonce_numeros`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const map = (rows[0] && rows[0].vinted_annonce_numeros) || {};
    const matches = Object.values(map).filter(e => e && norm(e.title) === t && e.buyPrice != null && String(e.buyPrice).trim() !== '');
    if (!matches.length) return null;
    const distinct = [...new Set(matches.map(e => String(e.buyPrice)))];
    if (distinct.length > 1) return null; // ambigu → on ne devine pas
    const b = parseFloat(String(matches[0].buyPrice).replace(',', '.'));
    return isNaN(b) ? null : b;
  } catch (_) { return null; }
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
  if (/livr[ée]|bien re[çc]u|remis(?:\s+au\s+destinataire)?|a\s+bien\s+[ée]t[ée]\s+retir[ée]|a\s+[ée]t[ée]\s+retir[ée]|retir[ée]\s+(?:le|avec)|bien\s+retir[ée]|r[ée]cup[ée]r[ée]|r[ée]ceptionn[ée]|livraison\s+(?:effectu[ée]e|r[ée]ussie)/.test(t)) { status = 'delivered'; label = 'Livré / retiré'; }
  else if (/disponible|à retirer|arriv[ée] (?:dans|en|au) point|pr[êe]t.*retrait/.test(t)) { status = 'available'; label = 'Arrivé au point de retrait'; }
  // Anti-faux-colis : un vrai « colis disponible » a TOUJOURS un n° de suivi.
  // Sans suivi (emails pub « ton compte évolue », newsletters…), on ne compte
  // PAS comme un colis à retirer.
  if (status === 'available' && !suivi) { status = 'info'; label = 'Info'; }
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
  // Format réel Mondial Relay : « Point Relais » sur sa ligne, puis le nom
  // (Maison de la Presse) et l'adresse (40 Rue du Port / 35260 Cancale)
  // sur les lignes SUIVANTES.
  {
    const lines = txt.split('\n').map(l => l.trim());
    const idx = lines.findIndex(l => /^point\s+(?:relais|de\s+retrait)\b[\s:–-]*$/i.test(l));
    if (idx >= 0) {
      const parts = [];
      for (let i = idx + 1; i < lines.length && parts.length < 3; i++) {
        const l = lines[i];
        if (!l) { if (parts.length) break; else continue; }
        if (/horaires|ouvert|lundi|mardi|retrouve|suivez|super\s*pratique|https?:|désabonn|code|colis/i.test(l)) break;
        parts.push(l.replace(/\s+/g, ' '));
      }
      if (parts.length) {
        lieu = parts.join(', ').replace(/®|™|©/g, '').replace(/\s+(super\s*pratique|retrouvez).*$/i, '').replace(/\s{2,}/g, ' ').trim();
      }
    }
  }
  if (!lieu) for (const pat of [
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

// Dimensions d'une image PNG/GIF depuis son en-tête (sans la décoder en entier).
// Sert à reconnaître un QR : c'est un CARRÉ. Marche pour TOUS les transporteurs
// sans avoir vu leur email à l'avance.
function imgDims(b64) {
  try {
    const bin = Buffer.from(String(b64).slice(0, 64), 'base64');
    if (bin.length >= 24 && bin[0] === 0x89 && bin[1] === 0x50 && bin[2] === 0x4e && bin[3] === 0x47) {
      return { w: bin.readUInt32BE(16), h: bin.readUInt32BE(20) }; // PNG (IHDR)
    }
    if (bin.length >= 10 && bin[0] === 0x47 && bin[1] === 0x49 && bin[2] === 0x46) {
      return { w: bin[6] | (bin[7] << 8), h: bin[8] | (bin[9] << 8) }; // GIF (écran logique)
    }
  } catch (_) {}
  return null;
}
const isSquareish = (d) => d && d.w >= 60 && d.h >= 60 && Math.abs(d.w - d.h) <= 0.18 * Math.max(d.w, d.h);

// Extrait le QR / code-barres de RETRAIT d'un email de colis — pensé pour
// FONCTIONNER AVEC TOUS LES TRANSPORTEURS, sans exemple préalable. Les QR
// arrivent de façons très variées : pièce jointe nommée, image « data:base64 »
// dans le HTML, image carrée jointe sans nom parlant, ou URL d'image hébergée.
// On les couvre toutes, dans l'ordre du plus fiable au plus prudent :
//   1. pièce jointe nommée qr / barcode / retrait / scan
//   2. image « data:base64 » du HTML près d'un mot-clé de retrait/scan
//   3. balise <img src="https://…"> hébergée près d'un mot-clé (→ qrUrl)
//   4. pièce jointe CARRÉE (heuristique QR) si l'email parle de scan/retrait
//   5. email « à retirer » avec une seule image jointe
function extractPickupQr(mail, status) {
  const imgs = (mail.attachments || []).filter(a => /image\//i.test(a.contentType || '') && a.contentB64);
  const html = mail.html || '';
  const hint = /qr|à scanner|a scanner|scanne|code[- ]?barre|pr[ée]sente (?:ce|le) code|pickup|retrait/i
    .test(`${mail.subject || ''}\n${mail.text || ''}\n${html}`);
  const none = { qrB64: null, qrType: null, qrUrl: null };

  // 1) Pièce jointe explicitement nommée.
  const named = imgs.find(a => /qr|barre|barcode|retrait|pickup|scan/i.test(a.filename || ''));
  if (named) return { qrB64: named.contentB64, qrType: named.contentType || 'image/png', qrUrl: null };

  // 2) Image inline data:base64 du HTML, proche d'un mot-clé de retrait.
  if (html) {
    const re = /data:(image\/(?:png|gif|jpe?g));base64,([A-Za-z0-9+/=\s]{80,})/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const ctx = html.slice(Math.max(0, m.index - 300), m.index).toLowerCase();
      if (/qr|à scanner|a scanner|scanne|retrait|pr[ée]sente|pickup|code[- ]?barre/.test(ctx)) {
        return { qrB64: m[2].replace(/\s+/g, ''), qrType: m[1], qrUrl: null };
      }
    }
  }

  // 3) Image hébergée (URL) près d'un mot-clé de retrait/scan.
  if (html) {
    const re = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const ctx = (html.slice(Math.max(0, m.index - 300), m.index) + ' ' + m[1]).toLowerCase();
      if (/qr|scanne|à scanner|a scanner|retrait|pickup|barcode|code[- ]?barre/.test(ctx)) {
        return { qrB64: null, qrType: null, qrUrl: m[1] };
      }
    }
  }

  // 4) Pièce jointe CARRÉE = QR (marche pour tout transporteur). Prudent : on
  //    exige que l'email parle de scan/retrait ET qu'il n'y ait qu'un seul carré
  //    candidat (sinon on ne devine pas → l'app génère un QR depuis le code).
  if (hint) {
    const squares = imgs.filter(a => isSquareish(imgDims(a.contentB64)));
    if (squares.length === 1) {
      return { qrB64: squares[0].contentB64, qrType: squares[0].contentType || 'image/png', qrUrl: null };
    }
  }

  // 5) Email « colis prêt à retirer » avec une seule image jointe.
  if (status === 'available' && imgs.length === 1) {
    return { qrB64: imgs[0].contentB64, qrType: imgs[0].contentType || 'image/png', qrUrl: null };
  }

  return none;
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
    const carrierSrc = ((fromVinted && !isVintedShipping)
      ? mail.from
      : `${mail.from} ${subject} ${(mail.text || '').slice(0, 1200)}`).toLowerCase();
    // Détection élargie : TOUS les transporteurs courants (pas seulement Mondial
    // Relay / Chronopost). L'ordre n'a pas d'importance, chaque test est distinct.
    let carrier =
        /mondial\s*relay|mondialrelay/.test(carrierSrc) ? 'mondialrelay'
      : /chronopost/.test(carrierSrc) ? 'chronopost'
      : /relais\s*colis|relaiscolis/.test(carrierSrc) ? 'relaiscolis'
      : /colissimo|\bla\s*poste\b|laposte/.test(carrierSrc) ? 'colissimo'
      : /shop\s*2\s*shop|shop2shop/.test(carrierSrc) ? 'shop2shop'
      : /inpost/.test(carrierSrc) ? 'inpost'
      : /\bups\b/.test(carrierSrc) ? 'ups'
      : /\bdpd\b/.test(carrierSrc) ? 'dpd'
      : /\bgls\b/.test(carrierSrc) ? 'gls'
      : /\bdhl\b/.test(carrierSrc) ? 'dhl'
      : /\bfedex\b/.test(carrierSrc) ? 'fedex'
      : null;
    if (!carrier && isVintedShipping) carrier = 'vinted'; // suivi Vinted (Vinted Go...)
    // Filet générique : un email de colis d'un transporteur NON listé (point
    // relais / à retirer / suivi) est quand même traité comme un suivi, pour
    // capter QR / code / lieu. On exige un signal fort « colis/retrait » et que
    // ce ne soit pas un email de vente/offre/message Vinted (fromVinted exclu).
    if (!carrier && !fromVinted) {
      const t = `${subject}\n${(mail.text || htmlToText(mail.html) || '').slice(0, 1200)}`.toLowerCase();
      if (/point\s+relais|à\s*retirer|a\s*retirer|code\s+de\s+retrait|pr[êe]t.*retrait|colis.*(retrait|disponible|arriv|livr)|pickup/.test(t)) {
        carrier = 'autre';
      }
    }
    if (isBordereauSubject) carrier = null; // un bordereau n'est pas un suivi
    if (carrier) {
      const track = parseCarrierEmail(mail, carrier);
      // QR / code-barres de retrait : cherché dans les pièces jointes ET dans le
      // HTML embarqué (là où Vinted / Mondial Relay le mettent le plus souvent).
      const qr = extractPickupQr(mail, track.status);
      const rowId = `email_track_${carrier}_${track.suivi || shortHash(subject)}`;
      // Le même colis passe par plusieurs emails (transit → à retirer → livré).
      // Le QR/code/lieu n'arrivent qu'à l'étape « à retirer » : on les GARDE si un
      // email plus tardif (sans ces infos) réécrit la même ligne.
      if (!qr.qrB64 || !qr.qrUrl || !track.code || !track.lieu || !track.artTitle) {
        const prev = await supabaseGetRow(rowId);
        if (prev) {
          if (!qr.qrB64 && prev.qrB64) { qr.qrB64 = prev.qrB64; qr.qrType = prev.qrType; }
          if (!qr.qrUrl && prev.qrUrl) qr.qrUrl = prev.qrUrl;
          if (!track.code && prev.code) track.code = prev.code;
          if (!track.lieu && prev.lieu) track.lieu = prev.lieu;
          if (!track.artTitle && prev.artTitle) track.artTitle = prev.artTitle;
        }
      }
      await supabaseUpsert([{ id: rowId, data: {
        type: 'suivi', carrier, suivi: track.suivi || '', status: track.status,
        statusLabel: track.label, subject, receivedAt: now,
        code: track.code || null, artTitle: track.artTitle || null, lieu: track.lieu || null,
        qrB64: qr.qrB64, qrType: qr.qrType, qrUrl: qr.qrUrl || null,
        account: acc.login || '',
      } }]);
      // Notif push selon l'étape du colis.
      const icons = { delivered: '✅', available: '📍', transit: '🚚', info: '📦' };
      const titles = { delivered: 'Colis livré', available: 'Colis arrivé au point de retrait', transit: 'Colis en transit', info: 'Suivi colis' };
      try { await pushOnce({
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
      if (!data.numero) data.numero = await findNumeroByTitle(data.modele || data.article, data.taille);
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
      try { await pushOnce({ title: pdfTamponneB64 ? '📦 Bordereau prêt à imprimer' : '📦 Bordereau reçu', body: `${data.modele || 'Article'}${data.numero ? ` — N°${data.numero}` : ''}${pdfTamponneB64 ? ' : déjà tamponné' : ''} — à expédier${data.dateLimite ? ` avant le ${data.dateLimite}` : ''}.`, tag: `bord-${data.transaction}`, url: '/?tab=cat_bord' }); } catch (_) {}
      await logEmail({ type: 'bordereau', subject, from: mail.from, numero: data.numero, transaction: data.transaction, tamponne: !!pdfTamponneB64 });
      res.status(200).json({ ok: true, type: 'bordereau', transaction: data.transaction, numero: data.numero, pdf: !!pdf, tamponne: !!pdfTamponneB64 });
      return;
    }

    // 2) FINALISATION (argent reçu).
    // Formes réelles : « Transaction finalisée », « La transaction est
    // finalisée », corps « Viré sur ton compte Vinted : 41,00 € ».
    const finText = `${subject}\n${(mail.text || htmlToText(mail.html) || '').slice(0, 1500)}`;
    if (/transaction\s+(?:est\s+)?finalis/i.test(finText) || /vir[ée]\s+sur\s+ton\s+compte/i.test(finText) || /ajout[ée]s?\s+(?:à|dans)\s+ton\s+porte-monnaie/i.test(finText) || /disponibles?\s+(?:dans|sur)\s+ton\s+porte-monnaie/i.test(finText)) {
      const key = shortHash(subject + '|' + (mail.text || '').slice(0, 400));
      const article = ((finText.match(/la vente de\s+(.+?)\s+a été réalis/i) || [])[1] || '').trim();
      // Montant crédité : on tente plusieurs formulations, puis en dernier
      // recours le plus gros montant € de l'email (le crédit) — avant ce
      // correctif, beaucoup d'emails de finalisation ressortaient à 0 € et
      // faussaient le total « encaissé ».
      let montant = (finText.match(/vir[ée]\s+sur\s+ton\s+compte(?:\s+vinted)?\s*:?\s*(\d+[,.]\d{2})\s*€/i) || [])[1] || '';
      if (!montant) montant = (finText.match(/(\d+[,.]\d{2})\s*€\s*(?:ont|a)?\s*(?:[ée]t[ée]\s+)?(?:vir[ée]s?|ajout[ée]s?|cr[ée]dit[ée]s?|re[çc]us?)/i) || [])[1] || '';
      if (!montant) montant = (finText.match(/(?:re[çc]u|ajout[ée]s?|cr[ée]dit[ée]s?|porte-monnaie|solde|gagn[ée])[^€\d]{0,40}(\d+[,.]\d{2})\s*€/i) || [])[1] || '';
      if (!montant) { const all = [...finText.matchAll(/(\d+[,.]\d{2})\s*€/g)].map(x => parseFloat(x[1].replace(',', '.'))).filter(v => v > 0); if (all.length) montant = String(Math.max(...all).toFixed(2)).replace('.', ','); }
      const numero = (article.match(/\bn[°º]?\s*(\d{2,6})\b/i) || [])[1] || '';
      await supabaseUpsert([{ id: `email_final_${key}`, data: {
        type: 'finalisation', subject, article, montant, numero,
        account: acc.login || '', uid: acc.uid || '', receivedAt: now,
      } }]);
      // Notif push : l'argent arrive dans le porte-monnaie.
      try { await pushOnce({
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
      try { await pushOnce({
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
      try { await pushOnce({ title: '💸 Vendu !', body: `${data.designation || 'Article'}${data.prix ? ` — ${data.prix} €` : ''}${acc.login ? ` (${acc.login})` : ''}`, tag: `sale-${key}`, url: '/?tab=cat_ventes' }); } catch (_) {}
      // Facturation Pro : ne se déclenche que si activée dans l'app ET que
      // l'email contient l'adresse email de l'acheteur (comptes Pro).
      let facture = null;
      try {
        if (data.email) {
          const cfg = await supabaseGetRow('vrm_pro_facture');
          if (cfg && cfg.actif) {
            facture = await createProInvoice(data, acc, cfg, now);
            try { await pushOnce({
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
      // ── COPILOTE D'OFFRES : conseil chiffré instantané ─────────────────────
      // On retrouve le prix d'achat de la paire → on dit s'il faut accepter et
      // combien il reste net, ou refuser (offre sous le coût).
      const buy = await findBuyPriceByTitle(article);
      const offerAmt = parseFloat(String(montant).replace(',', '.'));
      let advice = '', net = null;
      if (buy != null && !isNaN(offerAmt)) {
        net = Math.round((offerAmt - buy) * 100) / 100;
        advice = net > 0 ? ` → ✅ Accepte : +${Math.round(net)} € net (achat ${Math.round(buy)} €)`
                          : ` → ⚠️ Refuse : sous ton coût (${Math.round(buy)} €)`;
      }
      try { await pushOnce({
        title: `💰 Offre ${montant ? montant + ' €' : ''}${qui ? ' de ' + qui : ''}`,
        body: `${article ? `« ${article.trim().slice(0, 40)} »` : 'Un acheteur t\'a fait une offre'}${acc.login ? ` (${acc.login})` : ''}${advice || ' — expire en 24h.'}`,
        tag: `offer-${key}`, url: '/?tab=cat_msg',
      }); } catch (_) {}
      // Archive l'offre + le conseil pour le panneau « Copilote d'offres » de l'app.
      try { await supabaseUpsert([{ id: `email_offer_${key}`, data: {
        type: 'offre', qui, article, montant, buy, net,
        account: acc.login || '', uid: acc.uid || '', receivedAt: now,
      } }]); } catch (_) {}
      await logEmail({ type: 'offre', subject, from: mail.from, montant, de: qui, article, net });
      res.status(200).json({ ok: true, type: 'offre', montant, de: qui, article, net });
      return;
    }

    // 5) NOUVEAU MESSAGE → notif immédiate avec le TEXTE du message.
    if (/nouveau message|message de|t['']a envoyé un message|vous avez re[çc]u un message/i.test(textAll)) {
      const qui = (textAll.match(/(?:message de|de la part de)\s+(\S+)/i) || textAll.match(/(\S+)\s+t['']a envoyé/i) || [])[1] || '';
      const extrait = extractAfter(/envoy[ée] un message|nouveau message|message de/i);
      const key = shortHash(subject + (mail.text || '').slice(0, 200));
      try { await pushOnce({
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
      try { await pushOnce({
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
