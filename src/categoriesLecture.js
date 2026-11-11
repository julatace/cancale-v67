// ═══════════════════════════════════════════════════════════════════════════
// LA CATÉGORIE D'UNE VENTE — LES LECTURES (sorties de Statistiques le 11 nov.,
// lot rapport-mois, telles quelles) : « Par catégorie » et le Rapport du mois
// les partagent. La RÈGLE reste src/statsCategories.js (`familleDeVente`).
// La catégorie vient de Vinted (catalog_id de l'annonce, reliée par SA
// transaction) ou de SON choix ; jamais du titre. Le catalogue de Vinted
// (~550 Ko) n'est lu que si sa VERSION (`data->>at`, un scalaire) a changé :
// la table { catalog_id: famille } est gardée sur l'appareil (`vrm_cat_familles`,
// quelques Ko). Catalogue illisible et aucune table gardée ⇒ les catégories
// Vinted sont « pas sues » (rien de deviné).
// ═══════════════════════════════════════════════════════════════════════════
import { SUPABASE_URL, sbAuth } from './App.jsx';
import { tableFamilles, familleDeVente, cleVente } from './statsCategories.js';

const CLE_TABLE_FAMILLES = 'vrm_cat_familles';
let _tableFamillesEnVol = null;
export const lireTableFamilles = () => {
  if (_tableFamillesEnVol) return _tableFamillesEnVol;
  _tableFamillesEnVol = (async () => {
    let garde = null;
    try { const g = JSON.parse(localStorage.getItem(CLE_TABLE_FAMILLES) || 'null'); if (g && g.table && typeof g.table === 'object') garde = g; } catch (_) {}
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vinted_catalogue&select=at:data->>at`, { headers: sbAuth() });
      const j = r.ok ? await r.json() : null;
      if (!Array.isArray(j)) return garde ? garde.table : null;
      const at = j[0] && j[0].at ? String(j[0].at) : '';
      if (!at) return garde ? garde.table : {};   // aucun catalogue rangé : aucune catégorie Vinted traduisible
      if (garde && garde.at === at) return garde.table;
      const r2 = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vinted_catalogue&select=c:data->>corps`, { headers: sbAuth() });
      const j2 = r2.ok ? await r2.json() : null;
      const c = Array.isArray(j2) && j2[0] && j2[0].c;
      const table = c ? tableFamilles(JSON.parse(c)) : null;
      if (!table) return garde ? garde.table : null;
      try { localStorage.setItem(CLE_TABLE_FAMILLES, JSON.stringify({ at, table })); } catch (_) {}
      return table;
    } catch (_) { return garde ? garde.table : null; }
    finally { setTimeout(() => { _tableFamillesEnVol = null; }, 60000); }
  })();
  return _tableFamillesEnVol;
};
// La catégorie lue sur la PAGE de l'annonce (`vinted_item_details[id].catalogId`),
// pour les annonces dont le dressing ne la porte pas (mesuré le 5 nov. : un
// dressing non allégé envoie `catalog_id: null`). Projetée clé par clé, un
// scalaire par annonce (§4.4) ; un lot raté ⇒ null (« pas su »).
export const lireCategoriesFiches = async (ids) => {
  const uniq = [...new Set((ids || []).map((x) => String(x == null ? '' : x)).filter((x) => /^\d+$/.test(x)))];
  if (!uniq.length) return {};
  const lots = []; for (let i = 0; i < uniq.length; i += 80) lots.push(uniq.slice(i, i + 80));
  try {
    const res = await Promise.all(lots.map(async (l) => {
      const sel = l.map((id, i) => `f${i}:data->${encodeURIComponent('"' + id + '"')}->>catalogId`).join(',');
      const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.vinted_item_details&select=${sel}`, { headers: sbAuth() });
      if (!r.ok) return null; const j = await r.json(); return Array.isArray(j) ? j : null;
    }));
    if (res.some((x) => !x)) return null;
    const out = {};
    res.forEach((rows, k) => { const ligne = rows[0]; if (!ligne) return; lots[k].forEach((id, i) => { const v = ligne['f' + i]; if (v != null && String(v).trim() && String(v) !== '0') out[id] = String(v); }); });
    return out;
  } catch (_) { return null; }
};
// La famille d'une vente (plateforme, identifiant) : la catégorie LUE de son
// annonce Vinted (dressing, sinon la page de l'annonce), sinon SON choix.
export const fabriqueFamDe = ({ extras, fiches, table, main }) => (plat, id) => {
  let cat = null;
  if (plat === 'Vinted') {
    const t = extras && extras.txn ? extras.txn[String(id)] : null; const it = t && t.item ? String(t.item) : '';
    const x = it && extras && extras.items ? extras.items[it] : null;
    cat = (x && x.cat) || (it && fiches ? fiches[it] : null) || null;
  }
  return familleDeVente({ catalogId: cat, table, main, cle: cleVente(plat, id) });
};
