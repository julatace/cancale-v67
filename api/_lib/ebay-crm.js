// ─────────────────────────────────────────────────────────────────────────────
// LE CRM eBAY — LA ROUTE (28 nov. 2026, lot ebay-crm). Règles : ebay-crm-regle.js.
// Julien : « copie les CRM eBay » (3Dsellers, eDesk, ChannelReply, Seller Hub).
//   C1 fiche acheteur (par identifiant de compte eBay, jamais par nom) ;
//   C2 écrire à l'acheteur d'une commande depuis l'app (modèles {acheteur} {article} {suivi}) ;
//   C3 messages automatiques (après la vente, à l'expédition, après la livraison,
//      demande d'évaluation) — versions au hasard, une fois par commande ;
//   C4 évaluation positive automatique quand l'acheteur a payé ;
//   C5 répondre à une évaluation reçue (réponse publique) ;
//   C6 liste d'exclusion, toutes plateformes (et le lien « bloquer sur eBay ») ;
//   C7 retours et litiges : échéance, gestes (accepter, rembourser — ebay-apres-vente.js —,
//      contester) sur SON clic, confirmés.
// API OFFICIELLE seulement : Trading (GetMemberMessages, AddMemberMessageAAQToPartner,
// GetOrders, GetItemsAwaitingFeedback, LeaveFeedback, GetFeedback, RespondToFeedback),
// Post-Order v2 (return, inquiry, casemanagement), Fulfillment (order,
// shipping_fulfillment, payment_dispute). Le jeton OAuth déjà accordé suffit, sauf les
// litiges de PAIEMENT (`sell.payment.dispute`, ajouté le 15 nov. : un compte relié avant
// doit se reconnecter — dit, jamais pris pour « aucun litige »).
// ⚠️ La « Feedback API » REST d'eBay exige un droit de plus (`commerce.feedback`) que VRM
//   ne demande pas (le demander sans qu'eBay l'ait accordé à l'application casserait la
//   connexion de tout le monde) : C4 et C5 passent par Trading LeaveFeedback /
//   RespondToFeedback, même jeton.
// ⚠️ NON MESURÉ sur ses comptes : formes de la documentation d'eBay ; une forme
//   inattendue rend « pas su », jamais une liste vide ni un envoi.
// Chaque automatisme est ÉTEINT par défaut, journalisé (`ebay_crm_journal{suffixe}`),
// réservé AVANT l'envoi (deux passages en même temps n'envoient qu'une fois ; un envoi
// dont la réponse se perd reste « incertain » et n'est JAMAIS renvoyé).
// ─────────────────────────────────────────────────────────────────────────────
import { lireXmlEbay } from './ebay-gestion.js';
import { fetchAvecDelai } from './fetch-delai.js';
import { marcheCourant } from './ebay-marches.js';
import { sbCle } from './cle.js';
import {
  cleAcheteur, acheteurMasque, acheteurDeCommande, memeAcheteur, AUTOMATISMES, AUTO_MESSAGE, LONGUEUR_EVALUATION, LONGUEUR_MESSAGE, LONGUEUR_SUJET,
  ENVOIS_PAR_PASSAGE, ENVOIS_PAR_JOUR, normaliserReglages, normaliserExclus, cleExclusion, estExclu, exclusDuSite, texteValide, choisirTexte,
  jugerAutomatisme, raisonBlocage, commandesDeAcheteur, resumeAchats, annuaireAcheteurs, TEXTES_MAX, DELAI_MAX_J,
} from './ebay-crm-regle.js';

