// Présenter le code d'un partenaire au serveur (sorti de src/partenaires/lien.js le 16 nov., lot
// vitesse-lectures : la page d'accueil n'emporte que la garde du code, l'app seule le présente).
import { CLE_PARTENAIRE, canon, codePartenaireGarde } from './lien.js';

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
