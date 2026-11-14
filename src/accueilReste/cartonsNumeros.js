// ── « J'AI DÉJÀ MES N° SUR MES CARTONS » (14 nov., idée d'accueil 134) ───────
// Julien : au démarrage, VRM montre les N° qu'il a LUS dans les descriptions et
// demande de les confirmer, au lieu d'en donner de nouveaux.
//
// QUAND : un compte qui n'a ENCORE AUCUN numéro (pool vide, aucune fiche numérotée,
// aucune vente au N°) ET qui n'a jamais répondu à « qui numérote ? » (`vrm_numero_ecrit`
// sans `depuis` ni `choisi`, la même question que le guide de démarrage) ET dont au
// moins une annonce SANS N° porte un N° écrit lisible (`apercuNumeroEcrit` : état
// 'a-poser'). Alors, et seulement alors :
//   · la numérotation NE DONNE AUCUN N° NEUF (`retenirNumerosNeufs`) — un blanc vaut
//     mieux qu'un faux (§5) : sinon le 1er passage écrivait « 1, 2, 3… » par-dessus les
//     N° de ses cartons ;
//   · Ma journée pose la question, avec les N° lus.
// « Oui, ce sont mes N° » ⇒ `vrm_numero_ecrit` = « je numérote moi-même » (la règle
// existante, src/numeroEcrit.js `decisionEcrite`) : chaque N° lu est ADOPTÉ pour CETTE
// annonce, par son identifiant — jamais par titre. « Non, VRM numérote » ⇒ « VRM
// numérote pour moi » : la numérotation reprend comme avant.
//
// ⚠️ §5 NUMÉROS — ce que la confirmation n'adopte JAMAIS :
//   · un N° lu porté par DEUX annonces présentes du même site (`apercu.doublons`) :
//     montré en ROUGE (deux paires sous un N°, le seul rouge justifié), rien adopté ;
//   · un N° d'archive (« B… », remise à zéro 013) : `reprenable` le refuse ;
//   · un N° déjà porté par une AUTRE fiche ;
//   · deux N° écrits dans la même annonce (« ambigu »).
// Le serveur reste maître de la numérotation : rien n'est écrit sans SON clic, aucun
// drapeau du navigateur n'arme quoi que ce soit (la réponse est le réglage synchronisé).
// JS pur : scripts/audit-accueil-reste.cjs l'exécute (et `--prouve`).
import { lireReglageNumeroEcrit } from '../numeroEcrit.js';

// Le réglage a-t-il déjà été choisi (ici, au guide, dans « Ma configuration », dans Paramètres) ?
export function numerotationChoisie(brut) {
  const o = brut && typeof brut === 'object' ? brut : null;
  return !!(o && (typeof o.depuis === 'string' || typeof o.choisi === 'string'));
}

// Les clés des N° écrits portés par deux annonces présentes du même site (rouge).
export function clesEnDouble(apercu) {
  return new Set(((apercu && apercu.doublons) || []).map((d) => String(d.cle)));
}

// Les N° lus que la confirmation ADOPTERAIT : [{ id, cle, source, titre, compte }].
// `porteurs(cle)` : true si une AUTRE fiche porte déjà ce N° (identité ailleurs).
export function adoptionsCartons(apercu, { reprenable = () => true, porteurs = () => false } = {}) {
  const double = clesEnDouble(apercu);
  const out = [];
  for (const l of (apercu && apercu.lignes) || []) {
    if (!l || l.etat !== 'a-poser' || !l.lu) continue;
    if (double.has(String(l.lu))) continue;
    if (!reprenable(l.lu)) continue;
    if (porteurs(l.lu, l.id)) continue;
    out.push({ id: String(l.id), cle: String(l.lu), source: (l.lecture && l.lecture.source) || 'description', titre: l.titre || '', compte: l.compte || null });
  }
  return out;
}

// La retenue : `true` ⇒ la numérotation ne donne AUCUN N° neuf (elle garde ses
// identités). `poolVide` : aucun N° donné, aucune fiche ni vente numérotée.
// `lectures` : pour chaque annonce numérotable SANS N°, sa lecture écrite (`lireNumeroEcrit`).
export function retenirNumerosNeufs({ reglage, poolVide, lectures, reprenable = () => true } = {}) {
  if (poolVide !== true) return false;
  if (numerotationChoisie(reglage)) return false;
  if (lireReglageNumeroEcrit(reglage).actif) return false;   // il numérote lui-même : aucun N° neuf de toute façon
  return Array.isArray(lectures) && lectures.some((l) => l && l.etat === 'lu' && reprenable(l.cle));
}

// Ce que Ma journée montre : { etat: 'cachee' } ou { etat: 'question', lus, doublons,
// archives, ambigus, aAdopter, total }. `exemple` (données inventées) : jamais.
export function propositionCartons({ apercu, reglage, poolVide, reprenable = () => true, porteurs = () => false, exemple = false } = {}) {
  if (exemple || !apercu || poolVide !== true || numerotationChoisie(reglage) || lireReglageNumeroEcrit(reglage).actif) return { etat: 'cachee' };
  const lignes = (apercu.lignes || []).filter((l) => l && l.presente !== false);
  const aPoser = lignes.filter((l) => l.etat === 'a-poser' && l.lu);
  if (!aPoser.length) return { etat: 'cachee' };
  const adopt = adoptionsCartons(apercu, { reprenable, porteurs });
  const double = clesEnDouble(apercu);
  const doublons = (apercu.doublons || []).filter((d) => aPoser.some((l) => l.lu === d.cle)).map((d) => ({ cle: String(d.cle), ids: d.ids.map(String), titres: d.ids.map((id) => ((lignes.find((l) => String(l.id) === String(id)) || {}).titre || '')) }));
  return {
    etat: 'question',
    lus: adopt,
    doublons,
    archives: lignes.filter((l) => l.etat === 'archive').map((l) => ({ id: String(l.id), cle: String(l.lu), titre: l.titre || '' })),
    ambigus: lignes.filter((l) => l.etat === 'ambigu').length,
    aAdopter: adopt.length,
    enDouble: aPoser.filter((l) => double.has(String(l.lu))).length,
    sansNumero: lignes.filter((l) => l.etat === 'rien').length,
    total: lignes.length,
  };
}

// Ce que chaque réponse écrit dans `vrm_numero_ecrit` (la forme de `reglageDuChoix`,
// src/guideDemarrage.js — la même question, la même valeur).
export const reponseCartons = (oui, at = new Date().toISOString(), avant = null) => ({ ...(avant && typeof avant === 'object' ? avant : {}), actif: oui === true, depuis: at, choisi: at, par: 'cartons' });

// Pour la numérotation elle-même (App.jsx, « je numérote moi-même ») : les N° écrits
// LUS dans deux annonces ou plus de la liste ⇒ aucune ne le reçoit (§5 : deux paires
// sous un N°, rien adopté, le bloc rouge le montre). `lectures` : [lecture].
export function clesLuesEnDouble(lectures) {
  const vus = new Map();
  for (const l of Array.isArray(lectures) ? lectures : []) if (l && l.etat === 'lu' && l.cle) vus.set(String(l.cle), (vus.get(String(l.cle)) || 0) + 1);
  return new Set([...vus].filter(([, n]) => n > 1).map(([k]) => k));
}
