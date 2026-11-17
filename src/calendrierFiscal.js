// ═══════════════════════════════════════════════════════════════════════════
// LE CALENDRIER FISCAL DE L'ANNÉE (16 nov., confiance-clients, point 8)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé) : dans Argent, les échéances de l'année du vendeur selon SON régime
// — jamais deviné : `null` (pas choisi) ⇒ rien de calculé, dit.
// UNE RÈGLE PAR NOTION (§11) — ce fichier ne fait que RANGER des dates sur l'année :
//   · URSSAF : les périodes et leurs limites = `calendrierUrssaf` (src/microEntreprise.js) ;
//     « déjà déclaré » = `moisDeclare` sur `vrm_urssaf_declare` (son clic seulement) ;
//     le rythme est SON choix (`vinted_urssaf_freq`) : absent ⇒ « rythme à choisir », aucune date ;
//   · CFE : le 15 décembre (`rappelCfe`, service-public vérifié le 29 oct.) ; l'exonération de
//     l'année de création n'est dite QUE si sa date de début est connue (`debut`, 'AAAA-MM') ;
//   · déclaration de revenus (2042-C-PRO, `declarationRevenus`) : les dates OFFICIELLES de
//     l'année, recopiées d'impots.gouv.fr / economie.gouv.fr avec leur source (`DATES_IMPOT`) ;
//     une année dont les dates ne sont pas publiées ⇒ « dates pas encore publiées », jamais devinées ;
//   · TVA : seulement si le seuil de franchise est ATTEINT (`tvaBase` de l'année,
//     src/microEntreprise.js) sur le CA déclaré connu — sinon rien.
// Jamais le mot « encaissé » (audit-urssaf). JS pur : l'app, l'agenda et le rappel de la veille
// (api/_lib/rappel-fiscal.js) l'importent ; scripts/audit-calendrier-fiscal.cjs l'exécute.
// ═══════════════════════════════════════════════════════════════════════════
import { calendrierUrssaf, seuilsDe, caAnnee as caDeLAnnee } from './microEntreprise.js';
import { moisDeclare } from '../api/_lib/urssaf-regle.js';

// Les dates officielles de la déclaration de revenus EN LIGNE, par année de déclaration
// (revenus de l'année d'avant). Recopiées le 16 nov. 2026 de economie.gouv.fr
// (« Impôt sur le revenu : le calendrier de la déclaration en 2026 ») et impots.gouv.fr
// (« Les modalités de la déclaration de revenus en 2026 »). Zone = département au 1er janvier.
export const DATES_IMPOT = Object.freeze({
  2026: Object.freeze({
    ouverture: '2026-04-09',
    zones: Object.freeze([
      Object.freeze({ zone: 1, departements: '01 à 19 (et non-résidents)', limite: '2026-05-21' }),
      Object.freeze({ zone: 2, departements: '20 à 54', limite: '2026-05-28' }),
      Object.freeze({ zone: 3, departements: '55 à 976', limite: '2026-06-04' }),
    ]),
    papier: '2026-05-19',
    source: 'impots.gouv.fr · economie.gouv.fr (vérifié le 16 nov. 2026)',
  }),
});
export const JOUR_CFE = '12-15';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const RE_YM = /^\d{4}-(0[1-9]|1[0-2])$/;

// Toutes les échéances URSSAF dont la LIMITE tombe dans l'année `annee`, par la règle de l'app.
function urssafDeLAnnee(freq, annee) {
  // `calendrierUrssaf` part de « maintenant » et ne rend que les limites à venir : on le fait partir
  // du 1er janvier de l'année (sa fenêtre commence deux périodes avant) et on garde celles de l'année.
  const depart = new Date(annee, 0, 1, 12);
  return calendrierUrssaf(freq, depart, freq === 'mensuel' ? 14 : 6).filter((p) => p.limite.getFullYear() === annee);
}

