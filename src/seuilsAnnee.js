// ── LES SEUILS DE L'ANNÉE : « vers quel mois », et DAC7 PAR PLATEFORME (3 nov.) ──
// Julien : une jauge des seuils de l'année dans Comptabilité — le CA face au
// plafond micro achat-revente, aux seuils de TVA, et DAC7 plateforme par
// plateforme. Règle PURE (aucun accès au navigateur) : l'écran et
// `scripts/audit-seuils-annee.cjs` l'appellent (§11).
//
// ⚠️ AUCUN CHIFFRE N'EST RECALCULÉ ICI. Tout se lit dans la ligne PUBLIÉE par
//    l'écran Ventes (`vinted_urssaf_mois` : le CA déclaré, daté au VERSEMENT,
//    comptes exclus déjà retirés, une vente déclarée comptée dans le mois de sa
//    déclaration) — par `caAnnee` et `seuilsDe` de src/microEntreprise.js, la
//    règle de la jauge existante. Ce module n'ajoute que deux lectures.
//
// ⚠️ DAC7 (directive européenne, historique compta « 6 octobre ») : chaque
//    plateforme transmet aux impôts les vendeurs qui font AU MOINS 30 ventes OU
//    PLUS DE 2 000 € dans l'année civile. « Plus de 2 000 € » : 2 000,00 € pile
//    ne l'atteint pas — comparé en centimes entiers. Ce sont les mêmes valeurs
//    que `SEUIL_VINTED_VENTES` / `SEUIL_VINTED_EUR` de l'app (l'audit l'exige).
//    VRM ne sait pas si une plateforme additionne plusieurs comptes d'une même
//    personne : ici, TOUS les comptes sélectionnés d'une plateforme ensemble
//    (le détail compte par compte Vinted reste dans Ventes → Registre annuel).
import { caAnnee, seuilsDe } from './microEntreprise.js';

export const DAC7 = { ventes: 30, centimes: 200000 };
export const PLATEFORMES = ['Vinted', 'Leboncoin', 'eBay', 'Vestiaire'];
export const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const MOIS_MIN_PROJECTION = 2;

const cts = (x) => Math.round(Number(x) * 100);
// (5 nov.) LA règle DAC7 — exportée : la carte par plateforme ci-dessous ET la
// section « DAC7 » compte par compte (src/dac7Comptes.js) la partagent (§11).
export const atteintDac7 = (n, c) => n >= DAC7.ventes || c > DAC7.centimes;
const atteint = atteintDac7;
// Le verdict d'un ensemble de ventes (une plateforme, ou un compte) :
//   · `n`, `centimes` : la partie SÛRE ; `nAd`, `ctsAd` : les ventes pas encore
//     datées qui PEUVENT être de l'année ; `manque` : il manque des ventes
//     (pas datées, montant illisible) ⇒ jamais « sous ».
//   · 'atteint' · 'atteintSi' (seulement avec les pas encore datées) · 'sous'
//     (seulement si RIEN ne manque) · null (« au moins »).
//   · `reste` : ce qu'il manque sur la partie sûre (30 ventes, ou 2 000,01 €).
export const verdictDac7 = ({ n = 0, centimes = 0, nAd = 0, ctsAd = 0, manque = false } = {}) => {
  const verdict = atteint(n, centimes) ? 'atteint'
      : (nAd > 0 && atteint(n + nAd, centimes + ctsAd)) ? 'atteintSi'
      : manque ? null : 'sous';
  const reste = verdict === 'atteint' ? null : { n: Math.max(0, DAC7.ventes - n), centimes: Math.max(0, DAC7.centimes + 1 - centimes) };
  return { verdict, reste };
};

