// ─────────────────────────────────────────────────────────────────────────────
// LES ACHATS LEBONCOIN, EBAY, VESTIAIRE LUS DANS LES E-MAILS (11 nov., lot achats-auto)
//
// Julien (demande validée) : « les achats Leboncoin, eBay, Vestiaire entrent tout
// seuls depuis les e-mails de confirmation, comme ceux de Vinted ».
//
// ⚠️ AUCUNE VRAIE FORME N'A ÉTÉ VUE (mesuré le 11 nov. dans `email_inconnu_*`,
// `email_quarantaine_*`, `email_journal` : aucun e-mail d'achat de ces trois sites
// n'est jamais arrivé). Les lectures ci-dessous sont donc PRUDENTES :
//   · RECONNU = l'expéditeur OFFICIEL du site (domaine exact, l'alias Apple rend
//     le vrai domaine lisible : `demasquerRelais`) ET un SUJET d'achat. Un
//     expéditeur seul, ou un sujet seul (un TRANSFERT « TR: » est écrit par
//     Julien lui-même), ne crée rien : l'e-mail est rangé « à vérifier ».
//   · L'expéditeur ne choisit que la LECTURE, jamais le vendeur : c'est l'adresse
//     de RÉCEPTION qui l'a décidé avant (§5, api/_lib/proprietaire-email.js).
//   · L'IDENTITÉ d'un achat = son n° de COMMANDE, lu seulement derrière son
//     libellé (« N° de commande : … »). Aucun n°, ou deux n° différents ⇒ « à
//     vérifier », RIEN créé. Jamais le titre (§5 : mieux vaut un blanc qu'un faux).
//   · Les montants sont lus derrière LEUR libellé, en euros seulement ; un libellé
//     qui porte deux valeurs différentes, une autre devise, ou un total qui ne
//     colle pas avec article + port + protection ⇒ « à vérifier ».
//   · Un e-mail de VENDEUR (« vous avez vendu », « votre acheteur », « expédiez »)
//     n'est pas un achat : `null`, le flux continue comme avant.
//   · Rien de personnel n'est rangé : ni adresse, ni nom, ni texte brut — le
//     titre de l'article (un libellé, jamais une identité), les montants, le n°.
// Pur : aucune lecture, aucune écriture. Banc : scripts/audit-achats-email.cjs
// (exécute la vraie route avec des e-mails INVENTÉS).
// ─────────────────────────────────────────────────────────────────────────────

export const SITES_ACHAT = ['leboncoin', 'ebay', 'vestiaire'];

// L'expéditeur OFFICIEL, domaine exact (adresse entre chevrons, nue, ou rendue
// par `demasquerRelais` entre parenthèses). Jamais un simple mot dans le nom affiché.
const DOMAINES = {
  leboncoin: /@(?:[a-z0-9-]+\.)*leboncoin\.fr\b/i,
  ebay: /@(?:[a-z0-9-]+\.)*ebay\.(?:fr|com|co\.uk|de|it|es|be|ch)\b/i,
  vestiaire: /@(?:[a-z0-9-]+\.)*vestiairecollective\.com\b/i,
};
export function siteDeLExpediteur(from) {
  const f = String(from || '');
  for (const s of SITES_ACHAT) if (DOMAINES[s].test(f)) return s;
  return '';
}

