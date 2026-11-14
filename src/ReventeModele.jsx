import React from 'react';
import { reventeDuModele, phraseRevente, euroCourt } from './reventeModele.js';
import { phraseMoitie } from './ceQuiRapporte.js';

// « Ce que tu as revendu ce modèle » (10 nov., lot AV). Une INFORMATION sur le
// passé (src/reventeModele.js) : toucher déplie prix médian, bénéfice médian,
// délai et les dernières ventes. Aucun bouton, aucune écriture, aucune liaison,
// aucun conseil de prix (refusé le 11 oct.).
//   cible    : { titre, marque? } ;
//   lireReleve : () => `vrm_stats_ventes` (objet { l }) ou null — lu au montage et
//                relu quand l'écran Ventes le republie (`vrm:save`) ;
//   lireExtras : () => Promise<{ txn, items, dates }> (la mise en ligne, Vinted) — lu
//                seulement quand la ligne est dépliée ;
//   dateEnLigne(it, dates) → ms | null ; ouvert : déplié d'emblée (feuille d'un achat).
const J_FMT = { day: 'numeric', month: 'short' };
export const PHRASE_DEPLIEE = 'Tes ventes de ce modèle';
export function ReventeModele({ cible, lireReleve, lireExtras = null, dateEnLigne = null, ouvert = false, C }) {
  const lire = () => { try { return typeof lireReleve === 'function' ? lireReleve() : null; } catch (_) { return null; } };
  const [releve, setReleve] = React.useState(lire);
  React.useEffect(() => {
    const f = (e) => { if (e && e.detail && e.detail.k === 'vrm_stats_ventes') setReleve(lire()); };
    window.addEventListener('vrm:save', f); return () => window.removeEventListener('vrm:save', f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [deplie, setDeplie] = React.useState(!!ouvert);
  const [extras, setExtras] = React.useState(undefined); // undefined pas lu · null raté · objet
  React.useEffect(() => {
    if (!deplie || extras !== undefined || typeof lireExtras !== 'function') return undefined;
    let mort = false;
    Promise.resolve().then(lireExtras).then((x) => { if (!mort) setExtras(x || null); }).catch(() => { if (!mort) setExtras(null); });
    return () => { mort = true; };
  }, [deplie, extras, lireExtras]);
  const enLigneDe = React.useMemo(() => {
    if (typeof lireExtras !== 'function' || typeof dateEnLigne !== 'function') return null;
    if (extras === undefined) return () => undefined;
    return (r) => {
      if (!extras || r[0] !== 'Vinted') return null;
      const t = extras.txn && r[2] ? extras.txn[String(r[2])] : null;
      const it = t && t.item && extras.items ? extras.items[t.item] : null;
      return it ? dateEnLigne(it, extras.dates || null) : null;
    };
  }, [extras, lireExtras, dateEnLigne]);
  const res = React.useMemo(() => reventeDuModele({ cible, releve: releve && Array.isArray(releve.l) ? releve.l : null, enLigneDe }),
    [cible && cible.titre, cible && cible.marque, releve, enLigneDe]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!res || res.etat === 'inconnu') return null;
  const phrase = phraseRevente(res);
  const base = { fontSize: 13, color: C.text, marginTop: 6 };
  if (res.etat !== 'ok') {
    return <div data-revente-modele={res.etat} data-revente-n={res.n == null ? '' : res.n} style={{ ...base, color: C.muted, minHeight: 32, display: 'flex', alignItems: 'center' }}>
      <span data-revente-phrase="">{phrase}</span>
    </div>;
  }
  const fig = (cle, titre, valeur, sous) => (
    <div data-revente-fig={cle} style={{ flex: '1 1 0', minWidth: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{titre}</div>
      <div className="vrm-display" style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: C.text, whiteSpace: 'nowrap' }}>{valeur}</div>
      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.3 }}>{sous}</div>
    </div>
  );
  const delaiValeur = res.delaiMedian != null ? `${Math.round(res.delaiMedian)} j` : !res.delaiLu && deplie && typeof lireExtras === 'function' ? '…' : '—';
  const delaiSous = res.delaiMedian != null ? `${phraseMoitie(res.delaiMedian)} · sur ${res.nDelai}` : delaiValeur === '…' ? 'lecture…' : 'mise en ligne pas lue';
  return <details className="vrm-repli" open={deplie} onToggle={(e) => setDeplie(e.currentTarget.open)}
    data-revente-modele="ok" data-revente-n={res.n} data-revente-prix={Math.round(res.prixMedian * 100)}
    data-revente-benef={res.benefMedian == null ? '' : Math.round(res.benefMedian * 100)} data-revente-nbenef={res.nBenef}
    data-revente-delai={res.delaiMedian == null ? '' : res.delaiMedian} style={base}>
    <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* (11 nov., décision C6 — Julien : « tranche ») Le prix médian s'écrit UNE fois (§7) :
          replié, la phrase le dit ; déplié, la case « Prix de vente » le dit et la phrase se tait. */}
      <span data-revente-phrase="">{deplie ? PHRASE_DEPLIEE : phrase}</span>
    </summary>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
      <div style={{ fontSize: 12, color: C.muted }}>{res.modele.nom} · tes ventes finalisées</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {fig('prix', 'Prix de vente', euroCourt(res.prixMedian), `médiane · sur ${res.n}`)}
        {fig('benef', 'Bénéfice', euroCourt(res.benefMedian), res.nBenef ? `médiane · sur ${res.nBenef} des ${res.n}` : 'prix d’achat pas saisi')}
        {fig('delai', 'Délai', delaiValeur, delaiSous)}
      </div>
      <div data-revente-liste="" style={{ display: 'flex', flexDirection: 'column' }}>
        {res.ventes.map((v, i) => (
          <div key={v.id || i} data-revente-vente={v.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 12, padding: '4px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
            <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>{new Date(v.ts).toLocaleDateString('fr-FR', new Date(v.ts).getFullYear() === new Date().getFullYear() ? J_FMT : { ...J_FMT, year: 'numeric' })}</span>
            <span style={{ flex: 1, minWidth: 0, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.compte || v.plateforme}</span>
            <b style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{euroCourt(v.eur)}</b>
            <span style={{ width: 70, textAlign: 'right', color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{v.benefice == null ? '—' : (v.benefice >= 0 ? '+' : '') + euroCourt(v.benefice)}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.muted }}>Regroupé par titre. Le passé, pas un conseil de prix.</div>
    </div>
  </details>;
}
