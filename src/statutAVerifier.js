// ════════════════════════════════════════════════════════════════════════════
//  LA PUCE D'UN COLIS « À VÉRIFIER » (Colis → À retirer), sortie d'App.jsx le 17 nov. (chasse-bugs).
//  Mesuré au banc colis-retirer-propre : un colis arrivé dont le CODE n'est pas encore lu (décision de
//  Julien du 14 nov. : jamais « à retirer » sans code, `etat: 'sans_code'`) portait la puce « Incident ».
//  Sa raison (« Code pas lu dans l'e-mail du transporteur… ») contient le mot « transporteur », que la
//  règle de texte lisait comme un incident. Un colis qui attend son code n'a AUCUN incident : la puce se
//  décide d'abord sur l'ÉTAT machine (`raisonCode`), jamais sur la phrase (qui change avec la langue).
// ════════════════════════════════════════════════════════════════════════════
import { tr } from './i18n/index.js';

export function statutAVerifier(x) {
  const code = String((x && x.raisonCode) || '');
  // (17 nov.) L'état machine d'abord : un colis sans code lu attend son code, ce n'est pas un incident.
  if (code === 'sans_code') return tr('achats.statutCodePasLu');
  const r = String((x && x.raisonVerif) || '') + ' ' + code;
  // (6 nov.) Deux sources datées qui se contredisent (api/_lib/etat-colis.js) : ni « incident » ni « retour ».
  if (/rien ne l[’']explique/i.test(r)) return 'Contradiction';
  if (/instance|non r[ée]clam|retour|exp[ée]diteur|renvoy/i.test(r)) return 'Retour à l’expéditeur ?';
  // (9 nov., 17 h 24) Une moitié Vinted comptée avec le colis du transporteur : l'état, tranché.
  if (/^compt[ée] avec/i.test(String((x && x.raisonVerif) || ''))) return String(x.raisonVerif).replace(/^c/, 'C');
  if (/m[eê]me colis|m[eê]me relais|doute|pas encore relu|\brelier\b|\breli[ée]s?\b/i.test(r)) return 'À relier';
  if (/incident|probl|transporteur/i.test(r)) return 'Incident';
  if (/d[ée]lai|depasse/i.test(r)) return 'Délai dépassé';
  if (/depuis plus de/i.test(r)) return 'Au relais depuis longtemps';
  return 'À vérifier';
}
