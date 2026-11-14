import { jourParis } from './dateParis.js';
// ═══════════════════════════════════════════════════════════════════════════
// LE DOSSIER DE LITIGE EN UN PDF (10 nov., lot BJ)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé, « peu de texte, du visuel ») : sur chaque carte de « Litiges en
// cours », un PDF à envoyer au service client — fabriqué DANS LE NAVIGATEUR
// (pdf-lib, déjà dans le dépôt, MIT ; aucun service, aucune clé, §2.9). Rien
// n'est envoyé : il télécharge ou partage le fichier lui-même.
//
// Ce qu'il porte — tout par IDENTITÉ (§5), rien de redécidé :
//   · le N° (ou « Sans N° »), le titre, le compte, la date de vente, le n° de
//     transaction, ce qui se passe (la ligne de src/litiges.js) ;
//   · la photo de SON annonce et la photo du carton fermé (src/photoCarton.js,
//     par la transaction) quand elle est rangée ;
//   · le bordereau : son n° de suivi et sa date ; la page du bordereau elle-même
//     seulement s'il le demande (elle porte l'adresse de l'acheteur) ;
//   · le suivi daté : les étapes PROUVÉES de la frise (src/friseProuvee.js),
//     jamais une étape « pas lue » présentée comme faite.
// Ce qu'il ne porte JAMAIS : rien de l'acheteur (ni pseudo, ni nom, ni adresse) —
// `contenuDossierLitige` construit le contenu par une LISTE BLANCHE de champs ;
// la vente brute n'est jamais recopiée.
// « Pas su » ≠ « non » : une photo pas récupérée est DITE (« pas récupérée »),
// une étape pas lue n'est pas listée, une date absente s'écrit « — ».
// `contenuDossierLitige`, `nomFichierDossier` : PURS. `pdfDossierLitige` charge
// pdf-lib. `imageEnOctets` : navigateur seulement. Audit :
// scripts/audit-dossier-litige.cjs.

