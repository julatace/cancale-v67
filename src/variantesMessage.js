// ═══════════════════════════════════════════════════════════════════════════
// TEMPS D'ÉCRITURE ET MESSAGES VARIÉS (12 nov., ext. 5.369 — validé par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// Julien, mot pour mot : « Un temps d'écriture avant chaque envoi. L'extension
// attend le temps qu'un humain mettrait à taper ce message, par exemple 8 à 20
// secondes pour une phrase, avec un peu de hasard, puis l'envoie d'un coup. » et
// « Des messages variés. […] VRM ferait tourner plusieurs versions que tu écris
// toi-même […]. Personne ne reçoit exactement la même phrase que le précédent.
// Tes 50 actions par heure ne changent pas. »
//
// Règles PURES (aucune lecture, aucun envoi). L'app s'en sert pour ranger les
// versions ; l'extension pour choisir la version et le temps d'attente.
// ⚠️ Le bloc entre les balises <variantes-regle> est RECOPIÉ tel quel dans
// vinted-sync-extension/background.js : `scripts/audit-ecriture-humaine.cjs`
// exige les deux copies identiques. Changer l'une sans l'autre le rend rouge.
//
// · Les versions : la 1re est le champ d'avant (`message` des favoris,
//   `vinted_offre_refus_msg`), les suivantes (2 à 5) sont rangées à côté
//   (`variantes`, `vinted_offre_refus_variantes`). Une extension plus ancienne ne
//   lit que la 1re : comportement d'avant. Le numéro d'une version est SA place à
//   l'écran (une version vide garde sa place, elle n'est jamais envoyée).
// · Le choix : au hasard, jamais la version du message précédent. Une seule
//   version ⇒ toujours elle (le texte d'avant). Aucune ⇒ rien (jamais inventé).
// · Le temps d'écriture : la longueur du texte à ≈ 4,5 caractères/s (une frappe
//   humaine, 3 à 6 c/s), ±25 % de hasard, borné 5 s – 45 s. Son propre clic
//   « Envoyer » dans l'app : 2 à 6 s (il a déjà tapé son texte lui-même).
//   AUCUNE touche simulée : on attend, puis la requête part d'un coup.
// <variantes-regle>
const VARIANTES_MAX = 5;
const ECRITURE_HUMAINE = { cps: 4.5, jitter: 0.25, minMs: 5000, maxMs: 45000, clicMinMs: 2000, clicMaxMs: 6000 };
function versionsMessage(premier, autres) {
  const liste = [premier].concat(Array.isArray(autres) ? autres : []).slice(0, VARIANTES_MAX);
  const out = [];
  for (let i = 0; i < liste.length; i++) {
    const t = typeof liste[i] === 'string' ? liste[i].trim() : '';
    if (t) out.push({ n: i + 1, texte: t });
  }
  return out;
}
function choisirVariante(versions, precedente, hasard) {
  const l = Array.isArray(versions) ? versions.filter((v) => v && typeof v.texte === 'string' && v.texte) : [];
  if (!l.length) return null;
  if (l.length === 1) return l[0];
  const p = Number(precedente);
  const cand = l.filter((v) => v.n !== p);
  const tirer = typeof hasard === 'function' ? hasard : Math.random;
  const h = Number(tirer());
  const i = Math.min(cand.length - 1, Math.max(0, Math.floor((Number.isFinite(h) ? h : 0) * cand.length)));
  return cand[i];
}
function tempsEcritureMs(texte, mode, hasard) {
  const tirer = typeof hasard === 'function' ? hasard : Math.random;
  let h = Number(tirer()); if (!Number.isFinite(h) || h < 0) h = 0; if (h > 1) h = 1;
  const E = ECRITURE_HUMAINE;
  if (mode === 'clic') return Math.round(E.clicMinMs + h * (E.clicMaxMs - E.clicMinMs));
  const n = String(texte == null ? '' : texte).length;
  const base = (n / E.cps) * 1000 * (1 - E.jitter + 2 * E.jitter * h);
  return Math.round(Math.min(E.maxMs, Math.max(E.minMs, base)));
}
// </variantes-regle>

// Les versions telles qu'on les RANGE : la 1re à part (le champ d'avant), les
// autres en liste, vides retirées en fin de liste seulement (une version du
// milieu vidée garde la place des suivantes tant qu'il édite ; au rangement,
// les vides sont retirées et les numéros se resserrent — dit à l'écran).
function variantesARanger(autres) {
  const l = (Array.isArray(autres) ? autres : []).filter((t) => typeof t === 'string').map((t) => t.slice(0, 2000));
  return l.filter((t) => t.trim()).slice(0, VARIANTES_MAX - 1);
}
// Une liste RELUE (base, autre appareil) : rien d'autre que des textes, 4 au plus.
// Un champ vide garde sa place (il est en cours d'écriture ; il n'est jamais envoyé).
function variantesLues(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((t) => typeof t === 'string').map((t) => t.slice(0, 2000)).slice(0, VARIANTES_MAX - 1);
}

export { VARIANTES_MAX, ECRITURE_HUMAINE, versionsMessage, choisirVariante, tempsEcritureMs, variantesARanger, variantesLues };
