// ════════════════════════════════════════════════════════════════════════════
//  LE CONTRÔLE AVANT DE LANCER UNE REPUBLICATION (20 nov., extension 5.410 — `repubverif`)
// ════════════════════════════════════════════════════════════════════════════
// Julien : « plus d'intelligence, même dans la republication, car les catégories sont parfois mal
// remplies et ça bloque côté Vinted ». L'extension LIT chaque annonce choisie chez Vinted (son
// formulaire, la grille de sa catégorie) et rend, par annonce : ok · corrige (déduit d'une donnée
// sûre, montré) · a-corriger (UNE question, valeurs de Vinted) · absente · pas-verifie.
// Règle PURE de l'atelier (src/ecrans/Republier.jsx), exécutée par scripts/audit-repub-verifier.cjs :
//   · rien ne part tant qu'il reste une annonce « à corriger » (le bouton Lancer est fermé, dit) ;
//   · une annonce « absente » (Vinted dit qu'elle n'existe plus) ne part pas ;
//   · « pas vérifiée » ne bloque pas : l'extension la vérifie à son départ, comme avant (rien ne
//     part incomplet, aucun secours silencieux) — et c'est dit ;
//   · sa réponse à une question voyage avec SA paire (`reponses`), jamais avec une autre.
export const ETATS_VERIF = Object.freeze(['ok', 'corrige', 'a-corriger', 'absente', 'pas-verifie']);

const str = (v) => String(v == null ? '' : v);
const champOk = (c) => /^[a-z_]{1,40}$/.test(str(c));

// Une réponse de l'extension pour UNE annonce, nettoyée (forme inconnue ⇒ null).
export function paireVerif(p) {
  if (!p || typeof p !== 'object' || !/^\d{4,15}$/.test(str(p.id)) || !ETATS_VERIF.includes(p.etat)) return null;
  const corrections = Array.isArray(p.corrections) ? p.corrections.filter((c) => c && champOk(c.champ)).slice(0, 10).map((c) => ({ champ: c.champ, nom: str(c.nom).slice(0, 60), raison: str(c.raison).slice(0, 300) })) : [];
  const manque = Array.isArray(p.manque) ? p.manque.map((x) => str(x).slice(0, 200)).filter(Boolean).slice(0, 10) : [];
  const q = p.question && typeof p.question === 'object' && champOk(p.question.champ) ? p.question : null;
  return { id: str(p.id), etat: p.etat, corrections, manque, question: q, raison: str(p.raison).slice(0, 400) };
}

// Le récapitulatif : combien vérifiées, prêtes, corrigées seules, à corriger, absentes, pas vérifiées.
export function resumeVerif(ids, verif) {
  const v = verif && typeof verif === 'object' ? verif : {};
  const r = { total: 0, ok: 0, corrige: 0, aCorriger: 0, absente: 0, pasVerifie: 0, aCorrigerIds: [], absentes: [] };
  for (const id0 of Array.isArray(ids) ? ids : []) {
    const id = str(id0); r.total++;
    const p = v[id];
    if (!p || p.etat === 'pas-verifie') { r.pasVerifie++; continue; }
    if (p.etat === 'ok') r.ok++;
    else if (p.etat === 'corrige') r.corrige++;
    else if (p.etat === 'a-corriger') { r.aCorriger++; r.aCorrigerIds.push(id); }
    else if (p.etat === 'absente') { r.absente++; r.absentes.push(id); }
  }
  r.verifiees = r.ok + r.corrige + r.aCorriger + r.absente;
  r.bloque = r.aCorriger > 0;
  return r;
}

// Le bouton Lancer : fermé pendant la vérification et tant qu'il reste une annonce à corriger.
export function lancerPermis(ids, verif, enCours) {
  if (enCours) return { ok: false, raison: 'verification' };
  const r = resumeVerif(ids, verif);
  if (r.bloque) return { ok: false, raison: 'a-corriger', n: r.aCorriger };
  if (r.total && r.absente === r.total) return { ok: false, raison: 'toutes-absentes' };
  return { ok: true };
}

// Une annonce que la vérification a prouvée absente ne part jamais.
export function partiraPas(verif, id) { const p = verif && verif[str(id)]; return !!(p && p.etat === 'absente'); }

// SA réponse, pour SA paire seulement ({ champ: valeur }) — jamais celle d'une autre.
export function reponsesDe(verif, id) {
  const p = verif && verif[str(id)];
  const r = p && p.rep && typeof p.rep === 'object' && !Array.isArray(p.rep) ? p.rep : null;
  if (!r) return undefined;
  const o = {}; for (const k of Object.keys(r)) if (champOk(k) && /^\d{1,12}$/.test(str(r[k]))) o[k] = str(r[k]);
  return Object.keys(o).length ? o : undefined;
}
