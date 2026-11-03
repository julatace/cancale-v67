// ═══════════════════════════════════════════════════════════════════════════
// LA BOÎTE À DÉPENSES — le ticket en photo (3 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (3 nov., 13 h 02) : ajouter une dépense en un geste depuis Compta, avec
// la PHOTO du ticket ; montant, date, catégorie saisis par lui ; lecture
// automatique du montant SEULEMENT si elle est gratuite et locale (§2.9 : rien
// de payant sur sa clé — ni IA, ni service distant) : le détecteur de texte du
// navigateur (`TextDetector`, quand il existe), sinon Tesseract (WASM, exécuté
// DANS la page, chargé de cdn.jsdelivr.net — autorisé par la CSP comme
// onnxruntime). Tout échec ⇒ le champ reste vide, sans un mot.
// Le montant lu n'est qu'un champ PRÉ-REMPLI : c'est SON « Ajouter » qui écrit.
// La photo a SA ligne (`depense_ticket_{id}`, comme `achat_hors_photo_{id}`) :
// jamais dans `main` (§4.4), jamais dans le dépôt.
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIES_DEPENSE = [
  { k: 'Emballage', ex: 'cartons, papier bulle, scotch' },
  { k: 'Achats de stock', ex: 'un lot de paires, une brocante' },
  { k: 'Envois', ex: 'timbres, trajet jusqu’au relais' },
  { k: 'Abonnements', ex: 'Canva, une appli photo' },
  { k: 'Autre', ex: 'ce que tu as payé' },
];

export const idTicket = (id) => 'depense_ticket_' + String(id).replace(/[^\w-]/g, '');

// Un montant écrit sur un ticket : « 12,50 », « 12.50 », « 1 234,56 », « 12,50€ ».
const RE_MONTANT = /(\d{1,3}(?:[ .  ]\d{3})*|\d+)[,.](\d{2})(?!\d)\s*(?:€|eur)?/gi;
const montantsDe = (ligne) => {
  const out = [];
  for (const m of String(ligne).matchAll(RE_MONTANT)) {
    const c = parseInt(m[1].replace(/[ .  ]/g, ''), 10) * 100 + parseInt(m[2], 10);
    if (Number.isSafeInteger(c) && c > 0 && c < 10000000) out.push(c);
  }
  return out;
};
// Les mots d'un TOTAL payé, du plus sûr au moins sûr. « TOTAL HT », « TVA »,
// « RENDU », « SOUS-TOTAL » ne sont pas ce qu'il a payé.
const MOTS = [
  /net\s*[àa]\s*payer|montant\s*(?:pay[ée]|d[ûu]|ttc)|[àa]\s*payer/i,
  /total\s*ttc|ttc\s*total/i,
  /\btotal\b/i,
  /\b(?:cb|carte|esp[eè]ces|paiement)\b/i,
];
const PAS_LE_TOTAL = /sous[\s-]*total|\bht\b|\btva\b|rendu|monnaie|remise|[ée]conomie|avoir|points?\b/i;

// Le montant payé lu sur le texte d'un ticket, en centimes, ou null (jamais deviné :
// sans mot de total, aucun « plus grand nombre »).
export function montantDuTicket(texte) {
  const lignes = String(texte == null ? '' : texte).replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const re of MOTS) {
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (!re.test(l) || PAS_LE_TOTAL.test(l)) continue;
      let ms = montantsDe(l);
      if (!ms.length && i + 1 < lignes.length && !PAS_LE_TOTAL.test(lignes[i + 1])) ms = montantsDe(lignes[i + 1]);
      if (ms.length) return ms[ms.length - 1];
    }
  }
  return null;
}
export const texteMontantSaisie = (c) => (c == null ? '' : `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}`);

// ── La lecture, dans la page (jamais un service distant) ─────────────────────
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/';
const TESS_CORE = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1';
const TESS_LANGUE = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/fra@1.0.0/4.0.0_best_int';
let chargement = null;
const chargerTesseract = () => {
  if (typeof window === 'undefined') return Promise.reject(new Error('pas de page'));
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (chargement) return chargement;
  chargement = new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = TESS + 'tesseract.min.js'; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => (window.Tesseract ? ok(window.Tesseract) : ko(new Error('absent')));
    s.onerror = () => { chargement = null; ko(new Error('chargement')); };
    document.head.appendChild(s);
  });
  return chargement;
};
// Le texte d'une image (dataURL), ou '' : le détecteur du navigateur d'abord,
// puis Tesseract ; borné dans le temps (`delai`), jamais une erreur qui remonte.
export async function texteDuTicket(dataUrl, { delai = 45000 } = {}) {
  const borne = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r(''), delai))]);
  try {
    if (typeof window !== 'undefined' && 'TextDetector' in window) {
      const img = new Image(); img.src = dataUrl; await img.decode();
      const blocs = await borne(new window.TextDetector().detect(img));
      const t = Array.isArray(blocs) ? blocs.map((b) => b.rawValue).join('\n') : '';
      if (t.trim()) return t;
    }
  } catch (_) { /* détecteur absent ou refusé : Tesseract */ }
  try {
    return await borne((async () => {
      const T = await chargerTesseract();
      const w = await T.createWorker('fra', 1, { workerPath: TESS + 'worker.min.js', corePath: TESS_CORE, langPath: TESS_LANGUE, logger: () => {} });
      try { const r = await w.recognize(dataUrl); return (r && r.data && r.data.text) || ''; }
      finally { try { await w.terminate(); } catch (_) {} }
    })());
  } catch (_) { return ''; }
}
