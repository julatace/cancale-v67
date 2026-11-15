// ═══════════════════════════════════════════════════════════════════════════
// LE BILAN DE FIN DE MOIS — CE QUI S'AJOUTE AU « BILAN DU MOIS » (15 nov., lot argent-plus)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (« vas-y fais tout ») : le 1er du mois, le récap du mois écoulé — vendu,
// reçu (au versement), bénéfice et sa couverture, URSSAF à déclarer (régime choisi,
// sinon « choisis ton régime »), meilleur compte, articles qui dorment — en
// notification ET à l'écran, plus un export (tableur + PDF).
//
// Le bilan existe déjà (src/bilanMois.js, carte « Bilan du mois » de l'écran Argent,
// et son PDF ; l'e-mail du 1er api/_lib/bilan-mois.js). Ce module n'ajoute que les DEUX
// lignes qui manquaient et le tableur, SANS AUCUNE RÈGLE NEUVE (§5) :
//   · l'URSSAF du mois = `montantPeriodeUrssaf` (la règle de la carte « Prochaine
//     déclaration », du rappel et de la notification du 1er) sur le MOIS, la ligne
//     publiée par Ventes (`vinted_urssaf_mois`, datée au VERSEMENT), le taux réglé —
//     passée déjà calculée. Ici seulement les états :
//       'encours' (réglage pas encore arrivé) · 'regime' (aucun régime choisi : le
//       geste « choisis ton régime », jamais deviné) · 'autre' (particulier, société,
//       marge : aucune cotisation micro calculée) · 'passu' (rien de publié pour ce
//       mois : « — ») · 'su' (le montant, « au moins » quand la règle le dit ; jamais
//       « au moins 0 », §5) ;
//   · les articles qui dorment = `dormentDe` (api/_lib/bilan-semaine.js : la règle du
//     bilan de la semaine ET de « Ma semaine ») sur la publication de l'écran Annonces
//     (`vrm_paires_dorment`) — pas su ⇒ « — ».
// Les textes passent par `T` (le `tr` de l'app ; l'audit passe le sien) : aucun mot ici
// n'est affiché sans traduction. Module PUR : l'app, le serveur et l'audit l'importent.
// Exécuté par scripts/audit-argent-plus.cjs.
// ═══════════════════════════════════════════════════════════════════════════

const r2 = (x) => Math.round(Number(x) * 100) / 100;

// ── L'URSSAF DU MOIS ────────────────────────────────────────────────────────
// `regime` : 'micro' | 'particulier' | 'societe' | 'marge' | null (pas choisi) |
//            undefined (pas encore lu) ;
// `montant` : la sortie de `montantPeriodeUrssaf` ({ ca, apayer, partiel }) ou null.
export function urssafDuBilan({ regime, montant = null } = {}) {
  if (regime === undefined) return { etat: 'encours', apayer: null, auMoins: false, regime };
  if (regime == null) return { etat: 'regime', apayer: null, auMoins: false, regime: null };
  if (regime !== 'micro') return { etat: 'autre', apayer: null, auMoins: false, regime };
  const a = montant && montant.apayer != null && Number.isFinite(Number(montant.apayer)) ? r2(montant.apayer) : null;
  if (a == null) return { etat: 'passu', apayer: null, auMoins: false, regime };
  // « Au moins 0,00 € » ne se dit jamais (§5) : un minimum nul n'est pas un montant.
  if (montant.partiel && !(a > 0)) return { etat: 'passu', apayer: null, auMoins: false, regime };
  return { etat: 'su', apayer: a, auMoins: !!montant.partiel, regime };
}