// `regime` : `vinted_regime` (undefined = pas encore lu · null/'' = pas choisi) ; `freq` : `vinted_urssaf_freq` ;
// `declare` : `vrm_urssaf_declare` ; `debut` : 'AAAA-MM' ou null ; `ligne` : `vinted_urssaf_mois` (la ligne publiée,
// datée au versement — `caAnnee` de l'app) ; `activite` : 'vente' · 'services' ; `annee` ; `now`.
// Rend { etat: 'encours' | 'aChoisir' | 'horsMicro' | 'ok', echeances: [{ id, type, titre, jour, fin?, fait, note, source? }],
//        manque: [codes] } — triées par date.
export function calendrierFiscal({ regime, freq = null, declare = null, debut = null, ligne = null, activite = 'vente', annee = new Date().getFullYear(), now = new Date() } = {}) {
  if (regime === undefined) return { etat: 'encours', echeances: [], manque: [] };
  if (!regime) return { etat: 'aChoisir', echeances: [], manque: ['regime'] };
  if (regime !== 'micro') return { etat: 'horsMicro', regime, echeances: [], manque: [] };
  const out = [], manque = [];
  const aujourdhui = iso(now);
  // URSSAF
  if (freq !== 'mensuel' && freq !== 'trimestriel') manque.push('rythme');
  else {
    for (const p of urssafDeLAnnee(freq, annee)) {
      const fait = Array.isArray(p.ym) && p.ym.length > 0 && p.ym.every((ym) => moisDeclare(declare, ym));
      out.push({ id: `urssaf-${iso(p.limite)}`, type: 'urssaf', titre: `Déclaration URSSAF · ${p.periode}`, jour: iso(p.limite), debutJour: iso(p.ouvre), fait, note: 'autoentrepreneur.urssaf.fr' });
    }
  }
  // CFE : le 15 décembre ; exonérée l'année de création — dit seulement si la date de début est CONNUE.
  const anneeDebut = RE_YM.test(String(debut || '')) ? Number(String(debut).slice(0, 4)) : null;
  const exoneree = anneeDebut === annee;
  out.push({ id: `cfe-${annee}`, type: 'cfe', titre: exoneree ? 'CFE · exonérée (année de création)' : 'CFE à payer', jour: `${annee}-${JOUR_CFE}`, fait: false, exoneree, note: exoneree ? 'Exonérée l’année de création de ton activité.' : 'impots.gouv.fr → Espace professionnel' });
  if (anneeDebut == null) manque.push('debut');
  // Déclaration de revenus : les dates officielles de l'année, sinon « pas encore publiées ».
  const D = DATES_IMPOT[annee];
  if (D) {
    const z = D.zones;
    out.push({ id: `impot-${annee}`, type: 'impot', titre: `Déclaration de revenus (2042-C-PRO) · revenus ${annee - 1}`, jour: z[0].limite, fin: z[z.length - 1].limite, debutJour: D.ouverture, fait: false,
      zones: z.map((x) => ({ ...x })), papier: D.papier, note: 'impots.gouv.fr', source: D.source });
  } else manque.push('dates-impot');
  // TVA : seulement si le seuil de franchise de l'année est ATTEINT par le CA déclaré connu.
  const S = seuilsDe(annee, activite);
  const ca = ligne ? caDeLAnnee(ligne, annee) : null;
  if (S && ca && Number.isFinite(Number(ca.ca)) && Number(ca.ca) > S.tvaBase) {
    out.push({ id: `tva-${annee}`, type: 'tva', titre: 'TVA : seuil de franchise dépassé', jour: aujourdhui, fait: false, note: 'Ton chiffre d’affaires déclaré dépasse le seuil de franchise : vois avec impots.gouv.fr ou un comptable.', seuil: S.tvaBase });
  }
  out.sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : 0));
  return { etat: 'ok', annee, echeances: out, manque };
}

// La veille d'une échéance CFE ou impôt (l'URSSAF a déjà sa veille : api/_lib/rappel-urssaf.js).
// `today` 'AAAA-MM-JJ' (Paris) ; rend l'échéance dont le jour (ou une limite de zone) est DEMAIN, ou null.
export function veilleFiscale(cal, today) {
  if (!cal || cal.etat !== 'ok') return null;
  const [y, m, d] = String(today || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const demain = iso(new Date(y, m - 1, d + 1, 12));
  for (const e of cal.echeances) {
    if (e.fait || e.exoneree) continue;
    if (e.type === 'cfe' && e.jour === demain) return { echeance: e, demain, cle: `${e.id}:${demain}` };
    if (e.type === 'impot') { const z = (e.zones || []).find((x) => x.limite === demain); if (z) return { echeance: e, zone: z, demain, cle: `${e.id}:${demain}` }; }
  }
  return null;
}
