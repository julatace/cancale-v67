// ── src/aujourdhui/Branche.jsx — « Aujourd'hui » chargé à la demande AVEC son modèle (19 nov.) ──
// Le modèle (src/aujourdhui/modele.js, pur) et l'écran natif (src/natif/ecrans/Aujourdhui.jsx, ses composants et leur CSS)
// partent dans le MÊME morceau, chargé quand l'écran s'affiche : le budget de démarrage (scripts/budget-vitesse.json)
// reste tenu. L'app (src/App.jsx) passe ses sources ; une prop qui est une FONCTION reçoit le modèle `Mo` et rend la
// valeur (`chiffres`, `aVenir`, `alerte`, `ventes`). Aucune règle ici : on relie, on ne calcule pas.
import React from 'react';
import Aujourdhui from '../natif/ecrans/Aujourdhui.jsx';
import { chiffresAujourdhui, dernieresVentes, alerteDuJour } from './modele.js';

const Mo = Object.freeze({ chiffresAujourdhui, dernieresVentes, alerteDuJour });

export default function AujourdhuiBranche({ calculer = null, alerte = null, ventes = null, ...reste }) {
  let plus = {};
  try { plus = typeof calculer === 'function' ? (calculer(Mo) || {}) : {}; } catch (_) { plus = {}; /* pas su ⇒ l'écran dit « — » */ }
  const a = typeof alerte === 'function' ? alerte(Mo) : alerte;
  const v = typeof ventes === 'function' ? ventes(Mo) : ventes;
  return <Aujourdhui {...reste} {...plus} alerte={a} ventes={v}/>;
}
