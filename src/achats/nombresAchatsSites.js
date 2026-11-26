// ── src/achats/nombresAchatsSites.js — combien d'achats chaque site MONTRE dans l'onglet Achats (25 nov., filtre par plateforme)
// L'onglet Achats est fait de morceaux qui lisent chacun SES achats (Vinted : la liste de Comptabilite ; Leboncoin et
// Vestiaire : src/achats/AchatsSite.jsx ; eBay : EbayAchats, un par compte). « Un écran publie, les autres consomment » (§5) :
// chaque morceau publie ICI le nombre de SA liste (un nombre lu, jamais deviné ; `null` = pas su ⇒ aucune entrée), et le filtre
// de l'onglet (src/filtrePlateforme.js `optionsPlateformes`) les lit. Mémoire de la page seulement : rien n'est écrit.
import React from 'react';

const parts = new Map();   // `${site}|${source}` → n (nombre fini ≥ 0)
const abonnes = new Set();
let version = 0;
const prevenir = () => { version += 1; for (const f of [...abonnes]) { try { f(); } catch (_) { /* un abonné qui casse n'arrête pas les autres */ } } };

export function publierAchatsSite(site, source, n) {
  const k = site + '|' + (source || '');
  const v = Number.isFinite(n) && n >= 0 ? n : null;
  if (v == null) { if (parts.delete(k)) prevenir(); return; }
  if (parts.get(k) === v) return;
  parts.set(k, v); prevenir();
}

// { toutes, vinted?, leboncoin?, ebay?, vestiaire? } — la forme de `nombresPlateformes` ; un site sans publication n'a pas d'entrée.
export function nombresAchats() {
  const out = { toutes: 0 };
  for (const [k, n] of parts) { const s = k.split('|')[0]; out[s] = (out[s] || 0) + n; out.toutes += n; }
  return out;
}

export function useNombresAchats() {
  const [, maj] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => { abonnes.add(maj); if (version) maj(); return () => { abonnes.delete(maj); }; }, []);
  return nombresAchats();
}

// Pour les bancs : repartir de rien.
export function viderNombresAchats() { parts.clear(); prevenir(); }
