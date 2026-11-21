// ═══════════════════════════════════════════════════════════════════════════
// LE RAPPORT DE PLANTAGES DU PROPRIÉTAIRE (15 nov., lot fiabilite-auto)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé) : « les plantages des autres vendeurs remontent agrégés et anonymes —
// message, écran, version, appareil, nombre d'utilisateurs touchés, jamais d'identité ».
// Trois sources déjà rangées, réunies ici (module PUR : la route, l'audit et le banc
// l'exécutent) :
//   · `comptes` — `plantagesParComptes` (api/_lib/plantages-comptes.js) : les journaux
//     `plantage_*` des vendeurs sur 7 jours, par type ; `comptes` = combien de vendeurs
//     (le propriétaire exclu), `versions`, `appareils` (« iOS Safari »), `bloque` (le
//     dernier filet a vu l'erreur : l'app ne s'ouvrait pas) ;
//   · `terrain` — `terrainPourPanneau` (api/_lib/alertes-plantages.js) : les alertes
//     anonymes du jour ; elles portent les OUVERTURES BLOQUÉES par un morceau périmé
//     (jamais rangées dans un journal de vendeur) et le nombre de personnes du jour ;
//   · `mesures` — `joursPourPanneau` (api/_lib/mesures-terrain.js) : les morceaux qui
//     n'ont pas chargé, comptés par les appareils (rattrapés par un rechargement).
// Chaque partie `null` reste `null` (« pas su », dit par l'écran), jamais 0.
// Rien ne sort qui désigne quelqu'un : des messages nettoyés, des noms d'écran, des
// versions, des navigateurs en deux mots, des nombres.
// ═══════════════════════════════════════════════════════════════════════════
import { PERSONNES_MIN } from '../../src/alertesPlantages.js';

export const TYPES_RAPPORT = 30;
const str = (v, n) => String(v == null ? '' : v).slice(0, n);

export function rapportPlantages({ comptes = null, terrain = null, mesures = null } = {}) {
  let types = null;
  if (Array.isArray(comptes) || Array.isArray(terrain)) {
    const parCle = new Map();
    for (const t of Array.isArray(comptes) ? comptes : []) {
      if (!t || !t.cle) continue;
      parCle.set(String(t.cle), {
        cle: str(t.cle, 120), message: str(t.message, 200), ecrans: (t.ecrans || []).map((e) => str(e, 40)).slice(0, 3),
        versions: (t.versions || []).map((v) => str(v, 40)).slice(0, 3), appareils: (t.appareils || []).map((a) => str(a, 30)).slice(0, 3),
        personnes: Number(t.comptes) || 0, fois: Number(t.fois) || 0, bloque: Number(t.bloque) || 0, dernier: str(t.dernier, 30),
      });
    }
    // Les jours d'alerte : les ouvertures bloquées (morceaux périmés compris) et le plus grand
    // nombre de personnes vu un même jour (jamais additionné d'un jour à l'autre : l'empreinte change).
    for (const j of Array.isArray(terrain) ? terrain : []) for (const t of (j && Array.isArray(j.types) ? j.types : [])) {
      if (!t || !t.cle) continue;
      const k = String(t.cle);
      const x = parCle.get(k) || { cle: str(k, 120), message: str(t.message, 200), ecrans: (t.ecrans || []).map((e) => str(e && e.nom ? e.nom : e, 40)).slice(0, 3), versions: (t.versions || []).map((v) => str(v, 40)).slice(0, 3), appareils: [], personnes: 0, fois: 0, bloque: 0, dernier: str(t.dernier, 30) };
      x.personnes = Math.max(x.personnes, Number(t.appareils) || 0);
      x.bloque = Math.max(x.bloque, Number(t.bloque) || 0);
      if (!parCle.has(k)) x.fois = Number(t.n) || 0;
      for (const a of Object.keys(t.navigateurs || {})) if (!x.appareils.includes(a) && x.appareils.length < 3) x.appareils.push(str(a, 30));
      if (String(t.dernier || '') > x.dernier) x.dernier = str(t.dernier, 30);
      parCle.set(k, x);
    }
    types = [...parCle.values()].map((x) => ({ ...x, aDire: x.personnes >= PERSONNES_MIN || x.bloque > 0 }))
      .sort((a, b) => (b.bloque > 0) - (a.bloque > 0) || b.personnes - a.personnes || b.fois - a.fois || b.dernier.localeCompare(a.dernier))
      .slice(0, TYPES_RAPPORT);
  }
  let morceaux = null;
  if (Array.isArray(mesures)) {
    morceaux = { n: 0, jours: 0, parEcran: {} };
    for (const j of mesures) {
      let vu = false;
      for (const l of (j && Array.isArray(j.lignes) ? j.lignes : [])) {
        if (!l || l.metrique !== 'morceau') continue;
        const n = Number(l.n) || 0; if (!n) continue;
        morceaux.n += n; vu = true;
        const e = str(l.ecran, 40); morceaux.parEcran[e] = (morceaux.parEcran[e] || 0) + n;
      }
      if (vu) morceaux.jours += 1;
    }
  }
  return { types, morceaux, seuil: PERSONNES_MIN };
}
