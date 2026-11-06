// ═══════════════════════════════════════════════════════════════════════════
// LA LOUPE UNIVERSELLE — ce que l'écran prépare pour la règle (6 nov., v36)
// ═══════════════════════════════════════════════════════════════════════════
// La règle est `src/rechercheUnique.js` (pure, auditée). Ici : les ADAPTATEURS
// qui mettent les sources que l'app a déjà lues à la forme de la règle, le
// mémo qui évite de tout reconstruire à chaque frappe, les « récents » de
// l'appareil, la demande d'ouverture d'une facture ou d'un e-mail, et le mot de
// la pastille. Sans React : `scripts/audit-recherche-universelle.cjs` les exécute.
//
// ⚠️ §5 : rien ici ne RELIE deux objets par ressemblance. Une annonce rejoint sa
//    fiche par l'id de l'annonce (dans la règle), une vente son N° par sa
//    transaction (la correction posée à la main, sinon transaction → annonce →
//    fiche : la règle de « Tout sur le N° »).
// ⚠️ Les « récents » sont une commodité de l'APPAREIL (`localStorage`, lecture
//    et écriture protégées) : ils ne quittent jamais l'appareil, et l'écran les
//    tait en mode stream (une recherche tapée peut être un pseudo).

const str = (v) => String(v == null ? '' : v);

// ── LE MÉMO : la même valeur tant que ses dépendances sont les MÊMES objets ──
const _memo = new Map();
export function memoSur(nom, deps, f) {
  const m = _memo.get(nom);
  if (m && m.deps.length === deps.length && m.deps.every((d, i) => d === deps[i])) return m.v;
  const v = f();
  _memo.set(nom, { deps, v });
  return v;
}

// ── LES ANNONCES EN LIGNE, depuis les lignes de dressing lues (règle « en ligne ») ──
// Une annonce = son id ; les comptes cherchés seulement (`garderCompte(uid)`).
export function annoncesDesLignes(lignes, garderCompte = () => true) {
  if (!Array.isArray(lignes)) return null;
  const out = [], vus = new Set();
  for (const r of lignes) {
    const m = /^harvest_([^_]+)_listings$/.exec(str(r && r.id));
    const uid = m ? m[1] : '';
    if (uid && !garderCompte(uid)) continue;
    const items = (r && r.data && r.data.payload && Array.isArray(r.data.payload.items)) ? r.data.payload.items : [];
    for (const it of items) {
      if (!it || it.id == null || it.is_closed || it.is_hidden || it.is_draft) continue;
      const id = str(it.id); if (vus.has(id)) continue; vus.add(id);
      const ph = it.photo && typeof it.photo === 'object' ? (it.photo.url || (Array.isArray(it.photo.thumbnails) && it.photo.thumbnails[0] && it.photo.thumbnails[0].url) || '') : str(it.photo);
      out.push({ id, title: str(it.title), brand: str(it.brand), size: str(it.size), price: it.price, photo: ph, uid, url: str(it.url) });
    }
  }
  return out;
}

// ── LES N° DES VENTES, par identité ───────────────────────────────────────
// La correction posée à la main sur la vente (`vinted_sale_overrides[tx].numero`),
// sinon transaction → annonce (`txnItem`) → la fiche de CETTE annonce.
export function numerosDesVentes(fiches, txnItem, saleOv) {
  const out = new Map();
  const F = fiches && typeof fiches === 'object' ? fiches : {};
  if (txnItem && typeof txnItem === 'object') {
    for (const [tx, item] of Object.entries(txnItem)) { const f = F[str(item)]; if (f && str(f.numero).trim()) out.set(str(tx).replace(/[^0-9A-Za-z]/g, '').toUpperCase(), str(f.numero).trim()); }
  }
  if (saleOv && typeof saleOv === 'object') {
    for (const [tx, o] of Object.entries(saleOv)) { if (o && str(o.numero).trim()) out.set(str(tx).replace(/[^0-9A-Za-z]/g, '').toUpperCase(), str(o.numero).trim()); }
  }
  return out;
}

// ── LES FACTURES : celles saisies dans l'app (`vinted_invoices`) et les factures
// Pro préparées par le serveur (`email_invoice_*`, lues en scalaires). ──────────
export function facturesPourRecherche(locales, pro) {
  const out = [];
  for (const i of Array.isArray(locales) ? locales : []) {
    if (!i || (!i.number && !i.id)) continue;
    out.push({ id: str(i.id || i.number), number: str(i.number), refs: [i.productId, i.vintedNumber].filter((x) => str(x).trim()), titre: str(i.itemName), acheteur: str(i.buyerName), montant: i.sellPrice != null ? i.sellPrice : i.total, date: str(i.saleDate), pro: false });
  }
  for (const f of Array.isArray(pro) ? pro : []) {
    if (!f || !f.number) continue;   // un brouillon sans numéro n'est pas une facture
    out.push({ id: str(f._id || f.id), number: str(f.number), refs: [], titre: str(f.designation), acheteur: '', montant: f.prix, date: str(f.createdAt), pro: true });
  }
  return out;
}

