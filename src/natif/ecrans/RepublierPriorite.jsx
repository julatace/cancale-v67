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
import { Actions, Pourquoi } from '../Actions.jsx';
import { raisonPriorite, selectionRepublier, SEUILS_AGE, PAR_JOUR_CHOIX, EXCLUSIONS } from '../../republierPriorite.js';
import { PLUS_VUE_CHOIX } from '../../plusVue.js';   // (22 nov., choix 27) « Plus vue depuis N j »
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

// (28 nov.) « S'essouffle » : la phrase de la ligne (≤ 8 mots) et le gain estimé de SON compte, avec sa couverture ; pas su ⇒ « — ».
export const texteEssouffle = (l) => (l && l.essouffle ? tr('ess.ligne', { n: l.essouffle.jours }) : '');
// L'état de la lecture des courbes, au pied : en cours, pas su (« — » et pourquoi), ou des annonces dont la courbe ne dit rien.
export const texteEtatEss = (e) => (!e ? '' : e.etat === 'lecture' ? tr('ess.lecture') : e.etat === 'passu' ? tr('ess.pasSu') : e.passu > 0 ? tr('ess.passuN', { n: e.passu }) : '');
export const texteGain = (g) => (g && g.moyenne != null && g.n > 0 ? tr('ess.gain', { v: g.moyenne, n: g.n }) : tr('ess.gainPasSu'));

