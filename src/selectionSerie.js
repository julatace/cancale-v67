// ══════════════════════════════════════════════════════════════════════════════
//  SÉLECTIONNER PLUSIEURS LIGNES, AGIR UNE FOIS (11 nov. 2026, lot actions-serie)
// ══════════════════════════════════════════════════════════════════════════════
// Un seul mécanisme pour toutes les listes (Achats, Ventes, Stock, Messages ;
// Annonces garde sa vue « Sélectionner » à cases, chantier C) :
//   · au doigt : un appui long sur une ligne ouvre la sélection, puis un tap
//     coche / décoche ;
//   · à la souris : la case de la ligne, Maj-clic coche toute la plage depuis
//     la dernière case touchée ;
//   · une barre flottante « N sélectionnés » : « Tout sélectionner » (le FILTRE
//     COURANT seulement, jamais une ligne cachée), les actions, « Annuler » ;
//     Échap sort de la sélection.
//
// Règle d'une action en série (principe de Julien : « surtout PRATIQUE ») :
//   · c'est la MÊME fonction que l'action unitaire, appliquée ligne par ligne ;
//     une ligne où l'action unitaire n'aurait pas de sens n'est pas forcée :
//     elle est « pas faite » avec SA raison ;
//   · le résumé est honnête : « 8 faits · 2 pas faits : pas au point relais » ;
//     jamais « 10 faits » quand 2 ont échoué ;
//   · un geste qui touche Vinted passe par les mêmes commandes et le même
//     plafond (45 gestes de l'app par heure et par compte, réserve 5 sur 50,
//     CLAUDE.md §3) : au-delà, « pas fait : plafond », jamais plus vite.
//
// Module PUR (aucun React, aucune horloge cachée) : exécuté tel quel par
// `scripts/audit-actions-serie.cjs`.

export const PLAFOND_APP_HEURE = 45;   // 50 actions/h/compte − RESERVE_GESTES (5)
export const APPUI_LONG_MS = 450;      // au doigt : le temps d'un appui long

const S = (x) => String(x == null ? '' : x);

// Coche ou décoche UNE ligne (la sélection est un tableau de clés, ordre gardé).
export function basculer(sel, cle) {
  const k = S(cle); if (!k) return Array.isArray(sel) ? sel : [];
  const l = Array.isArray(sel) ? sel.map(S) : [];
  return l.includes(k) ? l.filter((x) => x !== k) : [...l, k];
}

// Maj-clic : toute la plage entre la dernière case touchée (`ancre`) et `cle`,
// dans l'ORDRE AFFICHÉ (`ordre`), prend l'état voulu (`coche`). Une ancre
// absente de la liste affichée ⇒ la ligne seule.
export function plage(ordre, ancre, cle, sel, coche = true) {
  const o = (Array.isArray(ordre) ? ordre : []).map(S);
  const k = S(cle), a = S(ancre);
  const i = o.indexOf(k), j = o.indexOf(a);
  const l = Array.isArray(sel) ? sel.map(S) : [];
  if (i < 0) return l;
  const morceau = j < 0 ? [k] : o.slice(Math.min(i, j), Math.max(i, j) + 1);
  if (!coche) { const sauf = new Set(morceau); return l.filter((x) => !sauf.has(x)); }
  const deja = new Set(l);
  return [...l, ...morceau.filter((x) => !deja.has(x))];
}

// « Tout sélectionner » : les lignes du filtre courant, rien d'autre.
export const toutSelectionner = (ordre) => [...new Set((Array.isArray(ordre) ? ordre : []).map(S).filter(Boolean))];

// Le filtre a changé : une ligne qui n'est plus affichée sort de la sélection
// (une action ne part jamais sur une ligne qu'il ne voit pas).
export function garderVisibles(sel, ordre) {
  const vus = new Set((Array.isArray(ordre) ? ordre : []).map(S));
  const l = Array.isArray(sel) ? sel.map(S) : [];
  const n = l.filter((x) => vus.has(x));
  return n.length === l.length ? sel : n;
}

// Ce qu'une action unitaire rend, ramené à une forme : `false` ou
// `{ fait:false, raison }` ⇒ pas faite ; une exception ⇒ pas faite (son
// message) ; tout le reste (undefined, true, un objet) ⇒ faite.
export function issue(r) {
  if (r === false) return { fait: false, raison: 'refusé' };
  if (r && typeof r === 'object' && r.fait === false) return { fait: false, raison: S(r.raison).trim() || 'refusé' };
  return { fait: true };
}

