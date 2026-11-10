// ════════════════════════════════════════════════════════════════════════════
//  BAISSE DE PRIX EN SÉRIE (10 nov., lot C + AW — validé par Julien)
// ════════════════════════════════════════════════════════════════════════════
// Il coche des annonces (vue « Qui dorment » ou « Sélectionner »), choisit une
// baisse (−X € ou −X %), voit pour CHAQUE annonce l'ancien prix → le nouveau
// (arrondi à l'euro) et, si un prix d'achat est saisi, le plancher du lot F
// (`plancherVente` : sous le plancher ⇒ ambre et DÉCOCHÉE par défaut), puis
// « Baisser N prix ». L'extension (5.336, `baisserPrixVinted`) exécute UNE par
// UNE, au nom du compte de l'onglet seulement, et RELIT le prix.
//
// Ce module est PUR (aucune lecture, aucune écriture) : les règles de l'aperçu
// et le sens d'une réponse de l'extension. Exécuté par scripts/audit-baisse-prix.cjs.
//
// Ce n'est PAS un prix conseillé (refusé le 11 oct.) : c'est LUI qui choisit la
// baisse ; VRM ne propose aucun montant. Rien n'est programmé ni répété.

const cts = (v) => {
  const n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};
export const MODES_BAISSE = ['eur', 'pct'];
export const PCT_MAX = 90;

// La baisse tapée : { ok, mode, valeur } ou { ok:false, erreur }.
export function baisseTapee(mode, texte) {
  const m = mode === 'eur' ? 'eur' : 'pct';
  const brut = String(texte == null ? '' : texte).trim();
  if (!brut) return { ok: false, mode: m, erreur: 'Tape une baisse.' };
  const v = Number(brut.replace(',', '.').replace(/\s/g, ''));
  if (!Number.isFinite(v) || v <= 0) return { ok: false, mode: m, erreur: 'Tape un nombre plus grand que 0.' };
  if (m === 'pct' && v > PCT_MAX) return { ok: false, mode: m, erreur: `Au plus −${PCT_MAX} %.` };
  if (m === 'eur' && Math.round(v * 100) !== v * 100) return { ok: false, mode: m, erreur: 'Au centime près, au plus.' };
  return { ok: true, mode: m, valeur: v };
}

// Le nouveau prix d'UNE annonce, en euros ENTIERS (arrondi à l'euro le plus proche,
// toujours strictement sous l'ancien, jamais sous 1 €). null : pas de baisse possible.
export function prixBaisse(prix, baisse) {
  const p = cts(prix);
  if (!(p > 0) || !baisse || !baisse.ok) return null;
  const brut = baisse.mode === 'eur' ? p - Math.round(baisse.valeur * 100) : p * (1 - baisse.valeur / 100);
  let n = Math.round(brut / 100);
  if (n * 100 >= p) n = Math.ceil(p / 100) - 1;   // l'arrondi ne remonte jamais au prix d'avant
  return n >= 1 ? n : null;
}

// L'aperçu. `annonces` : [{ id, uid, compte, numero, titre, photo, prix (euros | null) }]
// `compteOnglet` : l'uid Vinted ouvert dans l'onglet — `undefined` pas su · `null` aucun ·
// chaîne. `plancherDe(a)` → le résultat de `plancherVente` (centimes) ou null.
// Chaque ligne : { …a, nouveau, plancher, sousPlancher, bloque, coche } ;
// `bloque` (phrase) ⇒ elle ne part JAMAIS (autre compte, prix pas lu, baisse impossible).
export function lignesBaisse({ annonces, baisse, compteOnglet, plancherDe } = {}) {
  const L = Array.isArray(annonces) ? annonces : [];
  return L.filter((a) => a && a.id != null).map((a) => {
    const uid = String(a.uid || '');
    const nom = a.compte || (uid ? `le compte ${uid}` : 'son compte');
    let bloque = '';
    if (!uid) bloque = 'VRM ne sait pas à quel compte est cette annonce';
    else if (compteOnglet === undefined) bloque = 'VRM ne sait pas encore quel compte Vinted est ouvert';
    else if (!compteOnglet) bloque = `Ouvre vinted.fr sur ${nom}`;
    else if (String(compteOnglet) !== uid) bloque = `Ouvre ${nom} sur Vinted`;
    const prix = cts(a.prix) > 0 ? cts(a.prix) / 100 : null;
    const nouveau = prix == null ? null : prixBaisse(prix, baisse);
    if (!bloque && prix == null) bloque = 'Prix pas lu';
    else if (!bloque && baisse && baisse.ok && nouveau == null) bloque = 'Baisse plus grande que le prix';
    const p = plancherDe ? plancherDe(a) : null;
    const plancher = p && (p.etat === 'ok' || p.etat === 'partiel') && p.plancher != null ? { centimes: p.plancher, partiel: p.etat === 'partiel' } : null;
    const sousPlancher = !!(plancher && nouveau != null && nouveau * 100 < plancher.centimes);
    const achatPasSaisi = !!(p && p.etat === 'achat');
    return { ...a, uid, prix, nouveau, plancher, sousPlancher, achatPasSaisi, bloque, coche: !bloque && nouveau != null && !sousPlancher };
  });
}

