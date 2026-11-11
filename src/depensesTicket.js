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
  // (3 nov.) « Achats de stock » retiré : le prix d'achat est déjà compté par article (il serait retiré deux fois du bénéfice).
  { k: 'Envois', ex: 'timbres, trajet jusqu’au relais' },
  { k: 'Abonnements', ex: 'Canva, une appli photo' },
  { k: 'Autre', ex: 'ce que tu as payé' },
];

export const idTicket = (id) => 'depense_ticket_' + String(id).replace(/[^\w-]/g, '');

// Un montant écrit sur un ticket : « 12,50 », « 12.50 », « 1 234,56 », « 12,50€ ».
const RE_MONTANT = /(\d{1,3}(?:[ .  ]\d{3})*|\d+)[,.](\d{2})(?!\d)\s*(?:€|eur)?/gi;
// (11 nov., lot achat-photo) Une capture d'écran de commande écrit souvent « 45 € » sans centimes :
// un ENTIER compte seulement collé à « € » ou « EUR » (jamais un entier nu : c'est une quantité).
const RE_ENTIER_EURO = /(?<![\d,.])(\d{1,3}(?:[   ]\d{3})+|\d{1,6})\s*(?:€|eur\b)/gi;
// « -5,00 » (une remise) n'est jamais un montant payé.
const negatif = (l, i) => i > 0 && /[-−–]\s*$/.test(l.slice(Math.max(0, i - 2), i));
const montantsDe = (ligne) => {
  const out = [];
  const l = String(ligne);
  for (const m of l.matchAll(RE_MONTANT)) {
    if (negatif(l, m.index)) continue;
    const c = parseInt(m[1].replace(/[ .  ]/g, ''), 10) * 100 + parseInt(m[2], 10);
    if (Number.isSafeInteger(c) && c > 0 && c < 10000000) out.push(c);
  }
  if (!out.length) for (const m of l.matchAll(RE_ENTIER_EURO)) {
    if (negatif(l, m.index)) continue;
    const c = parseInt(m[1].replace(/[   ]/g, ''), 10) * 100;
    if (Number.isSafeInteger(c) && c > 0 && c < 10000000) out.push(c);
  }
  return out;
};
// Les mots d'un TOTAL payé, du plus sûr au moins sûr. « TOTAL HT », « TVA »,
// « RENDU », « SOUS-TOTAL » ne sont pas ce qu'il a payé.
const MOTS = [
  /net\s*[àa]\s*payer|montant\s*(?:pay[ée]|d[ûu]|ttc)|[àa]\s*payer|total\s*pay[ée]/i,
  /total\s*ttc|ttc\s*total|total\s*\(?\s*tva\s*(?:incluse|comprise)|total\s*(?:de\s*la\s*)?commande/i,
  /\btotal\b/i,
  /\b(?:cb|carte|esp[eè]ces|paiement)\b/i,
];
// (11 nov.) « TVA incluse / comprise » n'écarte PAS une ligne (« Total (TVA incluse) 45,00 € » est payé).
// « À rendre », « réduction », « fidélité » ne sont pas ce qu'il a payé.
const PAS_LE_TOTAL = /sous[\s-]*total|\bht\b|\btva\b(?!\s*(?:incluse|comprise))|rendu|[àa]\s*rendre|monnaie|remise|r[ée]duction|[ée]conomie|avoir|points?\b|fid[ée]lit[ée]/i;

// Le montant payé lu sur le texte d'un ticket, en centimes, ou null (jamais deviné :
// sans mot de total, aucun « plus grand nombre »).
export function montantDuTicket(texte) {
  const lignes = lignesDe(texte);
  for (const re of MOTS) {
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (!re.test(l) || PAS_LE_TOTAL.test(l)) continue;
      let ms = montantsDe(l);
      // La ligne suivante seulement quand celle du mot n'a AUCUN chiffre (« NET A PAYER » seul).
      if (!ms.length && !/\d/.test(l) && i + 1 < lignes.length && !PAS_LE_TOTAL.test(lignes[i + 1])) ms = montantsDe(lignes[i + 1]);
      if (ms.length) return ms[ms.length - 1];
    }
  }
  return null;
}
const lignesDe = (texte) => String(texte == null ? '' : texte).replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);

