// ─────────────────────────────────────────────────────────────────────────────
// LES AUTRES E-MAILS DE VESTIAIRE COLLECTIVE (9 nov.) — rappel d'envoi, annonce
// en attente / en ligne, offres, marketing. La vente elle-même : vestiaire-email.js.
//
// Formes RÉELLES (captures iPhone de Julien, 9 nov. ; valeurs FABRIQUÉES dans les audits) :
//   · « Il vous reste 6 jours pour expédier votre vente (#N) » — « Expédiez votre
//     article avant le lundi 9 novembre, ou votre vente sera automatiquement
//     annulée. » (CONDITION : ne constate rien) ; « Ref : N » ; bloc article.
//   · « Annonce en attente de validation » — « Ref : N », MARQUE, titre,
//     « Prix de vente : 144 € », « Pour vous : 115,20 € ».
//   · « Votre Bottes cavalières Dior vient d'être mis en ligne » — « Ref: N »,
//     « Prix: 144 € », « Vous gagnez: 115,20 € ».
//   · « Pseudo a fait une contre-offre » — « Contre-offre reçue : 114,29 € », 48 h.
//   · « Pseudo a accepté votre offre ! » — « Offre acceptée : 120 € », l'acheteur a
//     24 h pour commander : ce n'est PAS une vente.
//   · « Augmentez vos chances de vendre » — marketing : conservé (le journal garde
//     le texte), rien n'en est tiré (pas de prix conseillé : refus du 11 oct.).
//
// RÈGLES :
//   · le classement se lit sur le SUJET d'abord ;
//   · l'IDENTITÉ = la réf « #N » du sujet = la « Ref » du corps (le productId, la
//     clé de `vc_ventes` et des annonces de l'extension) ; deux réf différentes ⇒
//     rien rangé (gardé pour vérification) ; jamais un titre ;
//   · les OFFRES n'ont pas de réf : jamais rattachées à une annonce ; le pseudo de
//     l'acheteur (et le prénom du vendeur) ne sont JAMAIS rangés (règle vcoffres) ;
//     le lien « Répondre à l'offre » n'est pas une identité tant que sa forme n'est
//     pas mesurée : seule sa FORME (chiffres masqués) est notée, pour la mesurer ;
//   · « Vous gagnez / Pour vous » = ce qui SERA versé, jamais « reçu » (§5).
// ─────────────────────────────────────────────────────────────────────────────
import { limiteDuTexte, marqueEtTitre, nombreFr, estEmailVestiaire } from './vestiaire-email.js';

