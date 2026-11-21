// ════════════════════════════════════════════════════════════════════════════
//  LA DATE DE VERSEMENT PAR LE RELEVÉ DU PORTE-MONNAIE (6 nov., extension 5.323)
// ════════════════════════════════════════════════════════════════════════════
// Le CA déclaré est daté au jour du VERSEMENT (§5). La source de toujours est la
// transaction « Commande finalisée » (statut 450, `status_updated_at`) — mais
// 1 777 ventes (80 891 €) n'en ont pas (« à dater »). Le relevé du porte-monnaie
// (`harvest_{uid}_releve_{mois}`, rangé par l'extension 5.323, `lignes[]`) date
// chaque mouvement crédité.
// ⚠️ UNE VENTE N'EST DATÉE PAR LE RELEVÉ QUE PAR SON IDENTITÉ (§5) : une ligne
//    qui PORTE son n° de transaction (`tx`, posé par l'extension seulement quand
//    la ligne a une clé `transaction_id`, ou une nature « transaction » et son
//    identifiant). JAMAIS par un montant ou une date qui se ressemblent : deux
//    ventes au même prix le même jour sont courantes, un faux mois de CA ne se
//    voit pas. La forme réelle d'une ligne de VENTE n'a pas encore été mesurée :
//    tant qu'aucune ligne ne porte `tx`, ce module ne date RIEN.
// ⚠️ Seulement un CRÉDIT (montant > 0), pas « en attente » (l'argent n'est pas
//    encore là), daté, en euros quand la devise est dite (une autre devise est
//    écartée, jamais convertie — §3 International), et pas un virement vers SA
//    banque (`quoi: 'payout'`, un déplacement entre ses comptes).
// ⚠️ « Une date lue gagne toujours » — et la transaction 450 reste la règle :
//    le relevé ne fait que COMPLÉTER une vente qu'elle ne date pas. Deux lignes
//    de relevé pour la même vente avec deux jours différents ⇒ « pas su » pour
//    elle (aucune date plutôt qu'un choix au hasard).

const ISO = /^\d{4}-\d{2}-\d{2}/;

// rows : [{ id, l: lignes[] }] (projection `select=id,l:data->lignes`) · `null` = pas su.
// Rend tx → date ISO (`null` si `rows` est `null`).
export function versementsDuReleve(rows) {
  if (!Array.isArray(rows)) return null;
  const vus = new Map();          // tx → Set(jours)
  const dates = new Map();        // tx → date ISO (la première vue)
  for (const r of rows) {
    const lignes = r && Array.isArray(r.l) ? r.l : [];
    for (const x of lignes) {
      if (!x || typeof x !== 'object') continue;
      const tx = x.tx == null ? '' : String(x.tx);
      if (!/^\d{3,20}$/.test(tx)) continue;                       // pas d'identité : rien
      const m = Number(x.montant);
      if (!(isFinite(m) && m > 0)) continue;                        // un crédit seulement
      if (x.attente === true) continue;                             // pas encore versé
      if (x.quoi === 'payout') continue;                            // virement vers SA banque
      if (x.devise && x.devise !== 'EUR') continue;                 // jamais convertie
      const d = String(x.date || '');
      if (!ISO.test(d) || isNaN(Date.parse(d))) continue;
      if (!vus.has(tx)) { vus.set(tx, new Set()); dates.set(tx, d); }
      vus.get(tx).add(d.slice(0, 10));
    }
  }
  const out = {};
  for (const [tx, jours] of vus) if (jours.size === 1) out[tx] = dates.get(tx);   // deux jours ⇒ pas su
  return out;
}

// La transaction 450 d'abord (règle de toujours) ; le relevé complète. `null` reste `null`.
export function completerVersementsParReleve(map450, mapReleve) {
  if (map450 == null) return map450;
  if (!mapReleve) return map450;
  const out = Object.assign({}, map450);
  const parReleve = new Set();
  for (const [tx, d] of Object.entries(mapReleve)) if (out[tx] == null) { out[tx] = d; parReleve.add(tx); }
  // (11 nov., lot DJ7) Lesquelles le relevé a datées : propriété NON énumérable
  // (les lecteurs de la carte tx → date n'en voient rien), lue par `versementsParReleve`.
  Object.defineProperty(out, PAR_RELEVE, { value: parReleve, enumerable: false });
  return out;
}

