// ══════════════════════════════════════════════════════════════════════════
// LE STOCK POUR UN AIDANT (16 nov., lot partage-aidant) — ce que le navigateur du vendeur
// PUBLIE pour le lien lecture seule (api/_lib/aidant-lien.js `vueAidant` le refiltre côté
// serveur : liste blanche). Pur : `scripts/audit-partage-aidant.cjs` l'exécute.
//
// Une ligne par N° RANGÉ (le plan de rangement et le garage, `stockPourRecherche`
// d'App.jsx) : son N°, son lieu, et — par IDENTITÉ de N° (`cle` = `cleNum`) — le titre et
// la photo de SA fiche. Deux fiches au même N° (deux paires sous un N°, §5) : ni titre ni
// photo (mieux vaut un blanc qu'un faux). Jamais un prix, un compte, un pseudo.
// ══════════════════════════════════════════════════════════════════════════
const str = (v) => String(v == null ? '' : v).trim();
const cleDefaut = (n) => { const s = str(n).toUpperCase().replace(/[\s\-_.]/g, ''); return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s; };
const urlPhoto = (p) => (typeof p === 'string' ? p : p && typeof p === 'object' ? str(p.url || p.full_size_url || (Array.isArray(p.thumbnails) && p.thumbnails[0] && p.thumbnails[0].url)) : '');

// stock : [{ numero, lieu }] ; fiches : { [idAnnonce]: { numero, title, photo } } ; rend { items }.
export function vueDuStock(stock, fiches, cle = cleDefaut) {
  const parNum = new Map();
  for (const f of Object.values(fiches && typeof fiches === 'object' ? fiches : {})) {
    if (!f || !str(f.numero)) continue;
    const k = cle(f.numero);
    const l = parNum.get(k) || []; l.push(f); parNum.set(k, l);
  }
  const items = [], vus = new Set();
  for (const r of Array.isArray(stock) ? stock : []) {
    const num = str(r && r.numero), lieu = str(r && r.lieu);
    if (!num) continue;
    const k = cle(num);
    const id = `${k}|${lieu}`;
    if (vus.has(id)) continue; vus.add(id);
    const fs = parNum.get(k) || [];
    const f = fs.length === 1 ? fs[0] : null;
    items.push({ num, lieu, titre: f ? str(f.title) : '', photo: f ? urlPhoto(f.photo) : '' });
  }
  items.sort((a, b) => a.num.localeCompare(b.num, 'fr', { numeric: true }));
  return { items };
}
