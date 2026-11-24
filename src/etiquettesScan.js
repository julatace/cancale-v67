// ════════════════════════════════════════════════════════════════════════════
//  UN CODE IMPRIMÉ SUR L'ÉTIQUETTE ⇒ LA VENTE DE CETTE ÉTIQUETTE (17 nov., lot scan-bordereau-vente)
//
//  Julien (17 nov. au matin, en production) : « le scanner de bordereau ne marche pas, faut retrouver
//  l'article qu'il y a à l'intérieur ». Il avait imprimé un bordereau de VENTE Vinted et l'avait scanné.
//
//  MESURÉ (lecture seule, son dernier bordereau Mondial Relay du 16 nov. ; rien recopié ici) : l'étiquette
//  porte QUATRE codes-barres Code 128. Trois sont le MÊME, imprimés en grand (deux tournés) : une lettre puis
//  19 chiffres (« H 100452 0249… » en clair dessous) — il ne contient PAS le n° de suivi et n'est rangé nulle
//  part chez VRM. Le quatrième, plus petit et tourné sur le bord : 26 chiffres « 55… », dont les chiffres 3 à 10
//  sont le n° de suivi de l'e-mail. Le téléphone lit d'abord le grand ⇒ « pas un n° de suivi », à chaque fois.
//  Et une étiquette captée par l'extension (`harvest_{uid}_label_{tx}`) ne porte AUCUN n° de suivi rangé.
//
//  LA RÈGLE (une identité EXACTE, §5) : chaque code-barres de transporteur est imprimé EN CLAIR sous lui, sur
//  l'étiquette rangée pour SA transaction (`email_bord_{tx}`, `harvest_{uid}_label_{tx}` — reliées à la vente
//  par son n° de transaction). Un code lu qui n'est pas un n° de suivi connu est cherché, lettres et chiffres
//  seulement, dans le texte de ces étiquettes (le lecteur sans IA d'api/_lib/texte-pdf.js, celui du serveur) :
//    · UNE étiquette le porte ⇒ sa vente ;
//    · deux ou plus ⇒ la liste, il choisit (jamais l'une à sa place) ;
//    · aucune ⇒ rien, dit ; une étiquette illisible ⇒ « pas su », dit.
//  Un code trop court (< 10 signes) n'est jamais cherché : il pourrait être le morceau d'un autre.
//  Module PUR : l'app (src/App.jsx), le scanner et scripts/bancs/scan-bordereau-vente.cjs l'exécutent.
// ════════════════════════════════════════════════════════════════════════════
export const CODE_MIN = 10;
export const MAX_ETIQUETTES = 60;
export const PARALLELE = 4;

// Lettres et chiffres seulement, en majuscules (le texte sous un code-barres est souvent espacé par groupes).
export const normaliserCode = (s) => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
export const codeCherchable = (brut) => normaliserCode(brut).length >= CODE_MIN;

// Le texte d'une étiquette porte-t-il CE code ? Égalité de suite exacte dans le texte « collé ».
export function etiquettePorte(texte, code) {
  const c = normaliserCode(code);
  if (c.length < CODE_MIN || texte == null) return false;
  return normaliserCode(texte).includes(c);
}

// `candidats` : [{ cle, ... }] ; `lireTexte(candidat)` ⇒ Promise<string | null> (null = étiquette pas lue).
// Rend { etat: 'un' | 'plusieurs' | 'aucun' | 'pasSu', trouves, pasLus }.
export async function chercherCodeDansEtiquettes(code, candidats, lireTexte, { parallele = PARALLELE } = {}) {
  const c = normaliserCode(code);
  if (c.length < CODE_MIN) return { etat: 'aucun', trouves: [], pasLus: 0 };
  const liste = (Array.isArray(candidats) ? candidats : []).slice(0, MAX_ETIQUETTES);
  const trouves = []; let pasLus = 0; let i = 0;
  const suivant = async () => {
    while (i < liste.length) {
      const x = liste[i++];
      let t = null; try { t = await lireTexte(x); } catch (_) { t = null; }
      if (t == null) { pasLus++; continue; }
      if (etiquettePorte(t, c)) trouves.push(x);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(parallele, liste.length)) }, suivant));
  if (trouves.length === 1) return { etat: 'un', trouves, pasLus };
  if (trouves.length > 1) return { etat: 'plusieurs', trouves, pasLus };
  return { etat: pasLus ? 'pasSu' : 'aucun', trouves: [], pasLus };
}
