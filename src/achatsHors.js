// ═══════════════════════════════════════════════════════════════════════════
// ACHATS HORS PLATEFORME (brocante, magasin, lot, particulier…) — 15 octobre
// ═══════════════════════════════════════════════════════════════════════════
// Règles PURES (aucun React) : l'écran Achats, la modale « Prix d'achat » et
// `scripts/audit-achats-hors.cjs` exécutent les MÊMES fonctions (§11).
//
// ⚠️ LE LIEN VIT SUR LA CIBLE, COMME POUR UN ACHAT VINTED. Une paire (fiche
//    `vinted_annonce_numeros[id]`) ou une vente (`vinted_sale_overrides[tx]`)
//    porte `buyFromId = 'hors:<id de l'achat>'`. L'achat lui-même ne garde
//    AUCUNE liste de paires : deux listes qui disent la même chose finissent par
//    se contredire. « Qui est rattaché à quoi » se LIT sur les cibles
//    (`liensHors`), et c'est ce qui empêche un même achat d'être compté deux
//    fois (`achatsHorsDisponibles`).
// ⚠️ AUCUN RAPPROCHEMENT AUTOMATIQUE (§5) : rien ici ne compare un titre, une
//    marque ou une taille. Seul un CLIC relie un achat à une paire.
// ⚠️ PLUS DE « N° » TAPÉ SUR L'ACHAT. L'ancien formulaire écrivait
//    `vinted_buyprice_by_num[N°]` dès qu'un numéro était saisi : un numéro qui
//    ne désignait encore aucune fiche passait à la prochaine annonce numérotée
//    automatiquement, et elle HÉRITAIT de ce prix (le coût sur la mauvaise
//    paire, sans un mot — audit du 15 octobre, D-achats-3 d). On associe à une
//    paire EXISTANTE, ou à rien.
import { centimes } from './beneficePaire.js';

export const PROVENANCES = [
  ['brocante', 'Brocante'],
  ['magasin', 'Magasin'],
  ['lot', 'Lot'],
  ['particulier', 'Particulier'],
  ['autre', 'Autre'],
];
// Les valeurs des achats saisis avant le 15 octobre restent lisibles.
const ANCIENNES = { fournisseur: 'Fournisseur', 'vide-grenier': 'Vide-grenier' };
export const libelleProvenance = (k) => {
  const p = PROVENANCES.find(([c]) => c === k);
  return p ? p[1] : (ANCIENNES[k] || 'Autre');
};

export const QUANTITE_MAX = 500;
// La quantité d'un achat : 1 quand rien n'est dit (un achat = une paire).
export const quantiteHors = (b) => {
  const brut = b && b.quantite != null && String(b.quantite).trim() !== '' ? String(b.quantite).trim() : '1';
  if (!/^\d{1,3}$/.test(brut)) return 1;
  const q = Number(brut);
  return q >= 1 && q <= QUANTITE_MAX ? q : 1;
};

// Ce que l'achat a coûté EN TOUT (prix + frais), en centimes. `null` = le prix
// n'est pas lisible : on ne compte pas, on ne devine pas (§5).
export const coutHorsCentimes = (b) => {
  if (!b) return null;
  const p = centimes(b.price);
  if (p == null) return null;
  const vide = b.frais == null || String(b.frais).trim() === '';
  const f = vide ? 0 : centimes(b.frais);
  if (f == null) return null;
  return p + f;
};

// Parts ÉGALES d'un total, en centimes, dont la SOMME vaut EXACTEMENT le total :
// les centimes qui restent vont aux premières parts (100 € / 3 ⇒ 33,34 · 33,33 ·
// 33,33). C'est une RÉPARTITION, donc une estimation : l'écran l'écrit « réparti ».
export const partsHors = (total, q) => {
  const n = Math.max(1, Math.floor(Number(q) || 1));
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const base = Math.floor(t / n), reste = t - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < reste ? 1 : 0));
};

export const PREFIXE_HORS = 'hors:';
export const cleHors = (id) => PREFIXE_HORS + String(id);
export const idHors = (buyFromId) => {
  const s = String(buyFromId == null ? '' : buyFromId);
  return s.startsWith(PREFIXE_HORS) && s.length > PREFIXE_HORS.length ? s.slice(PREFIXE_HORS.length) : null;
};

// Les rattachements EXISTANTS, lus sur les cibles. Ordre stable (type puis clé) :
// c'est lui qui décide quelle part va à quelle paire, à chaque écriture.
export const liensHors = (numeros, saleOv) => {
  const m = {};
  for (const [k, e] of Object.entries(numeros || {})) {
    const id = idHors(e && e.buyFromId);
    if (id) (m[id] = m[id] || []).push({ type: 'paire', cle: String(k) });
  }
  for (const [k, e] of Object.entries(saleOv || {})) {
    const id = idHors(e && e.buyFromId);
    if (id) (m[id] = m[id] || []).push({ type: 'vente', cle: String(k) });
  }
  for (const id in m) m[id].sort((a, b) => (a.type + ':' + a.cle).localeCompare(b.type + ':' + b.cle));
  return m;
};

const memeCible = (x, c) => !!(x && c && x.type === c.type && String(x.cle) === String(c.cle));

// Ce qu'on peut ENCORE rattacher à `cible` : un achat d'une paire une seule
// fois, un lot de N au plus N fois. Le lien que la cible porte déjà ne compte
// pas contre elle (on peut rouvrir la modale sur la même paire).
export const achatsHorsDisponibles = (offBuys, liens, cible) => (offBuys || []).filter((b) => {
  if (!b || !b.id || coutHorsCentimes(b) == null) return false;
  const l = ((liens || {})[b.id] || []).filter((x) => !memeCible(x, cible));
  return l.length < quantiteHors(b);
});

// La part de chaque cible, dans l'ordre stable des liens.
export const partsDesLiens = (b, liste) => {
  const total = coutHorsCentimes(b);
  if (total == null) return [];
  const tri = [...(liste || [])].sort((a, c) => (a.type + ':' + a.cle).localeCompare(c.type + ':' + c.cle));
  const parts = partsHors(total, quantiteHors(b));
  return tri.slice(0, parts.length).map((x, i) => ({ ...x, cents: parts[i] }));
};

export const prixTexte = (cents) => (Number(cents) / 100).toFixed(2);

// L'instantané posé sur la cible (même forme que celui d'un achat Vinted, que
// `achatRelie` sait lire) — plus `hors:true`, pour ne pas lui fabriquer un
// « reçu Vinted » : Vinted n'a rien vendu ici.
export const instantaneHors = (b, cents) => {
  const q = quantiteHors(b);
  const total = coutHorsCentimes(b);
  return {
    title: String((b && b.title) || '').trim() || libelleProvenance(b && b.source),
    date: (b && b.date) || '',
    photo: '',
    price: Number(cents) / 100,
    devise: 'EUR',
    seller: '', status: '', account: '',
    hors: true,
    source: (b && b.source) || 'autre',
    quantite: q,
    reparti: q > 1,
    total: total == null ? null : total / 100,
  };
};
