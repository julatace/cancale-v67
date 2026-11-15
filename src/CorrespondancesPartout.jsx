// ── LA CORRESPONDANCE D'UN SITE, DANS « PUBLIER PARTOUT » (15 nov.) — règle : src/correspondances.js ──
// En tête de chaque case : d'où part l'annonce (sa catégorie Vinted) et où elle arrive
// sur CE site (catégorie, univers, type, taille, état, couleur, marque), dans les mots
// du site. Une correspondance pas sûre se DEMANDE ici, avec les valeurs du site ; SA
// réponse est retenue pour cette catégorie Vinted (l'hôte l'écrit, sur son clic).
// eBay : les catégories viennent d'eBay lui-même (API Taxonomy, sur son jeton), au
// toucher de « Voir les catégories eBay » — aucune n'est choisie à sa place.
import React from 'react';
import { tr } from './i18n/index.js';
import { texteFiche } from './correspondances.js';

const NOM = (champ, fiche) => tr('corr.champ.' + (champ === 'taille' && fiche && fiche.valeurs && /chaussure/i.test(fiche.valeurs.sousNom || '') ? 'pointure' : champ));
const montreVal = (champ, v) => {
  if (v == null || v === '') return '';
  if (champ === 'etat' && /^\d{4}$/.test(String(v))) return tr('corr.ebayEtat.' + v);
  if (champ === 'categorie' && typeof v === 'object') return v.chemin || v.nom || v.id;
  return String(v);
};