const liste = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const texte = (v) => (v == null ? '' : typeof v === 'object' ? String(v['#text'] ?? '') : String(v));
const xml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const ID = /^\d{1,24}$/;
const ID_LITIGE = /^[A-Za-z0-9-]{1,64}$/;
const echec = (error, status = 400, reason) => ({ status, body: { ok: false, error, ...(reason ? { reason } : {}) } });
const succes = (body) => ({ status: 200, body: { ok: true, ...body } });
const dateIso = (v) => { const s = v && typeof v === 'object' ? (v.value || v.formattedValue || '') : v; const t = Date.parse(String(s || '')); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
export const LIGNE_REGLAGES = 'ebay_crm', LIGNE_JOURNAL = 'ebay_crm_journal', LIGNE_EXCLUS = 'vrm_crm_exclus';
const JOURNAL_MAX = 300, FAITS_MAX = 3000;

// Un appel Trading autonome (le cron n'a pas la route) : le site est celui du compte
// (`avecMarche` posé par l'appelant). Même lecture que la route : Ack + erreurs.
export async function appelTrading(token, appel, inner, fetcher = fetchAvecDelai) {
  const body = `<?xml version="1.0" encoding="utf-8"?><${appel}Request xmlns="urn:ebay:apis:eBLBaseComponents">${inner}</${appel}Request>`;
  try {
    const r = await fetcher('https://api.ebay.com/ws/api.dll', { method: 'POST', headers: { 'X-EBAY-API-CALL-NAME': appel, 'X-EBAY-API-SITEID': marcheCourant().siteId, 'X-EBAY-API-COMPATIBILITY-LEVEL': '1149', 'X-EBAY-API-IAF-TOKEN': token, 'Content-Type': 'text/xml' }, body, signal: AbortSignal.timeout(25000) });
    const x = await r.text();
    const ack = (/<Ack>([\s\S]*?)<\/Ack>/.exec(x) || [])[1] || '';
    const erreurs = [...x.matchAll(/<Errors>([\s\S]*?)<\/Errors>/g)].map((m) => ({ severite: /warning/i.test((/<SeverityCode>([\s\S]*?)<\/SeverityCode>/.exec(m[1]) || [])[1] || '') ? 'Warning' : 'Error', message: ((/<LongMessage>([\s\S]*?)<\/LongMessage>/.exec(m[1]) || [])[1] || '').slice(0, 200) }));
    return { status: r.status, ok: r.ok && /Success|Warning/i.test(ack), ack, erreurs, err: (erreurs.find((e) => e.severite === 'Error') || {}).message || '', xml: x };
  } catch (_) { return { status: 0, ok: false, ack: '', erreurs: [], xml: '' }; }
}

// ── Lectures pures des réponses d'eBay ─────────────────────────────────────────
// GetOrders : la date de LIVRAISON lue (ActualDeliveryTime), par commande. Absente ⇒ rien.
export function livraisonsLues(root) {
  const out = new Map();
  for (const o of liste(root && root.OrderArray && root.OrderArray.Order)) {
    const id = texte(o.OrderID).trim(); if (!id) continue;
    const dates = [o.ShippingServiceSelected, ...liste(o.TransactionArray && o.TransactionArray.Transaction).map((t) => t && t.ShippingServiceSelected)]
      .map((s) => Date.parse(texte(s && s.ShippingPackageInfo && s.ShippingPackageInfo.ActualDeliveryTime))).filter(Number.isFinite);
    if (dates.length) out.set(id, Math.max(...dates));
  }
  return out;
}
// GetFeedback (reçues comme vendeur) : de qui, sur quoi, et si j'ai déjà répondu.
export function avisRecus(root) {
  if (!root || typeof root !== 'object') return null;
  return liste(root.FeedbackDetailArray && root.FeedbackDetailArray.FeedbackDetail).map((f) => ({
    id: texte(f.FeedbackID).trim(), type: texte(f.CommentType).trim(), texte: texte(f.CommentText).replace(/\s+/g, ' ').slice(0, 500),
    date: dateIso(texte(f.CommentTime)), itemId: ID.test(texte(f.ItemID).trim()) ? texte(f.ItemID).trim() : '', transactionId: ID.test(texte(f.TransactionID).trim()) ? texte(f.TransactionID).trim() : '',
    titre: texte(f.ItemTitle).slice(0, 120), de: texte(f.CommentingUser).trim().slice(0, 64), role: texte(f.Role).trim(),
    reponse: texte(f.FeedbackResponse).trim().slice(0, 200) || null,
  })).filter((f) => ID.test(f.id) && /^(Positive|Neutral|Negative)$/.test(f.type));
}
// Les litiges et retours, sous UNE forme : { sorte, id, orderId, itemId, acheteur, etat, ouvert, limite, montant }.
const montant = (m) => (m && typeof m === 'object' && Number.isFinite(Number(m.value)) && /^[A-Z]{3}$/.test(String(m.currency || '')) ? { value: Number(m.value).toFixed(2), currency: m.currency } : null);
const RETOUR_FERME = /^(CLOSED|RETURN_CLOSED|REFUND_ISSUED|CLOSED_WITH_REFUND)$/i;
const LITIGE_FERME = /^(CLOSED|CS_CLOSED|RESOLVED|CANCELLED|EXPIRED|WON|LOST|CLOSED_.*)$/i;
const totalZero = (d) => d && typeof d === 'object' && !Array.isArray(d) && !d.errors && !d.error && (Object.keys(d).length === 0 || [d.total, d.totalCount, d.totalEntries, d.paginationOutput && d.paginationOutput.totalEntries].some((v) => v === 0 || v === '0'));
export function retoursLus(d) {
  if (!d || typeof d !== 'object') return null;
  const l = Array.isArray(d.members) ? d.members : (d.members == null && totalZero(d)) ? [] : null; if (!l) return null;
  return l.map((m) => { const ci = (m && m.creationInfo) || {}, it = ci.item || {}, s = (m && m.sellerTotalRefund) || {}; return {
    sorte: 'retour', id: String((m && m.returnId) || ''), orderId: String((m && m.orderId) || ''), itemId: String(it.itemId || ''), acheteur: String((m && m.buyerLoginName) || ''),
    etat: String((m && m.state) || '').toUpperCase(), ouvert: !RETOUR_FERME.test(String((m && m.state) || '')), date: dateIso(ci.creationDate), limite: dateIso(m && m.sellerResponseDue && m.sellerResponseDue.respondByDate),
    motif: String(ci.reason || ''), montant: montant(s.estimatedRefundAmount), rembourse: !!montant(s.actualRefundAmount), titre: String(it.itemTitle || '').slice(0, 120) }; }).filter((x) => /^\d{1,24}$/.test(x.id));
}
export function reclamationsLues(d, sorte) {
  if (!d || typeof d !== 'object') return null;
  const l = Array.isArray(d.members) ? d.members : (d.members == null && totalZero(d)) ? [] : null; if (!l) return null;
  return l.map((m) => { const etat = String((m && (m.inquiryStatusEnum || m.caseStatusEnum || m.status)) || '').toUpperCase(); return {
    sorte, id: String((m && (sorte === 'cas' ? m.caseId : m.inquiryId)) || ''), orderId: String((m && (m.orderId || m.legacyOrderId)) || ''), itemId: ID.test(String((m && m.itemId) || '')) ? String(m.itemId) : '',
    acheteur: String((m && (m.buyer || m.buyerLoginName || m.buyerUsername)) || ''), etat, ouvert: !LITIGE_FERME.test(etat), date: dateIso(m && m.creationDate),
    limite: dateIso(m && (m.respondByDate || m.sellerMakeItRightByDate)), montant: montant(m && m.claimAmount), titre: '' }; }).filter((x) => /^\d{1,24}$/.test(x.id));
}
export function litigesPaiementLus(d) {
  if (!d || typeof d !== 'object') return null;
  const l = Array.isArray(d.paymentDisputeSummaries) ? d.paymentDisputeSummaries : (d.paymentDisputeSummaries == null && totalZero(d)) ? [] : null; if (!l) return null;
  return l.map((x) => { const etat = String((x && x.paymentDisputeStatus) || '').toUpperCase(); return {
    sorte: 'paiement', id: String((x && x.paymentDisputeId) || ''), orderId: String((x && x.orderId) || ''), itemId: '', acheteur: String((x && x.buyerUsername) || ''),
    etat, ouvert: !/^(CLOSED)$/.test(etat), date: dateIso(x && x.openDate), limite: dateIso(x && x.respondByDate), montant: montant(x && x.amount), motif: String((x && x.reason) || ''), titre: '' }; }).filter((x) => ID_LITIGE.test(x.id));
}
// Les blocages des automatismes : TOUT retour ou litige (ouvert OU clos) — une commande
// qui a connu un retour ne reçoit plus de « merci » ni de demande d'évaluation.
export function blocagesDe(listes) {
  const commandes = new Set(), annonces = new Set();
  for (const x of listes.flat()) { if (x.orderId) commandes.add(String(x.orderId)); if (x.itemId) annonces.add(String(x.itemId)); }
  return { commandes, annonces };
}

// ═══ LA FABRIQUE ═══════════════════════════════════════════════════════════════
// deps : accessToken(ctx) · lireDonnee(id, owner) · modifierDonnee(id, owner, fn) ·
//        lireCommandes(ctx) → toutes les commandes rangées du vendeur (tous comptes,
//        `_compte` posé) ou null · tradingCall(token, appel, inner) · fetcher · maintenant · aleatoire
export function creerCrmEbay({ accessToken, lireDonnee, modifierDonnee, lireCommandes, tradingCall = appelTrading, fetcher = (...a) => fetchAvecDelai(...a), apiOrigin = 'https://api.ebay.com', apizOrigin = 'https://apiz.ebay.com', maintenant = () => Date.now(), aleatoire = () => Math.random(), domaine = () => marcheCourant().domaine }) {
  const suffixe = (ctx) => (ctx && ctx.compte && ctx.compte.suffixe) || '';
  const refCompte = (ctx) => (ctx && ctx.compte && !ctx.compte.principal && ctx.compte.cle ? String(ctx.compte.cle) : 'principal');
  const jeton = async (ctx) => { const r = await accessToken(ctx); return r && r.ok && r.token ? r : { ko: echec((r && r.error) || 'Compte eBay indisponible.', (r && r.status) || 502, r && r.reason) }; };
  async function json(url, token, { iaf = false, methode = 'GET', corps } = {}) {
    try {
      const r = await fetcher(url, { method: methode, headers: { Authorization: (iaf ? 'IAF ' : 'Bearer ') + token, Accept: 'application/json', 'Content-Type': 'application/json', 'X-EBAY-C-MARKETPLACE-ID': marcheCourant().marketplace }, ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}) });
      const raw = await r.text().catch(() => ''); let data = null; try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
      return { status: r.status, ok: r.status >= 200 && r.status < 300, data, vide: !raw.trim() };
    } catch (_) { return { status: 0, ok: false, data: null, coupure: true }; }
  }
  const lire = async (token, appel, inner) => {
    const r = await tradingCall(token, appel, inner);
    if (!r || !r.ok) return null;
    const root = lireXmlEbay(r.xml, appel);
    return root && ['Success', 'Warning'].includes(texte(root.Ack).trim()) ? root : null;
  };
  // Une écriture Trading : ok · refus (eBay a dit non) · incertain (pas de réponse lisible).
  const ecrire = async (token, appel, inner) => {
    const r = await tradingCall(token, appel, inner);
    if (!r || !r.ack) return 'incertain';
    const root = lireXmlEbay(r.xml, appel);
    if (!root) return 'incertain';
    return r.ok && ['Success', 'Warning'].includes(texte(root.Ack).trim()) && !(r.erreurs || []).some((e) => e.severite === 'Error') ? 'ok' : 'refus';
  };

  // ── Lectures en direct ───────────────────────────────────────────────────────
  // Les retours et litiges du compte : `null` si UNE source n'a pas répondu (pas su ⇒
  // l'appelant ne fait rien d'automatique). `scope` : le droit des litiges de paiement manque.
  async function lireLitiges(token) {
    const PO = `${apiOrigin}/post-order/v2`;
    const [rt, iq, cs, pd] = await Promise.all([
      json(`${PO}/return/search?role=SELLER&limit=100&sort=CREATION_DATE_DESC`, token, { iaf: true }),
      json(`${PO}/inquiry/search?limit=100`, token, { iaf: true }),
      json(`${PO}/casemanagement/search?limit=100`, token, { iaf: true }),
      json(`${apizOrigin}/sell/fulfillment/v1/payment_dispute_summary?limit=100`, token),
    ]);
    const lu = (r, f) => (r.ok ? ((r.status === 204 || r.vide) ? [] : f(r.data)) : null);
    const retours = lu(rt, retoursLus), inq = lu(iq, (d) => reclamationsLues(d, 'reclamation')), cas = lu(cs, (d) => reclamationsLues(d, 'cas')), pai = lu(pd, litigesPaiementLus);
    const manque = [!retours && 'retours', !inq && 'reclamations', !cas && 'cas', !pai && 'paiements'].filter(Boolean);
    return { retours, reclamations: inq, cas, paiements: pai, manque, scopePaiement: !pai && (pd.status === 401 || pd.status === 403) };
  }
  const tousLitiges = (l) => [...(l.retours || []), ...(l.reclamations || []), ...(l.cas || []), ...(l.paiements || [])];

  // ── C1 : l'annuaire et la fiche ─────────────────────────────────────────────
  async function acheteurs(b, ctx) {
    const orders = await lireCommandes(ctx);
    if (!Array.isArray(orders)) return echec('Je n’ai pas pu relire tes commandes eBay — rien n’est perdu, réessaie dans un moment.', 503, 'pas-su');
    return succes({ acheteurs: annuaireAcheteurs(orders, String(b.q || '').slice(0, 64)), commandesLues: orders.length });
  }
  async function fiche(b, ctx) {
    const c = cleAcheteur(b.acheteur);
    if (!c || acheteurMasque(c)) return echec('Cet identifiant d’acheteur eBay n’est pas lisible.', 400, 'acheteur');
    const [orders, exclus] = await Promise.all([lireCommandes(ctx), lireDonnee(LIGNE_EXCLUS, ctx.owner)]);
    if (!Array.isArray(orders)) return echec('Je n’ai pas pu relire tes commandes eBay — rien n’est perdu, réessaie dans un moment.', 503, 'pas-su');
    const siennes = commandesDeAcheteur(orders, c);
    const achats = resumeAchats(siennes);
    const nom = siennes[0] ? String(siennes[0].buyer.username).trim() : String(b.acheteur).trim();
    // Le reste se lit EN DIRECT sur le compte ouvert ; une source muette ⇒ `null` (« pas su »), jamais [].
    const a = await jeton(ctx);
    let messages = null, avis = null, litiges = null, litigesManque = ['tout'];
    if (a.token) {
      const fin = new Date(maintenant()), debut = new Date(fin.getTime() - 90 * 86400000);
      const [rm, rf, rl] = await Promise.all([
        lire(a.token, 'GetMemberMessages', `<MailMessageType>All</MailMessageType><SenderID>${xml(nom)}</SenderID><StartCreationTime>${debut.toISOString()}</StartCreationTime><EndCreationTime>${fin.toISOString()}</EndCreationTime><Pagination><EntriesPerPage>50</EntriesPerPage><PageNumber>1</PageNumber></Pagination>`),
        lire(a.token, 'GetFeedback', '<FeedbackType>FeedbackReceivedAsSeller</FeedbackType><DetailLevel>ReturnAll</DetailLevel><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination>'),
        lireLitiges(a.token),
      ]);
      if (rm) messages = liste(rm.MemberMessage && rm.MemberMessage.MemberMessageExchange).map((e) => { const q = e.Question || {}, it = e.Item || {}; return { id: texte(q.MessageID), itemId: texte(it.ItemID), titre: texte(it.Title).slice(0, 120), sujet: texte(q.Subject).slice(0, 160), date: dateIso(texte(e.CreationDate)), de: texte(q.SenderID), repondu: liste(e.Response).length > 0 }; })
        .filter((m) => m.id && memeAcheteur(m.de, c)).map(({ de, ...m }) => m);
      const av = rf ? avisRecus(rf) : null;
      if (av) avis = av.filter((f) => memeAcheteur(f.de, c)).map(({ de, ...f }) => f);
      litiges = tousLitiges(rl).filter((x) => memeAcheteur(x.acheteur, c) || (x.orderId && siennes.some((o) => o.orderId === x.orderId))).map(({ acheteur, ...x }) => x);
      litigesManque = rl.manque;
    }
    return succes({ acheteur: nom, cle: c, ...achats, comptes: [...new Set(siennes.map((o) => o._compte || 'principal'))], commandesLues: orders.length,
      messages, avis, avisSur: 200, litiges, litigesManque, exclu: estExclu(exclus, 'ebay', c), lienBloquer: `https://${domaine()}/bmgt/BuyerBlock` });
  }

  // ── Réglages et modèles ─────────────────────────────────────────────────────
  async function reglages(b, ctx) {
    const [d, j] = await Promise.all([lireDonnee(LIGNE_REGLAGES + suffixe(ctx), ctx.owner), lireDonnee(LIGNE_JOURNAL + suffixe(ctx), ctx.owner)]);
    if (d === undefined) return echec('Je n’ai pas pu lire tes réglages — rien n’a changé.', 503, 'pas-su');
    const lignes = j && Array.isArray(j.lignes) ? j.lignes.slice(0, 60) : (j === undefined ? null : []);
    return succes({ reglages: normaliserReglages(d), journal: lignes, dernierPassage: j && j.dernierPassage ? j.dernierPassage : null });
  }
  // Un automatisme se règle sur SON clic ; ALLUMER exige `confirme` (il écrira à des
  // acheteurs) et pose `depuis` = maintenant (les commandes d'avant ne sont jamais visées).
  async function regler(b, ctx) {
    const quoi = String(b.quoi || '');
    const modeles = Array.isArray(b.modeles) ? b.modeles : null;
    if (!modeles && !AUTOMATISMES.includes(quoi)) return echec('Réglage inconnu.', 400);
    if (!modeles) {
      const max = quoi === 'evalAuto' ? LONGUEUR_EVALUATION : LONGUEUR_MESSAGE;
      const textes = Array.isArray(b.textes) ? b.textes.map((t) => String(t || '').trim()).filter(Boolean) : null;
      if (!textes || textes.length > TEXTES_MAX || textes.some((t) => !texteValide(t, max))) return echec(quoi === 'evalAuto' ? `Chaque texte : ${LONGUEUR_EVALUATION} caractères au plus, variables {acheteur} {article} seulement.` : 'Chaque texte : 2 000 caractères au plus ; variables {acheteur} {article} {suivi} seulement.', 400, 'texte');
      if (b.actif === true && !textes.length) return echec('Écris au moins un texte avant d’allumer.', 400, 'texte');
      if (b.actif === true && b.confirme !== true) return echec('Confirme : VRM écrira à tes acheteurs.', 400, 'confirmation');
      if (b.delaiJ != null && !(Number.isInteger(b.delaiJ) && b.delaiJ >= 0 && b.delaiJ <= DELAI_MAX_J)) return echec('Délai invalide.', 400);
    } else if (modeles.length > 50) return echec('50 modèles au plus.', 400);
    let apres = null;
    const r = await modifierDonnee(LIGNE_REGLAGES + suffixe(ctx), ctx.owner, (d) => {
      const n = normaliserReglages(d);
      if (modeles) { n.modeles = normaliserReglages({ modeles }).modeles; apres = n; return n; }
      const a = n.auto[quoi];
      const actif = b.actif === true;
      n.auto[quoi] = { ...a, textes: b.textes.map((t) => String(t).trim()).filter(Boolean), actif, depuis: actif ? (a.actif && a.depuis ? a.depuis : maintenant()) : null,
        delaiJ: b.delaiJ != null ? b.delaiJ : a.delaiJ, ...(quoi === 'evalAuto' ? {} : { sujet: String(b.sujet == null ? a.sujet : b.sujet).trim().slice(0, LONGUEUR_SUJET) }) };
      apres = normaliserReglages(n);
      return { ...apres };
    });
    if (r !== true) return echec('Réglage pas enregistré (base injoignable) — rien n’a changé.', 503, 'base');
    return succes({ reglages: apres });
  }

  // ── C6 : la liste d'exclusion (toutes plateformes ; ligne du vendeur, pas du compte) ─
  async function exclusLire(b, owner) {
    const d = await lireDonnee(LIGNE_EXCLUS, owner);
    if (d === undefined) return echec('Je n’ai pas pu lire ta liste d’exclusion.', 503, 'pas-su');
    return succes({ exclus: normaliserExclus(d).liste });
  }
  async function exclure(b, owner) {
    const site = String(b.site || ''), id = cleExclusion(site, b.id);
    if (!id) return echec(site === 'vinted' ? 'Colle le lien du profil Vinted (…/member/123…) ou son numéro de membre.' : 'Identifiant de compte illisible — jamais un nom.', 400, 'identifiant');
    if (b.confirme !== true) return echec('Confirme l’exclusion.', 400, 'confirmation');
    const r = await modifierDonnee(LIGNE_EXCLUS, owner, (d) => { const n = normaliserExclus(d); if (n.liste.some((e) => e.site === site && e.id === id)) return undefined; n.liste.unshift({ site, id, note: String(b.note || '').slice(0, 120), le: maintenant() }); return normaliserExclus(n); });
    if (r !== true) return echec('Exclusion pas enregistrée (base injoignable).', 503, 'base');
    return exclusLire(b, owner);
  }
  async function reintegrer(b, owner) {
    const site = String(b.site || ''), id = cleExclusion(site, b.id);
    if (!id) return echec('Identifiant illisible.', 400);
    const r = await modifierDonnee(LIGNE_EXCLUS, owner, (d) => { const n = normaliserExclus(d); const l = n.liste.filter((e) => !(e.site === site && e.id === id)); return l.length === n.liste.length ? undefined : { ...n, liste: l }; });
    if (r !== true) return echec('Pas enregistré (base injoignable).', 503, 'base');
    return exclusLire(b, owner);
  }

  // ── C2 : écrire à l'acheteur d'UNE commande (son clic) ─────────────────────
  // L'acheteur et l'annonce doivent être ceux d'une commande RANGÉE (identité) : on
  // n'écrit jamais à un pseudo tapé.
  async function ecrireAcheteur(b, ctx) {
    if (b.confirme !== true) return echec('Confirme le message.', 400, 'confirmation');
    const corps = String(b.texte || '').trim(), sujet = String(b.sujet || '').trim().slice(0, LONGUEUR_SUJET);
    if (!corps || corps.length > LONGUEUR_MESSAGE || /\{[a-zA-Z]+\}/.test(corps)) return echec('Message vide, trop long, ou avec une variable pas remplie.', 400, 'texte');
    const orders = await lireCommandes(ctx);
    if (!Array.isArray(orders)) return echec('Je n’ai pas pu relire tes commandes — rien n’a été envoyé.', 503, 'pas-su');
    // Par sa commande, ou (une conversation) par l'annonce ET l'acheteur : la commande la plus récente de CE couple.
    const o = b.orderId != null ? orders.find((x) => x.orderId === String(b.orderId || '') && (x._compte || 'principal') === refCompte(ctx))
      : orders.filter((x) => (x._compte || 'principal') === refCompte(ctx) && ID.test(String(b.itemId || '')) && memeAcheteur(b.acheteur, acheteurDeCommande(x)) && (x.lineItems || []).some((l) => String(l.legacyItemId || '') === String(b.itemId)))
        .sort((x, y) => (Date.parse(y.creationDate || '') || 0) - (Date.parse(x.creationDate || '') || 0))[0];
    const item = o && Array.isArray(o.lineItems) && o.lineItems[0] ? String((b.orderId == null ? b.itemId : o.lineItems[0].legacyItemId) || '') : '';
    if (!o || !acheteurDeCommande(o) || acheteurMasque(acheteurDeCommande(o)) || !ID.test(item)) return echec('Cette commande n’est pas rangée sur ce compte eBay, ou eBay n’a pas donné son acheteur — rien n’a été envoyé.', 409, 'commande');
    if (b.acheteur != null && !memeAcheteur(b.acheteur, acheteurDeCommande(o))) return echec('L’acheteur de cette commande a changé — rien n’a été envoyé.', 409, 'acheteur');
    const a = await jeton(ctx); if (a.ko) return a.ko;
    const e = await ecrire(a.token, 'AddMemberMessageAAQToPartner', `<ItemID>${item}</ItemID><MemberMessage><RecipientID>${xml(o.buyer.username)}</RecipientID><Subject>${xml(sujet || o.lineItems[0].title || 'Commande')}</Subject><Body>${xml(corps)}</Body><QuestionType>General</QuestionType><EmailCopyToSender>true</EmailCopyToSender></MemberMessage>`);
    return e === 'ok' ? succes({ envoye: true }) : e === 'refus' ? echec('eBay a refusé ce message.', 422, 'refus') : echec('eBay n’a pas répondu — je ne sais pas si le message est parti. Regarde sur eBay avant de recommencer.', 504, 'incertain');
  }

  // ── C5 : les évaluations reçues et la réponse publique ──────────────────────
  async function avis(b, ctx) {
    const a = await jeton(ctx); if (a.ko) return a.ko;
    const r = await lire(a.token, 'GetFeedback', '<FeedbackType>FeedbackReceivedAsSeller</FeedbackType><DetailLevel>ReturnAll</DetailLevel><Pagination><EntriesPerPage>50</EntriesPerPage><PageNumber>1</PageNumber></Pagination>');
    const l = r ? avisRecus(r) : null;
    if (!l) return echec('eBay n’a pas rendu tes évaluations reçues.', 502, 'pas-su');
    return succes({ avis: l, sur: 50 });
  }
  async function repondreAvis(b, ctx) {
    if (b.confirme !== true) return echec('Confirme ta réponse publique.', 400, 'confirmation');
    const t = String(b.texte || '').trim();
    if (!ID.test(String(b.feedbackId || '')) || !t || t.length > LONGUEUR_EVALUATION) return echec(`Ta réponse : ${LONGUEUR_EVALUATION} caractères au plus.`, 400, 'texte');
    const a = await jeton(ctx); if (a.ko) return a.ko;
    // RELUE juste avant : l'évaluation existe, elle est à moi (vendeur), sans réponse.
    const r = await lire(a.token, 'GetFeedback', `<FeedbackID>${b.feedbackId}</FeedbackID><DetailLevel>ReturnAll</DetailLevel>`);
    const f = r ? (avisRecus(r) || []).find((x) => x.id === String(b.feedbackId)) : null;
    if (!f) return echec('Cette évaluation n’a pas pu être relue chez eBay — rien n’a été envoyé.', 409, 'pas-relue');
    if (f.reponse) return echec('Tu as déjà répondu à cette évaluation.', 409, 'deja');
    if (!f.de || !f.itemId) return echec('eBay n’a pas donné l’auteur ou l’annonce de cette évaluation — rien n’a été envoyé.', 409, 'incomplet');
    const e = await ecrire(a.token, 'RespondToFeedback', `<FeedbackID>${f.id}</FeedbackID><ItemID>${f.itemId}</ItemID>${f.transactionId ? `<TransactionID>${f.transactionId}</TransactionID>` : ''}<TargetUserID>${xml(f.de)}</TargetUserID><ResponseType>Reply</ResponseType><ResponseText>${xml(t)}</ResponseText>`);
    return e === 'ok' ? succes({ repondu: true }) : e === 'refus' ? echec('eBay a refusé cette réponse.', 422, 'refus') : echec('eBay n’a pas répondu — je ne sais pas si ta réponse est publiée. Regarde sur eBay.', 504, 'incertain');
  }

  // ── C7 : retours et litiges, une liste, l'échéance d'abord ──────────────────
  async function litiges(b, ctx) {
    const a = await jeton(ctx); if (a.ko) return a.ko;
    const l = await lireLitiges(a.token);
    const tous = tousLitiges(l).sort((x, y) => (x.ouvert === y.ouvert ? 0 : x.ouvert ? -1 : 1) || ((Date.parse(x.limite || '') || 9e15) - (Date.parse(y.limite || '') || 9e15)));
    return succes({ litiges: tous, manque: l.manque, scopePaiement: l.scopePaiement });
  }
  // « Contester » : un litige de PAIEMENT (Fulfillment contest), une réclamation « objet
  // non reçu » portée devant eBay (Post-Order escalate). Un retour se refuse par
  // `deciderretour` (DECLINE), un remboursement par `rembourserretour` (ebay-apres-vente.js).
  async function contester(b, ctx) {
    if (b.confirme !== true) return echec('Confirme : rien n’a été envoyé.', 400, 'confirmation');
    const sorte = String(b.sorte || ''), id = String(b.id || ''), note = String(b.note || '').trim().slice(0, 1000);
    if (!['paiement', 'reclamation'].includes(sorte) || !(sorte === 'paiement' ? ID_LITIGE.test(id) : ID.test(id))) return echec('Litige invalide.', 400);
    if (!note) return echec('Dis à eBay pourquoi tu contestes (1 000 caractères au plus).', 400, 'texte');
    const a = await jeton(ctx); if (a.ko) return a.ko;
    if (sorte === 'paiement') {
      const v = await json(`${apizOrigin}/sell/fulfillment/v1/payment_dispute/${encodeURIComponent(id)}`, a.token);
      if (!v.ok || !v.data) return echec(v.status === 401 || v.status === 403 ? 'eBay n’a pas autorisé VRM à lire ce litige : reconnecte ton compte eBay.' : 'Ce litige n’a pas pu être relu chez eBay — rien n’a été envoyé.', v.status === 401 || v.status === 403 ? 200 : 409, v.status === 401 || v.status === 403 ? 'scope' : 'pas-relu');
      const etat = String(v.data.paymentDisputeStatus || '').toUpperCase();
      const choix = (Array.isArray(v.data.availableChoices) ? v.data.availableChoices : []).map(String);
      if (etat !== 'ACTION_NEEDED' || (choix.length && !choix.includes('CONTEST'))) return echec(`eBay n’attend plus de contestation sur ce litige (état : ${etat || 'inconnu'}).`, 409, 'etat');
      if (!Number.isInteger(Number(v.data.revision))) return echec('eBay n’a pas donné la version de ce litige — rien n’a été envoyé.', 409, 'revision');
      const w = await json(`${apizOrigin}/sell/fulfillment/v1/payment_dispute/${encodeURIComponent(id)}/contest`, a.token, { methode: 'POST', corps: { revision: Number(v.data.revision), note } });
      if (w.ok) return succes({ conteste: true });
      return w.coupure || w.status >= 500 ? echec('eBay n’a pas répondu — je ne sais pas si la contestation est partie. Regarde sur eBay.', 504, 'incertain') : echec('eBay a refusé la contestation.', w.status >= 400 ? w.status : 422, 'refus');
    }
    const v = await json(`${apiOrigin}/post-order/v2/inquiry/${encodeURIComponent(id)}`, a.token, { iaf: true });
    const etat = String((v.data && (v.data.inquiryStatusEnum || v.data.status)) || '').toUpperCase();
    if (!v.ok || !v.data) return echec('Cette réclamation n’a pas pu être relue chez eBay — rien n’a été envoyé.', 409, 'pas-relu');
    if (LITIGE_FERME.test(etat)) return echec('Cette réclamation est close chez eBay.', 409, 'etat');
    const w = await json(`${apiOrigin}/post-order/v2/inquiry/${encodeURIComponent(id)}/escalate`, a.token, { iaf: true, methode: 'POST', corps: { escalateInquiryReason: 'OTHERS', comments: { content: note } } });
    if (w.ok) return succes({ conteste: true });
    return w.coupure || w.status >= 500 ? echec('eBay n’a pas répondu — je ne sais pas si la demande est partie. Regarde sur eBay.', 504, 'incertain') : echec('eBay a refusé de porter cette réclamation devant eBay.', w.status >= 400 ? w.status : 422, 'refus');
  }

  // ═══ C3 + C4 : LE PASSAGE ═════════════════════════════════════════════════════
  // Appelé par la relecture de l'app (~10 min, app ouverte) et par le cron du matin et du
  // soir (app fermée). Rien n'est envoyé si UNE lecture qui protège (exclusions, retours,
  // litiges, journal) n'a pas répondu. Rend un bilan SANS identifiant d'acheteur.
  async function passer(ctx, { max = ENVOIS_PAR_PASSAGE } = {}) {
    const sfx = suffixe(ctx), owner = ctx.owner, now = maintenant();
    const d = await lireDonnee(LIGNE_REGLAGES + sfx, owner);
    if (d === undefined) return { fait: false, raison: 'reglages-pas-sus' };
    const reg = normaliserReglages(d);
    const actifs = AUTOMATISMES.filter((k) => reg.auto[k].actif);
    if (!actifs.length) return { fait: true, envoyes: 0, raison: 'eteint' };
    const [exclus, journal, orders] = await Promise.all([lireDonnee(LIGNE_EXCLUS, owner), lireDonnee(LIGNE_JOURNAL + sfx, owner), lireCommandes(ctx)]);
    if (exclus === undefined) return { fait: false, raison: 'exclusion-pas-sue' };
    if (journal === undefined) return { fait: false, raison: 'journal-pas-su' };
    if (!Array.isArray(orders)) return { fait: false, raison: 'commandes-pas-sues' };
    const miennes = orders.filter((o) => (o._compte || 'principal') === refCompte(ctx));
    const a = await jeton(ctx); if (a.ko) return { fait: false, raison: 'jeton' };
    const l = await lireLitiges(a.token);
    if (l.manque.length) return { fait: false, raison: l.scopePaiement ? 'scope-litiges' : 'litiges-pas-sus', manque: l.manque };
    const blocages = blocagesDe([l.retours, l.reclamations, l.cas, l.paiements]);
    const faits = (journal && journal.faits) || {};
    const envois24 = (journal && Array.isArray(journal.lignes) ? journal.lignes : []).filter((x) => x.etat !== 'saute' && now - Number(x.le) < 86400000).length;
    let budget = Math.max(0, Math.min(max, ENVOIS_PAR_JOUR - envois24));
    // La livraison PROUVÉE (Trading GetOrders) des commandes expédiées qu'un automatisme attend.
    let livraisons = new Map();
    if (actifs.some((k) => k === 'livraison' || k === 'demandeEval')) {
      const ids = miennes.filter((o) => ['livraison', 'demandeEval'].some((k) => reg.auto[k].actif && !(faits[o.orderId] && faits[o.orderId][k]) && Date.parse(o.creationDate || '') >= reg.auto[k].depuis)).map((o) => o.orderId).filter((x) => /^[A-Za-z0-9-]{1,64}$/.test(x)).slice(0, 20);
      if (ids.length) { const r = await lire(a.token, 'GetOrders', `<OrderIDArray>${ids.map((x) => `<OrderID>${xml(x)}</OrderID>`).join('')}</OrderIDArray><OrderRole>Seller</OrderRole>`); if (r) livraisons = livraisonsLues(r); }
    }
    // L'évaluation que l'acheteur a déjà laissée ⇒ pas de demande d'évaluation.
    let dejaEvalue = null;
    if (reg.auto.demandeEval.actif) { const r = await lire(a.token, 'GetFeedback', '<FeedbackType>FeedbackReceivedAsSeller</FeedbackType><DetailLevel>ReturnAll</DetailLevel><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination>'); const av = r ? avisRecus(r) : null; dejaEvalue = av ? new Set(av.map((f) => cleAcheteur(f.de) + ':' + f.itemId)) : null; }
    // Les ventes qui attendent encore MON évaluation (C4) : la liste d'eBay fait foi.
    let attente = null;
    if (reg.auto.evalAuto.actif) { const r = await lire(a.token, 'GetItemsAwaitingFeedback', '<Sort>EndTime</Sort><Pagination><EntriesPerPage>100</EntriesPerPage><PageNumber>1</PageNumber></Pagination>'); attente = r ? liste(r.ItemsAwaitingFeedback && r.ItemsAwaitingFeedback.TransactionArray && r.ItemsAwaitingFeedback.TransactionArray.Transaction).map((t) => ({ itemId: texte(t.Item && t.Item.ItemID), transactionId: texte(t.TransactionID), acheteur: texte(t.Buyer && t.Buyer.UserID) })).filter((t) => ID.test(t.itemId) && ID.test(t.transactionId) && cleAcheteur(t.acheteur)) : null; }

    const bilan = { fait: true, envoyes: 0, incertains: 0, refuses: 0, sautes: {}, attente: 0 };
    const saute = (r) => { bilan.sautes[r] = (bilan.sautes[r] || 0) + 1; };
    const suivis = new Map();
    const suiviDe = async (o) => {
      if (suivis.has(o.orderId)) return suivis.get(o.orderId);
      const r = await json(`${apiOrigin}/sell/fulfillment/v1/order/${encodeURIComponent(o.orderId)}/shipping_fulfillment`, a.token);
      const n = r.ok && Array.isArray(r.data && r.data.fulfillments) ? String((r.data.fulfillments[0] || {}).shipmentTrackingNumber || '').trim() : '';
      const v = /^[A-Za-z0-9 -]{4,60}$/.test(n) ? n : null; suivis.set(o.orderId, v); return v;
    };
    for (const o of miennes.sort((x, y) => (Date.parse(x.creationDate || '') || 0) - (Date.parse(y.creationDate || '') || 0))) {
      for (const quoi of actifs) {
        if (budget <= 0) { bilan.attente++; continue; }
        const rg = reg.auto[quoi];
        const livreLe = livraisons.get(o.orderId);
        const j = jugerAutomatisme({ quoi, order: o, reglage: rg, faits, exclus, blocages, livreLe, maintenant: now });
        if (!j.ok) { if (j.raison !== 'deja-fait' && j.raison !== 'avant-allumage' && j.raison !== 'eteint') saute(j.raison); continue; }
        const acheteur = acheteurDeCommande(o), l0 = o.lineItems[0] || {}, item = String(l0.legacyItemId || '');
        if (!ID.test(item)) { saute('annonce-illisible'); continue; }
        let ev = null;
        if (quoi === 'evalAuto') {
          if (!attente) { saute('attente-pas-sue'); continue; }
          ev = attente.find((t) => t.itemId === item && memeAcheteur(t.acheteur, acheteur));
          if (!ev) { saute('n-attend-pas'); continue; }
        }
        if (quoi === 'demandeEval') { if (!dejaEvalue) { saute('avis-pas-sus'); continue; } if (dejaEvalue.has(acheteur + ':' + item)) { saute('deja-evalue'); continue; } }
        const vars = { acheteur: o.buyer.username, article: String(l0.title || '').slice(0, 80) || null, suivi: null };
        if (rg.textes.some((t) => t.includes('{suivi}'))) vars.suivi = await suiviDe(o);
        const choix = choisirTexte(rg.textes, vars, aleatoire());
        if (!choix) { saute('texte-pas-remplissable'); continue; }
        // RÉSERVER avant d'envoyer (comparer-et-échanger) : un autre passage qui l'a déjà pris gagne.
        let pris = false;
        const res = await modifierDonnee(LIGNE_JOURNAL + sfx, owner, (jd) => {
          const f = { ...((jd && jd.faits) || {}) };
          if (f[o.orderId] && f[o.orderId][quoi]) return undefined;
          f[o.orderId] = { ...(f[o.orderId] || {}), [quoi]: { etat: 'en-cours', le: now, v: choix.i } };
          const cles = Object.keys(f); if (cles.length > FAITS_MAX) for (const k of cles.slice(0, cles.length - FAITS_MAX)) delete f[k];
          pris = true; return { ...(jd || {}), faits: f };
        });
        if (res !== true || !pris) { saute(res === true ? 'deja-fait' : 'journal-pas-ecrit'); continue; }
        faits[o.orderId] = { ...(faits[o.orderId] || {}), [quoi]: { etat: 'en-cours' } };
        budget--;
        const etat = quoi === 'evalAuto'
          ? await ecrire(a.token, 'LeaveFeedback', `<ItemID>${ev.itemId}</ItemID><TransactionID>${ev.transactionId}</TransactionID><TargetUser>${xml(ev.acheteur)}</TargetUser><CommentType>Positive</CommentType><CommentText>${xml(choix.t.slice(0, LONGUEUR_EVALUATION))}</CommentText>`)
          : await ecrire(a.token, 'AddMemberMessageAAQToPartner', `<ItemID>${item}</ItemID><MemberMessage><RecipientID>${xml(o.buyer.username)}</RecipientID><Subject>${xml(rg.sujet || String(l0.title || 'Commande').slice(0, LONGUEUR_SUJET))}</Subject><Body>${xml(choix.t)}</Body><QuestionType>General</QuestionType><EmailCopyToSender>true</EmailCopyToSender></MemberMessage>`);
        const fin = etat === 'ok' ? 'envoye' : etat === 'refus' ? 'refuse' : 'incertain';
        bilan[fin === 'envoye' ? 'envoyes' : fin === 'refuse' ? 'refuses' : 'incertains']++;
        await modifierDonnee(LIGNE_JOURNAL + sfx, owner, (jd) => {
          const f = { ...((jd && jd.faits) || {}) };
          f[o.orderId] = { ...(f[o.orderId] || {}), [quoi]: { etat: fin, le: maintenant(), v: choix.i } };
          const lignes = [{ le: maintenant(), quoi, orderId: o.orderId, acheteur: o.buyer.username, itemId: item, version: choix.i + 1, etat: fin }, ...((jd && Array.isArray(jd.lignes)) ? jd.lignes : [])].slice(0, JOURNAL_MAX);
          return { ...(jd || {}), faits: f, lignes };
        }).catch(() => null);
      }
    }
    await modifierDonnee(LIGNE_JOURNAL + sfx, owner, (jd) => ({ ...(jd || {}), dernierPassage: { le: now, envoyes: bilan.envoyes, incertains: bilan.incertains, refuses: bilan.refuses, attente: bilan.attente } })).catch(() => null);
    return bilan;
  }

  return { acheteurs, fiche, reglages, regler, exclusLire, exclure, reintegrer, ecrireAcheteur, avis, repondreAvis, litiges, contester, passer, lireLitiges };
}

