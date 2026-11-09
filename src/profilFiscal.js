// ── LE PROFIL FISCAL : CE QUE SON STATUT CHANGE DANS VRM (9 nov.) ──────────────
// Julien, 9 nov. : « améliore la personnalisation suivant ton régime, ce n'est
// vraiment pas encore abouti ». Une règle (§5 « une notion, un propriétaire ») :
// Comptabilité, Ma journée, Statistiques, Notifications et la configuration de
// départ lisent CE module ; aucun écran ne redécide « est-il concerné par
// l'URSSAF ? » de son côté.
//
// LE STATUT N'EST JAMAIS DEVINÉ (§5) : `vinted_regime` vaut 'particulier' ·
// 'micro' · 'societe' · 'marge', ou `null` (pas choisi). `null` ⇒ RIEN n'est
// calculé (ni cotisation, ni seuil, ni rappel) et l'écran le dit. « Je ne sais
// pas encore » (configuration de départ) garde `null` et fait dire une aide
// courte et NEUTRE, avec les sources officielles — jamais un conseil fiscal.
//
// LES TAUX SONT DES TAUX OFFICIELS VÉRIFIÉS, PAS DES SOUVENIRS (lus le
// 9 nov. 2026 sur entreprendre.service-public.gouv.fr) :
//   · F36232 (« vérifié le 1er janvier 2026 ») — cotisations sociales du
//     micro-entrepreneur : vente de marchandises 12,3 % (13,3 % avec le
//     versement libératoire, soit +1 %) ; prestations de services commerciales
//     ou artisanales (BIC) 21,2 % (22,9 %, soit +1,7 %) ;
//   · F23459 (« vérifié le 1er janvier 2026 ») — contribution à la formation
//     professionnelle : activité commerciale 0,1 %, artisanale 0,3 %, libérale
//     0,2 %. VRM ne compose que l'activité COMMERCIALE (0,1 %) : un artisan ou
//     un libéral pose son taux à la main (Réglages → Statut) ;
//   · F32353 (« vérifié le 21 février 2026 ») — plafond du régime micro :
//     203 100 € (vente), 83 600 € (prestations de services) ;
//   · F21746 (« vérifié le 1er janvier 2026 ») — franchise en base de TVA 2026 :
//     85 000 € / 93 500 € (vente), 37 500 € / 41 250 € (services).
//   · ACRE (décret n° 2026-69 du 6 février 2026, déjà appliqué par
//     src/ecrans/Compta.jsx depuis le 2 nov.) : début avant le 1er juillet 2026,
//     50 % des cotisations ; depuis, 75 %. Les taux de l'achat-revente sont
//     RECOPIÉS de `TAUX_MICRO` (Compta) — l'audit exige qu'ils soient égaux.
// Une activité sans taux vérifié n'est pas proposée.
//
// JS pur, sans React ni lecture : `scripts/audit-configuration-depart.cjs` l'exécute.

import { seuilsDe } from './microEntreprise.js';

export const CLE_REGIME = 'vinted_regime';
export const CLE_MICRO_OPTIONS = 'vrm_micro_options';
export const CLE_RYTHME = 'vinted_urssaf_freq';
export const CLE_TAUX = 'vinted_urssaf_taux';
// (9 nov.) La TVA d'une société, CHOISIE (jamais déduite) : { choix: 'franchise' | 'normale', at }.
// « TVA sur la marge » est le régime `marge` (déjà connu de toute l'app).
export const CLE_SOCIETE_TVA = 'vrm_societe_tva';
export const REGIMES = ['particulier', 'micro', 'societe', 'marge'];
export const regimeLu = (r) => (REGIMES.includes(r) ? r : null);

