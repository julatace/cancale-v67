// ════════════════════════════════════════════════════════════════════════════
//  TOUS LES N° DE SUIVI D'UN ACHAT — UNE RÈGLE POUR L'APP ET LE SERVEUR (17 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Julien (17 nov., captures) : au point relais, UN colis arrivé, DEUX lignes dans VRM — « Colis Chronopost
// Pickup » (n° Chronopost, code) et l'achat Vinted « Code sur Vinted · Incident ». Un envoi international à
// deux transporteurs porte deux n° pour le MÊME colis ; la ligne de suivi Vinted (`harvest_{uid}_suivi_{tx}`)
// ne gardait que le premier. Depuis l'extension 5.403, elle range TOUS les n° du trajet en scalaires (recopiés
// dans `meta`) : `suivisVinted` (« N1,N2 »), `transporteursVinted`, `suiviCourant`, `suivisLusAt` (la liste a
// été LUE). Chaque n° est une IDENTITÉ de l'achat (§5) : un colis du transporteur à l'un de ces n° est ce colis.
//
// Et un lien posé à la main (`colis_suivi_*` portant `tx`) que la liste LUE contredit (son n° n'y est pas) ne
// relie plus rien : c'est la liste de Vinted qui tranche, et l'écran le DIT (« ce lien ne correspond pas au
// suivi Vinted — délier ? ») au lieu de se taire. Une liste pas encore lue ne contredit rien (pas su).
// PUR : aucune lecture ici ; l'app (`indexSuivisAchats`) et le serveur (`liensDesLignes`) l'appellent.
import { normaliserSuivi } from './etat-colis-email.js';

// « N1,N2 » → [N1, N2] (normalisés, sans double).
export function numerosDeListe(s) {
  return [...new Set(String(s == null ? '' : s).split(',').map(normaliserSuivi).filter(Boolean))];
}
// « CODE1,CODE2 » → [CODE1, CODE2] (forme machine seulement).
export function codesDeListe(s) {
  return [...new Set(String(s == null ? '' : s).split(',').map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z][A-Z0-9_.:-]{1,39}$/.test(c)))];
}
// La ligne de suivi Vinted projetée ({ id, suivi, sv, sl }) → { uid, tx, numeros, lue }.
export function listeDeLigne(r) {
  const m = /^harvest_(\w+?)_suivi_(\w+)$/.exec(String((r && r.id) || ''));
  if (!m) return null;
  if (r.tx && String(r.tx) !== m[2]) return null;
  const numeros = [...new Set([normaliserSuivi(r.suivi), ...numerosDeListe(r.sv)].filter(Boolean))];
  return { uid: m[1], tx: m[2], numeros, lue: !!(r.sl && Number.isFinite(Date.parse(r.sl))) };
}
// Les listes par « compte:transaction ».
export function listesParAchat(lignes) {
  const out = new Map();
  for (const r of (Array.isArray(lignes) ? lignes : [])) { const l = listeDeLigne(r); if (l) out.set(`${l.uid}:${l.tx}`, l); }
  return out;
}
// Un lien manuel ({ suivi, tx, uid }) que la liste LUE de SON achat contredit. Sans compte sur le lien : toutes
// les listes de cette transaction lues, et aucune ne porte le n° ⇒ contredit. Pas su ⇒ false (jamais deviné).
export function lienContredit(m, listes) {
  if (!m || !m.tx || !(listes instanceof Map)) return false;
  const su = normaliserSuivi(m.suivi); if (!su) return false;
  const cands = m.uid ? [listes.get(`${m.uid}:${m.tx}`)].filter(Boolean) : [...listes.values()].filter((l) => l.tx === String(m.tx));
  const lues = cands.filter((l) => l.lue && l.numeros.length);
  if (!lues.length || lues.length !== cands.length) return false;
  return lues.every((l) => !l.numeros.includes(su));
}
