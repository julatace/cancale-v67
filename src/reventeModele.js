// ════════════════════════════════════════════════════════════════════════════
//  CE QUE TU AS RÉELLEMENT REVENDU CE MODÈLE (10 nov., lot AV, proposition 5)
// ════════════════════════════════════════════════════════════════════════════
// Sur la fiche d'un achat et à la saisie d'un achat : ce que LUI a réellement
// vendu ce modèle les dernières fois — prix de vente médian, bénéfice médian,
// délai de vente, « sur N ventes ». Le PASSÉ, jamais un conseil : aucun « prix
// conseillé » (refusé le 11 oct.), aucune phrase « vends à… ».
//
// Les ventes : le relevé de l'écran Ventes (`vrm_stats_ventes`, §11 — ventes
// FINALISÉES, donc prouvées, §5 « Vendue se prouve » ; prix d'achat relié par
// IDENTITÉ seulement). Rien n'est relu ici, rien n'est écrit.
//
// Le regroupement par modèle est une PROPOSITION d'affichage (ressemblance
// permise, §5) : la règle `modeleSur` de « Ce qui rapporte » (src/ceQuiRapporte.js,
// une seule définition), lue sur le titre de LA vente — jamais une identité,
// jamais une liaison, jamais une action. Modèle pas sûr ⇒ rien n'est dit.
//
// Les chiffres disent leur couverture (§5) :
//   · prix de vente médian : sur les N ventes retenues (les plus récentes) ;
//   · bénéfice médian : la règle `beneficePaire` (vente − prix d'achat SAISI −
//     frais saisis), sur les seules ventes au prix d'achat connu (« sur K ») ;
//     aucune ⇒ null (« — »), jamais 0 ;
//   · délai : de la mise en ligne (annonce reliée par SA transaction, donnée par
//     l'appelant) à la vente ; aucune date ⇒ null.
// Moins de 3 ventes ⇒ « pas assez de ventes » (une médiane de 1 ou 2 ventes ne
// dit rien). Module PUR : scripts/audit-revente-modele.cjs l'EXÉCUTE.
import { modeleSur } from './ceQuiRapporte.js';
import { beneficePaire } from './beneficePaire.js';

export const MIN_VENTES_MODELE = 3;
export const DERNIERES_VENTES = 10;
const J = 86400000;

const med = (s) => (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);
// Un montant du relevé → texte lisible par `beneficePaire` (« 95.5 ») ; illisible ⇒ null.
const montantTexte = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? (Math.round(n * 100) / 100).toFixed(2) : null;
};

// cible   : { titre, marque? } — l'achat (son titre, la marque lue s'il y en a une) ;
// releve  : les lignes de `vrm_stats_ventes` ([plateforme, compte, id, ts, vente €,
//           achat €|null, frais €|null, titre, …]) ou null (pas lu sur cet appareil) ;
// enLigneDe(ligne) → ms | null | undefined : la mise en ligne (undefined = pas encore lu).
// Rend { etat, modele, … } :
//   'inconnu' : modèle pas sûr (rien à dire) · 'pasLu' : relevé absent ·
//   'peu'     : moins de 3 ventes (n dit) ·
//   'ok'      : { n, total, ecartees, prixMedian, benefMedian, nBenef, delaiMedian,
//                 nDelai, delaiLu, ventes: [{ id, plateforme, compte, ts, eur, benefice, jours }] }
export function reventeDuModele({ cible, releve, enLigneDe = null, max = DERNIERES_VENTES } = {}) {
  const m = cible ? modeleSur(cible.marque || '', cible.titre || '') : null;
  if (!m) return { etat: 'inconnu', modele: null };
  if (!Array.isArray(releve)) return { etat: 'pasLu', modele: m };
  const lignes = [];
  let ecartees = 0;
  for (const r of releve) {
    if (!Array.isArray(r)) continue;
    const [plateforme, compte, id, ts, eur, achat, frais, titre] = r;
    const mv = modeleSur('', titre || '');
    if (!mv || mv.cle !== m.cle) continue;
    const vente = montantTexte(eur);
    if (vente == null || !Number.isFinite(Number(ts))) { ecartees += 1; continue; }
    lignes.push({ r, plateforme: String(plateforme || ''), compte: String(compte || ''), id: String(id || ''), ts: Number(ts), vente, achat, frais });
  }
  // Les plus récentes d'abord ; « les dernières fois » = les `max` plus récentes.
  lignes.sort((a, b) => b.ts - a.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const total = lignes.length;
  if (total < MIN_VENTES_MODELE) return { etat: 'peu', modele: m, n: total, ecartees };
  const pris = lignes.slice(0, Math.max(MIN_VENTES_MODELE, max));
  let delaiLu = true;
  const ventes = pris.map((l) => {
    const b = beneficePaire(l.vente, { buyPrice: montantTexte(l.achat), fees: montantTexte(l.frais) });
    let jours = null;
    if (typeof enLigneDe === 'function') {
      const e = enLigneDe(l.r);
      if (e === undefined) delaiLu = false;
      else if (e != null && Number.isFinite(Number(e)) && Number(e) > 0 && l.ts >= Number(e)) jours = (l.ts - Number(e)) / J;
    } else delaiLu = false;
    return { id: l.id, plateforme: l.plateforme, compte: l.compte, ts: l.ts, eur: Number(l.vente), benefice: b.benefice, jours };
  });
  const prix = ventes.map((v) => Math.round(v.eur * 100)).sort((a, b) => a - b);
  const benefs = ventes.filter((v) => v.benefice != null).map((v) => Math.round(v.benefice * 100)).sort((a, b) => a - b);
  const js = ventes.filter((v) => v.jours != null).map((v) => v.jours).sort((a, b) => a - b);
  return {
    etat: 'ok', modele: m, n: ventes.length, total, ecartees,
    prixMedian: Math.round(med(prix)) / 100,
    benefMedian: benefs.length ? Math.round(med(benefs)) / 100 : null, nBenef: benefs.length,
    delaiMedian: js.length ? Math.round(med(js) * 10) / 10 : null, nDelai: js.length, delaiLu,
    ventes,
  };
}

// Les phrases (≤ 12 mots). Aucune ne conseille : elles disent le passé.
export const phraseRevente = (r) => {
  if (!r || r.etat === 'inconnu') return '';
  if (r.etat === 'pasLu') return 'Tes ventes de ce modèle : pas encore lues ici';
  if (r.etat === 'peu') return `Pas assez de ventes de ce modèle (${r.n})`;
  return `Revendu ${euroCourt(r.prixMedian)} en médiane, sur ${r.n} ventes`;
};
export const euroCourt = (v) => (v == null || !Number.isFinite(Number(v)) ? '—'
  : `${(Math.round(Number(v) * 100) / 100).toFixed(Number.isInteger(Math.round(Number(v) * 100) / 100) ? 0 : 2).replace('.', ',').replace('-', '−')} €`);
