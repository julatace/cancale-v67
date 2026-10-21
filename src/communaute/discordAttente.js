// « Se connecter avec Discord » depuis le TÉLÉPHONE (21 octobre).
// Sur iPhone, l'app ajoutée à l'écran d'accueil n'a pas les cookies de Safari, et
// l'app Discord renvoie le retour dans le navigateur par défaut : la preuve arrive
// AILLEURS que dans l'app qui a lancé le geste. Le serveur la range pour ce compte
// VRM, sous l'empreinte d'un ticket que seule cette app connaît ; l'app la reprend
// ici, au retour au premier plan (et toutes les 3 s pendant 15 min).
const CLE = 'vrm_discord_ticket';
const VALIDITE_MS = 15 * 60 * 1000;

export function noterTicketDiscord(ticket, ou) {
  if (!/^[0-9a-f]{32}$/.test(String(ticket || ''))) return;
  try { localStorage.setItem(CLE, JSON.stringify({ t: ticket, ou: ou === 'compte' ? 'compte' : 'carte', at: Date.now() })); } catch (_) {}
}
function lireTicket() {
  try {
    const o = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (!o || !/^[0-9a-f]{32}$/.test(String(o.t || ''))) return null;
    if (!(Date.now() - Number(o.at) <= VALIDITE_MS)) { localStorage.removeItem(CLE); return null; }
    return o;
  } catch (_) { return null; }
}
export function oublierTicketDiscord() { try { localStorage.removeItem(CLE); } catch (_) {} }

let enVol = false;
// Rend true si une preuve a été reprise (l'app est alors rechargée sur le bon écran,
// par le même chemin que le retour direct : main.jsx met le fragment de côté).
export async function reprendreDiscord(enTete) {
  const o = lireTicket();
  if (!o || enVol) return false;
  enVol = true;
  try {
    const r = await fetch('/api/compte?mode=discord-attente', { method: 'POST', headers: { ...enTete(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: o.t }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.pret !== true || !j.discord || !j.preuve) return false;
    oublierTicketDiscord();
    const frag = 'discord=' + encodeURIComponent(j.discord) + '&preuve=' + encodeURIComponent(j.preuve);
    window.location.assign(j.ou === 'compte' ? '/?tab=settings&vue=compte#' + frag + '&ou=compte' : '/?tab=communaute#' + frag);
    return true;
  } catch (_) { return false; } finally { enVol = false; }
}

// Le moment qui compte : le retour dans l'app (premier plan). On essaie alors,
// puis toutes les 4 s pendant une minute (le temps que le serveur range).
export function ecouterDiscord(enTete) {
  if (typeof window === 'undefined') return () => {};
  let jusqua = 0;
  const essai = () => { if (document.visibilityState === 'visible' && Date.now() < jusqua && lireTicket()) reprendreDiscord(enTete); };
  const reveil = () => { if (document.visibilityState !== 'visible') return; jusqua = Date.now() + 60000; essai(); };
  const id = setInterval(essai, 4000);
  document.addEventListener('visibilitychange', reveil);
  window.addEventListener('focus', reveil);
  window.addEventListener('pageshow', reveil);
  reveil();
  return () => { clearInterval(id); document.removeEventListener('visibilitychange', reveil); window.removeEventListener('focus', reveil); window.removeEventListener('pageshow', reveil); };
}
