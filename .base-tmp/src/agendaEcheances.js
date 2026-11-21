// ── « ÉCHÉANCES DANS L'AGENDA » — ce que l'app PUBLIE (10 nov., lot H) ────────
// Le calendrier (.ics, api/_lib/agenda-ics.js) est servi sans l'app : il relit
// ce que l'écran qui a toutes les sources publie (§11). Ici, les dates limites
// d'envoi LUES dans l'e-mail du bordereau (`limiteExpedition`, api/_lib/limite-envoi.js),
// prises dans la liste « à envoyer » de Ma journée (la même que Colis), seulement
// après une lecture COMPLÈTE (`lectureComplete`). Une date ESTIMÉE (vente + 7 j)
// n'est jamais publiée : l'agenda ne dit que ce qui est lu.
// Forme publiée (`vrm_agenda_envoi`, ligne `main`) : { v:1, at, colis:[[N°|'', jour, heure|'', at]] }
// — rien d'autre : ni titre, ni compte, ni transaction.
const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

// `envoyer` : les lignes de Ma journée hors ligne ({ numero, plateforme, jour, heure, limiteAt, estimee }).
export function colisAgenda(envoyer) {
  return (Array.isArray(envoyer) ? envoyer : [])
    .filter((x) => x && x.plateforme === 'vinted' && x.estimee === false && RE_JOUR.test(String(x.jour || '')) && Number(x.limiteAt) > 0)
    .map((x) => [String(x.numero || '').trim().slice(0, 12), String(x.jour), /^\d{2}:\d{2}$/.test(String(x.heure || '')) ? String(x.heure) : '', Number(x.limiteAt)])
    .sort((a, b) => a[3] - b[3] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

// La publication à écrire, ou `null` si rien n'a changé depuis moins de 12 h.
export function publicationAgendaEnvoi(envoyer, avant, maintenant = Date.now()) {
  const colis = colisAgenda(envoyer);
  const memes = avant && Array.isArray(avant.colis) && JSON.stringify(avant.colis) === JSON.stringify(colis);
  if (memes && maintenant - (Number(avant.at) || 0) < 12 * 3600000) return null;
  return { v: 1, colis, at: maintenant };
}

// Le lien d'abonnement pour le calendrier du téléphone.
export const webcal = (url) => String(url || '').replace(/^https?:\/\//i, 'webcal://');
export const googleAgenda = (url) => (url ? `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal(url))}` : '');