const PAR_RELEVE = '__vrmParReleve';
// Les n° de transaction datés par le relevé (et non par la transaction 450). Toujours un Set.
export function versementsParReleve(map) {
  const s = map && map[PAR_RELEVE];
  return s instanceof Set ? s : new Set();
}

// ════════════════════════════════════════════════════════════════════════════
//  (15 nov.) LE RELEVÉ NE DATE RIEN AVANT D'AVOIR ÉTÉ COMPARÉ — COMPTE PAR COMPTE
// ════════════════════════════════════════════════════════════════════════════
// La date de versement de VRM = le jour où la vente est créditée, c'est-à-dire la
// transaction « Commande finalisée » (450, `status_updated_at`). Une ligne du relevé
// porte SON n° de transaction (identité, §5) — mais rien ne PROUVE encore que sa
// date est la MÊME notion (elle pourrait être celle du paiement, de l'envoi, du
// virement…). Avant de lui faire confiance, on compare : pour chaque vente du relevé
// qui a AUSSI un détail 450, les deux dates doivent tomber le même jour (heure de
// Paris). Un compte n'est « vérifié » qu'avec au moins `RELEVE_ACCORDS_MIN` accords
// et AUCUN désaccord ; sinon le relevé de ce compte ne date RIEN (« pas su », dit à
// l'écran : « dates du relevé pas encore vérifiées »). Le détail 450 gagne toujours.
// POURQUOI 5 (mesuré le 15 nov., lecture seule, tous comptes) : sur 469 ventes
// finalisées dont on a les deux dates, la vente et la finalisation ne tombent JAMAIS
// le même jour (0 / 469, 10,3 jours d'écart en moyenne). Une date de relevé qui
// serait celle du paiement (ou de tout autre moment de la vie de la commande) se
// trahit donc sur CHAQUE vente comparée : 5 accords de suite par hasard sont
// impossibles en pratique, et un seul désaccord ferme le compte. Plus haut (30, 50),
// les petits comptes (7 à 10 détails) ne seraient jamais vérifiés, sans rien gagner
// contre une erreur qui est, par nature, systématique.
export const RELEVE_ACCORDS_MIN = 5;

let FMT_PARIS = null;
// Le jour (AAAA-MM-JJ) d'un instant, heure de Paris. `null` = date illisible.
export function jourParis(d) {
  const t = Date.parse(String(d == null ? '' : d));
  if (!Number.isFinite(t)) return null;
  try {
    if (!FMT_PARIS) FMT_PARIS = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
    const p = {}; for (const x of FMT_PARIS.formatToParts(t)) p[x.type] = x.value;
    return p.year && p.month && p.day ? `${p.year}-${p.month}-${p.day}` : null;
  } catch (_) { return null; }
}

const uidDuReleve = (id) => { const m = /^harvest_(\d+)_releve_/.exec(String(id || '')); return m ? m[1] : null; };

