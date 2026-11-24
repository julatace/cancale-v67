// ════════════════════════════════════════════════════════════════════════════
//  LES SOURCES DU CONSEILLER (23 nov.) — UNE fonction pour la carte « Conseils du jour » d'Aujourd'hui, l'écran
//  Conseiller ET le contexte envoyé à « Demande à VRM » : les mêmes chiffres partout (§5, un propriétaire par notion).
//  Rien n'est calculé ici : chaque valeur est DEMANDÉE à son propriétaire, ou lue dans la publication de son écran.
//  Trois états par source : `undefined` en lecture · `null` pas su · valeur lue. Le moteur (src/conseiller/regles.js)
//  se tait sur tout ce qui n'est pas lu.
// ════════════════════════════════════════════════════════════════════════════
import { publicationColisFraiche } from '../design/carteChiffres.js';
import { CLE_PUB_OSR } from '../offresSansReponse.js';
import { alertesSeuils, alertesADire, CLE_SEUILS_VUS } from '../alertesSeuils.js';
import { lireValeurStock } from '../coutVente.js';
import { vendsMieux } from '../vendsMieux.js';
import { parCompteEtSite } from '../aujourdhui/modele.js';
import { lignesReleve } from '../aujourdhui/lectures.js';
import { CLE_PUB_BAISSES, CLE_PUB_PLAN, lirePub } from './publications.js';

const JOUR = 86400000;
const SEL_TOUT = { site: 'toutes', compte: null, periode: null };

// `o` : OUTILS_AUJOURDHUI (load, uid, regime, extras, enLigne) ; `valeurSel` : `valeurChiffre` avec une sélection ;
// `live` : les ventes de la coque (`venduLignes`) ; `L` : useLectures (releve, extras).
export function sourcesConseiller({ o, valeurSel, live, L, maintenant = Date.now() }) {
  const uid = o && o.uid ? o.uid() : '';
  const load = (k) => { try { return o && o.load ? o.load(k, null) : null; } catch (_) { return null; } };
  // Colis à envoyer : la liste publiée par Ventes (`limiteExpedition`), crue si elle a moins de 12 h.
  const pubE = load('vrm_colis_aposter');
  const colis = pubE && Array.isArray(pubE.liste) && publicationColisFraiche(pubE, maintenant) ? { liste: pubE.liste } : null;
  // Offres sans réponse : la publication de l'écran (même appareil, même compte VRM).
  const offres = uid ? lirePub(CLE_PUB_OSR, uid) : null;
  // Seuils : la règle d'Argent, le registre « Compris » ; régime pas lu ⇒ pas su.
  let seuils = null;
  try {
    const regime = o && o.regime ? o.regime() : undefined;
    const ligne = load('vinted_urssaf_mois');
    const vues = load(CLE_SEUILS_VUS);
    const opts = load('vrm_micro_options');
    if (regime !== undefined && ligne) seuils = alertesADire(alertesSeuils({ ligne, now: new Date(maintenant), regime, activite: opts && opts.activite === 'services' ? 'services' : 'vente' }), vues && typeof vues === 'object' ? vues : {});
  } catch (_) { seuils = null; }
  const baisses = uid ? lirePub(CLE_PUB_BAISSES, uid) : null;
  // (24 nov.) Le plan du matin des paires qui dorment (publié par Annonces, src/conseiller/planDorment.js) : cru s'il a moins de 24 h.
  const planPub = uid ? lirePub(CLE_PUB_PLAN, uid) : null;
  const plan = planPub && Number.isFinite(Number(planPub.at)) && maintenant - Number(planPub.at) <= 24 * 3600000 && Number(planPub.at) <= maintenant + 60000 ? planPub : null;
  const VS = uid ? lireValeurStock(uid) : null;
  const stock = VS ? { n: VS.n, nPrix: VS.nPrix, centimes: VS.centimes, partiel: VS.partiel } : null;
  // Le relevé (Statistiques) sur 90 jours : quoi racheter, ce qui ne rapporte pas, le jour où ça vend.
  const lignes = L && L.releve !== undefined ? lignesReleve(L.releve, L.extras, o && o.enLigne) : undefined;
  const de = maintenant - 90 * JOUR;
  const L90 = Array.isArray(lignes) ? lignes.filter((l) => l && Number.isFinite(l.ts) && l.ts >= de && l.ts <= maintenant + 60000) : lignes;
  let mieux = L90 === undefined ? undefined : null;
  try { if (Array.isArray(L90)) mieux = vendsMieux({ lignes: L90, annonces: null, de, a: maintenant + 1 }); } catch (_) { mieux = null; }
  const M = mieux && mieux.modele ? mieux.modele : null;
  // Paires qui dorment : la carte des chiffres.
  const D = valeurSel ? valeurSel('dorment', null, SEL_TOUT) || {} : {};
  const dorment = D.valeur == null ? null : { valeur: D.valeur, partiel: !!D.partiel };
  // Comptes, 30 jours : la table de Statistiques.
  let comptes = null;
  try {
    const p30 = { de: maintenant - 30 * JOUR, a: maintenant + 1, label: '' };
    const lignesV = live && Array.isArray(live.venduLignes) ? live.venduLignes : null;
    const T = lignesV && valeurSel ? parCompteEtSite({ lignes: lignesV, valeur: valeurSel, periodes: [p30] }) : null;
    comptes = T ? Object.values(T)[0] || [] : null;
  } catch (_) { comptes = null; }
  // Le CA par période (« pourquoi mon CA baisse ? ») : la carte des chiffres, les MÊMES appels qu'Argent.
  let chiffres = null;
  try {
    if (valeurSel) {
      const per = (de, a) => ({ de, a, label: '' });
      const val = (id, p) => { const x = valeurSel(id, p, SEL_TOUT) || {}; return x.valeur == null ? null : { valeur: x.valeur, auMoins: !!x.partiel }; };
      const P = { j30: per(maintenant - 30 * JOUR, maintenant + 1), j30avant: per(maintenant - 60 * JOUR, maintenant - 30 * JOUR) };
      chiffres = Object.fromEntries(Object.entries(P).map(([k, p]) => [k, { vendu: val('vendu', p), ventes: val('ventes', p), beneficeBrut: val('brut', p) }]));
      chiffres.mois = { vendu: val('vendu', 'mois'), recu: val('recu', 'mois'), ventes: val('ventes', 'mois') };
    }
  } catch (_) { chiffres = null; }
  return {
    chiffres, colis, offres, seuils, baisses, stock, dorment, comptes, plan,
    aRacheter: M ? M.aRacheter : (mieux === undefined ? undefined : null),
    groupes: M ? M.groupes : (mieux === undefined ? undefined : null),
    ventesTs: Array.isArray(L90) ? L90.map((l) => l.ts) : (L90 === undefined ? undefined : null),
    // Pour « Demande à VRM » : les mêmes agrégats, jamais une ligne de vente ni un acheteur.
    resume: M ? { ventes90: M.n, avecCout: M.nCout, modeles: M.groupes.slice(0, 12).map((g) => ({ nom: g.nom, n: g.n, nCout: g.nCout, prixMoyen: g.prixMoyen, beneficeMoyen: g.moyen, joursMedian: g.mediane })) } : null,
  };
}
