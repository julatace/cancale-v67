// (15 nov.) Les MOTS de l'état d'une vente Vestiaire (src/etatVenteVc.js rend la clé) :
// par tr(), `vcventes.etat.*`, cinq langues. Le code machine de Vestiaire n'est jamais écrit.
import { tr, date as dateI18n } from './i18n/index.js';

const jourCourt = (t) => { if (!Number.isFinite(t) || t <= 0) return ''; try { return dateI18n(new Date(t), { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }); } catch (_) { return ''; } };

export function texteEtatVc(r) {
  if (!r || !r.cle) return tr('vcventes.etat.inconnu');
  if (r.cle === 'envoyeeTransporteur') return r.phrase ? tr('vcventes.etat.envoyeeTransporteur', { phrase: r.phrase }) : tr('vcventes.etat.expediee');
  if (r.cle === 'aExpedier' || r.cle === 'aExpedierPassee') { const d = jourCourt(r.limite); return d ? tr('vcventes.etat.' + r.cle, { date: d }) : tr('vcventes.etat.aExpedierSansDate'); }
  if (r.cle === 'paiement') { const d = jourCourt(r.estimeT); return tr('vcventes.etat.paiement', { date: d || r.estime || '' }); }
  return tr('vcventes.etat.' + r.cle);
}
