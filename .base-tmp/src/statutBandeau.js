// ═══════════════════════════════════════════════════════════════════════════
// LE BANDEAU « VRM VA MAL » DANS L'APP (9 nov., sondes de /statut)
// ═══════════════════════════════════════════════════════════════════════════
// L'app lit `/api/sante` → `statut` (la projection publique des sondes
// automatiques, api/_lib/statut-sondes.js `statutPublic`) et, s'il y a un
// incident EN COURS, montre UNE ligne discrète (« Les e-mails arrivent en
// retard — on s'en occupe. »), une fois par incident et par appareil.
// La règle est ici, pure (l'audit l'exécute) :
//   - seul un incident OUVERT par les sondes compte (deux sondes ratées de
//     suite) ; un état « pas su » ou périmé ne dit RIEN (ni alerte, ni feu vert) ;
//   - un incident déjà montré sur cet appareil (`vus`) ne revient pas ;
//   - un seul bandeau, le plus ancien incident d'abord.
// ═══════════════════════════════════════════════════════════════════════════
export const PHRASES_BANDEAU = Object.freeze({
  base: 'La base de données répond mal — on s’en occupe. Rien n’est perdu.',
  connexion: 'La connexion à VRM est perturbée — on s’en occupe.',
  emails: 'Les e-mails arrivent en retard — on s’en occupe.',
  envoi: 'Les e-mails de VRM ne partent pas pour l’instant — on s’en occupe.',
  notifications: 'Les notifications ne partent pas pour l’instant — on s’en occupe.',
  extension: 'Les lectures de l’extension peuvent être en retard — on s’en occupe.',
});
export const CLE_VUS = 'vrm_statut_bandeaux_vus';
export const cleIncident = (x) => `${x.composant}|${x.debut}`;

export function bandeauStatut(statut, vus = []) {
  if (!statut || typeof statut !== 'object' || statut.perime === true) return null;
  const comp = statut.composants && typeof statut.composants === 'object' ? statut.composants : {};
  const deja = new Set(Array.isArray(vus) ? vus : []);
  const ouverts = (Array.isArray(statut.incidents) ? statut.incidents : [])
    .filter((x) => x && x.fin == null && PHRASES_BANDEAU[x.composant] && Number.isFinite(Date.parse(x.debut)))
    .filter((x) => comp[x.composant] && comp[x.composant].etat === 'degrade')
    .filter((x) => !deja.has(cleIncident(x)))
    .sort((a, b) => Date.parse(a.debut) - Date.parse(b.debut));
  if (!ouverts.length) return null;
  const x = ouverts[0];
  return { cle: cleIncident(x), composant: x.composant, phrase: PHRASES_BANDEAU[x.composant] };
}