// Les comptes à ouvrir (une phrase par compte, jamais par ligne : §7).
export function comptesAOuvrir(lignes) {
  const m = new Map();
  for (const l of lignes || []) if (l && l.bloque && /^Ouvre /.test(l.bloque)) m.set(l.bloque, (m.get(l.bloque) || 0) + 1);
  return [...m.entries()].map(([texte, n]) => ({ texte, n }));
}

// Ce qui arrête TOUTE la série (le suivant serait refusé pour la même raison, ou
// on ne sait plus ce qui se passe) — jamais « on continue quand même ».
const ARRET_SERIE = new Set(['plafond', 'plafond-bordereaux', 'vinted-pause', 'frein-refus', 'onglet-vinted', 'vinted-absent', 'vinted-autre', 'autre-compte', 'stockage', 'perime', 'confirmation', 'absente']);

// La réponse de l'extension (ou de `vmrCmdSuivi`) → l'état d'UNE ligne.
//   fait      : Vinted montre le nouveau prix (RELU) ;
//   ecart     : Vinted montre un autre prix (relu, dit tel quel) ;
//   incertain : envoyé, pas relu (ou pas de réponse) — jamais « fait » ;
//   echec     : Vinted a refusé : le prix n'a pas changé ;
//   refus     : rien n'est parti (raison dite).
// `prixVu` : le SEUL prix affiché après coup — celui que Vinted a montré, jamais supposé.
export function issueBaisse(r) {
  if (!r || r.sansReponse) return { etat: 'incertain', prixVu: null, raison: 'L’extension n’a pas répondu : regarde l’annonce sur Vinted', arret: true };
  if (r.envoye === false) return { etat: 'refus', prixVu: null, raison: r.raison || 'L’extension ne répond pas ici : rien n’est parti', arret: true };
  if (r.accepte !== true) {
    const vu = Number.isFinite(Number(r.prixVu)) && r.prixVu != null ? Number(r.prixVu) : null;
    return { etat: 'refus', prixVu: vu, code: r.code || '', raison: r.raison || r.error || 'Rien n’est parti', arret: ARRET_SERIE.has(String(r.code || '')) };
  }
  const vu = r.prixVu != null && Number.isFinite(Number(r.prixVu)) ? Number(r.prixVu) : null;
  if (r.etape === 'fait' && vu != null) return { etat: 'fait', prixVu: vu, raison: '', arret: false };
  if (r.etape === 'ecart' && vu != null) return { etat: 'ecart', prixVu: vu, raison: r.raison || '', arret: false };
  // Vinted a refusé : l'extension a posé son frein ⇒ la suite serait refusée sans rien envoyer.
  if (r.etape === 'echec') return { etat: 'echec', prixVu: vu, raison: r.raison || 'Vinted a refusé', arret: true };
  return { etat: 'incertain', prixVu: null, raison: r.raison || 'Envoyé, pas relu : regarde l’annonce sur Vinted', arret: false };
}

// Le récapitulatif de fin (une ligne, chiffres seulement).
export function bilanBaisse(etats) {
  const c = { fait: 0, ecart: 0, incertain: 0, echec: 0, refus: 0, pasEnvoye: 0 };
  for (const e of Object.values(etats || {})) {
    if (!e) continue;
    if (e.etat === 'pas-envoye') c.pasEnvoye++;
    else if (c[e.etat] != null) c[e.etat]++;
  }
  return c;
}

export const eurosBaisse = (v) => (v == null || !Number.isFinite(Number(v)) ? '—'
  : `${(Math.round(Number(v) * 100) / 100).toFixed(Number.isInteger(Math.round(Number(v) * 100) / 100) ? 0 : 2).replace('.', ',')} €`);