// Trier les lignes AVANT d'agir : `peut(ligne)` rend `true` ou la raison
// (texte) pour laquelle l'action unitaire ne s'applique pas à cette ligne.
// Un geste Vinted ne prend que `restant` lignes (le plafond) : les autres sont
// « pas faites : plafond » — dites, jamais envoyées.
export function trierSerie(lignes, peut, { vinted = false, restant = null } = {}) {
  const ok = [], pasFaits = [];
  const L = Array.isArray(lignes) ? lignes : [];
  for (const l of L) {
    let p; try { p = typeof peut === 'function' ? peut(l) : true; } catch (e) { p = S(e && e.message) || 'pas su'; }
    if (p === true) ok.push(l); else pasFaits.push({ ligne: l, raison: S(p).trim() || 'pas possible' });
  }
  if (vinted) {
    const r = restant == null ? null : Math.max(0, Math.floor(Number(restant) || 0));
    // « pas su » ne vaut pas « oui » : un plafond inconnu n'envoie rien.
    const garde = r == null ? 0 : Math.min(r, PLAFOND_APP_HEURE);
    const raison = r == null ? 'plafond de l’heure pas lu' : `plafond de ${PLAFOND_APP_HEURE} gestes par heure atteint`;
    for (const l of ok.splice(garde)) pasFaits.push({ ligne: l, raison });
  }
  return { ok, pasFaits };
}

// Exécuter ligne par ligne, UNE à la fois (jamais en parallèle : un geste
// Vinted part par la file de l'extension, une requête à la fois). `pause(ms)`
// et `entre` (ms) viennent de l'écran : le module n'a pas d'horloge.
export async function executerSerie(lignes, faire, { cle = (l) => l, pause = null, entre = 0 } = {}) {
  const faits = [], pasFaits = [];
  const L = Array.isArray(lignes) ? lignes : [];
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    let r; try { r = await faire(l, i); } catch (e) { r = { fait: false, raison: S(e && e.message) || 'erreur' }; }
    const x = issue(r);
    if (x.fait) faits.push(S(cle(l))); else pasFaits.push({ cle: S(cle(l)), raison: x.raison });
    if (entre > 0 && i < L.length - 1 && typeof pause === 'function') await pause(entre);
  }
  return { faits, pasFaits };
}

// « 8 faits · 2 pas faits : pas au point relais » ; plusieurs raisons ⇒ chacune
// avec son nombre. `mot` = { un, plusieurs } (« retiré » / « retirés »).
export function resumeSerie({ faits = [], pasFaits = [] } = {}, mot = { un: 'fait', plusieurs: 'faits' }) {
  const nf = Array.isArray(faits) ? faits.length : Number(faits) || 0;
  const P = Array.isArray(pasFaits) ? pasFaits : [];
  const parts = [`${nf} ${nf > 1 ? mot.plusieurs : mot.un}`];
  if (P.length) {
    const raisons = new Map();
    for (const p of P) { const r = S(p && p.raison).trim() || 'pas possible'; raisons.set(r, (raisons.get(r) || 0) + 1); }
    const R = [...raisons.entries()];
    parts.push(R.length === 1
      ? `${P.length} pas ${P.length > 1 ? 'faits' : 'fait'} : ${R[0][0]}`
      : `${P.length} pas faits : ` + R.map(([r, n]) => `${n} ${r}`).join(', '));
  }
  return parts.join(' · ');
}

// Compter les gestes : la série coûte `1 + 1` (sélectionner tout, agir) +
// confirmations ; l'unitaire coûte `parLigne × n`. Sert au récit et au banc.
export const gestesSerie = (n, { selection = 2, confirmation = 0 } = {}) => (n > 0 ? selection + 1 + confirmation : 0);
export const gestesUnitaires = (n, parLigne = 2) => Math.max(0, n) * parLigne;

// Une ligne de CSV (point-virgule, Excel français), guillemets doublés.
export function ligneCsv(valeurs) {
  return (Array.isArray(valeurs) ? valeurs : []).map((v) => {
    const t = S(v);
    return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }).join(';');
}
export function csvDe(entetes, lignes) {
  return '﻿' + [ligneCsv(entetes), ...(Array.isArray(lignes) ? lignes : []).map(ligneCsv)].join('\r\n') + '\r\n';
}