// ── LES DEUX LIGNES QUI S'AJOUTENT AU BILAN ─────────────────────────────────
// Même forme que les lignes de `bilanDuMois` (cle, nom, valeur, auMoins, note, type) :
// la carte, son PDF et le tableur les écrivent sans rien savoir d'elles.
// `dorment` : la sortie de `dormentDe` ({ etat: 'su' | 'pas-su', n, auMoins }) ou null.
export function lignesFinMois({ urssaf = null, dorment = null } = {}, T = (k) => k) {
  const out = [];
  if (urssaf) {
    const note = {
      encours: T('argentPlus.bilan.urssafEncours'),
      regime: T('argentPlus.bilan.urssafRegime'),
      autre: T('argentPlus.bilan.urssafAutre'),
      passu: T('argentPlus.bilan.urssafPasSu'),
      su: T('argentPlus.bilan.urssafSu'),
    }[urssaf.etat] || '';
    out.push({ cle: 'urssaf', nom: T('argentPlus.bilan.urssaf'), valeur: urssaf.etat === 'su' ? urssaf.apayer : null, auMoins: urssaf.etat === 'su' && urssaf.auMoins,
      note, type: 'eur', geste: urssaf.etat === 'regime' ? 'regime' : null, etat: urssaf.etat });
  }
  if (dorment) {
    const su = dorment.etat === 'su' && Number.isFinite(Number(dorment.n));
    // « Au moins 0 » ne se dit pas non plus pour un compte : un minimum nul ⇒ « — ».
    const valeur = su && !(dorment.auMoins && !(Number(dorment.n) > 0)) ? Number(dorment.n) : null;
    out.push({ cle: 'dorment', nom: T('argentPlus.bilan.dorment'), valeur, auMoins: valeur != null && !!dorment.auMoins,
      note: valeur == null ? T('argentPlus.bilan.dormentPasSu') : T('argentPlus.bilan.dormentNote'), type: 'n', etat: valeur == null ? 'passu' : 'su' });
  }
  return out;
}

// ── LE TABLEUR DU BILAN ─────────────────────────────────────────────────────
// Les MÊMES lignes que la carte et le PDF (aucune valeur recalculée) : une ligne par
// chiffre, la valeur en nombre (virgule décimale) ou vide pour « pas su », « au moins »
// dans sa colonne, la note. `csvDe` (src/exportDonnees.js) l'écrit (BOM, « ; »).
const nb = (v, type) => (v == null || !Number.isFinite(Number(v)) ? '' : type === 'eur' ? r2(v).toFixed(2).replace('.', ',') : String(v));
export function lignesTableurBilan(D, T = (k) => k) {
  if (!D || !Array.isArray(D.lignes)) return null;
  const L = [[T('argentPlus.csv.ligne'), T('argentPlus.csv.valeur'), T('argentPlus.csv.unite'), T('argentPlus.csv.auMoins'), T('argentPlus.csv.note')]];
  for (const l of D.lignes) L.push([l.nom, nb(l.valeur, l.type), l.type === 'eur' ? '€' : '', l.valeur != null && l.auMoins ? T('argentPlus.csv.oui') : '', l.note || '']);
  L.push([T('argentPlus.csv.meilleur'), D.meilleur ? D.meilleur.nom : '', '', '', D.meilleur ? `${D.meilleur.n} · ${nb(D.meilleur.eur, 'eur')} €` : '']);
  return L;
}
export const nomFichierTableurBilan = (ym) => `Bilan-${ym}.csv`;

// ── CE QUE LA NOTIFICATION DU 1er DIT ───────────────────────────────────────
// Les DONNÉES (jamais un texte) : le texte est fabriqué par la règle de rédaction
// (api/_lib/notif-redaction.js, sorte `bilanMois`) dans la langue du vendeur.
// `b` = `calculerBilanMois` (api/_lib/bilan-mois.js) ; `urssaf` = `urssafDuBilan` ;
// `dorment` = `dormentDe`. Un chiffre partiel nul s'écrit « — » (ici : absent).
export function donneesNotifBilan(b, { urssaf = null, dorment = null } = {}) {
  if (!b) return null;
  const val = (etat, x) => (etat === 'pas-su' || (etat === 'partiel' && !(Math.abs(Number(x)) > 0)) ? null : { eur: r2(x), auMoins: etat === 'partiel' });
  const v = b.vendu || {}, r = b.recu || {};
  const d = dorment && dorment.etat === 'su' && Number.isFinite(Number(dorment.n)) && !(dorment.auMoins && !(dorment.n > 0)) ? { n: Number(dorment.n), auMoins: !!dorment.auMoins } : null;
  return {
    sorte: 'bilanMois', ym: b.mois,
    vendu: val(v.etat, v.eur), n: v.etat === 'pas-su' ? null : Number(v.n) || 0,
    recu: val(r.etat, r.eur),
    urssaf: urssaf ? { etat: urssaf.etat, apayer: urssaf.etat === 'su' ? urssaf.apayer : null, auMoins: urssaf.etat === 'su' && !!urssaf.auMoins } : null,
    dorment: d,
  };
}
// Rien à dire (aucun chiffre d'argent lisible) ⇒ rien ne part (la règle de l'e-mail).
export const notifBilanAEnvoyer = (p) => !!p && (p.vendu != null || p.recu != null);
