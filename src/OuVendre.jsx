// ── « OÙ VENDRE CET ARTICLE ? » SUR LA FICHE (15 nov., lot securite-ventes) ─────────────────────────
// La règle est dans `src/ouVendre.js` (pure). Ici : un prix (le sien, modifiable), une rangée par site —
// sa marque, ce qu'il touche (à l'encre), la raison en une ligne grise — le meilleur dit par un mot, sans
// couleur criarde ; un site sans compte relié est grisé « pas relié ». Rien n'est écrit, rien n'est
// publié : c'est une calculette, son clic reste sur « Publier ailleurs ».
import React from 'react';
import { tr, monnaie } from './i18n/index.js';
import { useLangue } from './i18n/react.js';
import MarquePlateforme from './plateformes/Marque.jsx';
import { ouVendre, centimesPrix, SOURCES_FRAIS, SEUIL_TAUX } from './ouVendre.js';
import './design/ou-vendre.css';

const NOMS = { vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective' };
const eur = (c) => { const n = c / 100; return monnaie(n, 'EUR', c % 100 ? undefined : { minimumFractionDigits: 0, maximumFractionDigits: 0 }); };
const pc = (x) => String(x).replace('.', tr('ov.virgule'));

// La ligne grise d'un site (une seule phrase courte).
// Le détail d'une estimation (« 15 à 19 % ») : au survol et pour les lecteurs d'écran, pas dans la ligne (moins d'écriture).
export const detailEstime = (l) => (l.etat === 'estime' && l.pctMin != null && l.pctMax != null && l.pctMin !== l.pctMax
  ? tr('ov.estimeEcart', { pct: pc(l.pct), min: pc(l.pctMin), max: pc(l.pctMax), n: l.n }) : undefined);
export function sousLigne(l) {
  if (l.etat === 'pasRelie') return tr('ov.pasRelie');
  if (l.etat === 'connu') return tr(l.site === 'leboncoin' ? 'ov.aucunFraisLbc' : 'ov.aucunFraisVinted');
  if (l.etat === 'estime') {
    const base = tr('ov.estime', { pct: pc(l.pct), n: l.n });
    return l.site === 'ebay' ? `${base} · ${tr('ov.portAcheteur')}` : base;
  }
  switch (l.raison) {
    case 'prix': return tr('ov.r.prix');
    case 'pro': return tr('ov.r.pro');
    case 'selonCompte': return tr('ov.r.selonCompte');
    case 'statutPasSu': return tr('ov.r.statutPasSu');
    case 'peuDeVentes': return tr('ov.r.peuDeVentes', { n: l.n || 0, seuil: SEUIL_TAUX });
    default: return tr('ov.r.pasLu');
  }
}

// prixDepart : en euros (nombre ou texte) ou null ; sites : { [site]: { relie, frais } } (la coque les lit).
export default function OuVendre({ prixDepart = null, sites }) {
  useLangue();
  const [saisie, setSaisie] = React.useState(() => (prixDepart == null || prixDepart === '' ? '' : String(prixDepart).replace('.', ',')));
  // Le prix de la fiche arrive après sa lecture : il remplit le champ tant qu'il n'a rien tapé.
  const tape = React.useRef(false);
  React.useEffect(() => { if (!tape.current && prixDepart != null && prixDepart !== '') setSaisie(String(prixDepart).replace('.', ',')); }, [prixDepart]);
  const cPrix = centimesPrix(saisie);
  const R = React.useMemo(() => ouVendre({ cPrix, sites: sites || {} }), [cPrix, sites]);
  const id = React.useId().replace(/:/g, '');
  return (
    <section className="vrm-ov" data-ou-vendre="" data-ou-vendre-prix={cPrix == null ? '' : String(cPrix)} data-ou-vendre-meilleurs={R.meilleurs.join(',')} data-ou-vendre-partiel={R.partiel ? '1' : '0'} aria-labelledby={id + '-t'}>
      <div className="vrm-ov-tete">
        <h3 className="vrm-ov-titre" id={id + '-t'}>{tr('ov.titre')}</h3>
        <label className="vrm-ov-prix" htmlFor={id}>
          <span className="vrm-ov-prix-l">{tr('ov.prix')}</span>
          <input id={id} className="vrm-ov-champ" data-ou-vendre-saisie="" type="text" inputMode="decimal" autoComplete="off" value={saisie} placeholder="—"
            onChange={(e) => { tape.current = true; setSaisie(e.target.value); }} aria-invalid={saisie !== '' && cPrix == null ? 'true' : undefined}/>
          <span className="vrm-ov-prix-u" aria-hidden="true">€</span>
        </label>
      </div>
      <ul className="vrm-ov-liste" role="list">
        {R.lignes.map((l) => (
          <li key={l.site} className={'vrm-ov-site is-' + l.etat + (l.meilleur ? ' is-meilleur' : '')} data-ou-vendre-site={l.site} data-ou-vendre-etat={l.etat}
            data-ou-vendre-touche={l.cTouche == null ? '' : String(l.cTouche)} data-ou-vendre-frais={l.cFrais == null ? '' : String(l.cFrais)} data-ou-vendre-meilleur={l.meilleur ? '1' : undefined}>
            <span className="vrm-ov-marque" aria-hidden="true"><MarquePlateforme site={l.site} taille={22} carre/></span>
            <span className="vrm-ov-txt">
              <span className="vrm-ov-nom">{NOMS[l.site]}</span>
              <span className="vrm-ov-sous" title={detailEstime(l)}>{sousLigne(l)}</span>
            </span>
            <span className="vrm-ov-droite">
              {l.etat === 'pasRelie' ? null : <b className="vrm-ov-montant">{l.cTouche == null ? '—' : <>{l.etat === 'estime' ? '≈ ' : ''}{eur(l.cTouche)}</>}</b>}
              {l.meilleur ? <span className="vrm-ov-meilleur">{tr('ov.lePlus')}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {R.partiel && R.meilleurs.length ? <p className="vrm-ov-note" data-ou-vendre-note="">{tr('ov.parmiConnus')}</p> : null}
      <details className="vrm-ov-sources" data-ou-vendre-sources="">
        <summary>{tr('ov.sources')}</summary>
        <p>{tr('ov.sourcesTexte')}</p>
        <ul role="list">
          {Object.keys(SOURCES_FRAIS).map((s) => SOURCES_FRAIS[s].map((x, i) => (
            <li key={s + i}>{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.titre}</a> : <span>{x.titre}</span>}</li>
          )))}
        </ul>
      </details>
    </section>
  );
}
