// ═══════════════════════════════════════════════════════════════════════════
// L'HISTORIQUE LEBONCOIN, VESTIAIRE ET eBAY (11 nov., lot import-historique-sites)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « récupérer TOUT l'historique de ventes et d'achats sur Leboncoin,
// eBay et Vestiaire, comme pour Vinted ». Chaque lecture publie sa progression
// dans SA ligne (jamais `main`) :
//   · `import_leboncoin_{compte}` et `import_vestiaire_{compte}` — l'extension
//     5.365 (`importerSite`) : `{ etat, types: { transactions, details } |
//     { ventes, achats }, attend: 'modele'|null, repriseA, cause, resteMin, fin, at }` ;
//   · `import_ebay{suffixe}` — la route (`api/_lib/ebay-historique.js`) :
//     `{ etat, ventes, achats: { limiteJours: 60 }, raisonFin, borne, cause, fin, at }`.
// Ce fichier est la seule lecture de ces lignes côté app (projetée, jamais
// `select=data`). « Pas su » (`null`) ne vaut jamais « fini ».
// ═══════════════════════════════════════════════════════════════════════════

export const SELECT_IMPORT_SITES = 'id,e:data->>etat,t:data->types,ve:data->ventes,ac:data->achats,att:data->>attend,r:data->>repriseA,c:data->>cause,m:data->>resteMin,f:data->>fin,a:data->>at,cap:data->>capturedAt,rf:data->>raisonFin,b:data->>borne';
export const REQUETE_IMPORT_SITES = `or=(id.like.import_leboncoin_*,id.like.import_vestiaire_*,id.like.import_ebay*)&select=${SELECT_IMPORT_SITES}`;
// Ce que le vendeur a sur chaque site (pour ne parler que des siens).
export const REQUETE_SITES_PRESENTS = 'or=(id.eq.lbc_accounts,id.eq.vc_ventes,id.eq.vc_achats,id.like.ebay_orders*)&select=id';
export const IMPORT_SITE_SILENCE_MS = 20 * 60000;
export const SITES_IMPORT = ['leboncoin', 'vestiaire', 'ebay'];