function DemandeChoix({ cle, d, fiche, valeur, onChoix, disabled }) {
  return (
    <label className="vrm-pp-demande vrm-pp-corr-demande" data-pp-corr-demande={cle} data-bloque={d.bloque ? '1' : '0'}>
      <span>{NOM(d.champ, fiche)}{d.bloque ? <small className="vrm-pp-demande-mot">{tr('partout.demande.champ')}</small> : null}</span>
      <select value={valeur || ''} disabled={disabled} onChange={(e) => onChoix(e.target.value)} data-pp-corr-choix={cle}>
        <option value="">{tr('partout.demande.choisir')}</option>
        {d.choix.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );
}

function ChoixEbay({ l, x, onChercherEbay, onRepondre, disabled }) {
  const [etat, setEtat] = React.useState({ phase: '', liste: [] });
  const q = (x.corr && x.corr.requete) || l.titre || '';
  const chercher = async () => {
    setEtat({ phase: 'lecture', liste: [] });
    let r = null; try { r = await onChercherEbay(q); } catch (_) { r = null; }
    setEtat(r === null ? { phase: 'passu', liste: [] } : { phase: 'lu', liste: r.slice(0, 8) });
  };
  return (
    <div className="vrm-pp-corr-ebay" data-pp-corr-ebay={etat.phase || 'repos'}>
      <button type="button" className="sb-lien vrm-pp-corr-chercher" disabled={disabled || etat.phase === 'lecture'} onClick={chercher} data-pp-corr-ebay-chercher={l.id}>
        {etat.phase === 'lecture' ? tr('corr.ebay.lecture') : tr('corr.ebay.voir')}
      </button>
      {etat.phase === 'passu' ? <p className="vrm-pp-raison is-geste" data-pp-corr-ebay-passu="">{tr('corr.ebay.passu')}</p> : null}
      {etat.phase === 'lu' && !etat.liste.length ? <p className="vrm-pp-raison" data-pp-corr-ebay-aucune="">{tr('corr.ebay.aucune')}</p> : null}
      {etat.liste.length ? (
        <ul className="vrm-pp-corr-liste" data-pp-corr-ebay-liste={etat.liste.length}>
          {etat.liste.map((c) => (
            <li key={c.id}>
              <button type="button" className="vrm-pp-corr-rangee" disabled={disabled} data-pp-corr-ebay-cat={c.id}
                onClick={() => { onRepondre(l.id, 'ebay', 'categorie', { id: c.id, nom: c.nom, chemin: c.chemin }); setEtat({ phase: '', liste: [] }); }}>
                <b>{c.nom}</b>{c.chemin ? <small>{c.chemin}</small> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// La correspondance de la case `x` (sortie `lignePartout`, `x.corr` = `ficheSite`).
export default function CorrespondanceSite({ l, x, enCours, onRepondre, onChercherEbay, nomSite }) {
  const f = x.corr;
  if (!f) return null;
  const rep = (champ, v) => onRepondre && onRepondre(l.id, x.site, champ, v);
  const cible = texteFiche(f);
  const nDemandes = f.demandes.length;
  const sure = !nDemandes && !f.hors;
  const criteres = x.site === 'leboncoin' ? ['taille', 'etat', 'couleur', 'marque'] : x.site === 'ebay' ? ['etat', 'pointureEU'] : [];
  return (
    <div className="vrm-pp-corr" data-pp-corr={x.site} data-pp-corr-connue={f.connue ? '1' : '0'} data-pp-corr-demandes={nDemandes} data-pp-corr-sure={sure ? '1' : '0'}
      data-pp-corr-catalogue={f.catalogId || ''}>
      <p className="vrm-pp-corr-vinted" data-pp-corr-vinted="">
        <span>{tr('corr.depuis')}</span> <b>{f.chemin ? f.chemin.replace(/ > /g, ' › ') : f.catalogId ? tr('corr.catNum', { id: f.catalogId }) : tr('corr.pasLue')}</b>
      </p>
      {f.hors ? <p className="vrm-pp-raison" data-pp-corr-hors="">{tr('corr.hors', { site: nomSite })}</p> : (
        <p className="vrm-pp-corr-cible" data-pp-corr-cible={cible}>
          <span>{tr('corr.vers', { site: nomSite })}</span> <b>{cible || tr('corr.aChoisir')}</b>
          {sure ? <span className="vrm-pp-corr-ok" aria-label={tr('corr.sure')}> ✓</span> : null}
        </p>
      )}
      {!f.hors && criteres.some((k) => f.valeurs[k]) ? (
        <ul className="vrm-pp-corr-vals">
          {criteres.filter((k) => f.valeurs[k]).map((k) => (
            <li key={k} data-pp-corr-val={k} data-pp-corr-origine={f.origine[k] || ''}><span>{k === 'pointureEU' ? tr('corr.champ.pointureEU') : NOM(k, f)}</span> <b>{montreVal(k, f.valeurs[k])}</b></li>
          ))}
        </ul>
      ) : null}
      {f.raison === 'categorie-pas-lue' && !f.hors ? <p className="vrm-pp-aide" data-pp-corr-pas-lue="">{tr('corr.pasLueAide')}</p> : null}
      {x.site === 'vestiaire' && !f.hors && !f.posee && (f.valeurs.sous || nDemandes) ? <p className="vrm-pp-aide" data-pp-corr-vc-finir="">{tr('corr.vcFinir')}</p> : null}
      {f.demandes.filter((d) => d.choix.length).map((d) => (
        <DemandeChoix key={d.champ} cle={`${x.site}:${d.champ}`} d={d} fiche={f} disabled={enCours} onChoix={(v) => rep(d.champ, v)}/>
      ))}
      {x.site === 'ebay' && !f.valeurs.categorie && onChercherEbay ? <ChoixEbay l={l} x={x} onChercherEbay={onChercherEbay} onRepondre={onRepondre} disabled={enCours}/> : null}
      {x.site === 'ebay' && f.valeurs.categorie ? (
        <button type="button" className="sb-lien" disabled={enCours} data-pp-corr-ebay-changer={l.id} onClick={() => rep('categorie', null)}>{tr('corr.ebay.changer')}</button>
      ) : null}
      {nDemandes && f.catalogId ? <p className="vrm-pp-aide" data-pp-corr-retenue="">{tr('corr.retenue')}</p> : null}
    </div>
  );
}
