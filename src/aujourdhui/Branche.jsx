// ── src/aujourdhui/Branche.jsx — « Aujourd'hui » chargé à la demande AVEC son modèle (19 nov.) ──
// Le modèle (src/aujourdhui/modele.js, pur) et l'écran natif (src/natif/ecrans/Aujourdhui.jsx, ses composants et leur CSS)
// partent dans le MÊME morceau, chargé quand l'écran s'affiche : le budget de démarrage (scripts/budget-vitesse.json)
// reste tenu. L'app (src/App.jsx) passe ses sources ; une prop qui est une FONCTION reçoit le modèle `Mo` et rend la
// valeur (`chiffres`, `aVenir`, `alerte`, `ventes`). Aucune règle ici : on relie, on ne calcule pas.
import React from 'react';
import Aujourdhui from '../natif/ecrans/Aujourdhui.jsx';
import { poserIcone, iconePosee } from '../natif/index.js';   // les glyphes des composants = les tracés de l'app (posés ici : le morceau natif part à la demande)
import { chiffresAujourdhui, statsPeriodes, dernieresVentes, alerteDuJour, courbe30, parCompteEtSite, vrmDuJour, capteDuJour } from './modele.js';
import { fusionner, SELECT_JOURNAL_CAPTE } from '../capteNotif/arrivee.js';
import { progressionObjectif, joursRestantsMois, lireSaisieObjectif, objectifAEnregistrer } from '../objectifMois.js';
import { raisonCourte } from '../design/carteChiffres.js';

const SEL_TOUT = { site: 'toutes', compte: null, periode: null };
// Les cartes en plus, à partir de la question au propriétaire (`valeurSel`) — aucune règle neuve :
//   la courbe des 30 jours et la table par compte (src/aujourdhui/modele.js), l'objectif du mois (src/objectifMois.js).
function cartesEnPlus({ valeurSel, objectif: O, lignes, maintenant }) {
  const courbe = { jours: courbe30({ valeur: (id, p) => valeurSel(id, p, SEL_TOUT), maintenant }) };
  const comptes = parCompteEtSite({ lignes, valeur: valeurSel });
  const type = O.mois ? O.mois.type : 'ca';
  const base = { type, cible: O.mois ? O.mois.valeur : null, jours: joursRestantsMois(maintenant).jours,
    enregistrer: (saisie) => { const v = lireSaisieObjectif(type, saisie); if (v == null) return false; const r = objectifAEnregistrer(O.brut, { type, valeur: v }, maintenant); if (!r) return false; O.poser(r); return true; },
    retirer: () => { const r = objectifAEnregistrer(O.brut, null, maintenant); if (r) O.poser(r); } };
  let objectif;
  if (!O.mois) objectif = { ...base, etat: 'aucun' };
  else {
    const x = O.valeur(O.mois); const prog = progressionObjectif(O.mois, x);
    objectif = !prog || prog.pct == null ? { ...base, etat: x && x.raison === 'encours' ? 'encours' : 'passu', raison: raisonCourte(x || {}) || '', valeur: null, pct: null }
      : { ...base, etat: 'lu', valeur: prog.valeur, pct: prog.pct, partiel: !!prog.partiel, atteint: !!prog.atteint };
  }
  return { courbe, comptes, objectif };
}   // le journal capté par l'extension, une entrée par identité

// (19 nov.) Les cartes d'Aujourd'hui (« Personnaliser » : `vrm_aujourdhui_cartes`, synchronisé — la clé est dans les
// SYNC_KEYS de l'app) : relues au chargement du nuage et à chaque écriture.
function useCartes(o) {
  const [brut, setBrut] = React.useState(() => (o ? o.load(o.cle, null) : null));
  React.useEffect(() => (o ? o.onCloudReady(() => setBrut((cur) => (cur == null ? o.load(o.cle, null) : cur))) : undefined), [o]);
  React.useEffect(() => {
    if (!o) return undefined;
    const f = (e) => { if (e && e.detail && e.detail.k === o.cle) setBrut(o.load(o.cle, null)); };
    window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f);
  }, [o]);
  const poser = React.useCallback((r) => { if (!o || !r || !Array.isArray(r.ordre)) return; setBrut(r); o.save(o.cle, r); }, [o]);
  return o ? { brut, poser } : null;
}
// Les lectures des cartes en plus : le journal des gestes (`/api/compte?mode=journal`, la source de « Ce que VRM a fait »)
// et le journal capté par l'extension (`capte_journal_*`). Une lecture ratée ⇒ null (pas su), jamais [].
function useLectures(o) {
  const [journal, setJournal] = React.useState(undefined), [capte, setCapte] = React.useState(undefined);
  React.useEffect(() => {
    if (!o) return undefined;
    let vivant = true;
    (async () => {
      try { const r = await fetch('/api/compte?mode=journal', { headers: o.entete() }); const j = r.ok ? await r.json().catch(() => null) : null; if (vivant) setJournal(j && Array.isArray(j.evenements) ? j.evenements : null); } catch (_) { if (vivant) setJournal(null); }
      try { const rows = await o.lireTout(SELECT_JOURNAL_CAPTE); if (vivant) setCapte(Array.isArray(rows) ? rows : null); } catch (_) { if (vivant) setCapte(null); }
    })();
    return () => { vivant = false; };
  }, [o]);
  return { journal, capte };
}

const Mo = Object.freeze({ chiffresAujourdhui, statsPeriodes, dernieresVentes, alerteDuJour, courbe30, parCompteEtSite, vrmDuJour, capteDuJour, fusionner });

export default function AujourdhuiBranche({ calculer = null, alerte = null, ventes = null, outils = null, ...reste }) {
  if (reste.Icon && !iconePosee()) poserIcone(reste.Icon);
  const cartes = useCartes(outils);
  const L = useLectures(outils);
  let plus = {};
  try { plus = typeof calculer === 'function' ? (calculer(Mo) || {}) : {}; } catch (_) { plus = {}; /* pas su ⇒ l'écran dit « — » */ }
  if (plus.plus) { try { plus = { ...plus, ...cartesEnPlus(plus.plus) }; } catch (_) { /* pas su ⇒ les cartes disent « — » */ } delete plus.plus; }
  const a = typeof alerte === 'function' ? alerte(Mo) : alerte;
  const v = typeof ventes === 'function' ? ventes(Mo) : ventes;
  const lu = (f) => { try { return typeof f === 'function' ? f(Mo) : (f === undefined ? null : f); } catch (_) { return null; } };
  const maintenant = Date.now();
  const capte = L.capte === undefined || !outils ? undefined : L.capte ? lu(() => Mo.capteDuJour(Mo.fusionner(L.capte), maintenant)) : null;
  const vrm = L.journal === undefined || !outils ? undefined : lu(() => Mo.vrmDuJour(L.journal, maintenant));
  return <Aujourdhui {...reste} {...plus} alerte={a} ventes={v} capte={capte} vrm={vrm} cartes={cartes}/>;
}
