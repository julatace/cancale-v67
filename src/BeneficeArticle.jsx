// ════════════════════════════════════════════════════════════════════════════
//  LE BÉNÉFICE RÉEL D'UN ARTICLE, À L'ÉCRAN (15 nov., lot argent-plus)
//  · `BeneficeArticleDetail` : sur la fiche d'un article vendu, la décomposition
//    « prix − frais du site (= versé) − frais saisis − prix d'achat = ce qu'il reste »,
//    chaque « — » avec SA raison (src/beneficeArticle.js `lignesBeneficeArticle`) ;
//  · `BeneficeListeResume` : en tête d'une liste de ventes, la somme des articles
//    calculables « sur N de M », « au plus » s'il reste des frais à confirmer, et ce
//    qui manque, nommé (`beneficeListe`, `manquesListe`). Jamais « au moins ».
//  Chaque nombre rendu porte `data-*` en centimes ('' = « — ») : les bancs jugent les
//  nombres, pas les libellés. Aucun import d'App.jsx.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from './i18n/index.js';
import { lignesBeneficeArticle, manquesListe } from './beneficeArticle.js';
import { NOM_APRES_FRAIS } from './beneficeNoms.js';
import './argent-plus-2.css';

const eur = (c) => {
  if (c == null || !Number.isFinite(c)) return '—';
  const n = Math.abs(c);
  return (c < 0 ? '−' : '') + String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (n % 100 ? ',' + String(n % 100).padStart(2, '0') : '') + ' €';
};

// `seulement` : les lignes à montrer (la fiche montre déjà la vente, l'achat et le bénéfice dans ses
// tuiles — le même nombre ne s'écrit jamais deux fois sur un écran, §7 : elle ne garde que les frais).
// (21 nov., lot rentabilite) `detail` : les frais notés ligne par ligne (boost, emballage, port, commission notée, autres).
export function BeneficeArticleDetail({ b, seulement = null, detail = false }) {
  const L = lignesBeneficeArticle(b, tr, { detail }).filter((l) => !seulement || seulement.includes(l.cle) || (detail && seulement.includes('saisis') && /^cr-/.test(l.cle)));
  if (!L.length) return null;
  return (
    <div className="vrm-ba" data-benef-article={b.etat} data-benef-article-valeur={b.benefice == null ? '' : String(b.benefice)} data-benef-article-manque={(b.manque || []).join(' ') || undefined}>
      {L.map((l) => (
        <div key={l.cle} className={'vrm-ba-ligne' + (l.total ? ' vrm-ba-total' : '')} data-ba-ligne={l.cle} data-ba-valeur={l.v == null ? '' : String(l.v)}>
          <span>{l.total ? NOM_APRES_FRAIS : l.nom}{l.note ? <small>{l.note}</small> : null}</span>
          <span className={'vrm-ba-v' + (l.v == null ? ' is-vide' : '')}>{l.total && l.auPlus && l.v != null ? `${tr('argentPlus.ba.auPlus')} ` : ''}{l.total ? eur(l.v) : l.v == null ? '—' : (l.cle === 'vente' || l.cle === 'recu' || l.zero || l.v === 0 ? eur(l.v) : `− ${eur(l.v)}`)}</span>
        </div>
      ))}
    </div>
  );
}

// `sansAchat` : la liste dit déjà « N prix d'achat à saisir » au-dessus (une phrase se dit UNE fois, §7).
export function BeneficeListeResume({ s, sansAchat = false }) {
  if (!s || !s.n) return null;
  const manques = manquesListe(sansAchat ? { ...s, manque: { ...s.manque, achat: 0 } } : s, tr);
  return (
    <div className="vrm-surface vrm-bl" role="status" data-benef-liste={`${s.nCompte}/${s.n}`} data-benef-liste-valeur={s.somme == null ? '' : String(s.somme)} data-benef-liste-au-plus={s.auPlus ? '1' : undefined}>
      <div className="vrm-bl-int">
        <span className="vrm-bl-nom">{NOM_APRES_FRAIS}</span>
        <span className="vrm-bl-v">{s.somme == null ? '—' : `${s.auPlus ? tr('argentPlus.ba.auPlus') + ' ' : ''}${eur(s.somme)}`}</span>
        <span className="vrm-bl-sous">{[tr('argentPlus.bl.sur', { n: s.nCompte, m: s.n }), ...manques].join(' · ')}</span>
      </div>
    </div>
  );
}
