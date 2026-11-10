// ════════════════════════════════════════════════════════════════════════════
//  L'ESPACE FORMATEUR — règles de l'app (10 novembre, lot AR, migration 032)
//  Module PUR : exécuté par scripts/audit-formateurs.cjs.
//
//  Le TABLEAU DE SUIVI du formateur ne refait aucune règle (§11) : il lit
//   · les chiffres d'un élève tels que la BASE les rend (025, `vrm_accomp_vue`) :
//     présents seulement si l'élève est accepté ET partage ses chiffres ;
//   · ses étapes cochées telles que la BASE les rend (032, `vrm_form_progres_vu`) :
//     présentes seulement si l'élève a DONNÉ son accord.
//  « Pas su » ≠ 0 (§5) : un élève qui ne partage pas, ou dont les chiffres ne
//  sont pas encore arrivés, n'est JAMAIS compté à zéro ; le total se dit
//  « au moins … » avec la couverture « N élèves sur M ».
// ════════════════════════════════════════════════════════════════════════════

export const ADRESSE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
export const adresseOk = (a) => ADRESSE_RE.test(String(a || '')) && !String(a).includes('--');

// Une adresse PROPOSÉE depuis un nom (« Coach Julien » → « coach-julien ») :
// rien n'est rangé avant son clic, et la base refuse une adresse prise.
export function adresseDepuisNom(nom) {
  const a = String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 30).replace(/-$/g, '');
  return adresseOk(a) ? a : '';
}

export const lienPage = (adresse, origine = (typeof location !== 'undefined' ? location.origin : 'https://vrm.center')) =>
  `${origine}/f/${encodeURIComponent(adresse || '')}`;

// Le lien « Demander à rejoindre » de la page publique, gardé par l'app avant
// de nettoyer l'adresse : { adresse, groupe } vérifiés, sinon null.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function lienFormateurLu(brut) {
  try {
    const o = typeof brut === 'string' ? JSON.parse(brut) : brut;
    const a = String((o && o.a) || '').trim().toLowerCase(), g = String((o && o.g) || '');
    return adresseOk(a) && UUID_RE.test(g) ? { adresse: a, groupe: g } : null;
  } catch (_) { return null; }
}

export const moisCle = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

// ── LE TABLEAU DE SUIVI D'UN GROUPE ──────────────────────────────────────────
// membres : `crees[i].membres` de la 025 (vues rendues par la base) ;
// form    : `crees[j]` de la 032 pour CE groupe ({ etapes, progres }) ou null.
// Rend une ligne par élève ACCEPTÉ et le total du mois, honnête.
export function suiviGroupe(membres, form, maintenant = Date.now()) {
  const mois = moisCle(maintenant);
  const etapes = form && Array.isArray(form.etapes) ? form.etapes : null;
  const ids = new Set((etapes || []).map((e) => e.id));
  const progres = new Map(((form && form.progres) || []).map((p) => [p.membre, p]));
  const lignes = (membres || []).filter((m) => m && m.statut === 'accepte').map((m) => {
    // Chiffres : la clé `chiffres` n'existe que si l'élève les partage (règle de la base).
    let chiffres = 'prive', ventes = null, ca = null;
    if ('chiffres' in m) {
      if (m.chiffres == null || m.chiffres.ventes !== true) chiffres = 'attente';
      else {
        chiffres = 'lu';
        const v = (m.chiffres.mois || {})[mois];
        // Un mois absent d'agrégats PUBLIÉS = aucune vente ce mois (la moitié « ventes » est connue).
        ventes = Array.isArray(v) ? Number(v[0]) || 0 : 0;
        ca = Array.isArray(v) ? Number(v[1]) || 0 : 0;
      }
    }
    // Étapes : la clé `faits` n'existe que si l'élève a donné son accord (règle de la base).
    const p = progres.get(m.id);
    const faits = etapes && p && Array.isArray(p.faits) ? p.faits.filter((x) => ids.has(x)).length : null;
    return { id: m.id, nom: m.nom, partage: m.partage, chiffres, ventes, ca,
      etapes: etapes ? (faits == null ? 'prive' : 'lu') : 'aucune', faits, total: etapes ? etapes.length : 0 };
  });
  const lus = lignes.filter((l) => l.chiffres === 'lu');
  return {
    lignes,
    eleves: lignes.length,
    partagent: lus.length,
    ventes: lus.length ? lus.reduce((s, l) => s + l.ventes, 0) : null,
    ca: lus.length ? lus.reduce((s, l) => s + l.ca, 0) : null,
    complet: lignes.length > 0 && lus.length === lignes.length,
    mois,
  };
}