// Toutes les commandes rangées d'un vendeur (tous ses comptes eBay actifs), `_compte`
// posé — projetées (`orders:data->orders`, jamais `select=data` qui emporte la
// pagination et le reste). Une ligne illisible ⇒ null (pas su).
export function lecteurCommandes({ sbUrl, cle, portee, lireComptes, comptesActifs, fetcher = (...a) => fetchAvecDelai(...a) }) {
  return async (ctx) => {
    const p = await portee(ctx.owner); if (!p || !cle()) return null;
    let reg; try { reg = await lireComptes(ctx.owner); } catch (_) { reg = undefined; }
    if (reg === undefined) return null;
    const actifs = comptesActifs(reg);
    try {
      const r = await fetcher(`${sbUrl}/rest/v1/app_data?id=like.ebay_orders%25${p.filtre}&select=id,orders:data->orders`, { headers: { ...sbCle(cle()) } });
      if (!r.ok) return null;
      const rows = await r.json(); if (!Array.isArray(rows)) return null;
      const out = [], vus = new Set();
      for (const c of actifs) {
        const row = rows.find((x) => x && x.id === 'ebay_orders' + (c.suffixe || ''));
        if (!row) continue;
        if (!Array.isArray(row.orders)) return null;
        const ref = c.principal ? 'principal' : String(c.cle || '');
        for (const o of row.orders) { if (!o || typeof o.orderId !== 'string' || vus.has(o.orderId)) continue; vus.add(o.orderId); out.push({ ...o, _compte: ref }); }
      }
      return out;
    } catch (_) { return null; }
  };
}
export { estExclu, exclusDuSite, raisonBlocage, AUTO_MESSAGE };