const nombre = (v) => { if (v === null || v === undefined || String(v).trim() === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
function typeLu(t) {
  if (!t || typeof t !== 'object') return null;
  const total = nombre(t.total);
  return { lus: Math.max(0, nombre(t.lus) || 0), total: total !== null && total >= 0 ? total : null, pages: Math.max(0, nombre(t.pages) || 0), fini: t.fini === true,
    sansModele: t.sansModele === true, limiteJours: nombre(t.limiteJours) };
}
// Une ligne projetée → l'état lisible, ou null (forme inconnue).
export function lireLigneImportSite(row, maintenant = Date.now()) {
  if (!row || typeof row !== 'object') return null;
  const id = String(row.id || '');
  let m = /^import_(leboncoin|vestiaire)_([\w-]{1,64})$/.exec(id);
  let site, compte;
  if (m) { site = m[1]; compte = m[2]; }
  else { m = /^import_ebay(?:_([0-9a-f]{16}))?$/.exec(id); if (!m) return null; site = 'ebay'; compte = m[1] || 'principal'; }
  const etatBrut = String(row.e || '');
  if (!['attente', 'encours', 'pause', 'fini'].includes(etatBrut)) return null;
  let types;
  if (site === 'leboncoin') { const t = row.t || {}; types = [['transactions', typeLu(t.transactions)], ['details', typeLu(t.details)]]; }
  else if (site === 'vestiaire') { const t = row.t || {}; types = [['ventes', typeLu(t.ventes)], ['achats', typeLu(t.achats)]]; }
  else types = [['ventes', typeLu(row.ve)], ['achats', typeLu(row.ac)]];
  if (types.some(([, t]) => !t)) return null;
  const at = nombre(row.a) || Date.parse(row.cap || '') || null;
  const repriseA = nombre(row.r);
  let etat = etatBrut;
  if (etat === 'pause' && repriseA && repriseA < maintenant) etat = 'encours';
  // L'extension se tait depuis 20 min alors que ce n'est pas fini : l'onglet est fermé.
  if (site !== 'ebay' && etat !== 'fini' && etat !== 'pause' && at && maintenant - at > IMPORT_SITE_SILENCE_MS) etat = 'arrete';
  return { site, compte, etat, types: Object.fromEntries(types), attend: row.att === 'modele' ? 'modele' : null, repriseA: etat === 'pause' ? repriseA : null,
    cause: row.c || null, resteMin: nombre(row.m), fin: nombre(row.f), at, raisonFin: row.rf || null, borne: row.b || null };
}
// Toutes les lignes de l'historique des autres sites. `null` = pas su.
export async function lireImportSites(lireTout) {
  let rows;
  try { rows = await lireTout(REQUETE_IMPORT_SITES); } catch (_) { rows = null; }
  if (!Array.isArray(rows)) return null;
  return rows.map((r) => lireLigneImportSite(r)).filter(Boolean);
}
// Les sites où le vendeur a quelque chose. `null` = pas su.
export async function lireSitesPresents(lireTout) {
  let rows;
  try { rows = await lireTout(REQUETE_SITES_PRESENTS); } catch (_) { rows = null; }
  if (!Array.isArray(rows)) return null;
  const ids = rows.map((r) => String((r && r.id) || ''));
  return {
    leboncoin: ids.includes('lbc_accounts'),
    vestiaire: ids.includes('vc_ventes') || ids.includes('vc_achats'),
    ebay: ids.filter((i) => /^ebay_orders(?:_[0-9a-f]{16})?$/.test(i)).map((i) => (i === 'ebay_orders' ? 'principal' : i.slice('ebay_orders_'.length))),
  };
}
// L'état simple d'une ligne : { etat, n, N } (même forme que `etatSimpleImport` de Vinted).
export function etatSimpleImportSite(l) {
  if (!l) return { etat: null, n: 0, N: null };
  const ts = Object.entries(l.types).filter(([nom, t]) => !(l.site === 'ebay' && nom === 'achats') && !(l.site === 'leboncoin' && nom === 'details') && t);
  const n = ts.reduce((s, [, t]) => s + t.lus, 0);
  const N = ts.every(([, t]) => t.total !== null) ? ts.reduce((s, [, t]) => s + t.total, 0) : null;
  return { etat: l.etat, n: N !== null ? Math.min(n, N) : n, N };
}
export function pctTypeSite(t) {
  if (!t || t.total === null || !(t.total > 0)) return t && t.fini ? 100 : null;
  return Math.max(0, Math.min(100, Math.round(t.lus / t.total * 100)));
}
// La durée qui reste, en jours au-delà de 24 h (« environ 3 jours »).
export function dureeSite(min, tr) {
  const m = Number(min);
  if (!Number.isFinite(m) || m <= 0) return '';
  if (m >= 24 * 60) return tr('historiqueSites.duree.jours', { n: Math.ceil(m / 1440) });
  if (m >= 60) return tr('historiqueSites.duree.heures', { n: Math.ceil(m / 60) });
  return tr('historiqueSites.duree.minutes', { n: Math.max(5, Math.round(m)) });
}
// La partie droite d'un type : « 120 sur 400 », « 3 pages lues · encore… », « 400 ✓ ».
export function texteTypeSite(t, tr, nf = (x) => String(x)) {
  if (!t) return '—';
  if (t.limiteJours) return tr('historiqueSites.achats.ebay', { n: t.limiteJours });
  if (t.sansModele) return tr('historiqueSites.type.sansModele');
  if (t.fini) return `${nf(t.lus)} ✓`;
  if (t.total !== null && t.total > 0) return tr('historiqueSites.type.surTotal', { lus: nf(Math.min(t.lus, t.total)), total: nf(t.total) });
  if (t.lus > 0) return tr('historiqueSites.type.lues', { n: t.lus });
  return tr('historiqueSites.type.bientot');
}
// La phrase de tête d'une ligne.
export function phraseImportSite(l, tr, heure = (ms) => String(ms)) {
  if (!l) return '';
  if (l.etat === 'fini') return l.site === 'ebay' && l.raisonFin === 'ebay' ? tr('historiqueSites.phrase.finiEbay') : tr('historiqueSites.phrase.fini');
  if (l.etat === 'pause') return tr(l.cause === 'rythme' || l.cause === 'budget' ? 'historiqueSites.phrase.pauseRythme' : 'historiqueSites.phrase.pauseSite', { h: heure(l.repriseA) });
  if (l.site === 'ebay' && l.cause) return tr(l.cause === 'base' ? 'historiqueSites.phrase.ebayBase' : 'historiqueSites.phrase.ebayRefus');
  if (l.attend === 'modele') return tr(l.site === 'leboncoin' ? 'historiqueSites.phrase.modeleLbc' : 'historiqueSites.phrase.modeleVc');
  if (l.etat === 'arrete') return tr(l.site === 'leboncoin' ? 'historiqueSites.phrase.arreteLbc' : 'historiqueSites.phrase.arreteVc');
  const d = dureeSite(l.resteMin, tr);
  if (l.site === 'ebay') return tr('historiqueSites.phrase.encoursEbay');
  return d ? tr(l.site === 'leboncoin' ? 'historiqueSites.phrase.encoursLbc' : 'historiqueSites.phrase.encoursVc', { d }) : tr('historiqueSites.phrase.encours');
}
