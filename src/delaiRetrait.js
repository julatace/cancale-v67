// ════════════════════════════════════════════════════════════════════════════
//  LA BARRE DU DÉLAI POUR RETIRER UN COLIS (8 nov.)
//  Julien : « mets une barre d'évolution avec le délai pour retirer ».
//  Règle pure (aucune lecture) : le temps ÉCOULÉ entre l'arrivée au point (date
//  LUE : e-mail, transporteur, conversation Vinted) et la date limite (LUE ; à
//  défaut, la garde du transporteur — dite « estimée »).
//   · Pas de date d'arrivée, ou pas de limite ⇒ null : pas de barre (« pas su »
//     ne vaut pas 0 %, §5).
//   · La limite est la FIN de son jour (heure de l'appareil), ou l'heure que le
//     transporteur donne (`limiteAt`, Vinted Go) quand elle tombe ce jour-là.
//   · Texte : « encore N j » · « dernier jour » · « délai dépassé ».
//   · AMBRE (un geste à faire, §7) dans les dernières 24 h et au-delà ; jamais rouge.
//  Les codes (`code`) sont ceux de la puce d'échéance de la ligne : depasse ·
//  dernier · demain · date.
// ════════════════════════════════════════════════════════════════════════════
const H24 = 24 * 3600e3;
const jourValide = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10)) ? String(s).slice(0, 10) : '';
const msIso = (v) => { if (v == null || v === '') return null; const t = typeof v === 'number' ? v : Date.parse(String(v)); return Number.isFinite(t) ? t : null; };
const jourLocal = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const finDuJour = (jour) => { const t = new Date(`${jour}T23:59:59.999`).getTime(); return Number.isFinite(t) ? t : null; };
const ecartJours = (a, b) => Math.round((new Date(`${a}T12:00:00`).getTime() - new Date(`${b}T12:00:00`).getTime()) / 864e5);

// { arriveeMs, limite: 'AAAA-MM-JJ', limiteAt?: ISO, estimee?: bool } → barre ou null.
export function delaiRetrait({ arriveeMs = null, limite = null, limiteAt = null, estimee = false } = {}, maintenant = Date.now()) {
  const arr = msIso(arriveeMs);
  if (arr == null || arr <= 0) return null;
  const at = msIso(limiteAt);
  let jour = jourValide(limite);
  if (!jour && at != null) jour = jourLocal(at);
  if (!jour) return null;
  const fin = at != null && jourLocal(at) === jour ? at : finDuJour(jour);
  if (fin == null || fin <= arr) return null;   // une limite avant l'arrivée : incohérent, rien n'est dessiné
  const total = fin - arr;
  const ecoule = Math.min(Math.max(maintenant - arr, 0), total);
  const pct = Math.round((ecoule / total) * 100);
  const restantMs = fin - maintenant;
  const jours = ecartJours(jour, jourLocal(maintenant));
  const depasse = restantMs < 0;
  const code = depasse ? 'depasse' : jours <= 0 ? 'dernier' : jours === 1 ? 'demain' : 'date';
  const texte = depasse ? 'délai dépassé' : jours <= 0 ? 'dernier jour' : `encore ${jours} j`;
  const dateTxt = new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const totalJ = Math.max(1, ecartJours(jour, jourLocal(arr)) + 1);
  const valeur = depasse ? `Délai dépassé (limite le ${dateTxt})` : jours <= 0 ? `Dernier jour pour retirer (limite le ${dateTxt})` : `Encore ${jours} jour${jours > 1 ? 's' : ''} pour retirer, sur ${totalJ} (limite le ${dateTxt})`;
  return {
    pct, restantMs, jours, code, texte, estimee: !!estimee, jour, finMs: fin, arriveeMs: arr,
    ambre: restantMs <= H24,
    valeurTexte: valeur + (estimee ? ', date estimée' : ''),
    cle: `${jourLocal(arr)}|${fin}|${estimee ? 1 : 0}`,
  };
}
