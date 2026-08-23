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

import { sendPushToAll, pushCategorieActive } from './_lib/push.js';
import { stampBordereau } from './_lib/stamp.js';

import { withOwnerAll, conflictTarget, contexteVendeur, proprietaireCourant, duVendeur as duVendeurLib } from './_lib/owner.js';
import { adressesDeLivraison, resoudreProprietaire } from './_lib/proprietaire-email.js';
import { normaliserEntrant, formeRecue } from './_lib/lire-email.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
// ⚠️ CLÉ DE SERVICE QUAND ELLE EXISTE. Ces routes tournent sur le serveur, sans
// vendeur connecté : à la seconde où la base est cloisonnée (RLS), la clé
// publique ne peut plus rien lire ni écrire et l'endpoint devient muet — c'est
// LE blocage qui empêchait d'activer le multi-vendeurs. On prend donc
// `SUPABASE_SERVICE_KEY` (variable d'environnement Vercel, jamais dans le
// dépôt) si elle est définie, et on retombe sur la clé publique tant qu'elle ne
// l'est pas : le comportement d'aujourd'hui reste identique.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';

// ── Utilitaires ─────────────────────────────────────────────────────────────

// ⚠️⚠️ LE CSS N'EST PAS DU TEXTE (22 août). `<style>` n'était pas retiré : sur
// TOUT email Mondial Relay / Vinted-relay, la feuille de style se retrouvait
// dans le « texte » de l'email — des milliers de caractères de `!important`,
// `mso-`, `@media`… avant la moindre phrase. Conséquences mesurées : le statut
// tombait en « en transit » par défaut, et le lieu / la date limite / le code
// n'étaient jamais trouvés. Pire, des chiffres de CSS peuvent se faire prendre
// pour un code de retrait.
// ⚠️ Certains services de réception fournissent DÉJÀ un `text` qui n'est que
//    cette feuille de style (mesuré sur « Votre colis est entre de bonnes
//    mains ») — d'où `texteUtile()` plus bas, qui choisit la meilleure source.
function htmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n').replace(/<\/tr>/gi, '\n').replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&euro;/g, '€')
    .replace(/&#8364;/g, '€').replace(/&#\d+;/g, ' ');
}

