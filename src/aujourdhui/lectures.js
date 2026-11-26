// ── src/aujourdhui/lectures.js — les lectures partagées d'Aujourd'hui et de Statistiques (21 nov., lot journee-stats) ──
// Sorties telles quelles de src/aujourdhui/Branche.jsx pour que Statistiques (src/aujourdhui/StatsBranche.jsx) lise les
// MÊMES sources par le MÊME code : le journal des gestes (`/api/compte?mode=journal`, la source de « Ce que VRM a fait »),
// le journal capté par l'extension (`capte_journal_*`), le relevé des ventes (`vrm_stats_ventes`) et ses annonces (marque,
// taille et date de mise en ligne LUES, `lireExtrasRepartition` de l'app). Une lecture ratée ⇒ null (pas su), jamais [].
import React from 'react';
import { SELECT_JOURNAL_CAPTE } from '../capteNotif/arrivee.js';
import { eclaterReleveLots, modeleSur } from '../ceQuiRapporte.js';

// Le relevé des ventes finalisées, en lignes de Statistiques (la même construction que src/ecrans/Stats.jsx
// `useReleveStats`) : la marque et la taille LUES de l'annonce reliée par SA transaction, la date de mise en ligne lue.
export function lignesReleve(rows, x, enLigne) {
  if (!Array.isArray(rows)) return null;
  return eclaterReleveLots(rows).map((r) => {
    const [plateforme, compte, id, ts, eur, achat, frais, titre] = r;
    const itemLot = typeof r[10] === 'string' && r[10] ? r[10] : null;
    const t = plateforme === 'Vinted' && x && x.txn && id ? x.txn[String(id)] : null;
    const it = itemLot ? (x && x.items ? x.items[itemLot] || null : null) : (t && t.item && x && x.items ? x.items[t.item] : null);
    return { plateforme, compte, id, ts, eur, achat, frais, titre, marqueLue: String((it && it.brand) || '').trim(), modele: modeleSur((it && it.brand) || '', titre),
      taille: String((it && it.size) || '').trim(), enLigne: it && enLigne ? enLigne(it, (x && x.dates) || null) : null,
      // (21 nov., lot rentabilite) l'identifiant de L'ANNONCE vendue (par SA transaction) : le taux de vente ne la compte qu'une fois.
      item: itemLot || (t && t.item ? String(t.item) : null),
      // (24 nov., lot gains-reels) le N° de la fiche ([8] du relevé) : la porte de saisie du prix d'achat de CETTE paire.
      num: String(r[8] || '') };
  });
}

// `o` : les outils de l'app { load, lireTout, entete, extras }. `avecCapte` : lire aussi le journal capté (Aujourd'hui).
// (21 nov., lot rentabilite) LES ANNONCES VINTED LUES (l'index du dressing, `lireExtrasRepartition`) pour le taux de vente :
// { item, enLigne (ms | null : pas datée), marque, taille, titre }. Index pas lu ⇒ null (taux « — »), jamais une liste vide.
export function annoncesLues(x, enLigne) {
  if (!x || !x.items || typeof x.items !== 'object') return null;
  return Object.values(x.items).filter((it) => it && it.id != null).map((it) => ({ item: String(it.id), enLigne: enLigne ? enLigne(it, x.dates || null) : null,
    marque: String(it.brand || '').trim(), taille: String(it.size || '').trim(), titre: String(it.title || '') }));
}

export function useLectures(o, { avecCapte = true } = {}) {
  const [journal, setJournal] = React.useState(undefined), [capte, setCapte] = React.useState(undefined), [extras, setExtras] = React.useState(undefined);
  const lireReleve = () => { try { const x = o ? o.load('vrm_stats_ventes', null) : null; return x && Array.isArray(x.l) ? x.l : null; } catch (_) { return null; } };
  // (24 nov., lot gains-reels) les commandes eBay dans une autre devise, publiées avec le relevé (jamais converties) : null = pas su.
  const lireHorsEuro = () => { try { const x = o ? o.load('vrm_stats_ventes', null) : null; return x && Number.isSafeInteger(x.ebayHorsEuro) ? x.ebayHorsEuro : null; } catch (_) { return null; } };
  const [releve, setReleve] = React.useState(lireReleve);
  const [horsEuro, setHorsEuro] = React.useState(lireHorsEuro);
  React.useEffect(() => {
    if (!o) return undefined;
    let vivant = true;
    (async () => {
      try { const r = await fetch('/api/compte?mode=journal', { headers: o.entete() }); const j = r.ok ? await r.json().catch(() => null) : null; if (vivant) setJournal(j && Array.isArray(j.evenements) ? j.evenements : null); } catch (_) { if (vivant) setJournal(null); }
      if (avecCapte) { try { const rows = await o.lireTout(SELECT_JOURNAL_CAPTE); if (vivant) setCapte(Array.isArray(rows) ? rows : null); } catch (_) { if (vivant) setCapte(null); } }
      try { const x = o.extras ? await o.extras() : null; if (vivant) setExtras(x || null); } catch (_) { if (vivant) setExtras(null); }
    })();
    const f = (e) => { if (e && e.detail && e.detail.k === 'vrm_stats_ventes') { setReleve(lireReleve()); setHorsEuro(lireHorsEuro()); } };
    window.addEventListener('vrm:save', f);
    return () => { vivant = false; window.removeEventListener('vrm:save', f); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o]);
  return { journal, capte, extras, releve, horsEuro };
}