// ── LES TAUX DU MICRO-ENTREPRENEUR ───────────────────────────────────────────
export const TAUX_ACTIVITE = Object.freeze({
  vente: Object.freeze({ nom: 'Achat-revente', detail: 'vente de marchandises (BIC)', cotisations: 12.3, acre: 6.2, acre2026: 9.225, formation: 0.1, liberatoire: 1 }),
  services: Object.freeze({ nom: 'Prestations de services', detail: 'prestations commerciales (BIC)', cotisations: 21.2, acre: 10.6, acre2026: 15.9, formation: 0.1, liberatoire: 1.7 }),
});
export const ACTIVITES = Object.keys(TAUX_ACTIVITE);
// L'activité d'un micro-entrepreneur. Une réponse absente garde le défaut
// D'AVANT (l'achat-revente, 12,4 %) : rien ne change pour qui n'a pas répondu.
export const activiteMicro = (opts) => (opts && opts.activite === 'services' ? 'services' : 'vente');
const r1 = (x) => Math.round(x * 10) / 10;
// Le taux composé, en % du chiffre d'affaires (arrondi au dixième, comme `tauxMicroVente`).
export function tauxMicro({ activite = 'vente', liberatoire = false, acre = false } = {}) {
  const t = TAUX_ACTIVITE[activite === 'services' ? 'services' : 'vente'];
  const cot = acre === 'apres' ? t.acre2026 : acre ? t.acre : t.cotisations;
  return r1(cot + t.formation + (liberatoire ? t.liberatoire : 0));
}
// Le détail ligne par ligne (l'écran l'affiche tel quel, rien de recalculé).
export function detailTaux({ activite = 'vente', liberatoire = false, acre = false } = {}) {
  const t = TAUX_ACTIVITE[activite === 'services' ? 'services' : 'vente'];
  const L = [
    { quoi: 'Cotisations sociales', taux: acre === 'apres' ? t.acre2026 : acre ? t.acre : t.cotisations, note: acre === 'apres' ? 'ACRE, début depuis le 1er juillet 2026' : acre ? 'ACRE, début avant le 1er juillet 2026' : t.detail },
    { quoi: 'Formation professionnelle', taux: t.formation, note: 'activité commerciale' },
  ];
  if (liberatoire) L.push({ quoi: 'Impôt sur le revenu', taux: t.liberatoire, note: 'versement libératoire' });
  return L;
}
// Un taux enregistré est-il un des taux OFFICIELS que VRM compose ? (Sinon il a
// été posé à la main : VRM ne le remplace jamais en silence.) Absent ⇒ true.
export function tauxEstOfficiel(brut) {
  if (brut == null || brut === '') return true;
  const v = parseFloat(String(brut).replace(',', '.'));
  if (!Number.isFinite(v)) return true;
  for (const activite of ACTIVITES) for (const acre of [false, 'avant', 'apres']) for (const liberatoire of [false, true]) {
    if (tauxMicro({ activite, acre, liberatoire }) === v) return true;
  }
  return false;
}

// ── LES SEUILS, SELON L'ACTIVITÉ ─────────────────────────────────────────────
// Les chiffres vivent dans src/microEntreprise.js (`SEUILS_MICRO`, leur propriétaire,
// la jauge de Comptabilité) : on les LIT, jamais recopiés.
export const seuilsActivite = (annee, activite = 'vente') => {
  const s = seuilsDe(annee, activite === 'services' ? 'services' : 'vente');
  return s ? { plafond: s.plafondVente, tvaBase: s.tvaBase, tvaMajore: s.tvaMajore } : null;
};
// DAC7 : ce que les plateformes transmettent aux impôts (30 ventes ou plus de 2 000 €).
export const DAC7 = Object.freeze({ ventes: 30, euros: 2000 });