// releveRows : [{ id, l }] · txn : [{ tx, s, su }] (`meta->>`). Rend, par compte (uid du
// relevé) : { accords, desaccords, compares, lignes (ventes du relevé), etat } où etat ∈
// 'verifie' | 'desaccord' | 'a-verifier' (moins de N accords) | 'sans-recouvrement'.
// `null` si l'une des deux lectures est `null` (pas su : rien n'est vérifié).
export function verifierReleve(releveRows, txn, min = RELEVE_ACCORDS_MIN) {
  if (!Array.isArray(releveRows) || !Array.isArray(txn)) return null;
  // La référence : tx → jour de Paris de la transaction 450 ; deux jours ⇒ pas de référence.
  const ref = new Map();
  for (const r of txn) {
    if (!r || String(r.s) !== '450') continue;
    const tx = r.tx == null ? '' : String(r.tx).trim();
    const j = jourParis(r.su);
    if (!/^\d{1,20}$/.test(tx) || !j) continue;
    const q = ref.get(tx);
    if (q === undefined) ref.set(tx, j); else if (q !== j) ref.set(tx, false);
  }
  const par = {};
  for (const r of releveRows) {
    const uid = uidDuReleve(r && r.id);
    if (!uid) continue;
    const carte = versementsDuReleve([r]) || {};
    const vus = par[uid] || (par[uid] = new Map());
    for (const [tx, d] of Object.entries(carte)) {
      const j = jourParis(d);
      if (!j) continue;
      const av = vus.get(tx);
      if (av === undefined) vus.set(tx, j); else if (av !== j) vus.set(tx, false);   // deux mois disent deux jours ⇒ pas su
    }
  }
  const out = {};
  for (const [uid, vus] of Object.entries(par)) {
    const c = { accords: 0, desaccords: 0, compares: 0, lignes: 0 };
    for (const [tx, j] of vus) {
      if (j === false) continue;
      c.lignes += 1;
      const rj = ref.get(tx);
      if (!rj) continue;                       // pas de détail 450 (ou deux jours) : rien à comparer
      c.compares += 1;
      if (rj === j) c.accords += 1; else c.desaccords += 1;
    }
    c.etat = c.desaccords > 0 ? 'desaccord' : c.accords >= min ? 'verifie' : c.compares === 0 ? 'sans-recouvrement' : 'a-verifier';
    out[uid] = c;
  }
  return out;
}

// LA voie du relevé pour la règle du CA déclaré : tx → date, SEULEMENT des comptes
// vérifiés. `null` = relevé illisible (comme `versementsDuReleve`) ; détails illisibles ⇒
// `{}` (rien n'est vérifiable, rien n'est daté par le relevé). Le verdict par compte est
// porté par la carte, non énumérable (`verifReleve(carte)`).
const VERIF = '__vrmReleveVerif';
export function versementsDuReleveVerifies(releveRows, txn, min = RELEVE_ACCORDS_MIN) {
  if (!Array.isArray(releveRows)) return null;
  const verif = verifierReleve(releveRows, txn, min);
  const ok = new Set(Object.entries(verif || {}).filter(([, v]) => v.etat === 'verifie').map(([u]) => u));
  const carte = versementsDuReleve(releveRows.filter((r) => ok.has(uidDuReleve(r && r.id)))) || {};
  Object.defineProperty(carte, VERIF, { value: verif, enumerable: false });
  return carte;
}
// Le verdict par compte (`null` = pas su). Lit la carte du relevé OU la carte finale
// (`fetchVersementsVinted` le recopie sur la carte de `datesDeVersement`).
export function verifReleve(carte) {
  const v = carte && carte[VERIF];
  return v && typeof v === 'object' ? v : null;
}
export function porterVerifReleve(cible, carteReleve) {
  if (cible && typeof cible === 'object' && !Object.prototype.hasOwnProperty.call(cible, VERIF)) Object.defineProperty(cible, VERIF, { value: verifReleve(carteReleve), enumerable: false });
  return cible;
}
// Les comptes dont le relevé porte des ventes mais ne date encore rien (l'écran le DIT).
// nomDe(uid) → nom affiché. Rend [{ uid, nom, lignes, accords, desaccords, etat, min }].
export function relevesNonVerifies(carte, nomDe, min = RELEVE_ACCORDS_MIN) {
  const v = verifReleve(carte);
  if (!v) return [];
  return Object.entries(v)
    .filter(([, x]) => x && x.lignes > 0 && x.etat !== 'verifie')
    .map(([uid, x]) => ({ uid, nom: typeof nomDe === 'function' ? (nomDe(uid) || '') : '', lignes: x.lignes, accords: x.accords, desaccords: x.desaccords, etat: x.etat, min }))
    .sort((a, b) => b.lignes - a.lignes);
}
