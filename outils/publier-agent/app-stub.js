// Le banc scripts/bancs/publier-agent.cjs remplace src/App.jsx par CE module : les lectures servent une base INVENTÉE
// (à la forme de la vraie : fiches de page projetées par clé, `lbc_listings.items`, `ebay_listings` par compte),
// l'extension est un faux qui note chaque commande et combien sont en vol. Aucune donnée réelle.
const NOW = Date.parse('2026-11-19T12:00:00Z');
export const SUPABASE_URL = 'https://banc.invalid';
export const SEL_EBAY_ANNONCES = 'items:data->items,capturedAt:data->>capturedAt';
const B = (window.__banc = window.__banc || { cmds: [], enVol: 0, maxEnVol: 0, store: {}, ext: 'ok' });
export const __vmrJobs = {};
export const __vmrNotifier = () => {};
export const load = (k, d) => (B.store[k] !== undefined ? JSON.parse(JSON.stringify(B.store[k])) : d);
export const save = (k, v) => { B.store[k] = JSON.parse(JSON.stringify(v)); };
export const isCloudReady = () => true;
export const relaisVivant = () => false;
export const extSait = () => B.ext;
export async function lireFichesPage(ids) { const out = {}; for (const id of ids) if (B.fiches && B.fiches[id]) out[id] = B.fiches[id]; return out; }
export async function lireBaseRelue(url) { if (/lbc_listings/.test(url)) return [{ items: B.lbc || {} }]; return []; }
export async function lireEbayTous() { return { items: B.ebay || [], lignes: [] }; }
export async function appelEbay() { await new Promise((r) => setTimeout(r, 60)); return { j: { ok: true, categories: [{ id: '15709', nom: 'Baskets', chemin: 'Mode > Homme > Chaussures > Baskets' }, { id: '95672', nom: 'Chaussures de sport', chemin: 'Sport > Chaussures' }] } }; }
export async function vmrCmd(msg) {
  B.cmds.push(JSON.parse(JSON.stringify(msg))); B.enVol++; B.maxEnVol = Math.max(B.maxEnVol, B.enVol);
  await new Promise((r) => setTimeout(r, 80));
  const jobId = (msg.site === 'leboncoin' ? 'lbc:' : 'vc:') + 'fiche-' + msg.fiche.numero;
  // Le dépôt « se finit » un peu plus tard, comme dans le navigateur.
  setTimeout(() => { __vmrJobs[jobId] = { etape: 'fait', at: NOW }; B.enVol--; }, 400);
  return { accepte: true, jobId, etape: 'depot' };
}
export const __NOW = NOW;
