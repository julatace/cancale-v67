// ── MES MODÈLES DE DESCRIPTION (3 novembre 2026, choix de Julien) ───────────
// Paramètres → Annonces → « Mes modèles » : des textes types (état, envoi,
// mesures…) avec des variables simples, insérés en un tap dans la description
// d'une préparation (Leboncoin, eBay, brouillon de Republier).
// Rangés dans `vrm_modeles_desc` (ligne `main`, synchronisée comme le reste).
// Une variable sans valeur RESTE écrite telle quelle (« {taille} ») : on ne
// devine jamais une taille ou une marque, et le trou se voit avant l'envoi.
// Module PUR : la feuille (src/ModelesDescription.jsx) et le banc `modeles-description`.

export const CLE_MODELES = 'vrm_modeles_desc';
export const VARIABLES = ['taille', 'marque', 'N°', 'titre', 'prix'];
const MAX_MODELES = 30, MAX_TEXTE = 2000, MAX_NOM = 40;

const str = (v) => String(v == null ? '' : v);

// Ce qui est rangé, nettoyé : [{ id, nom, texte }] (au plus 30).
export function lireModeles(v) {
  const l = Array.isArray(v) ? v : [];
  const vus = new Set(), out = [];
  for (const m of l) {
    if (!m || typeof m !== 'object') continue;
    const id = str(m.id).slice(0, 40), texte = str(m.texte).slice(0, MAX_TEXTE);
    if (!id || vus.has(id) || !texte.trim()) continue;
    vus.add(id);
    out.push({ id, nom: str(m.nom).trim().slice(0, MAX_NOM) || texte.trim().split('\n')[0].slice(0, MAX_NOM), texte });
    if (out.length >= MAX_MODELES) break;
  }
  return out;
}

// Les variables remplacées. `v` : { taille, marque, numero, titre, prix }.
// Accepte {N°}, {n°}, {numero}, {numéro} ; insensible à la casse.
export function remplirModele(texte, v = {}) {
  const val = {
    taille: v.taille, marque: v.marque, titre: v.titre,
    'n°': v.numero != null && str(v.numero).trim() ? `N°${str(v.numero).trim()}` : null,
    numero: v.numero, 'numéro': v.numero,
    prix: v.prix != null && Number.isFinite(Number(v.prix)) && Number(v.prix) > 0 ? `${String(Math.round(Number(v.prix) * 100) / 100).replace('.', ',')}\u00a0€` : null,
  };
  return str(texte).replace(/\{\s*([^{}\s]{1,10})\s*\}/g, (tout, nom) => {
    const k = nom.toLowerCase();
    if (!(k in val)) return tout;
    const x = val[k];
    return x != null && str(x).trim() ? str(x).trim() : tout;
  });
}

// Insérer à la position du curseur (sinon à la fin), séparé par une ligne vide.
export function insererDans(desc, ajout, pos) {
  const d = str(desc), a = str(ajout);
  if (!a) return { texte: d, curseur: d.length };
  const p = Number.isInteger(pos) && pos >= 0 && pos <= d.length ? pos : d.length;
  const avant = d.slice(0, p), apres = d.slice(p);
  const sepA = !avant ? '' : /\n\n$/.test(avant) ? '' : /\n$/.test(avant) ? '\n' : '\n\n';
  const sepB = !apres ? '' : /^\n/.test(apres) ? '' : '\n\n';
  const texte = avant + sepA + a + sepB + apres;
  return { texte, curseur: (avant + sepA + a).length };
}

export const nouveauModele = (nom, texte, id) => ({ id: String(id), nom: str(nom).trim().slice(0, MAX_NOM), texte: str(texte).slice(0, MAX_TEXTE) });
