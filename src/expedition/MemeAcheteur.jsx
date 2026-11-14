// ════════════════════════════════════════════════════════════════════════════
//  IDÉE 152 — « MÊME ACHETEUR : ENVOYER ENSEMBLE ? » (14 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  La règle (identité exacte, jamais une ressemblance) : `memeAcheteur.js`.
//  Ici : la lecture des identités Vinted (UNE requête, projetée en scalaires — §4.4 : jamais
//  `select=data` sur une transaction), le bandeau, et le choix « Préparer ensemble » (sur cet
//  appareil : un aide-mémoire, rien en base).
//  Le bandeau dit honnêtement ce que VRM ne peut pas faire : Vinted fait un bordereau par
//  vente, deux bordereaux restent deux colis ; VRM rapproche seulement les colis dans la liste
//  et le rappelle à l'emballage.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import { groupesMemeAcheteur } from './memeAcheteur.js';
import './expedition.css';

const CLE_ENSEMBLE = 'vrm_meme_acheteur_ensemble';   // { [cle de groupe]: at } — sur l'appareil
const lireEnsemble = () => { try { const o = JSON.parse(localStorage.getItem(CLE_ENSEMBLE) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; } };
const _ecoutes = new Set();
export function useEnsemble() {
  const [m, setM] = React.useState(lireEnsemble);
  React.useEffect(() => { _ecoutes.add(setM); return () => { _ecoutes.delete(setM); }; }, []);
  const basculer = React.useCallback((cle) => {
    const u = { ...lireEnsemble() }; if (u[cle]) delete u[cle]; else u[cle] = Date.now();
    // Au plus 50 choix gardés (les plus récents) : les anciens groupes sont partis depuis longtemps.
    const garde = Object.fromEntries(Object.entries(u).sort((a, b) => b[1] - a[1]).slice(0, 50));
    try { localStorage.setItem(CLE_ENSEMBLE, JSON.stringify(garde)); } catch (_) {}
    for (const f of _ecoutes) { try { f(garde); } catch (_) {} }
  }, []);
  return { choisis: React.useMemo(() => new Set(Object.keys(m)), [m]), basculer };
}

// La requête des identités Vinted : les détails de CES transactions, rien d'autre.
// `cibles` : [{ uid, tx }] ⇒ la partie `id=in.(…)&select=…` (projection scalaire).
export const requeteAcheteurs = (cibles) => {
  const ids = [...new Set((cibles || []).filter((c) => /^\d+$/.test(String(c.uid)) && /^\d+$/.test(String(c.tx))).map((c) => `"harvest_${c.uid}_txn_${c.tx}"`))];
  if (!ids.length) return '';
  return `id=in.(${ids.join(',')})&select=id,tx:data->payload->transaction->>id,side:data->payload->transaction->>user_side,b:data->payload->transaction->>buyer_id,bl:data->payload->transaction->buyer->>login,n:data->payload->transaction->>items_count`;
};
// Les lignes lues ⇒ Map tx → { uid, acheteurId, pseudo, n }. Une ligne dont le n° ne colle pas à son
// nom, ou qui n'est pas une VENTE (`user_side` ≠ seller), ne donne rien.
export function acheteursDeLignes(rows) {
  const m = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const k = /^harvest_(\d+)_txn_(\d+)$/.exec(String((r && r.id) || ''));
    if (!k || String(r.tx || '') !== k[2] || r.side !== 'seller' || !/^[1-9]\d*$/.test(String(r.b || ''))) continue;
    m.set(k[2], { uid: k[1], acheteurId: String(r.b), pseudo: typeof r.bl === 'string' ? r.bl : '', n: Number(r.n) || 1 });
  }
  return m;
}
// Le hook : relu quand la liste des transactions change. `lire(q)` rend un tableau, ou null (pas su).
export function useAcheteursVinted(cibles, lire) {
  const q = requeteAcheteurs(cibles);
  const [m, setM] = React.useState(() => new Map());
  React.useEffect(() => {
    if (!q || typeof lire !== 'function') return undefined;
    let vivant = true;
    Promise.resolve(lire(q)).then((rows) => { if (vivant && Array.isArray(rows)) setM(acheteursDeLignes(rows)); }, () => {});
    return () => { vivant = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return m;
}

// Les colis (à expédier) avec leur identité d'acheteur ⇒ les groupes.
export const groupesDesColis = (colis) => groupesMemeAcheteur(colis);

// LE BANDEAU — un par groupe ; « Préparer ensemble » est SON toucher (enfoncé = choisi).
export function BandeauMemeAcheteur({ groupes, choisis, onBasculer, colisDe = () => null, Plaque = null }) {
  if (!groupes || !groupes.length) return null;
  return (
    <section className="vrm-exp vrm-exp-meme" data-meme-acheteur={groupes.length} aria-label={tr('exp.meme.titre')}>
      {groupes.map((g) => {
        const actif = choisis && choisis.has(g.cle);
        const membres = g.colis.map((k) => colisDe(k)).filter(Boolean);
        return (
          <div key={g.cle} className="vrm-exp-meme-groupe" data-meme-groupe={g.cle} data-meme-n={g.colis.length} data-meme-site={g.site}>
            <p className="vrm-exp-meme-titre"><b>{tr('exp.meme.question')}</b>{g.pseudo ? <span className="vrm-exp-sous"> · {g.pseudo}</span> : null}</p>
            <p className="vrm-exp-meme-colis">
              {membres.map((c) => <span key={c.cle} className="vrm-exp-meme-un" data-meme-colis={c.cle}>{c.num ? (Plaque ? <Plaque num={c.num}/> : <span className="sb-plaque"><small>N°</small>{c.num}</span>) : null} {c.titre}</span>)}
            </p>
            <p className="vrm-exp-sous">{tr(g.site === 'ebay' ? 'exp.meme.honnete.ebay' : 'exp.meme.honnete.vinted', { n: g.colis.length })}</p>
            <button type="button" className="sb-touche" aria-pressed={actif ? 'true' : 'false'} data-meme-ensemble={g.cle} onClick={() => onBasculer(g.cle)}>{tr(actif ? 'exp.meme.ensembleOui' : 'exp.meme.ensemble')}</button>
          </div>
        );
      })}
    </section>
  );
}
// LE RAPPEL À L'EMBALLAGE (Préparer mes colis, mode samedi) : les autres N° du même acheteur.
export function RappelMemeAcheteur({ autres = [] }) {
  if (!autres.length) return null;
  const qui = autres.map((c) => (c.num ? `N°${c.num}` : c.titre)).join(', ');
  return <p className="vrm-exp-rappel" data-meme-rappel={autres.length}>{tr('exp.meme.rappel', { qui, n: autres.length + 1 })}</p>;
}
