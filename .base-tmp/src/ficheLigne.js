// ── UNE SEULE FICHE PARTOUT (14 nov., proposition 62 choisie par Julien) ────
// « Toucher n'importe quelle ligne (vente, colis, annonce, achat) ouvre la même
// fiche de la paire, avec toutes ses actions. »
//
// Ce module PUR porte trois choses, et rien d'autre :
//  1. `attrsFicheLigne(l)` : ce qu'une rangée de liste pose sur sa racine (des
//     `data-fl-*`). C'est l'IDENTITÉ de la ligne, lue par la coque au toucher —
//     N° (que la liste a déjà trouvé PAR IDENTITÉ), identifiant d'annonce, n° de
//     transaction, photo exacte. Le titre, la photo et le prix posés à côté ne
//     servent QU'À L'AFFICHAGE (la carte héros d'une ligne sans paire) : aucune
//     règle ne les lit pour désigner une paire (§5).
//  2. `numeroDeLigne(l, d)` : la paire que désigne une ligne, par identité
//     seulement — dans l'ordre : le N° porté par la ligne, puis l'identifiant
//     d'annonce (sa fiche numérotée), puis le n° de transaction (→ l'annonce de
//     CETTE vente → sa fiche), puis la photo EXACTE (fichier exact, jamais
//     « ressemble »). Plusieurs N° (un lot) : aucun n'est choisi ; aucun : la
//     fiche de la LIGNE seule (« pas de paire reliée »), jamais une paire devinée.
//  3. un petit magasin (`ouvrirLigne`, `fermerLigne`, `ligneOuverte`, `abonner`,
//     `poserSlot`) : la ligne ouverte et les deux places de la fiche où la ligne
//     range SES actions (`DansFiche`, src/DansFiche.jsx).
// Banc : scripts/bancs/fiche-partout.cjs.

const str = (v) => String(v == null ? '' : v).trim();
const CONTEXTES = ['vente', 'colis', 'achat', 'annonce', 'stock', 'retrait', 'journee'];
export const CONTEXTES_FICHE = CONTEXTES;

// Une clé de ligne stable : le contexte et la meilleure identité qu'elle porte.
export function cleLigne(l) {
  const c = CONTEXTES.includes(l && l.contexte) ? l.contexte : 'vente';
  const id = str(l && (l.cle || l.tx || l.item || l.suivi || (Array.isArray(l.nums) ? l.nums.join('+') : l.nums) || l.photo));
  return id ? `${c}:${str(l && l.site) || 'x'}:${id}` : '';
}

const liste = (v) => (Array.isArray(v) ? v : str(v) ? str(v).split(',') : []).map(str).filter(Boolean);

// Les attributs d'une rangée. `nums` : les N° que la LISTE a trouvés par identité
// (jamais par titre). Rien d'écrit quand la ligne n'a aucune clé (elle reste ce
// qu'elle était : rien ne s'ouvre au hasard).
export function attrsFicheLigne(l = {}) {
  const cle = cleLigne(l);
  if (!cle) return {};
  const nums = [...new Set(liste(l.nums))];
  const a = { 'data-fiche-ligne': cle, 'data-fl-ctx': CONTEXTES.includes(l.contexte) ? l.contexte : 'vente' };
  if (str(l.site)) a['data-fl-site'] = str(l.site);
  if (nums.length) a['data-fl-num'] = nums.join(',');
  if (str(l.item)) a['data-fl-item'] = str(l.item);
  if (str(l.tx)) a['data-fl-tx'] = str(l.tx);
  if (str(l.suivi)) a['data-fl-suivi'] = str(l.suivi);
  if (str(l.photo)) a['data-fl-photo'] = str(l.photo).slice(0, 600);
  // Affichage seulement (carte héros d'une ligne sans paire) — jamais une identité.
  if (str(l.titre)) a['data-fl-titre'] = str(l.titre).slice(0, 160);
  if (str(l.prix)) a['data-fl-prix'] = str(l.prix).slice(0, 40);
  if (str(l.sous)) a['data-fl-sous'] = str(l.sous).slice(0, 160);
  return a;
}

// Relit une rangée (l'élément qui porte `data-fiche-ligne`).
export function lireLigne(el) {
  if (!el || typeof el.getAttribute !== 'function') return null;
  const g = (k) => str(el.getAttribute(k));
  const cle = g('data-fiche-ligne');
  if (!cle) return null;
  return { cle, contexte: g('data-fl-ctx') || 'vente', site: g('data-fl-site'), nums: liste(g('data-fl-num')), item: g('data-fl-item'), tx: g('data-fl-tx'),
    suivi: g('data-fl-suivi'), photo: g('data-fl-photo'), titre: g('data-fl-titre'), prix: g('data-fl-prix'), sous: g('data-fl-sous') };
}

