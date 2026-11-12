// ═══════════════════════════════════════════════════════════════════════════
//  SAISIE RAPIDE (11 nov.) — « Vendu ailleurs » sur la fiche, et la feuille
//  « Combien tu l'avais payée ? » du prix d'achat demandé le jour de la vente.
// ═══════════════════════════════════════════════════════════════════════════
// Les règles sont ailleurs (src/venteAilleurs.js, src/prixAchatVente.js) ; ici, le
// visage seulement. Peu de texte (une phrase ≤ 12 mots), de gros champs, 44 px.
// Les dépendances de l'app (la feuille, le bouton) arrivent en propriétés : ce
// module n'importe pas App.jsx.
import React from 'react';
import { aujourdhui, dateValide } from './venteAilleurs.js';
import './styles-saisie-rapide.css';

// La lecture d'un montant tapé : « 45 », « 45,50 € » ⇒ nombre ; sinon null (rien de deviné).
export function lireMontant(t) {
  const s = String(t == null ? '' : t).replace(/[\s€ ]/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}
const eur = (n) => (n == null || !Number.isFinite(Number(n))) ? '—' : (Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(2).replace('.', ',')) + ' €';
const jourFr = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}` : ''; };

// ── « VENDU AILLEURS » : le bloc de la fiche ────────────────────────────────
// carte   { id, numero } — l'annonce de la paire (identité), son N°
// deja    la décision déjà posée (`{ montant, date }`) ou null
// onValider({ montant, date }) ⇒ la coque écrit le geste annulable
export function VenduAilleurs({ carte, deja = null, onValider, Bouton }) {
  const [ouvert, setOuvert] = React.useState(false);
  const [prix, setPrix] = React.useState('');
  const [date, setDate] = React.useState(() => aujourdhui());
  const [faux, setFaux] = React.useState('');
  if (!carte || !carte.id) return null;
  if (deja) {
    return <div className="vrm-sr-bloc" data-vendu-ailleurs={carte.id} data-vendu-ailleurs-fait={eur(deja.montant)}>
      <p className="vrm-sr-fait">Vendu ailleurs · {eur(deja.montant)}{deja.date ? ` le ${jourFr(deja.date)}` : ''}</p>
    </div>;
  }
  const valider = (e) => {
    if (e) e.preventDefault();
    const m = lireMontant(prix);
    if (m == null) { setFaux('prix'); return; }
    if (!dateValide(date)) { setFaux('date'); return; }
    setFaux('');
    onValider && onValider({ montant: m, date });
  };
  const B = Bouton || ((p) => <button type="button" aria-label={p['aria-label']} {...p}/>);   // repli : le nom vient de l'appelant
  if (!ouvert) {
    return <div className="vrm-sr-bloc" data-vendu-ailleurs={carte.id}>
      <B variante="secondaire" className="vrm-sr-ouvrir" data-vendu-ailleurs-ouvrir="" onClick={() => setOuvert(true)}>Vendu ailleurs</B>
    </div>;
  }
  return <form className="vrm-sr-bloc vrm-sr-form" data-vendu-ailleurs={carte.id} data-vendu-ailleurs-etape="prix" onSubmit={valider} noValidate>
    <div className="vrm-sr-ligne">
      <label className="vrm-sr-champ vrm-sr-prix">
        <span>Vendu</span>
        <input autoFocus inputMode="decimal" enterKeyHint="done" autoComplete="off" placeholder="0" value={prix}
          aria-invalid={faux === 'prix' ? 'true' : undefined} data-vendu-ailleurs-prix=""
          onChange={(e) => { setPrix(e.target.value); if (faux) setFaux(''); }}/>
        <b aria-hidden="true">€</b>
      </label>
      <label className="vrm-sr-champ vrm-sr-date">
        <span>Le</span>
        <input type="date" value={date} max={aujourdhui()} data-vendu-ailleurs-date=""
          aria-invalid={faux === 'date' ? 'true' : undefined} onChange={(e) => { setDate(e.target.value); if (faux) setFaux(''); }}/>
      </label>
    </div>
    <p className="vrm-sr-note" data-vendu-ailleurs-note="">{faux === 'prix' ? 'Un prix en euros, par exemple 45.' : faux === 'date' ? 'Une date passée.' : 'Payé le jour même : compté dans ce mois-là.'}</p>
    <div className="vrm-sr-actions">
      <B variante="secondaire" className="vrm-sr-annuler" onClick={() => { setOuvert(false); setPrix(''); setFaux(''); }}>Annuler</B>
      <B variante="primaire" type="submit" className="vrm-sr-valider" data-vendu-ailleurs-valider="">Valider</B>
    </div>
  </form>;
}

// ── LA FEUILLE « COMBIEN TU L'AVAIS PAYÉE ? » ───────────────────────────────
// ventes  [{ tx, num, eur, item }] — celles qu'il reste à saisir
// onEnregistrer(vente, montant) ⇒ la coque écrit le prix sur la fiche (identité : item)
export function FeuillePrixAchat({ ventes, onEnregistrer, onFermer, Feuille, Bouton }) {
  const [vals, setVals] = React.useState({});
  const [faux, setFaux] = React.useState({});
  const l = Array.isArray(ventes) ? ventes : [];
  const B = Bouton || ((p) => <button type="button" aria-label={p['aria-label']} {...p}/>);   // repli : le nom vient de l'appelant
  const valider = (e) => {
    if (e) e.preventDefault();
    const f = {}; const ok = [];
    for (const v of l) {
      const t = vals[v.tx]; if (t == null || String(t).trim() === '') continue;
      const m = lireMontant(t); if (m == null) { f[v.tx] = true; continue; }
      ok.push([v, m]);
    }
    setFaux(f);
    if (Object.keys(f).length || !ok.length) return;
    for (const [v, m] of ok) onEnregistrer && onEnregistrer(v, m);
    onFermer && onFermer();
  };
  const corps = <form className="vrm-sr-feuille" data-prix-achat-feuille={String(l.length)} onSubmit={valider} noValidate>
    {l.length === 0 ? <p className="vrm-sr-note">Tout est saisi.</p> : null}
    {l.map((v, i) => (
      <label key={v.tx} className="vrm-sr-champ vrm-sr-achat" data-prix-achat-tx={v.tx} data-prix-achat-num={v.num}>
        <span className="vrm-sr-qui"><b>N°{v.num}</b> · vendu {eur(v.eur)}</span>
        <span className="vrm-sr-saisie">
          <input autoFocus={i === 0} inputMode="decimal" enterKeyHint={i === l.length - 1 ? 'done' : 'next'} autoComplete="off" placeholder="Payé"
            aria-label={`Prix d'achat du N°${v.num}`} aria-invalid={faux[v.tx] ? 'true' : undefined} value={vals[v.tx] || ''}
            onChange={(e) => { const t = e.target.value; setVals((s) => ({ ...s, [v.tx]: t })); }}/>
          <b aria-hidden="true">€</b>
        </span>
      </label>
    ))}
    {Object.keys(faux).length ? <p className="vrm-sr-note" data-prix-achat-faux="">Un prix en euros, par exemple 25.</p> : null}
    {l.length ? <B variante="primaire" type="submit" className="vrm-sr-valider" data-prix-achat-valider="">Enregistrer</B> : null}
  </form>;
  if (!Feuille) return corps;
  return <Feuille onClose={onFermer} titre={l.length > 1 ? 'Combien tu les avais payées ?' : 'Combien tu l’avais payée ?'} className="vrm-sr-sheet">{corps}</Feuille>;
}

// ── LES VENTES À SAISIR, publiées par la coque, lues par Ma journée ─────────
// `undefined` pas encore calculé · `null` pas su (preuves illisibles) · liste.
let _demandes; const _abonnes = new Set();
export function poserDemandesPrix(l) { _demandes = Array.isArray(l) ? l : (l === null ? null : undefined); for (const f of [..._abonnes]) { try { f(); } catch (_) {} } }
export function abonnerDemandesPrix(f) { _abonnes.add(f); return () => _abonnes.delete(f); }
export function lireDemandesPrix() { return _demandes; }
