// ── src/galeriePops.js — la liste de « Voir tous les pop-ups » (23 nov., Julien, compte propriétaire seulement) ─────────────
// La source est LE registre des notifications (api/_lib/notif-apercus.js, `APERCUS_NOTIF`) : chaque exemple y sort de la
// fonction qui fabrique la VRAIE notification, avec des données d'exemple inventées (jamais une vente réelle). Une famille ou
// un exemple ajouté là apparaît ici sans rien toucher. Rien n'est écrit, rien n'est envoyé : la galerie passe chaque exemple
// à la carte d'événement de l'app (`vrm:evenement`, src/natif/PopEvenements.jsx), comme le ferait le service worker.
// Pur : aucune lecture, aucune écriture.
import { APERCUS_NOTIF } from '../api/_lib/notif-apercus.js';
import { embellir, GESTE_FAMILLE } from '../api/_lib/notif-belle.js';

// La famille du registre → le genre de la carte (son icône), les noms de api/_lib/notif-belle.js.
const GENRE_FAMILLE = { ventes: 'vente', poster: 'bordereau', arrives: 'arrivee', offres: 'offre', messages: 'message', rappels: 'rappel' };

export function exemplesPops(registre = APERCUS_NOTIF) {
  const out = [];
  for (const [famille, f] of Object.entries(registre || {})) {
    let ex = [];
    try { ex = Array.isArray(f && f.exemples) ? f.exemples : []; } catch (_) { ex = []; }
    ex.forEach((e, k) => {
      if (!e || !e.title) return;
      const b = embellir({ title: e.title, body: e.body || '' });
      out.push({ cle: `${famille}-${k}`, famille, mene: e.mene || '',
        ev: { galerie: true, title: b.title, body: b.body, tag: `galerie-${famille}-${k}`, genre: GENRE_FAMILLE[famille] || '', famille,
          actions: GESTE_FAMILLE[famille] ? [{ title: GESTE_FAMILLE[famille], url: '' }] : [] } });
    });
  }
  return out;
}
