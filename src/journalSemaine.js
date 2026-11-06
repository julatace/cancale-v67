// ═══════════════════════════════════════════════════════════════════════════
// LE JOURNAL DE LA SEMAINE, EN TÊTE DE MA JOURNÉE (4 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : du lundi au dimanche, en tête de Ma journée, une carte « Semaine du
// 27 oct. » — la semaine PASSÉE (lundi 00:00 → lundi 00:00, heure de Paris) en
// quatre chiffres. Repliable. AUCUNE notification (il a refusé les rappels ; le
// bilan du dimanche soir existant n'est pas touché).
//
// AUCUNE RÈGLE ICI (§11) — chaque chiffre est celui de sa règle propriétaire :
//   · la semaine        = `semainePassee` (api/_lib/bilan-semaine.js, la borne
//                         du bilan hebdomadaire, juste au passage à l'heure d'hiver) ;
//   · ventes, CA vendu  = `bilanLignes` sur les lignes de `ventesFaites` ;
//   · bénéfice          = « Bénéfice brut » (`beneficeDesJours` sur la publication
//                         `vrm_benefice_jours`, `chiffreBrut`) : une semaine n'a ni
//                         dépenses ni URSSAF à elle (décision du 3 nov., le nom de
//                         la tuile Semaine de Statistiques) ;
//   · colis envoyés     = ses gestes « Colis fait » datés dans la semaine
//                         (Vinted `vinted_ship_done`, Leboncoin
//                         `vrm_lbc_colis_done`, Vestiaire `vrm_vc_colis_done` —
//                         les tables des « déposés » de Colis). eBay ne garde aucune
//                         date d'envoi : une vente eBay dans la semaine rend le
//                         nombre « au moins », eBay nommé.
// Trois états (§5) : `null` = pas su (« — ») ; `partiel` = « au moins », le
// manque NOMMÉ. Exécuté par scripts/audit-journal-semaine.cjs.

const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const titreSemaine = (lundi) => {
  const [, m, d] = String(lundi).split('-').map(Number);
  return `Semaine du ${d === 1 ? '1er' : d} ${MOIS_COURT[m - 1] || ''}`.trim();
};

const msDe = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === 'string' && v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  return null;
};
const compterGestes = (table, debut, fin) => {
  if (!table || typeof table !== 'object') return null;
  let n = 0;
  for (const v of Object.values(table)) { const t = msDe(v); if (t != null && t >= debut && t < fin) n++; }
  return n;
};
const pasSu = (raison) => ({ valeur: null, partiel: false, manque: [], raison });

// `vendu` : { lignes, manque, nonComptees } | null ; `joursBenef` : la
// publication `vrm_benefice_jours` | null ; `colisFaits` : { vinted, lbc, vc }
// (chaque table { id: date } | null pas su).
export function journalSemaine({ maintenant = Date.now(), vendu, joursBenef, colisFaits = {}, R } = {}) {
  const S = R.semainePassee(maintenant);
  const { debut, fin } = S;
  const out = { lundi: S.lundi, dimanche: S.dimanche, debut, fin, titre: titreSemaine(S.lundi) };

  // (6 nov., onglets A, §5) `vendu` undefined = la coque n'a pas encore rendu ses ventes : « lecture… ».
  if (vendu === undefined) { out.ventes = pasSu('encours'); out.vendu = pasSu('encours'); }
  else if (!vendu || !Array.isArray(vendu.lignes)) { out.ventes = pasSu('pasSu'); out.vendu = pasSu('pasSu'); }
  else {
    const r = R.bilanLignes(vendu.lignes, debut, fin - 1);
    const nc = (vendu.nonComptees || []).filter((x) => x && x.ts != null && x.ts >= debut && x.ts < fin);
    const manque = [...new Set([...(vendu.manque || []), ...nc.map((x) => x.plateforme)])];
    const partiel = manque.length > 0;
    const un = (v) => (partiel && !(v > 0) ? pasSu('partiel') : { valeur: v, partiel, manque, raison: '' });
    out.ventes = un(r.n); out.vendu = un(r.eur);
  }

  if (!joursBenef || !joursBenef.jours) out.brut = pasSu('publication');
  else {
    const B = R.beneficeDesJours(joursBenef.jours, new Date(debut), new Date(fin));
    const CB = R.chiffreBrut(B);
    out.brut = CB.valeur == null ? { ...pasSu('achats'), n: CB.n, nCout: CB.nCout }
      : { valeur: CB.valeur, partiel: !!CB.partiel, manque: [], raison: '', n: CB.n, nCout: CB.nCout, couverture: CB.partiel ? `${CB.nCout} sur ${CB.n}` : '' };
  }

  const tables = [colisFaits.vinted, colisFaits.lbc, colisFaits.vc];
  if (tables.some((t) => t === null || t === undefined)) out.colis = pasSu('pasSu');
  else if (vendu === undefined) out.colis = pasSu('encours');
  else {
    const n = tables.reduce((t, x) => t + compterGestes(x, debut, fin), 0);
    const ebaySemaine = vendu && Array.isArray(vendu.lignes) && vendu.lignes.some((l) => l && l.plateforme === 'eBay' && l.ts >= debut && l.ts < fin);
    // (6 nov., onglets A) « 0 COLIS ENVOYÉS » ÉTAIT UN « PAS SU ». Ses gestes « Colis fait » sont la
    // seule date d'envoi ; mesuré sur sa base : 26 gestes depuis l'été, 0 la semaine passée, pour
    // une vingtaine de ventes Vinted à envoyer. Une vente Vinted vendue dans la semaine ou les 7
    // jours d'avant, sans geste NULLE PART (ni avant, ni pendant, ni après), a pu partir pendant la
    // semaine sans être notée : le nombre n'est plus qu'un minimum (« au moins »), et zéro geste
    // ⇒ « — » avec sa raison — jamais « 0 » présenté comme un fait (§5).
    const t7 = debut - 7 * 86400000;
    const notes = colisFaits.vinted || {};
    const nonNotees = vendu && Array.isArray(vendu.lignes) ? vendu.lignes.filter((l) => l && l.plateforme === 'Vinted' && l.tx && l.ts >= t7 && l.ts < fin
      && !Object.prototype.hasOwnProperty.call(notes, String(l.tx))).length : 0;
    const ventesLues = !!(vendu && Array.isArray(vendu.lignes));
    const manque = [...(ebaySemaine ? ['eBay'] : []), ...(nonNotees ? ['envois pas notés'] : []), ...(ventesLues ? [] : ['ventes pas lues'])];
    out.colis = manque.length && !(n > 0) ? { ...pasSu(nonNotees ? 'nonNotes' : 'partiel'), manque, nonNotees } : { valeur: n, partiel: manque.length > 0, manque, raison: '', nonNotees };
  }
  return out;
}

// Replié pour CETTE semaine seulement (une nouvelle semaine se montre ouverte).
export const repliePourSemaine = (memo, lundi) => !!memo && String(memo) === String(lundi);