// Un toucher qui vise un contrôle DE la ligne (bouton, lien, champ, case de
// sélection…) garde son geste : seul le « corps » de la ligne ouvre la fiche.
// `data-fiche-ligne-ouvre` : le contrôle qui EST le corps (le bouton d'une ligne de vente).
const INTERACTIF = 'a,button,input,select,textarea,label,summary,details,[role="button"],[role="menuitem"],[role="checkbox"],[contenteditable="true"],[data-edition],[data-serie-case],[data-fiche-ligne-ignore]';
export function toucheLeCorps(cible, ligne) {
  if (!cible || !ligne || typeof cible.closest !== 'function') return false;
  const i = cible.closest(INTERACTIF);
  if (i && ligne.contains(i) && i !== ligne && !i.hasAttribute('data-fiche-ligne-ouvre')) return false;
  if (cible.closest('[role="dialog"],[aria-modal="true"],.vrm-fp')) return false;
  return true;
}

// LA PAIRE D'UNE LIGNE, PAR IDENTITÉ (§5). d : { fiches (vinted_annonce_numeros,
// ou null = pas lues), txnItem ({ tx: item } ou null), photoVersItem(url) (fichier
// EXACT → id d'annonce, ou null), cleNum, doublon(num) → true si deux paires
// PRÉSENTES portent ce N° }.
// Rend { etat: 'un' | 'lot' | 'aucun' | 'lecture' | 'passu', nums, par, double }.
export function numeroDeLigne(l, d = {}) {
  const cn = typeof d.cleNum === 'function' ? d.cleNum : (x) => str(x).toUpperCase();
  const fiches = d.fiches || null;
  const numDeFiche = (id) => { const f = fiches && id ? fiches[str(id)] : null; const n = f && (f.numero != null ? f.numero : f.num); return str(n); };
  const fin = (nums, par) => {
    const u = [...new Map(nums.map((n) => [cn(n), str(n)])).values()].filter(Boolean);
    if (!u.length) return { etat: 'aucun', nums: [], par: '', double: false };
    if (u.length > 1) return { etat: 'lot', nums: u, par, double: false };
    return { etat: 'un', nums: u, par, double: !!(d.doublon && d.doublon(u[0])) };
  };
  if (!l) return { etat: 'aucun', nums: [], par: '', double: false };
  const nums = liste(l.nums);
  if (nums.length) return fin(nums, 'numero');
  if (str(l.item)) { if (fiches == null) return { etat: 'lecture', nums: [], par: 'annonce', double: false }; const n = numDeFiche(l.item); if (n) return fin([n], 'annonce'); }
  if (str(l.tx)) {
    if (d.txnItem === undefined || (d.txnItem && fiches == null)) return { etat: 'lecture', nums: [], par: 'transaction', double: false };
    // « Pas su » ne vaut pas « rien » (§5) : la table des transactions n'a pas répondu.
    if (d.txnItem === null) return { etat: 'passu', nums: [], par: 'transaction', double: false };
    const it = d.txnItem ? d.txnItem[str(l.tx)] : null;
    const n = it ? numDeFiche(it) : '';
    if (n) return fin([n], 'transaction');
  }
  if (str(l.photo) && typeof d.photoVersItem === 'function') { const it = d.photoVersItem(str(l.photo)); const n = it ? numDeFiche(it) : ''; if (n) return fin([n], 'photo'); }
  return { etat: 'aucun', nums: [], par: '', double: false };
}

// ── Le magasin : la ligne ouverte et les places de la fiche ──────────────────
let _ouverte = null;            // la ligne ouverte (lireLigne) ou null
const _slots = { contexte: null, actions: null };
const _abonnes = new Set();
const _notifier = () => { _abonnes.forEach((f) => { try { f(); } catch (_) {} }); };
export const abonner = (f) => { _abonnes.add(f); return () => _abonnes.delete(f); };
export const ligneOuverte = () => _ouverte;
export const slotFiche = (place) => _slots[place] || null;
// `instant` : l'heure du toucher (performance.now), pour mesurer l'ouverture.
export function ouvrirLigne(l) {
  if (!l || !l.cle) return;
  _ouverte = { ...l, at: Date.now() };
  _notifier();
  try { window.dispatchEvent(new CustomEvent('vrm:fiche-ligne', { detail: _ouverte })); } catch (_) {}
}
export function fermerLigne() { if (!_ouverte) return; _ouverte = null; _notifier(); }
export function poserSlot(place, el) {
  if (!(place in _slots) || _slots[place] === el) return;
  _slots[place] = el || null;
  _notifier();
}