// Du CSS n'est pas un message. Un `text` qui porte les marqueurs d'une feuille
// de style (ou qui est plus pauvre que le HTML nettoyé) est écarté au profit du
// HTML. Sans ça, l'email « Votre colis est entre de bonnes mains » n'était que
// du CSS : ni statut, ni lieu, ni code.
const RESSEMBLE_A_DU_CSS = /!important|mso-[a-z-]+\s*:|@media\s+screen|-webkit-text-size-adjust|\{[^{}]*:[^{}]*;[^{}]*\}/i;
function texteUtile(mail) {
  const brut = String((mail && mail.text) || '');
  const duHtml = htmlToText((mail && mail.html) || '');
  const propre = brut && !RESSEMBLE_A_DU_CSS.test(brut) ? brut : '';
  if (propre) return propre;
  if (duHtml && !RESSEMBLE_A_DU_CSS.test(duHtml)) return duHtml;
  // Les deux sont pollués : on garde le plus long des deux nettoyés grossièrement.
  const netto = (x) => String(x).replace(/\{[^{}]*\}/g, ' ').replace(/[.#@][\w-]+\s*(?=\{)/g, ' ');
  const a = netto(brut), b = netto(duHtml);
  return (b.length > a.length ? b : a);
}

// Normalise le corps de requête (selon le service de réception) vers une forme
// unique : { from, to, subject, text, html, attachments:[{filename, contentType, contentB64}] }
function normalizeInbound(body) {
  // ⚠️ Une seule règle de lecture, dans `_lib/lire-email.js` (testée par
  // `scripts/audit-email-formes.cjs` sur 15 formes réelles). Elle sait aussi
  // ouvrir un email BRUT (MIME) et les formes emballées — ce que cette fonction
  // ne savait pas faire, d'où un email arrivé le 23 août avec expéditeur et
  // sujet vides, classé « ignoré », et perdu sans laisser de trace.
  return normaliserEntrant(body);
}

// ⚠️ LE PROPRIÉTAIRE EST PROPRE À CHAQUE REQUÊTE, PAS AU MODULE.
// Une fonction serverless garde son instance entre deux appels et peut en
// traiter plusieurs EN MÊME TEMPS : une simple variable de module serait écrasée
// par l'email suivant pendant que le premier finit d'écrire — et des lignes
// partiraient chez le mauvais vendeur, sans le moindre message d'erreur.
// `AsyncLocalStorage` donne un contexte isolé par requête : deux emails traités
// en parallèle ne peuvent pas se mélanger.
async function supabaseUpsert(rows) {
  const owner = proprietaireCourant();
  rows = owner
    ? rows.map(r => ({ owner, ...r }))
    // Sans vendeur résolu : le comportement d'avant (propriétaire de
    // l'installation s'il est réglé, rien sinon) — voir api/_lib/owner.js.
    : withOwnerAll(rows);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${conflictTarget('id')}`, {
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
    const res = await fetch(await duVendeur(`${SUPABASE_URL}/rest/v1/vinted_accounts?select=vinted_user_id,login`), { headers });
    const accts = res.ok ? await res.json() : [];
    // 1) Par EMAIL de compte (renseigné dans l'app : Comptes liés → champ 📧).
    //    Fiable même avec les adresses masquées iCloud : on cherche l'adresse
    //    destinataire dans le texte brut du mail (To inclus).
    try {
      const r2 = await fetch(await duVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=data->vinted_account_emails`), { headers });
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
  // ⚠️ On ne REMPLACE le texte par la version HTML que si elle apporte
  // vraiment plus. Avant, un email court en texte brut (moins de 100
  // caractères) était écrasé par un HTML vide → le message était pourtant
  // parfaitement lisible, mais l'analyse échouait et la vente était perdue.
  if (body.length < 100) { const alt = htmlToText(html); if (alt.length > body.length) body = alt; }
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
    const res = await fetch(await duVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${encodeURIComponent(id)}&select=data`), {
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
// ── CE QU'ON NOTIFIE, ET CE QU'ON NE NOTIFIE PAS ────────────────────────────
// Julien : « des fois je reçois des choses complètement débiles ». Il a raison :
// un push partait à CHAQUE étape de colis, transit compris — sur ses 94 emails
// de suivi, **54 sont "en transit" et 7 "info"**, soit 61 notifications qui
// n'appellent aucune action. Idem pour « achat confirmé » (il vient de
// l'acheter), les favoris et chaque message.
//
// RÈGLE : on ne sonne que pour de l'ARGENT ou une ACTION à faire. Le reste se
// consulte dans l'app, où le badge suffit.
// Envoie une notification UNE seule fois (clé = son tag, déjà unique), et
// seulement si cette catégorie est active.
async function pushOnce(payload, categorie) {
  try {
    // ⚠️ REJEU EN LOT : on rattrape des emails vieux de plusieurs jours. Sonner
    //    pour chacun, c'est des centaines de notifications d'un coup pour des
    //    choses déjà faites. Le drapeau vit dans le contexte de la requête
    //    (AsyncLocalStorage), donc il ne peut pas déborder sur un email qui
    //    arrive vraiment en même temps.
    if ((contexteVendeur.getStore() || {}).silence) return;
    const cat = categorie || (payload && payload._cat) || null;
    if (!(await pushCategorieActive(cat))) return;
    // `_cat` est un marqueur interne : il ne part pas dans la notification.
    const { _cat, ...notif } = payload || {};
    if (await shouldNotify(notif.tag)) await sendPushToAll(notif);
  } catch (_) {}
}

// ⚠️ ON NE JETTE PLUS AUCUN EMAIL.
// Le 23 août, un email est arrivé à 06:36 avec expéditeur et sujet vides : il a
// été classé « ignoré » et **rien n'a été gardé** — impossible de savoir ce que
// c'était, alors que Julien attendait des codes de retrait Chronopost.
// Désormais tout email qu'on n'a pas su classer est CONSERVÉ tel qu'il est
// arrivé, avec la forme reçue et la raison. Il est visible dans l'app et peut
// être rejoué comme un email de quarantaine.
// ⚠️ Borné à 200 Ko : ces lignes ne sont lues que sur demande, jamais au
// chargement d'un écran (leçon d'égress §34).
// ⚠️ « NON COMPRIS » DOIT VOULOIR DIRE QUELQUE CHOSE.
// Mesuré le 23 août sur les 28 emails conservés : 11 sont des emails que Julien
// a lui-même ENVOYÉS à Vinted (contestations), 8 des « Commande mise à jour »,
// 5 des évaluations, 3 des « untel a mis en ligne un nouvel article », 1 une
// newsletter. Aucun n'appelle la moindre action — mais le compteur affichait
// « 28 emails non compris », donc il criait au loup et on cesserait vite de le
// regarder (le défaut du panneau Garage, §5.14).
// ➡️ On les RECONNAÎT et on les range à part. Rien n'est jeté (règle §5.44) :
//    ils restent conservés, juste étiquetés « connu, sans action » — et allégés,
//    parce qu'une newsletter n'a pas à peser 200 Ko en base (§34).
// ⚠️ « Commande mise à jour » est volontairement SANS ACTION : les statuts de
//    commande viennent de la moisson Vinted, jamais des emails (§33 — c'était la
//    source des faux achats). On l'étiquette pour ne pas le redécouvrir.
function familleConnue(subject, from) {
  const s = String(subject || '');
  const f = String(from || '');
  if (/laiss[ée] une [ée]valuation|^Laisse une [ée]valuation/i.test(s)) return 'évaluation';
  if (/Commande mise [àa] jour/i.test(s)) return 'commande mise à jour (le statut vient de la moisson)';
  if (/a mis en ligne un nouvel article/i.test(s)) return "nouvel article d'un membre suivi";
  if (/Demande de motivation|Contestation formelle|DEMANDE URGENTE|r[ée]examen humain/i.test(s)) return 'ton propre email envoyé à Vinted';
  if (/@team\.vinted|newsletter/i.test(f) || /rentr[ée]e|d[ée]couvre|inspire|nouveaut[ée]s/i.test(s)) return 'newsletter Vinted';
  if (/bienvenue|confirme ton adresse|mot de passe/i.test(s)) return 'email de compte Vinted';
  return '';
}

async function garderInconnu(corpsBrut, mail, raison, famille) {
  try {
    let brut = '';
    try { brut = typeof corpsBrut === 'string' ? corpsBrut : JSON.stringify(corpsBrut); } catch (_) { brut = String(corpsBrut); }
    // Une famille reconnue n'a pas besoin d'être conservée en entier : on garde
    // de quoi l'identifier, pas de quoi peser (§34).
    const plafond = famille ? 2000 : 200000;
    if (brut && brut.length > plafond) brut = brut.slice(0, plafond);
    const cle = shortHash((mail && mail.subject ? mail.subject : '') + String(brut).slice(0, 400) + Date.now());
    await supabaseUpsert([{ id: `email_inconnu_${cle}`, data: {
      type: famille ? 'connu-sans-action' : 'inconnu', famille: famille || '', raison,
      forme: formeRecue(corpsBrut),
      subject: (mail && mail.subject) || '', from: (mail && mail.from) || '', to: (mail && mail.to) || '',
      receivedAt: new Date().toISOString(),
      brut,
    } }]);
  } catch (_) {}
}

async function logEmail(entry) {
  try {
    const cur = (await supabaseGetRow('email_journal')) || { entries: [] };
    // 200 et non 30 : le 23 août, une rafale d'emails « offre » avait chassé du
    // journal la seule ligne qui expliquait un colis manquant.
    const entries = [{ ...entry, at: new Date().toISOString() }, ...(cur.entries || [])].slice(0, 200);
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
    const res = await fetch(await duVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=data->vinted_annonce_numeros`), {
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
    const res = await fetch(await duVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=data->vinted_annonce_numeros`), {
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
  const txt = texteUtile(mail);
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

  // ── ÉTAPE DU COLIS ────────────────────────────────────────────────────────
  // ⚠️ LE SUJET TRANCHE AVANT LE CORPS. Mesuré en base : 5 emails Mondial Relay
  // « Votre colis 60385202 est DISPONIBLE » étaient classés `delivered` — donc
  // 5 colis réellement à retirer avaient disparu de la liste, et au bout de 14 j
  // ils repartent chez l'expéditeur. Cause : le classement lisait TOUT le texte,
  // or le corps d'un email « disponible » contient les consignes de retrait
  // (« venez récupérer votre colis », « à retirer avec ce code »…) qui font
  // matcher les motifs de « déjà retiré ».
  // Le SUJET, lui, dit l'état COURANT — c'est pour ça que le transporteur l'écrit.
  const t = all.toLowerCase();
  const suj = String(mail.subject || '').toLowerCase();
  let status = 'info', label = 'Mise à jour';
  const SUJ_RETIRE = /a\s+[ée]t[ée]\s+(?:retir[ée]|livr[ée]|remis)|colis\s+retir[ée]|livraison\s+de\s+votre\s+colis|bien\s+re[çc]u/;
  const SUJ_DISPO  = /disponible|à\s+retirer|a\s+retirer|arriv[ée]\s+(?:en|au|dans)|vous\s+attend|pr[êe]t/;
  if (suj && SUJ_RETIRE.test(suj))      { status = 'delivered'; label = 'Livré / retiré'; }
  else if (suj && SUJ_DISPO.test(suj))  { status = 'available'; label = 'Arrivé au point de retrait'; }
  else
  // Priorité STRICTE : livré/retiré > disponible > en transit. Les trois sont
  // mutuellement exclusifs — sinon un email « colis retiré » qui contient aussi
  // l'historique du trajet (« déposé », « pris en charge », « acheminement »)
  // était rétrogradé à « en transit » et le colis restait à retirer pour
  // toujours (bug réel : confirmations de retrait Chronopost bloquées en transit).
  if (/livr[ée]|bien\s+re[çc]u|remis\s+(?:au\s+destinataire|en\s+mains?)|vous\s+a\s+[ée]t[ée]\s+(?:remis|livr[ée])|(?:colis\s+)?a\s+(?:bien\s+)?[ée]t[ée]\s+retir[ée]|bien\s+retir[ée]|retir[ée]\s+(?:le|avec|par)|colis\s+retir[ée]|(?:vous\s+)?avez\s+(?:bien\s+)?retir[ée]|merci\s+d[e']?\s*avoir\s+(?:bien\s+)?(?:retir[ée]|r[ée]cup[ée]r[ée])|(?:vous\s+)?avez\s+(?:bien\s+)?r[ée]cup[ée]r[ée]|bien\s+r[ée]cup[ée]r[ée]|r[ée]cup[ée]r[ée]\s+(?:le|votre|avec)|r[ée]ceptionn[ée]|livraison\s+(?:effectu[ée]e|r[ée]ussie)/.test(t)) { status = 'delivered'; label = 'Livré / retiré'; }
  else if (/disponible|à retirer|arriv[ée] (?:dans|en|au) point|pr[êe]t.*retrait/.test(t)) { status = 'available'; label = 'Arrivé au point de retrait'; }
  else if (/acheminement|en transit|exp[ée]di[ée]|pris en charge|d[ée]pos[ée]|enregistr[ée]|en cours de livraison/.test(t)) { status = 'transit'; label = 'En transit'; }
  // Anti-faux-colis : un vrai « colis disponible » a TOUJOURS un n° de suivi.
  // Sans suivi (emails pub « ton compte évolue », newsletters…), on ne compte
  // PAS comme un colis à retirer.
  if (status === 'available' && !suivi) { status = 'info'; label = 'Info'; }

  // Code de retrait (PIN) : « code de retrait : 123456 », « PIN : 1234 »...
  // ⚠️ UN CODE DE RETRAIT EST NUMÉRIQUE. L'ancien motif acceptait des LETTRES
  //    (`[A-Z0-9]{4,8}`) : sur un vrai email Chronopost il a capté le mot
  //    « suivant » et l'a affiché en gros comme code à donner au comptoir
  //    (vérifié en base, ligne `email_track_chronopost_XW476115185SP`).
  //    Aucun transporteur observé n'utilise de lettres. On n'accepte que des chiffres.
  let code = (all.match(/(?:code\s+(?:de\s+)?(?:retrait|r[ée]ception|livraison)|pin)[\s*_\-–—]*[:：]?[\s*_\-–—]*(\d{4,10})\b/i) || [])[1] || null;
  if (!code) {
    const m = all.match(/\bcode\s*[:\-]\s*(\d{4,10})\b/i);
    // garde-fou : ne pas confondre avec un code postal
    if (m && !/postal/i.test(all.slice(Math.max(0, m.index - 14), m.index + 4))) code = m[1];
  }
  // ── Consigne Pickup / casier automatique (Chronopost Pickup) : le retrait se
  //    fait avec DEUX codes — un « Identifiant » ET un « Code d'ouverture » — (et
  //    parfois un QR « Pickup Pass »). Format RÉEL vu sur les emails de Julien
  //    (août 2026). L'ancien parseur ne reconnaissait ni « code d'ouverture » ni
  //    « identifiant » → aucun code affiché : c'est LE bug Chronopost signalé. ──
  let code2 = null; // second code (identifiant du casier), en plus du code d'ouverture
  {
    // ⚠️ La version TEXTE de l'email met les valeurs en gras à la façon markdown :
    //      « Identifiant : *8156* » · « Code d’ouverture : *9539* »
    //    Sans tolérer ces astérisques (et l'apostrophe typographique), les deux
    //    nombres n'étaient PAS captés — mesuré sur l'email du 17 août, alors même
    //    que la date limite et le lieu, eux, passaient. Au casier, sans ces deux
    //    nombres la porte ne s'ouvre pas.
    const DECOR = "[\\s*_\\-–—]*";
    const mOuv = all.match(new RegExp(`code${DECOR}d['e’]?${DECOR}ouverture${DECOR}[:：]?${DECOR}(\\d{3,8})`, 'i'));
    const mId = all.match(new RegExp(`identifiant${DECOR}[:：]?${DECOR}(\\d{3,8})`, 'i'));
    if (mOuv) code = mOuv[1];   // le code d'ouverture devient le code principal
    if (mId) code2 = mId[1];    // l'identifiant l'accompagne (les DEUX servent au casier)
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
  // Consigne Pickup (casier automatique) : « Consigne Pickup <enseigne> » + adresse
  // « RUE … 35260 CANCALE ». Format réel des emails de casier (août 2026).
  if (!lieu) {
    // ⚠️ On travaille LIGNE PAR LIGNE sur le texte, pas sur `all` (qui contient le
    //    sujet et tout le HTML). Sans ça, « Votre colis est arrivé en consigne
    //    Pickup » du sujet gagnait, et le lieu devenait une phrase — défaut trouvé
    //    au banc, pas à la relecture. Le vrai nom est une ligne COURTE (une
    //    enseigne), suivie de l'adresse sur les lignes d'après.
    const MOTS_DE_PHRASE = /\b(votre|ton|le|la|les|est|sont|arriv|pr[ée]sent|devant|lecteur|colis|retirer|r[ée]cup)/i;
    const lignes = txt.split('\n').map(l => l.trim());
    for (let i = 0; i < lignes.length; i++) {
      const mL = lignes[i].match(/^consigne\s+pickup\s+(.{2,40})$/i);
      if (!mL || MOTS_DE_PHRASE.test(mL[1])) continue;
      const nom = ('Consigne Pickup ' + mL[1]).replace(/\s{2,}/g, ' ').replace(/[.,;\s]+$/, '').trim();
      const suite = [];
      for (let j = i + 1; j < lignes.length && suite.length < 2; j++) {
        const l = lignes[j];
        if (!l) { if (suite.length) break; else continue; }
        if (!/\d{5}|rue|avenue|av\.|boulevard|bd|impasse|chemin|place|route|all[ée]e|zone|centre/i.test(l)) break;
        suite.push(l.replace(/\s+/g, ' '));
      }
      lieu = suite.length ? `${nom}, ${suite.join(', ')}` : nom;
      break;
    }
  }

  // ── DATE LIMITE DE RETRAIT ────────────────────────────────────────────────
  // « À retirer jusqu'au vendredi 21 août 2026 », « Récupérez votre colis
  // jusqu'au 21 août 2026 inclus », « jusqu'au 21/08/2026 ». C'est LA donnée qui
  // manquait : passé cette date le colis repart chez l'expéditeur, et rien dans
  // l'app ne le disait. On ne la déduit jamais — si l'email ne la donne pas, on
  // ne met rien (une fausse échéance ferait courir pour rien, ou rater le colis).
  let limite = null;
  {
    const MOIS = { janvier:1, février:2, fevrier:2, mars:3, avril:4, mai:5, juin:6, juillet:7,
                   août:8, aout:8, septembre:9, octobre:10, novembre:11, décembre:12, decembre:12 };
    const mTxt = all.match(/jusqu['’]au\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})\s+([a-zà-ÿ]+)\s+(\d{4})/i);
    const mNum = all.match(/jusqu['’]au\s+(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/i);
    if (mTxt) {
      const mo = MOIS[mTxt[2].toLowerCase()];
      if (mo) limite = `${mTxt[3]}-${String(mo).padStart(2,'0')}-${String(+mTxt[1]).padStart(2,'0')}`;
    } else if (mNum) {
      limite = `${mNum[3]}-${String(+mNum[2]).padStart(2,'0')}-${String(+mNum[1]).padStart(2,'0')}`;
    }
  }
  // Consigne automatique (casier Pickup) ou point relais avec comptoir ? Le geste
  // n'est pas le même : au casier on saisit identifiant + code d'ouverture (ou on
  // scanne), au comptoir on présente un code et une pièce d'identité.
  const consigne = /consigne\s+pickup|casier|locker/i.test(all);

  return { suivi, status, label, code, code2, artTitle, lieu, limite, consigne };
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
// ⚠️ UNE IMAGE D'EMAIL N'EST PAS UN QR — mesuré sur les 26 emails Chronopost
// réels : 21 portaient une `qrUrl`, dont **9 pixels de tracking**
// (`tracking.network1.pickup.fr/tracking/1/open/…`) et le reste des bannières
// marketing (`FRA_DROPOFF_PICKUP_PARCEL`, `banner-mail-enquete-satisfaction`).
// CAUSE : l'étape 3 mettait l'URL ELLE-MÊME dans le contexte de mots-clés — or
// « pickup » est dans toutes les URL Pickup, y compris celle du mouchard. Résultat :
// devant la consigne, l'app affichait une image invisible à la place du Pickup Pass.
// Deux verrous désormais : une liste noire d'URL, et un mot-clé FORT exigé dans le
// HTML autour de l'image (jamais dans l'URL).
const URL_PAS_UN_QR = /\/tracking\/|\/open\/|\/o\/|pixel|spacer|1x1|banner|banniere|banni[eè]re|logo|header|footer|enquete|enqu[eê]te|satisfaction|unsubscribe|desabonn|d[eé]sabonn|facebook|instagram|twitter|linkedin|youtube|email-messaging\.com|avn-prod|azureedge|drop[_-]?off|dropoff|_parcel|illustration|visuel|\.svg(\?|$)/i;
// Mot-clé FORT = celui qui ne peut pas apparaître par hasard dans une URL de suivi.
const INDICE_QR_FORT = /qr\b|qr[- ]?code|pickup\s*pass|à\s*scanner|a\s*scanner|scannez|scanne\s|code[- ]?barre|barcode|pr[ée]sente[rz]?\s+ce\s+(?:code|pass)/i;
// ⚠️⚠️ LE VRAI PICKUP PASS N'A NI ALT NI MOT-CLÉ AUTOUR (22 août).
// Relevé sur les emails réels de Julien, le code scannable est servi par un
// générateur, dans une balise nue :
//   <img width="218" src="…pickup-services.com/api/barcode/DataMatrix?d=FR1971A;09843408317167|81569539" alt="">
//   <img …/api/barcode/AztecCode?d=PICKUPPASS:2.00:FR93638;09447431562792;;">
// Le HTML autour n'est que du `<table>` : la règle de §5.37 (« le mot-clé doit
// venir du HTML, jamais de l'URL ») rejetait donc LE code, pendant que le
// mouchard passait. Cette règle reste juste pour « pickup » — mais un chemin qui
// dit `/api/barcode/DataMatrix` n'est pas un indice marketing, c'est la NATURE
// de la ressource. On l'accepte donc sans rien exiger d'autre.
// ⚠️ Un colis non retiré repart chez l'expéditeur : ne jamais durcir ça sans
//    avoir sous les yeux un email réel qui prouve un faux positif.
const URL_QR_CERTAIN = /\/(?:api\/)?barcode\/(?:datamatrix|azteccode|aztec|qrcode|qr|pdf417|code128|code39|ean13)\b/i;
const imgMinuscule = (balise) => {
  const w = (balise.match(/\bwidth\s*=\s*["']?(\d+)/i) || [])[1];
  const h = (balise.match(/\bheight\s*=\s*["']?(\d+)/i) || [])[1];
  return (w != null && +w <= 4) || (h != null && +h <= 4);   // mouchard 1×1
};
function qrUrlPlausible(url, balise, ctx) {
  if (!url) return false;
  if (URL_QR_CERTAIN.test(url)) return true;                 // générateur de code-barre : c'est LE pass
  if (URL_PAS_UN_QR.test(url)) return false;                 // mouchard / bannière
  if (balise && imgMinuscule(balise)) return false;          // 1×1 invisible
  return INDICE_QR_FORT.test(ctx || '');                     // sinon le HTML doit le dire
}

function extractPickupQr(mail, status) {
  const imgs = (mail.attachments || []).filter(a => /image\//i.test(a.contentType || '') && a.contentB64);
  const html = mail.html || '';
  const hint = /qr|à scanner|a scanner|scanne|code[- ]?barre|pr[ée]sente (?:ce|le) code|pickup|retrait/i
    .test(`${mail.subject || ''}\n${mail.text || ''}\n${html}`);
  const none = { qrB64: null, qrType: null, qrUrl: null };

  // 0) LE GÉNÉRATEUR DE CODE-BARRE — la seule source certaine, donc la première.
  if (html) {
    const re0 = /<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
    let m0;
    while ((m0 = re0.exec(html)) !== null) {
      if (URL_QR_CERTAIN.test(m0[1])) return { qrB64: null, qrType: null, qrUrl: m0[1] };
    }
  }

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
      // ⚠️ Le contexte est le HTML AUTOUR de l'image, JAMAIS l'URL : c'est
      //    exactement ce qui faisait passer un pixel de tracking pour un QR.
      const ctx = html.slice(Math.max(0, m.index - 260), m.index + 260);
      if (qrUrlPlausible(m[1], m[0], ctx)) {
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

// ── LIRE LES DONNÉES DU BON VENDEUR, ET DE LUI SEUL ──────────────────────────
// ⚠️ La clé de service CONTOURNE RLS. Donc, une fois la base cloisonnée, un
// `?id=eq.main` renverrait la ligne `main` de TOUS les vendeurs, et
// `rows[0]` serait celle du premier venu : en traitant l'email de Marie, on
// lirait les comptes Vinted et les numéros de Julien. Silencieux, et faux.
// Chaque lecture est donc filtrée sur le vendeur résolu pour CETTE requête.
// Tant que la colonne `owner` n'existe pas, on n'ajoute rien (un filtre sur une
// colonne inconnue ferait échouer la lecture avec un 400).
let _cloisonnee = null;
async function baseCloisonnee() {
  if (_cloisonnee !== null) return _cloisonnee;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?select=owner&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    _cloisonnee = r.ok;
  } catch (_) { _cloisonnee = false; }
  return _cloisonnee;
}
const duVendeur = (url) => duVendeurLib(url, baseCloisonnee);

// Registre « adresse de réception → vendeur », écrit par l'app (Réglages →
// Emails). Ligne dédiée : l'app en est propriétaire, le serveur ne fait que lire.
async function lireRegistreEmails() {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vrm_email_owners&select=data`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return {};
    const j = await r.json();
    const d = (j[0] && j[0].data) || {};
    return (d && typeof d === 'object') ? (d.adresses || d) : {};
  } catch (_) { return {}; }
}

// Email non attribuable : on le garde ENTIER, avec la raison et les adresses
// lues, sous le propriétaire de l'installation (sinon, une fois la base
// cloisonnée, personne ne pourrait le relire pour le rattacher).
async function mettreEnQuarantaine(mail, adresses, raison) {
  try {
    const id = 'email_quarantaine_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const ligne = {
      id,
      data: {
        raison, adresses, at: new Date().toISOString(),
        from: mail.from || '', to: mail.to || '', subject: mail.subject || '',
        text: String(mail.text || '').slice(0, 20000),
        html: String(mail.html || '').slice(0, 40000),
        pieces: (mail.attachments || []).map(a => ({ filename: a.filename, contentType: a.contentType })),
      },
    };
    await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${conflictTarget('id')}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(withOwnerAll([ligne])),
    });
  } catch (_) {}
}

// Le handler exporté n'est qu'une enveloppe : il ouvre un contexte isolé pour
// CETTE requête, puis délègue. Tout ce qui écrit à l'intérieur (y compris les
// écritures déclenchées plus tard dans la même chaîne d'await) lit le bon
// vendeur, même si un autre email est traité en parallèle.
// ── QUEL TRANSPORTEUR ? (fonction PURE, testée par scripts/audit-transporteurs.cjs)
// Sortie : la clé du transporteur, ou null si ce n'est pas un email de colis.
// ⚠️ Aucune devinette métier ici : on ne fait que reconnaître l'expéditeur et
// des mots de colis. Un email de vente / offre / message n'en est jamais un.
export function detecterTransporteur(mail) {
  const subject = (mail && mail.subject) || '';
  // ⚠️ La fonction est PURE : elle relit le texte utile elle-même. Une première
  // version lisait `corpsTexte`, une variable du handler — `node --check` et le
  // build passaient, et c'est `scripts/audit-transporteurs.cjs` qui l'a attrapé.
  const corpsTexte = texteUtile(mail);
  const isBordereauSubject = /Bordereau\s+d['’]envoi/i.test(subject);
  const fromVinted = /vinted/i.test(mail.from);
  const isVintedShipping = /shipping@|relay\.vinted/i.test(mail.from);
  const carrierSrc = ((fromVinted && !isVintedShipping)
    ? mail.from
    : `${mail.from} ${subject} ${corpsTexte.slice(0, 1200)}`).toLowerCase();
  // Détection élargie : TOUS les transporteurs courants (pas seulement Mondial
  // Relay / Chronopost). L'ordre n'a pas d'importance, chaque test est distinct.
  let carrier =
    // ⚠️ Vinted Go AVANT le reste : son nom contient « vinted », donc sans ce
    // test il retombait sur le filet `isVintedShipping` (ou sur rien du tout
    // quand l'expéditeur est `@vintedgo.com`). Julien : « aucune erreur du
    // côté Chronopost, Mondial Relay, Vinted GO ».
    /vinted\s*go|vintedgo/.test(carrierSrc) ? 'vinted'
    : /mondial\s*relay|mondialrelay/.test(carrierSrc) ? 'mondialrelay'
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
    const t = `${subject}\n${corpsTexte.slice(0, 1200)}`.toLowerCase();
    if (/point\s+relais|à\s*retirer|a\s*retirer|code\s+de\s+retrait|pr[êe]t.*retrait|colis.*(retrait|disponible|arriv|livr)|pickup/.test(t)) {
    carrier = 'autre';
    }
  }
  // ⚠️ Un email de COLIS envoyé par Vinted lui-même (pas via `shipping@`) était
  // écarté par le `!fromVinted` ci-dessus : un colis annoncé « arrivé au point
  // relais » par Vinted n'apparaissait alors nulle part. On le récupère, mais
  // UNIQUEMENT sur un signal fort DANS LE SUJET et jamais sur un email de
  // vente / offre / message (le sujet le dit toujours) — on ne devine pas.
  if (!carrier && fromVinted) {
    const sj = subject.toLowerCase();
    const colis = /colis|point\s+relais|à\s*retirer|a\s*retirer|code\s+de\s+retrait|consigne|casier|pickup/.test(sj);
    const pasColis = /vendu|offre|message|facture|paiement|transfert|favori|évaluation|evaluation|bordereau/.test(sj);
    if (colis && !pasColis) carrier = 'autre';
  }
  if (isBordereauSubject) return null; // un bordereau n'est pas un suivi
  return carrier;
}

export default async function handler(req, res) {
  return contexteVendeur.run({ owner: '' }, () => traiterEmail(req, res));
}

// `traiterEmail` est aussi appelée par `api/email-rattacher.js` pour REJOUER un
// email mis en quarantaine, une fois que le vendeur a prouvé son identité.
// ⚠️ `req.__ownerForce` est posé côté serveur uniquement : Vercel construit
// l'objet `req` lui-même, une requête HTTP ne peut pas y ajouter de propriété.
export async function traiterEmail(req, res) {
  // ⚠️ Appelée directement (rejeu depuis `email-rattacher`), il n'y a pas encore
  // de contexte : sans ça le propriétaire imposé se perdait en silence et les
  // lignes rejouées repartaient sans vendeur. On en ouvre un.
  if (!contexteVendeur.getStore()) return contexteVendeur.run({ owner: '' }, () => traiterEmail(req, res));
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  // Garde-fou : clé secrète partagée avec le service de réception.
  const secret = process.env.EMAIL_INBOUND_SECRET;
  if (secret) {
    const key = (req.query && req.query.key) || '';
    if (key !== secret) { res.status(401).json({ error: 'clé invalide' }); return; }
  }

  let mail, corpsBrut;
  try {
    corpsBrut = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    mail = normalizeInbound(corpsBrut);
  }
  catch (_) {
    // Même un corps illisible est conservé : c'est la seule façon de savoir
    // ensuite ce qui n'est pas passé.
    await garderInconnu(req.body, null, 'corps illisible');
    res.status(200).json({ ok: false, error: 'corps illisible' }); return;
  }

  // ── À QUEL VENDEUR CET EMAIL APPARTIENT-IL ? ──────────────────────────────
  // Décidé par l'ADRESSE DE RÉCEPTION, que le vendeur a enregistrée lui-même
  // dans l'app. Jamais par l'expéditeur ni par le contenu : ils sont écrits par
  // l'extérieur (voir api/_lib/proprietaire-email.js).
  const registre = await lireRegistreEmails();
  const adresses = adressesDeLivraison(corpsBrut, mail);
  const proprio = req.__ownerForce
    ? { owner: String(req.__ownerForce), via: 'rattachement' }
    : resoudreProprietaire(adresses, registre, process.env.VRM_OWNER_UID || '');
  { const st = contexteVendeur.getStore(); if (st) st.owner = proprio.owner || ''; }
  // ⚠️⚠️ INCIDENT DU 16 AU 22 AOÛT — À NE JAMAIS REFAIRE.
  // La quarantaine (§5.16) a été posée AVANT que la base sache séparer les
  // vendeurs. `VRM_OWNER_UID` n'étant pas réglé en production, chaque email
  // tombait à l'étape 4 de `resoudreProprietaire` → quarantaine. Résultat :
  // **593 emails mis de côté en six jours**, zéro traité — dont « Votre colis
  // Chronopost est arrivé en consigne Pickup ». Julien n'avait plus ses codes
  // de retrait, et un colis non retiré repart chez l'expéditeur.
  //
  // LA RÈGLE : la quarantaine n'a de sens QUE si la base peut séparer les
  // vendeurs. Tant que la colonne `owner` n'existe pas, il n'y a qu'une seule
  // boutique et une seule ligne `main` : rien à protéger, donc rien à mettre de
  // côté. On traite l'email exactement comme avant §5.16.
  if (!proprio.owner && await baseCloisonnee()) {
    // ON NE DEVINE PAS, ET ON NE JETTE PAS. L'email est conservé entier avec sa
    // raison ; l'app le signale et permet de le rattacher. Un email égaré se
    // répare, un email livré au mauvais vendeur non.
    await mettreEnQuarantaine(mail, adresses, proprio.raison || 'non attribué');
    res.status(200).json({ ok: true, quarantaine: true, raison: proprio.raison, adresses });
    return;
  }

  const subject = mail.subject || '';
  // ⚠️ LE TEXTE D'UN EMAIL SE LIT D'UNE SEULE FAÇON (§11).
  // `texteUtile` (posé le 23 août pour les colis) écarte un `text` qui n'est
  // qu'une feuille de style — certains services de réception en livrent une à la
  // place du message. Les branches vente / offre / message / favori lisaient
  // encore `mail.text` brut : sur ces emails-là, elles ne trouvaient ni montant,
  // ni acheteur, ni article. Mesuré sur les 184 offres archivées : le pseudo de
  // l'acheteur est vide sur TOUTES, et le montant sur une bonne partie.
  const corpsTexte = texteUtile(mail);
  const rawForDetect = `${mail.from}\n${mail.to}\n${subject}\n${corpsTexte}`;
  const acc = await detectAccount(rawForDetect);
  // Date de RÉCEPTION de l'email : celle d'origine si on rejoue un email conservé
  // (voir api/email-rattacher.js), sinon maintenant.
  const now = (req && req.__recuLe) ? String(req.__recuLe) : new Date().toISOString();

  try {
    // 0) SUIVI DE COLIS.
    // Trois provenances : les transporteurs eux-mêmes (Mondial Relay /
    // Chronopost), leurs emails relayés par une adresse masquée iCloud
    // (expéditeur réécrit → on regarde aussi le sujet), et les emails
    // d'expédition de Vinted (shipping@relay.vinted.com). Jamais pour un
    // bordereau (traité au point 1, prioritaire).
    const carrier = detecterTransporteur(mail);
    if (carrier) {
      const track = parseCarrierEmail(mail, carrier);
      // QR / code-barres de retrait : cherché dans les pièces jointes ET dans le
      // HTML embarqué (là où Vinted / Mondial Relay le mettent le plus souvent).
      const qr = extractPickupQr(mail, track.status);
      const rowId = `email_track_${carrier}_${track.suivi || shortHash(subject)}`;
      // Le même colis passe par plusieurs emails (transit → à retirer → livré).
      // Le QR/code/lieu n'arrivent qu'à l'étape « à retirer » : on les GARDE si un
      // email plus tardif (sans ces infos) réécrit la même ligne.
      if (!qr.qrB64 || !qr.qrUrl || !track.code || !track.code2 || !track.lieu || !track.artTitle || !track.limite) {
        const prev = await supabaseGetRow(rowId);
        if (prev) {
          if (!qr.qrB64 && prev.qrB64) { qr.qrB64 = prev.qrB64; qr.qrType = prev.qrType; }
          if (!qr.qrUrl && prev.qrUrl) qr.qrUrl = prev.qrUrl;
          if (!track.code && prev.code) track.code = prev.code;
          if (!track.code2 && prev.code2) track.code2 = prev.code2;
          if (!track.lieu && prev.lieu) track.lieu = prev.lieu;
          if (!track.limite && prev.limite) track.limite = prev.limite;
          if (!track.consigne && prev.consigne) track.consigne = true;
          if (!track.artTitle && prev.artTitle) track.artTitle = prev.artTitle;
        }
      }
      await supabaseUpsert([{ id: rowId, data: {
        type: 'suivi', carrier, suivi: track.suivi || '', status: track.status,
        statusLabel: track.label, subject, receivedAt: now,
        code: track.code || null, code2: track.code2 || null, artTitle: track.artTitle || null, lieu: track.lieu || null,
        limite: track.limite || null, consigne: !!track.consigne,
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
      }, track.status === 'available' ? 'colis' : 'suivi'); } catch (_) {}
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
          const rf = await fetch(await duVendeur(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=data->vinted_bordereau_formats`), {
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
      try { await pushOnce({ title: pdfTamponneB64 ? '📦 Bordereau prêt à imprimer' : '📦 Bordereau reçu', body: `${data.modele || 'Article'}${data.numero ? ` — N°${data.numero}` : ''}${pdfTamponneB64 ? ' : déjà tamponné' : ''} — à expédier${data.dateLimite ? ` avant le ${data.dateLimite}` : ''}.`, tag: `bord-${data.transaction}`, url: '/?tab=cat_bord' }, 'expedier'); } catch (_) {}
      await logEmail({ type: 'bordereau', subject, from: mail.from, numero: data.numero, transaction: data.transaction, tamponne: !!pdfTamponneB64 });
      res.status(200).json({ ok: true, type: 'bordereau', transaction: data.transaction, numero: data.numero, pdf: !!pdf, tamponne: !!pdfTamponneB64 });
      return;
    }

    // 2) FINALISATION (argent reçu).
    // Formes réelles : « Transaction finalisée », « La transaction est
    // finalisée », corps « Viré sur ton compte Vinted : 41,00 € ».
    const finText = `${subject}\n${corpsTexte.slice(0, 1500)}`;
    if (/transaction\s+(?:est\s+)?finalis/i.test(finText) || /vir[ée]\s+sur\s+ton\s+compte/i.test(finText) || /ajout[ée]s?\s+(?:à|dans)\s+ton\s+porte-monnaie/i.test(finText) || /disponibles?\s+(?:dans|sur)\s+ton\s+porte-monnaie/i.test(finText)) {
      const key = shortHash(subject + '|' + corpsTexte.slice(0, 400));
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
        _cat: 'argent',
      }); } catch (_) {}
      await logEmail({ type: 'finalisation', subject, from: mail.from, montant, article, account: acc.login || '' });
      res.status(200).json({ ok: true, type: 'finalisation', montant, article });
      return;
    }

    // 2b) ACHAT (confirmation de TA commande) — AVANT la branche vente :
    // « tu as acheté » matcherait sinon le détecteur de ventes (« X a
    // acheté ton article »). On archive l'email comme justificatif d'achat
    // (texte + PDF joint éventuel) pour le registre d'achats.
    const achText = `${subject}\n${corpsTexte.slice(0, 2000)}`;
    // ⚠️ GARDE-FOU vente↔achat (bug signalé par Julien : une VENTE tombait en
    // achat). Les emails côté VENDEUR contiennent aussi « ta commande »
    // (« Prépare ta commande », « ta commande est à expédier ») → l'ancien motif
    // « ta commande » nu attrapait des ventes. On EXCLUT donc explicitement tout
    // signal vendeur avant de classer en achat, et on ne garde plus que des
    // formulations d'ACHETEUR sans ambiguïté (« tu as acheté », « reçu pour ta
    // commande »…). Le « ta commande » nu et le « récapitulatif de commande »
    // (envoyés aussi au vendeur) sont retirés.
    const cotéVendeur = /vendu|a\s+achet[ée]\s+ton\s+article|pr[ée]pare\s+ta\s+commande|[àa]\s+exp[ée]dier|bordereau\s+d['’]envoi|ton\s+article/i.test(achText);
    if (!cotéVendeur && /(?:tu as|vous avez)\s+achet|merci pour (?:ton|votre) achat|confirmation d['']achat|(?:ton|votre)?\s*re[çc]u pour (?:la |ta |votre )?commande/i.test(achText)) {
      const prix = (achText.match(/(\d+[,.]\d{2})\s*€/) || [])[1] || '';
      // ⚠️ LE TITRE DE L'ARTICLE N'EST PAS UN MORCEAU DE PHRASE.
      // L'ancienne 2e alternative rendait les deux-points FACULTATIFS
      // (`article\s*:?\s*`), donc n'importe quelle phrase contenant le mot
      // « article » était capturée : mesuré sur les 48 reçus réels en base,
      // « est conforme à sa » revient **16 fois** comme titre d'article
      // (extrait de « l'article est conforme à sa description »), et 22 reçus
      // sur 48 ont un titre « contenu » dans celui d'un autre.
      // On n'accepte donc que deux formes SANS ambiguïté :
      //   • le titre entre guillemets après « commande » ;
      //   • une vraie étiquette, c'est-à-dire suivie de DEUX-POINTS.
      // Sinon : pas de titre. Un titre faux vaut moins que pas de titre — il
      // sert ensuite à rattacher le reçu à un achat (règle d'identité §5.39).
      const article = ((achText.match(/commande\s*[«"“]\s*([^»"”\n]{2,70})\s*[»"”]/i)
        || achText.match(/(?:article|articles?\s+achet[ée]e?s?|achat)\s*:\s*[«"“']?([^«»"”'\n]{4,70})/i)
        || [])[1] || '').trim();
      const transaction = (achText.match(/transaction\s*:?\s*#?(\d{6,})/i) || [])[1] || '';
      const pdfA = (mail.attachments || []).find(a => /application\/pdf/i.test(a.contentType || '') || /\.pdf$/i.test(a.filename || ''));
      const key = transaction || shortHash(subject + corpsTexte.slice(0, 300));
      await supabaseUpsert([{ id: `email_achat_${key}`, data: {
        type: 'achat', subject, article, prix, transaction,
        account: acc.login || '', uid: acc.uid || '',
        texte: corpsTexte.slice(0, 4000),
        pdfB64: pdfA ? pdfA.contentB64 : null, filename: pdfA ? pdfA.filename : null,
        receivedAt: now,
      } }]);
      try { await pushOnce({
        title: '🛍 Achat confirmé',
        body: `${article || 'Commande Vinted'}${prix ? ` — ${prix} €` : ''}${acc.login ? ` (${acc.login})` : ''} — justificatif archivé.`,
        tag: `achat-${key}`, url: '/?tab=cat_achats',
        _cat: 'achat',
      }); } catch (_) {}
      await logEmail({ type: 'achat', subject, from: mail.from, prix, article, pdf: !!pdfA, account: acc.login || '' });
      res.status(200).json({ ok: true, type: 'achat', article, prix, transaction, pdf: !!pdfA });
      return;
    }

    // 3) VENTE ("Ton article s'est vendu") → facture.
    if (/vendu/i.test(subject) || /a\s+achet/i.test(corpsTexte)) {
      const data = parseSaleEmail(mail);
      if (!data) { res.status(200).json({ ok: false, type: 'vente', error: 'parse échec' }); return; }
      const key = shortHash(`${data.pseudo}|${data.prix}|${(data.designation || '').slice(0, 40)}`);
      await supabaseUpsert([{ id: `email_sale_${key}`, data: { type: 'vente', ...data, account: acc.login || '', uid: acc.uid || '', receivedAt: now } }]);
      // Notif push : vente en temps réel, même app fermée et ordi éteint.
      try { await pushOnce({ title: '💸 Vendu !', body: `${data.designation || 'Article'}${data.prix ? ` — ${data.prix} €` : ''}${acc.login ? ` (${acc.login})` : ''}`, tag: `sale-${key}`, url: '/?tab=cat_ventes' }, 'vente'); } catch (_) {}
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
              _cat: 'facture',
            }); } catch (_) {}
          }
        }
      } catch (_) {}
      await logEmail({ type: 'vente', subject, from: mail.from, prix: data.prix, numero: data.numero, facture: facture ? facture.number : null });
      res.status(200).json({ ok: true, type: 'vente', pseudo: data.pseudo, prix: data.prix, numero: data.numero, facture });
      return;
    }

    // 4) OFFRE reçue → notif immédiate (les offres expirent en 24h !).
    const textAll = `${subject}\n${corpsTexte}`;
    // Extrait le contenu utile qui suit une phrase d'annonce (le texte du
    // message reçu, l'éventuel mot accompagnant une offre...). On coupe au
    // premier élément d'habillage (boutons, pied de page, liens).
    const extractAfter = (announceRe, maxLen = 140) => {
      const lines = corpsTexte.split('\n').map(l => l.trim());
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
      // ⚠️ LE MONTANT DE L'OFFRE, PAS LE PREMIER € DU MESSAGE.
      // L'ancienne règle prenait le premier montant rencontré dans tout le texte
      // — donc le prix affiché de l'article quand il apparaissait avant l'offre.
      // On cherche d'abord un montant explicitement rattaché à l'offre.
      const montant =
          (textAll.match(/offre\s+(?:de\s+)?(\d+[,.]?\d*)\s*€/i) || [])[1]
       || (textAll.match(/(\d+[,.]?\d*)\s*€\s*(?:pour|au lieu de)/i) || [])[1]
       || (textAll.match(/(?:propose|propos[ée]e?)\s*(?:de\s*)?(\d+[,.]?\d*)\s*€/i) || [])[1]
       || (textAll.match(/(\d+[,.]?\d*)\s*€/) || [])[1] || '';
      // Le pseudo de l'acheteur : plusieurs tournures selon les emails Vinted.
      // ⚠️ Mesuré sur les 184 offres archivées : il était vide sur TOUTES —
      // l'unique motif ne couvrait pas la formulation réellement envoyée (et,
      // sur les emails dont le `text` n'était que du CSS, il n'y avait rien à
      // lire du tout : voir `corpsTexte`).
      const qui =
          (textAll.match(/([\w.\-]{2,30})\s+t['’]a\s+(?:fait|envoyé|propos[ée])\s+une?\s+(?:offre|proposition)/i) || [])[1]
       || (textAll.match(/(?:offre|proposition)\s+de\s+([\w.\-]{2,30})\s*(?:\n|·|—|-|,)/i) || [])[1]
       || (textAll.match(/de\s+la\s+part\s+de\s+([\w.\-]{2,30})/i) || [])[1]
       || (textAll.match(/([\w.\-]{2,30})\s+(?:a|vient\s+de)\s+(?:te\s+)?(?:faire|fait|envoyer|envoyé)\s+une?\s+offre/i) || [])[1]
       || '';
      const article = (textAll.match(/offre\s+(?:de\s+[\d,.]+\s*€\s+)?pour\s+[«"“']?([^«»"”'\n]{3,60})/i) || [])[1] || '';
      const key = shortHash(subject + corpsTexte.slice(0, 200));
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
        _cat: 'offre',
      }); } catch (_) {}
      // Archive l'offre + le conseil pour le panneau « Copilote d'offres » de l'app.
      try { await supabaseUpsert([{ id: `email_offer_${key}`, data: {
        type: 'offre', qui, article, montant, buy, net,
        // ⚠️ Quand l'extraction échoue, on garde un ÉCHANTILLON du texte (300
        // caractères) au lieu de deviner une nouvelle regex à l'aveugle — c'est
        // la méthode qui a fini par expliquer la fiche article (§5.24 → §5.26).
        // Rien n'est gardé quand tout a été lu.
        extrait: (!montant || !qui) ? corpsTexte.replace(/\s+/g, ' ').slice(0, 300) : undefined,
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
      const key = shortHash(subject + corpsTexte.slice(0, 200));
      try { await pushOnce({
        title: `💬 ${qui || 'Message Vinted'}${acc.login ? ` → ${acc.login}` : ''}`,
        body: extrait ? `« ${extrait} »` : 'Nouveau message — ouvre Vinted pour répondre.',
        tag: `msg-${key}`, url: '/?tab=cat_msg',
        _cat: 'message',
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
      const key = shortHash(subject + corpsTexte.slice(0, 200));
      try { await pushOnce({
        title: '❤️ Nouveau favori !',
        body: `${qui || 'Quelqu\'un'} craque sur « ${(article || 'ton article').slice(0, 45)} »${prix ? ` (${prix} €)` : ''}${acc.login ? ` (${acc.login})` : ''} — fais-lui une offre !`,
        tag: `fav-${key}`, url: '/?tab=cat_annonces',
        _cat: 'favori',
      }); } catch (_) {}
      await logEmail({ type: 'favori', subject, from: mail.from, de: qui, article, account: acc.login || '' });
      res.status(200).json({ ok: true, type: 'favori', de: qui, article });
      return;
    }

    // ⚠️ « Ignoré » ne veut pas dire « jeté ». Un email qu'aucune règle ne
    // reconnaît est CONSERVÉ entier : c'est comme ça qu'on voit ce qui manque
    // au lieu de le deviner. La forme reçue est notée au journal — c'est elle
    // qui dira si un service de réception a changé de format.
    const forme = formeRecue(corpsBrut);
    const illisible = !subject && !mail.from && !(mail.text || mail.html);
    const famille = illisible ? '' : familleConnue(subject, mail.from);
    await garderInconnu(corpsBrut, mail, illisible ? 'illisible (aucun champ lu)' : (famille ? 'connu, sans action' : 'aucune règle ne le reconnaît'), famille);
    await logEmail({ type: famille ? 'connu-sans-action' : 'ignoré', subject, from: mail.from, forme, illisible, famille });
    res.status(200).json({ ok: true, type: famille ? 'connu-sans-action' : 'ignoré', famille, subject, forme });
  } catch (e) {
    // On répond 200 pour éviter que le service de mail ne rejoue / bounce.
    res.status(200).json({ ok: false, error: String(e) });
  }
}
