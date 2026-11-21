// ── src/natif/ecrans/RepublierPriorite.jsx — « À republier en priorité » (21 nov., choix n° 12 de Julien) ─────────────
// Une VUE : la liste du jour vient de `republierEnPriorite` (src/republierPriorite.js — la règle « Dorment », ses
// exclusions, son classement) ; l'écran coche, et « Republier N » (le plein de la page, posé par l'écran) ouvre l'atelier
// Republier du PANNEAU de l'extension avec ces annonces présélectionnées. Rien ne part d'ici : c'est LUI qui lance, dans le
// panneau (§3, jamais à l'aveugle).
// Téléphone ET ordinateur : des rangées fines pleine largeur (vignette, titre complet, plaque N°, la raison chiffrée en gris,
// le prix), une case de 44 à gauche, un intertitre par compte (logo · pseudo · N). Pas de capitales, pas de carte arrondie.
// Props :
//   res        undefined (lecture) · null (pas su) · le résultat de `republierEnPriorite`
//   lignes     les lignes MONTRÉES (res.liste, éventuellement filtrées par la recherche de l'écran)
//   coches     Set des `cle` cochées · onBasculer(ligne) · onTout()
//   onReglage({ jours?, parJour? }) · Photo(src) · Logo(site) · euros(n) · Icon
import React from 'react';
import { tr } from '../../i18n/index.js';
import { Groupe } from '../Groupe.jsx';
import { Rangee, Vignette } from '../Rangee.jsx';
import { Bouton } from '../Bouton.jsx';
import { Segmente } from '../Segmente.jsx';
import { Feuille } from '../Feuille.jsx';
import { Plaque } from '../Plaque.jsx';
import { Vide } from '../Vide.jsx';
import { Attente } from '../Attente.jsx';
import { Glyphe } from '../icones.jsx';
import { raisonPriorite, selectionRepublier, SEUILS_AGE, PAR_JOUR_CHOIX, EXCLUSIONS } from '../../republierPriorite.js';
import './republierPriorite.css';

// « 41 j · 136 vues · 0 favori · vues qui baissent » — chaque morceau par tr() (5 langues).
export const texteRaisonPrio = (l) => raisonPriorite(l).map((m) => tr('prio.raison.' + m.k, m.n != null ? { n: m.n } : undefined)).join(' · ');

