// ── LA BOÎTE DE RÉCEPTION DES E-MAILS (5 nov., demande de Julien) ──────────
// « Une vraie boîte de réception, des filtres (par compte, ventes, achats,
// codes de retrait…) ». UNE règle (§11) : à quelle rubrique appartient un email
// rangé par la route email-inbound (ligne `email_reception_*`). Le serveur la
// traduit en filtre PostgREST (`filtreBoite`) ; l'écran (src/BoiteEmails.jsx)
// lit la même fonction (`rubriqueEmail`) pour l'étiquette de chaque ligne.
// `scripts/audit-boite-emails.cjs` vérifie que les deux disent la même chose.
//
// Mesuré le 5 nov. (lecture seule, sa base) : 883 lignes `email_reception_*`,
// `type` présent sur toutes ; `resume` sur 413 (classées depuis le 31 oct.) ;
// le code de retrait vit dans `resume.code` (45 lignes). Une ligne d'avant le
// résumé n'a pas de code lu : elle est dans « Colis », jamais dans « Codes »
// (« pas su » ≠ « oui »).
//
// Les rubriques NE SE DEVINENT PAS au texte : seul le `type` posé au
// classement (et le code LU) décide. « Codes de retrait » est une partie de
// « Colis » (un code est un colis à retirer) ; « Autres » est tout le reste.

export const RUBRIQUES_BOITE = [
  { id: '', mot: 'Tout' },
  { id: 'ventes', mot: 'Ventes' },
  { id: 'achats', mot: 'Achats' },
  { id: 'codes', mot: 'Codes de retrait' },
  { id: 'colis', mot: 'Colis' },
  { id: 'autres', mot: 'Autres' },
];
const TYPES = {
  ventes: ['vente', 'finalisation', 'vente-vestiaire'],
  achats: ['achat'],
  colis: ['suivi', 'bordereau'],
};
const PRINCIPAUX = [...TYPES.ventes, ...TYPES.achats, ...TYPES.colis];
const aUnCode = (resume) => !!(resume && typeof resume === 'object' && !Array.isArray(resume) && typeof resume.code === 'string' && resume.code.trim());

// La rubrique PRINCIPALE d'un email (une seule, pour l'étiquette de la ligne).
export function rubriqueEmail(e) {
  const t = String((e && e.type) || '');
  if (t === 'suivi' && aUnCode(e && e.resume)) return 'codes';
  if (TYPES.ventes.includes(t)) return 'ventes';
  if (TYPES.achats.includes(t)) return 'achats';
  if (TYPES.colis.includes(t)) return 'colis';
  return 'autres';
}
// Un email est-il montré sous ce filtre ? (« Colis » montre aussi les codes.)
export function dansRubrique(e, rubrique) {
  if (!rubrique) return true;
  const r = rubriqueEmail(e);
  if (rubrique === 'colis') return r === 'colis' || r === 'codes';
  return r === rubrique;
}
// Le même filtre, en PostgREST, sur la ligne `email_reception_*`. Une rubrique
// inconnue ⇒ '' (aucun filtre : le serveur la refuse avant, voir l'appelant).
export function filtreBoite(rubrique) {
  const liste = (l) => l.map((t) => encodeURIComponent(t)).join(',');
  switch (rubrique) {
    case 'ventes': return `data->>type=in.(${liste(TYPES.ventes)})`;
    case 'achats': return `data->>type=in.(${liste(TYPES.achats)})`;
    case 'colis': return `data->>type=in.(${liste(TYPES.colis)})`;
    case 'codes': return 'data->>type=eq.suivi&data->resume->>code=not.is.null';
    case 'autres': return `data->>type=not.in.(${liste(PRINCIPAUX)})`;
    default: return '';
  }
}
export const rubriqueConnue = (r) => RUBRIQUES_BOITE.some((x) => x.id && x.id === r);

// ── LES PIÈCES JOINTES ───────────────────────────────────────────────────────
// Au classement, la ligne de suivi garde la LISTE des pièces jointes (nom,
// type, poids) — jamais leur contenu (le PDF d'un bordereau vit dans SA ligne
// `email_bord_*`). Borné : 10 pièces, 120 caractères de nom.
export const PIECES_MAX = 10;
export function listePieces(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments.slice(0, PIECES_MAX).map((a) => {
    const nom = String((a && (a.filename || a.name)) || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120) || 'sans nom';
    const type = String((a && (a.contentType || a.type)) || '').trim().slice(0, 60);
    const b64 = a && typeof a.contentB64 === 'string' ? a.contentB64 : (a && typeof a.content === 'string' ? a.content : '');
    const o = b64 ? Math.floor(b64.replace(/=+$/, '').length * 3 / 4) : null;
    return o == null ? { n: nom, t: type } : { n: nom, t: type, o };
  });
}