// ── UN E-MAIL TROUVÉ par le moteur de l'écran E-mails (réponse de
// `/api/email-rattacher?mode=journal&cherche=`) ⇒ un résultat de la loupe. Une
// réponse qui n'a pas la forme attendue n'est PAS « aucun e-mail » : `null`. ──
export function emailsDeLaReponse(j) {
  if (!j || j.ok !== true || !Array.isArray(j.emails)) return null;
  return j.emails.filter((e) => e && /^email_reception_[0-9a-f]{16,64}$/.test(str(e.id))).map((e) => ({ type: 'email', cle: 'email:' + e.id, id: str(e.id), email: e }));
}

// ── LE MOT DE LA PASTILLE : par quoi la ligne a été trouvée ─────────────────
const eur = (c) => { const v = c / 100; return (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')) + ' €'; };
export function motPastille(r) {
  if (!r) return '';
  switch (r.par) {
    case 'pseudo': return str(r.valeur);
    case 'suivi': return `Suivi ${r.valeur}`;
    case 'code': return `Code ${r.valeur}`;
    case 'transaction': return `Transaction ${r.valeur}`;
    case 'facture': return `Facture ${r.valeur}`;
    case 'montant': return Number.isFinite(r.valeur) ? eur(r.valeur) : '';
    case 'numero': return r.valeur ? `N°${r.valeur}` : '';
    default: return '';
  }
}
export const MOTIFS = { pseudo: 'Pseudo correspondant', suivi: 'Numéro de suivi correspondant', code: 'Code de retrait correspondant', transaction: 'Transaction correspondante', facture: 'Numéro de facture correspondant', montant: 'Montant exact', numero: 'Numéro VRM correspondant', titre: 'Titre, marque ou taille correspondants', recent: 'Vente récente' };

// ── LES RÉCENTS (sur cet appareil) ──────────────────────────────────────────
export const CLE_RECENTS = 'vrm_recherche_recents';
export const MAX_RECENTS = 6;
export function lireRecents(stockage) {
  try {
    const s = stockage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const v = s ? JSON.parse(s.getItem(CLE_RECENTS) || '[]') : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() && x.length <= 64).slice(0, MAX_RECENTS) : [];
  } catch (_) { return []; }
}
export function noterRecent(q, stockage) {
  const t = str(q).trim();
  if (!t || t.length > 64) return lireRecents(stockage);
  const l = [t, ...lireRecents(stockage).filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_RECENTS);
  try { const s = stockage || localStorage; s.setItem(CLE_RECENTS, JSON.stringify(l)); } catch (_) {}
  return l;
}
export function oublierRecents(stockage) { try { (stockage || localStorage).removeItem(CLE_RECENTS); } catch (_) {} return []; }

// ── LA DEMANDE D'OUVERTURE (une facture, un e-mail) — servie une fois par
// l'écran qui s'ouvre (Factures, E-mails), comme les autres demandes de l'app. ──
export const DEMANDE_RECHERCHE = { facture: '', email: '', at: 0 };
export function demanderOuverture(quoi, valeur) {
  DEMANDE_RECHERCHE[quoi] = str(valeur); DEMANDE_RECHERCHE.at = Date.now();
  try { window.dispatchEvent(new CustomEvent('vrm:recherche-ouvrir', { detail: { quoi, valeur: str(valeur) } })); } catch (_) {}
}
export function prendreDemande(quoi) {
  const v = DEMANDE_RECHERCHE[quoi];
  if (!v || Date.now() - DEMANDE_RECHERCHE.at > 60000) return '';
  DEMANDE_RECHERCHE[quoi] = '';
  return v;
}

// ── LE MOT ENVOYÉ AU MOTEUR DES E-MAILS : rien pour un montant ni moins de 2 lettres
// (la route n'en ferait rien) — la même réduction que `motsRecherche` côté serveur. ──
// ── LE FIL DE LA LOUPE : ce qui change à CHAQUE LETTRE vit hors de la coque ──
// (6 nov., mesuré au banc) Le texte tapé était un état de la coque (`AppCoeur`) :
// chaque lettre redessinait TOUTE l'app (l'écran derrière compris) — ~240 ms par
// lettre sur Ma journée au banc, avant même de chercher. Le texte, « Voir les N
// autres » et les e-mails trouvés vivent dans ce petit magasin : seuls le champ et
// le panneau (`Vivant`, src/LoupeVivante.jsx) se redessinent à la frappe.
export function creerFil(init) {
  let etat = init;
  const abonnes = new Set();
  return {
    lire: () => etat,
    poser: (p) => { const n = typeof p === 'function' ? p(etat) : { ...etat, ...p }; if (!n || n === etat) return; etat = n; for (const f of [...abonnes]) { try { f(); } catch (_) {} } },
    abonner: (f) => { abonnes.add(f); return () => { abonnes.delete(f); }; },
  };
}
// q : le texte tapé · emails : null (rien demandé) | { q, liste: undefined (en cours) | null (pas su) | [...], suite }
// · max : { q, m: { type: n } } — « Voir les N autres », valable pour CE texte seulement.
export const FIL_RECHERCHE = creerFil({ q: '', emails: null, max: { q: '', m: {} } });
export const poserTexteRecherche = (v) => FIL_RECHERCHE.poser((s) => { const q = str(v); return q === s.q ? s : { ...s, q }; });

export function requeteEmails(q) {
  const t = str(q).normalize('NFC').replace(/[^\p{L}\p{N} @._'’-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return t.length >= 2 ? t : '';
}