// (22 nov., choix 27) plusVue : { jours, de(ligne) → jours mesurés | null, autres: [{ cle, article, annonce, jours }], republier(annonce) }
//   — une ligne « plus vue » dit la raison et porte « Republier » (la feuille Avant | Après de CETTE paire, dans le panneau) ;
//   `autres` : les annonces plus vues qui ne sont pas dans la liste du jour (pas encore « endormies »), dites une fois.
export default function RepublierPriorite({ res, lignes, coches, onBasculer, onTout, onReglage, Photo = null, Logo = null, euros = (n) => String(n) + ' €', Icon = null, plusVue = null, onRepublierUne = null }) {
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
                  const pv = plusVue && plusVue.de ? plusVue.de(l) : null;
                  const es = !!l.essouffle;
                  // (28 nov.) Une essoufflée : SA phrase, le gain dessous, « Republier » (l'atelier, CETTE annonce : rien ne part sans SON « Oui »).
                  const piedEss = es ? (<div className="n-rp-ess" data-ess-pied="">
                    <Actions elements={[onRepublierUne ? { cle: 'republier', icone: Icon ? <Icon name="sync" size={18}/> : null, libelle: tr('ess.republier'), onClick: () => onRepublierUne(l), attrs: { 'data-ess-republier': l.annonce.id } } : null]}/>
                    <Pourquoi attrs={{ 'data-ess-pourquoi': '' }}>{tr('ess.pourquoi', { n: l.essouffle.jours })}</Pourquoi>
                  </div>) : null;
                  return (
                    <Rangee key={l.cle} vignette={<Vignette src={a.photo || ''} alt="" image={Photo && a.photo ? Photo(a.photo) : null}/>} titre={a.titre || tr('egalite.sansTitre')} lignes={2}
                      plaque={a.numero ? <Plaque numero={a.numero} doublon={a.doublon}/> : null} sousTitre={es ? texteEssouffle(l) : texteRaisonPrio(l) + (pv != null ? ' · ' + tr('af.pv.raison', { n: pv }) : '')} sousLignes={2} valeur={a.prix != null ? euros(a.prix) : null}
                      note={es ? texteGain(l.gain) : undefined}
                      selection={{ cochee: coches.has(l.cle), onChange: () => onBasculer(l), libelle: a.titre || tr('egalite.sansTitre') }}
                      pied={es ? piedEss : pv != null && plusVue.republier ? <Bouton variante="texte" onClick={() => plusVue.republier(l.annonce)} attrs={{ 'data-pv-republier': l.annonce.id }}>{tr('actionsExt.republier')}</Bouton> : null}
                      attrs={{ 'data-prio-ligne': l.cle, 'data-prio-rang': String(l.rang), 'data-prio-annonce': l.annonce.id, 'data-prio-jours': String(l.jours), 'data-prio-vues': l.vues == null ? '' : String(l.vues),
                        'data-prio-favoris': l.favoris == null ? '' : String(l.favoris), 'data-prio-baisse': l.baisse === true ? '1' : l.baisse === false ? '0' : '', 'data-prio-coche': coches.has(l.cle) ? '1' : '0', 'data-prio-score': String(l.score), 'data-prio-plusvue': pv != null ? String(pv) : undefined,
                        'data-ess-jours': es ? String(l.essouffle.jours) : undefined, 'data-ess-gain': es ? (l.gain && l.gain.moyenne != null ? String(l.gain.moyenne) : '') : undefined, 'data-ess-gain-n': es ? String((l.gain && l.gain.n) || 0) : undefined }}/>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
      {plusVue && plusVue.autres && plusVue.autres.length ? (
        <section className="n-rp-section" data-pv-autres={String(plusVue.autres.length)}>
          <div className="n-rp-compte"><span>{tr('af.pv.section', { n: plusVue.jours })}</span><span className="n-rp-compte-n"> · {plusVue.autres.length}</span></div>
          <div className="n-rp-liste">
            {plusVue.autres.map((x) => { const a = x.article; return (
              <Rangee key={x.cle} vignette={<Vignette src={a.photo || ''} alt="" image={Photo && a.photo ? Photo(a.photo) : null}/>} titre={a.titre || tr('egalite.sansTitre')} lignes={2}
                plaque={a.numero ? <Plaque numero={a.numero} doublon={a.doublon}/> : null} sousTitre={[x.annonce.pseudo || '', tr('af.pv.raison', { n: x.jours })].filter(Boolean).join(' · ')} valeur={a.prix != null ? euros(a.prix) : null}
                pied={plusVue.republier ? <Bouton variante="texte" onClick={() => plusVue.republier(x.annonce)} attrs={{ 'data-pv-republier': x.annonce.id }}>{tr('actionsExt.republier')}</Bouton> : null}
                attrs={{ 'data-pv-ligne': x.annonce.id, 'data-prio-plusvue': String(x.jours) }}/>); })}
          </div>
        </section>) : null}
      <Groupe nu pied={[res.reste > 0 ? tr('prio.reste', { n: res.reste }) : '', exclues.length ? tr('prio.exclues', { liste: exclues.join(', ') }) : '', texteEtatEss(res.essouffle), tr('prio.rienNePart')].filter(Boolean).join(' ')}
        attrs={{ 'data-prio-pied': '', 'data-prio-exclues': EXCLUSIONS.map((k) => k + ':' + res.exclues[k]).join(','), 'data-ess-etat': res.essouffle ? res.essouffle.etat : '', 'data-ess-n': res.essouffle ? String(res.essouffle.n) : '' }}/>
      <Feuille ouverte={reglages} onFermer={() => setReglages(false)} titre={tr('prio.reglages.titre')} attrs={{ 'data-prio-feuille': '' }}>
        <Groupe nu>
          <p className="n-rp-label">{tr('prio.reglages.age')}</p>
          <Segmente libelle={tr('prio.reglages.age')} valeur={String(r.jours)} onChange={(v) => onReglage && onReglage({ jours: Number(v) })}
            options={SEUILS_AGE.map((s) => ({ cle: String(s), libelle: tr('prio.reglages.jours', { n: s }), attrs: { 'data-prio-age': String(s) } }))}/>
          <p className="n-rp-label">{tr('prio.reglages.parJour')}</p>
          <Segmente libelle={tr('prio.reglages.parJour')} valeur={String(r.parJour)} onChange={(v) => onReglage && onReglage({ parJour: Number(v) })}
            options={PAR_JOUR_CHOIX.map((s) => ({ cle: String(s), libelle: String(s), attrs: { 'data-prio-nombre': String(s) } }))}/>
          {plusVue ? <>
            <p className="n-rp-label">{tr('af.pv.reglage')}</p>
            <Segmente libelle={tr('af.pv.reglage')} valeur={String(plusVue.jours)} onChange={(v) => onReglage && onReglage({ plusVue: Number(v) })}
              options={PLUS_VUE_CHOIX.map((s) => ({ cle: String(s), libelle: tr('prio.reglages.jours', { n: s }), attrs: { 'data-pv-jours': String(s) } }))}/>
          </> : null}
          <p className="n-rp-note">{tr('prio.reglages.note')}</p>
        </Groupe>
      </Feuille>
    </div>
  );
}
