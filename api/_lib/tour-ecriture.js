// ════════════════════════════════════════════════════════════════════════════
//  LE TOUR D'ÉCRITURE DES PROFILS (28 nov., ext. 5.457.0, « Mode ordinateur allumé », capacité `serveur`)
// ════════════════════════════════════════════════════════════════════════════
// Un ordinateur allumé porte un profil Chrome par compte Vinted (chaque profil : son cookie, SON compte). §3 : jamais
// deux comptes qui agissent au même moment. Chaque profil en mode serveur demande LE TOUR avant toute écriture chez une
// plateforme : `POST /api/push { action:'tour', quoi:'prendre'|'rendre', appareil, compte, geste }`. Le tour vit dans
// UNE ligne du vendeur (`tour_ecriture`), changée par comparer-et-échanger (`modifierCas`, sur `rev`) : deux profils
// qui demandent au même instant ⇒ un seul l'obtient. La règle est `srvTour` (src/ordinateurServeur.js, pure) : 60 s,
// prolongé pendant le travail, rendu après ; périmé ⇒ libre (un profil tué ne bloque jamais les autres plus de 60 s).
// Le vendeur est celui de la SESSION (jamais un champ du corps). Pas su (base muette) ⇒ 503 : l'extension n'écrit pas.
import { modifierCas } from './suivi-vinted.js';
import { proprietaireCourant } from './owner.js';
import { srvTour } from '../../src/ordinateurServeur.js';

export async function routeTour(body, maintenant = Date.now()) {
  if (!proprietaireCourant()) return { status: 401, raison: 'session' };
  const q = { action: String((body && body.quoi) || ''), appareil: String((body && body.appareil) || ''), compte: String((body && body.compte) || ''), geste: String((body && body.geste) || '') };
  let issue = null;
  const r = await modifierCas('tour_ecriture', (d) => {
    const x = srvTour(d, q, maintenant);
    issue = x;
    return x.data ? x.data : undefined;
  });
  if (issue && issue.refus === 'forme') return { status: 400, raison: 'forme' };
  if (r === null) return { status: 503, raison: 'pas-su' };
  if (issue && issue.refus === 'occupe') return { status: 200, ok: false, occupe: true, par: issue.tour.par, compte: issue.tour.compte, jusqua: issue.tour.jusqua };
  if (r === true && issue && issue.data) return { status: 200, ok: true, jusqua: Number(issue.data.jusqua) || 0, rendu: q.action === 'rendre' };
  return { status: 200, ok: true, jusqua: 0, rendu: q.action === 'rendre' };
}