// La sélection par défaut : toute la liste du jour si elle est d'UN compte, sinon celles du premier compte (l'atelier agit au
// nom du compte de l'onglet : une ouverture = un compte). Rejouée quand la liste change.
export function usePrioSelection(lignes) {
  const sig = (lignes || []).map((l) => l.cle).join('|');
  const defaut = React.useCallback(() => {
    const L = lignes || []; if (!L.length) return new Set();
    const c0 = L[0].annonce.compte;
    return new Set(L.filter((l) => l.annonce.compte === c0).map((l) => l.cle));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const [coches, setCoches] = React.useState(defaut);
  React.useEffect(() => { setCoches(defaut()); }, [defaut]);
  const onBasculer = (l) => setCoches((s) => { const n = new Set(s); if (n.has(l.cle)) n.delete(l.cle); else n.add(l.cle); return n; });
  const onTout = () => setCoches((s) => ((lignes || []).every((l) => s.has(l.cle)) && s.size ? new Set() : new Set((lignes || []).map((l) => l.cle))));
  return { coches, onBasculer, onTout };
}

// Le plein « Republier N » : indisponible (et dit pourquoi) sans sélection ou sur deux comptes. `onRepublier({ ids, compte })`.
export function PleinRepublier({ lignes, coches, onRepublier }) {
  const j = selectionRepublier(lignes, coches);
  const n = (lignes || []).filter((l) => coches.has(l.cle)).length;
  return (
    <Bouton variante="plein" indisponible={!j.ok} raison={j.ok ? '' : tr('prio.refus.' + j.raison)} onClick={() => { if (j.ok) onRepublier({ ids: j.ids, compte: j.compte }); }}
      attrs={{ 'data-prio-lancer': String(n), 'data-prio-ok': j.ok ? '1' : '0', 'data-prio-refus': j.ok ? undefined : j.raison }}>{tr('prio.republierN', { n })}</Bouton>
  );
}

export default function RepublierPriorite({ res, lignes, coches, onBasculer, onTout, onReglage, Photo = null, Logo = null, euros = (n) => String(n) + ' €', Icon = null }) {
  const [reglages, setReglages] = React.useState(false);
  if (res === undefined) return <div data-prio-ecran="" data-prio-etat="lecture"><Attente forme="rangees" n={5} vignette={56} titre/></div>;
  if (res === null) return <div data-prio-ecran="" data-prio-etat="passu"><Vide icone={Icon ? <Icon name="alert" size={40}/> : null} phrase={tr('prio.pasSu')}/></div>;
  const L = Array.isArray(lignes) ? lignes : res.liste;
  const r = res.reglage;
  // L'intertitre par compte (l'ordre du classement est gardé DANS chaque compte ; les comptes dans l'ordre de leur 1re ligne).
  const groupes = [];
  for (const l of L) { let g = groupes.find((x) => x.compte === l.annonce.compte); if (!g) { g = { compte: l.annonce.compte, pseudo: l.annonce.pseudo, lignes: [] }; groupes.push(g); } g.lignes.push(l); }
  const exclues = EXCLUSIONS.filter((k) => res.exclues[k] > 0).map((k) => tr('prio.exclue.' + k, { n: res.exclues[k] }));
  const toutes = L.length > 0 && L.every((l) => coches.has(l.cle));
  return (
    <div data-prio-ecran="" data-prio-etat="lu" data-prio-n={String(res.n)} data-prio-montres={String(L.length)} data-prio-jours={String(r.jours)} data-prio-par-jour={String(r.parJour)}>
      {/* UNE ligne fine : ce que la liste est, et ses deux réglages (au toucher, une feuille). */}
      <button type="button" className="n-rp-reglages" data-prio-reglages="" onClick={() => setReglages(true)}>
        <span className="n-rp-reglages-texte">{tr('prio.resume', { jours: r.jours, n: r.parJour })}</span>
        <Glyphe nom="chevron" taille={14}/>
      </button>
      {!L.length ? <Vide icone={Icon ? <Icon name="check" size={40}/> : null} phrase={res.n ? tr('prio.videRecherche') : tr('prio.vide', { jours: r.jours })}/> : (
        <>
          <div className="n-rp-outils">
            <span className="n-rp-phrase" aria-hidden="true"/>
            <Bouton variante="texte" onClick={onTout} attrs={{ 'data-prio-tout': '' }}>{toutes ? tr('egalite.selection.rien') : tr('egalite.selection.tout')}</Bouton>
          </div>
          {groupes.map((g) => (
            <section key={g.compte} className="n-rp-section" data-prio-compte={g.compte}>
              <div className="n-rp-compte">{Logo ? <span className="n-rp-logo" aria-hidden="true">{Logo('vinted')}</span> : null}<span>{g.pseudo || ('#' + g.compte)}</span><span className="n-rp-compte-n"> · {g.lignes.length}</span></div>
              <div className="n-rp-liste">
                {g.lignes.map((l) => {
                  const a = l.article;
                  return (
                    <Rangee key={l.cle} vignette={<Vignette src={a.photo || ''} alt="" image={Photo && a.photo ? Photo(a.photo) : null}/>} titre={a.titre || tr('egalite.sansTitre')} lignes={2}
                      plaque={a.numero ? <Plaque numero={a.numero} doublon={a.doublon}/> : null} sousTitre={texteRaisonPrio(l)} sousLignes={2} valeur={a.prix != null ? euros(a.prix) : null}
                      selection={{ cochee: coches.has(l.cle), onChange: () => onBasculer(l), libelle: a.titre || tr('egalite.sansTitre') }}
                      attrs={{ 'data-prio-ligne': l.cle, 'data-prio-rang': String(l.rang), 'data-prio-annonce': l.annonce.id, 'data-prio-jours': String(l.jours), 'data-prio-vues': l.vues == null ? '' : String(l.vues),
                        'data-prio-favoris': l.favoris == null ? '' : String(l.favoris), 'data-prio-baisse': l.baisse === true ? '1' : l.baisse === false ? '0' : '', 'data-prio-coche': coches.has(l.cle) ? '1' : '0', 'data-prio-score': String(l.score) }}/>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
      <Groupe nu pied={[res.reste > 0 ? tr('prio.reste', { n: res.reste }) : '', exclues.length ? tr('prio.exclues', { liste: exclues.join(', ') }) : '', tr('prio.rienNePart')].filter(Boolean).join(' ')}
        attrs={{ 'data-prio-pied': '', 'data-prio-exclues': EXCLUSIONS.map((k) => k + ':' + res.exclues[k]).join(',') }}/>
      <Feuille ouverte={reglages} onFermer={() => setReglages(false)} titre={tr('prio.reglages.titre')} attrs={{ 'data-prio-feuille': '' }}>
        <Groupe nu>
          <p className="n-rp-label">{tr('prio.reglages.age')}</p>
          <Segmente libelle={tr('prio.reglages.age')} valeur={String(r.jours)} onChange={(v) => onReglage && onReglage({ jours: Number(v) })}
            options={SEUILS_AGE.map((s) => ({ cle: String(s), libelle: tr('prio.reglages.jours', { n: s }), attrs: { 'data-prio-age': String(s) } }))}/>
          <p className="n-rp-label">{tr('prio.reglages.parJour')}</p>
          <Segmente libelle={tr('prio.reglages.parJour')} valeur={String(r.parJour)} onChange={(v) => onReglage && onReglage({ parJour: Number(v) })}
            options={PAR_JOUR_CHOIX.map((s) => ({ cle: String(s), libelle: String(s), attrs: { 'data-prio-nombre': String(s) } }))}/>
          <p className="n-rp-note">{tr('prio.reglages.note')}</p>
        </Groupe>
      </Feuille>
    </div>
  );
}
