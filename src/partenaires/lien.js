// ═══════════════════════════════════════════════════════════════════════════
// LE LIEN D'UN PARTENAIRE (15 nov.) — `https://vrm.center/p/LEO` (vercel.json →
// `/?partenaire=LEO`). Même chemin que le lien de parrainage : le code est GARDÉ
// sur l'appareil jusqu'à ce qu'un compte connecté le présente au serveur, UNE
// fois ; le serveur décide tout (api/_lib/partenaires.js `rattacherPartenaire`).
// Un refus définitif l'efface ; « pas su » (5xx, pas de session) le garde.
// (`?code=` est pris par le retour d'une connexion Google : jamais utilisé ici.)
// ═══════════════════════════════════════════════════════════════════════════
export const CLE_PARTENAIRE = 'vrm_partenaire_code';
export const CODE_PARTENAIRE_RE = /^[A-Z0-9]{3,16}$/;
const canon = (c) => { const t = String(c == null ? '' : c).trim().toUpperCase(); return CODE_PARTENAIRE_RE.test(t) ? t : ''; };

export function codePartenaireDe(search) {
  try { return canon(new URLSearchParams(search || '').get('partenaire')); } catch (_) { return ''; }
}
// `/p/LEO` ouvert sans la redirection (copie d'adresse, aperçu local).
export function codePartenaireDuChemin(chemin) {
  const m = /^\/p\/([A-Za-z0-9]{3,16})\/?$/.exec(String(chemin || ''));
  return m ? canon(m[1]) : '';
}
export function codePartenaireGarde(stock) {
  try { return canon(stock && stock.getItem(CLE_PARTENAIRE)); } catch (_) { return ''; }
}
export function garderCodePartenaire(stock, search, chemin) {
  const c = codePartenaireDe(search) || codePartenaireDuChemin(chemin);
  if (c) { try { stock.setItem(CLE_PARTENAIRE, c); } catch (_) {} }
  return c;
}

// Présenter le code gardé (ou celui posé sur le compte à l'inscription) — une fois.
// Rend 'ok' · 'refus' · 'garde' (à refaire plus tard) · 'rien'.
export async function presenterCodePartenaire({ fetcher, enTete, stock, uid, duCompte, dire }) {
  let code = codePartenaireGarde(stock);
  const cleTente = uid ? 'vrm_partenaire_tente_' + uid : '';
  let deja = false; try { deja = !!cleTente && stock.getItem(cleTente) === '1'; } catch (_) {}
  if (!code && !deja) code = canon(duCompte);
  if (!code || !enTete || !enTete.Authorization) return 'rien';
  let r;
  try { r = await fetcher('/api/compte?mode=partenaire', { method: 'POST', headers: { 'Content-Type': 'application/json', ...enTete }, body: JSON.stringify({ action: 'rattacher', code }) }); }
  catch (_) { return 'garde'; }
  if (!r || r.status >= 500 || r.status === 401) return 'garde';
  const j = await r.json().catch(() => null);
  try { stock.removeItem(CLE_PARTENAIRE); if (cleTente) stock.setItem(cleTente, '1'); } catch (_) {}
  if (r.ok && j && j.ok) { if (dire) dire('ok', j); return 'ok'; }
  if (dire && j && j.raison) dire('refus', j);
  return 'refus';
}
