// ═══════════════════════════════════════════════════════════════════════════
// LA CARTE SOMBRE DES CHIFFRES, RÉGLABLE PAR PAGE (3 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « l'onglet avec les statistiques […] réglable sur chaque page […]
// modifiable en fonction de ce qu'on a sélectionné » — « juste le CA, le
// bénéfice etc. dans cette case sombre sur chaque onglet ».
// Un grand chiffre + trois cases (la maquette Fusion), choisis PAR PAGE dans
// une feuille (« Modifier »). Rien n'est calculé ici : les valeurs viennent de
// `valeursCarte` (src/design/carteChiffres.js), qui les tient des règles
// propriétaires que l'app lui passe. `null` ⇒ « — », jamais 0.
import React from 'react';
import { createPortal } from 'react-dom';
import CarteMois from './CarteMois.jsx';
import { CHIFFRES, NOM_PERIODE, PAGES_CARTE, chiffresProposes, courbeVendu, defDe, horsSelection, libelleCase, periodeDefaut, reglageAEnregistrer, reglageDePage, valeursCarte, valeurChiffre } from './carteChiffres.js';

const centimes = (v, type) => (v == null ? '' : type === 'eur' ? String(Math.round(Number(v) * 100)) : String(v));
const euros = (v) => `${Math.round(Number(v)).toLocaleString('fr-FR')} €`;

// `x` = une valeur de `valeursCarte` ; `grand` : le grand chiffre (centimes).
const affiche = (x, fmt, grand) => {
  if (x.def && x.def.local && x.def.affiche !== undefined && x.valeur != null) return x.def.affiche;
  if (x.valeur == null) return null;
  const t = (x.def && x.def.type) || 'n';
  const corps = t === 'eur' ? (grand ? fmt(x.valeur) : euros(x.valeur)) : String(x.valeur);
  if (!x.partiel) return corps;
  return grand ? <><span className="vrm-fu-borne">au moins</span>{corps}</> : <>{'≥ '}{corps}</>;
};
const attrsDeValeur = (x, page) => ({
  'data-carte-chiffre': x.place.id,
  'data-carte-p': x.p && typeof x.p === 'string' ? x.p : x.p ? 'plage' : '',
  'data-carte-valeur': centimes(x.valeur, x.def && x.def.type),
  'data-carte-partiel': x.partiel ? '1' : undefined,
  'data-carte-hors': x.hors || undefined,
  'data-carte-page': page,
});
const titreDe = (x) => {
  if (x.hors) return `${x.def ? x.def.nom : ''} : ${x.hors}`;
  if (x.partiel && x.manque && x.manque.length) return `Au moins : ${x.manque.join(', ')} pas lu`;
  if (x.def && x.def.titre) return x.def.titre;
  return x.def ? x.def.nom : '';
};

export default function CarteStats({ page, sel, sources, regles, reglage, poser, attrsDe = null, onNav = null, nu = false, className = '', FermeAuRetour = null, sous = null, extra = {}, clics = null }) {
  const [ouvert, setOuvert] = React.useState(false);
  const locaux = (sources && sources.locaux) || null;
  const V = valeursCarte(page, reglage, sources, sel, regles);
  if (!V) return null;
  const fmt = regles.fmt;
  const plus = (x) => (typeof attrsDe === 'function' ? attrsDe(x) : (attrsDe && attrsDe[x.place.id])) || null;
  const aller = (x) => {
    if (clics && clics[x.place.id]) return clics[x.place.id];
    if (x.def && x.def.local) return x.def.onClick || undefined;
    const t = x.def && x.def.aller;
    if (!onNav || !t || (PAGES_CARTE[page] && t === extra.ici)) return undefined;
    return () => onNav(t);
  };
  const g = V.g;
  const courbe = g.place.id === 'vendu' && !g.hors ? courbeVendu(sources, sel, g.p, regles) : null;
  const modifier = (
    <button type="button" className="vrm-fu-modifier" data-carte-modifier={page} aria-label="Choisir les chiffres de la carte" onClick={() => setOuvert(true)}>Modifier</button>
  );
  return (
    <>
      <CarteMois nu={nu} className={'vrm-carte-stats' + (className ? ' ' + className : '')} data-carte-stats={page} data-carte-perimetre={V.perimetre}
        data-carte-site={(sel && sel.site) || 'toutes'} data-carte-compte={sel && sel.compte ? String(sel.compte.uid || sel.compte.login || '') : ''}
        data-carte-defaut={V.defaut ? '1' : '0'} {...(extra.attrs || {})}
        surtitre={V.perimetre}
        action={modifier}
        grandAttrs={{ ...attrsDeValeur(g, page), ...(g.attrs || {}), ...(g.def && g.def.local && g.def.attrs ? g.def.attrs : {}), title: titreDe(g), ...(plus(g) || {}) }}
        valeur={affiche(g, fmt, true)}
        sous={sous || <span className="vrm-fu-sous-nom">{g.def ? (g.def.local ? (g.def.court || g.def.nom) : g.def.court) : ''}</span>}
        courbe={courbe && courbe.length > 1 ? courbe : null}
        cases={V.c.map((x) => ({
          cle: x.place.id + (x.p && typeof x.p === 'string' ? '-' + x.p : ''),
          n: affiche(x, fmt, false),
          l: x.def ? (x.def.local ? (x.def.court || x.def.nom) : libelleCase(x.def, x.p, g.p, sel)) : '',
          titre: titreDe(x),
          onClick: aller(x),
          attrs: { ...attrsDeValeur(x, page), ...(x.attrs || {}), ...(x.def && x.def.local && x.def.attrs ? x.def.attrs : {}), ...(plus(x) || {}) },
        }))} />
      {ouvert ? <FeuilleCarte page={page} sel={sel} sources={sources} regles={regles} reglage={reglage} poser={poser} locaux={locaux} fermer={() => setOuvert(false)} FermeAuRetour={FermeAuRetour} /> : null}
    </>
  );
}