const str = (v) => String(v == null ? '' : v).trim();
const _jour = (() => { try { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' }); } catch (_) { return null; } })();
const _heure = (() => { try { return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }); } catch (_) { return null; } })();
const ms = (v) => { if (typeof v === 'number') return Number.isFinite(v) && v > 1e11 ? v : null; const t = Date.parse(str(v)); return Number.isFinite(t) ? t : null; };
export const jourDossier = (v) => { const t = ms(v); if (t == null) return ''; try { return _jour ? _jour.format(new Date(t)) : jourParis(t); } catch (_) { return ''; } };
const jourHeure = (v) => { const t = ms(v); if (t == null) return ''; const j = jourDossier(t); try { return _heure ? `${j}, ${_heure.format(new Date(t))}` : j; } catch (_) { return j; } };
const NOM_PLATEFORME = { vinted: 'Vinted', ebay: 'eBay', leboncoin: 'Leboncoin', vestiaire: 'Vestiaire Collective' };

// ── (14 nov., lot 126) LES ÉCHANGES DE LA VENTE ────────────────────────────
// La conversation Vinted de CETTE vente, reliée par SON n° de transaction
// (`conversation.transaction.id`, égalité exacte — jamais le titre, §5). `convs` :
// les lignes `harvest_*_conv_*` projetées { tx, opp, messages } (jamais `select=data`).
// Rend [{ de: 'toi'|'acheteur'|'vinted'|'inconnu', quand, texte }] (les 40 derniers, dans l'ordre),
// [] si la conversation est lue sans message, ou null si AUCUNE conversation de
// cette transaction n'a été lue (« pas lue », dit dans le PDF — jamais « aucun échange »).
// ⚠️ Rien de l'acheteur : ni pseudo ni identifiant — « l'acheteur », c'est tout.
export const ECHANGES_MAX = 40;
export function echangesDossier(convs, tx) {
  const t = str(tx);
  if (!t || !/^\d{1,20}$/.test(t)) return null;
  const miennes = (Array.isArray(convs) ? convs : []).filter((c) => c && str(c.tx) === t);
  if (!miennes.length) return null;
  const out = [];
  for (const c of miennes) {
    const opp = str(c.opp);
    for (const m of Array.isArray(c.messages) ? c.messages : []) {
      const e = (m && m.entity) || m || {};
      const corps = str(e.body);
      if (!corps) continue;
      const auteur = str(e.user_id != null ? e.user_id : m && m.user_id);
      const v = m && (m.created_at_ts ?? e.created_at_ts ?? m.created_at ?? e.created_at);
      const n = Number(v);
      const at = v == null ? null : Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : (Date.parse(v) || null);
      out.push({ de: !auteur ? 'vinted' : !opp ? 'inconnu' : auteur === opp ? 'acheteur' : 'toi', at, texte: corps.replace(/\s+/g, ' ').slice(0, 600) });
    }
  }
  out.sort((a, b) => (a.at || 0) - (b.at || 0));
  return out.slice(-ECHANGES_MAX).map((x) => ({ de: x.de, quand: x.at ? jourHeure(x.at) : 'date non lue', texte: x.texte }));
}

// ── LE CONTENU (pur) ────────────────────────────────────────────────────────
// carte    : la carte de l'écran Litiges (src/litigesEcran.js `litigesDesVentes`) ;
// vente    : { date } — SEULE la date de vente est lue de la vente ;
// compte   : le nom du compte VENDEUR (le sien) ;
// frise    : `friseProuvee(...)` de la vente, ou null (pas su) ;
// bordereau: { suivi, at } du bordereau de la vente, ou null ;
// photos   : { annonce: 'ok'|'absente'|'ratee', carton: 'ok'|'absente'|'passu' } ;
// avecBordereau : la page du bordereau est jointe (son choix).
// echanges : `echangesDossier(...)` (14 nov., lot 126) — [] lus sans message, null pas lus, undefined pas demandés.
export function contenuDossierLitige({ carte, vente = null, compte = '', frise = null, bordereau = null, photos = {}, avecBordereau = false, echanges, maintenant = Date.now() } = {}) {
  const c = carte || {};
  const num = str(c.num);
  const plateforme = NOM_PLATEFORME[c.plateforme] || 'Vinted';
  const situation = [str(c.libelle) || 'Litige', str(c.etape)].filter(Boolean).join(' · ');
  const identite = [
    ['Article', str(c.titre) || '—'],
    ['Compte vendeur', `${str(compte) || '—'} (${plateforme})`],
    ['Date de vente', jourDossier(vente && vente.date) || '—'],
    ['N° de transaction', str(c.tx) || '—'],
    ['Situation', situation],
    ['Date limite', c.limiteTexte ? `avant le ${str(c.limiteTexte)}` : 'non lue'],
  ];
  const suivi = str(bordereau && bordereau.suivi);
  const bord = bordereau ? [
    ['N° de suivi', suivi || '—'],
    ['Bordereau reçu le', jourDossier(bordereau.at) || '—'],
  ] : null;
  // Les étapes PROUVÉES seulement, dans l'ordre de la frise, avec leur date (« date non lue » sinon).
  const etapes = frise && Array.isArray(frise.etapes)
    ? frise.etapes.filter((e) => e && e.etat === 'fait').map((e) => ({ cle: str(e.cle), label: str(e.label), quand: e.t != null ? jourHeure(e.t) : 'date non lue' }))
    : null;
  const bif = frise && frise.bifurcation && frise.bifurcation.libelle ? [str(frise.bifurcation.libelle), str(frise.bifurcation.sous)].filter(Boolean).join(' · ') : '';
  return {
    titre: num ? `Dossier N°${num}` : 'Dossier · sans N°', num, plateforme,
    identite, bordereau: bord, avecBordereau: !!avecBordereau,
    etapes, bifurcation: bif,
    photos: { annonce: photos.annonce || 'absente', carton: photos.carton || 'absente' },
    etabliLe: jourHeure(maintenant),
    ...(echanges !== undefined ? { echanges: Array.isArray(echanges) ? echanges.slice(-ECHANGES_MAX).map((e) => ({ de: ['toi', 'acheteur', 'vinted', 'inconnu'].includes(e && e.de) ? e.de : 'inconnu', quand: str(e && e.quand) || 'date non lue', texte: str(e && e.texte).slice(0, 600) })) : null } : {}),
  };
}

export function nomFichierDossier(contenu, maintenant = Date.now()) {
  const n = str(contenu && contenu.num).replace(/[^A-Za-z0-9]+/g, '') || 'sans-numero';
  let d = '';
  try { d = jourParis(maintenant); } catch (_) {}
  return `dossier-litige-${n}${d ? '-' + d : ''}.pdf`;
}

const PHRASE_PHOTO = { absente: 'aucune rangée', ratee: 'pas récupérée', passu: 'pas lue' };

// ── LE PDF (pdf-lib) ────────────────────────────────────────────────────────
// images : { annonce: { octets, type: 'jpg'|'png' } | null, carton: idem | null } ;
// bordereauPdf : les octets du PDF du bordereau (joint seulement si `contenu.avecBordereau`).
const A4 = [595.28, 841.89];
export async function pdfDossierLitige(contenu, { PDFLib = null, images = {}, bordereauPdf = null } = {}) {
  const PL = PDFLib || await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb } = PL;
  const doc = await PDFDocument.create();
  doc.setTitle(contenu.titre);
  doc.setCreator('VRM');
  doc.setProducer('VRM (pdf-lib)');
  const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const ENCRE = rgb(0.11, 0.11, 0.12), GRIS = rgb(0.42, 0.42, 0.45), FILET = rgb(0.86, 0.86, 0.88), CASE = rgb(0.95, 0.95, 0.97);
  const M = 48, [W, H] = A4;
  const dessinable = (ch) => { try { f.encodeText(ch); return true; } catch (_) { return false; } };
  const propre = (s) => { let o = ''; for (const ch of String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[«»]/g, '"').replace(/[   ]/g, ' ').replace(/[−–—]/g, '-').replace(/…/g, '...').replace(/[\r\n\t]+/g, ' ')) o += dessinable(ch) ? ch : (dessinable(ch.normalize('NFD')[0]) ? ch.normalize('NFD')[0] : ''); return o; };
  const page = doc.addPage(A4);
  const txt = (s, x, y, { font = f, t = 10, c = ENCRE, max = W - M - x } = {}) => {
    let v = propre(s);
    while (v.length > 1 && font.widthOfTextAtSize(v, t) > max) v = v.slice(0, -2) + '.';
    page.drawText(v, { x, y, size: t, font, color: c });
  };
  let y = H - M - 6;
  txt('Dossier de litige', M, y, { t: 11, c: GRIS }); y -= 30;
  txt(contenu.num ? `N°${contenu.num}` : 'Sans N°', M, y, { font: fb, t: 30 }); y -= 26;
  for (const [k, v] of contenu.identite) {
    txt(k, M, y, { t: 9.5, c: GRIS });
    txt(v, M + 130, y, { font: k === 'Article' ? fb : f, t: 10.5, max: W - 2 * M - 130 });
    y -= 6; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: FILET }); y -= 13;
  }
  // Les deux photos côte à côte : l'annonce et le carton fermé.
  y -= 8;
  const larg = (W - 2 * M - 16) / 2, haut = 220;
  const cadres = [['annonce', "Photo de l'annonce"], ['carton', 'Photo du carton fermé']];
  for (let i = 0; i < 2; i++) {
    const [cle, nom] = cadres[i];
    const x = M + i * (larg + 16);
    txt(nom, x, y, { t: 9.5, c: GRIS, max: larg });
    const yb = y - 8 - haut;
    page.drawRectangle({ x, y: yb, width: larg, height: haut, color: CASE });
    const im = images && images[cle];
    let pose = false;
    if (im && im.octets && contenu.photos[cle] === 'ok') {
      try {
        const e = im.type === 'png' ? await doc.embedPng(im.octets) : await doc.embedJpg(im.octets);
        const k = Math.min(larg / e.width, haut / e.height);
        const w = e.width * k, h = e.height * k;
        page.drawImage(e, { x: x + (larg - w) / 2, y: yb + (haut - h) / 2, width: w, height: h });
        pose = true;
      } catch (_) { pose = false; }
    }
    if (!pose) {
      const p = contenu.photos[cle] === 'ok' ? 'pas récupérée' : (PHRASE_PHOTO[contenu.photos[cle]] || 'aucune rangée');
      const v = propre(p);
      page.drawText(v, { x: x + (larg - f.widthOfTextAtSize(v, 10)) / 2, y: yb + haut / 2 - 4, size: 10, font: f, color: GRIS });
    }
  }
  y -= 8 + haut + 26;
  // Le bordereau.
  txt('Bordereau', M, y, { font: fb, t: 12 }); y -= 18;
  if (contenu.bordereau) {
    for (const [k, v] of contenu.bordereau) { txt(k, M, y, { t: 9.5, c: GRIS }); txt(v, M + 130, y, { t: 10.5 }); y -= 16; }
    if (contenu.avecBordereau) { txt(bordereauPdf ? 'Le bordereau est joint en page suivante.' : 'Le PDF du bordereau n\'a pas pu être lu.', M, y, { t: 9, c: GRIS }); y -= 16; }
  } else { txt('Aucun bordereau lu pour cette vente.', M, y, { t: 10, c: GRIS }); y -= 16; }
  y -= 10;
  // Le suivi daté : les étapes PROUVÉES.
  txt('Suivi', M, y, { font: fb, t: 12 }); y -= 18;
  if (!contenu.etapes) { txt('Suivi pas lu.', M, y, { t: 10, c: GRIS }); y -= 16; }
  else if (!contenu.etapes.length) { txt('Aucune étape prouvée.', M, y, { t: 10, c: GRIS }); y -= 16; }
  else {
    for (const e of contenu.etapes) {
      if (y < M + 40) break;
      page.drawCircle({ x: M + 4, y: y + 3.5, size: 3, color: ENCRE });
      txt(e.label, M + 16, y, { font: fb, t: 10.5 });
      txt(e.quand, M + 130, y, { t: 10.5 });
      y -= 17;
    }
  }
  if (contenu.bifurcation && y > M + 40) { txt(contenu.bifurcation, M + 16, y, { t: 10.5, c: GRIS }); y -= 17; }
  txt(`Établi le ${contenu.etabliLe} avec VRM. Seules les étapes prouvées sont listées.`, M, M - 14, { t: 8, c: GRIS });
  // (14 nov., lot 126) Les échanges de la vente, sur une page à eux (seulement s'ils ont été demandés).
  if (contenu.echanges !== undefined) {
    const NOM = { toi: 'Toi', acheteur: "L'acheteur", vinted: 'Vinted', inconnu: '—' };
    let pg = doc.addPage(A4), yy = H - M - 6;
    const ecrire = (s, x, y2, o = {}) => { let v = propre(s); const font = o.font || f, t = o.t || 10; while (v.length > 1 && font.widthOfTextAtSize(v, t) > (o.max || W - M - x)) v = v.slice(0, -2) + '.'; pg.drawText(v, { x, y: y2, size: t, font, color: o.c || ENCRE }); };
    const couper = (s, t, max) => { const mots = propre(s).split(' '); const out = []; let l = ''; for (const m of mots) { const e = l ? l + ' ' + m : m; if (f.widthOfTextAtSize(e, t) > max && l) { out.push(l); l = m; } else l = e; } if (l) out.push(l); return out; };
    ecrire('Échanges avec l\'acheteur', M, yy, { font: fb, t: 14 }); yy -= 24;
    if (contenu.echanges === null) { ecrire('Conversation pas lue pour cette vente.', M, yy, { c: GRIS }); }
    else if (!contenu.echanges.length) { ecrire('Aucun message dans la conversation de cette vente.', M, yy, { c: GRIS }); }
    else for (const e of contenu.echanges) {
      const ls = couper(e.texte, 10, W - 2 * M - 16);
      if (yy - 16 - ls.length * 13 < M + 20) { pg = doc.addPage(A4); yy = H - M - 6; }
      ecrire(`${NOM[e.de] || '—'} · ${e.quand}`, M, yy, { font: fb, t: 9.5, c: e.de === 'toi' ? ENCRE : GRIS }); yy -= 14;
      for (const l of ls) { ecrire(l, M + 12, yy, { t: 10 }); yy -= 13; }
      yy -= 8;
    }
  }
  // Le bordereau lui-même, en pages jointes, s'il l'a demandé.
  if (contenu.avecBordereau && bordereauPdf) {
    try {
      const src = await PDFDocument.load(bordereauPdf, { ignoreEncryption: true });
      const pages = await doc.copyPages(src, src.getPageIndices().slice(0, 4));
      for (const p of pages) doc.addPage(p);
    } catch (_) { /* PDF illisible : la page 1 le dit déjà s'il manque */ }
  }
  return doc.save();
}

// ── UNE IMAGE EN OCTETS (navigateur) ────────────────────────────────────────
// src : une adresse (blob:, data:, https:) ⇒ { octets, type: 'jpg'|'png' } ou null.
// Un autre format (webp…) passe par un canvas en JPEG ; une erreur ⇒ null (« pas
// récupérée », dit dans le PDF). Aucune requête vers un autre hôte que celui de la photo.
export async function imageEnOctets(src) {
  if (!src) return null;
  try {
    const r = await fetch(src);
    if (!r.ok) return null;
    const b = await r.blob();
    const t = String(b.type || '').toLowerCase();
    const u8 = new Uint8Array(await b.arrayBuffer());
    if (/jpe?g/.test(t) || (u8[0] === 0xFF && u8[1] === 0xD8)) return { octets: u8, type: 'jpg' };
    if (/png/.test(t) || (u8[0] === 0x89 && u8[1] === 0x50)) return { octets: u8, type: 'png' };
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
    const bmp = await createImageBitmap(b);
    const cv = document.createElement('canvas');
    const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const j = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.85));
    return j ? { octets: new Uint8Array(await j.arrayBuffer()), type: 'jpg' } : null;
  } catch (_) { return null; }
}