// Un TRANSFERT écrit par lui-même : « TR: », « Fwd: », ou l'en-tête de transfert
// dans le corps. Le site est alors celui de l'en-tête « De : » transféré — une
// lecture pour l'aider, jamais une création (le transfert est écrit par lui).
const PREFIXE_TRANSFERT = /^\s*(?:(?:tr|fwd?|fw|wg)\s*:\s*)+/i;
const ENTETE_TRANSFERT = /(?:-{2,}\s*(?:Forwarded message|Message transf[ée]r[ée]|Original Message|Message d[’']origine)\s*-{2,}|D[ée]but du message r[ée]exp[ée]di[ée])/i;
function siteTransfere(texte) {
  const t = String(texte || '');
  const i = t.search(ENTETE_TRANSFERT);
  const bloc = i >= 0 ? t.slice(i, i + 800) : '';
  const de = /(?:^|\n)\s*\*?(?:De|From)\s*:\*?\s*([^\n]{3,200})/i.exec(bloc);
  return de ? siteDeLExpediteur(de[1]) : '';
}

// ── LES SUJETS (supposés : à confronter au premier vrai e-mail) ─────────────
// Famille d'un achat : confirmation · expedition · annulation · remboursement.
const SUJETS = {
  confirmation: [
    /\b(?:confirmation\s+de\s+(?:votre|ta)\s+(?:commande|achat)|(?:votre|ta)\s+(?:commande|achat)\s+(?:est|a\s+[ée]t[ée])\s+confirm[ée]e?|commande\s+confirm[ée]e|merci\s+pour\s+(?:votre|ton)\s+(?:achat|commande)|(?:votre|ton)\s+paiement\s+a\s+(?:bien\s+)?[ée]t[ée]\s+(?:accept[ée]|valid[ée]|pris\s+en\s+compte)|order\s+confirmed|you\s+bought)(?![a-zà-ÿ])/i,
  ],
  expedition: [
    /\b(?:(?:votre|ton)\s+(?:commande|achat|colis|objet|article)\s+(?:a\s+[ée]t[ée]|est)\s+(?:exp[ée]di[ée]e?|envoy[ée]e?|en\s+route)|(?:votre|ton)\s+colis\s+est\s+en\s+chemin|your\s+(?:order|item)\s+(?:has\s+)?shipped)(?![a-zà-ÿ])/i,
  ],
  annulation: [
    /\b(?:(?:votre|ta)\s+(?:commande|achat|transaction)\s+(?:a\s+[ée]t[ée]|est)\s+annul[ée]e?|annulation\s+de\s+(?:votre|ta)\s+(?:commande|achat)|order\s+(?:was\s+)?cancel+ed)(?![a-zà-ÿ])/i,
  ],
  remboursement: [
    /\b(?:(?:vous\s+avez|tu\s+as)\s+[ée]t[ée]\s+rembours[ée]|(?:votre|ton)\s+remboursement|remboursement\s+(?:de\s+(?:votre|ta)\s+commande|effectu[ée]|confirm[ée])|(?:votre|ta)\s+commande\s+a\s+[ée]t[ée]\s+rembours[ée]e|refund\s+(?:issued|confirmed))(?![a-zà-ÿ])/i,
  ],
};
// Un e-mail de VENDEUR n'est jamais un achat (Vestiaire « Votre article vient
// d'être vendu », eBay « Vous avez vendu », Leboncoin « Expédiez … »).
const VENDEUR = /\b(?:vous\s+avez\s+vendu|tu\s+as\s+vendu|vient\s+d[’'`]?\s*[êe]tre\s+vendu|votre\s+acheteur|ton\s+acheteur|exp[ée]diez|exp[ée]die\s+(?:ton|le)\s+colis|mis\s+en\s+vente|nouvelle\s+offre|offre\s+re[çc]ue|you\s+sold)\b/i;

export function familleDuSujet(sujet) {
  const s = String(sujet || '').replace(PREFIXE_TRANSFERT, '');
  if (!s || VENDEUR.test(s)) return '';
  for (const f of ['remboursement', 'annulation', 'expedition', 'confirmation']) if (SUJETS[f].some((re) => re.test(s))) return f;
  return '';
}

// ── LE N° DE COMMANDE (libellé seulement) ────────────────────────────────────
const LIB_COMMANDE = /(?:n[°ºo]\.?\s*(?:de\s+)?(?:la\s+)?commande|num[ée]ro\s+(?:de\s+)?(?:la\s+)?commande|r[ée]f[ée]rence\s+(?:de\s+)?(?:la\s+)?commande|commande\s+n[°ºo]\.?|order\s+(?:number|no\.?|#)|n[°ºo]\s+de\s+transaction|num[ée]ro\s+de\s+transaction)\s*:?\s*#?\s*([A-Z0-9][A-Z0-9-]{4,29})\b/gi;
export const normaliserNumero = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
export function numerosDeCommande(texte) {
  const vus = new Map();
  let m;
  const t = String(texte || '');
  LIB_COMMANDE.lastIndex = 0;
  while ((m = LIB_COMMANDE.exec(t))) {
    const brut = m[1].replace(/-+$/, '');
    if (!/\d/.test(brut)) continue;                        // « commande : confirmée » n'est pas un n°
    const k = normaliserNumero(brut);
    if (k.length >= 5 && !vus.has(k)) vus.set(k, brut);
  }
  return [...vus.values()];
}

// ── LES MONTANTS (libellé, euros) ────────────────────────────────────────────
export function nombreFr(s) {
  const t = String(s == null ? '' : s).replace(/[\s  ]/g, '');
  if (!/^\d{1,3}(?:[.]?\d{3})*(?:,\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$/.test(t)) return null;
  const n = /,/.test(t) ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
const CHIFFRE = '(\\d[\\d\\s\\u00a0\\u202f.]*(?:,\\d{1,2})?)';
const AUTRE_DEVISE = /(?:£|\$|\bGBP\b|\bUSD\b|\bCHF\b)/;
// Toutes les valeurs écrites derrière ce libellé, sur SA ligne. `gratuit` = 0.
// Rend { valeurs:[…], autreDevise:bool }.
function valeursApres(texte, libelle) {
  const out = { valeurs: [], autreDevise: false };
  for (const ligne of String(texte || '').split(/\n+/)) {
    const re = new RegExp('(?:^|[\\s*|>(])' + libelle + '\\s*\\*?\\s*:?\\s*\\*?\\s*([^\\n]{0,40})', 'i');
    const m = re.exec(ligne);
    if (!m) continue;
    const apres = m[1];
    if (/^\s*gratuit/i.test(apres)) { out.valeurs.push(0); continue; }
    const e1 = new RegExp('^\\s*' + CHIFFRE + '\\s*(?:€|EUR\\b)', 'i').exec(apres);
    const e2 = new RegExp('^\\s*(?:€|EUR)\\s*' + CHIFFRE, 'i').exec(apres);
    const v = e1 ? nombreFr(e1[1]) : e2 ? nombreFr(e2[1]) : null;
    if (v != null) { out.valeurs.push(v); continue; }
    if (AUTRE_DEVISE.test(apres.slice(0, 20))) out.autreDevise = true;
  }
  return out;
}
const LIBELLES = {
  article: "(?:prix\\s+de\\s+l[’']?\\s*(?:article|objet)|prix\\s+(?:de\\s+l[’']?\\s*)?achat|sous-total|prix\\s+de\\s+l[’']?annonce|montant\\s+de\\s+l[’']?article)",
  port: '(?:frais\\s+de\\s+(?:port|livraison|envoi)|livraison|exp[ée]dition|port)',
  protection: "(?:protection\\s+(?:acheteurs?|achats?)|frais\\s+de\\s+(?:protection|service|gestion)|frais\\s+d[’']authentification|authentification|garantie\\s+client)",
  total: '(?:total\\s+(?:pay[ée]|d[ée]bit[ée]|TTC|de\\s+la\\s+commande)|montant\\s+(?:total|pay[ée]|d[ée]bit[ée])|total)',
};

// ── LE TITRE (un libellé, jamais une identité) ───────────────────────────────
const LIB_TITRE = /(?:^|\n)\s*\*?(?:article|objet|annonce|produit)\s*\*?\s*:\s*\*?\s*([^\n]{2,160})/i;
function titreLu(texte, sujet) {
  const m = LIB_TITRE.exec(String(texte || ''));
  if (m) return m[1].replace(/\*/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
  // « Commande confirmée : Nike Air Max 90 » (le titre après les deux-points du sujet)
  const s = String(sujet || '').replace(PREFIXE_TRANSFERT, '');
  const d = /:\s*(.{3,140})$/.exec(s);
  return d && !/\d{5,}/.test(d[1]) ? d[1].replace(/[«»"]/g, '').trim().slice(0, 140) : '';
}

// ── LA PHOTO (une seule image produit du CDN du site, sinon rien) ────────────
const CDN = {
  leboncoin: /^https:\/\/img\.leboncoin\.fr\//i,
  ebay: /^https:\/\/i\.ebayimg\.com\/(?:images|thumbs|00)\//i,
  vestiaire: /^https:\/\/images\.vestiairecollective\.com\//i,
};
export function photoProduit(html, site) {
  const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  const vues = new Map();
  let m;
  while ((m = re.exec(String(html || '')))) {
    const src = m[1].replace(/&amp;/g, '&');
    if (!CDN[site] || !CDN[site].test(src) || /logo|icon|picto|badge|avatar|pixel|tracking/i.test(src)) continue;
    // Les tailles d'une même image eBay (s-l140, s-l500) sont UNE image.
    const k = src.split('?')[0].replace(/\/s-l\d+\./i, '/s-l.');
    if (!vues.has(k)) vues.set(k, src.slice(0, 500));
  }
  return vues.size === 1 ? [...vues.values()][0] : '';
}

// ── LE SUIVI (libellé ; relié par le n° de commande, jamais autrement) ──────
const LIB_SUIVI = /(?:n[°ºo]\.?\s*de\s+suivi|num[ée]ro\s+de\s+suivi|tracking\s+(?:number|no\.?))\s*:?\s*([A-Z0-9]{8,34})\b/gi;
function suivisLus(texte) {
  const vus = new Set(); let m; LIB_SUIVI.lastIndex = 0;
  while ((m = LIB_SUIVI.exec(String(texte || '')))) if (/\d/.test(m[1])) vus.add(m[1].toUpperCase());
  return [...vus];
}

// La date de commande libellée (« Date de commande : 10/11/2026 »), sinon le jour de l'e-mail.
function dateLue(texte, emailAt) {
  const m = /date\s+(?:de\s+(?:la\s+)?)?(?:commande|l[’']?achat|paiement)\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/i.exec(String(texte || ''));
  if (m) {
    const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(Date.UTC(a, Number(m[2]) - 1, Number(m[1])));
    if (d.getUTCDate() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1) return { date: d.toISOString().slice(0, 10), source: 'email-libelle' };
  }
  const t = Date.parse(emailAt || '');
  return Number.isFinite(t) ? { date: new Date(t).toISOString(), source: 'email-date' } : { date: '', source: '' };
}

// ── LA LECTURE ───────────────────────────────────────────────────────────────
// Rend :
//   null                           pas un e-mail d'achat de ces sites (le flux continue) ;
//   { ok:false, site, famille, aVerifier:true, raison, lecture }   rangé « à vérifier », rien créé ;
//   { ok:true, site, famille, achat }                              achat à créer / compléter.
export function lireEmailAchat(mail, texte, emailAt) {
  const sujet = String((mail && mail.subject) || '');
  const t = String(texte || '');
  const siteExp = siteDeLExpediteur(mail && mail.from);
  const transfert = PREFIXE_TRANSFERT.test(sujet) || ENTETE_TRANSFERT.test(t);
  const site = siteExp || (transfert ? siteTransfere(t) : '');
  if (!site) return null;
  const famille = familleDuSujet(sujet);
  if (!famille) return null;                               // autre e-mail du site : chemin d'avant
  const numeros = numerosDeCommande(sujet + '\n' + t);
  const lecture = { site, famille, numeros: numeros.slice(0, 4), titre: titreLu(t, sujet) };
  const aVerifier = (raison) => ({ ok: false, site, famille, aVerifier: true, raison, lecture });
  if (!siteExp || transfert) return aVerifier("e-mail transféré : l'expéditeur officiel n'est pas lisible, VRM ne crée rien");
  if (numeros.length === 0) return aVerifier('aucun n° de commande lisible : VRM ne rapproche jamais par le titre');
  if (numeros.length > 1) return aVerifier(`deux n° de commande différents (${numeros.slice(0, 2).join(', ')}) : VRM ne choisit pas`);
  const prix = {};
  for (const k of ['article', 'port', 'protection', 'total']) {
    const v = valeursApres(t, LIBELLES[k]);
    if (v.autreDevise) return aVerifier('montant dans une autre devise : VRM reste en euros');
    const distincts = [...new Set(v.valeurs)];
    if (distincts.length > 1) return aVerifier(`deux montants différents pour « ${k} » : VRM ne choisit pas`);
    prix[k] = distincts.length ? distincts[0] : null;
  }
  // « Livraison » ne vaut rien sans autre montant : un total seul est le prix payé.
  if (prix.total != null && prix.article != null) {
    const somme = Math.round(((prix.article || 0) + (prix.port || 0) + (prix.protection || 0)) * 100) / 100;
    if (Math.abs(somme - prix.total) > 0.011) return aVerifier(`le total (${prix.total} €) ne colle pas avec article + port + protection (${somme} €)`);
  }
  const paye = prix.total != null ? prix.total
    : (prix.article != null ? Math.round(((prix.article || 0) + (prix.port || 0) + (prix.protection || 0)) * 100) / 100 : null);
  const suivis = suivisLus(t);
  const d = dateLue(t, emailAt);
  return {
    ok: true, site, famille,
    achat: {
      site, commande: numeros[0], cle: normaliserNumero(numeros[0]),
      titre: lecture.titre, date: d.date, dateSource: d.source,
      prix: { article: prix.article, port: prix.port, protection: prix.protection, total: paye, devise: 'EUR', source: 'email' },
      photo: photoProduit(mail && mail.html, site),
      suivi: suivis.length === 1 ? suivis[0] : '',
    },
  };
}

// L'id de la ligne : UN achat par site et n° de commande (rejeu, deux e-mails,
// deux adresses ⇒ la même ligne).
export const idAchatEmail = (site, cle) => `achat_email_${site}_${normaliserNumero(cle)}`;
export const PREFIXE_ACHAT_EMAIL = 'achat_email_';
export const PREFIXE_A_VERIFIER = 'achat_email_verif_';

// ── LA FUSION (comparer-et-échanger) ─────────────────────────────────────────
// Remplit ce qui est VIDE, ne remplace jamais une valeur connue (le désaccord est
// noté), même messageId ⇒ rien ; annulé / remboursé restent posés (collants).
// Rend `undefined` quand rien ne change (modifierCas n'écrit rien).
export function fusionAchatEmail(cur, lu, { famille, messageId = '', at = new Date().toISOString() } = {}) {
  const d = cur && typeof cur === 'object' ? cur : null;
  const mid = String(messageId || '').slice(0, 300);
  if (d && mid && Array.isArray(d.emails) && d.emails.some((e) => e && e.messageId === mid)) return undefined;
  const base = d ? { ...d } : { site: lu.site, commande: lu.commande, cle: lu.cle, titre: '', date: '', dateSource: '', prix: { article: null, port: null, protection: null, total: null, devise: 'EUR', source: 'email' }, photo: '', suivi: '', annule: '', rembourse: '', desaccords: [], emails: [], premiereVue: at };
  const prix = { ...(base.prix || {}) };
  const desaccords = Array.isArray(base.desaccords) ? [...base.desaccords] : [];
  for (const k of ['article', 'port', 'protection', 'total']) {
    const v = lu.prix ? lu.prix[k] : null;
    if (v == null) continue;
    if (prix[k] == null) prix[k] = v;
    else if (Math.abs(prix[k] - v) > 0.001 && !desaccords.includes('prix.' + k)) desaccords.push('prix.' + k);
  }
  const champ = (k) => { const v = lu[k]; if (!v) return; if (!base[k]) base[k] = v; else if (base[k] !== v && k !== 'titre' && !desaccords.includes(k)) desaccords.push(k); };
  ['titre', 'photo', 'suivi'].forEach(champ);
  if (!base.date && lu.date) { base.date = lu.date; base.dateSource = lu.dateSource; }
  if (famille === 'annulation' && !base.annule) base.annule = at;
  if (famille === 'remboursement' && !base.rembourse) base.rembourse = at;
  const emails = [...(Array.isArray(base.emails) ? base.emails : []), { famille, messageId: mid, at }].slice(-20);
  return { ...base, prix, desaccords: desaccords.slice(0, 10), emails, vuLe: at };
}
