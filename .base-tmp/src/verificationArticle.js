// ══════════════════════════════════════════════════════════════════════════════
// LA VENTE « AVEC VÉRIFICATION DE L'ARTICLE » (6 nov., vague 2, point 6)
// ══════════════════════════════════════════════════════════════════════════════
// L'acheteur a payé la Vérification de l'article : le colis part d'abord au
// CENTRE DE VÉRIFICATION de Vinted, qui l'envoie ensuite à l'acheteur. Mesuré
// en lecture seule sur sa base (6 nov.) : deux ventes portent l'état de commande
// « Envoi au centre de vérification » (`transaction_user_status` = waiting), sur
// deux comptes. Seule autre forme vue avec « vérification » : « Transaction
// suspendue - en attente de vérification. » — une SUSPENSION (`PAS_UNE_VENTE`),
// qui n'est PAS cette étape.
//
// La frise de Ventes gagne une étape entre « Postée » et « Livrée » :
// « Au centre de vérification ». Elle se lit par IDENTITÉ : l'état de LA
// transaction (sa ligne de commande, `transaction_id`), jamais un titre, une
// date ou une absence. Une fois la vente livrée ou finalisée, Vinted ne dit plus
// « centre de vérification » : la frise redevient celle de toutes les ventes
// (l'étape n'est jamais devinée après coup).
// Pur : aucune lecture, aucun React.
// ══════════════════════════════════════════════════════════════════════════════

export const STATUT_CENTRE_VERIFICATION = /envoi\s+au\s+centre\s+de\s+v[ée]rification/i;
const SUSPENDUE = /suspend/i;

// `o` : la commande (sa ligne, par n° de transaction). Vrai seulement si SON état dit le centre.
export function auCentreDeVerification(o) {
  const s = String((o && o.status) || '');
  return !!s && STATUT_CENTRE_VERIFICATION.test(s) && !SUSPENDUE.test(s);
}

export const ETAPE_CENTRE = Object.freeze({ cle: 'centre', label: 'Au centre de vérification', court: 'Vérification' });
