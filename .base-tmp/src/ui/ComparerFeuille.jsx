// ── src/ui/ComparerFeuille.jsx — deux paires côte à côte (chantier 95) ──────────
// Les deux annonces COCHÉES (par identité : compte + id, src/comparerPaires.js), en
// deux colonnes ALIGNÉES : la photo et le nom en tête, puis une rangée par chiffre
// (achat, prix, marge, en ligne depuis, état, taille, marque, N°, compte). Ce qui
// n'est pas lu s'écrit « — » (jamais 0, §5) et la phrase de pied le dit une fois.
// Les montants à l'encre (l'accent bleu est aux actions, §7) ; la marge négative en
// ambre (un geste à regarder), jamais en rouge (le rouge est aux doublons de N°).
import React from 'react';
import { tr, monnaie } from '../i18n/index.js';
import { lignesComparaison } from '../comparerPaires.js';
import { Feuille } from './Feuille.jsx';
import './listes-recherche.css';

const MONTANTS = new Set(['achat', 'prix', 'marge']);
const texte = (k, v) => {
  if (v == null) return '—';
  if (MONTANTS.has(k)) return monnaie(v, 'EUR', { maximumFractionDigits: Number.isInteger(v) ? 0 : 2 });
  if (k === 'depuis') return tr('listes.comparer.jours', { n: v });
  if (k === 'numero') return 'N°' + v;
  return String(v);
};

export function ComparerFeuille({ paires, onClose, Photo = null, maintenant = Date.now() }) {
  if (!Array.isArray(paires) || paires.length !== 2) return null;
  const [a, b] = paires;
  const lignes = lignesComparaison(a, b, { maintenant });
  const unVide = lignes.some((l) => l.a == null || l.b == null);
  const photo = (p) => (p.photo ? (Photo ? <Photo src={p.photo} alt="" loading="lazy" decoding="async" width={88} height={88}/> : <img src={p.photo} alt="" loading="lazy" decoding="async" width={88} height={88}/>) : null);
  return (
    <Feuille titre={tr('listes.comparer.titre')} onClose={onClose} data-comparer="">
      <div className="vrm-ui-comparer" data-comparer-a={a.uid + ':' + a.id} data-comparer-b={b.uid + ':' + b.id}>
        <div className="vrm-ui-comparer-tete">
          <span/>
          {[a, b].map((p) => (
            <div key={p.uid + ':' + p.id} className="vrm-ui-comparer-paire" data-comparer-paire={p.id}>
              <span className="vrm-ui-comparer-photo" aria-hidden="true">{photo(p)}</span>
              <span className="vrm-ui-comparer-nom">{p.titre || '—'}</span>
            </div>
          ))}
        </div>
        <dl className="vrm-ui-comparer-lignes">
          {lignes.map((l) => (
            <div key={l.k} className="vrm-ui-comparer-ligne" data-comparer-ligne={l.k}>
              <dt>{tr('listes.comparer.l.' + l.k)}</dt>
              <dd data-comparer-val="a" data-comparer-brut={l.a == null ? '' : String(l.a)} className={l.k === 'marge' && l.a != null && l.a < 0 ? 'is-ambre' : undefined}>{texte(l.k, l.a)}</dd>
              <dd data-comparer-val="b" data-comparer-brut={l.b == null ? '' : String(l.b)} className={l.k === 'marge' && l.b != null && l.b < 0 ? 'is-ambre' : undefined}>{texte(l.k, l.b)}</dd>
            </div>
          ))}
        </dl>
        {unVide ? <p className="vrm-ui-comparer-pied">{tr('listes.comparer.pasSu')}</p> : null}
      </div>
    </Feuille>
  );
}
export default ComparerFeuille;
