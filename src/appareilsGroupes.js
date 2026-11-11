// ═══════════════════════════════════════════════════════════════════════════
// « APPAREILS CONNECTÉS », REGROUPÉS (11 nov., lot connexions-oauth)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (capture de production, 1512 px) : 8 lignes dont 5 « Mac · Chrome »,
// chacune avec « Déconnecter » — « il y a tous les détails des connexions ».
// Une session Supabase naît à CHAQUE connexion (app, fenêtre ou carte de
// l'extension, Google/Discord, code par e-mail) et ne meurt que sur « Se
// déconnecter » : une connexion abandonnée (stockage effacé, jeton refusé,
// navigateur réinstallé) reste dans la liste. Le même Mac · Chrome en porte
// donc plusieurs ; ce n'est pas un intrus.
// Règle de l'écran (pure, exécutée par scripts/audit-appareils-groupes.cjs) :
//   · un groupe par appareil + navigateur (« Mac · Chrome »), N connexions,
//     la dernière activité du groupe ;
//   · le groupe de CET appareil en tête ; les autres derrière un repli ;
//   · une connexion inactive depuis plus de 30 jours est « ancienne » : hors des
//     groupes, comptée à part, fermable sur son clic (jamais en silence) ;
//   · une date illisible n'est jamais « ancienne » (pas su ≠ vieux).
export const ANCIENNE_MS = 30 * 24 * 3600 * 1000;

const ts = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : null; };

// `appareils` : [{ id, appareil, creeLe, actifLe, ici }] (réponse de /api/compte?mode=appareils).
// Rend { ici: groupe|null, autres: [groupe], anciennes: [session] } ;
// groupe = { appareil, sessions:[…], n, actifLe, ici }.
export function grouperAppareils(appareils, maintenant = Date.now()) {
  const liste = Array.isArray(appareils) ? appareils.filter((a) => a && a.id) : [];
  const anciennes = [];
  const groupes = new Map();
  for (const a of liste) {
    const t = ts(a.actifLe || a.creeLe);
    if (!a.ici && t !== null && maintenant - t > ANCIENNE_MS) { anciennes.push(a); continue; }
    const cle = String(a.appareil || 'Appareil inconnu');
    if (!groupes.has(cle)) groupes.set(cle, { appareil: cle, sessions: [], n: 0, actifLe: null, ici: false });
    const g = groupes.get(cle);
    g.sessions.push(a); g.n++;
    if (a.ici) g.ici = true;
    if (t !== null && (g.actifLe === null || t > ts(g.actifLe))) g.actifLe = a.actifLe || a.creeLe;
  }
  for (const g of groupes.values()) g.sessions.sort((x, y) => (y.ici - x.ici) || ((ts(y.actifLe) || 0) - (ts(x.actifLe) || 0)));
  const tous = [...groupes.values()];
  const ici = tous.find((g) => g.ici) || null;
  const autres = tous.filter((g) => !g.ici).sort((x, y) => (ts(y.actifLe) || 0) - (ts(x.actifLe) || 0));
  return { ici, autres, anciennes };
}

// « 5 connexions » / « 1 connexion ».
export const nConnexions = (n) => `${n} connexion${n > 1 ? 's' : ''}`;
