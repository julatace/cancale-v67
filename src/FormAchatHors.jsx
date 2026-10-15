// ═══════════════════════════════════════════════════════════════════════════
// FORMULAIRE « ACHAT HORS VINTED » (brocante, magasin, lot…) — 15 octobre
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ UN COMPOSANT À PART, PAS UN MORCEAU DU RENDU. L'ancien formulaire déclarait
//    `const Field = ({label,children}) => …` À L'INTÉRIEUR du rendu de l'écran :
//    chaque frappe créait un NOUVEAU type de composant, React remontait les
//    champs, et le focus repartait sur la désignation (autoFocus). Mesuré : taper
//    « 25 » dans le prix donnait prix = « 2 » et « 5 » dans la désignation. Ici
//    l'état vit dans CE composant, déclaré une fois au niveau module.
// ⚠️ LE PRIX EST LE SEUL CHAMP OBLIGATOIRE. Une désignation, un justificatif ou
//    une paire ne s'inventent pas : facultatifs, et rien n'est rempli à sa place.
import React from 'react';
import { PROVENANCES, quantiteHors, coutHorsCentimes, partsHors, prixTexte, QUANTITE_MAX } from './achatsHors.js';
import { centimes } from './beneficePaire.js';

const euros = (c) => (c == null ? '—' : (c / 100).toFixed(2).replace('.', ',') + ' €');

