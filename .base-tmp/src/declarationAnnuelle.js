// ═══════════════════════════════════════════════════════════════════════════
// LA DÉCLARATION DE REVENUS ANNUELLE, PRÊTE (14 nov., proposition 82)
// « Les montants à reporter, avec la source de chaque chiffre. »
// docs/passation/2026-11-14-argent-choix.md
// ═══════════════════════════════════════════════════════════════════════════
// AUCUNE règle neuve (§5) : le montant et la case sont ceux de `declarationRevenus`
// (src/microEntreprise.js : notice 2042-C-PRO, CA de l'année daté au VERSEMENT,
// `caAnnee` sur la ligne publiée par Ventes `vinted_urssaf_mois`). Ce module dit
// D'OÙ VIENT le montant, à partir des MÊMES mois de la MÊME ligne :
//   · les ventes reçues de l'année (nombre et montant, par site) — `mois[].n/ca/par` ;
//   · les ventes « à dater » PROUVÉES de l'année (vendues et lues finalisées dans
//     l'année : `aDaterSurDansAnnee`) — comptées, et dites à part ;
//   · ce qui est HORS du total, nommé : ventes sans date de versement, mois au chiffre
//     illisible, sites pas lus, ventes dont l'argent ne se lit pas ⇒ « au moins ».
// La somme des morceaux est vérifiée égale au montant (sinon `incoherent`, jamais un
// chiffre affiché qui ne se recompose pas).
// Le statut n'est JAMAIS deviné : pas lu ⇒ `encours` ; pas choisi ⇒ `statut` (aucune
// case) ; autre que micro-entreprise ⇒ `sansObjet`. Versement libératoire pas répondu ⇒
// les DEUX cases possibles, et la question.
// Module PUR : exécuté par scripts/audit-argent-choix.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { valeurSue } from './sommeConnue.js';
import { declarationRevenus, aDaterSurDansAnnee } from './microEntreprise.js';

const r2 = (x) => Math.round(x * 100) / 100;
const c = (x) => Math.round(Number(x) * 100);

export function declarationAnnuelle({ ligne, now = new Date(), liberatoire = null, regime } = {}) {
  if (regime === undefined || ligne === undefined) return { etat: 'encours' };
  if (regime == null) return { etat: 'statut' };
  if (regime !== 'micro') return { etat: 'sansObjet', regime };
  const dr = declarationRevenus({ ligne, now, liberatoire });
  if (!dr) return { etat: 'passu' };
  const annee = dr.annee;
  // Les mois de l'année, lus comme `caAnnee` (un mois au chiffre illisible n'est pas compté, il est dit).
  let nVentes = 0, caMoisC = 0, nMois = 0, illisibles = 0;
  const par = {};
  for (const m of (Array.isArray(ligne.mois) ? ligne.mois : [])) {
    if (!m || typeof m.ym !== 'string' || m.ym.slice(0, 4) !== String(annee)) continue;
    const v = valeurSue(m.ca);
    if (v == null) { illisibles += 1; continue; }
    nMois += 1; caMoisC += c(v); nVentes += Number(m.n) || 0;
    for (const [p, q] of Object.entries(m.par && typeof m.par === 'object' ? m.par : {})) {
      const x = par[p] || (par[p] = { plateforme: p, n: 0, c: 0 });
      x.n += Number(q && q.n) || 0; x.c += c(q && q.ca);
    }
  }
  const sur = aDaterSurDansAnnee(ligne, annee);
  const adN = ligne.aDater ? Number(ligne.aDater.n) || 0 : 0;
  const adCa = ligne.aDater ? Number(ligne.aDater.ca) || 0 : 0;
  const horsN = Math.max(0, adN - (sur ? sur.n : 0));
  const horsCa = Math.max(0, r2(adCa - (sur ? sur.ca : 0)));
  const src = ligne.sources && typeof ligne.sources === 'object' ? ligne.sources : {};
  const pasSu = Object.keys(src).filter((k) => src[k] === 'pasSu');
  const nonComptees = ligne.nonComptees && Number(ligne.nonComptees.n) > 0 ? Number(ligne.nonComptees.n) : 0;
  const totalC = caMoisC + (sur ? c(sur.ca) : 0);
  const parSites = Object.values(par).filter((x) => x.n > 0 || x.c !== 0).map((x) => ({ plateforme: x.plateforme, n: x.n, ca: x.c / 100 }))
    .sort((a, b) => b.ca - a.ca || (a.plateforme < b.plateforme ? -1 : 1));
  const sommeSitesC = Object.values(par).reduce((t, x) => t + x.c, 0);
  // Ce qui se recompose : mois (= somme des sites) + à dater prouvées = le montant de la règle.
  const coherent = totalC === c(dr.ca) && (!parSites.length || sommeSitesC === caMoisC);
  const cases = dr.cases.slice();
  return {
    etat: !coherent ? 'incoherent' : dr.partiel ? 'partiel' : 'pret',
    annee, enCours: dr.enCours, ca: dr.ca, partiel: dr.partiel, raisons: dr.raisons,
    liberatoire: dr.liberatoire, cases,
    // Un montant par case possible : la même somme, la case selon SA réponse (jamais devinée).
    montants: cases.map((k) => ({ case: k, montant: dr.ca, si: dr.liberatoire ? null : (k === '5TA' ? 'avec' : 'sans') })),
    source: {
      nVentes: nVentes + (sur ? sur.n : 0), nVentesMois: nVentes, nMois, caMois: caMoisC / 100, parSites,
      aDaterSur: sur ? { n: sur.n, ca: r2(sur.ca) } : null,
      horsTotal: { aDater: { n: horsN, ca: horsCa }, illisibles, pasSu, nonComptees },
    },
  };
}
