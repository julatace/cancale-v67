// ── L'ÉCRAN D'ATELIER (14 nov., lot 118) ────────────────────────────────────────
// Julien : « un plein écran qui reste allumé sur un ordinateur ou une tablette, avec
// les colis du jour et le chiffre du jour, mis à jour tout seul. »
// Règle PURE (aucun React, aucun import) : `EcranAtelier` (src/EcranAtelier.jsx) la
// relit toutes les 60 s et à chaque publication. AUCUNE lecture de plus, aucun geste :
//   · les colis : la photo de Ma journée (`vrm_hl_photo_{uid}`, src/journeeHorsLigne.js),
//     écrite par l'app après une lecture COMPLÈTE seulement — jamais un total partiel ;
//   · le chiffre du jour : `vrm_benefice_jours` (publiée par Ventes, la règle du
//     bénéfice) — le nombre de ventes et le vendu du JOUR (heure de l'appareil, la
//     même clé `AAAA-MM-JJ` que la publication).
// « Pas su » ≠ « rien » : sans photo ⇒ `null` (« — » à l'écran, avec la raison) ;
// une photo de plus de 12 h ⇒ montrée, mais DITE ancienne. Publication du bénéfice
// absente ou d'un autre jour ⇒ « — » ; publiée aujourd'hui sans ligne du jour ⇒ 0.
export const ATELIER_VIEUX_H = 12;
export const ATELIER_RELECTURE_MS = 60000;
const jourCle = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const s = (v, n = 90) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

export function vueAtelier({ photo = null, benefice = null, maintenant = Date.now() } = {}) {
  const auj = jourCle(maintenant);
  let envoyer = null, retirer = null, vieux = false, photoAt = null;
  if (photo && Array.isArray(photo.envoyer) && Array.isArray(photo.retirer) && Number.isFinite(photo.at)) {
    photoAt = photo.at;
    vieux = !(maintenant - photo.at < ATELIER_VIEUX_H * 3600000);
    const lignesE = photo.envoyer.map((e) => {
      const limite = s(e.jour || e.limite, 10);
      const retard = Number.isFinite(e.limiteAt) ? e.limiteAt < maintenant : (!e.estimee && !!limite && limite < auj);
      return { numero: s(e.numero, 12), titre: s(e.titre), limite, heure: s(e.heure, 5), retard, aujourdhui: limite === auj, estimee: !!e.estimee, transporteur: s(e.trNom, 30) };
    }).sort((a, b) => (Number(b.retard) - Number(a.retard)) || String(a.limite || '9999').localeCompare(String(b.limite || '9999')));
    envoyer = { n: Number.isFinite(photo.nEnvoyer) ? photo.nEnvoyer : lignesE.length, retard: lignesE.filter((l) => l.retard).length, lignes: lignesE };
    const lignesR = photo.retirer.map((r) => ({ titre: s(r.titre), lieu: s(r.lieu, 120), code: s(r.code, 16), transporteur: s(r.transporteur, 30), limite: s(r.limite, 10), dernierJour: s(r.limite, 10) === auj }))
      .sort((a, b) => String(a.limite || '9999').localeCompare(String(b.limite || '9999')));
    retirer = { n: Number.isFinite(photo.nRetirer) ? photo.nRetirer : lignesR.length, lignes: lignesR };
  }
  let jour = null;
  if (benefice && benefice.jours && typeof benefice.jours === 'object' && Number.isFinite(Number(benefice.at)) && jourCle(Number(benefice.at)) === auj) {
    const t = benefice.jours[auj];
    const n = Array.isArray(t) ? Number(t[0]) || 0 : 0;
    const ca = Array.isArray(t) ? (Number(t[1]) || 0) / 100 : 0;
    jour = { n, ca };
  }
  return { envoyer, retirer, jour, vieux, photoAt };
}