// ── « AU RYTHME ACTUEL, TU L'ATTEINDRAIS VERS [MOIS] » ─────────────────────
// Projection LINÉAIRE sur les mois ÉCOULÉS (finis) de l'année qui portent des
// données : du premier mois publié de l'année jusqu'au mois d'avant `now`. Le
// mois en cours (pas fini) n'entre pas dans le rythme. Rend `null` — et
// l'écran ne dit RIEN — quand ce ne serait pas honnête :
//   · pas de ligne publiée, pas de seuils vérifiés pour l'année ;
//   · un CA PARTIEL (plateforme pas lue, ventes sans date de versement, ventes
//     dont l'argent ne se lit pas) : on ne projette jamais un minimum ;
//   · moins de 2 mois finis de données ;
//   · seuil déjà dépassé (la jauge le dit), rythme nul.
// Sinon `{ seuil, mois (0-11) | null, nom, base, rythme }` : `mois: null` ⇒ pas
// atteint cette année à ce rythme (`nom` vide).
export const moisAtteinte = ({ ligne, now = new Date(), seuil } = {}) => {
  const annee = now.getFullYear();
  if (!seuilsDe(annee) || !(seuil > 0)) return null;
  const cur = caAnnee(ligne, annee);
  if (!cur || cur.partiel) return null;
  if (cur.ca > seuil) return null;
  const m = now.getMonth();                       // mois finis : 0 … m-1
  const yms = (ligne.mois || []).filter((x) => x && typeof x.ym === 'string' && x.ym.slice(0, 4) === String(annee))
    .map((x) => ({ k: Number(x.ym.slice(5, 7)) - 1, ca: Number(x.ca) }))
    .filter((x) => isFinite(x.ca) && x.k >= 0 && x.k < m);
  if (!yms.length) return null;
  const premier = Math.min(...yms.map((x) => x.k));
  const base = m - premier;                       // mois finis depuis le premier mois publié
  if (base < MOIS_MIN_PROJECTION) return null;
  const caFinis = yms.reduce((s, x) => s + x.ca, 0);
  const rythme = caFinis / base;
  if (!(rythme > 0)) return null;
  // Cumul projeté à la FIN du mois k (k ≥ m) : CA des mois finis + rythme × mois.
  for (let k = m; k <= 11; k++) {
    if (caFinis + rythme * (k - m + 1) >= seuil) return { seuil, mois: k, nom: MOIS_FR[k], base, rythme: Math.round(rythme * 100) / 100 };
  }
  return { seuil, mois: null, nom: '', base, rythme: Math.round(rythme * 100) / 100 };
};

// ── DAC7, PLATEFORME PAR PLATEFORME ─────────────────────────────────────────
// Lu dans les mois de l'année de la ligne publiée (`par[plateforme] = { n, ca }`).
// Par plateforme :
//   · `etat` : 'passu' (la plateforme n'a pas été lue : « — », jamais 0) ·
//     'lu' ; une plateforme absente de `sources` et sans vente : ignorée ;
//   · `n`, `centimes` : la partie SÛRE (ventes datées au versement) ;
//   · `nAd`, `ctsAd` : ses ventes sans date de versement (`aDater.par`), qui
//     PEUVENT être de l'année ; `nNc` : ses ventes dont l'argent ne se lit pas ;
//   · `verdict` : 'atteint' · 'atteintSi' (seulement avec les ventes à dater :
//     une estimation, dite) · 'sous' (seulement si RIEN ne manque) · null
//     (« au moins » : il manque des ventes, on n'affirme pas « sous ») ;
//   · `reste` : ce qu'il manque sur la partie sûre (30 ventes, ou 2 000,01 €).
export const dac7ParPlateforme = ({ ligne, annee } = {}) => {
  if (!ligne || !Array.isArray(ligne.mois)) return null;
  const src = ligne.sources || {};
  const acc = {};
  const de = (p) => acc[p] || (acc[p] = { plateforme: p, n: 0, centimes: 0 });
  for (const m of ligne.mois) {
    if (!m || typeof m.ym !== 'string' || m.ym.slice(0, 4) !== String(annee)) continue;
    for (const [p, v] of Object.entries(m.par || {})) {
      if (!v) continue;
      const c = cts(v.ca);
      if (!isFinite(c)) continue;
      const q = de(p); q.n += Number(v.n) || 0; q.centimes += c;
    }
  }
  const adPar = (ligne.aDater && ligne.aDater.par) || {};
  const ncPar = (ligne.nonComptees && ligne.nonComptees.par) || {};
  const noms = [...new Set([...PLATEFORMES.filter((p) => p in src || acc[p]), ...Object.keys(acc)])];
  const liste = noms.map((p) => {
    const q = acc[p] || { plateforme: p, n: 0, centimes: 0 };
    if (src[p] === 'pasSu') return { plateforme: p, etat: 'passu', n: null, centimes: null, nAd: 0, ctsAd: 0, nNc: 0, verdict: null, reste: null };
    const ad = adPar[p] || {};
    const nAd = Number(ad.n) || 0, ctsAd = nAd ? (cts(ad.ca) || 0) : 0;
    let nNc = 0;
    for (const [k, v] of Object.entries(ncPar)) if (k.split('|')[0] === p) nNc += Number(v) || 0;
    const manque = nAd > 0 || nNc > 0;
    const { verdict, reste } = verdictDac7({ n: q.n, centimes: q.centimes, nAd, ctsAd, manque });
    return { plateforme: p, etat: 'lu', n: q.n, centimes: q.centimes, nAd, ctsAd, nNc, partiel: manque, verdict, reste };
  });
  return { annee, plateformes: liste };
};
