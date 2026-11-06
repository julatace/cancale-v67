// ════════════════════════════════════════════════════════════════════════════
//  COLIS, CÔTÉ ENVOI (5 nov., chantier D) — des règles pures, jugées par
//  `scripts/audit-colis-envoi.cjs` et rendues par l'écran Colis.
//
//  · TEMPS DE PRÉPARATION : depuis combien de jours une vente attend son envoi
//    (jours de calendrier à Paris depuis la date de VENTE — la seule date lue
//    qu'ont toutes les ventes). L'ordre : la date limite d'abord (`jours`,
//    celle de `limiteExpedition` : LUE dans l'e-mail du bordereau si on l'a,
//    sinon l'estimation vente + 7 j), puis, à limite égale, la vente la plus
//    ANCIENNE en haut. La phrase de l'attente ne parle jamais de retard : c'est
//    la limite LUE qui le dit (§5 : une date estimée n'est jamais « en retard »).
//  · LE TITRE DE « EN GRAND » : l'article (relié par identité) ou « Colis
//    <transporteur> » — jamais le sujet d'un e-mail (« Votre colis … est
//    disponible dans votre Point Relais »).
//  · LA TOURNÉE DE DÉPÔT : les colis à envoyer rangés par transporteur — le
//    réseau où on les dépose. Le point de dépôt précis d'un colis n'est relié à
//    lui par aucune identité (src/tournee.js) : jamais deviné.
// ════════════════════════════════════════════════════════════════════════════

const JOUR = 864e5;
// Le jour de calendrier à Paris d'un instant (« 2026-11-05 »).
const jourParis = (ms) => {
  try { return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); }
  catch (_) { return new Date(ms).toISOString().slice(0, 10); }
};
const msDe = (v) => {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === 'string' && v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }
  return null;
};

// Jours de calendrier écoulés depuis la vente (0 = vendue aujourd'hui). Date
// illisible ou dans le futur ⇒ null (« pas su », jamais 0).
export function joursAttente(dateVente, maintenant = Date.now()) {
  const t = msDe(dateVente);
  if (t == null || t > maintenant + 60e3) return null;
  const a = Date.parse(jourParis(t) + 'T00:00:00Z'), b = Date.parse(jourParis(maintenant) + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / JOUR));
}

// La phrase courte de l'attente (aucune couleur ici : l'urgence est celle de la limite).
export function texteAttente(j) {
  if (j == null || !Number.isFinite(j)) return '';
  if (j <= 0) return 'vendue aujourd’hui';
  return `attend depuis ${j} j`;
}

// L'ordre de préparation : limite la plus proche d'abord (sans limite : à la fin),
// puis la vente la plus ancienne (attente la plus longue), puis l'ordre reçu.
export function ordrePreparation(items, { jours, attente }) {
  const L = Array.isArray(items) ? items : [];
  const jr = (x) => { const v = jours(x); return v == null || !Number.isFinite(Number(v)) ? 9999 : Number(v); };
  const at = (x) => { const v = attente(x); return v == null || !Number.isFinite(Number(v)) ? -1 : Number(v); };
  return L.map((x, i) => [x, i]).sort((a, b) => jr(a[0]) - jr(b[0]) || at(b[0]) - at(a[0]) || a[1] - b[1]).map(([x]) => x);
}

// Un sujet d'e-mail n'est pas un nom d'article : vouvoiement, phrase d'annonce.
const SUJET_EMAIL = /\b(vous|votre|vos)\b|\b(est|sont)\s+(disponible|arriv|livr|en\s+route|exp[ée]di)|\b(ton|ta|tes)\s+(colis|achat|commande)\b|\bpoint\s+relais\b|^\s*(re|tr|fwd?)\s*:/i;
export const ressembleSujetEmail = (s) => SUJET_EMAIL.test(String(s || ''));

// Le titre de « En grand » : l'article relié par identité, sinon le titre d'article
// porté par l'e-mail s'il en est un, sinon « Colis <transporteur> » (ou « Colis »).
export function titreEnGrand({ article, artTitle, transporteur } = {}) {
  const a = String(article || '').trim();
  if (a && !ressembleSujetEmail(a)) return a;
  const t = String(artTitle || '').trim();
  if (t && !ressembleSujetEmail(t)) return t;
  const tr = String(transporteur || '').trim();
  return tr ? `Colis ${tr}` : 'Colis';
}

// La tournée : un groupe par transporteur, dans l'ordre où l'écran les montre
// (celui de leur premier colis), chaque colis UNE fois par sa clé d'identité.
export function groupesTournee(items, { trNom, cle }) {
  const vus = new Set(), m = new Map();
  for (const x of (Array.isArray(items) ? items : [])) {
    if (!x) continue;
    const k = String(cle(x));
    if (!k || vus.has(k)) continue;
    vus.add(k);
    const nom = trNom(x) || 'Autres';
    if (!m.has(nom)) m.set(nom, { nom, colis: [] });
    m.get(nom).colis.push(x);
  }
  return [...m.values()];
}
