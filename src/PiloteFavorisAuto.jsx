// ── LE PILOTE DU MODE AUTOMATIQUE DES FAVORIS (2 novembre 2026) ─────────────
// Monté dans AppCoeur (après la session) : VRM ouvert dans un onglet de
// l'ordinateur suffit, l'écran Messages n'a pas besoin d'être affiché.
// À un intervalle TIRÉ AU HASARD (2 à 5 min), pour chaque compte Vinted dont le
// mode est allumé, il demande au SERVEUR un tour (`action:'auto'`) : c'est le
// serveur qui décide tout (identité prouvée, paire en vente, quotas, horaires,
// pause de 24 h) et pose au plus UN message dans la file existante. Le pilote le
// fait partir comme un envoi sur clic (suivant → extension → terminer), puis
// laisse la file au repos jusqu'au tour suivant.
// Il ne fait rien sans extension disponible sur CE compte (onglet vinted.fr
// connecté au compte, extension 5.309 connectée au même compte VRM).
import React from 'react';
import {requeteJsonBornee} from './requeteJsonBornee.js';
import {traduireResultatFavori} from './favorisProgression.js';

export const PILOTE_ECART_MS = [2 * 60000, 5 * 60000];
const tirage = () => Math.round(PILOTE_ECART_MS[0] + Math.random() * (PILOTE_ECART_MS[1] - PILOTE_ECART_MS[0]));

// Un tour pour un compte : `api(action, donnees)` appelle /api/compte?mode=favoris&uid=…
// `executer(travail)` envoie par l'extension. Rend ce qui s'est passé (pour l'écran).
export async function tourPiloteFavoris({ api, executer, disponible }) {
  // L'état de l'extension sur CE compte (onglet vinted.fr, 5.309, même compte VRM)
  // part avec le tour : sans elle, le serveur ne pose RIEN mais, si un message était
  // prêt, il DEMANDE à Julien le geste qui débloque (2 nov., 13 h : « ou demander »).
  const d = disponible ? await disponible() : { disponible: false, code: 'extension_indisponible' };
  const t = await api('auto', { extension: { disponible: d?.disponible === true, ...(d?.code ? { code: d.code } : {}) } });
  if (!t?.ajoute) return { etat: t?.etat || 'lecture', vue: t?.vue || null };
  if (!d?.disponible) return { etat: 'extension', vue: t?.vue || null };
  const s = await api('suivant');
  if (!s?.travail) return { etat: 'pret', vue: s?.vue || null };
  let r = null; try { r = await executer(s.travail); } catch (_) { r = null; }
  const { resultat, raison, ecrits } = traduireResultatFavori(r);
  const f = await api('terminer', { jeton: s.travail.jeton, resultat, raison, ...(Number.isInteger(ecrits) ? { ecrits } : {}) });
  return { etat: resultat, raison, vue: f?.vue || null };
}

// Quels comptes ont le mode allumé : relu à l'ouverture puis toutes les 30 min
// (GET, une lecture par compte), et tout de suite quand l'écran le règle.
export const PILOTE_RELECTURE_MS = 30 * 60000;
export default function PiloteFavorisAuto({ comptes, owner, ownerActuel, headers, executer, disponible }) {
  const vivant = React.useRef(true), occupe = React.useRef(false), actifs = React.useRef(new Set()), relu = React.useRef(0);
  const refs = React.useRef({}); refs.current = { comptes, executer, disponible };
  React.useEffect(() => {
    const regle = (e) => { const d = e.detail || {}; if (!d.uid) return; if (d.actif) actifs.current.add(String(d.uid)); else actifs.current.delete(String(d.uid)); };
    window.addEventListener('vrm:favoris-auto-regle', regle); return () => window.removeEventListener('vrm:favoris-auto-regle', regle);
  }, []);
  const relire = async () => {
    const nouveaux = new Set();
    for (const uid of refs.current.comptes || []) {
      try {
        const r = await requeteJsonBornee(`/api/compte?mode=favoris&uid=${encodeURIComponent(uid)}`, { headers: headers(), cache: 'no-store' });
        if (r.ok && r.json?.vue?.auto?.reglages?.actif === true) nouveaux.add(String(uid));
        else if (!r.ok && actifs.current.has(String(uid))) nouveaux.add(String(uid));   // pas su : on garde
      } catch (_) { if (actifs.current.has(String(uid))) nouveaux.add(String(uid)); }
    }
    actifs.current = nouveaux; relu.current = Date.now();
  };
  React.useEffect(() => {
    vivant.current = true; let t = null;
    const tour = async () => {
      if (!vivant.current) return;
      // Onglet en arrière-plan compris : VRM ouvert suffit (sa demande du 2 nov.).
      if (!occupe.current && ownerActuel() === owner) {
        occupe.current = true;
        try {
          if (Date.now() - relu.current > PILOTE_RELECTURE_MS) await relire();
          for (const uid of refs.current.comptes || []) {
            if (!vivant.current || ownerActuel() !== owner) break;
            if (!actifs.current.has(String(uid))) continue;
            const api = async (action, donnees = {}) => {
              const r = await requeteJsonBornee(`/api/compte?mode=favoris&uid=${encodeURIComponent(uid)}`, { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ action, ...donnees }) });
              if (!r.ok || !r.json?.ok) throw Error(r.json?.message || 'non confirmé');
              return r.json;
            };
            try {
              const r = await tourPiloteFavoris({ api, executer: (tr) => refs.current.executer(uid, tr), disponible: () => refs.current.disponible(uid) });
              try { window.dispatchEvent(new CustomEvent('vrm:favoris-auto', { detail: { uid: String(uid), ...r } })); } catch (_) {}
            } catch (_) { /* rien n'est parti sans autorisation : nouvel essai au tour suivant */ }
          }
        } finally { occupe.current = false; }
      }
      if (vivant.current) t = setTimeout(tour, tirage());
    };
    t = setTimeout(tour, 20000 + Math.round(Math.random() * 40000));
    return () => { vivant.current = false; clearTimeout(t); };
  }, [owner]);
  return null;
}
