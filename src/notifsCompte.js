// (22 nov. soir, maquettes de Julien) LE NOMBRE DE NOTIFICATIONS NON LUES, publié par la cloche de la coque
// (`CentreNotifsCoque`, src/App.jsx : `compterNonLuesNotifs`) pour la cloche ronde de l'en-tête d'Aujourd'hui.
// Une seule source : personne d'autre ne compte. `undefined` = pas encore lu · `null` = pas su · nombre lu.
let _n;
const _ecoutes = new Set();
export function publierNotifsNonLues(v) { _n = v; for (const f of _ecoutes) { try { f(v); } catch (_) { /* rien */ } } }
export function suivreNotifsNonLues(f) { _ecoutes.add(f); return () => _ecoutes.delete(f); }
export const notifsNonLues = () => _n;
