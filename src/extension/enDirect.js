// ── src/extension/enDirect.js — « EN DIRECT » : ce que fait l'extension EN CE MOMENT (21 nov., ext. 5.428, choix 59) ──
// Julien : une ligne dans Aujourd'hui (et la page Extension) qui dit ce que fait l'extension, tirée de son état RÉEL
// (`etatPourApp().direct`, posé par l'extension elle-même) : « Republie 3/6 », « Prochain favori à 21:05 »,
// « En pause : vérification Vinted » (« Agent VRM : N décisions en attente » n'est PAS dit : l'extension ne garde aucune
// décision en attente — l'agent de publication pose ses questions sur le moment ; rien n'est inventé) — avec « Tout arrêter » (le chemin du
// bouton du panneau, sur SON toucher). L'extension pas joignable ⇒ « — · extension pas ouverte », JAMAIS « tout va bien ».
//
// RÈGLE PURE (aucune lecture) :
//   enDirect(etat, { maintenant }) → { code, lignes: [{ cle, vars, ton }], arreter: bool, reprendre: bool }
//   `etat` : undefined (pas encore demandé) · null (muette) · l'objet de l'extension. Une extension trop ancienne (pas
//   de `direct`) ⇒ « — · mets l'extension à jour » ; une action dont l'état n'a pas bougé depuis 3 min n'est PLUS dite
//   « en cours » (l'extension a pu s'arrêter : on dit l'heure de la dernière nouvelle, jamais un faux « Republie 3/6 »).
export const FRAIS_MS = 3 * 60000;
const SORTES = { republier: 'republier', favoris: 'favoris', baisse: 'baisse' };

export function enDirect(etat, { maintenant = Date.now() } = {}) {
  if (etat === undefined) return { code: 'lecture', lignes: [{ cle: 'direct.lecture', vars: {}, ton: 'neutre' }], arreter: false, reprendre: false };
  if (!etat || etat.ok === false) return { code: 'absente', lignes: [{ cle: 'direct.absente', vars: {}, ton: 'neutre' }], arreter: false, reprendre: false };
  const d = etat.direct;
  if (d === undefined) return { code: 'ancienne', lignes: [{ cle: 'direct.ancienne', vars: {}, ton: 'neutre' }], arreter: false, reprendre: false };
  if (!d || typeof d !== 'object') return { code: 'passu', lignes: [{ cle: 'direct.passu', vars: {}, ton: 'neutre' }], arreter: false, reprendre: false };
  const lignes = [];
  let arreter = false, reprendre = false, code = 'rien';
  const tout = Number(d.tout) || 0;
  const a = d.action && typeof d.action === 'object' ? d.action : null;
  const frais = a && a.maj > 0 && maintenant - a.maj < FRAIS_MS;
  const pause = etat.pause && Number(etat.pause.jusqua) > maintenant ? Number(etat.pause.jusqua) : 0;
  if (tout > 0) { lignes.push({ cle: 'direct.toutArrete', vars: { heure: tout }, ton: 'ambre' }); reprendre = true; code = 'tout'; }
  else if ((a && a.actif && frais && a.verification) || (d.arret && d.arret.quoi === 'captcha')) { lignes.push({ cle: 'direct.verification', vars: {}, ton: 'ambre' }); code = 'verification'; }
  else if (d.arret && d.arret.quoi) { lignes.push({ cle: 'direct.arret.' + d.arret.quoi, vars: {}, ton: 'ambre' }); code = 'arret'; }
  else if (pause) { lignes.push({ cle: 'direct.pause', vars: { heure: pause }, ton: 'neutre' }); code = 'pause'; }
  if (a && a.actif && SORTES[a.sorte] && code !== 'tout') {
    if (!frais) { lignes.push({ cle: 'direct.muette', vars: { heure: a.maj || maintenant }, ton: 'neutre' }); if (code === 'rien') code = 'muette'; }
    else {
      const s = SORTES[a.sorte];
      const n = a.total > 0 ? Math.min(a.total, a.fait + (a.enCours ? 1 : 0)) : 0;
      if (a.enCours) lignes.push({ cle: 'direct.' + s + (a.total > 0 ? '.n' : '.encours'), vars: { n, total: a.total }, ton: 'neutre' });
      else if (a.prochain && a.prochain > maintenant) lignes.push({ cle: 'direct.' + s + '.prochain', vars: { heure: a.prochain, fait: a.fait, total: a.total }, ton: 'neutre' });
      else lignes.push({ cle: 'direct.' + s + (a.total > 0 ? '.n' : '.encours'), vars: { n: Math.max(n, a.fait), total: a.total }, ton: 'neutre' });
      arreter = true;
      if (code === 'rien') code = 'action';
    }
  }
  if (!lignes.length) lignes.push({ cle: 'direct.rien', vars: {}, ton: 'neutre' });
  return { code, lignes: lignes.slice(0, 3), arreter, reprendre };
}