const SUJETS = [
  ['rappel', /Il\s+vous\s+reste\s+\d+\s+jours?\s+pour\s+exp[ée]dier\s+votre\s+vente\s*\(\s*#\s*(\d{4,15})\s*\)/i],
  ['attente', /^\s*(?:TR\s*:\s*|Fwd?\s*:\s*)?Annonce\s+en\s+attente\s+de\s+validation\b/i],
  ['en_ligne', /\bvient\s+d['’`]?\s*[êe]tre\s+mise?\s+en\s+ligne\b/i],
  ['contre_offre', /\ba\s+fait\s+une\s+contre[- ]?offre\b/i],
  ['offre_acceptee', /\ba\s+accept[ée]\s+votre\s+offre\b/i],
  ['marketing', /Augmentez\s+vos\s+chances\s+de\s+vendre/i],
];
export function classerEmailVc(sujet) {
  const s = String(sujet || '');
  for (const [type, re] of SUJETS) { const m = re.exec(s); if (m) return { type, pid: m[1] || '' }; }
  return null;
}

const FMT = (() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (_) { return null; } })();
const baseParis = (iso) => {
  const ms = Date.parse(String(iso || ''));
  if (!FMT || !Number.isFinite(ms)) return null;
  const p = {}; for (const x of FMT.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { a: +p.year, m: +p.month, j: +p.day };
};
const CHIFFRE = '(\\d[\\d\\s\\u00a0\\u202f.]*(?:,\\d{1,2})?)';
const montant = (t, libelle) => { const m = new RegExp(libelle + '\\s*:?\\s*' + CHIFFRE + '\\s*€', 'i').exec(String(t || '')); const v = m ? nombreFr(m[1]) : null; return v == null ? null : v; };
const refsDuCorps = (t) => [...new Set([...String(t || '').matchAll(/R[ée]f\s*:?\s*#?\s*(\d{4,15})\b/gi)].map((m) => m[1]))];

// La FORME du lien « Répondre à l'offre » (hôte + chemin, chiffres masqués, sans requête) — pour la mesurer.
export function formeLienOffre(html) {
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    if (!/R[ée]pondre\s+[àa]\s+l['’]offre/i.test(m[2].replace(/<[^>]+>/g, ' '))) continue;
    try { const u = new URL(m[1].replace(/&amp;/g, '&')); return (u.host + u.pathname).replace(/\d/g, '#').replace(/[A-Za-z0-9_-]{24,}/g, '…').slice(0, 120); } catch (_) { return ''; }
  }
  return '';
}

// Rend null (pas un de ces e-mails), { ok: false, raison } (reconnu, rien de sûr : gardé),
// ou { ok: true, type, ... } — jamais un pseudo, jamais un prénom.
export function lireEmailVcAutre(mail, texte, emailAt) {
  if (!estEmailVestiaire(mail)) return null;
  const c = classerEmailVc(mail && mail.subject);
  if (!c) return null;
  const t = String(texte || '');
  const refs = refsDuCorps(t);
  if (c.type === 'marketing') return { ok: true, type: 'marketing' };
  if (c.type === 'rappel') {
    if (refs.length > 1 || (refs.length === 1 && refs[0] !== c.pid)) return { ok: false, raison: `rappel : deux références différentes (sujet #${c.pid}, corps ${refs.join('/')}) : VRM ne choisit pas` };
    const base = baseParis(emailAt);
    const limite = base ? limiteDuTexte(t, base) : '';
    const { marque, titre } = marqueEtTitre(t, c.pid);
    return { ok: true, type: 'rappel', productId: c.pid, limite, marque, titre: [marque, titre].filter(Boolean).join(' ').slice(0, 160) };
  }
  if (c.type === 'attente' || c.type === 'en_ligne') {
    if (refs.length !== 1) return { ok: false, raison: refs.length ? 'annonce : deux références différentes : VRM ne choisit pas' : 'annonce : aucune référence lue' };
    const pid = refs[0];
    const { marque, titre } = marqueEtTitre(t, pid);
    return { ok: true, type: c.type, productId: pid, marque, titre,
      prix: montant(t, '(?:Prix\\s+de\\s+vente|Prix)'), gain: montant(t, '(?:Vous\\s+gagnez|Pour\\s+vous)') };
  }
  // Les offres : montant + échéance, rien sur l'acheteur.
  const at = Date.parse(emailAt || '');
  const contre = c.type === 'contre_offre';
  const m = montant(t, contre ? 'Contre[- ]?offre\\s+re[çc]ue' : 'Offre\\s+accept[ée]e');
  if (m == null) return { ok: false, raison: (contre ? 'contre-offre' : 'offre acceptée') + ' : montant illisible' };
  return { ok: true, type: c.type, montant: m, devise: 'EUR',
    echeance: Number.isFinite(at) ? new Date(at + (contre ? 48 : 24) * 3600e3).toISOString() : '',
    lienForme: formeLienOffre(mail && mail.html) };
}

// ── LE RANGEMENT (pur) ───────────────────────────────────────────────────────
// Annonces : `vc_email_annonces` = { annonces: { pid: { etat, at, prix, gain, marque, titre } } }.
export function fusionAnnonceVc(cur, lu, at) {
  const d = cur && typeof cur === 'object' ? cur : {};
  const annonces = { ...(d.annonces && typeof d.annonces === 'object' ? d.annonces : {}) };
  const prev = annonces[lu.productId] || {};
  // « en ligne » ne redescend jamais en « attente » (un e-mail rejoué ou en retard).
  const etat = prev.etat === 'en_ligne' && lu.type === 'attente' ? 'en_ligne' : lu.type;
  const vide = (v) => v == null || v === '';
  annonces[lu.productId] = { ...prev, etat, [lu.type === 'attente' ? 'attenteLe' : 'enLigneLe']: prev[lu.type === 'attente' ? 'attenteLe' : 'enLigneLe'] || at,
    prix: lu.prix != null ? lu.prix : (prev.prix != null ? prev.prix : null), gain: lu.gain != null ? lu.gain : (prev.gain != null ? prev.gain : null),
    marque: lu.marque || prev.marque || '', titre: lu.titre || prev.titre || '' };
  if (vide(annonces[lu.productId].marque)) delete annonces[lu.productId].marque;
  return { ...d, v: 1, annonces };
}
// Offres : `vc_email_offres` = { offres: { cle: { type, montant, devise, at, echeance, lienForme } } }, 100 au plus.
export function fusionOffreVc(cur, cle, lu, at) {
  const d = cur && typeof cur === 'object' ? cur : {};
  const offres = { ...(d.offres && typeof d.offres === 'object' ? d.offres : {}) };
  offres[cle] = { type: lu.type, montant: lu.montant, devise: lu.devise, at, echeance: lu.echeance, ...(lu.lienForme ? { lienForme: lu.lienForme } : {}) };
  const cles = Object.keys(offres);
  if (cles.length > 100) cles.sort((a, b) => String(offres[a].at).localeCompare(String(offres[b].at))).slice(0, cles.length - 100).forEach((k) => delete offres[k]);
  return { ...d, v: 1, offres };
}
