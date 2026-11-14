// ═══════════════════════════════════════════════════════════════════════════
// LA RÉVISION DE FIN DE MOIS (14 nov., lot argent-prix — proposition 116 validée
// par Julien : « tout ce qui manque pour une compta juste dans une seule liste à
// vider en série »)
// ═══════════════════════════════════════════════════════════════════════════
// MESURÉ d'abord : « Mois bouclé » (src/moisBoucle.js, Déclarer, micro seulement)
// COMPTE les manques du mois et ouvre l'endroit de chacun. Ce qui manquait : la
// LISTE elle-même, vente par vente, pour tous les statuts, et le geste en série.
// Aucune règle neuve : les manques sont ceux du relevé que l'écran Ventes publie
// (`vrm_stats_ventes`, une ligne par vente FINALISÉE, comptes écartés dehors —
// [plateforme, compte, tx|id, ts, vente, achat|null, frais, titre, N°, versement]) :
//   · 'achat'     — prix d'achat pas saisi ([5] null) : la porte est la saisie en
//                   série existante (« Coût d'achat · x/y renseignés ») ;
//   · 'versement' — Vinted sans date de versement lue ([9] '') : la vente est
//                   « à dater », dans AUCUN mois (§5) ; la porte : « Vendu et reçu » ;
//   · 'relier'    — vente sans N° ([8] '') : aucune paire reliée par identité (son
//                   prix d'achat ne peut pas venir) ; la porte : Ventes, où il la relie.
// Une vente peut avoir plusieurs manques : UNE ligne, ses manques en pastilles, la
// porte du premier. Le mois = la date de VENTE (ts) — c'est le mois à réviser ;
// une vente à dater n'est dans aucun mois DÉCLARÉ, elle est bien vendue ce mois-ci.
// Relevé pas publié ⇒ 'passu' (« ouvre Ventes »), jamais « rien à réviser ».
// Module PUR. Exécuté par scripts/audit-argent-prix.cjs (section 116).
// ═══════════════════════════════════════════════════════════════════════════

export const MANQUES_REVISION = ['achat', 'versement', 'relier'];
export const LIGNES_MAX_REVISION = 200;
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
export const moisDe = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const moisPrecedent = (maintenant = Date.now()) => { const d = new Date(maintenant); return moisDe(new Date(d.getFullYear(), d.getMonth() - 1, 15).getTime()); };

// releve : les lignes de `vrm_stats_ventes.l` | null (pas publié) | undefined (en cours).
export function revisionMois({ releve, ym } = {}) {
  if (releve === undefined) return { etat: 'encours', lignes: [], compte: {}, n: 0 };
  if (!Array.isArray(releve)) return { etat: 'passu', lignes: [], compte: {}, n: 0 };
  if (!YM.test(String(ym || ''))) return { etat: 'passu', lignes: [], compte: {}, n: 0 };
  const lignes = [];
  const compte = { achat: 0, versement: 0, relier: 0 };
  let n = 0;
  const vus = new Set();
  for (const l of releve) {
    if (!Array.isArray(l) || !Number.isFinite(Number(l[3])) || moisDe(Number(l[3])) !== ym) continue;
    const cle = `${l[0]}|${l[2]}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    n += 1;
    const manques = [];
    if (l[5] == null) manques.push('achat');
    if (l[0] === 'Vinted' && !String(l[9] || '')) manques.push('versement');
    if (!String(l[8] || '').trim()) manques.push('relier');
    if (!manques.length) continue;
    for (const m of manques) compte[m] += 1;
    lignes.push({ cle, plateforme: String(l[0] || ''), id: String(l[2] || ''), ts: Number(l[3]), montant: l[4] == null ? null : Number(l[4]), titre: String(l[7] || ''), num: String(l[8] || ''), manques, porte: manques[0] });
  }
  lignes.sort((a, b) => a.ts - b.ts);
  return { etat: 'lu', ym, n, lignes, compte, total: lignes.length, fini: lignes.length === 0 };
}
// Les mois proposés : le mois passé d'abord (celui qu'on révise), puis le mois en cours et les 10 d'avant.
export function moisRevision(maintenant = Date.now()) {
  const d = new Date(maintenant), out = [];
  for (let k = 0; k < 12; k++) out.push(moisDe(new Date(d.getFullYear(), d.getMonth() - k, 15).getTime()));
  return out;
}