// ── LA FEUILLE « MODIFIER » ─────────────────────────────────────────────────
// Quatre places (le grand chiffre, trois cases) ; on touche une place, puis le
// chiffre qui y va. La période se choisit pour CE chiffre quand la page n'a pas
// son propre filtre de période. Chaque choix est rangé tout de suite (la carte,
// derrière, change sous ses yeux) ; « Par défaut » rend la carte des maquettes.
function FeuilleCarte({ page, sel, sources, regles, reglage, poser, locaux, fermer, FermeAuRetour }) {
  const R = reglageDePage(reglage, page, locaux);
  const [place, setPlace] = React.useState(0);
  const places = [R.g, ...R.c];
  const actuelle = places[place] || null;
  const choisir = (id, p) => {
    const d = defDe(id, locaux);
    const nouvelle = Array.isArray(d && d.periodes) ? { id, p: p || (actuelle && actuelle.id === id && actuelle.p) || periodeDefaut(d) } : { id };
    const L = places.slice();
    // Le même chiffre à la même période ailleurs sur la carte : les deux places s'échangent (§7 : un nombre, une fois).
    const dejaIci = L.findIndex((x, i) => i !== place && x && x.id === nouvelle.id && (x.p || '') === (nouvelle.p || ''));
    if (dejaIci >= 0) L[dejaIci] = L[place];
    L[place] = nouvelle;
    poser(reglageAEnregistrer(reglage, page, { g: L[0], c: L.slice(1, 4) }));
  };
  const ids = chiffresProposes(sel, locaux);
  const def = actuelle ? defDe(actuelle.id, locaux) : null;
  const periodePage = sel && sel.periode;
  const noms = ['Grand chiffre', 'Case 1', 'Case 2', 'Case 3'];
  const apercu = (id) => {
    const d = defDe(id, locaux);
    const v = valeurChiffre(id, { id, p: (actuelle && actuelle.id === id && actuelle.p) || periodeDefaut(d) }, sources, sel, regles);
    if (v.valeur == null) return '—';
    return (d.type === 'eur' ? `${Math.round(Number(v.valeur)).toLocaleString('fr-FR')} €` : String(v.valeur)) + (v.partiel ? ' au moins' : '');
  };
  const contenu = (
    <div data-noswipe="" data-carte-feuille={page} onClick={fermer} className="vrm-w-voile vrm-carte-voile">
      {FermeAuRetour ? <FermeAuRetour fermer={fermer} /> : null}
      <div role="dialog" aria-label="Les chiffres de la carte" onClick={(e) => e.stopPropagation()} className="vrm-w-feuille vrm-carte-feuille">
        <div className="vrm-w-feuille-tete vrm-carte-feuille-tete">
          <div className="vrm-carte-feuille-titre">{(PAGES_CARTE[page] && PAGES_CARTE[page].nom) || 'La carte'}</div>
          <button type="button" className="vrm-carte-ok" data-carte-fermer="" onClick={fermer}>OK</button>
        </div>
        <div className="vrm-w-feuille-corps">
          <div className="vrm-carte-places" role="group" aria-label="Place à régler">
            {places.map((x, i) => {
              const d = x ? defDe(x.id, locaux) : null;
              return (
                <button key={i} type="button" className="vrm-carte-place" aria-pressed={place === i} data-carte-place={i} onClick={() => setPlace(i)}>
                  <span>{noms[i]}</span><b>{d ? d.nom : '—'}</b>
                </button>
              );
            })}
          </div>
          {def && Array.isArray(def.periodes) && def.periodes.length > 1 && !periodePage ? (
            <div className="vrm-carte-periodes" role="group" aria-label="Période">
              {def.periodes.map((p) => (
                <button key={p} type="button" aria-pressed={actuelle.p === p} data-carte-periode={p} onClick={() => choisir(actuelle.id, p)}>{NOM_PERIODE[p]}</button>
              ))}
            </div>
          ) : null}
          <ul className="vrm-carte-liste">
            {ids.map((id) => {
              const d = defDe(id, locaux);
              const pris = actuelle && actuelle.id === id;
              return (
                <li key={id}>
                  <button type="button" className="vrm-carte-choix" aria-pressed={pris} data-carte-choix={id} onClick={() => choisir(id)}>
                    <span className="vrm-carte-choix-nom">{d.nom}{d.vinted && (!sel || sel.site === 'toutes') ? ' · Vinted' : ''}</span>
                    <span className="vrm-carte-choix-v">{apercu(id)}</span>
                    <span className="vrm-carte-coche" aria-hidden="true">{pris ? '✓' : ''}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="vrm-carte-defaut" data-carte-defaut-remettre="" onClick={() => { poser(reglageAEnregistrer(reglage, page, null)); setPlace(0); }}>Par défaut</button>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(contenu, document.body) : contenu;
}

export { CHIFFRES, horsSelection };
