// ─────────────────────────────────────────────────────────────────────────────
// LES EMAILS DE VENTE VESTIAIRE COLLECTIVE (2 novembre)
//
// Julien : « regarde pour les mails de Vestiaire Collective pour les ventes, je
// veux qu'on les intègre, fais ça bien ». L'email reçu à chaque vente :
//   sujet  « Votre article vient d'être vendu (#72987282) »  ← l'identifiant
//          de l'ANNONCE Vestiaire (productId), la clé de `vc_ventes` ;
//   corps  « Vente confirmée 02/11/26 », « expédiez votre article avant le
//          lundi 9 novembre », « Détails de la vente : Réf : 72987282 · MARQUE ·
//          titre · Envoi Direct · Votre prix de vente : 209,52 € · Vous
//          gagnez : 203,23 € », « Recevez votre paiement 72h après la livraison ».
//
// CE QUI EST LU, ET COMMENT (fonctions PURES, `scripts/audit-vestiaire-email.cjs`) :
//   · l'IDENTITÉ = le n° du SUJET. La « Réf » du corps doit dire le même : deux
//     numéros différents ⇒ rien n'est rangé (« mieux vaut un blanc qu'un faux »,
//     §5), l'email est gardé entier pour vérification. Jamais le titre.
//   · l'ARGENT : « Vous gagnez » est ce que Vestiaire verse (la même valeur que
//     `sellerEarning` lu par l'extension sur la même vente, mesuré le 2 nov.).
//     Euros seulement (signe €) ; absent ou illisible ⇒ `null`, jamais deviné,
//     jamais le prix de vente à sa place.
//   · la DATE LIMITE : « avant le [jour] 9 novembre » ⇒ ce jour-là, 23:59:59
//     heure de PARIS — la forme exacte que l'extension lit chez Vestiaire
//     (`2026-11-09T23:59:59+01:00`). L'année est celle de la vente (le mois
//     d'après si la limite tombe en janvier pour une vente de décembre).
//   · la DATE DE VENTE : « Vente confirmée JJ/MM/AA » ; l'heure de l'email
//     seulement si elle tombe le MÊME jour (Paris), sinon le jour seul.
//   · l'ÉTIQUETTE : `true` seulement si le bouton « Télécharger l'étiquette »
//     est dans l'email. Le LIEN n'est pas gardé : c'est un lien de redirection
//     ou un lien signé qui expire — VRM ne promet pas un lien mort ;
//     l'extension télécharge le PDF elle-même (`vc_label_{productId}`).
//   · la PHOTO : une image de images.vestiairecollective.com dont l'adresse
//     porte le productId (jamais un logo, jamais une autre annonce).
//
// OÙ C'EST RANGÉ : dans LA MÊME vente que celle de l'extension (`vc_ventes.ventes
// [productId]`, la clé que l'extension utilise — mesuré le 2 nov.). Une vente
// déjà lue par l'extension n'est que COMPLÉTÉE (ce qui est vide) : l'email ne
// touche jamais `aExpedier` ni l'état d'une vente connue (un email rejoué ne
// ressuscite pas un colis parti). Une vente inconnue naît « à expédier ».
// Le CA déclaré reste daté au VERSEMENT (`verseLe`) : l'email de vente ne le
// pose pas — la vente est vendue, pas reçue (§5 « Vendu ≠ reçu »).
// ─────────────────────────────────────────────────────────────────────────────
import { montantRecuVc } from './vestiaire-regle.js';

// L'expéditeur (adresse ou nom affiché, l'alias Apple garde les deux). Il ne
// décide JAMAIS du vendeur (c'est l'adresse de réception, §5) : il ne fait que
// choisir la LECTURE.
export const estEmailVestiaire = (mail) => /vestiaire/i.test(String((mail && mail.from) || ''));

