// ══════════════════════════════════════════════════════════════════════════
//  LA MÊME PHOTO SUR DEUX ANNONCES EN LIGNE (22 nov. 2026, Julien — choix n° 35)
//  docs/passation/2026-11-22-offres-photos-resume.md
// ══════════════════════════════════════════════════════════════════════════
// « Même photo sur 2 annonces : N°142 et N°157 — la même paire en double ? » : deux annonces EN LIGNE différentes
// qui portent le MÊME FICHIER photo. C'est la règle d'identité existante (CLAUDE.md §5, `entryKeyByPhoto` /
// `jumellesParPhoto` : deux fiches au même fichier photo = la même paire), appliquée aux annonces en ligne :
//   · la clé est `photoKey` d'App.jsx (le sous-dossier ET le nom du fichier, la taille et l'hôte retirés) — le
//     fichier EXACT, jamais le dossier seul, jamais une ressemblance d'image, jamais le titre, la marque, la taille ;
//   · la photo de l'annonce, ou la clé `photoK` posée sur SA fiche au numérotage (`vinted_annonce_numeros[id]`).
// CE MODULE NE FAIT QUE SIGNALER : il ne modifie jamais une photo ni une annonce, ne relie rien, ne renumérote rien.
// Une paire VOLONTAIREMENT en plusieurs exemplaires (stock auto : une quantité ≥ 2 posée par lui sur son N°,
// `vinted_bleam.comptes[uid].stockAuto.stock`) n'est pas signalée. « Ce n'est pas un doublon » est mémorisé PAR
// GROUPE d'annonces (`vrm_photo_double_non`, synchronisé) : le même groupe ne revient plus ; une annonce de plus au
// même fichier fait un autre groupe, signalé.
// « En ligne » n'est PAS jugé ici : l'appelant passe les annonces que <enligne-regle> dit EN LIGNE (jamais « à
// confirmer », jamais masquées). Module PUR : scripts/audit-photo-en-double.cjs l'exécute.

export const CLE_PHOTO_DOUBLE_NON = 'vrm_photo_double_non';
const arr = (a) => (Array.isArray(a) ? a : []);
const str = (v) => (v == null ? '' : String(v).trim());
const cleDefaut = (n) => { const s = str(n).toUpperCase().replace(/[\s\-_.]/g, ''); return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s; };

// La clé d'un groupe : ses identifiants d'annonce, triés (« Ce n'est pas un doublon » se mémorise sous elle).
export const cleGroupe = (ids) => [...new Set(arr(ids).map(String))].sort().join(',');

// Les N° (clés) qu'il a posés en plusieurs exemplaires (stock auto, quantité ≥ 2), sur tous ses comptes.
export function numerosEnExemplaires(bleam, cle = cleDefaut) {
  const out = new Set();
  const comptes = bleam && typeof bleam === 'object' && bleam.comptes && typeof bleam.comptes === 'object' ? bleam.comptes : {};
  for (const c of Object.values(comptes)) {
    const st = c && c.stockAuto && typeof c.stockAuto === 'object' && c.stockAuto.stock && typeof c.stockAuto.stock === 'object' ? c.stockAuto.stock : {};
    for (const [n, q] of Object.entries(st)) if (Number.isInteger(Number(q)) && Number(q) >= 2 && cle(n)) out.add(cle(n));
  }
  return out;
}

// annonces : [{ id, compte, pseudo, photo, titre, prix, url }] — EN LIGNE (l'appelant l'a jugé) ;
// fiches : `vinted_annonce_numeros` ; clePhoto : `photoKey` ; exemplaires : Set de clés de N° ; refus : { [cleGroupe]: at }.
// Rend { groupes: [{ cle, annonces, numeros, photo }], ecartes: { exemplaires, refus } } — groupes du plus grand N° d'abord.
export function photosEnDouble({ annonces, fiches = null, clePhoto, cle = cleDefaut, exemplaires = null, refus = null } = {}) {
  const F = fiches && typeof fiches === 'object' ? fiches : {};
  const R = refus && typeof refus === 'object' ? refus : {};
  const parts = [], vus = new Set();
  for (const a of arr(annonces)) {
    if (!a || a.id == null || vus.has(String(a.id))) continue;
    vus.add(String(a.id));
    const f = F[String(a.id)] || {};
    const cles = [...new Set([typeof clePhoto === 'function' && a.photo ? clePhoto(a.photo) : '', str(f.photoK)].filter(Boolean))];
    if (!cles.length) continue;
    parts.push({ ...a, id: String(a.id), numero: str(f.numero) || str(a.numero), cles });
  }
  const parent = parts.map((_, i) => i);
  const racine = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const parCle = new Map();
  parts.forEach((p, i) => { for (const k of p.cles) { if (parCle.has(k)) parent[racine(i)] = racine(parCle.get(k)); else parCle.set(k, i); } });
  const groupes = new Map();
  parts.forEach((p, i) => { const r = racine(i); if (!groupes.has(r)) groupes.set(r, []); groupes.get(r).push(p); });
  const out = [], ecartes = { exemplaires: 0, refus: 0 };
  for (const g of groupes.values()) {
    if (g.length < 2) continue;
    const c = cleGroupe(g.map((p) => p.id));
    const nums = [...new Set(g.map((p) => p.numero).filter(Boolean))];
    if (exemplaires && typeof exemplaires.has === 'function' && nums.some((n) => exemplaires.has(cle(n)))) { ecartes.exemplaires++; continue; }
    if (R[c]) { ecartes.refus++; continue; }
    const tri = [...g].sort((x, y) => String(x.numero).localeCompare(String(y.numero), 'fr', { numeric: true }) || x.id.localeCompare(y.id));
    out.push({ cle: c, numeros: nums.sort((x, y) => x.localeCompare(y, 'fr', { numeric: true })), photo: tri[0].photo || null,
      annonces: tri.map((p) => ({ id: p.id, compte: str(p.compte), pseudo: str(p.pseudo), titre: str(p.titre), photo: p.photo || null, prix: p.prix == null ? null : p.prix, numero: p.numero, url: str(p.url) })) });
  }
  out.sort((a, b) => String(a.numeros[0] || '~').localeCompare(String(b.numeros[0] || '~'), 'fr', { numeric: true }) || a.cle.localeCompare(b.cle));
  return { groupes: out, ecartes };
}

// « Ce n'est pas un doublon » : le registre d'après, SON geste (jamais posé seul).
export function refuserGroupe(refus, c, maintenant = Date.now()) {
  const R = refus && typeof refus === 'object' && !Array.isArray(refus) ? refus : {};
  if (!c) return R;
  return { ...R, [c]: maintenant };
}
// Les ids d'annonce signalés (le filtre « Photo en double » d'Annonces).
export const idsEnDouble = (res) => new Set(arr(res && res.groupes).flatMap((g) => g.annonces.map((a) => a.id)));
