// ── LA VEILLE D'UNE ÉCHÉANCE FISCALE : CFE, DÉCLARATION DE REVENUS (16 nov., confiance-clients) ──
// L'URSSAF a sa veille (api/_lib/rappel-urssaf.js, `rappelVeilleUrssaf`). Ici, les deux autres dates
// du calendrier fiscal (src/calendrierFiscal.js — LA règle de l'app, importée telle quelle) :
//   · CFE : la veille du 15 décembre (sauf exonérée, et seulement si elle est dite exonérée) ;
//   · déclaration de revenus : la veille de CHAQUE limite de zone officielle (on ne connaît pas son
//     département : la phrase nomme la zone, jamais devinée).
// Micro-entrepreneur seulement (régime jamais deviné). Famille « Rappels » (`urssaf`), heures calmes
// tenues par `sendPushToAll` (la notification attend le réveil). Fonction PURE : exécutée par l'audit.
import { calendrierFiscal, veilleFiscale } from '../../src/calendrierFiscal.js';
import { optionsMicro } from '../../src/microEntreprise.js';
import { DESTINATIONS } from './lien-notif.js';

export const MAIN_FISCAL = ['vinted_regime', 'vinted_urssaf_freq', 'vrm_urssaf_declare', 'vrm_micro_options', 'vrm_debut_activite'];
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export function rappelVeilleFiscal({ today, main }) {
  if (main === undefined || main === null) return { envoyer: false, raison: 'réglages illisibles — rien' };
  const m = objet(main);
  if (m.vinted_regime !== 'micro') return { envoyer: false, raison: 'pas micro-entrepreneur (statut : ' + (m.vinted_regime || 'pas choisi') + ')' };
  const annee = Number(String(today || '').slice(0, 4));
  if (!annee) return { envoyer: false, raison: 'date illisible' };
  const o = optionsMicro(m.vrm_micro_options);
  const cal = calendrierFiscal({ regime: 'micro', freq: m.vinted_urssaf_freq, declare: objet(m.vrm_urssaf_declare), debut: m.vrm_debut_activite || null, activite: (o && o.activite) || 'vente', annee });
  const v = veilleFiscale(cal, today);
  if (!v) return { envoyer: false, raison: 'pas la veille d’une échéance CFE ou impôt' };
  const url = DESTINATIONS.urssafDeclarer();
  if (v.echeance.type === 'cfe') {
    return { envoyer: true, cle: v.cle, titre: 'Demain : CFE à payer', corps: `Limite le 15 décembre. À payer sur impots.gouv.fr → Espace professionnel.`, url, raison: 'veille CFE' };
  }
  return { envoyer: true, cle: v.cle, titre: 'Demain : déclaration de revenus',
    corps: `Dernier jour en ligne pour les départements ${v.zone.departements} (zone ${v.zone.zone}). 2042-C-PRO sur impots.gouv.fr.`, url, raison: `veille impôt zone ${v.zone.zone}` };
}
