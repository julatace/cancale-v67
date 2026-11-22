// La clé « Quoi de neuf » vues (une clé de SYNC_KEYS : la même sur tous ses appareils). À part de src/nouveautes.js
// (20 nov., iphone-rapide) : la coque la lit au démarrage ; la liste des nouveautés, elle, se charge à la demande.
export const CLE_NOUVEAUTES_VUES = 'vrm_nouveautes_vues';
// (21 nov., ux-reglages) La feuille « Nouveau » montrée UNE fois après une mise en ligne : { ids: [id…], at } — les
// nouveautés qu'elle a déjà montrées (SYNC_KEYS : vue sur l'ordinateur, elle ne revient pas sur l'iPhone).
export const CLE_NOUVEAU_FEUILLE = 'vrm_nouveau_feuille';
