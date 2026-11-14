// ══════════════════════════════════════════════════════════════════════════════
//  TA LISTE DE RECHERCHE (14 nov., lot messages-achats-plus, n° 111)
//  docs/passation/2026-11-14-messages-achats-plus.md
// ══════════════════════════════════════════════════════════════════════════════
// Ce qu'il cherche à ACHETER : des lignes { marque, modèle, tailles, prix maximum },
// rangées côté VRM (`vrm_liste_recherche`, ligne `main`, synchronisée). Sur Vinted,
// l'encart VRM (vinted-sync-extension/vinted-infos.js) compare cette liste à
// l'annonce DÉJÀ OUVERTE dans l'onglet, telle que la page l'affiche :
//   · AUCUNE requête Vinted de plus, aucune recherche automatique, aucune page
//     ouverte pour lui (la liste vient de la base VRM, l'annonce de la page) ;
//   · la correspondance se fait sur des CRITÈRES STRUCTURÉS : la marque (celle de
//     l'annonce, sinon celle que la règle de l'app lit dans le titre), les mots du
//     modèle QU'IL a saisis (tous présents dans le titre), la taille (même pointure),
//     le prix (≤ son maximum). Chaque critère posé doit être LU : un prix ou une
//     taille que la page ne montre pas n'est pas « oui » (pas su ⇒ pas de signal) ;
//   · c'est un SIGNAL (« dans ta liste »), jamais une identité : rien n'est relié,
//     rien n'est acheté, rien n'est écrit.
// Recopiée dans l'extension par scripts/regles-achat-extension.cjs (§5 : une règle).
// Module PUR : exécuté par scripts/audit-messages-achats-plus.cjs.
// ══════════════════════════════════════════════════════════════════════════════

export const CLE_LISTE_RECHERCHE = 'vrm_liste_recherche';
export const MAX_RECHERCHES = 50;

const str = (v) => String(v == null ? '' : v).trim();
export const motsDe = (t) => str(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

// La clé d'une taille : « 43 » · « 42,5 » = « 42.5 » · « 44 2/3 » = « 44.67 » ·
// « EU 43 » = « 43 » · lettres « xl » = « XL ». Rien de lisible ⇒ ''.
export function tailleCle(t) {
  let s = str(t).toLowerCase().replace(/\b(eu|fr|eur|taille|pointure|size)\b/g, ' ').replace(/½/g, ' 1/2').trim();
  const fr = /(\d{2})(?:\s*(?:[.,](\d{1,2})|\s+(1|2)\/(2|3)))?/.exec(s);
  if (fr) {
    const n = Number(fr[1]);
    if (n >= 15 && n <= 55) {
      if (fr[2]) { const d = Number('0.' + fr[2]); return String(Math.round((n + d) * 100) / 100); }
      if (fr[3]) return String(Math.round((n + Number(fr[3]) / Number(fr[4])) * 100) / 100);
      return String(n);
    }
  }
  const l = /^(xxs|xs|s|m|l|xl|xxl|xxxl)$/.exec(s.replace(/\s+/g, ''));
  return l ? l[1].toUpperCase() : '';
}
// « 60,00 € » · « 60 » · 60 ⇒ 60 ; illisible ⇒ null.
export function prixLu(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
  const m = /(\d{1,6})(?:[.,](\d{1,2}))?/.exec(str(v).replace(/\s/g, ''));
  return m ? Number(m[1] + '.' + (m[2] || '0')) : null;
}

// Une ligne de la liste, nettoyée ; sans marque NI modèle ⇒ null (trop large).
export function rechercheNette(x) {
  const o = x && typeof x === 'object' ? x : {};
  const marque = str(o.marque).slice(0, 40), modele = str(o.modele).slice(0, 80);
  if (!motsDe(marque).length && !motsDe(modele).length) return null;
  const tailles = [...new Set((Array.isArray(o.tailles) ? o.tailles : str(o.tailles).split(/[;/|]|\s{2,}|,(?!\d)/)).map(tailleCle).filter(Boolean))].slice(0, 12);
  const p = prixLu(o.prixMax);
  return { id: str(o.id).slice(0, 40) || '', marque, modele, tailles, prixMax: p != null && p > 0 ? Math.round(p * 100) / 100 : null, actif: o.actif !== false };
}
export function listePropre(v) {
  const out = [], vus = new Set();
  for (const x of (Array.isArray(v) ? v : [])) {
    const r = rechercheNette(x); if (!r || !r.id || vus.has(r.id)) continue;
    vus.add(r.id); out.push(r);
    if (out.length >= MAX_RECHERCHES) break;
  }
  return out;
}

// Une annonce ouverte ({ marque, titre, taille, prix }) correspond-elle à UNE ligne ?
// `marqueDe(titre)` : la règle de l'app (`extractBrand`), pour une page sans marque.
// Rend { ok: true } · { ok: false, raison: 'marque'|'modele'|'taille'|'prix', pasSu?: true }.
export function correspond(recherche, annonce, { marqueDe = null } = {}) {
  const r = rechercheNette(recherche);
  if (!r || !r.actif) return { ok: false, raison: 'inactive' };
  const a = annonce && typeof annonce === 'object' ? annonce : {};
  const titre = motsDe(a.titre);
  if (motsDe(r.marque).length) {
    let m = motsDe(a.marque);
    if (!m.length && typeof marqueDe === 'function') m = motsDe(marqueDe(str(a.titre)));
    if (!m.length) return { ok: false, raison: 'marque', pasSu: true };
    if (m.join(' ') !== motsDe(r.marque).join(' ')) return { ok: false, raison: 'marque' };
  }
  const mod = motsDe(r.modele);
  if (mod.length) {
    if (!titre.length) return { ok: false, raison: 'modele', pasSu: true };
    const t = new Set(titre);
    if (!mod.every((w) => t.has(w))) return { ok: false, raison: 'modele' };
  }
  if (r.tailles.length) {
    const k = tailleCle(a.taille);
    if (!k) return { ok: false, raison: 'taille', pasSu: true };
    if (!r.tailles.includes(k)) return { ok: false, raison: 'taille' };
  }
  if (r.prixMax != null) {
    const p = prixLu(a.prix);
    if (p == null) return { ok: false, raison: 'prix', pasSu: true };
    if (p > r.prixMax + 1e-9) return { ok: false, raison: 'prix' };
  }
  return { ok: true };
}
// Les lignes de SA liste qui correspondent à l'annonce ouverte : [ligne].
export function correspondances(liste, annonce, deps = {}) {
  return listePropre(liste).filter((r) => correspond(r, annonce, deps).ok);
}
// Le libellé court d'une ligne (« Nike · air max 90 · 42,5 / 43 · ≤ 80 € ») — données, pas interface.
export function resumeRecherche(r) {
  const x = rechercheNette(r); if (!x) return '';
  const p = [x.marque, x.modele].filter(Boolean).join(' · ');
  const t = x.tailles.length ? x.tailles.map((k) => k.replace('.', ',')).join(' / ') : '';
  const m = x.prixMax != null ? `≤ ${String(x.prixMax).replace('.', ',')} €` : '';
  return [p, t, m].filter(Boolean).join(' · ');
}