export default function FormAchatHors({ initial, paires, liensN = 0, onSave, onCancel, theme: C }) {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [d, setD] = React.useState(() => ({
    price: initial && initial.price != null ? String(initial.price).replace('.', ',') : '',
    frais: initial && initial.frais != null ? String(initial.frais).replace('.', ',') : '',
    quantite: initial ? String(quantiteHors(initial)) : '1',
    source: (initial && initial.source) || 'brocante',
    date: (initial && initial.date) || aujourdhui,
    title: (initial && initial.title) || '',
    justif: (initial && initial.justif) || '',
    paire: '',
  }));
  const maj = (k) => (e) => { const v = e && e.target ? e.target.value : e; setD((x) => ({ ...x, [k]: v })); };
  const prixOk = centimes(d.price) != null;
  const fraisOk = !String(d.frais).trim() || centimes(d.frais) != null;
  const qBrut = String(d.quantite).trim() || '1';
  const qOk = /^\d{1,3}$/.test(qBrut) && Number(qBrut) >= 1 && Number(qBrut) <= QUANTITE_MAX;
  const q = qOk ? Number(qBrut) : 1;
  const qSousLiens = qOk && q < liensN;   // on ne retire pas en silence une paire déjà rattachée
  const pleinDeja = liensN > 0 && liensN >= q;   // toutes ses paires sont déjà rattachées
  const total = prixOk && fraisOk ? coutHorsCentimes({ price: d.price, frais: d.frais }) : null;
  const parts = total != null && q > 1 ? partsHors(total, q) : null;
  const pret = prixOk && fraisOk && qOk && !qSousLiens;
  const erreur = !String(d.price).trim() ? '' : !prixOk ? 'Prix : un montant comme 25 ou 25,50.'
    : !fraisOk ? 'Frais : un montant comme 3 ou 3,50.'
    : !qOk ? `Quantité : de 1 à ${QUANTITE_MAX}.`
    : qSousLiens ? `Déjà rattaché à ${liensN} paires : la quantité ne peut pas descendre en dessous.` : '';
  const enregistrer = () => {
    if (!pret) return;
    onSave({
      price: prixTexte(centimes(d.price)),
      frais: String(d.frais).trim() ? prixTexte(centimes(d.frais)) : '',
      quantite: q,
      source: d.source,
      date: d.date || aujourdhui,
      title: String(d.title).trim(),
      justif: String(d.justif).trim(),
    }, (!pleinDeja && d.paire) || null);
  };
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px', minWidth: 0, fontSize: 11.5, fontWeight: 600, color: C.muted };
  const inp = { border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 11px', fontSize: 15, background: C.card, color: C.text, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', fontWeight: 500 };
  return (
    <form data-form-achat-hors onSubmit={(e) => { e.preventDefault(); enregistrer(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={lab}>Prix payé €
          <input data-champ="prix" value={d.price} onChange={maj('price')} inputMode="decimal" autoFocus placeholder="0" style={inp} />
        </label>
        <label style={lab}>Frais €
          <input data-champ="frais" value={d.frais} onChange={maj('frais')} inputMode="decimal" placeholder="facultatif" style={inp} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label style={lab}>Quantité
          <input data-champ="quantite" value={d.quantite} onChange={maj('quantite')} inputMode="numeric" placeholder="1" style={inp} />
        </label>
        <label style={lab}>Date
          <input data-champ="date" type="date" value={d.date} onChange={maj('date')} style={inp} />
        </label>
      </div>
      <div role="group" aria-label="Provenance" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {PROVENANCES.map(([k, l]) => (
          <button key={k} type="button" data-provenance={k} aria-pressed={d.source === k} onClick={() => setD((x) => ({ ...x, source: k }))}
            style={{ border: `1px solid ${d.source === k ? C.accent : C.border}`, background: d.source === k ? C.accent : 'transparent', color: d.source === k ? (C.onAccent || '#fff') : C.text, borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 40 }}>{l}</button>
        ))}
      </div>
      <label style={{ ...lab, flex: 'none' }}>Désignation
        <input data-champ="titre" value={d.title} onChange={maj('title')} placeholder="facultatif — ex : Nike Air Max 90 T42" style={inp} />
      </label>
      <label style={{ ...lab, flex: 'none' }}>Justificatif
        <input data-champ="justif" value={d.justif} onChange={maj('justif')} placeholder="facultatif — n° de ticket, de facture" style={inp} />
      </label>
      {/* « Associer à une paire » : TROIS états (relecture du 15 octobre) —
          `undefined` les annonces se lisent · `null` elles n'ont pas pu être lues ·
          une liste. Avant, une liste pas encore chargée cachait le champ, et il
          ne s'affichait jamais depuis l'écran Achats. Un achat déjà rattaché à
          toutes ses paires (quantité atteinte) ne propose plus rien : un second
          lien serait refusé — on ne le propose pas pour rien. */}
      {!pleinDeja && paires === undefined && (
        <div data-champ-paire="lecture" style={{ fontSize: 11.5, color: C.muted }}>Associer à une paire : lecture de tes annonces…</div>
      )}
      {!pleinDeja && paires === null && (
        <div data-champ-paire="ko" style={{ fontSize: 11.5, color: C.muted }}>Tes annonces n'ont pas pu être lues : tu pourras l'associer plus tard, depuis l'annonce ou la vente.</div>
      )}
      {!pleinDeja && Array.isArray(paires) && paires.length > 0 && (
        <label style={{ ...lab, flex: 'none' }}>Associer à une paire
          <select data-champ="paire" value={d.paire} onChange={maj('paire')} style={inp}>
            <option value="">facultatif — aucune pour l'instant</option>
            {paires.map((p) => <option key={p.id} value={String(p.id)}>{p.numero ? `N°${p.numero} · ` : ''}{String(p.title || '').slice(0, 44)}</option>)}
          </select>
        </label>
      )}
      <div data-total-achat style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
        Total {euros(total)}
        {parts && <span data-part-par-paire={String(parts[parts.length - 1])} style={{ color: C.muted, fontWeight: 500 }}> · ≈ {euros(parts[parts.length - 1])} par paire (réparti)</span>}
      </div>
      {erreur && <div role="alert" style={{ fontSize: 12, color: C.warn || C.text }}>{erreur}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" onClick={onCancel} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.text, borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 }}>Annuler</button>
        <button type="submit" data-enregistrer-achat disabled={!pret} style={{ border: 'none', background: pret ? C.accent : C.border, color: pret ? (C.onAccent || '#fff') : C.muted, borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: pret ? 'pointer' : 'default', fontFamily: 'inherit', minHeight: 44 }}>Enregistrer</button>
      </div>
    </form>
  );
}

// ── « PRIX D'ACHAT » SANS RELIER D'ACHAT (15 octobre) ─────────────────────────
// Julien : « quand on veut ajouter un prix d'achat, ça nous propose juste de
// relier une paire ; des fois on n'a pas la possibilité de relier et on veut
// juste mettre le prix ». La modale « relier un achat » s'ouvre donc sur CE
// champ : on tape, on enregistre, rien n'est relié. Relier un achat reste
// possible juste en dessous — et le fera plus tard sans doublon (le lien
// remplace le prix tapé, il ne s'y ajoute pas).
export function PrixAchatDirect({ valeur, onSave, theme: C }) {
  const [v, setV] = React.useState(valeur != null ? String(valeur).replace('.', ',') : '');
  const c = centimes(v);
  const ok = c != null;
  return (
    <form data-prix-sans-relier onSubmit={(e) => { e.preventDefault(); if (ok) onSave(prixTexte(c)); }}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 150px', minWidth: 0, fontSize: 11.5, fontWeight: 600, color: C.muted }}>Prix d'achat €
        <input data-champ="prix-direct" value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" placeholder="ex : 35"
          style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 11px', fontSize: 15, background: C.card, color: C.text, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', fontWeight: 500 }} />
      </label>
      <button type="submit" disabled={!ok} data-enregistrer-prix
        style={{ border: 'none', background: ok ? C.accent : C.border, color: ok ? (C.onAccent || '#fff') : C.muted, borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 700, cursor: ok ? 'pointer' : 'default', fontFamily: 'inherit', minHeight: 44, flexShrink: 0 }}>Enregistrer</button>
    </form>
  );
}
