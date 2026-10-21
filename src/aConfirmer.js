// ─────────────────────────────────────────────────────────────────────────────
// À CONFIRMER AVANT LA DATE LIMITE (21 octobre, extension 5.204) — une règle
// pure pour Ma journée ET Achats (§11). Aucune lecture ici.
//
// La donnée : `panel_a_confirmer` (ligne dédiée écrite par l'extension, indexée
// par n° de transaction) — le message d'action « Confirmation nécessaire » d'une
// conversation Vinted (« Tout est OK » / « J'ai un problème »), avec sa date
// limite. MESURÉ sur sa base : ce message n'existe que pour un RETOUR qui revient
// au vendeur (`quoi: 'retour'`) ; un achat qui le porterait un jour est pris
// pareil (`quoi: 'achat'`).
// Trois états, jamais deux : `undefined` (lecture en cours) · `null` (la base n'a
// pas répondu : « pas su », JAMAIS « rien à confirmer ») · un objet (lu).
// Une limite dont l'ANNÉE n'a pas pu être lue (`limiteMs: null`) n'est jamais
// présentée comme une date sûre : le texte de Vinted est recopié tel quel.
// ─────────────────────────────────────────────────────────────────────────────

// Sans année lue, on montre l'entrée tant que le message a moins de 3 jours
// (Vinted laisse 2 jours) — au-delà, rien ne dit qu'elle compte encore.
const SANS_ANNEE_MAX_MS = 3 * 86400000;

export function aConfirmerVisibles(data, { uidsOk = null, maintenant = Date.now() } = {}) {
  if (data === undefined) return { etat: 'encours', liste: [] };
  if (data === null || typeof data !== 'object') return { etat: 'passu', liste: [] };
  const liste = [];
  for (const k of Object.keys(data)) {
    const e = data[k];
    if (!e || typeof e !== 'object' || e.resolu) continue;
    if (!/^\d+$/.test(String(e.tx || k))) continue;
    if (uidsOk && e.uid && !uidsOk.has(String(e.uid))) continue;     // compte retiré ou exclu
    const lim = Number(e.limiteMs);
    if (Number.isFinite(lim) && lim > 0) {
      if (lim <= maintenant) continue;                               // délai passé : plus rien à faire ici
    } else {
      const m = Date.parse(e.msgAt || '');
      if (!(m > maintenant - SANS_ANNEE_MAX_MS)) continue;
    }
    liste.push({ ...e, tx: String(e.tx || k), limiteMs: Number.isFinite(lim) && lim > 0 ? lim : null });
  }
  liste.sort((a, b) => (a.limiteMs == null ? Infinity : a.limiteMs) - (b.limiteMs == null ? Infinity : b.limiteMs));
  return { etat: 'lu', liste };
}

// « jeu. 23 oct. 15:59 » (date sûre) ou le texte de Vinted tel quel (« 23 oct.
// 15:59 ») quand l'année n'a pas été lue.
export function texteLimite(e) {
  if (!e) return '';
  if (e.limiteMs != null) {
    const d = new Date(e.limiteMs);
    if (!isNaN(d)) {
      return d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
  }
  return String(e.limiteTexte || '').trim();
}

// Le mot qui nomme ce qu'il y a à confirmer.
export function motAConfirmer(liste) {
  const n = liste.length;
  const retours = liste.filter((e) => e.quoi === 'retour').length;
  const s = n > 1 ? 's' : '';
  if (retours === n) return `retour${s}`;
  if (retours === 0) return `achat${s}`;
  return `colis`;
}