// ── LE PASSAGE DU CRON (app fermée) : chaque compte eBay actif du vendeur, avec SON
// jeton et SON site. Ne lève jamais ; le bilan ne porte que des nombres.
export async function passerCrmVendeur(owner, { budgetMs = 20000 } = {}) {
  const E = await import('./ebay.js');
  const { avecMarche, marcheDuCompte, MARCHE_DEFAUT } = await import('./ebay-marches.js');
  if (!E.keysReady()) return { fait: false, raison: 'no-key' };
  let reg; try { reg = await E.lireComptes(owner); } catch (_) { reg = undefined; }
  if (reg === undefined) return { fait: false, raison: 'registre' };
  const crm = creerCrmEbay({ accessToken: (ctx) => E.accessToken(ctx.owner, ctx.compte.suffixe || ''), lireDonnee: E.lireDonnee, modifierDonnee: E.modifierDonnee,
    lireCommandes: lecteurCommandes({ sbUrl: process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co', cle: () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '', portee: E.portee, lireComptes: E.lireComptes, comptesActifs: E.comptesActifs }) });
  const fin = Date.now() + budgetMs, comptes = [];
  for (const c of E.comptesActifs(reg)) {
    if (Date.now() > fin) { comptes.push({ fait: false, raison: 'delai' }); continue; }
    let t;
    try {
      const r = await Promise.race([avecMarche(marcheDuCompte(c) || MARCHE_DEFAUT, () => crm.passer({ owner, compte: c })), new Promise((ok) => { t = setTimeout(() => ok({ fait: false, raison: 'delai' }), Math.max(1000, fin - Date.now())); })]);
      comptes.push({ fait: !!r.fait, envoyes: r.envoyes || 0, incertains: r.incertains || 0, raison: r.raison || null });
    } catch (_) { comptes.push({ fait: false, raison: 'erreur' }); } finally { clearTimeout(t); }
  }
  return { fait: true, comptes };
}
