// ── src/ebay/publierPlanchers.js — LA PUBLICATION DES PLANCHERS eBAY (28 nov., lot ebay-automatismes) ──
// Le plancher de chaque N° pour les automatismes eBay, PUBLIÉ (`vrm_planchers_ebay`) pour le serveur quand un
// automatisme eBay est allumé (`vrm_ebay_auto_actif`) ; republié seulement s'il a changé, ou après 12 h (le serveur
// n'agit plus sur une publication de plus de 72 h). Aucune fiche lue ⇒ rien (« rien lu » ne vaut pas « rien » : une
// publication vide ne remplace jamais la précédente). Une copie DÉRIVÉE à part : ne change ni un N°, ni un prix mini,
// ni le plancher sous une offre (src/plancherOffre.js, audit-plancher-stock E7) — sorti d'App.jsx le 28 nov. (main-vert).
// (28 nov., main-vert) La règle (./automatismes.js, ~10 Ko) n'est chargée QUE si un automatisme est allumé : le démarrage
// ne l'emporte plus (budget-vitesse). Rien n'est publié tant qu'elle n'est pas arrivée.

export async function publierPlanchersEbay({ load, save, userId, maintenant = Date.now() }) {
  try {
    if (load('vrm_ebay_auto_actif', false) !== true || !userId) return false;
    const fiches = load('vinted_annonce_numeros', null);
    if (!fiches || typeof fiches !== 'object' || !Object.keys(fiches).length) return false;
    const { planchersAPublier, memesPlanchers, PLANCHERS_CLE } = await import('./automatismes.js');
    const neuf = planchersAPublier(fiches, load('vinted_buyprice_by_num', {}) || {}, load('vinted_nums_physiques', null));
    const avant = load(PLANCHERS_CLE, null);
    if (avant && memesPlanchers(avant, neuf) && maintenant - Number(avant.at || 0) < 12 * 3600000) return false;
    save(PLANCHERS_CLE, neuf);
    return true;
  } catch (_) { return false; /* une publication ratée : le serveur dit « plancher pas relu », rien ne bouge */ }
}