// « Votre article vient d'être vendu (#72987282) » (apostrophe droite ou courbe).
const SUJET_VENTE = /Votre article vient d[’'`]?\s*[êe]tre vendu\s*\(\s*#\s*(\d{4,15})\s*\)/i;
export const productIdDuSujet = (sujet) => { const m = SUJET_VENTE.exec(String(sujet || '')); return m ? m[1] : ''; };

// Un montant écrit à la française : « 203,23 € », « 1 203,23 € », « 1.203,23 € »,
// « € 203,23 ». Rend un nombre ou null.
export function nombreFr(s) {
  const t = String(s == null ? '' : s).replace(/[\s  ]/g, '');
  if (!/^\d{1,3}(?:[.]?\d{3})*(?:,\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$/.test(t)) return null;
  const n = /,/.test(t) ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
const CHIFFRE = '(\\d[\\d\\s\\u00a0\\u202f.]*(?:,\\d{1,2})?)';
function montantApres(texte, libelle) {
  const t = String(texte || '');
  const apres = new RegExp(libelle + '\\s*:?\\s*' + CHIFFRE + '\\s*€', 'i').exec(t);
  if (apres) { const v = nombreFr(apres[1]); if (v != null) return { valeur: v, devise: 'EUR' }; }
  const avant = new RegExp(libelle + '\\s*:?\\s*€\\s*' + CHIFFRE, 'i').exec(t);
  if (avant) { const v = nombreFr(avant[1]); if (v != null) return { valeur: v, devise: 'EUR' }; }
  return null;
}

// ── L'HEURE DE PARIS ────────────────────────────────────────────────────────
const MOIS = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
const FMT = (() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (_) { return null; } })();
function partsParis(ms) {
  if (!FMT || !Number.isFinite(ms)) return null;
  const p = {}; for (const x of FMT.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { a: +p.year, m: +p.month, j: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}
const deux = (n) => String(n).padStart(2, '0');
// Le décalage de Paris (« +01:00 » / « +02:00 ») à ce jour-là, à midi.
function decalageParis(a, m, j) {
  const midi = Date.UTC(a, m - 1, j, 12, 0, 0);
  const p = partsParis(midi);
  if (!p) return null;
  const min = Math.round((Date.UTC(p.a, p.m - 1, p.j, p.h, p.mi, p.s) - midi) / 60000);
  return (min >= 0 ? '+' : '-') + deux(Math.floor(Math.abs(min) / 60)) + ':' + deux(Math.abs(min) % 60);
}
const jourValide = (a, m, j) => { const d = new Date(Date.UTC(a, m - 1, j)); return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j; };

// « Vente confirmée 02/11/26 » → { a, m, j } ou null.
export function jourDeVente(texte) {
  const m = /Vente\s+confirm[ée]e\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/i.exec(String(texte || ''));
  if (!m) return null;
  const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const r = { a, m: Number(m[2]), j: Number(m[1]) };
  return jourValide(r.a, r.m, r.j) ? r : null;
}

// « expédiez votre article avant le lundi 9 novembre » → ISO Paris fin de journée.
export function limiteDuTexte(texte, base) {
  const m = /exp[ée]di(?:ez|er)[^.]{0,80}?\bavant\s+le\s+(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})(?:er)?\s+([a-zéû]+)(?:\s+(\d{4}))?/i.exec(String(texte || ''));
  if (!m) return '';
  const mois = MOIS[m[2].toLowerCase()];
  if (!mois) return '';
  const j = Number(m[1]);
  let a = m[3] ? Number(m[3]) : (base && base.a) || 0;
  if (!a) return '';
  if (!m[3] && base && mois < base.m) a += 1;          // vente de décembre, limite en janvier
  if (!jourValide(a, mois, j)) return '';
  const dec = decalageParis(a, mois, j);
  return dec ? `${a}-${deux(mois)}-${deux(j)}T23:59:59${dec}` : '';
}

// Marque et titre (AFFICHAGE seulement, jamais une identité) : les deux lignes
// qui suivent « Réf : N » dans « Détails de la vente ».
const PAS_UN_TITRE = /^(?:R[ée]f\b|Envoi\b|Votre prix|Vous gagnez|Recevez|Paiement|Exp[ée]di|Vente confirm|T[ée]l[ée]charger|D[ée]tails)/i;
export function marqueEtTitre(texte, pid) {
  const lignes = String(texte || '').split(/\n+/).map((l) => l.replace(/[\s ]+/g, ' ').trim()).filter(Boolean);
  const i = lignes.findIndex((l) => new RegExp('R[ée]f\\s*:?\\s*#?' + pid + '\\b', 'i').test(l));
  if (i < 0) return { marque: '', titre: '' };
  const reste = lignes[i].replace(new RegExp('^.*?R[ée]f\\s*:?\\s*#?' + pid + '\\b\\s*', 'i'), '');
  const cands = [reste, ...lignes.slice(i + 1, i + 5)].filter((l) => l && !PAS_UN_TITRE.test(l)).map((l) => l.slice(0, 120));
  return { marque: cands[0] || '', titre: cands[1] || '' };
}

// La photo de CETTE annonce : hôte Vestiaire, adresse qui porte le productId.
export function photoDeLAnnonce(html, pid) {
  const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const src = m[1].replace(/&amp;/g, '&');
    if (/^https:\/\/images\.vestiairecollective\.com\//i.test(src) && new RegExp('(?:^|[^\\d])' + pid + '(?:[^\\d]|$)').test(src.split('?')[0])) return src.slice(0, 500);
  }
  return '';
}

// ── L'EMAIL DE VENTE ────────────────────────────────────────────────────────
// Rend `null` (pas un email de vente Vestiaire), `{ ok: false, raison }` (c'en
// est un, mais rien de sûr à ranger : gardé entier) ou `{ ok: true, vente }`.
// `texte` = le texte utile de l'email (HTML nettoyé) ; `emailAt` = sa date ISO.
export function lireEmailVenteVc(mail, texte, emailAt) {
  if (!estEmailVestiaire(mail)) return null;
  const pid = productIdDuSujet(mail && mail.subject);
  if (!pid) return null;
  const t = String(texte || '');
  const ref = /R[ée]f\s*:?\s*#?\s*(\d{4,15})\b/i.exec(t);
  if (ref && ref[1] !== pid) return { ok: false, raison: `deux références différentes (sujet #${pid}, corps ${ref[1]}) : VRM ne choisit pas` };
  const jour = jourDeVente(t);
  const at = Date.parse(emailAt || '');
  const pAt = Number.isFinite(at) ? partsParis(at) : null;
  let date = '';
  if (jour && pAt && pAt.a === jour.a && pAt.m === jour.m && pAt.j === jour.j) date = new Date(at).toISOString();
  else if (jour) date = `${jour.a}-${deux(jour.m)}-${deux(jour.j)}`;
  else if (pAt) date = new Date(at).toISOString();
  const base = jour || pAt;
  const gain = montantApres(t, 'Vous\\s+gagnez');
  const prix = montantApres(t, 'Votre\\s+prix\\s+de\\s+vente');
  const { marque, titre } = marqueEtTitre(t, pid);
  return {
    ok: true,
    vente: {
      productId: pid,
      refCorps: !!ref,
      date,
      limite: limiteDuTexte(t, base),
      // La clé dit CE QUE c'est : ce que Vestiaire te verse (`montantRecuVc`).
      montant: gain ? { valeur: gain.valeur, devise: gain.devise, cle: 'vousGagnez' } : null,
      prixVente: prix ? { valeur: prix.valeur, devise: prix.devise } : null,
      marque, titre: [marque, titre].filter(Boolean).join(' ').slice(0, 160),
      photo: photoDeLAnnonce(mail && mail.html, pid),
      etiquette: /T[ée]l[ée]charger\s+l[’'`]?\s*[ée]tiquette/i.test(t) ? true : null,
      annulationAuto: /vente sera automatiquement annul[ée]e/i.test(t),
    },
  };
}

// ── LA MÊME VENTE QUE L'EXTENSION ───────────────────────────────────────────
// `cur` = `vc_ventes.data` lu (ou null : la ligne n'existe pas). Rend
// `{ data, change, nouvelle, cle }` ; `data` est à écrire seulement si `change`.
// La vente se retrouve par son IDENTITÉ : la clé = productId, ou une entrée
// rangée sous une autre clé avec le même `productId`.
export function fusionnerVenteEmailVc(cur, vente, maintenant = new Date().toISOString()) {
  const d = cur && typeof cur === 'object' ? cur : {};
  const ventes = { ...((d.ventes && typeof d.ventes === 'object') ? d.ventes : {}) };
  const pid = String(vente.productId);
  const cle = ventes[pid] ? pid : (Object.keys(ventes).find((k) => ventes[k] && String(ventes[k].productId || '') === pid) || pid);
  const prev = ventes[cle];
  if (!prev || typeof prev !== 'object') {
    ventes[cle] = {
      productId: pid, ref: '', etat: '', date: vente.date || '', montant: vente.montant || null,
      limite: vente.limite || '', suivi: '', transporteur: '', titre: vente.titre || '', photo: vente.photo || '',
      etiquette: vente.etiquette === true ? true : null,
      // Une vente que Vestiaire vient d'annoncer est à expédier : l'email le dit.
      // La liste « à expédier » relue EN ENTIER par l'extension la fera sortir
      // (expédiée ou annulée) comme toutes les autres.
      aExpedier: true,
      sources: ['email'], premiereVue: maintenant, compte: '', emailLe: maintenant,
    };
    return { data: { ...d, ventes }, change: true, nouvelle: true, cle };
  }
  const n = { ...prev };
  const vide = (v) => v == null || v === '';
  if (vide(n.date) && vente.date) n.date = vente.date;
  if (vide(n.limite) && vente.limite) n.limite = vente.limite;
  if (vide(n.titre) && vente.titre) n.titre = vente.titre;
  if (vide(n.photo) && vente.photo) n.photo = vente.photo;
  if (n.etiquette !== true && n.etiquette !== false && vente.etiquette === true) n.etiquette = true;
  // Un montant SÛR remplace un montant absent ou pas sûr — jamais un montant sûr.
  if (vente.montant && montantRecuVc(prev).eur == null) n.montant = vente.montant;
  const sources = Array.isArray(prev.sources) ? prev.sources : [];
  if (!sources.includes('email')) n.sources = [...sources, 'email'];
  if (!n.emailLe) n.emailLe = maintenant;
  const change = JSON.stringify(n) !== JSON.stringify(prev);
  if (change) ventes[cle] = n;
  return { data: { ...d, ventes }, change, nouvelle: false, cle };
}