// ── (11 nov., lot achat-photo) Le reste d'un ticket d'ACHAT : date, enseigne, nombre d'articles ──
// Chaque lecture rend une valeur LUE ou null. Rien n'est complété ni deviné.
const MOIS = { janv: 1, janvier: 1, fevr: 2, fev: 2, fevrier: 2, mars: 3, avr: 4, avril: 4, mai: 5, juin: 6, juil: 7, juillet: 7, aout: 8, sept: 9, septembre: 9, oct: 10, octobre: 10, nov: 11, novembre: 11, dec: 12, decembre: 12 };
const sansAccent = (x) => String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isoDe = (j, m, a) => `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
const dateValide = (j, m, a) => { const d = new Date(Date.UTC(a, m - 1, j)); return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j; };
// La date d'ACHAT (AAAA-MM-JJ), ou null. JJ/MM/AAAA, JJ-MM-AA, JJ.MM.AAAA, « 9 nov. 2026 ».
// Une date future (« valable jusqu'au… », « retour avant le… ») ou de plus de 3 ans n'est pas l'achat.
export function dateDuTicket(texte, aujourdhui = new Date()) {
  const auj = aujourdhui instanceof Date ? aujourdhui : new Date(aujourdhui);
  const fin = isoDe(auj.getDate(), auj.getMonth() + 1, auj.getFullYear());
  const debut = isoDe(auj.getDate(), auj.getMonth() + 1, auj.getFullYear() - 3);
  const PAS_ACHAT = /valable|jusqu|avant\s*le|retour|expir|echeance|naissance|garantie/;
  const vues = [];
  for (const l of lignesDe(texte)) {
    const t = sansAccent(l);
    if (PAS_ACHAT.test(t)) continue;
    for (const m of t.matchAll(/(?<!\d)(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4}|\d{2})(?!\d)/g)) {
      const j = +m[1], mo = +m[2]; let a = +m[3]; if (m[3].length === 2) a += 2000;
      if (dateValide(j, mo, a)) vues.push(isoDe(j, mo, a));
    }
    for (const m of t.matchAll(/(?<!\d)(\d{1,2})(?:er)?\s+([a-z]{3,9})\.?\s+(\d{4})(?!\d)/g)) {
      const mo = MOIS[m[2]]; const j = +m[1], a = +m[3];
      if (mo && dateValide(j, mo, a)) vues.push(isoDe(j, mo, a));
    }
  }
  return vues.find((d) => d <= fin && d >= debut) || null;
}
// L'enseigne : un nom connu ÉCRIT sur le ticket, sinon la 1re ligne de lettres en tête du ticket
// (le nom du magasin y est imprimé). Rend le texte LU (mis en forme), ou null.
const ENSEIGNES = ['Vinted', 'Leboncoin', 'Vestiaire Collective', 'eBay', 'Emmaüs', 'Decathlon', 'Intersport', 'Go Sport', 'Courir', 'Foot Locker', 'JD Sports', 'Snipes', 'Sport 2000', 'Zalando', 'Amazon', 'Kiabi', 'Primark', 'Zara', 'H&M', 'Uniqlo', 'Nike', 'Adidas', 'Carrefour', 'Leclerc', 'Auchan', 'Lidl', 'Intermarché', 'Action', 'Cash Express', 'Cash Converters', 'Easy Cash', 'La Halle', 'Celio', 'Jules', 'Galeries Lafayette', 'Printemps', 'Veepee', 'Showroomprivé', 'Back Market', 'Label Emmaüs', 'Ding Fring', 'Le Relais', 'Oxfam'];
const cleNom = (x) => sansAccent(x).replace(/[^a-z0-9&]+/g, '');
// `connueSeulement` : sans total ni date lus, ce n'est peut-être pas un ticket — seule une enseigne connue compte.
export function lieuDuTicket(texte, { connueSeulement = false } = {}) {
  const lignes = lignesDe(texte);
  const tout = lignes.map(cleNom);
  for (const e of ENSEIGNES) {
    const k = cleNom(e);
    if (tout.some((l) => (k.length <= 4 ? l === k || l.startsWith(k + 'sa') || l.startsWith(k + 'france') : l.includes(k)))) return e;
  }
  if (connueSeulement) return null;
  const BRUIT = /ticket|facture|recu|bienvenue|merci|caisse|client|siret|siren|\btva\b|tel\b|telephone|www|http|@|commande|date|heure|total|magasin\s*n|n°|rue|avenue|bd\b|boulevard|place|chemin|route/;
  for (const l of lignes.slice(0, 4)) {
    const t = sansAccent(l);
    const lettres = (t.match(/[a-z]/g) || []).length;
    if (lettres < 4 || !/[a-z]{4}/.test(t) || BRUIT.test(t) || /\d{3,}/.test(t) || lettres / t.replace(/\s/g, '').length < 0.7) continue;
    const propre = l.replace(/[^\p{L}\p{N}&'’ -]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (propre.length < 3 || propre.length > 30) continue;
    return propre === propre.toUpperCase() ? propre.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : propre;
  }
  return null;
}
// Le nombre d'articles ÉCRIT sur le ticket (« 3 ARTICLES », « Nb articles : 3 », « Articles vendus 3 »), ou null.
export function articlesDuTicket(texte) {
  for (const l of lignesDe(texte)) {
    const t = sansAccent(l);
    const m = /(?:nb|nbre|nombre)\s*(?:d['’ ]\s*)?articles?\s*(?:vendus?)?\s*[:=]?\s*(\d{1,3})(?![\d,.])/.exec(t)
      || /articles?\s*(?:vendus?)?\s*[:=]\s*(\d{1,3})(?![\d,.])/.exec(t)
      || /(?<![\d,.])(\d{1,3})\s*articles?\b/.exec(t)
      || /articles?\s+vendus?\s*(\d{1,3})(?![\d,.])/.exec(t);
    if (m) { const n = +m[1]; if (n >= 1 && n <= 200) return n; }
  }
  return null;
}
// Tout ce qu'un ticket d'achat dit, LU : { montant (centimes|null), date, lieu, articles }.
export function lireTicketAchat(texte, aujourdhui = new Date()) {
  const montant = montantDuTicket(texte), date = dateDuTicket(texte, aujourdhui);
  return { montant, date, lieu: lieuDuTicket(texte, { connueSeulement: montant == null && !date }), articles: articlesDuTicket(texte) };
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
export async function texteDuTicket(dataUrl, opts) { return (await lireTexteTicket(dataUrl, opts)).texte; }
// (11 nov., lot achat-photo) La même lecture, qui dit POURQUOI elle n'a rien rendu (« on se tait et on
// dit pourquoi ») : { texte, moteur: 'navigateur'|'tesseract'|null, raison: null|'hors-ligne'|'chargement'|'delai'|'erreur' }.
export async function lireTexteTicket(dataUrl, { delai = 45000 } = {}) {
  const TROP = Symbol('delai');
  const borne = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r(TROP), delai))]);
  try {
    if (typeof window !== 'undefined' && 'TextDetector' in window) {
      const img = new Image(); img.src = dataUrl; await img.decode();
      const blocs = await borne(new window.TextDetector().detect(img));
      const t = Array.isArray(blocs) ? blocs.map((b) => b.rawValue).join('\n') : '';
      if (t.trim()) return { texte: t, moteur: 'navigateur', raison: null };
    }
  } catch (_) { /* détecteur absent ou refusé : Tesseract */ }
  if (typeof window !== 'undefined' && !window.Tesseract && typeof navigator !== 'undefined' && navigator.onLine === false) return { texte: '', moteur: null, raison: 'hors-ligne' };
  let T;
  try { T = await borne(chargerTesseract()); } catch (_) { return { texte: '', moteur: null, raison: 'chargement' }; }
  if (T === TROP) return { texte: '', moteur: null, raison: 'delai' };
  try {
    const r = await borne((async () => {
      const w = await T.createWorker('fra', 1, { workerPath: TESS + 'worker.min.js', corePath: TESS_CORE, langPath: TESS_LANGUE, logger: () => {} });
      try { const x = await w.recognize(dataUrl); return (x && x.data && x.data.text) || ''; }
      finally { try { await w.terminate(); } catch (_) {} }
    })());
    if (r === TROP) return { texte: '', moteur: null, raison: 'delai' };
    return { texte: r, moteur: 'tesseract', raison: null };
  } catch (_) { return { texte: '', moteur: null, raison: 'erreur' }; }
}
