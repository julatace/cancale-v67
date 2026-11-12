// Le branchement du suivi commun (SuiviTravail, branche claude/suivi-travail) :
// `import.meta.glob` rend {} tant que src/suiviTravail.js n'existe pas — le build
// passe, aucun suivi ne s'affiche ; dès que la branche est fusionnée, le suivi
// s'allume tout seul (rien d'autre à changer ici). Jamais une erreur.
const MODULES = import.meta.glob('./suiviTravail.js');
export function chargerSuivi() {
  const f = MODULES['./suiviTravail.js'];
  if (typeof f !== 'function') return Promise.resolve(null);
  return f().then((m) => (m && m.suivi && typeof m.suivi.demarrer === 'function' ? m.suivi : null)).catch(() => null);
}
