// Le contexte de requête (serveur seulement) ; la table vit dans
// `ebay-marches-table.js`, importable par le navigateur.
import { AsyncLocalStorage } from 'node:async_hooks';
import { MARCHE_DEFAUT } from './ebay-marches-table.js';
export * from './ebay-marches-table.js';

const contexte = new AsyncLocalStorage();
export const avecMarche = (m, fn) => contexte.run(m || MARCHE_DEFAUT, fn);
export const marcheCourant = () => contexte.getStore() || MARCHE_DEFAUT;
