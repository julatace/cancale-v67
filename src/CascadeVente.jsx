import React, { useState, useEffect } from 'react';
import { segmentsCascade, texteValeurStock, lireValeurStock, EVT_VALEUR_STOCK, CLE_VALEUR_STOCK } from './coutVente.js';
import { centimes } from './beneficePaire.js';
import { emballagesAvecCout, CLE_EMBALLAGES } from './emballages.js';   // (10 nov., lot L)
import './styles-calculette-emballages.css';
import './styles-cout-vente.css';

// ════════════════════════════════════════════════════════════════════════════
//  LE COÛT RÉEL D'UNE VENTE, EN UNE BARRE (lot BA, 10 nov.) — et la VALEUR DU
//  STOCK (lot BF). Rien n'est calculé ici : `cascadeVente` / `valeurStock`
//  (src/coutVente.js) décomposent la règle du bénéfice (`beneficePaire`).
//  Couleurs (§7) : tout est neutre ; le bénéfice porte l'accent ; une PERTE et
//  un geste à faire sont ambre ; jamais rouge.
// ════════════════════════════════════════════════════════════════════════════

const NOMS = { achat: 'Prix d’achat', frais: 'Frais', emballage: 'Emballage', benefice: 'Bénéfice' };

// La barre empilée : achat · frais · emballage · bénéfice, à la largeur du prix de
// vente (ou des coûts quand ils le dépassent : la perte se voit au-delà du trait).
export function BarreCoutVente({ c }) {
  const s = segmentsCascade(c);
  if (!s) return null;
  const venteX = c.vente != null && s.total > 0 ? (c.vente / s.total) * 100 : 100;
  return (
    <div className="vrm-cv-barre" role="img" data-cv-barre={s.segments.map((x) => `${x.cle}:${x.c}`).join(',')} data-cv-perte={s.perte ? '1' : '0'}
      aria-label={s.segments.map((x) => NOMS[x.cle]).join(', ')}>
      {s.segments.map((x) => <span key={x.cle} className={`vrm-cv-seg is-${x.cle}`} data-cv-seg={x.cle} style={{ width: `${x.pct}%` }}/>)}
      {s.perte ? <span className="vrm-cv-trait" data-cv-trait="" style={{ left: `${venteX}%` }}/> : null}
    </div>
  );
}

// Le point de légende devant chaque ligne (la même couleur que son segment).
export const PointCout = ({ cle }) => <span className={`vrm-cv-point is-${cle}`} aria-hidden="true"/>;

// « Emballage · non saisi » : la porte (ambre, un geste à faire) ouvre un champ.
// Un montant illisible n'est jamais enregistré (§2.5) ; rien n'est deviné.
// (10 nov., lot L) SES emballages à coût (`vrm_emballages`, src/emballages.js), lus à
// l'ouverture du champ — une puce REMPLIT le champ, son « OK » l'enregistre : le coût ne
// va dans la vente que sur son clic, jamais posé tout seul.
export function SaisieEmballage({ onSaisir, types: typesDonnes = null }) {
  const [edit, setEdit] = useState(false);
  const types = React.useMemo(() => {
    if (!edit) return null;
    if (typesDonnes) return typesDonnes;
    try { return emballagesAvecCout(JSON.parse(localStorage.getItem(CLE_EMBALLAGES) || 'null')); } catch (_) { return null; }
  }, [edit, typesDonnes]);
  const [txt, setTxt] = useState('');
  const [err, setErr] = useState(false);
  if (!edit) return <button type="button" className="vrm-cv-porte" data-cv-emballage-saisir="" onClick={() => setEdit(true)}>non saisi</button>;
  const valider = () => {
    const t = txt.trim().replace(/\s*€$/, '');
    if (!t) { setEdit(false); return; }
    if (centimes(t) == null) { setErr(true); return; }
    onSaisir(t.replace(',', '.')); setEdit(false); setTxt('');
  };
  return (
    <form className="vrm-cv-champ" onSubmit={(ev) => { ev.preventDefault(); valider(); }}>
      <input autoFocus data-cv-emballage-champ="" inputMode="decimal" enterKeyHint="done" aria-label="Coût d’emballage de cette vente" aria-invalid={err || undefined}
        value={txt} placeholder="0,80" onChange={(e) => { setTxt(e.target.value); setErr(false); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setEdit(false); setTxt(''); setErr(false); } }}/>
      <span aria-hidden="true">€</span>
      <button type="submit" className="vrm-cv-ok" data-cv-emballage-ok="">OK</button>
      {Array.isArray(types) && types.length ? <span className="vrm-cv-champ-puces">{types.map((t) => <button key={t.id} type="button" className="vrm-calc-puce" data-cv-emballage-type={t.id} onClick={() => { setTxt(t.cout); setErr(false); }}>{t.nom} · {t.cout} €</button>)}</span> : null}
    </form>
  );
}

// ── BF : la valeur du stock (lue de `vrm_valeur_stock`, jamais recalculée) ──
// `v` : { centimes, n, nPrix, nSans, partiel } | null (pas su ⇒ « — »).
export function ValeurStockCarte({ v, onSaisir = null }) {
  const t = texteValeurStock(v, { partiel: !!(v && v.partiel) });
  const pct = v && v.n ? Math.round((v.nPrix / v.n) * 100) : 0;
  return (
    <section className="vrm-cv-stock" aria-label="Valeur du stock" data-valeur-stock={v ? (v.centimes == null ? 'passu' : String(v.centimes)) : 'jamais'}
      data-valeur-stock-n={v ? v.n : undefined} data-valeur-stock-sans={v ? v.nSans : undefined} data-valeur-stock-au-moins={t.auMoins ? '1' : '0'}>
      <div className="vrm-cv-stock-tete">Valeur du stock</div>
      <div className="vrm-cv-stock-montant">{t.auMoins ? <span className="vrm-cv-stock-borne">au moins </span> : null}<b>{t.montant}</b></div>
      {v && v.n ? <div className="vrm-cv-stock-jauge" role="img" aria-label={`${v.nPrix} sur ${v.n} avec un prix d’achat`}><span style={{ width: `${pct}%` }}/></div> : null}
      <div className="vrm-cv-stock-sous">
        {!v ? <span data-valeur-stock-passu="">annonces pas encore lues</span> : null}
        {/* (11 nov., lot DJ4) Le Stock compte les paires EN LIGNE ; la valeur, elles et celles gardées à part (à confirmer, masquées) : dit. */}
        {t.sur ? <span data-valeur-stock-sur="">{t.sur} chez toi</span> : null}
        {t.sans ? (onSaisir
          ? <button type="button" className="vrm-cv-porte" data-valeur-stock-saisir="" onClick={onSaisir}>{t.sans} ›</button>
          : <span>{t.sans}</span>) : null}
      </div>
    </section>
  );
}

// La valeur publiée par l'écran Annonces, pour CE compte VRM ; suit chaque publication.
export function useValeurStock(owner) {
  const [v, setV] = useState(() => lireValeurStock(owner));
  useEffect(() => {
    setV(lireValeurStock(owner));
    const relire = () => setV(lireValeurStock(owner));
    const surStockage = (e) => { if (!e || e.key == null || e.key === CLE_VALEUR_STOCK) relire(); };
    window.addEventListener(EVT_VALEUR_STOCK, relire);
    window.addEventListener('storage', surStockage);
    return () => { window.removeEventListener(EVT_VALEUR_STOCK, relire); window.removeEventListener('storage', surStockage); };
  }, [owner]);
  return v;
}