// ── LES SOURCES OFFICIELLES (l'aide neutre ne dit rien d'autre) ───────────────
export const SOURCES_OFFICIELLES = Object.freeze([
  Object.freeze({ nom: 'Vendre en ligne : particulier ou professionnel ?', url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F36126' }),
  Object.freeze({ nom: 'Le régime de la micro-entreprise', url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23961' }),
  Object.freeze({ nom: 'Le site officiel des micro-entrepreneurs', url: 'https://www.autoentrepreneur.urssaf.fr' }),
]);
export const AIDE_NEUTRE = [
  'Vendre de temps en temps tes propres affaires, c’est vendre en particulier.',
  'Acheter pour revendre, régulièrement, c’est une activité commerciale : elle se déclare, par exemple en micro-entreprise.',
  'VRM ne peut pas choisir à ta place : les pages officielles ci-dessous l’expliquent, et un comptable peut trancher.',
];

// ── LE PROFIL ────────────────────────────────────────────────────────────────
// Entrées (ce qui est enregistré, tel quel) :
//   regime        `vinted_regime` (undefined = nuage pas encore lu)
//   inconnu       true si sa réponse est « Je ne sais pas encore »
//   options       `vrm_micro_options` (activité, versement libératoire, ACRE)
//   rythme        `vinted_urssaf_freq` BRUT ('mensuel' · 'trimestriel' · absent)
//   tauxBrut      `vinted_urssaf_taux` BRUT
//   tvaSociete    `vrm_societe_tva`
//   annee         l'année des seuils
// Rend ce que chaque écran a le droit de montrer et de calculer. Trois états :
// `etat: 'encours'` (rien affiché), 'aChoisir' / 'inconnu' (rien calculé, dit), un statut.
export function profilFiscal({ regime, inconnu = false, options = null, rythme = null, tauxBrut = null, tvaSociete = null, annee = new Date().getFullYear() } = {}) {
  if (regime === undefined) return { etat: 'encours', urssaf: false, cotisations: false };
  const r = regimeLu(regime);
  const base = { etat: r, regime: r, urssaf: false, cotisations: false, dac7: false, rappelDeclaration: false, seuils: null, livre: false, exportEnAvant: false, tva: null, aide: null, sources: null };
  if (!r) {
    return { ...base, etat: inconnu ? 'inconnu' : 'aChoisir', aide: inconnu ? AIDE_NEUTRE : null, sources: SOURCES_OFFICIELLES,
      mots: MOTS.neutre, phrase: inconnu ? 'Tu ne sais pas encore : VRM ne calcule aucune cotisation tant que ton statut n’est pas choisi.' : 'Ton statut n’est pas choisi : VRM ne calcule aucune cotisation.' };
  }
  if (r === 'particulier') {
    return { ...base, dac7: true, mots: MOTS.particulier,
      phrase: 'Particulier : rien à déclarer à l’URSSAF. Les plateformes transmettent aux impôts tes ventes au-delà de 30 ventes ou 2 000 € par an (DAC7).' };
  }
  if (r === 'micro') {
    const o = options && typeof options === 'object' ? options : {};
    const activite = activiteMicro(o);
    const lib = o.liberatoire === 'oui' ? 'oui' : o.liberatoire === 'non' ? 'non' : null;
    const acre = o.acre === 'apres' ? 'apres' : (o.acre === true || o.acre === 'avant') ? 'avant' : false;
    const officiel = tauxEstOfficiel(tauxBrut);
    const compose = tauxMicro({ activite, liberatoire: lib === 'oui', acre });
    const v = parseFloat(String(tauxBrut == null ? '' : tauxBrut).replace(',', '.'));
    return { ...base, urssaf: true, cotisations: true, dac7: true, rappelDeclaration: true, mots: MOTS.pro,
      activite, liberatoire: lib, acre,
      rythme: rythme === 'mensuel' ? 'mensuel' : rythme === 'trimestriel' ? 'trimestriel' : null,
      tauxCompose: compose, tauxManuel: officiel ? null : (Number.isFinite(v) ? v : null),
      seuils: seuilsActivite(annee, activite),
      phrase: `Micro-entrepreneur (${TAUX_ACTIVITE[activite].nom.toLowerCase()}) : VRM estime tes cotisations URSSAF et te rappelle chaque déclaration.` };
  }
  // Société (et régime de la marge) : pas d'URSSAF micro ; le livre des recettes
  // et des achats et l'export comptable passent devant ; la TVA est SA réponse.
  const tva = r === 'marge' ? 'marge' : (tvaSociete && (tvaSociete.choix === 'franchise' || tvaSociete.choix === 'normale') ? tvaSociete.choix : null);
  return { ...base, livre: true, exportEnAvant: true, tva, mots: MOTS.pro,
    phrase: r === 'marge' ? 'Société au régime de la marge : VRM calcule la TVA sur ta marge et prépare l’export pour ton comptable ; aucune cotisation URSSAF estimée.'
      : 'Société : tes cotisations ne se calculent pas sur ton chiffre d’affaires. VRM tient ton livre des recettes et des achats et prépare l’export pour ton comptable.' };
}
// L'URSSAF du micro-entrepreneur concerne-t-elle ce statut ? (LA règle que
// `urssafConcerne` de l'app appelle.)
export const cotisationsUrssaf = (regime) => regimeLu(regime) === 'micro';

// Les mots selon le statut : un particulier ne fait pas de « chiffre d'affaires ».
const MOTS = Object.freeze({
  particulier: Object.freeze({ ca: 'tes ventes', Ca: 'Tes ventes', argent: 'ce que tu as reçu' }),
  pro: Object.freeze({ ca: 'ton chiffre d’affaires', Ca: 'Ton chiffre d’affaires', argent: 'tes recettes' }),
  neutre: Object.freeze({ ca: 'tes ventes', Ca: 'Tes ventes', argent: 'ce que tu as reçu' }),
});

// ── MA JOURNÉE : LE RAPPEL DAC7 D'UN PARTICULIER ──────────────────────────────
// Rare et utile : seulement quand une plateforme APPROCHE le seuil (80 %) sans
// l'avoir atteint, sur des chiffres LUS (`dac7ParPlateforme`, src/seuilsAnnee.js).
// Atteint ⇒ rien ici (Comptabilité le dit) ; pas lu ⇒ rien. Rend null ou
// { plateforme, resteVentes, resteCentimes }.
export const DAC7_PROCHE = 0.8;
export function rappelDac7Journee(profil, dac7) {
  if (!profil || profil.etat !== 'particulier' || !dac7 || !Array.isArray(dac7.plateformes)) return null;
  let mieux = null;
  for (const p of dac7.plateformes) {
    if (!p || p.etat !== 'lu' || p.verdict !== 'sous' || p.n == null || p.centimes == null) continue;
    const part = Math.max(p.n / DAC7.ventes, p.centimes / (DAC7.euros * 100));
    if (part < DAC7_PROCHE) continue;
    // Le reste vient du verdict de seuilsAnnee.js (le MÊME que Comptabilité, §5).
    const reste = p.reste || { n: Math.max(0, DAC7.ventes - p.n), centimes: Math.max(0, DAC7.euros * 100 + 1 - p.centimes) };
    if (!mieux || part > mieux.part) mieux = { part, plateforme: p.plateforme, resteVentes: reste.n, resteCentimes: reste.centimes };
  }
  return mieux ? { plateforme: mieux.plateforme, resteVentes: mieux.resteVentes, resteCentimes: mieux.resteCentimes } : null;
}
