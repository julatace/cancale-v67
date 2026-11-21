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
  poserCode({ attend: false, erreur: '', fin: '' });
}
function lireTicket() {
  try {
    const o = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (!o || !/^[0-9a-f]{32}$/.test(String(o.t || ''))) return null;
    if (!(Date.now() - Number(o.at) <= VALIDITE_MS)) { localStorage.removeItem(CLE); return null; }
    return o;
  } catch (_) { return null; }
}
export function oublierTicketDiscord() { try { localStorage.removeItem(CLE); } catch (_) {} poserCode({ attend: false, erreur: '', fin: '' }); }

// ⚠️ 21 oct. (revue de sécurité) : la preuve rangée ne sort qu'avec le CODE à
// 6 chiffres montré dans l'autre navigateur (sinon quelqu'un qui envoyait SON
// lien à une autre personne prenait le pseudo Discord de celle-ci). L'app le
// demande (`DemandeCodeDiscord`, App.jsx) ; cet état dit quand et pourquoi.
let etatCode = { attend: false, erreur: '', fin: '' };
const abonnesCode = new Set();
function poserCode(e) { etatCode = { ...etatCode, ...e }; abonnesCode.forEach((fn) => { try { fn(etatCode); } catch (_) {} }); }
export function etatCodeDiscord() { return etatCode; }
export function suivreCodeDiscord(fn) { abonnesCode.add(fn); return () => abonnesCode.delete(fn); }

let enVol = false;
// Rend true si une preuve a été reprise (l'app est alors rechargée sur le bon écran,
// par le même chemin que le retour direct : main.jsx met le fragment de côté).
export async function reprendreDiscord(enTete, code) {
  const o = lireTicket();
  if (!o || enVol) return false;
  enVol = true;
  try {
    const corps = code ? { ticket: o.t, code: String(code) } : { ticket: o.t };
    const r = await fetch('/api/compte?mode=discord-attente', { method: 'POST', headers: { ...enTete(), 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) { if (code) poserCode({ erreur: 'VRM n’a pas pu vérifier le code (le serveur ne répond pas). Réessaie dans un instant.' }); return false; }
    if (j.pret !== true && j.code === 'requis') { poserCode({ attend: true, erreur: '' }); return false; }
    if (j.pret !== true && j.code === 'faux') { poserCode({ attend: true, erreur: 'Ce n’est pas le bon code' + (j.restants ? ` — encore ${j.restants} essai${j.restants > 1 ? 's' : ''}.` : '.') }); return false; }
    if (j.pret !== true && j.code === 'epuise') { try { localStorage.removeItem(CLE); } catch (_) {} poserCode({ attend: false, erreur: '', fin: 'Trop d’essais : relance « Se connecter avec Discord » depuis VRM.' }); return false; }
    if (j.pret !== true || !j.discord || !j.preuve) return false;
    // Pas oublierTicketDiscord() ici : fermer la feuille du code fait un
    // « retour » d'historique (FermeAuRetour) qui annulerait la navigation.
    try { localStorage.removeItem(CLE); } catch (_) {}
    const frag = 'discord=' + encodeURIComponent(j.discord) + '&preuve=' + encodeURIComponent(j.preuve);
    const cible = j.ou === 'compte' ? '/?tab=settings&vue=compte#' + frag + '&ou=compte' : '/?tab=communaute#' + frag;
    // Déjà sur cet écran : changer le seul fragment ne recharge pas, et main.jsx
    // ne lit le fragment qu'au chargement — la preuve était perdue en silence.
    const meme = (window.location.pathname + window.location.search) === cible.split('#')[0];
    window.location.assign(cible);
    if (meme) window.location.reload();
    return true;
  } catch (_) { return false; } finally { enVol = false; }
}

// Le moment qui compte : le retour dans l'app (premier plan). On essaie alors,
// puis toutes les 4 s pendant une minute (le temps que le serveur range).
export function ecouterDiscord(enTete) {
  if (typeof window === 'undefined') return () => {};
  let jusqua = 0;
  // Code déjà demandé : on attend la saisie, plus besoin de redemander.
  const essai = () => { if (document.visibilityState === 'visible' && Date.now() < jusqua && !etatCode.attend && lireTicket()) reprendreDiscord(enTete); };
  const reveil = () => { if (document.visibilityState !== 'visible') return; jusqua = Date.now() + 60000; essai(); };
  const id = setInterval(essai, 4000);
  document.addEventListener('visibilitychange', reveil);
  window.addEventListener('focus', reveil);
  window.addEventListener('pageshow', reveil);
  reveil();
  return () => { clearInterval(id); document.removeEventListener('visibilitychange', reveil); window.removeEventListener('focus', reveil); window.removeEventListener('pageshow', reveil); };
}
